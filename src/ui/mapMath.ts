/**
 * Pure map math for the Strategy Map viewport: world↔screen projection,
 * diurnal lighting, desire-path alpha and archetype colors.
 * Extracted from StrategyMapCanvas so the canvas owns only drawing/interaction.
 */
import type { ColonistArchetype } from '../engine/colony';

export interface ViewportState {
  width: number;
  height: number;
  panX: number;
  panY: number;
  zoom: number;
}

export interface DiurnalLighting {
  ambientAlpha: number;
  colorTint: string;
  isNight: boolean;
  hearthRadiusPx: number;
}

/**
 * World coordinate (wx, wy) in meters to Screen coordinate (sx, sy) in pixels.
 */
export function worldToScreen(
  wx: number,
  wy: number,
  viewport: ViewportState,
): { x: number; y: number } {
  const centerX = viewport.width / 2 + viewport.panX;
  const centerY = viewport.height / 2 + viewport.panY;
  return {
    x: centerX + wx * viewport.zoom,
    y: centerY + wy * viewport.zoom,
  };
}

/**
 * Screen coordinate (sx, sy) in pixels to World coordinate (wx, wy) in meters.
 */
export function screenToWorld(
  sx: number,
  sy: number,
  viewport: ViewportState,
): { x: number; y: number } {
  const centerX = viewport.width / 2 + viewport.panX;
  const centerY = viewport.height / 2 + viewport.panY;
  return {
    x: (sx - centerX) / viewport.zoom,
    y: (sy - centerY) / viewport.zoom,
  };
}

/**
 * Computes diurnal ambient alpha, color tint, night status, and camp hearth glow radius from minuteOfDay (0..1440).
 */
export function computeDiurnalLighting(minuteOfDay: number): DiurnalLighting {
  const normMinute = ((minuteOfDay % 1440) + 1440) % 1440;
  // 720 = noon, 0/1440 = midnight. Distance from noon: 0 at noon, 720 at midnight.
  const distFromNoon = Math.abs(normMinute - 720); // 0 (noon) .. 720 (midnight)
  const darknessFactor = distFromNoon / 720; // 0.0 (noon) .. 1.0 (midnight)

  // Non-linear twilight curve: sharp transition around dawn (360) and dusk (1080)
  // At noon (0.0): alpha ~ 0.05
  // At midnight (1.0): alpha ~ 0.65
  const ambientAlpha = 0.05 + Math.pow(darknessFactor, 1.8) * 0.6;
  const isNight = darknessFactor > 0.55;

  // Color tint: warm amber dawn/dusk, slate midnight
  let colorTint = 'rgba(10, 14, 24, 0.4)';
  if (normMinute >= 300 && normMinute <= 450) {
    // Dawn: golden amber
    colorTint = 'rgba(224, 164, 88, 0.25)';
  } else if (normMinute >= 1020 && normMinute <= 1170) {
    // Dusk: reddish violet
    colorTint = 'rgba(180, 80, 60, 0.25)';
  } else if (isNight) {
    // Midnight: deep slate navy
    colorTint = 'rgba(8, 12, 22, 0.55)';
  } else {
    // Daytime: subtle sunlight warmth
    colorTint = 'rgba(255, 245, 220, 0.05)';
  }

  // Hearth radius expands visually at night as contrast increases
  const hearthRadiusPx = 60 + darknessFactor * 60; // 60px noon -> 120px midnight

  return {
    ambientAlpha,
    colorTint,
    isNight,
    hearthRadiusPx,
  };
}

/**
 * Maps desire path wear [0, 255] to an alpha blend value for rendering trampled tracks.
 */
export function computeDesirePathAlpha(wear: number): number {
  if (wear <= 0) return 0;
  const clamped = Math.min(255, Math.max(0, wear));
  return (clamped / 255) * 0.75;
}

/**
 * Returns distinct archetype token color for map visualization.
 * Uses perceptual oklch colors matching CSS tokens.
 */
export function getArchetypeColor(archetype: ColonistArchetype): string {
  switch (archetype) {
    case 'FORAGER':
      return 'oklch(0.70 0.150 160)'; // Leaf green — nominal status
    case 'MINER':
      return 'oklch(0.70 0.150 75)'; // Brass/amber — primary accent
    case 'HERBALIST':
      return 'oklch(0.65 0.120 180)'; // Sage/teal — accent-2
    case 'APPRENTICE_CHEMIST':
      return 'oklch(0.60 0.180 280)'; // Violet/amethyst
    default:
      return 'oklch(0.98 0.002 265)'; // Telemetry text
  }
}

/**
 * Returns biome fill color as oklch string for canvas rendering.
 * Matches CSS custom properties for perceptual consistency.
 */
