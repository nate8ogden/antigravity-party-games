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
}

interface SoundRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

export class GhostFlashlightGame extends BaseGame {
  private mPlayers: Map<PlayerId, MansionPlayer> = new Map();
  private arenaBounds = { x: 50, y: 50, w: 800, h: 500 };
  private creakyFloorboards: { x: number; y: number; w: number; h: number }[] = [];
  private soundRipples: SoundRipple[] = [];
  public currentMapName: string = 'Haunted Crypt';

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 45;
    this.isFinished = false;
    this.mPlayers.clear();
    this.soundRipples = [];

    const marginX = Math.max(35, width * 0.08);
    const marginY = Math.max(45, height * 0.09);
    this.arenaBounds = {
      x: marginX,
      y: marginY,
      w: width - marginX * 2,
      h: height - marginY * 2
    };

    const cx = this.arenaBounds.x + this.arenaBounds.w / 2;
    const cy = this.arenaBounds.y + this.arenaBounds.h / 2;

    this.generateRandomMap(cx, cy, this.arenaBounds.w, this.arenaBounds.h);

    const active = this.getActivePlayers();
    // One player randomly starts as the Ghost
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
        radius: 18,
        isGhost,
        timeAsGhost: 0,
        survivorScore: 0,
        flashlightBattery: 100,
        isUltraBeam: false,
        flashlightAngle: angle + Math.PI,
        revealedTimer: 2.5, // visible at round start
        slowedTimer: 0,
        immunityTimer: isGhost ? 1.5 : 0, // Ghost starts with a brief grace window so players can scatter
        creakCooldown: 0,
        alive: true
      });
    });
  }

  private generateRandomMap(cx: number, cy: number, aw: number, ah: number): void {
    const archetypes = ['Haunted Crypt', 'Attic Crossroad', 'Narrow Parlor', 'Scattered Creaks'];
    this.currentMapName = archetypes[Math.floor(Math.random() * archetypes.length)];
    this.creakyFloorboards = [];

    switch (this.currentMapName) {
      case 'Haunted Crypt':
        this.creakyFloorboards = [
          { x: cx - 140, y: cy - 80, w: 90, h: 65 },
          { x: cx + 60, y: cy + 30, w: 90, h: 65 },
          { x: cx - 70, y: cy + 90, w: 100, h: 55 },
          { x: cx + 80, y: cy - 90, w: 85, h: 60 },
          { x: cx - 130, y: cy + 35, w: 80, h: 60 }
        ];
        break;

      case 'Attic Crossroad':
        this.creakyFloorboards = [
          { x: cx - 40, y: cy - ah * 0.35, w: 80, h: ah * 0.22 },
          { x: cx - 40, y: cy + ah * 0.13, w: 80, h: ah * 0.22 },
          { x: cx - aw * 0.35, y: cy - 30, w: aw * 0.22, h: 60 },
          { x: cx + aw * 0.13, y: cy - 30, w: aw * 0.22, h: 60 }
        ];
        break;

      case 'Narrow Parlor':
        this.creakyFloorboards = [
          { x: cx - aw * 0.32, y: cy - ah * 0.30, w: 110, h: 60 },
          { x: cx + aw * 0.14, y: cy - ah * 0.30, w: 110, h: 60 },
          { x: cx - aw * 0.32, y: cy + ah * 0.20, w: 110, h: 60 },
          { x: cx + aw * 0.14, y: cy + ah * 0.20, w: 110, h: 60 },
          { x: cx - 50, y: cy - 30, w: 100, h: 60 }
        ];
        break;

      case 'Scattered Creaks':
      default:
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + 0.4;
          const dist = (0.22 + (i % 3) * 0.08) * Math.min(aw, ah);
          this.creakyFloorboards.push({
            x: cx + Math.cos(ang) * dist - 45,
            y: cy + Math.sin(ang) * dist - 30,
            w: 80 + (i % 2) * 20,
            h: 55 + (i % 3) * 10
          });
        }
        break;
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Update sound ripples
    for (let i = this.soundRipples.length - 1; i >= 0; i--) {
      const rip = this.soundRipples[i];
      rip.radius += 110 * dt;
      rip.alpha -= 1.6 * dt;
      if (rip.alpha <= 0 || rip.radius >= rip.maxRadius) {
        this.soundRipples.splice(i, 1);
      }
    }

    // 1. Process player controls, physics, and state updates
    for (const mp of this.mPlayers.values()) {
      if (mp.isGhost) {
        mp.timeAsGhost += dt;
      } else {
        mp.survivorScore += Math.floor(dt * 12);
      }

      if (mp.revealedTimer > 0) mp.revealedTimer -= dt;
      if (mp.slowedTimer > 0) mp.slowedTimer -= dt;
      if (mp.immunityTimer > 0) mp.immunityTimer -= dt;
      if (mp.creakCooldown > 0) mp.creakCooldown -= dt;

      const isPressed = this.input.isPressed(mp.id);
      const steer = this.input.getSteer(mp.id);
      const throttle = this.input.getThrottle(mp.id);
      const action = this.input.isActionPressed(mp.id);

      // Flashlight Ultra-Beam (Action / Space / Tap Boost)
      if (!mp.isGhost) {
        const wantsBoost = action || (isPressed && steer === 0 && throttle === 0);
        if (wantsBoost && mp.flashlightBattery > 5) {
          mp.isUltraBeam = true;
          mp.flashlightBattery = Math.max(0, mp.flashlightBattery - 32 * dt);
        } else {
          mp.isUltraBeam = false;
          mp.flashlightBattery = Math.min(100, mp.flashlightBattery + 26 * dt);
        }
      } else {
        mp.isUltraBeam = false;
      }

      // Movement Speed Calibration
      let maxSpeed = 190;
      if (mp.isGhost) {
        if (mp.slowedTimer > 0) {
          // Slowed while caught in flashlight cone!
          maxSpeed = mp.isUltraBeam ? 65 : 120;
        } else {
          // Swift predator speed in darkness
          maxSpeed = 250;
        }
      }

      // Directional steering input
      let moveDirX = steer;
      let moveDirY = -throttle; // Up is negative Y

      if (Math.hypot(moveDirX, moveDirY) > 0.1) {
        const inputAngle = Math.atan2(moveDirY, moveDirX);
        mp.angle = inputAngle;
        mp.flashlightAngle = inputAngle;

        // Accelerate smoothly
        const accel = 650;
        mp.vx += (moveDirX * maxSpeed - mp.vx) * Math.min(1, accel * dt * 0.05);
        mp.vy += (moveDirY * maxSpeed - mp.vy) * Math.min(1, accel * dt * 0.05);
      } else if (isPressed) {
        // Single button forward push
        mp.vx += (Math.cos(mp.angle) * maxSpeed - mp.vx) * Math.min(1, 400 * dt * 0.05);
        mp.vy += (Math.sin(mp.angle) * maxSpeed - mp.vy) * Math.min(1, 400 * dt * 0.05);
      } else {
        // Friction damping
        mp.vx *= Math.pow(0.82, dt * 60);
        mp.vy *= Math.pow(0.82, dt * 60);
      }

      mp.speed = Math.hypot(mp.vx, mp.vy);

      // Position update
      mp.x += mp.vx * dt;
      mp.y += mp.vy * dt;

      // Arena wall boundaries with smooth bounce & sliding
      const minX = this.arenaBounds.x + mp.radius;
      const maxX = this.arenaBounds.x + this.arenaBounds.w - mp.radius;
      const minY = this.arenaBounds.y + mp.radius;
      const maxY = this.arenaBounds.y + this.arenaBounds.h - mp.radius;

      if (mp.x < minX) {
        mp.x = minX;
        mp.vx = Math.abs(mp.vx) * 0.3;
      } else if (mp.x > maxX) {
        mp.x = maxX;
        mp.vx = -Math.abs(mp.vx) * 0.3;
      }

      if (mp.y < minY) {
        mp.y = minY;
        mp.vy = Math.abs(mp.vy) * 0.3;
      } else if (mp.y > maxY) {
        mp.y = maxY;
        mp.vy = -Math.abs(mp.vy) * 0.3;
      }

      // Step on Creaky Floorboards
      if (mp.speed > 25) {
        for (const cf of this.creakyFloorboards) {
          if (mp.x >= cf.x && mp.x <= cf.x + cf.w && mp.y >= cf.y && mp.y <= cf.y + cf.h) {
            if (mp.creakCooldown <= 0) {
              mp.creakCooldown = 0.35;
              mp.revealedTimer = 1.0;
              this.audio.playTap();
              this.particles.showFloatingText('CREAK!', mp.x, mp.y - 18, '#F59E0B', 15);

              // Spawn expanding sound ripple
              this.soundRipples.push({
                x: mp.x,
                y: mp.y,
                radius: 12,
                maxRadius: 75,
                alpha: 0.9,
                color: mp.isGhost ? '#C084FC' : '#F59E0B'
              });
            }
          }
        }
      }
    }

    // 2. Volumetric Flashlight Beam & Ghost Revealing / Slowing Check
    for (const human of this.mPlayers.values()) {
      if (human.isGhost) continue;

      const beamRange = human.isUltraBeam ? 275 : 195;
      const beamHalfAngle = human.isUltraBeam ? 0.62 : 0.44; // radians

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
            // Ghost is caught in the beam!
            ghost.revealedTimer = 0.35;
            ghost.slowedTimer = 0.35;

            // Ultra-Beam pushes ghost backward gently
            if (human.isUltraBeam) {
              ghost.vx += Math.cos(human.flashlightAngle) * 140 * dt;
              ghost.vy += Math.sin(human.flashlightAngle) * 140 * dt;
              if (Math.random() < 0.25) {
                this.particles.spawnSparks(ghost.x, ghost.y, '#FACC15', 2);
              }
            }
          }
        }
      }
    }

    // 3. Elastic Inter-Player Collision & Curse Tag Transfer
    const playersArr = Array.from(this.mPlayers.values());
    for (let i = 0; i < playersArr.length; i++) {
      for (let j = i + 1; j < playersArr.length; j++) {
        const p1 = playersArr[i];
        const p2 = playersArr[j];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = p1.radius + p2.radius;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Check if Tag / Curse Transfer triggers
          const p1CanTag = p1.isGhost && p1.immunityTimer <= 0 && !p2.isGhost && p2.immunityTimer <= 0;
          const p2CanTag = p2.isGhost && p2.immunityTimer <= 0 && !p1.isGhost && p1.immunityTimer <= 0;

          if (p1CanTag || p2CanTag) {
            const oldGhost = p1CanTag ? p1 : p2;
            const newGhost = p1CanTag ? p2 : p1;

            // Transfer the Curse!
            oldGhost.isGhost = false;
            oldGhost.immunityTimer = 2.0; // 2 seconds to safely escape!
            oldGhost.revealedTimer = 1.0;

            newGhost.isGhost = true;
            newGhost.immunityTimer = 2.5; // 2.5 seconds charge-up before new ghost can tag back!
            newGhost.revealedTimer = 2.5;

            // Explosive Separation Blast: Push apart by extra clearance distance
            const pushDist = (minDist - dist) + 55;
            const blastSpeed = 420;
            const sepX = (newGhost.x - oldGhost.x) / (dist || 1);
            const sepY = (newGhost.y - oldGhost.y) / (dist || 1);

            oldGhost.x -= sepX * (pushDist * 0.5);
            oldGhost.y -= sepY * (pushDist * 0.5);
            newGhost.x += sepX * (pushDist * 0.5);
            newGhost.y += sepY * (pushDist * 0.5);

            // High-energy knockback velocity impulse away from each other
            oldGhost.vx = -sepX * blastSpeed;
            oldGhost.vy = -sepY * blastSpeed;
            newGhost.vx = sepX * blastSpeed;
            newGhost.vy = sepY * blastSpeed;

            this.audio.playGhostTag();
            this.audio.playHitStopThud();
            this.particles.addTrauma(0.5);
            this.particles.spawnExplosion(newGhost.x, newGhost.y, '#C084FC', 45);
            this.particles.showFloatingText('CURSED! 👻', newGhost.x, newGhost.y - 28, '#C084FC', 26);
            this.particles.showFloatingText('ESCAPED! 🏃', oldGhost.x, oldGhost.y - 28, '#4ADE80', 20);
          } else {
            // Normal elastic bumper bounce between players so they NEVER stick together!
            const pushDist = (minDist - dist) + 4;
            p1.x -= nx * (pushDist * 0.5);
            p1.y -= ny * (pushDist * 0.5);
            p2.x += nx * (pushDist * 0.5);
            p2.y += ny * (pushDist * 0.5);

            // Bumper velocity exchange
            const relVelX = p1.vx - p2.vx;
            const relVelY = p1.vy - p2.vy;
            const velAlongNormal = relVelX * nx + relVelY * ny;
            if (velAlongNormal > 0) {
              const impulse = 1.35 * velAlongNormal;
              p1.vx -= impulse * nx;
              p1.vy -= impulse * ny;
              p2.vx += impulse * nx;
              p2.vy += impulse * ny;
            }
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
      // If newly cursed and in immunity timer, maneuver or back up while charging
      if (me.immunityTimer > 0) {
        let awayX = me.x - cx;
        let awayY = me.y - cy;
        const mag = Math.hypot(awayX, awayY) || 1;
        this.input.setBotInput(botId, true, awayX / mag, -awayY / mag, false);
        return;
      }

      // Find closest human target
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
          chaseX = chaseX * 0.3 + perpX * 0.7;
          chaseY = chaseY * 0.3 + perpY * 0.7;
        }

        // Wall avoidance so bot glides around walls smoothly
        const margin = 55;
        if (me.x < b.x + margin) chaseX += 130;
        if (me.x > b.x + b.w - margin) chaseX -= 130;
        if (me.y < b.y + margin) chaseY += 130;
        if (me.y > b.y + b.h - margin) chaseY -= 130;

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

        // Flee away from ghost
        let fleeX = me.x - ghost.x;
        let fleeY = me.y - ghost.y;

        // Wall & corner avoidance: Push toward arena center if close to edges
        const margin = 75;
        if (me.x < b.x + margin) fleeX += 150;
        if (me.x > b.x + b.w - margin) fleeX -= 150;
        if (me.y < b.y + margin) fleeY += 150;
        if (me.y > b.y + b.h - margin) fleeY -= 150;

        const mag = Math.hypot(fleeX, fleeY) || 1;
        const steer = fleeX / mag;
        const throttle = -fleeY / mag;

        // Clever defense: Aim flashlight DIRECTLY at the ghost to slow them down!
        me.flashlightAngle = Math.atan2(ghost.y - me.y, ghost.x - me.x);

        // Fire Ultra-Beam if ghost gets too close and battery is good
        let useUltra = false;
        if (distToGhost < 145 && me.flashlightBattery > 25) {
          useUltra = true;
        }

        this.input.setBotInput(botId, true, steer, throttle, useUltra);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const now = performance.now();
    const b = this.arenaBounds;

    // 1. Haunted Victorian Mansion Parquet Floor
    ctx.fillStyle = '#0B0912';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x, b.y, b.w, b.h);
    ctx.clip();

    // Weathered parquet planks
    const plankH = 26;
    for (let py = b.y; py < b.y + b.h; py += plankH) {
      const isOdd = Math.floor(py / plankH) % 2 === 1;
      ctx.fillStyle = isOdd ? '#16131F' : '#110E18';
      ctx.fillRect(b.x, py, b.w, plankH - 2);

      // Plank seams
      ctx.strokeStyle = '#09070D';
      ctx.lineWidth = 1.5;
      for (let px = b.x + (isOdd ? 60 : 0); px < b.x + b.w; px += 120) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py + plankH - 2);
        ctx.stroke();
      }
    }

    // Creaky Floorboard Traps (Highlighted weathered oak with hazard accents)
    for (const cf of this.creakyFloorboards) {
      ctx.fillStyle = '#241A12';
      ctx.fillRect(cf.x, cf.y, cf.w, cf.h);
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 2;
      ctx.strokeRect(cf.x, cf.y, cf.w, cf.h);

      // Antique brass rivets
      ctx.fillStyle = '#92400E';
      ctx.fillRect(cf.x + 3, cf.y + 3, 4, 4);
      ctx.fillRect(cf.x + cf.w - 7, cf.y + 3, 4, 4);
      ctx.fillRect(cf.x + 3, cf.y + cf.h - 7, 4, 4);
      ctx.fillRect(cf.x + cf.w - 7, cf.y + cf.h - 7, 4, 4);

      // Warning text on trap
      ctx.fillStyle = 'rgba(217, 119, 6, 0.45)';
      ctx.font = '700 9px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CREAKY OAK', cf.x + cf.w / 2, cf.y + cf.h / 2);
    }

    // Sound Ripples (Expanding sonar wave rings from creaking)
    for (const rip of this.soundRipples) {
      ctx.save();
      ctx.strokeStyle = rip.color;
      ctx.globalAlpha = Math.max(0, rip.alpha);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner faint echo
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(rip.x, rip.y, Math.max(2, rip.radius * 0.65), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // Stone Mansion Wall Perimeter
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    // 2. Volumetric Flashlight Cones & Ambient Illumination
    for (const mp of this.mPlayers.values()) {
      if (!mp.isGhost) {
        ctx.save();
        ctx.translate(mp.x, mp.y);
        ctx.rotate(mp.flashlightAngle);

        const range = mp.isUltraBeam ? 275 : 195;
        const halfAngle = mp.isUltraBeam ? 0.62 : 0.44;

        // Volumetric Light Cone
        const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, range);
        if (mp.isUltraBeam) {
          // Blinding golden-white Ultra-Beam
          grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
          grad.addColorStop(0.35, 'rgba(253, 224, 71, 0.7)');
          grad.addColorStop(0.7, 'rgba(250, 204, 21, 0.3)');
          grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
        } else {
          // Warm focused beam
          grad.addColorStop(0, 'rgba(254, 240, 138, 0.85)');
          grad.addColorStop(0.4, 'rgba(253, 224, 71, 0.45)');
          grad.addColorStop(0.8, 'rgba(250, 204, 21, 0.15)');
          grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, range, -halfAngle, halfAngle);
        ctx.closePath();
        ctx.fill();

        // Intense core ray line
        ctx.strokeStyle = mp.isUltraBeam ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = mp.isUltraBeam ? 3.5 : 1.8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(range * 0.92, 0);
        ctx.stroke();

        ctx.restore();
      }
    }

    // 3. Draw Players (Mascots & Spectral Phantom)
    for (const mp of this.mPlayers.values()) {
      ctx.save();
      ctx.translate(mp.x, mp.y);

      if (mp.isGhost) {
        // --- EERIE SPECTRAL GHOST ---
        const isRevealed = mp.revealedTimer > 0;
        const floatY = Math.sin(now * 0.007) * 4;
        const pulse = (Math.sin(now * 0.009) + 1) * 3;

        // In darkness, ghost is cloaked (translucent phantom); when hit by beam, 100% luminous!
        ctx.globalAlpha = isRevealed ? 1.0 : 0.32;

        // Spectral ectoplasm aura
        ctx.shadowColor = isRevealed ? '#FACC15' : '#C084FC';
        ctx.shadowBlur = isRevealed ? 30 : 20;
        ctx.fillStyle = isRevealed ? 'rgba(250, 204, 21, 0.35)' : 'rgba(168, 85, 247, 0.3)';
        ctx.beginPath();
        ctx.arc(0, floatY, 26 + pulse, 0, Math.PI * 2);
        ctx.fill();

        // Ghost body silhouette with rippling skirt
        ctx.fillStyle = isRevealed ? '#FEF08A' : '#E9D5FF';
        ctx.beginPath();
        ctx.arc(0, floatY - 2, 17, Math.PI, 0, false);
        ctx.lineTo(17, floatY + 16);
        ctx.lineTo(11, floatY + 10);
        ctx.lineTo(0, floatY + 17);
        ctx.lineTo(-11, floatY + 10);
        ctx.lineTo(-17, floatY + 16);
        ctx.closePath();
        ctx.fill();

        // Glowing Haunted Eyes
        ctx.fillStyle = isRevealed ? '#78350F' : '#3B0764';
        ctx.beginPath();
        ctx.ellipse(5, floatY - 3, 3, 5, 0, 0, Math.PI * 2);
        ctx.ellipse(12, floatY - 3, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // O-shaped mouth
        ctx.beginPath();
        ctx.ellipse(8, floatY + 5, 2.5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Immunity runic barrier shield
        if (mp.immunityTimer > 0) {
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, floatY, 28, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#38BDF8';
          ctx.font = '800 10px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`CHARGING ${mp.immunityTimer.toFixed(1)}s`, 0, floatY - 32);
        }

        ctx.restore();
      } else {
        // --- HUMAN INVESTIGATOR MASCOT ---
        ctx.save();
        this.drawPlayerMascot(ctx, mp.id, mp.x, mp.y, 15, mp.isUltraBeam ? 'focused' : 'idle', now * 0.001, mp.flashlightAngle);

        // Flashlight cylinder in player's hand
        ctx.translate(mp.x, mp.y);
        ctx.rotate(mp.flashlightAngle);
        ctx.fillStyle = '#94A3B8';
        ctx.fillRect(10, -4, 10, 8);
        ctx.fillStyle = mp.isUltraBeam ? '#FACC15' : '#FBBF24';
        ctx.fillRect(18, -5, 4, 10);
        ctx.restore();

        // Battery meter under player
        const barW = 34;
        const barH = 5;
        const barX = mp.x - barW / 2;
        const barY = mp.y + 24;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        const fillW = (mp.flashlightBattery / 100) * barW;
        ctx.fillStyle = mp.isUltraBeam ? '#FACC15' : '#38BDF8';
        ctx.fillRect(barX, barY, fillW, barH);
      }
    }

    // 4. Fixed High-Contrast Role & Instruction Banner (Top Center)
    const bannerW = Math.min(620, b.w - 40);
    const bannerH = 46;
    const bannerX = b.x + (b.w - bannerW) / 2;
    const bannerY = b.y + 10;

    const ghost = Array.from(this.mPlayers.values()).find((p) => p.isGhost);
    const p1 = this.mPlayers.get(0);
    const isP1Ghost = p1 ? p1.isGhost : false;

    ctx.save();
    // Glassmorphic translucent badge
    ctx.fillStyle = isP1Ghost ? 'rgba(59, 7, 100, 0.88)' : 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 12);
    else ctx.rect(bannerX, bannerY, bannerW, bannerH);
    ctx.fill();

    ctx.strokeStyle = isP1Ghost ? '#C084FC' : '#FBBF24';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Primary Instruction Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 13px Montserrat, sans-serif';
    ctx.fillStyle = '#FFFFFF';

    if (isP1Ghost) {
      if (p1 && p1.immunityTimer > 0) {
        ctx.fillText(`👻 YOU ARE THE GHOST! CHARGING CURSE: ${p1.immunityTimer.toFixed(1)}s (GET READY!)`, bannerX + bannerW / 2, bannerY + 16);
      } else {
        ctx.fillText(`👻 YOU ARE THE GHOST! CHASE & TAG SURVIVORS TO PASS THE CURSE!`, bannerX + bannerW / 2, bannerY + 16);
      }
    } else {
      ctx.fillText(`🔦 SURVIVOR: AIM LIGHT AT GHOST TO SLOW THEM! HOLD ACTION FOR ULTRA-BEAM!`, bannerX + bannerW / 2, bannerY + 16);
    }

    // Subtitle / Controls / Timer reminder
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.fillStyle = isP1Ghost ? '#E9D5FF' : '#FDE047';
    ctx.fillText(`Least time as Ghost wins! | ⏱️ Round: ${Math.ceil(this.roundTimer)}s`, bannerX + bannerW / 2, bannerY + 32);

    ctx.restore();

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    // Player who spent the LEAST time as ghost wins!
    const list = Array.from(this.mPlayers.values()).sort((a, b) => a.timeAsGhost - b.timeAsGhost);
    const winnerId = list.length > 0 ? list[0].id : null;
    return {
      winnerId,
      rankings: list.map((mp, idx) => ({
        playerId: mp.id,
        score: Math.max(0, Math.floor(mp.survivorScore - mp.timeAsGhost * 10)),
        place: idx + 1
      })),
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} eluded the ghostly curse!` : 'Mansion conquered!'
    };
  }
}
