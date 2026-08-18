# 🔮 Swerve
> A 3D ball-rolling endless runner built with Three.js & Cannon-es. (MOBILE WEB: iOS & Android)
>
> **(STILL IN PROGRESS)** ⚠️ This build is under active development. Expect unresolved bugs, visual glitches, and unfinished features. Things will break.

### 📱 Controls

| Action | Input |
| :--- | :--- |
| **Steer the Marble** | Touch & hold, drag left/right |

> The marble always rolls forward automatically. Your finger guides it left and right.

### 🎮 Game

**Objective:** Guide your marble down an endless neon track, collect points, dodge barriers, and survive as long as you can.

* **🏆 Goal:** Rack up the highest score possible. There is no finish line — only your limits.
* **💀 Game Over:** You have **3 lives**. Hit a barrier and you lose one. Lose all three and it's over. No continues. Tap to restart.

### 💎 Collectibles

The track is loaded with pickups. Grab everything you can.

1. **Point Dots (10 pts):** Small neon blue spheres scattered along the track in lines and wave patterns. The bread and butter of your score.
2. **Speed Boost (25 pts):** Green glowing cones that give a short burst of speed when collected. Appear starting at level 3.
3. **Diamonds (50 pts):** Rotating golden gems placed at tricky spots. Risk meets reward.
4. **Neon Arches (100 pts):** Glowing yellow arches standing on the track. Roll through the arch for big points.

### 🚧 Obstacles & Ghost Mode

Barriers appear along the track to test your reflexes:

* **Static Walls** — fixed blocks covering part of the track. Swerve around them.
* **Swinging Arms** — pendulum beams sweeping side to side.
* **Sliding Blocks** — barriers that slide back and forth across the track.
* **Low Bars** — horizontal bars with a narrow gap to thread through.

**When you get hit:**

* You lose 1 life.
* The marble enters **Ghost Mode** for 3 seconds — it turns transparent and can phase through all barriers.
* The marble slows down to 40% speed and gradually ramps back up. The slowdown lasts longer at higher levels.
* You can still move and steer during Ghost Mode, but you **cannot collect points**.
* After 3 seconds, the marble solidifies and you're vulnerable again.

### 📈 Difficulty Scaling

The game gets harder the better you play. As your score climbs, expect:

* **Faster base speed** — the marble accelerates with each level.
* **More barriers** — obstacles appear more frequently.
* **Longer hit slowdowns** — recovery from hits takes longer at higher levels.

| Level | Name | Score | Speed | What Changes |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Easy | 0 – 499 | 1.0x | Slow speed, few obstacles, lots of pickups |
| 2 | Medium | 500 – 1,499 | 1.15x | Speed increases, more obstacles |
| 3 | Hard | 1,500 – 2,499 | 1.3x | Frequent barriers, speed boosts start appearing |
| 4 | Very Hard | 2,500 – 3,999 | 1.55x | High speed, dense obstacles |
| 5 | Extreme | 4,000 – 5,999 | 1.8x | Very fast, obstacles everywhere |
| 6 | Insane | 6,000 – 7,999 | 2.1x | Relentless speed and obstacle density |
| 7 | Nightmare | 8,000+ | 2.4x | Maximum speed. Good luck. |

### 🌌 Setting

The entire game takes place under a **night sky with northern lights**. Stars twinkle overhead and aurora ribbons of green, cyan, and purple flow across the horizon. The track itself is a neon-lit corridor — glowing edge rails on a dark surface, cutting through the void.

Every time you reach a new level, a burst of **colorful shooting stars** sweeps across the sky behind the level banner — each level in its own palette. The **nebula ribbons shift colour** as you climb the levels, and the star field runs three tiers deep, from bright pulsating stars down to a dim scatter.

### 📊 HUD & Scoring

| Position | Display |
| :--- | :--- |
| **Top Left** | Lives (marble icons) |
| **Top Center** | Current Score |
| **Top Right** | High Score (saved locally) |

---

### 🛠 Developer Iteration Notes

> *"The original touch controls were force-based — you'd push the ball and it would drift. It felt floaty and imprecise, especially at higher speeds. Switching to 1:1 world-space tracking changed everything. Your finger is the ball. Wherever you drag, the marble follows instantly. That directness is what makes dodging at 2.4x speed feel possible instead of hopeless."*

> *"Ghost Mode originally let you keep collecting points while invulnerable. It felt broken — you'd get hit on purpose near a cluster of pickups and profit from it. Disabling collection during ghost mode turned it into a pure survival mechanic. Now getting hit always costs you something, even if you don't die."*

> *"The speed boost collectible went through a few rounds of tuning. The first version was way too strong — it launched you forward and you'd slam into the next obstacle before you could react. We dialed it down to a 1.3x burst for half a second, just enough to feel the kick without losing control. Delaying it to level 3 also helped — by the time it shows up, the player already knows how the track feels at speed."*

> *"Hit slowdown was the last big balancing pass. Before it existed, getting hit at level 6 or 7 was basically a death sentence — you'd respawn at full speed into another obstacle. Dropping the ball to 40% speed on hit and ramping it back up gives you a window to recover and reposition. The ramp-up duration scales with level — 2 seconds early on, up to 4.5 at Nightmare — so the safety net grows with the difficulty."*

