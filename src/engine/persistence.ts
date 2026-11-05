/**
 * Asynchronous Persistence & Compressed Save Store
 *
 * Implements Section 0.4 and Section 2.1 of Master Technical Specification:
 * - IndexedDB asynchronous database: `chem_world_v1`
 * - Gzip compression export/import via CompressionStream('gzip') / DecompressionStream('gzip')
 *   with Base64 wrapping and SHA-256 / Checksum integrity validation.
 */

export interface SerializedColonyState {
  colonists: import('./colony').Colonist[];
  ledger: import('./colony').ColonyLedgerEntry[];
  desirePathGrid: number[]; // 1024 bytes serialized as number array
  nextColonistId: number;
  lastDecayTick?: number;
}

export interface SerializedWorldSave {
  version: number;
  timestamp: number;
  tick: number;
  day: number;
  ambientTempK: number;
  rngSeed: number;
  player: {
    glucoseKcal: number;
    adiposeKcal: number;
    hydrationPct: number;
    coreTempK: number;
    clothingIclo: number;
    conditions?: import('./metabolism').PlayerConditions;
    dead?: boolean;
    woundOnsetSeconds?: number;
    sepsisOnsetSeconds?: number;
  };
  inventory: any;
  vessels: any[];
  ever: Record<string, boolean>;
  renown: number;
  affinity: { apothecary: number; soapwright: number; forgewright: number };
  chapter: number;
  fabricatedRecipes: string[];
  objectivesDone: string[];
  lettersDone: string[];
  epilogueSeen: boolean;
  colony?: SerializedColonyState;
  paddock?: any;
  timedRequests?: any[];
  experiments?: import('./campaign/experiments').ExperimentQueueState;
  realm?: import('./campaign/realm').RealmState;
  patron?: import('./campaign/patron').PatronState;
  ageProgress?: import('./campaign/ageProgress').AgeProgressState;
  settlements?: import('./campaign/settlements').SettlementsState;
  blacksmith?: import('./campaign/blacksmith').BlacksmithState;
  tutorial?: {
    activeTier: 'BEGINNER' | 'INTERMEDIATE' | 'PHD';
    activeLessonId: string | null;
    completedLessonIds: string[];
    phdTelemetryEnabled: boolean;
    coachmarkDismissed: boolean;
    progressiveReveal?: {
      currentBeatIndex: number;
      completedBeats: string[];
      dismissed: boolean;
    };
  };
  featureFlags?: {
    colonyChemistryLink: boolean;
  };
}

export function serializeSave(save: SerializedWorldSave): string {
  return JSON.stringify(save);
}

export function deserializeSave(json: string): SerializedWorldSave {
  const parsed = JSON.parse(json);
  if (typeof parsed.version !== 'number' || !parsed.player) {
    throw new Error('Invalid save payload structure');
  }
  // Apply defaults for missing v2 fields
  return {
    version: parsed.version,
    timestamp: parsed.timestamp ?? Date.now(),
    tick: parsed.tick ?? 0,
    day: parsed.day ?? 1,
    ambientTempK: parsed.ambientTempK ?? 288.15,
    rngSeed: parsed.rngSeed ?? ((Math.random() * 0xffffffff) >>> 0),
    player: {
      glucoseKcal: parsed.player?.glucoseKcal ?? 1200,
      adiposeKcal: parsed.player?.adiposeKcal ?? 15000,
      hydrationPct: parsed.player?.hydrationPct ?? 100,
      coreTempK: parsed.player?.coreTempK ?? 310.15,
      clothingIclo: parsed.player?.clothingIclo ?? 0.05,
      conditions: parsed.player?.conditions ?? { fever: false, systemicInfection: false, woundContamination: false },
      dead: parsed.player?.dead ?? false,
      woundOnsetSeconds: parsed.player?.woundOnsetSeconds ?? 0,
      sepsisOnsetSeconds: parsed.player?.sepsisOnsetSeconds ?? 0,
    },
    inventory: parsed.inventory ?? {},
    vessels: parsed.vessels ?? [],
    paddock: parsed.paddock ?? undefined,
    ever: parsed.ever ?? {},
    renown: parsed.renown ?? 0,
    affinity: parsed.affinity ?? { apothecary: 0, soapwright: 0, forgewright: 0 },
    chapter: parsed.chapter ?? 0,
    fabricatedRecipes: parsed.fabricatedRecipes ?? [],
    objectivesDone: parsed.objectivesDone ?? [],
    lettersDone: parsed.lettersDone ?? [],
    epilogueSeen: parsed.epilogueSeen ?? false,
    timedRequests: Array.isArray(parsed.timedRequests) ? parsed.timedRequests : undefined,
    experiments: parsed.experiments ?? undefined,
    realm: parsed.realm ?? undefined,
    patron: parsed.patron ?? undefined,
    ageProgress: parsed.ageProgress ?? undefined,
    settlements: parsed.settlements ?? undefined,
    blacksmith: parsed.blacksmith ?? undefined,
    colony: parsed.colony ? {
      colonists: parsed.colony.colonists ?? [],
      ledger: parsed.colony.ledger ?? [],
      desirePathGrid: Array.isArray(parsed.colony.desirePathGrid) ? parsed.colony.desirePathGrid : [],
      nextColonistId: parsed.colony.nextColonistId ?? 1,
      lastDecayTick: parsed.colony.lastDecayTick,
    } : undefined,
    tutorial: parsed.tutorial ? {
      activeTier: parsed.tutorial.activeTier ?? 'BEGINNER',
      activeLessonId: parsed.tutorial.activeLessonId ?? null,
      completedLessonIds: Array.isArray(parsed.tutorial.completedLessonIds) ? parsed.tutorial.completedLessonIds : [],
      phdTelemetryEnabled: parsed.tutorial.phdTelemetryEnabled ?? false,
      coachmarkDismissed: parsed.tutorial.coachmarkDismissed ?? false,
      progressiveReveal: parsed.tutorial.progressiveReveal ? {
        currentBeatIndex: parsed.tutorial.progressiveReveal.currentBeatIndex ?? 0,
        completedBeats: Array.isArray(parsed.tutorial.progressiveReveal.completedBeats) ? parsed.tutorial.progressiveReveal.completedBeats : [],
        dismissed: parsed.tutorial.progressiveReveal.dismissed ?? false,
      } : undefined,
    } : undefined,
    featureFlags: parsed.featureFlags ?? { colonyChemistryLink: false },
  };
}

