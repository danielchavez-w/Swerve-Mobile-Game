import * as THREE from 'three';

const collectibles = [];

// Shared geometries
const dotGeo = new THREE.SphereGeometry(0.2, 12, 12);
const diamondGeo = new THREE.OctahedronGeometry(0.35, 1);
const hoopGeo = new THREE.TorusGeometry(1.5, 0.12, 12, 32);
const boostGeo = (() => {
    const geo = new THREE.ConeGeometry(0.3, 0.7, 8);
    geo.rotateX(-Math.PI / 2); // Point forward (-Z)
    return geo;
})();

// Shared materials
const dotMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ccff,
    emissive: 0x0088ff,
    emissiveIntensity: 0.7,
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

const boostMaterial = new THREE.MeshStandardMaterial({
    color: 0x39ff14,
    emissive: 0x00ff00,
    emissiveIntensity: 1.0,
    roughness: 0.2,
    metalness: 0.5
});

export const COLLECTIBLE_TYPES = {
    DOT: 'dot',
    DIAMOND: 'diamond',
    HOOP: 'hoop',
    BOOST: 'boost'
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

function createBoost(scene, x, y, z) {
    const mesh = new THREE.Mesh(boostGeo, boostMaterial);
    mesh.position.set(x, y + 0.6, z);
    scene.add(mesh);

    return {
        type: COLLECTIBLE_TYPES.BOOST,
        mesh,
        zPos: z,
        baseY: y,
        collected: false,
        collectTime: 0,
        points: 25
    };
}

// Safe x-range the ball can actually reach (track half-width minus rail/margin)
const SAFE_X = 3.0;

function clampX(x) {
    return Math.max(-SAFE_X, Math.min(SAFE_X, x));
}

// Find the safe x-lane to guide the player through/around an obstacle
function getSafeLane(obstacle, trackWidth) {
    if (!obstacle) return 0;

    switch (obstacle.type) {
        case 'static_wall': {
            // Wall sits at xOffset with wallWidth — find the side with more open space
            const wallLeft = obstacle.xOffset - obstacle.wallWidth / 2;
            const wallRight = obstacle.xOffset + obstacle.wallWidth / 2;
            const halfTrack = trackWidth / 2;
            const leftSpace = wallLeft - (-halfTrack);
            const rightSpace = halfTrack - wallRight;

            if (leftSpace > rightSpace) {
                // Open lane on the left
                return clampX((-halfTrack + wallLeft) / 2);
            } else {
                // Open lane on the right
                return clampX((wallRight + halfTrack) / 2);
            }
        }
        case 'low_bar': {
            // Gap is always centered at x=0
            return 0;
        }
        case 'swinging_arm': {
            // Arm swings ±3 around center — safest at far edges
            return (Math.random() < 0.5 ? -1 : 1) * SAFE_X;
        }
        case 'sliding_block': {
            // Block slides across most of the track — pick an edge
            return (Math.random() < 0.5 ? -1 : 1) * SAFE_X;
        }
        default:
            return 0;
    }
}

export function spawnCollectiblesForSegment(scene, segmentZ, trackWidth, difficultyLevel, trackY, obstacle) {
    const density = getCollectibleDensity(difficultyLevel);
    const spawned = [];
    const y = trackY || 0;

    // Decide if we spawn dots this segment
    if (Math.random() < density) {
        const safeX = getSafeLane(obstacle, trackWidth);
        const numDots = 4 + Math.floor(Math.random() * 3); // 4–6 dots

        if (obstacle) {
            // Obstacle-aware trail — straight line through safe lane
            for (let i = 0; i < numDots; i++) {
                const z = segmentZ + (i - numDots / 2) * 2.5;
                const c = createDot(scene, safeX, y, z);
                collectibles.push(c);
                spawned.push(c);
            }
        } else {
            // No obstacle — clean trail with slight variation
            const pattern = Math.random();
            if (pattern < 0.5) {
                // Straight line with a small random offset from center
                const xBase = clampX((Math.random() - 0.5) * 3);
                for (let i = 0; i < numDots; i++) {
                    const z = segmentZ + (i - numDots / 2) * 2.5;
                    const c = createDot(scene, xBase, y, z);
                    collectibles.push(c);
                    spawned.push(c);
                }
            } else {
                // Gentle wave trail
                const xCenter = clampX((Math.random() - 0.5) * 2);
                for (let i = 0; i < numDots; i++) {
                    const x = clampX(xCenter + Math.sin(i * 0.8) * 1.5);
                    const z = segmentZ + (i - numDots / 2) * 2.5;
                    const c = createDot(scene, x, y, z);
                    collectibles.push(c);
                    spawned.push(c);
                }
            }
        }
    }

    // Diamond — rarer, placed on safe lane
    if (Math.random() < density * 0.3) {
        const safeX = obstacle ? getSafeLane(obstacle, trackWidth) : clampX((Math.random() - 0.5) * 3);
        const c = createDiamond(scene, safeX, y, segmentZ);
        collectibles.push(c);
        spawned.push(c);
    }

    // Hoop — rarest, placed on safe lane
    if (Math.random() < density * 0.15) {
        const safeX = obstacle ? getSafeLane(obstacle, trackWidth) : 0;
        const c = createHoop(scene, safeX, y, segmentZ);
        collectibles.push(c);
        spawned.push(c);
    }

    // Boost — introduced at level 3, rarer than dots, similar to diamonds
    if (difficultyLevel >= 3 && Math.random() < density * 0.2) {
        const safeX = obstacle ? getSafeLane(obstacle, trackWidth) : clampX((Math.random() - 0.5) * 3);
        const c = createBoost(scene, safeX, y, segmentZ);
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
        case 4: return 0.7;
        case 5: return 0.75;
        case 6: return 0.85;
        case 7: return 0.9;
        default: return 0.7;
    }
}

export function updateCollectibles(time, marblePos, marbleRadius, canCollect = true) {
    let pointsEarned = 0;
    let boostCollected = false;
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
        } else if (c.type === COLLECTIBLE_TYPES.BOOST) {
            c.mesh.rotation.y = time * 3;
            c.mesh.position.y = c.baseY + 0.6 + Math.sin(time * 2.5 + c.zPos) * 0.15;
        }

        // Skip collection during ghost mode
        if (!canCollect) continue;

        // Collision detection
        const dist = marblePos.distanceTo(c.mesh.position);

        if (c.type === COLLECTIBLE_TYPES.DOT && dist < marbleRadius + 0.4) {
            collectItem(c);
            pointsEarned += c.points;
        } else if (c.type === COLLECTIBLE_TYPES.DIAMOND && dist < marbleRadius + 0.5) {
            collectItem(c);
            pointsEarned += c.points;
        } else if (c.type === COLLECTIBLE_TYPES.BOOST && dist < marbleRadius + 0.45) {
            collectItem(c);
            pointsEarned += c.points;
            boostCollected = true;
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

    return { points: pointsEarned, boost: boostCollected };
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
