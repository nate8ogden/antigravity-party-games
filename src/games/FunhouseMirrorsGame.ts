import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface MirrorPane {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: 'FLAT' | 'WAVY' | 'CONCAVE';
}

interface MirrorPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  staggerTimer: number;
  score: number;
}

interface PrizeCoin {
  x: number;
  y: number;
  radius: number;
  collected: boolean;
}

export class FunhouseMirrorsGame extends BaseGame {
  private mirrors: MirrorPane[] = [];
  private playersState: Map<PlayerId, MirrorPlayer> = new Map();
  private coins: PrizeCoin[] = [];
  private exitX: number = 0;
  private exitY: number = 0;
  private exitRadius: number = 28;

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
    this.mirrors = [];
    this.coins = [];
    this.playersState.clear();

    this.exitX = width / 2;
    this.exitY = 60;

    // Create maze of mirror panels
    const cx = width / 2;
    const cy = height * 0.52;

    this.mirrors.push(
      { x1: cx - 140, y1: cy - 90, x2: cx - 40, y2: cy - 90, type: 'WAVY' },
      { x1: cx + 40, y1: cy - 90, x2: cx + 140, y2: cy - 90, type: 'CONCAVE' },
      { x1: cx - 180, y1: cy + 10, x2: cx - 60, y2: cy + 10, type: 'FLAT' },
      { x1: cx + 60, y1: cy + 10, x2: cx + 180, y2: cy + 10, type: 'WAVY' },
      { x1: cx - 100, y1: cy + 110, x2: cx + 100, y2: cy + 110, type: 'CONCAVE' },
      { x1: cx - 100, y1: cy - 90, x2: cx - 100, y2: cy + 10, type: 'FLAT' },
      { x1: cx + 100, y1: cy - 90, x2: cx + 100, y2: cy + 10, type: 'FLAT' }
    );

    // Scatter prize coins
    const coinLocs = [
      { x: cx - 120, y: cy - 40 },
      { x: cx + 120, y: cy - 40 },
      { x: cx, y: cy - 40 },
      { x: cx - 60, y: cy + 60 },
      { x: cx + 60, y: cy + 60 },
      { x: cx, y: cy + 150 }
    ];
    for (const c of coinLocs) {
      this.coins.push({ x: c.x, y: c.y, radius: 10, collected: false });
    }

