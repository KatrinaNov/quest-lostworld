import { LEGEND_BODY, LEGEND_TITLE } from '../game/quest/islandQuestConfig';

const STORAGE_KEY = 'quest-lostworld-legend-seen';

/** Модальное окно легенды: повторный просмотр, мобильная вёрстка. */
export class LegendModal {
  private readonly backdrop: HTMLElement;
  private readonly dialog: HTMLElement;
  private onStart: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'legend-backdrop';
    this.backdrop.hidden = true;

    this.dialog = document.createElement('div');
    this.dialog.className = 'legend-modal';
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'true');
    this.dialog.innerHTML = `
      <button type="button" class="legend-close" aria-label="Закрыть">×</button>
      <h2 class="legend-title"></h2>
      <div class="legend-body"></div>
      <button type="button" class="legend-start">Начать приключение</button>
    `;
    this.dialog.querySelector('.legend-title')!.textContent = LEGEND_TITLE;
    const body = this.dialog.querySelector('.legend-body') as HTMLElement;
    body.textContent = LEGEND_BODY;

    this.backdrop.appendChild(this.dialog);
    parent.appendChild(this.backdrop);

    this.dialog.querySelector('.legend-close')!.addEventListener('click', () => this.close());
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });
    this.dialog.querySelector('.legend-start')!.addEventListener('click', () => {
      sessionStorage.setItem(STORAGE_KEY, '1');
      this.onStart?.();
      this.close();
    });
  }

  private onClose: (() => void) | null = null;

  open(options: { onStart?: () => void; onClose?: () => void } = {}): void {
    this.onStart = options.onStart ?? null;
    this.onClose = options.onClose ?? null;
    this.backdrop.hidden = false;
    document.body.classList.add('modal-open');
  }

  close(): void {
    this.backdrop.hidden = true;
    document.body.classList.remove('modal-open');
    this.onClose?.();
    this.onStart = null;
    this.onClose = null;
  }

  isOpen(): boolean {
    return !this.backdrop.hidden;
  }
}