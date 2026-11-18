import Phaser from 'phaser';
import type { GameBridge, Player } from '../../network/types';
import {
  MINECRAFT_BOUNDS,
  MINECRAFT_CONFIG,
  minecraftSpawnForPlayer,
} from '../config/minecraftWorldConfig';
import { PlayerAvatar } from '../entities/Player';
import { MovementSystem, type VirtualInput } from '../systems/MovementSystem';
import { mcWaterFrameKey } from './minecraftPreloadTextures';
import { buildMinecraftWorld } from '../world/MinecraftWorldBuilder';
import type { MinecraftTreeInfo } from '../world/MinecraftWorldBuilder';
import { JungleQuestController, type JungleQuestUiHost } from '../quest/JungleQuestController';
import type { JungleQuestHud } from '../../ui/JungleQuestHud';
import { REGISTRY_KEYS } from './WorldScene';
import { SCENE_KEYS } from './BootScene';

/** Локация 2 — блочный мир (вид сверху). */
export class MinecraftScene extends Phaser.Scene {
  private bridge!: GameBridge;
  private movement!: MovementSystem;
  private local!: PlayerAvatar;
  private remotes = new Map<string, PlayerAvatar>();
  private lastFrameTime = 0;
  private position = { x: 0, y: 0 };
  private unsubscribe: Array<() => void> = [];
  private waterTiles: Phaser.GameObjects.Image[] = [];
  private waterAnimFrame = 0;
  private trees: MinecraftTreeInfo[] = [];
  private jungleQuest: JungleQuestController | null = null;

