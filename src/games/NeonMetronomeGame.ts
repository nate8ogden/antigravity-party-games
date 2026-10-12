import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface MetronomeState {
  lastTapTime: number;
  tapCount: number;
  score: number;
  lastDelta: number | null;
}

export class NeonMetronomeGame extends BaseGame {
  private metroStates: Map<PlayerId, MetronomeState> = new Map();
  private elapsedSongTime: number = 0;
  private readonly TARGET_INTERVAL = 0.5; // 120 BPM = 500ms

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.metroStates.clear();
    this.elapsedSongTime = 0;
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.metroStates.set(p.id, {
        lastTapTime: 0,
        tapCount: 0,
        score: 0,
        lastDelta: null
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

    this.elapsedSongTime += dt;
    this.updateBots(dt, width, height);

    // Audio cues for the first 4 beats (0s to 2s)
    const beatIndex = Math.floor(this.elapsedSongTime / this.TARGET_INTERVAL);
    if (beatIndex < 4 && Math.abs(this.elapsedSongTime - beatIndex * this.TARGET_INTERVAL) < dt) {
      this.audio.playTone(880, 0.04, 'sine');
    }

    const active = this.getActivePlayers();
    for (const p of active) {
      const state = this.metroStates.get(p.id);
      if (!state) continue;

      if (this.input.justPressed(p.id)) {
        const now = this.elapsedSongTime;
        if (state.lastTapTime > 0) {
          const delta = now - state.lastTapTime;
          state.lastDelta = delta;
          const error = Math.abs(delta - this.TARGET_INTERVAL);

          if (error < 0.04) {
            // PERFECT 120 BPM
            state.score += 15;
            this.audio.playTone(660, 0.05, 'sine');
          } else if (error < 0.09) {
            // CLOSE
            state.score += 8;
            this.audio.playTone(520, 0.05, 'triangle');
          } else {
            // RUSHED OR DRAGGED
            this.audio.playTone(220, 0.05, 'sawtooth');
          }
        }

        state.lastTapTime = now;
        state.tapCount++;

        if (state.tapCount >= 14) {
          this.isFinished = true;
        }
      }
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, _height: number): void {
    const state = this.metroStates.get(botId);
    if (!state) return;

    const noise = difficulty === 'bot_hard' ? (Math.random() - 0.5) * 0.03 : difficulty === 'bot_normal' ? (Math.random() - 0.5) * 0.07 : (Math.random() - 0.5) * 0.14;
    const interval = this.TARGET_INTERVAL + noise;

    if (state.lastTapTime === 0) {
      if (this.elapsedSongTime >= 2.0) {
        this.input.setBotInput(botId, true);
      }
    } else if (this.elapsedSongTime - state.lastTapTime >= interval) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  private getMetroCenter(index: number, width: number, height: number): { x: number; y: number } {
    const positions = [
      { x: width * 0.28, y: height * 0.35 },
      { x: width * 0.72, y: height * 0.35 },
      { x: width * 0.28, y: height * 0.75 },
      { x: width * 0.72, y: height * 0.75 }
    ];
    return positions[index] || positions[0];
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    const isCalibration = this.elapsedSongTime < 2.0;

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const state = this.metroStates.get(p.id);
      if (!state) continue;
      const pos = this.getMetroCenter(i, width, height);

      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Metronome Pyramid
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.moveTo(-40, 50);
      ctx.lineTo(40, 50);
      ctx.lineTo(15, -50);
      ctx.lineTo(-15, -50);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Pendulum arm (visible only during calibration, blind afterwards)
      if (isCalibration) {
        const swing = Math.sin((this.elapsedSongTime / this.TARGET_INTERVAL) * Math.PI) * 0.6;
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, 30);
        ctx.lineTo(Math.sin(swing) * 60, 30 - Math.cos(swing) * 60);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('BLIND CLOCK', 0, 0);
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${state.score}`, 0, 68);

      if (state.lastDelta !== null) {
        ctx.fillStyle = '#38BDF8';
        ctx.font = '10px monospace';
        ctx.fillText(`${Math.round(state.lastDelta * 1000)}ms`, 0, 82);
      }

      ctx.restore();
    }

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      isCalibration ? 'LISTEN & WATCH: 120 BPM CALIBRATION' : 'KEEP THE 120 BPM TEMPO (BLIND)!',
      width / 2,
      28
    );
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.metroStates.get(p.id)?.score || 0,
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} maintained a clockwork 120 BPM internal rhythm!` : 'The metronome pendulums fell silent!'
    };
  }
}
