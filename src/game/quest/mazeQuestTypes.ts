export interface MazePlayerState { checkpoint: number; arrived: boolean; }
export interface MazeQuestState { revision: number; team: string[]; players: Record<string, MazePlayerState>; completed: boolean; }
export type MazeResult = 'synced' | 'checkpoint_saved' | 'arrived' | 'completed' | 'loading' | 'ignored';
export const initialMazeQuestState = (): MazeQuestState => ({ revision: 0, team: [], players: {}, completed: false });
export function parseMazeQuestState(raw: unknown): MazeQuestState | null {
  if (!raw || typeof raw !== 'object') return null;
  const state = raw as Record<string, unknown>;
  if (typeof state.revision !== 'number' || !Array.isArray(state.team) ||
      !state.players || typeof state.players !== 'object' || typeof state.completed !== 'boolean') return null;

  const players: Record<string, MazePlayerState> = {};
  for (const [id, item] of Object.entries(state.players)) {
    if (!item || typeof item !== 'object') continue;
    const player = item as Record<string, unknown>;
    if (typeof player.checkpoint === 'number' && Number.isInteger(player.checkpoint) && typeof player.arrived === 'boolean') {
      players[id] = { checkpoint: Math.max(0, Math.min(2, player.checkpoint)), arrived: player.arrived };
    }
  }

  const team = state.team.filter((id): id is string => typeof id === 'string');
  return { revision: state.revision, team, players, completed: state.completed };
}
