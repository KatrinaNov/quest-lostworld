import type { VirtualInput } from '../game/systems/MovementSystem';
import type { Point } from '../network/types';

const BASE_SIZE = 140;
const MAX_RADIUS = 52;
const DEAD_ZONE = 0.14;

/**
 * Экранный джойстик на pointer events.
 * Зона касания — нижняя левая часть экрана; джойстик «появляется» под пальцем.
 * Отпускание, отмена касания, потеря фокуса или скрытие вкладки сбрасывают ввод.
 */
export class MobileControls implements VirtualInput {
  private readonly zone: HTMLElement;
  private readonly base: HTMLElement;
  private readonly knob: HTMLElement;

  private pointerId: number | null = null;
  private vector: Point = { x: 0, y: 0 };
  private center: Point = { x: 0, y: 0 };

  private readonly onWindowBlur = (): void => this.reset();
  private readonly onVisibility = (): void => {
    if (document.visibilityState !== 'visible') this.reset();
  };

  /** Показывать экранное управление на устройствах с сенсорным экраном (или при ?touch=1). */
  static isNeeded(): boolean {
    const forced = new URLSearchParams(window.location.search).get('touch') === '1';
    return forced || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
  }

  constructor(parent: HTMLElement) {
    this.zone = document.createElement('div');
    this.zone.className = 'joystick-zone';

    this.base = document.createElement('div');
    this.base.className = 'joystick-base';
    this.knob = document.createElement('div');
    this.knob.className = 'joystick-knob';
    this.base.appendChild(this.knob);
    this.zone.appendChild(this.base);
    parent.appendChild(this.zone);

    this.zone.addEventListener('pointerdown', this.onPointerDown);
    this.zone.addEventListener('pointermove', this.onPointerMove);
    this.zone.addEventListener('pointerup', this.onPointerEnd);
    this.zone.addEventListener('pointercancel', this.onPointerEnd);
    this.zone.addEventListener('lostpointercapture', this.onPointerEnd);
    this.zone.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  getVector(): Point {
    return this.vector;
  }

  reset(): void {
    this.pointerId = null;
    this.vector = { x: 0, y: 0 };
    this.knob.style.transform = 'translate(0px, 0px)';
    this.base.classList.remove('joystick-base--active');
    this.base.style.removeProperty('--jx');
    this.base.style.removeProperty('--jy');
  }

  destroy(): void {
    this.reset();
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.zone.remove();
  }

  // -------------------------------------------------------------- события

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.pointerId !== null) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    try {
      this.zone.setPointerCapture(e.pointerId);
    } catch {
      // не критично: события всё равно придут, пока палец над зоной
    }

    // Джойстик появляется под пальцем, но остаётся внутри зоны.
    const rect = this.zone.getBoundingClientRect();
    const half = BASE_SIZE / 2;
    const cx = Math.min(Math.max(e.clientX, rect.left + half), rect.right - half);
    const cy = Math.min(Math.max(e.clientY, rect.top + half), rect.bottom - half);
    this.center = { x: cx, y: cy };
    this.base.style.setProperty('--jx', `${cx - rect.left - half}px`);
    this.base.style.setProperty('--jy', `${cy - rect.top - half}px`);
    this.base.classList.add('joystick-base--active');
    this.updateVector(e.clientX, e.clientY);
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.updateVector(e.clientX, e.clientY);
  };

  private readonly onPointerEnd = (e: PointerEvent): void => {
    if (this.pointerId !== null && e.pointerId !== this.pointerId) return;
    try {
      if (this.pointerId !== null && this.zone.hasPointerCapture(e.pointerId)) {
        this.zone.releasePointerCapture(e.pointerId);
      }
    } catch {
      // игнорируем
    }
    this.reset();
  };

  private updateVector(clientX: number, clientY: number): void {
    const dx = clientX - this.center.x;
    const dy = clientY - this.center.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, MAX_RADIUS);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;

    this.knob.style.transform = `translate(${nx * clamped}px, ${ny * clamped}px)`;

    const strength = clamped / MAX_RADIUS;
    this.vector = strength < DEAD_ZONE ? { x: 0, y: 0 } : { x: nx * strength, y: ny * strength };
  }
}
