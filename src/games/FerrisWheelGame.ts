import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Gondola {
  angle: number; // in rad
  radius: number;
}

interface Climber {
  gondolaIdx: number; // -1 for ground
  jumpProgress: number; // 0 to 1
  isJumping: boolean;
  score: number;
  x: number;
  y: number;
}

export class FerrisWheelGame extends BaseGame {
  private wheelAngle: number = 0;
  private gondolas: Gondola[] = [];
  private climbers: Map<PlayerId, Climber> = new Map();
  private readonly GONDOLA_COUNT = 8;
  private readonly WHEEL_RADIUS = 150;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.wheelAngle = 0;
    this.roundTimer = 25.0;
    this.isFinished = false;
    this.gondolas = [];
    this.climbers.clear();

    for (let i = 0; i < this.GONDOLA_COUNT; i++) {
      this.gondolas.push({
        angle: (i / this.GONDOLA_COUNT) * Math.PI * 2,
        radius: this.WHEEL_RADIUS
      });
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.climbers.set(p.id, {
        gondolaIdx: idx % this.GONDOLA_COUNT,
        jumpProgress: 0,
        isJumping: false,
        score: 0,
        x: width / 2,
        y: height - 60
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    this.wheelAngle += dt * 0.6; // Rotate Ferris wheel
    this.updateBots(dt, width, height);

    const cx = width / 2;
    const cy = height * 0.44;

    for (const p of this.getActivePlayers()) {
      const c = this.climbers.get(p.id);
      if (!c) continue;

      if (!c.isJumping) {
        // Positioned on gondola
        const g = this.gondolas[c.gondolaIdx];
        const curAngle = g.angle + this.wheelAngle;
        c.x = cx + Math.cos(curAngle) * g.radius;
        c.y = cy + Math.sin(curAngle) * g.radius;

        // Score based on height (highest point is angle = -PI/2)
        const heightFactor = Math.max(0, -Math.sin(curAngle));
        c.score += Math.floor(heightFactor * dt * 80);

        // Jump input
        if (this.input.justPressed(p.id)) {
          c.isJumping = true;
          c.jumpProgress = 0;
          this.audio.playTone(550, 0.08, 'triangle');
        }
      } else {
        // Jumping up/to adjacent gondola
        c.jumpProgress += dt * 2.2;
        c.y -= Math.sin(c.jumpProgress * Math.PI) * 4;

        if (c.jumpProgress >= 1) {
          c.isJumping = false;
          c.jumpProgress = 0;

          // Check if near any other gondola
          let bestGondola = c.gondolaIdx;
          let bestDist = Infinity;

          this.gondolas.forEach((g, gIdx) => {
            const curAngle = g.angle + this.wheelAngle;
            const gx = cx + Math.cos(curAngle) * g.radius;
            const gy = cy + Math.sin(curAngle) * g.radius;
            const dist = Math.hypot(c.x - gx, c.y - gy);
            if (dist < bestDist) {
              bestDist = dist;
              bestGondola = gIdx;
            }
          });

          if (bestDist < 60) {
            c.gondolaIdx = (c.gondolaIdx + 1) % this.GONDOLA_COUNT;
            c.score += 50;
            this.audio.playTone(720, 0.1, 'triangle');
            this.particles.emit(c.x, c.y, 10, p.color);
          } else {
            // Drop to lower tier
            this.audio.playTone(200, 0.1, 'sawtooth');
          }
        }
      }
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _w: number, _h: number): void {
    const c = this.climbers.get(botId);
    if (!c || c.isJumping) {
      this.input.setBotInput(botId, false);
      return;
    }

    const g = this.gondolas[c.gondolaIdx];
    const curAngle = (g.angle + this.wheelAngle) % (Math.PI * 2);

    // Hard bots jump when gondola is climbing upward towards apex
    const isClimbing = curAngle > Math.PI && curAngle < Math.PI * 1.5;
    const jumpChance = difficulty === 'bot_hard' ? 0.3 : difficulty === 'bot_normal' ? 0.15 : 0.05;

    if (isClimbing && Math.random() < jumpChance) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Night amusement park background
    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height * 0.44;

    // Ferris Wheel A-Frame Base
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - 80, height - 20);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + 80, height - 20);
    ctx.stroke();

    // Wheel Outer Rims
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, this.WHEEL_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, this.WHEEL_RADIUS - 20, 0, Math.PI * 2);
    ctx.stroke();

    // Wheel Spokes
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2;
    for (let i = 0; i < this.GONDOLA_COUNT; i++) {
      const angle = (i / this.GONDOLA_COUNT) * Math.PI * 2 + this.wheelAngle;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * this.WHEEL_RADIUS, cy + Math.sin(angle) * this.WHEEL_RADIUS);
      ctx.stroke();
    }

    // Center Wheel Axle Hub
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();

    // Draw Gondolas (always hang upright due to gravity)
    this.gondolas.forEach((g, idx) => {
      const angle = g.angle + this.wheelAngle;
      const gx = cx + Math.cos(angle) * g.radius;
      const gy = cy + Math.sin(angle) * g.radius;

      // Gondola cabin
      const gondolaColors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#EAB308'];
      ctx.fillStyle = gondolaColors[idx % gondolaColors.length];
      ctx.beginPath();
      ctx.roundRect(gx - 14, gy - 8, 28, 20, 4);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Gondola hanger rod
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx, gy - 16);
      ctx.lineTo(gx, gy - 8);
      ctx.stroke();
    });

    // Draw Climbers
    for (const p of this.getActivePlayers()) {
      const c = this.climbers.get(p.id);
      if (!c) continue;

      ctx.save();
      ctx.translate(c.x, c.y - 12);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    // Bottom Player Scoreboard
    const active = this.getActivePlayers();
    const count = active.length;
    active.forEach((p, idx) => {
      const c = this.climbers.get(p.id);
      if (!c) return;

      const px = (width / (count + 1)) * (idx + 1);
      const py = height - 25;

      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.roundRect(px - 40, py - 12, 80, 24, 4);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${c.score} PTS`, px, py + 4);
    });

    // Top Header
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`FERRIS WHEEL JUMP • TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.climbers.get(p.id)?.score || 0,
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} hopped to the apex of the Ferris Wheel!` : 'The wheel completed its twilight spin!'
    };
  }
}
