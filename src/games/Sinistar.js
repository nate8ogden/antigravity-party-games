/**
 * Sinistar.js
 * Classic 1983 Multi-Directional Space Shooter & Boss Assembler — Retro Arcade Studio Edition.
 * Mine glowing Sinibomb Crystals from drifting Planetoids before red Worker Drones
 * snatch them to assemble the 13-piece giant skull boss Sinistar ("BEWARE, I LIVE!").
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const WORLD_SIZE = 2600;
const SINISTAR_MAX_PIECES = 13;

const ZONE_THEMES = [
  { name: 'NORMAL ZONE', bg: '#070B14', nebula: '#1E1B4B', accent: PALETTE.RED },
  { name: 'WORKER ZONE', bg: '#0E0A18', nebula: '#3B0764', accent: PALETTE.ORANGE },
  { name: 'WARRIOR ZONE', bg: '#06121C', nebula: '#0F172A', accent: PALETTE.CYAN },
  { name: 'VOID ZONE', bg: '#110712', nebula: '#31102F', accent: PALETTE.PINK }
];

const TAUNTS = [
  'BEWARE, I LIVE!',
  'I HUNGER, COWARD!',
  'RUN! RUN! RUN!',
  'ROOOAAARGH!',
  'BEWARE, COWARD!'
];

export class Sinistar {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'sinistar';
    this.title = 'Sinistar';
    this.width = 960;
    this.height = 540;

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.stars = [];
    for (let i = 0; i < 140; i++) {
      this.stars.push({
        x: Math.random() * WORLD_SIZE,
        y: Math.random() * WORLD_SIZE,
        size: Math.random() < 0.25 ? 2.5 : 1.5,
        color: [PALETTE.WHITE, PALETTE.CYAN, PALETTE.GOLD, PALETTE.BLUE][i % 4]
      });
    }

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.sinibombs = 4;

    this.particles = [];
    this.popups = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.sinibombProjectiles = [];
    this.crystals = [];

    this._initSector();
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.audio.stopSequence();
  }

  _wrapDelta(d) {
    if (d > WORLD_SIZE * 0.5) return d - WORLD_SIZE;
    if (d < -WORLD_SIZE * 0.5) return d + WORLD_SIZE;
    return d;
  }

  _wrapCoord(v) {
    return ((v % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE;
  }

  _initSector() {
    this.player = {
      x: WORLD_SIZE * 0.5,
      y: WORLD_SIZE * 0.5,
      vx: 0,
      vy: 0,
      angle: -Math.PI * 0.5,
      invuln: 2.2,
      fireCooldown: 0,
      bombCooldown: 0
    };

    this.bullets = [];
    this.enemyBullets = [];
    this.sinibombProjectiles = [];
    this.crystals = [];

    // Spawn Planetoids across the sector
    this.planetoids = [];
    for (let i = 0; i < 22; i++) {
      let px = Math.random() * WORLD_SIZE;
      let py = Math.random() * WORLD_SIZE;
      if (Math.hypot(this._wrapDelta(px - this.player.x), this._wrapDelta(py - this.player.y)) < 260) {
        px = this._wrapCoord(px + 500);
      }
      const rich = i % 3 === 0;
      this.planetoids.push({
        x: px,
        y: py,
        vx: (Math.random() - 0.5) * 38,
        vy: (Math.random() - 0.5) * 38,
        radius: rich ? 34 : 26,
        hp: rich ? 14 : 9,
        crystalsLeft: rich ? 5 : 3,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 1.2,
        rich,
        flash: 0
      });
    }

    // Spawn Worker Drones (red) & Warrior Drones (purple/blue)
    this.enemies = [];
    const numWorkers = 8 + Math.min(6, this.level * 2);
    const numWarriors = 5 + Math.min(7, this.level * 2);

    for (let i = 0; i < numWorkers; i++) {
      this._spawnEnemy('WORKER');
    }
    for (let i = 0; i < numWarriors; i++) {
      this._spawnEnemy('WARRIOR');
    }

    // Sinistar Boss state (starts as construction scaffold far from player)
    const sx = this._wrapCoord(this.player.x + 850);
    const sy = this._wrapCoord(this.player.y - 650);
    this.sinistar = {
      x: sx,
      y: sy,
      vx: 0,
      vy: 0,
      pieces: Math.min(4, this.level),
      maxPieces: SINISTAR_MAX_PIECES,
      alive: false,
      buildTimer: Math.max(2.4, 4.8 - this.level * 0.35),
      tauntTimer: 0,
      bannerTimer: 0,
      bannerText: 'BEWARE, I LIVE!',
      jawOpen: 0,
      flash: 0
    };
  }

  _spawnEnemy(type) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 420 + Math.random() * 750;
    this.enemies.push({
      type,
      x: this._wrapCoord(this.player.x + Math.cos(angle) * dist),
      y: this._wrapCoord(this.player.y + Math.sin(angle) * dist),
      vx: 0,
      vy: 0,
      angle: 0,
      carryingCrystal: false,
      fireTimer: 1.0 + Math.random() * 1.5
    });
  }

  _addScore(pts, wx = null, wy = null, label = null, color = PALETTE.GOLD) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    if (wx !== null && wy !== null) {
      this.popups.push({
        wx,
        wy,
        text: label || `+${pts}`,
        color,
        life: 0.95
      });
    }
  }

  _spawnParticles(wx, wy, color, count = 12, speed = 150) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (0.3 + Math.random() * 0.7) * speed;
      this.particles.push({
        wx,
        wy,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        color,
        life: 0.35 + Math.random() * 0.35
      });
    }
  }

  _triggerRoar(text = null) {
    const s = this.sinistar;
    s.bannerText = text || TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
    s.bannerTimer = 2.2;
    s.jawOpen = 0.8;
    this.renderer.shake(9, 0.35);
    this.audio.playExplosion(0.45, 520);
    this.audio.playChiptune([
      { freq: 110, dur: 0.12, type: 'sawtooth', gain: 0.32 },
      { freq: 92, dur: 0.14, type: 'sawtooth', gain: 0.32 },
      { freq: 73, dur: 0.28, type: 'sawtooth', gain: 0.35 }
    ]);
  }

  _killPlayer() {
    if (this.player.invuln > 0) return;
    this.lives--;
    this.audio.playExplosion(0.5, 700);
    this.renderer.shake(10, 0.35);
    this._spawnParticles(this.player.x, this.player.y, PALETTE.CYAN, 24, 220);

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.state = 'GAMEOVER';
      this.audio.playGameOver();
      return;
    }

    this.player.invuln = 2.5;
    this.player.vx = 0;
    this.player.vy = 0;
    // Push Sinistar back slightly to give breathing room
    const dx = this._wrapDelta(this.sinistar.x - this.player.x);
    const dy = this._wrapDelta(this.sinistar.y - this.player.y);
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < 420) {
      this.sinistar.x = this._wrapCoord(this.player.x + (dx / dist) * 580);
      this.sinistar.y = this._wrapCoord(this.player.y + (dy / dist) * 580);
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

    const p = this.player;
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    if (p.bombCooldown > 0) p.bombCooldown = Math.max(0, p.bombCooldown - dt);

    // 1. Player Steering & Momentum
    const axis = this.input.getAxis();
    if (Math.hypot(axis.x, axis.y) > 0.08) {
      p.angle = Math.atan2(axis.y, axis.x);
      p.vx += axis.x * 680 * dt;
      p.vy += axis.y * 680 * dt;
    } else if (this.input.pointer.down) {
      const pdx = this.input.pointer.x - this.width * 0.5;
      const pdy = this.input.pointer.y - (this.height * 0.5 + 19);
      if (Math.hypot(pdx, pdy) > 16) {
        p.angle = Math.atan2(pdy, pdx);
        p.vx += Math.cos(p.angle) * 620 * dt;
        p.vy += Math.sin(p.angle) * 620 * dt;
      }
    }

    // Clamp player velocity & apply space drag
    const speed = Math.hypot(p.vx, p.vy);
    const maxSpeed = 340;
    if (speed > maxSpeed) {
      p.vx = (p.vx / speed) * maxSpeed;
      p.vy = (p.vy / speed) * maxSpeed;
    }
    p.vx *= Math.pow(0.22, dt);
    p.vy *= Math.pow(0.22, dt);
    p.x = this._wrapCoord(p.x + p.vx * dt);
    p.y = this._wrapCoord(p.y + p.vy * dt);

    // 2. Primary Blaster (Action A)
    if ((this.input.isDown('actionA') || this.input.pointer.down) && p.fireCooldown <= 0) {
      p.fireCooldown = 0.11;
      const bx = this._wrapCoord(p.x + Math.cos(p.angle) * 16);
      const by = this._wrapCoord(p.y + Math.sin(p.angle) * 16);
      this.bullets.push({
        x: bx,
        y: by,
        vx: Math.cos(p.angle) * 680 + p.vx * 0.35,
        vy: Math.sin(p.angle) * 680 + p.vy * 0.35,
        life: 0.68
      });
      this.audio.playLaser(1250, 260, 0.07);
    }

    // 3. Fire Homing Sinibomb (Action B)
    if (this.input.isJustPressed('actionB') && this.sinibombs > 0 && p.bombCooldown <= 0) {
      this.sinibombs--;
      p.bombCooldown = 0.24;
      const dx = this._wrapDelta(this.sinistar.x - p.x);
      const dy = this._wrapDelta(this.sinistar.y - p.y);
      const aimAngle = Math.atan2(dy, dx);
      this.sinibombProjectiles.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(aimAngle) * 520,
        vy: Math.sin(aimAngle) * 520,
        life: 2.4
      });
      this.audio.playPowerUp();
    }

    // 4. Update Player Lasers
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x = this._wrapCoord(b.x + b.vx * dt);
      b.y = this._wrapCoord(b.y + b.vy * dt);
      b.life -= dt;
      if (b.life <= 0) {
        this.bullets.splice(i, 1);
        continue;
      }

      let hit = false;
      // Check Planetoids (Mine Sinibomb Crystals!)
      for (let j = this.planetoids.length - 1; j >= 0; j--) {
        const pl = this.planetoids[j];
        const dx = this._wrapDelta(b.x - pl.x);
        const dy = this._wrapDelta(b.y - pl.y);
        if (Math.hypot(dx, dy) < pl.radius + 4) {
          hit = true;
          pl.hp--;
          pl.flash = 0.12;
          this.audio.playDig();

          // Liberate a glowing Sinibomb Crystal!
          if (pl.crystalsLeft > 0 && (pl.hp % 2 === 0 || pl.hp <= 0)) {
            pl.crystalsLeft--;
            const ca = Math.random() * Math.PI * 2;
            this.crystals.push({
              x: this._wrapCoord(pl.x + Math.cos(ca) * (pl.radius + 8)),
              y: this._wrapCoord(pl.y + Math.sin(ca) * (pl.radius + 8)),
              vx: Math.cos(ca) * 75,
              vy: Math.sin(ca) * 75,
              life: 14.0,
              phase: Math.random() * 6
            });
          }

          if (pl.hp <= 0) {
            this._spawnParticles(pl.x, pl.y, PALETTE.GOLD, 14, 160);
            this._addScore(150, pl.x, pl.y, '+150', PALETTE.GOLD);
            this.planetoids.splice(j, 1);
          }
          break;
        }
      }

      if (hit) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Check Worker & Warrior Drones
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        const dx = this._wrapDelta(b.x - e.x);
        const dy = this._wrapDelta(b.y - e.y);
        if (Math.hypot(dx, dy) < 16) {
          hit = true;
          if (e.carryingCrystal) {
            this.crystals.push({
              x: e.x,
              y: e.y,
              vx: (Math.random() - 0.5) * 60,
              vy: (Math.random() - 0.5) * 60,
              life: 12.0,
              phase: 0
            });
          }
          const pts = e.type === 'WARRIOR' ? 500 : 150;
          this._addScore(pts, e.x, e.y, `+${pts}`, e.type === 'WARRIOR' ? PALETTE.PURPLE : PALETTE.RED);
          this._spawnParticles(e.x, e.y, e.type === 'WARRIOR' ? PALETTE.PURPLE : PALETTE.RED, 12, 170);
          this.audio.playExplosion(0.22, 1100);
          this.enemies.splice(j, 1);
          break;
        }
      }

      if (hit) {
        this.bullets.splice(i, 1);
      }
    }

    // 5. Update Homing Sinibombs
    for (let i = this.sinibombProjectiles.length - 1; i >= 0; i--) {
      const sb = this.sinibombProjectiles[i];
      const dx = this._wrapDelta(this.sinistar.x - sb.x);
      const dy = this._wrapDelta(this.sinistar.y - sb.y);
      const dist = Math.hypot(dx, dy) || 1;
      const targetVx = (dx / dist) * 560;
      const targetVy = (dy / dist) * 560;
      sb.vx += (targetVx - sb.vx) * 6 * dt;
      sb.vy += (targetVy - sb.vy) * 6 * dt;
      sb.x = this._wrapCoord(sb.x + sb.vx * dt);
      sb.y = this._wrapCoord(sb.y + sb.vy * dt);
      sb.life -= dt;

      if (dist < 48) {
        // Direct hit on Sinistar! Blast pieces off!
        this.sinibombProjectiles.splice(i, 1);
        this.sinistar.flash = 0.22;
        this.sinistar.pieces = Math.max(0, this.sinistar.pieces - 2);
        this.renderer.shake(8, 0.25);
        this.audio.playExplosion(0.38, 850);
        this._spawnParticles(this.sinistar.x, this.sinistar.y, PALETTE.ORANGE, 22, 240);
        this._addScore(500, this.sinistar.x, this.sinistar.y, 'SINIBOMB HIT! +500', PALETTE.CYAN);

        // Knock Sinistar back
        this.sinistar.vx -= (dx / dist) * 240;
        this.sinistar.vy -= (dy / dist) * 240;

        if (this.sinistar.pieces <= 0) {
          // SINISTAR DESTROYED!
          this._addScore(15000, this.sinistar.x, this.sinistar.y, 'SINISTAR DESTROYED! +15000', PALETTE.GOLD);
          this._spawnParticles(this.sinistar.x, this.sinistar.y, PALETTE.GOLD, 45, 320);
          this.audio.playStageClear();
          this.renderer.shake(14, 0.5);
          this.level++;
          this.sinibombs = Math.min(20, this.sinibombs + 3);
          this._initSector();
          return;
        }
        continue;
      }

      if (sb.life <= 0) {
        this.sinibombProjectiles.splice(i, 1);
      }
    }

    // 6. Update Planetoids & Sinibomb Crystals
    for (const pl of this.planetoids) {
      pl.x = this._wrapCoord(pl.x + pl.vx * dt);
      pl.y = this._wrapCoord(pl.y + pl.vy * dt);
      pl.rot += pl.rotSpeed * dt;
      if (pl.flash > 0) pl.flash = Math.max(0, pl.flash - dt);
    }
    if (this.planetoids.length < 10) {
      this.planetoids.push({
        x: this._wrapCoord(p.x + 900),
        y: this._wrapCoord(p.y + (Math.random() - 0.5) * 900),
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        radius: 30,
        hp: 10,
        crystalsLeft: 4,
        rot: 0,
        rotSpeed: 0.8,
        rich: true,
        flash: 0
      });
    }

    for (let i = this.crystals.length - 1; i >= 0; i--) {
      const c = this.crystals[i];
      c.x = this._wrapCoord(c.x + c.vx * dt);
      c.y = this._wrapCoord(c.y + c.vy * dt);
      c.vx *= Math.pow(0.5, dt);
      c.vy *= Math.pow(0.5, dt);
      c.phase += dt * 10;
      c.life -= dt;

      // Player collects crystal -> +1 Sinibomb!
      const pdx = this._wrapDelta(c.x - p.x);
      const pdy = this._wrapDelta(c.y - p.y);
      if (Math.hypot(pdx, pdy) < 26) {
        this.sinibombs = Math.min(20, this.sinibombs + 1);
        this.audio.playCoin();
        this._addScore(200, c.x, c.y, 'SINIBOMB +1', PALETTE.CYAN);
        this.crystals.splice(i, 1);
        continue;
      }

      // Worker drone snatches crystal!
      let snatched = false;
      for (const e of this.enemies) {
        if (e.type === 'WORKER' && !e.carryingCrystal) {
          const edx = this._wrapDelta(c.x - e.x);
          const edy = this._wrapDelta(c.y - e.y);
          if (Math.hypot(edx, edy) < 20) {
            e.carryingCrystal = true;
            snatched = true;
            break;
          }
        }
      }
      if (snatched || c.life <= 0) {
        this.crystals.splice(i, 1);
      }
    }

    // 7. Update Worker & Warrior Drones
    if (this.enemies.length < 10 + this.level * 2 && Math.random() < dt * 1.4) {
      this._spawnEnemy(Math.random() < 0.55 ? 'WORKER' : 'WARRIOR');
    }

    for (const e of this.enemies) {
      if (e.type === 'WORKER') {
        let tx = p.x;
        let ty = p.y;
        if (e.carryingCrystal && !this.sinistar.alive) {
          // Deliver crystal to Sinistar scaffold!
          tx = this.sinistar.x;
          ty = this.sinistar.y;
        } else if (this.crystals.length > 0) {
          // Chase nearest free crystal
          const cr = this.crystals[0];
          tx = cr.x;
          ty = cr.y;
        }
        const dx = this._wrapDelta(tx - e.x);
        const dy = this._wrapDelta(ty - e.y);
        const dist = Math.hypot(dx, dy) || 1;
        e.angle = Math.atan2(dy, dx);
        e.vx = (dx / dist) * 195;
        e.vy = (dy / dist) * 195;

        if (e.carryingCrystal && !this.sinistar.alive && dist < 44) {
          e.carryingCrystal = false;
          this.sinistar.pieces = Math.min(SINISTAR_MAX_PIECES, this.sinistar.pieces + 1);
          if (this.sinistar.pieces >= SINISTAR_MAX_PIECES) {
            this.sinistar.alive = true;
            this._triggerRoar('BEWARE, I LIVE!');
          }
        }
      } else {
        // WARRIOR orbits and fires at player
        const dx = this._wrapDelta(p.x - e.x);
        const dy = this._wrapDelta(p.y - e.y);
        const dist = Math.hypot(dx, dy) || 1;
        e.angle = Math.atan2(dy, dx);
        const desiredSpeed = 225;
        e.vx += ((dx / dist) * desiredSpeed - e.vx) * 2.5 * dt;
        e.vy += ((dy / dist) * desiredSpeed - e.vy) * 2.5 * dt;

        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && dist < 440) {
          e.fireTimer = Math.max(0.9, 1.8 - this.level * 0.1);
          this.enemyBullets.push({
            x: e.x,
            y: e.y,
            vx: (dx / dist) * 340,
            vy: (dy / dist) * 340,
            life: 1.6
          });
        }
      }

      e.x = this._wrapCoord(e.x + e.vx * dt);
      e.y = this._wrapCoord(e.y + e.vy * dt);
    }

    // 8. Update Enemy Plasma Bolts
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const eb = this.enemyBullets[i];
      eb.x = this._wrapCoord(eb.x + eb.vx * dt);
      eb.y = this._wrapCoord(eb.y + eb.vy * dt);
      eb.life -= dt;
      if (eb.life <= 0) {
        this.enemyBullets.splice(i, 1);
        continue;
      }
      if (Math.hypot(this._wrapDelta(eb.x - p.x), this._wrapDelta(eb.y - p.y)) < 14) {
        this.enemyBullets.splice(i, 1);
        this._killPlayer();
        break;
      }
    }

    // 9. Update Sinistar Assembly & Boss Pursuit!
    const s = this.sinistar;
    if (s.flash > 0) s.flash = Math.max(0, s.flash - dt);
    if (s.bannerTimer > 0) s.bannerTimer = Math.max(0, s.bannerTimer - dt);
    if (s.jawOpen > 0) s.jawOpen = Math.max(0, s.jawOpen - dt * 1.4);

    if (!s.alive) {
      s.buildTimer -= dt;
      if (s.buildTimer <= 0) {
        s.buildTimer = Math.max(1.8, 3.8 - this.level * 0.25);
        s.pieces++;
        if (s.pieces >= SINISTAR_MAX_PIECES) {
          s.alive = true;
          this._triggerRoar('BEWARE, I LIVE!');
        }
      }
    } else {
      // Sinistar charges toward the player!
      const dx = this._wrapDelta(p.x - s.x);
      const dy = this._wrapDelta(p.y - s.y);
      const dist = Math.hypot(dx, dy) || 1;
      const chaseSpeed = Math.min(335, 235 + this.level * 15);
      s.vx += ((dx / dist) * chaseSpeed - s.vx) * 2.4 * dt;
      s.vy += ((dy / dist) * chaseSpeed - s.vy) * 2.4 * dt;
      s.x = this._wrapCoord(s.x + s.vx * dt);
      s.y = this._wrapCoord(s.y + s.vy * dt);

      s.tauntTimer -= dt;
      if (s.tauntTimer <= 0 && dist < 520) {
        s.tauntTimer = 4.5 + Math.random() * 2.5;
        this._triggerRoar();
      }

      if (dist < 42) {
        this._killPlayer();
      }
    }

    // 10. Particles & Popups
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.wx = this._wrapCoord(pt.wx + pt.vx * dt);
      pt.wy = this._wrapCoord(pt.wy + pt.vy * dt);
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.wy = this._wrapCoord(pop.wy - 28 * dt);
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  _worldToScreen(wx, wy) {
    const dx = this._wrapDelta(wx - this.player.x);
    const dy = this._wrapDelta(wy - this.player.y);
    return {
      x: this.width * 0.5 + dx,
      y: this.height * 0.5 + 19 + dy
    };
  }

  _drawSinistarBoss(ctx, sx, sy) {
    const s = this.sinistar;
    const pieces = s.pieces;
    ctx.save();
    ctx.translate(sx, sy);

    // Wireframe scaffold when under construction
    if (!s.alive) {
      ctx.strokeStyle = 'rgba(255, 42, 85, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-42, -46, 84, 92);
    }

    const skullCol = s.flash > 0 ? PALETTE.WHITE : '#CBD5E1';
    const plateCol = s.flash > 0 ? PALETTE.CYAN : '#64748B';
    const jawOffset = Math.sin(performance.now() * 0.02) * 3 + s.jawOpen * 10;

    // Assemble skull piece by piece (1..13)
    if (pieces >= 1) {
      // Core cranium
      ctx.fillStyle = skullCol;
      ctx.fillRect(-22, -28, 44, 34);
    }
    if (pieces >= 2) {
      // Left & Right brow plates
      ctx.fillStyle = plateCol;
      ctx.fillRect(-34, -22, 12, 24);
    }
    if (pieces >= 3) {
      ctx.fillStyle = plateCol;
      ctx.fillRect(22, -22, 12, 24);
    }
    if (pieces >= 4) {
      // Left glowing red eye socket
      this.renderer.drawGlowRect(-20, -16, 12, 10, PALETTE.RED, 10, true);
    }
    if (pieces >= 5) {
      // Right glowing red eye socket
      this.renderer.drawGlowRect(8, -16, 12, 10, PALETTE.RED, 10, true);
    }
    if (pieces >= 6) {
      // Left horn / crown spike
      ctx.fillStyle = PALETTE.ORANGE;
      ctx.beginPath();
      ctx.moveTo(-34, -22);
      ctx.lineTo(-46, -42);
      ctx.lineTo(-18, -28);
      ctx.closePath();
      ctx.fill();
    }
    if (pieces >= 7) {
      // Right horn / crown spike
      ctx.fillStyle = PALETTE.ORANGE;
      ctx.beginPath();
      ctx.moveTo(34, -22);
      ctx.lineTo(46, -42);
      ctx.lineTo(18, -28);
      ctx.closePath();
      ctx.fill();
    }
    if (pieces >= 8) {
      // Upper fangs
      ctx.fillStyle = PALETTE.WHITE;
      for (let k = -18; k <= 14; k += 8) {
        ctx.fillRect(k, 6, 5, 7);
      }
    }
    if (pieces >= 9) {
      // Lower mandible jaw
      ctx.fillStyle = skullCol;
      ctx.fillRect(-24, 14 + jawOffset, 48, 18);
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(-16, 8, 32, 6 + jawOffset);
    }
    if (pieces >= 10) {
      // Left cheek armor
      ctx.fillStyle = plateCol;
      ctx.fillRect(-40, -2, 16, 20);
    }
    if (pieces >= 11) {
      // Right cheek armor
      ctx.fillStyle = plateCol;
      ctx.fillRect(24, -2, 16, 20);
    }
    if (pieces >= 12) {
      // Forehead ruby emblem
      this.renderer.drawGlowCircle(0, -28, 7, PALETTE.PINK, 12, true);
    }
    if (pieces >= 13) {
      // Aura ring when fully alive
      ctx.strokeStyle = PALETTE.RED;
      ctx.shadowColor = PALETTE.RED;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 50, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  render(ctx = this.renderer.ctx) {
    const theme = ZONE_THEMES[(this.level - 1) % ZONE_THEMES.length];
    this.renderer.clear(theme.bg);

    // 1. Starfield
    for (const st of this.stars) {
      const pos = this._worldToScreen(st.x, st.y);
      if (pos.x >= 0 && pos.x <= this.width && pos.y >= 38 && pos.y <= this.height) {
        ctx.fillStyle = st.color;
        ctx.fillRect(pos.x, pos.y, st.size, st.size);
      }
    }

    // 2. Planetoids
    for (const pl of this.planetoids) {
      const pos = this._worldToScreen(pl.x, pl.y);
      if (pos.x < -60 || pos.x > this.width + 60 || pos.y < 0 || pos.y > this.height + 60) continue;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(pl.rot);
      ctx.fillStyle = pl.flash > 0 ? PALETTE.WHITE : pl.rich ? '#475569' : '#334155';
      ctx.strokeStyle = pl.rich ? PALETTE.CYAN : PALETTE.MUTED;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const sides = 7;
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        const r = pl.radius * (i % 2 === 0 ? 1.0 : 0.82);
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing crystal veins inside rich planetoids
      if (pl.crystalsLeft > 0) {
        this.renderer.drawGlowCircle(6, -4, 4, PALETTE.CYAN, 8, true);
      }
      ctx.restore();
    }

    // 3. Glowing Sinibomb Crystals
    for (const c of this.crystals) {
      const pos = this._worldToScreen(c.x, c.y);
      if (pos.x < -20 || pos.x > this.width + 20 || pos.y < 38 || pos.y > this.height + 20) continue;
      const col = Math.floor(c.phase) % 2 === 0 ? PALETTE.CYAN : PALETTE.GOLD;
      this.renderer.drawGlowCircle(pos.x, pos.y, 6, col, 12, true);
    }

    // 4. Worker & Warrior Drones
    for (const e of this.enemies) {
      const pos = this._worldToScreen(e.x, e.y);
      if (pos.x < -30 || pos.x > this.width + 30 || pos.y < 38 || pos.y > this.height + 30) continue;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(e.angle);
      if (e.type === 'WORKER') {
        this.renderer.drawGlowCircle(0, 0, 9, PALETTE.RED, 8, true);
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(6, -5, 6, 3);
        ctx.fillRect(6, 2, 6, 3);
        if (e.carryingCrystal) {
          this.renderer.drawGlowCircle(12, 0, 4.5, PALETTE.CYAN, 8, true);
        }
      } else {
        // Wedge-shaped Warrior Ship
        ctx.fillStyle = PALETTE.PURPLE;
        ctx.strokeStyle = PALETTE.PINK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-10, -11);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-10, 11);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // 5. Sinistar Boss / Construction Scaffold
    const sPos = this._worldToScreen(this.sinistar.x, this.sinistar.y);
    if (sPos.x > -80 && sPos.x < this.width + 80 && sPos.y > 0 && sPos.y < this.height + 80) {
      this._drawSinistarBoss(ctx, sPos.x, sPos.y);
    }

    // 6. Projectiles (Player Lasers, Sinibombs, Enemy Bolts)
    for (const b of this.bullets) {
      const pos = this._worldToScreen(b.x, b.y);
      this.renderer.drawGlowCircle(pos.x, pos.y, 3.5, PALETTE.GOLD, 8, true);
    }
    for (const sb of this.sinibombProjectiles) {
      const pos = this._worldToScreen(sb.x, sb.y);
      this.renderer.drawGlowCircle(pos.x, pos.y, 7, PALETTE.CYAN, 14, true);
    }
    for (const eb of this.enemyBullets) {
      const pos = this._worldToScreen(eb.x, eb.y);
      this.renderer.drawGlowCircle(pos.x, pos.y, 4, PALETTE.PINK, 8, true);
    }

    // 7. Player Starfighter at Screen Center
    const p = this.player;
    const pPos = { x: this.width * 0.5, y: this.height * 0.5 + 19 };
    if (p.invuln <= 0 || Math.floor(p.invuln * 14) % 2 === 0) {
      ctx.save();
      ctx.translate(pPos.x, pPos.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = PALETTE.WHITE;
      ctx.strokeStyle = PALETTE.CYAN;
      ctx.shadowColor = PALETTE.CYAN;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-12, -11);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-12, 11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 8. Particles & Popups
    for (const pt of this.particles) {
      const pos = this._worldToScreen(pt.wx, pt.wy);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pos.x - 2, pos.y - 2, 4, 4);
    }
    for (const pop of this.popups) {
      const pos = this._worldToScreen(pop.wx, pop.wy);
      this.renderer.drawText(pop.text, pos.x, pos.y, {
        font: FONTS.HEADER,
        size: 11,
        color: pop.color,
        align: 'center',
        glow: 8
      });
    }

    // 9. Live Sector Radar Scanner & Sinibomb Status Panel (Top-Center below HUD)
    const rx = this.width * 0.5 - 70;
    const ry = 44;
    const rw = 140;
    const rh = 76;
    ctx.save();
    ctx.fillStyle = 'rgba(11, 15, 25, 0.88)';
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);

    const scaleX = rw / WORLD_SIZE;
    const scaleY = rh / WORLD_SIZE;
    const toRadar = (wx, wy) => ({
      x: rx + rw * 0.5 + this._wrapDelta(wx - p.x) * scaleX,
      y: ry + rh * 0.5 + this._wrapDelta(wy - p.y) * scaleY
    });

    for (const pl of this.planetoids) {
      const rp = toRadar(pl.x, pl.y);
      ctx.fillStyle = pl.rich ? PALETTE.CYAN : PALETTE.MUTED;
      ctx.fillRect(rp.x - 1.5, rp.y - 1.5, 3, 3);
    }
    for (const e of this.enemies) {
      const rp = toRadar(e.x, e.y);
      ctx.fillStyle = e.type === 'WORKER' ? PALETTE.RED : PALETTE.PURPLE;
      ctx.fillRect(rp.x - 1.5, rp.y - 1.5, 3, 3);
    }
    const srp = toRadar(this.sinistar.x, this.sinistar.y);
    this.renderer.drawGlowCircle(
      srp.x,
      srp.y,
      4.5,
      this.sinistar.alive ? PALETTE.RED : PALETTE.ORANGE,
      8,
      true
    );
    ctx.fillStyle = PALETTE.GREEN;
    ctx.fillRect(rx + rw * 0.5 - 2, ry + rh * 0.5 - 2, 4, 4);
    ctx.restore();

    // Left & Right Status Readouts beside Radar
    this.renderer.drawText(`SINIBOMBS: ${this.sinibombs}`, rx - 15, 68, {
      font: FONTS.HEADER,
      size: 11,
      color: PALETTE.CYAN,
      align: 'right',
      glow: 8
    });
    this.renderer.drawText(`[X / SHIFT] LAUNCH BOMB`, rx - 15, 88, {
      font: FONTS.HUD,
      size: 12,
      color: PALETTE.MUTED,
      align: 'right'
    });

    const statusStr = this.sinistar.alive
      ? 'SINISTAR: LIVE!'
      : `SINISTAR: ${this.sinistar.pieces}/${SINISTAR_MAX_PIECES}`;
    this.renderer.drawText(statusStr, rx + rw + 15, 68, {
      font: FONTS.HEADER,
      size: 11,
      color: this.sinistar.alive ? PALETTE.RED : PALETTE.GOLD,
      align: 'left',
      glow: 8
    });
    this.renderer.drawText(theme.name, rx + rw + 15, 88, {
      font: FONTS.HUD,
      size: 12,
      color: PALETTE.MUTED,
      align: 'left'
    });

    // 10. Iconic "BEWARE, I LIVE!" Roar Alert Banner
    if (this.sinistar.bannerTimer > 0) {
      this.renderer.drawText(this.sinistar.bannerText, this.width * 0.5, 152, {
        font: FONTS.HEADER,
        size: 20,
        color: PALETTE.RED,
        align: 'center',
        glow: 16
      });
    }

    // 11. Top HUD & State Overlay
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `BOMBS:${this.sinibombs}`,
      accent: theme.accent
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1983 MULTI-DIRECTIONAL BOSS SHOOTER',
      controls: 'ARROWS/WASD: FLY  |  Z/SPACE: MINE CRYSTALS  |  X/SHIFT: FIRE SINIBOMB',
      score: this.score,
      highScore: this.highScore,
      accent: theme.accent
    });
  }
}

export default Sinistar;
