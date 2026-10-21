/**
 * Exerion.js
 * Classic 1983 Jaleco Pseudo-3D Inertia Shoot-'Em-Up ("Inertia Wing").
 * Features a scrolling pseudo-3D alien horizon landscape, authentic ship horizontal
 * & vertical momentum/inertia physics requiring counter-thrust, and the signature
 * Dual Weapon System:
 * - Action A: Single Fast Rapid Cannon (consumes 1 Charge per shot; +1 Charge per enemy killed!)
 * - Action B: Dual Slow Twin-Blaster (unlimited ammo; builds Fast Cannon charge reserve!)
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const STAGE_PALETTES = [
  { sky: '#070B19', horizon: '#1D4ED8', ridge: '#38BDF8', groundA: '#0F172A', groundB: '#1E3A8A' },
  { sky: '#14081E', horizon: '#9333EA', ridge: '#F472B6', groundA: '#1E1B4B', groundB: '#4C1D95' },
  { sky: '#180B08', horizon: '#EA580C', ridge: '#FACC15', groundA: '#27120B', groundB: '#7C2D12' }
];

export class Exerion {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'exerion';
    this.title = 'Inertia Wing';

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.horizonY = 188;
    this.scrollZ = 0;
    this.stars = [];
    for (let i = 0; i < 55; i++) {
      this.stars.push({
        x: Math.random() * 960,
        y: 42 + Math.random() * 140,
        s: 1 + Math.random() * 1.8
      });
    }

    this.player = null;
    this.fastBullets = [];
    this.twinBullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.particles = [];
    this.popups = [];

    this.waveEnemiesLeft = 0;
    this.waveSpawnTimer = 0;
    this.stageClearTimer = 0;
    this.deathTimer = 0;
    this.animTime = 0;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.highScore = HighScoreStore.get(this.id);
    this.state = 'PLAYING';
    this.initStage(this.level, true);
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
        life: 0.9,
        maxLife: 0.9,
        color
      });
    }
  }

  initStage(level, fullReset = false) {
    this.fastBullets = [];
    this.twinBullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.particles = [];
    this.popups = [];
    this.stageClearTimer = 0;
    this.deathTimer = 0;
    this.waveEnemiesLeft = 18 + level * 4;
    this.waveSpawnTimer = 0.5;

    const prevCharge = !fullReset && this.player ? this.player.fastCharge : 35;
    this.player = {
      x: 480,
      y: 465,
      vx: 0,
      vy: 0,
      accel: 860,
      maxSpeed: 340,
      drag: 1.65, // Low friction so horizontal inertia/gliding is pronounced!
      bankAngle: 0,
      fastCharge: Math.max(25, prevCharge),
      fastCooldown: 0,
      invulnTimer: 2.0
    };
  }

  spawnEnemyFormation() {
    if (this.waveEnemiesLeft <= 0 || this.enemies.length >= 9) return;
    const count = Math.min(4, this.waveEnemiesLeft);
    const pattern = Math.floor(Math.random() * 3);
    const baseHue = [PALETTE.PINK, PALETTE.CYAN, PALETTE.GOLD, PALETTE.GREEN][
      (this.level + pattern) % 4
    ];
    const startSide = Math.random() < 0.5 ? -1 : 1;

    for (let i = 0; i < count; i++) {
      this.waveEnemiesLeft--;
      this.enemies.push({
        id: Math.random(),
        pattern,
        phase: i * 0.55,
        age: 0,
        z: 1.0 + i * 0.14, // 1.0 = far horizon, 0.25 = attack plane
        x: 480 + startSide * (180 + i * 45),
        y: this.horizonY + 12,
        anchorX: 200 + ((i * 175 + this.level * 50) % 560),
        anchorY: 165 + (i % 3) * 55,
        hp: this.level >= 3 && i === 0 ? 2 : 1,
        color: baseHue,
        pts: 150 + (this.level % 4) * 50,
        fireTimer: 1.1 + Math.random() * 1.4
      });
    }
  }

  killPlayer() {
    if (this.deathTimer > 0 || this.stageClearTimer > 0) return;
    this.lives--;
    this.audio.playExplosion(0.42, 750);
    this.renderer.shake(10, 0.32);

    for (let i = 0; i < 28; i++) {
      const a = (Math.PI * 2 * i) / 28;
      const spd = 60 + Math.random() * 165;
      this.particles.push({
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 3.5,
        life: 0.6,
        color: i % 2 === 0 ? PALETTE.CYAN : PALETTE.ORANGE
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
    this.scrollZ = (this.scrollZ + dt * 220) % 1000;

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
        this.initStage(this.level, false);
      }
      return;
    }

    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.player.x = 480;
        this.player.y = 465;
        this.player.vx = 0;
        this.player.vy = 0;
        this.player.invulnTimer = 2.4;
      }
      return;
    }

    this.waveSpawnTimer -= dt;
    if (this.waveSpawnTimer <= 0) {
      this.waveSpawnTimer = 1.65;
      this.spawnEnemyFormation();
    }

    this.updatePlayer(dt);
    this.updateWeapons(dt);
    this.updateEnemies(dt);
  }

  updatePlayer(dt) {
    const p = this.player;
    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    if (p.fastCooldown > 0) p.fastCooldown = Math.max(0, p.fastCooldown - dt);

    const axis = this.input.getAxis();

    // Apply thruster acceleration onto inertia velocity vector
    if (Math.abs(axis.x) > 0.05) {
      p.vx += axis.x * p.accel * dt;
    } else {
      // Gentle inertial decay — ship glides smoothly!
      p.vx *= Math.exp(-p.drag * dt);
    }

    if (Math.abs(axis.y) > 0.05) {
      p.vy += axis.y * (p.accel * 0.85) * dt;
    } else {
      p.vy *= Math.exp(-p.drag * 1.4 * dt);
    }

    p.vx = Math.max(-p.maxSpeed, Math.min(p.maxSpeed, p.vx));
    p.vy = Math.max(-240, Math.min(240, p.vy));

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Bounce softly off arena boundaries while preserving inertia feel
    if (p.x < 48) {
      p.x = 48;
      p.vx = Math.abs(p.vx) * 0.35;
    } else if (p.x > 912) {
      p.x = 912;
      p.vx = -Math.abs(p.vx) * 0.35;
    }
    p.y = Math.max(290, Math.min(502, p.y));

    p.bankAngle = (p.vx / p.maxSpeed) * 0.38;

    // WEAPON 1: Action A -> Single Fast Rapid Cannon (uses 1 fastCharge per shot)
    const wantFast =
      this.input.isDown('actionA') ||
      this.input.isJustPressed('actionA') ||
      this.input.pointer.down;

    if (wantFast && p.fastCooldown <= 0 && p.fastCharge > 0) {
      p.fastCharge--;
      p.fastCooldown = 0.095;
      this.fastBullets.push({
        x: p.x,
        y: p.y - 18,
        vy: -680
      });
      this.audio.playLaser(1280, 420, 0.055);
    }

    // WEAPON 2: Action B (or fallback when Fast Cannon out of charge) -> Dual Slow Twin-Blaster
    const wantTwin =
      this.input.isJustPressed('actionB') ||
      (wantFast && p.fastCharge <= 0 && this.twinBullets.length === 0);

    if (wantTwin && this.twinBullets.length === 0) {
      this.twinBullets.push(
        { x: p.x - 16, y: p.y - 12, vy: -390 },
        { x: p.x + 16, y: p.y - 12, vy: -390 }
      );
      this.audio.playLaser(640, 210, 0.09);
    }
  }

  updateWeapons(dt) {
    // Update Single Fast Cannon bullets
    for (let i = this.fastBullets.length - 1; i >= 0; i--) {
      const b = this.fastBullets[i];
      b.y += b.vy * dt;
      if (b.y < 44) {
        this.fastBullets.splice(i, 1);
        continue;
      }
      if (this.checkBulletHitEnemy(b.x, b.y, 12)) {
        this.fastBullets.splice(i, 1);
      }
    }

    // Update Dual Slow Twin-Blaster bullets
    for (let i = this.twinBullets.length - 1; i >= 0; i--) {
      const b = this.twinBullets[i];
      b.y += b.vy * dt;
      if (b.y < 44) {
        this.twinBullets.splice(i, 1);
        continue;
      }
      if (this.checkBulletHitEnemy(b.x, b.y, 14)) {
        this.twinBullets.splice(i, 1);
      }
    }

    // Update Enemy Plasma Pellets
    const p = this.player;
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const eb = this.enemyBullets[i];
      eb.x += eb.vx * dt;
      eb.y += eb.vy * dt;
      if (eb.y > 540 || eb.x < 0 || eb.x > 960) {
        this.enemyBullets.splice(i, 1);
        continue;
      }
      if (p.invulnTimer <= 0 && Math.hypot(eb.x - p.x, eb.y - p.y) < 15) {
        this.enemyBullets.splice(i, 1);
        this.killPlayer();
        return;
      }
    }
  }

  checkBulletHitEnemy(bx, by, hitRadius) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const scale = Math.max(0.45, 1.25 - e.z * 0.75);
      if (Math.hypot(bx - e.x, by - e.y) <= 18 * scale + hitRadius * 0.4) {
        e.hp--;
        if (e.hp <= 0) {
          // Every enemy destroyed awards +1 Single Fast Cannon Charge!
          this.player.fastCharge = Math.min(99, this.player.fastCharge + 1);
          this.addScore(e.pts, e.x, e.y, PALETTE.GOLD, '+1 CHARGE');
          this.audio.playExplosion(0.26, 1100);
          for (let k = 0; k < 14; k++) {
            const a = (Math.PI * 2 * k) / 14;
            const spd = 40 + Math.random() * 110;
            this.particles.push({
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * spd,
              vy: Math.sin(a) * spd,
              size: 3,
              life: 0.4,
              color: k % 2 === 0 ? e.color : PALETTE.GOLD
            });
          }
          this.enemies.splice(i, 1);
          if (this.waveEnemiesLeft <= 0 && this.enemies.length === 0 && this.stageClearTimer <= 0) {
            this.addScore(1500, 480, 240, PALETTE.GREEN, 'SECTOR CLEARED');
            this.audio.playStageClear();
            this.stageClearTimer = 1.6;
          }
        } else {
          this.audio.playHit();
        }
        return true;
      }
    }
    return false;
  }

  updateEnemies(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      e.age += dt;
      // Swoop forward from distant horizon (z: 1.0 -> 0.25)
      if (e.z > 0.25) {
        e.z = Math.max(0.25, e.z - dt * 0.55);
      }

      // Swirling figure-8 & swooping formation curves
      const t = e.age * 2.4 + e.phase;
      const targetX = e.anchorX + Math.sin(t) * 145;
      const targetY = e.anchorY + Math.cos(t * 1.5) * 62 + (1 - e.z) * 45;
      e.x += (targetX - e.x) * Math.min(1, dt * 4.2);
      e.y += (targetY - e.y) * Math.min(1, dt * 4.2);

      // Fire aimed plasma pellet
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && e.z <= 0.45) {
        e.fireTimer = Math.max(1.1, 2.2 - this.level * 0.12);
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const spd = 225 + this.level * 12;
        this.enemyBullets.push({
          x: e.x,
          y: e.y + 8,
          vx: (dx / dist) * spd,
          vy: (dy / dist) * spd
        });
      }

      // Direct ship collision
      if (p.invulnTimer <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < 22) {
        this.killPlayer();
        return;
      }
    }
  }

  updateEffects(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y += pop.vy * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  render(ctx = this.renderer.ctx) {
    const pal = STAGE_PALETTES[(this.level - 1) % STAGE_PALETTES.length];
    this.renderer.clear(pal.sky);

    this.drawPseudo3DLandscape(ctx, pal);
    this.drawEnemies(ctx);
    this.drawBullets(ctx);
    if (this.deathTimer <= 0) {
      this.drawPlayer(ctx);
    }
    this.drawEffects(ctx);

    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `FAST AMMO:${String(this.player ? this.player.fastCharge : 0).padStart(2, '0')}  [Z]:FAST [X]:TWIN`,
      accent: PALETTE.CYAN
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1983 JALECO PSEUDO-3D INERTIA SHOOTER',
      controls: 'ARROWS: INERTIA THRUST  |  Z/SPACE: FAST CANNON  |  X/SHIFT: TWIN-BLASTER',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.CYAN
    });
  }

  drawPseudo3DLandscape(ctx, pal) {
    ctx.save();
    // Starfield above horizon
    ctx.fillStyle = PALETTE.WHITE;
    for (const s of this.stars) {
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }

    // Horizon Glow
    const grad = ctx.createLinearGradient(0, this.horizonY - 35, 0, this.horizonY + 20);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.7, pal.horizon);
    grad.addColorStop(1, pal.groundA);
    ctx.fillStyle = grad;
    ctx.fillRect(0, this.horizonY - 35, 960, 55);

    // Perspective Scrolling Scanline Bands & Canyon Trenches
    const totalH = 540 - this.horizonY;
    const bands = 18;
    for (let i = 0; i < bands; i++) {
      const t0 = Math.pow(i / bands, 1.7);
      const t1 = Math.pow((i + 1) / bands, 1.7);
      const y0 = this.horizonY + t0 * totalH;
      const y1 = this.horizonY + t1 * totalH;
      const stripe = Math.floor(i + this.scrollZ * 0.04) % 2 === 0;
      ctx.fillStyle = stripe ? pal.groundA : pal.groundB;
      ctx.fillRect(0, y0, 960, y1 - y0 + 1);

      // Undulating alien terrain ridges
      const waveOffset = Math.sin(i * 0.55 - this.animTime * 4) * (25 + t0 * 95);
      const canyonW = 140 + t0 * 440;
      const cx = 480 + waveOffset - (this.player ? (this.player.x - 480) * 0.25 * t0 : 0);
      ctx.fillStyle = pal.ridge;
      ctx.globalAlpha = 0.28 + t0 * 0.45;
      ctx.fillRect(cx - canyonW * 0.5, y0, 14 + t0 * 24, Math.max(2, (y1 - y0) * 0.55));
      ctx.fillRect(cx + canyonW * 0.5, y0, 14 + t0 * 24, Math.max(2, (y1 - y0) * 0.55));
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawPlayer(ctx) {
    const p = this.player;
    if (p.invulnTimer > 0 && Math.floor(this.animTime * 18) % 2 === 0) return;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.bankAngle);

    // Thruster afterburner plume
    ctx.fillStyle = Math.floor(this.animTime * 24) % 2 === 0 ? PALETTE.ORANGE : PALETTE.GOLD;
    ctx.beginPath();
    ctx.moveTo(-7, 14);
    ctx.lineTo(0, 27);
    ctx.lineTo(7, 14);
    ctx.fill();

    // Swept Delta Wings (perspective foreshortened when banking)
    const wingSpan = 26 * (1 - Math.abs(p.bankAngle) * 0.4);
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(wingSpan, 14);
    ctx.lineTo(-wingSpan, 14);
    ctx.closePath();
    ctx.fill();

    // Twin Wingtip Blasters
    ctx.fillStyle = PALETTE.RED;
    ctx.fillRect(-wingSpan, 2, 5, 14);
    ctx.fillRect(wingSpan - 5, 2, 5, 14);

    // Center Fuselage & Nose Cannon
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(-6, -16, 12, 30);
    ctx.fillStyle = PALETTE.CYAN;
    ctx.fillRect(-3, -6, 6, 10);

    ctx.restore();

    // Inertia Velocity Vector Indicator Bar below ship
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(p.x - 24, p.y + 26, 48, 4);
    ctx.fillStyle = PALETTE.GOLD;
    ctx.fillRect(p.x, p.y + 26, (p.vx / p.maxSpeed) * 24, 4);
    ctx.restore();
  }

  drawEnemies(ctx) {
    ctx.save();
    for (const e of this.enemies) {
      const scale = Math.max(0.45, 1.25 - e.z * 0.75);
      const flap = Math.sin(this.animTime * 18 + e.phase) * 7 * scale;
      ctx.fillStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 8;

      // Alien Bird Wings
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x - 20 * scale, e.y - flap);
      ctx.lineTo(e.x - 10 * scale, e.y + 8 * scale);
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + 20 * scale, e.y - flap);
      ctx.lineTo(e.x + 10 * scale, e.y + 8 * scale);
      ctx.fill();

      // Core Body
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(e.x - 5 * scale, e.y - 5 * scale, 10 * scale, 10 * scale);
    }
    ctx.restore();
  }

  drawBullets(ctx) {
    ctx.save();
    // Single Fast Rapid Cannon shots (Gold streaks)
    ctx.fillStyle = PALETTE.GOLD;
    ctx.shadowColor = PALETTE.GOLD;
    ctx.shadowBlur = 10;
    for (const b of this.fastBullets) {
      ctx.fillRect(b.x - 2.5, b.y - 10, 5, 18);
    }

    // Dual Slow Twin-Blaster shots (Cyan twin bolts)
    ctx.fillStyle = PALETTE.CYAN;
    ctx.shadowColor = PALETTE.CYAN;
    for (const b of this.twinBullets) {
      ctx.fillRect(b.x - 3, b.y - 8, 6, 14);
    }

    // Enemy Plasma Pellets
    ctx.fillStyle = PALETTE.PINK;
    ctx.shadowColor = PALETTE.PINK;
    for (const eb of this.enemyBullets) {
      ctx.beginPath();
      ctx.arc(eb.x, eb.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawEffects(ctx) {
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size * 0.5, pt.y - pt.size * 0.5, pt.size, pt.size);
    }
    for (const pop of this.popups) {
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HEADER,
        size: 9.5,
        color: pop.color,
        align: 'center',
        glow: 6
      });
    }
  }
}

export default Exerion;
