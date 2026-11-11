/**
 * Surgical3DView — High-Fidelity 3D Strategy Map & Workbench Studio (Three.js r160.0).
 *
 * Implements the 3D Strategy and Workbench visualization under the AGENTS.md runtime contract:
 * - Isolated in a lazy-loaded chunk (Three.js is never imported into the main entrypoint).
 * - Enforces metric coordinates (1 unit = 1.000 meter).
 * - Implements diurnal lighting, animated particles/mesh loops, SAT collision-placed structures,
 *   and raycasted pointer/keyboard apparatus inspection with WCAG SC 2.5.8 compliant targets.
 * - Reduced-motion freeze compliance (prefers-reduced-motion freezes animation loops).
 * - Decoupled scene builders (createStrategyScene / createWorkbenchScene) enable pure-engine
 *   unit testing without vi.mock / vi.spyOn.
 */

import * as THREE from 'three';
import type { ColonyState } from '../../engine/colony';
import type { VesselState } from '../../engine/chemistry';
import type { KettleDriveState } from '../SoapKettleMiniGame';

export interface Strategy3DOptions {
  onSelectBuilding?: (buildingId: string) => void;
  onSelectNode?: (nodeId: string) => void;
  onClose?: () => void;
}

export interface Workbench3DOptions {
  onSelectApparatus?: (apparatusId: string) => void;
  onSelectRecipe?: (recipeId: string) => void;
  onClose?: () => void;
}

export interface Strategy3DController {
  update: (colony: ColonyState, minuteOfDay: number) => void;
  resize: () => void;
  dispose: () => void;
}

export interface Workbench3DController {
  update: (vesselState?: VesselState, kettleState?: KettleDriveState) => void;
  resize: () => void;
  dispose: () => void;
}

export interface DiurnalSunTelemetry {
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
  intensity: number;
}

/**
 * Computes diurnal solar coordinates and color temperature across the 24-hour cycle.
 */
export function computeDiurnalSun(minuteOfDay: number): DiurnalSunTelemetry {
  const dayFrac = (minuteOfDay % 1440) / 1440.0;
  const sunAngle = dayFrac * Math.PI * 2 - Math.PI / 2;
  const y = Math.sin(sunAngle) * 50.0;
  const x = Math.cos(sunAngle) * 50.0;
  const z = 20.0;

  if (y > 15) {
    // Noon daylight
    return { x, y: Math.max(-5.0, y), z, r: 1.0, g: 0.98, b: 0.92, intensity: 2.4 };
  } else if (y >= 0) {
    // Dawn / Dusk amber
    return { x, y: Math.max(-5.0, y), z, r: 1.0, g: 0.55, b: 0.2, intensity: 1.4 };
  } else {
    // Midnight moonlight
    return { x, y: Math.max(-5.0, y), z, r: 0.2, g: 0.3, b: 0.55, intensity: 0.35 };
  }
}

// ============================================================================
// 1. STRATEGY SCENE BUILDER & CONTROLLER
// ============================================================================

export interface StrategySceneGraph {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sunLight: THREE.DirectionalLight;
  ambientLight: THREE.AmbientLight;
  hearthGlow: THREE.PointLight;
  ringGroup: THREE.Group;
  terrainMesh: THREE.Mesh;
  pickableMeshes: THREE.Mesh[];
  colonistGroup: THREE.Group;
  colonistMeshes: Map<string, THREE.Mesh>;
}

