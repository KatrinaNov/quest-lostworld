export const ALL_CASTLE_SEALS = 0b1111;
export const CASTLE_MIRROR_SEAL = 3;
export const CASTLE_MIRROR_STEPS = 8;
export const CASTLE_MIRROR_LEASE_MS = 2600;

export interface CastleMirrorHold {
  step: number;
  expiresAt: number;
}

export interface CastleQuestState {
  revision: number;
  openedMask: number;
  mirrorTeam: string[];
  mirrorHolds: Record<string, CastleMirrorHold>;
}

export type CastleAnswerResult = 'synced' | 'wrong' | 'opened' | 'already_open' | 'completed' | 'loading' | 'memory';

export const CASTLE_MEMORY_LENGTHS = [3, 5, 7] as const;

export interface CastleMemoryRound {
  stage: number;
  pattern: string;
  retry: boolean;
}

export interface CastleAnswer {
  result: CastleAnswerResult;
  memory?: CastleMemoryRound;
}

export function parseCastleMemoryRound(raw: unknown): CastleMemoryRound | undefined {
  if (typeof raw !== 'object' || raw === null) return;
  const { stage, pattern, retry } = raw as Partial<CastleMemoryRound>;
  if (typeof stage !== 'number' || !Number.isInteger(stage) || typeof pattern !== 'string' ||
      pattern.length !== CASTLE_MEMORY_LENGTHS[stage] || !/^[1-9]+$/.test(pattern) ||
      new Set(pattern).size !== pattern.length || typeof retry !== 'boolean') return;
  return { stage, pattern, retry };
}

export const initialCastleQuestState = (): CastleQuestState => ({
  revision: 0, openedMask: 0, mirrorTeam: [], mirrorHolds: {},
});

export function isCastleSealOpen(state: CastleQuestState, seal: number): boolean {
  return (state.openedMask & (1 << seal)) !== 0;
}

export function parseCastleQuestState(raw: unknown, serverTime = Date.now()): CastleQuestState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { revision, openedMask, mirrorTeam, mirrorHolds } = raw as Partial<CastleQuestState>;
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0 ||
      typeof openedMask !== 'number' || !Number.isInteger(openedMask) || openedMask < 0 || openedMask > ALL_CASTLE_SEALS) return null;
  const team = Array.isArray(mirrorTeam) ? [...new Set(mirrorTeam.filter((id) => typeof id === 'string' && id))].slice(0, 4) : [];
  const holds: CastleQuestState['mirrorHolds'] = {};
  if (mirrorHolds && typeof mirrorHolds === 'object') {
    const received = Date.now();
    for (const id of team) {
      if (!Object.hasOwn(mirrorHolds, id)) continue;
      const hold = mirrorHolds[id];
      if (!hold || !Number.isInteger(hold.step) || hold.step < 0 || hold.step >= CASTLE_MIRROR_STEPS ||
          !Number.isFinite(hold.expiresAt)) continue;
      const remaining = Math.min(CASTLE_MIRROR_LEASE_MS, hold.expiresAt - serverTime);
      if (remaining > 0) holds[id] = { step: hold.step, expiresAt: received + remaining };
    }
  }
  return { revision, openedMask, mirrorTeam: team, mirrorHolds: holds };
}
