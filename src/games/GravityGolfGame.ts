import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Planet {
  x: number;
  y: number;
  radius: number;
  mass: number;
  color: string;
  colorRing?: string;
  hasRing?: boolean;
}

interface GolfBall {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  inHole: boolean;
  strokes: number;
  power: number;
  aimAngle: number;
  isAiming: boolean;
  powerIncreasing: boolean;
  trail: { x: number; y: number }[];
}

export class GravityGolfGame extends BaseGame {
  public balls: Map<PlayerId, GolfBall> = new Map();
  public planets: Planet[] = [];
  public holeX: number = 700;
  public holeY: number = 300;
  public holeRadius: number = 18;
  public currentMapName: string = 'Binary Nebula';

  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 45.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 45.0;
    this.isFinished = false;
    this.balls.clear();
    this.botReactionTimers.clear();
    this.planets = [];

    // Course Archetypes
    const courses = ['Binary Nebula', 'Jovian Rings', 'Asteroid Chasm'];
    this.currentMapName = courses[Math.floor(Math.random() * courses.length)];

    const cx = width * 0.5;
    const cy = height * 0.5;

    switch (this.currentMapName) {
      case 'Jovian Rings':
        this.planets = [
          { x: cx, y: cy, radius: 46, mass: 65000, color: '#F59E0B', colorRing: 'rgba(251, 191, 36, 0.45)', hasRing: true },
          { x: cx - 180, y: cy - 110, radius: 24, mass: 22000, color: '#3B82F6' },
          { x: cx + 180, y: cy + 110, radius: 24, mass: 22000, color: '#10B981' }
        ];
        this.holeX = width * 0.88;
        this.holeY = height * 0.5;
        break;

      case 'Asteroid Chasm':
        this.planets = [
          { x: cx - 100, y: cy - 130, radius: 30, mass: 35000, color: '#EC4899' },
          { x: cx + 100, y: cy + 130, radius: 30, mass: 35000, color: '#8B5CF6' },
          { x: cx, y: cy, radius: 20, mass: 18000, color: '#E2E8F0' }
        ];
        this.holeX = width * 0.86;
        this.holeY = height * 0.25;
        break;

      case 'Binary Nebula':
      default:
        this.planets = [
          { x: cx - 90, y: cy, radius: 38, mass: 48000, color: '#EF4444' },
          { x: cx + 90, y: cy, radius: 38, mass: 48000, color: '#06B6D4' }
        ];
        this.holeX = width * 0.88;
        this.holeY = height * 0.5;
        break;
    }

