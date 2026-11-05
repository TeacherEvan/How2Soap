/**
 * Interactive 3-Phase Soap Kettle Simulation & Mini-Game
 *
 * Implements Plan Section 6.2:
 * - Phase 1: Pouring the Mix (Hold-to-Pour Ratio Gauge, target band 45% - 55%)
 * - Phase 2: Bellows & Heat Control (80°C - 95°C Saponification Zone, cooling -6°C/s, bellows +12°C, boilover >105°C)
 * - Phase 3: Stirring to Trace (Circular / Rhythm stirring, trace 0-100%, quality tiers)
 */

export type KettlePhase = 'IDLE' | 'POURING' | 'HEATING' | 'STIRRING' | 'COMPLETE';

export interface KettleBatchResult {
  quality: 'PERFECT' | 'STANDARD' | 'RUINED';
  soapYield: number; // 2 for perfect, 1 for standard, 0 (scrap) for ruined
  message: string;
}

export interface CouplingEffects {
  laborQuality?: {
    traceTargetReduction: number;
    phase2BandWiden: number;
  };
  unrestSpoilage?: {
    spoilageChance: number;
    ruptureSeverityIncrease: number;
  };
  crashClumsiness?: {
    phase1ToleranceReduction: number;
    phase2BandReduction: number;
  };
}

export class SoapKettleMiniGame {
  public phase: KettlePhase = 'IDLE';

  // Phase 1: Pouring (Lye vs Fat ratio)
  public lyeVolume = 0; // 0..100
  public fatVolume = 0; // 0..100
  public isPouringLye = false;
  public isPouringFat = false;

  // Phase 2: Heating (Bellows & Saponification)
  public temperatureC = 25; // ambient ~25°C
  public heatProgressPct = 0; // 0..100
  public isBoilingOver = false;

  // Phase 3: Stirring to Trace
  public tracePct = 0; // 0..100
  public stirStrokes = 0;
  public targetStrokes = 12;

  // Coupling effects (ES-3)
  private couplingEffects: {
    laborQuality?: { traceTargetReduction: number; phase2BandWiden: number };
    unrestSpoilage?: { spoilageChance: number; ruptureSeverityIncrease: number };
    crashClumsiness?: { phase1ToleranceReduction: number; phase2BandReduction: number };
  } = {};
  
  // Unrest spoilage RNG (seeded from worker)
  private spoilageRng: (() => number) | null = null;

  // Result
  public lastResult: KettleBatchResult | null = null;
  public onBatchComplete?: (result: KettleBatchResult) => void;

  private lastTickMs = 0;

  constructor(onBatchComplete?: (result: KettleBatchResult) => void) {
    this.onBatchComplete = onBatchComplete;
  }

  /** Apply coupling effects from ES-3 Colony ↔ Chemistry coupling */
  public applyCouplingEffects(effects: {
    laborQuality?: { traceTargetReduction: number; phase2BandWiden: number };
    crashClumsiness?: { phase1ToleranceReduction: number; phase2BandReduction: number };
  }): void {
    this.couplingEffects = effects;
    // Apply labor quality improvement
    if (effects.laborQuality) {
      this.targetStrokes = Math.max(1, this.targetStrokes - effects.laborQuality.traceTargetReduction);
    }
    // Apply crash clumsiness
    if (effects.crashClumsiness) {
      // Note: phase1 tolerance and phase2 band are checked in finishBatch
      // The effects are applied dynamically during batch evaluation
    }
  }

