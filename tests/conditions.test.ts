import { describe, expect, it } from 'vitest';
import { escalateConditions } from '../src/engine/conditions';
import { createPlayerMetabolism } from '../src/engine/metabolism';

const hurt = () => {
  const p = createPlayerMetabolism();
  p.conditions.woundContamination = true;
  return p;
};

describe('wound→fever→sepsis ladder', () => {
  it('wound untreated 12h+ becomes fever', () => {
    const p = hurt();
    escalateConditions(p, 11);
    expect(p.conditions.fever).toBe(false);
    escalateConditions(p, 1.5);
    expect(p.conditions.fever).toBe(true);
  });
  it('fever untreated 24h+ becomes sepsis', () => {
    const p = hurt();
    escalateConditions(p, 40);            // 12h → fever at ~12, then 24h more
    expect(p.conditions.fever).toBe(true);
    expect(p.conditions.systemicInfection).toBe(true);
  });
  it('sepsis untreated 48h is fatal', () => {
    const p = hurt();
    escalateConditions(p, 100);           // 12 + 24 + 48 = 84 < 100
    expect(p.dead).toBe(true);
  });
  it('cure resets the wound timer path correctly', () => {
    const p = hurt();
    escalateConditions(p, 3);             // accumulates but not fever yet
    p.conditions.woundContamination = false;
    p.woundOnsetSeconds = 0;
    escalateConditions(p, 100);
    expect(p.conditions.fever).toBe(false);
    expect(p.dead).toBe(false);
  });
});
