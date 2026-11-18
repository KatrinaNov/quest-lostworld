import Phaser from 'phaser';
import type { QuestUiHost } from './quest/IslandQuestController';
import type { QuestHud } from '../ui/QuestHud';
import type { JungleQuestHud } from '../ui/JungleQuestHud';
import type { TempleQuestHud } from '../ui/TempleQuestHud';
import type { GameBridge } from '../network/types';
import { BootScene } from './scenes/BootScene';
import { MinecraftScene } from './scenes/MinecraftScene';
import { TempleScene } from './scenes/TempleScene';
import { LabyrinthScene } from './scenes/LabyrinthScene';
import { PreloadScene } from './scenes/PreloadScene';
import { REGISTRY_KEYS, WorldScene } from './scenes/WorldScene';
import type { VirtualInput } from './systems/MovementSystem';

export interface GameHandle {
  destroy(): void;
}

/**
 * Мобильный Canvas обходится без WebGL-контекста, который браузер может потерять
 * при сворачивании страницы или нехватке видеопамяти.
 */
export function createGame(
  parent: HTMLElement,
  bridge: GameBridge,
  virtualInput: VirtualInput | null,
  questUi: QuestUiHost | null = null,
  questHud: QuestHud | null = null,
  jungleHud: JungleQuestHud | null = null,
  templeHud: TempleQuestHud | null = null,
  notifications: { show: (text: string, kind?: 'info' | 'success' | 'warn') => void } | null = null,
): GameHandle {
  const mobile = virtualInput !== null;
  const size = (): { w: number; h: number } => {
    const ratio = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 2);
    return {
      w: Math.max(1, Math.round(parent.clientWidth * ratio)),
      h: Math.max(1, Math.round(parent.clientHeight * ratio)),
    };
  };
  const initial = size();

  const game = new Phaser.Game({
    type: mobile ? Phaser.CANVAS : Phaser.AUTO,
    parent,
    width: initial.w,
    height: initial.h,
    backgroundColor: '#0b1511',
    scale: { mode: Phaser.Scale.NONE },
    scene: [BootScene, PreloadScene, WorldScene, MinecraftScene, TempleScene, LabyrinthScene],
    banner: false,
    disableContextMenu: true,
    render: { antialias: true, roundPixels: true },
    input: { keyboard: true, mouse: false, touch: false, gamepad: false },
    // Нужна только TempleScene; остальные сцены по-прежнему используют собственную top-down коллизию.
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    callbacks: {
      preBoot: (g) => {
        g.registry.set(REGISTRY_KEYS.bridge, bridge);
        g.registry.set(REGISTRY_KEYS.virtualInput, virtualInput);
        g.registry.set(REGISTRY_KEYS.questUi, questUi);
        g.registry.set(REGISTRY_KEYS.questHud, questHud);
        g.registry.set(REGISTRY_KEYS.jungleHud, jungleHud);
        g.registry.set(REGISTRY_KEYS.templeHud, templeHud);
        g.registry.set(REGISTRY_KEYS.notifications, notifications);
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
      // Phaser удаляет холст на следующем кадре, который может не наступить после сбоя.
      game.canvas?.remove();
      game.destroy(true);
    },
  };
}