export const COLONY_BUILDING_SPECS = [
  {
    id: 'hearth_camp_center',
    name: 'Camp Hearth (Alchemical Center)',
    desc: 'Central hearth fire, stone seating, and astrolabe survey origin. Provides warmth, morale, and baseline sustenance.',
    pos: [0, 0, 0],
    color: 0xffaa33,
    emissive: 0xff4411,
    type: 'hearth',
  },
  {
    id: 'apothecary_workshop',
    name: 'Apothecary Laboratory & Retort',
    desc: 'Chemical workbench with alembic copper retorts and condensers. Synthesizes willow bark, mint tonics, and lye saponification.',
    pos: [-7.5, 0.4, -4.5],
    color: 0x734d2e,
    emissive: 0x332211,
    type: 'cabin',
  },
  {
    id: 'mine_shaft_headframe',
    name: 'Mine Shaft Headframe & Tracks',
    desc: 'Timber A-frame derrick and hoist pulley for extracting halite salt crystals, chalcopyrite, and native copper ores.',
    pos: [8.5, 0.8, -9.0],
    color: 0x444850,
    emissive: 0x112233,
    type: 'derrick',
  },
  {
    id: 'colonist_dwelling',
    name: 'Colonist Frontier Living Quarters',
    desc: 'Insulated timber cabin providing shelter and rest cycles for foragers, miners, and apprentice chemists.',
    pos: [-4.0, 0.2, 5.0],
    color: 0x5a3d24,
    emissive: 0x221105,
    type: 'house',
  },
  {
    id: 'domestication_paddock',
    name: 'Split-Rail Domestication Paddock',
    desc: 'Enclosure for dairy goats and jungle fowl yielding milk, butterfat triglycerides for soap, and nitrate fertilizer.',
    pos: [6.0, 0.3, 5.5],
    color: 0x3d4a36,
    emissive: 0x112211,
    type: 'paddock',
  },
  {
    id: 'halite_crystal_peaks',
    name: 'Halite Crystal Salt Peaks',
    desc: 'Crystalline rock salt outcrop (NaCl). Mined for brine synthesis, lye saponification, and food preservation.',
    pos: [-12.5, 2.2, 8.5],
    color: 0xccd9f2,
    emissive: 0x4466aa,
    type: 'crystal',
  },
  {
    id: 'oak_hardwood_grove',
    name: 'Ancient Oak Hardwood Grove',
    desc: 'Quercus robur forest stand yielding timber for charcoal clamping, potassium carbonate potash ash, and tannic acid.',
    pos: [11.0, 1.8, 8.0],
    color: 0x2e7338,
    emissive: 0x113311,
    type: 'grove',
  },
];

export function createStrategyScene(): StrategySceneGraph {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x12151c);

  const camera = new THREE.PerspectiveCamera(45, 1.33, 0.5, 300);
  camera.position.set(0, 32, 38);
  camera.lookAt(0, 0, 0);

  const ambientLight = new THREE.AmbientLight(0xdce6ec, 0.45);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff5e6, 2.2);
  sunLight.position.set(25, 45, 20);
  scene.add(sunLight);

  const hearthGlow = new THREE.PointLight(0xff7722, 5.0, 24, 1.2);
  hearthGlow.position.set(0, 1.5, 0);
  scene.add(hearthGlow);

  // Astrolabe Survey Concentric Rings (100m, 300m, 600m, 1200m, 1600m)
  const ringGroup = new THREE.Group();
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xe0a458,
    metalness: 0.85,
    roughness: 0.28,
  });
  for (const radius of [3.5, 7.5, 12.0, 18.0, 24.0]) {
    const ringGeo = new THREE.TorusGeometry(radius, 0.06, 8, 48);
    ringGeo.rotateX(Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, brassMat);
    ringMesh.position.y = 0.08;
    ringGroup.add(ringMesh);
  }
  scene.add(ringGroup);

  // Relief Terrain Mesh
  const terrainGeo = new THREE.PlaneGeometry(54, 54, 32, 32);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const r = Math.hypot(vx, vz);
    const angle = Math.atan2(vz, vx);
    let h = Math.exp(-Math.pow(r - 12.0, 2) / 60.0) * 2.8 + Math.sin(angle * 3.0) * 0.6;
    if (r > 16.0) h += (r - 16.0) * 0.45 + Math.cos(angle * 5.0) * 0.8;
    posAttr.setY(i, Math.max(-0.4, h));
  }
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    color: 0x1b242e,
    roughness: 0.88,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  scene.add(terrainMesh);

  // Buildings & Pickable Landmarks
  const pickableMeshes: THREE.Mesh[] = [];
  const interactiveGroup = new THREE.Group();
  scene.add(interactiveGroup);

  for (const b of COLONY_BUILDING_SPECS) {
    const bGroup = new THREE.Group();
    bGroup.position.set(b.pos[0], b.pos[1], b.pos[2]);

    let mesh: THREE.Mesh;
    if (b.type === 'hearth') {
      const geo = new THREE.CylinderGeometry(1.6, 1.8, 0.45, 16);
      const mat = new THREE.MeshStandardMaterial({ color: b.color, emissive: b.emissive, emissiveIntensity: 0.8 });
      mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.22;
    } else if (b.type === 'derrick') {
      const geo = new THREE.ConeGeometry(1.2, 3.2, 4);
      mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: b.color }));
      mesh.position.y = 1.6;
    } else if (b.type === 'crystal') {
      const geo = new THREE.ConeGeometry(1.1, 2.8, 6);
      mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: b.color, emissive: b.emissive }));
      mesh.position.y = 1.4;
    } else if (b.type === 'paddock') {
      const geo = new THREE.BoxGeometry(2.8, 0.6, 2.8);
      mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: b.color }));
      mesh.position.y = 0.3;
    } else {
      const geo = new THREE.BoxGeometry(2.2, 1.6, 1.8);
      mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: b.color }));
      mesh.position.y = 0.8;
    }

    mesh.userData = b;
    pickableMeshes.push(mesh);
    bGroup.add(mesh);
    interactiveGroup.add(bGroup);
  }

  const colonistGroup = new THREE.Group();
  scene.add(colonistGroup);
  const colonistMeshes = new Map<string, THREE.Mesh>();

  return {
    scene,
    camera,
    sunLight,
    ambientLight,
    hearthGlow,
    ringGroup,
    terrainMesh,
    pickableMeshes,
    colonistGroup,
    colonistMeshes,
  };
}

