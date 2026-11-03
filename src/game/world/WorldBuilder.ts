import Phaser from 'phaser';
import type { Point } from '../../network/types';
import {
  createRng,
  distToPaths,
  PALETTE,
  WORLD_CONFIG,
  type Obstacle,
  type PathLine,
} from '../config/worldConfig';
import { TEXTURES } from '../scenes/PreloadScene';

type Rng = () => number;

const DEPTH = {
  grass: -1000,
  ground: -900,
  groundDetail: -880,
  portalGlow: -700,
  portalFlat: -690,
  effects: 100_000,
} as const;

/** Результат построения мира. */
export interface BuiltWorld {
  obstacles: Obstacle[];
  trees: TreeInfo[];
}

/** Дерево, крона которого может скрывать игрока (для полупрозрачности). */
export interface TreeInfo {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  /** Половина ширины кроны. */
  halfWidth: number;
  /** На сколько единиц вверх от основания простирается крона. */
  reach: number;
}

/**
 * Строит тестовую локацию из программной графики:
 * трава, каменные дорожки, центральная площадка с порталом, деревья, руины, светлячки.
 * Возвращает список круглых препятствий для простых столкновений.
 */
export function buildWorld(scene: Phaser.Scene): BuiltWorld {
  const rng = createRng(WORLD_CONFIG.seed);
  const obstacles: Obstacle[] = [];

  addGrass(scene);
  // Земля состоит из тысяч фигур (булыжники, цветы...). Phaser Graphics пересчитывает их КАЖДЫЙ кадр,
  // что сильно роняет FPS на телефонах. Поэтому рисуем один раз и «запекаем» в текстуру.
  const ground = scene.add.graphics();
  const detail = scene.add.graphics();
  const shade = scene.add.graphics();

  for (const path of WORLD_CONFIG.paths) drawPathBed(ground, path);
  for (const path of WORLD_CONFIG.paths) drawPathCobbles(ground, path, rng);
  drawPlaza(ground, detail, rng);
  drawGroundDetails(detail, rng);
  drawForestShade(shade);
  bakeGround(scene, [ground, detail, shade]);

  addRuins(scene, rng, obstacles);
  addRuneStones(scene, obstacles);
  const trees = addTrees(scene, rng, obstacles);
  addPortal(scene, obstacles);
  addFireflies(scene, rng);

  return { obstacles, trees };
}

// ------------------------------------------------------------------ земля

function addGrass(scene: Phaser.Scene): void {
  scene.add
    .tileSprite(0, 0, WORLD_CONFIG.width, WORLD_CONFIG.height, TEXTURES.grass)
    .setOrigin(0, 0)
    .setDepth(DEPTH.grass);
}

/**
 * Рисует слои земли в одну текстуру (RenderTexture) и уничтожает исходные Graphics.
 * Масштаб запекания > 1 сохраняет чёткость при приближении камеры на телефонах.
 */
function bakeGround(scene: Phaser.Scene, layers: Phaser.GameObjects.Graphics[]): void {
  const { width, height, bakeScale } = WORLD_CONFIG;
  const maxSide = 4096; // безопасный предел размера текстуры на мобильных GPU
  const scale = Math.min(bakeScale, maxSide / width, maxSide / height);

  const texture = scene.add
    .renderTexture(0, 0, Math.ceil(width * scale), Math.ceil(height * scale))
    .setOrigin(0, 0)
    .setScale(1 / scale)
    .setDepth(DEPTH.ground);

  for (const layer of layers) {
    layer.setScale(scale);
    texture.draw(layer);
    layer.destroy();
  }
}

