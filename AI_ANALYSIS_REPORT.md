# Comprehensive Bot AI Analysis & Tuning Report: Antigravity Minigames

**Author:** Game AI Specialist & Playtest Systems Analyst  
**Target Version:** Antigravity 2 Player Games Engine  
**Scope:** Complete algorithmic inspection, failure-mode pathology, and difficulty parameterization across all 8 minigames.

---

## 1. Executive Summary & Architectural Overview

The Antigravity minigame suite features eight diverse, physics-forward multiplayer titles. While the player-facing controls and physical interactions are responsive and dynamic, the bot artificial intelligence across the collection exhibits severe imbalances. Bots oscillate wildly between two extremes:
1. **Catastrophically Incompetent:** Bots driving continuously into walls, running in circles, jumping blindly into lethal lasers, ignoring hazards (falling anvils, black holes), or failing to steer entirely due to input protocol mismatches.
2. **Unfairly Robotic / Sniper-like:** Bots executing instantaneous lock-on aim, firing with sub-frame reaction speeds without human-like tracking noise, or calculating sweet-spot launch values with arithmetic perfection.

### The Underlying Architectural Flaws
Across the games, five recurring systemic flaws explain why the AI breaks down:

1. **Input Interface Under-utilization (`setBotInput` omission):**  
   The `InputRouter.setBotInput(pid, pressed, steer, throttle, action)` method accepts steering direction (`-1, 0, 1`) and throttle (`-1, 0, 1`). However, several games (`BumperHovercraftGame`, `LaserGridReflexGame`, `MicroTurboGPGame`, `GhostFlashlightGame`) only invoked `setBotInput(pid, true)` or `setBotInput(pid, false)`. As a result, bots were rendered physically incapable of directional steering, relying on random clock-drift or getting permanently trapped against walls.
2. **Stateless Frame-Rate Dependent RNG Polling:**  
   Several AI routines call `Math.random() < 0.3` or `Math.random() < 0.75` every single simulation frame ($60\text{ Hz}$). A $30\%$ per-frame check has an expected activation time of $\approx 0.05\text{ seconds}$ ($\approx 3\text{ frames}$), transforming what was intended as an occasional action into an immediate, erratic spam loop.
3. **Absence of a Sensory-Motor Delay Buffer ($\tau_{react}$):**  
   Human players require $180\text{ ms} - 350\text{ ms}$ of visual-motor latency to perceive an opponent's trajectory, detect a warning indicator, or adjust an aim angle. Bots operate directly on zero-latency raw game memory, reacting instantly to state transitions unless artificially buffered.
4. **Hardcoded or Ignored Difficulty Levels:**  
   Most minigames (`LaserGridReflexGame`, `OrbitalSlingshotGame`, `MicroTurboGPGame`, `GhostFlashlightGame`, `SkylineSumoGame`) do not branch on the `difficulty` parameter (`bot_easy`, `bot_normal`, `bot_hard`) at all, giving players identical behavior regardless of selected challenge.
5. **Lack of Predictive Lead with Natural Dispersion:**  
   Games involving projectiles or physics trajectories either calculate zero lead (aiming directly at stale coordinates) or snap with zero angular error directly to the exact target center without Gaussian jitter.

---

## 2. In-Depth Bot Pathology Across All 8 Minigames

---

### 2.1 Cyber Tanks (`CyberTanksGame.ts`)

#### Current Behavior & Code Walkthrough
In `CyberTanksGame.ts` (lines 438–480):
- The bot locates the nearest enemy tank: $D = \operatorname{hypot}(x_{other} - x, y_{other} - y)$.
- Desired angle: $\theta_{target} = \operatorname{atan2}(\Delta y, \Delta x)$.
- Steer direction: `diff > 0.1 ? 1 : diff < -0.1 ? -1 : 0`.
- Throttle: `isFacing ? 1 : 0.4`.
- Firing: `isFacing && tank.cooldown <= 0 && Math.random() < (difficulty === 'bot_hard' ? 0.75 : 0.35)`.

