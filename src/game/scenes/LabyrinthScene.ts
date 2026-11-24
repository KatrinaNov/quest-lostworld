import Phaser from 'phaser';
import type { GameBridge, Player, Point } from '../../network/types';
import { MAZE_CONFIG, MAZE_LETTER_POINTS } from '../config/mazeConfig';
import { PlayerAvatar } from '../entities/Player';
import { mazeAssemblyReady, mazeLetterLimit, type MazeQuestState } from '../quest/mazeQuestTypes';
import { MovementSystem, type VirtualInput } from '../systems/MovementSystem';
import { buildMazeWorld, preloadMazeTerrain, type MazeHazard } from '../world/MazeWorld';
import { slideAlongMazeWalls } from '../world/mazeCollision';
import { MAZE_WALLS } from '../world/mazeLayout';
import { REGISTRY_KEYS } from './WorldScene';
import { SCENE_KEYS } from './BootScene';
import { MazeQuestHud } from '../../ui/MazeQuestHud';

export class LabyrinthScene extends Phaser.Scene {
  private bridge!: GameBridge;
  private movement!: MovementSystem;
  private local!: PlayerAvatar;
  private readonly remotes = new Map<string, PlayerAvatar>();
  private position: Point = { ...MAZE_CONFIG.spawn };
  private hazards: MazeHazard[] = [];
  private checkpoints: Phaser.GameObjects.Rectangle[] = [];
  private letters: Phaser.GameObjects.Container[] = [];
  private hud: MazeQuestHud | null = null;
  private pendingLetter = false;
  private retryLetterAt = 0;
  private ownLetters = 0;
  private letterLimit = 0;
  private checkpoint = 0;
  private savedCheckpoint = 0;
  private pendingSave = false;
  private pendingArrival = false;
  private savedArrival = false;
  private completed = false;
  private retrySaveAt = 0;
  private retryArrivalAt = 0;
  private arrivalStartedAt = 0;
  private arrivalFailed = false;
  private progressLoading = false;
  private retryProgressAt = 0;
  private waitingForTeam = false;
  private gateWaitText: string | null = null;
  private nextTeamRefreshAt = 0;
  private respawning = false;
  private protectedUntil = 0;
  private off: Array<() => void> = [];
  private initializedProgress = false;

  constructor() { super(SCENE_KEYS.labyrinth); }

  preload(): void {
    this.bridge = this.registry.get(REGISTRY_KEYS.bridge) as GameBridge;
    preloadMazeTerrain(this);
    // Start fetching the room snapshot while Phaser loads the static map texture.
    void this.bridge.mazeStart().catch(() => undefined);
  }

  create(): void {
    const virtual = this.registry.get(REGISTRY_KEYS.virtualInput) as VirtualInput | null;
    virtual?.setEnabled?.(true);
    const built = buildMazeWorld(this);
    this.hazards = built.hazards;
    this.checkpoints = built.checkpoints;
    this.letters = built.letters;
    const uiRoot = document.getElementById('ui-root');
    if (uiRoot) this.hud = new MazeQuestHud(uiRoot, {
      solve: (phrase) => this.bridge.mazeSolvePhrase(phrase),
      submitCode: (code) => this.bridge.mazeSubmitCode(code),
    });
    this.movement = new MovementSystem(
      this, virtual, [], MAZE_CONFIG.bounds, MAZE_CONFIG.player.speed, MAZE_CONFIG.player.radius,
      (from, target) => slideAlongMazeWalls(from, target, MAZE_WALLS, MAZE_CONFIG.player.radius),
    );

    const players = this.bridge.getPlayers();
    const slot = Math.max(0, players.findIndex((player) => player.id === this.bridge.self.id));
    this.position = { x: MAZE_CONFIG.spawn.x + (slot % 4 - 1.5) * 32, y: MAZE_CONFIG.spawn.y };
    this.local = new PlayerAvatar(this, { ...this.bridge.self, ...this.position }, true);
    const camera = this.cameras.main;
    const lerp = MAZE_CONFIG.camera.followLerp;
    camera.setBounds(0, 0, MAZE_CONFIG.width, MAZE_CONFIG.height).setRoundPixels(true);
    camera.startFollow(this.local, true, lerp, lerp).centerOn(this.position.x, this.position.y);
    this.applyZoom();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.applyZoom, this);

