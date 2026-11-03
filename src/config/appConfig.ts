/**
 * Общие настройки приложения (сеть, лобби, переменные окружения).
 * Настройки игрового мира и движения — в src/game/config/worldConfig.ts.
 */
export const APP_CONFIG = {
  /** Название игры. */
  title: 'Тайна затерянного мира',

  /** Supabase: значения берутся из .env / GitHub Actions Variables. */
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '',
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '',

  /** Максимальное число игроков в комнате. */
  maxPlayers: 4,

  /** Код комнаты: 6 символов, без похожих (0/O, 1/I/L). */
  roomCodeLength: 6,
  roomCodeAlphabet: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
  /** Сколько раз пробуем сгенерировать код, если он уже занят. */
  roomCodeMaxAttempts: 5,

  /** Ограничения имени игрока. */
  playerNameMaxLength: 14,

  /** Частота отправки координат (обновлений в секунду). */
  positionSendHz: 12,
  /** Таймауты сетевых операций, мс. */
  subscribeTimeoutMs: 10_000,
  /** Сколько ждём первое состояние присутствия после подписки. */
  initialPresenceWaitMs: 4_000,
  presenceConfirmTimeoutMs: 8_000,

  /** Переподключение: первая попытка и максимальная пауза, мс. */
  reconnectFirstDelayMs: 4_000,
  reconnectMaxDelayMs: 10_000,

  /** Цвета персонажей (по порядку занятия). */
  playerColors: [0xff7a59, 0x4cc9f0, 0xb8f25c, 0xf7c948],
  playerColorNames: ['Огненный', 'Лазурный', 'Лесной', 'Золотой'],
} as const;

export function isSupabaseConfigured(): boolean {
  return APP_CONFIG.supabaseUrl.length > 0 && APP_CONFIG.supabaseAnonKey.length > 0;
}
