import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface BumperCar {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  boostTimer: number;
  spinTimer: number;
  score: number;
}

interface SparkPickup {
  x: number;
  y: number;
  radius: number;
  pulse: number;
}

export class BumperCarDerbyGame extends BaseGame {
  private cars: Map<PlayerId, BumperCar> = new Map();
  private pickups: SparkPickup[] = [];
  private spawnPickupTimer: number = 0;
  private arenaMargin: number = 40;

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
    this.cars.clear();
    this.pickups = [];
    this.spawnPickupTimer = 2.0;

    const active = this.getActivePlayers();
    const count = active.length;
    const cx = width / 2;
    const cy = height / 2;
    const spawnRadius = Math.min(width, height) * 0.32;

    active.forEach((p, idx) => {
      const angle = (idx / count) * Math.PI * 2;
      this.cars.set(p.id, {
        id: p.id,
        x: cx + Math.cos(angle) * spawnRadius,
        y: cy + Math.sin(angle) * spawnRadius,
        vx: 0,
        vy: 0,
        angle: angle + Math.PI,
        speed: 0,
        boostTimer: 0,
        spinTimer: 0,
        score: 0
      });
    });

    // Initial center spark battery
    this.pickups.push({ x: cx, y: cy, radius: 14, pulse: 0 });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Spawn battery pickups
    this.spawnPickupTimer -= dt;
    if (this.spawnPickupTimer <= 0 && this.pickups.length < 3) {
      this.spawnPickupTimer = 4.0;
      const margin = 80;
      this.pickups.push({
        x: margin + Math.random() * (width - margin * 2),
        y: margin + Math.random() * (height - margin * 2),
        radius: 14,
        pulse: 0
      });
    }

    // Update pickups pulse
    for (const pu of this.pickups) {
      pu.pulse += dt * 4;
    }

    const carList = Array.from(this.cars.values());

