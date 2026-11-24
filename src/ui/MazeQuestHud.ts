import { MAZE_GLYPHS, MAZE_PHRASE_WORDS, mazeAssemblyReady, mazeLetterLimit, type MazeQuestState, type MazeResult } from '../game/quest/mazeQuestTypes';
import '../styles/mazeQuest.css';

interface MazeActions {
  solve: (phrase: string) => Promise<MazeResult>;
  submitCode: (code: string) => Promise<MazeResult>;
}

type Stage = 'exploring' | 'assembly' | 'waiting' | 'code';

export class MazeQuestHud {
  private readonly progress: HTMLElement;
  private readonly backdrop: HTMLElement;
  private readonly dialog: HTMLElement;
  private readonly dragPreview: HTMLElement;
  private stage: Stage = 'exploring';
  private readonly slots = MAZE_GLYPHS.map<number | null>(() => null);
  private readonly bankOrder = MAZE_GLYPHS.map((_, index) => index);
  private selected: number | null = null;
  private submitting = false;
  private drag: { pointer: number; tile: number; x: number; y: number; moved: boolean } | null = null;
  private ignoreClickUntil = 0;

  constructor(parent: HTMLElement, private readonly actions: MazeActions) {
    this.progress = document.createElement('section');
    this.progress.className = 'maze-progress';
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'legend-backdrop';
    this.backdrop.hidden = true;
    this.dialog = document.createElement('section');
    this.dialog.className = 'legend-modal maze-modal';
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'true');
    this.dialog.setAttribute('aria-labelledby', 'maze-quest-title');
    this.dragPreview = document.createElement('div');
    this.dragPreview.className = 'maze-drag-preview maze-tile';
    this.dragPreview.setAttribute('aria-hidden', 'true');
    this.dragPreview.hidden = true;
    this.backdrop.append(this.dialog, this.dragPreview);
    parent.append(this.progress, this.backdrop);

