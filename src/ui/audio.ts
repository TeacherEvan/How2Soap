/**
 * Web Audio Synthesizer & Soundscape Engine
 * 100% synthesized procedural sound - 0 asset payload
 */

export function sliderToGain(sliderValue: number): number {
  if (Number.isNaN(sliderValue)) return 0;
  const clamped = Math.max(0, Math.min(100, sliderValue));
  return clamped / 100;
}

/**
 * Maps world X coordinate in meters [-maxDistanceMeters, maxDistanceMeters]
 * to stereo panning [-1.0, 1.0], clamping values exceeding the threshold.
 */
export function worldXToPan(worldX: number, maxDistanceMeters = 1600): number {
  if (Number.isNaN(worldX)) return 0;
  if (!Number.isFinite(worldX)) return worldX > 0 ? 1.0 : -1.0;
  if (maxDistanceMeters <= 0) return 0;
  const raw = worldX / maxDistanceMeters;
  return Math.max(-1.0, Math.min(1.0, raw));
}

let ctx: AudioContext | null = null;
const gains = {
  master: null as GainNode | null,
  sfx: null as GainNode | null,
  ambient: null as GainNode | null,
};

let ambientRunning = false;

// Shared white noise buffer for procedural noise effects
let cachedNoiseBuffer: AudioBuffer | null = null;

const getNoiseBuffer = (context: AudioContext): AudioBuffer => {
  if (cachedNoiseBuffer && cachedNoiseBuffer.sampleRate === context.sampleRate) {
    return cachedNoiseBuffer;
  }
  const bufferSize = Math.floor(context.sampleRate * 2); // 2 seconds of reusable noise
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  cachedNoiseBuffer = buffer;
  return buffer;
};

const ensure = (): AudioContext | null => {
  if (!ctx && typeof window !== 'undefined') {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      ctx = new AudioCtx();
      gains.master = ctx.createGain();
      gains.sfx = ctx.createGain();
      gains.ambient = ctx.createGain();

      gains.master.gain.value = 0.8;
      gains.sfx.gain.value = 0.6;
      gains.ambient.gain.value = 0.15;

      gains.sfx.connect(gains.master);
      gains.ambient.connect(gains.master);
      gains.master.connect(ctx.destination);

      startAmbientCrackle();
    }
  }
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
};

const createPanner = (context: AudioContext, pan?: number): StereoPannerNode | null => {
  if (pan === undefined || typeof context.createStereoPanner !== 'function') {
    return null;
  }
  try {
    const panner = context.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), context.currentTime);
    return panner;
  } catch {
    return null;
  }
};

const tone = (
  freq: number,
  type: OscillatorType,
  dur: number,
  targetGain: GainNode,
  peak = 0.5,
  pan?: number,
): void => {
  const context = ensure();
  if (!context || !targetGain) return;

  const osc = context.createOscillator();
  const env = context.createGain();
  const panner = createPanner(context, pan);

  osc.type = type;
  osc.frequency.setValueAtTime(freq, context.currentTime);

  osc.connect(env);
  if (panner) {
    env.connect(panner);
    panner.connect(targetGain);
  } else {
    env.connect(targetGain);
  }

  const now = context.currentTime;
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(peak, now + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  osc.start(now);
  osc.stop(now + dur + 0.03);
};

const noise = (
  dur: number,
  targetGain: GainNode,
  lowpassFreq = 800,
  peak = 0.4,
  pan?: number,
): void => {
  const context = ensure();
  if (!context || !targetGain) return;

  const buffer = getNoiseBuffer(context);
  const noiseSource = context.createBufferSource();
  noiseSource.buffer = buffer;

  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(lowpassFreq, context.currentTime);

  const env = context.createGain();
  const panner = createPanner(context, pan);

  const now = context.currentTime;
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(peak, now + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  noiseSource.connect(filter);
  filter.connect(env);
  if (panner) {
    env.connect(panner);
    panner.connect(targetGain);
  } else {
    env.connect(targetGain);
  }

  noiseSource.start(now);
  noiseSource.stop(now + dur + 0.02);
};

function startAmbientCrackle(): void {
  if (ambientRunning || !ctx || !gains.ambient) return;
  // Gate on document visibility and master gain
  if (document.visibilityState !== 'visible' || gains.master?.gain.value === 0) {
    return;
  }
  ambientRunning = true;

  const schedulePop = () => {
    if (!ctx || !ambientRunning || !gains.ambient) return;
    // Respect visibility and mute
    if (document.visibilityState !== 'visible' || gains.master?.gain.value === 0) {
      return;
    }
    const dur = 0.02 + Math.random() * 0.04;
    const freq = 400 + Math.random() * 800;
    const peak = 0.05 + Math.random() * 0.12;
    noise(dur, gains.ambient, freq, peak);

    const nextDelayMs = 250 + Math.random() * 700;
    setTimeout(schedulePop, nextDelayMs);
  };

  schedulePop();
}

// Resume ambient on visibility change (browser only)
if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && gains.master && gains.master.gain.value > 0) {
      startAmbientCrackle();
    }
  });
}

