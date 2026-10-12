import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Invader {
  x: number;
  y: number;
  row: number;
  col: number;
  points: number;
  alive: boolean;
  color: string;
}

interface Bullet {
  x: number;
  y: number;
  vy: number;
  ownerId: PlayerId | null; // null if alien bomb
}

interface InvaderPlayer {
  id: PlayerId;
  x: number;
  y: number;
  score: number;
  cooldown: number;
  stunTimer: number;
}

export class PixelSpaceInvaderGame extends BaseGame {
  private playersState: Map<PlayerId, InvaderPlayer> = new Map();
  private invaders: Invader[] = [];
  private bullets: Bullet[] = [];
  private invaderDir: number = 1;
  private invaderSpeed: number = 28;
  private marchStepTimer: number = 0;
  private ufoX: number = -100;
  private ufoActive: boolean = false;
  private ufoTimer: number = 6.0;

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
    this.invaders = [];
    this.bullets = [];
    this.invaderDir = 1;
    this.invaderSpeed = 32;
    this.marchStepTimer = 0;
    this.ufoActive = false;
    this.ufoTimer = 4.0;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height - 45,
        score: 0,
        cooldown: 0,
        stunTimer: 0
      });
    });

    // 4 rows x 8 columns of invaders
    const rows = 4;
    const cols = 8;
    const colors = ['#f43f5e', '#ec4899', '#38bdf8', '#22c55e'];
    const pointValues = [30, 20, 10, 10];
    const startX = (width - cols * 32) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.invaders.push({
          x: startX + c * 34,
          y: 70 + r * 26,
          row: r,
          col: c,
          points: pointValues[r],
          alive: true,
          color: colors[r]
        });
      }
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Mystery UFO
    this.ufoTimer -= dt;
    if (this.ufoTimer <= 0 && !this.ufoActive) {
      this.ufoActive = true;
      this.ufoX = -30;
      this.ufoTimer = 9.0;
    }
    if (this.ufoActive) {
      this.ufoX += 90 * dt;
      if (this.ufoX > width + 40) {
        this.ufoActive = false;
      }
    }

    // Invader Marching Formation
    let hitEdge = false;
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      inv.x += this.invaderDir * this.invaderSpeed * dt;
      if (inv.x < 30 || inv.x > width - 30) {
        hitEdge = true;
      }
    }

    if (hitEdge) {
      this.invaderDir *= -1;
      this.invaderSpeed = Math.min(100, this.invaderSpeed + 4);
      for (const inv of this.invaders) {
        inv.y += 12;
      }
    }

    // Alien Bomb drop
    if (Math.random() < 0.04) {
      const liveInvaders = this.invaders.filter(i => i.alive);
      if (liveInvaders.length > 0) {
        const shooter = liveInvaders[Math.floor(Math.random() * liveInvaders.length)];
        this.bullets.push({
          x: shooter.x,
          y: shooter.y + 10,
          vy: 140,
          ownerId: null
        });
      }
    }

    // Update Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y += b.vy * dt;

      // Offscreen check
      if (b.y < 35 || b.y > height) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Player laser hitting invaders / UFO
      if (b.ownerId !== null) {
        let hit = false;

        // Check UFO
        if (this.ufoActive && Math.hypot(b.x - this.ufoX, b.y - 50) < 18) {
          const ps = this.playersState.get(b.ownerId);
          if (ps) ps.score += 50;
          this.ufoActive = false;
          this.audio.playScore();
          this.particles.emit(this.ufoX, 50, 18, '#fbbf24');
          this.bullets.splice(i, 1);
          continue;
        }

        // Check Invaders
        for (const inv of this.invaders) {
          if (!inv.alive) continue;
          if (Math.hypot(b.x - inv.x, b.y - inv.y) < 14) {
            inv.alive = false;
            hit = true;
            const ps = this.playersState.get(b.ownerId);
            if (ps) ps.score += inv.points;
            this.audio.playExplosion();
            this.particles.emit(inv.x, inv.y, 12, inv.color);
            break;
          }
        }

        if (hit) {
          this.bullets.splice(i, 1);
          continue;
        }
      } else {
        // Alien bomb hitting players
        for (const p of this.getActivePlayers()) {
          const ps = this.playersState.get(p.id);
          if (!ps || ps.stunTimer > 0) continue;
          if (Math.hypot(b.x - ps.x, b.y - ps.y) < 16) {
            ps.stunTimer = 1.2;
            ps.score = Math.max(0, ps.score - 5);
            this.audio.playBuzzer();
            this.particles.shake(0.3);
            this.particles.emit(ps.x, ps.y, 14, '#ef4444');
            this.bullets.splice(i, 1);
            break;
          }
        }
      }
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        continue;
      }

      if (ps.cooldown > 0) {
        ps.cooldown -= dt;
      }

      const steer = this.input.getSteer(p.id);
      const isPressed = this.input.isPressed(p.id);

      ps.x += steer * 190 * dt;
      ps.x = Math.max(30, Math.min(width - 30, ps.x));

      // Shoot
      if (isPressed && ps.cooldown <= 0) {
        ps.cooldown = 0.35;
        this.bullets.push({
          x: ps.x,
          y: ps.y - 14,
          vy: -320,
          ownerId: p.id
        });
        this.audio.playLaser();
      }
    }

    // Respawn wave if all destroyed
    if (this.invaders.every(i => !i.alive)) {
      this.resetWave(width);
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private resetWave(width: number): void {
    const cols = 8;
    const startX = (width - cols * 32) / 2;
    for (const inv of this.invaders) {
      inv.alive = true;
      inv.x = startX + inv.col * 34;
      inv.y = 70 + inv.row * 26;
    }
    this.invaderSpeed += 8;
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.stunTimer > 0) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false, 0, 0);
      return;
    }

    // Dodge falling bombs
    const canDodgeBomb = difficulty === 'bot_easy' ? Math.random() < 0.65 : true;
    if (canDodgeBomb) {
      for (const b of this.bullets) {
        if (b.ownerId === null && Math.abs(b.x - ps.x) < 24 && b.y < ps.y && ps.y - b.y < 120) {
          const dodgeDir = ps.x < b.x ? -1 : 1;
          this.input.setBotInput(botId, false, dodgeDir, 0);
          return;
        }
      }
    }

    // Line up under lowest alive invader or UFO
    let targetX = ps.x;
    if (this.ufoActive) {
      targetX = this.ufoX;
    } else {
      const live = this.invaders.filter(i => i.alive);
      if (live.length > 0) {
        // Find closest horizontal invader
        let minDx = Infinity;
        for (const inv of live) {
          const dx = Math.abs(inv.x - ps.x);
          if (dx < minDx) {
            minDx = dx;
            targetX = inv.x;
          }
        }
      }
    }

    if (difficulty === 'bot_easy') {
      targetX += (Math.random() - 0.5) * 40;
    } else if (difficulty === 'bot_normal') {
      targetX += (Math.random() - 0.5) * 16;
    }

    const deadzone = difficulty === 'bot_easy' ? 28 : difficulty === 'bot_normal' ? 18 : 8;
    const steer = Math.abs(targetX - ps.x) > deadzone ? Math.sign(targetX - ps.x) : 0;
    const fire = Math.abs(targetX - ps.x) < (deadzone + 12);
    this.input.setBotInput(botId, fire, steer, 0);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Pure 80s Arcade Black Space Screen
    ctx.fillStyle = '#05050a';
    ctx.fillRect(0, 0, width, height);

    // Retro green floor scanline
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height - 20);
    ctx.lineTo(width, height - 20);
    ctx.stroke();

    // Mystery UFO at Top
    if (this.ufoActive) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.ellipse(this.ufoX, 50, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.ellipse(this.ufoX, 48, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render Invaders
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      ctx.fillStyle = inv.color;

      // Pixelated classic invader glyph
      const s = 3;
      const ox = inv.x - 12;
      const oy = inv.y - 8;

      // 8x6 pixel grid sprite
      ctx.fillRect(ox + 4, oy, 8, s);
      ctx.fillRect(ox + 2, oy + s, 12, s);
      ctx.fillRect(ox, oy + s * 2, 16, s);
      ctx.fillRect(ox + 2, oy + s * 3, 12, s);
      ctx.fillRect(ox, oy + s * 4, 4, s);
      ctx.fillRect(ox + 12, oy + s * 4, 4, s);
    }

    // Render Bullets
    for (const b of this.bullets) {
      if (b.ownerId !== null) {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(b.x - 1.5, b.y, 3, 10);
      } else {
        // Red zig-zag alien bomb
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(b.x - 2, b.y, 4, 7);
      }
    }

    // Render Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Player Arcade Laser Tank
      ctx.fillStyle = p.color;
      // Base tread
      ctx.fillRect(-15, 2, 30, 8);
      // Turret dome
      ctx.fillRect(-9, -4, 18, 6);
      // Laser Cannon barrel
      ctx.fillRect(-2, -12, 4, 8);

      if (ps.stunTimer > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('*HIT*', 0, -18);
      }

      ctx.restore();

      // Score
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y + 18);
    }

    // Top HUD
    ctx.fillStyle = 'rgba(5, 5, 10, 0.9)';
    ctx.fillRect(0, 0, width, 36);
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('PIXEL SPACE INVADER', 16, 24);

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
      mvpHighlight: winnerId ? `${winnerId} blasted the most pixel space invaders!` : 'The invasion was repelled!'
    };
  }
}
