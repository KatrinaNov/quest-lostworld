import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { Emitter } from './emitter';
import { initialMazeQuestState, parseMazeQuestState, type MazeQuestState, type MazeResult } from '../game/quest/mazeQuestTypes';

type Events = { mazeState: MazeQuestState };
const REQUEST_TIMEOUT_MS = 7000;

export class MazeQuestSync extends Emitter<Events> {
  private state = initialMazeQuestState();
  private ready = false;
  private closed = false;
  private channel: RealtimeChannel | null = null;
  private readonly requests = new Set<AbortController>();
  private refreshing: Promise<void> | null = null;

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

  refresh(): Promise<void> {
    this.refreshing ??= this.refreshState().finally(() => { this.refreshing = null; });
    return this.refreshing;
  }
  checkpoint(index: number): Promise<MazeResult> { return this.act('checkpoint', index); }
  collect(index: number): Promise<MazeResult> { return this.act('collect', index); }
  arrive(): Promise<MazeResult> { return this.act('arrive'); }
  solve(phrase: string): Promise<MazeResult> { return this.act('solve', undefined, phrase); }
  submitCode(code: string): Promise<MazeResult> { return this.act('code', undefined, code); }

  async destroy(): Promise<void> {
    this.closed = true;
    for (const request of this.requests) request.abort();
    const channel = this.channel;
    this.channel = null;
    this.clearListeners();
    if (channel) await this.client.removeChannel(channel).catch(() => undefined);
  }

  private async act(action: 'sync' | 'checkpoint' | 'collect' | 'arrive' | 'solve' | 'code', index?: number, answer?: string): Promise<MazeResult> {
    if (this.closed) return 'ignored';
    const data = await this.request((signal) => this.client.rpc('maze_quest_puzzle_action', {
      p_room_code: this.room,
      p_action: action,
      p_index: index ?? null,
      p_answer: answer ?? null,
      p_team: action === 'sync' ? this.getTeam() : null,
    }).abortSignal(signal));
    const response = data as { result?: MazeResult; state?: unknown } | null;
    if (!this.apply(response?.state)) throw new Error('Invalid maze quest state');
    return response?.result ?? 'ignored';
  }

  private async refreshState(): Promise<void> {
    if (this.closed) return;
    // Only the initial sync or an open roster needs the write RPC and its row lock.
    if (!this.ready || (!this.state.completed && !Object.keys(this.state.letterOwners).length)) {
      await this.act('sync');
      return;
    }
    const row = await this.request((signal) => this.client.from('maze_quest_states')
      .select('revision,team,players,letter_owners,completed').eq('room_code', this.room).abortSignal(signal).single());
    if (!this.apply(row)) throw new Error('Invalid maze quest state');
  }

  private async request(call: (signal: AbortSignal) => PromiseLike<{ data: unknown; error: unknown }>): Promise<unknown> {
    const controller = new AbortController();
    this.requests.add(controller);
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const { data, error } = await call(controller.signal);
      if (error) throw error;
      return data;
    } finally {
      window.clearTimeout(timer);
      this.requests.delete(controller);
    }
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
