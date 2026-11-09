/**
 * 3D WebGL2 Lab Bench Viewport — M1 Task 9 experiment drive.
 * Renders vessels with kinetic feedback loops driven by VesselState (+ optional
 * KettleState from the soap-kettle mini-game):
 *  - liquid-fill morph scaleY from moles via exponential decay (liquidVolumeL/capacityL)
 *  - heating glow envelope = f(heaterWatts, temperatureK), expDecay-smoothed
 *  - boilover shake above 105°C (spring envelope × 40Hz carrier) + boil bubbles
 *  - stir vortex weight = tracePct/100 while STIRRING (uPoseWeight + yaw spin)
 *  - pour stream ribbon visible while POURING, length from lye+fat fill
 * All blends use kinetic.expDecay / stepSpringSubstepped with dt in seconds.
 * Loops freeze at the cosine midpoint (uTime = PI/2) when
 * prefers-reduced-motion is set; DPR is clamped to [1, 2] in resizeCanvas();
 * the canvas reserves a fixed 180px CSS height so mounting never causes CLS.
 *
 * Sprite-free drive: src/assets/sprites/*.png (flame 512x512 / ember / fume /
 * bubbles atlas) are NOT imported here. miniGl exposes no texture sampler
 * pipeline (uColor-only shader), and the entrypoint has ~9KB headroom under the
 * 200000B hints:error budget — a WebGL texture upload path would cost far more
 * than it returns. Boil bubbles and the pour stream are procedural quads
 * shaded with uColor instead, keeping this canvas inside the lazy chunk.
 */

import { MiniGl, mat4Perspective, mat4LookAt, mat4Model, type GlMeshBuffers } from './miniGl';
import { MESHES } from './lowPolyMeshes';
import { expDecay, stepSpringSubstepped } from './kinetic';
import { BAKED_CLIPS, type AnimationClip } from './bakedClips';
import { liquidVolumeL, type VesselState } from '../../engine/chemistry';
import type { KettleDriveState } from '../SoapKettleMiniGame';

export interface Bench3DOptions {
  onSelectVessel?: (vesselId: number) => void;
}

/** Boilover threshold in °C — mirrors SoapKettleMiniGame (visual only). */
const BOILOVER_C = 105;
/** uTime value whose cosine is 0 → pose factor 0.5 (reduced-motion midpoint freeze). */
const FROZEN_TIME = Math.PI / 2;

/**
 * AnimationPlayer — samples baked per-vertex Float32Array frames from BAKED_CLIPS.
 * Runs on dt in seconds; freezes at FROZEN_TIME under prefers-reduced-motion.
 */
class AnimationPlayer {
  private clip: AnimationClip | null = null;
  private timeSec = 0;
  private frame = 0;
  private reduced = false;

  constructor(reducedMotion: boolean) {
    this.reduced = reducedMotion;
  }

  setClip(name: string): void {
    this.clip = BAKED_CLIPS[name] ?? null;
    this.timeSec = 0;
    this.frame = 0;
  }

  setReducedMotion(reduced: boolean): void {
    this.reduced = reduced;
  }

  /** Advance by dt seconds; returns current frame's Float32Array or null. */
  advance(dt: number): Float32Array | null {
    if (!this.clip) return null;
    if (this.reduced) {
      this.timeSec = FROZEN_TIME;
    } else {
      this.timeSec += dt;
    }
    const frameFloat = this.timeSec * this.clip.fps;
    const frameCount = this.clip.frames.length;
    this.frame = this.clip.loop
      ? Math.floor(frameFloat) % frameCount
      : Math.min(Math.floor(frameFloat), frameCount - 1);
    return this.clip.frames[this.frame];
  }

  getCurrentFrame(): Float32Array | null {
    if (!this.clip) return null;
    return this.clip.frames[this.frame];
  }