  constructor() {
    super(SCENE_KEYS.minecraft);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#6dae5a');
    this.bridge = this.registry.get(REGISTRY_KEYS.bridge) as GameBridge;
    if (sessionStorage.getItem('temple-room') === this.bridge.roomCode) {
      this.scene.start(SCENE_KEYS.temple);
      return;
    }
    const virtualInput = (this.registry.get(REGISTRY_KEYS.virtualInput) as VirtualInput | undefined) ?? null;

    const built = buildMinecraftWorld(this);
    const { obstacles } = built;
    this.waterTiles = built.waterTiles;
    this.trees = built.trees;
    this.startWaterAnimation();
    this.movement = new MovementSystem(
      this,
      virtualInput,
      obstacles,
      MINECRAFT_BOUNDS,
      MINECRAFT_CONFIG.player.speed,
      MINECRAFT_CONFIG.player.radius,
    );

    const spawn = minecraftSpawnForPlayer(this.bridge.getPlayers(), this.bridge.self.id);
    this.position = { x: spawn.x, y: spawn.y };
    this.bridge.sendPosition(spawn.x, spawn.y);

    this.local = new PlayerAvatar(this, { ...this.bridge.self, x: spawn.x, y: spawn.y }, true);
    this.setupCamera();
    this.syncPlayers(this.bridge.getPlayers());

    const questHud = this.registry.get(REGISTRY_KEYS.questHud) as import('../../ui/QuestHud').QuestHud | undefined;
    questHud?.bindScene(this);
    questHud?.clearWorldUi();
    questHud?.setPortalBanner(false);

    const jungleHud = this.registry.get(REGISTRY_KEYS.jungleHud) as JungleQuestHud | undefined;
    if (questHud && jungleHud) {
      const jungleUi: JungleQuestUiHost = {
        setActionAtWorld: (x, y, label, onClick) => questHud.setActionAtWorld(x, y, label, onClick),
        notify: (text, kind = 'info') => {
          const notifications = this.registry.get(REGISTRY_KEYS.notifications) as { show?: (message: string, type?: 'info' | 'success' | 'warn') => void } | undefined;
          notifications?.show?.(text, kind);
        },
        setJungleProgress: (state) => jungleHud.setProgress(state),
        showJungleSymbol: (symbol, onClose) => jungleHud.showSymbol(symbol, onClose),
        showJungleCompletion: (onConfirm) => jungleHud.showCompletion(onConfirm),
        showJungleSecret: (onSubmit) => jungleHud.showSecret(onSubmit),
        showJungleTempleOpen: (onClose) => jungleHud.showTempleOpen(onClose),
        closeJungleModal: () => jungleHud.close(),
        enterTemple: () => {
          sessionStorage.setItem('temple-room', this.bridge.roomCode);
          this.scene.start(SCENE_KEYS.temple);
        },
      };
      this.jungleQuest = new JungleQuestController(this.bridge, this.movement, jungleUi, built.openTemplePassage);
    }

    this.unsubscribe.push(
      this.bridge.on('players', (players) => this.syncPlayers(players)),
      this.bridge.on('position', ({ id, x, y }) => this.remotes.get(id)?.setTarget(x, y)),
      this.bridge.on('questState', (st) => {
        if (st.locationId === 1) this.scene.start(SCENE_KEYS.world);
      }),
    );

    const intro = this.registry.get(REGISTRY_KEYS.locationIntro) as
      | { openMinecraft: () => void }
      | undefined;
    const skipIntro =
      import.meta.env.DEV && sessionStorage.getItem('dev-skip-mc-intro') === '1';
    if (!skipIntro) intro?.openMinecraft();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  override update(time: number, delta: number): void {
    const elapsed = this.lastFrameTime > 0 ? time - this.lastFrameTime : delta;
    this.lastFrameTime = time;
    const dt = Phaser.Math.Clamp(elapsed, 0, MINECRAFT_CONFIG.player.maxFrameDeltaMs);

    this.position = this.movement.step(this.position, dt / 1000);
    this.local.tickLocal(this.position.x, this.position.y, this.movement.getDirection(), time);
    this.bridge.sendPosition(this.position.x, this.position.y);

    for (const avatar of this.remotes.values()) avatar.tickRemote(dt, time);
    this.fadeCanopies();
    this.jungleQuest?.tick(this.position);
  }

  /** Кроны становятся прозрачными, если перекрывают одного из игроков. */
  private fadeCanopies(): void {
    const avatars = [this.local, ...this.remotes.values()];
    for (const tree of this.trees) {
      const hides = avatars.some(
        (avatar) => avatar.y < tree.y && avatar.y > tree.y - tree.reach && Math.abs(avatar.x - tree.x) < tree.halfWidth,
      );
      const target = hides ? 0.36 : 1;
      if (tree.sprite.alpha !== target) {
        const next = tree.sprite.alpha + (target - tree.sprite.alpha) * 0.2;
        tree.sprite.setAlpha(Math.abs(next - target) < 0.01 ? target : next);
      }
    }
  }

  private syncPlayers(players: Player[]): void {
    const seen = new Set<string>();
    for (const player of players) {
      if (player.id === this.bridge.self.id) {
        this.local.setIdentity(player.name, player.color);
        continue;
      }
      seen.add(player.id);
      const existing = this.remotes.get(player.id);
      if (existing) existing.setIdentity(player.name, player.color);
      else this.remotes.set(player.id, new PlayerAvatar(this, player, false));
    }
    for (const [id, avatar] of this.remotes) {
      if (!seen.has(id)) {
        avatar.destroy();
        this.remotes.delete(id);
      }
    }
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, MINECRAFT_CONFIG.width, MINECRAFT_CONFIG.height);
    cam.setRoundPixels(true);
    const { followLerp } = MINECRAFT_CONFIG.camera;
    cam.startFollow(this.local, true, followLerp, followLerp);
    cam.centerOn(this.local.x, this.local.y);
    this.applyZoom();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyZoom, this);
  }

  private applyZoom(): void {
    const { width, height } = this.scale;
    if (height <= 0 || width <= 0) return;
    const { viewHeight, viewWidth, maxCssZoom } = MINECRAFT_CONFIG.camera;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.cameras.main.setZoom(Math.min(height / viewHeight, width / viewWidth, maxCssZoom * ratio));
  }

  private startWaterAnimation(): void {
    if (this.waterTiles.length === 0) return;
    this.time.addEvent({
      delay: 480,
      loop: true,
      callback: () => {
        this.waterAnimFrame = (this.waterAnimFrame + 1) % 4;
        const key = mcWaterFrameKey(this.waterAnimFrame);
        for (const tile of this.waterTiles) tile.setTexture(key);
      },
    });
  }

  private cleanup(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe = [];
    this.scale.off(Phaser.Scale.Events.RESIZE, this.applyZoom, this);
    this.movement.destroy();
    this.jungleQuest?.destroy();
    this.jungleQuest = null;
    (this.registry.get(REGISTRY_KEYS.jungleHud) as JungleQuestHud | undefined)?.hide();
    this.remotes.clear();
    this.waterTiles = [];
    this.trees = [];
  }
}
