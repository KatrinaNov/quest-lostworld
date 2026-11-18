import Phaser from 'phaser';
import type { GameBridge, Player, Point } from '../../network/types';
import { CastleHud } from '../../ui/CastleHud';
import type { QuestHud } from '../../ui/QuestHud';
import { CASTLE_BOUNDS, CASTLE_CHEST, CASTLE_HEIGHT, CASTLE_SEALS, CASTLE_SPAWN, CASTLE_WIDTH, type CastleSeal } from '../config/castleConfig';
import { PlayerAvatar } from '../entities/Player';
import { ALL_CASTLE_SEALS, initialCastleQuestState, isCastleSealOpen, type CastleQuestState } from '../quest/castleQuestTypes';
import { MovementSystem, type VirtualInput } from '../systems/MovementSystem';
import { buildCastleWorld } from '../world/CastleWorldBuilder';
import { SCENE_KEYS } from './BootScene';
import { REGISTRY_KEYS } from './WorldScene';

export class CastleScene extends Phaser.Scene {
  private bridge!: GameBridge;
  private local!: PlayerAvatar;
  private world!: ReturnType<typeof buildCastleWorld>;
  private movement!: MovementSystem;
  private hud!: CastleHud;
  private questHud: QuestHud | null = null;
  private state = initialCastleQuestState();
  private position: Point = { ...CASTLE_SPAWN };
  private readonly remotes = new Map<string, PlayerAvatar>();
  private off: Array<() => void> = [];
  private ready = false;
  private loading = false;
  private endingShown = false;

  constructor() { super(SCENE_KEYS.castle); }

  create(): void {
    this.bridge = this.registry.get(REGISTRY_KEYS.bridge) as GameBridge;
    const virtual = this.registry.get(REGISTRY_KEYS.virtualInput) as VirtualInput | null;
    virtual?.setEnabled?.(true);
    this.world = buildCastleWorld(this);
    this.world.setProgress(this.state);
    this.movement = new MovementSystem(this, virtual, this.world.obstacles, CASTLE_BOUNDS);

    const team = this.bridge.getPlayers();
    const slot = Math.max(0, team.findIndex((player) => player.id === this.bridge.self.id));
    this.position = { x: CASTLE_SPAWN.x + (slot - 1.5) * 30, y: CASTLE_SPAWN.y };
    this.local = new PlayerAvatar(this, { ...this.bridge.self, ...this.position }, true);
    const camera = this.cameras.main;
    camera.setBackgroundColor('#15131d').setBounds(0, 0, CASTLE_WIDTH, CASTLE_HEIGHT).setRoundPixels(true);
    camera.startFollow(this.local, true, 0.16, 0.16).centerOn(this.position.x, this.position.y);
    this.applyZoom();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyZoom);
    this.hud = new CastleHud(document.getElementById('ui-root')!);
    this.questHud = this.registry.get(REGISTRY_KEYS.questHud) as QuestHud | null;
    this.questHud?.bindScene(this);
    this.syncPlayers(team);
    this.off = [
      this.bridge.on('players', (players) => this.syncPlayers(players)),
      this.bridge.on('position', ({ id, x, y }) => this.remotes.get(id)?.setTarget(x, y)),
      this.bridge.on('castleState', (state) => this.applyState(state)),
      this.bridge.on('status', (status) => { if (status === 'connected' && !this.ready) void this.loadProgress(); }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
    void this.loadProgress();
  }

  override update(time: number, delta: number): void {
    const dt = Math.min(delta, 100);
    if (!this.hud.isOpen()) this.position = this.movement.step(this.position, dt / 1000);
    const { x, y } = this.position;
    this.local.tickLocal(x, y, this.movement.getDirection(), time);
    this.bridge.sendPosition(x, y);
    for (const remote of this.remotes.values()) remote.tickRemote(dt, time);
    this.updateAction();
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
    this.ready = true;
    this.state = state;
    this.world.setProgress(state);
    this.hud.setProgress(state);
    if (state.openedMask === ALL_CASTLE_SEALS && !this.endingShown) {
      this.endingShown = true;
      this.showEnding();
      this.cameras.main.flash(540, 220, 169, 104, false);
    } else if (first && state.openedMask === 0) {
      this.movement.reset();
      this.hud.showWelcome();
    }
  }

  private updateAction(): void {
    const pressed = this.movement.consumeInteractPress();
    if (!this.ready || this.hud.isOpen()) return this.questHud?.clearWorldUi();
    if (this.state.openedMask === ALL_CASTLE_SEALS && this.distanceTo(CASTLE_CHEST) < 118) {
      this.questHud?.setActionAtWorld(CASTLE_CHEST.x, CASTLE_CHEST.y, 'Послание дракона', this.showEnding);
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
    if (this.hud.isOpen() || isCastleSealOpen(this.state, seal.id)) return;
    this.movement.reset();
    this.hud.showPuzzle(seal, (answer) => this.bridge.castleAnswer(seal.id, answer));
  }

  private readonly showEnding = (): void => {
    this.movement.reset();
    this.hud.showEnding();
  };

  private distanceTo(point: Point): number { return Math.hypot(this.position.x - point.x, this.position.y - point.y); }

  private readonly applyZoom = (): void => {
    const { width, height } = this.scale;
    this.cameras.main.setZoom(Math.min(width / 805, height / 440));
  };

  private syncPlayers(players: Player[]): void {
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
    this.movement.destroy();
    this.hud.destroy();
    this.questHud?.clearWorldUi();
    this.questHud?.bindScene(null);
    this.remotes.clear();
  }
}
