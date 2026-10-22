/**
 * Arkanoid.js
 * Classic 1986 Vaus Brick Breaker — Retro Arcade Studio Edition.
 * Features offset-angle paddle reflection physics, multi-hit Silver & Gold bricks,
 * and falling power-up capsules: [E] Expand, [M] Multiball, [L] Dual Laser, [S] Slow.
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const WALL_LEFT = 120;
const WALL_RIGHT = 840;
const WALL_TOP = 52;
const BRICK_COLS = 12;
const BRICK_W = 56;
const BRICK_H = 22;
const BRICK_GAP = 4;
const GRID_START_X = WALL_LEFT + 14;
const GRID_START_Y = 86;

const CAPSULE_TYPES = [
  { code: 'E', label: 'EXPAND PRISM', color: PALETTE.BLUE },
  { code: 'M', label: 'MULTIBALL X3', color: PALETTE.CYAN },
  { code: 'L', label: 'LASER CANNONS', color: PALETTE.RED },
  { code: 'S', label: 'SLOW ENERGY', color: PALETTE.ORANGE }
];

export class Arkanoid {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'arkanoid';
    this.title = 'Prism Breaker';
    this.width = 960;
    this.height = 540;

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.lastPointerX = 480;
    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.capsules = [];
    this.lasers = [];
    this.particles = [];
    this.popups = [];

    this._initPaddle();
    this._spawnBallOnPaddle();
    this._buildFortress(this.level);
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.audio.stopSequence();
  }

  _initPaddle() {
    this.paddle = {
      x: (WALL_LEFT + WALL_RIGHT) / 2,
      y: 502,
      baseWidth: 104,
      width: 104,
      height: 14,
      vx: 0,
      laserEnabled: false,
      laserCooldown: 0
    };
  }

  _spawnBallOnPaddle() {
    this.balls = [
      {
        x: this.paddle.x,
        y: this.paddle.y - 14,
        vx: 220,
        vy: -310,
        speed: 370 + (this.level - 1) * 18,
        radius: 6.5,
        stuck: true
      }
    ];
  }

  _buildFortress(level) {
    this.bricks = [];
    const rowColors = [
      PALETTE.RED,
      PALETTE.ORANGE,
      PALETTE.GOLD,
      PALETTE.GREEN,
      PALETTE.CYAN,
      PALETTE.BLUE,
      PALETTE.PINK,
      PALETTE.PURPLE
    ];
    const variant = (level - 1) % 12;
    const silverHp = 2 + Math.floor((level - 1) / 12);

    const addBrick = (r, c, type = 'NORMAL', customColor = null) => {
      let hp = 1;
      let color = customColor || rowColors[(r + variant) % rowColors.length];
      let pts = (10 - r) * 15 + 50;

      if (type === 'GOLD') {
        hp = 3;
        color = PALETTE.GOLD;
        pts = 250;
      } else if (type === 'SILVER') {
        hp = silverHp;
        color = '#CBD5E1';
        pts = 120;
      }

      this.bricks.push({
        x: GRID_START_X + c * (BRICK_W + BRICK_GAP),
        y: GRID_START_Y + r * (BRICK_H + BRICK_GAP),
        w: BRICK_W,
        h: BRICK_H,
        type,
        hp,
        maxHp: hp,
        color,
        pts,
        flashTimer: 0
      });
    };

    if (variant === 0) {
      // Round 1: Classic Silver + 5 Rainbow Rows
      const rainbow = ['#CBD5E1', PALETTE.RED, PALETTE.GOLD, PALETTE.BLUE, PALETTE.PINK, PALETTE.GREEN];
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
          addBrick(r, c, r === 0 ? 'SILVER' : 'NORMAL', rainbow[r]);
        }
      }
    } else if (variant === 1) {
      // Round 2: Diagonal Staircase Wedge ending in Silver bottom row
      for (let r = 0; r < 9; r++) {
        const maxCol = Math.min(BRICK_COLS - 1, r + 3);
        for (let c = 0; c <= maxCol; c++) {
          const type = r === 8 && c < maxCol ? 'SILVER' : c === 0 && r === 0 ? 'GOLD' : 'NORMAL';
          addBrick(r, c, type, rowColors[c % rowColors.length]);
        }
      }
    } else if (variant === 2) {
      // Round 3: Horizontal Gold-Brick Channels
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
          if (r % 2 === 1) {
            if (r === 1 && c >= 3 && c <= 11) addBrick(r, c, 'GOLD');
            else if (r === 3 && c >= 0 && c <= 8) addBrick(r, c, 'GOLD');
            else if (r === 5 && c >= 3 && c <= 11) addBrick(r, c, 'GOLD');
            else if (r === 7 && c >= 2 && c <= 9) addBrick(r, c, 'SILVER');
          } else {
            addBrick(r, c, 'NORMAL', rowColors[(r / 2) % rowColors.length]);
          }
        }
      }
    } else if (variant === 3) {
      // Round 4: Twin Split Columns with central corridor
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
          if (c === 0 || c === 5 || c === 6 || c === 11) continue;
          const type = r === 0 || r === 7 ? 'SILVER' : (r === 3 && (c === 2 || c === 9)) ? 'GOLD' : 'NORMAL';
          addBrick(r, c, type, rowColors[(c + r) % rowColors.length]);
        }
      }
    } else if (variant === 4) {
      // Round 5: Space Invader Alien Pixel Shape made of colored bricks!
      const invaderRows = [
        '..G......G..',
        '...C....C...',
        '..GGGGGGGG..',
        '.GGGRGGRGGG.',
        'CCCCCCCCCCCC',
        'C.CCCCCCCC.C',
        'C.C......C.C',
        '...SS..SS...'
      ];
      for (let r = 0; r < invaderRows.length; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
          const ch = invaderRows[r][c];
          if (ch === '.') continue;
          if (ch === 'G') addBrick(r, c, r === 0 ? 'GOLD' : 'NORMAL', PALETTE.GREEN);
          else if (ch === 'R') addBrick(r, c, 'GOLD', PALETTE.RED);
          else if (ch === 'S') addBrick(r, c, 'SILVER');
          else addBrick(r, c, 'NORMAL', PALETTE.CYAN);
        }
      }
    } else if (variant === 5) {
      // Round 6: Gold-Guarded Diamond Vault
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
          const dist = Math.abs(c - 5.5) + Math.abs(r - 3.5);
          if (dist > 5.5) continue;
          let type = 'NORMAL';
          if (dist >= 4.5) type = 'SILVER';
          else if (dist <= 1.5) type = 'GOLD';
          addBrick(r, c, type, rowColors[r % rowColors.length]);
        }
      }
    } else if (variant === 6) {
      // Round 7: Zig-Zag Chevron Matrix
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
          const wave = Math.abs((c % 6) - 2.5);
          if (Math.abs(r - wave * 2) > 2.2) continue;
          const type = r === 0 ? 'GOLD' : r === 7 ? 'SILVER' : 'NORMAL';
          addBrick(r, c, type, rowColors[(r + c) % rowColors.length]);
        }
      }
    } else if (variant === 7) {
      // Round 8: Octagonal Cyber Reactor
      for (let r = 0; r < 8; r++) {
        for (let c = 1; c < BRICK_COLS - 1; c++) {
          if ((r === 0 || r === 7) && (c === 1 || c === 10)) continue;
          const isOuter = r === 0 || r === 7 || c === 1 || c === 10;
          const isCore = r >= 3 && r <= 4 && c >= 5 && c <= 6;
          const type = isCore ? 'GOLD' : isOuter ? 'SILVER' : 'NORMAL';
          addBrick(r, c, type, isCore ? PALETTE.GOLD : PALETTE.PINK);
        }
      }
    } else if (variant === 8) {
      // Round 9: Dual Pyramid Citadels
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
          const leftDist = Math.abs(c - 2.5);
          const rightDist = Math.abs(c - 8.5);
          if (leftDist > r * 0.5 + 0.5 && rightDist > r * 0.5 + 0.5) continue;
          const type = r === 0 ? 'GOLD' : r === 6 ? 'SILVER' : 'NORMAL';
          addBrick(r, c, type, rowColors[r % rowColors.length]);
        }
      }
    } else if (variant === 9) {
      // Round 10: Checkerboard Prism Lattice
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
          if ((r + c) % 2 === 1) continue;
          const type = r === 0 ? 'GOLD' : r === 7 ? 'SILVER' : 'NORMAL';
          addBrick(r, c, type, rowColors[(r + c) % rowColors.length]);
        }
      }
    } else if (variant === 10) {
      // Round 11: Fortress Bastion (Silver wall with Gold battlements & rainbow treasury)
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
          if (r === 1 && c % 2 === 1) continue;
          let type = 'NORMAL';
          if (r === 0 && c % 2 === 0) type = 'GOLD';
          else if (r === 7 && c !== 5 && c !== 6) type = 'SILVER';
          else if ((c === 0 || c === 11) && r < 7) type = 'SILVER';
          addBrick(r, c, type, rowColors[r % rowColors.length]);
        }
      }
    } else {
      // Round 12: DOH's Dimensional Labyrinth
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
          if ((c === 3 || c === 8) && r >= 1 && r <= 6) continue;
          const type =
            (r === 0 || r === 7) && (c === 4 || c === 7)
              ? 'GOLD'
              : r === 0 || r === 7 || c === 0 || c === 11
              ? 'SILVER'
              : 'NORMAL';
          addBrick(r, c, type, rowColors[(r * 2 + c) % rowColors.length]);
        }
      }
    }
  }

  _addScore(pts, x = null, y = null, label = null, color = PALETTE.GOLD) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    if (x !== null && y !== null) {
      this.popups.push({
        x,
        y,
        text: label || `+${pts}`,
        color,
        life: 0.85
      });
    }
  }

  _spawnSparks(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 150;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        color,
        life: 0.25 + Math.random() * 0.25
      });
    }
  }

  _damageBrick(index) {
    const b = this.bricks[index];
    b.hp--;
    b.flashTimer = 0.12;

    if (b.hp <= 0) {
      this.bricks.splice(index, 1);
      this._addScore(b.pts, b.x + b.w / 2, b.y + b.h / 2, `+${b.pts}`, b.color);
      this.audio.playCoin();
      this._spawnSparks(b.x + b.w / 2, b.y + b.h / 2, b.color, 12);

      // 24% chance to drop a Power-Up Capsule
      if (Math.random() < 0.24 && this.capsules.length < 3) {
        const capDef = CAPSULE_TYPES[Math.floor(Math.random() * CAPSULE_TYPES.length)];
        this.capsules.push({
          x: b.x + b.w / 2,
          y: b.y + b.h / 2,
          vy: 145,
          code: capDef.code,
          label: capDef.label,
          color: capDef.color,
          phase: 0
        });
      }
    } else {
      // Metallic clang for Silver/Gold multi-hit bricks
      this.audio.playNote(b.type === 'GOLD' ? 880 : 660, 0.06, 'triangle', 0.25);
      this._spawnSparks(b.x + b.w / 2, b.y + b.h / 2, PALETTE.WHITE, 5);
    }
  }

  _applyCapsule(cap) {
    this.audio.playPowerUp();
    this._addScore(250, cap.x, cap.y - 10, cap.label, cap.color);

    if (cap.code === 'E') {
      this.paddle.width = Math.min(168, this.paddle.baseWidth * 1.5);
      this.paddle.laserEnabled = false;
    } else if (cap.code === 'L') {
      this.paddle.laserEnabled = true;
      this.paddle.width = this.paddle.baseWidth;
    } else if (cap.code === 'S') {
      for (const ball of this.balls) {
        ball.speed = Math.max(270, ball.speed * 0.76);
        const curSpd = Math.hypot(ball.vx, ball.vy) || 1;
        ball.vx = (ball.vx / curSpd) * ball.speed;
        ball.vy = (ball.vy / curSpd) * ball.speed;
      }
    } else if (cap.code === 'M') {
      const source = this.balls[0];
      if (source) {
        source.stuck = false;
        const baseAng = Math.atan2(source.vy, source.vx);
        const angles = [baseAng - 0.38, baseAng + 0.38];
        for (const a of angles) {
          if (this.balls.length < 5) {
            this.balls.push({
              x: source.x,
              y: source.y,
              vx: Math.cos(a) * source.speed,
              vy: Math.sin(a) * source.speed,
              speed: source.speed,
              radius: source.radius,
              stuck: false
            });
          }
        }
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
      if (this.input.isJustPressed('actionA')) {
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

    const p = this.paddle;
    const prevX = p.x;
    const paddleSpeed = 520;

    if (this.input.isDown('left')) {
      p.x -= paddleSpeed * dt;
    } else if (this.input.isDown('right')) {
      p.x += paddleSpeed * dt;
    } else if (Math.abs(this.input.pointer.x - this.lastPointerX) > 0.5 || this.input.pointer.down) {
      this.lastPointerX = this.input.pointer.x;
      p.x += (this.input.pointer.x - p.x) * Math.min(1, dt * 18);
    }

    const halfW = p.width / 2;
    p.x = Math.max(WALL_LEFT + halfW + 4, Math.min(WALL_RIGHT - halfW - 4, p.x));
    p.vx = (p.x - prevX) / Math.max(0.001, dt);

    if (p.laserCooldown > 0) p.laserCooldown = Math.max(0, p.laserCooldown - dt);

    // Launch ball or Fire Dual Lasers
    if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
      let launchedAny = false;
      for (const ball of this.balls) {
        if (ball.stuck) {
          ball.stuck = false;
          ball.vx = ball.speed * 0.42;
          ball.vy = -ball.speed * 0.9;
          launchedAny = true;
          this.audio.playJump();
        }
      }
      if (!launchedAny && p.laserEnabled && p.laserCooldown <= 0) {
        p.laserCooldown = 0.22;
        this.lasers.push(
          { x: p.x - halfW + 10, y: p.y - 8, vy: -640 },
          { x: p.x + halfW - 10, y: p.y - 8, vy: -640 }
        );
        this.audio.playLaser(1400, 420, 0.08);
      }
    }

    // Update Dual Lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.y += l.vy * dt;
      if (l.y < WALL_TOP) {
        this.lasers.splice(i, 1);
        continue;
      }
      for (let bIdx = this.bricks.length - 1; bIdx >= 0; bIdx--) {
        const br = this.bricks[bIdx];
        if (l.x >= br.x && l.x <= br.x + br.w && l.y >= br.y && l.y <= br.y + br.h) {
          this.lasers.splice(i, 1);
          this._damageBrick(bIdx);
          break;
        }
      }
    }

    // Update Balls
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      if (ball.stuck) {
        ball.x = p.x + 12;
        ball.y = p.y - p.height / 2 - ball.radius - 1;
        continue;
      }

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Arena Wall Bounces
      if (ball.x - ball.radius < WALL_LEFT) {
        ball.x = WALL_LEFT + ball.radius;
        ball.vx = Math.abs(ball.vx);
        this.audio.playHop();
      } else if (ball.x + ball.radius > WALL_RIGHT) {
        ball.x = WALL_RIGHT - ball.radius;
        ball.vx = -Math.abs(ball.vx);
        this.audio.playHop();
      }

      if (ball.y - ball.radius < WALL_TOP) {
        ball.y = WALL_TOP + ball.radius;
        ball.vy = Math.abs(ball.vy);
        this.audio.playHop();
      }

      // Vaus Paddle Offset Reflection Physics
      if (
        ball.vy > 0 &&
        ball.y + ball.radius >= p.y - p.height / 2 &&
        ball.y - ball.radius <= p.y + p.height / 2 + 6 &&
        ball.x >= p.x - halfW - ball.radius &&
        ball.x <= p.x + halfW + ball.radius
      ) {
        const hitOffset = Math.max(-1, Math.min(1, (ball.x - p.x) / halfW));
        // Bounce angle from -65 deg to +65 deg relative to straight up (-PI/2)
        const maxBounceAngle = (65 * Math.PI) / 180;
        const bounceAngle = hitOffset * maxBounceAngle;

        ball.speed = Math.min(540, ball.speed + 3.5);
        ball.vx = Math.sin(bounceAngle) * ball.speed + p.vx * 0.12;
        ball.vy = -Math.cos(bounceAngle) * ball.speed;

        // Normalize to ball.speed
        const norm = Math.hypot(ball.vx, ball.vy) || 1;
        ball.vx = (ball.vx / norm) * ball.speed;
        ball.vy = Math.min(-140, (ball.vy / norm) * ball.speed);

        ball.y = p.y - p.height / 2 - ball.radius - 1;
        this.audio.playNote(480, 0.055, 'square', 0.24);
        this._spawnSparks(ball.x, ball.y, PALETTE.CYAN, 6);
      }

      // Brick Collisions
      for (let bIdx = this.bricks.length - 1; bIdx >= 0; bIdx--) {
        const br = this.bricks[bIdx];
        const closestX = Math.max(br.x, Math.min(ball.x, br.x + br.w));
        const closestY = Math.max(br.y, Math.min(ball.y, br.y + br.h));
        const dx = ball.x - closestX;
        const dy = ball.y - closestY;

        if (dx * dx + dy * dy <= ball.radius * ball.radius) {
          const overlapX = Math.min(Math.abs(ball.x - br.x), Math.abs(ball.x - (br.x + br.w)));
          const overlapY = Math.min(Math.abs(ball.y - br.y), Math.abs(ball.y - (br.y + br.h)));

          if (overlapX < overlapY) {
            ball.vx = -ball.vx;
          } else {
            ball.vy = -ball.vy;
          }
          this._damageBrick(bIdx);
          break;
        }
      }

      // Bottom Pit Check
      if (ball.y - ball.radius > this.height) {
        this.balls.splice(i, 1);
      }
    }

    // Check if all balls lost
    if (this.balls.length === 0) {
      this.lives--;
      this.audio.playExplosion(0.45, 700);
      this.renderer.shake(8, 0.28);
      if (this.lives <= 0) {
        HighScoreStore.submit(this.id, this.score);
        this.state = 'GAMEOVER';
        this.audio.playGameOver();
        return;
      }
      this._initPaddle();
      this._spawnBallOnPaddle();
    }

    // Update Falling Power-Up Capsules
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const cap = this.capsules[i];
      cap.y += cap.vy * dt;
      cap.phase += dt * 10;

      // Caught by Vaus Paddle
      if (
        cap.y + 10 >= p.y - p.height / 2 &&
        cap.y - 10 <= p.y + p.height / 2 &&
        cap.x >= p.x - halfW - 14 &&
        cap.x <= p.x + halfW + 14
      ) {
        this._applyCapsule(cap);
        this.capsules.splice(i, 1);
        continue;
      }

      if (cap.y > this.height + 20) {
        this.capsules.splice(i, 1);
      }
    }

    // Brick flash timers
    for (const br of this.bricks) {
      if (br.flashTimer > 0) br.flashTimer = Math.max(0, br.flashTimer - dt);
    }

    // Particles & Popups
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 28 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }

    // Stage Clear Check
    if (this.bricks.length === 0) {
      this.level++;
      this.audio.playStageClear();
      this.capsules = [];
      this.lasers = [];
      this._initPaddle();
      this._spawnBallOnPaddle();
      this._buildFortress(this.level);
    }
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear(PALETTE.BG);

    // Hex-grid cyber background inside playfield walls
    ctx.fillStyle = '#0D1426';
    ctx.fillRect(WALL_LEFT, WALL_TOP, WALL_RIGHT - WALL_LEFT, this.height - WALL_TOP);

    // Glowing Fortress Border Walls
    ctx.save();
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.shadowColor = PALETTE.CYAN;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(WALL_LEFT, this.height);
    ctx.lineTo(WALL_LEFT, WALL_TOP);
    ctx.lineTo(WALL_RIGHT, WALL_TOP);
    ctx.lineTo(WALL_RIGHT, this.height);
    ctx.stroke();
    ctx.restore();

    // Side Legend Panels
    this.renderer.drawText('CAPSULES', 20, 85, {
      font: FONTS.HEADER,
      size: 10,
      color: PALETTE.GOLD
    });
    CAPSULE_TYPES.forEach((c, idx) => {
      const y = 115 + idx * 34;
      this.renderer.drawGlowRect(20, y - 11, 24, 14, c.color, 6, true);
      this.renderer.drawText(c.code, 32, y, {
        font: FONTS.HEADER,
        size: 9,
        color: PALETTE.BG,
        align: 'center'
      });
      this.renderer.drawText(c.code === 'E' ? 'EXPAND' : c.code === 'M' ? 'MULTI' : c.code === 'L' ? 'LASER' : 'SLOW', 50, y, {
        font: FONTS.HUD,
        size: 12,
        color: PALETTE.WHITE
      });
    });

    // Render Bricks
    for (const br of this.bricks) {
      const color = br.flashTimer > 0 ? PALETTE.WHITE : br.color;
      this.renderer.drawGlowRect(br.x, br.y, br.w, br.h, color, br.type === 'GOLD' ? 10 : 6, true);

      // Bevel highlight & armor pips on Silver/Gold bricks
      ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
      ctx.fillRect(br.x + 2, br.y + 2, br.w - 4, 3);

      if (br.maxHp > 1) {
        ctx.strokeStyle = PALETTE.BG;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(br.x + 3, br.y + 3, br.w - 6, br.h - 6);
        for (let h = 0; h < br.hp; h++) {
          ctx.fillStyle = PALETTE.BG;
          ctx.fillRect(br.x + 8 + h * 8, br.y + br.h / 2 - 2, 4, 4);
        }
      }
    }

    // Render Falling Power-Up Capsules
    for (const cap of this.capsules) {
      ctx.save();
      ctx.translate(cap.x, cap.y);
      this.renderer.drawGlowRect(-15, -8, 30, 16, cap.color, 10, true);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillRect(-12, -5 + Math.sin(cap.phase) * 2, 24, 3);
      this.renderer.drawText(cap.code, 0, 4, {
        font: FONTS.HEADER,
        size: 10,
        color: PALETTE.BG,
        align: 'center'
      });
      ctx.restore();
    }

    // Render Vaus Space Vessel Paddle
    const p = this.paddle;
    const halfW = p.width / 2;
    ctx.save();
    ctx.translate(p.x, p.y);
    // Metallic core
    this.renderer.drawGlowRect(-halfW + 10, -p.height / 2, p.width - 20, p.height, PALETTE.CYAN, 10, true);
    // Glowing red/orange side pods
    const podColor = p.laserEnabled ? PALETTE.RED : PALETTE.PINK;
    this.renderer.drawGlowRect(-halfW, -p.height / 2 + 1, 12, p.height - 2, podColor, 8, true);
    this.renderer.drawGlowRect(halfW - 12, -p.height / 2 + 1, 12, p.height - 2, podColor, 8, true);

    if (p.laserEnabled) {
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(-halfW + 8, -p.height / 2 - 5, 4, 5);
      ctx.fillRect(halfW - 12, -p.height / 2 - 5, 4, 5);
    }
    ctx.restore();

    // Render Dual Lasers
    for (const l of this.lasers) {
      this.renderer.drawGlowRect(l.x - 2, l.y - 8, 4, 16, PALETTE.RED, 8, true);
    }

    // Render Energy Balls
    for (const ball of this.balls) {
      this.renderer.drawGlowCircle(ball.x, ball.y, ball.radius, PALETTE.WHITE, 12, true);
    }

    // Render Particles & Popups
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
    }
    for (const pop of this.popups) {
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HUD,
        size: 13,
        color: pop.color,
        align: 'center',
        glow: 8
      });
    }

    // Top HUD
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `BRICKS: ${this.bricks.length}`,
      accent: PALETTE.CYAN
    });

    // State Overlay
    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'PRISM FORTRESS BRICK BREAKER',
      controls: 'LEFT/RIGHT OR MOUSE: STEER PRISM  |  Z/SPACE/CLICK: LAUNCH & FIRE LASERS',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.CYAN
    });
  }
}

export default Arkanoid;
