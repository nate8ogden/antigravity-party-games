import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SingerState {
  pitchY: number; // 0 (high) to 1 (low)
  score: number;
  inTune: boolean;
}

export class VocalPitchGame extends BaseGame {
  private singers: Map<PlayerId, SingerState> = new Map();
  private songTime: number = 0;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.singers.clear();
    this.songTime = 0;
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.singers.set(p.id, {
        pitchY: 0.5,
        score: 0,
        inTune: false
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

    this.songTime += dt;
    this.updateBots(dt, width, height);

    // Target pitch contour at current time
    const targetPitch = 0.5 + Math.sin(this.songTime * 2.2) * 0.35;

    for (const p of this.getActivePlayers()) {
      const singer = this.singers.get(p.id);
      if (!singer) continue;

      const isPressed = this.input.isPressed(p.id);

      // Holding raises pitch (lower pitchY), releasing lowers pitch (higher pitchY)
      if (isPressed) {
        singer.pitchY = Math.max(0.1, singer.pitchY - 0.7 * dt);
      } else {
        singer.pitchY = Math.min(0.9, singer.pitchY + 0.7 * dt);
      }

      const diff = Math.abs(singer.pitchY - targetPitch);
      if (diff < 0.12) {
        singer.inTune = true;
        singer.score += dt * 15;
        if (Math.random() < 0.2) {
          const freq = 300 + (1 - singer.pitchY) * 400;
          this.audio.playTone(freq, 0.05, 'sine');
        }
      } else {
        singer.inTune = false;
      }
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, _height: number): void {
    const singer = this.singers.get(botId);
    if (!singer) return;

    const targetPitch = 0.5 + Math.sin(this.songTime * 2.2) * 0.35;
    const diff = singer.pitchY - targetPitch; // > 0 means singer is too low (needs to go up -> press)

    const deadband = difficulty === 'bot_hard' ? 0.02 : difficulty === 'bot_normal' ? 0.06 : 0.12;

    if (diff > deadband) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const laneHeight = (height - 80) / Math.max(1, active.length);

    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const singer = this.singers.get(p.id);
      if (!singer) continue;

      const laneY = 50 + i * laneHeight;

      // Track border
      ctx.fillStyle = '#1F2937';
      ctx.fillRect(20, laneY, width - 40, laneHeight * 0.9);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(20, laneY, width - 40, laneHeight * 0.9);

      // Target Pitch Wave
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let x = 30; x < width - 30; x += 10) {
        const t = this.songTime + (x - width * 0.3) * 0.005;
        const waveNorm = 0.5 + Math.sin(t * 2.2) * 0.35;
        const wy = laneY + waveNorm * laneHeight * 0.85;
        if (x === 30) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();

      // Player Pitch Dot at X = width * 0.3
      const dotX = width * 0.3;
      const dotY = laneY + singer.pitchY * laneHeight * 0.85;

      ctx.fillStyle = singer.inTune ? '#FBBF24' : p.color;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${p.name}: ${Math.floor(singer.score)} pts`, 30, laneY + 20);
    }

    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`VOCAL PITCH HARMONY: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: Math.floor(this.singers.get(p.id)?.score || 0),
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} hit every pitch contour in flawless tune!` : 'The karaoke microphones turned off!'
    };
  }
}
