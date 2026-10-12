import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  points: number;
  alive: boolean;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  lastHitter: PlayerId | null;
}

interface PaddlePlayer {
  id: PlayerId;
  x: number;
  y: number;
  width: number;
  score: number;
}

export class BreakoutBrickBlasterGame extends BaseGame {
  private playersState: Map<PlayerId, PaddlePlayer> = new Map();
  private bricks: Brick[] = [];
  private ball: Ball = { x: 0, y: 0, vx: 180, vy: -220, radius: 6, lastHitter: null };

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
    this.bricks = [];

    const active = this.getActivePlayers();
    const count = active.length;
    const paddleW = Math.max(50, (width - 60) / (count * 1.5));
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height - 40,
        width: paddleW,
        score: 0
      });
    });

    this.ball = {
      x: width / 2,
      y: height - 120,
      vx: (Math.random() < 0.5 ? 180 : -180),
      vy: -240,
      radius: 6,
      lastHitter: active[0]?.id ?? null
    };

    // Build 5 rows of rainbow neon bricks
    const rows = 5;
    const cols = 8;
    const brickW = (width - 40) / cols;
    const brickH = 14;
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4'];
    const points = [5, 4, 3, 2, 1];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.bricks.push({
          x: 20 + c * brickW,
          y: 50 + r * (brickH + 4),
          w: brickW - 4,
          h: brickH,
          color: colors[r],
          points: points[r],
          alive: true
        });
      }
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Update Ball Physics
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    // Wall bounces
    if (this.ball.x - this.ball.radius < 10) {
      this.ball.x = 10 + this.ball.radius;
      this.ball.vx = Math.abs(this.ball.vx);
      this.audio.playBounce();
    }
    if (this.ball.x + this.ball.radius > width - 10) {
      this.ball.x = width - 10 - this.ball.radius;
      this.ball.vx = -Math.abs(this.ball.vx);
      this.audio.playBounce();
    }
    if (this.ball.y - this.ball.radius < 45) {
      this.ball.y = 45 + this.ball.radius;
      this.ball.vy = Math.abs(this.ball.vy);
      this.audio.playBounce();
    }

    // Ball fell below floor
    if (this.ball.y > height + 20) {
      this.ball.x = width / 2;
      this.ball.y = height - 120;
      this.ball.vx = (Math.random() < 0.5 ? 180 : -180);
      this.ball.vy = -240;
      this.audio.playBuzzer();
    }

    // Brick Collisions
    for (const b of this.bricks) {
      if (!b.alive) continue;
      if (
        this.ball.x + this.ball.radius >= b.x &&
        this.ball.x - this.ball.radius <= b.x + b.w &&
        this.ball.y + this.ball.radius >= b.y &&
        this.ball.y - this.ball.radius <= b.y + b.h
      ) {
        b.alive = false;
        this.ball.vy *= -1;

        if (this.ball.lastHitter) {
          const ps = this.playersState.get(this.ball.lastHitter);
          if (ps) ps.score += b.points;
        }

        this.audio.playExplosion();
        this.particles.emit(b.x + b.w / 2, b.y + b.h / 2, 10, b.color);
        break;
      }
    }

    // Update Players & Paddle Bounces
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      const steer = this.input.getSteer(p.id);
      ps.x += steer * 240 * dt;
      ps.x = Math.max(ps.width / 2 + 10, Math.min(width - ps.width / 2 - 10, ps.x));

      // Paddle hit ball check
      const halfW = ps.width / 2;
      if (
        this.ball.y + this.ball.radius >= ps.y - 6 &&
        this.ball.y - this.ball.radius <= ps.y + 6 &&
        this.ball.x >= ps.x - halfW &&
        this.ball.x <= ps.x + halfW &&
        this.ball.vy > 0
      ) {
        this.ball.vy = -Math.abs(this.ball.vy);
        const hitOffset = (this.ball.x - ps.x) / halfW; // -1 to +1
        this.ball.vx = hitOffset * 280;
        this.ball.lastHitter = p.id;
        this.audio.playBounce();
        this.particles.emit(this.ball.x, this.ball.y, 8, p.color);
      }
    }

    // Wave respawn if all broken
    if (this.bricks.every(b => !b.alive)) {
      for (const b of this.bricks) b.alive = true;
      this.ball.vy = -Math.abs(this.ball.vy) * 1.1;
      this.audio.playScore();
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

    // Easy bots hesitate frequently and have wider deadzones
    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false, 0, 0);
      return;
    }
    if (difficulty === 'bot_normal' && Math.random() < 0.08) {
      this.input.setBotInput(botId, false, 0, 0);
      return;
    }

    const deadzone = difficulty === 'bot_easy' ? 28 : difficulty === 'bot_normal' ? 14 : 6;
    const targetX = difficulty === 'bot_hard' ? (this.ball.x + this.ball.vx * 0.12) : this.ball.x;
    const dx = targetX - ps.x;

    if (Math.abs(dx) > deadzone) {
      this.input.setBotInput(botId, false, Math.sign(dx), 0);
    } else {
      this.input.setBotInput(botId, false, 0, 0);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Pure Black Arcade Backdrop
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    // Neon Frame
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 42, width - 16, height - 46);

    // Render Bricks
    for (const b of this.bricks) {
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // Brick highlight rim
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }

    // Render Ball
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // Ball trail
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(
      this.ball.x - this.ball.vx * 0.03,
      this.ball.y - this.ball.vy * 0.03,
      this.ball.radius * 0.7,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Render Player Paddles
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Paddle
      ctx.fillStyle = p.color;
      ctx.fillRect(-ps.width / 2, -6, ps.width, 12);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-ps.width / 2, -6, ps.width, 12);

      ctx.restore();

      // Score
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y + 22);
    }

    // Top HUD
    ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
    ctx.fillRect(0, 0, width, 36);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('BREAKOUT BRICK BLASTER', 16, 24);

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
      mvpHighlight: winnerId ? `${winnerId} smashed the most rainbow neon bricks!` : 'Demolition complete!'
    };
  }
}
