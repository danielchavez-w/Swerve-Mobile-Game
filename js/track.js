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
const SLOPE_STEP = 0.03;
const NUM_SLOPE_SEGS = 220;

// ── State ──
const segments = [];
let nextZ = 0;
let currentY = START_Y;
let totalGenerated = 0;

// ── Shared geometry + material ──
// Every segment is identical, so one geometry and one material serve them all.
// Neither is ever disposed: recycling them avoids a GPU buffer upload per segment
// and — more importantly — avoids dropping the compiled shader program on cleanup,
// which forced a recompile stall every time old track scrolled out of view.
const surfaceGeo = new THREE.PlaneGeometry(STANDARD_WIDTH, SEG_GEOM_LEN);

const trackMat3D = new THREE.MeshStandardMaterial({
    color: 0x0a1628, roughness: 0.5, metalness: 0.4,
    emissive: 0x061020, emissiveIntensity: 0.4,
    side: THREE.FrontSide
});

export function initTrack() {}

// ── Build a flat horizontal segment ──
function buildFlat(scene, world, phyMat, zPos, yPos) {
    // Flat plane — top face only, no sides, no bottom
    const mesh = new THREE.Mesh(surfaceGeo, trackMat3D);
    mesh.rotation.x = -Math.PI / 2;   // lay flat
    mesh.position.set(0, yPos, zPos);
    scene.add(mesh);

    const bodies = makePhysicsFlat(world, phyMat, 0, yPos, zPos, STANDARD_WIDTH / 2);

    return { mesh, bodies, type: 'flat', zPos, width: STANDARD_WIDTH, endY: yPos };
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
    totalGenerated++;

    return segment;
}

// ── Cleanup ──
// Geometry and material are shared and stay resident, so removal is just a
// scene detach plus dropping the physics bodies.
export function removeOldSegments(scene, world, marbleZ) {
    const threshold = marbleZ + SEGMENT_LENGTH * 3;
    while (segments.length > 0 && segments[0].zPos > threshold) {
        const seg = segments.shift();
        scene.remove(seg.mesh);
        for (const b of seg.bodies) world.removeBody(b);
    }
}

export function getSegments() { return segments; }
export function getSegmentLength() { return SEGMENT_LENGTH; }
export function getCurrentTrackY() { return currentY; }
export function getTrackMaterials() { return [trackMat3D]; }

export function resetTrack(scene, world) {
    for (const seg of segments) {
        if (scene) scene.remove(seg.mesh);
        if (world) for (const b of seg.bodies) world.removeBody(b);
    }
    segments.length = 0;
    nextZ = 0;
    currentY = START_Y;
    totalGenerated = 0;
}

export function getLastSegmentZ() {
    if (segments.length === 0) return 0;
    return segments[segments.length - 1].zPos;
}