    // Spawn golf balls for players on the launch pad tee
    const active = this.getActivePlayers();
    const teeX = width * 0.12;
    active.forEach((p, idx) => {
      const teeY = height * 0.35 + idx * 45;
      this.balls.set(p.id, {
        id: p.id,
        x: teeX,
        y: teeY,
        vx: 0,
        vy: 0,
        radius: 8,
        inHole: false,
        strokes: 0,
        power: 0,
        aimAngle: 0,
        isAiming: true,
        powerIncreasing: true,
        trail: []
      });
      this.botReactionTimers.set(p.id, 0.4 + Math.random() * 0.3);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Update players and ball physics
    for (const p of this.getActivePlayers()) {
      const b = this.balls.get(p.id);
      if (!b || b.inHole) continue;

      const steer = this.input.getSteer(p.id);
      const isActionDown = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      const isStationary = Math.hypot(b.vx, b.vy) < 10;

      if (isStationary) {
        b.isAiming = true;
        b.vx = 0;
        b.vy = 0;

        // Aim rotation
        if (steer !== 0) {
          b.aimAngle += steer * dt * 2.8;
        }

        // Power charging oscillation
        if (isActionDown) {
          const powerSpeed = 380;
          if (b.powerIncreasing) {
            b.power += powerSpeed * dt;
            if (b.power >= 580) {
              b.power = 580;
              b.powerIncreasing = false;
            }
          } else {
            b.power -= powerSpeed * dt;
            if (b.power <= 120) {
              b.power = 120;
              b.powerIncreasing = true;
            }
          }
        } else if (b.power > 0) {
          // Release stroke!
          b.vx = Math.cos(b.aimAngle) * b.power;
          b.vy = Math.sin(b.aimAngle) * b.power;
          b.strokes += 1;
          b.power = 0;
          b.isAiming = false;
          b.powerIncreasing = true;
          this.audio.playTap();
          this.particles.spawnSparks(b.x, b.y, '#FFFFFF', 8);
        } else if (justAction && b.power === 0) {
          b.power = 120;
        }
      } else {
        b.isAiming = false;
      }

      // Gravitational physics when in motion
      if (!isStationary) {
        // Apply N-body gravitational attraction from celestial planets
        for (const pl of this.planets) {
          const dx = pl.x - b.x;
          const dy = pl.y - b.y;
          const distSq = Math.max(pl.radius * pl.radius * 0.8, dx * dx + dy * dy);
          const dist = Math.sqrt(distSq);

          const force = pl.mass / distSq;
          b.vx += (dx / dist) * force * dt;
          b.vy += (dy / dist) * force * dt;

          // Planet surface bounce
          if (dist < pl.radius + b.radius) {
            const nx = dx / dist;
            const ny = dy / dist;
            b.x = pl.x - nx * (pl.radius + b.radius);
            b.y = pl.y - ny * (pl.radius + b.radius);

            // Elastic bounce with planetary damping
            const dot = b.vx * nx + b.vy * ny;
            b.vx = (b.vx - 2 * dot * nx) * 0.65;
            b.vy = (b.vy - 2 * dot * ny) * 0.65;

            this.audio.playBounce();
            this.particles.spawnSparks(b.x, b.y, pl.color, 6);
          }
        }

        // Cosmic vacuum friction
        b.vx *= Math.pow(0.985, dt * 60);
        b.vy *= Math.pow(0.985, dt * 60);

        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // Trail recording
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 14) b.trail.shift();

        // Screen boundary bounce
        if (b.x - b.radius < 20) {
          b.x = 20 + b.radius;
          b.vx = -b.vx * 0.75;
          this.audio.playBounce();
        } else if (b.x + b.radius > width - 20) {
          b.x = width - 20 - b.radius;
          b.vx = -b.vx * 0.75;
          this.audio.playBounce();
        }

        if (b.y - b.radius < 20) {
          b.y = 20 + b.radius;
          b.vy = -b.vy * 0.75;
          this.audio.playBounce();
        } else if (b.y + b.radius > height - 20) {
          b.y = height - 20 - b.radius;
          b.vy = -b.vy * 0.75;
          this.audio.playBounce();
        }

        // Wormhole Hole-In-One Detection
        const distToHole = Math.hypot(b.x - this.holeX, b.y - this.holeY);
        if (distToHole < this.holeRadius && Math.hypot(b.vx, b.vy) < 260) {
          b.inHole = true;
          b.vx = 0;
          b.vy = 0;
          b.x = this.holeX;
          b.y = this.holeY;
          this.audio.playFanfare();
          this.particles.shake(8);
          this.particles.spawnExplosion(this.holeX, this.holeY, '#38BDF8', 28);
        }
      }
    }

    // Check round over: all active balls in hole or timer runs out
    const active = this.getActivePlayers();
    const remaining = active.filter((p) => {
      const b = this.balls.get(p.id);
      return b && !b.inHole;
    });

    if (this.roundTimer <= 0 || remaining.length === 0) {
      this.isFinished = true;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const b = this.balls.get(botId);
    if (!b || b.inHole) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;

    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    this.botReactionTimers.set(botId, 0.4 + Math.random() * 0.2);

    if (Math.hypot(b.vx, b.vy) < 10) {
      // Calculate direct angle to hole with celestial offset
      let targetAngle = Math.atan2(this.holeY - b.y, this.holeX - b.x);

      // Adjust aim to slingshot around nearest planet if blocked
      const blockingPlanet = this.planets.find((pl) => {
        const d = Math.hypot(pl.x - b.x, pl.y - b.y);
        return d < 220;
      });

      if (blockingPlanet) {
        // Curve above or below planet
        const offset = blockingPlanet.y > b.y ? -0.42 : 0.42;
        targetAngle += offset;
      }

      if (difficulty === 'bot_easy') {
        targetAngle += (Math.random() - 0.5) * 0.7;
      }

      b.aimAngle = targetAngle;
      const desiredPower = difficulty === 'bot_hard' ? 420 : 340 + Math.random() * 100;

      b.vx = Math.cos(targetAngle) * desiredPower;
      b.vy = Math.sin(targetAngle) * desiredPower;
      b.strokes += 1;
      b.isAiming = false;
      this.audio.playTap();
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const b = this.balls.get(p.id);
      let pts = 0;
      if (b) {
        if (b.inHole) {
          pts = Math.max(100, 1000 - (b.strokes - 1) * 200);
        } else {
          const dist = Math.hypot(b.x - this.holeX, b.y - this.holeY);
          pts = Math.max(10, Math.round(400 - dist * 0.6));
        }
      }
      return {
        playerId: p.id,
        score: pts,
        strokes: b?.strokes || 0,
        inHole: b?.inHole || false
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topStrokes = scores[0]?.strokes || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} sank the celestial wormhole in ${topStrokes} strokes!`
      : 'Nobody reached the gravitational wormhole!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Deep cosmic space background with starfield
    const spaceGrad = ctx.createRadialGradient(width * 0.5, height * 0.5, 40, width * 0.5, height * 0.5, width * 0.7);
    spaceGrad.addColorStop(0, '#0F172A');
    spaceGrad.addColorStop(0.6, '#0B0F19');
    spaceGrad.addColorStop(1, '#020617');
    ctx.fillStyle = spaceGrad;
    ctx.fillRect(0, 0, width, height);

    // Distant stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (let i = 0; i < 35; i++) {
      const sx = (Math.sin(i * 99) * 0.5 + 0.5) * width;
      const sy = (Math.cos(i * 33) * 0.5 + 0.5) * height;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // 2. Celestial Planets & Gravitational Halos
    for (const pl of this.planets) {
      ctx.save();
      // Gravitational field glow
      const haloGrad = ctx.createRadialGradient(pl.x, pl.y, pl.radius * 0.8, pl.x, pl.y, pl.radius * 2.8);
      haloGrad.addColorStop(0, 'rgba(56, 189, 248, 0.18)');
      haloGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, pl.radius * 2.8, 0, Math.PI * 2);
      ctx.fill();

      // Planet Sphere
      const pGrad = ctx.createRadialGradient(pl.x - pl.radius * 0.3, pl.y - pl.radius * 0.3, 4, pl.x, pl.y, pl.radius);
      pGrad.addColorStop(0, '#FFFFFF');
      pGrad.addColorStop(0.3, pl.color);
      pGrad.addColorStop(1, '#020617');
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, pl.radius, 0, Math.PI * 2);
      ctx.fill();

      // Planet Rings if present
      if (pl.hasRing && pl.colorRing) {
        ctx.strokeStyle = pl.colorRing;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(pl.x, pl.y, pl.radius * 1.8, pl.radius * 0.5, Math.PI * 0.15, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Wormhole Cup
    ctx.save();
    const holeGrad = ctx.createRadialGradient(this.holeX, this.holeY, 2, this.holeX, this.holeY, this.holeRadius * 1.4);
    holeGrad.addColorStop(0, '#000000');
    holeGrad.addColorStop(0.6, '#38BDF8');
    holeGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = holeGrad;
    ctx.beginPath();
    ctx.arc(this.holeX, this.holeY, this.holeRadius * 1.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(this.holeX, this.holeY, this.holeRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Flag Pin
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.holeX, this.holeY);
    ctx.lineTo(this.holeX, this.holeY - 26);
    ctx.stroke();

    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.moveTo(this.holeX, this.holeY - 26);
    ctx.lineTo(this.holeX + 14, this.holeY - 20);
    ctx.lineTo(this.holeX, this.holeY - 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 4. Golf Balls, Trails, and Aim Guides
    for (const b of this.balls.values()) {
      if (b.inHole) continue;

      const cfg = this.players.find((x) => x.id === b.id);
      const color = cfg ? cfg.color : '#FFFFFF';

      // Ball trail
      if (b.trail.length > 1) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        b.trail.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.restore();
      }

      // Aim Line & Gravitational Trajectory Curve
      if (b.isAiming) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);

        let simX = b.x;
        let simY = b.y;
        const curPower = Math.max(180, b.power > 0 ? b.power : 280);
        let simVx = Math.cos(b.aimAngle) * curPower;
        let simVy = Math.sin(b.aimAngle) * curPower;
        const simDt = 0.035;

        for (let step = 0; step < 14; step++) {
          for (const pl of this.planets) {
            const pdx = pl.x - simX;
            const pdy = pl.y - simY;
            const distSq = Math.max(pl.radius * pl.radius * 0.8, pdx * pdx + pdy * pdy);
            const dist = Math.sqrt(distSq);
            const force = pl.mass / distSq;
            simVx += (pdx / dist) * force * simDt;
            simVy += (pdy / dist) * force * simDt;
          }
          simX += simVx * simDt;
          simY += simVy * simDt;
          ctx.lineTo(simX, simY);
        }
        ctx.stroke();

        // Arrow head indicator at trajectory end
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(simX, simY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Golf ball sphere
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + 4, b.radius, b.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(b.x - 2, b.y - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5. Draw HUD
    this.renderHUD(ctx, width, height);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, _height: number): void {
    ctx.save();
    // Timer badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 55, 12, 110, 36, 10);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(this.roundTimer)}s`, width * 0.5, 30);

    // Player Strokes bar
    const active = this.getActivePlayers();
    const itemW = 95;
    const subBarW = active.length * itemW;
    const subBarX = width * 0.5 - subBarW * 0.5;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(subBarX, 54, subBarW, 26, 6);
    ctx.fill();

    active.forEach((p, idx) => {
      const b = this.balls.get(p.id);
      const px = subBarX + idx * itemW + itemW / 2;
      ctx.fillStyle = p.color;
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = b?.inHole ? '⛳SUNK!' : `🏌️${b?.strokes || 0}`;
      ctx.fillText(`P${p.id + 1}: ${label}`, px, 67);
    });

    ctx.restore();
  }
}