#### Root Causes of Bot Failure
1. **Robotic Frame-Perfect Sniper:** At $60\text{ FPS}$, `Math.random() < 0.75` (Hard) fires with certainty within $16.6\text{ ms} - 33.3\text{ ms}$ the moment `abs(diff) < 0.2`. It feels like an aimbot with zero human-like target acquisition time.
2. **Total Blindness to Obstacles & Suicidal Barrels:** The bot drives directly at the target in a straight line with no obstacle raycasting or navigation mesh. When an explosive barrel or steel bunker is in the line of travel, the bot rams against it continuously. If it shoots while colliding with an explosive barrel, the $90\text{px}$ blast radius causes the bot to blow itself up (`damageTank(tank, tank.id)`).
3. **Ricochet Unawareness:** cyber bullets bounce up to 3 times off metallic walls. The bot tracks neither outgoing friendly ricochets nor incoming hostile ricochets, often walking straight into bouncing shots.
4. **Power-Up Neglect:** The bot completely ignores shields, triple-shot runes, and proximity mines.

#### Algorithmic Redesign Recommendations
- **Potential Field Navigation:** Combine attractive vector to target $\vec{F}_{target}$ with repulsive potential vectors $\vec{F}_{obs} = \frac{k}{(d - r)^2} \hat{n}$ from barriers and explosive barrels.
- **Raycast Obstacle Clearance:** Cast a forward ray of length $120\text{px}$. If blocked by an obstacle, blend steering perpendicular to the collision normal.
- **Predictive Intercept Targeting:** Lead moving targets: $\vec{P}_{aim} = \vec{P}_{target} + \vec{V}_{target} \cdot \left(\frac{\|\vec{P}_{target} - \vec{P}_{bot}\|}{v_{bullet}}\right) \cdot \lambda_{lead}$.
- **Gaussian Jitter on Aiming:** Add angular noise $\mathcal{N}(0, \sigma^2)$ inversely proportional to difficulty.

---

### 2.2 Bumper Hovercraft (`BumperHovercraftGame.ts`)

#### Current Behavior & Code Walkthrough
In `BumperHovercraftGame.ts` (lines 272–327):
- The bot measures distance to arena center: $D_{center} = \operatorname{hypot}(x - x_c, y - y_c)$.
- If $D_{center} > \text{dangerZone}$ ($72\%$ of current radius): calculates angle to center $\theta_c$, and if `abs(diff) < 0.5`, calls `this.input.setBotInput(botId, true)`, else `false`.
- If inside safe zone: finds nearest rival and calls `setBotInput(botId, true)` if facing rival.

#### Root Causes of Bot Failure
1. **The Missing Steer Bug:** `setBotInput(botId, pressed)` is called without passing `steer`! In `BumperHovercraftGame.ts` (lines 177–203), craft turning is controlled by `craft.angle += steer * 4.5 * dt`. When `steer === 0`, it only turns via ambient idle oscillation: `craft.angle += (Math.sin(craft.x * 0.01) * 0.4) * dt`. **The bot never intentionally steers.** It only triggers thrust if its random passive wobble happens to align with the target!
2. **Ice Inertia & Centrifugal Slipping:** Hovercraft physics feature low friction (`0.975^{60 dt}`). When moving outward at high velocity, pointing toward the center and applying forward thrust is mathematically insufficient to counter momentum before sliding into the abyss.
3. **Anvil Oblivious:** Falling anvils cast growing shadows and crash after $250\text{px}$ descent, producing high-knockback shockwaves ($80\text{px}$ radius). Bots have zero anvil collision detection and get blown off the glacier.
4. **Phase Shrinking Ignorance:** When the glacier perimeter crumbles, bots do not anticipate the shrinking radius, remaining on doomed ice segments.

#### Algorithmic Redesign Recommendations
- **Explicit Steering Calculation:** Compute signed steering direction:
  $$\text{steer} = \operatorname{clamp}\left(\frac{\Delta \theta}{\pi / 4}, -1, 1\right)$$
