import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { Emitter } from './emitter';
import { initialTempleQuestState, parseTempleQuestState, type TempleQuestActionResult, type TempleQuestState, type TempleTeamMember } from '../game/quest/templeQuestTypes';

type TempleEvents = { templeState: TempleQuestState };
type RpcResponse = { result?: unknown; state?: unknown };

/** Состояние финального зала: сервер решает, открывать ли дверь. */
export class TempleQuestSync extends Emitter<TempleEvents> {
  private state = initialTempleQuestState();
  private ready = false;
  private channel: RealtimeChannel | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly client: SupabaseClient, private readonly roomCode: string, private readonly team: TempleTeamMember[]) { super(); }
  getState(): TempleQuestState { return this.state; }
  isReady(): boolean { return this.ready; }
  async start(): Promise<void> {
    await this.act('sync');
    this.channel = this.client.channel(`temple-quest:${this.roomCode}`).on('postgres_changes', { event: '*', schema: 'public', table: 'temple_quest_states', filter: `room_code=eq.${this.roomCode}` }, ({ new: row }) => this.ingest(row));
    this.channel.subscribe();
    this.heartbeat = setInterval(() => void this.act('sync').catch(() => undefined), 10000);
  }
  checkpoint(index: number): Promise<TempleQuestActionResult> { return this.act('checkpoint', undefined, index); }
  setPlate(active: boolean): Promise<TempleQuestActionResult> { return this.act('plate', active); }
  collectStar(index: number): Promise<TempleQuestActionResult> { return this.act('star', undefined, undefined, index); }
  revealHint(): Promise<TempleQuestActionResult> { return this.act('reveal_hint'); }
  transition(): Promise<TempleQuestActionResult> { return this.act('transition'); }
  async destroy(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat); this.heartbeat = null;
    if (this.channel) await this.client.removeChannel(this.channel).catch(() => undefined);
    this.channel = null; this.clearListeners();
  }
  private async act(action: string, plateActive?: boolean, checkpoint?: number, starIndex?: number): Promise<TempleQuestActionResult> {
    const { data, error } = await this.client.rpc('temple_quest_action', {
      p_room_code: this.roomCode,
      p_action: action,
      p_plate_active: plateActive ?? null,
      p_checkpoint: checkpoint ?? null,
      p_star_index: starIndex ?? null,
      p_team: action === 'sync' ? this.team : null,
    });
    if (error) throw error;
    const response = (data ?? {}) as RpcResponse;
    const state = parseTempleQuestState(response.state); if (state) this.apply(state);
    this.ready = true;
    return typeof response.result === 'string' ? response.result as TempleQuestActionResult : 'ignored';
  }
  private ingest(row: unknown): void {
    if (typeof row !== 'object' || row === null) return;
    const raw = row as Record<string, unknown>;
    const state = parseTempleQuestState({
      revision: raw.revision,
      doorOpen: raw.door_open,
      players: raw.players,
      team: raw.team,
      stars: raw.stars,
      phase: raw.phase,
    });
    if (state) this.apply(state);
  }
  private apply(next: TempleQuestState): void {
    if (next.revision < this.state.revision) return;
    const changed = next.revision !== this.state.revision
      || next.doorOpen !== this.state.doorOpen
      || next.phase !== this.state.phase
      || JSON.stringify(next.players) !== JSON.stringify(this.state.players)
      || JSON.stringify(next.team) !== JSON.stringify(this.state.team)
      || JSON.stringify(next.stars) !== JSON.stringify(this.state.stars);
    this.state = next; this.ready = true;
    if (changed) this.emit('templeState', next);
  }
}
