import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface PlayerReflexState {
  score: number;
  tapped: boolean;
  falseStart: boolean;
  reactionTime: number | null;
}

export class RattlesnakeReflexGame extends BaseGame {
  private playerStates: Map<PlayerId, PlayerReflexState> = new Map();
  private currentSubRound: number = 1;
  private readonly MAX_ROUNDS = 3;
  private phase: 'waiting' | 'strike' | 'round_over' = 'waiting';
  private strikeTimer: number = 0;
  private strikeStartTime: number = 0;
  private phaseTimer: number = 0;
  private rattleToneTimer: number = 0;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.playerStates.clear();
    this.currentSubRound = 1;
    this.isFinished = false;
    this.roundTimer = 25.0;

    for (const p of this.getActivePlayers()) {
      this.playerStates.set(p.id, {
        score: 0,
        tapped: false,
        falseStart: false,
        reactionTime: null
      });
    }

    this.startWaitingPhase();
  }

  private startWaitingPhase(): void {
    this.phase = 'waiting';
    this.strikeTimer = 2.0 + Math.random() * 2.8;
    this.rattleToneTimer = 0.2;

    for (const p of this.getActivePlayers()) {
      const s = this.playerStates.get(p.id);
      if (s) {
        s.tapped = false;
        s.falseStart = false;
        s.reactionTime = null;
      }
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.updateBots(dt, width, height);

    if (this.phase === 'waiting') {
      this.strikeTimer -= dt;

      this.rattleToneTimer -= dt;
      if (this.rattleToneTimer <= 0) {
        this.rattleToneTimer = 0.15 + Math.random() * 0.1;
        this.audio.playTone(850, 0.03, 'sine');
      }

      for (const p of this.getActivePlayers()) {
        const s = this.playerStates.get(p.id);
        if (!s || s.falseStart) continue;

        if (this.input.justPressed(p.id)) {
          s.falseStart = true;
          s.score = Math.max(0, s.score - 10);
          this.audio.playTone(160, 0.2, 'sawtooth');
          this.particles.emit(width / 2, height / 2, 10, '#EF4444');
        }
      }

      if (this.strikeTimer <= 0) {
        this.phase = 'strike';
        this.strikeStartTime = Date.now();
        this.phaseTimer = 1.8;
        this.audio.playTone(1200, 0.25, 'sawtooth');
      }
    } else if (this.phase === 'strike') {
      this.phaseTimer -= dt;

      const elapsedMs = Date.now() - this.strikeStartTime;

      for (const p of this.getActivePlayers()) {
        const s = this.playerStates.get(p.id);
        if (!s || s.tapped || s.falseStart) continue;

        if (this.input.justPressed(p.id)) {
          s.tapped = true;
          s.reactionTime = elapsedMs;

          const tapOrder = Array.from(this.playerStates.values()).filter(x => x.tapped).length;
          const pts = tapOrder === 1 ? 25 : tapOrder === 2 ? 15 : 10;
          s.score += pts;
          this.audio.playTone(700 + pts * 10, 0.1, 'sine');
          this.particles.emit(width / 2, height / 2, 8, '#FBBF24');
        }
      }

      if (this.phaseTimer <= 0) {
        this.phase = 'round_over';
        this.phaseTimer = 1.2;
      }
    } else if (this.phase === 'round_over') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.currentSubRound++;
        if (this.currentSubRound > this.MAX_ROUNDS) {
          this.isFinished = true;
        } else {
          this.startWaitingPhase();
        }
      }
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, _height: number): void {
    if (this.phase !== 'strike') return;

    const elapsedMs = Date.now() - this.strikeStartTime;
    const s = this.playerStates.get(botId);
    if (!s || s.tapped || s.falseStart) return;

    const targetReaction = difficulty === 'bot_hard' ? 180 : difficulty === 'bot_normal' ? 320 : 480;
    if (elapsedMs >= targetReaction) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#431407';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.arc(cx, cy, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.strokeStyle = '#15803D';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, 50, 0, Math.PI * 1.8);
    ctx.stroke();

    ctx.strokeStyle = '#166534';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0.4, Math.PI * 1.9);
    ctx.stroke();

    ctx.save();
    ctx.translate(cx + 10, cy - 10);
    if (this.phase === 'strike') {
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.ellipse(0, -25, 14, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -45);
      ctx.lineTo(-5, -55);
      ctx.moveTo(0, -45);
      ctx.lineTo(5, -55);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#14532D';
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 16, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FBBF24';
      ctx.fillRect(-6, -6, 3, 3);
      ctx.fillRect(3, -6, 3, 3);
    }
    ctx.restore();

    if (this.phase === 'strike') {
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STRIKE NOW!', cx, cy + 120);
    } else if (this.phase === 'waiting') {
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WAIT FOR IT... (RATTLE)', cx, cy + 120);
    } else {
      ctx.fillStyle = '#22C55E';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ROUND OVER', cx, cy + 120);
    }

    const corners = [
      { x: 90, y: 50 },
      { x: width - 90, y: 50 },
      { x: 90, y: height - 50 },
      { x: width - 90, y: height - 50 }
    ];

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const pos = corners[i] || corners[0];
      const s = this.playerStates.get(p.id);
      if (!s) continue;

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${s.score}`, pos.x, pos.y + 30);

      if (s.falseStart) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('BITTEN! (-10)', pos.x, pos.y - 24);
      } else if (s.tapped && s.reactionTime) {
        ctx.fillStyle = '#22C55E';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${s.reactionTime}ms`, pos.x, pos.y - 24);
      }
    }

    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`RATTLESNAKE REFLEX - ROUND ${Math.min(this.MAX_ROUNDS, this.currentSubRound)} / ${this.MAX_ROUNDS}`, cx, 28);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.playerStates.get(p.id)?.score || 0,
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} had lightning snake-charmer reflexes!` : 'The rattlesnake claimed all contenders!'
    };
  }
}
