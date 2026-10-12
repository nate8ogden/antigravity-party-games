import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface MinerShip {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  cargo: number; // Gems currently carried (0..5)
  bankedScore: number;
  drillSpin: number;
  bumpCooldown: number;
  respawnTimer: number;
  alive: boolean;
}

interface Asteroid {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  health: number;
  maxHealth: number;
  tier: 1 | 2; // 2 = big (breaks into shards), 1 = small
  color: string;
  angle: number;
  spin: number;
}

interface GemShard {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  color: string;
  glowColor: string;
  sparkleTimer: number;
  magnetTarget: PlayerId | null;
}

interface SalvageDepot {
  playerId: PlayerId;
  x: number;
  y: number;
  radius: number;
  color: string;
  pulseTimer: number;
}

export class AsteroidMinerGame extends BaseGame {
  private ships: Map<PlayerId, MinerShip> = new Map();
  private asteroids: Asteroid[] = [];
  private gems: GemShard[] = [];
  private depots: SalvageDepot[] = [];
  private nextAsteroidId = 1;
  private nextGemId = 1;
  private asteroidSpawnTimer = 2.0;
  private starfield: { x: number; y: number; r: number; alpha: number }[] = [];

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.roundTimer = 50;
    this.isFinished = false;
    this.ships.clear();
    this.asteroids = [];
    this.gems = [];
    this.depots = [];
    this.nextAsteroidId = 1;
    this.nextGemId = 1;
    this.asteroidSpawnTimer = 1.0;

