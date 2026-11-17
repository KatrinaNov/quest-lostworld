import Phaser from 'phaser';
import { createRng } from '../config/worldConfig';
import { WORLD_CONFIG } from '../config/worldConfig';
import {
  MC_PALETTE,
  MINECRAFT_CONFIG,
  MINECRAFT_GROUND,
} from '../config/minecraftWorldConfig';
import { MC_TEXTURES, mcWaterFrameKey } from '../scenes/minecraftPreloadTextures';
import { TEXTURES } from '../scenes/PreloadScene';
import { bakeMinecraftCobblePaths } from './minecraftCobblePaths';
import {
  groundTileKind,
  tileCountX,
  tileCountY,
  type GroundTileKind,
  waterCollisionCenters,
} from './minecraftGroundLayout';

const TREE_TEXTURES = [TEXTURES.treeA, TEXTURES.treeB, TEXTURES.pine] as const;
const TREE_TRUNK_R = WORLD_CONFIG.decor.treeTrunkRadius;

const DEPTH = {
  grassField: -920,
  groundOverlay: -910,
  water: -905,
  portal: -100,
  props: 0,
  vignette: -900,
} as const;

export interface BuiltMinecraftWorld {
  obstacles: { x: number; y: number; r: number }[];
  waterTiles: Phaser.GameObjects.Image[];
}

export function buildMinecraftWorld(scene: Phaser.Scene): BuiltMinecraftWorld {
  const obstacles: { x: number; y: number; r: number }[] = [];
  const { block } = MINECRAFT_CONFIG;
  const treeRng = createRng(MINECRAFT_CONFIG.seed + 881);
  const waterTiles = buildTexturedGround(scene);
  bakeMinecraftCobblePaths(scene);

  addPortal(scene, MINECRAFT_CONFIG.portal.x, MINECRAFT_CONFIG.portal.y);
  addTemple(scene, obstacles, 480, 410);
  addCamp(scene, obstacles, 1120, 980);
  addForest(scene, obstacles, treeRng);
  addMine(scene, obstacles, 730, 800, block);
  addRuins(scene, obstacles, 2040, 940, block);
  addWaterfall(scene);
  addRocks(scene, obstacles, treeRng);

  return { obstacles, waterTiles };
}

function buildTexturedGround(scene: Phaser.Scene): Phaser.GameObjects.Image[] {
  const { width, height, block: b } = MINECRAFT_CONFIG;
  const waterTiles: Phaser.GameObjects.Image[] = [];

  scene.add
    .tileSprite(0, 0, width, height, MC_TEXTURES.grassField)
    .setOrigin(0, 0)
    .setDepth(DEPTH.grassField);

  const cols = tileCountX();
  const rows = tileCountY();

  for (let ty = 0; ty < rows; ty += 1) {
    for (let tx = 0; tx < cols; tx += 1) {
      const kind = groundTileKind(tx, ty);
      const cx = tx * b + b / 2;
      const cy = ty * b + b / 2;

      if (kind === 'water') {
        waterTiles.push(
          scene.add.image(cx, cy, mcWaterFrameKey(0)).setDepth(DEPTH.water),
        );
        continue;
      }
      if (kind === 'grass' || kind === 'path') continue;

      const key = textureKeyForKind(kind, tx, ty);
      if (key) scene.add.image(cx, cy, key).setDepth(DEPTH.groundOverlay);
    }
  }

  addGroundVignette(scene);
  return waterTiles;
}

function textureKeyForKind(kind: GroundTileKind, tx: number, ty: number): string | null {
  const alt = (tx + ty) % 2;
  const byKind: Record<Exclude<GroundTileKind, 'grass' | 'water'>, string> = {
    sand: alt ? MC_TEXTURES.sandB : MC_TEXTURES.sandA,
    path: MC_TEXTURES.path,
    stone: MC_TEXTURES.stone,
    shoreGrassN: MC_TEXTURES.shoreGrassN,
    shoreGrassS: MC_TEXTURES.shoreGrassS,
    shoreGrassE: MC_TEXTURES.shoreGrassE,
    shoreGrassW: MC_TEXTURES.shoreGrassW,
    shoreSandN: MC_TEXTURES.shoreSandN,
    shoreSandS: MC_TEXTURES.shoreSandS,
    shoreSandE: MC_TEXTURES.shoreSandE,
    shoreSandW: MC_TEXTURES.shoreSandW,
  };
  return byKind[kind as Exclude<GroundTileKind, 'grass' | 'water'>] ?? null;
}

