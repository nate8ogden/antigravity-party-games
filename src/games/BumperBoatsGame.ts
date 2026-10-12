import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface WaterStream {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: PlayerId;
  life: number;
}

interface BumperBoat {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  mass: number;
  score: number;
  bumps: number;
  cannonCooldown: number;
  waterWake: { x: number; y: number; alpha: number }[];
}

export class BumperBoatsGame extends BaseGame {
  public boats: Map<PlayerId, BumperBoat> = new Map();
  public waterStreams: WaterStream[] = [];
  public currentMapName: string = 'Tropical Splash Lagoon';

  private whirlpoolX: number = 400;
  private whirlpoolY: number = 300;
  private whirlpoolRadius: number = 75;
  private lagoonBounds = { minX: 60, maxX: 740, minY: 60, maxY: 540 };
  private botReactionTimers: Map<PlayerId, number> = new Map();

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

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.boats.clear();
    this.waterStreams = [];
    this.botReactionTimers.clear();

    this.lagoonBounds = {
      minX: width * 0.08,
      maxX: width * 0.92,
      minY: height * 0.12,
      maxY: height * 0.88
    };

    this.whirlpoolX = width * 0.5;
    this.whirlpoolY = height * 0.5;

    const active = this.getActivePlayers();
    const spawnAngleStep = (Math.PI * 2) / Math.max(1, active.length);
    const spawnDist = Math.min(width, height) * 0.32;

