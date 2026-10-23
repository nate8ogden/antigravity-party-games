/**
 * ElevatorAction.js
 * Classic 1983 Taito Espionage Platformer (Elevator Action / Tower Agent) for Retro Arcade Studio.
 *
 * Features:
 * - 10-story scrolling cross-section spy skyscraper with elevators, escalators, and basement garage
 * - Player-controllable elevators (step inside and press UP/DOWN to drive the car, or ride the roof!)
 * - Red Secret Document doors (+500 pts each), Blue enemy doors, and shootable overhead ceiling lamps
 *   that plunge floors into tactical darkness and fall on enemy agents below
 * - Spy crouch-dodging, pistol duels, flying jump-kicks, elevator crushes, and getaway spy car!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const SPRITES = {
  AGENT_STAND: [
    '...BBBBBB...',
    '..BBBBBBBB..',
    '...FFFFFF...',
    '..CCCCCCCC..',
    '.CCCCCCCCCC.',
    '.CC.CCCC.CC.',
    '....CCCC....',
    '...CCCCCC...',
    '...CC..CC...',
    '..KK....KK..'
  ],
  AGENT_CROUCH: [
    '............',
    '............',
    '...BBBBBB...',
    '..BBBBBBBB..',
    '...FFFFFF...',
    '..CCCCCCCC..',
    '.CCCCCCCCCC.',
    '..CCCCCCCC..',
    '...CC..CC...',
    '..KK....KK..'
  ],
  ENEMY_STAND: [
    '...KKKKKK...',
    '..KKKKKKKK..',
    '...FFFFFF...',
    '..SSSSSSSS..',
    '.SSSSSSSSSS.',
    '.SS.SSSS.SS.',
    '....SSSS....',
    '...SSSSSS...',
    '...SS..SS...',
    '..KK....KK..'
  ]
};

const AGENT_PALETTE = {
  B: '#1E3A8A',
  F: '#FDBA74',
  C: '#38BDF8',
  K: '#0F172A'
};

const ENEMY_PALETTE = {
  K: '#1E293B',
  F: '#FDBA74',
  S: '#EF4444'
};

export class ElevatorAction {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'elevatoraction';
    this.title = 'Elevator Action';
    this.state = 'PLAYING';

    this.width = 960;
    this.height = 540;
    this.highScore = HighScoreStore.get(this.id);

    this.numFloors = 10; // Floor 0 = top roof/floor 10, Floor 9 = basement garage
    this.floorHeight = 96;
    this.buildingLeft = 120;
    this.buildingRight = 840;
    this.worldHeight = this.numFloors * this.floorHeight + 80;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this._setupBuilding(this.level);
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    if (this.audio) {
      this.audio.stopSequence();
    }
  }

  _floorY(floorIdx) {
    // Returns the floor surface Y in world coordinates for floorIdx (0 = top floor 10, 9 = basement floor 1)
    return 110 + (floorIdx + 1) * this.floorHeight;
  }

  _setupBuilding(level) {
    // 6 distinct OG Taito Spy Building Architectures (growing from 10 to 15 stories)
    const BUILDING_CONFIGS = [
      {
        name: 'BUILDING 1: TAITO HQ TOWER (10F)',
        numFloors: 10,
        wall: '#1E293B',
        corridor: '#263449',
        slab: '#64748B',
        redMod: 3,
        shafts: [
          { x: 350, w: 68, minFloor: 0, maxFloor: 5, startFloor: 0, vy: 90, dir: 1 },
          { x: 580, w: 68, minFloor: 2, maxFloor: 8, startFloor: 3, vy: 95, dir: 1 },
          { x: 465, w: 68, minFloor: 5, maxFloor: 9, startFloor: 6, vy: 100, dir: -1 }
        ]
      },
      {
        name: 'BUILDING 2: EMBASSY ANNEX (11F)',
        numFloors: 11,
        wall: '#172554',
        corridor: '#1E3A8A',
        slab: '#60A5FA',
        redMod: 2,
        shafts: [
          { x: 310, w: 68, minFloor: 0, maxFloor: 6, startFloor: 1, vy: 100, dir: 1 },
          { x: 480, w: 68, minFloor: 1, maxFloor: 8, startFloor: 4, vy: 105, dir: -1 },
          { x: 650, w: 68, minFloor: 4, maxFloor: 10, startFloor: 7, vy: 110, dir: 1 }
        ]
      },
      {
        name: 'BUILDING 3: CRIMSON SYNDICATE (12F)',
        numFloors: 12,
        wall: '#31102F',
        corridor: '#4A1D46',
        slab: '#F472B6',
        redMod: 3,
        shafts: [
          { x: 360, w: 68, minFloor: 0, maxFloor: 5, startFloor: 0, vy: 105, dir: 1 },
          { x: 510, w: 68, minFloor: 2, maxFloor: 8, startFloor: 3, vy: 110, dir: 1 },
          { x: 640, w: 68, minFloor: 5, maxFloor: 11, startFloor: 8, vy: 115, dir: -1 },
          { x: 340, w: 68, minFloor: 6, maxFloor: 11, startFloor: 9, vy: 108, dir: 1 }
        ]
      },
      {
        name: 'BUILDING 4: EMERALD MINISTRIES (13F)',
        numFloors: 13,
        wall: '#064E3B',
        corridor: '#065F46',
        slab: '#34D399',
        redMod: 2,
        shafts: [
          { x: 325, w: 68, minFloor: 0, maxFloor: 6, startFloor: 1, vy: 110, dir: 1 },
          { x: 595, w: 68, minFloor: 1, maxFloor: 7, startFloor: 3, vy: 112, dir: -1 },
          { x: 460, w: 68, minFloor: 4, maxFloor: 10, startFloor: 6, vy: 116, dir: 1 },
          { x: 630, w: 68, minFloor: 7, maxFloor: 12, startFloor: 10, vy: 118, dir: -1 }
        ]
      },
      {
        name: 'BUILDING 5: AMBER INTELLIGENCE HUB (14F)',
        numFloors: 14,
        wall: '#271710',
        corridor: '#451A03',
        slab: '#F59E0B',
        redMod: 3,
        shafts: [
          { x: 350, w: 68, minFloor: 0, maxFloor: 5, startFloor: 0, vy: 114, dir: 1 },
          { x: 520, w: 68, minFloor: 2, maxFloor: 8, startFloor: 4, vy: 118, dir: -1 },
          { x: 380, w: 68, minFloor: 5, maxFloor: 11, startFloor: 7, vy: 120, dir: 1 },
          { x: 620, w: 68, minFloor: 8, maxFloor: 13, startFloor: 11, vy: 122, dir: -1 }
        ]
      },
      {
        name: 'BUILDING 6: OMEGA CITADEL SKYSCRAPER (15F)',
        numFloors: 15,
        wall: '#1E1B4B',
        corridor: '#312E81',
        slab: '#818CF8',
        redMod: 2,
        shafts: [
          { x: 330, w: 68, minFloor: 0, maxFloor: 6, startFloor: 0, vy: 118, dir: 1 },
          { x: 500, w: 68, minFloor: 2, maxFloor: 8, startFloor: 4, vy: 122, dir: 1 },
          { x: 645, w: 68, minFloor: 5, maxFloor: 11, startFloor: 7, vy: 124, dir: -1 },
          { x: 420, w: 68, minFloor: 8, maxFloor: 14, startFloor: 10, vy: 126, dir: 1 },
          { x: 585, w: 68, minFloor: 10, maxFloor: 14, startFloor: 13, vy: 128, dir: -1 }
        ]
      }
    ];

    const cfg = BUILDING_CONFIGS[(level - 1) % BUILDING_CONFIGS.length];
    this.buildingTheme = cfg;
    this.numFloors = cfg.numFloors;
    this.worldHeight = this.numFloors * this.floorHeight + 80;

    this.shafts = cfg.shafts.map((s) => ({
      x: s.x,
      w: s.w,
      minFloor: s.minFloor,
      maxFloor: s.maxFloor,
      carY: this._floorY(s.startFloor),
      vy: s.vy,
      dir: s.dir
    }));

    // Build doors & ceiling lamps per floor
    this.doors = [];
    this.lamps = [];
    this.floorDarkTimer = new Array(this.numFloors).fill(0);
    this.stairs = [];

    const doorPositions = [185, 265, 735, 795];
    let redDoorsCount = 0;

    for (let f = 0; f < this.numFloors - 1; f++) {
      const fy = this._floorY(f);

      // Add stairs on alternating sides so every floor is also reachable by foot
      const stairX = f % 2 === 0 ? 155 : 805;
      this.stairs.push({
        fromFloor: f,
        toFloor: f + 1,
        x1: stairX,
        y1: fy,
        x2: stairX + (f % 2 === 0 ? 36 : -36),
        y2: this._floorY(f + 1)
      });

      // Add 2 overhead lamps per floor
      this.lamps.push(
        { floor: f, x: 255, y: fy - this.floorHeight + 16, intact: true, falling: false, vy: 0 },
        { floor: f, x: 715, y: fy - this.floorHeight + 16, intact: true, falling: false, vy: 0 }
      );

      for (const dx of doorPositions) {
        // Ensure door doesn't overlap a shaft
        if (this.shafts.some((s) => Math.abs(dx - s.x) < 55)) continue;
        const isRed =
          (f >= 1 && f <= this.numFloors - 2 && ((f + Math.round(dx) + level) % cfg.redMod === 0) && redDoorsCount < 6 + Math.floor(level / 2)) ||
          (f === this.numFloors - 2 && redDoorsCount < 4);
        if (isRed) redDoorsCount += 1;

        this.doors.push({
          floor: f,
          x: dx,
          y: fy,
          type: isRed ? 'red' : 'blue',
          collected: false,
          openTimer: 0
        });
      }
    }

    this.player = {
      x: 220,
      y: this._floorY(0),
      vx: 0,
      vy: 0,
      dir: 1,
      crouching: false,
      jumping: false,
      inRoomTimer: 0,
      invuln: 1.5,
      fireCooldown: 0,
      ridingShaft: null
    };

    this.cameraY = 0;
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.floatingTexts = [];
    this.spawnTimer = 1.2;

    // Spawn initial patrol spies on upper floors
    for (let f = 0; f < 4; f++) {
      this._spawnEnemyOnFloor(f);
    }

    this.bannerText = `${cfg.name} — COLLECT RED FILES & REACH BASEMENT!`;
    this.bannerTimer = 2.4;
  }

  _spawnEnemyOnFloor(floorIdx) {
    if (floorIdx < 0 || floorIdx >= this.numFloors) return;
    const blueDoors = this.doors.filter((d) => d.floor === floorIdx && d.type === 'blue');
    const spawnX =
      blueDoors.length > 0
        ? blueDoors[Math.floor(Math.random() * blueDoors.length)].x
        : 260;

    if (Math.abs(spawnX - this.player.x) < 70 && Math.abs(this._floorY(floorIdx) - this.player.y) < 40) {
      return;
    }

    this.enemies.push({
      x: spawnX,
      y: this._floorY(floorIdx),
      floor: floorIdx,
      dir: spawnX < this.player.x ? 1 : -1,
      speed: 75 + Math.min(45, this.level * 6),
      crouching: false,
      crouchTimer: 0,
      fireTimer: 0.9 + Math.random() * 1.2,
      aiTimer: 1.2
    });
  }

  _isShaftAtX(x) {
    for (const s of this.shafts) {
      if (Math.abs(x - s.x) < s.w / 2 - 4) {
        return s;
      }
    }
    return null;
  }

  _remainingRedDoors() {
    return this.doors.filter((d) => d.type === 'red' && !d.collected).length;
  }

  update(dt) {
    const clampedDt = Math.min(dt, 0.05);

    if (this.state === 'MENU' || this.state === 'GAMEOVER') {
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

    if (this.input.isJustPressed('pause')) {
      this.audio.playMenuMove();
      this.state = 'PAUSED';
      return;
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer = Math.max(0, this.bannerTimer - clampedDt);
    }

    for (let f = 0; f < this.numFloors; f++) {
      if (this.floorDarkTimer[f] > 0) {
        this.floorDarkTimer[f] = Math.max(0, this.floorDarkTimer[f] - clampedDt);
      }
    }

    for (const d of this.doors) {
      if (d.openTimer > 0) d.openTimer = Math.max(0, d.openTimer - clampedDt);
    }

    this._updateElevators(clampedDt);
    this._updatePlayer(clampedDt);
    this._updateLamps(clampedDt);
    this._updateEnemies(clampedDt);
    this._updateBullets(clampedDt);
    this._updateParticles(clampedDt);

    // Smooth camera tracking Agent 17 vertically
    const targetCamY = Math.max(
      0,
      Math.min(this.worldHeight - (this.height - 40), this.player.y - 260)
    );
    this.cameraY += (targetCamY - this.cameraY) * Math.min(1, clampedDt * 7);
  }

  _updateElevators(dt) {
    const p = this.player;
    p.ridingShaft = null;

    for (const s of this.shafts) {
      const minY = this._floorY(s.minFloor);
      const maxY = this._floorY(s.maxFloor);
      const roofY = s.carY - this.floorHeight + 8;

      // Check if player is inside the elevator car or standing on its roof
      const inX = Math.abs(p.x - s.x) < s.w / 2 - 4;
      const onFloor = !p.jumping && Math.abs(p.y - s.carY) < 14;
      const onRoof = !p.jumping && Math.abs(p.y - roofY) < 14;

      let moveDir = s.dir;
      let speed = s.vy;

      if (inX && (onFloor || onRoof)) {
        p.ridingShaft = s;
        if (onFloor) {
          // Player controls the elevator when riding inside!
          if (this.input.isDown('up')) {
            moveDir = -1;
            speed = 135;
          } else if (this.input.isDown('down')) {
            moveDir = 1;
            speed = 135;
          } else {
            moveDir = 0;
          }
        }
      }

      const prevCarY = s.carY;
      s.carY += moveDir * speed * dt;
      if (s.carY <= minY) {
        s.carY = minY;
        s.dir = 1;
      } else if (s.carY >= maxY) {
        s.carY = maxY;
        s.dir = -1;
      }

      const deltaY = s.carY - prevCarY;
      if (inX && onFloor) {
        p.y = s.carY;
      } else if (inX && onRoof) {
        p.y = s.carY - this.floorHeight + 8;
      }

      // Check if elevator car crushes any enemies in the shaft
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (Math.abs(e.x - s.x) < s.w / 2 - 4) {
          if (deltaY > 0 && Math.abs(e.y - s.carY) < 18) {
            this._awardPoints(300, e.x, e.y, 'CRUSHED +300!', PALETTE.ORANGE);
            this._spawnBurst(e.x, e.y - 12, PALETTE.RED, 16);
            this.audio.playExplosion(0.25, 800);
            this.enemies.splice(i, 1);
          } else if (Math.abs(e.y - prevCarY) < 12) {
            e.y = s.carY;
          }
        }
      }
    }
  }

  _updatePlayer(dt) {
    const p = this.player;
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt);

    if (p.inRoomTimer > 0) {
      p.inRoomTimer = Math.max(0, p.inRoomTimer - dt);
      return;
    }

    const axis = this.input.getAxis();
    p.crouching = !p.jumping && !p.ridingShaft && this.input.isDown('down');

    // Horizontal movement
    if (!p.crouching) {
      p.vx = axis.x * 185;
      if (axis.x !== 0) p.dir = Math.sign(axis.x);
      const nextX = Math.max(
        this.buildingLeft + 18,
        Math.min(this.buildingRight - 18, p.x + p.vx * dt)
      );

      // Check if stepping into an open shaft without an elevator aligned
      const shaft = this._isShaftAtX(nextX);
      if (shaft && !p.jumping) {
        const roofY = shaft.carY - this.floorHeight + 8;
        const aligned =
          Math.abs(p.y - shaft.carY) < 16 || Math.abs(p.y - roofY) < 16;
        if (aligned) {
          p.x = nextX;
        } else if (Math.abs(axis.x) > 0.5) {
          // Allow stepping into shaft to drop or jump across
          p.x = nextX;
          p.jumping = true;
          p.vy = 20;
        }
      } else {
        p.x = nextX;
      }
    } else {
      p.vx = 0;
    }

    // Enter Red Secret Document Door or take stairs when pressing UP
    if (this.input.isJustPressed('up') && !p.jumping && !p.ridingShaft) {
      // Check Red Door first
      for (const d of this.doors) {
        if (
          d.type === 'red' &&
          !d.collected &&
          Math.abs(p.x - d.x) < 22 &&
          Math.abs(p.y - d.y) < 18
        ) {
          d.collected = true;
          d.openTimer = 0.6;
          p.inRoomTimer = 0.35;
          p.invuln = Math.max(p.invuln, 0.6);
          this.audio.playCoin();
          this._awardPoints(500, d.x, d.y - 28, 'SECRET FILE +500!', PALETTE.GOLD);
          return;
        }
      }

      // Check stairs up/down
      for (const st of this.stairs) {
        if (Math.abs(p.x - st.x2) < 26 && Math.abs(p.y - st.y2) < 18) {
          p.x = st.x1;
          p.y = st.y1;
          this.audio.playHop();
          return;
        }
      }
    }

    if (this.input.isJustPressed('down') && !p.jumping && !p.ridingShaft) {
      for (const st of this.stairs) {
        if (Math.abs(p.x - st.x1) < 26 && Math.abs(p.y - st.y1) < 18) {
          p.x = st.x2;
          p.y = st.y2;
          this.audio.playHop();
          return;
        }
      }
    }

    // Jump / Spy Flying Kick (Action B)
    if (this.input.isJustPressed('actionB') && !p.jumping) {
      p.jumping = true;
      p.vy = -310;
      p.ridingShaft = null;
      this.audio.playJump();
    }

    // Vertical gravity & landing
    if (p.jumping || !p.ridingShaft) {
      const shaft = this._isShaftAtX(p.x);
      if (shaft && !p.jumping) {
        const roofY = shaft.carY - this.floorHeight + 8;
        if (Math.abs(p.y - shaft.carY) >= 16 && Math.abs(p.y - roofY) >= 16) {
          p.jumping = true;
        }
      }

      if (p.jumping) {
        const prevY = p.y;
        p.vy += 760 * dt;
        p.y += p.vy * dt;

        // Check landing on elevator car or roof if in shaft
        if (shaft && p.vy > 0) {
          const roofY = shaft.carY - this.floorHeight + 8;
          if (prevY <= shaft.carY + 6 && p.y >= shaft.carY - 6) {
            p.y = shaft.carY;
            p.vy = 0;
            p.jumping = false;
          } else if (prevY <= roofY + 6 && p.y >= roofY - 6) {
            p.y = roofY;
            p.vy = 0;
            p.jumping = false;
          }
        }

        // Check landing on building floor if not in open shaft
        if (!shaft && p.vy > 0) {
          for (let f = 0; f < this.numFloors; f++) {
            const fy = this._floorY(f);
            if (prevY <= fy + 8 && p.y >= fy - 4) {
              p.y = fy;
              p.vy = 0;
              p.jumping = false;
              break;
            }
          }
        }

        // Bottom basement floor safety catch
        const bottomY = this._floorY(this.numFloors - 1);
        if (p.y > bottomY) {
          p.y = bottomY;
          p.vy = 0;
          p.jumping = false;
        }

        // Jump-kick enemies mid-air!
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          if (Math.abs(p.x - e.x) < 22 && Math.abs(p.y - e.y) < 24) {
            this._awardPoints(250, e.x, e.y - 20, 'JUMP KICK +250!', PALETTE.CYAN);
            this._spawnBurst(e.x, e.y - 14, PALETTE.CYAN, 14);
            this.audio.playSlap();
            this.enemies.splice(i, 1);
          }
        }
      }
    }

    // Fire Spy Pistol (Action A)
    if (this.input.isJustPressed('actionA') && p.fireCooldown <= 0) {
      const playerBullets = this.bullets.filter((b) => b.fromPlayer);
      if (playerBullets.length < 3) {
        p.fireCooldown = 0.18;
        const gunY = p.crouching ? p.y - 12 : p.y - 22;
        this.bullets.push({
          x: p.x + p.dir * 14,
          y: gunY,
          vx: p.dir * 520,
          vy: 0,
          fromPlayer: true
        });
        this.audio.playLaser(980, 240, 0.08);
      }
    }

    // Check Basement Spy Car Extraction on Floor 9 (right side x > 740)
    const onBasement = Math.abs(p.y - this._floorY(this.numFloors - 1)) < 16;
    if (onBasement && p.x > 730) {
      const rem = this._remainingRedDoors();
      if (rem === 0) {
        this._awardPoints(1000 * this.level, p.x, p.y - 30, 'MISSION COMPLETE!', PALETTE.GOLD);
        this.level += 1;
        this.audio.playStageClear();
        this._setupBuilding(this.level);
      } else {
        // Auto-collect or remind if player reached basement
        this._awardPoints(500 * this.level, p.x, p.y - 30, 'ESCAPE BONUS!', PALETTE.GREEN);
        this.level += 1;
        this.audio.playStageClear();
        this._setupBuilding(this.level);
      }
    }
  }

  _updateLamps(dt) {
    for (const lamp of this.lamps) {
      if (!lamp.falling) continue;
      lamp.vy += 650 * dt;
      lamp.y += lamp.vy * dt;

      // Hit enemies below
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (Math.abs(e.x - lamp.x) < 22 && Math.abs(e.y - 14 - lamp.y) < 18) {
          this._awardPoints(300, e.x, e.y - 20, 'LAMP DROP +300!', PALETTE.GOLD);
          this._spawnBurst(e.x, e.y - 12, PALETTE.GOLD, 16);
          this.enemies.splice(i, 1);
        }
      }

      const floorY = this._floorY(lamp.floor);
      if (lamp.y >= floorY) {
        lamp.falling = false;
        lamp.intact = false;
        this.floorDarkTimer[lamp.floor] = 8.0;
        this.audio.playExplosion(0.18, 1600);
        this._spawnBurst(lamp.x, floorY - 4, PALETTE.GOLD, 12);
      }
    }
  }

  _updateEnemies(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(1.1, 2.5 - this.level * 0.15);
      if (this.enemies.length < 7 + this.level) {
        const playerFloor = Math.max(
          0,
          Math.min(this.numFloors - 1, Math.round((this.player.y - 110) / this.floorHeight) - 1)
        );
        const targetFloor = Math.max(
          0,
          Math.min(this.numFloors - 2, playerFloor + (Math.random() < 0.5 ? 0 : 1))
        );
        this._spawnEnemyOnFloor(targetFloor);
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const sameFloor = Math.abs(e.y - this.player.y) < 20;

      if (e.crouchTimer > 0) {
        e.crouchTimer -= dt;
        e.crouching = true;
      } else {
        e.crouching = false;
      }

      if (sameFloor) {
        e.dir = this.player.x >= e.x ? 1 : -1;
      }

      if (!e.crouching) {
        const nx = e.x + e.dir * e.speed * dt;
        const shaft = this._isShaftAtX(nx);
        const blockedByShaft = shaft && Math.abs(e.y - shaft.carY) > 12;
        if (nx > this.buildingLeft + 24 && nx < this.buildingRight - 24 && !blockedByShaft) {
          e.x = nx;
        } else {
          e.dir = -e.dir;
        }
      }

      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && sameFloor && Math.abs(e.x - this.player.x) < 420) {
        e.fireTimer = Math.max(0.75, 1.65 - this.level * 0.08);
        if (Math.random() < 0.35) {
          e.crouchTimer = 0.65;
        }
        const gunY = e.crouching ? e.y - 12 : e.y - 22;
        this.bullets.push({
          x: e.x + e.dir * 14,
          y: gunY,
          vx: e.dir * (340 + this.level * 15),
          vy: 0,
          fromPlayer: false
        });
        this.audio.playLaser(620, 180, 0.08);
      }
    }
  }

  _updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < this.buildingLeft || b.x > this.buildingRight) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Check hitting overhead lamps
      if (b.fromPlayer) {
        let hitLamp = false;
        for (const lamp of this.lamps) {
          if (lamp.intact && !lamp.falling && Math.hypot(b.x - lamp.x, b.y - lamp.y) < 18) {
            lamp.falling = true;
            lamp.vy = 40;
            hitLamp = true;
            break;
          }
        }
        if (hitLamp) {
          this.bullets.splice(i, 1);
          continue;
        }

        // Check hitting enemies
        let hitEnemy = false;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          const topY = e.crouching ? e.y - 16 : e.y - 28;
          if (Math.abs(b.x - e.x) < 14 && b.y >= topY && b.y <= e.y) {
            const isDark = this.floorDarkTimer[e.floor] > 0;
            const pts = isDark ? 200 : 100;
            this._awardPoints(pts, e.x, e.y - 20, `+${pts}`, PALETTE.GOLD);
            this._spawnBurst(e.x, e.y - 14, PALETTE.RED, 14);
            this.audio.playHit();
            this.enemies.splice(j, 1);
            hitEnemy = true;
            break;
          }
        }
        if (hitEnemy) {
          this.bullets.splice(i, 1);
          continue;
        }
      } else {
        // Enemy bullet vs Player
        const p = this.player;
        if (p.invuln <= 0 && p.inRoomTimer <= 0) {
          const topY = p.crouching ? p.y - 14 : p.y - 28;
          if (Math.abs(b.x - p.x) < 12 && b.y >= topY && b.y <= p.y) {
            this.bullets.splice(i, 1);
            this._hitPlayer();
            continue;
          }
        }
      }
    }
  }

  _awardPoints(pts, x, y, label, color) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    this.floatingTexts.push({
      text: label,
      x,
      y,
      vy: -38,
      life: 1.0,
      maxLife: 1.0,
      color
    });
  }

  _hitPlayer() {
    this.renderer.shake(8, 0.3);
    this.audio.playExplosion(0.4, 700);
    this._spawnBurst(this.player.x, this.player.y - 14, PALETTE.CYAN, 24);
    this.lives -= 1;

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.audio.playGameOver();
      this.state = 'GAMEOVER';
    } else {
      this.player.invuln = 2.2;
      this.player.jumping = false;
      this.player.vy = 0;
    }
  }

  _spawnBurst(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count;
      const spd = 45 + Math.random() * 130;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.3 + Math.random() * 0.25,
        maxLife: 0.55,
        size: 3,
        color: i % 2 === 0 ? color : PALETTE.WHITE
      });
    }
  }

  _updateParticles(dt) {
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
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear('#070B14');

    ctx.save();
    ctx.translate(0, 40 - this.cameraY);

    // 1. Building Exterior Walls & Floors Cross-Section
    const theme = this.buildingTheme || { wall: '#1E293B', corridor: '#263449', slab: '#64748B' };
    const topWallY = 110;
    const botWallY = this._floorY(this.numFloors - 1);
    ctx.fillStyle = theme.wall;
    ctx.fillRect(this.buildingLeft, topWallY, this.buildingRight - this.buildingLeft, botWallY - topWallY);

    for (let f = 0; f < this.numFloors; f++) {
      const fy = this._floorY(f);
      const topY = fy - this.floorHeight;
      const isDark = this.floorDarkTimer[f] > 0;

      // Corridor wallpaper
      ctx.fillStyle = isDark ? '#090D16' : f === this.numFloors - 1 ? '#111827' : theme.corridor;
      ctx.fillRect(this.buildingLeft + 10, topY + 6, this.buildingRight - this.buildingLeft - 20, this.floorHeight - 6);

      // Floor Number Sign
      const floorNum = this.numFloors - f;
      this.renderer.drawText(`${floorNum}F`, this.buildingLeft + 24, topY + 28, {
        font: FONTS.HEADER,
        size: 10,
        color: isDark ? PALETTE.MUTED : PALETTE.GOLD
      });

      // Concrete Floor Slab (with gaps for elevator shafts)
      ctx.fillStyle = theme.slab;
      let segStart = this.buildingLeft;
      const sortedShafts = [...this.shafts].sort((a, b) => a.x - b.x);
      for (const s of sortedShafts) {
        if (f >= s.minFloor && f <= s.maxFloor) {
          const gapLeft = s.x - s.w / 2;
          const gapRight = s.x + s.w / 2;
          ctx.fillRect(segStart, fy - 4, gapLeft - segStart, 8);
          segStart = gapRight;
        }
      }
      ctx.fillRect(segStart, fy - 4, this.buildingRight - segStart, 8);
    }

    // 2. Side Stairs / Escalators
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 4;
    for (const st of this.stairs) {
      ctx.beginPath();
      ctx.moveTo(st.x1, st.y1);
      ctx.lineTo(st.x2, st.y2);
      ctx.stroke();
    }

    // 3. Doors (Red Secret Document Doors & Blue Enemy Spawn Doors)
    for (const d of this.doors) {
      const doorW = 28;
      const doorH = 46;
      const dx = d.x - doorW / 2;
      const dy = d.y - doorH - 4;

      if (d.type === 'red') {
        ctx.fillStyle = d.collected ? '#475569' : '#DC2626';
      } else {
        ctx.fillStyle = '#1D4ED8';
      }
      ctx.fillRect(dx, dy, doorW, doorH);
      ctx.strokeStyle = PALETTE.WHITE;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(dx, dy, doorW, doorH);

      if (d.type === 'red' && !d.collected) {
        this.renderer.drawText('?', d.x, dy + 26, {
          font: FONTS.HEADER,
          size: 11,
          color: PALETTE.GOLD,
          align: 'center'
        });
      }
    }

    // 4. Basement Getaway Spy Sports Car (Floor 1 right side)
    const baseFy = this._floorY(this.numFloors - 1);
    ctx.fillStyle = PALETTE.RED;
    ctx.fillRect(745, baseFy - 24, 72, 18);
    ctx.fillStyle = PALETTE.CYAN;
    ctx.fillRect(760, baseFy - 34, 36, 12);
    ctx.fillStyle = PALETTE.GOLD;
    ctx.beginPath();
    ctx.arc(762, baseFy - 6, 7, 0, Math.PI * 2);
    ctx.arc(800, baseFy - 6, 7, 0, Math.PI * 2);
    ctx.fill();
    this.renderer.drawText('SPY CAR →', 780, baseFy - 42, {
      font: FONTS.HEADER,
      size: 9,
      color: PALETTE.GOLD,
      align: 'center',
      glow: 6
    });

    // 5. Elevator Shafts, Cables & Moving Cars
    for (const s of this.shafts) {
      const topY = this._floorY(s.minFloor) - this.floorHeight;
      const botY = this._floorY(s.maxFloor);

      // Dark shaft background
      ctx.fillStyle = '#090D16';
      ctx.fillRect(s.x - s.w / 2, topY, s.w, botY - topY);

      // Steel hoist cable
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, topY);
      ctx.lineTo(s.x, s.carY - this.floorHeight + 8);
      ctx.stroke();

      // Elevator Car Frame
      const carTop = s.carY - this.floorHeight + 8;
      const carH = this.floorHeight - 8;
      ctx.fillStyle = 'rgba(251, 191, 36, 0.16)';
      ctx.fillRect(s.x - s.w / 2 + 3, carTop, s.w - 6, carH);
      ctx.strokeStyle = PALETTE.GOLD;
      ctx.lineWidth = 3;
      ctx.strokeRect(s.x - s.w / 2 + 3, carTop, s.w - 6, carH);
    }

    // 6. Overhead Ceiling Lamps
    for (const lamp of this.lamps) {
      if (!lamp.intact && !lamp.falling) continue;
      this.renderer.drawGlowCircle(lamp.x, lamp.y, 6, PALETTE.GOLD, 12);
    }

    // 7. Enemy Spy Agents
    for (const e of this.enemies) {
      const sprite = e.crouching ? SPRITES.AGENT_CROUCH : SPRITES.ENEMY_STAND;
      const scale = 2.4;
      const w = sprite[0].length * scale;
      const h = sprite.length * scale;
      this.renderer.drawPixelSprite(
        sprite,
        e.x - w / 2,
        e.y - h - 4,
        scale,
        ENEMY_PALETTE,
        e.dir < 0
      );
    }

    // 8. Player Spy (Agent 17)
    const p = this.player;
    if (p.inRoomTimer <= 0 && (p.invuln <= 0 || Math.floor(p.invuln * 14) % 2 === 0)) {
      const sprite = p.crouching ? SPRITES.AGENT_CROUCH : SPRITES.AGENT_STAND;
      const scale = 2.4;
      const w = sprite[0].length * scale;
      const h = sprite.length * scale;
      this.renderer.drawPixelSprite(
        sprite,
        p.x - w / 2,
        p.y - h - 4,
        scale,
        AGENT_PALETTE,
        p.dir < 0
      );
    }

    // 9. Bullets, Particles & Floating Texts
    for (const b of this.bullets) {
      this.renderer.drawGlowRect(
        b.x - 4,
        b.y - 2,
        8,
        4,
        b.fromPlayer ? PALETTE.CYAN : PALETTE.PINK,
        8
      );
    }

    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }

    for (const ft of this.floatingTexts) {
      this.renderer.drawText(ft.text, ft.x, ft.y, {
        font: FONTS.HEADER,
        size: 10,
        color: ft.color,
        align: 'center',
        glow: 8
      });
    }

    ctx.restore();

    if (this.bannerTimer > 0 && this.state === 'PLAYING') {
      this.renderer.drawText(this.bannerText, this.width / 2, 265, {
        font: FONTS.HEADER,
        size: 13,
        color: PALETTE.GOLD,
        align: 'center',
        glow: 12
      });
    }

    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `FILES: ${this._remainingRedDoors()}`,
      accent: PALETTE.RED
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'HIGH-RISE ESPIONAGE & ELEVATOR COMBAT EDITION',
      controls: 'ARROWS: WALK / DRIVE ELEVATOR / ENTER RED DOOR  |  Z/SPACE: SHOOT  |  X/SHIFT: JUMP KICK',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.RED
    });
  }
}

export default ElevatorAction;
