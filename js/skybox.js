import * as THREE from 'three';

let skyGroup;       // All sky elements in one group — follows the camera
let stars;
let auroraEntries = [];
let starUpdateCounter = 0;

export function createSkybox(scene) {
    skyGroup = new THREE.Group();

    scene.background = new THREE.Color(0x020818);

    // Gradient dome — reduced segments for mobile perf
    const domeGeo = new THREE.SphereGeometry(250, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
            varying vec3 vLocalPos;
            void main() {
                vLocalPos = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float uTime;
            varying vec3 vLocalPos;
            void main() {
                float height = normalize(vLocalPos).y;
                vec3 zenith = vec3(0.01, 0.02, 0.06);
                vec3 midSky = vec3(0.0, 0.05, 0.12);
                vec3 horizon = vec3(0.0, 0.35, 0.25);
                float pulse = sin(uTime * 0.3) * 0.05 + 0.05;
                horizon += vec3(0.0, pulse, pulse * 0.5);
                vec3 color;
                if (height > 0.3) {
                    color = mix(midSky, zenith, smoothstep(0.3, 0.8, height));
                } else {
                    color = mix(horizon, midSky, smoothstep(0.0, 0.3, height));
                }
                gl_FragColor = vec4(color, 1.0);
            }
        `,
        side: THREE.BackSide,
        depthWrite: false
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = -5;
    skyGroup.add(dome);
    auroraEntries.push({ material: domeMat });

    // Stars — reduced count for mobile perf
    const starCount = 200;
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    const starBaseSize = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 180 + Math.random() * 60;
        starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        starPositions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 20;
        starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        const s = 0.5 + Math.random() * 1.5;
        starSizes[i] = s;
        starBaseSize[i] = s;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
    starGeo.userData = { baseSizes: starBaseSize };

    const starMat = new THREE.PointsMaterial({
        color: 0xffffff, size: 1.0, sizeAttenuation: true,
        transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false
    });

    stars = new THREE.Points(starGeo, starMat);
    skyGroup.add(stars);

    // Aurora
    createAurora();

    scene.add(skyGroup);
}

function createAurora() {
    const configs = [
        { colors: [0x00ff88, 0x00ddff], y: 55, z: -120, width: 140 },
        { colors: [0x00ffcc, 0xaa00ff], y: 65, z: -140, width: 120 },
        { colors: [0x44aaff, 0xff44cc], y: 48, z: -100, width: 100 }
    ];

    for (let i = 0; i < configs.length; i++) {
        const cfg = configs[i];
        const height = 25 + Math.random() * 15;
        const geo = new THREE.PlaneGeometry(cfg.width, height, 20, 5);

        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor1: { value: new THREE.Color(cfg.colors[0]) },
                uColor2: { value: new THREE.Color(cfg.colors[1]) },
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
        auroraEntries.push({ material: mat });
    }
}

export function updateSkybox(time, cameraPos) {
    // Move entire sky to follow camera — sky stays in background forever
    if (skyGroup && cameraPos) {
        skyGroup.position.x = cameraPos.x;
        skyGroup.position.z = cameraPos.z;
    }

    // Twinkle stars — only update every 3rd frame to save CPU
    starUpdateCounter++;
    if (stars && starUpdateCounter % 3 === 0) {
        const sizes = stars.geometry.attributes.size;
        const baseSizes = stars.geometry.userData.baseSizes;
        for (let i = 0; i < sizes.count; i++) {
            sizes.array[i] = baseSizes[i] * (0.7 + Math.sin(time * 1.8 + i * 0.7) * 0.3);
        }
        sizes.needsUpdate = true;
    }

    // Animate shaders
    for (const entry of auroraEntries) {
        if (entry.material.uniforms && entry.material.uniforms.uTime) {
            entry.material.uniforms.uTime.value = time;
        }
    }
}
