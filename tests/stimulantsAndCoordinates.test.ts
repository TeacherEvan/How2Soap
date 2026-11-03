import { describe, it, expect } from 'vitest';
import { ITEMS, ITEM_BY_ID, type StimulantSpec } from '../src/data/items';
import { FABRICATION_RECIPES } from '../src/engine/fabrication';
import { ICONS } from '../src/ui/icons';
import {
  BIOME_DAG,
  getSpeciesWorldPosition,
  type BiomeNodeDefinition,
} from '../src/data/biomeNodes';

describe('Task 1: Item Catalog, Fabrication Recipes & 2D Biome Coordinates', () => {
  describe('Items & StimulantSpec', () => {
    const requiredItemIds = ['BAR_SOAP', 'WILLOW_TEA', 'MINT_TONIC', 'NITROUS_TONIC'] as const;

    it('contains all new items in ITEMS and ITEM_BY_ID lookup', () => {
      for (const id of requiredItemIds) {
        expect(ITEM_BY_ID[id], `Missing item in ITEM_BY_ID: ${id}`).toBeDefined();
        expect(ITEMS.find(item => item.id === id), `Missing item in ITEMS: ${id}`).toBeDefined();
      }
    });

    it('asserts wageValue for all new items', () => {
      expect(ITEM_BY_ID.BAR_SOAP.wageValue).toBe(25);
      expect(ITEM_BY_ID.WILLOW_TEA.wageValue).toBe(8);
      expect(ITEM_BY_ID.MINT_TONIC.wageValue).toBe(12);
      expect(ITEM_BY_ID.NITROUS_TONIC.wageValue).toBe(35);
    });

    it('asserts valid StimulantSpec for stimulant items', () => {
      const stimulants = ['WILLOW_TEA', 'MINT_TONIC', 'NITROUS_TONIC'] as const;
      for (const id of stimulants) {
        const item = ITEM_BY_ID[id];
        const spec = (item.stimulantSpec ?? (item as any).stimulant) as StimulantSpec;
        expect(spec, `${id} must have stimulantSpec`).toBeDefined();
        expect(spec.speedMultiplier).toBeGreaterThanOrEqual(1.25);
        expect(spec.speedMultiplier).toBeLessThanOrEqual(1.6);
        expect(spec.durationMinutes).toBeGreaterThan(0);
        expect(spec.crashMinutes).toBeGreaterThanOrEqual(30);
        expect(spec.crashMinutes).toBeLessThanOrEqual(60);
        expect(spec.crashMultiplier).toBeGreaterThanOrEqual(0.7);
        expect(spec.crashMultiplier).toBeLessThanOrEqual(0.85);
      }
    });

    it('BAR_SOAP has correct tier, category, affinity, and description', () => {
      const soap = ITEM_BY_ID.BAR_SOAP;
      expect(soap.category).toBe('medicine');
      expect(soap.tier).toBe(2);
      expect(soap.affinity).toBe('soapwright');
      expect(soap.desc.length).toBeGreaterThanOrEqual(12);
    });
  });

  describe('Fabrication Recipes', () => {
    const requiredRecipes = [
      'MOLD_BAR_SOAP',
      'BREW_WILLOW_TEA',
      'DISTILL_MINT_TONIC',
      'SYNTHESIZE_NITROUS_TONIC',
    ] as const;

    it('contains all 4 new recipes in FABRICATION_RECIPES', () => {
      const recipeMap = new Map(FABRICATION_RECIPES.map(r => [r.id, r]));
      for (const recipeId of requiredRecipes) {
        const r = recipeMap.get(recipeId);
        expect(r, `Missing recipe: ${recipeId}`).toBeDefined();
        expect(r!.inputs.length).toBeGreaterThan(0);
        expect(r!.outputs.length).toBeGreaterThan(0);
        expect(r!.energyCostKcal).toBeGreaterThanOrEqual(0);
      }
    });

    it('recipes produce corresponding new items', () => {
      const recipeMap = new Map(FABRICATION_RECIPES.map(r => [r.id, r]));
      expect(recipeMap.get('MOLD_BAR_SOAP')!.outputs.some(o => o.itemId === 'BAR_SOAP')).toBe(true);
      expect(recipeMap.get('BREW_WILLOW_TEA')!.outputs.some(o => o.itemId === 'WILLOW_TEA')).toBe(true);
      expect(recipeMap.get('DISTILL_MINT_TONIC')!.outputs.some(o => o.itemId === 'MINT_TONIC')).toBe(true);
      expect(recipeMap.get('SYNTHESIZE_NITROUS_TONIC')!.outputs.some(o => o.itemId === 'NITROUS_TONIC')).toBe(true);
    });
  });

  describe('SVG Icons', () => {
    it('defines SVG icons for all new items with viewBox="0 0 24 24" and stroke="currentColor"', () => {
      const items = ['BAR_SOAP', 'WILLOW_TEA', 'MINT_TONIC', 'NITROUS_TONIC'];
      for (const id of items) {
        const item = ITEM_BY_ID[id];
        expect(item, `Item ${id} should exist`).toBeDefined();
        const iconKey = item.icon;
        const iconSvg = ICONS[iconKey];
        expect(iconSvg, `Icon ${iconKey} for ${id} must exist in ICONS`).toBeDefined();
        expect(iconSvg).toContain('viewBox="0 0 24 24"');
        expect(iconSvg).toContain('stroke="currentColor"');
      }
    });

    it('defines explicit icon keys: soap-bar, tea-cup, mint-leaf, vial-fuming (or item icons)', () => {
      const candidateIcons = ['soap-bar', 'tea-cup', 'mint-leaf', 'vial-fuming'];
      for (const iconKey of candidateIcons) {
        const iconSvg = ICONS[iconKey];
        expect(iconSvg, `Icon ${iconKey} must exist in ICONS`).toBeDefined();
        expect(iconSvg).toContain('viewBox="0 0 24 24"');
        expect(iconSvg).toContain('stroke="currentColor"');
      }
    });
  });

  describe('2D Biome Coordinates & Node Map Angles', () => {
    it('every species node in BIOME_DAG defines a valid mapAngleRad in [0, 2*PI)', () => {
      let count = 0;
      for (const cat of BIOME_DAG) {
        for (const sp of cat.species) {
          count++;
          expect((sp as any).mapAngleRad, `mapAngleRad on ${sp.id}`).toBeDefined();
          expect((sp as any).mapAngleRad).toBeGreaterThanOrEqual(0);
          expect((sp as any).mapAngleRad).toBeLessThan(2 * Math.PI);
        }
      }
      expect(count).toBeGreaterThanOrEqual(10);
    });

    it('getSpeciesWorldPosition calculates exact Euclidean coordinates matching baseDistanceMeters', () => {
      for (const cat of BIOME_DAG) {
        for (const sp of cat.species) {
          const pos = getSpeciesWorldPosition(sp.id);
          expect(pos, `Position for ${sp.id}`).toBeDefined();
          const dist = Math.hypot(pos.x, pos.y);
          expect(dist).toBeCloseTo(sp.baseDistanceMeters, 2);

          // Verify polar conversion: x = r * cos(theta), y = r * sin(theta)
          const angle = (sp as any).mapAngleRad;
          expect(pos.x).toBeCloseTo(sp.baseDistanceMeters * Math.cos(angle), 4);
          expect(pos.y).toBeCloseTo(sp.baseDistanceMeters * Math.sin(angle), 4);
        }
      }
    });

    it('BiomeNodeDefinition type is exported and compatible', () => {
      // Type-check alias / interface
      const dummy: BiomeNodeDefinition = BIOME_DAG[0].species[0] as any;
      expect(dummy.id).toBeDefined();
      expect(dummy.mapAngleRad).toBeDefined();
    });
  });
});