export const audio = {
  setChannel(ch: 'master' | 'sfx' | 'ambient', v: number): void {
    ensure();
    const g = gains[ch];
    if (g && ctx) {
      g.gain.setValueAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime);
    }
  },

  unlock(): void {
    ensure();
  },

  // SFX vocabulary
  harvestThud(worldX?: number): void {
    if (!ensure() || !gains.sfx) return;
    const pan = worldX !== undefined ? worldXToPan(worldX) : undefined;
    noise(0.12, gains.sfx, 240, 0.5, pan);
  },

  clink(worldX?: number): void {
    if (!ensure() || !gains.sfx) return;
    const pan = worldX !== undefined ? worldXToPan(worldX) : undefined;
    tone(1560, 'square', 0.05, gains.sfx, 0.14, pan);
    tone(2340, 'square', 0.03, gains.sfx, 0.08, pan);
  },

  chime(): void {
    if (!ensure() || !gains.sfx) return;
    [523.25, 659.25, 783.99].forEach((f, i) =>
      setTimeout(() => tone(f, 'sine', 0.5, gains.sfx!, 0.3), i * 90),
    );
  },

  levelUp(): void {
    if (!ensure() || !gains.sfx) return;
    [392, 523.25, 659.25, 783.99].forEach((f, i) =>
      setTimeout(() => tone(f, 'triangle', 0.42, gains.sfx!, 0.32), i * 110),
    );
  },

  munch(): void {
    if (!ensure() || !gains.sfx) return;
    noise(0.05, gains.sfx, 1600, 0.22);
    setTimeout(() => {
      if (gains.sfx) noise(0.05, gains.sfx, 1300, 0.18);
    }, 90);
  },

  stamp(): void {
    if (!ensure() || !gains.sfx) return;
    noise(0.09, gains.sfx, 300, 0.5);
  },

  sealDone(): void {
    if (!ensure() || !gains.sfx) return;
    tone(880, 'sine', 0.6, gains.sfx, 0.3);
  },

  toll(): void {
    if (!ensure() || !gains.sfx) return;
    tone(110, 'sine', 2.4, gains.sfx, 0.5);
  },

  victory(): void {
    if (!ensure() || !gains.sfx) return;
    [261.63, 329.63, 392, 523.25, 659.25].forEach((f, i) =>
      setTimeout(() => tone(f, 'triangle', 0.9, gains.sfx!, 0.3), i * 160),
    );
  },

  /**
   * Procedural recruit fanfare: brassy fifth chord fanfare with optional stereo panner.
   */
  recruitHorn(worldX?: number): void {
    if (!ensure() || !gains.sfx) return;
    const pan = worldX !== undefined ? worldXToPan(worldX) : undefined;
    // Brassy fanfare: Root (220Hz), Fifth (330Hz), Octave (440Hz)
    tone(220, 'sawtooth', 0.4, gains.sfx, 0.25, pan);
    setTimeout(() => {
      if (gains.sfx) tone(330, 'sawtooth', 0.45, gains.sfx, 0.28, pan);
    }, 120);
    setTimeout(() => {
      if (gains.sfx) tone(440, 'triangle', 0.7, gains.sfx, 0.32, pan);
    }, 240);
  },

  /**
   * Procedural wage payment clink: high metallic coin resonance.
   */
  wageClink(worldX?: number): void {
    if (!ensure() || !gains.sfx) return;
    const pan = worldX !== undefined ? worldXToPan(worldX) : undefined;
    tone(1760, 'square', 0.08, gains.sfx, 0.18, pan);
    setTimeout(() => {
      if (gains.sfx) tone(2637, 'sine', 0.12, gains.sfx, 0.15, pan);
    }, 40);
    setTimeout(() => {
      if (gains.sfx) tone(3520, 'sine', 0.2, gains.sfx, 0.1, pan);
    }, 90);
  },

  /**
   * Procedural stimulant dosing shimmer: rising shimmering arpeggio.
   */
  stimulantShimmer(): void {
    if (!ensure() || !gains.sfx) return;
    const freqs = [587.33, 739.99, 880.0, 1174.66, 1479.98];
    freqs.forEach((freq, idx) => {
      setTimeout(() => {
        if (gains.sfx) tone(freq, 'sine', 0.35, gains.sfx, 0.16);
      }, idx * 45);
    });
  },

  /**
   * Procedural strike warning bell: dissonant tolling bell with long low decay.
   */
  strikeBell(worldX?: number): void {
    if (!ensure() || !gains.sfx) return;
    const pan = worldX !== undefined ? worldXToPan(worldX) : undefined;
    // Dissonant interval (130Hz and 138.59Hz minor second beating)
    tone(130, 'triangle', 1.8, gains.sfx, 0.35, pan);
    tone(138.59, 'sine', 1.8, gains.sfx, 0.3, pan);
    noise(0.08, gains.sfx, 450, 0.25, pan);
  },

  /**
   * Tactile solenoid latch click for physical button depressions & toggles.
   */
  uiLatchClick(pitch = 1.0): void {
    if (!ensure() || !gains.sfx) return;
    tone(2400 * pitch, 'square', 0.015, gains.sfx, 0.12);
    setTimeout(() => {
      if (gains.sfx) tone(4800 * pitch, 'sine', 0.02, gains.sfx, 0.08);
    }, 8);
  },

  /**
   * Heavy mechanical pneumatic air-vent/hiss for window opening and aperture transitions.
   */
  uiHeavyVent(): void {
    if (!ensure() || !gains.sfx) return;
    noise(0.18, gains.sfx, 650, 0.2);
    tone(140, 'triangle', 0.22, gains.sfx, 0.15);
  },

  /**
   * Resonant alchemical bell ping for discoveries and completed crafts.
   */
  uiMetalPing(): void {
    if (!ensure() || !gains.sfx) return;
    tone(1046.5, 'sine', 0.45, gains.sfx, 0.22);
    tone(2093, 'triangle', 0.35, gains.sfx, 0.14);
  },
};