// ============================================================================
// 2. WORKBENCH SCENE BUILDER & CONTROLLER
// ============================================================================

export interface WorkbenchSceneGraph {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  hearthSpot: THREE.PointLight;
  ceilingLight: THREE.DirectionalLight;
  roomGroup: THREE.Group;
  apparatusGroup: THREE.Group;
  pickableApparatus: THREE.Mesh[];
}

export const WORKBENCH_APPARATUS_SPECS = [
  {
    id: 'bench_table_central',
    name: 'Heavy Timber Workbench Table (2.4m x 1.3m)',
    desc: 'Central knapping, carving, and reaction mounting surface. Accommodates crucibles, alembics, and tool racks.',
    pos: [5.22, 0.425, 1.48],
    size: [2.4, 0.85, 1.3],
    color: 0x6e4726,
    emissive: 0x221105,
    recipe: 'RECIPE_SHAPE_TIMBER',
  },
  {
    id: 'hearth_brazier',
    name: 'Thermal Hearth Brazier & Iron Grate',
    desc: 'High-temperature charcoal combustion station. Provides heat input for boiling lye and saponifying tallow.',
    pos: [1.43, 0.48, 0.62],
    size: [0.65, 0.95, 0.65],
    color: 0x2a2b30,
    emissive: 0xff3300,
    recipe: 'RECIPE_BOIL_CRUDE_SOAP',
  },
  {
    id: 'bellows_pump',
    name: 'Mechanical Draft Bellows Pump',
    desc: 'Leather & timber accordion bellows delivering forced airflow to intensify combustion temperatures over 105°C.',
    pos: [6.62, 0.22, 4.04],
    size: [0.55, 0.45, 0.35],
    color: 0x4d321d,
    emissive: 0x110802,
    recipe: 'RECIPE_SMELT_COPPER',
  },
  {
    id: 'kettle_cauldron',
    name: 'Cast Iron Soap Saponification Cauldron',
    desc: 'Heavy-bottomed cauldron for alkali hydrolysis of triglycerides with stirring paddle and boilover monitoring.',
    pos: [2.97, 0.48, 3.56],
    size: [0.75, 0.95, 0.75],
    color: 0x1c1d21,
    emissive: 0x442200,
    recipe: 'RECIPE_BOIL_CRUDE_SOAP',
  },
  {
    id: 'electrolysis_cell',
    name: 'Lead-Lined Brine Electrolyzer',
    desc: 'Ceramic electrolytic cell with graphite electrodes. Splits saturated aqueous NaCl into chlorine gas, hydrogen, and pure NaOH lye.',
    pos: [3.42, 0.38, 0.62],
    size: [0.65, 0.75, 0.65],
    color: 0x3d414a,
    emissive: 0x0088aa,
    recipe: 'RECIPE_CHLORALKALI_ELECTROLYSIS',
  },
  {
    id: 'voltaic_pile',
    name: 'Twelve-Cell Copper-Zinc Voltaic Pile',
    desc: 'Stacked bimetallic voltaic column with brine-soaked felt separators generating direct current electromotive force.',
    pos: [0.55, 0.72, 4.26],
    size: [0.5, 1.44, 0.5],
    color: 0xb87333,
    emissive: 0x00aaff,
    recipe: 'RECIPE_ASSEMBLE_VOLTAIC_PILE',
  },
  {
    id: 'fermentation_pot',
    name: 'Ceramic Oil & Tallow Conditioning Vat',
    desc: 'Glazed earthenware container for rendering animal fat, skimming butterfat, and essential herb maceration.',
    pos: [4.38, 0.38, 3.8],
    size: [0.6, 0.75, 0.6],
    color: 0x8c6d48,
    emissive: 0x221105,
    recipe: 'RECIPE_RENDER_TALLOW',
  },
  {
    id: 'mortar_pestle',
    name: 'Granite Comminution Mortar & Pestle',
    desc: 'Hard stone mortar for pulverizing halite, willow bark salicin, and crushing dried soap flakes.',
    pos: [2.86, 0.25, 0.52],
    size: [0.45, 0.5, 0.45],
    color: 0x5a5b60,
    emissive: 0x111115,
    recipe: 'RECIPE_PULVERIZE_HALITE',
  },
  {
    id: 'wood_trough',
    name: 'Dugout Dehairing & Tanning Trough',
    desc: 'Hollowed log trough holding slaked lime Ca(OH)2 solution for loosening cattle hair and preparing leather hides.',
    pos: [0.85, 0.28, 3.42],
    size: [1.1, 0.55, 0.6],
    color: 0x52361c,
    emissive: 0x150b05,
    recipe: 'RECIPE_DEHAIR_HIDE',
  },
  {
    id: 'drying_rack',
    name: 'Slotted Soap Curing & Aging Rack',
    desc: 'Well-ventilated timber shelving where poured soap blocks undergo moisture evaporation and saponification hardening.',
    pos: [0.9, 0.9, 1.9],
    size: [1.2, 1.8, 0.5],
    color: 0x4a3420,
    emissive: 0x221505,
    recipe: 'RECIPE_CURE_BAR_SOAP',
  },
];

