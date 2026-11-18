export const ALL_CASTLE_SEALS = 0b1111;

export interface CastleQuestState {
  revision: number;
  openedMask: number;
}

export type CastleAnswerResult = 'synced' | 'wrong' | 'opened' | 'already_open' | 'completed' | 'loading';

export const initialCastleQuestState = (): CastleQuestState => ({ revision: 0, openedMask: 0 });

export function isCastleSealOpen(state: CastleQuestState, seal: number): boolean {
  return (state.openedMask & (1 << seal)) !== 0;
}

export function parseCastleQuestState(raw: unknown): CastleQuestState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { revision, openedMask } = raw as Partial<CastleQuestState>;
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0 ||
      typeof openedMask !== 'number' || !Number.isInteger(openedMask) || openedMask < 0 || openedMask > ALL_CASTLE_SEALS) return null;
  return { revision, openedMask };
}
