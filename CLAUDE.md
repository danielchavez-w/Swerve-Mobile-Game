# Swerve

A 3D ball-rolling endless runner built with Three.js & Cannon-es. (MOBILE WEB: iOS & Android)

## Tech Stack

- **Three.js** — 3D rendering
- **Cannon-es** — Physics engine
- **Vanilla JavaScript** — No frameworks
- **HTML/CSS** — HUD overlay
- **GitHub Pages** — Hosting

## Project Status

**DONE:** Core gameplay mechanics, physics, HUD/UI, high score persistence, obstacle redesign (brick-textured walls, red X sliding blocks), neon yellow arch collectibles, speed boost collectible, ghost mode & hit slowdown system, 7-level difficulty scaling, skybox with aurora shaders, GPU shader warm-up, mobile performance optimization, futuristic neon hexagon background, and level-up shooting star celebration.

**CURRENT FOCUS:** Environmental Design.

**NEXT UP:** TBD.

## Notes

- The track is flat-only. Ramps were removed entirely — don't reintroduce ramp code without a design decision first.
- Shared geometries and materials for track/obstacles/collectibles are never disposed on cleanup. Disposing a shared material drops its compiled shader program and causes a recompile stall.
- Any material that first appears mid-game (ghost marble, shooting stars) must be registered in the `warmUpGPU` list in `main.js`.
- Shooting stars are confined to a sky band above the horizon so they never cross the track or hex floor — see `SKY_LOW`/`SKY_HIGH` in `js/shootingstars.js`.