export function getBiomeColor(biome: string): string {
  switch (biome) {
    case 'HEARTH':
      return 'oklch(0.45 0.120 35)';
    case 'ROCKS_MINERALS':
      return 'oklch(0.28 0.040 265)';
    case 'MUSHROOMS_FLORA':
      return 'oklch(0.30 0.060 300)';
    case 'ANIMALS':
      return 'oklch(0.26 0.045 40)';
    case 'WATER':
      return 'oklch(0.20 0.030 240)';
    case 'SALT_FLAT':
      return 'oklch(0.42 0.010 265)';
    case 'BRINE_POND':
      return 'oklch(0.18 0.035 250)';
    case 'ANCIENT_RUIN':
      return 'oklch(0.32 0.050 310)';
    default:
      return 'oklch(0.05 0.000 0)';
  }
}

/**
 * Returns road wear color for desire paths.
 */
export function getRoadWearColor(): string {
  return 'oklch(0.70 0.150 75 / 0.4)';
}

/**
 * Returns unrevealed (fog of war) biome color.
 */
export function getUnrevealedColor(): string {
  return 'oklch(0.05 0.000 0)';
}

// ---------------------------------------------------------------------------
// M1 Task 10 — map feedback drive helpers (pure, frame-rate independent)
// ---------------------------------------------------------------------------

/** Maximum pooled sprite draws per frame (smoke, fog, gait accents, rings). */
export const MAX_SPRITE_DRAWS = 200;

/** uTime value whose cosine is 0 → pose factor 0.5 (reduced-motion midpoint freeze). */
export const FROZEN_TIME = Math.PI / 2;

/**
 * Clamp devicePixelRatio to [1, 2] (HiDPI precedent from LabBench3DCanvas).
 */
export function clampDpr(dpr: number): number {
  if (!Number.isFinite(dpr) || dpr <= 0) return 1;
  return Math.min(2, Math.max(1, dpr));
}

/**
 * Exponential decay towards a target — frame-rate independent.
 * Mirrors kinetic.expDecay so map pose blends share LabBench semantics.
 */
