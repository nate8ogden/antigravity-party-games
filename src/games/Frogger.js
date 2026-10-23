/**
 * Frogger.js
 * Flagship Arcade Highway & River Crossing — Modernized Coin-Op Edition
 *
 * Features:
 * - 13-row x 16-column playfield grid (cellW = 54, cellH = 36) centered in the 960x500 arena.
 * - Discrete grid hop movement with smooth 0.11s hop arc interpolation & leg-extension animation.
 * - Strict 60.0-second timer per frog life rendered as a glowing TIME countdown bar & numeric readout.
 * - 5-lane Highway (Rows 7-11): Yellow Race Car, Bulldozer, Neon Coupe, Turbo Cruiser, Dual-Cab Semi Truck.
 * - 5-lane River (Rows 1-5): Short, Medium, and Long floating logs + Diving Turtle groups cycling smoothly
 *   through surfaced -> warning blink -> submerged states.
 * - Direct horizontal momentum transfer (lane.speed * dt) when riding logs or surfaced turtles.
 * - 5 Lily-Pad Home Bays (Row 0) with periodic +200 pt bonus flies, time-bonus scoring
 *   (50 + Math.floor(lifeTimer) * 10), and +1000 pt Stage Clear fanfare.
 * - Tap-to-leap relative to frog position, swipe gestures, and discrete D-Pad/Arrow controls.
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const COLS = 16;
const ROWS = 13;
const CELL_W = 54;
const CELL_H = 36;
const GRID_W = COLS * CELL_W; // 864
const GRID_H = ROWS * CELL_H; // 468
const OFFSET_X = Math.floor((960 - GRID_W) / 2); // 48
const OFFSET_Y = 42;

const HOP_DURATION = 0.11;
const MAX_LIFE_TIME = 60.0;

export const STAGE_CONFIGS = [
  // Stage 1: Classic Arcade Crossing
  {
    name: 'STAGE 1: CLASSIC CROSSING',
    highwayCounts: { 11: 4, 10: 3, 9: 4, 8: 3, 7: 3 },
    logLengths: { 4: 128, 3: 224, 1: 168 },
    logCounts: { 4: 4, 3: 3, 1: 3 },
    divingGroups: { 5: 1, 2: 1 },
    surfacedTime: 3.8,
    warningTime: 1.6,
    submergedTime: 1.7,
    crocodileRows: []
  },
  // Stage 2: Alligator Bayou (Crocodile log on Row 1 + faster traffic)
  {
    name: 'STAGE 2: ALLIGATOR BAYOU',
    highwayCounts: { 11: 4, 10: 4, 9: 4, 8: 3, 7: 3 },
    logLengths: { 4: 122, 3: 208, 1: 160 },
    logCounts: { 4: 4, 3: 3, 1: 3 },
    divingGroups: { 5: 2, 2: 1 },
    surfacedTime: 3.5,
    warningTime: 1.5,
    submergedTime: 1.7,
    crocodileRows: [1]
  },
  // Stage 3: Rush Hour & Rapids
  {
    name: 'STAGE 3: RUSH HOUR & RAPIDS',
    highwayCounts: { 11: 5, 10: 4, 9: 4, 8: 4, 7: 3 },
    logLengths: { 4: 112, 3: 196, 1: 152 },
    logCounts: { 4: 4, 3: 3, 1: 3 },
    divingGroups: { 5: 2, 2: 2 },
    surfacedTime: 3.2,
    warningTime: 1.4,
    submergedTime: 1.7,
    crocodileRows: [1]
  },
  // Stage 4: Dual Gator Swamp (Crocodiles on Rows 1 & 3)
  {
    name: 'STAGE 4: DUAL GATOR SWAMP',
    highwayCounts: { 11: 5, 10: 4, 9: 5, 8: 4, 7: 3 },
    logLengths: { 4: 110, 3: 188, 1: 148 },
    logCounts: { 4: 4, 3: 3, 1: 4 },
    divingGroups: { 5: 2, 2: 2 },
    surfacedTime: 3.0,
    warningTime: 1.4,
    submergedTime: 1.8,
    crocodileRows: [1, 3]
  },
  // Stage 5: Midnight Expressway
  {
    name: 'STAGE 5: MIDNIGHT EXPRESSWAY',
    highwayCounts: { 11: 5, 10: 4, 9: 5, 8: 4, 7: 4 },
    logLengths: { 4: 104, 3: 180, 1: 142 },
    logCounts: { 4: 4, 3: 3, 1: 4 },
    divingGroups: { 5: 2, 2: 2 },
    surfacedTime: 2.8,
    warningTime: 1.3,
    submergedTime: 1.8,
    crocodileRows: [1, 4]
  },
  // Stage 6: Master Hopper Gauntlet
  {
    name: 'STAGE 6: MASTER GAUNTLET',
    highwayCounts: { 11: 5, 10: 5, 9: 5, 8: 4, 7: 4 },
    logLengths: { 4: 100, 3: 172, 1: 138 },
    logCounts: { 4: 4, 3: 3, 1: 4 },
    divingGroups: { 5: 3, 2: 2 },
    surfacedTime: 2.6,
    warningTime: 1.3,
    submergedTime: 1.8,
    crocodileRows: [1, 3, 4]
  }
];

export class Frogger {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'frogger';
    this.title = 'Frogger';

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.lifeTimer = MAX_LIFE_TIME;
    this.lanes = [];
    this.bays = [];
    this.bonusFly = { bayIndex: -1, timer: 4.5, active: false };

    this.deathTimer = 0;
    this.deathCause = ''; // 'SQUASH' | 'DROWN' | 'TIME'
    this.deathPos = { x: 0, y: 0 };
    this.stageClearTimer = 0;

    this.popups = [];
    this.particles = [];
    this.waterRipples = [];

    this.reset();
  }

  setState(nextState) {
    this.state = nextState;
  }

  destroy() {
    if (this.audio && typeof this.audio.stopSequence === 'function') {
      this.audio.stopSequence();
    }
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.popups = [];
    this.particles = [];
    this._initLevel();
  }

  _initLevel() {
    // Initialize 5 Lily-Pad Home Bays across Row 0
    const bayCols = [1.5, 4.5, 7.5, 10.5, 13.5];
    this.bays = bayCols.map((col, idx) => ({
      index: idx,
      col,
      x: col * CELL_W + CELL_W / 2,
      y: CELL_H / 2,
      width: CELL_W * 1.35,
      filled: false
    }));

    this.bonusFly = { bayIndex: -1, timer: 3.5, active: false };
    this._buildLanes();
    this._spawnFrog();
  }

  _spawnFrog() {
    const startX = 7.5 * CELL_W + CELL_W / 2;
    const startY = 12 * CELL_H + CELL_H / 2;
    this.frog = {
      row: 12,
      x: startX,
      y: startY,
      startX,
      startY,
      targetX: startX,
      targetY: startY,
      hopping: false,
      hopTimer: 0,
      facing: 'UP', // 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
      furthestRow: 12
    };
    this.lifeTimer = MAX_LIFE_TIME;
    this.deathTimer = 0;
    this.deathCause = '';
  }

  _buildLanes() {
    const speedScale = 1 + (this.level - 1) * 0.16;
    const stageCfg = STAGE_CONFIGS[(this.level - 1) % STAGE_CONFIGS.length];
    this.stageConfig = stageCfg;
    this.lanes = [];

    // Helper to create evenly spaced lane objects across GRID_W + wrap margin
    const createObjects = (count, widthPx, divingCount = 0, hasCroc = false) => {
      const span = GRID_W + 220;
      const spacing = span / count;
      const items = [];
      for (let i = 0; i < count; i++) {
        items.push({
          x: i * spacing,
          w: widthPx,
          dives: i < divingCount,
          divePhase: (i * 2.3) % 6.0,
          diveState: 'SURFACED', // 'SURFACED' | 'WARNING' | 'SUBMERGED'
          isCrocodile: hasCroc && i === 0,
          jawPhase: Math.random() * Math.PI * 2,
          jawsOpen: false
        });
      }
      return items;
    };

    // HIGHWAY LANES (Rows 7 - 11)
    // Row 11: Yellow Race Car (Left)
    this.lanes[11] = {
      row: 11,
      kind: 'HIGHWAY',
      vehicleType: 'RACE_CAR',
      color: '#FFD700',
      accent: '#FF2A55',
      dir: -1,
      speed: 95 * speedScale,
      items: createObjects(stageCfg.highwayCounts[11], 48, 0, false)
    };
    // Row 10: Bulldozer (Right)
    this.lanes[10] = {
      row: 10,
      kind: 'HIGHWAY',
      vehicleType: 'BULLDOZER',
      color: '#FF8800',
      accent: '#F8FAFC',
      dir: 1,
      speed: 68 * speedScale,
      items: createObjects(stageCfg.highwayCounts[10], 52, 0, false)
    };
    // Row 9: Neon Coupe (Left)
    this.lanes[9] = {
      row: 9,
      kind: 'HIGHWAY',
      vehicleType: 'NEON_COUPE',
      color: '#FF007A',
      accent: '#00F0FF',
      dir: -1,
      speed: 122 * speedScale,
      items: createObjects(stageCfg.highwayCounts[9], 50, 0, false)
    };
    // Row 8: Turbo Cruiser (Right)
    this.lanes[8] = {
      row: 8,
      kind: 'HIGHWAY',
      vehicleType: 'TURBO_CRUISER',
      color: '#00F0FF',
      accent: '#FFD700',
      dir: 1,
      speed: 150 * speedScale,
      items: createObjects(stageCfg.highwayCounts[8], 54, 0, false)
    };
    // Row 7: Dual-Cab Semi Truck (Left)
    this.lanes[7] = {
      row: 7,
      kind: 'HIGHWAY',
      vehicleType: 'SEMI_TRUCK',
      color: '#F8FAFC',
      accent: '#FF2A55',
      dir: -1,
      speed: 86 * speedScale,
      items: createObjects(stageCfg.highwayCounts[7], 108, 0, false)
    };

    // RIVER LANES (Rows 1 - 5)
    // Row 5: 3-Turtle Groups (Left, with diving group)
    this.lanes[5] = {
      row: 5,
      kind: 'RIVER',
      platformType: 'TURTLES_3',
      countPerGroup: 3,
      dir: -1,
      speed: 78 * speedScale,
      items: createObjects(4, 3 * 34, stageCfg.divingGroups[5], false)
    };
    // Row 4: Short Logs (Right)
    this.lanes[4] = {
      row: 4,
      kind: 'RIVER',
      platformType: 'LOG_SHORT',
      dir: 1,
      speed: 72 * speedScale,
      items: createObjects(
        stageCfg.logCounts[4],
        stageCfg.logLengths[4],
        0,
        stageCfg.crocodileRows.includes(4)
      )
    };
    // Row 3: Long Logs (Right, fast)
    this.lanes[3] = {
      row: 3,
      kind: 'RIVER',
      platformType: 'LOG_LONG',
      dir: 1,
      speed: 118 * speedScale,
      items: createObjects(
        stageCfg.logCounts[3],
        stageCfg.logLengths[3],
        0,
        stageCfg.crocodileRows.includes(3)
      )
    };
    // Row 2: 2-Turtle Groups (Left, with diving group)
    this.lanes[2] = {
      row: 2,
      kind: 'RIVER',
      platformType: 'TURTLES_2',
      countPerGroup: 2,
      dir: -1,
      speed: 96 * speedScale,
      items: createObjects(4, 2 * 35, stageCfg.divingGroups[2], false)
    };
    // Row 1: Medium Logs + Stage 2+ Crocodiles (Right)
    this.lanes[1] = {
      row: 1,
      kind: 'RIVER',
      platformType: 'LOG_MEDIUM',
      dir: 1,
      speed: 88 * speedScale,
      items: createObjects(
        stageCfg.logCounts[1],
        stageCfg.logLengths[1],
        0,
        stageCfg.crocodileRows.includes(1)
      )
    };
  }

  _addScore(pts) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
  }

  _addPopup(text, x, y, color = PALETTE.WHITE) {
    this.popups.push({
      text: String(text),
      x,
      y,
      color,
      life: 1.05
    });
  }

  _spawnParticles(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.35;
      const spd = 45 + Math.random() * 115;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color,
        life: 0.4 + Math.random() * 0.25
      });
    }
  }

  update(dt) {
    // Handle State Transitions
    if (this.state === 'MENU') {
      if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
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
      if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.input.isJustPressed('pause')) {
      this.audio.playMenuSelect();
      this.state = 'PAUSED';
      return;
    }

    // Update popups & particles
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.y -= 26 * dt;
      p.life -= dt;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    // Always advance traffic & river lanes for living world feel
    this._updateLanes(dt);
    this._updateBonusFly(dt);

    // Stage Clear celebration delay
    if (this.stageClearTimer > 0) {
      this.stageClearTimer -= dt;
      if (this.stageClearTimer <= 0) {
        this.level++;
        this._initLevel();
      }
      return;
    }

    // Frog death delay
    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.lives--;
        if (this.lives <= 0) {
          HighScoreStore.submit(this.id, this.score);
          this.audio.playGameOver();
          this.state = 'GAMEOVER';
        } else {
          this._spawnFrog();
        }
      }
      return;
    }

    // Strict 60.0-second countdown timer per frog life
    this.lifeTimer = Math.max(0, this.lifeTimer - dt);
    if (this.lifeTimer <= 0) {
      this._killFrog('TIME');
      return;
    }

    // Handle Hop Input (Keyboard / D-Pad / Swipe / Tap-to-leap)
    this._handleFrogInput();

    // Update Frog Hop Interpolation
    this._updateFrogHop(dt);

    // Check Highway, River & Home Bay Interactions
    this._checkHazardAndPlatformCollisions(dt);
  }

  _updateLanes(dt) {
    const wrapSpan = GRID_W + 220;
    const cfg = this.stageConfig || STAGE_CONFIGS[0];
    const tSurfaced = cfg.surfacedTime || 3.8;
    const tWarning = tSurfaced + (cfg.warningTime || 1.6);
    const tCycle = tWarning + (cfg.submergedTime || 1.7);

    for (let r = 1; r <= 11; r++) {
      const lane = this.lanes[r];
      if (!lane) continue;
      const vx = lane.speed * lane.dir;

      for (const item of lane.items) {
        item.x += vx * dt;
        if (lane.dir > 0 && item.x > GRID_W + 110) {
          item.x -= wrapSpan;
        } else if (lane.dir < 0 && item.x + item.w < -110) {
          item.x += wrapSpan;
        }

        // Update Diving Turtle cycle
        if (item.dives) {
          item.divePhase = (item.divePhase + dt) % tCycle;
          if (item.divePhase < tSurfaced) {
            item.diveState = 'SURFACED';
          } else if (item.divePhase < tWarning) {
            item.diveState = 'WARNING';
          } else {
            item.diveState = 'SUBMERGED';
          }
        }

        // Update Crocodile snapping jaws cycle
        if (item.isCrocodile) {
          item.jawPhase = (item.jawPhase + dt * 2.6) % (Math.PI * 2);
          item.jawsOpen = Math.sin(item.jawPhase) > 0.35;
        }
      }
    }
  }

  _updateBonusFly(dt) {
    this.bonusFly.timer -= dt;
    if (this.bonusFly.timer <= 0) {
      if (this.bonusFly.active) {
        this.bonusFly.active = false;
        this.bonusFly.bayIndex = -1;
        this.bonusFly.timer = 4.0 + Math.random() * 3.0;
      } else {
        const emptyBays = this.bays.filter((b) => !b.filled);
        if (emptyBays.length > 0) {
          const chosen = emptyBays[Math.floor(Math.random() * emptyBays.length)];
          this.bonusFly.bayIndex = chosen.index;
          this.bonusFly.active = true;
          this.bonusFly.timer = 5.5;
        } else {
          this.bonusFly.timer = 3.0;
        }
      }
    }
  }

  _handleFrogInput() {
    if (this.frog.hopping) return;

    let hopDx = 0;
    let hopDy = 0;

    // 1. Discrete D-Pad / Keyboard presses
    if (this.input.isJustPressed('up')) hopDy = -1;
    else if (this.input.isJustPressed('down')) hopDy = 1;
    else if (this.input.isJustPressed('left')) hopDx = -1;
    else if (this.input.isJustPressed('right')) hopDx = 1;

    // 2. Swipe gesture
    if (hopDx === 0 && hopDy === 0) {
      const swipe = this.input.consumeSwipe();
      if (swipe === 'up') hopDy = -1;
      else if (swipe === 'down') hopDy = 1;
      else if (swipe === 'left') hopDx = -1;
      else if (swipe === 'right') hopDx = 1;
    }

    // 3. Tap-to-leap direction relative to touch/pointer location
    if (hopDx === 0 && hopDy === 0 && this.input.pointer.justPressed) {
      const px = this.input.pointer.x;
      const py = this.input.pointer.y;
      if (py >= 40) {
        const frogScreenX = OFFSET_X + this.frog.x;
        const frogScreenY = OFFSET_Y + this.frog.y;
        const dx = px - frogScreenX;
        const dy = py - frogScreenY;
        if (Math.hypot(dx, dy) > 10) {
          if (Math.abs(dx) > Math.abs(dy)) {
            hopDx = dx > 0 ? 1 : -1;
          } else {
            hopDy = dy > 0 ? 1 : -1;
          }
        } else {
          hopDy = -1;
        }
      }
    }

    if (hopDx !== 0 || hopDy !== 0) {
      this._triggerHop(hopDx, hopDy);
    }
  }

  _triggerHop(dx, dy) {
    const f = this.frog;
    const nextRow = f.row + dy;
    if (nextRow < 0 || nextRow >= ROWS) return;

    const nextX = f.x + dx * CELL_W;
    // Prevent voluntary hop outside left/right sidewalk bounds on land rows
    if (nextRow >= 6 && (nextX < CELL_W * 0.4 || nextX > GRID_W - CELL_W * 0.4)) {
      return;
    }

    if (dy < 0) f.facing = 'UP';
    else if (dy > 0) f.facing = 'DOWN';
    else if (dx < 0) f.facing = 'LEFT';
    else if (dx > 0) f.facing = 'RIGHT';

    f.hopping = true;
    f.hopTimer = 0;
    f.startX = f.x;
    f.startY = f.y;
    f.targetX = nextX;
    f.targetY = nextRow * CELL_H + CELL_H / 2;
    f.row = nextRow;

    this.audio.playHop();

    // Award +10 pts for each new forward row reached this frog life
    if (f.row < f.furthestRow && f.row > 0) {
      f.furthestRow = f.row;
      this._addScore(10);
    }
  }

  _updateFrogHop(dt) {
    const f = this.frog;
    if (!f.hopping) return;

    f.hopTimer += dt;
    const t = Math.min(1, f.hopTimer / HOP_DURATION);
    f.x = f.startX + (f.targetX - f.startX) * t;
    f.y = f.startY + (f.targetY - f.startY) * t;

    if (t >= 1) {
      f.hopping = false;
      f.x = f.targetX;
      f.y = f.targetY;
    }
  }

  _checkHazardAndPlatformCollisions(dt) {
    const f = this.frog;
    const currentRow = Math.round((f.y - CELL_H / 2) / CELL_H);

    // 1. HIGHWAY ROWS (7 - 11): Check vehicle collisions
    if (currentRow >= 7 && currentRow <= 11) {
      const lane = this.lanes[currentRow];
      if (lane) {
        const frogHalfW = 13;
        for (const v of lane.items) {
          if (f.x + frogHalfW > v.x + 4 && f.x - frogHalfW < v.x + v.w - 4) {
            this._killFrog('SQUASH');
            return;
          }
        }
      }
    }

    // 2. RIVER ROWS (1 - 5): Check floating logs & diving turtles + Momentum Transfer
    if (currentRow >= 1 && currentRow <= 5) {
      const lane = this.lanes[currentRow];
      if (lane) {
        let onValidPlatform = false;
        for (const p of lane.items) {
          if (p.dives && p.diveState === 'SUBMERGED') continue;
          if (f.x >= p.x - 6 && f.x <= p.x + p.w + 6) {
            // If crocodile's jaws are open at the right-hand snout tip, it's a hazard!
            if (p.isCrocodile && p.jawsOpen && f.x >= p.x + p.w - 20) {
              continue;
            }
            onValidPlatform = true;
            break;
          }
        }

        if (onValidPlatform) {
          // Transfer platform horizontal velocity directly to frog's X coordinate!
          const deltaX = lane.speed * lane.dir * dt;
          f.x += deltaX;
          f.startX += deltaX;
          f.targetX += deltaX;

          // Carried off screen bounds by river platform triggers death
          if (f.x < 10 || f.x > GRID_W - 10) {
            this._killFrog('DROWN');
            return;
          }
        } else if (!f.hopping) {
          // Landed in water or riding a turtle that submerged!
          this._killFrog('DROWN');
          return;
        }
      }
    }

    // 3. TOP HOME BAY ROW (Row 0): Check Lily-Pad Bays
    if (!f.hopping && f.row === 0) {
      let landedBay = null;
      for (const bay of this.bays) {
        if (Math.abs(f.x - bay.x) <= bay.width * 0.46) {
          landedBay = bay;
          break;
        }
      }

      if (!landedBay || landedBay.filled) {
        // Missed bay (hit swamp bushes) or jumped into an already occupied bay
        this._killFrog('DROWN');
        return;
      }

      // Successfully landed in an empty Lily-Pad Home Bay!
      landedBay.filled = true;
      const timeBonus = Math.floor(this.lifeTimer) * 10;
      let totalPts = 50 + timeBonus;

      if (this.bonusFly.active && this.bonusFly.bayIndex === landedBay.index) {
        totalPts += 200;
        this.bonusFly.active = false;
        this.bonusFly.bayIndex = -1;
        this._addPopup('FLY +200!', landedBay.x, landedBay.y + 18, PALETTE.CYAN);
      }

      this._addScore(totalPts);
      this.audio.playCoin();
      this._addPopup(`+${totalPts}`, landedBay.x, landedBay.y + 4, PALETTE.GOLD);
      this._spawnParticles(landedBay.x, landedBay.y, PALETTE.GREEN, 18);

      // Check if all 5 Home Bays are filled -> Stage Clear!
      if (this.bays.every((b) => b.filled)) {
        this._addScore(1000);
        this.audio.playStageClear();
        this.stageClearTimer = 2.1;
        this._addPopup('LEVEL CLEAR! +1000', GRID_W / 2, GRID_H / 2, PALETTE.GOLD);
      } else {
        this._spawnFrog();
      }
    }
  }

  _killFrog(cause) {
    this.deathCause = cause;
    this.deathTimer = 1.15;
    this.deathPos = { x: this.frog.x, y: this.frog.y };
    this.renderer.shake(7, 0.25);
    this.audio.playExplosion(0.25);
    this.audio.playHit();

    const color = cause === 'DROWN' ? PALETTE.CYAN : PALETTE.RED;
    this._spawnParticles(this.frog.x, this.frog.y, color, 20);
    const label = cause === 'TIME' ? 'TIME OUT!' : cause === 'DROWN' ? 'SPLASH!' : 'SQUASHED!';
    this._addPopup(label, this.frog.x, this.frog.y - 8, PALETTE.RED);
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear(PALETTE.BG);

    ctx.save();
    ctx.translate(OFFSET_X, OFFSET_Y);

    // 1. Draw Background Zones (River, Median, Highway, Sidewalk, Home Bays)
    this._renderZones(ctx);

    // 2. Draw River Platforms (Logs & Diving Turtles)
    this._renderRiverPlatforms(ctx);

    // 3. Draw Highway Vehicles
    this._renderHighwayVehicles(ctx);

    // 4. Draw Frog (or Death Animation)
    this._renderFrog(ctx);

    // 5. Draw Particles & Score Popups
    this._renderEffects(ctx);

    ctx.restore();

    // 6. Draw Prominent Glowing 60s TIME Bar at bottom (y: 512..538)
    this._renderTimeBar(ctx);

    // 7. Top Arcade HUD
    const filledCount = this.bays.filter((b) => b.filled).length;
    this.renderer.drawHUD({
      title: 'FROGGER',
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `BAYS: ${filledCount}/5`,
      accent: PALETTE.GREEN
    });

    // 8. State Overlay (MENU / PAUSED / GAMEOVER)
    this.renderer.drawStateOverlay(this.state, {
      title: 'FROGGER',
      subtitle: 'HIGHWAY & RIVER CROSSING COIN-OP',
      controls: 'ARROWS/WASD/SWIPE/TAP: HOP 1 CELL  |  P: PAUSE',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GREEN
    });
  }

  _renderZones(ctx) {
    // River Zone (Rows 0 - 5)
    ctx.fillStyle = '#0A1E3F';
    ctx.fillRect(0, 0, GRID_W, 6 * CELL_H);

    // Subtle animated water shimmer lines
    const waveShift = (performance.now() * 0.03) % 48;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.14)';
    ctx.lineWidth = 1.5;
    for (let r = 1; r <= 5; r++) {
      const y = r * CELL_H + CELL_H / 2;
      for (let x = -48 + waveShift; x < GRID_W; x += 48) {
        ctx.beginPath();
        ctx.moveTo(Math.max(0, x), y);
        ctx.lineTo(Math.min(GRID_W, x + 22), y);
        ctx.stroke();
      }
    }

    // Row 0: Top Swamp Bank & 5 Recessed Lily-Pad Home Bays
    ctx.fillStyle = '#064E3B';
    ctx.fillRect(0, 0, GRID_W, CELL_H);
    ctx.strokeStyle = PALETTE.GREEN;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, GRID_W, CELL_H);

    for (const bay of this.bays) {
      const bx = bay.x - bay.width / 2;
      ctx.fillStyle = '#0A1E3F';
      ctx.fillRect(bx, 2, bay.width, CELL_H - 2);
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, 2, bay.width, CELL_H - 2);

      // Draw Lily Pad
      ctx.fillStyle = bay.filled ? '#10B981' : '#059669';
      ctx.beginPath();
      ctx.arc(bay.x, bay.y + 1, 13, 0.2, Math.PI * 2 - 0.2);
      ctx.lineTo(bay.x, bay.y + 1);
      ctx.closePath();
      ctx.fill();

      if (bay.filled) {
        // Draw Smiling Saved Frog icon inside bay
        this._drawFrogSprite(ctx, bay.x, bay.y + 1, 'DOWN', 0, true);
      } else if (this.bonusFly.active && this.bonusFly.bayIndex === bay.index) {
        // Draw Bonus Fly (+200 pts)
        const pulse = Math.sin(performance.now() * 0.02) * 2;
        ctx.save();
        ctx.translate(bay.x, bay.y + pulse);
        ctx.fillStyle = PALETTE.GOLD;
        ctx.shadowColor = PALETTE.GOLD;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.CYAN;
        ctx.beginPath();
        ctx.ellipse(-5, -2, 4, 2, -0.4, 0, Math.PI * 2);
        ctx.ellipse(5, -2, 4, 2, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Row 6: Safe Median Bank
    this._renderSafeBank(ctx, 6 * CELL_H, 'MEDIAN SAFE ZONE');

    // Rows 7 - 11: 5-Lane Highway Asphalt
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 7 * CELL_H, GRID_W, 5 * CELL_H);

    // Dashed Highway Lane Dividers
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([18, 18]);
    for (let r = 8; r <= 11; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL_H);
      ctx.lineTo(GRID_W, r * CELL_H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Row 12: Bottom Starting Sidewalk Bank
    this._renderSafeBank(ctx, 12 * CELL_H, 'START ZONE');

    // Outer Arena Neon Border
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, GRID_W, GRID_H);
  }

  _renderSafeBank(ctx, y) {
    // Classic Konami purple/violet cobblestone roadside & median strip
    ctx.fillStyle = '#3B0764';
    ctx.fillRect(0, y, GRID_W, CELL_H);

    // Top & bottom curb trim
    ctx.fillStyle = '#C084FC';
    ctx.fillRect(0, y, GRID_W, 2);
    ctx.fillStyle = '#581C87';
    ctx.fillRect(0, y + CELL_H - 2, GRID_W, 2);

    // Two staggered courses of violet/magenta cobblestone blocks
    const blockW = 27;
    const halfH = Math.floor((CELL_H - 8) / 2);
    for (let rowIdx = 0; rowIdx < 2; rowIdx++) {
      const by = y + 3 + rowIdx * (halfH + 2);
      const stagger = rowIdx === 1 ? 13 : 0;
      for (let bx = -stagger; bx < GRID_W; bx += blockW) {
        const drawX = Math.max(1, bx + 1);
        const drawW = Math.min(GRID_W - 1, bx + blockW - 2) - drawX;
        if (drawW <= 2) continue;

        ctx.fillStyle = (Math.floor((bx + stagger) / blockW) + rowIdx) % 2 === 0 ? '#9333EA' : '#7E22CE';
        ctx.fillRect(drawX, by, drawW, halfH);

        // Cobblestone top highlight bevel
        ctx.fillStyle = '#D8B4FE';
        ctx.fillRect(drawX + 1, by + 1, Math.max(1, drawW - 2), 2);
      }
    }
  }

  _renderRiverPlatforms(ctx) {
    for (let r = 1; r <= 5; r++) {
      const lane = this.lanes[r];
      if (!lane) continue;
      const cy = r * CELL_H + CELL_H / 2;

      for (const item of lane.items) {
        if (item.isCrocodile) {
          // Stage 2+ Crocodile / Alligator swimming in log lane
          const lh = CELL_H - 10;
          const ly = cy - lh / 2;
          const bodyW = item.w - 26;

          // Armored green body & scutes
          ctx.fillStyle = '#15803D';
          ctx.fillRect(item.x + 8, ly + 2, bodyW - 8, lh - 4);
          ctx.strokeStyle = '#4ADE80';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(item.x + 8, ly + 2, bodyW - 8, lh - 4);

          // Tail ridges on left
          ctx.fillStyle = '#166534';
          ctx.beginPath();
          ctx.moveTo(item.x, cy);
          ctx.lineTo(item.x + 12, ly + 3);
          ctx.lineTo(item.x + 12, ly + lh - 3);
          ctx.closePath();
          ctx.fill();

          for (let sx = item.x + 18; sx < item.x + bodyW - 8; sx += 16) {
            ctx.fillStyle = '#22C55E';
            ctx.fillRect(sx, cy - 5, 8, 3);
            ctx.fillRect(sx, cy + 2, 8, 3);
          }

          // Glowing Yellow Reptile Eyes
          ctx.fillStyle = '#FACC15';
          ctx.fillRect(item.x + bodyW - 6, ly + 3, 5, 4);
          ctx.fillRect(item.x + bodyW - 6, ly + lh - 7, 5, 4);

          // Snapping Jaws on right (travel direction)
          const jawSpread = item.jawsOpen ? 6 : 1;
          ctx.fillStyle = '#15803D';
          ctx.fillRect(item.x + bodyW, cy - 8 - jawSpread, 22, 6);
          ctx.fillRect(item.x + bodyW, cy + 2 + jawSpread, 22, 6);
          if (item.jawsOpen) {
            ctx.fillStyle = '#F8FAFC';
            for (let tx = item.x + bodyW + 4; tx < item.x + bodyW + 20; tx += 5) {
              ctx.fillRect(tx, cy - 2 - jawSpread, 2, 3);
              ctx.fillRect(tx, cy - 1 + jawSpread, 2, 3);
            }
          }
        } else if (lane.platformType.startsWith('LOG')) {
          // Floating Cedar Log with bark grain & end rings
          const lh = CELL_H - 8;
          const ly = cy - lh / 2;

          ctx.fillStyle = '#78350F';
          ctx.fillRect(item.x, ly, item.w, lh);
          ctx.strokeStyle = '#B45309';
          ctx.lineWidth = 2;
          ctx.strokeRect(item.x, ly, item.w, lh);

          // Wood grain stripes
          ctx.strokeStyle = '#92400E';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(item.x + 12, cy - 4);
          ctx.lineTo(item.x + item.w - 12, cy - 4);
          ctx.moveTo(item.x + 20, cy + 4);
          ctx.lineTo(item.x + item.w - 20, cy + 4);
          ctx.stroke();

          // Log end cap
          ctx.fillStyle = '#FCD34D';
          ctx.beginPath();
          ctx.ellipse(item.x + 5, cy, 4, lh / 2 - 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Diving Turtle Group (2 or 3 turtles)
          const count = lane.countPerGroup || 3;
          const spacing = item.w / count;

          for (let i = 0; i < count; i++) {
            const tx = item.x + spacing * (i + 0.5);

            if (item.dives && item.diveState === 'SUBMERGED') {
              // Dashed cyan ripple outline when submerged
              ctx.save();
              ctx.strokeStyle = PALETTE.CYAN;
              ctx.lineWidth = 1.2;
              ctx.setLineDash([3, 3]);
              ctx.beginPath();
              ctx.arc(tx, cy, 11, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
              continue;
            }

            const isWarningBlink =
              item.dives &&
              item.diveState === 'WARNING' &&
              Math.floor(performance.now() * 0.012) % 2 === 0;

            // Flippers
            ctx.fillStyle = '#10B981';
            ctx.fillRect(tx - 11, cy - 12, 5, 4);
            ctx.fillRect(tx + 6, cy - 12, 5, 4);
            ctx.fillRect(tx - 11, cy + 8, 5, 4);
            ctx.fillRect(tx + 6, cy + 8, 5, 4);
            // Head facing left
            ctx.beginPath();
            ctx.arc(tx - 13, cy, 4, 0, Math.PI * 2);
            ctx.fill();

            // Shell
            ctx.fillStyle = isWarningBlink ? '#FFD700' : '#EF4444';
            ctx.beginPath();
            ctx.arc(tx, cy, 10.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#065F46';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      }
    }
  }

  _renderHighwayVehicles(ctx) {
    for (let r = 7; r <= 11; r++) {
      const lane = this.lanes[r];
      if (!lane) continue;
      const cy = r * CELL_H + CELL_H / 2;
      const vh = CELL_H - 8;
      const vy = cy - vh / 2;

      for (const v of lane.items) {
        ctx.save();
        ctx.shadowColor = lane.color;
        ctx.shadowBlur = 6;

        if (lane.vehicleType === 'SEMI_TRUCK') {
          // White Tractor-Trailer Rig (heading Left: Red Cab on left + hitch + White Cargo Trailer on right)
          ctx.fillStyle = '#090D16';
          ctx.fillRect(v.x + 4, vy - 2, 9, 4);
          ctx.fillRect(v.x + 4, vy + vh - 2, 9, 4);
          ctx.fillRect(v.x + 34, vy - 2, 10, 4);
          ctx.fillRect(v.x + 34, vy + vh - 2, 10, 4);
          ctx.fillRect(v.x + v.w - 16, vy - 2, 11, 4);
          ctx.fillRect(v.x + v.w - 16, vy + vh - 2, 11, 4);

          // Hitch bar
          ctx.fillStyle = '#64748B';
          ctx.fillRect(v.x + 21, cy - 3, 8, 6);

          // Red Tractor Cab on left
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(v.x, vy + 2, 23, vh - 4);
          ctx.fillStyle = '#38BDF8';
          ctx.fillRect(v.x + 3, vy + 4, 6, vh - 8);

          // White Cargo Trailer with red side stripe
          ctx.fillStyle = '#F8FAFC';
          ctx.fillRect(v.x + 27, vy, v.w - 27, vh);
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(v.x + 30, cy - 3, v.w - 34, 6);
          ctx.strokeStyle = '#94A3B8';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(v.x + 27, vy, v.w - 27, vh);
        } else if (lane.vehicleType === 'BULLDOZER') {
          // Bulldozer with continuous dark crawler treads and front steel blade
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(v.x + 4, vy - 2, v.w - 14, 5);
          ctx.fillRect(v.x + 4, vy + vh - 3, v.w - 14, 5);
          ctx.fillStyle = '#94A3B8';
          for (let tx = v.x + 6; tx < v.x + v.w - 12; tx += 6) {
            ctx.fillRect(tx, vy - 2, 2, 4);
            ctx.fillRect(tx, vy + vh - 2, 2, 4);
          }

          // Yellow/Orange body & engine cab
          ctx.fillStyle = '#F97316';
          ctx.fillRect(v.x + 4, vy + 2, v.w - 12, vh - 4);
          ctx.fillStyle = '#FACC15';
          ctx.fillRect(v.x + 8, vy + 5, 18, vh - 10);

          // Heavy steel front blade on right
          ctx.fillStyle = '#E2E8F0';
          ctx.fillRect(v.x + v.w - 7, vy - 2, 7, vh + 4);
          ctx.fillStyle = '#64748B';
          ctx.fillRect(v.x + v.w - 9, cy - 6, 3, 12);
        } else if (lane.vehicleType === 'RACE_CAR') {
          // Yellow Open-Wheel Formula Racer (heading Left)
          ctx.fillStyle = '#090D16';
          ctx.fillRect(v.x + 5, vy - 3, 11, 5);
          ctx.fillRect(v.x + v.w - 15, vy - 3, 11, 5);
          ctx.fillRect(v.x + 5, vy + vh - 2, 11, 5);
          ctx.fillRect(v.x + v.w - 15, vy + vh - 2, 11, 5);

          // Nose cone & rear wing
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(v.x, vy + 4, 8, vh - 8);
          ctx.fillRect(v.x + v.w - 7, vy + 1, 7, vh - 2);

          // Yellow fuselage
          ctx.fillStyle = '#FACC15';
          ctx.fillRect(v.x + 6, vy + 3, v.w - 12, vh - 6);

          // Cockpit & driver helmet
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(v.x + 16, vy + 6, 14, vh - 12);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(v.x + 19, cy - 3, 6, 6);
        } else {
          // Pink Coupe / Turbo Cruiser
          ctx.fillStyle = '#090D16';
          ctx.fillRect(v.x + 5, vy - 2, 10, 4);
          ctx.fillRect(v.x + v.w - 15, vy - 2, 10, 4);
          ctx.fillRect(v.x + 5, vy + vh - 2, 10, 4);
          ctx.fillRect(v.x + v.w - 15, vy + vh - 2, 10, 4);

          ctx.fillStyle = lane.color;
          ctx.fillRect(v.x + 1, vy + 1, v.w - 2, vh - 2);

          // Windshield & Roof
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(v.x + v.w * 0.22, vy + 4, v.w * 0.56, vh - 8);
          ctx.fillStyle = lane.accent;
          ctx.fillRect(v.x + v.w * 0.32, vy + 5, v.w * 0.36, vh - 10);
        }

        // Headlight beams in travel direction
        ctx.fillStyle = '#FEF08A';
        const beamX = lane.dir > 0 ? v.x + v.w : v.x - 4;
        ctx.fillRect(beamX, vy + 3, 4, 5);
        ctx.fillRect(beamX, vy + vh - 8, 4, 5);

        ctx.restore();
      }
    }
  }

  _renderFrog(ctx) {
    if (this.deathTimer > 0) {
      // Squash / Splash death ring
      const t = 1 - this.deathTimer / 1.15;
      ctx.save();
      ctx.translate(this.deathPos.x, this.deathPos.y);
      ctx.strokeStyle = this.deathCause === 'DROWN' ? PALETTE.CYAN : PALETTE.RED;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 6 + t * 18, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = PALETTE.PINK;
      ctx.fillRect(-8, -3, 16, 6);
      ctx.fillRect(-3, -8, 6, 16);
      ctx.restore();
      return;
    }

    const f = this.frog;
    const hopProgress = f.hopping ? Math.min(1, f.hopTimer / HOP_DURATION) : 0;
    this._drawFrogSprite(ctx, f.x, f.y, f.facing, hopProgress, false);
  }

  _drawFrogSprite(ctx, x, y, facing, hopProgress = 0, isSmall = false) {
    ctx.save();
    ctx.translate(x, y);

    let angle = 0;
    if (facing === 'DOWN') angle = Math.PI;
    else if (facing === 'LEFT') angle = -Math.PI / 2;
    else if (facing === 'RIGHT') angle = Math.PI / 2;
    ctx.rotate(angle);

    // Smooth hop arc scale & full-body leap extension
    const hopSin = Math.sin(hopProgress * Math.PI);
    const arcScale = (isSmall ? 0.78 : 1.0) * (1 + hopSin * 0.3);
    ctx.scale(arcScale, arcScale);
    const legExtend = hopSin * 8.5;

    ctx.shadowColor = PALETTE.GREEN;
    ctx.shadowBlur = 8;

    // Front legs with webbed 3-toe pads
    ctx.strokeStyle = '#16A34A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(-12, -8 - hopSin * 3);
    ctx.lineTo(-11, -13 - hopSin * 4);
    ctx.moveTo(6, -4);
    ctx.lineTo(12, -8 - hopSin * 3);
    ctx.lineTo(11, -13 - hopSin * 4);

    // Hind legs (extend dramatically during hop arc!)
    ctx.moveTo(-6, 5);
    ctx.lineTo(-13, 8 + legExtend * 0.45);
    ctx.lineTo(-10, 12 + legExtend);
    ctx.moveTo(6, 5);
    ctx.lineTo(13, 8 + legExtend * 0.45);
    ctx.lineTo(10, 12 + legExtend);
    ctx.stroke();

    // Frog Torso (stretches slightly when mid-leap)
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8.5, 10.2 + hopSin * 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Classic Konami yellow dorsal markings
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(-3.5, -5, 7, 3);
    ctx.fillRect(-2, -2, 4, 8);

    // Bulging Red & White Arcade Eyes
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(-5.5, -7.2, 3.3, 0, Math.PI * 2);
    ctx.arc(5.5, -7.2, 3.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-5.5, -8.0, 1.4, 0, Math.PI * 2);
    ctx.arc(5.5, -8.0, 1.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _renderEffects(ctx) {
    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life * 1.6);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 2.5, pt.y - 2.5, 5, 5);
      ctx.restore();
    }

    for (const p of this.popups) {
      ctx.save();
      ctx.font = `700 11px ${FONTS.HEADER}`;
      ctx.fillStyle = p.color;
      ctx.textAlign = 'center';
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
  }

  _renderTimeBar(ctx) {
    const ratio = Math.max(0, Math.min(1, this.lifeTimer / MAX_LIFE_TIME));
    const isLow = this.lifeTimer <= 12.0;
    const barColor = isLow ? PALETTE.RED : PALETTE.GREEN;

    const barX = OFFSET_X + 115;
    const barY = 515;
    const barW = GRID_W - 230;
    const barH = 14;

    this.renderer.drawText('TIME', OFFSET_X + 10, 527, {
      font: FONTS.HEADER,
      size: 13,
      color: isLow ? PALETTE.RED : PALETTE.GOLD,
      glow: 8
    });

    ctx.save();
    ctx.fillStyle = 'rgba(19, 27, 46, 0.9)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = barColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barX, barY, barW, barH);

    this.renderer.drawGlowRect(barX + 2, barY + 2, (barW - 4) * ratio, barH - 4, barColor, 10, true);
    ctx.restore();

    this.renderer.drawText(`${this.lifeTimer.toFixed(1)}S`, OFFSET_X + GRID_W - 10, 527, {
      font: FONTS.HUD,
      size: 15,
      color: barColor,
      align: 'right',
      glow: isLow ? 8 : 0
    });
  }
}

export default Frogger;
