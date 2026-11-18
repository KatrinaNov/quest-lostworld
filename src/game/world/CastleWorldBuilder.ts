import type Phaser from 'phaser';
import { CASTLE_CHEST, CASTLE_HEIGHT, CASTLE_SEALS, CASTLE_WIDTH } from '../config/castleConfig';
import type { Obstacle } from '../config/worldConfig';
import { ALL_CASTLE_SEALS, isCastleSealOpen, type CastleQuestState } from '../quest/castleQuestTypes';

const STONE = [0x34313d, 0x383541, 0x3d3946, 0x413e4a, 0x373440];
const BANNERS = [0x624175, 0x3c6557, 0x3b5a73, 0x7f4d38];
const TORCHES = [[147, 235], [1293, 235], [147, 542], [1293, 542], [147, 850], [1293, 850], [530, 247], [910, 247]];

/** Каменная кладка запекается один раз. Печати и сундук обновляются по прогрессу. */
export function buildCastleWorld(scene: Phaser.Scene) {
  const stone = scene.add.graphics().setDepth(-1000);
  stone.fillStyle(0x15131d).fillRect(0, 0, CASTLE_WIDTH, CASTLE_HEIGHT);
  stone.fillStyle(0x24212c).fillRect(82, 96, 1276, 853);
  for (let row = 0; row < 23; row += 1) {
    for (let column = 0; column < 32; column += 1) {
      const x = 96 + column * 39;
      const y = 116 + row * 36;
      const tone = (row * 53 + column * 23 + (row * column) % 13) % STONE.length;
      stone.fillStyle(STONE[tone]).fillRect(x + 1, y + 1, 37, 34);
      stone.fillStyle(0x625b69, 0.4).fillRect(x + 3, y + 3, 32, 2);
      stone.fillStyle(0x21202a, 0.65).fillRect(x + 2, y + 31, 35, 3);
      if (tone === 2) stone.fillStyle(0x282633).fillRect(x + 17, y + 21, 12, 2).fillRect(x + 26, y + 23, 3, 5);
    }
  }
  stone.fillStyle(0x191722, 0.65).fillRect(95, 130, 34, 799).fillRect(1311, 130, 34, 799);
  drawWall(stone, 82, 66, 1276, 78);
  drawWall(stone, 64, 104, 66, 854);
  drawWall(stone, 1310, 104, 66, 854);
  drawWall(stone, 111, 926, 520, 49);
  drawWall(stone, 809, 926, 520, 49);

  // Центральный проход с потёртой ковровой дорожкой и боковыми проходами к нишам.
  stone.fillStyle(0x251826).fillRect(634, 290, 172, 671);
  stone.fillStyle(0x643445).fillRect(641, 292, 158, 669);
  stone.fillStyle(0x9f704e).fillRect(646, 292, 3, 669).fillRect(791, 292, 3, 669);
  stone.fillStyle(0x824656, 0.9);
  for (let y = 338; y < 940; y += 51) stone.fillPoints(diamond(720, y, 16, 11), true);

  for (const seal of CASTLE_SEALS) {
    drawAlcove(stone, seal.x, seal.y, BANNERS[seal.id], seal.color);
  }
  drawDais(stone);
  const dragon = scene.add.graphics().setDepth(2);
  drawDragon(dragon, 720, 226);
  const obstacles: Obstacle[] = [{ x: 720, y: 228, r: 92 }, { ...CASTLE_CHEST, r: 36 }];
  for (const [x, y] of [[485, 546], [955, 546], [485, 855], [955, 855]]) {
    drawColumn(stone, x, y);
    obstacles.push({ x, y, r: 25 });
  }

  const emberLight = 'castle-amber-glow';
  if (!scene.textures.exists(emberLight)) {
    const texture = scene.textures.createCanvas(emberLight, 96, 96);
    if (texture) {
      const ctx = texture.getContext();
      const glow = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
      glow.addColorStop(0, 'rgba(255, 164, 67, 0.5)');
      glow.addColorStop(0.54, 'rgba(229, 119, 57, 0.16)');
      glow.addColorStop(1, 'rgba(229, 119, 57, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 96, 96);
      texture.refresh();
    }
  }
  for (const [x, y] of TORCHES) {
    const light = scene.add.image(x, y - 17, emberLight).setDepth(-10).setScale(1.65, 1.18);
    stone.fillStyle(0x1c1925).fillRect(x - 15, y - 9, 30, 18);
    stone.fillStyle(0x665065).fillRect(x - 12, y - 8, 24, 7).fillRect(x - 4, y - 3, 8, 11);
    const flame = scene.add.graphics().setDepth(3);
    flame.fillStyle(0xc24c39).fillPoints(diamond(x, y - 16, 9, 15), true);
    flame.fillStyle(0xffac4e).fillPoints(diamond(x, y - 15, 6, 10), true);
    flame.fillStyle(0xffe19a).fillRect(x - 2, y - 19, 4, 9);
    scene.tweens.add({ targets: [flame, light], alpha: { from: 0.72, to: 1 }, yoyo: true, repeat: -1, duration: 480 + (x + y) % 280 });
  }
  const masonry = 'castle-masonry';
  if (!scene.textures.exists(masonry)) stone.generateTexture(masonry, CASTLE_WIDTH, CASTLE_HEIGHT);
  stone.destroy();
  scene.add.image(0, 0, masonry).setOrigin(0).setDepth(-1000);

  const seals = CASTLE_SEALS.map((seal) => {
    const pedestal = scene.add.graphics().setDepth(1);
    const mark = scene.add.text(seal.x, seal.y - 16, seal.glyph, {
      fontFamily: 'Georgia, serif', fontSize: '35px', color: '#f4dfb2',
    }).setOrigin(0.5).setDepth(4);
    obstacles.push({ x: seal.x, y: seal.y, r: 29 });
    return { pedestal, mark };
  });
  const chest = scene.add.graphics().setDepth(5);
  let lastMask = -1;

  return {
    obstacles,
    setProgress(state: CastleQuestState): void {
      if (state.openedMask === lastMask) return;
      lastMask = state.openedMask;
      for (const seal of CASTLE_SEALS) {
        const { pedestal, mark } = seals[seal.id];
        const open = isCastleSealOpen(state, seal.id);
        drawSeal(pedestal, seal.x, seal.y, seal.color, open);
        mark.setColor(open ? '#fff4bf' : '#d4bebe');
      }
      const treasureOpen = state.openedMask === ALL_CASTLE_SEALS;
      drawChest(chest, treasureOpen);
      if (treasureOpen) {
        drawDragon(dragon, 720, 226, true);
        scene.tweens.add({ targets: dragon, y: -10, duration: 690, ease: 'Sine.easeOut' });
      }
    },
  };
}

function diamond(x: number, y: number, w: number, h: number): Phaser.Types.Math.Vector2Like[] {
  return [{ x, y: y - h }, { x: x + w, y }, { x, y: y + h }, { x: x - w, y }];
}

function drawWall(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number): void {
  g.fillStyle(0x1c1925).fillRect(x, y, width, height);
  for (let row = 0; row * 18 < height; row += 1) {
    const top = y + row * 18;
    const h = Math.min(16, y + height - top);
    for (let left = x - (row % 2) * 24; left < x + width; left += 48) {
      const start = Math.max(x, left);
      const w = Math.min(x + width, left + 46) - start;
      g.fillStyle(row === 0 ? 0x676072 : 0x4f485c).fillRect(start, top, w, h);
      g.fillStyle(0x7e7285, 0.52).fillRect(start, top, w, 2);
    }
  }
  g.fillStyle(0x18141f, 0.85).fillRect(x, y + height - 5, width, 5);
}

function drawAlcove(g: Phaser.GameObjects.Graphics, x: number, y: number, cloth: number, accent: number): void {
  g.fillStyle(0x241f2b).fillRoundedRect(x - 123, y - 79, 246, 146, 14);
  g.fillStyle(0x474052).fillRoundedRect(x - 113, y - 72, 226, 126, 11);
  g.lineStyle(2, accent, 0.37).strokeRoundedRect(x - 106, y - 65, 212, 112, 8);
  g.fillStyle(0x211b28, 0.7).fillRect(x - 30, y - 103, 60, 54);
  g.fillStyle(cloth).fillPoints([{ x: x - 25, y: y - 106 }, { x: x + 25, y: y - 106 },
    { x: x + 25, y: y - 62 }, { x, y: y - 72 }, { x: x - 25, y: y - 62 }], true);
  g.fillStyle(accent, 0.65).fillPoints(diamond(x, y - 88, 9, 10), true);
  for (const side of [-1, 1]) {
    g.fillStyle(0x655b6e).fillRect(x + side * 90 - 9, y - 55, 18, 13);
    g.fillStyle(0x36303e).fillRect(x + side * 90 - 7, y - 42, 14, 58);
  }
}

function drawDais(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0x211b29).fillRoundedRect(534, 153, 372, 165, 26);
  g.fillStyle(0x595061).fillRoundedRect(548, 145, 344, 154, 22);
  g.lineStyle(3, 0x8f694f, 0.85).strokeRoundedRect(559, 154, 322, 133, 16);
  g.fillStyle(0x37303d).fillRoundedRect(583, 160, 274, 115, 15);
  for (let y = 291; y <= 323; y += 8) {
    g.fillStyle(0x656070).fillRect(635, y, 170, 4);
    g.fillStyle(0x312b39).fillRect(635, y + 4, 170, 4);
  }
}

