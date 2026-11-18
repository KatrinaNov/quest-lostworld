import type Phaser from 'phaser';

export const ISLAND_DOOR_ART = { width: 160, height: 154, resolution: 2 } as const;

const CENTER = 80;
const SPRING = 76;
const THRESHOLD = 136;
const INNER_RADIUS = 45;
const OUTER_RADIUS = 64;

/** Two door states baked once, in the same palette and projection as the island ruins. */
export function createIslandDoorTexture(scene: Phaser.Scene, key: string, open: boolean): void {
  if (scene.textures.exists(key)) return;
  const { width, height, resolution } = ISLAND_DOOR_ART;
  const texture = scene.textures.createCanvas(key, width * resolution, height * resolution);
  if (!texture) return;

  const ctx = texture.context;
  ctx.save();
  ctx.scale(resolution, resolution);
  paintDoor(ctx, open);
  ctx.restore();
  texture.refresh();
}

function archPath(ctx: CanvasRenderingContext2D, radius: number, bottom: number): void {
  ctx.beginPath();
  ctx.moveTo(CENTER - radius, bottom);
  ctx.lineTo(CENTER - radius, SPRING);
  ctx.arc(CENTER, SPRING, radius, Math.PI, 2 * Math.PI);
  ctx.lineTo(CENTER + radius, bottom);
  ctx.closePath();
}

function paintDoor(ctx: CanvasRenderingContext2D, open: boolean): void {
  ctx.fillStyle = '#0e271b66';
  ctx.beginPath();
  ctx.ellipse(CENTER, 142, 73, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  archPath(ctx, OUTER_RADIUS + 3, THRESHOLD);
  ctx.fillStyle = '#424b51';
  ctx.fill();
  archPath(ctx, INNER_RADIUS + 3, THRESHOLD);
  ctx.fillStyle = '#2c3534';
  ctx.fill();

  ctx.save();
  archPath(ctx, INNER_RADIUS, THRESHOLD);
  ctx.clip();
  if (open) paintPortal(ctx);
  else paintWood(ctx);
  ctx.restore();

  paintMasonry(ctx);
  paintStone(ctx, 13, THRESHOLD - 5, 134, 12, '#69727c');
  paintStone(ctx, 8, THRESHOLD + 5, 144, 10, '#59606a');
  paintMoss(ctx, 24, 64, -1);
  paintMoss(ctx, 114, 27, 1);
  paintMoss(ctx, 129, 116, 1);
  paintMoss(ctx, 22, 131, -1);
}

function paintMasonry(ctx: CanvasRenderingContext2D): void {
  const stones = ['#737c86', '#818a92', '#6c7680', '#939aa0'];
  for (const [side, x] of [16, 125].entries()) {
    for (let row = 0; row < 3; row += 1) {
      paintStone(ctx, x, SPRING + row * 19, 19, 18, stones[(row + side) % stones.length]);
    }
  }

  const count = 9;
  for (let i = 0; i < count; i += 1) {
    const a = Math.PI + i * Math.PI / count + 0.018;
    const b = Math.PI + (i + 1) * Math.PI / count - 0.018;
    const inner = INNER_RADIUS + 1;
    ctx.beginPath();
    ctx.arc(CENTER, SPRING, OUTER_RADIUS, a, b);
    ctx.arc(CENTER, SPRING, inner, b, a, true);
    ctx.closePath();
    ctx.fillStyle = stones[i === 4 ? 3 : i % 3];
    ctx.fill();

    ctx.beginPath();
    ctx.arc(CENTER, SPRING, OUTER_RADIUS - 2, a + 0.035, b - 0.035);
    ctx.strokeStyle = '#b3bcc166';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function paintStone(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  roundedRectPath(ctx, x, y, w, h, 3);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = '#bbc3c766';
  ctx.fillRect(x + 4, y + 2, w - 8, 2);
  ctx.fillStyle = '#434c5580';
  ctx.fillRect(x + 4, y + h - 3, w - 8, 2);
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paintWood(ctx: CanvasRenderingContext2D): void {
  const colors = ['#79593c', '#896947', '#715237', '#806045'];
  ctx.fillStyle = '#493522';
  ctx.fillRect(34, 30, 92, 108);
  for (let i = 0; i < 8; i += 1) {
    const x = 36 + i * 11;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(x, 31, 10, 106);
    ctx.fillStyle = '#b894624d';
    ctx.fillRect(x + 1, 40 + i * 3, 1.5, 78 - i * 2);
    ctx.fillStyle = '#51392570';
    ctx.fillRect(x + 7, 59 + i % 3 * 8, 1.5, 43);
  }

  ctx.fillStyle = '#383f3d';
  ctx.fillRect(CENTER - 1.5, 37, 3, 100);
  for (const y of [68, 112]) {
    for (const x of [33, 102]) {
      roundedRectPath(ctx, x, y, 25, 6, 3);
      ctx.fill();
      ctx.fillStyle = '#a6a9a0';
      ctx.fillRect(x + 18, y + 2, 2, 2);
      ctx.fillStyle = '#383f3d';
    }
  }
  ctx.beginPath();
  ctx.arc(CENTER, 91, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#ba985f';
  ctx.fill();
  ctx.fillStyle = '#38291e';
  ctx.beginPath();
  ctx.arc(CENTER, 89, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(CENTER - 1.3, 90, 2.6, 5);
}

function paintPortal(ctx: CanvasRenderingContext2D): void {
  const light = ctx.createRadialGradient(CENTER, 96, 4, CENTER, 96, 61);
  light.addColorStop(0, '#9be8c7');
  light.addColorStop(0.5, '#4d9d94');
  light.addColorStop(1, '#24484c');
  ctx.fillStyle = light;
  ctx.fillRect(34, 30, 92, 108);
  ctx.strokeStyle = '#d1f7e08c';
  ctx.lineWidth = 2;
  for (const [rx, ry] of [[34, 13], [26, 9], [15, 6]]) {
    ctx.beginPath();
    ctx.ellipse(CENTER, 101, rx, ry, -0.29, 0.18, 5.7);
    ctx.stroke();
  }
}

function paintMoss(ctx: CanvasRenderingContext2D, x: number, y: number, direction: 1 | -1): void {
  ctx.strokeStyle = '#496237';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 6 * direction, y + 7, x + 11 * direction, y + 17);
  ctx.stroke();
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.ellipse(x + 2.4 * i * direction, y + i * 3.4, 3.2, 1.7, direction * (i % 2 ? -0.5 : 0.8), 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? '#64804c' : '#496537';
    ctx.fill();
  }
}
