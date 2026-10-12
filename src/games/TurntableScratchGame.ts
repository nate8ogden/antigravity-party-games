import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface TurntableState {
  vinylAngle: number;
  scratching: boolean;
  cueAngle: number;
  cueActive: boolean;
  cueTimer: number;
  score: number;
}

export class TurntableScratchGame extends BaseGame {
  private turntables: Map<PlayerId, TurntableState> = new Map();

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.turntables.clear();
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.turntables.set(p.id, {
        vinylAngle: 0,
        scratching: false,
        cueAngle: Math.random() * Math.PI * 2,
        cueActive: true,
        cueTimer: 1.5,
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

    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const tt = this.turntables.get(p.id);
      if (!tt) continue;

      const isPressed = this.input.isPressed(p.id);
      const justPressed = this.input.justPressed(p.id);
      tt.scratching = isPressed;

      if (isPressed) {
        // Scratch vinyl back and forth
        tt.vinylAngle += (Math.sin(Date.now() * 0.015) * 400 * Math.PI / 180) * dt;
        if (Math.random() < 0.25) {
          this.audio.playTone(320 + Math.random() * 200, 0.04, 'sawtooth');
        }
      } else {
        // Normal 33 RPM spin
        tt.vinylAngle += 3.5 * dt;
      }

      // Cue timer
      tt.cueTimer -= dt;
      if (tt.cueTimer <= 0) {
        tt.cueTimer = 1.2 + Math.random() * 0.8;
        tt.cueAngle = Math.random() * Math.PI * 2;
        tt.cueActive = true;
      }

      // Just pressed: check scratch match with cue
      if (justPressed && tt.cueActive) {
        let normVinyl = tt.vinylAngle % (Math.PI * 2);
        if (normVinyl < 0) normVinyl += Math.PI * 2;
        let diff = Math.abs(normVinyl - tt.cueAngle);
        while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

        if (diff < 0.5) {
          tt.cueActive = false;
          tt.score += 15;
          this.audio.playTone(660, 0.08, 'sine');
        }
      }
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, _height: number): void {
    const tt = this.turntables.get(botId);
    if (!tt || !tt.cueActive) return;

    let normVinyl = tt.vinylAngle % (Math.PI * 2);
    if (normVinyl < 0) normVinyl += Math.PI * 2;
    let diff = Math.abs(normVinyl - tt.cueAngle);
    while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

    const margin = difficulty === 'bot_hard' ? 0.35 : difficulty === 'bot_normal' ? 0.45 : 0.6;
    if (diff <= margin) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  private getTurntableCenter(index: number, width: number, height: number): { x: number; y: number } {
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

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const tt = this.turntables.get(p.id);
      if (!tt) continue;
      const pos = this.getTurntableCenter(i, width, height);

      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Deck Body
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-75, -75, 150, 150);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(-75, -75, 150, 150);

      // Vinyl Record
      ctx.fillStyle = '#09090B';
      ctx.beginPath();
      ctx.arc(0, 0, 55, 0, Math.PI * 2);
      ctx.fill();

      // Grooves
      ctx.strokeStyle = '#27272A';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 42, 0, Math.PI * 2);
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.stroke();

      // Record Center Label
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();

      // Tonearm needle
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(50, -60);
      ctx.lineTo(25, -10);
      ctx.stroke();

      // Vinyl indicator marker
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(tt.vinylAngle) * 50, Math.sin(tt.vinylAngle) * 50);
      ctx.stroke();

      // Cue Target
      if (tt.cueActive) {
        ctx.fillStyle = '#EC4899';
        ctx.beginPath();
        ctx.arc(Math.cos(tt.cueAngle) * 50, Math.sin(tt.cueAngle) * 50, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${tt.score}`, 0, 62);

      ctx.restore();
    }

    ctx.fillStyle = '#EC4899';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TURNTABLE SCRATCH: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.turntables.get(p.id)?.score || 0,
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} scratched and mixed like a master DJ!` : 'The turntable needle skidded across the vinyl!'
    };
  }
}
