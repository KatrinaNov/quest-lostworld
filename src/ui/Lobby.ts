import { APP_CONFIG } from '../config/appConfig';
import { GameError } from '../network/types';
import { normalizeRoomCode } from '../network/roomService';

export interface LobbyHandlers {
  onCreate(name: string): Promise<void>;
  onJoin(name: string, code: string): Promise<void>;
}

type StatusKind = 'info' | 'error' | 'success';

const NAME_STORAGE_KEY = 'coopquest.playerName';

function requireElement<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Lobby: элемент ${selector} не найден`);
  return el;
}

/** Стартовый экран: имя игрока, создание комнаты, подключение по коду. */
export class Lobby {
  private readonly screen: HTMLElement;
  private readonly nameInput: HTMLInputElement;
  private readonly codeInput: HTMLInputElement;
  private readonly createBtn: HTMLButtonElement;
  private readonly joinBtn: HTMLButtonElement;
  private readonly status: HTMLElement;
  private busy = false;

  constructor(
    root: HTMLElement,
    private readonly handlers: LobbyHandlers,
  ) {
    this.screen = document.createElement('section');
    this.screen.className = 'lobby';
    this.screen.innerHTML = `
      <div class="lobby-card">
        <div class="lobby-intro">
          <div class="lobby-emblem" aria-hidden="true"><span></span></div>
          <h1 class="lobby-title">${APP_CONFIG.title}</h1>
          <p class="lobby-sub">Командное приключение для ${APP_CONFIG.maxPlayers} игроков</p>
          <label class="field">
            <span class="field-label">Ваше имя</span>
            <input id="lobby-name" type="text" maxlength="${APP_CONFIG.playerNameMaxLength}"
              autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="next"
              placeholder="Например, Маша" />
          </label>
        </div>
        <div class="lobby-actions">
          <button id="lobby-create" class="btn btn--primary" type="button">Создать комнату</button>
          <div class="lobby-divider"><span>или</span></div>
          <label class="field">
            <span class="field-label">Код комнаты</span>
            <input id="lobby-code" type="text" maxlength="9" inputmode="text"
              autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false"
              enterkeyhint="go" placeholder="ABC123" />
          </label>
          <button id="lobby-join" class="btn btn--secondary" type="button">Подключиться</button>
        </div>
        <p id="lobby-status" class="lobby-status" role="status" aria-live="polite"></p>
      </div>
    `;
    root.appendChild(this.screen);

    this.nameInput = requireElement<HTMLInputElement>(this.screen, '#lobby-name');
    this.codeInput = requireElement<HTMLInputElement>(this.screen, '#lobby-code');
    this.createBtn = requireElement<HTMLButtonElement>(this.screen, '#lobby-create');
    this.joinBtn = requireElement<HTMLButtonElement>(this.screen, '#lobby-join');
    this.status = requireElement<HTMLElement>(this.screen, '#lobby-status');

    this.nameInput.value = this.loadName();
    const invited = new URLSearchParams(window.location.search).get('room');
    if (invited) this.codeInput.value = normalizeRoomCode(invited).slice(0, APP_CONFIG.roomCodeLength);

    this.codeInput.addEventListener('input', () => {
      this.codeInput.value = normalizeRoomCode(this.codeInput.value);
    });
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') (this.codeInput.value ? this.joinBtn : this.createBtn).click();
    });
    this.codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.joinBtn.click();
    });
    this.createBtn.addEventListener('click', () => {
      void this.run('Создаём комнату…', () => this.handlers.onCreate(this.nameInput.value));
    });
    this.joinBtn.addEventListener('click', () => {
      void this.run('Подключаемся…', () => this.handlers.onJoin(this.nameInput.value, this.codeInput.value));
    });
  }

  show(): void {
    this.screen.hidden = false;
    this.setBusy(false);
  }

  hide(): void {
    this.screen.hidden = true;
  }

  setStatus(text: string, kind: StatusKind = 'info'): void {
    this.status.textContent = text;
    this.status.className = `lobby-status lobby-status--${kind}`;
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.createBtn.disabled = busy;
    this.joinBtn.disabled = busy;
    this.screen.classList.toggle('lobby--busy', busy);
  }

  private async run(progressText: string, action: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.setBusy(true);
    this.setStatus(progressText, 'info');
    try {
      this.saveName(this.nameInput.value);
      await action();
      this.setStatus('');
    } catch (err) {
      if (err instanceof GameError) {
        this.setStatus(err.message, 'error');
        if (err.code === 'invalid_name') this.nameInput.focus();
        if (err.code === 'invalid_code' || err.code === 'not_found' || err.code === 'full') this.codeInput.focus();
      } else {
        console.error(err);
        this.setStatus('Что-то пошло не так. Повторите попытку.', 'error');
      }
    } finally {
      this.setBusy(false);
    }
  }

  private loadName(): string {
    try {
      return localStorage.getItem(NAME_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  }

  private saveName(name: string): void {
    try {
      localStorage.setItem(NAME_STORAGE_KEY, name.trim());
    } catch {
      // хранилище может быть недоступно (приватный режим) — не критично
    }
  }
}
