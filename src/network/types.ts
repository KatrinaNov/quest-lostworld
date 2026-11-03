/**
 * Сетевые типы. Игровые сцены импортируют отсюда только типы (не Supabase).
 */

export interface Player {
  /** Идентификатор = id анонимного пользователя Supabase (auth.uid()). */
  id: string;
  name: string;
  color: number;
  x: number;
  y: number;
  connected: boolean;
  /** Время последнего обновления (Date.now() на получающем клиенте). */
  updatedAt: number;
}

/**
 * Состояние игрока в Realtime Presence (редко меняется).
 * Объявлен через type, чтобы подходить под Record<string, unknown> Supabase.
 */
export type PresencePayload = {
  id: string;
  name: string;
  color: number;
  /** Логические «часы» входа — определяют порядок игроков и лимит комнаты. */
  joinedAt: number;
  /** Позиция в момент последнего track() — нужна новичкам для первого отображения. */
  x: number;
  y: number;
};

/** Частые обновления позиции (Realtime Broadcast). */
export type PositionMessage = {
  id: string;
  x: number;
  y: number;
  t: number;
};

/**
 * Универсальный конверт для будущих игровых событий (задания, голосование,
 * активация плит, подтверждение ведущего и т.п.). Пока используется только как точка расширения.
 */
export type GameEvent = {
  type: string;
  from: string;
  payload: unknown;
  t: number;
};

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

/**
 * Фаза комнаты. Сейчас только свободное исследование мира.
 * Позже: 'lobby' | 'playing' | 'waiting_real_world' | 'waiting_host' | 'finished' и т.д.
 */
export type RoomPhase = 'free_roam';

export type RoomMode = 'create' | 'join';

export type GameErrorCode =
  | 'config'
  | 'auth'
  | 'invalid_name'
  | 'invalid_code'
  | 'not_found'
  | 'full'
  | 'timeout'
  | 'network';

export class GameError extends Error {
  readonly code: GameErrorCode;

  constructor(code: GameErrorCode, message: string) {
    super(message);
    this.name = 'GameError';
    this.code = code;
  }
}

export interface Point {
  x: number;
  y: number;
}

export type RoomLeaveReason = 'room_full' | 'closed';

/** События, которые отдаёт сетевая сессия комнаты. */
export interface RoomEvents {
  /** Изменился состав игроков (вход/выход/имя/цвет). Аргумент — актуальный список. */
  players: Player[];
  /** Пришла новая позиция удалённого игрока. */
  position: { id: string; x: number; y: number };
  status: ConnectionStatus;
  gameEvent: GameEvent;
  /** Сессию пришлось завершить (например, комната оказалась переполнена). */
  kicked: RoomLeaveReason;
}

/**
 * Интерфейс, через который игровая сцена общается с сетью.
 * Сцена ничего не знает о Supabase.
 */
export interface GameBridge {
  readonly self: Player;
  readonly roomCode: string;
  getPlayers(): Player[];
  getStatus(): ConnectionStatus;
  on<K extends keyof RoomEvents>(event: K, listener: (data: RoomEvents[K]) => void): () => void;
  sendPosition(x: number, y: number): void;
}

/** Сессия комнаты для приложения: мост для игры + возможность выйти. */
export interface RoomSession extends GameBridge {
  leave(): Promise<void>;
}
