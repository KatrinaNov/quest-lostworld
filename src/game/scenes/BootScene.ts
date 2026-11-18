import Phaser from 'phaser';
import type { GameBridge } from '../../network/types';

export const SCENE_KEYS = {
  boot: 'BootScene',
  preload: 'PreloadScene',
  world: 'WorldScene',
  minecraft: 'MinecraftScene',
  temple: 'TempleScene',
  labyrinth: 'LabyrinthScene',
} as const;

/** Первичная настройка и переход к загрузке ресурсов. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b1511');
    const { roomCode } = this.registry.get('bridge') as GameBridge;
    if (sessionStorage.getItem('maze-room') === roomCode) this.scene.start(SCENE_KEYS.labyrinth);
    else if (sessionStorage.getItem('temple-room') === roomCode) this.scene.start(SCENE_KEYS.temple);
    else this.scene.start(SCENE_KEYS.preload);
  }
}
