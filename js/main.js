import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { initScene, getScene, getCamera, getRenderer, warmUpGPU } from './scene.js';
import { initPhysics, stepPhysics, getWorld, GROUPS } from './physics.js';
import { createMarble, updateMarble, getMarbleMesh, getMarbleBody, getMarbleRadius, enterGhostMode, endGhostMode, isGhostMode, getGhostTimer, getGhostDuration, respawnMarble, getPlayerMaterials } from './player.js';
import { initControls, updateControls } from './controls.js';
import { initTrack, generateSegment, removeOldSegments, getSegments, getSegmentLength, getLastSegmentZ, resetTrack, getCurrentTrackY, getTrackMaterials } from './track.js';
import { initRails, updateRails, getRailMaterials } from './rails.js';
import { spawnObstacle, updateObstacles, removeOldObstacles, resetObstacles, getObstacleMaterials } from './obstacles.js';
import { spawnCollectiblesForSegment, updateCollectibles, removeOldCollectibles, resetCollectibles, getCollectibleMaterials } from './collectibles.js';
import { initHUD, updateScore, updateHighScore, updateLives, showGhostIndicator, hideGhostIndicator, showLevelUp, showHUD, hideHUD, showTitleScreen, hideTitleScreen, showGameOver, hideGameOver, screenShake, hitFlash, getRestartButton, getTitleScreen } from './hud.js';
import { getDifficultyForScore, checkLevelUp, getSpeedMultiplier, getCurrentLevel, resetDifficulty } from './difficulty.js';
import { createSkybox, updateSkybox, setSkyLevel } from './skybox.js';
import { createHexBackground, updateHexBackground, getHexMaterial } from './hexbg.js';
import { createShootingStars, updateShootingStars, triggerShootingStars, resetShootingStars, getShootingStarMaterials } from './shootingstars.js';
import { initAudio, resumeAudio, playCollectSound, playDiamondSound, playHoopSound, playHitSound, playGameOverSound, playLevelUpSound, playBoostSound } from './audio.js';

// Game states
const STATES = {
    MENU: 'MENU',
    PLAYING: 'PLAYING',
    GAME_OVER: 'GAME_OVER'
};

let gameState = STATES.MENU;
let score = 0;
let highScore = 0;
let lives = 3;
let lastTime = 0;
let gameTime = 0;
let isFirstGame = true;
const BASE_FORWARD_SPEED = -22;
const SEGMENTS_AHEAD = 25;

// Boost state
let boostActive = false;
let boostTimer = 0;
const BOOST_DURATION = 0.5;
const BOOST_SPEED_MULT = 1.3;

// Hit slowdown state — longer recovery at higher levels to balance fast base speeds
let hitSlowActive = false;
let hitSlowTimer = 0;
let hitSlowDuration = 2.0;
const HIT_SLOW_DURATIONS = {
    1: 2.0,
    2: 2.0,
    3: 2.0,
    4: 3.0,
    5: 3.5,
    6: 4.0,
    7: 4.5
};
const HIT_SLOW_MIN = 0.4;   // Drops to 40% speed on hit
// The drop is eased in over a few frames rather than applied on one — snapping
// the forward velocity on impact read as a frame hitch even when nothing dropped.
// Same 40% floor and same recovery duration as before, just no step or kink.
const HIT_SLOW_IN = 0.18;
let speedPenalty = 1;
let hitSlowFrom = 1;   // speed the ease-in starts from, so a second hit doesn't jump

function smoothstep01(p) {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    return p * p * (3 - 2 * p);
}

// Camera follow parameters
const cameraOffset = new THREE.Vector3(0, 5, 8);
const cameraLookAhead = new THREE.Vector3(0, 0, -12);
const cameraLerpSpeed = 3.5;

// Reusable objects to avoid per-frame allocations (reduces GC stutter)
const _cameraTargetPos = new THREE.Vector3();
const _cameraLookTarget = new THREE.Vector3();
const _marblePosVec = new THREE.Vector3();

// Track last segment generated
let segmentsGenerated = 0;

// Physics materials
let trackPhysMaterial;

