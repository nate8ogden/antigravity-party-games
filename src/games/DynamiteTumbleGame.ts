import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Dynamite {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuseTimer: number;
  active: boolean;
}

export class DynamiteTumbleGame extends BaseGame {
  private scores: Map<PlayerId, number> = new Map();
  private health: Map<PlayerId, number> = new Map();
  private dynamites: Dynamite[] = [];
  private spawnTimer: number = 0;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.scores.clear();
    this.health.clear();
    this.dynamites = [];
    this.spawnTimer = 0.5;
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.scores.set(p.id, 0);
      this.health.set(p.id, 3);
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

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.1 + Math.random() * 0.7;
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 70;
      this.dynamites.push({
        x: width / 2,
        y: height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        fuseTimer: 4.5,
        active: true
      });
      this.audio.playTone(320, 0.05, 'triangle');
    }

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      if ((this.health.get(p.id) || 0) <= 0) continue;

      const justPressed = this.input.justPressed(p.id);
      const pos = this.getDugoutPos(i, width, height);

      if (justPressed) {
        for (const d of this.dynamites) {
          if (!d.active) continue;
          const dist = Math.hypot(d.x - pos.x, d.y - pos.y);
          if (dist < 85) {
            const kickAngle = Math.atan2(height / 2 - d.y, width / 2 - d.x) + (Math.random() - 0.5) * 0.4;
            const kickSpeed = 260 + Math.random() * 60;
            d.vx = Math.cos(kickAngle) * kickSpeed;
            d.vy = Math.sin(kickAngle) * kickSpeed;
            d.fuseTimer += 1.0;

            this.scores.set(p.id, (this.scores.get(p.id) || 0) + 10);
            this.particles.emit(d.x, d.y, 8, '#F59E0B');
            this.audio.playTone(550, 0.08, 'sine');
            break;
          }
        }
      }
    }

    for (const d of this.dynamites) {
      if (!d.active) continue;

      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.fuseTimer -= dt;

      if (d.x < 20) { d.x = 20; d.vx *= -1; }
      if (d.x > width - 20) { d.x = width - 20; d.vx *= -1; }
      if (d.y < 20) { d.y = 20; d.vy *= -1; }
      if (d.y > height - 20) { d.y = height - 20; d.vy *= -1; }

      if (d.fuseTimer <= 0) {
        d.active = false;
        this.particles.emit(d.x, d.y, 20, '#EF4444');
        this.audio.playTone(150, 0.3, 'sawtooth');

        for (let i = 0; i < active.length; i++) {
          const p = active[i];
          const pos = this.getDugoutPos(i, width, height);
          if (Math.hypot(d.x - pos.x, d.y - pos.y) < 70) {
            const h = (this.health.get(p.id) || 3) - 1;
            this.health.set(p.id, Math.max(0, h));
            this.scores.set(p.id, Math.max(0, (this.scores.get(p.id) || 0) - 15));
          }
        }
      }
    }

    this.dynamites = this.dynamites.filter(d => d.active);

    const aliveCount = active.filter(p => (this.health.get(p.id) || 0) > 0).length;
    if (aliveCount <= (active.length > 1 ? 1 : 0)) {
      this.isFinished = true;
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const active = this.getActivePlayers();
    const i = active.findIndex(p => p.id === botId);
    if (i === -1 || (this.health.get(botId) || 0) <= 0) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false);
      return;
    }

    const pos = this.getDugoutPos(i, width, height);

    const dangerDist = difficulty === 'bot_easy' ? 58 : difficulty === 'bot_normal' ? 75 : 88;
    const canDefend = difficulty === 'bot_easy' ? Math.random() < 0.70 : true;

    const closeTNT = this.dynamites.find(d => d.active && Math.hypot(d.x - pos.x, d.y - pos.y) < dangerDist);
    if (closeTNT && canDefend) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  private getDugoutPos(index: number, width: number, height: number): { x: number; y: number } {
    const corners = [
      { x: 90, y: 100 },
      { x: width - 90, y: 100 },
      { x: 90, y: height - 100 },
      { x: width - 90, y: height - 100 }
    ];
    return corners[index] || corners[0];
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#292524';
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const pos = this.getDugoutPos(i, width, height);
      const h = this.health.get(p.id) || 0;

      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 65, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = h > 0 ? p.color : '#52525B';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 80, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = h > 0 ? p.color : '#71717A';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#EF4444';
      for (let j = 0; j < h; j++) {
        ctx.fillRect(pos.x - 18 + j * 14, pos.y + 26, 10, 6);
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${this.scores.get(p.id) || 0}`, pos.x, pos.y - 28);
    }

    for (const d of this.dynamites) {
      if (!d.active) continue;

      ctx.save();
      ctx.translate(d.x, d.y);

      ctx.fillStyle = '#DC2626';
      ctx.fillRect(-14, -8, 28, 16);
      ctx.strokeStyle = '#991B1B';
      ctx.lineWidth = 2;
      ctx.strokeRect(-14, -8, 28, 16);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TNT', 0, 4);

      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(20, -5);
      ctx.stroke();

      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(20, -5, 3 + Math.sin(Date.now() * 0.02) * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`DYNAMITE TUMBLE: ${Math.ceil(this.roundTimer)}s`, width / 2, 30);
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} booted dynamite like a champion!` : 'All bunkers went up in smoke!'
    };
  }
}
