import Phaser from 'phaser';
import { createRng } from '../config/worldConfig';
import { MC_PALETTE, MINECRAFT_CONFIG } from '../config/minecraftWorldConfig';

/** Ключи текстур второй локации (тайлы 40×40, кроме бесшовной травы). */
export const MC_TEXTURES = {
  grassField: 'mc-grass-field',
  grassA: 'mc-grass-a',
  grassB: 'mc-grass-b',
  sandA: 'mc-sand-a',
  sandB: 'mc-sand-b',
  path: 'mc-path',
  stone: 'mc-stone-ground',
  shoreGrassN: 'mc-shore-grass-n',
  shoreGrassS: 'mc-shore-grass-s',
  shoreGrassE: 'mc-shore-grass-e',
  shoreGrassW: 'mc-shore-grass-w',
  shoreSandN: 'mc-shore-sand-n',
  shoreSandS: 'mc-shore-sand-s',
  shoreSandE: 'mc-shore-sand-e',
  shoreSandW: 'mc-shore-sand-w',
} as const;

export const MC_WATER_FRAME_KEYS = ['mc-water-0', 'mc-water-1', 'mc-water-2', 'mc-water-3'] as const;

const TILE = MINECRAFT_CONFIG.block;

export function mcWaterFrameKey(frame: number): string {
  return MC_WATER_FRAME_KEYS[((frame % 4) + 4) % 4];
}

type Draw = (g: Phaser.GameObjects.Graphics) => void;

/** Создаёт тайловые текстуры Minecraft-локации (идемпотентно). */
export function ensureMinecraftTextures(scene: Phaser.Scene): void {
  const make = (key: string, w: number, h: number, draw: Draw): void => {
    if (scene.textures.exists(key)) return;
    const g = scene.add.graphics({ x: 0, y: 0 });
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };

  make(MC_TEXTURES.grassA, TILE, TILE, (g) => drawGrassTile(g, 0));
  make(MC_TEXTURES.grassB, TILE, TILE, (g) => drawGrassTile(g, 1));
  make(MC_TEXTURES.sandA, TILE, TILE, (g) => drawSandTile(g, 0));
  make(MC_TEXTURES.sandB, TILE, TILE, (g) => drawSandTile(g, 1));
  make(MC_TEXTURES.path, TILE, TILE, drawPathTile);
  make(MC_TEXTURES.stone, TILE, TILE, drawStoneGroundTile);

  const shoreGrass: Record<ShoreSide, string> = {
    n: MC_TEXTURES.shoreGrassN,
    s: MC_TEXTURES.shoreGrassS,
    e: MC_TEXTURES.shoreGrassE,
    w: MC_TEXTURES.shoreGrassW,
  };
  const shoreSand: Record<ShoreSide, string> = {
    n: MC_TEXTURES.shoreSandN,
    s: MC_TEXTURES.shoreSandS,
    e: MC_TEXTURES.shoreSandE,
    w: MC_TEXTURES.shoreSandW,
  };
  for (const side of ['n', 's', 'e', 'w'] as const) {
    make(shoreGrass[side], TILE, TILE, (g) => drawShoreTile(g, 'grass', side));
    make(shoreSand[side], TILE, TILE, (g) => drawShoreTile(g, 'sand', side));
  }

  const fieldSize = 128;
  const rng = createRng(MINECRAFT_CONFIG.seed + 9001);
  make(MC_TEXTURES.grassField, fieldSize, fieldSize, (g) => {
    for (let y = 0; y < fieldSize; y += TILE) {
      for (let x = 0; x < fieldSize; x += TILE) {
        const variant = ((x / TILE) + (y / TILE) + Math.floor(rng() * 2)) % 2;
        drawGrassTile(g, variant, x, y);
      }
    }
    for (let i = 0; i < 42; i += 1) {
      const x = rng() * fieldSize;
      const y = rng() * fieldSize;
      g.fillStyle(0x3f7a32, 0.25);
      g.fillCircle(x, y, 2 + rng() * 3);
    }
  });

  for (let f = 0; f < 4; f += 1) {
    make(mcWaterFrameKey(f), TILE, TILE, (g) => drawWaterTile(g, f, 0));
  }
}

function drawGrassTile(g: Phaser.GameObjects.Graphics, variant: number, ox = 0, oy = 0): void {
  const base = variant ? MC_PALETTE.grassB : MC_PALETTE.grassA;
  const hi = variant ? 0x6aab50 : 0x68b04a;
  g.fillStyle(base, 1);
  g.fillRect(ox, oy, TILE, TILE);
  g.fillStyle(hi, 0.22);
  g.fillRect(ox + 1, oy + 1, TILE - 2, 6);
  g.fillStyle(0x2d5a28, 0.35);
  g.fillRect(ox + 1, oy + TILE - 5, TILE - 2, 4);
  for (let i = 0; i < 10; i += 1) {
    const x = ox + 3 + (i * 11) % (TILE - 6);
    const y = oy + 8 + (i * 7) % (TILE - 14);
    g.fillStyle(i % 3 ? 0x4a8f3a : 0x3a7030, 0.55);
    g.fillRect(x, y, 2, 2);
    g.lineStyle(1, 0x1f4a22, 0.45);
    g.lineBetween(x, y + 2, x - 1, y + 6);
  }
  g.lineStyle(1, 0x000000, 0.07);
  g.strokeRect(ox + 0.5, oy + 0.5, TILE - 1, TILE - 1);
}

