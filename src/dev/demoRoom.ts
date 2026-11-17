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
import type { DevPreviewOptions } from './devPreview';
import {
  initialJungleQuestState,
  type JungleQuestState,
  type JungleSymbolId,
} from '../game/quest/jungleQuestTypes';

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

    if (preview?.locationId === 2) {
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
      preview?.locationId === 2 ? { x: this.self.x, y: this.self.y } : { x: 1200, y: 800 };
    this.timer = window.setInterval(() => {
      this.t += 0.1;
      const [, a, b] = this.players;
      a.x = roamCenter.x + Math.cos(this.t * 0.7) * (preview?.locationId === 2 ? 160 : 420);
      a.y = roamCenter.y + Math.sin(this.t * 0.7) * (preview?.locationId === 2 ? 120 : 300);
      b.x = roamCenter.x + Math.cos(-this.t * 0.5 + 2) * (preview?.locationId === 2 ? 200 : 600);
      b.y = roamCenter.y + Math.sin(-this.t * 0.5 + 2) * (preview?.locationId === 2 ? 140 : 380);
      this.emit('position', { id: a.id, x: a.x, y: a.y });
      this.emit('position', { id: b.id, x: b.x, y: b.y });
    }, 100);
  }

  getPlayers(): Player[] {
    return [...this.players];
  }

  getStatus(): ConnectionStatus {
    return 'connected';
  }

  getQuestState() {
    return this.quest.getState();
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
