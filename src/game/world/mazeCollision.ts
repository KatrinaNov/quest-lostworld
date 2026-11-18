import type { Point } from '../../network/types';
import type { MazeRect } from './mazeLayout';

/** Sweep the player's footprint through the same rectangles used to draw the walls. */
export function slideAlongMazeWalls(from: Point, target: Point, walls: readonly MazeRect[], radius: number): Point {
  let { x, y } = target;

  for (const wall of walls) {
    if (from.y <= wall.top - radius || from.y >= wall.bottom + radius) continue;
    const left = wall.left - radius;
    const right = wall.right + radius;
    if (from.x <= left && x > left) x = left;
    if (from.x >= right && x < right) x = right;
  }

  for (const wall of walls) {
    if (x <= wall.left - radius || x >= wall.right + radius) continue;
    const top = wall.top - radius;
    const bottom = wall.bottom + radius;
    if (from.y <= top && y > top) y = top;
    if (from.y >= bottom && y < bottom) y = bottom;
  }

  return { x, y };
}