    // Generate parallax ambient stars
    this.starfield = [];
    for (let i = 0; i < 60; i++) {
      this.starfield.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.8 + Math.random() * 1.6,
        alpha: 0.3 + Math.random() * 0.7
      });
    }

    const active = this.getActivePlayers();
    const depotCornerOffsets = [
      { x: 100, y: 100 },
      { x: width - 100, y: 100 },
      { x: 100, y: height - 100 },
      { x: width - 100, y: height - 100 }
    ];

    active.forEach((p, idx) => {
      const corner = depotCornerOffsets[idx % depotCornerOffsets.length];
      const aimAngle = Math.atan2(height / 2 - corner.y, width / 2 - corner.x);

      this.depots.push({
        playerId: p.id,
        x: corner.x,
        y: corner.y,
        radius: 46,
        color: p.color,
        pulseTimer: 0
      });

      this.ships.set(p.id, {
        id: p.id,
        x: corner.x + Math.cos(aimAngle) * 35,
        y: corner.y + Math.sin(aimAngle) * 35,
        vx: 0,
        vy: 0,
        angle: aimAngle,
        radius: 20,
        cargo: 0,
        bankedScore: 0,
        drillSpin: 0,
        bumpCooldown: 0,
        respawnTimer: 0,
        alive: true
      });
    });

    // Initial asteroid cluster
    for (let i = 0; i < 6; i++) {
      this.spawnAsteroid(width, height, 2);
    }
    for (let i = 0; i < 4; i++) {
      this.spawnAsteroid(width, height, 1);
    }
  }

  private spawnAsteroid(width: number, height: number, tier: 1 | 2): void {
    const cx = width / 2;
    const cy = height / 2;
    // Spawn towards central area avoiding exact depot corners
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * Math.min(width, height) * 0.28;
    const ax = cx + Math.cos(angle) * dist;
    const ay = cy + Math.sin(angle) * dist;

    const speed = tier === 2 ? 15 + Math.random() * 25 : 30 + Math.random() * 40;
    const moveAngle = Math.random() * Math.PI * 2;

    const asteroidColors = ['#94A3B8', '#A78BFA', '#38BDF8', '#FBBF24'];
    const col = asteroidColors[Math.floor(Math.random() * asteroidColors.length)];

    this.asteroids.push({
      id: this.nextAsteroidId++,
      x: ax,
      y: ay,
      vx: Math.cos(moveAngle) * speed,
      vy: Math.sin(moveAngle) * speed,
      radius: tier === 2 ? 30 : 18,
      health: tier === 2 ? 3 : 1,
      maxHealth: tier === 2 ? 3 : 1,
      tier,
      color: col,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 1.5
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Periodic asteroid replenish
    this.asteroidSpawnTimer -= dt;
    if (this.asteroidSpawnTimer <= 0 && this.asteroids.length < 9) {
      this.spawnAsteroid(width, height, Math.random() < 0.6 ? 2 : 1);
      this.asteroidSpawnTimer = 3.5;
    }

    // Pulse depots
    for (const d of this.depots) {
      d.pulseTimer += dt * 3;
    }

    // Update Bots AI
    this.updateBots(dt, width, height);

    // Update Ships
    for (const ship of this.ships.values()) {
      if (!ship.alive) {
        ship.respawnTimer -= dt;
        if (ship.respawnTimer <= 0) {
          ship.alive = true;
          const depot = this.depots.find((d) => d.playerId === ship.id);
          if (depot) {
            ship.x = depot.x;
            ship.y = depot.y;
            ship.vx = 0;
            ship.vy = 0;
            this.particles.spawnExplosion(ship.x, ship.y, '#38BDF8', 15);
          }
        }
        continue;
      }

      if (ship.bumpCooldown > 0) {
        ship.bumpCooldown -= dt;
      }

      const isThrusting = this.input.isPressed(ship.id);
      const steer = this.input.getSteer(ship.id);

      // Steering
      if (steer !== 0) {
        ship.angle += steer * 3.8 * dt;
      } else if (!isThrusting) {
        // Subtle rotational cruise drift when idle
        ship.angle += 1.8 * dt;
      }

      // Drill spin
      ship.drillSpin += 14 * dt;

      // Thrust
      if (isThrusting) {
        const thrustPower = 340;
        ship.vx += Math.cos(ship.angle) * thrustPower * dt;
        ship.vy += Math.sin(ship.angle) * thrustPower * dt;

        // Thruster flame sparks
        if (Math.random() < 0.45) {
          const exhaustX = ship.x - Math.cos(ship.angle) * (ship.radius + 6);
          const exhaustY = ship.y - Math.sin(ship.angle) * (ship.radius + 6);
          const pCol = this.players[ship.id]?.color || '#F59E0B';
          this.particles.spawnSparks(exhaustX, exhaustY, pCol, 1);
        }
      }

      // Space friction
      ship.vx *= 0.985;
      ship.vy *= 0.985;

      // Velocity clamp
      const maxSpd = 260;
      const curSpd = Math.hypot(ship.vx, ship.vy);
      if (curSpd > maxSpd) {
        ship.vx = (ship.vx / curSpd) * maxSpd;
        ship.vy = (ship.vy / curSpd) * maxSpd;
      }

      // Position update
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;

      // Arena bounds bounce
      const minX = ship.radius + 15;
      const maxX = width - ship.radius - 15;
      const minY = ship.radius + 15;
      const maxY = height - ship.radius - 15;

      if (ship.x < minX) {
        ship.x = minX;
        ship.vx = Math.abs(ship.vx) * 0.7;
      } else if (ship.x > maxX) {
        ship.x = maxX;
        ship.vx = -Math.abs(ship.vx) * 0.7;
      }

      if (ship.y < minY) {
        ship.y = minY;
        ship.vy = Math.abs(ship.vy) * 0.7;
      } else if (ship.y > maxY) {
        ship.y = maxY;
        ship.vy = -Math.abs(ship.vy) * 0.7;
      }

      // Check Depot Banking
      const myDepot = this.depots.find((d) => d.playerId === ship.id);
      if (myDepot && ship.cargo > 0) {
        const distDepot = Math.hypot(ship.x - myDepot.x, ship.y - myDepot.y);
        if (distDepot < myDepot.radius + ship.radius) {
          ship.bankedScore += ship.cargo;
          this.audio.playTone(587.33, 0.08, 'triangle'); // D5
          setTimeout(() => this.audio.playTone(880.0, 0.12, 'sine'), 90); // A5
          this.particles.spawnExplosion(myDepot.x, myDepot.y, '#10B981', ship.cargo * 6);
          ship.cargo = 0;
        }
      }
    }

    // Ship-to-Ship Collisions
    const shipList = Array.from(this.ships.values()).filter((s) => s.alive);
    for (let i = 0; i < shipList.length; i++) {
      for (let j = i + 1; j < shipList.length; j++) {
        const s1 = shipList[i];
        const s2 = shipList[j];
        const dx = s2.x - s1.x;
        const dy = s2.y - s1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = s1.radius + s2.radius + 4;

        if (dist < minDist && dist > 0.01) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Push apart
          const overlap = minDist - dist;
          s1.x -= nx * overlap * 0.5;
          s1.y -= ny * overlap * 0.5;
          s2.x += nx * overlap * 0.5;
          s2.y += ny * overlap * 0.5;

          // Elastic bounce
          const kx = s1.vx - s2.vx;
          const ky = s1.vy - s2.vy;
          const p = 2 * (nx * kx + ny * ky) / 2;
          s1.vx -= p * nx * 1.2;
          s1.vy -= p * ny * 1.2;
          s2.vx += p * nx * 1.2;
          s2.vy += p * ny * 1.2;

          this.audio.playTone(160, 0.08, 'square');
          this.particles.spawnSparks((s1.x + s2.x) / 2, (s1.y + s2.y) / 2, '#FFFFFF', 6);

          // Kinetic impact: cargo spills!
          if (s1.bumpCooldown <= 0 && s1.cargo > 0 && Math.random() < 0.6) {
            s1.cargo--;
            s1.bumpCooldown = 0.8;
            this.dropGem(s1.x, s1.y, -nx * 120, -ny * 120);
          }
          if (s2.bumpCooldown <= 0 && s2.cargo > 0 && Math.random() < 0.6) {
            s2.cargo--;
            s2.bumpCooldown = 0.8;
            this.dropGem(s2.x, s2.y, nx * 120, ny * 120);
          }
        }
      }
    }

    // Update Asteroids
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const ast = this.asteroids[i];
      ast.x += ast.vx * dt;
      ast.y += ast.vy * dt;
      ast.angle += ast.spin * dt;

      // Wrap around arena borders
      if (ast.x < -ast.radius) ast.x = width + ast.radius;
      else if (ast.x > width + ast.radius) ast.x = -ast.radius;
      if (ast.y < -ast.radius) ast.y = height + ast.radius;
      else if (ast.y > height + ast.radius) ast.y = -ast.radius;

      // Check collision with ship drills
      for (const ship of shipList) {
        const drillTipX = ship.x + Math.cos(ship.angle) * (ship.radius + 8);
        const drillTipY = ship.y + Math.sin(ship.angle) * (ship.radius + 8);
        const distDrill = Math.hypot(drillTipX - ast.x, drillTipY - ast.y);

        if (distDrill < ast.radius + 8) {
          // Drill impact!
          ast.health--;
          this.audio.playTone(220, 0.06, 'sawtooth');
          this.particles.spawnSparks(drillTipX, drillTipY, ast.color, 8);

          // Push asteroid away from drill
          const pushAngle = Math.atan2(ast.y - ship.y, ast.x - ship.x);
          ast.vx += Math.cos(pushAngle) * 90;
          ast.vy += Math.sin(pushAngle) * 90;
          ship.vx -= Math.cos(pushAngle) * 40;
          ship.vy -= Math.sin(pushAngle) * 40;

          if (ast.health <= 0) {
            // Shatter into gems!
            this.shatterAsteroid(ast);
            this.asteroids.splice(i, 1);
            break;
          }
        }
      }
    }

    // Update Gems
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const gem = this.gems[i];
      gem.x += gem.vx * dt;
      gem.y += gem.vy * dt;
      gem.vx *= 0.96;
      gem.vy *= 0.96;
      gem.sparkleTimer += dt * 4;

      // Keep inside bounds
      if (gem.x < 15) { gem.x = 15; gem.vx *= -0.5; }
      else if (gem.x > width - 15) { gem.x = width - 15; gem.vx *= -0.5; }
      if (gem.y < 15) { gem.y = 15; gem.vy *= -0.5; }
      else if (gem.y > height - 15) { gem.y = height - 15; gem.vy *= -0.5; }

      // Magnetism toward closest ship with cargo room
      let closestDist = 95;
      let targetShip: MinerShip | null = null;
      for (const ship of shipList) {
        if (ship.cargo >= 5) continue;
        const d = Math.hypot(ship.x - gem.x, ship.y - gem.y);
        if (d < closestDist) {
          closestDist = d;
          targetShip = ship;
        }
      }

      gem.magnetTarget = targetShip ? targetShip.id : null;

      if (targetShip) {
        const pull = 220;
        const angle = Math.atan2(targetShip.y - gem.y, targetShip.x - gem.x);
        gem.vx += Math.cos(angle) * pull * dt;
        gem.vy += Math.sin(angle) * pull * dt;

        // Collection check
        if (closestDist < targetShip.radius + 10) {
          targetShip.cargo = Math.min(5, targetShip.cargo + 1);
          this.audio.playTone(784, 0.07, 'sine'); // G5
          this.particles.spawnSparks(gem.x, gem.y, gem.color, 6);
          this.gems.splice(i, 1);
          continue;
        }
      }
    }

    // Check game over
    if (this.roundTimer <= 0) {
      this.isFinished = true;
    } else {
      for (const s of this.ships.values()) {
        if (s.bankedScore >= 10) {
          this.isFinished = true;
          break;
        }
      }
    }
  }

  private shatterAsteroid(ast: Asteroid): void {
    this.audio.playTone(180, 0.14, 'square');
    this.particles.spawnExplosion(ast.x, ast.y, ast.color, ast.tier === 2 ? 22 : 12);

    const shardCount = ast.tier === 2 ? 4 : 2;
    for (let s = 0; s < shardCount; s++) {
      const angle = (s / shardCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const spd = 60 + Math.random() * 80;
      this.dropGem(ast.x, ast.y, Math.cos(angle) * spd, Math.sin(angle) * spd);
    }
  }

  private dropGem(x: number, y: number, vx: number, vy: number): void {
    const gemColors = [
      { color: '#EF4444', glow: 'rgba(239, 68, 68, 0.6)' }, // Ruby
      { color: '#10B981', glow: 'rgba(16, 185, 129, 0.6)' }, // Emerald
      { color: '#38BDF8', glow: 'rgba(56, 189, 248, 0.6)' }, // Sapphire
      { color: '#F59E0B', glow: 'rgba(245, 158, 11, 0.6)' } // Topaz
    ];
    const pick = gemColors[Math.floor(Math.random() * gemColors.length)];

    this.gems.push({
      id: this.nextGemId++,
      x,
      y,
      vx,
      vy,
      value: 1,
      color: pick.color,
      glowColor: pick.glow,
      sparkleTimer: Math.random() * 6.28,
      magnetTarget: null
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ship = this.ships.get(botId);
    if (!ship || !ship.alive) return;

    const depot = this.depots.find((d) => d.playerId === botId);
    const isEasy = difficulty === 'bot_easy';
    const isNormal = difficulty === 'bot_normal';
    const isHard = difficulty === 'bot_hard';

    let targetX = width / 2;
    let targetY = height / 2;

    // Decision logic: if cargo is high (or >= 3 on normal/hard), head back to deposit!
    const shouldBank = (ship.cargo >= 4) || (ship.cargo >= 3 && !isEasy) || (this.roundTimer < 8 && ship.cargo > 0);

    if (shouldBank && depot) {
      targetX = depot.x;
      targetY = depot.y;
    } else if (this.gems.length > 0 && ship.cargo < 5) {
      // Go for closest gem
      let bestDist = Infinity;
      for (const gem of this.gems) {
        const d = Math.hypot(gem.x - ship.x, gem.y - ship.y);
        if (d < bestDist) {
          bestDist = d;
          targetX = gem.x;
          targetY = gem.y;
        }
      }
    } else if (this.asteroids.length > 0) {
      // Go mine an asteroid!
      let bestDist = Infinity;
      for (const ast of this.asteroids) {
        const d = Math.hypot(ast.x - ship.x, ast.y - ship.y);
        if (d < bestDist) {
          bestDist = d;
          // Aim drill at asteroid
          targetX = ast.x;
          targetY = ast.y;
        }
      }
    }

    // Hard AI: Ram opponents who have high cargo if we are empty and close
    if (isHard && ship.cargo <= 1) {
      for (const [otherId, otherShip] of this.ships.entries()) {
        if (otherId !== ship.id && otherShip.alive && otherShip.cargo >= 3) {
          const d = Math.hypot(otherShip.x - ship.x, otherShip.y - ship.y);
          if (d < 180) {
            targetX = otherShip.x;
            targetY = otherShip.y;
            break;
          }
        }
      }
    }

    // Steering math
    const targetAngle = Math.atan2(targetY - ship.y, targetX - ship.x);
    let angleDiff = targetAngle - ship.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // Simulated button press
    const turnTolerance = isHard ? 0.35 : (isNormal ? 0.55 : 0.9);
    if (Math.abs(angleDiff) < turnTolerance) {
      this.input.setBotPressed(botId, true);
    } else {
      this.input.setBotPressed(botId, false);
    }

    // Steer toward target
    const steerSpeed = isHard ? 4.5 : (isNormal ? 3.5 : 2.2);
    ship.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), steerSpeed * dt);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Deep Space Cosmic Void Background
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width * 0.7);
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(0.6, '#0B0F19');
    bgGrad.addColorStop(1, '#05070D');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Parallax ambient stars
    ctx.save();
    for (const star of this.starfield) {
      ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Render Depots
    for (const depot of this.depots) {
      ctx.save();
      // Outer pulse zone
      const pulseR = depot.radius + Math.sin(depot.pulseTimer) * 4;
      ctx.beginPath();
      ctx.arc(depot.x, depot.y, pulseR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fill();
      ctx.strokeStyle = depot.color;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();

      // Inner pad
      ctx.beginPath();
      ctx.arc(depot.x, depot.y, depot.radius * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Depot icon / text
      ctx.font = '900 13px Montserrat, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DEPOT', depot.x, depot.y - 2);

      const ship = this.ships.get(depot.playerId);
      ctx.font = '800 10px Montserrat, sans-serif';
      ctx.fillStyle = depot.color;
      ctx.fillText(`${ship?.bankedScore || 0}/10 💎`, depot.x, depot.y + 12);
      ctx.restore();
    }

    // Render Asteroids
    for (const ast of this.asteroids) {
      ctx.save();
      ctx.translate(ast.x, ast.y);
      ctx.rotate(ast.angle);

      // 2.5D Crystalline faceted rock
      ctx.beginPath();
      const sides = ast.tier === 2 ? 7 : 5;
      for (let s = 0; s < sides; s++) {
        const a = (s / sides) * Math.PI * 2;
        const radVar = ast.radius * (0.8 + ((s % 2) * 0.35));
        const px = Math.cos(a) * radVar;
        const py = Math.sin(a) * radVar;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      // Fill with shaded rock gradient
      const astGrad = ctx.createLinearGradient(-ast.radius, -ast.radius, ast.radius, ast.radius);
      astGrad.addColorStop(0, '#64748B');
      astGrad.addColorStop(0.5, '#334155');
      astGrad.addColorStop(1, '#1E293B');
      ctx.fillStyle = astGrad;
      ctx.fill();

      ctx.strokeStyle = ast.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Core mineral vein glow
      ctx.beginPath();
      ctx.arc(0, 0, ast.radius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = ast.color;
      ctx.shadowColor = ast.color;
      ctx.shadowBlur = 10;
      ctx.fill();

      // Crystalline Fissure Cracks if damaged
      if (ast.health < ast.maxHealth) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-ast.radius * 0.45, -ast.radius * 0.3);
        ctx.lineTo(0, 0);
        ctx.lineTo(ast.radius * 0.35, ast.radius * 0.4);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Render Magnetic Tractor Beams
    for (const gem of this.gems) {
      if (gem.magnetTarget !== null) {
        const target = this.ships.get(gem.magnetTarget);
        if (target && target.alive) {
          ctx.save();
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(gem.x, gem.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Render Gems
    for (const gem of this.gems) {
      ctx.save();
      ctx.translate(gem.x, gem.y);
      ctx.rotate(gem.sparkleTimer);

      ctx.shadowColor = gem.glowColor;
      ctx.shadowBlur = 12;

      // Diamond gem shape
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 9);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fillStyle = gem.color;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.restore();
    }

    // Render Ships
    for (const ship of this.ships.values()) {
      if (!ship.alive) continue;

      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.angle);

      const pCfg = this.players[ship.id];
      const shipColor = pCfg?.color || '#38BDF8';

      // Cargo pods trailing behind ship
      for (let c = 0; c < ship.cargo; c++) {
        const podDist = ship.radius + 12 + c * 10;
        const podAngle = Math.PI + Math.sin(this.roundTimer * 6 + c) * 0.4;
        const cx = Math.cos(podAngle) * podDist;
        const cy = Math.sin(podAngle) * podDist;

        ctx.beginPath();
        ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#38BDF8';
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Ship chassis (wedge shape)
      ctx.beginPath();
      ctx.moveTo(ship.radius + 4, 0); // Bow
      ctx.lineTo(-ship.radius, -ship.radius * 0.85); // Port wing
      ctx.lineTo(-ship.radius * 0.5, 0); // Thruster indent
      ctx.lineTo(-ship.radius, ship.radius * 0.85); // Starboard wing
      ctx.closePath();

      ctx.fillStyle = shipColor;
      ctx.shadowColor = shipColor;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Cockpit bubble
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#0F172A';
      ctx.fill();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Spinning Drill Bumper on bow
      ctx.save();
      ctx.translate(ship.radius + 7, 0);
      ctx.rotate(ship.drillSpin);
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-4, -6);
      ctx.lineTo(-4, 6);
      ctx.closePath();
      ctx.fillStyle = '#FACC15';
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      // Full Cargo Warning
      if (ship.cargo >= 5) {
        ctx.save();
        ctx.fillStyle = '#EF4444';
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 8;
        ctx.font = '900 11px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('FULL! 💎', 0, -ship.radius - 12);
        ctx.restore();
      }

      ctx.restore();

      // Dotted Nav Line to Depot when carrying high cargo
      if (ship.cargo >= 3) {
        const myDepot = this.depots.find((d) => d.playerId === ship.id);
        if (myDepot) {
          ctx.save();
          ctx.strokeStyle = `${shipColor}55`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(ship.x, ship.y);
          ctx.lineTo(myDepot.x, myDepot.y);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Player Name
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pCfg?.name || `P${ship.id + 1}`, ship.x, ship.y - ship.radius - 14);
    }

    // Top Center HUD Pod (Centered at width / 2, y = 56, exactly conforming to center-corridor rule)
    this.renderCenterHUD(ctx, width);
  }

  private renderCenterHUD(ctx: CanvasRenderingContext2D, width: number): void {
    const active = this.getActivePlayers();
    const hudW = 320;
    const hudH = 26;
    const hudX = width / 2 - hudW / 2;
    const hudY = 56;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(hudX, hudY, hudW, hudH, 13);
    else ctx.rect(hudX, hudY, hudW, hudH);
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const summary = active
      .map((p) => {
        const ship = this.ships.get(p.id);
        const score = ship?.bankedScore || 0;
        const cargo = ship?.cargo || 0;
        return `${p.name}: 💎${score}/10 (${cargo})`;
      })
      .join('   •   ');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(summary, width / 2, hudY + 13);
  }

  public isRoundOver(): boolean {
    if (this.isFinished) return true;
    for (const ship of this.ships.values()) {
      if (ship.bankedScore >= 10) return true;
    }
    return false;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    let winnerId: PlayerId | null = null;
    let highestScore = -1;

    active.forEach((p) => {
      const ship = this.ships.get(p.id);
      const sc = ship?.bankedScore || 0;
      if (sc > highestScore) {
        highestScore = sc;
        winnerId = p.id;
      }
    });

    const sorted = [...active].sort((a, b) => {
      const scA = this.ships.get(a.id)?.bankedScore || 0;
      const scB = this.ships.get(b.id)?.bankedScore || 0;
      return scB - scA;
    });

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      place: idx + 1,
      score: this.ships.get(p.id)?.bankedScore || 0
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight:
        winnerId !== null
          ? `${this.players[winnerId].name} mined & secured 10 celestial gems!`
          : 'Zero-G asteroid salvage shift ended in a cosmic tie!'
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }
}
