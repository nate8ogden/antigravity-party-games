/**
 * MarbleMadness.js
 * Isometric 3D-Grid Course Roller
 * Navigate shaded isometric slope tiles (flat, slopeDown, slopeLeft, slopeRight, chasm, goal)
 * with realistic slope gravity vectors, momentum, bumper rebounds, and chasm drop-offs!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';
import { Vector2 } from '../engine/Vector2.js';

export class MarbleMadness {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'marblemadness';
    this.title = 'Gyro Sphere';
    this.state = 'PLAYING';

    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.tileW = 36;
    this.tileH = 18;
    this.elevScale = 16;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.state = 'PLAYING';
    this.timeLeft = 45.0;

    this.particles = [];
    this.trail = [];
    this._buildCourse(this.level);
  }

  _buildCourse(level) {
    this.grid = new Map();
    this.tileList = [];
    this.bumpers = [];
    this.hazards = [];
    this.levelClearTimer = 0;
    this.timeLeft = Math.max(30, 48 - (level - 1) * 3);

    const setTile = (gx, gy, z, type = 'flat') => {
      const key = `${gx},${gy}`;
      const tile = { gx, gy, z, type };
      this.grid.set(key, tile);
    };

    // Construct a winding multi-elevation isometric course
    let cx = 0;
    let cy = 0;
    let cz = 12;

    // 1. Starting platform (3x4 flat)
    for (let x = -1; x <= 2; x++) {
      for (let y = -1; y <= 2; y++) {
        setTile(x, y, cz, 'flat');
      }
    }

    // 2. First slopeDown chute along +x
    cx = 3;
    for (let step = 0; step < 6; step++) {
      cz -= 0.65;
      for (let w = -1; w <= 1; w++) {
        setTile(cx + step, w, cz, 'slopeRight');
      }
    }
    cx += 6;

    // 3. Landing plaza with arcade bumpers
    for (let x = cx; x <= cx + 4; x++) {
      for (let y = -1; y <= 3; y++) {
        setTile(x, y, cz, 'flat');
      }
    }
    this.bumpers.push({ gx: cx + 2, gy: 0.5, z: cz, r: 0.42, pulse: 0 });
    this.bumpers.push({ gx: cx + 2, gy: 2.0, z: cz, r: 0.42, pulse: 0 });

    // 4. Steep slopeLeft ramp heading down +y
    cy = 4;
    for (let step = 0; step < 7; step++) {
      cz -= 0.7;
      for (let w = cx + 1; w <= cx + 3; w++) {
        setTile(w, cy + step, cz, 'slopeLeft');
      }
    }
    cy += 7;

    // 5. Mid-course turn & chasm bridge section
    for (let x = cx + 1; x <= cx + 5; x++) {
      for (let y = cy; y <= cy + 3; y++) {
        setTile(x, y, cz, 'flat');
      }
    }
    // Roaming black steel enemy marble on mid platform
    this.hazards.push({
      gx: cx + 3,
      gy: cy + 1.5,
      z: cz,
      baseX: cx + 3,
      baseY: cy + 1.5,
      ampX: 1.3,
      ampY: 0.8,
      phase: 0,
      speed: 2.0 + level * 0.35
    });

    // 6. Narrow ridge with slopeDown gradient and side slopes
    const bridgeStartX = cx + 6;
    const bridgeW = level >= 3 ? 1 : 2;
    for (let step = 0; step < 8; step++) {
      cz -= 0.5;
      const bx = bridgeStartX + step;
      for (let y = cy + 1; y <= cy + 1 + bridgeW; y++) {
        const isEdge = step % 2 === 0;
        setTile(bx, y, cz, isEdge ? 'slopeDown' : 'flat');
      }
      // Chasm tiles flanking the bridge for visual depth
      setTile(bx, cy, cz - 3, 'chasm');
      setTile(bx, cy + 2 + bridgeW, cz - 3, 'chasm');
    }

    const finalX = bridgeStartX + 8;
    // 7. Final slalom court with bumpers and Goal Platform
    for (let x = finalX; x <= finalX + 6; x++) {
      for (let y = cy; y <= cy + 5; y++) {
        let tType = 'flat';
        if (x >= finalX + 3 && x <= finalX + 5 && y >= cy + 1 && y <= cy + 4) {
          tType = 'goal';
        } else if (y === cy) {
          tType = 'slopeLeft';
        } else if (y === cy + 5) {
          tType = 'slopeRight';
        }
        setTile(x, y, cz, tType);
      }
    }

    this.bumpers.push({ gx: finalX + 1.5, gy: cy + 1.5, z: cz, r: 0.42, pulse: 0 });
    this.bumpers.push({ gx: finalX + 1.5, gy: cy + 3.5, z: cz, r: 0.42, pulse: 0 });

    if (level >= 2) {
      this.hazards.push({
        gx: finalX + 2.5,
        gy: cy + 2.5,
        z: cz,
        baseX: finalX + 2.5,
        baseY: cy + 2.5,
        ampX: 0.5,
        ampY: 1.6,
        phase: 1.5,
        speed: 2.4 + level * 0.3
      });
    }

    // Sort tiles back-to-front by (gx + gy) for painter's algorithm rendering
    this.tileList = Array.from(this.grid.values()).sort((a, b) => a.gx + a.gy - (b.gx + b.gy));

    // Initialize Marble at start platform
    this.marble = {
      gx: 0.5,
      gy: 0.5,
      z: 12,
      vx: 0,
      vy: 0,
      vz: 0,
      radius: 10,
      safeGx: 0.5,
      safeGy: 0.5,
      safeZ: 12,
      falling: false,
      fallTimer: 0,
      currentTileType: 'flat',
      rollAngle: 0
    };

    this.camera = { x: 0, y: 0 };
    this._updateCamera(1.0);
  }

  _isoProject(gx, gy, z) {
    const sx = (gx - gy) * this.tileW + this.renderer.width / 2 - this.camera.x;
    const sy = (gx + gy) * this.tileH - z * this.elevScale + 230 - this.camera.y;
    return { x: sx, y: sy };
  }

  _updateCamera(lerpFactor = 0.12) {
    const rawX = (this.marble.gx - this.marble.gy) * this.tileW;
    const rawY = (this.marble.gx + this.marble.gy) * this.tileH - this.marble.z * this.elevScale;
    this.camera.x += (rawX - this.camera.x) * lerpFactor;
    this.camera.y += (rawY - this.camera.y) * lerpFactor;
  }

  _getTileAt(gx, gy) {
    const ix = Math.round(gx);
    const iy = Math.round(gy);
    return this.grid.get(`${ix},${iy}`) || null;
  }

  /**
   * Returns the isometric slope gravity vector in grid coordinates for a tile type
   */
  _getSlopeGravityVector(tileType) {
    switch (tileType) {
      case 'slopeDown':
        return new Vector2(2.6, 2.6);
      case 'slopeRight':
        return new Vector2(3.4, 0.4);
      case 'slopeLeft':
        return new Vector2(0.4, 3.4);
      case 'flat':
      case 'goal':
      default:
        return new Vector2(0, 0);
    }
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.particles = [];
    this.trail = [];
  }

  _spawnParticles(gx, gy, z, color, count = 12) {
    const pt = this._isoProject(gx, gy, z);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 110;
      this.particles.push({
        x: pt.x,
        y: pt.y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 30,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        color,
        size: 3 + Math.random() * 3
      });
    }
  }

  update(dt) {
    if (this.state === 'MENU' || this.state === 'GAMEOVER') {
      if (
        this.input.isJustPressed('actionA') ||
        this.input.isJustPressed('actionB') ||
        this.input.pointer.justPressed
      ) {
        this.audio.playMenuSelect();
        this.reset();
        this.setState('PLAYING');
      }
      return;
    }

    if (this.state === 'PAUSED') {
      if (this.input.isJustPressed('actionA') || this.input.isJustPressed('pause')) {
        this.setState('PLAYING');
      }
      return;
    }

    if (this.state !== 'PLAYING') return;

    if (this.levelClearTimer > 0) {
      this.levelClearTimer -= dt;
      if (this.levelClearTimer <= 0) {
        this.level++;
        this._buildCourse(this.level);
      }
      return;
    }

    // Countdown Race Timer
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.lives--;
      if (this.lives <= 0) {
        HighScoreStore.submit(this.id, this.score);
        this.audio.playGameOver();
        this.setState('GAMEOVER');
        return;
      } else {
        this.timeLeft = 20.0;
        this.audio.playHit();
      }
    }

    const m = this.marble;

    // Handle Chasm Fall / Respawn
    if (m.falling) {
      m.fallTimer += dt;
      m.vz -= 26 * dt;
      m.z += m.vz * dt;
      m.gx += m.vx * 0.35 * dt;
      m.gy += m.vy * 0.35 * dt;

      if (m.fallTimer > 0.85) {
        this.lives--;
        if (this.lives <= 0) {
          HighScoreStore.submit(this.id, this.score);
          this.audio.playGameOver();
          this.setState('GAMEOVER');
          return;
        }
        m.gx = m.safeGx;
        m.gy = m.safeGy;
        m.z = m.safeZ;
        m.vx = 0;
        m.vy = 0;
        m.vz = 0;
        m.falling = false;
        m.fallTimer = 0;
        this.trail = [];
        this.audio.playPop();
      }
      this._updateCamera(0.15);
      return;
    }

    // Player Steering (screen-aligned to isometric axes)
    const axis = this.input.getAxis();
    const boost = this.input.isDown('actionA') || this.input.isDown('actionB') ? 1.45 : 1.0;
    const accelStrength = 9.5 * boost;

    // Convert 2D screen input vector into isometric grid acceleration
    const isoAx = (axis.x + axis.y) * 0.7071 * accelStrength;
    const isoAy = (axis.y - axis.x) * 0.7071 * accelStrength;

    // Check current tile under marble
    const tile = this._getTileAt(m.gx, m.gy);
    if (!tile || tile.type === 'chasm') {
      m.falling = true;
      m.fallTimer = 0;
      m.vz = -4;
      m.currentTileType = 'chasm';
      this.audio.playLaser(520, 110, 0.32);
      this.renderer.shake(5, 0.2);
      return;
    }

    m.currentTileType = tile.type;
    m.z += (tile.z - m.z) * Math.min(1, dt * 14);

    // Record safe respawn point on flat tiles
    if (tile.type === 'flat') {
      m.safeGx = tile.gx;
      m.safeGy = tile.gy;
      m.safeZ = tile.z;
    }

    // Apply Isometric Slope Gravity Vector + Player Acceleration
    const slopeGravity = this._getSlopeGravityVector(tile.type);
    m.vx += (isoAx + slopeGravity.x) * dt;
    m.vy += (isoAy + slopeGravity.y) * dt;

    // Track surface damping & momentum cap
    const damping = Math.pow(0.28, dt);
    m.vx *= damping;
    m.vy *= damping;

    const maxSpeed = boost > 1 ? 8.2 : 6.4;
    const speed = Math.hypot(m.vx, m.vy);
    if (speed > maxSpeed) {
      m.vx = (m.vx / speed) * maxSpeed;
      m.vy = (m.vy / speed) * maxSpeed;
    }

    // Integrate marble grid position
    const prevGx = m.gx;
    const prevGy = m.gy;
    m.gx += m.vx * dt;
    m.gy += m.vy * dt;
    m.rollAngle += speed * dt * 4;

    // Award continuous distance progress points
    if (m.gx + m.gy > prevGx + prevGy + 0.01) {
      this.score += Math.floor((m.gx + m.gy - (prevGx + prevGy)) * 25);
      if (this.score > this.highScore) {
        this.highScore = this.score;
        HighScoreStore.submit(this.id, this.score);
      }
    }

    // Bumper Rebound Collisions
    for (const b of this.bumpers) {
      if (b.pulse > 0) b.pulse = Math.max(0, b.pulse - dt * 3);
      const dx = m.gx - b.gx;
      const dy = m.gy - b.gy;
      const dist = Math.hypot(dx, dy);
      const minDist = b.r + 0.28;
      if (dist < minDist && dist > 0.0001) {
        const nx = dx / dist;
        const ny = dy / dist;
        m.gx = b.gx + nx * minDist;
        m.gy = b.gy + ny * minDist;
        // Reflect velocity + elastic bumper kick
        const dot = m.vx * nx + m.vy * ny;
        m.vx = (m.vx - 2 * dot * nx) * 0.9 + nx * 4.2;
        m.vy = (m.vy - 2 * dot * ny) * 0.9 + ny * 4.2;
        b.pulse = 1.0;
        this.score += 100;
        this.audio.playHop();
        this.renderer.shake(3, 0.08);
        this._spawnParticles(b.gx, b.gy, b.z, PALETTE.PINK, 8);
      }
    }

    // Roaming Enemy Steel Marble Collisions
    for (const h of this.hazards) {
      h.phase += h.speed * dt;
      h.gx = h.baseX + Math.cos(h.phase) * h.ampX;
      h.gy = h.baseY + Math.sin(h.phase) * h.ampY;

      const dx = m.gx - h.gx;
      const dy = m.gy - h.gy;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.56 && dist > 0.0001) {
        const nx = dx / dist;
        const ny = dy / dist;
        m.vx = nx * 6.0;
        m.vy = ny * 6.0;
        this.audio.playShove();
        this.renderer.shake(5, 0.14);
        this._spawnParticles(m.gx, m.gy, m.z, PALETTE.ORANGE, 10);
      }
    }

    // Update ribbon trail
    const proj = this._isoProject(m.gx, m.gy, m.z);
    this.trail.push({ gx: m.gx, gy: m.gy, z: m.z, life: 0.35 });
    if (this.trail.length > 18) this.trail.shift();
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life -= dt;
      if (this.trail[i].life <= 0) this.trail.splice(i, 1);
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Check Goal Platform Reach!
    if (tile.type === 'goal') {
      const timeBonus = Math.floor(this.timeLeft * 100);
      this.score += 1500 + timeBonus;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        HighScoreStore.submit(this.id, this.score);
      }
      this.audio.playStageClear();
      this._spawnParticles(m.gx, m.gy, m.z, PALETTE.GOLD, 28);
      this.levelClearTimer = 1.8;
    }

    this._updateCamera(0.15);
  }

  _drawIsoTile(ctx, tile) {
    const { gx, gy, z, type } = tile;
    if (type === 'chasm') return;

    // Corner elevation adjustments to visually slant slope tiles
    let zN = z;
    let zE = z;
    let zS = z;
    let zW = z;

    if (type === 'slopeRight') {
      zN += 0.32;
      zW += 0.32;
      zE -= 0.32;
      zS -= 0.32;
    } else if (type === 'slopeLeft') {
      zN += 0.32;
      zE += 0.32;
      zW -= 0.32;
      zS -= 0.32;
    } else if (type === 'slopeDown') {
      zN += 0.38;
      zS -= 0.38;
    }

    const pN = this._isoProject(gx - 0.5, gy - 0.5, zN);
    const pE = this._isoProject(gx + 0.5, gy - 0.5, zE);
    const pS = this._isoProject(gx + 0.5, gy + 0.5, zS);
    const pW = this._isoProject(gx - 0.5, gy + 0.5, zW);

    const skirtDepth = 22;

    // Left vertical skirt face (pW -> pS)
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.moveTo(pW.x, pW.y);
    ctx.lineTo(pS.x, pS.y);
    ctx.lineTo(pS.x, pS.y + skirtDepth);
    ctx.lineTo(pW.x, pW.y + skirtDepth);
    ctx.closePath();
    ctx.fill();

    // Right vertical skirt face (pS -> pE)
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.moveTo(pS.x, pS.y);
    ctx.lineTo(pE.x, pE.y);
    ctx.lineTo(pE.x, pE.y + skirtDepth);
    ctx.lineTo(pS.x, pS.y + skirtDepth);
    ctx.closePath();
    ctx.fill();

    // Top Isometric Diamond Face
    const checker = (Math.abs(gx + gy) % 2) === 0;
    let fill = checker ? '#1E3A8A' : '#172554';
    let stroke = PALETTE.CYAN;

    if (type === 'slopeRight') {
      fill = checker ? '#0369A1' : '#075985';
      stroke = '#38BDF8';
    } else if (type === 'slopeLeft') {
      fill = checker ? '#0F766E' : '#115E59';
      stroke = PALETTE.GREEN;
    } else if (type === 'slopeDown') {
      fill = checker ? '#6D28D9' : '#4C1D95';
      stroke = PALETTE.PURPLE;
    } else if (type === 'goal') {
      fill = checker ? PALETTE.GOLD : '#1E293B';
      stroke = PALETTE.GOLD;
    }

    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(pN.x, pN.y);
    ctx.lineTo(pE.x, pE.y);
    ctx.lineTo(pS.x, pS.y);
    ctx.lineTo(pW.x, pW.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw directional chevron on slope tiles
    if (type === 'slopeRight' || type === 'slopeLeft' || type === 'slopeDown') {
      const c = this._isoProject(gx, gy, z);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (type === 'slopeRight') {
        ctx.moveTo(c.x - 4, c.y - 4);
        ctx.lineTo(c.x + 5, c.y + 2);
        ctx.lineTo(c.x - 2, c.y + 5);
      } else if (type === 'slopeLeft') {
        ctx.moveTo(c.x + 4, c.y - 4);
        ctx.lineTo(c.x - 5, c.y + 2);
        ctx.lineTo(c.x + 2, c.y + 5);
      } else {
        ctx.moveTo(c.x - 5, c.y - 2);
        ctx.lineTo(c.x, c.y + 5);
        ctx.lineTo(c.x + 5, c.y - 2);
      }
      ctx.stroke();
    }
  }

  render(ctx = this.renderer.ctx) {
    ctx.fillStyle = PALETTE.BG;
    ctx.fillRect(0, 38, this.renderer.width, this.renderer.height - 38);

    // Subtle background isometric wireframe grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
    ctx.lineWidth = 1;
    for (let i = -12; i <= 12; i++) {
      ctx.beginPath();
      ctx.moveTo(480 + i * 64, 40);
      ctx.lineTo(480 + i * 64 - 500, 540);
      ctx.moveTo(480 + i * 64, 40);
      ctx.lineTo(480 + i * 64 + 500, 540);
      ctx.stroke();
    }

    // Render all Isometric Course Tiles back-to-front
    for (const tile of this.tileList) {
      this._drawIsoTile(ctx, tile);
    }

    // Render Bumpers
    for (const b of this.bumpers) {
      const pt = this._isoProject(b.gx, b.gy, b.z);
      const rad = 11 + b.pulse * 5;
      this.renderer.drawGlowCircle(pt.x, pt.y - 5, rad, PALETTE.PINK, 12);
      this.renderer.drawGlowCircle(pt.x, pt.y - 7, rad * 0.55, PALETTE.GOLD, 6);
    }

    // Render Roaming Enemy Marbles
    for (const h of this.hazards) {
      const pt = this._isoProject(h.gx, h.gy, h.z);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(pt.x, pt.y + 2, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      this.renderer.drawGlowCircle(pt.x, pt.y - 7, 10, PALETTE.RED, 10);
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y - 7, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render Player Marble Trail
    for (const tr of this.trail) {
      const pt = this._isoProject(tr.gx, tr.gy, tr.z);
      ctx.globalAlpha = (tr.life / 0.35) * 0.45;
      ctx.fillStyle = PALETTE.CYAN;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y - 6, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Render Player Marble
    const m = this.marble;
    const mp = this._isoProject(m.gx, m.gy, m.z);
    if (!m.falling) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.ellipse(mp.x, mp.y + 2, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const r = m.falling ? Math.max(3, m.radius * (1 - m.fallTimer * 0.7)) : m.radius;
    this.renderer.drawGlowCircle(mp.x, mp.y - 7, r, PALETTE.CYAN, 14);
    // Specular highlight rotating with roll
    const hx = mp.x - 3 + Math.cos(m.rollAngle) * 2.5;
    const hy = mp.y - 10 + Math.sin(m.rollAngle) * 2.5;
    ctx.fillStyle = PALETTE.WHITE;
    ctx.beginPath();
    ctx.arc(hx, hy, r * 0.32, 0, Math.PI * 2);
    ctx.fill();

    // Render Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Course Status Banner
    if (this.levelClearTimer > 0) {
      this.renderer.drawText('GOAL REACHED! TIME BONUS AWARDED!', 480, 120, {
        font: FONTS.HEADER,
        size: 18,
        color: PALETTE.GOLD,
        align: 'center',
        glow: 12
      });
    } else if (m.falling) {
      this.renderer.drawText('CHASM DROP-OFF!', 480, 120, {
        font: FONTS.HEADER,
        size: 18,
        color: PALETTE.PINK,
        align: 'center',
        glow: 12
      });
    }

    // Tile slope indicator in lower-left corner
    this.renderer.drawText(`SURFACE: ${m.currentTileType.toUpperCase()}`, 20, 520, {
      font: FONTS.HUD,
      size: 14,
      color: PALETTE.CYAN
    });

    // Top HUD
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `TIME:${Math.ceil(this.timeLeft)}s`,
      accent: PALETTE.CYAN
    });

    // State Overlay
    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'ISOMETRIC 3D COURSE ROLLER',
      controls: 'ARROWS/WASD: ROLL MARBLE  |  Z/SPACE: TURBO SPIN',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.CYAN
    });
  }
}

export default MarbleMadness;