- **Velocity-Compensated Braking Vector:** When returning to center, steer toward $\vec{P}_{safe} = \vec{C}_{arena} - \kappa_{drift} \cdot \vec{v}_{craft}$ to counter inertia rather than steering purely at current position.
- **Anvil Avoidance Circle:** If an anvil shadow is within $90\text{px}$ with height $< 150$, add a high-priority repulsive force away from the shadow epicenter.

---

### 2.3 Laser Grid Reflex (`LaserGridReflexGame.ts`)

#### Current Behavior & Code Walkthrough
In `LaserGridReflexGame.ts` (lines 264–300):
- Evaluates `curTile.warningTime > 0` or battery proximity.
- Triggers:
  ```typescript
  if (isDangerous || (targetBattery && Math.random() < 0.25)) {
    this.input.setBotInput(botId, true);
    setTimeout(() => { this.input.setBotInput(botId, false); }, 50);
  }
  ```

#### Root Causes of Bot Failure
1. **Directionless Panic Hops:** `setBotInput` does not supply `steer` or `throttle`. In `LaserGridReflexGame.ts`, directional hopping requires `steer` ($-1/1$) or `throttle` ($-1/1$). When both are zero, the game falls back to:
   ```typescript
   desiredDir = (gp.dirIndex + (isPressed ? -1 : 1) + 4) % 4;
   ```
   The bot simply hops in whatever direction its internal counter was rotating, with zero verification of whether the neighboring tile is safe, out of bounds, or occupied by a lethal laser.
2. **Out-of-Loop Asynchronous `setTimeout`:** Using a browser `setTimeout(..., 50)` introduces non-deterministic macro-task scheduling outside the game's fixed update loop, causing dropped or lingering inputs.
3. **Suicidal Battery Greed:** When seeking batteries, bots jump without checking if the battery tile has an active or incoming laser beam (`warningTime > 0` or `laserTime > 0`).
4. **No Difficulty Differentiation:** Easy, Normal, and Hard bots use the exact same unguided random hop logic.

#### Algorithmic Redesign Recommendations
- **4-Directional Tile Safety Scoring (Minimax / Greedy Evaluation):**  
  For each candidate neighbor $(x', y') \in \text{Neighbors}(gx, gy)$:
  $$\text{Score}(x', y') = -1000 \cdot \mathbb{I}(\text{laserTime} > 0) - 500 \cdot \mathbb{I}(\text{warningTime} > 0) + 50 \cdot \mathbb{I}(\text{hasBattery}) - 10 \cdot \operatorname{Dist}(x', y', \text{targetBattery})$$
- **Human Reaction Timer ($\tau_{react}$):** Delay response to a newly flashing tile by $350\text{ms}$ (Easy), $220\text{ms}$ (Normal), or $100\text{ms}$ (Hard).
- **Direct Axis Input Dispatch:** Translate selected safe direction into exact discrete inputs:
  $$\text{Up} \to (0, 1), \quad \text{Down} \to (0, -1), \quad \text{Left} \to (-1, 0), \quad \text{Right} \to (1, 0)$$

---

### 2.4 Orbital Slingshot (`OrbitalSlingshotGame.ts`)

#### Current Behavior & Code Walkthrough
In `OrbitalSlingshotGame.ts` (lines 277–326):
- If tethered: computes dot product of tangent velocity with vector to nearest crystal. If $\cos(\theta) > 0.85$, releases tether.
- If untethered: if distance to any planet $< 140\text{px}$ and `Math.random() < 0.3`, grabs tether.

#### Root Causes of Bot Failure
1. **Zero Free-Flight Steering:** When flying untethered, the bot provides no `steer` or `throttle`. While human players can steer and burn thrusters in free space (`ship.angle += steer * 3.6 * dt`, `throttle * 280`), the bot drifts helplessly in straight lines.
2. **Per-Frame Tether RNG Spam:** `nearPlanet && Math.random() < 0.3` evaluated at $60\text{ FPS}$ guarantees a tether grab within $\sim 0.05\text{s}$ of entering the radius, regardless of whether tethering swings the ship toward or away from its intended goal.
3. **Singularity Suicides:** The wandering black hole instakills ships within $34\text{px}$. The bot has no black hole obstacle avoidance and routinely slingshots directly into the singularity.
4. **Planet Surface Collisions:** Ships bouncing off planet surfaces lose crystals and momentum; the bot does not calculate minimum periapsis clearance.