  get fps(): number {
    return this.clip?.fps ?? 0;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Column-major model matrix with a Y-rotation folded in (miniGl is untouched). */
function mat4ModelRotY(
  tx: number, ty: number, tz: number,
  sx: number, sy: number, sz: number, rotY: number,
): Float32Array {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const out = new Float32Array(16);
  out[0] = c * sx; out[1] = 0; out[2] = -s * sz; out[3] = 0;
  out[4] = 0; out[5] = sy; out[6] = 0; out[7] = 0;
  out[8] = s * sx; out[9] = 0; out[10] = c * sz; out[11] = 0;
  out[12] = tx; out[13] = ty; out[14] = tz; out[15] = 1;
  return out;
}

interface FeedbackBuffers {
  pourStream: GlMeshBuffers;
  boilBubble: GlMeshBuffers;
}

export class LabBench3DCanvas {
  private miniGl: MiniGl;
  private canvas: HTMLCanvasElement;
  private buffers: Map<string, GlMeshBuffers> = new Map();
  private feedback: FeedbackBuffers | null = null;
  private animationPlayers: Map<string, AnimationPlayer> = new Map();

  private lastVessels: VesselState[] = [];
  private lastSelectedId = -1;
  private lastKettle: KettleDriveState | null = null;
  private lastRenderMs: number | null = null;
  private animTimeSec = 0;
  private rafId: number | null = null;
  private destroyed = false;

  private reducedMotion = false;
  private mediaQuery: MediaQueryList | null = null;
  private readonly onMediaChange = (): void => {
    this.onReducedMotionChange();
  };
  private readonly onResize = (): void => {
    this.resizeCanvas();
  };
  private readonly onClick = (event: MouseEvent): void => {
    this.pickVessel(event);
  };

  /** Exponential-decay smoothed scalars keyed by vessel id. */
  private smoothedGlow = new Map<number, number>();
  private smoothedFill = new Map<number, number>();
  private smoothedVortex = new Map<number, number>();
  private smoothedPour = new Map<number, number>();
  /** Boilover shake springs (x position / velocity) keyed by vessel id. */
  private shakeSpring = new Map<number, { pos: number; vel: number }>();

  constructor(container: HTMLElement, public readonly options: Bench3DOptions = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 400;
    this.canvas.height = 240;
    this.canvas.className = 'bench-3d-canvas';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', '3D vessel diorama — click a vessel to select it');
    this.canvas.dataset.testid = 'bench-3d-canvas';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '180px';
    this.canvas.style.borderRadius = '8px';
    this.canvas.style.background = '#151922';
    this.canvas.style.marginBottom = '1rem';
    this.canvas.style.display = 'block';
    // Reserve bounds so the WebGL canvas never shifts layout (no CLS).
    container.style.minHeight = '180px';
    container.prepend(this.canvas);

    this.miniGl = new MiniGl(this.canvas);
    this.initMeshes();
    this.initFeedbackBuffers();
    this.initAnimationPlayers();

    // Reduced-motion freeze (matchMedia precedent from app/splash.ts).
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        this.mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.reducedMotion = this.mediaQuery.matches;
        if (typeof this.mediaQuery.addEventListener === 'function') {
          this.mediaQuery.addEventListener('change', this.onMediaChange);
        }
      } catch {
        /* matchMedia unavailable — animate normally */
      }
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', this.onResize);
    }
    this.canvas.addEventListener('click', this.onClick);
    this.resizeCanvas();
    this.startLoop();
  }

  private onReducedMotionChange(): void {
    this.reducedMotion = this.mediaQuery?.matches ?? false;
    // Propagate to animation players
    for (const player of this.animationPlayers.values()) {
      player.setReducedMotion(this.reducedMotion);
    }
  }

  private initAnimationPlayers(): void {
    // P0 fix: the old code constructed AnimationPlayer with clip=null and
    // never called setClip, so advance() always returned null and every
    // baked frame read fell back to procedural scalars. Arm each player
    // with its BAKED_CLIPS entry (unknown names leave clip null, safely).
    // Also note: advance() is called ONCE per tick in render() (loop at top);
    // do not call advance() again per-mesh or clips run at 2x speed.
    const names = [
      'hearth_flame',
      'bellows_pump',
      'boil_shake',
      'stir_vortex',
      'pour_stream',
      'liquid_fill',
      'crystal_shimmer',
    ];
    this.animationPlayers = new Map(names.map((n) => {
      const p = new AnimationPlayer(this.reducedMotion);
      p.setClip(n);
      return [n, p] as const;
    }));
  }

  private initMeshes(): void {
    for (const [key, mesh] of Object.entries(MESHES)) {
      const buf = this.miniGl.createMeshBuffers(mesh.positions, mesh.normals, mesh.indices);
      this.buffers.set(key, buf);
    }
  }

