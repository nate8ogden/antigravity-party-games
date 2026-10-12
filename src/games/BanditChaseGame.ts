import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Bandit {
  id: number;
  x: number;
  y: number;
  speed: number;
  hp: number;
  angle: number;
}

interface PlayerReticle {
  baseAngle: number;
  sweepAngle: number;
  sweepDir: number;
  score: number;
}

export class BanditChaseGame extends BaseGame {
  private reticles: Map<PlayerId, PlayerReticle> = new Map();
  private bandits: Bandit[] = [];
  private coachHp: number = 100;
  private spawnTimer: number = 0;
  private nextBanditId: number = 1;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.reticles.clear();
    this.bandits = [];
    this.coachHp = 100;
    this.spawnTimer = 0.5;
    this.roundTimer = 25.0;
    this.isFinished = false;

    const baseAngles = [
      -Math.PI / 2,
      0,
      Math.PI / 2,
      Math.PI
    ];

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      this.reticles.set(p.id, {
        baseAngle: baseAngles[i % 4] || 0,
        sweepAngle: 0,
        sweepDir: 1,
        score: 0
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0 || this.coachHp <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    this.updateBots(dt, width, height);

    const cx = width / 2;
    const cy = height / 2;

    for (const p of this.getActivePlayers()) {
      const r = this.reticles.get(p.id);
      if (!r) continue;

      r.sweepAngle += r.sweepDir * 2.2 * dt;
      if (r.sweepAngle > Math.PI / 4) {
        r.sweepAngle = Math.PI / 4;
        r.sweepDir = -1;
      } else if (r.sweepAngle < -Math.PI / 4) {
        r.sweepAngle = -Math.PI / 4;
        r.sweepDir = 1;
      }

      if (this.input.justPressed(p.id)) {
        const shotAngle = r.baseAngle + r.sweepAngle;
        this.audio.playTone(280, 0.1, 'sawtooth');

        for (const b of this.bandits) {
          const bAngle = Math.atan2(b.y - cy, b.x - cx);
          let diff = Math.abs(bAngle - shotAngle);
          while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

          if (diff < 0.22) {
            b.hp--;
            r.score += 10;
            this.particles.emit(b.x, b.y, 10, '#F59E0B');
            this.audio.playTone(550, 0.1, 'sine');
          }
        }

        const mx = cx + Math.cos(shotAngle) * 45;
        const my = cy + Math.sin(shotAngle) * 45;
        this.particles.emit(mx, my, 6, '#EF4444');
      }
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.8 + Math.random() * 0.5;
      const edge = Math.floor(Math.random() * 4);
      let bx = 0, by = 0;
      if (edge === 0) { bx = Math.random() * width; by = -20; }
      else if (edge === 1) { bx = width + 20; by = Math.random() * height; }
      else if (edge === 2) { bx = Math.random() * width; by = height + 20; }
      else { bx = -20; by = Math.random() * height; }

      const angle = Math.atan2(cy - by, cx - bx);
      this.bandits.push({
        id: this.nextBanditId++,
        x: bx,
        y: by,
        speed: 75 + Math.random() * 40,
        hp: 1,
        angle
      });
    }

    for (const b of this.bandits) {
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;

      if (Math.hypot(b.x - cx, b.y - cy) < 40) {
        b.hp = 0;
        this.coachHp = Math.max(0, this.coachHp - 15);
        this.particles.emit(cx, cy, 14, '#EF4444');
        this.audio.playTone(140, 0.2, 'sawtooth');
      }
    }

    this.bandits = this.bandits.filter(b => b.hp > 0);
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2;
    const r = this.reticles.get(botId);
    if (!r) return;

    const currentShotAngle = r.baseAngle + r.sweepAngle;

    for (const b of this.bandits) {
      const bAngle = Math.atan2(b.y - cy, b.x - cx);
      let diff = Math.abs(bAngle - currentShotAngle);
      while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

      const margin = difficulty === 'bot_hard' ? 0.14 : difficulty === 'bot_normal' ? 0.1 : 0.06;
      if (diff < margin) {
        this.input.setBotInput(botId, true);
        break;
      } else {
        this.input.setBotInput(botId, false);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#92400E';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    ctx.fillStyle = '#571C0C';
    ctx.fillRect(cx - 30, cy - 25, 60, 50);
    ctx.strokeStyle = '#3E1408';
    ctx.lineWidth = 4;
    ctx.strokeRect(cx - 30, cy - 25, 60, 50);

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(cx - 30, cy - 25, 10, 0, Math.PI * 2);
    ctx.arc(cx + 30, cy - 25, 10, 0, Math.PI * 2);
    ctx.arc(cx - 30, cy + 25, 10, 0, Math.PI * 2);
    ctx.arc(cx + 30, cy + 25, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1F2937';
    ctx.fillRect(cx - 40, cy + 35, 80, 8);
    ctx.fillStyle = this.coachHp > 40 ? '#22C55E' : '#EF4444';
    ctx.fillRect(cx - 40, cy + 35, 80 * (this.coachHp / 100), 8);

    for (const p of this.getActivePlayers()) {
      const r = this.reticles.get(p.id);
      if (!r) continue;

      const shotAngle = r.baseAngle + r.sweepAngle;
      const rx = cx + Math.cos(shotAngle) * 90;
      const ry = cy + Math.sin(shotAngle) * 90;

      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(rx, ry);
      ctx.stroke();

      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rx, ry, 12, 0, Math.PI * 2);
      ctx.moveTo(rx - 16, ry);
      ctx.lineTo(rx + 16, ry);
      ctx.moveTo(rx, ry - 16);
      ctx.lineTo(rx, ry + 16);
      ctx.stroke();
    }

    for (const b of this.bandits) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);

      ctx.fillStyle = '#18181B';
      ctx.fillRect(-12, -6, 24, 12);

      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(2, -2, 4, 4);

      ctx.restore();
    }

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const r = this.reticles.get(p.id);
      if (!r) continue;

      const px = 20 + i * (width / Math.max(1, active.length));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px + 10, 20, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${p.name}: ${r.score}`, px + 24, 24);
    }

    ctx.fillStyle = '#FDE68A';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`BANDIT CHASE: ${Math.ceil(this.roundTimer)}s`, width / 2, 55);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.reticles.get(p.id)?.score || 0,
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} defended the gold shipment like a legend!` : 'The bandits overran the stagecoach!'
    };
  }
}
