import { IslandQuestSync } from '../network/islandQuestSync';
import { Emitter } from '../network/emitter';
import type {
  ConnectionStatus,
  GameEvent,
  Player,
  RoomEvents,
  RoomSession,
} from '../network/types';
import { APP_CONFIG } from '../config/appConfig';
import { minecraftSpawnForPlayer } from '../game/config/minecraftWorldConfig';
import { WORLD_CONFIG } from '../game/config/worldConfig';
import { TEMPLE_CONFIG } from '../game/config/templeConfig';
import type { DevPreviewOptions } from './devPreview';
import {
  initialJungleQuestState,
  type JungleQuestState,
  type JungleSymbolId,
} from '../game/quest/jungleQuestTypes';
import { initialTempleQuestState, type TempleQuestState } from '../game/quest/templeQuestTypes';
import { initialMazePlayerState, initialMazeQuestState, MAZE_GLYPHS, MAZE_PHRASE, mazeAssemblyReady, type MazeQuestState } from '../game/quest/mazeQuestTypes';
import { ALL_CASTLE_SEALS, CASTLE_MEMORY_LENGTHS, CASTLE_MIRROR_LEASE_MS, CASTLE_MIRROR_SEAL, initialCastleQuestState, isCastleSealOpen, type CastleAnswer, type CastleMemoryRound, type CastleQuestState } from '../game/quest/castleQuestTypes';

/**
 * ТОЛЬКО ДЛЯ РАЗРАБОТКИ (npm run dev, адрес ?demo=1): локальная «комната» без Supabase
 * с двумя ботами. Позволяет проверить мир, управление и интерполяцию без настройки сервера.
 * В production-сборку не попадает (вызов защищён import.meta.env.DEV).
 */
export class DemoRoom extends Emitter<RoomEvents> implements RoomSession {
  readonly roomCode = 'DEMO42';
  readonly self: Player;
  private players: Player[];
  private timer: number | null = null;
  private t = 0;
  private readonly quest: IslandQuestSync;
  private readonly questOff: () => void;
  private jungleState: JungleQuestState = initialJungleQuestState();
  private templeState: TempleQuestState = initialTempleQuestState();
  private mazeState: MazeQuestState = initialMazeQuestState();
  private castleState = initialCastleQuestState();
  private castleMemory: CastleMemoryRound | null = null;
  private mirrorAlignedSince = 0;

  constructor(name: string, preview: DevPreviewOptions | null = null) {
    super();
    const islandSpawn = WORLD_CONFIG.spawnPoints[0];
    this.self = {
      id: 'demo-self',
      name,
      color: APP_CONFIG.playerColors[0],
      x: islandSpawn.x,
      y: islandSpawn.y,
      connected: true,
      updatedAt: Date.now(),
    };
    const bot = (id: string, botName: string, color: number, x: number, y: number): Player => ({
      id,
      name: botName,
      color,
      x,
      y,
      connected: true,
      updatedAt: Date.now(),
    });
    this.players = [
      this.self,
      bot('demo-bot-1', 'Робот Лев', APP_CONFIG.playerColors[1], 1400, 960),
      bot('demo-bot-2', 'Робот Аня', APP_CONFIG.playerColors[2], 1000, 700),
    ];

    this.quest = new IslandQuestSync(
      this.self,
      this.roomCode,
      () => this.getPlayers(),
      (event: GameEvent) => this.emit('gameEvent', event),
    );
    this.questOff = this.quest.on('questState', (state) => this.emit('questState', state));

    if (preview?.locationId === 2 || preview?.locationId === 3) {
      this.quest.devJumpToLocation(2);
      const spawn = minecraftSpawnForPlayer(this.getPlayers(), this.self.id);
      this.self.x = spawn.x;
      this.self.y = spawn.y;
      this.players[1].x = spawn.x + 80;
      this.players[1].y = spawn.y + 40;
      this.players[2].x = spawn.x - 70;
      this.players[2].y = spawn.y + 55;
    }

    this.emit('questState', this.quest.getState());

    // Боты обновляют позицию 10 раз в секунду, как настоящие игроки.
    const roamCenter =
      preview?.locationId === 2 || preview?.locationId === 3 ? { x: this.self.x, y: this.self.y } : { x: 1200, y: 800 };
    this.timer = window.setInterval(() => {
      this.t += 0.1;
      const [, a, b] = this.players;
      a.x = roamCenter.x + Math.cos(this.t * 0.7) * (preview?.locationId === 2 || preview?.locationId === 3 ? 160 : 420);
      a.y = roamCenter.y + Math.sin(this.t * 0.7) * (preview?.locationId === 2 || preview?.locationId === 3 ? 120 : 300);
      b.x = roamCenter.x + Math.cos(-this.t * 0.5 + 2) * (preview?.locationId === 2 || preview?.locationId === 3 ? 200 : 600);
      b.y = roamCenter.y + Math.sin(-this.t * 0.5 + 2) * (preview?.locationId === 2 || preview?.locationId === 3 ? 140 : 380);
      this.emit('position', { id: a.id, x: a.x, y: a.y });
      this.emit('position', { id: b.id, x: b.x, y: b.y });
    }, 100);
  }

