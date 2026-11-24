import Phaser from 'phaser';
import { MAZE_CONFIG, MAZE_LETTER_POINTS, MAZE_PALETTE, MAZE_TERRAIN_SCALE } from '../config/mazeConfig';
import { MAZE_GLYPHS } from '../quest/mazeQuestTypes';
import terrainUrl from './maze-terrain.png';
import { MAZE_HAZARDS, MAZE_SCALE, MAZE_WALLS, mazePoint } from './mazeLayout';

const TERRAIN_TEXTURE = 'labyrinth-stone-and-hedges';

export interface MazeHazard {
  sprite: Phaser.GameObjects.Container;
  hits(x: number, y: number, radius: number): boolean;
}

export function buildMazeWorld(scene: Phaser.Scene): {
  hazards: MazeHazard[];
  checkpoints: Phaser.GameObjects.Rectangle[];
  letters: Phaser.GameObjects.Container[];
} {
  addTerrain(scene);
  drawCastle(scene);
  const entrance = mazePoint(1005, 1057);
  const marker = scene.add.graphics().setDepth(-2);
  marker.fillStyle(0xf0f2f4, 0.85).fillRect(entrance.x - 46, entrance.y - 3, 46, 6)
    .fillTriangle(entrance.x - 60, entrance.y, entrance.x - 42, entrance.y - 10, entrance.x - 42, entrance.y + 10);

  const hazards = [
    ...MAZE_HAZARDS.skeletons.map(([x, y]) => makeSkeleton(scene, x, y)),
    ...MAZE_HAZARDS.bushes.map(([x, y]) => makeBush(scene, x, y)),
    makePool(scene),
  ];
  const checkpoints = MAZE_CONFIG.checkpoints.map((point) =>
    scene.add.rectangle(point.x, point.y, 22, 22, 0x9bd5de, 0.24)
      .setStrokeStyle(2, 0xdff8ff, 0.65).setDepth(-1).setVisible(false),
  );
  const letters = MAZE_LETTER_POINTS.map(({ x, y }, index) => {
    const tile = scene.add.rectangle(0, 0, 34, 36, 0x2e493c).setStrokeStyle(2, 0xedc872);
    const glyph = scene.add.text(0, 1, MAZE_GLYPHS[index], { fontFamily: 'Georgia', fontSize: '26px', color: '#fff2c8' }).setOrigin(0.5);
    return scene.add.container(x, y, [tile, glyph]).setDepth(y - 1).setVisible(false);
  });
  return { hazards, checkpoints, letters };
}

export function preloadMazeTerrain(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TERRAIN_TEXTURE)) scene.load.image(TERRAIN_TEXTURE, terrainUrl);
}

function addTerrain(scene: Phaser.Scene): void {
  if (scene.textures.exists(TERRAIN_TEXTURE)) {
    scene.textures.get(TERRAIN_TEXTURE).setFilter(Phaser.Textures.FilterMode.NEAREST);
    scene.add.image(0, 0, TERRAIN_TEXTURE).setOrigin(0).setScale(MAZE_TERRAIN_SCALE).setDepth(-20);
    return;
  }

  // If the image is unavailable, draw the same layout as the collision geometry.
  const terrain = scene.add.graphics().setDepth(-20);
  terrain.fillStyle(Phaser.Display.Color.HexStringToColor(MAZE_PALETTE.stoneJoint).color)
    .fillRect(0, 0, MAZE_CONFIG.width, MAZE_CONFIG.height);
  terrain.fillStyle(Phaser.Display.Color.HexStringToColor(MAZE_PALETTE.hedgeBase).color);
  for (const wall of MAZE_WALLS) {
    terrain.fillRect(wall.left, wall.top, wall.right - wall.left, wall.bottom - wall.top);
  }
}

function hazardSprite(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const point = mazePoint(x, y);
  return scene.add.container(point.x, point.y).setDepth(4).setVisible(false);
}

function circleHazard(sprite: Phaser.GameObjects.Container, hitRadius: number): MazeHazard {
  return {
    sprite,
    hits: (x, y, radius) => Phaser.Math.Distance.Squared(x, y, sprite.x, sprite.y) < (radius + hitRadius) ** 2,
  };
}

