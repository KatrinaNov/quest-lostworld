import { MINECRAFT_INTRO } from '../game/config/minecraftWorldConfig';

/** Стартовое окно второй локации. */
export class LocationIntroModal {
  private readonly backdrop: HTMLElement;
  private readonly dialog: HTMLElement;

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
      <button type="button" class="legend-start"></button>
    `;
    this.backdrop.appendChild(this.dialog);
    parent.appendChild(this.backdrop);

    this.dialog.querySelector('.legend-close')!.addEventListener('click', () => this.close());
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });
    this.dialog.querySelector('.legend-start')!.addEventListener('click', () => this.close());
  }

  openMinecraft(): void {
    this.dialog.querySelector('.legend-title')!.textContent = MINECRAFT_INTRO.title;
    const body = this.dialog.querySelector('.legend-body') as HTMLElement;
    body.textContent = MINECRAFT_INTRO.body;
    const btn = this.dialog.querySelector('.legend-start') as HTMLButtonElement;
    btn.textContent = MINECRAFT_INTRO.button;
    this.backdrop.hidden = false;
    document.body.classList.add('modal-open');
  }

  close(): void {
    this.backdrop.hidden = true;
    document.body.classList.remove('modal-open');
  }
}