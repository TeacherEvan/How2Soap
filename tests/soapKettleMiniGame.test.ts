import { describe, it, expect } from 'vitest';
import { SoapKettleMiniGame } from '../src/ui/SoapKettleMiniGame';

describe('SoapKettleMiniGame', () => {
  it('initializes in IDLE and transitions through phases', () => {
    const game = new SoapKettleMiniGame();
    expect(game.phase).toBe('IDLE');

    game.startBatch();
    expect(game.phase).toBe('POURING');

    // Simulate pouring balanced mix
    game.isPouringLye = true;
    game.isPouringFat = true;
    let t = 1000;
    while (game.phase === 'POURING' && t < 10000) {
      t += 200;
      game.step(t);
    }
    expect(game.phase).toBe('HEATING');

    // Pump heat into saponification zone (80..95)
    for (let i = 0; i < 6; i++) {
      game.pumpBellows();
    }
    expect(game.temperatureC).toBeGreaterThanOrEqual(80);

    // Heat step until stirring
    while (game.phase === 'HEATING' && t < 25000) {
      t += 200;
      // keep in zone
      if (game.temperatureC < 85) game.pumpBellows();
      game.step(t);
    }
    expect(game.phase).toBe('STIRRING');

    // Stir to 100% trace
    for (let s = 0; s < 12; s++) {
      game.stirStroke();
    }
    expect(game.phase).toBe('COMPLETE');
    expect(game.lastResult?.quality).toBe('PERFECT');
    expect(game.lastResult?.soapYield).toBe(2);
  });

  it('yields RUINED if kettle boils over > 105C', () => {
    const game = new SoapKettleMiniGame();
    game.startBatch();
    game.lyeVolume = 50;
    game.fatVolume = 50;
    game.phase = 'HEATING';

    // Overheat
    for (let i = 0; i < 10; i++) {
      game.pumpBellows();
    }
    game.step(Date.now() + 100);
    expect(game.isBoilingOver).toBe(true);

    game.heatProgressPct = 100;
    game.phase = 'STIRRING';
    for (let s = 0; s < 12; s++) {
      game.stirStroke();
    }
    expect(game.lastResult?.quality).toBe('RUINED');
    expect(game.lastResult?.soapYield).toBe(0);
  });
});
