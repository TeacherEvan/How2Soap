/**
 * Council Mandates & 72-Hour Survival Timeline Engine
 * ("Against the Storm" style crisis timers & procedural objectives)
 */

export interface CouncilMandate {
  id: string;
  title: string;
  deadlineHours: number;
  remainingHours: number;
  rewardRenown: number;
  requiredItemId: string;
  requiredCount: number;
  isFulfilled: boolean;
}

export interface TimelineState {
  currentDay: number;
  currentHour: number;
  hoursUntilPayroll: number;
  activeMandates: CouncilMandate[];
}

export function createInitialMandates(): CouncilMandate[] {
  return [
    {
      id: 'MANDATE_HYGIENE_1',
      title: 'Quarantine Sanitation Accord',
      deadlineHours: 48,
      remainingHours: 48,
      rewardRenown: 15,
      requiredItemId: 'BAR_SOAP',
      requiredCount: 2,
      isFulfilled: false,
    },
    {
      id: 'MANDATE_BRONZE_AXE',
      title: 'Timber Clearing Levy',
      deadlineHours: 72,
      remainingHours: 72,
      rewardRenown: 25,
      requiredItemId: 'COPPER_INGOT',
      requiredCount: 2,
      isFulfilled: false,
    },
  ];
}

export function stepTimeline(state: TimelineState, elapsedHours: number): void {
  state.currentHour = (state.currentHour + elapsedHours) % 24;
  state.hoursUntilPayroll = Math.max(0, state.hoursUntilPayroll - elapsedHours);
  if (state.hoursUntilPayroll <= 0) {
    state.hoursUntilPayroll = 24; // Daily rollover
    state.currentDay += 1;
  }

  for (const m of state.activeMandates) {
    if (!m.isFulfilled) {
      m.remainingHours = Math.max(0, m.remainingHours - elapsedHours);
    }
  }
}
