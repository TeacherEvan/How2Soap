/**
 * DOM element registry. Modules may only be imported after the static shell
 * markup exists (it ships inside public/index.html), which it does because
 * the production bundle is loaded with `defer`.
 */
export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as unknown as T;
};

export const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app missing');

export const isoBadge = $('isolation');
export const clock = $('clock');
export const pGlucose = $('p-glucose');
export const pTemp = $('p-temp');
export const pIclo = $('p-iclo');
export const valAdipose = $('val-adipose');
export const valHydration = $('val-hydration');
export const valAmbient = $('val-ambient');
export const valRenownTitle = $('val-renown-title');
export const hudRenown = $('hud-renown');
export const ringRenownFg = document.getElementById('ring-renown-fg') as SVGCircleElement | null;
export const bannersRow = $('banners');
export const vesselList = $('vessel-list');
export const vesselTitle = $('vessel-title');
export const vesselSub = $('vessel-sub');
export const rsTemp = $('rs-temp');
export const rsPh = $('rs-ph');
export const rsPressure = $('rs-pressure');
export const rsVolume = $('rs-volume');
export const questList = $('quest');
export const logList = $('log');
export const pauseButton = document.getElementById('pause') as HTMLButtonElement | null;
export const endTurnButton = document.getElementById('end-turn') as HTMLButtonElement | null;
export const skipTurnsButton = document.getElementById('skip-turns') as HTMLButtonElement | null;
export const dawnReportButton = document.getElementById('dawn-report') as HTMLButtonElement | null;

export const biomePanel = $('biome-panel-container');
export const toolInvPanel = $('tool-inv-container');
export const tabsNavContainer = $('workbench-tabs-container');
export const tabReactions = $('tab-reactions-content');
export const tabFabrication = $('tab-fabrication-content');
export const tabPaddocks = $('tab-paddocks-content');
export const tabStrategy = $('tab-strategy-content');
export const tabJournal = $('tab-journal-content');
