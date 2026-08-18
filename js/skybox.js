import * as THREE from 'three';

let skyGroup;       // All sky elements in one group — follows the camera
let stars;
let starMaterial;
let rendererRef = null;
let nebulaLayers = [];      // { material, from1, from2, to1, to2 }
const _bufferSize = new THREE.Vector2();

// Nebula palette transition state
let transitionStart = -1;
const TRANSITION_TIME = 2.8;

// Sky elements must sit inside the camera's far plane (200) or they are clipped
// and never drawn. Stars top out at 155 units away.
const STAR_COUNT = 1200;
const STAR_R_MIN = 110;
const STAR_R_MAX = 155;

// Stars are placed by elevation angle rather than uniformly on a sphere. The
// camera pitches down ~12.7° with a 65° vertical FOV, so the only sky on screen
// runs from the horizon up to ~19.8° — the top third of the display. Scattering
// uniformly over a sphere buried three quarters of the field near the zenith,
// above the top of the frame, leaving the visible sky looking empty.
// The floor stays clear of the horizon: the camera rides between 5.6 and 15
// units up while this band is anchored at 10, so the lowest star still sits
// ~1.9° above the horizon at the start of a run and never crosses the ground.
const ELEV_MIN = 4.5 * Math.PI / 180;
const ELEV_MAX = 26 * Math.PI / 180;
const ELEV_ANCHOR_Y = 10;

// ── Nebula palettes per level ──
// The ribbons shift colour as the run progresses, so the sky reads differently
// at Nightmare than it does at Easy.
const NEBULA_LEVELS = {
    1: [[0x00ff88, 0x00ddff], [0x00ffcc, 0xaa00ff], [0x44aaff, 0xff44cc]],
    2: [[0x00ffcc, 0x0088ff], [0x44ffaa, 0x00ccff], [0x00ddff, 0x66ffdd]],
    3: [[0xffcc00, 0xff6600], [0xffaa00, 0xff3388], [0xffdd44, 0xff8800]],
    4: [[0xaa44ff, 0xff00cc], [0xcc66ff, 0xff44aa], [0x8844ff, 0xff66dd]],
    5: [[0xff3366, 0xff8844], [0xff0055, 0xffaa66], [0xff5577, 0xffcc88]],
    6: [[0x3366ff, 0x00ccff], [0x0044ff, 0x66aaff], [0x2288ff, 0x00ffee]],
    7: [[0xff00aa, 0x00e5ff], [0xffffff, 0xff2d95], [0xaa00ff, 0x00ffcc]]
};

export function createSkybox(scene, renderer) {
    skyGroup = new THREE.Group();
    rendererRef = renderer;

    // Flat night backdrop — no dome geometry, the nebulae carry the sky
    scene.background = new THREE.Color(0x020818);

    createStars();
    createNebulae();

    setSkyLevel(1, true);

    scene.add(skyGroup);
}

