import type Phaser from 'phaser';
import { CASTLE_CHEST, CASTLE_SEALS, type CastleSeal } from '../config/castleConfig';
import type { Obstacle } from '../config/worldConfig';
import { ALL_CASTLE_SEALS, isCastleSealOpen, type CastleQuestState } from '../quest/castleQuestTypes';
import { addCastleHall, CASTLE_BRAZIERS, CASTLE_COLUMNS, CASTLE_TREASURE, diamond } from './CastleDecor';
import { buildCastleFire } from './CastleFire';
import dragonUrl from './castle-dragon.webp';

type Graphics = Phaser.GameObjects.Graphics;
const AMBER_GLOW = 'castle-torchlight';
const DRAGON = 'castle-guardian-dragon';

export function preloadCastleWorld(scene: Phaser.Scene): void {
  if (!scene.textures.exists(DRAGON)) scene.load.image(DRAGON, dragonUrl);
}

export function buildCastleWorld(scene: Phaser.Scene) {
  addCastleHall(scene);
  addGlowTexture(scene);
  for (const [x, y] of CASTLE_BRAZIERS) addBrazierLight(scene, x, y);
  for (const [x, y] of [[383, 202], [1057, 202], [720, 864]]) {
    scene.add.image(x, y, AMBER_GLOW).setDepth(-6).setScale(3.9, 2.38).setAlpha(0.7);
  }

  const dragonShadow = scene.add.ellipse(720, 248, 362, 118, 0x291d2a, 0.52);
  const dragon = scene.add.image(720, 211, DRAGON).setDisplaySize(380, 253).setDepth(3);
  const fire = buildCastleFire(scene, AMBER_GLOW);
  const guardian: Obstacle = { x: 720, y: 228, r: 92 };
  const obstacles: Obstacle[] = [
    guardian,
    { ...CASTLE_CHEST, r: 38 },
    ...CASTLE_COLUMNS.map(([x, y]) => ({ x, y, r: 25 })),
    ...CASTLE_BRAZIERS.map(([x, y]) => ({ x, y, r: 16 })),
    ...CASTLE_TREASURE.map(([x, y, scale]) => ({ x, y, r: 35 * scale })),
    ...CASTLE_SEALS.map(({ x, y }) => ({ x, y, r: 29 })),
  ];
  const seals = CASTLE_SEALS.map(({ x, y }) => ({
    glow: scene.add.image(x, y - 23, AMBER_GLOW).setDepth(0).setScale(1.53, 1.1).setVisible(false),
    pedestal: scene.add.graphics().setDepth(y + 7),
  }));
  const chestGlow = scene.add.image(CASTLE_CHEST.x, CASTLE_CHEST.y - 26, AMBER_GLOW)
    .setDepth(1).setScale(2.7, 2.4).setVisible(false);
  const chest = scene.add.graphics().setDepth(CASTLE_CHEST.y);
  const glints = scene.add.graphics().setDepth(CASTLE_CHEST.y + 1).setVisible(false);
  const { x, y } = CASTLE_CHEST;
  glints.fillStyle(0xfff4bf).fillPoints(diamond(x - 36, y - 56, 5, 8), true)
    .fillPoints(diamond(x + 45, y - 38, 5, 8), true).fillPoints(diamond(x + 14, y - 79, 4, 6), true);
  let lastMask = -1;

  return {
    obstacles,
    update(time: number): void { fire.update(time); },
    setProgress(state: CastleQuestState): void {
      if (state.openedMask === lastMask) return;
      for (const seal of CASTLE_SEALS) {
        const { pedestal, glow } = seals[seal.id];
        const open = isCastleSealOpen(state, seal.id);
        if (lastMask >= 0 && Boolean(lastMask & (1 << seal.id)) === open) continue;
        drawSeal(pedestal, seal, open);
        glow.setVisible(open);
        if (open) scene.tweens.add({ targets: glow, alpha: { from: 0.7, to: 1 }, yoyo: true, repeat: -1, duration: 640 });
      }
      const opened = state.openedMask === ALL_CASTLE_SEALS;
      if (lastMask === -1 || opened) drawChest(chest, opened);
      lastMask = state.openedMask;
      if (!opened) return;
      fire.extinguish();
      obstacles.splice(obstacles.indexOf(guardian), 1);
      dragon.setVisible(false);
      dragonShadow.setVisible(false);
      chestGlow.setVisible(true);
      glints.setVisible(true);
      scene.tweens.add({ targets: chestGlow, alpha: { from: 0.74, to: 1 }, yoyo: true, repeat: -1, duration: 820 });
      scene.tweens.add({ targets: glints, alpha: { from: 0.32, to: 1 }, y: -7, yoyo: true, repeat: -1, duration: 790 });
    },
  };
}

function addGlowTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(AMBER_GLOW)) return;
  const texture = scene.textures.createCanvas(AMBER_GLOW, 128, 128);
  if (!texture) return;
  const ctx = texture.getContext();
  const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  glow.addColorStop(0, 'rgba(255, 217, 137, 0.64)');
  glow.addColorStop(0.35, 'rgba(255, 165, 80, 0.36)');
  glow.addColorStop(0.7, 'rgba(255, 117, 62, 0.11)');
  glow.addColorStop(1, 'rgba(255, 117, 62, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);
  texture.refresh();
}

