import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { initScene, getScene, getCamera, getRenderer } from './scene.js';
import { initPhysics, stepPhysics, getWorld, GROUPS } from './physics.js';
import { createMarble, updateMarble, getMarbleMesh, getMarbleBody, getMarbleRadius, enterGhostMode, endGhostMode, isGhostMode, getGhostTimer, getGhostDuration, respawnMarble } from './player.js';
import { initControls, updateControls } from './controls.js';
import { initTrack, generateSegment, removeOldSegments, getSegments, getSegmentLength, getLastSegmentZ, resetTrack, getCurrentTrackY } from './track.js';
import { initRails, updateRails } from './rails.js';
import { spawnObstacle, updateObstacles, removeOldObstacles, resetObstacles } from './obstacles.js';
import { spawnCollectiblesForSegment, updateCollectibles, removeOldCollectibles, resetCollectibles } from './collectibles.js';
import { initHUD, updateScore, updateHighScore, updateLives, showGhostIndicator, hideGhostIndicator, showLevelUp, showHUD, hideHUD, showTitleScreen, hideTitleScreen, showGameOver, hideGameOver, screenShake, hitFlash, getRestartButton, getTitleScreen } from './hud.js';
import { getDifficultyForScore, checkLevelUp, getSpeedMultiplier, resetDifficulty } from './difficulty.js';
import { createSkybox, updateSkybox } from './skybox.js';
import { initAudio, resumeAudio, playCollectSound, playDiamondSound, playHoopSound, playHitSound, playGameOverSound, playLevelUpSound } from './audio.js';

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
const BASE_FORWARD_SPEED = -16;
const SEGMENTS_AHEAD = 25;
const SPEED_RAMP_TIME = 3.0;       // Seconds to reach full speed from start

// Camera follow parameters
const cameraOffset = new THREE.Vector3(0, 5, 8);
const cameraLookAhead = new THREE.Vector3(0, 0, -12);
const cameraLerpSpeed = 3.5;

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

    createSkybox(scene);

    const { mesh: marbleMesh, body: marbleBody } = createMarble(scene, world, marbleMaterial);

    initControls(marbleMesh, marbleBody, camera, renderer);

    initTrack();
    initRails(scene);

    initHUD();

    initAudio();

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
    resetDifficulty();

    score = 0;
    lives = 3;
    segmentsGenerated = 0;
    gameTime = 0;

    // Generate initial track first, so we know the Y
    for (let i = 0; i < SEGMENTS_AHEAD; i++) {
        const level = getDifficultyForScore(score).level;
        const seg = generateSegment(scene, world, trackPhysMaterial, level);
        segmentsGenerated++;

        if (i > 2) {
            spawnCollectiblesForSegment(scene, seg.zPos, seg.width || 8, level, seg.endY);
        }
        if (i > 5) {
            spawnObstacle(scene, world, seg.zPos, seg.width || 8, level, seg.endY);
        }
    }

    // ── Debug: verify no duplicate rail meshes ──
    {
        const s = getScene();
        const railMeshes = [];
        s.traverse(child => {
            if (child.isMesh) {
                const name = (child.name || '').toLowerCase();
                const geoType = child.geometry?.type || '';
                if (name.includes('rail') || name.includes('edge') ||
                    (geoType === 'CylinderGeometry' && child.material?.emissiveIntensity > 0)) {
                    railMeshes.push({ name: child.name || '(unnamed)', type: geoType, id: child.id });
                }
            }
        });
        console.log(`[RAIL DEBUG] scene.children: ${s.children.length}`);
        console.log(`[RAIL DEBUG] rail-like meshes found: ${railMeshes.length}`, railMeshes);
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
    for (let i = 0; i < 30; i++) {
        world.step(1 / 120);
    }
    // After settling, freeze the ball in place on the ground
    marbleBody.velocity.set(0, 0, 0);
    marbleBody.angularVelocity.set(0, 0, 0);
    marbleBody.force.set(0, 0, 0);
    marbleBody.torque.set(0, 0, 0);
    // Sync previous position to prevent interpolation jump
    marbleBody.previousPosition.copy(marbleBody.position);
    marbleBody.interpolatedPosition.copy(marbleBody.position);

    updateScore(score);
    updateHighScore(highScore);
    updateLives(lives);
    hideGhostIndicator();

    hideTitleScreen();
    hideGameOver();
    showHUD();
    lastTime = performance.now();
    gameState = STATES.PLAYING;
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
    lastTime = timestamp;

    if (gameState === STATES.PLAYING) {
        gameTime += dt;
        updatePlaying(dt, timestamp / 1000);
    }

    const renderer = getRenderer();
    const scene = getScene();
    const camera = getCamera();

    updateSkybox(timestamp / 1000, camera.position);
    renderer.render(scene, camera);
}

