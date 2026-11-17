import type { Point } from '../../network/types';
import { createRng, distToPaths, WORLD_BOUNDS, WORLD_CONFIG } from '../config/worldConfig';
import { ISLAND_QUEST } from './islandQuestConfig';

export function hashRoomCode(roomCode: string): number {
  let h = 2166136261;
  for (let i = 0; i < roomCode.length; i += 1) {
    h ^= roomCode.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const KEY_SPREAD_MIN = 260;
const PLAZA_CLEAR = WORLD_CONFIG.decor.clearancePlaza + 40;

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nearEdge(p: Point, band: number): boolean {
  const { minX, maxX, minY, maxY } = WORLD_BOUNDS;
  const dEdge = Math.min(p.x - minX, maxX - p.x, p.y - minY, maxY - p.y);
  return dEdge <= band;
}

function isValidSpot(p: Point, existing: Point[]): boolean {
  const { minX, maxX, minY, maxY } = WORLD_BOUNDS;
  const m = 90;
  if (p.x < minX + m || p.x > maxX - m || p.y < minY + m || p.y > maxY - m) return false;
  if (!nearEdge(p, 200)) return false;

  const plaza = WORLD_CONFIG.plaza;
  if (dist(p, plaza) < PLAZA_CLEAR) return false;
  if (dist(p, WORLD_CONFIG.portal) < 200) return false;
  if (dist(p, ISLAND_QUEST.door) < 520) return false;

  const center = { x: WORLD_CONFIG.width / 2, y: WORLD_CONFIG.height / 2 };
  if (dist(p, center) < 420) return false;

  if (distToPaths(p) < 48) return false;

  for (const o of existing) {
    if (dist(p, o) < KEY_SPREAD_MIN) return false;
  }
  return true;
}

function samplePoint(rng: () => number, side: number): Point {
  const { minX, maxX, minY, maxY } = WORLD_BOUNDS;
  const inset = 110 + rng() * 70;
  const spanX = maxX - minX - inset * 2;
  const spanY = maxY - minY - inset * 2;
  const t = rng();
  switch (side % 4) {
    case 0:
      return { x: minX + inset + t * spanX, y: minY + inset + rng() * 80 };
    case 1: {
      const y = minY + inset + t * spanY;
      const x = maxX - inset - rng() * 80;
      if (Math.abs(y - ISLAND_QUEST.door.y) < 220) return { x: maxX - inset - 200 - rng() * 120, y: y + (y < ISLAND_QUEST.door.y ? -180 : 180) };
      return { x, y };
    }
    case 2:
      return { x: minX + inset + t * spanX, y: maxY - inset - rng() * 80 };
    default:
      return { x: minX + inset + rng() * 80, y: minY + inset + t * spanY };
  }
}

/** Общие для комнаты координаты ключей (детерминированы кодом комнаты). */
export function generateKeyPositions(roomCode: string): [Point, Point, Point, Point] {
  const rng = createRng(hashRoomCode(roomCode));
  const sides = [0, 1, 2, 3];
  for (let i = sides.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [sides[i], sides[j]] = [sides[j], sides[i]];
  }

  const placed: Point[] = [];
  for (let slot = 0; slot < 4; slot += 1) {
    let point: Point | null = null;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = samplePoint(rng, sides[slot] + attempt);
      if (isValidSpot(candidate, placed)) {
        point = candidate;
        break;
      }
    }
    if (!point) {
      point = samplePoint(rng, sides[slot]);
    }
    placed.push(point);
  }
  return placed as [Point, Point, Point, Point];
}