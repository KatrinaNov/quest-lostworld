import type Phaser from 'phaser';
import type { GameBridge, Player, Point } from '../../network/types';
import { CASTLE_MIRRORS } from '../config/castleConfig';
import type { Obstacle } from '../config/worldConfig';
import { buildCastleMirrors, CASTLE_MIRROR_REACH } from '../world/CastleMirrors';
import { CASTLE_MIRROR_SEAL, CASTLE_MIRROR_STEPS, initialCastleQuestState, isCastleSealOpen, type CastleQuestState } from './castleQuestTypes';

const HEARTBEAT_MS = 740;
const TURN_INTERVAL_MS = 115;

export class CastleMirrorPuzzle {
  private readonly world: ReturnType<typeof buildCastleMirrors>;
  private readonly controls: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly hint: HTMLElement;
  private readonly count: HTMLElement;
  private readonly touch = window.matchMedia('(pointer: coarse)');
  private state = initialCastleQuestState();
  private roster: string[] = [];
  private ownSlot = -1;
  private step: number | null = null;
  private sent: number | null = null;
  private pending = false;
  private releaseOwed = false;
  private lastRequest = -Infinity;
  private retryAt = 0;
  private available = false;
  private key: 'KeyE' | 'Space' | null = null;
  private gesture: { id: number; x: number; step: number } | null = null;

