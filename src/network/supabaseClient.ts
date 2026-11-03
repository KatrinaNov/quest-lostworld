import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { APP_CONFIG, isSupabaseConfigured } from '../config/appConfig';
import { GameError } from './types';

let client: SupabaseClient | null = null;

/**
 * Ленивая инициализация клиента Supabase.
 * Используется только anon (publishable) ключ. service_role во frontend использовать нельзя.
 *
 * Сессия хранится в sessionStorage: каждая вкладка = отдельный анонимный игрок.
 * Это удобно для тестов (несколько вкладок на одном компьютере) и не мешает телефонам:
 * при обновлении страницы в той же вкладке сессия сохраняется.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  if (!isSupabaseConfigured()) {
    throw new GameError(
      'config',
      'Не заданы VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY. Создайте файл .env по образцу .env.example.',
    );
  }

  client = createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: window.sessionStorage,
    },
    realtime: {
      params: { eventsPerSecond: 20 },
    },
  });
  return client;
}
