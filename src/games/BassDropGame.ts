import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface DropCycle {
  crescendo: number; // 0 to 1
  crescendoSpeed: number;
  dropped: boolean;
  score: number;
}

export class BassDropGame extends BaseGame {
  private drops: Map<PlayerId, DropCycle> = new Map();
  private cycleCount: number = 0;
  private readonly MAX_CYCLES = 4;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.drops.clear();
    this.cycleCount = 1;
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.drops.set(p.id, {
        crescendo: 0,
        crescendoSpeed: 0.28 + Math.random() * 0.05,
        dropped: false,
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

    let allCycled = true;

    for (const p of this.getActivePlayers()) {
      const drop = this.drops.get(p.id);
      if (!drop) continue;

      if (!drop.dropped) {
        drop.crescendo += drop.crescendoSpeed * dt;

        // Subwoofer pitch riser
        if (Math.random() < 0.2) {
          this.audio.playTone(120 + drop.crescendo * 400, 0.05, 'triangle');
        }

        if (this.input.justPressed(p.id)) {
          drop.dropped = true;
          const diff = Math.abs(1.0 - drop.crescendo);

          if (diff < 0.08) {
            // MAXIMUM BASS DROP!
            drop.score += 30;
            this.audio.playTone(60, 0.4, 'sawtooth');
            this.particles.emit(width / 2, height / 2, 25, '#8B5CF6');
          } else if (diff < 0.2) {
            // DECENT DROP
            drop.score += 15;
            this.audio.playTone(100, 0.25, 'triangle');
          } else {
            // PREMATURE DROP
            drop.score += 5;
            this.audio.playTone(200, 0.1, 'sine');
          }
        } else if (drop.crescendo >= 1.15) {
          // Late drop miss
          drop.dropped = true;
          this.audio.playTone(120, 0.15, 'sawtooth');
        } else {
          allCycled = false;
        }
      }
    }

    // Advance to next crescendo cycle if all dropped
    if (allCycled) {
      this.cycleCount++;
      if (this.cycleCount > this.MAX_CYCLES) {
        this.isFinished = true;
      } else {
        for (const p of this.getActivePlayers()) {
          const drop = this.drops.get(p.id);
          if (drop) {
            drop.crescendo = 0;
            drop.crescendoSpeed = 0.3 + Math.random() * 0.06;
            drop.dropped = false;
          }
        }
      }
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, _height: number): void {
    const drop = this.drops.get(botId);
    if (!drop || drop.dropped) return;

    const target = 1.0;
    const diff = Math.abs(drop.crescendo - target);
    const margin = difficulty === 'bot_hard' ? 0.04 : difficulty === 'bot_normal' ? 0.09 : 0.18;

    if (diff <= margin) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  private getSubwooferCenter(index: number, width: number, height: number): { x: number; y: number } {
    const positions = [
      { x: width * 0.28, y: height * 0.35 },
      { x: width * 0.72, y: height * 0.35 },
      { x: width * 0.28, y: height * 0.75 },
      { x: width * 0.72, y: height * 0.75 }
    ];
    return positions[index] || positions[0];
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Stadium Concert Arena
    ctx.fillStyle = '#09090B';
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const drop = this.drops.get(p.id);
      if (!drop) continue;
      const pos = this.getSubwooferCenter(i, width, height);

      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Subwoofer Cabinet
      ctx.fillStyle = '#18181B';
      ctx.fillRect(-70, -70, 140, 140);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(-70, -70, 140, 140);

      // Subwoofer Speaker Cone
      const coneScale = 1.0 + Math.min(1.0, drop.crescendo) * 0.2;
      ctx.fillStyle = '#27272A';
      ctx.beginPath();
      ctx.arc(0, 0, 48 * coneScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8B5CF6';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Crescendo Meter
      ctx.fillStyle = '#3F3F46';
      ctx.fillRect(-50, 45, 100, 12);
      const fillW = Math.min(100, drop.crescendo * 100);
      ctx.fillStyle = drop.crescendo > 0.9 && drop.crescendo < 1.05 ? '#EF4444' : '#8B5CF6';
      ctx.fillRect(-50, 45, fillW, 12);

      // Peak Drop Line
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(50, 41);
      ctx.lineTo(50, 61);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${drop.score}`, 0, -48);

      ctx.restore();
    }

    ctx.fillStyle = '#8B5CF6';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`BASS DROP: CYCLE ${Math.min(this.MAX_CYCLES, this.cycleCount)} / ${this.MAX_CYCLES}`, width / 2, 28);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.drops.get(p.id)?.score || 0,
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} detonated the heaviest bass drop!` : 'The festival bass faded into silence!'
    };
  }
}
