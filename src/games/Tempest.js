/**
 * Tempest.js
 * Classic 1981 Atari Color-Vector 3D Tube Shooter (Tempest / Vortex Tube) for Retro Arcade Studio.
 *
 * Features:
 * - 3D perspective neon wireframe tube renderer with 6 iconic geometries across levels:
 *   Circle, Square, Plus Cross, Bowtie, Starburst, and Open V-Trench
 * - Yellow Claw Blaster rotating around the rim (`LEFT`/`RIGHT`) with glowing active lane highlight
 * - Rapid depth laser stream (`ACTION A`) and screen-clearing **Superzapper** (`ACTION B`, 2 charges/wave)
 * - Authentic vector enemies climbing from the pit (`z = 1`) to the rim (`z = 0`):
 *   - Red Flippers (flip between lanes and along the rim)
 *   - Cyan Pulsars (electrify their entire lane during pulse phase)
 *   - Rainbow Fuseballs & Green Spikers
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

export class Tempest {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'tempest';
    this.title = 'Vortex Tube';
    this.state = 'PLAYING';

    this.width = 960;
    this.height = 540;
    this.centerX = 480;
    this.centerY = 290;

    this.highScore = HighScoreStore.get(this.id);
    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this._loadTubeWave(this.level);
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    if (this.audio) {
      this.audio.stopSequence();
    }
  }

  /**
   * Generates the rim vertices and lane pairs for the current level's 3D vector web
   */
  _buildTubeGeometry(level) {
    const shapeIdx = (level - 1) % 6;
    const vertices = [];
    let closed = true;
    let shapeName = 'CIRCLE WEB';

    if (shapeIdx === 0) {
      // 1. 16-lane Circle Web
      shapeName = 'CIRCLE VORTEX';
      const n = 16;
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
        vertices.push({
          x: Math.cos(ang) * 235,
          y: Math.sin(ang) * 195
        });
      }
    } else if (shapeIdx === 1) {
      // 2. 16-lane Square Web (4 lanes per side)
      shapeName = 'SQUARE MATRIX';
      const s = 195;
      const pts = [
        [-s, -s], [s, -s], [s, s], [-s, s]
      ];
      for (let side = 0; side < 4; side++) {
        const [x1, y1] = pts[side];
        const [x2, y2] = pts[(side + 1) % 4];
        for (let k = 0; k < 4; k++) {
          const t = k / 4;
          vertices.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
        }
      }
    } else if (shapeIdx === 2) {
      // 3. Plus Cross Web
      shapeName = 'PLUS CROSS';
      const raw = [
        [-75, -205], [75, -205], [75, -75], [215, -75],
        [215, 75], [75, 75], [75, 205], [-75, 205],
        [-75, 75], [-215, 75], [-215, -75], [-75, -75]
      ];
      for (let i = 0; i < raw.length; i++) {
        const [x1, y1] = raw[i];
        const [x2, y2] = raw[(i + 1) % raw.length];
        vertices.push({ x: x1, y: y1 });
        vertices.push({ x: (x1 + x2) / 2, y: (y1 + y2) / 2 });
      }
    } else if (shapeIdx === 3) {
      // 4. Bowtie Hourglass Web
      shapeName = 'BOWTIE HOURGLASS';
      const n = 16;
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
        const r = 145 + 75 * Math.cos(ang * 2);
        vertices.push({
          x: Math.cos(ang) * r * 1.15,
          y: Math.sin(ang) * r * 0.9
        });
      }
    } else if (shapeIdx === 4) {
      // 5. Starburst Web
      shapeName = 'NEON STARBURST';
      const n = 16;
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
        const r = i % 2 === 0 ? 225 : 145;
        vertices.push({
          x: Math.cos(ang) * r,
          y: Math.sin(ang) * r * 0.88
        });
      }
    } else {
      // 6. Open V-Trench Web
      shapeName = 'OPEN V-TRENCH';
      closed = false;
      const numVerts = 13;
      for (let i = 0; i < numVerts; i++) {
        const t = (i / (numVerts - 1)) * 2 - 1; // -1 .. 1
        vertices.push({
          x: t * 280,
          y: 175 - Math.abs(t) * 250
        });
      }
    }

    this.closedTube = closed;
    this.shapeName = shapeName;
    this.lanes = [];
    const laneCount = closed ? vertices.length : vertices.length - 1;
    for (let i = 0; i < laneCount; i++) {
      const v1 = vertices[i];
      const v2 = vertices[(i + 1) % vertices.length];
      this.lanes.push({
        index: i,
        v1,
        v2,
        midX: (v1.x + v2.x) / 2,
        midY: (v1.y + v2.y) / 2,
        spikeDepth: 1.0 // 1.0 = no spike, < 1.0 = green spiker trail extending up lane
      });
    }
  }

  /**
   * Projects a tube point at depth z (0 = near rim, 1 = deep pit) to 2D canvas coordinates
   */
  _project(vx, vy, z) {
    const scale = 1.0 - z * 0.82;
    const warpOffset = this.warpTransition > 0 ? this.warpTransition * 1.2 : 0;
    const effectiveScale = scale * (1 + warpOffset);
    return {
      x: this.centerX + vx * effectiveScale,
      y: this.centerY + vy * effectiveScale
    };
  }

  _loadTubeWave(level) {
    this._buildTubeGeometry(level);

    this.playerLane = 0;
    this.laneMoveTimer = 0;
    this.fireCooldown = 0;
    this.superzapperCharges = 2;
    this.zapperFlashTimer = 0;
    this.invulnTimer = 1.5;
    this.warpTransition = 0;

    this.shots = []; // { lane, z }
    this.enemies = []; // { type, lane, z, flipTimer, flipDir, pulsePhase }
    this.enemyShots = []; // { lane, z }
    this.particles = [];
    this.floatingTexts = [];

    this.enemiesToSpawn = 14 + level * 4;
    this.spawnTimer = 0.5;

    // Seed initial pit enemies at z = 1.0
    for (let i = 0; i < 4; i++) {
      this._spawnEnemy();
      this.enemiesToSpawn -= 1;
    }

    this.bannerText = `TUBE ${level}: ${this.shapeName}`;
    this.bannerTimer = 2.0;
  }

  _spawnEnemy() {
    const lane = Math.floor(Math.random() * this.lanes.length);
    const roll = Math.random();
    let type = 'flipper';
    if (roll > 0.72) type = 'pulsar';
    else if (roll > 0.52) type = 'fuseball';
    else if (roll > 0.36) type = 'spiker';

    this.enemies.push({
      type,
      lane,
      z: 1.0,
      speed: (0.20 + Math.min(0.22, this.level * 0.02)) * (type === 'fuseball' ? 1.25 : 1.0),
      flipTimer: 0.7 + Math.random() * 0.8,
      pulsePhase: Math.random() * Math.PI * 2,
      fireTimer: 1.1 + Math.random() * 1.4,
      retreating: false
    });
  }

  _stepLane(lane, delta) {
    const n = this.lanes.length;
    if (this.closedTube) {
      return (lane + delta + n) % n;
    }
    return Math.max(0, Math.min(n - 1, lane + delta));
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

    if (this.bannerTimer > 0) this.bannerTimer = Math.max(0, this.bannerTimer - clampedDt);
    if (this.zapperFlashTimer > 0) this.zapperFlashTimer = Math.max(0, this.zapperFlashTimer - clampedDt);
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - clampedDt);
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - clampedDt);

    // Handle warp zoom transition between tubes
    if (this.warpTransition > 0) {
      this.warpTransition += clampedDt * 1.5;
      if (this.warpTransition >= 1.5) {
        this.level += 1;
        this._loadTubeWave(this.level);
      }
      return;
    }

    // Rotate Claw around the tube rim (LEFT / RIGHT)
    this.laneMoveTimer -= clampedDt;
    if (this.input.isJustPressed('left')) {
      this.playerLane = this._stepLane(this.playerLane, -1);
      this.laneMoveTimer = 0.09;
      this.audio.playMenuMove();
    } else if (this.input.isJustPressed('right')) {
      this.playerLane = this._stepLane(this.playerLane, 1);
      this.laneMoveTimer = 0.09;
      this.audio.playMenuMove();
    } else if (this.laneMoveTimer <= 0) {
      if (this.input.isDown('left')) {
        this.playerLane = this._stepLane(this.playerLane, -1);
        this.laneMoveTimer = 0.065;
        this.audio.playMenuMove();
      } else if (this.input.isDown('right')) {
        this.playerLane = this._stepLane(this.playerLane, 1);
        this.laneMoveTimer = 0.065;
        this.audio.playMenuMove();
      }
    }

    // Fire rapid depth shots down the active lane (ACTION A)
    const wantsFire =
      this.input.isJustPressed('actionA') ||
      (this.input.isDown('actionA') && this.fireCooldown <= 0);
    if (wantsFire && this.shots.length < 8) {
      this.fireCooldown = 0.11;
      this.shots.push({
        lane: this.playerLane,
        z: 0.02
      });
      this.audio.playLaser(1400, 380, 0.07);
    }

    // Trigger SUPERZAPPER (ACTION B)
    if (this.input.isJustPressed('actionB') && this.superzapperCharges > 0) {
      this._triggerSuperzapper();
    }

    this._updateShots(clampedDt);
    this._updateEnemies(clampedDt);
    this._updateEnemyShots(clampedDt);
    this._updateParticles(clampedDt);

    if (this.enemies.length === 0 && this.enemiesToSpawn <= 0) {
      this.warpTransition = 0.01;
      this.audio.playStageClear();
      this.bannerText = 'SUPER WARP — AVOID GREEN SPIKES!';
      this.bannerTimer = 1.4;
    }
  }

  _triggerSuperzapper() {
    this.superzapperCharges -= 1;
    this.zapperFlashTimer = 0.45;
    this.renderer.triggerFlash(0.75);
    this.renderer.shake(10, 0.35);
    this.audio.playPowerUp();

    if (this.superzapperCharges === 1) {
      // First Superzapper charge obliterates ALL active enemies in the tube!
      let totalPts = 0;
      for (const e of this.enemies) {
        totalPts += 150;
        const laneObj = this.lanes[e.lane];
        const pt = this._project(laneObj.midX, laneObj.midY, e.z);
        this._spawnVectorBurst(pt.x, pt.y, PALETTE.GOLD, 10);
      }
      this.enemies = [];
      this.enemyShots = [];
      if (totalPts > 0) {
        this._awardPoints(totalPts, this.centerX, this.centerY - 40, `SUPERZAPPER +${totalPts}!`, PALETTE.GOLD);
      }
    } else if (this.enemies.length > 0) {
      // Second Superzapper charge obliterates one random enemy
      const idx = Math.floor(Math.random() * this.enemies.length);
      this._destroyEnemy(idx);
    }
  }

  _updateShots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.z += 1.65 * dt;

      // Trim green spiker trails in this lane
      const laneObj = this.lanes[s.lane];
      if (laneObj && laneObj.spikeDepth < 1.0 && s.z >= laneObj.spikeDepth) {
        laneObj.spikeDepth = Math.min(1.0, laneObj.spikeDepth + 0.14);
        this.shots.splice(i, 1);
        this._awardPoints(10, this.centerX, this.centerY, '+10', PALETTE.GREEN);
        continue;
      }

      if (s.z >= 1.0) {
        this.shots.splice(i, 1);
        continue;
      }

      // Check hitting enemy in same lane
      let hit = false;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (e.lane === s.lane && Math.abs(e.z - s.z) < 0.09) {
          this._destroyEnemy(j);
          hit = true;
          break;
        }
      }
      if (hit) {
        this.shots.splice(i, 1);
        continue;
      }

      // Check intercepting enemy shots in same lane
      for (let k = this.enemyShots.length - 1; k >= 0; k--) {
        const es = this.enemyShots[k];
        if (es.lane === s.lane && Math.abs(es.z - s.z) < 0.08) {
          this.enemyShots.splice(k, 1);
          this.shots.splice(i, 1);
          break;
        }
      }
    }
  }

  _updateEnemies(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.enemiesToSpawn > 0) {
      this.spawnTimer = Math.max(0.45, 1.15 - this.level * 0.08);
      this._spawnEnemy();
      this.enemiesToSpawn -= 1;
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.pulsePhase += dt * 7.5;

      if (e.type === 'spiker') {
        const laneObj = this.lanes[e.lane];
        if (!e.retreating) {
          e.z -= e.speed * dt;
          laneObj.spikeDepth = Math.min(laneObj.spikeDepth, e.z);
          if (e.z <= 0.22) e.retreating = true;
        } else {
          e.z += e.speed * dt;
          if (e.z >= 1.0) {
            e.type = 'flipper';
            e.retreating = false;
          }
        }
      } else {
        e.z = Math.max(0, e.z - e.speed * dt);
      }

      // Flippers & Fuseballs switch lanes periodically
      if (e.type === 'flipper' || e.type === 'fuseball') {
        e.flipTimer -= dt;
        if (e.flipTimer <= 0) {
          e.flipTimer = e.z <= 0.02 ? 0.32 : 0.65 + Math.random() * 0.6;
          const dir =
            e.z <= 0.02
              ? Math.sign(this.playerLane - e.lane) || 1
              : Math.random() < 0.5
              ? -1
              : 1;
          e.lane = this._stepLane(e.lane, dir);
        }
      }

      //Pulsar electrifies its entire lane when sin(pulsePhase) > 0.55!
      if (
        e.type === 'pulsar' &&
        e.z < 0.85 &&
        Math.sin(e.pulsePhase) > 0.65 &&
        e.lane === this.playerLane &&
        this.invulnTimer <= 0
      ) {
        this._hitPlayer();
        return;
      }

      // Fire enemy plasma balls up the lane
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && e.z > 0.25 && e.z < 0.9) {
        e.fireTimer = 1.4 + Math.random() * 1.4;
        this.enemyShots.push({ lane: e.lane, z: e.z });
      }

      // Rim collision with Player Claw
      if (e.z <= 0.03 && e.lane === this.playerLane && this.invulnTimer <= 0) {
        this.enemies.splice(i, 1);
        this._hitPlayer();
        return;
      }
    }
  }

  _updateEnemyShots(dt) {
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const es = this.enemyShots[i];
      es.z -= 0.55 * dt;
      if (es.z <= 0) {
        this.enemyShots.splice(i, 1);
        if (es.lane === this.playerLane && this.invulnTimer <= 0) {
          this._hitPlayer();
          return;
        }
      }
    }
  }

  _destroyEnemy(index) {
    const e = this.enemies[index];
    if (!e) return;

    const pts =
      e.type === 'fuseball' ? 250 : e.type === 'pulsar' ? 200 : e.type === 'flipper' ? 150 : 100;
    const color =
      e.type === 'fuseball'
        ? PALETTE.PINK
        : e.type === 'pulsar'
        ? PALETTE.CYAN
        : e.type === 'flipper'
        ? PALETTE.RED
        : PALETTE.GREEN;

    const laneObj = this.lanes[e.lane];
    const pt = this._project(laneObj.midX, laneObj.midY, e.z);
    this._awardPoints(pts, pt.x, pt.y, `+${pts}`, color);
    this._spawnVectorBurst(pt.x, pt.y, color, 14);
    this.audio.playExplosion(0.22, 1200);
    this.enemies.splice(index, 1);
  }

  _hitPlayer() {
    this.renderer.shake(10, 0.35);
    this.audio.playExplosion(0.5, 650);
    const laneObj = this.lanes[this.playerLane];
    const pt = this._project(laneObj.midX, laneObj.midY, 0);
    this._spawnVectorBurst(pt.x, pt.y, PALETTE.GOLD, 26);

    this.lives -= 1;
    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.audio.playGameOver();
      this.state = 'GAMEOVER';
    } else {
      this.invulnTimer = 2.2;
      this.enemyShots = [];
      // Push rim enemies back slightly
      for (const e of this.enemies) {
        if (e.z < 0.25) e.z = 0.45;
      }
    }
  }

  _awardPoints(pts, x, y, text, color) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -36,
      life: 0.9,
      maxLife: 0.9,
      color
    });
  }

  _spawnVectorBurst(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count;
      const spd = 60 + Math.random() * 150;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.3 + Math.random() * 0.25,
        maxLife: 0.55,
        color: i % 2 === 0 ? color : PALETTE.WHITE
      });
    }
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear('#04060E');

    const tubeColors = [PALETTE.BLUE, PALETTE.CYAN, PALETTE.PURPLE, PALETTE.GREEN, PALETTE.PINK];
    const webColor =
      this.zapperFlashTimer > 0
        ? PALETTE.WHITE
        : tubeColors[(this.level - 1) % tubeColors.length];

    // 1. 3D Perspective Neon Wireframe Tube Web
    ctx.save();
    for (let i = 0; i < this.lanes.length; i++) {
      const lane = this.lanes[i];
      const isPlayerLane = i === this.playerLane;
      const isElectrified = this.enemies.some(
        (e) => e.type === 'pulsar' && e.lane === i && e.z < 0.85 && Math.sin(e.pulsePhase) > 0.65
      );

      const near1 = this._project(lane.v1.x, lane.v1.y, 0);
      const near2 = this._project(lane.v2.x, lane.v2.y, 0);
      const far1 = this._project(lane.v1.x, lane.v1.y, 1);
      const far2 = this._project(lane.v2.x, lane.v2.y, 1);

      // Highlight active player lane or pulsar-electrified lane
      if (isPlayerLane || isElectrified) {
        ctx.fillStyle = isElectrified
          ? 'rgba(0, 240, 255, 0.22)'
          : 'rgba(255, 215, 0, 0.12)';
        ctx.beginPath();
        ctx.moveTo(near1.x, near1.y);
        ctx.lineTo(near2.x, near2.y);
        ctx.lineTo(far2.x, far2.y);
        ctx.lineTo(far1.x, far1.y);
        ctx.closePath();
        ctx.fill();
      }

      ctx.strokeStyle = isElectrified
        ? PALETTE.WHITE
        : isPlayerLane
        ? PALETTE.GOLD
        : webColor;
      ctx.lineWidth = isPlayerLane || isElectrified ? 2.6 : 1.6;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = isPlayerLane || isElectrified ? 12 : 6;

      ctx.beginPath();
      ctx.moveTo(near1.x, near1.y);
      ctx.lineTo(near2.x, near2.y);
      ctx.lineTo(far2.x, far2.y);
      ctx.lineTo(far1.x, far1.y);
      ctx.closePath();
      ctx.stroke();

      // Green Spiker Trail inside lane
      if (lane.spikeDepth < 1.0) {
        const spTop = this._project(lane.midX, lane.midY, lane.spikeDepth);
        const spBot = this._project(lane.midX, lane.midY, 1.0);
        ctx.strokeStyle = PALETTE.GREEN;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = PALETTE.GREEN;
        ctx.beginPath();
        ctx.moveTo(spBot.x, spBot.y);
        ctx.lineTo(spTop.x, spTop.y);
        ctx.stroke();
        this.renderer.drawGlowCircle(spTop.x, spTop.y, 3.5, PALETTE.RED, 8);
      }
    }

    // Depth ring slices at z = 0.33 and z = 0.66 for 3D tunnel depth
    ctx.strokeStyle = webColor;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    for (const ringZ of [0.33, 0.66]) {
      ctx.beginPath();
      for (let i = 0; i < this.lanes.length; i++) {
        const l = this.lanes[i];
        const p1 = this._project(l.v1.x, l.v1.y, ringZ);
        const p2 = this._project(l.v2.x, l.v2.y, ringZ);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // 2. Player Depth Shots
    for (const s of this.shots) {
      const lane = this.lanes[s.lane];
      const pt = this._project(lane.midX, lane.midY, s.z);
      const r = Math.max(2.5, (1 - s.z * 0.7) * 5.5);
      this.renderer.drawGlowCircle(pt.x, pt.y, r, PALETTE.GOLD, 10);
    }

    // 3. Enemy Shots
    for (const es of this.enemyShots) {
      const lane = this.lanes[es.lane];
      const pt = this._project(lane.midX, lane.midY, es.z);
      this.renderer.drawGlowCircle(pt.x, pt.y, 4.5, PALETTE.PINK, 10);
    }

    // 4. Vector Tube Enemies (Flippers, Pulsars, Fuseballs, Spikers)
    for (const e of this.enemies) {
      const lane = this.lanes[e.lane];
      const p1 = this._project(lane.v1.x, lane.v1.y, e.z);
      const p2 = this._project(lane.v2.x, lane.v2.y, e.z);
      const mid = this._project(lane.midX, lane.midY, e.z);
      const sz = Math.max(5, (1 - e.z * 0.75) * 14);

      ctx.save();
      if (e.type === 'flipper') {
        // Iconic Red Bow-Tie Vector Flipper
        ctx.strokeStyle = PALETTE.RED;
        ctx.shadowColor = PALETTE.RED;
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(mid.x, mid.y - sz * 0.6);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(mid.x, mid.y + sz * 0.6);
        ctx.closePath();
        ctx.stroke();
      } else if (e.type === 'pulsar') {
        // Cyan Zig-Zag Vector Pulsar
        const flash = Math.sin(e.pulsePhase) > 0.65;
        ctx.strokeStyle = flash ? PALETTE.WHITE : PALETTE.CYAN;
        ctx.shadowColor = PALETTE.CYAN;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(mid.x - sz * 0.3, mid.y - sz * 0.7);
        ctx.lineTo(mid.x + sz * 0.3, mid.y + sz * 0.7);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      } else if (e.type === 'fuseball') {
        // Multi-colored Sparkling Vector Fuseball
        const colors = [PALETTE.PINK, PALETTE.GOLD, PALETTE.CYAN, PALETTE.GREEN];
        for (let k = 0; k < 4; k++) {
          const ang = e.pulsePhase + (k * Math.PI) / 2;
          ctx.strokeStyle = colors[k];
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(mid.x - Math.cos(ang) * sz, mid.y - Math.sin(ang) * sz);
          ctx.lineTo(mid.x + Math.cos(ang) * sz, mid.y + Math.sin(ang) * sz);
          ctx.stroke();
        }
      } else {
        // Green Spiker Spiral
        this.renderer.drawGlowCircle(mid.x, mid.y, sz * 0.6, PALETTE.GREEN, 10, false, 2);
      }
      ctx.restore();
    }

    // 5. Yellow Vector Claw Blaster on Rim
    if (this.invulnTimer <= 0 || Math.floor(this.invulnTimer * 14) % 2 === 0) {
      const active = this.lanes[this.playerLane];
      const p1 = this._project(active.v1.x, active.v1.y, 0);
      const p2 = this._project(active.v2.x, active.v2.y, 0);
      const midOut = this._project(active.midX * 1.12, active.midY * 1.12, 0);
      const pincer1 = this._project(active.v1.x * 0.92, active.v1.y * 0.92, 0.05);
      const pincer2 = this._project(active.v2.x * 0.92, active.v2.y * 0.92, 0.05);

      ctx.save();
      ctx.strokeStyle = PALETTE.GOLD;
      ctx.shadowColor = PALETTE.GOLD;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(pincer1.x, pincer1.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(midOut.x, midOut.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(pincer2.x, pincer2.y);
      ctx.stroke();
      ctx.restore();
    }

    // 6. Vector Burst Particles & Score Popups
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
    }
    for (const ft of this.floatingTexts) {
      this.renderer.drawText(ft.text, ft.x, ft.y, {
        font: FONTS.HEADER,
        size: 11,
        color: ft.color,
        align: 'center',
        glow: 8
      });
    }

    if (this.bannerTimer > 0 && this.state === 'PLAYING') {
      this.renderer.drawText(this.bannerText, this.width / 2, 72, {
        font: FONTS.HEADER,
        size: 14,
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
      extraLabel: `ZAPPER: ${this.superzapperCharges}`,
      accent: PALETTE.GOLD
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '3D VECTOR TUBE & SUPERZAPPER EDITION',
      controls: 'LEFT/RIGHT: ROTATE CLAW ON RIM  |  Z/SPACE: RAPID FIRE  |  X/SHIFT: SUPERZAPPER',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GOLD
    });
  }
}

export default Tempest;
