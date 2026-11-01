/**
 * SpyHunter.js
 * Classic 1983 Top-Down High-Speed Highway Combat Driving — Retro Arcade Studio Edition.
 * Features:
 * - Dynamic Multi-Biome Terrain Engine:
 *     1. Pine Forest Highway (Emerald grass, moss, lush pine/oak foliage, rumble shoulders)
 *     2. Desert Canyon Highway (Red ochre sand dunes, sandstone cliffs, saguaro cacti, heat shimmer)
 *     3. Alpine Snow Pass (Snow-capped pines, frozen tundra, slick blue ice patches with drift physics)
 *     4. Coastal Causeway & Ocean Bridges (Deep water with surf waves, beach sand, palms, buoys)
 *     5. Metro Night Freeway (Industrial asphalt, concrete barriers, glowing street lamp posts)
 * - Multi-Tier Highway & Street Layouts:
 *     - 4-Lane High-Speed Super Expressway (halfWidth 260px, multi-divider passing lanes)
 *     - Standard 3-Lane Highway with dynamic sweeping curves
 *     - Narrow Mountain / City Alley Chokepoints (halfWidth 125px, yellow/black hazard guardrails)
 *     - Deep River & Ocean Bridges (fatal water plunge hazard)
 * - Full Aerial Combat Chopper Overhaul ("The Chopper Actually Does Stuff"):
 *     - Dynamic ground shadow with altitude scaling & banking roll angles
 *     - High-intensity searchlight with targeting laser reticle lock
 *     - Gatling Gun Strafe Runs: Chopper dives low and sprays 20mm tracer rounds at player's car
 *     - Carpet Bomb Runs: Rushes ahead and drops sticks of cluster bombs with converging shadows
 *     - Bomb impact physics: Explosive blast fireballs that destroy player and enemy traffic & leave craters
 *     - Shootable by ground machine guns when low (altitude < 50) and roof missiles at any altitude
 *     - Mid-air catastrophic kill sequence with spinning tail boom, trailing smoke, and ground crash detonation
 * - Strict Civilian Protection: Point deductions (-500 pts) and score freeze for harming civilians
 * - Weapons Van Docking & Center-Screen Auto-Align: Re-arms vehicle and smoothly centers player back to the middle of the road
 * - Diverse Enemy Roster:
 *     1. Combat Chopper (Aerial boss adversary with strafe runs and cluster bombs)
 *     2. Mad Bomber Motorcyclist (Agile weaving bike)
 *     3. Innocent Civilian Commuter Scooter (Scooter commuter to protect)
 *     4. The Barrel Dumper (Armored half-track rolling explosive barrels onto the asphalt)
 *     5. The Switchblade (Orange coupe with extending tire slashers)
 *     6. The Enforcer (Purple limo with window gunner)
 *     7. The Road Lord (Bulletproof front rammer)
 *     8. Civilian Sedan (Blue commuter car)
 *     9. Red Weapons Van (Docking re-arming trailer)
 * - Dual front Machine Guns, Rear Oil Slicks, Smoke Screens & Van Roof Missiles
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

export class SpyHunter {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'spyhunter';
    this.title = 'Spy Hunter';
    this.width = 960;
    this.height = 540;

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.roadSegments = [];
    this.scenery = [];
    this.player = null;
    this.bullets = [];
    this.fallingBombs = []; // Chopper aerial bombs whistling down to ground
    this.hazards = []; // Oil slicks, smoke screens, explosive barrels & bomb craters
    this.vehicles = []; // Enemies, civilians, helicopter, and Weapons Van
    this.particles = [];
    this.popups = [];

    this.distance = 0;
    this.currentBiome = 'FOREST';
    this.currentRoadType = 'HIGHWAY';
    this.noPointsTimer = 0;
    this.vanSpawnTimer = 0;
    this.copterSpawnTimer = 0;
    this.spawnTimer = 0;
    this.themeStep = 0;
    this.themeTimer = 0;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.state = 'PLAYING';

    this.distance = 0;
    this.currentBiome = 'FOREST';
    this.currentRoadType = 'HIGHWAY';
    this.noPointsTimer = 0;
    this.vanSpawnTimer = 16;
    this.copterSpawnTimer = 22;
    this.spawnTimer = 1.2;

    this.bullets = [];
    this.fallingBombs = [];
    this.hazards = [];
    this.vehicles = [];
    this.particles = [];
    this.popups = [];

    this._initRoad();
    this._resetPlayer();
  }

  setState(state) {
    this.state = state;
    if (state === 'GAMEOVER') {
      HighScoreStore.submit(this.id, this.score);
    }
  }

  destroy() {
    if (this.audio) {
      this.audio.stopSequence();
    }
  }

  _addScore(pts, x = null, y = null, color = PALETTE.GOLD, label = null) {
    // If penalty points are being deducted, always subtract regardless of noPointsTimer
    if (pts < 0) {
      this.score = Math.max(0, this.score + pts);
    } else {
      if (this.noPointsTimer > 0) return;
      this.score = Math.max(0, this.score + pts);
      if (this.score > this.highScore) {
        this.highScore = this.score;
        HighScoreStore.submit(this.id, this.score);
      }
    }

    if (x !== null && y !== null) {
      this.popups.push({
        x,
        y,
        text: label || (pts >= 0 ? `+${pts}` : `${pts}`),
        color,
        life: 1.2
      });
    }
  }

  _getBiomeAtDistance(dist) {
    const cycle = Math.floor(dist) % 35000;
    if (cycle < 7000) return 'FOREST';
    if (cycle < 14000) return 'DESERT';
    if (cycle < 21000) return 'SNOW';
    if (cycle < 28000) return 'COASTAL';
    return 'CITY';
  }

  _getRoadProfile(dist) {
    const subDist = Math.floor(dist) % 7000;
    if (subDist < 2200) {
      return { type: 'SUPER_HIGHWAY', targetWidth: 260, isBridge: false, name: 'EXPRESSWAY' };
    }
    if (subDist < 4400) {
      return { type: 'HIGHWAY', targetWidth: 195, isBridge: false, name: 'HIGHWAY' };
    }
    if (subDist < 5800) {
      return { type: 'NARROW_STREET', targetWidth: 125, isBridge: false, name: 'NARROW CHOKEPOINT' };
    }
    return { type: 'BRIDGE', targetWidth: 125, isBridge: true, name: 'BRIDGE' };
  }

  _createScenery(y, biome) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const road = this._getRoadAtY(y);
    const x = road.centerX + side * (road.halfWidth + 40 + Math.random() * 140);
    let type = 'tree';
    let size = 16 + Math.random() * 10;

    if (biome === 'DESERT') {
      type = Math.random() < 0.6 ? 'cactus' : 'rock';
      size = 14 + Math.random() * 12;
    } else if (biome === 'SNOW') {
      type = Math.random() < 0.7 ? 'snow_pine' : 'ice_rock';
      size = 15 + Math.random() * 11;
    } else if (biome === 'COASTAL') {
      type = Math.random() < 0.75 ? 'palm' : 'buoy';
      size = 18 + Math.random() * 12;
    } else if (biome === 'CITY') {
      type = Math.random() < 0.65 ? 'street_lamp' : 'barrier';
      size = 14 + Math.random() * 8;
    }

    return { x, y, type, size, biome };
  }

  _initRoad() {
    this.roadSegments = [];
    for (let y = 0; y <= this.height + 60; y += 20) {
      this.roadSegments.push({
        y,
        centerX: this.width / 2,
        halfWidth: 195,
        isBridge: false,
        roadType: 'HIGHWAY',
        hasIce: false,
        biome: 'FOREST'
      });
    }
    this.scenery = [];
    for (let i = 0; i < 22; i++) {
      this.scenery.push(this._createScenery(Math.random() * this.height, 'FOREST'));
    }
  }

  _resetPlayer() {
    const roadCenter = this._getRoadAtY(420).centerX;
    this.player = {
      x: roadCenter,
      y: 420,
      w: 28,
      h: 48,
      vx: 0,
      speed: 380,
      oilAmmo: 6,
      smokeAmmo: 6,
      missileAmmo: 0,
      specialMode: 'OIL',
      gunCooldown: 0,
      specialCooldown: 0,
      invulnTimer: 2.2,
      dockedVan: null,
      dockTimer: 0
    };
  }

  _getRoadAtY(y) {
    let closest = this.roadSegments[0];
    let minDiff = Infinity;
    for (const seg of this.roadSegments) {
      const diff = Math.abs(seg.y - y);
      if (diff < minDiff) {
        minDiff = diff;
        closest = seg;
      }
    }
    return closest || { centerX: this.width / 2, halfWidth: 195, isBridge: false, roadType: 'HIGHWAY', hasIce: false };
  }

  _spawnParticles(x, y, color, count = 12, speed = 150) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        color,
        size: 3 + Math.random() * 3,
        life: 0.4 + Math.random() * 0.3
      });
    }
  }

  _spawnVehicle() {
    const topRoad = this._getRoadAtY(40);
    const laneOffset = (Math.floor(Math.random() * 3) - 1) * (topRoad.halfWidth * 0.45);
    const x = topRoad.centerX + laneOffset;

    const roll = Math.random();
    if (roll < 0.18) {
      // Innocent Civilian Sedan
      this.vehicles.push({
        type: 'civilian',
        x,
        y: -45,
        w: 26,
        h: 44,
        vx: 0,
        speed: 220 + Math.random() * 45,
        hp: 1,
        color: PALETTE.BLUE,
        spinning: false,
        spinAngle: 0
      });
    } else if (roll < 0.30) {
      // Innocent Civilian Commuter Motorcycle / Scooter (Protect!)
      this.vehicles.push({
        type: 'civilian_cycle',
        x,
        y: -40,
        w: 14,
        h: 30,
        vx: 0,
        speed: 230 + Math.random() * 40,
        hp: 1,
        color: PALETTE.CYAN,
        spinning: false,
        spinAngle: 0
      });
    } else if (roll < 0.48) {
      // Mad Bomber Motorcyclist (Agile, fast, weaving bike with leather rider)
      this.vehicles.push({
        type: 'motorcycle',
        x,
        y: -40,
        w: 16,
        h: 32,
        vx: 0,
        speed: 360 + this.level * 15,
        hp: 1,
        color: PALETTE.RED,
        shootTimer: 2.0,
        weaveTimer: Math.random() * Math.PI * 2,
        spinning: false,
        spinAngle: 0
      });
    } else if (roll < 0.65) {
      // Switchblade (Tire Slasher - sharp blades extend from rims)
      this.vehicles.push({
        type: 'switchblade',
        x,
        y: -40,
        w: 30,
        h: 46,
        vx: 0,
        speed: 310 + this.level * 14,
        hp: 3,
        color: PALETTE.ORANGE,
        spinning: false,
        spinAngle: 0,
        slasherOut: true
      });
    } else if (roll < 0.80) {
      // Enforcer (Pursuing Limo that spawns from behind or ahead and fires guns)
      const fromBehind = Math.random() < 0.45;
      const spawnY = fromBehind ? this.height + 40 : -40;
      const spawnRoad = this._getRoadAtY(fromBehind ? this.height - 20 : 40);
      this.vehicles.push({
        type: 'enforcer',
        x: spawnRoad.centerX + laneOffset,
        y: spawnY,
        w: 28,
        h: 50,
        vx: 0,
        speed: fromBehind ? 460 : 290,
        hp: 4,
        color: PALETTE.PURPLE,
        shootTimer: 1.4,
        spinning: false,
        spinAngle: 0
      });
    } else if (roll < 0.90) {
      // Road Lord (Bulletproof front armor - ram off road or oil slick)
      this.vehicles.push({
        type: 'roadlord',
        x,
        y: -40,
        w: 34,
        h: 52,
        vx: 0,
        speed: 330,
        hp: 10,
        color: '#94A3B8',
        spinning: false,
        spinAngle: 0
      });
    } else {
      // The Barrel Dumper (Armored truck rolling explosive fuel barrels onto the highway)
      this.vehicles.push({
        type: 'barreldumper',
        x,
        y: -50,
        w: 32,
        h: 54,
        vx: 0,
        speed: 300,
        hp: 5,
        color: '#15803D',
        barrelTimer: 2.2,
        spinning: false,
        spinAngle: 0
      });
    }
  }

  _spawnHelicopter() {
    const topRoad = this._getRoadAtY(40);
    this.vehicles.push({
      type: 'helicopter',
      x: topRoad.centerX,
      y: -95,
      w: 48,
      h: 64,
      vx: 0,
      speed: 280,
      hp: 5,
      maxHp: 5,
      color: '#334155',
      rotorAngle: 0,
      altitude: 80,
      targetAltitude: 80,
      rollAngle: 0,
      state: 'CRUISE', // 'CRUISE' | 'STRAFE' | 'CARPET_BOMB' | 'EVADE' | 'CRASHING'
      stateTimer: 3.5,
      strafeShotsLeft: 0,
      strafeFireTimer: 0,
      bombsLeft: 0,
      bombDropTimer: 0,
      searchlightAngle: 0,
      targetLocked: false,
      smokeTimer: 0,
      spinning: false,
      spinAngle: 0
    });

    this.popups.push({
      x: this.width / 2,
      y: 90,
      text: '⚠️ WARNING: COMBAT CHOPPER AIR STRIKE INCOMING!',
      color: PALETTE.RED,
      life: 2.8
    });
    this.audio.playLaser(320, 90, 0.35);
  }

  _spawnWeaponsVan() {
    const topRoad = this._getRoadAtY(40);
    this.vehicles.push({
      type: 'weaponsvan',
      x: topRoad.centerX - 75,
      y: -75,
      w: 44,
      h: 82,
      vx: 0,
      speed: 270,
      hp: 999,
      color: PALETTE.RED,
      spinning: false,
      spinAngle: 0,
      used: false
    });
    this.popups.push({
      x: this.width / 2,
      y: 95,
      text: 'WEAPONS VAN AHEAD! ENTER REAR RAMP!',
      color: PALETTE.GREEN,
      life: 2.4
    });
    this.audio.playPowerUp();
  }

  _updateHelicopter(v, dt, p) {
    v.rotorAngle += 42 * dt;
    v.stateTimer -= dt;

    // Handle Crashing Animation
    if (v.state === 'CRASHING') {
      v.spinAngle += 24 * dt;
      v.altitude = Math.max(0, v.altitude - 60 * dt);
      v.y += (p.speed - 120) * dt;
      v.x += (v.vx || 0) * dt;

      // Trailing smoke and fire
      if (Math.random() < 0.6) {
        this.particles.push({
          x: v.x + (Math.random() - 0.5) * 16,
          y: v.y + (Math.random() - 0.5) * 16,
          vx: (Math.random() - 0.5) * 80,
          vy: 80 + Math.random() * 80,
          color: Math.random() < 0.5 ? PALETTE.ORANGE : '#475569',
          size: 4 + Math.random() * 5,
          life: 0.5
        });
      }

      if (v.altitude <= 0 || v.y > this.height + 60) {
        // Slam into the highway! Ground impact detonation!
        this.audio.playExplosion(0.45, 1200);
        this.renderer.shake(14, 0.35);
        this._spawnParticles(v.x, v.y, PALETTE.GOLD, 25, 220);
        this._spawnParticles(v.x, v.y, PALETTE.RED, 18, 180);
        this.hazards.push({
          type: 'CRATER',
          x: v.x,
          y: v.y,
          r: 28,
          life: 6.0
        });
        return true; // remove chopper
      }
      return false;
    }

    // Altitude lerp
    v.altitude += (v.targetAltitude - v.altitude) * 3.5 * dt;

    // Relative vertical position
    const relVy = p.speed - v.speed;
    v.y += relVy * dt;

    // Target lock check
    const distToPlayerX = p.x - v.x;
    v.targetLocked = Math.abs(distToPlayerX) < 50 && v.y < p.y && v.y > p.y - 340;

    // Banking visual angle
    v.rollAngle = (v.vx / 220) * 0.28;

    // Chopper Tactical State Machine
    switch (v.state) {
      case 'CRUISE':
        v.targetAltitude = 75;
        v.speed = p.speed * 0.95;
        v.vx = distToPlayerX * 1.6;
        v.x += v.vx * dt;

        if (v.stateTimer <= 0) {
          const nextAction = Math.random() < 0.55 ? 'STRAFE' : 'CARPET_BOMB';
          v.state = nextAction;
          if (nextAction === 'STRAFE') {
            v.stateTimer = 4.0;
            v.targetAltitude = 24; // Dive low for strafe run!
            v.strafeShotsLeft = 8;
            v.strafeFireTimer = 0.35;
            this.popups.push({
              x: this.width / 2,
              y: 85,
              text: '⚠️ CHOPPER DIVING: GATLING STRAFE RUN!',
              color: PALETTE.RED,
              life: 2.0
            });
            this.audio.playLaser(600, 200, 0.2);
          } else {
            v.stateTimer = 4.5;
            v.targetAltitude = 65;
            v.speed = p.speed + 140; // Rush ahead of player to drop cluster bombs!
            v.bombsLeft = 4;
            v.bombDropTimer = 0.45;
            this.popups.push({
              x: this.width / 2,
              y: 85,
              text: '⚠️ CLUSTER BOMBS INCOMING AHEAD!',
              color: PALETTE.ORANGE,
              life: 2.2
            });
            this.audio.playExplosion(0.2, 700);
          }
        }
        break;

      case 'STRAFE':
        // Dive low right above player and spray machine gun tracer bullets
        v.targetAltitude = 24;
        v.speed = p.speed * 0.92;
        v.vx = distToPlayerX * 2.8;
        v.x += v.vx * dt;

        v.strafeFireTimer -= dt;
        if (v.strafeShotsLeft > 0 && v.strafeFireTimer <= 0 && v.y < p.y) {
          v.strafeFireTimer = 0.14;
          v.strafeShotsLeft--;

          const spread = (Math.random() - 0.5) * 22;
          this.bullets.push(
            { x: v.x - 14, y: v.y + 24, vy: 480 + p.speed * 0.4, vx: spread, enemyShot: true },
            { x: v.x + 14, y: v.y + 24, vy: 480 + p.speed * 0.4, vx: -spread, enemyShot: true }
          );
          this.audio.playLaser(720, 220, 0.07);
          this._spawnParticles(v.x - 14, v.y + 24, PALETTE.GOLD, 3, 90);
          this._spawnParticles(v.x + 14, v.y + 24, PALETTE.GOLD, 3, 90);
        }

        if (v.stateTimer <= 0 || v.strafeShotsLeft <= 0) {
          v.state = 'EVADE';
          v.stateTimer = 2.8;
          v.targetAltitude = 85;
          v.speed = p.speed + 160;
          v.vx = (Math.random() < 0.5 ? -1 : 1) * 180;
        }
        break;

      case 'CARPET_BOMB':
        // Rushing ahead and dropping 4 cluster bombs across the road
        v.targetAltitude = 65;
        v.speed = p.speed + 160;
        v.x += (this._getRoadAtY(v.y).centerX - v.x) * 2.2 * dt;

        v.bombDropTimer -= dt;
        if (v.bombsLeft > 0 && v.bombDropTimer <= 0) {
          v.bombDropTimer = 0.42;
          v.bombsLeft--;

          const laneSpread = (v.bombsLeft % 3 - 1) * 65;
          const targetX = v.x + laneSpread;
          this.fallingBombs.push({
            x: v.x,
            y: v.y + 15,
            targetX,
            targetY: v.y + 120 + (4 - v.bombsLeft) * 35,
            altitude: v.altitude,
            vz: -110,
            radius: 10
          });
          this.audio.playPop();
        }

        if (v.stateTimer <= 0 || (v.bombsLeft <= 0 && v.y < -60)) {
          v.state = 'EVADE';
          v.stateTimer = 2.5;
          v.targetAltitude = 80;
          v.speed = p.speed * 0.85;
        }
        break;

      case 'EVADE':
        v.targetAltitude = 85;
        v.x += v.vx * dt;
        if (v.stateTimer <= 0) {
          v.state = 'CRUISE';
          v.stateTimer = 3.5;
        }
        break;
    }

    return false;
  }

  _updateFallingBombs(dt, p) {
    for (let i = this.fallingBombs.length - 1; i >= 0; i--) {
      const b = this.fallingBombs[i];
      b.altitude -= 140 * dt;
      b.x += (b.targetX - b.x) * 4 * dt;
      b.y += (p.speed * 0.5) * dt;
      b.targetY += (p.speed * 0.5) * dt;

      if (b.altitude <= 0) {
        // Ground detonation!
        this.audio.playExplosion(0.38, 1050);
        this.renderer.shake(10, 0.28);
        this._spawnParticles(b.targetX, b.targetY, PALETTE.GOLD, 20, 220);
        this._spawnParticles(b.targetX, b.targetY, PALETTE.ORANGE, 16, 170);
        this._spawnParticles(b.targetX, b.targetY, PALETTE.RED, 12, 120);

        // Blast radius check: destroys player if caught
        const blastRadius = 42;
        if (!p.dockedVan && p.invulnTimer <= 0) {
          if (Math.hypot(p.x - b.targetX, p.y - b.targetY) < blastRadius) {
            this._destroyPlayer();
            this.fallingBombs.splice(i, 1);
            return;
          }
        }

        // Blast also destroys any enemy cars caught in explosion!
        for (let j = this.vehicles.length - 1; j >= 0; j--) {
          const v = this.vehicles[j];
          if (v.type === 'helicopter' || v.type === 'weaponsvan') continue;
          if (Math.hypot(v.x - b.targetX, v.y - b.targetY) < blastRadius + v.w / 2) {
            this._destroyVehicle(j);
          }
        }

        // Leaves a burning crater on the road
        this.hazards.push({
          type: 'CRATER',
          x: b.targetX,
          y: b.targetY,
          r: 24,
          life: 5.5
        });

        this.fallingBombs.splice(i, 1);
      }
    }
  }

  update(dt) {
    if (this.state === 'MENU') {
      if (
        this.input.isJustPressed('actionA') ||
        this.input.isJustPressed('actionB') ||
        (this.input.pointer && this.input.pointer.justPressed)
      ) {
        this.audio.playMenuSelect();
        this.reset();
        this.setState('PLAYING');
      }
      return;
    }

    if (this.state === 'PAUSED') {
      if (this.input.isJustPressed('pause') || this.input.isJustPressed('actionA')) {
        this.audio.playMenuSelect();
        this.setState('PLAYING');
      }
      return;
    }

    if (this.state === 'GAMEOVER') {
      if (
        this.input.isJustPressed('actionA') ||
        this.input.isJustPressed('actionB') ||
        (this.input.pointer && this.input.pointer.justPressed)
      ) {
        this.audio.playMenuSelect();
        this.reset();
        this.setState('PLAYING');
      }
      return;
    }

    if (this.input.isJustPressed('pause')) {
      this.audio.playMenuMove();
      this.setState('PAUSED');
      return;
    }

    const p = this.player;
    if (p.invulnTimer > 0) p.invulnTimer -= dt;
    if (p.gunCooldown > 0) p.gunCooldown -= dt;
    if (p.specialCooldown > 0) p.specialCooldown -= dt;
    if (this.noPointsTimer > 0) this.noPointsTimer -= dt;

    // Synthesize iconic Peter Gunn style driving bassline
    this.themeTimer -= dt;
    if (this.themeTimer <= 0) {
      const bassNotes = [110, 110, 123.47, 110, 130.81, 110, 146.83, 138.59];
      this.audio.playNote(bassNotes[this.themeStep % bassNotes.length], 0.11, 'triangle', 0.14);
      this.themeStep++;
      this.themeTimer = 0.22;
    }

    // -------------------------------------------------------------
    // WEAPONS VAN DOCKING & CENTER-OF-SCREEN TRANSITION
    // -------------------------------------------------------------
    if (p.dockedVan) {
      p.dockTimer -= dt;
      const vRoad = this._getRoadAtY(p.dockedVan.y);

      // Smoothly steer the van and docked player toward the middle of the road
      p.dockedVan.x += (vRoad.centerX - p.dockedVan.x) * 4.2 * dt;
      p.x = p.dockedVan.x;
      p.y = p.dockedVan.y + 18;
      p.speed = p.dockedVan.speed;

      if (p.dockTimer <= 0) {
        p.oilAmmo = 8;
        p.smokeAmmo = 8;
        p.missileAmmo = 10;
        p.invulnTimer = 2.5;
        p.dockedVan.used = true;
        p.dockedVan.speed = 180;
        p.speed = 480;

        // Eject out of the van squarely down the CENTER of the road!
        p.x = vRoad.centerX;
        p.y = p.dockedVan.y - 55;
        p.dockedVan = null;

        this.audio.playStageClear();
        this._addScore(1500, p.x, p.y, PALETTE.GREEN, 'SYSTEMS UPGRADED +1500');
        this.popups.push({
          x: this.width / 2,
          y: 85,
          text: 'CENTER LANE ACQUIRED — FULL POWER!',
          color: PALETTE.CYAN,
          life: 1.6
        });
      }
    } else {
      if (this.input.isDown('up')) {
        p.speed = Math.min(580, p.speed + 260 * dt);
      } else if (this.input.isDown('down')) {
        p.speed = Math.max(210, p.speed - 320 * dt);
      } else {
        p.speed += (390 - p.speed) * 2 * dt;
      }

      // Steering with ice drift traction check
      const curRoad = this._getRoadAtY(p.y);
      const onIce = curRoad.hasIce;
      const steerSpeed = onIce ? 260 : 315;

      if (this.input.isDown('left')) {
        p.vx = -steerSpeed;
      } else if (this.input.isDown('right')) {
        p.vx = steerSpeed;
      } else {
        p.vx *= onIce ? Math.pow(0.85, dt) : Math.pow(0.0005, dt);
      }
      p.x += p.vx * dt;

      if (onIce && Math.random() < 0.35) {
        this._spawnParticles(p.x + (Math.random() - 0.5) * 16, p.y + 20, PALETTE.CYAN, 2, 70);
      }
    }

    // Advance Infinite Highway Distance & Escalating Level Milestones
    const deltaDist = p.speed * dt;
    this.distance += deltaDist;
    this.level = 1 + Math.floor(this.distance / 8500);
    if (this.noPointsTimer <= 0) {
      this._addScore(deltaDist * 0.08);
    }

    // Biome Transition Popups
    const newBiome = this._getBiomeAtDistance(this.distance);
    if (newBiome !== this.currentBiome) {
      this.currentBiome = newBiome;
      const biomeLabels = {
        FOREST: '🌲 ENTERING PINE FOREST HIGHWAY',
        DESERT: '🏜️ ENTERING DESERT CANYON HIGHWAY',
        SNOW: '❄️ ENTERING ICY ALPINE PASS (SLICK ICE!)',
        COASTAL: '🌊 ENTERING COASTAL CAUSEWAY & BRIDGES',
        CITY: '🏙️ ENTERING METRO FREEWAY & ALLEYWAYS'
      };
      this.popups.push({
        x: this.width / 2,
        y: 85,
        text: biomeLabels[newBiome] || `ENTERING ${newBiome}`,
        color: PALETTE.GOLD,
        life: 2.8
      });
      this.audio.playPowerUp();
    }

    // Road Profile Popups (Super Highway vs Narrow Chokepoint)
    const curProfile = this._getRoadProfile(this.distance);
    if (curProfile.type !== this.currentRoadType) {
      this.currentRoadType = curProfile.type;
      if (curProfile.type === 'NARROW_STREET') {
        this.popups.push({
          x: this.width / 2,
          y: 110,
          text: '⚠️ CAUTION: NARROW CHOKEPOINT AHEAD!',
          color: PALETTE.ORANGE,
          life: 2.0
        });
      } else if (curProfile.type === 'SUPER_HIGHWAY') {
        this.popups.push({
          x: this.width / 2,
          y: 110,
          text: '⚡ 4-LANE EXPRESSWAY — ACCELERATE!',
          color: PALETTE.CYAN,
          life: 1.8
        });
      }
    }

    // Scroll Road Segments with dynamic width interpolation & curve math
    for (let i = 0; i < this.roadSegments.length; i++) {
      const seg = this.roadSegments[i];
      seg.y += deltaDist;
      if (seg.y > this.height + 40) {
        seg.y -= this.height + 80;
        const profile = this._getRoadProfile(this.distance);
        const biome = this._getBiomeAtDistance(this.distance);

        const curvePhase = this.distance * 0.00085;
        const curveOffset =
          Math.sin(curvePhase) * (110 + Math.min(50, this.level * 6)) +
          Math.cos(curvePhase * 0.47) * 55;
        seg.centerX = this.width / 2 + curveOffset;

        // Smooth width interpolation toward target profile
        const prevSeg = this.roadSegments[(i - 1 + this.roadSegments.length) % this.roadSegments.length];
        const targetW = profile.targetWidth;
        seg.halfWidth = prevSeg ? prevSeg.halfWidth + (targetW - prevSeg.halfWidth) * 0.15 : targetW;
        seg.isBridge = profile.isBridge;
        seg.roadType = profile.type;
        seg.biome = biome;
        seg.hasIce = biome === 'SNOW' && Math.sin(this.distance * 0.005) > 0.55 && !seg.isBridge;
      }
    }

    // Scroll Roadside Scenery
    for (const sc of this.scenery) {
      sc.y += deltaDist;
      if (sc.y > this.height + 35) {
        sc.y = -25;
        const topSeg = this._getRoadAtY(0);
        const side = Math.random() < 0.5 ? -1 : 1;
        sc.x = topSeg.centerX + side * (topSeg.halfWidth + 45 + Math.random() * 130);
        sc.biome = this.currentBiome;

        if (sc.biome === 'DESERT') {
          sc.type = Math.random() < 0.6 ? 'cactus' : 'rock';
          sc.size = 14 + Math.random() * 12;
        } else if (sc.biome === 'SNOW') {
          sc.type = Math.random() < 0.7 ? 'snow_pine' : 'ice_rock';
          sc.size = 15 + Math.random() * 11;
        } else if (sc.biome === 'COASTAL') {
          sc.type = Math.random() < 0.75 ? 'palm' : 'buoy';
          sc.size = 18 + Math.random() * 12;
        } else if (sc.biome === 'CITY') {
          sc.type = Math.random() < 0.65 ? 'street_lamp' : 'barrier';
          sc.size = 14 + Math.random() * 8;
        } else {
          sc.type = 'tree';
          sc.size = 16 + Math.random() * 10;
        }
      }
    }

    // Check Player Road Bounds & Narrow Street Collisions
    const playerRoad = this._getRoadAtY(p.y);
    const distFromCenter = Math.abs(p.x - playerRoad.centerX);
    if (!p.dockedVan && distFromCenter > playerRoad.halfWidth - 8) {
      if (playerRoad.isBridge && distFromCenter > playerRoad.halfWidth + 8) {
        // Plunged off bridge into water!
        this._destroyPlayer();
        return;
      }

      if (playerRoad.roadType === 'NARROW_STREET') {
        // Steel guardrail collision in narrow streets!
        p.speed = Math.max(180, p.speed - 360 * dt);
        p.vx = -Math.sign(p.x - playerRoad.centerX) * 180;
        this.renderer.shake(5, 0.09);
        this.audio.playShove();
        this._spawnParticles(p.x, p.y, PALETTE.GOLD, 4, 120);
        p.x = Math.max(
          playerRoad.centerX - playerRoad.halfWidth + 10,
          Math.min(playerRoad.centerX + playerRoad.halfWidth - 10, p.x)
        );
      } else {
        // Standard off-road shoulder slowdown and vibration
        p.speed = Math.max(220, p.speed - 240 * dt);
        this.renderer.shake(3, 0.06);
        if (Math.random() < 0.4) {
          const dustCol =
            this.currentBiome === 'DESERT'
              ? '#B45309'
              : this.currentBiome === 'SNOW'
              ? '#E2E8F0'
              : PALETTE.GOLD;
          this._spawnParticles(p.x, p.y + 20, dustCol, 2, 60);
        }
        p.x = Math.max(
          playerRoad.centerX - playerRoad.halfWidth - 28,
          Math.min(playerRoad.centerX + playerRoad.halfWidth + 28, p.x)
        );
      }
    }

    // Action A: Dual Front Machine Guns (+ Van Roof Missiles if upgraded)
    if (!p.dockedVan && this.input.isDown('actionA') && p.gunCooldown <= 0) {
      p.gunCooldown = 0.095;
      this.audio.playLaser(880, 260, 0.06);
      this.bullets.push(
        { x: p.x - 9, y: p.y - 24, vy: -760, damage: 1, isMissile: false },
        { x: p.x + 9, y: p.y - 24, vy: -760, damage: 1, isMissile: false }
      );
      if (p.missileAmmo > 0) {
        p.missileAmmo--;
        this.bullets.push({
          x: p.x,
          y: p.y - 28,
          vy: -650,
          damage: 4,
          isMissile: true
        });
      }
    }

    // Action B: Deploy Oil Slick & Smoke Screen Behind Car
    if (!p.dockedVan && this.input.isJustPressed('actionB') && p.specialCooldown <= 0) {
      if (p.oilAmmo > 0 || p.smokeAmmo > 0) {
        p.specialCooldown = 0.28;
        const useSmoke = p.specialMode === 'SMOKE' && p.smokeAmmo > 0;
        if (useSmoke) {
          p.smokeAmmo--;
          p.specialMode = p.oilAmmo > 0 ? 'OIL' : 'SMOKE';
          this.hazards.push({
            type: 'SMOKE',
            x: p.x,
            y: p.y + 34,
            r: 36,
            life: 3.5
          });
          this.audio.playExplosion(0.22, 650);
        } else if (p.oilAmmo > 0) {
          p.oilAmmo--;
          p.specialMode = p.smokeAmmo > 0 ? 'SMOKE' : 'OIL';
          this.hazards.push({
            type: 'OIL',
            x: p.x,
            y: p.y + 30,
            r: 22,
            life: 4.0
          });
          this.audio.playDig();
        }
      }
    }

    // Update Falling Aerial Bombs
    this._updateFallingBombs(dt, p);

    // Update Bullets & Missiles
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y += b.vy * dt;
      if (b.vx) b.x += b.vx * dt;

      if (b.y < 35 || b.y > this.height) {
        this.bullets.splice(i, 1);
        continue;
      }

      if (b.enemyShot) {
        if (
          !p.dockedVan &&
          p.invulnTimer <= 0 &&
          Math.abs(b.x - p.x) < 16 &&
          Math.abs(b.y - p.y) < 24
        ) {
          this.bullets.splice(i, 1);
          this._destroyPlayer();
          return;
        }
        continue;
      }

      // Check Player Bullet vs Vehicles (Ground & Air)
      for (let j = this.vehicles.length - 1; j >= 0; j--) {
        const v = this.vehicles[j];
        if (v.type === 'weaponsvan') continue;

        if (v.type === 'helicopter') {
          // Missiles can hit at any altitude; Machine gun bullets can hit when chopper dives low (altitude < 50)
          if (!b.isMissile && v.altitude > 48) {
            continue;
          }
        }

        if (
          Math.abs(b.x - v.x) < v.w / 2 + 8 &&
          Math.abs(b.y - v.y) < v.h / 2 + 8
        ) {
          this.bullets.splice(i, 1);
          if (v.type === 'roadlord' && !b.isMissile) {
            this.audio.playMenuMove();
            this._spawnParticles(b.x, b.y, PALETTE.CYAN, 4, 90);
          } else {
            v.hp -= b.damage;
            this._spawnParticles(b.x, b.y, PALETTE.ORANGE, 6, 110);
            if (v.type === 'helicopter' && v.hp <= 0 && v.state !== 'CRASHING') {
              this._destroyVehicle(j);
            } else if (v.hp <= 0 && v.type !== 'helicopter') {
              this._destroyVehicle(j);
            }
          }
          break;
        }
      }

      // Check Player Bullet vs Rolling Barrels
      for (let k = this.hazards.length - 1; k >= 0; k--) {
        const hz = this.hazards[k];
        if (hz.type === 'BARREL') {
          if (Math.hypot(b.x - hz.x, b.y - hz.y) < hz.r + 6) {
            this.bullets.splice(i, 1);
            this.audio.playExplosion(0.25, 900);
            this._spawnParticles(hz.x, hz.y, PALETTE.GOLD, 14, 150);
            this._addScore(150, hz.x, hz.y, PALETTE.GOLD, 'BARREL +150');
            this.hazards.splice(k, 1);
            break;
          }
        }
      }
    }

    // Update Rear Hazards (Oil Slicks, Smoke Screens, Barrels & Craters)
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.y += p.speed * 0.55 * dt;

      if (h.type === 'SMOKE') {
        h.r = Math.min(54, h.r + 18 * dt);
      }
      h.life -= dt;
      if (h.life <= 0 || h.y > this.height + 50) {
        this.hazards.splice(i, 1);
        continue;
      }

      // Check Player Collision with Explosive Barrels or Craters
      if (!p.dockedVan && p.invulnTimer <= 0) {
        if (h.type === 'BARREL' || h.type === 'CRATER') {
          if (Math.hypot(p.x - h.x, p.y - h.y) < h.r + 16) {
            this.hazards.splice(i, 1);
            this._destroyPlayer();
            return;
          }
        }
      }

      // Check Enemy Vehicles hitting Oil Slick or Smoke Screen!
      for (const v of this.vehicles) {
        if (v.type === 'weaponsvan' || v.type === 'helicopter' || v.spinning) continue;
        if (Math.hypot(v.x - h.x, v.y - h.y) < h.r + 16) {
          v.spinning = true;
          v.vx = (v.x >= h.x ? 1 : -1) * 280;
          this.audio.playPop();

          if (v.type === 'civilian' || v.type === 'civilian_cycle') {
            this._addScore(-500, v.x, v.y, PALETTE.RED, 'CIVILIAN CASUALTY -500!');
            this.noPointsTimer = 4.0;
          } else {
            this._addScore(600, v.x, v.y, PALETTE.CYAN, 'SPIN-OUT +600!');
          }
        }
      }
    }

    // Spawn Traffic & Enemies
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.vehicles.length < 7) {
      this._spawnVehicle();
      this.spawnTimer = Math.max(0.70, 1.55 - this.level * 0.08);
    }

    // Spawn Weapons Van periodically
    this.vanSpawnTimer -= dt;
    if (this.vanSpawnTimer <= 0) {
      this._spawnWeaponsVan();
      this.vanSpawnTimer = 22;
    }

    // Spawn Combat Chopper periodically
    this.copterSpawnTimer -= dt;
    const hasCopter = this.vehicles.some((v) => v.type === 'helicopter');
    if (this.copterSpawnTimer <= 0 && !hasCopter) {
      this._spawnHelicopter();
      this.copterSpawnTimer = 28;
    }

    // Update Vehicles & AI
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      const vRoad = this._getRoadAtY(v.y);

      if (v.type === 'helicopter') {
        const removed = this._updateHelicopter(v, dt, p);
        if (removed) {
          this.vehicles.splice(i, 1);
          continue;
        }
      } else if (v.spinning) {
        v.spinAngle += 15 * dt;
        v.x += v.vx * dt;
        v.y += (p.speed - v.speed * 0.4) * dt;

        if (Math.abs(v.x - vRoad.centerX) > vRoad.halfWidth + 16) {
          this._destroyVehicle(i);
          continue;
        }
      } else {
        const relVy = p.speed - v.speed;
        v.y += relVy * dt;

        // Ground vehicle steering behaviors
        if (v.type === 'civilian' || v.type === 'civilian_cycle' || v.type === 'weaponsvan') {
          const targetX =
            v.type === 'weaponsvan' && !v.used
              ? vRoad.centerX - 75
              : vRoad.centerX;
          v.x += (targetX - v.x) * 2.5 * dt;
        } else if (v.type === 'motorcycle') {
          v.weaveTimer += 4.5 * dt;
          const targetLane = vRoad.centerX + Math.sin(v.weaveTimer) * 75;
          v.x += (targetLane - v.x) * 3.5 * dt;

          v.shootTimer -= dt;
          if (v.shootTimer <= 0 && Math.abs(v.x - p.x) < 45) {
            v.shootTimer = 2.2;
            this.bullets.push({
              x: v.x,
              y: v.y + 20,
              vy: 290,
              enemyShot: true
            });
            this.audio.playLaser(550, 180, 0.08);
          }
        } else if (v.type === 'barreldumper') {
          v.x += (vRoad.centerX - v.x) * 2.0 * dt;
          v.barrelTimer -= dt;
          if (v.barrelTimer <= 0) {
            v.barrelTimer = 2.5;
            this.hazards.push({
              type: 'BARREL',
              x: v.x,
              y: v.y + 34,
              r: 12,
              life: 5.0
            });
            this.audio.playPop();
          }
        } else {
          const dx = p.x - v.x;
          v.vx = Math.sign(dx) * Math.min(165, Math.abs(dx) * 2.2);
          v.x += v.vx * dt;

          // Enforcer Limo Gunner
          if (v.type === 'enforcer') {
            v.shootTimer -= dt;
            if (v.shootTimer <= 0 && Math.abs(v.x - p.x) < 60) {
              v.shootTimer = 1.6;
              this.bullets.push({
                x: v.x,
                y: v.y + (v.y < p.y ? 26 : -26),
                vy: v.y < p.y ? 260 : -520,
                enemyShot: true
              });
              this.audio.playLaser(420, 150, 0.08);
            }
          }
        }
      }

      // Remove off-screen vehicles
      if (v.y < -160 || v.y > this.height + 160) {
        this.vehicles.splice(i, 1);
        continue;
      }

      // Check Player Interaction with Ground Vehicles
      if (!p.dockedVan && v.type !== 'helicopter') {
        const dx = Math.abs(p.x - v.x);
        const dy = Math.abs(p.y - v.y);

        // Docking into Red Weapons Van Rear Ramp
        if (
          v.type === 'weaponsvan' &&
          !v.used &&
          dx < 28 &&
          p.y > v.y + 10 &&
          p.y < v.y + 66
        ) {
          p.dockedVan = v;
          p.dockTimer = 1.4;
          this.audio.playPowerUp();
          this.popups.push({
            x: this.width / 2,
            y: v.y,
            text: 'REARMING: RETURNING TO CENTER LANE...',
            color: PALETTE.GOLD,
            life: 1.2
          });
          continue;
        }

        // Vehicle-to-Vehicle Collision & Ramming
        if (dx < (p.w + v.w) * 0.48 && dy < (p.h + v.h) * 0.46) {
          const pushDir = p.x < v.x ? -1 : 1;
          p.x += pushDir * 18;
          v.x -= pushDir * 28;
          this.audio.playShove();
          this.renderer.shake(6, 0.15);
          this._spawnParticles((p.x + v.x) / 2, (p.y + v.y) / 2, PALETTE.GOLD, 8, 130);

          if (v.type === 'civilian' || v.type === 'civilian_cycle') {
            this._addScore(-150, p.x, p.y - 18, PALETTE.RED, 'CIVILIAN HIT -150!');
            this.audio.playHit();
          }

          if (v.type === 'switchblade' && p.invulnTimer <= 0 && dy < 22) {
            this._destroyPlayer();
            return;
          }

          if (Math.abs(v.x - vRoad.centerX) > vRoad.halfWidth - 6) {
            v.spinning = true;
            v.vx = -pushDir * 260;

            if (v.type === 'civilian' || v.type === 'civilian_cycle') {
              this._addScore(-500, v.x, v.y, PALETTE.RED, 'CIVILIAN OFF-ROAD -500!');
              this.noPointsTimer = 4.0;
              this.audio.playHit();
            } else {
              this._addScore(500, v.x, v.y, PALETTE.ORANGE, 'SIDESWIPE +500!');
            }
          }
        }
      }
    }

    // Update Particles & Popups
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 35 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  _destroyVehicle(index) {
    const v = this.vehicles[index];
    this.audio.playExplosion(0.35, 1100);
    this.renderer.shake(7, 0.18);
    this._spawnParticles(v.x, v.y, PALETTE.ORANGE, 20, 200);
    this._spawnParticles(v.x, v.y, PALETTE.RED, 12, 140);

    if (v.type === 'civilian' || v.type === 'civilian_cycle') {
      this._addScore(-500, v.x, v.y, PALETTE.RED, 'CIVILIAN DESTROYED -500!');
      this.noPointsTimer = 4.0;
      this.audio.playHit();
      this.popups.push({
        x: this.width / 2,
        y: 85,
        text: 'CIVILIAN CASUALTY: -500 PTS (SCORE FROZEN)',
        color: PALETTE.RED,
        life: 2.0
      });
      this.vehicles.splice(index, 1);
    } else if (v.type === 'helicopter') {
      // Trigger glorious spiraling crash sequence
      v.state = 'CRASHING';
      v.vx = (Math.random() - 0.5) * 160;
      this.audio.playStageClear();
      this._addScore(2000, v.x, v.y, PALETTE.GOLD, 'CHOPPER DOWN! +2000');
      this.popups.push({
        x: this.width / 2,
        y: 85,
        text: '💥 COMBAT CHOPPER CRIPPLED & SPIRALING DOWN!',
        color: PALETTE.GOLD,
        life: 2.2
      });
    } else if (v.type === 'motorcycle') {
      this._addScore(500, v.x, v.y, PALETTE.GOLD, 'BIKER DOWN +500');
      this.vehicles.splice(index, 1);
    } else {
      const pts = v.type === 'roadlord' ? 800 : v.type === 'barreldumper' ? 700 : 400;
      this._addScore(pts, v.x, v.y, PALETTE.GOLD);
      this.vehicles.splice(index, 1);
    }
  }

  _destroyPlayer() {
    this.audio.playExplosion(0.5, 900);
    this.renderer.shake(12, 0.35);
    this._spawnParticles(this.player.x, this.player.y, PALETTE.CYAN, 26, 240);
    this._spawnParticles(this.player.x, this.player.y, PALETTE.ORANGE, 18, 180);
    this.lives--;
    if (this.lives <= 0) {
      this.audio.playGameOver();
      this.setState('GAMEOVER');
    } else {
      this._resetPlayer();
    }
  }

  render(ctx = this.renderer.ctx) {
    const biome = this.currentBiome;

    // Biome Ground Color
    let groundColor = '#0D2818';
    if (biome === 'DESERT') groundColor = '#2E180E';
    else if (biome === 'SNOW') groundColor = '#131D31';
    else if (biome === 'COASTAL') groundColor = '#082042';
    else if (biome === 'CITY') groundColor = '#0B0F19';
    this.renderer.clear(groundColor);

    // Subtle animated coastal water surf waves
    if (biome === 'COASTAL') {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.lineWidth = 1.5;
      const waveT = performance.now() * 0.002;
      for (let wy = 0; wy < this.height; wy += 45) {
        ctx.beginPath();
        for (let wx = 0; wx < this.width; wx += 20) {
          const sy = wy + Math.sin(wx * 0.04 + waveT) * 4;
          if (wx === 0) ctx.moveTo(wx, sy);
          else ctx.lineTo(wx, sy);
        }
        ctx.stroke();
      }
    }

    // Render Scrolling Highway Strips
    const sortedSegs = [...this.roadSegments].sort((a, b) => a.y - b.y);
    for (let i = 0; i < sortedSegs.length; i++) {
      const seg = sortedSegs[i];
      const h = 22;

      if (seg.isBridge) {
        // Water beneath Bridge
        ctx.fillStyle = '#061C38';
        ctx.fillRect(0, seg.y, this.width, h);
        // Steel Bridge Guardrails
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(seg.centerX - seg.halfWidth - 8, seg.y, 8, h);
        ctx.fillRect(seg.centerX + seg.halfWidth, seg.y, 8, h);
        ctx.fillStyle = '#B45309';
        ctx.fillRect(seg.centerX - seg.halfWidth - 6, seg.y + 4, 4, h - 8);
        ctx.fillRect(seg.centerX + seg.halfWidth + 2, seg.y + 4, 4, h - 8);
      } else if (seg.roadType === 'NARROW_STREET') {
        // Narrow Street Striped Steel / Concrete Guardrails
        const stripeColor = Math.floor(seg.y / 24) % 2 === 0 ? PALETTE.GOLD : '#09090B';
        ctx.fillStyle = stripeColor;
        ctx.fillRect(seg.centerX - seg.halfWidth - 10, seg.y, 10, h);
        ctx.fillRect(seg.centerX + seg.halfWidth, seg.y, 10, h);
      } else {
        // Road Shoulder based on Biome
        let shoulderColor = i % 2 === 0 ? '#D97706' : '#78350F';
        if (biome === 'DESERT') {
          shoulderColor = i % 2 === 0 ? '#B45309' : '#92400E';
        } else if (biome === 'SNOW') {
          shoulderColor = i % 2 === 0 ? '#94A3B8' : '#64748B';
        } else if (biome === 'CITY') {
          shoulderColor = i % 2 === 0 ? '#475569' : '#334155';
        }
        ctx.fillStyle = shoulderColor;
        ctx.fillRect(seg.centerX - seg.halfWidth - 14, seg.y, 14, h);
        ctx.fillRect(seg.centerX + seg.halfWidth, seg.y, 14, h);
      }

      // Asphalt Surface (Color adapts to biome)
      ctx.fillStyle = biome === 'DESERT' ? '#334155' : biome === 'CITY' ? '#0F172A' : '#1E293B';
      ctx.fillRect(seg.centerX - seg.halfWidth, seg.y, seg.halfWidth * 2, h);

      // Slick Blue Ice Patch in Snow Biome!
      if (seg.hasIce) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.42)';
        ctx.fillRect(seg.centerX - seg.halfWidth + 12, seg.y, (seg.halfWidth - 12) * 2, h);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(seg.centerX - seg.halfWidth * 0.4, seg.y + 3, seg.halfWidth * 0.8, 3);
      }

      // Dynamic Lane Dividers adapting to road width:
      const dashVisible = Math.floor((seg.y + this.distance) / 40) % 2 === 0;
      if (seg.roadType === 'SUPER_HIGHWAY') {
        if (dashVisible) {
          ctx.fillStyle = 'rgba(248, 250, 252, 0.7)';
          ctx.fillRect(seg.centerX - seg.halfWidth * 0.5, seg.y, 4, 14);
          ctx.fillRect(seg.centerX, seg.y, 4, 14);
          ctx.fillRect(seg.centerX + seg.halfWidth * 0.5, seg.y, 4, 14);
        }
      } else if (seg.roadType === 'HIGHWAY') {
        if (dashVisible) {
          ctx.fillStyle = 'rgba(248, 250, 252, 0.7)';
          ctx.fillRect(seg.centerX - seg.halfWidth * 0.34, seg.y, 4, 14);
          ctx.fillRect(seg.centerX + seg.halfWidth * 0.34, seg.y, 4, 14);
        }
      } else {
        // Narrow Street / Bridge single center divider
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(seg.centerX - 2, seg.y, 4, h);
      }
    }

    // Roadside Scenery (Trees, Cacti, Snow Pines, Palms, Street Lamps)
    for (const sc of this.scenery) {
      const seg = this._getRoadAtY(sc.y);
      if (seg.isBridge && sc.type !== 'buoy') continue;
      if (Math.abs(sc.x - seg.centerX) < seg.halfWidth + 20) continue;

      if (sc.type === 'tree') {
        this.renderer.drawGlowCircle(sc.x, sc.y, sc.size, '#10B981', 6, true);
        ctx.fillStyle = '#047857';
        ctx.beginPath();
        ctx.arc(sc.x - 3, sc.y - 3, sc.size * 0.55, 0, Math.PI * 2);
        ctx.fill();
      } else if (sc.type === 'cactus') {
        ctx.fillStyle = '#15803D';
        ctx.fillRect(sc.x - 4, sc.y - sc.size, 8, sc.size * 2);
        ctx.fillRect(sc.x - 14, sc.y - sc.size * 0.4, 10, 4);
        ctx.fillRect(sc.x - 14, sc.y - sc.size * 0.8, 4, sc.size * 0.5);
        ctx.fillRect(sc.x + 4, sc.y - sc.size * 0.2, 10, 4);
        ctx.fillRect(sc.x + 10, sc.y - sc.size * 0.6, 4, sc.size * 0.5);
      } else if (sc.type === 'rock') {
        ctx.fillStyle = '#9A3412';
        ctx.beginPath();
        ctx.ellipse(sc.x, sc.y, sc.size, sc.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7C2D12';
        ctx.beginPath();
        ctx.ellipse(sc.x - 2, sc.y - 2, sc.size * 0.6, sc.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (sc.type === 'snow_pine') {
        ctx.fillStyle = '#064E3B';
        ctx.beginPath();
        ctx.moveTo(sc.x, sc.y - sc.size * 1.2);
        ctx.lineTo(sc.x + sc.size, sc.y + sc.size * 0.6);
        ctx.lineTo(sc.x - sc.size, sc.y + sc.size * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.moveTo(sc.x, sc.y - sc.size * 1.2);
        ctx.lineTo(sc.x + sc.size * 0.5, sc.y - sc.size * 0.4);
        ctx.lineTo(sc.x - sc.size * 0.5, sc.y - sc.size * 0.4);
        ctx.closePath();
        ctx.fill();
      } else if (sc.type === 'ice_rock') {
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.ellipse(sc.x, sc.y, sc.size, sc.size * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#BAE6FD';
        ctx.beginPath();
        ctx.ellipse(sc.x - 2, sc.y - 2, sc.size * 0.5, sc.size * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (sc.type === 'palm') {
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(sc.x, sc.y + sc.size);
        ctx.quadraticCurveTo(sc.x + 6, sc.y, sc.x + 12, sc.y - sc.size);
        ctx.stroke();
        ctx.fillStyle = '#10B981';
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
          ctx.beginPath();
          ctx.ellipse(sc.x + 12 + Math.cos(a) * 12, sc.y - sc.size + Math.sin(a) * 8, 14, 5, a, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (sc.type === 'buoy') {
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(sc.x - 6, sc.y - 2, 12, 4);
      } else if (sc.type === 'street_lamp') {
        ctx.fillStyle = '#475569';
        ctx.fillRect(sc.x - 2, sc.y - sc.size * 1.5, 4, sc.size * 1.5);
        ctx.fillRect(sc.x - 8, sc.y - sc.size * 1.5, 12, 3);
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(sc.x - 7, sc.y - sc.size * 1.5 + 3, 3.5, 0, Math.PI * 2);
        ctx.fill();
        const lGrad = ctx.createRadialGradient(sc.x - 7, sc.y, 5, sc.x - 7, sc.y, 35);
        lGrad.addColorStop(0, 'rgba(254, 240, 138, 0.22)');
        lGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
        ctx.fillStyle = lGrad;
        ctx.beginPath();
        ctx.ellipse(sc.x - 7, sc.y, 35, 18, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#64748B';
        ctx.fillRect(sc.x - 4, sc.y - 12, 8, 24);
        ctx.fillStyle = '#94A3B8';
        ctx.fillRect(sc.x - 3, sc.y - 10, 6, 4);
      }
    }

    // Oil Slicks, Smoke Screens, Barrels & Craters
    for (const h of this.hazards) {
      if (h.type === 'OIL') {
        ctx.fillStyle = '#09090B';
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, h.r, h.r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = PALETTE.PURPLE;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (h.type === 'SMOKE') {
        ctx.fillStyle = 'rgba(226, 232, 240, 0.55)';
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (h.type === 'BARREL') {
        this.renderer.drawGlowCircle(h.x, h.y, h.r, PALETTE.GOLD, 8, true);
        ctx.fillStyle = '#09090B';
        ctx.fillRect(h.x - 3, h.y - h.r, 6, h.r * 2);
      } else if (h.type === 'CRATER') {
        ctx.fillStyle = '#1C1917';
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, h.r, h.r * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        this.renderer.drawGlowCircle(h.x, h.y, h.r * 0.5, PALETTE.ORANGE, 10, true);
      }
    }

    // Render Falling Aerial Bombs
    for (const b of this.fallingBombs) {
      const shadowScale = Math.max(0.4, 1 - b.altitude / 80);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.ellipse(b.targetX, b.targetY, 14 * shadowScale, 7 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      if (b.altitude < 45) {
        ctx.strokeStyle = Math.floor(performance.now() / 60) % 2 === 0 ? PALETTE.RED : PALETTE.GOLD;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.targetX, b.targetY, 20 * shadowScale, 0, Math.PI * 2);
        ctx.stroke();
      }

      const bombDrawY = b.y - b.altitude * 0.55;
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(b.x - 4, bombDrawY - 8, 8, 16);
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(b.x - 3, bombDrawY + 4, 6, 4);
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(b.x - 2, bombDrawY - 9, 4, 3);
    }

    // Ground Vehicles & Combat Helicopter
    for (const v of this.vehicles) {
      ctx.save();
      ctx.translate(v.x, v.y);
      if (v.spinning) {
        ctx.rotate(v.spinAngle);
      }

      if (v.type === 'weaponsvan') {
        if (!v.used) {
          ctx.fillStyle = '#64748B';
          ctx.fillRect(-17, v.h / 2 - 4, 34, 24);
          ctx.fillStyle = '#94A3B8';
          ctx.fillRect(-13, v.h / 2 - 2, 26, 20);
          ctx.fillStyle = PALETTE.GREEN;
          ctx.fillRect(-15, v.h / 2 + 2, 3, 14);
          ctx.fillRect(12, v.h / 2 + 2, 3, 14);
        }
        ctx.fillStyle = '#09090B';
        ctx.fillRect(-v.w / 2 - 3, -v.h / 2 + 10, 4, 14);
        ctx.fillRect(v.w / 2 - 1, -v.h / 2 + 10, 4, 14);
        ctx.fillRect(-v.w / 2 - 3, v.h / 2 - 24, 4, 16);
        ctx.fillRect(v.w / 2 - 1, v.h / 2 - 24, 4, 16);

        this.renderer.drawGlowRect(-v.w / 2, -v.h / 2, v.w, v.h, PALETTE.RED, 10, true);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-v.w / 2 + 5, -v.h / 2 + 6, v.w - 10, 10);
        ctx.fillStyle = PALETTE.WHITE;
        ctx.fillRect(-9, -v.h / 2 + 20, 5, v.h - 26);
        ctx.fillRect(4, -v.h / 2 + 20, 5, v.h - 26);
      } else if (v.type === 'helicopter') {
        // Dynamic Ground Shadow below Chopper
        const shadowScale = Math.max(0.35, 1 - v.altitude / 100);
        ctx.save();
        ctx.translate(0, v.altitude * 0.45);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 26 * shadowScale, 14 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Searchlight Beam projecting from Chopper down to road
        if (v.state !== 'CRASHING') {
          const beamGrad = ctx.createRadialGradient(0, 110, 10, 0, 110, 75);
          beamGrad.addColorStop(0, v.targetLocked ? 'rgba(239, 68, 68, 0.42)' : 'rgba(254, 240, 138, 0.22)');
          beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = beamGrad;
          ctx.beginPath();
          ctx.ellipse(0, 110, 75, 40, 0, 0, Math.PI * 2);
          ctx.fill();

          if (v.targetLocked) {
            ctx.strokeStyle = PALETTE.RED;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 110, 22, 0, Math.PI * 2);
            ctx.moveTo(-28, 110); ctx.lineTo(28, 110);
            ctx.moveTo(0, 82); ctx.lineTo(0, 138);
            ctx.stroke();
          }
        }

        // Tilted Fuselage with Banking Angle
        ctx.rotate((v.rollAngle || 0) + (v.spinAngle || 0));

        const bodyScale = 0.8 + (1 - v.altitude / 100) * 0.35;
        ctx.scale(bodyScale, bodyScale);

        this.renderer.drawGlowRect(-v.w / 2 + 6, -v.h / 2 + 8, v.w - 12, 36, '#1E293B', 10, true);
        ctx.fillStyle = v.targetLocked ? PALETTE.RED : PALETTE.CYAN;
        ctx.fillRect(-9, -v.h / 2 + 10, 18, 9);

        // Wing Weapon Pods (Gatling Guns / Missile Racks)
        ctx.fillStyle = '#09090B';
        ctx.fillRect(-v.w / 2 - 2, 2, 7, 16);
        ctx.fillRect(v.w / 2 - 5, 2, 7, 16);

        // Gatling Muzzle Flashes when in STRAFE mode
        if (v.state === 'STRAFE' && v.strafeFireTimer > 0.06) {
          ctx.fillStyle = PALETTE.GOLD;
          ctx.fillRect(-v.w / 2, 18, 3, 10);
          ctx.fillRect(v.w / 2 - 3, 18, 3, 10);
        }

        // Tail Boom & Tail Rotor
        ctx.fillStyle = '#334155';
        ctx.fillRect(-3, 14, 6, 28);
        ctx.fillRect(-9, 38, 18, 3);
        ctx.strokeStyle = PALETTE.WHITE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, 39);
        ctx.lineTo(10, 39);
        ctx.stroke();

        // Spinning 4-Blade Main Rotor
        ctx.save();
        ctx.rotate(v.rotorAngle || 0);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-42, 0); ctx.lineTo(42, 0);
        ctx.moveTo(0, -42); ctx.lineTo(0, 42);
        ctx.stroke();
        ctx.fillStyle = PALETTE.GOLD;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (v.hp <= 2 || v.state === 'CRASHING') {
          ctx.fillStyle = PALETTE.ORANGE;
          ctx.fillRect(-4, 6, 8, 8);
        }
      } else if (v.type === 'motorcycle') {
        ctx.fillStyle = '#09090B';
        ctx.fillRect(-3, -v.h / 2, 6, 9);
        ctx.fillRect(-3, v.h / 2 - 9, 6, 9);

        this.renderer.drawGlowRect(-5, -8, 10, 16, PALETTE.RED, 8, true);
        ctx.fillStyle = '#18181B';
        ctx.fillRect(-7, -4, 14, 12);
        this.renderer.drawGlowCircle(0, -2, 5, PALETTE.GOLD, 6, true);
      } else if (v.type === 'civilian_cycle') {
        ctx.fillStyle = '#09090B';
        ctx.fillRect(-2.5, -v.h / 2, 5, 8);
        ctx.fillRect(-2.5, v.h / 2 - 8, 5, 8);

        this.renderer.drawGlowRect(-4, -6, 8, 14, PALETTE.CYAN, 6, true);
        ctx.fillStyle = PALETTE.WHITE;
        ctx.fillRect(-5, -3, 10, 10);
        this.renderer.drawGlowCircle(0, -2, 4, PALETTE.WHITE, 6, true);
      } else if (v.type === 'barreldumper') {
        ctx.fillStyle = '#09090B';
        ctx.fillRect(-v.w / 2 - 3, -18, 4, 14);
        ctx.fillRect(v.w / 2 - 1, -18, 4, 14);
        ctx.fillRect(-v.w / 2 - 3, 6, 4, 18);
        ctx.fillRect(v.w / 2 - 1, 6, 4, 18);

        this.renderer.drawGlowRect(-v.w / 2, -v.h / 2, v.w, v.h, '#15803D', 8, true);
        ctx.fillStyle = '#052E16';
        ctx.fillRect(-v.w / 2 + 5, -v.h / 2 + 6, v.w - 10, 8);
        this.renderer.drawGlowCircle(-6, 12, 5, PALETTE.GOLD, 6, true);
        this.renderer.drawGlowCircle(6, 12, 5, PALETTE.GOLD, 6, true);
      } else if (v.type === 'roadlord') {
        ctx.fillStyle = '#09090B';
        ctx.fillRect(-v.w / 2 - 3, -18, 4, 12);
        ctx.fillRect(v.w / 2 - 1, -18, 4, 12);
        ctx.fillRect(-v.w / 2 - 3, 8, 4, 12);
        ctx.fillRect(v.w / 2 - 1, 8, 4, 12);

        this.renderer.drawGlowRect(-v.w / 2, -v.h / 2, v.w, v.h, '#1D4ED8', 8, true);
        ctx.fillStyle = '#94A3B8';
        ctx.fillRect(-v.w / 2 - 2, -v.h / 2 - 3, v.w + 4, 7);
        ctx.fillRect(-v.w / 2 + 3, -4, v.w - 6, 22);
        ctx.fillStyle = '#090D16';
        ctx.fillRect(-v.w / 2 + 5, -14, v.w - 10, 7);
      } else if (v.type === 'enforcer') {
        ctx.fillStyle = '#09090B';
        ctx.fillRect(-v.w / 2 - 2, -18, 3, 10);
        ctx.fillRect(v.w / 2 - 1, -18, 3, 10);
        ctx.fillRect(-v.w / 2 - 2, 10, 3, 10);
        ctx.fillRect(v.w / 2 - 1, 10, 3, 10);

        this.renderer.drawGlowRect(-v.w / 2, -v.h / 2, v.w, v.h, '#1E1B4B', 8, true);
        ctx.strokeStyle = PALETTE.PURPLE;
        ctx.lineWidth = 2;
        ctx.strokeRect(-v.w / 2 + 1, -v.h / 2 + 1, v.w - 2, v.h - 2);
        ctx.fillStyle = '#09090B';
        ctx.fillRect(-v.w / 2 + 4, -14, v.w - 8, 10);
        ctx.fillRect(-v.w / 2 + 5, 10, v.w - 10, 8);
        const sideDir = this.player.x >= v.x ? 1 : -1;
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(sideDir > 0 ? v.w / 2 - 2 : -v.w / 2 - 6, -4, 8, 3);
      } else if (v.type === 'switchblade') {
        ctx.fillStyle = '#09090B';
        ctx.fillRect(-v.w / 2 - 2, -16, 3, 10);
        ctx.fillRect(v.w / 2 - 1, -16, 3, 10);
        ctx.fillRect(-v.w / 2 - 2, 8, 3, 10);
        ctx.fillRect(v.w / 2 - 1, 8, 3, 10);

        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(-v.w / 2 - 9, -13, 8, 4);
        ctx.fillRect(v.w / 2 + 1, -13, 8, 4);
        ctx.fillRect(-v.w / 2 - 9, 11, 8, 4);
        ctx.fillRect(v.w / 2 + 1, 11, 8, 4);

        this.renderer.drawGlowRect(-v.w / 2, -v.h / 2, v.w, v.h, '#EA580C', 8, true);
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(-4, -v.h / 2 + 3, 8, 10);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-v.w / 2 + 4, -9, v.w - 8, 10);
      } else {
        ctx.fillStyle = '#09090B';
        ctx.fillRect(-v.w / 2 - 2, -14, 3, 9);
        ctx.fillRect(v.w / 2 - 1, -14, 3, 9);
        ctx.fillRect(-v.w / 2 - 2, 7, 3, 9);
        ctx.fillRect(v.w / 2 - 1, 7, 3, 9);

        this.renderer.drawGlowRect(-v.w / 2, -v.h / 2, v.w, v.h, '#38BDF8', 6, true);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-v.w / 2 + 4, -10, v.w - 8, 9);
        ctx.fillRect(-v.w / 2 + 4, 7, v.w - 8, 7);
        ctx.fillStyle = '#E0F2FE';
        ctx.fillRect(-v.w / 2 + 5, -1, v.w - 10, 8);
      }
      ctx.restore();
    }

    // Player G-6155 Interceptor Supercar
    const p = this.player;
    if (p.invulnTimer <= 0 || Math.floor(p.invulnTimer * 14) % 2 === 0) {
      ctx.save();
      ctx.translate(p.x, p.y);

      // Dual Front Machine-Gun Muzzle Flashes when firing
      if (this.input.isDown('actionA') && !p.dockedVan) {
        const flashH = 8 + (Math.floor(performance.now() / 35) % 2) * 6;
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(-11, -p.h / 2 - flashH, 4, flashH);
        ctx.fillRect(7, -p.h / 2 - flashH, 4, flashH);
        ctx.fillStyle = PALETTE.WHITE;
        ctx.fillRect(-10, -p.h / 2 - flashH * 0.6, 2, flashH * 0.6);
        ctx.fillRect(8, -p.h / 2 - flashH * 0.6, 2, flashH * 0.6);
      }

      // 4 Black Racing Tires
      ctx.fillStyle = '#09090B';
      ctx.fillRect(-p.w / 2 - 3, -17, 4, 11);
      ctx.fillRect(p.w / 2 - 1, -17, 4, 11);
      ctx.fillRect(-p.w / 2 - 3, 7, 4, 12);
      ctx.fillRect(p.w / 2 - 1, 7, 4, 12);

      // Sleek White G-6155 Sports Car Chassis
      this.renderer.drawGlowRect(-p.w / 2, -p.h / 2, p.w, p.h, PALETTE.WHITE, 12, true);
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(-p.w / 2 + 3, -p.h / 2 + 2, p.w - 6, 12);

      // Center Cyan Stripe
      ctx.fillStyle = PALETTE.CYAN;
      ctx.fillRect(-3, -p.h / 2, 6, p.h);

      // Wrap-Around Cockpit Windshield
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.moveTo(-10, -9);
      ctx.lineTo(10, -9);
      ctx.lineTo(12, 3);
      ctx.lineTo(-12, 3);
      ctx.closePath();
      ctx.fill();

      // Rear Louvers & Taillights
      ctx.fillStyle = '#334155';
      for (let ly = 7; ly <= 17; ly += 4) {
        ctx.fillRect(-8, ly, 16, 2);
      }
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(-12, p.h / 2 - 3, 7, 3);
      ctx.fillRect(5, p.h / 2 - 3, 7, 3);

      ctx.restore();
    }

    // Bullets & Missiles
    for (const b of this.bullets) {
      const col = b.enemyShot ? PALETTE.RED : b.isMissile ? PALETTE.GOLD : PALETTE.CYAN;
      this.renderer.drawGlowRect(b.x - 2, b.y - 6, b.isMissile ? 5 : 3, b.isMissile ? 14 : 10, col, 8, true);
    }

    // Particles & Popups
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    for (const pop of this.popups) {
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HEADER,
        size: 11,
        color: pop.color,
        align: 'center',
        glow: 8
      });
    }

    // Civilian Casualty Penalty Banner
    if (this.noPointsTimer > 0) {
      this.renderer.drawText('CIVILIAN CASUALTY: -500 PTS (SCORE FROZEN)', this.width / 2, 65, {
        font: FONTS.HEADER,
        size: 11.5,
        color: PALETTE.RED,
        align: 'center',
        glow: 10
      });
    }

    // Live Biome & Highway Status in HUD
    const biomeLabel = {
      FOREST: '🌲 FOREST',
      DESERT: '🏜️ DESERT',
      SNOW: '❄️ ALPINE',
      COASTAL: '🌊 COASTAL',
      CITY: '🏙️ METRO'
    }[this.currentBiome] || this.currentBiome;

    const roadLabel = {
      SUPER_HIGHWAY: '4-LANE EXPRESSWAY',
      HIGHWAY: 'HIGHWAY',
      NARROW_STREET: 'NARROW CHOKEPOINT',
      BRIDGE: 'BRIDGE'
    }[this.currentRoadType] || this.currentRoadType;

    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `${biomeLabel} • ${roadLabel}  |  OIL:${p.oilAmmo} SMK:${p.smokeAmmo} MSL:${p.missileAmmo}`,
      accent: PALETTE.CYAN
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'G-6155 INTERCEPTOR HIGHWAY COMBAT',
      controls: 'ARROWS: STEER/SPEED  |  Z/SPACE: MACHINE GUN  |  X/SHIFT: OIL SLICK / SMOKE',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.CYAN
    });
  }
}

export default SpyHunter;
