export const CASTLE_BOUNDS = { minX: 146, maxX: 1294, minY: 160, maxY: 910 };
export const CASTLE_SPAWN = { x: 720, y: 874 };
export const CASTLE_CHEST = { x: 720, y: 412 };
export const CASTLE_WIDTH = 1440;
export const CASTLE_HEIGHT = 1000;

export const CASTLE_SEALS = [
  {
    id: 0, x: 336, y: 389, color: 0xd8a5fb, glyph: '✧', name: 'Печать стихий',
    clue: 'Камень открывает путь. Вода следует сразу за камнем. Огонь замыкает круг. Расставьте четыре стихии по порядку.',
  },
  {
    id: 1, x: 1104, y: 389, color: 0x8be2a1, glyph: '◆', name: 'Печать изумрудов',
    clue: 'Дракон рассыпал зелёные камни за пределами замка. Найдите настоящие изумруды и сосчитайте, сколько собрала команда.',
  },
  {
    id: 2, x: 336, y: 712, color: 0x8bdef4, glyph: '◇', name: 'Печать алмазов',
    clue: 'Разложите шесть настоящих алмазов у трёх воображаемых башен. У крайних башен алмазов поровну, а у средней на три больше, чем у каждой крайней.',
  },
  {
    id: 3, x: 1104, y: 712, color: 0xf1bf76, glyph: '✦', name: 'Печать следопыта',
    clue: 'Одна из настоящих наклеек хранит пароль. Найдите наклейку со знаком следа лапы и прочитайте слово на её обороте.',
  },
] as const;

export type CastleSeal = (typeof CASTLE_SEALS)[number];

export const CASTLE_ELEMENTS = [
  { value: 'leaf', label: 'Лист', glyph: '❧' },
  { value: 'fire', label: 'Огонь', glyph: '✦' },
  { value: 'stone', label: 'Камень', glyph: '◆' },
  { value: 'water', label: 'Вода', glyph: '◈' },
] as const;

export const CASTLE_GIFT_HINT = 'Ищите подарок у дивана в зале.';
