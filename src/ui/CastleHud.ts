import { CASTLE_ELEMENTS, CASTLE_GIFT_HINT, CASTLE_SEALS, type CastleSeal } from '../game/config/castleConfig';
import { isCastleSealOpen, type CastleAnswerResult, type CastleQuestState } from '../game/quest/castleQuestTypes';

function countSelect(name: string, label: string, max: number): string {
  const options = Array.from({ length: max + 1 }, (_, count) => `<option value="${count}">${count}</option>`).join('');
  return `<label>${label}<select name="${name}" required><option value="" selected disabled>—</option>${options}</select></label>`;
}

function puzzleFields(seal: CastleSeal): string {
  switch (seal.id) {
    case 0: return `<div class="castle-elements">${CASTLE_ELEMENTS.map((element) =>
      `<button type="button" data-element="${element.value}" aria-pressed="false"><span>${element.glyph}</span>${element.label}</button>`).join('')}</div>
      <div class="castle-order-row"><output aria-live="polite"></output><button type="button" data-clear>Сбросить</button></div>`;
    case 1: return `<div class="castle-fields">${countSelect('emeralds', 'Найдено изумрудов', 9)}</div>`;
    case 2: return `<div class="castle-fields">${countSelect('left', 'Левая', 6)}${countSelect('middle', 'Средняя', 6)}${countSelect('right', 'Правая', 6)}</div>`;
    case 3: return '<div class="castle-fields"><label>Слово с наклейки<input name="word" type="text" maxlength="24" autocomplete="off" autocapitalize="characters" spellcheck="false" required></label></div>';
  }
}

export class CastleHud {
  private readonly progress: HTMLElement;
  private readonly backdrop: HTMLDivElement;
  private readonly dialog: HTMLElement;
  private sealId: number | null = null;

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

  showPuzzle(seal: CastleSeal, solve: (answer: string) => Promise<CastleAnswerResult>): void {
    this.sealId = seal.id;
    this.show(seal.name, `<p>${seal.clue}</p>`, `<form class="castle-form">${puzzleFields(seal)}
      <p class="castle-feedback" role="status" hidden></p><button type="submit" class="legend-start">Проверить</button></form>`);
    const form = this.dialog.querySelector('form')!;
    const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
    const feedback = form.querySelector<HTMLElement>('.castle-feedback')!;
    const order: string[] = [];
    if (seal.id === 0) {
      const options = form.querySelectorAll<HTMLButtonElement>('[data-element]');
      const sequence = form.querySelector('output')!;
      const updateSequence = (): void => {
        for (const option of options) option.setAttribute('aria-pressed', String(order.includes(option.dataset.element!)));
        submit.disabled = order.length !== CASTLE_ELEMENTS.length;
        sequence.textContent = order.map((value) => CASTLE_ELEMENTS.find((element) => element.value === value)!.label).join(' → ') || 'Выберите первую стихию';
      };
      for (const option of options) option.addEventListener('click', () => {
        const value = option.dataset.element!;
        const index = order.indexOf(value);
        if (index === -1) order.push(value);
        else order.splice(index, 1);
        updateSequence();
      });
      form.querySelector('[data-clear]')?.addEventListener('click', () => { order.length = 0; updateSequence(); });
      updateSequence();
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (submit.disabled) return;
      const fields = new FormData(form);
      const answer = seal.id === 0 ? order.join(',') : [...fields.values()].join(',');
      if (!answer.trim()) return;
      submit.disabled = true;
      feedback.hidden = true;
      void solve(answer).then((result) => {
        if (!form.isConnected || !this.isOpen()) return;
        if (result === 'opened' || result === 'already_open' || result === 'completed') this.close();
        else {
          feedback.textContent = result === 'wrong' ? 'Печать не поддалась. Сверьте подсказку и попробуйте ещё раз.' : 'Связь с комнатой восстанавливается. Попробуйте ещё раз.';
          feedback.hidden = false;
        }
      }).catch(() => {
        feedback.textContent = 'Не удалось отправить ответ. Попробуйте ещё раз.';
        feedback.hidden = false;
      }).finally(() => { submit.disabled = seal.id === 0 && order.length !== CASTLE_ELEMENTS.length; });
    });
  }

  showEnding(): void {
    this.sealId = null;
    this.show('Клад затерянного мира', '<p>Щёлкнула последняя печать. Дракон поднял голову, и ровный свет факелов залил открытый сундук.</p>' +
      '<p>Внутри лежало послание стража. Ключи открыли вам путь, звёзды вывели из храма, а в лабиринте вы дождались друг друга. С последним испытанием вы справились вместе. Теперь клад ваш.</p>' +
      `<p class="castle-gift"><strong>${CASTLE_GIFT_HINT}</strong></p>`, '<button type="button" class="legend-start" data-close>Мы нашли клад!</button>');
  }

  showWelcome(): void {
    this.show('Замок дракона', '<p>В глубине зала стоит запечатанный сундук. Четыре печати защищают его с той ночи, когда дракон спрятал последний клад.</p>' +
      '<p>Осмотрите постаменты. Некоторые ответы лежат здесь, а за другими придётся выйти в настоящий мир.</p>',
    '<button type="button" class="legend-start" data-close>Осмотреть замок</button>');
  }

  close(): void {
    if (this.backdrop.hidden) return;
    this.backdrop.hidden = true;
    this.sealId = null;
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
