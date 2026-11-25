import { CASTLE_GIFT_HINT, CASTLE_SEALS, type CastleSeal } from '../game/config/castleConfig';
import { isCastleSealOpen, type CastleAnswer, type CastleQuestState } from '../game/quest/castleQuestTypes';
import { memoryPuzzleMarkup, mountCastleMemory } from './CastleMemoryPuzzle';
import { mountRelicOrder, relicOrderMarkup } from './CastleRelicOrder';
import '../styles/castlePuzzles.css';

function equationSymbol(icon: string, name: string): string {
  return `<span class="castle-equation-symbol"><b aria-hidden="true">${icon}</b><span>${name}</span></span>`;
}

function puzzleFields(seal: Extract<CastleSeal, { id: 0 | 1 }>): string {
  switch (seal.id) {
    case 0: return relicOrderMarkup() + '<p class="castle-physical-clue">Отыщите семь брелоков на стенах вашего дома. Вспомните, в каком порядке встают их цвета, когда после дождя над землёй появляется радуга.</p>';
    case 1: return `<div class="castle-equation" role="img" aria-label="Камень плюс вода умножить на ветер минус солнце умножить на разность травы и дерева">
      <span class="castle-equation-group">${equationSymbol('🪨', 'Камень')} + ${equationSymbol('💧', 'Вода')} × ${equationSymbol('🌬️', 'Ветер')}</span>
      <span class="castle-equation-group">− ${equationSymbol('☀️', 'Солнце')} × ( ${equationSymbol('🌱', 'Трава')} − ${equationSymbol('🌳', 'Дерево')} )</span>
      </div><div class="castle-fields"><label>Код<input name="code" type="text" inputmode="numeric" pattern="[0-9]+" maxlength="8" autocomplete="off" required></label></div>
      <p class="castle-physical-clue">Ищите подсказки возле предметов цвета изумруда. На одной стороне каждого камня — знак, на другой — его число.</p>`;
  }
}

