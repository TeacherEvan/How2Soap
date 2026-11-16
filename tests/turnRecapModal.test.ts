import { describe, it, expect } from 'vitest';
import { deduplicateRecapEvents } from '../src/ui/TurnRecapModal';

describe('deduplicateRecapEvents', () => {
  it('deduplicates identical request expiration messages while preserving order', () => {
    const events = [
      { vesselId: -1, message: '⌛ Request expired: Copper Ingots' },
      { vesselId: -1, message: '⚠ Crisis: Frost.' },
      { vesselId: -1, message: '⌛ Request expired: Copper Ingots' },
      { vesselId: -1, message: '⌛ Request expired: Bar Soap' },
      { vesselId: -1, message: '⌛ Request expired: Copper Ingots' },
    ];

    const result = deduplicateRecapEvents(events);
    expect(result).toEqual([
      { vesselId: -1, message: '⌛ Request expired: Copper Ingots' },
      { vesselId: -1, message: '⚠ Crisis: Frost.' },
      { vesselId: -1, message: '⌛ Request expired: Bar Soap' },
    ]);
  });

  it('does not deduplicate non-expiration events', () => {
    const events = [
      { vesselId: 1, message: 'Skimmed soap.' },
      { vesselId: 2, message: 'Skimmed soap.' },
    ];

    expect(deduplicateRecapEvents(events)).toHaveLength(2);
  });
});
