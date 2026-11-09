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
});
