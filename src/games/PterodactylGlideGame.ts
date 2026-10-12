import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface AirRing {
  x: number;
  y: number;
  radius: number;
  isVolcanic: boolean;
  points: number;
  collected: boolean;
}

interface ThermalVent {
  x: number;
  width: number;
}

interface GliderPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vy: number;
  pitch: number;
  wingAngle: number;
  score: number;
}

export class PterodactylGlideGame extends BaseGame {
  private rings: AirRing[] = [];
  private thermals: ThermalVent[] = [];
  private playersState: Map<PlayerId, GliderPlayer> = new Map();
  private scrollOffset: number = 0;

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
    this.scrollOffset = 0;
    this.rings = [];
    this.thermals = [];
    this.playersState.clear();

    // Thermal updraft columns
    this.thermals.push({ x: width * 0.35, width: 70 });
    this.thermals.push({ x: width * 0.75, width: 70 });

    // Air rings
    this.spawnRings(width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: 60 + idx * 45,
        y: height * 0.5 + (idx - count / 2) * 40,
        vy: 0,
        pitch: 0,
        wingAngle: 0,
        score: 0
      });
    });
  }

  private spawnRings(width: number, height: number): void {
    this.rings = [];
    const ringCount = 8;
    for (let i = 0; i < ringCount; i++) {
      const isVolc = i % 3 === 0;
      this.rings.push({
        x: 180 + i * 110,
        y: 80 + Math.sin(i * 1.5) * (height * 0.28) + height * 0.28,
        radius: 20,
        isVolcanic: isVolc,
        points: isVolc ? 35 : 15,
        collected: false
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.scrollOffset += dt * 110;
    this.updateBots(dt, width, height);

    // Scroll air rings leftward
    for (const r of this.rings) {
      r.x -= 100 * dt;
      if (r.x < -40) {
        r.x = width + 40 + Math.random() * 80;
        r.y = 80 + Math.random() * (height - 180);
        r.collected = false;
      }
    }

    // Scroll thermals
    for (const th of this.thermals) {
      th.x -= 70 * dt;
      if (th.x < -th.width) {
        th.x = width + Math.random() * 100;
      }
    }

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      // Controls: Flap tap vs dive hold
      const flap = this.input.justPressed(p.id);
      const isHolding = this.input.isPressed(p.id);
      const steerY = this.input.getThrottle(p.id);

      if (flap) {
        ps.vy = -240;
        this.audio.playWhoosh();
        this.particles.spawnDust(ps.x - 10, ps.y + 10, 4);
      }

      // Dive or climb via directional or hold
      if (steerY < -0.2 || (isHolding && !flap)) {
        ps.vy += 320 * dt; // Dive forward
        ps.pitch = Math.min(0.6, ps.pitch + dt * 4);
      } else if (steerY > 0.2) {
        ps.vy -= 260 * dt; // Climb
        ps.pitch = Math.max(-0.6, ps.pitch - dt * 4);
      } else {
        // Natural glide gravity
        ps.vy += 180 * dt;
        ps.pitch += (0 - ps.pitch) * dt * 3;
      }

      // Wing flapping animation
      ps.wingAngle = Math.sin(this.scrollOffset * 0.1) * 0.4;

      // Check thermal updrafts
      for (const th of this.thermals) {
        if (Math.abs(ps.x - th.x) < th.width / 2) {
          ps.vy -= 540 * dt; // Updraft lift!
          if (Math.random() < 0.2) {
            this.audio.playBoost();
            this.particles.showFloatingText('THERMAL LIFT!', ps.x, ps.y - 18, '#F59E0B', 16);
          }
        }
      }

      ps.y += ps.vy * dt;

      // Keep within sky bounds
      if (ps.y < 50) {
        ps.y = 50;
        ps.vy = 60;
      } else if (ps.y > height - 60) {
        ps.y = height - 60;
        ps.vy = -120;
        this.audio.playBounce();
      }

      // Check ring collection
      for (const r of this.rings) {
        if (!r.collected && Math.hypot(ps.x - r.x, ps.y - r.y) < r.radius + 14) {
          r.collected = true;
          ps.score += r.points;
          this.audio.playScore();
          this.particles.showFloatingText(`+${r.points}`, r.x, r.y - 18, r.isVolcanic ? '#EF4444' : '#FBBF24', 20);
          this.particles.spawnConfetti(r.x, r.y, 10);
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Prehistoric Sunset Sky & Volcanic Smog
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#4C1D95');
    skyGrad.addColorStop(0.4, '#B91C1C');
    skyGrad.addColorStop(0.75, '#D97706');
    skyGrad.addColorStop(1, '#1C1917');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Volcanic Mountain Peaks Silhouette at Bottom
    ctx.fillStyle = '#292524';
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 60) {
      const peakH = 50 + Math.sin(x * 0.05 + 1.2) * 35;
      ctx.lineTo(x, height - peakH);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // 2. Draw Thermal Updraft Columns
    for (const th of this.thermals) {
      ctx.save();
      const grad = ctx.createLinearGradient(th.x - th.width / 2, 0, th.x + th.width / 2, 0);
      grad.addColorStop(0, 'rgba(245, 158, 11, 0)');
      grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.22)');
      grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(th.x - th.width / 2, 50, th.width, height - 100);

      // Rising heat lines
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 1.5;
      for (let y = (this.scrollOffset * 2) % 40; y < height - 100; y += 40) {
        ctx.beginPath();
        ctx.moveTo(th.x - 12, height - y);
        ctx.lineTo(th.x + 12, height - y - 18);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Draw Air Rings
    for (const r of this.rings) {
      if (r.collected) continue;
      ctx.save();
      ctx.translate(r.x, r.y);

      ctx.strokeStyle = r.isVolcanic ? '#EF4444' : '#FBBF24';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(0, 0, r.radius * 0.45, r.radius, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Golden sparkle core
      ctx.fillStyle = r.isVolcanic ? 'rgba(239, 68, 68, 0.35)' : 'rgba(251, 191, 36, 0.35)';
      ctx.fill();
      ctx.restore();
    }

    // 4. Draw Pterodactyls
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);
      ctx.rotate(ps.pitch);

      // Pterosaur Leathery Wings
      ctx.fillStyle = p.color;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;

      // Top Wing
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.quadraticCurveTo(0, -22 + ps.wingAngle * 18, 18, -12);
      ctx.lineTo(4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Bottom Wing
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.quadraticCurveTo(0, 22 - ps.wingAngle * 18, 18, 12);
      ctx.lineTo(4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Body & Long Crest Head
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.ellipse(4, 0, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Long Pterosaur Beak
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.moveTo(14, -3);
      ctx.lineTo(26, 0);
      ctx.lineTo(14, 3);
      ctx.closePath();
      ctx.fill();

      // Rear Crest Spike
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(-4, -2);
      ctx.lineTo(-18, -6);
      ctx.lineTo(-6, 2);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // Player score tag
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y - 24);
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
    if (!ps) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // Find closest ring in front of bot
    let targetRing: AirRing | null = null;
    let minXDist = 9999;
    for (const r of this.rings) {
      if (!r.collected && r.x > ps.x - 20) {
        // Hard & Normal bots avoid volcanic rings
        if (r.isVolcanic && difficulty !== 'bot_easy') continue;
        const dx = r.x - ps.x;
        if (dx < minXDist) {
          minXDist = dx;
          targetRing = r;
        }
      }
    }

    let targetY = targetRing ? targetRing.y : height * 0.5;
    if (difficulty === 'bot_easy') {
      targetY += (Math.random() - 0.5) * 45;
    }

    const dy = targetY - ps.y;
    const flapThreshold = difficulty === 'bot_easy' ? -35 : difficulty === 'bot_normal' ? -20 : -12;
    const diveThreshold = difficulty === 'bot_easy' ? 45 : difficulty === 'bot_normal' ? 30 : 16;

    if (dy < flapThreshold && ps.vy > -120) {
      // Need altitude -> flap
      this.input.setBotInput(botId, true, 0, 1, true);
    } else if (dy > diveThreshold) {
      // Need dive
      this.input.setBotInput(botId, false, 0, -1, false);
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
      mvpHighlight: winnerId ? `${winnerId} soared gracefully through the prehistoric volcanic thermals!` : 'Tied pterodactyl flight!'
    };
  }
}
