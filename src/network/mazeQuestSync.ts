import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { Emitter } from './emitter';
import { initialMazeQuestState, parseMazeQuestState, type MazeQuestState, type MazeResult } from '../game/quest/mazeQuestTypes';

type Events = { mazeState: MazeQuestState };

export class MazeQuestSync extends Emitter<Events> {
  private state = initialMazeQuestState();
  private ready = false;
  private closed = false;
  private channel: RealtimeChannel | null = null;

  constructor(
    private readonly client: SupabaseClient,
    private readonly room: string,
    private readonly getTeam: () => string[],
  ) { super(); }

  getState(): MazeQuestState { return this.state; }
  isReady(): boolean { return this.ready; }

  async start(): Promise<void> {
    await this.refresh();
    if (this.closed) return;
    this.channel = this.client.channel(`maze-quest:${this.room}`).on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'maze_quest_states', filter: `room_code=eq.${this.room}` },
      ({ new: row }) => this.apply(row),
    );
    // Also refresh after reconnect or if a change landed between the initial snapshot and subscription.
    this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') void this.refresh().catch(() => undefined);
    });
  }

  async refresh(): Promise<void> { await this.act('sync'); }
  checkpoint(index: number): Promise<MazeResult> { return this.act('checkpoint', index); }
  collect(index: number): Promise<MazeResult> { return this.act('collect', index); }
  arrive(): Promise<MazeResult> { return this.act('arrive'); }
  solve(phrase: string): Promise<MazeResult> { return this.act('solve', undefined, phrase); }
  submitCode(code: string): Promise<MazeResult> { return this.act('code', undefined, code); }

  async destroy(): Promise<void> {
    this.closed = true;
    const channel = this.channel;
    this.channel = null;
    this.clearListeners();
    if (channel) await this.client.removeChannel(channel).catch(() => undefined);
  }

  private async act(action: 'sync' | 'checkpoint' | 'collect' | 'arrive' | 'solve' | 'code', index?: number, answer?: string): Promise<MazeResult> {
    if (this.closed) return 'ignored';
    const { data, error } = await this.client.rpc('maze_quest_puzzle_action', {
      p_room_code: this.room,
      p_action: action,
      p_index: index ?? null,
      p_answer: answer ?? null,
      p_team: action === 'sync' ? this.getTeam() : null,
    });
    if (error) throw error;
    const response = data as { result?: MazeResult; state?: unknown } | null;
    if (!this.apply(response?.state)) throw new Error('Invalid maze quest state');
    return response?.result ?? 'ignored';
  }

  private apply(raw: unknown): boolean {
    const state = parseMazeQuestState(raw);
    if (!state) return false;
    if (!this.closed && (!this.ready || state.revision > this.state.revision)) {
      this.state = state;
      this.ready = true;
      this.emit('mazeState', state);
    }
    return true;
  }
}