function addGroundVignette(scene: Phaser.Scene): void {
  const { width, height } = MINECRAFT_CONFIG;
  const g = scene.add.graphics();
  const bands = 7;
  const thickness = 16;
  for (let i = 0; i < bands; i += 1) {
    const inset = i * thickness;
    g.fillStyle(0x0a120a, 0.09);
    g.fillRect(0, inset, width, thickness);
    g.fillRect(0, height - inset - thickness, width, thickness);
    g.fillRect(inset, 0, thickness, height);
    g.fillRect(width - inset - thickness, 0, thickness, height);
  }
  g.setDepth(DEPTH.vignette);
}

function addPortal(scene: Phaser.Scene, x: number, y: number): void {
  const b = MINECRAFT_CONFIG.block;
  const frame = scene.add.graphics();
  frame.fillStyle(MC_PALETTE.stoneDark, 1);
  frame.fillRect(-b * 2.2, -b * 2.5, b * 4.4, b * 5);
  frame.fillStyle(MC_PALETTE.stone, 1);
  frame.fillRect(-b * 1.6, -b * 2, b * 3.2, b * 4);
  frame.fillStyle(0x59c3ff, 0.85);
  frame.fillRect(-b * 0.9, -b * 0.5, b * 1.8, b * 2.2);
  const portal = scene.add.container(x, y, [frame]);
  portal.setDepth(DEPTH.portal);
}

function addIslandTree(
  scene: Phaser.Scene,
  obstacles: { x: number; y: number; r: number }[],
  rng: () => number,
  x: number,
  y: number,
  scaleMul = 1,
): void {
  const kind = TREE_TEXTURES[Math.floor(rng() * TREE_TEXTURES.length)];
  const scale = (0.82 + rng() * 0.28) * scaleMul;
  const isPine = kind === TEXTURES.pine;
  const originY = isPine ? 172 / 190 : 160 / 180;
  scene.add
    .image(x, y, kind)
    .setOrigin(0.5, originY)
    .setScale(rng() > 0.5 ? -scale : scale, scale)
    .setDepth(y);
  obstacles.push({ x, y, r: TREE_TRUNK_R });
}

function addForest(
  scene: Phaser.Scene,
  obstacles: { x: number; y: number; r: number }[],
  rng: () => number,
): void {
  const { width, height } = MINECRAFT_CONFIG;
  const cell = 210;
  const paths = MINECRAFT_GROUND.pathPoints;
  const clearOfLandmarks = (x: number, y: number): boolean => {
    const landmarkZones = [
      { x: 1120, y: 980, r: 300 }, // camp
      { x: 480, y: 410, r: 230 }, // temple
      { x: 730, y: 800, r: 150 }, // mine
      { x: 2040, y: 940, r: 230 }, // ruins
      { ...MINECRAFT_CONFIG.portal, r: 150 },
      { x: 1810, y: 370, r: 310 }, // waterfall and pond
    ];
    if (landmarkZones.some((z) => Math.hypot(x - z.x, y - z.y) < z.r)) return false;
    for (let i = 0; i < paths.length - 1; i += 1) {
      if (distanceToSegment(x, y, paths[i].x, paths[i].y, paths[i + 1].x, paths[i + 1].y) < 112) return false;
    }
    return true;
  };

  // Jittered grid gives the whole map a steady density without bunching props at the edges.
  for (let y = 110; y < height - 80; y += cell) {
    for (let x = 110; x < width - 80; x += cell) {
      const px = x + (rng() - 0.5) * 100;
      const py = y + (rng() - 0.5) * 100;
      if (!clearOfLandmarks(px, py) || groundTileKind(Math.floor(px / MINECRAFT_CONFIG.block), Math.floor(py / MINECRAFT_CONFIG.block)) === 'water') continue;
      if (rng() < 0.64) addIslandTree(scene, obstacles, rng, px, py, 0.8 + rng() * 0.18);
      else addBush(scene, obstacles, px + 34, py + 38, rng);
    }
  }

  // Smaller bushes fill the gaps between the evenly spaced larger props.
  for (let y = 170; y < height - 100; y += 145) {
    for (let x = 170; x < width - 100; x += 145) {
      const px = x + (rng() - 0.5) * 72;
      const py = y + (rng() - 0.5) * 72;
      if (clearOfLandmarks(px, py) && groundTileKind(Math.floor(px / MINECRAFT_CONFIG.block), Math.floor(py / MINECRAFT_CONFIG.block)) !== 'water' && rng() < 0.42) {
        addBush(scene, obstacles, px, py, rng);
      }
    }
  }
}

