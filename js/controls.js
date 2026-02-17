import * as THREE from 'three';
import * as CANNON from 'cannon-es';

let marbleMesh, marbleBody, camera, renderer;
let isTouching = false;
let fingerX = 0;
let fingerY = 0;
let lastFingerY = 0;
let touchId = null;

// Jump
let jumpRequested = false;
let canJump = true;
let lastGroundTime = 0;
const JUMP_UP = 12;
const JUMP_SPEED_BOOST = 3;        // Extra forward speed on jump

// Keyboard
const keys = {};

// Track boundary — keep ball inside the rails
const TRACK_HALF_W = 4.5;       // STANDARD_WIDTH / 2
const RAIL_HALF_X = 0.5;        // RAIL_RADIUS * 2 (rail box half-extent in X)
const MARBLE_R = 0.65;
const MAX_X = TRACK_HALF_W - RAIL_HALF_X - MARBLE_R;  // ~3.35

// Reusable vectors to avoid per-frame allocations
const _unprojectVec = new THREE.Vector3();
const _keyForceVec = new CANNON.Vec3();

export function initControls(_marbleMesh, _marbleBody, _camera, _renderer) {
    marbleMesh = _marbleMesh;
    marbleBody = _marbleBody;
    camera = _camera;
    renderer = _renderer;

    const canvas = renderer.domElement;
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
            jumpRequested = true;
        }
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });

    marbleBody.addEventListener('collide', (ev) => {
        if (ev.body.collisionFilterGroup === 1 || ev.body.collisionFilterGroup === 16) {
            canJump = true;
            lastGroundTime = performance.now();
        }
    });
}

// Convert finger screen X to world X at the ball's depth
function fingerToWorldX() {
    const ndcX = (fingerX / window.innerWidth) * 2 - 1;
    const ndcY = -(fingerY / window.innerHeight) * 2 + 1;

    _unprojectVec.set(ndcX, ndcY, 0.5);
    _unprojectVec.unproject(camera);

    _unprojectVec.sub(camera.position).normalize();

    const ballY = marbleMesh.position.y;
    if (Math.abs(_unprojectVec.y) < 0.001) return marbleMesh.position.x;
    const t = (ballY - camera.position.y) / _unprojectVec.y;
    return camera.position.x + _unprojectVec.x * t;
}

// ── Touch ──
function onTouchStart(e) {
    e.preventDefault();
    e.stopPropagation();
    const t = e.changedTouches[0];
    isTouching = true;
    touchId = t.identifier;
    fingerX = t.clientX;
    fingerY = t.clientY;
    lastFingerY = t.clientY;
}

function onTouchMove(e) {
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === touchId) {
            // Detect swipe up: finger moved 30+ px upward since last move event
            const dyUp = lastFingerY - t.clientY;
            if (dyUp > 30) {
                jumpRequested = true;
                lastFingerY = t.clientY;
                // DON'T update fingerY during swipe-up to prevent X tracking jitter
                return;
            }

            fingerX = t.clientX;
            fingerY = t.clientY;
            lastFingerY = t.clientY;
        }
    }
}

function onTouchEnd(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
            isTouching = false;
            touchId = null;
        }
    }
}

// ── Mouse ──
function onMouseDown(e) {
    isTouching = true;
    fingerX = e.clientX;
    fingerY = e.clientY;
    lastFingerY = e.clientY;
}
function onMouseMove(e) {
    if (!isTouching) return;
    const dyUp = lastFingerY - e.clientY;
    if (dyUp > 30) {
        jumpRequested = true;
        lastFingerY = e.clientY;
        return;
    }
    fingerX = e.clientX;
    fingerY = e.clientY;
    lastFingerY = e.clientY;
}
function onMouseUp(e) {
    isTouching = false;
}

// ── Per-frame ──
export function updateControls(dt) {
    if (!marbleBody) return;
    if (!dt || dt <= 0) dt = 1 / 60;

    // ── Finger / mouse → ball: 1:1 world-space tracking ──
    if (isTouching) {
        const rawX = fingerToWorldX();
        const targetX = Math.max(-MAX_X, Math.min(MAX_X, rawX));
        const dx = targetX - marbleBody.position.x;

        // Move ball to finger X in ~1 frame (exact tracking)
        marbleBody.velocity.x = dx / dt;
    }

    // ── Keyboard ── (skip force if already at rail boundary)
    if ((keys['KeyA'] || keys['ArrowLeft']) && marbleBody.position.x > -MAX_X) {
        _keyForceVec.set(-200, 0, 0);
        marbleBody.applyForce(_keyForceVec, marbleBody.position);
    }
    if ((keys['KeyD'] || keys['ArrowRight']) && marbleBody.position.x < MAX_X) {
        _keyForceVec.set(200, 0, 0);
        marbleBody.applyForce(_keyForceVec, marbleBody.position);
    }

    // ── Jump ──
    if (jumpRequested && canJump) {
        // Jump UP only — preserve current forward velocity, add a small boost
        const currentVZ = marbleBody.velocity.z;
        marbleBody.velocity.y = JUMP_UP;                    // Straight up
        marbleBody.velocity.z = currentVZ - JUMP_SPEED_BOOST;  // Slight forward boost
        canJump = false;
    }
    jumpRequested = false;

    // Coyote time
    if (!canJump && (performance.now() - lastGroundTime) < 200) {
        canJump = true;
    }
}

export function isDraggingMarble() { return isTouching; }
