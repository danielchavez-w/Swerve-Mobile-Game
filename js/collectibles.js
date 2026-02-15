import * as THREE from 'three';

const collectibles = [];

// Shared geometries
const dotGeo = new THREE.SphereGeometry(0.2, 8, 8);
const diamondGeo = new THREE.OctahedronGeometry(0.35, 0);
const hoopGeo = new THREE.TorusGeometry(1.5, 0.12, 8, 24);

// Shared materials
const dotMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ffaa,
    emissive: 0x00ff88,
    emissiveIntensity: 0.6,
    roughness: 0.3,
    metalness: 0.4
});

const diamondMaterial = new THREE.MeshStandardMaterial({
    color: 0xffdd00,
    emissive: 0xffaa00,
    emissiveIntensity: 0.7,
    roughness: 0.2,
    metalness: 0.6
});

const hoopMaterial = new THREE.MeshStandardMaterial({
    color: 0xff44ff,
    emissive: 0xff00ff,
    emissiveIntensity: 0.8,
    roughness: 0.2,
    metalness: 0.5,
    transparent: true,
    opacity: 0.8
});

export const COLLECTIBLE_TYPES = {
    DOT: 'dot',
    DIAMOND: 'diamond',
    HOOP: 'hoop'
};

function createDot(scene, x, y, z) {
    const mesh = new THREE.Mesh(dotGeo, dotMaterial);
    mesh.position.set(x, y + 0.5, z);
    scene.add(mesh);

    return {
        type: COLLECTIBLE_TYPES.DOT,
        mesh,
        zPos: z,
        baseY: y,
        collected: false,
        collectTime: 0,
        points: 10
    };
}

function createDiamond(scene, x, y, z) {
    const mesh = new THREE.Mesh(diamondGeo, diamondMaterial);
    mesh.position.set(x, y + 0.8, z);
    scene.add(mesh);

    return {
        type: COLLECTIBLE_TYPES.DIAMOND,
        mesh,
        zPos: z,
        baseY: y,
        collected: false,
        collectTime: 0,
        points: 50
    };
}

function createHoop(scene, x, y, z) {
    const mesh = new THREE.Mesh(hoopGeo, hoopMaterial);
    mesh.position.set(x, y + 2.0, z);
    scene.add(mesh);

    return {
        type: COLLECTIBLE_TYPES.HOOP,
        mesh,
        zPos: z,
        baseY: y,
        collected: false,
        collectTime: 0,
        points: 100,
        innerRadius: 1.5
    };
}

export function spawnCollectiblesForSegment(scene, segmentZ, trackWidth, difficultyLevel, trackY) {
    const density = getCollectibleDensity(difficultyLevel);
    const spawned = [];
    const y = trackY || 0;

    // Point dots — line pattern
    if (Math.random() < density) {
        const pattern = Math.random();
        const numDots = 3 + Math.floor(Math.random() * 4);

        if (pattern < 0.4) {
            const x = (Math.random() - 0.5) * (trackWidth - 2);
            for (let i = 0; i < numDots; i++) {
                const z = segmentZ + (i - numDots / 2) * 2;
                const c = createDot(scene, x, y, z);
                collectibles.push(c);
                spawned.push(c);
            }
        } else if (pattern < 0.7) {
            for (let i = 0; i < numDots; i++) {
                const x = (i % 2 === 0 ? -1 : 1) * (1 + Math.random());
                const z = segmentZ + (i - numDots / 2) * 2.5;
                const c = createDot(scene, x, y, z);
                collectibles.push(c);
                spawned.push(c);
            }
        } else {
            for (let i = 0; i < numDots; i++) {
                const angle = (i / numDots) * Math.PI;
                const x = Math.cos(angle) * 2;
                const z = segmentZ + (i - numDots / 2) * 2;
                const c = createDot(scene, x, y, z);
                collectibles.push(c);
                spawned.push(c);
            }
        }
    }

    // Diamond — rarer
    if (Math.random() < density * 0.3) {
        const x = (Math.random() - 0.5) * (trackWidth - 2);
        const c = createDiamond(scene, x, y, segmentZ);
        collectibles.push(c);
        spawned.push(c);
    }

    // Hoop — rarest
    if (Math.random() < density * 0.15) {
        const c = createHoop(scene, 0, y, segmentZ);
        collectibles.push(c);
        spawned.push(c);
    }

    return spawned;
}

function getCollectibleDensity(level) {
    switch (level) {
        case 1: return 0.8;
        case 2: return 0.65;
        case 3: return 0.55;
        case 4: return 0.4;
        case 5: return 0.3;
        default: return 0.7;
    }
}

export function updateCollectibles(time, marblePos, marbleRadius) {
    let pointsEarned = 0;
    const now = performance.now();

    for (const c of collectibles) {
        // Handle fade-out animation for collected items (in main loop, no separate RAF)
        if (c.collected) {
            if (c.mesh.visible) {
                const elapsed = now - c.collectTime;
                const t = Math.min(elapsed / 200, 1);
                if (t < 1) {
                    c.mesh.scale.setScalar(1 - t);
                } else {
                    c.mesh.visible = false;
                }
            }
            continue;
        }

        // Animate
        if (c.type === COLLECTIBLE_TYPES.DIAMOND) {
            c.mesh.rotation.y = time * 2;
            c.mesh.rotation.z = Math.sin(time * 1.5) * 0.3;
        } else if (c.type === COLLECTIBLE_TYPES.DOT) {
            c.mesh.position.y = c.baseY + 0.5 + Math.sin(time * 3 + c.zPos) * 0.1;
        } else if (c.type === COLLECTIBLE_TYPES.HOOP) {
            c.mesh.rotation.y = Math.sin(time * 0.8 + c.zPos) * 0.15;
        }

        // Collision detection
        const dist = marblePos.distanceTo(c.mesh.position);

        if (c.type === COLLECTIBLE_TYPES.DOT && dist < marbleRadius + 0.4) {
            collectItem(c);
            pointsEarned += c.points;
        } else if (c.type === COLLECTIBLE_TYPES.DIAMOND && dist < marbleRadius + 0.5) {
            collectItem(c);
            pointsEarned += c.points;
        } else if (c.type === COLLECTIBLE_TYPES.HOOP) {
            const hoopPos = c.mesh.position;
            const dz = Math.abs(marblePos.z - hoopPos.z);
            const dx = marblePos.x - hoopPos.x;
            const dy = marblePos.y - hoopPos.y;
            const radialDist = Math.sqrt(dx * dx + dy * dy);

            if (dz < marbleRadius + 0.3 && radialDist < c.innerRadius) {
                collectItem(c);
                pointsEarned += c.points;
            }
        }
    }

    return pointsEarned;
}

function collectItem(c) {
    c.collected = true;
    c.collectTime = performance.now();
}

export function removeOldCollectibles(scene, marbleZ) {
    const removeThreshold = marbleZ + 60;

    for (let i = collectibles.length - 1; i >= 0; i--) {
        if (collectibles[i].zPos > removeThreshold) {
            scene.remove(collectibles[i].mesh);
            collectibles.splice(i, 1);
        }
    }
}

export function getCollectibles() { return collectibles; }

export function resetCollectibles(scene) {
    for (const c of collectibles) {
        scene.remove(c.mesh);
    }
    collectibles.length = 0;
}
