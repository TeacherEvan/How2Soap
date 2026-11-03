import {
  CHAPTERS,
  LETTERS,
  RENOWN_THRESHOLDS,
  LEVEL_TITLES,
  type AffinityId,
  type ChapterDef,
  type ObjectiveDef,
} from '../data/story';
import { SPECIES } from '../data/speciesRegistry';

export interface ObjectiveSensor {
  hasSpecies(speciesIdx: number, minMoles: number): boolean;
  hasItem(itemId: string, count?: number): boolean;
  hasFabricated(recipeId: string): boolean;
  hasFlag(flag: string): boolean;
  hasEaten(itemId: string): boolean;
  hasTreated(kind: string): boolean;
}

export interface ProgressionState {
  renown: number;
  chapter: number; // index into CHAPTERS (0-based)
  fabricatedRecipes: string[];
  objectivesDone: string[]; // objective def ids (chapters + letters)
  lettersDone: string[];
  affinity: { apothecary: number; soapwright: number; forgewright: number };
  ever: Record<string, boolean>;
  craftStats: { eaten: Record<string, number>; treated: Record<string, number> };
}

export interface RenownInfo {
  level: number;
  title: string;
  intoLevel: number;
  span: number;
  toNext: number | null;
}

export interface ProgressionEvents {
  objectives: string[];
  letters: string[];
  chapters: string[];
  levelUps: Array<{ level: number; title: string }>;
}

export function initialProgression(): ProgressionState {
  return {
    renown: 0,
    chapter: 0,
    fabricatedRecipes: [],
    objectivesDone: [],
    lettersDone: [],
    affinity: { apothecary: 0, soapwright: 0, forgewright: 0 },
    ever: {},
    craftStats: { eaten: {}, treated: {} },
  };
}

export function levelFromRenown(renown: number): RenownInfo {
  let level = 1;
  for (let i = 1; i < RENOWN_THRESHOLDS.length; i += 1) {
    if (renown >= RENOWN_THRESHOLDS[i]) level = i + 1;
  }
  const idx = level - 1;
  const base = RENOWN_THRESHOLDS[idx];
  const next = idx + 1 < RENOWN_THRESHOLDS.length ? RENOWN_THRESHOLDS[idx + 1] : null;
  const span = next === null ? 1 : next - base;
  const intoLevel = Math.max(0, renown - base);
  return {
    level,
    title: LEVEL_TITLES[idx],
    intoLevel,
    span,
    toNext: next === null ? null : span - intoLevel,
  };
}

export function affinityRank(points: number): 0 | 1 | 2 | 3 {
  if (points >= 150) return 3;
  if (points >= 80) return 2;
  if (points >= 30) return 1;
  return 0;
}

export function dominantAffinity(a: ProgressionState['affinity']): AffinityId | null {
  const entries = Object.entries(a) as Array<[AffinityId, number]>;
  const max = Math.max(...entries.map(e => e[1]));
  if (max === 0) return null;
  const winners = entries.filter(e => e[1] === max).map(e => e[0]);
  return winners.length === 1 ? winners[0] : null;
}

export function evaluateObjectives(save: ProgressionState, sensor: ObjectiveSensor): string[] {
  if (save.objectivesDone.length > 64) return [];
  const done = new Set(save.objectivesDone);
  const out: string[] = [];
  const all: ObjectiveDef[] = [
    ...CHAPTERS.flatMap(ch => ch.objectives),
    ...LETTERS.map(l => l.task),
  ];
  for (const o of all) {
    if (done.has(o.id)) continue;
    const hit =
      o.kind === 'species'
        ? sensor.hasSpecies(SPECIES[o.target as keyof typeof SPECIES] as unknown as number, o.count ?? 0.05)
        : o.kind === 'recipe'
        ? sensor.hasFabricated(o.target)
        : o.kind === 'item'
        ? sensor.hasItem(o.target, o.count ?? 1)
        : o.kind === 'flag'
        ? sensor.hasFlag(o.target)
        : o.kind === 'eat'
        ? sensor.hasEaten(o.target)
        : /* treat */ sensor.hasTreated(o.target);
    if (hit) out.push(o.id);
  }
  return out;
}

export function applyProgressEventsWithSensor(
  save: ProgressionState,
  ev: { kind: 'recipe' | 'eat' | 'treat' | 'harvest' | 'flag'; target: string },
  sensor: ObjectiveSensor,
): ProgressionEvents {
  const preLevel = levelFromRenown(save.renown).level;

  // 1) record the raw signal into stats/ever
  if (ev.kind === 'recipe') {
    if (!save.fabricatedRecipes.includes(ev.target)) {
      save.fabricatedRecipes.push(ev.target);
    }
  }
  if (ev.kind === 'eat') save.craftStats.eaten[ev.target] = (save.craftStats.eaten[ev.target] ?? 0) + 1;
  if (ev.kind === 'treat') save.craftStats.treated[ev.target] = (save.craftStats.treated[ev.target] ?? 0) + 1;
  if (ev.kind === 'harvest' || ev.kind === 'flag') save.ever[ev.target] = true;

  // 2) re-evaluate objectives
  const newIds = evaluateObjectives(save, sensor);
  const done = new Set(save.objectivesDone);
  const chaptersDoneNow: string[] = [];
  const lettersDoneNow: string[] = [];

  for (const id of newIds) {
    done.add(id);
    save.objectivesDone.push(id);
    save.renown += 25; // per-objective bounty

    for (const l of LETTERS) {
      if (l.task.id === id && !save.lettersDone.includes(l.id) && l.chapter - 1 <= save.chapter) {
        save.lettersDone.push(l.id);
        lettersDoneNow.push(l.id);
        save.renown += l.rewardRenown;
        for (const [k, v] of Object.entries(l.rewardAffinity)) {
          if (v !== undefined) {
            save.affinity[k as AffinityId] += v;
          }
        }
      }
    }
  }

  // chapter completion sweep
  CHAPTERS.forEach((ch, idx) => {
    if (save.chapter > idx) return; // already cleared
    if (ch.objectives.every(o => done.has(o.id))) {
      save.chapter = idx + 1;
      save.renown += ch.renown;
      chaptersDoneNow.push(ch.id);
    }
  });

  const postLevel = levelFromRenown(save.renown).level;
  const levelUps: ProgressionEvents['levelUps'] = [];
  for (let lv = preLevel + 1; lv <= postLevel; lv += 1) {
    levelUps.push({ level: lv, title: LEVEL_TITLES[lv - 1] });
  }

  return { objectives: newIds, letters: lettersDoneNow, chapters: chaptersDoneNow, levelUps };
}

export function applyProgressEvents(
  save: ProgressionState,
  ev: { kind: 'recipe' | 'eat' | 'treat' | 'harvest' | 'flag'; target: string },
): ProgressionEvents {
  return applyProgressEventsWithSensor(save, ev, {
    hasSpecies: () => false,
    hasItem: () => false,
    hasFabricated: id => save.fabricatedRecipes.includes(id),
    hasFlag: f => !!save.ever[f],
    hasEaten: id => (save.craftStats.eaten[id] ?? 0) > 0,
    hasTreated: k => (save.craftStats.treated[k] ?? 0) > 0,
  });
}

export function currentChapter(save: ProgressionState): ChapterDef | null {
  if (save.chapter >= CHAPTERS.length) return null;
  return CHAPTERS[save.chapter];
}
