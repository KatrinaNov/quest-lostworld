import type Phaser from 'phaser';
import { CASTLE_HEIGHT, CASTLE_SEALS, CASTLE_WIDTH } from '../config/castleConfig';

type Graphics = Phaser.GameObjects.Graphics;

const FLOOR = [0x584452, 0x5f4b57, 0x654e58, 0x574452, 0x6b535b];
const BANNERS = [0x643f7a, 0x326c55, 0x306078, 0x9a4c33];
const GOLD = [0x95602a, 0xc28734, 0xe7ab40, 0xffd670, 0xf8bd49];
export const CASTLE_TREASURE = [
  [224, 203, 1.18], [410, 220, 1.35], [1030, 220, 1.35], [1216, 203, 1.18],
  [526, 349, 0.72], [914, 349, 0.78], [224, 535, 1.3], [1216, 535, 1.3],
  [217, 850, 1.04], [1223, 850, 1.04],
] as const;
export const CASTLE_COLUMNS = [[485, 546], [955, 546], [485, 855], [955, 855]] as const;
export const CASTLE_BRAZIERS = [[154, 285], [1286, 285], [156, 637], [1284, 637],
  [518, 465], [922, 465], [541, 786], [899, 786]] as const;

export const diamond = (x: number, y: number, w: number, h: number) =>
  [{ x, y: y - h }, { x: x + w, y }, { x, y: y + h }, { x: x - w, y }];

export function addCastleHall(scene: Phaser.Scene): void {
  const key = 'castle-treasury-floor';
  if (!scene.textures.exists(key)) {
    const g = scene.add.graphics();
    g.fillStyle(0x211826).fillRect(0, 0, CASTLE_WIDTH, CASTLE_HEIGHT);
    g.fillStyle(0x342736).fillRect(88, 109, 1264, 835);
    for (let row = 0; row < 21; row += 1) {
      const y = 118 + row * 39;
      for (let col = 0; col < 24; col += 1) {
        const tileX = 96 + col * 55 - (row % 2) * 27;
        const x = Math.max(96, tileX);
        const w = Math.min(1344, tileX + 53) - x;
        if (w < 2) continue;
        const tone = (row * 7 + col * 11 + (row * col) % 13) % FLOOR.length;
        g.fillStyle(FLOOR[tone]).fillRect(x, y, w, 37);
        g.fillStyle(0xc18a72, 0.33).fillRect(x + 1, y + 1, w - 2, 2);
        g.fillStyle(0x231927, 0.48).fillRect(x, y + 34, w, 3);
        if (tone === 2 && w > 24) g.lineStyle(1, 0x392b39, 0.55).strokePoints([
          { x: x + 12, y: y + 30 }, { x: x + 19, y: y + 22 }, { x: x + 29, y: y + 23 },
        ]);
      }
    }
    g.lineStyle(4, 0xa2694b, 0.9).strokeRect(128, 116, 1184, 807);
    g.lineStyle(1, 0xe2a369, 0.75).strokeRect(138, 125, 1164, 788);
    drawWall(g, 82, 66, 1276, 74);
    drawWall(g, 64, 105, 66, 850);
    drawWall(g, 1310, 105, 66, 850);
    drawWall(g, 108, 926, 509, 49);
    drawWall(g, 823, 926, 509, 49);
    drawCarpet(g);

    for (const seal of CASTLE_SEALS) drawAlcove(g, seal.x, seal.y, BANNERS[seal.id]);
    drawDais(g);
    for (const [x, y, scale] of CASTLE_TREASURE) drawTreasure(g, x, y, scale);
    for (const [x, y] of CASTLE_COLUMNS) drawColumn(g, x, y);
    for (const [x, y] of CASTLE_BRAZIERS) drawBrazier(g, x, y);
    g.generateTexture(key, CASTLE_WIDTH, CASTLE_HEIGHT);
    g.destroy();
  }
  scene.add.image(0, 0, key).setOrigin(0).setDepth(-1000);
}