  getPlayers(): Player[] {
    return this.castleState.mirrorTeam.length ? [this.self] : [...this.players];
  }

  getStatus(): ConnectionStatus {
    return 'connected';
  }

  getQuestState() {
    return this.quest.getState();
  }

  questStartAdventure(): void {
    this.quest.startAdventure();
  }

  questPickKey(slot: number) {
    return this.quest.pickKey(slot);
  }

  questInsertKey(slot: number) {
    return this.quest.insertKey(slot);
  }

  questAcknowledgePortal(): void {
    this.quest.acknowledgePortal();
  }

  getJungleQuestState(): JungleQuestState {
    return this.jungleState;
  }

  isJungleQuestReady(): boolean {
    return true;
  }

  async jungleClaimSymbol(symbol: JungleSymbolId) {
    if (this.jungleState.phase !== 'exploring') return 'unavailable' as const;
    if (this.jungleState.symbols[symbol]) return 'already' as const;
    const symbols = { ...this.jungleState.symbols, [symbol]: true };
    const complete = symbols.leaf && symbols.water && symbols.stone;
    this.jungleState = {
      ...this.jungleState,
      revision: this.jungleState.revision + 1,
      symbols,
      phase: complete ? 'message_ready' : 'exploring',
    };
    this.emit('jungleState', this.jungleState);
    return 'claimed' as const;
  }

  async jungleAcknowledgeMessage() {
    if (this.jungleState.phase !== 'message_ready') return 'ignored' as const;
    this.jungleState = {
      ...this.jungleState,
      revision: this.jungleState.revision + 1,
      phase: 'secret_word',
      messageAcknowledged: true,
    };
    this.emit('jungleState', this.jungleState);
    return 'acknowledged' as const;
  }

  async jungleSubmitSecret(secret: string) {
    if (this.jungleState.phase !== 'secret_word') return 'ignored' as const;
    if (secret.trim().toLocaleUpperCase('ru-RU') !== 'ХРАМ') return 'wrong' as const;
    this.jungleState = { ...this.jungleState, revision: this.jungleState.revision + 1, phase: 'temple_open' };
    this.emit('jungleState', this.jungleState);
    return 'opened' as const;
  }

