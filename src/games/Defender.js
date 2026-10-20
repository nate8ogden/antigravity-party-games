/**
 * Defender.js
 * Classic 1981 Horizontal Planet Defense Shooter — Retro Arcade Studio Edition.
 * Features a 2880px wrap-around mountain planet, live Top Scanner/Radar Minimap,
 * Lander humanoid abductions, mid-air Humanoid rescue & deposit, Mutants, and Smart Bombs.
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const WORLD_WIDTH = 2880;
const ARENA_TOP = 94; // Scanner sits in y: 40..92
const SCANNER_X = 210;
const SCANNER_Y = 42;
const SCANNER_W = 540;
const SCANNER_H = 48;

export class Defender {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'defender';
    this.title = 'Horizon Vanguard';
    this.width = 960;
    this.height = 540;
    this.worldWidth = WORLD_WIDTH;

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.smartBombs = 3;
    this.level = 1;

    this._generateTerrain();
    this.reset();
  }

  _generateTerrain() {
    this.terrainStep = 24;
    this.terrainPoints = [];
    const count = WORLD_WIDTH / this.terrainStep;
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      const h =
        482 -
        Math.sin(t * 3) * 32 -
        Math.cos(t * 7) * 22 -
        Math.sin(t * 13) * 14;
      this.terrainPoints.push(Math.round(h));
    }

    this.stars = [];
    for (let i = 0; i < 110; i++) {
      this.stars.push({
        wx: Math.random() * WORLD_WIDTH,
        y: ARENA_TOP + 10 + Math.random() * 340,
        color: i % 5 === 0 ? PALETTE.CYAN : i % 7 === 0 ? PALETTE.PINK : PALETTE.WHITE
      });
    }
  }

  getGroundY(wx) {
    const wrapped = ((wx % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;
    const idx = Math.floor(wrapped / this.terrainStep) % this.terrainPoints.length;
    const nextIdx = (idx + 1) % this.terrainPoints.length;
    const frac = (wrapped % this.terrainStep) / this.terrainStep;
    return this.terrainPoints[idx] * (1 - frac) + this.terrainPoints[nextIdx] * frac;
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.smartBombs = 3;
    this.level = 1;
    this.planetDestroyed = false;
    this.smartFlash = 0;

    this.lasers = [];
    this.enemyShots = [];
    this.enemies = [];
    this.humanoids = [];
    this.particles = [];
    this.popups = [];

    this._initHumanoids();
    this._spawnShip();
    this._spawnWave(this.level);
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.audio.stopSequence();
  }

  _initHumanoids() {
    this.humanoids = [];
    for (let i = 0; i < 10; i++) {
      const wx = (i + 0.5) * (WORLD_WIDTH / 10) + (Math.random() - 0.5) * 90;
      this.humanoids.push({
        wx: ((wx % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH,
        y: this.getGroundY(wx) - 8,
        vy: 0,
        walkDir: Math.random() < 0.5 ? -1 : 1,
        state: 'GROUND', // 'GROUND' | 'ABDUCTED' | 'FALLING' | 'CARRIED'
        fallStartY: 0,
        captor: null
      });
    }
  }

  _spawnShip() {
    this.ship = {
      wx: 480,
      y: 280,
      vx: 0,
      vy: 0,
      dir: 1,
      carrying: null,
      fireCooldown: 0,
      bombCooldown: 0,
      invuln: 2.2,
      dead: false,
      respawnTimer: 0
    };
    this.cameraX = this._wrapX(this.ship.wx - 260);
  }

  _spawnWave(level) {
    this.enemies = [];
    const landerCount = 8 + level * 3;
    const bomberCount = Math.min(6, 1 + level);

    for (let i = 0; i < landerCount; i++) {
      let wx = (this.ship.wx + 450 + Math.random() * (WORLD_WIDTH - 900)) % WORLD_WIDTH;
      this.enemies.push({
        type: 'LANDER',
        wx,
        y: ARENA_TOP + 30 + Math.random() * 140,
        vx: (Math.random() < 0.5 ? 1 : -1) * (95 + level * 8),
        vy: 35,
        state: 'PATROL', // 'PATROL' | 'DESCEND' | 'ABDUCTING'
        targetHuman: null,
        fireTimer: 1.4 + Math.random() * 2.0
      });
    }

    for (let i = 0; i < bomberCount; i++) {
      let wx = (this.ship.wx + 600 + Math.random() * (WORLD_WIDTH - 1000)) % WORLD_WIDTH;
      this.enemies.push({
        type: 'BOMBER',
        wx,
        y: ARENA_TOP + 70 + Math.random() * 220,
        vx: (Math.random() < 0.5 ? 1 : -1) * 120,
        vy: 65,
        state: 'PATROL',
        targetHuman: null,
        fireTimer: 1.2 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  _wrapX(wx) {
    return ((wx % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;
  }

  _shortestDeltaX(fromWx, toWx) {
    let dx = toWx - fromWx;
    if (dx > WORLD_WIDTH / 2) dx -= WORLD_WIDTH;
    if (dx < -WORLD_WIDTH / 2) dx += WORLD_WIDTH;
    return dx;
  }

  _worldToScreenX(wx) {
    let dx = wx - this.cameraX;
    if (dx < -WORLD_WIDTH / 2) dx += WORLD_WIDTH;
    if (dx > WORLD_WIDTH / 2) dx -= WORLD_WIDTH;
    return dx;
  }

  _addScore(pts, wx = null, y = null, label = null, color = PALETTE.GOLD) {
    const prev = this.score;
    this.score += pts;
    if (Math.floor(this.score / 10000) > Math.floor(prev / 10000)) {
      this.lives = Math.min(6, this.lives + 1);
      this.smartBombs = Math.min(6, this.smartBombs + 1);
      this.audio.playPowerUp();
    }
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    if (wx !== null && y !== null) {
      this.popups.push({
        wx,
        y,
        text: label || `+${pts}`,
        color,
        life: 1.0
      });
    }
  }

  _spawnExplosion(wx, y, color, count = 18) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 50 + Math.random() * 210;
      this.particles.push({
        wx,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        color,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7
      });
    }
  }

  _triggerSmartBomb() {
    if (this.smartBombs <= 0 || this.ship.bombCooldown > 0) return;
    this.smartBombs--;
    this.ship.bombCooldown = 0.65;
    this.smartFlash = 0.32;
    this.audio.playExplosion(0.55, 1600);
    this.renderer.shake(10, 0.35);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const sx = this._worldToScreenX(e.wx);
      if (sx >= -40 && sx <= this.width + 40) {
        this._releaseAbductedHumanoid(e);
        this._addScore(150, e.wx, e.y, '+150', PALETTE.CYAN);
        this._spawnExplosion(e.wx, e.y, PALETTE.PINK, 15);
        this.enemies.splice(i, 1);
      }
    }
    this.enemyShots = [];
  }

  _releaseAbductedHumanoid(enemy) {
    if (enemy.targetHuman && enemy.targetHuman.captor === enemy) {
      const h = enemy.targetHuman;
      h.captor = null;
      h.state = 'FALLING';
      h.vy = 0;
      h.fallStartY = h.y;
      enemy.targetHuman = null;
    }
  }

  _killShip() {
    if (this.ship.dead || this.ship.invuln > 0) return;
    if (this.ship.carrying) {
      const h = this.ship.carrying;
      h.state = 'FALLING';
      h.vy = 0;
      h.fallStartY = h.y;
      this.ship.carrying = null;
    }
    this.ship.dead = true;
    this.ship.respawnTimer = 1.7;
    this.lives--;
    this.audio.playExplosion(0.6, 650);
    this.renderer.shake(10, 0.4);
    this._spawnExplosion(this.ship.wx, this.ship.y, PALETTE.CYAN, 28);

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

    if (this.smartFlash > 0) this.smartFlash = Math.max(0, this.smartFlash - dt);

    const s = this.ship;
    if (s.dead) {
      s.respawnTimer -= dt;
      if (s.respawnTimer <= 0) {
        if (this.lives <= 0) {
          this.state = 'GAMEOVER';
          this.audio.playGameOver();
          return;
        }
        this._spawnShip();
      }
    } else {
      if (s.invuln > 0) s.invuln = Math.max(0, s.invuln - dt);
      if (s.fireCooldown > 0) s.fireCooldown = Math.max(0, s.fireCooldown - dt);
      if (s.bombCooldown > 0) s.bombCooldown = Math.max(0, s.bombCooldown - dt);

      // Horizontal direction & thrust
      const accelX = 680;
      if (this.input.isDown('left')) {
        s.dir = -1;
        s.vx -= accelX * dt;
      } else if (this.input.isDown('right')) {
        s.dir = 1;
        s.vx += accelX * dt;
      } else {
        s.vx *= Math.pow(0.92, dt * 60);
      }
      s.vx = Math.max(-440, Math.min(440, s.vx));

      // Vertical flight
      const vertSpeed = 260;
      if (this.input.isDown('up')) s.vy = -vertSpeed;
      else if (this.input.isDown('down')) s.vy = vertSpeed;
      else s.vy = 0;

      s.wx = this._wrapX(s.wx + s.vx * dt);
      s.y = Math.max(ARENA_TOP + 18, Math.min(this.height - 20, s.y + s.vy * dt));

      // Smooth camera lead so player sees far ahead in facing direction
      const targetOffset = s.dir > 0 ? 220 : this.width - 220;
      const desiredCamX = this._wrapX(s.wx - targetOffset);
      const camDiff = this._shortestDeltaX(this.cameraX, desiredCamX);
      this.cameraX = this._wrapX(this.cameraX + camDiff * Math.min(1, dt * 7));

      // Exhaust trail particles when thrusting
      if (Math.abs(s.vx) > 60 && Math.random() < 0.7) {
        this.particles.push({
          wx: this._wrapX(s.wx - s.dir * 18),
          y: s.y + (Math.random() - 0.5) * 4,
          vx: -s.dir * (100 + Math.random() * 80),
          vy: (Math.random() - 0.5) * 30,
          color: Math.random() < 0.5 ? PALETTE.ORANGE : PALETTE.CYAN,
          life: 0.14,
          maxLife: 0.18
        });
      }

      // Fire Horizontal Laser Stream (Action A)
      if ((this.input.isJustPressed('actionA') || (this.input.isDown('actionA') && s.fireCooldown <= 0)) && this.lasers.length < 6) {
        s.fireCooldown = 0.13;
        this.lasers.push({
          wx: this._wrapX(s.wx + s.dir * 20),
          y: s.y,
          dir: s.dir,
          speed: 920,
          life: 0.52
        });
        this.audio.playLaser(1500, 260, 0.08);
      }

      // Smart Bomb (Action B)
      if (this.input.isJustPressed('actionB')) {
        this._triggerSmartBomb();
      }

      // If carrying a rescued humanoid, keep them below ship & check ground deposit
      if (s.carrying) {
        const h = s.carrying;
        h.wx = s.wx;
        h.y = s.y + 16;
        const groundY = this.getGroundY(h.wx);
        if (!this.planetDestroyed && h.y >= groundY - 10) {
          h.y = groundY - 8;
          h.state = 'GROUND';
          s.carrying = null;
          this.audio.playCoin();
          this._addScore(500, h.wx, h.y - 12, 'DEPOSITED +500', PALETTE.GREEN);
        }
      }
    }

    // Update Player Lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.wx = this._wrapX(l.wx + l.dir * l.speed * dt);
      l.life -= dt;
      if (l.life <= 0) {
        this.lasers.splice(i, 1);
        continue;
      }

      // Hit enemies
      for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
        const e = this.enemies[eIdx];
        const dx = Math.abs(this._shortestDeltaX(l.wx, e.wx));
        const dy = Math.abs(l.y - e.y);
        if (dx < 26 && dy < 16) {
          this.lasers.splice(i, 1);
          this._releaseAbductedHumanoid(e);
          const pts = e.type === 'MUTANT' ? 150 : e.type === 'BOMBER' ? 250 : 150;
          this._addScore(pts, e.wx, e.y, `+${pts}`, e.type === 'MUTANT' ? PALETTE.PINK : PALETTE.GOLD);
          this.audio.playExplosion(0.32, 1100);
          this._spawnExplosion(e.wx, e.y, e.type === 'MUTANT' ? PALETTE.PINK : PALETTE.GREEN, 16);
          this.enemies.splice(eIdx, 1);
          break;
        }
      }
    }

    // Update Humanoids
    for (let i = this.humanoids.length - 1; i >= 0; i--) {
      const h = this.humanoids[i];
      if (h.state === 'GROUND') {
        h.wx = this._wrapX(h.wx + h.walkDir * 14 * dt);
        h.y = this.getGroundY(h.wx) - 8;
      } else if (h.state === 'FALLING') {
        h.vy += 190 * dt;
        h.y += h.vy * dt;

        // Check mid-air rescue by player ship!
        if (!s.dead && !s.carrying) {
          const dx = Math.abs(this._shortestDeltaX(s.wx, h.wx));
          const dy = Math.abs(s.y - h.y);
          if (dx < 24 && dy < 22) {
            h.state = 'CARRIED';
            s.carrying = h;
            this.audio.playPowerUp();
            this._addScore(500, h.wx, h.y, 'SAVED +500!', PALETTE.CYAN);
            continue;
          }
        }

        // Check landing on ground
        const groundY = this.getGroundY(h.wx);
        if (h.y >= groundY - 8) {
          const fallDist = h.y - h.fallStartY;
          if (fallDist > 195 || this.planetDestroyed) {
            // Fatal fall from high altitude
            this.audio.playHit();
            this._spawnExplosion(h.wx, groundY - 6, PALETTE.RED, 12);
            this.humanoids.splice(i, 1);
          } else {
            // Safe landing from low altitude!
            h.y = groundY - 8;
            h.vy = 0;
            h.state = 'GROUND';
            this.audio.playCoin();
            this._addScore(250, h.wx, h.y - 12, 'SAFE +250', PALETTE.GOLD);
          }
        }
      }
    }

    // Check if all humanoids lost -> Planet Explodes & Landers mutate!
    if (!this.planetDestroyed && this.humanoids.length === 0) {
      this.planetDestroyed = true;
      this.smartFlash = 0.5;
      this.audio.playExplosion(0.8, 400);
      this.renderer.shake(14, 0.6);
      for (const e of this.enemies) {
        e.type = 'MUTANT';
        e.state = 'CHASE';
      }
    }

    // Update Enemies (Landers, Mutants, Bombers)
    for (const e of this.enemies) {
      if (e.type === 'LANDER') {
        if (e.state === 'PATROL') {
          e.wx = this._wrapX(e.wx + e.vx * dt);
          const targetY = this.getGroundY(e.wx) - 110;
          e.y += Math.sign(targetY - e.y) * 45 * dt;
          e.y = Math.max(ARENA_TOP + 24, Math.min(this.height - 50, e.y));

          // Look for an unclaimed ground humanoid nearby to abduct
          if (Math.random() < 0.015 && this.humanoids.length > 0) {
            const candidates = this.humanoids.filter(
              (h) => h.state === 'GROUND' && !this.enemies.some((other) => other.targetHuman === h)
            );
            if (candidates.length > 0) {
              e.targetHuman = candidates[Math.floor(Math.random() * candidates.length)];
              e.state = 'DESCEND';
            }
          }
        } else if (e.state === 'DESCEND') {
          if (!e.targetHuman || e.targetHuman.state !== 'GROUND') {
            e.targetHuman = null;
            e.state = 'PATROL';
          } else {
            const dx = this._shortestDeltaX(e.wx, e.targetHuman.wx);
            e.wx = this._wrapX(e.wx + Math.sign(dx) * Math.min(Math.abs(dx), 125 * dt));
            if (Math.abs(dx) < 18) {
              e.y += 85 * dt;
              if (e.y >= e.targetHuman.y - 14) {
                e.state = 'ABDUCTING';
                e.targetHuman.state = 'ABDUCTED';
                e.targetHuman.captor = e;
                this.audio.playSiren(0.4, true);
              }
            }
          }
        } else if (e.state === 'ABDUCTING') {
          if (!e.targetHuman || e.targetHuman.captor !== e) {
            e.state = 'PATROL';
          } else {
            e.y -= 58 * dt;
            e.targetHuman.wx = e.wx;
            e.targetHuman.y = e.y + 15;
            if (e.y <= ARENA_TOP + 18) {
              // Humanoid consumed at top of screen -> Lander mutates into fast Mutant!
              const idx = this.humanoids.indexOf(e.targetHuman);
              if (idx !== -1) this.humanoids.splice(idx, 1);
              e.targetHuman = null;
              e.type = 'MUTANT';
              e.state = 'CHASE';
              this.audio.playHit();
              this._spawnExplosion(e.wx, e.y, PALETTE.PURPLE, 14);
            }
          }
        }
      } else if (e.type === 'MUTANT') {
        // Mutants aggressively home in on player coordinates with erratic jitter
        const dx = this._shortestDeltaX(e.wx, s.wx);
        const dy = s.y - e.y;
        e.wx = this._wrapX(e.wx + Math.sign(dx) * 185 * dt);
        e.y += (Math.sign(dy) * 135 + (Math.random() - 0.5) * 220) * dt;
        e.y = Math.max(ARENA_TOP + 20, Math.min(this.height - 25, e.y));
      } else if (e.type === 'BOMBER') {
        e.phase += dt * 2.5;
        e.wx = this._wrapX(e.wx + e.vx * dt);
        e.y = ARENA_TOP + 160 + Math.sin(e.phase) * 95;
      }

      // Enemy Firing when near screen viewport
      e.fireTimer -= dt;
      const sx = this._worldToScreenX(e.wx);
      if (e.fireTimer <= 0 && sx >= 0 && sx <= this.width && !s.dead) {
        e.fireTimer = e.type === 'MUTANT' ? 1.1 : 2.1 + Math.random() * 1.4;
        const dx = this._shortestDeltaX(e.wx, s.wx);
        const dy = s.y - e.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const spd = e.type === 'BOMBER' ? 0 : 250;
        this.enemyShots.push({
          wx: e.wx,
          y: e.y,
          vx: (dx / dist) * spd,
          vy: (dy / dist) * spd,
          life: e.type === 'BOMBER' ? 3.2 : 1.9,
          isMine: e.type === 'BOMBER'
        });
      }

      // Collision with Player Ship
      if (!s.dead && s.invuln <= 0) {
        const dx = Math.abs(this._shortestDeltaX(e.wx, s.wx));
        const dy = Math.abs(e.y - s.y);
        if (dx < 20 && dy < 14) {
          this._releaseAbductedHumanoid(e);
          this._killShip();
        }
      }
    }

    // Update Enemy Shots / Bomber Mines
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const sh = this.enemyShots[i];
      sh.wx = this._wrapX(sh.wx + sh.vx * dt);
      sh.y += sh.vy * dt;
      sh.life -= dt;
      if (sh.life <= 0 || sh.y < ARENA_TOP || sh.y > this.height) {
        this.enemyShots.splice(i, 1);
        continue;
      }
      if (!s.dead && s.invuln <= 0) {
        const dx = Math.abs(this._shortestDeltaX(sh.wx, s.wx));
        const dy = Math.abs(sh.y - s.y);
        if (dx < 14 && dy < 12) {
          this.enemyShots.splice(i, 1);
          this._killShip();
        }
      }
    }

    // Update Particles & Popups
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.wx = this._wrapX(pt.wx + pt.vx * dt);
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
    if (this.enemies.length === 0) {
      this.level++;
      // Surviving Humanoid bonus
      const bonus = this.humanoids.length * 100;
      if (bonus > 0) {
        this._addScore(bonus, this.ship.wx, 180, `HUMANOID BONUS +${bonus}`, PALETTE.GOLD);
      }
      this.smartBombs = Math.min(6, this.smartBombs + 1);
      this.audio.playStageClear();
      if (this.level % 3 === 1 && this.planetDestroyed) {
        this.planetDestroyed = false;
        this._initHumanoids();
      }
      this._spawnWave(this.level);
    }
  }

  _drawScanner(ctx) {
    ctx.save();
    // Scanner Panel Frame
    ctx.fillStyle = '#070B14';
    ctx.fillRect(0, 38, this.width, 55);
    ctx.strokeStyle = PALETTE.BLUE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 93);
    ctx.lineTo(this.width, 93);
    ctx.stroke();

    // Radar Minimap Box
    ctx.fillStyle = '#0B1324';
    ctx.fillRect(SCANNER_X, SCANNER_Y, SCANNER_W, SCANNER_H);
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(SCANNER_X, SCANNER_Y, SCANNER_W, SCANNER_H);

    // Map helper converting world coordinate where player is centered on radar
    const mapX = (wx) => {
      const rel = ((wx - this.cameraX - this.width / 2 + WORLD_WIDTH * 1.5) % WORLD_WIDTH) / WORLD_WIDTH;
      return SCANNER_X + rel * SCANNER_W;
    };
    const mapY = (y) => {
      const norm = (y - ARENA_TOP) / (this.height - ARENA_TOP);
      return SCANNER_Y + 4 + Math.max(0, Math.min(1, norm)) * (SCANNER_H - 8);
    };

    // Draw viewport brackets on scanner
    const vpW = (this.width / WORLD_WIDTH) * SCANNER_W;
    const vpX = SCANNER_X + (SCANNER_W - vpW) / 2;
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(vpX, SCANNER_Y + 1, vpW, SCANNER_H - 2);

    // Mini terrain line on scanner
    if (!this.planetDestroyed) {
      ctx.strokeStyle = 'rgba(255, 136, 0, 0.55)';
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const wx = this.cameraX + this.width / 2 - WORLD_WIDTH / 2 + (i / 60) * WORLD_WIDTH;
        const sx = SCANNER_X + (i / 60) * SCANNER_W;
        const sy = mapY(this.getGroundY(wx));
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // Humanoid blips on scanner
    for (const h of this.humanoids) {
      ctx.fillStyle = PALETTE.PINK;
      ctx.fillRect(mapX(h.wx) - 1, mapY(h.y) - 2, 2.5, 4);
    }

    // Enemy blips on scanner
    for (const e of this.enemies) {
      ctx.fillStyle =
        e.type === 'MUTANT'
          ? PALETTE.PURPLE
          : e.type === 'BOMBER'
          ? PALETTE.BLUE
          : e.state === 'ABDUCTING'
          ? PALETTE.RED
          : PALETTE.GREEN;
      ctx.fillRect(mapX(e.wx) - 1.5, mapY(e.y) - 1.5, 3.5, 3.5);
    }

    // Player blip on scanner
    if (!this.ship.dead) {
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(mapX(this.ship.wx) - 2.5, mapY(this.ship.y) - 2, 5, 4);
    }

    // Left / Right side panels next to scanner (Smart Bombs & Humanoid Count)
    this.renderer.drawText(`SMART BOMBS: ${this.smartBombs}`, 20, 65, {
      font: FONTS.HUD,
      size: 14,
      color: PALETTE.GOLD
    });
    for (let b = 0; b < this.smartBombs; b++) {
      this.renderer.drawGlowRect(20 + b * 22, 72, 14, 7, PALETTE.GOLD, 6, true);
    }

    this.renderer.drawText(`HUMANOIDS: ${this.humanoids.length}`, 770, 65, {
      font: FONTS.HUD,
      size: 14,
      color: this.humanoids.length > 0 ? PALETTE.PINK : PALETTE.RED
    });
    this.renderer.drawText('[X/SHIFT] SMART BOMB', 770, 82, {
      font: FONTS.BODY,
      size: 11,
      color: PALETTE.MUTED
    });

    ctx.restore();
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear(this.smartFlash > 0 ? '#2A1848' : PALETTE.BG);

    // Stars
    for (const st of this.stars) {
      const sx = this._worldToScreenX(st.wx);
      if (sx >= 0 && sx <= this.width) {
        ctx.fillStyle = st.color;
        ctx.fillRect(sx, st.y, 2, 2);
      }
    }

    // Alien Mountain Terrain Line
    if (!this.planetDestroyed) {
      ctx.save();
      ctx.strokeStyle = PALETTE.ORANGE;
      ctx.shadowColor = PALETTE.ORANGE;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let sx = 0; sx <= this.width; sx += 16) {
        const wx = this.cameraX + sx;
        const gy = this.getGroundY(wx);
        if (sx === 0) ctx.moveTo(sx, gy);
        else ctx.lineTo(sx, gy);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Humanoids on Surface / Abducted / Falling
    for (const h of this.humanoids) {
      const sx = this._worldToScreenX(h.wx);
      if (sx < -20 || sx > this.width + 20) continue;
      ctx.save();
      ctx.translate(sx, h.y);
      ctx.fillStyle = PALETTE.PINK;
      ctx.fillRect(-3, -6, 6, 7); // Torso
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(-2, -10, 4, 4); // Head
      ctx.fillStyle = PALETTE.CYAN;
      ctx.fillRect(-3, 1, 2, 4); // Legs
      ctx.fillRect(1, 1, 2, 4);
      ctx.restore();
    }

    // Enemies (Landers, Mutants, Bombers)
    for (const e of this.enemies) {
      const sx = this._worldToScreenX(e.wx);
      if (sx < -35 || sx > this.width + 35) continue;

      ctx.save();
      ctx.translate(sx, e.y);

      if (e.type === 'LANDER') {
        const color = e.state === 'ABDUCTING' ? PALETTE.GOLD : PALETTE.GREEN;
        // Tractor beam when descending/abducting
        if (e.state === 'ABDUCTING' && e.targetHuman) {
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-6, 8);
          ctx.lineTo(0, 18);
          ctx.lineTo(6, 8);
          ctx.stroke();
        }
        this.renderer.drawGlowRect(-11, -7, 22, 9, color, 8, true);
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(-6, -11, 12, 4);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-8, 2);
        ctx.lineTo(-12, 9);
        ctx.moveTo(0, 2);
        ctx.lineTo(0, 9);
        ctx.moveTo(8, 2);
        ctx.lineTo(12, 9);
        ctx.stroke();
      } else if (e.type === 'MUTANT') {
        this.renderer.drawGlowRect(-11, -8, 22, 16, PALETTE.PURPLE, 12, false, 2.5);
        ctx.fillStyle = PALETTE.PINK;
        ctx.fillRect(-6, -4, 4, 4);
        ctx.fillRect(2, -4, 4, 4);
      } else if (e.type === 'BOMBER') {
        this.renderer.drawGlowRect(-10, -10, 20, 20, PALETTE.BLUE, 10, false, 2.5);
        this.renderer.drawGlowRect(-5, -5, 10, 10, PALETTE.PINK, 6, true);
      }
      ctx.restore();
    }

    // Player Defender Ship
    const s = this.ship;
    if (!s.dead) {
      const visible = s.invuln <= 0 || Math.floor(s.invuln * 14) % 2 === 0;
      if (visible) {
        const sx = this._worldToScreenX(s.wx);
        ctx.save();
        ctx.translate(sx, s.y);
        ctx.scale(s.dir, 1);

        ctx.fillStyle = PALETTE.CYAN;
        ctx.shadowColor = PALETTE.CYAN;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(20, 2);
        ctx.lineTo(-14, -9);
        ctx.lineTo(-9, 0);
        ctx.lineTo(-16, 6);
        ctx.closePath();
        ctx.fill();

        // Cockpit canopy
        ctx.fillStyle = PALETTE.WHITE;
        ctx.fillRect(-2, -4, 9, 4);
        ctx.restore();
      }
    }

    // Horizontal Multicolor Laser Bolts
    for (const l of this.lasers) {
      const sx = this._worldToScreenX(l.wx);
      if (sx < -60 || sx > this.width + 60) continue;
      this.renderer.drawGlowRect(sx - 24, l.y - 1.5, 48, 3, PALETTE.CYAN, 10, true);
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(sx - 12, l.y - 1, 24, 2);
    }

    // Enemy Shots & Mines
    for (const sh of this.enemyShots) {
      const sx = this._worldToScreenX(sh.wx);
      if (sx < -20 || sx > this.width + 20) continue;
      if (sh.isMine) {
        ctx.strokeStyle = PALETTE.GOLD;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx - 4, sh.y - 4);
        ctx.lineTo(sx + 4, sh.y + 4);
        ctx.moveTo(sx + 4, sh.y - 4);
        ctx.lineTo(sx - 4, sh.y + 4);
        ctx.stroke();
      } else {
        this.renderer.drawGlowCircle(sx, sh.y, 3, PALETTE.PINK, 8, true);
      }
    }

    // Particles
    for (const pt of this.particles) {
      const sx = this._worldToScreenX(pt.wx);
      if (sx >= 0 && sx <= this.width) {
        ctx.fillStyle = pt.color;
        ctx.fillRect(sx - 1.5, pt.y - 1.5, 3, 3);
      }
    }

    // Floating Popups
    for (const pop of this.popups) {
      const sx = this._worldToScreenX(pop.wx);
      if (sx >= 0 && sx <= this.width) {
        this.renderer.drawText(pop.text, sx, pop.y, {
          font: FONTS.HEADER,
          size: 11,
          color: pop.color,
          align: 'center',
          glow: 8
        });
      }
    }

    // Top Scanner / Radar Minimap
    this._drawScanner(ctx);

    // Top HUD
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `ENEMIES: ${this.enemies.length}`,
      accent: PALETTE.CYAN
    });

    // State Overlay
    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1981 PLANET DEFENSE & HUMANOID RESCUE',
      controls: 'ARROWS/WASD: THRUST & FLY  |  Z/SPACE: LASER  |  X/SHIFT: SMART BOMB',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.CYAN
    });
  }
}

export default Defender;
