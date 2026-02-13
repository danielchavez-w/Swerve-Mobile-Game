import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GROUPS } from './physics.js';

let marbleMesh, marbleBody;
let ghostMode = false;
let ghostTimer = 0;
const GHOST_DURATION = 3.0;
const MARBLE_RADIUS = 0.65;       // Slightly bigger for visibility

// Store original material for ghost mode toggle
let originalMaterial, ghostMaterial;

// Glow light attached to marble
let marbleGlow;

// Fake shadow
let shadowMesh;

function createMarbleTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(size * 0.4, size * 0.4, size * 0.05, size * 0.5, size * 0.5, size * 0.5);
    grad.addColorStop(0, '#ff44aa');
    grad.addColorStop(0.25, '#ff8800');
    grad.addColorStop(0.45, '#ffdd00');
    grad.addColorStop(0.6, '#00ff88');
    grad.addColorStop(0.75, '#00ccff');
    grad.addColorStop(0.9, '#8844ff');
    grad.addColorStop(1, '#ff44aa');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.globalCompositeOperation = 'overlay';
    for (let i = 0; i < 12; i++) {
        const x1 = Math.random() * size;
        const y1 = Math.random() * size;
        const x2 = x1 + (Math.random() - 0.5) * size * 0.8;
        const y2 = y1 + (Math.random() - 0.5) * size * 0.8;
        const swirlGrad = ctx.createLinearGradient(x1, y1, x2, y2);
        const colors = ['#ff00ff', '#00ffff', '#ffff00', '#ff4488', '#44ff88', '#8844ff'];
        swirlGrad.addColorStop(0, 'transparent');
        swirlGrad.addColorStop(0.3, colors[i % colors.length] + '88');
        swirlGrad.addColorStop(0.7, colors[(i + 2) % colors.length] + '66');
        swirlGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = swirlGrad;
        ctx.fillRect(0, 0, size, size);
    }

    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.strokeStyle = `hsla(${i * 45}, 100%, 70%, 0.3)`;
        ctx.lineWidth = 1 + Math.random() * 3;
        let x = Math.random() * size;
        let y = Math.random() * size;
        ctx.moveTo(x, y);
        for (let j = 0; j < 6; j++) {
            x += (Math.random() - 0.5) * 60;
            y += (Math.random() - 0.5) * 60;
            ctx.quadraticCurveTo(
                x + (Math.random() - 0.5) * 40,
                y + (Math.random() - 0.5) * 40,
                x, y
            );
        }
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

export function createMarble(scene, world, marbleMaterial) {
    const geometry = new THREE.SphereGeometry(MARBLE_RADIUS, 32, 32);
    const marbleTexture = createMarbleTexture();

    originalMaterial = new THREE.MeshPhysicalMaterial({
        map: marbleTexture,
        metalness: 0.15,
        roughness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        transparent: false,
        envMapIntensity: 1.5,
        emissive: 0x331144,
        emissiveIntensity: 0.2
    });

    ghostMaterial = new THREE.MeshPhysicalMaterial({
        map: marbleTexture,
        metalness: 0.15,
        roughness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        transparent: true,
        opacity: 0.35,
        emissive: 0x00ffff,
        emissiveIntensity: 0.7
    });

    marbleMesh = new THREE.Mesh(geometry, originalMaterial);
    marbleMesh.castShadow = false;
    marbleMesh.receiveShadow = false;
    scene.add(marbleMesh);

    marbleGlow = new THREE.PointLight(0xff66cc, 1.0, 6);
    scene.add(marbleGlow);

    const shadowGeo = new THREE.CircleGeometry(MARBLE_RADIUS * 1.2, 16);
    const shadowMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.25,
        depthWrite: false
    });
    shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    scene.add(shadowMesh);

    const shape = new CANNON.Sphere(MARBLE_RADIUS);
    marbleBody = new CANNON.Body({
        mass: 5,
        shape: shape,
        material: marbleMaterial,
        linearDamping: 0.2,
        angularDamping: 0.3,
        collisionFilterGroup: GROUPS.MARBLE,
        collisionFilterMask: GROUPS.TRACK | GROUPS.OBSTACLE | GROUPS.RAIL
    });
    marbleBody.position.set(0, 12, 0);
    world.addBody(marbleBody);

    return { mesh: marbleMesh, body: marbleBody };
}

export function updateMarble(dt) {
    if (!marbleMesh || !marbleBody) return;

    marbleMesh.position.copy(marbleBody.position);
    marbleMesh.quaternion.copy(marbleBody.quaternion);

    marbleGlow.position.copy(marbleBody.position);

    shadowMesh.position.set(marbleBody.position.x, marbleBody.position.y - MARBLE_RADIUS + 0.02, marbleBody.position.z);

    if (ghostMode) {
        ghostTimer -= dt;
        marbleGlow.color.setHex(0x00ffff);
        marbleGlow.intensity = 1.5 + Math.sin(ghostTimer * 8) * 0.8;
        if (ghostTimer <= 0) {
            endGhostMode();
        }
    } else {
        marbleGlow.color.setHex(0xff66cc);
        marbleGlow.intensity = 1.0;
    }
}

export function enterGhostMode() {
    if (ghostMode) return;
    ghostMode = true;
    ghostTimer = GHOST_DURATION;
    marbleMesh.material = ghostMaterial;
    marbleBody.collisionFilterMask = GROUPS.TRACK | GROUPS.RAIL;
}

export function endGhostMode() {
    ghostMode = false;
    ghostTimer = 0;
    marbleMesh.material = originalMaterial;
    marbleBody.collisionFilterMask = GROUPS.TRACK | GROUPS.OBSTACLE | GROUPS.RAIL;
}

export function isGhostMode() { return ghostMode; }
export function getGhostTimer() { return ghostTimer; }
export function getGhostDuration() { return GHOST_DURATION; }
export function getMarbleMesh() { return marbleMesh; }
export function getMarbleBody() { return marbleBody; }
export function getMarbleRadius() { return MARBLE_RADIUS; }

export function respawnMarble(z, y) {
    const spawnY = (y !== undefined) ? y : 3;
    // Respawn well ahead of where ball fell, centered on track
    marbleBody.position.set(0, spawnY, z - 20);
    // Keep moderate forward speed so ball doesn't stall
    marbleBody.velocity.set(0, 0, -8);
    marbleBody.angularVelocity.set(0, 0, 0);
}
