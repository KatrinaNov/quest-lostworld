import type { GameBridge, Point } from '../../network/types';
import type { MovementSystem } from '../systems/MovementSystem';
import { isAtJungleCamp, JUNGLE_CAMP, JUNGLE_INSPECT_ZONES, JUNGLE_SYMBOLS, JUNGLE_TEMPLE, type JungleInspectZone } from './jungleQuestConfig';
import type { JungleQuestState } from './jungleQuestTypes';

export interface JungleQuestUiHost {
  setActionAtWorld(x: number, y: number, label: string | null, onClick: (() => void) | null): void;
  notify(text: string, kind?: 'info' | 'success' | 'warn'): void;
  setJungleProgress(state: JungleQuestState): void;
  showJungleCampNote(onClose: () => void): void;
  showJungleSymbol(symbol: keyof typeof JUNGLE_SYMBOLS, onClose: () => void): void;
  showJungleCompletion(onConfirm: () => void): void;
  showJungleSecret(onSubmit: (value: string) => Promise<'wrong' | 'opened' | 'ignored'>): void;
  showJungleTempleOpen(onClose: () => void): void;
  closeJungleModal(): void;
  enterTemple(): void;
}

interface Candidate {
  distance: number;
  zone: JungleInspectZone;
}

/** Интерактивные зоны второй локации; геометрия мира остаётся нетронутой. */
export class JungleQuestController {
  private state: JungleQuestState;
  private readonly off: Array<() => void> = [];
  private modalOpen = false;
  private completionShown = false;
  private secretShown = false;
  private templeShown = false;
  private pending = false;
  private disposed = false;

  constructor(
    private readonly bridge: GameBridge,
    private readonly movement: MovementSystem,
    private readonly ui: JungleQuestUiHost,
    private readonly openTemplePassage: () => void,
  ) {
    this.state = bridge.getJungleQuestState();
    this.off.push(bridge.on('jungleState', (state) => this.onState(state)));
    this.presentState();
  }

  destroy(): void {
    this.disposed = true;
    for (const stop of this.off) stop();
    // Кнопка привязана к DOM-HUD, а не к сцене Phaser: без явной очистки она
    // могла остаться поверх уже открывшегося храма.
    this.ui.setActionAtWorld(0, 0, null, null);
    this.ui.closeJungleModal();
  }

  tick(position: Point): void {
    if (this.modalOpen) {
      this.ui.setActionAtWorld(0, 0, null, null);
      return;
    }

    if (this.canReadCampNote(position)) {
      const { x, y } = JUNGLE_CAMP.note;
      const read = () => this.readCampNote(position);
      this.ui.setActionAtWorld(x, y, 'Прочитать записку', read);
      if (this.movement.consumeInteractPress()) read();
      return;
    }

    if (!this.bridge.isJungleQuestReady()) {
      this.ui.setActionAtWorld(0, 0, null, null);
      return;
    }

    if (this.state.phase === 'temple_open') {
      const distance = Math.hypot(position.x - JUNGLE_TEMPLE.x, position.y - JUNGLE_TEMPLE.y);
      if (distance <= JUNGLE_TEMPLE.interactRadius) {
        this.ui.setActionAtWorld(JUNGLE_TEMPLE.x, JUNGLE_TEMPLE.y, 'Войти в храм', () => {
          this.ui.enterTemple();
        });
      } else this.ui.setActionAtWorld(0, 0, null, null);
      return;
    }

    if (this.state.phase !== 'exploring') {
      this.ui.setActionAtWorld(0, 0, null, null);
      return;
    }

    const candidate = this.nearest(position);
    if (!candidate) {
      this.ui.setActionAtWorld(0, 0, null, null);
      return;
    }
    const run = () => void this.inspect(candidate.zone);
    this.ui.setActionAtWorld(candidate.zone.x, candidate.zone.y, 'Осмотреть', run);
    if (this.movement.consumeInteractPress()) run();
  }

