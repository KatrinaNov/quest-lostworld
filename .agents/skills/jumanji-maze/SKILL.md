---
name: jumanji-maze
description: Edit or verify the route, wall collisions, spawn points, hazards and checkpoints of JUMANJI’s paper-map labyrinth.
---

Start in `src/game/world/mazeLayout.ts`. Wall spans and hazards use the coordinates of the original 1199×1312 PNG. `mazePoint` applies the shared transform. Use a provided copy of the original to compare wall endpoints, every junction and both openings.

- `MazeWorld.ts` draws the walls. `mazeCollision.ts` sweeps the player against the same rectangles. Keep these connected to the same layout data.
- `mazeConfig.ts` holds the entrance, exit and checkpoints. Keep checkpoint indices stable because Supabase saves them.
- For visibility and respawn, open `LabyrinthScene.ts`. For shared arrival and saving, open `mazeQuestSync.ts` and the latest maze migration.

Run `node scripts/check-maze.mjs` after layout or collision edits. It checks all four spawns, both checkpoints and the route to the castle with wall and hazard geometry. Use `?demo=1&test=maze` locally for a browser smoke test. Use real separate sessions and `?test=maze` for shared progress. Mention which checks actually ran.
