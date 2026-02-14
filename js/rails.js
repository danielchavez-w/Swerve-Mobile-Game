// rails.js — creates exactly 2 continuous rail meshes for the entire track
import * as THREE from 'three';
import { getSegments } from './track.js';

const RAIL_WIDTH = 0.3;
const RAIL_HEIGHT = 0.5;
const RAIL_COLOR = 0x00ffcc;

let leftRail = null;
let rightRail = null;

const railMat = new THREE.MeshStandardMaterial({
    color: RAIL_COLOR,
    emissive: RAIL_COLOR,
    emissiveIntensity: 0.5,
    roughness: 0.3,
    metalness: 0.4
});

export function initRails(scene) {
    // Base geometry: 1 unit in Z, scaled each frame to match visible track
    const geo = new THREE.BoxGeometry(RAIL_WIDTH, RAIL_HEIGHT, 1);

    leftRail = new THREE.Mesh(geo, railMat);
    leftRail.name = 'rail-left';
    scene.add(leftRail);

    rightRail = new THREE.Mesh(geo.clone(), railMat);
    rightRail.name = 'rail-right';
    scene.add(rightRail);
}

export function updateRails() {
    if (!leftRail || !rightRail) return;

    const segments = getSegments();
    if (segments.length === 0) {
        leftRail.visible = false;
        rightRail.visible = false;
        return;
    }

    leftRail.visible = true;
    rightRail.visible = true;

    // Find Z extent and reference Y from nearest flat segment
    let minZ = Infinity;
    let maxZ = -Infinity;
    let refY = null;
    let trackWidth = 9;

    for (const seg of segments) {
        if (seg.zPos < minZ) minZ = seg.zPos;
        if (seg.zPos > maxZ) maxZ = seg.zPos;
        if (refY === null && seg.type !== 'ramp_up' && seg.type !== 'gap') {
            refY = seg.endY;
            trackWidth = seg.width || 9;
        }
    }

    if (refY === null) refY = segments[0].endY;

    // Each segment's geometry extends ±18 units from its zPos
    const padding = 18;
    const nearZ = maxZ + padding;
    const farZ = minZ - padding;
    const totalLen = nearZ - farZ;
    const centerZ = (nearZ + farZ) / 2;
    const halfW = trackWidth / 2;
    const railY = refY + RAIL_HEIGHT / 2;

    // Scale Z to match needed length (base geometry is 1 unit long)
    leftRail.scale.z = totalLen;
    leftRail.position.set(-halfW, railY, centerZ);

    rightRail.scale.z = totalLen;
    rightRail.position.set(halfW, railY, centerZ);
}
