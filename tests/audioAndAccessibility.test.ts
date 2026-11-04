import { describe, expect, it } from 'vitest';
import { worldXToPan, audio } from '../src/ui/audio';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Spatial Stereo Web Audio & Accessibility (Task 5)', () => {
  describe('Spatial panning math: worldXToPan', () => {
    it('centers audio at worldX = 0', () => {
      expect(worldXToPan(0)).toBeCloseTo(0.0, 5);
      expect(worldXToPan(0, 1600)).toBeCloseTo(0.0, 5);
    });

    it('maps positive and negative worldX proportionally and clamps to [-1.0, 1.0]', () => {
      // Default maxDistanceMeters is 1600
      expect(worldXToPan(800, 1600)).toBeCloseTo(0.5, 5);
      expect(worldXToPan(-800, 1600)).toBeCloseTo(-0.5, 5);

      // Boundary values
      expect(worldXToPan(1600, 1600)).toBeCloseTo(1.0, 5);
      expect(worldXToPan(-1600, 1600)).toBeCloseTo(-1.0, 5);

      // Clamping beyond maxDistance
      expect(worldXToPan(3200, 1600)).toBe(1.0);
      expect(worldXToPan(-2500, 1600)).toBe(-1.0);
    });

    it('handles NaN or non-finite values safely', () => {
      expect(worldXToPan(NaN)).toBe(0);
      expect(worldXToPan(Infinity)).toBe(1.0);
      expect(worldXToPan(-Infinity)).toBe(-1.0);
    });
  });

  describe('Audio synthesized procedural cues', () => {
    it('executes recruitHorn, wageClink, stimulantShimmer, strikeBell without error in headless environments', () => {
      expect(() => audio.recruitHorn()).not.toThrow();
      expect(() => audio.recruitHorn(-500)).not.toThrow();
      expect(() => audio.recruitHorn(800)).not.toThrow();

      expect(() => audio.wageClink()).not.toThrow();
      expect(() => audio.wageClink(200)).not.toThrow();

      expect(() => audio.stimulantShimmer()).not.toThrow();

      expect(() => audio.strikeBell()).not.toThrow();
      expect(() => audio.strikeBell(-1200)).not.toThrow();
    });
  });

  describe('WCAG 2.2 SC 2.5.8 Target Sizes & Styles Invariants', () => {
    const cssPath = resolve(__dirname, '../src/styles.css');
    const css = readFileSync(cssPath, 'utf-8');

    it('.story-overlay has fixed positioning, inset 0, and high z-index', () => {
      expect(css).toMatch(/\.story-overlay\s*\{[^}]*position:\s*fixed;/);
      expect(css).toMatch(/\.story-overlay\s*\{[^}]*inset:\s*0;/);
      expect(css).toMatch(/\.story-overlay\s*\{[^}]*z-index:\s*1000;/);
      expect(css).toMatch(/\.story-overlay\s*\{[^}]*backdrop-filter:\s*blur\(4px\);/);
    });

    it('banner classes include banner-warn, banner-critical, banner-info', () => {
      expect(css).toMatch(/\.banner-warn\b/);
      expect(css).toMatch(/\.banner-critical\b/);
      expect(css).toMatch(/\.banner-info\b/);
    });

    it('interactive buttons and checkboxes respect WCAG 2.2 SC 2.5.8 (min 24x24px)', () => {
      // .btn-harvest target size
      expect(css).toMatch(/\.btn-harvest\s*\{[^}]*min-height:\s*24px;/);
      expect(css).toMatch(/\.btn-harvest\s*\{[^}]*min-width:\s*24px;/);

      // .btn-slot-action target size
      expect(css).toMatch(/\.btn-slot-action\s*\{[^}]*min-height:\s*24px;/);
      expect(css).toMatch(/\.btn-slot-action\s*\{[^}]*min-width:\s*24px;/);

      // .btn-dock / recruit-btn target size
      expect(css).toMatch(/(?:\.btn-dock|\.recruit-btn)[^{]*\{[^}]*min-height:\s*24px;/);

      // modal checkboxes target size
      expect(css).toMatch(/input\[type="checkbox"\]\s*\{[^}]*min-width:\s*24px;/);
      expect(css).toMatch(/input\[type="checkbox"\]\s*\{[^}]*min-height:\s*24px;/);
    });

    it('provides high contrast focus outline and supports prefers-contrast', () => {
      expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid/);
      expect(css).toMatch(/@media\s*\(\s*prefers-contrast:\s*more\s*\)/);
      expect(css).toMatch(/@media\s*\(\s*forced-colors:\s*active\s*\)/);
    });
  });

  describe('StoryMode improvements & Renown progress bar', () => {
    it('StoryMode fixes duplicate L prefix in bootSplash', () => {
      const storyModePath = resolve(__dirname, '../src/ui/StoryMode.ts');
      const storyModeCode = readFileSync(storyModePath, 'utf-8');
      // Should not do L${opts.title} if title already has level or is title
      // It should display opts.title or L${opts.title} cleaned
      expect(storyModeCode).not.toContain('L${opts.title}');
    });

    it('#hud-renown updates aria-valuenow in updatePlayerUI (src/app/panels.ts)', () => {
      // The HUD implementation moved out of main.ts during the src/app refactor.
      const panelsPath = resolve(__dirname, '../src/app/panels.ts');
      const panelsCode = readFileSync(panelsPath, 'utf-8');
      expect(panelsCode).toMatch(/hudRenown(\?|\.)setAttribute\(\s*['"]aria-valuenow['"]/);
    });
  });
});
