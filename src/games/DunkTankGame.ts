import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface ThrownBall {
  x: number;
  y: number;
  startX: number;
  targetX: number;
  targetY: number;
  progress: number;
  playerId: PlayerId;
}

export class DunkTankGame extends BaseGame {
  private targetX: number = 0;
  private targetSpeed: number = 200;
  private targetDir: number = 1;
  private isDunked: boolean = false;
  private dunkTimer: number = 0;
  private clownYOffset: number = 0;
  private thrownBalls: ThrownBall[] = [];
  private scores: Map<PlayerId, number> = new Map();
  private cooldowns: Map<PlayerId, number> = new Map();

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, _height: number = 600): void {
    this.scores.clear();
    this.cooldowns.clear();
    this.thrownBalls = [];
    this.roundTimer = 25.0;
    this.isFinished = false;
    this.isDunked = false;
    this.dunkTimer = 0;
    this.clownYOffset = 0;
    this.targetX = width * 0.35;
    this.targetSpeed = 190;
    this.targetDir = 1;

    for (const p of this.getActivePlayers()) {
      this.scores.set(p.id, 0);
      this.cooldowns.set(p.id, 0);
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    this.updateBots(dt, width, height);

    // Target arm oscillation
    const minX = width * 0.22;
    const maxX = width * 0.48;
    this.targetX += this.targetSpeed * this.targetDir * dt;
    if (this.targetX > maxX) {
      this.targetX = maxX;
      this.targetDir = -1;
    } else if (this.targetX < minX) {
      this.targetX = minX;
      this.targetDir = 1;
    }

    // Clown dunk animation state
    if (this.isDunked) {
      this.dunkTimer -= dt;
      this.clownYOffset += dt * 300; // Falling into water
      if (this.dunkTimer <= 0) {
        this.isDunked = false;
        this.clownYOffset = 0; // Clown climbs back up
      }
    }

    // Player inputs & throws
    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      const cd = this.cooldowns.get(p.id) || 0;
      if (cd > 0) this.cooldowns.set(p.id, cd - dt);

      if (this.input.justPressed(p.id) && cd <= 0) {
        this.cooldowns.set(p.id, 0.45);
        this.audio.playWhoosh();

        const startX = (width / (count + 1)) * (idx + 1);
        const startY = height - 40;

        this.thrownBalls.push({
          x: startX,
          y: startY,
          startX,
          targetX: this.targetX,
          targetY: height * 0.38,
          progress: 0,
          playerId: p.id
        });
      }
    });

    // Update Thrown Baseballs
    for (let i = this.thrownBalls.length - 1; i >= 0; i--) {
      const ball = this.thrownBalls[i];
      ball.progress += dt * 3.0;

      const p = Math.min(1, ball.progress);
      ball.x = ball.startX + (ball.targetX - ball.startX) * p;
      ball.y = (height - 40) + (ball.targetY - (height - 40)) * p - Math.sin(p * Math.PI) * 50;

      if (ball.progress >= 1) {
        // Hit check against swinging target
        const targetY = height * 0.38;
        const dist = Math.hypot(ball.targetX - this.targetX, ball.targetY - targetY);

        if (dist < 26) {
          // Direct bullseye!
          const pts = 100;
          this.scores.set(ball.playerId, (this.scores.get(ball.playerId) || 0) + pts);
          this.audio.playTone(880, 0.15, 'triangle');
          this.particles.emit(this.targetX, targetY, 15, '#F59E0B');

          // Trigger clown dunk!
          if (!this.isDunked) {
            this.isDunked = true;
            this.dunkTimer = 1.6;
            this.clownYOffset = 0;
            this.audio.playExplosion();
            // Big water splash
            const tankCenterX = width * 0.68;
            const tankWaterY = height * 0.48;
            this.particles.emit(tankCenterX, tankWaterY, 35, '#38BDF8');
          }
        } else if (dist < 50) {
          // Outer rim graze
          this.scores.set(ball.playerId, (this.scores.get(ball.playerId) || 0) + 30);
          this.audio.playTone(440, 0.08, 'sine');
          this.particles.emit(this.targetX, targetY, 6, '#94A3B8');
        } else {
          // Missed cage
          this.audio.playTone(180, 0.05, 'square');
        }

        this.thrownBalls.splice(i, 1);
      }
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, _h: number): void {
    const cd = this.cooldowns.get(botId) || 0;
    if (cd > 0) {
      this.input.setBotInput(botId, false);
      return;
    }

    const active = this.getActivePlayers();
    const idx = active.findIndex(p => p.id === botId);
    const startX = (width / (active.length + 1)) * (idx + 1);

    // Hard bots lead the target based on target speed
    const leadDist = difficulty === 'bot_hard' ? this.targetDir * 20 : 0;
    const aimDiff = Math.abs((startX) - (this.targetX + leadDist));

    const threshold = difficulty === 'bot_hard' ? 40 : difficulty === 'bot_normal' ? 80 : 140;
    if (aimDiff <= threshold && Math.random() < 0.25) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Carnival boardwalk background
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // Wooden Tank Platform
    const tankX = width * 0.55;
    const tankW = width * 0.28;
    const tankY = height * 0.25;
    const tankH = height * 0.42;

    // Tank Frame & Cage
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(tankX, tankY, tankW, tankH);
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 4;
    ctx.strokeRect(tankX, tankY, tankW, tankH);

    // Water level (lower half of tank)
    const waterY = tankY + tankH * 0.45;
    const waterH = tankH * 0.55;
    ctx.fillStyle = 'rgba(6, 182, 212, 0.65)';
    ctx.fillRect(tankX + 4, waterY, tankW - 8, waterH - 4);

    // Cage vertical bars
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    for (let bx = tankX + 15; bx < tankX + tankW; bx += 22) {
      ctx.beginPath();
      ctx.moveTo(bx, tankY);
      ctx.lineTo(bx, waterY);
      ctx.stroke();
    }

    // Hinged Perch
    const perchY = tankY + 20;
    ctx.fillStyle = '#D97706';
    ctx.fillRect(tankX + 20, perchY, tankW - 40, 10);

    // Carnival Clown
    const clownX = tankX + tankW / 2;
    const clownBaseY = perchY - 24 + Math.min(100, this.clownYOffset);

    ctx.save();
    ctx.translate(clownX, clownBaseY);
    // Clown Hat
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(-12, -4);
    ctx.lineTo(12, -4);
    ctx.closePath();
    ctx.fill();
    // Clown Face
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(0, 4, 14, 0, Math.PI * 2);
    ctx.fill();
    // Red Nose
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(0, 4, 5, 0, Math.PI * 2);
    ctx.fill();
    // Red Bowtie
    ctx.fillStyle = '#EC4899';
    ctx.beginPath();
    ctx.moveTo(-10, 18);
    ctx.lineTo(10, 24);
    ctx.lineTo(-10, 24);
    ctx.lineTo(10, 18);
    ctx.fill();
    ctx.restore();

    // Mechanical Target Arm & Bullseye
    const armY = height * 0.38;
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(tankX, armY);
    ctx.lineTo(this.targetX, armY);
    ctx.stroke();

    // Bullseye Ring
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(this.targetX, armY, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(this.targetX, armY, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(this.targetX, armY, 9, 0, Math.PI * 2);
    ctx.fill();

    // Thrown Baseballs
    for (const b of this.thrownBalls) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Player Stations at Bottom
    const active = this.getActivePlayers();
    const count = active.length;
    active.forEach((p, idx) => {
      const px = (width / (count + 1)) * (idx + 1);
      const py = height - 35;

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py - 18, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Score
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.roundRect(px - 35, py + 2, 70, 22, 4);
      ctx.fill();
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${this.scores.get(p.id) || 0} PTS`, px, py + 17);
    });

    // Top Header
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`DUNK TANK • TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.scores.get(p.id) || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} triggered the giant carnival splash!` : 'The clown stayed dry!'
    };
  }
}
