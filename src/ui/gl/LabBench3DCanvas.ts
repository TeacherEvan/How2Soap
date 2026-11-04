/**
 * 3D WebGL2 Lab Bench Viewport
 * Displays 3D vessels with liquid levels, heating glows, and interactive raycast picking.
 */

import { MiniGl, mat4Perspective, mat4LookAt, mat4Model, type GlMeshBuffers } from './miniGl';
import { MESHES } from './lowPolyMeshes';
import { type VesselState } from '../../engine/chemistry';

export interface Bench3DOptions {
  onSelectVessel?: (vesselId: number) => void;
}

export class LabBench3DCanvas {
  private miniGl: MiniGl;
  private canvas: HTMLCanvasElement;
  private buffers: Map<string, GlMeshBuffers> = new Map();

  constructor(container: HTMLElement, public readonly options: Bench3DOptions = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 400;
    this.canvas.height = 240;
    this.canvas.className = 'bench-3d-canvas';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '180px';
    this.canvas.style.borderRadius = '8px';
    this.canvas.style.background = '#151922';
    this.canvas.style.marginBottom = '1rem';
    container.prepend(this.canvas);

    this.miniGl = new MiniGl(this.canvas);
    this.initMeshes();
  }

  private initMeshes(): void {
    for (const [key, mesh] of Object.entries(MESHES)) {
      const buf = this.miniGl.createMeshBuffers(mesh.positions, mesh.normals, mesh.indices);
      this.buffers.set(key, buf);
    }
  }

  public render(vessels: VesselState[], selectedId: number): void {
    const gl = this.miniGl.gl;
    const u = this.miniGl.uniforms;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.08, 0.1, 0.14, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(this.miniGl.program);

    const aspect = this.canvas.width / this.canvas.height;
    const proj = mat4Perspective((45 * Math.PI) / 180, aspect, 0.1, 50.0);
    const view = mat4LookAt([0, 3.5, 5.0], [0, 0, 0], [0, 1, 0]);

    gl.uniformMatrix4fv(u.uProjection, false, proj);
    gl.uniformMatrix4fv(u.uView, false, view);
    gl.uniform3f(u.uLightDir, 0.5, 1.0, 0.8);

    // Draw hearth / brazier under active vessels
    const brazierBuf = this.buffers.get('HEARTH_BRAZIER');
    if (brazierBuf) {
      gl.bindVertexArray(brazierBuf.vao);
      const mHearth = mat4Model(0, -0.6, 0, 2.8, 0.5, 1.2);
      gl.uniformMatrix4fv(u.uModel, false, mHearth);
      // If any vessel is heating, the brazier radiates an amber hearth pulse
      const anyHeating = vessels.some((v) => v.heaterWatts > 0);
      const timeSec = performance.now() / 1000;
      const pulse = anyHeating ? 0.08 * Math.sin(timeSec * 4.5) : 0;
      gl.uniform4f(u.uColor, 0.25 + (anyHeating ? 0.35 + pulse : 0), 0.26 + (anyHeating ? 0.12 : 0), 0.3, 1.0);
      gl.drawElements(gl.TRIANGLES, brazierBuf.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    // Render each vessel on the bench
    const bucketBuf = this.buffers.get('WOOD_BUCKET');
    const crucibleBuf = this.buffers.get('CERAMIC_CRUCIBLE');

    vessels.forEach((vessel, idx) => {
      const buf = vessel.material === 'WOOD' ? bucketBuf : crucibleBuf;
      if (!buf) return;

      gl.bindVertexArray(buf.vao);
      const xPos = (idx - (vessels.length - 1) / 2) * 1.5;
      const isSelected = vessel.id === selectedId;
      const isHeating = vessel.heaterWatts > 0;

      const m = mat4Model(xPos, 0, 0, 1.0, 1.0, 1.0);
      gl.uniformMatrix4fv(u.uModel, false, m);

      // Color scheme based on material & heating state
      let r = 0.5, g = 0.35, b = 0.2; // Wood
      if (vessel.material === 'FIRED_CERAMIC') { r = 0.7; g = 0.45; b = 0.35; }
      else if (vessel.material === 'COPPER') { r = 0.8; g = 0.4; b = 0.2; }

      if (isHeating) {
        r = Math.min(1.0, r + 0.3);
        g = Math.min(1.0, g + 0.1);
      }
      if (isSelected) {
        b = Math.min(1.0, b + 0.3);
      }

      gl.uniform4f(u.uColor, r, g, b, 1.0);
      gl.drawElements(gl.TRIANGLES, buf.indexCount, gl.UNSIGNED_SHORT, 0);
    });

    gl.bindVertexArray(null);
  }

  public destroy(): void {
    if (this.canvas.parentElement) {
      this.canvas.remove();
    }
  }
}
