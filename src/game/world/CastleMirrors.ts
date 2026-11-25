import type Phaser from 'phaser';
import type { Player } from '../../network/types';
import { CASTLE_BOUNDS, CASTLE_MIRRORS, CASTLE_SEALS } from '../config/castleConfig';
import { CASTLE_MIRROR_SEAL, CASTLE_MIRROR_STEPS } from '../quest/castleQuestTypes';
import type { Obstacle } from '../config/worldConfig';

const seal = CASTLE_SEALS[CASTLE_MIRROR_SEAL];
const receiver = { x: seal.x, y: seal.y - 24 };
export const CASTLE_MIRROR_REACH = 89;

export function buildCastleMirrors(scene: Phaser.Scene, obstacles: Obstacle[]) {
  const mirrors = CASTLE_MIRRORS.map(({ x, y, restStep }) => {
    const base = scene.add.graphics().setDepth(y + 2).setVisible(false);
    base.fillStyle(0x321e2e, 0.7).fillEllipse(x, y + 13, 77, 26);
    base.fillStyle(0x846050).fillEllipse(x, y + 9, 63, 21);
    base.fillStyle(0xc09a64).fillEllipse(x, y + 5, 58, 19);
    base.lineStyle(1, 0xffd890, 0.8).strokeEllipse(x, y + 5, 51, 15);
    base.fillStyle(0x71544e).fillRect(x - 6, y - 18, 12, 26);
    base.fillStyle(0xb88c62).fillRect(x - 4, y - 18, 3, 24);
    const face = scene.add.graphics({ x, y: y - 15 }).setDepth(y + 3).setVisible(false);
    face.fillStyle(0x461e2b).fillEllipse(0, 1, 26, 63);
    face.fillStyle(0xad7747).fillEllipse(0, -1, 24, 60);
    face.fillStyle(0xf4c77a).fillEllipse(0, -2, 22, 56);
    face.fillStyle(0x406679).fillEllipse(0, -2, 16, 49);
    face.fillStyle(0x82c0c6).fillEllipse(-2, -3, 10, 40);
    face.fillStyle(0xd7f0de, 0.9).fillEllipse(-3, -10, 3, 19);
    const beam = scene.add.graphics().setDepth(8);
    const label = scene.add.text(x, y - 47, '', {
      fontFamily: 'Georgia, serif', fontSize: '15px', stroke: '#302637', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(y + 4).setVisible(false);
    const obstacle = { x, y, r: 21 };
    const angleToSeal = Math.atan2(receiver.y - (y - 15), receiver.x - x);
    let previous: number | null | undefined;
    return {
      obstacle,
      configure(owner: Player | undefined, enabled: boolean, own: boolean, slot: number): void {
        base.setVisible(enabled);
        face.setVisible(enabled);
        label.setVisible(enabled).setText(own ? 'Ваше зеркало' : owner?.name.slice(0, 18) || `Зеркало ${slot + 1}`);
        label.setColor(own ? '#ffe5a5' : '#eed6ba');
        const index = obstacles.indexOf(obstacle);
        if (enabled && index < 0) obstacles.push(obstacle);
        if (!enabled && index >= 0) obstacles.splice(index, 1);
        if (!enabled) this.aim(null);
      },
      aim(step: number | null): void {
        if (step === previous) return;
        previous = step;
        const angle = angleToSeal + (step ?? restStep) * (2 * Math.PI / CASTLE_MIRROR_STEPS);
        face.setRotation(angle);
        beam.clear();
        if (step === null) return;
        const startY = y - 15;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const boundaryX = (dx > 0 ? CASTLE_BOUNDS.maxX : CASTLE_BOUNDS.minX) - x;
        const boundaryY = (dy > 0 ? CASTLE_BOUNDS.maxY : CASTLE_BOUNDS.minY) - startY;
        const length = Math.min(315, boundaryX / dx, boundaryY / dy);
        const hit = step === 0;
        const endX = hit ? receiver.x : x + dx * length;
        const endY = hit ? receiver.y : startY + dy * length;
        beam.lineStyle(hit ? 15 : 10, hit ? 0xffc56a : 0x83d2ef, 0.28).lineBetween(x, startY, endX, endY);
        beam.lineStyle(4, hit ? 0xffdd93 : 0xa3e5f0, 0.88).lineBetween(x, startY, endX, endY);
        beam.lineStyle(1.5, 0xfff8d6, 0.92).lineBetween(x, startY, endX, endY);
        beam.fillStyle(hit ? 0xffebaf : 0xb4edfa, 0.8).fillCircle(x, startY, 5).fillCircle(endX, endY, hit ? 7 : 3);
      },
    };
  });
  return mirrors;
}
