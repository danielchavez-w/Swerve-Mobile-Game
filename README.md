# 🔮 Swerve
> A 3D ball-rolling endless runner built with Three.js & Cannon-es. (MOBILE WEB: iOS & Android)
>
> **(STILL IN PROGRESS)** ⚠️ This build is under active development. Expect unresolved bugs, visual glitches, and unfinished features. Things will break.

### 📱 Controls

| Action | Input |
| :--- | :--- |
| **Steer the Marble** | Touch & hold the marble, drag left/right |
| **Speed Boost** | Drag forward while holding |
| **Release** | Lift finger — marble continues with momentum |

> The marble always rolls forward automatically. Your finger guides it.

### 🎮 Game

**Objective:** Guide your marble down an endless neon track, collect points, dodge barriers, and survive as long as you can.

* **🏆 Goal:** Rack up the highest score possible. There is no finish line — only your limits.
* **💀 Game Over:** You have **3 lives**. Hit a barrier and you lose one. Lose all three and it's over. No continues. Tap to restart.

### 💎 Collectibles

The track is loaded with pickups. Grab everything you can.

1. **Point Dots (10 pts):** Small glowing spheres scattered along the track in lines and patterns. The bread and butter of your score.
2. **Diamonds (50 pts):** Rotating gems placed at tricky spots — edges of the track, tops of ramps. Risk meets reward.
3. **Aerial Hoops (100 pts):** Glowing rings floating above ramps. Launch off a ramp and thread through the hoop for big points.

### 🚧 Obstacles & Ghost Mode

Barriers appear along the track to test your reflexes:

* **Static Walls** — fixed blocks covering part of the track. Swerve around them.
* **Swinging Arms** — pendulum beams sweeping side to side.
* **Sliding Blocks** — barriers that slide back and forth across the track.

**When you get hit:**

* You lose 1 life.
* The marble enters **Ghost Mode** for 3 seconds — it turns transparent and can phase through all barriers.
* You can still move, steer, and collect points during Ghost Mode.
* After 3 seconds, the marble solidifies and you're vulnerable again.

### 📈 Difficulty Scaling

The game gets harder the better you play. As your score climbs, expect:

* **Faster base speed** — the marble accelerates over time.
* **More barriers** — obstacles appear more frequently.
* **Trickier track** — narrower paths, sharper curves, more ramps.
* **Fewer collectibles** — points become harder to come by.

| Score | Level | What Changes |
| :--- | :--- | :--- |
| 0 – 500 | Easy | Wide tracks, slow speed, lots of pickups |
| 500 – 1,500 | Medium | Ramps and curves introduced, speed increases |
| 1,500 – 3,000 | Hard | Narrow paths, frequent barriers |
| 3,000 – 5,000 | Very Hard | Complex track layouts, high speed |
| 5,000+ | Extreme | Maximum speed and obstacle density. Good luck. |

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

> *"Touch controls are everything in a mobile game like this. The force-based steering had to feel weighty but responsive — not floaty, not snappy. A lot of tuning went into the drag-to-force multiplier and the ball's damping values to hit that sweet spot."*

> *"Ghost Mode was initially confusing for players — they didn't realize they were invulnerable. Adding the transparency effect, a pulsing glow, and a visible 3-second countdown near the lives display made the mechanic instantly readable."*

---

### 🛠 Built With

* **Three.js** — 3D rendering
* **Cannon-es** — Physics engine
* **Vanilla JavaScript** — No frameworks
* **HTML/CSS** — HUD overlay
* **GitHub Pages** — Hosting

---

[**➡️ PLAY THE GAME HERE**](https://yourusername.github.io/swerve/)
