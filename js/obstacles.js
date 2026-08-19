import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GROUPS } from './physics.js';

const obstacles = [];

export const OBSTACLE_TYPES = {
    STATIC_WALL: 'static_wall',
    SWINGING_ARM: 'swinging_arm',
    SLIDING_BLOCK: 'sliding_block',
    LOW_BAR: 'low_bar'
};

// Shared materials
const wallMaterial = (() => {
    const w = 512;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Deep mortar — the dark grid every brick sits in
    ctx.fillStyle = '#140f0e';
    ctx.fillRect(0, 0, w, h);

    const brickW = 82;
    const brickH = 34;
    const mortar = 7;
    const rows = Math.ceil(h / (brickH + mortar)) + 1;
    const cols = Math.ceil(w / (brickW + mortar)) + 1;

    for (let row = 0; row < rows; row++) {
        const offsetX = (row % 2 === 1) ? (brickW + mortar) / 2 : 0;
        for (let col = -1; col < cols; col++) {
            const x = col * (brickW + mortar) + offsetX;
            const y = row * (brickH + mortar);

            // Face colour varies per brick so the courses don't look tiled
            const r = 150 + Math.floor(Math.random() * 55);
            const g = 42 + Math.floor(Math.random() * 24);
            const b = 30 + Math.floor(Math.random() * 18);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, brickW, brickH);

            // Lit top-left, shadowed bottom-right — gives each brick depth so the
            // wall reads as masonry instead of a flat red pattern
            ctx.fillStyle = 'rgba(255,190,150,0.20)';
            ctx.fillRect(x, y, brickW, 3);
            ctx.fillRect(x, y, 3, brickH);
            ctx.fillStyle = 'rgba(0,0,0,0.42)';
            ctx.fillRect(x, y + brickH - 4, brickW, 4);
            ctx.fillRect(x + brickW - 4, y, 4, brickH);

            // Hard dark outline around every brick — this is what makes the
            // courses legible when the wall is flying toward you at 2x speed
            ctx.strokeStyle = 'rgba(8,4,4,0.85)';
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 1.5, y + 1.5, brickW - 3, brickH - 3);
        }
    }

    // White X last, over a dark backing stroke so it stays unmistakable
    // against the brighter brick faces
    const pad = 26;
    ctx.lineCap = 'round';

    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 30;
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(w - pad, h - pad);
    ctx.moveTo(w - pad, pad);
    ctx.lineTo(pad, h - pad);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(w - pad, h - pad);
    ctx.moveTo(w - pad, pad);
    ctx.lineTo(pad, h - pad);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;

    return new THREE.MeshStandardMaterial({
        map: tex,
        // Kept low deliberately: emissive washes flat over a texture and would
        // erase the mortar lines. The aura shell supplies the glow instead.
        emissive: 0xc01828,
        emissiveIntensity: 0.3,
        roughness: 0.6,
        metalness: 0.15
    });
})();
const armMaterial = new THREE.MeshStandardMaterial({
    color: 0xff8800, emissive: 0xff6a00, emissiveIntensity: 0.9,
    roughness: 0.3, metalness: 0.45
});
const blockMaterial = (() => {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Red background
    ctx.fillStyle = '#cc1122';
    ctx.fillRect(0, 0, size, size);

    // Thick white X
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    const pad = 24;
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(size - pad, size - pad);
    ctx.moveTo(size - pad, pad);
    ctx.lineTo(pad, size - pad);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;

    return new THREE.MeshStandardMaterial({
        map: tex,
        emissive: 0xff0a3c,
        emissiveIntensity: 0.7,
        roughness: 0.35,
        metalness: 0.35
    });
})();
// Pushed to a true red so it can't be confused with the orange sliding bar —
// the two used to sit only a hue step apart
const barMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5093c, emissive: 0xff0033, emissiveIntensity: 0.8,
    roughness: 0.3, metalness: 0.45
});

