import Phaser from 'phaser';
import type { GameBridge, Player, Point } from '../../network/types';
import { CastleHud } from '../../ui/CastleHud';
import type { QuestHud } from '../../ui/QuestHud';
import type { Notifications } from '../../ui/Notifications';
import { CASTLE_BOUNDS, CASTLE_CHEST, CASTLE_HEIGHT, CASTLE_SEALS, CASTLE_SPAWN, CASTLE_WIDTH, type CastleSeal } from '../config/castleConfig';
import { WORLD_CONFIG } from '../config/worldConfig';
import { PlayerAvatar } from '../entities/Player';
import { CastleMirrorPuzzle } from '../quest/CastleMirrorPuzzle';
import { ALL_CASTLE_SEALS, CASTLE_MIRROR_SEAL, initialCastleQuestState, isCastleSealOpen, type CastleQuestState } from '../quest/castleQuestTypes';
import { MovementSystem, type VirtualInput } from '../systems/MovementSystem';
import { castleFireHits } from '../world/CastleFire';
import { buildCastleWorld, preloadCastleWorld } from '../world/CastleWorldBuilder';
import { SCENE_KEYS } from './BootScene';
import { REGISTRY_KEYS } from './WorldScene';

const CHEST_REACH = 118;

export class CastleScene extends Phaser.Scene {
  private bridge!: GameBridge;
  private local!: PlayerAvatar;
  private world!: ReturnType<typeof buildCastleWorld>;
  private movement!: MovementSystem;
  private mirrors!: CastleMirrorPuzzle;
  private hud!: CastleHud;
  private questHud: QuestHud | null = null;
  private state = initialCastleQuestState();
  private spawn: Point = CASTLE_SPAWN;
  private position: Point = CASTLE_SPAWN;
  private readonly remotes = new Map<string, PlayerAvatar>();
  private off: Array<() => void> = [];
  private ready = false;
  private loading = false;
  private respawnAt = 0;

  constructor() { super(SCENE_KEYS.castle); }

  preload(): void { preloadCastleWorld(this); }

