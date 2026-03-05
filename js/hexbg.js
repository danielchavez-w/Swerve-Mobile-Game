import * as THREE from 'three';

let hexMesh;
let hexMaterial;

export function createHexBackground(scene) {
    hexMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 }
        },
        vertexShader: `
            varying vec2 vWorldXZ;
            varying vec2 vLocalXZ;
            void main() {
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldXZ = worldPos.xz;
                vLocalXZ = position.xz;
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            varying vec2 vWorldXZ;
            varying vec2 vLocalXZ;

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }

            // Hexagonal distance field
            vec4 hexCoord(vec2 p) {
                const vec2 s = vec2(1.7320508, 1.0);
                p *= 0.25;

                vec4 hC = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
                vec4 h = vec4(p - hC.xy * s, p - (hC.zw + 0.5) * s);

                vec2 nearest = (dot(h.xy, h.xy) < dot(h.zw, h.zw)) ? vec2(h.xy) : vec2(h.zw);
                vec2 center = (dot(h.xy, h.xy) < dot(h.zw, h.zw)) ? hC.xy : hC.zw + 0.5;

                vec2 ab = abs(nearest);
                float edgeDist = max(ab.x * 0.866025 + ab.y * 0.5, ab.y);

                return vec4(center, edgeDist, 0.0);
            }

            void main() {
                // Bobbing per hex
                vec4 hexPre = hexCoord(vWorldXZ);
                vec2 preCenter = hexPre.xy;
                float bobPhase = hash(preCenter) * 6.2832;
                float bobSpeed = 0.4 + hash(preCenter + 1.0) * 0.6;
                float bobAmount = 1.5 + hash(preCenter + 2.0) * 2.0;
                float bob = sin(uTime * bobSpeed + bobPhase) * bobAmount;
                vec2 shiftedXZ = vWorldXZ + vec2(0.0, bob);

                vec4 hex = hexCoord(shiftedXZ);
                vec2 center = hex.xy;
                float edgeDist = hex.z;

                float hexRadius = 0.5;

                // Thin neon edge line (Tron style)
                float edgeLine = smoothstep(hexRadius, hexRadius - 0.02, edgeDist)
                               - smoothstep(hexRadius - 0.02, hexRadius - 0.06, edgeDist);

                // Soft glow around edges
                float edgeGlow = smoothstep(hexRadius + 0.05, hexRadius - 0.15, edgeDist)
                               * smoothstep(hexRadius - 0.35, hexRadius - 0.10, edgeDist);

                // Vertex glow — bright spots at hex corners
                // Distance from nearest vertex approximation using edge proximity
                float cornerGlow = pow(edgeLine, 0.5) * smoothstep(hexRadius - 0.01, hexRadius - 0.04, edgeDist);

                // Hot pink: vec3(1.0, 0.08, 0.58)  Electric blue: vec3(0.0, 0.8, 1.0)
                vec3 hotPink = vec3(1.0, 0.08, 0.58);
                vec3 electricBlue = vec3(0.0, 0.8, 1.0);

                // Each hex picks a color blend — some lean pink, some lean blue
                float colorMix = hash(center * 2.73);
                // Slowly shift over time
                colorMix = fract(colorMix + uTime * 0.04);
                // Push toward extremes so most hexes are clearly pink or blue
                colorMix = smoothstep(0.3, 0.7, colorMix);
                vec3 neonColor = mix(hotPink, electricBlue, colorMix);

                // Pulse per hex
                float pulse = sin(uTime * 1.2 + hash(center) * 6.28) * 0.5 + 0.5;
                float brightness = 0.5 + pulse * 0.5;

                // Compose: bright edge line + softer glow halo
                float lineIntensity = edgeLine * 1.5 * brightness;
                float glowIntensity = edgeGlow * 0.4 * brightness;

                // Dark interior with subtle color tint
                float interiorDim = smoothstep(hexRadius, hexRadius - 0.35, edgeDist) * 0.06 * brightness;

                float totalIntensity = lineIntensity + glowIntensity + interiorDim;

                // Distance fade
                float dist = length(vLocalXZ) * 0.005;
                float fade = 1.0 - smoothstep(0.0, 1.0, dist);

                vec3 finalColor = neonColor * totalIntensity;
                float alpha = totalIntensity * fade;

                gl_FragColor = vec4(finalColor, alpha);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const geo = new THREE.PlaneGeometry(300, 300);
    hexMesh = new THREE.Mesh(geo, hexMaterial);
    hexMesh.rotation.x = -Math.PI / 2; // Lay flat
    hexMesh.position.y = -3;
    hexMesh.renderOrder = -1;
    scene.add(hexMesh);
}

export function updateHexBackground(time, cameraPos) {
    if (!hexMesh || !cameraPos) return;
    hexMesh.position.x = cameraPos.x;
    hexMesh.position.z = cameraPos.z;
    hexMaterial.uniforms.uTime.value = time;
}

export function getHexMaterial() {
    return hexMaterial;
}
