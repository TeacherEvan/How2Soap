/**
 * Milestone M6: The Influence Window (Key 9)
 * (§6.29)
 *
 * Full window with 4 tabs:
 * 1. Stance (Court, Watch, Towns, Guilds, Frontier clans)
 * 2. Independent Powers (4 Powers, Befriend, Levy, Incite, Incorporate)
 * 3. Threats (The Wasting, Pale Raids, Rival Marches)
 * 4. Correspondence (Letters from the 5 named correspondents)
 */
import { WindowSpec } from '../WindowManager';
import { InfluenceState, executePowerAction, PowerAction } from '../../engine/campaign/influence';
import { NAMED_CORRESPONDENTS, CorrespondenceState } from '../../engine/campaign/correspondence';

let mockInfluence: InfluenceState = {
  currentInfluencePool: 35,
  powers: [
    {
      id: 'power_wolf_kin',
      name: 'Wolf-Kin Clan',
      age: 1,
      description: 'Fierce nomadic hunters of the northern pine wastes.',
      focus: 'MILITARY',
      influence: 45,
      suzerainBonus: '+2 Guard in all border settlements; -25% raid threat from wild beasts.',
      suzerainActive: false,
      status: 'FRIENDLY',
      demands: 'They want: weapons and forged iron spearheads.',
    },
    {
      id: 'power_painted_lodge',
      name: 'The Painted Lodge',
      age: 1,
      description: 'Weavers and pigment-grinders dwelling in the river bends.',
      focus: 'CULTURE',
      influence: 65,
      suzerainBonus: '+3 Renown per turn; Celebration cost halved.',
      suzerainActive: true,
      status: 'SUZERAIN',
      demands: 'They want: fine pigments, scented oils, and clean tallow.',
    },
    {
      id: 'power_salt_caravan',
      name: 'Salt Caravan Syndicate',
      age: 1,
      description: 'Wagon-masters controlling brine wells and overland roads.',
      focus: 'TRADE',
      influence: 20,
      suzerainBonus: '+4 Trade per turn; Convoys cannot be intercepted by bandits.',
      suzerainActive: false,
      status: 'NEUTRAL',
      demands: 'They want: unrefined salt, dried rations, and road safety.',
    },
    {
      id: 'power_stillbound_hermitage',
      name: 'Stillbound Hermitage',
      age: 1,
      description: 'Secluded herbalists and distillers living among thermal springs.',
      focus: 'SCIENCE',
      influence: 30,
      suzerainBonus: '+2 Discovery per turn; Public Health decay reduced by 50%.',
      suzerainActive: false,
      status: 'NEUTRAL',
      demands: 'They want: willow bark extract and clean glass alembics.',
    },
  ],
  suzerainCount: 1,
  incorporatedCount: 0,
};

let mockCorrespondence: CorrespondenceState = {
  letters: [
    {
      id: 'letter_1',
      correspondentId: 'corresp_chamberlain',
      turnReceived: 1,
      subject: 'Writ of Alchemical Authority',
      body: 'To our appointed Chemist: By decree of the Crown, the hearth grounds are placed in your trust. Keep the garrison armed and the sick wards washed with soap.',
      isRead: false,
    },
    {
      id: 'letter_2',
      correspondentId: 'corresp_aurel',
      turnReceived: 2,
      subject: 'Urgent Needs at the River Clinic',
      body: 'Peace be upon your stills, Magister. The winter coughs linger by the marshes. Fresh willow bark tea will turn the fever in the lower tenements.',
      isRead: true,
    },
  ],
};

function renderStances(): string {
  const stances = [
    { name: 'The Court', mood: 'Pleased (68/100)', demand: 'Demands regular soap consignments and royal tribute.', icon: '👑' },
    { name: 'The Watch', mood: 'Alert (55/100)', demand: 'Demands forged spears and timely frontier stipends.', icon: '🛡️' },
    { name: 'The Towns', mood: 'Warm (72/100)', demand: 'Demands clean water, disease prevention, and tallow.', icon: '🏘️' },
    { name: 'The Guilds', mood: 'Wary (42/100)', demand: 'Demands lower tariffs on convoy goods and chemical patents.', icon: '⚖️' },
    { name: 'Frontier Clans', mood: 'Quiet (50/100)', demand: 'Demands respect for sacred groves and fair trade.', icon: '🏹' },
  ];

  return `
    <div class="stance-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
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
  `;
}

