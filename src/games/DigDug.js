/**
 * DigDug.js
 * Flagship implementation of classic Dig Dug (1982) for Retro Arcade Studio.
 * Features 4 volumetric depth strata, a fine-grained 96x46 dynamic soil mask,
 * 15% digging speed reduction vs open tunnel speed, a 4-stage enemy inflation
 * state machine ('idle' -> 'inflated_1' -> 'inflated_2' -> 'inflated_3' -> 'popped')
 * with 3.0s deflation decay, Pooka & fire-breathing Fygar AI with ghost-eyes phase,
 * and 1.2s suspended wobbling boulders with downward raycast multi-crush physics.
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

export const INFLATION_STATES = [
  'idle',
  'inflated_1',
  'inflated_2',
  'inflated_3',
  'popped'
];

export const INFLATION_SCALES = [1.0, 1.35, 1.7, 2.1, 2.35];

const SOIL_STRATA = [
  {
    name: 'TOP SOIL',
    yStart: 86,
    yEnd: 200,
    fill: '#D99B26',
    speckle: '#F6C453',
    edge: '#FDE047',
    baseScore: 200
  },
  {
    name: 'TERRACOTTA',
    yStart: 200,
    yEnd: 314,
    fill: '#C85A17',
    speckle: '#F97316',
    edge: '#FB923C',
    baseScore: 300
  },
  {
    name: 'CRIMSON RUST',
    yStart: 314,
    yEnd: 428,
    fill: '#9E2A2B',
    speckle: '#EF4444',
    edge: '#F87171',
    baseScore: 400
  },
  {
    name: 'DEEP BEDROCK',
    yStart: 428,
    yEnd: 540,
    fill: '#4C1D57',
    speckle: '#9333EA',
    edge: '#C084FC',
    baseScore: 500
  }
];

const DIR_VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

export const BONUS_VEGGIES = [
  { name: 'CARROT', value: 400, color: '#F97316', stem: '#22C55E', shape: 'cone' },
  { name: 'TURNIP', value: 600, color: '#F8FAFC', stem: '#22C55E', shape: 'round' },
  { name: 'MUSHROOM', value: 800, color: '#D97706', stem: '#FDE68A', shape: 'cap' },
  { name: 'CUCUMBER', value: 1000, color: '#16A34A', stem: '#86EFAC', shape: 'rod' },
  { name: 'EGGPLANT', value: 2000, color: '#9333EA', stem: '#4ADE80', shape: 'oval' },
  { name: 'GREEN PEPPER', value: 3000, color: '#22C55E', stem: '#15803D', shape: 'bell' },
  { name: 'TOMATO', value: 4000, color: '#EF4444', stem: '#22C55E', shape: 'round' },
  { name: 'WATERMELON', value: 5000, color: '#EF4444', stem: '#16A34A', shape: 'slice' },
  { name: 'PINEAPPLE', value: 8000, color: '#FACC15', stem: '#22C55E', shape: 'oval' }
];

export const STAGE_LAYOUTS = [
  // Stage 1: Classic 4-Chamber layout (2 horizontal upper, 1 vertical lower-left, 1 horizontal lower-right) + 4 boulders
  {
    name: 'CLASSIC 4-CHAMBER',
    enemyCount: 4,
    chambers: [
      { x1: 140, y1: 165, x2: 270, y2: 165, type: 'pooka' },
      { x1: 690, y1: 165, x2: 820, y2: 165, type: 'fygar' },
      { x1: 185, y1: 340, x2: 185, y2: 465, type: 'pooka' },
      { x1: 660, y1: 395, x2: 810, y2: 395, type: 'fygar' }
    ],
    rocks: [
      { x: 205, y: 115 },
      { x: 755, y: 115 },
      { x: 310, y: 255 },
      { x: 650, y: 265 }
    ]
  },
  // Stage 2: Twin Vertical Deep Shafts + Central Cross Chamber + 4 boulders
  {
    name: 'TWIN VERTICAL SHAFTS',
    enemyCount: 5,
    extraTunnels: [{ x1: 420, y1: 210, x2: 540, y2: 210 }],
    chambers: [
      { x1: 160, y1: 175, x2: 160, y2: 330, type: 'pooka' },
      { x1: 800, y1: 175, x2: 800, y2: 330, type: 'fygar' },
      { x1: 280, y1: 425, x2: 410, y2: 425, type: 'pooka' },
      { x1: 550, y1: 425, x2: 680, y2: 425, type: 'fygar' },
      { x1: 300, y1: 165, x2: 390, y2: 165, type: 'pooka' }
    ],
    rocks: [
      { x: 160, y: 115 },
      { x: 800, y: 115 },
      { x: 345, y: 310 },
      { x: 615, y: 310 }
    ]
  },
  // Stage 3: Staggered 5-Chamber Terraces + 5 boulders
  {
    name: 'STAGGERED TERRACES',
    enemyCount: 5,
    chambers: [
      { x1: 120, y1: 155, x2: 250, y2: 155, type: 'pooka' },
      { x1: 710, y1: 155, x2: 840, y2: 155, type: 'fygar' },
      { x1: 240, y1: 275, x2: 370, y2: 275, type: 'fygar' },
      { x1: 590, y1: 275, x2: 720, y2: 275, type: 'pooka' },
      { x1: 360, y1: 445, x2: 600, y2: 445, type: 'fygar' }
    ],
    rocks: [
      { x: 185, y: 110 },
      { x: 775, y: 110 },
      { x: 305, y: 210 },
      { x: 655, y: 210 },
      { x: 480, y: 365 }
    ]
  },
  // Stage 4: The Fygar Fire Den (wide horizontal fire alleys + 4 boulders)
  {
    name: 'FYGAR FIRE DEN',
    enemyCount: 5,
    chambers: [
      { x1: 120, y1: 180, x2: 350, y2: 180, type: 'fygar' },
      { x1: 610, y1: 180, x2: 840, y2: 180, type: 'fygar' },
      { x1: 120, y1: 355, x2: 360, y2: 355, type: 'fygar' },
      { x1: 600, y1: 355, x2: 840, y2: 355, type: 'fygar' },
      { x1: 370, y1: 465, x2: 590, y2: 465, type: 'pooka' }
    ],
    rocks: [
      { x: 235, y: 120 },
      { x: 725, y: 120 },
      { x: 240, y: 280 },
      { x: 720, y: 280 }
    ]
  },
  // Stage 5: Zig-Zag Diagonal Strata Pockets + 5 boulders
  {
    name: 'ZIG-ZAG STRATA',
    enemyCount: 6,
    chambers: [
      { x1: 130, y1: 155, x2: 240, y2: 205, type: 'pooka' },
      { x1: 720, y1: 205, x2: 830, y2: 155, type: 'fygar' },
      { x1: 230, y1: 310, x2: 350, y2: 365, type: 'fygar' },
      { x1: 610, y1: 365, x2: 730, y2: 310, type: 'pooka' },
      { x1: 150, y1: 455, x2: 310, y2: 455, type: 'pooka' },
      { x1: 650, y1: 455, x2: 810, y2: 455, type: 'fygar' }
    ],
    rocks: [
      { x: 185, y: 108 },
      { x: 775, y: 108 },
      { x: 290, y: 235 },
      { x: 670, y: 235 },
      { x: 480, y: 380 }
    ]
  },
  // Stage 6: Symmetrical 6-Chamber Honeycomb + 5 boulders
  {
    name: 'HONEYCOMB CAVERN',
    enemyCount: 6,
    chambers: [
      { x1: 130, y1: 160, x2: 260, y2: 160, type: 'pooka' },
      { x1: 700, y1: 160, x2: 830, y2: 160, type: 'pooka' },
      { x1: 130, y1: 300, x2: 260, y2: 300, type: 'fygar' },
      { x1: 700, y1: 300, x2: 830, y2: 300, type: 'fygar' },
      { x1: 180, y1: 440, x2: 340, y2: 440, type: 'pooka' },
      { x1: 620, y1: 440, x2: 780, y2: 440, type: 'fygar' }
    ],
    rocks: [
      { x: 195, y: 112 },
      { x: 765, y: 112 },
      { x: 195, y: 230 },
      { x: 765, y: 230 },
      { x: 480, y: 375 }
    ]
  },
  // Stage 7: Boulder Avalanche (6 boulders poised above narrow vertical shafts)
  {
    name: 'BOULDER AVALANCHE',
    enemyCount: 6,
    chambers: [
      { x1: 150, y1: 210, x2: 150, y2: 360, type: 'pooka' },
      { x1: 300, y1: 230, x2: 300, y2: 390, type: 'fygar' },
      { x1: 660, y1: 230, x2: 660, y2: 390, type: 'fygar' },
      { x1: 810, y1: 210, x2: 810, y2: 360, type: 'pooka' },
      { x1: 220, y1: 465, x2: 420, y2: 465, type: 'pooka' },
      { x1: 540, y1: 465, x2: 740, y2: 465, type: 'fygar' }
    ],
    rocks: [
      { x: 150, y: 125 },
      { x: 300, y: 145 },
      { x: 660, y: 145 },
      { x: 810, y: 125 },
      { x: 360, y: 365 },
      { x: 600, y: 365 }
    ]
  },
  // Stage 8: Championship Deep Cavern (7 enemies + 5 boulders)
  {
    name: 'DEEP CAVERN FINALE',
    enemyCount: 7,
    chambers: [
      { x1: 120, y1: 155, x2: 260, y2: 155, type: 'fygar' },
      { x1: 700, y1: 155, x2: 840, y2: 155, type: 'fygar' },
      { x1: 240, y1: 265, x2: 370, y2: 265, type: 'pooka' },
      { x1: 590, y1: 265, x2: 720, y2: 265, type: 'pooka' },
      { x1: 140, y1: 340, x2: 140, y2: 465, type: 'fygar' },
      { x1: 820, y1: 340, x2: 820, y2: 465, type: 'fygar' },
      { x1: 330, y1: 455, x2: 630, y2: 455, type: 'pooka' }
    ],
    rocks: [
      { x: 190, y: 110 },
      { x: 770, y: 110 },
      { x: 305, y: 195 },
      { x: 655, y: 195 },
      { x: 480, y: 370 }
    ]
  }
];

export class DigDug {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'digdug';
    this.title = 'Dig Dug';

    // Soil mask grid covering y: 86..540 (960x454) at 10x10px resolution
    this.surfaceY = 86;
    this.cellSize = 10;
    this.gridCols = 96; // 96 * 10 = 960
    this.gridRows = 46; // 46 * 10 = 460
    this.soil = []; // soil[r][c]: 1 = solid earth, 0 = excavated tunnel

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.player = null;
    this.harpoon = null;
    this.enemies = [];
    this.rocks = [];
    this.particles = [];
    this.popups = [];
    this.bonusVeggie = null;
    this.rocksDroppedCount = 0;
    this.veggieSpawnedThisStage = false;

    this.stageClearTimer = 0;
    this.deathTimer = 0;
    this.animTime = 0;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.highScore = HighScoreStore.get(this.id);
    this.state = 'PLAYING';
    this.initStage(this.level);
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    if (this.audio && typeof this.audio.stopSequence === 'function') {
      this.audio.stopSequence();
    }
  }

  addScore(points, x = null, y = null, color = PALETTE.GOLD) {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    if (x !== null && y !== null) {
      this.popups.push({
        text: `${points}`,
        x,
        y,
        vy: -34,
        life: 1.0,
        maxLife: 1.0,
        color
      });
    }
  }

  getStratumForY(y) {
    for (let i = 0; i < SOIL_STRATA.length; i++) {
      if (y < SOIL_STRATA[i].yEnd) return SOIL_STRATA[i];
    }
    return SOIL_STRATA[SOIL_STRATA.length - 1];
  }

  initStage(levelNum) {
    this.particles = [];
    this.popups = [];
    this.bonusVeggie = null;
    this.rocksDroppedCount = 0;
    this.veggieSpawnedThisStage = false;
    this.stageClearTimer = 0;
    this.deathTimer = 0;

    const layout = STAGE_LAYOUTS[(levelNum - 1) % STAGE_LAYOUTS.length];
    this.stageName = layout.name;

    // 1. Fill underground soil mask (1 = solid dirt)
    this.soil = [];
    for (let r = 0; r < this.gridRows; r++) {
      this.soil.push(new Uint8Array(this.gridCols).fill(1));
    }

    // 2. Carve central vertical entry shaft & center home pocket
    this.carveLine(480, this.surfaceY, 480, 300, 15, false);
    this.carveLine(445, 300, 515, 300, 15, false);

    if (layout.extraTunnels) {
      for (const et of layout.extraTunnels) {
        this.carveLine(et.x1, et.y1, et.x2, et.y2, 15, false);
      }
    }

    // 3. Configure enemy chambers (horizontal, vertical, or diagonal pockets)
    const chamberDefs = layout.chambers;
    const enemyCount = Math.min(8, Math.max(layout.enemyCount, chamberDefs.length) + Math.floor((levelNum - 1) / 8));
    this.enemies = [];

    for (let i = 0; i < enemyCount; i++) {
      const def = chamberDefs[i % chamberDefs.length];
      this.carveLine(def.x1, def.y1, def.x2, def.y2, 16, false);
      const cx = (def.x1 + def.x2) * 0.5 + (i >= chamberDefs.length ? 22 : 0);
      const cy = (def.y1 + def.y2) * 0.5;
      const isVertical = Math.abs(def.y2 - def.y1) > Math.abs(def.x2 - def.x1);
      const eType = i >= chamberDefs.length ? (i % 2 === 1 ? 'fygar' : 'pooka') : def.type;

      this.enemies.push({
        id: i,
        type: eType, // 'pooka' | 'fygar'
        x: cx,
        y: cy,
        spawnX: cx,
        spawnY: cy,
        dir: isVertical ? 'down' : i % 2 === 0 ? 'right' : 'left',
        facing: i % 2 === 0 ? 1 : -1,
        baseRadius: 13,
        inflationStage: 0, // 0..4
        inflationState: 'idle', // 'idle' | 'inflated_1' | 'inflated_2' | 'inflated_3' | 'popped'
        deflateTimer: 0, // 3.0s total deflation timer
        ghostMode: false,
        ghostTimer: 5.5 + i * 2.2,
        fireChargeTimer: 0,
        fireActiveTimer: 0,
        fireCooldown: 4.5 + i * 1.5,
        turnCooldown: 0,
        crushed: false,
        rockCarriedBy: null,
        animFrame: 0
      });
    }

    // 4. Embed boulders in strategic earth positions above chambers
    this.rocks = layout.rocks.map((rc, idx) => ({
      id: idx,
      x: rc.x,
      y: rc.y,
      radius: 17,
      state: 'embedded', // 'embedded' | 'wobbling' | 'falling' | 'shattering' | 'done'
      hangTimer: 1.2, // 1.2s suspended tremble before downward raycast fall
      shatterTimer: 0.45,
      vy: 0,
      fallenDistance: 0,
      crushCount: 0,
      wobbleOffset: 0
    }));

    this.spawnPlayer();
  }

  spawnPlayer() {
    this.player = {
      x: 480,
      y: 300,
      radius: 12,
      dir: 'right',
      facing: 1,
      baseSpeed: 138,
      currentSpeed: 138,
      isDiggingSoil: false,
      digSoundTimer: 0,
      pumpHoldTimer: 0,
      latchedEnemy: null,
      crushedByRock: null,
      animFrame: 0
    };

    this.harpoon = {
      active: false,
      x: 480,
      y: 300,
      dir: 'right',
      length: 0,
      maxLength: 82,
      extendSpeed: 390,
      latchedEnemy: null
    };
  }

  worldToCell(x, y) {
    const c = Math.floor(x / this.cellSize);
    const r = Math.floor((y - this.surfaceY) / this.cellSize);
    return { c, r };
  }

  isSoilAtCell(c, r) {
    if (c < 0 || c >= this.gridCols || r < 0 || r >= this.gridRows) {
      return false;
    }
    return this.soil[r][c] === 1;
  }

  isSoilAtWorld(x, y) {
    if (y < this.surfaceY) return false;
    const { c, r } = this.worldToCell(x, y);
    return this.isSoilAtCell(c, r);
  }

  /**
   * Checks if any cell in a circular area around (x, y) still contains unexcavated soil
   */
  hasUnexcavatedSoilAround(x, y, radius = 12) {
    const minC = Math.max(0, Math.floor((x - radius) / this.cellSize));
    const maxC = Math.min(this.gridCols - 1, Math.floor((x + radius) / this.cellSize));
    const minR = Math.max(0, Math.floor((y - this.surfaceY - radius) / this.cellSize));
    const maxR = Math.min(this.gridRows - 1, Math.floor((y - this.surfaceY + radius) / this.cellSize));

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (this.soil[r][c] === 1) {
          const cx = (c + 0.5) * this.cellSize;
          const cy = this.surfaceY + (r + 0.5) * this.cellSize;
          if (Math.hypot(cx - x, cy - y) <= radius) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Carves a circular tunnel brush at (x, y), returning the number of newly cleared cells
   */
  carveCircle(x, y, radius = 14, withEffects = true) {
    const minC = Math.max(0, Math.floor((x - radius) / this.cellSize));
    const maxC = Math.min(this.gridCols - 1, Math.floor((x + radius) / this.cellSize));
    const minR = Math.max(0, Math.floor((y - this.surfaceY - radius) / this.cellSize));
    const maxR = Math.min(this.gridRows - 1, Math.floor((y - this.surfaceY + radius) / this.cellSize));

    let cleared = 0;
    const stratum = this.getStratumForY(y);

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (this.soil[r][c] === 1) {
          const cx = (c + 0.5) * this.cellSize;
          const cy = this.surfaceY + (r + 0.5) * this.cellSize;
          if (Math.hypot(cx - x, cy - y) <= radius) {
            this.soil[r][c] = 0;
            cleared++;
            if (withEffects && Math.random() < 0.65) {
              this.particles.push({
                x: cx,
                y: cy,
                vx: (Math.random() - 0.5) * 90,
                vy: -25 - Math.random() * 65,
                gravity: 280,
                size: 3 + Math.random() * 2.5,
                life: 0.25 + Math.random() * 0.2,
                maxLife: 0.45,
                color: Math.random() < 0.5 ? stratum.fill : stratum.speckle
              });
            }
          }
        }
      }
    }
    return cleared;
  }

  carveLine(x1, y1, x2, y2, radius = 14, withEffects = false) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / 6));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.carveCircle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, radius, withEffects);
    }
  }

  isBlockedByEmbeddedRock(x, y, radius = 11, ignoreRock = null) {
    for (const rock of this.rocks) {
      if (rock === ignoreRock || rock.state === 'done' || rock.state === 'shattering') {
        continue;
      }
      if (rock.state === 'embedded' || rock.state === 'wobbling') {
        if (Math.hypot(x - rock.x, y - rock.y) < radius + rock.radius - 2) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Advances an enemy by 1 inflation stage along:
   * 'idle' (0) -> 'inflated_1' (1) -> 'inflated_2' (2) -> 'inflated_3' (3) -> 'popped' (4)
   */
  pumpEnemyStep(enemy) {
    if (!enemy || enemy.inflationState === 'popped') return;

    enemy.ghostMode = false;
    enemy.fireChargeTimer = 0;
    enemy.fireActiveTimer = 0;

    enemy.inflationStage = Math.min(4, enemy.inflationStage + 1);
    enemy.inflationState = INFLATION_STATES[enemy.inflationStage];

    // Reset 3.0s deflation timer (each stage holds 1.0s so 3 stages deflate over 3.0s total)
    enemy.deflateTimer = enemy.inflationStage * 1.0;

    if (enemy.inflationStage < 4) {
      this.audio.playPump(enemy.inflationStage);
    } else {
      // Stage 4: 'popped'!
      this.popEnemy(enemy);
    }
  }

  popEnemy(enemy) {
    enemy.inflationStage = 4;
    enemy.inflationState = 'popped';
    this.audio.playPop();
    this.renderer.shake(7, 0.22);

    const stratum = this.getStratumForY(enemy.y);
    // Classic Dig Dug bonus: Fygars popped horizontally award 2x points!
    const horizMultiplier =
      enemy.type === 'fygar' &&
      (this.player.dir === 'left' || this.player.dir === 'right')
        ? 2
        : 1;
    const pts = stratum.baseScore * horizMultiplier;
    this.addScore(pts, enemy.x, enemy.y - 10, PALETTE.GOLD);

    // Release harpoon
    if (this.harpoon.latchedEnemy === enemy) {
      this.harpoon.active = false;
      this.harpoon.latchedEnemy = null;
      this.player.latchedEnemy = null;
    }

    // Pop explosion particles
    const colors =
      enemy.type === 'pooka'
        ? [PALETTE.RED, '#FDE047', PALETTE.WHITE, PALETTE.ORANGE]
        : [PALETTE.GREEN, PALETTE.ORANGE, '#FDE047', PALETTE.WHITE];

    for (let i = 0; i < 28; i++) {
      const a = (Math.PI * 2 * i) / 28 + Math.random() * 0.2;
      const spd = 60 + Math.random() * 165;
      this.particles.push({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        gravity: 240,
        size: 3.5 + Math.random() * 3.5,
        life: 0.45 + Math.random() * 0.25,
        maxLife: 0.7,
        color: colors[i % colors.length]
      });
    }

    // Remove popped enemy
    const idx = this.enemies.indexOf(enemy);
    if (idx !== -1) {
      this.enemies.splice(idx, 1);
    }

    this.checkStageClear();
  }

  checkStageClear() {
    if (this.enemies.length === 0 && this.stageClearTimer <= 0) {
      this.audio.playStageClear();
      this.addScore(1000, 480, 240, PALETTE.GREEN);
      this.stageClearTimer = 1.4;
    }
  }

  killPlayer() {
    if (this.deathTimer > 0 || this.stageClearTimer > 0) return;
    this.lives--;
    this.audio.playHit();
    this.renderer.shake(9, 0.32);

    this.harpoon.active = false;
    this.harpoon.latchedEnemy = null;
    this.player.latchedEnemy = null;

    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 45 + Math.random() * 145;
      this.particles.push({
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        gravity: 220,
        size: 3.5,
        life: 0.55,
        maxLife: 0.55,
        color: i % 2 === 0 ? PALETTE.CYAN : PALETTE.WHITE
      });
    }

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.audio.playGameOver();
      this.state = 'GAMEOVER';
    } else {
      this.deathTimer = 1.15;
    }
  }

  update(dt) {
    this.animTime += dt;

    if (this.input.isJustPressed('pause')) {
      if (this.state === 'PLAYING') {
        this.state = 'PAUSED';
        return;
      } else if (this.state === 'PAUSED') {
        this.state = 'PLAYING';
        return;
      }
    }

    if (this.state === 'MENU') {
      if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
        this.audio.playMenuSelect();
        this.reset();
      }
      return;
    }

    if (this.state === 'PAUSED') {
      if (this.input.isJustPressed('actionA')) {
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.state === 'GAMEOVER') {
      if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
        this.audio.playMenuSelect();
        this.reset();
      }
      return;
    }

    this.updateEffects(dt);

    if (this.stageClearTimer > 0) {
      this.stageClearTimer -= dt;
      if (this.stageClearTimer <= 0) {
        this.level++;
        this.initStage(this.level);
      }
      return;
    }

    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.spawnPlayer();
        // Reset surviving enemies to their chamber spawns
        for (const e of this.enemies) {
          e.x = e.spawnX;
          e.y = e.spawnY;
          e.inflationStage = 0;
          e.inflationState = 'idle';
          e.deflateTimer = 0;
          e.ghostMode = false;
          e.fireChargeTimer = 0;
          e.fireActiveTimer = 0;
        }
      }
      return;
    }

    this.updatePlayerAndPump(dt);
    this.updateRocks(dt);
    this.updateEnemies(dt);
    this.updateBonusVeggie(dt);
  }

  updateEffects(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += (pt.gravity || 0) * dt;
      pt.life -= dt;
      if (pt.life <= 0) {
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

  updatePlayerAndPump(dt) {
    const p = this.player;
    const h = this.harpoon;

    // 1. Handle Pump Harpoon & Latched Enemy Inflation
    const actionJustPressed =
      this.input.isJustPressed('actionA') || this.input.isJustPressed('actionB');
    const actionHeld =
      this.input.isDown('actionA') || this.input.isDown('actionB');

    let moveDir = null;
    if (this.input.isDown('left')) moveDir = 'left';
    else if (this.input.isDown('right')) moveDir = 'right';
    else if (this.input.isDown('up')) moveDir = 'up';
    else if (this.input.isDown('down')) moveDir = 'down';

    // If latched onto an enemy: pressing or holding Action A pumps the enemy; moving detaches!
    if (h.latchedEnemy) {
      if (
        !this.enemies.includes(h.latchedEnemy) ||
        h.latchedEnemy.inflationState === 'popped'
      ) {
        h.active = false;
        h.latchedEnemy = null;
        p.latchedEnemy = null;
      } else if (moveDir && !actionHeld) {
        // Player walked away -> detach harpoon so enemy begins 3.0s deflation
        h.active = false;
        h.latchedEnemy = null;
        p.latchedEnemy = null;
      } else {
        if (actionJustPressed) {
          p.pumpHoldTimer = 0.26;
          this.pumpEnemyStep(h.latchedEnemy);
          return;
        } else if (actionHeld) {
          p.pumpHoldTimer -= dt;
          if (p.pumpHoldTimer <= 0) {
            p.pumpHoldTimer = 0.26;
            this.pumpEnemyStep(h.latchedEnemy);
            return;
          }
        }
      }
    } else if (actionJustPressed && !h.active) {
      // Fire new harpoon in player's facing direction
      h.active = true;
      h.dir = p.dir;
      h.x = p.x;
      h.y = p.y;
      h.length = 12;
      h.latchedEnemy = null;
      p.pumpHoldTimer = 0.26;
      if (typeof this.audio.playHarpoon === 'function') {
        this.audio.playHarpoon();
      } else {
        this.audio.playLaser(680, 320, 0.07);
      }
    }

    // Extend active unlatched harpoon
    if (h.active && !h.latchedEnemy) {
      h.length += h.extendSpeed * dt;
      const vec = DIR_VECTORS[h.dir];
      const tipX = p.x + vec.x * h.length;
      const tipY = p.y + vec.y * h.length;

      // Check if harpoon tip hits an enemy
      for (const e of this.enemies) {
        const hitRadius = e.baseRadius * INFLATION_SCALES[e.inflationStage] + 6;
        if (Math.hypot(tipX - e.x, tipY - e.y) <= hitRadius) {
          h.latchedEnemy = e;
          p.latchedEnemy = e;
          this.pumpEnemyStep(e);
          break;
        }
      }

      // Stop harpoon if it hits a rock or reaches max length
      if (
        !h.latchedEnemy &&
        (h.length >= h.maxLength ||
          this.isBlockedByEmbeddedRock(tipX, tipY, 4) ||
          tipX < 10 ||
          tipX > 950 ||
          tipY < this.surfaceY - 10 ||
          tipY > 532)
      ) {
        h.active = false;
      }
    }

    // Cannot walk while actively extending harpoon or pumping
    if (h.active && ( !h.latchedEnemy || actionHeld )) {
      return;
    }

    // 2. Player Directional Movement & Soil Excavation (15% speed reduction in soil)
    if (moveDir) {
      // Detach harpoon if moving away
      h.active = false;
      h.latchedEnemy = null;
      p.latchedEnemy = null;

      p.dir = moveDir;
      if (moveDir === 'left') p.facing = -1;
      if (moveDir === 'right') p.facing = 1;

      const vec = DIR_VECTORS[moveDir];
      const probeX = p.x + vec.x * 13;
      const probeY = p.y + vec.y * 13;

      // Check whether leading edge is carving unexcavated soil
      const isCarving =
        probeY >= this.surfaceY && this.hasUnexcavatedSoilAround(probeX, probeY, 10);
      p.isDiggingSoil = isCarving;

      // Exact spec requirement: 15% speed reduction when carving through unexcavated soil
      p.currentSpeed = isCarving ? p.baseSpeed * 0.85 : p.baseSpeed * 1.0;

      const nx = Math.max(18, Math.min(942, p.x + vec.x * p.currentSpeed * dt));
      const ny = Math.max(
        this.surfaceY - 4,
        Math.min(524, p.y + vec.y * p.currentSpeed * dt)
      );

      if (!this.isBlockedByEmbeddedRock(nx, ny, p.radius)) {
        p.x = nx;
        p.y = ny;
        p.animFrame += dt * (isCarving ? 10 : 12);

        const clearedCells = this.carveCircle(p.x, p.y, 14, true);
        if (clearedCells > 0) {
          this.addScore(clearedCells * 2);
          p.digSoundTimer -= dt;
          if (p.digSoundTimer <= 0) {
            p.digSoundTimer = 0.14;
            if (typeof this.audio.playDigDugTunnel === 'function') {
              this.audio.playDigDugTunnel();
            } else {
              this.audio.playDig();
            }
          }
        }
      }
    } else {
      p.isDiggingSoil = false;
      p.currentSpeed = p.baseSpeed;
    }
  }

  /**
   * Updates boulders:
   * - Checks if soil directly beneath an embedded rock is excavated
   * - Suspends & wobbles for 1.2 seconds when undermined
   * - Enters downward collision raycast loop crushing enemies & player
   */
  updateRocks(dt) {
    for (const rock of this.rocks) {
      if (rock.state === 'done') continue;

      if (rock.state === 'embedded') {
        // Check if player excavated the support cells directly below this boulder
        const supportCleared =
          !this.isSoilAtWorld(rock.x, rock.y + rock.radius + 6) &&
          !this.isSoilAtWorld(rock.x - 7, rock.y + rock.radius + 6) &&
          !this.isSoilAtWorld(rock.x + 7, rock.y + rock.radius + 6);

        if (supportCleared) {
          rock.state = 'wobbling';
          rock.hangTimer = 1.2; // Exact 1.2s suspension timer
        }
      } else if (rock.state === 'wobbling') {
        rock.hangTimer -= dt;
        rock.wobbleOffset = Math.sin(this.animTime * 48) * 3.0;

        // Drop warning dust particles from underneath the trembling rock
        if (Math.random() < 0.45) {
          const stratum = this.getStratumForY(rock.y + rock.radius);
          this.particles.push({
            x: rock.x + (Math.random() - 0.5) * 24,
            y: rock.y + rock.radius,
            vx: (Math.random() - 0.5) * 25,
            vy: 30 + Math.random() * 45,
            gravity: 220,
            size: 2.5,
            life: 0.35,
            maxLife: 0.35,
            color: stratum.speckle
          });
        }

        if (rock.hangTimer <= 0) {
          rock.state = 'falling';
          rock.wobbleOffset = 0;
          rock.vy = 60;
          rock.fallenDistance = 0;
          rock.crushCount = 0;
          // Clear immediate pocket where rock was sitting
          this.carveCircle(rock.x, rock.y, rock.radius, false);
        }
      } else if (rock.state === 'falling') {
        rock.vy = Math.min(350, rock.vy + 760 * dt);
        const stepDist = rock.vy * dt;
        const raySteps = Math.max(1, Math.ceil(stepDist / 4));
        const dyStep = stepDist / raySteps;

        let hitBottom = false;

        // Downward collision raycast loop
        for (let s = 0; s < raySteps; s++) {
          const nextY = rock.y + dyStep;
          rock.fallenDistance += dyStep;

          // Carve tunnel behind/around falling rock
          this.carveCircle(rock.x, rock.y, rock.radius - 1, true);

          // Check crushing any enemies in the boulder's path
          for (const e of this.enemies) {
            if (!e.crushed && Math.hypot(e.x - rock.x, e.y - nextY) < rock.radius + 11) {
              e.crushed = true;
              e.rockCarriedBy = rock;
              rock.crushCount++;
              this.audio.playShove();
            }
          }

          // Carry crushed enemies down with the rock
          for (const e of this.enemies) {
            if (e.rockCarriedBy === rock) {
              e.x = rock.x;
              e.y = nextY + 8;
            }
          }

          // Check crushing the player
          if (
            Math.hypot(this.player.x - rock.x, this.player.y - nextY) <
            rock.radius + this.player.radius - 3
          ) {
            this.killPlayer();
          }

          // Raycast check against bottom floor or solid unexcavated earth below tunnel
          const bottomProbeY = nextY + rock.radius + 4;
          const hitSolidFloor =
            bottomProbeY >= 530 ||
            (rock.fallenDistance > 26 &&
              this.isSoilAtWorld(rock.x, bottomProbeY) &&
              this.isSoilAtWorld(rock.x - 8, bottomProbeY) &&
              this.isSoilAtWorld(rock.x + 8, bottomProbeY));

          rock.y = nextY;

          if (hitSolidFloor) {
            hitBottom = true;
            break;
          }
        }

        if (hitBottom) {
          rock.state = 'shattering';
          rock.shatterTimer = 0.42;
          this.rocksDroppedCount++;
          this.audio.playExplosion(0.32, 800);
          this.renderer.shake(8, 0.25);

          // Remove any enemies crushed by this rock and award multi-crush bonus!
          for (let i = this.enemies.length - 1; i >= 0; i--) {
            if (this.enemies[i].rockCarriedBy === rock) {
              this.enemies.splice(i, 1);
            }
          }

          if (rock.crushCount > 0) {
            const crushScores = [0, 1000, 2500, 4000, 8000];
            const bonus =
              crushScores[Math.min(crushScores.length - 1, rock.crushCount)];
            this.addScore(bonus, rock.x, rock.y - 16, PALETTE.PINK);
          }

          // Spawn rock shatter fragments
          for (let i = 0; i < 20; i++) {
            const a = Math.random() * Math.PI * 2;
            const spd = 40 + Math.random() * 130;
            this.particles.push({
              x: rock.x,
              y: rock.y,
              vx: Math.cos(a) * spd,
              vy: Math.sin(a) * spd - 30,
              gravity: 320,
              size: 4 + Math.random() * 3,
              life: 0.45,
              maxLife: 0.45,
              color: i % 2 === 0 ? '#94A3B8' : '#CBD5E1'
            });
          }

          // Spawn Bonus Veggie after 2 rocks drop in a stage
          if (this.rocksDroppedCount >= 2 && !this.veggieSpawnedThisStage) {
            this.veggieSpawnedThisStage = true;
            const vegDef =
              BONUS_VEGGIES[Math.min(BONUS_VEGGIES.length - 1, this.level - 1)];
            this.bonusVeggie = {
              x: 480,
              y: 300,
              timer: 9.0,
              ...vegDef
            };
          }

          this.checkStageClear();
        }
      } else if (rock.state === 'shattering') {
        rock.shatterTimer -= dt;
        if (rock.shatterTimer <= 0) {
          rock.state = 'done';
        }
      }
    }
  }

  /**
   * Updates Pooka & Fygar AI, 3.0s inflation deflation, Ghost-Eyes drift, and Fygar fire breath
   */
  updateEnemies(dt) {
    const p = this.player;
    const baseSpeed = Math.min(112, 74 + (this.level - 1) * 6);

    for (const e of this.enemies) {
      if (e.crushed) continue;
      e.animFrame += dt * 8;

      // 1. Handle 4-stage inflation deflation over 3.0 seconds when pump action halts
      if (e.inflationStage > 0 && e.inflationStage < 4) {
        const isBeingActivelyPumped =
          this.harpoon.latchedEnemy === e &&
          (this.input.isDown('actionA') || this.input.isDown('actionB'));

        if (!isBeingActivelyPumped) {
          // 3 stages deflate over 3.0 seconds total (1.0s per stage)
          e.deflateTimer = Math.max(0, e.deflateTimer - dt);
          const newStage = Math.ceil(e.deflateTimer);
          e.inflationStage = newStage;
          e.inflationState = INFLATION_STATES[newStage];

          if (e.inflationStage === 0) {
            if (this.harpoon.latchedEnemy === e) {
              this.harpoon.active = false;
              this.harpoon.latchedEnemy = null;
              this.player.latchedEnemy = null;
            }
          }
        }
        // Inflated enemies are immobilized in place
        continue;
      }

      // 2. Fygar Horizontal Fire-Breathing State
      if (e.type === 'fygar' && !e.ghostMode) {
        if (e.fireChargeTimer > 0) {
          e.fireChargeTimer -= dt;
          if (e.fireChargeTimer <= 0) {
            e.fireActiveTimer = 0.55;
            this.audio.playExplosion(0.28, 1200);
          }
          continue;
        }
        if (e.fireActiveTimer > 0) {
          e.fireActiveTimer -= dt;
          // Check if player is inside the fire jet hitbox (up to 72px in facing dir)
          const fireWidth = 72;
          const fireMinX = e.facing > 0 ? e.x + 10 : e.x - 10 - fireWidth;
          const fireMaxX = e.facing > 0 ? e.x + 10 + fireWidth : e.x - 10;
          if (
            p.x + p.radius > fireMinX &&
            p.x - p.radius < fireMaxX &&
            Math.abs(p.y - e.y) < 18
          ) {
            this.killPlayer();
            return;
          }
          continue;
        }

        e.fireCooldown -= dt;
        if (
          e.fireCooldown <= 0 &&
          (e.dir === 'left' || e.dir === 'right') &&
          !this.isSoilAtWorld(e.x + e.facing * 32, e.y)
        ) {
          e.fireChargeTimer = 0.55;
          e.fireCooldown = 6.5 + Math.random() * 3.5;
          continue;
        }
      }

      // 3. Ghost-Eyes Phase (drifting through solid dirt toward player's tunnel)
      if (e.ghostMode) {
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        const ghostSpeed = baseSpeed * 0.58;
        e.x += (dx / dist) * ghostSpeed * dt;
        e.y += (dy / dist) * ghostSpeed * dt;
        if (Math.abs(dx) > 2) e.facing = dx > 0 ? 1 : -1;

        e.ghostTimer -= dt;
        // Materialize back into solid enemy when inside an excavated tunnel near player
        if (
          e.ghostTimer <= 0 &&
          !this.hasUnexcavatedSoilAround(e.x, e.y, 11) &&
          !this.isBlockedByEmbeddedRock(e.x, e.y, 12)
        ) {
          e.ghostMode = false;
          e.ghostTimer = 7.5 + Math.random() * 4.0;
        }
      } else {
        // 4. Standard Tunnel Patrol AI
        e.ghostTimer -= dt;
        if (e.ghostTimer <= 0) {
          e.ghostMode = true;
          e.ghostTimer = 2.6 + Math.random() * 1.5;
          continue;
        }

        e.turnCooldown = Math.max(0, e.turnCooldown - dt);
        const vec = DIR_VECTORS[e.dir];
        const step = baseSpeed * dt;
        const nextX = e.x + vec.x * step;
        const nextY = e.y + vec.y * step;
        const probeX = e.x + vec.x * 15;
        const probeY = e.y + vec.y * 15;

        const blocked =
          probeX < 18 ||
          probeX > 942 ||
          probeY < this.surfaceY + 6 ||
          probeY > 524 ||
          this.isSoilAtWorld(probeX, probeY) ||
          this.isBlockedByEmbeddedRock(nextX, nextY, 12);

        // At tunnel junctions or when blocked, pick open tunnel direction toward player
        if (blocked || (e.turnCooldown <= 0 && Math.random() < 0.04)) {
          const dirs = ['up', 'down', 'left', 'right'];
          const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' }[
            e.dir
          ];
          let bestDir = opposite;
          let bestScore = -Infinity;

          for (const d of dirs) {
            const dv = DIR_VECTORS[d];
            const px = e.x + dv.x * 16;
            const py = e.y + dv.y * 16;
            if (
              px >= 18 &&
              px <= 942 &&
              py >= this.surfaceY + 6 &&
              py <= 524 &&
              !this.isSoilAtWorld(px, py) &&
              !this.isBlockedByEmbeddedRock(px, py, 12)
            ) {
              const distToPlayer = Math.hypot(p.x - px, p.y - py);
              let score = -distToPlayer;
              if (d === opposite && !blocked) score -= 80;
              if (score > bestScore) {
                bestScore = score;
                bestDir = d;
              }
            }
          }
          e.dir = bestDir;
          e.turnCooldown = 0.28;
        } else {
          e.x = nextX;
          e.y = nextY;
        }

        if (e.dir === 'left') e.facing = -1;
        else if (e.dir === 'right') e.facing = 1;
      }

      // 5. Check lethal contact with player (only when enemy is uninflated stage 0)
      if (
        e.inflationStage === 0 &&
        Math.hypot(e.x - p.x, e.y - p.y) < e.baseRadius + p.radius - 3
      ) {
        this.killPlayer();
        return;
      }
    }
  }

  updateBonusVeggie(dt) {
    if (!this.bonusVeggie) return;
    this.bonusVeggie.timer -= dt;
    if (this.bonusVeggie.timer <= 0) {
      this.bonusVeggie = null;
      return;
    }

    if (
      Math.hypot(
        this.player.x - this.bonusVeggie.x,
        this.player.y - this.bonusVeggie.y
      ) < 24
    ) {
      this.addScore(
        this.bonusVeggie.value,
        this.bonusVeggie.x,
        this.bonusVeggie.y - 10,
        PALETTE.GREEN
      );
      this.audio.playCoin();
      this.bonusVeggie = null;
    }
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear(PALETTE.BG);

    // 1. Render Sky & Surface Flowers (y: 38..86)
    this.renderSurface(ctx);

    // 2. Render 4 Volumetric Underground Soil Strata & Excavated Tunnels (y: 86..540)
    this.renderSoilLayers(ctx);

    // 3. Render Bonus Veggie if active
    if (this.bonusVeggie) {
      this.renderBonusVeggie(ctx, this.bonusVeggie);
    }

    // 4. Render Boulders
    for (const rock of this.rocks) {
      if (rock.state !== 'done') {
        this.renderRock(ctx, rock);
      }
    }

    // 5. Render Pookas & Fygars (with 4-stage inflation scaling & fire jets)
    for (const e of this.enemies) {
      this.renderEnemy(ctx, e);
    }

    // 6. Render Player & Harpoon Pump Line
    if (this.deathTimer <= 0) {
      this.renderHarpoon(ctx);
      this.renderPlayer(ctx);
    }

    // 7. Render Particles & Score Popups
    this.renderEffects(ctx);

    // 8. Top Arcade HUD
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `ENEMIES: ${this.enemies.length}`,
      accent: PALETTE.ORANGE
    });

    // Stage Clear Banner
    if (this.stageClearTimer > 0) {
      this.renderer.drawGlowRect(310, 230, 340, 74, PALETTE.PANEL, 16, true);
      this.renderer.drawGlowRect(310, 230, 340, 74, PALETTE.GREEN, 16, false, 2.5);
      this.renderer.drawText('ROUND CLEAR! +1000', 480, 275, {
        font: FONTS.HEADER,
        size: 16,
        color: PALETTE.GREEN,
        align: 'center',
        glow: 10
      });
    }

    // Standard State Overlay
    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'VOLUMETRIC TUNNELING  |  4-STAGE PUMP INFLATION & ROCK GRAVITY',
      controls: 'ARROWS/WASD: DIG TUNNELS  |  Z/SPACE: FIRE HARPOON & PUMP ENEMIES',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.ORANGE
    });
  }

  renderSurface(ctx) {
    // Deep twilight arcade sky band
    const grad = ctx.createLinearGradient(0, 38, 0, this.surfaceY);
    grad.addColorStop(0, '#0F172A');
    grad.addColorStop(1, '#1E3A8A');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 38, 960, this.surfaceY - 38);

    // Grass crest along y = 82..86
    ctx.fillStyle = PALETTE.GREEN;
    ctx.fillRect(0, this.surfaceY - 4, 464, 4);
    ctx.fillRect(496, this.surfaceY - 4, 464, 4);

    // Stage indicator flowers on the right side of the surface
    const flowerCount = Math.min(10, this.level);
    for (let i = 0; i < flowerCount; i++) {
      const fx = 920 - i * 24;
      const fy = this.surfaceY - 4;
      // Stem
      ctx.fillStyle = PALETTE.GREEN;
      ctx.fillRect(fx - 1, fy - 12, 2, 12);
      // Petals
      ctx.fillStyle = i % 2 === 0 ? PALETTE.PINK : PALETTE.CYAN;
      ctx.fillRect(fx - 5, fy - 18, 10, 6);
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(fx - 2, fy - 16, 4, 3);
    }
  }

  renderSoilLayers(ctx) {
    // Dark subterranean tunnel background
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, this.surfaceY, 960, 540 - this.surfaceY);

    // Render contiguous horizontal runs of unexcavated soil per row
    for (let r = 0; r < this.gridRows; r++) {
      const y = this.surfaceY + r * this.cellSize;
      const stratum = this.getStratumForY(y + 2);
      const rowData = this.soil[r];

      ctx.fillStyle = stratum.fill;
      let runStart = -1;
      for (let c = 0; c <= this.gridCols; c++) {
        const solid = c < this.gridCols && rowData[c] === 1;
        if (solid && runStart === -1) {
          runStart = c;
        } else if (!solid && runStart !== -1) {
          const rx = runStart * this.cellSize;
          const rw = (c - runStart) * this.cellSize;
          ctx.fillRect(rx, y, rw, this.cellSize);
          runStart = -1;
        }
      }

      // Draw retro geological speckles & stratum border lines
      ctx.fillStyle = stratum.speckle;
      for (let c = 0; c < this.gridCols; c += 2) {
        if (rowData[c] === 1 && (r * 7 + c * 13) % 5 === 0) {
          ctx.fillRect(c * this.cellSize + 3, y + 3, 3, 3);
        }
      }
    }
  }

  renderBonusVeggie(ctx, v) {
    const bob = Math.sin(this.animTime * 6) * 2;
    const color = v.color || PALETTE.ORANGE;
    const stem = v.stem || PALETTE.GREEN;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    // Stem / leaves
    ctx.fillStyle = stem;
    ctx.fillRect(v.x - 6, v.y - 14 + bob, 12, 5);

    ctx.fillStyle = color;
    if (v.shape === 'round' || v.shape === 'bell') {
      ctx.beginPath();
      ctx.arc(v.x, v.y + bob, 8.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (v.shape === 'cap') {
      ctx.beginPath();
      ctx.arc(v.x, v.y - 2 + bob, 9.5, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = stem;
      ctx.fillRect(v.x - 4, v.y - 2 + bob, 8, 10);
    } else if (v.shape === 'rod') {
      ctx.fillRect(v.x - 4, v.y - 9 + bob, 8, 19);
    } else if (v.shape === 'oval') {
      ctx.beginPath();
      ctx.ellipse(v.x, v.y + bob, 7, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (v.shape === 'slice') {
      ctx.beginPath();
      ctx.arc(v.x, v.y - 3 + bob, 10, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = stem;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else {
      // Classic Carrot cone
      ctx.beginPath();
      ctx.moveTo(v.x - 8, v.y - 9 + bob);
      ctx.lineTo(v.x + 8, v.y - 9 + bob);
      ctx.lineTo(v.x, v.y + 11 + bob);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  renderRock(ctx, rock) {
    const rx = Math.round(rock.x + (rock.wobbleOffset || 0));
    const ry = Math.round(rock.y);

    ctx.save();
    if (rock.state === 'shattering') {
      ctx.globalAlpha = Math.max(0, rock.shatterTimer / 0.42);
    }

    // Craggy multi-tone pixel-art boulder (14x14 matrix at scale 2.5 = 35x35px)
    const rockSprite = [
      '....DDDDDD....',
      '..DDLLLLLLDD..',
      '.DLLHHHHLLLLD.',
      '.DLHHHLLLLDDD.',
      'DLLLLLLCCLLLLD',
      'DLLLLCCLLLLLLD',
      'DDDDCCLLLLDDDD',
      'DDLLLLCCLLDDDD',
      'DLLLLLLCCDDDDD',
      'DLLLLLDDDDDDDD',
      '.DDDDDDDDDDDD.',
      '.DDDDCCDDDDDD.',
      '..DDDDDDDDDD..',
      '....DDDDDD....'
    ];
    this.renderer.drawPixelSprite(
      rockSprite,
      rx - 17,
      ry - 17,
      2.5,
      {
        H: '#F8FAFC',
        L: '#94A3B8',
        D: '#64748B',
        C: '#1E293B'
      }
    );

    // Shaking dust particles around the boulder when wobbling
    if (rock.state === 'wobbling') {
      ctx.fillStyle = '#FDE047';
      for (let i = 0; i < 4; i++) {
        const dx = Math.sin(this.animTime * 36 + i * 1.7) * 15;
        const dy = 14 + ((this.animTime * 40 + i * 5) % 8);
        ctx.fillRect(rx + dx - 1.5, ry + dy, 3, 3);
      }
    }

    ctx.restore();
  }

  renderEnemy(ctx, e) {
    const scale = INFLATION_SCALES[e.inflationStage] || 1.0;

    ctx.save();

    // Ghost-Eyes disembodied drift mode
    if (e.ghostMode) {
      const blink = 0.65 + 0.35 * Math.sin(this.animTime * 18);
      ctx.globalAlpha = blink;
      const ghostSprite = [
        '.WWWW..WWWW.',
        'WWWWWWWWWWWW',
        'WWPPWWWWPPWW',
        'WWPPWWWWPPWW',
        '.WWWW..WWWW.'
      ];
      this.renderer.drawPixelSprite(
        ghostSprite,
        e.x - 12,
        e.y - 5,
        2,
        {
          W: PALETTE.WHITE,
          P: e.type === 'pooka' ? PALETTE.RED : PALETTE.GREEN
        },
        e.facing < 0,
        false
      );
      ctx.restore();
      return;
    }

    // Fygar Multi-Flame Pixelated Fire Breath Jet
    if (e.type === 'fygar' && e.fireActiveTimer > 0) {
      const sx = e.x + e.facing * 14;
      const flicker = Math.floor(this.animTime * 28) % 2 === 0;
      const flameColors = {
        R: '#EF4444',
        O: '#F97316',
        Y: '#FACC15',
        W: '#FFFFFF'
      };
      const flameSprite = [
        '........RRRR..RRRRRRRR....',
        '....RRRRROOORROOOOOOOORR..',
        '.RRROOOOOYYYOYYYYYYYYYOOR.',
        'ROOOYYYYYWWWWWWWWYYYYYYOOR',
        '.RRROOOOOYYYOYYYYYYYYYOOR.',
        '....RRRRROOORROOOOOOOORR..',
        '........RRRR..RRRRRRRR....'
      ];
      ctx.save();
      ctx.shadowColor = PALETTE.ORANGE;
      ctx.shadowBlur = 14;
      const fw = 26 * 2.7;
      const drawX = e.facing > 0 ? sx : sx - fw;
      this.renderer.drawPixelSprite(
        flameSprite,
        drawX,
        e.y - 10,
        2.7,
         {
          R: flicker ? flameColors.R : flameColors.O,
          O: flicker ? flameColors.O : flameColors.Y,
          Y: flameColors.Y,
          W: flameColors.W
        },
        e.facing < 0,
        false
      );
      ctx.restore();
    }

    // Flatten slightly if crushed under a falling boulder
    const scaleX = e.crushed ? scale * 1.35 : scale;
    const scaleY = e.crushed ? scale * 0.5 : scale;
    const step = Math.floor(e.animFrame) % 2 === 0;

    ctx.translate(e.x, e.y);
    ctx.scale(scaleX, scaleY);

    if (e.type === 'pooka') {
      // POOKA: Round Red Body, Big Yellow Goggles with White Lenses, Walking Yellow Boots
      const pooka1 = [
        '....RRRRRR....',
        '..RRRRRRRRRR..',
        '.RRRYYYYYYRRR.',
        '.RYYWWWWWWYYR.',
        'RRYWWKWWWKWWYR',
        'RRYWWWWWWWWYRR',
        'RRRYYYYYYYYRRR',
        'RRRRRRRRRRRRRR',
        '.RRRRRRRRRRRR.',
        '..RRRRRRRRRR..',
        '...YY....YY...',
        '..YYYY..YYYY..'
      ];
      const pooka2 = [
        '....RRRRRR....',
        '..RRRRRRRRRR..',
        '.RRRYYYYYYRRR.',
        '.RYYWWWWWWYYR.',
        'RRYWWKWWWKWWYR',
        'RRYWWWWWWWWYRR',
        'RRRYYYYYYYYRRR',
        'RRRRRRRRRRRRRR',
        '.RRRRRRRRRRRR.',
        '..RRRRRRRRRR..',
        '....YY..YY....',
        '...YYYYYYYY...'
      ];
      this.renderer.drawPixelSprite(
        step ? pooka1 : pooka2,
        -14,
        -12,
        2,
        {
          R: e.inflationStage === 3 ? '#FB7185' : '#EF4444',
          Y: '#FACC15',
          W: '#FFFFFF',
          K: '#0F172A'
        },
        e.facing < 0,
        false
      );
    } else {
      // FYGAR: Green Pixelated Dragon Body, Orange Wings, Yellow Belly Plates, Dorsal Spikes
      const charging = e.fireChargeTimer > 0 && Math.sin(this.animTime * 35) > 0;
      const fygar1 = [
        '.W..W..GGGG...',
        '.GGGGGGGGGGGG.',
        '..GGGGGGWWKGGG',
        '.WGGGGGGWWKGGG',
        '..GOOOOGGGGGGG',
        '.WGOOOOGGGGYY.',
        '..GGGGGGGGGYY.',
        '..GGGGGGGGYYY.',
        '...GGGGGGYYY..',
        '....GG...GG...',
        '...GGG..GGG...'
      ];
      const fygar2 = [
        '.W..W..GGGG...',
        '.GGGGGGGGGGGG.',
        '..GGGGGGWWKGGG',
        '.WGGGGGGWWKGGG',
        '..GGOOOOGGGGGG',
        '.WGGOOOOGGGYY.',
        '..GGGGGGGGGYY.',
        '..GGGGGGGGYYY.',
        '...GGGGGGYYY..',
        '...GG....GG...',
        '..GGG....GGG..'
      ];
      this.renderer.drawPixelSprite(
        step ? fygar1 : fygar2,
        -14,
        -11,
        2,
        {
          G: charging ? '#F97316' : e.inflationStage === 3 ? '#86EFAC' : '#22C55E',
          O: charging ? '#FACC15' : '#F97316',
          Y: '#FACC15',
          W: '#FFFFFF',
          K: '#EF4444'
        },
        e.facing < 0,
        false
      );
    }

    // Inflation stage indicator outline when pumped up
    if (e.inflationStage > 0) {
      ctx.strokeStyle = PALETTE.WHITE;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, e.baseRadius + 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  renderHarpoon(ctx) {
    const h = this.harpoon;
    if (!h.active) return;

    const p = this.player;
    let endX = p.x;
    let endY = p.y;

    if (h.latchedEnemy) {
      endX = h.latchedEnemy.x;
      endY = h.latchedEnemy.y;
    } else {
      const vec = DIR_VECTORS[h.dir];
      endX = p.x + vec.x * h.length;
      endY = p.y + vec.y * h.length;
    }

    ctx.save();
    ctx.strokeStyle = PALETTE.GOLD;
    ctx.shadowColor = PALETTE.GOLD;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Barbed harpoon tip
    ctx.fillStyle = PALETTE.RED;
    ctx.beginPath();
    ctx.arc(endX, endY, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderPlayer(ctx) {
    const p = this.player;
    const x = Math.round(p.x - 13);
    const y = Math.round(p.y - 13);
    const step = Math.floor(p.animFrame) % 2 === 0;
    const isPumping = !!(this.harpoon && this.harpoon.latchedEnemy);

    // Taizo Hori iconic white/blue digging helmet & suit pixel-art sprites
    const walkSprite1 = [
      '....WWWWWW....',
      '..WWWWWWWWWW..',
      '..WWBBBBFFFF..',
      '..WWBBBBFKFF..',
      '...WWWWFFFF...',
      '..WWWWBBBBWW..',
      '.WW.BBBBBBBBRR',
      '....WWWWWWWW..',
      '...BB....BB...',
      '..BBB....BBB..'
    ];
    const walkSprite2 = [
      '....WWWWWW....',
      '..WWWWWWWWWW..',
      '..WWBBBBFFFF..',
      '..WWBBBBFKFF..',
      '...WWWWFFFF...',
      '...WWWBBBBW...',
      '..WWBBBBBBBBRR',
      '....WWWWWWWW..',
      '....BB..BB....',
      '...BBB..BBB...'
    ];

    // Air-pump handle animation when latched onto an enemy
    const pumpDown = Math.floor(this.animTime * 10) % 2 === 0;
    const pumpSprite1 = [
      '....WWWWWW.RRR',
      '..WWWWWWWW. .R.',
      '..WWBBBBFF..R.',
      '..WWBBBBFK..R.',
      '...WWWWFFF.RRR',
      '..WWWWBBBBWW..',
      '..WWBBBBBBBB..',
      '....WWWWWWWW..',
      '...BB....BB...',
      '..BBB....BBB..'
    ];
    const pumpSprite2 = [
      '....WWWWWW....',
      '..WWWWWWWW....',
      '..WWBBBBFF.RRR',
      '..WWBBBBFK..R.',
      '...WWWWFFF.RRR',
      '..WWWWBBBBWW..',
      '..WWBBBBBBBB..',
      '....WWWWWWWW..',
      '...BB....BB...',
      '..BBB....BBB..'
    ];

    const activeSprite = isPumping
      ? pumpDown
        ? pumpSprite2
        : pumpSprite1
      : step
        ? walkSprite1
        : walkSprite2;

    this.renderer.drawPixelSprite(
      activeSprite,
      x,
      y,
      2.1,
      {
        W: '#F8FAFC',
        B: '#2563EB',
        F: '#FDE68A',
        K: '#0F172A',
        R: '#EF4444'
      },
      p.facing < 0,
      false
    );
  }

  renderEffects(ctx) {
    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size * 0.5, pt.y - pt.size * 0.5, pt.size, pt.size);
      ctx.restore();
    }

    for (const pop of this.popups) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pop.life / pop.maxLife);
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HEADER,
        size: 12,
        color: pop.color,
        align: 'center',
        glow: 8
      });
      ctx.restore();
    }
  }
}

export default DigDug;
