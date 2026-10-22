/**
 * BurgerTime.js
 * Multi-Floor Scaffold Kitchen Arcade Game
 * Guide Chef Peter Pepper across 6 scaffold floors & ladders to step on all 5 segments
 * of giant burger ingredients (Top Bun, Lettuce, Meat Patty, Tomato, Cheese, Bottom Bun).
 * Cascading slices knock down ingredients below them and crush Mr. Hot Dog, Mr. Egg,
 * and Mr. Pickle for massive multi-floor bonuses! Press Action B (or A) to throw Pepper
 * clouds that stun nearby enemies for 3.5 seconds!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const CHEF_SPRITE = [
  '..WWWWWW..',
  '.WWWWWWWW.',
  '..WWWWWW..',
  '..FFKKFF..',
  '..FFFFFF..',
  '.WWWWWWWW.',
  'WW.WWWW.WW',
  '..BBBBBB..',
  '..BB..BB..',
  '.KK....KK.'
];

const INGREDIENT_TYPES = [
  { id: 'topBun', label: 'TOP BUN', color: '#F59E0B', rim: '#FEF08A' },
  { id: 'lettuce', label: 'LETTUCE', color: '#22C55E', rim: '#86EFAC' },
  { id: 'patty', label: 'MEAT PATTY', color: '#92400E', rim: '#D97706' },
  { id: 'tomato', label: 'TOMATO', color: '#EF4444', rim: '#FCA5A5' },
  { id: 'cheese', label: 'CHEESE', color: '#FACC15', rim: '#FEF9C3' },
  { id: 'bottomBun', label: 'BOTTOM BUN', color: '#D97706', rim: '#FDE68A' }
];

// Ladder X indices refer to: [82, 175, 276, 378, 480, 582, 684, 785, 878]
export const KITCHEN_STAGE_LAYOUTS = [
  // Stage 1: Classic 4-Stack Bistro (full ladders & 4 burger stacks)
  {
    name: 'CLASSIC BISTRO',
    floorColor: '#1D4ED8',
    ingredientIndices: [0, 1, 2, 5],
    colFloors: [
      [0, 2, 3, 5],
      [1, 2, 4, 5],
      [1, 2, 4, 5],
      [0, 2, 3, 5]
    ],
    ladderRows: [
      [0, 1, 3, 4, 5, 7, 8],
      [0, 2, 3, 4, 5, 6, 8],
      [0, 1, 2, 4, 6, 7, 8],
      [0, 1, 3, 4, 5, 7, 8],
      [0, 2, 4, 6, 8]
    ],
    enemyTypes: ['hotdog', 'hotdog', 'egg']
  },
  // Stage 2: Split-Bridge Kitchen (staggered ladders & offset ingredient starting floors)
  {
    name: 'SPLIT-BRIDGE KITCHEN',
    floorColor: '#0E7490',
    ingredientIndices: [0, 1, 2, 5],
    colFloors: [
      [0, 1, 3, 4],
      [1, 2, 4, 5],
      [0, 2, 3, 5],
      [1, 3, 4, 5]
    ],
    ladderRows: [
      [0, 2, 6, 8],
      [1, 3, 5, 7],
      [0, 2, 4, 6, 8],
      [1, 4, 7],
      [0, 2, 6, 8]
    ],
    enemyTypes: ['hotdog', 'egg', 'pickle', 'hotdog']
  },
  // Stage 3: Pyramid Steps Kitchen (stepped V/pyramid across the 6 floors with center express ladders)
  {
    name: 'PYRAMID STEPS',
    floorColor: '#7C3AED',
    ingredientIndices: [0, 1, 3, 5],
    colFloors: [
      [1, 3, 4, 5],
      [0, 1, 2, 3],
      [0, 1, 2, 3],
      [1, 3, 4, 5]
    ],
    ladderRows: [
      [0, 3, 4, 5, 8],
      [1, 2, 4, 6, 7],
      [0, 2, 4, 6, 8],
      [0, 1, 4, 7, 8],
      [0, 3, 4, 5, 8]
    ],
    enemyTypes: ['hotdog', 'egg', 'pickle', 'egg']
  },
  // Stage 4: Twin Tower Grill (outer columns start high, inner columns start mid-level with Mr. Egg & Mr. Pickle rush)
  {
    name: 'TWIN TOWER GRILL',
    floorColor: '#B45309',
    ingredientIndices: [0, 1, 2, 4, 5],
    colFloors: [
      [0, 1, 2, 3, 4],
      [1, 2, 3, 4, 5],
      [1, 2, 3, 4, 5],
      [0, 1, 2, 3, 4]
    ],
    ladderRows: [
      [0, 1, 4, 7, 8],
      [0, 2, 3, 5, 6, 8],
      [1, 3, 4, 5, 7],
      [0, 2, 4, 6, 8],
      [0, 1, 3, 5, 7, 8]
    ],
    enemyTypes: ['egg', 'pickle', 'hotdog', 'pickle', 'egg']
  },
  // Stage 5: Labyrinth Scaffold (alternating zig-zag ladder connections between floors)
  {
    name: 'LABYRINTH SCAFFOLD',
    floorColor: '#BE185D',
    ingredientIndices: [0, 1, 2, 3, 5],
    colFloors: [
      [0, 1, 3, 4, 5],
      [0, 2, 3, 4, 5],
      [0, 1, 2, 4, 5],
      [0, 1, 3, 4, 5]
    ],
    ladderRows: [
      [0, 3, 6, 8],
      [1, 4, 7],
      [0, 2, 5, 8],
      [1, 3, 6, 7],
      [0, 2, 4, 8]
    ],
    enemyTypes: ['hotdog', 'pickle', 'egg', 'hotdog', 'pickle']
  },
  // Stage 6: Master Chef 6-Layer Feast (all 6 ingredients per stack with high-speed enemy patrol)
  {
    name: 'MASTER CHEF FEAST',
    floorColor: '#15803D',
    ingredientIndices: [0, 1, 2, 3, 4, 5],
    colFloors: [
      [0, 1, 2, 3, 4, 5],
      [0, 1, 2, 3, 4, 5],
      [0, 1, 2, 3, 4, 5],
      [0, 1, 2, 3, 4, 5]
    ],
    ladderRows: [
      [0, 1, 2, 4, 6, 7, 8],
      [0, 2, 3, 4, 5, 6, 8],
      [0, 1, 3, 4, 5, 7, 8],
      [0, 2, 3, 4, 5, 6, 8],
      [0, 1, 2, 4, 6, 7, 8]
    ],
    enemyTypes: ['hotdog', 'egg', 'pickle', 'hotdog', 'pickle']
  }
];

export class BurgerTime {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'burgertime';
    this.title = 'Bistro Stacker';
    this.state = 'PLAYING';

    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.floorYs = [108, 168, 228, 288, 348, 408];
    this.trayY = 492;
    this.colXs = [175, 378, 582, 785];

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.state = 'PLAYING';
    this.peppers = 5;

    this.particles = [];
    this.floatingTexts = [];
    this.pepperClouds = [];

    this._initKitchen(this.level);
  }

  _initKitchen(level) {
    this.pepperClouds = [];
    this.bonusItem = null;
    this.bonusTimer = 8.0;
    this.levelClearTimer = 0;

    const stageCfg = KITCHEN_STAGE_LAYOUTS[(level - 1) % KITCHEN_STAGE_LAYOUTS.length];
    this.stageName = stageCfg.name;
    this.floorColor = stageCfg.floorColor || '#1D4ED8';

    // Build Ladders connecting the 6 scaffold floors from stage layout
    this.ladders = [];
    const ladderXs = [82, 175, 276, 378, 480, 582, 684, 785, 878];
    for (let f = 0; f < this.floorYs.length - 1; f++) {
      const y1 = this.floorYs[f];
      const y2 = this.floorYs[f + 1];
      const rowIndices = stageCfg.ladderRows[f] || [0, 2, 4, 6, 8];
      for (const idx of rowIndices) {
        this.ladders.push({ x: ladderXs[idx], y1, y2 });
      }
    }

    // Build 4 Columns of Burger Ingredients for this stage layout
    const activeTemplates = stageCfg.ingredientIndices.map((idx) => INGREDIENT_TYPES[idx]);

    this.slices = [];
    for (let c = 0; c < 4; c++) {
      const cx = this.colXs[c];
      const count = activeTemplates.length;
      const colFloorList = stageCfg.colFloors[c];
      for (let r = 0; r < count; r++) {
        const floorIndex = colFloorList ? colFloorList[r] : r + (6 - count);
        const tpl = activeTemplates[r];
        this.slices.push({
          col: c,
          order: r, // 0 is topBun, count-1 is bottomBun
          totalInCol: count,
          type: tpl.id,
          label: tpl.label,
          color: tpl.color,
          rim: tpl.rim,
          x: cx,
          y: this.floorYs[floorIndex],
          width: 104,
          floorIndex,
          segments: [false, false, false, false, false],
          falling: false,
          inTray: false,
          targetY: this.floorYs[floorIndex],
          extraFloors: 0,
          riders: []
        });
      }
    }

    // Initialize Chef Peter Pepper
    this._respawnPlayer();

    // Initialize Enemies: Mr. Hot Dog, Mr. Egg, Mr. Pickle
    this.enemies = [];
    const enemyCatalog = {
      hotdog: { type: 'hotdog', name: 'MR. HOT DOG', color: '#EF4444', accent: '#FDBA74', pts: 100 },
      egg: { type: 'egg', name: 'MR. EGG', color: '#F8FAFC', accent: '#FACC15', pts: 300 },
      pickle: { type: 'pickle', name: 'MR. PICKLE', color: '#22C55E', accent: '#86EFAC', pts: 200 }
    };
    const roster = stageCfg.enemyTypes || ['hotdog', 'egg', 'pickle'];
    const enemyCount = Math.min(6, roster.length + Math.floor((level - 1) / 6));
    for (let i = 0; i < enemyCount; i++) {
      const def = enemyCatalog[roster[i % roster.length]];
      const startFloor = i % 2 === 0 ? 0 : 5;
      const startX = i % 2 === 0 ? 82 : 878;
      this.enemies.push({
        ...def,
        x: startX,
        y: this.floorYs[startFloor],
        dir: i % 2 === 0 ? 1 : -1,
        speed: 74 + level * 8 + (i % 3) * 6,
        onLadder: false,
        stunTimer: 0,
        respawnTimer: 0,
        ridingSlice: null,
        anim: 0
      });
    }
  }

  _respawnPlayer() {
    this.player = {
      x: 480,
      y: this.floorYs[3],
      dir: 1,
      speed: 145,
      onLadder: false,
      invulnTimer: 1.5,
      anim: 0
    };
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.particles = [];
    this.pepperClouds = [];
  }

  _addScore(pts, x, y, color = PALETTE.GOLD) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    if (x !== undefined && y !== undefined) {
      this.floatingTexts.push({
        text: `+${pts}`,
        x,
        y,
        vy: -38,
        life: 0.85,
        maxLife: 0.85,
        color
      });
    }
  }

  _spawnParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 110;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 20,
        life: 0.4 + Math.random() * 0.35,
        maxLife: 0.75,
        color,
        size: 3 + Math.random() * 3
      });
    }
  }

  _triggerSliceFall(slice, extraFloors = 0) {
    if (slice.falling || slice.inTray) return;
    slice.falling = true;
    slice.segments = [false, false, false, false, false];

    // Check if any enemies are standing on this slice when it starts falling!
    const riders = [];
    for (const e of this.enemies) {
      if (
        e.respawnTimer <= 0 &&
        !e.ridingSlice &&
        Math.abs(e.y - slice.y) < 14 &&
        Math.abs(e.x - slice.x) <= slice.width / 2 + 10
      ) {
        e.ridingSlice = slice;
        riders.push(e);
      }
    }
    slice.riders = riders;

    const totalDropFloors = 1 + riders.length + extraFloors;
    if (riders.length > 0) {
      const bonus = 500 * Math.pow(2, riders.length);
      this._addScore(bonus, slice.x, slice.y - 20, PALETTE.CYAN);
      this.audio.playPowerUp();
    } else {
      this._addScore(100, slice.x, slice.y - 12, PALETTE.GOLD);
      this.audio.playDig();
    }

    const nextFloorIdx = slice.floorIndex + totalDropFloors;
    const trayStackY =
      this.trayY - (slice.totalInCol - 1 - slice.order) * 13;

    if (nextFloorIdx >= this.floorYs.length) {
      slice.targetY = trayStackY;
      slice.floorIndex = this.floorYs.length;
    } else {
      slice.targetY = this.floorYs[nextFloorIdx];
      slice.floorIndex = nextFloorIdx;
    }
  }

  _throwPepper() {
    if (this.peppers <= 0) {
      this.audio.playHit();
      return;
    }
    this.peppers--;
    const p = this.player;
    const px = p.x + p.dir * 38;
    const py = p.y - 16;

    this.pepperClouds.push({
      x: px,
      y: py,
      vx: p.dir * 60,
      life: 0.55,
      maxLife: 0.55
    });

    this._spawnParticles(px, py, 16, PALETTE.WHITE);
    this.audio.playSlap();
  }

  update(dt) {
    if (this.state === 'MENU' || this.state === 'GAMEOVER') {
      if (
        this.input.isJustPressed('actionA') ||
        this.input.isJustPressed('actionB') ||
        this.input.pointer.justPressed
      ) {
        this.audio.playMenuSelect();
        this.reset();
        this.setState('PLAYING');
      }
      return;
    }

    if (this.state === 'PAUSED') {
      if (this.input.isJustPressed('actionA') || this.input.isJustPressed('pause')) {
        this.setState('PLAYING');
      }
      return;
    }

    if (this.state !== 'PLAYING') return;

    if (this.levelClearTimer > 0) {
      this.levelClearTimer -= dt;
      if (this.levelClearTimer <= 0) {
        this.level++;
        this.peppers = Math.min(9, this.peppers + 2);
        this._initKitchen(this.level);
      }
      return;
    }

    const p = this.player;
    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);

    // Throw Pepper on Action B or Action A / Tap
    if (
      this.input.isJustPressed('actionB') ||
      this.input.isJustPressed('actionA') ||
      this.input.pointer.justPressed
    ) {
      this._throwPepper();
    }

    // Chef Peter Pepper Scaffold & Ladder Navigation
    const axis = this.input.getAxis();
    if (Math.hypot(axis.x, axis.y) > 0.1) {
      p.anim += dt * 12;
    }

    // Check if near a ladder for vertical movement
    let activeLadder = null;
    for (const l of this.ladders) {
      if (
        Math.abs(p.x - l.x) < 16 &&
        p.y >= l.y1 - 6 &&
        p.y <= l.y2 + 6
      ) {
        if (
          (axis.y < -0.2 && p.y > l.y1 + 1) ||
          (axis.y > 0.2 && p.y < l.y2 - 1)
        ) {
          activeLadder = l;
          break;
        }
      }
    }

    // Check if aligned with a horizontal floor
    let nearestFloorY = this.floorYs[0];
    let minFloorDist = Infinity;
    for (const fy of this.floorYs) {
      const d = Math.abs(p.y - fy);
      if (d < minFloorDist) {
        minFloorDist = d;
        nearestFloorY = fy;
      }
    }

    if (activeLadder && Math.abs(axis.y) >= Math.abs(axis.x) && Math.abs(axis.y) > 0.2) {
      p.x += (activeLadder.x - p.x) * Math.min(1, dt * 18);
      p.y += axis.y * (p.speed * 0.85) * dt;
      p.y = Math.max(activeLadder.y1, Math.min(activeLadder.y2, p.y));
      p.onLadder = true;
    } else if (minFloorDist < 12) {
      p.y = nearestFloorY;
      p.onLadder = false;
      p.x += axis.x * p.speed * dt;
      p.x = Math.max(75, Math.min(885, p.x));
      if (axis.x > 0.1) p.dir = 1;
      else if (axis.x < -0.1) p.dir = -1;
    } else {
      // Mid-ladder vertical movement
      for (const l of this.ladders) {
        if (Math.abs(p.x - l.x) < 16 && p.y >= l.y1 && p.y <= l.y2) {
          p.x = l.x;
          p.y += axis.y * (p.speed * 0.85) * dt;
          p.y = Math.max(l.y1, Math.min(l.y2, p.y));
          break;
        }
      }
    }

    // Check Stepping on Burger Ingredient Segments!
    for (const s of this.slices) {
      if (s.falling || s.inTray) continue;
      if (Math.abs(p.y - s.y) < 10) {
        const leftEdge = s.x - s.width / 2;
        if (p.x >= leftEdge && p.x <= leftEdge + s.width) {
          const segW = s.width / 5;
          const segIdx = Math.max(0, Math.min(4, Math.floor((p.x - leftEdge) / segW)));
          if (!s.segments[segIdx]) {
            s.segments[segIdx] = true;
            this._addScore(50);
            this.audio.playWaka();

            if (s.segments.every(Boolean)) {
              this._triggerSliceFall(s, 0);
            }
          }
        }
      }
    }

    // Update Falling Burger Slices & Cascade Knockdowns
    for (const s of this.slices) {
      if (!s.falling) continue;
      const fallSpeed = 230;
      s.y += fallSpeed * dt;

      // Move any riding enemies down with the slice
      for (const rider of s.riders) {
        rider.x = s.x;
        rider.y = s.y;
      }

      // Check crushing any enemy underneath the falling slice!
      for (const e of this.enemies) {
        if (e.respawnTimer <= 0 && !s.riders.includes(e)) {
          if (
            Math.abs(e.x - s.x) < s.width / 2 + 8 &&
            Math.abs(e.y - s.y) < 16
          ) {
            e.respawnTimer = 3.2;
            this._addScore(500, e.x, e.y - 14, PALETTE.PINK);
            this._spawnParticles(e.x, e.y - 10, 14, e.color);
            this.audio.playPop();
            this.renderer.shake(4, 0.12);
          }
        }
      }

      // Check knocking down the slice directly below in the same column!
      for (const below of this.slices) {
        if (
          below !== s &&
          below.col === s.col &&
          !below.falling &&
          !below.inTray &&
          s.y >= below.y - 10 &&
          s.y <= below.y + 16
        ) {
          this._triggerSliceFall(below, s.riders.length);
        }
      }

      // Check reaching target floor or bottom Burger Tray
      if (s.y >= s.targetY) {
        s.y = s.targetY;
        s.falling = false;

        // Crush & respawn any riders when the slice slams down!
        if (s.riders.length > 0) {
          for (const rider of s.riders) {
            rider.ridingSlice = null;
            rider.respawnTimer = 3.5;
            this._spawnParticles(rider.x, rider.y, 14, rider.color);
          }
          s.riders = [];
          this.renderer.shake(5, 0.15);
          this.audio.playShove();
        }

        const trayStackY = this.trayY - (s.totalInCol - 1 - s.order) * 13;
        if (Math.abs(s.y - trayStackY) < 4) {
          s.y = trayStackY;
          s.inTray = true;
          this.audio.playCoin();
        } else {
          // If another slice is already occupying this floor in the same column, knock it down!
          for (const other of this.slices) {
            if (
              other !== s &&
              other.col === s.col &&
              !other.falling &&
              !other.inTray &&
              Math.abs(other.y - s.y) < 8
            ) {
              this._triggerSliceFall(other, 0);
            }
          }
        }
      }
    }

    // Update Pepper Clouds & Stun Enemies for 3.5s
    for (let i = this.pepperClouds.length - 1; i >= 0; i--) {
      const pc = this.pepperClouds[i];
      pc.x += pc.vx * dt;
      pc.life -= dt;

      for (const e of this.enemies) {
        if (e.respawnTimer <= 0 && Math.hypot(e.x - pc.x, e.y - 16 - pc.y) < 44) {
          if (e.stunTimer <= 0) {
            this._addScore(100, e.x, e.y - 24, PALETTE.CYAN);
            this.floatingTexts.push({
              text: 'PEPPER STUN!',
              x: e.x,
              y: e.y - 36,
              vy: -30,
              life: 0.9,
              maxLife: 0.9,
              color: PALETTE.WHITE
            });
          }
          e.stunTimer = 3.5; // Stunned for 3.5 seconds!
        }
      }

      if (pc.life <= 0) this.pepperClouds.splice(i, 1);
    }

    // Spawn & Collect Bonus Kitchen Items (Coffee / Fries / Ice Cream -> +1 Pepper!)
    this.bonusTimer -= dt;
    if (this.bonusTimer <= 0 && !this.bonusItem) {
      this.bonusTimer = 12.0;
      const items = [
        { name: 'ESPRESSO', pts: 500, color: PALETTE.CYAN },
        { name: 'FRENCH FRIES', pts: 750, color: PALETTE.GOLD },
        { name: 'ICE CREAM', pts: 1000, color: PALETTE.PINK }
      ];
      const pick = items[Math.floor(Math.random() * items.length)];
      this.bonusItem = {
        x: 480,
        y: this.floorYs[2],
        ...pick,
        life: 7.0
      };
    }

    if (this.bonusItem) {
      this.bonusItem.life -= dt;
      if (Math.hypot(p.x - this.bonusItem.x, p.y - this.bonusItem.y) < 26) {
        this.peppers++;
        this._addScore(this.bonusItem.pts, this.bonusItem.x, this.bonusItem.y - 16, this.bonusItem.color);
        this.floatingTexts.push({
          text: '+1 PEPPER!',
          x: this.bonusItem.x,
          y: this.bonusItem.y - 32,
          vy: -38,
          life: 1.0,
          maxLife: 1.0,
          color: PALETTE.WHITE
        });
        this.audio.playPowerUp();
        this.bonusItem = null;
      } else if (this.bonusItem.life <= 0) {
        this.bonusItem = null;
      }
    }

    // Update Enemies (Mr. Hot Dog, Mr. Egg, Mr. Pickle)
    for (const e of this.enemies) {
      if (e.respawnTimer > 0) {
        e.respawnTimer -= dt;
        if (e.respawnTimer <= 0) {
          e.x = Math.random() < 0.5 ? 82 : 878;
          e.y = this.floorYs[0];
          e.onLadder = false;
          e.stunTimer = 0;
        }
        continue;
      }

      if (e.ridingSlice) continue;

      if (e.stunTimer > 0) {
        e.stunTimer = Math.max(0, e.stunTimer - dt);
        continue;
      }

      e.anim += dt * 8;

      if (e.onLadder && e.targetLadder) {
        const l = e.targetLadder;
        const targetY = e.climbDir > 0 ? l.y2 : l.y1;
        e.x = l.x;
        e.y += e.climbDir * (e.speed * 0.78) * dt;
        if ((e.climbDir > 0 && e.y >= targetY) || (e.climbDir < 0 && e.y <= targetY)) {
          e.y = targetY;
          e.onLadder = false;
          e.dir = p.x >= e.x ? 1 : -1;
        }
      } else {
        const prevX = e.x;
        e.x += e.dir * e.speed * dt;
        if (e.x <= 82) {
          e.x = 82;
          e.dir = 1;
        } else if (e.x >= 878) {
          e.x = 878;
          e.dir = -1;
        }

        // Check taking a ladder toward Chef Peter Pepper's floor
        if (Math.abs(p.y - e.y) > 16) {
          const wantDown = p.y > e.y;
          for (const l of this.ladders) {
            const crossed =
              (prevX <= l.x && e.x >= l.x) ||
              (prevX >= l.x && e.x <= l.x) ||
              Math.abs(e.x - l.x) < 4;
            if (!crossed) continue;
            if (wantDown && Math.abs(e.y - l.y1) < 6 && Math.random() < 0.65) {
              e.onLadder = true;
              e.targetLadder = l;
              e.climbDir = 1;
              e.x = l.x;
              break;
            } else if (!wantDown && Math.abs(e.y - l.y2) < 6 && Math.random() < 0.65) {
              e.onLadder = true;
              e.targetLadder = l;
              e.climbDir = -1;
              e.x = l.x;
              break;
            }
          }
        } else if (Math.random() < 0.02) {
          e.dir = p.x >= e.x ? 1 : -1;
        }
      }

      // Check Enemy catching Chef Peter Pepper (only if not stunned!)
      if (
        p.invulnTimer <= 0 &&
        e.stunTimer <= 0 &&
        Math.hypot(p.x - e.x, p.y - e.y) < 22
      ) {
        this.lives--;
        this.audio.playHit();
        this.renderer.shake(6, 0.22);
        this._spawnParticles(p.x, p.y - 16, 18, PALETTE.RED);

        if (this.lives <= 0) {
          HighScoreStore.submit(this.id, this.score);
          this.audio.playGameOver();
          this.setState('GAMEOVER');
          return;
        } else {
          this._respawnPlayer();
        }
      }
    }

    // Update Particles & Floating Texts
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // Check if all 4 Burgers are completely assembled in the bottom Trays!
    if (this.slices.every((s) => s.inTray)) {
      this._addScore(2000 * this.level, 480, 240, PALETTE.GREEN);
      this.audio.playStageClear();
      this.levelClearTimer = 2.0;
    }
  }

  _drawIngredientSlice(ctx, s) {
    const segW = s.width / 5;
    const startX = s.x - s.width / 2;

    for (let i = 0; i < 5; i++) {
      const depressed = s.segments[i] ? 5 : 0;
      const sx = startX + i * segW;
      const sy = s.y - 12 + depressed;

      ctx.save();
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = s.color;

      if (s.type === 'topBun') {
        ctx.fillRect(sx + 1, sy, segW - 2, 11);
        // Sesame seeds
        ctx.fillStyle = PALETTE.WHITE;
        ctx.fillRect(sx + segW * 0.4, sy + 3, 3, 2);
      } else if (s.type === 'lettuce') {
        ctx.beginPath();
        ctx.arc(sx + segW / 2, sy + 6, segW * 0.55, 0, Math.PI);
        ctx.fill();
      } else {
        ctx.fillRect(sx + 1, sy + 2, segW - 2, 9);
        ctx.fillStyle = s.rim;
        ctx.fillRect(sx + 2, sy + 2, segW - 4, 2);
      }
      ctx.restore();
    }
  }

  render(ctx = this.renderer.ctx) {
    ctx.fillStyle = PALETTE.BG;
    ctx.fillRect(0, 38, this.renderer.width, this.renderer.height - 38);

    // Draw Ladders
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 2;
    for (const l of this.ladders) {
      ctx.beginPath();
      ctx.moveTo(l.x - 9, l.y1);
      ctx.lineTo(l.x - 9, l.y2);
      ctx.moveTo(l.x + 9, l.y1);
      ctx.lineTo(l.x + 9, l.y2);
      for (let y = l.y1 + 8; y < l.y2; y += 10) {
        ctx.moveTo(l.x - 9, y);
        ctx.lineTo(l.x + 9, y);
      }
      ctx.stroke();
    }

    // Draw 6 Horizontal Kitchen Scaffold Floors
    for (const fy of this.floorYs) {
      this.renderer.drawGlowRect(65, fy, 830, 5, this.floorColor || '#1D4ED8', 8);
    }

    // Draw 4 Bottom Burger Trays
    for (const cx of this.colXs) {
      ctx.fillStyle = '#334155';
      ctx.fillRect(cx - 60, this.trayY + 4, 120, 8);
      ctx.strokeStyle = PALETTE.CYAN;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 62, this.trayY - 12);
      ctx.lineTo(cx - 62, this.trayY + 12);
      ctx.lineTo(cx + 62, this.trayY + 12);
      ctx.lineTo(cx + 62, this.trayY - 12);
      ctx.stroke();
    }

    // Draw Burger Ingredient Slices
    for (const s of this.slices) {
      this._drawIngredientSlice(ctx, s);
    }

    // Draw Bonus Kitchen Item (Espresso / Fries / Ice Cream)
    if (this.bonusItem) {
      const b = this.bonusItem;
      this.renderer.drawGlowCircle(b.x, b.y - 14, 11, b.color, 12);
      this.renderer.drawText(b.name, b.x, b.y - 28, {
        size: 10,
        color: b.color,
        align: 'center'
      });
    }

    // Draw Enemies (Mr. Hot Dog, Mr. Egg, Mr. Pickle)
    for (const e of this.enemies) {
      if (e.respawnTimer > 0) continue;
      ctx.save();
      const wobble = e.stunTimer > 0 ? Math.sin(performance.now() * 0.04) * 4 : 0;
      ctx.translate(e.x + wobble, e.y);

      if (e.type === 'hotdog') {
        this.renderer.drawGlowRect(-9, -28, 18, 24, e.color, 8);
        ctx.fillStyle = e.accent;
        ctx.fillRect(-11, -24, 3, 18);
        ctx.fillRect(8, -24, 3, 18);
      } else if (e.type === 'egg') {
        this.renderer.drawGlowCircle(0, -16, 12, e.color, 8);
        this.renderer.drawGlowCircle(0, -16, 6, e.accent, 6);
      } else {
        this.renderer.drawGlowRect(-10, -26, 20, 22, e.color, 8);
        ctx.fillStyle = e.accent;
        ctx.fillRect(-6, -22, 4, 4);
        ctx.fillRect(2, -16, 4, 4);
      }

      // Eyes & Legs
      ctx.fillStyle = '#0B0F19';
      ctx.fillRect(-5, -20, 3, 4);
      ctx.fillRect(2, -20, 3, 4);

      if (e.stunTimer > 0) {
        // Pepper-stunned timer halo
        this.renderer.drawText(`${e.stunTimer.toFixed(1)}s`, 0, -34, {
          size: 11,
          color: PALETTE.CYAN,
          align: 'center'
        });
      }
      ctx.restore();
    }

    // Draw Chef Peter Pepper
    const p = this.player;
    if (p.invulnTimer <= 0 || Math.floor(p.invulnTimer * 16) % 2 === 0) {
      const palette = {
        W: PALETTE.WHITE,
        F: '#FDBA74',
        B: PALETTE.CYAN,
        K: '#0B0F19'
      };
      const scale = 3.2;
      const drawX = p.x - (CHEF_SPRITE[0].length * scale) / 2;
      const drawY = p.y - CHEF_SPRITE.length * scale;
      this.renderer.drawPixelSprite(CHEF_SPRITE, drawX, drawY, scale, palette, p.dir < 0, false);
    }

    // Draw Pepper Clouds
    for (const pc of this.pepperClouds) {
      ctx.globalAlpha = pc.life / pc.maxLife;
      for (let i = 0; i < 6; i++) {
        const ox = Math.cos(i * 1.1 + pc.life * 8) * 14;
        const oy = Math.sin(i * 1.3 + pc.life * 8) * 10;
        this.renderer.drawGlowCircle(pc.x + ox, pc.y + oy, 4, PALETTE.WHITE, 8);
      }
    }
    ctx.globalAlpha = 1;

    // Draw Particles & Floating Texts
    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      this.renderer.drawText(ft.text, ft.x, ft.y, {
        size: 13,
        color: ft.color,
        align: 'center',
        glow: 6
      });
    }
    ctx.globalAlpha = 1;

    if (this.levelClearTimer > 0) {
      this.renderer.drawText('ORDER UP! ALL BURGERS ASSEMBLED!', 480, 210, {
        font: FONTS.HEADER,
        size: 18,
        color: PALETTE.GOLD,
        align: 'center',
        glow: 12
      });
    }

    // Top HUD with Pepper Counter
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `PEPPER:${this.peppers}`,
      accent: PALETTE.GOLD
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'KITCHEN SCAFFOLD BURGER BUILDER',
      controls: 'ARROWS/WASD: WALK & CLIMB  |  X/SHIFT/Z: THROW PEPPER STUN',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GOLD
    });
  }
}

export default BurgerTime;
