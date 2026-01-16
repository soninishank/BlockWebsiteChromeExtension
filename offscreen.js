// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'playSound') {
        playChime();
    }
});

function playChime() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Create a louder, sustained pleasant chime sound
    function playNote(freq, startTime, duration, volume = 0.6) {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        // Using Triangle wave for a richer, louder sound than Sine
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(freq, startTime);

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
    }

    const now = audioCtx.currentTime;

    // Create a 10-second repeating melody
    // Pattern: C5 - E5 - G5 - C6 (Ascending) repeated every 2 seconds
    const melody = [523.25, 659.25, 783.99, 1046.50];

    for (let i = 0; i < 5; i++) {
        const offset = i * 2; // Repeat every 2 seconds
        melody.forEach((freq, index) => {
            playNote(freq, now + offset + (index * 0.3), 1.0, 0.6);
        });
    }
}