// ── Star field ──
// Three tiers, like a real night sky: a few bright pulsating stars that carry
// the eye, a middle layer, and a dense dim scatter. Sizes, phases and colours
// are baked into buffer attributes and animated entirely in the vertex shader —
// the old version updated a size attribute from JS every third frame, which
// PointsMaterial silently ignored.
function createStars() {
    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const phases = new Float32Array(STAR_COUNT);
    const speeds = new Float32Array(STAR_COUNT);
    const brights = new Float32Array(STAR_COUNT);
    const colors = new Float32Array(STAR_COUNT * 3);

    // Tints for the bright tier — icy blue through warm gold with a hint of rose
    const brightTints = [
        [1.00, 0.98, 0.92], [0.72, 0.86, 1.00], [1.00, 0.90, 0.72],
        [0.88, 0.94, 1.00], [1.00, 0.82, 0.88], [0.80, 1.00, 0.96]
    ];

    for (let i = 0; i < STAR_COUNT; i++) {
        const azimuth = Math.random() * Math.PI * 2;
        const elevation = ELEV_MIN + Math.random() * (ELEV_MAX - ELEV_MIN);
        const r = STAR_R_MIN + Math.random() * (STAR_R_MAX - STAR_R_MIN);
        const horiz = r * Math.cos(elevation);

        positions[i * 3] = horiz * Math.cos(azimuth);
        positions[i * 3 + 1] = ELEV_ANCHOR_Y + r * Math.sin(elevation);
        positions[i * 3 + 2] = horiz * Math.sin(azimuth);

        phases[i] = Math.random() * Math.PI * 2;

        const tier = Math.random();
        let bright;

        if (tier > 0.88) {
            // Hero stars — big, strongly pulsating, tinted
            bright = 0.75 + Math.random() * 0.25;
            sizes[i] = 1.2 + Math.random() * 0.7;
            speeds[i] = 0.8 + Math.random() * 1.5;
            const tint = brightTints[Math.floor(Math.random() * brightTints.length)];
            colors[i * 3] = tint[0];
            colors[i * 3 + 1] = tint[1];
            colors[i * 3 + 2] = tint[2];
        } else if (tier > 0.55) {
            // Middle layer — clearly visible, gentle twinkle
            bright = 0.35 + Math.random() * 0.25;
            sizes[i] = 0.8 + Math.random() * 0.5;
            speeds[i] = 0.6 + Math.random() * 1.0;
            const v = 0.80 + Math.random() * 0.14;
            colors[i * 3] = v * 0.90;
            colors[i * 3 + 1] = v * 0.95;
            colors[i * 3 + 2] = v;
        } else {
            // Dim scatter — present and readable, but it recedes
            bright = 0.05 + Math.random() * 0.2;
            sizes[i] = 0.40 + Math.random() * 0.30;
            speeds[i] = 0.4 + Math.random() * 0.7;
            const v = 0.62 + Math.random() * 0.16;
            colors[i * 3] = v * 0.82;
            colors[i * 3 + 1] = v * 0.90;
            colors[i * 3 + 2] = v;
        }

        brights[i] = bright;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aBright', new THREE.BufferAttribute(brights, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    starMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            // Half the drawing buffer height, so points keep a consistent
            // on-screen size across viewport sizes and device pixel ratios
            uScale: { value: 400 }
        },
        vertexShader: `
            attribute float aSize;
            attribute float aPhase;
            attribute float aSpeed;
            attribute float aBright;
            attribute vec3 aColor;
            uniform float uTime;
            uniform float uScale;
            varying float vAlpha;
            varying float vBright;
            varying vec3 vColor;

            void main() {
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                float pulse = sin(uTime * aSpeed + aPhase) * 0.5 + 0.5;

                // Hero stars swell and throb; the dim scatter only shimmers
                float twinkle = 1.0 + (pulse - 0.5) * mix(0.18, 1.1, aBright);
                gl_PointSize = max(aSize * twinkle * (uScale / -mv.z), 1.0);

                vAlpha = mix(0.42, 1.0, aBright) *
                         (1.0 + (pulse - 0.5) * mix(0.2, 0.75, aBright));
                vBright = aBright;
                vColor = aColor;
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: `
            varying float vAlpha;
            varying float vBright;
            varying vec3 vColor;

            void main() {
                vec2 c = gl_PointCoord - 0.5;
                float d = length(c);
                if (d > 0.5) discard;

                // Round soft point instead of the default square
                float core = pow(1.0 - smoothstep(0.0, 0.5, d), 1.8);
                // Bright stars carry an extra halo
                float glow = (1.0 - smoothstep(0.0, 0.5, d)) * 0.4 * vBright;
                float i = (core + glow) * vAlpha;

                gl_FragColor = vec4(vColor * i, i);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    stars = new THREE.Points(geo, starMaterial);
    skyGroup.add(stars);

    updateStarScale();
    window.addEventListener('resize', updateStarScale);
}

// gl_PointSize is in device pixels, so it has to track the drawing buffer or
// stars come out tiny on one device and bloated on another.
function updateStarScale() {
    if (!starMaterial || !rendererRef) return;
    rendererRef.getDrawingBufferSize(_bufferSize);
    starMaterial.uniforms.uScale.value = _bufferSize.height * 0.5;
}

function createNebulae() {
    const configs = [
        { y: 55, z: -120, width: 140 },
        { y: 65, z: -140, width: 120 },
        { y: 48, z: -100, width: 100 }
    ];

    for (let i = 0; i < configs.length; i++) {
        const cfg = configs[i];
        const height = 25 + Math.random() * 15;
        const geo = new THREE.PlaneGeometry(cfg.width, height, 20, 5);

        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor1: { value: new THREE.Color(0x00ff88) },
                uColor2: { value: new THREE.Color(0x00ddff) },
                uSpeed: { value: 0.25 + Math.random() * 0.2 },
                uAmplitude: { value: 3 + Math.random() * 3 }
            },
            vertexShader: `
                uniform float uTime;
                uniform float uSpeed;
                uniform float uAmplitude;
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vec3 pos = position;
                    float wave = sin(pos.x * 0.04 + uTime * uSpeed) * uAmplitude;
                    wave += cos(pos.x * 0.07 + uTime * uSpeed * 0.6) * uAmplitude * 0.5;
                    pos.z += wave;
                    pos.y += sin(pos.x * 0.025 + uTime * uSpeed * 0.4) * uAmplitude * 0.3;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor1;
                uniform vec3 uColor2;
                uniform float uTime;
                uniform float uSpeed;
                varying vec2 vUv;
                void main() {
                    float gradient = smoothstep(0.0, 1.0, vUv.y);
                    float mixFactor = sin(vUv.x * 3.0 + uTime * uSpeed) * 0.5 + 0.5;
                    vec3 color = mix(uColor1, uColor2, mixFactor);
                    float edgeFade = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
                    float topFade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
                    float alpha = gradient * edgeFade * topFade * 0.3;
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true, side: THREE.DoubleSide,
            depthWrite: false, blending: THREE.AdditiveBlending
        });

        const plane = new THREE.Mesh(geo, mat);
        const angle = (i / 3) * Math.PI * 0.5 - 0.25;
        plane.position.set(Math.sin(angle) * 130, cfg.y, cfg.z - i * 20);
        plane.rotation.y = angle * 0.3;

        skyGroup.add(plane);
        nebulaLayers.push({
            material: mat,
            from1: new THREE.Color(), from2: new THREE.Color(),
            to1: new THREE.Color(), to2: new THREE.Color()
        });
    }
}

// Start a transition of the nebulae toward a level's palette.
// `immediate` snaps instead of blending — used on reset.
export function setSkyLevel(level, immediate = false) {
    const palette = NEBULA_LEVELS[level] || NEBULA_LEVELS[1];

    for (let i = 0; i < nebulaLayers.length; i++) {
        const layer = nebulaLayers[i];
        const pair = palette[i % palette.length];
        layer.from1.copy(layer.material.uniforms.uColor1.value);
        layer.from2.copy(layer.material.uniforms.uColor2.value);
        layer.to1.setHex(pair[0]);
        layer.to2.setHex(pair[1]);

        if (immediate) {
            layer.material.uniforms.uColor1.value.copy(layer.to1);
            layer.material.uniforms.uColor2.value.copy(layer.to2);
        }
    }

    // Picked up on the next update, which knows the clock
    transitionStart = immediate ? -1 : -2;
}

export function updateSkybox(time, cameraPos) {
    // Move entire sky to follow camera — sky stays in background forever
    if (skyGroup && cameraPos) {
        skyGroup.position.x = cameraPos.x;
        skyGroup.position.z = cameraPos.z;
    }

    // Kick off a pending transition now that we have a timestamp
    if (transitionStart === -2) transitionStart = time;

    if (transitionStart >= 0) {
        const p = Math.min((time - transitionStart) / TRANSITION_TIME, 1);
        const e = p * p * (3 - 2 * p);

        for (const layer of nebulaLayers) {
            layer.material.uniforms.uColor1.value.lerpColors(layer.from1, layer.to1, e);
            layer.material.uniforms.uColor2.value.lerpColors(layer.from2, layer.to2, e);
        }

        if (p >= 1) transitionStart = -1;
    }

    // Animate shaders — twinkle is handled on the GPU from this one uniform
    if (starMaterial) starMaterial.uniforms.uTime.value = time;
    for (const layer of nebulaLayers) {
        layer.material.uniforms.uTime.value = time;
    }
}
