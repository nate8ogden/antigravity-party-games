import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface EqualizerPlayer {
  currentBar: number; // 0 to 6
  jumpProgress: number; // 0 (on bar) to 1 (landing)
  jumping: boolean;
  score: number;
}

export class EqualizerBounceGame extends BaseGame {
  private eqPlayers: Map<PlayerId, EqualizerPlayer> = new Map();
  private barHeights: number[] = new Array(7).fill(0.5);
  private barFrequencies: number[] = [120, 240, 480, 960, 1920, 3840, 7680];
  private songTimer: number = 0;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.eqPlayers.clear();
    this.songTimer = 0;
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.eqPlayers.set(p.id, {
        currentBar: 0,
        jumpProgress: 0,
        jumping: false,
        score: 0
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

    this.songTimer += dt;
    this.updateBots(dt, width, height);

    // Oscillate 7 equalizer bars
    for (let b = 0; b < 7; b++) {
      this.barHeights[b] = 0.2 + Math.abs(Math.sin(this.songTimer * (2.5 + b * 0.7) + b)) * 0.7;
    }

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const eq = this.eqPlayers.get(p.id);
      if (!eq) continue;

      if (eq.jumping) {
        eq.jumpProgress += 3.5 * dt;
        if (eq.jumpProgress >= 1.0) {
          eq.jumping = false;
          eq.jumpProgress = 0;
          eq.currentBar = (eq.currentBar + 1) % 7;

          // Check height of landing bar
          const hLanding = this.barHeights[eq.currentBar];
          if (hLanding > 0.5) {
            // Peak bounce!
            eq.score += 15;
            this.audio.playTone(this.barFrequencies[eq.currentBar] * 0.5, 0.08, 'sawtooth');
            const bx = this.getBarX(eq.currentBar, width);
            const by = height - 100 - hLanding * 220;
            this.particles.emit(bx, by, 10, '#38BDF8');
          } else {
            // Low landing
            eq.score += 5;
            this.audio.playTone(200, 0.05, 'triangle');
          }
        }
      } else if (this.input.justPressed(p.id)) {
        eq.jumping = true;
        eq.jumpProgress = 0;
        this.audio.playTone(450, 0.04, 'sine');
      }
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, _height: number): void {
    const eq = this.eqPlayers.get(botId);
    if (!eq || eq.jumping) return;

    const nextBar = (eq.currentBar + 1) % 7;
    const nextHeight = this.barHeights[nextBar];

    const threshold = difficulty === 'bot_hard' ? 0.65 : difficulty === 'bot_normal' ? 0.50 : 0.35;
    if (nextHeight >= threshold) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  private getBarX(barIndex: number, width: number): number {
    const barSpacing = (width - 120) / 7;
    return 60 + barIndex * barSpacing + barSpacing / 2;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#09090B';
    ctx.fillRect(0, 0, width, height);

    const barSpacing = (width - 120) / 7;
    const barWidth = barSpacing * 0.75;
    const baseY = height - 100;

    // Draw Equalizer Bars
    for (let b = 0; b < 7; b++) {
      const bx = this.getBarX(b, width);
      const bh = this.barHeights[b] * 220;

      // Equalizer bar gradient
      const grad = ctx.createLinearGradient(0, baseY, 0, baseY - bh);
      grad.addColorStop(0, '#22C55E');
      grad.addColorStop(0.6, '#F59E0B');
      grad.addColorStop(1, '#EF4444');
      ctx.fillStyle = grad;
      ctx.fillRect(bx - barWidth / 2, baseY - bh, barWidth, bh);

      // Frequency label
      ctx.fillStyle = '#71717A';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${this.barFrequencies[b]}Hz`, bx, baseY + 20);
    }

    // Draw Players
    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const eq = this.eqPlayers.get(p.id);
      if (!eq) continue;

      let px = this.getBarX(eq.currentBar, width);
      let py = baseY - this.barHeights[eq.currentBar] * 220 - 15;

      if (eq.jumping) {
        const nextBar = (eq.currentBar + 1) % 7;
        const targetX = this.getBarX(nextBar, width);
        px += (targetX - px) * eq.jumpProgress;
        py -= Math.sin(eq.jumpProgress * Math.PI) * 45; // parabolic jump arc
      }

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${eq.score}`, px, py - 20);
    }

    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`EQUALIZER BOUNCE: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.eqPlayers.get(p.id)?.score || 0,
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} surfed the equalizer spectrum frequencies!` : 'The equalizer bars leveled off!'
    };
  }
}
