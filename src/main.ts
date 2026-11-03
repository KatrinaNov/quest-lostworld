import './styles/main.css';
import { isSupabaseConfigured } from './config/appConfig';
import { createGame, type GameHandle } from './game/createGame';
import { WORLD_CONFIG } from './game/config/worldConfig';
import { createRoom, joinRoom } from './network/roomService';
import type { Point, RoomSession } from './network/types';
import { Hud } from './ui/Hud';
import { Lobby } from './ui/Lobby';
import { MobileControls } from './ui/MobileControls';
import { Notifications } from './ui/Notifications';

function requireById(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Не найден элемент #${id}`);
  return el;
}

/** Стартовая точка игрока по номеру слота в комнате. */
function spawnForSlot(slot: number): Point {
  const points = WORLD_CONFIG.spawnPoints;
  const p = points[slot % points.length];
  return { x: p.x, y: p.y };
}

/**
 * Единственное место, где соединяются UI, сеть и игра.
 * Сцены Phaser о сети не знают, сетевой слой — об интерфейсе и сценах.
 */
class App {
  private readonly appEl = requireById('app');
  private readonly gameRoot = requireById('game-root');
  private readonly uiRoot = requireById('ui-root');
  private readonly notifications = new Notifications(requireById('toast-root'));
  private readonly lobby: Lobby;

  private room: RoomSession | null = null;
  private game: GameHandle | null = null;
  private hud: Hud | null = null;
  private controls: MobileControls | null = null;
  private roomListeners: Array<() => void> = [];
  private knownPlayers = new Map<string, string>();
  private leaving = false;
  private notificationsShowingBanner = false;

  constructor() {
    this.lobby = new Lobby(this.uiRoot, {
      onCreate: async (name) => {
        const room = await createRoom(name, spawnForSlot);
        this.enterGame(room);
        this.notifications.show(`Комната создана. Код: ${room.roomCode}`, 'success', 5000);
      },
      onJoin: async (name, code) => {
        const room = await joinRoom(name, code, spawnForSlot);
        this.enterGame(room);
        this.notifications.show(`Вы в комнате ${room.roomCode}`, 'success');
      },
    });

    this.setMode('lobby');
    if (!isSupabaseConfigured()) {
      this.lobby.setStatus(
        'Не настроен Supabase: задайте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY (см. README).',
        'error',
      );
    }

    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('demo') === '1') {
      void import('./dev/demoRoom').then(({ DemoRoom }) => this.enterGame(new DemoRoom('Тестер')));
    }

    window.addEventListener('pagehide', () => {
      void this.room?.leave();
    });
  }

  private setMode(mode: 'lobby' | 'game'): void {
    this.appEl.classList.toggle('app--lobby', mode === 'lobby');
    this.appEl.classList.toggle('app--game', mode === 'game');
  }

  private enterGame(room: RoomSession): void {
    this.room = room;
    this.leaving = false;
    this.lobby.hide();
    this.setMode('game');

    this.knownPlayers = new Map(room.getPlayers().map((p) => [p.id, p.name]));
    this.controls = MobileControls.isNeeded() ? new MobileControls(this.uiRoot) : null;
    this.hud = new Hud(this.uiRoot, room, () => void this.leave(), this.notifications);
    this.game = createGame(this.gameRoot, room, this.controls);

    this.roomListeners = [
      room.on('status', (status) => {
        if (status === 'reconnecting') {
          this.notificationsShowingBanner = true;
          this.notifications.setBanner('Связь потеряна. Пытаемся переподключиться…', 'warn');
        } else if (status === 'connected') {
          if (this.notificationsShowingBanner) {
            this.notificationsShowingBanner = false;
            this.notifications.show('Соединение восстановлено', 'success');
          }
          this.notifications.setBanner(null);
        }
      }),
      room.on('players', (players) => this.announcePlayers(players.map((p) => ({ id: p.id, name: p.name })))),
      room.on('kicked', () => {
        void this.leave('Комната заполнена: вы не поместились в команду.', 'error');
      }),
    ];

    if (!this.controls) {
      this.notifications.show('Управление: WASD или стрелки', 'info', 5000);
    }
  }

  /** Уведомления о входе и выходе других игроков. */
  private announcePlayers(players: Array<{ id: string; name: string }>): void {
    const selfId = this.room?.self.id;
    const next = new Map(players.map((p) => [p.id, p.name]));

    for (const [id, name] of next) {
      if (id !== selfId && !this.knownPlayers.has(id)) this.notifications.show(`${name} присоединился`, 'success');
    }
    for (const [id, name] of this.knownPlayers) {
      if (id !== selfId && !next.has(id)) this.notifications.show(`${name} вышел из комнаты`, 'info');
    }
    this.knownPlayers = next;
  }

  private async leave(message?: string, kind: 'info' | 'error' = 'info'): Promise<void> {
    if (this.leaving || !this.room) return;
    this.leaving = true;

    const room = this.room;
    this.room = null;
    for (const off of this.roomListeners) off();
    this.roomListeners = [];

    this.game?.destroy();
    this.game = null;
    this.hud?.destroy();
    this.hud = null;
    this.controls?.destroy();
    this.controls = null;
    this.notifications.setBanner(null);

    this.setMode('lobby');
    this.lobby.show();
    this.notifications.show(message ?? 'Вы вышли из комнаты', kind);

    await room.leave();
    this.leaving = false;
  }
}

// Запрет масштабирования жестами на iOS и контекстного меню при долгом нажатии.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

new App();