function init() {
    highScore = parseInt(localStorage.getItem('swerve_highScore') || '0', 10);

    const container = document.getElementById('game-container');
    const { scene, camera, renderer } = initScene(container);

    const { world, trackMaterial, marbleMaterial } = initPhysics();
    trackPhysMaterial = trackMaterial;

    createSkybox(scene, renderer);
    createHexBackground(scene);
    createShootingStars(scene);

    const { mesh: marbleMesh, body: marbleBody } = createMarble(scene, world, marbleMaterial);

    initControls(marbleMesh, marbleBody, camera, renderer);

    initTrack();
    initRails(scene);

    initHUD();

    initAudio();

    // Pre-compile every shader program up front. Anything that first appears
    // mid-game — the ghost marble, the level-up streaks — has to be in here, or
    // the driver compiles it on the frame it shows up and the game hitches.
    warmUpGPU([
        ...getObstacleMaterials(),
        ...getCollectibleMaterials(),
        ...getPlayerMaterials(),
        ...getTrackMaterials(),
        ...getRailMaterials(),
        ...getShootingStarMaterials(),
        getHexMaterial()
    ]);
    // Sky materials (stars/nebulae) are already in the scene and visible,
    // so renderer.compile() inside warmUpGPU covers them. The star shader is a
    // Points material with custom attributes and must not go on a temp Mesh.

    showTitleScreen(highScore);

    getTitleScreen().addEventListener('click', startGame);
    getTitleScreen().addEventListener('touchstart', (e) => {
        e.preventDefault();
        startGame();
    });

    getRestartButton().addEventListener('click', () => {
        if (gameState === STATES.GAME_OVER) startGame();
    });
    getRestartButton().addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameState === STATES.GAME_OVER) startGame();
    });

    marbleBody.addEventListener('collide', onMarbleCollide);

    requestAnimationFrame(gameLoop);
}

function startGame() {
    resumeAudio();

    const scene = getScene();
    const world = getWorld();

    resetTrack(scene, world);
    resetObstacles(scene, world);
    resetCollectibles(scene);
    resetShootingStars();
    setSkyLevel(1, true);
    resetDifficulty();

    score = 0;
    lives = 3;
    segmentsGenerated = 0;
    gameTime = 0;
    boostActive = false;
    boostTimer = 0;
    hitSlowActive = false;
    hitSlowTimer = 0;
    speedPenalty = 1;
    hitSlowFrom = 1;

    // Generate initial track first, so we know the Y
    for (let i = 0; i < SEGMENTS_AHEAD; i++) {
        const level = getDifficultyForScore(score).level;
        const seg = generateSegment(scene, world, trackPhysMaterial, level);
        segmentsGenerated++;

        // Spawn obstacle first so collectibles can be placed around it
        let obstacle = null;
        if (i > 5) {
            obstacle = spawnObstacle(scene, world, seg.zPos, seg.width || 8, level, seg.endY);
        }
        if (i > 2) {
            spawnCollectiblesForSegment(scene, seg.zPos, seg.width || 8, level, seg.endY, obstacle);
        }
    }

    // Place ball on the first segment — push it slightly into the surface
    // so the physics solver detects contact immediately (no free-fall frame)
    const firstSeg = getSegments()[0];
    const marbleBody = getMarbleBody();
    const spawnY = firstSeg.endY + getMarbleRadius() - 0.05;
    marbleBody.position.set(0, spawnY, firstSeg.zPos);
    marbleBody.previousPosition.set(0, spawnY, firstSeg.zPos);
    marbleBody.interpolatedPosition.set(0, spawnY, firstSeg.zPos);
    marbleBody.velocity.set(0, 0, 0);
    marbleBody.angularVelocity.set(0, 0, 0);
    marbleBody.force.set(0, 0, 0);
    marbleBody.torque.set(0, 0, 0);

    // Let physics settle — ball finds the surface before gameplay begins
    for (let i = 0; i < 15; i++) {
        world.step(1 / 60);
    }
    // After settling, freeze the ball in place on the ground
    marbleBody.velocity.set(0, 0, 0);
    marbleBody.angularVelocity.set(0, 0, 0);
    marbleBody.force.set(0, 0, 0);
    marbleBody.torque.set(0, 0, 0);
    // Sync previous position to prevent interpolation jump
    marbleBody.previousPosition.copy(marbleBody.position);
    marbleBody.interpolatedPosition.copy(marbleBody.position);

    // Snap camera to correct position — prevents lerp-from-stale-position jitter
    const camera = getCamera();
    camera.position.set(
        0,
        marbleBody.position.y + cameraOffset.y,
        marbleBody.position.z + cameraOffset.z
    );
    const lookTarget = new THREE.Vector3(0, marbleBody.position.y + 0.5, marbleBody.position.z + cameraLookAhead.z);
    camera.lookAt(lookTarget);

    updateScore(score);
    updateHighScore(highScore);
    updateLives(lives);
    hideGhostIndicator();

    hideTitleScreen();
    hideGameOver();
    showHUD();
    showLevelUp(1);
    lastTime = performance.now();
    gameState = STATES.PLAYING;

    if (isFirstGame) {
        isFirstGame = false;
        showTutorial();
    }
}

