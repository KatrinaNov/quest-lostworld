import { Emitter } from '../network/emitter';
import type {
  ConnectionStatus,
  Player,
  RoomEvents,
  RoomSession,
} from '../network/types';
import { APP_CONFIG } from '../config/appConfig';
import { WORLD_CONFIG } from '../game/config/worldConfig';

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

  constructor(name: string) {
    super();
    const spawn = WORLD_CONFIG.spawnPoints[0];
    this.self = { id: 'demo-self', name, color: APP_CONFIG.playerColors[0], x: spawn.x, y: spawn.y, connected: true, updatedAt: Date.now() };
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

    // Боты обновляют позицию 10 раз в секунду, как настоящие игроки.
    this.timer = window.setInterval(() => {
      this.t += 0.1;
      const [, a, b] = this.players;
      a.x = 1200 + Math.cos(this.t * 0.7) * 420;
      a.y = 800 + Math.sin(this.t * 0.7) * 300;
      b.x = 1200 + Math.cos(-this.t * 0.5 + 2) * 600;
      b.y = 800 + Math.sin(-this.t * 0.5 + 2) * 380;
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
    this.clearListeners();
  }
}
