import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'public/assets/images/door-key.png');
const outDir = path.join(root, 'public/assets/objects');

fs.mkdirSync(outDir, { recursive: true });

/** Области на листе 1536×1024 (ключи слева, дверь справа). */
const REGIONS = {
  keyGreen: { left: 0, top: 0, width: 620, height: 340 },
  keyBlue: { left: 0, top: 300, width: 620, height: 340 },
  keyOrange: { left: 0, top: 620, width: 620, height: 404 },
  /** Только правая часть листа — без ключей слева. */
  door: { left: 660, top: 0, width: 876, height: 1024 },
};

async function stripBlackTrim(region) {
  const { data, info } = await sharp(src)
    .extract(region)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    if (max < 28) data[i + 3] = 0;
    else if (max < 42) data[i + 3] = Math.min(data[i + 3], Math.floor((max - 28) * 14));
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 12 })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function write(name, region, extra) {
  let pipe = sharp(await stripBlackTrim(region));
  const { width, height } = await pipe.metadata();
  pipe = pipe.resize(Math.round(width / 2), Math.round(height / 2), { fit: 'fill' });
  if (extra?.brightness) pipe = pipe.modulate({ brightness: extra.brightness, saturation: extra.saturation ?? 1 });
  const buf = await pipe.toBuffer();
  const file = path.join(outDir, name);
  await sharp(buf).toFile(file);
  const meta = await sharp(buf).metadata();
  console.log(name, meta.width, meta.height);
}

await write('key-green.png', REGIONS.keyGreen);
await write('key-blue.png', REGIONS.keyBlue);
await write('key-orange.png', REGIONS.keyOrange);
await write('door-closed.png', REGIONS.door);
await write('door-open.png', REGIONS.door, { brightness: 1.12, saturation: 1.08 });

console.log('Done:', outDir);