function renderPowers(): string {
  return `
    <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
      <span>Available Influence: <strong style="color: #5aa5ff; font-size: 1.1rem;">${mockInfluence.currentInfluencePool}</strong></span>
      <span>Suzerainties: <strong>${mockInfluence.suzerainCount}</strong></span>
    </div>
    <div class="powers-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem;">
      ${mockInfluence.powers
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
  const threats = [
    { title: 'The Wasting (Plague Decay)', severity: 'Tier 2 (Moderate)', eta: 'Ongoing (-1 Public Health / turn)', desc: 'Tenement illness curbed only by chemical soap and willow remedies.' },
    { title: 'Steppe Raider War-Band', severity: 'Tier 1 (Telegraphed)', eta: 'Strikes in 1 turn', desc: 'Raiders spotted near northern pastures. Settlement guards will contest.' },
    { title: 'Dissident Pamphleteers', severity: 'Tier 1 (Simmering)', eta: '3 turns until public unrest', desc: 'Agitators question laboratory resource consumption in the main square.' },
  ];

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
  return `
    <div class="letters-list" style="display: flex; flex-direction: column; gap: 1rem;">
      ${mockCorrespondence.letters
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

export const spec: WindowSpec = {
  id: 'influence',
  title: 'The Influence Window & Foreign Stance',
  icon: '🌐',
  size: 'full',
  mount(body: HTMLElement) {
    body.innerHTML = `
      <div class="influence-container" style="display: flex; flex-direction: column; height: 100%; gap: 1rem; color: var(--fg);">
        <nav class="influence-tabs" style="display: flex; gap: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;">
          <button class="btn-surgical tab-btn active" data-tab="stance" style="padding: 6px 14px;">Stance</button>
          <button class="btn-surgical tab-btn" data-tab="powers" style="padding: 6px 14px;">Independent Powers</button>
          <button class="btn-surgical tab-btn" data-tab="threats" style="padding: 6px 14px;">Threats & Pressure</button>
          <button class="btn-surgical tab-btn" data-tab="letters" style="padding: 6px 14px;">Correspondence</button>
        </nav>
        <div id="influence-tab-content" style="flex: 1; overflow-y: auto;">
          ${renderStances()}
        </div>
      </div>
    `;

    const content = body.querySelector('#influence-tab-content') as HTMLElement;
    const tabBtns = body.querySelectorAll<HTMLButtonElement>('.tab-btn');

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        if (tab === 'stance') content.innerHTML = renderStances();
        else if (tab === 'powers') {
          content.innerHTML = renderPowers();
          attachPowerActions(body);
        } else if (tab === 'threats') content.innerHTML = renderThreats();
        else if (tab === 'letters') content.innerHTML = renderCorrespondence();
      });
    });
  },
};

function attachPowerActions(body: HTMLElement) {
  body.querySelectorAll<HTMLButtonElement>('.btn-power-action').forEach((btn) => {
    btn.addEventListener('click', () => {
      const powerId = btn.dataset.power!;
      const action = btn.dataset.action! as PowerAction;
      const res = executePowerAction(mockInfluence, powerId, action);
      const content = body.querySelector('#influence-tab-content') as HTMLElement;
      content.innerHTML = renderPowers();
      attachPowerActions(body);
      const statusBanner = document.createElement('div');
      statusBanner.style.padding = '8px';
      statusBanner.style.marginBottom = '8px';
      statusBanner.style.background = res.success ? 'rgba(80,200,120,0.15)' : 'rgba(255,80,80,0.15)';
      statusBanner.style.border = `1px solid ${res.success ? '#50c878' : '#ff5050'}`;
      statusBanner.style.borderRadius = '4px';
      statusBanner.textContent = res.message;
      content.prepend(statusBanner);
    });
  });
}
