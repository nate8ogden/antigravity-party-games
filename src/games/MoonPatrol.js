/**
 * MoonPatrol.js
 * Classic 1982 Parallax Scrolling Lunar Buggy Shooter — Retro Arcade Studio Edition.
 * Features a 6-wheeled articulated suspension lunar buggy driving across craters, boulders,
 * and landmines with 3-layer parallax blue mountains, simultaneous forward cannon and upward
 * anti-air laser, bomb-dropping UFO saucers, and checkpoints A -> E!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const GROUND_BASE_Y = 438;
const CHECKPOINTS = ['A', 'B', 'C', 'D', 'E'];
const CHECKPOINT_DIST = 1500;

export class MoonPatrol {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'moonpatrol';
    this.title = 'Crater Buggy';
    this.width = 960;
    this.height = 540;

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.stars = [];
    for (let i = 0; i < 65; i++) {
      this.stars.push({
        x: Math.random() * 960,
        y: 45 + Math.random() * 210,
        r: Math.random() < 0.3 ? 2 : 1
      });
    }

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.particles = [];
    this.popups = [];
    this._initCourse();
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.audio.stopSequence();
  }

  _initCourse() {
    this.scrollX = 0;
    this.checkpointIdx = 0;

    const courses = [
      {
        name: 'BEGINNER COURSE A-E',
        checkpoints: ['A', 'B', 'C', 'D', 'E'],
        step: 250,
        groundCol: '#B45309',
        rimCol: PALETTE.GOLD
      },
      {
        name: 'CHAMPION COURSE F-J',
        checkpoints: ['F', 'G', 'H', 'I', 'J'],
        step: 220,
        groundCol: '#7C2D12',
        rimCol: PALETTE.ORANGE
      },
      {
        name: 'CRATER GAUNTLET K-O',
        checkpoints: ['K', 'L', 'M', 'N', 'O'],
        step: 200,
        groundCol: '#4C1D95',
        rimCol: PALETTE.PINK
      },
      {
        name: 'MINEFIELD SECTOR P-T',
        checkpoints: ['P', 'Q', 'R', 'S', 'T'],
        step: 190,
        groundCol: '#064E3B',
        rimCol: PALETTE.GREEN
      },
      {
        name: 'MASTER COURSE U-Z',
        checkpoints: ['U', 'V', 'W', 'X', 'Z'],
        step: 175,
        groundCol: '#7F1D1D',
        rimCol: PALETTE.CYAN
      }
    ];

    const courseIdx = (this.level - 1) % courses.length;
    this.currentCourse = courses[courseIdx];
    this.courseLength = CHECKPOINT_DIST * 4;

    this.buggy = {
      x: 210,
      y: GROUND_BASE_Y,
      vy: 0,
      speed: 235,
      jumping: false,
      fireCooldown: 0,
      invuln: 2.0,
      wheelPhase: 0
    };

    this.forwardShots = [];
    this.upShots = [];
    this.ufoBombs = [];
    this.ufos = [];
    this.obstacles = [];

    // Populate lunar course with course-specific Craters, Rolling Boulders, and Landmines
    const step = this.currentCourse.step;
    let idx = 0;
    for (let x = 560; x < this.courseLength + 600; x += step) {
      const roll = (idx + courseIdx) % 5;
      idx++;
      if (courseIdx === 2 && roll % 2 === 0) {
        // Crater Gauntlet K-O: Wide & double craters
        this.obstacles.push({ type: 'CRATER', x, width: 58, hp: 999, vx: 0 });
      } else if (courseIdx === 3 && roll % 2 === 1) {
        // Minefield Sector P-T: Dense landmines + boulders
        this.obstacles.push({ type: 'MINE', x, width: 24, hp: 999, vx: 0 });
        this.obstacles.push({ type: 'MINE', x: x + 78, width: 22, hp: 999, vx: 0 });
      } else if (roll === 0) {
        this.obstacles.push({ type: 'CRATER', x, width: 52, hp: 999, vx: 0 });
      } else if (roll === 1) {
        // Rolling boulder on Champion & Master courses!
        const rollingVx = courseIdx >= 1 ? -(35 + courseIdx * 12) : 0;
        this.obstacles.push({ type: 'BOULDER', x, width: 32, hp: 2, vx: rollingVx });
      } else if (roll === 2) {
        this.obstacles.push({ type: 'MINE', x, width: 22, hp: 999, vx: 0 });
      } else if (roll === 3) {
        this.obstacles.push({ type: 'CRATER', x, width: 46, hp: 999, vx: 0 });
        this.obstacles.push({ type: 'BOULDER', x: x + 92, width: 34, hp: 3, vx: 0 });
      } else {
        this.obstacles.push({ type: 'BOULDER', x, width: 36, hp: 3, vx: courseIdx >= 4 ? -55 : 0 });
      }
    }

    this.ufoSpawnTimer = Math.max(1.0, 1.6 - courseIdx * 0.15);
  }

  _surfaceHeightAt(worldX) {
    return (
      GROUND_BASE_Y +
      Math.sin(worldX * 0.014) * 7 +
      Math.cos(worldX * 0.032) * 4
    );
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
      life: 0.9
    });
  }

  _spawnExplosion(x, y, color = PALETTE.ORANGE, count = 16) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 50 + Math.random() * 150;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        color,
        life: 0.35 + Math.random() * 0.3
      });
    }
  }

  _killBuggy(reason = 'BUGGY DESTROYED!') {
    if (this.buggy.invuln > 0) return;
    this._spawnExplosion(this.buggy.x, this.buggy.y - 18, PALETTE.PINK, 26);
    this.audio.playExplosion(0.45, 680);
    this.renderer.shake(10, 0.35);
    this.lives--;

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.state = 'GAMEOVER';
      this.audio.playGameOver();
      return;
    }

    this.buggy.invuln = 2.4;
    this.buggy.jumping = true;
    this.buggy.vy = -240;
    this.popups.push({
      x: this.buggy.x,
      y: this.buggy.y - 48,
      text: reason,
      color: PALETTE.RED,
      life: 1.1
    });
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

    const b = this.buggy;
    if (b.invuln > 0) b.invuln = Math.max(0, b.invuln - dt);
    if (b.fireCooldown > 0) b.fireCooldown = Math.max(0, b.fireCooldown - dt);

    // 1. Speed Control (Left decelerates, Right accelerates)
    const axis = this.input.getAxis();
    const targetSpeed = 235 + axis.x * 95 + (this.level - 1) * 18;
    b.speed += (targetSpeed - b.speed) * 5 * dt;
    b.x = Math.max(150, Math.min(310, b.x + axis.x * 75 * dt));

    this.scrollX += b.speed * dt;
    b.wheelPhase += b.speed * dt * 0.12;

    // Checkpoints (A-E, F-J, K-O, P-T, U-Z)
    const activeCheckpoints = (this.currentCourse && this.currentCourse.checkpoints) || CHECKPOINTS;
    const newCheckpoint = Math.min(4, Math.floor(this.scrollX / CHECKPOINT_DIST));
    if (newCheckpoint > this.checkpointIdx) {
      this.checkpointIdx = newCheckpoint;
      const ptLetter = activeCheckpoints[this.checkpointIdx];
      this.audio.playPowerUp();
      this._addScore(1000, this.width * 0.5, 130, `POINT ${ptLetter} REACHED! +1000`, PALETTE.GREEN);

      if (this.checkpointIdx >= 4) {
        this.audio.playStageClear();
        this._addScore(3000, this.width * 0.5, 165, `${this.currentCourse.name} CLEAR! +3000`, PALETTE.GOLD);
        this.level++;
        this._initCourse();
        return;
      }
    }

    // 2. Jump Controls (Up or Action B)
    const groundY = this._surfaceHeightAt(this.scrollX + b.x);
    if ((this.input.isJustPressed('up') || this.input.isJustPressed('actionB')) && !b.jumping) {
      b.jumping = true;
      b.vy = -345;
      this.audio.playJump();
    }

    if (b.jumping) {
      b.y += b.vy * dt;
      b.vy += 760 * dt;
      if (b.y >= groundY) {
        b.y = groundY;
        b.vy = 0;
        b.jumping = false;
      }
    } else {
      b.y = groundY;
    }

    // 3. Simultaneous Dual Weapons (Action A): Forward Cannon + Upward Anti-Air Laser!
    if ((this.input.isDown('actionA') || this.input.pointer.down) && b.fireCooldown <= 0) {
      b.fireCooldown = 0.18;
      this.forwardShots.push({
        x: b.x + 34,
        y: b.y - 18,
        vx: 540,
        maxX: b.x + 360
      });
      this.upShots.push({
        x: b.x + 6,
        y: b.y - 28,
        vy: -640
      });
      this.audio.playLaser(980, 220, 0.08);
    }

    // 4. Update Forward Cannon Shots (destroy Boulders)
    for (let i = this.forwardShots.length - 1; i >= 0; i--) {
      const fs = this.forwardShots[i];
      fs.x += fs.vx * dt;
      if (fs.x > fs.maxX || fs.x > this.width) {
        this.forwardShots.splice(i, 1);
        continue;
      }

      let hit = false;
      for (let j = this.obstacles.length - 1; j >= 0; j--) {
        const ob = this.obstacles[j];
        if (ob.type !== 'BOULDER') continue;
        const sx = ob.x - this.scrollX;
        if (Math.abs(fs.x - sx) < ob.width * 0.65) {
          hit = true;
          ob.hp--;
          if (ob.hp <= 0) {
            const oy = this._surfaceHeightAt(ob.x);
            this._spawnExplosion(sx, oy - 12, PALETTE.GOLD, 14);
            this.audio.playExplosion(0.24, 1100);
            this._addScore(200, sx, oy - 24, '+200', PALETTE.GOLD);
            this.obstacles.splice(j, 1);
          }
          break;
        }
      }
      if (hit) this.forwardShots.splice(i, 1);
    }

    // 5. Update Upward Anti-Air Shots (destroy UFOs & Bombs)
    for (let i = this.upShots.length - 1; i >= 0; i--) {
      const us = this.upShots[i];
      us.y += us.vy * dt;
      if (us.y < 42) {
        this.upShots.splice(i, 1);
        continue;
      }

      let hit = false;
      for (let j = this.ufos.length - 1; j >= 0; j--) {
        const u = this.ufos[j];
        if (Math.hypot(us.x - u.x, us.y - u.y) < 24) {
          hit = true;
          this._spawnExplosion(u.x, u.y, PALETTE.CYAN, 16);
          this.audio.playExplosion(0.26, 1200);
          this._addScore(300, u.x, u.y, 'UFO +300', PALETTE.CYAN);
          this.ufos.splice(j, 1);
          break;
        }
      }
      if (hit) this.upShots.splice(i, 1);
    }

    // 6. Spawn & Update UFO Saucers
    this.ufoSpawnTimer -= dt;
    if (this.ufoSpawnTimer <= 0) {
      this.ufoSpawnTimer = Math.max(1.5, 3.0 - this.level * 0.25);
      if (this.ufos.length < 3 + this.level) {
        this.ufos.push({
          x: this.width + 30,
          y: 95 + Math.random() * 90,
          targetX: 160 + Math.random() * 520,
          phase: Math.random() * 6,
          bombTimer: 1.1 + Math.random() * 1.2
        });
      }
    }

    for (const u of this.ufos) {
      u.phase += dt * 4;
      u.x += (u.targetX - u.x) * 2.2 * dt + Math.cos(u.phase) * 55 * dt;
      u.y += Math.sin(u.phase * 1.3) * 28 * dt;
      u.bombTimer -= dt;
      if (u.bombTimer <= 0) {
        u.bombTimer = 1.8 + Math.random() * 1.2;
        this.ufoBombs.push({
          x: u.x,
          y: u.y + 10,
          vx: -65,
          vy: 165
        });
      }
    }

    // 7. Update UFO Bombs (can blast new craters into the moon surface!)
    for (let i = this.ufoBombs.length - 1; i >= 0; i--) {
      const bm = this.ufoBombs[i];
      bm.x += bm.vx * dt;
      bm.y += bm.vy * dt;
      bm.vy += 180 * dt;

      if (Math.hypot(bm.x - b.x, bm.y - (b.y - 16)) < 26) {
        this.ufoBombs.splice(i, 1);
        this._killBuggy('HIT BY UFO BOMB!');
        continue;
      }

      const gy = this._surfaceHeightAt(this.scrollX + bm.x);
      if (bm.y >= gy) {
        this._spawnExplosion(bm.x, gy, PALETTE.ORANGE, 10);
        // Bomb blasts a fresh crater if ahead of buggy!
        if (bm.x > b.x + 80) {
          this.obstacles.push({
            type: 'CRATER',
            x: this.scrollX + bm.x,
            width: 40,
            hp: 999
          });
        }
        this.ufoBombs.splice(i, 1);
      }
    }

    // 8. Check Ground Obstacles (Craters, Rolling Boulders, Landmines)
    for (const ob of this.obstacles) {
      if (ob.vx && ob.x - this.scrollX < this.width + 60) {
        ob.x += ob.vx * dt;
      }
      const sx = ob.x - this.scrollX;
      if (Math.abs(sx - b.x) < ob.width * 0.5 + 18) {
        const clearance = groundY - b.y;
        if (clearance < 16) {
          this._killBuggy(ob.type === 'CRATER' ? 'FELL IN CRATER!' : `HIT ${ob.type}!`);
          break;
        }
      }
    }

    // 9. Particles & Popups
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
  }

  _drawMountainLayer(ctx, scrollFactor, baseY, amp, freq, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_BASE_Y + 40);
    for (let x = 0; x <= this.width; x += 24) {
      const wx = x + this.scrollX * scrollFactor;
      const y = baseY - Math.abs(Math.sin(wx * freq)) * amp - Math.cos(wx * freq * 2.1) * (amp * 0.35);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(this.width, GROUND_BASE_Y + 40);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear('#050814');

    // 1. Stars & Rising Earth in the Sky
    for (const s of this.stars) {
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    this.renderer.drawGlowCircle(790, 120, 26, PALETTE.BLUE, 14, true);
    ctx.fillStyle = PALETTE.GREEN;
    ctx.fillRect(780, 112, 14, 10);
    ctx.fillRect(794, 124, 10, 8);

    // 2. 3-Layer Parallax Blue Lunar Mountains
    this._drawMountainLayer(ctx, 0.12, 365, 95, 0.004, '#0F172A');
    this._drawMountainLayer(ctx, 0.25, 392, 65, 0.007, '#1E3A8A');
    this._drawMountainLayer(ctx, 0.45, 415, 38, 0.012, '#1D4ED8');

    // 3. Lunar Regolith Surface
    const course = this.currentCourse || {
      name: 'BEGINNER COURSE A-E',
      checkpoints: CHECKPOINTS,
      groundCol: '#B45309',
      rimCol: PALETTE.GOLD
    };
    ctx.save();
    ctx.fillStyle = course.groundCol;
    ctx.beginPath();
    ctx.moveTo(0, this.height);
    for (let x = 0; x <= this.width; x += 12) {
      const y = this._surfaceHeightAt(this.scrollX + x);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(this.width, this.height);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = course.rimCol;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 0; x <= this.width; x += 12) {
      const y = this._surfaceHeightAt(this.scrollX + x);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // 4. Craters, Boulders, and Landmines
    for (const ob of this.obstacles) {
      const sx = ob.x - this.scrollX;
      if (sx < -60 || sx > this.width + 60) continue;
      const sy = this._surfaceHeightAt(ob.x);

      if (ob.type === 'CRATER') {
        ctx.fillStyle = '#050814';
        ctx.beginPath();
        ctx.moveTo(sx - ob.width * 0.5, sy - 3);
        ctx.lineTo(sx - ob.width * 0.3, sy + 26);
        ctx.lineTo(sx + ob.width * 0.3, sy + 26);
        ctx.lineTo(sx + ob.width * 0.5, sy - 3);
        ctx.closePath();
        ctx.fill();
      } else if (ob.type === 'BOULDER') {
        ctx.fillStyle = '#64748B';
        ctx.strokeStyle = PALETTE.WHITE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy - 14, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (ob.type === 'MINE') {
        this.renderer.drawGlowRect(sx - 8, sy - 10, 16, 10, PALETTE.RED, 10, true);
      }
    }

    // 5. 6-Wheeled Articulated Suspension Lunar Buggy!
    const b = this.buggy;
    if (b.invuln <= 0 || Math.floor(b.invuln * 14) % 2 === 0) {
      const wheelOffsets = [-22, 0, 22];
      const wheelYs = wheelOffsets.map((ox) => {
        if (b.jumping) return b.y + 2;
        return this._surfaceHeightAt(this.scrollX + b.x + ox);
      });
      const avgWheelY = (wheelYs[0] + wheelYs[1] + wheelYs[2]) / 3;
      const tilt = Math.atan2(wheelYs[2] - wheelYs[0], 44);
      const chassisY = (b.jumping ? b.y : avgWheelY) - 20 + Math.sin(b.wheelPhase) * 1.5;

      // Draw Suspension Struts & 3 Independent Bouncing Wheels
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const wx = b.x + wheelOffsets[i];
        const wy = wheelYs[i] - 7;
        ctx.strokeStyle = PALETTE.CYAN;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(wx, chassisY + 4);
        ctx.lineTo(wx, wy);
        ctx.stroke();

        this.renderer.drawGlowCircle(wx, wy, 8.5, '#1E293B', 4, true);
        ctx.strokeStyle = PALETTE.WHITE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wx, wy, 8.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Articulated Pink/Cyan Buggy Chassis & Turret Canopy
      ctx.translate(b.x, chassisY);
      ctx.rotate(tilt * 0.65);
      this.renderer.drawGlowRect(-30, -8, 60, 14, PALETTE.PINK, 10, true);
      this.renderer.drawGlowRect(-14, -18, 26, 10, PALETTE.CYAN, 8, true);
      // Forward & Upward Gun Barrels
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(14, -6, 20, 4);
      ctx.fillRect(2, -26, 4, 10);
      ctx.restore();
    }

    // 6. UFO Saucers & Projectiles
    for (const u of this.ufos) {
      ctx.save();
      ctx.translate(u.x, u.y);
      this.renderer.drawGlowCircle(0, -4, 9, PALETTE.CYAN, 8, true);
      ctx.fillStyle = PALETTE.PURPLE;
      ctx.beginPath();
      ctx.ellipse(0, 2, 20, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const fs of this.forwardShots) {
      this.renderer.drawGlowRect(fs.x - 6, fs.y - 2, 12, 4, PALETTE.GOLD, 8, true);
    }
    for (const us of this.upShots) {
      this.renderer.drawGlowRect(us.x - 2, us.y - 7, 4, 14, PALETTE.CYAN, 8, true);
    }
    for (const bm of this.ufoBombs) {
      this.renderer.drawGlowCircle(bm.x, bm.y, 4.5, PALETTE.RED, 8, true);
    }

    // 7. Particles & Popups
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    }
    for (const pop of this.popups) {
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HEADER,
        size: 11,
        color: pop.color,
        align: 'center',
        glow: 8
      });
    }

    // 8. Course Checkpoint Progress Bar (A — B — C — D — E)
    const barX = 310;
    const barY = 58;
    const barW = 340;
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = PALETTE.PINK;
    ctx.lineWidth = 2;
    ctx.fillRect(barX, barY, barW, 24);
    ctx.strokeRect(barX, barY, barW, 24);

    const prog = Math.min(1, this.scrollX / this.courseLength);
    this.renderer.drawGlowRect(barX + 2, barY + 2, prog * (barW - 4), 20, 'rgba(0, 240, 255, 0.35)', 6, true);

    const activeCheckpoints = course.checkpoints || CHECKPOINTS;
    for (let i = 0; i < activeCheckpoints.length; i++) {
      const cx = barX + 16 + i * ((barW - 32) / 4);
      const reached = i <= this.checkpointIdx;
      this.renderer.drawText(activeCheckpoints[i], cx, barY + 17, {
        font: FONTS.HEADER,
        size: 11,
        color: reached ? PALETTE.GOLD : PALETTE.MUTED,
        align: 'center',
        glow: reached ? 8 : 0
      });
    }
    this.renderer.drawText(course.name, barX + barW * 0.5, barY + 38, {
      font: FONTS.HEADER,
      size: 9,
      color: course.rimCol,
      align: 'center'
    });
    ctx.restore();

    // 9. Top HUD & State Overlay
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `POINT:${activeCheckpoints[this.checkpointIdx]}`,
      accent: PALETTE.PINK
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1982 LUNAR BUGGY PARALLAX SHOOTER',
      controls: 'LEFT/RIGHT: SPEED  |  UP/X: JUMP CRATERS  |  Z/SPACE: DUAL CANNON & LASER',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.PINK
    });
  }
}

export default MoonPatrol;
