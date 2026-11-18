import Phaser from 'phaser';
import type { Obstacle } from '../config/worldConfig';
import { MAZE_CONFIG, MAZE_PALETTE } from '../config/mazeConfig';
import { MAZE_HAZARDS, MAZE_WALLS } from './mazeLayout';

export type MazeHazard = { kind: 'skeleton' | 'bush' | 'pool'; x: number; y: number; r: number; sprite: Phaser.GameObjects.Container };

/** Рисование и коллизионная геометрия карты разделены: данные стен не зависят от оформления. */
export function buildMazeWorld(scene: Phaser.Scene): { walls: Obstacle[]; hazards: MazeHazard[]; checkpoints: Phaser.GameObjects.Rectangle[]; castle: Phaser.GameObjects.Container } {
  const s = MAZE_CONFIG.scale;
  const g = scene.add.graphics().setDepth(-20);
  g.fillStyle(MAZE_PALETTE.floor, 1).fillRect(0, 0, MAZE_CONFIG.width, MAZE_CONFIG.height);
  const walls: Obstacle[] = [];
  for (const [x1, y1, x2, y2] of MAZE_WALLS) {
    const ax = x1 * s; const ay = y1 * s; const bx = x2 * s; const by = y2 * s;
    drawWall(g, ax, ay, bx, by);
    const length = Math.hypot(bx - ax, by - ay);
    for (let d = 0; d <= length; d += 16) walls.push({ x: Phaser.Math.Linear(ax, bx, d / Math.max(length, 1)), y: Phaser.Math.Linear(ay, by, d / Math.max(length, 1)), r: MAZE_CONFIG.wall / 2 });
  }
  const hazards: MazeHazard[] = [];
  for (const [x, y] of MAZE_HAZARDS.skeletons) hazards.push(makeSkeleton(scene, x * s, y * s));
  for (const [x, y] of MAZE_HAZARDS.bushes) hazards.push(makeBush(scene, x * s, y * s));
  hazards.push(makePool(scene, MAZE_HAZARDS.pool.x * s, MAZE_HAZARDS.pool.y * s, MAZE_HAZARDS.pool.width * s, MAZE_HAZARDS.pool.height * s));
  const checkpoints = MAZE_CONFIG.checkpoints.map((point, index) => scene.add.rectangle(point.x, point.y, 26, 26, 0x9bd5de, 0.32).setStrokeStyle(2, 0xdff8ff, 0.8).setDepth(2).setVisible(index === 0));
  const castle = makeCastle(scene, 120, 0);
  return { walls, hazards, checkpoints, castle };
}

function drawWall(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number): void {
  g.lineStyle(MAZE_CONFIG.wall + 6, 0x5e4a24, 1).lineBetween(x1, y1, x2, y2);
  g.lineStyle(MAZE_CONFIG.wall, MAZE_PALETTE.wallShade, 1).lineBetween(x1, y1, x2, y2);
  g.lineStyle(MAZE_CONFIG.wall - 6, MAZE_PALETTE.wall, 1).lineBetween(x1, y1, x2, y2);
  g.lineStyle(3, MAZE_PALETTE.wallLight, 0.9).lineBetween(x1, y1 - 3, x2, y2 - 3);
}
function hidden(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container { return scene.add.container(x, y).setDepth(4).setVisible(false); }
function makeSkeleton(scene: Phaser.Scene, x: number, y: number): MazeHazard {
  const sprite = hidden(scene, x, y); const g = scene.add.graphics();
  g.fillStyle(0x171827, 1).fillRect(-11, -18, 22, 36); g.fillStyle(0xf1f1e8, 1).fillRect(-7, -17, 14, 13).fillRect(-9, -2, 18, 8).fillRect(-10, 8, 7, 12).fillRect(3, 8, 7, 12); g.fillStyle(0x2b2d42, 1).fillRect(-4, -13, 3, 3).fillRect(2, -13, 3, 3); sprite.add(g); scene.tweens.add({ targets: sprite, y: y - 5, duration: 520, yoyo: true, repeat: -1 }); return { kind: 'skeleton', x, y, r: 23, sprite };
}
function makeBush(scene: Phaser.Scene, x: number, y: number): MazeHazard { const sprite = hidden(scene, x, y); const g = scene.add.graphics(); g.fillStyle(0x244c26, 1).fillRect(-26, -6, 52, 18); g.fillStyle(0x77b83e, 1).fillRect(-20, -16, 12, 18).fillRect(-4, -24, 12, 25).fillRect(12, -17, 12, 19); g.fillStyle(0xb8df58, 1).fillRect(-16, -12, 5, 6).fillRect(0, -19, 5, 7).fillRect(16, -13, 5, 6); sprite.add(g); return { kind: 'bush', x, y, r: 26, sprite }; }
function makePool(scene: Phaser.Scene, x: number, y: number, width: number, height: number): MazeHazard { const sprite = hidden(scene, x, y); const g = scene.add.graphics(); g.fillStyle(0x1d6fc0, 1).fillRoundedRect(-width/2, -height/2, width, height, 12); g.fillStyle(0x45c5f2, 1).fillRoundedRect(-width/2+12, -height/2+12, width-24, height-24, 9); g.fillStyle(0x1b4c9b, 1).fillRoundedRect(-width/2+35, -height/2+25, width-70, height-50, 8); sprite.add(g); return { kind: 'pool', x, y, r: Math.min(width, height) / 2, sprite }; }
function makeCastle(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container { const c = scene.add.container(x, y).setDepth(3); const g = scene.add.graphics(); g.fillStyle(0x33333e, 1).fillRect(-70, -90, 140, 100); g.fillStyle(0x5f6069, 1).fillRect(-82, -120, 30, 130).fillRect(52, -120, 30, 130); g.fillStyle(0x25252d, 1).fillRect(-18, -38, 36, 48); c.add(g); return c; }
