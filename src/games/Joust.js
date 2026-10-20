/**
 * Joust.js
 * Classic 1982 Flying Ostrich Knight Arena — Retro Arcade Studio Edition.
 * Features flapping flight momentum, wrap-around floating stone ledges,
 * height-based lance combat (higher lance tip wins!), bouncing Buzzard Eggs
 * that hatch into new riders if uncollected, and a grasping Lava Troll Hand!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const ARENA_TOP = 40;
const LAVA_Y = 502;
const GRAVITY = 490;

const PLATFORMS = [
  // Bottom main bridge above lava pit
  { x: 170, y: 468, w: 620, h: 16, isSpawn: true },
  // Middle left & right wrap-around ledges
  { x: 0, y: 315, w: 235, h: 14, isSpawn: true },
  { x: 725, y: 315, w: 235, h: 14, isSpawn: true },
  // Center floating stone island
  { x: 345, y: 255, w: 270, h: 14, isSpawn: true },
  // High upper ledges
  { x: 115, y: 150, w: 210, h: 14, isSpawn: false },
  { x: 635, y: 150, w: 210, h: 14, isSpawn: false }
];

const TIER_CONFIG = {
  1: { name: 'BOUNDER', color: PALETTE.RED, speed: 155, flapRate: 0.42, pts: 500 },
  2: { name: 'HUNTER', color: PALETTE.CYAN, speed: 205, flapRate: 0.30, pts: 750 },
  3: { name: 'SHADOW LORD', color: PALETTE.PURPLE, speed: 255, flapRate: 0.21, pts: 1500 }
};

export class Joust {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'joust';
    this.title = 'Sky Lancer';
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
    this.eggStreak = 0;

    this.enemies = [];
    this.eggs = [];
    this.particles = [];
    this.popups = [];
    this.trollHands = [];
    this.lavaBubbles = [];

    this._spawnPlayer();
    this._spawnWave(this.level);
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.audio.stopSequence();
  }

  _spawnPlayer() {
    this.player = {
      x: 480,
      y: 444,
      vx: 0,
      vy: 0,
      dir: 1,
      onGround: true,
      wingPhase: 0,
      invuln: 2.0,
      dead: false,
      respawnTimer: 0,
      grabbedByTroll: false
    };
  }

  _spawnWave(level) {
    this.enemies = [];
    this.eggs = [];
    const spawnPads = PLATFORMS.filter((p) => p.isSpawn);
    const total = Math.min(8, 3 + level);

    for (let i = 0; i < total; i++) {
      const pad = spawnPads[i % spawnPads.length];
      let tier = 1;
      if (level >= 4 && i % 3 === 0) tier = 3;
      else if (level >= 2 && i % 2 === 1) tier = 2;

      const cfg = TIER_CONFIG[tier];
      this.enemies.push({
        x: pad.x + 40 + Math.random() * (pad.w - 80),
        y: pad.y - 22,
        vx: (Math.random() < 0.5 ? -1 : 1) * cfg.speed,
        vy: 0,
        dir: 1,
        tier,
        color: cfg.color,
        pts: cfg.pts,
        flapTimer: Math.random() * 0.4,
        wingPhase: 0,
        onGround: true,
        spawnWarmup: 0.7
      });
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
        life: 0.9
      });
    }
  }

  _spawnFeathers(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        color,
        life: 0.35 + Math.random() * 0.3
      });
    }
  }

  _resolvePlatformPhysics(entity, dt, isEgg = false) {
    const prevY = entity.y;
    entity.x += entity.vx * dt;
    entity.y += entity.vy * dt;

    // Horizontal screen wrap-around
    if (entity.x < 0) entity.x += this.width;
    else if (entity.x >= this.width) entity.x -= this.width;

    // Ceiling bounce
    if (entity.y < ARENA_TOP + 18) {
      entity.y = ARENA_TOP + 18;
      entity.vy = Math.abs(entity.vy) * 0.45;
    }

    entity.onGround = false;
    const footOffset = isEgg ? 7 : 20;

    for (const plat of PLATFORMS) {
      if (entity.x >= plat.x - 8 && entity.x <= plat.x + plat.w + 8) {
        // Landing on top of stone platform
        if (
          entity.vy >= 0 &&
          prevY + footOffset <= plat.y + 8 &&
          entity.y + footOffset >= plat.y
        ) {
          entity.y = plat.y - footOffset;
          if (isEgg && Math.abs(entity.vy) > 65) {
            entity.vy = -entity.vy * 0.55;
            entity.vx *= 0.82;
            this.audio.playHop();
          } else {
            entity.vy = 0;
            entity.onGround = true;
          }
        } else if (
          // Head bump from below platform
          entity.vy < 0 &&
          prevY - 14 >= plat.y + plat.h - 6 &&
          entity.y - 14 <= plat.y + plat.h
        ) {
          entity.y = plat.y + plat.h + 14;
          entity.vy = Math.abs(entity.vy) * 0.5;
        }
      }
    }
  }

  _killPlayer() {
    if (this.player.dead || this.player.invuln > 0) return;
    this.player.dead = true;
    this.player.respawnTimer = 1.6;
    this.eggStreak = 0;
    this.lives--;
    this.audio.playExplosion(0.5, 700);
    this.renderer.shake(9, 0.35);
    this._spawnFeathers(this.player.x, this.player.y, PALETTE.GOLD, 22);

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

    // Ambient Lava Bubbles
    if (Math.random() < 0.25) {
      this.lavaBubbles.push({
        x: Math.random() * this.width,
        y: LAVA_Y + 4 + Math.random() * 20,
        r: 2 + Math.random() * 4,
        life: 0.4 + Math.random() * 0.4
      });
    }
    for (let i = this.lavaBubbles.length - 1; i >= 0; i--) {
      this.lavaBubbles[i].y -= 18 * dt;
      this.lavaBubbles[i].life -= dt;
      if (this.lavaBubbles[i].life <= 0) this.lavaBubbles.splice(i, 1);
    }

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
      }
    } else {
      if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
      if (p.wingPhase > 0) p.wingPhase = Math.max(0, p.wingPhase - dt * 6);

      // Horizontal acceleration
      const accel = p.onGround ? 540 : 380;
      if (this.input.isDown('left')) {
        p.dir = -1;
        p.vx -= accel * dt;
      } else if (this.input.isDown('right')) {
        p.dir = 1;
        p.vx += accel * dt;
      } else if (p.onGround) {
        // Skid deceleration on stone platforms
        p.vx *= Math.pow(0.88, dt * 60);
      }
      p.vx = Math.max(-310, Math.min(310, p.vx));

      // Flapping Flight Momentum (Action A, Action B, Up, or Tap)
      const flapPressed =
        this.input.isJustPressed('actionA') ||
        this.input.isJustPressed('up') ||
        this.input.pointer.justPressed;
      if (flapPressed) {
        p.vy = Math.max(-290, Math.min(-165, p.vy - 215));
        p.onGround = false;
        p.grabbedByTroll = false;
        p.wingPhase = 1.0;
        this.audio.playNote(240, 0.05, 'triangle', 0.22);
      }

      p.vy += GRAVITY * dt;
      this._resolvePlatformPhysics(p, dt, false);

      // Lava Troll Hand Hazard when flying too low near exposed left/right lava pits!
      const overSideLava = p.x < 165 || p.x > 795;
      if (overSideLava && p.y > LAVA_Y - 58) {
        p.vy += 260 * dt; // Troll pulls downward unless player flaps rapidly!
        p.grabbedByTroll = true;
      } else {
        p.grabbedByTroll = false;
      }

      if (p.y + 16 >= LAVA_Y) {
        this._killPlayer();
      }
    }

    // Update Enemy Buzzard Riders
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.spawnWarmup > 0) {
        e.spawnWarmup -= dt;
        continue;
      }

      const cfg = TIER_CONFIG[e.tier];
      e.flapTimer -= dt;
      if (e.wingPhase > 0) e.wingPhase = Math.max(0, e.wingPhase - dt * 6);

      // AI Flapping: Hunters & Shadow Lords aim slightly above player's lance height!
      const targetAltitude =
        e.tier === 1
          ? 270
          : !p.dead
          ? Math.max(ARENA_TOP + 36, p.y - 18)
          : 230;

      const mustAvoidLava = e.y > LAVA_Y - 68;
      if (mustAvoidLava || (e.flapTimer <= 0 && e.y > targetAltitude)) {
        e.flapTimer = cfg.flapRate * (0.7 + Math.random() * 0.6);
        e.vy = -195 - Math.random() * 55;
        e.wingPhase = 1.0;
      }

      if (e.tier >= 2 && !p.dead && Math.random() < 0.02) {
        // Turn toward player
        let dx = p.x - e.x;
        if (dx > this.width / 2) dx -= this.width;
        if (dx < -this.width / 2) dx += this.width;
        e.dir = dx >= 0 ? 1 : -1;
      } else {
        e.dir = e.vx >= 0 ? 1 : -1;
      }
      e.vx = e.dir * cfg.speed;
      e.vy += GRAVITY * dt;

      this._resolvePlatformPhysics(e, dt, false);

      // Joust Lance Collision with Player!
      if (!p.dead && Math.hypot(e.x - p.x, e.y - p.y) < 30) {
        const diffY = e.y - p.y; // > 0 means player is higher (smaller y)
        if (diffY > 4) {
          // Player's Lance is HIGHER -> Enemy Buzzard defeated & drops Egg!
          this._addScore(e.pts, e.x, e.y - 10, `${cfg.name} +${e.pts}`, e.color);
          this.audio.playExplosion(0.32, 1200);
          this.renderer.shake(6, 0.2);
          this._spawnFeathers(e.x, e.y, e.color, 16);

          // Bounce player upward slightly
          p.vy = -150;
          p.vx = -p.vx * 0.6;

          // Spawn Bouncing Egg
          this.eggs.push({
            x: e.x,
            y: e.y,
            vx: e.vx * 0.65,
            vy: -130,
            tier: Math.min(3, e.tier + 1),
            hatchTimer: 7.5,
            onGround: false
          });

          this.enemies.splice(i, 1);
          continue;
        } else if (diffY < -4 && p.invuln <= 0) {
          // Enemy's Lance is HIGHER -> Player unhorsed!
          e.vy = -140;
          this._killPlayer();
        } else {
          // Equal Lance Altitude -> Clang & Ricochet off each other!
          const pushDir = p.x < e.x ? -1 : 1;
          p.vx = pushDir * 240;
          p.vy = -130;
          e.vx = -pushDir * 240;
          e.vy = -130;
          e.dir = -pushDir;
          this.audio.playShove();
          this._spawnFeathers((p.x + e.x) / 2, (p.y + e.y) / 2, PALETTE.WHITE, 8);
        }
      }
    }

    // Update Bouncing Buzzard Eggs
    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const egg = this.eggs[i];
      egg.vy += GRAVITY * dt;
      this._resolvePlatformPhysics(egg, dt, true);
      if (egg.onGround) {
        egg.vx *= Math.pow(0.92, dt * 60);
      }

      // Egg falls into Lava
      if (egg.y >= LAVA_Y) {
        this._spawnFeathers(egg.x, LAVA_Y, PALETTE.ORANGE, 8);
        this.eggs.splice(i, 1);
        continue;
      }

      // Player Collects Egg!
      if (!p.dead && Math.hypot(egg.x - p.x, egg.y - p.y) < 24) {
        this.eggStreak = Math.min(4, this.eggStreak + 1);
        const basePts = this.eggStreak * 250;
        const midAirBonus = !egg.onGround ? 500 : 0;
        const totalPts = basePts + midAirBonus;
        const label = midAirBonus > 0 ? `MID-AIR EGG +${totalPts}!` : `EGG +${totalPts}`;
        this.audio.playCoin();
        this._addScore(totalPts, egg.x, egg.y - 12, label, PALETTE.GREEN);
        this.eggs.splice(i, 1);
        continue;
      }

      // Egg Hatch Timer -> Spawns new Buzzard Rider if not collected in time!
      egg.hatchTimer -= dt;
      if (egg.hatchTimer <= 0) {
        const cfg = TIER_CONFIG[egg.tier];
        this.audio.playPowerUp();
        this._spawnFeathers(egg.x, egg.y, cfg.color, 10);
        this.enemies.push({
          x: egg.x,
          y: egg.y - 12,
          vx: (Math.random() < 0.5 ? -1 : 1) * cfg.speed,
          vy: -120,
          dir: 1,
          tier: egg.tier,
          color: cfg.color,
          pts: cfg.pts,
          flapTimer: 0.2,
          wingPhase: 1,
          onGround: false,
          spawnWarmup: 0.4
        });
        this.eggs.splice(i, 1);
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
      pop.y -= 28 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }

    // Wave Clear Check
    if (this.enemies.length === 0 && this.eggs.length === 0) {
      this.level++;
      this.audio.playStageClear();
      this._addScore(1000, this.width / 2, 200, `WAVE ${this.level - 1} CLEARED!`, PALETTE.GOLD);
      this._spawnWave(this.level);
    }
  }

  _drawMountAndKnight(ctx, x, y, dir, wingPhase, mountColor, knightColor, isWarmup = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    if (isWarmup) ctx.globalAlpha = 0.55;

    // Legs
    ctx.strokeStyle = PALETTE.GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-3, 8);
    ctx.lineTo(-5, 20);
    ctx.moveTo(3, 8);
    ctx.lineTo(5, 20);
    ctx.stroke();

    // Bird Body & Neck/Head
    this.renderer.drawGlowCircle(0, 4, 10, mountColor, 8, true);
    ctx.strokeStyle = mountColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(13, -12);
    ctx.lineTo(19, -12);
    ctx.stroke();

    // Flapping Wing
    const wingY = wingPhase > 0.2 ? 9 : -6;
    ctx.fillStyle = PALETTE.WHITE;
    ctx.beginPath();
    ctx.moveTo(-8, 2);
    ctx.lineTo(2, 2);
    ctx.lineTo(-4, wingY);
    ctx.closePath();
    ctx.fill();

    // Knight Rider Torso & Helmet
    ctx.fillStyle = knightColor;
    ctx.fillRect(-5, -12, 9, 12);
    this.renderer.drawGlowCircle(0, -15, 4.5, knightColor, 6, true);

    // Glowing Jousting Lance (Altitude indicator!)
    ctx.strokeStyle = PALETTE.WHITE;
    ctx.shadowColor = knightColor;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-6, -8);
    ctx.lineTo(24, -8);
    ctx.stroke();

    ctx.restore();
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear(PALETTE.BG);

    // Bubbling Lava Pit at bottom
    const lavaGrad = ctx.createLinearGradient(0, LAVA_Y, 0, this.height);
    lavaGrad.addColorStop(0, PALETTE.RED);
    lavaGrad.addColorStop(1, '#7F1D1D');
    ctx.fillStyle = lavaGrad;
    ctx.fillRect(0, LAVA_Y, this.width, this.height - LAVA_Y);

    ctx.strokeStyle = PALETTE.GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, LAVA_Y);
    ctx.lineTo(this.width, LAVA_Y);
    ctx.stroke();

    for (const b of this.lavaBubbles) {
      this.renderer.drawGlowCircle(b.x, b.y, b.r, PALETTE.ORANGE, 6, true);
    }

    // Grasping Lava Troll Hand if player flies low over left/right lava
    if (!this.player.dead && (this.player.x < 185 || this.player.x > 775) && this.player.y > LAVA_Y - 95) {
      const hx = this.player.x;
      const hy = Math.max(this.player.y + 12, LAVA_Y - 34);
      ctx.save();
      ctx.strokeStyle = PALETTE.ORANGE;
      ctx.shadowColor = PALETTE.RED;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(hx, LAVA_Y + 10);
      ctx.lineTo(hx, hy);
      // Claws
      ctx.lineTo(hx - 10, hy - 10);
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + 10, hy - 10);
      ctx.stroke();
      ctx.restore();
    }

    // Floating Stone Ledges
    for (const plat of PLATFORMS) {
      ctx.fillStyle = '#334155';
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
      this.renderer.drawGlowRect(plat.x, plat.y, plat.w, 4, PALETTE.ORANGE, 8, true);
      // Rocky underside bevel
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
    }

    // Render Bouncing Buzzard Eggs
    for (const egg of this.eggs) {
      const wobble = egg.hatchTimer < 2.2 ? Math.sin(egg.hatchTimer * 28) * 3 : 0;
      ctx.save();
      ctx.translate(egg.x + wobble, egg.y);
      this.renderer.drawGlowCircle(0, 0, 7.5, PALETTE.GREEN, 10, true);
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(-3, -3, 6, 4);
      ctx.restore();
    }

    // Render Enemy Buzzard Riders
    for (const e of this.enemies) {
      this._drawMountAndKnight(ctx, e.x, e.y, e.dir, e.wingPhase, '#94A3B8', e.color, e.spawnWarmup > 0);
    }

    // Render Player Ostrich Knight
    const p = this.player;
    if (!p.dead) {
      const visible = p.invuln <= 0 || Math.floor(p.invuln * 14) % 2 === 0;
      if (visible) {
        this._drawMountAndKnight(ctx, p.x, p.y, p.dir, p.wingPhase, PALETTE.GOLD, PALETTE.CYAN, false);
      }
    }

    // Particles & Popups
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

    // Top HUD
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `RIDERS: ${this.enemies.length} | EGGS: ${this.eggs.length}`,
      accent: PALETTE.GOLD
    });

    // State Overlay
    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1982 FLYING OSTRICH LANCE COMBAT',
      controls: 'LEFT/RIGHT: STEER MOUNT  |  Z/SPACE/UP: FLAP WINGS (HIGHER LANCE WINS!)',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GOLD
    });
  }
}

export default Joust;
