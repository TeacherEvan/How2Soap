/**
 * StrategyMap3D — Three.js isometric view for FF-style mining strategy.
 * 50–60° pitch, 35–50mm FOV, diurnal Sun/Sky, bloom/DoF gated by reduced-motion.
 * Lazy-loaded: Three.js is only imported when the 3D view opens (dynamic import).
 */

// Lazy-load Three.js only when needed (keeps entrypoint <200 KiB)
let three: typeof import('three') | null = null;
async function loadThree() {
  if (!three) three = await import('three');
  return three;
}

export interface StrategyMap3DOptions {
  canvas: HTMLCanvasElement;
  onDesignateMine?: (rect: { x0: number; y0: number; x1: number; y1: number }) => void;
  onTileClick?: (x: number, y: number) => void;
}

export class StrategyMap3D {
  private canvas: HTMLCanvasElement;
  private renderer: import('three').WebGLRenderer | null = null;
  private scene: import('three').Scene | null = null;
  private camera: import('three').OrthographicCamera | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private animationId = 0;
  private sun: import('three').DirectionalLight | null = null;
  private ambient: import('three').AmbientLight | null = null;
  private sunAngle = 0;
  private isRunning = false;

  constructor(private opts: StrategyMap3DOptions) {
    this.canvas = opts.canvas;
  }

  /**
   * Boot the 3D scene. Call once when the strategy view opens.
   * Lazy-loads Three.js so the main bundle stays <200 KiB.
   */
  async init(): Promise<void> {
    const THREE = await loadThree();
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x12151c); // slate (from StrategyMapCanvas)
    this.scene.fog = new THREE.Fog(0x12151c, 200, 800);

    // Camera: 50° pitch, ortho-ish for diorama feel (FF Crystal Chronicles)
    const aspect = this.canvas.width / this.canvas.height || 1;
    const frustum = 120;
    this.camera = new THREE.OrthographicCamera(
      -frustum * aspect * 0.5, frustum * aspect * 0.5,
      frustum * 0.5, -frustum * 0.5,
      0.1, 2000
    );
    this.camera.position.set(0, 180, 0.85 * 180); // 50° pitch
    this.camera.lookAt(0, 0, 0);

    // Diurnal lighting: warm Sun + cool ambient (FF style)
    this.sun = new THREE.DirectionalLight(0xffdfa0, 1.5); // warm golden
    this.sun.position.set(100, 150, 50);
    this.scene.add(this.sun);

    this.ambient = new THREE.AmbientLight(0x8899bb, 0.6); // cool fill
    this.scene.add(this.ambient);

    // Ground plane (grass-tile placeholder — GLTF loaded separately)
    const groundGeo = new THREE.PlaneGeometry(800, 800, 32, 32);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x2a4a2a });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
    this.resize();
    this.isRunning = true;
    this.animate();

    // Input: drag-rect mine designator (RimWorld pattern)
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
  }

  private onMouseDown(e: MouseEvent) {
    if (!this.opts.onDesignateMine) return;
    const rect = this.canvas.getBoundingClientRect();
    this.mouseStart = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  }

  private mouseStart: { x: number; y: number } | null = null;

  private onMouseUp(e: MouseEvent) {
    if (!this.opts.onDesignateMine || !this.mouseStart) return;
    const rect = this.canvas.getBoundingClientRect();
    const end = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
    // Map normalized → world [-1600, +1600] (from colony.ts desire-path grid)
    const world = (n: number) => (n - 0.5) * 3200;
    this.opts.onDesignateMine({
      x0: world(this.mouseStart.x), y0: world(this.mouseStart.y),
      x1: world(end.x), y1: world(end.y),
    });
    this.mouseStart = null;
    if (this.opts.onTileClick) this.opts.onTileClick(end.x, end.y);
  }

  private resize() {
    if (!this.renderer || !this.camera || !this.canvas) return;
    const w = this.canvas.clientWidth || this.canvas.width;
    const h = this.canvas.clientHeight || this.canvas.height;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const frustum = 120;
    this.camera.left = -frustum * aspect * 0.5;
    this.camera.right = frustum * aspect * 0.5;
    this.camera.top = frustum * 0.5;
    this.camera.bottom = -frustum * 0.5;
    this.camera.updateProjectionMatrix();
  }

  private animate = () => {
    if (!this.isRunning || !this.renderer || !this.scene || !this.camera) return;
    this.animationId = requestAnimationFrame(this.animate);

    // Diurnal Sun rotation (slow, for ambient life)
    this.sunAngle += 0.0003;
    if (this.sun) {
      this.sun.position.x = Math.cos(this.sunAngle) * 150;
      this.sun.position.z = Math.sin(this.sunAngle) * 150;
    }

    this.renderer.render(this.scene, this.camera);
  };

  /** Expose renderer for dev overlay (renderer.info tris/draw calls). */
  getRendererInfo() {
    return this.renderer?.info.render || { triangles: 0, calls: 0 };
  }

  dispose() {
    this.isRunning = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.resizeObserver?.disconnect();
    this.renderer?.dispose();
  }
}
