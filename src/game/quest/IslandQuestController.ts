import type Phaser from 'phaser';
import type { GameBridge, Point } from '../../network/types';
import { colorToSlot } from './islandQuestState';
import { ISLAND_QUEST, KEY_COLOR_LABELS } from './islandQuestConfig';
import { slotPhaseLabel } from './islandQuestState';
import type { IslandQuestState } from './islandQuestTypes';
import { IslandQuestWorld } from './IslandQuestWorld';
import type { PlayerAvatar } from '../entities/Player';
import type { MovementSystem } from '../systems/MovementSystem';

export interface QuestUiHost {
  setHint(text: string | null): void;
  setAction(label: string | null, onClick: (() => void) | null): void;
  openLegend(onOpen: () => void, onClose: () => void): void;
  notify(text: string, kind?: 'info' | 'success' | 'warn'): void;
  setPortalBanner(visible: boolean, text?: string): void;
  onAllKeysDelivered(): void;
  onLocationReached(): void;
}

export class IslandQuestController {
  private readonly world: IslandQuestWorld;
  private state: IslandQuestState;
  private readonly unsubscribe: Array<() => void> = [];
  private modalBlocks = false;
  private lastDoorOpen = false;

  constructor(
    scene: Phaser.Scene,
    private readonly bridge: GameBridge,
    private readonly movement: MovementSystem,
    private readonly ui: QuestUiHost,
    private readonly getLocal: () => PlayerAvatar,
    private readonly getRemotes: () => Iterable<PlayerAvatar>,
  ) {
    this.world = new IslandQuestWorld(scene);
    this.state = bridge.getQuestState();

    this.unsubscribe.push(
      this.bridge.on('questState', (st) => this.onState(st)),
      this.bridge.on('players', () => this.refreshKeyIndicators()),
    );
    this.applyState(this.state);
  }

  destroy(): void {
    for (const off of this.unsubscribe) off();
    this.ui.setAction(null, null);
    this.ui.setHint(null);
  }

  tick(pos: Point): void {
    if (this.modalBlocks || this.state.locationId !== 1) return;

    this.ui.setHint(null);

    const slot = colorToSlot(this.bridge.self.color);
    const distStone = Math.hypot(pos.x - ISLAND_QUEST.ancientStone.x, pos.y - ISLAND_QUEST.ancientStone.y);
    const door = ISLAND_QUEST.door;
    const distDoor = Math.hypot(pos.x - door.x, pos.y - door.y);

    let action: { label: string; run: () => void } | null = null;

    if (distStone <= ISLAND_QUEST.interactRadius) {
      action = {
        label: 'Исследовать',
        run: () => {
          this.ui.openLegend(
            () => {
              this.modalBlocks = true;
            },
            () => {
              this.modalBlocks = false;
            },
          );
        },
      };
    }

    if (this.state.slots[slot] === 'map' && slot < this.state.activeSlots) {
      const kp = ISLAND_QUEST.keys[slot];
      if (Math.hypot(pos.x - kp.x, pos.y - kp.y) <= ISLAND_QUEST.keyPickupRadius) {
        action = {
          label: 'Подобрать ключ',
          run: () => this.pickKey(slot),
        };
      }
    }

    if (distDoor <= door.interactRadius) {
      if (!this.state.doorOpen) {
        if (this.state.slots[slot] === 'held') {
          action = {
            label: 'Вставить ключ',
            run: () => this.insertKey(slot),
          };
        } else {
          const lines = [
            'Древняя дверь закрыта. Кажется, ей нужны ключи. Каждый из вас должен найти свой',
          ];
          for (let i = 0; i < this.state.activeSlots; i += 1) {
            lines.push(slotPhaseLabel(KEY_COLOR_LABELS[i], this.state.slots[i]));
          }
          this.ui.setHint(lines.join('\n'));
        }
      } else if (!this.state.portalReady[this.bridge.self.id]) {
        action = {
          label: 'Войти в портал',
          run: () => {
            this.bridge.questAcknowledgePortal();
            this.ui.notify('Вы готовы к переходу. Ждём остальных…', 'info');
          },
        };
        this.ui.setPortalBanner(true, 'Портал открыт. Впереди вас ждёт новый мир');
      }
    } else if (!this.state.doorOpen) {
      this.ui.setPortalBanner(false);
    }

    if (action) {
      this.ui.setAction(action.label, () => {
        action!.run();
      });
    } else {
      this.ui.setAction(null, null);
    }

    if (this.movement.consumeInteractPress() && action) {
      action.run();
    }
  }

  private pickKey(slot: number): void {
    const res = this.bridge.questPickKey(slot);
    if (res === 'wrong_color') {
      this.ui.notify('Этот ключ предназначен другому игроку', 'warn');
      return;
    }
    if (res === 'taken') return;
    if (res === 'ok') {
      this.ui.notify('Ты нашёл свой ключ! Теперь отнеси его к древней двери', 'success');
    }
  }

  private insertKey(slot: number): void {
    const res = this.bridge.questInsertKey(slot);
    if (res === 'ok') {
      this.ui.notify('Ключ установлен', 'success');
    }
  }

  private onState(state: IslandQuestState): void {
    const wasOpen = this.lastDoorOpen;
    this.applyState(state);
    if (state.doorOpen && !wasOpen) {
      this.ui.onAllKeysDelivered();
      this.ui.setPortalBanner(true, 'Портал открыт. Впереди вас ждёт новый мир');
    }
    if (state.locationId === 2) {
      this.ui.onLocationReached();
      this.ui.setAction(null, null);
      this.ui.setHint(null);
    }
    this.lastDoorOpen = state.doorOpen;
  }

  private applyState(state: IslandQuestState): void {
    this.state = state;
    this.world.applyState(state);
    this.refreshKeyIndicators();
  }

  private refreshKeyIndicators(): void {
    const players = this.bridge.getPlayers();
    const byId = new Map(players.map((p) => [p.id, p]));

    const mark = (avatar: PlayerAvatar): void => {
      const player = byId.get(avatar.playerId);
      if (!player) {
        avatar.setKeyFound(false);
        return;
      }
      const slot = colorToSlot(player.color);
      const phase = this.state.slots[slot];
      avatar.setKeyFound(phase === 'held' || phase === 'inserted');
    };

    mark(this.getLocal());
    for (const av of this.getRemotes()) mark(av);
  }
}