import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface BullState {
  balance: number;
  tiltTarget: number;
  tiltForce: number;
  changeTimer: number;
  alive: boolean;
  score: number;
}

export class RodeoBullGame extends BaseGame {
  private bulls: Map<PlayerId, BullState> = new Map();

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.bulls.clear();
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.bulls.set(p.id, {
        balance: 0,
        tiltTarget: (Math.random() - 0.5) * 80,
        tiltForce: 50,
        changeTimer: 0.8 + Math.random() * 0.6,
        alive: true,
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

    const active = this.getActivePlayers();
    let aliveCount = 0;

    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const bull = this.bulls.get(p.id);
      if (!bull || !bull.alive) continue;

      aliveCount++;
      bull.score += dt * 10;

      bull.changeTimer -= dt;
      if (bull.changeTimer <= 0) {
        bull.changeTimer = 0.5 + Math.random() * 0.7;
        bull.tiltTarget = (Math.random() > 0.5 ? 1 : -1) * (50 + Math.random() * 45);
        bull.tiltForce = 60 + Math.random() * 50;
      }

      const dir = bull.tiltTarget > bull.balance ? 1 : -1;
      bull.balance += dir * bull.tiltForce * dt;

      const isPressed = this.input.isPressed(p.id);
      const justPressed = this.input.justPressed(p.id);

      if (isPressed) {
        if (bull.balance > 0) {
          bull.balance -= 140 * dt;
        } else {
          bull.balance += 140 * dt;
        }
      }

      if (justPressed) {
        if (bull.balance > 0) {
          bull.balance -= 20;
        } else {
          bull.balance += 20;
        }
        this.audio.playTone(340, 0.05, 'triangle');
      }

      if (Math.abs(bull.balance) >= 95) {
        bull.alive = false;
        bull.balance = Math.sign(bull.balance) * 100;
        const center = this.getBullCenter(i, width, height);
        this.particles.emit(center.x, center.y, 15, '#EF4444');
        this.audio.playTone(180, 0.25, 'sawtooth');
      }
    }

    if (aliveCount <= (active.length > 1 ? 1 : 0)) {
      this.isFinished = true;
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, _height: number): void {
    const bull = this.bulls.get(botId);
    if (!bull || !bull.alive) return;

    const threshold = difficulty === 'bot_hard' ? 18 : difficulty === 'bot_normal' ? 32 : 48;
    if (Math.abs(bull.balance) > threshold) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  private getBullCenter(index: number, width: number, height: number): { x: number; y: number } {
    const positions = [
      { x: width * 0.28, y: height * 0.35 },
      { x: width * 0.72, y: height * 0.35 },
      { x: width * 0.28, y: height * 0.75 },
      { x: width * 0.72, y: height * 0.75 }
    ];
    return positions[index] || positions[0];
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#451A03';
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const bull = this.bulls.get(p.id);
      if (!bull) continue;
      const pos = this.getBullCenter(i, width, height);

      ctx.save();
      ctx.translate(pos.x, pos.y);

      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 80, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#1C1917';
      ctx.beginPath();
      ctx.arc(0, 15, 30, 0, Math.PI * 2);
      ctx.fill();

      const tiltAngle = (bull.balance / 100) * 0.8;
      ctx.save();
      ctx.rotate(tiltAngle);

      ctx.fillStyle = bull.alive ? '#78350F' : '#4B5563';
      ctx.fillRect(-35, -20, 70, 40);

      ctx.fillStyle = '#571C0C';
      ctx.beginPath();
      ctx.arc(42, -5, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(45, -15);
      ctx.lineTo(55, -28);
      ctx.moveTo(45, 5);
      ctx.lineTo(55, 18);
      ctx.stroke();

      if (bull.alive) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, -32, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#D97706';
        ctx.fillRect(-16, -42, 32, 4);
        ctx.fillRect(-8, -48, 16, 6);
      } else {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('BUCKED!', 0, -35);
      }
      ctx.restore();

      ctx.fillStyle = '#292524';
      ctx.fillRect(-60, 65, 120, 12);
      ctx.strokeStyle = '#44403C';
      ctx.lineWidth = 2;
      ctx.strokeRect(-60, 65, 120, 12);

      ctx.fillStyle = '#22C55E';
      ctx.fillRect(-20, 65, 40, 12);

      const pointerX = (bull.balance / 100) * 55;
      ctx.fillStyle = Math.abs(bull.balance) > 70 ? '#EF4444' : '#FBBF24';
      ctx.beginPath();
      ctx.arc(pointerX, 71, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${Math.floor(bull.score)}s`, 0, -90);

      ctx.restore();
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`RODEO BULL: ${Math.ceil(this.roundTimer)}s`, width / 2, 30);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: Math.floor(this.bulls.get(p.id)?.score || 0),
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} rode the bucking bronco to glory!` : 'All cowboys hit the dirt!'
    };
  }
}
