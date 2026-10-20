/**
 * Excitebike.js
 * 4-Lane Side-Scrolling Stadium Motocross
 * Switch between 4 lanes (Up/Down), adjust mid-air bike pitch angle for flat landings,
 * balance Action A throttle vs Action B Turbo Boost & Engine Heat Bar (TEMP),
 * hit cooling [<<] strips, clear stunt incline ramps & mud slicks, and clip rival AI bikers!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

export class Excitebike {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'excitebike';
    this.title = 'Nitro Moto';
    this.state = 'PLAYING';

    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.laneYs = [318, 358, 398, 438];
    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.state = 'PLAYING';

    this.particles = [];
    this.floatingTexts = [];
    this._initTrack(this.level);
  }

  _initTrack(level) {
    this.trackLength = 5600 + level * 800;
    this.lapTime = 0;
    this.targetTime = 42.0;
    this.levelClearTimer = 0;

    this.bike = {
      worldX: 0,
      screenX: 210,
      lane: 1,
      laneY: this.laneYs[1],
      z: 0, // Height above track surface
      vz: 0,
      speed: 0,
      pitch: 0, // Radians (-0.65 nose up to +0.65 nose down)
      temp: 25, // 0..100 Engine Heat
      overheated: false,
      overheatTimer: 0,
      crashed: false,
      crashTimer: 0,
      wheelPhase: 0
    };

    // Generate Stadium Track Obstacles: Ramps, Cooling [<<] Strips, Mud Slicks
    this.features = [];
    let cursorX = 480;
    while (cursorX < this.trackLength - 450) {
      const roll = Math.random();
      if (roll < 0.36) {
        // Stunt Incline Ramp spanning all 4 lanes
        const isMonster = Math.random() < 0.35;
        this.features.push({
          type: 'ramp',
          x: cursorX,
          width: isMonster ? 190 : 120,
          height: isMonster ? 76 : 44
        });
        cursorX += 340;
      } else if (roll < 0.64) {
        // Cooling [<<] Arrow Strip in 1 or 2 lanes
        const lane = Math.floor(Math.random() * 4);
        this.features.push({
          type: 'cooler',
          x: cursorX,
          width: 76,
          lane
        });
        cursorX += 220;
      } else {
        // Mud Slick patch in 1 or 2 lanes
        const lane = Math.floor(Math.random() * 4);
        this.features.push({
          type: 'mud',
          x: cursorX,
          width: 84,
          lane
        });
        cursorX += 240;
      }
    }

    // Spawn Rival AI Motocross Bikers
    this.rivals = [];
    const rivalColors = [PALETTE.PINK, PALETTE.GOLD, PALETTE.GREEN, PALETTE.PURPLE];
    for (let i = 0; i < 5 + level; i++) {
      const lane = i % 4;
      this.rivals.push({
        worldX: 450 + i * 750,
        lane,
        laneY: this.laneYs[lane],
        z: 0,
        vz: 0,
        speed: 250 + (i % 3) * 28 + level * 12,
        color: rivalColors[i % rivalColors.length],
        wipedOut: false,
        wipeTimer: 0,
        laneSwitchTimer: 1.5 + Math.random() * 2.0
      });
    }
  }

  _getRampStateAt(worldX) {
    for (const f of this.features) {
      if (f.type !== 'ramp') continue;
      if (worldX >= f.x && worldX <= f.x + f.width) {
        const t = (worldX - f.x) / f.width;
        // Triangle/trapezoid ramp profile: up 0..0.45, flat peak 0.45..0.55, down 0.55..1.0
        if (t < 0.45) {
          return {
            height: (t / 0.45) * f.height,
            slope: -0.45 // Nose up incline
          };
        } else if (t <= 0.55) {
          return {
            height: f.height,
            slope: 0
          };
        } else {
          return {
            height: ((1 - t) / 0.45) * f.height,
            slope: 0.45 // Nose down decline
          };
        }
      }
    }
    return { height: 0, slope: 0 };
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.particles = [];
    this.floatingTexts = [];
  }

  _spawnDirtParticles(x, y, color = PALETTE.ORANGE, count = 6) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: -80 - Math.random() * 110,
        vy: -20 - Math.random() * 80,
        life: 0.25 + Math.random() * 0.25,
        maxLife: 0.5,
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
        this._initTrack(this.level);
      }
      return;
    }

    this.lapTime += dt;
    const b = this.bike;

    // Handle Crash / Wipeout Recovery
    if (b.crashed) {
      b.crashTimer -= dt;
      b.speed *= Math.pow(0.05, dt);
      b.worldX += b.speed * dt;
      if (b.crashTimer <= 0) {
        b.crashed = false;
        b.pitch = 0;
        b.z = 0;
        b.vz = 0;
      }
      return;
    }

    // Handle Overheat Stall
    if (b.overheated) {
      b.overheatTimer -= dt;
      b.speed *= Math.pow(0.08, dt);
      b.worldX += b.speed * dt;
      b.temp = Math.max(25, b.temp - 32 * dt);
      if (b.overheatTimer <= 0) {
        b.overheated = false;
        this.audio.playPowerUp();
      }
    } else {
      // Normal Throttle (Action A or Right arrow) vs Turbo Boost (Action B)
      const turbo = this.input.isDown('actionB');
      const throttle =
        this.input.isDown('actionA') ||
        this.input.isDown('right') ||
        this.input.pointer.down ||
        turbo;

      if (turbo) {
        b.speed = Math.min(480, b.speed + 360 * dt);
        b.temp += 26 * dt;
        if (Math.random() < 0.5 && b.z <= 2) {
          this._spawnDirtParticles(b.screenX - 18, b.laneY, PALETTE.CYAN, 2);
        }
      } else if (throttle) {
        const maxNorm = 340;
        if (b.speed < maxNorm) {
          b.speed = Math.min(maxNorm, b.speed + 250 * dt);
        } else {
          b.speed = Math.max(maxNorm, b.speed - 140 * dt);
        }
        b.temp = Math.max(20, b.temp - 8 * dt);
      } else {
        b.speed = Math.max(0, b.speed - 210 * dt);
        b.temp = Math.max(15, b.temp - 18 * dt);
      }

      // Check Engine Overheat threshold
      if (b.temp >= 100) {
        b.temp = 100;
        b.overheated = true;
        b.overheatTimer = 2.2;
        this.audio.playExplosion(0.4, 600);
        this.renderer.shake(5, 0.2);
        this.floatingTexts.push({
          text: 'OVERHEAT! COOLING...',
          x: b.screenX,
          y: b.laneY - 50,
          vy: -30,
          life: 1.5,
          maxLife: 1.5,
          color: PALETTE.RED
        });
      }
    }

    // Advance along track
    const prevWorldX = b.worldX;
    b.worldX += b.speed * dt;
    b.wheelPhase += b.speed * dt * 0.1;

    if (b.worldX > prevWorldX) {
      this.score += Math.floor((b.worldX - prevWorldX) * 0.25);
      if (this.score > this.highScore) {
        this.highScore = this.score;
        HighScoreStore.submit(this.id, this.score);
      }
    }

    const rampState = this._getRampStateAt(b.worldX);
    const prevRampState = this._getRampStateAt(prevWorldX);
    const airborne = b.z > rampState.height + 2;

    // Lane Switching (on ground) vs Mid-Air Bike Pitch Adjustment
    if (!airborne) {
      if (this.input.isJustPressed('up') && b.lane > 0) {
        b.lane--;
        this.audio.playMenuMove();
      } else if (this.input.isJustPressed('down') && b.lane < 3) {
        b.lane++;
        this.audio.playMenuMove();
      }
      b.laneY += (this.laneYs[b.lane] - b.laneY) * Math.min(1, dt * 16);

      // Launch into air when cresting a ramp peak at speed!
      if (prevRampState.slope < 0 && rampState.slope >= 0 && b.speed > 160) {
        b.vz = b.speed * 0.58;
        b.z = rampState.height + 3;
        this.audio.playJump();
      } else {
        b.z = rampState.height;
        b.vz = 0;
        // Wheelie on ground if pulling left
        if (this.input.isDown('left')) {
          b.pitch = -0.38;
        } else {
          b.pitch += (rampState.slope - b.pitch) * Math.min(1, dt * 14);
        }
      }
    } else {
      // Mid-air physics & Pitch Angle Control!
      b.laneY += (this.laneYs[b.lane] - b.laneY) * Math.min(1, dt * 10);
      b.vz -= 540 * dt;
      b.z += b.vz * dt;

      const axis = this.input.getAxis();
      // Left/Up raises nose (back-tilt), Right/Down lowers nose (forward-tilt)
      const tiltInput = axis.x !== 0 ? axis.x : axis.y;
      b.pitch = Math.max(-0.75, Math.min(0.75, b.pitch + tiltInput * 2.6 * dt));

      // Check Landing on Track or Ramp
      if (b.z <= rampState.height) {
        b.z = rampState.height;
        b.vz = 0;
        const pitchDiff = Math.abs(b.pitch - rampState.slope);
        if (pitchDiff < 0.28) {
          // Flat / Matched-Angle Landing -> Speed & Score Bonus!
          b.speed = Math.min(500, b.speed + 55);
          this.score += 300;
          this.audio.playCoin();
          this.floatingTexts.push({
            text: 'PERFECT LANDING +300!',
            x: b.screenX,
            y: b.laneY - 45,
            vy: -40,
            life: 0.9,
            maxLife: 0.9,
            color: PALETTE.GREEN
          });
        } else if (pitchDiff > 0.58) {
          // Bad angle landing -> Crash!
          b.crashed = true;
          b.crashTimer = 1.1;
          b.speed = 60;
          this.audio.playHit();
          this.renderer.shake(6, 0.2);
          this._spawnDirtParticles(b.screenX, b.laneY, PALETTE.RED, 14);
          this.floatingTexts.push({
            text: 'WIPEOUT!',
            x: b.screenX,
            y: b.laneY - 45,
            vy: -35,
            life: 0.9,
            maxLife: 0.9,
            color: PALETTE.PINK
          });
        } else {
          b.speed *= 0.78;
          this.audio.playShove();
        }
        b.pitch = rampState.slope;
      }
    }

    // Check Track Features (Cooling [<<] Strips & Mud Slicks) when on ground
    if (!airborne) {
      for (const f of this.features) {
        if (f.type === 'ramp') continue;
        if (
          f.lane === b.lane &&
          b.worldX >= f.x &&
          b.worldX <= f.x + f.width
        ) {
          if (f.type === 'cooler' && !f.used) {
            f.used = true;
            b.temp = Math.max(10, b.temp - 45);
            this.score += 200;
            this.audio.playPowerUp();
            this.floatingTexts.push({
              text: 'COOLING BOOST!',
              x: b.screenX,
              y: b.laneY - 40,
              vy: -38,
              life: 0.85,
              maxLife: 0.85,
              color: PALETTE.CYAN
            });
          } else if (f.type === 'mud') {
            b.speed = Math.min(b.speed, 135);
            if (Math.random() < 0.4) {
              this._spawnDirtParticles(b.screenX, b.laneY, '#78350F', 3);
            }
          }
        }
      }
    }

    // Update Rival AI Bikers & Rear-Wheel Clipping Physics
    for (const r of this.rivals) {
      if (r.wipedOut) {
        r.wipeTimer -= dt;
        if (r.wipeTimer <= 0) {
          r.wipedOut = false;
          r.speed = 240;
        }
        continue;
      }

      r.worldX += r.speed * dt;
      const rRamp = this._getRampStateAt(r.worldX);
      r.z = rRamp.height;

      r.laneSwitchTimer -= dt;
      if (r.laneSwitchTimer <= 0 && r.z === 0) {
        r.laneSwitchTimer = 1.8 + Math.random() * 2.0;
        r.lane = Math.max(0, Math.min(3, r.lane + (Math.random() < 0.5 ? -1 : 1)));
      }
      r.laneY += (this.laneYs[r.lane] - r.laneY) * Math.min(1, dt * 10);

      // Check collision with player bike in same lane & similar height
      if (r.lane === b.lane && Math.abs(r.z - b.z) < 22) {
        const dx = b.worldX - r.worldX;
        if (Math.abs(dx) < 38) {
          if (dx >= 0) {
            // Player is slightly ahead -> Player's rear wheel clips Rival's front wheel! Rival wipes out!
            r.wipedOut = true;
            r.wipeTimer = 1.8;
            this.score += 500;
            this.audio.playSlap();
            this.renderer.shake(4, 0.12);
            const rx = b.screenX + (r.worldX - b.worldX);
            this._spawnDirtParticles(rx, r.laneY, r.color, 12);
            this.floatingTexts.push({
              text: '+500 RIVAL TAKEDOWN!',
              x: rx,
              y: r.laneY - 40,
              vy: -40,
              life: 0.95,
              maxLife: 0.95,
              color: PALETTE.GOLD
            });
          } else {
            // Player ran into rival's rear tire -> Knockback or crash!
            b.speed *= 0.45;
            b.worldX = r.worldX - 40;
            this.audio.playHit();
            this.renderer.shake(4, 0.1);
          }
        }
      }
    }

    // Update Particles & Floating Texts
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // Check Finish Line Crossing
    if (b.worldX >= this.trackLength) {
      const timeBonus = Math.max(0, Math.floor((this.targetTime - this.lapTime) * 150));
      this.score += 2000 + timeBonus;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        HighScoreStore.submit(this.id, this.score);
      }
      this.audio.playStageClear();
      this.levelClearTimer = 2.0;
    }
  }

  _drawBike(ctx, screenX, laneY, z, pitch, color, wipedOut = false) {
    // Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(screenX, laneY + 6, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(screenX, laneY - z);
    ctx.rotate(wipedOut ? Math.PI * 0.65 : pitch);

    // Rear & Front Tires
    this.renderer.drawGlowCircle(-14, -4, 9, '#0F172A', 4);
    ctx.strokeStyle = PALETTE.WHITE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-14, -4, 7, 0, Math.PI * 2);
    ctx.stroke();

    this.renderer.drawGlowCircle(15, -4, 9, '#0F172A', 4);
    ctx.beginPath();
    ctx.arc(15, -4, 7, 0, Math.PI * 2);
    ctx.stroke();

    // Motocross Frame
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.lineTo(-2, -16);
    ctx.lineTo(12, -14);
    ctx.lineTo(15, -4);
    ctx.moveTo(-2, -16);
    ctx.lineTo(4, -6);
    ctx.stroke();

    // Rider torso & helmet
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(-6, -28, 9, 12);
    this.renderer.drawGlowCircle(0, -32, 6, color, 8);
    ctx.restore();
  }

  render(ctx = this.renderer.ctx) {
    const b = this.bike;
    const camX = b.worldX - b.screenX;

    // Stadium Sky & Grandstands
    ctx.fillStyle = '#0B132B';
    ctx.fillRect(0, 38, this.renderer.width, 250);

    // Crowd Grandstand Lights
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 175, this.renderer.width, 95);
    for (let i = 0; i < 32; i++) {
      const sx = ((i * 64 - camX * 0.25) % 960 + 960) % 960;
      ctx.fillStyle = i % 3 === 0 ? PALETTE.CYAN : i % 3 === 1 ? PALETTE.PINK : PALETTE.GOLD;
      ctx.fillRect(sx, 195 + (i % 4) * 14, 6, 6);
    }

    // Green Stadium Infield Verge
    ctx.fillStyle = '#15803D';
    ctx.fillRect(0, 270, this.renderer.width, 270);

    // 4-Lane Motocross Track Surface
    ctx.fillStyle = '#9A3412';
    ctx.fillRect(0, 296, this.renderer.width, 168);

    // Lane Divider Lines
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.35)';
    ctx.lineWidth = 2;
    for (let l = 0; l <= 4; l++) {
      const ly = 298 + l * 40;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(this.renderer.width, ly);
      ctx.stroke();
    }

    // Track Distance Markers
    ctx.fillStyle = PALETTE.WHITE;
    for (let wx = 0; wx < this.trackLength; wx += 160) {
      const sx = wx - camX;
      if (sx >= -20 && sx <= 980) {
        ctx.fillRect(sx, 288, 12, 8);
        ctx.fillRect(sx, 464, 12, 8);
      }
    }

    // Draw Track Features (Ramps, Cooling [<<] Strips, Mud Slicks)
    for (const f of this.features) {
      const sx = f.x - camX;
      if (sx + f.width < -40 || sx > 1000) continue;

      if (f.type === 'ramp') {
        ctx.fillStyle = '#D97706';
        ctx.strokeStyle = PALETTE.GOLD;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, 464);
        ctx.lineTo(sx + f.width * 0.45, 296 - f.height);
        ctx.lineTo(sx + f.width * 0.55, 296 - f.height);
        ctx.lineTo(sx + f.width, 464);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (f.type === 'cooler') {
        const ly = this.laneYs[f.lane] - 14;
        this.renderer.drawGlowRect(sx, ly, f.width, 28, PALETTE.CYAN, 10);
        this.renderer.drawText('<< COOL', sx + f.width / 2, ly + 19, {
          size: 12,
          color: '#0B0F19',
          align: 'center'
        });
      } else if (f.type === 'mud') {
        const ly = this.laneYs[f.lane] - 12;
        ctx.fillStyle = '#451A03';
        ctx.fillRect(sx, ly, f.width, 24);
        ctx.strokeStyle = PALETTE.ORANGE;
        ctx.strokeRect(sx, ly, f.width, 24);
      }
    }

    // Draw Finish Line Banner
    const finishSx = this.trackLength - camX;
    if (finishSx > -50 && finishSx < 1000) {
      this.renderer.drawGlowRect(finishSx, 280, 18, 190, PALETTE.GOLD, 14);
      this.renderer.drawText('FINISH', finishSx + 9, 272, {
        font: FONTS.HEADER,
        size: 13,
        color: PALETTE.GOLD,
        align: 'center',
        glow: 8
      });
    }

    // Sort and Draw Bikes by Lane for proper depth overlap
    const allBikes = [
      {
        isPlayer: true,
        screenX: b.screenX,
        lane: b.lane,
        laneY: b.laneY,
        z: b.z,
        pitch: b.pitch,
        color: PALETTE.CYAN,
        wipedOut: b.crashed
      },
      ...this.rivals.map((r) => ({
        isPlayer: false,
        screenX: r.worldX - camX,
        lane: r.lane,
        laneY: r.laneY,
        z: r.z,
        pitch: 0,
        color: r.color,
        wipedOut: r.wipedOut
      }))
    ].sort((a, c) => a.laneY - c.laneY);

    for (const unit of allBikes) {
      if (unit.screenX > -60 && unit.screenX < 1020) {
        this._drawBike(
          ctx,
          unit.screenX,
          unit.laneY,
          unit.z,
          unit.pitch,
          unit.color,
          unit.wipedOut
        );
      }
    }

    // Draw Dirt & Exhaust Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Draw Floating Score / Landing Popups
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      this.renderer.drawText(ft.text, ft.x, ft.y, {
        size: 13,
        color: ft.color,
        align: 'center',
        glow: 6
      });
    }
    ctx.globalAlpha = 1;

    // Bottom Dashboard: Engine Heat Bar (TEMP), Speedometer, and Track Progress
    ctx.fillStyle = '#090D16';
    ctx.fillRect(40, 476, 880, 52);
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 476, 880, 52);

    this.renderer.drawText('TEMP', 65, 507, {
      font: FONTS.HEADER,
      size: 12,
      color: b.overheated ? PALETTE.RED : PALETTE.GOLD
    });

    ctx.fillStyle = '#1E293B';
    ctx.fillRect(135, 492, 220, 18);
    const tempRatio = Math.min(1, b.temp / 100);
    const tempCol =
      b.overheated || tempRatio > 0.8
        ? PALETTE.RED
        : tempRatio > 0.55
        ? PALETTE.ORANGE
        : PALETTE.CYAN;
    this.renderer.drawGlowRect(135, 492, 220 * tempRatio, 18, tempCol, 8);

    const kph = Math.floor(b.speed * 0.42);
    this.renderer.drawText(`SPEED: ${kph} KM/H`, 390, 507, {
      font: FONTS.HUD,
      size: 16,
      color: PALETTE.WHITE
    });

    const prog = Math.min(100, Math.floor((b.worldX / this.trackLength) * 100));
    this.renderer.drawText(`LAP: ${prog}%   TIME: ${this.lapTime.toFixed(1)}s`, 610, 507, {
      font: FONTS.HUD,
      size: 16,
      color: PALETTE.GREEN
    });

    if (this.levelClearTimer > 0) {
      this.renderer.drawText('TRACK COMPLETE! PODIUM BONUS!', 480, 145, {
        font: FONTS.HEADER,
        size: 20,
        color: PALETTE.GOLD,
        align: 'center',
        glow: 12
      });
    }

    // Top HUD
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `TEMP:${Math.floor(b.temp)}%`,
      accent: PALETTE.ORANGE
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'MOTOCROSS STUNT & TURBO RACING',
      controls: 'UP/DOWN: SWITCH LANES  |  LEFT/RIGHT: AIR PITCH  |  Z: GAS  |  X: TURBO',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.ORANGE
    });
  }
}

export default Excitebike;
