import Phaser from 'phaser';

export const SCENE_KEYS = {
  boot: 'BootScene',
  preload: 'PreloadScene',
  world: 'WorldScene',
} as const;

/** Первичная настройка и переход к загрузке ресурсов. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b1511');
    this.scene.start(SCENE_KEYS.preload);
  }
}
