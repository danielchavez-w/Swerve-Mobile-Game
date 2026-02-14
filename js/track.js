import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GROUPS } from './physics.js';

// ── Dimensions ──
const SEGMENT_LENGTH = 24;
const OVERLAP = 12;
const SEG_GEOM_LEN = SEGMENT_LENGTH + OVERLAP;     // 36 units of geometry
const HALF_SEG = SEG_GEOM_LEN / 2;                 // 18
const STANDARD_WIDTH = 9;
const RAIL_HEIGHT = 0.8;
const RAIL_RADIUS = 0.25;
const TRACK_THICKNESS = 3;          // Physics only — keeps ball from tunneling

// ── Slope ──
const START_Y = 10;
const SLOPE_STEP = 0.08;
const NUM_SLOPE_SEGS = 80;

// ── Ramp ──
const RAMP_ANGLE = 0.25;                            // Radians upward
const RAMP_RISE = HALF_SEG * Math.sin(RAMP_ANGLE);  // Height gained from entry to center

// ── State ──
const segments = [];
let nextZ = 0;
let currentY = START_Y;
let segmentIndex = 0;
let totalGenerated = 0;

// ── Materials ──
const trackMat3D = new THREE.MeshStandardMaterial({
    color: 0x0a1628, roughness: 0.5, metalness: 0.4,
    emissive: 0x061020, emissiveIntensity: 0.4,
    side: THREE.FrontSide
});
const rampMat3D = new THREE.MeshStandardMaterial({
    color: 0x081420, roughness: 0.35, metalness: 0.5,
    emissive: 0x003322, emissiveIntensity: 0.6,
    side: THREE.FrontSide
});


export function initTrack() {}

// ── Build a flat horizontal segment ──
function buildFlat(scene, world, phyMat, zPos, yPos) {
    const width = STANDARD_WIDTH;
    const group = new THREE.Group();

    // Flat plane — top face only, no sides, no bottom
    const geo = new THREE.PlaneGeometry(width, SEG_GEOM_LEN);
    const surface = new THREE.Mesh(geo, trackMat3D);
    surface.rotation.x = -Math.PI / 2;   // lay flat
    group.add(surface);

    group.position.set(0, yPos, zPos);
    scene.add(group);

    const bodies = makePhysicsFlat(world, phyMat, 0, yPos, zPos, width / 2);

    return {
        group, bodies, type: 'flat', zPos, width,
        endY: yPos, endX: 0, materials: []
    };
}

// ── Build a ramp — near edge matches current floor, slopes UP to peak ──
function buildRamp(scene, world, phyMat, zPos, yPos) {
    const width = STANDARD_WIDTH;
    const angle = -RAMP_ANGLE;          // Negative = tilts front UP in Three.js

    // Position so the NEAR EDGE (where ball enters) is at yPos
    // Near edge is at local z=+HALF_SEG, which tilts DOWN by sin(angle)*HALF_SEG
    // So: midY - HALF_SEG * sin(RAMP_ANGLE) = yPos
    // midY = yPos + HALF_SEG * sin(RAMP_ANGLE) = yPos + RAMP_RISE
    const midY = yPos + RAMP_RISE;
    const endY = yPos + 2 * RAMP_RISE;  // Peak at far edge
    const group = new THREE.Group();

    // Flat plane — top face only, no sides, no bottom
    const geo = new THREE.PlaneGeometry(width, SEG_GEOM_LEN);
    const surface = new THREE.Mesh(geo, rampMat3D);
    surface.rotation.x = -Math.PI / 2;   // lay flat
    group.add(surface);

    // Arrow markers on ramp
    for (let i = 0; i < 3; i++) {
        const ag = new THREE.PlaneGeometry(1.5, 0.3);
        const am = new THREE.MeshBasicMaterial({
            color: 0x44ff88, transparent: true, opacity: 0.4 - i * 0.1, side: THREE.DoubleSide
        });
        const a = new THREE.Mesh(ag, am);
        a.position.set(0, 0.03, -3 + i * 3);
        a.rotation.x = -Math.PI / 2;
        group.add(a);
    }

    group.position.set(0, midY, zPos);
    group.rotation.x = angle;
    scene.add(group);

    // Physics body — angled to match ramp
    const half = new CANNON.Vec3(width / 2, TRACK_THICKNESS / 2, HALF_SEG);
    const body = new CANNON.Body({
        mass: 0, shape: new CANNON.Box(half), material: phyMat,
        collisionFilterGroup: GROUPS.TRACK, collisionFilterMask: GROUPS.MARBLE
    });
    body.position.set(0, midY - TRACK_THICKNESS / 2, zPos);
    body.quaternion.setFromEuler(angle, 0, 0);
    world.addBody(body);

    // Rail physics
    const railHalf = new CANNON.Vec3(RAIL_RADIUS * 2, RAIL_HEIGHT, HALF_SEG);
    const lb = new CANNON.Body({
        mass: 0, shape: new CANNON.Box(railHalf),
        collisionFilterGroup: GROUPS.RAIL, collisionFilterMask: GROUPS.MARBLE
    });
    lb.position.set(-width / 2, midY + RAIL_HEIGHT / 2, zPos);
    lb.quaternion.setFromEuler(angle, 0, 0);
    world.addBody(lb);

    const rb = new CANNON.Body({
        mass: 0, shape: new CANNON.Box(railHalf),
        collisionFilterGroup: GROUPS.RAIL, collisionFilterMask: GROUPS.MARBLE
    });
    rb.position.set(width / 2, midY + RAIL_HEIGHT / 2, zPos);
    rb.quaternion.setFromEuler(angle, 0, 0);
    world.addBody(rb);

    return {
        group, bodies: [body, lb, rb], type: 'ramp_up', zPos, width,
        endY, endX: 0, isRamp: true, materials: []
    };
}

