/**
 * Flicky.js
 * Classic 1984 Wrap-Around Platformer & Chick Rescue — Retro Arcade Studio Edition.
 * Guide bluebird Flicky across multi-floor platforms to gather chirping yellow Piopio chicks
 * into a trailing daisy-chain formation and lead them to the flashing EXIT door!
 * Jump (Action A) and throw collectible flowerpots/teacups (Action B) at Tiger Cats (Nyannan)!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const FLOORS = [496, 396, 296, 196];
const DOOR_X = 480;
const DOOR_Y = 396;

export class Flicky {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'flicky';
    this.title = 'Chirpy Rescue';
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
    this.platforms = [
      // Bottom full floor
      { x: 0, w: 960, y: FLOORS[0] },
      // Floor 1 (with gaps)
      { x: 30, w: 280, y: FLOORS[1] },
      { x: 360, w: 240, y: FLOORS[1] },
      { x: 650, w: 280, y: FLOORS[1] },
      // Floor 2
      { x: 80, w: 340, y: FLOORS[2] },
      { x: 540, w: 340, y: FLOORS[2] },
      // Top Floor 3
      { x: 40, w: 250, y: FLOORS[3] },
      { x: 355, w: 250, y: FLOORS[3] },
      { x: 670, w: 250, y: FLOORS[3] }
    ];

    this._resetFlicky();

    // Spawn 8 Chirping Yellow Piopio Chicks across the floors
    this.chicks = [];
    const chickSpawns = [
      { x: 110, y: FLOORS[3] },
      { x: 480, y: FLOORS[3] },
      { x: 820, y: FLOORS[3] },
      { x: 220, y: FLOORS[2] },
      { x: 720, y: FLOORS[2] },
      { x: 160, y: FLOORS[1] },
      { x: 800, y: FLOORS[1] },
      { x: 240, y: FLOORS[0] }
    ];
    chickSpawns.forEach((sp, idx) => {
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
      x: DOOR_X,
      y: DOOR_Y,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: true,
      heldItem: null,
      invuln: 2.0,
      trail: []
    };
    for (let i = 0; i < 120; i++) {
      this.flicky.trail.push({ x: DOOR_X, y: DOOR_Y });
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
    if (Math.hypot(f.x - DOOR_X, f.y - DOOR_Y) < 28) {
      const chained = this.chicks.filter((c) => c.state === 'CHAIN');
      if (chained.length > 0) {
        for (const c of chained) c.state = 'RESCUED';
        const n = chained.length;
        const bonusTable = [0, 200, 500, 1000, 2000, 3200, 4800, 6400, 10000];
        const pts = bonusTable[Math.min(8, n)];
        this.audio.playPowerUp();
        this._addScore(pts, DOOR_X, DOOR_Y - 36, `${n}x RESCUED! +${pts}`, PALETTE.GREEN);
      }
    }

    if (allRescued) {
      this.stageClearTimer = 1.6;
      this.audio.playStageClear();
      this._addScore(2000, DOOR_X, 140, 'ALL CHICKS SAVED! +2000', PALETTE.GOLD);
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
    this.renderer.clear('#0F172A');

    // 1. Flashing Home EXIT Door on Floor 1 Center
    const doorPulse = Math.floor(performance.now() * 0.008) % 2 === 0 ? PALETTE.PINK : PALETTE.GOLD;
    this.renderer.drawGlowRect(DOOR_X - 24, DOOR_Y - 54, 48, 54, doorPulse, 12, false, 3);
    ctx.fillStyle = '#1E1B4B';
    ctx.fillRect(DOOR_X - 21, DOOR_Y - 51, 42, 51);
    this.renderer.drawText('EXIT', DOOR_X, DOOR_Y - 24, {
      font: FONTS.HEADER,
      size: 9,
      color: PALETTE.WHITE,
      align: 'center'
    });

    // 2. Multi-Floor Brick & Girder Platforms
    for (const pl of this.platforms) {
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(pl.x, pl.y, pl.w, 14);
      ctx.strokeStyle = PALETTE.CYAN;
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
      this.renderer.drawGlowCircle(c.x, c.y - 9, 8.5, PALETTE.GOLD, 8, true);
      if (c.sunglasses) {
        ctx.fillStyle = '#090D16';
        ctx.fillRect(c.x - 6, c.y - 12, 12, 4);
      } else {
        ctx.fillStyle = '#090D16';
        ctx.fillRect(c.x + 2, c.y - 11, 3, 3);
      }
    }

    // 5. Tiger Cats (Nyannan) & Green Iguanas
    for (const e of this.enemies) {
      const col = e.type === 'IGUANA' ? PALETTE.GREEN : PALETTE.ORANGE;
      this.renderer.drawGlowCircle(e.x, e.y - 12, 12, col, 10, true);
      // Cat ears
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(e.x - 10, e.y - 18);
      ctx.lineTo(e.x - 6, e.y - 28);
      ctx.lineTo(e.x - 2, e.y - 20);
      ctx.moveTo(e.x + 10, e.y - 18);
      ctx.lineTo(e.x + 6, e.y - 28);
      ctx.lineTo(e.x + 2, e.y - 20);
      ctx.fill();
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(e.x - 6, e.y - 15, 4, 4);
      ctx.fillRect(e.x + 2, e.y - 15, 4, 4);
    }

    // 6. Bluebird Flicky
    const f = this.flicky;
    if (f.invuln <= 0 || Math.floor(f.invuln * 14) % 2 === 0) {
      this.renderer.drawGlowCircle(f.x, f.y - 13, 13, PALETTE.CYAN, 12, true);
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(f.x + f.facing * 10 - 3, f.y - 15, 8, 5);
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(f.x + f.facing * 4 - 2, f.y - 18, 4, 5);
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