  /** Procedural pour-stream ribbon + boil-bubble quad (uColor-only, no textures). */
  private initFeedbackBuffers(): void {
    // Vertical ribbon 0.08 wide, 1.2 tall, base at origin (translated per-vessel).
    const pourPositions = new Float32Array([
      -0.04, 0, 0, 0.04, 0, 0, 0.04, 1.2, 0, -0.04, 0, 0, 0.04, 1.2, 0, -0.04, 1.2, 0,
    ]);
    const pourNormals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
    const pourIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    const pourStream = this.miniGl.createMeshBuffers(pourPositions, pourNormals, pourIndices);

    // Small quad for boil bubbles, base at origin.
    const bubblePositions = new Float32Array([
      -0.15, 0, 0, 0.15, 0, 0, 0.15, 0.2, 0, -0.15, 0, 0, 0.15, 0.2, 0, -0.15, 0.2, 0,
    ]);
    const bubbleNormals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
    const bubbleIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    const boilBubble = this.miniGl.createMeshBuffers(bubblePositions, bubbleNormals, bubbleIndices);

    this.feedback = { pourStream, boilBubble };
  }

  /** DPR-clamped resize matching StrategyMapCanvas.resizeCanvas()'s precedent. */
  public resizeCanvas(): void {
    const rect = this.canvas.getBoundingClientRect();
    const cssW = rect.width > 0 ? Math.round(rect.width) : 400;
    const cssH = rect.height > 0 ? Math.round(rect.height) : 180;
    const dpr = typeof window !== 'undefined'
      ? clamp(window.devicePixelRatio || 1, 1, 2)
      : 1;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
  }

