/**
 * LunarLander.js
 * Classic 1979 Atari Vector Arcade Simulator (Lunar Lander / Apollo Lander) for Retro Arcade Studio.
 *
 * Features:
 * - Glowing phosphor vector graphics Lunar Excursion Module (ascent/descent stages, landing struts,
 *   RCS attitude puffs, and dynamic main thruster flame plume)
 * - Authentic lunar gravity, momentum conservation, fuel gauge (`this.fuel`), and live vector telemetry
 *   readouts (`ALTITUDE`, `VX`, `VY`, `ANGLE`) with safe-threshold color coding
 * - Multi-stage jagged lunar mountain ranges with flashing `2X`, `3X`, and `5X` multiplier landing pads
 * - Gentle touchdown detection (`Math.abs(vy) < 28`, `Math.abs(vx) < 22`, upright angle) + flag planting!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

export class LunarLander {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'lunarlander';
    this.title = 'Lunar Lander';
    this.state = 'PLAYING';

    this.width = 960;
    this.height = 540;
    this.highScore = HighScoreStore.get(this.id);

    this.stars = [];
    for (let i = 0; i < 70; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: 42 + Math.random() * 340,
        size: i % 5 === 0 ? 2 : 1.2,
        alpha: 0.35 + Math.random() * 0.65
      });
    }

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.fuel = 1000;
    this.maxFuel = 1000;

    this.debris = [];
    this.particles = [];
    this.floatingTexts = [];
    this.plantedFlags = [];

    this._generateTerrain(this.level);
    this._spawnLander();
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    if (this.audio) {
      this.audio.stopSequence();
    }
  }

  _spawnLander() {
    this.lander = {
      x: 130,
      y: 96,
      vx: 42,
      vy: 0,
      angle: 0,
      thrusting: false,
      rcsDir: 0,
      altitude: 300,
      status: 'flying', // 'flying' | 'landed' | 'crashed'
      statusTimer: 0
    };
    this.bannerText = `SECTOR ${this.level} — GUIDE EAGLE TO LANDING PAD`;
    this.bannerTimer = 2.0;
  }

  _generateTerrain(level) {
    this.terrainPoints = [];
    this.pads = [];
    this.plantedFlags = [];

    // Define 4 landing pads at varied heights and widths across x = 0..960
    const seed = level * 1.37;
    const padConfigs = [
      { x1: 140, x2: 230, mult: 2, y: 425 - ((level * 23) % 70) },
      { x1: 370, x2: 440, mult: 3, y: 468 - ((level * 37) % 60) },
      { x1: 600, x2: 654, mult: 5, y: 486 - ((level * 19) % 45) },
      { x1: 790, x2: 875, mult: 2, y: 410 - ((level * 29) % 80) }
    ];

    this.pads = padConfigs.map((p) => ({
      ...p,
      landed: false
    }));

    const stepX = 16;
    for (let x = 0; x <= this.width; x += stepX) {
      // Check if x falls inside any landing pad
      const pad = this.pads.find((p) => x >= p.x1 && x <= p.x2);
      if (pad) {
        this.terrainPoints.push({ x, y: pad.y, isPad: true, pad });
      } else {
        // Jagged procedural lunar mountains between pads
        const ridge1 = Math.sin(x * 0.015 + seed) * 65;
        const ridge2 = Math.cos(x * 0.042 - seed * 1.7) * 38;
        const crag = Math.sin(x * 0.11 + seed * 3.1) * 18;
        const rawY = 395 + ridge1 + ridge2 + crag;
        const clampedY = Math.max(245, Math.min(508, rawY));
        this.terrainPoints.push({ x, y: clampedY, isPad: false, pad: null });
      }
    }

    // Ensure pad endpoints are exact flat segments in terrainPoints
    for (const pad of this.pads) {
      for (const pt of this.terrainPoints) {
        if (pt.x >= pad.x1 && pt.x <= pad.x2) {
          pt.y = pad.y;
          pt.isPad = true;
          pt.pad = pad;
        }
      }
    }
  }

  _getTerrainHeightAt(x) {
    const clampedX = Math.max(0, Math.min(this.width, x));
    for (let i = 0; i < this.terrainPoints.length - 1; i++) {
      const p1 = this.terrainPoints[i];
      const p2 = this.terrainPoints[i + 1];
      if (clampedX >= p1.x && clampedX <= p2.x) {
        const t = (clampedX - p1.x) / Math.max(1, p2.x - p1.x);
        return {
          y: p1.y + (p2.y - p1.y) * t,
          pad: p1.isPad && p2.isPad && p1.pad === p2.pad ? p1.pad : null
        };
      }
    }
    return { y: 480, pad: null };
  }

  update(dt) {
    const clampedDt = Math.min(dt, 0.05);

    if (this.state === 'MENU' || this.state === 'GAMEOVER') {
      if (this.input.isJustPressed('actionA') || this.input.isJustPressed('any')) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.state === 'PAUSED') {
      if (this.input.isJustPressed('pause') || this.input.isJustPressed('actionA')) {
        this.audio.playMenuSelect();
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.input.isJustPressed('pause')) {
      this.audio.playMenuMove();
      this.state = 'PAUSED';
      return;
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer = Math.max(0, this.bannerTimer - clampedDt);
    }

    this._updateParticles(clampedDt);

    const l = this.lander;
    if (l.status !== 'flying') {
      l.statusTimer -= clampedDt;
      if (l.statusTimer <= 0) {
        if (l.status === 'landed') {
          // Advance level if at least 2 pads landed or 5X pad conquered, else continue sector
          const landedCount = this.pads.filter((p) => p.landed).length;
          if (landedCount >= 2) {
            this.level += 1;
            this._generateTerrain(this.level);
          }
          this._spawnLander();
        } else if (l.status === 'crashed') {
          if (this.lives <= 0) {
            HighScoreStore.submit(this.id, this.score);
            this.audio.playGameOver();
            this.state = 'GAMEOVER';
          } else {
            if (this.fuel < 250) this.fuel = 450;
            this._spawnLander();
          }
        }
      }
      return;
    }

    // Attitude rotation controls (LEFT / RIGHT)
    l.rcsDir = 0;
    const rotSpeed = 2.35;
    if (this.input.isDown('left')) {
      l.angle = Math.max(-Math.PI * 0.48, l.angle - rotSpeed * clampedDt);
      l.rcsDir = -1;
    } else if (this.input.isDown('right')) {
      l.angle = Math.min(Math.PI * 0.48, l.angle + rotSpeed * clampedDt);
      l.rcsDir = 1;
    }

    // Action B: Auto-Retro Stabilizer (levels angle toward 0 and damps horizontal drift)
    if (this.input.isDown('actionB') && this.fuel > 0) {
      l.angle *= Math.max(0, 1 - clampedDt * 7.5);
      l.vx *= Math.max(0, 1 - clampedDt * 2.2);
      this.fuel = Math.max(0, this.fuel - 25 * clampedDt);
    }

    // Main Rocket Thrust (UP or ACTION A)
    const wantsThrust =
      (this.input.isDown('up') || this.input.isDown('actionA')) && this.fuel > 0;
    l.thrusting = wantsThrust;

    const gravity = 30 + Math.min(18, this.level * 2.5);
    let ax = 0;
    let ay = gravity;

    if (wantsThrust) {
      const thrustPower = 82;
      ax += Math.sin(l.angle) * thrustPower;
      ay -= Math.cos(l.angle) * thrustPower;
      this.fuel = Math.max(0, this.fuel - 48 * clampedDt);

      // Emit exhaust particles and lunar surface dust if low
      if (Math.random() < 0.75) {
        const exhaustSpeed = 120 + Math.random() * 80;
        const spread = (Math.random() - 0.5) * 0.35;
        const dirAngle = l.angle + Math.PI / 2 + spread;
        this.particles.push({
          x: l.x - Math.sin(l.angle) * 14,
          y: l.y + Math.cos(l.angle) * 14,
          vx: l.vx + Math.cos(dirAngle) * exhaustSpeed,
          vy: l.vy + Math.sin(dirAngle) * exhaustSpeed,
          life: 0.18 + Math.random() * 0.14,
          maxLife: 0.32,
          size: 2,
          color: Math.random() < 0.5 ? PALETTE.GOLD : PALETTE.ORANGE
        });
      }

      if (Math.floor(( performance.now() ) / 90) % 2 === 0) {
        this.audio.playExplosion(0.06, 420);
      }
    }

    l.vx += ax * clampedDt;
    l.vy += ay * clampedDt;
    l.x += l.vx * clampedDt;
    l.y += l.vy * clampedDt;

    // Horizontal wrap / boundary bounce
    if (l.x < 24) {
      l.x = 24;
      l.vx = Math.abs(l.vx) * 0.5;
    } else if (l.x > this.width - 24) {
      l.x = this.width - 24;
      l.vx = -Math.abs(l.vx) * 0.5;
    }
    if (l.y < 52) {
      l.y = 52;
      l.vy = Math.max(0, l.vy);
    }

    // Calculate live altitude & check surface contact
    const ground = this._getTerrainHeightAt(l.x);
    const footY = l.y + 14;
    l.altitude = Math.max(0, Math.round(ground.y - footY));

    if (footY >= ground.y) {
      l.y = ground.y - 14;
      const onPad =
        ground.pad && l.x - 10 >= ground.pad.x1 && l.x + 10 <= ground.pad.x2;
      const gentleVy = Math.abs(l.vy) < 28;
      const gentleVx = Math.abs(l.vx) < 22;
      const upright = Math.abs(l.angle) < 0.28;

      if (onPad && gentleVy && gentleVx && upright) {
        this._handleTouchdown(ground.pad);
      } else {
        this._handleCrash(onPad, gentleVy, gentleVx, upright);
      }
    }
  }

  _handleTouchdown(pad) {
    const l = this.lander;
    l.status = 'landed';
    l.statusTimer = 2.0;
    l.thrusting = false;
    l.angle = 0;

    const precisionBonus = Math.max(0, Math.round((28 - Math.abs(l.vy)) * 10));
    const pts = (200 + precisionBonus) * pad.mult;
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }

    const fuelBonus = 150 * pad.mult;
    this.fuel = Math.min(this.maxFuel, this.fuel + fuelBonus);
    pad.landed = true;

    this.plantedFlags.push({
      x: l.x + 18,
      y: pad.y
    });

    this.audio.playStageClear();
    this.bannerText = `THE EAGLE HAS LANDED! ${pad.mult}X PAD BONUS +${pts} (+${fuelBonus} FUEL)`;
    this.bannerTimer = 2.0;
    this._spawnFloatingText(`+${pts} (${pad.mult}X)`, l.x, l.y - 28, PALETTE.GREEN);
  }

  _handleCrash(onPad, gentleVy, gentleVx, upright) {
    const l = this.lander;
    l.status = 'crashed';
    l.statusTimer = 2.0;
    l.thrusting = false;
    this.lives -= 1;

    this.renderer.shake(10, 0.4);
    this.audio.playExplosion(0.55, 600);

    let reason = 'CRASHED INTO LUNAR PEAKS!';
    if (onPad) {
      if (!gentleVy) reason = 'HARD IMPACT! VERTICAL VELOCITY TOO HIGH!';
      else if (!gentleVx) reason = 'LATERAL DRIFT TOO FAST!';
      else if (!upright) reason = 'CAPSIZED! LANDER NOT LEVEL!';
    }
    this.bannerText = reason;
    this.bannerTimer = 2.0;

    // Spawn flying vector strut debris
    for (let i = 0; i < 14; i++) {
      const ang = (Math.PI * 2 * i) / 14;
      const spd = 40 + Math.random() * 130;
      this.debris.push({
        x: l.x,
        y: l.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 40,
        angle: Math.random() * Math.PI * 2,
        vAngle: (Math.random() - 0.5) * 8,
        len: 8 + Math.random() * 10,
        life: 1.6
      });
    }
  }

  _spawnFloatingText(text, x, y, color) {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -32,
      life: 1.2,
      maxLife: 1.2,
      color
    });
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 45 * dt;
      d.angle += d.vAngle * dt;
      d.life -= dt;
      if (d.life <= 0) this.debris.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear('#050811');

    // 1. Deep Space Starfield
    ctx.save();
    for (const s of this.stars) {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.restore();

    // 2. Glowing Phosphor Vector Lunar Mountain Terrain
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, this.height);
    for (const pt of this.terrainPoints) {
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.lineTo(this.width, this.height);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 240, 255, 0.06)';
    ctx.fill();

    ctx.strokeStyle = PALETTE.CYAN;
    ctx.lineWidth = 2;
    ctx.shadowColor = PALETTE.CYAN;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let i = 0; i < this.terrainPoints.length; i++) {
      const pt = this.terrainPoints[i];
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    ctx.restore();

    // 3. Highlighted Flat Multiplier Landing Pads (`2X`, `3X`, `5X`)
    const blink = Math.floor(performance.now() / 260) % 2 === 0;
    for (const pad of this.pads) {
      const padColor = pad.landed
        ? PALETTE.GREEN
        : pad.mult >= 5
        ? PALETTE.PINK
        : PALETTE.GOLD;

      this.renderer.drawGlowRect(
        pad.x1,
        pad.y - 3,
        pad.x2 - pad.x1,
        5,
        padColor,
        blink ? 14 : 6
      );

      this.renderer.drawText(
        `${pad.mult}X`,
        (pad.x1 + pad.x2) / 2,
        pad.y + 18,
        {
          font: FONTS.HEADER,
          size: 11,
          color: padColor,
          align: 'center',
          glow: 8
        }
      );
    }

    // 4. Planted Apollo Flags on Conquered Pads
    for (const flag of this.plantedFlags) {
      ctx.save();
      ctx.strokeStyle = PALETTE.WHITE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(flag.x, flag.y);
      ctx.lineTo(flag.x, flag.y - 20);
      ctx.stroke();
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(flag.x, flag.y - 20, 12, 8);
      ctx.restore();
    }

    // 5. Vector Lunar Excursion Module (or Crash Debris)
    if (this.lander.status !== 'crashed') {
      this._renderVectorLander(ctx);
    }

    for (const d of this.debris) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.angle);
      ctx.strokeStyle = PALETTE.WHITE;
      ctx.shadowColor = PALETTE.CYAN;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-d.len / 2, 0);
      ctx.lineTo(d.len / 2, 0);
      ctx.stroke();
      ctx.restore();
    }

    // 6. Exhaust Particles & Floating Score Popups
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 1, pt.y - 1, pt.size, pt.size);
    }
    for (const ft of this.floatingTexts) {
      this.renderer.drawText(ft.text, ft.x, ft.y, {
        font: FONTS.HEADER,
        size: 12,
        color: ft.color,
        align: 'center',
        glow: 10
      });
    }

    // 7. Vector Telemetry Instrument Panel
    this._renderTelemetryPanel(ctx);

    if (this.bannerTimer > 0 && this.state === 'PLAYING') {
      this.renderer.drawText(this.bannerText, this.width / 2, 240, {
        font: FONTS.HEADER,
        size: 13,
        color: PALETTE.GOLD,
        align: 'center',
        glow: 12
      });
    }

    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `FUEL: ${Math.ceil(this.fuel)}`,
      accent: PALETTE.CYAN
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'VECTOR APOLLO LUNAR DESCENT SIMULATOR',
      controls: 'LEFT/RIGHT: ROTATE ATTITUDE  |  UP/Z/SPACE: MAIN THRUST  |  X/SHIFT: AUTO-LEVEL',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.CYAN
    });
  }

  _renderVectorLander(ctx) {
    const l = this.lander;
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.angle);

    ctx.strokeStyle = PALETTE.WHITE;
    ctx.lineWidth = 2;
    ctx.shadowColor = PALETTE.CYAN;
    ctx.shadowBlur = 10;

    // Ascent Stage Octagon
    ctx.beginPath();
    ctx.moveTo(-6, -14);
    ctx.lineTo(6, -14);
    ctx.lineTo(10, -8);
    ctx.lineTo(10, -2);
    ctx.lineTo(6, 2);
    ctx.lineTo(-6, 2);
    ctx.lineTo(-10, -2);
    ctx.lineTo(-10, -8);
    ctx.closePath();
    ctx.stroke();

    // Descent Stage Base & Engine Bell
    ctx.strokeRect(-8, 2, 16, 5);
    ctx.beginPath();
    ctx.moveTo(-4, 7);
    ctx.lineTo(-6, 11);
    ctx.lineTo(6, 11);
    ctx.lineTo(4, 7);
    ctx.stroke();

    // Landing Gear Struts & Footpads
    ctx.beginPath();
    ctx.moveTo(-8, 4);
    ctx.lineTo(-15, 14);
    ctx.moveTo(-18, 14);
    ctx.lineTo(-11, 14);

    ctx.moveTo(8, 4);
    ctx.lineTo(15, 14);
    ctx.moveTo(11, 14);
    ctx.lineTo(18, 14);
    ctx.stroke();

    // Glowing Main Rocket Thruster Plume
    if (l.thrusting) {
      const flameLen = 18 + Math.random() * 14;
      ctx.strokeStyle = PALETTE.GOLD;
      ctx.shadowColor = PALETTE.ORANGE;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(-5, 11);
      ctx.lineTo(0, 11 + flameLen);
      ctx.lineTo(5, 11);
      ctx.stroke();
    }

    // RCS Attitude Thruster Puffs
    if (l.rcsDir !== 0) {
      ctx.strokeStyle = PALETTE.CYAN;
      ctx.beginPath();
      if (l.rcsDir > 0) {
        ctx.moveTo(-10, -6);
        ctx.lineTo(-18, -6);
      } else {
        ctx.moveTo(10, -6);
        ctx.lineTo(18, -6);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  _renderTelemetryPanel(ctx) {
    const l = this.lander;
    const vySafe = Math.abs(l.vy) < 28;
    const vxSafe = Math.abs(l.vx) < 22;
    const angSafe = Math.abs(l.angle) < 0.28;

    ctx.save();
    ctx.fillStyle = 'rgba(11, 15, 25, 0.78)';
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.lineWidth = 1.5;
    ctx.fillRect(16, 48, 225, 92);
    ctx.strokeRect(16, 48, 225, 92);

    this.renderer.drawText(`ALTITUDE: ${String(l.altitude).padStart(4, '0')} M`, 28, 68, {
      font: FONTS.HUD,
      size: 13,
      color: l.altitude < 60 ? PALETTE.GOLD : PALETTE.WHITE
    });
    this.renderer.drawText(`VERT VEL: ${l.vy.toFixed(1)} M/S`, 28, 88, {
      font: FONTS.HUD,
      size: 13,
      color: vySafe ? PALETTE.GREEN : PALETTE.RED
    });
    this.renderer.drawText(`HORZ VEL: ${l.vx.toFixed(1)} M/S`, 28, 108, {
      font: FONTS.HUD,
      size: 13,
      color: vxSafe ? PALETTE.GREEN : PALETTE.RED
    });
    this.renderer.drawText(
      `ATTITUDE: ${Math.round((l.angle * 180) / Math.PI)}°`,
      28,
      128,
      {
        font: FONTS.HUD,
        size: 13,
        color: angSafe ? PALETTE.GREEN : PALETTE.RED
      }
    );

    // Fuel Bar on top-right
    const fuelRatio = Math.max(0, Math.min(1, this.fuel / this.maxFuel));
    ctx.fillStyle = 'rgba(11, 15, 25, 0.78)';
    ctx.fillRect(this.width - 220, 48, 204, 34);
    ctx.strokeRect(this.width - 220, 48, 204, 34);
    this.renderer.drawText('FUEL', this.width - 210, 70, {
      font: FONTS.HEADER,
      size: 9,
      color: fuelRatio < 0.25 ? PALETTE.RED : PALETTE.GOLD
    });
    ctx.fillStyle = fuelRatio < 0.25 ? PALETTE.RED : PALETTE.GREEN;
    ctx.fillRect(this.width - 154, 57, 128 * fuelRatio, 16);
    ctx.restore();
  }
}

export default LunarLander;
