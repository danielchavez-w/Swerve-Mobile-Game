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
const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xff2244, emissive: 0xff0022, emissiveIntensity: 0.5,
    roughness: 0.5, metalness: 0.3
});
const armMaterial = new THREE.MeshStandardMaterial({
    color: 0xff8800, emissive: 0xff4400, emissiveIntensity: 0.5,
    roughness: 0.4, metalness: 0.4
});
const blockMaterial = new THREE.MeshStandardMaterial({
    color: 0xaa00ff, emissive: 0x6600aa, emissiveIntensity: 0.5,
    roughness: 0.4, metalness: 0.3
});
const barMaterial = new THREE.MeshStandardMaterial({
    color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.5,
    roughness: 0.4, metalness: 0.4
});

// Shared geometries — avoids creating new geometry per obstacle
const blockGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
const pillarGeo8 = new THREE.CylinderGeometry(0.12, 0.12, 1, 12);
const pillarGeo10 = new THREE.CylinderGeometry(0.1, 0.1, 1, 12);

// ── Static wall ──
function createStaticWall(scene, world, zPos, trackWidth, trackY) {
    const wallWidth = trackWidth * 0.35 + Math.random() * trackWidth * 0.2;
    const wallHeight = 1.8;
    const wallDepth = 0.6;
    const xOffset = (Math.random() - 0.5) * (trackWidth - wallWidth) * 0.5;

    const geo = new THREE.BoxGeometry(wallWidth, wallHeight, wallDepth);
    const mesh = new THREE.Mesh(geo, wallMaterial);
    mesh.position.set(xOffset, trackY + wallHeight / 2, zPos);
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

    const pillar = new THREE.Mesh(pillarGeo8, armMaterial);
    const pillarH = armY - trackY + 1.5;
    pillar.scale.y = pillarH;
    pillar.position.set(0, trackY + pillarH / 2, 0);
    group.add(pillar);

    const armGeo = new THREE.BoxGeometry(armLength, armHeight, armDepth);
    const arm = new THREE.Mesh(armGeo, armMaterial);
    arm.position.set(0, armY, 0);
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

    const mesh = new THREE.Mesh(blockGeo, blockMaterial);
    mesh.position.set(0, trackY + blockSize / 2, zPos);
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

    const sectionWidth = (trackWidth - gapWidth) / 2;

    const group = new THREE.Group();
    group.position.set(0, 0, zPos);

    const leftGeo = new THREE.BoxGeometry(sectionWidth, barHeight, barDepth);
    const leftBar = new THREE.Mesh(leftGeo, barMaterial);
    leftBar.position.set(-(gapWidth / 2 + sectionWidth / 2), barY, 0);
    group.add(leftBar);

    const rightGeo = new THREE.BoxGeometry(sectionWidth, barHeight, barDepth);
    const rightBar = new THREE.Mesh(rightGeo, barMaterial);
    rightBar.position.set(gapWidth / 2 + sectionWidth / 2, barY, 0);
    group.add(rightBar);

    const pillarH = barY - trackY + barHeight;
    [-trackWidth / 2, trackWidth / 2].forEach(px => {
        const p = new THREE.Mesh(pillarGeo10, barMaterial);
        p.scale.y = pillarH;
        p.position.set(px, trackY + pillarH / 2, 0);
        group.add(p);
    });

    scene.add(group);

    const bodies = [];

    const leftShape = new CANNON.Box(new CANNON.Vec3(sectionWidth / 2, barHeight / 2, barDepth / 2));
    const leftBody = new CANNON.Body({
        mass: 0, shape: leftShape,
        collisionFilterGroup: GROUPS.OBSTACLE,
        collisionFilterMask: GROUPS.MARBLE
    });
    leftBody.position.set(-(gapWidth / 2 + sectionWidth / 2), barY, zPos);
    world.addBody(leftBody);
    bodies.push(leftBody);

    const rightShape = new CANNON.Box(new CANNON.Vec3(sectionWidth / 2, barHeight / 2, barDepth / 2));
    const rightBody = new CANNON.Body({
        mass: 0, shape: rightShape,
        collisionFilterGroup: GROUPS.OBSTACLE,
        collisionFilterMask: GROUPS.MARBLE
    });
    rightBody.position.set(gapWidth / 2 + sectionWidth / 2, barY, zPos);
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

export function removeOldObstacles(scene, world, marbleZ) {
    const removeThreshold = marbleZ + 60;

    for (let i = obstacles.length - 1; i >= 0; i--) {
        if (obstacles[i].zPos > removeThreshold) {
            const obs = obstacles[i];
            scene.remove(obs.mesh);
            // Dispose non-shared geometries only
            if (obs.mesh.traverse) {
                obs.mesh.traverse(child => {
                    if (child.geometry && child.geometry !== blockGeo &&
                        child.geometry !== pillarGeo8 && child.geometry !== pillarGeo10) {
                        child.geometry.dispose();
                    }
                });
            } else if (obs.mesh.geometry && obs.mesh.geometry !== blockGeo) {
                obs.mesh.geometry.dispose();
            }
            world.removeBody(obs.body);
            if (obs.extraBodies) obs.extraBodies.forEach(b => world.removeBody(b));
            obstacles.splice(i, 1);
        }
    }
}

export function getObstacles() { return obstacles; }

export function resetObstacles(scene, world) {
    for (const obs of obstacles) {
        scene.remove(obs.mesh);
        if (obs.mesh.traverse) {
            obs.mesh.traverse(child => {
                if (child.geometry && child.geometry !== blockGeo &&
                    child.geometry !== pillarGeo8 && child.geometry !== pillarGeo10) {
                    child.geometry.dispose();
                }
            });
        } else if (obs.mesh.geometry && obs.mesh.geometry !== blockGeo) {
            obs.mesh.geometry.dispose();
        }
        world.removeBody(obs.body);
        if (obs.extraBodies) obs.extraBodies.forEach(b => world.removeBody(b));
    }
    obstacles.length = 0;
}
