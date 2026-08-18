# Swerve

A 3D ball-rolling endless runner built with Three.js & Cannon-es. (MOBILE WEB: iOS & Android)

## Tech Stack

- **Three.js** — 3D rendering
- **Cannon-es** — Physics engine
- **Vanilla JavaScript** — No frameworks
- **HTML/CSS** — HUD overlay
- **GitHub Pages** — Hosting

## Project Status

**DONE:** Core gameplay mechanics, physics, HUD/UI, high score persistence, obstacle redesign (brick-textured walls, red X sliding blocks), neon yellow arch collectibles, speed boost collectible, ghost mode & hit slowdown system, 7-level difficulty scaling, GPU shader warm-up, mobile performance optimization, futuristic neon hexagon background, level-up shooting star celebration (per-level palettes), and a three-tier pulsating star field with per-level nebula colour shifts.

**CURRENT FOCUS:** Environmental Design.

**NEXT UP:** TBD.

## Notes

- The track is flat-only. Ramps were removed entirely — don't reintroduce ramp code without a design decision first.
- Shared geometries and materials for track/obstacles/collectibles are never disposed on cleanup. Disposing a shared material drops its compiled shader program and causes a recompile stall.
- Any material that first appears mid-game (ghost marble, shooting stars) must be registered in the `warmUpGPU` list in `main.js`.
- Shooting stars are confined to sky bands above the horizon so they never cross the track or hex floor — see `SKY_LOW`/`SKY_HIGH` and `LOW_BAND_*` in `js/shootingstars.js`.
- **The camera far plane is 200.** Anything placed in the sky beyond that is silently clipped and never drawn. This killed the gradient dome (radius 250) and 75% of the star field before it was found.
- The visible sky is only the top third of the screen — the camera pitches down ~12.7° with a 65° vertical FOV, so on-screen sky runs from the horizon to ~19.8° elevation. Place sky content by elevation angle, not uniformly on a sphere.
- There is no sky dome. The backdrop is `scene.background` plus the nebula ribbons, by design.
