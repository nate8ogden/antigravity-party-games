/**
 * SpyHunter.js
 * Classic 1983 Top-Down High-Speed Highway Combat Driving — Retro Arcade Studio Edition.
 * Features:
 * - Infinite Endurance Highway with progressive distance tiers (curves, river bridges, speed scaling)
 * - Strict Civilian Protection: Point deductions (-500 pts) and score freeze for hitting/destroying civilians
 * - Weapons Van Docking & Center-Screen Auto-Align: Re-arms vehicle and smoothly centers player back to the middle of the road
 * - Diverse Enemy Roster:
 *     1. Mad Bomber Motorcyclist (agile weaving bike, flips and spins when hit)
 *     2. Civilian Commuter Motorcyclist (scooter commuter to protect)
 *     3. The Mad Bomber Helicopter (high-altitude chopper dropping road bombs, shootable with roof missiles)
 *     4. The Barrel Dumper (armored half-track rolling explosive barrels onto the asphalt)
 *     5. The Switchblade (orange coupe with extending tire slashers)
 *     6. The Enforcer (purple limo with window gunner)
 *     7. The Road Lord (bulletproof front rammer)
 *     8. Civilian Sedan (blue commuter car)
 *     9. Red Weapons Van (docking re-arming trailer)
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
    this.trees = [];
    this.player = null;
    this.bullets = [];
    this.hazards = []; // Oil slicks, smoke screens, explosive barrels & bomb craters
    this.vehicles = []; // Enemies, civilians, helicopter, and Weapons Van
    this.particles = [];
    this.popups = [];

    this.distance = 0;
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
    this.noPointsTimer = 0;
    this.vanSpawnTimer = 16;
    this.copterSpawnTimer = 26;
    this.spawnTimer = 1.2;

    this.bullets = [];
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

  _initRoad() {
    this.roadSegments = [];
    for (let y = 0; y <= this.height + 60; y += 20) {
      this.roadSegments.push({
        y,
        centerX: this.width / 2,
        halfWidth: 195,
        isBridge: false
      });
    }
    this.trees = [];
    for (let i = 0; i < 18; i++) {
      this.trees.push({
        x: i % 2 === 0 ? 45 + Math.random() * 140 : 775 + Math.random() * 140,
        y: Math.random() * this.height,
        r: 14 + Math.random() * 10
      });
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
      specialMode: 'OIL', // Alternates 'OIL' and 'SMOKE'
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
    return closest || { centerX: this.width / 2, halfWidth: 195, isBridge: false };
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
    const laneOffset = (Math.floor(Math.random() * 3) - 1) * 85;
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
      y: -75,
      w: 44,
      h: 58,
      vx: 0,
      speed: 260,
      hp: 4,
      color: '#334155',
      rotorAngle: 0,
      bombTimer: 1.5,
      spinning: false,
      spinAngle: 0
    });

    this.popups.push({
      x: this.width / 2,
      y: 90,
      text: 'WARNING: MAD BOMBER CHOPPER INCOMING!',
      color: PALETTE.RED,
      life: 2.4
    });
    this.audio.playLaser(300, 100, 0.25);
  }

  _spawnWeaponsVan() {
    const topRoad = this._getRoadAtY(40);
    // Spawns slightly to the side with loading ramp extended
    this.vehicles.push({
      type: 'weaponsvan',
      x: topRoad.centerX - 80,
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
    // When inside the van, both the van and the player are steered smoothly
    // back to the CENTER OF THE ROAD/SCREEN so the player exits safely!
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

      const steerSpeed = 310;
      if (this.input.isDown('left')) {
        p.vx = -steerSpeed;
      } else if (this.input.isDown('right')) {
        p.vx = steerSpeed;
      } else {
        p.vx *= Math.pow(0.0005, dt);
      }
      p.x += p.vx * dt;
    }

    // Advance Infinite Highway Distance & Escalating Level Milestones
    const deltaDist = p.speed * dt;
    this.distance += deltaDist;
    this.level = 1 + Math.floor(this.distance / 8500);
    if (this.noPointsTimer <= 0) {
      this._addScore(deltaDist * 0.08);
    }

    // Scroll Road Segments with dynamic curves and river bridges
    for (const seg of this.roadSegments) {
      seg.y += deltaDist;
      if (seg.y > this.height + 40) {
        seg.y -= this.height + 80;
        const curvePhase = this.distance * 0.00085;
        seg.centerX =
          this.width / 2 +
          Math.sin(curvePhase) * (110 + Math.min(50, this.level * 6)) +
          Math.cos(curvePhase * 0.47) * 55;
        const bridgeWave = Math.sin(this.distance * 0.00035);
        seg.isBridge = bridgeWave > 0.70;
        seg.halfWidth = seg.isBridge ? 145 : 195;
      }
    }

    // Scroll Roadside Trees
    for (const tree of this.trees) {
      tree.y += deltaDist;
      if (tree.y > this.height + 30) {
        tree.y = -20;
        const topSeg = this._getRoadAtY(0);
        const side = Math.random() < 0.5 ? -1 : 1;
        tree.x = topSeg.centerX + side * (topSeg.halfWidth + 45 + Math.random() * 120);
      }
    }

    // Check Player Road Bounds & Bridge Plunges
    const playerRoad = this._getRoadAtY(p.y);
    const distFromCenter = Math.abs(p.x - playerRoad.centerX);
    if (!p.dockedVan && distFromCenter > playerRoad.halfWidth - 8) {
      if (playerRoad.isBridge && distFromCenter > playerRoad.halfWidth + 8) {
        // Plunged off narrow bridge into river!
        this._destroyPlayer();
        return;
      }
      // Off-road shoulder slowdown and vibration
      p.speed = Math.max(220, p.speed - 240 * dt);
      this.renderer.shake(3, 0.06);
      if (Math.random() < 0.4) {
        this._spawnParticles(p.x, p.y + 20, PALETTE.GOLD, 2, 60);
      }
      p.x = Math.max(
        playerRoad.centerX - playerRoad.halfWidth - 28,
        Math.min(playerRoad.centerX + playerRoad.halfWidth + 28, p.x)
      );
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

    // Update Bullets & Missiles
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y += b.vy * dt;
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

      // Check Player Bullet vs Vehicles
      for (let j = this.vehicles.length - 1; j >= 0; j--) {
        const v = this.vehicles[j];
        if (v.type === 'weaponsvan') continue;

        if (
          Math.abs(b.x - v.x) < v.w / 2 + 6 &&
          Math.abs(b.y - v.y) < v.h / 2 + 6
        ) {
          this.bullets.splice(i, 1);
          if (v.type === 'roadlord' && !b.isMissile) {
            // Bulletproof Armor Sparks
            this.audio.playMenuMove();
            this._spawnParticles(b.x, b.y, PALETTE.CYAN, 4, 90);
          } else {
            v.hp -= b.damage;
            this._spawnParticles(b.x, b.y, PALETTE.ORANGE, 6, 110);
            if (v.hp <= 0) {
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
      h.y += (p.speed * 0.55) * dt;

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
            // Deduct points for spinning out innocent civilians!
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

    // Spawn Mad Bomber Helicopter periodically
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

      if (v.spinning) {
        v.spinAngle += 15 * dt;
        v.x += v.vx * dt;
        v.y += (p.speed - v.speed * 0.4) * dt;

        if (Math.abs(v.x - vRoad.centerX) > vRoad.halfWidth + 16) {
          this._destroyVehicle(i);
          continue;
        }
      } else {
        // Relative vertical motion
        const relVy = p.speed - v.speed;
        v.y += relVy * dt;

        // AI steering behavior
        if (v.type === 'civilian' || v.type === 'civilian_cycle' || v.type === 'weaponsvan') {
          const targetX =
            v.type === 'weaponsvan' && !v.used
              ? vRoad.centerX - 75
              : vRoad.centerX;
          v.x += (targetX - v.x) * 2.5 * dt;
        } else if (v.type === 'motorcycle') {
          // Agile motorcyclist weaving
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
          // Barrel dumper drives down center and rolls barrels
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
        } else if (v.type === 'helicopter') {
          // Mad Bomber Chopper flies overhead and drops bombs
          v.rotorAngle += 35 * dt;
          v.x += (p.x - v.x) * 1.8 * dt;

          v.bombTimer -= dt;
          if (v.bombTimer <= 0) {
            v.bombTimer = 2.0;
            // Drop explosive bomb on highway ahead
            this.hazards.push({
              type: 'CRATER',
              x: v.x,
              y: v.y + 60,
              r: 22,
              life: 4.0
            });
            this.audio.playExplosion(0.2, 500);
            this._spawnParticles(v.x, v.y + 60, PALETTE.ORANGE, 12, 120);
          }
        } else {
          // Enemy chases player's lane
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

      // Check Player Interaction with Vehicle
      if (!p.dockedVan) {
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
        if (v.type !== 'helicopter') {
          if (dx < (p.w + v.w) * 0.48 && dy < (p.h + v.h) * 0.46) {
            const pushDir = p.x < v.x ? -1 : 1;
            p.x += pushDir * 18;
            v.x -= pushDir * 28;
            this.audio.playShove();
            this.renderer.shake(6, 0.15);
            this._spawnParticles((p.x + v.x) / 2, (p.y + v.y) / 2, PALETTE.GOLD, 8, 130);

            // Civilian Collision Penalty: Subtract points for hitting innocents!
            if (v.type === 'civilian' || v.type === 'civilian_cycle') {
              this._addScore(-150, p.x, p.y - 18, PALETTE.RED, 'CIVILIAN HIT -150!');
              this.audio.playHit();
            }

            // Switchblade tire slasher destroys player if side-swiped while vulnerable
            if (v.type === 'switchblade' && p.invulnTimer <= 0 && dy < 22) {
              this._destroyPlayer();
              return;
            }

            // Check if vehicle was sideswiped off the road!
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

    // Strict Civilian Protection Penalty: Deduct points & freeze scoring
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
    } else if (v.type === 'helicopter') {
      this._addScore(1500, v.x, v.y, PALETTE.GOLD, 'CHOPPER DOWN! +1500');
      this.audio.playStageClear();
    } else if (v.type === 'motorcycle') {
      this._addScore(500, v.x, v.y, PALETTE.GOLD, 'BIKER DOWN +500');
    } else {
      const pts = v.type === 'roadlord' ? 800 : v.type === 'barreldumper' ? 700 : 400;
      this._addScore(pts, v.x, v.y, PALETTE.GOLD);
    }
    this.vehicles.splice(index, 1);
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
    // Grass / River background
    this.renderer.clear('#0D1E18');

    // Render Scrolling Highway Strips
    const sortedSegs = [...this.roadSegments].sort((a, b) => a.y - b.y);
    for (let i = 0; i < sortedSegs.length; i++) {
      const seg = sortedSegs[i];
      const h = 22;
      if (seg.isBridge) {
        // Blue River beneath Bridge
        ctx.fillStyle = '#0A2E5C';
        ctx.fillRect(0, seg.y, this.width, h);
        // Bridge steel guardrails
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(seg.centerX - seg.halfWidth - 8, seg.y, 8, h);
        ctx.fillRect(seg.centerX + seg.halfWidth, seg.y, 8, h);
      } else {
        // Road Shoulder rumble strips
        ctx.fillStyle = i % 2 === 0 ? '#D97706' : '#78350F';
        ctx.fillRect(seg.centerX - seg.halfWidth - 14, seg.y, 14, h);
        ctx.fillRect(seg.centerX + seg.halfWidth, seg.y, 14, h);
      }

      // Asphalt surface
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(seg.centerX - seg.halfWidth, seg.y, seg.halfWidth * 2, h);

      // Dashed Lane Dividers
      if (Math.floor((seg.y + this.distance) / 40) % 2 === 0) {
        ctx.fillStyle = 'rgba(248, 250, 252, 0.65)';
        ctx.fillRect(seg.centerX - seg.halfWidth * 0.34, seg.y, 4, 14);
        ctx.fillRect(seg.centerX + seg.halfWidth * 0.34, seg.y, 4, 14);
      }
    }

    // Roadside Trees
    for (const tree of this.trees) {
      const seg = this._getRoadAtY(tree.y);
      if (seg.isBridge) continue;
      if (Math.abs(tree.x - seg.centerX) < seg.halfWidth + 28) continue;
      this.renderer.drawGlowCircle(tree.x, tree.y, tree.r, '#10B981', 6, true);
      ctx.fillStyle = '#047857';
      ctx.beginPath();
      ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
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
        // Rolling Yellow Hazard Fuel Barrel
        this.renderer.drawGlowCircle(h.x, h.y, h.r, PALETTE.GOLD, 8, true);
        ctx.fillStyle = '#09090B';
        ctx.fillRect(h.x - 3, h.y - h.r, 6, h.r * 2);
      } else if (h.type === 'CRATER') {
        // Flaming Road Bomb Crater
        ctx.fillStyle = '#1C1917';
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, h.r, h.r * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        this.renderer.drawGlowCircle(h.x, h.y, h.r * 0.5, PALETTE.ORANGE, 10, true);
      }
    }

    // Vehicles (Enemies, Civilians, Helicopter, Red Weapons Van)
    for (const v of this.vehicles) {
      ctx.save();
      ctx.translate(v.x, v.y);
      if (v.spinning) {
        ctx.rotate(v.spinAngle);
      }

      if (v.type === 'weaponsvan') {
        // Iconic Red Weapons Van with Rear Loading Ramp
        if (!v.used) {
          ctx.fillStyle = '#64748B';
          ctx.fillRect(-17, v.h / 2 - 4, 34, 24);
          ctx.fillStyle = '#94A3B8';
          ctx.fillRect(-13, v.h / 2 - 2, 26, 20);
          ctx.fillStyle = PALETTE.GREEN;
          ctx.fillRect(-15, v.h / 2 + 2, 3, 14);
          ctx.fillRect(12, v.h / 2 + 2, 3, 14);
        }
        // Van Tires
        ctx.fillStyle = '#09090B';
        ctx.fillRect(-v.w / 2 - 3, -v.h / 2 + 10, 4, 14);
        ctx.fillRect(v.w / 2 - 1, -v.h / 2 + 10, 4, 14);
        ctx.fillRect(-v.w / 2 - 3, v.h / 2 - 24, 4, 16);
        ctx.fillRect(v.w / 2 - 1, v.h / 2 - 24, 4, 16);

        // Van Chassis & Trailer Body
        this.renderer.drawGlowRect(-v.w / 2, -v.h / 2, v.w, v.h, PALETTE.RED, 10, true);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-v.w / 2 + 5, -v.h / 2 + 6, v.w - 10, 10);
        ctx.fillStyle = PALETTE.WHITE;
        ctx.fillRect(-9, -v.h / 2 + 20, 5, v.h - 26);
        ctx.fillRect(4, -v.h / 2 + 20, 5, v.h - 26);
      } else if (v.type === 'helicopter') {
        // Mad Bomber Helicopter: Fuselage, Tail Boom, Cockpit Glass & Spinning Rotors
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(0, 36, 18, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // Fuselage Body
        this.renderer.drawGlowRect(-v.w / 2 + 6, -v.h / 2 + 10, v.w - 12, 34, '#1E293B', 8, true);
        // Tail Boom & Rotor
        ctx.fillStyle = '#334155';
        ctx.fillRect(-3, 12, 6, 26);
        ctx.fillRect(-8, 34, 16, 3);
        // Cockpit Visor
        ctx.fillStyle = PALETTE.CYAN;
        ctx.fillRect(-9, -v.h / 2 + 12, 18, 8);

        // Spinning Main Dual Rotor Blades
        ctx.save();
        ctx.rotate(v.rotorAngle || 0);
        ctx.strokeStyle = PALETTE.WHITE;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-36, 0);
        ctx.lineTo(36, 0);
        ctx.stroke();
        ctx.restore();
      } else if (v.type === 'motorcycle') {
        // Mad Bomber Motorcyclist: Dual Tires, Red Body, Leather Rider & Helmet
        ctx.fillStyle = '#09090B';
        ctx.fillRect(-3, -v.h / 2, 6, 9); // Front Tire
        ctx.fillRect(-3, v.h / 2 - 9, 6, 9); // Rear Tire

        // Red Bike Body & Fuel Tank
        this.renderer.drawGlowRect(-5, -8, 10, 16, PALETTE.RED, 8, true);
        // Rider Helmet & Torso
        ctx.fillStyle = '#18181B'; // Black Leather
        ctx.fillRect(-7, -4, 14, 12);
        this.renderer.drawGlowCircle(0, -2, 5, PALETTE.GOLD, 6, true); // Helmet
      } else if (v.type === 'civilian_cycle') {
        // Civilian Commuter Scooter: Cyan/Yellow Body
        ctx.fillStyle = '#09090B';
        ctx.fillRect(-2.5, -v.h / 2, 5, 8);
        ctx.fillRect(-2.5, v.h / 2 - 8, 5, 8);

        this.renderer.drawGlowRect(-4, -6, 8, 14, PALETTE.CYAN, 6, true);
        ctx.fillStyle = PALETTE.WHITE;
        ctx.fillRect(-5, -3, 10, 10);
        this.renderer.drawGlowCircle(0, -2, 4, PALETTE.WHITE, 6, true);
      } else if (v.type === 'barreldumper') {
        // Armored Half-Track Barrel Dumper
        ctx.fillStyle = '#09090B';
        ctx.fillRect(-v.w / 2 - 3, -18, 4, 14);
        ctx.fillRect(v.w / 2 - 1, -18, 4, 14);
        ctx.fillRect(-v.w / 2 - 3, 6, 4, 18); // Rear Treads
        ctx.fillRect(v.w / 2 - 1, 6, 4, 18);

        this.renderer.drawGlowRect(-v.w / 2, -v.h / 2, v.w, v.h, '#15803D', 8, true);
        // Windshield
        ctx.fillStyle = '#052E16';
        ctx.fillRect(-v.w / 2 + 5, -v.h / 2 + 6, v.w - 10, 8);
        // Yellow Barrels in Cargo Bed
        this.renderer.drawGlowCircle(-6, 12, 5, PALETTE.GOLD, 6, true);
        this.renderer.drawGlowCircle(6, 12, 5, PALETTE.GOLD, 6, true);
      } else if (v.type === 'roadlord') {
        // Road Lord: Armored Blue Rammer with Steel Bullbar
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
        // Enforcer: Sleek Purple Limo with Window Gunner
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
        // Switchblade: Red/Orange Coupe with Extending Slasher Blades
        ctx.fillStyle = '#09090B';
        ctx.fillRect(-v.w / 2 - 2, -16, 3, 10);
        ctx.fillRect(v.w / 2 - 1, -16, 3, 10);
        ctx.fillRect(-v.w / 2 - 2, 8, 3, 10);
        ctx.fillRect(v.w / 2 - 1, 8, 3, 10);

        // Slasher Blades
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
        // Civilian Sedan
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

    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `OIL:${p.oilAmmo} SMK:${p.smokeAmmo} MSL:${p.missileAmmo}`,
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
