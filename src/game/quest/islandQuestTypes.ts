/** Фаза ключа в квесте (0..3 = цвет игрока). */
export type KeyPhase = 'map' | 'held' | 'inserted';

export type QuestLocationId = 1 | 2;

export interface IslandQuestState {
  /** Версия состояния: при конфликте берётся большее значение. */
  rev: number;
  /** Сид раскладки (из кода комнаты) — не меняется в сессии. */
  layoutSeed: number;
  /** Координаты ключей на карте, общие для комнаты. */
  keyPositions: [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
  ];
  /** Сколько слотов ключей активно (3 или 4). */
  activeSlots: number;
  slots: [KeyPhase, KeyPhase, KeyPhase, KeyPhase];
  /** Кто держит ключ (slot → playerId), только при held. */
  heldBy: [string | null, string | null, string | null, string | null];
  doorOpen: boolean;
  /** Игрок подтвердил вход в портал после открытия двери. */
  portalReady: Record<string, boolean>;
  locationId: QuestLocationId;
}

export type QuestEventType =
  | 'quest_sync'
  | 'quest_pick'
  | 'quest_insert'
  | 'quest_portal_ack';

export interface QuestPickPayload {
  slot: number;
}

export interface QuestInsertPayload {
  slot: number;
}

export interface QuestSyncPayload {
  state: IslandQuestState;
}