  getTempleQuestState(): TempleQuestState { return this.templeState; }
  isTempleQuestReady(): boolean { return true; }
  async templeStart(): Promise<void> {
    // В preview оставляем одного участника, чтобы финал можно было пройти без ботов.
    if (this.templeState.team.length === 0) {
      this.templeState = { ...this.templeState, revision: this.templeState.revision + 1, team: [{ id: this.self.id, name: this.self.name, color: this.self.color }] };
    }
    this.emit('templeState', this.templeState);
  }
  async templeSaveCheckpoint(index: number) {
    const previous = this.templeState.players[this.self.id];
    const checkpoint = Math.max(previous?.checkpoint ?? -1, Math.min(TEMPLE_CONFIG.checkpoints.length - 1, index));
    const players = { ...this.templeState.players, [this.self.id]: { checkpoint, plateActive: previous?.plateActive ?? false } };
    this.templeState = { ...this.templeState, revision: this.templeState.revision + 1, players };
    this.emit('templeState', this.templeState);
    return 'checkpoint_saved' as const;
  }
  async templeSetPlate(active: boolean) {
    const players = { ...this.templeState.players, [this.self.id]: { checkpoint: this.templeState.players[this.self.id]?.checkpoint ?? -1, plateActive: active } };
    const ownStars = this.templeState.stars[this.self.id]?.length ?? 0;
    const finalStarted = this.templeState.phase === 'collecting' && active && ownStars === 3;
    this.templeState = { ...this.templeState, revision: this.templeState.revision + 1, players, phase: finalStarted ? 'final_started' : this.templeState.phase };
    this.emit('templeState', this.templeState);
    return finalStarted ? 'final_started' as const : 'plate_updated' as const;
  }
  async templeCollectStar(index: number) {
    if (this.templeState.phase !== 'collecting' || index < 0 || index > 2) return 'ignored' as const;
    const previous = this.templeState.stars[this.self.id] ?? [];
    if (previous.includes(index)) return 'ignored' as const;
    this.templeState = { ...this.templeState, revision: this.templeState.revision + 1, stars: { ...this.templeState.stars, [this.self.id]: [...previous, index] } };
    this.emit('templeState', this.templeState);
    return 'star_collected' as const;
  }
  async templeRevealHint() {
    if (this.templeState.phase !== 'final_started') return 'ignored' as const;
    this.templeState = { ...this.templeState, revision: this.templeState.revision + 1, phase: 'hint_ready', doorOpen: true };
    this.emit('templeState', this.templeState);
    return 'hint_ready' as const;
  }
  async templeTransition() {
    if (this.templeState.phase !== 'hint_ready') return 'ignored' as const;
    this.templeState = { ...this.templeState, revision: this.templeState.revision + 1, phase: 'transitioned' };
    this.emit('templeState', this.templeState);
    return 'transitioned' as const;
  }
  getMazeQuestState(): MazeQuestState { return this.mazeState; }
  isMazeQuestReady(): boolean { return true; }
  async mazeRefresh(): Promise<void> { this.emit('mazeState', this.mazeState); }
  async mazeStart(): Promise<void> {
    if (this.mazeState.team.length) return;
    const atFinal = new URLSearchParams(location.search).get('maze') === 'final';
    this.updateMaze({
      team: [this.self.id],
      players: { [this.self.id]: { ...initialMazePlayerState(), arrived: atFinal } },
      letterOwners: atFinal ? Object.fromEntries(MAZE_GLYPHS.map((_letter, index) => [index, this.self.id])) : {},
    });
  }

  async mazeSaveCheckpoint(index: number) {
    this.updateMaze({ players: { [this.self.id]: { ...this.mazeState.players[this.self.id], checkpoint: Math.max(0, Math.min(2, index)) } } });
    return 'checkpoint_saved' as const;
  }

  async mazeCollectLetter(index: number) {
    if (!MAZE_GLYPHS[index] || this.mazeState.letterOwners[index]) return 'ignored' as const;
    this.updateMaze({ letterOwners: { ...this.mazeState.letterOwners, [index]: this.self.id } });
    return 'collected' as const;
  }

  async mazeArrive() {
    if (Object.keys(this.mazeState.letterOwners).length !== MAZE_GLYPHS.length) return 'ignored' as const;
    this.updateMaze({ players: { [this.self.id]: { ...this.mazeState.players[this.self.id], arrived: true } } });
    return 'arrived' as const;
  }

  async mazeSolvePhrase(phrase: string) {
    if (!mazeAssemblyReady(this.mazeState)) return 'ignored' as const;
    if (phrase !== MAZE_PHRASE) return 'wrong' as const;
    this.updateMaze({ players: { [this.self.id]: { ...this.mazeState.players[this.self.id], solved: true } } });
    return 'solved' as const;
  }

  async mazeSubmitCode(code: string) {
    if (!this.mazeState.players[this.self.id]?.solved) return 'ignored' as const;
    if (code.trim().toUpperCase() !== 'МЕЧ') return 'wrong' as const;
    this.updateMaze({ completed: true });
    return 'completed' as const;
  }

