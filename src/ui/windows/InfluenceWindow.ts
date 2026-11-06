/**
 * Milestone M6/M7: The Influence Window (Key 9)
 * (§6.29, §6.30)
 *
 * Full window with 5 tabs:
 * 1. Stance (Court, Watch, Towns, Guilds, Frontier clans)
 * 2. Independent Powers (4 Powers, Befriend, Levy, Incite, Incorporate)
 * 3. Threats (The Wasting, Pale Raids, Rival Marches, Cave-Ins)
 * 4. Built Works (Lime-cement, Leather rope, Casein glue, Acids, Wood-composite, Military engines)
 * 5. Missions & Operatives (5 operatives, 7 verbs, seeded probability triads)
 */
import type { WindowSpec } from '../WindowManager';
import {
  createInitialInfluenceState,
  type InfluenceState,
  type PowerAction,
} from '../../engine/campaign/influence';
import {
  NAMED_CORRESPONDENTS,
  createInitialCorrespondence,
  type CorrespondenceState,
} from '../../engine/campaign/correspondence';
import {
  BUILT_WORKS_DEFS,
  createInitialBuiltWorks,
  type BuiltWorksState,
} from '../../engine/campaign/builtWorks';
import {
  createInitialMissions,
  type MissionsState,
  type MissionVerb,
} from '../../engine/campaign/missions';
import type { UndertowStance } from '../../engine/campaign/victories';
import { state, send, campaignListeners } from '../../app/state';

function influenceState(): InfluenceState {
  return state.influence ?? createInitialInfluenceState(1);
}
function correspondenceState(): CorrespondenceState {
  return state.correspondence ?? createInitialCorrespondence();
}
function builtWorksState(): BuiltWorksState {
  return state.builtWorks ?? createInitialBuiltWorks();
}
function missionsState(): MissionsState {
  return state.missions ?? createInitialMissions();
}

function estateMood(value: number): string {
  const label = value >= 70 ? 'Pleased' : value >= 50 ? 'Warm' : value >= 30 ? 'Wary' : 'Hostile';
  return `${label} (${value}/100)`;
}