export class CastleHud {
  private readonly progress: HTMLElement;
  private readonly backdrop: HTMLDivElement;
  private readonly dialog: HTMLElement;
  private sealId: number | null = null;
  private puzzleCleanup: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.progress = document.createElement('section');
    this.progress.className = 'castle-progress';
    this.progress.setAttribute('aria-live', 'polite');
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'legend-backdrop';
    this.backdrop.hidden = true;
    this.dialog = document.createElement('section');
    this.dialog.className = 'legend-modal castle-modal';
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'true');
    this.dialog.setAttribute('aria-labelledby', 'castle-dialog-title');
    this.dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.close();
      if (event.target instanceof HTMLElement && event.target.closest('form')) event.stopPropagation();
    });
    this.backdrop.append(this.dialog);
    parent.append(this.progress, this.backdrop);
  }

  setProgress(state: CastleQuestState): void {
    const count = CASTLE_SEALS.filter((seal) => isCastleSealOpen(state, seal.id)).length;
    const wards = CASTLE_SEALS.map((seal) => `<span class="castle-ward${isCastleSealOpen(state, seal.id) ? ' castle-ward--open' : ''}" aria-hidden="true">${seal.glyph}</span>`);
    this.progress.innerHTML = `<strong>Печати замка ${count}/4</strong><div>${wards.join('')}</div>`;
    if (this.sealId !== null && isCastleSealOpen(state, this.sealId)) this.close();
  }

  setLoading(message: string, retry?: () => void): void {
    this.progress.textContent = message;
    if (!retry) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Повторить';
    button.addEventListener('click', retry);
    this.progress.append(button);
  }

  isOpen(): boolean { return !this.backdrop.hidden; }

  showPuzzle(seal: CastleSeal, solve: (answer?: string) => Promise<CastleAnswer>): void {
    this.sealId = seal.id;
    this.dialog.dataset.puzzle = String(seal.id);
    if (seal.id === 3) {
      this.show(seal.name, `<p>${seal.clue}</p><p>Отпустите зеркало, и оно вернётся на место. Если вы здесь одни, достаточно одного луча.</p>`,
        '<button type="button" class="legend-start" data-close>К зеркалам</button>');
      return;
    }
    if (seal.id === 2) {
      this.show(seal.name, `<p>${seal.clue}</p>`, memoryPuzzleMarkup());
      this.puzzleCleanup = mountCastleMemory(this.dialog, solve, () => this.close());
      return;
    }
    this.show(seal.name, `<p>${seal.clue}</p>`, `<form class="castle-form">${puzzleFields(seal)}
      <p class="castle-feedback" role="status" hidden></p><button type="submit" class="legend-start">Проверить</button></form>`);
    const form = this.dialog.querySelector('form')!;
    const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
    const feedback = form.querySelector<HTMLElement>('.castle-feedback')!;
    const board = form.querySelector<HTMLElement>('.castle-relics');
    const readOrder = board ? mountRelicOrder(board) : null;
    const tiles = board?.querySelectorAll<HTMLButtonElement>('button');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (submit.disabled) return;
      const answer = readOrder?.() ?? String(new FormData(form).get('code') ?? '');
      if (!answer.trim()) return;
      submit.disabled = true;
      tiles?.forEach((tile) => { tile.disabled = true; });
      feedback.hidden = true;
      void solve(answer).then(({ result }) => {
        if (!form.isConnected || !this.isOpen()) return;
        if (result === 'opened' || result === 'already_open' || result === 'completed') this.close();
        else {
          feedback.textContent = result === 'wrong' ? 'Печать не поддалась. Сверьте подсказку и попробуйте ещё раз.' : 'Связь с комнатой восстанавливается. Попробуйте ещё раз.';
          feedback.hidden = false;
        }
      }).catch(() => {
        feedback.textContent = 'Не удалось отправить ответ. Попробуйте ещё раз.';
        feedback.hidden = false;
      }).finally(() => {
        submit.disabled = false;
        tiles?.forEach((tile) => { tile.disabled = false; });
      });
    });
  }

  showEnding(): void {
    this.sealId = null;
    this.show('Вы нашли клад!', '<p>Последняя печать вспыхнула. Пламя погасло, и дракон растворился в золотом свете. В открытом сундуке осталось послание стража.</p>' +
      '<p>«Вы отыскали ключи, раскрыли тайну джунглей, прошли храм и выбрались из лабиринта. Всё это вам удалось, потому что вы держались вместе. Поздравляю, искатели! Клад затерянного мира теперь ваш».</p>' +
      `<p class="castle-gift"><strong>${CASTLE_GIFT_HINT}</strong></p>`, '<button type="button" class="legend-start" data-close>За кладом!</button>');
  }

  showWelcome(): void {
    this.show('Замок дракона', '<p>Страж укрыл сундук своим пламенем. Держитесь подальше от огня: он отбросит вас ко входу.</p>' +
      '<p>Осмотрите четыре постамента. Снимите все печати, чтобы погасить пламя и добраться до клада.</p>',
    '<button type="button" class="legend-start" data-close>Осмотреть замок</button>');
  }

  close(): void {
    if (this.backdrop.hidden) return;
    this.puzzleCleanup?.();
    this.puzzleCleanup = null;
    this.backdrop.hidden = true;
    this.sealId = null;
    delete this.dialog.dataset.puzzle;
    document.body.classList.remove('modal-open');
  }

  destroy(): void {
    this.close();
    this.progress.remove();
    this.backdrop.remove();
  }

  private show(title: string, text: string, actions: string): void {
    this.dialog.innerHTML = `<button type="button" class="legend-close" data-close aria-label="Закрыть">×</button>
      <h2 id="castle-dialog-title" class="legend-title" tabindex="-1">${title}</h2><div class="legend-body">${text}</div>${actions}`;
    for (const button of this.dialog.querySelectorAll('[data-close]')) button.addEventListener('click', () => this.close());
    this.backdrop.hidden = false;
    document.body.classList.add('modal-open');
    this.dialog.scrollTop = 0;
    this.dialog.querySelector<HTMLElement>('.legend-title')?.focus({ preventScroll: true });
  }
}