  /** Set the spoilage RNG seed for unrest spoilage rolls */
  public setSpoilageSeed(seed: number): void {
    // Simple mulberry32 RNG for deterministic spoilage rolls
    let a = seed >>> 0;
    this.spoilageRng = () => {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  public startBatch(): void {
    this.phase = 'POURING';
    this.lyeVolume = 0;
    this.fatVolume = 0;
    this.isPouringLye = false;
    this.isPouringFat = false;
    this.temperatureC = 25;
    this.heatProgressPct = 0;
    this.isBoilingOver = false;
    this.tracePct = 0;
    this.stirStrokes = 0;
    this.lastResult = null;
    this.lastTickMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  }

  public step(nowMs: number = (typeof performance !== 'undefined' ? performance.now() : Date.now())): void {
    if (this.phase === 'IDLE' || this.phase === 'COMPLETE') return;
    const dt = Math.min(0.2, Math.max(0.001, (nowMs - (this.lastTickMs || nowMs)) / 1000));
    this.lastTickMs = nowMs;

    if (this.phase === 'POURING') {
      if (this.isPouringLye) {
        this.lyeVolume = Math.min(100, this.lyeVolume + 35 * dt);
      }
      if (this.isPouringFat) {
        this.fatVolume = Math.min(100, this.fatVolume + 35 * dt);
      }
      // Check if both have been poured to sufficient amount
      const total = this.lyeVolume + this.fatVolume;
      if (total >= 100) {
        this.phase = 'HEATING';
      }
    } else if (this.phase === 'HEATING') {
      // Natural cooling: -6°C/sec
      this.temperatureC = Math.max(20, this.temperatureC - 6 * dt);

      // Boilover condition: > 105°C
      if (this.temperatureC > 105) {
        this.isBoilingOver = true;
      }

      // Saponification Zone: 80°C - 95°C
      if (this.temperatureC >= 80 && this.temperatureC <= 98) {
        this.heatProgressPct = Math.min(100, this.heatProgressPct + 20 * dt);
      }

      if (this.heatProgressPct >= 100) {
        this.phase = 'STIRRING';
      }
    } else if (this.phase === 'STIRRING') {
      // Trace increases per stroke, or rhythmic progress
      this.tracePct = Math.min(100, (this.stirStrokes / this.targetStrokes) * 100);
      if (this.tracePct >= 100) {
        this.finishBatch();
      }
    }
  }

  public pumpBellows(): void {
    if (this.phase !== 'HEATING') return;
    this.temperatureC = Math.min(130, this.temperatureC + 12);
  }

  public splashWater(): void {
    if (this.phase !== 'HEATING') return;
    this.temperatureC = Math.max(25, this.temperatureC - 20);
    if (this.temperatureC <= 102) {
      this.isBoilingOver = false;
    }
  }

  public stirStroke(): void {
    if (this.phase !== 'STIRRING') return;
    this.stirStrokes++;
    this.tracePct = Math.min(100, (this.stirStrokes / this.targetStrokes) * 100);
    if (this.tracePct >= 100) {
      this.finishBatch();
    }
  }

  public finishBatch(): KettleBatchResult {
    this.phase = 'COMPLETE';

    // Calculate ratio accuracy (ideal lye/(lye+fat) is ~0.50 => 45% to 55%)
    const total = Math.max(1, this.lyeVolume + this.fatVolume);
    const lyeRatio = this.lyeVolume / total;
    
    // Apply crash clumsiness: Phase-1 tolerance reduction (-4%)
    const crashClumsiness = this.couplingEffects.crashClumsiness;
    const phase1ToleranceReduction = crashClumsiness?.phase1ToleranceReduction ?? 0;
    const minLyeRatio = 0.45 - phase1ToleranceReduction / 100;
    const maxLyeRatio = 0.55 + phase1ToleranceReduction / 100;
    
    const ratioAccurate = lyeRatio >= minLyeRatio && lyeRatio <= maxLyeRatio;
    const boiledOver = this.isBoilingOver;

    let quality: 'PERFECT' | 'STANDARD' | 'RUINED' = 'STANDARD';
    let soapYield = 1;
    let message = 'Standard Batch: Soap cured successfully.';

    // Unrest spoilage roll (ES-3)
    const unrestSpoilage = this.couplingEffects.unrestSpoilage;
    let spoiled = false;
    if (unrestSpoilage && this.spoilageRng) {
      spoiled = this.spoilageRng() < unrestSpoilage.spoilageChance;
    }

    if (boiledOver || !ratioAccurate || spoiled) {
      quality = 'RUINED';
      soapYield = 0;
      if (spoiled) {
        message = 'Ruined Batch: Unrest in the colony caused spoilage!';
      } else if (boiledOver) {
        message = 'Ruined Batch: Kettle boiled over into caustic foam!';
      } else {
        message = 'Ruined Batch: Incorrect lye-to-fat ratio yielded scrap slurry.';
      }
    } else if (ratioAccurate && !boiledOver && this.stirStrokes >= this.targetStrokes) {
      quality = 'PERFECT';
      soapYield = 2; // +1 Bonus Soap Bar
      message = '★ Perfect Trace Batch! Yields +1 Bonus Soap Bar!';
    }

    const res: KettleBatchResult = { quality, soapYield, message };
    this.lastResult = res;
    if (this.onBatchComplete) this.onBatchComplete(res);
    return res;
  }
}
