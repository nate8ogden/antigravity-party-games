import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface AirRing {
  x: number;
  y: number;
  radius: number;
  collected: boolean;
}

interface Ornithopter {
  id: PlayerId;
  x: number;
  y: number;
  vy: number;
  wingAngle: number;
  wingSpeed: number;
  stamina: number; // 0 to 100
  score: number;
  stallTimer: number;
  distance: number;
}

export class OrnithopterFlockGame extends BaseGame {
  public flyers: Map<PlayerId, Ornithopter> = new Map();
  public rings: AirRing[] = [];
  public currentMapName: string = 'Neo-Victorian Sky Spire';
  private ringSpawnTimer: number = 0;
  private botFlapTimers: Map<PlayerId, number> = new Map();

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 35.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 35.0;
    this.flyers.clear();
    this.rings = [];
    this.ringSpawnTimer = 0;
    this.botFlapTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      this.flyers.set(p.id, {
        id: p.id,
        x: 80 + idx * 30,
        y: height * 0.4 + idx * 40,
        vy: 0,
        wingAngle: 0,
        wingSpeed: 0,
        stamina: 100,
        score: 0,
        stallTimer: 0,
        distance: 0
      });

      this.botFlapTimers.set(p.id, 0.2 + Math.random() * 0.2);
    });

    // Seed some rings
    for (let i = 0; i < 4; i++) {
      this.rings.push({
        x: width * 0.4 + i * 160,
        y: height * 0.3 + Math.random() * (height * 0.4),
        radius: 20,
        collected: false
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.finishRound();
      return;
    }

    this.updateBots(dt, width, height);

    // Spawn thermal rings
    this.ringSpawnTimer -= dt;
    if (this.ringSpawnTimer <= 0) {
      this.ringSpawnTimer = 1.4 + Math.random() * 0.8;
      this.rings.push({
        x: width + 30,
        y: 100 + Math.random() * (height - 180),
        radius: 22,
        collected: false
      });
    }

    // Move rings leftward
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.x -= dt * 140;
      if (r.x < -40) {
        this.rings.splice(i, 1);
      }
    }

    // Update flyers
    const gravity = 220;
    this.flyers.forEach(f => {
      f.distance += dt * 80;
      f.score = Math.round(f.distance);

      if (f.stallTimer > 0) {
        f.stallTimer -= dt;
        f.vy += gravity * 1.5 * dt;
      } else {
        f.vy += gravity * dt;

        // Flap input
        if (this.input.justPressed(f.id)) {
          if (f.vy > -160) {
            f.vy = -180;
            f.wingSpeed = 16;
            this.audio.playTone(320, 0.08, 'triangle');
            this.particles.emit(f.x - 12, f.y + 4, 3, 'rgba(255, 255, 255, 0.6)');
          } else {
            // Flapping too frantically can cause crank stress
            f.stamina -= 15;
            if (f.stamina <= 0) {
              f.stamina = 100;
              f.stallTimer = 0.8;
              this.audio.playTone(130, 0.2, 'sawtooth');
            }
          }
        }
      }

      // Recover stamina
      f.stamina = Math.min(100, f.stamina + dt * 25);

      // Wing animation
      f.wingAngle += (f.wingSpeed > 0 ? f.wingSpeed : 4) * dt;
      if (f.wingSpeed > 0) f.wingSpeed -= dt * 10;

      f.y += f.vy * dt;

      // Arena boundaries
      if (f.y < 80) { f.y = 80; f.vy = 20; }
      if (f.y > height - 40) { f.y = height - 40; f.vy = -40; }

      // Check ring collision
      this.rings.forEach(r => {
        if (!r.collected && Math.hypot(r.x - f.x, r.y - f.y) < r.radius + 12) {
          r.collected = true;
          f.score += 50;
          f.distance += 50;
          f.vy = -140; // Thermal updraft boost
          this.audio.playTone(660, 0.12, 'sine');
          this.particles.emit(r.x, r.y, 10, '#ffd700');
        }
      });
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _w: number,
    height: number
  ): void {
    const f = this.flyers.get(botId);
    if (!f || f.stallTimer > 0) return;

    let bTimer = (this.botFlapTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botFlapTimers.set(botId, bTimer);
      return;
    }

    // Target either next ring or comfortable altitude
    const nextRing = this.rings.find(r => !r.collected && r.x > f.x && r.x < f.x + 220);
    const targetY = nextRing ? nextRing.y : height * 0.45;

    if (f.y > targetY + 15 || f.vy > 120) {
      const accuracy = difficulty === 'bot_hard' ? 0.95 : difficulty === 'bot_normal' ? 0.80 : 0.60;
      if (Math.random() < accuracy) {
        this.input.triggerBotPress(botId);
        this.botFlapTimers.set(botId, difficulty === 'bot_hard' ? 0.28 : 0.38);
        return;
      }
    }

    this.botFlapTimers.set(botId, 0.12);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Steampunk Sky & Cloudscape
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#2b3342');
    grad.addColorStop(0.5, '#4f5d75');
    grad.addColorStop(1, '#6b7a94');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Distant Gothic clocktower silhouettes
    ctx.save();
    ctx.fillStyle = 'rgba(20, 24, 32, 0.35)';
    ctx.fillRect(width * 0.3, height - 120, 45, 120);
    ctx.fillRect(width * 0.75, height - 90, 55, 90);
    ctx.restore();

    // HUD Instructions
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 170, 56, 340, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#fceabb';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAP IN CADENCE TO FLAP WINGS & GLIDE THROUGH RINGS!', width * 0.5, 69);
    ctx.restore();

    // Render Thermal Brass Rings
    this.rings.forEach(r => {
      if (r.collected) return;
      ctx.save();
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Golden inner spokes
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(r.x - r.radius, r.y);
      ctx.lineTo(r.x + r.radius, r.y);
      ctx.moveTo(r.x, r.y - r.radius);
      ctx.lineTo(r.x, r.y + r.radius);
      ctx.stroke();
      ctx.restore();
    });

    // Render Ornithopters
    this.flyers.forEach(f => {
      const cfg = this.players.find(p => p.id === f.id);
      const isStalled = f.stallTimer > 0;

      ctx.save();
      ctx.translate(f.x, f.y);

      // Pitch angle based on velocity
      const pitch = Math.max(-0.4, Math.min(0.5, f.vy * 0.002));
      ctx.rotate(pitch);

      // Wings (leather membrane on wood ribbing)
      const wingSpan = Math.sin(f.wingAngle) * 16;
      ctx.fillStyle = cfg?.color || '#b87333';
      // Upper Wing
      ctx.beginPath();
      ctx.moveTo(-4, -4);
      ctx.quadraticCurveTo(8, -18 + wingSpan, 24, -12 + wingSpan * 0.5);
      ctx.quadraticCurveTo(6, -6, -4, -4);
      ctx.fill();

      // Lower Wing
      ctx.beginPath();
      ctx.moveTo(-4, 4);
      ctx.quadraticCurveTo(8, 18 - wingSpan, 24, 12 - wingSpan * 0.5);
      ctx.quadraticCurveTo(6, 6, -4, 4);
      ctx.fill();

      // Fuselage / Cockpit
      ctx.fillStyle = isStalled ? '#555555' : '#3d2817';
      ctx.beginPath();
      ctx.ellipse(4, 0, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Aviator goggles / pilot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(6, -2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.arc(7, -2, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Crank mechanism spark if stalled
      if (isStalled) {
        ctx.fillStyle = '#ff4400';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('STALLED!', 0, -22);
      }

      ctx.restore();

      // Player Score Pill
      ctx.fillStyle = cfg?.color || '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${cfg?.name || 'Player'}: ${f.score}m`, f.x - 20, f.y - 20);
    });
  }

  private finishRound(): void {
    this.isFinished = true;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.flyers.forEach((f, pId) => scores.set(pId, f.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.flyers.entries())
      .map(([playerId, f]) => ({ playerId, score: f.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} mastered the winds of the sky spire!` : 'Flock descended!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
