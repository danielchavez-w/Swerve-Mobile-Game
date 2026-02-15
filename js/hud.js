let scoreEl, highscoreEl, livesEls, ghostIndicator, ghostTimerRing;
let levelUpEl, levelUpTextEl;
let titleScreen, titleHighscore, tapToStart;
let gameOverScreen, finalScore, finalHighscore, restartBtn;

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
}

export function updateScore(score) {
    scoreEl.textContent = score;
    scoreEl.classList.add('pulse');
    setTimeout(() => scoreEl.classList.remove('pulse'), 150);
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

export function showGhostIndicator(timeRemaining, totalDuration) {
    ghostIndicator.classList.remove('hidden');
    // Update the ring (stroke-dashoffset from 0 to circumference)
    const circumference = 100.53; // 2 * PI * 16
    const offset = circumference * (1 - timeRemaining / totalDuration);
    ghostTimerRing.style.strokeDashoffset = offset;
}

export function hideGhostIndicator() {
    ghostIndicator.classList.add('hidden');
}

export function showLevelUp(level) {
    levelUpTextEl.textContent = `level ${level}`;
    levelUpEl.classList.remove('hidden');

    // Re-trigger animation
    levelUpTextEl.style.animation = 'none';
    levelUpTextEl.offsetHeight; // Force reflow
    levelUpTextEl.style.animation = '';

    setTimeout(() => {
        levelUpEl.classList.add('hidden');
    }, 1500);
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
    const container = document.getElementById('game-container');
    container.classList.add('screen-shake');
    setTimeout(() => container.classList.remove('screen-shake'), 300);
}

export function hitFlash() {
    const flash = document.createElement('div');
    flash.id = 'hit-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 300);
}

export function getRestartButton() { return gameOverScreen; }
export function getTitleScreen() { return titleScreen; }