function samplePath(path: PathLine, step: number): Array<{ x: number; y: number; nx: number; ny: number }> {
  const result: Array<{ x: number; y: number; nx: number; ny: number }> = [];
  for (let i = 0; i < path.length - 1; i += 1) {
    const a = path[i];
    const b = path[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const dx = (b.x - a.x) / len;
    const dy = (b.y - a.y) / len;
    for (let d = 0; d < len; d += step) {
      result.push({ x: a.x + dx * d, y: a.y + dy * d, nx: -dy, ny: dx });
    }
  }
  const last = path[path.length - 1];
  const prev = path[path.length - 2];
  const len = Math.hypot(last.x - prev.x, last.y - prev.y);
  result.push({ x: last.x, y: last.y, nx: -(last.y - prev.y) / len, ny: (last.x - prev.x) / len });
  return result;
}

function drawPathBed(g: Phaser.GameObjects.Graphics, path: PathLine): void {
  const half = WORLD_CONFIG.pathWidth / 2;
  for (const p of samplePath(path, 14)) {
    g.fillStyle(0x3b4a38, 1);
    g.fillCircle(p.x, p.y, half + 8);
  }
  for (const p of samplePath(path, 14)) {
    g.fillStyle(0x56654f, 1);
    g.fillCircle(p.x, p.y, half + 2);
  }
}

function drawPathCobbles(g: Phaser.GameObjects.Graphics, path: PathLine, rng: Rng): void {
  const half = WORLD_CONFIG.pathWidth / 2;
  const shades = [PALETTE.stoneDark, PALETTE.stoneMid, 0x6c7480, PALETTE.stoneLight];

  for (const p of samplePath(path, 21)) {
    for (let off = -half + 10; off <= half - 6; off += 22) {
      const jitterAlong = (rng() - 0.5) * 8;
      const jitterAcross = (rng() - 0.5) * 7;
      const cx = p.x + p.nx * (off + jitterAcross) - p.ny * jitterAlong;
      const cy = p.y + p.ny * (off + jitterAcross) + p.nx * jitterAlong;
      const w = 15 + rng() * 9;
      const h = 13 + rng() * 8;
      const color = shades[Math.floor(rng() * shades.length)];

      g.fillStyle(0x2d3640, 0.6);
      g.fillRoundedRect(cx - w / 2 + 1, cy - h / 2 + 2, w, h, 4);
      g.fillStyle(color, 1);
      g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 4);
      g.fillStyle(0xffffff, 0.1);
      g.fillRoundedRect(cx - w / 2 + 2, cy - h / 2 + 1, w * 0.55, 3, 1.5);
      if (rng() < 0.08) {
        g.fillStyle(PALETTE.moss, 0.85);
        g.fillCircle(cx + (rng() - 0.5) * w, cy + (rng() - 0.5) * h, 3.5);
      }
    }
  }
}

function drawPlaza(ground: Phaser.GameObjects.Graphics, detail: Phaser.GameObjects.Graphics, rng: Rng): void {
  const { x, y, radius } = WORLD_CONFIG.plaza;

  ground.fillStyle(0x2c3a2f, 1);
  ground.fillCircle(x, y, radius + 14);
  ground.fillStyle(PALETTE.stoneDark, 1);
  ground.fillCircle(x, y, radius + 4);
  ground.fillStyle(0x6a727d, 1);
  ground.fillCircle(x, y, radius - 6);

  // кольцами выкладываем плиты
  const rings = [
    { r0: 150, r1: radius - 12, count: 28 },
    { r0: 92, r1: 150, count: 18 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i += 1) {
      const a0 = (i / ring.count) * Math.PI * 2;
      const a1 = ((i + 1) / ring.count) * Math.PI * 2;
      const shade = [PALETTE.stoneMid, 0x727a85, 0x848c97][Math.floor(rng() * 3)];
      detail.fillStyle(shade, 1);
      detail.beginPath();
      detail.arc(x, y, ring.r1 - 2, a0 + 0.012, a1 - 0.012);
      detail.arc(x, y, ring.r0 + 2, a1 - 0.012, a0 + 0.012, true);
      detail.closePath();
      detail.fillPath();
    }
  }

  detail.fillStyle(0x4d555f, 1);
  detail.fillCircle(x, y, 92);
  detail.fillStyle(0x333a43, 1);
  detail.fillCircle(x, y, 78);

  // магическое кольцо рун
  detail.lineStyle(3, PALETTE.glowCyan, 0.55);
  detail.strokeCircle(x, y, 132);
  detail.lineStyle(2, PALETTE.glowViolet, 0.5);
  detail.strokeCircle(x, y, 176);
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    const cx = x + Math.cos(a) * 154;
    const cy = y + Math.sin(a) * 154;
    detail.lineStyle(3, PALETTE.glowCyan, 0.8);
    detail.lineBetween(cx, cy - 6, cx, cy + 6);
    detail.lineBetween(cx - 5, cy, cx, cy - 6);
    detail.lineBetween(cx + 5, cy, cx, cy - 6);
  }
}

