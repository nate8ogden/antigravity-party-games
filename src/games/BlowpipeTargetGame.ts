import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface BlowDart {
  playerId: PlayerId;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
}

interface JungleTarget {
  x: number;
  y: number;
  radius: number;
  vx: number;
  type: 'STONE_MASK' | 'GOLDEN_SUN';
  points: number;
}

interface ShooterState {
  id: PlayerId;
  aimAngle: number; // in radians
  aimDir: number; // 1 or -1
  breathPower: number; // 0 to 1
  isBreathing: boolean;
  score: number;
}

export class BlowpipeTargetGame extends BaseGame {
  private darts: BlowDart[] = [];
  private targets: JungleTarget[] = [];
  private shooters: Map<PlayerId, ShooterState> = new Map();

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
    this.darts = [];
    this.targets = [];
    this.shooters.clear();

    // Populate jungle ruin targets across upper screen
    const targetCount = 6;
    for (let i = 0; i < targetCount; i++) {
      const isSun = i % 2 === 0;
      this.targets.push({
        x: 60 + i * (width / targetCount),
        y: 80 + (i % 3) * 45,
        radius: isSun ? 22 : 18,
        vx: (i % 2 === 0 ? 1 : -1) * (60 + i * 20),
        type: isSun ? 'GOLDEN_SUN' : 'STONE_MASK',
        points: isSun ? 40 : 25
      });
    }

