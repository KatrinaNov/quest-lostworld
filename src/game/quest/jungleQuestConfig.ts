import type { Point } from '../../network/types';
import type { JungleSymbolId } from './jungleQuestTypes';

export interface JungleInspectZone extends Point {
  id: string;
  name: string;
  radius: number;
  symbol?: JungleSymbolId;
}

/** Невидимые зоны лежат поверх уже нарисованных объектов второй локации. */
export const JUNGLE_INSPECT_ZONES: readonly JungleInspectZone[] = [
  { id: 'vine-tree', name: 'Большое дерево с лианами', x: 300, y: 670, radius: 84, symbol: 'leaf' },
  { id: 'waterfall', name: 'Водопад', x: 1814, y: 360, radius: 192, symbol: 'water' },
  { id: 'ruin-boulders', name: 'Большие камни среди руин', x: 2050, y: 954, radius: 88, symbol: 'stone' },
  { id: 'small-tree', name: 'Маленькое дерево', x: 955, y: 1230, radius: 72 },
  { id: 'tall-grass', name: 'Высокая трава', x: 1320, y: 1170, radius: 72 },
  { id: 'bush', name: 'Куст', x: 1450, y: 1050, radius: 72 },
  { id: 'small-stones', name: 'Небольшие камни', x: 620, y: 720, radius: 72 },
  { id: 'fern', name: 'Папоротник', x: 1060, y: 650, radius: 72 },
  { id: 'hanging-vines', name: 'Лианы', x: 1510, y: 520, radius: 72 },
  { id: 'wall-fragment', name: 'Обломки каменной стены', x: 2130, y: 1060, radius: 72 },
  { id: 'old-lantern', name: 'Старый фонарь', x: 826, y: 785, radius: 72 },
  { id: 'mine-rails', name: 'Рельсы у шахты', x: 730, y: 910, radius: 72 },
  { id: 'camp-crate', name: 'Походный сундук', x: 966, y: 1028, radius: 72 },
  { id: 'camp-map', name: 'Карта на столе', x: 1188, y: 1080, radius: 72 },
  { id: 'campfire', name: 'Костёр', x: 1104, y: 1125, radius: 72 },
  { id: 'broken-pillar', name: 'Сломанная колонна', x: 530, y: 510, radius: 72 },
  { id: 'moss-stones', name: 'Мшистые камни', x: 860, y: 480, radius: 72 },
  { id: 'palm', name: 'Пальма', x: 1360, y: 380, radius: 72 },
  { id: 'shore-plants', name: 'Растения у берега', x: 1550, y: 670, radius: 72 },
  { id: 'ancient-gateway', name: 'Старая арка', x: 1970, y: 840, radius: 72 },
];

export const JUNGLE_SYMBOLS: Record<JungleSymbolId, { name: string; glyph: string }> = {
  leaf: { name: 'Лист', glyph: '❧' },
  water: { name: 'Вода', glyph: '◈' },
  stone: { name: 'Камень', glyph: '◆' },
};

/** Вход в уже существующий храм: после кода он становится проходом дальше. */
export const JUNGLE_TEMPLE = { x: 480, y: 442, interactRadius: 126 } as const;
