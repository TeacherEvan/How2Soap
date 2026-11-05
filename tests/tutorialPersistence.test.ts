import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Tutorial Persistence & Lifecycle', () => {
  let elementsById: Map<string, any>;

  const createMockElement = (id = '', tagName = 'div') => {
    const classList = new Set<string>();
    const cachedChildren = new Map<string, any>();
    const el = {
      tagName: tagName.toUpperCase(),
      _id: id,
      get id() {
        return this._id;
      },
      set id(newId: string) {
        this._id = newId;
        if (newId) elementsById.set(newId, this);
      },
      innerHTML: '',
      textContent: '',
      style: {} as Record<string, string>,
      classList: {
        add: vi.fn((c: string) => classList.add(c)),
        remove: vi.fn((c: string) => classList.delete(c)),
        contains: vi.fn((c: string) => classList.has(c)),
      },
      appendChild: vi.fn((child: any) => child),
      remove: vi.fn(),
      prepend: vi.fn(),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      getAttribute: vi.fn((attr: string) => (attr === 'id' ? el._id : null)),
      getBoundingClientRect: vi.fn(() => ({ left: 10, top: 20, width: 100, height: 40 })),
      querySelector: vi.fn((sel: string) => {
        if (!cachedChildren.has(sel)) {
          const child = createMockElement(sel.startsWith('#') ? sel.slice(1) : '', 'button');
          cachedChildren.set(sel, child);
        }
        return cachedChildren.get(sel);
      }),
      querySelectorAll: vi.fn(() => []),
      onclick: null as any,
      click: function () {
        if (typeof this.onclick === 'function') this.onclick();
      },
    };
    if (id) elementsById.set(id, el);
    return el;
  };

  beforeEach(() => {
    elementsById = new Map();
    const mockDoc = {
      body: createMockElement('body', 'body'),
      getElementById: vi.fn((id: string) => elementsById.get(id) || null),
      querySelector: vi.fn((sel: string) => {
        if (sel.startsWith('#')) return elementsById.get(sel.slice(1)) || null;
        return null;
      }),
      querySelectorAll: vi.fn(() => []),
      createElement: vi.fn((tag: string) => {
        const el = createMockElement('', tag);
        return el;
      }),
    };
    vi.stubGlobal('document', mockDoc);
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('saves and restores tutorial progression snapshot cleanly', async () => {
    const { TutorialController } = await import('../src/ui/TutorialController');

    const dispatched: any[] = [];
    const controller = new TutorialController({
      onDispatchWorkerCommand: (cmd) => dispatched.push(cmd),
    });

    // Initial state check
    expect(controller.getActiveTier()).toBe('BEGINNER');
    const snap1 = controller.snapshot();
    expect(snap1.activeTier).toBe('BEGINNER');
    expect(snap1.activeLessonId).toBe('beg_1_forage');
    expect(snap1.completedLessonIds).toEqual([]);
    expect(snap1.phdTelemetryEnabled).toBe(false);
    expect(snap1.coachmarkDismissed).toBe(false);

    // Simulate completion check
    controller.checkProgress({
      state: {
        inventory: {
          items: [{ id: 'PINE_DEADFALL_WOOD', count: 2, massKg: 1.0 }],
        },
      },
      snapshot: null,
    });

    const snap2 = controller.snapshot();
    expect(snap2.completedLessonIds).toContain('beg_1_forage');
    expect(snap2.activeLessonId).toBe('beg_2_leach');

    // Destroy and restore into a fresh controller
    controller.destroy();

    const controller2 = new TutorialController({
      onDispatchWorkerCommand: (cmd) => dispatched.push(cmd),
    });
    controller2.restore(snap2);

    const restoredSnap = controller2.snapshot();
    expect(restoredSnap.activeTier).toBe('BEGINNER');
    expect(restoredSnap.activeLessonId).toBe('beg_2_leach');
    expect(restoredSnap.completedLessonIds).toContain('beg_1_forage');
    expect(restoredSnap.coachmarkDismissed).toBe(false);

    controller2.destroy();
  });

  it('handles coachmark dismissal and tier completion cleanly', async () => {
    const { TutorialController } = await import('../src/ui/TutorialController');

    const controller = new TutorialController({
      onDispatchWorkerCommand: () => {},
    });

    // Complete all beginner lessons
    controller.restore({
      activeTier: 'BEGINNER',
      activeLessonId: 'beg_5_salt_skim',
      completedLessonIds: ['beg_1_forage', 'beg_2_leach', 'beg_3_caustic', 'beg_4_saponify', 'beg_5_salt_skim'],
      phdTelemetryEnabled: true,
      coachmarkDismissed: false,
    });

    const coachmark = elementsById.get('tutorial-coachmark');
    expect(coachmark).toBeTruthy();
    expect(coachmark.innerHTML).toContain('Tier Complete!');

    // Dismiss coachmark
    const dismissBtn = coachmark.querySelector('#coachmark-dismiss-btn');
    expect(dismissBtn).toBeTruthy();
    dismissBtn.click();

    expect(controller.snapshot().coachmarkDismissed).toBe(true);

    controller.destroy();
  });
});
