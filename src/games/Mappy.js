/**
 * Mappy.js
 * Classic 1983 Namco Trampoline Police Mouse Arcade Game ("Trampoline Cop").
 * Features a 6-floor mansion cross-section connected by elastic vertical trampolines
 * (Green -> Blue -> Yellow -> Red -> SNAP on 4th consecutive bounce!), pair-multiplier
 * stolen loot recovery (Radios, TVs, Computers, Paintings, Safes), regular & Microwave
 * Sonic Doors that sweep Meowkies and Boss Goro off screen, and mid-air trampoline immunity.
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const TRAMPOLINE_COLORS = [
  '#00FF66', // 0 bounces: Vivid Green
  '#38BDF8', // 1 bounce: Electric Blue
  '#FFD700', // 2 bounces: Warning Yellow
  '#FF2A55'  // 3 bounces: Critical Red (snaps on 4th bounce!)
];

const LOOT_TYPES = [
  { id: 'radio', name: 'BOOMBOX', basePts: 100, color: '#FF2A55', accent: '#F8FAFC' },
  { id: 'tv', name: 'RETRO TV', basePts: 200, color: '#38BDF8', accent: '#FFD700' },
  { id: 'pc', name: 'MICRO PC', basePts: 300, color: '#00FF66', accent: '#0B0F19' },
  { id: 'art', name: 'MONA LISA', basePts: 400, color: '#FFD700', accent: '#B829FF' },
  { id: 'safe', name: 'GOLD SAFE', basePts: 500, color: '#F97316', accent: '#FDE047' }
];

const MAPPY_SPRITE = [
  '..BBBBBB..',
  '.BWWWWWWB.',
  'BWKWWWWKWB',
  'BWWPPPPWWB',
  '.BBBBBBBB.',
  '..BYYYYB..',
  '.BBBBBBBB.',
  'BB.BBBB.BB',
  '...B..B...',
  '..WW..WW..'
];

const MEOWKY_SPRITE = [
  '.P......P.',
  'PPP....PPP',
  'PPPPPPPPPP',
  'PWKPPPPKWP',
  'PPPPWWPPPP',
  '.PPPPPPPP.',
  '..PPPPPP..',
  '.P.PPPP.P.',
  'P..P..P..P',
  '..WW..WW..'
];

const GORO_SPRITE = [
  '.R......R.',
  'RRR....RRR',
  'RRRRRRRRRR',
  'RYKRRRRKYR',
  'RRRRWWRRRR',
  'RYYYYYYYYR',
  'RRRRRRRRRR',
  'RYYYYYYYYR',
  '.R.RRRR.R.',
  '..WW..WW..'
];

export class Mappy {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'mappy';
    this.title = 'Trampoline Cop';

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    // 6 Mansion Floors (index 0 = top attic floor, index 5 = bottom ground floor)
    this.floorYs = [132, 198, 264, 330, 396, 462];
    this.trampolineY = 514;

    // Vertical shaft centers and widths
    this.shafts = [
      { x: 108, w: 46 },
      { x: 356, w: 46 },
      { x: 604, w: 46 },
      { x: 852, w: 46 }
    ];

    // Walkable floor segments between shafts
    this.floorSegments = [
      { x1: 36, x2: 85 },
      { x1: 131, x2: 333 },
      { x1: 379, x2: 581 },
      { x1: 627, x2: 829 },
      { x1: 875, x2: 924 }
    ];

    this.trampolines = [];
    this.doors = [];
    this.sonicWaves = [];
    this.loots = [];
    this.cats = [];
    this.particles = [];
    this.popups = [];

    this.lastCollectedType = null;
    this.pairMultiplier = 1;
    this.hurryTimer = 45;
    this.hurryTriggered = false;
    this.stageClearTimer = 0;
    this.deathTimer = 0;
    this.animTime = 0;

    this.player = null;
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

  addScore(pts, x = null, y = null, color = PALETTE.GOLD, label = null) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    if (x !== null && y !== null) {
      this.popups.push({
        text: label ? `${label} +${pts}` : `+${pts}`,
        x,
        y,
        vy: -38,
        life: 1.05,
        maxLife: 1.05,
        color
      });
    }
  }

  initStage(level) {
    this.particles = [];
    this.popups = [];
    this.sonicWaves = [];
    this.lastCollectedType = null;
    this.pairMultiplier = 1;
    this.hurryTimer = Math.max(28, 46 - level * 2);
    this.hurryTriggered = false;
    this.stageClearTimer = 0;
    this.deathTimer = 0;

    // 4 Bottom & Mid-shaft Trampolines (each shaft has a primary bottom trampoline)
    this.trampolines = this.shafts.map((s, idx) => ({
      id: idx,
      shaftIndex: idx,
      x: s.x,
      y: this.trampolineY,
      w: s.w + 8,
      bounces: 0, // 0=Green, 1=Blue, 2=Yellow, 3=Red, 4=Snapped
      broken: false,
      deflect: 0
    }));

    const MANSION_CONFIGS = [
      {
        name: 'RED ROOF MANOR',
        roof: '#B91C1C',
        roofTrim: '#FCA5A5',
        wall: '#151E32',
        floorBar: '#F59E0B',
        doors: [
          { floor: 0, x: 230, facing: -1, microwave: false },
          { floor: 0, x: 725, facing: 1, microwave: true },
          { floor: 1, x: 205, facing: 1, microwave: true },
          { floor: 1, x: 480, facing: -1, microwave: false },
          { floor: 2, x: 480, facing: 1, microwave: true },
          { floor: 2, x: 740, facing: -1, microwave: false },
          { floor: 3, x: 230, facing: -1, microwave: false },
          { floor: 3, x: 720, facing: 1, microwave: true },
          { floor: 4, x: 215, facing: 1, microwave: false },
          { floor: 4, x: 480, facing: -1, microwave: true },
          { floor: 5, x: 480, facing: 1, microwave: false }
        ],
        loots: [
          { floor: 0, x: 170 }, { floor: 0, x: 520 },
          { floor: 1, x: 285 }, { floor: 1, x: 780 },
          { floor: 2, x: 185 }, { floor: 2, x: 675 },
          { floor: 3, x: 440 }, { floor: 3, x: 790 },
          { floor: 4, x: 295 }, { floor: 4, x: 695 }
        ]
      },
      {
        name: 'SAPPHIRE PENTHOUSE',
        roof: '#1D4ED8',
        roofTrim: '#93C5FD',
        wall: '#0F172A',
        floorBar: '#38BDF8',
        doors: [
          { floor: 0, x: 210, facing: 1, microwave: true },
          { floor: 0, x: 480, facing: -1, microwave: false },
          { floor: 1, x: 250, facing: -1, microwave: false },
          { floor: 1, x: 730, facing: 1, microwave: true },
          { floor: 2, x: 215, facing: 1, microwave: true },
          { floor: 2, x: 490, facing: -1, microwave: false },
          { floor: 3, x: 470, facing: 1, microwave: true },
          { floor: 3, x: 735, facing: -1, microwave: false },
          { floor: 4, x: 235, facing: -1, microwave: false },
          { floor: 4, x: 720, facing: 1, microwave: true },
          { floor: 5, x: 230, facing: 1, microwave: false }
        ],
        loots: [
          { floor: 0, x: 290 }, { floor: 0, x: 760 },
          { floor: 1, x: 175 }, { floor: 1, x: 530 },
          { floor: 2, x: 295 }, { floor: 2, x: 775 },
          { floor: 3, x: 185 }, { floor: 3, x: 535 },
          { floor: 4, x: 430 }, { floor: 4, x: 790 }
        ]
      },
      {
        name: 'EMERALD GALLERY',
        roof: '#047857',
        roofTrim: '#6EE7B7',
        wall: '#091E1A',
        floorBar: '#10B981',
        doors: [
          { floor: 0, x: 480, facing: 1, microwave: true },
          { floor: 0, x: 730, facing: -1, microwave: false },
          { floor: 1, x: 220, facing: -1, microwave: false },
          { floor: 1, x: 475, facing: 1, microwave: true },
          { floor: 2, x: 235, facing: 1, microwave: false },
          { floor: 2, x: 715, facing: -1, microwave: true },
          { floor: 3, x: 210, facing: -1, microwave: true },
          { floor: 3, x: 480, facing: 1, microwave: false },
          { floor: 4, x: 485, facing: -1, microwave: false },
          { floor: 4, x: 735, facing: 1, microwave: true },
          { floor: 5, x: 720, facing: -1, microwave: false }
        ],
        loots: [
          { floor: 0, x: 195 }, { floor: 0, x: 660 },
          { floor: 1, x: 300 }, { floor: 1, x: 750 },
          { floor: 2, x: 435 }, { floor: 2, x: 785 },
          { floor: 3, x: 285 }, { floor: 3, x: 685 },
          { floor: 4, x: 180 }, { floor: 4, x: 540 }
        ]
      },
      {
        name: 'VIOLET CHATEAU',
        roof: '#7E22CE',
        roofTrim: '#D8B4FE',
        wall: '#1B102E',
        floorBar: '#F472B6',
        doors: [
          { floor: 0, x: 225, facing: -1, microwave: true },
          { floor: 1, x: 480, facing: 1, microwave: false },
          { floor: 1, x: 725, facing: -1, microwave: true },
          { floor: 2, x: 215, facing: 1, microwave: false },
          { floor: 2, x: 480, facing: -1, microwave: true },
          { floor: 3, x: 240, facing: 1, microwave: true },
          { floor: 3, x: 715, facing: -1, microwave: false },
          { floor: 4, x: 210, facing: -1, microwave: true },
          { floor: 4, x: 735, facing: 1, microwave: false },
          { floor: 5, x: 235, facing: 1, microwave: false },
          { floor: 5, x: 725, facing: -1, microwave: false }
        ],
        loots: [
          { floor: 0, x: 295 }, { floor: 0, x: 480 },
          { floor: 1, x: 180 }, { floor: 1, x: 660 },
          { floor: 2, x: 295 }, { floor: 2, x: 760 },
          { floor: 3, x: 480 }, { floor: 3, x: 785 },
          { floor: 4, x: 285 }, { floor: 4, x: 525 }
        ]
      },
      {
        name: 'GOLDEN BULLION VAULT',
        roof: '#B45309',
        roofTrim: '#FDE047',
        wall: '#1F160B',
        floorBar: '#FBBF24',
        doors: [
          { floor: 0, x: 240, facing: 1, microwave: false },
          { floor: 0, x: 715, facing: -1, microwave: true },
          { floor: 1, x: 215, facing: -1, microwave: true },
          { floor: 1, x: 735, facing: 1, microwave: false },
          { floor: 2, x: 475, facing: 1, microwave: true },
          { floor: 3, x: 220, facing: 1, microwave: false },
          { floor: 3, x: 485, facing: -1, microwave: true },
          { floor: 4, x: 230, facing: -1, microwave: false },
          { floor: 4, x: 480, facing: 1, microwave: true },
          { floor: 5, x: 480, facing: -1, microwave: false }
        ],
        loots: [
          { floor: 0, x: 170 }, { floor: 0, x: 790 },
          { floor: 1, x: 430 }, { floor: 1, x: 530 },
          { floor: 2, x: 190 }, { floor: 2, x: 760 },
          { floor: 3, x: 295 }, { floor: 3, x: 735 },
          { floor: 4, x: 665 }, { floor: 4, x: 790 }
        ]
      },
      {
        name: 'GORO GRAND FORTRESS',
        roof: '#BE123C',
        roofTrim: '#FDA4AF',
        wall: '#1E1122',
        floorBar: '#FB923C',
        doors: [
          { floor: 0, x: 220, facing: 1, microwave: true },
          { floor: 0, x: 480, facing: -1, microwave: false },
          { floor: 0, x: 735, facing: -1, microwave: true },
          { floor: 1, x: 235, facing: -1, microwave: false },
          { floor: 1, x: 720, facing: 1, microwave: false },
          { floor: 2, x: 215, facing: 1, microwave: true },
          { floor: 2, x: 735, facing: -1, microwave: true },
          { floor: 3, x: 480, facing: 1, microwave: false },
          { floor: 4, x: 225, facing: -1, microwave: true },
          { floor: 4, x: 725, facing: 1, microwave: false },
          { floor: 5, x: 230, facing: 1, microwave: false },
          { floor: 5, x: 730, facing: -1, microwave: false }
        ],
        loots: [
          { floor: 0, x: 295 }, { floor: 0, x: 665 },
          { floor: 1, x: 170 }, { floor: 1, x: 480 },
          { floor: 2, x: 430 }, { floor: 2, x: 530 },
          { floor: 3, x: 195 }, { floor: 3, x: 765 },
          { floor: 4, x: 300 }, { floor: 4, x: 665 }
        ]
      }
    ];

    const cfg = MANSION_CONFIGS[(level - 1) % MANSION_CONFIGS.length];
    this.mansionTheme = cfg;

    // Create Doors across the 6 floors (both Standard Doors and Microwave Sonic Doors)
    this.doors = [];
    cfg.doors.forEach((dp, i) => {
      this.doors.push({
        id: i,
        floor: dp.floor,
        x: dp.x,
        y: this.floorYs[dp.floor],
        facing: dp.facing, // direction sonic wave travels when opened
        isOpen: false,
        isMicrowave: dp.microwave,
        charges: dp.microwave ? 1 : 0,
        rechargeTimer: 0
      });
    });

    // Place 10 Stolen Loot items (2 of each of the 5 LOOT_TYPES)
    const lootSpots = cfg.loots;

    this.loots = lootSpots.map((spot, idx) => {
      const t = LOOT_TYPES[Math.floor(idx / 2) % LOOT_TYPES.length];
      return {
        id: idx,
        typeId: t.id,
        name: t.name,
        basePts: t.basePts,
        color: t.color,
        accent: t.accent,
        floor: spot.floor,
        x: spot.x,
        y: this.floorYs[spot.floor] - 18,
        collected: false,
        goroHiding: false
      };
    });

    this.spawnEntities(level);
  }

  spawnEntities(level) {
    this.player = {
      x: 480,
      y: this.floorYs[5],
      vx: 0,
      vy: 0,
      floor: 5,
      mode: 'FLOOR', // 'FLOOR' | 'TRAMPOLINE' | 'FALLING_DEAD'
      shaftIndex: -1,
      facing: 1,
      speed: 175,
      targetPeakFloor: 0,
      stunTimer: 0,
      animFrame: 0
    };

    // Spawn Boss Goro + Meowkies
    this.cats = [];
    // Boss Goro (Nyamco)
    this.cats.push({
      id: 0,
      isGoro: true,
      x: 480,
      y: this.floorYs[0],
      floor: 0,
      mode: 'FLOOR',
      shaftIndex: -1,
      vy: 140,
      dir: 1,
      speed: 112 + level * 6,
      stunTimer: 0,
      hideTimer: 0,
      hidingLoot: null,
      swept: false
    });

    const meowkyCount = Math.min(6, 3 + Math.floor((level + 1) / 2));
    for (let i = 0; i < meowkyCount; i++) {
      const fl = i % 5;
      const sx = i % 2 === 0 ? 190 + i * 30 : 750 - i * 35;
      this.cats.push({
        id: i + 1,
        isGoro: false,
        x: sx,
        y: this.floorYs[fl],
        floor: fl,
        mode: 'FLOOR',
        shaftIndex: -1,
        vy: 150,
        dir: i % 2 === 0 ? 1 : -1,
        speed: 122 + level * 7 + (i % 2) * 8,
        stunTimer: 0,
        swept: false
      });
    }
  }

  getShaftAtX(x, tolerance = 18) {
    for (let i = 0; i < this.shafts.length; i++) {
      if (Math.abs(x - this.shafts[i].x) <= tolerance) {
        return i;
      }
    }
    return -1;
  }

  isOverShaftGap(x) {
    for (let i = 0; i < this.shafts.length; i++) {
      const half = this.shafts[i].w * 0.5 - 4;
      if (Math.abs(x - this.shafts[i].x) < half) {
        return i;
      }
    }
    return -1;
  }

  canLandOnFloorSide(shaftIdx, floorIdx, sideDir) {
    const sx = this.shafts[shaftIdx].x;
    const testX = sx + sideDir * (this.shafts[shaftIdx].w * 0.5 + 14);
    if (testX < 42 || testX > 918) return false;
    // Check closed door blocking entry right at shaft edge
    for (const d of this.doors) {
      if (d.floor === floorIdx && !d.isOpen && Math.abs(d.x - testX) < 16) {
        return false;
      }
    }
    return true;
  }

  triggerDoorAction() {
    const p = this.player;
    if (p.mode !== 'FLOOR') return;

    let bestDoor = null;
    let bestDist = 48;
    for (const d of this.doors) {
      if (d.floor === p.floor) {
        const dist = Math.abs(d.x - p.x);
        if (dist < bestDist) {
          bestDist = dist;
          bestDoor = d;
        }
      }
    }

    if (!bestDoor) return;

    if (bestDoor.isMicrowave && bestDoor.charges > 0 && !bestDoor.isOpen) {
      // Fire Microwave Sonic Wave!
      bestDoor.isOpen = true;
      bestDoor.charges = 0;
      bestDoor.rechargeTimer = 11.0;
      const dir = p.x <= bestDoor.x ? 1 : -1;
      this.sonicWaves.push({
        x: bestDoor.x + dir * 12,
        y: bestDoor.y - 18,
        floor: bestDoor.floor,
        dir,
        speed: 380,
        width: 44,
        caughtCats: []
      });
      this.audio.playPowerUp();
      this.renderer.shake(5, 0.18);
    } else {
      bestDoor.isOpen = !bestDoor.isOpen;
      this.audio.playHop();
      // Slamming a door stuns nearby cats
      for (const c of this.cats) {
        if (c.mode === 'FLOOR' && c.floor === bestDoor.floor && Math.abs(c.x - bestDoor.x) < 42) {
          c.stunTimer = 2.4;
          c.dir = c.x < bestDoor.x ? -1 : 1;
          this.addScore(50, c.x, c.y - 20, PALETTE.CYAN, 'SLAM');
        }
      }
    }
  }

  killPlayer(reason = 'CAUGHT!') {
    if (this.deathTimer > 0 || this.stageClearTimer > 0) return;
    this.lives--;
    this.audio.playHit();
    this.renderer.shake(9, 0.3);
    this.popups.push({
      text: reason,
      x: this.player.x,
      y: this.player.y - 24,
      vy: -30,
      life: 1.1,
      maxLife: 1.1,
      color: PALETTE.RED
    });

    for (let i = 0; i < 24; i++) {
      const a = (Math.PI * 2 * i) / 24;
      const spd = 60 + Math.random() * 140;
      this.particles.push({
        x: this.player.x,
        y: this.player.y - 12,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        gravity: 260,
        size: 3.5,
        life: 0.55,
        maxLife: 0.55,
        color: i % 2 === 0 ? PALETTE.BLUE : PALETTE.WHITE
      });
    }

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.audio.playGameOver();
      this.state = 'GAMEOVER';
    } else {
      this.deathTimer = 1.25;
    }
  }

  update(dt) {
    this.animTime += dt;

    if (this.input.isJustPressed('pause')) {
      this.state = this.state === 'PLAYING' ? 'PAUSED' : 'PLAYING';
      return;
    }

    if (this.state === 'MENU' || this.state === 'GAMEOVER') {
      if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
        this.audio.playMenuSelect();
        this.reset();
      }
      return;
    }

    if (this.state === 'PAUSED') {
      if (this.input.isJustPressed('actionA')) this.state = 'PLAYING';
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
        // Restore unbroken trampolines and respawn positions
        this.trampolines.forEach((t) => {
          t.bounces = 0;
          t.broken = false;
        });
        this.spawnEntities(this.level);
      }
      return;
    }

    // Hurry timer
    this.hurryTimer -= dt;
    if (this.hurryTimer <= 0 && !this.hurryTriggered) {
      this.hurryTriggered = true;
      this.popups.push({
        text: 'HURRY UP!!',
        x: 480,
        y: 90,
        vy: -15,
        life: 1.5,
        maxLife: 1.5,
        color: PALETTE.RED
      });
      this.cats.forEach((c) => {
        c.speed *= 1.28;
      });
    }

    // Recharge microwave doors over time
    for (const d of this.doors) {
      if (d.isMicrowave && d.charges === 0 && d.rechargeTimer > 0) {
        d.rechargeTimer -= dt;
        if (d.rechargeTimer <= 0) {
          d.charges = 1;
          d.isOpen = false;
        }
      }
    }

    this.updatePlayer(dt);
    this.updateSonicWaves(dt);
    this.updateCats(dt);
    this.checkLootCollection();
  }

  updateEffects(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += (pt.gravity || 0) * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y += pop.vy * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
    for (const t of this.trampolines) {
      if (t.deflect > 0) {
        t.deflect = Math.max(0, t.deflect - dt * 45);
      }
    }
  }

  updatePlayer(dt) {
    const p = this.player;

    if (
      this.input.isJustPressed('actionA') ||
      this.input.isJustPressed('actionB') ||
      this.input.pointer.justPressed
    ) {
      this.triggerDoorAction();
    }

    if (p.mode === 'FLOOR') {
      let moveX = 0;
      if (this.input.isDown('left')) {
        moveX = -1;
        p.facing = -1;
      } else if (this.input.isDown('right')) {
        moveX = 1;
        p.facing = 1;
      }

      if (moveX !== 0) {
        const nextX = Math.max(44, Math.min(916, p.x + moveX * p.speed * dt));
        // Check closed doors blocking floor movement
        let blocked = false;
        for (const d of this.doors) {
          if (d.floor === p.floor && !d.isOpen) {
            if ((p.x < d.x && nextX >= d.x - 10) || (p.x > d.x && nextX <= d.x + 10)) {
              blocked = true;
              break;
            }
          }
        }
        if (!blocked) {
          p.x = nextX;
          p.animFrame += dt * 14;
        }
      }

      // Check if Mappy stepped into a vertical trampoline shaft gap
      const shaftIdx = this.isOverShaftGap(p.x);
      if (shaftIdx !== -1) {
        p.mode = 'TRAMPOLINE';
        p.shaftIndex = shaftIdx;
        p.x = this.shafts[shaftIdx].x;
        p.vy = 95;
        p.targetPeakFloor = Math.max(0, p.floor - 1);
      }
    } else if (p.mode === 'TRAMPOLINE') {
      const shaft = this.shafts[p.shaftIndex];
      const tramp = this.trampolines[p.shaftIndex];
      p.x = shaft.x;

      // Gravity and vertical velocity inside trampoline shaft
      const prevY = p.y;
      p.vy += 690 * dt;
      p.y += p.vy * dt;

      // Allow steering onto a floor when near a floor height!
      const wantLeft = this.input.isDown('left');
      const wantRight = this.input.isDown('right');
      if (wantLeft || wantRight) {
        const sideDir = wantLeft ? -1 : 1;
        for (let f = 0; f < this.floorYs.length; f++) {
          const fy = this.floorYs[f];
          // Can step onto floor f if within vertical landing window
          if (Math.abs(p.y - fy) <= 18 && this.canLandOnFloorSide(p.shaftIndex, f, sideDir)) {
            p.mode = 'FLOOR';
            p.floor = f;
            p.y = fy;
            p.vy = 0;
            p.facing = sideDir;
            p.x = shaft.x + sideDir * (shaft.w * 0.5 + 14);
            // Stepping onto a floor resets that shaft's trampoline back to Green (0)!
            if (!tramp.broken) {
              tramp.bounces = 0;
            }
            this.audio.playHop();
            return;
          }
        }
      }

      // Check roof ceiling bounce
      if (p.y < 88 && p.vy < 0) {
        p.y = 88;
        p.vy = Math.abs(p.vy) * 0.55;
      }

      // Check bottom trampoline collision
      if (prevY <= tramp.y && p.y >= tramp.y && p.vy > 0) {
        if (tramp.broken) {
          this.killPlayer('TRAMPOLINE SNAPPED!');
          return;
        }

        tramp.bounces++;
        tramp.deflect = 10;

        if (tramp.bounces >= 4) {
          // 4th consecutive bounce without touching a floor snaps the trampoline!
          tramp.broken = true;
          this.audio.playExplosion(0.35, 700);
          this.killPlayer('4TH BOUNCE SNAP!');
          return;
        }

        // Elastic bounce upward! Holding UP bounces to top floor; otherwise bounces high enough to reach any floor
        p.y = tramp.y;
        const boost = this.input.isDown('up') ? -545 : this.input.isDown('down') ? -385 : -495;
        p.vy = boost;
        this.audio.playNote(280 + tramp.bounces * 110, 0.11, 'triangle', 0.28);
      }
    }
  }

  updateSonicWaves(dt) {
    for (let i = this.sonicWaves.length - 1; i >= 0; i--) {
      const w = this.sonicWaves[i];
      w.x += w.dir * w.speed * dt;

      // Sweep any cat on the same floor
      for (const c of this.cats) {
        if (!c.swept && c.floor === w.floor && Math.abs(c.x - w.x) < 30 && Math.abs(c.y - (w.y + 18)) < 36) {
          c.swept = true;
          c.hidingLoot = null;
          w.caughtCats.push(c);
          this.audio.playCoin();
        }
      }

      // Move caught cats with the sonic wave
      for (const c of w.caughtCats) {
        c.x = w.x;
        c.y = this.floorYs[w.floor];
      }

      // When wave exits screen edge, award combo points and respawn swept cats after stun
      if (w.x < 20 || w.x > 940) {
        if (w.caughtCats.length > 0) {
          let totalPts = 0;
          w.caughtCats.forEach((c, idx) => {
            totalPts += c.isGoro ? 1000 : 400 * (idx + 1);
            c.swept = false;
            c.mode = 'FLOOR';
            c.floor = 0;
            c.x = 480;
            c.y = this.floorYs[0];
            c.stunTimer = 3.2;
          });
          this.addScore(
            totalPts,
            Math.max(80, Math.min(880, w.x)),
            this.floorYs[w.floor] - 24,
            PALETTE.PINK,
            `SONIC x${w.caughtCats.length}`
          );
        }
        this.sonicWaves.splice(i, 1);
      }
    }
  }

  updateCats(dt) {
    const p = this.player;

    for (const c of this.cats) {
      if (c.swept) continue;

      if (c.stunTimer > 0) {
        c.stunTimer -= dt;
        continue;
      }

      // Boss Goro hiding behind loot logic
      if (c.isGoro && c.hideTimer > 0) {
        c.hideTimer -= dt;
        if (c.hideTimer <= 0 || !c.hidingLoot || c.hidingLoot.collected) {
          if (c.hidingLoot) c.hidingLoot.goroHiding = false;
          c.hidingLoot = null;
          c.hideTimer = 0;
        }
        continue;
      }

      if (c.mode === 'FLOOR') {
        const nextX = c.x + c.dir * c.speed * dt;

        // Check closed doors
        let hitDoor = false;
        for (const d of this.doors) {
          if (d.floor === c.floor && !d.isOpen) {
            if ((c.x < d.x && nextX >= d.x - 10) || (c.x > d.x && nextX <= d.x + 10)) {
              hitDoor = true;
              break;
            }
          }
        }

        if (hitDoor || nextX < 46 || nextX > 914) {
          c.dir *= -1;
        } else {
          c.x = nextX;
        }

        // Boss Goro can hide behind an uncollected loot item on his floor
        if (c.isGoro && Math.random() < 0.008) {
          for (const l of this.loots) {
            if (!l.collected && l.floor === c.floor && Math.abs(l.x - c.x) < 18) {
              c.hidingLoot = l;
              l.goroHiding = true;
              c.hideTimer = 3.5;
              break;
            }
          }
        }

        // Decide at shaft whether to jump into shaft or step across toward player's floor
        const shaftIdx = this.isOverShaftGap(c.x);
        if (shaftIdx !== -1) {
          if (p.floor !== c.floor || Math.random() < 0.35) {
            c.mode = 'TRAMPOLINE';
            c.shaftIndex = shaftIdx;
            c.x = this.shafts[shaftIdx].x;
            c.vy = p.floor > c.floor ? 160 : -320;
          } else {
            // Hop across shaft onto next floor segment
            c.x = this.shafts[shaftIdx].x + c.dir * (this.shafts[shaftIdx].w * 0.5 + 10);
          }
        }
      } else if (c.mode === 'TRAMPOLINE') {
        const shaft = this.shafts[c.shaftIndex];
        c.x = shaft.x;
        c.vy += 580 * dt;
        c.y += c.vy * dt;

        if (c.y < 90 && c.vy < 0) {
          c.y = 90;
          c.vy = Math.abs(c.vy) * 0.6;
        }

        if (c.y >= this.trampolineY && c.vy > 0) {
          c.y = this.trampolineY;
          c.vy = -465;
        }

        // Exit shaft onto target floor
        const targetFl = p.floor;
        const fy = this.floorYs[targetFl];
        if (Math.abs(c.y - fy) < 14) {
          const exitDir = p.x >= c.x ? 1 : -1;
          if (this.canLandOnFloorSide(c.shaftIndex, targetFl, exitDir)) {
            c.mode = 'FLOOR';
            c.floor = targetFl;
            c.y = fy;
            c.dir = exitDir;
            c.x = shaft.x + exitDir * (shaft.w * 0.5 + 12);
          }
        }
      }

      // Collision check with Mappy:
      // Mappy is SAFE against cats while bouncing mid-air on trampolines!
      if (p.mode === 'FLOOR' && c.mode === 'FLOOR' && p.floor === c.floor) {
        if (Math.abs(p.x - c.x) < 22) {
          this.killPlayer(c.isGoro ? 'CAUGHT BY GORO!' : 'MEOWKY CAUGHT YOU!');
          return;
        }
      }
    }
  }

  checkLootCollection() {
    const p = this.player;
    for (const l of this.loots) {
      if (l.collected) continue;
      if (Math.abs(p.x - l.x) < 24 && Math.abs((p.y - 16) - l.y) < 24) {
        l.collected = true;
        this.audio.playCoin();

        // Check consecutive pair multiplier!
        if (this.lastCollectedType === l.typeId) {
          this.pairMultiplier = Math.min(6, this.pairMultiplier + 1);
          const pts = l.basePts * this.pairMultiplier;
          this.addScore(pts, l.x, l.y, PALETTE.GOLD, `PAIR x${this.pairMultiplier}`);
          this.lastCollectedType = null;
        } else {
          this.lastCollectedType = l.typeId;
          this.addScore(l.basePts, l.x, l.y, PALETTE.CYAN);
        }

        // Check if Boss Goro was hiding behind this loot item (+1000 bonus!)
        if (l.goroHiding) {
          l.goroHiding = false;
          this.addScore(1000, l.x, l.y - 18, PALETTE.PINK, 'GORO BONUS');
          for (const c of this.cats) {
            if (c.isGoro) {
              c.hidingLoot = null;
              c.hideTimer = 0;
              c.stunTimer = 2.5;
            }
          }
        }
      }
    }

    // Check if all 10 stolen loot items are recovered
    if (this.loots.every((l) => l.collected) && this.stageClearTimer <= 0) {
      const timeBonus = Math.max(0, Math.floor(this.hurryTimer) * 50);
      this.addScore(1000 + timeBonus, 480, 250, PALETTE.GREEN, 'MANSION CLEARED');
      this.audio.playStageClear();
      this.stageClearTimer = 1.6;
    }
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear('#090D18');

    this.drawMansion(ctx);
    this.drawTrampolines(ctx);
    this.drawLoots(ctx);
    this.drawDoors(ctx);
    this.drawSonicWaves(ctx);
    this.drawCats(ctx);
    this.drawPlayer(ctx);
    this.drawEffects(ctx);

    const remainingLoot = this.loots.filter((l) => !l.collected).length;
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `LOOT:${remainingLoot}  PAIR:x${this.pairMultiplier}`,
      accent: PALETTE.CYAN
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1983 NAMCO TRAMPOLINE MANSION EDITION',
      controls: 'LEFT/RIGHT: FLOOR & EXIT SHAFT  |  Z/X/SPACE: OPEN & SONIC DOOR',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.CYAN
    });
  }

  drawMansion(ctx) {
    ctx.save();
    const theme = this.mansionTheme || {
      name: 'RED ROOF MANOR',
      roof: '#B91C1C',
      roofTrim: '#FCA5A5',
      wall: '#151E32',
      floorBar: '#F59E0B'
    };

    // Mansion Wallpaper interior
    ctx.fillStyle = theme.wall;
    ctx.fillRect(36, 76, 888, 448);

    // Classic Victorian/Namco Tiled Roof
    ctx.fillStyle = theme.roof;
    ctx.beginPath();
    ctx.moveTo(20, 78);
    ctx.lineTo(110, 42);
    ctx.lineTo(850, 42);
    ctx.lineTo(940, 78);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = theme.roofTrim;
    ctx.lineWidth = 2;
    ctx.stroke();

    this.renderer.drawText(theme.name, 480, 64, {
      font: FONTS.HEADER,
      size: 9,
      color: theme.roofTrim,
      align: 'center'
    });

    // Vertical trampoline shaft columns (dark backing)
    for (const s of this.shafts) {
      ctx.fillStyle = '#0B0F19';
      ctx.fillRect(s.x - s.w * 0.5, 78, s.w, 444);
    }

    // Draw 6 Mansion Floors across non-shaft segments
    for (let f = 0; f < this.floorYs.length; f++) {
      const y = this.floorYs[f];
      for (const seg of this.floorSegments) {
        ctx.fillStyle = theme.floorBar;
        ctx.fillRect(seg.x1, y, seg.x2 - seg.x1, 7);
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(seg.x1, y, seg.x2 - seg.x1, 2);
      }
    }

    // Outer mansion walls
    ctx.fillStyle = '#334155';
    ctx.fillRect(28, 76, 10, 452);
    ctx.fillRect(922, 76, 10, 452);
    ctx.restore();
  }

  drawTrampolines(ctx) {
    ctx.save();
    for (const t of this.trampolines) {
      if (t.broken) {
        // Snapped trampoline strands
        ctx.strokeStyle = PALETTE.RED;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(t.x - t.w * 0.5, t.y);
        ctx.lineTo(t.x - 8, t.y + 12);
        ctx.moveTo(t.x + t.w * 0.5, t.y);
        ctx.lineTo(t.x + 8, t.y + 12);
        ctx.stroke();
        continue;
      }

      const color = TRAMPOLINE_COLORS[Math.min(3, t.bounces)];
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(t.x - t.w * 0.5, t.y);
      ctx.quadraticCurveTo(t.x, t.y + t.deflect, t.x + t.w * 0.5, t.y);
      ctx.stroke();

      // Side springs
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(t.x - t.w * 0.5 - 3, t.y - 3, 5, 6);
      ctx.fillRect(t.x + t.w * 0.5 - 2, t.y - 3, 5, 6);
    }
    ctx.restore();
  }

  drawLoots(ctx) {
    ctx.save();
    for (const l of this.loots) {
      if (l.collected) continue;
      const bob = Math.sin(this.animTime * 5 + l.id) * 1.5;
      const lx = l.x - 12;
      const ly = l.y - 10 + bob;

      // If Boss Goro is hiding behind this loot, draw peeking ears!
      if (l.goroHiding) {
        ctx.fillStyle = PALETTE.RED;
        ctx.fillRect(lx - 4, ly - 6, 8, 8);
        ctx.fillRect(lx + 20, ly - 6, 8, 8);
      }

      ctx.fillStyle = l.color;
      ctx.shadowColor = l.color;
      ctx.shadowBlur = 8;
      ctx.fillRect(lx, ly, 24, 18);
      ctx.fillStyle = l.accent;
      ctx.fillRect(lx + 4, ly + 4, 16, 10);

      // Highlight if matches lastCollectedType for x2..x6 multiplier
      if (this.lastCollectedType === l.typeId) {
        ctx.strokeStyle = PALETTE.GOLD;
        ctx.lineWidth = 2;
        ctx.strokeRect(lx - 3, ly - 3, 30, 24);
      }
    }
    ctx.restore();
  }

  drawDoors(ctx) {
    ctx.save();
    const pulse = 0.6 + 0.4 * Math.sin(this.animTime * 10);
    for (const d of this.doors) {
      const topY = d.y - 46;
      if (d.isOpen) {
        // Open door leaf folded flat
        ctx.fillStyle = '#64748B';
        ctx.fillRect(d.x - 12, d.y - 6, 24, 6);
      } else if (d.isMicrowave && d.charges > 0) {
        // Flashing rainbow Microwave Sonic Door
        const color = pulse > 0.8 ? PALETTE.PINK : PALETTE.CYAN;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.fillRect(d.x - 5, topY, 10, 46);
        // Sonic wave emitter knob
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(d.x + d.facing * 5 - 2, topY + 20, 4, 8);
      } else {
        // Standard closed door
        ctx.fillStyle = '#F59E0B';
        ctx.shadowBlur = 0;
        ctx.fillRect(d.x - 4, topY, 8, 46);
        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(d.x + d.facing * 4 - 2, topY + 22, 4, 5);
      }
    }
    ctx.restore();
  }

  drawSonicWaves(ctx) {
    ctx.save();
    const colors = [PALETTE.PINK, PALETTE.CYAN, PALETTE.GOLD, PALETTE.GREEN];
    for (const w of this.sonicWaves) {
      for (let r = 0; r < 4; r++) {
        const rx = w.x - r * w.dir * 9;
        ctx.strokeStyle = colors[(r + Math.floor(this.animTime * 20)) % colors.length];
        ctx.lineWidth = 3;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(rx, w.y, 18, -Math.PI * 0.42, Math.PI * 0.42, w.dir < 0);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawCats(ctx) {
    for (const c of this.cats) {
      if (c.hideTimer > 0) continue;
      const sx = c.x - 10;
      const sy = c.y - 22;
      if (c.stunTimer > 0 && Math.floor(this.animTime * 16) % 2 === 0) continue;

      if (c.isGoro) {
        this.renderer.drawPixelSprite(
          GORO_SPRITE,
          sx,
          sy - 4,
          2.4,
          {
            R: '#EF4444',
            Y: '#FFD700',
            W: '#F8FAFC',
            K: '#0B0F19'
          },
          c.dir < 0
        );
      } else {
        this.renderer.drawPixelSprite(
          MEOWKY_SPRITE,
          sx,
          sy,
          2.1,
          {
            P: '#FF007A',
            W: '#F8FAFC',
            K: '#0B0F19'
          },
          c.dir < 0
        );
      }
    }
  }

  drawPlayer(ctx) {
    if (this.deathTimer > 0) return;
    const p = this.player;
    const sx = p.x - 11;
    const sy = p.y - 22;

    // Halo when mid-air on trampoline to show cat-pass immunity
    if (p.mode === 'TRAMPOLINE') {
      this.renderer.drawGlowCircle(p.x, p.y - 11, 16, 'rgba(0, 240, 255, 0.35)', 10, false, 1.5);
    }

    this.renderer.drawPixelSprite(
      MAPPY_SPRITE,
      sx,
      sy,
      2.2,
      {
        B: '#38BDF8',
        W: '#F8FAFC',
        P: '#FB7185',
        Y: '#FFD700',
        K: '#0B0F19'
      },
      p.facing < 0
    );
  }

  drawEffects(ctx) {
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size * 0.5, pt.y - pt.size * 0.5, pt.size, pt.size);
    }
    for (const pop of this.popups) {
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HEADER,
        size: 10,
        color: pop.color,
        align: 'center',
        glow: 6
      });
    }
  }
}

export default Mappy;