#### Algorithmic Redesign Recommendations
- **Orbital Vector Projection:** Calculate future parabolic arc upon release:
  $$\vec{r}(t) = \vec{r}_0 + \vec{v}_0 t + \frac{1}{2}\sum \vec{g}_i t^2$$
  Release only when the trajectory closest-approach distance to crystal is $< 25\text{px}$ and closest distance to the black hole is $> 60\text{px}$.
- **Free-Flight Steering PID:** In free space, actively orient ship toward high-value crystals or favorable planet approach tangents using `steer` and `throttle`.

---

### 2.5 Micro Turbo GP (`MicroTurboGPGame.ts`)

#### Current Behavior & Code Walkthrough
In `MicroTurboGPGame.ts` (lines 222–245):
- Evaluates angle difference to next waypoint: $\Delta \theta = \theta_{wp} - \theta_{car}$.
- Drift trigger:
  ```typescript
  if (diff > 0.35) {
    this.input.setBotInput(botId, true);
  } else {
    this.input.setBotInput(botId, false);
  }
  ```

#### Root Causes of Bot Failure
1. **Fatal Clockwise-Only Steering Lock:** In `MicroTurboGPGame.ts` (lines 135–139), single-button hold (`isPressed`) executes:
   ```typescript
   r.angle += 3.6 * dt; // ONLY turns right / clockwise!
   ```
   The bot never provides `steer: -1` or `steer: 1`. Thus, the bot can **only turn right**. If the track veers left (`diff < -0.35`), `diff > 0.35` evaluates to false, so the bot does nothing. On left-hand hairpins or chicanes, the bot continues straight into the wall or must circle $350^\circ$ clockwise to correct a $10^\circ$ left deviation.
2. **Zero Throttle Management / Brake Ignorance:** Bot always drives at maximum linear acceleration, unable to brake before tight turns.
3. **Hazard Blindness:** Ignores oil slicks ($0.6\text{s}$ spinout) and fails to aim for boost pads.
4. **No Drift-Boost Release Optimization:** Turbo boosts are granted upon releasing drift with charge $> 0.4\text{s}$. Bots toggle drift sporadically without cleanly banking drift boost onto straightaways.

#### Algorithmic Redesign Recommendations
- **Full Bi-directional Steering:**
  $$\text{steer} = \operatorname{clamp}\left(\frac{\Delta \theta}{\pi / 3}, -1, 1\right)$$
- **Pure Pursuit Waypoint Tracking with Lookahead:** Look ahead along the waypoint spline by distance $L = \text{clamp}(v \cdot 0.4, 40, 120)$.
- **Speed Clamping in Chicanes:** Reduce throttle when entering tight hairpin angles ($\|\Delta \theta\| > 0.8\text{ rad}$) to prevent centrifugal understeer into track barriers.
- **Hazard Ray Offset:** Cast a $60\text{px}$ cone forward; if an oil slick intersects, introduce an lateral steering offset of $\pm 25\text{px}$.

---

### 2.6 Ghost Flashlight (`GhostFlashlightGame.ts`)

#### Current Behavior & Code Walkthrough
In `GhostFlashlightGame.ts` (lines 181–235):
- Ghost bot finds nearest human; human bot finds ghost.
- If Ghost: if `Math.abs(diff) > 0.4`, calls `setBotInput(botId, true)`, else `false`.
- If Human: if `distToGhost < 180` and `Math.abs(diff) > 0.5`, calls `setBotInput(botId, true)`, else `false`.

