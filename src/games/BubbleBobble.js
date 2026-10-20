/**
 * BubbleBobble.js
 * Classic 1986 Single-Screen Neon Cave Action Platformer
 * Features high-velocity bubble blowing, enemy trapping, air-current float physics,
 * chain-pop multipliers, parabolic enemy knockbacks, and high-value Fruit Bonuses.
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const BUB_SPRITE = [
  '..GGGGGG....',
  '.GGGGGGGG...',
  'GGWWGGWWGG..',
  'GGWBGGWBGG..',
  'GGGGGGGGGG..',
  '.GGGGGGGGPP.',
  '..GGGGGGGG..',
  '.GGGGGGGGGG.',
  'GGGGGGGGGGGG',
  '.GGGG..GGGG.',
  '.YYYY..YYYY.'
];

const ZENCHAN_SPRITE = [
  '..RRRRRR....',
  '.RRRRRRRR...',
  'RRWWWRRWWWR.',
  'RRWBWRRWBWR.',
  'RRRRRRRRRRR.',
  'YYYYRRRRYYYY',
  '.RRRRRRRRRR.',
  '..RRR..RRR..',
  '.WWWW..WWWW.'
];

const MIGHTA_SPRITE = [
  '..PPPPPP....',
  '.PPPPPPPP...',
  'PPWWWWWWWWP.',
  'PPWBBWWBBWP.',
  'PPWWWWWWWWP.',
  'PPPPPPPPPPP.',
  '.PPPPPPPPPP.',
  '..PPP..PPP..',
  '.CCCC..CCCC.'
];

const LEVEL_LAYOUTS = [
  // Level 1: Classic 3-tier symmetrical cave
  [
    { x: 140, y: 410, w: 260 },
    { x: 560, y: 410, w: 260 },
    { x: 220, y: 300, w: 520 },
    { x: 140, y: 190, w: 260 },
    { x: 560, y: 190, w: 260 }
  ],
  // Level 2: Pyramid steps
  [
    { x: 100, y: 420, w: 200 },
    { x: 380, y: 420, w: 200 },
    { x: 660, y: 420, w: 200 },
    { x: 200, y: 315, w: 220 },
    { x: 540, y: 315, w: 220 },
    { x: 310, y: 205, w: 340 }
  ],
  // Level 3: Twin towers & central bridge
  [
    { x: 90, y: 415, w: 190 },
    { x: 680, y: 415, w: 190 },
    { x: 330, y: 360, w: 300 },
    { x: 90, y: 270, w: 190 },
    { x: 680, y: 270, w: 190 },
    { x: 280, y: 180, w: 400 }
  ],
  // Level 4: Zig-zag canyon
  [
    { x: 110, y: 430, w: 560 },
    { x: 290, y: 335, w: 560 },
    { x: 110, y: 240, w: 560 },
    { x: 290, y: 145, w: 420 }
  ]
];

const FRUIT_TYPES = [
  { name: 'BANANA', points: 500, color: '#FFD700', accent: '#FFF380' },
  { name: 'WATERMELON', points: 1000, color: '#FF2A55', accent: '#00FF66' },
  { name: 'PINEAPPLE', points: 1500, color: '#FF8800', accent: '#00FF66' },
  { name: 'DIAMOND', points: 3000, color: '#00F0FF', accent: '#FFFFFF' }
];

export class BubbleBobble {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'bubblebobble';
    this.title = 'Bubble Dragons';
    this.width = 960;
    this.height = 540;

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.wallLeft = 36;
    this.wallRight = 924;
    this.floorY = 508;
    this.ceilingY = 48;

    this.player = null;
    this.platforms = [];
    this.bubbles = [];
    this.enemies = [];
    this.projectiles = [];
    this.fruits = [];
    this.particles = [];
    this.popups = [];

    this.stageClearTimer = 0;
    this.hurryUpTimer = 0;
    this.hurryUpActive = false;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.state = 'PLAYING';
    this._initStage();
  }

  setState(state) {
    this.state = state;
    if (state === 'GAMEOVER') {
      HighScoreStore.submit(this.id, this.score);
    }
  }

  destroy() {
    if (this.audio) {
      this.audio.stopSequence();
    }
  }

  _addScore(pts, x = null, y = null, color = PALETTE.GOLD) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    if (x !== null && y !== null) {
      this.popups.push({
        x,
        y,
        text: `+${pts}`,
        color,
        life: 1.0
      });
    }
  }

  _initStage() {
    const layout = LEVEL_LAYOUTS[(this.level - 1) % LEVEL_LAYOUTS.length];
    this.platforms = layout.map((p) => ({ ...p, h: 14 }));

    this.bubbles = [];
    this.enemies = [];
    this.projectiles = [];
    this.fruits = [];
    this.particles = [];
    this.popups = [];
    this.stageClearTimer = 0;
    this.hurryUpTimer = 28;
    this.hurryUpActive = false;

    this._resetPlayer();

    const count = Math.min(8, 3 + this.level);
    for (let i = 0; i < count; i++) {
      const isMighta = i % 2 === 1 && this.level >= 1;
      const plat = this.platforms[i % this.platforms.length];
      const ex = plat.x + 30 + ((i * 67) % Math.max(40, plat.w - 60));
      const ey = plat.y - 26;
      this.enemies.push({
        type: isMighta ? 'mighta' : 'zenchan',
        x: ex,
        y: ey,
        w: 24,
        h: 24,
        vx: (i % 2 === 0 ? 1 : -1) * (95 + this.level * 10),
        vy: 0,
        facing: i % 2 === 0 ? 1 : -1,
        onGround: false,
        angry: false,
        state: 'PATROL', // 'PATROL' | 'FLYING'
        jumpTimer: 1.2 + (i % 3) * 0.7,
        attackTimer: 2.4 + i * 0.5,
        animTime: i * 0.3
      });
    }
  }

  _resetPlayer() {
    this.player = {
      x: 110,
      y: this.floorY - 26,
      w: 24,
      h: 24,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: true,
      shootCooldown: 0,
      mouthOpenTimer: 0,
      invulnTimer: 2.0,
      animTime: 0
    };
  }

  _spawnParticles(x, y, color, count = 12, speed = 160) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd = speed * (0.4 + Math.random() * 0.7);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        color,
        life: 0.45 + Math.random() * 0.25,
        maxLife: 0.7
      });
    }
  }

  _blowBubble() {
    const p = this.player;
    p.shootCooldown = 0.22;
    p.mouthOpenTimer = 0.16;
    this.audio.playHop();

    this.bubbles.push({
      x: p.x + p.w / 2 + p.facing * 14,
      y: p.y + p.h / 2 - 2,
      r: 15,
      vx: p.facing * 430,
      vy: 0,
      state: 'SHOOTING', // 'SHOOTING' | 'FLOATING'
      shootTimer: 0.32,
      lifeTimer: 9.5,
      trappedEnemy: null,
      wobblePhase: Math.random() * Math.PI * 2
    });
  }

  _popBubbleCluster(seedBubble) {
    const visited = new Set();
    const queue = [seedBubble];
    const popped = [];

    while (queue.length > 0) {
      const curr = queue.shift();
      if (visited.has(curr)) continue;
      visited.add(curr);
      popped.push(curr);

      for (const other of this.bubbles) {
        if (!visited.has(other)) {
          const d = Math.hypot(curr.x - other.x, curr.y - other.y);
          if (d <= 54) {
            queue.push(other);
          }
        }
      }
    }

    let trappedCount = 0;
    for (const b of popped) {
      if (b.trappedEnemy) trappedCount++;
    }

    const chainMultiplier = Math.pow(2, Math.max(0, trappedCount - 1));

    for (const b of popped) {
      b.dead = true;
      this._spawnParticles(b.x, b.y, b.trappedEnemy ? PALETTE.PINK : PALETTE.CYAN, 10, 140);

      if (b.trappedEnemy) {
        const enemy = b.trappedEnemy;
        const pts = 1000 * chainMultiplier;
        this._addScore(pts, b.x, b.y - 10, chainMultiplier > 1 ? PALETTE.PINK : PALETTE.GOLD);
        // Launch defeated enemy flying in a high arc to spawn fruit on landing
        this.enemies.push({
          ...enemy,
          x: b.x - 12,
          y: b.y - 12,
          vx: (Math.random() > 0.5 ? 1 : -1) * (220 + Math.random() * 90),
          vy: -380 - Math.random() * 80,
          state: 'FLYING',
          chainRank: Math.min(FRUIT_TYPES.length - 1, trappedCount - 1 + (this.level > 2 ? 1 : 0))
        });
      } else {
        this._addScore(50, b.x, b.y, PALETTE.CYAN);
      }
    }

    this.bubbles = this.bubbles.filter((b) => !b.dead);
    if (trappedCount > 0) {
      this.audio.playPop();
      this.renderer.shake(5, 0.14);
    } else {
      this.audio.playDig();
    }
  }

  update(dt) {
    if (this.state === 'MENU') {
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
      if (this.input.isJustPressed('pause') || this.input.isJustPressed('actionA')) {
        this.audio.playMenuSelect();
        this.setState('PLAYING');
      }
      return;
    }

    if (this.state === 'GAMEOVER') {
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

    if (this.input.isJustPressed('pause')) {
      this.audio.playMenuMove();
      this.setState('PAUSED');
      return;
    }

    const p = this.player;
    p.animTime += dt;
    if (p.shootCooldown > 0) p.shootCooldown -= dt;
    if (p.mouthOpenTimer > 0) p.mouthOpenTimer -= dt;
    if (p.invulnTimer > 0) p.invulnTimer -= dt;

    // Horizontal Movement
    const moveSpeed = 235;
    if (this.input.isDown('left')) {
      p.vx = -moveSpeed;
      p.facing = -1;
    } else if (this.input.isDown('right')) {
      p.vx = moveSpeed;
      p.facing = 1;
    } else {
      p.vx *= Math.pow(0.001, dt);
      if (Math.abs(p.vx) < 5) p.vx = 0;
    }

    // Jump (Action B or Up)
    const jumpPressed = this.input.isJustPressed('actionB') || this.input.isJustPressed('up');
    if (jumpPressed && p.onGround) {
      p.vy = -510;
      p.onGround = false;
      this.audio.playJump();
    }

    // Blow Bubble (Action A)
    if (this.input.isJustPressed('actionA') && p.shootCooldown <= 0) {
      this._blowBubble();
    }

    // Apply gravity & move player
    const prevBottom = p.y + p.h;
    p.vy = Math.min(520, p.vy + 1120 * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Wall bounds
    if (p.x < this.wallLeft) p.x = this.wallLeft;
    if (p.x + p.w > this.wallRight) p.x = this.wallRight - p.w;

    // Screen vertical wrap-around if falling through bottom pit or jumping above top
    if (p.y > this.height) {
      p.y = this.ceilingY;
    }

    // Platform collisions (One-way from above)
    p.onGround = false;
    if (p.vy >= 0) {
      if (p.y + p.h >= this.floorY) {
        p.y = this.floorY - p.h;
        p.vy = 0;
        p.onGround = true;
      } else {
        for (const plat of this.platforms) {
          if (
            p.x + p.w > plat.x + 4 &&
            p.x < plat.x + plat.w - 4 &&
            prevBottom <= plat.y + 6 &&
            p.y + p.h >= plat.y
          ) {
            p.y = plat.y - p.h;
            p.vy = 0;
            p.onGround = true;
            break;
          }
        }
      }
    }

    // Hurry Up Timer
    if (this.stageClearTimer <= 0) {
      this.hurryUpTimer -= dt;
      if (this.hurryUpTimer <= 0 && !this.hurryUpActive) {
        this.hurryUpActive = true;
        this.audio.playSiren(0.1, true);
        this.popups.push({
          x: this.width / 2,
          y: 120,
          text: 'HURRY UP!!',
          color: PALETTE.RED,
          life: 1.5
        });
        for (const e of this.enemies) {
          e.angry = true;
        }
      }
    }

    // Update Bubbles
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.wobblePhase += dt * 5;
      b.lifeTimer -= dt;

      if (b.state === 'SHOOTING') {
        b.shootTimer -= dt;
        b.x += b.vx * dt;

        // Bounce off cave walls into float mode
        if (b.x - b.r < this.wallLeft) {
          b.x = this.wallLeft + b.r;
          b.state = 'FLOATING';
          b.vx = 0;
        } else if (b.x + b.r > this.wallRight) {
          b.x = this.wallRight - b.r;
          b.state = 'FLOATING';
          b.vx = 0;
        }

        // Check enemy capture while shooting!
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (e.state !== 'PATROL') continue;
          const ex = e.x + e.w / 2;
          const ey = e.y + e.h / 2;
          if (Math.hypot(b.x - ex, b.y - ey) < b.r + 14) {
            b.trappedEnemy = e;
            b.state = 'FLOATING';
            b.vx = 0;
            b.lifeTimer = 8.5;
            this.enemies.splice(j, 1);
            this.audio.playPump(2);
            this._spawnParticles(ex, ey, PALETTE.GREEN, 8, 90);
            break;
          }
        }

        if (b.shootTimer <= 0) {
          b.state = 'FLOATING';
          b.vx = 0;
        }
      } else {
        // FLOATING upward along air currents
        const targetCeiling = this.ceilingY + 28;
        if (b.y > targetCeiling) {
          b.vy = -58;
        } else {
          // Drift horizontally toward center when at top ceiling
          b.vy = Math.sin(b.wobblePhase) * 14;
          const centerDir = b.x < this.width / 2 ? 1 : -1;
          b.vx = centerDir * 24;
        }
        b.x += (b.vx + Math.sin(b.wobblePhase) * 22) * dt;
        b.y += b.vy * dt;
        b.x = Math.max(this.wallLeft + b.r, Math.min(this.wallRight - b.r, b.x));
      }

      // Bubble expiration
      if (b.lifeTimer <= 0) {
        if (b.trappedEnemy) {
          // Enemy escapes angry!
          const escaped = b.trappedEnemy;
          escaped.x = b.x - 12;
          escaped.y = b.y - 12;
          escaped.vy = -180;
          escaped.angry = true;
          escaped.state = 'PATROL';
          this.enemies.push(escaped);
          this.audio.playSiren(0.2, true);
        }
        this.bubbles.splice(i, 1);
        continue;
      }

      // Check player collision with floating or trapped bubble
      const px = p.x + p.w / 2;
      const py = p.y + p.h / 2;
      const dist = Math.hypot(px - b.x, py - b.y);
      if (dist < b.r + 13) {
        if (b.trappedEnemy) {
          this._popBubbleCluster(b);
          break;
        } else if (b.state === 'FLOATING') {
          // Jumping on top of empty bubble while holding jump bounces Bub upward; otherwise pops it!
          if (p.vy > 0 && py < b.y - 4 && (this.input.isDown('actionB') || this.input.isDown('up'))) {
            p.vy = -490;
            this.audio.playJump();
            this._spawnParticles(b.x, b.y, PALETTE.CYAN, 5, 70);
          } else {
            this._popBubbleCluster(b);
            break;
          }
        }
      }
    }

    // Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.animTime += dt;

      if (e.state === 'FLYING') {
        e.vy += 920 * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;

        if (e.x < this.wallLeft) {
          e.x = this.wallLeft;
          e.vx = Math.abs(e.vx);
        } else if (e.x + e.w > this.wallRight) {
          e.x = this.wallRight - e.w;
          e.vx = -Math.abs(e.vx);
        }

        // Land on floor or platform -> turn into Fruit Bonus!
        if (e.vy > 0 && e.y + e.h >= this.floorY) {
          this._spawnFruit(e.x, this.floorY - 22, e.chainRank || 0);
          this.enemies.splice(i, 1);
          continue;
        }
        let landed = false;
        if (e.vy > 120) {
          for (const plat of this.platforms) {
            if (
              e.x + e.w > plat.x &&
              e.x < plat.x + plat.w &&
              e.y + e.h >= plat.y &&
              e.y + e.h <= plat.y + 22
            ) {
              this._spawnFruit(e.x, plat.y - 22, e.chainRank || 0);
              this.enemies.splice(i, 1);
              landed = true;
              break;
            }
          }
        }
        if (landed) continue;
        continue;
      }

      // PATROL AI
      const speedMult = e.angry ? 1.55 : 1.0;
      const baseSpeed = 95 + this.level * 12;
      e.vx = e.facing * baseSpeed * speedMult;

      e.jumpTimer -= dt;
      if (e.jumpTimer <= 0 && e.onGround) {
        // Jump upward toward player if player is higher, or random hop
        if (p.y < e.y - 30 || Math.random() < 0.35) {
          e.vy = -485;
          e.onGround = false;
        }
        e.jumpTimer = (e.angry ? 1.1 : 1.9) + Math.random() * 1.2;
      }

      // Mighta throws magic boulders horizontally
      if (e.type === 'mighta') {
        e.attackTimer -= dt;
        if (e.attackTimer <= 0 && Math.abs(p.y - e.y) < 42) {
          e.facing = p.x > e.x ? 1 : -1;
          this.projectiles.push({
            x: e.x + e.w / 2,
            y: e.y + e.h / 2,
            vx: e.facing * 240,
            r: 8,
            life: 2.6
          });
          e.attackTimer = e.angry ? 2.0 : 3.2;
          this.audio.playLaser(420, 180, 0.09);
        }
      }

      const prevEBottom = e.y + e.h;
      e.vy = Math.min(480, e.vy + 1050 * dt);
      e.x += e.vx * dt;
      e.y += e.vy * dt;

      if (e.x <= this.wallLeft) {
        e.x = this.wallLeft;
        e.facing = 1;
      } else if (e.x + e.w >= this.wallRight) {
        e.x = this.wallRight - e.w;
        e.facing = -1;
      }

      e.onGround = false;
      if (e.vy >= 0) {
        if (e.y + e.h >= this.floorY) {
          e.y = this.floorY - e.h;
          e.vy = 0;
          e.onGround = true;
        } else {
          for (const plat of this.platforms) {
            if (
              e.x + e.w > plat.x + 4 &&
              e.x < plat.x + plat.w - 4 &&
              prevEBottom <= plat.y + 8 &&
              e.y + e.h >= plat.y
            ) {
              e.y = plat.y - e.h;
              e.vy = 0;
              e.onGround = true;
              break;
            }
          }
        }
      }

      // Check collision with Player
      if (
        p.invulnTimer <= 0 &&
        p.x < e.x + e.w - 4 &&
        p.x + p.w > e.x + 4 &&
        p.y < e.y + e.h - 4 &&
        p.y + p.h > e.y + 4
      ) {
        this._damagePlayer();
        break;
      }
    }

    // Update Enemy Projectiles (Mighta boulders)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.x += proj.vx * dt;
      proj.life -= dt;
      if (proj.x < this.wallLeft || proj.x > this.wallRight || proj.life <= 0) {
        this._spawnParticles(proj.x, proj.y, PALETTE.PURPLE, 5, 80);
        this.projectiles.splice(i, 1);
        continue;
      }
      if (
        p.invulnTimer <= 0 &&
        Math.hypot(p.x + p.w / 2 - proj.x, p.y + p.h / 2 - proj.y) < proj.r + 10
      ) {
        this.projectiles.splice(i, 1);
        this._damagePlayer();
        break;
      }
    }

    // Update Fruits
    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const f = this.fruits[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.fruits.splice(i, 1);
        continue;
      }
      if (
        p.x < f.x + 22 &&
        p.x + p.w > f.x &&
        p.y < f.y + 22 &&
        p.y + p.h > f.y
      ) {
        this.audio.playCoin();
        this._addScore(f.points, f.x + 10, f.y, f.color);
        this._spawnParticles(f.x + 10, f.y + 10, f.color, 12, 140);
        this.fruits.splice(i, 1);
      }
    }

    // Check Stage Clear (no active patrol/flying enemies and no trapped enemies in bubbles)
    const trappedRemaining = this.bubbles.some((b) => b.trappedEnemy !== null);
    if (this.enemies.length === 0 && !trappedRemaining) {
      if (this.stageClearTimer === 0) {
        this.stageClearTimer = 2.2;
        this.audio.playStageClear();
        // Bonus fruit shower on stage clear
        for (let k = 0; k < 4; k++) {
          this._spawnFruit(200 + k * 180, this.floorY - 22, k % FRUIT_TYPES.length);
        }
      } else {
        this.stageClearTimer -= dt;
        if (this.stageClearTimer <= 0) {
          this.level++;
          this._initStage();
        }
      }
    }

    // Update Particles & Popups
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 35 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  _spawnFruit(x, y, rank = 0) {
    const type = FRUIT_TYPES[Math.min(FRUIT_TYPES.length - 1, rank)];
    this.fruits.push({
      x: Math.max(this.wallLeft + 10, Math.min(this.wallRight - 32, x)),
      y,
      name: type.name,
      points: type.points,
      color: type.color,
      accent: type.accent,
      life: 9.0
    });
    this._spawnParticles(x + 10, y + 10, type.color, 8, 100);
  }

  _damagePlayer() {
    this.audio.playHit();
    this.renderer.shake(8, 0.25);
    this._spawnParticles(this.player.x + 12, this.player.y + 12, PALETTE.GREEN, 18, 200);
    this.lives--;
    if (this.lives <= 0) {
      this.audio.playGameOver();
      this.setState('GAMEOVER');
    } else {
      this._resetPlayer();
    }
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear('#090B16');

    // Subtle neon air-current streamlines
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
    ctx.lineWidth = 1.5;
    const t = performance.now() * 0.001;
    for (let i = 0; i < 6; i++) {
      const xBase = 140 + i * 135;
      ctx.beginPath();
      for (let y = this.floorY; y >= this.ceilingY; y -= 24) {
        const xOff = Math.sin(y * 0.02 + t * 2 + i) * 14;
        if (y === this.floorY) ctx.moveTo(xBase + xOff, y);
        else ctx.lineTo(xBase + xOff, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Cave Brick Walls & Floor
    const wallColor = this.level % 2 === 1 ? '#FF007A' : '#00F0FF';
    this.renderer.drawGlowRect(0, 38, this.wallLeft, this.height - 38, wallColor, 8, false, 2);
    this.renderer.drawGlowRect(this.wallRight, 38, this.width - this.wallRight, this.height - 38, wallColor, 8, false, 2);
    this.renderer.drawGlowRect(0, this.floorY, this.width, this.height - this.floorY, wallColor, 8, false, 2);

    // Brick pattern inside walls
    ctx.fillStyle = 'rgba(255, 0, 122, 0.16)';
    for (let y = 44; y < this.floorY; y += 22) {
      ctx.fillRect(4, y, this.wallLeft - 8, 16);
      ctx.fillRect(this.wallRight + 4, y, this.width - this.wallRight - 8, 16);
    }

    // One-Way Neon Platforms
    for (const plat of this.platforms) {
      this.renderer.drawGlowRect(plat.x, plat.y, plat.w, plat.h, PALETTE.PURPLE, 8, false, 2);
      ctx.fillStyle = 'rgba(184, 41, 255, 0.25)';
      ctx.fillRect(plat.x + 2, plat.y + 2, plat.w - 4, plat.h - 4);
    }

    // Fruits
    for (const f of this.fruits) {
      this.renderer.drawGlowCircle(f.x + 11, f.y + 11, 10, f.color, 10, true);
      ctx.fillStyle = f.accent;
      ctx.fillRect(f.x + 9, f.y - 2, 4, 5);
    }

    // Enemies
    for (const e of this.enemies) {
      const flip = e.facing > 0;
      const sprite = e.type === 'mighta' ? MIGHTA_SPRITE : ZENCHAN_SPRITE;
      const palette = {
        R: e.angry ? '#FF2A55' : '#FF8800',
        P: e.angry ? '#FF007A' : '#B829FF',
        W: '#F8FAFC',
        B: '#0B0F19',
        Y: '#FFD700',
        C: '#00F0FF'
      };
      this.renderer.drawPixelSprite(sprite, e.x, e.y, 2, palette, flip, e.state === 'FLYING');
    }

    // Enemy Projectiles
    for (const proj of this.projectiles) {
      this.renderer.drawGlowCircle(proj.x, proj.y, proj.r, PALETTE.GOLD, 10, true);
    }

    // Bubbles
    for (const b of this.bubbles) {
      const isWarning = b.lifeTimer < 2.2;
      const bubbleColor = b.trappedEnemy
        ? isWarning
          ? PALETTE.RED
          : PALETTE.PINK
        : isWarning
        ? PALETTE.ORANGE
        : PALETTE.CYAN;

      if (b.trappedEnemy) {
        const sprite = b.trappedEnemy.type === 'mighta' ? MIGHTA_SPRITE : ZENCHAN_SPRITE;
        this.renderer.drawPixelSprite(
          sprite,
          b.x - 11,
          b.y - 9,
          1.8,
          { R: '#FF8800', P: '#B829FF', W: '#FFFFFF', B: '#000000', Y: '#FFD700', C: '#00F0FF' },
          false,
          false
        );
      }

      this.renderer.drawGlowCircle(b.x, b.y, b.r, bubbleColor, 10, false, 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player (Bub)
    const p = this.player;
    if (p.invulnTimer <= 0 || Math.floor(p.invulnTimer * 12) % 2 === 0) {
      this.renderer.drawPixelSprite(
        BUB_SPRITE,
        p.x,
        p.y,
        2,
        {
          G: PALETTE.GREEN,
          W: PALETTE.WHITE,
          B: '#0B0F19',
          P: PALETTE.PINK,
          Y: PALETTE.GOLD
        },
        p.facing < 0,
        false
      );
    }

    // Particles & Score Popups
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    }
    for (const pop of this.popups) {
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HEADER,
        size: 12,
        color: pop.color,
        align: 'center',
        glow: 8
      });
    }

    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `BUBBLES: ${this.bubbles.length}`,
      accent: PALETTE.GREEN
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'NEON CAVE DRAGON BUBBLE ACTION',
      controls: 'LEFT/RIGHT: MOVE  |  Z/SPACE: BLOW BUBBLE  |  X/UP: JUMP  |  P: PAUSE',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GREEN
    });
  }
}

export default BubbleBobble;
