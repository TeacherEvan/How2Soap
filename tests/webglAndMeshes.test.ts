import { describe, it, expect } from 'vitest';
import { MESHES } from '../src/ui/gl/lowPolyMeshes';

describe('Zero-Dependency WebGL2 Low-Poly Diorama Meshes', () => {
  it('contains valid geometry for vessels, brazier, colonist pawn, and crystals', () => {
    expect(MESHES.WOOD_BUCKET).toBeDefined();
    expect(MESHES.CERAMIC_CRUCIBLE).toBeDefined();
    expect(MESHES.HEARTH_BRAZIER).toBeDefined();
    expect(MESHES.COLONIST_PAWN).toBeDefined();
    expect(MESHES.BIOME_CRYSTAL).toBeDefined();
  });

  it('verifies that positions and normals have matching vertex counts (stride 3)', () => {
    for (const mesh of Object.values(MESHES)) {
      expect(mesh.positions.length % 3).toBe(0);
      expect(mesh.normals.length).toBe(mesh.positions.length);
      expect(mesh.indices.length).toBeGreaterThan(0);
      expect(mesh.indices.length % 3).toBe(0); // Triangulated
    }
  });
});