#### Root Causes of Bot Failure
1. **Broken Inverse Acceleration Logic:** In `GhostFlashlightGame.ts` (lines 103–111), movement requires `steer` and `throttle` to set `mp.angle = Math.atan2(-throttle, steer)`. With `steer === 0 && throttle === 0`, `isPressed` only accelerates in the existing direction. Because the bot never sets `steer` or `throttle`, **it can never steer**. Furthermore, `Math.abs(diff) > 0.4` means the bot only presses the button when **NOT** facing the target, and releases when it **IS** facing the target. The logic is inverted!
2. **Flashlight Unawareness:** Human bots never trigger their flashlights (`action` or quick tap), rendering them unable to reveal hidden ghosts or defend themselves.
3. **Omniscient Wallhack Ghost:** The ghost bot targets stealth humans even when completely cloaked and not on creaky floorboards, breaking the core stealth illusion of the game.

#### Algorithmic Redesign Recommendations
- **Direct Vector Translation to Analog Input:**
  $$\vec{d} = \vec{P}_{target} - \vec{P}_{bot}, \quad \text{throttle} = \operatorname{clamp}(-\hat{d}_y, -1, 1), \quad \text{steer} = \operatorname{clamp}(\hat{d}_x, -1, 1)$$
- **Line-of-Sight & Audio Stealth Simulation:** Ghost bots should only target humans who are (a) revealed by flashlight, (b) stepped on creaky floorboards (`revealedTimer > 0`), or (c) within a small listening radius ($100\text{px}$). Otherwise, ghost bots should perform a randomized patrol.
- **Flashlight Sweeping for Humans:** When human bots hear a sound or are in a defensive standoff, sweep flashlight beam across suspicious sectors.

---

### 2.7 Kitchen Chaos (`KitchenChaosGame.ts`)

#### Current Behavior & Code Walkthrough
In `KitchenChaosGame.ts` (lines 245–265):
- If item ready: hold charge.
- If charging:
  ```typescript
  const targetSweet = difficulty === 'bot_hard' ? 0.5 : 0.45 + Math.random() * 0.2;
  if (Math.abs(chef.chargeProgress - targetSweet) < 0.08) {
    this.input.setBotInput(botId, false);
  }
  ```

#### Root Causes of Bot Failure
1. **Center-Plate Robotic Lock-On:** At `chargeProgress = 0.5`, the launch angle is perfectly aligned with the center $2\times$ plate. On Hard, the bot releases with near $100\%$ precision at $0.5$, hitting the center plate every single throw without needing to time plate rotations.
2. **Food Item Ignorance (Rotten Fish Throwing):** The bot does not inspect `chef.readyItem.type`. Throwing a `rotten` fish penalizes $-2$ points! Human players either hold or deliberately waste rotten items; bots enthusiastically launch rotten fish directly into bonus plates.
3. **Ignoring Orbiting Plates & Multipliers:** The kitchen features 4 outer orbiting plates with varying speeds and fever interactions. Bots treat the board as static.

#### Algorithmic Redesign Recommendations
- **Item-Type Utility Heuristic:**
  - If `item.type === 'rotten'`: purposely misfire into dead space (release at charge $0.1$ or $0.9$) or dump off-target.
  - If `item.type === 'pepper'` or high-value: time launch for high-multiplier rotating plates.
- **Dynamic Orbital Plate Intercept:** Calculate arrival time $t_{flight} = \frac{\text{Distance}}{v_{food}}$ and predict plate position:
  $$\theta_{plate}(t + t_{flight}) = \theta_0 + \omega_{plate} \cdot t_{flight}$$

---

### 2.8 Skyline Sumo (`SkylineSumoGame.ts`)

#### Current Behavior & Code Walkthrough
In `SkylineSumoGame.ts` (lines 239–257):
- Grounded: If not charging, sets `setBotInput(botId, true)`.
- If `chargePower > 0.7`, releases: `setBotInput(botId, false)`.

---

## 3. Why Skyline Sumo AI Works Well & How to Replicate It

