import type { JungleQuestState, JungleSymbolId } from '../game/quest/jungleQuestTypes';
import { JUNGLE_CAMP_NOTE, JUNGLE_SYMBOLS } from '../game/quest/jungleQuestConfig';

/** Компактный прогресс и модальные шаги квеста второй локации. */
export class JungleQuestHud {
  private readonly progress: HTMLElement;
  private readonly backdrop: HTMLElement;
  private readonly dialog: HTMLElement;

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

  showCampNote(onClose: () => void): void {
    const { title, intro, clues } = JUNGLE_CAMP_NOTE;
    this.open(
      title,
      `<p>${intro}</p><blockquote class="jungle-camp-clues">${clues.map((clue) => `<p>${clue}</p>`).join('')}</blockquote>`,
      'Закрыть записку',
      onClose,
    );
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
      'СЛЕД ПРЕЖНИХ ИСКАТЕЛЕЙ',
      `<div class="jungle-three-leaves" aria-label="Знак трёх листьев">❧ ❧ ❧</div>
      <p>Прежние искатели клада спрятали в вашем мире четыре конверта. Каждый отмечен тремя листьями.</p>
      <p><em>Не солнце, а тьму прогоняю.<br>Стою на месте, а путь освещаю. Кто я?</em></p>
      <p>Ищите конверты рядом с отгадкой. Соберите все четыре подсказки и разгадайте заветное слово.</p>`,
      'Мы нашли конверты',
      onConfirm,
    );
  }

  showSecret(onSubmit: (value: string) => Promise<'wrong' | 'opened' | 'ignored'>): void {
    this.dialog.innerHTML = `
      <h2 class="legend-title">СЛОВО ИСКАТЕЛЕЙ</h2>
      <div class="legend-body"><p>Разгадайте слово из четырёх конвертов и введите его, чтобы открыть храм.</p></div>
      <input class="jungle-secret" aria-label="Секретное слово" placeholder="Введите секретное слово" autocomplete="off" autocapitalize="characters" />
      <p class="jungle-secret-error" hidden></p>
      <button type="button" class="legend-start">Проверить</button>`;
    const input = this.dialog.querySelector('.jungle-secret') as HTMLInputElement;
    const error = this.dialog.querySelector('.jungle-secret-error') as HTMLElement;
    const button = this.dialog.querySelector('.legend-start') as HTMLButtonElement;
    const submit = async (): Promise<void> => {
      if (button.disabled) return;
      button.disabled = true;
      const result = await onSubmit(input.value);
      button.disabled = false;
      if (result === 'wrong' && input.isConnected) {
        error.textContent = 'Сверьтесь с подсказками из конвертов и попробуйте ещё раз.';
        error.hidden = false;
        input.focus();
      }
    };
    button.addEventListener('click', () => void submit());
    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') void submit();
    });
    this.show();
    input.focus();
  }

  showTempleOpen(onClose: () => void): void {
    this.open(
      'ХРАМ ОТКРЫТ',
      '<p>Вы разгадали послание прежних искателей. Теперь путь к кладу лежит через храм.</p><p>Подойдите к храму на карте джунглей и нажмите «Войти в храм».</p>',
      'Продолжить',
      onClose,
    );
  }

  close(): void {
    this.backdrop.hidden = true;
    document.body.classList.remove('modal-open');
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
    button.addEventListener('click', () => {
      this.close();
      onClose();
    });
    this.show();
  }

  private show(): void {
    this.backdrop.hidden = false;
    document.body.classList.add('modal-open');
  }
}