function drawGroundDetails(g: Phaser.GameObjects.Graphics, rng: Rng): void {
  const { width, height, decor } = WORLD_CONFIG;
  const plaza = WORLD_CONFIG.plaza;
  const free = (p: Point, pathClear: number): boolean =>
    Math.hypot(p.x - plaza.x, p.y - plaza.y) > plaza.radius + 24 && distToPaths(p) > pathClear;

  for (let i = 0; i < decor.grassTuftCount; i += 1) {
    const p = { x: 40 + rng() * (width - 80), y: 40 + rng() * (height - 80) };
    if (!free(p, WORLD_CONFIG.pathWidth / 2 + 10)) continue;
    g.lineStyle(2, rng() > 0.5 ? 0x4c8a58 : 0x1d4128, 0.9);
    g.lineBetween(p.x, p.y, p.x - 4, p.y - 9);
    g.lineBetween(p.x, p.y, p.x, p.y - 11);
    g.lineBetween(p.x, p.y, p.x + 4, p.y - 8);
  }

  const petals = [0xffffff, 0xffd166, 0xff8fb1, 0xb18cff, 0x7ae7ff];
  for (let i = 0; i < decor.flowerCount; i += 1) {
    const p = { x: 40 + rng() * (width - 80), y: 40 + rng() * (height - 80) };
    if (!free(p, WORLD_CONFIG.pathWidth / 2 + 14)) continue;
    const petal = petals[Math.floor(rng() * petals.length)];
    g.fillStyle(petal, 0.95);
    for (let k = 0; k < 4; k += 1) {
      const a = (k / 4) * Math.PI * 2;
      g.fillCircle(p.x + Math.cos(a) * 2.6, p.y + Math.sin(a) * 2.6, 2);
    }
    g.fillStyle(0xf4b942, 1);
    g.fillCircle(p.x, p.y, 1.6);
  }
}

/** Затемнение к краям мира — лес сгущается. */
function drawForestShade(g: Phaser.GameObjects.Graphics): void {
  const { width, height } = WORLD_CONFIG;
  const bands = 8;
  const thickness = 18;
  for (let i = 0; i < bands; i += 1) {
    const inset = i * thickness;
    g.fillStyle(0x08140d, 0.1);
    g.fillRect(0, inset, width, thickness); // верх
    g.fillRect(0, height - inset - thickness, width, thickness); // низ
    g.fillRect(inset, 0, thickness, height); // лево
    g.fillRect(width - inset - thickness, 0, thickness, height); // право
  }
}

// ------------------------------------------------------------------ деревья

