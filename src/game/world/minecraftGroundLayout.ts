import { MINECRAFT_CONFIG, MINECRAFT_GROUND } from '../config/minecraftWorldConfig';
import { MINECRAFT_PATH_WIDTH } from './minecraftCobblePaths';

const B = MINECRAFT_CONFIG.block;

export type GroundTileKind =
  | 'grass'
  | 'sand'
  | 'water'
  | 'path'
  | 'stone'
  | 'shoreGrassN'
  | 'shoreGrassS'
  | 'shoreGrassE'
  | 'shoreGrassW'
  | 'shoreSandN'
  | 'shoreSandS'
  | 'shoreSandE'
  | 'shoreSandW';

export function tileCountX(): number {
  return Math.ceil(MINECRAFT_CONFIG.width / B);
}

export function tileCountY(): number {
  return Math.ceil(MINECRAFT_CONFIG.height / B);
}

function inSand(tx: number, ty: number): boolean {
  const { originX, originY, tilesW, tilesH } = MINECRAFT_GROUND.sand;
  const t0x = Math.floor(originX / B);
  const t0y = Math.floor(originY / B);
  return tx >= t0x && tx < t0x + tilesW && ty >= t0y && ty < t0y + tilesH;
}

function inWater(tx: number, ty: number): boolean {
  const { originX, originY, tilesW, tilesH } = MINECRAFT_GROUND.water;
  const t0x = Math.floor(originX / B);
  const t0y = Math.floor(originY / B);
  return tx >= t0x && tx < t0x + tilesW && ty >= t0y && ty < t0y + tilesH;
}

function nearStone(cx: number, cy: number): boolean {
  return MINECRAFT_GROUND.stonePatches.some(([x, y]) => Math.hypot(cx - x, cy - y) < B * 0.95);
}

function nearPath(cx: number, cy: number): boolean {
  const pts = MINECRAFT_GROUND.pathPoints;
  const half = MINECRAFT_PATH_WIDTH / 2;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    if (distPointToSegment(cx, cy, a.x, a.y, b.x, b.y) <= half) return true;
  }
  return false;
}

function distPointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.0001) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  return Math.hypot(px - qx, py - qy);
}

function shoreForSand(tx: number, ty: number): GroundTileKind | null {
  if (!inSand(tx, ty) || inWater(tx, ty)) return null;
  if (inWater(tx, ty - 1)) return 'shoreSandN';
  if (inWater(tx, ty + 1)) return 'shoreSandS';
  if (inWater(tx - 1, ty)) return 'shoreSandW';
  if (inWater(tx + 1, ty)) return 'shoreSandE';
  return null;
}

function shoreForGrass(tx: number, ty: number): GroundTileKind | null {
  if (inWater(tx, ty) || inSand(tx, ty) || inPath(tx, ty) || inStone(tx, ty)) return null;
  if (inWater(tx, ty - 1)) return 'shoreGrassN';
  if (inWater(tx, ty + 1)) return 'shoreGrassS';
  if (inWater(tx - 1, ty)) return 'shoreGrassW';
  if (inWater(tx + 1, ty)) return 'shoreGrassE';
  return null;
}

function inPath(tx: number, ty: number): boolean {
  const cx = tx * B + B / 2;
  const cy = ty * B + B / 2;
  return nearPath(cx, cy);
}

function inStone(tx: number, ty: number): boolean {
  const cx = tx * B + B / 2;
  const cy = ty * B + B / 2;
  return nearStone(cx, cy);
}

/** Определяет вид тайла; геометрия зон совпадает с исходной картой. */
export function groundTileKind(tx: number, ty: number): GroundTileKind {
  if (inWater(tx, ty)) return 'water';

  const cx = tx * B + B / 2;
  const cy = ty * B + B / 2;

  if (nearPath(cx, cy)) return 'path';
  if (inSand(tx, ty)) {
    const shore = shoreForSand(tx, ty);
    return shore ?? 'sand';
  }
  if (nearStone(cx, cy)) return 'stone';

  const grassShore = shoreForGrass(tx, ty);
  if (grassShore) return grassShore;

  return 'grass';
}

/** Координаты центра тайла воды — для коллизий (без изменений). */
export function waterCollisionCenters(): Array<{ x: number; y: number }> {
  const { originX, originY, tilesW, tilesH } = MINECRAFT_GROUND.water;
  const out: Array<{ x: number; y: number }> = [];
  const t0x = Math.floor(originX / B);
  const t0y = Math.floor(originY / B);
  for (let dy = 0; dy < tilesH; dy += 1) {
    for (let dx = 0; dx < tilesW; dx += 1) {
      out.push({ x: t0x * B + dx * B + B / 2, y: t0y * B + dy * B + B / 2 });
    }
  }
  return out;
}