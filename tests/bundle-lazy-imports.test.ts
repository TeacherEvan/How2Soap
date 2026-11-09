import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Ensures lazy-loaded features (Three.js, gl/) are NOT statically imported
 * into the entrypoint. They must only be loaded via dynamic import().
 */

const FORBIDDEN_PATTERNS = [
  { pattern: /from ['"]three['"]/, desc: 'Three.js static import' },
  { pattern: /import ['"]three['"]/, desc: 'Three.js bare import' },
  { pattern: /import ['"].*\/gl\/.*['"]/, desc: 'gl/ module bare import' },
  { pattern: /import type ['"].*\/gl\/.*['"]/, desc: 'gl/ module type import (allowed)', allowed: true },
  { pattern: /import type \{[\s\S]*?\} from ['"].*\/gl\/.*['"]/, desc: 'gl/ module type import with braces (allowed)', allowed: true },
];

const ALLOWED_PATTERNS = [
  /import type ['"].*\/gl\/.*['"]/,  // type-only import: import type { X } from '...'
  /import type.*from ['"].*\/gl\/.*['"]/,  // type-only import with from clause
  /import type \{[\s\S]*?\} from ['"].*\/gl\/.*['"]/,  // type-only with braces
];

const ENTRY_FILES = [
  'src/main.ts',
  'src/app/state.ts',
  'src/app/dom.ts',
  'src/app/launcher.ts',
  'src/app/panels.ts',
  'src/app/views.ts',
  'src/app/workerMessages.ts',
  'src/app/autosave.ts',
  'src/app/splash.ts',
  'src/app/syncScheduler.ts',
];

describe('Bundle: lazy import hygiene', () => {
  for (const file of ENTRY_FILES) {
    it(`no forbidden static imports in ${file}`, () => {
      const fullPath = path.resolve(__dirname, '..', file);
      if (!fs.existsSync(fullPath)) {
        console.warn(`  ⚠️  ${file} not found, skipping`);
        return;
      }
      const content = fs.readFileSync(fullPath, 'utf8');

      for (const { pattern, desc, allowed } of FORBIDDEN_PATTERNS) {
        const matches = content.match(pattern);
        if (matches && !allowed) {
          // Check if it's an allowed type-only import
          const isAllowed = ALLOWED_PATTERNS.some(p => p.test(matches[0]));
          if (!isAllowed) {
            throw new Error(`${desc} found in ${file} — must use dynamic import() instead`);
          }
        }
      }
    });
  }
});

describe('Bundle: Three.js only in lazy chunks', () => {
  it('three package.json not in entrypoint deps', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
    expect(pkg.dependencies?.three).toBeDefined();
    expect(pkg.devDependencies?.three).toBeUndefined();
  });
});