/** Общее серверное состояние квеста второй локации. */
export type JungleSymbolId = 'leaf' | 'water' | 'stone';

export type JungleQuestPhase = 'exploring' | 'message_ready' | 'secret_word' | 'temple_open';

export interface JungleQuestState {
  revision: number;
  symbols: Record<JungleSymbolId, boolean>;
  phase: JungleQuestPhase;
  messageAcknowledged: boolean;
}

export type JungleQuestActionResult =
  | 'synced'
  | 'claimed'
  | 'already'
  | 'unavailable'
  | 'acknowledged'
  | 'wrong'
  | 'opened'
  | 'ignored'
  | 'loading'
  | 'error';

export function initialJungleQuestState(): JungleQuestState {
  return {
    revision: 0,
    symbols: { leaf: false, water: false, stone: false },
    phase: 'exploring',
    messageAcknowledged: false,
  };
}

export function parseJungleQuestState(value: unknown): JungleQuestState | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const symbols = raw.symbols;
  if (typeof raw.revision !== 'number' || typeof raw.phase !== 'string' || typeof symbols !== 'object' || symbols === null) return null;
  const s = symbols as Record<string, unknown>;
  if (typeof s.leaf !== 'boolean' || typeof s.water !== 'boolean' || typeof s.stone !== 'boolean') return null;
  if (!['exploring', 'message_ready', 'secret_word', 'temple_open'].includes(raw.phase)) return null;
  return {
    revision: raw.revision,
    symbols: { leaf: s.leaf, water: s.water, stone: s.stone },
    phase: raw.phase as JungleQuestPhase,
    messageAcknowledged: raw.messageAcknowledged === true,
  };
}
