# 🚨 MASTER CODEBASE BUG AUDIT & CRITICAL FIX SPECIFICATION

**Target Suite:** Antigravity 1–4 Player Local Arcade Suite (260 Minigames + Core Subsystems)  
**Document Purpose:** Prominent Central Reference for AI Agents & Engineers to Detect, Reproduce, and Patch All Bugs  
**Audit Status:** ACTIVE OVERNIGHT EXPEDITION  
**File Location:** `/Users/elizabethyrose/Downloads/Antigravity 2 Player games/MASTER_BUG_AUDIT_REPORT.md`  

---

## 1. Executive Bug Dashboard & Severity Breakdown

| Severity Category | Defect Type | Verified Instances | Primary Risk |
|---|---|:---:|---|
| 🔴 **CRITICAL** | Unguarded Division by Zero (NaN Physics Freeze) | **72** | Complete avatar disappearance, NaN coordinates, frozen physics |
| 🟠 **HIGH** | Missing `destroy()` Lifecycle Overrides | **240** | Memory accumulation & zombie callbacks across lobby switches |
| 🟡 **MEDIUM** | Array Splice Index Shifts (Missed Elements) | **3** | Skipped collision frames, ghost hitboxes, skipped rendering |
| 🟡 **MEDIUM** | Unbounded Array Appending (Memory Growth) | **1** | Monotonic heap growth during long endurance rounds |
| 🔴 **CRITICAL** | Core Engine Potential Denominator Zero | **2** | Global canvas failure across all games |
| **TOTAL DEFECTS DETECTED** | | **318** | **Full Audit Catalog Below** |

---

## 2. 🔴 Critical NaN / Division-by-Zero Vulnerabilities

When two entities spawn at identical coordinates, or when a bot is at distance 0 from a target, calculating `dx / dist` results in `0 / 0 = NaN`. Once `NaN` enters velocity or position, it propagates through all kinematic equations. The canvas coordinates become `NaN`, resulting in an invisible entity and frozen game state.