    for (let i = this.bankOrder.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.bankOrder[i], this.bankOrder[j]] = [this.bankOrder[j], this.bankOrder[i]];
    }
    this.dialog.addEventListener('pointerdown', this.startDrag);
    this.dialog.addEventListener('pointermove', this.moveDrag);
    this.dialog.addEventListener('pointerup', this.endDrag);
    this.dialog.addEventListener('pointercancel', this.clearDrag);
    this.dialog.addEventListener('lostpointercapture', this.clearDrag);
    this.dialog.addEventListener('click', this.onClick);
  }

  present(state: MazeQuestState, self: string): void {
    const collected = Object.values(state.letterOwners);
    const limit = mazeLetterLimit(state.team, self);
    const own = collected.filter((id) => id === self).length;
    this.progress.textContent = 'Буквы · у вас ' + own + '/' + limit + ' · всего ' + collected.length + '/' + MAZE_GLYPHS.length;
    if (!mazeAssemblyReady(state)) return;

    const solved = state.team.filter((id) => state.players[id]?.solved).length;
    if (solved === state.team.length) {
      if (this.stage !== 'code') this.showCode();
      return;
    }
    if (state.players[self]?.solved) {
      if (this.stage !== 'waiting') this.show('waiting', 'ФРАЗА СОБРАНА', '<div class="legend-body"><p>Остальные ещё расставляют буквы.</p><p class="maze-solved-count"></p></div>');
      this.dialog.querySelector('.maze-solved-count')!.textContent = 'Готово: ' + solved + '/' + state.team.length;
      return;
    }
    if (this.stage !== 'assembly') this.showAssembly();
  }

  destroy(): void {
    if (!this.backdrop.hidden) document.body.classList.remove('modal-open');
    this.backdrop.remove();
    this.progress.remove();
  }

  private showAssembly(): void {
    let slot = 0;
    const words = MAZE_PHRASE_WORDS.map((word, index) => {
      const cells = Array.from(word, () => '<button type="button" class="maze-tile maze-slot" data-maze-slot="' + slot++ + '"></button>');
      const punctuation = index === MAZE_PHRASE_WORDS.length - 1 ? '<span aria-hidden="true">!</span>' : '';
      return '<div class="maze-word">' + cells.join('') + punctuation + '</div>';
    }).join('');
    const bank = this.bankOrder.map((tile) =>
      '<button type="button" class="maze-tile" data-maze-tile="' + tile + '">' + MAZE_GLYPHS[tile] + '</button>',
    ).join('');
    this.show('assembly', 'СОБЕРИТЕ ПОСЛАНИЕ', '<p class="maze-instructions">Перетащите буквы или нажмите на букву, затем на клетку.</p>'
      + '<div class="maze-letter-board"><div class="maze-slots" aria-label="Клетки послания">' + words + '</div>'
      + '<div class="maze-bank" aria-label="Собранные буквы">' + bank + '</div></div>'
      + '<p class="maze-feedback" role="status" hidden></p><button type="button" class="legend-start">Проверить фразу</button>');
    const button = this.dialog.querySelector<HTMLButtonElement>('.legend-start')!;
    this.renderBoard();
    button.addEventListener('click', () => {
      const phrase = this.slots.map((tile) => tile === null ? '' : MAZE_GLYPHS[tile]).join('');
      void this.submit(button, () => this.actions.solve(phrase), 'Буквы пока стоят не на своих местах.');
    });
  }

  private showCode(): void {
    this.show('code', 'ПУТЬ В СОКРОВИЩНИЦУ',
      '<div class="legend-body"><p><strong>Код под подушкой!</strong></p>'
      + '<p>Найдите подсказку, расшифруйте и введите код.</p></div>'
      + '<form class="maze-code-form"><input class="maze-code" type="text" maxlength="80" required autocomplete="off" spellcheck="false" aria-label="Секретный код или слово" placeholder="Код или слово">'
      + '<p class="maze-feedback" role="status" hidden></p><button type="submit" class="legend-start">Открыть вход</button></form>');
    const form = this.dialog.querySelector('form')!;
    const input = form.querySelector('input')!;
    const button = form.querySelector('button')!;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void this.submit(button, () => this.actions.submitCode(input.value.trim()), 'Код не подошёл. Сверьтесь с подсказкой.');
    });
  }

  private async submit(button: HTMLButtonElement, action: () => Promise<MazeResult>, wrongMessage: string): Promise<void> {
    if (button.disabled || this.submitting) return;
    const feedback = this.dialog.querySelector<HTMLElement>('.maze-feedback')!;
    feedback.hidden = true;
    button.disabled = true;
    this.submitting = true;
    let message = '';
    try {
      const result = await action();
      if (result === 'wrong') message = wrongMessage;
      else if (result === 'code_pending') message = 'Код для этой игры ещё не задан организатором.';
      else if (result !== 'solved' && result !== 'completed') message = 'Проверьте подключение и попробуйте ещё раз.';
    } catch {
      message = 'Не удалось получить ответ. Попробуйте ещё раз.';
    } finally {
      if (button.isConnected) {
        this.submitting = false;
        button.disabled = false;
        feedback.textContent = message;
        feedback.hidden = !message;
      }
    }
  }

  private show(stage: Stage, title: string, body: string): void {
    this.clearDrag();
    this.stage = stage;
    this.submitting = false;
    this.dialog.dataset.stage = stage;
    this.dialog.innerHTML = '<h2 id="maze-quest-title" class="legend-title" tabindex="-1">' + title + '</h2>' + body;
    this.dialog.scrollTop = 0;
    this.backdrop.hidden = false;
    document.body.classList.add('modal-open');
    this.dialog.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }

  private renderBoard(): void {
    for (const cell of this.dialog.querySelectorAll<HTMLButtonElement>('[data-maze-slot]')) {
      const index = Number(cell.dataset.mazeSlot);
      const tile = this.slots[index];
      cell.textContent = tile === null ? '' : MAZE_GLYPHS[tile];
      cell.setAttribute('aria-label', 'Клетка ' + (index + 1) + ': ' + (cell.textContent || 'пусто'));
      cell.setAttribute('aria-pressed', String(tile !== null && tile === this.selected));
      if (tile === null) delete cell.dataset.mazeTile;
      else cell.dataset.mazeTile = String(tile);
    }
    for (const tile of this.dialog.querySelectorAll<HTMLButtonElement>('.maze-bank [data-maze-tile]')) {
      const index = Number(tile.dataset.mazeTile);
      tile.style.visibility = this.slots.includes(index) ? 'hidden' : '';
      tile.setAttribute('aria-pressed', String(index === this.selected));
    }
    this.dialog.querySelector<HTMLButtonElement>('.legend-start')!.disabled = this.slots.includes(null);
  }

  private place(tile: number, target: number | null): void {
    const source = this.slots.indexOf(tile);
    if (source >= 0) this.slots[source] = target === null ? null : this.slots[target];
    if (target !== null) this.slots[target] = tile;
    this.selected = null;
    const feedback = this.dialog.querySelector<HTMLElement>('.maze-feedback')!;
    feedback.hidden = true;
    this.renderBoard();
  }

  private readonly onClick = (event: MouseEvent): void => {
    if (this.stage !== 'assembly' || this.submitting || performance.now() < this.ignoreClickUntil || !(event.target instanceof Element)) return;
    const cell = event.target.closest<HTMLElement>('[data-maze-slot]');
    const tile = event.target.closest<HTMLElement>('[data-maze-tile]');
    if (cell && this.selected !== null) {
      this.place(this.selected, Number(cell.dataset.mazeSlot));
    } else if (tile) {
      const index = Number(tile.dataset.mazeTile);
      this.selected = this.selected === index ? null : index;
      this.renderBoard();
    } else if (this.selected !== null && event.target.closest('.maze-bank')) {
      this.place(this.selected, null);
    }
  };

  private readonly startDrag = (event: PointerEvent): void => {
    if (this.stage !== 'assembly' || this.submitting || this.drag || event.button !== 0 || !(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLElement>('[data-maze-tile]');
    if (!button) return;
    this.drag = { pointer: event.pointerId, tile: Number(button.dataset.mazeTile), x: event.clientX, y: event.clientY, moved: false };
    button.setPointerCapture(event.pointerId);
  };

  private readonly moveDrag = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointer) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
    drag.moved = true;
    this.dragPreview.textContent = MAZE_GLYPHS[drag.tile];
    this.dragPreview.style.transform = 'translate(' + event.clientX + 'px, ' + event.clientY + 'px) translate(-50%, -50%)';
    this.dragPreview.hidden = false;
  };

  private readonly endDrag = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointer) return;
    this.clearDrag();
    if (!drag.moved) return;
    this.ignoreClickUntil = performance.now() + 120;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const cell = target?.closest<HTMLElement>('[data-maze-slot]');
    if (cell) this.place(drag.tile, Number(cell.dataset.mazeSlot));
    else if (target?.closest('.maze-bank')) this.place(drag.tile, null);
  };

  private readonly clearDrag = (event?: PointerEvent): void => {
    if (event && event.pointerId !== this.drag?.pointer) return;
    this.drag = null;
    this.dragPreview.hidden = true;
  };
}