function addTrees(scene: Phaser.Scene, rng: Rng, obstacles: Obstacle[]): TreeInfo[] {
  const { width, height, decor, plaza, ruins } = WORLD_CONFIG;
  const placed: Point[] = [];
  const trees: TreeInfo[] = [];
  const kinds = [TEXTURES.treeA, TEXTURES.treeB, TEXTURES.pine];

  const place = (x: number, y: number, withCollision: boolean): void => {
    const kind = kinds[Math.floor(rng() * kinds.length)];
    const scale = 0.9 + rng() * 0.3;
    const isPine = kind === TEXTURES.pine;
    const originY = isPine ? 172 / 190 : 160 / 180;
    const sprite = scene.add
      .image(x, y, kind)
      .setOrigin(0.5, originY)
      .setScale(rng() > 0.5 ? -scale : scale, scale)
      .setDepth(y);
    trees.push({
      sprite,
      x,
      y,
      halfWidth: (isPine ? 36 : 52) * scale,
      reach: (isPine ? 150 : 120) * scale,
    });
    placed.push({ x, y });
    if (withCollision) obstacles.push({ x, y, r: decor.treeTrunkRadius });
  };

  const allowed = (p: Point, pathClear: number): boolean => {
    if (Math.hypot(p.x - plaza.x, p.y - plaza.y) < decor.clearancePlaza) return false;
    if (distToPaths(p) < pathClear) return false;
    return ruins.every((r) => Math.hypot(p.x - r.x, p.y - r.y) > decor.clearanceRuin);
  };

  // Густая рамка по краям мира.
  const spacing = decor.borderTreeSpacing;
  for (let row = 0; row < 2; row += 1) {
    const inset = 34 + row * 46;
    const offset = row * (spacing / 2);
    for (let x = offset; x < width + spacing; x += spacing) {
      for (const y of [inset + 40, height - inset + 20]) {
        const p = { x: x + (rng() - 0.5) * 22, y: y + (rng() - 0.5) * 16 };
        if (distToPaths(p) < 80) continue;
        place(p.x, p.y, true);
      }
    }
    for (let y = offset + spacing; y < height - spacing; y += spacing) {
      for (const x of [inset, width - inset]) {
        const p = { x: x + (rng() - 0.5) * 16, y: y + (rng() - 0.5) * 22 };
        if (distToPaths(p) < 80) continue;
        place(p.x, p.y, true);
      }
    }
  }

  // Рассеянные деревья внутри мира.
  let attempts = 0;
  let count = 0;
  while (count < decor.innerTreeCount && attempts < 4000) {
    attempts += 1;
    const p = { x: 200 + rng() * (width - 400), y: 200 + rng() * (height - 400) };
    if (!allowed(p, decor.clearancePath)) continue;
    if (placed.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < decor.innerTreeMinDistance)) continue;
    place(p.x, p.y, true);
    count += 1;
  }

  // Кусты с цветами.
  for (let i = 0; i < 26; i += 1) {
    const p = { x: 140 + rng() * (width - 280), y: 140 + rng() * (height - 280) };
    if (!allowed(p, 74)) continue;
    scene.add.image(p.x, p.y, TEXTURES.bush).setOrigin(0.5, 0.75).setDepth(p.y);
  }

  return trees;
}

// ------------------------------------------------------------------ руины

function addRuins(scene: Phaser.Scene, rng: Rng, obstacles: Obstacle[]): void {
  const pillar = (x: number, y: number, broken: boolean): void => {
    scene.add
      .image(x, y, broken ? TEXTURES.pillarBroken : TEXTURES.pillar)
      .setOrigin(0.5, broken ? 0.76 : 0.83)
      .setDepth(y);
    obstacles.push({ x, y, r: 17 });
  };
  const wall = (x: number, y: number): void => {
    scene.add.image(x, y, TEXTURES.wall).setOrigin(0.5, 0.73).setDepth(y);
    for (const dx of [-62, 0, 62]) obstacles.push({ x: x + dx, y, r: 24 });
  };
  const rubble = (x: number, y: number): void => {
    scene.add
      .image(x, y, TEXTURES.rubble)
      .setOrigin(0.5, 0.68)
      .setScale(0.8 + rng() * 0.5)
      .setDepth(y);
  };
  const runeStone = (x: number, y: number): void => {
    addRuneStoneSprite(scene, x, y);
    obstacles.push({ x, y, r: 18 });
  };

  // Северо-западные руины: круг колонн.
  const nw = WORLD_CONFIG.ruins[0];
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const x = nw.x + Math.cos(a) * 135;
    const y = nw.y + Math.sin(a) * 105;
    // проход со стороны дорожки (юго-восток) оставляем свободным
    if (Math.cos(a) > 0.35 && Math.sin(a) > 0.35) continue;
    pillar(x, y, i % 3 === 1);
  }
  wall(nw.x - 40, nw.y - 190);
  runeStone(nw.x, nw.y - 10);
  for (let i = 0; i < 6; i += 1) {
    rubble(nw.x + (rng() - 0.5) * 340, nw.y + (rng() - 0.5) * 260);
  }

  // Юго-восточные руины: колоннада и остатки стен.
  const se = WORLD_CONFIG.ruins[1];
  for (let i = 0; i < 5; i += 1) {
    pillar(se.x - 200 + i * 100, se.y - 60, i === 1 || i === 3);
  }
  wall(se.x - 80, se.y - 150);
  wall(se.x + 130, se.y + 110);
  runeStone(se.x - 10, se.y + 30);
  for (let i = 0; i < 7; i += 1) {
    rubble(se.x + (rng() - 0.5) * 420, se.y + (rng() - 0.5) * 260);
  }
}