function drawWall(g: Graphics, x: number, y: number, w: number, h: number): void {
  g.fillStyle(0x382635).fillRect(x, y, w, h);
  for (let row = 0; row * 19 < h; row += 1) {
    const top = y + row * 19;
    for (let left = x - (row % 2) * 25; left < x + w; left += 50) {
      const start = Math.max(x, left);
      const width = Math.min(x + w, left + 48) - start;
      g.fillStyle(row === 0 ? 0x9b746e : 0x694e58).fillRect(start, top, width, Math.min(17, y + h - top));
      g.fillStyle(0xc58f71, 0.65).fillRect(start, top, width, 2);
    }
  }
  g.fillStyle(0x362231).fillRect(x, y + h - 7, w, 7);
  g.fillStyle(0xb78354).fillRect(x, y + h - 9, w, 2);
}

function drawCarpet(g: Graphics): void {
  g.fillStyle(0x342032).fillRect(619, 284, 202, 685);
  g.fillStyle(0x803443).fillRect(626, 284, 188, 681);
  g.fillStyle(0x9e424b).fillRect(652, 284, 136, 681);
  for (const x of [634, 801]) {
    g.fillStyle(0xe5b365).fillRect(x, 284, 5, 680);
    g.fillStyle(0xd1885c).fillRect(x + 8, 284, 1, 680);
    for (let y = 303; y < 962; y += 22) g.fillStyle(0xc77b55).fillPoints(diamond(x + 2, y, 5, 6), true);
  }
  for (let y = 384; y < 970; y += 105) {
    g.lineStyle(2, 0xe5ac65, 0.65).strokePoints(diamond(720, y, 50, 35), true);
    g.lineStyle(1, 0xe5ac65, 0.45).strokePoints(diamond(720, y, 44, 30), true);
    g.fillStyle(0xc16c59).fillPoints(diamond(720, y, 19, 23), true);
    g.fillStyle(0xe5ac65).fillPoints(diamond(720, y, 9, 13), true);
  }
}

function drawAlcove(g: Graphics, x: number, y: number, cloth: number): void {
  g.fillStyle(0x342332, 0.85).fillEllipse(x, y + 29, 265, 113);
  g.fillStyle(0xb08063).fillEllipse(x, y + 14, 248, 109);
  g.fillStyle(0x634959).fillEllipse(x, y + 11, 237, 99);
  g.lineStyle(2, 0xb68b65).strokeEllipse(x, y + 9, 205, 79);
  const top = y - 95;
  g.fillStyle(0x352538).fillRect(x - 51, top - 3, 102, 12);
  g.fillStyle(0xd4a46e).fillRect(x - 54, top - 4, 108, 5);
  const banner = [
    { x: x - 39, y: top }, { x: x + 39, y: top }, { x: x + 39, y: top + 58 },
    { x, y: top + 76 }, { x: x - 39, y: top + 58 },
  ];
  g.fillStyle(cloth).fillPoints(banner, true);
  g.lineStyle(2, 0xd7a269, 0.9).strokePoints(banner, true);
  g.fillStyle(0xd7a269, 0.76).fillPoints(diamond(x, top + 31, 12, 17), true);
  g.fillStyle(cloth).fillPoints(diamond(x, top + 31, 6, 9), true);
  for (const side of [-1, 1]) {
    const px = x + side * 96;
    g.fillStyle(0x4c3545).fillRect(px - 8, y - 39, 16, 56);
    g.fillStyle(0xa47b6a).fillRect(px - 12, y - 40, 24, 9).fillRect(px - 12, y + 13, 24, 6);
    g.fillStyle(0xce996c).fillRect(px - 6, y - 30, 3, 42);
  }
}

