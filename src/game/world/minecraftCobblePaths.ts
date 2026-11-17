import Phaser from 'phaser';
import { createRng, type PathLine } from '../config/worldConfig';
import { MINECRAFT_CONFIG, MINECRAFT_GROUND } from '../config/minecraftWorldConfig';

/** Узкая песчаная тропинка. */
const PATH_WIDTH = 58;

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
    g.fillStyle(0x8b6a3a, 0.8);
    g.fillCircle(p.x, p.y, half + 5);
  }
  for (const p of samplePath(path, 14)) {
    g.fillStyle(0xc7a76c, 1);
    g.fillCircle(p.x, p.y, half);
  }
}

function drawSandMarks(g: Phaser.GameObjects.Graphics, path: PathLine, rng: Rng): void {
  const half = PATH_WIDTH / 2;
  for (const p of samplePath(path, 17)) {
    for (let off = -half + 5; off <= half - 3; off += 13) {
      const along = (rng() - 0.5) * 14;
      const across = (rng() - 0.5) * 8;
      const cx = p.x + p.nx * (off + across) - p.ny * along;
      const cy = p.y + p.ny * (off + across) + p.nx * along;
      g.fillStyle(rng() < 0.5 ? 0xe0c68e : 0xb9975b, 0.55);
      g.fillRect(cx, cy, 3 + rng() * 3, 2 + rng() * 2);
    }
  }
}

/** Песчаная тропинка вдоль маршрута второй локации. */
export function bakeMinecraftCobblePaths(scene: Phaser.Scene): void {
  const path = MINECRAFT_GROUND.pathPoints as PathLine;
  const rng = createRng(MINECRAFT_CONFIG.seed + 4102);
  const ground = scene.add.graphics();
  drawPathBed(ground, path);
  drawSandMarks(ground, path, rng);

  const { width, height, bakeScale } = MINECRAFT_CONFIG;
  const maxSide = 4096;
  const scale = Math.min(bakeScale, maxSide / width, maxSide / height);
  const texture = scene.add
    .renderTexture(0, 0, Math.ceil(width * scale), Math.ceil(height * scale))
    .setOrigin(0, 0)
    .setScale(1 / scale)
    .setDepth(DEPTH_PATH);

  ground.setScale(scale);
  texture.draw(ground);
  ground.destroy();
}

export { PATH_WIDTH as MINECRAFT_PATH_WIDTH };
