import type { ConnectionStatus, GameBridge, Player } from '../network/types';
import { isFullscreenSupported, isMobileDevice, isStandalone, toggleFullscreen } from './Fullscreen';
import type { Notifications } from './Notifications';

const LEAVE_CONFIRM_MS = 3000;

function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

/** Игровой интерфейс поверх сцены: код комнаты, список игроков, статус связи, выход. */
export class Hud {
  private readonly root: HTMLElement;
  private readonly dot: HTMLElement;
  private readonly list: HTMLElement;
  private readonly leaveBtn: HTMLButtonElement;
  private leaveTimer: number | null = null;
  private readonly unsubscribe: Array<() => void> = [];

  constructor(
    parent: HTMLElement,
    private readonly room: GameBridge,
    private readonly onLeave: () => void,
    private readonly notifications: Notifications,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud-left">
        <button type="button" class="hud-code" title="Скопировать ссылку-приглашение">
          <span class="hud-dot"></span>
          <span class="hud-code-label">Код</span>
          <strong class="hud-code-value"></strong>
        </button>
        <ul class="hud-players"></ul>
      </div>
      <div class="hud-right">
        <button type="button" class="hud-fs" aria-label="Во весь экран" title="Во весь экран" hidden>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor"
              stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button type="button" class="hud-leave">Выйти</button>
      </div>
    `;
    parent.appendChild(this.root);

    this.dot = this.root.querySelector<HTMLElement>('.hud-dot') as HTMLElement;
    this.list = this.root.querySelector<HTMLElement>('.hud-players') as HTMLElement;
    this.leaveBtn = this.root.querySelector<HTMLButtonElement>('.hud-leave') as HTMLButtonElement;
    const codeBtn = this.root.querySelector<HTMLButtonElement>('.hud-code') as HTMLButtonElement;
    (this.root.querySelector('.hud-code-value') as HTMLElement).textContent = room.roomCode;

    // Кнопка «во весь экран» нужна, только если браузер умеет и это ещё не приложение.
    const fsBtn = this.root.querySelector<HTMLButtonElement>('.hud-fs') as HTMLButtonElement;
    if (isFullscreenSupported() && !isStandalone() && isMobileDevice()) {
      fsBtn.hidden = false;
      fsBtn.addEventListener('click', () => void toggleFullscreen());
    }

    codeBtn.addEventListener('click', () => void this.copyInvite());
    this.leaveBtn.addEventListener('click', () => this.handleLeaveClick());

    this.renderPlayers(room.getPlayers());
    this.renderStatus(room.getStatus());
    this.unsubscribe.push(
      room.on('players', (players) => this.renderPlayers(players)),
      room.on('status', (status) => this.renderStatus(status)),
    );
  }

  destroy(): void {
    for (const off of this.unsubscribe) off();
    if (this.leaveTimer !== null) window.clearTimeout(this.leaveTimer);
    this.root.remove();
  }

  private async copyInvite(): Promise<void> {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('room', this.room.roomCode);
    const ok = await copyText(url.toString());
    this.notifications.show(
      ok ? 'Ссылка-приглашение скопирована' : `Код комнаты: ${this.room.roomCode}`,
      ok ? 'success' : 'info',
    );
  }

  /** Двухэтапный выход: защита от случайного нажатия. */
  private handleLeaveClick(): void {
    if (this.leaveTimer !== null) {
      window.clearTimeout(this.leaveTimer);
      this.leaveTimer = null;
      this.onLeave();
      return;
    }
    this.leaveBtn.textContent = 'Точно выйти?';
    this.leaveBtn.classList.add('hud-leave--confirm');
    this.leaveTimer = window.setTimeout(() => {
      this.leaveTimer = null;
      this.leaveBtn.textContent = 'Выйти';
      this.leaveBtn.classList.remove('hud-leave--confirm');
    }, LEAVE_CONFIRM_MS);
  }

  private renderPlayers(players: Player[]): void {
    this.list.replaceChildren(
      ...players.map((player) => {
        const item = document.createElement('li');
        item.className = player.id === this.room.self.id ? 'hud-player hud-player--self' : 'hud-player';
        const swatch = document.createElement('span');
        swatch.className = 'hud-swatch';
        swatch.style.background = colorToCss(player.color);
        const name = document.createElement('span');
        name.className = 'hud-name';
        name.textContent = player.name; // textContent — имя не может внедрить HTML
        item.append(swatch, name);
        return item;
      }),
    );
  }

  private renderStatus(status: ConnectionStatus): void {
    this.dot.className = `hud-dot hud-dot--${status}`;
  }
}
