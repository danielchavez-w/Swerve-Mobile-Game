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

            // HSV to RGB
            vec3 hsv2rgb(vec3 c) {
                vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
                return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
            }

            // Hexagonal distance field
            // Returns: xy = hex center, z = edge distance
            vec4 hexCoord(vec2 p) {
                const vec2 s = vec2(1.7320508, 1.0); // sqrt(3), 1
                // Scale for hex size
                p *= 0.6;

                vec4 hC = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
                vec4 h = vec4(p - hC.xy * s, p - (hC.zw + 0.5) * s);

                // Pick closest hex center
                vec2 nearest = (dot(h.xy, h.xy) < dot(h.zw, h.zw)) ? vec2(h.xy) : vec2(h.zw);
                vec2 center = (dot(h.xy, h.xy) < dot(h.zw, h.zw)) ? hC.xy : hC.zw + 0.5;

                // Hex edge distance (pointy-top)
                vec2 ab = abs(nearest);
                float edgeDist = max(ab.x * 0.866025 + ab.y * 0.5, ab.y);

                return vec4(center, edgeDist, 0.0);
            }

            void main() {
                vec4 hex = hexCoord(vWorldXZ);
                vec2 center = hex.xy;
                float edgeDist = hex.z;

                float hexRadius = 0.5;

                // Edge glow — sharp bright edge with falloff
                float edge = smoothstep(hexRadius, hexRadius - 0.06, edgeDist)
                           - smoothstep(hexRadius - 0.06, hexRadius - 0.18, edgeDist);

                // Inner glow — subtle fill near edges
                float innerGlow = smoothstep(hexRadius, hexRadius - 0.25, edgeDist) * 0.15;

                // Color: rainbow based on position + time, each hex gets unique hue
                float hue = fract(center.x * 0.08 + center.y * 0.06 + uTime * 0.08);
                vec3 color = hsv2rgb(vec3(hue, 0.9, 1.0));

                // Pulse: each hex breathes independently
                float pulse = sin(uTime * 1.5 + center.x * 1.2 + center.y * 0.9) * 0.5 + 0.5;
                float brightness = 0.4 + pulse * 0.6;

                // Combine edge + inner glow
                float intensity = edge * brightness + innerGlow * brightness * 0.5;

                // Distance fade from plane center (camera)
                float dist = length(vLocalXZ) * 0.005;
                float fade = 1.0 - smoothstep(0.0, 1.0, dist);

                vec3 finalColor = color * intensity;
                float alpha = intensity * fade;

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
