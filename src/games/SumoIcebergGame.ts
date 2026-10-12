import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';

interface IcebergRival {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  alive: boolean;
  sprintCharges: number;
  maxSprintCharges: number;
  sprintRechargeTimer: number;
  sprintRechargeTime: number;
  sprintCooldown: number;
  isDashing: boolean;
  dashDuration: number;
  score: number;
}

export class SumoIcebergGame extends BaseGame {
  private arenaCenterX: number = 0;
  private arenaCenterY: number = 0;
  private initialRadius: number = 200;
  private currentRadius: number = 200;
  private tiltX: number = 0;
  private tiltY: number = 0;
  private rivals: Map<PlayerId, IcebergRival> = new Map();
  private eliminationOrder: PlayerId[] = [];
  private waveTimer: number = 0;

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 60;
    this.isFinished = false;
    this.arenaCenterX = width / 2;
    this.arenaCenterY = height / 2;
    this.initialRadius = Math.min(220, Math.min(width, height) * 0.38);
    this.currentRadius = this.initialRadius;
    this.tiltX = 0;
    this.tiltY = 0;
    this.rivals.clear();
    this.eliminationOrder = [];
    this.waveTimer = 0;

    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      const angle = (idx / count) * Math.PI * 2;
      const dist = this.initialRadius * 0.55;
      this.rivals.set(p.id, {
        id: p.id,
        x: this.arenaCenterX + Math.cos(angle) * dist,
        y: this.arenaCenterY + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        angle: angle + Math.PI, // Facing center
        radius: 17,
        alive: true,
        sprintCharges: 3,
        maxSprintCharges: 3,
        sprintRechargeTimer: 0,
        sprintRechargeTime: 1.35,
        sprintCooldown: 0,
        isDashing: false,
        dashDuration: 0,
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.waveTimer += dt * 3.0;

    // Slowly shrink iceberg disc over the course of 60 seconds
    const shrinkRate = (this.initialRadius - 105) / 60;
    this.currentRadius = Math.max(105, this.currentRadius - shrinkRate * dt);

    // Update bot inputs
    this.updateBots(dt, width, height);

    // Calculate center of mass to determine 3D dynamic tilt
    let massCenterX = 0;
    let massCenterY = 0;
    let aliveCount = 0;

    for (const r of this.rivals.values()) {
      if (r.alive) {
        massCenterX += (r.x - this.arenaCenterX) / this.initialRadius;
        massCenterY += (r.y - this.arenaCenterY) / this.initialRadius;
        aliveCount++;
      }
    }

    if (aliveCount > 0) {
      const targetTiltX = (massCenterX / aliveCount) * 0.35;
      const targetTiltY = (massCenterY / aliveCount) * 0.35;
      this.tiltX += (targetTiltX - this.tiltX) * dt * 2.5;
      this.tiltY += (targetTiltY - this.tiltY) * dt * 2.5;
    }

    // Process each rival player
    for (const r of this.rivals.values()) {
      if (!r.alive) continue;

      if (r.sprintCooldown > 0) r.sprintCooldown -= dt;
      if (r.dashDuration > 0) {
        r.dashDuration -= dt;
        if (r.dashDuration <= 0) r.isDashing = false;
      }

      // Recharge sprint charges over time
      if (r.sprintCharges < r.maxSprintCharges) {
        r.sprintRechargeTimer += dt;
        if (r.sprintRechargeTimer >= r.sprintRechargeTime) {
          r.sprintCharges++;
          r.sprintRechargeTimer = 0;
          this.audio.playMenuTick();
          this.particles.spawnSparks(r.x, r.y, '#38BDF8', 6);
        }
      } else {
        r.sprintRechargeTimer = 0;
      }

      const isPressed = this.input.isPressed(r.id);
      const justPressed = this.input.justPressed(r.id) || this.input.justAction(r.id);
      const action = this.input.isActionPressed(r.id);
      const steer = this.input.getSteer(r.id);
      const throttle = this.input.getThrottle(r.id);

      // Multiple sprint bursts with recharge between each
      const wantSprint = justPressed || (action && r.sprintCooldown <= 0);
      if (wantSprint && r.sprintCooldown <= 0) {
        if (r.sprintCharges > 0) {
          r.sprintCharges--;
          r.sprintCooldown = 0.22; // Small cadence buffer between consecutive sprints
          r.isDashing = true;
          r.dashDuration = 0.24;
          const dashSpeed = 390;
          r.vx += Math.cos(r.angle) * dashSpeed;
          r.vy += Math.sin(r.angle) * dashSpeed;
          this.audio.playBoost();
          this.particles.spawnSparks(r.x, r.y, '#93C5FD', 10);
          this.particles.showFloatingText(`⚡ SPRINT! (${r.sprintCharges}/${r.maxSprintCharges})`, r.x, r.y - 25, '#38BDF8', 16);
        } else {
          // Empty sprint dry click
          r.sprintCooldown = 0.20;
          this.audio.playMenuTick();
        }
      }

      // Continuous steering & propulsion
      const inputY = -throttle;
      if (steer !== 0 || throttle !== 0) {
        r.angle = Math.atan2(inputY, steer);
        const moveAcc = 260;
        r.vx += steer * moveAcc * dt;
        r.vy += inputY * moveAcc * dt;
      } else if (isPressed && !r.isDashing) {
        // Tap/hold forward drift
        r.vx += Math.cos(r.angle) * 160 * dt;
        r.vy += Math.sin(r.angle) * 160 * dt;
      }

      // Slippery ice slope downhill gravity pull from tilt!
      const slopeForce = 180;
      r.vx += this.tiltX * slopeForce * dt;
      r.vy += this.tiltY * slopeForce * dt;

      // Low friction ice sliding
      const friction = r.isDashing ? 0.98 : 0.95;
      r.vx *= Math.pow(friction, dt * 60);
      r.vy *= Math.pow(friction, dt * 60);

      r.x += r.vx * dt;
      r.y += r.vy * dt;

      if (Math.hypot(r.vx, r.vy) > 20) {
        r.angle = Math.atan2(r.vy, r.vx);
      }

      // Boundary check: falling into freezing water
      const distFromCenter = Math.hypot(r.x - this.arenaCenterX, r.y - this.arenaCenterY);
      if (distFromCenter > this.currentRadius + r.radius * 0.4) {
        // Player pushed off iceberg!
        r.alive = false;
        this.eliminationOrder.push(r.id);
        this.audio.playExplosion();
        this.particles.spawnExplosion(r.x, r.y, '#38BDF8', 25);
        this.particles.addTrauma(0.18);
        this.particles.showFloatingText('SPLASH! ELIMINATED!', r.x, r.y, '#EF4444', 20);
      }
    }

    // Inter-player sumo collision physics
    const rList = Array.from(this.rivals.values());
    for (let i = 0; i < rList.length; i++) {
      for (let j = i + 1; j < rList.length; j++) {
        const p1 = rList[i];
        const p2 = rList[j];
        if (!p1.alive || !p2.alive) continue;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = p1.radius + p2.radius;

        if (dist < minDist) {
          const effectiveDist = Math.max(0.01, dist);
          const nx = dist > 0.001 ? dx / dist : 1;
          const ny = dist > 0.001 ? dy / dist : 0;

          // Push apart
          const overlap = minDist - effectiveDist;
          p1.x -= nx * overlap * 0.5;
          p1.y -= ny * overlap * 0.5;
          p2.x += nx * overlap * 0.5;
          p2.y += ny * overlap * 0.5;

          // Shove impulse based on dashing state
          const shoveForce = (p1.isDashing ? 380 : 160) + (p2.isDashing ? 380 : 160);
          p1.vx -= nx * shoveForce * 0.7;
          p1.vy -= ny * shoveForce * 0.7;
          p2.vx += nx * shoveForce * 0.7;
          p2.vy += ny * shoveForce * 0.7;

          this.audio.playBounce();
          this.particles.spawnSparks((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, '#FFFFFF', 10);
        }
      }
    }

    // Check round over
    const survivors = rList.filter((r) => r.alive);
    if (survivors.length <= 1 || this.roundTimer <= 0) {
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
    const me = this.rivals.get(botId);
    if (!me || !me.alive) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // Distance and angle to arena center
    const distFromCenter = Math.hypot(me.x - this.arenaCenterX, me.y - this.arenaCenterY);
    const toCenterX = this.arenaCenterX - me.x;
    const toCenterY = this.arenaCenterY - me.y;

    // Find closest alive opponent
    let nearestOpponent: IcebergRival | null = null;
    let minOppDist = Infinity;
    for (const r of this.rivals.values()) {
      if (r.id !== botId && r.alive) {
        const d = Math.hypot(r.x - me.x, r.y - me.y);
        if (d < minOppDist) {
          minOppDist = d;
          nearestOpponent = r;
        }
      }
    }

    // Edge danger threshold
    const dangerDist = this.currentRadius * (difficulty === 'bot_hard' ? 0.78 : difficulty === 'bot_normal' ? 0.72 : 0.65);
    const isInPeril = distFromCenter > dangerDist;

    let steerX = 0;
    let steerY = 0;
    let wantDash = false;

    if (isInPeril) {
      // Danger! Steer back towards center
      const centerDist = Math.hypot(toCenterX, toCenterY) || 1;
      steerX = toCenterX / centerDist;
      steerY = toCenterY / centerDist;

      // Emergency sprint back toward center if close to brink
      if (distFromCenter > this.currentRadius * 0.85 && me.sprintCharges > 0 && me.sprintCooldown <= 0) {
        wantDash = true;
      }
    } else if (nearestOpponent) {
      // Move to tackle opponent
      const oppDx = nearestOpponent.x - me.x;
      const oppDy = nearestOpponent.y - me.y;
      const oppDist = Math.hypot(oppDx, oppDy) || 1;

      steerX = oppDx / oppDist;
      steerY = oppDy / oppDist;

      // Sprint if aligned and within attack range
      const oppDistFromCenter = Math.hypot(nearestOpponent.x - this.arenaCenterX, nearestOpponent.y - this.arenaCenterY);
      const isOpponentVulnerable = oppDistFromCenter > this.currentRadius * 0.55;

      const triggerDist = difficulty === 'bot_hard' ? 125 : difficulty === 'bot_normal' ? 100 : 75;
      if (minOppDist < triggerDist && (isOpponentVulnerable || difficulty === 'bot_hard') && me.sprintCharges > 0 && me.sprintCooldown <= 0) {
        wantDash = Math.random() < (difficulty === 'bot_hard' ? 0.92 : difficulty === 'bot_normal' ? 0.70 : 0.40);
      }
    } else {
      // Roam center
      steerX = toCenterX / (distFromCenter || 1);
      steerY = toCenterY / (distFromCenter || 1);
    }

    // Add small random blunder for easy / normal
    if (difficulty === 'bot_easy') {
      steerX += (Math.random() - 0.5) * 0.8;
      steerY += (Math.random() - 0.5) * 0.8;
    }

    this.input.setBotInput(botId, wantDash, steerX, -steerY, wantDash);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const survivors = Array.from(this.rivals.values()).filter((r) => r.alive);
    const winnerId = survivors.length === 1 ? survivors[0].id : (this.eliminationOrder[this.eliminationOrder.length - 1] ?? null);

    // Rankings: survivors first, then reverse elimination order
    const rankedIds = [...survivors.map((s) => s.id), ...[...this.eliminationOrder].reverse()];

    return {
      winnerId,
      rankings: rankedIds.map((pid, idx) => ({
        playerId: pid,
        score: idx === 0 ? 1 : 0,
        place: idx + 1
      })),
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} RULED THE FROZEN ICEBERG!` : 'EVERYONE FELL INTO THE ICY SEA!'
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // Deep Arctic Ocean gradient
    const waterGrad = ctx.createRadialGradient(
      this.arenaCenterX,
      this.arenaCenterY,
      this.currentRadius * 0.8,
      this.arenaCenterX,
      this.arenaCenterY,
      Math.max(width, height) * 0.7
    );
    waterGrad.addColorStop(0, '#0284C7');
    waterGrad.addColorStop(0.5, '#0369A1');
    waterGrad.addColorStop(1, '#082F49');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, 0, width, height);

    // Dynamic wave ripples around iceberg
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    for (let r = 1; r <= 3; r++) {
      const rippleR = this.currentRadius + (r * 18 + Math.sin(this.waveTimer + r)) % 60;
      ctx.beginPath();
      ctx.arc(this.arenaCenterX, this.arenaCenterY, rippleR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Iceberg 3D Tilt Projection (Shadow & Submerged Base)
    const tiltOffsetX = this.tiltX * 24;
    const tiltOffsetY = this.tiltY * 24;

    // Submerged underwater ice shelf
    ctx.fillStyle = 'rgba(14, 116, 144, 0.6)';
    ctx.beginPath();
    ctx.arc(this.arenaCenterX + tiltOffsetX * 0.5, this.arenaCenterY + tiltOffsetY * 0.5 + 12, this.currentRadius + 14, 0, Math.PI * 2);
    ctx.fill();

    // Iceberg Top Platform Disc
    ctx.save();
    ctx.translate(this.arenaCenterX + tiltOffsetX, this.arenaCenterY + tiltOffsetY);

    // Ice Platform Gradient
    const iceGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, this.currentRadius);
    iceGrad.addColorStop(0, '#F0F9FF');
    iceGrad.addColorStop(0.65, '#E0F2FE');
    iceGrad.addColorStop(0.92, '#BAE6FD');
    iceGrad.addColorStop(1, '#7DD3FC');
    ctx.fillStyle = iceGrad;
    ctx.beginPath();
    ctx.arc(0, 0, this.currentRadius, 0, Math.PI * 2);
    ctx.fill();

    // Ice Cracks & Crevasses
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-this.currentRadius * 0.4, -this.currentRadius * 0.3);
    ctx.lineTo(this.currentRadius * 0.2, -this.currentRadius * 0.1);
    ctx.lineTo(this.currentRadius * 0.5, this.currentRadius * 0.4);
    ctx.stroke();

    // Perimeter Danger Ring
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, this.currentRadius - 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();

    // Render Sumo Players
    const now = performance.now() * 0.001;
    for (const r of this.rivals.values()) {
      if (!r.alive) continue;

      ctx.save();
      const distFromCenter = Math.hypot(r.x - this.arenaCenterX, r.y - this.arenaCenterY);
      const isNearEdge = distFromCenter > this.currentRadius * 0.72;
      const mood = r.isDashing ? 'focused' : isNearEdge ? 'shocked' : 'idle';

      // Ice sliding spray trail
      if (Math.hypot(r.vx, r.vy) > 80 || r.isDashing) {
        ctx.fillStyle = 'rgba(224, 242, 254, 0.45)';
        ctx.beginPath();
        ctx.arc(r.x - r.vx * 0.05, r.y - r.vy * 0.05, r.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw expressive mascot character
      this.drawPlayerMascot(ctx, r.id, r.x, r.y, r.radius + 3, mood, now);

      // Heading indicator pip on ice
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(r.x + Math.cos(r.angle) * (r.radius + 5), r.y + Math.sin(r.angle) * (r.radius + 5), 3.5, 0, Math.PI * 2);
      ctx.fill();

      // High-contrast Player Name Pill
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(r.x - 32, r.y - r.radius - 20, 64, 16, 8);
      } else {
        ctx.rect(r.x - 32, r.y - r.radius - 20, 64, 16);
      }
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.players[r.id].name.toUpperCase(), r.x, r.y - r.radius - 12);

      // Multi-Sprint Recharge Meter (3 Charges + Active Recharge Progress)
      const meterW = 38;
      const meterH = 5;
      const meterX = r.x - meterW / 2;
      const meterY = r.y + r.radius + 6;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(meterX - 2, meterY - 1, meterW + 4, meterH + 2, 3);
      else ctx.rect(meterX - 2, meterY - 1, meterW + 4, meterH + 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      const segSpacing = 2;
      const segW = (meterW - segSpacing * (r.maxSprintCharges - 1)) / r.maxSprintCharges;

      for (let s = 0; s < r.maxSprintCharges; s++) {
        const segX = meterX + s * (segW + segSpacing);
        if (s < r.sprintCharges) {
          // Charged Sprint Pip ready (cyan)
          ctx.fillStyle = '#38BDF8';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(segX, meterY, segW, meterH, 2);
          else ctx.rect(segX, meterY, segW, meterH);
          ctx.fill();
        } else if (s === r.sprintCharges && r.sprintCharges < r.maxSprintCharges) {
          // Currently Recharging Pip
          const progress = Math.max(0, Math.min(1, r.sprintRechargeTimer / r.sprintRechargeTime));
          ctx.fillStyle = 'rgba(51, 65, 85, 0.6)';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(segX, meterY, segW, meterH, 2);
          else ctx.rect(segX, meterY, segW, meterH);
          ctx.fill();

          ctx.fillStyle = '#F59E0B';
          ctx.fillRect(segX, meterY, segW * progress, meterH);
        } else {
          // Empty Pip awaiting recharge
          ctx.fillStyle = 'rgba(51, 65, 85, 0.6)';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(segX, meterY, segW, meterH, 2);
          else ctx.rect(segX, meterY, segW, meterH);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    // Shrinking Iceberg HUD Warning
    ctx.fillStyle = '#E0F2FE';
    ctx.font = 'bold 12px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`MELTING ICE: ${Math.round((this.currentRadius / this.initialRadius) * 100)}%`, width / 2, height - 20);

    ctx.restore();
  }
}