// ── Physics helpers ──
function makePhysicsFlat(world, phyMat, x, y, z, halfW) {
    const half = new CANNON.Vec3(halfW, TRACK_THICKNESS / 2, HALF_SEG);
    const body = new CANNON.Body({
        mass: 0, shape: new CANNON.Box(half), material: phyMat,
        collisionFilterGroup: GROUPS.TRACK, collisionFilterMask: GROUPS.MARBLE
    });
    body.position.set(x, y - TRACK_THICKNESS / 2, z);
    world.addBody(body);

    const railHalf = new CANNON.Vec3(RAIL_RADIUS * 2, RAIL_HEIGHT, HALF_SEG);
    const lb = new CANNON.Body({
        mass: 0, shape: new CANNON.Box(railHalf),
        collisionFilterGroup: GROUPS.RAIL, collisionFilterMask: GROUPS.MARBLE
    });
    lb.position.set(x - halfW, y + RAIL_HEIGHT / 2, z);
    world.addBody(lb);

    const rb = new CANNON.Body({
        mass: 0, shape: new CANNON.Box(railHalf),
        collisionFilterGroup: GROUPS.RAIL, collisionFilterMask: GROUPS.MARBLE
    });
    rb.position.set(x + halfW, y + RAIL_HEIGHT / 2, z);
    world.addBody(rb);

    return [body, lb, rb];
}

// ── Main segment generation ──
export function generateSegment(scene, world, trackMaterial, difficultyLevel) {
    // Gradually lower Y during slope phase
    if (totalGenerated < NUM_SLOPE_SEGS) {
        currentY -= SLOPE_STEP;
    } else if (currentY > 0.3) {
        currentY -= 0.03;
    }
    if (currentY < 0) currentY = 0;

    const segment = buildFlat(scene, world, trackMaterial, nextZ, currentY);

    segments.push(segment);
    nextZ -= SEGMENT_LENGTH;
    segmentIndex++;
    totalGenerated++;

    return segment;
}

function chooseType(level) {
    // First 10 segments: pure flat
    if (totalGenerated < 10) return 'flat';

    const rand = Math.random();

    if (totalGenerated < NUM_SLOPE_SEGS) {
        if (rand < 0.88) return 'flat';
        return 'ramp_up';
    }

    if (level <= 1) {
        if (rand < 0.80) return 'flat';
        return 'ramp_up';
    } else if (level <= 2) {
        if (rand < 0.72) return 'flat';
        return 'ramp_up';
    } else {
        if (rand < 0.65) return 'flat';
        return 'ramp_up';
    }
}

// ── Cleanup ──
function disposeGroup(group) {
    group.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
            else child.material.dispose();
        }
    });
}

export function removeOldSegments(scene, world, marbleZ) {
    const threshold = marbleZ + SEGMENT_LENGTH * 3;
    let removed = false;
    while (segments.length > 0 && segments[0].zPos > threshold) {
        const seg = segments.shift();
        scene.remove(seg.group);
        disposeGroup(seg.group);
        seg.bodies.forEach(b => world.removeBody(b));
        removed = true;
    }
}

export function getSegments() { return segments; }
export function getSegmentLength() { return SEGMENT_LENGTH; }
export function getCurrentTrackY() { return currentY; }

export function resetTrack(scene, world) {
    for (const seg of segments) {
        if (scene) scene.remove(seg.group);
        disposeGroup(seg.group);
        if (world) seg.bodies.forEach(b => world.removeBody(b));
    }
    segments.length = 0;
    nextZ = 0;
    currentY = START_Y;
    segmentIndex = 0;
    totalGenerated = 0;
}

export function getLastSegmentZ() {
    if (segments.length === 0) return 0;
    return segments[segments.length - 1].zPos;
}
