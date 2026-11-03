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

  // Размер холста всегда равен размеру контейнера. Меняется он при повороте, появлении/скрытии
  // адресной строки и входе в полноэкранный режим. Сцена и сеть при этом не затрагиваются:
  // обновляется только размер холста и масштаб камеры (см. WorldScene.applyZoom).
  let frame = 0;
  let destroyed = false;
  const applySize = (): void => {
    frame = 0;
    if (destroyed) return;
    const { w, h } = size();
    if (game.scale.width !== w || game.scale.height !== h) game.scale.resize(w, h);
  };
  const resize = (): void => {
    if (frame === 0) frame = requestAnimationFrame(applySize);
  };
  // После поворота экрана браузеры иногда сообщают итоговый размер с задержкой.
  const resizeSoonAfterRotation = (): void => {
    resize();
    window.setTimeout(resize, 350);
  };

  const observer = new ResizeObserver(resize);
  observer.observe(parent);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resizeSoonAfterRotation);
  window.visualViewport?.addEventListener('resize', resize);
  document.addEventListener('fullscreenchange', resize);

  return {
    destroy: () => {
      destroyed = true;
      if (frame !== 0) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resizeSoonAfterRotation);
      window.visualViewport?.removeEventListener('resize', resize);
      document.removeEventListener('fullscreenchange', resize);
      game.destroy(true);
    },
  };
}
