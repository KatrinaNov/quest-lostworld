import { TEMPLE_CONFIG } from '../config/templeConfig';

export interface TemplePlayerState {
  checkpoint: number;
  plateActive: boolean;
}

export interface TempleTeamMember {
  id: string;
  name: string;
  color: number;
}

export type TempleQuestPhase = 'collecting' | 'final_started' | 'hint_ready' | 'transitioned';

/** Серверное состояние последнего зала храма. */
export interface TempleQuestState {
  revision: number;
  doorOpen: boolean;
  players: Record<string, TemplePlayerState>;
  /** Состав фиксируется при первом входе команды в храм и не меняется от Presence-мигания. */
  team: TempleTeamMember[];
  /** Собранные звёзды: player id → номера 0..2. */
  stars: Record<string, number[]>;
  phase: TempleQuestPhase;
}

export type TempleQuestActionResult =
  | 'synced' | 'checkpoint_saved' | 'plate_updated' | 'star_collected'
  | 'final_started' | 'hint_ready' | 'transitioned' | 'loading' | 'ignored' | 'error';

export function initialTempleQuestState(): TempleQuestState {
  return { revision: 0, doorOpen: false, players: {}, team: [], stars: {}, phase: 'collecting' };
}

export function parseTempleQuestState(value: unknown): TempleQuestState | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.revision !== 'number' || typeof raw.doorOpen !== 'boolean' || typeof raw.players !== 'object' || raw.players === null) return null;
  const players: Record<string, TemplePlayerState> = {};
  for (const [id, state] of Object.entries(raw.players as Record<string, unknown>)) {
    if (typeof state !== 'object' || state === null) continue;
    const row = state as Record<string, unknown>;
    if (typeof row.checkpoint !== 'number' || typeof row.plateActive !== 'boolean') continue;
    players[id] = {
      checkpoint: Math.max(-1, Math.min(TEMPLE_CONFIG.checkpoints.length - 1, Math.floor(row.checkpoint))),
      plateActive: row.plateActive,
    };
  }
  const team: TempleTeamMember[] = [];
  if (Array.isArray(raw.team)) {
    for (const item of raw.team) {
      if (typeof item !== 'object' || item === null) continue;
      const member = item as Record<string, unknown>;
      if (typeof member.id !== 'string' || typeof member.name !== 'string' || typeof member.color !== 'number') continue;
      team.push({ id: member.id, name: member.name, color: member.color });
    }
  }
  const stars: Record<string, number[]> = {};
  if (typeof raw.stars === 'object' && raw.stars !== null) {
    for (const [id, entries] of Object.entries(raw.stars as Record<string, unknown>)) {
      if (!Array.isArray(entries)) continue;
      stars[id] = [...new Set(entries.filter((entry): entry is number => typeof entry === 'number' && Number.isInteger(entry) && entry >= 0 && entry < 3))].sort();
    }
  }
  const phase: TempleQuestPhase = raw.phase === 'final_started' || raw.phase === 'hint_ready' || raw.phase === 'transitioned'
    ? raw.phase
    : 'collecting';
  return { revision: raw.revision, doorOpen: raw.doorOpen, players, team, stars, phase };
}
