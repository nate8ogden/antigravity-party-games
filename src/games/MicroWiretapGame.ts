import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface WiretapDesk {
  noiseLevel: number;
  noiseDir: number;
  turnsCompleted: number;
  bugsPlanted: number;
  alarmStun: number;
  score: number;
}

export class MicroWiretapGame extends BaseGame {
  private desks: Map<PlayerId, WiretapDesk> = new Map();

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.desks.clear();
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.desks.set(p.id, {
        noiseLevel: Math.random() * 0.5,
        noiseDir: 1,
        turnsCompleted: 0,
        bugsPlanted: 0,
        alarmStun: 0,
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
      const desk = this.desks.get(p.id);
      if (!desk) continue;

      if (desk.alarmStun > 0) {
        desk.alarmStun -= dt;
        continue;
      }

      // Noise meter oscillates 0 to 1
      desk.noiseLevel += desk.noiseDir * 2.2 * dt;
      if (desk.noiseLevel > 1.0) {
        desk.noiseLevel = 1.0;
        desk.noiseDir = -1;
      } else if (desk.noiseLevel < 0.0) {
        desk.noiseLevel = 0.0;
        desk.noiseDir = 1;
      }

      // Tap to tighten screw
      if (this.input.justPressed(p.id)) {
        // Silent zone is < 0.35
        if (desk.noiseLevel < 0.38) {
          desk.turnsCompleted++;
          this.audio.playTone(600 + desk.turnsCompleted * 60, 0.05, 'sine');

          if (desk.turnsCompleted >= 4) {
            desk.turnsCompleted = 0;
            desk.bugsPlanted++;
            desk.score += 20;
            this.audio.playTone(1050, 0.15, 'sine');
          }
        } else {
          // CLATTER! Made too much noise
          desk.alarmStun = 1.2;
          desk.score = Math.max(0, desk.score - 5);
          this.audio.playTone(160, 0.2, 'sawtooth');
        }
      }
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, _height: number): void {
    const desk = this.desks.get(botId);
    if (!desk || desk.alarmStun > 0) return;

    const threshold = difficulty === 'bot_hard' ? 0.32 : difficulty === 'bot_normal' ? 0.36 : 0.42;
    if (desk.noiseLevel <= threshold && desk.noiseDir < 0) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  private getDeskPos(index: number, width: number, height: number): { x: number; y: number } {
    const positions = [
      { x: width * 0.28, y: height * 0.35 },
      { x: width * 0.72, y: height * 0.35 },
      { x: width * 0.28, y: height * 0.75 },
      { x: width * 0.72, y: height * 0.75 }
    ];
    return positions[index] || positions[0];
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#18181B';
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const desk = this.desks.get(p.id);
      if (!desk) continue;
      const pos = this.getDeskPos(i, width, height);

      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Desk Box
      ctx.fillStyle = '#27272A';
      ctx.fillRect(-70, -70, 140, 140);
      ctx.strokeStyle = desk.alarmStun > 0 ? '#EF4444' : p.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(-70, -70, 140, 140);

      // Microphone Bug icon
      ctx.fillStyle = '#71717A';
      ctx.beginPath();
      ctx.arc(0, -18, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Screw turns progress ring
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -18, 22, 0, (desk.turnsCompleted / 4) * Math.PI * 2);
      ctx.stroke();

      // Decibel Noise Meter
      ctx.fillStyle = '#3F3F46';
      ctx.fillRect(-50, 20, 100, 12);
      // Silent green zone
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(-50, 20, 35, 12);
      // Danger red zone
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-15, 20, 65, 12);

      // Noise needle
      const needleX = -50 + desk.noiseLevel * 100;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(needleX - 2, 16, 4, 20);

      if (desk.alarmStun > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('NOISE DETECTED!', 0, 52);
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`BUGS: ${desk.bugsPlanted} (${desk.score} pts)`, 0, 52);
      }

      ctx.restore();
    }

    ctx.fillStyle = '#A7F3D0';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`MICRO WIRETAP: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.desks.get(p.id)?.score || 0,
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} planted covert microphones without a whisper!` : 'The embassy security swept the room clean!'
    };
  }
}
