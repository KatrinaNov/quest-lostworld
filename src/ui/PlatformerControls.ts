/** Крупные кнопки только для мобильной сцены храма. */
export class PlatformerControls {
  private readonly root: HTMLElement;
  private left = false;
  private right = false;
  private jumpQueued = false;
  private readonly stops: Array<() => void> = [];
  private readonly releaseButtons: Array<() => void> = [];

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'platformer-controls';
    this.root.innerHTML = `<button type="button" class="platformer-btn platformer-btn--left" aria-label="Влево">◀</button><button type="button" class="platformer-btn platformer-btn--right" aria-label="Вправо">▶</button><button type="button" class="platformer-btn platformer-btn--jump" aria-label="Прыжок">▲</button>`;
    parent.appendChild(this.root);
    this.bind('.platformer-btn--left', (active) => { this.left = active; });
    this.bind('.platformer-btn--right', (active) => { this.right = active; });
    this.bind('.platformer-btn--jump', (active) => { if (active) this.jumpQueued = true; });
    window.addEventListener('blur', this.reset);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.stops.push(() => {
      window.removeEventListener('blur', this.reset);
      document.removeEventListener('visibilitychange', this.onVisibility);
    });
  }

  getHorizontal(): number { return (this.right ? 1 : 0) - (this.left ? 1 : 0); }
  consumeJump(): boolean { const value = this.jumpQueued; this.jumpQueued = false; return value; }
  destroy(): void {
    this.reset();
    for (const stop of this.stops) stop();
    this.root.remove();
  }

  private readonly reset = (): void => {
    for (const release of this.releaseButtons) release();
    this.jumpQueued = false;
  };

  private readonly onVisibility = (): void => {
    if (document.hidden) this.reset();
  };

  private bind(selector: string, set: (active: boolean) => void): void {
    const button = this.root.querySelector(selector) as HTMLButtonElement;
    let pointer: number | null = null;
    const end = (event?: PointerEvent): void => {
      if (event && pointer !== event.pointerId) return;
      pointer = null; set(false); button.classList.remove('platformer-btn--held');
    };
    const start = (event: PointerEvent): void => {
      if (pointer !== null || event.button !== 0) return;
      event.preventDefault();
      pointer = event.pointerId;
      set(true); button.classList.add('platformer-btn--held');
    };
    this.releaseButtons.push(end);
    button.addEventListener('pointerdown', start);
    button.addEventListener('lostpointercapture', end);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    this.stops.push(() => {
      button.removeEventListener('pointerdown', start);
      button.removeEventListener('lostpointercapture', end);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    });
  }
}
