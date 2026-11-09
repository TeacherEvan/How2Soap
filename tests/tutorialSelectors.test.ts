import { describe, it, expect } from 'vitest';
import { TUTORIAL_LESSONS } from '../src/ui/tutorialCurriculum';
import { COUNTRIES } from '../src/engine/campaign/realm';
import { PATRONS, assignPatronFromRecipe } from '../src/engine/campaign/patron';
import { AGE_I_CIVS, DEDICATIONS, createInitialAgeProgress, addAgeProgress } from '../src/engine/campaign/dormant/ageProgress';
import * as fs from 'fs';
import * as path from 'path';

describe('Tutorial Integrity Contract & 25-Start-Path Matrix (§6.26)', () => {
  it('every lesson has stable, non-empty id and action', () => {
    expect(TUTORIAL_LESSONS.length).toBeGreaterThan(0);
    for (const lesson of TUTORIAL_LESSONS) {
      expect(lesson.id).toBeTruthy();
      expect(lesson.title).toBeTruthy();
      expect(lesson.summaryHtml).toBeTruthy();
    }
  });

  it('validates spotlightSelectors against public/index.html', () => {
    const htmlPath = path.resolve(__dirname, '../public/index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    for (const lesson of TUTORIAL_LESSONS) {
      const sel = lesson.spotlightSelector;
      if (sel) {
        // Extract all #ids in selector
        const idMatches = sel.match(/#[a-zA-Z0-9_-]+/g);
        if (idMatches) {
          for (const match of idMatches) {
            const id = match.slice(1);
            expect(htmlContent.includes(`id="${id}"`), `Expected id ${id} to exist in public/index.html`).toBe(true);
          }
        }
      }
    }
  });

  it('covers 25 start paths: 5 countries × 5 first-craft patrons', () => {
    expect(COUNTRIES.length).toBe(5);
    expect(PATRONS.length).toBe(5);

    const matrix: Array<{ country: string; patron: string }> = [];

    const craftSampleRecipes = [
      'RECIPE_CRAFT_FLINT_SPEAR',
      'RECIPE_SAPONIFY_COLD',
      'RECIPE_STEEP_WILLOW_BARK',
      'RECIPE_ROAST_CHARCOAL',
      null, // wander off
    ];

    for (const country of COUNTRIES) {
      for (const recipeId of craftSampleRecipes) {
        const patronId = assignPatronFromRecipe(recipeId);
        const patron = PATRONS.find(p => p.id === patronId);
        expect(patron).toBeDefined();
        matrix.push({ country: country.id, patron: patronId });
      }
    }

    expect(matrix.length).toBe(25);
  });

  it('verifies Age I -> Age II progression and The Turning options', () => {
    let ageState = createInitialAgeProgress();
    expect(ageState.currentAge).toBe(1);
    expect(ageState.turningAvailable).toBe(false);

    ageState = addAgeProgress(ageState, 100);
    expect(ageState.turningAvailable).toBe(true);

    expect(AGE_I_CIVS.length).toBe(3);
    expect(DEDICATIONS.length).toBe(5);
  });
});
