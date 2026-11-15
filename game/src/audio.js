// Starlight Salvage — sound.
// Every effect is synthesized with the Web Audio API: short oscillator blips
// and filtered noise bursts, so the game ships no audio files at all. The
// audio context is created lazily on the first user gesture (browsers block
// sound before one), and M toggles mute.

import { AUDIO } from './config.js';

let context = null;
let master = null;
let muted = false;
let ambientNodes = null;

function ensureContext() {
  if (context) return context;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  context = new AudioContext();
  master = context.createGain();
  master.gain.value = muted ? 0 : AUDIO.masterVolume;
  master.connect(context.destination);
  return context;
}

// Call from any user gesture (click, key press) so the browser lets sound play.
export function unlockAudio() {
  const ctx = ensureContext();
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : AUDIO.masterVolume;
  return muted;
}

export function isMuted() {
  return muted;
}

function blip({ frequency = 440, endFrequency = null, duration = 0.12, type = 'sine', volume = 0.5, delay = 0 }) {
  const ctx = ensureContext();
  if (!ctx || muted) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (endFrequency !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function noiseBurst({ duration = 0.3, volume = 0.5, lowpass = 1200, delay = 0 }) {
  const ctx = ensureContext();
  if (!ctx || muted) return;
  const start = ctx.currentTime + delay;
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(start);
}

export const sfx = {
  pickup(comboStep = 1) {
    // Pitch climbs with the combo so a streak sounds like a streak.
    const base = 520 + Math.min(comboStep, 8) * 45;
    blip({ frequency: base, endFrequency: base * 1.6, duration: 0.09, type: 'sine', volume: 0.35 });
  },
  relic() {
    blip({ frequency: 392, duration: 0.12, type: 'triangle', volume: 0.5 });
    blip({ frequency: 587, duration: 0.14, type: 'triangle', volume: 0.5, delay: 0.09 });
    blip({ frequency: 784, duration: 0.22, type: 'triangle', volume: 0.5, delay: 0.18 });
  },
  shoot() {
    blip({ frequency: 880, endFrequency: 320, duration: 0.07, type: 'square', volume: 0.12 });
  },
  explosion(big = false) {
    noiseBurst({ duration: big ? 0.55 : 0.3, volume: big ? 0.6 : 0.4, lowpass: big ? 900 : 1600 });
    blip({ frequency: 160, endFrequency: 40, duration: big ? 0.5 : 0.3, type: 'sawtooth', volume: 0.3 });
  },
  hit() {
    noiseBurst({ duration: 0.18, volume: 0.45, lowpass: 700 });
    blip({ frequency: 220, endFrequency: 70, duration: 0.2, type: 'sawtooth', volume: 0.35 });
  },
  droneShot() {
    blip({ frequency: 300, endFrequency: 180, duration: 0.1, type: 'square', volume: 0.14 });
  },
  waveClear() {
    blip({ frequency: 523, duration: 0.12, type: 'triangle', volume: 0.4 });
    blip({ frequency: 659, duration: 0.12, type: 'triangle', volume: 0.4, delay: 0.1 });
    blip({ frequency: 784, duration: 0.24, type: 'triangle', volume: 0.45, delay: 0.2 });
  },
  waveStart() {
    blip({ frequency: 196, endFrequency: 392, duration: 0.35, type: 'sawtooth', volume: 0.25 });
  },
  buy() {
    blip({ frequency: 660, duration: 0.08, type: 'triangle', volume: 0.4 });
    blip({ frequency: 990, duration: 0.12, type: 'triangle', volume: 0.4, delay: 0.07 });
  },
  denied() {
    blip({ frequency: 180, endFrequency: 120, duration: 0.16, type: 'square', volume: 0.25 });
  },
  gameOver() {
    blip({ frequency: 392, duration: 0.25, type: 'triangle', volume: 0.4 });
    blip({ frequency: 311, duration: 0.25, type: 'triangle', volume: 0.4, delay: 0.22 });
    blip({ frequency: 233, duration: 0.5, type: 'triangle', volume: 0.4, delay: 0.44 });
  },
  click() {
    blip({ frequency: 700, duration: 0.05, type: 'sine', volume: 0.25 });
  },
};

// A quiet two-oscillator pad that drifts under the title screen and the game.
// Started once, stopped never; its gain is low enough to sit behind the sfx.
export function startAmbient() {
  const ctx = ensureContext();
  if (!ctx || ambientNodes) return;
  const gain = ctx.createGain();
  gain.gain.value = 0.05;
  gain.connect(master);
  const oscA = ctx.createOscillator();
  oscA.type = 'sine';
  oscA.frequency.value = 110;
  const oscB = ctx.createOscillator();
  oscB.type = 'sine';
  oscB.frequency.value = 164.8;
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.02;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);
  oscA.connect(gain);
  oscB.connect(gain);
  oscA.start();
  oscB.start();
  lfo.start();
  ambientNodes = { gain, oscA, oscB, lfo };
}
