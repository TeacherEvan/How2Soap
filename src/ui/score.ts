/**
 * Generative Adaptive Web Audio Score Engine
 * Pure synthesized Web Audio API - Zero assets, zero external deps.
 *
 * Implements the 3 themes outlined in docs/plans/2026-11-04-how2soap-contender-plan.md:
 * 1. Hearth Theme: Dorian mode (D3, E3, F3, G3, A3, B3, C4), warm low sub-drone + sparse meditative plucks.
 * 2. Crisis Theme: Phrygian dominant tension (D3, Eb3, F#3, G3, A3, Bb3, C4), driving pulse + dissonant ostinato.
 * 3. Victory Theme: Major-pentatonic lift (D4, E4, F#4, A4, B4), bright bell-like harmonics.
 */

export type ScoreTheme = 'hearth' | 'crisis' | 'victory' | 'silent';

export interface ScoreState {
  theme: ScoreTheme;
  enabled: boolean;
  gain: number;
}

// Frequencies for D Dorian (root D3 = 146.83 Hz)
const DORIAN_SCALE = [146.83, 164.81, 174.61, 196.0, 220.0, 246.94, 261.63, 293.66];
// Frequencies for D Phrygian Dominant (root D3 = 146.83 Hz)
const PHRYGIAN_DOM_SCALE = [146.83, 155.56, 185.0, 196.0, 220.0, 233.08, 261.63, 293.66];
// Frequencies for D Major Pentatonic (root D4 = 293.66 Hz)
const PENTATONIC_SCALE = [293.66, 329.63, 369.99, 440.0, 493.88, 587.33];

class GenerativeScoreEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentTheme: ScoreTheme = 'hearth';
  private isEnabled: boolean = true;
  private timerId: number | null = null;
  private step: number = 0;
  private droneOsc: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;

  constructor() {
    // Respect prefers-reduced-motion / accessibility
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('how2soap_score_enabled');
      if (saved !== null) {
        this.isEnabled = saved === 'true';
      }
    }
  }

  private initContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.isEnabled ? 0.25 : 0;
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('how2soap_score_enabled', String(enabled));
    }
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(enabled ? 0.25 : 0, now + 1.0);
    }
    if (enabled && !this.timerId) {
      this.start();
    } else if (!enabled) {
      this.stopDrone();
    }
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  public setTheme(theme: ScoreTheme): void {
    if (this.currentTheme === theme) return;
    this.currentTheme = theme;
    this.step = 0;
    this.updateDrone();
  }

  public getTheme(): ScoreTheme {
    return this.currentTheme;
  }

  public start(): void {
    const context = this.initContext();
    if (!context) return;
    if (this.timerId) return;

    this.startDrone();
    this.tick();
  }

  public stop(): void {
    if (this.timerId) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.stopDrone();
  }

  private startDrone(): void {
    if (!this.ctx || !this.masterGain || this.droneOsc || !this.isEnabled) return;
    try {
      const now = this.ctx.currentTime;
      this.droneOsc = this.ctx.createOscillator();
      this.droneGain = this.ctx.createGain();

      this.droneOsc.type = 'sawtooth';
      // Low sub D2 (73.42 Hz)
      this.droneOsc.frequency.setValueAtTime(73.42, now);

      // Low-pass filter for warmth
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, now);

      this.droneGain.gain.setValueAtTime(0.001, now);
      this.droneGain.gain.exponentialRampToValueAtTime(0.08, now + 3);

      this.droneOsc.connect(filter);
      filter.connect(this.droneGain);
      this.droneGain.connect(this.masterGain);

      this.droneOsc.start(now);
    } catch {
      // Audio autoplay policy or teardown
    }
  }

  private updateDrone(): void {
    if (!this.ctx || !this.droneOsc || !this.droneGain) return;
    const now = this.ctx.currentTime;
    if (this.currentTheme === 'crisis') {
      // Phrygian tension: pitch drone up to D2 + slight detune
      this.droneOsc.frequency.exponentialRampToValueAtTime(73.42 * 1.059, now + 1.5);
      this.droneGain.gain.linearRampToValueAtTime(0.12, now + 1.0);
    } else if (this.currentTheme === 'victory') {
      this.droneOsc.frequency.exponentialRampToValueAtTime(146.83, now + 1.0);
      this.droneGain.gain.linearRampToValueAtTime(0.06, now + 1.0);
    } else {
      this.droneOsc.frequency.exponentialRampToValueAtTime(73.42, now + 2.0);
      this.droneGain.gain.linearRampToValueAtTime(0.08, now + 2.0);
    }
  }

  private stopDrone(): void {
    if (this.droneOsc && this.droneGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.droneGain.gain.setValueAtTime(this.droneGain.gain.value, now);
        this.droneGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
        this.droneOsc.stop(now + 1.6);
      } catch {
        // Ignored
      }
      this.droneOsc = null;
      this.droneGain = null;
    }
  }

  private playPluck(freq: number, durationSec = 1.8, type: OscillatorType = 'triangle'): void {
    if (!this.ctx || !this.masterGain || !this.isEnabled) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + durationSec + 0.05);
    } catch {
      // AudioContext suspended or inactive
    }
  }

  private tick = (): void => {
    if (!this.isEnabled) {
      this.timerId = window.setTimeout(this.tick, 2000);
      return;
    }

    if (!this.droneOsc) {
      this.startDrone();
    }

    let intervalMs = 2400;

    switch (this.currentTheme) {
      case 'hearth': {
        // Meditative, sparse Dorian plucks every 1.8 - 3.2s
        const noteIdx = Math.floor(Math.random() * DORIAN_SCALE.length);
        const freq = DORIAN_SCALE[noteIdx];
        this.playPluck(freq, 2.2, 'sine');
        intervalMs = 1800 + Math.random() * 1600;
        break;
      }
      case 'crisis': {
        // Driving, urgent Phrygian pulse every 600 - 900ms
        const noteIdx = this.step % PHRYGIAN_DOM_SCALE.length;
        const freq = PHRYGIAN_DOM_SCALE[noteIdx];
        this.playPluck(freq, 0.7, 'sawtooth');
        intervalMs = 700;
        this.step++;
        break;
      }
      case 'victory': {
        // Uplifting pentatonic arpeggios
        const noteIdx = this.step % PENTATONIC_SCALE.length;
        const freq = PENTATONIC_SCALE[noteIdx];
        this.playPluck(freq, 1.4, 'triangle');
        intervalMs = 900;
        this.step++;
        break;
      }
      case 'silent':
      default:
        intervalMs = 3000;
        break;
    }

    this.timerId = window.setTimeout(this.tick, intervalMs);
  };
}

export const score = new GenerativeScoreEngine();