function onMarbleCollide(event) {
    if (gameState !== STATES.PLAYING) return;
    if (isGhostMode()) return;

    const otherBody = event.body;
    if (otherBody.collisionFilterGroup === GROUPS.OBSTACLE) {
        takeDamage();
    }
}

function takeDamage() {
    if (isGhostMode()) return;

    lives--;
    updateLives(lives);
    playHitSound();
    screenShake();
    hitFlash();

    if (lives <= 0) {
        gameOver();
        return;
    }

    enterGhostMode();
    hitSlowActive = true;
    hitSlowDuration = HIT_SLOW_DURATIONS[getCurrentLevel()] || 2.0;
    hitSlowTimer = hitSlowDuration;
    hitSlowFrom = speedPenalty;
}

function gameOver() {
    gameState = STATES.GAME_OVER;
    playGameOverSound();

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('swerve_highScore', highScore.toString());
    }

    hideHUD();
    hideGhostIndicator();
    showGameOver(score, highScore);
}

function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);

    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    const time = timestamp / 1000;
    lastTime = timestamp;

    if (gameState === STATES.PLAYING) {
        gameTime += dt;
        updatePlaying(dt, time);
    }

    const renderer = getRenderer();
    const scene = getScene();
    const camera = getCamera();

    updateSkybox(time, camera.position);
    updateHexBackground(time, camera.position);
    updateShootingStars(time, camera.position);
    renderer.render(scene, camera);
}

function updatePlaying(dt, time) {
    const scene = getScene();
    const world = getWorld();
    const marbleBody = getMarbleBody();
    const marbleMesh = getMarbleMesh();
    const camera = getCamera();

    // Constant speed — only changes on level-up
    const speedMult = getSpeedMultiplier(score);

    // Boost timer countdown
    if (boostActive) {
        boostTimer -= dt;
        if (boostTimer <= 0) {
            boostActive = false;
        }
    }

    // Hit slowdown — ease down to HIT_SLOW_MIN, hold the floor, ease back to 1.0.
    // Both ends of both curves have zero slope, so there is no velocity step on
    // impact and no kink when the recovery finishes.
    if (hitSlowActive) {
        hitSlowTimer -= dt;
        if (hitSlowTimer <= 0) {
            hitSlowActive = false;
            speedPenalty = 1;
        } else {
            const elapsed = hitSlowDuration - hitSlowTimer;
            if (elapsed < HIT_SLOW_IN) {
                speedPenalty = hitSlowFrom -
                    (hitSlowFrom - HIT_SLOW_MIN) * smoothstep01(elapsed / HIT_SLOW_IN);
            } else {
                const progress = (elapsed - HIT_SLOW_IN) / (hitSlowDuration - HIT_SLOW_IN);
                speedPenalty = HIT_SLOW_MIN + (1 - HIT_SLOW_MIN) * smoothstep01(progress);
            }
        }
    }

    const forwardSpeed = BASE_FORWARD_SPEED * speedMult * (boostActive ? BOOST_SPEED_MULT : 1) * speedPenalty;

    // Set forward velocity directly for constant, predictable speed
    marbleBody.velocity.z = forwardSpeed;

    // Touch / trackpad / keyboard controls
    updateControls(dt);

    // Step physics
    stepPhysics(dt);

    // Hard-clamp ball X inside the rails (prevents tunneling at any speed)
    const TRACK_MAX_X = 3.35;   // halfW(4.5) - railHalfX(0.5) - marbleR(0.65)
    if (marbleBody.position.x > TRACK_MAX_X) {
        marbleBody.position.x = TRACK_MAX_X;
        if (marbleBody.velocity.x > 0) marbleBody.velocity.x = 0;
    } else if (marbleBody.position.x < -TRACK_MAX_X) {
        marbleBody.position.x = -TRACK_MAX_X;
        if (marbleBody.velocity.x < 0) marbleBody.velocity.x = 0;
    }

    // Ball must stay on the ground — dampen upward velocity.
    // Use a threshold so the contact solver can do its micro-adjustments
    // without creating an oscillation loop (which causes track jitter at low speeds).
    if (marbleBody.velocity.y > 0.3) {
        marbleBody.velocity.y = 0;
    } else if (marbleBody.velocity.y > 0) {
        marbleBody.velocity.y *= 0.5;
    }

    // Update marble visual
    updateMarble(dt);

    // Camera follow
    updateCamera(camera, marbleMesh, dt);

    // Check if marble fell off track
    const trackY = getCurrentTrackY();
    if (marbleBody.position.y < trackY - 20) {
        respawnMarble(marbleBody.position.z, trackY + getMarbleRadius());
        takeDamage();
        if (gameState !== STATES.PLAYING) return;
    }

    // Generate more track ahead
    const marbleZ = marbleBody.position.z;
    const lastZ = getLastSegmentZ();
    const segLen = getSegmentLength();

    while (marbleZ - lastZ < SEGMENTS_AHEAD * segLen) {
        const level = getDifficultyForScore(score).level;
        const seg = generateSegment(scene, world, trackPhysMaterial, level);
        segmentsGenerated++;

        const obstacle = spawnObstacle(scene, world, seg.zPos, seg.width || 8, level, seg.endY);
        spawnCollectiblesForSegment(scene, seg.zPos, seg.width || 8, level, seg.endY, obstacle);

        if (marbleZ - getLastSegmentZ() >= SEGMENTS_AHEAD * segLen) break;
    }

    // Cleanup old segments and objects
    removeOldSegments(scene, world, marbleZ);
    removeOldObstacles(scene, world, marbleZ);
    removeOldCollectibles(scene, marbleZ);

    // Update rail visuals
    updateRails();

    // Update obstacles (animations)
    updateObstacles(time);

    // Update collectibles and check collections (skip during ghost mode)
    _marblePosVec.copy(marbleBody.position);
    const collectResult = updateCollectibles(time, _marblePosVec, getMarbleRadius(), !isGhostMode());

    if (collectResult.boost) {
        boostActive = true;
        boostTimer = BOOST_DURATION;
        playBoostSound();
    }

    if (collectResult.points > 0) {
        score += collectResult.points;
        updateScore(score);

        if (collectResult.points >= 100) playHoopSound();
        else if (collectResult.points >= 50) playDiamondSound();
        else playCollectSound();

        const levelUp = checkLevelUp(score);
        if (levelUp) {
            showLevelUp(levelUp.level);
            // Celebration is for levels actually earned — level 1 is just the start
            triggerShootingStars(time, levelUp.level);
            setSkyLevel(levelUp.level);
            playLevelUpSound();
        }

        if (score > highScore) {
            highScore = score;
            updateHighScore(highScore);
            localStorage.setItem('swerve_highScore', highScore.toString());
        }
    }

    // Ghost mode HUD
    if (isGhostMode()) {
        showGhostIndicator(getGhostTimer(), getGhostDuration());
    } else {
        hideGhostIndicator();
    }
}

