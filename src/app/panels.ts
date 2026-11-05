/**
 * Tab routing, paddock panel, survival HUD ("player panel") and the biome tree.
 */
import { renderBiomeTreePanel } from '../ui/BiomeTreePanel';
import { renderToolAndInventoryPanel } from '../ui/ToolAndInventoryPanel';
import {
  renderWorkbenchTabs,
  renderFabricationTab,
  renderPaddockTab,
  type WorkbenchTab,
} from '../ui/WorkbenchCanvas';
import { mountJournal } from '../ui/JournalPanel';
import { bannerModel, treatmentModel } from '../ui/panelModels';
import { levelFromRenown } from '../engine/progression';
import { calculateHarvestTotalCostKcal, type HarvestablePart, type BiomeSpeciesNode } from '../data/biomeNodes';
import { audio } from '../ui/audio';
import { transitionDisplay } from './splash';
import { state, selectedIndex, send } from './state';
import { openWindowById } from './launcher';
import {
  pGlucose,
  pTemp,
  pIclo,
  valAdipose,
  valHydration,
  valAmbient,
  valRenownTitle,
  hudRenown,
  ringRenownFg,
  bannersRow,
  toolInvPanel,
  tabsNavContainer,
  tabReactions,
  tabFabrication,
  tabPaddocks,
  tabStrategy,
  tabJournal,
  biomePanel,
} from './dom';
import { renderLog } from './views';

export function updatePaddockUI(): void {
  renderPaddockTab(
    tabPaddocks,
    state.paddock,
    () => {
      send({ type: 'FEED_PADDOCK', massKg: 5 });
    },
    () => {
      send({ type: 'WATER_PADDOCK', liters: 10 });
    },
    (species) => {
      send({ type: 'CAPTURE_ANIMAL', species });
    },
  );
}

export function switchTab(tab: WorkbenchTab): void {
  const previousTab = state.activeTab;
  if (previousTab === tab) return;

  const tabLabels: Record<WorkbenchTab, string> = {
    REACTIONS: 'Reactions Apparatus',
    FABRICATION: 'Fabrication Workshop',
    PADDOCKS: 'Fauna Paddocks',
    STRATEGY: 'Astrolabe Strategy Map',
    JOURNAL: 'Chronicle & Council',
  };

  const applyTabSwitch = (): void => {
    state.activeTab = tab;
    renderWorkbenchTabs(tabsNavContainer, {
      currentTab: tab,
      onSelectTab: switchTab,
      onExecuteRecipe: (recipeId) => send({ type: 'FABRICATE', recipeId }),
      onFeedPaddock: () => {
        send({ type: 'FEED_PADDOCK', massKg: 5 });
      },
      onWaterPaddock: () => {
        send({ type: 'WATER_PADDOCK', liters: 10 });
      },
    });

    tabReactions.classList.toggle('hidden', tab !== 'REACTIONS');
    tabFabrication.classList.toggle('hidden', tab !== 'FABRICATION');
    tabPaddocks.classList.toggle('hidden', tab !== 'PADDOCKS');
    tabStrategy.classList.toggle('hidden', tab !== 'STRATEGY');
    tabJournal.classList.toggle('hidden', tab !== 'JOURNAL');

    if (tab === 'FABRICATION') {
      renderFabricationTab(tabFabrication, (recipeId) => {
        send({ type: 'FABRICATE', recipeId });
        state.log.push(`Fabricated recipe ${recipeId}`);
        renderLog();
      });
    } else if (tab === 'PADDOCKS') {
      updatePaddockUI();
    } else if (tab === 'STRATEGY') {
      if (state.strategyMap) {
        (state.strategyMap as any).options.onHarvestBoost = (speciesId: string, bonus: boolean) => {
          audio.harvestThud();
          send({
            type: 'HARVEST_PART',
            partId: speciesId.includes('TREE') ? 'OAK_HEARTWOOD_LOG' : 'HALITE_ORE',
            speciesId,
            carriedMassKg: 0,
            toolSlot: 'PERCUSSION_MINING',
            distanceMeters: 50,
          });
          if (bonus) {
            audio.clink();
            state.log.push(`★ Bonus harvest! Clean strike boost!`);
          }
          renderLog();
        };
      }
      state.strategyMap?.resizeCanvas();
    } else if (tab === 'JOURNAL') {
      mountJournal(tabJournal, state.progression);
    }
  };

  // If this is initial boot before any tab was selected, switch directly without loading veil
  if (!previousTab) {
    applyTabSwitch();
  } else {
    transitionDisplay(tabLabels[tab] || 'Alchemical Workshop', applyTabSwitch, 380);
  }
}

export function renderBiomeExplorerTree(): void {
  renderBiomeTreePanel(
    biomePanel,
    (part: HarvestablePart, species: BiomeSpeciesNode) => {
      audio.harvestThud();
      send({
        type: 'HARVEST_PART',
        partId: part.id,
        speciesId: species.id,
        carriedMassKg: 0,
        toolSlot: part.requiredToolSlot ?? 'PERCUSSION_MINING',
        distanceMeters: species.baseDistanceMeters,
      });
      state.log.push(`Harvested ${part.name} (${part.description})`);
      renderLog();
    },
    (part, distance) => {
      const equipped = part.requiredToolSlot ? state.inventory.tools[part.requiredToolSlot] : null;
      const mohs = equipped?.mohs ?? 1.0;
      const ma = equipped ? 2.0 : 1.0;
      return calculateHarvestTotalCostKcal(
        part.baseWorkJoules,
        mohs,
        part.targetMohs,
        ma,
        distance,
        0,
      );
    },
  );

  const dossierBtn = document.createElement('button');
  dossierBtn.className = 'ghost biome-dossier-btn';
  dossierBtn.type = 'button';
  dossierBtn.textContent = '⤢ Open Biome Dossier (4)';
  dossierBtn.title = 'Full-screen Biome Explorer with species dossiers and yields';
  dossierBtn.addEventListener('click', () => {
    void openWindowById('biome');
  });
  biomePanel.appendChild(dossierBtn);
}

