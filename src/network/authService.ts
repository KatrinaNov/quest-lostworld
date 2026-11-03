import { APP_CONFIG } from '../config/appConfig';
import { getSupabase } from './supabaseClient';
import { GameError } from './types';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new GameError('timeout', 'Сервер не отвечает. Проверьте интернет и повторите попытку.')),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function obtainUserId(): Promise<string> {
  const supabase = getSupabase();

  const { data: existing } = await supabase.auth.getSession();
  if (existing.session?.user) {
    return existing.session.user.id;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('anonymous') && (msg.includes('disabled') || msg.includes('not enabled'))) {
      throw new GameError(
        'auth',
        'В проекте Supabase выключена анонимная авторизация. Включите Authentication → Sign In / Providers → Anonymous.',
      );
    }
    if (error.status === 429 || msg.includes('rate limit')) {
      throw new GameError('auth', 'Слишком много входов с этой сети. Подождите немного и повторите попытку.');
    }
    throw new GameError('auth', `Не удалось войти анонимно: ${error.message}`);
  }
  if (!data.user) {
    throw new GameError('auth', 'Supabase не вернул пользователя после анонимного входа.');
  }
  return data.user.id;
}

/**
 * Гарантирует наличие анонимной сессии Supabase и возвращает id пользователя.
 * Этот id используется как идентификатор игрока.
 */
export async function ensureAnonymousSession(): Promise<string> {
  try {
    return await withTimeout(obtainUserId(), APP_CONFIG.subscribeTimeoutMs);
  } catch (err) {
    if (err instanceof GameError) throw err;
    throw new GameError('network', 'Не удалось связаться с сервером. Проверьте интернет и повторите попытку.');
  }
}
