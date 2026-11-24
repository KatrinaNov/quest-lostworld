import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const { outputFiles } = await build({
  stdin: {
    contents: `
      export { MAZE_CONFIG, MAZE_LETTER_POINTS } from './src/game/config/mazeConfig.ts';
      export { MAZE_GLYPHS, MAZE_PHRASE, mazeLetterLimit } from './src/game/quest/mazeQuestTypes.ts';
      export * from './src/game/world/mazeLayout.ts';
      export { MAZE_CORRIDOR_HAZARDS, MAZE_POOL_AREA, mazeHazardHits } from './src/game/world/mazeHazards.ts';
      export { slideAlongMazeWalls } from './src/game/world/mazeCollision.ts';
    `,
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
  },
  format: 'esm',
  bundle: true,
  write: false,
});
const { MAZE_CONFIG, MAZE_LETTER_POINTS, MAZE_GLYPHS, MAZE_PHRASE, mazeLetterLimit, MAZE_WALLS,
  MAZE_CORRIDOR_HAZARDS, MAZE_POOL_AREA, mazeHazardHits, slideAlongMazeWalls } =
  await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`);

const { bounds, spawn, exit, checkpoints, player } = MAZE_CONFIG;
const radius = player.radius;
const hazardAreas = [...MAZE_CORRIDOR_HAZARDS.map(({ area }) => area), MAZE_POOL_AREA];
function isHazard(x, y, pad = 0) {
  return hazardAreas.some((area) => mazeHazardHits(area, x, y, radius + pad));
}

const cell = 4;
const columns = Math.floor((bounds.maxX - bounds.minX) / cell) + 1;
const rows = Math.floor((bounds.maxY - bounds.minY) / cell) + 1;
const index = ({ x, y }) => Math.round((x - bounds.minX) / cell) + Math.round((y - bounds.minY) / cell) * columns;
const point = (i) => ({ x: bounds.minX + i % columns * cell, y: bounds.minY + Math.floor(i / columns) * cell });
const walkable = new Uint8Array(columns * rows);
for (let i = 0; i < walkable.length; i += 1) {
  const { x, y } = point(i);
  const inWall = MAZE_WALLS.some(({ left, right, top, bottom }) =>
    x > left - radius && x < right + radius && y > top - radius && y < bottom + radius);
  walkable[i] = Number(!inWall && !isHazard(x, y, cell));
}

const start = index(spawn);
assert.equal(walkable[start], 1, 'Entrance lies inside a wall or hazard');
const visited = new Uint8Array(walkable.length);
const queue = [start];
visited[start] = 1;
for (let i = 0; i < queue.length; i += 1) {
  const position = queue[i];
  const x = position % columns;
  const y = Math.floor(position / columns);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    if (x + dx < 0 || x + dx >= columns || y + dy < 0 || y + dy >= rows) continue;
    const next = position + dx + dy * columns;
    if (visited[next] || !walkable[next]) continue;
    const target = point(next);
    const moved = slideAlongMazeWalls(point(position), target, MAZE_WALLS, radius);
    if (moved.x !== target.x || moved.y !== target.y) continue;
    visited[next] = 1;
    queue.push(next);
  }
}
for (const [i, checkpoint] of checkpoints.entries()) {
  assert.equal(visited[index(checkpoint)], 1, `Checkpoint ${i} is unreachable`);
}
for (let slot = 0; slot < 4; slot += 1) {
  assert.equal(visited[index({ x: spawn.x + (slot - 1.5) * 32, y: spawn.y })], 1, `Spawn ${slot + 1} is blocked`);
}
assert.equal(visited[index(exit)], 1, 'Castle is unreachable with the actual collision function');
assert.equal(MAZE_LETTER_POINTS.length, MAZE_GLYPHS.length, 'A letter has no spot on the map');
assert.deepEqual([...MAZE_GLYPHS].sort(), [...MAZE_PHRASE].sort(), 'The letters must spell the full message');
for (const [i, letter] of MAZE_LETTER_POINTS.entries()) {
  assert.equal(visited[index(letter)], 1, `Letter ${i + 1} is unreachable or too close to a hazard`);
  assert.equal(isHazard(letter.x, letter.y, 27), false, `Letter ${i + 1} can be collected in a hazard`);
}

const maxStep = player.speed * player.maxFrameDeltaMs / 1000;
for (const [i, { point: center, across, area }] of MAZE_CORRIDOR_HAZARDS.entries()) {
  const horizontal = across === 'x';
  const along = horizontal ? 'y' : 'x';
  const limits = horizontal ? [bounds.minX, bounds.maxX] : [bounds.minY, bounds.maxY];
  const edges = limits.map((limit) => slideAlongMazeWalls(center, { ...center, [across]: limit }, MAZE_WALLS, radius)[across]);
  const min = horizontal ? area.top : area.left;
  const max = horizontal ? area.bottom : area.right;
  for (const edge of edges) {
    let hit = false;
    for (let position = min - radius - 1; position <= max + radius; position += maxStep) {
      const attempt = { [across]: edge, [along]: position };
      hit ||= mazeHazardHits(area, attempt.x, attempt.y, radius);
    }
    assert.ok(hit, `Hazard ${i + 1} can be bypassed along the wall`);
  }
}
for (const size of [1, 2, 3, 4]) {
  const team = Array.from({ length: size }, (_, i) => String(i));
  const limits = team.map((id) => mazeLetterLimit(team, id));
  assert.equal(limits.reduce((sum, count) => sum + count, 0), MAZE_GLYPHS.length);
  assert.ok(Math.max(...limits) - Math.min(...limits) <= 1);
}

for (const rect of MAZE_WALLS) {
  const y = (rect.top + rect.bottom) / 2;
  const result = slideAlongMazeWalls({ x: rect.left - radius - 20, y }, { x: rect.right + radius + 20, y: y + 4 }, [rect], radius);
  assert.equal(result.x, rect.left - radius, 'Diagonal movement went through a wall horizontally');
  const x = (rect.left + rect.right) / 2;
  const vertical = slideAlongMazeWalls({ x, y: rect.top - radius - 20 }, { x: x + 4, y: rect.bottom + radius + 20 }, [rect], radius);
  assert.equal(vertical.y, rect.top - radius, 'Diagonal movement went through a wall vertically');
}
console.log(`Maze OK: ${MAZE_WALLS.length} wall spans, 4 connected spawns, ${checkpoints.length} checkpoints, ${MAZE_LETTER_POINTS.length} reachable letters, ${MAZE_CORRIDOR_HAZARDS.length} checked hazards, and a hazard-free route to the castle.`);
