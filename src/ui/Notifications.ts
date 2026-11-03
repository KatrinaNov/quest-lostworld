export type NoticeKind = 'info' | 'success' | 'warn' | 'error';

const MAX_TOASTS = 3;

/**
 * Собственные уведомления вместо alert():
 *  - toast — короткие всплывающие сообщения;
 *  - banner — постоянная плашка статуса (например, «Переподключаемся…»).
 */
export class Notifications {
  private readonly toastBox: HTMLElement;
  private readonly banner: HTMLElement;

  constructor(root: HTMLElement) {
    this.toastBox = root;
    this.toastBox.classList.add('toast-box');

    this.banner = document.createElement('div');
    this.banner.className = 'status-banner';
    this.banner.hidden = true;
    this.banner.setAttribute('role', 'status');
    root.parentElement?.appendChild(this.banner);
  }

  show(text: string, kind: NoticeKind = 'info', durationMs = 3500): void {
    while (this.toastBox.childElementCount >= MAX_TOASTS) {
      this.toastBox.firstElementChild?.remove();
    }
    const toast = document.createElement('div');
    toast.className = `toast toast--${kind}`;
    toast.textContent = text;
    this.toastBox.appendChild(toast);

    window.setTimeout(() => {
      toast.classList.add('toast--out');
      window.setTimeout(() => toast.remove(), 300);
    }, durationMs);
  }

  /** Показывает постоянную плашку; null — скрывает. */
  setBanner(text: string | null, kind: NoticeKind = 'warn'): void {
    if (text === null) {
      this.banner.hidden = true;
      return;
    }
    this.banner.hidden = false;
    this.banner.className = `status-banner status-banner--${kind}`;
    this.banner.textContent = text;
  }
}
