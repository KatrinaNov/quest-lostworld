import Phaser from 'phaser';
import type { Player } from '../../network/types';
import { PALETTE, WORLD_CONFIG } from '../config/worldConfig';

const NAME_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function shade(color: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  return (amount >= 0 ? c.lighten(amount) : c.darken(-amount)).color;
}

/**
 * Визуальное представление игрока в мире: персонаж, имя, подсветка для локального игрока.
 * Не содержит сетевой логики — только отображение и сглаживание движения.
 */
export class PlayerAvatar extends Phaser.GameObjects.Container {
  readonly playerId: string;
  readonly isLocal: boolean;

  private readonly visual: Phaser.GameObjects.Container;
  private readonly body_: Phaser.GameObjects.Graphics;
  private readonly head: Phaser.GameObjects.Graphics;
  private readonly ring: Phaser.GameObjects.Graphics | null = null;
  private readonly arrow: Phaser.GameObjects.Graphics | null = null;
  private readonly label: Phaser.GameObjects.Text;

  private color: number;
  private facing = { x: 0, y: 1 };
  private facingStep = -1;
  private moving = false;
  private walkPhase = 0;

  private targetX: number;
  private targetY: number;

  constructor(scene: Phaser.Scene, player: Player, isLocal: boolean) {
    super(scene, player.x, player.y);
    this.playerId = player.id;
    this.isLocal = isLocal;
    this.color = player.color;
    this.targetX = player.x;
    this.targetY = player.y;

    const shadow = scene.add.ellipse(0, 12, 38, 16, 0x000000, 0.3);

    if (isLocal) {
      this.ring = scene.add.graphics();
      this.ring.lineStyle(3, PALETTE.glowGold, 1);
      this.ring.strokeEllipse(0, 10, 54, 26);
      this.ring.lineStyle(8, PALETTE.glowGold, 0.25);
      this.ring.strokeEllipse(0, 10, 54, 26);
    }

    this.body_ = scene.add.graphics();
    this.head = scene.add.graphics();
    this.visual = scene.add.container(0, 0, [this.body_, this.head]);

    this.label = scene.add
      .text(0, -34, player.name, {
        fontFamily: NAME_FONT,
        fontSize: '20px',
        fontStyle: '700',
        color: isLocal ? PALETTE.nameTextSelf : PALETTE.nameText,
        stroke: '#0b1511',
        strokeThickness: 5,
        resolution: 2,
      })
      .setOrigin(0.5, 1);

    if (isLocal) {
      this.arrow = scene.add.graphics();
      this.arrow.fillStyle(PALETTE.glowGold, 1);
      this.arrow.fillTriangle(-8, 0, 8, 0, 0, 9);
      this.arrow.lineStyle(2, 0x0b1511, 0.9);
      this.arrow.strokeTriangle(-8, 0, 8, 0, 0, 9);
    }

    const children: Phaser.GameObjects.GameObject[] = [shadow];
    if (this.ring) children.push(this.ring);
    children.push(this.visual, this.label);
    if (this.arrow) children.push(this.arrow);
    this.add(children);

    this.drawBody();
    this.drawHead();
    this.layoutLabel();
    scene.add.existing(this);
    this.setDepth(this.y);
  }

  // -------------------------------------------------------------- данные

  setIdentity(name: string, color: number): void {
    if (this.label.text !== name) {
      this.label.setText(name);
      this.layoutLabel();
    }
    if (color !== this.color) {
      this.color = color;
      this.drawBody();
      this.drawHead();
    }
  }

  /** Новая сетевая цель для удалённого игрока. */
  setTarget(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  // -------------------------------------------------------------- обновление

  /** Локальный игрок: позиция задаётся напрямую, без задержки. */
  tickLocal(x: number, y: number, dir: { x: number; y: number }, timeMs: number): void {
    this.setPosition(x, y);
    this.targetX = x;
    this.targetY = y;
    const isMoving = dir.x !== 0 || dir.y !== 0;
    this.applyMotion(isMoving, dir, timeMs);
    this.pulse(timeMs);
    this.setDepth(this.y);
  }

  /** Удалённый игрок: плавно догоняем сетевую цель. */
  tickRemote(deltaMs: number, timeMs: number): void {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > WORLD_CONFIG.remote.teleportDistance) {
      this.setPosition(this.targetX, this.targetY);
      this.applyMotion(false, this.facing, timeMs);
    } else {
      const k = 1 - Math.exp((-WORLD_CONFIG.remote.smoothing * deltaMs) / 1000);
      this.setPosition(this.x + dx * k, this.y + dy * k);
      const isMoving = dist > 1.5;
      this.applyMotion(isMoving, isMoving ? { x: dx / dist, y: dy / dist } : this.facing, timeMs);
    }
    this.setDepth(this.y);
  }

  // -------------------------------------------------------------- отрисовка

  private applyMotion(isMoving: boolean, dir: { x: number; y: number }, timeMs: number): void {
    this.moving = isMoving;
    if (isMoving) {
      const len = Math.hypot(dir.x, dir.y) || 1;
      this.facing = { x: dir.x / len, y: dir.y / len };
      this.walkPhase = timeMs / 70;
    }

    const bob = this.moving ? Math.abs(Math.sin(this.walkPhase)) : 0;
    this.visual.setY(-bob * 4);
    this.visual.setScale(1 + bob * 0.04, 1 - bob * 0.05);

    const step = Math.round((Math.atan2(this.facing.y, this.facing.x) / Math.PI) * 4);
    if (step !== this.facingStep) {
      this.facingStep = step;
      this.drawHead();
    }
  }

  private pulse(timeMs: number): void {
    if (this.ring) this.ring.setAlpha(0.65 + 0.3 * Math.sin(timeMs / 280));
    if (this.arrow) this.arrow.setY(this.label.y - this.label.height - 12 + Math.sin(timeMs / 220) * 3);
  }

  private layoutLabel(): void {
    if (this.arrow) this.arrow.setY(this.label.y - this.label.height - 12);
  }

  private drawBody(): void {
    const g = this.body_;
    g.clear();
    // плащ
    g.fillStyle(shade(this.color, -35), 1);
    g.fillCircle(0, 2, 19);
    g.fillStyle(this.color, 1);
    g.fillCircle(0, 0, 17);
    g.fillStyle(shade(this.color, 28), 0.85);
    g.fillEllipse(-5, -5, 14, 9);
    g.lineStyle(2, 0x0b1511, 0.55);
    g.strokeCircle(0, 0, 17);
  }

  private drawHead(): void {
    const g = this.head;
    g.clear();
    const fx = this.facing.x;
    const fy = this.facing.y;
    // капюшон
    g.fillStyle(shade(this.color, -20), 1);
    g.fillCircle(0, -3, 12.5);
    g.lineStyle(2, 0x0b1511, 0.5);
    g.strokeCircle(0, -3, 12.5);
    // лицо смещено по направлению взгляда
    const faceX = fx * 5;
    const faceY = -3 + fy * 4.5;
    g.fillStyle(0xf3d6b4, 1);
    g.fillCircle(faceX, faceY, 7.5);
    // глаза
    const px = -fy;
    const py = fx;
    g.fillStyle(0x1b2a24, 1);
    g.fillCircle(faceX + fx * 2.4 + px * 3, faceY + fy * 2.4 + py * 3, 1.5);
    g.fillCircle(faceX + fx * 2.4 - px * 3, faceY + fy * 2.4 - py * 3, 1.5);
  }
}