function drawSandTile(g: Phaser.GameObjects.Graphics, variant: number): void {
  const base = variant ? 0xdcc98f : MC_PALETTE.sand;
  g.fillStyle(base, 1);
  g.fillRect(0, 0, TILE, TILE);
  g.fillStyle(0xe8d5a8, 0.35);
  g.fillRect(2, 2, TILE - 4, 5);
  const shades = [0xc4ad6e, 0xb89a58, 0xd9c38a];
  for (let i = 0; i < 14; i += 1) {
    g.fillStyle(shades[i % 3], 0.55);
    g.fillRect(2 + (i * 9) % (TILE - 6), 6 + (i * 5) % (TILE - 10), 2, 2);
  }
  g.lineStyle(1, 0x8a7350, 0.25);
  g.strokeRect(0.5, 0.5, TILE - 1, TILE - 1);
}

function drawPathTile(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(MC_PALETTE.dirt, 0.35);
  g.fillRect(0, 0, TILE, TILE);
  g.fillStyle(MC_PALETTE.path, 1);
  g.fillRect(0, 0, TILE, TILE);
  const stones = [MC_PALETTE.stoneDark, MC_PALETTE.stone, 0x959aa0];
  for (let i = 0; i < 6; i += 1) {
    const x = 4 + (i * 13) % 28;
    const y = 6 + (i * 11) % 26;
    g.fillStyle(0x2d3640, 0.45);
    g.fillRoundedRect(x, y + 1, 10, 8, 2);
    g.fillStyle(stones[i % 3], 1);
    g.fillRoundedRect(x, y, 10, 8, 2);
    g.fillStyle(0xffffff, 0.12);
    g.fillRect(x + 1, y + 1, 5, 2);
  }
  g.lineStyle(1, 0x6a6258, 0.35);
  g.strokeRect(0.5, 0.5, TILE - 1, TILE - 1);
}

function drawStoneGroundTile(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0x4a5248, 0.35);
  g.fillRect(0, 0, TILE, TILE);
  g.fillStyle(MC_PALETTE.grassB, 0.65);
  g.fillRect(0, 0, TILE, TILE);
  const stones = [MC_PALETTE.stoneDark, MC_PALETTE.stone, 0x9aa0a8];
  for (let i = 0; i < 8; i += 1) {
    const x = 2 + (i * 12) % 26;
    const y = 4 + (i * 9) % 28;
    g.fillStyle(0x1a2028, 0.4);
    g.fillRoundedRect(x + 1, y + 2, 11, 9, 2);
    g.fillStyle(stones[i % stones.length], 1);
    g.fillRoundedRect(x, y, 11, 9, 2);
  }
}

type ShoreSide = 'n' | 's' | 'e' | 'w';

function drawShoreTile(g: Phaser.GameObjects.Graphics, kind: 'grass' | 'sand', side: ShoreSide): void {
  if (kind === 'grass') drawGrassTile(g, 0);
  else drawSandTile(g, 0);

  const foam = 0xa8d8f5;
  const water = MC_PALETTE.water;
  const deep = MC_PALETTE.waterDeep;
  const band = 10;

  if (side === 'n') {
    g.fillStyle(deep, 0.85);
    g.fillRect(0, 0, TILE, band);
    g.fillStyle(water, 0.75);
    g.fillRect(0, band - 3, TILE, 5);
    g.fillStyle(foam, 0.45);
    for (let x = 2; x < TILE; x += 7) g.fillRect(x, band - 2, 4, 2);
  } else if (side === 's') {
    g.fillStyle(deep, 0.85);
    g.fillRect(0, TILE - band, TILE, band);
    g.fillStyle(foam, 0.4);
    for (let x = 3; x < TILE; x += 8) g.fillRect(x, TILE - band + 1, 5, 2);
  } else if (side === 'w') {
    g.fillStyle(deep, 0.85);
    g.fillRect(0, 0, band, TILE);
    g.fillStyle(water, 0.7);
    g.fillRect(band - 4, 0, 5, TILE);
    g.fillStyle(foam, 0.4);
    for (let y = 2; y < TILE; y += 9) g.fillRect(band - 2, y, 2, 4);
  } else {
    g.fillStyle(deep, 0.85);
    g.fillRect(TILE - band, 0, band, TILE);
    g.fillStyle(foam, 0.4);
    for (let y = 4; y < TILE; y += 8) g.fillRect(TILE - band + 1, y, 2, 4);
  }
}

function drawWaterTile(g: Phaser.GameObjects.Graphics, frame: number, offsetX = 0): void {
  const ox = offsetX;
  const alt = frame % 2;
  g.fillStyle(alt ? MC_PALETTE.waterDeep : MC_PALETTE.water, 1);
  g.fillRect(ox, 0, TILE, TILE);
  g.fillStyle(alt ? MC_PALETTE.water : MC_PALETTE.waterDeep, 0.45);
  for (let row = 0; row < 4; row += 1) {
    const y = ((row * 10 + frame * 3) % TILE) + 2;
    g.fillRect(ox + 1, y, TILE - 2, 4);
  }
  g.fillStyle(0xffffff, 0.16);
  g.fillRect(ox + 2, 3 + (frame % 3), TILE - 4, 2);
  g.lineStyle(1, 0xffffff, 0.12);
  for (let i = 0; i < 3; i += 1) {
    const waveY = 8 + i * 12 + frame * 2;
    const y = waveY % (TILE - 4) + 2;
    g.beginPath();
    g.moveTo(ox + 2, y);
    g.lineTo(ox + 14, y + 2);
    g.lineTo(ox + 28, y);
    g.lineTo(ox + TILE - 2, y + 1);
    g.strokePath();
  }
  for (let i = 0; i < 5; i += 1) {
    g.fillStyle(0xffffff, 0.08 + (i % 2) * 0.06);
    g.fillCircle(ox + 6 + i * 7, 10 + ((i + frame) % 3) * 8, 2);
  }
}