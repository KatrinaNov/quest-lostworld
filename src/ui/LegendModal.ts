import { LEGEND_KEYS, LEGEND_STORY, LEGEND_TITLE } from '../game/quest/islandQuestConfig';

/** Модальное окно легенды: повторный просмотр, мобильная вёрстка. */
export class LegendModal {
  private readonly backdrop: HTMLElement;
  private readonly dialog: HTMLElement;
  private readonly title: HTMLElement;
  private readonly body: HTMLElement;
  private readonly action: HTMLButtonElement;
  private page: 'story' | 'keys' = 'story';
  private onStart: (() => void) | null = null;
  private onClose: (() => void) | null = null;
  private previousFocus: HTMLElement | null = null;

  constructor(parent: HTMLElement) {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'legend-backdrop';
    this.backdrop.hidden = true;

    this.dialog = document.createElement('div');
    this.dialog.className = 'legend-modal';
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'true');
    this.dialog.setAttribute('aria-labelledby', 'island-legend-title');
    this.dialog.innerHTML = `
      <button type="button" class="legend-close" aria-label="Закрыть">×</button>
      <h2 id="island-legend-title" class="legend-title" tabindex="-1"></h2>
      <div class="legend-body"></div>
      <button type="button" class="legend-start"></button>
    `;
    this.title = this.dialog.querySelector<HTMLElement>('.legend-title')!;
    this.body = this.dialog.querySelector<HTMLElement>('.legend-body')!;
    this.action = this.dialog.querySelector<HTMLButtonElement>('.legend-start')!;

    this.backdrop.appendChild(this.dialog);
    parent.appendChild(this.backdrop);

    const close = this.dialog.querySelector<HTMLButtonElement>('.legend-close')!;
    close.addEventListener('click', () => this.close());
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });
    this.dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      } else if (event.key === 'Tab') {
        const atEnd = !event.shiftKey && document.activeElement === this.action;
        const atStart = event.shiftKey && (document.activeElement === close || document.activeElement === this.title);
        if (atEnd || atStart) {
          event.preventDefault();
          (atEnd ? close : this.action).focus();
        }
      }
    });
    this.action.addEventListener('click', () => {
      if (this.page === 'story') {
        this.showPage('keys');
        return;
      }
      const start = this.onStart;
      this.close();
      start?.();
    });
  }

  open(options: { onStart?: () => void; onClose?: () => void } = {}): void {
    this.onStart = options.onStart ?? null;
    this.onClose = options.onClose ?? null;
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.backdrop.hidden = false;
    document.body.classList.add('modal-open');
    this.showPage('story');
  }

  close(): void {
    if (this.backdrop.hidden) return;
    this.backdrop.hidden = true;
    document.body.classList.remove('modal-open');
    const closed = this.onClose;
    this.onStart = null;
    this.onClose = null;
    this.previousFocus?.focus({ preventScroll: true });
    this.previousFocus = null;
    closed?.();
  }

  destroy(): void {
    this.close();
    this.backdrop.remove();
  }

  private showPage(page: 'story' | 'keys'): void {
    this.page = page;
    this.title.textContent = page === 'story' ? LEGEND_TITLE : 'КЛЮЧИ ОСТРОВА';
    this.action.textContent = page === 'story' ? 'Что же делать?' : 'Начать приключение';
    const paragraphs = page === 'story' ? LEGEND_STORY : LEGEND_KEYS;
    this.body.replaceChildren(...paragraphs.map((text) => {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      return paragraph;
    }));
    this.dialog.scrollTop = 0;
    this.title.focus({ preventScroll: true });
  }
}
