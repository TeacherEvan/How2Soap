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
 */
export function getArchetypeColor(archetype: ColonistArchetype): string {
  switch (archetype) {
    case 'FORAGER':
      return '#7fc98b'; // Leaf green
    case 'MINER':
      return '#e0a458'; // Copper/amber ochre
    case 'HERBALIST':
      return '#5fb3a1'; // Sage / teal
    case 'APPRENTICE_CHEMIST':
      return '#9c88ff'; // Violet / amethyst
    default:
      return '#dce6ec';
  }
}
