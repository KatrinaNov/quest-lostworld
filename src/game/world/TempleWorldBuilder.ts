import Phaser from 'phaser';
import { TEMPLE_CONFIG, TEMPLE_PALETTE } from '../config/templeConfig';
import type { TempleTeamMember } from '../quest/templeQuestTypes';

export interface FallingPlatform {
  body: Phaser.GameObjects.Rectangle;
  activate(): void;
  update(time: number): void;
  destroy(): void;
}

/** Визуальная вращающаяся огненная цепь; попадание в любой шар смертельно. */
export interface LavaChain {
  update(time: number): void;
  hits(bounds: Phaser.Geom.Rectangle): boolean;
  destroy(): void;
}

interface LavaVisual { update(time: number): void; destroy(): void; }

export interface TemplePlate {
  body: Phaser.GameObjects.Rectangle;
  base: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  ownerId: string;
}

export interface TempleStar {
  readonly ownerIndex: number;
  readonly index: number;
  readonly bounds: Phaser.Geom.Rectangle;
  setOwner(member: TempleTeamMember | null, isSelf: boolean): void;
  setCollected(collected: boolean): void;
  update(time: number): void;
  destroy(): void;
}

export interface BuiltTempleWorld {
  solids: Phaser.Physics.Arcade.StaticGroup;
  falling: FallingPlatform[];
  lavaChains: LavaChain[];
  lavaVisuals: LavaVisual[];
  lava: Phaser.Geom.Rectangle[];
  checkpoints: Array<{ pole: Phaser.GameObjects.Rectangle; flag: Phaser.GameObjects.Triangle }>;
  plates: TemplePlate[];
  stars: TempleStar[];
  setPlateAssignments(team: TempleTeamMember[]): void;
  door: Phaser.GameObjects.Rectangle;
  openDoor(): void;
}

