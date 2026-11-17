import type Phaser from 'phaser';
import { WORLD_CONFIG } from '../config/worldConfig';
import type { GameBridge, Point } from '../../network/types';
import { colorToSlot } from './islandQuestState';
import { ISLAND_QUEST, KEY_COLOR_LABELS } from './islandQuestConfig';
import { slotPhaseLabel } from './islandQuestState';
import type { IslandQuestState } from './islandQuestTypes';
import { IslandQuestWorld } from './IslandQuestWorld';
import type { PlayerAvatar } from '../entities/Player';
import type { MovementSystem } from '../systems/MovementSystem';

export interface QuestUiHost {
  setActionAtWorld(worldX: number, worldY: number, label: string | null, onClick: (() => void) | null): void;
  setHintAtWorld(worldX: number, worldY: number, text: string | null): void;
  clearWorldUi(): void;
  openLegend(onOpen: () => void, onClose: () => void): void;
  notify(text: string, kind?: 'info' | 'success' | 'warn'): void;
  setPortalBanner(visible: boolean, text?: string): void;
  onAllKeysDelivered(): void;
  onLocationReached(): void;
}

interface InteractCandidate {
  dist: number;
  worldX: number;
  worldY: number;
  label: string;
  run: () => void;
}

export class IslandQuestController {
  private readonly world: IslandQuestWorld;
  private state: IslandQuestState;
  private readonly unsubscribe: Array<() => void> = [];
  private modalBlocks = false;
  private lastDoorOpen = false;

  constructor(
    private readonly scene: Phaser.Scene,
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
    this.ui.clearWorldUi();
  }

  tick(pos: Point): void {
    if (this.modalBlocks || this.state.locationId !== 1) {
      this.ui.clearWorldUi();
      return;
    }

    const slot = colorToSlot(this.bridge.self.color);
    const portal = ISLAND_QUEST.messagePortal;
    const portalRadius = WORLD_CONFIG.portal.collisionRadius + 42;
    const door = ISLAND_QUEST.door;

    const candidates: InteractCandidate[] = [];

    const distPortal = Math.hypot(pos.x - portal.x, pos.y - portal.y);
    if (distPortal <= portalRadius) {
      candidates.push({
        dist: distPortal,
        worldX: portal.x,
        worldY: portal.y,
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
      });
    }

    if (this.state.slots[slot] === 'map' && slot < this.state.activeSlots) {
      const kp = this.state.keyPositions[slot];
      const dKey = Math.hypot(pos.x - kp.x, pos.y - kp.y);
      if (dKey <= ISLAND_QUEST.keyPickupRadius) {
        candidates.push({
          dist: dKey,
          worldX: kp.x,
          worldY: kp.y,
          label: 'Поднять ключ',
          run: () => this.pickKey(slot),
        });
      }
    }

    const distDoor = Math.hypot(pos.x - door.x, pos.y - door.y);
    if (distDoor <= door.interactRadius) {
      if (!this.state.doorOpen) {
        if (this.state.slots[slot] === 'held') {
          candidates.push({
            dist: distDoor,
            worldX: door.x,
            worldY: door.y,
            label: 'Вставить ключ',
            run: () => this.insertKey(slot),
          });
        } else {
          const lines = [
            'Древняя дверь закрыта. Кажется, ей нужны ключи. Каждый из вас должен найти свой',
          ];
          for (let i = 0; i < this.state.activeSlots; i += 1) {
            lines.push(slotPhaseLabel(KEY_COLOR_LABELS[i], this.state.slots[i]));
          }
          this.ui.setHintAtWorld(door.x, door.y, lines.join('\n'));
        }
      } else if (!this.state.portalReady[this.bridge.self.id]) {
        candidates.push({
          dist: distDoor,
          worldX: door.x,
          worldY: door.y,
          label: 'Открыть',
          run: () => {
            this.bridge.questAcknowledgePortal();
            this.ui.notify('Вы готовы к переходу. Ждём остальных…', 'info');
          },
        });
        this.ui.setPortalBanner(true, 'Портал открыт. Впереди вас ждёт новый мир');
      }
    } else if (!this.state.doorOpen) {
      this.ui.setPortalBanner(false);
    }

    candidates.sort((a, b) => a.dist - b.dist);
    const best = candidates[0] ?? null;

    if (best) {
      this.ui.setActionAtWorld(best.worldX, best.worldY, best.label, best.run);
    } else {
      this.ui.setActionAtWorld(0, 0, null, null);
      if (distDoor > door.interactRadius) this.ui.setHintAtWorld(0, 0, null);
    }

    if (this.movement.consumeInteractPress() && best) {
      best.run();
    }
  }

  getScene(): Phaser.Scene {
    return this.scene;
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
      this.ui.clearWorldUi();
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
      const s = colorToSlot(player.color);
      const phase = this.state.slots[s];
      avatar.setKeyFound(phase === 'held' || phase === 'inserted');
    };

    mark(this.getLocal());
    for (const av of this.getRemotes()) mark(av);
  }
}