function drawDragon(g: Phaser.GameObjects.Graphics, x: number, y: number, awake = false): void {
  g.clear();
  g.fillStyle(0x1c1722, 0.65).fillEllipse(x, y + 30, 240, 58);
  for (const side of [-1, 1]) {
    const wing = (dx: number, dy: number) => ({ x: x + side * dx, y: y + dy });
    g.fillStyle(0x71414c).fillPoints([wing(12, 7), wing(27, -25), wing(65, -49), wing(121, -57),
      wing(105, -23), wing(91, -29), wing(79, -1), wing(65, -13), wing(54, 16)], true);
    g.lineStyle(3, 0xb97960, 0.9).strokePoints([wing(12, 7), wing(27, -25), wing(65, -49), wing(121, -57)]);
    g.lineStyle(3, 0x442d3d, 0.9).strokePoints([wing(29, -24), wing(65, -13), wing(79, -39), wing(91, -29), wing(105, -48)]);
    g.fillStyle(0x9e6b54).fillPoints([wing(12, -29), wing(19, -65), wing(33, -78), wing(28, -50), wing(29, -28)], true);
    g.fillStyle(0x452d39).fillRect(x + side * 24 - 16, y + 26, 32, 13);
    g.fillStyle(0xa6654c).fillRect(x + side * 24 - 15, y + 31, 6, 8);
  }
  g.fillStyle(0x683d43).fillEllipse(x, y + 10, 72, 79);
  g.fillStyle(0x97654d).fillEllipse(x, y + 17, 45, 45);
  g.fillStyle(0x9c5c50).fillPoints([{ x: x - 32, y: y - 37 }, { x: x + 32, y: y - 37 },
    { x: x + 27, y: y - 5 }, { x: x + 16, y: y + 8 }, { x: x - 16, y: y + 8 }, { x: x - 27, y: y - 5 }], true);
  g.fillStyle(0x5a3541).fillRect(x - 20, y - 6, 40, 15);
  g.fillStyle(0x302331).fillRect(x - 26, y - 25, 16, 10).fillRect(x + 10, y - 25, 16, 10);
  g.fillStyle(awake ? 0xffe39b : 0xd39964).fillRect(x - 23, y - 21, 8, awake ? 5 : 3).fillRect(x + 15, y - 21, 8, awake ? 5 : 3);
  g.fillStyle(0xb58462).fillRect(x - 9, y - 32, 18, 6).fillRect(x - 6, y - 23, 12, 7);
}

