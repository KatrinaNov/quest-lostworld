import Phaser from 'phaser';
import { APP_CONFIG } from '../../config/appConfig';
import { PALETTE } from '../config/worldConfig';
import { TEXTURES } from '../scenes/PreloadScene';
import { ISLAND_QUEST } from './islandQuestConfig';
import type { IslandQuestState } from './islandQuestTypes';

/** Визуальные объекты квеста острова (не перестраивает лес). */
export class IslandQuestWorld {
  private readonly scene: Phaser.Scene;
  private readonly keys: Phaser.GameObjects.Image[] = [];
  private readonly slotLights: Phaser.GameObjects.Arc[] = [];
  private readonly doorGlow: Phaser.GameObjects.Image;
  private readonly portalLight: Phaser.GameObjects.Image;
  private doorOpenVisual = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { ancientStone, door } = ISLAND_QUEST;

    const stoneGlow = scene.add
      .image(ancientStone.x, ancientStone.y - 50, TEXTURES.glow)
      .setScale(1.2)
      .setTint(PALETTE.glowCyan)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.35)
      .setDepth(ancientStone.y - 2);
    scene.tweens.add({
      targets: stoneGlow,
      alpha: { from: 0.25, to: 0.5 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    scene.add
      .image(ancientStone.x, ancientStone.y, TEXTURES.runeStone)
      .setOrigin(0.5, 0.85)
      .setScale(1.65)
      .setDepth(ancientStone.y);
    scene.add
      .image(door.x, door.y - 20, TEXTURES.ancientDoor)
      .setOrigin(0.5, 0.92)
      .setScale(1.15)
      .setDepth(door.y);

    this.doorGlow = scene.add
      .image(door.x, door.y - 30, TEXTURES.glow)
      .setScale(2.4)
      .setTint(PALETTE.glowViolet)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setDepth(door.y - 1);

    this.portalLight = scene.add
      .image(door.x, door.y - 50, TEXTURES.portalCore)
      .setScale(0.35)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setDepth(door.y + 1);

    for (let i = 0; i < 4; i += 1) {
      const light = scene.add.circle(door.x - 54 + i * 36, door.y - 62, 9, APP_CONFIG.playerColors[i], 0.15);
      light.setStrokeStyle(2, APP_CONFIG.playerColors[i], 0.4);
      light.setDepth(door.y + 2);
      light.setVisible(false);
      this.slotLights.push(light);
    }

    for (let i = 0; i < ISLAND_QUEST.keys.length; i += 1) {
      const p = ISLAND_QUEST.keys[i];
      const key = scene.add
        .image(p.x, p.y, TEXTURES.questKey)
        .setTint(APP_CONFIG.playerColors[i])
        .setOrigin(0.5, 0.9)
        .setDepth(p.y);
      scene.tweens.add({
        targets: key,
        y: p.y - 6,
        duration: 1400 + i * 120,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
      this.keys.push(key);
    }

  }

  applyState(state: IslandQuestState): void {
    for (let i = 0; i < 4; i += 1) {
      const active = i < state.activeSlots;
      const key = this.keys[i];
      const onMap = active && state.slots[i] === 'map';
      key.setVisible(onMap);

      const slot = this.slotLights[i];
      slot.setVisible(active);
      if (!active) continue;

      const color = APP_CONFIG.playerColors[i];
      if (state.slots[i] === 'inserted') {
        slot.setFillStyle(color, 1);
        slot.setStrokeStyle(0, color, 0);
      } else if (state.slots[i] === 'held') {
        slot.setFillStyle(color, 0.55);
        slot.setStrokeStyle(2, color, 0.9);
      } else {
        slot.setFillStyle(0x1a2420, 0.7);
        slot.setStrokeStyle(2, color, 0.45);
      }
    }

    if (state.doorOpen && !this.doorOpenVisual) {
      this.doorOpenVisual = true;
      this.scene.tweens.add({
        targets: [this.doorGlow, this.portalLight],
        alpha: { from: 0, to: 1 },
        duration: 900,
        ease: 'Sine.out',
      });
      this.scene.tweens.add({
        targets: this.portalLight,
        scale: { from: 0.35, to: 0.5 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
      for (const slot of this.slotLights) {
        if (slot.visible) {
          this.scene.tweens.add({
            targets: slot,
            scale: { from: 1, to: 1.25 },
            duration: 400,
            yoyo: true,
            repeat: 2,
          });
        }
      }
    }

    if (!state.doorOpen) {
      this.doorOpenVisual = false;
      this.doorGlow.setAlpha(0);
      this.portalLight.setAlpha(0);
    }
  }

  getDoorPosition() {
    return ISLAND_QUEST.door;
  }

  getStonePosition() {
    return ISLAND_QUEST.ancientStone;
  }

  getKeyPosition(slot: number) {
    return ISLAND_QUEST.keys[slot];
  }
}