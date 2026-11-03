import Phaser from 'phaser';
import type { GameBridge } from '../network/types';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { REGISTRY_KEYS, WorldScene } from './scenes/WorldScene';
import type { VirtualInput } from './systems/MovementSystem';

export interface GameHandle {
  destroy(): void;
}

/** Ограничиваем плотность пикселей: чёткая картинка на телефонах без лишней нагрузки на GPU. */
function pixelRatio(): number {
  return Math.min(window.devicePixelRatio || 1, 2);
}

/**
 * Создаёт игру Phaser внутри parent. Размер холста = размер контейнера × pixelRatio,
 * CSS растягивает его на весь контейнер.
 */
export function createGame(parent: HTMLElement, bridge: GameBridge, virtualInput: VirtualInput | null): GameHandle {
  const size = (): { w: number; h: number } => {
    const ratio = pixelRatio();
    return {
      w: Math.max(1, Math.round(parent.clientWidth * ratio)),
      h: Math.max(1, Math.round(parent.clientHeight * ratio)),
    };
  };
  const initial = size();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: initial.w,
    height: initial.h,
    backgroundColor: '#0b1511',
    scale: { mode: Phaser.Scale.NONE },
    scene: [BootScene, PreloadScene, WorldScene],
    banner: false,
    disableContextMenu: true,
    render: { antialias: true, roundPixels: true },
    input: { keyboard: true, mouse: false, touch: false, gamepad: false },
    callbacks: {
      preBoot: (g) => {
        g.registry.set(REGISTRY_KEYS.bridge, bridge);
        g.registry.set(REGISTRY_KEYS.virtualInput, virtualInput);
      },
    },
  });

  const resize = (): void => {
    const { w, h } = size();
    if (game.scale.width !== w || game.scale.height !== h) game.scale.resize(w, h);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(parent);
  window.addEventListener('orientationchange', resize);

  return {
    destroy: () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', resize);
      game.destroy(true);
    },
  };
}
