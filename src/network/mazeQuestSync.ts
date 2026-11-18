import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { Emitter } from './emitter';
import { initialMazeQuestState, parseMazeQuestState, type MazeQuestState, type MazeResult } from '../game/quest/mazeQuestTypes';
type Events = { mazeState: MazeQuestState };
export class MazeQuestSync extends Emitter<Events> {
  private state = initialMazeQuestState(); private ready = false; private channel: RealtimeChannel | null = null;
  constructor(private readonly client: SupabaseClient, private readonly room: string, private readonly team: string[]) { super(); }
  getState(): MazeQuestState { return this.state; } isReady(): boolean { return this.ready; }
  async start(): Promise<void> { await this.act('sync'); this.channel = this.client.channel(`maze-quest:${this.room}`).on('postgres_changes', { event: '*', schema: 'public', table: 'maze_quest_states', filter: `room_code=eq.${this.room}` }, ({ new: row }) => this.ingest(row)); this.channel.subscribe(); }
  checkpoint(index: number): Promise<MazeResult> { return this.act('checkpoint', index); } arrive(): Promise<MazeResult> { return this.act('arrive'); }
  async destroy(): Promise<void> { if (this.channel) await this.client.removeChannel(this.channel).catch(() => undefined); this.channel = null; this.clearListeners(); }
  private async act(action: string, checkpoint?: number): Promise<MazeResult> { const { data, error } = await this.client.rpc('maze_quest_action', { p_room_code: this.room, p_action: action, p_checkpoint: checkpoint ?? null, p_team: action === 'sync' ? this.team : null }); if (error) throw error; const x = data as { result?: unknown; state?: unknown }; const state = parseMazeQuestState(x?.state); if (state) this.apply(state); this.ready = true; return typeof x?.result === 'string' ? x.result as MazeResult : 'ignored'; }
  private ingest(row: unknown): void { if (!row || typeof row !== 'object') return; const r = row as Record<string, unknown>; const state = parseMazeQuestState({ revision: r.revision, team: r.team, players: r.players, completed: r.completed }); if (state) this.apply(state); }
  private apply(next: MazeQuestState): void { if (next.revision < this.state.revision) return; const changed = next.revision !== this.state.revision || next.completed !== this.state.completed || JSON.stringify(next.players) !== JSON.stringify(this.state.players); this.state = next; this.ready = true; if (changed) this.emit('mazeState', next); }
}
