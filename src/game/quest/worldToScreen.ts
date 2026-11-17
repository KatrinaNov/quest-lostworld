import type Phaser from 'phaser';

export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

/** Перевод мировых координат в CSS-пиксели окна с учётом камеры и масштаба холста. */
export function worldToScreen(scene: Phaser.Scene, worldX: number, worldY: number): ScreenPoint {
  const cam = scene.cameras.main;
  const canvas = scene.game.canvas;
  const rect = canvas.getBoundingClientRect();
  const view = cam.worldView;

  const margin = 48;
  if (
    worldX < view.x - margin ||
    worldX > view.right + margin ||
    worldY < view.y - margin ||
    worldY > view.bottom + margin
  ) {
    return { x: 0, y: 0, visible: false };
  }

  const x = ((worldX - view.x) / view.width) * rect.width + rect.left;
  const y = ((worldY - view.y) / view.height) * rect.height + rect.top;
  return { x, y, visible: true };
}

export function clampToViewport(
  x: number,
  y: number,
  width: number,
  height: number,
  padding = 10,
): { x: number; y: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: Math.min(vw - width - padding, Math.max(padding, x)),
    y: Math.min(vh - height - padding, Math.max(padding, y)),
  };
}