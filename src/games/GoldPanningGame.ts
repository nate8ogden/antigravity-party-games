import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Nugget {
  dist: number;
  angle: number;
  revealed: boolean;
  collected: boolean;
}

interface PlayerPan {
  swirlSpeed: number;
  siltLevel: number;
  nuggets: Nugget[];
}

export class GoldPanningGame extends BaseGame {
  private scores: Map<PlayerId, number> = new Map();
  private pans: Map<PlayerId, PlayerPan> = new Map();

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.scores.clear();
    this.pans.clear();
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.scores.set(p.id, 0);
      this.pans.set(p.id, {
        swirlSpeed: 0,
        siltLevel: 100,
        nuggets: [
          { dist: 45, angle: Math.random() * Math.PI * 2, revealed: false, collected: false },
          { dist: 55, angle: Math.random() * Math.PI * 2, revealed: false, collected: false },
          { dist: 65, angle: Math.random() * Math.PI * 2, revealed: false, collected: false }
        ]
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
      const pan = this.pans.get(p.id);
      if (!pan) continue;

      const isPressed = this.input.isPressed(p.id);
      const justPressed = this.input.justPressed(p.id);

      if (isPressed) {
        pan.swirlSpeed = Math.min(6, pan.swirlSpeed + 4.5 * dt);
      } else {
        pan.swirlSpeed = Math.max(0, pan.swirlSpeed - 3.5 * dt);
      }

      if (pan.swirlSpeed >= 2.2 && pan.swirlSpeed <= 5.0) {
        pan.siltLevel = Math.max(0, pan.siltLevel - 35 * dt);
        for (const nug of pan.nuggets) {
          if (!nug.collected) {
            nug.angle += pan.swirlSpeed * dt * 2.5;
            if (pan.siltLevel < 50) nug.revealed = true;
            if (nug.dist > 15) nug.dist = Math.max(10, nug.dist - 14 * dt);
          }
        }
      }

      if (justPressed) {
        for (const nug of pan.nuggets) {
          if (nug.revealed && !nug.collected && nug.dist < 25) {
            nug.collected = true;
            this.scores.set(p.id, (this.scores.get(p.id) || 0) + 10);
            this.audio.playTone(720, 0.1, 'sine');
            break;
          }
        }

        const remaining = pan.nuggets.filter(n => !n.collected);
        if (remaining.length === 0 || pan.siltLevel <= 0) {
          pan.siltLevel = 100;
          pan.nuggets = [
            { dist: 40 + Math.random() * 10, angle: Math.random() * Math.PI * 2, revealed: false, collected: false },
            { dist: 50 + Math.random() * 15, angle: Math.random() * Math.PI * 2, revealed: false, collected: false },
            { dist: 60 + Math.random() * 15, angle: Math.random() * Math.PI * 2, revealed: false, collected: false }
          ];
        }
      }
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, _height: number): void {
    const pan = this.pans.get(botId);
    if (!pan) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false);
      return;
    }

    const nuggetGrabDist = difficulty === 'bot_easy' ? 16 : difficulty === 'bot_normal' ? 24 : 28;
    const readyNugget = pan.nuggets.find(n => n.revealed && !n.collected && n.dist < nuggetGrabDist);
    if (readyNugget) {
      this.input.setBotInput(botId, true);
      return;
    }

    const minSwirl = difficulty === 'bot_easy' ? 2.2 : difficulty === 'bot_normal' ? 3.2 : 3.8;
    const maxSwirl = difficulty === 'bot_easy' ? 3.4 : difficulty === 'bot_normal' ? 4.2 : 4.9;

    if (pan.swirlSpeed < minSwirl) {
      this.input.setBotInput(botId, true);
    } else if (pan.swirlSpeed > maxSwirl) {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const riverGrad = ctx.createLinearGradient(0, 0, 0, height);
    riverGrad.addColorStop(0, '#0284C7');
    riverGrad.addColorStop(0.5, '#0369A1');
    riverGrad.addColorStop(1, '#075985');
    ctx.fillStyle = riverGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#0C4A6E';
    for (let x = 30; x < width; x += 60) {
      ctx.beginPath();
      ctx.arc(x, ((x * 37) % height), 12, 0, Math.PI * 2);
      ctx.fill();
    }

    const positions = [
      { x: width * 0.28, y: height * 0.35 },
      { x: width * 0.72, y: height * 0.35 },
      { x: width * 0.28, y: height * 0.75 },
      { x: width * 0.72, y: height * 0.75 }
    ];

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const pos = positions[i] || positions[0];
      const pan = this.pans.get(p.id);
      if (!pan) continue;

      ctx.save();
      ctx.translate(pos.x, pos.y);

      ctx.fillStyle = '#64748B';
      ctx.beginPath();
      ctx.arc(0, 0, 75, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(0, 0, 68, 0, Math.PI * 2);
      ctx.fill();

      const siltAlpha = Math.max(0.1, pan.siltLevel / 100);
      ctx.fillStyle = `rgba(120, 53, 15, ${siltAlpha})`;
      ctx.beginPath();
      ctx.arc(0, 0, 64, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = pan.swirlSpeed >= 2.2 && pan.swirlSpeed <= 5.0 ? '#22C55E' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();

      if (pan.swirlSpeed > 0.5) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 45, Date.now() * 0.005 * pan.swirlSpeed, Date.now() * 0.005 * pan.swirlSpeed + Math.PI);
        ctx.stroke();
      }

      for (const nug of pan.nuggets) {
        if (nug.collected) continue;
        if (nug.revealed) {
          const nx = Math.cos(nug.angle) * nug.dist;
          const ny = Math.sin(nug.angle) * nug.dist;

          ctx.fillStyle = '#FBBF24';
          ctx.beginPath();
          ctx.arc(nx, ny, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(nx - 2, ny - 2, 2, 2);
        }
      }

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, -68, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${this.scores.get(p.id) || 0}g`, 0, 95);

      ctx.restore();
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`GOLD PANNING: ${Math.ceil(this.roundTimer)}s`, width / 2, 30);
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} struck the mother lode!` : 'All river gold washed away!'
    };
  }
}
