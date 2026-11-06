export type BadgeLevel = 'crisis' | 'action' | 'info';

export interface Badge {
  level: BadgeLevel;
  count?: number; // for 'info'
  label: string; // aria-label / tooltip text
}

export function computeAllBadges(_snapshot: any, clientState: any): Map<string, Badge> {
  const badges = new Map<string, Badge>();
  if (!clientState) return badges;

  // 1. Reactions (Workbench):
  // Check vessels for pressure > 95% max or pH outside [2, 12] or temp > 90% vessel rating
  const vessels = clientState.vessels || [];
  let vesselCrisis = false;
  for (const v of vessels) {
    if (v.pressure && v.maxPressure && v.pressure > 0.95 * v.maxPressure) {
      vesselCrisis = true;
      break;
    }
    if (v.ph !== undefined && (v.ph < 2 || v.ph > 12)) {
      vesselCrisis = true;
      break;
    }
    if (v.temp && v.maxTemp && v.temp > 0.9 * v.maxTemp) {
      vesselCrisis = true;
      break;
    }
  }
  if (vesselCrisis) {
    badges.set('reactions', {
      level: 'crisis',
      label: 'Vessel pressure, pH, or temperature critical',
    });
  }

  // 2. Settlement:
  // colony.morale < 20 (any colonist) or mandate < 35% -> crisis
  // unreadDawnReport === true -> action
  const colonists = clientState.colony?.colonists || [];
  const strikeRisk = colonists.some((c: any) => (c.morale ?? 100) < 20);
  const mandate = clientState.realm?.mandate ?? 60;
  if (strikeRisk || mandate < 35) {
    badges.set('settlement', {
      level: 'crisis',
      label: 'Strike risk / mandate failing',
    });
  } else if (clientState.unreadDawnReport) {
    badges.set('settlement', {
      level: 'action',
      label: 'Dawn Report ready',
    });
  }

  // 3. Chronicle:
  // state.log.length > lastReadLogIndex -> info count
  const logLen = clientState.log?.length || 0;
  const lastReadLog = clientState.lastReadLogIndex ?? 0;
  if (logLen > lastReadLog) {
    badges.set('chronicle', {
      level: 'info',
      count: logLen - lastReadLog,
      label: `${logLen - lastReadLog} unread event entries`,
    });
  }

  // 4. Commissions:
  // any commission complete and unclaimed -> action
  const commissions = clientState.commissions?.active || [];
  const claimable = commissions.some((c: any) => c.complete && !c.claimed);
  if (claimable) {
    badges.set('commissions', {
      level: 'action',
      label: 'Commission(s) ready to claim',
    });
  }

  // 5. Influence:
  // timedRequests.some(r => r.state === 'PENDING' && !r.seen) -> action
  const requests = clientState.timedRequests?.requests || clientState.timedRequests || [];
  if (Array.isArray(requests) && requests.some((r: any) => r.state === 'PENDING' && !r.seen)) {
    badges.set('influence', {
      level: 'action',
      label: 'Audience awaits',
    });
  }

  return badges;
}

export function getAggregateBadge(badgeMap: Map<string, Badge>): Badge | null {
  let hasAction: Badge | null = null;
  let hasInfo: Badge | null = null;

  for (const badge of badgeMap.values()) {
    if (badge.level === 'crisis') return badge; // Immediate crisis priority
    if (badge.level === 'action' && !hasAction) hasAction = badge;
    if (badge.level === 'info' && !hasInfo) hasInfo = badge;
  }

  return hasAction || hasInfo || null;
}
