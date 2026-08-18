let scoreEl, highscoreEl, livesEls, ghostIndicator, ghostTimerRing;
let levelUpEl, levelUpTextEl;
let titleScreen, titleHighscore, tapToStart;
let gameOverScreen, finalScore, finalHighscore, restartBtn;
let gameContainer, hitFlashEl;

// Cached state so the per-frame HUD calls stay no-ops when nothing changed
let scorePulseTimer = null;
let ghostVisible = false;
let lastRingOffset = -1;
let shakeTimer = null;
let flashTimer = null;

export function initHUD() {
    scoreEl = document.getElementById('score-display');
    highscoreEl = document.getElementById('highscore-display');
    livesEls = [
        document.getElementById('life-1'),
        document.getElementById('life-2'),
        document.getElementById('life-3')
    ];
    ghostIndicator = document.getElementById('ghost-indicator');
    ghostTimerRing = document.getElementById('ghost-timer-ring');
    levelUpEl = document.getElementById('level-up');
    levelUpTextEl = document.getElementById('level-up-text');
    titleScreen = document.getElementById('title-screen');
    titleHighscore = document.getElementById('title-highscore');
    tapToStart = document.getElementById('tap-to-start');
    gameOverScreen = document.getElementById('game-over-screen');
    finalScore = document.getElementById('final-score');
    finalHighscore = document.getElementById('final-highscore');
    restartBtn = document.getElementById('restart-btn');
    gameContainer = document.getElementById('game-container');
    hitFlashEl = document.getElementById('hit-flash');
}

export function updateScore(score) {
    scoreEl.textContent = score;
    scoreEl.classList.add('pulse');
    // One shared timer — dots arrive in bursts and used to stack up timeouts
    if (scorePulseTimer) clearTimeout(scorePulseTimer);
    scorePulseTimer = setTimeout(() => {
        scoreEl.classList.remove('pulse');
        scorePulseTimer = null;
    }, 150);
}

export function updateHighScore(highscore) {
    highscoreEl.textContent = `hi: ${highscore}`;
}

export function updateLives(lives) {
    for (let i = 0; i < 3; i++) {
        if (i < lives) {
            livesEls[i].classList.remove('lost');
            livesEls[i].classList.add('active');
        } else {
            livesEls[i].classList.remove('active');
            livesEls[i].classList.add('lost');
        }
    }
}

// Called every frame while ghosting — only touches the DOM when something moves
export function showGhostIndicator(timeRemaining, totalDuration) {
    if (!ghostVisible) {
        ghostIndicator.classList.remove('hidden');
        ghostVisible = true;
    }
    // Update the ring (stroke-dashoffset from 0 to circumference)
    const circumference = 100.53; // 2 * PI * 16
    const offset = circumference * (1 - timeRemaining / totalDuration);
    // Skip sub-pixel writes; each one costs a style recalc
    if (Math.abs(offset - lastRingOffset) < 0.6) return;
    lastRingOffset = offset;
    ghostTimerRing.style.strokeDashoffset = offset;
}

export function hideGhostIndicator() {
    if (!ghostVisible) return;
    ghostIndicator.classList.add('hidden');
    ghostVisible = false;
    lastRingOffset = -1;
}

export function showLevelUp(level) {
    levelUpTextEl.innerHTML = `level<br>${level}`;
    levelUpEl.classList.remove('hidden');

    // Re-trigger animation
    levelUpTextEl.style.animation = 'none';
    levelUpTextEl.offsetHeight; // Force reflow
    levelUpTextEl.style.animation = '';

    setTimeout(() => {
        levelUpEl.classList.add('hidden');
    }, 3000);
}

export function showHUD() {
    document.getElementById('hud').classList.remove('hidden');
}

export function hideHUD() {
    document.getElementById('hud').classList.add('hidden');
}

export function showTitleScreen(highscore) {
    titleScreen.classList.remove('hidden');
    titleHighscore.textContent = `high score: ${highscore}`;
}

export function hideTitleScreen() {
    titleScreen.classList.add('hidden');
}

export function showGameOver(score, highscore) {
    gameOverScreen.classList.remove('hidden');
    finalScore.textContent = score;
    finalHighscore.textContent = `best: ${highscore}`;
}

export function hideGameOver() {
    gameOverScreen.classList.add('hidden');
}

export function screenShake() {
    if (shakeTimer) {
        clearTimeout(shakeTimer);
        gameContainer.classList.remove('screen-shake');
        void gameContainer.offsetWidth;   // restart the animation on a rapid second hit
    }
    gameContainer.classList.add('screen-shake');
    shakeTimer = setTimeout(() => {
        gameContainer.classList.remove('screen-shake');
        shakeTimer = null;
    }, 300);
}

// The flash overlay lives in the DOM permanently and is toggled by class.
// Creating/destroying a full-screen layer on every hit forced a fresh layout,
// paint and layer allocation at exactly the worst moment.
export function hitFlash() {
    if (flashTimer) {
        clearTimeout(flashTimer);
        hitFlashEl.classList.remove('active');
        void hitFlashEl.offsetWidth;
    }
    hitFlashEl.classList.add('active');
    flashTimer = setTimeout(() => {
        hitFlashEl.classList.remove('active');
        flashTimer = null;
    }, 300);
}

export function getRestartButton() { return gameOverScreen; }
export function getTitleScreen() { return titleScreen; }
