// sounds.js: the POS beep and chime, made with the Web Audio API, used by the checkout and the settings.

// The POS sounds, made with the Web Audio API (no sound files). A sound that can't play (no audio, or
// the browser hasn't allowed it yet) is simply skipped.

let context = null;

function audio() {
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    context = context ?? new Context();
    if (context.state === 'suspended') context.resume();
    return context;
  } catch {
    return null;
  }
}

// one short tone: frequency in Hz, start (seconds from now), length in seconds
function tone(frequency, start, length, volume = 0.15) {
  const ctx = audio();
  if (!ctx) return;
  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const from = ctx.currentTime + start;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    // a quick fade in and out, so it doesn't click
    gain.gain.setValueAtTime(0.0001, from);
    gain.gain.exponentialRampToValueAtTime(volume, from + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, from + length);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(from);
    oscillator.stop(from + length + 0.02);
  } catch {
    // no sound
  }
}

// a code or an item was scanned: one short beep
export function playBeep() {
  tone(1800, 0, 0.09);
}

// a sale was completed: two rising notes
export function playChime() {
  tone(660, 0, 0.18);
  tone(880, 0.16, 0.32);
}
