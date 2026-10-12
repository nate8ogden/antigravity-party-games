import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SugarStrand {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  points: number;
  radius: number;
}

interface ConePlayer {
  id: PlayerId;
  angle: number;
  spinDir: number;
  candySize: number; // 0 to 1
  combo: number;
  burnCooldown: number;
  score: number;
}

export class CottonCandySpinGame extends BaseGame {
  private strands: SugarStrand[] = [];
  private playersState: Map<PlayerId, ConePlayer> = new Map();
  private drumCenterX: number = 0;
  private drumCenterY: number = 0;
  private drumRadius: number = 140;
  private spawnTimer: number = 0;

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
    this.strands = [];
    this.playersState.clear();
    this.drumCenterX = width / 2;
    this.drumCenterY = height * 0.48;
    this.drumRadius = Math.min(160, width * 0.28);
    this.spawnTimer = 0;

    const active = this.getActivePlayers();
    const count = active.length;
    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        angle: (idx / count) * Math.PI * 2,
        spinDir: 1,
        candySize: 0.1,
        combo: 0,
        burnCooldown: 0,
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Spawn centrifugal sugar strands from center heating coil
    this.spawnTimer += dt;
    if (this.spawnTimer > 0.08) {
      this.spawnTimer = 0;
      const a = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 90;
      const colors = ['#F472B6', '#38BDF8', '#C084FC', '#FBBF24'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.strands.push({
        x: this.drumCenterX,
        y: this.drumCenterY,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        color,
        points: color === '#FBBF24' ? 25 : 10,
        radius: 6
      });
    }

    // Update sugar strands
    for (let i = this.strands.length - 1; i >= 0; i--) {
      const s = this.strands[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Check collision with drum walls
      if (Math.hypot(s.x - this.drumCenterX, s.y - this.drumCenterY) > this.drumRadius) {
        this.strands.splice(i, 1);
      }
    }

    // Update players rotating their paper cones along the drum perimeter
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.burnCooldown > 0) ps.burnCooldown -= dt;

      // Handle input: tapping reverses spin direction or steers
      const steer = this.input.getSteer(p.id);
      if (Math.abs(steer) > 0.2) {
        ps.spinDir = Math.sign(steer);
      } else if (this.input.justPressed(p.id) || this.input.justAction(p.id)) {
        ps.spinDir *= -1; // Tap reverses spin
      }

      const spinSpeed = 2.4;
      ps.angle += ps.spinDir * spinSpeed * dt;

      const coneX = this.drumCenterX + Math.cos(ps.angle) * (this.drumRadius * 0.78);
      const coneY = this.drumCenterY + Math.sin(ps.angle) * (this.drumRadius * 0.78);

      // Catch sugar strands
      for (let i = this.strands.length - 1; i >= 0; i--) {
        const s = this.strands[i];
        if (Math.hypot(s.x - coneX, s.y - coneY) < 18 + ps.candySize * 16) {
          ps.combo++;
          ps.candySize = Math.min(1.0, ps.candySize + 0.04);
          const awarded = s.points * (1 + Math.floor(ps.combo / 5));
          ps.score += awarded;

          this.audio.playLaser();
          this.particles.spawnConfetti(s.x, s.y, 6);
          this.strands.splice(i, 1);
        }
      }

      // If candy gets to max size, cash out bonus!
      if (ps.candySize >= 1.0) {
        ps.score += 50;
        ps.candySize = 0.15;
        this.audio.playFanfare();
        this.particles.showFloatingText('GIANT CLOUD! +50', coneX, coneY - 24, '#EC4899', 24);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Fairground Sweet Shop Backdrop
    ctx.fillStyle = '#1E1B4B';
    ctx.fillRect(0, 0, width, height);

    // 2. Cotton Candy Machine Metallic Bowl
    ctx.save();
    ctx.translate(this.drumCenterX, this.drumCenterY);

    // Outer stainless steel bowl rim
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(0, 0, this.drumRadius + 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Inner pink glowing bowl
    const bowlGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, this.drumRadius);
    bowlGrad.addColorStop(0, '#581C87');
    bowlGrad.addColorStop(0.7, '#3B0764');
    bowlGrad.addColorStop(1, '#180226');
    ctx.fillStyle = bowlGrad;
    ctx.beginPath();
    ctx.arc(0, 0, this.drumRadius, 0, Math.PI * 2);
    ctx.fill();

    // Center spinning heating element
    ctx.fillStyle = '#EF4444';
    ctx.shadowColor = '#F87171';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Draw Sugar Strands
    for (const s of this.strands) {
      ctx.save();
      ctx.fillStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Draw Player Cones with Growing Cotton Candy Puffs
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      const coneX = this.drumCenterX + Math.cos(ps.angle) * (this.drumRadius * 0.78);
      const coneY = this.drumCenterY + Math.sin(ps.angle) * (this.drumRadius * 0.78);

      ctx.save();
      ctx.translate(coneX, coneY);

      // Fluffy cotton candy puff cloud
      const puffR = 12 + ps.candySize * 22;
      const puffGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, puffR);
      puffGrad.addColorStop(0, '#FFFFFF');
      puffGrad.addColorStop(0.5, p.color);
      puffGrad.addColorStop(1, 'rgba(244, 114, 182, 0.4)');
      ctx.fillStyle = puffGrad;
      ctx.beginPath();
      ctx.arc(0, -puffR * 0.5, puffR, 0, Math.PI * 2);
      ctx.fill();

      // Paper Cone (White / Blue striped)
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 24);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();

      // Floating score badge
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, coneX, coneY + 34);
    }

    // 5. Header HUD
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
    const ps = this.playersState.get(botId);
    if (!ps) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false, ps.spinDir, 0, false);
      return;
    }

    // Look for sugar strands heading toward cone
    let nearestStrand: SugarStrand | null = null;
    let minDist = 999;
    const coneX = this.drumCenterX + Math.cos(ps.angle) * (this.drumRadius * 0.78);
    const coneY = this.drumCenterY + Math.sin(ps.angle) * (this.drumRadius * 0.78);

    for (const s of this.strands) {
      const d = Math.hypot(s.x - coneX, s.y - coneY);
      if (d < minDist) {
        minDist = d;
        nearestStrand = s;
      }
    }

    if (nearestStrand) {
      const strandAngle = Math.atan2(nearestStrand.y - this.drumCenterY, nearestStrand.x - this.drumCenterX);
      let angleDiff = strandAngle - ps.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      const deadzone = difficulty === 'bot_easy' ? 0.35 : difficulty === 'bot_normal' ? 0.18 : 0.05;
      if (Math.abs(angleDiff) > deadzone) {
        const desiredDir = Math.sign(angleDiff) || 1;
        if (desiredDir !== ps.spinDir) {
          this.input.setBotInput(botId, true, desiredDir, 0, true);
        } else {
          this.input.setBotInput(botId, false, desiredDir, 0, false);
        }
      } else {
        this.input.setBotInput(botId, false, ps.spinDir, 0, false);
      }
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
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} spun the giant cotton candy clouds!` : 'No cotton candy spun!'
    };
  }
}
