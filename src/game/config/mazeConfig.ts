import type { Point } from '../../network/types';

/** Масштабированная программная копия бумажной карты «Замок дракона». */
export const MAZE_CONFIG = {
  width: 2120,
  height: 1750,
  scale: 2,
  wall: 22,
  player: { speed: 220, radius: 16, maxFrameDeltaMs: 100 },
  camera: { viewWidth: 760, viewHeight: 410, maxCssZoom: 1.35, followLerp: 0.18 },
  spawn: { x: 1940, y: 1600 } satisfies Point,
  checkpoints: [{ x: 1940, y: 1600 }, { x: 890, y: 940 }, { x: 410, y: 540 }] satisfies readonly Point[],
  hazardReveal: 250,
  respawnDelayMs: 1000,
  invulnerableMs: 1100,
} as const;

export const MAZE_PALETTE = { floor: 0x302553, wall: 0xf2d56a, wallShade: 0xc6a84c, wallLight: 0xfff0a5 } as const;
