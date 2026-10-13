import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';

interface MansionPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  radius: number;
  isGhost: boolean;
  timeAsGhost: number;
  survivorScore: number;
  flashlightBattery: number; // 0 to 100
  isUltraBeam: boolean;      // true when holding action / space
  flashlightAngle: number;   // aim angle of the flashlight
  revealedTimer: number;     // ghost illuminated or stepping on creaks
  slowedTimer: number;       // ghost slowed down by flashlight beam
  immunityTimer: number;     // invulnerability buffer against instant re-tag
  creakCooldown: number;     // debounce creak sound
  alive: boolean;
  scanDirection: number;     // 1 or -1 for single-button sweeping
  repelCooldown: number;     // prevents sticking
}

interface SoundRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

interface CandleSanctuary {
  x: number;
  y: number;
  radius: number;
  flicker: number;
}

export class GhostFlashlightGame extends BaseGame {
  private mPlayers: Map<PlayerId, MansionPlayer> = new Map();
  private arenaBounds = { x: 50, y: 50, w: 800, h: 500 };
  private creakyFloorboards: { x: number; y: number; w: number; h: number }[] = [];
  private soundRipples: SoundRipple[] = [];
  private sanctuaries: CandleSanctuary[] = [];
  public currentMapName: string = 'Haunted Victorian Manor';
  private animTimer: number = 0;
  private mansionThemeIndex: number = 0;

  private themes = [
    {
      name: 'Haunted Victorian Manor',
      floorColor: '#1a1024',
      boardColor: '#2d1b3d',
      wallColor: '#4a154b',
      ambientColor: 'rgba(10, 5, 20, 0.88)',
      fogColor: 'rgba(168, 85, 247, 0.08)'
    },
    {
      name: 'Abandoned Asylum',
      floorColor: '#0f172a',
      boardColor: '#1e293b',
      wallColor: '#0ea5e9',
      ambientColor: 'rgba(5, 12, 28, 0.90)',
      fogColor: 'rgba(56, 189, 248, 0.08)'
    },
    {
      name: 'Ancient Catacombs',
      floorColor: '#1c1917',
      boardColor: '#292524',
      wallColor: '#d97706',
      ambientColor: 'rgba(12, 10, 9, 0.92)',
      fogColor: 'rgba(245, 158, 11, 0.07)'
    }
  ];

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 45.0;
    this.isFinished = false;
    this.mPlayers.clear();
    this.soundRipples = [];
    this.sanctuaries = [];
    this.animTimer = 0;

    this.mansionThemeIndex = Math.floor(Math.random() * this.themes.length);
    this.currentMapName = this.themes[this.mansionThemeIndex].name;

    const marginX = Math.max(35, width * 0.08);
    const marginY = Math.max(48, height * 0.10);
    this.arenaBounds = {
      x: marginX,
      y: marginY,
      w: width - marginX * 2,
      h: height - marginY * 2
    };

    const cx = this.arenaBounds.x + this.arenaBounds.w / 2;
    const cy = this.arenaBounds.y + this.arenaBounds.h / 2;

    this.generateRandomMap(cx, cy, this.arenaBounds.w, this.arenaBounds.h);

    // Candle Sanctuaries: warm glowing light pools where humans can catch breath
    this.sanctuaries = [
      { x: cx - this.arenaBounds.w * 0.28, y: cy - this.arenaBounds.h * 0.24, radius: 52, flicker: 0 },
      { x: cx + this.arenaBounds.w * 0.28, y: cy + this.arenaBounds.h * 0.24, radius: 52, flicker: 2 },
      { x: cx, y: cy, radius: 60, flicker: 4 }
    ];

    const active = this.getActivePlayers();
    // One player randomly starts as the Cursed Ghost
    const initialGhostId = active[Math.floor(Math.random() * active.length)].id;

