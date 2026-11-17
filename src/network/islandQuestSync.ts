import { Emitter } from './emitter';
import {
  activeSlotCount,
  checkPortalTransition,
  createInitialQuestState,
  mergeQuestState,
  tryInsertKey,
  tryPickKey,
  tryPortalAck,
} from '../game/quest/islandQuestState';
import type { IslandQuestState, QuestSyncPayload } from '../game/quest/islandQuestTypes';
import type { GameEvent, Player, RoomEvents } from './types';

type QuestEvents = Pick<RoomEvents, 'questState'>;

/**
 * Общая логика синхронизации квеста острова для Realtime и демо-режима.
 * Состояние меняется только через события quest_*; локальный браузер не авторитетен сам по себе.
 */
export class IslandQuestSync extends Emitter<QuestEvents> {
  private state: IslandQuestState;

  constructor(
    private readonly self: Player,
    private getPlayers: () => Player[],
    private readonly sendRemote: (event: GameEvent) => void,
  ) {
    super();
    this.state = createInitialQuestState(activeSlotCount(getPlayers()));
  }

  getState(): IslandQuestState {
    return this.state;
  }

  onPlayersChanged(): void {
    const target = activeSlotCount(this.getPlayers());
    if (target > this.state.activeSlots && !this.state.doorOpen) {
      const next = { ...this.state, activeSlots: target, rev: this.state.rev + 1 };
      this.applyLocal(next);
    }
  }

  /** Полная синхронизация от другого клиента. */
  ingestSync(payload: unknown): void {
    if (typeof payload !== 'object' || payload === null || !('state' in payload)) return;
    const st = (payload as QuestSyncPayload).state;
    if (!st || typeof st.rev !== 'number') return;
    const merged = mergeQuestState(this.state, st);
    if (merged.rev !== this.state.rev) this.applyLocal(merged);
  }

  ingestRemoteEvent(event: GameEvent): void {
    if (event.type === 'quest_sync') {
      this.ingestSync(event.payload);
      return;
    }
    switch (event.type) {
      case 'quest_pick': {
        const slot = (event.payload as { slot?: number })?.slot;
        if (typeof slot !== 'number') return;
        const player = this.getPlayers().find((p) => p.id === event.from);
        if (!player) return;
        const res = tryPickKey(this.state, player, slot);
        if (res.ok) this.applyLocal(res.state);
        break;
      }
      case 'quest_insert': {
        const slot = (event.payload as { slot?: number })?.slot;
        if (typeof slot !== 'number') return;
        const player = this.getPlayers().find((p) => p.id === event.from);
        if (!player) return;
        const res = tryInsertKey(this.state, player, slot);
        if (res.ok) this.applyLocal(res.state);
        break;
      }
      case 'quest_portal_ack': {
        const res = tryPortalAck(this.state, event.from);
        if (res.ok) {
          this.applyLocal(res.state);
          this.maybeAdvanceLocation();
        }
        break;
      }
      default:
        break;
    }
  }

  pickKey(slot: number): 'ok' | 'wrong_color' | 'taken' | 'slot' {
    const res = tryPickKey(this.state, this.self, slot);
    if (!res.ok) return res.reason as 'wrong_color' | 'taken' | 'slot';
    this.applyLocal(res.state);
    this.emitRemote('quest_pick', { slot });
    return 'ok';
  }

  insertKey(slot: number): 'ok' | 'wrong_color' | 'no_key' | 'slot' {
    const res = tryInsertKey(this.state, this.self, slot);
    if (!res.ok) return res.reason as 'wrong_color' | 'no_key' | 'slot';
    this.applyLocal(res.state);
    this.emitRemote('quest_insert', { slot });
    if (res.broadcastAll) {
      // Дублируем полное состояние после открытия двери — надёжнее при потерях.
      this.broadcastFullState();
    }
    return 'ok';
  }

  acknowledgePortal(): void {
    const res = tryPortalAck(this.state, this.self.id);
    if (!res.ok) return;
    this.applyLocal(res.state);
    this.emitRemote('quest_portal_ack', {});
    this.maybeAdvanceLocation();
  }

  /** Новый игрок или переподключение: рассылаем снимок, если есть прогресс. */
  broadcastFullStateIfNeeded(): void {
    if (this.state.rev === 0) return;
    this.broadcastFullState();
  }

  broadcastFullState(): void {
    const payload: QuestSyncPayload = { state: this.state };
    this.emitRemote('quest_sync', payload);
  }

  private maybeAdvanceLocation(): void {
    const advanced = checkPortalTransition(this.state, this.getPlayers());
    if (advanced) {
      this.applyLocal(advanced);
      this.broadcastFullState();
    }
  }

  private applyLocal(state: IslandQuestState): void {
    this.state = state;
    this.emit('questState', state);
  }

  private emitRemote(type: string, payload: unknown): void {
    this.sendRemote({ type, from: this.self.id, payload, t: Date.now() });
  }
}