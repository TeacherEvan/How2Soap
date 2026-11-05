/**
 * Milestone M6: Correspondence & 5 Named Correspondents
 * (§6.28)
 *
 * Direct letter panes from persons of interest with wax seal styling.
 * 5 Named Correspondents:
 * 1. Madame Serafine (The Spice & Perfume Guild)
 * 2. High Chamberlain Vael (The Royal Court)
 * 3. Sister Aurel (The Weir Clinics)
 * 4. Master Corvus (The Guild of Thorns)
 * 5. Prior Malachi (The Ninth Sphere Monastery)
 */

export interface Correspondent {
  id: string;
  name: string;
  title: string;
  faction: string;
  sealColor: string;
}

export const NAMED_CORRESPONDENTS: Correspondent[] = [
  {
    id: 'corresp_serafine',
    name: 'Madame Serafine',
    title: 'Steward of the Guild of Scents',
    faction: 'The Merchant Patricians',
    sealColor: '#c59b27',
  },
  {
    id: 'corresp_chamberlain',
    name: 'High Chamberlain Vael',
    title: 'Keeper of the Privy Seal',
    faction: 'The Royal Court',
    sealColor: '#8a1c1c',
  },
  {
    id: 'corresp_aurel',
    name: 'Sister Aurel',
    title: 'District Physician of the Weir',
    faction: 'The Public Infirmaries',
    sealColor: '#2b7a78',
  },
  {
    id: 'corresp_corvus',
    name: 'Master Corvus',
    title: 'Whisper of the Undertow',
    faction: 'The Guild of Thorns',
    sealColor: '#252830',
  },
  {
    id: 'corresp_malachi',
    name: 'Prior Malachi',
    title: 'Archivist of the Ninth Sphere',
    faction: 'Monastic Scholars',
    sealColor: '#5c4d7d',
  },
];

export interface Letter {
  id: string;
  correspondentId: string;
  turnReceived: number;
  subject: string;
  body: string;
  isRead: boolean;
}

export interface CorrespondenceState {
  letters: Letter[];
}

export function createInitialCorrespondence(): CorrespondenceState {
  return {
    letters: [
      {
        id: 'letter_welcome_court',
        correspondentId: 'corresp_chamberlain',
        turnReceived: 1,
        subject: 'Writ of Alchemical Authority',
        body: 'To our appointed Chemist: By decree of the Crown, the hearth grounds are placed in your trust. Keep the garrison armed and the sick wards washed with soap, or your charter will be weighed in the scales of the Privy Council.',
        isRead: false,
      },
      {
        id: 'letter_clinic_weir',
        correspondentId: 'corresp_aurel',
        turnReceived: 1,
        subject: 'Urgent Needs at the River Clinic',
        body: 'Peace be upon your stills, Magister. The winter coughs linger by the marshes. If you can boil fresh willow bark into tea, the fever in the lower tenements will relent before the first frost.',
        isRead: false,
      },
    ],
  };
}

export function markLetterRead(state: CorrespondenceState, letterId: string): void {
  const l = state.letters.find((item) => item.id === letterId);
  if (l) l.isRead = true;
}
