import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Ghost {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  wobblePhase: number;
  points: number;
}

interface VacuumPlayer {
  id: PlayerId;
  x: number;
  y: number;
  angle: number;
  score: number;
  isSuction: boolean;
  canister: number;
}

export class GhostVacuumBusterGame extends BaseGame {
  private playersState: Map<PlayerId, VacuumPlayer> = new Map();
  private ghosts: Ghost[] = [];
  private nextGhostId: number = 1;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 30;
    this.playersState.clear();
    this.ghosts = [];
    this.nextGhostId = 1;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height / 2,
        angle: idx === 0 ? 0 : Math.PI,
        score: 0,
        isSuction: false,
        canister: 0
      });
    });

    for (let i = 0; i < 8; i++) {
      this.spawnGhost(width, height);
    }
  }

  private spawnGhost(width: number, height: number): void {
    const colors = ['#6ee7b7', '#93c5fd', '#c084fc', '#f472b6'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const speed = 30 + Math.random() * 40;
    const angle = Math.random() * Math.PI * 2;
    this.ghosts.push({
      id: this.nextGhostId++,
      x: 60 + Math.random() * (width - 120),
      y: 60 + Math.random() * (height - 120),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 18 + Math.random() * 6,
      color,
      wobblePhase: Math.random() * Math.PI * 2,
      points: color === '#c084fc' ? 2 : 1
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Update Ghosts
    for (const g of this.ghosts) {
      g.wobblePhase += dt * 3;
      g.x += g.vx * dt + Math.cos(g.wobblePhase) * 15 * dt;
      g.y += g.vy * dt + Math.sin(g.wobblePhase) * 15 * dt;

      if (g.x < 40) { g.x = 40; g.vx = Math.abs(g.vx); }
      if (g.x > width - 40) { g.x = width - 40; g.vx = -Math.abs(g.vx); }
      if (g.y < 40) { g.y = 40; g.vy = Math.abs(g.vy); }
      if (g.y > height - 40) { g.y = height - 40; g.vy = -Math.abs(g.vy); }
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const pressed = this.input.isPressed(p.id);

      if (Math.abs(steer) > 0.1 || Math.abs(throttle) > 0.1) {
        ps.angle = Math.atan2(-throttle, steer);
        ps.x += steer * 140 * dt;
        ps.y += -throttle * 140 * dt;
        ps.isSuction = pressed;
      } else {
        // Single-button fallback: holding button activates suction + slowly pivots, release turns faster
        if (pressed) {
          ps.isSuction = true;
          ps.angle += 1.8 * dt;
          ps.x += Math.cos(ps.angle) * 70 * dt;
          ps.y += Math.sin(ps.angle) * 70 * dt;
        } else {
          ps.isSuction = false;
          ps.angle += 2.8 * dt;
        }
      }

      ps.x = Math.max(30, Math.min(width - 30, ps.x));
      ps.y = Math.max(30, Math.min(height - 30, ps.y));

      if (ps.isSuction) {
        if (Math.random() < 0.2) {
          this.audio.playLaser();
        }

        const coneRange = 160;
        const coneAngle = Math.PI * 0.35; // ~63 degrees spread

        for (let i = this.ghosts.length - 1; i >= 0; i--) {
          const g = this.ghosts[i];
          const dx = g.x - ps.x;
          const dy = g.y - ps.y;
          const dist = Math.hypot(dx, dy);

          if (dist < coneRange) {
            const angleToGhost = Math.atan2(dy, dx);
            let angleDiff = angleToGhost - ps.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            if (Math.abs(angleDiff) < coneAngle) {
              // Pull ghost inward towards player nozzle
              const safeDist = Math.max(0.001, dist);
              const pullSpeed = 180 * (1 - dist / coneRange) + 60;
              g.x -= (dx / safeDist) * pullSpeed * dt;
              g.y -= (dy / safeDist) * pullSpeed * dt;

              // Check if captured
              if (dist < 32) {
                ps.score += g.points;
                ps.canister++;
                this.audio.playScore();
                this.particles.emit(g.x, g.y, 16, g.color);
                this.ghosts.splice(i, 1);
                this.spawnGhost(width, height);
              }
            }
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false, 0, 0);
      return;
    }

    let nearestGhost: Ghost | null = null;
    let minDist = Infinity;
    for (const g of this.ghosts) {
      const d = Math.hypot(g.x - ps.x, g.y - ps.y);
      if (d < minDist) {
        minDist = d;
        nearestGhost = g;
      }
    }

    if (nearestGhost) {
      let targetX = nearestGhost.x;
      let targetY = nearestGhost.y;
      if (difficulty === 'bot_easy') {
        targetX += (Math.random() - 0.5) * 40;
        targetY += (Math.random() - 0.5) * 40;
      }

      const targetAngle = Math.atan2(targetY - ps.y, targetX - ps.x);
      let diff = targetAngle - ps.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      const aimTolerance = difficulty === 'bot_easy' ? 0.65 : difficulty === 'bot_normal' ? 0.45 : 0.28;
      const isAiming = Math.abs(diff) < aimTolerance;
      const rangeThreshold = difficulty === 'bot_easy' ? 120 : difficulty === 'bot_normal' ? 165 : 200;
      const button = isAiming && minDist < rangeThreshold;

      const steerX = Math.cos(targetAngle);
      const steerY = Math.sin(targetAngle);

      this.input.setBotInput(botId, button, steerX, -steerY);
    } else {
      this.input.setBotInput(botId, false, 0, 0);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Spooky Mansion Floor
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Floorboards
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Render Ghosts
    for (const g of this.ghosts) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.shadowColor = g.color;
      ctx.shadowBlur = 12;

      // Ghost body
      ctx.fillStyle = g.color + 'aa';
      ctx.beginPath();
      ctx.arc(0, -4, g.radius, Math.PI, 0, false);
      // Flowing bottom skirt
      ctx.lineTo(g.radius, g.radius * 0.8);
      ctx.quadraticCurveTo(g.radius * 0.5, g.radius * 0.4, 0, g.radius * 0.8);
      ctx.quadraticCurveTo(-g.radius * 0.5, g.radius * 0.4, -g.radius, g.radius * 0.8);
      ctx.closePath();
      ctx.fill();

      // Ghost eyes
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-g.radius * 0.35, -4, 3, 0, Math.PI * 2);
      ctx.arc(g.radius * 0.35, -4, 3, 0, Math.PI * 2);
      ctx.fill();

      // Ghost mouth (o-shape)
      ctx.beginPath();
      ctx.arc(0, 3, 2.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    // Render Players & Vacuum Cones
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Suction Cone
      if (ps.isSuction) {
        ctx.save();
        ctx.rotate(ps.angle);

        const grad = ctx.createRadialGradient(0, 0, 10, 120, 0, 160);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
        grad.addColorStop(0.7, 'rgba(168, 85, 247, 0.25)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 160, -Math.PI * 0.35, Math.PI * 0.35, false);
        ctx.closePath();
        ctx.fill();

        // Pulsing rings
        const ringDist = ((Date.now() / 20) % 120) + 20;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, ringDist, -Math.PI * 0.3, Math.PI * 0.3);
        ctx.stroke();

        ctx.restore();
      }

      // Player Vacuum Backpack & Body
      ctx.rotate(ps.angle);

      // Proton backpack canister
      ctx.fillStyle = '#334155';
      ctx.fillRect(-18, -12, 14, 24);
      ctx.fillStyle = p.color;
      ctx.fillRect(-15, -9, 8, 18);

      // Canister fill indicator
      ctx.fillStyle = '#38bdf8';
      const fillH = Math.min(18, ps.canister * 2.5);
      ctx.fillRect(-15, 9 - fillH, 8, fillH);

      // Player circle head/body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Vacuum Nozzle
      ctx.fillStyle = '#64748b';
      ctx.fillRect(8, -4, 18, 8);
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(26, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Player Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y - 24);
    }

    // Top HUD
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(0, 0, width, 36);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ECTO VACUUM BUSTER', 16, 24);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.roundTimer < 6 ? '#ef4444' : '#f8fafc';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width - 16, 24);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} trapped the most ghosts!` : 'The mansion remains haunted!'
    };
  }
}
