import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface GardenAphid {
  x: number;
  y: number;
  isGolden: boolean;
  points: number;
  eaten: boolean;
}

interface LadybugPlayer {
  id: PlayerId;
  x: number;
  y: number;
  angle: number;
  wingSpread: number; // 0 to 1
  dashCooldown: number;
  score: number;
}

export class LadybugAphidHuntGame extends BaseGame {
  private aphids: GardenAphid[] = [];
  private playersState: Map<PlayerId, LadybugPlayer> = new Map();

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
    this.aphids = [];
    this.playersState.clear();

    this.spawnAphids(width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    const cx = width / 2;
    const cy = height * 0.52;

    active.forEach((p, idx) => {
      const a = (idx / count) * Math.PI * 2;
      this.playersState.set(p.id, {
        id: p.id,
        x: cx + Math.cos(a) * 80,
        y: cy + Math.sin(a) * 80,
        angle: a,
        wingSpread: 0,
        dashCooldown: 0,
        score: 0
      });
    });
  }

  private spawnAphids(width: number, height: number): void {
    for (let i = 0; i < 16; i++) {
      const isGold = i % 5 === 0;
      this.aphids.push({
        x: 60 + Math.random() * (width - 120),
        y: 80 + Math.random() * (height - 140),
        isGolden: isGold,
        points: isGold ? 35 : 15,
        eaten: false
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.dashCooldown > 0) ps.dashCooldown -= dt;
      if (ps.wingSpread > 0) ps.wingSpread = Math.max(0, ps.wingSpread - dt * 2);

      const steerX = this.input.getSteer(p.id);
      const steerY = -this.input.getThrottle(p.id);
      const mag = Math.hypot(steerX, steerY);

      if (mag > 0.2) {
        ps.angle = Math.atan2(steerY, steerX);
        const speed = 210;
        ps.x += (steerX / mag) * speed * dt;
        ps.y += (steerY / mag) * speed * dt;
      }

      // Tap to Wing Flutter Dash
      const tap = this.input.justPressed(p.id);
      if (tap && ps.dashCooldown <= 0) {
        ps.dashCooldown = 0.75;
        ps.wingSpread = 1.0;
        ps.x += Math.cos(ps.angle) * 55;
        ps.y += Math.sin(ps.angle) * 55;
        this.audio.playBounce();
        this.particles.spawnDust(ps.x, ps.y, 4);
      }

      ps.x = Math.max(30, Math.min(width - 30, ps.x));
      ps.y = Math.max(60, Math.min(height - 40, ps.y));

      // Eat aphids
      for (const a of this.aphids) {
        if (!a.eaten && Math.hypot(ps.x - a.x, ps.y - a.y) < 22) {
          a.eaten = true;
          ps.score += a.points;
          this.audio.playChomp();
          this.particles.showFloatingText(`+${a.points}`, a.x, a.y - 14, a.isGolden ? '#FBBF24' : '#84CC16', 18);
          this.particles.spawnConfetti(a.x, a.y, 6);
        }
      }
    }

    // Respawn aphids if depleted
    if (this.aphids.filter((a) => !a.eaten).length < 4) {
      this.spawnAphids(width, height);
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Giant Green Rose Leaf Backdrop
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, width * 0.7);
    bgGrad.addColorStop(0, '#15803D');
    bgGrad.addColorStop(0.7, '#166534');
    bgGrad.addColorStop(1, '#064E3B');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Leaf Rib Veins
    ctx.strokeStyle = '#22C55E';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(width / 2, 40);
    ctx.lineTo(width / 2, height - 30);
    ctx.stroke();

    ctx.lineWidth = 1.5;
    for (let y = 80; y < height - 50; y += 45) {
      ctx.beginPath();
      ctx.moveTo(width / 2, y);
      ctx.lineTo(width * 0.15, y - 25);
      ctx.moveTo(width / 2, y);
      ctx.lineTo(width * 0.85, y - 25);
      ctx.stroke();
    }

    // 2. Draw Tiny Aphids
    for (const a of this.aphids) {
      if (a.eaten) continue;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.fillStyle = a.isGolden ? '#FBBF24' : '#A3E635';
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = a.isGolden ? '#D97706' : '#65A30D';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // 3. Draw Ladybugs
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);
      ctx.rotate(ps.angle);

      // Black Head
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(10, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      // Antennae
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(14, -2);
      ctx.lineTo(20, -5);
      ctx.moveTo(14, 2);
      ctx.lineTo(20, 5);
      ctx.stroke();

      // Red Elytra Shell (splits open when flutter dashing!)
      const wingSpread = ps.wingSpread * 0.35;

      // Left wing
      ctx.save();
      ctx.rotate(-wingSpread);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(-2, -6, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Black spots
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-4, -8, 2.5, 0, Math.PI * 2);
      ctx.arc(2, -4, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Right wing
      ctx.save();
      ctx.rotate(wingSpread);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(-2, 6, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Black spots
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-4, 8, 2.5, 0, Math.PI * 2);
      ctx.arc(2, 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.restore();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y - 24);
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
    const ps = this.playersState.get(botId);
    if (!ps) return;

    // Find nearest uneaten aphid
    let nearestAphid: GardenAphid | null = null;
    let minDist = 9999;
    for (const a of this.aphids) {
      if (!a.eaten) {
        const d = Math.hypot(a.x - ps.x, a.y - ps.y);
        if (d < minDist) {
          minDist = d;
          nearestAphid = a;
        }
      }
    }

    if (nearestAphid) {
      const dx = nearestAphid.x - ps.x;
      const dy = nearestAphid.y - ps.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 8) {
        const err = difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.2 : 0.45;
        const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * err;
        const wantDash = (difficulty === 'bot_hard' || difficulty === 'bot_normal') && dist > 50 && Math.random() < 0.1;
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
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} devoured garden aphids with ladybug precision!` : 'Tied ladybug hunt!'
    };
  }
}