function addBrazierLight(scene: Phaser.Scene, x: number, y: number): void {
  const light = scene.add.image(x, y - 14, AMBER_GLOW).setDepth(-7).setScale(2.62, 2.14);
  const flame = scene.add.graphics().setDepth(y + 3);
  flame.fillStyle(0xec5c37).fillPoints(diamond(x, y - 22, 15, 19), true);
  flame.fillStyle(0xffad4a).fillPoints(diamond(x - 4, y - 25, 9, 15), true)
    .fillPoints(diamond(x + 5, y - 20, 9, 12), true);
  flame.fillStyle(0xffe8aa).fillPoints(diamond(x - 1, y - 18, 6, 10), true);
  scene.tweens.add({
    targets: [flame, light], alpha: { from: 0.73, to: 1 }, yoyo: true, repeat: -1, duration: 380 + (x + y) % 310,
  });
}

function drawSeal(g: Graphics, { x, y, color, id }: CastleSeal, open: boolean): void {
  g.clear();
  const faceY = y - 24;
  const rim = open ? 0xffdf9a : 0xb28a64;
  const rune = open ? color : [0xc4a6bb, 0x83ad96, 0x8caaa9, 0xc29b7d][id];
  if (open) {
    g.fillStyle(color, 0.25).fillEllipse(x, faceY, 114, 98);
    for (const side of [-1, 1]) g.fillStyle(color).fillPoints(diamond(x + side * 45, faceY - 18, 3, 6), true);
  }
  g.fillStyle(0x382839).fillEllipse(x + 3, y + 12, 102, 38);
  g.fillStyle(0x76505a).fillRoundedRect(x - 39, y - 10, 78, 29, 8);
  g.fillStyle(0x9a7271).fillRoundedRect(x - 33, y - 19, 66, 27, 6);
  g.fillStyle(0xd29f6a).fillRect(x - 32, y + 10, 64, 3);
  g.fillStyle(0x513243).fillCircle(x, faceY + 4, 36);
  g.fillStyle(rim).fillCircle(x, faceY, 34);
  g.fillStyle(open ? 0x554055 : 0x473644).fillCircle(x, faceY, 29);
  g.lineStyle(1, rim, 0.8).strokeCircle(x, faceY, 25);
  for (let i = 0; i < 8; i += 1) {
    const angle = i * Math.PI / 4;
    g.fillStyle(rim).fillCircle(x + Math.cos(angle) * 31, faceY + Math.sin(angle) * 31, 1.5);
  }
  g.fillStyle(rune);
  if (id === 0) {
    g.fillPoints(diamond(x, faceY, 8, 17), true).fillPoints(diamond(x, faceY, 17, 5), true);
    g.fillCircle(x - 12, faceY - 9, 2).fillCircle(x + 12, faceY + 9, 2);
  } else if (id === 1) {
    g.fillPoints(diamond(x, faceY - 9, 9, 13), true).fillPoints(diamond(x - 9, faceY + 8, 8, 12), true)
      .fillPoints(diamond(x + 9, faceY + 8, 8, 12), true);
  } else if (id === 2) {
    g.fillPoints(diamond(x, faceY, 17, 19), true);
    g.lineStyle(2, 0x453747).strokePoints(diamond(x, faceY, 7, 15), true);
    g.lineBetween(x - 17, faceY, x + 17, faceY);
  } else {
    g.lineStyle(2, rune).strokeEllipse(x, faceY - 1, 21, 31);
    g.fillPoints(diamond(x, faceY - 1, 5, 11), true);
    for (const side of [-1, 1]) {
      g.lineStyle(2, rune).lineBetween(x + side * 12, faceY + 2, x + side * 19, faceY + 8);
      g.lineBetween(x + side * 12, faceY - 4, x + side * 19, faceY - 10);
    }
  }
}

function drawChest(g: Graphics, open: boolean): void {
  const { x, y } = CASTLE_CHEST;
  g.clear();
  g.fillStyle(0x392531, 0.84).fillEllipse(x + 4, y + 20, 117, 34);
  g.fillStyle(0xad704a).fillRoundedRect(x - 45, y - (open ? 56 : 36), 90, 36, 13);
  g.fillStyle(0x744339).fillRoundedRect(x - 40, y - (open ? 52 : 32), 80, 26, 9);
  g.fillStyle(0xd89e57).fillRect(x - 33, y - (open ? 52 : 32), 6, 27).fillRect(x + 27, y - (open ? 52 : 32), 6, 27);
  if (open) {
    g.fillStyle(0xffbb4f).fillEllipse(x, y - 15, 105, 38);
    g.fillStyle(0xffedab).fillEllipse(x, y - 17, 82, 26);
    g.fillStyle(0xffffff, 0.8).fillPoints(diamond(x, y - 36, 13, 20), true);
  }
  g.fillStyle(0x533039).fillRoundedRect(x - 47, y - 11, 94, 38, 5);
  g.fillStyle(0xa35a42).fillRect(x - 41, y - 8, 82, 28);
  g.fillStyle(0xd7a158).fillRect(x - 44, y + 20, 88, 5).fillRect(x - 37, y - 10, 6, 31).fillRect(x + 31, y - 10, 6, 31);
  g.fillStyle(0xf1c377).fillRoundedRect(x - 10, y - 9, 20, 17, 3);
  if (!open) g.fillStyle(0x513032).fillCircle(x, y - 3, 3).fillRect(x - 1, y - 3, 3, 6);
}