    active.forEach((p, idx) => {
      const angle = (Math.PI * 2 * idx) / active.length;
      const dist = Math.min(this.arenaBounds.w, this.arenaBounds.h) * 0.35;
      const startX = cx + Math.cos(angle) * dist;
      const startY = cy + Math.sin(angle) * dist;
      const isGhost = p.id === initialGhostId;

      this.mPlayers.set(p.id, {
        id: p.id,
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        angle: angle + Math.PI,
        speed: 0,
        radius: 19,
        isGhost,
        timeAsGhost: 0,
        survivorScore: 0,
        flashlightBattery: 100,
        isUltraBeam: false,
        flashlightAngle: angle + Math.PI,
        revealedTimer: 3.0, // Visible at round start
        slowedTimer: 0,
        immunityTimer: isGhost ? 2.0 : 0, // Ghost starts with grace window so survivors can scatter
        creakCooldown: 0,
        alive: true,
        scanDirection: 1,
        repelCooldown: 0
      });
    });
  }

  private generateRandomMap(cx: number, cy: number, aw: number, ah: number): void {
    this.creakyFloorboards = [];
    const count = 6;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + 0.35;
      const dist = (0.24 + (i % 3) * 0.08) * Math.min(aw, ah);
      this.creakyFloorboards.push({
        x: cx + Math.cos(ang) * dist - 48,
        y: cy + Math.sin(ang) * dist - 32,
        w: 96,
        h: 64
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.animTimer += dt;
    this.updateBots(dt, width, height);

    // Candle flicker animations
    for (const s of this.sanctuaries) {
      s.flicker += dt * 5;
    }

    // Update sound ripples
    for (let i = this.soundRipples.length - 1; i >= 0; i--) {
      const rip = this.soundRipples[i];
      rip.radius += 120 * dt;
      rip.alpha -= 1.8 * dt;
      if (rip.alpha <= 0 || rip.radius >= rip.maxRadius) {
        this.soundRipples.splice(i, 1);
      }
    }

    // 1. Process player controls, physics, and state updates
    for (const mp of this.mPlayers.values()) {
      if (mp.isGhost) {
        mp.timeAsGhost += dt;
      } else {
        mp.survivorScore += Math.floor(dt * 14);
      }

      if (mp.revealedTimer > 0) mp.revealedTimer -= dt;
      if (mp.slowedTimer > 0) mp.slowedTimer -= dt;
      if (mp.immunityTimer > 0) mp.immunityTimer -= dt;
      if (mp.creakCooldown > 0) mp.creakCooldown -= dt;
      if (mp.repelCooldown > 0) mp.repelCooldown -= dt;

      const isPressed = this.input.isPressed(mp.id);
      const steer = this.input.getSteer(mp.id);
      const throttle = this.input.getThrottle(mp.id);
      const action = this.input.isActionPressed(mp.id) || this.input.justAction(mp.id);

      // Flashlight Ultra-Beam (Space / Action)
      if (!mp.isGhost) {
        const wantsBoost = action || (isPressed && steer === 0 && throttle === 0 && mp.flashlightBattery > 15);
        if (wantsBoost && mp.flashlightBattery > 5) {
          mp.isUltraBeam = true;
          mp.flashlightBattery = Math.max(0, mp.flashlightBattery - 35 * dt);
        } else {
          mp.isUltraBeam = false;
          mp.flashlightBattery = Math.min(100, mp.flashlightBattery + 28 * dt);
        }
      } else {
        mp.isUltraBeam = false;
      }

      // Check if inside Candle Sanctuary (Ghost is slowed inside sanctuary; Humans recover flashlight faster)
      let inSanctuary = false;
      for (const s of this.sanctuaries) {
        if (Math.hypot(mp.x - s.x, mp.y - s.y) < s.radius) {
          inSanctuary = true;
          break;
        }
      }

      // Speed calibration
      let maxSpeed = 195;
      if (mp.isGhost) {
        if (mp.slowedTimer > 0) {
          maxSpeed = mp.isUltraBeam ? 70 : 115;
        } else if (inSanctuary) {
          maxSpeed = 140; // Holy light slows the ghost
        } else {
          maxSpeed = 245; // Fast predatory stalker
        }
      } else {
        if (inSanctuary) {
          mp.flashlightBattery = Math.min(100, mp.flashlightBattery + 18 * dt);
        }
      }

      // Directional inputs vs Single Button Arcade Mode
      const pInfo = this.getPlayer(mp.id);
      const isBot = pInfo ? pInfo.type.startsWith('bot_') : false;

      const inputMag = Math.hypot(steer, -throttle);
      if (inputMag > 0.15) {
        // Multi-directional WASD / Joystick
        const inputAngle = Math.atan2(-throttle, steer);
        mp.angle = inputAngle;
        if (!isBot) {
          mp.flashlightAngle = inputAngle;
        }

        const accel = 680;
        mp.vx += (steer * maxSpeed - mp.vx) * Math.min(1, accel * dt * 0.05);
        mp.vy += (-throttle * maxSpeed - mp.vy) * Math.min(1, accel * dt * 0.05);
      } else if (isPressed) {
        // Single Button Arcade: HOLD pushes forward in current aim angle!
        const accel = 520;
        mp.vx += (Math.cos(mp.flashlightAngle) * maxSpeed - mp.vx) * Math.min(1, accel * dt * 0.05);
        mp.vy += (Math.sin(mp.flashlightAngle) * maxSpeed - mp.vy) * Math.min(1, accel * dt * 0.05);
        mp.angle = mp.flashlightAngle;
      } else {
        // Friction damping when not pressing
        mp.vx *= Math.pow(0.80, dt * 60);
        mp.vy *= Math.pow(0.80, dt * 60);

        // In 1-button mode, when released, smoothly scan/sweep flashlight to allow aiming!
        if (!isBot && inputMag <= 0.15) {
          mp.flashlightAngle += mp.scanDirection * dt * 2.8;
          mp.angle = mp.flashlightAngle;
        }
      }

      mp.speed = Math.hypot(mp.vx, mp.vy);
      mp.x += mp.vx * dt;
      mp.y += mp.vy * dt;

      // Arena boundaries with elastic repel to NEVER get stuck on walls
      const minX = this.arenaBounds.x + mp.radius;
      const maxX = this.arenaBounds.x + this.arenaBounds.w - mp.radius;
      const minY = this.arenaBounds.y + mp.radius;
      const maxY = this.arenaBounds.y + this.arenaBounds.h - mp.radius;

      if (mp.x < minX) {
        mp.x = minX;
        mp.vx = Math.abs(mp.vx) * 0.5 + 40;
      } else if (mp.x > maxX) {
        mp.x = maxX;
        mp.vx = -Math.abs(mp.vx) * 0.5 - 40;
      }

      if (mp.y < minY) {
        mp.y = minY;
        mp.vy = Math.abs(mp.vy) * 0.5 + 40;
      } else if (mp.y > maxY) {
        mp.y = maxY;
        mp.vy = -Math.abs(mp.vy) * 0.5 - 40;
      }

      // Step on Creaky Floorboards
      if (mp.speed > 25) {
        for (const cf of this.creakyFloorboards) {
          if (mp.x >= cf.x && mp.x <= cf.x + cf.w && mp.y >= cf.y && mp.y <= cf.y + cf.h) {
            if (mp.creakCooldown <= 0) {
              mp.creakCooldown = 0.40;
              mp.revealedTimer = 1.2;
              this.audio.playTap();
              this.particles.showFloatingText('CREAK! 🔊', mp.x, mp.y - 18, '#F59E0B', 16);

              this.soundRipples.push({
                x: mp.x,
                y: mp.y,
                radius: 12,
                maxRadius: 85,
                alpha: 0.9,
                color: mp.isGhost ? '#C084FC' : '#F59E0B'
              });
            }
          }
        }
      }
    }

    // 2. Volumetric Flashlight Beam & Ghost Revealing Check
    for (const human of this.mPlayers.values()) {
      if (human.isGhost) continue;

      const beamRange = human.isUltraBeam ? 290 : 205;
      const beamHalfAngle = human.isUltraBeam ? 0.65 : 0.46;

      for (const ghost of this.mPlayers.values()) {
        if (!ghost.isGhost) continue;

        const dx = ghost.x - human.x;
        const dy = ghost.y - human.y;
        const dist = Math.hypot(dx, dy);

        if (dist < beamRange && dist > 1) {
          const angleToGhost = Math.atan2(dy, dx);
          let diff = angleToGhost - human.flashlightAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;

          if (Math.abs(diff) < beamHalfAngle) {
            // Ghost caught in flashlight beam!
            ghost.revealedTimer = 0.40;
            ghost.slowedTimer = 0.40;

            if (human.isUltraBeam) {
              // Ultra-Beam pushes ghost back with luminous shock
              ghost.vx += Math.cos(human.flashlightAngle) * 160 * dt;
              ghost.vy += Math.sin(human.flashlightAngle) * 160 * dt;
              if (Math.random() < 0.3) {
                this.particles.spawnSparks(ghost.x, ghost.y, '#FACC15', 3);
              }
            }
          }
        }
      }
    }

    // 3. Elastic Inter-Player Collision & Curse Tag Transfer
    // ZERO-STICKING GUARANTEE: Strong repulsive separation prevents players and bots from ever getting stuck!
    const playersArr = Array.from(this.mPlayers.values());
    for (let i = 0; i < playersArr.length; i++) {
      for (let j = i + 1; j < playersArr.length; j++) {
        const p1 = playersArr[i];
        const p2 = playersArr[j];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = p1.radius + p2.radius + 8; // Extra safety buffer

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;

          const p1CanTag = p1.isGhost && p1.immunityTimer <= 0 && !p2.isGhost && p2.immunityTimer <= 0;
          const p2CanTag = p2.isGhost && p2.immunityTimer <= 0 && !p1.isGhost && p1.immunityTimer <= 0;

          if (p1CanTag || p2CanTag) {
            const oldGhost = p1CanTag ? p1 : p2;
            const newGhost = p1CanTag ? p2 : p1;

            // Transfer the Curse!
            oldGhost.isGhost = false;
            oldGhost.immunityTimer = 2.2; // 2.2s safe escape
            oldGhost.revealedTimer = 1.0;

            newGhost.isGhost = true;
            newGhost.immunityTimer = 2.4; // 2.4s charge-up before new ghost can tag
            newGhost.revealedTimer = 2.5;

            // Explosive Separation Blast
            const pushDist = (minDist - dist) + 70;
            const blastSpeed = 460;
            const sepX = (newGhost.x - oldGhost.x) / (dist || 1);
            const sepY = (newGhost.y - oldGhost.y) / (dist || 1);

            oldGhost.x -= sepX * (pushDist * 0.5);
            oldGhost.y -= sepY * (pushDist * 0.5);
            newGhost.x += sepX * (pushDist * 0.5);
            newGhost.y += sepY * (pushDist * 0.5);

            oldGhost.vx = -sepX * blastSpeed;
            oldGhost.vy = -sepY * blastSpeed;
            newGhost.vx = sepX * blastSpeed;
            newGhost.vy = sepY * blastSpeed;

            this.audio.playGhostTag();
            this.audio.playHitStopThud();
            this.particles.shake(7);
            this.particles.spawnExplosion(newGhost.x, newGhost.y, '#C084FC', 50);
            this.particles.showFloatingText('👻 CURSED!', newGhost.x, newGhost.y - 28, '#C084FC', 26);
            this.particles.showFloatingText('🏃 ESCAPED!', oldGhost.x, oldGhost.y - 28, '#4ADE80', 22);
          } else {
            // UNCONDITIONAL ELASTIC REPULSION: Guarantees players NEVER clip or stick together!
            const overlap = (minDist - dist) + 12;
            p1.x -= nx * (overlap * 0.5);
            p1.y -= ny * (overlap * 0.5);
            p2.x += nx * (overlap * 0.5);
            p2.y += ny * (overlap * 0.5);

            // Firm velocity bounce apart
            const bounceSpeed = 220;
            p1.vx = -nx * bounceSpeed;
            p1.vy = -ny * bounceSpeed;
            p2.vx = nx * bounceSpeed;
            p2.vy = ny * bounceSpeed;
            this.audio.playBounce();
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const me = this.mPlayers.get(botId);
    if (!me) return;

    const b = this.arenaBounds;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;

    if (me.isGhost) {
      // --- GHOST BOT ---
      // If newly cursed with immunity active, back away slightly to charge
      if (me.immunityTimer > 0) {
        let awayX = me.x - cx;
        let awayY = me.y - cy;
        const mag = Math.hypot(awayX, awayY) || 1;
        this.input.setBotInput(botId, true, awayX / mag, -awayY / mag, false);
        return;
      }

      // Find closest human survivor
      let target: MansionPlayer | null = null;
      let minD = Infinity;

      for (const other of this.mPlayers.values()) {
        if (!other.isGhost) {
          const d = Math.hypot(other.x - me.x, other.y - me.y);
          if (d < minD) {
            minD = d;
            target = other;
          }
        }
      }

      if (target) {
        let chaseX = target.x - me.x;
        let chaseY = target.y - me.y;

        // If caught in flashlight beam, flank sideways to dodge out of the beam!
        if (me.slowedTimer > 0) {
          const perpX = -chaseY;
          const perpY = chaseX;
          chaseX = chaseX * 0.2 + perpX * 0.8;
          chaseY = chaseY * 0.2 + perpY * 0.8;
        }

        // Add humanized imperfection based on difficulty
        if (difficulty === 'bot_easy') {
          chaseX += (Math.random() - 0.5) * 120;
          chaseY += (Math.random() - 0.5) * 120;
        } else if (difficulty === 'bot_normal') {
          chaseX += (Math.random() - 0.5) * 45;
          chaseY += (Math.random() - 0.5) * 45;
        }

        // Arena wall avoidance
        const margin = 60;
        if (me.x < b.x + margin) chaseX += 140;
        if (me.x > b.x + b.w - margin) chaseX -= 140;
        if (me.y < b.y + margin) chaseY += 140;
        if (me.y > b.y + b.h - margin) chaseY -= 140;

        const mag = Math.hypot(chaseX, chaseY) || 1;
        const steer = chaseX / mag;
        const throttle = -chaseY / mag;
        this.input.setBotInput(botId, true, steer, throttle, false);
      } else {
        this.input.setBotInput(botId, true, 0, 0, false);
      }
    } else {
      // --- HUMAN BOT ---
      const ghost = Array.from(this.mPlayers.values()).find((p) => p.isGhost);
      if (ghost) {
        const distToGhost = Math.hypot(ghost.x - me.x, ghost.y - me.y);

        // Flee from ghost towards center or nearest candle sanctuary
        let fleeX = me.x - ghost.x;
        let fleeY = me.y - ghost.y;

        // Wall & corner avoidance
        const margin = 70;
        if (me.x < b.x + margin) fleeX += 160;
        if (me.x > b.x + b.w - margin) fleeX -= 160;
        if (me.y < b.y + margin) fleeY += 160;
        if (me.y > b.y + b.h - margin) fleeY -= 160;

        const mag = Math.hypot(fleeX, fleeY) || 1;
        const steer = fleeX / mag;
        const throttle = -fleeY / mag;

        // Tactical flashlight defense: Aim directly at the approaching ghost
        me.flashlightAngle = Math.atan2(ghost.y - me.y, ghost.x - me.x);

        // Fire Ultra-Beam if ghost gets too close and battery is sufficient
        let useUltra = false;
        if (distToGhost < (difficulty === 'bot_hard' ? 170 : 130) && me.flashlightBattery > 30) {
          useUltra = true;
        }

        this.input.setBotInput(botId, true, steer, throttle, useUltra);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const curTheme = this.themes[this.mansionThemeIndex];
    const b = this.arenaBounds;

    // Dark Hardwood Floor Background
    ctx.fillStyle = curTheme.floorColor;
    ctx.fillRect(0, 0, width, height);

    // Hardwood Floor Planks
    ctx.strokeStyle = curTheme.boardColor;
    ctx.lineWidth = 1.5;
    const plankH = 28;
    for (let y = b.y; y < b.y + b.h; y += plankH) {
      ctx.beginPath();
      ctx.moveTo(b.x, y);
      ctx.lineTo(b.x + b.w, y);
      ctx.stroke();
    }

    // Creaky Floorboards with glowing warning plank grain
    for (const cf of this.creakyFloorboards) {
      ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(cf.x, cf.y, cf.w, cf.h);
      ctx.fillRect(cf.x, cf.y, cf.w, cf.h);

      // Warning Footprint Icon
      ctx.fillStyle = 'rgba(245, 158, 11, 0.6)';
      ctx.font = '900 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👣 CREAK', cf.x + cf.w / 2, cf.y + cf.h / 2);
    }

    // Candle Sanctuaries (Warm golden holy light pools)
    for (const s of this.sanctuaries) {
      const pulseR = s.radius + Math.sin(s.flicker) * 3;
      const sGrad = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, pulseR);
      sGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
      sGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.20)');
      sGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');

      ctx.fillStyle = sGrad;
      ctx.beginPath();
      ctx.arc(s.x, s.y, pulseR, 0, Math.PI * 2);
      ctx.fill();

      // Center Candle Chandelier
      ctx.fillStyle = '#FEF08A';
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Sound Ripples from Creaks
    for (const rip of this.soundRipples) {
      ctx.strokeStyle = rip.color;
      ctx.globalAlpha = rip.alpha;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    // Volumetric Flashlight Beams from Humans
    for (const p of this.mPlayers.values()) {
      if (p.isGhost) continue;

      const beamRange = p.isUltraBeam ? 290 : 205;
      const beamHalf = p.isUltraBeam ? 0.65 : 0.46;

      ctx.save();
      const grad = ctx.createRadialGradient(p.x, p.y, 6, p.x, p.y, beamRange);
      grad.addColorStop(0, p.isUltraBeam ? 'rgba(254, 240, 138, 0.95)' : 'rgba(254, 240, 138, 0.70)');
      grad.addColorStop(0.6, p.isUltraBeam ? 'rgba(251, 191, 36, 0.45)' : 'rgba(251, 191, 36, 0.25)');
      grad.addColorStop(1, 'rgba(251, 191, 36, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.arc(p.x, p.y, beamRange, p.flashlightAngle - beamHalf, p.flashlightAngle + beamHalf);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Ambient Darkness Overlay (Leaves flashlights and candles brightly visible)
    ctx.save();
    ctx.fillStyle = curTheme.ambientColor;
    ctx.fillRect(b.x, b.y, b.w, b.h);

    // Punch out holes for Candle Sanctuaries and Flashlight Beams
    ctx.globalCompositeOperation = 'destination-out';
    for (const s of this.sanctuaries) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of this.mPlayers.values()) {
      // Glow circle around human
      if (!p.isGhost) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 38, 0, Math.PI * 2);
        ctx.fill();

        // Flashlight punch-out cone
        const beamRange = p.isUltraBeam ? 285 : 200;
        const beamHalf = p.isUltraBeam ? 0.62 : 0.44;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, beamRange, p.flashlightAngle - beamHalf, p.flashlightAngle + beamHalf);
        ctx.closePath();
        ctx.fill();
      } else {
        // Ghost has a small eerie purple luminescence
        ctx.beginPath();
        ctx.arc(p.x, p.y, 28, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Render Players & Ghost
    for (const mp of this.mPlayers.values()) {
      const cfg = this.getPlayer(mp.id);
      const isVisible = !mp.isGhost || mp.revealedTimer > 0 || mp.immunityTimer > 0;

      ctx.save();
      ctx.translate(mp.x, mp.y);

      if (mp.isGhost) {
        // --- 2.5D CURSED PHANTOM GHOST ---
        ctx.save();
        ctx.globalAlpha = isVisible ? 1.0 : 0.22; // Partially translucent stealth in shadow

        // Spectral Purple Aura
        ctx.shadowColor = '#C084FC';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#C084FC';
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();

        // Floating Ghost Tail Wisps
        const tailBob = Math.sin(this.animTimer * 8 + mp.id) * 4;
        ctx.beginPath();
        ctx.moveTo(-14, 8);
        ctx.quadraticCurveTo(-6, 24 + tailBob, 0, 14);
        ctx.quadraticCurveTo(6, 24 - tailBob, 14, 8);
        ctx.closePath();
        ctx.fill();

        // Glowing Ghost Eyes
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(-5, -3, 3.5, 0, Math.PI * 2);
        ctx.arc(5, -3, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#18181B';
        ctx.beginPath();
        ctx.arc(-5, -3, 1.8, 0, Math.PI * 2);
        ctx.arc(5, -3, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Big Floating Role Badge
        ctx.fillStyle = '#C084FC';
        ctx.font = '900 11px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👻 CURSED GHOST', 0, -28);

        ctx.restore();
      } else {
        // --- 2.5D SURVIVOR WITH METAL FLASHLIGHT ---
        // Player Base Mascot Disc
        ctx.fillStyle = cfg?.color || '#3B82F6';
        ctx.shadowColor = cfg?.color || '#3B82F6';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();

        // Outer Protective Armor Ring
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Flashlight Handle & Barrel pointing in flashlightAngle
        ctx.save();
        ctx.rotate(mp.flashlightAngle);
        ctx.fillStyle = '#475569';
        ctx.fillRect(8, -4, 14, 8);
        ctx.fillStyle = '#FEF08A';
        ctx.shadowColor = '#FACC15';
        ctx.shadowBlur = 8;
        ctx.fillRect(20, -5, 4, 10);
        ctx.restore();

        // Battery Gauge Ring around avatar
        const batPct = mp.flashlightBattery / 100;
        ctx.strokeStyle = batPct > 0.3 ? '#4ADE80' : '#EF4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * batPct);
        ctx.stroke();

        // Player Name & Score
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 10px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${cfg?.name || 'P'}: ${mp.survivorScore}`, 0, -26);
      }

      ctx.restore();
    }

    // Top Role Guidance HUD Badge
    const myId = 0 as PlayerId;
    const me = this.mPlayers.get(myId);
    if (me) {
      ctx.save();
      const bannerBg = me.isGhost ? 'rgba(192, 132, 252, 0.90)' : 'rgba(30, 41, 59, 0.90)';
      ctx.fillStyle = bannerBg;
      ctx.strokeStyle = me.isGhost ? '#C084FC' : '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(width * 0.5 - 200, 52, 400, 26, 13);
      else ctx.fillRect(width * 0.5 - 200, 52, 400, 26);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = me.isGhost ? '#18181B' : '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (me.isGhost) {
        ctx.fillText('👻 YOU ARE THE GHOST! CHASE & TAG A SURVIVOR TO PASS THE CURSE!', width * 0.5, 65);
      } else {
        ctx.fillText('🔦 SHINE FLASHLIGHT AT GHOST TO STUN THEM! SURVIVE TO SCORE!', width * 0.5, 65);
      }
      ctx.restore();
    }

    // Theme Pill at Bottom-Left (Rule compliant: x: 20, y: height - 44)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, height - 44, 350, 32, 16);
    else ctx.fillRect(20, height - 44, 350, 32);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = curTheme.wallColor;
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `🏰 [${this.mansionThemeIndex + 1}/3] ${curTheme.name} | Move / Hold Forward`,
      34,
      height - 24
    );
    ctx.restore();

    ctx.restore();
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    for (const p of this.mPlayers.values()) {
      // Score is survivor time bonus minus ghost time penalty
      const net = Math.max(0, p.survivorScore - Math.floor(p.timeAsGhost * 12));
      scores.set(p.id, net);
    }
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.mPlayers.values())
      .map((p) => ({
        playerId: p.id,
        score: Math.max(0, p.survivorScore - Math.floor(p.timeAsGhost * 12)),
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} survived the haunted mansion in the light!` : 'The ghost claimed all souls!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
