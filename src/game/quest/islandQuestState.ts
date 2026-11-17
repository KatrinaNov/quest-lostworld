import { APP_CONFIG } from '../../config/appConfig';
import type { Player } from '../../network/types';
import { generateKeyPositions, hashRoomCode } from './keyPlacement';
import type { IslandQuestState, KeyPhase } from './islandQuestTypes';

export function createInitialQuestState(activeSlots: number, roomCode: string): IslandQuestState {
  const n = Math.max(1, Math.min(APP_CONFIG.maxPlayers, activeSlots));
  const keyPositions = generateKeyPositions(roomCode);
  return {
    rev: 0,
    layoutSeed: hashRoomCode(roomCode),
    keyPositions,
    activeSlots: n,
    slots: ['map', 'map', 'map', 'map'],
    heldBy: [null, null, null, null],
    doorOpen: false,
    portalReady: {},
    locationId: 1,
  };
}

export function colorToSlot(color: number): number {
  const idx = (APP_CONFIG.playerColors as readonly number[]).indexOf(color);
  return idx >= 0 ? idx : 0;
}

/** Активные игроки комнаты → число ключей (3–4 по ТЗ, меньше — по факту). */
export function activeSlotCount(players: Player[]): number {
  const n = players.filter((p) => p.connected).length;
  return Math.min(APP_CONFIG.maxPlayers, Math.max(1, n));
}

function cloneState(state: IslandQuestState): IslandQuestState {
  return {
    ...state,
    keyPositions: state.keyPositions.map((p) => ({ x: p.x, y: p.y })) as IslandQuestState['keyPositions'],
    slots: [...state.slots] as IslandQuestState['slots'],
    heldBy: [...state.heldBy] as IslandQuestState['heldBy'],
    portalReady: { ...state.portalReady },
  };
}

function allInserted(state: IslandQuestState): boolean {
  for (let i = 0; i < state.activeSlots; i += 1) {
    if (state.slots[i] !== 'inserted') return false;
  }
  return true;
}

export function mergeQuestState(
  current: IslandQuestState,
  incoming: IslandQuestState,
): IslandQuestState {
  if (incoming.rev < current.rev) return current;
  return cloneState(incoming);
}

export type QuestApplyResult =
  | { ok: true; state: IslandQuestState; broadcastAll?: boolean }
  | { ok: false; reason: string };

export function tryPickKey(
  state: IslandQuestState,
  player: Player,
  slot: number,
): QuestApplyResult {
  if (state.doorOpen || state.locationId !== 1) return { ok: false, reason: 'done' };
  if (slot < 0 || slot >= state.activeSlots) return { ok: false, reason: 'slot' };
  if (state.slots[slot] !== 'map') return { ok: false, reason: 'taken' };
  if (colorToSlot(player.color) !== slot) return { ok: false, reason: 'wrong_color' };

  const next = cloneState(state);
  next.rev += 1;
  next.slots[slot] = 'held';
  next.heldBy[slot] = player.id;
  return { ok: true, state: next };
}

export function tryInsertKey(
  state: IslandQuestState,
  player: Player,
  slot: number,
): QuestApplyResult {
  if (state.doorOpen || state.locationId !== 1) return { ok: false, reason: 'done' };
  if (slot < 0 || slot >= state.activeSlots) return { ok: false, reason: 'slot' };
  if (colorToSlot(player.color) !== slot) return { ok: false, reason: 'wrong_color' };
  if (state.slots[slot] !== 'held' || state.heldBy[slot] !== player.id) {
    return { ok: false, reason: 'no_key' };
  }

  const next = cloneState(state);
  next.rev += 1;
  next.slots[slot] = 'inserted';
  next.heldBy[slot] = null;

  const opening = !next.doorOpen && allInserted(next);
  if (opening) {
    next.doorOpen = true;
    return { ok: true, state: next, broadcastAll: true };
  }
  return { ok: true, state: next };
}

export function tryPortalAck(
  state: IslandQuestState,
  playerId: string,
): QuestApplyResult {
  if (!state.doorOpen || state.locationId !== 1) return { ok: false, reason: 'locked' };
  if (state.portalReady[playerId]) return { ok: false, reason: 'already' };

  const next = cloneState(state);
  next.rev += 1;
  next.portalReady[playerId] = true;
  return { ok: true, state: next };
}

export function checkPortalTransition(
  state: IslandQuestState,
  players: Player[],
): IslandQuestState | null {
  if (!state.doorOpen || state.locationId !== 1) return null;
  const active = players.filter((p) => p.connected);
  if (active.length === 0) return null;
  if (!active.every((p) => state.portalReady[p.id])) return null;

  const next = cloneState(state);
  next.rev += 1;
  next.locationId = 2;
  return next;
}

export function slotPhaseLabel(colorLabel: string, phase: KeyPhase): string {
  switch (phase) {
    case 'map':
      return `${colorLabel} — ключ ещё не найден`;
    case 'held':
      return `${colorLabel} — ключ найден, ещё не доставлен`;
    case 'inserted':
      return `${colorLabel} — ключ установлен`;
    default:
      return colorLabel;
  }
}