import Phaser from 'phaser';
import type { Point } from '../../network/types';
import { WORLD_BOUNDS, WORLD_CONFIG, type Obstacle } from '../config/worldConfig';

/** Источник виртуального ввода (экранный джойстик). Вектор длиной не более 1. */
export interface VirtualInput {
  getVector(): Point;
  reset(): void;
  setEnabled?(enabled: boolean): void;
}

type KeyMap = Record<
  'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'E',
  Phaser.Input.Keyboard.Key
>;

/**
 * Локальное управление персонажем: клавиатура (WASD / стрелки) + экранный джойстик.
 * Не знает ничего о сети — только считает новую позицию.
 */
export class MovementSystem {
  private keys: KeyMap | null = null;
  private direction: Point = { x: 0, y: 0 };

  private readonly onBlur = (): void => this.reset();
  private readonly onVisibility = (): void => {
    if (document.visibilityState !== 'visible') this.reset();
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly virtual: VirtualInput | null,
    private readonly obstacles: readonly Obstacle[],
    private readonly bounds: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    } = WORLD_BOUNDS,
    private readonly speed = WORLD_CONFIG.player.speed,
    private readonly playerRadius = WORLD_CONFIG.player.radius,
    private readonly resolveWalls?: (from: Point, target: Point) => Point,
  ) {
    const keyboard = scene.input.keyboard;
    if (keyboard) {
      this.keys = keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E') as KeyMap;
    }
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    scene.game.events.on(Phaser.Core.Events.BLUR, this.onBlur);
    scene.game.events.on(Phaser.Core.Events.HIDDEN, this.onBlur);
  }

  /** Текущее направление движения (длина 0..1, диагональ нормализована). */
  getDirection(): Point {
    return this.direction;
  }

  /** Одно нажатие E для взаимодействия (ПК). */
  consumeInteractPress(): boolean {
    const k = this.keys?.E;
    if (!k) return false;
    return Phaser.Input.Keyboard.JustDown(k);
  }

  /** Сбрасывает ввод: персонаж останавливается. */
  reset(): void {
    this.scene.input.keyboard?.resetKeys();
    this.virtual?.reset();
    this.direction = { x: 0, y: 0 };
  }

  /** Считает новую позицию за dtSeconds с учётом границ мира и препятствий. */
  step(pos: Point, dtSeconds: number): Point {
    this.direction = this.readDirection();
    if (this.direction.x === 0 && this.direction.y === 0) return pos;
    let x = pos.x + this.direction.x * this.speed * dtSeconds;
    let y = pos.y + this.direction.y * this.speed * dtSeconds;

    // Два прохода — достаточно, чтобы аккуратно «скользить» вдоль нескольких препятствий.
    for (let pass = 0; pass < 2; pass += 1) {
      for (const o of this.obstacles) {
        const minDist = o.r + this.playerRadius;
        const dx = x - o.x;
        const dy = y - o.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq) || 0.0001;
          x = o.x + (dx / dist) * minDist;
          y = o.y + (dy / dist) * minDist;
        }
      }
    }

    const target = {
      x: Phaser.Math.Clamp(x, this.bounds.minX, this.bounds.maxX),
      y: Phaser.Math.Clamp(y, this.bounds.minY, this.bounds.maxY),
    };
    return this.resolveWalls?.(pos, target) ?? target;
  }

  destroy(): void {
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.scene.game.events.off(Phaser.Core.Events.BLUR, this.onBlur);
    this.scene.game.events.off(Phaser.Core.Events.HIDDEN, this.onBlur);
    this.keys = null;
  }

  private readDirection(): Point {
    let x = 0;
    let y = 0;

    const k = this.keys;
    if (k) {
      x += (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      y += (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    }

    const v = this.virtual?.getVector();
    if (v) {
      x += v.x;
      y += v.y;
    }

    // Диагональ не быстрее прямой: вектор длиннее 1 приводится к длине 1.
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }
}
