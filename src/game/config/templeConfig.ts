import type { Point } from '../../network/types';

/** Заполняется организатором перед игрой — место нельзя угадывать в коде. */
export const TEMPLE_MAP_LOCATION_HINT = '[МЕСТО_КАРТЫ]';

/** Отдельные параметры сцены-платформера. Top-down конфигурации не затрагиваются. */
export const TEMPLE_CONFIG = {
  width: 13800,
  height: 760,
  gravityY: 1450,
  // Умеренный, но надёжный прыжок: ~124 px в высоту и ~215 px при беге.
  player: { speed: 260, jumpVelocity: 600, width: 30, height: 38 },
  camera: { viewHeight: 430, viewWidth: 860, maxCssZoom: 1.45, followLerp: 0.14 },
  start: { x: 130, y: 560 } satisfies Point,
  checkpoints: [
    { x: 820, y: 560 },
    // Безопасный бастион прямо перед первыми огненными цепями.
    { x: 5010, y: 560 },
    { x: 6200, y: 560 },
    { x: 9400, y: 560 },
  ] satisfies readonly Point[],
  respawnDelayMs: 1000,
  coyoteMs: 110,
  jumpBufferMs: 115,
} as const;

export const TEMPLE_PALETTE = {
  background: 0x07080d, backgroundStone: 0x151923, stone: 0x68707a, stoneDark: 0x39404b,
  stoneLight: 0x9aa1a8, moss: 0x5c7952, lava: 0xdc3e1a, lavaLight: 0xffb12f,
  torch: 0xffd15a, plate: 0x53606a, plateActive: 0x7fe1d0,
} as const;
