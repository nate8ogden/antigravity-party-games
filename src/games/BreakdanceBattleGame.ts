import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface DancerState {
  score: number;
  froze: boolean;
  stumbled: boolean;
}

export class BreakdanceBattleGame extends BaseGame {
  private dancers: Map<PlayerId, DancerState> = new Map();
  private strobeTimer: number = 0;
  private flashActive: boolean = false;
  private flashDuration: number = 0;
  private cycleCount: number = 1;
  private readonly MAX_CYCLES = 4;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.dancers.clear();
    this.strobeTimer = 2.0;
    this.flashActive = false;
    this.flashDuration = 0;
    this.cycleCount = 1;
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.dancers.set(p.id, {
        score: 0,
        froze: false,
        stumbled: false
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

    if (!this.flashActive) {
      this.strobeTimer -= dt;
      if (this.strobeTimer <= 0) {
        // TRIGGER STROBE FLASH!
        this.flashActive = true;
        this.flashDuration = 0.55;
        this.audio.playTone(880, 0.15, 'sawtooth');
      }
    } else {
      this.flashDuration -= dt;

      // Check player freezes during flash
      for (const p of this.getActivePlayers()) {
        const d = this.dancers.get(p.id);
        if (!d || d.froze || d.stumbled) continue;

        if (this.input.justPressed(p.id)) {
          d.froze = true;
          d.score += 20;
          this.audio.playTone(1100, 0.1, 'sine');
          const center = this.getDancerCenter(this.getActivePlayers().indexOf(p), width, height);
          this.particles.emit(center.x, center.y, 14, '#FBBF24');
        }
      }

      if (this.flashDuration <= 0) {
        this.flashActive = false;
        // Anyone who failed to freeze stumbles
        for (const p of this.getActivePlayers()) {
          const d = this.dancers.get(p.id);
          if (d && !d.froze) {
            d.stumbled = true;
            d.score = Math.max(0, d.score - 5);
          }
        }

        this.cycleCount++;
        if (this.cycleCount > this.MAX_CYCLES) {
          this.isFinished = true;
        } else {
          this.strobeTimer = 2.2 + Math.random() * 0.8;
          for (const d of this.dancers.values()) {
            d.froze = false;
            d.stumbled = false;
          }
        }
      }
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, _height: number): void {
    if (!this.flashActive) return;

    const d = this.dancers.get(botId);
    if (!d || d.froze || d.stumbled) return;

    const chance = difficulty === 'bot_hard' ? 0.95 : difficulty === 'bot_normal' ? 0.75 : 0.5;
    if (Math.random() < chance) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  private getDancerCenter(index: number, width: number, height: number): { x: number; y: number } {
    const positions = [
      { x: width * 0.28, y: height * 0.35 },
      { x: width * 0.72, y: height * 0.35 },
      { x: width * 0.28, y: height * 0.75 },
      { x: width * 0.72, y: height * 0.75 }
    ];
    return positions[index] || positions[0];
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = this.flashActive ? '#312E81' : '#0F172A';
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const d = this.dancers.get(p.id);
      if (!d) continue;
      const pos = this.getDancerCenter(i, width, height);

      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Cardboard dance cypher ring
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(0, 0, 65, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Dancer avatar
      if (d.froze) {
        // Freeze pose (one handstand)
        ctx.fillStyle = p.color;
        ctx.fillRect(-10, -28, 20, 36);
        ctx.fillStyle = '#FBBF24';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('FREEZE!', 0, -36);
      } else if (d.stumbled) {
        // Stumbled flat
        ctx.fillStyle = '#64748B';
        ctx.fillRect(-22, 10, 44, 12);
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('STUMBLE', 0, -10);
      } else {
        // Spinning windmill
        ctx.save();
        ctx.rotate(Date.now() * 0.012);
        ctx.fillStyle = p.color;
        ctx.fillRect(-15, -15, 30, 30);
        ctx.restore();
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${d.score}`, 0, 52);

      ctx.restore();
    }

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      this.flashActive ? 'FREEZE ON THE FLASH!' : `BREAKDANCE: ROUND ${this.cycleCount} / ${this.MAX_CYCLES}`,
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
        score: this.dancers.get(p.id)?.score || 0,
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} hit the freeze pose with supreme b-boy swagger!` : 'The cardboard cypher cleared out!'
    };
  }
}