    const active = this.getActivePlayers();
    const count = active.length;
    active.forEach((p, idx) => {
      const startX = cx - 120 + idx * 80;
      const startY = height - 50;
      this.playersState.set(p.id, {
        id: p.id,
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        radius: 14,
        staggerTimer: 0,
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.staggerTimer > 0) {
        ps.staggerTimer -= dt;
        continue;
      }

      // Read movement input
      let moveX = this.input.getSteer(p.id);
      let moveY = -this.input.getThrottle(p.id);
      if (Math.hypot(moveX, moveY) < 0.2) {
        if (this.input.isPressed(p.id)) {
          moveY = -1; // Single-button holds move upward
        }
      }

      const speed = 190;
      ps.vx = moveX * speed;
      ps.vy = moveY * speed;

      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Arena walls
      ps.x = Math.max(ps.radius + 10, Math.min(width - ps.radius - 10, ps.x));
      ps.y = Math.max(ps.radius + 10, Math.min(height - ps.radius - 10, ps.y));

      // Mirror reflection collision (bounce & comical stagger)
      for (const m of this.mirrors) {
        const dist = this.distToSegment(ps.x, ps.y, m.x1, m.y1, m.x2, m.y2);
        if (dist < ps.radius + 3) {
          ps.staggerTimer = 0.35;
          ps.vx *= -0.5;
          ps.vy *= -0.5;
          ps.x += (Math.random() - 0.5) * 8;
          ps.y += (Math.random() - 0.5) * 8;
          this.audio.playBounce();
          this.particles.showFloatingText('BONK!', ps.x, ps.y - 18, '#F43F5E', 18);
        }
      }

      // Collect Coins
      for (const coin of this.coins) {
        if (!coin.collected && Math.hypot(ps.x - coin.x, ps.y - coin.y) < ps.radius + coin.radius) {
          coin.collected = true;
          ps.score += 15;
          this.audio.playScore();
          this.particles.spawnConfetti(coin.x, coin.y, 8);
        }
      }

      // Reach Exit
      if (Math.hypot(ps.x - this.exitX, ps.y - this.exitY) < ps.radius + this.exitRadius) {
        ps.score += 50;
        this.audio.playFanfare();
        this.particles.shake(0.3);
        this.particles.showFloatingText('EXIT REACHED!! +50', this.exitX, this.exitY - 20, '#10B981', 24);
        // Reset player to start for another loop
        ps.y = height - 50;
        // Respawn coins
        this.coins.forEach((c) => (c.collected = false));
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Psychedelic Funhouse Wallpaper
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // Diagonal checkerboard carnival floor
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    const tileSize = 36;
    for (let x = 0; x < width; x += tileSize) {
      for (let y = 0; y < height; y += tileSize) {
        if ((Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0) {
          ctx.fillRect(x, y, tileSize, tileSize);
        }
      }
    }
    ctx.restore();

    // 2. Draw Golden Exit Portal
    ctx.save();
    ctx.fillStyle = '#F59E0B';
    ctx.shadowColor = '#FDE047';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(this.exitX, this.exitY, this.exitRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', this.exitX, this.exitY + 4);
    ctx.restore();

    // 3. Draw Mirror Panes with Glass Shimmer
    for (const m of this.mirrors) {
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(m.x1, m.y1);
      ctx.lineTo(m.x2, m.y2);
      ctx.stroke();

      // Mirror frame clips
      ctx.fillStyle = '#FBBF24';
      ctx.fillRect(m.x1 - 4, m.y1 - 4, 8, 8);
      ctx.fillRect(m.x2 - 4, m.y2 - 4, 8, 8);
      ctx.restore();
    }

    // 4. Draw Prize Coins
    for (const c of this.coins) {
      if (c.collected) continue;
      ctx.save();
      ctx.fillStyle = '#FBBF24';
      ctx.shadowColor = '#FBBF24';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#78350F';
      ctx.font = 'bold 9px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', c.x, c.y + 3);
      ctx.restore();
    }

    // 5. Draw Players and Funhouse Optical Clones
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      // Draw Funhouse Distorted Optical Clones around active mirrors
      for (let i = 0; i < this.mirrors.length; i += 2) {
        const m = this.mirrors[i];
        const cloneX = m.x1 + (m.x2 - m.x1) * 0.5 + (m.x1 - ps.x) * 0.45;
        const cloneY = m.y1 + (ps.y - m.y1) * 0.35;

        ctx.save();
        ctx.globalAlpha = 0.32;
        ctx.fillStyle = p.color;
        // Squished or elongated mirror reflection
        const scaleY = i % 4 === 0 ? 1.6 : 0.6;
        const scaleX = i % 4 === 0 ? 0.6 : 1.4;
        ctx.beginPath();
        ctx.ellipse(cloneX, cloneY, ps.radius * scaleX, ps.radius * scaleY, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw Real Player
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(ps.x, ps.y, ps.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Stagger stars if bonked
      if (ps.staggerTimer > 0) {
        ctx.fillStyle = '#FDE047';
        ctx.font = '12px sans-serif';
        ctx.fillText('💫', ps.x - 6, ps.y - 14);
      }
      ctx.restore();
    }

    // 6. Header HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 30);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps) return;

    // Target nearest uncollected coin or exit
    const uncollected = this.coins.filter((c) => !c.collected);
    const target = uncollected.length > 0 ? uncollected[0] : { x: this.exitX, y: this.exitY };

    const dx = target.x - ps.x;
    const dy = target.y - ps.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 10) {
      const err = difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.2 : 0.45;
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * err;
      this.input.setBotInput(botId, true, Math.cos(angle), -Math.sin(angle), true);
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
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} mastered the funhouse mirrors maze!` : 'No exits escaped!'
    };
  }
}
