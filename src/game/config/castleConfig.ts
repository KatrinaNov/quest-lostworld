export const CASTLE_BOUNDS = { minX: 146, maxX: 1294, minY: 160, maxY: 910 };
export const CASTLE_SPAWN = { x: 720, y: 874 };
export const CASTLE_CHEST = { x: 720, y: 412 };
export const CASTLE_WIDTH = 1440;
export const CASTLE_HEIGHT = 1000;

export const CASTLE_SEALS = [
  {
    id: 0, x: 336, y: 389, color: 0xd8a5fb, glyph: '✧', name: 'Печать семи реликвий',
    clue: 'Перетащите карточки, чтобы расставить семь реликвий слева направо.',
  },
  {
    id: 1, x: 1104, y: 389, color: 0x8be2a1, glyph: '◆', name: 'Изумрудный шифр',
    clue: 'Подставьте числа вместо знаков, решите пример и введите код.',
  },
  {
    id: 2, x: 336, y: 712, color: 0x8bdef4, glyph: '◇', name: 'Печать памяти',
    clue: 'Запомните, как загораются руны, и нажмите их в том же порядке.',
  },
  {
    id: 3, x: 1104, y: 712, color: 0xf1bf76, glyph: '✦', name: 'Зеркала дракона',
    clue: 'Найдите своё зеркало. Поверните его к печати и держите, пока товарищи направят туда же свои лучи.',
  },
] as const;

export type CastleSeal = (typeof CASTLE_SEALS)[number];

export const CASTLE_MIRRORS = [
  { x: 795, y: 647, restStep: 2 },
  { x: 1144, y: 531, restStep: 6 },
  { x: 1255, y: 783, restStep: 3 },
  { x: 990, y: 811, restStep: 5 },
] as const;

export const CASTLE_GIFT_HINT = 'Вернитесь в свой мир и выйдите на террасу. Там вас ждёт настоящий клад!';
