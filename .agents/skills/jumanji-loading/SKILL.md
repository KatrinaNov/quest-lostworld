---
name: jumanji-loading
description: Diagnose slow lobby startup, room joins and scene transitions in JUMANJI by isolating JavaScript, texture and Supabase costs.
---

First locate the delay: before the lobby appears, after Create/Join, or after a scene transition. Measure that path and inspect only its direct dependencies.

- For lobby startup, build and inspect `dist/index.html` and bundle sizes. `src/main.ts` loads the Phaser entry on demand. Check transitive imports from UI and network modules if Phaser appears in the lobby again.
- For room joins, start at `authService.ts` and `RealtimeRoom.connect`. Time auth, channel subscribe and Presence confirmation separately. Check a real room before tightening Presence timeouts.
- For scene startup, follow `BootScene.ts` and the target scene. Island PNGs belong to `PreloadScene.ts`. Jungle-specific textures are generated in `MinecraftScene.ts`. Direct maze and temple routes bypass island preloading.
- For background load, check that scene listeners, room channels and timers are released on the relevant teardown path.

Report byte reductions separately from loading times. Use a browser recording for timing and label local demo results separately from Supabase results.