function renderStances(): string {
  const stance = state.victories?.undertowStance ?? 'IGNORE';
  const estates = state.realm?.estates;
  const crown = estates?.crown ?? 60;
  const army = estates?.army ?? 60;
  const pub = estates?.public ?? 60;
  const stances = [
    { name: 'The Court', mood: estateMood(crown), demand: 'Demands regular soap consignments and royal tribute.', icon: '👑' },
    { name: 'The Watch', mood: estateMood(army), demand: 'Demands forged spears and timely frontier stipends.', icon: '🛡️' },
    { name: 'The Towns', mood: estateMood(pub), demand: 'Demands clean water, disease prevention, and tallow.', icon: '🏘️' },
    { name: 'The Guilds', mood: estateMood(Math.round((crown + pub) / 2)), demand: 'Demands lower tariffs on convoy goods and chemical patents.', icon: '⚖️' },
    { name: 'Frontier Clans', mood: estateMood(army), demand: 'Demands respect for sacred groves and fair trade.', icon: '🏹' },
  ];

  return `
    <div class="stance-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
      ${stances
        .map(
          (s) => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem;">
            <strong style="font-size: 1.05rem;">${s.icon} ${s.name}</strong>
            <span style="font-size: 0.85rem; color: #5aa5ff;">${s.mood}</span>
          </div>
          <p style="font-size: 0.85rem; color: var(--muted); margin: 0;">${s.demand}</p>
        </div>
      `,
        )
        .join('')}
    </div>

    <!-- The Undertow (Dissident Movement & Republic Victory Path, §6.29) -->
    <div class="undertow-section" style="background: rgba(198,120,221,0.05); border: 1px solid rgba(198,120,221,0.25); border-radius: 6px; padding: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem;">
        <strong style="font-size: 1.1rem; color: #c678dd;">⚖️ The Undertow (Dissident Movement)</strong>
        <span style="font-size: 0.8rem; text-transform: uppercase; padding: 2px 8px; border-radius: 10px; background: rgba(198,120,221,0.2); color: #c678dd;">
          Stance: ${stance}
        </span>
      </div>
      <p style="font-size: 0.85rem; color: #c9d1d9; margin: 0 0 0.8rem; line-height: 1.5;">
        A clandestine confederation of tanners, soapmakers, and pamphleteers operating in the shadow of the Court.
        Aligning with them unlocks the radical Age III alternate victory: <em>The Republic of Compound</em>.
      </p>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button class="btn-surgical btn-undertow" data-stance="FEED" style="padding: 4px 10px; font-size: 0.8rem;">
          Feed (Leak Court Secrets)
        </button>
        <button class="btn-surgical btn-undertow" data-stance="JOIN" style="padding: 4px 10px; font-size: 0.8rem; background: rgba(198,120,221,0.2);">
          Join (Lead The Undertow)
        </button>
        <button class="btn-surgical btn-undertow" data-stance="SUPPRESS" style="padding: 4px 10px; font-size: 0.8rem;">
          Suppress (Armed Crackdown)
        </button>
        <button class="btn-surgical btn-undertow" data-stance="IGNORE" style="padding: 4px 10px; font-size: 0.8rem;">
          Ignore (Wait & Watch)
        </button>
      </div>
    </div>
  `;
}

function renderPowers(): string {
  const inf = influenceState();
  return `
    <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
      <span>Available Influence: <strong style="color: #5aa5ff; font-size: 1.1rem;">${inf.currentInfluencePool}</strong></span>
      <span>Suzerainties: <strong>${inf.suzerainCount}</strong></span>
    </div>
    <div class="powers-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem;">
      ${inf.powers
        .map(
          (p) => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <strong style="font-size: 1.05rem;">${p.name}</strong>
            <span style="font-size: 0.75rem; text-transform: uppercase; padding: 2px 6px; background: rgba(90,165,255,0.15); border-radius: 4px; color: #5aa5ff;">${p.status}</span>
          </div>
          <p style="font-size: 0.85rem; color: var(--muted); margin: 0.5rem 0;">${p.description}</p>
          <div style="font-size: 0.85rem; margin-bottom: 0.5rem;">
            <div>Influence: <strong>${p.influence}/100</strong></div>
            <div style="color: #6ed39e; margin-top: 0.25rem;"><em>Bonus: ${p.suzerainBonus}</em></div>
            <div style="color: var(--muted); margin-top: 0.25rem; font-size: 0.8rem;">${p.demands}</div>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem;">
            <button class="btn-surgical btn-power-action" data-power="${p.id}" data-action="BEFRIEND" style="padding: 4px 10px; font-size: 0.8rem;">Befriend (-10 Inf)</button>
            <button class="btn-surgical btn-power-action" data-power="${p.id}" data-action="LEVY" style="padding: 4px 10px; font-size: 0.8rem;">Levy Aid (-15 Inf)</button>
            <button class="btn-surgical btn-power-action" data-power="${p.id}" data-action="INCITE" style="padding: 4px 10px; font-size: 0.8rem;">Incite (-12 Inf)</button>
            <button class="btn-surgical btn-power-action" data-power="${p.id}" data-action="INCORPORATE" style="padding: 4px 10px; font-size: 0.8rem;">Incorporate (-30 Inf)</button>
          </div>
        </div>
      `,
        )
        .join('')}
    </div>
  `;
}

function renderThreats(): string {
  const threats: Array<{ title: string; severity: string; eta: string; desc: string }> = [];
  const crisis = state.crisis;
  if (crisis?.active) {
    threats.push({
      title: crisis.active.title,
      severity: `Tier ${crisis.active.severity} (Active)`,
      eta: 'Resolve now',
      desc: crisis.active.description,
    });
  } else if (crisis?.telegraph) {
    threats.push({
      title: `Incoming: ${crisis.telegraph.crisisId.replace(/_/g, ' ')}`,
      severity: `Tier ${crisis.telegraph.severity} (Telegraphed)`,
      eta: `${crisis.telegraph.watchesUntil} watch(es)`,
      desc: 'The omens are converging. Prepare a response before it fires.',
    });
  }
  const realm = state.realm;
  if (realm) {
    if (realm.health < 60) {
      threats.push({
        title: 'The Wasting (Plague Decay)',
        severity: `Public Health ${realm.health}%`,
        eta: 'Ongoing',
        desc: 'Tenement illness is outpacing the soap and willow supply.',
      });
    }
    if (realm.safety < 60) {
      threats.push({
        title: 'Frontier Security',
        severity: `Public Safety ${realm.safety}%`,
        eta: 'Ongoing',
        desc: 'Raiders and unrest are eroding the Watch coverage.',
      });
    }
    if (realm.estates.public < 40) {
      threats.push({
        title: 'Dissident Pamphleteers',
        severity: 'Public Estate critical',
        eta: 'Unrest risk',
        desc: 'Agitators question laboratory resource consumption in the main square.',
      });
    }
  }
  if (threats.length === 0) {
    threats.push({
      title: 'No active threats',
      severity: 'Quiet',
      eta: '—',
      desc: 'The Realm is stable and the crisis director is idle.',
    });
  }

  return `
    <div class="threats-list" style="display: flex; flex-direction: column; gap: 1rem;">
      ${threats
        .map(
          (t) => `
        <div style="background: rgba(255,60,60,0.05); border: 1px solid rgba(255,100,100,0.2); border-radius: 6px; padding: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <strong style="color: #ff8c8c; font-size: 1.05rem;">⚠️ ${t.title}</strong>
            <span style="font-size: 0.8rem; color: #ffbcbc;">${t.eta}</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--muted); margin-top: 0.4rem;">${t.desc}</div>
        </div>
      `,
        )
        .join('')}
    </div>
  `;
}