> *"The obstacles needed to read instantly at speed. A plain colored box doesn't scream 'danger' when it's flying toward you at 2x. Putting a brick texture on the static walls and a bold white X on the sliding blocks made them unmistakable — you see the X and your brain says 'avoid' before you even think about it."*

> *"The hoops used to be flat pink rings floating in the air. They looked like decorations, not rewards. Replacing them with neon yellow arches planted on the track made the 100-point pickup feel like a real gateway — something you aim for and drive through, not something you accidentally clip."*

> *"Mobile performance was stuttering near arches and at game start. Two culprits: every arch was spawning a dynamic PointLight, and the GPU was compiling shaders on the first frame they appeared. Killing the PointLights in favor of emissive materials fixed the arch stutter outright. We also added a shader warm-up pass during init — one off-screen render of every material — which turned out to be a story for a later entry."*

> *"The stutter when you got hit took four separate fixes, and the biggest one was hiding inside the warm-up pass we'd been trusting for months. It parked its meshes off-screen at y = -100, which is exactly where Three.js frustum-culls them — and a culled mesh never reaches the GPU, so not one shader was ever actually compiling. The ghost marble is a transparent material, and transparent is a different shader program from solid, so the driver was compiling it at the precise moment you took damage. Disabling frustum culling on those meshes was a one-line change that finally did the job the pass was written to do."*

> *"The other three stacked onto that same frame. Retiring a track segment was disposing the shared material every other segment still used, which threw away its compiled program and forced a recompile on the next one — and segments retire constantly. The red damage flash was building a full-screen div from scratch on every hit, forcing a layout and a fresh compositor layer at the worst possible instant; it lives in the DOM permanently now and just toggles a class. And the forward velocity was snapping to 40% in a single frame. It eases down over 0.18 seconds now and recovers on a smoothstep — same 40% floor, same per-level durations, no jolt. Ghost mode fades in and back out instead of popping, so the material swap happens while the marble is already solid and you never catch it."*

> *"Ramps had been sitting in track.js since the first prototype — a full builder, a type picker, angled physics bodies, arrow decals — and generateSegment never called any of it. Not once. It was dead weight that every future change to the track had to read past and route around. Deleting it took the file from 251 lines to 132."*

> *"Reaching a new level deserved a moment. Five shooting stars now streak across the sky as the banner appears — pink, cyan, gold, violet, mint — shuffled every time so no two celebrations look alike, each on its own heading: across, back, up from the corner, down from the top. The first pass had four of the five flying down through the track and the hex floor, which read as falling debris instead of sky. They're pinned to a band of open sky now that scales with distance, so the lowest any streak reaches is about seven degrees above the horizon — everything the player actually drives on sits below that line."*

> *"The celebration moved to level 2 and up — level 1 is where you start, not something you reach. Eight streaks now instead of five: the original five sweeping the upper sky, plus three that climb out of the corners just above the floor line, each with its own speed so some knife across while others drift. Every level celebrates in its own colours — aqua at 2, ember at 3, orchid at 4, crimson at 5, deep blue at 6, and white-hot pink and cyan at Nightmare."*

> *"Three separate bugs were hiding in the night sky, and each one masked the next. The twinkle never worked at all: the code wrote a per-star size attribute every third frame, but PointsMaterial only reads its own uniform and ignores per-vertex size entirely — pure cost, no effect. With that fixed, only one bright star showed up, because the stars sat 181 to 260 units out against a far plane of 200, so three quarters of the field was being clipped and never drawn. And once they were all inside the frustum, the middle of the sky still looked empty — scattering uniformly over a sphere buries about 73% of the stars near the zenith, above the top of the frame. The camera pitches down roughly 13 degrees with a 65 degree field of view, so the only sky you ever see runs from the horizon to about 20 degrees up. Placing stars by elevation angle into that band took the count in frame from 16 to 78."*

> *"The gradient dome had been dead the entire time. Radius 250 against a far plane of 200 puts every vertex past the clip distance, so it hadn't drawn a single pixel since the far plane was tightened. Pulling it back into range revealed why nobody had missed it — a coloured wash along the bottom of the sky that fought the nebulae for attention. It's gone now, geometry and shader both. The backdrop is a flat night and the ribbons carry the sky, which is what the game had effectively been shipping all along."*

> *"Stars are sorted into three tiers now to lean into realism: a handful of bright ones that swell and throb behind a halo with a colour cast, a middle layer that twinkles gently, and a dense dim scatter that only shimmers and recedes. All of it runs off a single time uniform in the vertex shader, so the CPU does nothing per frame. The nebulae shift palette on every level-up, blending over about three seconds from wherever they happen to be, so gaining a level mid-transition never snaps."*

---

### 🛠 Built With

* **Three.js** — 3D rendering
* **Cannon-es** — Physics engine
* **Vanilla JavaScript** — No frameworks
* **HTML/CSS** — HUD overlay
* **GitHub Pages** — Hosting

---

[**➡️ PLAY THE GAME HERE**](https://danielchavez-w.github.io/Swerve-Mobile-Game/)