function makeSkeleton(scene: Phaser.Scene, x: number, y: number): MazeHazard {
  const sprite = hazardSprite(scene, x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x1a1726).fillRect(-32, -40, 64, 80);
  g.fillStyle(0xf4f1ef).fillRect(-23, -39, 46, 25).fillRect(-29, -10, 58, 23)
    .fillRect(-22, 13, 17, 23).fillRect(5, 13, 17, 23);
  g.fillStyle(0xadacb6).fillRect(-20, -7, 40, 7).fillRect(-13, 4, 26, 7);
  g.fillStyle(0x23202d).fillRect(-14, -31, 9, 6).fillRect(5, -31, 9, 6);
  sprite.add(g);
  scene.tweens.add({ targets: g, y: -4, duration: 550, yoyo: true, repeat: -1 });
  return circleHazard(sprite, 18);
}

function makeBush(scene: Phaser.Scene, x: number, y: number): MazeHazard {
  const sprite = hazardSprite(scene, x, y);
  const g = scene.add.graphics();
  for (let i = -3; i <= 3; i += 1) {
    const leafY = 14 - Math.abs(i) * 12;
    g.fillStyle(i % 2 ? 0x5d9b21 : 0x9fce32).fillRect(i * 15 - 8, leafY, 16, 24);
    g.fillStyle(0xd2ed60).fillRect(i * 15 - 8, leafY, 8, 8);
  }
  g.fillStyle(0x48771b).fillRect(-21, 25, 42, 9);
  sprite.add(g);
  return circleHazard(sprite, 24);
}

function makePool(scene: Phaser.Scene): MazeHazard {
  const { x, y, width, height } = MAZE_HAZARDS.pool;
  const sprite = hazardSprite(scene, x, y);
  const w = width * MAZE_SCALE / 2;
  const h = height * MAZE_SCALE / 2;
  const g = scene.add.graphics();
  g.fillStyle(0x5bdcf4).fillRect(-w + 18, -h, w * 2 - 36, h * 2)
    .fillRect(-w, -h + 18, w * 2, h * 2 - 36);
  g.fillStyle(0x3199dd).fillRect(-w + 26, -h + 25, w * 2 - 52, h * 2 - 50);
  g.fillStyle(0x21519f).fillRect(-w + 58, -h + 53, w * 2 - 116, h * 2 - 106);
  const ripple = scene.add.graphics();
  ripple.fillStyle(0x62d2fd).fillRect(-48, -20, 23, 8).fillRect(25, 18, 26, 8).fillRect(79, -34, 10, 10);
  sprite.add([g, ripple]);
  scene.tweens.add({ targets: ripple, alpha: 0.25, duration: 720, yoyo: true, repeat: -1 });
  return {
    sprite,
    hits: (px, py, radius) => {
      const dx = Math.max(0, Math.abs(px - sprite.x) - (w - 4));
      const dy = Math.max(0, Math.abs(py - sprite.y) - (h - 4));
      return dx * dx + dy * dy < radius * radius;
    },
  };
}

function drawCastle(scene: Phaser.Scene): void {
  const point = mazePoint(207, 211);
  const g = scene.add.graphics().setPosition(point.x, point.y).setDepth(-10);
  g.fillStyle(0x292630).fillRect(-142, -16, 284, 16).fillRect(-130, -345, 260, 338);
  g.fillStyle(0x62616e).fillRect(-122, -335, 244, 322).fillRect(-154, -348, 308, 52);
  for (let i = 0; i < 4; i += 1) g.fillRect(-154 + i * 87, -386, 48, 48);
  for (let row = 0; row < 10; row += 1) {
    const offset = (row % 2) * 18;
    for (let col = 0; col < 4; col += 1) {
      g.fillStyle((row + col) % 3 ? 0x565562 : 0x797886);
      g.fillRect(-114 + offset + col * 49, -297 + row * 29, 28 + col * 4, 12);
    }
  }
  g.fillStyle(0x2b2021).fillRect(-48, -89, 96, 89).fillRect(-35, -112, 70, 38);
  g.fillStyle(0x774924).fillRect(-35, -83, 70, 83).fillRect(-22, -101, 44, 25);
  g.fillStyle(0xa26b35).fillRect(-19, -91, 11, 91).fillRect(16, -91, 11, 91);
  g.fillStyle(0x24212b).fillRect(-21, -240, 42, 35).fillRect(-12, -255, 24, 17);

  const exit = MAZE_CONFIG.exit;
  const marker = scene.add.graphics().setDepth(-2);
  marker.fillStyle(0xf6e6ff, 0.8).fillRect(exit.x - 3, exit.y - 49, 6, 39)
    .fillTriangle(exit.x, exit.y - 64, exit.x - 12, exit.y - 43, exit.x + 12, exit.y - 43);
}
