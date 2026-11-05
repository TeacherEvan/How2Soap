/**
 * Feature-window launcher — the rail that opens single-purpose windows.
 * Lazy-loads each window module on first open (never in the eager bundle).
 */
import { WindowManager } from '../ui/WindowManager';

interface Launchable {
  id: string;
  icon: string;
  label: string;
  key: string;
  load: () => Promise<{ spec: Parameters<typeof WindowManager.open>[0] }>;
}

const WINDOWS: Launchable[] = [
  { id: 'reactions', icon: '🔬', label: 'Workbench', key: '1', load: () => import('../ui/windows/ReactionsWindow') },
  { id: 'fabrication', icon: '🔨', label: 'Fabrication', key: '2', load: () => import('../ui/windows/FabricationWindow') },
  { id: 'paddocks', icon: '🌾', label: 'Paddocks', key: '3', load: () => import('../ui/windows/PaddocksWindow') },
  { id: 'biome', icon: '🧭', label: 'Biome', key: '4', load: () => import('../ui/windows/BiomeWindow') },
  { id: 'realm', icon: '🏛️', label: 'The Realm', key: '6', load: () => import('../ui/windows/RealmWindow') },
];

export async function openWindowById(id: string): Promise<boolean> {
  const entry = WINDOWS.find((w) => w.id === id);
  if (!entry) return false;
  await import('../ui/windows/windows.css');
  const mod = await entry.load();
  WindowManager.open(mod.spec);
  return true;
}

export function initLauncher(): void {
  const rail = document.getElementById('window-launcher');
  if (rail) {
    rail.innerHTML = `
      <span class="window-launcher-label">Windows</span>
      ${WINDOWS.map((w) => `
        <button class="launcher-btn" type="button" data-window="${w.id}" aria-label="Open ${w.label} window (key ${w.key})">
          <span aria-hidden="true">${w.icon}</span>${w.label}<kbd class="launcher-key">${w.key}</kbd>
        </button>`).join('')}
    `;
    rail.querySelectorAll<HTMLButtonElement>('.launcher-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        void openWindowById(btn.dataset.window!);
      });
    });
  }

  document.getElementById('btn-open-reactions')?.addEventListener('click', () => {
    void openWindowById('reactions');
  });

  // Keyboard shortcuts — never while the user is typing in a field.
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && target.closest('input, select, textarea, [contenteditable="true"]')) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const entry = WINDOWS.find((w) => w.key === event.key);
    if (entry) {
      event.preventDefault();
      void openWindowById(entry.id);
    } else if (event.key === '0') {
      WindowManager.closeAll();
    }
  });
}
