import type { Point } from '../../network/types';

export const MINECRAFT_INTRO = {
  title: 'МИР MINECRAFT',
  body: `Вы добрались до мира кубов!
Когда-то здесь были зелёные леса, деревни и глубокие шахты.
Но Глитч добрался и сюда. Он нарушил работу древних механизмов и спрятал важные ресурсы.
Впереди вас ждёт забытый биом.
Исследуйте территорию. Возможно, здесь вы найдёте следы Глитча и узнаете, куда он направился дальше.
Будьте внимательны: в этом мире даже обычный камень может оказаться важной подсказкой`,
  button: 'Исследовать мир',
} as const;

export const MINECRAFT_CONFIG = {
  width: 2400,
  height: 1700,
  boundaryMargin: 56,
  block: 40,
  seed: 34017,
  bakeScale: 1.35,

  /** Поляна у портала — появление команды. */
  portal: { x: 360, y: 1250 } satisfies Point,
  spawnPoints: [
    { x: 500, y: 1270 },
    { x: 520, y: 1320 },
    { x: 450, y: 1350 },
    { x: 500, y: 1210 },
  ] satisfies readonly Point[],

  player: {
    speed: 220,
    radius: 16,
    maxFrameDeltaMs: 100,
  },

  camera: {
    viewHeight: 400,
    viewWidth: 760,
    maxCssZoom: 1.4,
    followLerp: 0.2,
  },
} as const;

/** Зоны поверхности (совпадают с исходной геометрией карты). */
export const MINECRAFT_GROUND = {
  sand: { originX: 1480, originY: 280, tilesW: 14, tilesH: 10 },
  water: { originX: 1560, originY: 320, tilesW: 10, tilesH: 7 },
  pathPoints: [
    { x: 360, y: 1250 },
    { x: 650, y: 1130 },
    { x: 980, y: 1020 },
    { x: 1320, y: 1000 },
    { x: 1580, y: 850 },
    { x: 1770, y: 650 },
    { x: 1850, y: 480 },
  ],
  /** Центры каменных декораций — пятна каменистого грунта под ними. */
  stonePatches: [
    [620, 470], [720, 500], [850, 480], [920, 540],
    [1690, 620], [1850, 640], [1980, 500], [2070, 620],
  ] as const,
} as const;

export const MINECRAFT_BOUNDS = {
  minX: MINECRAFT_CONFIG.boundaryMargin,
  maxX: MINECRAFT_CONFIG.width - MINECRAFT_CONFIG.boundaryMargin,
  minY: MINECRAFT_CONFIG.boundaryMargin,
  maxY: MINECRAFT_CONFIG.height - MINECRAFT_CONFIG.boundaryMargin,
} as const;

/** Палитра в духе блочного мира (оригинальные оттенки, не копия ассетов). */
export const MC_PALETTE = {
  grassA: 0x5a9e3e,
  grassB: 0x4d8f35,
  dirt: 0x8b6914,
  stone: 0x8a8f94,
  stoneDark: 0x6a6f74,
  sand: 0xc9b87c,
  water: 0x2f7fca,
  waterDeep: 0x1f5fa0,
  wood: 0x8b5e3c,
  woodDark: 0x6a452e,
  plank: 0xb8874a,
  leaves: 0x3f9a45,
  leavesDark: 0x2f7a35,
  path: 0xa09b8d,
  ruin: 0x707880,
} as const;

export function minecraftSpawnForPlayer(players: { id: string }[], selfId: string): Point {
  const sorted = [...players].sort((a, b) => a.id.localeCompare(b.id));
  const idx = Math.max(0, sorted.findIndex((p) => p.id === selfId));
  return MINECRAFT_CONFIG.spawnPoints[idx % MINECRAFT_CONFIG.spawnPoints.length];
}