export function migrateSave(raw: unknown): SerializedWorldSave {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid save payload structure');
  const r = raw as Record<string, unknown>;
  const v = typeof r.version === 'number' ? r.version : 1;
  if (v >= 2) return deserializeSave(JSON.stringify(r));
  return {
    version: 2,
    timestamp: (typeof r.timestamp === 'number' ? r.timestamp : Date.now()),
    tick: (typeof r.tick === 'number' ? r.tick : 0),
    day: (typeof r.day === 'number' ? r.day : 1),
    ambientTempK: (typeof r.ambientTempK === 'number' ? r.ambientTempK : 288.15),
    rngSeed: (Math.random() * 0xffffffff) >>> 0,
    player: {
      glucoseKcal: (r.player as any)?.glucoseKcal ?? 1200,
      adiposeKcal: (r.player as any)?.adiposeKcal ?? 15000,
      hydrationPct: (r.player as any)?.hydrationPct ?? 100,
      coreTempK: (r.player as any)?.coreTempK ?? 310.15,
      clothingIclo: (r.player as any)?.clothingIclo ?? 0.05,
      conditions: { fever: false, systemicInfection: false, woundContamination: false },
      dead: false,
      woundOnsetSeconds: 0,
      sepsisOnsetSeconds: 0,
    },
    inventory: (r.inventory as any) ?? {},
    vessels: (r.vessels as any) ?? [],
    paddock: (r.paddock as any) ?? undefined,
    ever: (r.ever as Record<string, boolean>) ?? {},
    renown: (typeof r.renown === 'number' ? r.renown : 0),
    affinity: (r.affinity as any) ?? { apothecary: 0, soapwright: 0, forgewright: 0 },
    chapter: (typeof r.chapter === 'number' ? r.chapter : 0),
    fabricatedRecipes: Array.isArray(r.fabricatedRecipes) ? r.fabricatedRecipes : [],
    objectivesDone: Array.isArray(r.objectivesDone) ? r.objectivesDone : [],
    lettersDone: Array.isArray(r.lettersDone) ? r.lettersDone : [],
    epilogueSeen: (typeof r.epilogueSeen === 'boolean' ? r.epilogueSeen : false),
    tutorial: undefined,
    featureFlags: { colonyChemistryLink: false },
  };
}

/**
 * Computes SHA-256 hex digest of a string using Web Crypto API.
 */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compresses a UTF-8 string to Base64 with SHA-256 integrity prefix.
 * Output format: `sha256:<64-hex>:<b64-gzip>`
 */
export async function compressSaveToBase64(jsonText: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(jsonText);

  let plainB64: string;
  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(data);
    writer.close();
    const compressedBuffer = await new Response(cs.readable).arrayBuffer();
    const bytes = new Uint8Array(compressedBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    plainB64 = btoa(binary);
  } else {
    plainB64 = btoa(unescape(encodeURIComponent(jsonText)));
  }

  const hash = await sha256Hex(jsonText);
  return `sha256:${hash}:${plainB64}`;
}

/**
 * Decompresses a Base64 string (with optional sha256 prefix) to a save object.
 * Accepts both new format `sha256:<hex>:<b64>` and legacy bare Base64.
 */
export async function decompressBase64ToSave(base64: string): Promise<SerializedWorldSave> {
  let payload = base64;
  let hasPrefix = false;
  let expectedHash = '';

  if (base64.startsWith('sha256:')) {
    hasPrefix = true;
    const parts = base64.split(':');
    if (parts.length === 3) {
      expectedHash = parts[1];
      payload = parts[2];
    }
  }

  const binary = atob(payload);

  let jsonText: string;
  const MAX_DECOMPRESSED_BYTES = 5 * 1024 * 1024; // 5 MB safety limit

  if (typeof DecompressionStream !== 'undefined') {
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();

    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > MAX_DECOMPRESSED_BYTES) {
            throw new Error(`Decompressed save exceeds 5MB limit (${totalBytes} bytes)`);
          }
          chunks.push(value);
        }
      }
    } finally {
      reader.releaseLock();
    }

    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    jsonText = new TextDecoder().decode(merged);
  } else {
    if (binary.length > MAX_DECOMPRESSED_BYTES) {
      throw new Error(`Decompressed save exceeds 5MB limit (${binary.length} bytes)`);
    }
    jsonText = decodeURIComponent(escape(binary));
  }

  if (hasPrefix) {
    const actualHash = await sha256Hex(jsonText);
    if (actualHash !== expectedHash) {
      throw new Error('Save integrity check failed: SHA-256 mismatch');
    }
  } else {
    console.warn('Save import: legacy format without SHA-256 prefix, skipping integrity check');
  }

  return deserializeSave(jsonText);
}