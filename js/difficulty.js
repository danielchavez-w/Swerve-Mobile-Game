// Difficulty scaling based on cumulative score

const LEVELS = [
    { minScore: 0, level: 1, name: 'Easy', speedMultiplier: 1.0 },
    { minScore: 150, level: 2, name: 'Medium', speedMultiplier: 1.15 },
    { minScore: 600, level: 3, name: 'Hard', speedMultiplier: 1.3 },
    { minScore: 1500, level: 4, name: 'Very Hard', speedMultiplier: 1.5 },
    { minScore: 3000, level: 5, name: 'Extreme', speedMultiplier: 1.7 }
];

let currentLevel = 1;

export function getDifficultyForScore(score) {
    let matched = LEVELS[0];
    for (const l of LEVELS) {
        if (score >= l.minScore) {
            matched = l;
        }
    }
    return matched;
}

export function checkLevelUp(score) {
    const diff = getDifficultyForScore(score);
    if (diff.level > currentLevel) {
        currentLevel = diff.level;
        return diff;
    }
    return null;
}

export function getCurrentLevel() { return currentLevel; }
export function getSpeedMultiplier(score) {
    return getDifficultyForScore(score).speedMultiplier;
}

export function resetDifficulty() {
    currentLevel = 1;
}
