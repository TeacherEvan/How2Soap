import { describe, expect, it } from 'vitest';
import { treatmentModel, bannerModel } from '../src/ui/panelModels';

describe('treatment + banner models', () => {
  it('lists only held meds, only when relevant to the condition', () => {
    const items = [{ id: 'SALINE_RINSE', count: 2, massKg: 0.2 }];
    const wound = bannerModel({
      glucoseKcal: 1000,
      conditions: { fever: false, systemicInfection: false, woundContamination: true },
    } as any);
    expect(wound).toHaveLength(1);
    expect(wound[0].text).toContain('Wound festering');

    const treats = treatmentModel(
      items as any,
      {
        glucoseKcal: 1000,
        conditions: { fever: false, systemicInfection: false, woundContamination: true },
      } as any,
    );
    expect(treats.map(t => t.id)).toEqual(['SALINE_RINSE']);
  });

  it('triggers ravenous banner when glucose drops below 250 kcal', () => {
    const hunger = bannerModel({
      glucoseKcal: 150,
      conditions: { fever: false, systemicInfection: false, woundContamination: false },
    } as any);
    expect(hunger.some(b => b.text.includes('Ravenous'))).toBe(true);
  });
});