  private updateMaze(changes: Partial<MazeQuestState>): void {
    this.mazeState = { ...this.mazeState, ...changes, revision: this.mazeState.revision + 1 };
    this.emit('mazeState', this.mazeState);
  }

  getCastleQuestState() { return this.castleState; }
  isCastleQuestReady() { return true; }
  async castleStart(): Promise<void> {
    if (!this.castleState.mirrorTeam.length) {
      this.castleState = { ...this.castleState, mirrorTeam: [this.self.id] };
      this.emit('players', this.getPlayers());
    }
    this.emit('castleState', this.castleState);
  }
  async castleAnswer(seal: number, answer?: string): Promise<CastleAnswer> {
    if (isCastleSealOpen(this.castleState, seal)) return { result: 'already_open' };
    const normalized = answer?.trim().toUpperCase();
    if (seal === CASTLE_MIRROR_SEAL) {
      const result = this.holdCastleMirror(normalized);
      if (result) return result;
    } else if (seal === 2) {
      const memory = this.castleMemory ?? this.makeCastleMemory(0);
      const currentStage = normalized?.startsWith(`${memory.stage}:`) ?? false;
      const correct = currentStage && normalized === `${memory.stage}:${memory.pattern}`;
      if (!correct) return { result: 'memory', memory: { ...memory, retry: currentStage } };
      if (memory.stage < CASTLE_MEMORY_LENGTHS.length - 1) {
        return { result: 'memory', memory: this.makeCastleMemory(memory.stage + 1) };
      }
    } else {
      const expected = ['CREEPER,BOW,TORCH,AXE,PICKAXE,SWORD,POTION', '108'][seal];
      if (!expected || normalized !== expected) return { result: 'wrong' };
    }
    const openedMask = this.castleState.openedMask | (1 << seal);
    this.updateCastle({ openedMask, ...(seal === CASTLE_MIRROR_SEAL ? { mirrorHolds: {} } : {}) });
    return { result: openedMask === ALL_CASTLE_SEALS ? 'completed' : 'opened' };
  }

  private holdCastleMirror(answer?: string): CastleAnswer | undefined {
    if (answer === 'RELEASE') {
      this.mirrorAlignedSince = 0;
      this.updateCastle({ mirrorHolds: {} });
      return { result: 'synced' };
    }
    if (!answer || !/^[0-7]$/.test(answer)) return { result: 'wrong' };
    const step = Number(answer);
    const now = Date.now();
    const previous = this.castleState.mirrorHolds[this.self.id];
    if (step !== 0) this.mirrorAlignedSince = 0;
    else if (previous?.step !== 0 || previous.expiresAt <= now) this.mirrorAlignedSince = now;
    if (step === 0 && now - this.mirrorAlignedSince >= 650) return;
    this.updateCastle({ mirrorHolds: { [this.self.id]: { step, expiresAt: now + CASTLE_MIRROR_LEASE_MS } } });
    return { result: 'synced' };
  }

  private updateCastle(changes: Partial<CastleQuestState>): void {
    this.castleState = { ...this.castleState, ...changes, revision: this.castleState.revision + 1 };
    this.emit('castleState', this.castleState);
  }

  private makeCastleMemory(stage: number): CastleMemoryRound {
    const pool = [...'123456789'];
    const pattern = Array.from({ length: CASTLE_MEMORY_LENGTHS[stage] }, () =>
      pool.splice(Math.floor(Math.random() * pool.length), 1)[0]).join('');
    this.castleMemory = { stage, pattern, retry: false };
    return this.castleMemory;
  }

  sendPosition(x: number, y: number): void {
    this.self.x = x;
    this.self.y = y;
    // Диагностика скорости в консоли: window.__demoTrack (последние ~600 кадров).
    const w = window as unknown as { __demoTrack?: Array<[number, number, number]> };
    const track = (w.__demoTrack ??= []);
    track.push([performance.now(), x, y]);
    if (track.length > 600) track.shift();
  }

  async leave(): Promise<void> {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.questOff();
    this.clearListeners();
  }
}
