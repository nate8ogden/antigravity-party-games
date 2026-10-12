import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SoilClump {
  x: number;
  y: number;
  radius: number;
  type: 'MOSS' | 'SOIL';
}

interface BeetlePlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  ballRadius: number; // starts at 14, grows up to 36
  score: number;
}

export class DungBeetleRollGame extends BaseGame {
  private playersState: Map<PlayerId, BeetlePlayer> = new Map();
  private clumps: SoilClump[] = [];
  private goalX: number = 0;
  private goalY: number = 0;

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
    this.clumps = [];
    this.playersState.clear();

    this.goalX = width / 2;
    this.goalY = 60;

    // Spawn 14 soil & moss clumps
    this.spawnClumps(width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height - 60,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        ballRadius: 14,
        score: 0
      });
    });
  }

  private spawnClumps(width: number, height: number): void {
    for (let i = 0; i < 14; i++) {
      this.clumps.push({
        x: 40 + Math.random() * (width - 80),
        y: 110 + Math.random() * (height - 180),
        radius: 8 + Math.random() * 6,
        type: i % 2 === 0 ? 'MOSS' : 'SOIL'
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    const beetleList = Array.from(this.playersState.values());

    for (const b of beetleList) {
      const steerX = this.input.getSteer(b.id);
      const steerY = -this.input.getThrottle(b.id);
      const mag = Math.hypot(steerX, steerY);

      if (mag > 0.2) {
        b.angle = Math.atan2(steerY, steerX);
        const maxSpd = Math.max(140, 240 - (b.ballRadius - 14) * 3);
        b.vx += (steerX / mag) * maxSpd * dt * 4;
        b.vy += (steerY / mag) * maxSpd * dt * 4;
      }

      b.vx *= Math.pow(0.12, dt);
      b.vy *= Math.pow(0.12, dt);

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      b.x = Math.max(b.ballRadius + 20, Math.min(width - b.ballRadius - 20, b.x));
      b.y = Math.max(b.ballRadius + 20, Math.min(height - b.ballRadius - 20, b.y));

      // Gather soil clumps to grow ball
      for (let i = this.clumps.length - 1; i >= 0; i--) {
        const c = this.clumps[i];
        if (Math.hypot(b.x - c.x, b.y - c.y) < b.ballRadius + c.radius) {
          b.ballRadius = Math.min(36, b.ballRadius + 2.2);
          b.score += c.type === 'MOSS' ? 15 : 10;
          this.audio.playBounce();
          this.particles.spawnDust(c.x, c.y, 4);
          this.clumps.splice(i, 1);
        }
      }

      // Check deposit into compost goal
      if (b.ballRadius > 18 && Math.hypot(b.x - this.goalX, b.y - this.goalY) < 48) {
        const bonus = Math.floor((b.ballRadius - 14) * 4);
        b.score += bonus;
        this.audio.playScore();
        this.particles.showFloatingText(`COMPOST GOAL! +${bonus}`, this.goalX, this.goalY - 20, '#10B981', 24);
        this.particles.spawnConfetti(this.goalX, this.goalY, 14);
        b.ballRadius = 14;
      }
    }

    // Beetle vs Beetle collisions
    for (let i = 0; i < beetleList.length; i++) {
      for (let j = i + 1; j < beetleList.length; j++) {
        const b1 = beetleList[i];
        const b2 = beetleList[j];
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = b1.ballRadius + b2.ballRadius + 10;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          b1.x -= nx * 10;
          b1.y -= ny * 10;
          b2.x += nx * 10;
          b2.y += ny * 10;

          // Bigger ball knocks smaller ball
          if (b1.ballRadius > b2.ballRadius + 4) {
            b1.score += 20;
            b2.ballRadius = Math.max(14, b2.ballRadius - 3);
            this.audio.playExplosion();
            this.particles.showFloatingText('BUMP! +20', b1.x, b1.y - 20, '#FBBF24', 20);
          } else if (b2.ballRadius > b1.ballRadius + 4) {
            b2.score += 20;
            b1.ballRadius = Math.max(14, b1.ballRadius - 3);
            this.audio.playExplosion();
            this.particles.showFloatingText('BUMP! +20', b2.x, b2.y - 20, '#FBBF24', 20);
          } else {
            this.audio.playBounce();
          }
        }
      }
    }

    // Respawn clumps if low
    if (this.clumps.length < 5) {
      this.spawnClumps(width, height);
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Garden Soil & Compost Yard
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#15803D'); // Top hedge
    bgGrad.addColorStop(0.2, '#78350F'); // Soil
    bgGrad.addColorStop(0.8, '#451A03'); // Soil
    bgGrad.addColorStop(1, '#1C1917'); // Bottom border
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Compost Bin Scoring Goal at Top
    ctx.save();
    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.arc(this.goalX, this.goalY, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#22C55E';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 9px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('COMPOST GOAL', this.goalX, this.goalY + 4);
    ctx.restore();

    // 3. Draw Soil Clumps & Moss Balls
    for (const c of this.clumps) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = c.type === 'MOSS' ? '#65A30D' : '#92400E';
      ctx.beginPath();
      ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = c.type === 'MOSS' ? '#84CC16' : '#78350F';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Draw Dung Beetles & Their Rolling Mud Balls
    for (const p of this.getActivePlayers()) {
      const b = this.playersState.get(p.id);
      if (!b) continue;

      // Draw Rolling Spherical Soil Ball in front of beetle
      ctx.save();
      const ballX = b.x + Math.cos(b.angle) * (b.ballRadius + 8);
      const ballY = b.y + Math.sin(b.angle) * (b.ballRadius + 8);

      // Ball shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(ballX, ballY + 4, b.ballRadius, b.ballRadius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Textured spherical soil ball
      const ballGrad = ctx.createRadialGradient(ballX - 4, ballY - 4, 3, ballX, ballY, b.ballRadius);
      ballGrad.addColorStop(0, '#B45309');
      ballGrad.addColorStop(0.7, '#78350F');
      ballGrad.addColorStop(1, '#451A03');
      ctx.fillStyle = ballGrad;
      ctx.beginPath();
      ctx.arc(ballX, ballY, b.ballRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Moss specks on ball
      ctx.fillStyle = '#65A30D';
      ctx.beginPath();
      ctx.arc(ballX - b.ballRadius * 0.3, ballY - b.ballRadius * 0.2, 3, 0, Math.PI * 2);
      ctx.arc(ballX + b.ballRadius * 0.4, ballY + b.ballRadius * 0.1, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw Armored Scarab Beetle behind ball
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);

      // Beetle Legs pushing forward
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i += 0.8) {
        ctx.beginPath();
        ctx.moveTo(0, i * 6);
        ctx.lineTo(12, i * 11);
        ctx.stroke();
      }

      // Armored Carapace Body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(-4, 0, 12, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Horned Head
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(10, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      // Pushing Horns
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(12, -3);
      ctx.lineTo(18, -6);
      ctx.moveTo(12, 3);
      ctx.lineTo(18, 6);
      ctx.stroke();
      ctx.restore();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${b.score}`, b.x, b.y - 24);
    }

    // 5. Header HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const b = this.playersState.get(botId);
    if (!b) return;

    // If ball is huge (> 28), steer towards compost goal!
    let targetX = this.goalX;
    let targetY = this.goalY;

    if (b.ballRadius < 28) {
      // Find nearest soil clump
      let minDist = 9999;
      let targetClump: SoilClump | null = null;
      for (const c of this.clumps) {
        const d = Math.hypot(c.x - b.x, c.y - b.y);
        if (d < minDist) {
          minDist = d;
          targetClump = c;
        }
      }
      if (targetClump) {
        targetX = targetClump.x;
        targetY = targetClump.y;
      }
    }

    const dx = targetX - b.x;
    const dy = targetY - b.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 10) {
      const err = difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.2 : 0.45;
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * err;
      this.input.setBotInput(botId, true, Math.cos(angle), -Math.sin(angle), true);
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public getScore(playerId: PlayerId): number {
    return this.playersState.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, b]) => ({ playerId, score: b.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} rolled the most colossal compost mud balls!` : 'Tied beetle rolling!'
    };
  }
}