export function updatePlayerUI(): void {
  pGlucose.textContent = `${state.player.glucoseKcal} kcal`;
  pTemp.textContent = `${state.player.coreTempC} °C`;
  pIclo.textContent = `${state.player.clothingIclo.toFixed(2)} clo`;

  if (valAdipose) valAdipose.textContent = `${Math.round(state.player.adiposeKcal).toLocaleString()} kcal`;
  if (valHydration) valHydration.textContent = `${Math.round(state.player.hydrationPct)}%`;
  if (valAmbient) valAmbient.textContent = `${Math.round(state.player.ambientTempK)} K`;

  const renownInfo = levelFromRenown(state.progression.renown);
  if (valRenownTitle) valRenownTitle.textContent = `L${renownInfo.level} · ${renownInfo.title}`;
  if (hudRenown) {
    const pctNow = renownInfo.span > 0 ? Math.round((renownInfo.intoLevel / renownInfo.span) * 100) : 100;
    hudRenown.setAttribute('aria-valuenow', `${pctNow}`);
  }
  if (ringRenownFg) {
    const circumference = 2 * Math.PI * 15.5; // ≈ 97.389
    const pct = renownInfo.span > 0 ? Math.min(1, renownInfo.intoLevel / renownInfo.span) : 1;
    const offset = circumference * (1 - pct);
    ringRenownFg.style.strokeDasharray = `${circumference}`;
    ringRenownFg.style.strokeDashoffset = `${offset}`;
  }

  // Update Realm Strip Chips
  if (state.realm) {
    const healthEl = document.getElementById('val-health');
    const safetyEl = document.getElementById('val-safety');
    const vigorEl = document.getElementById('val-vigor');
    const mandateEl = document.getElementById('val-mandate');
    const hudHealth = document.getElementById('hud-health');
    const hudSafety = document.getElementById('hud-safety');
    const hudVigor = document.getElementById('hud-vigor');
    const hudMandate = document.getElementById('hud-mandate');

    if (healthEl) healthEl.textContent = `${state.realm.health}%`;
    if (safetyEl) safetyEl.textContent = `${state.realm.safety}%`;
    if (vigorEl) vigorEl.textContent = `${state.realm.vigor}%`;
    const minEstate = Math.min(state.realm.estates.crown, state.realm.estates.army, state.realm.estates.public);
    if (mandateEl) mandateEl.textContent = `${minEstate}%`;

    if (hudHealth) hudHealth.setAttribute('aria-valuenow', String(state.realm.health));
    if (hudSafety) hudSafety.setAttribute('aria-valuenow', String(state.realm.safety));
    if (hudVigor) hudVigor.setAttribute('aria-valuenow', String(state.realm.vigor));
    if (hudMandate) hudMandate.setAttribute('aria-valuenow', String(minEstate));
  }

  // Update banners
  const banners = bannerModel(state.player, state.crisis);
  bannersRow.innerHTML = banners
    .map(b => `<div class="banner banner-${b.severity}">${b.text}</div>`)
    .join('');

  // Active treatments
  const treatments = treatmentModel(state.items, state.player);

  renderToolAndInventoryPanel(toolInvPanel, state.inventory, {
    onCraftBackpack: () => {
      audio.clink();
      send({ type: 'FABRICATE', recipeId: 'RECIPE_STITCH_BACKPACK' });
    },
    onEatFood: (itemId) => {
      audio.munch();
      send({ type: 'EAT_FOOD', itemId });
    },
    onEquipTool: (itemId, slot) => {
      audio.clink();
      send({ type: 'EQUIP_TOOL', itemId, slot });
      renderBiomeExplorerTree();
    },
    onAdministerTreatment: (itemId) => {
      audio.sealDone();
      send({ type: 'APPLY_TREATMENT', itemId });
    },
    onChargeToVessel: (itemId) => {
      audio.clink();
      const v = state.vessels[selectedIndex()];
      // Worker command is CHARGE_ITEM (vesselId + itemId + count) — see sim.worker.ts.
      if (v) send({ type: 'CHARGE_ITEM', vesselId: v.id, itemId, count: 1 });
    },
    treatments,
    isDead: state.player.conditions?.dead,
  });

  // Render Timed Requests into Right Panel or dedicated container
  let reqContainer = document.getElementById('timed-requests-container');
  if (!reqContainer) {
    reqContainer = document.createElement('div');
    reqContainer.id = 'timed-requests-container';
    toolInvPanel.prepend(reqContainer);
  }
  import('../ui/TimedRequestsWidget').then(({ renderTimedRequestsWidget }) => {
    if (reqContainer) {
      renderTimedRequestsWidget(
        reqContainer,
        (state as any).timedRequests,
        state.snapshot?.tick ?? 0,
        (slot) => {
          audio.clink();
          send({ type: 'FULFILL_REQUEST', slot });
        },
      );
    }
  });
}
