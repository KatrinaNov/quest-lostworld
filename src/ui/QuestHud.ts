/** Кнопка действия и подсказка у края экрана (взаимодействие с объектами квеста). */
export class QuestHud {
  private readonly actionBtn: HTMLButtonElement;
  private readonly hint: HTMLElement;
  private readonly portalBanner: HTMLElement;
  private onAction: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    const wrap = document.createElement('div');
    wrap.className = 'quest-hud';
    wrap.innerHTML = `
      <p class="quest-hint" hidden></p>
      <button type="button" class="quest-action" hidden></button>
      <p class="quest-portal-banner" hidden></p>
    `;
    parent.appendChild(wrap);

    this.hint = wrap.querySelector('.quest-hint') as HTMLElement;
    this.actionBtn = wrap.querySelector('.quest-action') as HTMLButtonElement;
    this.portalBanner = wrap.querySelector('.quest-portal-banner') as HTMLElement;

    this.actionBtn.addEventListener('click', () => this.onAction?.());
  }

  setHint(text: string | null): void {
    if (!text) {
      this.hint.hidden = true;
      return;
    }
    this.hint.hidden = false;
    this.hint.textContent = text;
  }

  setAction(label: string | null, onClick: (() => void) | null): void {
    this.onAction = onClick;
    if (!label || !onClick) {
      this.actionBtn.hidden = true;
      return;
    }
    this.actionBtn.hidden = false;
    this.actionBtn.textContent = label;
  }

  setPortalBanner(visible: boolean, text?: string): void {
    this.portalBanner.hidden = !visible;
    if (text) this.portalBanner.textContent = text;
  }

  destroy(): void {
    this.actionBtn.parentElement?.remove();
  }
}