  readCampNote(position: Point): void {
    if (!this.canReadCampNote(position)) return;
    this.modalOpen = true;
    this.ui.setActionAtWorld(0, 0, null, null);
    this.ui.showJungleCampNote(() => {
      this.modalOpen = false;
      this.presentState();
    });
  }

  private canReadCampNote(position: Point): boolean {
    return !this.disposed && !this.modalOpen && !this.pending
      && (this.state.phase === 'exploring' || this.state.phase === 'temple_open')
      && isAtJungleCamp(position, JUNGLE_CAMP.approachMargin);
  }

  private nearest(position: Point): Candidate | null {
    let best: Candidate | null = null;
    for (const zone of JUNGLE_INSPECT_ZONES) {
      const distance = Math.hypot(position.x - zone.x, position.y - zone.y);
      if (distance > zone.radius || (best && distance >= best.distance)) continue;
      best = { zone, distance };
    }
    return best;
  }

  private async inspect(zone: JungleInspectZone): Promise<void> {
    if (this.pending || this.modalOpen) return;
    if (!zone.symbol || this.state.symbols[zone.symbol]) {
      this.ui.notify('Ничего необычного', 'info');
      return;
    }
    this.pending = true;
    // Сервер может прислать 3/3 до завершения await. Блокируем UI заранее,
    // чтобы сначала показать найденный символ, а затем общее послание.
    this.modalOpen = true;
    try {
      const result = await this.bridge.jungleClaimSymbol(zone.symbol);
      if (result === 'claimed') {
        this.ui.showJungleSymbol(zone.symbol, () => {
          this.modalOpen = false;
          this.presentState();
        });
      } else if (result === 'already' || result === 'unavailable') {
        this.modalOpen = false;
        this.ui.notify('Ничего необычного', 'info');
      } else {
        this.modalOpen = false;
      }
    } catch {
      this.modalOpen = false;
      this.ui.notify('Не удалось сохранить находку. Проверьте соединение.', 'warn');
    } finally {
      this.pending = false;
    }
  }

  private onState(state: JungleQuestState): void {
    this.state = state;
    this.presentState();
  }

  private presentState(): void {
    if (this.disposed) return;
    this.ui.setJungleProgress(this.state);
    // terminal-состояние должно заменить любое открытое локальное окно. Иначе
    // у второго игрока оставалось поле секретного слова после успеха первого.
    if (this.state.phase === 'temple_open') {
      if (this.templeShown) return;
      this.templeShown = true;
      this.openTemplePassage();
      this.modalOpen = true;
      this.ui.showJungleTempleOpen(() => { this.modalOpen = false; });
      return;
    }
    if (this.modalOpen) return;
    if (this.state.phase === 'message_ready' && !this.completionShown) {
      this.completionShown = true;
      this.modalOpen = true;
      this.ui.showJungleCompletion(() => void this.confirmMessage());
      return;
    }
    if (this.state.phase === 'secret_word' && !this.secretShown) {
      this.secretShown = true;
      this.modalOpen = true;
      this.ui.showJungleSecret((value) => this.submitSecret(value));
      return;
    }
  }

  private async confirmMessage(): Promise<void> {
    try {
      await this.bridge.jungleAcknowledgeMessage();
    } catch {
      this.ui.notify('Не удалось подтвердить послание. Попробуйте ещё раз.', 'warn');
    } finally {
      if (!this.templeShown) {
        this.modalOpen = false;
        if (this.state.phase === 'message_ready') this.completionShown = false;
        this.presentState();
      }
    }
  }

  private async submitSecret(value: string): Promise<'wrong' | 'opened' | 'ignored'> {
    try {
      const result = await this.bridge.jungleSubmitSecret(value);
      // Серверное состояние уже обновляет окно у всех, включая отправителя.
      if (result === 'opened') return 'opened';
      return result === 'wrong' ? 'wrong' : 'ignored';
    } catch {
      this.ui.notify('Не удалось проверить слово. Проверьте соединение.', 'warn');
      return 'ignored';
    }
  }
}
