import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface PondMosquito {
  x: number;
  y: number;
  vx: number;
  vy: number;
  points: number;
  alive: boolean;
}

interface DragonflyPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  dashCooldown: number;
  score: number;
}

export class DragonflyDogfightGame extends BaseGame {
  private mosquitoes: PondMosquito[] = [];
  private playersState: Map<PlayerId, DragonflyPlayer> = new Map();
  private wingTimer: number = 0;

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
    this.wingTimer = 0;
    this.mosquitoes = [];
    this.playersState.clear();

    this.spawnMosquitoes(width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    const cx = width / 2;
    const cy = height * 0.52;

    active.forEach((p, idx) => {
      const a = (idx / count) * Math.PI * 2;
      this.playersState.set(p.id, {
        id: p.id,
        x: cx + Math.cos(a) * 90,
        y: cy + Math.sin(a) * 90,
        vx: 0,
        vy: 0,
        angle: a,
        dashCooldown: 0,
        score: 0
      });
    });
  }

  private spawnMosquitoes(width: number, height: number): void {
    for (let i = 0; i < 10; i++) {
      this.mosquitoes.push({
        x: 60 + Math.random() * (width - 120),
        y: 80 + Math.random() * (height - 140),
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 80,
        points: 20,
        alive: true
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.wingTimer += dt * 45;
    this.updateBots(dt, width, height);

    // Update Mosquitoes
    for (const m of this.mosquitoes) {
      if (!m.alive) continue;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.x < 40 || m.x > width - 40) m.vx *= -1;
      if (m.y < 60 || m.y > height - 60) m.vy *= -1;
    }

    const dragonflies = Array.from(this.playersState.values());

    for (const df of dragonflies) {
      if (df.dashCooldown > 0) df.dashCooldown -= dt;

      const steerX = this.input.getSteer(df.id);
      const steerY = -this.input.getThrottle(df.id);
      const mag = Math.hypot(steerX, steerY);

      if (mag > 0.2) {
        df.angle = Math.atan2(steerY, steerX);
        const speed = 250;
        df.vx += (steerX / mag) * speed * dt * 5;
        df.vy += (steerY / mag) * speed * dt * 5;
      }

      // Tap to Supersonic Dash
      if (this.input.justPressed(df.id) && df.dashCooldown <= 0) {
        df.dashCooldown = 0.85;
        df.vx = Math.cos(df.angle) * 440;
        df.vy = Math.sin(df.angle) * 440;
        this.audio.playWhoosh();
        this.particles.spawnDust(df.x, df.y, 4);
      }

      df.vx *= Math.pow(0.1, dt);
      df.vy *= Math.pow(0.1, dt);

      df.x += df.vx * dt;
      df.y += df.vy * dt;

      df.x = Math.max(30, Math.min(width - 30, df.x));
      df.y = Math.max(50, Math.min(height - 40, df.y));

      // Catch mosquitoes
      for (const m of this.mosquitoes) {
        if (m.alive && Math.hypot(df.x - m.x, df.y - m.y) < 26) {
          m.alive = false;
          df.score += m.points;
          this.audio.playChomp();
          this.particles.showFloatingText(`+${m.points} SNAP!`, m.x, m.y - 14, '#38BDF8', 18);
          this.particles.spawnConfetti(m.x, m.y, 6);
        }
      }
    }

    // Dragonfly vs Dragonfly tail duel
    for (let i = 0; i < dragonflies.length; i++) {
      for (let j = i + 1; j < dragonflies.length; j++) {
        const d1 = dragonflies[i];
        const d2 = dragonflies[j];
        if (Math.hypot(d1.x - d2.x, d1.y - d2.y) < 28) {
          this.audio.playBounce();
          d1.vx *= -1;
          d1.vy *= -1;
          d2.vx *= -1;
          d2.vy *= -1;
        }
      }
    }

    // Respawn mosquitoes
    if (this.mosquitoes.filter((m) => m.alive).length < 3) {
      this.spawnMosquitoes(width, height);
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Garden Lily Pad Pond
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, width * 0.7);
    bgGrad.addColorStop(0, '#0284C7');
    bgGrad.addColorStop(0.7, '#0369A1');
    bgGrad.addColorStop(1, '#0C4A6E');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Floating Giant Lily Pads in background
    ctx.fillStyle = '#059669';
    const pads = [
      { x: width * 0.25, y: height * 0.35, r: 42 },
      { x: width * 0.75, y: height * 0.4, r: 48 },
      { x: width * 0.5, y: height * 0.75, r: 40 }
    ];
    for (const p of pads) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0.2, Math.PI * 1.8);
      ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.fill();
    }

    // 2. Draw Flying Mosquitoes
    for (const m of this.mosquitoes) {
      if (!m.alive) continue;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(-6, -6, 12, 3);
      ctx.restore();
    }

    // 3. Draw Dragonflies
    for (const p of this.getActivePlayers()) {
      const df = this.playersState.get(p.id);
      if (!df) continue;

      ctx.save();
      ctx.translate(df.x, df.y);
      ctx.rotate(df.angle);

      // Long Segmented Needle Abdomen
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(-24, 0);
      ctx.stroke();

      // Thorax & Big Compound Eyes
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(6, -3, 3, 0, Math.PI * 2);
      ctx.arc(6, 3, 3, 0, Math.PI * 2);
      ctx.fill();

      // 4 Translucent Double Wings
      const wingWobble = Math.sin(this.wingTimer) * 3;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;

      // Forewings
      ctx.beginPath();
      ctx.ellipse(-2, -12 + wingWobble, 14, 4, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-2, 12 - wingWobble, 14, 4, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Hindwings
      ctx.beginPath();
      ctx.ellipse(-8, -10 + wingWobble, 12, 3.5, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-8, 10 - wingWobble, 12, 3.5, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${df.score}`, df.x, df.y - 24);
    }

    // 4. Header HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const df = this.playersState.get(botId);
    if (!df) return;

    // Find nearest alive mosquito
    let targetM: PondMosquito | null = null;
    let minDist = 9999;
    for (const m of this.mosquitoes) {
      if (m.alive) {
        const d = Math.hypot(m.x - df.x, m.y - df.y);
        if (d < minDist) {
          minDist = d;
          targetM = m;
        }
      }
    }

    if (targetM) {
      const dx = targetM.x - df.x;
      const dy = targetM.y - df.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 10) {
        const err = difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.2 : 0.45;
        const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * err;
        const wantDash = (difficulty === 'bot_hard' || difficulty === 'bot_normal') && dist > 70 && Math.random() < 0.1;
        this.input.setBotInput(botId, true, Math.cos(angle), -Math.sin(angle), wantDash);
      } else {
        this.input.setBotInput(botId, false, 0, 0, false);
      }
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public getScore(playerId: PlayerId): number {
    return this.playersState.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, df]) => ({ playerId, score: df.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} dominated the garden pond in high-speed dragonfly dogfights!` : 'Tied dragonfly dogfight!'
    };
  }
}
