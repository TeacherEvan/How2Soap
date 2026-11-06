import { describe, it, expect } from 'vitest';
import { getNextTileIndex, getColumnCountForWidth } from '../src/ui/council/tileNav';

describe('Council TileNav Pure Helpers', () => {
  it('determines responsive column count correctly', () => {
    expect(getColumnCountForWidth(360)).toBe(2);
    expect(getColumnCountForWidth(479)).toBe(2);
    expect(getColumnCountForWidth(480)).toBe(3);
    expect(getColumnCountForWidth(899)).toBe(3);
    expect(getColumnCountForWidth(900)).toBe(5);
    expect(getColumnCountForWidth(1440)).toBe(5);
  });

  it('handles left and right arrow keys within bounds', () => {
    // 6 tiles, 3 columns
    expect(getNextTileIndex(1, 6, 3, 'ArrowLeft')).toBe(0);
    expect(getNextTileIndex(0, 6, 3, 'ArrowLeft')).toBe(0); // Clamped
    expect(getNextTileIndex(1, 6, 3, 'ArrowRight')).toBe(2);
    expect(getNextTileIndex(5, 6, 3, 'ArrowRight')).toBe(5); // Clamped
  });

  it('handles up and down navigation in grid', () => {
    // 6 tiles, 3 columns:
    // [0, 1, 2]
    // [3, 4, 5]
    expect(getNextTileIndex(1, 6, 3, 'ArrowDown')).toBe(4);
    expect(getNextTileIndex(4, 6, 3, 'ArrowUp')).toBe(1);

    // Boundary stops
    expect(getNextTileIndex(1, 6, 3, 'ArrowUp')).toBe(1); // Already at top
    expect(getNextTileIndex(4, 6, 3, 'ArrowDown')).toBe(4); // Already at bottom
  });

  it('handles irregular bottom row navigation', () => {
    // 5 tiles, 3 columns:
    // [0, 1, 2]
    // [3, 4]
    // 2 down would be index 5 which does not exist -> stays at 2
    expect(getNextTileIndex(2, 5, 3, 'ArrowDown')).toBe(2);
    // 1 down is 4
    expect(getNextTileIndex(1, 5, 3, 'ArrowDown')).toBe(4);
  });

  it('handles Home and End keys', () => {
    expect(getNextTileIndex(3, 10, 5, 'Home')).toBe(0);
    expect(getNextTileIndex(3, 10, 5, 'End')).toBe(9);
  });
});