    for (const car of carList) {
      if (car.spinTimer > 0) {
        car.spinTimer -= dt;
        car.angle += dt * 10;
      } else {
        // Handle input
        const steerX = this.input.getSteer(car.id);
        const steerY = -this.input.getThrottle(car.id);
        const hasDirection = Math.hypot(steerX, steerY) > 0.2;

        if (hasDirection) {
          const targetAngle = Math.atan2(steerY, steerX);
          // Smooth rotation
          let diff = targetAngle - car.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          car.angle += diff * Math.min(1, dt * 7);

          const maxSpd = car.boostTimer > 0 ? 320 : 190;
          car.speed = Math.min(maxSpd, car.speed + 420 * dt);
        } else {
          car.speed = Math.max(0, car.speed - 300 * dt);
        }

        // Nitro Ram button tap
        if (this.input.justPressed(car.id) && car.boostTimer <= 0) {
          car.boostTimer = 0.8;
          car.speed = 360;
          this.audio.playBoost();
          this.particles.spawnConfetti(car.x, car.y, 6);
        }
      }

      if (car.boostTimer > 0) {
        car.boostTimer -= dt;
      }

      // Compute velocities from angle and speed + external rebound
      const forwardVx = Math.cos(car.angle) * car.speed;
      const forwardVy = Math.sin(car.angle) * car.speed;

      car.vx = car.vx * Math.pow(0.08, dt) + forwardVx * 0.4;
      car.vy = car.vy * Math.pow(0.08, dt) + forwardVy * 0.4;

      car.x += (forwardVx + car.vx) * dt;
      car.y += (forwardVy + car.vy) * dt;

      // Arena wall bounce with rubber bumper
      const minX = this.arenaMargin + 20;
      const maxX = width - this.arenaMargin - 20;
      const minY = this.arenaMargin + 20;
      const maxY = height - this.arenaMargin - 20;

      if (car.x < minX) {
        car.x = minX;
        car.vx = Math.abs(car.vx) + 120;
        this.audio.playBounce();
        this.particles.spawnDust(car.x, car.y, 5);
      } else if (car.x > maxX) {
        car.x = maxX;
        car.vx = -Math.abs(car.vx) - 120;
        this.audio.playBounce();
        this.particles.spawnDust(car.x, car.y, 5);
      }

      if (car.y < minY) {
        car.y = minY;
        car.vy = Math.abs(car.vy) + 120;
        this.audio.playBounce();
        this.particles.spawnDust(car.x, car.y, 5);
      } else if (car.y > maxY) {
        car.y = maxY;
        car.vy = -Math.abs(car.vy) - 120;
        this.audio.playBounce();
        this.particles.spawnDust(car.x, car.y, 5);
      }

      // Check battery pickup collisions
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const pu = this.pickups[i];
        if (Math.hypot(car.x - pu.x, car.y - pu.y) < 28) {
          car.score += 25;
          car.boostTimer = 1.2;
          this.audio.playScore();
          this.particles.showFloatingText('+25 SPARK!', pu.x, pu.y - 18, '#FBBF24', 20);
          this.particles.spawnConfetti(pu.x, pu.y, 10);
          this.pickups.splice(i, 1);
        }
      }
    }

    // Car vs Car Bumper Collisions
    for (let i = 0; i < carList.length; i++) {
      for (let j = i + 1; j < carList.length; j++) {
        const a = carList[i];
        const b = carList[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 38;

        if (dist < minDist && dist > 0.001) {
          // Normal vector
          const nx = dx / dist;
          const ny = dy / dist;

          // Separate cars
          const overlap = minDist - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          // Rebound impulse
          const reboundForce = 280;
          a.vx -= nx * reboundForce;
          a.vy -= ny * reboundForce;
          b.vx += nx * reboundForce;
          b.vy += ny * reboundForce;

          // Score determination: the car moving faster into the collision gets points
          const vA = a.speed + (a.boostTimer > 0 ? 100 : 0);
          const vB = b.speed + (b.boostTimer > 0 ? 100 : 0);

          if (vA > vB + 20) {
            a.score += 20;
            b.spinTimer = 0.4;
            this.audio.playExplosion();
            this.particles.showFloatingText('BAM! +20', a.x, a.y - 20, '#F59E0B', 20);
            this.particles.spawnExplosion(b.x, b.y, '#EF4444', 8);
          } else if (vB > vA + 20) {
            b.score += 20;
            a.spinTimer = 0.4;
            this.audio.playExplosion();
            this.particles.showFloatingText('BAM! +20', b.x, b.y - 20, '#38BDF8', 20);
            this.particles.spawnExplosion(a.x, a.y, '#EF4444', 8);
          } else {
            // Mutual bump
            a.score += 10;
            b.score += 10;
            this.audio.playBounce();
            this.particles.spawnDust((a.x + b.x) / 2, (a.y + b.y) / 2, 8);
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Electrified Steel Mesh Arena Floor
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, width * 0.6);
    bgGrad.addColorStop(0, '#1E1B4B');
    bgGrad.addColorStop(0.7, '#0F172A');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Metallic grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    const gridStep = 40;
    for (let x = 0; x < width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Rubber Perimeter Bumper Walls
    const m = this.arenaMargin;
    ctx.save();
    // Yellow & Black hazard warning strip behind bumper
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#F59E0B';
    ctx.strokeRect(m, m, width - m * 2, height - m * 2);

    // Thick Rubber Bumper Cushion
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(m + 4, m + 4, width - (m + 4) * 2, height - (m + 4) * 2);

    // Neon Guide line
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#38BDF8';
    ctx.strokeRect(m + 8, m + 8, width - (m + 8) * 2, height - (m + 8) * 2);
    ctx.restore();

    // 3. Draw Spark Battery Pickups
    for (const pu of this.pickups) {
      ctx.save();
      ctx.translate(pu.x, pu.y);
      const scale = 1 + Math.sin(pu.pulse) * 0.15;
      ctx.scale(scale, scale);

      ctx.fillStyle = 'rgba(251, 191, 36, 0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, pu.radius * 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(0, 0, pu.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Battery Lightning Bolt Glyph
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.moveTo(2, -7);
      ctx.lineTo(-4, 0);
      ctx.lineTo(0, 0);
      ctx.lineTo(-2, 7);
      ctx.lineTo(4, -1);
      ctx.lineTo(0, -1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 4. Draw Bumper Cars
    const active = this.getActivePlayers();
    for (const p of active) {
      const car = this.cars.get(p.id);
      if (!car) continue;

      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);

      // Heavy Rubber Bumper Rim
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Car Body
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = car.boostTimer > 0 ? 16 : 6;
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Headlights
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(14, -6, 3, 0, Math.PI * 2);
      ctx.arc(14, 6, 3, 0, Math.PI * 2);
      ctx.fill();

      // Cockpit / Driver Helmet
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.ellipse(-2, 0, 8, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-2, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      // Electric Pole Base
      ctx.fillStyle = '#94A3B8';
      ctx.beginPath();
      ctx.arc(-11, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Ceiling contact rod spark line
      ctx.save();
      const poleBaseX = car.x - Math.cos(car.angle) * 11;
      const poleBaseY = car.y - Math.sin(car.angle) * 11;
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(poleBaseX, poleBaseY);
      ctx.lineTo(poleBaseX, poleBaseY - 26);
      ctx.stroke();

      // Ceiling contact antenna shoe
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(poleBaseX - 5, poleBaseY - 29, 10, 4);

      // Random electric sparks
      if (Math.random() < 0.4 || car.boostTimer > 0) {
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(poleBaseX, poleBaseY - 28);
        ctx.lineTo(poleBaseX + (Math.random() - 0.5) * 12, poleBaseY - 34);
        ctx.stroke();
      }
      ctx.restore();

      // Player Score tag above car
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${car.score}`, car.x, car.y - 36);
    }

    // 5. Header HUD
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
    const car = this.cars.get(botId);
    if (!car) return;

    // Find nearest opponent
    let nearestOpponent: BumperCar | null = null;
    let minOppDist = 9999;
    for (const [id, other] of this.cars.entries()) {
      if (id !== botId) {
        const d = Math.hypot(other.x - car.x, other.y - car.y);
        if (d < minOppDist) {
          minOppDist = d;
          nearestOpponent = other;
        }
      }
    }

    // Prioritize spark pickup if nearby
    let targetX = width / 2;
    let targetY = height / 2;
    let minPuDist = 9999;
    for (const pu of this.pickups) {
      const d = Math.hypot(pu.x - car.x, pu.y - car.y);
      if (d < minPuDist) {
        minPuDist = d;
        if (minPuDist < 200) {
          targetX = pu.x;
          targetY = pu.y;
        }
      }
    }

    if (minPuDist >= 200 && nearestOpponent) {
      targetX = nearestOpponent.x;
      targetY = nearestOpponent.y;
    }

    const dx = targetX - car.x;
    const dy = targetY - car.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 15) {
      const normX = dx / dist;
      const normY = dy / dist;
      const err = difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.2 : 0.45;
      const angle = Math.atan2(normY, normX) + (Math.random() - 0.5) * err;
      const steerX = Math.cos(angle);
      const steerY = Math.sin(angle);

      // Boost if lined up with opponent on normal/hard
      const wantBoost = (difficulty === 'bot_hard' || difficulty === 'bot_normal') && dist < 120 && Math.random() < 0.08;
      this.input.setBotInput(botId, true, steerX, -steerY, wantBoost);
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public getScore(playerId: PlayerId): number {
    return this.cars.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.cars.entries())
      .map(([playerId, car]) => ({ playerId, score: car.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} dominated the bumper car derby arena!` : 'Tied derby crashes!'
    };
  }
}
