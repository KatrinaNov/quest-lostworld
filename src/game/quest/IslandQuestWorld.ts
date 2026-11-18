import Phaser from 'phaser';
import { PALETTE } from '../config/worldConfig';
import { QUEST_KEY_FRAME, QUEST_KEY_TEXTURE_BY_SLOT, TEXTURES } from '../scenes/PreloadScene';
import { ISLAND_DOOR_ART } from '../world/islandDoorArt';
import { ISLAND_QUEST } from './islandQuestConfig';
import type { IslandQuestState } from './islandQuestTypes';

/** Визуальные объекты квеста острова (только ключи и дверь; лес не трогаем). */
export class IslandQuestWorld {
  private readonly scene: Phaser.Scene;
  private readonly keys: Phaser.GameObjects.Image[] = [];
  private readonly keyGlows: Phaser.GameObjects.Image[] = [];
  private readonly doorGlow: Phaser.GameObjects.Image;
  private readonly portalLight: Phaser.GameObjects.Image;
  private readonly doorClosed: Phaser.GameObjects.Image;
  private readonly doorOpen: Phaser.GameObjects.Image;
  private doorOpenVisual = false;
  private floatStarted = false;
  private readonly keyScale = ISLAND_QUEST.keyScale;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { door } = ISLAND_QUEST;
    const doorDepth = Math.round(door.y) - 2;

    this.doorClosed = scene.add
      .image(door.x, door.y, TEXTURES.ancientDoorClosed)
      .setOrigin(0.5, 0.985)
      .setScale(1 / ISLAND_DOOR_ART.resolution)
      .setDepth(doorDepth);

    this.doorOpen = scene.add
      .image(door.x, door.y, TEXTURES.ancientDoorOpen)
      .setOrigin(0.5, 0.985)
      .setScale(1 / ISLAND_DOOR_ART.resolution)
      .setDepth(doorDepth + 0.1)
      .setVisible(false);

    this.doorGlow = scene.add
      .image(door.x, door.y - 56, TEXTURES.glow)
      .setScale(0.96)
      .setTint(PALETTE.glowCyan)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setDepth(doorDepth - 0.5);

    this.portalLight = scene.add
      .image(door.x, door.y - 57, TEXTURES.portalCore)
      .setScale(0.22)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setDepth(doorDepth + 0.2);

    for (let i = 0; i < 4; i += 1) {
      const glow = scene.add
        .image(0, 0, TEXTURES.glow)
        .setScale(0.85 * this.keyScale * 4)
        .setTint(0xffffff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.32)
        .setDepth(1)
        .setVisible(false);
      const key = scene.add
        .image(0, 0, QUEST_KEY_TEXTURE_BY_SLOT[i], QUEST_KEY_FRAME)
        .setOrigin(0.5, 0.92)
        .setScale(this.keyScale * 2)
        .setDepth(2)
        .setVisible(false);
      this.keyGlows.push(glow);
      this.keys.push(key);
    }
  }

  applyState(state: IslandQuestState): void {
    const showKeys = state.adventureStarted;
    if (showKeys && !this.floatStarted) {
      this.floatStarted = true;
      for (let i = 0; i < this.keys.length; i += 1) {
        const key = this.keys[i];
        const glow = this.keyGlows[i];
        this.scene.tweens.add({
          targets: [key, glow],
          y: `+=${4 + i}`,
          duration: 1500 + i * 140,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut',
        });
        this.scene.tweens.add({
          targets: key,
          angle: { from: -4, to: 4 },
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
      glow.setPosition(p.x, p.y - 22 * this.keyScale * 4);
      const depth = Math.round(p.y);
      key.setDepth(depth);
      glow.setDepth(depth - 1);

      const active = i < state.activeSlots;
      const onMap = showKeys && active && state.slots[i] === 'map';
      key.setVisible(onMap);
      glow.setVisible(onMap);
    }

    if (state.doorOpen) {
      this.doorClosed.setVisible(false);
      this.doorOpen.setVisible(true);
      if (!this.doorOpenVisual) {
        this.doorOpenVisual = true;
        this.scene.tweens.add({
          targets: [this.doorGlow, this.portalLight],
          alpha: { from: 0, to: 0.24 },
          duration: 900,
          ease: 'Sine.out',
        });
        this.scene.tweens.add({
          targets: this.portalLight,
          scale: { from: 0.22, to: 0.30 },
          duration: 1400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut',
        });
      }
    } else {
      this.doorClosed.setVisible(true);
      this.doorOpen.setVisible(false);
      if (this.doorOpenVisual) this.scene.tweens.killTweensOf([this.doorGlow, this.portalLight]);
      this.doorOpenVisual = false;
      this.doorGlow.setAlpha(0);
      this.portalLight.setAlpha(0);
    }
  }
}
