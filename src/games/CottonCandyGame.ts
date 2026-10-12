import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CandyStick {
  spinSpeed: number; // in rad/s
  flossSize: number; // radius of puff (0 to 60)
  targetFrequency: number;
  score: number;
}

export class CottonCandyGame extends BaseGame {
  private sticks: Map<PlayerId, CandyStick> = new Map();
  private vortexAngle: number = 0;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.sticks.clear();
    this.vortexAngle = 0;
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.sticks.set(p.id, {
        spinSpeed: 0,
        flossSize: 8,
        targetFrequency: 12,
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

    this.vortexAngle += dt * 3.5;
    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const stick = this.sticks.get(p.id);
      if (!stick) continue;

      // Tap adds spin burst
      if (this.input.justPressed(p.id)) {
        stick.spinSpeed += 4.5;
        this.audio.playTone(380 + Math.min(400, stick.flossSize * 6), 0.05, 'sine');
      }

      // Spin decay due to viscous sugar drag
      stick.spinSpeed = Math.max(0, stick.spinSpeed - dt * 5.0);

      // Sweet spot frequency check
      const diff = Math.abs(stick.spinSpeed - stick.targetFrequency);
      if (diff < 3.5) {
        // Gathering sugar fluff!
        stick.flossSize += dt * 4.2;
        stick.score = Math.floor(stick.flossSize * 10);
      } else if (stick.spinSpeed > stick.targetFrequency + 6) {
        // Over-spinning flings sugar away!
        stick.flossSize = Math.max(8, stick.flossSize - dt * 2.0);
      }
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _w: number, _h: number): void {
    const stick = this.sticks.get(botId);
    if (!stick) return;

    if (difficulty === 'bot_easy') {
      if (Math.random() < 0.08) this.input.setBotInput(botId, true);
      else this.input.setBotInput(botId, false);
      return;
    }

    // Keep spin speed around target frequency
    const target = stick.targetFrequency;
    const tolerance = difficulty === 'bot_hard' ? 1.0 : 2.5;

    if (stick.spinSpeed < target - tolerance) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Carnival sweet shop backdrop
    ctx.fillStyle = '#1E1B4B';
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const count = active.length;

    // Draw Cotton Candy Drum Stations for each player
    active.forEach((p, idx) => {
      const stick = this.sticks.get(p.id);
      if (!stick) return;

      const cx = (width / (count + 1)) * (idx + 1);
      const cy = height * 0.48;

      // Stainless Steel Floss Drum
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(cx, cy, 75, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Drum interior shadow
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(cx, cy, 65, 0, Math.PI * 2);
      ctx.fill();

      // Swirling sugar strands
      ctx.strokeStyle = 'rgba(244, 114, 182, 0.4)';
      ctx.lineWidth = 2;
      for (let s = 0; s < 4; s++) {
        const a = this.vortexAngle + (s * Math.PI) / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 45, a, a + 1.2);
        ctx.stroke();
      }

      // Candy Paper Cone / Stick
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(this.vortexAngle * 2) * 0.15);

      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.moveTo(-4, -10);
      ctx.lineTo(4, -10);
      ctx.lineTo(2, 60);
      ctx.lineTo(-2, 60);
      ctx.closePath();
      ctx.fill();

      // Fluffy Cotton Candy Cloud
      const puffR = stick.flossSize;
      ctx.fillStyle = 'rgba(236, 72, 153, 0.85)';
      ctx.beginPath();
      ctx.arc(0, -10, puffR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(244, 114, 182, 0.7)';
      ctx.beginPath();
      ctx.arc(-puffR * 0.3, -10 - puffR * 0.2, puffR * 0.6, 0, Math.PI * 2);
      ctx.arc(puffR * 0.3, -10 + puffR * 0.2, puffR * 0.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Player Score Pill
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(cx - 45, cy + 95, 90, 26, 6);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.floor(stick.flossSize * 2)}cm FLUFF`, cx, cy + 112);
    });

    // Top Header
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`COTTON CANDY SPIN • TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.sticks.get(p.id)?.score || 0,
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} spun the most gigantic sugary cloud!` : 'The sugar drum spun silent!'
    };
  }
}
