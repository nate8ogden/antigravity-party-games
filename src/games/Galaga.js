/**
 * Galaga.js
 * Flagship Deluxe Arcade Implementation of Galaga (1981) for Retro Arcade Studio.
 *
 * Features:
 * - 40-enemy 4-row formation (4 Boss Galaga, 8 Goei butterflies, 28 Zako bees)
 * - Choreographed squadron wave entries along multi-segment cubic Bezier curves
 *   (Vector2.cubicBezier) with tangent-aligned ship orientation
 * - Multi-segment Bezier dive-bombing attack runs & synchronized Boss + Goei escorts
 * - Boss Galaga Tractor Beam field (animated sine-wave energy cone at y = 330),
 *   spinning fighter capture sequence, and captive ship rescue -> Dual Fighter Mode
 *   (twin docked fighters firing 4 simultaneous laser bolts per volley)
 * - 3-layer dynamic parallax neon starfield with warp speed shifts during wave transitions
 */
import { Vector2 } from '../engine/Vector2.js';
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const SPRITES = {
  PLAYER: [
    '.....WW.....',
    '.....WW.....',
    '....WWWW....',
    '....WBBW....',
    '...WWBBWW...',
    '..WRWWWWWR..',
    '..WRWWWWWR..',
    '.WWRWWWWWRWW',
    '.WWRW..WRWW.',
    'WWWRW..WRWWW',
    'WW.R....R.WW',
    'W..........W'
  ],
  BOSS_FULL: [
    '....GGGG....',
    '..GGGGGGGG..',
    '.GGRGGGGGRG.',
    '.GGRGGGGGRG.',
    'GGGGYYYYGGGG',
    'GGGGYYYYGGGG',
    '.GGGBBBBGGG.',
    '..GGBBBBGG..',
    '.GG.BBBB.GG.',
    'GG...BB...GG',
    'G..........G'
  ],
  BOSS_FULL_ALT: [
    '....GGGG....',
    '..GGGGGGGG..',
    '..GRGGGGGR..',
    '.GGRGGGGGRG.',
    'GGGGYYYYGGGG',
    '.GGGYYYYGGG.',
    '..GGBBBBGG..',
    '.GGGBBBBGGG.',
    'GGG.BBBB.GGG',
    'G....BB....G',
    '............'
  ],
  BOSS_HIT: [
    '....BBBB....',
    '..BBBBBBBB..',
    '.BBRBBBBBRB.',
    '.BBRBBBBBRB.',
    'BBBBPPPPBBBB',
    'BBBBPPPPBBBB',
    '.BBBCCCCBBB.',
    '..BBCCCCBB..',
    '.BB.CCCC.BB.',
    'BB...CC...BB',
    'B..........B'
  ],
  GOEI_0: [
    '..RR....RR..',
    '.RRRR..RRRR.',
    'RRRRWWWWWRRRR',
    'RRRWWWWWWWRRR',
    '.RRRRRRRRRR.',
    '..RRWWWWWRR.',
    '...RRRRRRR..',
    '..RR.RRR.RR.',
    '.RR.......RR'
  ],
  GOEI_1: [
    '....R..R....',
    '..RRR..RRR..',
    '.RRRWWWWWRRR.',
    '.RRWWWWWWWRR.',
    '..RRRRRRRRR..',
    '...RWWWWWR...',
    '...RRRRRRR...',
    '....R.R.R....',
    '.............'
  ],
  ZAKO_0: [
    '...YY..YY...',
    '..YYYYYYYY..',
    '.YYBBYYBBYY.',
    'YYYYYYYYYYYY',
    '.YYYRRRRYYY.',
    '..YYRRRRYY..',
    '...YYYYYY...',
    '..YY.YY.YY..',
    '.YY......YY.'
  ],
  ZAKO_1: [
    '....Y..Y....',
    '...YYYYYY...',
    '..YBBYYBBY..',
    '..YYYYYYYY..',
    '..YYRRRRYY..',
    '...YRRRRY...',
    '...YYYYYY...',
    '....Y..Y....',
    '............'
  ]
};

const SPRITE_PALETTES = {
  PLAYER: {
    W: PALETTE.WHITE,
    R: PALETTE.RED,
    B: PALETTE.CYAN
  },
  PLAYER_CAPTURED: {
    W: '#FCA5A5',
    R: PALETTE.PINK,
    B: PALETTE.GOLD
  },
  BOSS_FULL: {
    G: PALETTE.GREEN,
    R: PALETTE.RED,
    Y: PALETTE.GOLD,
    B: PALETTE.CYAN
  },
  BOSS_HIT: {
    B: PALETTE.BLUE,
    R: PALETTE.PINK,
    P: PALETTE.PURPLE,
    C: PALETTE.CYAN
  },
  GOEI: {
    R: PALETTE.RED,
    W: PALETTE.WHITE
  },
  ZAKO: {
    Y: PALETTE.GOLD,
    B: PALETTE.BLUE,
    R: PALETTE.PINK
  }
};

export class Galaga {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'galaga';
    this.title = 'Galaga';
    this.state = 'PLAYING';

    this.width = 960;
    this.height = 540;

