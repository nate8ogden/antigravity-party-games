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
    this.title = 'Excitebike';
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
    const trackCatalog = [
      {
        name: 'TRACK 1: KYOTO STADIUM OPENER',
        length: 5600,
        targetTime: 42.0,
        pattern: ['ramp', 'cooler', 'mud', 'monster', 'cooler', 'ramp']
      },
      {
        name: 'TRACK 2: DOUBLE MUD CHICANE',
        length: 6200,
        targetTime: 44.0,
        pattern: ['mud', 'mud', 'cooler', 'ramp', 'mud', 'monster', 'cooler']
      },
      {
        name: 'TRACK 3: TABLE-TOP PLATEAU & BUMPS',
        length: 6600,
        targetTime: 46.0,
        pattern: ['washboard', 'monster', 'cooler', 'ramp', 'washboard', 'mud', 'cooler']
      },
      {
        name: 'TRACK 4: OVERHEAT STRAIGHTAWAY',
        length: 7000,
        targetTime: 47.0,
        pattern: ['cooler', 'cooler', 'monster', 'mud', 'mud', 'cooler', 'monster']
      },
      {
        name: 'TRACK 5: SUPER JUMP FINALE',
        length: 7500,
        targetTime: 49.0,
        pattern: ['monster', 'washboard', 'cooler', 'monster', 'mud', 'monster', 'cooler']
      },
      {
        name: 'TRACK 6: CUSTOM STUNT ARENA',
        length: 8000,
        targetTime: 52.0,
        pattern: ['washboard', 'monster', 'mud', 'cooler', 'monster', 'washboard', 'monster', 'cooler']
      }
    ];

    const trackIdx = (level - 1) % trackCatalog.length;
    const trackMeta = trackCatalog[trackIdx];
    this.trackName = trackMeta.name;
    this.trackLength = trackMeta.length + Math.floor((level - 1) / 6) * 800;
    this.lapTime = 0;
    this.targetTime = trackMeta.targetTime;
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

    // Generate authentic OG Nintendo Excitebike Obstacle Sequences per Track
    this.features = [];
    let cursorX = 460;
    let stepIdx = 0;
    while (cursorX < this.trackLength - 420) {
      const kind = trackMeta.pattern[stepIdx % trackMeta.pattern.length];
      stepIdx++;

      if (kind === 'monster') {
        // Monster Jump Ramp / Table-Top Plateau spanning all 4 lanes
        this.features.push({
          type: 'ramp',
          x: cursorX,
          width: 205,
          height: 82
        });
        cursorX += 360;
      } else if (kind === 'ramp') {
        // Standard Stunt Incline Ramp
        this.features.push({
          type: 'ramp',
          x: cursorX,
          width: 125,
          height: 46
        });
        cursorX += 300;
      } else if (kind === 'washboard') {
        // Washboard Bumps (rapid consecutive twin mini-ramps)
        this.features.push({
          type: 'ramp',
          x: cursorX,
          width: 75,
          height: 26
        });
        this.features.push({
          type: 'ramp',
          x: cursorX + 105,
          width: 75,
          height: 28
        });
        cursorX += 290;
      } else if (kind === 'cooler') {
        // Cooling [<<] Arrow Strip in 2 staggered lanes
        const laneA = (stepIdx + trackIdx) % 4;
        const laneB = (laneA + 2) % 4;
        this.features.push({
          type: 'cooler',
          x: cursorX,
          width: 78,
          lane: laneA
        });
        this.features.push({
          type: 'cooler',
          x: cursorX + 40,
          width: 78,
          lane: laneB
        });
        cursorX += 230;
      } else {
        // Double Mud Chicane patches forcing lane weaves
        const laneA = stepIdx % 4;
        const laneB = (laneA + 1) % 4;
        this.features.push({
          type: 'mud',
          x: cursorX,
          width: 86,
          lane: laneA
        });
        this.features.push({
          type: 'mud',
          x: cursorX + 65,
          width: 86,
          lane: laneB
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
    // Ground Shadow (scales with height z)
    const shadowScale = Math.max(0.45, 1 - z * 0.004);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
    ctx.beginPath();
    ctx.ellipse(screenX, laneY + 7, 23 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dirt Roostertail Spray behind Rear Tire when on track and moving fast
    if (!wipedOut && z <= 3 && this.bike.speed > 95) {
      const roosterPhase = performance.now() * 0.025;
      for (let r = 0; r < 5; r++) {
        const rx = -21 - r * 6 - ((roosterPhase * 8 + r * 3) % 7);
        const ry = -2 - r * 3.2 - Math.sin(roosterPhase + r) * 3;
        ctx.fillStyle = r % 2 === 0 ? '#D97706' : '#FEF08A';
        ctx.fillRect(screenX + rx, laneY + ry, 4 - r * 0.4, 4 - r * 0.4);
      }
    }

    ctx.save();
    ctx.translate(screenX, laneY - z);
    ctx.rotate(wipedOut ? Math.PI * 0.65 : pitch);

    const spokeAngle = this.bike.wheelPhase || 0;
    const drawSpokedWheel = (wx, wy) => {
      // Knobby black motocross tire
      ctx.fillStyle = '#090D16';
      ctx.beginPath();
      ctx.arc(wx, wy, 10, 0, Math.PI * 2);
      ctx.fill();
      // Silver wheel rim
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wx, wy, 7, 0, Math.PI * 2);
      ctx.stroke();
      // Rotating wheel spokes
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.2;
      for (let s = 0; s < 4; s++) {
        const a = spokeAngle + (s * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(wx + Math.cos(a) * 6.5, wy + Math.sin(a) * 6.5);
        ctx.lineTo(wx - Math.cos(a) * 6.5, wy - Math.sin(a) * 6.5);
        ctx.stroke();
      }
      // Hub
      ctx.fillStyle = color;
      ctx.fillRect(wx - 2, wy - 2, 4, 4);
    };

    // Rear & Front Spoked Wheels
    drawSpokedWheel(-15, -4);
    drawSpokedWheel(16, -4);

    // Chrome Exhaust Muffler & Swingarm
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-15, -4);
    ctx.lineTo(-2, -6);
    ctx.moveTo(-4, -9);
    ctx.lineTo(-21, -15);
    ctx.stroke();

    // Engine Block & Crankcase
    ctx.fillStyle = '#475569';
    ctx.fillRect(-5, -13, 10, 8);
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(-3, -11, 6, 4);

    // Front Suspension Forks & Handlebars
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(16, -4);
    ctx.lineTo(8, -22);
    ctx.lineTo(4, -24);
    ctx.stroke();

    // Motocross Frame, Tank & High Fenders
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    // Rear fender & seat
    ctx.moveTo(-22, -16);
    ctx.lineTo(-10, -16);
    ctx.lineTo(2, -15);
    // Fuel tank & shroud
    ctx.lineTo(10, -18);
    // High front mudguard
    ctx.moveTo(9, -16);
    ctx.lineTo(22, -14);
    ctx.stroke();

    // White Number Plate
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(-12, -15, 7, 5);
    ctx.fillRect(9, -21, 5, 5);

    // Motocross Rider (Boots, Pants, Jersey, Arms, Helmet & Visor)
    // Boots & Lower Leg
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(-7, -14, 5, 9);
    // Rider Torso leaning into handlebars
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(-9, -27, 10, 12);
    // Jersey Stripe
    ctx.fillStyle = color;
    ctx.fillRect(-9, -23, 10, 4);
    // Rider Arm reaching to handlebar
    ctx.strokeStyle = PALETTE.WHITE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-2, -25);
    ctx.lineTo(7, -22);
    ctx.stroke();

    // Helmet & Goggles
    this.renderer.drawGlowCircle(-1, -32, 6.5, color, 6);
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(2, -35, 6, 2.5); // Helmet peak visor
    ctx.fillStyle = '#090D16';
    ctx.fillRect(1, -33, 5, 3.5); // Goggles

    ctx.restore();
  }

  render(ctx = this.renderer.ctx) {
    const b = this.bike;
    const camX = b.worldX - b.screenX;

    // Stadium Sky & Grandstands along Top Horizon
    ctx.fillStyle = '#1E3A8A';
    ctx.fillRect(0, 38, this.renderer.width, 118);

    // Multi-Tiered Stadium Bleacher Structure
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 130, this.renderer.width, 132);
    ctx.fillStyle = '#1E293B';
    for (let r = 0; r < 5; r++) {
      ctx.fillRect(0, 138 + r * 22, this.renderer.width, 14);
    }

    // Animated Stadium Grandstand Crowd Spectators
    const crowdWave = Math.floor(performance.now() / 180);
    const crowdPalette = [PALETTE.RED, PALETTE.GOLD, PALETTE.CYAN, PALETTE.WHITE, PALETTE.PINK, PALETTE.GREEN];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 48; col++) {
        const sx = ((col * 20 - camX * 0.25 + row * 7) % 960 + 960) % 960;
        const bounce = (col + row + crowdWave) % 4 === 0 ? -2 : 0;
        const cCol = crowdPalette[(col * 3 + row * 5) % crowdPalette.length];
        ctx.fillStyle = cCol;
        ctx.fillRect(sx, 136 + row * 22 + bounce, 6, 6);
        ctx.fillStyle = '#FDBA74';
        ctx.fillRect(sx + 1, 132 + row * 22 + bounce, 4, 4);
      }
    }

    // Stadium Sponsor Fascia Wall & Retaining Barrier
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(0, 246, this.renderer.width, 18);
    ctx.fillStyle = '#1D4ED8';
    ctx.fillRect(0, 248, this.renderer.width, 14);
    for (let i = 0; i < 8; i++) {
      const bx = ((i * 220 - camX * 0.45) % 1760 + 1760) % 1760 - 200;
      ctx.fillStyle = i % 2 === 0 ? PALETTE.RED : PALETTE.GOLD;
      ctx.fillRect(bx, 249, 96, 12);
    }

    // Green Turf Shoulders (Top & Bottom Infield Verge)
    ctx.fillStyle = '#16A34A';
    ctx.fillRect(0, 264, this.renderer.width, 276);
    ctx.fillStyle = '#15803D';
    for (let gx = 0; gx < 960; gx += 40) {
      const stripX = ((gx - camX * 0.8) % 960 + 960) % 960;
      ctx.fillRect(stripX, 264, 20, 24);
      ctx.fillRect(stripX, 472, 20, 20);
    }

    // Red & White Alternating Track Curbing along Both Track Shoulders
    for (let wx = Math.floor(camX / 24) * 24 - 24; wx < camX + 984; wx += 24) {
      const sx = wx - camX;
      const isRed = Math.floor(wx / 24) % 2 === 0;
      ctx.fillStyle = isRed ? '#EF4444' : '#F8FAFC';
      ctx.fillRect(sx, 286, 24, 10);
      ctx.fillRect(sx, 464, 24, 10);
    }

    // 4-Lane Motocross Track Surface (Warm Tan/Clay Dirt)
    ctx.fillStyle = '#B45309';
    ctx.fillRect(0, 296, this.renderer.width, 168);
    ctx.fillStyle = '#9A3412';
    for (let l = 0; l < 4; l++) {
      if (l % 2 === 1) {
        ctx.fillRect(0, 298 + l * 40, this.renderer.width, 40);
      }
    }

    // Crisp White Lane Divider Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2;
    for (let l = 0; l <= 4; l++) {
      const ly = 298 + l * 40;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(this.renderer.width, ly);
      ctx.stroke();
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

    if (this.trackName) {
      this.renderer.drawText(this.trackName, 480, 62, {
        font: FONTS.HEADER,
        size: 11,
        color: PALETTE.GOLD,
        align: 'center',
        glow: 6
      });
    }

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
