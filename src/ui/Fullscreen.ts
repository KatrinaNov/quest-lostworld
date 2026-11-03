/**
 * Полноэкранный режим для телефонов (скрывает адресную строку браузера).
 *
 *  - Android / Chrome: Fullscreen API, вызывать можно только из обработчика касания.
 *    В полноэкранном режиме дополнительно фиксируем альбомную ориентацию.
 *  - iPhone / iPad (Safari): Fullscreen API для страниц недоступен. Адресную строку можно убрать,
 *    только добавив игру на экран «Домой» (работает как приложение, см. manifest и мета-теги).
 */

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

/** Телефон или планшет с сенсорным экраном как основным устройством ввода. */
export function isMobileDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
}

export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
}

/** Игра запущена как установленное приложение (иконка на экране «Домой»). */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  );
}

export function isFullscreenSupported(): boolean {
  const el = document.documentElement as FullscreenElement;
  return typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function';
}

export function isFullscreen(): boolean {
  const doc = document as FullscreenDocument;
  return Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement);
}

/** Входит в полноэкранный режим. Безопасно вызывать многократно: ошибки игнорируются. */
export async function enterFullscreen(): Promise<void> {
  if (isFullscreen() || !isFullscreenSupported()) return;
  const el = document.documentElement as FullscreenElement;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: 'hide' });
    } else {
      await el.webkitRequestFullscreen?.();
    }
    await (screen.orientation as LockableOrientation).lock?.('landscape');
  } catch {
    // пользователь отказал или браузер не поддерживает блокировку ориентации — не критично
  }
}

export async function exitFullscreen(): Promise<void> {
  const doc = document as FullscreenDocument;
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else await doc.webkitExitFullscreen?.();
  } catch {
    // игнорируем
  }
}

export async function toggleFullscreen(): Promise<void> {
  if (isFullscreen()) await exitFullscreen();
  else await enterFullscreen();
}