// ── Aura glow ──
// There is no bloom pass in this renderer, so emissive alone can never spill
// light past a surface. Each obstacle gets a camera-facing quad, larger than the
// obstacle, whose brightness is driven by distance OUTSIDE the obstacle's
// rectangle: full strength where it meets the surface, decaying smoothly to
// nothing further out. That is what makes it read as an aura rather than an
// outline — a fresnel shell peaks at its own silhouette and cuts off hard,
// which is the band-around-the-object look this replaced.
//
// The quad sits at the obstacle's mid-depth, so the obstacle's own front face
// occludes the middle and only the surrounding falloff is visible.
const glowVertexShader = `
    varying vec2 vUv;
    varying float vViewDist;
    void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        // Same quantity Three.js feeds its own fog: view-space depth along the
        // camera axis. Matching it exactly is what keeps the aura fading in
        // lockstep with the obstacle's solid surface.
        vViewDist = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const glowFragmentShader = `
    uniform vec3 uColor;
    uniform float uStrength;
    uniform vec2 uQuadSize;   // world size of this quad
    uniform vec2 uRectHalf;   // half-extents of the solid obstacle behind it
    uniform float uFalloff;
    uniform float uSoftFloor; // aura strength far down the track
    uniform float uRampNear;  // distance at which it reaches full strength
    uniform float uRampFar;   // distance beyond which it stays at the floor
    uniform float fogDensity; // supplied by the renderer via fog: true
    varying vec2 vUv;
    varying float vViewDist;

    void main() {
        // Position in world units, measured from the obstacle's centre
        vec2 p = (vUv - 0.5) * uQuadSize;

        // Distance to the obstacle's rectangle: zero anywhere on the obstacle
        // itself, then growing outward. Exponential decay off that distance is
        // what ties the glow to the surface and fades it out like real light.
        vec2 d = max(abs(p) - uRectHalf, 0.0);
        float dist = length(d);
        float g = exp(-dist * uFalloff);

        // Feather the quad's own border so it can never show a seam
        float edge = 1.0 - max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) * 2.0;
        g *= smoothstep(0.0, 0.22, edge);

        // Fog. Three.js applies scene fog to its built-in materials but never
        // to a raw ShaderMaterial, so without this the aura burned at full
        // strength while the obstacle's own surface fogged away behind it —
        // which is why a distant obstacle showed as glow outline and nothing
        // else. Additive blending adds to the framebuffer, so fog has to drive
        // the contribution toward ZERO rather than toward the fog colour;
        // tinting it would brighten the scene instead of fading the aura.
        float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vViewDist * vViewDist);
        float fogged = 1.0 - fogFactor;

        // Deliberate soft-to-full ramp on top of fog: far down the track the
        // aura sits at uSoftFloor so an approaching obstacle reads as a soft
        // distant light, then eases up to its full designed strength by the
        // time it is close enough to actually dodge.
        float ramp = mix(uSoftFloor, 1.0, smoothstep(uRampFar, uRampNear, vViewDist));

        float a = g * uStrength * ramp * fogged;
        gl_FragColor = vec4(uColor * a, a);
    }
