/**
 * Asteroids.js
 * Classic 1979 Vector Space Shooter — Retro Arcade Studio Edition.
 * Features glowing vector polygons, inertial rocket thrust, screen wrap-around,
 * rock splitting (Large -> 2 Medium -> 2 Small), Hyperspace jump, and hunting UFOs.
 */
import { Vector2 } from '../engine/Vector2.js';
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

export class Asteroids {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'asteroids';
    this.title = 'Meteor Vector';
    this.width = 960;
    this.height = 540;
    this.arenaTop = 40;

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.nextExtraLife = 10000;

    this.stars = [];
    for (let i = 0; i < 65; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: this.arenaTop + Math.random() * (this.height - this.arenaTop),
        alpha: 0.15 + Math.random() * 0.45,
        size: Math.random() < 0.25 ? 2 : 1
      });
    }

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.nextExtraLife = 10000;

    this.bullets = [];
    this.ufoBullets = [];
    this.asteroids = [];
    this.particles = [];
    this.popups = [];
    this.ufo = null;
    this.ufoTimer = 11;

    this.beatTimer = 0;
    this.beatInterval = 0.65;
    this.waveClearTimer = 0;

    this._spawnShip(true);
    this._spawnWave(this.level);
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.audio.stopSequence();
  }

  _spawnShip(initial = false) {
    this.ship = {
      pos: new Vector2(this.width / 2, (this.height + this.arenaTop) / 2),
      vel: new Vector2(0, 0),
      angle: -Math.PI / 2,
      radius: 13,
      invuln: initial ? 2.2 : 2.8,
      dead: false,
      respawnTimer: 0,
      thrusting: false,
      fireCooldown: 0,
      hyperCooldown: 0,
      flamePhase: 0
    };
  }

  _spawnWave(level) {
    this.asteroids = [];
    const count = Math.min(11, 3 + level);
    for (let i = 0; i < count; i++) {
      let x = Math.random() * this.width;
      let y = this.arenaTop + Math.random() * (this.height - this.arenaTop);
      const cx = this.ship ? this.ship.pos.x : this.width / 2;
      const cy = this.ship ? this.ship.pos.y : (this.height + this.arenaTop) / 2;
      if (Math.hypot(x - cx, y - cy) < 160) {
        const ang = Math.random() * Math.PI * 2;
        x = (cx + Math.cos(ang) * 220 + this.width) % this.width;
        y = this.arenaTop + ((cy - this.arenaTop + Math.sin(ang) * 180 + (this.height - this.arenaTop)) % (this.height - this.arenaTop));
      }
      this.asteroids.push(this._createAsteroid(x, y, 3));
    }
    this.ufoTimer = Math.max(6, 13 - level * 0.8);
  }

  _createAsteroid(x, y, sizeTier) {
    // sizeTier: 3 = Large (20pts), 2 = Medium (50pts), 1 = Small (100pts)
    const radius = sizeTier === 3 ? 42 : sizeTier === 2 ? 23 : 12;
    const speedBase = sizeTier === 3 ? 65 : sizeTier === 2 ? 115 : 175;
    const speed = (speedBase + this.level * 8) * (0.75 + Math.random() * 0.5);
    const angle = Math.random() * Math.PI * 2;

    const numVerts = sizeTier === 3 ? 11 : sizeTier === 2 ? 9 : 8;
    const verts = [];
    for (let i = 0; i < numVerts; i++) {
      const a = (i / numVerts) * Math.PI * 2;
      const jag = 0.72 + Math.random() * 0.44;
      verts.push({ a, r: radius * jag });
    }

    return {
      pos: new Vector2(x, y),
      vel: Vector2.fromAngle(angle, speed),
      sizeTier,
      radius,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * (4 - sizeTier) * 1.4,
      verts,
      color: sizeTier === 3 ? PALETTE.CYAN : sizeTier === 2 ? PALETTE.BLUE : PALETTE.WHITE
    };
  }

  _spawnUFO() {
    const isSmall = this.score >= 3000 ? Math.random() < 0.55 : Math.random() < 0.25;
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -24 : this.width + 24;
    const y = this.arenaTop + 50 + Math.random() * (this.height - this.arenaTop - 100);
    const speed = isSmall ? 145 : 105;
    this.ufo = {
      pos: new Vector2(x, y),
      vel: new Vector2(fromLeft ? speed : -speed, (Math.random() - 0.5) * 70),
      isSmall,
      radius: isSmall ? 13 : 22,
      dirTimer: 1.2 + Math.random() * 1.2,
      fireTimer: 0.9,
      sirenTimer: 0
    };
  }

  _wrapPosition(pos) {
    const arenaH = this.height - this.arenaTop;
    if (pos.x < 0) pos.x += this.width;
    else if (pos.x >= this.width) pos.x -= this.width;

    if (pos.y < this.arenaTop) pos.y += arenaH;
    else if (pos.y >= this.height) pos.y -= arenaH;
  }

  _addScore(pts, x = null, y = null, color = PALETTE.GOLD) {
    this.score += pts;
    if (this.score >= this.nextExtraLife) {
      this.lives = Math.min(6, this.lives + 1);
      this.nextExtraLife += 10000;
      this.audio.playPowerUp();
      this.popups.push({
        x: this.width / 2,
        y: 90,
        text: 'EXTRA SHIP!',
        color: PALETTE.GREEN,
        life: 1.5
      });
    }
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
        life: 0.75
      });
    }
  }

  _spawnDebris(x, y, color, count = 14, lineDebris = false) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 35 + Math.random() * 150;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.45 + Math.random() * 0.5,
        maxLife: 0.85,
        color,
        isLine: lineDebris && i < 5,
        rot: Math.random() * Math.PI * 2,
        rotSpd: (Math.random() - 0.5) * 7,
        len: 8 + Math.random() * 8
      });
    }
  }

  _splitAsteroid(index) {
    const rock = this.asteroids[index];
    this.asteroids.splice(index, 1);

    const pts = rock.sizeTier === 3 ? 20 : rock.sizeTier === 2 ? 50 : 100;
    this._addScore(pts, rock.pos.x, rock.pos.y, rock.sizeTier === 1 ? PALETTE.GOLD : PALETTE.CYAN);

    const filterFreq = rock.sizeTier === 3 ? 520 : rock.sizeTier === 2 ? 900 : 1500;
    this.audio.playExplosion(rock.sizeTier === 3 ? 0.42 : 0.28, filterFreq);
    this.renderer.shake(rock.sizeTier * 2.2, 0.16);
    this._spawnDebris(rock.pos.x, rock.pos.y, rock.color, 10 + rock.sizeTier * 4, true);

    if (rock.sizeTier > 1) {
      const nextTier = rock.sizeTier - 1;
      for (let i = 0; i < 2; i++) {
        const child = this._createAsteroid(rock.pos.x, rock.pos.y, nextTier);
        const spreadAngle = rock.vel.angle() + (i === 0 ? 0.55 : -0.55) + (Math.random() - 0.5) * 0.4;
        const spd = child.vel.len();
        child.vel.set(Math.cos(spreadAngle) * spd, Math.sin(spreadAngle) * spd);
        this.asteroids.push(child);
      }
    }
  }

  _killShip() {
    if (this.ship.dead || this.ship.invuln > 0) return;
    this.ship.dead = true;
    this.ship.respawnTimer = 1.8;
    this.lives--;
    this.audio.playExplosion(0.55, 700);
    this.renderer.shake(9, 0.35);
    this._spawnDebris(this.ship.pos.x, this.ship.pos.y, PALETTE.CYAN, 24, true);

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

    // Background heartbeat tempo scales with remaining asteroids
    const remCount = Math.max(1, this.asteroids.length);
    this.beatInterval = Math.max(0.18, Math.min(0.75, 0.16 + remCount * 0.045));
    this.beatTimer -= dt;
    if (this.beatTimer <= 0 && this.asteroids.length > 0) {
      this.beatTimer = this.beatInterval;
      this.audio.playMarch();
    }

    // Ship update
    const ship = this.ship;
    if (ship.dead) {
      ship.respawnTimer -= dt;
      if (ship.respawnTimer <= 0) {
        if (this.lives <= 0) {
          this.state = 'GAMEOVER';
          this.audio.playGameOver();
          return;
        }
        // Wait for safe spawn center if rocks are right in the middle
        const cx = this.width / 2;
        const cy = (this.height + this.arenaTop) / 2;
        const danger = this.asteroids.some((a) => Math.hypot(a.pos.x - cx, a.pos.y - cy) < a.radius + 65);
        if (!danger || ship.respawnTimer < -1.5) {
          this._spawnShip(false);
        }
      }
    } else {
      if (ship.invuln > 0) ship.invuln = Math.max(0, ship.invuln - dt);
      if (ship.fireCooldown > 0) ship.fireCooldown = Math.max(0, ship.fireCooldown - dt);
      if (ship.hyperCooldown > 0) ship.hyperCooldown = Math.max(0, ship.hyperCooldown - dt);

      const turnSpeed = 4.4;
      if (this.input.isDown('left')) ship.angle -= turnSpeed * dt;
      if (this.input.isDown('right')) ship.angle += turnSpeed * dt;

      ship.thrusting = this.input.isDown('up');
      if (ship.thrusting) {
        const accel = 290;
        ship.vel.x += Math.cos(ship.angle) * accel * dt;
        ship.vel.y += Math.sin(ship.angle) * accel * dt;
        ship.vel.limit(340);
        ship.flamePhase += dt * 30;

        if (Math.random() < 0.65) {
          const backAng = ship.angle + Math.PI + (Math.random() - 0.5) * 0.45;
          const tailX = ship.pos.x + Math.cos(ship.angle + Math.PI) * 12;
          const tailY = ship.pos.y + Math.sin(ship.angle + Math.PI) * 12;
          this.particles.push({
            x: tailX,
            y: tailY,
            vx: Math.cos(backAng) * (60 + Math.random() * 60) + ship.vel.x * 0.2,
            vy: Math.sin(backAng) * (60 + Math.random() * 60) + ship.vel.y * 0.2,
            life: 0.16 + Math.random() * 0.14,
            maxLife: 0.3,
            color: Math.random() < 0.5 ? PALETTE.ORANGE : PALETTE.GOLD,
            isLine: false
          });
        }
      }

      // Slight space drag so inertia feels authentic yet controllable
      const drag = Math.pow(0.992, dt * 60);
      ship.vel.scale(drag);
      ship.pos.addScaled(ship.vel, dt);
      this._wrapPosition(ship.pos);

      // Fire photon torpedo (Action A)
      if ((this.input.isJustPressed('actionA') || (this.input.isDown('actionA') && ship.fireCooldown <= 0)) && this.bullets.length < 5) {
        ship.fireCooldown = 0.17;
        const speed = 520;
        const noseX = ship.pos.x + Math.cos(ship.angle) * 15;
        const noseY = ship.pos.y + Math.sin(ship.angle) * 15;
        this.bullets.push({
          pos: new Vector2(noseX, noseY),
          vel: new Vector2(
            Math.cos(ship.angle) * speed + ship.vel.x * 0.35,
            Math.sin(ship.angle) * speed + ship.vel.y * 0.35
          ),
          life: 1.05
        });
        this.audio.playLaser(1250, 240, 0.1);
      }

      // Hyperspace Jump (Action B or Down)
      if ((this.input.isJustPressed('actionB') || this.input.isJustPressed('down')) && ship.hyperCooldown <= 0) {
        this._spawnDebris(ship.pos.x, ship.pos.y, PALETTE.PURPLE, 14, false);
        ship.pos.x = 60 + Math.random() * (this.width - 120);
        ship.pos.y = this.arenaTop + 50 + Math.random() * (this.height - this.arenaTop - 100);
        ship.vel.set(0, 0);
        ship.invuln = 0.65;
        ship.hyperCooldown = 0.9;
        this.audio.playJump();
        this._spawnDebris(ship.pos.x, ship.pos.y, PALETTE.CYAN, 14, false);
      }
    }

    // Update player bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.pos.addScaled(b.vel, dt);
      this._wrapPosition(b.pos);
      b.life -= dt;
      if (b.life <= 0) {
        this.bullets.splice(i, 1);
      }
    }

    // Update UFO bullets
    for (let i = this.ufoBullets.length - 1; i >= 0; i--) {
      const b = this.ufoBullets[i];
      b.pos.addScaled(b.vel, dt);
      this._wrapPosition(b.pos);
      b.life -= dt;
      if (b.life <= 0) {
        this.ufoBullets.splice(i, 1);
        continue;
      }
      if (!ship.dead && ship.invuln <= 0 && b.pos.dist(ship.pos) < ship.radius + 4) {
        this.ufoBullets.splice(i, 1);
        this._killShip();
      }
    }

    // Update UFO saucer
    if (!this.ufo) {
      this.ufoTimer -= dt;
      if (this.ufoTimer <= 0) {
        this._spawnUFO();
      }
    } else {
      const u = this.ufo;
      u.pos.addScaled(u.vel, dt);
      // Wrap vertically within arena
      if (u.pos.y < this.arenaTop + 20) u.pos.y = this.height - 20;
      if (u.pos.y > this.height - 20) u.pos.y = this.arenaTop + 20;

      u.dirTimer -= dt;
      if (u.dirTimer <= 0) {
        u.dirTimer = 1.0 + Math.random() * 1.4;
        const r = Math.random();
        u.vel.y = r < 0.33 ? -75 : r < 0.66 ? 75 : 0;
      }

      u.sirenTimer -= dt;
      if (u.sirenTimer <= 0) {
        u.sirenTimer = 0.28;
        this.audio.playSiren(u.isSmall ? 0.2 : 0.6, false);
      }

      u.fireTimer -= dt;
      if (u.fireTimer <= 0 && !ship.dead) {
        u.fireTimer = u.isSmall ? 1.05 : 1.45;
        let aimAngle = Math.random() * Math.PI * 2;
        if (u.isSmall) {
          const scatter = Math.max(0.06, 0.28 - this.level * 0.03);
          aimAngle = Math.atan2(ship.pos.y - u.pos.y, ship.pos.x - u.pos.x) + (Math.random() - 0.5) * scatter;
        }
        this.ufoBullets.push({
          pos: u.pos.clone(),
          vel: Vector2.fromAngle(aimAngle, 340),
          life: 1.35
        });
        this.audio.playLaser(780, 320, 0.09);
      }

      // Check if UFO left horizontal bounds
      if (u.pos.x < -45 || u.pos.x > this.width + 45) {
        this.ufo = null;
        this.ufoTimer = Math.max(6, 12 - this.level * 0.6);
      }
    }

    // Update Asteroids & collisions
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const rock = this.asteroids[i];
      rock.pos.addScaled(rock.vel, dt);
      rock.rot += rock.rotSpeed * dt;
      this._wrapPosition(rock.pos);

      // Ship vs Asteroid
      if (!ship.dead && ship.invuln <= 0) {
        if (rock.pos.dist(ship.pos) < rock.radius + ship.radius - 3) {
          this._splitAsteroid(i);
          this._killShip();
          continue;
        }
      }

      // Player Bullets vs Asteroid
      let hitByBullet = false;
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        if (rock.pos.dist(this.bullets[j].pos) < rock.radius + 4) {
          this.bullets.splice(j, 1);
          this._splitAsteroid(i);
          hitByBullet = true;
          break;
        }
      }
      if (hitByBullet) continue;
    }

    // Bullets & Ship vs UFO
    if (this.ufo) {
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        if (this.ufo && this.ufo.pos.dist(this.bullets[j].pos) < this.ufo.radius + 5) {
          this.bullets.splice(j, 1);
          const pts = this.ufo.isSmall ? 1000 : 200;
          this._addScore(pts, this.ufo.pos.x, this.ufo.pos.y, PALETTE.PINK);
          this.audio.playExplosion(0.45, 1100);
          this.renderer.shake(7, 0.25);
          this._spawnDebris(this.ufo.pos.x, this.ufo.pos.y, PALETTE.PINK, 20, true);
          this.ufo = null;
          this.ufoTimer = Math.max(7, 13 - this.level * 0.7);
          break;
        }
      }
      if (this.ufo && !ship.dead && ship.invuln <= 0) {
        if (this.ufo.pos.dist(ship.pos) < this.ufo.radius + ship.radius) {
          this._spawnDebris(this.ufo.pos.x, this.ufo.pos.y, PALETTE.PINK, 18, true);
          this.ufo = null;
          this.ufoTimer = 10;
          this._killShip();
        }
      }
    }

    // Particles & Popups
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.isLine) p.rot += p.rotSpd * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 28 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }

    // Wave clear progression
    if (this.asteroids.length === 0 && !this.ufo) {
      this.waveClearTimer += dt;
      if (this.waveClearTimer >= 1.4) {
        this.waveClearTimer = 0;
        this.level++;
        this.audio.playStageClear();
        this._spawnWave(this.level);
      }
    } else {
      this.waveClearTimer = 0;
    }
  }

  _drawAsteroidVector(ctx, rock, offsetX = 0, offsetY = 0) {
    ctx.save();
    ctx.translate(rock.pos.x + offsetX, rock.pos.y + offsetY);
    ctx.rotate(rock.rot);
    ctx.strokeStyle = rock.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = rock.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let i = 0; i < rock.verts.length; i++) {
      const v = rock.verts[i];
      const vx = Math.cos(v.a) * v.r;
      const vy = Math.sin(v.a) * v.r;
      if (i === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear(PALETTE.BG);

    // Subtle deep space stars
    for (const s of this.stars) {
      ctx.fillStyle = `rgba(248, 250, 252, ${s.alpha})`;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }

    // Render Polygonal Vector Asteroids
    for (const rock of this.asteroids) {
      this._drawAsteroidVector(ctx, rock, 0, 0);
      // Seamless edge wrap-around ghosting when straddling screen edge
      if (rock.pos.x < rock.radius) this._drawAsteroidVector(ctx, rock, this.width, 0);
      if (rock.pos.x > this.width - rock.radius) this._drawAsteroidVector(ctx, rock, -this.width, 0);
    }

    // Render UFO Saucer
    if (this.ufo) {
      const u = this.ufo;
      const r = u.radius;
      ctx.save();
      ctx.translate(u.pos.x, u.pos.y);
      ctx.strokeStyle = PALETTE.PINK;
      ctx.lineWidth = 2;
      ctx.shadowColor = PALETTE.PINK;
      ctx.shadowBlur = 12;

      ctx.beginPath();
      // Classic vector saucer silhouette
      ctx.moveTo(-r, 0);
      ctx.lineTo(-r * 0.45, -r * 0.42);
      ctx.lineTo(r * 0.45, -r * 0.42);
      ctx.lineTo(r, 0);
      ctx.lineTo(r * 0.55, r * 0.42);
      ctx.lineTo(-r * 0.55, r * 0.42);
      ctx.closePath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      // Upper dome
      ctx.moveTo(-r * 0.35, -r * 0.42);
      ctx.lineTo(-r * 0.2, -r * 0.78);
      ctx.lineTo(r * 0.2, -r * 0.78);
      ctx.lineTo(r * 0.35, -r * 0.42);
      ctx.stroke();
      ctx.restore();
    }

    // Render Player Vector Ship
    const ship = this.ship;
    if (!ship.dead) {
      const blinkVisible = ship.invuln <= 0 || Math.floor(ship.invuln * 14) % 2 === 0;
      if (blinkVisible) {
        ctx.save();
        ctx.translate(ship.pos.x, ship.pos.y);
        ctx.rotate(ship.angle);

        // Shield halo if invulnerable
        if (ship.invuln > 0) {
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.38)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, 20, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Rocket Thrust Flame
        if (ship.thrusting && Math.sin(ship.flamePhase) > -0.3) {
          ctx.strokeStyle = PALETTE.ORANGE;
          ctx.shadowColor = PALETTE.ORANGE;
          ctx.shadowBlur = 12;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-9, -5);
          ctx.lineTo(-19 - Math.random() * 6, 0);
          ctx.lineTo(-9, 5);
          ctx.stroke();
        }

        // Vector A-Frame Ship
        ctx.strokeStyle = PALETTE.CYAN;
        ctx.shadowColor = PALETTE.CYAN;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-12, -10);
        ctx.lineTo(-7, -4);
        ctx.lineTo(-7, 4);
        ctx.lineTo(-12, 10);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }

    // Render Torpedoes
    for (const b of this.bullets) {
      this.renderer.drawGlowCircle(b.pos.x, b.pos.y, 2.5, PALETTE.WHITE, 10, true);
    }
    for (const b of this.ufoBullets) {
      this.renderer.drawGlowCircle(b.pos.x, b.pos.y, 3, PALETTE.PINK, 10, true);
    }

    // Render Particles & Vector Line Debris
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = p.color;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      if (p.isLine) {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-p.len / 2, 0);
        ctx.lineTo(p.len / 2, 0);
        ctx.stroke();
      } else {
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }
      ctx.restore();
    }

    // Floating Score Popups
    for (const pop of this.popups) {
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HUD,
        size: 13,
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
      extraLabel: `ROCKS: ${this.asteroids.length}`,
      accent: PALETTE.CYAN
    });

    // State Overlay
    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1979 VECTOR SPACE SHOOTER',
      controls: 'LEFT/RIGHT: ROTATE  |  UP: THRUST  |  Z/SPACE: TORPEDO  |  X/SHIFT: HYPERSPACE',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.CYAN
    });
  }
}

export default Asteroids;
