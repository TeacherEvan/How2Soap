/**
 * Feature-window launcher & Council registry — single source of truth for all launchable windows.
 * Lazy-loads each window module on first open (never in the eager bundle).
 */
import { WindowManager } from '../ui/WindowManager';

export type Pillar = 'craft' | 'colony' | 'domain' | 'hearth';

export interface LaunchableWindow {
  id: string;
  icon: string;
  label: string;
  key?: string;
  pillar: Pillar;
  enabled?: boolean;
  load: () => Promise<{ spec: Parameters<typeof WindowManager.open>[0] }>;
}

export const FEATURE_WINDOWS: LaunchableWindow[] = [
  // ⚒ Craft
  { id: 'reactions', icon: '🔬', label: 'Workbench', key: '1', pillar: 'craft', load: () => import('../ui/windows/ReactionsWindow') },
  { id: 'fabrication', icon: '🔨', label: 'Fabrication & Pack', key: '2', pillar: 'craft', load: () => import('../ui/windows/FabricationWindow') },
  { id: 'paddocks', icon: '🌾', label: 'Paddocks', key: '3', pillar: 'craft', load: () => import('../ui/windows/PaddocksWindow') },

  // 🏘 Colony
  { id: 'biome', icon: '🧭', label: 'Biome Survey', key: '4', pillar: 'colony', load: () => import('../ui/windows/BiomeWindow') },
  { id: 'settlement', icon: '🏘️', label: 'Settlement', key: '5', pillar: 'colony', load: () => import('../ui/windows/SettlementWindow') },

  // 🌐 Domain
  { id: 'realm', icon: '🏛️', label: 'The Realm', key: '6', pillar: 'domain', load: () => import('../ui/windows/RealmWindow') },
  { id: 'influence', icon: '🌐', label: 'Influence', key: '9', pillar: 'domain', load: () => import('../ui/windows/InfluenceWindow') },

  // 🕯 Hearth
  { id: 'chronicle', icon: '📜', label: 'Chronicle', key: '7', pillar: 'hearth', load: () => import('../ui/windows/ChronicleWindow') },
  { id: 'commissions', icon: '🎯', label: 'Day Commissions', key: '8', pillar: 'hearth', enabled: true, load: () => import('../ui/windows/CommissionsWindow') },
];

export async function openWindowById(id: string): Promise<boolean> {
  const entry = FEATURE_WINDOWS.find((w) => w.id === id);
  if (!entry || entry.enabled === false) return false;
  await import('../ui/windows/windows.css');
  const mod = await entry.load();
  WindowManager.open(mod.spec);
  return true;
}

export function initGlobalWindowShortcuts(): void {
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && target.closest('input, select, textarea, [contenteditable="true"]')) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const entry = FEATURE_WINDOWS.find((w) => w.key === event.key);
    if (entry && entry.enabled !== false) {
      event.preventDefault();
      void openWindowById(entry.id);
    } else if (event.key === '0') {
      WindowManager.closeAll();
    }
  });
}

// Retain legacy initLauncher symbol for backwards-compatibility during refactor
export function initLauncher(): void {
  initGlobalWindowShortcuts();
}
