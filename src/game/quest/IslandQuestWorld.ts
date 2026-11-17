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
  private readonly keyGlows: Phaser.GameObjects.Image[] = [];
  private readonly slotLights: Phaser.GameObjects.Arc[] = [];
  private readonly doorGlow: Phaser.GameObjects.Image;
  private readonly portalLight: Phaser.GameObjects.Image;
  private readonly doorSprite: Phaser.GameObjects.Image;
  private doorOpenVisual = false;
  private floatStarted = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { door } = ISLAND_QUEST;

    this.doorSprite = scene.add
      .image(door.x, door.y - 12, TEXTURES.ancientDoor)
      .setOrigin(0.5, 0.94)
      .setScale(1.32)
      .setDepth(door.y);

    this.doorGlow = scene.add
      .image(door.x, door.y - 40, TEXTURES.glow)
      .setScale(2.8)
      .setTint(PALETTE.glowViolet)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.12)
      .setDepth(door.y - 1);

    this.portalLight = scene.add
      .image(door.x, door.y - 92, TEXTURES.portalCore)
      .setScale(0.42)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setDepth(door.y + 1);

    for (let i = 0; i < 4; i += 1) {
      const light = scene.add.circle(door.x - 62 + i * 42, door.y - 76, 10, APP_CONFIG.playerColors[i], 0.15);
      light.setStrokeStyle(2, APP_CONFIG.playerColors[i], 0.45);
      light.setDepth(door.y + 2);
      light.setVisible(false);
      this.slotLights.push(light);
    }

    for (let i = 0; i < 4; i += 1) {
      const glow = scene.add
        .image(0, 0, TEXTURES.glow)
        .setScale(0.55)
        .setTint(APP_CONFIG.playerColors[i])
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.45)
        .setDepth(1);
      const key = scene.add
        .image(0, 0, TEXTURES.questKey)
        .setOrigin(0.5, 0.88)
        .setScale(1.05)
        .setDepth(2);
      this.keyGlows.push(glow);
      this.keys.push(key);
    }
  }

  applyState(state: IslandQuestState): void {
    if (!this.floatStarted) {
      this.floatStarted = true;
      for (let i = 0; i < this.keys.length; i += 1) {
        const key = this.keys[i];
        const glow = this.keyGlows[i];
        this.scene.tweens.add({
          targets: [key, glow],
          y: `+=${5 + i}`,
          duration: 1500 + i * 140,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut',
        });
        this.scene.tweens.add({
          targets: key,
          angle: { from: -5, to: 5 },
          duration: 2200 + i * 90,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut',
        });
      }
    }

    for (let i = 0; i < 4; i += 1) {
      const p = state.keyPositions[i];
      const key = this.keys[i];
      const glow = this.keyGlows[i];
      key.setPosition(p.x, p.y);
      key.setTint(APP_CONFIG.playerColors[i]);
      glow.setPosition(p.x, p.y - 18);
      glow.setTint(APP_CONFIG.playerColors[i]);
      const depth = p.y;
      key.setDepth(depth);
      glow.setDepth(depth - 1);

      const active = i < state.activeSlots;
      const onMap = active && state.slots[i] === 'map';
      key.setVisible(onMap);
      glow.setVisible(onMap);

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
        slot.setFillStyle(0x1a2420, 0.75);
        slot.setStrokeStyle(2, color, 0.45);
      }
    }

    if (state.doorOpen && !this.doorOpenVisual) {
      this.doorOpenVisual = true;
      this.scene.tweens.add({
        targets: [this.doorGlow, this.portalLight],
        alpha: { from: 0.15, to: 0.95 },
        duration: 900,
        ease: 'Sine.out',
      });
      this.scene.tweens.add({
        targets: this.doorSprite,
        scaleX: 1.32 * 1.04,
        scaleY: 1.32 * 0.98,
        duration: 600,
        yoyo: true,
        repeat: 1,
      });
      this.scene.tweens.add({
        targets: this.portalLight,
        scale: { from: 0.42, to: 0.58 },
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
      for (const slot of this.slotLights) {
        if (slot.visible) {
          this.scene.tweens.add({
            targets: slot,
            scale: { from: 1, to: 1.3 },
            duration: 420,
            yoyo: true,
            repeat: 2,
          });
        }
      }
    }

    if (!state.doorOpen) {
      this.doorOpenVisual = false;
      this.doorGlow.setAlpha(0.12);
      this.portalLight.setAlpha(0);
    }
  }
}