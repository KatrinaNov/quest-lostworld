import { APP_CONFIG } from '../config/appConfig';
import { ensureAnonymousSession } from './authService';
import { RealtimeRoom, sanitizePlayerName, type ConnectOptions } from './realtimeService';
import { getSupabase } from './supabaseClient';
import { GameError } from './types';

/** Генерирует код комнаты из безопасного алфавита с помощью crypto.getRandomValues. */
export function generateRoomCode(): string {
  const { roomCodeAlphabet: alphabet, roomCodeLength: length } = APP_CONFIG;
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return code;
}

/** Приводит ввод пользователя к виду кода: верхний регистр, без пробелов и дефисов. */
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

function validateName(raw: string): string {
  const name = sanitizePlayerName(raw);
  if (name.length === 0) {
    throw new GameError('invalid_name', 'Введите имя игрока.');
  }
  return name;
}

function validateCode(raw: string): string {
  const code = normalizeRoomCode(raw);
  const pattern = new RegExp(`^[${APP_CONFIG.roomCodeAlphabet}]{${APP_CONFIG.roomCodeLength}}$`);
  if (!pattern.test(code)) {
    throw new GameError('invalid_code', `Код комнаты — ${APP_CONFIG.roomCodeLength} символов (буквы и цифры).`);
  }
  return code;
}

type SpawnForSlot = ConnectOptions['spawnForSlot'];

/** Создание комнаты: генерируем код и подключаемся. Если код вдруг занят — пробуем другой. */
export async function createRoom(rawName: string, spawnForSlot: SpawnForSlot): Promise<RealtimeRoom> {
  const name = validateName(rawName);
  const userId = await ensureAnonymousSession();
  const client = getSupabase();

  for (let attempt = 0; attempt < APP_CONFIG.roomCodeMaxAttempts; attempt += 1) {
    const room = new RealtimeRoom(client, userId, name, generateRoomCode());
    try {
      await room.connect({ mode: 'create', spawnForSlot });
      return room;
    } catch (err) {
      const collision = err instanceof GameError && err.code === 'invalid_code';
      if (!collision) throw err;
    }
  }
  throw new GameError('network', 'Не удалось создать комнату. Повторите попытку.');
}

/** Подключение к существующей комнате по коду. */
export async function joinRoom(rawName: string, rawCode: string, spawnForSlot: SpawnForSlot): Promise<RealtimeRoom> {
  const name = validateName(rawName);
  const code = validateCode(rawCode);
  const userId = await ensureAnonymousSession();

  const room = new RealtimeRoom(getSupabase(), userId, name, code);
  await room.connect({ mode: 'join', spawnForSlot });
  return room;
}
