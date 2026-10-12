import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';

interface BumperCar {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVel: number;
  radius: number;
  shields: number;
  maxShields: number;
  superChargeTimer: number;
  invulnTimer: number;
  alive: boolean;
  score: number;
}

interface PinballBumper {
  x: number;
  y: number;
  radius: number;
  pulseTimer: number;
  color: string;
}

interface BatteryDrop {
  x: number;
  y: number;
  active: boolean;
  respawnTimer: number;
}

export class BumperHovercraftGame extends BaseGame {
  private cars: Map<PlayerId, BumperCar> = new Map();
  private arena = { x: 0, y: 0, w: 0, h: 0 };
  private pinballBumpers: PinballBumper[] = [];
  private batteries: BatteryDrop[] = [];
  private eliminationOrder: PlayerId[] = [];
  private electricPulseTimer: number = 0;

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 60;
    this.isFinished = false;
    this.cars.clear();
    this.eliminationOrder = [];
    this.electricPulseTimer = 0;

    // Enclosed Octagonal/Rounded Demolition Rink
    const marginX = Math.max(24, width * 0.1);
    const marginY = Math.max(50, height * 0.1);
    this.arena = {
      x: marginX,
      y: marginY,
      w: width - marginX * 2,
      h: height - marginY * 2
    };

    const cx = width / 2;
    const cy = height / 2;

    // Procedural Random Map Generation
    this.generateRandomMap(cx, cy);

