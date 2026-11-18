import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { Emitter } from './emitter';
import { initialCastleQuestState, parseCastleQuestState, type CastleAnswerResult, type CastleQuestState } from '../game/quest/castleQuestTypes';

export class CastleQuestSync extends Emitter<{ castleState: CastleQuestState }> {
  private state = initialCastleQuestState();
  private ready = false;
  private closed = false;
  private channel: RealtimeChannel | null = null;

  constructor(private readonly client: SupabaseClient, private readonly roomCode: string) { super(); }

  getState(): CastleQuestState { return this.state; }
  isReady(): boolean { return this.ready; }

  async start(): Promise<void> {
    await this.refresh();
    if (this.closed) return;
    this.channel = this.client.channel(`castle-quest:${this.roomCode}`).on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'castle_quest_states', filter: `room_code=eq.${this.roomCode}` },
      ({ new: row }) => this.apply({ revision: row.revision, openedMask: row.opened_mask }),
    );
    this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') void this.refresh().catch(() => undefined);
    });
  }

  async refresh(): Promise<void> { await this.act(); }
  answer(seal: number, answer: string): Promise<CastleAnswerResult> { return this.act(seal, answer); }

  async destroy(): Promise<void> {
    this.closed = true;
    this.clearListeners();
    if (this.channel) await this.client.removeChannel(this.channel).catch(() => undefined);
    this.channel = null;
  }

  private async act(seal?: number, answer?: string): Promise<CastleAnswerResult> {
    if (this.closed) return 'loading';
    const { data, error } = await this.client.rpc('castle_quest_action', {
      p_room_code: this.roomCode,
      p_seal: seal ?? null,
      p_answer: answer?.trim().toUpperCase() ?? null,
    });
    if (error) throw error;
    const response = data as { result?: CastleAnswerResult; state?: unknown } | null;
    if (!this.apply(response?.state)) throw new Error('Invalid castle quest state');
    return response?.result ?? 'loading';
  }

  private apply(raw: unknown): boolean {
    const state = parseCastleQuestState(raw);
    if (!state) return false;
    if (!this.closed && (!this.ready || state.revision > this.state.revision)) {
      this.ready = true;
      this.state = state;
      this.emit('castleState', state);
    }
    return true;
  }
}
