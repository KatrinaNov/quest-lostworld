import { MAZE_CONFIG } from '../config/mazeConfig';
import { slideAlongMazeWalls } from './mazeCollision';
import { MAZE_HAZARDS, MAZE_SCALE, MAZE_WALLS, mazePoint, type MazeRect } from './mazeLayout';

export interface MazeCorridorHazard {
  kind: 'skeleton' | 'bush';
  point: ReturnType<typeof mazePoint>;
  across: 'x' | 'y';
  area: MazeRect;
}

function corridorHazard(kind: MazeCorridorHazard['kind'], x: number, y: number): MazeCorridorHazard {
  const point = mazePoint(x, y);
  const { minX, minY, maxX, maxY } = MAZE_CONFIG.bounds;
  // Sweep at the hazard's center to find the first solid boundary in each direction.
  const left = slideAlongMazeWalls(point, { x: minX, y: point.y }, MAZE_WALLS, 0).x;
  const right = slideAlongMazeWalls(point, { x: maxX, y: point.y }, MAZE_WALLS, 0).x;
  const top = slideAlongMazeWalls(point, { x: point.x, y: minY }, MAZE_WALLS, 0).y;
  const bottom = slideAlongMazeWalls(point, { x: point.x, y: maxY }, MAZE_WALLS, 0).y;
  const halfDepth = 15;
  return right - left < bottom - top
    ? { kind, point, across: 'x', area: { left, right, top: point.y - halfDepth, bottom: point.y + halfDepth } }
    : { kind, point, across: 'y', area: { left: point.x - halfDepth, right: point.x + halfDepth, top, bottom } };
}

export const MAZE_CORRIDOR_HAZARDS = [
  ...MAZE_HAZARDS.skeletons.map(([x, y]) => corridorHazard('skeleton', x, y)),
  ...MAZE_HAZARDS.bushes.map(([x, y]) => corridorHazard('bush', x, y)),
];

const pool = MAZE_HAZARDS.pool;
const center = mazePoint(pool.x, pool.y);
const halfPoolWidth = pool.width * MAZE_SCALE / 2 - 4;
const halfPoolHeight = pool.height * MAZE_SCALE / 2 - 4;
export const MAZE_POOL_AREA: MazeRect = {
  left: center.x - halfPoolWidth,
  right: center.x + halfPoolWidth,
  top: center.y - halfPoolHeight,
  bottom: center.y + halfPoolHeight,
};

export function mazeHazardHits(area: MazeRect, x: number, y: number, radius: number): boolean {
  const dx = Math.max(0, area.left - x, x - area.right);
  const dy = Math.max(0, area.top - y, y - area.bottom);
  return dx * dx + dy * dy < radius * radius;
}
