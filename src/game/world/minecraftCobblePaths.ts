import Phaser from 'phaser';
import { createRng, PALETTE, type PathLine } from '../config/worldConfig';
import { MINECRAFT_CONFIG, MINECRAFT_GROUND } from '../config/minecraftWorldConfig';

/** Ширина каменной тропы (как на острове). */
const PATH_WIDTH = 104;

const DEPTH_PATH = -915;

type Rng = () => number;

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
  const half = PATH_WIDTH / 2;
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
  const half = PATH_WIDTH / 2;
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

/** Каменные тропинки острова вдоль маршрутов Minecraft-карты. */
export function bakeMinecraftCobblePaths(scene: Phaser.Scene): void {
  const path = MINECRAFT_GROUND.pathPoints as PathLine;
  const rng = createRng(MINECRAFT_CONFIG.seed + 4102);
  const ground = scene.add.graphics();
  const cobbles = scene.add.graphics();
  drawPathBed(ground, path);
  drawPathCobbles(cobbles, path, rng);

  const { width, height, bakeScale } = MINECRAFT_CONFIG;
  const maxSide = 4096;
  const scale = Math.min(bakeScale, maxSide / width, maxSide / height);
  const texture = scene.add
    .renderTexture(0, 0, Math.ceil(width * scale), Math.ceil(height * scale))
    .setOrigin(0, 0)
    .setScale(1 / scale)
    .setDepth(DEPTH_PATH);

  for (const layer of [ground, cobbles]) {
    layer.setScale(scale);
    texture.draw(layer);
    layer.destroy();
  }
}

export { PATH_WIDTH as MINECRAFT_PATH_WIDTH };