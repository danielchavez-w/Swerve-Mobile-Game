# 🔮 Swerve
> A 3D ball-rolling endless runner built with Three.js & Cannon-es. (MOBILE WEB: iOS & Android)
>
> **(STILL IN PROGRESS)** ⚠️ This build is under active development. Expect unresolved bugs, visual glitches, and unfinished features. Things will break.

### 📱 Controls

| Action | Input |
| :--- | :--- |
| **Steer the Marble** | Touch & hold, drag left/right |
| **Jump** | Swipe up while holding |

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

> *"Mobile performance was stuttering near arches and at game start. Two culprits: every arch was spawning a dynamic PointLight, and the GPU was compiling shaders on the first frame they appeared. Killing the PointLights in favor of emissive materials and adding a shader warm-up pass during init — one off-screen render of every material — eliminated both hitches completely."*

---

### 🛠 Built With

* **Three.js** — 3D rendering
* **Cannon-es** — Physics engine
* **Vanilla JavaScript** — No frameworks
* **HTML/CSS** — HUD overlay
* **GitHub Pages** — Hosting

---

[**➡️ PLAY THE GAME HERE**](https://danielchavez-w.github.io/Swerve-Mobile-Game/)
