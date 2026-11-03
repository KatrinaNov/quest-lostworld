import type { Point } from '../../network/types';

/**
 * Параметры игрового мира и движения. Все «магические числа» — здесь.
 */

export interface Obstacle {
  x: number;
  y: number;
  r: number;
}

export interface Ruin {
  x: number;
  y: number;
}

/** Ломаная линия, по которой выкладывается каменная дорожка. */
export type PathLine = readonly Point[];

export const WORLD_CONFIG = {
  /** Размер мира в «мировых» единицах (больше экрана). */
  width: 2400,
  height: 1600,
  /** Отступ от края мира, дальше которого персонаж не заходит. */
  boundaryMargin: 70,
  seed: 20260311,

  /** Движение локального игрока. */
  player: {
    speed: 230, // единиц в секунду
    radius: 16, // радиус столкновений
    maxFrameDeltaMs: 50, // защита от «прыжков» после лагов
  },

  /** Удалённые игроки: сглаживание и телепорт при большом рассинхроне. */
  remote: {
    smoothing: 14, // чем больше, тем быстрее догоняем цель
    teleportDistance: 450,
  },

  camera: {
    /** Сколько единиц мира должно помещаться по высоте экрана (телефон в landscape). */
    viewHeight: 520,
    /** ...и не менее стольких по ширине (защита от слишком сильного приближения на высоких окнах). */
    viewWidth: 900,
    /** Максимальный масштаб в CSS-пикселях на единицу мира (на больших мониторах). */
    maxCssZoom: 1.4,
    /** Прозрачность кроны, за которой скрылся игрок. */
    canopyFadeAlpha: 0.38,
    followLerp: 0.12,
  },

  /** Центральная площадка с порталом. */
  plaza: { x: 1200, y: 800, radius: 215 },
  portal: { x: 1200, y: 800, collisionRadius: 62 },

  /** Точки появления: по слотам комнаты, вокруг портала. */
  spawnPoints: [
    { x: 1120, y: 960 },
    { x: 1280, y: 960 },
    { x: 1080, y: 880 },
    { x: 1320, y: 880 },
  ],

  /** Каменные дорожки от площадки к краям мира и к руинам. */
  pathWidth: 104,
  paths: [
    // запад
    [
      { x: 1000, y: 800 },
      { x: 800, y: 835 },
      { x: 560, y: 780 },
      { x: 340, y: 825 },
      { x: 110, y: 800 },
    ],
    // восток
    [
      { x: 1400, y: 800 },
      { x: 1650, y: 765 },
      { x: 1900, y: 835 },
      { x: 2150, y: 790 },
      { x: 2290, y: 800 },
    ],
    // север
    [
      { x: 1200, y: 600 },
      { x: 1235, y: 430 },
      { x: 1175, y: 260 },
      { x: 1200, y: 110 },
    ],
    // юг
    [
      { x: 1200, y: 1000 },
      { x: 1165, y: 1180 },
      { x: 1235, y: 1350 },
      { x: 1200, y: 1490 },
    ],
    // к северо-западным руинам
    [
      { x: 720, y: 815 },
      { x: 640, y: 640 },
      { x: 560, y: 500 },
    ],
    // к юго-восточным руинам
    [
      { x: 1780, y: 800 },
      { x: 1900, y: 960 },
      { x: 1880, y: 1110 },
    ],
  ],

  /** Древние руины. */
  ruins: [
    { x: 520, y: 400 },
    { x: 1900, y: 1230 },
  ],

  /** Деревья и украшения. */
  decor: {
    borderTreeSpacing: 78,
    innerTreeCount: 70,
    innerTreeMinDistance: 120,
    flowerCount: 260,
    grassTuftCount: 320,
    fireflyCount: 36,
    treeTrunkRadius: 15,
    clearancePlaza: 285,
    clearancePath: 92,
    clearanceRuin: 230,
  },
} as const;

export const WORLD_BOUNDS = {
  minX: WORLD_CONFIG.boundaryMargin,
  maxX: WORLD_CONFIG.width - WORLD_CONFIG.boundaryMargin,
  minY: WORLD_CONFIG.boundaryMargin,
  maxY: WORLD_CONFIG.height - WORLD_CONFIG.boundaryMargin,
} as const;

/** Палитра игры (мир + HUD согласованы по цветам). */
export const PALETTE = {
  grassBase: 0x2d5a3a,
  grassDark: 0x244b31,
  grassLight: 0x3a7048,
  stoneDark: 0x59606a,
  stoneMid: 0x7b838e,
  stoneLight: 0x9aa3ad,
  moss: 0x4b7a50,
  glowCyan: 0x6ee7ff,
  glowViolet: 0xb18cff,
  glowGold: 0xffe08a,
  nameText: '#f1f5ea',
  nameTextSelf: '#ffe9a8',
} as const;

/** Детерминированный генератор псевдослучайных чисел (mulberry32). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Расстояние от точки до отрезка. */
export function distToSegment(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

export function distToPaths(p: Point): number {
  let best = Infinity;
  for (const path of WORLD_CONFIG.paths) {
    for (let i = 0; i < path.length - 1; i += 1) {
      best = Math.min(best, distToSegment(p, path[i], path[i + 1]));
    }
  }
  return best;
}
