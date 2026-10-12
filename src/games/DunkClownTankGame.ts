import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Softball {
  playerId: PlayerId;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
}

interface Pitcher {
  id: PlayerId;
  aimX: number;
  aimDir: number;
  cooldown: number;
  score: number;
}

export class DunkClownTankGame extends BaseGame {
  private balls: Softball[] = [];
  private pitchers: Map<PlayerId, Pitcher> = new Map();
  private targetX: number = 0;
  private targetY: number = 0;
  private targetDir: number = 1;
  private clownDunked: boolean = false;
  private clownRespawnTimer: number = 0;
  private tankX: number = 0;
  private tankY: number = 0;

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
    this.balls = [];
    this.pitchers.clear();

    this.tankX = width * 0.42;
    this.tankY = height * 0.38;
    this.targetX = width * 0.62;
    this.targetY = height * 0.35;
    this.targetDir = 1;
    this.clownDunked = false;
    this.clownRespawnTimer = 0;

    const active = this.getActivePlayers();
    const count = active.length;
    const zoneW = width / count;

    active.forEach((p, idx) => {
      this.pitchers.set(p.id, {
        id: p.id,
        aimX: zoneW * idx + zoneW / 2,
        aimDir: idx % 2 === 0 ? 1 : -1,
        cooldown: 0,
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Oscillate bullseye target
    this.targetX += this.targetDir * dt * 140;
    const minTargetX = width * 0.52;
    const maxTargetX = width * 0.76;
    if (this.targetX > maxTargetX) {
      this.targetX = maxTargetX;
      this.targetDir = -1;
    } else if (this.targetX < minTargetX) {
      this.targetX = minTargetX;
      this.targetDir = 1;
    }

    // Clown dunk respawn timer
    if (this.clownDunked) {
      this.clownRespawnTimer -= dt;
      if (this.clownRespawnTimer <= 0) {
        this.clownDunked = false;
      }
    }

    const active = this.getActivePlayers();
    const count = active.length;
    const zoneW = width / count;

    for (let idx = 0; idx < count; idx++) {
      const p = active[idx];
      const pitcher = this.pitchers.get(p.id);
      if (!pitcher) continue;

      if (pitcher.cooldown > 0) pitcher.cooldown -= dt;

      // Sweep pitcher crosshair
      pitcher.aimX += pitcher.aimDir * dt * 190;
      const minX = zoneW * idx + 25;
      const maxX = zoneW * (idx + 1) - 25;
      if (pitcher.aimX > maxX) {
        pitcher.aimX = maxX;
        pitcher.aimDir = -1;
      } else if (pitcher.aimX < minX) {
        pitcher.aimX = minX;
        pitcher.aimDir = 1;
      }

      // Throw ball
      const throwAction = this.input.justPressed(p.id);
      if (throwAction && pitcher.cooldown <= 0) {
        pitcher.cooldown = 0.65; // Anti-spam delay
        this.throwBall(p.id, p.color, pitcher.aimX, height - 50);
      }
    }

    // Update flying softballs
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Hit Bullseye Target!
      if (!this.clownDunked && Math.hypot(b.x - this.targetX, b.y - this.targetY) < 22) {
        this.clownDunked = true;
        this.clownRespawnTimer = 2.0;

        const pitcher = this.pitchers.get(b.playerId);
        if (pitcher) pitcher.score += 50;

        this.audio.playExplosion();
        this.particles.shake(0.4);
        this.particles.showFloatingText('DUNKED!! +50', this.tankX, this.tankY - 40, '#38BDF8', 26);
        this.particles.spawnExplosion(this.tankX, this.tankY + 20, '#38BDF8', 24);
        this.balls.splice(i, 1);
        continue;
      }

      if (b.y < 30 || b.y > height + 20) {
        this.balls.splice(i, 1);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private throwBall(pid: PlayerId, color: string, startX: number, startY: number): void {
    const targetY = this.targetY;
    const dy = targetY - startY;
    const dx = this.targetX - startX;
    const speed = 640;
    const angle = Math.atan2(dy, dx);

    this.balls.push({
      playerId: pid,
      color,
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alive: true
    });

    this.audio.playLaser();
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Carnival Midway Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1E1B4B');
    bgGrad.addColorStop(0.5, '#2E1065');
    bgGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Dunk Tank Structure
    ctx.save();
    // Glass water tank
    ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.fillRect(this.tankX - 45, this.tankY, 90, 80);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.strokeRect(this.tankX - 45, this.tankY, 90, 80);

    // Water level bubbles
    ctx.fillStyle = '#E0F2FE';
    ctx.beginPath();
    ctx.arc(this.tankX - 20, this.tankY + 25, 4, 0, Math.PI * 2);
    ctx.arc(this.tankX + 15, this.tankY + 50, 5, 0, Math.PI * 2);
    ctx.fill();

    // Trapdoor perch plank
    ctx.fillStyle = '#78350F';
    ctx.fillRect(this.tankX - 40, this.tankY - 14, 80, 14);

    // Clown Mascot (or Splash in water)
    if (this.clownDunked) {
      // Splash droplets
      ctx.fillStyle = '#38BDF8';
      ctx.font = '900 18px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('* SPLASH! *', this.tankX, this.tankY + 45);
    } else {
      // Seated Clown on perch
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(this.tankX, this.tankY - 32, 16, 0, Math.PI * 2);
      ctx.fill();
      // Red Clown Nose
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(this.tankX, this.tankY - 30, 6, 0, Math.PI * 2);
      ctx.fill();
      // Clown hat
      ctx.fillStyle = '#8B5CF6';
      ctx.beginPath();
      ctx.moveTo(this.tankX - 12, this.tankY - 44);
      ctx.lineTo(this.tankX + 12, this.tankY - 44);
      ctx.lineTo(this.tankX, this.tankY - 65);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Draw Mechanical Bullseye Target
    // Connecting steel hinge arm
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(this.tankX + 40, this.tankY - 7);
    ctx.lineTo(this.targetX, this.targetY);
    ctx.stroke();

    // Bullseye Circles
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(this.targetX, this.targetY, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(this.targetX, this.targetY, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(this.targetX, this.targetY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 4. Draw Flying Balls
    for (const b of this.balls) {
      ctx.save();
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // 5. Draw Pitcher Stations
    const active = this.getActivePlayers();
    const count = active.length;
    const zoneW = width / count;

    active.forEach((p, idx) => {
      const pitcher = this.pitchers.get(p.id);
      if (!pitcher) return;
      const zoneCenterX = zoneW * idx + zoneW / 2;
      const stationY = height - 50;

      // Platform
      ctx.fillStyle = '#334155';
      ctx.fillRect(zoneCenterX - zoneW * 0.44, stationY, zoneW * 0.88, 44);
      ctx.fillStyle = p.color;
      ctx.fillRect(zoneCenterX - zoneW * 0.44, stationY, zoneW * 0.88, 4);

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      const status = pitcher.cooldown > 0 ? 'RELOADING...' : 'READY TO THROW';
      ctx.fillText(`${p.name}: ${pitcher.score}`, zoneCenterX, stationY + 20);
      ctx.font = '700 9px monospace';
      ctx.fillStyle = pitcher.cooldown > 0 ? '#F59E0B' : '#10B981';
      ctx.fillText(status, zoneCenterX, stationY + 34);

      // Crosshair Reticle
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(pitcher.aimX, stationY - 24, 11, 0, Math.PI * 2);
      ctx.moveTo(pitcher.aimX - 16, stationY - 24);
      ctx.lineTo(pitcher.aimX + 16, stationY - 24);
      ctx.stroke();
      ctx.restore();
    });

    // 6. Header HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 35);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const pitcher = this.pitchers.get(botId);
    if (!pitcher || pitcher.cooldown > 0 || this.clownDunked) return;

    // Line up with targetX
    const tol = difficulty === 'bot_hard' ? 16 : difficulty === 'bot_normal' ? 30 : 50;
    if (Math.abs(pitcher.aimX - this.targetX) < tol) {
      this.input.setBotInput(botId, true, 0, 0, true);
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public getScore(playerId: PlayerId): number {
    return this.pitchers.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.pitchers.entries())
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} dunked the clown into the splash tank!` : 'The clown remained dry!'
    };
  }
}