export function expDecay(current: number, target: number, decay: number, dt: number): number {
  const safeDt = Math.max(0, dt);
  return target + (current - target) * Math.exp(-decay * safeDt);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Biome sway amplitude in CSS px: tree/bush/water/crystal loops at 2-4px.
 */
export function getBiomeSwayAmplitudePx(biome: string): number {
  switch (biome) {
    case 'WATER':
    case 'BRINE_POND':
      return 4;
    case 'TREES':
    case 'ANIMALS':
      return 3.5;
    case 'MUSHROOMS_FLORA':
      return 2.5;
    case 'ROCKS_MINERALS':
    case 'HEARTH':
    case 'ANCIENT_RUIN':
      return 2;
    default:
      return 2.5;
  }
}

/**
 * Vertex-offset loop for a biome node (screen-space), 2-4px amplitude.
 * `seed` perturbs phase so neighbouring nodes do not sway in unison.
 * `timeSec` is FROZEN_TIME when reduced-motion is on (pose 0.5 midpoint).
 */
export function getBiomeSwayOffset(
  timeSec: number,
  biome: string,
  seed: number,
): { dx: number; dy: number } {
  const amp = getBiomeSwayAmplitudePx(biome);
  const phase = seed * 0.7;
  const freq = biome === 'WATER' || biome === 'BRINE_POND' ? 0.9 : 0.6;
  return {
    dx: Math.sin(timeSec * Math.PI * freq + phase) * amp,
    dy: Math.cos(timeSec * Math.PI * freq * 0.8 + phase * 1.3) * amp * 0.5,
  };
}

export type PoseStatus = 'IDLE' | 'TRAVELING' | 'GATHERING' | 'RETURNING' | 'STRIKE' | 'RESTING' | string;
export type StimulantPhase = 'BOOST' | 'CRASH' | null;

export interface ColonistPose {
  /** Vertical bob offset in px (walk cycle). */
  bobPx: number;
  /** Horizontal lean offset in px (harvest reach). */
  leanPx: number;
  /** Token radius scale (surge stretch / crash slump). */
  radiusScale: number;
  /** Alpha multiplier (crash slump dims the token). */
  alpha: number;
  /** Gait frequency multiplier (surge +20-55% / crash -5-25%). */
  gaitScale: number;
}

/**
 * Colonist gait from ColonyState + stimulant pharmacokinetics.
 * Walk (TRAVELING/RETURNING) bobs, harvest (GATHERING) leans, idle breathes.
 * Surge gait derives from speedMultiplier so map matches colony exactly:
 * +25%/+35%/+55% boost → gaitScale 1.20-1.55; 0.85/0.80/0.75 crash → 0.75-0.95.
 * Crash slump sags bob/lean and dims alpha.
 */
export function getColonistPose(
  status: PoseStatus,
  stimulantPhase: StimulantPhase,
  stimulantMultiplier: number,
  timeSec: number,
): ColonistPose {
  const mult = Number.isFinite(stimulantMultiplier) ? stimulantMultiplier : 1;
  const gaitScale = stimulantPhase === 'BOOST'
    ? clamp(mult, 1.2, 1.55)
    : stimulantPhase === 'CRASH'
      ? clamp(mult, 0.75, 0.95)
      : 1;

  const isWalk = status === 'TRAVELING' || status === 'RETURNING';
  const isHarvest = status === 'GATHERING';
  const isStrike = status === 'STRIKE';
  const crashSlump = stimulantPhase === 'CRASH' ? 1 : 0;
  const slumpFactor = 1 - crashSlump * 0.4;

  if (isWalk) {
    const phase = timeSec * Math.PI * 1.6 * gaitScale;
    return {
      bobPx: Math.sin(phase) * 1.6 * slumpFactor,
      leanPx: Math.cos(phase * 0.5) * 0.8,
      radiusScale: 1 + (gaitScale - 1) * 0.4 - crashSlump * 0.1,
      alpha: 1 - crashSlump * 0.25,
      gaitScale,
    };
  }
  if (isHarvest) {
    const phase = timeSec * Math.PI * 0.9 * gaitScale;
    return {
      bobPx: Math.sin(phase) * 0.6 * slumpFactor,
      leanPx: Math.sin(phase) * 2.2 * slumpFactor,
      radiusScale: 1 + (gaitScale - 1) * 0.3 - crashSlump * 0.08,
      alpha: 1 - crashSlump * 0.15,
      gaitScale,
    };
  }
  if (isStrike) {
    return { bobPx: 0, leanPx: Math.sin(timeSec * Math.PI * 0.5) * 0.4, radiusScale: 0.95, alpha: 0.75, gaitScale: 1 };
  }
  // IDLE / RESTING / unknown — breathing sway only.
  return {
    bobPx: Math.sin(timeSec * Math.PI * 0.5) * 0.5 * slumpFactor,
    leanPx: 0,
    radiusScale: 1 - crashSlump * 0.05,
    alpha: 1 - crashSlump * 0.1,
    gaitScale,
  };
}

/**
 * expDecay pose blend step: smooth a scalar pose channel toward its target
 * over `dt` seconds. Reduced-motion passes dt=0 (frozen posed frame).
 */
export function blendPose(current: number, target: number, decay: number, dt: number): number {
  return expDecay(current, target, decay, dt);
}

export interface HearthPulse {
  /** Pulsed glow radius (scaled by diurnal hearthRadiusPx). */
  radiusPx: number;
  /** Glow alpha envelope (0..1). */
  glowAlpha: number;
  /** Smoke rise height in px. */
  smokePx: number;
}

/**
 * Hearth smoke/glow envelope scaled by computeDiurnalLighting.hearthRadiusPx.
 * Pulse rides on the diurnal radius so night glow reads larger + warmer.
 */
export function getHearthPulse(timeSec: number, hearthRadiusPx: number): HearthPulse {
  const flicker = 0.85 + 0.15 * Math.sin(timeSec * 4.5);
  const drift = Math.sin(timeSec * 0.7) * 0.5 + 0.5;
  return {
    radiusPx: hearthRadiusPx * (0.9 + 0.1 * flicker),
    glowAlpha: 0.7 + 0.3 * drift,
    smokePx: hearthRadiusPx * (0.6 + 0.2 * drift),
  };
}

/**
 * Pooled fog-sweep sprite position: drifts across the viewport on a loop.
 * `widthPx` is the viewport width; `seed` staggers concurrent wisps.
 */
export function getFogSweep(timeSec: number, widthPx: number, seed: number): { x: number; alpha: number } {
  const span = Math.max(1, widthPx) + 200;
  const speed = 0.05 + (Math.abs(seed) % 10) * 0.004;
  const x = ((timeSec * speed * span + seed * 137) % span + span) % span - 100;
  const edge = Math.min(x + 100, span - 100 - x) / 100;
  return { x, alpha: clamp(edge, 0, 1) * 0.14 };
}

/**
 * Timing ring strike shrink: outer → inner over progress 0..1.
 */
export function getTimingRingRadius(progress: number, outerRadius: number, innerRadius: number): number {
  const p = clamp(progress, 0, 1);
  return Math.max(1, outerRadius - p * (outerRadius - innerRadius));
}
