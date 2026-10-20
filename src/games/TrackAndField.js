/**
 * TrackAndField.js
 * Classic 1983 3-Event Olympic Arcade Decathlon Cycle:
 *   1. 100m Dash (Head-to-head sprint vs CPU Rival)
 *   2. Long Jump (Runway sprint + Foul Board timing + 0°..65° Launch Angle meter)
 *   3. Javelin Throw (Runway sprint + 0°..65° Elevation release + Sky Bird Easter Egg)
 * Features button-mashing velocity scaling (Action A or alternating Left/Right),
 * ballistic distance physics, qualifying marks, and world-record celebrations.
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const EVENTS = [
  {
    id: 'DASH',
    name: '100m DASH',
    unit: 's',
    baseQualify: 11.4,
    worldRecord: 9.58,
    lowerIsBetter: true
  },
  {
    id: 'LONGJUMP',
    name: 'LONG JUMP',
    unit: 'm',
    baseQualify: 7.0,
    worldRecord: 8.95,
    lowerIsBetter: false
  },
  {
    id: 'JAVELIN',
    name: 'JAVELIN THROW',
    unit: 'm',
    baseQualify: 74.0,
    worldRecord: 98.48,
    lowerIsBetter: false
  }
];

export class TrackAndField {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'trackandfield';
    this.title = 'Cyber Decathlon';
    this.width = 960;
    this.height = 540;

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.eventIndex = 0;
    this.phase = 'READY'; // 'READY' | 'RUN' | 'ANGLE' | 'FLIGHT' | 'RESULT'
    this.phaseTimer = 0;

    this.speed = 0; // m/s (0..13.5)
    this.athleteX = 0; // meters from start line
    this.athleteY = 0; // meters above ground
    this.athleteVy = 0;
    this.rivalX = 0;
    this.rivalSpeed = 0;

    this.elapsedTime = 0;
    this.launchAngle = 0;
    this.chargingAngle = false;
    this.resultValue = 0;
    this.isFoul = false;
    this.qualified = false;
    this.isWorldRecord = false;
    this.lastRunKey = null;

    // Javelin projectile state
    this.javelin = {
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      landed: false
    };

    // High-altitude bird/UFO bonus target during Javelin
    this.skyBird = { x: 45, y: 18, vx: 6, hit: false };

    this.particles = [];
    this.popups = [];

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.eventIndex = 0;
    this.state = 'PLAYING';
    this._initEvent();
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
        life: 1.4
      });
    }
  }

  _getCurrentEvent() {
    return EVENTS[this.eventIndex % EVENTS.length];
  }

  _getQualifyMark() {
    const ev = this._getCurrentEvent();
    const loop = Math.floor((this.level - 1) / 3);
    if (ev.id === 'DASH') {
      return Math.max(9.9, ev.baseQualify - loop * 0.35);
    } else if (ev.id === 'LONGJUMP') {
      return Math.min(8.4, ev.baseQualify + loop * 0.35);
    } else {
      return Math.min(90.0, ev.baseQualify + loop * 4.0);
    }
  }

  _initEvent() {
    this.phase = 'READY';
    this.phaseTimer = 1.6;
    this.speed = 0;
    this.athleteX = 0;
    this.athleteY = 0;
    this.athleteVy = 0;
    this.rivalX = 0;
    this.rivalSpeed = 0;
    this.elapsedTime = 0;
    this.launchAngle = 0;
    this.chargingAngle = false;
    this.resultValue = 0;
    this.isFoul = false;
    this.qualified = false;
    this.isWorldRecord = false;
    this.lastRunKey = null;

    this.javelin = { active: false, x: 0, y: 0, vx: 0, vy: 0, angle: 0, landed: false };
    this.skyBird = { x: 42, y: 22, vx: 7, hit: false };
    this.particles = [];
    this.popups = [];
  }

  _handleMashInput(dt) {
    let mashed = false;
    if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
      mashed = true;
    }
    if (this.input.isJustPressed('left') && this.lastRunKey !== 'left') {
      this.lastRunKey = 'left';
      mashed = true;
    } else if (this.input.isJustPressed('right') && this.lastRunKey !== 'right') {
      this.lastRunKey = 'right';
      mashed = true;
    }

    if (mashed) {
      // Scale gain so rapid tapping builds up to 12.8 m/s
      const boost = Math.max(0.45, 1.35 - this.speed * 0.075);
      this.speed = Math.min(13.2, this.speed + boost);
      this.audio.playMenuMove();
    }

    // Natural air/track drag decay
    this.speed = Math.max(0, this.speed - 3.6 * dt);
  }

  _triggerJumpOrThrow() {
    const ev = this._getCurrentEvent();
    this.launchAngle = Math.max(12, Math.min(65, this.launchAngle));
    const rad = (this.launchAngle * Math.PI) / 180;

    // Bonus accuracy multiplier when near optimal 42°..45° angle
    const angleDiff = Math.abs(this.launchAngle - 43.5);
    const optimalBoost = angleDiff <= 4.0 ? 1.12 : angleDiff <= 8.0 ? 1.04 : 0.94;

    if (ev.id === 'LONGJUMP') {
      this.phase = 'FLIGHT';
      const vTotal = Math.max(6.5, this.speed) * optimalBoost;
      this.speed = vTotal * Math.cos(rad);
      this.athleteVy = vTotal * Math.sin(rad);
      this.audio.playJump();
    } else if (ev.id === 'JAVELIN') {
      this.phase = 'FLIGHT';
      const vThrow = (15.5 + this.speed * 1.45) * optimalBoost;
      this.javelin = {
        active: true,
        x: this.athleteX,
        y: 1.8,
        vx: vThrow * Math.cos(rad),
        vy: vThrow * Math.sin(rad),
        angle: rad,
        landed: false
      };
      this.audio.playLaser(680, 220, 0.16);
    }
  }

  _finishEvent(value, isFoul = false) {
    const ev = this._getCurrentEvent();
    const qualify = this._getQualifyMark();
    this.phase = 'RESULT';
    this.phaseTimer = 3.0;
    this.isFoul = isFoul;
    this.resultValue = value;

    if (isFoul) {
      this.qualified = false;
      this.audio.playHit();
      this.popups.push({
        x: this.width / 2,
        y: 180,
        text: 'FOUL! STEPPED OVER LINE!',
        color: PALETTE.RED,
        life: 2.2
      });
      return;
    }

    this.qualified = ev.lowerIsBetter ? value <= qualify : value >= qualify;
    this.isWorldRecord = ev.lowerIsBetter ? value <= ev.worldRecord : value >= ev.worldRecord;

    if (this.qualified) {
      this.audio.playStageClear();
      let pts = 1200;
      if (ev.lowerIsBetter) {
        pts += Math.max(0, (qualify - value) * 900);
      } else {
        pts += Math.max(0, (value - qualify) * (ev.id === 'LONGJUMP' ? 800 : 80));
      }
      if (this.isWorldRecord) {
        pts += 2500;
      }
      this._addScore(
        pts,
        this.width / 2,
        175,
        this.isWorldRecord ? PALETTE.PINK : PALETTE.GOLD,
        this.isWorldRecord ? `WORLD RECORD! +${Math.floor(pts)}` : `QUALIFIED! +${Math.floor(pts)}`
      );
    } else {
      this.audio.playHit();
      this.popups.push({
        x: this.width / 2,
        y: 180,
        text: 'DID NOT QUALIFY!',
        color: PALETTE.RED,
        life: 2.2
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

    const ev = this._getCurrentEvent();

    if (this.phase === 'READY') {
      const prevTimer = this.phaseTimer;
      this.phaseTimer -= dt;
      if (prevTimer > 0.6 && this.phaseTimer <= 0.6) {
        this.audio.playNote(440, 0.12, 'square', 0.25);
      }
      if (this.phaseTimer <= 0) {
        // Starter pistol bang!
        this.audio.playExplosion(0.18, 1600);
        this.audio.playNote(880, 0.18, 'square', 0.3);
        this.phase = 'RUN';
        this.speed = 3.2;
        this.rivalSpeed = 9.0 + Math.min(2.2, (this.level - 1) * 0.25);
      }
      return;
    }

    if (this.phase === 'RUN') {
      this.elapsedTime += dt;
      this._handleMashInput(dt);
      this.athleteX += this.speed * dt;

      if (ev.id === 'DASH') {
        // CPU Rival sprinter
        const targetRival = 9.2 + Math.sin(this.elapsedTime * 3) * 0.5 + (this.level - 1) * 0.22;
        this.rivalSpeed += (targetRival - this.rivalSpeed) * 2 * dt;
        this.rivalX += this.rivalSpeed * dt;

        if (this.athleteX >= 100) {
          this.athleteX = 100;
          this._finishEvent(this.elapsedTime, false);
        }
      } else {
        // LONG JUMP or JAVELIN THROW (Foul Line at 36m)
        const foulLineX = 36.0;

        // Pressing Action B begins charging launch elevation angle (0°..65°)
        if (this.input.isDown('actionB') && this.athleteX >= 18.0) {
          this.chargingAngle = true;
          this.launchAngle += 105 * dt;
          if (this.launchAngle >= 65) {
            this.launchAngle = 65;
            this._triggerJumpOrThrow();
            return;
          }
        } else if (this.chargingAngle && this.input.isJustReleased('actionB')) {
          this._triggerJumpOrThrow();
          return;
        }

        // Stepping past foul line without releasing triggers a FOUL
        if (this.athleteX > foulLineX + 0.8) {
          if (this.chargingAngle) {
            this._triggerJumpOrThrow();
          } else {
            this._finishEvent(0, true);
          }
        }
      }
    } else if (this.phase === 'FLIGHT') {
      const foulLineX = 36.0;
      if (ev.id === 'LONGJUMP') {
        const g = 9.81 * 1.45;
        this.athleteX += this.speed * dt;
        this.athleteY += this.athleteVy * dt;
        this.athleteVy -= g * dt;

        if (this.athleteY <= 0) {
          this.athleteY = 0;
          const jumpDist = Math.max(0.5, (this.athleteX - foulLineX) * 1.18);
          this.audio.playExplosion(0.22, 600);
          for (let i = 0; i < 16; i++) {
            this.particles.push({
              x: 480,
              y: 385,
              vx: (Math.random() - 0.5) * 180,
              vy: -60 - Math.random() * 140,
              color: PALETTE.GOLD,
              life: 0.6
            });
          }
          this._finishEvent(jumpDist, false);
        }
      } else if (ev.id === 'JAVELIN') {
        const jav = this.javelin;
        const g = 9.81 * 0.35;
        jav.x += jav.vx * dt;
        jav.y += jav.vy * dt;
        jav.vy -= g * dt;
        jav.angle = Math.atan2(jav.vy, jav.vx);

        // Move Sky Bird Easter Egg
        this.skyBird.x += this.skyBird.vx * dt;
        if (
          !this.skyBird.hit &&
          Math.hypot(jav.x - (foulLineX + this.skyBird.x), jav.y - this.skyBird.y) < 4.5
        ) {
          this.skyBird.hit = true;
          this.audio.playPowerUp();
          this._addScore(3000, this.width / 2, 120, PALETTE.CYAN, 'SKY UFO BONUS +3000!');
        }

        if (jav.y <= 0) {
          jav.y = 0;
          jav.landed = true;
          const throwDist = Math.max(10, (jav.x - foulLineX) * 1.05);
          this.audio.playDig();
          this._finishEvent(throwDist, false);
        }
      }
    } else if (this.phase === 'RESULT') {
      this.phaseTimer -= dt;
      if (
        this.phaseTimer <= 0 ||
        this.input.isJustPressed('actionA') ||
        this.input.isJustPressed('actionB')
      ) {
        if (this.qualified) {
          this.eventIndex = (this.eventIndex + 1) % EVENTS.length;
          this.level++;
          this._initEvent();
        } else {
          this.lives--;
          if (this.lives <= 0) {
            this.audio.playGameOver();
            this.setState('GAMEOVER');
          } else {
            this._initEvent();
          }
        }
      }
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
      pop.y -= 30 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  _drawAthlete(ctx, x, y, speed, airborne, color = PALETTE.CYAN, carryingJavelin = false) {
    const stride = airborne ? 0.8 : Math.sin(performance.now() * 0.025 * Math.max(1, speed * 0.4));
    ctx.save();
    ctx.translate(x, y);

    // Head
    this.renderer.drawGlowCircle(0, -34, 7, color, 8, true);
    // Headband
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(-7, -37, 14, 3);

    // Torso
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(-2, -10);
    ctx.stroke();

    // Arms
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(stride * 12, -14);
    ctx.moveTo(0, -24);
    ctx.lineTo(-stride * 12, -14);
    ctx.stroke();

    // Legs
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-2, -10);
    ctx.lineTo(stride * 14, 4);
    ctx.moveTo(-2, -10);
    ctx.lineTo(-stride * 14, 4);
    ctx.stroke();

    if (carryingJavelin) {
      ctx.save();
      const ang = this.chargingAngle ? (-this.launchAngle * Math.PI) / 180 : -0.15;
      ctx.translate(4, -24);
      ctx.rotate(ang);
      this.renderer.drawGlowRect(-26, -1.5, 56, 3, PALETTE.GOLD, 8, true);
      ctx.restore();
    }

    ctx.restore();
  }

  render(ctx = this.renderer.ctx) {
    const ev = this._getCurrentEvent();
    const qualify = this._getQualifyMark();

    // Stadium Night Sky & Crowd Bleachers
    this.renderer.clear('#090D1A');

    // Stadium Floodlights & Scoreboard Header
    ctx.fillStyle = '#131B2E';
    ctx.fillRect(0, 38, this.width, 145);

    // Animated crowd dots in stadium bleachers
    const t = performance.now() * 0.004;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 48; col++) {
        const cx = 12 + col * 20;
        const cy = 115 + row * 15 + (Math.sin(t + col) > 0.5 ? -2 : 0);
        ctx.fillStyle = (col + row) % 3 === 0 ? PALETTE.CYAN : (col + row) % 2 === 0 ? PALETTE.PINK : '#475569';
        ctx.fillRect(cx, cy, 4, 4);
      }
    }

    // Green Stadium Infield Turf
    ctx.fillStyle = '#064E3B';
    ctx.fillRect(0, 183, this.width, 137);

    // Red Olympic Tartan Running Track
    ctx.fillStyle = '#991B1B';
    ctx.fillRect(0, 320, this.width, 130);
    ctx.strokeStyle = PALETTE.WHITE;
    ctx.lineWidth = 2;
    for (let lane = 0; lane <= 2; lane++) {
      const ly = 320 + lane * 55;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(this.width, ly);
      ctx.stroke();
    }

    // Camera scroll in meters (1 meter = 22 pixels)
    const pxPerMeter = 22;
    const focusM =
      ev.id === 'JAVELIN' && this.javelin.active ? this.javelin.x : this.athleteX;
    const camMeters = Math.max(0, focusM - 10);

    // Distance Meter Markers along Track
    for (let m = 0; m <= 140; m += 5) {
      const sx = 220 + (m - camMeters) * pxPerMeter;
      if (sx < -40 || sx > this.width + 40) continue;
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(sx, 312, 2, 8);
      if (m % 10 === 0) {
        this.renderer.drawText(`${m}m`, sx, 306, {
          font: FONTS.HUD,
          size: 12,
          color: PALETTE.WHITE,
          align: 'center'
        });
      }
    }

    // Event-Specific Field Markings (Finish Line, Foul Line, Sand Pit, Qualifying Flag)
    if (ev.id === 'DASH') {
      const finishSx = 220 + (100 - camMeters) * pxPerMeter;
      this.renderer.drawGlowRect(finishSx, 320, 6, 110, PALETTE.WHITE, 10, true);
      // Draw CPU Rival in Top Lane
      const rivalSx = 220 + (this.rivalX - camMeters) * pxPerMeter;
      this._drawAthlete(ctx, rivalSx, 352, this.rivalSpeed, false, PALETTE.ORANGE, false);
    } else {
      const foulSx = 220 + (36 - camMeters) * pxPerMeter;
      this.renderer.drawGlowRect(foulSx, 320, 6, 110, PALETTE.WHITE, 10, true);
      this.renderer.drawText('FOUL LINE', foulSx, 444, {
        font: FONTS.HUD,
        size: 11,
        color: PALETTE.GOLD,
        align: 'center'
      });

      if (ev.id === 'LONGJUMP') {
        const pitStart = 220 + (36.8 - camMeters) * pxPerMeter;
        ctx.fillStyle = '#D97706';
        ctx.fillRect(pitStart, 370, 260, 56);
      }

      // Qualifying Flag Marker
      const qualSx = 220 + (36 + qualify / (ev.id === 'LONGJUMP' ? 1.18 : 1.05) - camMeters) * pxPerMeter;
      this.renderer.drawGlowRect(qualSx, 335, 3, 45, PALETTE.GREEN, 8, true);
      this.renderer.drawText(`QUAL ${qualify.toFixed(2)}m`, qualSx, 330, {
        font: FONTS.HUD,
        size: 11,
        color: PALETTE.GREEN,
        align: 'center'
      });
    }

    // Draw Player Athlete
    const playerSx = 220 + (this.athleteX - camMeters) * pxPerMeter;
    const playerSy = 402 - this.athleteY * 18;
    this._drawAthlete(
      ctx,
      playerSx,
      playerSy,
      this.speed,
      this.athleteY > 0.05,
      PALETTE.CYAN,
      ev.id === 'JAVELIN' && !this.javelin.active
    );

    // Draw Flying Javelin & Sky Bird
    if (ev.id === 'JAVELIN') {
      if (!this.skyBird.hit) {
        const birdSx = 220 + (36 + this.skyBird.x - camMeters) * pxPerMeter;
        const birdSy = 402 - this.skyBird.y * 12;
        this.renderer.drawGlowCircle(birdSx, birdSy, 10, PALETTE.PINK, 10, true);
      }
      if (this.javelin.active) {
        const jx = 220 + (this.javelin.x - camMeters) * pxPerMeter;
        const jy = 402 - this.javelin.y * 12;
        ctx.save();
        ctx.translate(jx, jy);
        ctx.rotate(-this.javelin.angle);
        this.renderer.drawGlowRect(-28, -2, 56, 4, PALETTE.GOLD, 10, true);
        ctx.restore();
      }
    }

    // Draw Launch Angle Protractor Gauge when charging or in field events
    if (ev.id !== 'DASH' && (this.chargingAngle || this.launchAngle > 0)) {
      const gx = playerSx + 36;
      const gy = playerSy - 20;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(gx, gy, 38, -Math.PI * 0.4, 0);
      ctx.stroke();

      // Optimal 42°..45° zone
      ctx.strokeStyle = PALETTE.GOLD;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(gx, gy, 38, (-46 * Math.PI) / 180, (-40 * Math.PI) / 180);
      ctx.stroke();

      // Current angle needle
      const rad = (-this.launchAngle * Math.PI) / 180;
      ctx.strokeStyle = PALETTE.CYAN;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + Math.cos(rad) * 42, gy + Math.sin(rad) * 42);
      ctx.stroke();

      this.renderer.drawText(`${Math.round(this.launchAngle)}°`, gx + 48, gy - 12, {
        font: FONTS.HEADER,
        size: 12,
        color: PALETTE.GOLD
      });
      ctx.restore();
    }

    // Bottom Stadium Dashboard (Speedometer Bar & Event Telemetry)
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 450, this.width, 90);
    this.renderer.drawGlowRect(20, 462, 920, 66, PALETTE.CYAN, 6, false, 1.5);

    this.renderer.drawText(`EVENT ${this.eventIndex + 1}/3: ${ev.name}`, 40, 488, {
      font: FONTS.HEADER,
      size: 13,
      color: PALETTE.GOLD,
      glow: 6
    });
    this.renderer.drawText(
      `QUALIFY: ${qualify.toFixed(2)}${ev.unit}   |   WORLD RECORD: ${ev.worldRecord.toFixed(2)}${ev.unit}`,
      40,
      514,
      {
        font: FONTS.HUD,
        size: 14,
        color: PALETTE.WHITE
      }
    );

    // Speed Meter Bar
    const speedRatio = Math.min(1, this.speed / 13.0);
    this.renderer.drawText(`SPEED: ${(this.speed * 100).toFixed(0)} cm/s`, 560, 485, {
      font: FONTS.HEADER,
      size: 12,
      color: PALETTE.CYAN
    });
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(560, 495, 340, 18);
    this.renderer.drawGlowRect(
      560,
      495,
      340 * speedRatio,
      18,
      speedRatio > 0.8 ? PALETTE.GREEN : PALETTE.CYAN,
      8,
      true
    );

    // Stadium Jumbotron Banner
    let bannerText = '';
    if (this.phase === 'READY') {
      bannerText = this.phaseTimer > 0.6 ? 'ON YOUR MARKS...' : 'GET SET...';
    } else if (this.phase === 'RUN') {
      bannerText =
        ev.id === 'DASH'
          ? `TIME: ${this.elapsedTime.toFixed(2)}s  (TAP Z/SPACE OR LEFT/RIGHT RAPIDLY!)`
          : 'MASH Z/SPACE TO SPRINT! HOLD X/SHIFT AT FOUL LINE TO SET ANGLE!';
    } else if (this.phase === 'RESULT') {
      bannerText = this.isFoul
        ? 'FOUL! STEPPED OVER THE FOUL LINE!'
        : `OFFICIAL MARK: ${this.resultValue.toFixed(2)}${ev.unit} — ${
            this.qualified ? 'QUALIFIED!' : 'FAILED TO QUALIFY'
          }`;
    }

    if (bannerText) {
      this.renderer.drawText(bannerText, this.width / 2, 78, {
        font: FONTS.HEADER,
        size: 13,
        color: PALETTE.GOLD,
        align: 'center',
        glow: 8
      });
    }

    // Particles & Popups
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
    }
    for (const pop of this.popups) {
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HEADER,
        size: 14,
        color: pop.color,
        align: 'center',
        glow: 10
      });
    }

    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: ev.name,
      accent: PALETTE.GOLD
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'OLYMPIC DECATHLON: 100M DASH • LONG JUMP • JAVELIN',
      controls: 'RAPID TAP Z/SPACE OR L/R: SPRINT  |  HOLD & RELEASE X/SHIFT: LAUNCH ANGLE',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GOLD
    });
  }
}

export default TrackAndField;
