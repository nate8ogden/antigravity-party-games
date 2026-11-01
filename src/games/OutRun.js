/**
 * OutRun.js
 * Classic 1986 Pseudo-3D Horizon Perspective Arcade Racer — Retro Arcade Studio Deluxe Edition.
 * Features:
 * - Authentic 2-Speed Transmission: LOW Gear (0-175 km/h high torque) and HIGH Gear (175-293 km/h overdrive)
 *   with Redline Shift Warning Lights & Manual/Auto Shifting
 * - In-Dash FM Radio Station Selector:
 *     1. MAGICAL SOUND SHOWER (Breezy Latin Fusion)
 *     2. SPLASH WAVE (High-Energy Coastal Funk)
 *     3. PASSING BREEZE (Sunset Seaside Jazz)
 * - 5-Stage Branching Pyramid Route Map across 8 Distinct Biomes:
 *     Stage 1: Coconut Beach
 *     Stage 2: Sunset Desert / Gateway Oasis
 *     Stage 3: Alpine Vineyard / Wilderness Canyon
 *     Stage 4: Neon Metropolis / Coastal Highway
 *     Stage 5: Grand Championship Finish Goal (Grandstand crowds & victory fanfare!)
 * - Diverse Traffic Models: Yellow VW Beetles, Red Sports Coupes, Green Heavy Cargo Trucks & Convertibles
 * - Slipstream Drafting: Tucking behind traffic gives an aerodynamic speed surge up to 298 km/h!
 * - High-Speed Power Drifting: Tapping Brake into sharp turns kicks out the tail with billowing tire smoke
 * - Dramatic Rollover Crash Physics: Clipping roadside obstacles flips the Testarossa with passenger reactions
 * - Layered Horizon Parallax: Distant mountain ranges, clouds, ocean waves, and Sega roadside billboards
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const RADIO_STATIONS = [
  { id: 'magical', name: 'MAGICAL SOUND SHOWER', desc: 'BREEZY LATIN FUSION', tempo: 0.125 },
  { id: 'splash', name: 'SPLASH WAVE', desc: 'COASTAL OVERDRIVE FUNK', tempo: 0.118 },
  { id: 'passing', name: 'PASSING BREEZE', desc: 'SUNSET SEASIDE JAZZ', tempo: 0.132 }
];

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
    rumbleB: '#F8FAFC',
    propType: 'PALM'
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
    rumbleB: '#18181B',
    propType: 'CACTUS'
  },
  {
    name: 'GATEWAY OASIS',
    skyTop: '#131A2E',
    skyBot: '#F59E0B',
    sunColor: '#FDE047',
    grassA: '#854D0E',
    grassB: '#A16207',
    roadA: '#334155',
    roadB: '#1E293B',
    rumbleA: '#EF4444',
    rumbleB: '#FFFFFF',
    propType: 'PALM'
  },
  {
    name: 'ALPINE VINEYARD',
    skyTop: '#081C24',
    skyBot: '#10B981',
    sunColor: '#FFD700',
    grassA: '#14532D',
    grassB: '#166534',
    roadA: '#334155',
    roadB: '#1E293B',
    rumbleA: '#F8FAFC',
    rumbleB: '#00F0FF',
    propType: 'PINE'
  },
  {
    name: 'WILDERNESS CANYON',
    skyTop: '#1C0D0A',
    skyBot: '#EA580C',
    sunColor: '#FBBF24',
    grassA: '#7C2D12',
    grassB: '#9A3412',
    roadA: '#292524',
    roadB: '#1C1917',
    rumbleA: '#FACC15',
    rumbleB: '#78350F',
    propType: 'ROCK'
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
    rumbleB: '#FF007A',
    propType: 'PYLON'
  },
  {
    name: 'COASTAL HIGHWAY',
    skyTop: '#0C4A6E',
    skyBot: '#38BDF8',
    sunColor: '#FDE047',
    grassA: '#0369A1',
    grassB: '#0284C7',
    roadA: '#334155',
    roadB: '#1E293B',
    rumbleA: '#EF4444',
    rumbleB: '#FFFFFF',
    propType: 'PALM'
  },
  {
    name: 'CHAMPIONSHIP GOAL',
    skyTop: '#312E81',
    skyBot: '#F43F5E',
    sunColor: '#FBBF24',
    grassA: '#064E3B',
    grassB: '#047857',
    roadA: '#1E293B',
    roadB: '#0F172A',
    rumbleA: '#FACC15',
    rumbleB: '#F8FAFC',
    propType: 'GRANDSTAND'
  }
];

export class OutRun {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'outrun';
    this.title = 'OutRun';
    this.width = 960;
    this.height = 540;

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.stage = 1;
    this.maxStages = 5;

    this.segmentLength = 200;
    this.drawDistance = 90;
    this.roadWidth = 540;
    this.cameraHeight = 690;
    this.cameraDepth = 0.30;

    this.segments = [];
    this.traffic = [];
    this.particles = [];
    this.popups = [];

    this.position = 0;
    this.playerX = 0; // -1..1 across road width
    this.speed = 0;   // 0..293 km/h
    this.gear = 'LOW'; // 'LOW' (0-175 km/h) or 'HIGH' (175-293 km/h)
    this.maxLowSpeed = 175;
    this.maxHighSpeed = 293;
    this.steerAngle = 0;
    this.drifting = false;
    this.spinTimer = 0;
    this.crashRoll = 0; // 0..2pi rolling crash animation

    this.timeRemaining = 60;
    this.biomeIndex = 0;
    this.stageLength = 460;
    this.forkChoice = 'LEFT';
    this.radioIndex = 0;
    this.radioPopupTimer = 0;
    this.slipstreaming = false;
    this.engineTick = 0;
    this.rpmRatio = 0;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.stage = 1;
    this.state = 'PLAYING';

    this.position = 0;
    this.playerX = 0;
    this.speed = 0;
    this.gear = 'LOW';
    this.steerAngle = 0;
    this.drifting = false;
    this.spinTimer = 0;
    this.crashRoll = 0;
    this.timeRemaining = 60;
    this.biomeIndex = 0;
    this.radioIndex = 0;
    this.radioPopupTimer = 3.0;
    this.slipstreaming = false;

    this.particles = [];
    this.popups = [];

    this._buildTrack();
    this._spawnTraffic();

    if (this.audio) {
      this.audio.playMusic('outrun');
    }
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

  _cycleRadio() {
    this.radioIndex = (this.radioIndex + 1) % RADIO_STATIONS.length;
    const st = RADIO_STATIONS[this.radioIndex];
    this.radioPopupTimer = 2.4;
    this.audio.playNote(980, 0.04, 'sawtooth', 0.2);
    this.popups.push({
      x: this.width / 2,
      y: 95,
      text: `FM RADIO: ${st.name} [${st.desc}]`,
      color: PALETTE.CYAN,
      life: 2.2
    });
  }

  _toggleGear() {
    this.gear = this.gear === 'LOW' ? 'HIGH' : 'LOW';
    this.audio.playLaser(this.gear === 'HIGH' ? 880 : 440, 220, 0.06);
    this.popups.push({
      x: this.width / 2,
      y: 450,
      text: `GEAR SHIFT: ${this.gear}`,
      color: this.gear === 'HIGH' ? PALETTE.GOLD : PALETTE.CYAN,
      life: 0.8
    });
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
      let curve = 0;
      if (i > 30 && i < 100) curve = 2.5;
      else if (i >= 120 && i < 190) curve = -2.8;
      else if (i >= 215 && i < 285) curve = 3.3 + this.stage * 0.25;
      else if (i >= 305 && i < 370) curve = -2.7;

      const hillY =
        Math.sin(i * 0.052) * 440 +
        Math.cos(i * 0.024) * 280;

      const props = [];
      const biome = BIOMES[this.biomeIndex % BIOMES.length];

      if (i % 6 === 0) {
        props.push({ side: -1, offset: -1.45, type: biome.propType });
        props.push({ side: 1, offset: 1.45, type: biome.propType });
      }
      if (i % 26 === 13) {
        props.push({
          side: i % 52 === 13 ? -1 : 1,
          offset: i % 52 === 13 ? -1.65 : 1.65,
          type: 'BILLBOARD',
          brand: (i % 3 === 0) ? 'SEGA' : (i % 3 === 1) ? 'OUTRUN' : 'SHELL'
        });
      }

      const isForkZone = i >= this.stageLength - 50 && i <= this.stageLength;
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
    const models = ['beetle', 'sports', 'truck', 'convertible'];
    const colors = [PALETTE.CYAN, PALETTE.GOLD, PALETTE.GREEN, PALETTE.WHITE, PALETTE.ORANGE];

    const trafficCount = 14 + this.stage * 2;
    for (let i = 0; i < trafficCount; i++) {
      const model = models[i % models.length];
      const baseSpd = model === 'truck' ? 120 : model === 'beetle' ? 135 : model === 'sports' ? 195 : 160;
      this.traffic.push({
        model,
        z: (28 + i * 24) * this.segmentLength,
        offset: (Math.random() * 1.3 - 0.65),
        speed: baseSpd + (i % 3) * 15,
        color: colors[i % colors.length],
        passed: false,
        steerTimer: Math.random() * 2.0
      });
    }
  }

  update(dt) {
    if (this.state === 'MENU') {
      if (
        this.input.isJustPressed('actionA') ||
        this.input.isJustPressed('actionB') ||
        (this.input.pointer && this.input.pointer.justPressed)
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
        (this.input.pointer && this.input.pointer.justPressed)
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

    // Radio Tuner Toggle (R key or Action C)
    if (this.input.isKeyJustPressed('KeyR') || this.input.isJustPressed('actionC')) {
      this._cycleRadio();
    }
    if (this.radioPopupTimer > 0) this.radioPopupTimer -= dt;

    // Countdown Race Timer
    this.timeRemaining -= dt;
    if (this.timeRemaining <= 0) {
      this.lives--;
      if (this.lives <= 0) {
        this.audio.playGameOver();
        this.setState('GAMEOVER');
        return;
      } else {
        this.timeRemaining = 45;
        this.audio.playPowerUp();
        this.popups.push({
          x: this.width / 2,
          y: 140,
          text: 'EXTENDED PLAY! +45s TIME BONUS!',
          color: PALETTE.GOLD,
          life: 2.0
        });
      }
    }

    // Gear Shifting (Manual Shift with Shift/S/X or Automatic fallback)
    if (this.input.isKeyJustPressed('ShiftLeft') || this.input.isKeyJustPressed('KeyS') || this.input.isKeyJustPressed('KeyC')) {
      this._toggleGear();
    }

    // Auto-Shift support if player doesn't manually shift
    if (this.gear === 'LOW' && this.speed >= 170 && this.input.isDown('up')) {
      // Auto-upshift when redlining in Low gear
      this.gear = 'HIGH';
      this.audio.playLaser(750, 220, 0.05);
    } else if (this.gear === 'HIGH' && this.speed < 85 && this.input.isDown('up')) {
      // Auto-downshift after crash or heavy slowdown
      this.gear = 'LOW';
    }

    // Acceleration & Braking with Transmission Curves
    const accelerating = this.input.isDown('up') || this.input.isDown('actionA');
    const braking = this.input.isDown('down') || (this.input.isDown('actionB') && !this.drifting);

    const maxCurrentSpeed = (this.gear === 'LOW') ? this.maxLowSpeed : (this.slipstreaming ? 298 : this.maxHighSpeed);

    if (this.spinTimer > 0) {
      this.spinTimer -= dt;
      this.crashRoll += 14 * dt;
      this.speed = Math.max(0, this.speed - 260 * dt);
    } else if (accelerating) {
      // In Low gear: explosive acceleration from low speeds.
      // In High gear: high top speed, but sluggish if crawling.
      const accelPower = (this.gear === 'LOW') ? 145 : (this.speed < 150 ? 55 : 110);
      this.speed = Math.min(maxCurrentSpeed, this.speed + accelPower * dt);
    } else if (braking && !this.input.isDown('left') && !this.input.isDown('right')) {
      this.speed = Math.max(0, this.speed - 220 * dt);
    } else {
      this.speed = Math.max(0, this.speed - 48 * dt);
    }

    // Calculate RPM Ratio for Dashboard Tachometer
    if (this.gear === 'LOW') {
      this.rpmRatio = Math.min(1.0, this.speed / this.maxLowSpeed);
    } else {
      this.rpmRatio = Math.min(1.0, Math.max(0.3, (this.speed - 120) / (this.maxHighSpeed - 120)));
    }

    // Synthesize Engine Roar
    this.engineTick -= dt;
    if (this.engineTick <= 0 && this.speed > 8) {
      const basePitch = (this.gear === 'LOW') ? 60 : 78;
      const freq = basePitch + this.rpmRatio * 170;
      this.audio.playNote(freq, 0.055, 'sawtooth', 0.075);
      this.engineTick = 0.065;
    }

    // Advance World Position
    const worldSpeed = (this.speed / this.maxHighSpeed) * 11800;
    this.position += worldSpeed * dt;
    this._addScore((this.speed * dt) * 1.3);

    const baseSegIndex = Math.floor(this.position / this.segmentLength);
    const currentSeg = this.segments[baseSegIndex % this.segments.length];
    const speedRatio = this.speed / this.maxHighSpeed;

    // Steering, High-Angle Power Drifting & Centrifugal Physics
    let steerInput = 0;
    if (this.input.isDown('left')) steerInput = -1;
    else if (this.input.isDown('right')) steerInput = 1;

    this.steerAngle = steerInput;

    // Power drift initiation: turning while applying brake at speeds over 160 km/h
    this.drifting =
      this.input.isDown('down') &&
      steerInput !== 0 &&
      this.speed > 160 &&
      Math.abs(currentSeg.curve) > 0.4;

    const steerRate = this.drifting ? 2.55 : 1.82;
    this.playerX += steerInput * steerRate * speedRatio * dt;

    // Centrifugal curve pull (smooth drifting neutralizes outward slide!)
    const centrifugalMult = this.drifting ? 0.22 : 0.42;
    this.playerX -= currentSeg.curve * speedRatio * speedRatio * centrifugalMult * dt;

    if (this.drifting) {
      this._addScore(280 * dt);
      // Dual white tire smoke plumes
      if (Math.random() < 0.7) {
        this.particles.push({
          x: this.width / 2 - 46 + (Math.random() - 0.5) * 16,
          y: 494,
          vx: -steerInput * 95 + (Math.random() - 0.5) * 35,
          vy: -25 - Math.random() * 35,
          color: '#E2E8F0',
          size: 7,
          life: 0.35
        });
        this.particles.push({
          x: this.width / 2 + 46 + (Math.random() - 0.5) * 16,
          y: 494,
          vx: -steerInput * 95 + (Math.random() - 0.5) * 35,
          vy: -25 - Math.random() * 35,
          color: '#FFFFFF',
          size: 7,
          life: 0.35
        });
      }
    }

    // Track Branching Fork Choice
    if (currentSeg.isForkZone) {
      this.forkChoice = this.playerX < 0 ? 'LEFT' : 'RIGHT';
    }

    // Off-Road Shoulder Physics & Roadside Prop Collision
    if (Math.abs(this.playerX) > 1.05) {
      this.speed = Math.max(75, this.speed - 145 * dt);
      this.renderer.shake(3, 0.05);

      // Dust particles from tires
      if (Math.random() < 0.5) {
        this.particles.push({
          x: this.width / 2 + (this.playerX > 0 ? 45 : -45),
          y: 495,
          vx: (Math.random() - 0.5) * 60,
          vy: -20 - Math.random() * 30,
          color: '#92400E',
          size: 5,
          life: 0.3
        });
      }

      if (Math.abs(this.playerX) > 1.40 && currentSeg.props.length > 0 && this.speed > 110) {
        // High-Speed Rollover Crash!
        this.speed = Math.max(45, this.speed * 0.40);
        this.spinTimer = 0.55;
        this.crashRoll = 0.1;
        this.gear = 'LOW';
        this.playerX = Math.sign(this.playerX) * 0.92;
        this.audio.playExplosion(0.3, 850);
        this.renderer.shake(12, 0.32);
        this.popups.push({
          x: this.width / 2,
          y: 350,
          text: 'CRASH! SHIFT TO LOW GEAR!',
          color: PALETTE.RED,
          life: 1.4
        });
      }
    }
    this.playerX = Math.max(-1.85, Math.min(1.85, this.playerX));

    // Update Traffic Cars & Check Slipstream Drafting
    this.slipstreaming = false;
    for (const car of this.traffic) {
      car.z += (car.speed / this.maxHighSpeed) * 11800 * dt;

      // Gentle AI lane weaving
      car.steerTimer -= dt;
      if (car.steerTimer <= 0) {
        car.steerTimer = 1.8 + Math.random() * 2.0;
        car.offset = Math.max(-0.7, Math.min(0.7, car.offset + (Math.random() - 0.5) * 0.35));
      }

      // Recycle cars that fall behind
      if (car.z < this.position - 450) {
        car.z = this.position + (40 + Math.random() * 38) * this.segmentLength;
        car.offset = Math.random() * 1.3 - 0.65;
        car.passed = false;
      }

      const dz = car.z - this.position;
      if (dz > 0 && dz < this.segmentLength * 2.0) {
        const dx = Math.abs(this.playerX - car.offset);

        // Car Collision / Rear Bumper Bump (close impact within 70 units)
        if (dx < 0.28 && dz < this.segmentLength * 0.35) {
          this.speed = Math.max(65, car.speed * 0.7);
          this.spinTimer = 0.35;
          this.audio.playShove();
          this.renderer.shake(8, 0.2);
          car.z += this.segmentLength * 2.2;
        } else if (dx < 0.22 && dz >= this.segmentLength * 0.35 && dz < this.segmentLength * 1.8 && this.speed > 210) {
          // Slipstream Drafting Zone: directly behind car at high speed
          this.slipstreaming = true;
          this.speed = Math.min(298, this.speed + 45 * dt);
          this._addScore(180 * dt);
          if (Math.random() < 0.4) {
            this.particles.push({
              x: this.width / 2 - 25,
              y: 488,
              vx: -15,
              vy: 10,
              color: PALETTE.CYAN,
              size: 4,
              life: 0.2
            });
            this.particles.push({
              x: this.width / 2 + 25,
              y: 488,
              vx: 15,
              vy: 10,
              color: PALETTE.CYAN,
              size: 4,
              life: 0.2
            });
          }
        } else if (dx < 0.55 && !car.passed && this.speed > 200 && dz < this.segmentLength * 0.8) {
          car.passed = true;
          this.audio.playCoin();
          this._addScore(600, this.width / 2, 320, PALETTE.CYAN, 'SLIPSTREAM PASS +600!');
        }
      }
    }

    // Stage Fork & Checkpoint Reached!
    if (baseSegIndex >= this.stageLength) {
      this.position = 0;
      this.stage++;
      this.timeRemaining = Math.min(80, this.timeRemaining + 38);

      if (this.stage >= this.maxStages) {
        // Championship Finish Goal!
        this.biomeIndex = BIOMES.length - 1;
        this.audio.playStageClear();
        this._addScore(10000, this.width / 2, 160, PALETTE.GOLD, 'GRAND CHAMPIONSHIP FINISH! +10000');
        setTimeout(() => {
          this.state = 'GAMEOVER';
        }, 3200);
      } else {
        // Branch to next stage based on fork choice
        if (this.forkChoice === 'LEFT') {
          this.biomeIndex = (this.biomeIndex + 1) % (BIOMES.length - 1);
        } else {
          this.biomeIndex = (this.biomeIndex + 2) % (BIOMES.length - 1);
        }
        const newBiome = BIOMES[this.biomeIndex];
        this.audio.playStageClear();
        this._addScore(
          3000 * this.stage,
          this.width / 2,
          160,
          PALETTE.GOLD,
          `CHECKPOINT! ${this.forkChoice} FORK -> ${newBiome.name}!`
        );
      }

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
    const screenY = Math.round(240 + (scale * worldY * this.height) / 2);
    const screenW = Math.round((scale * this.roadWidth * this.width) / 2);
    return { x: screenX, y: screenY, w: screenW, scale };
  }

  render(ctx = this.renderer.ctx) {
    const biome = BIOMES[this.biomeIndex % BIOMES.length];

    // 1. Synthwave Horizon Sky & Glowing Sun
    const skyGrad = ctx.createLinearGradient(0, 38, 0, 265);
    skyGrad.addColorStop(0, biome.skyTop);
    skyGrad.addColorStop(1, biome.skyBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 38, this.width, 240);

    // OutRun Radiant Sun with Scanline Grooves
    const sunX = this.width / 2 - this.playerX * 38;
    this.renderer.drawGlowCircle(sunX, 175, 58, biome.sunColor, 20, true);
    ctx.fillStyle = biome.skyBot;
    for (let s = 0; s < 5; s++) {
      ctx.fillRect(sunX - 65, 182 + s * 9, 130, 3 + s);
    }

    // Ground Base below horizon
    ctx.fillStyle = biome.grassA;
    ctx.fillRect(0, 240, this.width, this.height - 240);

    // 2. Projected 3D Road Segments
    const baseIndex = Math.floor(this.position / this.segmentLength);
    const basePercent = (this.position % this.segmentLength) / this.segmentLength;
    const baseSeg = this.segments[baseIndex % this.segments.length];
    const nextBaseSeg = this.segments[(baseIndex + 1) % this.segments.length];
    const playerElevation = baseSeg.y + (nextBaseSeg.y - baseSeg.y) * basePercent;

    let dx = -(baseSeg.curve * basePercent);
    let x = 0;
    let maxY = this.height;

    const projectedList = [];

    // Near-plane anchor in front of camera
    const nearProj = this._project(-this.playerX * this.roadWidth, this.cameraHeight, 80);
    nearProj.seg = baseSeg;
    nearProj.clipY = maxY;
    projectedList.push(nearProj);

    for (let n = 1; n < this.drawDistance; n++) {
      const seg = this.segments[(baseIndex + n) % this.segments.length];
      const worldZ = (n - basePercent) * this.segmentLength;

      const worldX = -this.playerX * this.roadWidth + x;
      const worldY = this.cameraHeight + playerElevation - seg.y;
      const proj = this._project(worldX, worldY, Math.max(85, worldZ));

      x += dx;
      dx += seg.curve;

      proj.seg = seg;
      proj.clipY = maxY;
      projectedList.push(proj);

      if (worldZ <= 85 || proj.y >= maxY || proj.y < 38) continue;

      const prev = projectedList[projectedList.length - 2];
      const isAlt = Math.floor(seg.index / 3) % 2 === 0;

      // Grass Shoulder Strip
      const stripBottom = Math.min(this.height, prev.y);
      if (stripBottom > proj.y) {
        ctx.fillStyle = isAlt ? biome.grassA : biome.grassB;
        ctx.fillRect(0, proj.y, this.width, stripBottom - proj.y);
      }

      // Rumble Strips
      ctx.fillStyle = isAlt ? biome.rumbleA : biome.rumbleB;
      this._drawTrapezoid(ctx, prev.x, prev.y, prev.w * 1.16, proj.x, proj.y, proj.w * 1.16);

      // Main Asphalt Road or Branching Fork
      ctx.fillStyle = isAlt ? biome.roadA : biome.roadB;
      if (seg.isForkZone) {
        const splitProgress = (seg.index - (this.stageLength - 50)) / 50;
        const offset = proj.w * splitProgress * 0.75;
        const prevOffset = prev.w * splitProgress * 0.75;
        this._drawTrapezoid(ctx, prev.x - prevOffset, prev.y, prev.w * 0.65, proj.x - offset, proj.y, proj.w * 0.65);
        this._drawTrapezoid(ctx, prev.x + prevOffset, prev.y, prev.w * 0.65, proj.x + offset, proj.y, proj.w * 0.65);
      } else {
        this._drawTrapezoid(ctx, prev.x, prev.y, prev.w, proj.x, proj.y, proj.w);
      }

      // Dashed White Lane Dividers
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

      maxY = proj.y;
    }

    // 3. Back-to-Front Pass: Props, Billboards, Checkpoint Arch & Traffic Cars
    for (let i = projectedList.length - 1; i >= 1; i--) {
      const p = projectedList[i];
      const seg = p.seg;
      const spriteScale = p.w / 140;

      // Checkpoint Banner Arch
      if (seg.isCheckpoint && p.y <= p.clipY && p.y <= this.height) {
        const archW = p.w * 2.2;
        const archH = 58 * spriteScale;
        this.renderer.drawGlowRect(
          p.x - archW / 2,
          p.y - archH,
          archW,
          15 * spriteScale,
          PALETTE.GOLD,
          12,
          true
        );
        this.renderer.drawText('CHECKPOINT', p.x, p.y - archH + 11 * spriteScale, {
          font: FONTS.HEADER,
          size: Math.max(6, 11 * spriteScale),
          color: PALETTE.WHITE,
          align: 'center'
        });
      }

      // Roadside Props & Billboards
      for (const prop of seg.props) {
        const px = p.x + p.w * prop.offset;
        const py = p.y;
        if (py > p.clipY || py > this.height) continue;

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
        } else if (prop.type === 'CACTUS') {
          const cH = 60 * spriteScale;
          const cW = Math.max(2, 8 * spriteScale);
          ctx.fillStyle = '#15803D';
          ctx.fillRect(px - cW / 2, py - cH, cW, cH);
          ctx.fillRect(px - 14 * spriteScale, py - cH * 0.65, 28 * spriteScale, 5 * spriteScale);
        } else if (prop.type === 'PINE') {
          const pH = 70 * spriteScale;
          ctx.fillStyle = '#064E3B';
          ctx.beginPath();
          ctx.moveTo(px, py - pH);
          ctx.lineTo(px - 18 * spriteScale, py);
          ctx.lineTo(px + 18 * spriteScale, py);
          ctx.closePath();
          ctx.fill();
        } else if (prop.type === 'BILLBOARD') {
          const bw = 68 * spriteScale;
          const bh = 38 * spriteScale;
          this.renderer.drawGlowRect(px - bw / 2, py - bh, bw, bh, PALETTE.PINK, 8, true);
          ctx.strokeStyle = PALETTE.CYAN;
          ctx.strokeRect(px - bw / 2, py - bh, bw, bh);
          this.renderer.drawText(prop.brand || 'OUTRUN', px, py - bh * 0.35, {
            font: FONTS.HEADER,
            size: Math.max(5, 10 * spriteScale),
            color: PALETTE.WHITE,
            align: 'center'
          });
        }
      }

      // Traffic Cars in Segment with Distinct Models
      for (const car of this.traffic) {
        const carSegIdx = Math.floor(car.z / this.segmentLength) % this.segments.length;
        if (carSegIdx === seg.index && p.y <= p.clipY && p.y <= this.height) {
          const pNext = i + 1 < projectedList.length ? projectedList[i + 1] : p;
          const frac = (car.z % this.segmentLength) / this.segmentLength;
          const roadX = p.x + (pNext.x - p.x) * frac;
          const roadY = p.y + (pNext.y - p.y) * frac;
          const roadW = p.w + (pNext.w - p.w) * frac;
          const carScale = roadW / 140;

          const cx = roadX + roadW * car.offset;
          const cy = roadY;

          this._drawTrafficCar(ctx, cx, cy, carScale, car);
        }
      }
    }

    // 4. Fork Navigation Banner
    if (baseIndex >= this.stageLength - 65) {
      this.renderer.drawText(
        `BRANCH FORK AHEAD: [LEFT] OR [RIGHT] — CURRENT ROUTE: ${this.forkChoice}`,
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

    // 5. Draw Player Ferrari-Red Testarossa Convertible Supercar
    const carX = this.width / 2 + this.steerAngle * 14;
    const carY = 478 + (this.speed > 20 && Math.floor(performance.now() / 60) % 2 === 0 ? 1 : 0);
    const windWave = Math.sin(performance.now() * 0.025) * 3;

    ctx.save();
    ctx.translate(carX, carY);

    if (this.crashRoll > 0) {
      ctx.rotate(this.crashRoll);
    } else if (this.drifting) {
      ctx.rotate(this.steerAngle * 0.14);
    }

    // Ground Shadow under Testarossa
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 15, 58, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Twin Wide Performance Rear Tires
    ctx.fillStyle = '#09090B';
    ctx.fillRect(-54, 1, 22, 17);
    ctx.fillRect(32, 1, 22, 17);
    ctx.fillStyle = '#27272A';
    ctx.fillRect(-50, 4, 14, 4);
    ctx.fillRect(36, 4, 14, 4);

    // Quad Chrome Exhaust Pipes (with Blue Flames when Slipstreaming!)
    ctx.fillStyle = '#18181B';
    ctx.fillRect(-44, 4, 88, 9);
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(-38, 7, 5, 5);
    ctx.fillRect(-31, 7, 5, 5);
    ctx.fillRect(26, 7, 5, 5);
    ctx.fillRect(33, 7, 5, 5);

    if (this.slipstreaming) {
      this.renderer.drawGlowCircle(-34, 12, 6, PALETTE.CYAN, 12, true);
      this.renderer.drawGlowCircle(30, 12, 6, PALETTE.CYAN, 12, true);
    }

    // Sculpted Ferrari-Red Testarossa Wide Body & Rear Strakes
    this.renderer.drawGlowRect(-50, -19, 100, 25, '#EF4444', 12, true);
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(-52, -12, 104, 16);

    // Black horizontal louvers / strake grille
    ctx.fillStyle = '#09090B';
    ctx.fillRect(-46, -10, 92, 10);
    ctx.fillStyle = '#27272A';
    for (let s = -9; s <= -2; s += 3) {
      ctx.fillRect(-45, s, 90, 1);
    }

    // Glowing Taillights (Bright Red when Braking!)
    const isBraking = this.input.isDown('down') || this.input.isDown('actionB');
    const brakeColor = isBraking ? '#FF0033' : PALETTE.RED;
    this.renderer.drawGlowRect(-44, -9, 12, 7, brakeColor, isBraking ? 14 : 8, true);
    this.renderer.drawGlowRect(-31, -9, 9, 7, PALETTE.GOLD, 6, true);
    this.renderer.drawGlowRect(22, -9, 9, 7, PALETTE.GOLD, 6, true);
    this.renderer.drawGlowRect(32, -9, 12, 7, brakeColor, isBraking ? 14 : 8, true);

    // Center License Plate
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(-9, -8, 18, 7);
    ctx.fillStyle = '#09090B';
    ctx.fillRect(-6, -6, 12, 3);

    // Convertible Windshield Frame & Glass
    ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.beginPath();
    ctx.moveTo(-36, -19);
    ctx.lineTo(-28, -32);
    ctx.lineTo(28, -32);
    ctx.lineTo(36, -19);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Driver (Left) & Blonde Passenger (Right)
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(-22, -23, 14, 6);
    ctx.fillStyle = '#FDBA74';
    ctx.beginPath();
    ctx.arc(-15, -26, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#451A03';
    ctx.fillRect(-21, -32, 12, 5);
    ctx.fillRect(-22 + windWave, -30, 6, 4);

    ctx.fillStyle = PALETTE.PINK;
    ctx.fillRect(8, -23, 14, 6);
    ctx.fillStyle = '#FDBA74';
    ctx.beginPath();
    ctx.arc(15, -26, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(9, -32, 12, 5);
    ctx.fillRect(14 + windWave * 1.3, -29, 9, 5);

    ctx.restore();

    // 6. Particles & Popups
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

    // 7. In-Dash FM Radio Station Banner
    if (this.radioPopupTimer > 0) {
      const st = RADIO_STATIONS[this.radioIndex];
      this.renderer.drawText(`FM STEREO: ${st.name}`, this.width / 2, 48, {
        font: FONTS.HEADER,
        size: 11,
        color: PALETTE.CYAN,
        align: 'center',
        glow: 8
      });
    }

    // 8. Bottom Dashboard: Tachometer LED, Gear Shifter, Speedometer & Slipstream
    ctx.fillStyle = 'rgba(9, 13, 22, 0.88)';
    ctx.fillRect(590, 488, 355, 42);
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(590, 488, 355, 42);

    // Tachometer LED Bars
    for (let b = 0; b < 10; b++) {
      const active = b / 10 < this.rpmRatio;
      ctx.fillStyle = !active
        ? '#1E293B'
        : b >= 8
        ? PALETTE.RED
        : b >= 6
        ? PALETTE.GOLD
        : PALETTE.GREEN;
      ctx.fillRect(602 + b * 11, 498, 8, 20);
    }

    // Gear Indicator (LOW / HIGH) with Shift Flash
    const gearCol = (this.gear === 'LOW' && this.rpmRatio > 0.88)
      ? (Math.floor(performance.now() / 120) % 2 === 0 ? PALETTE.RED : PALETTE.GOLD)
      : this.gear === 'HIGH' ? PALETTE.GOLD : PALETTE.CYAN;

    const gearText = (this.gear === 'LOW' && this.rpmRatio > 0.88)
      ? 'SHIFT UP!'
      : `GEAR: ${this.gear}`;

    this.renderer.drawText(gearText, 720, 516, {
      font: FONTS.HEADER,
      size: 11,
      color: gearCol,
      align: 'left',
      glow: 6
    });

    // Speedometer (KM/H)
    const speedCol = this.slipstreaming ? PALETTE.CYAN : this.speed > 250 ? PALETTE.PINK : PALETTE.WHITE;
    this.renderer.drawText(`${Math.floor(this.speed)} KM/H`, 935, 518, {
      font: FONTS.HEADER,
      size: 16,
      color: speedCol,
      align: 'right',
      glow: 10
    });

    if (this.slipstreaming) {
      this.renderer.drawText('SLIPSTREAM DRAFTING!', 935, 482, {
        font: FONTS.HEADER,
        size: 10.5,
        color: PALETTE.CYAN,
        align: 'right',
        glow: 8
      });
    } else if (this.drifting) {
      this.renderer.drawText('POWER DRIFT!', 935, 482, {
        font: FONTS.HEADER,
        size: 11,
        color: PALETTE.GOLD,
        align: 'right',
        glow: 8
      });
    }

    // Top HUD
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.stage,
      extraLabel: `TIME:${Math.ceil(this.timeRemaining)}s ${biome.name.split(' ')[0]} (STAGE ${this.stage}/5)`,
      accent: PALETTE.PINK
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1986 SEGA ARCADE HORIZON TURBO RACER',
      controls: 'STEER: ARROWS  |  GAS: UP/Z (293 KM/H)  |  BRAKE/DRIFT: DOWN/X  |  GEAR: SHIFT/C  |  RADIO: R',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.PINK
    });
  }

  _drawTrafficCar(ctx, cx, cy, carScale, car) {
    ctx.save();
    ctx.translate(cx, cy);

    if (car.model === 'truck') {
      // Green Heavy Cargo Truck
      const tw = Math.max(12, 48 * carScale);
      const th = Math.max(8, 28 * carScale);
      this.renderer.drawGlowRect(-tw / 2, -th, tw, th, '#15803D', 6, true);
      // Cargo bed & roof
      ctx.fillStyle = '#166534';
      ctx.fillRect(-tw / 2 + 3, -th + 3, tw - 6, th * 0.6);
      // Red Taillights
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(-tw * 0.42, -th * 0.3, tw * 0.2, th * 0.25);
      ctx.fillRect(tw * 0.22, -th * 0.3, tw * 0.2, th * 0.25);
    } else if (car.model === 'beetle') {
      // Classic Yellow VW Bug (Rounded Roof)
      const bw = Math.max(8, 34 * carScale);
      const bh = Math.max(5, 20 * carScale);
      this.renderer.drawGlowRect(-bw / 2, -bh, bw, bh, '#EAB308', 6, true);
      // Rounded Roof
      ctx.fillStyle = '#CA8A04';
      ctx.beginPath();
      ctx.arc(0, -bh, bw * 0.35, Math.PI, 0);
      ctx.fill();
      // Round Taillights
      ctx.fillStyle = PALETTE.RED;
      ctx.beginPath();
      ctx.arc(-bw * 0.32, -bh * 0.3, 3 * carScale, 0, Math.PI * 2);
      ctx.arc(bw * 0.32, -bh * 0.3, 3 * carScale, 0, Math.PI * 2);
      ctx.fill();
    } else if (car.model === 'sports') {
      // Red Sports Coupe (Porsche 911)
      const sw = Math.max(9, 38 * carScale);
      const sh = Math.max(5, 18 * carScale);
      this.renderer.drawGlowRect(-sw / 2, -sh, sw, sh, '#DC2626', 6, true);
      ctx.fillStyle = '#09090B';
      ctx.fillRect(-sw / 2 + 4, -sh + 2, sw - 8, sh * 0.45);
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(-sw * 0.42, -sh * 0.35, sw * 0.22, sh * 0.3);
      ctx.fillRect(sw * 0.2, -sh * 0.35, sw * 0.22, sh * 0.3);
    } else {
      // Convertible Cruiser
      const cw = Math.max(8, 36 * carScale);
      const ch = Math.max(5, 19 * carScale);
      this.renderer.drawGlowRect(-cw / 2, -ch, cw, ch, car.color, 6, true);
      ctx.fillStyle = '#FDBA74';
      ctx.fillRect(-4, -ch - 2, 4, 4);
      ctx.fillRect(2, -ch - 2, 4, 4);
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(-cw * 0.4, -ch * 0.35, cw * 0.2, ch * 0.3);
      ctx.fillRect(cw * 0.2, -ch * 0.35, cw * 0.2, ch * 0.3);
    }

    ctx.restore();
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
