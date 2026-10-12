import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface StrikerState {
  powerMeter: number; // 0 to 1
  meterSpeed: number;
  meterDir: number;
  puckHeight: number; // 0 to 1
  puckVelocity: number;
  bellRang: boolean;
  score: number;
  swingsLeft: number;
  swingCooldown: number;
}

export class TestStrengthGame extends BaseGame {
  private strikers: Map<PlayerId, StrikerState> = new Map();

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.strikers.clear();
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.strikers.set(p.id, {
        powerMeter: 0,
        meterSpeed: 2.2 + Math.random() * 0.4,
        meterDir: 1,
        puckHeight: 0,
        puckVelocity: 0,
        bellRang: false,
        score: 0,
        swingsLeft: 4,
        swingCooldown: 0
      });
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

    let allDone = true;
    for (const p of this.getActivePlayers()) {
      const s = this.strikers.get(p.id);
      if (!s) continue;

      if (s.swingsLeft > 0) allDone = false;

      // Update Power Meter Oscillation
      s.powerMeter += s.meterSpeed * s.meterDir * dt;
      if (s.powerMeter > 1) {
        s.powerMeter = 1;
        s.meterDir = -1;
      } else if (s.powerMeter < 0) {
        s.powerMeter = 0;
        s.meterDir = 1;
      }

      if (s.swingCooldown > 0) s.swingCooldown -= dt;

      // Handle Hammer Swing
      if (this.input.justPressed(p.id) && s.swingsLeft > 0 && s.swingCooldown <= 0) {
        s.swingsLeft--;
        s.swingCooldown = 1.2;
        const power = s.powerMeter;
        s.puckVelocity = power * 3.8;
        this.audio.playExplosion();

        const pts = Math.floor(power * 250);
        s.score += pts;
      }

      // Physics on launched puck
      if (s.puckVelocity > 0 || s.puckHeight > 0) {
        s.puckHeight += s.puckVelocity * dt;
        s.puckVelocity -= dt * 4.5; // Gravity

        if (s.puckHeight >= 1.0) {
          s.puckHeight = 1.0;
          s.puckVelocity = -0.5;
          if (!s.bellRang) {
            s.bellRang = true;
            s.score += 500; // BELL BONUS!
            this.audio.playChime();
            this.audio.playFanfare();
            const active = this.getActivePlayers();
            const idx = active.findIndex(pl => pl.id === p.id);
            const cx = (width / (active.length + 1)) * (idx + 1);
            this.particles.emit(cx, height * 0.2, 30, '#FACC15');
          }
        }

        if (s.puckHeight < 0) {
          s.puckHeight = 0;
          s.puckVelocity = 0;
          s.bellRang = false;
        }
      }
    }

    if (allDone) {
      this.isFinished = true;
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _w: number, _h: number): void {
    const s = this.strikers.get(botId);
    if (!s || s.swingsLeft <= 0 || s.swingCooldown > 0) {
      this.input.setBotInput(botId, false);
      return;
    }

    const targetPower = difficulty === 'bot_hard' ? 0.94 : difficulty === 'bot_normal' ? 0.82 : 0.6;
    const diff = Math.abs(s.powerMeter - targetPower);

    if (diff < 0.08 && s.meterDir > 0) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Carnival fairground night background
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      const s = this.strikers.get(p.id);
      if (!s) return;

      const cx = (width / (count + 1)) * (idx + 1);
      const towerTopY = height * 0.2;
      const towerBaseY = height * 0.72;
      const towerH = towerBaseY - towerTopY;

      // Tower Wooden Frame
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(cx - 16, towerTopY, 32, towerH);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - 16, towerTopY, 32, towerH);

      // Height hash marks
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      for (let hy = towerTopY + 20; hy < towerBaseY; hy += 24) {
        ctx.beginPath();
        ctx.moveTo(cx - 12, hy);
        ctx.lineTo(cx - 4, hy);
        ctx.moveTo(cx + 4, hy);
        ctx.lineTo(cx + 12, hy);
        ctx.stroke();
      }

      // Guide rail
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, towerTopY);
      ctx.lineTo(cx, towerBaseY);
      ctx.stroke();

      // Top Brass Bell
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(cx, towerTopY - 14, 18, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#FCD34D';
      ctx.fillRect(cx - 20, towerTopY - 14, 40, 6);

      // Launched Metal Puck
      const puckY = towerBaseY - s.puckHeight * towerH;
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.roundRect(cx - 12, puckY - 6, 24, 12, 3);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Anvil Launch Pad at Base
      ctx.fillStyle = '#64748B';
      ctx.beginPath();
      ctx.roundRect(cx - 28, towerBaseY, 56, 18, 4);
      ctx.fill();

      // Sledgehammer (decorative angle)
      ctx.save();
      ctx.translate(cx + 25, towerBaseY + 5);
      ctx.rotate(s.swingCooldown > 0.8 ? -0.7 : 0.3);
      ctx.fillStyle = '#78350F';
      ctx.fillRect(-2, -35, 4, 40);
      ctx.fillStyle = '#94A3B8';
      ctx.beginPath();
      ctx.roundRect(-10, -42, 20, 12, 2);
      ctx.fill();
      ctx.restore();

      // Power Meter Bar (horizontal below anvil)
      const barY = height * 0.82;
      const barW = 80;
      ctx.fillStyle = '#020617';
      ctx.fillRect(cx - barW / 2, barY, barW, 12);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - barW / 2, barY, barW, 12);

      // Meter fill
      const meterGrad = ctx.createLinearGradient(cx - barW / 2, 0, cx + barW / 2, 0);
      meterGrad.addColorStop(0, '#22C55E');
      meterGrad.addColorStop(0.7, '#F59E0B');
      meterGrad.addColorStop(1, '#EF4444');
      ctx.fillStyle = meterGrad;
      ctx.fillRect(cx - barW / 2 + 1, barY + 1, (barW - 2) * s.powerMeter, 10);

      // Score and Swings Remaining
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.roundRect(cx - 45, height - 38, 90, 26, 6);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${s.score} PTS (${s.swingsLeft} left)`, cx, height - 21);
    });

    // Top Header
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TEST YOUR STRENGTH • TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.strikers.get(p.id)?.score || 0,
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} hammered the high-striker bell with maximum power!` : 'The sledgehammer rested on the anvil!'
    };
  }
}
