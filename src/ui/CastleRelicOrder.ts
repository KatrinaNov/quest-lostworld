const RELICS = [
  { id: 'pickaxe', name: 'Кирка', colors: ['#264650', '#599c9d', '#a4e6d2', '#633d2c', '#bd8853'], pixels: [
    '............', '...00000....', '..0122210...', '.01200010...', '.010...010..', '.00...3400..',
    '.....34.010.', '....34..010.', '...34....00.', '..34........', '.34.........', '.3..........',
  ] },
  { id: 'potion', name: 'Зелье', colors: ['#412b52', '#754498', '#bf71c7', '#f4b1dc', '#b9814b'], pixels: [
    '............', '....4444....', '....4444....', '.....00.....', '.....22.....', '....0220....',
    '...023220...', '..01222210..', '..01223210..', '..01121110..', '...011110...', '....0000....',
  ] },
  { id: 'torch', name: 'Факел', colors: ['#752c2f', '#c65234', '#ff993d', '#ffe79b', '#79513d'], pixels: [
    '............', '......1.....', '.....122....', '....12321...', '...123321...', '..1233331...',
    '...12331....', '....110.....', '....404.....', '...404......', '...40.......', '..40........',
  ] },
  { id: 'creeper', name: 'Крипер', colors: ['#24443e', '#407855', '#73a953', '#b6cc6e', '#ecd783'], pixels: [
    '............', '..2......2..', '..11222211..', '.1222322211.', '.2232222321.', '.2042224021.',
    '.2202020221.', '.1220002211.', '..11222221..', '....2121....', '...211112...', '...2....1...',
  ] },
  { id: 'sword', name: 'Меч', colors: ['#355462', '#72abae', '#bde9de', '#7f5238', '#d19b5b'], pixels: [
    '............', '.........00.', '........020.', '.......0220.', '......0220..', '.....0220...',
    '..4.0220....', '...4000.....', '...34.......', '..3434......', '.34...4.....', '.3..........',
  ] },
  { id: 'bow', name: 'Лук', colors: ['#5d342d', '#986044', '#cf975c', '#eddcb3', '#739b8b'], pixels: [
    '............', '.....0220...', '....311220..', '...3....120.', '..3......20.', '..3......20.',
    '.3.....4.20.', '.3....43420.', '.313.43.120.', '..3143.120..', '...430220...', '..4.........',
  ] },
  { id: 'axe', name: 'Топор', colors: ['#334b5b', '#5c8795', '#b0d9d0', '#69442e', '#c48b53'], pixels: [
    '............', '.......00...', '......0220..', '.....02220..', '....0122220.', '.....012220.',
    '.....34000..', '....34......', '...34.......', '..34........', '.34.........', '.3..........',
  ] },
] as const;

export function relicOrderMarkup(): string {
  return '<div class="castle-relics" role="group" aria-label="Порядок реликвий">' + RELICS.map(({ id, name }) =>
    `<button type="button" class="castle-relic" data-relic="${id}" aria-pressed="false" title="${name}">
      <span class="castle-relic-index" aria-hidden="true"></span><canvas width="12" height="12" aria-hidden="true"></canvas>
      <span class="castle-relic-name" aria-hidden="true">${name}</span></button>`).join('') + '</div>';
}

export function mountRelicOrder(board: HTMLElement): () => string {
  const tiles = Array.from(board.querySelectorAll<HTMLButtonElement>('button[data-relic]'));
  for (const [index, tile] of tiles.entries()) {
    const ctx = tile.querySelector('canvas')!.getContext('2d');
    if (!ctx) continue;
    const { pixels, colors } = RELICS[index];
    for (const [y, row] of pixels.entries()) {
      for (const [x, shade] of [...row].entries()) {
        if (shade === '.') continue;
        ctx.fillStyle = colors[Number(shade)];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  const ghost = document.createElement('canvas');
  ghost.width = 12;
  ghost.height = 12;
  ghost.className = 'castle-relic-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.hidden = true;
  board.after(ghost);
  let selected: HTMLButtonElement | null = null;
  let drag: { id: number; tile: HTMLButtonElement; x: number; y: number; moved: boolean } | null = null;
  let ignoreClickUntil = 0;

  function updateLabels(): void {
    tiles.forEach((tile, index) => {
      tile.querySelector('.castle-relic-index')!.textContent = String(index + 1);
      tile.setAttribute('aria-label', `${tile.title}, место ${index + 1} из ${tiles.length}`);
      tile.setAttribute('aria-pressed', String(tile === selected));
    });
  }

  function moveTile(tile: HTMLButtonElement, target: HTMLButtonElement): void {
    const index = tiles.indexOf(target);
    const from = tiles.indexOf(tile);
    tiles.splice(from, 1);
    tiles.splice(index, 0, tile);
    board.insertBefore(tile, tiles[index + 1] ?? null);
    selected = null;
    updateLabels();
    tile.focus({ preventScroll: true });
  }

  function tileAt(target: EventTarget | null): HTMLButtonElement | null {
    return target instanceof Element ? target.closest<HTMLButtonElement>('[data-relic]') : null;
  }

  board.addEventListener('click', (event) => {
    if (event.detail > 0 && performance.now() < ignoreClickUntil) return;
    const tile = tileAt(event.target);
    if (!tile || tile.disabled) return;
    if (selected && selected !== tile) moveTile(selected, tile);
    else {
      selected = selected === tile ? null : tile;
      updateLabels();
    }
  });
  board.addEventListener('pointerdown', (event) => {
    const tile = tileAt(event.target);
    if (drag || !tile || tile.disabled || event.button !== 0) return;
    ignoreClickUntil = 0;
    drag = { id: event.pointerId, tile, x: event.clientX, y: event.clientY, moved: false };
    tile.setPointerCapture(event.pointerId);
  });
  board.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
      drag.moved = true;
      const ctx = ghost.getContext('2d');
      ctx?.clearRect(0, 0, 12, 12);
      ctx?.drawImage(drag.tile.querySelector('canvas')!, 0, 0);
      ghost.hidden = false;
    }
    ghost.style.transform = `translate(${event.clientX}px, ${event.clientY}px) translate(-50%, -50%)`;
  });
  function clearDrag(event: PointerEvent): void {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    ghost.hidden = true;
  }
  board.addEventListener('pointerup', (event) => {
    const current = drag;
    clearDrag(event);
    if (!current?.moved || current.id !== event.pointerId) return;
    ignoreClickUntil = performance.now() + 120;
    const target = tileAt(document.elementFromPoint(event.clientX, event.clientY));
    if (target && target !== current.tile && board.contains(target)) moveTile(current.tile, target);
  });
  board.addEventListener('pointercancel', clearDrag);
  board.addEventListener('lostpointercapture', clearDrag);
  updateLabels();
  return () => tiles.map((tile) => tile.dataset.relic).join(',');
}
