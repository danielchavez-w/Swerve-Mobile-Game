// shootingstars.js — a burst of coloured streaks across the sky, fired when the
// level-up banner appears and gone by the time it fades.
//
// Everything (geometry, meshes, materials, uniforms) is allocated once at init.
// While idle the group is hidden and update() returns on the first line, so the
// effect costs nothing during normal play.
import * as THREE from 'three';

const STAR_COUNT = 5;
const LIFETIME = 2.6;          // seconds — last streak clears just before the banner does
const DEPTH = -100;            // units ahead of the camera

// Streaks are confined to a band of open sky. Both the track and the hex floor
// sit below the camera, so everything they occupy on screen is below the horizon
// line (camera-relative y = 0) at any distance. Keeping the whole streak — head
// AND tail — above SKY_LOW guarantees it never crosses the ground. Values are at
// the reference depth of 100 and scale with each streak's actual depth, so the
// band covers the same slice of sky no matter how far out it flies.
const SKY_LOW = 14;            // ≈8° above the horizon — clear of the ground
const SKY_HIGH = 34;           // just inside the top of the frame in portrait

// One vivid colour each, shuffled per celebration so no two look alike
const COLORS = [0xff2d95, 0x00e5ff, 0xffd23f, 0xb14dff, 0x39ff9e];

// Flight paths as start → end, x in sky units and b as a 0–1 height within the
// band. Every endpoint stays inside the band, so the whole sweep stays in sky.
const PATHS = [
    { sx: -52, sb: 0.86, ex: 52, eb: 0.55 },   // left → right
    { sx: 52, sb: 0.74, ex: -52, eb: 0.44 },   // right → left
    { sx: -46, sb: 0.08, ex: 34, eb: 0.95 },   // bottom-left → top-right
    { sx: 46, sb: 0.96, ex: -38, eb: 0.14 },   // top-right → bottom-left
    { sx: -30, sb: 1.00, ex: 30, eb: 0.18 }    // top-left → bottom-right
];

const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// u runs tail(0) → head(1); v is across the streak
const fragmentShader = `
    uniform vec3 uColor;
    uniform float uFade;
    uniform float uTime;
    varying vec2 vUv;

    void main() {
        float head = vUv.x;
        float lateral = abs(vUv.y - 0.5) * 2.0;

        // Brightness falls away toward the tail
        float trail = pow(head, 2.5);

        // Core tapers to a point at the tail and opens up at the head
        float width = mix(0.06, 1.0, pow(head, 0.7));
        float core = 1.0 - smoothstep(0.0, width, lateral);
        core *= core;

        // Soft bloom hugging the core
        float halo = pow(1.0 - lateral, 3.0) * 0.45;

        // Bright burst at the leading tip
        float burst = smoothstep(0.88, 1.0, head) * pow(1.0 - lateral, 2.0);

        // Sparkle travelling down the trail
        float shimmer = 0.82 + 0.18 * sin(head * 48.0 - uTime * 16.0);

        float intensity = (core * trail * shimmer + halo * trail * 0.55 + burst * 2.2) * uFade;

        // White-hot at the tip, saturated colour through the trail
        vec3 col = mix(uColor, vec3(1.0), clamp(burst * 0.9 + core * trail * 0.35, 0.0, 1.0));

        gl_FragColor = vec4(col * intensity, 1.0);
    }
`;

let group = null;
const stars = [];
const colorOrder = [0, 1, 2, 3, 4];
let active = false;
let startTime = 0;

function smoothstep(edge0, edge1, x) {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
}

export function createShootingStars(scene) {
    group = new THREE.Group();
    group.visible = false;

    // Unit quad, shared by every streak; each one scales it to its own length
    const geo = new THREE.PlaneGeometry(1, 1);

    for (let i = 0; i < STAR_COUNT; i++) {
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(COLORS[i]) },
                uFade: { value: 0 },
                uTime: { value: 0 }
            },
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geo, material);
        mesh.renderOrder = 2;
        mesh.visible = false;
        group.add(mesh);

        stars.push({
            mesh, material,
            delay: 0, duration: 1, angle: 0,
            sx: 0, sy: 0, dx: 1, dy: 0,
            dist: 90, length: 26, thickness: 1.1
        });
    }

    scene.add(group);
}

