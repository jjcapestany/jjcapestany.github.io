import { SPECS } from './specs';

// Persistent save data, stored in the browser's localStorage so it survives
// across visits. (localStorage beats cookies here: it's client-only, larger,
// and never sent to a server.) Bump the version + migrate if the shape changes.
const KEY = 'cheesewizard.save.v1';

export interface SaveData {
  version: number;
  visits: number;
  firstSeen: string; // ISO timestamp of the first ever visit
  lastSpec: string | null;
  unlocked: string[]; // spec ids the player has access to
  runs: Record<string, number>; // spec id -> times played
}

function defaults(): SaveData {
  return {
    version: 1,
    visits: 0,
    firstSeen: new Date().toISOString(),
    lastSpec: null,
    unlocked: SPECS.map((s) => s.id), // everything unlocked for now
    runs: {},
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    // merge over defaults so older saves gain any newly-added fields
    return { ...defaults(), ...(JSON.parse(raw) as Partial<SaveData>) };
  } catch {
    return defaults();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage can be unavailable (private mode, blocked cookies); just skip
  }
}

export function totalRuns(data: SaveData): number {
  return Object.values(data.runs).reduce((a, b) => a + b, 0);
}
