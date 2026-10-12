import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface BeatNote {
  id: number;
  lane: number;
  y: number;
  speed: number;
  hit: boolean;
  frequency: number;
}

export class SynthwaveHighwayGame extends BaseGame {
  private scores: Map<PlayerId, number> = new Map();
  private streaks: Map<PlayerId, number> = new Map();
  private beatNotes: BeatNote[] = [];
  private spawnTimer: number = 0;
  private nextNoteId: number = 1;

  private readonly FREQUENCIES = [261.63, 329.63, 392.00, 523.25]; // C, E, G, C

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.scores.clear();
    this.streaks.clear();
    this.beatNotes = [];
    this.spawnTimer = 0.4;
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.scores.set(p.id, 0);
      this.streaks.set(p.id, 0);
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

    const hitLineY = height - 70;
    const active = this.getActivePlayers();

    // Spawn rhythmic beat notes
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.42 + Math.random() * 0.28;
      for (let i = 0; i < active.length; i++) {
        if (Math.random() < 0.8) {
          this.beatNotes.push({
            id: this.nextNoteId++,
            lane: i,
            y: 40,
            speed: 280 + Math.random() * 40,
            hit: false,
            frequency: this.FREQUENCIES[i % this.FREQUENCIES.length]
          });
        }
      }
    }

    // Move notes
    for (const note of this.beatNotes) {
      if (note.hit) continue;
      note.y += note.speed * dt;

      // Note missed off screen
      if (note.y > height) {
        note.hit = true;
        const p = active[note.lane];
        if (p) {
          this.streaks.set(p.id, 0);
        }
      }
    }

    // Check player taps
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      if (this.input.justPressed(p.id)) {
        // Find closest note in this player's lane
        const note = this.beatNotes.find(n => !n.hit && n.lane === i && Math.abs(n.y - hitLineY) < 55);

        if (note) {
          note.hit = true;
          const diff = Math.abs(note.y - hitLineY);
          let pts = 0;

          if (diff < 16) {
            // PERFECT!
            pts = 15;
            this.particles.emit(this.getLaneCenterX(i, width, active.length), hitLineY, 14, '#F43F5E');
            this.audio.playTone(note.frequency, 0.12, 'sawtooth');
          } else {
            // GOOD!
            pts = 8;
            this.particles.emit(this.getLaneCenterX(i, width, active.length), hitLineY, 8, '#38BDF8');
            this.audio.playTone(note.frequency * 0.8, 0.08, 'triangle');
          }

          const streak = (this.streaks.get(p.id) || 0) + 1;
          this.streaks.set(p.id, streak);
          const streakBonus = Math.min(10, Math.floor(streak / 5) * 2);
          this.scores.set(p.id, (this.scores.get(p.id) || 0) + pts + streakBonus);
        } else {
          // Empty tap miss
          this.audio.playTone(160, 0.04, 'sawtooth');
        }
      }
    }

    this.beatNotes = this.beatNotes.filter(n => !n.hit && n.y <= height);
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, height: number): void {
    const active = this.getActivePlayers();
    const lane = active.findIndex(p => p.id === botId);
    if (lane === -1) return;

    const hitLineY = height - 70;
    const note = this.beatNotes.find(n => !n.hit && n.lane === lane && Math.abs(n.y - hitLineY) < 30);

    if (note) {
      const margin = difficulty === 'bot_hard' ? 8 : difficulty === 'bot_normal' ? 16 : 24;
      if (Math.abs(note.y - hitLineY) <= margin) {
        this.input.setBotInput(botId, true);
      } else {
        this.input.setBotInput(botId, false);
      }
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  private getLaneCenterX(index: number, width: number, total: number): number {
    const laneWidth = width / Math.max(1, total);
    return laneWidth * index + laneWidth / 2;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 80s Synthwave grid sunset
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#1E1B4B');
    sky.addColorStop(0.5, '#4C1D95');
    sky.addColorStop(1, '#831843');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const laneWidth = width / Math.max(1, active.length);
    const hitLineY = height - 70;

    // Highway track lanes
    for (let i = 0; i < active.length; i++) {
      const lx = i * laneWidth;
      ctx.strokeStyle = '#F43F5E';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, height);
      ctx.stroke();
    }

    // Glowing Target Hit Line
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, hitLineY);
    ctx.lineTo(width, hitLineY);
    ctx.stroke();

    // Draw Falling Notes
    for (const note of this.beatNotes) {
      if (note.hit) continue;
      const nx = this.getLaneCenterX(note.lane, width, active.length);

      ctx.fillStyle = '#FB7185';
      ctx.fillRect(nx - 24, note.y - 10, 48, 20);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(nx - 24, note.y - 10, 48, 20);
    }

    // Hit targets and player avatars
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const cx = this.getLaneCenterX(i, width, active.length);
      const streak = this.streaks.get(p.id) || 0;

      // Hit Target Pad
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(cx, hitLineY, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Score & streak
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${this.scores.get(p.id) || 0}`, cx, 28);
      if (streak >= 3) {
        ctx.fillStyle = '#FBBF24';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`STREAK x${streak}`, cx, 44);
      }
    }

    ctx.fillStyle = '#F472B6';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`SYNTHWAVE HIGHWAY: ${Math.ceil(this.roundTimer)}s`, width / 2, height - 15);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.scores.get(p.id) || 0,
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} tapped out synthetic perfection!` : 'The synthwave sunset faded into purple twilight!'
    };
  }
}
