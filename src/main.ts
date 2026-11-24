import './styles/main.css';
import { isSupabaseConfigured } from './config/appConfig';
import type { GameHandle } from './game/createGame';
import { WORLD_CONFIG } from './game/config/worldConfig';
import { createRoom, getResumableRoomCode, joinRoom, rememberRoomCode } from './network/roomService';
import type { Point, RoomSession } from './network/types';
import { enterFullscreen, isFullscreen, isFullscreenSupported, isMobileDevice, isStandalone, toggleFullscreen } from './ui/Fullscreen';
import type { QuestUiHost } from './game/quest/IslandQuestController';
import { Hud } from './ui/Hud';
import { LegendModal } from './ui/LegendModal';
import { Lobby } from './ui/Lobby';
import { keepMobileFieldsVisible } from './ui/mobileKeyboardViewport';
import { MobileControls } from './ui/MobileControls';
import { Notifications } from './ui/Notifications';
import { QuestHud } from './ui/QuestHud';
import { JungleQuestHud } from './ui/JungleQuestHud';
import { TempleQuestHud } from './ui/TempleQuestHud';

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

/** Публичный тестовый вход: пропускает путь до храма, но не подменяет комнату или Supabase. */
function testLocation(): 'temple' | 'maze' | 'castle' | null {
  const params = new URLSearchParams(window.location.search);
  const location = params.get('test');
  if (import.meta.env.DEV && location === 'castle' && params.get('demo') === '1') return location;
  return location === 'temple' || location === 'maze' ? location : null;
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
  private legend: LegendModal | null = null;
  private questHud: QuestHud | null = null;
  private jungleHud: JungleQuestHud | null = null;
  private templeHud: TempleQuestHud | null = null;
  private roomListeners: Array<() => void> = [];
  private knownPlayers = new Map<string, string>();
  private leaving = false;
  private notificationsShowingBanner = false;
  private wantsFullscreen = false;
  private restoreFullscreenOnTap = false;

  constructor() {
    keepMobileFieldsVisible(this.appEl);
    this.lobby = new Lobby(this.uiRoot, {
      onCreate: async (name) => {
        this.requestMobileFullscreen();
        const { createGame } = await import('./game/createGame');
        const room = await createRoom(name, spawnForSlot);
        this.enterGame(room, createGame);
        this.notifications.show(`Комната создана. Код: ${room.roomCode}`, 'success', 5000);
      },
      onJoin: async (name, code) => {
        this.requestMobileFullscreen();
        const { createGame } = await import('./game/createGame');
        const room = await joinRoom(name, code, spawnForSlot);
        this.enterGame(room, createGame);
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
      void Promise.all([import('./dev/devPreview'), import('./dev/demoRoom'), import('./game/createGame')])
        .then(([preview, demo, game]) => {
          const options = preview.parseDevPreview();
          this.enterGame(new demo.DemoRoom('Тестер', options), game.createGame, options ?? {});
        });
    }

    window.addEventListener('pagehide', (event) => {
      if (!event.persisted) void this.room?.leave();
    });
    // После сна Android/Chrome может сам выйти из Fullscreen API и показать URL-строку.
    // Браузер разрешит вернуть fullscreen только по следующему касанию пользователя.
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pageshow', this.onVisibilityChange);
    window.addEventListener('pointerup', this.restoreFullscreenAfterWake, { capture: true, passive: true });
    window.addEventListener('click', this.restoreFullscreenAfterWake, { capture: true, passive: true });
  }

  private setMode(mode: 'lobby' | 'game'): void {
    this.appEl.classList.toggle('app--lobby', mode === 'lobby');
    this.appEl.classList.toggle('app--game', mode === 'game');
  }

  private requestMobileFullscreen(): void {
    if (!isMobileDevice() || !isFullscreenSupported() || isStandalone()) return;
    this.wantsFullscreen = true;
    void enterFullscreen();
  }

  private readonly toggleFullscreen = (): void => {
    this.wantsFullscreen = !isFullscreen();
    this.restoreFullscreenOnTap = false;
    void toggleFullscreen();
  };

  private readonly onVisibilityChange = (): void => {
    if (this.room && this.wantsFullscreen) this.restoreFullscreenOnTap = true;
  };

  private readonly restoreFullscreenAfterWake = (event: Event): void => {
    if (!this.restoreFullscreenOnTap || this.appEl.classList.contains('app--keyboard')) return;
    if (event.target instanceof Element && event.target.closest('.hud-fs, input, textarea, select')) return;
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    this.restoreFullscreenOnTap = false;
    if (this.room && !isFullscreen() && !isStandalone()) void enterFullscreen();
  };

  private enterGame(room: RoomSession, createGame: typeof import('./game/createGame').createGame, demo?: { locationId?: number }): void {
    this.room = room;
    this.leaving = false;
    const resuming = !demo && getResumableRoomCode() === room.roomCode;
    if (!demo) rememberRoomCode(room.roomCode);
    if (demo) {
      for (const stage of ['temple', 'maze', 'castle']) {
        if (sessionStorage.getItem(`${stage}-room`) === room.roomCode) sessionStorage.removeItem(`${stage}-room`);
      }
    }
    const location = resuming ? null : testLocation() ?? (demo?.locationId === 3 ? 'temple' : null);
    if (location) sessionStorage.setItem(`${location}-room`, room.roomCode);
    if (location === 'temple' || location === 'maze') {
      if (sessionStorage.getItem('castle-room') === room.roomCode) sessionStorage.removeItem('castle-room');
      if (location === 'temple' && sessionStorage.getItem('maze-room') === room.roomCode) sessionStorage.removeItem('maze-room');
    }
    this.lobby.hide();
    this.setMode('game');

    this.knownPlayers = new Map(room.getPlayers().map((p) => [p.id, p.name]));
    this.controls = MobileControls.isNeeded() ? new MobileControls(this.uiRoot) : null;
    this.hud = new Hud(this.uiRoot, room, () => void this.leave(), this.notifications, this.toggleFullscreen);
    this.legend = new LegendModal(this.uiRoot);
    this.questHud = new QuestHud(this.uiRoot);
    this.jungleHud = new JungleQuestHud(this.uiRoot);
    this.templeHud = new TempleQuestHud(this.uiRoot);

    const questUi: QuestUiHost = {
      setActionAtWorld: (x, y, label, onClick) => this.questHud?.setActionAtWorld(x, y, label, onClick),
      setHintAtWorld: (x, y, text) => this.questHud?.setHintAtWorld(x, y, text),
      clearWorldUi: () => this.questHud?.clearWorldUi(),
      openLegend: (onStart, onClose) => this.legend?.open({ onStart, onClose }),
      closeLegend: () => this.legend?.close(),
      notify: (text, kind = 'info') => this.notifications.show(text, kind),
      setPortalBanner: (visible, text) => this.questHud?.setPortalBanner(visible, text),
      onAllKeysDelivered: () =>
        this.notifications.show(
          'Все ключи на месте! Команда объединила силы. Древний портал открывается!',
          'success',
          6500,
        ),
      onLocationReached: () => {
        this.notifications.show('Команда перешла в мир кубов!', 'success', 4500);
      },
    };

    this.game = createGame(
      this.gameRoot,
      room,
      this.controls,
      questUi,
      this.questHud,
      this.jungleHud,
      this.templeHud,
      this.notifications,
    );

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
    if (getResumableRoomCode() === room.roomCode) rememberRoomCode(null);
    this.restoreFullscreenOnTap = false;
    for (const off of this.roomListeners) off();
    this.roomListeners = [];

    this.game?.destroy();
    this.game = null;
    this.hud?.destroy();
    this.hud = null;
    this.controls?.destroy();
    this.controls = null;
    this.questHud?.destroy();
    this.questHud = null;
    this.legend?.destroy();
    this.legend = null;
    this.jungleHud?.destroy();
    this.jungleHud = null;
    this.templeHud?.destroy();
    this.templeHud = null;
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