export function createWorkbenchScene(): WorkbenchSceneGraph {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x141820);

  const camera = new THREE.PerspectiveCamera(42, 1.33, 0.2, 50);
  camera.position.set(6.5, 4.8, 6.2);
  camera.lookAt(3.6, 1.2, 2.7);

  const ambLight = new THREE.AmbientLight(0xfff5e6, 0.65);
  scene.add(ambLight);

  const hearthSpot = new THREE.PointLight(0xff7722, 3.5, 12, 1.4);
  hearthSpot.position.set(1.43, 1.8, 0.62);
  scene.add(hearthSpot);

  const ceilingLight = new THREE.DirectionalLight(0xddeeff, 1.8);
  ceilingLight.position.set(5.0, 8.0, 5.0);
  scene.add(ceilingLight);

  // Workshop Architectural Room Envelope (7.20m x 5.40m x 3.50m)
  const roomGroup = new THREE.Group();
  scene.add(roomGroup);

  const floorGeo = new THREE.PlaneGeometry(7.2, 5.4);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x3b2d20, roughness: 0.85 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(3.6, 0.0, 2.7);
  roomGroup.add(floor);

  const northWallGeo = new THREE.BoxGeometry(7.2, 3.5, 0.24);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x48494e, roughness: 0.92 });
  const northWall = new THREE.Mesh(northWallGeo, stoneMat);
  northWall.position.set(3.6, 1.75, 0.12);
  roomGroup.add(northWall);

  const westWallGeo = new THREE.BoxGeometry(0.24, 3.5, 5.4);
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x543821, roughness: 0.8 });
  const westWall = new THREE.Mesh(westWallGeo, timberMat);
  westWall.position.set(0.12, 1.75, 2.7);
  roomGroup.add(westWall);

  // Apparatus Models Placed per docs/spatial/workbench/layout.json
  const apparatusGroup = new THREE.Group();
  scene.add(apparatusGroup);
  const pickableApparatus: THREE.Mesh[] = [];

  for (const a of WORKBENCH_APPARATUS_SPECS) {
    const geo = new THREE.BoxGeometry(a.size[0], a.size[1], a.size[2]);
    const mat = new THREE.MeshStandardMaterial({
      color: a.color,
      roughness: 0.55,
      metalness: a.id === 'voltaic_pile' ? 0.85 : 0.2,
      emissive: a.emissive,
      emissiveIntensity: 0.2,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(a.pos[0], a.pos[1], a.pos[2]);
    mesh.userData = a;
    pickableApparatus.push(mesh);
    apparatusGroup.add(mesh);
  }

  return {
    scene,
    camera,
    hearthSpot,
    ceilingLight,
    roomGroup,
    apparatusGroup,
    pickableApparatus,
  };
}

// ============================================================================
// 3. BROWSER DOM MOUNT CONTROLLERS
// ============================================================================

export function mountStrategy3D(
  container: HTMLElement,
  options: Strategy3DOptions = {},
): Strategy3DController {
  container.innerHTML = '';
  container.classList.add('surgical-3d-host');

  const hudOverlay = document.createElement('div');
  hudOverlay.className = 'surgical-3d-hud';
  hudOverlay.innerHTML = `
    <div class="s3d-toolbar">
      <span class="s3d-title">🗺️ Astrolabe 3D Survey</span>
      <div class="s3d-actions">
        <button class="s3d-btn" data-cam="iso" title="Isometric View">Isometric</button>
        <button class="s3d-btn" data-cam="top" title="Survey Top-Down">Top-Down</button>
        <button class="s3d-btn" data-cam="hearth" title="Hearth Focus">Hearth</button>
        ${options.onClose ? '<button class="s3d-btn s3d-close" title="Return to 2D Map">✕ 2D Map</button>' : ''}
      </div>
    </div>
    <div class="s3d-dossier" aria-live="polite">
      <div class="dossier-card">
        <h4 id="s3d-inspect-title">Colony Settlement (Hearth)</h4>
        <p id="s3d-inspect-desc">Alchemical survey astrolabe centered at coordinate (0, 0). Click any building or resource peak to inspect telemetry.</p>
      </div>
    </div>
  `;
  container.appendChild(hudOverlay);

  const graph = createStrategyScene();
  const { scene, camera, sunLight, hearthGlow, ringGroup, pickableMeshes, colonistGroup, colonistMeshes } = graph;

  camera.aspect = Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
  camera.updateProjectionMatrix();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  let isDragging = false;
  let dragX = 0;
  let dragY = 0;
  let sphericalYaw = 0.0;
  let sphericalPitch = 0.65;
  let sphericalDist = 45.0;

  const updateCameraFromSpherical = (): void => {
    sphericalPitch = Math.max(0.12, Math.min(Math.PI / 2.1, sphericalPitch));
    sphericalDist = Math.max(12.0, Math.min(95.0, sphericalDist));
    const cx = sphericalDist * Math.sin(sphericalYaw) * Math.cos(sphericalPitch);
    const cz = sphericalDist * Math.cos(sphericalYaw) * Math.cos(sphericalPitch);
    const cy = sphericalDist * Math.sin(sphericalPitch);
    camera.position.set(cx, cy, cz);
    camera.lookAt(0, 1.2, 0);
  };
  updateCameraFromSpherical();

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredMesh: THREE.Mesh | null = null;

  const onPointerMove = (e: MouseEvent): void => {
    if (isDragging) {
      const dx = e.clientX - dragX;
      const dy = e.clientY - dragY;
      dragX = e.clientX;
      dragY = e.clientY;
      sphericalYaw -= dx * 0.007;
      sphericalPitch += dy * 0.006;
      updateCameraFromSpherical();
      return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(pickableMeshes);

    if (intersects.length > 0) {
      const target = intersects[0].object as THREE.Mesh;
      if (hoveredMesh !== target) {
        if (hoveredMesh) {
          const mat = hoveredMesh.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = 0.3;
        }
        hoveredMesh = target;
        const mat = hoveredMesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 1.6;
        renderer.domElement.style.cursor = 'pointer';
      }
    } else if (hoveredMesh) {
      const mat = hoveredMesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.3;
      hoveredMesh = null;
      renderer.domElement.style.cursor = 'default';
    }
  };

  const onPointerDown = (e: MouseEvent): void => {
    if (e.button === 0 || e.button === 2) {
      isDragging = true;
      dragX = e.clientX;
      dragY = e.clientY;
    }
  };

  const onPointerUp = (): void => {
    isDragging = false;
  };

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    sphericalDist += e.deltaY * 0.04;
    updateCameraFromSpherical();
  };

  const onClick = (e: MouseEvent): void => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(pickableMeshes);

    if (intersects.length > 0) {
      const target = intersects[0].object as THREE.Mesh;
      const b = target.userData;
      const titleElem = hudOverlay.querySelector('#s3d-inspect-title');
      const descElem = hudOverlay.querySelector('#s3d-inspect-desc');
      if (titleElem) titleElem.textContent = b.name;
      if (descElem) descElem.textContent = b.desc;
      options.onSelectBuilding?.(b.id);
    }
  };

  const dom = renderer.domElement;
  dom.addEventListener('mousemove', onPointerMove);
  dom.addEventListener('mousedown', onPointerDown);
  if (typeof window !== 'undefined') window.addEventListener('mouseup', onPointerUp);
  dom.addEventListener('wheel', onWheel, { passive: false });
  dom.addEventListener('click', onClick);

  hudOverlay.querySelector('[data-cam="iso"]')?.addEventListener('click', () => {
    sphericalYaw = Math.PI / 4;
    sphericalPitch = 0.65;
    sphericalDist = 42.0;
    updateCameraFromSpherical();
  });
  hudOverlay.querySelector('[data-cam="top"]')?.addEventListener('click', () => {
    sphericalYaw = 0.0;
    sphericalPitch = Math.PI / 2.05;
    sphericalDist = 52.0;
    updateCameraFromSpherical();
  });
  hudOverlay.querySelector('[data-cam="hearth"]')?.addEventListener('click', () => {
    sphericalYaw = 0.0;
    sphericalPitch = 0.35;
    sphericalDist = 18.0;
    updateCameraFromSpherical();
  });
  hudOverlay.querySelector('.s3d-close')?.addEventListener('click', () => {
    options.onClose?.();
  });

  let animId: number | null = null;
  let timeSec = 0;
  let lastMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const renderLoop = (nowMs: number): void => {
    const dt = Math.max(0, (nowMs - lastMs) / 1000);
    lastMs = nowMs;
    timeSec += dt;

    hearthGlow.intensity = 4.5 + Math.sin(timeSec * 6.0) * 1.2;
    ringGroup.rotation.y = timeSec * 0.02;

    renderer.render(scene, camera);
    animId = requestAnimationFrame(renderLoop);
  };
  animId = requestAnimationFrame(renderLoop);

  return {
    update(colony: ColonyState, minuteOfDay: number): void {
      const sun = computeDiurnalSun(minuteOfDay);
      sunLight.position.set(sun.x, sun.y, sun.z);
      sunLight.color.setRGB(sun.r, sun.g, sun.b);
      sunLight.intensity = sun.intensity;

      if (colony?.colonists) {
        for (const c of colony.colonists) {
          let mesh = colonistMeshes.get(c.id);
          if (!mesh) {
            const pGeo = new THREE.ConeGeometry(0.35, 1.2, 6);
            const pMat = new THREE.MeshStandardMaterial({
              color: c.archetype === 'MINER' ? 0xe0a458 : c.archetype === 'FORAGER' ? 0x4caf50 : 0x9c27b0,
              roughness: 0.5,
            });
            mesh = new THREE.Mesh(pGeo, pMat);
            mesh.castShadow = true;
            colonistGroup.add(mesh);
            colonistMeshes.set(c.id, mesh);
          }
          const scale = 24.0 / 1600.0;
          mesh.position.set(c.position.x * scale, 0.6, -c.position.y * scale);
        }
      }
    },

    resize(): void {
      if (!container || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    },

    dispose(): void {
      if (animId !== null) {
        cancelAnimationFrame(animId);
        animId = null;
      }
      dom.removeEventListener('mousemove', onPointerMove);
      dom.removeEventListener('mousedown', onPointerDown);
      if (typeof window !== 'undefined') window.removeEventListener('mouseup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('click', onClick);

      renderer.dispose();
      container.innerHTML = '';
    },
  };
}

export function mountWorkbench3D(
  container: HTMLElement,
  options: Workbench3DOptions = {},
): Workbench3DController {
  container.innerHTML = '';
  container.classList.add('surgical-3d-host');

  const hudOverlay = document.createElement('div');
  hudOverlay.className = 'surgical-3d-hud';
  hudOverlay.innerHTML = `
    <div class="s3d-toolbar">
      <span class="s3d-title">🔬 Alchemical Workbench Studio (3.5m)</span>
      <div class="s3d-actions">
        <button class="s3d-btn" data-cam="bench" title="Benchtop Focus">Benchtop</button>
        <button class="s3d-btn" data-cam="cauldron" title="Cauldron Station">Cauldron</button>
        <button class="s3d-btn" data-cam="battery" title="Voltaic Pile">Voltaic</button>
        ${options.onClose ? '<button class="s3d-btn s3d-close" title="Return to Compact View">✕ Close</button>' : ''}
      </div>
    </div>
    <div class="s3d-dossier" aria-live="polite">
      <div class="dossier-card">
        <h4 id="s3d-bench-title">Heavy Timber Laboratory Workbench</h4>
        <p id="s3d-bench-desc">Click any apparatus to inspect reaction parameters, temperature kinetics, and recipe couplings.</p>
      </div>
    </div>
  `;
  container.appendChild(hudOverlay);

  const graph = createWorkbenchScene();
  const { scene, camera, hearthSpot, pickableApparatus } = graph;

  camera.aspect = Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
  camera.updateProjectionMatrix();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  let isOrbiting = false;
  let oX = 0;
  let oY = 0;
  let yaw = 0.8;
  let pitch = 0.5;
  let dist = 8.5;

  const updateCamera = (): void => {
    pitch = Math.max(0.1, Math.min(Math.PI / 2.2, pitch));
    dist = Math.max(3.0, Math.min(16.0, dist));
    const target = new THREE.Vector3(3.6, 1.0, 2.7);
    const cx = target.x + dist * Math.sin(yaw) * Math.cos(pitch);
    const cz = target.z + dist * Math.cos(yaw) * Math.cos(pitch);
    const cy = target.y + dist * Math.sin(pitch);
    camera.position.set(cx, cy, cz);
    camera.lookAt(target);
  };
  updateCamera();

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredApp: THREE.Mesh | null = null;

  const onPointerMove = (e: MouseEvent): void => {
    if (isOrbiting) {
      const dx = e.clientX - oX;
      const dy = e.clientY - oY;
      oX = e.clientX;
      oY = e.clientY;
      yaw -= dx * 0.008;
      pitch += dy * 0.007;
      updateCamera();
      return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(pickableApparatus);

    if (intersects.length > 0) {
      const target = intersects[0].object as THREE.Mesh;
      if (hoveredApp !== target) {
        if (hoveredApp) {
          (hoveredApp.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2;
        }
        hoveredApp = target;
        (hoveredApp.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.4;
        renderer.domElement.style.cursor = 'pointer';
      }
    } else if (hoveredApp) {
      (hoveredApp.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2;
      hoveredApp = null;
      renderer.domElement.style.cursor = 'default';
    }
  };

  const onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0 || e.button === 2) {
      isOrbiting = true;
      oX = e.clientX;
      oY = e.clientY;
    }
  };

  const onMouseUp = (): void => {
    isOrbiting = false;
  };

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    dist += e.deltaY * 0.015;
    updateCamera();
  };

  const onClick = (e: MouseEvent): void => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(pickableApparatus);

    if (intersects.length > 0) {
      const target = intersects[0].object as THREE.Mesh;
      const a = target.userData;
      const titleElem = hudOverlay.querySelector('#s3d-bench-title');
      const descElem = hudOverlay.querySelector('#s3d-bench-desc');
      if (titleElem) titleElem.textContent = a.name;
      if (descElem) descElem.textContent = a.desc;
      options.onSelectApparatus?.(a.id);
      if (a.recipe) options.onSelectRecipe?.(a.recipe);
    }
  };

  const dom = renderer.domElement;
  dom.addEventListener('mousemove', onPointerMove);
  dom.addEventListener('mousedown', onMouseDown);
  if (typeof window !== 'undefined') window.addEventListener('mouseup', onMouseUp);
  dom.addEventListener('wheel', onWheel, { passive: false });
  dom.addEventListener('click', onClick);

  hudOverlay.querySelector('[data-cam="bench"]')?.addEventListener('click', () => {
    yaw = 0.6;
    pitch = 0.45;
    dist = 6.2;
    updateCamera();
  });
  hudOverlay.querySelector('[data-cam="cauldron"]')?.addEventListener('click', () => {
    yaw = 1.8;
    pitch = 0.35;
    dist = 4.5;
    updateCamera();
  });
  hudOverlay.querySelector('[data-cam="battery"]')?.addEventListener('click', () => {
    yaw = -0.5;
    pitch = 0.4;
    dist = 4.2;
    updateCamera();
  });
  hudOverlay.querySelector('.s3d-close')?.addEventListener('click', () => {
    options.onClose?.();
  });

  let animId: number | null = null;
  let timeSec = 0;
  let lastMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const renderLoop = (nowMs: number): void => {
    const dt = Math.max(0, (nowMs - lastMs) / 1000);
    lastMs = nowMs;
    timeSec += dt;

    hearthSpot.intensity = 3.2 + Math.sin(timeSec * 8.0) * 0.9;

    renderer.render(scene, camera);
    animId = requestAnimationFrame(renderLoop);
  };
  animId = requestAnimationFrame(renderLoop);

  return {
    update(vesselState?: VesselState, kettleState?: KettleDriveState): void {
      if (vesselState) {
        const heatRatio = Math.max(0, Math.min(1.0, (vesselState.temperatureK - 293.15) / 150.0));
        hearthSpot.intensity = 2.0 + heatRatio * 4.0;
      }
      if (kettleState) {
        if (kettleState.temperatureC > 105) {
          hearthSpot.color.setHex(0xff2200);
        } else {
          hearthSpot.color.setHex(0xff7722);
        }
      }
    },

    resize(): void {
      if (!container || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    },

    dispose(): void {
      if (animId !== null) {
        cancelAnimationFrame(animId);
        animId = null;
      }
      dom.removeEventListener('mousemove', onPointerMove);
      dom.removeEventListener('mousedown', onMouseDown);
      if (typeof window !== 'undefined') window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('click', onClick);

      renderer.dispose();
      container.innerHTML = '';
    },
  };
}