function drawDais(g: Graphics): void {
  g.fillStyle(0x2d1f2e, 0.88).fillEllipse(720, 242, 430, 241);
  g.fillStyle(0xa67460).fillEllipse(720, 228, 411, 220);
  g.fillStyle(0x584150).fillEllipse(720, 222, 394, 208);
  g.lineStyle(3, 0xd7a064).strokeEllipse(720, 221, 365, 182);
  g.lineStyle(1, 0xc68a62, 0.75).strokeEllipse(720, 221, 344, 162);
  for (let y = 310; y <= 345; y += 7) {
    g.fillStyle(0xa6796b).fillRect(641, y, 158, 3);
    g.fillStyle(0x543748).fillRect(641, y + 3, 158, 4);
  }
}

function drawTreasure(g: Graphics, x: number, y: number, scale: number): void {
  g.fillStyle(0x312333, 0.85).fillEllipse(x + 4, y + 8, 137 * scale, 69 * scale);
  g.fillStyle(0x7d4225).fillEllipse(x, y + 3, 123 * scale, 59 * scale);
  g.fillStyle(0xae6a2b).fillEllipse(x, y - 7, 112 * scale, 56 * scale);
  for (let row = 0; row < 7; row += 1) {
    const count = 4 + row - Math.max(0, row - 4) * 2;
    for (let col = 0; col < count; col += 1) {
      const seed = (row * 29 + col * 17 + x) % 11;
      const px = x + ((col - (count - 1) / 2) * 16 + seed - 5) * scale;
      const py = y + (row * 8 - 31 + seed % 5) * scale;
      g.fillStyle(0x794324).fillEllipse(px, py + 3 * scale, 21 * scale, 11 * scale);
      g.fillStyle(GOLD[seed % GOLD.length]).fillEllipse(px, py, 20 * scale, 11 * scale);
      g.fillStyle(0xffe291, 0.85).fillEllipse(px - 3 * scale, py - 2 * scale, 8 * scale, 2 * scale);
    }
  }
  const gemX = x - 24 * scale;
  const gemY = y + 9 * scale;
  const color = x % 3 === 0 ? 0x6fd1b4 : 0x9fd0f4;
  g.fillStyle(0x543449).fillPoints(diamond(gemX, gemY + 2, 10 * scale, 8 * scale), true);
  g.fillStyle(color).fillPoints(diamond(gemX, gemY, 8 * scale, 7 * scale), true);
  g.fillStyle(0xfff1bd).fillPoints(diamond(gemX, gemY - 2, 3 * scale, 3 * scale), true);
  g.fillStyle(0xffebad).fillPoints(diamond(x + 27 * scale, y - 15 * scale, 6 * scale, 8 * scale), true);
}

function drawColumn(g: Graphics, x: number, y: number): void {
  g.fillStyle(0x332331, 0.8).fillEllipse(x + 9, y + 15, 78, 36);
  g.fillStyle(0x795669).fillRoundedRect(x - 26, y - 4, 52, 22, 4);
  g.fillStyle(0x9b726b).fillRect(x - 19, y - 46, 38, 51);
  g.fillStyle(0xc39378).fillRect(x - 14, y - 44, 7, 49);
  g.fillStyle(0x694859).fillRect(x + 9, y - 46, 10, 51);
  g.fillStyle(0xd6a46d).fillRect(x - 23, y - 48, 46, 7).fillRect(x - 23, y + 3, 46, 5);
  g.fillStyle(0xb68b77).fillEllipse(x, y - 50, 43, 17);
}

function drawBrazier(g: Graphics, x: number, y: number): void {
  g.fillStyle(0x34232e, 0.75).fillEllipse(x + 4, y + 13, 53, 22);
  g.fillStyle(0x684448).fillRect(x - 7, y - 3, 14, 19);
  g.fillStyle(0xc48249).fillEllipse(x, y + 13, 30, 11);
  g.fillStyle(0x6f4945).fillEllipse(x, y - 5, 41, 20);
  g.fillStyle(0xe6a256).fillEllipse(x, y - 9, 42, 14);
  g.fillStyle(0x672c30).fillEllipse(x, y - 9, 33, 8);
}
