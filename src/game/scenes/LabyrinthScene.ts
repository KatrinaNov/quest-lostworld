import Phaser from 'phaser';
import { SCENE_KEYS } from './BootScene';

/** Безопасная общая точка перехода. Сам лабиринт будет добавлен отдельной задачей. */
export class LabyrinthScene extends Phaser.Scene {
  constructor() { super(SCENE_KEYS.labyrinth); }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor('#10171b');
    this.add.rectangle(width / 2, height / 2, width, height, 0x10171b).setScrollFactor(0);
    this.add.text(width / 2, height / 2 - 22, 'ЛАБИРИНТ', {
      fontFamily: 'monospace', fontSize: '32px', color: '#ffe06b', stroke: '#11151e', strokeThickness: 5,
    }).setOrigin(0.5);
    this.add.text(width / 2, height / 2 + 24, 'Карта понадобится в следующем испытании', {
      fontFamily: 'monospace', fontSize: '15px', color: '#d5dde2', align: 'center',
    }).setOrigin(0.5);
  }
}
