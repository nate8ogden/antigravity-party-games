/**
 * Flicky.js
 * Classic 1984 Wrap-Around Platformer & Chick Rescue — Retro Arcade Studio Edition.
 * Guide bluebird Flicky across multi-floor platforms to gather chirping yellow Piopio chicks
 * into a trailing daisy-chain formation and lead them to the flashing EXIT door!
 * Jump (Action A) and throw collectible flowerpots/teacups (Action B) at Tiger Cats (Nyannan)!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const FLOORS = [496, 396, 296, 196];

const FLICKY_SPRITE = [
  '....CCCC....',
  '..CCCCCCCC..',
  '.CCWWKKCCCC.',
  '.CCWWKKCCYY.',
  'CCCCCCCCYYYY',
  'CCBBBBCCCC..',
  'CCBBBBBBCC..',
  '.CCCCCCCC...',
  '..CC..CC....',
  '..YY..YY....'
];

const CHICK_SPRITE = [
  '..YYYYY..',
  '.YYYYYYY.',
  'YYWWKYYYY',
  'YYYYYYYYO',
  'YYOYYYYOO',
  '.YYYYYYY.',
  '..Y...Y..',
  '..O...O..'
];

const CHICK_SHADES_SPRITE = [
  '..YYYYY..',
  '.YYYYYYY.',
  'YYKKKKKYY',
  'YYKYYYKYY',
  'YYYYYYYYO',
  '.YYYYYYY.',
  '..Y...Y..',
  '..O...O..'
];

const TIGER_CAT_SPRITE = [
  '.O.O....O.O.',
  'OOOOOOOOOOOO',
  'OKKOOOOOOKKO',
  'OWKOOOOOOKWO',
  'OOWWKKKKWWOO',
  '.OOOOOOOOOO.',
  '..OOKKKKOO.O',
  '.OOOOOOOO.OO',
  '.OO.OOOO.OO.',
  '.WW..WW..WW.'
];

const IGUANA_SPRITE = [
  '..G.G.G.G...',
  '.GGGGGGGGGG.',
  'GGWWKGGGGGGG',
  'GGGGGGGGYYYY',
  '.GGGGGGGGGG.',
  'GG.GGGGGG.GG',
  'G..GG..GG..G',
  '..YY....YY..'
];

const STAGE_LAYOUTS = [
  {
    // Round 1: Classic Blue Brick Living Room
    name: 'ROUND 1: BLUE TERRACE',
    bg: '#0F172A',
    platformFill: '#0284C7',
    platformStroke: '#00F0FF',
    doorX: 480,
    doorY: FLOORS[1],
    platforms: [
      { x: 0, w: 960, y: FLOORS[0] },
      { x: 30, w: 280, y: FLOORS[1] },
      { x: 360, w: 240, y: FLOORS[1] },
      { x: 650, w: 280, y: FLOORS[1] },
      { x: 80, w: 340, y: FLOORS[2] },
      { x: 540, w: 340, y: FLOORS[2] },
      { x: 40, w: 250, y: FLOORS[3] },
      { x: 355, w: 250, y: FLOORS[3] },
      { x: 670, w: 250, y: FLOORS[3] }
    ],
    chicks: [
      { x: 110, y: FLOORS[3] }, { x: 480, y: FLOORS[3] }, { x: 820, y: FLOORS[3] },
      { x: 220, y: FLOORS[2] }, { x: 720, y: FLOORS[2] },
      { x: 160, y: FLOORS[1] }, { x: 800, y: FLOORS[1] }, { x: 240, y: FLOORS[0] }
    ]
  },
  {
    // Round 2: Pink Parlor with Upper Exit Door
    name: 'ROUND 2: ROSE PARLOR',
    bg: '#1F1024',
    platformFill: '#BE185D',
    platformStroke: '#FF007A',
    doorX: 480,
    doorY: FLOORS[2],
    platforms: [
      { x: 0, w: 960, y: FLOORS[0] },
      { x: 60, w: 360, y: FLOORS[1] },
      { x: 540, w: 360, y: FLOORS[1] },
      { x: 20, w: 240, y: FLOORS[2] },
      { x: 340, w: 280, y: FLOORS[2] },
      { x: 700, w: 240, y: FLOORS[2] },
      { x: 120, w: 300, y: FLOORS[3] },
      { x: 540, w: 300, y: FLOORS[3] }
    ],
    chicks: [
      { x: 250, y: FLOORS[3] }, { x: 690, y: FLOORS[3] },
      { x: 130, y: FLOORS[2] }, { x: 830, y: FLOORS[2] },
      { x: 210, y: FLOORS[1] }, { x: 730, y: FLOORS[1] },
      { x: 150, y: FLOORS[0] }, { x: 810, y: FLOORS[0] }
    ]
  },
  {
    // Round 3: Emerald Conservatory with Split Shelves
    name: 'ROUND 3: EMERALD VERANDA',
    bg: '#091E18',
    platformFill: '#047857',
    platformStroke: '#00FF66',
    doorX: 200,
    doorY: FLOORS[1],
    platforms: [
      { x: 0, w: 960, y: FLOORS[0] },
      { x: 60, w: 280, y: FLOORS[1] },
      { x: 400, w: 220, y: FLOORS[1] },
      { x: 680, w: 220, y: FLOORS[1] },
      { x: 30, w: 200, y: FLOORS[2] },
      { x: 290, w: 380, y: FLOORS[2] },
      { x: 730, w: 200, y: FLOORS[2] },
      { x: 80, w: 340, y: FLOORS[3] },
      { x: 540, w: 340, y: FLOORS[3] }
    ],
    chicks: [
      { x: 220, y: FLOORS[3] }, { x: 710, y: FLOORS[3] },
      { x: 110, y: FLOORS[2] }, { x: 480, y: FLOORS[2] }, { x: 830, y: FLOORS[2] },
      { x: 510, y: FLOORS[1] }, { x: 790, y: FLOORS[1] },
      { x: 640, y: FLOORS[0] }
    ]
  },
  {
    // Round 4: Golden Attic (Top Floor Exit Door!)
    name: 'ROUND 4: GOLDEN ATTIC',
    bg: '#1E160A',
    platformFill: '#B45309',
    platformStroke: '#FFD700',
    doorX: 480,
    doorY: FLOORS[3],
    platforms: [
      { x: 0, w: 960, y: FLOORS[0] },
      { x: 40, w: 260, y: FLOORS[1] },
      { x: 350, w: 260, y: FLOORS[1] },
      { x: 660, w: 260, y: FLOORS[1] },
      { x: 90, w: 330, y: FLOORS[2] },
      { x: 540, w: 330, y: FLOORS[2] },
      { x: 30, w: 260, y: FLOORS[3] },
      { x: 350, w: 260, y: FLOORS[3] },
      { x: 670, w: 260, y: FLOORS[3] }
    ],
    chicks: [
      { x: 150, y: FLOORS[3] }, { x: 800, y: FLOORS[3] },
      { x: 240, y: FLOORS[2] }, { x: 710, y: FLOORS[2] },
      { x: 170, y: FLOORS[1] }, { x: 480, y: FLOORS[1] }, { x: 790, y: FLOORS[1] },
      { x: 320, y: FLOORS[0] }
    ]
  },
  {
    // Round 5: Violet Stepping-Stone Gallery
    name: 'ROUND 5: VIOLET BALCONY',
    bg: '#170F2E',
    platformFill: '#6D28D9',
    platformStroke: '#C084FC',
    doorX: 760,
    doorY: FLOORS[1],
    platforms: [
      { x: 0, w: 960, y: FLOORS[0] },
      { x: 40, w: 200, y: FLOORS[1] },
      { x: 290, w: 180, y: FLOORS[1] },
      { x: 520, w: 380, y: FLOORS[1] },
      { x: 60, w: 250, y: FLOORS[2] },
      { x: 360, w: 240, y: FLOORS[2] },
      { x: 650, w: 250, y: FLOORS[2] },
      { x: 140, w: 280, y: FLOORS[3] },
      { x: 540, w: 280, y: FLOORS[3] }
    ],
    chicks: [
      { x: 280, y: FLOORS[3] }, { x: 680, y: FLOORS[3] },
      { x: 180, y: FLOORS[2] }, { x: 480, y: FLOORS[2] }, { x: 780, y: FLOORS[2] },
      { x: 140, y: FLOORS[1] }, { x: 380, y: FLOORS[1] },
      { x: 220, y: FLOORS[0] }
    ]
  },
  {
    // Round 6: Crimson Courtyard (Ground Floor Exit Door!)
    name: 'ROUND 6: CRIMSON COURTYARD',
    bg: '#230C12',
    platformFill: '#991B1B',
    platformStroke: '#FB7185',
    doorX: 480,
    doorY: FLOORS[0],
    platforms: [
      { x: 0, w: 960, y: FLOORS[0] },
      { x: 40, w: 370, y: FLOORS[1] },
      { x: 550, w: 370, y: FLOORS[1] },
      { x: 30, w: 260, y: FLOORS[2] },
      { x: 350, w: 260, y: FLOORS[2] },
      { x: 670, w: 260, y: FLOORS[2] },
      { x: 90, w: 340, y: FLOORS[3] },
      { x: 530, w: 340, y: FLOORS[3] }
    ],
    chicks: [
      { x: 220, y: FLOORS[3] }, { x: 400, y: FLOORS[3] }, { x: 700, y: FLOORS[3] },
      { x: 160, y: FLOORS[2] }, { x: 480, y: FLOORS[2] }, { x: 800, y: FLOORS[2] },
      { x: 210, y: FLOORS[1] }, { x: 740, y: FLOORS[1] }
    ]
  },
  {
    // Round 7: Cyan Skybridge (Four Island Shelves per Floor)
    name: 'ROUND 7: CYAN SKYBRIDGE',
    bg: '#081C24',
    platformFill: '#0E7490',
    platformStroke: '#22D3EE',
    doorX: 480,
    doorY: FLOORS[2],
    platforms: [
      { x: 0, w: 960, y: FLOORS[0] },
      { x: 25, w: 190, y: FLOORS[1] },
      { x: 265, w: 190, y: FLOORS[1] },
      { x: 505, w: 190, y: FLOORS[1] },
      { x: 745, w: 190, y: FLOORS[1] },
      { x: 60, w: 240, y: FLOORS[2] },
      { x: 360, w: 240, y: FLOORS[2] },
      { x: 660, w: 240, y: FLOORS[2] },
      { x: 30, w: 260, y: FLOORS[3] },
      { x: 350, w: 260, y: FLOORS[3] },
      { x: 670, w: 260, y: FLOORS[3] }
    ],
    chicks: [
      { x: 160, y: FLOORS[3] }, { x: 480, y: FLOORS[3] }, { x: 800, y: FLOORS[3] },
      { x: 180, y: FLOORS[2] }, { x: 780, y: FLOORS[2] },
      { x: 120, y: FLOORS[1] }, { x: 600, y: FLOORS[1] }, { x: 840, y: FLOORS[1] }
    ]
  },
  {
    // Round 8: Royal Penthouse Finale
    name: 'ROUND 8: ROYAL PENTHOUSE',
    bg: '#1A1025',
    platformFill: '#4338CA',
    platformStroke: '#FFD700',
    doorX: 480,
    doorY: FLOORS[3],
    platforms: [
      { x: 0, w: 960, y: FLOORS[0] },
      { x: 40, w: 250, y: FLOORS[1] },
      { x: 355, w: 250, y: FLOORS[1] },
      { x: 670, w: 250, y: FLOORS[1] },
      { x: 30, w: 195, y: FLOORS[2] },
      { x: 270, w: 190, y: FLOORS[2] },
      { x: 500, w: 190, y: FLOORS[2] },
      { x: 735, w: 195, y: FLOORS[2] },
      { x: 80, w: 230, y: FLOORS[3] },
      { x: 365, w: 230, y: FLOORS[3] },
      { x: 650, w: 230, y: FLOORS[3] }
    ],
    chicks: [
      { x: 190, y: FLOORS[3] }, { x: 770, y: FLOORS[3] },
      { x: 120, y: FLOORS[2] }, { x: 365, y: FLOORS[2] }, { x: 595, y: FLOORS[2] }, { x: 830, y: FLOORS[2] },
      { x: 165, y: FLOORS[1] }, { x: 795, y: FLOORS[1] }
    ]
  }
];

export class Flicky {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'flicky';
    this.title = 'Flicky';
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
    this.stageClearTimer = 0;

    this._initStage();
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.audio.stopSequence();
  }

  _initStage() {
    const cfg = STAGE_LAYOUTS[(this.level - 1) % STAGE_LAYOUTS.length];
    this.stageTheme = cfg;
    this.doorX = cfg.doorX;
    this.doorY = cfg.doorY;
    this.platforms = cfg.platforms.map((pl) => ({ ...pl }));

    this._resetFlicky();

    // Spawn 8 Chirping Yellow Piopio Chicks across the floors
    this.chicks = [];
    cfg.chicks.forEach((sp, idx) => {
      this.chicks.push({
        x: sp.x,
        y: sp.y,
        vx: idx % 2 === 0 ? 45 : -45,
        sunglasses: idx % 3 === 0,
        state: 'IDLE', // 'IDLE', 'CHAIN', 'RESCUED'
        chainIdx: -1
      });
    });

    // Collectible Throwables (Flowerpots & Teacups)
    this.items = [
      { x: 180, y: FLOORS[2], vx: 0, vy: 0, state: 'GROUND', type: 'POT' },
      { x: 760, y: FLOORS[1], vx: 0, vy: 0, state: 'GROUND', type: 'CUP' }
    ];

    // Tiger Cats (Nyannan) & Green Iguanas (Choro)
    this.enemies = [
      { type: 'CAT', x: 120, y: FLOORS[0], vx: 135, vy: 0, grounded: true, jumpTimer: 1.8 },
      { type: 'CAT', x: 840, y: FLOORS[2], vx: -135, vy: 0, grounded: true, jumpTimer: 2.2 }
    ];
    if (this.level >= 2) {
      this.enemies.push({
        type: 'IGUANA',
        x: 480,
        y: FLOORS[0],
        vx: 165,
        vy: 0,
        grounded: true,
        jumpTimer: 1.4
      });
    }
  }

  _resetFlicky() {
    this.flicky = {
      x: this.doorX,
      y: this.doorY,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: true,
      heldItem: null,
      invuln: 2.0,
      trail: []
    };
    for (let i = 0; i < 120; i++) {
      this.flicky.trail.push({ x: this.doorX, y: this.doorY });
    }
  }

  _wrapX(x) {
    return ((x % this.width) + this.width) % this.width;
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

  _rebuildChainIndices() {
    let idx = 0;
    for (const c of this.chicks) {
      if (c.state === 'CHAIN') {
        c.chainIdx = idx++;
      }
    }
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
      if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.stageClearTimer > 0) {
      this.stageClearTimer -= dt;
      if (this.stageClearTimer <= 0) {
        this.level++;
        this._initStage();
      }
      return;
    }

    const f = this.flicky;
    if (f.invuln > 0) f.invuln = Math.max(0, f.invuln - dt);

    // 1. Flicky Horizontal Wrap-Around Movement & Flutter Jump
    const axis = this.input.getAxis();
    if (Math.abs(axis.x) > 0.1) {
      f.vx = axis.x * 265;
      f.facing = axis.x > 0 ? 1 : -1;
    } else {
      f.vx *= Math.pow(0.05, dt);
    }

    if ((this.input.isJustPressed('actionA') || this.input.isJustPressed('up')) && f.grounded) {
      f.grounded = false;
      f.vy = -440;
      this.audio.playJump();
    }

    const prevY = f.y;
    f.x = this._wrapX(f.x + f.vx * dt);
    f.y += f.vy * dt;
    f.vy += 880 * dt;

    f.grounded = false;
    if (f.vy >= 0) {
      for (const pl of this.platforms) {
        if (f.x >= pl.x && f.x <= pl.x + pl.w && prevY <= pl.y + 4 && f.y >= pl.y) {
          f.y = pl.y;
          f.vy = 0;
          f.grounded = true;
          break;
        }
      }
    }

    // Record breadcrumb trail for daisy-chain chicks
    f.trail.unshift({ x: f.x, y: f.y });
    if (f.trail.length > 140) f.trail.pop();

    // 2. Pick Up & Throw Items (Action B)
    for (const it of this.items) {
      if (it.state === 'GROUND' && !f.heldItem && Math.hypot(it.x - f.x, it.y - f.y) < 24) {
        it.state = 'HELD';
        f.heldItem = it;
        this.audio.playCoin();
      }
    }

    if (this.input.isJustPressed('actionB') && f.heldItem) {
      const it = f.heldItem;
      f.heldItem = null;
      it.state = 'THROWN';
      it.x = f.x;
      it.y = f.y - 14;
      it.vx = f.facing * 390;
      it.vy = -210;
      this.audio.playLaser(680, 260, 0.09);
    }

    for (const it of this.items) {
      if (it.state === 'HELD') {
        it.x = f.x + f.facing * 12;
        it.y = f.y - 16;
      } else if (it.state === 'THROWN') {
        it.x = this._wrapX(it.x + it.vx * dt);
        it.y += it.vy * dt;
        it.vy += 650 * dt;
        if (it.y >= FLOORS[0]) {
          it.y = FLOORS[0];
          it.vx = 0;
          it.vy = 0;
          it.state = 'GROUND';
        }
      }
    }

    // 3. Update Piopio Chicks & Daisy-Chain Rescue at EXIT Door!
    let allRescued = true;
    for (const c of this.chicks) {
      if (c.state === 'RESCUED') continue;
      allRescued = false;

      if (c.state === 'IDLE') {
        if (c.sunglasses) {
          c.x = this._wrapX(c.x + c.vx * dt);
        }
        if (Math.hypot(c.x - f.x, c.y - f.y) < 24) {
          c.state = 'CHAIN';
          this._rebuildChainIndices();
          this.audio.playCoin();
          this._addScore(100, c.x, c.y - 16, 'CHIRP! +100', PALETTE.GOLD);
        }
      } else if (c.state === 'CHAIN') {
        const trailStep = Math.min(f.trail.length - 1, (c.chainIdx + 1) * 12);
        const pos = f.trail[trailStep];
        c.x = pos.x;
        c.y = pos.y;
      }
    }

    // Deliver Chained Chicks when Flicky passes the EXIT Door!
    if (Math.hypot(f.x - this.doorX, f.y - this.doorY) < 28) {
      const chained = this.chicks.filter((c) => c.state === 'CHAIN');
      if (chained.length > 0) {
        for (const c of chained) c.state = 'RESCUED';
        const n = chained.length;
        const bonusTable = [0, 200, 500, 1000, 2000, 3200, 4800, 6400, 10000];
        const pts = bonusTable[Math.min(8, n)];
        this.audio.playPowerUp();
        this._addScore(pts, this.doorX, this.doorY - 36, `${n}x RESCUED! +${pts}`, PALETTE.GREEN);
      }
    }

    if (allRescued) {
      this.stageClearTimer = 1.6;
      this.audio.playStageClear();
      this._addScore(2000, this.doorX, 140, 'ALL CHICKS SAVED! +2000', PALETTE.GOLD);
      return;
    }

    // 4. Update Tiger Cats (Nyannan) & Green Iguanas
    for (const e of this.enemies) {
      const prevEY = e.y;
      e.x = this._wrapX(e.x + e.vx * dt);
      e.y += e.vy * dt;
      e.vy += 820 * dt;

      if (e.vy >= 0) {
        for (const pl of this.platforms) {
          if (e.x >= pl.x && e.x <= pl.x + pl.w && prevEY <= pl.y + 4 && e.y >= pl.y) {
            e.y = pl.y;
            e.vy = 0;
            e.grounded = true;
            break;
          }
        }
      }

      e.jumpTimer -= dt;
      if (e.jumpTimer <= 0 && e.grounded) {
        e.jumpTimer = 1.6 + Math.random() * 1.2;
        e.grounded = false;
        e.vy = f.y < e.y ? -430 : -240;
        e.vx = (f.x >= e.x ? 1 : -1) * (135 + this.level * 12);
      }

      // Check if Thrown Item hits Enemy
      for (const it of this.items) {
        if (it.state === 'THROWN' && Math.hypot(it.x - e.x, it.y - (e.y - 12)) < 26) {
          it.state = 'GROUND';
          it.y = FLOORS[0];
          this.audio.playPop();
          this._addScore(500, e.x, e.y - 20, 'KO! +500', PALETTE.CYAN);
          e.y = FLOORS[0];
          e.x = (e.x + 480) % this.width;
          e.jumpTimer = 2.5;
        }
      }

      // Check if Enemy scatters the Chick Daisy-Chain
      for (const c of this.chicks) {
        if (c.state === 'CHAIN' && Math.hypot(c.x - e.x, c.y - e.y) < 20) {
          c.state = 'IDLE';
          c.y = FLOORS[0];
          this._rebuildChainIndices();
          this.audio.playHit();
        }
      }

      // Check Collision with Flicky
      if (f.invuln <= 0 && Math.hypot(e.x - f.x, e.y - f.y) < 22) {
        this.lives--;
        this.audio.playHit();
        this.renderer.shake(8, 0.3);
        // Scatter any chained chicks back to IDLE so stage remains completable
        for (const c of this.chicks) {
          if (c.state === 'CHAIN') c.state = 'IDLE';
        }
        if (this.lives <= 0) {
          HighScoreStore.submit(this.id, this.score);
          this.state = 'GAMEOVER';
          this.audio.playGameOver();
          return;
        }
        this._resetFlicky();
        break;
      }
    }

    // 5. Popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 28 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  render(ctx = this.renderer.ctx) {
    const theme = this.stageTheme || STAGE_LAYOUTS[0];
    this.renderer.clear(theme.bg);

    // 1. Flashing Home EXIT Door
    const doorPulse = Math.floor(performance.now() * 0.008) % 2 === 0 ? PALETTE.PINK : PALETTE.GOLD;
    this.renderer.drawGlowRect(this.doorX - 24, this.doorY - 54, 48, 54, doorPulse, 12, false, 3);
    ctx.fillStyle = '#1E1B4B';
    ctx.fillRect(this.doorX - 21, this.doorY - 51, 42, 51);
    this.renderer.drawText('EXIT', this.doorX, this.doorY - 24, {
      font: FONTS.HEADER,
      size: 9,
      color: PALETTE.WHITE,
      align: 'center'
    });

    // 2. Multi-Floor Brick & Girder Platforms
    for (const pl of this.platforms) {
      ctx.fillStyle = theme.platformFill;
      ctx.fillRect(pl.x, pl.y, pl.w, 14);
      ctx.strokeStyle = theme.platformStroke;
      ctx.lineWidth = 2;
      ctx.strokeRect(pl.x, pl.y, pl.w, 14);
    }

    // 3. Collectible Flowerpots & Teacups
    for (const it of this.items) {
      this.renderer.drawGlowRect(it.x - 8, it.y - 14, 16, 14, PALETTE.ORANGE, 8, true);
      ctx.fillStyle = PALETTE.GREEN;
      ctx.fillRect(it.x - 4, it.y - 20, 8, 6);
    }

    // 4. Chirping Yellow Piopio Chicks
    for (const c of this.chicks) {
      if (c.state === 'RESCUED') continue;
      const sprite = c.sunglasses ? CHICK_SHADES_SPRITE : CHICK_SPRITE;
      const scale = 2.2;
      const cw = sprite[0].length * scale;
      const ch = sprite.length * scale;
      this.renderer.drawPixelSprite(
        sprite,
        c.x - cw * 0.5,
        c.y - ch,
        scale,
        {
          Y: PALETTE.GOLD,
          O: PALETTE.ORANGE,
          W: PALETTE.WHITE,
          K: '#090D16'
        },
        c.vx < 0
      );
    }

    // 5. Tiger Cats (Nyannan) & Green Iguanas (Choro)
    for (const e of this.enemies) {
      if (e.type === 'IGUANA') {
        const scale = 2.3;
        const ew = IGUANA_SPRITE[0].length * scale;
        const eh = IGUANA_SPRITE.length * scale;
        this.renderer.drawPixelSprite(
          IGUANA_SPRITE,
          e.x - ew * 0.5,
          e.y - eh,
          scale,
          {
            G: PALETTE.GREEN,
            Y: PALETTE.GOLD,
            W: PALETTE.WHITE,
            K: '#090D16'
          },
          e.vx > 0
        );
      } else {
        const scale = 2.3;
        const ew = TIGER_CAT_SPRITE[0].length * scale;
        const eh = TIGER_CAT_SPRITE.length * scale;
        this.renderer.drawPixelSprite(
          TIGER_CAT_SPRITE,
          e.x - ew * 0.5,
          e.y - eh,
          scale,
          {
            O: PALETTE.ORANGE,
            W: PALETTE.WHITE,
            K: '#090D16'
          },
          e.vx < 0
        );
      }
    }

    // 6. Bluebird Flicky
    const f = this.flicky;
    if (f.invuln <= 0 || Math.floor(f.invuln * 14) % 2 === 0) {
      const scale = 2.5;
      const fw = FLICKY_SPRITE[0].length * scale;
      const fh = FLICKY_SPRITE.length * scale;
      this.renderer.drawPixelSprite(
        FLICKY_SPRITE,
        f.x - fw * 0.5,
        f.y - fh,
        scale,
        {
          C: PALETTE.CYAN,
          B: '#2563EB',
          Y: PALETTE.GOLD,
          W: PALETTE.WHITE,
          K: '#090D16'
        },
        f.facing < 0
      );
    }

    // 7. Popups
    for (const pop of this.popups) {
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HEADER,
        size: 11,
        color: pop.color,
        align: 'center',
        glow: 8
      });
    }

    // 8. Top HUD & State Overlay
    const leftCount = this.chicks.filter((c) => c.state !== 'RESCUED').length;
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `CHICKS:${leftCount}`,
      accent: PALETTE.CYAN
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1984 CHICK RESCUE PLATFORMER',
      controls: 'LEFT/RIGHT: RUN  |  Z/UP: FLUTTER JUMP  |  X/SHIFT: THROW ITEM',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.CYAN
    });
  }
}

export default Flicky;
