/**
 * Web Audio Synthesizer & Soundscape Engine
 * 100% synthesized procedural sound - 0 asset payload
 */

export function sliderToGain(sliderValue: number): number {
  if (Number.isNaN(sliderValue)) return 0;
  const clamped = Math.max(0, Math.min(100, sliderValue));
  return clamped / 100;
}

let ctx: AudioContext | null = null;
const gains = {
  master: null as GainNode | null,
  sfx: null as GainNode | null,
  ambient: null as GainNode | null,
};

let ambientRunning = false;

const ensure = (): AudioContext => {
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
  return ctx!;
};

const tone = (
  freq: number,
  type: OscillatorType,
  dur: number,
  targetGain: GainNode,
  peak = 0.5,
): void => {
  const context = ensure();
  if (!context || !targetGain) return;

  const osc = context.createOscillator();
  const env = context.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, context.currentTime);

  osc.connect(env);
  env.connect(targetGain);

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
): void => {
  const context = ensure();
  if (!context || !targetGain) return;

  const bufferSize = Math.floor(context.sampleRate * dur);
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noiseSource = context.createBufferSource();
  noiseSource.buffer = buffer;

  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(lowpassFreq, context.currentTime);

  const env = context.createGain();
  const now = context.currentTime;
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(peak, now + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  noiseSource.connect(filter);
  filter.connect(env);
  env.connect(targetGain);

  noiseSource.start(now);
  noiseSource.stop(now + dur + 0.02);
};

function startAmbientCrackle(): void {
  if (ambientRunning || !ctx || !gains.ambient) return;
  ambientRunning = true;

  const schedulePop = () => {
    if (!ctx || !ambientRunning || !gains.ambient) return;
    const dur = 0.02 + Math.random() * 0.04;
    const freq = 400 + Math.random() * 800;
    const peak = 0.05 + Math.random() * 0.12;
    noise(dur, gains.ambient, freq, peak);

    const nextDelayMs = 250 + Math.random() * 700;
    setTimeout(schedulePop, nextDelayMs);
  };

  schedulePop();
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
  harvestThud(): void {
    if (!ensure() || !gains.sfx) return;
    noise(0.12, gains.sfx, 240, 0.5);
  },

  clink(): void {
    if (!ensure() || !gains.sfx) return;
    tone(1560, 'square', 0.05, gains.sfx, 0.14);
    tone(2340, 'square', 0.03, gains.sfx, 0.08);
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
};
