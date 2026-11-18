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
import { addMinecraftCamp } from './minecraftCamp';
import { JUNGLE_CAMP } from '../quest/jungleQuestConfig';
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
  trees: MinecraftTreeInfo[];
  openTemplePassage: () => void;
}

export interface MinecraftTreeInfo {
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  halfWidth: number;
  reach: number;
}

export function buildMinecraftWorld(scene: Phaser.Scene): BuiltMinecraftWorld {
  const obstacles: { x: number; y: number; r: number }[] = [];
  const trees: MinecraftTreeInfo[] = [];
  const { block } = MINECRAFT_CONFIG;
  const treeRng = createRng(MINECRAFT_CONFIG.seed + 881);
  const waterTiles = buildTexturedGround(scene);
  bakeMinecraftCobblePaths(scene);

  addPortal(scene, obstacles, MINECRAFT_CONFIG.portal.x, MINECRAFT_CONFIG.portal.y);
  const openTemplePassage = addTemple(scene, obstacles, 480, 410);
  addMinecraftCamp(scene, obstacles);
  addJungleBorder(scene, obstacles, trees, treeRng);
  addForest(scene, obstacles, trees, treeRng);
  addMine(scene, obstacles, 730, 800, block);
  addRuins(scene, obstacles, 2040, 940, block);
  addWaterfall(scene, obstacles);
  addRocks(scene, obstacles, treeRng);

  return { obstacles, waterTiles, trees, openTemplePassage };
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

function addPortal(scene: Phaser.Scene, obstacles: { x: number; y: number; r: number }[], x: number, y: number): void {
  const g = scene.add.graphics();
  const block = (bx: number, by: number, w: number, h: number, tone: number): void => {
    g.fillStyle(0x303936, 0.55).fillRect(bx + 4, by + 5, w, h);
    g.fillStyle(tone, 1).fillRect(bx, by, w, h);
    g.fillStyle(0xc0c1ac, 0.28).fillRect(bx + 3, by + 3, w - 6, 5);
    g.lineStyle(2, 0x50594f, 1).strokeRect(bx + 1, by + 1, w - 2, h - 2);
  };
  // Stone gateway with a water-like magical core, based on the block portal reference.
  block(x - 108, y + 48, 216, 20, 0x7e8579);
  for (let row = 0; row < 3; row += 1) {
    block(x - 90, y - 100 + row * 48, 32, 46, row === 1 ? 0x929587 : 0x747d73);
    block(x + 58, y - 100 + row * 48, 32, 46, row === 1 ? 0x929587 : 0x747d73);
  }
  block(x - 72, y - 132, 144, 30, 0x8f9385);
  block(x - 100, y - 106, 34, 24, 0x6f796e);
  block(x + 66, y - 112, 36, 26, 0x777f73);
  block(x - 38, y - 158, 46, 24, 0x9c9d8a);

  g.fillStyle(0x193a71, 0.75).fillRect(x - 51, y - 96, 102, 142);
  g.fillStyle(0x2d83c7, 0.88).fillRect(x - 45, y - 90, 90, 130);
  for (let row = 0; row < 6; row += 1) {
    g.fillStyle(row % 2 ? 0x68c1ea : 0x3f9bdd, 0.65);
    g.fillRect(x - 42, y - 83 + row * 21, 84, 10);
  }
  g.fillStyle(0xbdefff, 0.55).fillRect(x - 25, y - 82, 14, 112);
  g.fillStyle(0xe1fbff, 0.3).fillCircle(x + 16, y - 24, 30);

  // Chains and lamps make the portal read as an old stone gateway.
  for (const side of [-1, 1]) {
    const lx = x + side * 106;
    g.lineStyle(3, 0x282d2b, 1).lineBetween(lx, y - 110, lx, y - 69);
    g.fillStyle(0x6b4425, 1).fillRect(lx - 8, y - 68, 16, 17);
    g.fillStyle(0xffb13a, 0.35).fillCircle(lx, y - 59, 18);
    g.fillStyle(0xffd65f, 1).fillRect(lx - 4, y - 64, 8, 9);
  }
  g.setDepth(y + 68);

  // Stone pillars and lintel are solid; the luminous centre remains a usable portal passage.
  obstacles.push(
    { x: x - 74, y: y - 30, r: 28 }, { x: x + 74, y: y - 30, r: 28 },
    { x: x - 74, y: y - 79, r: 28 }, { x: x + 74, y: y - 79, r: 28 },
    { x, y: y - 119, r: 50 },
  );
}

function addIslandTree(
  scene: Phaser.Scene,
  obstacles: { x: number; y: number; r: number }[],
  trees: MinecraftTreeInfo[],
  rng: () => number,
  x: number,
  y: number,
  scaleMul = 1,
): void {
  if (rng() < 0.24) {
    addPalm(scene, obstacles, trees, rng, x, y, scaleMul);
    return;
  }
  const kind = rng() < 0.58
    ? TEXTURES.jungleTree
    : TREE_TEXTURES[Math.floor(rng() * TREE_TEXTURES.length)];
  const scale = (0.82 + rng() * 0.28) * scaleMul;
  const isPine = kind === TEXTURES.pine;
  const originY = isPine ? 172 / 190 : 160 / 180;
  const sprite = scene.add
    .image(x, y, kind)
    .setOrigin(0.5, originY)
    .setScale(rng() > 0.5 ? -scale : scale, scale)
    .setDepth(y);
  obstacles.push({ x, y, r: TREE_TRUNK_R });
  trees.push({
    sprite,
    x,
    y,
    halfWidth: (kind === TEXTURES.jungleTree ? 58 : isPine ? 36 : 52) * scale,
    reach: (kind === TEXTURES.jungleTree ? 132 : isPine ? 150 : 120) * scale,
  });
}

function addPalm(scene: Phaser.Scene, obstacles: { x: number; y: number; r: number }[], trees: MinecraftTreeInfo[], rng: () => number, x: number, y: number, scaleMul = 1): void {
  const scale = (0.85 + rng() * 0.22) * scaleMul;
  const g = scene.add.graphics();
  const crownX = x - 8 * scale;
  const crownY = y - 94 * scale;
  // Curved blocky trunk with alternating highlights.
  for (let i = 0; i < 6; i += 1) {
    const tx = x - i * 2.3 * scale;
    const ty = y - (i + 1) * 15 * scale;
    g.fillStyle(i % 2 ? 0x82512e : 0xa66b38, 1).fillRect(tx, ty, 13 * scale, 16 * scale);
    g.fillStyle(0xc18a4e, 0.65).fillRect(tx + 2 * scale, ty + 2 * scale, 3 * scale, 11 * scale);
  }
  // Six broad fronds radiate from the crown, with stepped leaflet marks.
  const fronds = [-160, -112, -58, 6, 62, 118];
  for (let i = 0; i < fronds.length; i += 1) {
    const angle = Phaser.Math.DegToRad(fronds[i]);
    const len = (62 + (i % 2) * 12) * scale;
    const ex = crownX + Math.cos(angle) * len;
    const ey = crownY + Math.sin(angle) * len * 0.58 + 12 * scale;
    g.lineStyle(8 * scale, 0x315f2e, 1).lineBetween(crownX, crownY, ex, ey);
    g.lineStyle(5 * scale, i % 2 ? 0x62a83b : 0x4c9236, 1).lineBetween(crownX, crownY - 2 * scale, ex, ey - 2 * scale);
    for (let leaf = 1; leaf <= 5; leaf += 1) {
      const t = leaf / 6;
      const lx = crownX + (ex - crownX) * t;
      const ly = crownY + (ey - crownY) * t;
      const side = 17 * scale * (1 - t * 0.5);
      const nx = -Math.sin(angle) * side;
      const ny = Math.cos(angle) * side * 0.55;
      g.lineStyle(5 * scale, 0x4a8c32, 1).lineBetween(lx, ly, lx + nx, ly + ny);
      g.lineStyle(5 * scale, 0x4a8c32, 1).lineBetween(lx, ly, lx - nx, ly - ny);
    }
  }
  g.fillStyle(0x86c94a, 1).fillCircle(crownX, crownY, 8 * scale);
  g.setDepth(y);
  obstacles.push({ x, y, r: TREE_TRUNK_R * 0.85 });
  trees.push({ sprite: g, x, y, halfWidth: 86 * scale, reach: 142 * scale });
}

function addForest(
  scene: Phaser.Scene,
  obstacles: { x: number; y: number; r: number }[],
  trees: MinecraftTreeInfo[],
  rng: () => number,
): void {
  const { width, height } = MINECRAFT_CONFIG;
  const cell = 155;
  const paths = MINECRAFT_GROUND.pathPoints;
  const clearOfLandmarks = (x: number, y: number): boolean => {
    const landmarkZones = [
      { x: JUNGLE_CAMP.x, y: JUNGLE_CAMP.y, r: 300 }, // camp
      { x: 480, y: 410, r: 230 }, // temple
      { x: 730, y: 800, r: 150 }, // mine
      { x: 2040, y: 940, r: 230 }, // ruins
      { ...MINECRAFT_CONFIG.portal, r: 150 },
      { x: 1810, y: 370, r: 310 }, // waterfall and pond
    ];
    if (landmarkZones.some((z) => Math.hypot(x - z.x, y - z.y) < z.r)) return false;
    for (let i = 0; i < paths.length - 1; i += 1) {
      if (distanceToSegment(x, y, paths[i].x, paths[i].y, paths[i + 1].x, paths[i + 1].y) < 74) return false;
    }
    return true;
  };

  // Jittered grid gives the whole map a steady density without bunching props at the edges.
  for (let y = 110; y < height - 80; y += cell) {
    for (let x = 110; x < width - 80; x += cell) {
      const px = x + (rng() - 0.5) * 100;
      const py = y + (rng() - 0.5) * 100;
      if (!clearOfLandmarks(px, py) || groundTileKind(Math.floor(px / MINECRAFT_CONFIG.block), Math.floor(py / MINECRAFT_CONFIG.block)) === 'water') continue;
      if (rng() < 0.78) addIslandTree(scene, obstacles, trees, rng, px, py, 0.8 + rng() * 0.18);
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

/**
 * Three staggered rows of trunks turn the map edge into a continuous jungle wall.
 * The collision circles overlap after the player's radius is included, so there is
 * no gap that can be crossed along a side or through a corner.
 */
function addJungleBorder(
  scene: Phaser.Scene,
  obstacles: { x: number; y: number; r: number }[],
  trees: MinecraftTreeInfo[],
  rng: () => number,
): void {
  const { width, height } = MINECRAFT_CONFIG;
  const step = 46;
  const rows = [24, 62, 100];

  const borderTree = (x: number, y: number): void => {
    if (rng() < 0.34) addPalm(scene, obstacles, trees, rng, x, y, 1.02 + rng() * 0.16);
    else addIslandTree(scene, obstacles, trees, rng, x, y, 1.02 + rng() * 0.18);
    // Wider collision keeps the foliage wall solid even where the sprite trunk is narrow.
    obstacles.push({ x, y, r: 27 });
  };

  for (let i = 0; i < rows.length; i += 1) {
    const inset = rows[i];
    for (let x = 18; x <= width - 18; x += step) {
      borderTree(x + (i % 2 ? step / 2 : 0), inset);
      borderTree(x + (i % 2 ? 0 : step / 2), height - inset);
    }
    for (let y = 18 + step; y <= height - 18 - step; y += step) {
      borderTree(inset, y + (i % 2 ? step / 2 : 0));
      borderTree(width - inset, y + (i % 2 ? 0 : step / 2));
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

function addTemple(scene: Phaser.Scene, obstacles: { x: number; y: number; r: number }[], x: number, y: number): () => void {
  const g = scene.add.graphics();
  const block = (bx: number, by: number, w: number, h: number, tone = 0x858a7c): void => {
    g.fillStyle(0x344038, 0.72).fillRect(bx + 4, by + 5, w, h);
    g.fillStyle(tone, 1).fillRect(bx, by, w, h);
    g.fillStyle(0xc2c4a6, 0.3).fillRect(bx + 3, by + 3, w - 6, 4);
    g.lineStyle(2, 0x4a544b, 0.9).strokeRect(bx + 1, by + 1, w - 2, h - 2);
  };

  // Compact stepped jungle sanctuary: terraces rise to a small shrine rather than a cube.
  const left = x - 150;
  const baseY = y + 40;
  for (let row = 0; row < 3; row += 1) {
    const y0 = baseY - row * 44;
    const inset = row * 20;
    for (let col = 0; col < 7 - row; col += 1) {
      block(left + inset + col * 44, y0, 41, 38, (col + row) % 3 === 0 ? 0x767d71 : 0x909487);
    }
  }
  // Lower portico and its four stone columns.
  for (const dx of [-105, -58, 58, 105]) {
    block(x + dx - 13, y - 90, 26, 84, dx % 2 ? 0x788073 : 0x979a89);
    block(x + dx - 18, y - 102, 36, 15, 0xa7a990);
  }
  block(x - 132, y - 112, 264, 24, 0x70786c);
  block(x - 112, y - 132, 224, 22, 0x969988);

  // Upper terraces step inward; broken corners give it the ruins silhouette from the reference.
  for (let level = 0; level < 3; level += 1) {
    const y0 = y - 150 - level * 42;
    const half = 96 - level * 21;
    const bricks = Math.max(2, Math.floor((half * 2) / 38));
    for (let i = 0; i < bricks; i += 1) {
      if (level === 2 && i === bricks - 1) continue;
      block(x - half + i * 38, y0, 35, 35, (level + i) % 3 === 0 ? 0x6e766b : 0x929486);
    }
  }
  block(x - 38, y - 284, 76, 38, 0x777f72);
  block(x - 22, y - 314, 44, 33, 0x9b9b88);

  // Deep entrance, warm inner light, vines and moss over the old masonry.
  g.fillStyle(0x1d2922, 1).fillRoundedRect(x - 39, y - 84, 78, 84, 7);
  g.fillStyle(0xffa636, 0.18).fillCircle(x, y - 50, 38);
  g.fillStyle(0xf7bd4a, 1).fillRect(x - 7, y - 58, 14, 24);
  g.fillStyle(0xffefaa, 1).fillRect(x - 3, y - 55, 6, 15);
  const vines = [
    [x - 132, y - 168, 56], [x - 80, y - 152, 34],
    [x + 104, y - 160, 64], [x + 68, y - 238, 40],
  ] as const;
  for (const [vx, vy, vh] of vines) {
    g.lineStyle(5, 0x356c38, 1).lineBetween(vx, vy, vx + 8, vy + vh);
    for (let leaf = 9; leaf < vh; leaf += 15) {
      g.fillStyle(0x65a945, 1).fillCircle(vx + (leaf % 2 ? 5 : 10), vy + leaf, 6);
    }
  }
  for (const [mx, my] of [[x - 126, y - 125], [x + 105, y - 115], [x - 28, y - 273], [x + 36, y - 193]] as const) {
    g.fillStyle(0x4f873d, 0.95).fillRoundedRect(mx, my, 26, 8, 3);
  }
  // Stone stair: visual, but collision remains solid per the request.
  for (let step = 0; step < 3; step += 1) {
    block(x - 54 + step * 9, y + 42 + step * 14, 108 - step * 18, 13, step % 2 ? 0x777e72 : 0x969887);
  }
  g.setDepth(y + 180);

  // Full solid footprint: rows overlap well beyond player radius, including the sealed doorway.
  const templeBlockers: { x: number; y: number; r: number }[] = [];
  for (let cy = y - 326; cy <= y + 78; cy += 32) {
    for (let cx = x - 158; cx <= x + 158; cx += 32) {
      templeBlockers.push({ x: cx, y: cy, r: 23 });
    }
  }
  obstacles.push(...templeBlockers);

  const gate = scene.add.graphics();
  gate.fillStyle(0x39413a, 1).fillRect(x - 38, y - 86, 76, 88);
  gate.fillStyle(0x6f766b, 1).fillRect(x - 34, y - 82, 30, 80);
  gate.fillStyle(0x848879, 1).fillRect(x + 4, y - 82, 30, 80);
  gate.lineStyle(3, 0x303832, 1).lineBetween(x, y - 80, x, y - 4);
  gate.setDepth(y + 181);

  let opened = false;
  return () => {
    if (opened) return;
    opened = true;
    gate.destroy();
    for (const blocker of templeBlockers) {
      const isDoorway = Math.abs(blocker.x - x) <= 64 && blocker.y >= y - 110 && blocker.y <= y + 58;
      if (!isDoorway) continue;
      const index = obstacles.indexOf(blocker);
      if (index >= 0) obstacles.splice(index, 1);
    }
  };
}

function addWaterfall(scene: Phaser.Scene, obstacles: { x: number; y: number; r: number }[]): void {
  const g = scene.add.graphics();
  const stone = (x: number, y: number, w: number, h: number, tone: number): void => {
    g.fillStyle(0x26312c, 0.5).fillRect(x + 4, y + 5, w, h);
    g.fillStyle(tone, 1).fillRect(x, y, w, h);
    g.fillStyle(0xb0b4a4, 0.3).fillRect(x + 3, y + 3, w - 6, 6);
    g.lineStyle(2, 0x445047, 0.9).strokeRect(x + 1, y + 1, w - 2, h - 2);
  };
  const leaf = (x: number, y: number, size: number): void => {
    g.fillStyle(0x234f2b, 1).fillRect(x + 4, y + 5, size, size);
    g.fillStyle(0x3f823b, 1).fillRect(x, y, size, size);
    g.fillStyle(0x73b84c, 1).fillRect(x + 3, y + 3, size - 7, 7);
    g.lineStyle(2, 0x204828, 1).strokeRect(x + 1, y + 1, size - 2, size - 2);
  };

  // Staggered rock outcrop: an organic stepped cliff rather than a rectangular wall.
  const rocks: Array<[number, number, number, number, number]> = [
    [1698, 164, 50, 48, 0x6d766c], [1746, 134, 52, 52, 0x8b8e80],
    [1796, 118, 50, 56, 0x717a70], [1844, 130, 52, 48, 0x929588],
    [1892, 162, 48, 52, 0x6a746c], [1668, 210, 58, 56, 0x798176],
    [1722, 208, 52, 62, 0x8d9082], [1874, 208, 54, 58, 0x7a8277],
    [1922, 238, 46, 54, 0x69736a], [1694, 274, 48, 55, 0x717c70],
    [1904, 286, 55, 54, 0x858a7d], [1720, 324, 52, 48, 0x69736a],
    [1886, 342, 54, 44, 0x7a8277],
  ];
  for (const [rx, ry, rw, rh, tone] of rocks) stone(rx, ry, rw, rh, tone);

  // Tiered falling water: narrow at the lip, wider over the rocks, then foam at the pond.
  g.fillStyle(0x205b9b, 1).fillRect(1804, 164, 44, 58);
  g.fillStyle(0x3d91ce, 1).fillRect(1796, 212, 58, 92);
  g.fillStyle(0x4faee0, 1).fillRect(1804, 220, 18, 88);
  g.fillStyle(0x9ce4f4, 0.92).fillRect(1826, 220, 12, 78);
  g.fillStyle(0x2477ba, 1).fillRect(1782, 296, 86, 98);
  g.fillStyle(0x64c5e7, 1).fillRect(1794, 300, 22, 90);
  g.fillStyle(0xb7edf6, 0.86).fillRect(1822, 306, 16, 80);
  g.fillStyle(0x80d8ee, 0.82).fillRect(1760, 380, 132, 26);
  for (const [fx, fy, r] of [[1778, 399, 13], [1810, 408, 16], [1848, 399, 14], [1872, 415, 10]] as const) {
    g.fillStyle(0xd9f9ff, 0.85).fillCircle(fx, fy, r);
  }

  // Moss and blocky shrubs connect the waterfall with the jungle around it.
  for (const [lx, ly, size] of [[1668, 170, 38], [1714, 122, 42], [1858, 104, 44], [1906, 180, 38], [1652, 252, 42], [1934, 296, 36], [1682, 344, 34]] as const) {
    leaf(lx, ly, size);
  }
  for (const [mx, my, mw] of [[1710, 264, 34], [1886, 262, 38], [1730, 350, 31], [1900, 338, 30]] as const) {
    g.fillStyle(0x4f8b3e, 1).fillRoundedRect(mx, my, mw, 8, 3);
  }
  g.setDepth(410);

  // Water tiles already block the pond. These overlapping circles close the cliff and cascade.
  for (let cy = 150; cy <= 374; cy += 30) {
    for (let cx = 1692; cx <= 1956; cx += 30) {
      const inFall = cx >= 1774 && cx <= 1878;
      const inRock = cx < 1764 || cx > 1888 || cy < 210;
      if (inFall || inRock) obstacles.push({ x: cx, y: cy, r: 22 });
    }
  }
}

function addMine(
  scene: Phaser.Scene,
  obstacles: { x: number; y: number; r: number }[],
  x: number,
  y: number,
  b: number,
): void {
  const g = scene.add.graphics();
  const stone = (sx: number, sy: number, w: number, h: number, tone: number): void => {
    g.fillStyle(0x2e3632, 0.48).fillRect(sx + 4, sy + 5, w, h);
    g.fillStyle(tone, 1).fillRect(sx, sy, w, h);
    g.fillStyle(0xc1c0aa, 0.25).fillRect(sx + 3, sy + 3, w - 6, 5);
    g.lineStyle(2, 0x515850, 0.9).strokeRect(sx + 1, sy + 1, w - 2, h - 2);
  };
  // Irregular stone cutting in the hillside around a supported wooden tunnel.
  const rocks: Array<[number, number, number, number, number]> = [
    [-142, -85, 52, 42, 0x737b72], [-96, -112, 56, 45, 0x8d9084], [-42, -126, 54, 48, 0x707a71],
    [14, -119, 56, 44, 0x96978a], [68, -101, 52, 50, 0x717b72], [112, -67, 46, 54, 0x848a7f],
    [-162, -35, 55, 48, 0x868c80], [-126, 12, 48, 45, 0x6e776e], [98, 4, 58, 48, 0x8c9083],
    [-104, 59, 60, 36, 0x737d72], [52, 61, 62, 38, 0x767f75],
  ];
  for (const [dx, dy, w, h, tone] of rocks) stone(x + dx, y + dy, w, h, tone);

  // Timber support and black tunnel opening.
  g.fillStyle(0x272b28, 1).fillRect(x - 62, y - 72, 124, 130);
  g.fillStyle(0x18201d, 1).fillRect(x - 45, y - 54, 90, 112);
  g.fillStyle(0x55371f, 1).fillRect(x - 76, y - 95, 152, 22);
  g.fillStyle(0xa46b37, 1).fillRect(x - 70, y - 91, 140, 11);
  for (const dx of [-70, 54]) {
    g.fillStyle(0x4a301d, 1).fillRect(x + dx, y - 76, 18, 142);
    g.fillStyle(0xb1773d, 1).fillRect(x + dx + 4, y - 72, 7, 134);
  }
  // Rail bed points into the sealed tunnel but remains a walkable decoration in front.
  g.fillStyle(0x71695b, 1).fillRect(x - 44, y + 62, 88, 74);
  g.lineStyle(4, 0x4c5351, 1).lineBetween(x - 27, y + 126, x - 27, y - 4);
  g.lineStyle(4, 0x4c5351, 1).lineBetween(x + 27, y + 126, x + 27, y - 4);
  for (let railY = y + 8; railY < y + 126; railY += 19) {
    g.lineStyle(5, 0x8b6239, 1).lineBetween(x - 42, railY, x + 42, railY);
  }
  // Lantern beside the entrance.
  g.fillStyle(0x5d3b21, 1).fillRect(x + 91, y - 16, 11, 52);
  g.fillStyle(0xffac37, 0.28).fillCircle(x + 96, y - 26, 27);
  g.fillStyle(0x744727, 1).fillRect(x + 84, y - 42, 24, 22);
  g.fillStyle(0xffd66a, 1).fillRect(x + 90, y - 37, 12, 12);
  g.setDepth(y + 138);

  // Tunnel mouth and supporting hillside are solid; loose rails in front are intentionally walkable.
  for (let cy = y - 82; cy <= y + 52; cy += 30) {
    for (let cx = x - 142; cx <= x + 142; cx += 30) {
      if (Math.abs(cx - x) <= 48 || Math.abs(cx - x) >= 78 || cy < y - 50) {
        obstacles.push({ x: cx, y: cy, r: 22 });
      }
    }
  }
  obstacles.push({ x, y: y + 26, r: 48 }, { x: x + 96, y: y + 6, r: 24 });
  void b;
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
