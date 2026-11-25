import type Phaser from 'phaser';
import type { Point } from '../../network/types';
import { CASTLE_CHEST } from '../config/castleConfig';

const CENTER = CASTLE_CHEST.x;
const MOUTH_Y = 312;
const BANKS = [
  { y: MOUTH_Y, halfWidth: 13 }, { y: 357, halfWidth: 48 },
  { y: 402, halfWidth: 81 }, { y: 429, halfWidth: 107 },
  { y: 460, halfWidth: 123 }, { y: 491, halfWidth: 108 },
  { y: 515, halfWidth: 74 }, { y: 527, halfWidth: 0 },
] as const;
const EDGE = [
  ...BANKS.map(({ y, halfWidth }) => ({ x: CENTER - halfWidth, y })),
  ...BANKS.slice(0, -1).reverse().map(({ y, halfWidth }) => ({ x: CENTER + halfWidth, y })),
];
const FLAME_COLORS = [0xef5422, 0xffa031, 0xffdc73];

function fireWidth(y: number): number {
  for (let i = 1; i < BANKS.length; i += 1) {
    const from = BANKS[i - 1];
    const to = BANKS[i];
    if (y <= to.y) return from.halfWidth + (to.halfWidth - from.halfWidth) * (y - from.y) / (to.y - from.y);
  }
  return 0;
}

export function castleFireHits({ x, y }: Point, radius: number): boolean {
  if (y >= MOUTH_Y && Math.abs(x - CENTER) < fireWidth(y)) return true;
  const radiusSquared = radius * radius;
  for (let i = 0; i < EDGE.length; i += 1) {
    const a = EDGE[i];
    const b = EDGE[(i + 1) % EDGE.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
    if ((x - a.x - t * dx) ** 2 + (y - a.y - t * dy) ** 2 < radiusSquared) return true;
  }
  return false;
}

export function buildCastleFire(scene: Phaser.Scene, glowTexture: string) {
  const light = scene.add.image(CENTER, 432, glowTexture).setDepth(0).setScale(3.25, 2.72);
  const flame = scene.add.graphics().setDepth(CASTLE_CHEST.y - 1);
  let nextDraw = 0;
  function draw(time: number): void {
    flame.clear();
    flame.fillStyle(0xa02325, 0.79).fillPoints(EDGE, true);
    flame.lineStyle(2, 0xf4783a, 0.46).strokePoints(EDGE, true);
    const phase = time / 125;
    for (let layer = 0; layer < 3; layer += 1) {
      const widthScale = 0.95 - layer * 0.24;
      const length = 209 - layer * 35 + Math.sin(phase + layer) * 8;
      const left: Point[] = [];
      const right: Point[] = [];
      for (let i = 0; i <= 24; i += 1) {
        const progress = i / 24;
        const y = MOUTH_Y + length * progress;
        const width = fireWidth(y) * widthScale * Math.min(1, (1 - progress) * 7);
        const wiggle = Math.sin(progress * 12 - phase + layer) * Math.min(progress * 13, width * 0.13);
        left.push({ x: CENTER + wiggle - width * (0.86 + Math.sin(progress * 21 - phase) * 0.12), y });
        right.push({ x: CENTER + wiggle + width * (0.86 + Math.cos(progress * 19 - phase) * 0.12), y });
      }
      flame.fillStyle(FLAME_COLORS[layer], 0.86).fillPoints([...left, ...right.reverse()], true);
    }
    for (let i = 0; i < 11; i += 1) {
      const progress = (time / (560 + i * 61) + i * 0.29) % 1;
      const y = MOUTH_Y + progress * 190;
      const x = CENTER + fireWidth(y) * Math.sin(i * 1.9 + progress * 1.6) * 0.75;
      const tail = Math.min(y - MOUTH_Y, 16 + i % 4 * 6);
      const drift = (x - CENTER) * 0.32;
      flame.fillStyle(i % 3 === 0 ? 0xffe58f : 0xff8c3e, (1 - progress) * 0.73).fillPoints([
        { x: x - drift, y: y - tail }, { x: x + 4 - drift / 3, y: y - tail / 2 },
        { x, y }, { x: x - 5, y: y - tail / 2 },
      ], true);
    }
    for (let i = 0; i < 17; i += 1) {
      const path = (time / (920 + i * 39) + i * 0.37) % 1;
      const y = MOUTH_Y + path * 207;
      const x = CENTER + fireWidth(y) * Math.sin(i * 2.1 + path * 3.1) * 0.89;
      const size = 1 + i % 3;
      flame.fillStyle(i % 3 === 0 ? 0xffffff : 0xffd15e, 1 - path * 0.7).fillRect(x, y, size, size + 2);
    }
    light.setAlpha(0.82 + Math.sin(phase * 0.4) * 0.13);
  }
  draw(0);
  return {
    update(time: number): void {
      if (!flame.visible || time < nextDraw) return;
      nextDraw = time + 33;
      draw(time);
    },
    extinguish(): void {
      flame.setVisible(false);
      light.setVisible(false);
    },
  };
}
