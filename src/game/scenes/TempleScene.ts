import Phaser from 'phaser';
import type { Player } from '../../network/types';
import { TEMPLE_CONFIG, TEMPLE_PALETTE } from '../config/templeConfig';
import { PlatformerInput } from '../systems/PlatformerInput';
import { buildTempleWorld, type BuiltTempleWorld } from '../world/TempleWorldBuilder';
import { PlatformerControls } from '../../ui/PlatformerControls';
import { PlayerAvatar } from '../entities/Player';
import { REGISTRY_KEYS } from './WorldScene';
import { SCENE_KEYS } from './BootScene';
import type { TempleQuestState } from '../quest/templeQuestTypes';
import type { TempleQuestHud } from '../../ui/TempleQuestHud';
import type { QuestHud } from '../../ui/QuestHud';

/** Локация 3: самостоятельная Arcade Physics сцена, не использующая top-down движение. */
export class TempleScene extends Phaser.Scene {
  private bridge!: import('../../network/types').GameBridge;
  private player!: PlayerAvatar;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private platformInput!: PlatformerInput;
  private touch: PlatformerControls | null = null;
  private world!: BuiltTempleWorld;
  private remotes = new Map<string, PlayerAvatar>();
  private off: Array<() => void> = [];
  private checkpoint = -1;
  private respawning = false;
  private plateActive = false;
  private doorShown = false;
  private hud: TempleQuestHud | null = null;
  private readonly pendingStars = new Set<number>();
  private finalAnimating = false;
  private finalRevealRequested = false;
  private finalAnimationPlayed = false;
  private hintShown = false;
  private questHud: QuestHud | null = null;
  private transitionQueued = false;
  private transitionRequested = false;

  constructor() { super(SCENE_KEYS.temple); }

