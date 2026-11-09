import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ASSETS_DIR = join(process.cwd(), 'public', 'assets');

describe('glTF asset manifest (Blender → web)', () => {
  it('public/assets/ exists with required subdirs', () => {
    expect(existsSync(ASSETS_DIR)).toBe(true);
    for (const sub of ['terrain', 'buildings', 'characters', 'props', 'workbench']) {
      expect(existsSync(join(ASSETS_DIR, sub))).toBe(true);
    }
  });

  it('6 initial .glb assets exist and start with glTF magic', () => {
    const expected = [
      'terrain/grass-tile.glb',
      'buildings/house.glb',
      'buildings/mine-shaft.glb',
      'characters/colonist.glb',
      'props/tree.glb',
      'props/rock.glb',
    ];
    for (const rel of expected) {
      const p = join(ASSETS_DIR, rel);
      expect(existsSync(p), `${rel} missing`).toBe(true);
      const magic = readFileSync(p).subarray(0, 4).toString();
      expect(magic, `${rel} not a glTF binary`).toBe('glTF');
    }
  });

  it('.glb sizes are web-appropriate (<500 KiB)', () => {
    for (const sub of ['terrain', 'buildings', 'characters', 'props', 'workbench']) {
      const dir = join(ASSETS_DIR, sub);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir)) {
        if (!f.endsWith('.glb')) continue;
        const size = readFileSync(join(dir, f)).length;
        expect(size, `${f} too large (${size} bytes)`).toBeLessThan(500 * 1024);
      }
    }
  });

  it('workbench actions manifest exists and defines required Blender-only channels', () => {
    const manifestPath = join(process.cwd(), 'blender', 'templates', 'workbench_actions.json');
    expect(existsSync(manifestPath), 'workbench_actions.json missing').toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    expect(manifest.format).toBe('workbench_actions/1');

    const actions = manifest.actions;
    expect(actions).toBeDefined();

    // Verify critical workbench actions are declared
    const expectedActions = [
      'hearth_flame',
      'bellows_pump',
      'pour_stream',
      'stir_vortex',
      'boil_shake',
      'liquid_fill',
      'crystal_shimmer',
      'colonist_walk_idle',
    ];
    for (const actionName of expectedActions) {
      expect(actions[actionName], `Missing action ${actionName}`).toBeDefined();
      expect(actions[actionName].glb).toBeDefined();
      expect(actions[actionName].frames).toBeGreaterThan(0);
      expect(actions[actionName].fps).toBeGreaterThan(0);
    }

    // Verify non-empty blender_only_channels for pour_stream and crystal_shimmer
    expect(actions.pour_stream.blender_only_channels.length).toBeGreaterThan(0);
    expect(actions.crystal_shimmer.blender_only_channels.length).toBeGreaterThan(0);
  });
});
