/**
 * Centipede.js
 * Classic 1981 Bug Blaster Shooter — Retro Arcade Studio Edition.
 * Features a 4-hit destructible neon mushroom field, splitting multi-segment centipede chains,
 * poisoned mushrooms, bouncing Spider, mushroom-dropping Flea, and scurrying Scorpion.
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const CELL = 20;
const COLS = 48; // 48 * 20 = 960
const ROWS = 24; // rows 0..23 starting at y = 40 -> y = 40..520
const ARENA_TOP = 40;
const PLAYER_ZONE_TOP = 390;
const PLAYER_ZONE_BOTTOM = 524;

export class Centipede {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'centipede';
    this.title = 'Mycelium Crawler';
    this.width = 960;
    this.height = 540;

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.nextExtraLife = 12000;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.nextExtraLife = 12000;

    this.mushrooms = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.bullets = [];
    this.segments = [];
    this.particles = [];
    this.popups = [];
    this.spider = null;
    this.flea = null;
    this.scorpion = null;

    this.spiderTimer = 5.5;
    this.fleaTimer = 7.0;
    this.scorpionTimer = 11.0;
    this.stepSoundTimer = 0;

    this._initMushrooms();
    this._spawnPlayer();
    this._spawnCentipedeWave(this.level);
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.audio.stopSequence();
  }

  _initMushrooms() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.mushrooms[r][c] = null;
      }
    }
    const count = 42;
    for (let i = 0; i < count; i++) {
      const r = 1 + Math.floor(Math.random() * (ROWS - 4));
      const c = 1 + Math.floor(Math.random() * (COLS - 2));
      this.mushrooms[r][c] = { hp: 4, poisoned: false };
    }
  }

  _spawnPlayer() {
    this.player = {
      x: this.width / 2,
      y: 500,
      radius: 9,
      fireCooldown: 0,
      invuln: 2.0,
      dead: false,
      respawnTimer: 0
    };
  }

  _spawnCentipedeWave(level) {
    this.segments = [];
    const chainLen = Math.max(4, 12 - ((level - 1) % 5));
    const extraHeads = Math.min(4, Math.floor((level - 1) / 2));
    const speed = 135 + level * 14;
    const startCol = Math.floor(COLS / 2);

    // Main chain entering at top row (r = 0)
    for (let i = 0; i < chainLen; i++) {
      const c = startCol - i;
      this.segments.push({
        id: i + 1,
        x: c * CELL + CELL / 2,
        y: ARENA_TOP + CELL / 2,
        row: 0,
        dir: 1,
        vertDir: 1, // 1 = moving down rows, -1 = moving up in player zone
        isHead: i === 0,
        leaderId: i === 0 ? null : i,
        speed,
        poisonDive: false,
        animPhase: i * 0.5
      });
    }

    // Fast independent heads on higher waves
    for (let h = 0; h < extraHeads; h++) {
      const side = h % 2 === 0 ? 1 : COLS - 2;
      this.segments.push({
        id: 100 + h,
        x: side * CELL + CELL / 2,
        y: ARENA_TOP + CELL + CELL / 2,
        row: 1,
        dir: h % 2 === 0 ? 1 : -1,
        vertDir: 1,
        isHead: true,
        leaderId: null,
        speed: speed * 1.18,
        poisonDive: false,
        animPhase: h
      });
    }
  }

  _addScore(pts, x = null, y = null, color = PALETTE.GOLD) {
    this.score += pts;
    if (this.score >= this.nextExtraLife) {
      this.lives = Math.min(6, this.lives + 1);
      this.nextExtraLife += 12000;
      this.audio.playPowerUp();
    }
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    if (x !== null && y !== null) {
      this.popups.push({ x, y, text: `${pts}`, color, life: 0.85 });
    }
  }

  _spawnSparks(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        color,
        life: 0.25 + Math.random() * 0.25,
        maxLife: 0.5
      });
    }
  }

  _setMushroom(r, c, poisoned = false) {
    if (r >= 0 && r < ROWS - 1 && c >= 0 && c < COLS) {
      this.mushrooms[r][c] = { hp: 4, poisoned };
    }
  }

  _countPlayerZoneMushrooms() {
    let count = 0;
    const startRow = Math.floor((PLAYER_ZONE_TOP - ARENA_TOP) / CELL);
    for (let r = startRow; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.mushrooms[r][c]) count++;
      }
    }
    return count;
  }

  _spawnSpider() {
    const fromLeft = Math.random() < 0.5;
    this.spider = {
      x: fromLeft ? 10 : this.width - 10,
      y: PLAYER_ZONE_TOP + 20,
      vx: (fromLeft ? 1 : -1) * (110 + this.level * 10),
      vy: 155,
      dirTimer: 0.65,
      legPhase: 0
    };
  }

  _spawnFlea() {
    const col = 2 + Math.floor(Math.random() * (COLS - 4));
    this.flea = {
      x: col * CELL + CELL / 2,
      y: ARENA_TOP + 10,
      col,
      hp: 2,
      speed: 210,
      lastRowDropped: -1
    };
    this.audio.playLaser(900, 350, 0.2);
  }

  _spawnScorpion() {
    const fromLeft = Math.random() < 0.5;
    const row = 2 + Math.floor(Math.random() * 11);
    this.scorpion = {
      x: fromLeft ? -16 : this.width + 16,
      y: ARENA_TOP + row * CELL + CELL / 2,
      row,
      vx: (fromLeft ? 1 : -1) * (150 + this.level * 8),
      animPhase: 0
    };
  }

  _killPlayer() {
    if (this.player.dead || this.player.invuln > 0) return;
    this.player.dead = true;
    this.player.respawnTimer = 1.6;
    this.lives--;
    this.audio.playExplosion(0.5, 800);
    this.renderer.shake(8, 0.3);
    this._spawnSparks(this.player.x, this.player.y, PALETTE.CYAN, 22);

    // Restore damaged mushrooms for bonus points
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const m = this.mushrooms[r][c];
        if (m && (m.hp < 4 || m.poisoned)) {
          m.hp = 4;
          m.poisoned = false;
          this._addScore(5);
        }
      }
    }

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
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

    // Background skittering pulse
    this.stepSoundTimer -= dt;
    if (this.stepSoundTimer <= 0 && this.segments.length > 0) {
      this.stepSoundTimer = 0.16;
      this.audio.playNote(180 + (this.segments.length % 4) * 35, 0.03, 'triangle', 0.08);
    }

    // Player Update
    const p = this.player;
    if (p.dead) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) {
        if (this.lives <= 0) {
          this.state = 'GAMEOVER';
          this.audio.playGameOver();
          return;
        }
        this._spawnPlayer();
        this.spider = null;
        this.flea = null;
      }
    } else {
      if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
      if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt);

      const moveSpeed = 270;
      const axis = this.input.getAxis();
      let nx = p.x + axis.x * moveSpeed * dt;
      let ny = p.y + axis.y * moveSpeed * dt;

      // Also support pointer dragging in the player zone
      if (this.input.pointer.down && axis.x === 0 && axis.y === 0) {
        nx += (this.input.pointer.x - p.x) * Math.min(1, dt * 12);
        ny += (this.input.pointer.y - p.y) * Math.min(1, dt * 12);
      }

      nx = Math.max(14, Math.min(this.width - 14, nx));
      ny = Math.max(PLAYER_ZONE_TOP, Math.min(PLAYER_ZONE_BOTTOM, ny));

      // Prevent overlapping mushrooms in player zone
      const testCol = Math.floor(nx / CELL);
      const testRow = Math.floor((ny - ARENA_TOP) / CELL);
      if (testRow >= 0 && testRow < ROWS && testCol >= 0 && testCol < COLS && this.mushrooms[testRow][testCol]) {
        // Slide along open axis
        const colX = Math.floor(nx / CELL);
        const rowCur = Math.floor((p.y - ARENA_TOP) / CELL);
        if (!this.mushrooms[rowCur]?.[colX]) p.x = nx;
        const colCur = Math.floor(p.x / CELL);
        if (!this.mushrooms[testRow]?.[colCur]) p.y = ny;
      } else {
        p.x = nx;
        p.y = ny;
      }

      // Rapid-fire bug blaster
      const wantsFire = this.input.isDown('actionA') || this.input.isJustPressed('actionA') || this.input.pointer.down;
      if (wantsFire && p.fireCooldown <= 0 && this.bullets.length < 3) {
        p.fireCooldown = 0.13;
        this.bullets.push({
          x: p.x,
          y: p.y - 12,
          vy: -680
        });
        this.audio.playLaser(1400, 380, 0.065);
      }
    }

    // Update Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y += b.vy * dt;
      if (b.y < ARENA_TOP) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Check Centipede segments first
      let consumed = false;
      for (let sIdx = this.segments.length - 1; sIdx >= 0; sIdx--) {
        const seg = this.segments[sIdx];
        if (Math.hypot(b.x - seg.x, b.y - seg.y) < 12) {
          this.bullets.splice(i, 1);
          consumed = true;

          // Promote trailing segment to a new independent Head!
          for (const other of this.segments) {
            if (other.leaderId === seg.id) {
              other.isHead = true;
              other.leaderId = null;
              other.dir = -other.dir;
            }
          }

          const pts = seg.isHead ? 100 : 10;
          this._addScore(pts, seg.x, seg.y, seg.isHead ? PALETTE.PINK : PALETTE.GREEN);
          this.audio.playPop();
          this._spawnSparks(seg.x, seg.y, seg.isHead ? PALETTE.PINK : PALETTE.GREEN, 12);

          // Spawn mushroom in that grid cell!
          const mRow = Math.max(0, Math.min(ROWS - 2, Math.floor((seg.y - ARENA_TOP) / CELL)));
          const mCol = Math.max(0, Math.min(COLS - 1, Math.floor(seg.x / CELL)));
          this._setMushroom(mRow, mCol, false);

          this.segments.splice(sIdx, 1);
          break;
        }
      }
      if (consumed) continue;

      // Check Spider
      if (this.spider && Math.hypot(b.x - this.spider.x, b.y - this.spider.y) < 16) {
        this.bullets.splice(i, 1);
        const distY = Math.abs(this.player.y - this.spider.y);
        const pts = distY < 48 ? 900 : distY < 90 ? 600 : 300;
        this._addScore(pts, this.spider.x, this.spider.y, PALETTE.GOLD);
        this.audio.playExplosion(0.3, 1300);
        this._spawnSparks(this.spider.x, this.spider.y, PALETTE.GOLD, 16);
        this.spider = null;
        this.spiderTimer = 5 + Math.random() * 4;
        continue;
      }

      // Check Flea
      if (this.flea && Math.hypot(b.x - this.flea.x, b.y - this.flea.y) < 14) {
        this.bullets.splice(i, 1);
        this.flea.hp--;
        if (this.flea.hp <= 0) {
          this._addScore(200, this.flea.x, this.flea.y, PALETTE.CYAN);
          this.audio.playExplosion(0.28, 1400);
          this._spawnSparks(this.flea.x, this.flea.y, PALETTE.CYAN, 14);
          this.flea = null;
          this.fleaTimer = 7 + Math.random() * 5;
        } else {
          this.flea.speed = 380; // Speeds up after first hit!
          this.audio.playHit();
        }
        continue;
      }

      // Check Scorpion
      if (this.scorpion && Math.hypot(b.x - this.scorpion.x, b.y - this.scorpion.y) < 16) {
        this.bullets.splice(i, 1);
        this._addScore(1000, this.scorpion.x, this.scorpion.y, PALETTE.PURPLE);
        this.audio.playPowerUp();
        this._spawnSparks(this.scorpion.x, this.scorpion.y, PALETTE.PURPLE, 18);
        this.scorpion = null;
        this.scorpionTimer = 12 + Math.random() * 6;
        continue;
      }

      // Check Mushroom grid
      const c = Math.floor(b.x / CELL);
      const r = Math.floor((b.y - ARENA_TOP) / CELL);
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && this.mushrooms[r][c]) {
        this.bullets.splice(i, 1);
        const m = this.mushrooms[r][c];
        m.hp--;
        this.audio.playDig();
        this._spawnSparks(c * CELL + CELL / 2, ARENA_TOP + r * CELL + CELL / 2, m.poisoned ? PALETTE.PURPLE : PALETTE.CYAN, 4);
        if (m.hp <= 0) {
          this.mushrooms[r][c] = null;
          this._addScore(1);
        }
      }
    }

    // Update Centipede Segments
    for (const seg of this.segments) {
      seg.animPhase += dt * 14;

      if (seg.poisonDive) {
        // Poison dive straight down into player zone
        seg.y += seg.speed * 1.15 * dt;
        seg.x += Math.sin(seg.y * 0.12) * 90 * dt;
        seg.row = Math.min(ROWS - 1, Math.floor((seg.y - ARENA_TOP) / CELL));
        if (seg.row >= ROWS - 1) {
          seg.poisonDive = false;
          seg.y = ARENA_TOP + (ROWS - 1) * CELL + CELL / 2;
          seg.vertDir = -1;
        }
      } else {
        const nextX = seg.x + seg.dir * seg.speed * dt;
        const aheadCol = Math.floor((nextX + seg.dir * (CELL * 0.42)) / CELL);
        const curRow = seg.row;

        const hitEdge = aheadCol < 0 || aheadCol >= COLS;
        const cellMush = !hitEdge && curRow >= 0 && curRow < ROWS ? this.mushrooms[curRow][aheadCol] : null;

        if (hitEdge || cellMush) {
          if (cellMush && cellMush.poisoned) {
            seg.poisonDive = true;
          } else {
            // Drop or climb one row and reverse horizontal direction
            const minPlayerRow = Math.floor((PLAYER_ZONE_TOP - ARENA_TOP) / CELL);
            let nextRow = seg.row + seg.vertDir;
            if (nextRow >= ROWS) {
              seg.vertDir = -1;
              nextRow = ROWS - 2;
            } else if (seg.vertDir === -1 && nextRow < minPlayerRow) {
              seg.vertDir = 1;
              nextRow = minPlayerRow + 1;
            }
            seg.row = Math.max(0, Math.min(ROWS - 1, nextRow));
            seg.y = ARENA_TOP + seg.row * CELL + CELL / 2;
            seg.dir = -seg.dir;
          }
        } else {
          seg.x = nextX;
          seg.y = ARENA_TOP + seg.row * CELL + CELL / 2;
        }
      }

      // Check collision with Player
      if (!p.dead && p.invuln <= 0 && Math.hypot(seg.x - p.x, seg.y - p.y) < 15) {
        this._killPlayer();
      }
    }

    // Update Spider
    if (!this.spider) {
      this.spiderTimer -= dt;
      if (this.spiderTimer <= 0) this._spawnSpider();
    } else {
      const sp = this.spider;
      sp.legPhase += dt * 18;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;

      if (sp.y < PLAYER_ZONE_TOP - 15) {
        sp.y = PLAYER_ZONE_TOP - 15;
        sp.vy = Math.abs(sp.vy);
      } else if (sp.y > PLAYER_ZONE_BOTTOM) {
        sp.y = PLAYER_ZONE_BOTTOM;
        sp.vy = -Math.abs(sp.vy);
      }

      sp.dirTimer -= dt;
      if (sp.dirTimer <= 0) {
        sp.dirTimer = 0.45 + Math.random() * 0.6;
        // Periodically bounce purely vertically or diagonally
        const baseVx = (110 + this.level * 10) * (sp.vx >= 0 ? 1 : -1);
        sp.vx = Math.random() < 0.35 ? 0 : baseVx;
      }

      // Spider eats mushrooms on contact
      const sc = Math.floor(sp.x / CELL);
      const sr = Math.floor((sp.y - ARENA_TOP) / CELL);
      if (sr >= 0 && sr < ROWS && sc >= 0 && sc < COLS && this.mushrooms[sr][sc]) {
        this.mushrooms[sr][sc] = null;
      }

      if (!p.dead && p.invuln <= 0 && Math.hypot(sp.x - p.x, sp.y - p.y) < 16) {
        this._killPlayer();
      }

      if (sp.x < -25 || sp.x > this.width + 25) {
        this.spider = null;
        this.spiderTimer = 4.5 + Math.random() * 4;
      }
    }

    // Update Flea (spawns when player zone mushrooms < 5)
    if (!this.flea) {
      this.fleaTimer -= dt;
      if (this.fleaTimer <= 0) {
        if (this._countPlayerZoneMushrooms() < 6) {
          this._spawnFlea();
        } else {
          this.fleaTimer = 3.5;
        }
      }
    } else {
      const fl = this.flea;
      fl.y += fl.speed * dt;
      const curRow = Math.floor((fl.y - ARENA_TOP) / CELL);
      if (curRow !== fl.lastRowDropped && curRow >= 1 && curRow < ROWS - 1) {
        fl.lastRowDropped = curRow;
        if (!this.mushrooms[curRow][fl.col] && Math.random() < 0.32) {
          this._setMushroom(curRow, fl.col, false);
        }
      }
      if (!p.dead && p.invuln <= 0 && Math.hypot(fl.x - p.x, fl.y - p.y) < 15) {
        this._killPlayer();
      }
      if (fl.y > this.height + 15) {
        this.flea = null;
        this.fleaTimer = 6 + Math.random() * 4;
      }
    }

    // Update Scorpion (poisons mushrooms across middle rows)
    if (!this.scorpion) {
      this.scorpionTimer -= dt;
      if (this.scorpionTimer <= 0) this._spawnScorpion();
    } else {
      const sc = this.scorpion;
      sc.animPhase += dt * 16;
      sc.x += sc.vx * dt;
      const col = Math.floor(sc.x / CELL);
      if (col >= 0 && col < COLS && this.mushrooms[sc.row][col]) {
        this.mushrooms[sc.row][col].poisoned = true;
      }
      if (sc.x < -30 || sc.x > this.width + 30) {
        this.scorpion = null;
        this.scorpionTimer = 10 + Math.random() * 6;
      }
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
      pop.y -= 26 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }

    // Wave Clear Check
    if (this.segments.length === 0) {
      this.level++;
      this.audio.playStageClear();
      this._spawnCentipedeWave(this.level);
    }
  }

  _drawMushroom(ctx, r, c, m) {
    const x = c * CELL;
    const y = ARENA_TOP + r * CELL;
    const capColor = m.poisoned ? PALETTE.PURPLE : PALETTE.PINK;
    const rimColor = m.poisoned ? PALETTE.CYAN : PALETTE.GOLD;

    ctx.save();
    ctx.fillStyle = capColor;
    ctx.shadowColor = capColor;
    ctx.shadowBlur = 6;

    // Mushroom cap dome
    const capH = m.hp >= 3 ? 11 : m.hp === 2 ? 8 : 5;
    ctx.beginPath();
    ctx.arc(x + CELL / 2, y + 10, 8, Math.PI, 0);
    ctx.fillRect(x + 2, y + 9, CELL - 4, Math.max(2, capH - 6));
    ctx.fill();

    // Spots on cap
    ctx.fillStyle = rimColor;
    ctx.fillRect(x + 6, y + 5, 3, 3);
    ctx.fillRect(x + 12, y + 6, 3, 2);

    // Stem eroded based on HP (4..1)
    if (m.hp >= 2) {
      ctx.fillStyle = PALETTE.WHITE;
      const stemH = m.hp === 4 ? 7 : m.hp === 3 ? 5 : 3;
      ctx.fillRect(x + 7, y + 11, 6, stemH);
    }
    ctx.restore();
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear(PALETTE.BG);

    // Player zone boundary line
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(0, PLAYER_ZONE_TOP);
    ctx.lineTo(this.width, PLAYER_ZONE_TOP);
    ctx.stroke();
    ctx.restore();

    // Render Mushrooms
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const m = this.mushrooms[r][c];
        if (m) this._drawMushroom(ctx, r, c, m);
      }
    }

    // Render Centipede Segments
    for (const seg of this.segments) {
      const color = seg.isHead ? PALETTE.PINK : seg.poisonDive ? PALETTE.PURPLE : PALETTE.GREEN;
      ctx.save();
      ctx.translate(seg.x, seg.y);

      // Animated legs
      const legSwing = Math.sin(seg.animPhase) * 3;
      ctx.strokeStyle = PALETTE.GOLD;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-5, -7);
      ctx.lineTo(-8 + legSwing, -11);
      ctx.moveTo(5, 7);
      ctx.lineTo(8 - legSwing, 11);
      ctx.stroke();

      // Segment body sphere
      this.renderer.drawGlowCircle(0, 0, seg.isHead ? 8.5 : 7.5, color, 8, true);

      // Eyes on Head segments
      if (seg.isHead) {
        const eyeX = seg.dir * 4;
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(eyeX - 1.5, -4.5, 3, 3);
        ctx.fillRect(eyeX - 1.5, 1.5, 3, 3);
      }
      ctx.restore();
    }

    // Render Spider
    if (this.spider) {
      const sp = this.spider;
      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.strokeStyle = PALETTE.ORANGE;
      ctx.lineWidth = 2;
      const wave = Math.sin(sp.legPhase) * 4;
      for (let side of [-1, 1]) {
        for (let l = -1; l <= 1; l++) {
          ctx.beginPath();
          ctx.moveTo(side * 4, l * 3);
          ctx.lineTo(side * 13, l * 6 + wave * side * l);
          ctx.stroke();
        }
      }
      this.renderer.drawGlowCircle(0, 0, 7, PALETTE.RED, 10, true);
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(-4, -2, 2.5, 2.5);
      ctx.fillRect(1.5, -2, 2.5, 2.5);
      ctx.restore();
    }

    // Render Flea
    if (this.flea) {
      const fl = this.flea;
      this.renderer.drawGlowCircle(fl.x, fl.y, 7.5, PALETTE.CYAN, 10, true);
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(fl.x - 5, fl.y + 3, 10, 3);
    }

    // Render Scorpion
    if (this.scorpion) {
      const sc = this.scorpion;
      ctx.save();
      ctx.translate(sc.x, sc.y);
      this.renderer.drawGlowRect(-11, -5, 22, 10, PALETTE.PURPLE, 10, true);
      // Curved stinger tail
      const dir = sc.vx >= 0 ? 1 : -1;
      ctx.strokeStyle = PALETTE.PINK;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-dir * 10, 0);
      ctx.lineTo(-dir * 15, -9);
      ctx.lineTo(-dir * 7, -12);
      ctx.stroke();
      ctx.restore();
    }

    // Render Player Bug Blaster
    const p = this.player;
    if (!p.dead) {
      const visible = p.invuln <= 0 || Math.floor(p.invuln * 14) % 2 === 0;
      if (visible) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.fillStyle = PALETTE.CYAN;
        ctx.shadowColor = PALETTE.CYAN;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(10, 8);
        ctx.lineTo(4, 11);
        ctx.lineTo(-4, 11);
        ctx.lineTo(-10, 8);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = PALETTE.PINK;
        ctx.fillRect(-3, -3, 6, 7);
        ctx.restore();
      }
    }

    // Render Laser Dart Bullets
    for (const b of this.bullets) {
      this.renderer.drawGlowRect(b.x - 2, b.y - 6, 4, 12, PALETTE.GOLD, 8, true);
    }

    // Render Particles
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
    }

    // Render Floating Score Popups
    for (const pop of this.popups) {
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HEADER,
        size: 11,
        color: pop.color,
        align: 'center',
        glow: 6
      });
    }

    // Top HUD
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `SEGMENTS: ${this.segments.length}`,
      accent: PALETTE.GREEN
    });

    // State Overlay
    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1981 MUSHROOM FOREST BUG BLASTER',
      controls: 'ARROWS/WASD/MOUSE: MOVE IN ZONE  |  Z/SPACE/HOLD: RAPID BLASTER',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GREEN
    });
  }
}

export default Centipede;