  create(): void {
    this.bridge = this.registry.get(REGISTRY_KEYS.bridge) as import('../../network/types').GameBridge;
    this.physics.world.gravity.y = TEMPLE_CONFIG.gravityY;
    // Arcade Physics по умолчанию ограничен размером canvas. Для длинной локации
    // задаём реальные границы уровня, иначе около первого экрана возникает невидимая стена.
    this.physics.world.setBounds(0, 0, TEMPLE_CONFIG.width, TEMPLE_CONFIG.height);
    this.cameras.main.setBackgroundColor('#07080d');
    const parent = document.getElementById('ui-root');
    this.touch = parent ? new PlatformerControls(parent) : null;
    this.events.once(Phaser.Scenes.Events.DESTROY, this.destroyTouch, this);
    this.hud = this.registry.get(REGISTRY_KEYS.templeHud) as TempleQuestHud | null;
    (this.registry.get(REGISTRY_KEYS.virtualInput) as { setEnabled?: (enabled: boolean) => void } | undefined)?.setEnabled?.(false);
    this.world = buildTempleWorld(this);
    this.player = new PlayerAvatar(this, { ...this.bridge.self, x: TEMPLE_CONFIG.start.x, y: TEMPLE_CONFIG.start.y }, true);
    this.physics.add.existing(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setSize(TEMPLE_CONFIG.player.width, TEMPLE_CONFIG.player.height).setOffset(-15, -17).setCollideWorldBounds(true).setMaxVelocity(TEMPLE_CONFIG.player.speed, 900);
    this.platformInput = new PlatformerInput(this, this.touch);
    this.physics.add.collider(this.player, this.world.solids);
    this.physics.add.collider(this.player, this.world.door);
    for (const falling of this.world.falling) this.physics.add.collider(this.player, falling.body, () => { if (this.playerBody.touching.down && this.player.y < falling.body.y) falling.activate(); });
    this.setupCamera();
    this.questHud = this.registry.get(REGISTRY_KEYS.questHud) as QuestHud | null;
    this.questHud?.bindScene(this);
    this.syncPlayers(this.bridge.getPlayers());
    this.off.push(
      this.bridge.on('players', (players) => this.syncPlayers(players)),
      this.bridge.on('position', ({ id, x, y }) => this.setRemoteTarget(id, x, y)),
      this.bridge.on('templeState', (state) => this.applyTempleState(state)),
    );
    void this.bridge.templeStart().catch(() => this.notify('Не удалось загрузить общий финал храма. Проверьте миграции Supabase.', 'warn'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  override update(time: number, delta: number): void {
    if (!this.respawning && !this.finalAnimating && !this.hud?.isOpen()) this.platformInput.step(this.playerBody, Math.min(delta, 100));
    else this.playerBody.setVelocityX(0);
    for (const falling of this.world.falling) falling.update(time);
    for (const chain of this.world.lavaChains) chain.update(time);
    for (const lava of this.world.lavaVisuals) lava.update(time);
    for (const star of this.world.stars) star.update(time);
    this.player.tickLocal(this.player.x, this.player.y, { x: Math.sign(this.playerBody.velocity.x), y: 1 }, time);
    this.bridge.sendPosition(this.player.x, this.player.y);
    this.checkHazards(); this.checkCheckpoints(); this.checkStars(); this.checkPlate(); this.updateDoorButton();
    for (const remote of this.remotes.values()) remote.tickRemote(Math.min(delta, 100), time);
  }

  private checkHazards(): void {
    // getBounds() контейнера включает имя, стрелку и кольцо под персонажем.
    // Для ловушек используем только компактное Arcade Physics-тело.
    const bounds = new Phaser.Geom.Rectangle(
      this.playerBody.x,
      this.playerBody.y,
      this.playerBody.width,
      this.playerBody.height,
    );
    if (this.player.y > TEMPLE_CONFIG.height + 60 || this.world.lava.some((zone) => Phaser.Geom.Intersects.RectangleToRectangle(bounds, zone)) || this.world.lavaChains.some((chain) => chain.hits(bounds))) this.respawn();
  }
  private checkCheckpoints(): void {
    if (this.respawning || !this.playerBody.blocked.down || Math.abs(this.playerBody.bottom - TEMPLE_CONFIG.floorY) > 2) return;
    for (let i = TEMPLE_CONFIG.checkpoints.length - 1; i > this.checkpoint; i -= 1) {
      const point = TEMPLE_CONFIG.checkpoints[i]; if (this.player.x < point.x - 22) continue;
      this.checkpoint = i; this.world.checkpoints[i].flag.setFillStyle(0x71c94d);
      void this.bridge.templeSaveCheckpoint(i).catch(() => this.notify('Не удалось сохранить чекпоинт.', 'warn'));
      this.tweens.add({ targets: [this.world.checkpoints[i].pole, this.world.checkpoints[i].flag], scaleY: { from: 1, to: 1.12 }, yoyo: true, duration: 140 }); break;
    }
  }
  private respawn(): void {
    if (this.respawning) return;
    this.respawning = true; this.playerBody.setVelocity(0, 0).setEnable(false); this.player.setVisible(false);
    this.time.delayedCall(TEMPLE_CONFIG.respawnDelayMs, () => {
      const point = this.checkpoint >= 0 ? TEMPLE_CONFIG.checkpoints[this.checkpoint] : TEMPLE_CONFIG.start;
      this.playerBody.setEnable(true).reset(point.x, point.y);
      this.player.setVisible(true); this.respawning = false;
    });
  }
  private checkPlate(): void {
    const state = this.bridge.getTempleQuestState();
    if (state.phase !== 'collecting' || !this.bridge.isTempleQuestReady()) return;
    const plate = this.world.plates.find((entry) => entry.ownerId === this.bridge.self.id);
    if (!plate) return;
    const active = this.playerBody.blocked.down && Math.abs(this.player.x - plate.body.x) < plate.body.width / 2 && Math.abs(this.player.y + TEMPLE_CONFIG.player.height / 2 - plate.body.y) < 34;
    if (active === this.plateActive) return;
    this.plateActive = active;
    if (active) {
      const everyoneHasStars = state.team.length > 0 && state.team.every((member) => (state.stars[member.id]?.length ?? 0) >= 3);
      this.notify(everyoneHasStars ? 'Соберитесь вместе! Каждый должен занять свою платформу.' : 'Не все звёзды найдены! Каждый игрок должен собрать свои звёзды.', 'info');
    }
    void this.bridge.templeSetPlate(active).catch(() => this.notify('Не удалось обновить плиту.', 'warn'));
  }
  private checkStars(): void {
    const state = this.bridge.getTempleQuestState();
    if (state.phase !== 'collecting' || !this.bridge.isTempleQuestReady()) return;
    const ownIndex = state.team.findIndex((member) => member.id === this.bridge.self.id);
    if (ownIndex < 0) return;
    const bodyBounds = new Phaser.Geom.Rectangle(this.playerBody.x, this.playerBody.y, this.playerBody.width, this.playerBody.height);
    for (const star of this.world.stars) {
      if (star.ownerIndex !== ownIndex || state.stars[this.bridge.self.id]?.includes(star.index) || this.pendingStars.has(star.index)) continue;
      if (!Phaser.Geom.Intersects.RectangleToRectangle(bodyBounds, star.bounds)) continue;
      this.pendingStars.add(star.index);
      void this.bridge.templeCollectStar(star.index).then((result) => {
        if (result === 'star_collected') this.notify('Звезда найдена!', 'success');
      }).catch(() => this.notify('Не удалось сохранить звезду.', 'warn')).finally(() => this.pendingStars.delete(star.index));
    }
  }
  private applyTempleState(state: TempleQuestState): void {
    if (state.phase === 'transitioned') {
      this.enterLabyrinth();
      return;
    }
    this.world.setPlateAssignments(state.team);
    this.hud?.setProgress(state);
    const self = state.players[this.bridge.self.id];
    if (self && self.checkpoint > this.checkpoint) {
      this.checkpoint = self.checkpoint;
      const point = TEMPLE_CONFIG.checkpoints[this.checkpoint];
      this.playerBody.reset(point.x, point.y);
      this.world.checkpoints[this.checkpoint].flag.setFillStyle(0x71c94d);
    }
    for (const star of this.world.stars) {
      const owner = state.team[star.ownerIndex] ?? null;
      star.setOwner(owner, owner?.id === this.bridge.self.id);
      star.setCollected(owner ? (state.stars[owner.id]?.includes(star.index) ?? false) : false);
    }
    for (const plate of this.world.plates) {
      const active = state.players[plate.ownerId]?.plateActive ?? false;
      plate.body.setFillStyle(active ? TEMPLE_PALETTE.plateActive : (state.team.find((member) => member.id === plate.ownerId)?.color ?? TEMPLE_PALETTE.plate));
      plate.body.setStrokeStyle(active ? 3 : 0, active ? 0xffffff : 0x000000, active ? 0.9 : 0);
    }
    if (state.phase === 'final_started') this.runFinalAnimation();
    if (state.phase === 'hint_ready' && !this.doorShown) {
      this.doorShown = true; this.world.openDoor(); this.notify('ИСПЫТАНИЕ ПРОЙДЕНО!', 'success');
    }
    if (state.phase === 'hint_ready' && !this.hintShown) { this.hintShown = true; this.hud?.showHint(() => undefined); }
  }
  private updateDoorButton(): void {
    const ready = this.bridge.getTempleQuestState().phase === 'hint_ready';
    const near = Math.abs(this.player.x - 13670) < 110 && Math.abs(this.player.y - 560) < 150;
    const visible = ready && near && !this.respawning && !this.finalAnimating && !this.transitionRequested && !this.hud?.isOpen();
    this.questHud?.setActionAtWorld(13670, 548, visible ? 'Войти' : null, visible ? this.openDoorDialog : null);
  }
  private readonly openDoorDialog = (): void => {
    if (this.bridge.getTempleQuestState().phase !== 'hint_ready' || this.hud?.isOpen()) return;
    this.hud?.showDoorConfirm(
      () => this.hud?.showHint(() => undefined),
      () => void this.confirmTransition(),
    );
  };
  private async confirmTransition(): Promise<void> {
    if (this.transitionRequested || this.transitionQueued) return;
    this.transitionRequested = true;
    try {
      const result = await this.bridge.templeTransition();
      if (!this.sys.isActive()) return;
      if (result === 'transitioned' || this.bridge.getTempleQuestState().phase === 'transitioned') {
        this.enterLabyrinth();
      } else {
        this.notify('Переход ещё не подтверждён. Нажмите «Войти» ещё раз.', 'warn');
      }
    } catch {
      if (!this.transitionQueued) this.notify('Не удалось перейти дальше. Попробуйте ещё раз.', 'warn');
    } finally {
      this.transitionRequested = false;
    }
  }
  private enterLabyrinth(): void {
    if (this.transitionQueued) return;
    this.transitionQueued = true;
    this.scene.start(SCENE_KEYS.labyrinth);
    sessionStorage.setItem('maze-room', this.bridge.roomCode);
  }
  private runFinalAnimation(): void {
    if (this.finalAnimationPlayed || this.bridge.getTempleQuestState().phase !== 'final_started') return;
    this.finalAnimationPlayed = true;
    this.finalAnimating = true;
    this.playerBody.setVelocity(0, 0);
    const width = this.scale.width;
    const height = this.scale.height;
    const layer = this.add.container(0, 0).setScrollFactor(0).setDepth(120);
    const shade = this.add.rectangle(0, 0, width, height, 0x000000, 0).setOrigin(0);
    layer.add(shade);
    this.tweens.add({ targets: shade, alpha: 0.62, duration: 380 });
    const team = this.bridge.getTempleQuestState().team;
    for (let owner = 0; owner < team.length; owner += 1) {
      for (let index = 0; index < 3; index += 1) {
        const startX = width * (0.19 + ((owner * 3 + index) % 6) * 0.125);
        const startY = height * (0.72 - index * 0.09);
        const star = this.add.star(startX, startY, 5, 6, 14, team[owner].color, 1).setScrollFactor(0);
        star.setStrokeStyle(2, 0x11151e, 1);
        layer.add(star);
        this.tweens.add({ targets: star, x: width / 2, y: height / 2, angle: 720 + index * 90, duration: 2400, delay: (owner * 3 + index) * 75, ease: 'Quad.inOut' });
      }
    }
    this.time.delayedCall(2850, () => {
      const flash = this.add.rectangle(width / 2, height / 2, 12, 12, 0xfff1a6, 0).setScrollFactor(0);
      layer.add(flash);
      this.tweens.add({ targets: flash, alpha: 1, width: Math.max(width, height) * 1.3, height: Math.max(width, height) * 1.3, duration: 260, yoyo: true });
    });
    this.time.delayedCall(3500, () => {
      layer.destroy(true);
      this.finalAnimating = false;
      this.requestFinalReveal();
    });
  }
  /** RPC идемпотентен: повтор закрывает редкий случай, когда realtime-обновление пришло раньше таймера анимации. */
  private requestFinalReveal(): void {
    if (this.finalRevealRequested || this.bridge.getTempleQuestState().phase !== 'final_started') return;
    this.finalRevealRequested = true;
    void this.bridge.templeRevealHint().then((result) => {
      if (result === 'hint_ready') return;
      this.finalRevealRequested = false;
      if (this.bridge.getTempleQuestState().phase === 'final_started') this.time.delayedCall(1200, () => this.requestFinalReveal());
    }).catch(() => {
      this.finalRevealRequested = false;
      this.time.delayedCall(1200, () => this.requestFinalReveal());
    });
  }
  private setupCamera(): void {
    const camera = this.cameras.main;
    camera.setBounds(0, 0, TEMPLE_CONFIG.width, TEMPLE_CONFIG.height);
    camera.startFollow(this.player, true, TEMPLE_CONFIG.camera.followLerp, TEMPLE_CONFIG.camera.followLerp, 110, 0);
    const zoom = Math.min(this.scale.height / TEMPLE_CONFIG.camera.viewHeight, this.scale.width / TEMPLE_CONFIG.camera.viewWidth, TEMPLE_CONFIG.camera.maxCssZoom * Math.min(devicePixelRatio || 1, 2));
    camera.setZoom(zoom).setRoundPixels(true);
  }
  private syncPlayers(players: Player[]): void {
    const seen = new Set<string>();
    for (const player of players) {
      if (player.id === this.bridge.self.id) continue; seen.add(player.id);
      const existing = this.remotes.get(player.id);
      if (existing) { existing.setIdentity(player.name, player.color); continue; }
      this.remotes.set(player.id, new PlayerAvatar(this, player, false));
    }
    for (const [id, remote] of this.remotes) if (!seen.has(id)) { remote.destroy(); this.remotes.delete(id); }
  }
  private setRemoteTarget(id: string, x: number, y: number): void { this.remotes.get(id)?.setTarget(x, y); }
  private destroyTouch(): void {
    this.touch?.destroy();
    this.touch = null;
  }
  private cleanup(): void {
    if (!this.bridge.getTempleQuestState().doorOpen && this.plateActive) void this.bridge.templeSetPlate(false);
    for (const stop of this.off) stop(); this.off = [];
    this.platformInput.destroy();
    this.events.off(Phaser.Scenes.Events.DESTROY, this.destroyTouch, this);
    this.destroyTouch();
    (this.registry.get(REGISTRY_KEYS.virtualInput) as { setEnabled?: (enabled: boolean) => void } | undefined)?.setEnabled?.(true);
    for (const falling of this.world.falling) falling.destroy();
    for (const chain of this.world.lavaChains) chain.destroy();
    for (const lava of this.world.lavaVisuals) lava.destroy();
    for (const star of this.world.stars) star.destroy();
    this.questHud?.clearWorldUi();
    this.questHud?.bindScene(null);
    this.questHud = null;
    this.hud?.hide(); this.hud = null;
  }
  private notify(message: string, type: 'info' | 'success' | 'warn'): void {
    (this.registry.get(REGISTRY_KEYS.notifications) as { show?: (text: string, kind?: 'info' | 'success' | 'warn') => void } | undefined)?.show?.(message, type);
  }
}
