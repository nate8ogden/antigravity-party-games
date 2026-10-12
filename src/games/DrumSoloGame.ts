import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface DrumStation {
  beatProgress: number; // 0 to 1
  beatSpeed: number;
  streak: number;
  score: number;
  missTimer: number;
}

export class DrumSoloGame extends BaseGame {
  private stations: Map<PlayerId, DrumStation> = new Map();

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.stations.clear();
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.stations.set(p.id, {
        beatProgress: 0,
        beatSpeed: 1.25, // ~130 BPM
        streak: 0,
        score: 0,
        missTimer: 0
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
      const station = this.stations.get(p.id);
      if (!station) continue;

      if (station.missTimer > 0) {
        station.missTimer -= dt;
      }

      station.beatProgress += station.beatSpeed * dt;
      if (station.beatProgress >= 1.0) {
        station.beatProgress -= 1.0;
      }

      if (this.input.justPressed(p.id)) {
        if (station.missTimer > 0) continue;

        // Perfect beat target is around 0.0 / 1.0
        const distToBeat = Math.min(station.beatProgress, 1.0 - station.beatProgress);

        if (distToBeat < 0.12) {
          // PERFECT BEAT!
          station.streak++;
          const pts = 10 + Math.min(20, station.streak * 2);
          station.score += pts;
          this.audio.playTone(180, 0.1, 'triangle'); // Kick drum
          this.audio.playTone(450, 0.05, 'sawtooth'); // Snare crack
          const center = this.getStationCenter(this.getActivePlayers().indexOf(p), width, height);
          this.particles.emit(center.x, center.y, 14, '#F59E0B');
        } else if (distToBeat < 0.22) {
          // OK BEAT
          station.score += 5;
          this.audio.playTone(320, 0.06, 'triangle');
        } else {
          // MISS
          station.streak = 0;
          station.missTimer = 0.5;
          this.audio.playTone(120, 0.15, 'sawtooth');
        }
      }
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, _height: number): void {
    const station = this.stations.get(botId);
    if (!station || station.missTimer > 0) return;

    const distToBeat = Math.min(station.beatProgress, 1.0 - station.beatProgress);
    const margin = difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.10 : 0.18;

    if (distToBeat <= margin) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  private getStationCenter(index: number, width: number, height: number): { x: number; y: number } {
    const positions = [
      { x: width * 0.28, y: height * 0.35 },
      { x: width * 0.72, y: height * 0.35 },
      { x: width * 0.28, y: height * 0.75 },
      { x: width * 0.72, y: height * 0.75 }
    ];
    return positions[index] || positions[0];
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Stage lights background
    ctx.fillStyle = '#18181B';
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const station = this.stations.get(p.id);
      if (!station) continue;
      const pos = this.getStationCenter(i, width, height);

      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Drum Head Base (Snare drum)
      ctx.fillStyle = '#27272A';
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Target Rim (Sweet spot)
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 35, 0, Math.PI * 2);
      ctx.stroke();

      // Shrinking Beat Ring
      const ringRadius = 35 + (1 - station.beatProgress) * 45;
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Drumsticks crossed
      ctx.strokeStyle = '#D4D4D8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-20, -20);
      ctx.lineTo(20, 20);
      ctx.moveTo(20, -20);
      ctx.lineTo(-20, 20);
      ctx.stroke();

      if (station.missTimer > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('MISSED BEAT!', 0, 52);
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${p.name}: ${station.score}`, 0, 52);
        if (station.streak >= 3) {
          ctx.fillStyle = '#FBBF24';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText(`BEAT x${station.streak}`, 0, 68);
        }
      }

      ctx.restore();
    }

    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`DRUM SOLO DUEL: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.stations.get(p.id)?.score || 0,
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} hammered out the ultimate drum solo!` : 'The percussion rhythm settled into a draw!'
    };
  }
}
