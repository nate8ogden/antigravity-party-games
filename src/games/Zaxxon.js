/**
 * Zaxxon.js
 * Classic 1982 Isometric / Axonometric Diagonal Flight Shooter — Retro Arcade Studio Edition.
 * Features:
 * - Multi-Zone Non-Repetitive Campaign:
 *     Zone 1: Outer Fortress Perimeter (Fuel Tanks, SAM Silos, Gun Turrets, Radar Dishes, Slit Walls)
 *     Zone 2: Deep Space Void (Starry Cosmos, V-Formation & Pincer Interceptor Squadrons, Space Mines, Wipeout Bonuses)
 *     Zone 3: Inner Citadel Gauntlet (High-Tech Deck, Oscillating Laser Gates, Heavy Dual-Turrets, Dense Fuel Silos)
 *     Zone 4: Zaxxon Command Mech Boss Arena (Chest Homing Missiles, Weak Point Combat, Multi-Stage Explosions)
 * - Authentic 1982 Tap-To-Fire Blaster Control (Max 2 On-Screen Projectiles, No Autofire Spraying)
 * - Surface-to-Air Missile (SAM) Silos that detect approaching fighter and launch vertically
 * - Proximity Altitude Hazard Warning (Guideline turns flashing Red with Pull-Up / Dive Alert)
 * - 5 Distinct Visual Sectors (Navy Outpost, Magma Vulcan, Cyber Matrix, Emerald Base, Super Zaxxon Void)
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const MAX_ALT = 120;
const LANE_LIMIT = 155;
const MAX_PLAYER_BULLETS = 2; // Authentic 1982 Sega Arcade restriction: max 2 simultaneous lasers

export class Zaxxon {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'zaxxon';
    this.title = 'Zaxxon';
    this.width = 960;
    this.height = 540;

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.particles = [];
    this.popups = [];
    this.stars = this._generateStarfield(75);
    this._initStage();
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.audio.stopSequence();
  }

  _generateStarfield(count) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() < 0.25 ? 2.5 : Math.random() < 0.6 ? 1.5 : 1,
        twinkle: Math.random() * Math.PI * 2,
        speed: 15 + Math.random() * 35,
        color: Math.random() < 0.2 ? PALETTE.CYAN : Math.random() < 0.4 ? PALETTE.GOLD : PALETTE.WHITE
      });
    }
    return stars;
  }

  // Projects (distAlongRunway, laneOffset, altitude) into 2D isometric screen coordinates
  // Runway scrolls from Top-Right (dist = 800) to Bottom-Left (dist = -150)
  _isoToScreen(dist, lane, alt = 0) {
    const baseX = 285 + dist * 0.62 + lane * 0.88;
    const baseY = 445 - dist * 0.36 + lane * 0.44 - alt;
    return { x: baseX, y: baseY };
  }

  _initStage() {
    this.scrollDist = 0;
    this.fuel = 100;
    this.lastZoneName = '';
    this.zoneBanner = { text: '', life: 0, color: PALETTE.CYAN };

    // Multi-Sectors: Each level cycles through distinctive visual themes and tactical configurations
    const sectors = [
      {
        name: 'SECTOR 1: ASTEROID OUTPOST ALPHA',
        deckCol: '#0B132B',
        gridCol: '#38BDF8',
        wallFill: '#1E293B',
        wallStroke: '#F97316',
        nebulaCol: 'rgba(14, 165, 233, 0.12)',
        speedMult: 1.0
      },
      {
        name: 'SECTOR 2: MAGMA CORE VULCAN',
        deckCol: '#1C1113',
        gridCol: '#F59E0B',
        wallFill: '#450A0A',
        wallStroke: '#EF4444',
        nebulaCol: 'rgba(239, 68, 68, 0.14)',
        speedMult: 1.08
      },
      {
        name: 'SECTOR 3: CYBERNETIC CITADEL',
        deckCol: '#1E1B4B',
        gridCol: '#EC4899',
        wallFill: '#3B0764',
        wallStroke: '#C084FC',
        nebulaCol: 'rgba(217, 70, 239, 0.14)',
        speedMult: 1.15
      },
      {
        name: 'SECTOR 4: EMERALD STAR FORTRESS',
        deckCol: '#06281E',
        gridCol: '#10B981',
        wallFill: '#064E3B',
        wallStroke: '#34D399',
        nebulaCol: 'rgba(16, 185, 129, 0.14)',
        speedMult: 1.22
      },
      {
        name: 'SECTOR 5: SUPER-ZAXXON TITANIUM VOID',
        deckCol: '#0F172A',
        gridCol: '#F43F5E',
        wallFill: '#18181B',
        wallStroke: '#E11D48',
        nebulaCol: 'rgba(244, 63, 94, 0.16)',
        speedMult: 1.3
      }
    ];

    const sectorIdx = (this.level - 1) % sectors.length;
    this.currentSector = sectors[sectorIdx];

    // Zone Boundaries along the flight path:
    // Zone 1: Outer Fortress (0 -> 1600)
    // Zone 2: Deep Space Void (1600 -> 3400)
    // Zone 3: Inner Citadel Gauntlet (3400 -> 5100)
    // Zone 4: Zaxxon Mech Boss Arena (5100+)
    this.zone1End = 1600;
    this.zone2End = 3400;
    this.zone3End = 5100;
    this.bossDist = 5300;

    this.player = {
      lane: 0,
      alt: 36,
      invuln: 2.0,
      muzzleFlash: 0,
      warningActive: false,
      warningLabel: ''
    };

    this.bullets = [];
    this.enemyBullets = [];
    this.objects = [];
    this.squadrons = {};

    this._buildStageObjects(sectorIdx);

    // Zaxxon Armored Robot Boss at the Command Core
    this.boss = {
      active: false,
      dist: this.bossDist,
      lane: 0,
      alt: 35,
      vxLane: 85 * this.currentSector.speedMult,
      hp: 12 + this.level * 3,
      maxHp: 12 + this.level * 3,
      fireTimer: 1.6,
      hatchOpen: 0,
      flash: 0,
      defeated: false
    };

    this._setZoneBanner(this.currentSector.name, PALETTE.CYAN);
  }

  _buildStageObjects(sectorIdx) {
    // -------------------------------------------------------------
    // ZONE 1: OUTER FORTRESS (0 to 1600)
    // Perimeter Walls, Ground Fuel Dumps, SAM Silos, AA Gun Turrets, Radar Arrays
    // -------------------------------------------------------------
    this.objects.push({
      type: 'WALL',
      dist: 500,
      lane: 0,
      minSafeAlt: 20,
      maxSafeAlt: 50,
      gapLane: 0,
      label: 'LOW CLEARANCE (20-50m)',
      hp: 9999
    });

    this.objects.push({
      type: 'WALL',
      dist: 1100,
      lane: 0,
      minSafeAlt: 70,
      maxSafeAlt: 130,
      gapLane: 0,
      label: 'HIGH CLEARANCE (70-120m)',
      hp: 9999
    });

    this.objects.push({
      type: 'WALL',
      dist: 1550,
      lane: 0,
      minSafeAlt: 40,
      maxSafeAlt: 80,
      gapLane: 0,
      label: 'MID SLIT (40-80m)',
      hp: 9999
    });

    // Populate Zone 1 with Fuel Tanks, SAM Silos, Turrets, Radars
    for (let d = 260; d < this.zone1End - 80; d += 135) {
      if (Math.abs(d - 500) < 60 || Math.abs(d - 1100) < 60 || Math.abs(d - 1550) < 60) continue;

      const roll = (d * 13 + sectorIdx * 7) % 10;
      if (roll <= 3) {
        // Double Fuel Tanks for replenishment
        this.objects.push({
          type: 'FUEL_TANK',
          dist: d,
          lane: -60 + ((d * 11) % 120),
          alt: 0,
          hp: 1
        });
      } else if (roll <= 5) {
        // Surface-to-Air Missile (SAM) Silo
        this.objects.push({
          type: 'MISSILE_SILO',
          dist: d,
          lane: -75 + ((d * 19) % 150),
          alt: 0,
          hp: 1,
          launched: false
        });
      } else if (roll <= 7) {
        // Anti-Aircraft Gun Turret
        this.objects.push({
          type: 'TURRET',
          dist: d,
          lane: -80 + ((d * 23) % 160),
          alt: 0,
          hp: 1,
          fireTimer: 1.0 + Math.random() * 0.8
        });
      } else if (roll === 8) {
        // Radar Station
        this.objects.push({
          type: 'RADAR',
          dist: d,
          lane: -70 + ((d * 31) % 140),
          alt: 0,
          hp: 2,
          rot: 0
        });
      } else {
        // Airborne Patrol Interceptor
        this.objects.push({
          type: 'INTERCEPTOR',
          dist: d + 40,
          lane: -90 + ((d * 17) % 180),
          alt: 30 + ((d * 7) % 65),
          hp: 1,
          vx: 0,
          pattern: 'SOLO'
        });
      }
    }

    // -------------------------------------------------------------
    // ZONE 2: DEEP SPACE VOID (1600 to 3400)
    // Starry cosmos, Tactical Squadrons, Space Mines, Floating Fuel Pods
    // -------------------------------------------------------------
    // Wave 1: V-Formation Squadron (5 Fighters)
    const sq1Id = 'sq1';
    this.squadrons[sq1Id] = { total: 5, remaining: 5, bonusAwarded: false };
    const sq1Offsets = [
      { distOff: 0, laneOff: 0, alt: 50 },
      { distOff: 70, laneOff: -45, alt: 60 },
      { distOff: 70, laneOff: 45, alt: 60 },
      { distOff: 140, laneOff: -90, alt: 70 },
      { distOff: 140, laneOff: 90, alt: 70 }
    ];
    for (const off of sq1Offsets) {
      this.objects.push({
        type: 'INTERCEPTOR',
        dist: 1950 + off.distOff,
        lane: off.laneOff,
        alt: off.alt,
        hp: 1,
        squadronId: sq1Id,
        pattern: 'V_FORMATION',
        fireTimer: 1.5 + Math.random()
      });
    }

    // Floating Space Mines & Deep Space Fuel Pods in Void
    for (let d = 2150; d < 2650; d += 120) {
      const isFuel = (d % 240 === 0);
      if (isFuel) {
        this.objects.push({
          type: 'FUEL_POD',
          dist: d,
          lane: -60 + ((d * 13) % 120),
          alt: 35 + ((d * 7) % 50),
          hp: 1
        });
      } else {
        this.objects.push({
          type: 'SPACE_MINE',
          dist: d,
          lane: -85 + ((d * 17) % 170),
          alt: 25 + ((d * 9) % 70),
          hp: 1,
          pulse: 0
        });
      }
    }

    // Wave 2: Pincer Tactical Squadron (4 Fighters)
    const sq2Id = 'sq2';
    this.squadrons[sq2Id] = { total: 4, remaining: 4, bonusAwarded: false };
    const sq2Offsets = [
      { distOff: 0, laneOff: -95, alt: 40, vx: 50 },
      { distOff: 0, laneOff: 95, alt: 40, vx: -50 },
      { distOff: 80, laneOff: -110, alt: 65, vx: 55 },
      { distOff: 80, laneOff: 110, alt: 65, vx: -55 }
    ];
    for (const off of sq2Offsets) {
      this.objects.push({
        type: 'INTERCEPTOR',
        dist: 2800 + off.distOff,
        lane: off.laneOff,
        alt: off.alt,
        hp: 1,
        squadronId: sq2Id,
        pattern: 'PINCER',
        vx: off.vx,
        fireTimer: 1.2 + Math.random()
      });
    }

    // Additional Void Mines before Citadel Entry
    for (let d = 3050; d < 3350; d += 110) {
      this.objects.push({
        type: 'SPACE_MINE',
        dist: d,
        lane: -70 + ((d * 21) % 140),
        alt: 30 + ((d * 5) % 60),
        hp: 1,
        pulse: 0
      });
    }

    // -------------------------------------------------------------
    // ZONE 3: INNER CITADEL GAUNTLET (3400 to 5100)
    // High-Tech Circuit Deck, Oscillating Laser Gates, Heavy Dual Turrets, Dense SAM Silos
    // -------------------------------------------------------------
    this.objects.push({
      type: 'WALL',
      dist: 3550,
      lane: 0,
      minSafeAlt: 15,
      maxSafeAlt: 50,
      gapLane: 0,
      label: 'CITADEL GATEWAY (15-50m)',
      hp: 9999
    });

    // Oscillating Laser Energy Barriers (Move vertically over time)
    this.objects.push({
      type: 'LASER_GATE',
      dist: 3950,
      lane: 0,
      alt: 50,
      baseAlt: 50,
      amp: 30,
      freq: 1.8,
      beamThickness: 14,
      label: 'OSCILLATING LASER GATE',
      hp: 9999
    });

    this.objects.push({
      type: 'WALL',
      dist: 4350,
      lane: 0,
      minSafeAlt: 65,
      maxSafeAlt: 125,
      gapLane: 0,
      label: 'HIGH BASTION (65-125m)',
      hp: 9999
    });

    this.objects.push({
      type: 'LASER_GATE',
      dist: 4750,
      lane: 0,
      alt: 45,
      baseAlt: 45,
      amp: 35,
      freq: 2.3,
      beamThickness: 16,
      label: 'PULSE LASER BARRIER',
      hp: 9999
    });

    this.objects.push({
      type: 'WALL',
      dist: 5050,
      lane: 0,
      minSafeAlt: 35,
      maxSafeAlt: 75,
      gapLane: 0,
      label: 'INNER COMMAND SANCTUM (35-75m)',
      hp: 9999
    });

    // Populate Zone 3 with Heavy Turrets, SAM Silos, Dense Fuel Reserves
    for (let d = 3600; d < this.zone3End - 100; d += 120) {
      if (
        Math.abs(d - 3950) < 60 ||
        Math.abs(d - 4350) < 60 ||
        Math.abs(d - 4750) < 60 ||
        Math.abs(d - 5050) < 60
      ) {
        continue;
      }

      const roll = (d * 7 + sectorIdx * 3) % 9;
      if (roll <= 2) {
        // High-Density Fuel Tanks
        this.objects.push({
          type: 'FUEL_TANK',
          dist: d,
          lane: -70 + ((d * 13) % 140),
          alt: 0,
          hp: 1
        });
      } else if (roll <= 5) {
        // Heavy Armored Dual Turret (takes 2 hits, tracks player lane)
        this.objects.push({
          type: 'HEAVY_TURRET',
          dist: d,
          lane: -80 + ((d * 29) % 160),
          alt: 0,
          hp: 2,
          maxHp: 2,
          fireTimer: 1.1 + Math.random() * 0.7
        });
      } else if (roll <= 7) {
        // Rapid SAM Silo
        this.objects.push({
          type: 'MISSILE_SILO',
          dist: d,
          lane: -60 + ((d * 17) % 120),
          alt: 0,
          hp: 1,
          launched: false
        });
      } else {
        // High altitude Interceptor
        this.objects.push({
          type: 'INTERCEPTOR',
          dist: d + 30,
          lane: -90 + ((d * 11) % 180),
          alt: 55 + ((d * 13) % 45),
          hp: 1,
          vx: 0,
          pattern: 'SOLO'
        });
      }
    }
  }

  _setZoneBanner(text, color = PALETTE.CYAN) {
    this.zoneBanner = { text, life: 2.2, color };
  }

  _addScore(pts, x, y, label = null, color = PALETTE.GOLD) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    this.popups.push({
      x,
      y,
      text: label || `+${pts}`,
      color,
      life: 0.95
    });
  }

  _spawnExplosion(x, y, color = PALETTE.ORANGE, count = 16) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 45 + Math.random() * 155;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        color,
        life: 0.35 + Math.random() * 0.35
      });
    }
  }

  _killPlayer(reason = 'CRASHED!') {
    if (this.player.invuln > 0) return;
    const pScreen = this._isoToScreen(0, this.player.lane, this.player.alt);
    this._spawnExplosion(pScreen.x, pScreen.y, PALETTE.RED, 28);
    this.audio.playExplosion(0.45, 720);
    this.renderer.shake(11, 0.38);
    this.lives--;

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.state = 'GAMEOVER';
      this.audio.playGameOver();
      return;
    }

    this.fuel = Math.max(60, this.fuel);
    this.player.invuln = 2.4;
    this.player.alt = 55;
    this.popups.push({
      x: pScreen.x,
      y: pScreen.y - 20,
      text: reason,
      color: PALETTE.RED,
      life: 1.2
    });
  }

  update(dt) {
    if (this.state === 'MENU') {
      if (this.input.isJustPressed('actionA') || this.input.isJustPressed('any')) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'PLAYING';
      }
      return;
    }
    if (this.state === 'PAUSED') {
      if (this.input.isJustPressed('actionA')) this.state = 'PLAYING';
      return;
    }
    if (this.state === 'GAMEOVER') {
      if (this.input.isJustPressed('actionA') || (this.input.pointer && this.input.pointer.justPressed)) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'PLAYING';
      }
      return;
    }

    const p = this.player;
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (p.muzzleFlash > 0) p.muzzleFlash = Math.max(0, p.muzzleFlash - dt);
    if (this.zoneBanner.life > 0) this.zoneBanner.life = Math.max(0, this.zoneBanner.life - dt);

    // Update Starfield twinkle & scroll
    for (const star of this.stars) {
      star.x -= star.speed * dt * 0.45;
      star.y += star.speed * dt * 0.25;
      if (star.x < 0) star.x += this.width;
      if (star.y > this.height) star.y -= this.height;
    }

    // 1. Scroll Fortress Runway & Fuel Consumption
    const speedMult = this.currentSector.speedMult || 1.0;
    const scrollSpeed = this.boss.active ? 0 : (168 + this.level * 10) * speedMult;
    this.scrollDist += scrollSpeed * dt;

    // Fuel depletion: 3.2% per second
    this.fuel = Math.max(0, this.fuel - 3.2 * dt);
    if (this.fuel <= 0) {
      this.fuel = 65;
      this._killPlayer('OUT OF FUEL!');
    }

    // Zone Announcements upon crossing thresholds
    if (this.scrollDist < this.zone1End) {
      if (this.lastZoneName !== 'ZONE 1') {
        this.lastZoneName = 'ZONE 1';
        this._setZoneBanner('ZONE 1: OUTER FORTRESS DEFENSE PERIMETER', PALETTE.CYAN);
      }
    } else if (this.scrollDist >= this.zone1End && this.scrollDist < this.zone2End) {
      if (this.lastZoneName !== 'ZONE 2') {
        this.lastZoneName = 'ZONE 2';
        this._setZoneBanner('ZONE 2: DEEP SPACE VOID — SQUADRONS DETECTED!', PALETTE.PURPLE);
        this.audio.playPowerUp();
      }
    } else if (this.scrollDist >= this.zone2End && this.scrollDist < this.zone3End) {
      if (this.lastZoneName !== 'ZONE 3') {
        this.lastZoneName = 'ZONE 3';
        this._setZoneBanner('ZONE 3: INNER CITADEL — LASER GATE GAUNTLET', PALETTE.GOLD);
        this.audio.playPowerUp();
      }
    } else if (this.scrollDist >= this.zone3End) {
      if (this.lastZoneName !== 'ZONE 4') {
        this.lastZoneName = 'ZONE 4';
        this._setZoneBanner('WARNING: ENEMY COMMAND MECH — ZAXXON DETECTED!', PALETTE.RED);
        this.audio.playLaser(450, 150, 0.25);
      }
    }

    // 2. Flight Controls: Left/Right banks lane, Up/Down controls Altitude
    const axis = this.input.getAxis();
    p.lane = Math.max(-LANE_LIMIT, Math.min(LANE_LIMIT, p.lane + axis.x * 215 * dt));
    // Up climbs altitude, Down descends altitude
    p.alt = Math.max(4, Math.min(MAX_ALT, p.alt - axis.y * 140 * dt));

    // -------------------------------------------------------------
    // AUTHENTIC 1982 TAP-TO-FIRE MECHANIC (No Autofire Spraying!)
    // Must press button per shot. Max 2 player lasers on screen.
    // -------------------------------------------------------------
    const fireJustPressed =
      this.input.isJustPressed('actionA') ||
      this.input.isJustPressed('actionB') ||
      (this.input.pointer && this.input.pointer.justPressed);

    if (fireJustPressed) {
      if (this.bullets.length < MAX_PLAYER_BULLETS) {
        this.bullets.push({
          dist: 24,
          lane: p.lane,
          alt: p.alt,
          speed: 640
        });
        p.muzzleFlash = 0.08;
        this.audio.playLaser(1150, 240, 0.08);
      } else {
        // Subtle audio feedback when attempting to exceed 2-bullet limit
        this.audio.playNote(220, 0.025, 'square', 0.07, 0);
      }
    }

    // 3. Update Player Lasers & Collision Detection
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.dist += b.speed * dt;
      if (b.dist > 780) {
        this.bullets.splice(i, 1);
        continue;
      }

      let hit = false;
      for (let j = this.objects.length - 1; j >= 0; j--) {
        const obj = this.objects[j];
        if (obj.type === 'WALL' || obj.type === 'LASER_GATE') continue;

        const relDist = obj.dist - this.scrollDist;
        const targetAlt = (obj.type === 'INTERCEPTOR' || obj.type === 'SPACE_MINE' || obj.type === 'FUEL_POD')
          ? obj.alt
          : obj.alt + 12;

        const altDiff = Math.abs(b.alt - targetAlt);
        const distDiff = Math.abs(b.dist - relDist);
        const laneDiff = Math.abs(b.lane - obj.lane);

        if (distDiff < 32 && laneDiff < 30 && altDiff < 26) {
          hit = true;
          obj.hp--;

          if (obj.hp <= 0) {
            const pos = this._isoToScreen(relDist, obj.lane, obj.alt);
            this._spawnExplosion(pos.x, pos.y, PALETTE.ORANGE, 18);
            this.audio.playExplosion(0.28, 920);

            if (obj.type === 'FUEL_TANK') {
              this.fuel = Math.min(100, this.fuel + 25);
              this._addScore(300, pos.x, pos.y - 14, 'FUEL +25% (+300)', PALETTE.GREEN);
            } else if (obj.type === 'FUEL_POD') {
              this.fuel = Math.min(100, this.fuel + 30);
              this._addScore(400, pos.x, pos.y - 14, 'DEEP FUEL +30% (+400)', PALETTE.CYAN);
            } else if (obj.type === 'RADAR') {
              this._addScore(1000, pos.x, pos.y - 14, 'RADAR +1000', PALETTE.CYAN);
            } else if (obj.type === 'MISSILE_SILO') {
              this._addScore(500, pos.x, pos.y - 14, 'SILO DESTROYED +500', PALETTE.GOLD);
            } else if (obj.type === 'HEAVY_TURRET') {
              this._addScore(600, pos.x, pos.y - 14, 'HEAVY TURRET +600', PALETTE.ORANGE);
            } else if (obj.type === 'SPACE_MINE') {
              // Space Mine Chain Detonation
              this._addScore(300, pos.x, pos.y - 14, 'MINE BLAST +300', PALETTE.PURPLE);
              this._triggerMineChainReaction(obj.dist, obj.lane, obj.alt);
            } else if (obj.type === 'INTERCEPTOR') {
              this._addScore(400, pos.x, pos.y - 14, '+400', PALETTE.GOLD);

              // Track Squadron Wipeout Bonus
              if (obj.squadronId && this.squadrons[obj.squadronId]) {
                const sq = this.squadrons[obj.squadronId];
                sq.remaining--;
                if (sq.remaining <= 0 && !sq.bonusAwarded) {
                  sq.bonusAwarded = true;
                  this._addScore(1500, pos.x, pos.y - 32, 'SQUADRON WIPEOUT! +1500', PALETTE.GOLD);
                  this.audio.playCoin();
                  this.audio.playPowerUp();
                }
              }
            } else {
              this._addScore(400, pos.x, pos.y - 14, '+400', PALETTE.GOLD);
            }

            this.objects.splice(j, 1);
          }
          break;
        }
      }

      // Check Boss Hit (Chest Missile Port)
      if (!hit && this.boss.active && !this.boss.defeated) {
        const relBossDist = this.boss.dist - this.scrollDist;
        const bDistDiff = Math.abs(b.dist - relBossDist);
        const bLaneDiff = Math.abs(b.lane - this.boss.lane);
        const bAltDiff = Math.abs(b.alt - (this.boss.alt + 22));

        if (bDistDiff < 42 && bLaneDiff < 44 && bAltDiff < 36) {
          hit = true;
          this.boss.hp--;
          this.boss.flash = 0.16;
          const bPos = this._isoToScreen(relBossDist, this.boss.lane, this.boss.alt + 22);
          this._spawnExplosion(bPos.x, bPos.y, PALETTE.CYAN, 12);
          this.audio.playHit();

          if (this.boss.hp <= 0) {
            this.boss.defeated = true;
            this._spawnExplosion(bPos.x, bPos.y, PALETTE.GOLD, 50);
            this.audio.playExplosion(0.65, 500);
            this.audio.playStageClear();
            this.renderer.shake(14, 0.55);

            const clearBonus = 3000 + Math.round(this.fuel) * 40;
            this._addScore(clearBonus, bPos.x, bPos.y - 25, `STAGE CLEAR BONUS +${clearBonus}!`, PALETTE.GOLD);

            setTimeout(() => {
              this.level++;
              this._initStage();
            }, 1800);
            return;
          }
        }
      }

      // Check Boss Missile Interception
      if (!hit) {
        for (let k = this.enemyBullets.length - 1; k >= 0; k--) {
          const eb = this.enemyBullets[k];
          if (eb.isBossMissile) {
            const mDistDiff = Math.abs(b.dist - eb.dist);
            const mLaneDiff = Math.abs(b.lane - eb.lane);
            const mAltDiff = Math.abs(b.alt - eb.alt);
            if (mDistDiff < 24 && mLaneDiff < 22 && mAltDiff < 22) {
              hit = true;
              const pos = this._isoToScreen(eb.dist, eb.lane, eb.alt);
              this._spawnExplosion(pos.x, pos.y, PALETTE.ORANGE, 20);
              this.audio.playExplosion(0.25, 950);
              this._addScore(500, pos.x, pos.y - 12, 'MISSILE DESTROYED +500', PALETTE.GOLD);
              this.enemyBullets.splice(k, 1);
              break;
            }
          }
        }
      }

      if (hit) {
        this.bullets.splice(i, 1);
      }
    }

    // 4. Update Fortress & Space Objects
    p.warningActive = false;
    p.warningLabel = '';

    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      const relDist = obj.dist - this.scrollDist;

      if (relDist < -90) {
        this.objects.splice(i, 1);
        continue;
      }

      // Proximity Hazard Altitude Warning (Guideline turns pulsing Red if altitude will hit upcoming barrier)
      if (relDist > 0 && relDist < 200 && Math.abs(p.lane - obj.lane) < 35) {
        if (obj.type === 'WALL') {
          if (p.alt < obj.minSafeAlt || p.alt > obj.maxSafeAlt) {
            p.warningActive = true;
            p.warningLabel = p.alt < obj.minSafeAlt ? 'PULL UP!' : 'DIVE!';
          }
        } else if (obj.type === 'LASER_GATE') {
          if (Math.abs(p.alt - obj.alt) < obj.beamThickness) {
            p.warningActive = true;
            p.warningLabel = p.alt < obj.alt ? 'DIVE!' : 'CLIMB!';
          }
        }
      }

      // Oscillating Laser Gate Animation
      if (obj.type === 'LASER_GATE') {
        obj.alt = obj.baseAlt + Math.sin(performance.now() * 0.003 * obj.freq) * obj.amp;
      }

      // SAM Silo Vertical Launch Activation
      if (obj.type === 'MISSILE_SILO' && !obj.launched && relDist < 420 && relDist > 80) {
        obj.launched = true;
        // Spawn active airborne SAM rocket
        this.objects.push({
          type: 'AIR_MISSILE',
          dist: obj.dist,
          lane: obj.lane,
          alt: 10,
          vAlt: 65,
          vDist: -180,
          hp: 1
        });
        this.audio.playLaser(280, 850, 0.14);
      }

      // Air Missile Movement
      if (obj.type === 'AIR_MISSILE') {
        obj.alt = Math.min(MAX_ALT, obj.alt + obj.vAlt * dt);
        obj.dist += obj.vDist * dt;
        // Particle smoke trail
        if (Math.random() < 0.6) {
          const sPos = this._isoToScreen(relDist, obj.lane, obj.alt - 6);
          this.particles.push({
            x: sPos.x,
            y: sPos.y,
            vx: -20 + Math.random() * 40,
            vy: 20 + Math.random() * 30,
            color: Math.random() < 0.5 ? PALETTE.ORANGE : '#94A3B8',
            life: 0.28
          });
        }
      }

      // Interceptor Squadron Maneuvers
      if (obj.type === 'INTERCEPTOR' && relDist < 680) {
        if (obj.pattern === 'V_FORMATION') {
          obj.dist -= 60 * dt;
          obj.lane += Math.sin(performance.now() * 0.0035 + obj.dist * 0.02) * 45 * dt;
        } else if (obj.pattern === 'PINCER') {
          obj.dist -= 75 * dt;
          obj.lane += (obj.vx || 0) * dt;
          if (Math.abs(obj.lane) > 130) obj.vx = -(obj.vx || 50);
        } else {
          obj.dist -= 50 * dt;
          obj.lane += Math.sin(performance.now() * 0.003 + obj.dist) * 35 * dt;
        }
      }

      // Enemy Firing (Turrets, Interceptors, Heavy Turrets)
      if (relDist > 80 && relDist < 520) {
        if (obj.type === 'TURRET' || obj.type === 'INTERCEPTOR') {
          obj.fireTimer -= dt;
          if (obj.fireTimer <= 0) {
            obj.fireTimer = 1.9 + Math.random() * 0.5;
            this.enemyBullets.push({
              dist: relDist,
              lane: obj.lane,
              alt: obj.type === 'INTERCEPTOR' ? obj.alt : 14,
              vDist: -280,
              vLane: 0
            });
          }
        } else if (obj.type === 'HEAVY_TURRET') {
          obj.fireTimer -= dt;
          if (obj.fireTimer <= 0) {
            obj.fireTimer = 1.6;
            // Heavy turret twin burst firing toward player lane
            const aimDir = p.lane > obj.lane ? 30 : -30;
            this.enemyBullets.push({
              dist: relDist,
              lane: obj.lane - 8,
              alt: 16,
              vDist: -310,
              vLane: aimDir
            });
            this.enemyBullets.push({
              dist: relDist,
              lane: obj.lane + 8,
              alt: 16,
              vDist: -310,
              vLane: aimDir
            });
            this.audio.playLaser(620, 200, 0.1);
          }
        }
      }

      // Collision with Player Jet (at relative dist ~ 0)
      if (Math.abs(relDist) < 22) {
        if (obj.type === 'WALL') {
          if (p.alt < obj.minSafeAlt || p.alt > obj.maxSafeAlt) {
            this._killPlayer('HIT FORTRESS WALL!');
          }
        } else if (obj.type === 'LASER_GATE') {
          if (Math.abs(p.alt - obj.alt) < obj.beamThickness) {
            this._killPlayer('ZAPPED BY LASER BARRIER!');
          }
        } else if (obj.type === 'SPACE_MINE') {
          if (Math.abs(p.lane - obj.lane) < 26 && Math.abs(p.alt - obj.alt) < 22) {
            this._killPlayer('MINE EXPLOSION!');
          }
        } else if (obj.type === 'AIR_MISSILE') {
          if (Math.abs(p.lane - obj.lane) < 24 && Math.abs(p.alt - obj.alt) < 20) {
            this._killPlayer('SAM DIRECT HIT!');
          }
        } else if (Math.abs(p.lane - obj.lane) < 24 && Math.abs(p.alt - (obj.alt + 10)) < 20) {
          this._killPlayer('MID-AIR COLLISION!');
        }
      }
    }

    // 5. Zaxxon Armored Robot Boss Lifecycle
    const relBoss = this.boss.dist - this.scrollDist;
    if (relBoss <= 360 && !this.boss.active) {
      this.boss.active = true;
    }

    if (this.boss.active && !this.boss.defeated) {
      if (this.boss.flash > 0) this.boss.flash = Math.max(0, this.boss.flash - dt);

      // Boss Sweeping Movement & Hovering
      this.boss.lane += this.boss.vxLane * dt;
      if (Math.abs(this.boss.lane) > 115) this.boss.vxLane = -this.boss.vxLane;
      this.boss.alt = 35 + 22 * Math.sin(performance.now() * 0.0028);

      // Chest Missile Launch Cycle
      this.boss.fireTimer -= dt;
      if (this.boss.fireTimer < 0.4) {
        this.boss.hatchOpen = 1.0;
      } else {
        this.boss.hatchOpen = 0.0;
      }

      if (this.boss.fireTimer <= 0) {
        this.boss.fireTimer = Math.max(1.4, 2.2 - this.level * 0.1);
        // Launch Boss Homing Chest Missile!
        this.enemyBullets.push({
          dist: relBoss,
          lane: this.boss.lane,
          alt: this.boss.alt + 18,
          vDist: -320,
          vLane: 0,
          homing: true,
          isBossMissile: true
        });
        this.audio.playLaser(380, 110, 0.22);
      }
    }

    // 6. Update Enemy Bullets & Boss Missiles
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const eb = this.enemyBullets[i];
      eb.dist += eb.vDist * dt;
      if (eb.vLane) eb.lane += eb.vLane * dt;

      // Homing missile tracking
      if (eb.homing) {
        const laneDiff = p.lane - eb.lane;
        eb.lane += Math.sign(laneDiff) * Math.min(Math.abs(laneDiff), 65 * dt);
        const altDiff = p.alt - eb.alt;
        eb.alt += Math.sign(altDiff) * Math.min(Math.abs(altDiff), 45 * dt);

        // Rocket smoke trail
        if (Math.random() < 0.6) {
          const mPos = this._isoToScreen(eb.dist, eb.lane, eb.alt);
          this.particles.push({
            x: mPos.x,
            y: mPos.y,
            vx: -15 + Math.random() * 30,
            vy: 15 + Math.random() * 25,
            color: Math.random() < 0.5 ? PALETTE.ORANGE : PALETTE.CYAN,
            life: 0.25
          });
        }
      }

      if (eb.dist < -60) {
        this.enemyBullets.splice(i, 1);
        continue;
      }

      // Check collision with Player Fighter
      if (
        Math.abs(eb.dist) < 20 &&
        Math.abs(eb.lane - p.lane) < 22 &&
        Math.abs(eb.alt - p.alt) < 22
      ) {
        this.enemyBullets.splice(i, 1);
        this._killPlayer(eb.isBossMissile ? 'BOSS MISSILE IMPACT!' : 'SHOT DOWN!');
        break;
      }
    }

    // 7. Update Particles & Floating Popups
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 28 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  _triggerMineChainReaction(mineDist, mineLane, mineAlt) {
    for (let j = this.objects.length - 1; j >= 0; j--) {
      const other = this.objects[j];
      if (other.type === 'WALL' || other.type === 'LASER_GATE') continue;
      const dDist = Math.abs(other.dist - mineDist);
      const dLane = Math.abs(other.lane - mineLane);
      if (dDist < 90 && dLane < 70) {
        other.hp = 0;
        const oPos = this._isoToScreen(other.dist - this.scrollDist, other.lane, other.alt);
        this._spawnExplosion(oPos.x, oPos.y, PALETTE.GOLD, 16);
        this._addScore(500, oPos.x, oPos.y - 12, 'CHAIN REACTION +500', PALETTE.ORANGE);
        this.objects.splice(j, 1);
      }
    }
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear('#050811');

    const sector = this.currentSector || {
      name: 'SECTOR 1: ASTEROID OUTPOST ALPHA',
      deckCol: '#0B132B',
      gridCol: '#38BDF8',
      wallFill: '#1E293B',
      wallStroke: '#F97316',
      nebulaCol: 'rgba(14, 165, 233, 0.12)'
    };

    // 1. Starry Space Background & Distant Nebula Glow
    ctx.save();
    const grad = ctx.createRadialGradient(this.width * 0.5, this.height * 0.45, 50, this.width * 0.5, this.height * 0.45, 450);
    grad.addColorStop(0, sector.nebulaCol);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    for (const star of this.stars) {
      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Isometric Deck Runway (Drawn in Zone 1, Zone 3, and Boss Arena; absent in Zone 2 Deep Space!)
    const inDeepSpace = this.scrollDist >= this.zone1End && this.scrollDist < this.zone2End;

    if (!inDeepSpace) {
      ctx.save();
      const c1 = this._isoToScreen(-120, -LANE_LIMIT - 20, 0);
      const c2 = this._isoToScreen(780, -LANE_LIMIT - 20, 0);
      const c3 = this._isoToScreen(780, LANE_LIMIT + 20, 0);
      const c4 = this._isoToScreen(-120, LANE_LIMIT + 20, 0);

      // Deck Fill
      ctx.fillStyle = sector.deckCol;
      ctx.beginPath();
      ctx.moveTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.lineTo(c3.x, c3.y);
      ctx.lineTo(c4.x, c4.y);
      ctx.closePath();
      ctx.fill();

      // Deck Perimeter Hazard Borders
      ctx.strokeStyle = sector.gridCol;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Diagonal Scrolling Deck Ribs
      ctx.strokeStyle = sector.gridCol;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 1;
      const offset = this.scrollDist % 60;
      for (let d = -60 - offset; d < 780; d += 60) {
        const pL = this._isoToScreen(d, -LANE_LIMIT - 20, 0);
        const pR = this._isoToScreen(d, LANE_LIMIT + 20, 0);
        ctx.beginPath();
        ctx.moveTo(pL.x, pL.y);
        ctx.lineTo(pR.x, pR.y);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      // In Deep Space Void: Draw a floating isometric coordinate horizon grid
      ctx.save();
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      const pL = this._isoToScreen(0, -LANE_LIMIT, 0);
      const pR = this._isoToScreen(0, LANE_LIMIT, 0);
      ctx.beginPath();
      ctx.moveTo(pL.x, pL.y);
      ctx.lineTo(pR.x, pR.y);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Fortress Objects, Enemies & Barriers (Sorted back-to-front by distance)
    const visibleObjs = this.objects
      .map((o) => ({ o, relDist: o.dist - this.scrollDist }))
      .filter((item) => item.relDist > -80 && item.relDist < 760)
      .sort((a, b) => b.relDist - a.relDist);

    for (const { o, relDist } of visibleObjs) {
      if (o.type === 'WALL') {
        const wL = this._isoToScreen(relDist, -LANE_LIMIT - 15, 0);
        const wR = this._isoToScreen(relDist, LANE_LIMIT + 15, 0);
        ctx.save();
        ctx.fillStyle = sector.wallFill;
        ctx.strokeStyle = sector.wallStroke;
        ctx.lineWidth = 2.5;

        // Solid Fortress Blast Wall
        ctx.beginPath();
        ctx.moveTo(wL.x, wL.y);
        ctx.lineTo(wR.x, wR.y);
        ctx.lineTo(wR.x, wR.y - 74);
        ctx.lineTo(wL.x, wL.y - 74);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Strobe hazard warning beacon at wall top
        const beaconFlicker = Math.floor(performance.now() * 0.005) % 2 === 0;
        ctx.fillStyle = beaconFlicker ? PALETTE.RED : PALETTE.GOLD;
        ctx.beginPath();
        ctx.arc(wL.x, wL.y - 74, 5, 0, Math.PI * 2);
        ctx.arc(wR.x, wR.y - 74, 5, 0, Math.PI * 2);
        ctx.fill();

        // Safe Passage Clearance Slit / Laser Field
        const slotMidAlt = (o.minSafeAlt + o.maxSafeAlt) * 0.5;
        const slotH = (o.maxSafeAlt - o.minSafeAlt);
        ctx.strokeStyle = PALETTE.CYAN;
        ctx.shadowColor = PALETTE.CYAN;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(wL.x, wL.y - slotMidAlt);
        ctx.lineTo(wR.x, wR.y - slotMidAlt);
        ctx.stroke();

        // Safe Clearance Label
        this.renderer.drawText(o.label || 'CLEARANCE WINDOW', (wL.x + wR.x) * 0.5, (wL.y + wR.y) * 0.5 - slotMidAlt - 10, {
          font: FONTS.HEADER,
          size: 7,
          color: PALETTE.GOLD,
          align: 'center'
        });
        ctx.restore();
      } else if (o.type === 'LASER_GATE') {
        // High-Tech Oscillating Laser Gate between Twin Energy Pylons
        const pylonL = this._isoToScreen(relDist, -LANE_LIMIT + 10, 0);
        const pylonR = this._isoToScreen(relDist, LANE_LIMIT - 10, 0);
        ctx.save();

        // Pylons
        ctx.fillStyle = '#475569';
        ctx.strokeStyle = PALETTE.PINK;
        ctx.lineWidth = 2;
        ctx.fillRect(pylonL.x - 6, pylonL.y - 110, 12, 110);
        ctx.strokeRect(pylonL.x - 6, pylonL.y - 110, 12, 110);
        ctx.fillRect(pylonR.x - 6, pylonR.y - 110, 12, 110);
        ctx.strokeRect(pylonR.x - 6, pylonR.y - 110, 12, 110);

        // Oscillating Electric Laser Beam
        const bL = this._isoToScreen(relDist, -LANE_LIMIT + 10, o.alt);
        const bR = this._isoToScreen(relDist, LANE_LIMIT - 10, o.alt);

        ctx.strokeStyle = PALETTE.PINK;
        ctx.shadowColor = PALETTE.PINK;
        ctx.shadowBlur = 14;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(bL.x, bL.y);
        ctx.lineTo(bR.x, bR.y);
        ctx.stroke();

        ctx.strokeStyle = PALETTE.WHITE;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      } else {
        const ground = this._isoToScreen(relDist, o.lane, 0);
        const pos = this._isoToScreen(relDist, o.lane, o.alt);

        // Ground Shadow for Airborne Targets (Interceptors, Air Missiles, Space Mines)
        if (o.alt > 0 && !inDeepSpace) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
          ctx.beginPath();
          ctx.ellipse(ground.x, ground.y, 14, 7, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        if (o.type === 'FUEL_TANK') {
          // Cylindrical Red Fuel Tank with White Hazard Caps
          this.renderer.drawGlowRect(pos.x - 14, pos.y - 25, 28, 23, PALETTE.RED, 8, true);
          ctx.fillStyle = PALETTE.WHITE;
          ctx.fillRect(pos.x - 14, pos.y - 25, 28, 4);
          ctx.fillRect(pos.x - 14, pos.y - 6, 28, 4);
          this.renderer.drawText('FUEL', pos.x, pos.y - 10, {
            font: FONTS.HEADER,
            size: 7,
            color: PALETTE.GOLD,
            align: 'center'
          });
        } else if (o.type === 'FUEL_POD') {
          // Floating Deep Space Fuel Capsule
          this.renderer.drawGlowCircle(pos.x, pos.y - 8, 11, PALETTE.GREEN, 10, true);
          ctx.fillStyle = PALETTE.WHITE;
          ctx.fillRect(pos.x - 8, pos.y - 12, 16, 8);
          this.renderer.drawText('F-POD', pos.x, pos.y - 7, {
            font: FONTS.HEADER,
            size: 6.5,
            color: PALETTE.GREEN,
            align: 'center'
          });
        } else if (o.type === 'RADAR') {
          // Rotating Radar Array Dish
          ctx.fillStyle = '#64748B';
          ctx.fillRect(pos.x - 6, pos.y - 10, 12, 10);
          this.renderer.drawGlowCircle(pos.x, pos.y - 19, 12, PALETTE.CYAN, 10, true);
          ctx.strokeStyle = PALETTE.WHITE;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y - 19);
          ctx.lineTo(pos.x - 9, pos.y - 26);
          ctx.stroke();
        } else if (o.type === 'MISSILE_SILO') {
          // Hexagonal Missile Launch Silo with rocket nose visible
          ctx.fillStyle = '#334155';
          ctx.strokeStyle = PALETTE.GOLD;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y - 6, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          if (!o.launched) {
            ctx.fillStyle = PALETTE.RED;
            ctx.fillRect(pos.x - 3, pos.y - 14, 6, 10);
            ctx.fillStyle = PALETTE.WHITE;
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y - 18);
            ctx.lineTo(pos.x - 4, pos.y - 13);
            ctx.lineTo(pos.x + 4, pos.y - 13);
            ctx.closePath();
            ctx.fill();
          }
        } else if (o.type === 'AIR_MISSILE') {
          // Active Rising SAM Missile
          ctx.save();
          ctx.translate(pos.x, pos.y);
          ctx.fillStyle = PALETTE.WHITE;
          ctx.strokeStyle = PALETTE.RED;
          ctx.lineWidth = 1.5;
          ctx.fillRect(-3, -12, 6, 14);
          ctx.strokeRect(-3, -12, 6, 14);
          // Red cone tip
          ctx.fillStyle = PALETTE.RED;
          ctx.beginPath();
          ctx.moveTo(0, -18);
          ctx.lineTo(-4, -12);
          ctx.lineTo(4, -12);
          ctx.closePath();
          ctx.fill();
          // Thruster flame
          this.renderer.drawGlowCircle(0, 4, 4, PALETTE.ORANGE, 8, true);
          ctx.restore();
        } else if (o.type === 'TURRET') {
          // Ground Anti-Aircraft Turret
          this.renderer.drawGlowRect(pos.x - 12, pos.y - 12, 24, 12, '#475569', 6, true);
          this.renderer.drawGlowCircle(pos.x, pos.y - 13, 8, PALETTE.GOLD, 6, true);
          ctx.strokeStyle = PALETTE.WHITE;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y - 14);
          ctx.lineTo(pos.x - 14, pos.y - 8);
          ctx.stroke();
        } else if (o.type === 'HEAVY_TURRET') {
          // Armored Dual-Barrel Heavy Turret (takes 2 hits)
          const baseCol = o.hp < o.maxHp ? PALETTE.RED : '#1E293B';
          this.renderer.drawGlowRect(pos.x - 16, pos.y - 14, 32, 14, baseCol, 8, true);
          this.renderer.drawGlowCircle(pos.x, pos.y - 15, 10, PALETTE.ORANGE, 8, true);
          // Twin Barrels
          ctx.strokeStyle = PALETTE.GOLD;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(pos.x - 4, pos.y - 16);
          ctx.lineTo(pos.x - 18, pos.y - 10);
          ctx.moveTo(pos.x + 4, pos.y - 16);
          ctx.lineTo(pos.x - 10, pos.y - 4);
          ctx.stroke();
        } else if (o.type === 'SPACE_MINE') {
          // Spiked Explosive Space Mine
          const pulseCol = Math.floor(performance.now() * 0.006) % 2 === 0 ? PALETTE.RED : PALETTE.PURPLE;
          this.renderer.drawGlowCircle(pos.x, pos.y - 8, 9, pulseCol, 10, true);
          ctx.strokeStyle = PALETTE.WHITE;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(pos.x - 14, pos.y - 8);
          ctx.lineTo(pos.x + 14, pos.y - 8);
          ctx.moveTo(pos.x, pos.y - 22);
          ctx.lineTo(pos.x, pos.y + 6);
          ctx.stroke();
        } else if (o.type === 'INTERCEPTOR') {
          // Isometric Delta-Wing Interceptor Jet
          ctx.save();
          ctx.translate(pos.x, pos.y - 8);
          const jetCol = o.squadronId ? PALETTE.RED : PALETTE.PURPLE;
          ctx.fillStyle = jetCol;
          ctx.strokeStyle = PALETTE.PINK;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-16, 6);
          ctx.lineTo(10, -10);
          ctx.lineTo(14, 4);
          ctx.lineTo(-4, 12);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = PALETTE.GOLD;
          ctx.fillRect(-8, 1, 6, 4);
          ctx.restore();
        }
      }
    }

    // 4. Zaxxon Armored Robot Boss
    if (this.boss.active) {
      const relBoss = this.boss.dist - this.scrollDist;
      const bGround = this._isoToScreen(relBoss, this.boss.lane, 0);
      const bPos = this._isoToScreen(relBoss, this.boss.lane, this.boss.alt);

      if (!inDeepSpace) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
        ctx.beginPath();
        ctx.ellipse(bGround.x, bGround.y, 32, 14, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(bPos.x, bPos.y);
      const armorCol = this.boss.flash > 0 ? PALETTE.WHITE : '#1E293B';
      const trimCol = this.boss.flash > 0 ? PALETTE.CYAN : PALETTE.PINK;

      // Heavy Bipedal Walker Legs
      ctx.fillStyle = '#475569';
      ctx.fillRect(-22, -14, 14, 18);
      ctx.fillRect(8, -14, 14, 18);
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(-24, 2, 18, 6);
      ctx.fillRect(6, 2, 18, 6);

      // Shoulder Armor & Missile Pods
      this.renderer.drawGlowRect(-38, -48, 14, 26, trimCol, 10, true);
      this.renderer.drawGlowRect(24, -48, 14, 26, trimCol, 10, true);

      // Main Mech Torso & Chest Missile Hatch
      this.renderer.drawGlowRect(-24, -50, 48, 38, armorCol, 12, true);
      ctx.strokeStyle = trimCol;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-24, -50, 48, 38);

      // Chest Missile Launcher Opening (Weak Point!)
      const hatchCol = this.boss.hatchOpen > 0 ? PALETTE.RED : PALETTE.GOLD;
      this.renderer.drawGlowCircle(0, -31, 10, hatchCol, 12, true);
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(-5, -36, 10, 10);

      // Armored Head & Glowing Visor
      ctx.fillStyle = armorCol;
      ctx.fillRect(-14, -64, 28, 14);
      this.renderer.drawGlowRect(-10, -59, 20, 6, PALETTE.CYAN, 8, true);

      // Boss Health Bar above head
      const hpRatio = Math.max(0, this.boss.hp / this.boss.maxHp);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(-35, -78, 70, 7);
      ctx.fillStyle = hpRatio > 0.4 ? PALETTE.RED : PALETTE.GOLD;
      ctx.fillRect(-34, -77, 68 * hpRatio, 5);

      this.renderer.drawText('ZAXXON MECH', 0, -84, {
        font: FONTS.HEADER,
        size: 8,
        color: PALETTE.GOLD,
        align: 'center'
      });
      ctx.restore();
    }

    // 5. Player Jet Shadow & Proximity Altitude Guideline
    const p = this.player;
    const pShadow = this._isoToScreen(0, p.lane, 0);
    const pPos = this._isoToScreen(0, p.lane, p.alt);

    ctx.save();
    if (!inDeepSpace) {
      // Ground Shadow on Runway
      ctx.fillStyle = p.warningActive ? 'rgba(239, 68, 68, 0.75)' : 'rgba(0, 0, 0, 0.65)';
      ctx.beginPath();
      ctx.ellipse(pShadow.x, pShadow.y, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Holographic Space Flight Target Crosshair
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pShadow.x, pShadow.y, 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Vertical Altitude Guideline: Pulsing RED on proximity danger, otherwise translucent CYAN
    const guideCol = p.warningActive
      ? (Math.floor(performance.now() * 0.01) % 2 === 0 ? PALETTE.RED : PALETTE.GOLD)
      : 'rgba(0, 240, 255, 0.4)';

    ctx.strokeStyle = guideCol;
    ctx.setLineDash(p.warningActive ? [3, 3] : [4, 4]);
    ctx.lineWidth = p.warningActive ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(pShadow.x, pShadow.y);
    ctx.lineTo(pPos.x, pPos.y);
    ctx.stroke();
    ctx.restore();

    // Altitude Warning Alert Banner when on collision course
    if (p.warningActive && p.warningLabel) {
      this.renderer.drawText(`[!] ${p.warningLabel}`, pPos.x + 32, pPos.y - 12, {
        font: FONTS.HEADER,
        size: 11,
        color: PALETTE.RED,
        align: 'left',
        glow: 8
      });
    }

    // 6. Player Isometric Delta-Wing Starfighter Jet
    if (p.invuln <= 0 || Math.floor(p.invuln * 14) % 2 === 0) {
      ctx.save();
      ctx.translate(pPos.x, pPos.y);

      // Swept Isometric Delta Wings pointing along the runway vector
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = PALETTE.CYAN;
      ctx.shadowColor = PALETTE.CYAN;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(22, -12);   // Nose tip
      ctx.lineTo(-8, -20);   // Left wingtip
      ctx.lineTo(-14, -8);   // Left rear fuselage
      ctx.lineTo(-20, 4);    // Tail base
      ctx.lineTo(-8, 10);    // Right rear fuselage
      ctx.lineTo(8, 14);     // Right wingtip
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Red Sega Wing Squadron Stripes
      ctx.fillStyle = PALETTE.RED;
      ctx.beginPath();
      ctx.moveTo(6, -10);
      ctx.lineTo(-6, -16);
      ctx.lineTo(-10, -11);
      ctx.lineTo(2, -5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = PALETTE.RED;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(4, 10);
      ctx.lineTo(-2, 7);
      ctx.lineTo(2, -2);
      ctx.closePath();
      ctx.fill();

      // Fuselage Spine & Glowing Blue Cockpit Canopy
      ctx.fillStyle = PALETTE.WHITE;
      ctx.beginPath();
      ctx.moveTo(22, -12);
      ctx.lineTo(-14, 6);
      ctx.lineTo(-18, 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = PALETTE.BLUE;
      ctx.beginPath();
      ctx.ellipse(5, -5, 6, 3.2, -0.5, 0, Math.PI * 2);
      ctx.fill();

      // Twin Afterburner Thruster Plumes
      const thrustFlicker = Math.floor(performance.now() * 0.03) % 2 === 0 ? PALETTE.ORANGE : PALETTE.GOLD;
      this.renderer.drawGlowCircle(-15, 1, 4, thrustFlicker, 10, true);
      this.renderer.drawGlowCircle(-11, 6, 4, thrustFlicker, 10, true);

      // Muzzle Flash at Nose when firing
      if (p.muzzleFlash > 0) {
        this.renderer.drawGlowCircle(25, -13, 6, PALETTE.CYAN, 14, true);
      }
      ctx.restore();
    }

    // 7. Lasers, Enemy Shots & Homing Missiles
    for (const b of this.bullets) {
      const pos = this._isoToScreen(b.dist, b.lane, b.alt);
      this.renderer.drawGlowCircle(pos.x, pos.y, 4, PALETTE.CYAN, 8, true);
    }
    for (const eb of this.enemyBullets) {
      const pos = this._isoToScreen(eb.dist, eb.lane, eb.alt);
      if (eb.isBossMissile) {
        this.renderer.drawGlowCircle(pos.x, pos.y, 6.5, PALETTE.ORANGE, 12, true);
        ctx.fillStyle = PALETTE.WHITE;
        ctx.fillRect(pos.x - 2, pos.y - 2, 4, 4);
      } else {
        this.renderer.drawGlowCircle(pos.x, pos.y, 4.5, PALETTE.RED, 8, true);
      }
    }

    // 8. Particles & Popups
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
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

    // 9. Zone Announcement Banner
    if (this.zoneBanner.life > 0) {
      this.renderer.drawText(this.zoneBanner.text, 480, 72, {
        font: FONTS.HEADER,
        size: 12,
        color: this.zoneBanner.color,
        align: 'center',
        glow: 10
      });
    }

    // 10. Left-Side On-Screen ALTITUDE METER (H — High / L — Low)
    const ax = 28;
    const ay = 105;
    const ah = 320;
    ctx.save();
    this.renderer.drawText('H', ax + 9, ay - 12, {
      font: FONTS.HEADER,
      size: 14,
      color: PALETTE.CYAN,
      align: 'center',
      glow: 8
    });
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.lineWidth = 2;
    ctx.fillRect(ax, ay, 18, ah);
    ctx.strokeRect(ax, ay, 18, ah);

    const altRatio = Math.max(0, Math.min(1, p.alt / MAX_ALT));
    const fillH = altRatio * ah;
    const altCol = altRatio > 0.55 ? PALETTE.CYAN : altRatio > 0.25 ? PALETTE.GREEN : PALETTE.ORANGE;
    this.renderer.drawGlowRect(ax + 3, ay + ah - fillH, 12, fillH, altCol, 8, true);

    this.renderer.drawText('L', ax + 9, ay + ah + 20, {
      font: FONTS.HEADER,
      size: 14,
      color: PALETTE.ORANGE,
      align: 'center'
    });
    ctx.restore();

    // 11. Bottom Fuel Gauge & Laser Ammo HUD
    ctx.save();
    this.renderer.drawText('FUEL:', 85, 518, {
      font: FONTS.HEADER,
      size: 12,
      color: this.fuel < 25 ? PALETTE.RED : PALETTE.GOLD
    });
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = PALETTE.GOLD;
    ctx.lineWidth = 2;
    ctx.fillRect(155, 504, 220, 16);
    ctx.strokeRect(155, 504, 220, 16);
    const fuelCol = this.fuel < 25 ? PALETTE.RED : PALETTE.GREEN;
    this.renderer.drawGlowRect(157, 506, (this.fuel / 100) * 216, 12, fuelCol, 8, true);

    // Active Laser Ammo Slots [●●] Indicator
    const freeShots = MAX_PLAYER_BULLETS - this.bullets.length;
    const ammoDots = freeShots === 2 ? '● ●' : freeShots === 1 ? '● ○' : '○ ○';
    this.renderer.drawText(`LASERS: [${ammoDots}]`, 405, 518, {
      font: FONTS.HEADER,
      size: 11,
      color: freeShots > 0 ? PALETTE.CYAN : PALETTE.RED
    });
    this.renderer.drawText('(TAP TO FIRE)', 525, 518, {
      font: FONTS.HEADER,
      size: 9.5,
      color: PALETTE.GRAY
    });
    ctx.restore();

    // 12. Top HUD & State Overlay
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `ALT:${Math.round(p.alt)}m`,
      accent: PALETTE.CYAN
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1982 ISOMETRIC FORTRESS FLIGHT SHOOTER',
      controls: 'UP/DOWN: ALTITUDE  |  LEFT/RIGHT: BANK  |  TAP Z/SPACE: FIRE (MAX 2)',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.CYAN
    });
  }
}

export default Zaxxon;