| # | File Path | Line | Faulty Code Snippet | Prescribed Fix |
|---|---|:---:|---|---|
| 1 | `src/games/AlienProbeGame.ts` | **256** | `moveX = dx / dist;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 2 | `src/games/AlienProbeGame.ts` | **257** | `moveY = dy / dist;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 3 | `src/games/BombRelayGame.ts` | **359** | `steerX = dx / mag;` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |
| 4 | `src/games/BombRelayGame.ts` | **360** | `steerY = dy / mag;` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |
| 5 | `src/games/BombRelayGame.ts` | **391** | `this.input.setBotInput(botId, true, steerX / mag, -steerY / mag, false);` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |
| 6 | `src/games/BubbleSoccerGame.ts` | **208** | `b.vx += (dashDirX / len) * 380;` | Change to: `const safeLen = len \|\| 0.001;` or guard with `if (len > 0.001)` |
| 7 | `src/games/BubbleSoccerGame.ts` | **209** | `b.vy += (dashDirY / len) * 380;` | Change to: `const safeLen = len \|\| 0.001;` or guard with `if (len > 0.001)` |
| 8 | `src/games/BumperCarDerbyGame.ts` | **476** | `const normX = dx / dist;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 9 | `src/games/BumperCarDerbyGame.ts` | **477** | `const normY = dy / dist;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 10 | `src/games/ColorClashGame.ts` | **456** | `let steerX = dx / mag;` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |
| 11 | `src/games/ColorClashGame.ts` | **457** | `let steerY = dy / mag;` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |
| 12 | `src/games/CosmicVortexGame.ts` | **373** | `const toCenterX = (cx - ps.x) / dist;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 13 | `src/games/CosmicVortexGame.ts` | **374** | `const toCenterY = (cy - ps.y) / dist;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 14 | `src/games/CyberDemolitionGame.ts` | **177** | `const normX = dx / dist;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 15 | `src/games/CyberDemolitionGame.ts` | **178** | `const normY = dy / dist;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 16 | `src/games/CyberGridRunnerGame.ts` | **394** | `node.x += ((ps.x - node.x) / dist) * pullForce;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 17 | `src/games/CyberGridRunnerGame.ts` | **395** | `node.y += ((ps.y - node.y) / dist) * pullForce;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 18 | `src/games/DodgeballBlitzGame.ts` | **790** | `bot.vx = (toBallX / dist) * botSpeed;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 19 | `src/games/DodgeballBlitzGame.ts` | **791** | `bot.vy = (toBallY / dist) * botSpeed;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 20 | `src/games/DragonTamerGame.ts` | **181** | `d.vx += (dx / dist) * 190 * dt;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 21 | `src/games/DragonTamerGame.ts` | **182** | `d.vy += (dy / dist) * 190 * dt;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 22 | `src/games/DragonflyDogfightGame.ts` | **115** | `df.vy += (steerY / mag) * speed * dt * 5;` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |
| 23 | `src/games/DuckPondDerbyGame.ts` | **24** | `hookDist: number; // distance extended from station` | Change to: `const safeDistance = distance \|\| 0.001;` or guard with `if (distance > 0.001)` |
| 24 | `src/games/DungBeetleRollGame.ts` | **101** | `b.vy += (steerY / mag) * maxSpd * dt * 4;` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |
| 25 | `src/games/FerrisWheelGame.ts` | **22** | `dist: number;       // distance along spoke (30 to 210)` | Change to: `const safeDistance = distance \|\| 0.001;` or guard with `if (distance > 0.001)` |
| 26 | `src/games/GhostFlashlightGame.ts` | **472** | `this.input.setBotInput(botId, true, awayX / mag, -awayY / mag, false);` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |
| 27 | `src/games/GhostFlashlightGame.ts` | **519** | `const steer = chaseX / mag;` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |
| 28 | `src/games/GhostFlashlightGame.ts` | **520** | `const throttle = -chaseY / mag;` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |
| 29 | `src/games/GhostFlashlightGame.ts` | **543** | `const steer = fleeX / mag;` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |
| 30 | `src/games/GhostFlashlightGame.ts` | **544** | `const throttle = -fleeY / mag;` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |
| 31 | `src/games/GhostVacuumBusterGame.ts` | **163** | `g.x -= (dx / dist) * pullSpeed * dt;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 32 | `src/games/GhostVacuumBusterGame.ts` | **164** | `g.y -= (dy / dist) * pullSpeed * dt;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 33 | `src/games/GoldMinerGame.ts` | **393** | `let util = (item.value / dist) * 100;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 34 | `src/games/GravityGolfGame.ts` | **199** | `b.vx += (dx / dist) * force * dt;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 35 | `src/games/GravityGolfGame.ts` | **200** | `b.vy += (dy / dist) * force * dt;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 36 | `src/games/GravityGolfGame.ts` | **204** | `const nx = dx / dist;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 37 | `src/games/GravityGolfGame.ts` | **205** | `const ny = dy / dist;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 38 | `src/games/GravityGolfGame.ts` | **501** | `simVx += (pdx / dist) * force * simDt;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 39 | `src/games/GravityGolfGame.ts` | **502** | `simVy += (pdy / dist) * force * simDt;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 40 | `src/games/GravityPodsGame.ts` | **8** | `distance: number; // distance along tunnel` | Change to: `const safeDistance = distance \|\| 0.001;` or guard with `if (distance > 0.001)` |
| 41 | `src/games/HoneybeeNectarRelayGame.ts` | **490** | `const steer = dx / mag;` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |
| 42 | `src/games/HoneybeeNectarRelayGame.ts` | **491** | `const throttle = -dy / mag;` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |
| 43 | `src/games/KitchenChaosGame.ts` | **666** | `const steer = dx / mag;` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |
| 44 | `src/games/KitchenChaosGame.ts` | **667** | `const throttle = -dy / mag;` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |
| 45 | `src/games/LadybugAphidHuntGame.ts` | **102** | `ps.y += (steerY / mag) * speed * dt;` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |
| 46 | `src/games/MeteorShieldGame.ts` | **258** | `vx: (dx / dist) * speed,` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 47 | `src/games/MeteorShieldGame.ts` | **259** | `vy: (dy / dist) * speed,` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 48 | `src/games/OuijaSpiritBoardGame.ts` | **124** | `ps.x += (dx / dist) * 140 * dt;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 49 | `src/games/OuijaSpiritBoardGame.ts` | **125** | `ps.y += (dy / dist) * 140 * dt;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 50 | `src/games/OuijaSpiritBoardGame.ts` | **193** | `this.input.setBotInput(botId, true, dx / dist, -dy / dist);` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 51 | `src/games/PacMazeChompGame.ts` | **223** | `this.input.setBotInput(botId, true, dx / dist, -dy / dist);` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 52 | `src/games/PacMazeChompGame.ts` | **259** | `this.input.setBotInput(botId, true, dx / dist, -dy / dist);` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 53 | `src/games/RaptorPounceDodgeGame.ts` | **357** | `this.input.setBotInput(botId, true, perpX / mag, -perpY / mag, true);` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |
| 54 | `src/games/RaptorPounceDodgeGame.ts` | **359** | `this.input.setBotInput(botId, true, perpX / mag, -perpY / mag, false);` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |
| 55 | `src/games/RhythmDuelGame.ts` | **474** | `// diff <= 0.065 is PERFECT (~40%), 0.065..0.135 is GREAT (~45%), 0.135..0.210 is OK (~15%)` | Change to: `const safeDiff = diff \|\| 0.001;` or guard with `if (diff > 0.001)` |
| 56 | `src/games/RollercoasterThrillGame.ts` | **8** | `y: number; // distance down track (0 to height)` | Change to: `const safeDistance = distance \|\| 0.001;` or guard with `if (distance > 0.001)` |
| 57 | `src/games/RooftopZiplineGame.ts` | **73** | `az.score += dt * 5; // distance score` | Change to: `const safeDistance = distance \|\| 0.001;` or guard with `if (distance > 0.001)` |
| 58 | `src/games/SharksAndMinnowsGame.ts` | **799** | `hs.vx = (dx / dist) * speed;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 59 | `src/games/SharksAndMinnowsGame.ts` | **800** | `hs.vy = (dy / dist) * speed;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 60 | `src/games/SkylineSumoGame.ts` | **594** | `this.rescuerX += (dx / dist) * Math.min(flightSpeed * dt, Math.abs(dx));` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 61 | `src/games/SkylineSumoGame.ts` | **595** | `this.rescuerY += (dy / dist) * Math.min(flightSpeed * dt, Math.abs(dy));` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 62 | `src/games/SwatFlyGame.ts` | **180** | `ins.x += (dx / dist) * speed * dt + Math.sin(ins.flutterPhase) * 1.8;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 63 | `src/games/SwatFlyGame.ts` | **181** | `ins.y += (dy / dist) * speed * dt + Math.cos(ins.flutterPhase) * 1.8;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 64 | `src/games/SwatFlyGame.ts` | **370** | `sw.x += (dx / dist) * moveSpeed * dt;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 65 | `src/games/SwatFlyGame.ts` | **371** | `sw.y += (dy / dist) * moveSpeed * dt;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 66 | `src/games/TargetSniperGame.ts` | **288** | `bot.reticleX += (dx / dist) * Math.min(dist, trackingSpeed * dt * 4);` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 67 | `src/games/TargetSniperGame.ts` | **289** | `bot.reticleY += (dy / dist) * Math.min(dist, trackingSpeed * dt * 4);` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 68 | `src/games/TombstoneCryptSliderGame.ts` | **235** | `this.input.setBotInput(botId, false, dx / dist, -dy / dist);` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 69 | `src/games/TurfWhackGame.ts` | **392** | `m.x += (dx / dist) * glideSpeed * dt;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 70 | `src/games/TurfWhackGame.ts` | **393** | `m.y += (dy / dist) * glideSpeed * dt;` | Change to: `const safeDist = dist \|\| 0.001;` or guard with `if (dist > 0.001)` |
| 71 | `src/games/VolcanoLavaLeapGame.ts` | **171** | `const dirX = steerX / mag;` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |
| 72 | `src/games/VolcanoLavaLeapGame.ts` | **172** | `const dirY = steerY / mag;` | Change to: `const safeMag = mag \|\| 0.001;` or guard with `if (mag > 0.001)` |

---

## 3. 🟡 Array Splice Forward-Loop Index Shifts

When iterating forward through an array with `for (let i = 0; i < arr.length; i++)`, calling `arr.splice(i, 1)` shifts all subsequent elements to the left by one index. If `i` is not decremented (`i--`), the next element (now at index `i`) is completely skipped during that frame! This causes projectiles to pass through targets without collision detection or particles to linger indefinitely.

### Defect #1: `src/games/MagmaHopGame.ts` at Line 404
- **Faulty Code:** `const chosen = candidatePillars.splice(pickIdx, 1)[0];`
- **Impact:** MEDIUM (Skipped Collisions & Ghost Hitboxes)
- **Prescribed Fix:** Add `i--;` immediately following `.splice(i, 1);` or iterate in reverse (`let i = arr.length - 1; i >= 0; i--`).

### Defect #2: `src/games/SushiExpressGame.ts` at Line 161
- **Faulty Code:** `this.plates.splice(snatchedIdx, 1);`
- **Impact:** MEDIUM (Skipped Collisions & Ghost Hitboxes)
- **Prescribed Fix:** Add `i--;` immediately following `.splice(i, 1);` or iterate in reverse (`let i = arr.length - 1; i >= 0; i--`).

### Defect #3: `src/games/WhackAThiefGame.ts` at Line 227
- **Faulty Code:** `const box = emptyBoxes.splice(idx, 1)[0];`
- **Impact:** MEDIUM (Skipped Collisions & Ghost Hitboxes)
- **Prescribed Fix:** Add `i--;` immediately following `.splice(i, 1);` or iterate in reverse (`let i = arr.length - 1; i >= 0; i--`).

---

## 4. 🟠 Missing `destroy()` Lifecycle Implementations

When returning to the lobby or starting a new minigame, `GameManager.startGame()` invokes `this.activeGame.destroy()`. If a subclass does not implement `destroy()`, the default no-op from `BaseGame` runs, leaving active particle systems, intervals, and data maps in memory.

**Total Classes Missing `destroy()`:** 240 of 260 game classes.

<details>
<summary><b>Click to Expand Complete List of Affected Game Classes (240 Files)</b></summary>

- `src/games/AlienAbductionGame.ts` (Class: `AlienAbductionGame`)
- `src/games/AlienProbeGame.ts` (Class: `AlienProbeGame`)
- `src/games/AmberFossilExcavateGame.ts` (Class: `AmberFossilExcavateGame`)
- `src/games/AntColonyHaulGame.ts` (Class: `AntColonyHaulGame`)
- `src/games/AntimatterContainmentGame.ts` (Class: `AntimatterContainmentGame`)
- `src/games/AnubisScalesGame.ts` (Class: `AnubisScalesGame`)
- `src/games/AnvilRainGame.ts` (Class: `AnvilRainGame`)
- `src/games/AsteroidCatcherGame.ts` (Class: `AsteroidCatcherGame`)
- `src/games/AsteroidMinerGame.ts` (Class: `AsteroidMinerGame`)
- `src/games/AstroMinerGame.ts` (Class: `AstroMinerGame`)
- `src/games/AuroraCollectorGame.ts` (Class: `AuroraCollectorGame`)
- `src/games/AutomatorAssemblyGame.ts` (Class: `AutomatorAssemblyGame`)
- `src/games/BalloonBurstGame.ts` (Class: `BalloonBurstGame`)
- `src/games/BalloonDartClownGame.ts` (Class: `BalloonDartClownGame`)
- `src/games/BambooPoleVaultGame.ts` (Class: `BambooPoleVaultGame`)
- `src/games/BanditChaseGame.ts` (Class: `BanditChaseGame`)
- `src/games/BassDropGame.ts` (Class: `BassDropGame`)
- `src/games/BlacksmithForgeGame.ts` (Class: `BlacksmithForgeGame`)
- `src/games/BlizzardBeaconGame.ts` (Class: `BlizzardBeaconGame`)
- `src/games/BlowpipeTargetGame.ts` (Class: `BlowpipeTargetGame`)
- `src/games/BombRelayGame.ts` (Class: `BombRelayGame`)
- `src/games/BreakdanceBattleGame.ts` (Class: `BreakdanceBattleGame`)
- `src/games/BreakoutBrickBlasterGame.ts` (Class: `BreakoutBrickBlasterGame`)
- `src/games/BriefcaseSnatchGame.ts` (Class: `BriefcaseSnatchGame`)
- `src/games/BubbleSoccerGame.ts` (Class: `BubbleSoccerGame`)
- `src/games/BumperBoatsGame.ts` (Class: `BumperBoatsGame`)
- `src/games/BumperCarDerbyGame.ts` (Class: `BumperCarDerbyGame`)
- `src/games/BumperHovercraftGame.ts` (Class: `BumperHovercraftGame`)
- `src/games/BurgerStackGame.ts` (Class: `BurgerStackGame`)
- `src/games/CactusSlalomGame.ts` (Class: `CactusSlalomGame`)
- `src/games/CastleArcherGame.ts` (Class: `CastleArcherGame`)
- `src/games/CatapultClashGame.ts` (Class: `CatapultClashGame`)
- `src/games/CaterpillarInchwormGame.ts` (Class: `CaterpillarInchwormGame`)
- `src/games/CauldronWitchBrewGame.ts` (Class: `CauldronWitchBrewGame`)
- `src/games/CentipedeSlalomGame.ts` (Class: `CentipedeSlalomGame`)
- `src/games/ChestSnatchGame.ts` (Class: `ChestSnatchGame`)
- `src/games/ClockworkCogsGame.ts` (Class: `ClockworkCogsGame`)
- `src/games/CoinApexGame.ts` (Class: `CoinApexGame`)
- `src/games/ColorClashGame.ts` (Class: `ColorClashGame`)
- `src/games/ColorFloodGame.ts` (Class: `ColorFloodGame`)
- `src/games/CopperConduitGame.ts` (Class: `CopperConduitGame`)
- `src/games/CosmicVortexGame.ts` (Class: `CosmicVortexGame`)
- `src/games/CottonCandySpinGame.ts` (Class: `CottonCandySpinGame`)
- `src/games/CrabWalkGame.ts` (Class: `CrabWalkGame`)
- `src/games/CreepyDollCrawlGame.ts` (Class: `CreepyDollCrawlGame`)
- `src/games/CrtScanlineSniperGame.ts` (Class: `CrtScanlineSniperGame`)
- `src/games/CursedClocktowerPendulumGame.ts` (Class: `CursedClocktowerPendulumGame`)
- `src/games/CyberDemolitionGame.ts` (Class: `CyberDemolitionGame`)
- `src/games/CyberDiscGame.ts` (Class: `CyberDiscGame`)
- `src/games/CyberSamuraiSlashGame.ts` (Class: `CyberSamuraiSlashGame`)
- `src/games/CyberTanksGame.ts` (Class: `CyberTanksGame`)
- `src/games/DeepSeaHarpoonGame.ts` (Class: `DeepSeaHarpoonGame`)
- `src/games/DiscoTileGame.ts` (Class: `DiscoTileGame`)
- `src/games/DisguiseShuffleGame.ts` (Class: `DisguiseShuffleGame`)
- `src/games/DogSledDashGame.ts` (Class: `DogSledDashGame`)
- `src/games/DominoCascadeGame.ts` (Class: `DominoCascadeGame`)
- `src/games/DonutGlazerGame.ts` (Class: `DonutGlazerGame`)
- `src/games/DragonTamerGame.ts` (Class: `DragonTamerGame`)
- `src/games/DragonflyDogfightGame.ts` (Class: `DragonflyDogfightGame`)
- `src/games/DrawbridgePanicGame.ts` (Class: `DrawbridgePanicGame`)
- `src/games/DroneDeliveryGame.ts` (Class: `DroneDeliveryGame`)
- `src/games/DroneInterceptGame.ts` (Class: `DroneInterceptGame`)
- `src/games/DroneSwarmDefenseGame.ts` (Class: `DroneSwarmDefenseGame`)
- `src/games/DrumSoloGame.ts` (Class: `DrumSoloGame`)
- `src/games/DuckPondDerbyGame.ts` (Class: `DuckPondDerbyGame`)
- `src/games/DungBeetleRollGame.ts` (Class: `DungBeetleRollGame`)
- `src/games/DungeonEscapeGame.ts` (Class: `DungeonEscapeGame`)
- `src/games/DunkClownTankGame.ts` (Class: `DunkClownTankGame`)
- `src/games/DynamiteTumbleGame.ts` (Class: `DynamiteTumbleGame`)
- `src/games/DysonSphereCollectorGame.ts` (Class: `DysonSphereCollectorGame`)
- `src/games/ElectricEelGame.ts` (Class: `ElectricEelGame`)
- `src/games/EqualizerBounceGame.ts` (Class: `EqualizerBounceGame`)
- `src/games/FerrisWheelHopGame.ts` (Class: `FerrisWheelHopGame`)
- `src/games/FireflyNightBeaconGame.ts` (Class: `FireflyNightBeaconGame`)
- `src/games/FireworksFinaleGame.ts` (Class: `FireworksFinaleGame`)
- `src/games/FloorPainterGame.ts` (Class: `FloorPainterGame`)
- `src/games/FortuneTellerTarotGame.ts` (Class: `FortuneTellerTarotGame`)
- `src/games/FrostbiteCavernGame.ts` (Class: `FrostbiteCavernGame`)
- `src/games/FruitBlenderGame.ts` (Class: `FruitBlenderGame`)
- `src/games/FruitChopperGame.ts` (Class: `FruitChopperGame`)
- `src/games/FunhouseMirrorsGame.ts` (Class: `FunhouseMirrorsGame`)
- `src/games/GargoyleStoneStareGame.ts` (Class: `GargoyleStoneStareGame`)
- `src/games/GeyserLeapGame.ts` (Class: `GeyserLeapGame`)
- `src/games/GhostFlashlightGame.ts` (Class: `GhostFlashlightGame`)
- `src/games/GhostVacuumBusterGame.ts` (Class: `GhostVacuumBusterGame`)
- `src/games/GoldMinerGame.ts` (Class: `GoldMinerGame`)
- `src/games/GoldPanningGame.ts` (Class: `GoldPanningGame`)
- `src/games/GorgonGazeGame.ts` (Class: `GorgonGazeGame`)
- `src/games/GrasshopperHighJumpGame.ts` (Class: `GrasshopperHighJumpGame`)
- `src/games/GraveyardZombieBashGame.ts` (Class: `GraveyardZombieBashGame`)
- `src/games/GravityGolfGame.ts` (Class: `GravityGolfGame`)
- `src/games/GravityPodsGame.ts` (Class: `GravityPodsGame`)
- `src/games/HackTerminalGame.ts` (Class: `HackTerminalGame`)
- `src/games/HauntedMansionGame.ts` (Class: `HauntedMansionGame`)
- `src/games/HighwayHopGame.ts` (Class: `HighwayHopGame`)
- `src/games/HologramGlitchGame.ts` (Class: `HologramGlitchGame`)
- `src/games/HoneybeeNectarRelayGame.ts` (Class: `HoneybeeNectarRelayGame`)
- `src/games/HorseshoeTossGame.ts` (Class: `HorseshoeTossGame`)
- `src/games/HoverboardRailGame.ts` (Class: `HoverboardRailGame`)
- `src/games/HovercarSkylineGame.ts` (Class: `HovercarSkylineGame`)
- `src/games/HydraSlayerGame.ts` (Class: `HydraSlayerGame`)
- `src/games/HyperloopRacerGame.ts` (Class: `HyperloopRacerGame`)
- `src/games/IcarusWingsGame.ts` (Class: `IcarusWingsGame`)
- `src/games/IceCreamScoopGame.ts` (Class: `IceCreamScoopGame`)
- `src/games/IcebergBreakerGame.ts` (Class: `IcebergBreakerGame`)
- `src/games/JellyfishJumpGame.ts` (Class: `JellyfishJumpGame`)
- `src/games/JoustingKnightsGame.ts` (Class: `JoustingKnightsGame`)
- `src/games/KitchenChaosGame.ts` (Class: `KitchenChaosGame`)
- `src/games/KrakenWhirlpoolGame.ts` (Class: `KrakenWhirlpoolGame`)
- `src/games/LadybugAphidHuntGame.ts` (Class: `LadybugAphidHuntGame`)
- `src/games/LandscapeArtilleryGame.ts` (Class: `LandscapeArtilleryGame`)
- `src/games/LaserDiscDanceGame.ts` (Class: `LaserDiscDanceGame`)
- `src/games/LaserGrappleGame.ts` (Class: `LaserGrappleGame`)
- `src/games/LaserGridReflexGame.ts` (Class: `LaserGridReflexGame`)
- `src/games/LaserLeapGame.ts` (Class: `LaserLeapGame`)
- `src/games/LaserSpeedwayGame.ts` (Class: `LaserSpeedwayGame`)
- `src/games/LaserTripwireGame.ts` (Class: `LaserTripwireGame`)
- `src/games/MagmaHopGame.ts` (Class: `MagmaHopGame`)
- `src/games/MainframeBreachGame.ts` (Class: `MainframeBreachGame`)
- `src/games/MammothStampedeGame.ts` (Class: `MammothStampedeGame`)
- `src/games/MarsRoverGame.ts` (Class: `MarsRoverGame`)
- `src/games/MatrixCodeRainGame.ts` (Class: `MatrixCodeRainGame`)
- `src/games/MazeEscapeGame.ts` (Class: `MazeEscapeGame`)
- `src/games/MemoryMatrixGame.ts` (Class: `MemoryMatrixGame`)
- `src/games/MeteorShieldGame.ts` (Class: `MeteorShieldGame`)
- `src/games/MicroTurboGPGame.ts` (Class: `MicroTurboGPGame`)
- `src/games/MicroWiretapGame.ts` (Class: `MicroWiretapGame`)
- `src/games/MilkBottleKnockdownGame.ts` (Class: `MilkBottleKnockdownGame`)
- `src/games/MinefieldDashGame.ts` (Class: `MinefieldDashGame`)
- `src/games/MinotaurLabyrinthGame.ts` (Class: `MinotaurLabyrinthGame`)
- `src/games/MirrorLaserGame.ts` (Class: `MirrorLaserGame`)
- `src/games/MolePanicGame.ts` (Class: `MolePanicGame`)
- `src/games/MonocycleDerbyGame.ts` (Class: `MonocycleDerbyGame`)
- `src/games/MonorailHijackGame.ts` (Class: `MonorailHijackGame`)
- `src/games/MoonLanderGame.ts` (Class: `MoonLanderGame`)
- `src/games/NebulaDriftGame.ts` (Class: `NebulaDriftGame`)
- `src/games/NeonDriftersGame.ts` (Class: `NeonDriftersGame`)
- `src/games/NeonLightcyclesGame.ts` (Class: `NeonLightcyclesGame`)
- `src/games/NeonMetronomeGame.ts` (Class: `NeonMetronomeGame`)
- `src/games/NeuralSynapseGame.ts` (Class: `NeuralSynapseGame`)
- `src/games/NitroKartGame.ts` (Class: `NitroKartGame`)
- `src/games/OctopusInkGame.ts` (Class: `OctopusInkGame`)
- `src/games/OlympusLightningGame.ts` (Class: `OlympusLightningGame`)
- `src/games/OrbitalDropPodGame.ts` (Class: `OrbitalDropPodGame`)
- `src/games/OrbitalSlingshotGame.ts` (Class: `OrbitalSlingshotGame`)
- `src/games/OrnithopterFlockGame.ts` (Class: `OrnithopterFlockGame`)
- `src/games/OuijaSpiritBoardGame.ts` (Class: `OuijaSpiritBoardGame`)
- `src/games/PacMazeChompGame.ts` (Class: `PacMazeChompGame`)
- `src/games/PancakeFlipperGame.ts` (Class: `PancakeFlipperGame`)
- `src/games/PearlDiversGame.ts` (Class: `PearlDiversGame`)
- `src/games/PenguinSlideGame.ts` (Class: `PenguinSlideGame`)
- `src/games/PhantomMirrorGazeGame.ts` (Class: `PhantomMirrorGazeGame`)
- `src/games/PharaohTombGame.ts` (Class: `PharaohTombGame`)
- `src/games/PinballBattleGame.ts` (Class: `PinballBattleGame`)
- `src/games/PiranhaRiverHopGame.ts` (Class: `PiranhaRiverHopGame`)
- `src/games/PixelPaintballGame.ts` (Class: `PixelPaintballGame`)
- `src/games/PixelSpaceInvaderGame.ts` (Class: `PixelSpaceInvaderGame`)
- `src/games/PizzaTossGame.ts` (Class: `PizzaTossGame`)
- `src/games/PlanetaryRoverGame.ts` (Class: `PlanetaryRoverGame`)
- `src/games/PneumaticTubeRushGame.ts` (Class: `PneumaticTubeRushGame`)
- `src/games/PolarIceFishingGame.ts` (Class: `PolarIceFishingGame`)
- `src/games/PoltergeistPossessionGame.ts` (Class: `PoltergeistPossessionGame`)
- `src/games/PopcornPopperGame.ts` (Class: `PopcornPopperGame`)
- `src/games/PotionAlchemistGame.ts` (Class: `PotionAlchemistGame`)
- `src/games/PowerPathClashGame.ts` (Class: `PowerPathClashGame`)
- `src/games/PressureGaugeLockGame.ts` (Class: `PressureGaugeLockGame`)
- `src/games/PterodactylGlideGame.ts` (Class: `PterodactylGlideGame`)
- `src/games/PulsarSignalGame.ts` (Class: `PulsarSignalGame`)
- `src/games/QuantumTunnelingGame.ts` (Class: `QuantumTunnelingGame`)
- `src/games/QuickDrawWesternGame.ts` (Class: `QuickDrawWesternGame`)
- `src/games/QuicksandEscapeGame.ts` (Class: `QuicksandEscapeGame`)
- `src/games/RapidDrop4Game.ts` (Class: `RapidDrop4Game`)
- `src/games/RaptorPounceDodgeGame.ts` (Class: `RaptorPounceDodgeGame`)
- `src/games/RattlesnakeReflexGame.ts` (Class: `RattlesnakeReflexGame`)
- `src/games/RedLightSentryGame.ts` (Class: `RedLightSentryGame`)
- `src/games/RetroChiptuneGame.ts` (Class: `RetroChiptuneGame`)
- `src/games/RingTossFrenzyGame.ts` (Class: `RingTossFrenzyGame`)
- `src/games/RocketSkatesGame.ts` (Class: `RocketSkatesGame`)
- `src/games/RodeoBullGame.ts` (Class: `RodeoBullGame`)
- `src/games/RollerCoasterBrakeGame.ts` (Class: `RollerCoasterBrakeGame`)
- `src/games/RollercoasterThrillGame.ts` (Class: `RollercoasterThrillGame`)
- `src/games/RooftopZiplineGame.ts` (Class: `RooftopZiplineGame`)
- `src/games/RoyalFeastGame.ts` (Class: `RoyalFeastGame`)
- `src/games/SafeDialGame.ts` (Class: `SafeDialGame`)
- `src/games/SaloonBrawlerGame.ts` (Class: `SaloonBrawlerGame`)
- `src/games/SatelliteLaserGame.ts` (Class: `SatelliteLaserGame`)
- `src/games/SecurityCameraGame.ts` (Class: `SecurityCameraGame`)
- `src/games/SharkBaitGame.ts` (Class: `SharkBaitGame`)
- `src/games/SheepDogCorralsGame.ts` (Class: `SheepDogCorralsGame`)
- `src/games/SkyGlidersGame.ts` (Class: `SkyGlidersGame`)
- `src/games/SkylineSumoGame.ts` (Class: `SkylineSumoGame`)
- `src/games/SmokeBombEscapeGame.ts` (Class: `SmokeBombEscapeGame`)
- `src/games/SnakeArenaGame.ts` (Class: `SnakeArenaGame`)
- `src/games/SnowballFightGame.ts` (Class: `SnowballFightGame`)
- `src/games/SolarFlareGame.ts` (Class: `SolarFlareGame`)
- `src/games/SolarSailRiderGame.ts` (Class: `SolarSailRiderGame`)
- `src/games/SpaceElevatorGame.ts` (Class: `SpaceElevatorGame`)
- `src/games/SpaceJunkSalvageGame.ts` (Class: `SpaceJunkSalvageGame`)
- `src/games/SpartanShieldGame.ts` (Class: `SpartanShieldGame`)
- `src/games/SpiderWebTangleGame.ts` (Class: `SpiderWebTangleGame`)
- `src/games/SteamBoilerReliefGame.ts` (Class: `SteamBoilerReliefGame`)
- `src/games/StopAtZeroGame.ts` (Class: `StopAtZeroGame`)
- `src/games/SubmarineTorpedoGame.ts` (Class: `SubmarineTorpedoGame`)
- `src/games/SumoIcebergGame.ts` (Class: `SumoIcebergGame`)
- `src/games/SumoSpheresGame.ts` (Class: `SumoSpheresGame`)
- `src/games/SunkenTreasureGame.ts` (Class: `SunkenTreasureGame`)
- `src/games/SushiExpressGame.ts` (Class: `SushiExpressGame`)
- `src/games/SwordInStoneGame.ts` (Class: `SwordInStoneGame`)
- `src/games/SynthDrumPadGame.ts` (Class: `SynthDrumPadGame`)
- `src/games/SynthKeytarSoloGame.ts` (Class: `SynthKeytarSoloGame`)
- `src/games/SynthwaveHighwayGame.ts` (Class: `SynthwaveHighwayGame`)
- `src/games/SynthwaveNeonRacerGame.ts` (Class: `SynthwaveNeonRacerGame`)
- `src/games/TargetSniperGame.ts` (Class: `TargetSniperGame`)
- `src/games/TeppanyakiCatchGame.ts` (Class: `TeppanyakiCatchGame`)
- `src/games/TeslaCoilArcGame.ts` (Class: `TeslaCoilArcGame`)
- `src/games/TestStrengthGame.ts` (Class: `TestStrengthGame`)
- `src/games/TombstoneCryptSliderGame.ts` (Class: `TombstoneCryptSliderGame`)
- `src/games/TrafficJamGame.ts` (Class: `TrafficJamGame`)
- `src/games/TrainHeistGame.ts` (Class: `TrainHeistGame`)
- `src/games/TrexEggScrambleGame.ts` (Class: `TrexEggScrambleGame`)
- `src/games/TugOfWarGame.ts` (Class: `TugOfWarGame`)
- `src/games/TurfWhackGame.ts` (Class: `TurfWhackGame`)
- `src/games/TurntableScratchGame.ts` (Class: `TurntableScratchGame`)
- `src/games/VaultSafeGame.ts` (Class: `VaultSafeGame`)
- `src/games/VectorTankBattleGame.ts` (Class: `VectorTankBattleGame`)
- `src/games/VikingLongshipGame.ts` (Class: `VikingLongshipGame`)
- `src/games/VineSwingCanopyGame.ts` (Class: `VineSwingCanopyGame`)
- `src/games/VocalPitchGame.ts` (Class: `VocalPitchGame`)
- `src/games/VolcanoLavaLeapGame.ts` (Class: `VolcanoLavaLeapGame`)
- `src/games/VolleySpikeGame.ts` (Class: `VolleySpikeGame`)
- `src/games/WalrusBaskGame.ts` (Class: `WalrusBaskGame`)
- `src/games/WarpGateJumpGame.ts` (Class: `WarpGateJumpGame`)
- `src/games/WaterBalloonBarrageGame.ts` (Class: `WaterBalloonBarrageGame`)
- `src/games/WaterScooterGame.ts` (Class: `WaterScooterGame`)
- `src/games/WesternPokerGame.ts` (Class: `WesternPokerGame`)
- `src/games/WhackAThiefGame.ts` (Class: `WhackAThiefGame`)
- `src/games/WokStirFryGame.ts` (Class: `WokStirFryGame`)
- `src/games/WormholeLeapGame.ts` (Class: `WormholeLeapGame`)
- `src/games/ZeppelinDogfightGame.ts` (Class: `ZeppelinDogfightGame`)
- `src/games/ZeroGTetherGame.ts` (Class: `ZeroGTetherGame`)

</details>

---

## 5. 🟡 Unbounded Array Memory Growth

Arrays that continuously append elements in `update()` without a `.splice()`, `.filter()`, or length cap cause heap memory to swell monotonically during extended gameplay sessions.

- **File:** `src/games/PinballBattleGame.ts` | **Array Field:** `private balls[]`
  - **Remedy:** Enforce a maximum buffer limit (e.g. `if (this.balls.length > 50) this.balls.shift();`) or clear during reset.

---

## 6. 🔴 Core Engine Denominator Guards

- **File:** `src/core/InputRouter.ts` at Line **438**
  - **Code:** `this.touchSteer[pid] = (dx / dist) * norm;`
  - **Remedy:** Guard denominator with `|| 0.001` or `Math.max(0.001, dist)`.

- **File:** `src/core/InputRouter.ts` at Line **439**
  - **Code:** `this.touchThrottle[pid] = (-dy / dist) * norm; // upwards drag is forward throttle`
  - **Remedy:** Guard denominator with `|| 0.001` or `Math.max(0.001, dist)`.

---
*End of Master Bug Audit Specification. Auto-synced for all agents.*