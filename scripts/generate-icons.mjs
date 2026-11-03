// Генерация иконок приложения (PNG) без внешних зависимостей.
// Запуск: node scripts/generate-icons.mjs
// Результат: public/icons/icon-192.png, icon-512.png, apple-touch-icon.png
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // глубина
  header[9] = 6; // RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));
const smooth = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** Цвет пикселя: портал на тёмно-зелёном фоне. Содержимое в центральных ~70% (безопасно для maskable). */
function shade(nx, ny) {
  const d = Math.hypot(nx, ny);
  const angle = Math.atan2(ny, nx);

  // фон
  let r = mix(0x16, 0x0b, d / 1.4);
  let g = mix(0x30, 0x15, d / 1.4);
  let b = mix(0x24, 0x11, d / 1.4);

  // фиолетово-голубое свечение
  const glow = Math.exp(-((d / 0.62) ** 2));
  r += 90 * glow;
  g += 70 * glow;
  b += 170 * glow;

  // каменное кольцо
  const stone = 1 - smooth(0.03, 0.06, Math.abs(d - 0.6));
  r = mix(r, 0x7b, stone);
  g = mix(g, 0x83, stone);
  b = mix(b, 0x8e, stone);

  // голубое кольцо
  const cyan = 1 - smooth(0.012, 0.03, Math.abs(d - 0.5));
  r = mix(r, 0x6e, cyan);
  g = mix(g, 0xe7, cyan);
  b = mix(b, 0xff, cyan);

  // фиолетовые дуги
  const arc = (1 - smooth(0.01, 0.025, Math.abs(d - 0.38))) * (Math.sin(angle * 3) > 0.2 ? 1 : 0);
  r = mix(r, 0xb1, arc);
  g = mix(g, 0x8c, arc);
  b = mix(b, 0xff, arc);

  // яркое ядро
  const core = 1 - smooth(0.0, 0.3, d);
  r = mix(r, 0xff, core * core);
  g = mix(g, 0xff, core * core);
  b = mix(b, 0xff, core * core);

  // золотые руны на камне
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const dot = 1 - smooth(0.035, 0.055, Math.hypot(nx - Math.cos(a) * 0.6, ny - Math.sin(a) * 0.6));
    r = mix(r, 0xff, dot);
    g = mix(g, 0xe0, dot);
    b = mix(b, 0x8a, dot);
  }

  return [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const samples = 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const nx = ((x + (sx + 0.5) / samples) / size) * 2 - 1;
          const ny = ((y + (sy + 0.5) / samples) / size) * 2 - 1;
          const [pr, pg, pb] = shade(nx, ny);
          r += pr;
          g += pg;
          b += pb;
        }
      }
      const n = samples * samples;
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(r / n);
      rgba[i + 1] = Math.round(g / n);
      rgba[i + 2] = Math.round(b / n);
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, rgba);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', render(192));
writeFileSync('public/icons/icon-512.png', render(512));
writeFileSync('public/icons/apple-touch-icon.png', render(180));
console.log('Иконки созданы в public/icons/');