    // Spawn active players in arena corners facing center
    const active = this.getActivePlayers();
    const spawnOffsets = [
      { x: this.arena.x + 60, y: this.arena.y + 60 },
      { x: this.arena.x + this.arena.w - 60, y: this.arena.y + 60 },
      { x: this.arena.x + 60, y: this.arena.y + this.arena.h - 60 },
      { x: this.arena.x + this.arena.w - 60, y: this.arena.y + this.arena.h - 60 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnOffsets[idx % spawnOffsets.length];
      const aimAngle = Math.atan2(cy - pos.y, cx - pos.x);
      this.cars.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: aimAngle,
        angularVel: 2.4, // Idle rotational steering
        radius: 24,
        shields: 3,
        maxShields: 3,
        superChargeTimer: 0,
        invulnTimer: 0,
        alive: true,
        score: 0
      });
    });
  }

  public currentMapName: string = 'Cross Pinball';

  private generateRandomMap(cx: number, cy: number): void {
    const archetypes = ['Cross Pinball', 'Diamond Derby', 'Dual Slalom', 'Pinball Scatter'];
    this.currentMapName = archetypes[Math.floor(Math.random() * archetypes.length)];
    this.pinballBumpers = [];
    this.batteries = [];

    const aw = this.arena.w;
    const ah = this.arena.h;

    switch (this.currentMapName) {
      case 'Cross Pinball':
        this.pinballBumpers = [
          { x: cx, y: cy, radius: 30, pulseTimer: 0, color: '#F59E0B' },
          { x: cx - aw * 0.24, y: cy, radius: 24, pulseTimer: 0, color: '#38BDF8' },
          { x: cx + aw * 0.24, y: cy, radius: 24, pulseTimer: 0, color: '#EC4899' },
          { x: cx, y: cy - ah * 0.26, radius: 22, pulseTimer: 0, color: '#10B981' },
          { x: cx, y: cy + ah * 0.26, radius: 22, pulseTimer: 0, color: '#A855F7' }
        ];
        this.batteries = [
          { x: cx - aw * 0.32, y: cy - ah * 0.28, active: true, respawnTimer: 0 },
          { x: cx + aw * 0.32, y: cy - ah * 0.28, active: true, respawnTimer: 0 },
          { x: cx - aw * 0.32, y: cy + ah * 0.28, active: true, respawnTimer: 0 },
          { x: cx + aw * 0.32, y: cy + ah * 0.28, active: true, respawnTimer: 0 }
        ];
        break;

      case 'Diamond Derby':
        // Diamond formation of 4 bumpers + central battery cache
        this.pinballBumpers = [
          { x: cx - aw * 0.18, y: cy - ah * 0.18, radius: 26, pulseTimer: 0, color: '#06B6D4' },
          { x: cx + aw * 0.18, y: cy - ah * 0.18, radius: 26, pulseTimer: 0, color: '#F43F5E' },
          { x: cx - aw * 0.18, y: cy + ah * 0.18, radius: 26, pulseTimer: 0, color: '#10B981' },
          { x: cx + aw * 0.18, y: cy + ah * 0.18, radius: 26, pulseTimer: 0, color: '#EAB308' },
          { x: cx, y: cy, radius: 20, pulseTimer: 0, color: '#8B5CF6' }
        ];
        this.batteries = [
          { x: cx, y: cy - ah * 0.32, active: true, respawnTimer: 0 },
          { x: cx, y: cy + ah * 0.32, active: true, respawnTimer: 0 },
          { x: cx - aw * 0.32, y: cy, active: true, respawnTimer: 0 },
          { x: cx + aw * 0.32, y: cy, active: true, respawnTimer: 0 }
        ];
        break;

      case 'Dual Slalom':
        // Two massive bumpers dividing the arena + 4 perimeter rebound pegs
        this.pinballBumpers = [
          { x: cx - aw * 0.12, y: cy, radius: 32, pulseTimer: 0, color: '#EC4899' },
          { x: cx + aw * 0.12, y: cy, radius: 32, pulseTimer: 0, color: '#3B82F6' },
          { x: cx - aw * 0.28, y: cy - ah * 0.24, radius: 20, pulseTimer: 0, color: '#F59E0B' },
          { x: cx + aw * 0.28, y: cy - ah * 0.24, radius: 20, pulseTimer: 0, color: '#10B981' },
          { x: cx - aw * 0.28, y: cy + ah * 0.24, radius: 20, pulseTimer: 0, color: '#8B5CF6' },
          { x: cx + aw * 0.28, y: cy + ah * 0.24, radius: 20, pulseTimer: 0, color: '#06B6D4' }
        ];
        this.batteries = [
          { x: cx, y: cy - ah * 0.28, active: true, respawnTimer: 0 },
          { x: cx, y: cy + ah * 0.28, active: true, respawnTimer: 0 }
        ];
        break;

      case 'Pinball Scatter':
      default:
        // 6 randomized bumpers with safe central zone
        const colors = ['#F59E0B', '#38BDF8', '#EC4899', '#10B981', '#A855F7', '#EF4444'];
        this.pinballBumpers.push({ x: cx, y: cy, radius: 28, pulseTimer: 0, color: '#FACC15' });
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2 + 0.3;
          const dist = Math.min(aw, ah) * 0.28;
          this.pinballBumpers.push({
            x: cx + Math.cos(ang) * dist,
            y: cy + Math.sin(ang) * dist,
            radius: 22 + (i % 2) * 4,
            pulseTimer: 0,
            color: colors[i % colors.length]
          });
        }
        this.batteries = [
          { x: cx - aw * 0.28, y: cy - ah * 0.26, active: true, respawnTimer: 0 },
          { x: cx + aw * 0.28, y: cy + ah * 0.26, active: true, respawnTimer: 0 },
          { x: cx, y: cy - ah * 0.30, active: true, respawnTimer: 0 }
        ];
        break;
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.electricPulseTimer += dt * 5;

    // Update Bumpers & Batteries
    for (const b of this.pinballBumpers) {
      if (b.pulseTimer > 0) b.pulseTimer = Math.max(0, b.pulseTimer - dt * 3);
    }
    for (const bat of this.batteries) {
      if (!bat.active) {
        bat.respawnTimer -= dt;
        if (bat.respawnTimer <= 0) {
          bat.active = true;
          this.particles.spawnSparks(bat.x, bat.y, '#FACC15', 12);
        }
      }
    }

    this.updateBots(dt, width, height);

    // Update Cars Physics & Input
    for (const car of this.cars.values()) {
      if (!car.alive) continue;

      if (car.invulnTimer > 0) car.invulnTimer = Math.max(0, car.invulnTimer - dt);
      if (car.superChargeTimer > 0) car.superChargeTimer = Math.max(0, car.superChargeTimer - dt);

      const isThrusting = this.input.isPressed(car.id);
      const steer = this.input.getSteer(car.id);

      // Steering: direct steer if steering key pressed, else auto-rotate when not thrusting
      if (steer !== 0) {
        car.angle += steer * 4.2 * dt;
      } else if (!isThrusting) {
        car.angle += car.angularVel * dt;
      }

      // Thrusting
      if (isThrusting) {
        const thrust = car.superChargeTimer > 0 ? 560 : 380;
        car.vx += Math.cos(car.angle) * thrust * dt;
        car.vy += Math.sin(car.angle) * thrust * dt;

        // Exhaust sparks
        if (Math.random() < 0.4) {
          const tailX = car.x - Math.cos(car.angle) * (car.radius + 4);
          const tailY = car.y - Math.sin(car.angle) * (car.radius + 4);
          const pColor = car.superChargeTimer > 0 ? '#FACC15' : this.players[car.id]?.color || '#38BDF8';
          this.particles.spawnSparks(tailX, tailY, pColor, 1);
        }
      }

      // Drag friction
      car.vx *= Math.pow(0.88, dt * 60);
      car.vy *= Math.pow(0.88, dt * 60);

      // Position step
      car.x += car.vx * dt;
      car.y += car.vy * dt;

      // Arena Wall Collisions (Electric Cushioned Rails)
      const minX = this.arena.x + car.radius;
      const maxX = this.arena.x + this.arena.w - car.radius;
      const minY = this.arena.y + car.radius;
      const maxY = this.arena.y + this.arena.h - car.radius;

      let hitWall = false;
      if (car.x < minX) {
        car.x = minX;
        car.vx = -car.vx * 0.75;
        hitWall = true;
      } else if (car.x > maxX) {
        car.x = maxX;
        car.vx = -car.vx * 0.75;
        hitWall = true;
      }

      if (car.y < minY) {
        car.y = minY;
        car.vy = -car.vy * 0.75;
        hitWall = true;
      } else if (car.y > maxY) {
        car.y = maxY;
        car.vy = -car.vy * 0.75;
        hitWall = true;
      }

      if (hitWall) {
        this.audio.playBounce();
        this.particles.spawnSparks(car.x, car.y, '#38BDF8', 6);
      }

      // Pinball Bumper Collisions
      for (const b of this.pinballBumpers) {
        const dx = car.x - b.x;
        const dy = car.y - b.y;
        const dist = Math.hypot(dx, dy);
        const minDist = car.radius + b.radius;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          // Position correction
          car.x = b.x + nx * minDist;
          car.y = b.y + ny * minDist;

          // Propel outward with high bounce velocity
          const bounceSpeed = Math.max(340, Math.hypot(car.vx, car.vy) * 1.5);
          car.vx = nx * bounceSpeed;
          car.vy = ny * bounceSpeed;

          b.pulseTimer = 1.0;
          this.audio.playBounce();
          this.particles.spawnSparks(b.x + nx * b.radius, b.y + ny * b.radius, b.color, 14);
          this.particles.addTrauma(0.2);
          car.score += 50;
        }
      }

      // Battery Pickups
      for (const bat of this.batteries) {
        if (!bat.active) continue;
        if (Math.hypot(car.x - bat.x, car.y - bat.y) < car.radius + 18) {
          bat.active = false;
          bat.respawnTimer = 10;
          car.superChargeTimer = 4.5;
          car.shields = Math.min(car.maxShields, car.shields + 1);
          car.score += 100;
          this.audio.playBoost();
          this.particles.spawnSparks(bat.x, bat.y, '#FACC15', 20);
        }
      }
    }

    // Car-to-Car Bumper Collisions
    const carList = Array.from(this.cars.values()).filter((c) => c.alive);
    for (let i = 0; i < carList.length; i++) {
      for (let j = i + 1; j < carList.length; j++) {
        const c1 = carList[i];
        const c2 = carList[j];

        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = c1.radius + c2.radius;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Push apart
          const overlap = (minDist - dist) / 2;
          c1.x -= nx * overlap;
          c1.y -= ny * overlap;
          c2.x += nx * overlap;
          c2.y += ny * overlap;

          // Impact velocities along collision normal
          const v1n = c1.vx * nx + c1.vy * ny;
          const v2n = c2.vx * nx + c2.vy * ny;
          const relativeSpeed = Math.abs(v1n - v2n);

          // Elastic collision response
          const restitution = 1.35;
          const impulse = (-(1 + restitution) * (v1n - v2n)) / 2;
          c1.vx -= impulse * nx;
          c1.vy -= impulse * ny;
          c2.vx += impulse * nx;
          c2.vy += impulse * ny;

          this.audio.playBounce();
          this.particles.spawnSparks((c1.x + c2.x) / 2, (c1.y + c2.y) / 2, '#FFFFFF', 10);
          this.particles.addTrauma(Math.min(0.4, relativeSpeed * 0.001));

          // Shield Damage logic: fast ramming car damages the slower one
          if (relativeSpeed > 140) {
            const c1IsAttacker = (v1n > 0 && Math.abs(v1n) > Math.abs(v2n)) || c1.superChargeTimer > 0;
            const c2IsAttacker = (v2n < 0 && Math.abs(v2n) > Math.abs(v1n)) || c2.superChargeTimer > 0;

            if (c1IsAttacker && !c2IsAttacker && c2.invulnTimer <= 0) {
              this.damageCar(c2, c1);
            } else if (c2IsAttacker && !c1IsAttacker && c1.invulnTimer <= 0) {
              this.damageCar(c1, c2);
            } else if (c1.invulnTimer <= 0 && c2.invulnTimer <= 0) {
              // Mutual clash
              this.damageCar(c1, c2);
              this.damageCar(c2, c1);
            }
          }
        }
      }
    }

    // Check round over condition (last surviving car wins)
    const aliveCars = Array.from(this.cars.values()).filter((c) => c.alive);
    if ((aliveCars.length <= 1 && this.cars.size > 1) || (aliveCars.length === 0) || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private damageCar(target: BumperCar, attacker: BumperCar) {
    target.shields = Math.max(0, target.shields - 1);
    target.invulnTimer = 0.6;
    attacker.score += 150;
    this.audio.playExplosion();
    this.particles.spawnExplosion(target.x, target.y, '#EF4444', 18);
    this.particles.addTrauma(0.3);

    if (target.shields <= 0) {
      target.alive = false;
      this.eliminationOrder.push(target.id);
      this.particles.spawnExplosion(target.x, target.y, '#EF4444', 36);
      attacker.score += 300;
    }
  }

  /**
   * Smart, tactical Bot AI:
   * - Eliminates suicidal kamikaze rushes
   * - Avoids pinball bumpers and electric walls
   * - Prioritizes battery repair drops when damaged
   * - Maneuvers to ram rivals toward walls/pinball bumpers
   */
  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const car = this.cars.get(botId);
    if (!car || !car.alive) return;

    let targetX = width / 2;
    let targetY = height / 2;
    let prioritizeBattery = false;

    // 1. If damaged (shields < 3), seek nearest active battery drop
    if (car.shields < car.maxShields) {
      let nearestBat: BatteryDrop | null = null;
      let minBatDist = Infinity;
      for (const bat of this.batteries) {
        if (bat.active) {
          const d = Math.hypot(bat.x - car.x, bat.y - car.y);
          if (d < minBatDist) {
            minBatDist = d;
            nearestBat = bat;
          }
        }
      }
      if (nearestBat && minBatDist < 350) {
        targetX = nearestBat.x;
        targetY = nearestBat.y;
        prioritizeBattery = true;
      }
    }

    // 2. If healthy or no battery, find strategic rival target
    if (!prioritizeBattery) {
      let nearestRival: BumperCar | null = null;
      let minRivalDist = Infinity;

      for (const other of this.cars.values()) {
        if (other.id !== botId && other.alive) {
          const d = Math.hypot(other.x - car.x, other.y - car.y);
          if (d < minRivalDist) {
            minRivalDist = d;
            nearestRival = other;
          }
        }
      }

      if (nearestRival) {
        // When low on health (shields === 1), don't kamikaze charge; keep distance and wait
        if (car.shields === 1 && difficulty !== 'bot_easy') {
          // Circle away from nearest rival toward open space
          const fleeX = car.x + (car.x - nearestRival.x);
          const fleeY = car.y + (car.y - nearestRival.y);
          targetX = Math.max(this.arena.x + 50, Math.min(this.arena.x + this.arena.w - 50, fleeX));
          targetY = Math.max(this.arena.y + 50, Math.min(this.arena.y + this.arena.h - 50, fleeY));
        } else {
          // Attack: Calculate intercept lead
          const leadMultiplier = difficulty === 'bot_hard' ? 0.35 : difficulty === 'bot_normal' ? 0.2 : 0.05;
          targetX = nearestRival.x + nearestRival.vx * leadMultiplier;
          targetY = nearestRival.y + nearestRival.vy * leadMultiplier;
        }
      }
    }

    // 3. Obstacle avoidance: steer away if heading directly into an electric wall
    const margin = 55;
    if (car.x < this.arena.x + margin && car.vx < -40) targetX = this.arena.x + 120;
    if (car.x > this.arena.x + this.arena.w - margin && car.vx > 40) targetX = this.arena.x + this.arena.w - 120;
    if (car.y < this.arena.y + margin && car.vy < -40) targetY = this.arena.y + 120;
    if (car.y > this.arena.y + this.arena.h - margin && car.vy > 40) targetY = this.arena.y + this.arena.h - 120;

    // Angle calculation
    const desiredAngle = Math.atan2(targetY - car.y, targetX - car.x);
    let angleDiff = desiredAngle - car.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // Steer towards target angle: turn left (-1) or right (+1)
    const steer = Math.abs(angleDiff) > 0.08 ? (angleDiff > 0 ? 1 : -1) : 0;
    const alignTolerance = difficulty === 'bot_hard' ? 0.35 : difficulty === 'bot_normal' ? 0.55 : 0.85;
    const shouldThrust = Math.abs(angleDiff) < alignTolerance;

    this.input.setBotInput(botId, shouldThrust, steer, 0, false);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const survivors = Array.from(this.cars.values()).filter((c) => c.alive);
    const winnerId = survivors.length === 1 ? survivors[0].id : (this.eliminationOrder[this.eliminationOrder.length - 1] ?? null);

    const rankedIds = [...survivors.map((s) => s.id), ...[...this.eliminationOrder].reverse()];

    return {
      winnerId,
      rankings: rankedIds.map((pid, idx) => ({
        playerId: pid,
        score: idx === 0 ? 100 : Math.max(0, 80 - idx * 25),
        place: idx + 1
      })),
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} CRUSHED THE DEMOLITION DERBY!` : 'MUTUAL DEMOLITION!'
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // Dark Neon Stadium Floor
    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(0, 0, width, height);

    // Neon Floor Grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    const step = 32;
    for (let x = this.arena.x; x <= this.arena.x + this.arena.w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, this.arena.y);
      ctx.lineTo(x, this.arena.y + this.arena.h);
      ctx.stroke();
    }
    for (let y = this.arena.y; y <= this.arena.y + this.arena.h; y += step) {
      ctx.beginPath();
      ctx.moveTo(this.arena.x, y);
      ctx.lineTo(this.arena.x + this.arena.w, y);
      ctx.stroke();
    }

    // Outer Electric Cushioned Wall
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 10;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(this.arena.x, this.arena.y, this.arena.w, this.arena.h, 24);
      ctx.stroke();
    } else {
      ctx.strokeRect(this.arena.x, this.arena.y, this.arena.w, this.arena.h);
    }
    ctx.shadowBlur = 0;

    // Corner Warning Stripes
    const stripeSize = 28;
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(this.arena.x, this.arena.y, stripeSize, 6);
    ctx.fillRect(this.arena.x, this.arena.y, 6, stripeSize);
    ctx.fillRect(this.arena.x + this.arena.w - stripeSize, this.arena.y, stripeSize, 6);
    ctx.fillRect(this.arena.x + this.arena.w - 6, this.arena.y, 6, stripeSize);
    ctx.fillRect(this.arena.x, this.arena.y + this.arena.h - 6, stripeSize, 6);
    ctx.fillRect(this.arena.x, this.arena.y + this.arena.h - stripeSize, 6, stripeSize);
    ctx.fillRect(this.arena.x + this.arena.w - stripeSize, this.arena.y + this.arena.h - 6, stripeSize, 6);
    ctx.fillRect(this.arena.x + this.arena.w - 6, this.arena.y + this.arena.h - stripeSize, 6, stripeSize);

    // Render Floor Battery Drops
    for (const bat of this.batteries) {
      if (!bat.active) continue;
      ctx.save();
      ctx.fillStyle = '#FACC15';
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(bat.x, bat.y, 11, 0, Math.PI * 2);
      ctx.fill();

      // Battery Lightning Bolt symbol
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.moveTo(bat.x - 2, bat.y - 7);
      ctx.lineTo(bat.x + 4, bat.y - 1);
      ctx.lineTo(bat.x, bat.y - 1);
      ctx.lineTo(bat.x + 2, bat.y + 7);
      ctx.lineTo(bat.x - 4, bat.y + 1);
      ctx.lineTo(bat.x, bat.y + 1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Render Pinball Bumpers
    for (const b of this.pinballBumpers) {
      ctx.save();
      const currentRad = b.radius + (b.pulseTimer > 0 ? Math.sin(b.pulseTimer * Math.PI) * 6 : 0);

      // Outer ring
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = b.pulseTimer > 0 ? 18 : 8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, currentRad, 0, Math.PI * 2);
      ctx.fill();

      // Center core
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(b.x, b.y, currentRad * 0.58, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(b.x, b.y, currentRad * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Bumper Cars
    for (const car of this.cars.values()) {
      if (!car.alive) continue;
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);

      const pColor = this.players[car.id]?.color || '#FFFFFF';

      // Super charge aura
      if (car.superChargeTimer > 0) {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#FACC15';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, car.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Outer Rubber Bumper Ring
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(0, 0, car.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Car Body
      ctx.fillStyle = pColor;
      ctx.beginPath();
      ctx.arc(0, 0, car.radius * 0.75, 0, Math.PI * 2);
      ctx.fill();

      // Front Headlights with illuminated beam cones
      ctx.save();
      const beamGrad = ctx.createRadialGradient(car.radius * 0.65, 0, 2, car.radius * 0.65 + 35, 0, 45);
      beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
      beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(car.radius * 0.6, -10);
      ctx.lineTo(car.radius * 0.6 + 45, -25);
      ctx.lineTo(car.radius * 0.6 + 45, 25);
      ctx.lineTo(car.radius * 0.6, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(car.radius * 0.65, -8, 3.5, 0, Math.PI * 2);
      ctx.arc(car.radius * 0.65, 8, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Driver Cockpit with Equipped Mascot Driver
      const mood = car.invulnTimer > 0 ? 'shocked' : car.superChargeTimer > 0 ? 'triumph' : 'focused';
      this.drawPlayerMascot(ctx, car.id, -2, 0, car.radius * 0.52, mood, performance.now() * 0.001, 0);

      // Shield Pips (3 glowing orbs around the rear bumper)
      for (let s = 0; s < car.maxShields; s++) {
        const sAngle = Math.PI - 0.6 + s * 0.6;
        const sx = Math.cos(sAngle) * (car.radius - 2);
        const sy = Math.sin(sAngle) * (car.radius - 2);
        ctx.fillStyle = s < car.shields ? '#22C55E' : '#475569';
        ctx.beginPath();
        ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Player Name & Shield Bar
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.players[car.id].name, car.x, car.y - car.radius - 8);

      // Mini Shield Bar
      const barW = 32;
      const barH = 4;
      const barX = car.x - barW / 2;
      const barY = car.y - car.radius - 4;
      ctx.fillStyle = '#334155';
      ctx.fillRect(barX, barY, barW, barH);
      const shieldRatio = car.shields / car.maxShields;
      ctx.fillStyle = shieldRatio > 0.6 ? '#22C55E' : shieldRatio > 0.3 ? '#F59E0B' : '#EF4444';
      ctx.fillRect(barX, barY, barW * shieldRatio, barH);
      ctx.restore();
    }

    ctx.restore();
  }
}
