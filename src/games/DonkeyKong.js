/**
 * DonkeyKong.js
 * Classic 1981 Girder-and-Barrel Platformer for Retro Arcade Studio.
 * Features 6 inclined steel girder tiers, working & broken ladders with foot-bound
 * mounting/dismounting, seeded 30%/70% barrel ladder trajectory logic, flaming oil drum
 * fireball spawns, deterministic jump arcs, dual Hammer powerups, and Pauline rescue stages.
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

export class DonkeyKong {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'donkeykong';
    this.title = 'Girder Titan';

    this.width = 960;
    this.height = 540;

    // Deterministic seeded PRNG for barrel trajectories
    this.rngSeed = 0x1981d04b;

    // Physics constants (deterministic jump arc & girder traversal)
    this.walkSpeed = 128;
    this.climbSpeed = 86;
    this.jumpHorizontalSpeed = 118;
    this.jumpImpulse = 248;
    this.gravity = 740;

    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.bonusTimer = 5000;
    this.bonusTickAccum = 0;

    this.state = 'PLAYING';
    this.stageClearTimer = 0;
    this.deathTimer = 0;
    this.animTime = 0;

    this.girders = [];
    this.ladders = [];
    this.hammers = [];
    this.bonusItems = [];
    this.barrels = [];
    this.fireballs = [];
    this.particles = [];
    this.popups = [];
    this.barrelIdCounter = 1;

    this.reset();
  }

  /**
   * Deterministic PRNG returning float in [0, 1)
   */
  nextRandom() {
    let t = (this.rngSeed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  setState(nextState) {
    this.state = nextState;
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.rngSeed = 0x1981d04b;
    this.state = 'PLAYING';
    this._initStage(true);
  }

  _buildStageGeometry() {
    // 6 inclined steel girder tiers (0 = bottom, 5 = Kong top girder) + tier 6 (Pauline's platform)
    // Each girder has a physical slope between (xMin, yLeft) and (xMax, yRight).
    this.girders = [
      {
        tier: 0,
        xMin: 110,
        xMax: 850,
        yLeft: 514,
        yRight: 492,
        rollDir: -1, // Barrels roll left toward flaming oil drum
        thickness: 12
      },
      {
        tier: 1,
        xMin: 110,
        xMax: 805,
        yLeft: 418,
        yRight: 440,
        rollDir: 1, // Barrels roll right
        thickness: 12
      },
      {
        tier: 2,
        xMin: 155,
        xMax: 850,
        yLeft: 368,
        yRight: 346,
        rollDir: -1, // Barrels roll left
        thickness: 12
      },
      {
        tier: 3,
        xMin: 110,
        xMax: 805,
        yLeft: 274,
        yRight: 296,
        rollDir: 1, // Barrels roll right
        thickness: 12
      },
      {
        tier: 4,
        xMin: 155,
        xMax: 850,
        yLeft: 224,
        yRight: 202,
        rollDir: -1, // Barrels roll left
        thickness: 12
      },
      {
        tier: 5,
        xMin: 110,
        xMax: 805,
        yLeft: 132,
        yRight: 150,
        rollDir: 1, // Kong stands on left; barrels roll right
        thickness: 12
      },
      {
        tier: 6,
        xMin: 360,
        xMax: 575,
        yLeft: 84,
        yRight: 84,
        rollDir: 0, // Pauline's rescue platform
        thickness: 10
      }
    ];

    // Working ladders (broken: false) and broken ladders (broken: true).
    // Barrels can roll down ANY ladder at a 30% rate; player can only climb unbroken ladders.
    this.ladders = [
      // Tier 0 -> Tier 1
      { id: 'L0_A', fromTier: 0, toTier: 1, x: 350, broken: true },
      { id: 'L0_B', fromTier: 0, toTier: 1, x: 755, broken: false },

      // Tier 1 -> Tier 2
      { id: 'L1_A', fromTier: 1, toTier: 2, x: 215, broken: false },
      { id: 'L1_B', fromTier: 1, toTier: 2, x: 470, broken: false },
      { id: 'L1_C', fromTier: 1, toTier: 2, x: 650, broken: true },

      // Tier 2 -> Tier 3
      { id: 'L2_A', fromTier: 2, toTier: 3, x: 320, broken: true },
      { id: 'L2_B', fromTier: 2, toTier: 3, x: 540, broken: false },
      { id: 'L2_C', fromTier: 2, toTier: 3, x: 755, broken: false },

      // Tier 3 -> Tier 4
      { id: 'L3_A', fromTier: 3, toTier: 4, x: 215, broken: false },
      { id: 'L3_B', fromTier: 3, toTier: 4, x: 410, broken: false },
      { id: 'L3_C', fromTier: 3, toTier: 4, x: 675, broken: true },

      // Tier 4 -> Tier 5
      { id: 'L4_A', fromTier: 4, toTier: 5, x: 495, broken: true },
      { id: 'L4_B', fromTier: 4, toTier: 5, x: 755, broken: false },

      // Tier 5 -> Tier 6 (Pauline victory ladder)
      { id: 'L5_WIN', fromTier: 5, toTier: 6, x: 545, broken: false }
    ];
  }

  /**
   * Computes exact sloped Y surface coordinate for a girder tier at horizontal coordinate x
   */
  getGirderY(tier, x) {
    const g = this.girders[tier];
    if (!g) return 514;
    const clampedX = Math.max(g.xMin, Math.min(g.xMax, x));
    const t = (clampedX - g.xMin) / Math.max(1, g.xMax - g.xMin);
    return g.yLeft + (g.yRight - g.yLeft) * t;
  }

  /**
   * Finds the highest girder tier directly supporting (x, footY) within tolerance
   */
  findGirderAt(x, footY, tolerance = 14) {
    for (let i = this.girders.length - 1; i >= 0; i--) {
      const g = this.girders[i];
      if (x >= g.xMin - 6 && x <= g.xMax + 6) {
        const gy = this.getGirderY(i, x);
        if (Math.abs(footY - gy) <= tolerance) {
          return i;
        }
      }
    }
    return -1;
  }

  _initStage(fullReset = false) {
    this._buildStageGeometry();

    this.bonusTimer = Math.max(3000, 4000 + this.level * 1000);
    this.bonusTickAccum = 0;
    this.stageClearTimer = 0;
    this.deathTimer = 0;

    // Player (Jumpman) state — y represents exact foot position
    const startX = 215;
    this.player = {
      x: startX,
      y: this.getGirderY(0, startX),
      vx: 0,
      vy: 0,
      jumpVx: 0,
      tier: 0,
      facing: 1,
      onLadder: false,
      currentLadder: null,
      jumping: false,
      jumpedBarrels: new Set(),
      hammerTimer: 0,
      hammerSwingPhase: 0,
      walkCycle: 0
    };

    // Donkey Kong state at top-left of Tier 5
    this.kong = {
      x: 195,
      y: this.getGirderY(5, 195),
      pose: 'IDLE', // 'IDLE' | 'GRAB' | 'ROLL' | 'BEAT_CHEST'
      throwTimer: 1.15,
      throwInterval: Math.max(1.55, 2.75 - (this.level - 1) * 0.22),
      animTimer: 0
    };

    // Pauline on Tier 6
    this.pauline = {
      x: 425,
      y: this.getGirderY(6, 425),
      helpTimer: 0
    };

    // Oil drum at bottom-left of Tier 0
    this.oilDrum = {
      x: 145,
      y: this.getGirderY(0, 145),
      lit: true,
      flamePhase: 0
    };

    // Two classic Hammer powerups
    this.hammers = [
      {
        id: 'H1',
        tier: 1,
        x: 285,
        y: this.getGirderY(1, 285) - 36,
        collected: false
      },
      {
        id: 'H2',
        tier: 4,
        x: 295,
        y: this.getGirderY(4, 295) - 36,
        collected: false
      }
    ];

    // Pauline's bonus items on girders
    this.bonusItems = [
      {
        type: 'PARASOL',
        points: 300,
        x: 685,
        y: this.getGirderY(2, 685) - 14,
        collected: false,
        color: PALETTE.PINK
      },
      {
        type: 'PURSE',
        points: 500,
        x: 625,
        y: this.getGirderY(4, 625) - 12,
        collected: false,
        color: PALETTE.GOLD
      },
      {
        type: 'HAT',
        points: 800,
        x: 340,
        y: this.getGirderY(5, 340) - 12,
        collected: false,
        color: PALETTE.CYAN
      }
    ];

    this.barrels = [];
    this.fireballs = [];
    this.particles = [];
    if (fullReset) {
      this.popups = [];
    }

    // Spawn an initial rolling barrel so action starts immediately
    this._spawnBarrel(false);
  }

  _addScore(points, x, y, color = PALETTE.GOLD) {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    if (typeof x === 'number' && typeof y === 'number') {
      this.popups.push({
        text: `+${points}`,
        x,
        y,
        vy: -38,
        life: 0.95,
        maxLife: 0.95,
        color
      });
    }
  }

  _spawnSparks(x, y, color = PALETTE.GOLD, count = 14) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (this.nextRandom() - 0.5) * 0.4;
      const speed = 45 + this.nextRandom() * 115;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 0.35 + this.nextRandom() * 0.25,
        maxLife: 0.6,
        size: 2 + Math.floor(this.nextRandom() * 3),
        color
      });
    }
  }

  _spawnBarrel(forceBlue = false) {
    const isBlue = forceBlue || this.nextRandom() < 0.18;
    const spawnX = this.kong.x + 36;
    const spawnY = this.getGirderY(5, spawnX);
    this.barrels.push({
      id: this.barrelIdCounter++,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
      tier: 5,
      dir: 1,
      state: 'ROLLING', // 'ROLLING' | 'LADDER' | 'FALLING'
      targetTier: 5,
      ladderX: 0,
      isBlue,
      rot: 0,
      lastTestedLadderId: null
    });
  }

  _spawnFireball() {
    const maxFireballs = Math.min(5, 2 + this.level);
    if (this.fireballs.length >= maxFireballs) return;

    const startX = this.oilDrum.x + 28;
    this.fireballs.push({
      x: startX,
      y: this.getGirderY(0, startX),
      tier: 0,
      dir: 1,
      onLadder: false,
      currentLadder: null,
      climbDir: -1, // -1 = climbing up, 1 = climbing down
      phase: this.nextRandom() * Math.PI * 2,
      decisionCooldown: 0.4
    });
  }

  update(dt) {
    const clampedDt = Math.min(dt, 0.05);
    this.animTime += clampedDt;

    // Handle state transitions
    if (this.input.isJustPressed('pause')) {
      if (this.state === 'PLAYING') {
        this.state = 'PAUSED';
        this.audio.playMenuSelect();
        return;
      } else if (this.state === 'PAUSED') {
        this.state = 'PLAYING';
        this.audio.playMenuSelect();
        return;
      }
    }

    if (this.state === 'MENU') {
      if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.state === 'PAUSED') {
      if (this.input.isJustPressed('actionA')) {
        this.audio.playMenuSelect();
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.state === 'GAMEOVER') {
      if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'PLAYING';
      }
      return;
    }

    // Update particles & floating score popups even during brief stage clear / death sequences
    this._updateParticlesAndPopups(clampedDt);

    if (this.stageClearTimer > 0) {
      this.stageClearTimer -= clampedDt;
      if (this.stageClearTimer <= 0) {
        this.level += 1;
        this._initStage(false);
      }
      return;
    }

    if (this.deathTimer > 0) {
      this.deathTimer -= clampedDt;
      if (this.deathTimer <= 0) {
        this.lives -= 1;
        if (this.lives <= 0) {
          HighScoreStore.submit(this.id, this.score);
          this.state = 'GAMEOVER';
          this.audio.playGameOver();
        } else {
          this._initStage(false);
        }
      }
      return;
    }

    // Bonus countdown timer
    this.bonusTickAccum += clampedDt;
    if (this.bonusTickAccum >= 2.0) {
      this.bonusTickAccum -= 2.0;
      this.bonusTimer = Math.max(0, this.bonusTimer - 100);
    }

    this._updateKong(clampedDt);
    this._updatePlayer(clampedDt);
    this._updateBarrels(clampedDt);
    this._updateFireballs(clampedDt);
    this._checkPickupsAndCombat();
  }

  _updateParticlesAndPopups(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y += pop.vy * dt;
      pop.life -= dt;
      if (pop.life <= 0) {
        this.popups.splice(i, 1);
      }
    }
  }

  _updateKong(dt) {
    this.kong.animTimer += dt;
    this.kong.throwTimer -= dt;
    this.oilDrum.flamePhase += dt * 9;
    this.pauline.helpTimer += dt;

    if (this.kong.throwTimer <= 0.65 && this.kong.throwTimer > 0.25) {
      this.kong.pose = 'GRAB';
    } else if (this.kong.throwTimer <= 0.25 && this.kong.throwTimer > 0) {
      this.kong.pose = 'ROLL';
    } else if (this.kong.throwTimer <= 0) {
      this._spawnBarrel();
      this.kong.throwTimer = this.kong.throwInterval;
      this.kong.pose = 'BEAT_CHEST';
    } else if (this.kong.throwTimer < this.kong.throwInterval - 0.45) {
      this.kong.pose = 'IDLE';
    }
  }

  _updatePlayer(dt) {
    const p = this.player;

    if (p.hammerTimer > 0) {
      p.hammerTimer = Math.max(0, p.hammerTimer - dt);
      p.hammerSwingPhase += dt * 22;
    }

    const moveX = (this.input.isDown('right') ? 1 : 0) - (this.input.isDown('left') ? 1 : 0);
    const moveY = (this.input.isDown('down') ? 1 : 0) - (this.input.isDown('up') ? 1 : 0);

    // 1. Ladder climbing and foot-position bounds detachment check
    if (p.onLadder && p.currentLadder) {
      const ladder = p.currentLadder;
      const topY = this.getGirderY(ladder.toTier, ladder.x);
      const bottomY = this.getGirderY(ladder.fromTier, ladder.x);

      p.x = ladder.x;
      if (moveY !== 0) {
        p.y += moveY * this.climbSpeed * dt;
        p.walkCycle += dt * 10;
      }

      // Check foot-position bounds at top and bottom girder surfaces
      const playerFootY = p.y;
      if (playerFootY <= topY) {
        p.y = topY;
        p.tier = ladder.toTier;
        p.onLadder = false;
        p.currentLadder = null;
        if (p.tier === 6) {
          this._triggerStageClear();
        }
        return;
      }
      if (playerFootY >= bottomY) {
        p.y = bottomY;
        p.tier = ladder.fromTier;
        p.onLadder = false;
        p.currentLadder = null;
        return;
      }

      // Allow smooth horizontal dismount when player's feet are right at either girder surface
      if (moveX !== 0) {
        if (Math.abs(playerFootY - bottomY) <= 7) {
          p.y = bottomY;
          p.tier = ladder.fromTier;
          p.onLadder = false;
          p.currentLadder = null;
        } else if (Math.abs(playerFootY - topY) <= 7) {
          p.y = topY;
          p.tier = ladder.toTier;
          p.onLadder = false;
          p.currentLadder = null;
          if (p.tier === 6) {
            this._triggerStageClear();
          }
        }
      }
      return;
    }

    // 2. Discrete jump arc with deterministic horizontal impulse locked at take-off
    if (p.jumping) {
      p.x += p.jumpVx * dt;
      const g = this.girders[p.tier];
      p.x = Math.max(g.xMin + 8, Math.min(g.xMax - 8, p.x));

      p.y += p.vy * dt;
      p.vy += this.gravity * dt;

      // Detect barrels jumped cleanly over while airborne
      for (const b of this.barrels) {
        if (
          Math.abs(b.x - p.x) < 22 &&
          b.y >= p.y &&
          b.y - p.y < 54
        ) {
          p.jumpedBarrels.add(b.id);
        }
      }

      const surfaceY = this.getGirderY(p.tier, p.x);
      if (p.vy > 0 && p.y >= surfaceY) {
        p.y = surfaceY;
        p.vy = 0;
        p.jumpVx = 0;
        p.jumping = false;

        if (p.jumpedBarrels.size > 0) {
          const count = p.jumpedBarrels.size;
          const bonus = count === 1 ? 100 : count === 2 ? 300 : 500;
          this._addScore(bonus, p.x, p.y - 28, PALETTE.CYAN);
          this.audio.playCoin();
          p.jumpedBarrels.clear();
        }
      }
      return;
    }

    // 3. Check for mounting working ladders (disabled during Hammer Mode)
    if (p.hammerTimer <= 0) {
      if (this.input.isDown('up')) {
        const upLadder = this.ladders.find(
          (l) => !l.broken && l.fromTier === p.tier && Math.abs(l.x - p.x) <= 14
        );
        if (upLadder) {
          p.onLadder = true;
          p.currentLadder = upLadder;
          p.x = upLadder.x;
          p.y = this.getGirderY(upLadder.fromTier, upLadder.x) - 2;
          return;
        }
      }

      if (this.input.isDown('down')) {
        const downLadder = this.ladders.find(
          (l) => !l.broken && l.toTier === p.tier && Math.abs(l.x - p.x) <= 14
        );
        if (downLadder) {
          p.onLadder = true;
          p.currentLadder = downLadder;
          p.x = downLadder.x;
          p.y = this.getGirderY(downLadder.toTier, downLadder.x) + 2;
          return;
        }
      }

      // Trigger discrete jump arc
      if (this.input.isJustPressed('actionA')) {
        p.jumping = true;
        p.jumpVx = moveX * this.jumpHorizontalSpeed;
        if (moveX !== 0) p.facing = moveX;
        p.vy = -this.jumpImpulse;
        p.jumpedBarrels.clear();
        this.audio.playJump();
        return;
      }
    }

    // 4. Walking along inclined girder surface
    const girder = this.girders[p.tier];
    if (moveX !== 0) {
      p.facing = moveX;
      p.x += moveX * this.walkSpeed * dt;
      p.walkCycle += dt * 12;
    }

    // Handle girder edge boundaries (walking off edge drops to lower tier if available)
    if (p.x < girder.xMin) {
      if (p.tier > 0 && p.x < girder.xMin - 4) {
        p.tier -= 1;
      } else {
        p.x = girder.xMin;
      }
    } else if (p.x > girder.xMax) {
      if (p.tier > 0 && p.x > girder.xMax + 4) {
        p.tier -= 1;
      } else {
        p.x = girder.xMax;
      }
    }

    // Snap foot position to the inclined girder slope
    p.y = this.getGirderY(p.tier, p.x);
  }

  _updateBarrels(dt) {
    const rollSpeed = 148 + (this.level - 1) * 16;
    const ladderDropSpeed = 165 + (this.level - 1) * 14;

    for (let i = this.barrels.length - 1; i >= 0; i--) {
      const b = this.barrels[i];
      b.rot += b.dir * dt * 8;

      if (b.state === 'ROLLING') {
        const g = this.girders[b.tier];
        b.dir = g.rollDir || b.dir;
        b.x += b.dir * rollSpeed * dt;
        b.y = this.getGirderY(b.tier, b.x);

        // Check ladder intersections on current tier:
        // 30% chance to roll down the ladder, 70% chance to continue straight
        for (const ladder of this.ladders) {
          if (
            ladder.toTier === b.tier &&
            b.lastTestedLadderId !== ladder.id &&
            Math.abs(b.x - ladder.x) <= 5
          ) {
            b.lastTestedLadderId = ladder.id;
            if (this.nextRandom() < 0.30) {
              b.state = 'LADDER';
              b.x = ladder.x;
              b.targetTier = ladder.fromTier;
              break;
            }
          }
        }

        if (b.state !== 'ROLLING') continue;

        // Check oil drum ignition on Tier 0
        if (b.tier === 0 && b.x <= this.oilDrum.x + 18) {
          this.oilDrum.lit = true;
          this._spawnSparks(this.oilDrum.x, this.oilDrum.y - 22, PALETTE.ORANGE, 12);
          this._spawnFireball();
          this.barrels.splice(i, 1);
          continue;
        }

        // Check falling off girder end
        if ((b.dir > 0 && b.x >= g.xMax) || (b.dir < 0 && b.x <= g.xMin)) {
          if (b.tier > 0) {
            b.state = 'FALLING';
            b.targetTier = b.tier - 1;
            b.vy = 20;
            b.lastTestedLadderId = null;
          } else {
            this.barrels.splice(i, 1);
          }
        }
      } else if (b.state === 'LADDER') {
        b.y += ladderDropSpeed * dt;
        const targetY = this.getGirderY(b.targetTier, b.x);
        if (b.y >= targetY) {
          b.y = targetY;
          b.tier = b.targetTier;
          b.dir = this.girders[b.tier].rollDir;
          b.state = 'ROLLING';
          b.lastTestedLadderId = null;
        }
      } else if (b.state === 'FALLING') {
        b.x += b.dir * 34 * dt;
        b.vy += this.gravity * dt;
        b.y += b.vy * dt;
        const targetY = this.getGirderY(b.targetTier, b.x);
        if (b.y >= targetY) {
          b.y = targetY;
          b.tier = b.targetTier;
          b.dir = this.girders[b.tier].rollDir;
          b.state = 'ROLLING';
          b.vy = 0;
          b.lastTestedLadderId = null;
        }
      }
    }
  }

  _updateFireballs(dt) {
    const speed = 72 + (this.level - 1) * 10;

    for (const f of this.fireballs) {
      f.phase += dt * 10;
      f.decisionCooldown = Math.max(0, f.decisionCooldown - dt);

      if (f.onLadder && f.currentLadder) {
        const l = f.currentLadder;
        const topY = this.getGirderY(l.toTier, l.x);
        const bottomY = this.getGirderY(l.fromTier, l.x);
        f.x = l.x;
        f.y += f.climbDir * speed * 0.85 * dt;

        if (f.climbDir < 0 && f.y <= topY) {
          f.y = topY;
          f.tier = l.toTier;
          f.onLadder = false;
          f.currentLadder = null;
          f.dir = this.player.x >= f.x ? 1 : -1;
          f.decisionCooldown = 0.5;
        } else if (f.climbDir > 0 && f.y >= bottomY) {
          f.y = bottomY;
          f.tier = l.fromTier;
          f.onLadder = false;
          f.currentLadder = null;
          f.dir = this.player.x >= f.x ? 1 : -1;
          f.decisionCooldown = 0.5;
        }
        continue;
      }

      const g = this.girders[f.tier];
      f.x += f.dir * speed * dt;
      if (f.x <= g.xMin + 24) {
        f.x = g.xMin + 24;
        f.dir = 1;
      } else if (f.x >= g.xMax - 24) {
        f.x = g.xMax - 24;
        f.dir = -1;
      }
      f.y = this.getGirderY(f.tier, f.x);

      // Periodically climb unbroken ladders toward player's tier
      if (f.decisionCooldown <= 0) {
        for (const l of this.ladders) {
          if (l.broken || l.toTier === 6) continue;
          if (l.fromTier === f.tier && Math.abs(l.x - f.x) < 6) {
            f.decisionCooldown = 0.6;
            const wantsUp = this.player.tier > f.tier ? 0.65 : 0.25;
            if (this.nextRandom() < wantsUp) {
              f.onLadder = true;
              f.currentLadder = l;
              f.climbDir = -1;
              break;
            }
          } else if (l.toTier === f.tier && Math.abs(l.x - f.x) < 6) {
            f.decisionCooldown = 0.6;
            const wantsDown = this.player.tier < f.tier ? 0.6 : 0.2;
            if (this.nextRandom() < wantsDown) {
              f.onLadder = true;
              f.currentLadder = l;
              f.climbDir = 1;
              break;
            }
          }
        }
      }
    }
  }

  _getHammerHitbox() {
    const p = this.player;
    if (p.hammerTimer <= 0) return null;
    const strikeDown = Math.sin(p.hammerSwingPhase) >= 0;
    if (strikeDown) {
      return {
        x: p.x + p.facing * 22,
        y: p.y - 12,
        r: 18
      };
    }
    return {
      x: p.x + p.facing * 4,
      y: p.y - 34,
      r: 16
    };
  }

  _checkPickupsAndCombat() {
    const p = this.player;

    // 1. Hammer pickups
    for (const h of this.hammers) {
      if (!h.collected && Math.hypot(p.x - h.x, (p.y - 16) - h.y) < 24) {
        h.collected = true;
        p.hammerTimer = 9.0;
        p.hammerSwingPhase = 0;
        this.audio.playPowerUp();
        this._spawnSparks(h.x, h.y, PALETTE.GOLD, 16);
      }
    }

    // 2. Pauline's bonus items
    for (const item of this.bonusItems) {
      if (!item.collected && Math.hypot(p.x - item.x, (p.y - 12) - item.y) < 22) {
        item.collected = true;
        this._addScore(item.points, item.x, item.y - 10, item.color);
        this.audio.playCoin();
        this._spawnSparks(item.x, item.y, item.color, 12);
      }
    }

    const hammerBox = this._getHammerHitbox();

    // 3. Barrel collisions vs Hammer or Player body
    for (let i = this.barrels.length - 1; i >= 0; i--) {
      const b = this.barrels[i];
      const bx = b.x;
      const by = b.y - 9;

      if (hammerBox && Math.hypot(bx - hammerBox.x, by - hammerBox.y) < hammerBox.r + 10) {
        const pts = b.isBlue ? 500 : 300;
        this._addScore(pts, bx, by - 10, b.isBlue ? PALETTE.CYAN : PALETTE.GOLD);
        this._spawnSparks(bx, by, b.isBlue ? PALETTE.CYAN : PALETTE.ORANGE, 18);
        this.renderer.shake(5, 0.14);
        this.audio.playExplosion(0.2, 1200);
        this.audio.playCoin();
        this.barrels.splice(i, 1);
        continue;
      }

      // Player body hitbox
      if (Math.hypot(bx - p.x, by - (p.y - 13)) < 14) {
        this._triggerPlayerDeath();
        return;
      }
    }

    // 4. Fireball collisions vs Hammer or Player body
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const f = this.fireballs[i];
      const fx = f.x;
      const fy = f.y - 10;

      if (hammerBox && Math.hypot(fx - hammerBox.x, fy - hammerBox.y) < hammerBox.r + 10) {
        this._addScore(300, fx, fy - 10, PALETTE.PINK);
        this._spawnSparks(fx, fy, PALETTE.PINK, 18);
        this.renderer.shake(5, 0.14);
        this.audio.playExplosion(0.22, 1400);
        this.audio.playCoin();
        this.fireballs.splice(i, 1);
        continue;
      }

      if (Math.hypot(fx - p.x, fy - (p.y - 13)) < 14) {
        this._triggerPlayerDeath();
        return;
      }
    }

    // 5. Touching Donkey Kong directly
    if (p.tier === 5 && Math.abs(p.x - this.kong.x) < 34) {
      this._triggerPlayerDeath();
    }
  }

  _triggerPlayerDeath() {
    if (this.deathTimer > 0 || this.stageClearTimer > 0) return;
    this.deathTimer = 1.35;
    this.renderer.shake(9, 0.32);
    this.audio.playHit();
    this._spawnSparks(this.player.x, this.player.y - 14, PALETTE.RED, 24);
  }

  _triggerStageClear() {
    if (this.stageClearTimer > 0) return;
    this.stageClearTimer = 2.0;
    this._addScore(this.bonusTimer, this.pauline.x + 35, this.pauline.y - 28, PALETTE.GOLD);
    this._spawnSparks(this.pauline.x + 25, this.pauline.y - 24, PALETTE.PINK, 26);
    this.audio.playStageClear();
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear(PALETTE.BG);

    // Subtle industrial arcade backdrop grid
    this._drawBackdrop(ctx);

    // Ladders (drawn behind girders so rungs tuck cleanly into steel beams)
    this._drawLadders(ctx);

    // Inclined steel girders with rivets
    this._drawGirders(ctx);

    // Oil drum, barrel stack, Pauline, Donkey Kong, Hammers, Bonus Items
    this._drawStageProps(ctx);
    this._drawPauline(ctx);
    this._drawKong(ctx);

    // Active Barrels & Fireballs
    this._drawBarrels(ctx);
    this._drawFireballs(ctx);

    // Jumpman & Hammer
    this._drawPlayer(ctx);

    // Sparks & floating score popups
    this._drawParticlesAndPopups(ctx);

    // Top HUD & Bonus Box
    this.renderer.drawHUD({
      title: 'GIRDER TITAN',
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `BONUS:${String(this.bonusTimer).padStart(4, '0')}`,
      accent: PALETTE.RED
    });

    this.renderer.drawStateOverlay(this.state, {
      title: 'GIRDER TITAN',
      subtitle: '25M INCLINED GIRDER & BARREL ARCADE EDITION',
      controls: 'ARROWS/WASD: CLIMB & RUN  |  Z/SPACE: JUMP BARRELS  |  HAMMER: AUTO-SMASH',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.RED
    });
  }

  _drawBackdrop(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 42, 85, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 80; x < 900; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 40);
      ctx.lineTo(x, 540);
      ctx.stroke();
    }

    // Classic arcade BONUS timer box in top-right corner
    ctx.fillStyle = 'rgba(19, 27, 46, 0.9)';
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.lineWidth = 2;
    ctx.fillRect(790, 50, 140, 54);
    ctx.strokeRect(790, 50, 140, 54);

    this.renderer.drawText('BONUS', 860, 68, {
      font: FONTS.HEADER,
      size: 11,
      color: PALETTE.PINK,
      align: 'center'
    });
    this.renderer.drawText(String(this.bonusTimer).padStart(4, '0'), 860, 94, {
      font: FONTS.HEADER,
      size: 15,
      color: PALETTE.CYAN,
      align: 'center',
      glow: 8
    });
    ctx.restore();
  }

  _drawGirders(ctx) {
    ctx.save();
    for (const g of this.girders) {
      const y1 = g.yLeft;
      const y2 = g.yRight;
      const h = g.thickness;

      // Top & bottom neon red/pink flanges
      ctx.strokeStyle = PALETTE.RED;
      ctx.lineWidth = 3;
      ctx.shadowColor = PALETTE.RED;
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.moveTo(g.xMin, y1);
      ctx.lineTo(g.xMax, y2);
      ctx.moveTo(g.xMin, y1 + h);
      ctx.lineTo(g.xMax, y2 + h);
      ctx.stroke();

      // Diagonal truss webbing inside the sloped girder
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#FF5588';
      ctx.lineWidth = 1.5;
      const span = g.xMax - g.xMin;
      const steps = Math.floor(span / 18);
      ctx.beginPath();
      for (let i = 0; i < steps; i++) {
        const xa = g.xMin + i * 18;
        const xb = Math.min(g.xMax, xa + 18);
        const ya = this.getGirderY(g.tier, xa);
        const yb = this.getGirderY(g.tier, xb);
        if (i % 2 === 0) {
          ctx.moveTo(xa, ya);
          ctx.lineTo(xb, yb + h);
        } else {
          ctx.moveTo(xa, ya + h);
          ctx.lineTo(xb, yb);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawLadders(ctx) {
    ctx.save();
    for (const l of this.ladders) {
      const topY = this.getGirderY(l.toTier, l.x);
      const bottomY = this.getGirderY(l.fromTier, l.x);
      const halfW = 9;

      ctx.strokeStyle = l.broken ? '#4E8098' : PALETTE.CYAN;
      ctx.lineWidth = 2;

      if (!l.broken) {
        // Full climbable ladder
        ctx.beginPath();
        ctx.moveTo(l.x - halfW, topY);
        ctx.lineTo(l.x - halfW, bottomY);
        ctx.moveTo(l.x + halfW, topY);
        ctx.lineTo(l.x + halfW, bottomY);
        for (let ry = topY + 6; ry < bottomY - 2; ry += 8) {
          ctx.moveTo(l.x - halfW, ry);
          ctx.lineTo(l.x + halfW, ry);
        }
        ctx.stroke();
      } else {
        // Broken ladder: top stub and bottom stub with gap in the middle
        const span = bottomY - topY;
        const gapTop = topY + span * 0.32;
        const gapBot = topY + span * 0.68;

        ctx.beginPath();
        ctx.moveTo(l.x - halfW, topY);
        ctx.lineTo(l.x - halfW, gapTop);
        ctx.moveTo(l.x + halfW, topY);
        ctx.lineTo(l.x + halfW, gapTop);

        ctx.moveTo(l.x - halfW, gapBot);
        ctx.lineTo(l.x - halfW, bottomY);
        ctx.moveTo(l.x + halfW, gapBot);
        ctx.lineTo(l.x + halfW, bottomY);

        for (let ry = topY + 6; ry < gapTop; ry += 8) {
          ctx.moveTo(l.x - halfW, ry);
          ctx.lineTo(l.x + halfW, ry);
        }
        for (let ry = gapBot + 4; ry < bottomY - 2; ry += 8) {
          ctx.moveTo(l.x - halfW, ry);
          ctx.lineTo(l.x + halfW, ry);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  _drawStageProps(ctx) {
    ctx.save();
    // 1. Barrel reserve stack behind Donkey Kong (top-left of Tier 5)
    const stackX = 122;
    const stackY = this.getGirderY(5, stackX);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const bx = stackX + c * 16;
        const by = stackY - 12 - r * 18;
        ctx.fillStyle = '#B45309';
        ctx.fillRect(bx, by, 14, 16);
        ctx.strokeStyle = PALETTE.GOLD;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx, by, 14, 16);
      }
    }

    // 2. Flaming Oil Drum at bottom-left of Tier 0
    const ox = this.oilDrum.x;
    const oy = this.oilDrum.y;
    ctx.fillStyle = '#1E3A8A';
    ctx.fillRect(ox - 14, oy - 30, 28, 30);
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.lineWidth = 2;
    ctx.strokeRect(ox - 14, oy - 30, 28, 30);
    this.renderer.drawText('OIL', ox, oy - 11, {
      font: FONTS.HEADER,
      size: 7,
      color: PALETTE.GOLD,
      align: 'center'
    });

    if (this.oilDrum.lit) {
      const flicker = Math.sin(this.oilDrum.flamePhase) * 4;
      ctx.fillStyle = PALETTE.ORANGE;
      ctx.shadowColor = PALETTE.ORANGE;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(ox - 12, oy - 30);
      ctx.lineTo(ox - 5, oy - 46 - flicker);
      ctx.lineTo(ox + 2, oy - 35);
      ctx.lineTo(ox + 8, oy - 48 + flicker);
      ctx.lineTo(ox + 12, oy - 30);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 3. Hammer Powerups
    for (const h of this.hammers) {
      if (h.collected) continue;
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(h.x - 2, h.y, 4, 14);
      ctx.fillStyle = PALETTE.RED;
      ctx.strokeStyle = PALETTE.GOLD;
      ctx.lineWidth = 1.5;
      ctx.fillRect(h.x - 9, h.y - 7, 18, 9);
      ctx.strokeRect(h.x - 9, h.y - 7, 18, 9);
    }

    // 4. Bonus Items
    for (const item of this.bonusItems) {
      if (item.collected) continue;
      ctx.fillStyle = item.color;
      ctx.shadowColor = item.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(item.x, item.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  _drawPauline(ctx) {
    const px = this.pauline.x;
    const py = this.pauline.y;
    const bounce = Math.sin(this.pauline.helpTimer * 6) > 0 ? -2 : 0;

    ctx.save();
    // Golden hair
    ctx.fillStyle = PALETTE.GOLD;
    ctx.fillRect(px - 6, py - 28 + bounce, 12, 8);
    // Pink dress
    ctx.fillStyle = PALETTE.PINK;
    ctx.fillRect(px - 7, py - 20 + bounce, 14, 14);
    // Feet
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(px - 5, py - 6, 4, 6);
    ctx.fillRect(px + 1, py - 6, 4, 6);

    if (this.stageClearTimer > 0) {
      // Victory heart between Pauline and Jumpman
      this.renderer.drawText('STAGE CLEAR!', px + 55, py - 36, {
        font: FONTS.HEADER,
        size: 11,
        color: PALETTE.GOLD,
        align: 'center',
        glow: 10
      });
    } else if (Math.sin(this.pauline.helpTimer * 3) > -0.2) {
      this.renderer.drawText('HELP!', px + 34, py - 24, {
        font: FONTS.HEADER,
        size: 9,
        color: PALETTE.CYAN,
        align: 'left',
        glow: 6
      });
    }
    ctx.restore();
  }

  _drawKong(ctx) {
    const kx = this.kong.x;
    const ky = this.kong.y;
    ctx.save();

    // Muscular torso & fur
    ctx.fillStyle = '#92400E';
    ctx.fillRect(kx - 24, ky - 44, 48, 32);
    // Chest plate
    ctx.fillStyle = '#D97706';
    ctx.fillRect(kx - 14, ky - 36, 28, 18);
    // Head & grin
    ctx.fillStyle = '#92400E';
    ctx.fillRect(kx - 16, ky - 58, 32, 16);
    ctx.fillStyle = '#FDE68A';
    ctx.fillRect(kx - 10, ky - 49, 20, 5);
    // Eyes
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(kx - 8, ky - 55, 5, 4);
    ctx.fillRect(kx + 3, ky - 55, 5, 4);

    // Legs
    ctx.fillStyle = '#78350F';
    ctx.fillRect(kx - 20, ky - 12, 12, 12);
    ctx.fillRect(kx + 8, ky - 12, 12, 12);

    // Arms based on Kong's barrel-throwing pose
    ctx.fillStyle = '#92400E';
    if (this.kong.pose === 'GRAB') {
      ctx.fillRect(kx - 36, ky - 42, 14, 14);
      ctx.fillRect(kx + 22, ky - 40, 12, 14);
    } else if (this.kong.pose === 'ROLL') {
      ctx.fillRect(kx - 28, ky - 40, 10, 14);
      ctx.fillRect(kx + 24, ky - 30, 18, 12);
    } else {
      const armOffset = Math.sin(this.animTime * 8) > 0 ? -6 : 2;
      ctx.fillRect(kx - 34, ky - 44 + armOffset, 12, 18);
      ctx.fillRect(kx + 22, ky - 44 - armOffset, 12, 18);
    }

    ctx.restore();
  }

  _drawBarrels(ctx) {
    ctx.save();
    for (const b of this.barrels) {
      const cx = b.x;
      const cy = b.y - 9;
      const mainColor = b.isBlue ? PALETTE.CYAN : '#D97706';
      const rimColor = b.isBlue ? PALETTE.WHITE : PALETTE.GOLD;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(b.rot);

      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = rimColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.moveTo(-7, 0);
      ctx.lineTo(7, 0);
      ctx.moveTo(0, -7);
      ctx.lineTo(0, 7);
      ctx.stroke();

      ctx.restore();
    }
    ctx.restore();
  }

  _drawFireballs(ctx) {
    ctx.save();
    for (const f of this.fireballs) {
      const fx = f.x;
      const fy = f.y - 10 + Math.sin(f.phase) * 2;
      ctx.fillStyle = PALETTE.ORANGE;
      ctx.shadowColor = PALETTE.RED;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(fx, fy, 8, 0, Math.PI * 2);
      ctx.fill();

      // Flame crown
      ctx.fillStyle = PALETTE.GOLD;
      ctx.beginPath();
      ctx.moveTo(fx - 6, fy - 4);
      ctx.lineTo(fx, fy - 14);
      ctx.lineTo(fx + 6, fy - 4);
      ctx.closePath();
      ctx.fill();

      // Eyes
      ctx.shadowBlur = 0;
      ctx.fillStyle = PALETTE.BG;
      ctx.fillRect(fx - 4, fy - 2, 2, 3);
      ctx.fillRect(fx + 2, fy - 2, 2, 3);
    }
    ctx.restore();
  }

  _drawPlayer(ctx) {
    const p = this.player;
    ctx.save();

    if (this.deathTimer > 0) {
      ctx.translate(p.x, p.y - 12);
      ctx.rotate(this.deathTimer * 10);
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(-8, -8, 16, 16);
      ctx.restore();
      return;
    }

    const px = Math.round(p.x);
    const py = Math.round(p.y);
    const stride = p.jumping ? 3 : Math.sin(p.walkCycle) * 3;

    // Red cap & visor
    ctx.fillStyle = PALETTE.RED;
    ctx.fillRect(px - 6, py - 26, 12, 4);
    ctx.fillRect(px + (p.facing > 0 ? 0 : -8), py - 24, 8, 2);

    // Face
    ctx.fillStyle = '#FDE68A';
    ctx.fillRect(px - 5, py - 22, 10, 6);

    // Blue shirt & red overalls
    ctx.fillStyle = PALETTE.BLUE;
    ctx.fillRect(px - 6, py - 16, 12, 9);
    ctx.fillStyle = PALETTE.RED;
    ctx.fillRect(px - 5, py - 11, 10, 6);

    // Boots
    ctx.fillStyle = PALETTE.GOLD;
    ctx.fillRect(px - 6 + stride, py - 5, 5, 5);
    ctx.fillRect(px + 1 - stride, py - 5, 5, 5);

    // Active Hammer swing visual
    const hammerBox = this._getHammerHitbox();
    if (hammerBox) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, py - 14);
      ctx.lineTo(hammerBox.x, hammerBox.y);
      ctx.stroke();

      ctx.fillStyle = PALETTE.GOLD;
      ctx.shadowColor = PALETTE.GOLD;
      ctx.shadowBlur = 10;
      ctx.fillRect(hammerBox.x - 8, hammerBox.y - 6, 16, 12);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  _drawParticlesAndPopups(ctx) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    for (const pop of this.popups) {
      ctx.globalAlpha = Math.max(0, pop.life / pop.maxLife);
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HEADER,
        size: 11,
        color: pop.color,
        align: 'center',
        glow: 8
      });
    }
    ctx.restore();
  }

  destroy() {
    this.barrels = [];
    this.fireballs = [];
    this.particles = [];
    this.popups = [];
  }
}

export default DonkeyKong;
