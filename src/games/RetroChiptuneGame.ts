import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface ChiptuneState {
  currentStep: number; // 0 to 3
  stepTimer: number;
  targetStep: number;
  score: number;
}

export class RetroChiptuneGame extends BaseGame {
  private chips: Map<PlayerId, ChiptuneState> = new Map();
  private readonly NOTE_FREQS = [220, 330, 440, 660];

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.chips.clear();
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.chips.set(p.id, {
        currentStep: 0,
        stepTimer: 0.25,
        targetStep: Math.floor(Math.random() * 4),
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
      const chip = this.chips.get(p.id);
      if (!chip) continue;

      chip.stepTimer -= dt;
      if (chip.stepTimer <= 0) {
        chip.stepTimer = 0.25;
        chip.currentStep = (chip.currentStep + 1) % 4;
        if (Math.random() < 0.2) {
          this.audio.playTone(this.NOTE_FREQS[chip.currentStep], 0.04, 'square');
        }
      }

      if (this.input.justPressed(p.id)) {
        if (chip.currentStep === chip.targetStep) {
          // Arpeggio matched!
          chip.score += 15;
          chip.targetStep = Math.floor(Math.random() * 4);
          this.audio.playTone(this.NOTE_FREQS[chip.currentStep] * 1.5, 0.08, 'square');
          const center = this.getChipCenter(this.getActivePlayers().indexOf(p), width, height);
          this.particles.emit(center.x, center.y, 10, '#A3E635');
        } else {
          chip.score = Math.max(0, chip.score - 5);
          this.audio.playTone(110, 0.1, 'sawtooth');
        }
      }
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, _height: number): void {
    const chip = this.chips.get(botId);
    if (!chip) return;

    if (chip.currentStep === chip.targetStep) {
      const chance = difficulty === 'bot_hard' ? 0.95 : difficulty === 'bot_normal' ? 0.75 : 0.5;
      if (Math.random() < chance) {
        this.input.setBotInput(botId, true);
      }
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  private getChipCenter(index: number, width: number, height: number): { x: number; y: number } {
    const positions = [
      { x: width * 0.28, y: height * 0.35 },
      { x: width * 0.72, y: height * 0.35 },
      { x: width * 0.28, y: height * 0.75 },
      { x: width * 0.72, y: height * 0.75 }
    ];
    return positions[index] || positions[0];
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#14532D'; // Game Boy green tint
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const chip = this.chips.get(p.id);
      if (!chip) continue;
      const pos = this.getChipCenter(i, width, height);

      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Sound Chip Cartridge
      ctx.fillStyle = '#064E3B';
      ctx.fillRect(-70, -70, 140, 140);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(-70, -70, 140, 140);

      // 4 Note Arpeggio Steps
      const stepNames = ['LOW', 'MID', 'HIGH', 'ULTRA'];
      for (let s = 0; s < 4; s++) {
        const sx = -45 + s * 30;
        const isCurrent = s === chip.currentStep;
        const isTarget = s === chip.targetStep;

        ctx.fillStyle = isCurrent ? '#A3E635' : isTarget ? '#FBBF24' : '#047857';
        ctx.fillRect(sx - 12, -25, 24, 50);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx - 12, -25, 24, 50);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(stepNames[s][0], sx, 35);
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${chip.score}`, 0, 56);

      ctx.restore();
    }

    ctx.fillStyle = '#A3E635';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`CHIPTUNE ARPEGGIO: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.chips.get(p.id)?.score || 0,
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} synced 8-bit sound chip frequencies!` : 'The 8-bit arpeggios faded out!'
    };
  }
}
