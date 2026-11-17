import type Phaser from 'phaser';
import { clampToViewport, worldToScreen } from '../game/quest/worldToScreen';

/** Кнопки взаимодействия над объектами в мире (следуют за камерой). */
export class QuestHud {
  private readonly actionBtn: HTMLButtonElement;
  private readonly hint: HTMLElement;
  private readonly portalBanner: HTMLElement;
  private onAction: (() => void) | null = null;
  private scene: Phaser.Scene | null = null;

  constructor(parent: HTMLElement) {
    const wrap = document.createElement('div');
    wrap.className = 'quest-hud-layer';
    wrap.innerHTML = `
      <p class="quest-world-hint" hidden></p>
      <button type="button" class="world-interact" hidden></button>
      <p class="quest-portal-banner" hidden></p>
    `;
    parent.appendChild(wrap);

    this.hint = wrap.querySelector('.quest-world-hint') as HTMLElement;
    this.actionBtn = wrap.querySelector('.world-interact') as HTMLButtonElement;
    this.portalBanner = wrap.querySelector('.quest-portal-banner') as HTMLElement;

    this.actionBtn.addEventListener('click', () => this.onAction?.());
  }

  bindScene(scene: Phaser.Scene | null): void {
    this.scene = scene;
  }

  setHintAtWorld(worldX: number, worldY: number, text: string | null): void {
    if (!text || !this.scene) {
      this.hint.hidden = true;
      return;
    }
    const screen = worldToScreen(this.scene, worldX, worldY - 72);
    if (!screen.visible) {
      this.hint.hidden = true;
      return;
    }
    this.hint.hidden = false;
    this.hint.textContent = text;
    const w = Math.min(280, window.innerWidth - 24);
    const clamped = clampToViewport(screen.x - w / 2, screen.y - 12, w, 80, 8);
    this.hint.style.width = `${w}px`;
    this.hint.style.left = `${clamped.x}px`;
    this.hint.style.top = `${clamped.y}px`;
  }

  setActionAtWorld(
    worldX: number,
    worldY: number,
    label: string | null,
    onClick: (() => void) | null,
  ): void {
    this.onAction = onClick;
    if (!label || !onClick || !this.scene) {
      this.actionBtn.hidden = true;
      return;
    }
    const screen = worldToScreen(this.scene, worldX, worldY - 58);
    if (!screen.visible) {
      this.actionBtn.hidden = true;
      return;
    }
    this.actionBtn.hidden = false;
    this.actionBtn.textContent = label;
    this.actionBtn.classList.add('world-interact--in');
    const width = Math.max(108, Math.min(200, label.length * 11 + 36));
    const height = 44;
    const clamped = clampToViewport(screen.x - width / 2, screen.y - height, width, height, 8);
    this.actionBtn.style.width = `${width}px`;
    this.actionBtn.style.left = `${clamped.x}px`;
    this.actionBtn.style.top = `${clamped.y}px`;
  }

  clearWorldUi(): void {
    this.actionBtn.hidden = true;
    this.hint.hidden = true;
    this.onAction = null;
  }

  setPortalBanner(visible: boolean, text?: string): void {
    this.portalBanner.hidden = !visible;
    if (text) this.portalBanner.textContent = text;
  }

  destroy(): void {
    this.scene = null;
    this.actionBtn.parentElement?.remove();
  }
}