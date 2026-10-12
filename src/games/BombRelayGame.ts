import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';

interface RelayRunner {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alive: boolean;
  score: number;
  invulnTimer: number; // brief pass-back cooldown
}

export class BombRelayGame extends BaseGame {
  private runners: Map<PlayerId, RelayRunner> = new Map();
  private bombHolderId: PlayerId = 0;
  private fuseTimer: number = 14.0;
  private initialFuse: number = 14.0;
  private arenaRadius: number = 220;
  private arenaCenterX: number = 0;
  private arenaCenterY: number = 0;
  private eliminationOrder: PlayerId[] = [];
  private tickInterval: number = 1.0;
  private tickTimer: number = 1.0;
  private obstacles: { x: number; y: number; radius: number; color: string }[] = [];
  public currentMapName: string = 'Central Vault';

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 75;
    this.isFinished = false;
    this.runners.clear();
    this.eliminationOrder = [];
    this.arenaCenterX = width / 2;
    this.arenaCenterY = height / 2;
    this.arenaRadius = Math.min(width, height) * 0.38;
    this.initialFuse = 12.0;
    this.fuseTimer = this.initialFuse;
    this.tickTimer = 1.0;

    // Procedural Obstacle Layout Generation
    this.generateRandomMap(this.arenaCenterX, this.arenaCenterY, this.arenaRadius);

    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      const angle = (idx / count) * Math.PI * 2;
      const dist = this.arenaRadius * 0.65;
      this.runners.set(p.id, {
        id: p.id,
        x: this.arenaCenterX + Math.cos(angle) * dist,
        y: this.arenaCenterY + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        radius: 17,
        alive: true,
        score: 0,
        invulnTimer: 0
      });
    });

    // Random initial bomb holder
    const activeIds = active.map((p) => p.id);
    this.bombHolderId = activeIds[Math.floor(Math.random() * activeIds.length)] ?? 0;
  }

  private generateRandomMap(cx: number, cy: number, radius: number): void {
    const archetypes = ['Central Vault', 'Stonehenge Circle', 'Twin Rebounders', 'Open Colosseum'];
    this.currentMapName = archetypes[Math.floor(Math.random() * archetypes.length)];
    this.obstacles = [];

    switch (this.currentMapName) {
      case 'Central Vault':
        // Center heavy bunker with 4 orbiting deflector pegs
        this.obstacles.push({ x: cx, y: cy, radius: 28, color: '#38BDF8' });
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          this.obstacles.push({
            x: cx + Math.cos(a) * (radius * 0.45),
            y: cy + Math.sin(a) * (radius * 0.45),
            radius: 16,
            color: '#F59E0B'
          });
        }
        break;

      case 'Stonehenge Circle':
        // 5 circular stone monoliths forming an inner ring
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          this.obstacles.push({
            x: cx + Math.cos(a) * (radius * 0.42),
            y: cy + Math.sin(a) * (radius * 0.42),
            radius: 20,
            color: '#94A3B8'
          });
        }
        break;

      case 'Twin Rebounders':
        // Two massive bouncy pylons
        this.obstacles.push(
          { x: cx - radius * 0.35, y: cy, radius: 26, color: '#EC4899' },
          { x: cx + radius * 0.35, y: cy, radius: 26, color: '#10B981' }
        );
        break;

      case 'Open Colosseum':
      default:
        // Clear open arena
        break;
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Fuse countdown
    this.fuseTimer -= dt;
    this.tickTimer -= dt;
    if (this.tickTimer <= 0) {
      this.tickTimer = Math.max(0.2, this.fuseTimer / this.initialFuse);
      this.audio.playTap();
    }

    // Bomb Detonation!
    if (this.fuseTimer <= 0) {
      this.detonateBomb();
      return;
    }

    // Process Runner Movements
    for (const r of this.runners.values()) {
      if (!r.alive) continue;

      if (r.invulnTimer > 0) r.invulnTimer -= dt;

      const steer = this.input.getSteer(r.id);
      const throttle = this.input.getThrottle(r.id);
      const isPressed = this.input.isPressed(r.id);

      const isBombCarrier = r.id === this.bombHolderId;
      const baseSpeed = isBombCarrier ? 240 : 210; // Bomb carrier gets a slight speed boost to make chases exciting!

      const inputY = -throttle;
      if (steer !== 0 || throttle !== 0) {
        r.vx += (steer * baseSpeed - r.vx) * dt * 9;
        r.vy += (inputY * baseSpeed - r.vy) * dt * 9;
      } else if (isPressed) {
        // Forward lunge
        const heading = Math.atan2(r.vy, r.vx) || 0;
        r.vx += Math.cos(heading) * baseSpeed * dt * 8;
        r.vy += Math.sin(heading) * baseSpeed * dt * 8;
      } else {
        r.vx *= Math.pow(0.92, dt * 60);
        r.vy *= Math.pow(0.92, dt * 60);
      }

      r.x += r.vx * dt;
      r.y += r.vy * dt;

      // Arena circular bumper collision
      const distFromCenter = Math.hypot(r.x - this.arenaCenterX, r.y - this.arenaCenterY);
      if (distFromCenter > this.arenaRadius - r.radius) {
        const nx = (r.x - this.arenaCenterX) / distFromCenter;
        const ny = (r.y - this.arenaCenterY) / distFromCenter;
        r.x = this.arenaCenterX + nx * (this.arenaRadius - r.radius);
        r.y = this.arenaCenterY + ny * (this.arenaRadius - r.radius);

        // Bumper bounce
        const dot = r.vx * nx + r.vy * ny;
        r.vx = (r.vx - 2 * dot * nx) * 0.85;
        r.vy = (r.vy - 2 * dot * ny) * 0.85;
        this.audio.playBounce();
        this.particles.spawnSparks(r.x, r.y, '#38BDF8', 5);
      }

      // Internal Obstacle Deflection
      for (const obs of this.obstacles) {
        const dObs = Math.hypot(r.x - obs.x, r.y - obs.y);
        if (dObs < obs.radius + r.radius && dObs > 0) {
          const nx = (r.x - obs.x) / dObs;
          const ny = (r.y - obs.y) / dObs;
          r.x = obs.x + nx * (obs.radius + r.radius);
          r.y = obs.y + ny * (obs.radius + r.radius);
          const dot = r.vx * nx + r.vy * ny;
          r.vx = (r.vx - 2 * dot * nx) * 0.85;
          r.vy = (r.vy - 2 * dot * ny) * 0.85;
          this.audio.playBounce();
          this.particles.spawnSparks(r.x, r.y, obs.color, 4);
        }
      }
    }

    // Inter-player collision & Bomb Passing
    const runnerArr = Array.from(this.runners.values()).filter((r) => r.alive);
    for (let i = 0; i < runnerArr.length; i++) {
      for (let j = i + 1; j < runnerArr.length; j++) {
        const p1 = runnerArr[i];
        const p2 = runnerArr[j];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const d = Math.hypot(dx, dy);
        const minDist = p1.radius + p2.radius;

        if (d < minDist && d > 0) {
          // Push apart
          const nx = dx / d;
          const ny = dy / d;
          const overlap = minDist - d;
          p1.x -= nx * overlap * 0.5;
          p1.y -= ny * overlap * 0.5;
          p2.x += nx * overlap * 0.5;
          p2.y += ny * overlap * 0.5;

          // Swap velocities with bounce
          const tempVx = p1.vx;
          const tempVy = p1.vy;
          p1.vx = p2.vx * 0.8;
          p1.vy = p2.vy * 0.8;
          p2.vx = tempVx * 0.8;
          p2.vy = tempVy * 0.8;

          // Check Bomb Transfer
          if (p1.id === this.bombHolderId && p1.invulnTimer <= 0) {
            this.transferBomb(p2.id);
          } else if (p2.id === this.bombHolderId && p2.invulnTimer <= 0) {
            this.transferBomb(p1.id);
          }
        }
      }
    }

    // Check survivors
    const survivors = runnerArr.filter((r) => r.alive);
    if (survivors.length <= 1 || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private transferBomb(newHolderId: PlayerId) {
    this.bombHolderId = newHolderId;
    const holder = this.runners.get(newHolderId);
    if (holder) {
      holder.invulnTimer = 0.8; // Prevent immediate ping-pong bounce back
      this.audio.playBoost();
      this.particles.showFloatingText('PASSED BOMB!', holder.x, holder.y - 25, '#EF4444', 20);
      this.particles.spawnSparks(holder.x, holder.y, '#EF4444', 15);
    }
  }

  private detonateBomb() {
    const victim = this.runners.get(this.bombHolderId);
    if (victim && victim.alive) {
      victim.alive = false;
      this.eliminationOrder.push(victim.id);
      this.audio.playExplosion();
      this.particles.addTrauma(0.35);
      this.particles.spawnExplosion(victim.x, victim.y, '#EF4444', 45);
      this.particles.showFloatingText('KABOOM! ELIMINATED!', victim.x, victim.y, '#EF4444', 26);
    }

    // Check if game over
    const survivors = Array.from(this.runners.values()).filter((r) => r.alive);
    if (survivors.length <= 1) {
      this.isFinished = true;
      return;
    }

    // Pick new bomb holder among survivors
    const choice = survivors[Math.floor(Math.random() * survivors.length)];
    this.bombHolderId = choice.id;
    choice.invulnTimer = 0.5;
    this.initialFuse = Math.max(6.0, this.initialFuse - 1.5);
    this.fuseTimer = this.initialFuse;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const me = this.runners.get(botId);
    if (!me || !me.alive) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    const isHolder = botId === this.bombHolderId;
    let steerX = 0;
    let steerY = 0;

    if (isHolder) {
      // Chasing nearest opponent
      let nearestOpp: RelayRunner | null = null;
      let minD = Infinity;
      for (const r of this.runners.values()) {
        if (r.id !== botId && r.alive) {
          const d = Math.hypot(r.x - me.x, r.y - me.y);
          if (d < minD) {
            minD = d;
            nearestOpp = r;
          }
        }
      }

      if (nearestOpp) {
        const dx = nearestOpp.x - me.x;
        const dy = nearestOpp.y - me.y;
        const mag = Math.hypot(dx, dy) || 1;
        steerX = dx / mag;
        steerY = dy / mag;
      }
    } else {
      // Fleeing from the bomb holder!
      const holder = this.runners.get(this.bombHolderId);
      if (holder && holder.alive) {
        const awayDx = me.x - holder.x;
        const awayDy = me.y - holder.y;
        const awayDist = Math.hypot(awayDx, awayDy) || 1;

        steerX = awayDx / awayDist;
        steerY = awayDy / awayDist;

        // Wall repulsion to avoid getting trapped in corners
        const distFromCenter = Math.hypot(me.x - this.arenaCenterX, me.y - this.arenaCenterY);
        if (distFromCenter > this.arenaRadius * 0.75) {
          const toCenterX = (this.arenaCenterX - me.x) / (distFromCenter || 1);
          const toCenterY = (this.arenaCenterY - me.y) / (distFromCenter || 1);
          steerX += toCenterX * 0.8;
          steerY += toCenterY * 0.8;
        }
      }
    }

    // Add difficulty inaccuracy
    if (difficulty === 'bot_easy') {
      steerX += (Math.random() - 0.5) * 0.9;
      steerY += (Math.random() - 0.5) * 0.9;
    }

    const mag = Math.hypot(steerX, steerY) || 1;
    this.input.setBotInput(botId, true, steerX / mag, -steerY / mag, false);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const survivors = Array.from(this.runners.values()).filter((r) => r.alive);
    const winnerId = survivors.length === 1 ? survivors[0].id : (this.eliminationOrder[this.eliminationOrder.length - 1] ?? null);

    const rankedIds = [...survivors.map((s) => s.id), ...[...this.eliminationOrder].reverse()];

    return {
      winnerId,
      rankings: rankedIds.map((pid, idx) => ({
        playerId: pid,
        score: idx === 0 ? 100 : 0,
        place: idx + 1
      })),
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} SURVIVED THE TICKING RELAY!` : 'THE BOMB DETONATED EVERYONE!'
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Dark Cyberpunk Arena Floor
    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(0, 0, width, height);

    // Arena circular boundary fill
    const arenaGrad = ctx.createRadialGradient(
      this.arenaCenterX, this.arenaCenterY, 30,
      this.arenaCenterX, this.arenaCenterY, this.arenaRadius
    );
    arenaGrad.addColorStop(0, '#1E293B');
    arenaGrad.addColorStop(0.85, '#0F172A');
    arenaGrad.addColorStop(1, '#020617');
    ctx.fillStyle = arenaGrad;
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, this.arenaRadius, 0, Math.PI * 2);
    ctx.fill();

    // Hazard Concentric Target Rings
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, this.arenaRadius * 0.75, 0, Math.PI * 2);
    ctx.arc(this.arenaCenterX, this.arenaCenterY, this.arenaRadius * 0.5, 0, Math.PI * 2);
    ctx.arc(this.arenaCenterX, this.arenaCenterY, this.arenaRadius * 0.25, 0, Math.PI * 2);
    ctx.stroke();

    // High-Voltage Neon Perimeter Rim
    const isCriticalFuse = this.fuseTimer < 3.0;
    ctx.save();
    ctx.shadowColor = isCriticalFuse ? '#EF4444' : '#38BDF8';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = isCriticalFuse ? '#EF4444' : '#38BDF8';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, this.arenaRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Internal Tactical Obstacles
    for (const obs of this.obstacles) {
      ctx.save();
      ctx.shadowColor = obs.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = obs.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      // Center jewel node
      ctx.fillStyle = obs.color;
      ctx.beginPath();
      ctx.arc(obs.x, obs.y, obs.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Render Runners
    for (const r of this.runners.values()) {
      if (!r.alive) continue;

      ctx.save();
      const pColor = this.players[r.id]?.color || '#FFFFFF';
      const isHolder = r.id === this.bombHolderId;

      // Bomb carrier pulsating warning aura
      if (isHolder) {
        ctx.save();
        const pulse = (Math.sin(performance.now() * 0.01) + 1) * 0.5;
        ctx.fillStyle = isCriticalFuse ? `rgba(239, 68, 68, ${0.25 + pulse * 0.25})` : `rgba(245, 158, 11, ${0.2 + pulse * 0.15})`;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(r.x, r.y + r.radius - 2, r.radius * 0.9, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body circle
      ctx.fillStyle = pColor;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Expressive eyes / heading
      const hAngle = Math.atan2(r.vy, r.vx) || 0;
      const eyeDist = r.radius * 0.4;
      const eye1X = r.x + Math.cos(hAngle - 0.45) * eyeDist;
      const eye1Y = r.y + Math.sin(hAngle - 0.45) * eyeDist;
      const eye2X = r.x + Math.cos(hAngle + 0.45) * eyeDist;
      const eye2Y = r.y + Math.sin(hAngle + 0.45) * eyeDist;

      // Eye whites
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(eye1X, eye1Y, 4, 0, Math.PI * 2);
      ctx.arc(eye2X, eye2Y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Pupils
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(eye1X + Math.cos(hAngle) * 1.5, eye1Y + Math.sin(hAngle) * 1.5, 2, 0, Math.PI * 2);
      ctx.arc(eye2X + Math.cos(hAngle) * 1.5, eye2Y + Math.sin(hAngle) * 1.5, 2, 0, Math.PI * 2);
      ctx.fill();

      // Player name frosted badge
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(r.x - 36, r.y + r.radius + 6, 72, 18, 9);
      ctx.fill();
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.players[r.id].name.toUpperCase(), r.x, r.y + r.radius + 15);

      // Render Bomb above holder's head!
      if (isHolder) {
        this.renderBomb(ctx, r.x, r.y - 32);
      }

      ctx.restore();
    }

    // 3. Fuse Countdown HUD Pill (Positioned safely at y=58 below stopwatch timer)
    ctx.save();
    const pillW = 280;
    const pillH = 30;
    const pillX = width / 2 - pillW / 2;
    const pillY = 58;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 15);
    ctx.fill();

    const pillBorderColor = isCriticalFuse ? '#EF4444' : '#F59E0B';
    ctx.strokeStyle = pillBorderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = pillBorderColor;
    ctx.font = '900 13px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`💣 BOMB DETONATION: ${Math.max(0, this.fuseTimer).toFixed(1)}s 💣`, width / 2, pillY + pillH / 2);
    ctx.restore();

    ctx.restore();
  }

  private renderBomb(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 16, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bomb spherical body with 3D gradient
    const bombGrad = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, 16);
    bombGrad.addColorStop(0, '#52525B');
    bombGrad.addColorStop(0.6, '#18181B');
    bombGrad.addColorStop(1, '#09090B');
    ctx.fillStyle = bombGrad;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Glossy catchlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x - 6, y - 6, 5, 3, -0.6, 0, Math.PI * 2);
    ctx.fill();

    // Brass fuse neck
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.roundRect(x - 4, y - 21, 8, 6, 2);
    ctx.fill();

    // Curved rope fuse
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 21);
    ctx.quadraticCurveTo(x + 6, y - 26, x + 2, y - 30);
    ctx.stroke();

    // Sizzling spark explosion flame
    const sparkX = x + 2;
    const sparkY = y - 30;
    ctx.shadowColor = '#F59E0B';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
