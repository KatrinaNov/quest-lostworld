import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { Emitter } from './emitter';
import {
  initialJungleQuestState,
  parseJungleQuestState,
  type JungleQuestActionResult,
  type JungleQuestState,
  type JungleSymbolId,
} from '../game/quest/jungleQuestTypes';

type JungleEvents = { jungleState: JungleQuestState };

type RpcResponse = { result?: unknown; state?: unknown };

/** Серверный снимок и атомарные действия квеста второй локации. */
export class JungleQuestSync extends Emitter<JungleEvents> {
  private state = initialJungleQuestState();
  private ready = false;
  private channel: RealtimeChannel | null = null;

  constructor(private readonly client: SupabaseClient, private readonly roomCode: string) {
    super();
  }

  getState(): JungleQuestState {
    return this.state;
  }

  isReady(): boolean {
    return this.ready;
  }

  async start(): Promise<void> {
    await this.refresh();
    if (this.channel) return;
    this.channel = this.client
      .channel(`jungle-quest:${this.roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jungle_quest_states', filter: `room_code=eq.${this.roomCode}` },
        ({ new: row }) => this.ingestRow(row),
      );
    this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') void this.refresh().catch(() => undefined);
    });
  }

  async refresh(): Promise<void> {
    await this.act('sync');
  }

  async claimSymbol(symbol: JungleSymbolId): Promise<JungleQuestActionResult> {
    return this.act('claim_symbol', symbol);
  }

  async acknowledgeMessage(): Promise<JungleQuestActionResult> {
    return this.act('ack_message');
  }

  async submitSecret(secret: string): Promise<JungleQuestActionResult> {
    return this.act('submit_secret', undefined, secret);
  }

  async destroy(): Promise<void> {
    if (this.channel) await this.client.removeChannel(this.channel).catch(() => undefined);
    this.channel = null;
    this.clearListeners();
  }

  private async act(action: string, symbol?: JungleSymbolId, secret?: string): Promise<JungleQuestActionResult> {
    const { data, error } = await this.client.rpc('jungle_quest_action', {
      p_room_code: this.roomCode,
      p_action: action,
      p_symbol: symbol ?? null,
      p_secret: secret ?? null,
    });
    if (error) throw error;
    const response = (data ?? {}) as RpcResponse;
    const state = parseJungleQuestState(response.state);
    if (state) this.apply(state);
    this.ready = true;
    return typeof response.result === 'string' ? response.result as JungleQuestActionResult : 'error';
  }

  private ingestRow(row: unknown): void {
    if (typeof row !== 'object' || row === null) return;
    const raw = row as Record<string, unknown>;
    const state = parseJungleQuestState({
      revision: raw.revision,
      symbols: raw.symbols,
      phase: raw.phase,
      messageAcknowledged: raw.message_acknowledged,
    });
    if (state) this.apply(state);
  }

  private apply(next: JungleQuestState): void {
    if (next.revision < this.state.revision) return;
    const changed = next.revision !== this.state.revision || next.phase !== this.state.phase;
    this.state = next;
    this.ready = true;
    if (changed) this.emit('jungleState', next);
  }
}