`;

// How far the aura reaches past a surface, and the decay rate that puts it at
// ~5% brightness right at that distance.
const GLOW_SPREAD = 0.5;
const GLOW_FALLOFF = 6.0;

// Soft-to-full ramp. GLOW_SOFT_FLOOR is the aura's share of its designed
// strength out at the spawn horizon; it reaches full strength at GLOW_RAMP_NEAR
// and holds the floor beyond GLOW_RAMP_FAR.
const GLOW_SOFT_FLOOR = 0.45;
const GLOW_RAMP_NEAR = 25.0;
const GLOW_RAMP_FAR = 90.0;

function makeGlowMaterial(color, strength) {
    return new THREE.ShaderMaterial({
        // UniformsLib.fog carries fogDensity, which the renderer refreshes each
        // frame for any material with fog: true — so the aura tracks the scene's
        // fog automatically instead of hard-coding its density here.
        uniforms: THREE.UniformsUtils.merge([
            THREE.UniformsLib.fog,
            {
                uColor: { value: new THREE.Color(color) },
                uStrength: { value: strength },
                uQuadSize: { value: new THREE.Vector2(1, 1) },
                uRectHalf: { value: new THREE.Vector2(0.5, 0.5) },
                uFalloff: { value: GLOW_FALLOFF },
                uSoftFloor: { value: GLOW_SOFT_FLOOR },
                uRampNear: { value: GLOW_RAMP_NEAR },
                uRampFar: { value: GLOW_RAMP_FAR }
            }
        ]),
        vertexShader: glowVertexShader,
        fragmentShader: glowFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: true
    });
}

const wallGlowMaterial = makeGlowMaterial(0xff2a44, 1.0);
const armGlowMaterial = makeGlowMaterial(0xff8c00, 1.25);
const blockGlowMaterial = makeGlowMaterial(0xff0a3c, 1.15);
const barGlowMaterial = makeGlowMaterial(0xff0033, 1.2);

const unitPlaneGeo = new THREE.PlaneGeometry(1, 1);

// The quad is parented to the obstacle mesh so it inherits every transform for
// free — it moves, spawns and gets cleaned up with it. The parent's scale is
// divided back out so the aura is a constant thickness rather than proportional
// to the obstacle. Sizes ride on the shared material via onBeforeRender, which
// keeps one material per obstacle type instead of one per obstacle.
function addGlow(parent, material, w, h) {
    const quadW = w + GLOW_SPREAD * 2;
    const quadH = h + GLOW_SPREAD * 2;

    const glow = new THREE.Mesh(unitPlaneGeo, material);
    glow.scale.set(quadW / w, quadH / h, 1);
    glow.renderOrder = 1;
    glow.onBeforeRender = (renderer, scene, camera, geometry, mat) => {
        mat.uniforms.uQuadSize.value.set(quadW, quadH);
        mat.uniforms.uRectHalf.value.set(w / 2, h / 2);
    };

    parent.add(glow);
    return glow;
}

// Shared geometries — every obstacle reuses these and scales them to size.
// BoxGeometry UVs are 0–1 per face regardless of dimensions, so a scaled unit
// cube is pixel-identical to a purpose-built box while costing no allocation,
// no GPU upload, and no disposal when the obstacle scrolls away.
const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);

// Half the width of the visual rail box (RAIL_WIDTH 0.3 in rails.js). Obstacles
// that span the track stop here so their ends meet the rail instead of sinking
// into it.
const RAIL_VISUAL_HALF_W = 0.15;

// ── Static wall ──
function createStaticWall(scene, world, zPos, trackWidth, trackY) {
    const wallWidth = trackWidth * 0.35 + Math.random() * trackWidth * 0.2;
    const wallHeight = 1.8;
    const wallDepth = 0.6;
    const xOffset = (Math.random() - 0.5) * (trackWidth - wallWidth) * 0.5;

    const mesh = new THREE.Mesh(unitBoxGeo, wallMaterial);
    mesh.scale.set(wallWidth, wallHeight, wallDepth);
    mesh.position.set(xOffset, trackY + wallHeight / 2, zPos);
    addGlow(mesh, wallGlowMaterial, wallWidth, wallHeight);
    scene.add(mesh);

    const shape = new CANNON.Box(new CANNON.Vec3(wallWidth / 2, wallHeight / 2, wallDepth / 2));
    const body = new CANNON.Body({
        mass: 0, shape,
        collisionFilterGroup: GROUPS.OBSTACLE,
        collisionFilterMask: GROUPS.MARBLE
    });
    body.position.set(xOffset, trackY + wallHeight / 2, zPos);
    world.addBody(body);

    const obstacle = { type: OBSTACLE_TYPES.STATIC_WALL, mesh, body, zPos, active: true, xOffset, wallWidth };
    obstacles.push(obstacle);
    return obstacle;
}

// ── Swinging arm ──
function createSwingingArm(scene, world, zPos, trackWidth, trackY) {
    const armLength = trackWidth * 0.65;
    const armHeight = 0.5;
    const armDepth = 0.5;
    const armY = trackY + 0.7;

    const group = new THREE.Group();
    group.position.set(0, 0, zPos);

    // No centre post — the bar reads as a free-floating neon beam sliding
    // across the track, and a static stem in the middle of a moving obstacle
    // made it hard to read which part was actually the hazard.
    const arm = new THREE.Mesh(unitBoxGeo, armMaterial);
    arm.scale.set(armLength, armHeight, armDepth);
    arm.position.set(0, armY, 0);
    addGlow(arm, armGlowMaterial, armLength, armHeight);
    group.add(arm);

    scene.add(group);

    const shape = new CANNON.Box(new CANNON.Vec3(armLength / 2, armHeight / 2, armDepth / 2));
    const body = new CANNON.Body({
        mass: 0, shape,
        collisionFilterGroup: GROUPS.OBSTACLE,
        collisionFilterMask: GROUPS.MARBLE
    });
    body.position.set(0, armY, zPos);
    world.addBody(body);

    const obstacle = {
        type: OBSTACLE_TYPES.SWINGING_ARM,
        mesh: group, body, arm, zPos,
        armY,
        swingSpeed: 1.5 + Math.random() * 0.5,
        swingPhase: Math.random() * Math.PI * 2,
        armLength,
        active: true
    };
    obstacles.push(obstacle);
    return obstacle;
}

// ── Sliding block ──
function createSlidingBlock(scene, world, zPos, trackWidth, trackY) {
    const blockSize = 1.4;

    const mesh = new THREE.Mesh(unitBoxGeo, blockMaterial);
    mesh.scale.setScalar(blockSize);
    mesh.position.set(0, trackY + blockSize / 2, zPos);
    addGlow(mesh, blockGlowMaterial, blockSize, blockSize);
    scene.add(mesh);

    const shape = new CANNON.Box(new CANNON.Vec3(blockSize / 2, blockSize / 2, blockSize / 2));
    const body = new CANNON.Body({
        mass: 0, shape,
        collisionFilterGroup: GROUPS.OBSTACLE,
        collisionFilterMask: GROUPS.MARBLE
    });
    body.position.set(0, trackY + blockSize / 2, zPos);
    world.addBody(body);

    const obstacle = {
        type: OBSTACLE_TYPES.SLIDING_BLOCK,
        mesh, body, zPos,
        baseY: trackY + blockSize / 2,
        slideRange: (trackWidth / 2) - blockSize,
        slideSpeed: 2 + Math.random(),
        slidePhase: Math.random() * Math.PI * 2,
        active: true
    };
    obstacles.push(obstacle);
    return obstacle;
}

// ── Low bar ──
function createLowBar(scene, world, zPos, trackWidth, trackY) {
    const barHeight = 0.5;
    const barDepth = 0.5;
    const barY = trackY + 0.6;
    const gapWidth = 2.2;

    // The bars stop at the inner face of the rails rather than running to the
    // track centre-line, which used to bury their ends inside the rail meshes.
    // The vertical posts are gone too — they sat exactly on the rails and read
    // as stems punched through them. Now each bar spans cleanly from its rail
    // to the gap, which is what the shape was always meant to look like.
    // Stop short of the rail by the aura's reach, so the glow has decayed to
    // nothing by the time it gets there. Ending flush against the rail pushed
    // red light onto it and made the bar look embedded again.
    const railInnerX = trackWidth / 2 - RAIL_VISUAL_HALF_W;
    const sectionWidth = (railInnerX - GLOW_SPREAD) - gapWidth / 2;
    const sectionCenter = gapWidth / 2 + sectionWidth / 2;

    const group = new THREE.Group();
    group.position.set(0, 0, zPos);

    const leftBar = new THREE.Mesh(unitBoxGeo, barMaterial);
    leftBar.scale.set(sectionWidth, barHeight, barDepth);
    leftBar.position.set(-sectionCenter, barY, 0);
    addGlow(leftBar, barGlowMaterial, sectionWidth, barHeight);
    group.add(leftBar);

    const rightBar = new THREE.Mesh(unitBoxGeo, barMaterial);
    rightBar.scale.set(sectionWidth, barHeight, barDepth);
    rightBar.position.set(sectionCenter, barY, 0);
    addGlow(rightBar, barGlowMaterial, sectionWidth, barHeight);
    group.add(rightBar);

    scene.add(group);

    const bodies = [];

    const leftShape = new CANNON.Box(new CANNON.Vec3(sectionWidth / 2, barHeight / 2, barDepth / 2));
    const leftBody = new CANNON.Body({
        mass: 0, shape: leftShape,
        collisionFilterGroup: GROUPS.OBSTACLE,
        collisionFilterMask: GROUPS.MARBLE
    });
    leftBody.position.set(-sectionCenter, barY, zPos);
    world.addBody(leftBody);
    bodies.push(leftBody);

    const rightShape = new CANNON.Box(new CANNON.Vec3(sectionWidth / 2, barHeight / 2, barDepth / 2));
    const rightBody = new CANNON.Body({
        mass: 0, shape: rightShape,
        collisionFilterGroup: GROUPS.OBSTACLE,
        collisionFilterMask: GROUPS.MARBLE
    });
    rightBody.position.set(sectionCenter, barY, zPos);
    world.addBody(rightBody);
    bodies.push(rightBody);

    const obstacle = {
        type: OBSTACLE_TYPES.LOW_BAR,
        mesh: group, body: leftBody, extraBodies: bodies, zPos, active: true, gapWidth
    };
    obstacles.push(obstacle);
    return obstacle;
}

export function updateObstacles(time) {
    for (const obs of obstacles) {
        if (!obs.active) continue;

        if (obs.type === OBSTACLE_TYPES.SWINGING_ARM) {
            const swing = Math.sin(time * obs.swingSpeed + obs.swingPhase) * 3;
            obs.arm.position.x = swing;
            obs.body.position.x = swing;
        }

        if (obs.type === OBSTACLE_TYPES.SLIDING_BLOCK) {
            const x = Math.sin(time * obs.slideSpeed + obs.slidePhase) * obs.slideRange;
            obs.mesh.position.x = x;
            obs.body.position.x = x;
        }
    }
}

export function spawnObstacle(scene, world, zPos, trackWidth, difficultyLevel, trackY) {
    const frequency = getObstacleFrequency(difficultyLevel);
    if (Math.random() > frequency) return null;

    const y = trackY || 0;
    const rand = Math.random();
    if (rand < 0.35) return createStaticWall(scene, world, zPos, trackWidth, y);
    else if (rand < 0.55) return createSwingingArm(scene, world, zPos, trackWidth, y);
    else if (rand < 0.80) return createSlidingBlock(scene, world, zPos, trackWidth, y);
    else return createLowBar(scene, world, zPos, trackWidth, y);
}

function getObstacleFrequency(level) {
    switch (level) {
        case 1: return 0.15;
        case 2: return 0.25;
        case 3: return 0.4;
        case 4: return 0.6;
        case 5: return 0.7;
        case 6: return 0.8;
        case 7: return 0.9;
        default: return 0.3;
    }
}

// All obstacle geometry is shared and stays resident, so teardown is just a
// scene detach plus dropping the physics bodies — no per-obstacle disposal.
export function removeOldObstacles(scene, world, marbleZ) {
    const removeThreshold = marbleZ + 60;

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        if (obs.zPos > removeThreshold) {
            scene.remove(obs.mesh);
            world.removeBody(obs.body);
            if (obs.extraBodies) obs.extraBodies.forEach(b => world.removeBody(b));
            obstacles.splice(i, 1);
        }
    }
}

export function getObstacles() { return obstacles; }

export function getObstacleMaterials() {
    return [
        wallMaterial, armMaterial, blockMaterial, barMaterial,
        wallGlowMaterial, armGlowMaterial, blockGlowMaterial, barGlowMaterial
    ];
}

export function resetObstacles(scene, world) {
    for (const obs of obstacles) {
        scene.remove(obs.mesh);
        world.removeBody(obs.body);
        if (obs.extraBodies) obs.extraBodies.forEach(b => world.removeBody(b));
    }
    obstacles.length = 0;
}
