// Audio module — optional sound effects using Web Audio API

let audioCtx;
let masterGain;
let initialized = false;

export function initAudio() {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.3;
        masterGain.connect(audioCtx.destination);
        initialized = true;
    } catch (e) {
        console.warn('Web Audio API not available');
    }
}

export function resumeAudio() {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(freq, duration, type = 'sine', volume = 0.2) {
    if (!initialized) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
}

export function playCollectSound() {
    playTone(880, 0.1, 'sine', 0.15);
    setTimeout(() => playTone(1100, 0.1, 'sine', 0.1), 50);
}

export function playDiamondSound() {
    playTone(660, 0.15, 'sine', 0.2);
    setTimeout(() => playTone(880, 0.15, 'sine', 0.15), 80);
    setTimeout(() => playTone(1320, 0.2, 'sine', 0.1), 160);
}

export function playHoopSound() {
    playTone(440, 0.2, 'triangle', 0.2);
    setTimeout(() => playTone(660, 0.2, 'triangle', 0.15), 100);
    setTimeout(() => playTone(880, 0.3, 'triangle', 0.1), 200);
}

export function playHitSound() {
    playTone(150, 0.3, 'sawtooth', 0.3);
    playTone(100, 0.4, 'square', 0.1);
}

export function playGameOverSound() {
    playTone(440, 0.3, 'sawtooth', 0.2);
    setTimeout(() => playTone(330, 0.3, 'sawtooth', 0.2), 200);
    setTimeout(() => playTone(220, 0.5, 'sawtooth', 0.15), 400);
}

export function playLevelUpSound() {
    playTone(523, 0.15, 'sine', 0.2);
    setTimeout(() => playTone(659, 0.15, 'sine', 0.2), 100);
    setTimeout(() => playTone(784, 0.15, 'sine', 0.2), 200);
    setTimeout(() => playTone(1047, 0.3, 'sine', 0.15), 300);
}

export function playBoostSound() {
    if (!initialized) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.3);
}