function updatePlaying(dt, time) {
    const scene = getScene();
    const world = getWorld();
    const marbleBody = getMarbleBody();
    const marbleMesh = getMarbleMesh();
    const camera = getCamera();

    // ── Gradual speed ramp — no sudden acceleration at start ──
    const speedRamp = Math.min(gameTime / SPEED_RAMP_TIME, 1.0);
    const speedMult = getSpeedMultiplier(score);
    const forwardSpeed = BASE_FORWARD_SPEED * speedMult * speedRamp;
    const currentVZ = marbleBody.velocity.z;

    // Gentle constant forward push (ramped)
    marbleBody.applyForce(new CANNON.Vec3(0, 0, -15 * speedMult * speedRamp), marbleBody.position);

    // If going slower than target, nudge toward it (gentle boost)
    if (currentVZ > forwardSpeed) {
        const boost = (forwardSpeed - currentVZ) * 3;
        marbleBody.applyForce(new CANNON.Vec3(0, 0, boost), marbleBody.position);
    }

    // NEVER allow backward movement
    if (currentVZ > 0) {
        marbleBody.velocity.z = 0;
        marbleBody.applyForce(new CANNON.Vec3(0, 0, -10 * speedRamp), marbleBody.position);
    }

    // Touch / trackpad / keyboard controls
    updateControls(dt);

    // Step physics
    stepPhysics(dt);

    // Ball must stay on the ground — kill any upward velocity
    if (marbleBody.velocity.y > 0) {
        marbleBody.velocity.y = 0;
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

        spawnCollectiblesForSegment(scene, seg.zPos, seg.width || 8, level, seg.endY);
        spawnObstacle(scene, world, seg.zPos, seg.width || 8, level, seg.endY);

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

    // Update collectibles and check collections
    const marblePos = new THREE.Vector3().copy(marbleBody.position);
    const pointsEarned = updateCollectibles(time, marblePos, getMarbleRadius());

    if (pointsEarned > 0) {
        score += pointsEarned;
        updateScore(score);

        if (pointsEarned >= 100) playHoopSound();
        else if (pointsEarned >= 50) playDiamondSound();
        else playCollectSound();

        const levelUp = checkLevelUp(score);
        if (levelUp) {
            showLevelUp(levelUp.level);
            playLevelUpSound();
        }

        if (score > highScore) {
            highScore = score;
            updateHighScore(highScore);
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
    const targetPos = new THREE.Vector3(
        marbleMesh.position.x * 0.4,
        marbleMesh.position.y + cameraOffset.y,
        marbleMesh.position.z + cameraOffset.z
    );

    camera.position.lerp(targetPos, cameraLerpSpeed * dt);

    const lookTarget = new THREE.Vector3(
        marbleMesh.position.x * 0.3,
        marbleMesh.position.y + 0.5,
        marbleMesh.position.z + cameraLookAhead.z
    );
    camera.lookAt(lookTarget);
}

// Start the game
init();