  constructor(scene: Phaser.Scene, ui: HTMLElement, private readonly bridge: GameBridge, obstacles: Obstacle[],
    private readonly stopMovement: () => void) {
    this.world = buildCastleMirrors(scene, obstacles);
    this.controls = document.createElement('section');
    this.controls.className = 'castle-mirror-controls';
    this.controls.hidden = true;
    this.controls.innerHTML = '<p class="castle-mirror-count"></p><button type="button" class="castle-mirror-grip" aria-pressed="false">Держать зеркало</button>' +
      '<p class="castle-mirror-hint">Держите E и нажимайте ← или →</p>';
    this.count = this.controls.querySelector('.castle-mirror-count')!;
    this.button = this.controls.querySelector('button')!;
    this.hint = this.controls.querySelector('.castle-mirror-hint')!;
    ui.append(this.controls);

    this.button.addEventListener('pointerdown', this.onPointerDown);
    this.button.addEventListener('pointermove', this.onPointerMove);
    this.button.addEventListener('pointerup', this.onPointerEnd);
    this.button.addEventListener('pointercancel', this.onPointerEnd);
    this.button.addEventListener('lostpointercapture', this.onPointerEnd);
    this.button.addEventListener('contextmenu', (event) => event.preventDefault());
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keyup', this.onKeyUp, true);
    window.addEventListener('blur', this.release);
    window.addEventListener('pagehide', this.release);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  setState(state: CastleQuestState): void {
    this.state = state;
    if (this.roster.join() !== state.mirrorTeam.join()) {
      this.release();
      this.roster = state.mirrorTeam;
      this.ownSlot = this.roster.indexOf(this.bridge.self.id);
      this.setPlayers(this.bridge.getPlayers());
    }
    if (isCastleSealOpen(state, CASTLE_MIRROR_SEAL)) this.release();
  }

  setPlayers(players: Player[]): void {
    for (const [slot, mirror] of this.world.entries()) {
      const id = this.roster[slot];
      mirror.configure(players.find((player) => player.id === id), Boolean(id), slot === this.ownSlot, slot);
    }
  }

  isHolding(): boolean { return this.step !== null; }

  update(position: Point, canInteract: boolean): boolean {
    const now = performance.now();
    const utc = Date.now();
    const open = isCastleSealOpen(this.state, CASTLE_MIRROR_SEAL);
    const nearby = CASTLE_MIRRORS[this.ownSlot];
    this.available = canInteract && !open && this.bridge.getStatus() === 'connected' && Boolean(nearby)
      && Math.hypot(position.x - nearby.x, position.y - nearby.y) < CASTLE_MIRROR_REACH;
    if (!this.available && this.step !== null) this.release();
    this.controls.hidden = !this.available;

    let beams = 0;
    for (const [slot, mirror] of this.world.entries()) {
      const hold = this.state.mirrorHolds[this.roster[slot]];
      const step = open ? null : slot === this.ownSlot ? this.step : hold && hold.expiresAt > utc ? hold.step : null;
      mirror.aim(step);
      if (step === 0) beams += 1;
    }
    if (this.available) {
      const status = `Лучи на печати ${beams}/${this.roster.length}`;
      if (this.count.textContent !== status) this.count.textContent = status;
      const hint = this.retryAt > now ? 'Восстанавливаем связь…' : this.step === 0
        ? 'Луч на печати. Продолжайте держать!' : this.gesture || this.touch.matches
          ? 'Удерживайте кнопку и ведите влево или вправо'
          : 'Держите E и нажимайте ← или →';
      if (this.hint.textContent !== hint) this.hint.textContent = hint;
    }
    this.send(now);
    return this.available;
  }

  destroy(): void {
    this.available = false;
    this.release();
    this.controls.remove();
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    window.removeEventListener('blur', this.release);
    window.removeEventListener('pagehide', this.release);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  readonly release = (): void => {
    if (this.step === null) return;
    this.step = null;
    this.releaseOwed = this.sent !== null;
    this.key = null;
    const pointer = this.gesture?.id;
    this.gesture = null;
    if (pointer !== undefined && this.button.hasPointerCapture(pointer)) this.button.releasePointerCapture(pointer);
    this.button.setAttribute('aria-pressed', 'false');
    this.stopMovement();
    this.send(performance.now());
  };

  private grip(): boolean {
    if (!this.available || this.step !== null || this.bridge.getStatus() !== 'connected') return false;
    this.step = CASTLE_MIRRORS[this.ownSlot].restStep;
    this.stopMovement();
    this.button.setAttribute('aria-pressed', 'true');
    this.send(performance.now());
    return true;
  }

  private turn(step: number): void {
    this.step = (step % CASTLE_MIRROR_STEPS + CASTLE_MIRROR_STEPS) % CASTLE_MIRROR_STEPS;
    this.send(performance.now());
  }

  private send(now: number): void {
    if (this.pending || now < this.retryAt || isCastleSealOpen(this.state, CASTLE_MIRROR_SEAL)) return;
    const step = this.releaseOwed ? null : this.step;
    if (step === null ? this.sent === null : now - this.lastRequest < (step === this.sent ? HEARTBEAT_MS : TURN_INTERVAL_MS)) return;
    this.lastRequest = now;
    // A request may have reached Supabase even if the client misses its response.
    if (step !== null) this.sent = step;
    this.pending = true;
    void this.bridge.castleAnswer(CASTLE_MIRROR_SEAL, step === null ? 'RELEASE' : String(step))
      .then(({ result }) => {
        if (result === 'loading' || result === 'wrong') throw new Error('Mirror unavailable');
        this.sent = step;
        if (step === null) this.releaseOwed = false;
        this.retryAt = 0;
      }).catch(() => { this.retryAt = performance.now() + 500; })
      .finally(() => {
        this.pending = false;
        if (this.releaseOwed) this.send(performance.now());
      });
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !this.grip()) return;
    event.preventDefault();
    this.gesture = { id: event.pointerId, x: event.clientX, step: this.step! };
    this.button.setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const gesture = this.gesture;
    if (gesture?.id !== event.pointerId) return;
    this.turn(gesture.step + Math.round((event.clientX - gesture.x) / 30));
  };

  private readonly onPointerEnd = (event: PointerEvent): void => {
    if (this.gesture?.id === event.pointerId) this.release();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const code = event.code;
    const holdKey = code === 'KeyE' || (code === 'Space' && event.target === this.button);
    if (holdKey && this.available) {
      event.preventDefault();
      if (!event.repeat && this.grip()) this.key = code;
    } else if (this.step !== null && (code === 'ArrowLeft' || code === 'ArrowRight')) {
      event.preventDefault();
      if (!event.repeat) this.turn(this.step + (code === 'ArrowLeft' ? -1 : 1));
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === this.key) this.release();
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) this.release();
  };
}
