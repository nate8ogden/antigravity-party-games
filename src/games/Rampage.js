/**
 * Rampage.js
 * Giant Kaiju City Destruction Arcade Game
 * Climb multi-story skyscrapers, punch structural windows, eat food/civilians for health,
 * dodge & swat military helicopters, tanks, and dynamite until the entire skyline collapses!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';
import { Vector2 } from '../engine/Vector2.js';

const KAIJU_IDLE = [
  '..GGGGGG..',
  '.GGGGGGGG.',
  'GGWKGWWKGG',
  'GGGGGGGGGG',
  '.GGRRRRGG.',
  'GGGGGGGGGG',
  'GGGGGGGGGG',
  '.GGGGGGGG.',
  '.GGG..GGG.',
  '.KK....KK.'
];

const KAIJU_PUNCH = [
  '..GGGGGG....',
  '.GGGGGGGG...',
  'GGWKGWWKGG..',
  'GGGGGGGGGGGG',
  '.GGRRRRGGGGY',
  'GGGGGGGGGGGG',
  'GGGGGGGGGG..',
  '.GGGGGGGG...',
  '.GGG..GGG...',
  '.KK....KK...'
];

// Bally Midway 1986 Defeated Monster Human Alter-Ego Scurry Animation
const HUMAN_SCURRY_1 = [
  '..YYY...',
  '..FFF...',
  '.FFFFF..',
  '..FFF...',
  '.FFFFF..',
  '.F.F.F..',
  '...F....',
  '..F.F...',
  '..F.F...'
];

const HUMAN_SCURRY_2 = [
  '..YYY...',
  '..FFF...',
  '.FFFFF..',
  '..FFF...',
  '.FFFFF..',
  '..FFF...',
  '...F....',
  '..F.....',
  '...F....'
];

// Authentic Bally Midway 1986 American City Tour
const CITIES = [
  { name: 'PEORIA, IL (DAY 1)', skyTop: '#0F172A', skyBottom: '#7C2D12', skylineColor: '#18181B' },
  { name: 'CHICAGO, IL (DAY 2)', skyTop: '#020617', skyBottom: '#1E293B', skylineColor: '#0F172A' },
  { name: 'DETROIT, MI (DAY 3)', skyTop: '#18181B', skyBottom: '#52525B', skylineColor: '#27272A' },
  { name: 'ST. LOUIS, MO (DAY 4)', skyTop: '#1C1917', skyBottom: '#854D0E', skylineColor: '#292524' },
  { name: 'NEW YORK, NY (DAY 5)', skyTop: '#0B0F19', skyBottom: '#312E81', skylineColor: '#111827' },
  { name: 'SAN FRANCISCO, CA (DAY 6)', skyTop: '#082F49', skyBottom: '#0284C7', skylineColor: '#0C4A6E' },
  { name: 'PHILADELPHIA, PA (DAY 7)', skyTop: '#1E1B4B', skyBottom: '#581C87', skylineColor: '#2E1065' },
  { name: 'DALLAS, TX (DAY 8)', skyTop: '#3B0764', skyBottom: '#9D174D', skylineColor: '#4A044E' },
  { name: 'LOS ANGELES, CA (DAY 9)', skyTop: '#172554', skyBottom: '#C2410C', skylineColor: '#1E3A8A' },
  { name: 'WASHINGTON, D.C. (DAY 10)', skyTop: '#090D16', skyBottom: '#1D4ED8', skylineColor: '#0F172A' }
];

export class Rampage {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'rampage';
    this.title = 'Rampage';
    this.state = 'PLAYING';

    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.groundY = 500;
    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.state = 'PLAYING';

    this.particles = [];
    this.floatingTexts = [];
    this.projectiles = [];
    this.enemies = [];
    this.dynamites = [];

    this._initPlayer();
    this._buildCity(this.level);
  }

  _initPlayer() {
    this.player = {
      x: 180,
      y: this.groundY,
      vx: 0,
      vy: 0,
      width: 44,
      height: 52,
      dir: 1,
      monster: 'george', // 'george' (King Kong Gorilla) | 'lizzie' (Godzilla Kaiju) | 'ralph' (Werewolf)
      climbingBuilding: null,
      climbSide: 'left', // 'left' | 'right'
      standingOnBuilding: null,
      onGround: true,
      health: 100,
      maxHealth: 100,
      punchTimer: 0,
      punchCooldown: 0,
      invulnTimer: 1.2,
      animTime: 0
    };
  }

  _buildCity(level) {
    this.city = CITIES[(level - 1) % CITIES.length];
    this.buildings = [];
    this.enemies = [];
    this.projectiles = [];
    this.dynamites = [];
    this.humanScurry = null;
    this.enemySpawnTimer = 1.8;
    this.dynamiteTimer = 4.5;
    this.levelClearTimer = 0;

    const numBuildings = (level % 4 === 0) ? 5 : 4;
    const buildingTemplates = [
      { cols: 3, floors: 5, color: '#334155', trim: PALETTE.CYAN, prop: 'waterTower' },
      { cols: 4, floors: 7, color: '#1E293B', trim: PALETTE.ORANGE, prop: 'neonSign', signText: 'HOTEL' },
      { cols: 2, floors: 8, color: '#475569', trim: PALETTE.GOLD, prop: 'waterTower' },
      { cols: 3, floors: 6, color: '#1E1B4B', trim: PALETTE.PINK, prop: 'neonSign', signText: 'BAR' },
      { cols: 3, floors: 5, color: '#31102F', trim: PALETTE.PURPLE, prop: 'waterTower' }
    ];

    const cellW = 42;
    const cellH = 38;
    let totalBWidth = 0;
    for (let i = 0; i < numBuildings; i++) {
      totalBWidth += buildingTemplates[i].cols * cellW + 16;
    }
    const gap = Math.max(20, Math.floor((960 - totalBWidth) / (numBuildings + 1)));

    let curX = gap;
    for (let i = 0; i < numBuildings; i++) {
      const tmpl = buildingTemplates[i];
      const cols = tmpl.cols;
      const floors = Math.min(9, tmpl.floors + Math.floor((level - 1) / 3));
      const bWidth = cols * cellW + 16;
      const bHeight = floors * cellH + 14;
      const bx = curX;
      curX += bWidth + gap;
      const by = this.groundY - bHeight;

      const windows = [];
      for (let r = 0; r < floors; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
          let item = null;
          const roll = Math.random();
          if (roll < 0.22) item = 'food';
          else if (roll < 0.36) item = 'civilian';
          else if (roll < 0.44) item = 'gold';
          else if (roll < 0.52) item = 'hazard';
          else if (roll < 0.60) item = 'sniper';

          row.push({
            row: r,
            col: c,
            hp: 2,
            maxHp: 2,
            lit: Math.random() < 0.65,
            item,
            itemRevealed: false,
            itemTimer: 0,
            sniperCooldown: 1.5 + Math.random() * 2.0
          });
        }
        windows.push(row);
      }

      const maxStructuralHp = Math.ceil(floors * cols * 1.15);
      this.buildings.push({
        index: i,
        x: bx,
        y: by,
        width: bWidth,
        height: bHeight,
        baseHeight: bHeight,
        cols,
        floors,
        cellW,
        cellH,
        color: tmpl.color,
        trimColor: tmpl.trim,
        windows,
        damage: 0,
        maxDamage: maxStructuralHp,
        collapsing: false,
        collapsed: false,
        collapseSpeed: 0,
        shakeOffset: 0,
        waterTower: tmpl.prop === 'waterTower' ? { smashed: false } : null,
        neonSign: tmpl.prop === 'neonSign' ? { text: tmpl.signText, smashed: false } : null
      });
    }
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.particles = [];
    this.projectiles = [];
    this.enemies = [];
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
        vy: -45,
        life: 0.85,
        maxLife: 0.85,
        color
      });
    }
  }

  _spawnParticles(x, y, count, color, speed = 120, gravity = 260) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const mag = (0.3 + Math.random() * 0.7) * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * mag,
        vy: Math.sin(angle) * mag - 30,
        gravity,
        life: 0.35 + Math.random() * 0.45,
        maxLife: 0.8,
        size: 3 + Math.random() * 4,
        color
      });
    }
  }

  _damagePlayer(amount) {
    if (this.player.invulnTimer > 0 || this.humanScurry) return;
    // Lizzie has armored dinosaur scales that reduce incoming bullet/shell damage by 28%
    const mult = this.player.monster === 'lizzie' ? 0.72 : 1.0;
    this.player.health -= amount * mult;
    this.player.invulnTimer = 0.65;
    this.renderer.shake(6, 0.18);
    this.audio.playHit();
    this._spawnParticles(this.player.x, this.player.y - 26, 10, PALETTE.RED, 140);

    if (this.player.health <= 0) {
      this.lives--;
      this.audio.playExplosion(0.5, 700);
      this._spawnParticles(this.player.x, this.player.y - 25, 24, '#E2E8F0', 160, 200);

      // Authentic Bally Midway 1986 defeat: giant monster shrinks into a naked human scuttling away!
      this.humanScurry = {
        x: this.player.x,
        y: this.groundY,
        dir: this.player.x < 480 ? -1 : 1,
        timer: 1.8,
        animTime: 0
      };
      this.player.climbingBuilding = null;
      this.player.standingOnBuilding = null;
      this.player.onGround = true;
      this.player.y = this.groundY;
      this.player.vy = 0;
    }
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

    // Handle Human Alter-Ego Scurrying on Defeat
    if (this.humanScurry) {
      const hs = this.humanScurry;
      hs.timer -= dt;
      hs.animTime += dt * 9;
      hs.x += hs.dir * 135 * dt;
      if (Math.random() < 0.3) {
        this._spawnParticles(hs.x, this.groundY - 10, 1, '#CBD5E1', 30, -30);
      }
      if (hs.timer <= 0) {
        this.humanScurry = null;
        if (this.lives <= 0) {
          HighScoreStore.submit(this.id, this.score);
          this.audio.playGameOver();
          this.setState('GAMEOVER');
        } else {
          this.player.health = this.player.maxHealth;
          this.player.x = 180;
          this.player.y = this.groundY;
          this.player.vy = 0;
          this.player.invulnTimer = 2.0;
          this.floatingTexts.push({
            text: 'MONSTER REBORN!',
            x: this.player.x,
            y: this.player.y - 60,
            vy: -35,
            life: 1.2,
            maxLife: 1.2,
            color: PALETTE.GOLD
          });
        }
      }
      return;
    }

    const p = this.player;
    p.animTime += dt;
    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    if (p.punchTimer > 0) p.punchTimer = Math.max(0, p.punchTimer - dt);
    if (p.punchCooldown > 0) p.punchCooldown = Math.max(0, p.punchCooldown - dt);

    // Toggle Monster Character: George (King Kong Gorilla) / Lizzie (Godzilla Kaiju) / Ralph (Werewolf) via KeyC, Select, or L1/R1
    if (
      this.input.isKeyJustPressed('KeyC') ||
      (typeof this.input.isGamepadSelectPressed === 'function' &&
        this.input.isGamepadSelectPressed()) ||
      (typeof this.input.isGamepadNextTabPressed === 'function' &&
        this.input.isGamepadNextTabPressed())
    ) {
      const roster = ['george', 'lizzie', 'ralph'];
      const nextIdx = (roster.indexOf(p.monster || 'george') + 1) % roster.length;
      p.monster = roster[nextIdx];
      const names = { george: 'GEORGE (APE)', lizzie: 'LIZZIE (KAIJU)', ralph: 'RALPH (WOLF)' };
      this.audio.playPowerUp();
      this.floatingTexts.push({
        text: `${names[p.monster]}!`,
        x: p.x,
        y: p.y - 65,
        vy: -35,
        life: 1.1,
        maxLife: 1.1,
        color: PALETTE.GOLD
      });
    }

    const axis = this.input.getAxis();
    // Unique Monster Attributes
    const climbSpeed = p.monster === 'george' ? 185 : 155;
    const moveSpeed = p.monster === 'ralph' ? 225 : 190;
    const jumpPower = p.monster === 'ralph' ? -415 : -375;

    // 1. CLIMBING BUILDING WALL
    if (p.climbingBuilding) {
      const b = p.climbingBuilding;
      if (b.collapsing || b.collapsed) {
        p.climbingBuilding = null;
        p.onGround = false;
      } else {
        p.vy = axis.y * climbSpeed;
        p.y += p.vy * dt;

        // Keep attached to building edge
        if (p.climbSide === 'left') {
          p.x = b.x - 6;
          p.dir = 1;
        } else {
          p.x = b.x + b.width + 6;
          p.dir = -1;
        }

        // Reached street ground
        if (p.y >= this.groundY) {
          p.y = this.groundY;
          p.climbingBuilding = null;
          p.onGround = true;
          p.vy = 0;
        } else if (p.y <= b.y + 4) {
          // CLIMBED TO TOP! Pull up onto the building rooftop!
          p.y = b.y;
          p.climbingBuilding = null;
          p.standingOnBuilding = b;
          p.onGround = true;
          p.vy = 0;
          p.x = p.climbSide === 'left' ? b.x + 18 : b.x + b.width - 18;
          this.audio.playHop();
        }

        // Jump off wall with Action B
        if (this.input.isJustPressed('actionB')) {
          p.climbingBuilding = null;
          p.onGround = false;
          p.vy = jumpPower;
          p.vx = axis.x !== 0 ? axis.x * 220 : (p.climbSide === 'left' ? 180 : -180);
          this.audio.playJump();
        }
      }
    } else if (p.standingOnBuilding) {
      // 2. STANDING & WALKING ON BUILDING ROOFTOP
      const b = p.standingOnBuilding;
      if (b.collapsed) {
        p.standingOnBuilding = null;
        p.onGround = false;
      } else if (b.collapsing) {
        // Ride the crumbling building down into the rubble!
        p.y = b.y;
        p.onGround = true;
        if (b.height <= 18) {
          p.standingOnBuilding = null;
          p.y = this.groundY;
          p.onGround = true;
        }
      } else {
        p.y = b.y;
        p.onGround = true;
      }

      // Walk along rooftop
      p.vx = axis.x * moveSpeed;
      if (axis.x > 0.1) p.dir = 1;
      else if (axis.x < -0.1) p.dir = -1;
      p.x += p.vx * dt;

      // Jump off roof with Action B
      if (this.input.isJustPressed('actionB')) {
        p.standingOnBuilding = null;
        p.onGround = false;
        p.vy = jumpPower;
        this.audio.playJump();
      }

      // Climb back down: Press DOWN near either roof edge to grab the wall!
      if (axis.y > 0.3) {
        if (Math.abs(p.x - b.x) < 28) {
          p.standingOnBuilding = null;
          p.climbingBuilding = b;
          p.climbSide = 'left';
          p.x = b.x - 6;
          p.y = b.y + 14;
          p.dir = 1;
        } else if (Math.abs(p.x - (b.x + b.width)) < 28) {
          p.standingOnBuilding = null;
          p.climbingBuilding = b;
          p.climbSide = 'right';
          p.x = b.x + b.width + 6;
          p.y = b.y + 14;
          p.dir = -1;
        }
      }

      // Walked off roof edge into the air
      if (p.x < b.x - 14 || p.x > b.x + b.width + 14) {
        p.standingOnBuilding = null;
        p.onGround = false;
      }
    } else {
      // 3. GROUND OR AIRBORNE MOVEMENT
      p.vx = axis.x * moveSpeed;
      if (axis.x > 0.1) p.dir = 1;
      else if (axis.x < -0.1) p.dir = -1;

      p.x += p.vx * dt;
      p.x = Math.max(36, Math.min(924, p.x));

      if (p.onGround) {
        p.y = this.groundY;
        // High jump from ground to reach buildings!
        if (this.input.isJustPressed('actionB')) {
          p.vy = jumpPower;
          p.onGround = false;
          this.audio.playJump();
        }

        // Latch onto wall when pressing UP or moving into wall
        if (axis.y < -0.3) {
          for (const b of this.buildings) {
            if (b.collapsed || b.collapsing) continue;
            const distLeft = Math.abs(p.x - b.x);
            const distRight = Math.abs(p.x - (b.x + b.width));
            if (distLeft < 28) {
              p.climbingBuilding = b;
              p.climbSide = 'left';
              p.x = b.x - 6;
              p.dir = 1;
              p.onGround = false;
              p.y -= 8;
              break;
            } else if (distRight < 28) {
              p.climbingBuilding = b;
              p.climbSide = 'right';
              p.x = b.x + b.width + 6;
              p.dir = -1;
              p.onGround = false;
              p.y -= 8;
              break;
            }
          }
        }
      } else {
        // Airborne: gravity
        p.vy += 700 * dt;
        p.y += p.vy * dt;

        // Solid rooftop landing when falling downwards (vy > 0)!
        if (p.vy > 0) {
          for (const b of this.buildings) {
            if (b.collapsed) continue;
            if (
              p.y >= b.y &&
              p.y - p.vy * dt <= b.y + 18 &&
              p.x >= b.x - 8 &&
              p.x <= b.x + b.width + 8
            ) {
              p.y = b.y;
              p.vy = 0;
              p.standingOnBuilding = b;
              p.onGround = true;
              // Downward roof stomp damage!
              const stompDmg = p.monster === 'lizzie' ? 2.0 : 1.0;
              b.damage += stompDmg;
              this.renderer.shake(4, 0.1);
              this.audio.playShove();
              this._spawnParticles(p.x, b.y, 8, '#94A3B8', 90);
              break;
            }
          }
        }

        // Can grab building wall mid-air if holding UP
        if (!p.standingOnBuilding && axis.y < -0.2) {
          for (const b of this.buildings) {
            if (b.collapsed || b.collapsing) continue;
            if (p.y > b.y + 15 && p.y < this.groundY) {
              if (Math.abs(p.x - b.x) < 24) {
                p.climbingBuilding = b;
                p.climbSide = 'left';
                p.vy = 0;
                p.vx = 0;
                break;
              } else if (Math.abs(p.x - (b.x + b.width)) < 24) {
                p.climbingBuilding = b;
                p.climbSide = 'right';
                p.vy = 0;
                p.vx = 0;
                break;
              }
            }
          }
        }

        // Landing on ground
        if (p.y >= this.groundY) {
          p.y = this.groundY;
          p.vy = 0;
          p.onGround = true;
          this.renderer.shake(3, 0.08);
          this.audio.playShove();
        }
      }
    }

    // Punch Mechanic (Action A or Pointer Click)
    if (
      (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) &&
      p.punchCooldown <= 0
    ) {
      p.punchTimer = 0.18;
      p.punchCooldown = 0.22;
      this._performPunch();
    }

    // Update Buildings & Window Items
    let activeBuildings = 0;
    for (const b of this.buildings) {
      if (b.collapsed) continue;
      activeBuildings++;

      // Update revealed window bonuses & snipers
      for (let r = 0; r < b.floors; r++) {
        for (let c = 0; c < b.cols; c++) {
          const w = b.windows[r][c];
          if (w.itemRevealed && w.item) {
            w.itemTimer -= dt;
            if (w.itemTimer <= 0) {
              w.item = null;
              w.itemRevealed = false;
            } else if (w.item === 'sniper') {
              // Active window sniper aiming and shooting at monster!
              w.sniperCooldown = (w.sniperCooldown || 1.8) - dt;
              if (w.sniperCooldown <= 0) {
                w.sniperCooldown = 2.0 + Math.random() * 1.5;
                const wx = b.x + 8 + c * b.cellW + b.cellW / 2;
                const wy = b.y + 10 + r * b.cellH + b.cellH / 2;
                const dx = p.x - wx;
                const dy = (p.y - 25) - wy;
                const dist = Math.hypot(dx, dy) || 1;
                this.projectiles.push({
                  x: wx,
                  y: wy,
                  vx: (dx / dist) * 240,
                  vy: (dy / dist) * 240,
                  color: PALETTE.GOLD,
                  damage: 7,
                  radius: 3.5
                });
                this.audio.playLaser(620, 200, 0.08);
              }
            }
          }
        }
      }

      // Check structural collapse trigger
      if (!b.collapsing && b.damage >= b.maxDamage) {
        b.collapsing = true;
        b.collapseSpeed = 95;
        this.audio.playExplosion(0.65, 550);
        this.renderer.shake(9, 0.45);
        this._addScore(1000 * this.level, b.x + b.width / 2, b.y + 40, PALETTE.CYAN);
        if (p.climbingBuilding === b) {
          p.climbingBuilding = null;
          p.onGround = false;
          p.vy = -180;
        }
      }

      if (b.collapsing) {
        b.collapseSpeed += 220 * dt;
        const drop = b.collapseSpeed * dt;
        b.y += drop;
        b.height -= drop;
        b.shakeOffset = (Math.random() * 2 - 1) * 5;

        // Emit rubble & smoke cloud along base
        if (Math.random() < 0.65) {
          this._spawnParticles(
            b.x + Math.random() * b.width,
            this.groundY - 8,
            3,
            Math.random() < 0.5 ? '#94A3B8' : PALETTE.ORANGE,
            110,
            180
          );
        }

        if (b.height <= 18) {
          b.height = 14;
          b.y = this.groundY - 14;
          b.collapsing = false;
          b.collapsed = true;
          this.audio.playExplosion(0.5, 400);
          this._spawnParticles(b.x + b.width / 2, this.groundY - 10, 28, '#CBD5E1', 180, 240);
        }
      }
    }

    // Spawn Military Helicopters, Tanks & Police Squad Cars
    this.enemySpawnTimer -= dt;
    if (this.enemySpawnTimer <= 0 && activeBuildings > 0) {
      this.enemySpawnTimer = Math.max(1.3, 3.2 - this.level * 0.25);
      if (this.enemies.length < 4 + this.level) {
        const fromLeft = Math.random() < 0.5;
        const roll = Math.random();
        if (roll < 0.45) {
          // Attack Helicopter
          this.enemies.push({
            type: 'heli',
            x: fromLeft ? -30 : 990,
            y: 90 + Math.random() * 170,
            vx: (fromLeft ? 1 : -1) * (85 + this.level * 12),
            vy: 0,
            dir: fromLeft ? 1 : -1,
            fireTimer: 1.2 + Math.random() * 1.2,
            rotorPhase: 0
          });
        } else if (roll < 0.75) {
          // National Guard Armored Tank
          this.enemies.push({
            type: 'tank',
            x: fromLeft ? -35 : 995,
            y: this.groundY,
            vx: (fromLeft ? 1 : -1) * (55 + this.level * 8),
            dir: fromLeft ? 1 : -1,
            fireTimer: 1.5 + Math.random() * 1.2
          });
        } else {
          // Police Squad Car with flashing beacon
          this.enemies.push({
            type: 'policeCar',
            x: fromLeft ? -35 : 995,
            y: this.groundY,
            vx: (fromLeft ? 1 : -1) * (110 + this.level * 10),
            dir: fromLeft ? 1 : -1,
            fireTimer: 1.3 + Math.random() * 1.0,
            sirenPhase: 0
          });
        }
      }
    }

    // Spawn Dynamite sticks near buildings
    this.dynamiteTimer -= dt;
    if (this.dynamiteTimer <= 0 && activeBuildings > 0) {
      this.dynamiteTimer = Math.max(3.5, 6.5 - this.level * 0.3);
      const standing = this.buildings.filter((b) => !b.collapsed && !b.collapsing);
      if (standing.length > 0) {
        const targetB = standing[Math.floor(Math.random() * standing.length)];
        this.dynamites.push({
          x: targetB.x + targetB.width / 2,
          y: this.groundY - 8,
          fuse: 3.0,
          building: targetB
        });
      }
    }

    // Update Dynamite
    for (let i = this.dynamites.length - 1; i >= 0; i--) {
      const dyn = this.dynamites[i];
      dyn.fuse -= dt;
      if (Math.random() < 0.4) {
        this._spawnParticles(dyn.x, dyn.y - 10, 1, PALETTE.GOLD, 50, -40);
      }
      if (dyn.fuse <= 0) {
        this.audio.playExplosion(0.45, 800);
        this.renderer.shake(7, 0.25);
        this._spawnParticles(dyn.x, dyn.y - 8, 20, PALETTE.ORANGE, 170, 220);
        if (dyn.building && !dyn.building.collapsed) {
          dyn.building.damage += 4;
        }
        if (Math.hypot(p.x - dyn.x, p.y - dyn.y) < 68) {
          this._damagePlayer(18);
        }
        this.dynamites.splice(i, 1);
      }
    }

    // Update Enemies (Helicopters, Tanks & Police Cars)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.x += e.vx * dt;
      if (e.type === 'heli') {
        e.rotorPhase += dt * 25;
        e.y += Math.sin(e.rotorPhase * 0.15) * 18 * dt;
      } else if (e.type === 'policeCar') {
        e.sirenPhase += dt * 16;
      }

      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        e.fireTimer = Math.max(1.1, 2.4 - this.level * 0.15);
        const dx = p.x - e.x;
        const dy = p.y - 26 - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 460) {
          const spd = e.type === 'tank' ? 250 : e.type === 'policeCar' ? 240 : 220;
          this.projectiles.push({
            x: e.x,
            y: e.type === 'tank' ? e.y - 14 : e.type === 'policeCar' ? e.y - 10 : e.y + 6,
            vx: (dx / dist) * spd,
            vy: (dy / dist) * spd,
            color: e.type === 'tank' ? PALETTE.ORANGE : e.type === 'policeCar' ? PALETTE.CYAN : PALETTE.PINK,
            damage: e.type === 'tank' ? 12 : e.type === 'policeCar' ? 8 : 8,
            radius: e.type === 'tank' ? 5 : 3.5
          });
          this.audio.playLaser(550, 180, 0.09);
        }
      }

      if (e.x < -80 || e.x > 1040) {
        this.enemies.splice(i, 1);
      }
    }

    // Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;

      if (
        Math.abs(proj.x - p.x) < 22 &&
        proj.y >= p.y - p.height &&
        proj.y <= p.y
      ) {
        this._damagePlayer(proj.damage);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (proj.x < 0 || proj.x > 960 || proj.y < 38 || proj.y > this.groundY) {
        this.projectiles.splice(i, 1);
      }
    }

    // Update Particles & Floating Texts
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += pt.gravity * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // Check City Demolition Completion
    if (activeBuildings === 0) {
      this.levelClearTimer += dt;
      if (this.levelClearTimer === dt) {
        this.audio.playStageClear();
        this._addScore(2500 * this.level, 480, 220, PALETTE.GREEN);
      }
      if (this.levelClearTimer > 2.2) {
        this.level++;
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 35);
        this._buildCity(this.level);
      }
    }
  }

  _performPunch() {
    const p = this.player;
    const punchX = p.x + p.dir * 30;
    const punchY = p.y - 28;

    this.renderer.shake(4, 0.1);
    this.audio.playShove();

    // 1. Check punching enemies (Helicopters / Tanks / Police Cars)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const ey = e.type === 'tank' || e.type === 'policeCar' ? e.y - 12 : e.y;
      if (Math.hypot(punchX - e.x, punchY - ey) < 46) {
        this.audio.playExplosion(0.35, 900);
        this._spawnParticles(e.x, ey, 18, PALETTE.ORANGE, 160);
        const pts = e.type === 'heli' ? 400 : e.type === 'policeCar' ? 450 : 350;
        this._addScore(pts, e.x, ey - 10, PALETTE.GOLD);
        this.enemies.splice(i, 1);
        return;
      }
    }

    // 2. Check punching Dynamite (defuses/throws it for bonus!)
    for (let i = this.dynamites.length - 1; i >= 0; i--) {
      const dyn = this.dynamites[i];
      if (Math.hypot(punchX - dyn.x, punchY - dyn.y) < 44) {
        this.audio.playCoin();
        this._spawnParticles(dyn.x, dyn.y, 12, PALETTE.CYAN, 130);
        this._addScore(300, dyn.x, dyn.y - 15, PALETTE.CYAN);
        this.dynamites.splice(i, 1);
        return;
      }
    }

    // 3. Check punching Rooftop Props (Water Towers & Neon Signs)
    for (const b of this.buildings) {
      if (b.collapsed || b.collapsing) continue;

      if (b.waterTower && !b.waterTower.smashed) {
        if (Math.abs(punchY - b.y) < 36 && Math.abs(punchX - (b.x + b.width / 2)) < b.width / 2) {
          b.waterTower.smashed = true;
          b.damage += 4;
          this.audio.playExplosion(0.45, 600);
          this._spawnParticles(b.x + b.width / 2, b.y - 12, 28, PALETTE.CYAN, 180, 200);
          this._addScore(600, b.x + b.width / 2, b.y - 30, PALETTE.CYAN);
          this.floatingTexts.push({
            text: 'WATER TOWER SMASHED!',
            x: b.x + b.width / 2,
            y: b.y - 40,
            vy: -35,
            life: 1.1,
            maxLife: 1.1,
            color: PALETTE.CYAN
          });
          return;
        }
      }

      if (b.neonSign && !b.neonSign.smashed) {
        if (Math.abs(punchY - b.y) < 36 && Math.abs(punchX - (b.x + b.width / 2)) < b.width / 2) {
          b.neonSign.smashed = true;
          b.damage += 3;
          this.audio.playCoin();
          this._spawnParticles(b.x + b.width / 2, b.y - 12, 24, PALETTE.GOLD, 160, 160);
          this._addScore(500, b.x + b.width / 2, b.y - 30, PALETTE.GOLD);
          this.floatingTexts.push({
            text: 'NEON SHATTERED!',
            x: b.x + b.width / 2,
            y: b.y - 40,
            vy: -35,
            life: 1.0,
            maxLife: 1.0,
            color: PALETTE.GOLD
          });
          return;
        }
      }

      // Check punching Building Windows / Structural Blocks
      if (
        punchX >= b.x - 18 &&
        punchX <= b.x + b.width + 18 &&
        punchY >= b.y - 32 &&
        punchY <= b.y + b.height
      ) {
        // Find nearest window cell
        const relY = Math.max(0, Math.min(b.height - 1, punchY - (b.y + 10)));
        const r = Math.min(b.floors - 1, Math.floor(relY / b.cellH));

        let c = 0;
        if (p.climbingBuilding === b) {
          c = p.climbSide === 'left' ? 0 : b.cols - 1;
          if (b.windows[r][c].hp <= 0 && b.cols > 1) {
            c = 1;
          }
        } else {
          const relX = Math.max(0, Math.min(b.width - 1, punchX - (b.x + 8)));
          c = Math.min(b.cols - 1, Math.floor(relX / b.cellW));
        }

        const win = b.windows[r][c];
        const wx = b.x + 8 + c * b.cellW + b.cellW / 2;
        const wy = b.y + 10 + r * b.cellH + b.cellH / 2;

        // If item is revealed, eat/grab/disarm it!
        if (win.itemRevealed && win.item) {
          if (win.item === 'food' || win.item === 'civilian') {
            const heal = win.item === 'food' ? 18 : 22;
            p.health = Math.min(p.maxHealth, p.health + heal);
            this.audio.playPowerUp();
            this._addScore(250, wx, wy, PALETTE.GREEN);
            this.floatingTexts.push({
              text: `+${heal} HP`,
              x: wx,
              y: wy - 16,
              vy: -40,
              life: 0.9,
              maxLife: 0.9,
              color: PALETTE.GREEN
            });
          } else if (win.item === 'sniper') {
            this.audio.playHit();
            this._addScore(350, wx, wy, PALETTE.GOLD);
            this.floatingTexts.push({
              text: 'SNIPER DISARMED!',
              x: wx,
              y: wy - 16,
              vy: -40,
              life: 0.9,
              maxLife: 0.9,
              color: PALETTE.GOLD
            });
          } else if (win.item === 'gold') {
            this.audio.playCoin();
            this._addScore(500, wx, wy, PALETTE.GOLD);
          } else if (win.item === 'hazard') {
            this._damagePlayer(10);
            this.floatingTexts.push({
              text: 'SHOCK!',
              x: wx,
              y: wy - 16,
              vy: -40,
              life: 0.8,
              maxLife: 0.8,
              color: PALETTE.RED
            });
          }
          win.item = null;
          win.itemRevealed = false;
          return;
        }

        // Otherwise smash the window/block
        const punchBonus = p.monster === 'george' ? 1.5 : 1.0;
        if (win.hp > 0) {
          win.hp--;
          b.damage += punchBonus;
          this._spawnParticles(wx, wy, 10, PALETTE.CYAN, 130);
          this._addScore(75, wx, wy, PALETTE.WHITE);
          if (win.hp === 1 && win.item) {
            win.itemRevealed = true;
            win.itemTimer = 5.0;
          }
        } else {
          // Punching exposed structural girder deals structural damage
          b.damage += 0.85 * punchBonus;
          this._spawnParticles(wx, wy, 7, '#94A3B8', 100);
          this._addScore(50, wx, wy, PALETTE.ORANGE);
        }
        return;
      }
    }
  }

  render(ctx = this.renderer.ctx) {
    const p = this.player;
    const city = this.city || CITIES[0];

    // Dynamic Atmospheric Sky Gradient for Current Tour City
    const grad = ctx.createLinearGradient(0, 38, 0, this.groundY);
    grad.addColorStop(0, city.skyTop);
    grad.addColorStop(1, city.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 38, this.renderer.width, this.renderer.height - 38);

    // City Name Headline Banner
    this.renderer.drawText(city.name, 480, 58, {
      font: FONTS.HEADER,
      size: 12,
      color: PALETTE.GOLD,
      align: 'center',
      glow: 6
    });

    // Classic 1986 Bally Midway City Skyline Silhouettes in the Background
    ctx.save();
    for (let i = 0; i < 14; i++) {
      const sx = i * 70 - 6;
      const sh = 95 + ((i * 53) % 145);
      const sy = this.groundY - sh;
      ctx.fillStyle = i % 2 === 0 ? city.skylineColor : '#090D16';
      ctx.fillRect(sx, sy, 66, sh);

      // Stepped Art Deco crown & radio spire on select towers
      if (i % 3 === 0) {
        ctx.fillRect(sx + 14, sy - 18, 38, 18);
        ctx.fillRect(sx + 31, sy - 38, 4, 20);
        // Blinking red aviation beacon
        if (Math.floor(performance.now() * 0.003 + i) % 2 === 0) {
          ctx.fillStyle = PALETTE.RED;
          ctx.fillRect(sx + 31, sy - 41, 4, 4);
        }
      }
      // Distant lit skyline windows
      ctx.fillStyle = 'rgba(253, 224, 71, 0.22)';
      for (let wy = sy + 12; wy < this.groundY - 16; wy += 16) {
        for (let wx = sx + 10; wx < sx + 54; wx += 14) {
          if ((wx + wy + i * 7) % 3 === 0) {
            ctx.fillRect(wx, wy, 6, 8);
          }
        }
      }
    }
    ctx.restore();

    // Draw Destructible Skyscrapers
    for (const b of this.buildings) {
      ctx.save();
      const bx = b.x + (b.collapsing ? b.shakeOffset : 0);

      if (b.collapsed) {
        // Pile of smoking rubble
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(b.x - 10, this.groundY);
        ctx.lineTo(b.x + 25, this.groundY - 22);
        ctx.lineTo(b.x + b.width * 0.5, this.groundY - 14);
        ctx.lineTo(b.x + b.width - 20, this.groundY - 26);
        ctx.lineTo(b.x + b.width + 10, this.groundY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        continue;
      }

      // Building body clipped above groundY
      ctx.beginPath();
      ctx.rect(bx - 4, 40, b.width + 8, this.groundY - 40);
      ctx.clip();

      ctx.fillStyle = b.color;
      ctx.fillRect(bx, b.y, b.width, b.height);
      ctx.strokeStyle = b.trimColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, b.y, b.width, b.height);

      // Rooftop Water Tower Prop
      if (b.waterTower) {
        const wtx = bx + b.width / 2;
        const wty = b.y - 2;
        if (!b.waterTower.smashed) {
          // Wooden support stilts
          ctx.strokeStyle = '#451A03';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(wtx - 14, wty); ctx.lineTo(wtx - 9, wty - 16);
          ctx.moveTo(wtx + 14, wty); ctx.lineTo(wtx + 9, wty - 16);
          ctx.moveTo(wtx - 5, wty); ctx.lineTo(wtx - 5, wty - 16);
          ctx.moveTo(wtx + 5, wty); ctx.lineTo(wtx + 5, wty - 16);
          ctx.stroke();
          // Cedar tank vat & hoops
          ctx.fillStyle = '#78350F';
          ctx.fillRect(wtx - 15, wty - 34, 30, 18);
          ctx.fillStyle = '#94A3B8';
          ctx.fillRect(wtx - 15, wty - 30, 30, 2);
          ctx.fillRect(wtx - 15, wty - 22, 30, 2);
          // Conical roof cap
          ctx.fillStyle = '#B45309';
          ctx.beginPath();
          ctx.moveTo(wtx - 18, wty - 34);
          ctx.lineTo(wtx, wty - 44);
          ctx.lineTo(wtx + 18, wty - 34);
          ctx.closePath();
          ctx.fill();
        } else {
          // Smashed cedar debris & dripping water
          ctx.fillStyle = '#78350F';
          ctx.fillRect(wtx - 12, wty - 6, 24, 6);
          ctx.fillStyle = PALETTE.CYAN;
          ctx.fillRect(wtx - 6, wty - 4, 12, 4);
        }
      }

      // Rooftop Neon Sign Prop
      if (b.neonSign) {
        const nsx = bx + b.width / 2;
        const nsy = b.y - 2;
        if (!b.neonSign.smashed) {
          ctx.strokeStyle = '#64748B';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(nsx - 22, nsy - 22, 44, 22);
          const glowColor = b.neonSign.text === 'HOTEL' ? PALETTE.PINK : PALETTE.CYAN;
          this.renderer.drawText(b.neonSign.text, nsx, nsy - 7, {
            size: 11,
            color: glowColor,
            align: 'center',
            glow: 8
          });
        } else {
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(nsx - 18, nsy);
          ctx.lineTo(nsx, nsy - 10);
          ctx.lineTo(nsx + 18, nsy);
          ctx.stroke();
        }
      }

      // Structural Integrity Bar on Roof
      const integrity = Math.max(0, 1 - b.damage / b.maxDamage);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(bx + 12, b.y - 9, b.width - 24, 5);
      ctx.fillStyle =
        integrity > 0.5 ? PALETTE.GREEN : integrity > 0.25 ? PALETTE.GOLD : PALETTE.RED;
      ctx.fillRect(bx + 12, b.y - 9, (b.width - 24) * integrity, 5);

      // Windows & Structural Holes
      for (let r = 0; r < b.floors; r++) {
        for (let c = 0; c < b.cols; c++) {
          const w = b.windows[r][c];
          const wx = bx + 8 + c * b.cellW + 4;
          const wy = b.y + 10 + r * b.cellH + 4;
          const ww = b.cellW - 8;
          const wh = b.cellH - 8;

          if (w.hp === 2) {
            ctx.fillStyle = w.lit ? '#FEF08A' : '#1E293B';
            ctx.fillRect(wx, wy, ww, wh);
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1;
            ctx.strokeRect(wx, wy, ww, wh);
          } else if (w.hp === 1) {
            // Cracked window
            ctx.fillStyle = '#0F172A';
            ctx.fillRect(wx, wy, ww, wh);
            ctx.strokeStyle = PALETTE.CYAN;
            ctx.beginPath();
            ctx.moveTo(wx, wy);
            ctx.lineTo(wx + ww, wy + wh);
            ctx.moveTo(wx + ww, wy);
            ctx.lineTo(wx, wy + wh);
            ctx.stroke();
          } else {
            // Smashed structural hole with exposed girder
            ctx.fillStyle = '#090D16';
            ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
            ctx.strokeStyle = PALETTE.RED;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(wx, wy + wh / 2 - 2, ww, 4);
          }

          // Revealed Item inside window (Roast Chicken, Waving Civilian, Gold Bullion, Toaster, Sniper)
          if (w.itemRevealed && w.item) {
            const cx = wx + ww / 2;
            const cy = wy + wh / 2;
            if (w.item === 'food') {
              // Roast Chicken / Drumstick
              ctx.fillStyle = PALETTE.WHITE;
              ctx.fillRect(cx - 9, cy - 2, 18, 4);
              ctx.fillRect(cx - 10, cy - 4, 3, 8);
              this.renderer.drawGlowCircle(cx + 2, cy, 6.5, '#D97706', 8, true);
              ctx.fillStyle = '#FDE68A';
              ctx.fillRect(cx, cy - 4, 5, 3);
            } else if (w.item === 'civilian') {
              // Waving Civilian in window
              const waveY = Math.sin(performance.now() * 0.015) * 3;
              ctx.strokeStyle = '#FDBA74';
              ctx.lineWidth = 2.2;
              ctx.beginPath();
              ctx.moveTo(cx - 9, cy - 3 + waveY);
              ctx.lineTo(cx, cy + 1);
              ctx.lineTo(cx + 9, cy - 3 - waveY);
              ctx.stroke();
              this.renderer.drawGlowCircle(cx, cy - 5, 4, '#FDBA74', 6, true);
              ctx.fillStyle = PALETTE.PINK;
              ctx.fillRect(cx - 4, cy - 1, 8, 9);
            } else if (w.item === 'sniper') {
              // Leaning Armed Resident / Sniper
              const aimAngle = Math.atan2((p.y - 25) - cy, p.x - cx);
              ctx.save();
              ctx.translate(cx, cy);
              ctx.fillStyle = '#15803D';
              ctx.fillRect(-4, -7, 8, 6);
              ctx.fillStyle = '#FDBA74';
              ctx.fillRect(-3, -3, 6, 4);
              ctx.strokeStyle = '#0F172A';
              ctx.lineWidth = 2.4;
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(Math.cos(aimAngle) * 13, Math.sin(aimAngle) * 13);
              ctx.stroke();
              ctx.restore();
            } else if (w.item === 'gold') {
              // Stacked Gold Bullion Bars
              this.renderer.drawGlowRect(cx - 8, cy + 1, 16, 6, PALETTE.GOLD, 10, true);
              this.renderer.drawGlowRect(cx - 5, cy - 5, 10, 6, '#FDE047', 8, true);
              ctx.fillStyle = PALETTE.WHITE;
              ctx.fillRect(cx - 3, cy - 4, 4, 2);
            } else if (w.item === 'hazard') {
              // Sparking Electric Toaster Hazard
              ctx.fillStyle = '#CBD5E1';
              ctx.fillRect(cx - 7, cy - 3, 14, 10);
              ctx.fillStyle = '#090D16';
              ctx.fillRect(cx - 5, cy - 3, 3, 2);
              ctx.fillRect(cx + 2, cy - 3, 3, 2);
              // Electric arcs
              ctx.strokeStyle = PALETTE.CYAN;
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(cx - 6, cy - 4);
              ctx.lineTo(cx - 2, cy - 9);
              ctx.lineTo(cx + 2, cy - 5);
              ctx.lineTo(cx + 6, cy - 10);
              ctx.stroke();
            }
          }
        }
      }
      ctx.restore();
    }

    // Street Pavement
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, this.groundY, this.renderer.width, this.renderer.height - this.groundY);
    ctx.strokeStyle = PALETTE.GOLD;
    ctx.setLineDash([18, 14]);
    ctx.beginPath();
    ctx.moveTo(0, this.groundY + 20);
    ctx.lineTo(this.renderer.width, this.groundY + 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Bundled TNT Dynamite Sticks with Sizzling Fuse
    for (const dyn of this.dynamites) {
      ctx.save();
      ctx.translate(dyn.x, dyn.y);
      // 3 Red TNT sticks + black straps
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(-7, -14, 4, 14);
      ctx.fillRect(-2, -14, 4, 14);
      ctx.fillRect(3, -14, 4, 14);
      ctx.fillStyle = '#090D16';
      ctx.fillRect(-8, -11, 16, 2);
      ctx.fillRect(-8, -5, 16, 2);
      // Burning fuse & spark
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(4, -20);
      ctx.stroke();
      this.renderer.drawGlowCircle(4, -20, 3, PALETTE.GOLD, 8, true);
      ctx.restore();

      this.renderer.drawText(dyn.fuse.toFixed(1), dyn.x, dyn.y - 24, {
        size: 11,
        color: PALETTE.GOLD,
        align: 'center'
      });
    }

    // Draw Human Alter-Ego Scurry on Defeat
    if (this.humanScurry) {
      const hs = this.humanScurry;
      const sprite = Math.floor(hs.animTime) % 2 === 0 ? HUMAN_SCURRY_1 : HUMAN_SCURRY_2;
      const palette = {
        Y: PALETTE.GOLD,
        F: '#FDBA74'
      };
      const scale = 3.2;
      const drawX = hs.x - (sprite[0].length * scale) / 2;
      const drawY = hs.y - sprite.length * scale;
      this.renderer.drawPixelSprite(sprite, drawX, drawY, scale, palette, hs.dir < 0, false);
      this.renderer.drawText('EEK!', hs.x, hs.y - 34, {
        size: 11,
        color: PALETTE.WHITE,
        align: 'center',
        glow: 6
      });
    }

    // Draw Player Kaiju
    if (!this.humanScurry && (p.invulnTimer <= 0 || Math.floor(p.invulnTimer * 16) % 2 === 0)) {
      const sprite = p.punchTimer > 0 ? KAIJU_PUNCH : KAIJU_IDLE;
      let palette = {
        G: PALETTE.GREEN,
        W: PALETTE.WHITE,
        K: '#0B0F19',
        R: PALETTE.PINK,
        Y: PALETTE.GOLD
      };
      if (p.monster === 'george') {
        // George the Giant Ape (King Kong parody)
        palette = {
          G: '#78350F', // Rich dark brown gorilla fur
          W: PALETTE.WHITE,
          K: '#0B0F19',
          R: '#FED7AA', // Tan chest / muzzle
          Y: '#FDE047'
        };
      } else if (p.monster === 'ralph') {
        // Ralph the Giant Werewolf
        palette = {
          G: '#475569', // Slate wolf fur
          W: PALETTE.WHITE,
          K: '#020617',
          R: '#E2E8F0', // Silver muzzle
          Y: '#F87171'
        };
      }
      const scale = 4.5;
      const drawX = p.x - (sprite[0].length * scale) / 2;
      const drawY = p.y - sprite.length * scale;
      this.renderer.drawPixelSprite(sprite, drawX, drawY, scale, palette, p.dir < 0, false);

      // Punch Shockwave
      if (p.punchTimer > 0) {
        this.renderer.drawGlowCircle(
          p.x + p.dir * 30,
          p.y - 28,
          12,
          PALETTE.GOLD,
          12,
          false,
          2.5
        );
      }
    }

    // Draw Enemies (Helicopters, Tanks & Police Cars)
    for (const e of this.enemies) {
      if (e.type === 'heli') {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.scale(e.dir, 1);

        // Landing skids
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, 8);
        ctx.lineTo(-10, 12);
        ctx.moveTo(8, 8);
        ctx.lineTo(8, 12);
        ctx.moveTo(-15, 12);
        ctx.lineTo(15, 12);
        ctx.stroke();

        // Tail boom & vertical fin
        ctx.fillStyle = PALETTE.CYAN;
        ctx.fillRect(-30, -3, 16, 5);
        ctx.fillRect(-32, -9, 5, 9);

        // Rounded Helicopter Cabin & Glass Bubble Canopy
        this.renderer.drawGlowRect(-15, -8, 30, 16, PALETTE.CYAN, 8, true);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(1, -6, 13, 9);
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(3, -5, 9, 6);

        // Rotor mast & spinning main blades
        ctx.fillStyle = '#CBD5E1';
        ctx.fillRect(-2, -12, 4, 4);
        const bladeW = Math.max(6, Math.abs(26 * Math.cos(e.rotorPhase)));
        ctx.strokeStyle = PALETTE.WHITE;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-bladeW, -12);
        ctx.lineTo(bladeW, -12);
        ctx.stroke();
        ctx.restore();
      } else if (e.type === 'policeCar') {
        // Police Squad Car on street
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.scale(e.dir, 1);
        ctx.fillStyle = '#090D16';
        ctx.fillRect(-14, -5, 7, 5);
        ctx.fillRect(8, -5, 7, 5);
        ctx.fillStyle = PALETTE.WHITE;
        ctx.fillRect(-18, -12, 36, 8);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-10, -18, 20, 7);
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(-8, -16, 7, 4);
        ctx.fillRect(1, -16, 7, 4);
        const sirenBlink = Math.floor(e.sirenPhase) % 2 === 0;
        ctx.fillStyle = sirenBlink ? PALETTE.RED : PALETTE.CYAN;
        ctx.fillRect(-3, -22, 6, 4);
        this.renderer.drawGlowCircle(0, -20, 4, sirenBlink ? PALETTE.RED : PALETTE.CYAN, 8);
        ctx.restore();
      } else {
        // Armored Military Tank on street
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.scale(e.dir, 1);

        // Caterpillar Treads & Road Wheels
        ctx.fillStyle = '#090D16';
        ctx.fillRect(-20, -7, 40, 7);
        ctx.fillStyle = '#64748B';
        for (let wx = -15; wx <= 15; wx += 7.5) {
          ctx.fillRect(wx - 2, -5, 4, 4);
        }

        // Armored Hull
        this.renderer.drawGlowRect(-18, -14, 36, 8, PALETTE.ORANGE, 6, true);
        // Turret Dome & Cannon Barrel
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(-10, -21, 20, 7);
        ctx.fillStyle = '#FDE047';
        ctx.fillRect(10, -19, 16, 4);
        ctx.restore();
      }
    }

    // Draw Projectiles
    for (const proj of this.projectiles) {
      this.renderer.drawGlowCircle(proj.x, proj.y, proj.radius, proj.color, 10);
    }

    // Draw Rubble & Smoke Particles
    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    // Draw Floating Score / Heal Popups
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

    // Monster Health Bar in Upper Left Arena
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(16, 46, 184, 16);
    const hpRatio = Math.max(0, p.health / p.maxHealth);
    const hpColor = hpRatio > 0.5 ? PALETTE.GREEN : hpRatio > 0.25 ? PALETTE.GOLD : PALETTE.RED;
    this.renderer.drawGlowRect(18, 48, 180 * hpRatio, 12, hpColor, 6);
    const monsterNames = {
      george: 'GEORGE (APE)',
      lizzie: 'LIZZIE (KAIJU)',
      ralph: 'RALPH (WOLF)'
    };
    const mLabel = monsterNames[p.monster || 'george'];
    this.renderer.drawText(`${mLabel} HP: ${Math.ceil(p.health)}%  [C: SWAP]`, 208, 59, {
      size: 11,
      color: PALETTE.WHITE
    });

    // Top HUD Bar
    const standingCount = this.buildings.filter((b) => !b.collapsed).length;
    const cityName = city.name.split(' (')[0];
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `${cityName} | TOWERS:${standingCount} | ${mLabel}`,
      accent: PALETTE.GREEN
    });

    // State Overlay
    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'KAIJU & GORILLA SKYSCRAPER DEMOLITION',
      controls: 'ARROWS: WALK/CLIMB ROOFS  |  Z/SPACE: PUNCH  |  X/SHIFT: JUMP  |  C: SWAP MONSTER',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GREEN
    });
  }
}

export default Rampage;
