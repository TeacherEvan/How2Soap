import { describe, expect, it } from 'vitest';
import { ICONS, itemIcon, FALLBACK_ICON } from '../src/ui/icons';
import { ITEMS } from '../src/data/items';

describe('icon set', () => {
  it('every catalog icon key resolves to an icon', () => {
    for (const item of ITEMS) {
      expect(ICONS[item.icon], `missing icon: ${item.icon} (for ${item.id})`).toBeDefined();
    }
  });
  it('fallback icon exists and unknown ids never throw', () => {
    expect(ICONS[FALLBACK_ICON]).toBeDefined();
    expect(() => itemIcon('__does_not_exist__')).not.toThrow();
    expect(itemIcon('__does_not_exist__')).toContain('<svg');
  });
  it('itemIcon honours size argument', () => {
    expect(itemIcon('log', 32)).toContain('width="32"');
    expect(itemIcon('log')).toContain('width="20"');
  });
  it('icons carry stroke=currentColor and viewBox 0 0 24 24', () => {
    for (const [key, body] of Object.entries(ICONS)) {
      expect(body, key).toContain('stroke="currentColor"');
      expect(body, key).toContain('viewBox="0 0 24 24"');
    }
  });
});
