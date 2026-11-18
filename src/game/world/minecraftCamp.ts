import type Phaser from 'phaser';
import { MC_PALETTE } from '../config/minecraftWorldConfig';
import type { Obstacle } from '../config/worldConfig';
import { JUNGLE_CAMP } from '../quest/jungleQuestConfig';

const CRATES = [[-132, 49], [178, 65], [134, 121], [-76, 136]] as const;

/** Кубические объекты лагеря. Графика рисуется один раз при создании сцены. */
export function addMinecraftCamp(scene: Phaser.Scene, obstacles: Obstacle[]): void {
  const { x, y, note } = JUNGLE_CAMP;
  const ground = scene.add.graphics().setDepth(-20);
  ground.fillStyle(0x69522f, 0.32).fillRect(x - 112, y - 16, 224, 66);
  ground.fillStyle(0xb59154, 0.20).fillRect(x - 126, y, 250, 40);

  drawShelter(scene.add.graphics().setDepth(y + 24), x, y);
  for (const [dx, dy] of CRATES) {
    const crateX = x + dx;
    const crateY = y + dy;
    drawChest(scene.add.graphics().setDepth(crateY + 21), crateX, crateY);
    obstacles.push({ x: crateX, y: crateY, r: 30 });
  }
  drawNoteTable(scene, note.x, note.y);
  drawCampfire(scene.add.graphics().setDepth(y + 162), x - 16, y + 145);

  obstacles.push(
    { x: x - 62, y: y - 18, r: 38 }, { x, y: y - 54, r: 38 }, { x: x + 62, y: y - 18, r: 38 },
    { x: note.x, y: note.y + 1, r: 44 }, { x: x - 16, y: y + 145, r: 38 },
  );
}

function drawShelter(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(0x493520).fillRect(x - 90, y - 16, 180, 40);
  g.fillStyle(MC_PALETTE.wood).fillRect(x - 78, y - 34, 156, 51);
  for (let plank = -72; plank < 76; plank += 19) {
    g.fillStyle(plank % 2 ? 0x93663d : 0xb1824c).fillRect(x + plank, y - 20, 16, 35);
  }

  const roofTones = [0xd2b376, 0xc9a569, 0xe3c68d] as const;
  for (let row = 0; row < 10; row += 1) {
    const half = 12 + row * 10;
    const top = y - 94 + row * 10;
    g.fillStyle(0x695136).fillRect(x - half - 3, top, half * 2 + 6, 10);
    g.fillStyle(roofTones[row % roofTones.length]).fillRect(x - half, top, half, 8);
    g.fillStyle(row % 2 ? 0xa98251 : 0xb78d57).fillRect(x, top, half, 8);
    g.fillStyle(0xf0d5a0, 0.48).fillRect(x - half + 4, top, half - 6, 2);
    g.fillStyle(0x85613e, 0.55).fillRect(x + 3, top + 7, half - 7, 2);
  }

  g.fillStyle(0x2c241a).fillRect(x - 22, y - 27, 44, 50);
  g.fillStyle(0x735035).fillRect(x - 28, y - 31, 7, 54).fillRect(x + 21, y - 31, 7, 54);
  g.fillStyle(0xb1814c).fillRect(x - 28, y - 32, 56, 7).fillRect(x - 29, y + 18, 58, 7);
  g.fillStyle(0x8c6941).fillRect(x - 11, y + 4, 22, 13);
  g.fillStyle(0xf4ce79).fillRect(x - 7, y + 5, 14, 4);
  drawLantern(g, x - 62, y - 5);
  drawLantern(g, x + 62, y - 5);
}

function drawLantern(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(0xffc45b, 0.20).fillRect(x - 12, y - 11, 24, 21);
  g.fillStyle(0x3e3027).fillRect(x - 7, y - 8, 14, 16).fillRect(x - 3, y - 11, 6, 4);
  g.fillStyle(0xeaa341).fillRect(x - 4, y - 5, 8, 10);
  g.fillStyle(0xffe6a0).fillRect(x - 2, y - 4, 4, 8);
}

