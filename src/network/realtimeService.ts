import {
  REALTIME_CHANNEL_STATES,
  REALTIME_SUBSCRIBE_STATES,
  type RealtimeChannel,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { APP_CONFIG } from '../config/appConfig';
import { Emitter } from './emitter';
import {
  GameError,
  type ConnectionStatus,
  type GameEvent,
  type Player,
  type Point,
  type PositionMessage,
  type PresencePayload,
  type RoomEvents,
  type RoomLeaveReason,
  type RoomMode,
  type RoomSession,
} from './types';

export interface ConnectOptions {
  mode: RoomMode;
  /** Стартовая точка для игрока, занявшего слот с номером slot (0..maxPlayers-1). */
  spawnForSlot: (slot: number) => Point;
}

/** Нормализация имени: без лишних пробелов и управляющих символов, ограниченной длины. */
export function sanitizePlayerName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, APP_CONFIG.playerNameMaxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parsePosition(raw: unknown): PositionMessage | null {
  if (!isRecord(raw)) return null;
  const { id, x, y, t } = raw;
  if (typeof id !== 'string' || !isFiniteNumber(x) || !isFiniteNumber(y)) return null;
  return { id, x, y, t: isFiniteNumber(t) ? t : 0 };
}

function parseGameEvent(raw: unknown): GameEvent | null {
  if (!isRecord(raw)) return null;
  const { type, from, payload, t } = raw;
  if (typeof type !== 'string' || typeof from !== 'string') return null;
  return { type, from, payload, t: isFiniteNumber(t) ? t : 0 };
}

/**
 * Сетевая сессия одной комнаты поверх Supabase Realtime.
 *
 *  - Presence: кто в комнате (имя, цвет, порядок входа). Источник правды о составе игроков.
 *  - Broadcast "pos": частые обновления координат (с ограничением частоты).
 *  - Broadcast "evt": универсальные игровые события (задел на будущие задания).
 *
 * Лимит игроков: порядок определяется парой (joinedAt, id). Видимыми считаются только первые
 * maxPlayers записей, поэтому лишний игрок никогда не отображается у остальных.
 */
export class RealtimeRoom extends Emitter<RoomEvents> implements RoomSession {
  readonly roomCode: string;
  readonly self: Player;

  private channel: RealtimeChannel | null = null;
  private players = new Map<string, Player>();
  private signature = '';
  private status: ConnectionStatus = 'connecting';
  private joinedAt = 0;

  private active = false;
  private closing = false;
  private sawSync = false;
  private pendingSubscribe: { resolve: () => void; reject: (e: GameError) => void } | null = null;
  private syncCheckers = new Set<() => void>();

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;

  private lastSent: Point = { x: Number.NaN, y: Number.NaN };
  private lastSentAt = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private readonly minIntervalMs = 1000 / APP_CONFIG.positionSendHz;

  constructor(
    private readonly client: SupabaseClient,
    userId: string,
    name: string,
    roomCode: string,
  ) {
    super();
    this.roomCode = roomCode;
    this.self = {
      id: userId,
      name,
      color: APP_CONFIG.playerColors[0],
      x: 0,
      y: 0,
      connected: false,
      updatedAt: Date.now(),
    };
  }

  // ---------------------------------------------------------------- публичный API

  getPlayers(): Player[] {
    return [...this.players.values()];
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Подключение к комнате с проверками:
   *  - create: комната с таким кодом не должна существовать;
   *  - join: в комнате уже должен кто-то быть, и не больше maxPlayers - 1 игроков.
   */
  async connect(options: ConnectOptions): Promise<void> {
    try {
      const subscribed = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new GameError('timeout', 'Сервер не отвечает. Проверьте интернет и повторите попытку.')),
          APP_CONFIG.subscribeTimeoutMs,
        );
        this.pendingSubscribe = {
          resolve: () => {
            clearTimeout(timer);
            resolve();
          },
          reject: (e) => {
            clearTimeout(timer);
            reject(e);
          },
        };
      });
      this.openChannel();
      await subscribed;

      // 1. Смотрим, кто уже в комнате (себя ещё не объявляли — у остальных ничего не мигает).
      await this.waitForSync(() => this.sawSync, APP_CONFIG.initialPresenceWaitMs);
      const existing = this.readPresence().filter((p) => p.id !== this.self.id);

      if (options.mode === 'create' && existing.length > 0) {
        throw new GameError('invalid_code', 'Код комнаты уже занят.');
      }
      if (options.mode === 'join' && existing.length === 0) {
        throw new GameError('not_found', 'Комната с таким кодом не найдена. Проверьте код.');
      }
      if (existing.length >= APP_CONFIG.maxPlayers) {
        throw new GameError('full', `Комната заполнена (максимум ${APP_CONFIG.maxPlayers} игрока).`);
      }

      // 2. Объявляем себя. joinedAt всегда строго больше, чем у уже вошедших,
      //    даже если часы телефонов расходятся — так новичок не вытеснит старожилов.
      const spawn = options.spawnForSlot(existing.length);
      this.self.x = spawn.x;
      this.self.y = spawn.y;
      this.self.color = this.pickFreeColor(existing.map((p) => p.color));
      this.joinedAt = Math.max(Date.now(), ...existing.map((p) => p.joinedAt + 1));

      const tracked = await this.trackSelf(this.channel);
      if (!tracked) throw new GameError('network', 'Не удалось зарегистрироваться в комнате.');

      const confirmed = await this.waitForSync(() => this.hasSelfPresence(), APP_CONFIG.presenceConfirmTimeoutMs);
      if (!confirmed) throw new GameError('timeout', 'Не удалось подтвердить подключение к комнате.');

      // 3. Проверка гонки: если одновременно вошли несколько игроков, лишний уходит.
      const rank = this.readPresence().findIndex((p) => p.id === this.self.id);
      if (rank >= APP_CONFIG.maxPlayers) {
        throw new GameError('full', `Комната заполнена (максимум ${APP_CONFIG.maxPlayers} игрока).`);
      }

      this.active = true;
      this.self.connected = true;
      this.applyPresence();
      this.setStatus('connected');
      this.startBackgroundWork();
    } catch (err) {
      await this.leave();
      if (err instanceof GameError) throw err;
      throw new GameError('network', 'Не удалось подключиться к комнате. Повторите попытку.');
    }
  }

  /** Отправка локальной позиции. Вызывать можно каждый кадр — частота ограничивается внутри. */
  sendPosition(x: number, y: number): void {
    this.self.x = x;
    this.self.y = y;
    this.self.updatedAt = Date.now();
    if (this.status !== 'connected') return;

    const rx = Math.round(x);
    const ry = Math.round(y);
    if (rx === this.lastSent.x && ry === this.lastSent.y) return;

    const wait = this.minIntervalMs - (performance.now() - this.lastSentAt);
    if (wait <= 0) {
      this.flushPosition();
    } else if (this.flushTimer === null) {
      // Завершающее обновление: гарантирует, что остановка игрока дойдёт до остальных.
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flushPosition();
      }, wait);
    }
  }

  /** Универсальное игровое событие для всех участников (задел под будущие механики). */
  sendGameEvent(type: string, payload: unknown): void {
    if (this.status !== 'connected' || !this.channel) return;
    const event: GameEvent = { type, from: this.self.id, payload, t: Date.now() };
    void this.channel.send({ type: 'broadcast', event: 'evt', payload: event });
  }

  async leave(): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    this.active = false;
    this.pendingSubscribe = null;
    this.stopBackgroundWork();
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;

    const channel = this.channel;
    this.channel = null;
    if (channel) {
      try {
        await Promise.race([channel.untrack(), new Promise((r) => setTimeout(r, 1500))]);
      } catch {
        // игнорируем: выходим в любом случае
      }
      await this.client.removeChannel(channel).catch(() => undefined);
    }
    this.setStatus('disconnected');
    this.clearListeners();
  }

  // ---------------------------------------------------------------- канал

  private openChannel(): void {
    const channel = this.client.channel(`room:${this.roomCode}`, {
      config: {
        presence: { key: this.self.id },
        broadcast: { self: false, ack: false },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => this.handleSync())
      .on('broadcast', { event: 'pos' }, ({ payload }) => this.handlePosition(payload))
      .on('broadcast', { event: 'evt' }, ({ payload }) => {
        const event = parseGameEvent(payload);
        if (event && event.from !== this.self.id) this.emit('gameEvent', event);
      });

    this.channel = channel;
    this.sawSync = false;
    channel.subscribe((status) => this.onChannelStatus(channel, status));
  }

  private onChannelStatus(channel: RealtimeChannel, status: REALTIME_SUBSCRIBE_STATES): void {
    if (channel !== this.channel || this.closing) return;

    if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
      if (this.pendingSubscribe) {
        const pending = this.pendingSubscribe;
        this.pendingSubscribe = null;
        pending.resolve();
      } else if (this.active) {
        void this.recover(channel);
      }
      return;
    }

    // CHANNEL_ERROR | TIMED_OUT | CLOSED
    if (this.pendingSubscribe) {
      const pending = this.pendingSubscribe;
      this.pendingSubscribe = null;
      pending.reject(new GameError('network', 'Не удалось подключиться к серверу. Проверьте интернет.'));
      return;
    }
    if (this.active) {
      this.setStatus('reconnecting');
      this.scheduleReconnect(APP_CONFIG.reconnectFirstDelayMs);
    }
  }

  /** Канал снова подписан (после обрыва): повторно объявляем себя и обновляем список игроков. */
  private async recover(channel: RealtimeChannel): Promise<void> {
    const tracked = await this.trackSelf(channel);
    if (channel !== this.channel || this.closing) return;
    const confirmed =
      tracked && (await this.waitForSync(() => this.hasSelfPresence(), APP_CONFIG.presenceConfirmTimeoutMs));
    if (channel !== this.channel || this.closing) return;

    if (!confirmed) {
      this.setStatus('reconnecting');
      this.scheduleReconnect(1000);
      return;
    }

    this.reconnectAttempt = 0;
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.applyPresence();
    if (!this.active) return;
    this.setStatus('connected');
    this.flushPosition();
  }

  private scheduleReconnect(delay: number): void {
    if (this.reconnectTimer !== null || this.closing) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.rebuild();
    }, delay);
  }

  /** Полностью пересоздаёт канал. Повторяется, пока соединение не восстановится. */
  private async rebuild(): Promise<void> {
    if (this.closing || !this.active || this.status === 'connected') return;
    this.reconnectAttempt += 1;

    const old = this.channel;
    this.channel = null;
    if (old) await this.client.removeChannel(old).catch(() => undefined);
    if (this.closing) return;

    // Обновляет токен, если он истёк, пока вкладка была в фоне.
    await this.client.auth.getSession().catch(() => undefined);
    if (this.closing) return;

    this.openChannel();
    const delay = Math.min(
      APP_CONFIG.reconnectFirstDelayMs * 1.5 ** this.reconnectAttempt,
      APP_CONFIG.reconnectMaxDelayMs,
    );
    this.scheduleReconnect(delay);
  }

  private rebuildNow(): void {
    if (this.closing || !this.active) return;
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.setStatus('reconnecting');
    void this.rebuild();
  }

  // ---------------------------------------------------------------- присутствие

  private presencePayload(): PresencePayload {
    return {
      id: this.self.id,
      name: this.self.name,
      color: this.self.color,
      joinedAt: this.joinedAt,
      x: Math.round(this.self.x),
      y: Math.round(this.self.y),
    };
  }

  private async trackSelf(channel: RealtimeChannel | null): Promise<boolean> {
    if (!channel) return false;
    try {
      return (await channel.track(this.presencePayload())) === 'ok';
    } catch {
      return false;
    }
  }

  /** Текущее состояние присутствия: по одной записи на игрока, отсортировано по порядку входа. */
  private readPresence(): PresencePayload[] {
    if (!this.channel) return [];
    const state = this.channel.presenceState<PresencePayload>();
    const result: PresencePayload[] = [];

    for (const [key, metas] of Object.entries(state)) {
      const meta = metas[metas.length - 1] as unknown;
      if (!isRecord(meta)) continue;
      const { name, color, joinedAt, x, y } = meta;
      if (typeof name !== 'string' || !isFiniteNumber(color) || !isFiniteNumber(joinedAt)) continue;
      result.push({
        id: key, // ключ присутствия = id пользователя
        name: sanitizePlayerName(name) || 'Игрок',
        color,
        joinedAt,
        x: isFiniteNumber(x) ? x : 0,
        y: isFiniteNumber(y) ? y : 0,
      });
    }

    result.sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1));
    return result;
  }

  private hasSelfPresence(): boolean {
    return this.readPresence().some((p) => p.id === this.self.id);
  }

  private pickFreeColor(taken: readonly number[]): number {
    return APP_CONFIG.playerColors.find((c) => !taken.includes(c)) ?? APP_CONFIG.playerColors[0];
  }

  private handleSync(): void {
    this.sawSync = true;
    for (const check of [...this.syncCheckers]) check();
    if (this.active) this.applyPresence();
  }

  /** Приводит локальный список игроков в соответствие с Presence. */
  private applyPresence(): void {
    const entries = this.readPresence();
    const visible = entries.slice(0, APP_CONFIG.maxPlayers);
    const selfEntry = entries.find((p) => p.id === this.self.id);

    if (selfEntry && !visible.includes(selfEntry)) {
      this.kick('room_full');
      return;
    }

    // Два игрока одновременно выбрали один цвет: позже вошедший меняет свой.
    if (selfEntry) {
      const selfIndex = entries.indexOf(selfEntry);
      const conflict = entries.slice(0, selfIndex).some((p) => p.color === this.self.color);
      if (conflict) {
        this.self.color = this.pickFreeColor(visible.filter((p) => p.id !== this.self.id).map((p) => p.color));
        void this.trackSelf(this.channel);
      }
    }

    const next = new Map<string, Player>();
    for (const entry of visible) {
      if (entry.id === this.self.id) {
        next.set(entry.id, this.self);
        continue;
      }
      const prev = this.players.get(entry.id);
      if (prev) {
        prev.name = entry.name;
        prev.color = entry.color;
        prev.connected = true;
        next.set(entry.id, prev);
      } else {
        next.set(entry.id, {
          id: entry.id,
          name: entry.name,
          color: entry.color,
          x: entry.x,
          y: entry.y,
          connected: true,
          updatedAt: Date.now(),
        });
      }
    }
    // Во время переподключения нашей записи в Presence может ещё не быть — себя не теряем.
    if (!next.has(this.self.id)) next.set(this.self.id, this.self);

    this.players = next;
    const signature = [...next.values()].map((p) => `${p.id}|${p.name}|${p.color}`).join(';');
    if (signature !== this.signature) {
      this.signature = signature;
      this.emit('players', this.getPlayers());
    }
  }

  private kick(reason: RoomLeaveReason): void {
    if (!this.active) return;
    this.active = false;
    this.emit('kicked', reason);
  }

  // ---------------------------------------------------------------- позиции

  private handlePosition(raw: unknown): void {
    const msg = parsePosition(raw);
    if (!msg || msg.id === this.self.id) return;
    const player = this.players.get(msg.id);
    if (!player) return; // о нём ещё не пришёл Presence — стартовая позиция возьмётся оттуда
    player.x = msg.x;
    player.y = msg.y;
    player.updatedAt = Date.now();
    this.emit('position', { id: msg.id, x: msg.x, y: msg.y });
  }

  private flushPosition(): void {
    if (this.status !== 'connected' || !this.channel) return;
    const x = Math.round(this.self.x);
    const y = Math.round(this.self.y);
    this.lastSent = { x, y };
    this.lastSentAt = performance.now();
    const message: PositionMessage = { id: this.self.id, x, y, t: Date.now() };
    void this.channel.send({ type: 'broadcast', event: 'pos', payload: message });
  }

  // ---------------------------------------------------------------- вспомогательное

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.self.connected = status === 'connected';
    this.emit('status', status);
  }

  private waitForSync(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
    if (predicate()) return Promise.resolve(true);
    return new Promise((resolve) => {
      const done = (ok: boolean): void => {
        clearTimeout(timer);
        this.syncCheckers.delete(check);
        resolve(ok);
      };
      const check = (): void => {
        if (predicate()) done(true);
      };
      const timer = setTimeout(() => done(predicate()), timeoutMs);
      this.syncCheckers.add(check);
    });
  }

  private readonly onOnline = (): void => {
    if (this.status !== 'connected') this.rebuildNow();
  };

  private readonly onVisibility = (): void => {
    if (document.visibilityState !== 'visible' || !this.active) return;
    if (this.channel?.state !== REALTIME_CHANNEL_STATES.joined) this.rebuildNow();
  };

  private startBackgroundWork(): void {
    window.addEventListener('online', this.onOnline);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.keepAliveTimer = setInterval(() => {
      if (this.status === 'connected') this.flushPosition();
    }, APP_CONFIG.positionKeepAliveMs);
  }

  private stopBackgroundWork(): void {
    window.removeEventListener('online', this.onOnline);
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.keepAliveTimer !== null) clearInterval(this.keepAliveTimer);
    if (this.flushTimer !== null) clearTimeout(this.flushTimer);
    this.keepAliveTimer = null;
    this.flushTimer = null;
  }
}
