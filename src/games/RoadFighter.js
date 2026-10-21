/**
 * RoadFighter.js
 * Classic 1984 High-Speed Vertical Highway Racer — Retro Arcade Studio Edition.
 * Race at 0..400 km/h across winding highways and narrowing bridges, collect Rainbow Fuel Cars
 * (+15 Fuel!), dodge oil slicks and weaving yellow trucks, and counter-steer into skids to recover!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const COURSE_LENGTH = 9500;

export class RoadFighter {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'roadfighter';
    this.title = 'Turbo Highway';
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
    this._initHighway();
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.audio.stopSequence();
  }

  _initHighway() {
    this.distance = 0;
    this.fuel = 85;
    this.traffic = [];
    this.hazards = [];
    this.spawnTimer = 0.45;

    this.player = {
      x: 480,
      y: 438,
      speedKmh: 0,
      skidTimer: 0,
      skidDir: 0,
      invuln: 1.8
    };
  }

  // Computes road center X and half-width at a given world Y coordinate
  _getRoadGeometry(worldDist) {
    const curve =
      Math.sin(worldDist * 0.0014) * 95 +
      Math.cos(worldDist * 0.00075) * 45;
    const isBridge = worldDist > 3600 && worldDist < 6200;
    const halfWidth = isBridge ? 140 : 185;
    return {
      centerX: 480 + curve,
      halfWidth,
      isBridge
    };
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

  _spawnTrafficOrHazard() {
    const aheadDist = this.distance + 620;
    const geom = this._getRoadGeometry(aheadDist);
    const laneOffset = (Math.random() * 2 - 1) * (geom.halfWidth - 36);

    if (Math.random() < 0.22) {
      this.hazards.push({
        type: Math.random() < 0.5 ? 'OIL' : 'BARREL',
        dist: aheadDist,
        x: geom.centerX + laneOffset
      });
      return;
    }

    const roll = Math.random();
    let type = 'CRUISER'; // Steady blue car
    if (roll < 0.22) type = 'FUEL_CAR'; // Rainbow fuel bonus car!
    else if (roll < 0.58) type = 'WEAVER'; // Yellow lane-changing car
    else if (roll < 0.78) type = 'TRUCK'; // Heavy slow truck

    this.traffic.push({
      type,
      dist: aheadDist,
      laneOffset,
      speedKmh: type === 'TRUCK' ? 170 : 215,
      weaveDone: false
    });
  }

  _crashGuardrail() {
    if (this.player.invuln > 0) return;
    this.audio.playExplosion(0.5, 650);
    this.renderer.shake(12, 0.4);
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 170;
      this.particles.push({
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        color: i % 2 === 0 ? PALETTE.ORANGE : PALETTE.RED,
        life: 0.45
      });
    }

    this.lives--;
    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.state = 'GAMEOVER';
      this.audio.playGameOver();
      return;
    }

    const geom = this._getRoadGeometry(this.distance);
    this.player.x = geom.centerX;
    this.player.speedKmh = 0;
    this.player.skidTimer = 0;
    this.player.invuln = 2.2;
    this.fuel = Math.max(45, this.fuel - 8);
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

    // 1. Acceleration (Action A / Up = High Gear up to 330 km/h, Action B = Turbo 400 km/h)
    const axis = this.input.getAxis();
    const turbo = this.input.isDown('actionB');
    const gas = this.input.isDown('actionA') || this.input.isDown('up') || turbo || axis.y < -0.1;
    const brake = this.input.isDown('down') || axis.y > 0.25;

    if (this.fuel <= 0) {
      p.speedKmh = Math.max(0, p.speedKmh - 140 * dt);
      if (p.speedKmh <= 5) {
        this.fuel = 65;
        this._crashGuardrail();
        return;
      }
    } else if (brake) {
      p.speedKmh = Math.max(0, p.speedKmh - 260 * dt);
    } else if (gas) {
      const maxKmh = turbo ? 400 : 340;
      p.speedKmh = Math.min(maxKmh, p.speedKmh + (turbo ? 195 : 145) * dt);
    } else {
      // Gentle cruise minimum so game stays action-packed even if user only steers
      p.speedKmh = Math.max(210, p.speedKmh - 85 * dt);
    }

    // Drain Fuel & Advance Highway Distance
    this.fuel = Math.max(0, this.fuel - (2.4 + (p.speedKmh / 400) * 1.4) * dt);
    const pixelsPerSec = p.speedKmh * 1.85;
    this.distance += pixelsPerSec * dt;
    this.score += Math.floor(pixelsPerSec * dt * 0.15);
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }

    // Check Finish Line!
    if (this.distance >= COURSE_LENGTH) {
      const bonus = Math.round(this.fuel * 50);
      this.audio.playStageClear();
      this._addScore(3000 + bonus, this.width * 0.5, 160, `STAGE CLEAR! +${3000 + bonus}`, PALETTE.GREEN);
      this.level++;
      this._initHighway();
      return;
    }

    // 2. Steering & Counter-Steer Skid Recovery!
    if (p.skidTimer > 0) {
      p.skidTimer -= dt;
      p.x += p.skidDir * 240 * dt;
      // Counter-steering in the direction of the skid recovers control immediately!
      if ((p.skidDir > 0 && axis.x > 0.3) || (p.skidDir < 0 && axis.x < -0.3)) {
        p.skidTimer = 0;
        this.audio.playCoin();
        this._addScore(250, p.x, p.y - 30, 'SAVED SKID! +250', PALETTE.CYAN);
      }
    } else {
      p.x += axis.x * 275 * dt;
    }

    // Check Guardrail Boundaries at Player's position
    const playerGeom = this._getRoadGeometry(this.distance);
    if (Math.abs(p.x - playerGeom.centerX) > playerGeom.halfWidth - 16) {
      this._crashGuardrail();
      return;
    }

    // 3. Spawn & Update Traffic and Hazards
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && p.speedKmh > 120) {
      this.spawnTimer = Math.max(0.32, 0.65 - this.level * 0.05);
      this._spawnTrafficOrHazard();
    }

    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const hz = this.hazards[i];
      const screenY = p.y - (hz.dist - this.distance);
      if (screenY > this.height + 60) {
        this.hazards.splice(i, 1);
        continue;
      }
      if (Math.hypot(hz.x - p.x, screenY - p.y) < 26 && p.invuln <= 0) {
        this.hazards.splice(i, 1);
        p.skidTimer = 0.55;
        p.skidDir = Math.random() < 0.5 ? -1 : 1;
        this.audio.playHit();
      }
    }

    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const car = this.traffic[i];
      car.dist += car.speedKmh * 1.85 * dt;
      const relDist = car.dist - this.distance;
      const screenY = p.y - relDist;

      if (screenY > this.height + 80 || screenY < -240) {
        this.traffic.splice(i, 1);
        continue;
      }

      const geom = this._getRoadGeometry(car.dist);
      // Yellow Weaver cars shift lanes as player approaches!
      if (car.type === 'WEAVER' && !car.weaveDone && relDist < 220 && relDist > 70) {
        car.weaveDone = true;
        car.laneOffset += p.x > geom.centerX + car.laneOffset ? 42 : -42;
      }

      const carX = geom.centerX + car.laneOffset;
      if (Math.abs(carX - p.x) < 28 && Math.abs(screenY - p.y) < 38) {
        if (car.type === 'FUEL_CAR') {
          // Rainbow Fuel Car awards +15 Fuel & +1000 Bonus!
          this.fuel = Math.min(100, this.fuel + 15);
          this.audio.playPowerUp();
          this._addScore(1000, carX, screenY, 'FUEL +15 (+1000)', PALETTE.PINK);
          this.traffic.splice(i, 1);
        } else if (car.type === 'TRUCK') {
          this._crashGuardrail();
          return;
        } else if (p.skidTimer <= 0) {
          // Lateral clip triggers spinning skid! Counter-steer to save it!
          p.skidTimer = 0.6;
          p.skidDir = p.x >= carX ? 1 : -1;
          this.audio.playHit();
          this.renderer.shake(5, 0.15);
        }
      }
    }

    // 4. Particles & Popups
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

  render(ctx = this.renderer.ctx) {
    const p = this.player;
    this.renderer.clear('#064E3B');

    // 1. Render Scrolling Winding Highway Strip-by-Strip
    const sliceH = 12;
    for (let sy = 40; sy < this.height; sy += sliceH) {
      const worldDist = this.distance + (p.y - sy);
      const geom = this._getRoadGeometry(worldDist);
      const stripe = Math.floor(worldDist / 42) % 2 === 0;

      // Water under bridge vs Forest verge
      ctx.fillStyle = geom.isBridge ? '#0C4A6E' : stripe ? '#064E3B' : '#065F46';
      ctx.fillRect(150, sy, 660, sliceH);

      // Asphalt Roadway
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(geom.centerX - geom.halfWidth, sy, geom.halfWidth * 2, sliceH);

      // Red/White Guardrail Curbs
      ctx.fillStyle = stripe ? PALETTE.RED : PALETTE.WHITE;
      ctx.fillRect(geom.centerX - geom.halfWidth - 8, sy, 8, sliceH);
      ctx.fillRect(geom.centerX + geom.halfWidth, sy, 8, sliceH);

      // Dashed Highway Lane Dividers
      if (stripe) {
        ctx.fillStyle = PALETTE.WHITE;
        ctx.fillRect(geom.centerX - 3, sy, 6, sliceH);
        ctx.fillRect(geom.centerX - geom.halfWidth * 0.5, sy, 4, sliceH);
        ctx.fillRect(geom.centerX + geom.halfWidth * 0.5, sy, 4, sliceH);
      }
    }

    // 2. Render Oil Puddles & Construction Barrels
    for (const hz of this.hazards) {
      const sy = p.y - (hz.dist - this.distance);
      if (sy < 40 || sy > this.height) continue;
      if (hz.type === 'OIL') {
        ctx.fillStyle = '#090D16';
        ctx.beginPath();
        ctx.ellipse(hz.x, sy, 16, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        this.renderer.drawGlowCircle(hz.x, sy, 11, PALETTE.ORANGE, 8, true);
      }
    }

    // 3. Render Highway Traffic & Rainbow Fuel Cars
    for (const car of this.traffic) {
      const sy = p.y - (car.dist - this.distance);
      if (sy < 40 || sy > this.height) continue;
      const geom = this._getRoadGeometry(car.dist);
      const cx = geom.centerX + car.laneOffset;

      let col = PALETTE.BLUE;
      if (car.type === 'FUEL_CAR') {
        col = Math.floor(performance.now() * 0.02) % 2 === 0 ? PALETTE.PINK : PALETTE.CYAN;
      } else if (car.type === 'WEAVER') {
        col = PALETTE.GOLD;
      } else if (car.type === 'TRUCK') {
        col = PALETTE.MUTED;
      }

      const h = car.type === 'TRUCK' ? 54 : 36;
      this.renderer.drawGlowRect(cx - 14, sy - h * 0.5, 28, h, col, 8, true);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(cx - 10, sy - 8, 20, 10);
    }

    // 4. Render Player Red Turbo Sports Car
    if (p.invuln <= 0 || Math.floor(p.invuln * 14) % 2 === 0) {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.skidTimer > 0) {
        ctx.rotate(p.skidDir * 0.48);
      }
      this.renderer.drawGlowRect(-15, -20, 30, 40, PALETTE.RED, 12, true);
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(-3, -20, 6, 40);
      ctx.fillStyle = PALETTE.CYAN;
      ctx.fillRect(-11, -8, 22, 10);
      ctx.restore();
    }

    // 5. Left Progress Minimap & Right Speedometer/Fuel Dashboard
    ctx.save();
    ctx.fillStyle = 'rgba(11, 15, 25, 0.92)';
    ctx.fillRect(0, 38, 150, this.height - 38);
    ctx.fillRect(810, 38, 150, this.height - 38);

    // Course Progress Bar (Left)
    this.renderer.drawText('FINISH', 75, 68, {
      font: FONTS.HEADER,
      size: 10,
      color: PALETTE.GOLD,
      align: 'center'
    });
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.strokeRect(63, 80, 24, 380);
    const prog = Math.min(1, this.distance / COURSE_LENGTH);
    this.renderer.drawGlowRect(66, 80 + (1 - prog) * 374, 18, prog * 374, PALETTE.GREEN, 8, true);

    // Speedometer & Fuel (Right)
    this.renderer.drawText(`${Math.round(p.speedKmh)}`, 885, 115, {
      font: FONTS.HEADER,
      size: 22,
      color: p.speedKmh > 350 ? PALETTE.PINK : PALETTE.CYAN,
      align: 'center',
      glow: 10
    });
    this.renderer.drawText('KM/H', 885, 138, {
      font: FONTS.HEADER,
      size: 11,
      color: PALETTE.MUTED,
      align: 'center'
    });

    this.renderer.drawText('FUEL', 885, 195, {
      font: FONTS.HEADER,
      size: 12,
      color: this.fuel < 25 ? PALETTE.RED : PALETTE.GOLD,
      align: 'center'
    });
    this.renderer.drawText(`${Math.ceil(this.fuel)}`, 885, 230, {
      font: FONTS.HEADER,
      size: 22,
      color: this.fuel < 25 ? PALETTE.RED : PALETTE.GREEN,
      align: 'center',
      glow: 8
    });
    ctx.restore();

    // 6. Particles & Popups
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

    // 7. Top HUD & State Overlay
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `FUEL:${Math.ceil(this.fuel)}`,
      accent: PALETTE.RED
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1984 HIGH-SPEED HIGHWAY RACER',
      controls: 'LEFT/RIGHT: STEER & COUNTER-STEER SKIDS  |  Z: GAS  |  X: TURBO 400 KM/H',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.RED
    });
  }
}

export default RoadFighter;