function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Phaser.Math.Clamp(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function addBush(scene: Phaser.Scene, obstacles: { x: number; y: number; r: number }[], x: number, y: number, rng: () => number): void {
  const scale = 0.7 + rng() * 0.35;
  scene.add.image(x, y, TEXTURES.bush).setOrigin(0.5, 0.75).setScale(scale).setDepth(y);
  obstacles.push({ x, y: y - 5, r: 12 * scale });
}

function addTemple(scene: Phaser.Scene, obstacles: { x: number; y: number; r: number }[], x: number, y: number): void {
  const g = scene.add.graphics();
  // Mossy block doorway, broken roof and stepped stone approach.
  g.fillStyle(0x283026, 0.45).fillRect(x - 130, y + 72, 270, 24);
  for (let row = 0; row < 3; row += 1) {
    g.fillStyle(row % 2 ? 0x666c65 : 0x777d72, 1);
    g.fillRect(x - 112, y - 70 + row * 42, 46, 38);
    g.fillRect(x + 66, y - 70 + row * 42, 46, 38);
    g.fillStyle(0x444b46, 1);
    g.fillRect(x - 66, y - 70 + row * 42, 132, 38);
    g.fillStyle(0x252b27, 1).fillRect(x - 42, y - 28 + row * 42, 84, 38);
  }
  g.fillStyle(0x899084, 1).fillRect(x - 140, y - 112, 280, 38);
  g.fillStyle(0x414940, 1).fillRect(x - 92, y - 140, 50, 28);
  g.fillStyle(0x778073, 1).fillRect(x + 45, y - 138, 88, 28);
  g.fillStyle(0x3f7433, 1).fillRect(x - 140, y - 112, 92, 8);
  g.setDepth(y + 100);
  obstacles.push({ x: x - 90, y: y + 2, r: 32 }, { x: x + 90, y: y + 2, r: 32 });
}

function addCamp(scene: Phaser.Scene, obstacles: { x: number; y: number; r: number }[], x: number, y: number): void {
  const g = scene.add.graphics();
  // Canvas, timber supports and open tent entrance.
  g.fillStyle(0x5a4932, 0.45).fillEllipse(x, y + 50, 250, 58);
  g.fillStyle(0x7a5736, 1).fillTriangle(x - 100, y + 24, x, y - 95, x + 100, y + 24);
  g.fillStyle(0xd6bd8b, 1).fillTriangle(x - 92, y + 18, x, y - 84, x - 8, y + 18);
  g.fillStyle(0xf0dba7, 1).fillTriangle(x + 8, y + 18, x, y - 84, x + 92, y + 18);
  g.fillStyle(0x352b20, 1).fillTriangle(x - 24, y + 20, x, y - 28, x + 24, y + 20);
  g.lineStyle(7, 0x654326, 1).lineBetween(x - 118, y + 22, x + 118, y + 22);
  g.setDepth(y + 40);

  // Crates, a map table, and a stone-ring campfire.
  for (const [dx, dy] of [[-156, 28], [154, 44], [110, 100], [-100, 115]] as const) {
    g.fillStyle(0x674327, 1).fillRect(x + dx, y + dy, 48, 42);
    g.lineStyle(4, 0xb47b3e, 1).strokeRect(x + dx, y + dy, 48, 42);
    g.lineStyle(3, 0x412d20, 1).lineBetween(x + dx, y + dy + 21, x + dx + 48, y + dy + 21);
  }
  g.fillStyle(0x5b3926, 1).fillRect(x + 10, y + 110, 116, 14);
  g.fillStyle(0xd3b67a, 1).fillRect(x + 18, y + 88, 100, 26);
  g.fillStyle(0x526b45, 1).fillRect(x + 40, y + 95, 28, 10);
  g.fillStyle(0xf3a12c, 1).fillCircle(x - 16, y + 145, 22);
  g.fillStyle(0xffe276, 1).fillCircle(x - 16, y + 145, 11);
  for (let i = 0; i < 8; i += 1) {
    const a = i * Math.PI / 4;
    g.fillStyle(0x77756d, 1).fillRect(x - 16 + Math.cos(a) * 36 - 10, y + 145 + Math.sin(a) * 24 - 8, 20, 16);
  }
  g.setDepth(y + 180);
  // Block the tent footprint while leaving the dark entrance open at its south edge.
  obstacles.push(
    { x: x - 66, y: y - 18, r: 36 },
    { x: x + 66, y: y - 18, r: 36 },
    { x: x - 132, y: y + 48, r: 22 }, { x: x + 178, y: y + 62, r: 22 },
    { x: x + 72, y: y + 110, r: 30 }, { x: x - 16, y: y + 145, r: 30 },
  );
}

function addWaterfall(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  // A stepped cliff and bright blocky water spill into the pond.
  g.fillStyle(0x59635b, 1).fillRect(1790, 120, 180, 200);
  g.fillStyle(0x788078, 1).fillRect(1760, 176, 240, 44);
  g.fillStyle(0x3085c6, 1).fillRect(1830, 210, 104, 228);
  g.fillStyle(0x72c9ef, 1).fillRect(1842, 210, 28, 214);
  g.fillStyle(0xa8e4f5, 1).fillRect(1882, 220, 15, 180);
  g.fillStyle(0x68c8e8, 0.8).fillRect(1800, 420, 164, 26);
  g.fillStyle(0x9ee9f8, 0.8).fillRect(1778, 435, 205, 12);
  g.setDepth(1);
}

function addMine(
  scene: Phaser.Scene,
  obstacles: { x: number; y: number; r: number }[],
  x: number,
  y: number,
  b: number,
): void {
  const arch = scene.add.graphics();
  arch.fillStyle(MC_PALETTE.stoneDark, 1);
  arch.fillRect(-b * 2, -b * 1.2, b * 4, b * 2.4);
  arch.fillStyle(0x1a2530, 1);
  arch.fillRect(-b * 1.2, -b * 0.5, b * 2.4, b * 1.8);
  const label = scene.add.text(0, -b * 2, 'Шахта', {
    fontSize: '18px',
    color: '#e9f1e4',
    stroke: '#0b1511',
    strokeThickness: 4,
  }).setOrigin(0.5);
  scene.add.container(x, y, [arch, label]).setDepth(y);
  obstacles.push({ x, y, r: b * 1.5 });
  for (let i = 0; i < 5; i += 1) {
    obstacles.push({ x: x - 80 + i * 40, y: y + 60, r: 18 });
  }
}

function addRuins(
  scene: Phaser.Scene,
  obstacles: { x: number; y: number; r: number }[],
  x: number,
  y: number,
  b: number,
): void {
  const parts = [
    { dx: 0, dy: 0, w: 3, h: 2 },
    { dx: 140, dy: 40, w: 2, h: 3 },
    { dx: 70, dy: 120, w: 4, h: 2 },
  ];
  for (const p of parts) {
    const px = x + p.dx;
    const py = y + p.dy;
    const wall = scene.add.rectangle(px, py, p.w * b, p.h * b, MC_PALETTE.ruin);
    wall.setStrokeStyle(3, MC_PALETTE.stoneDark);
    wall.setDepth(py);
    wall.setAlpha(0.92);
    obstacles.push({ x: px, y: py, r: Math.max(p.w, p.h) * b * 0.32 });
  }
}

function addRocks(
  scene: Phaser.Scene,
  obstacles: { x: number; y: number; r: number }[],
  rng: () => number,
): void {
  const { width, height } = MINECRAFT_CONFIG;
  const paths = MINECRAFT_GROUND.pathPoints;
  for (let y = 120; y < height - 80; y += 190) {
    for (let x = 120; x < width - 80; x += 190) {
      const rockX = x + (rng() - 0.5) * 95;
      const rockY = y + (rng() - 0.5) * 95;
      const nearPath = paths.slice(0, -1).some((p, i) => distanceToSegment(rockX, rockY, p.x, p.y, paths[i + 1].x, paths[i + 1].y) < 90);
      const landmark = Math.hypot(rockX - 1120, rockY - 980) < 280 || Math.hypot(rockX - 480, rockY - 410) < 200 || Math.hypot(rockX - 1810, rockY - 370) < 280;
      if (nearPath || landmark || groundTileKind(Math.floor(rockX / MINECRAFT_CONFIG.block), Math.floor(rockY / MINECRAFT_CONFIG.block)) === 'water') continue;
      scene.add
      .image(rockX, rockY, TEXTURES.rubble)
      .setOrigin(0.5, 0.68)
      .setScale(0.85 + rng() * 0.45)
      .setDepth(rockY);
      obstacles.push({ x: rockX, y: rockY, r: 22 });
    }
  }
  const block = MINECRAFT_CONFIG.block;
  for (const { x, y } of waterCollisionCenters()) {
    obstacles.push({ x, y, r: block * 0.48 });
  }
}