function drawColumn(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(0x282332).fillEllipse(x + 6, y + 13, 62, 29);
  g.fillStyle(0x555064).fillRect(x - 26, y + 1, 52, 14);
  g.fillStyle(0x747084).fillRect(x - 20, y - 33, 40, 38);
  g.fillStyle(0x4b4659).fillRect(x + 8, y - 33, 12, 39);
  g.fillStyle(0x93879b).fillRect(x - 24, y - 39, 48, 8);
}

function drawSeal(g: Phaser.GameObjects.Graphics, x: number, y: number, hue: number, open: boolean): void {
  g.clear();
  if (open) g.fillStyle(hue, 0.19).fillEllipse(x, y - 10, 122, 67);
  g.fillStyle(0x26212d).fillRect(x - 37, y + 2, 74, 19);
  g.fillStyle(0x5a5065).fillRect(x - 32, y - 25, 64, 31);
  g.fillStyle(open ? hue : 0x847082).fillEllipse(x, y - 16, 62, 47);
  g.fillStyle(open ? 0x433740 : 0x322a37).fillEllipse(x, y - 16, 52, 39);
}

function drawChest(g: Phaser.GameObjects.Graphics, open: boolean): void {
  const { x, y } = CASTLE_CHEST;
  g.clear();
  g.fillStyle(0x241a22, 0.75).fillEllipse(x, y + 11, 112, 36);
  g.fillStyle(0x452b30).fillRect(x - 41, y - 12, 82, 34);
  g.fillStyle(0xa26543).fillRect(x - 36, y - 5, 72, 21);
  g.fillStyle(0xd2a05e).fillRect(x - 40, y + 15, 80, 5).fillRect(x - 32, y - 9, 7, 25).fillRect(x + 25, y - 9, 7, 25);
  g.fillStyle(0x683b38).fillRoundedRect(x - 41, y - (open ? 45 : 33), 82, 23, 6);
  g.fillStyle(0xc28855).fillRect(x - 37, y - (open ? 42 : 30), 74, 4);
  g.fillStyle(0xe6b972).fillRect(x - 8, y - 9, 16, 14);
  if (open) {
    g.fillStyle(0xffcf74, 0.2).fillEllipse(x, y - 20, 142, 86);
    g.fillStyle(0xffdf85).fillPoints(diamond(x, y - 20, 13, 10), true);
    g.fillStyle(0x8ce3a1).fillPoints(diamond(x - 19, y - 14, 8, 6), true);
    g.fillStyle(0x90dff5).fillPoints(diamond(x + 20, y - 14, 9, 7), true);
  } else {
    g.fillStyle(0x442d34).fillRect(x - 2, y - 5, 4, 6);
  }
}