Despite possessing the simplest AI logic in the repository (merely 18 lines of code), **Skyline Sumo consistently delivers the most organic, balanced, and enjoyable bot play experience**. Understanding why reveals the design blueprint for the rest of the game engine.

```
Skyline Sumo Balance Ecosystem:
[ Physical Oscillation ]  ──> Natural aim variance without robotic snapping
         │
[ Environmental Boundaries ] ──> Soft wall bounces keep bot in flow
         │
[ Forgiving Vertical Loop ] ──> Camera fall penalty respawns bot into action
         │
[ Emergent Dynamics ]    ──> Head-bop collisions occur spontaneously
```

### Key Pillars of Skyline Sumo's Success

1. **Physicalized Natural Oscillation (Harmonic Emergence):**  
   In `SkylineSumoGame.ts` (lines 127–130):
   $$\theta_{aim} = -\frac{\pi}{2} + \sin(\omega t) \cdot 0.75$$
   The aim angle constantly oscillates in a smooth pendulum arc across an $86^\circ$ cone. Because the bot simply releases when charge reaches $> 0.7$, the jump angle is determined by the phase of the mechanical pendulum at that specific instant. This produces jumps with natural, human-looking variability without brittle hand-coded randomization.
2. **Forgiving Environmental Architecture:**  
   - Side walls bounce climbers inward ($v_x \leftarrow -v_x \cdot 0.8$), preventing bots from becoming irrecoverably trapped out of bounds.
   - Spring platforms grant sudden upward kinetic boosts, creating dramatic comebacks.
   - Camera boundaries penalize fallen climbers by teleporting them back into the active screen ($y \leftarrow \text{cameraY} + 0.7 h$), keeping bots continually engaged.
3. **Kinematic Stomp Rewards:**  
   Downward velocity collisions trigger "Head Bops" ($v_y > 100 \implies \text{opponent stunned for } 1.2\text{s}$, jumper boosted upward $v_y = -520$). Because bots and players populate the same vertical lanes, spectacular physical interactions occur frequently without complex tactical decision trees.

### How to Replicate This Balance in Other Minigames
To bring the rest of the suite to Skyline Sumo's level:
- **Introduce Natural Oscillatory Tracking:** Replace immediate angle lock-on with smooth angular spring-dampers (e.g. tanks sweep barrels with maximum angular acceleration rather than snapping).
- **Enforce Physical Boundary Grace:** Prevent permanent failure states by implementing soft repulsions or bounce guards along arena boundaries.
- **Tie Actions to Observable Physical Rhythms:** Replace raw `Math.random()` checks with thresholds linked to in-world cycles (oscillating sights, plate rotations, gravity orbits).

---

## 4. Unified Difficulty Parameterization Framework

To establish consistent challenge scaling across Easy, Normal, and Hard modes, all games must implement the following mathematical parameters:

### 4.1 Mathematical Foundations

$$\begin{aligned}
\text{Perception Delay:} &\quad \tau_{react} \in [\tau_{min}, \tau_{max}] \text{ (ms)} \\
\text{Angular Dispersion:} &\quad \theta_{aim} = \theta_{target} + \mathcal{N}(0, \sigma^2) \\
\text{Predictive Intercept:} &\quad \vec{P}_{lead} = \vec{P}_{target} + \lambda_{lead} \cdot \vec{V}_{target} \cdot \frac{D}{v_{proj}} \\
\text{Hazard Avoidance Weight:} &\quad \vec{F}_{net} = (1 - \omega_{hazard})\vec{F}_{objective} + \omega_{hazard}\vec{F}_{avoid} \\
\text{Blunder Probability:} &\quad P_{blunder} = \text{Probability of selecting sub-optimal action}
\end{aligned}$$

---

### 4.2 Parameter Matrix by Difficulty Level

