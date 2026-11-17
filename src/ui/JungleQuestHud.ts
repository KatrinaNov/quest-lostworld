import type { JungleQuestState, JungleSymbolId } from '../game/quest/jungleQuestTypes';
import { JUNGLE_SYMBOLS } from '../game/quest/jungleQuestConfig';

/** Компактный прогресс и модальные шаги квеста второй локации. */
export class JungleQuestHud {
  private readonly progress: HTMLElement;
  private readonly backdrop: HTMLElement;
  private readonly dialog: HTMLElement;
  private onClose: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.progress = document.createElement('section');
    this.progress.className = 'jungle-progress';
    this.progress.hidden = true;
    parent.appendChild(this.progress);

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'legend-backdrop jungle-backdrop';
    this.backdrop.hidden = true;
    this.dialog = document.createElement('section');
    this.dialog.className = 'legend-modal jungle-modal';
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'true');
    this.backdrop.appendChild(this.dialog);
    parent.appendChild(this.backdrop);
  }

  setProgress(state: JungleQuestState): void {
    this.progress.hidden = false;
    const found = Object.values(state.symbols).filter(Boolean).length;
    const cells = (Object.keys(JUNGLE_SYMBOLS) as JungleSymbolId[]).map((id) => {
      const symbol = JUNGLE_SYMBOLS[id];
      return `<span class="jungle-symbol ${state.symbols[id] ? 'jungle-symbol--found' : ''}" title="${symbol.name}">${state.symbols[id] ? symbol.glyph : '·'}</span>`;
    }).join('');
    this.progress.innerHTML = `<strong>Древние символы: ${found}/3</strong><div class="jungle-symbols">${cells}</div>`;
  }

  showSymbol(id: JungleSymbolId, onClose: () => void): void {
    const symbol = JUNGLE_SYMBOLS[id];
    this.open(
      'ДРЕВНИЙ СИМВОЛ НАЙДЕН',
      `<div class="jungle-big-symbol">${symbol.glyph}</div><p>Символ «${symbol.name}» добавлен в общий прогресс команды.</p>`,
      'Продолжить',
      onClose,
    );
  }

  showCompletion(onConfirm: () => void): void {
    this.open(
      'ТРИ СИМВОЛА СОЕДИНЕНЫ!',
      '<div class="jungle-three-leaves">❧ ❧ ❧</div><p>Джунгли признали вас достойными продолжить путь.</p><p>Но предыдущая команда оставила последнее послание не в игре.</p><p>Найдите в настоящем мире знак с тремя листьями. Там вас ждёт следующее испытание.</p>',
      'Я нашёл послание',
      onConfirm,
    );
  }

  showSecret(onSubmit: (value: string) => Promise<'wrong' | 'opened' | 'ignored'>): void {
    this.dialog.innerHTML = `
      <h2 class="legend-title">ПОСЛАНИЕ НАЙДЕНО</h2>
      <div class="legend-body"><p>Вы нашли послание предыдущей команды! Кажется, они оставили вам способ открыть путь дальше.</p><p>Введите секретное слово.</p></div>
      <input class="jungle-secret" aria-label="Секретное слово" autocomplete="off" autocapitalize="characters" />
      <p class="jungle-secret-error" hidden></p>
      <button type="button" class="legend-start">Проверить</button>`;
    const input = this.dialog.querySelector('.jungle-secret') as HTMLInputElement;
    const error = this.dialog.querySelector('.jungle-secret-error') as HTMLElement;
    const button = this.dialog.querySelector('.legend-start') as HTMLButtonElement;
    const submit = async (): Promise<void> => {
      button.disabled = true;
      const result = await onSubmit(input.value);
      button.disabled = false;
      if (result === 'wrong') {
        error.textContent = 'Не получилось. Проверьте порядок предметов и попробуйте ещё раз';
        error.hidden = false;
        input.focus();
      }
    };
    button.addEventListener('click', () => void submit());
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') void submit(); });
    this.show();
    input.focus();
  }

  showTempleOpen(onClose: () => void): void {
    this.open(
      'ПУТЬ К ХРАМУ ОТКРЫТ',
      '<p>Вы нашли послание предыдущей команды!</p><p>Путь к храму открыт.</p><p>Но будьте осторожны: вы не единственные, кто ищет сокровище. Где-то поблизости уже появились охотники.</p><p>Следующий мир ждёт вас!</p>',
      'Продолжить',
      onClose,
    );
  }

  close(): void {
    this.backdrop.hidden = true;
    document.body.classList.remove('modal-open');
    const close = this.onClose;
    this.onClose = null;
    close?.();
  }

  hide(): void {
    this.progress.hidden = true;
    this.close();
  }

  destroy(): void {
    this.close();
    this.progress.remove();
    this.backdrop.remove();
  }

  private open(title: string, body: string, buttonText: string, onClose: () => void): void {
    this.dialog.innerHTML = `<h2 class="legend-title"></h2><div class="legend-body"></div><button type="button" class="legend-start"></button>`;
    this.dialog.querySelector('.legend-title')!.textContent = title;
    this.dialog.querySelector('.legend-body')!.innerHTML = body;
    const button = this.dialog.querySelector('.legend-start') as HTMLButtonElement;
    button.textContent = buttonText;
    button.addEventListener('click', () => this.close());
    this.onClose = onClose;
    this.show();
  }

  private show(): void {
    this.backdrop.hidden = false;
    document.body.classList.add('modal-open');
  }
}
