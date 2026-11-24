import { mazePoint } from '../world/mazeLayout';

export const MAZE_TERRAIN_SCALE = 2;

const spawn = mazePoint(1064, 1057);
const boundsStart = mazePoint(71, 218);
const boundsEnd = mazePoint(1122, 1084);

/** Порядок точек соответствует перемешанным буквам в MAZE_GLYPHS. */
export const MAZE_LETTER_POINTS = [
  [1073, 1020], [879, 1054], [543, 960], [117, 972], [273, 876], [457, 832], [729, 912],
  [1025, 836], [1019, 714], [779, 606], [651, 592], [377, 636], [531, 454], [237, 292],
].map(([x, y]) => mazePoint(x, y));

/** Масштабированная программная копия бумажной карты «Замок дракона». */
export const MAZE_CONFIG = {
  width: 2220,
  height: 2200,
  player: { speed: 220, radius: 16, maxFrameDeltaMs: 100 },
  camera: { viewWidth: 760, viewHeight: 410, maxCssZoom: 1.35, followLerp: 0.18 },
  spawn,
  exit: mazePoint(101, 231),
  checkpoints: [spawn, mazePoint(670, 678), mazePoint(445, 549)],
  bounds: { minX: boundsStart.x, minY: boundsStart.y, maxX: boundsEnd.x, maxY: boundsEnd.y },
  hazardReveal: 145,
  respawnDelayMs: 1000,
  invulnerableMs: 1100,
} as const;

export const MAZE_PALETTE = {
  stoneJoint: '#3d4146',
  stoneSlabs: ['#60666b', '#666b70', '#6d7073', '#696e72', '#73777a'],
  stoneLight: '#85898c',
  stoneShade: '#50565b',
  hedgeShadow: '#172e1e',
  hedgeBase: '#25452a',
  hedgeLeaves: ['#325c32', '#3e6f38', '#4c7b3b', '#558443', '#62944b'],
  hedgeTips: '#83a95b',
} as const;
