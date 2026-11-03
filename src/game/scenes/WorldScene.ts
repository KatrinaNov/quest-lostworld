import Phaser from 'phaser';
import type { GameBridge, Player, Point } from '../../network/types';
import { PlayerAvatar } from '../entities/Player';
import { MovementSystem, type VirtualInput } from '../systems/MovementSystem';
import { WORLD_CONFIG } from '../config/worldConfig';
import { buildWorld, type TreeInfo } from '../world/WorldBuilder';
import { SCENE_KEYS } from './BootScene';

/** Ключи данных, которые приложение передаёт в игру через game.registry. */
export const REGISTRY_KEYS = {
  bridge: 'bridge',
  virtualInput: 'virtualInput',
} as const;

/**
 * Игровой мир. Локальный игрок двигается мгновенно (без ожидания сети),
 * удалённые игроки плавно догоняют координаты, пришедшие по сети.
 * Сцена получает сетевой слой только через интерфейс GameBridge.
 */
export class WorldScene extends Phaser.Scene {
  private bridge!: GameBridge;
  private movement!: MovementSystem;
  private local!: PlayerAvatar;
  private remotes = new Map<string, PlayerAvatar>();
  private trees: TreeInfo[] = [];
  private position: Point = { x: 0, y: 0 };
  private unsubscribe: Array<() => void> = [];

  constructor() {
    super(SCENE_KEYS.world);
  }

  create(): void {
    this.bridge = this.registry.get(REGISTRY_KEYS.bridge) as GameBridge;
    const virtualInput = (this.registry.get(REGISTRY_KEYS.virtualInput) as VirtualInput | undefined) ?? null;

    const { obstacles, trees } = buildWorld(this);
    this.trees = trees;
    this.movement = new MovementSystem(this, virtualInput, obstacles);

    const self = this.bridge.self;
    this.position = { x: self.x, y: self.y };
    this.local = new PlayerAvatar(this, self, true);

    this.setupCamera();
    this.syncPlayers(this.bridge.getPlayers());

    this.unsubscribe.push(
      this.bridge.on('players', (players) => this.syncPlayers(players)),
      this.bridge.on('position', ({ id, x, y }) => this.remotes.get(id)?.setTarget(x, y)),
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  override update(time: number, delta: number): void {
    const dt = Math.min(delta, WORLD_CONFIG.player.maxFrameDeltaMs);

    this.position = this.movement.step(this.position, dt / 1000);
    this.local.tickLocal(this.position.x, this.position.y, this.movement.getDirection(), time);
    // Сеть сама ограничивает частоту отправки; здесь просто сообщаем текущую позицию.
    this.bridge.sendPosition(this.position.x, this.position.y);

    for (const avatar of this.remotes.values()) avatar.tickRemote(dt, time);

    this.fadeCanopies();
  }

  /** Кроны деревьев становятся полупрозрачными, когда за ними стоит игрок — чтобы никто не «пропадал». */
  private fadeCanopies(): void {
    const avatars: PlayerAvatar[] = [this.local, ...this.remotes.values()];
    for (const tree of this.trees) {
      const hides = avatars.some(
        (a) => a.y < tree.y && a.y > tree.y - tree.reach && Math.abs(a.x - tree.x) < tree.halfWidth,
      );
      const target = hides ? WORLD_CONFIG.camera.canopyFadeAlpha : 1;
      if (tree.sprite.alpha !== target) {
        const next = tree.sprite.alpha + (target - tree.sprite.alpha) * 0.2;
        tree.sprite.setAlpha(Math.abs(next - target) < 0.01 ? target : next);
      }
    }
  }

  // ------------------------------------------------------------ игроки

  /** Приводит набор аватаров в соответствие со списком игроков (без дубликатов). */
  private syncPlayers(players: Player[]): void {
    const seen = new Set<string>();

    for (const player of players) {
      if (player.id === this.bridge.self.id) {
        this.local.setIdentity(player.name, player.color);
        continue;
      }
      seen.add(player.id);
      const existing = this.remotes.get(player.id);
      if (existing) {
        existing.setIdentity(player.name, player.color);
      } else {
        this.remotes.set(player.id, new PlayerAvatar(this, player, false));
      }
    }

    for (const [id, avatar] of this.remotes) {
      if (!seen.has(id)) {
        avatar.destroy();
        this.remotes.delete(id);
      }
    }
  }

  // ------------------------------------------------------------ камера

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_CONFIG.width, WORLD_CONFIG.height);
    cam.setRoundPixels(true);
    cam.startFollow(this.local, true, WORLD_CONFIG.camera.followLerp, WORLD_CONFIG.camera.followLerp);
    cam.centerOn(this.local.x, this.local.y);

    if (this.renderer.type === Phaser.WEBGL) {
      cam.postFX.addVignette(0.5, 0.5, 0.95, 0.38);
    }

    this.applyZoom();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyZoom, this);
  }

  /** Подбирает масштаб так, чтобы по высоте экрана помещалось одинаковое число единиц мира. */
  private applyZoom(): void {
    const { width, height } = this.scale;
    if (height <= 0 || width <= 0) return;
    const { viewHeight, viewWidth, maxCssZoom } = WORLD_CONFIG.camera;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.cameras.main.setZoom(Math.min(height / viewHeight, width / viewWidth, maxCssZoom * ratio));
  }

  private cleanup(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe = [];
    this.scale.off(Phaser.Scale.Events.RESIZE, this.applyZoom, this);
    this.movement.destroy();
    this.remotes.clear();
  }
}
