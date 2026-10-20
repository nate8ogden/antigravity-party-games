/**
 * OutRun.js
 * Classic 1986 Pseudo-3D Horizon Perspective Arcade Racer
 * Features projected scanline/polygon road segments with alternating rumble strips,
 * road curvature, hill elevation waves, roadside palm trees & neon billboards,
 * 290 km/h acceleration, high-speed drifting (Action B), traffic weaving, and
 * Track Branching Forks that transition between distinct synthwave biomes.
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const BIOMES = [
  {
    name: 'COCONUT BEACH',
    skyTop: '#0B0726',
    skyBot: '#FF007A',
    sunColor: '#FFD700',
    grassA: '#064E3B',
    grassB: '#047857',
    roadA: '#334155',
    roadB: '#1E293B',
    rumbleA: '#FF2A55',
    rumbleB: '#F8FAFC'
  },
  {
    name: 'SUNSET DESERT',
    skyTop: '#1E0B28',
    skyBot: '#FF8800',
    sunColor: '#FF2A55',
    grassA: '#78350F',
    grassB: '#92400E',
    roadA: '#3F3F46',
    roadB: '#27272A',
    rumbleA: '#FFD700',
    rumbleB: '#18181B'
  },
  {
    name: 'NEON METROPOLIS',
    skyTop: '#050814',
    skyBot: '#38BDF8',
    sunColor: '#B829FF',
    grassA: '#0F172A',
    grassB: '#1E1B4B',
    roadA: '#1E293B',
    roadB: '#0F172A',
    rumbleA: '#00F0FF',
    rumbleB: '#FF007A'
  },
  {
    name: 'ALPINE VINEYARD',
    skyTop: '#081C24',
    skyBot: '#00FF66',
    sunColor: '#FFD700',
    grassA: '#14532D',
    grassB: '#166534',
    roadA: '#334155',
    roadB: '#1E293B',
    rumbleA: '#F8FAFC',
    rumbleB: '#00F0FF'
  }
];

export class OutRun {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'outrun';
    this.title = 'Synthwave Horizon';
    this.width = 960;
    this.height = 540;

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.segmentLength = 200;
    this.drawDistance = 85;
    this.roadWidth = 2100;
    this.cameraHeight = 1050;
    this.cameraDepth = 0.84;

    this.segments = [];
    this.traffic = [];
    this.particles = [];
    this.popups = [];

    this.position = 0;
    this.playerX = 0; // -1..1 across road width
    this.speed = 0; // 0..290 km/h
    this.maxSpeed = 290;
    this.steerAngle = 0;
    this.drifting = false;
    this.spinTimer = 0;

    this.timeRemaining = 55;
    this.biomeIndex = 0;
    this.stageLength = 420; // segments per stage before fork
    this.forkChoice = 'LEFT';
    this.engineTick = 0;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.state = 'PLAYING';

    this.position = 0;
    this.playerX = 0;
    this.speed = 0;
    this.steerAngle = 0;
    this.drifting = false;
    this.spinTimer = 0;
    this.timeRemaining = 55;
    this.biomeIndex = 0;

    this.particles = [];
    this.popups = [];

    this._buildTrack();
    this._spawnTraffic();
  }

  setState(state) {
    this.state = state;
    if (state === 'GAMEOVER') {
      HighScoreStore.submit(this.id, this.score);
    }
  }

  destroy() {
    if (this.audio) {
      this.audio.stopSequence();
    }
  }

  _addScore(pts, x = null, y = null, color = PALETTE.GOLD, label = null) {
    this.score += Math.floor(pts);
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    if (x !== null && y !== null) {
      this.popups.push({
        x,
        y,
        text: label || `+${Math.floor(pts)}`,
        color,
        life: 1.0
      });
    }
  }

  _buildTrack() {
    this.segments = [];
    const total = this.stageLength + this.drawDistance + 20;

    for (let i = 0; i < total; i++) {
      // Smooth procedural curves and hills
      let curve = 0;
      if (i > 25 && i < 95) curve = 2.4;
      else if (i >= 115 && i < 185) curve = -2.8;
      else if (i >= 210 && i < 275) curve = 3.2 + this.level * 0.3;
      else if (i >= 295 && i < 355) curve = -2.5;

      const hillY =
        Math.sin(i * 0.06) * 1400 +
        Math.cos(i * 0.025) * 900;

      const props = [];
      if (i % 7 === 0) {
        props.push({ side: -1, offset: -1.45, type: 'PALM' });
        props.push({ side: 1, offset: 1.45, type: 'PALM' });
      }
      if (i % 28 === 14) {
        props.push({
          side: i % 56 === 14 ? -1 : 1,
          offset: i % 56 === 14 ? -1.6 : 1.6,
          type: 'BILLBOARD'
        });
      }

      const isForkZone = i >= this.stageLength - 45 && i <= this.stageLength;
      const isCheckpoint = i === this.stageLength;

      this.segments.push({
        index: i,
        z: i * this.segmentLength,
        y: hillY,
        curve,
        isForkZone,
        isCheckpoint,
        props
      });
    }
  }

  _spawnTraffic() {
    this.traffic = [];
    const colors = [PALETTE.CYAN, PALETTE.GOLD, PALETTE.GREEN, PALETTE.WHITE, PALETTE.ORANGE];
    for (let i = 0; i < 14; i++) {
      this.traffic.push({
        z: (25 + i * 26) * this.segmentLength,
        offset: (Math.random() * 1.3 - 0.65),
        speed: 125 + (i % 4) * 28,
        color: colors[i % colors.length],
        passed: false
      });
    }
  }

  update(dt) {
    if (this.state === 'MENU') {
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
      if (this.input.isJustPressed('pause') || this.input.isJustPressed('actionA')) {
        this.audio.playMenuSelect();
        this.setState('PLAYING');
      }
      return;
    }

    if (this.state === 'GAMEOVER') {
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

    if (this.input.isJustPressed('pause')) {
      this.audio.playMenuMove();
      this.setState('PAUSED');
      return;
    }

    // Countdown Timer
    this.timeRemaining -= dt;
    if (this.timeRemaining <= 0) {
      this.lives--;
      if (this.lives <= 0) {
        this.audio.playGameOver();
        this.setState('GAMEOVER');
        return;
      } else {
        this.timeRemaining = 40;
        this.audio.playPowerUp();
        this.popups.push({
          x: this.width / 2,
          y: 140,
          text: 'CREDIT USED! +40s CONTINUE!',
          color: PALETTE.GOLD,
          life: 1.8
        });
      }
    }

    const accelerating = this.input.isDown('up') || this.input.isDown('actionA');
    const braking = this.input.isDown('down') || this.input.isDown('actionB');

    if (this.spinTimer > 0) {
      this.spinTimer -= dt;
      this.speed = Math.max(0, this.speed - 220 * dt);
    } else if (accelerating) {
      this.speed = Math.min(this.maxSpeed, this.speed + 115 * dt);
    } else if (braking && !this.input.isDown('left') && !this.input.isDown('right')) {
      this.speed = Math.max(0, this.speed - 190 * dt);
    } else {
      this.speed = Math.max(0, this.speed - 45 * dt);
    }

    // Engine Synth Note
    this.engineTick -= dt;
    if (this.engineTick <= 0 && this.speed > 10) {
      const freq = 65 + (this.speed / this.maxSpeed) * 185;
      this.audio.playNote(freq, 0.06, 'sawtooth', 0.07);
      this.engineTick = 0.075;
    }

    // Advance Position along Z
    const worldSpeed = (this.speed / this.maxSpeed) * 11500;
    this.position += worldSpeed * dt;
    this._addScore((this.speed * dt) * 1.2);

    const baseSegIndex = Math.floor(this.position / this.segmentLength);
    const currentSeg = this.segments[baseSegIndex % this.segments.length];
    const speedRatio = this.speed / this.maxSpeed;

    // Steering & High-Speed Drifting
    let steerInput = 0;
    if (this.input.isDown('left')) steerInput = -1;
    else if (this.input.isDown('right')) steerInput = 1;

    this.steerAngle = steerInput;
    this.drifting =
      braking &&
      steerInput !== 0 &&
      this.speed > 165 &&
      Math.abs(currentSeg.curve) > 0.5;

    const steerRate = this.drifting ? 2.45 : 1.75;
    this.playerX += steerInput * steerRate * speedRatio * dt;

    // Centrifugal force pushes car outward on curves (reduced when drifting smoothly!)
    const centrifugalMult = this.drifting ? 0.24 : 0.44;
    this.playerX -= currentSeg.curve * speedRatio * speedRatio * centrifugalMult * dt;

    if (this.drifting) {
      this._addScore(240 * dt);
      if (Math.random() < 0.65) {
        this.particles.push({
          x: this.width / 2 - 45 + (Math.random() - 0.5) * 20,
          y: 492,
          vx: -steerInput * 90 + (Math.random() - 0.5) * 40,
          vy: -20 - Math.random() * 40,
          color: PALETTE.CYAN,
          size: 6,
          life: 0.35
        });
        this.particles.push({
          x: this.width / 2 + 45 + (Math.random() - 0.5) * 20,
          y: 492,
          vx: -steerInput * 90 + (Math.random() - 0.5) * 40,
          vy: -20 - Math.random() * 40,
          color: PALETTE.WHITE,
          size: 6,
          life: 0.35
        });
      }
    }

    // Track Branching Fork Choice
    if (currentSeg.isForkZone) {
      this.forkChoice = this.playerX < 0 ? 'LEFT' : 'RIGHT';
    }

    // Off-road slowdown & Roadside Prop Collision
    if (Math.abs(this.playerX) > 1.05) {
      this.speed = Math.max(85, this.speed - 135 * dt);
      this.renderer.shake(3, 0.05);
      if (Math.abs(this.playerX) > 1.42 && currentSeg.props.length > 0 && this.speed > 120) {
        // Clipped a roadside palm tree or billboard!
        this.speed = Math.max(60, this.speed * 0.45);
        this.spinTimer = 0.45;
        this.playerX = Math.sign(this.playerX) * 0.9;
        this.audio.playHit();
        this.renderer.shake(9, 0.22);
      }
    }
    this.playerX = Math.max(-1.85, Math.min(1.85, this.playerX));

    // Update Traffic Cars & Check Collisions
    for (const car of this.traffic) {
      car.z += (car.speed / this.maxSpeed) * 11500 * dt;
      if (car.z < this.position - 400) {
        car.z = this.position + (45 + Math.random() * 35) * this.segmentLength;
        car.offset = Math.random() * 1.3 - 0.65;
        car.passed = false;
      }

      const dz = car.z - this.position;
      if (dz > 0 && dz < this.segmentLength * 1.4) {
        const dx = Math.abs(this.playerX - car.offset);
        if (dx < 0.34) {
          // Bump traffic car!
          this.speed = Math.max(70, car.speed * 0.75);
          this.spinTimer = 0.35;
          this.audio.playShove();
          this.renderer.shake(8, 0.2);
          car.z += this.segmentLength * 2;
        } else if (dx < 0.58 && !car.passed && this.speed > 210) {
          car.passed = true;
          this.audio.playCoin();
          this._addScore(500, this.width / 2, 340, PALETTE.CYAN, 'SLIPSTREAM PASS +500!');
        }
      }
    }

    // Check Stage Fork / Checkpoint Completion!
    if (baseSegIndex >= this.stageLength) {
      this.position = 0;
      this.level++;
      this.timeRemaining = Math.min(75, this.timeRemaining + 35);
      if (this.forkChoice === 'LEFT') {
        this.biomeIndex = (this.biomeIndex + 1) % BIOMES.length;
      } else {
        this.biomeIndex = (this.biomeIndex + 2) % BIOMES.length;
      }
      const newBiome = BIOMES[this.biomeIndex];
      this.audio.playStageClear();
      this._addScore(
        2500 * this.level,
        this.width / 2,
        160,
        PALETTE.GOLD,
        `CHECKPOINT! ${this.forkChoice} FORK -> ${newBiome.name}!`
      );
      this._buildTrack();
      this._spawnTraffic();
    }

    // Update Particles & Popups
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 35 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  _project(worldX, worldY, worldZ) {
    const scale = this.cameraDepth / Math.max(1, worldZ);
    const screenX = Math.round(this.width / 2 + (scale * worldX * this.width) / 2);
    const screenY = Math.round(235 - (scale * worldY * this.height) / 2);
    const screenW = Math.round((scale * this.roadWidth * this.width) / 2);
    return { x: screenX, y: screenY, w: screenW, scale };
  }

  render(ctx = this.renderer.ctx) {
    const biome = BIOMES[this.biomeIndex % BIOMES.length];

    // Synthwave Sunset Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 38, 0, 250);
    skyGrad.addColorStop(0, biome.skyTop);
    skyGrad.addColorStop(1, biome.skyBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 38, this.width, 220);

    // Synthwave OutRun Sun with scanline stripes
    const sunX = this.width / 2 - this.playerX * 35;
    this.renderer.drawGlowCircle(sunX, 175, 58, biome.sunColor, 18, true);
    ctx.fillStyle = biome.skyBot;
    for (let s = 0; s < 5; s++) {
      ctx.fillRect(sunX - 65, 182 + s * 9, 130, 3 + s);
    }

    // Ground Base
    ctx.fillStyle = biome.grassA;
    ctx.fillRect(0, 240, this.width, this.height - 240);

    const baseIndex = Math.floor(this.position / this.segmentLength);
    const basePercent = (this.position % this.segmentLength) / this.segmentLength;
    const baseSeg = this.segments[baseIndex % this.segments.length];

    let dx = -(baseSeg.curve * basePercent);
    let x = 0;
    let maxY = this.height;

    const projectedList = [];

    for (let n = 0; n < this.drawDistance; n++) {
      const seg = this.segments[(baseIndex + n) % this.segments.length];
      const worldZ = (n - basePercent) * this.segmentLength;
      if (worldZ <= 10) continue;

      const worldX = this.playerX * this.roadWidth - x;
      const worldY = this.cameraHeight + baseSeg.y - seg.y;
      const proj = this._project(worldX, worldY, worldZ);

      x += dx;
      dx += seg.curve;

      proj.seg = seg;
      proj.clipY = maxY;
      projectedList.push(proj);

      if (proj.y >= maxY || proj.y < 38) continue;

      if (projectedList.length >= 2) {
        const prev = projectedList[projectedList.length - 2];
        const isAlt = Math.floor(seg.index / 3) % 2 === 0;

        // Grass Strip
        ctx.fillStyle = isAlt ? biome.grassA : biome.grassB;
        ctx.fillRect(0, proj.y, this.width, prev.y - proj.y);

        // Rumble Strips
        ctx.fillStyle = isAlt ? biome.rumbleA : biome.rumbleB;
        this._drawTrapezoid(ctx, prev.x, prev.y, prev.w * 1.16, proj.x, proj.y, proj.w * 1.16);

        // Main Asphalt Road (or Split Branching Fork!)
        ctx.fillStyle = isAlt ? biome.roadA : biome.roadB;
        if (seg.isForkZone) {
          const splitProgress = (seg.index - (this.stageLength - 45)) / 45;
          const offset = proj.w * splitProgress * 0.75;
          const prevOffset = prev.w * splitProgress * 0.75;
          this._drawTrapezoid(ctx, prev.x - prevOffset, prev.y, prev.w * 0.65, proj.x - offset, proj.y, proj.w * 0.65);
          this._drawTrapezoid(ctx, prev.x + prevOffset, prev.y, prev.w * 0.65, proj.x + offset, proj.y, proj.w * 0.65);
        } else {
          this._drawTrapezoid(ctx, prev.x, prev.y, prev.w, proj.x, proj.y, proj.w);
        }

        // Lane Dividers
        if (isAlt && !seg.isForkZone) {
          ctx.fillStyle = PALETTE.WHITE;
          this._drawTrapezoid(
            ctx,
            prev.x - prev.w * 0.33,
            prev.y,
            prev.w * 0.03,
            proj.x - proj.w * 0.33,
            proj.y,
            proj.w * 0.03
          );
          this._drawTrapezoid(
            ctx,
            prev.x + prev.w * 0.33,
            prev.y,
            prev.w * 0.03,
            proj.x + proj.w * 0.33,
            proj.y,
            proj.w * 0.03
          );
        }
      }

      maxY = proj.y;
    }

    // Back-to-Front Pass: Roadside Palm Trees, Billboards, Checkpoint Arch, and Traffic Cars
    for (let i = projectedList.length - 1; i >= 0; i--) {
      const p = projectedList[i];
      const seg = p.seg;
      const spriteScale = p.w / 220;

      // Checkpoint Banner Arch
      if (seg.isCheckpoint && p.y < p.clipY) {
        const archW = p.w * 2.1;
        const archH = 55 * spriteScale;
        this.renderer.drawGlowRect(
          p.x - archW / 2,
          p.y - archH,
          archW,
          14 * spriteScale,
          PALETTE.GOLD,
          10,
          true
        );
      }

      // Roadside Palm Trees & Billboards
      for (const prop of seg.props) {
        const px = p.x + p.w * prop.offset;
        const py = p.y;
        if (py > p.clipY) continue;

        if (prop.type === 'PALM') {
          const trunkH = 75 * spriteScale;
          const trunkW = Math.max(2, 6 * spriteScale);
          ctx.fillStyle = '#92400E';
          ctx.fillRect(px - trunkW / 2, py - trunkH, trunkW, trunkH);
          this.renderer.drawGlowCircle(
            px,
            py - trunkH,
            Math.max(3, 22 * spriteScale),
            PALETTE.GREEN,
            6,
            true
          );
        } else if (prop.type === 'BILLBOARD') {
          const bw = 64 * spriteScale;
          const bh = 38 * spriteScale;
          this.renderer.drawGlowRect(px - bw / 2, py - bh, bw, bh, PALETTE.PINK, 8, true);
          ctx.strokeStyle = PALETTE.CYAN;
          ctx.strokeRect(px - bw / 2, py - bh, bw, bh);
        }
      }

      // Traffic Cars in this segment
      for (const car of this.traffic) {
        const carSegIdx = Math.floor(car.z / this.segmentLength);
        if (carSegIdx === seg.index && p.y < p.clipY) {
          const cx = p.x + p.w * car.offset;
          const cy = p.y;
          const cw = Math.max(8, 38 * spriteScale);
          const ch = Math.max(5, 22 * spriteScale);
          this.renderer.drawGlowRect(cx - cw / 2, cy - ch, cw, ch, car.color, 8, true);
          ctx.fillStyle = PALETTE.RED;
          ctx.fillRect(cx - cw * 0.4, cy - ch * 0.4, cw * 0.2, ch * 0.25);
          ctx.fillRect(cx + cw * 0.2, cy - ch * 0.4, cw * 0.2, ch * 0.25);
        }
      }
    }

    // Fork Indicator Banner when approaching Track Branch
    if (baseIndex >= this.stageLength - 65) {
      this.renderer.drawText(
        `TRACK FORK AHEAD! STEER [LEFT] OR [RIGHT] — CURRENT: ${this.forkChoice} ROUTE`,
        this.width / 2,
        72,
        {
          font: FONTS.HEADER,
          size: 12,
          color: PALETTE.GOLD,
          align: 'center',
          glow: 10
        }
      );
    }

    // Draw Player Convertible Supercar (Testarossa rear view)
    const carX = this.width / 2 + this.steerAngle * 14;
    const carY = 478 + (this.speed > 20 && Math.floor(performance.now() / 60) % 2 === 0 ? 1 : 0);
    ctx.save();
    ctx.translate(carX, carY);
    if (this.drifting) {
      ctx.rotate(this.steerAngle * 0.14);
    } else if (this.spinTimer > 0) {
      ctx.rotate(this.spinTimer * 12);
    }

    // Rear Tires
    ctx.fillStyle = '#09090B';
    ctx.fillRect(-52, 2, 20, 16);
    ctx.fillRect(32, 2, 20, 16);

    // Convertible Red Chassis
    this.renderer.drawGlowRect(-48, -18, 96, 26, PALETTE.RED, 12, true);
    // Strakes / Grille
    ctx.fillStyle = '#18181B';
    ctx.fillRect(-42, -6, 84, 8);
    // Dual Twin Taillights
    this.renderer.drawGlowRect(-44, -8, 16, 6, PALETTE.GOLD, 8, true);
    this.renderer.drawGlowRect(28, -8, 16, 6, PALETTE.GOLD, 8, true);

    // Convertible Cockpit & Driver/Passenger
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(-32, -28, 64, 10);
    ctx.fillStyle = PALETTE.GOLD;
    ctx.beginPath();
    ctx.arc(-14, -26, 7, 0, Math.PI * 2);
    ctx.arc(14, -26, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Particles & Popups
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    for (const pop of this.popups) {
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HEADER,
        size: 12,
        color: pop.color,
        align: 'center',
        glow: 10
      });
    }

    // Speedometer & Time Remaining Overlay
    this.renderer.drawText(`${Math.floor(this.speed)} KM/H`, 850, 515, {
      font: FONTS.HEADER,
      size: 18,
      color: this.speed > 250 ? PALETTE.PINK : PALETTE.CYAN,
      align: 'right',
      glow: 10
    });
    if (this.drifting) {
      this.renderer.drawText('POWER DRIFT!', 850, 488, {
        font: FONTS.HEADER,
        size: 11,
        color: PALETTE.GOLD,
        align: 'right',
        glow: 8
      });
    }

    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `TIME:${Math.ceil(this.timeRemaining)}s ${biome.name.split(' ')[0]}`,
      accent: PALETTE.PINK
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'SYNTHWAVE HORIZON TURBO CRUISER',
      controls: 'LEFT/RIGHT: STEER  |  UP/Z/SPACE: GAS (290 KM/H)  |  DOWN/X: DRIFT',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.PINK
    });
  }

  _drawTrapezoid(ctx, x1, y1, w1, x2, y2, w2) {
    ctx.beginPath();
    ctx.moveTo(x1 - w1, y1);
    ctx.lineTo(x2 - w2, y2);
    ctx.lineTo(x2 + w2, y2);
    ctx.lineTo(x1 + w1, y1);
    ctx.closePath();
    ctx.fill();
  }
}

export default OutRun;
