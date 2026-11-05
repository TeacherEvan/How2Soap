import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Splash & Inter-Display Loading Transitions', () => {
  it('exports launchSplash and transitionDisplay functions', async () => {
    // Mock browser window globals before module import
    const fakeWindow: any = {
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
      setTimeout: (fn: Function, ms: number) => setTimeout(fn, ms),
      clearTimeout: (id: any) => clearTimeout(id),
    };
    const fakeDoc: any = {
      createElement: vi.fn((tag: string) => {
        const el: any = {
          tagName: tag.toUpperCase(),
          className: '',
          classList: {
            add: vi.fn(),
            remove: vi.fn(),
            toggle: vi.fn(),
          },
          setAttribute: vi.fn(),
          append: vi.fn(),
          appendChild: vi.fn(),
          remove: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          play: vi.fn().mockResolvedValue(undefined),
          innerHTML: '',
        };
        return el;
      }),
      body: {
        appendChild: vi.fn(),
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    (globalThis as any).window = fakeWindow;
    (globalThis as any).document = fakeDoc;

    const { launchSplash, transitionDisplay } = await import('../src/app/splash');

    expect(typeof launchSplash).toBe('function');
    expect(typeof transitionDisplay).toBe('function');

    launchSplash();
    expect(fakeDoc.createElement).toHaveBeenCalledWith('div');
    expect(fakeDoc.createElement).toHaveBeenCalledWith('video');
    expect(fakeDoc.body.appendChild).toHaveBeenCalled();

    const callback = vi.fn();
    transitionDisplay('Astrolabe Map', callback, 100);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('defines CSS classes for inter-display loading screens and animations', () => {
    const cssPath = resolve(__dirname, '../src/styles.css');
    const cssContent = readFileSync(cssPath, 'utf8');

    expect(cssContent).toContain('.display-loading-overlay');
    expect(cssContent).toContain('.display-loading-viewport');
    expect(cssContent).toContain('.display-loading-video');
    expect(cssContent).toContain('.display-loading-banner');
    expect(cssContent).toContain('.display-loading-spinner');
    expect(cssContent).toContain('.display-loading-title');
  });
});