function drawChest(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(0x36291d).fillRect(x - 24, y - 19, 48, 39);
  g.fillStyle(0x9b693a).fillRect(x - 21, y - 2, 42, 18);
  g.fillStyle(0xbd8b4c).fillRect(x - 21, y - 16, 42, 12);
  g.fillStyle(0xddae68).fillRect(x - 20, y - 15, 40, 3);
  g.fillStyle(0x70502d).fillRect(x - 17, y - 13, 4, 25).fillRect(x + 13, y - 13, 4, 25);
  g.fillStyle(0xe7c47b).fillRect(x - 4, y - 6, 8, 12);
  g.fillStyle(0x735537).fillRect(x - 1, y, 2, 4);
}

function drawNoteTable(scene: Phaser.Scene, x: number, y: number): void {
  const g = scene.add.graphics().setDepth(y + 16);
  g.fillStyle(0x634129).fillRect(x - 52, y - 6, 104, 17).fillRect(x - 48, y + 7, 9, 14).fillRect(x + 39, y + 7, 9, 14);
  for (let i = 0; i < 6; i += 1) {
    g.fillStyle(i % 2 ? 0xaf7c45 : 0xc49655).fillRect(x - 52 + i * 17.7, y - 20, 17, 18);
  }
  g.fillStyle(0x89663e).fillRect(x - 20, y - 18, 40, 17);
  g.fillStyle(0xf5d799).fillRect(x - 21, y - 20, 39, 17);
  g.fillStyle(0x96704b).fillRect(x - 15, y - 16, 20, 2).fillRect(x - 15, y - 11, 15, 2);
  g.fillStyle(0xa6533b).fillRect(x + 8, y - 10, 7, 6);

  const marker = scene.add.graphics().setPosition(x, y - 44).setDepth(y + 18);
  marker.fillStyle(0xf7c963, 0.22).fillRect(-12, -12, 24, 24);
  marker.fillStyle(0x4f3d23).fillRect(-9, -9, 18, 18);
  marker.fillStyle(0xffdda0).fillRect(-6, -6, 12, 12);
  marker.fillStyle(0x9a7445).fillRect(-4, -3, 8, 2).fillRect(-4, 1, 6, 2);
  scene.tweens.add({ targets: marker, y: y - 51, duration: 880, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

  const light = scene.add.graphics().setDepth(y + 17);
  light.lineStyle(3, 0xffd572, 0.92).strokeRect(x - 55, y - 23, 110, 24);
  scene.tweens.add({ targets: light, alpha: 0.43, duration: 980, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
}

function drawCampfire(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(0xffbb55, 0.18).fillRect(x - 38, y - 24, 76, 45);
  g.fillStyle(0x493523).fillRect(x - 20, y - 8, 40, 15);
  for (const [dx, dy] of [[-25, -12], [14, -12], [-25, 9], [14, 9]] as const) {
    g.fillStyle(MC_PALETTE.stoneDark).fillRect(x + dx, y + dy, 14, 11);
    g.fillStyle(MC_PALETTE.stone).fillRect(x + dx, y + dy, 14, 4);
  }
  g.fillStyle(0xd96a2d).fillRect(x - 14, y - 15, 29, 17).fillRect(x - 8, y - 29, 10, 18);
  g.fillStyle(0xf7ac43).fillRect(x - 10, y - 18, 22, 16).fillRect(x + 4, y - 24, 6, 10);
  g.fillStyle(0xffe691).fillRect(x - 5, y - 9, 13, 9).fillRect(x - 3, y - 19, 6, 13);
  g.fillStyle(0xffca73, 0.85).fillRect(x + 12, y - 35, 4, 4).fillRect(x - 12, y - 39, 3, 3);
}
