import Phaser from 'phaser';
import {
  MC_PALETTE,
  MINECRAFT_CONFIG,
} from '../config/minecraftWorldConfig';
const DEPTH = { ground: -900, props: 0, portal: -100 } as const;

export interface BuiltMinecraftWorld {
  obstacles: { x: number; y: number; r: number }[];
}

export function buildMinecraftWorld(scene: Phaser.Scene): BuiltMinecraftWorld {
  const obstacles: { x: number; y: number; r: number }[] = [];
  const { width, height, block } = MINECRAFT_CONFIG;
  const g = scene.add.graphics();

  drawGrassGrid(g, width, height, block);
  drawSandPatch(g, 720, 860, 9, 6, block);
  drawWater(g, 820, 920, 7, 4, block);
  drawPath(g);
  bakeGround(scene, g);

  addPortal(scene, MINECRAFT_CONFIG.portal.x, MINECRAFT_CONFIG.portal.y);
  addVillage(scene, obstacles, 620, 420, block);
  addForest(scene, obstacles, block);
  addMine(scene, obstacles, 1120, 740, block);
  addRuins(scene, obstacles, 1580, 380, block);
  addRocks(scene, obstacles, block);

  return { obstacles };
}

function drawGrassGrid(g: Phaser.GameObjects.Graphics, w: number, h: number, b: number): void {
  for (let y = 0; y < h; y += b) {
    for (let x = 0; x < w; x += b) {
      const alt = ((x / b) + (y / b)) % 2 === 0;
      g.fillStyle(alt ? MC_PALETTE.grassA : MC_PALETTE.grassB, 1);
      g.fillRect(x, y, b, b);
      g.lineStyle(2, 0x000000, 0.08);
      g.strokeRect(x + 1, y + 1, b - 2, b - 2);
    }
  }
}

function drawSandPatch(
  g: Phaser.GameObjects.Graphics,
  ox: number,
  oy: number,
  tw: number,
  th: number,
  b: number,
): void {
  for (let dy = 0; dy < th; dy += 1) {
    for (let dx = 0; dx < tw; dx += 1) {
      g.fillStyle(dx % 2 === dy % 2 ? MC_PALETTE.sand : 0xdcc98f, 1);
      g.fillRect(ox + dx * b, oy + dy * b, b, b);
      g.lineStyle(2, 0x000000, 0.1);
      g.strokeRect(ox + dx * b, oy + dy * b, b, b);
    }
  }
}

function drawWater(
  g: Phaser.GameObjects.Graphics,
  ox: number,
  oy: number,
  tw: number,
  th: number,
  b: number,
): void {
  for (let dy = 0; dy < th; dy += 1) {
    for (let dx = 0; dx < tw; dx += 1) {
      g.fillStyle((dx + dy) % 2 ? MC_PALETTE.water : MC_PALETTE.waterDeep, 1);
      g.fillRect(ox + dx * b, oy + dy * b, b, b);
    }
  }
}

function drawPath(g: Phaser.GameObjects.Graphics): void {
  const pts = [
    { x: 250, y: 650 },
    { x: 520, y: 640 },
    { x: 820, y: 700 },
    { x: 1080, y: 730 },
    { x: 1400, y: 580 },
    { x: 1580, y: 400 },
  ];
  const bw = MINECRAFT_CONFIG.block;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.ceil(len / (bw * 0.65));
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      g.fillStyle(MC_PALETTE.path, 1);
      g.fillRect(x - bw / 2, y - bw / 2, bw, bw);
    }
  }
}

function bakeGround(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics): void {
  const { width, height, bakeScale } = MINECRAFT_CONFIG;
  const scale = Math.min(bakeScale, 4096 / width, 4096 / height);
  const texture = scene.add
    .renderTexture(0, 0, Math.ceil(width * scale), Math.ceil(height * scale))
    .setOrigin(0, 0)
    .setScale(1 / scale)
    .setDepth(DEPTH.ground);
  g.setScale(scale);
  texture.draw(g);
  g.destroy();
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

function addBlockTree(
  scene: Phaser.Scene,
  obstacles: { x: number; y: number; r: number }[],
  x: number,
  y: number,
  scale = 1,
): void {
  const b = MINECRAFT_CONFIG.block * scale;
  const trunk = scene.add.rectangle(x, y, b * 0.7, b * 1.4, MC_PALETTE.wood).setStrokeStyle(3, MC_PALETTE.woodDark);
  const crown = scene.add.rectangle(x, y - b * 1.2, b * 1.8, b * 1.6, MC_PALETTE.leaves).setStrokeStyle(3, MC_PALETTE.leavesDark);
  trunk.setDepth(y);
  crown.setDepth(y - 1);
  obstacles.push({ x, y: y - b * 0.2, r: b * 0.75 });
}

function addForest(
  scene: Phaser.Scene,
  obstacles: { x: number; y: number; r: number }[],
  block: number,
): void {
  const points = [
    [180, 260], [260, 340], [340, 220], [420, 380], [220, 480],
    [1200, 180], [1320, 260], [1480, 220], [1400, 340],
    [520, 200], [880, 250],
  ];
  for (const [x, y] of points) addBlockTree(scene, obstacles, x, y, 0.9);
  for (let i = 0; i < 8; i += 1) {
    addBlockTree(scene, obstacles, 200 + (i % 4) * 120, 520 + Math.floor(i / 4) * 100, 0.85);
  }
  void block;
}

function addVillage(
  scene: Phaser.Scene,
  obstacles: { x: number; y: number; r: number }[],
  ox: number,
  oy: number,
  b: number,
): void {
  const houses = [
    { x: ox, y: oy, w: 4, h: 3 },
    { x: ox + 200, y: oy + 40, w: 3, h: 3 },
    { x: ox + 100, y: oy + 150, w: 5, h: 3 },
  ];
  for (const h of houses) {
    const baseX = h.x;
    const baseY = h.y;
    const gw = h.w * b;
    const gh = h.h * b;
    const walls = scene.add.rectangle(baseX + gw / 2, baseY + gh / 2, gw, gh, MC_PALETTE.plank);
    walls.setStrokeStyle(4, MC_PALETTE.woodDark);
    walls.setDepth(baseY + gh);
    const roof = scene.add.rectangle(baseX + gw / 2, baseY - b * 0.3, gw + b * 0.4, b * 0.8, MC_PALETTE.wood);
    roof.setStrokeStyle(3, MC_PALETTE.woodDark);
    roof.setDepth(baseY - 1);
    obstacles.push({ x: baseX + gw / 2, y: baseY + gh / 2, r: Math.max(gw, gh) * 0.38 });
    addBlockTree(scene, obstacles, baseX - b, baseY + gh + 20, 0.7);
  }
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
  b: number,
): void {
  const rocks: Array<[number, number]> = [
    [980, 520], [1040, 560], [1180, 620], [1320, 540], [1460, 640],
  ];
  for (const [x, y] of rocks) {
    scene.add.rectangle(x, y, b * 1.1, b * 0.9, MC_PALETTE.stone).setStrokeStyle(2, MC_PALETTE.stoneDark).setDepth(y);
    obstacles.push({ x, y, r: 22 });
  }
  const waterTiles: Array<[number, number]> = [];
  const ox = 820;
  const oy = 920;
  for (let dy = 0; dy < 4; dy += 1) {
    for (let dx = 0; dx < 7; dx += 1) {
      waterTiles.push([ox + dx * b + b / 2, oy + dy * b + b / 2]);
    }
  }
  for (const [x, y] of waterTiles) obstacles.push({ x, y, r: b * 0.48 });
}