    this.highScore = HighScoreStore.get(this.id);
    this.stars = [];
    this._initStarfield();
    this.reset();
  }

  _initStarfield() {
    this.stars = [];
    const layerConfigs = [
      { count: 48, speed: 32, size: 1.5, alpha: 0.45, colors: [PALETTE.MUTED, PALETTE.BLUE, PALETTE.WHITE] },
      { count: 36, speed: 75, size: 2.0, alpha: 0.72, colors: [PALETTE.CYAN, PALETTE.WHITE, PALETTE.GOLD] },
      { count: 22, speed: 145, size: 2.6, alpha: 0.95, colors: [PALETTE.CYAN, PALETTE.PINK, PALETTE.GREEN, PALETTE.GOLD] }
    ];

    layerConfigs.forEach((cfg, layerIdx) => {
      for (let i = 0; i < cfg.count; i++) {
        this.stars.push({
          x: Math.random() * this.width,
          y: 40 + Math.random() * (this.height - 40),
          layer: layerIdx,
          baseSpeed: cfg.speed * (0.85 + Math.random() * 0.3),
          size: cfg.size,
          alpha: cfg.alpha,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 2.5 + Math.random() * 4.5,
          color: cfg.colors[i % cfg.colors.length]
        });
      }
    });
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.player = {
      x: this.width / 2,
      y: 486,
      vx: 0,
      speed: 330,
      invulnTimer: 1.5,
      fireCooldown: 0,
      capturedState: 'none', // 'none' | 'being_captured'
      captureTimer: 0,
      captureBoss: null,
      angle: 0
    };

    this.dualFighter = false;
    this.rescuedFighter = null; // Transitioning fighter docking with player

    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.particles = [];
    this.floatingTexts = [];

    this.formationTime = 0;
    this.formationOffsetX = 0;
    this.formationBreathe = 0;
    this.diveTimer = 1.8;
    this.starSpeedMult = 1.8;
    this.bannerText = 'STAGE 1 — READY';
    this.bannerTimer = 2.0;

    this._spawnWave(this.level);
  }

  setState(nextState) {
    this.state = nextState;
  }

  destroy() {
    if (this.audio) {
      this.audio.stopSequence();
    }
  }

  _getFormationSlotPos(row, col) {
    // 10 columns centered across x = 480
    const baseSpacingX = 48;
    const baseSpacingY = 34;
    const centerCol = 4.5;
    const relCol = col - centerCol;
    const breatheScaleX = 1 + Math.sin(this.formationBreathe) * 0.08;
    const breatheScaleY = 1 + Math.cos(this.formationBreathe) * 0.05;

    const x = this.width / 2 + this.formationOffsetX + relCol * baseSpacingX * breatheScaleX;
    const y = 86 + row * baseSpacingY * breatheScaleY;
    return new Vector2(x, y);
  }

  /**
   * Builds the classic 40-enemy Galaga wave in 5 choreographed squadrons of 8 ships.
   * Row 0: 4 Boss Galaga (cols 3, 4, 5, 6)
   * Row 1: 8 Goei Butterflies (cols 1..8)
   * Row 2: 14 Zako Bees (cols -1..12 mapped cleanly across 14 slots)
   * Row 3: 14 Zako Bees
   */
  _spawnWave(level) {
    this.enemies = [];
    this.enemyBullets = [];
    this.diveTimer = Math.max(1.2, 2.6 - level * 0.15);
    this.starSpeedMult = 2.6;

    const slots = [];
    // Row 0: 4 Boss Galaga
    for (let c = 3; c <= 6; c++) {
      slots.push({ row: 0, col: c, type: 'boss' });
    }
    // Row 1: 8 Goei
    for (let c = 1; c <= 8; c++) {
      slots.push({ row: 1, col: c, type: 'goei' });
    }
    // Row 2: 14 Zako (-1.5 .. 10.5 step 1 -> cols -1 to 10 plus 2 outer wing slots)
    for (let i = 0; i < 14; i++) {
      const col = i - 2; // -2 .. 11 (centered around 4.5!)
      slots.push({ row: 2, col, type: 'zako' });
    }
    // Row 3: 14 Zako
    for (let i = 0; i < 14; i++) {
      const col = i - 2;
      slots.push({ row: 3, col, type: 'zako' });
    }

    // Group the 40 enemies into 5 choreographed squadrons of 8 ships each
    slots.forEach((slot, idx) => {
      const squadronIdx = Math.floor(idx / 8);
      const orderInSquadron = idx % 8;
      const entryDelay = squadronIdx * 1.35 + orderInSquadron * 0.12;
      const entrySegments = this._createEntryBezierPath(squadronIdx, slot.row, slot.col);

      const startPos = entrySegments[0].p0.clone();
      this.enemies.push({
        id: idx,
        type: slot.type,
        row: slot.row,
        col: slot.col,
        hp: slot.type === 'boss' ? 2 : 1,
        maxHp: slot.type === 'boss' ? 2 : 1,
        x: startPos.x,
        y: startPos.y,
        angle: Math.PI,
        state: 'waiting_entry', // 'waiting_entry' | 'entering' | 'in_formation' | 'diving' | 'tractor_beam' | 'returning'
        entryDelay,
        bezierSegments: entrySegments,
        segmentIndex: 0,
        segmentT: 0,
        segmentSpeed: 1.05 + Math.min(0.45, level * 0.04),
        diveFireTimer: 0,
        tractorTimer: 0,
        tractorDuration: 3.4,
        hasCapturedFighter: false,
        escortBossId: null,
        animPhase: Math.random() * Math.PI * 2
      });
    });
  }

  /**
   * Generates a 2-segment cubic Bezier entry flight path for each squadron
   */
  _createEntryBezierPath(squadronIdx, row, col) {
    const slotTarget = this._getFormationSlotPos(row, col);
    const w = this.width;
    const h = this.height;

    if (squadronIdx === 0) {
      // Top-left sweeping S-curve through center loop
      return [
        {
          p0: new Vector2(180, 20),
          p1: new Vector2(820, 180),
          p2: new Vector2(760, 420),
          p3: new Vector2(480, 310)
        },
        {
          p0: new Vector2(480, 310),
          p1: new Vector2(200, 210),
          p2: new Vector2(slotTarget.x, slotTarget.y + 90),
          p3: slotTarget
        }
      ];
    } else if (squadronIdx === 1) {
      // Top-right mirror sweeping S-curve
      return [
        {
          p0: new Vector2(w - 180, 20),
          p1: new Vector2(140, 180),
          p2: new Vector2(200, 420),
          p3: new Vector2(480, 310)
        },
        {
          p0: new Vector2(480, 310),
          p1: new Vector2(760, 210),
          p2: new Vector2(slotTarget.x, slotTarget.y + 90),
          p3: slotTarget
        }
      ];
    } else if (squadronIdx === 2) {
      // Bottom-left upward spiral loop
      return [
        {
          p0: new Vector2(-20, h - 120),
          p1: new Vector2(360, h - 80),
          p2: new Vector2(420, 150),
          p3: new Vector2(220, 240)
        },
        {
          p0: new Vector2(220, 240),
          p1: new Vector2(60, 320),
          p2: new Vector2(slotTarget.x - 60, slotTarget.y + 70),
          p3: slotTarget
        }
      ];
    } else if (squadronIdx === 3) {
      // Bottom-right upward spiral loop
      return [
        {
          p0: new Vector2(w + 20, h - 120),
          p1: new Vector2(w - 360, h - 80),
          p2: new Vector2(w - 420, 150),
          p3: new Vector2(w - 220, 240)
        },
        {
          p0: new Vector2(w - 220, 240),
          p1: new Vector2(w - 60, 320),
          p2: new Vector2(slotTarget.x + 60, slotTarget.y + 70),
          p3: slotTarget
        }
      ];
    } else {
      // Center figure-8 royal descent
      const side = col < 4.5 ? -1 : 1;
      return [
        {
          p0: new Vector2(w / 2 + side * 90, 20),
          p1: new Vector2(w / 2 + side * 420, 180),
          p2: new Vector2(w / 2 - side * 380, 390),
          p3: new Vector2(w / 2, 260)
        },
        {
          p0: new Vector2(w / 2, 260),
          p1: new Vector2(w / 2 + side * 200, 160),
          p2: new Vector2(slotTarget.x, slotTarget.y + 60),
          p3: slotTarget
        }
      ];
    }
  }

  /**
   * Builds a multi-segment cubic Bezier dive-bombing trajectory from current formation position
   */
  _launchDive(enemy, options = {}) {
    const start = new Vector2(enemy.x, enemy.y);
    const side = enemy.x < this.width / 2 ? -1 : 1;
    const targetX = Math.max(90, Math.min(this.width - 90, this.player.x + (options.offsetX || 0)));

    if (options.tractorDive) {
      // Boss Galaga tractor beam dive: swoops down and stops at (targetX, 330)
      enemy.state = 'diving';
      enemy.diveMode = 'tractor';
      enemy.segmentIndex = 0;
      enemy.segmentT = 0;
      enemy.segmentSpeed = 0.85;
      enemy.bezierSegments = [
        {
          p0: start,
          p1: new Vector2(start.x + side * 160, start.y - 50),
          p2: new Vector2(targetX - side * 140, 210),
          p3: new Vector2(targetX, 330)
        }
      ];
      return;
    }

    // Standard multi-segment attack dive swooping past the player to bottom of screen
    enemy.state = 'diving';
    enemy.diveMode = 'attack';
    enemy.segmentIndex = 0;
    enemy.segmentT = 0;
    enemy.segmentSpeed = 0.72 + Math.min(0.35, this.level * 0.04);
    enemy.diveFireTimer = 0.28 + Math.random() * 0.35;

    const midPoint = new Vector2(
      Math.max(80, Math.min(this.width - 80, (start.x + targetX) * 0.5 - side * 90)),
      275
    );
    const exitPoint = new Vector2(
      Math.max(60, Math.min(this.width - 60, targetX + side * 110)),
      this.height + 36
    );

    enemy.bezierSegments = [
      {
        p0: start,
        p1: new Vector2(start.x + side * 180, start.y - 45),
        p2: new Vector2(midPoint.x + side * 140, midPoint.y - 70),
        p3: midPoint
      },
      {
        p0: midPoint,
        p1: new Vector2(midPoint.x - side * 120, midPoint.y + 85),
        p2: new Vector2(targetX, 440),
        p3: exitPoint
      }
    ];
  }

  /**
   * Triggers a Boss Galaga Tractor Beam dive (either organically or via Action B tactical trigger)
   */
  _triggerBossTractorDive(forceImmediatePosition = false) {
    const anyCaptured = this.enemies.some((e) => e.hasCapturedFighter);
    const alreadyTractoring = this.enemies.some(
      (e) => e.state === 'tractor_beam' || (e.state === 'diving' && e.diveMode === 'tractor')
    );
    if (this.dualFighter || anyCaptured || alreadyTractoring || this.rescuedFighter) {
      return false;
    }

    let boss = this.enemies.find((e) => e.type === 'boss' && e.state === 'in_formation');
    if (!boss) {
      boss = this.enemies.find((e) => e.type === 'boss');
    }
    if (!boss) return false;

    if (forceImmediatePosition) {
      boss.x = Math.max(90, Math.min(this.width - 90, this.player.x));
      boss.y = 330;
      boss.angle = 0;
      boss.state = 'tractor_beam';
      boss.tractorTimer = 0;
      boss.tractorDuration = 3.8;
    } else {
      this._launchDive(boss, { tractorDive: true });
    }
    return true;
  }

  update(dt) {
    const clampedDt = Math.min(dt, 0.05);
    this._updateStarfield(clampedDt);

    if (this.state === 'MENU') {
      if (this.input.isJustPressed('actionA') || this.input.isJustPressed('any')) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.state === 'PAUSED') {
      if (this.input.isJustPressed('pause') || this.input.isJustPressed('actionA')) {
        this.audio.playMenuSelect();
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.state === 'GAMEOVER') {
      if (this.input.isJustPressed('actionA') || this.input.isJustPressed('any')) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.input.isJustPressed('pause')) {
      this.audio.playMenuMove();
      this.state = 'PAUSED';
      return;
    }

    // Update formation sway and breathing
    this.formationTime += clampedDt;
    this.formationOffsetX = Math.sin(this.formationTime * 1.45) * 44;

    const anyEntering = this.enemies.some(
      (e) => e.state === 'waiting_entry' || e.state === 'entering'
    );
    const anyDiving = this.enemies.some(
      (e) => e.state === 'diving' || e.state === 'tractor_beam'
    );

    if (!anyEntering) {
      this.formationBreathe += clampedDt * 2.1;
    }

    // Dynamic starfield velocity shifts during wave entry and dive bombing
    const targetStarMult = anyEntering ? 2.4 : anyDiving ? 1.55 : 1.0;
    this.starSpeedMult += (targetStarMult - this.starSpeedMult) * clampedDt * 3.0;

    if (this.bannerTimer > 0) {
      this.bannerTimer = Math.max(0, this.bannerTimer - clampedDt);
    }

    this._updatePlayer(clampedDt);
    this._updateRescuedFighter(clampedDt);
    this._updateEnemies(clampedDt, anyEntering);
    this._updateBullets(clampedDt);
    this._updateParticles(clampedDt);

    // Check wave completion
    if (this.enemies.length === 0 && !this.rescuedFighter && this.player.capturedState === 'none') {
      this.level += 1;
      this.bannerText = `STAGE ${this.level} — CHALLENGE WAVE`;
      this.bannerTimer = 2.2;
      this.audio.playStageClear();
      this._spawnWave(this.level);
    }
  }

  _updateStarfield(dt) {
    const mult = this.starSpeedMult || 1;
    const swayDrift = Math.cos(this.formationTime * 1.45) * 12;
    for (const s of this.stars) {
      s.twinklePhase += s.twinkleSpeed * dt;
      s.y += s.baseSpeed * mult * dt;
      s.x -= swayDrift * (s.layer + 1) * 0.12 * dt;
      if (s.y > this.height) {
        s.y = 40;
        s.x = Math.random() * this.width;
      }
      if (s.x < 0) s.x += this.width;
      if (s.x > this.width) s.x -= this.width;
    }
  }

  _updatePlayer(dt) {
    const p = this.player;
    if (p.invulnTimer > 0) {
      p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    }
    if (p.fireCooldown > 0) {
      p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    }

    // Handle fighter being pulled up by Boss Galaga Tractor Beam
    if (p.capturedState === 'being_captured') {
      p.captureTimer += dt;
      p.angle += dt * 15;
      const boss = p.captureBoss;
      if (boss && this.enemies.includes(boss)) {
        const targetX = boss.x;
        const targetY = boss.y - 24;
        p.x += (targetX - p.x) * Math.min(1, dt * 4.5);
        p.y += (targetY - p.y) * Math.min(1, dt * 3.2);

        if (p.captureTimer >= 1.45 || Math.hypot(p.x - targetX, p.y - targetY) < 10) {
          boss.hasCapturedFighter = true;
          boss.tractorTimer = boss.tractorDuration; // End beam and return to formation
          p.capturedState = 'none';
          p.angle = 0;
          p.x = this.width / 2;
          p.y = 486;
          p.invulnTimer = 2.0;
          this.bannerText = 'FIGHTER CAPTURED! DESTROY BOSS TO RESCUE!';
          this.bannerTimer = 2.6;
        }
      } else {
        // Boss was destroyed mid-capture!
        p.capturedState = 'none';
        p.angle = 0;
        p.y = 486;
        p.invulnTimer = 1.8;
      }
      return;
    }

    // Horizontal movement via Keyboard / Touch D-Pad / Pointer drag
    const axis = this.input.getAxis();
    let moveX = axis.x;
    if (this.input.pointer.down && this.input.pointer.y > 40) {
      const diff = this.input.pointer.x - p.x;
      if (Math.abs(diff) > 6) {
        moveX = Math.max(-1, Math.min(1, diff / 45));
      }
    }

    const margin = this.dualFighter ? 46 : 30;
    p.vx = moveX * p.speed;
    p.x = Math.max(margin, Math.min(this.width - margin, p.x + p.vx * dt));

    // Action B (X / Shift): Summon Boss Tractor Beam above player for tactical capture/dual-fighter play
    if (this.input.isJustPressed('actionB')) {
      if (this._triggerBossTractorDive(true)) {
        this.bannerText = 'BOSS TRACTOR BEAM ENGAGED!';
        this.bannerTimer = 1.8;
      }
    }

    // Fire lasers (Action A: Space / Z / Enter / Pointer press)
    const wantsFire =
      this.input.isJustPressed('actionA') ||
      (this.input.isDown('actionA') && p.fireCooldown <= 0) ||
      (this.input.pointer.down && p.fireCooldown <= 0);

    const maxActiveVolleys = this.dualFighter ? 8 : 4;
    if (wantsFire && p.fireCooldown <= 0 && this.bullets.length < maxActiveVolleys) {
      p.fireCooldown = 0.17;
      this.audio.playLaser(1280, 220, 0.11);

      if (this.dualFighter) {
        // Dual Fighter Mode: 4 simultaneous laser bolts per volley!
        const offsets = [-21, -7, 7, 21];
        for (const ox of offsets) {
          this.bullets.push({
            x: p.x + ox,
            y: p.y - 14,
            vy: -640,
            color: Math.abs(ox) > 10 ? PALETTE.CYAN : PALETTE.GOLD
          });
        }
      } else {
        // Standard Fighter: twin wing bolts
        this.bullets.push(
          { x: p.x - 7, y: p.y - 14, vy: -620, color: PALETTE.CYAN },
          { x: p.x + 7, y: p.y - 14, vy: -620, color: PALETTE.CYAN }
        );
      }
    }
  }

  _updateRescuedFighter(dt) {
    if (!this.rescuedFighter) return;
    const rf = this.rescuedFighter;
    rf.timer += dt;

    if (rf.phase === 'celebrate') {
      rf.angle += dt * 14;
      if (rf.timer >= 0.85) {
        rf.phase = 'docking';
        rf.timer = 0;
      }
    } else if (rf.phase === 'docking') {
      rf.angle = rf.angle * Math.max(0, 1 - dt * 10);
      const targetX = this.player.x + 14;
      const targetY = this.player.y;
      rf.x += (targetX - rf.x) * Math.min(1, dt * 6.5);
      rf.y += (targetY - rf.y) * Math.min(1, dt * 6.5);

      if (Math.hypot(rf.x - targetX, rf.y - targetY) < 8 || rf.timer > 1.2) {
        this.dualFighter = true;
        this.rescuedFighter = null;
        this.player.invulnTimer = 1.6;
        this.audio.playPowerUp();
        this._spawnFloatingText('DUAL FIGHTER!', this.player.x, this.player.y - 28, PALETTE.GOLD);
      }
    }
  }

  _updateEnemies(dt, anyEntering) {
    // Schedule periodic dive-bombing runs once squadrons are in formation
    if (!anyEntering && this.enemies.length > 0) {
      this.diveTimer -= dt;
      if (this.diveTimer <= 0) {
        this.diveTimer = Math.max(0.85, 2.2 - this.level * 0.14);
        this._dispatchAttackSquadron();
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.animPhase += dt * 5.2;

      if (e.state === 'waiting_entry') {
        e.entryDelay -= dt;
        if (e.entryDelay <= 0) {
          e.state = 'entering';
          e.segmentIndex = 0;
          e.segmentT = 0;
        }
        continue;
      }

      if (e.state === 'entering' || e.state === 'diving') {
        const seg = e.bezierSegments[e.segmentIndex];
        if (!seg) {
          e.state = 'in_formation';
          continue;
        }

        // Keep final segment destination locked to live moving formation slot during entry
        if (e.state === 'entering' && e.segmentIndex === e.bezierSegments.length - 1) {
          seg.p3 = this._getFormationSlotPos(e.row, e.col);
        }

        e.segmentT += e.segmentSpeed * dt;
        const clampedT = Math.min(1, e.segmentT);
        const pos = Vector2.cubicBezier(seg.p0, seg.p1, seg.p2, seg.p3, clampedT);
        const aheadPos = Vector2.cubicBezier(
          seg.p0,
          seg.p1,
          seg.p2,
          seg.p3,
          Math.min(1, clampedT + 0.02)
        );
        const dx = aheadPos.x - pos.x;
        const dy = aheadPos.y - pos.y;
        if (Math.hypot(dx, dy) > 0.05) {
          e.angle = Math.atan2(dy, dx) + Math.PI / 2;
        }

        e.x = pos.x;
        e.y = pos.y;

        // Fire plasma shots while diving
        if (e.state === 'diving' && e.diveMode === 'attack') {
          e.diveFireTimer -= dt;
          if (e.diveFireTimer <= 0 && e.y > 90 && e.y < 380) {
            e.diveFireTimer = 0.75 + Math.random() * 0.6;
            this._fireEnemyBullet(e);
          }
        }

        if (e.segmentT >= 1) {
          e.segmentIndex += 1;
          e.segmentT = 0;
          if (e.segmentIndex >= e.bezierSegments.length) {
            if (e.state === 'entering') {
              e.state = 'in_formation';
              e.angle = 0;
            } else if (e.state === 'diving' && e.diveMode === 'tractor') {
              // Boss reached tractor beam position at y = 330
              e.state = 'tractor_beam';
              e.tractorTimer = 0;
              e.angle = 0;
              this.audio.playSiren(0.4, false);
            } else {
              // Wrap to top of screen and return to formation
              e.y = 36;
              e.state = 'returning';
            }
          }
        }
      } else if (e.state === 'tractor_beam') {
        e.tractorTimer += dt;
        e.angle = 0;

        // Pulse tractor beam synth audio every 0.35s
        if (Math.floor((e.tractorTimer - dt) / 0.35) !== Math.floor(e.tractorTimer / 0.35)) {
          this.audio.playSiren(0.25 + 0.25 * Math.sin(e.tractorTimer * 6), false);
        }

        // Check if player is inside tractor beam cone (width expands up to +-48px at y = 486)
        const beamHalfWidth = 46 * Math.min(1, e.tractorTimer / 0.45);
        if (
          this.player.capturedState === 'none' &&
          !this.dualFighter &&
          !e.hasCapturedFighter &&
          Math.abs(this.player.x - e.x) < beamHalfWidth
        ) {
          this.player.capturedState = 'being_captured';
          this.player.captureTimer = 0;
          this.player.captureBoss = e;
          this.audio.playPowerUp();
        }

        if (e.tractorTimer >= e.tractorDuration && this.player.capturedState !== 'being_captured') {
          e.state = 'returning';
        }
      } else if (e.state === 'returning') {
        const slot = this._getFormationSlotPos(e.row, e.col);
        const dx = slot.x - e.x;
        const dy = slot.y - e.y;
        const dist = Math.hypot(dx, dy);
        const speed = 260;
        if (dist < 10) {
          e.state = 'in_formation';
          e.angle = 0;
        } else {
          e.x += (dx / dist) * speed * dt;
          e.y += (dy / dist) * speed * dt;
          e.angle = Math.atan2(dy, dx) + Math.PI / 2;
        }
      } else if (e.state === 'in_formation') {
        const slot = this._getFormationSlotPos(e.row, e.col);
        e.x += (slot.x - e.x) * Math.min(1, dt * 12);
        e.y += (slot.y - e.y) * Math.min(1, dt * 12);
        e.angle = 0;
      }

      // Check collision between diving enemy and player fighter
      if (
        this.player.capturedState === 'none' &&
        this.player.invulnTimer <= 0 &&
        e.state !== 'waiting_entry'
      ) {
        const hitRadius = this.dualFighter ? 26 : 16;
        if (Math.hypot(e.x - this.player.x, e.y - this.player.y) < hitRadius + 12) {
          this._damageEnemy(i, true);
          this._hitPlayer();
        }
      }
    }
  }

  _dispatchAttackSquadron() {
    const formationEnemies = this.enemies.filter((e) => e.state === 'in_formation');
    if (formationEnemies.length === 0) return;

    // 32% chance a Boss Galaga initiates a Tractor Beam dive (if player is single and no ship is captured)
    const availableBosses = formationEnemies.filter((e) => e.type === 'boss');
    const canTractor =
      availableBosses.length > 0 &&
      !this.dualFighter &&
      !this.rescuedFighter &&
      this.player.capturedState === 'none' &&
      !this.enemies.some((e) => e.hasCapturedFighter || e.state === 'tractor_beam');

    if (canTractor && Math.random() < 0.35) {
      const boss = availableBosses[Math.floor(Math.random() * availableBosses.length)];
      this._launchDive(boss, { tractorDive: true });
      return;
    }

    // Choose a random enemy from formation to dive
    const chosen = formationEnemies[Math.floor(Math.random() * formationEnemies.length)];
    if (chosen.type === 'boss') {
      // Boss dives with up to 2 Goei butterfly escorts!
      this._launchDive(chosen, { offsetX: 0 });
      const escorts = formationEnemies
        .filter((e) => e.type === 'goei' && Math.abs(e.col - chosen.col) <= 2)
        .slice(0, 2);
      escorts.forEach((escort, idx) => {
        this._launchDive(escort, { offsetX: idx === 0 ? -36 : 36 });
      });
    } else {
      this._launchDive(chosen, { offsetX: (Math.random() - 0.5) * 40 });
    }
  }

  _fireEnemyBullet(enemy) {
    const dx = this.player.x - enemy.x;
    const dy = this.player.y - enemy.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const speed = 250 + Math.min(120, this.level * 15);
    this.enemyBullets.push({
      x: enemy.x,
      y: enemy.y + 10,
      vx: (dx / len) * speed * 0.55,
      vy: Math.max(180, (dy / len) * speed)
    });
  }

  _updateBullets(dt) {
    // Player laser bolts
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y += b.vy * dt;
      if (b.y < 38) {
        this.bullets.splice(i, 1);
        continue;
      }

      let hit = false;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (e.state === 'waiting_entry') continue;
        if (Math.abs(b.x - e.x) < 16 && Math.abs(b.y - e.y) < 15) {
          this._damageEnemy(j, false);
          hit = true;
          break;
        }
      }

      if (hit) {
        this.bullets.splice(i, 1);
      }
    }

    // Enemy plasma projectiles
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const eb = this.enemyBullets[i];
      eb.x += eb.vx * dt;
      eb.y += eb.vy * dt;

      if (eb.y > this.height || eb.x < 0 || eb.x > this.width) {
        this.enemyBullets.splice(i, 1);
        continue;
      }

      if (this.player.capturedState === 'none' && this.player.invulnTimer <= 0) {
        const hitW = this.dualFighter ? 26 : 13;
        if (Math.abs(eb.x - this.player.x) < hitW && Math.abs(eb.y - this.player.y) < 13) {
          this.enemyBullets.splice(i, 1);
          this._hitPlayer();
        }
      }
    }
  }

  _damageEnemy(index, fromCollision = false) {
    const e = this.enemies[index];
    if (!e) return;

    e.hp -= 1;
    if (e.hp > 0) {
      // Boss Galaga first hit: armor turns blue/purple
      this.audio.playHit();
      this._spawnExplosion(e.x, e.y, PALETTE.CYAN, 8);
      return;
    }

    // Calculate authentic Galaga points (Formation vs Diving)
    const isActiveFlight = e.state !== 'in_formation';
    let pts = 50;
    if (e.type === 'boss') {
      pts = isActiveFlight ? 400 : 150;
    } else if (e.type === 'goei') {
      pts = isActiveFlight ? 160 : 80;
    } else {
      pts = isActiveFlight ? 100 : 50;
    }

    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }

    const burstColor =
      e.type === 'boss' ? PALETTE.GREEN : e.type === 'goei' ? PALETTE.RED : PALETTE.GOLD;
    this._spawnExplosion(e.x, e.y, burstColor, 22);
    this._spawnFloatingText(`+${pts}`, e.x, e.y, burstColor);
    this.audio.playExplosion(0.28, 1100);

    // If this Boss Galaga was holding a captured fighter, rescue it -> Dual Fighter!
    if (e.hasCapturedFighter && !fromCollision) {
      this.rescuedFighter = {
        x: e.x,
        y: e.y - 20,
        angle: 0,
        phase: 'celebrate',
        timer: 0
      };
      this.bannerText = 'CAPTURED FIGHTER RESCUED! DUAL FIGHTER MODE!';
      this.bannerTimer = 2.6;
      this.audio.playPowerUp();
    }

    this.enemies.splice(index, 1);
  }

  _hitPlayer() {
    this.renderer.shake(8, 0.3);
    this.audio.playExplosion(0.45, 800);
    this._spawnExplosion(this.player.x, this.player.y, PALETTE.RED, 28);

    // If in Dual Fighter mode, losing one fighter reverts to single ship instead of costing a life
    if (this.dualFighter) {
      this.dualFighter = false;
      this.player.invulnTimer = 2.0;
      this._spawnFloatingText('TWIN WING LOST', this.player.x, this.player.y - 24, PALETTE.PINK);
      return;
    }

    this.lives -= 1;
    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.audio.playGameOver();
      this.state = 'GAMEOVER';
    } else {
      this.player.x = this.width / 2;
      this.player.invulnTimer = 2.2;
    }
  }

  _spawnExplosion(x, y, color, count = 18) {
    const palette = [color, PALETTE.WHITE, PALETTE.GOLD, PALETTE.PINK];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 45 + Math.random() * 190;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        size: 2 + Math.random() * 3,
        color: palette[i % palette.length]
      });
    }
  }

  _spawnFloatingText(text, x, y, color = PALETTE.GOLD) {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -42,
      life: 0.95,
      maxLife: 0.95,
      color
    });
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear(PALETTE.BG);

    // 1. Multi-layered twinkling parallax starfield
    this._renderStarfield(ctx);

    // 2. Tractor Beam fields from Boss Galaga ships
    for (const e of this.enemies) {
      if (e.state === 'tractor_beam') {
        this._renderTractorBeam(ctx, e);
      }
    }

    // 3. Enemies & any docked captive fighters
    const flapFrame = Math.floor(this.formationTime * 4) % 2;
    for (const e of this.enemies) {
      if (e.state === 'waiting_entry') continue;
      this._renderEnemy(ctx, e, flapFrame);
    }

    // 4. Rescued fighter transitioning to Dual Fighter dock
    if (this.rescuedFighter) {
      this._renderFighterSprite(
        ctx,
        this.rescuedFighter.x,
        this.rescuedFighter.y,
        this.rescuedFighter.angle,
        SPRITE_PALETTES.PLAYER
      );
    }

    // 5. Player Fighter (or Dual Fighter twin ships)
    this._renderPlayer(ctx);

    // 6. Player & Enemy Projectiles
    for (const b of this.bullets) {
      this.renderer.drawGlowRect(b.x - 2, b.y - 8, 4, 14, b.color, 10);
    }
    for (const eb of this.enemyBullets) {
      this.renderer.drawGlowCircle(eb.x, eb.y, 4, PALETTE.PINK, 10);
    }

    // 7. Explosions & Floating Score Popups
    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 8;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      ctx.restore();
    }

    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      this.renderer.drawText(ft.text, ft.x, ft.y, {
        font: FONTS.HEADER,
        size: 11,
        color: ft.color,
        align: 'center',
        glow: 8
      });
      ctx.restore();
    }

    // 8. Stage / Tactical Status Banner
    if (this.bannerTimer > 0 && this.state === 'PLAYING') {
      this.renderer.drawText(this.bannerText, this.width / 2, 265, {
        font: FONTS.HEADER,
        size: 15,
        color: PALETTE.CYAN,
        align: 'center',
        glow: 12
      });
    }

    // 8b. Classic Namco Bottom-Left Reserve Fighters & Bottom-Right Stage Badges
    this._renderBottomArcadeBar(ctx);

    // 9. Standardized Arcade HUD & State Overlay
    this.renderer.drawHUD({
      title: 'GALAGA',
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: this.dualFighter ? 'DUAL FIGHTER' : 'SINGLE WING',
      accent: PALETTE.CYAN
    });

    this.renderer.drawStateOverlay(this.state, {
      title: 'GALAGA',
      subtitle: 'FORMATION BEZIER FLIGHT & DUAL FIGHTER EDITION',
      controls: 'ARROWS/A-D: STEER  |  SPACE/Z: FIRE LASERS  |  X/SHIFT: TRACTOR BEAM TEST',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.CYAN
    });
  }

  _renderBottomArcadeBar(ctx) {
    ctx.save();
    // Bottom-left reserve mini Galaga fighters
    const reserveCount = Math.max(0, Math.min(5, this.lives - 1));
    for (let i = 0; i < reserveCount; i++) {
      const rx = 26 + i * 22;
      const ry = 524;
      this.renderer.drawPixelSprite(
        SPRITES.PLAYER,
        rx - 7,
        ry - 7,
        1.2,
        SPRITE_PALETTES.PLAYER
      );
    }

    // Bottom-right Namco Stage Rank Badges (10s, 5s, and 1s badges)
    let rem = Math.max(1, this.level);
    const tens = Math.floor(rem / 10);
    rem %= 10;
    const fives = Math.floor(rem / 5);
    const ones = rem % 5;

    let bx = this.width - 20;
    const by = 515;

    // 1-stage narrow yellow/blue badges
    for (let i = 0; i < ones; i++) {
      bx -= 10;
      ctx.fillStyle = '#2563EB';
      ctx.fillRect(bx, by, 7, 16);
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(bx + 1, by + 2, 5, 6);
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(bx + 2, by, 3, 2);
    }
    // 5-stage medium green/gold badges
    for (let i = 0; i < fives; i++) {
      bx -= 15;
      ctx.fillStyle = PALETTE.GREEN;
      ctx.fillRect(bx, by - 2, 11, 18);
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(bx + 2, by + 1, 7, 7);
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(bx + 3, by - 4, 5, 2);
    }
    // 10-stage wide crimson/gold badges
    for (let i = 0; i < Math.min(4, tens); i++) {
      bx -= 20;
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(bx, by - 3, 15, 19);
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(bx + 2, by, 11, 8);
      ctx.fillStyle = PALETTE.CYAN;
      ctx.fillRect(bx + 4, by + 2, 7, 4);
    }
    ctx.restore();
  }

  _renderStarfield(ctx) {
    const warpStretch = Math.max(1, (this.starSpeedMult - 1) * 4.5);
    ctx.save();
    for (const s of this.stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(s.twinklePhase);
      ctx.globalAlpha = s.alpha * twinkle;
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, s.size, s.size * warpStretch);
    }
    ctx.restore();
  }

  _renderTractorBeam(ctx, boss) {
    const progress = Math.min(1, boss.tractorTimer / 0.45);
    const beamTopY = boss.y + 14;
    const beamBottomY = 502;
    const beamH = (beamBottomY - beamTopY) * progress;
    const maxHalfW = 50;

    ctx.save();
    // Translucent outer beam cone
    const grad = ctx.createLinearGradient(boss.x, beamTopY, boss.x, beamTopY + beamH);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0.48)');
    grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.25)');
    grad.addColorStop(1, 'rgba(184, 41, 255, 0.10)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(boss.x - 8, beamTopY);
    ctx.lineTo(boss.x + 8, beamTopY);
    ctx.lineTo(boss.x + maxHalfW * progress, beamTopY + beamH);
    ctx.lineTo(boss.x - maxHalfW * progress, beamTopY + beamH);
    ctx.closePath();
    ctx.fill();

    // Animated shimmering sine-wave energy rings
    const ringCount = 9;
    const timeOffset = (boss.tractorTimer * 3.2) % 1;
    for (let i = 0; i < ringCount; i++) {
      const frac = (i + timeOffset) / ringCount;
      if (frac > progress) continue;
      const ry = beamTopY + frac * (beamBottomY - beamTopY);
      const halfW = 8 + frac * (maxHalfW - 8);
      const waveAmp = 4 * Math.sin(boss.tractorTimer * 16 + i * 1.1);

      ctx.strokeStyle = i % 2 === 0 ? PALETTE.CYAN : PALETTE.PURPLE;
      ctx.lineWidth = 2;
      ctx.shadowColor = PALETTE.CYAN;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(boss.x, ry + waveAmp, halfW, 5 + frac * 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  _renderEnemy(ctx, e, flapFrame) {
    let sprite = SPRITES.ZAKO_0;
    let palette = SPRITE_PALETTES.ZAKO;

    if (e.type === 'boss') {
      if (e.hp > 1) {
        sprite = flapFrame === 0 ? SPRITES.BOSS_FULL : SPRITES.BOSS_FULL_ALT;
        palette = SPRITE_PALETTES.BOSS_FULL;
      } else {
        sprite = SPRITES.BOSS_HIT;
        palette = SPRITE_PALETTES.BOSS_HIT;
      }
    } else if (e.type === 'goei') {
      sprite = flapFrame === 0 ? SPRITES.GOEI_0 : SPRITES.GOEI_1;
      palette = SPRITE_PALETTES.GOEI;
    } else {
      sprite = flapFrame === 0 ? SPRITES.ZAKO_0 : SPRITES.ZAKO_1;
      palette = SPRITE_PALETTES.ZAKO;
    }

    const scale = 2.2;
    const w = sprite[0].length * scale;
    const h = sprite.length * scale;

    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.angle) {
      ctx.rotate(e.angle);
    }
    this.renderer.drawPixelSprite(sprite, -w / 2, -h / 2, scale, palette);
    ctx.restore();

    // Render captive fighter docked above Boss Galaga if present
    if (e.hasCapturedFighter) {
      this._renderFighterSprite(ctx, e.x, e.y - 24, e.angle, SPRITE_PALETTES.PLAYER_CAPTURED);
    }
  }

  _renderFighterSprite(ctx, x, y, angle = 0, palette = SPRITE_PALETTES.PLAYER) {
    const scale = 2.2;
    const sprite = SPRITES.PLAYER;
    const w = sprite[0].length * scale;
    const h = sprite.length * scale;

    ctx.save();
    ctx.translate(x, y);
    if (angle) {
      ctx.rotate(angle);
    }
    this.renderer.drawPixelSprite(sprite, -w / 2, -h / 2, scale, palette);
    ctx.restore();
  }

  _renderPlayer(ctx) {
    const p = this.player;
    if (p.invulnTimer > 0 && Math.floor(p.invulnTimer * 14) % 2 === 1) {
      return;
    }

    if (p.capturedState === 'being_captured') {
      this._renderFighterSprite(ctx, p.x, p.y, p.angle, SPRITE_PALETTES.PLAYER_CAPTURED);
      return;
    }

    if (this.dualFighter) {
      // Twin docked Galaga fighters side-by-side!
      this._renderFighterSprite(ctx, p.x - 14, p.y, 0, SPRITE_PALETTES.PLAYER);
      this._renderFighterSprite(ctx, p.x + 14, p.y, 0, SPRITE_PALETTES.PLAYER);
    } else {
      this._renderFighterSprite(ctx, p.x, p.y, 0, SPRITE_PALETTES.PLAYER);
    }
  }
}

export default Galaga;
