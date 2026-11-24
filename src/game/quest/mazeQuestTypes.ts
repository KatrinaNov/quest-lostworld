export const MAZE_PHRASE_WORDS = ['КОД', 'ПОД', 'ПОДУШКОЙ'] as const;
export const MAZE_PHRASE = MAZE_PHRASE_WORDS.join('');
export const MAZE_GLYPHS = [...'УДОКПДЙДОШКОПО'];

export interface MazePlayerState { checkpoint: number; arrived: boolean; solved: boolean; }
export interface MazeQuestState {
  revision: number;
  team: string[];
  players: Record<string, MazePlayerState>;
  letterOwners: Record<string, string>;
  completed: boolean;
}

export type MazeResult = 'synced' | 'checkpoint_saved' | 'collected' | 'arrived' | 'solved' | 'completed'
  | 'wrong' | 'code_pending' | 'loading' | 'ignored';

export const initialMazePlayerState = (): MazePlayerState => ({ checkpoint: 0, arrived: false, solved: false });
export const initialMazeQuestState = (): MazeQuestState => ({ revision: 0, team: [], players: {}, letterOwners: {}, completed: false });

export function mazeLetterLimit(team: readonly string[], playerId: string): number {
  const slot = team.indexOf(playerId);
  if (slot < 0) return 0;
  return Math.floor(MAZE_GLYPHS.length / team.length) + Number(slot < MAZE_GLYPHS.length % team.length);
}

export function mazeAssemblyReady(state: MazeQuestState): boolean {
  return Object.keys(state.letterOwners).length === MAZE_GLYPHS.length && state.team.length > 0
    && state.team.every((id) => state.players[id]?.arrived);
}
export function parseMazeQuestState(raw: unknown): MazeQuestState | null {
  if (!raw || typeof raw !== 'object') return null;
  const state = raw as Record<string, unknown>;
  if (typeof state.revision !== 'number' || !Array.isArray(state.team) || !state.players || typeof state.players !== 'object'
      || !state.letter_owners || typeof state.letter_owners !== 'object' || typeof state.completed !== 'boolean') return null;

  const players: Record<string, MazePlayerState> = {};
  for (const [id, item] of Object.entries(state.players)) {
    if (!item || typeof item !== 'object') continue;
    const player = item as Record<string, unknown>;
    if (typeof player.checkpoint === 'number' && Number.isInteger(player.checkpoint) && typeof player.arrived === 'boolean') {
      players[id] = { checkpoint: Math.max(0, Math.min(2, player.checkpoint)), arrived: player.arrived, solved: player.solved === true };
    }
  }

  const team = state.team.filter((id): id is string => typeof id === 'string');
  const letterOwners: Record<string, string> = {};
  for (const index of MAZE_GLYPHS.keys()) {
    const owner = (state.letter_owners as Record<string, unknown>)[index];
    if (typeof owner === 'string' && team.includes(owner)) letterOwners[index] = owner;
  }
  return { revision: state.revision, team, players, letterOwners, completed: state.completed };
}
