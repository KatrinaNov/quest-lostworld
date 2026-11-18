# JUMANJI

Local checks on Windows use `npm.cmd run build`. For maze changes, also run `node scripts/check-maze.mjs`.

Start with the closest entry point below. Read direct imports and callers as needed. A full scan is useful for project-wide audits and cross-cutting regressions.

| Area | Start here |
| --- | --- |
| Lobby, test URLs, game lifecycle | `src/main.ts`, `src/game/scenes/BootScene.ts` |
| Island, keys and portal | `src/game/scenes/WorldScene.ts`, `src/game/quest/IslandQuestController.ts` |
| Jungle and secret word | `src/game/scenes/MinecraftScene.ts`, `src/game/quest/JungleQuestController.ts` |
| Temple, stars, plates and door | `src/game/scenes/TempleScene.ts`, `src/game/world/TempleWorldBuilder.ts`, `src/network/templeQuestSync.ts` |
| Maze, collision and hazards | `src/game/scenes/LabyrinthScene.ts`, `src/game/world/mazeLayout.ts` |
| Movement and mobile input | `src/game/systems/MovementSystem.ts`, `src/ui/MobileControls.ts`, `src/ui/PlatformerControls.ts` |
| Realtime and saved progress | `src/network/realtimeService.ts`, the location's `*QuestSync.ts`, then its SQL migration |

Open the project skill that matches the task:

- [`$jumanji-maze`](.agents/skills/jumanji-maze/SKILL.md) for maze geometry, collision and route checks.
- [`$jumanji-loading`](.agents/skills/jumanji-loading/SKILL.md) for loading or connection regressions.

`?demo=1&test=maze` and `?demo=1&test=temple` use the local dev room. `?test=maze` and `?test=temple` alone use a real room. GitHub Pages builds the frontend, while Supabase migrations are applied separately. Never print `.env` values or stage them.

Keep the player-facing [PROJECT.md](PROJECT.md) up to date in the same change whenever a location, entry URL, test mode, deployment address or required migration changes. Label local-only entries and distinguish published behavior from changes pending deployment.
