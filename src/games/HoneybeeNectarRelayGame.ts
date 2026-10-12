import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface MeadowFlower {
  x: number;
  y: number;
  color: string;
  nectar: number; // 0 to 100
}

interface WaspThreat {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface BeePlayer {
  id: PlayerId;
  x: number;
  y: number;
  hiveX: number;
  hiveY: number;
  carriedNectar: number; // 0 to 100
  stunTimer: number;
  wingAngle: number;
  score: number;
}

export class HoneybeeNectarRelayGame extends BaseGame {
  private flowers: MeadowFlower[] = [];
  private wasps: WaspThreat[] = [];
  private playersState: Map<PlayerId, BeePlayer> = new Map();
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
    this.flowers = [];
    this.wasps = [];
    this.playersState.clear();

    // Scatter 8 flowers across meadow
    const colors = ['#F43F5E', '#A855F7', '#F59E0B', '#38BDF8'];
    for (let i = 0; i < 8; i++) {
      this.flowers.push({
        x: 80 + Math.random() * (width - 160),
        y: 80 + Math.random() * (height - 180),
        color: colors[i % colors.length],
        nectar: 100
      });
    }

    // 2 Wasps patrol
    this.wasps.push({ x: width * 0.3, y: height * 0.5, vx: 110, vy: 70 });
    this.wasps.push({ x: width * 0.7, y: height * 0.5, vx: -90, vy: 110 });

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const hx = spacing * (idx + 1);
      const hy = height - 45;
      this.playersState.set(p.id, {
        id: p.id,
        x: hx,
        y: hy - 25,
        hiveX: hx,
        hiveY: hy,
        carriedNectar: 0,
        stunTimer: 0,
        wingAngle: 0,
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.wingTimer += dt * 30;
    this.updateBots(dt, width, height);

    // Update Wasps
    for (const w of this.wasps) {
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      if (w.x < 40 || w.x > width - 40) w.vx *= -1;
      if (w.y < 60 || w.y > height - 100) w.vy *= -1;
    }

    // Flowers slowly recharge nectar
    for (const fl of this.flowers) {
      if (fl.nectar < 100) fl.nectar = Math.min(100, fl.nectar + dt * 15);
    }

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        continue;
      }

      ps.wingAngle = Math.sin(this.wingTimer) * 0.6;

      const steerX = this.input.getSteer(p.id);
      const steerY = -this.input.getThrottle(p.id);
      const mag = Math.hypot(steerX, steerY);

      if (mag > 0.2) {
        const speed = 210;
        ps.x += (steerX / mag) * speed * dt;
        ps.y += (steerY / mag) * speed * dt;
      }

      ps.x = Math.max(30, Math.min(width - 30, ps.x));
      ps.y = Math.max(50, Math.min(height - 40, ps.y));

      // Check sipping nectar from nearby flower
      if (ps.carriedNectar < 100) {
        for (const fl of this.flowers) {
          if (fl.nectar > 5 && Math.hypot(ps.x - fl.x, ps.y - fl.y) < 28) {
            const sip = Math.min(fl.nectar, dt * 50);
            fl.nectar -= sip;
            ps.carriedNectar = Math.min(100, ps.carriedNectar + sip);
            if (Math.random() < 0.2) this.audio.playBounce();
          }
        }
      }

      // Check depositing nectar in honeycomb hive
      if (ps.carriedNectar > 15 && Math.hypot(ps.x - ps.hiveX, ps.y - ps.hiveY) < 36) {
        const deposit = Math.floor(ps.carriedNectar);
        ps.carriedNectar = 0;
        ps.score += deposit;
        this.audio.playScore();
        this.particles.showFloatingText(`HONEY! +${deposit}`, ps.hiveX, ps.hiveY - 24, '#FBBF24', 22);
        this.particles.spawnConfetti(ps.hiveX, ps.hiveY, 12);
      }

      // Check colliding with wasp
      for (const w of this.wasps) {
        if (Math.hypot(ps.x - w.x, ps.y - w.y) < 26) {
          ps.stunTimer = 1.0;
          ps.carriedNectar = Math.max(0, ps.carriedNectar - 40);
          this.audio.playStun();
          this.particles.showFloatingText('WASP STING!', ps.x, ps.y - 20, '#EF4444', 20);
          this.particles.spawnExplosion(ps.x, ps.y, '#EF4444', 10);
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Wildflower Meadow Sky & Grass
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#064E3B');
    bgGrad.addColorStop(0.5, '#065F46');
    bgGrad.addColorStop(1, '#022C22');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Wildflower Blossoms
    for (const fl of this.flowers) {
      ctx.save();
      ctx.translate(fl.x, fl.y);

      // Petals
      ctx.fillStyle = fl.color;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 12, Math.sin(a) * 12, 8, 5, a, 0, Math.PI * 2);
        ctx.fill();
      }

      // Golden Nectar Center
      ctx.fillStyle = fl.nectar > 20 ? '#FBBF24' : '#78350F';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Draw Patrol Wasps
    for (const w of this.wasps) {
      ctx.save();
      ctx.translate(w.x, w.y);
      // Yellow and black striped body
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.fillRect(-3, -7, 6, 14);

      // Wasp Stinger
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(-14, -2);
      ctx.lineTo(-20, 0);
      ctx.lineTo(-14, 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 4. Draw Honeycomb Hives & Honeybees
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      // Hexagonal Honeycomb Cell
      ctx.save();
      ctx.translate(ps.hiveX, ps.hiveY);
      ctx.fillStyle = '#D97706';
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const hx = Math.cos(a) * 24;
        const hy = Math.sin(a) * 24;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 9px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HIVE', 0, 4);
      ctx.restore();

      // Honeybee
      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Wings
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.ellipse(0, -9 + ps.wingAngle * 4, 8, 4, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 9 - ps.wingAngle * 4, 8, 4, 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Bee Body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Carried Nectar Glow Basket
      if (ps.carriedNectar > 0) {
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.arc(-8, 4, 4 * (ps.carriedNectar / 100), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y - 20);
    }

    // 5. Header HUD
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
    if (!ps || ps.stunTimer > 0) return;

    // If carried nectar > 75, fly back to hive!
    let targetX = ps.hiveX;
    let targetY = ps.hiveY;

    if (ps.carriedNectar < 75) {
      // Find nearest flower with nectar
      let bestFlower: MeadowFlower | null = null;
      let minDist = 9999;
      for (const fl of this.flowers) {
        if (fl.nectar > 20) {
          const d = Math.hypot(fl.x - ps.x, fl.y - ps.y);
          if (d < minDist) {
            minDist = d;
            bestFlower = fl;
          }
        }
      }
      if (bestFlower) {
        targetX = bestFlower.x;
        targetY = bestFlower.y;
      }
    }

    const dx = targetX - ps.x;
    const dy = targetY - ps.y;
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
      mvpHighlight: winnerId ? `${winnerId} harvested the richest wildflower honey!` : 'Tied honeybee relay!'
    };
  }
}