/** Рисует длинный боковой уровень из каменных блоков без внешних ассетов. */
export function buildTempleWorld(scene: Phaser.Scene): BuiltTempleWorld {
  const solids = scene.physics.add.staticGroup();
  const lava: Phaser.Geom.Rectangle[] = [];
  const falling: FallingPlatform[] = [];
  const lavaChains: LavaChain[] = [];
  const lavaVisuals: LavaVisual[] = [];
  const stars: TempleStar[] = [];
  const background = scene.add.graphics().setDepth(-30);
  drawBackdrop(scene, background);
  const graphics = scene.add.graphics().setDepth(-18);
  const block = (x: number, y: number, width: number, height = 42): Phaser.GameObjects.Rectangle => {
    drawStone(graphics, x - width / 2, y - height / 2, width, height);
    const part = scene.add.rectangle(x, y, width, height, 0xffffff, 0).setDepth(-10);
    solids.add(part);
    return part;
  };
  const lavaPit = (x: number, width: number): void => {
    lava.push(new Phaser.Geom.Rectangle(x - width / 2, 642, width, 118));
    lavaVisuals.push(addPixelLava(scene, x - width / 2, 642, width, 118));
  };

  // 1. Обучение.
  block(390, 684, 780, 88);
  block(340, 566, 136); block(500, 490, 126); block(670, 552, 136); block(825, 684, 84, 88);
  // Видимые кирпичные руины в стартовой части — не коллизии, а архитектура храма.
  // 2. Лава.
  lavaPit(1440, 1110);
  block(960, 556, 150); block(1170, 485, 130); block(1395, 550, 118); block(1620, 500, 120); block(1840, 560, 138);
  // Укороченная безопасная площадка после лавы: прыжок с последнего камня ≈81 px.
  block(2200, 684, 420, 88);
  // 3. Падающие платформы.
  lavaPit(2820, 1050);
  block(2390, 684, 90, 88);
  for (const [x, y] of [[2520, 550], [2740, 480], [2965, 550], [3165, 475]] as const) falling.push(addFallingPlatform(scene, x, y));
  block(3330, 684, 190, 88);
  // 4. Первый каменный зал — передышка перед продолжением храма.
  block(3670, 684, 490, 88);
  lavaPit(4000, 170);
  block(4345, 684, 520, 88);

  // 5. Бастион над лавой: мосты, арка и первые вращающиеся цепи.
  lavaPit(5350, 1450);
  block(4650, 560, 150); block(4870, 490, 130);
  // Широкий бастион — точка возрождения перед вращающимися цепями.
  block(5010, 684, 300, 88);
  block(5090, 550, 140);
  block(5310, 480, 130); block(5530, 545, 142); block(5750, 500, 138);
  lavaChains.push(addLavaChain(scene, 5350, 530, 94, 5), addLavaChain(scene, 5750, 510, 72, -4));
  // Чекпоинт остаётся на левой площадке; дальше — короткий провал и лестница.
  block(6140, 684, 500, 88);
  lavaPit(6480, 180);

  // 6. Руины и новый участок падающих мостов.
  // Каменная лестница: подъёмы 70–90 px при доступной высоте прыжка ~124 px.
  block(6780, 684, 400, 88);
  block(7100, 580, 110); block(7260, 510, 110); block(7420, 440, 110); block(7580, 500, 110);
  block(7720, 684, 460, 88);
  lavaPit(8450, 1000);
  block(8090, 560, 150); block(8310, 500, 132); block(8530, 550, 140);
  for (const [x, y] of [[8750, 500], [8920, 550]] as const) falling.push(addFallingPlatform(scene, x, y));
  block(9200, 684, 900, 88);

  // 7. Длинный лавовый коридор с вращающимися цепями.
  lavaPit(10400, 1500);
  block(9770, 560, 150); block(9990, 500, 135); block(10210, 550, 140);
  block(10430, 480, 130); block(10650, 540, 142); block(10870, 500, 138); block(10990, 560, 120);
  lavaChains.push(addLavaChain(scene, 10100, 520, 78, -5), addLavaChain(scene, 10600, 505, 105, 4), addLavaChain(scene, 10900, 525, 66, -6));
  block(11400, 684, 600, 88);

  // 8. Вертикальный подъём перед финалом; ниже только лава.
  lavaPit(12150, 900);
  block(11820, 570, 110); block(12000, 500, 110); block(12180, 430, 110);
  block(12360, 500, 110); block(12520, 570, 110);
  // Финальный зал с плитами и дверью.
  block(13040, 684, 880, 88);
  lavaPit(13520, 80);
  block(13680, 684, 240, 88);
  // Три звезды на каждого участника. Все позиции находятся над уже существующими
  // проходимыми платформами, поэтому трасса и её физика не меняются.
  const starPositions = [
    [[500, 444], [2600, 505], [4800, 442]],
    [[1170, 438], [3165, 430], [7100, 524]],
    [[1620, 450], [5530, 498], [8310, 454]],
    [[1840, 505], [7580, 454], [10870, 454]],
  ] as const;
  for (let ownerIndex = 0; ownerIndex < starPositions.length; ownerIndex += 1) {
    for (let index = 0; index < starPositions[ownerIndex].length; index += 1) {
      const [x, y] = starPositions[ownerIndex][index];
      stars.push(addTempleStar(scene, x, y, ownerIndex, index));
    }
  }

  const plates: TemplePlate[] = [];
  let plateSignature = '';
  const setPlateAssignments = (team: TempleTeamMember[]): void => {
    const signature = team.map((member) => `${member.id}|${member.name}|${member.color}`).join(';');
    if (signature === plateSignature) return;
    plateSignature = signature;
    for (const plate of plates.splice(0)) {
      plate.body.destroy(); plate.base.destroy(); plate.label.destroy();
    }
    const count = Math.max(1, Math.min(4, team.length));
    const spacing = 180;
    const center = 13070;
    for (let i = 0; i < count; i += 1) {
      const member = team[i];
      const x = center + (i - (count - 1) / 2) * spacing;
      const base = scene.add.rectangle(x, 625, 118, 12, TEMPLE_PALETTE.stoneDark).setDepth(1);
      const body = scene.add.rectangle(x, 617, 104, 14, member?.color ?? TEMPLE_PALETTE.plate).setDepth(2);
      const label = scene.add.text(x, 592, member?.name ?? '', {
        fontFamily: 'monospace', fontSize: '12px', color: '#fff5dc', stroke: '#11141b', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(8);
      plates.push({ body, base, label, ownerId: member?.id ?? '' });
    }
  };
  const door = scene.add.rectangle(13670, 548, 74, 184, TEMPLE_PALETTE.stoneDark, 0).setDepth(5);
  scene.physics.add.existing(door, true);
  drawDoor(graphics, 13670, 548);
  const checkpoints = TEMPLE_CONFIG.checkpoints.map((point) => {
    // Основание тонкого флагштока совпадает с верхом пола y=640.
    const pole = scene.add.rectangle(point.x, 612, 4, 56, 0xd7dadd).setDepth(3);
    const flag = scene.add.triangle(point.x + 13, 587, 0, 0, 17, 6, 0, 13, 0xf0b84b).setDepth(4);
    return { pole, flag };
  });
  return { solids, falling, lavaChains, lavaVisuals, lava, checkpoints, plates, stars, setPlateAssignments, door, openDoor: () => {
    if (!door.active) return;
    (door.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    scene.tweens.add({ targets: door, y: 420, alpha: 0, duration: 550, ease: 'Quad.out', onComplete: () => door.destroy() });
  } };
}

function addFallingPlatform(scene: Phaser.Scene, x: number, y: number): FallingPlatform {
  const visual = scene.add.graphics().setPosition(x, y).setDepth(-9);
  const render = (cracked: boolean): void => {
    visual.clear();
    drawStone(visual, -68, -18, 136, 36);
    if (!cracked) return;
    visual.lineStyle(2, 0x242a30, 1);
    visual.lineBetween(-22, -16, -8, -3); visual.lineBetween(-8, -3, -17, 13);
    visual.lineBetween(30, -17, 20, 1); visual.lineBetween(20, 1, 34, 14);
  };
  render(false);
  const body = scene.add.rectangle(x, y, 136, 36, 0xffffff, 0).setDepth(-9);
  scene.physics.add.existing(body, true);
  const physics = body.body as Phaser.Physics.Arcade.StaticBody;
  let state: 'normal' | 'shaking' | 'fallen' = 'normal';
  let changedAt = 0;
  return {
    body,
    activate: () => { if (state === 'normal') { state = 'shaking'; changedAt = scene.time.now; render(true); } },
    update: (time) => {
      if (state === 'shaking') {
        body.x = x + Math.sin((time - changedAt) / 28) * 3; visual.x = body.x; physics.updateFromGameObject();
        if (time - changedAt > 900) { state = 'fallen'; changedAt = time; visual.setVisible(false); physics.enable = false; }
      } else if (state === 'fallen' && time - changedAt > 2500) {
        state = 'normal'; body.setPosition(x, y); visual.setPosition(x, y).setVisible(true); render(false); physics.enable = true; physics.updateFromGameObject();
      }
    },
    destroy: () => { body.destroy(); visual.destroy(); },
  };
}

/** Маленькая пятиконечная пиксельная звезда. Коллизии у неё нет: сбор проверяет сцена. */
function addTempleStar(scene: Phaser.Scene, x: number, y: number, ownerIndex: number, index: number): TempleStar {
  const g = scene.add.graphics().setDepth(9);
  const bounds = new Phaser.Geom.Rectangle(x - 12, y - 12, 24, 24);
  let visible = false;
  let collected = false;
  let color = 0xffffff;
  let self = false;
  const draw = (time = 0): void => {
    g.clear();
    if (!visible || collected) return;
    const bob = Math.round(Math.sin(time / 230 + ownerIndex * 1.7 + index) * 2);
    const alpha = self ? 1 : 0.38;
    const px = x;
    const py = y + bob;
    // Чёткая пиксельная форма без сглаживания и свечения.
    g.fillStyle(0x1a1b22, alpha).fillRect(px - 3, py - 11, 6, 22).fillRect(px - 11, py - 3, 22, 6);
    g.fillStyle(color, alpha).fillRect(px - 3, py - 10, 6, 20).fillRect(px - 10, py - 3, 20, 6);
    g.fillStyle(0xfff0a5, alpha).fillRect(px - 2, py - 7, 4, 8).fillRect(px - 7, py - 2, 8, 4);
  };
  return {
    ownerIndex,
    index,
    bounds,
    setOwner(member: TempleTeamMember | null, isSelf: boolean): void {
      visible = member !== null;
      color = member?.color ?? 0xffffff;
      self = isSelf;
      draw(scene.time.now);
    },
    setCollected(next: boolean): void { collected = next; draw(scene.time.now); },
    update(time: number): void { if (visible && !collected) draw(time); },
    destroy(): void { g.destroy(); },
  };
}

/** Небольшая циклическая пиксельная волна без частиц и размытия. */
function addPixelLava(scene: Phaser.Scene, x: number, y: number, width: number, height: number): LavaVisual {
  const visual = scene.add.graphics().setDepth(-19);
  const draw = (frame: number): void => {
    visual.clear();
    visual.fillStyle(0xc92e16, 1).fillRect(x, y, width, height);
    visual.fillStyle(0xf05a1f, 1).fillRect(x, y + 14, width, height - 14);
    for (let px = x - 12; px < x + width + 12; px += 18) {
      const wave = ((Math.floor(px / 18) + frame) % 3) * 4;
      visual.fillStyle(0xffc33e, 1).fillRect(px, y + wave, 13, 6);
      visual.fillStyle(0xff7b24, 1).fillRect(px + 5, y + 8 + wave, 9, 5);
    }
    for (let px = x + 4; px < x + width; px += 38) visual.fillStyle(0xff9d2e, 1).fillRect(px, y + 43 + ((frame + px) % 2) * 9, 17, 5);
  };
  draw(0);
  let currentFrame = 0;
  return {
    update: (time) => {
      const frame = Math.floor(time / 180) % 3;
      if (frame === currentFrame) return;
      currentFrame = frame;
      draw(frame);
    },
    destroy: () => visual.destroy(),
  };
}

function addLavaChain(scene: Phaser.Scene, x: number, y: number, radius: number, speed: number): LavaChain {
  const pivot = scene.add.graphics().setDepth(4);
  pivot.fillStyle(TEMPLE_PALETTE.stoneDark, 1).fillCircle(x, y, 18);
  pivot.fillStyle(TEMPLE_PALETTE.stone, 1).fillCircle(x, y, 12);
  const balls = Array.from({ length: 5 }, () => scene.add.circle(x, y, 13, TEMPLE_PALETTE.lava).setDepth(6));
  const chain = scene.add.graphics().setDepth(5);
  const points = balls.map(() => new Phaser.Geom.Point(x, y));
  return {
    update(time: number): void {
      const angle = (time / 1000) * speed;
      chain.clear().lineStyle(5, 0x6b4a32, 1);
      let previous = new Phaser.Geom.Point(x, y);
      for (let i = 0; i < balls.length; i += 1) {
        const d = radius * ((i + 1) / balls.length);
        const px = x + Math.cos(angle) * d;
        const py = y + Math.sin(angle) * d;
        points[i].setTo(px, py);
        chain.lineBetween(previous.x, previous.y, px, py);
        previous = points[i];
        balls[i].setPosition(px, py);
        balls[i].setFillStyle(i % 2 === 0 ? TEMPLE_PALETTE.lavaLight : TEMPLE_PALETTE.lava);
      }
    },
    hits(bounds: Phaser.Geom.Rectangle): boolean {
      return points.some((point) => Phaser.Geom.Intersects.CircleToRectangle(new Phaser.Geom.Circle(point.x, point.y, 15), bounds));
    },
    destroy(): void { pivot.destroy(); chain.destroy(); for (const ball of balls) ball.destroy(); },
  };
}

function drawBackdrop(_scene: Phaser.Scene, g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(TEMPLE_PALETTE.background, 1).fillRect(0, 0, TEMPLE_CONFIG.width, TEMPLE_CONFIG.height);
}

function drawStone(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number): void {
  const brickW = 20;
  const brickH = 14;
  g.fillStyle(0x171b24, 1).fillRect(x, y, width, height);
  for (let py = y + 1, row = 0; py < y + height - 1; py += brickH, row += 1) {
    const offset = row % 2 === 0 ? 0 : -brickW / 2;
    for (let px = x + offset; px < x + width; px += brickW) {
      const shade = (row + Math.floor((px - x) / brickW)) % 3;
      g.fillStyle(shade === 0 ? 0xa7adb2 : shade === 1 ? 0x858d96 : 0x707984, 1);
      g.fillRect(px + 1, py + 1, brickW - 2, brickH - 2);
      g.lineStyle(1, 0x303741, 1).strokeRect(px + 0.5, py + 0.5, brickW - 1, brickH - 1);
      g.fillStyle(0xd2d6d7, 0.55).fillRect(px + 3, py + 2, brickW - 7, 2);
    }
  }
}

function drawDoor(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  drawStone(g, x - 58, y - 102, 116, 204);
  g.fillStyle(0x090b10, 1).fillRect(x - 30, y - 76, 60, 178);
  g.fillRect(x - 22, y - 94, 44, 22);
  g.fillRect(x - 14, y - 108, 28, 18);
  g.fillStyle(0xd2d6d7, 1);
  for (let py = y - 98; py < y + 102; py += 28) {
    g.fillRect(x - 62, py, 12, 8); g.fillRect(x + 50, py, 12, 8);
  }
}