function renderCorrespondence(): string {
  const correspondence = correspondenceState();
  return `
    <div class="letters-list" style="display: flex; flex-direction: column; gap: 1rem;">
      ${correspondence.letters
        .map((l) => {
          const sender = NAMED_CORRESPONDENTS.find((c) => c.id === l.correspondentId) ?? NAMED_CORRESPONDENTS[0];
          return `
          <div style="background: rgba(240, 230, 210, 0.05); border-left: 4px solid ${sender.sealColor}; border-radius: 4px; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <strong>${sender.name} — <span style="font-size: 0.85rem; color: var(--muted);">${sender.title}</span></strong>
              <span style="font-size: 0.8rem; color: var(--muted);">Turn ${l.turnReceived}</span>
            </div>
            <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 0.35rem; color: #e6e6e6;">${l.subject}</div>
            <p style="font-size: 0.88rem; line-height: 1.45; color: #c4c4c4; margin: 0;">${l.body}</p>
          </div>
        `;
        })
        .join('')}
    </div>
  `;
}

function renderBuiltWorks(): string {
  const builtWorks = builtWorksState();
  return `
    <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
      <span>Engineering Canon Completed: <strong style="color: #e5b567; font-size: 1.1rem;">${builtWorks.engineeringCanonCount}</strong></span>
      <span>Public Health Infrastructure: <strong style="color: #6ed39e;">+${builtWorks.activeHealthBonusPerTurn}/turn</strong></span>
    </div>
    <div class="built-works-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem;">
      ${BUILT_WORKS_DEFS.map((work) => {
        const isDone = !!builtWorks.works[work.id];
        return `
          <div style="background: rgba(255,255,255,0.03); border: 1px solid ${isDone ? '#6ed39e' : 'rgba(255,255,255,0.1)'}; border-radius: 6px; padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <strong style="font-size: 1.05rem;">${work.name}</strong>
              <span style="font-size: 0.75rem; text-transform: uppercase; padding: 2px 6px; background: ${isDone ? 'rgba(110,211,158,0.15)' : 'rgba(255,255,255,0.08)'}; border-radius: 4px; color: ${isDone ? '#6ed39e' : 'var(--muted)'};">
                ${isDone ? 'Built' : 'Available'}
              </span>
            </div>
            <div style="font-size: 0.8rem; color: #5aa5ff; margin: 0.35rem 0;">Chemistry: ${work.chemistryRecipe}</div>
            <p style="font-size: 0.85rem; color: var(--muted); margin: 0.4rem 0;">${work.effectDesc}</p>
            <div style="font-size: 0.8rem; color: #e5b567; margin-bottom: 0.6rem;">Unlocks: ${work.unlocks}</div>
            ${
              isDone
                ? '<div style="font-size: 0.85rem; color: #6ed39e;">✓ Structural work operational across Realm.</div>'
                : `<button class="btn-surgical btn-construct-work" data-work="${work.id}" style="padding: 4px 12px; font-size: 0.85rem;">Construct Work</button>`
            }
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderMissions(): string {
  const missions = missionsState();
  return `
    <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
      <span>Missions Dispatched: <strong style="color: #5aa5ff; font-size: 1.1rem;">${missions.missionsDispatchedCount}</strong></span>
      <span>Active Operatives: <strong>${missions.operatives.filter((o) => !o.isDismissed).length} / 5</strong></span>
    </div>
    <div class="operatives-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem;">
      ${missions.operatives.map((op) => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <strong style="font-size: 1.05rem;">${op.name}</strong>
            <span style="font-size: 0.75rem; text-transform: uppercase; padding: 2px 6px; background: rgba(90,165,255,0.15); border-radius: 4px; color: #5aa5ff;">${op.role}</span>
          </div>
          <div style="font-size: 0.85rem; margin: 0.5rem 0; color: var(--muted);">
            <div>Skill: <strong>${op.primarySkill} (${op.skillValue}/5)</strong> · Wage: <strong>${op.wagePerTurn} Trade/turn</strong></div>
            <div>Loyalty: <strong>${op.loyalty}%</strong> · Status: <strong>${op.isDismissed ? '<span style="color:#ff5050;">Dismissed</span>' : 'Active'}</strong></div>
          </div>
          ${
            op.isDismissed
              ? '<div style="font-size: 0.8rem; color: #ff5050;">Operative dismissed for cowardice of profession.</div>'
              : `
              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.5rem;">
                <button class="btn-surgical btn-mission-exec" data-op="${op.id}" data-verb="SCOUT" style="padding: 3px 8px; font-size: 0.75rem;">Scout</button>
                <button class="btn-surgical btn-mission-exec" data-op="${op.id}" data-verb="STEAL_SCHEMA" style="padding: 3px 8px; font-size: 0.75rem;">Steal Schema</button>
                <button class="btn-surgical btn-mission-exec" data-op="${op.id}" data-verb="RAISE_LEVY" style="padding: 3px 8px; font-size: 0.75rem;">Raise Levy</button>
                <button class="btn-surgical btn-mission-exec" data-op="${op.id}" data-verb="DRESS_WOUND" style="padding: 3px 8px; font-size: 0.75rem;">Dress Wound</button>
                <button class="btn-surgical btn-mission-exec" data-op="${op.id}" data-verb="SILENCE_PAMPHLETIST" style="padding: 3px 8px; font-size: 0.75rem;">Silence Pamphlet</button>
              </div>
            `
          }
        </div>
      `).join('')}
    </div>
  `;
}

let mountedBody: HTMLElement | null = null;
let activeTab = 'stance';

function renderTab(tab: string): string {
  if (tab === 'powers') return renderPowers();
  if (tab === 'threats') return renderThreats();
  if (tab === 'works') return renderBuiltWorks();
  if (tab === 'missions') return renderMissions();
  if (tab === 'letters') return renderCorrespondence();
  return renderStances();
}

function renderActiveTab(): void {
  if (!mountedBody || !mountedBody.isConnected) {
    mountedBody = null;
    return;
  }
  const content = mountedBody.querySelector('#influence-tab-content') as HTMLElement | null;
  if (!content) return;
  content.innerHTML = renderTab(activeTab);
  attachActions(mountedBody);
}

/** Called by the worker CAMPAIGN_SYNC handler while this window is open. */
export function refreshInfluenceWindow(): void {
  renderActiveTab();
}

const onCampaignSync = (): void => renderActiveTab();

function attachActions(body: HTMLElement): void {
  if (activeTab === 'stance') attachStanceActions(body);
  else if (activeTab === 'powers') attachPowerActions(body);
  else if (activeTab === 'works') attachBuiltWorksActions(body);
  else if (activeTab === 'missions') attachMissionActions(body);
}

export const spec: WindowSpec = {
  id: 'influence',
  title: 'The Influence Window & Foreign Stance',
  icon: '🌐',
  size: 'full',
  mount(body: HTMLElement) {
    mountedBody = body;
    activeTab = 'stance';
    body.innerHTML = `
      <div class="influence-container" style="display: flex; flex-direction: column; height: 100%; gap: 1rem; color: var(--fg);">
        <nav class="influence-tabs" style="display: flex; gap: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;">
          <button class="btn-surgical tab-btn active" data-tab="stance" style="padding: 6px 14px;">Stance</button>
          <button class="btn-surgical tab-btn" data-tab="powers" style="padding: 6px 14px;">Independent Powers</button>
          <button class="btn-surgical tab-btn" data-tab="threats" style="padding: 6px 14px;">Threats & Pressure</button>
          <button class="btn-surgical tab-btn" data-tab="works" style="padding: 6px 14px;">Built Works</button>
          <button class="btn-surgical tab-btn" data-tab="missions" style="padding: 6px 14px;">Missions & Operatives</button>
          <button class="btn-surgical tab-btn" data-tab="letters" style="padding: 6px 14px;">Correspondence</button>
        </nav>
        <div id="influence-tab-content" style="flex: 1; overflow-y: auto;">
          ${renderStances()}
        </div>
      </div>
    `;

    const tabBtns = body.querySelectorAll<HTMLButtonElement>('.tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.dataset.tab ?? 'stance';
        renderActiveTab();
      });
    });

    attachStanceActions(body);
    campaignListeners.add(onCampaignSync);
  },
  unmount() {
    campaignListeners.delete(onCampaignSync);
    mountedBody = null;
  },
};

function showBanner(body: HTMLElement, message: string, ok: boolean): void {
  const content = body.querySelector('#influence-tab-content') as HTMLElement | null;
  if (!content) return;
  const banner = document.createElement('div');
  banner.style.padding = '8px';
  banner.style.marginBottom = '8px';
  banner.style.background = ok ? 'rgba(80,200,120,0.15)' : 'rgba(255,80,80,0.15)';
  banner.style.border = `1px solid ${ok ? '#50c878' : '#ff5050'}`;
  banner.style.borderRadius = '4px';
  banner.textContent = message;
  content.prepend(banner);
}

function attachBuiltWorksActions(body: HTMLElement) {
  body.querySelectorAll<HTMLButtonElement>('.btn-construct-work').forEach((btn) => {
    btn.addEventListener('click', () => {
      const workId = btn.dataset.work!;
      send({ type: 'CONSTRUCT_BUILT_WORK', workId });
      showBanner(body, 'Construction order dispatched to the Realm.', true);
    });
  });
}

function attachMissionActions(body: HTMLElement) {
  body.querySelectorAll<HTMLButtonElement>('.btn-mission-exec').forEach((btn) => {
    btn.addEventListener('click', () => {
      const operativeId = btn.dataset.op!;
      const verb = btn.dataset.verb! as MissionVerb;
      send({ type: 'EXECUTE_MISSION', operativeId, verb });
      showBanner(body, 'Mission dispatched — awaiting the operative report.', true);
    });
  });
}

function attachPowerActions(body: HTMLElement) {
  body.querySelectorAll<HTMLButtonElement>('.btn-power-action').forEach((btn) => {
    btn.addEventListener('click', () => {
      const powerId = btn.dataset.power!;
      const action = btn.dataset.action! as PowerAction;
      send({ type: 'POWER_ACTION', powerId, action });
      showBanner(body, 'Diplomatic order dispatched.', true);
    });
  });
}

function attachStanceActions(body: HTMLElement) {
  body.querySelectorAll<HTMLButtonElement>('.btn-undertow').forEach((btn) => {
    btn.addEventListener('click', () => {
      send({ type: 'SET_UNDERTOW_STANCE', stance: btn.dataset.stance as UndertowStance });
      showBanner(body, `Undertow stance set to ${btn.dataset.stance}.`, true);
    });
  });
}