function addRuneStoneSprite(scene: Phaser.Scene, x: number, y: number): void {
  const glow = scene.add
    .image(x, y - 44, TEXTURES.glow)
    .setScale(0.9)
    .setTint(PALETTE.glowCyan)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(0.35)
    .setDepth(y - 1);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.2, to: 0.5 },
    duration: 1600 + Math.random() * 800,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.inOut',
  });
  scene.add.image(x, y, TEXTURES.runeStone).setOrigin(0.5, 0.8).setDepth(y);
}

/** Четыре рунических камня вокруг площадки. */
function addRuneStones(scene: Phaser.Scene, obstacles: Obstacle[]): void {
  const { x, y } = WORLD_CONFIG.plaza;
  const radius = WORLD_CONFIG.plaza.radius + 40;
  for (let i = 0; i < 4; i += 1) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    addRuneStoneSprite(scene, px, py);
    obstacles.push({ x: px, y: py, r: 18 });
  }
}

// ------------------------------------------------------------------ портал

function addPortal(scene: Phaser.Scene, obstacles: Obstacle[]): void {
  const { x, y, collisionRadius } = WORLD_CONFIG.portal;
  obstacles.push({ x, y, r: collisionRadius });

  const halo = scene.add
    .image(x, y, TEXTURES.glow)
    .setScale(3.2)
    .setTint(PALETTE.glowViolet)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(0.45)
    .setDepth(DEPTH.portalGlow);
  scene.tweens.add({
    targets: halo,
    scale: { from: 2.9, to: 3.5 },
    alpha: { from: 0.32, to: 0.55 },
    duration: 2200,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.inOut',
  });

  const core = scene.add
    .image(x, y, TEXTURES.portalCore)
    .setScale(0.62)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(DEPTH.portalFlat);
  scene.tweens.add({
    targets: core,
    scale: { from: 0.55, to: 0.7 },
    duration: 1500,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.inOut',
  });

  const ring1 = scene.add.image(x, y, TEXTURES.portalRing).setScale(0.68).setDepth(DEPTH.portalFlat + 1);
  const ring2 = scene.add
    .image(x, y, TEXTURES.portalRing2)
    .setScale(0.78)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(DEPTH.portalFlat + 2);
  scene.tweens.add({ targets: ring1, angle: 360, duration: 26000, repeat: -1 });
  scene.tweens.add({ targets: ring2, angle: -360, duration: 14000, repeat: -1 });

  // искры, поднимающиеся над порталом
  for (let i = 0; i < 14; i += 1) {
    const mote = scene.add
      .image(x, y, TEXTURES.glow)
      .setScale(0.06 + Math.random() * 0.05)
      .setTint(i % 2 === 0 ? PALETTE.glowCyan : PALETTE.glowViolet)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.effects);
    const startX = x + (Math.random() - 0.5) * 90;
    scene.tweens.add({
      targets: mote,
      x: { from: startX, to: startX + (Math.random() - 0.5) * 50 },
      y: { from: y + 20, to: y - 130 - Math.random() * 60 },
      alpha: { from: 0.9, to: 0 },
      duration: 2200 + Math.random() * 1800,
      delay: Math.random() * 3000,
      repeat: -1,
    });
  }
}

function addFireflies(scene: Phaser.Scene, rng: Rng): void {
  const { width, height, decor, plaza } = WORLD_CONFIG;
  for (let i = 0; i < decor.fireflyCount; i += 1) {
    const nearPortal = i % 3 === 0;
    const a = rng() * Math.PI * 2;
    const r = 120 + rng() * 480;
    const x = nearPortal ? plaza.x + Math.cos(a) * r : 120 + rng() * (width - 240);
    const y = nearPortal ? plaza.y + Math.sin(a) * r * 0.7 : 120 + rng() * (height - 240);

    const fly = scene.add
      .image(x, y, TEXTURES.glow)
      .setScale(0.07 + rng() * 0.05)
      .setTint(PALETTE.glowGold)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.2)
      .setDepth(DEPTH.effects);
    scene.tweens.add({
      targets: fly,
      x: x + (rng() - 0.5) * 120,
      y: y + (rng() - 0.5) * 90,
      duration: 3000 + rng() * 3500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
      delay: rng() * 2000,
    });
    scene.tweens.add({
      targets: fly,
      alpha: { from: 0.1, to: 0.95 },
      duration: 900 + rng() * 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
      delay: rng() * 1500,
    });
  }
}