    active.forEach((p, idx) => {
      const ang = idx * spawnAngleStep;
      this.boats.set(p.id, {
        id: p.id,
        x: this.whirlpoolX + Math.cos(ang) * spawnDist,
        y: this.whirlpoolY + Math.sin(ang) * spawnDist,
        vx: 0,
        vy: 0,
        angle: ang + Math.PI,
        radius: 20,
        mass: 1.2,
        score: 0,
        bumps: 0,
        cannonCooldown: 0,
        waterWake: []
      });
      this.botReactionTimers.set(p.id, 0.25 + Math.random() * 0.25);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Update boats
    for (const p of this.getActivePlayers()) {
      const b = this.boats.get(p.id);
      if (!b) continue;

      if (b.cannonCooldown > 0) b.cannonCooldown -= dt;

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      // Rudder steering rotation
      if (steer !== 0) {
        b.angle += steer * dt * 3.4;
      }

      // Propeller thrust forward and reverse
      const thrust = throttle * 320;
      b.vx += Math.cos(b.angle) * thrust * dt;
      b.vy += Math.sin(b.angle) * thrust * dt;

      // Water hydrodynamics drag
      b.vx *= Math.pow(0.965, dt * 60);
      b.vy *= Math.pow(0.965, dt * 60);

      // Central Whirlpool tangential vortex pull
      const dx = this.whirlpoolX - b.x;
      const dy = this.whirlpoolY - b.y;
      const distToVortex = Math.hypot(dx, dy);

      if (distToVortex < this.whirlpoolRadius * 2.2 && distToVortex > 5) {
        const pull = (1 - distToVortex / (this.whirlpoolRadius * 2.2)) * 140;
        // Inward radial pull
        b.vx += (dx / distToVortex) * pull * dt;
        b.vy += (dy / distToVortex) * pull * dt;

        // Tangential rotational swirl
        const tanX = -dy / distToVortex;
        const tanY = dx / distToVortex;
        b.vx += tanX * pull * 1.2 * dt;
        b.vy += tanY * pull * 1.2 * dt;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Water wake particle trail
      b.waterWake.push({ x: b.x - Math.cos(b.angle) * b.radius, y: b.y - Math.sin(b.angle) * b.radius, alpha: 0.8 });
      if (b.waterWake.length > 12) b.waterWake.shift();
      b.waterWake.forEach((w) => (w.alpha -= dt * 2.5));

      // Water Cannon action
      if (justAction && b.cannonCooldown <= 0) {
        b.cannonCooldown = 0.45;
        this.audio.playLaser();

        const streamSpeed = 580;
        this.waterStreams.push({
          x: b.x + Math.cos(b.angle) * (b.radius + 6),
          y: b.y + Math.sin(b.angle) * (b.radius + 6),
          vx: Math.cos(b.angle) * streamSpeed,
          vy: Math.sin(b.angle) * streamSpeed,
          ownerId: b.id,
          life: 0.5
        });
        this.particles.spawnSparks(b.x, b.y, '#38BDF8', 8);
      }

      // Lagoon rubber tire perimeter collisions
      if (b.x - b.radius < this.lagoonBounds.minX) {
        b.x = this.lagoonBounds.minX + b.radius;
        b.vx = -b.vx * 0.7;
        this.audio.playBounce();
      } else if (b.x + b.radius > this.lagoonBounds.maxX) {
        b.x = this.lagoonBounds.maxX - b.radius;
        b.vx = -b.vx * 0.7;
        this.audio.playBounce();
      }

      if (b.y - b.radius < this.lagoonBounds.minY) {
        b.y = this.lagoonBounds.minY + b.radius;
        b.vy = -b.vy * 0.7;
        this.audio.playBounce();
      } else if (b.y + b.radius > this.lagoonBounds.maxY) {
        b.y = this.lagoonBounds.maxY - b.radius;
        b.vy = -b.vy * 0.7;
        this.audio.playBounce();
      }

      // Passive score for staying clear of central whirlpool
      if (distToVortex > this.whirlpoolRadius) {
        b.score += dt * 15;
      }
    }

    // Update water streams
    for (let i = this.waterStreams.length - 1; i >= 0; i--) {
      const s = this.waterStreams[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;

      // Check collision with other boats
      for (const target of this.boats.values()) {
        if (target.id === s.ownerId) continue;

        const dist = Math.hypot(s.x - target.x, s.y - target.y);
        if (dist < target.radius + 8) {
          // Water blast knockback!
          target.vx += s.vx * 0.45;
          target.vy += s.vy * 0.45;

          const shooter = this.boats.get(s.ownerId);
          if (shooter) shooter.score += 40;

          this.audio.playBounce();
          this.particles.spawnSparks(target.x, target.y, '#38BDF8', 10);
          s.life = 0;
          break;
        }
      }

      if (s.life <= 0) {
        this.waterStreams.splice(i, 1);
      }
    }

    // Boat vs Boat Elastic Bumper Collisions
    const bList = Array.from(this.boats.values());
    for (let i = 0; i < bList.length; i++) {
      for (let j = i + 1; j < bList.length; j++) {
        const b1 = bList[i];
        const b2 = bList[j];
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = b1.radius + b2.radius;

        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;

          const overlap = minDist - dist;
          b1.x -= nx * overlap * 0.5;
          b1.y -= ny * overlap * 0.5;
          b2.x += nx * overlap * 0.5;
          b2.y += ny * overlap * 0.5;

          const kx = b1.vx - b2.vx;
          const ky = b1.vy - b2.vy;
          const velAlongNormal = kx * nx + ky * ny;

          if (velAlongNormal > 0) {
            const p = 2 * velAlongNormal / (b1.mass + b2.mass);

            b1.vx -= p * b2.mass * nx * 1.35;
            b1.vy -= p * b2.mass * ny * 1.35;
            b2.vx += p * b1.mass * nx * 1.35;
            b2.vy += p * b1.mass * ny * 1.35;

            b1.score += 25;
            b2.score += 25;
            b1.bumps += 1;
            b2.bumps += 1;

            this.audio.playBounce();
            this.particles.shake(4);
            this.particles.spawnSparks((b1.x + b2.x) / 2, (b1.y + b2.y) / 2, '#FFFFFF', 10);
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
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
    const bot = this.boats.get(botId);
    if (!bot) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;

    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const interval =
      difficulty === 'bot_easy'
        ? 0.35 + Math.random() * 0.25
        : difficulty === 'bot_normal'
        ? 0.18 + Math.random() * 0.15
        : 0.08 + Math.random() * 0.06;
    this.botReactionTimers.set(botId, interval);

    // Evade whirlpool if too close
    const distToVortex = Math.hypot(bot.x - this.whirlpoolX, bot.y - this.whirlpoolY);
    if (distToVortex < this.whirlpoolRadius * 1.5) {
      let escapeAngle = Math.atan2(bot.y - this.whirlpoolY, bot.x - this.whirlpoolX);
      if (difficulty === 'bot_easy') {
        // Easy bots occasionally struggle to escape the vortex
        escapeAngle += (Math.random() - 0.5) * 0.9;
      }
      bot.angle = escapeAngle;
      const thrust = difficulty === 'bot_easy' ? 220 : difficulty === 'bot_normal' ? 290 : 340;
      bot.vx += Math.cos(escapeAngle) * thrust * dt * 4;
      bot.vy += Math.sin(escapeAngle) * thrust * dt * 4;
      return;
    }

    // Target nearest opponent
    const enemies = Array.from(this.boats.values())
      .filter((b) => b.id !== bot.id)
      .sort((a, b) => Math.hypot(a.x - bot.x, a.y - bot.y) - Math.hypot(b.x - bot.x, b.y - bot.y));
    if (enemies.length > 0) {
      const target = enemies[0];
      let desiredAngle = Math.atan2(target.y - bot.y, target.x - bot.x);
      if (difficulty === 'bot_easy') {
        desiredAngle += (Math.random() - 0.5) * 0.5;
      }
      bot.angle = desiredAngle;
      const cruiseSpeed = difficulty === 'bot_easy' ? 180 : difficulty === 'bot_normal' ? 240 : 280;
      bot.vx += Math.cos(desiredAngle) * cruiseSpeed * dt * 3;
      bot.vy += Math.sin(desiredAngle) * cruiseSpeed * dt * 3;

      // Fire water cannon if facing enemy
      const dist = Math.hypot(target.x - bot.x, target.y - bot.y);
      const fireChance = difficulty === 'bot_hard' ? 0.85 : difficulty === 'bot_normal' ? 0.55 : 0.28;
      if (dist < 220 && bot.cannonCooldown <= 0 && Math.random() < fireChance) {
        bot.cannonCooldown = 0.5;
        this.waterStreams.push({
          x: bot.x + Math.cos(bot.angle) * 26,
          y: bot.y + Math.sin(bot.angle) * 26,
          vx: Math.cos(bot.angle) * 580,
          vy: Math.sin(bot.angle) * 580,
          ownerId: bot.id,
          life: 0.5
        });
        this.audio.playLaser();
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const b = this.boats.get(p.id);
      return {
        playerId: p.id,
        score: Math.round(b?.score || 0),
        bumps: b?.bumps || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topBumps = scores[0]?.bumps || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} ruled the splash lagoon with ${topBumps} boat collisions!`
      : 'All bumper boats got trapped in the lagoon whirlpool!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Tropical Blue Lagoon Water
    const waterGrad = ctx.createLinearGradient(0, 0, 0, height);
    waterGrad.addColorStop(0, '#0284C7');
    waterGrad.addColorStop(0.5, '#0EA5E9');
    waterGrad.addColorStop(1, '#0369A1');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, 0, width, height);

    // Whirlpool vortex at center
    ctx.save();
    const vortexGrad = ctx.createRadialGradient(
      this.whirlpoolX,
      this.whirlpoolY,
      8,
      this.whirlpoolX,
      this.whirlpoolY,
      this.whirlpoolRadius * 1.8
    );
    vortexGrad.addColorStop(0, '#082F49');
    vortexGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.45)');
    vortexGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');

    ctx.fillStyle = vortexGrad;
    ctx.beginPath();
    ctx.arc(this.whirlpoolX, this.whirlpoolY, this.whirlpoolRadius * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Swirling vortex spiral arms
    ctx.strokeStyle = '#BAE6FD';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.2) {
      const r = (a / (Math.PI * 4)) * this.whirlpoolRadius;
      const vx = this.whirlpoolX + Math.cos(a) * r;
      const vy = this.whirlpoolY + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }
    ctx.stroke();
    ctx.restore();

    // Lagoon wooden dock perimeter & tires
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 14;
    ctx.strokeRect(
      this.lagoonBounds.minX,
      this.lagoonBounds.minY,
      this.lagoonBounds.maxX - this.lagoonBounds.minX,
      this.lagoonBounds.maxY - this.lagoonBounds.minY
    );

    // 2. Water Stream Projectiles
    for (const s of this.waterStreams) {
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Draw Bumper Boats
    for (const b of this.boats.values()) {
      const cfg = this.players.find((x) => x.id === b.id);
      const color = cfg ? cfg.color : '#FFFFFF';

      // Wake trail
      ctx.save();
      for (const w of b.waterWake) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, w.alpha)})`;
        ctx.beginPath();
        ctx.arc(w.x, w.y, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);

      // Outer Inflatable Rubber Ring
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner Fiberglass Hull
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius - 4, 0, Math.PI * 2);
      ctx.fill();

      // Cockpit / Seat
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-4, 0, 8, 0, Math.PI * 2);
      ctx.fill();

      // Water Cannon Nozzle
      ctx.fillStyle = '#64748B';
      ctx.fillRect(b.radius - 6, -3, 10, 6);

      ctx.restore();

      // Player Pill
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${b.id + 1}`, b.x, b.y - b.radius - 8);
    }

    // 4. Draw HUD
    this.renderHUD(ctx, width, height);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, _height: number): void {
    ctx.save();
    // Timer badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 55, 12, 110, 36, 10);
    ctx.fill();
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(this.roundTimer)}s`, width * 0.5, 30);

    // Score bar
    const active = this.getActivePlayers();
    const itemW = 95;
    const subBarW = active.length * itemW;
    const subBarX = width * 0.5 - subBarW * 0.5;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(subBarX, 54, subBarW, 26, 6);
    ctx.fill();

    active.forEach((p, idx) => {
      const b = this.boats.get(p.id);
      const px = subBarX + idx * itemW + itemW / 2;
      ctx.fillStyle = p.color;
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`P${p.id + 1}: 🚤${Math.round(b?.score || 0)}`, px, 67);
    });

    ctx.restore();
  }
}
