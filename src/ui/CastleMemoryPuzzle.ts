import { CASTLE_MEMORY_LENGTHS, type CastleAnswer, type CastleMemoryRound } from '../game/quest/castleQuestTypes';

const pause = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));
const RUNES = ['◆', '✦', '▲', '☾', '✿', '◇', '☀', '●', '✚'];

export function memoryPuzzleMarkup(): string {
  return `<div class="castle-memory">
    <p class="castle-memory-stage"></p>
    <div class="castle-memory-board" role="group" aria-label="Поле из девяти рун">
      ${RUNES.map((rune, index) => `<button type="button" aria-label="Руна ${index + 1}" disabled>${rune}</button>`).join('')}
    </div>
    <p class="castle-memory-status" role="status"></p>
    <button type="button" class="castle-memory-replay" disabled>Показать снова</button>
  </div>`;
}

export function mountCastleMemory(
  root: HTMLElement,
  solve: (answer?: string) => Promise<CastleAnswer>,
  onSolved: () => void,
): () => void {
  const cells = Array.from(root.querySelectorAll<HTMLButtonElement>('.castle-memory-board button'));
  const stageLabel = root.querySelector<HTMLElement>('.castle-memory-stage')!;
  const status = root.querySelector<HTMLElement>('.castle-memory-status')!;
  const replay = root.querySelector<HTMLButtonElement>('.castle-memory-replay')!;
  let round: CastleMemoryRound | undefined;
  let entered = '';
  let playing = false;
  let active = true;
  let playback = 0;
  let failedRequest = false;
  let pendingAnswer: string | undefined;

  function clearBoard(): void {
    for (const cell of cells) {
      cell.classList.remove('is-lit', 'is-entered');
      cell.disabled = true;
    }
  }

  async function play(retry = false): Promise<void> {
    if (!round) return;
    const pattern = round.pattern;
    const id = ++playback;
    entered = '';
    clearBoard();
    replay.textContent = 'Показать снова';
    if (document.hidden) {
      status.textContent = 'Нажмите «Показать снова», когда будете готовы.';
      replay.disabled = false;
      return;
    }
    playing = true;
    replay.disabled = true;
    status.textContent = retry ? 'Это другая руна. Смотрите ещё раз.' : 'Смотрите на руны…';
    await pause(retry ? 850 : 530);
    for (const digit of pattern) {
      if (!active || id !== playback) return;
      const cell = cells[Number(digit) - 1];
      cell.classList.add('is-lit');
      await pause(480);
      if (!active || id !== playback) return;
      cell.classList.remove('is-lit');
      await pause(180);
    }
    if (!active || id !== playback) return;
    playing = false;
    for (const cell of cells) cell.disabled = false;
    status.textContent = 'Теперь повторите порядок.';
    replay.disabled = false;
  }

  function onVisibilityChange(): void {
    if (!document.hidden || !playing) return;
    playback += 1;
    playing = false;
    clearBoard();
    status.textContent = 'Нажмите «Показать снова», когда будете готовы.';
    replay.disabled = false;
  }

  async function request(answer?: string): Promise<void> {
    pendingAnswer = answer;
    failedRequest = false;
    clearBoard();
    replay.disabled = true;
    status.textContent = answer ? 'Проверяем порядок…' : 'Готовим руны…';
    try {
      const response = await solve(answer);
      if (!active) return;
      if (response.result === 'opened' || response.result === 'already_open' || response.result === 'completed') {
        onSolved();
        return;
      }
      if (!response.memory) throw new Error('Memory round unavailable');
      round = response.memory;
      stageLabel.textContent = `Раунд ${round.stage + 1}/${CASTLE_MEMORY_LENGTHS.length} · ${round.pattern.length} сигнал${round.stage === 0 ? 'а' : 'ов'}`;
      void play(round.retry);
    } catch {
      if (!active) return;
      failedRequest = true;
      status.textContent = 'Не удалось связаться с печатью.';
      replay.textContent = 'Повторить запрос';
      replay.disabled = false;
    }
  }

  for (const [index, cell] of cells.entries()) {
    cell.addEventListener('click', () => {
      if (!round || cell.disabled) return;
      const digit = String(index + 1);
      const matches = round.pattern[entered.length] === digit;
      entered += digit;
      if (!matches || entered.length === round.pattern.length) {
        void request(`${round.stage}:${entered}`);
        return;
      }
      cell.classList.add('is-entered');
      status.textContent = `Повторено ${entered.length} из ${round.pattern.length}`;
    });
  }
  replay.addEventListener('click', () => {
    if (failedRequest) void request(pendingAnswer);
    else void play();
  });
  document.addEventListener('visibilitychange', onVisibilityChange);
  void request();

  return () => {
    active = false;
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
