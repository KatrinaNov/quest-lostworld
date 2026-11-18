import Phaser from 'phaser';
import type { GameBridge, Player, Point } from '../../network/types';
import { MAZE_CONFIG } from '../config/mazeConfig';
import { PlayerAvatar } from '../entities/Player';
import { MovementSystem, type VirtualInput } from '../systems/MovementSystem';
import { buildMazeWorld, type MazeHazard } from '../world/MazeWorld';
import { REGISTRY_KEYS } from './WorldScene';
import { SCENE_KEYS } from './BootScene';

/** Топ-даун лабиринт: сетевой слой передаёт позиции, а видимость опасностей локальна. */
export class LabyrinthScene extends Phaser.Scene {
  private bridge!: GameBridge; private movement!: MovementSystem; private local!: PlayerAvatar; private remotes = new Map<string, PlayerAvatar>();
  private position: Point = { ...MAZE_CONFIG.spawn }; private last = 0; private hazards: MazeHazard[] = []; private checkpoints: Phaser.GameObjects.Rectangle[] = [];
  private checkpoint = 0; private respawning = false; private protectedUntil = 0; private arrived = false; private off: Array<() => void> = [];
  constructor() { super(SCENE_KEYS.labyrinth); }
  create(): void {
    this.bridge = this.registry.get(REGISTRY_KEYS.bridge) as GameBridge;
    (this.registry.get(REGISTRY_KEYS.virtualInput) as VirtualInput | undefined)?.setEnabled?.(true);
    const built = buildMazeWorld(this); this.hazards = built.hazards; this.checkpoints = built.checkpoints;
    this.movement = new MovementSystem(this, this.registry.get(REGISTRY_KEYS.virtualInput) as VirtualInput | null, built.walls, { minX: 42, maxX: MAZE_CONFIG.width - 42, minY: 42, maxY: MAZE_CONFIG.height - 42 }, MAZE_CONFIG.player.speed, MAZE_CONFIG.player.radius);
    this.local = new PlayerAvatar(this, { ...this.bridge.self, ...this.position }, true); this.setupCamera(); this.syncPlayers(this.bridge.getPlayers());
    this.off.push(this.bridge.on('players', (players) => this.syncPlayers(players)), this.bridge.on('position', ({ id, x, y }) => this.remotes.get(id)?.setTarget(x, y)), this.bridge.on('mazeState', (state) => this.applyState(state)));
    void this.bridge.mazeStart().catch(() => this.notify('Не удалось загрузить состояние лабиринта. Проверьте миграцию Supabase.', 'warn'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }
  override update(time: number, delta: number): void {
    const dt = Phaser.Math.Clamp(this.last ? time - this.last : delta, 0, MAZE_CONFIG.player.maxFrameDeltaMs); this.last = time;
    if (!this.respawning) this.position = this.movement.step(this.position, dt / 1000);
    this.local.tickLocal(this.position.x, this.position.y, this.movement.getDirection(), time); this.bridge.sendPosition(this.position.x, this.position.y);
    for (const remote of this.remotes.values()) remote.tickRemote(dt, time);
    for (const hazard of this.hazards) { const visible = Phaser.Math.Distance.Between(this.position.x, this.position.y, hazard.x, hazard.y) <= MAZE_CONFIG.hazardReveal; hazard.sprite.setVisible(visible); if (!this.respawning && time >= this.protectedUntil && Phaser.Math.Distance.Between(this.position.x, this.position.y, hazard.x, hazard.y) < hazard.r + MAZE_CONFIG.player.radius) this.die(); }
    this.checkCheckpoints(); this.checkCastle();
  }
  private checkCheckpoints(): void { for (let i = this.checkpoint + 1; i < MAZE_CONFIG.checkpoints.length; i += 1) if (Phaser.Math.Distance.Between(this.position.x, this.position.y, MAZE_CONFIG.checkpoints[i].x, MAZE_CONFIG.checkpoints[i].y) < 42) { this.checkpoint = i; this.checkpoints[i].setVisible(true); void this.bridge.mazeSaveCheckpoint(i); this.notify('Безопасная точка активирована', 'success'); } }
  private checkCastle(): void { if (!this.arrived && this.position.x < 180 && this.position.y < 130) { this.arrived = true; void this.bridge.mazeArrive(); this.notify('Вы добрались до замка! Дождитесь остальных игроков', 'success'); } }
  private applyState(state: import('../quest/mazeQuestTypes').MazeQuestState): void { const self = state.players[this.bridge.self.id]; if (self && self.checkpoint > this.checkpoint) { this.checkpoint = self.checkpoint; this.position = { ...MAZE_CONFIG.checkpoints[this.checkpoint] }; } for (let i=0;i<=this.checkpoint;i+=1) this.checkpoints[i].setVisible(true); if (state.completed) this.notify('ЛАБИРИНТ ПРОЙДЕН!', 'success'); }
  private die(): void { if (this.respawning) return; this.respawning = true; this.local.setVisible(false); this.time.delayedCall(MAZE_CONFIG.respawnDelayMs, () => { this.position = { ...MAZE_CONFIG.checkpoints[this.checkpoint] }; this.local.setVisible(true); this.protectedUntil = this.time.now + MAZE_CONFIG.invulnerableMs; this.respawning = false; }); }
  private setupCamera(): void { const c = this.cameras.main; c.setBounds(0, 0, MAZE_CONFIG.width, MAZE_CONFIG.height).startFollow(this.local, true, MAZE_CONFIG.camera.followLerp, MAZE_CONFIG.camera.followLerp); c.setZoom(Math.min(this.scale.width / MAZE_CONFIG.camera.viewWidth, this.scale.height / MAZE_CONFIG.camera.viewHeight, MAZE_CONFIG.camera.maxCssZoom * Math.min(devicePixelRatio || 1, 2))).setRoundPixels(true); }
  private syncPlayers(players: Player[]): void { const seen = new Set<string>(); for (const p of players) { if (p.id === this.bridge.self.id) continue; seen.add(p.id); const old = this.remotes.get(p.id); if (old) old.setIdentity(p.name, p.color); else this.remotes.set(p.id, new PlayerAvatar(this, p, false)); } for (const [id, p] of this.remotes) if (!seen.has(id)) { p.destroy(); this.remotes.delete(id); } }
  private cleanup(): void { for (const fn of this.off) fn(); this.movement.destroy(); this.remotes.clear(); }
  private notify(text: string, kind: 'info' | 'success' | 'warn'): void { (this.registry.get(REGISTRY_KEYS.notifications) as { show?: (value: string, type?: 'info' | 'success' | 'warn') => void } | undefined)?.show?.(text, kind); }
}
