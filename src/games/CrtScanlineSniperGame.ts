import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CrtTarget {
  id: number;
  x: number;
  y: number;
  vx: number;
  radius: number;
  type: 'DUCK' | 'UFO' | 'CAN';
  points: number;
  color: string;
}

interface SniperPlayer {
  id: PlayerId;
  x: number;
  y: number;
  score: number;
  cooldown: number;
}

export class CrtScanlineSniperGame extends BaseGame {
  private playersState: Map<PlayerId, SniperPlayer> = new Map();
  private targets: CrtTarget[] = [];
  private nextTargetId: number = 1;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 30;
    this.playersState.clear();
    this.targets = [];
    this.nextTargetId = 1;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height / 2,
        score: 0,
        cooldown: 0
      });
    });

    for (let i = 0; i < 6; i++) {
      this.spawnTarget(width, height);
    }
  }

  private spawnTarget(width: number, height: number): void {
    const isLeft = Math.random() < 0.5;
    const speed = 70 + Math.random() * 80;
    const rType = Math.random();
    let type: 'DUCK' | 'UFO' | 'CAN' = 'CAN';
    let points = 1;
    let color = '#38bdf8';

    if (rType < 0.25) {
      type = 'UFO';
      points = 5;
      color = '#fbbf24';
    } else if (rType < 0.65) {
      type = 'DUCK';
      points = 2;
      color = '#4ade80';
    }

    this.targets.push({
      id: this.nextTargetId++,
      x: isLeft ? -20 : width + 20,
      y: 70 + Math.random() * (height - 130),
      vx: isLeft ? speed : -speed,
      radius: type === 'UFO' ? 14 : 16,
      type,
      points,
      color
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Update Targets
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      t.x += t.vx * dt;

      if ((t.vx > 0 && t.x > width + 40) || (t.vx < 0 && t.x < -40)) {
        this.targets.splice(i, 1);
        this.spawnTarget(width, height);
      }
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.cooldown > 0) {
        ps.cooldown -= dt;
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isPressed = this.input.justPressed(p.id);

      if (Math.abs(steer) > 0.1 || Math.abs(throttle) > 0.1) {
        ps.x += steer * 240 * dt;
        ps.y += -throttle * 240 * dt;
      } else {
        // Single button oscillation
        ps.x = width / 2 + Math.sin((30 - this.roundTimer) * 3) * (width * 0.4);
      }

      ps.x = Math.max(25, Math.min(width - 25, ps.x));
      ps.y = Math.max(60, Math.min(height - 40, ps.y));

      // Trigger Fire
      if (isPressed && ps.cooldown <= 0) {
        ps.cooldown = 0.35;
        this.audio.playLaser();

        let hitAny = false;
        for (let i = this.targets.length - 1; i >= 0; i--) {
          const t = this.targets[i];
          const dist = Math.hypot(ps.x - t.x, ps.y - t.y);

          if (dist < t.radius + 10) {
            ps.score += t.points;
            hitAny = true;
            this.audio.playScore();
            this.particles.emit(t.x, t.y, 14, t.color);
            this.targets.splice(i, 1);
            this.spawnTarget(width, height);
            break;
          }
        }

        if (!hitAny) {
          this.particles.emit(ps.x, ps.y, 4, '#64748b');
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false, 0, 0);
      return;
    }

    // Find nearest target
    let nearest: CrtTarget | null = null;
    let minDist = Infinity;
    for (const t of this.targets) {
      const d = Math.hypot(t.x - ps.x, t.y - ps.y);
      if (d < minDist) {
        minDist = d;
        nearest = t;
      }
    }

    if (nearest) {
      let targetX = nearest.x;
      let targetY = nearest.y;

      if (difficulty === 'bot_easy') {
        targetX += (Math.random() - 0.5) * 45;
        targetY += (Math.random() - 0.5) * 45;
      } else if (difficulty === 'bot_normal') {
        targetX += (Math.random() - 0.5) * 16;
        targetY += (Math.random() - 0.5) * 16;
      } else {
        // Hard predicts lead
        targetX += nearest.vx * 0.15;
      }

      const dx = targetX - ps.x;
      const dy = targetY - ps.y;
      const dist = Math.hypot(dx, dy);

      const tolerance = difficulty === 'bot_easy' ? 14 : difficulty === 'bot_normal' ? 8 : 4;
      const shoot = dist < nearest.radius + tolerance;
      this.input.setBotInput(botId, shoot, dx / (dist || 1), -dy / (dist || 1));
    } else {
      this.input.setBotInput(botId, false, 0, 0);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // CRT Curved Screen Base
    ctx.fillStyle = '#06130b';
    ctx.fillRect(0, 0, width, height);

    // Phosphor Scanlines
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.12)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Outer CRT bezel / screen vignette
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, width - 8, height - 8);

    // Render Targets
    for (const t of this.targets) {
      ctx.save();
      ctx.translate(t.x, t.y);

      if (t.type === 'UFO') {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, -3, 5, Math.PI, 0);
        ctx.fill();
      } else if (t.type === 'DUCK') {
        ctx.fillStyle = '#4ade80';
        // Duck body
        ctx.beginPath();
        ctx.ellipse(0, 2, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        // Duck head & beak
        ctx.beginPath();
        ctx.arc(t.vx > 0 ? 8 : -8, -4, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f97316';
        ctx.fillRect(t.vx > 0 ? 12 : -16, -4, 6, 3);
      } else {
        // Pixel Can
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(-8, -10, 16, 20);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-6, -6, 12, 12);
      }

      ctx.restore();
    }

    // Render Crosshairs
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Crosshair Circle & Lines
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.moveTo(-22, 0);
      ctx.lineTo(-8, 0);
      ctx.moveTo(8, 0);
      ctx.lineTo(22, 0);
      ctx.moveTo(0, -22);
      ctx.lineTo(0, -8);
      ctx.moveTo(0, 8);
      ctx.lineTo(0, 22);
      ctx.stroke();

      // Center Dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Score
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y + 32);
    }

    // Top HUD
    ctx.fillStyle = 'rgba(6, 19, 11, 0.9)';
    ctx.fillRect(0, 0, width, 36);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('CRT SCANLINE SNIPER // LIGHTGUN', 16, 24);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.roundTimer < 6 ? '#ef4444' : '#f8fafc';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width - 16, 24);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} sniped the highest score on the CRT scanlines!` : 'Gallery closed!'
    };
  }
}