| Parameter | Easy (`bot_easy`) | Normal (`bot_normal`) | Hard (`bot_hard`) |
|---|---|---|---|
| **Sensory Reaction Delay ($\tau_{react}$)** | $350 - 500\text{ ms}$ | $200 - 300\text{ ms}$ | $80 - 140\text{ ms}$ |
| **Angular Jitter Spread ($\sigma_{jitter}$)** | $\pm 0.40\text{ rad } (\approx 23^\circ)$ | $\pm 0.15\text{ rad } (\approx 8.5^\circ)$ | $\pm 0.03\text{ rad } (\approx 1.7^\circ)$ |
| **Predictive Intercept Lead ($\lambda_{lead}$)** | $0.00$ (pure chase) | $0.45 - 0.60$ (partial lead) | $0.85 - 0.95$ (full kinematic lead) |
| **Hazard Avoidance Weight ($\omega_{hazard}$)** | $0.20$ (often oblivious) | $0.70$ (cautious) | $0.95$ (proactive avoidance) |
| **Decision Refresh Rate ($\Delta t_{eval}$)** | $300\text{ ms}$ | $150\text{ ms}$ | $50\text{ ms}$ |
| **Drift / Boost Efficiency** | $30\%$ sweet-spot timing | $70\%$ sweet-spot timing | $95\%$ sweet-spot timing |
| **Blunder Rate ($P_{blunder}$)** | $25\%$ chance of hesitation | $8\%$ chance of hesitation | $1\%$ chance of hesitation |

---

## 5. Concrete Algorithmic Tuning Specifications per Game

### 5.1 CyberTanksGame Tuning
```typescript
interface TankBotState {
  reactionTimer: number;
  perceivedTargetPos: { x: number; y: number };
  targetLeadFactor: number; // Easy: 0.0, Normal: 0.5, Hard: 0.95
  aimSpread: number;        // Easy: 0.45, Normal: 0.15, Hard: 0.03
  hazardWeight: number;     // Easy: 0.2, Normal: 0.7, Hard: 0.95
}
```
- **Obstacle Avoidance Vector:** Compute 8-ray whisker sensors around tank radius ($25\text{px}$). If obstacle within $60\text{px}$, apply repulsive steering torque $\tau = \frac{\vec{r} \times \hat{n}_{obs}}{\|\vec{r}\|}$.
- **Barrel Safety Threshold:** If an explosive barrel is within $100\text{px}$ in the firing line, inhibit firing (`shouldShoot = false`).
- **Lead Calculation:**
  $$\vec{P}_{aim} = \vec{P}_t + \lambda_{lead} \cdot \vec{V}_t \cdot \frac{\|\vec{P}_t - \vec{P}_{bot}\|}{v_{bullet}} + \text{GaussianNoise}(\sigma_{jitter})$$

---

### 5.2 BumperHovercraftGame Tuning
```typescript
// Fix the missing steer bug and add velocity-aware counter-thrust
const toCenter = { x: this.arenaCenter.x - craft.x, y: this.arenaCenter.y - craft.y };
const distCenter = Math.hypot(toCenter.x, toCenter.y);

// Counteract outward centrifugal velocity
const safeTarget = {
  x: this.arenaCenter.x - craft.vx * 0.4,
  y: this.arenaCenter.y - craft.vy * 0.4
};
const desiredAngle = Math.atan2(safeTarget.y - craft.y, safeTarget.x - craft.x);
let angleDiff = normalizeAngle(desiredAngle - craft.angle);

const steer = Math.sign(angleDiff);
const shouldThrust = Math.abs(angleDiff) < (difficulty === 'bot_hard' ? 0.35 : 0.6);

this.input.setBotInput(botId, shouldThrust, steer, shouldThrust ? 1 : 0);
```

---

### 5.3 LaserGridReflexGame Tuning
```typescript
// Replace blind hopping with evaluated safe neighbor traversal
const deltas = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
let bestDir = null;
let bestScore = -Infinity;

for (let i = 0; i < deltas.length; i++) {
  const nx = gp.gx + deltas[i].dx;
  const ny = gp.gy + deltas[i].dy;
  if (nx < 0 || nx >= this.gridSize || ny < 0 || ny >= this.gridSize) continue;

  const t = this.tiles[ny][nx];
  let score = 0;
  if (t.laserTime > 0) score -= 10000;
  if (t.warningTime > 0) score -= 5000;
  if (t.hasBattery) score += 2000;
  score -= Math.abs(nx - targetBattery.x) + Math.abs(ny - targetBattery.y);

  if (score > bestScore) {
    bestScore = score;
    bestDir = i; // Map to throttle and steer
  }
}
```