  create(): void {
    this.state = initialCastleQuestState();
    this.ready = false;
    this.respawnAt = 0;
    this.bridge = this.registry.get(REGISTRY_KEYS.bridge) as GameBridge;
    const virtual = this.registry.get(REGISTRY_KEYS.virtualInput) as VirtualInput | null;
    virtual?.setEnabled?.(true);
    this.world = buildCastleWorld(this);
    this.world.setProgress(this.state);
    this.movement = new MovementSystem(this, virtual, this.world.obstacles, CASTLE_BOUNDS);

    const team = this.bridge.getPlayers();
    const slot = Math.max(0, team.findIndex((player) => player.id === this.bridge.self.id));
    this.spawn = { x: CASTLE_SPAWN.x + (slot - 1.5) * 30, y: CASTLE_SPAWN.y };
    this.position = this.spawn;
    this.local = new PlayerAvatar(this, { ...this.bridge.self, ...this.position }, true);
    const camera = this.cameras.main;
    camera.setBackgroundColor('#15131d').setBounds(0, 0, CASTLE_WIDTH, CASTLE_HEIGHT).setRoundPixels(true);
    camera.startFollow(this.local, true, 0.16, 0.16).centerOn(this.position.x, this.position.y);
    this.applyZoom();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyZoom);
    const ui = document.getElementById('ui-root')!;
    this.hud = new CastleHud(ui);
    this.mirrors = new CastleMirrorPuzzle(this, ui, this.bridge, this.world.obstacles, () => this.movement.reset());
    this.questHud = this.registry.get(REGISTRY_KEYS.questHud) as QuestHud | null;
    this.questHud?.bindScene(this);
    this.game.canvas.addEventListener('click', this.onCanvasClick);
    this.syncPlayers(team);
    this.off = [
      this.bridge.on('players', (players) => this.syncPlayers(players)),
      this.bridge.on('position', ({ id, x, y }) => this.remotes.get(id)?.setTarget(x, y)),
      this.bridge.on('castleState', (state) => this.applyState(state)),
      this.bridge.on('status', (status) => {
        if (status !== 'connected') this.mirrors.release();
        else if (!this.ready) void this.loadProgress();
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
    void this.loadProgress();
  }

  override update(time: number, delta: number): void {
    const dt = Math.min(delta, 100);
    this.world.update(time);
    if (this.respawnAt) {
      if (time >= this.respawnAt) this.finishRespawn();
    } else if (!this.hud.isOpen() && !this.mirrors.isHolding()) {
      this.position = this.movement.step(this.position, dt / 1000);
      if (this.state.openedMask !== ALL_CASTLE_SEALS && castleFireHits(this.position, WORLD_CONFIG.player.radius)) {
        this.respawnFromFire(time);
      }
    }
    const { x, y } = this.position;
    this.local.tickLocal(x, y, this.movement.getDirection(), time);
    this.bridge.sendPosition(x, y);
    for (const remote of this.remotes.values()) remote.tickRemote(dt, time);
    const nearMirror = this.mirrors.update(this.position, this.ready && !this.hud.isOpen() && !this.respawnAt);
    this.updateAction(nearMirror);
  }

  private readonly loadProgress = async (): Promise<void> => {
    if (this.loading) return;
    this.loading = true;
    this.hud.setLoading('Загружаем печати…');
    try {
      await this.bridge.castleStart();
      if (this.sys.isActive()) this.applyState(this.bridge.getCastleQuestState());
    } catch {
      if (this.sys.isActive()) this.hud.setLoading('Печати пока недоступны', () => void this.loadProgress());
    } finally {
      this.loading = false;
    }
  };

  private applyState(state: CastleQuestState): void {
    const first = !this.ready;
    if (!first && state.revision <= this.state.revision) return;
    const changed = state.openedMask !== this.state.openedMask;
    const mirrorOpened = !first && isCastleSealOpen(state, CASTLE_MIRROR_SEAL) && !isCastleSealOpen(this.state, CASTLE_MIRROR_SEAL);
    const unlocked = !first && state.openedMask === ALL_CASTLE_SEALS && this.state.openedMask !== ALL_CASTLE_SEALS;
    this.ready = true;
    this.state = state;
    this.mirrors.setState(state);
    if (first || changed) {
      this.world.setProgress(state);
      this.hud.setProgress(state);
    }
    if (unlocked) {
      this.cameras.main.flash(580, 255, 230, 168, true);
      this.notifications()?.show('Четыре печати сняты. Сундук открыт!', 'success');
    } else if (mirrorOpened) {
      this.notifications()?.show('Лучи сошлись. Печать зеркал открыта!', 'success');
    } else if (first && state.openedMask === 0) {
      this.movement.reset();
      this.hud.showWelcome();
    }
  }

  private updateAction(nearMirror: boolean): void {
    const pressed = this.movement.consumeInteractPress();
    if (!this.ready || this.hud.isOpen() || this.respawnAt || nearMirror) return this.questHud?.clearWorldUi();
    if (this.canReadChest()) {
      this.questHud?.setActionAtWorld(CASTLE_CHEST.x, CASTLE_CHEST.y - 20, 'Заглянуть в сундук', this.showEnding);
      if (pressed) this.showEnding();
      return;
    }

    const seal = CASTLE_SEALS.find((entry) => !isCastleSealOpen(this.state, entry.id) && this.distanceTo(entry) < 110);
    if (!seal) return this.questHud?.clearWorldUi();
    const action = (): void => this.openSeal(seal);
    this.questHud?.setActionAtWorld(seal.x, seal.y - 5, 'Осмотреть печать', action);
    if (pressed) action();
  }

  private openSeal(seal: CastleSeal): void {
    if (this.respawnAt || this.hud.isOpen() || isCastleSealOpen(this.state, seal.id) || this.distanceTo(seal) >= 110) return;
    this.movement.reset();
    this.hud.showPuzzle(seal, (answer) => this.bridge.castleAnswer(seal.id, answer));
  }

  private readonly showEnding = (): void => {
    if (!this.canReadChest()) return;
    this.movement.reset();
    this.hud.showEnding();
  };

  private canReadChest(): boolean {
    return this.ready && !this.respawnAt && !this.hud.isOpen()
      && this.state.openedMask === ALL_CASTLE_SEALS && this.distanceTo(CASTLE_CHEST) < CHEST_REACH;
  }

  private readonly onCanvasClick = (event: MouseEvent): void => {
    if (!this.canReadChest()) return;
    const canvas = this.game.canvas;
    const view = canvas.getBoundingClientRect();
    const point = this.cameras.main.getWorldPoint(
      (event.clientX - view.left) * canvas.width / view.width,
      (event.clientY - view.top) * canvas.height / view.height,
    );
    if (Math.abs(point.x - CASTLE_CHEST.x) <= 50 && point.y >= CASTLE_CHEST.y - 58 && point.y <= CASTLE_CHEST.y + 29) {
      this.showEnding();
    }
  };

  private respawnFromFire(time: number): void {
    this.respawnAt = time + 440;
    this.mirrors.release();
    this.local.setVisible(false);
    this.movement.reset();
    this.notifications()?.show('Драконье пламя настигло вас. Возвращаемся ко входу.', 'warn');
    this.cameras.main.flash(225, 162, 54, 34);
  }

  private finishRespawn(): void {
    this.position = this.spawn;
    this.local.setPosition(this.spawn.x, this.spawn.y).setVisible(true);
    this.cameras.main.centerOn(this.spawn.x, this.spawn.y);
    this.respawnAt = 0;
  }

  private notifications(): Notifications | null {
    return this.registry.get(REGISTRY_KEYS.notifications) as Notifications | null;
  }

  private distanceTo(point: Point): number { return Math.hypot(this.position.x - point.x, this.position.y - point.y); }

  private readonly applyZoom = (): void => {
    const { width, height } = this.scale;
    this.cameras.main.setZoom(Math.min(width / 805, height / 440));
  };

  private syncPlayers(players: Player[]): void {
    this.mirrors.setPlayers(players);
    const present = new Set<string>();
    for (const player of players) {
      if (player.id === this.bridge.self.id) continue;
      present.add(player.id);
      const remote = this.remotes.get(player.id);
      if (remote) remote.setIdentity(player.name, player.color);
      else this.remotes.set(player.id, new PlayerAvatar(this, player, false));
    }
    for (const [id, remote] of this.remotes) {
      if (present.has(id)) continue;
      remote.destroy();
      this.remotes.delete(id);
    }
  }

  private cleanup(): void {
    this.events.off(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
    for (const off of this.off) off();
    this.off = [];
    this.scale.off(Phaser.Scale.Events.RESIZE, this.applyZoom);
    this.game.canvas?.removeEventListener('click', this.onCanvasClick);
    this.mirrors.destroy();
    this.movement.destroy();
    this.hud.destroy();
    this.questHud?.clearWorldUi();
    this.questHud?.bindScene(null);
    this.remotes.clear();
  }
}