function updateCamera(camera, marbleMesh, dt) {
    _cameraTargetPos.set(
        marbleMesh.position.x * 0.4,
        marbleMesh.position.y + cameraOffset.y,
        marbleMesh.position.z + cameraOffset.z
    );

    // Frame-rate-independent exponential decay — eliminates jitter from dt variation
    const smoothFactor = 1 - Math.exp(-cameraLerpSpeed * dt);
    // Much smoother Y tracking to absorb staircase slope transitions
    const ySmoothFactor = 1 - Math.exp(-1.2 * dt);

    camera.position.x += (_cameraTargetPos.x - camera.position.x) * smoothFactor;
    camera.position.y += (_cameraTargetPos.y - camera.position.y) * ySmoothFactor;
    camera.position.z += (_cameraTargetPos.z - camera.position.z) * smoothFactor;

    _cameraLookTarget.set(
        marbleMesh.position.x * 0.3,
        marbleMesh.position.y + 0.5,
        marbleMesh.position.z + cameraLookAhead.z
    );
    camera.lookAt(_cameraLookTarget);
}

function showTutorial() {
    const overlay = document.getElementById('tutorial-overlay');
    overlay.classList.remove('hidden');
    overlay.classList.add('active');

    const dismiss = () => {
        overlay.classList.remove('active');
        overlay.style.display = 'none';
        document.removeEventListener('touchstart', dismiss);
        document.removeEventListener('click', dismiss);
    };

    // Remove when animation ends naturally
    overlay.addEventListener('animationend', dismiss, { once: true });

    // Also dismiss on touch — defer so the starting tap doesn't trigger it
    requestAnimationFrame(() => {
        document.addEventListener('touchstart', dismiss);
        document.addEventListener('click', dismiss);
    });
}

// Start the game
init();