  private startLoop(): void {
    if (typeof requestAnimationFrame !== 'function') return;
    const tick = (nowMs: number): void => {
      if (this.destroyed) return;
      try {
        this.render(this.lastVessels, this.lastSelectedId, this.lastKettle, nowMs);
      } catch {
        /* transient GL fault — skip frame */
      }
      if (!this.destroyed && typeof requestAnimationFrame === 'function') {
        this.rafId = requestAnimationFrame(tick);
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  /** Click-to-select via horizontal vessel spacing (preserves onSelectVessel wiring). */
  private pickVessel(event: MouseEvent): void {
    const callback = this.options.onSelectVessel;
    if (!callback || this.lastVessels.length === 0) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0) return;
    const fx = (event.clientX - rect.left) / rect.width;
    // Vessels sit at xPos = (idx - (n-1)/2) * 1.5; invert to fractional index.
    const fractional = ((fx - 0.5) * (this.canvas.width / this.canvas.height) * 5) / 1.5
      + (this.lastVessels.length - 1) / 2;
    const idx = Math.round(clamp(fractional, 0, this.lastVessels.length - 1));
    const vessel = this.lastVessels[idx];
    if (vessel) callback(vessel.id);
  }

  public render(
    vessels: VesselState[],
    selectedId: number,
    kettle: KettleDriveState | null = null,
    nowMs: number = typeof performance !== 'undefined' ? performance.now() : Date.now(),
  ): void {
    this.lastVessels = vessels;
    this.lastSelectedId = selectedId;
    this.lastKettle = kettle;

    // Frame-rate independent dt in seconds (expDecay handles its own floor;
    // the spring sub-steps internally and clamps to MAX_FRAME_DT).
    const dt = this.lastRenderMs === null
      ? 0
      : Math.max(0, (nowMs - this.lastRenderMs) / 1000);
    this.lastRenderMs = nowMs;

    if (this.reducedMotion) {
      this.animTimeSec = FROZEN_TIME;
    } else {
      this.animTimeSec += dt;
    }
    const timeSec = this.animTimeSec;

    // Advance all animation players
    for (const player of this.animationPlayers.values()) {
      player.advance(dt);
    }

    const gl = this.miniGl.gl;
    const u = this.miniGl.uniforms;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.08, 0.1, 0.14, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.miniGl.program);

    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const proj = mat4Perspective((45 * Math.PI) / 180, aspect, 0.1, 50.0);
    const view = mat4LookAt([0, 3.5, 5.0], [0, 0, 0], [0, 1, 0]);

    gl.uniformMatrix4fv(u.uProjection, false, proj);
    gl.uniformMatrix4fv(u.uView, false, view);
    gl.uniform3f(u.uLightDir, 0.5, 1.0, 0.8);
    gl.uniform1f(u.uTime, timeSec);

    const kettleFor = (): KettleDriveState | null =>
      kettle !== null && vessels.length === 1 ? kettle : null;

    // Smoothed heating-glow envelope per vessel: f(heaterWatts, temperatureK).
    // Computed once per vessel per frame (a single expDecay advance per dt).
    const glowById = new Map<number, number>();
    for (const vessel of vessels) {
      const k = kettleFor();
      const heaterWatts = k !== null ? k.heaterWatts : vessel.heaterWatts;
      const temperatureK = k !== null ? k.temperatureC + 273.15 : vessel.temperatureK;
      const heaterNorm = clamp(heaterWatts / 1200, 0, 1);
      const tempNorm = clamp((temperatureK - 273.15) / 100, 0, 1);
      const target = clamp(0.65 * heaterNorm + 0.35 * tempNorm, 0, 1);
      const prev = this.smoothedGlow.get(vessel.id) ?? 0;
      const next = expDecay(prev, target, 3, dt);
      this.smoothedGlow.set(vessel.id, next);
      glowById.set(vessel.id, next);
    }

    // Hearth flame animation (baked clip: hearth_flame) — drives brazier squash/glow
    const flamePlayer = this.animationPlayers.get('hearth_flame');
    const flameFrame = flamePlayer?.getCurrentFrame();
    let flameSquash = 1.0;
    let flameIntensity = 1.0;
    if (flameFrame && flameFrame.length >= 3) {
      // Frame data: per-vertex offsets; use first vertex Y for squash, Z for intensity
      flameSquash = 1.0 + flameFrame[1] * 0.3; // Y offset → vertical squash
      flameIntensity = 1.0 + Math.abs(flameFrame[2]) * 0.5; // Z offset → emission
    }

    // Draw hearth / brazier under active vessels — amber envelope with baked flame animation.
    // P0 fix: upload the current baked frame into the brazier's aAnimOffset buffer
    // (it was zero-filled before, so uPoseWeight did nothing). uPoseWeight rides
    // the decayed glow so the flame morph only shows when the hearth is hot; the
    // AnimationPlayer freeze at FROZEN_TIME keeps reduced-motion at a still frame.
    // Vessels share WOOD_BUCKET/CERAMIC_CRUCIBLE buffers, so they keep scalar drives
    // (fill/stir/boil below) rather than per-vessel vertex uploads — documented limit.
    const brazierBuf = this.buffers.get('HEARTH_BRAZIER');
    if (brazierBuf) {
      let glow = 0;
      for (const v of vessels) glow = Math.max(glow, glowById.get(v.id) ?? 0);
      if (flameFrame) {
        this.miniGl.updateAnimation(brazierBuf, flameFrame);
      }
      gl.bindVertexArray(brazierBuf.vao);
      const mHearth = mat4Model(0, -0.6, 0, 2.8, 0.5 * flameSquash, 1.2);
      gl.uniformMatrix4fv(u.uModel, false, mHearth);
      // Flicker rides on the decayed envelope (frozen automatically via timeSec).
      const flicker = 0.85 + 0.15 * Math.sin(timeSec * 4.5) * flameIntensity;
      gl.uniform1f(u.uPoseWeight, glow);
      gl.uniform4f(
        u.uColor,
        0.25 + glow * 0.75 * flicker,
        0.26 + glow * 0.32,
        0.3 + glow * 0.08,
        1.0,
      );
      gl.drawElements(gl.TRIANGLES, brazierBuf.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    // Render each vessel on the bench
    // NOTE: bellows_pump / crystal_shimmer players are advanced once in the
    // tick loop above. They have no dedicated mesh drawn here yet (bellows has
    // no hero mesh; BIOME_CRYSTAL is not drawn on the bench), so their frames
    // are correct but unrendered — do NOT advance them again here (that was
    // the old 2x-speed double-advance bug).
    const bucketBuf = this.buffers.get('WOOD_BUCKET');
    const crucibleBuf = this.buffers.get('CERAMIC_CRUCIBLE');

    // Liquid fill animation (baked clip: liquid_fill) — 90 frames at 30fps = 3s fill cycle
    const fillPlayer = this.animationPlayers.get('liquid_fill');

    // Stir vortex animation (baked clip: stir_vortex)
    const stirPlayer = this.animationPlayers.get('stir_vortex');

    // Boil shake animation (baked clip: boil_shake)
    const boilPlayer = this.animationPlayers.get('boil_shake');

    // Pour stream animation (baked clip: pour_stream) — includes UV flow in blender_only_channels
    const pourPlayer = this.animationPlayers.get('pour_stream');

    vessels.forEach((vessel, idx) => {
      const buf = vessel.material === 'WOOD' ? bucketBuf : crucibleBuf;
      if (!buf) return;

      gl.bindVertexArray(buf.vao);
      const xPos = (idx - (vessels.length - 1) / 2) * 1.5;
      const isSelected = vessel.id === selectedId;
      const k = kettleFor();

      // Liquid-fill morph: combine expDecay-smoothed fill with baked liquid_fill clip
      const liquidL = liquidVolumeL(vessel);
      let fillTarget = vessel.capacityL > 0 ? clamp(liquidL / vessel.capacityL, 0, 1) : 0;
      if (k !== null) {
        const pourTotal = clamp((k.lyeVolume + k.fatVolume) / 200, 0, 1);
        fillTarget = Math.max(fillTarget, pourTotal);
      }
      const prevFill = this.smoothedFill.get(vessel.id) ?? 0;
      const fill = expDecay(prevFill, fillTarget, 5, dt);
      this.smoothedFill.set(vessel.id, fill);

      // Sample baked liquid_fill clip for additional vertex morph detail
      const fillFrame = fillPlayer?.getCurrentFrame();
      let fillMorph = 1.0;
      if (fillFrame && fillFrame.length >= 3) {
        fillMorph = 1.0 + fillFrame[1] * 0.15; // Y offset as subtle fill ripple
      }

      // Stir vortex weight = tracePct/100 while STIRRING, else 0.
      const vortexTarget = k !== null && k.phase === 'STIRRING'
        ? clamp(k.tracePct / 100, 0, 1)
        : 0;
      const prevVortex = this.smoothedVortex.get(vessel.id) ?? 0;
      const vortex = expDecay(prevVortex, vortexTarget, 4, dt);
      this.smoothedVortex.set(vessel.id, vortex);

      // Sample baked stir_vortex clip for spoon rotation / vortex scale
      const stirFrame = stirPlayer?.getCurrentFrame();
      let stirScale = 1.0;
      if (stirFrame && stirFrame.length >= 3) {
        stirScale = 1.0 + stirFrame[0] * 0.1; // X as scale modulation
      }

      // Boilover shake envelope: spring toward (T-105°C)/25 above 105°C.
      const temperatureC = k !== null ? k.temperatureC : vessel.temperatureK - 273.15;
      const isBoiling = k !== null ? k.isBoilingOver : temperatureC > BOILOVER_C;
      const shakeTarget = isBoiling ? clamp((temperatureC - BOILOVER_C) / 25, 0, 1) : 0;
      const spring = this.shakeSpring.get(vessel.id) ?? { pos: 0, vel: 0 };
      const stepped = this.reducedMotion
        ? { pos: spring.pos, vel: spring.vel }
        : stepSpringSubstepped(spring.pos, spring.vel, shakeTarget, 120, 2 * Math.sqrt(120) * 0.5, dt);
      this.shakeSpring.set(vessel.id, stepped);
      const jitter = this.reducedMotion
        ? 0
        : stepped.pos * Math.sin(timeSec * 40) * 0.06;

      // Sample baked boil_shake clip for additional boil motion
      const boilFrame = boilPlayer?.getCurrentFrame();
      let boilJitterX = 0, boilJitterY = 0;
      if (boilFrame && boilFrame.length >= 6) {
        boilJitterX = boilFrame[0] * 0.02;
        boilJitterY = boilFrame[1] * 0.03;
      }

      const yaw = this.reducedMotion ? vortex * (Math.PI / 4) : vortex * timeSec * 1.5;
      const scaleY = (0.8 + 0.25 * fill) * fillMorph * stirScale;
      const m = mat4ModelRotY(xPos + jitter + boilJitterX, boilJitterY, 0, 1.0, scaleY, 1.0, yaw);
      gl.uniformMatrix4fv(u.uModel, false, m);
      gl.uniform1f(u.uPoseWeight, vortex);

      // Color scheme based on material & heating state
      let r = 0.5, g = 0.35, b = 0.2; // Wood
      if (vessel.material === 'FIRED_CERAMIC') { r = 0.7; g = 0.45; b = 0.35; }
      else if (vessel.material === 'COPPER') { r = 0.8; g = 0.4; b = 0.2; }

      const glow = glowById.get(vessel.id) ?? 0;
      r = Math.min(1.0, r + glow * 0.45);
      g = Math.min(1.0, g + glow * 0.18);
      // Kettle pour tint: lye blue vs fat amber blends with fill.
      if (k !== null && (k.lyeVolume > 0 || k.fatVolume > 0)) {
        const total = Math.max(1, k.lyeVolume + k.fatVolume);
        const lyeFrac = k.lyeVolume / total;
        r = r * (1 - fill * 0.3) + 1.0 * fill * 0.3 * (1 - lyeFrac);
        g = g * (1 - fill * 0.25) + 0.82 * fill * 0.25 * (1 - lyeFrac);
        b = b * (1 - fill * 0.3) + 0.65 * fill * 0.3 * lyeFrac;
      }
      if (isSelected) {
        b = Math.min(1.0, b + 0.3);
      }

      gl.uniform4f(u.uColor, r, g, b, 1.0);
      gl.drawElements(gl.TRIANGLES, buf.indexCount, gl.UNSIGNED_SHORT, 0);

      // NOTE: crystal_shimmer is advanced once in the tick loop above (not here;
      // the old per-vessel advance caused a double-step). BIOME_CRYSTAL has no
      // bench draw yet, so its baked emission-pulse offsets are data-correct but
      // unrendered until a crystal vessel type lands.

      // Procedural feedback quads (sprite-free).
      if (this.feedback) {
        const { pourStream, boilBubble } = this.feedback;

        // Pour stream: visible while POURING, length from lye+fat fill.
        // Enhance with baked pour_stream clip (UV flow from blender_only_channels)
        const pourTarget = k !== null && k.phase === 'POURING'
          ? clamp((k.lyeVolume + k.fatVolume) / 200, 0, 1)
          : 0;
        const prevPour = this.smoothedPour.get(vessel.id) ?? 0;
        const pour = expDecay(prevPour, pourTarget, 6, dt);
        this.smoothedPour.set(vessel.id, pour);

        const pourFrame = pourPlayer?.getCurrentFrame();
        let pourUVOffset = 0;
        if (pourFrame && pourFrame.length >= 3) {
          // blender_only_channels: curve.data.offset (UV ribbon flow) sampled at frames 1, 15, 30
          // Value goes 0.0 → 0.55 → 0.0 over 30 frames
          pourUVOffset = pourFrame[2] * 0.5; // Z as UV scroll proxy
        }

        if (pour > 0.02) {
          gl.bindVertexArray(pourStream.vao);
          const mPour = mat4Model(xPos + jitter + boilJitterX, 1.05, 0, 1.0, 0.4 + pour * 0.6, 1.0);
          gl.uniformMatrix4fv(u.uModel, false, mPour);
          gl.uniform1f(u.uPoseWeight, pourUVOffset); // Reuse uPoseWeight for UV flow
          // Lye-blue when lye is flowing, fat-amber when fat is flowing.
          const flowingLye = k !== null && k.lyeVolume >= k.fatVolume;
          gl.uniform4f(
            u.uColor,
            flowingLye ? 0.35 : 1.0,
            flowingLye ? 0.65 : 0.82,
            flowingLye ? 1.0 : 0.4,
            0.85,
          );
          gl.drawElements(gl.TRIANGLES, pourStream.indexCount, gl.UNSIGNED_SHORT, 0);
        }

        // Boil bubbles: two procedural quads bouncing above the rim.
        if (isBoiling && stepped.pos > 0.02) {
          const bounce = this.reducedMotion ? 0 : Math.sin(timeSec * 12) * 0.05;
          gl.bindVertexArray(boilBubble.vao);
          const mBubble = mat4Model(xPos + jitter + boilJitterX, 1.35 + bounce + boilJitterY, 0, 1.0 + stepped.pos, 1.0, 1.0);
          gl.uniformMatrix4fv(u.uModel, false, mBubble);
          gl.uniform1f(u.uPoseWeight, 0);
          gl.uniform4f(u.uColor, 1.0, 0.95, 0.85, 0.9);
          gl.drawElements(gl.TRIANGLES, boilBubble.indexCount, gl.UNSIGNED_SHORT, 0);
        }
      }
    });

    gl.bindVertexArray(null);
  }

  public destroy(): void {
    this.destroyed = true;
    if (this.rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('resize', this.onResize);
    }
    if (this.mediaQuery && typeof this.mediaQuery.removeEventListener === 'function') {
      this.mediaQuery.removeEventListener('change', this.onMediaChange);
    }
    this.canvas.removeEventListener('click', this.onClick);
    if (this.canvas.parentElement) {
      this.canvas.remove();
    }
  }
}