---

### 5.4 OrbitalSlingshotGame Tuning
- **Trajectory Ray-Caster:** Step forward simulated orbital release position over $t \in [0, 1.5\text{s}]$ with $\Delta t = 0.05\text{s}$. If minimum distance to black hole $< 50\text{px}$, abort release.
- **Free-Flight Vector Targeting:** When untethered, actively align heading toward closest crystal using `steer = clamp(diff * 2, -1, 1)` and `throttle = 1`.

---

### 5.5 MicroTurboGPGame Tuning
```typescript
// Bi-directional steering and lookahead waypoint pursuit
const lookaheadWp = this.waypoints[(r.nextWaypointIndex + 1) % this.waypoints.length];
const targetAngle = Math.atan2(targetWp.y - r.y, targetWp.x - r.x);
let diff = normalizeAngle(targetAngle - r.angle);

const steer = Math.max(-1, Math.min(1, diff * 2.5));
const isSharpTurn = Math.abs(diff) > 0.45;
const throttle = isSharpTurn ? 0.6 : 1.0;

// Execute drift and turbo burst release
const shouldDrift = isSharpTurn && r.speed > 120;
this.input.setBotInput(botId, shouldDrift, steer, throttle);
```

---

### 5.6 GhostFlashlightGame Tuning
- **Fix Directional Velocity:** Set `steer` and `throttle` based on normalized vector components:
  $$\text{steer} = \hat{d}_x, \quad \text{throttle} = -\hat{d}_y$$
- **Flashlight Tactical Activation:** Human bots flash light when an unrevealed player is within $140\text{px}$ cone and `flashlightCooldown <= 0`.
- **Sensory Stealth Filter:** Ghost bot only targets humans with `revealedTimer > 0` or distance $< 80\text{px}$ (footstep acoustic threshold).

---

### 5.7 KitchenChaosGame Tuning
- **Rotten Item Purging:** If `readyItem.type === 'rotten'`, hold until charge reaches $0.15$ and fling into empty sidewalls to discard without losing points.
- **Fever / Multiplier Optimization:** If `readyItem.type === 'pepper'` or `sushi`, target the rotating $2\times$ center plate with leading timing:
  $$\text{TargetSweetSpot} = 0.50 + \mathcal{N}(0, \sigma_{difficulty}^2)$$

---

### 5.8 SkylineSumoGame Tuning
- **Platform-Targeted Spring Leaps:** Rather than blind release at `chargePower > 0.7`, compute the trajectory arc corresponding to current `aimAngle` and release when the landing coordinate aligns with a visible platform overhead.
- **Mid-Air Corrective Aerodynamics:** Utilize `steer = clamp((targetPlatX - climber.x) / 50, -1, 1)` during airborne descent to land securely on narrow ledges or stomp descending opponents.

---

## 6. Implementation Checklist & Verification Plan

1. **Verify `setBotInput` calls in all 8 games:** Ensure `steer` and `throttle` parameters are actively supplied and never default to inert values.
2. **Eliminate asynchronous `setTimeout` calls** in favor of delta-time accumulation timers attached to game state.
3. **Run Playtest Simulation Suite:**
   - 100 automated headless rounds per minigame across Easy, Normal, and Hard configurations.
   - Measure Bot Win Rates against reference baseline:
     - Easy: Bot win rate $15\% - 25\%$ vs human standard.
     - Normal: Bot win rate $45\% - 55\%$ (ideal parity).
     - Hard: Bot win rate $75\% - 85\%$ (formidable challenge).
   - Ensure $0\%$ wall-trap lockups and $0\%$ unforced self-destructs.

---
*Report completed for integration into Antigravity game engine.*