    const active = this.getActivePlayers();
    active.forEach((p) => {
      this.shooters.set(p.id, {
        id: p.id,
        aimAngle: -Math.PI / 2,
        aimDir: 1,
        breathPower: 0,
        isBreathing: false,
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Update targets
    for (const t of this.targets) {
      t.x += t.vx * dt;
      if (t.x < t.radius + 20) {
        t.x = t.radius + 20;
        t.vx = Math.abs(t.vx);
      } else if (t.x > width - t.radius - 20) {
        t.x = width - t.radius - 20;
        t.vx = -Math.abs(t.vx);
      }
    }

    const active = this.getActivePlayers();
    const count = active.length;
    const stationW = width / count;

    // Update shooters
    active.forEach((p, idx) => {
      const sh = this.shooters.get(p.id);
      if (!sh) return;
      const stationX = stationW * idx + stationW / 2;
      const stationY = height - 45;

      // Oscillate aim angle between -120 deg and -60 deg
      const minA = -Math.PI * 0.75;
      const maxA = -Math.PI * 0.25;
      sh.aimAngle += sh.aimDir * dt * 2.2;
      if (sh.aimAngle > maxA) {
        sh.aimAngle = maxA;
        sh.aimDir = -1;
      } else if (sh.aimAngle < minA) {
        sh.aimAngle = minA;
        sh.aimDir = 1;
      }

      // Hold to build lung power, release to fire
      const isPressed = this.input.isPressed(p.id);
      const justReleased = this.input.justReleased(p.id);

      if (isPressed) {
        sh.isBreathing = true;
        sh.breathPower = Math.min(1.0, sh.breathPower + dt * 1.8);
      } else if (justReleased || (!isPressed && sh.isBreathing)) {
        sh.isBreathing = false;
        const power = Math.max(0.3, sh.breathPower);
        const speed = 400 + power * 350;

        this.darts.push({
          playerId: p.id,
          color: p.color,
          x: stationX + Math.cos(sh.aimAngle) * 35,
          y: stationY + Math.sin(sh.aimAngle) * 35,
          vx: Math.cos(sh.aimAngle) * speed,
          vy: Math.sin(sh.aimAngle) * speed,
          alive: true
        });

        sh.breathPower = 0;
        this.audio.playWhoosh();
      }
    });

    // Update flying darts
    for (let i = this.darts.length - 1; i >= 0; i--) {
      const d = this.darts[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;

      // Check collision with targets
      for (const t of this.targets) {
        if (Math.hypot(d.x - t.x, d.y - t.y) < t.radius) {
          const sh = this.shooters.get(d.playerId);
          if (sh) sh.score += t.points;

          this.audio.playScore();
          this.particles.showFloatingText(`+${t.points}`, t.x, t.y - 18, '#FBBF24', 22);
          this.particles.spawnConfetti(t.x, t.y, 10);
          d.alive = false;
          // Reposition target to top
          t.x = 40 + Math.random() * (width - 80);
          break;
        }
      }

      if (!d.alive || d.y < 30 || d.x < 10 || d.x > width - 10) {
        this.darts.splice(i, 1);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Ancient Mayan Jungle Ruins
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#064E3B');
    bgGrad.addColorStop(0.6, '#065F46');
    bgGrad.addColorStop(1, '#022C22');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Carved Stone Temple Columns at sides
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 28, height);
    ctx.fillRect(width - 28, 0, 28, height);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 28, height);
    ctx.strokeRect(width - 28, 0, 28, height);

    // 2. Draw Jungle Targets
    for (const t of this.targets) {
      ctx.save();
      ctx.translate(t.x, t.y);

      if (t.type === 'GOLDEN_SUN') {
        // Golden Sun Disk
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Sun Ray Spikes
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * t.radius, Math.sin(a) * t.radius);
          ctx.lineTo(Math.cos(a) * (t.radius + 6), Math.sin(a) * (t.radius + 6));
          ctx.stroke();
        }
      } else {
        // Carved Stone Mask
        ctx.fillStyle = '#64748B';
        ctx.beginPath();
        ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Carved Eye Slits
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-8, -4, 5, 3);
        ctx.fillRect(3, -4, 5, 3);
        ctx.fillRect(-5, 4, 10, 3);
      }
      ctx.restore();
    }

    // 3. Draw Flying Darts
    for (const d of this.darts) {
      ctx.save();
      ctx.translate(d.x, d.y);
      const angle = Math.atan2(d.vy, d.vx);
      ctx.rotate(angle);

      // Dart feather fletching
      ctx.fillStyle = d.color;
      ctx.fillRect(-12, -2, 6, 4);

      // Bamboo shaft & needle point
      ctx.fillStyle = '#D97706';
      ctx.fillRect(-6, -1, 14, 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(8, -2);
      ctx.lineTo(14, 0);
      ctx.lineTo(8, 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 4. Draw Blowpipe Stations & Players
    const active = this.getActivePlayers();
    const count = active.length;
    const stationW = width / count;

    active.forEach((p, idx) => {
      const sh = this.shooters.get(p.id);
      if (!sh) return;
      const stationX = stationW * idx + stationW / 2;
      const stationY = height - 45;

      // Platform
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(stationX - stationW * 0.44, stationY - 14, stationW * 0.88, 55);
      ctx.fillStyle = p.color;
      ctx.fillRect(stationX - stationW * 0.44, stationY - 14, stationW * 0.88, 4);

      // Bamboo Blowpipe
      ctx.save();
      ctx.translate(stationX, stationY);
      ctx.rotate(sh.aimAngle);

      ctx.fillStyle = '#D97706';
      ctx.fillRect(0, -3, 34, 6);
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0, -3, 34, 6);

      // Mouthpiece
      ctx.fillStyle = p.color;
      ctx.fillRect(-4, -5, 6, 10);
      ctx.restore();

      // Lung Power Gauge
      if (sh.isBreathing) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(stationX - 25, stationY - 32, 50, 6);
        ctx.fillStyle = '#10B981';
        ctx.fillRect(stationX - 25, stationY - 32, 50 * sh.breathPower, 6);
      }

      // Player Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${sh.score}`, stationX, stationY + 24);
    });

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
    const sh = this.shooters.get(botId);
    if (!sh) return;

    const active = this.getActivePlayers();
    const idx = active.findIndex((p) => p.id === botId);
    const stationW = width / active.length;
    const stationX = stationW * idx + stationW / 2;
    const stationY = height - 45;

    // Check if aiming towards any target
    let isAligned = false;
    for (const t of this.targets) {
      const targetAngle = Math.atan2(t.y - stationY, t.x - stationX);
      const tol = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.22 : 0.35;
      if (Math.abs(sh.aimAngle - targetAngle) < tol) {
        isAligned = true;
        break;
      }
    }

    if (isAligned) {
      // Release dart!
      this.input.setBotInput(botId, false, 0, 0, false);
    } else {
      // Inhale/charge breath
      this.input.setBotInput(botId, true, 0, 0, false);
    }
  }

  public getScore(playerId: PlayerId): number {
    return this.shooters.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.shooters.entries())
      .map(([playerId, sh]) => ({ playerId, score: sh.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} struck the jungle ruin masks with pinpoint dart accuracy!` : 'Tied target shooting!'
    };
  }
}