function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

// Re-roll one streak's flight for this celebration
function rollStar(star, index) {
    const path = PATHS[index];

    // Deeper streaks are scaled up so every one covers the same slice of sky
    star.depth = DEPTH - Math.random() * 20;
    const scale = Math.abs(star.depth) / 100;

    const bandLow = SKY_LOW * scale;
    const bandSpan = (SKY_HIGH - SKY_LOW) * scale;

    // Jitter the endpoints so repeat level-ups don't retrace the same lines
    const sx = (path.sx + (Math.random() - 0.5) * 8) * scale;
    const ex = (path.ex + (Math.random() - 0.5) * 8) * scale;
    const sy = bandLow + clamp01(path.sb + (Math.random() - 0.5) * 0.1) * bandSpan;
    const ey = bandLow + clamp01(path.eb + (Math.random() - 0.5) * 0.1) * bandSpan;

    const vx = ex - sx;
    const vy = ey - sy;
    const len = Math.hypot(vx, vy) || 1;

    star.sx = sx;
    star.sy = sy;
    star.dx = vx / len;
    star.dy = vy / len;
    star.dist = len;
    star.angle = Math.atan2(star.dy, star.dx);

    star.delay = index * 0.13 + Math.random() * 0.35;
    star.duration = 1.05 + Math.random() * 0.4;
    star.length = (22 + Math.random() * 14) * scale;
    star.thickness = (0.85 + Math.random() * 0.7) * scale;

    star.mesh.rotation.z = star.angle;
    star.mesh.visible = false;
}

export function triggerShootingStars(time) {
    if (!group) return;

    // Shuffle which streak gets which colour
    for (let i = colorOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = colorOrder[i];
        colorOrder[i] = colorOrder[j];
        colorOrder[j] = tmp;
    }

    for (let i = 0; i < STAR_COUNT; i++) {
        const star = stars[i];
        star.material.uniforms.uColor.value.setHex(COLORS[colorOrder[i]]);
        star.material.uniforms.uFade.value = 0;
        rollStar(star, i);
    }

    startTime = time;
    active = true;
    group.visible = true;
}

export function updateShootingStars(time, cameraPos) {
    if (!active || !group) return;

    const t = time - startTime;
    if (t >= LIFETIME) {
        resetShootingStars();
        return;
    }

    // Ride along with the camera so the streaks read as distant sky
    group.position.copy(cameraPos);

    for (let i = 0; i < STAR_COUNT; i++) {
        const star = stars[i];
        const p = (t - star.delay) / star.duration;

        if (p <= 0 || p >= 1) {
            star.mesh.visible = false;
            continue;
        }

        // Slight ease-out on the flight, so it arrives with a whoosh and settles
        const travel = 1 - Math.pow(1 - p, 1.35);

        // Stretch out of nothing, hold, then retract into the fade
        const growth = smoothstep(0, 0.25, p) * (1 - 0.55 * smoothstep(0.6, 1, p));
        const length = star.length * growth;

        const headX = star.sx + star.dx * star.dist * travel;
        const headY = star.sy + star.dy * star.dist * travel;

        star.mesh.position.set(
            headX - star.dx * length * 0.5,
            headY - star.dy * length * 0.5,
            star.depth
        );
        star.mesh.scale.set(length, star.thickness, 1);
        star.mesh.visible = true;

        star.material.uniforms.uFade.value =
            smoothstep(0, 0.1, p) * (1 - smoothstep(0.55, 1, p));
        star.material.uniforms.uTime.value = time;
    }
}

export function resetShootingStars() {
    if (!group) return;
    active = false;
    group.visible = false;
    for (const star of stars) star.mesh.visible = false;
}

export function getShootingStarMaterials() {
    return stars.map(s => s.material);
}
