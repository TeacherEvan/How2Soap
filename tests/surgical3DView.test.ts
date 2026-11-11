import { describe, it, expect } from 'vitest';
import {
  computeDiurnalSun,
  createStrategyScene,
  createWorkbenchScene,
  COLONY_BUILDING_SPECS,
  WORKBENCH_APPARATUS_SPECS,
} from '../src/ui/gl/Surgical3DView';

describe('Surgical3DView Engine Architecture & Pure Scene Graphs', () => {
  describe('computeDiurnalSun', () => {
    it('computes correct solar angles, daylight color, and intensity at solar noon (720 min)', () => {
      const sun = computeDiurnalSun(720);
      expect(sun.y).toBeGreaterThan(15);
      expect(sun.intensity).toBeCloseTo(2.4, 1);
      expect(sun.r).toBeCloseTo(1.0, 1);
      expect(sun.g).toBeCloseTo(0.98, 1);
      expect(sun.b).toBeCloseTo(0.92, 1);
    });

    it('computes warm amber color and lower elevation at dawn / dusk (360 min and 1080 min)', () => {
      const dawn = computeDiurnalSun(360);
      expect(dawn.y).toBeLessThanOrEqual(15);
      expect(dawn.intensity).toBeCloseTo(1.4, 1);
      expect(dawn.r).toBe(1.0);
      expect(dawn.g).toBe(0.55);
      expect(dawn.b).toBe(0.2);

      const dusk = computeDiurnalSun(1080);
      expect(dusk.intensity).toBeCloseTo(1.4, 1);
      expect(dusk.r).toBe(1.0);
    });

    it('computes midnight moonlight with cool slate-blue tint (0 min / 1440 min)', () => {
      const midnight = computeDiurnalSun(0);
      expect(midnight.intensity).toBeCloseTo(0.35, 1);
      expect(midnight.b).toBeGreaterThan(midnight.r);
    });
  });

  describe('createStrategyScene', () => {
    it('constructs complete 3D astrolabe strategy scene graph with concentric rings and terrain', () => {
      const graph = createStrategyScene();

      expect(graph.scene).toBeDefined();
      expect(graph.camera).toBeDefined();
      expect(graph.sunLight).toBeDefined();
      expect(graph.ambientLight).toBeDefined();
      expect(graph.hearthGlow).toBeDefined();
      expect(graph.ringGroup).toBeDefined();

      // Exactly 5 astrolabe brass range rings: 100m, 300m, 600m, 1200m, 1600m
      expect(graph.ringGroup.children.length).toBe(5);

      // Terrain mesh with computed elevation attributes
      expect(graph.terrainMesh).toBeDefined();
      const posAttr = graph.terrainMesh.geometry.attributes.position;
      expect(posAttr.count).toBeGreaterThan(100);

      // Pickable landmark meshes
      expect(graph.pickableMeshes.length).toBe(COLONY_BUILDING_SPECS.length);
      expect(graph.pickableMeshes.length).toBe(7);

      const ids = graph.pickableMeshes.map((m) => m.userData.id);
      expect(ids).toContain('hearth_camp_center');
      expect(ids).toContain('apothecary_workshop');
      expect(ids).toContain('mine_shaft_headframe');
      expect(ids).toContain('colonist_dwelling');
      expect(ids).toContain('domestication_paddock');
      expect(ids).toContain('halite_crystal_peaks');
      expect(ids).toContain('oak_hardwood_grove');
    });
  });

  describe('createWorkbenchScene', () => {
    it('constructs complete 3D alchemical laboratory studio matching docs/spatial/workbench', () => {
      const graph = createWorkbenchScene();

      expect(graph.scene).toBeDefined();
      expect(graph.camera).toBeDefined();
      expect(graph.hearthSpot).toBeDefined();
      expect(graph.ceilingLight).toBeDefined();

      // Architectural Room Envelope: Floor, North Wall, West Wall
      expect(graph.roomGroup.children.length).toBe(3);

      // Apparatus meshes placed per layout.json
      expect(graph.pickableApparatus.length).toBe(WORKBENCH_APPARATUS_SPECS.length);
      expect(graph.pickableApparatus.length).toBe(10);

      const apparatusIds = graph.pickableApparatus.map((m) => m.userData.id);
      expect(apparatusIds).toContain('bench_table_central');
      expect(apparatusIds).toContain('hearth_brazier');
      expect(apparatusIds).toContain('bellows_pump');
      expect(apparatusIds).toContain('kettle_cauldron');
      expect(apparatusIds).toContain('electrolysis_cell');
      expect(apparatusIds).toContain('voltaic_pile');
      expect(apparatusIds).toContain('fermentation_pot');
      expect(apparatusIds).toContain('mortar_pestle');
      expect(apparatusIds).toContain('wood_trough');
      expect(apparatusIds).toContain('drying_rack');

      // Verify Voltaic Pile has metallic finish
      const voltaic = graph.pickableApparatus.find((m) => m.userData.id === 'voltaic_pile')!;
      expect((voltaic.material as any).metalness).toBe(0.85);

      // Verify Central Bench position matches SAT layout.json
      const bench = graph.pickableApparatus.find((m) => m.userData.id === 'bench_table_central')!;
      expect(bench.position.x).toBeCloseTo(5.22, 1);
      expect(bench.position.z).toBeCloseTo(1.48, 1);
    });
  });
});
