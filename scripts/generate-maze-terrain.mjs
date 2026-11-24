// Запуск после правок геометрии или палитры: node scripts/generate-maze-terrain.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';
import { build } from 'esbuild';

const { outputFiles: [module] } = await build({
  stdin: {
    contents: "export { MAZE_CONFIG, MAZE_PALETTE, MAZE_TERRAIN_SCALE } from './src/game/config/mazeConfig.ts';"
      + "export { MAZE_WALLS } from './src/game/world/mazeLayout.ts';"
      + "export { createRng } from './src/game/config/worldConfig.ts';",
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
  },
  format: 'esm', bundle: true, write: false,
});
const { MAZE_CONFIG, MAZE_PALETTE, MAZE_TERRAIN_SCALE, MAZE_WALLS, createRng } =
  await import('data:text/javascript;base64,' + Buffer.from(module.contents).toString('base64'));

const width = Math.ceil(MAZE_CONFIG.width / MAZE_TERRAIN_SCALE);
const height = Math.ceil(MAZE_CONFIG.height / MAZE_TERRAIN_SCALE);
const pixels = Buffer.alloc(width * height);
const palette = new Map();
const wallMask = Buffer.alloc(pixels.length);

function fillRect(pixels, color, x, y, w, h, mask) {
  const right = Math.min(width, x + w);
  const bottom = Math.min(height, y + h);
  for (let row = Math.max(0, y); row < bottom; row += 1) {
    const start = row * width + Math.max(0, x);
    const end = row * width + right;
    if (mask) {
      for (let i = start; i < end; i += 1) if (mask[i]) pixels[i] = color;
    } else if (start < end) pixels.fill(color, start, end);
  }
}

function paint(color, x, y, w, h, mask) {
  if (!palette.has(color)) palette.set(color, palette.size);
  fillRect(pixels, palette.get(color), x, y, w, h, mask);
}

function drawStoneFloor() {
  const random = createRng(4957);
  const rowHeight = 26;
  const { stoneJoint, stoneSlabs, stoneLight, stoneShade } = MAZE_PALETTE;
  paint(stoneJoint, 0, 0, width, height);
  for (let y = 0; y < height; y += rowHeight) {
    for (let x = -Math.floor(random() * 40); x < width;) {
      const slabWidth = 31 + Math.floor(random() * 29);
      const slabHeight = rowHeight - 2;
      const color = stoneSlabs[Math.floor(random() * stoneSlabs.length)];
      paint(color, x + 2, y, slabWidth - 5, slabHeight);
      paint(color, x, y + 2, slabWidth - 2, slabHeight - 4);
      paint(stoneLight, x + 3, y + 1, slabWidth - 8, 2);
      paint(stoneLight, x + 1, y + 4, 1, slabHeight - 8);
      paint(stoneShade, x + 3, y + slabHeight - 2, slabWidth - 8, 2);
      paint(stoneShade, x + 6 + Math.floor(random() * (slabWidth - 16)), y + 8 + Math.floor(random() * 9), 4, 1);
      if (random() < 0.28) {
        const crackX = x + slabWidth - 13;
        paint(stoneShade, crackX, y + 3, 1, 6);
        paint(stoneShade, crackX - 3, y + 8, 4, 1);
        paint(stoneShade, crackX - 3, y + 9, 1, 4);
      }
      x += slabWidth;
    }
  }
}

function drawHedges() {
  const random = createRng(8209);
  const { hedgeShadow, hedgeBase, hedgeLeaves, hedgeTips } = MAZE_PALETTE;
  const walls = MAZE_WALLS.map(({ left, top, right, bottom }) => ({
    x: left / MAZE_TERRAIN_SCALE,
    y: top / MAZE_TERRAIN_SCALE,
    w: (right - left) / MAZE_TERRAIN_SCALE,
    h: (bottom - top) / MAZE_TERRAIN_SCALE,
  }));
  for (const { x, y, w, h } of walls) fillRect(wallMask, 1, x, y, w, h);
  paint(hedgeShadow, 0, 0, width, height, wallMask);
  for (const { x, y, w, h } of walls) paint(hedgeBase, x + 1, y + 1, w - 2, h - 3, wallMask);
  for (const { x, y, w, h } of walls) {
    const horizontal = w >= h;
    const length = horizontal ? w : h;
    for (let offset = 2; offset < length; offset += 5 + Math.floor(random() * 4)) {
      const across = 3 + Math.floor(random() * 8);
      const leafX = x + (horizontal ? offset : across);
      const leafY = y + (horizontal ? across : offset);
      const size = 4 + Math.floor(random() * 5);
      paint(hedgeShadow, leafX - 2, leafY + 1, size + 1, 3, wallMask);
      const leaf = hedgeLeaves[Math.floor(random() * hedgeLeaves.length)];
      paint(leaf, leafX - 3, leafY - 1, size + 1, 3, wallMask);
      paint(leaf, leafX - 1, leafY - 3, size - 2, 5, wallMask);
      if (random() < 0.55) paint(hedgeTips, leafX - 1, leafY - 2, 2, 1, wallMask);
    }
  }
}

function chunk(type, bytes) {
  const header = Buffer.alloc(4);
  header.writeUInt32BE(bytes.length);
  const body = Buffer.concat([Buffer.from(type), bytes]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([header, body, checksum]);
}

drawStoneFloor();
drawHedges();
const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(height, 4);
header[8] = 8;
header[9] = 3; // Indexed, opaque RGB.
const rows = Buffer.alloc((width + 1) * height);
for (let y = 0; y < height; y += 1) pixels.copy(rows, y * (width + 1) + 1, y * width, (y + 1) * width);
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header),
  chunk('PLTE', Buffer.from([...palette.keys()].map((color) => color.slice(1)).join(''), 'hex')),
  chunk('IDAT', deflateSync(rows, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
const target = new URL('../src/game/world/maze-terrain.png', import.meta.url);
if (process.argv.includes('--check')) {
  if (!(await readFile(target)).equals(png)) throw new Error('Run node scripts/generate-maze-terrain.mjs to update the maze image');
} else {
  await writeFile(target, png);
}
console.log('Maze terrain: ' + width + '×' + height + ', ' + png.length + ' bytes');
