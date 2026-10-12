import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface MedusaBoss {
  x: number;
  y: number;
  state: 'idle' | 'charging' | 'gazing' | 'stunned';
  stateTimer: number;
  eyeGlow: number;
  gazeAngle: number;
}

interface GorgonFighter {
  id: PlayerId;
  angle: number;
  dist: number;
  shieldRaised: boolean;
  petrifiedTimer: number;
  score: number;
  combo: number;
}

export class GorgonGazeGame extends BaseGame {
  public fighters: Map<PlayerId, GorgonFighter> = new Map();
  public medusa: MedusaBoss = {
    x: 0,
    y: 0,
    state: 'idle',
    stateTimer: 2.0,
    eyeGlow: 0,
    gazeAngle: 0,
  };
  public currentMapName: string = 'Temple of the Gorgon';
  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 35.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 35.0;
    this.fighters.clear();
    this.botReactionTimers.clear();

    this.medusa = {
      x: width / 2,
      y: height / 2 + 10,
      state: 'idle',
      stateTimer: 1.8,
      eyeGlow: 0,
      gazeAngle: 0,
    };

    const active = this.getActivePlayers();
    const count = active.length;
    active.forEach((p, idx) => {
      const angle = (idx / count) * Math.PI * 2;
      this.fighters.set(p.id, {
        id: p.id,
        angle,
        dist: 140,
        shieldRaised: false,
        petrifiedTimer: 0,
        score: 0,
        combo: 0,
      });
      this.botReactionTimers.set(p.id, 0);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      return;
    }

    this.updateBots(dt, width, height);

    const m = this.medusa;
    m.x = width / 2;
    m.y = height / 2 + 10;

    m.stateTimer -= dt;
    if (m.state === 'idle') {
      m.eyeGlow = 0;
      if (m.stateTimer <= 0) {
        m.state = 'charging';
        m.stateTimer = 1.2;
        this.audio.playTone(320, 0.2, 'sawtooth');
      }
    } else if (m.state === 'charging') {
      m.eyeGlow = 1 - m.stateTimer / 1.2;
      if (m.stateTimer <= 0) {
        m.state = 'gazing';
        m.stateTimer = 0.7;
        this.audio.playTone(660, 0.4, 'square');

        this.fighters.forEach((f) => {
          if (f.petrifiedTimer > 0) return;

          if (f.shieldRaised) {
            f.score += 35 + f.combo * 4;
            f.combo++;
            this.audio.playTone(880, 0.2, 'sine');
            const fx = m.x + Math.cos(f.angle) * f.dist;
            const fy = m.y + Math.sin(f.angle) * f.dist;
            this.particles.emit(fx, fy, 18, '#2ecc71');
          } else {
            f.petrifiedTimer = 2.0;
            f.combo = 0;
            f.score = Math.max(0, f.score - 20);
            this.audio.playTone(110, 0.3, 'sawtooth');
          }
        });
      }
    } else if (m.state === 'gazing') {
      if (m.stateTimer <= 0) {
        m.state = 'stunned';
        m.stateTimer = 1.5;
      }
    } else if (m.state === 'stunned') {
      m.eyeGlow = 0;
      if (m.stateTimer <= 0) {
        m.state = 'idle';
        m.stateTimer = 1.5 + Math.random() * 1.0;
      }
    }

    this.fighters.forEach((f) => {
      const p = this.getPlayer(f.id);
      if (f.petrifiedTimer > 0) {
        f.petrifiedTimer -= dt;
        return;
      }

      if (p && !p.type.startsWith('bot_')) {
        f.shieldRaised = this.input.isPressed(f.id);
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const f = this.fighters.get(botId);
    if (!f || f.petrifiedTimer > 0) return;

    const m = this.medusa;
    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      if (m.state === 'charging' && m.stateTimer < (difficulty === 'bot_hard' ? 0.45 : difficulty === 'bot_normal' ? 0.35 : 0.25)) {
        f.shieldRaised = true;
        bTimer = 0.8;
      } else if (m.state !== 'charging' && m.state !== 'gazing') {
        f.shieldRaised = false;
        bTimer = 0.3;
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const mx = width / 2;
    const my = height / 2 + 10;

    const bgGrad = ctx.createRadialGradient(mx, my, 40, mx, my, 280);
    bgGrad.addColorStop(0, '#1c2833');
    bgGrad.addColorStop(0.6, '#17202a');
    bgGrad.addColorStop(1, '#0b1016');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(127, 140, 141, 0.35)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(mx, my, 140, 0, Math.PI * 2);
    ctx.stroke();

    const m = this.medusa;
    ctx.save();
    ctx.translate(mx, my);

    ctx.strokeStyle = '#27ae60';
    ctx.lineWidth = 3.5;
    for (let i = 0; i < 8; i++) {
      const sAngle = (i / 8) * Math.PI * 2 + Math.sin(Date.now() * 0.005 + i) * 0.3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const sx1 = Math.cos(sAngle) * 20;
      const sy1 = Math.sin(sAngle) * 20;
      const sx2 = Math.cos(sAngle + 0.3) * 34;
      const sy2 = Math.sin(sAngle + 0.3) * 34;
      ctx.quadraticCurveTo(sx1, sy1, sx2, sy2);
      ctx.stroke();
    }

    ctx.fillStyle = m.state === 'stunned' ? '#7f8c8d' : '#1e8449';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    if (m.eyeGlow > 0 || m.state === 'gazing') {
      ctx.fillStyle = '#2ecc71';
      ctx.shadowColor = '#2ecc71';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(-6, -3, 4, 0, Math.PI * 2);
      ctx.arc(6, -3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(-6, -3, 3, 0, Math.PI * 2);
      ctx.arc(6, -3, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (m.state === 'gazing') {
      ctx.fillStyle = 'rgba(46, 204, 113, 0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 160, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    ctx.restore();

    this.fighters.forEach((f, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#e74c3c';
      const fx = mx + Math.cos(f.angle) * f.dist;
      const fy = my + Math.sin(f.angle) * f.dist;

      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(f.angle + Math.PI);

      const bodyColor = f.petrifiedTimer > 0 ? '#7f8c8d' : color;
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.roundRect(-9, -14, 18, 28, 4);
      ctx.fill();

      if (f.shieldRaised) {
        ctx.fillStyle = '#ecf0f1';
        ctx.beginPath();
        ctx.ellipse(12, 0, 6, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#95a5a6';
        ctx.beginPath();
        ctx.ellipse(4, 8, 4, 12, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      if (f.petrifiedTimer > 0) {
        ctx.fillStyle = '#bdc3c7';
        ctx.fillText('🗿 PETRIFIED!', fx, fy - 22);
      } else {
        ctx.fillText(`${cfg?.name ?? pId}: ${f.score}`, fx, fy - 22);
      }
    });

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐍 HOLD SHIELD WHEN MEDUSA GAZES • DEFLECT RAY!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.fighters.forEach((f, pId) => scores.set(pId, f.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.fighters.entries())
      .map(([playerId, f]) => ({ playerId, score: f.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} defeated the Gorgon's gaze!` : 'All turned to stone!',
    };
  }
}