    this.syncPlayers(players);
    this.bridge.sendPosition(this.position.x, this.position.y);
    this.off = [
      this.bridge.on('players', (next) => this.syncPlayers(next)),
      this.bridge.on('position', ({ id, x, y }) => this.remotes.get(id)?.setTarget(x, y)),
      this.bridge.on('mazeState', (state) => this.applyState(state)),
      this.bridge.on('status', (status) => {
        if (status === 'connected' && !this.bridge.isMazeQuestReady()) this.loadProgress();
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.loadProgress();
  }

  override update(time: number, delta: number): void {
    const dt = Math.min(delta, MAZE_CONFIG.player.maxFrameDeltaMs);
    if (!this.respawning && !this.savedArrival) this.position = this.movement.step(this.position, dt / 1000);
    const { x, y } = this.position;
    this.local.tickLocal(x, y, this.movement.getDirection(), time);
    this.bridge.sendPosition(x, y);
    for (const remote of this.remotes.values()) remote.tickRemote(dt, time);

    for (const hazard of this.hazards) {
      hazard.sprite.setVisible(hazard.hits(x, y, MAZE_CONFIG.hazardReveal));
      if (!this.respawning && !this.savedArrival && time >= this.protectedUntil && hazard.hits(x, y, MAZE_CONFIG.player.radius)) this.die();
    }
    if (this.respawning) return;
    this.checkProgress(time);
    this.checkGate(time);
  }

  private loadProgress(): void {
    if (this.progressLoading) return;
    this.progressLoading = true;
    void this.bridge.mazeStart()
      .then(() => { if (this.sys.isActive() && !this.initializedProgress) this.applyState(this.bridge.getMazeQuestState()); })
      .catch(() => {
        if (this.sys.isActive()) this.notify('Не удалось загрузить лабиринт. Проверьте подключение и миграцию 007 в Supabase.', 'warn');
      })
      .finally(() => {
        this.progressLoading = false;
        this.retryProgressAt = this.time.now + 4000;
      });
  }

  private checkProgress(time: number): void {
    for (let i = this.checkpoint + 1; i < MAZE_CONFIG.checkpoints.length; i += 1) {
      if (!this.near(MAZE_CONFIG.checkpoints[i], 26)) continue;
      this.checkpoint = i;
      this.checkpoints[i].setVisible(true);
      this.notify('Безопасная точка активирована', 'success');
    }

    if (!this.bridge.isMazeQuestReady() || this.bridge.getStatus() !== 'connected') return;
    if (this.checkpoint > this.savedCheckpoint && !this.pendingSave && time >= this.retrySaveAt) {
      this.pendingSave = true;
      this.retrySaveAt = time + 2000;
      void this.bridge.mazeSaveCheckpoint(this.checkpoint)
        .catch(() => this.notify('Не удалось сохранить чекпоинт. Повторяем попытку.', 'warn'))
        .finally(() => { this.pendingSave = false; });
    }
    if (this.savedArrival || !this.letterLimit) return;
    if (this.ownLetters < this.letterLimit && !this.pendingLetter && time >= this.retryLetterAt) {
      const letter = MAZE_LETTER_POINTS.findIndex((point, index) => this.letters[index].visible && this.near(point, 27));
      if (letter >= 0) {
        this.pendingLetter = true;
        this.retryLetterAt = time + 900;
        void this.bridge.mazeCollectLetter(letter)
          .catch(() => { if (this.sys.isActive()) this.notify('Буква не сохранилась. Повторяем попытку.', 'warn'); })
          .finally(() => { this.pendingLetter = false; });
      }
    }
  }

  private checkGate(time: number): void {
    if (this.completed) return;
    const connected = this.bridge.getStatus() === 'connected';
    if (this.savedArrival) {
      if (this.gateWaitText) {
        this.hud?.setGateNotice(connected ? this.gateWaitText : 'Восстанавливаем связь у ворот…', !connected);
      }
      if (this.waitingForTeam && connected && time >= this.nextTeamRefreshAt) {
        this.nextTeamRefreshAt = time + 4500;
        void this.bridge.mazeRefresh().catch(() => undefined);
      }
      return;
    }
    if (!this.near(MAZE_CONFIG.exit, 24)) {
      this.hud?.setGateNotice(null);
      return;
    }
    if (!connected) {
      this.hud?.setGateNotice('Восстанавливаем связь у ворот…', true);
      return;
    }
    if (!this.bridge.isMazeQuestReady()) {
      this.hud?.setGateNotice('Загружаем прогресс лабиринта…', true);
      if (time >= this.retryProgressAt) this.loadProgress();
      return;
    }
    if (!this.letterLimit || this.ownLetters < this.letterLimit) {
      this.hud?.setGateNotice('Соберите свою часть букв и возвращайтесь к воротам.');
      return;
    }

    const slow = this.arrivalFailed || (this.pendingArrival && time - this.arrivalStartedAt >= 2500);
    this.hud?.setGateNotice(slow ? 'Ждём ответа сервера. Задание откроется автоматически…' : 'Готовим задание с буквами…', true);
    if (!this.pendingArrival && time >= this.retryArrivalAt) {
      this.pendingArrival = true;
      this.arrivalStartedAt = time;
      void this.bridge.mazeArrive()
        .then((result) => { this.arrivalFailed = result === 'loading' || result === 'ignored'; })
        .catch(() => { this.arrivalFailed = true; })
        .finally(() => {
          this.pendingArrival = false;
          this.retryArrivalAt = this.time.now + 1500;
        });
    }
  }

  private near(point: Point, distance: number): boolean {
    return Phaser.Math.Distance.Squared(this.position.x, this.position.y, point.x, point.y) <= distance ** 2;
  }

  private applyState(state: MazeQuestState): void {
    if (this.completed) return;
    if (state.completed) {
      this.completed = true;
      this.notify('Вход в сокровищницу открыт!', 'success');
      sessionStorage.setItem('castle-room', this.bridge.roomCode);
      this.scene.start(SCENE_KEYS.castle);
      return;
    }

    const selfId = this.bridge.self.id;
    const self = state.players[selfId];
    this.letterLimit = mazeLetterLimit(state.team, selfId);
    this.ownLetters = Object.values(state.letterOwners).filter((id) => id === selfId).length;
    this.letters.forEach((letter, index) => letter.setVisible(!state.letterOwners[index]));
    if (self) {
      const atGate = self.arrived && this.letterLimit > 0 && this.ownLetters === this.letterLimit;
      this.savedCheckpoint = Math.max(this.savedCheckpoint, self.checkpoint);
      this.checkpoint = Math.max(this.checkpoint, self.checkpoint);
      if (!this.initializedProgress) {
        if (atGate) this.position = { ...MAZE_CONFIG.exit };
        else if (self.checkpoint > 0) this.position = { ...MAZE_CONFIG.checkpoints[self.checkpoint] };
      }
      if (atGate && !this.savedArrival) {
        this.savedArrival = true;
        this.movement.reset();
        this.input.keyboard?.disableGlobalCapture();
      }
    }
    this.initializedProgress = true;
    if (this.checkpoint > 0) this.checkpoints[this.checkpoint].setVisible(true);
    if (this.savedArrival) {
      const ready = mazeAssemblyReady(state);
      const arrived = state.team.filter((id) => state.players[id]?.arrived).length;
      this.gateWaitText = ready ? null : 'У ворот: ' + arrived + '/' + state.team.length + '. Дождитесь команды.';
      const waiting = !ready || (self?.solved === true && state.team.some((id) => !state.players[id]?.solved));
      if (waiting && !this.waitingForTeam) this.nextTeamRefreshAt = this.time.now + 4500;
      this.waitingForTeam = waiting;
      this.hud?.setGateNotice(this.gateWaitText);
    }
    this.hud?.present(state, selfId);
  }

  private die(): void {
    this.respawning = true;
    this.movement.reset();
    this.cameras.main.flash(180, 92, 32, 64);
    this.local.setVisible(false);
    this.time.delayedCall(MAZE_CONFIG.respawnDelayMs, () => {
      this.position = { ...MAZE_CONFIG.checkpoints[this.checkpoint] };
      this.local.setVisible(true);
      this.protectedUntil = this.time.now + MAZE_CONFIG.invulnerableMs;
      this.respawning = false;
    });
  }

  private readonly applyZoom = (): void => {
    const { viewWidth, viewHeight, maxCssZoom } = MAZE_CONFIG.camera;
    const { width, height } = this.scale;
    this.cameras.main.setZoom(Math.min(width / viewWidth, height / viewHeight, maxCssZoom * Math.min(devicePixelRatio || 1, 2)));
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
    for (const stop of this.off) stop();
    this.off = [];
    this.scale.off(Phaser.Scale.Events.RESIZE, this.applyZoom, this);
    if (this.savedArrival) this.input.keyboard?.enableGlobalCapture();
    this.hud?.destroy();
    this.hud = null;
    this.movement.destroy();
    this.remotes.clear();
  }

  private notify(text: string, kind: 'success' | 'warn'): void {
    (this.registry.get(REGISTRY_KEYS.notifications) as import('../../ui/Notifications').Notifications | null)?.show(text, kind);
  }
}
