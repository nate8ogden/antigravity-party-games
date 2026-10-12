import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SpherePlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  angle: number;
  rollAnim: number;
  isAlive: boolean;
  score: number;
  knockouts: number;
  turboCooldown: number;
  turboActiveTimer: number;
}

export class SumoSpheresGame extends BaseGame {
  public playersState: Map<PlayerId, SpherePlayer> = new Map();
  public arenaCenterX: number = 400;
  public arenaCenterY: number = 300;
  public arenaRadius: number = 240;
  public tiltX: number = 0;
  public tiltY: number = 0;
  public currentMapName: string = 'Gyroscope Platform';

  private initialArenaRadius: number = 240;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private bumpers: { x: number; y: number; radius: number; color: string; pulse: number }[] = [];

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
    this.playersState.clear();
    this.botReactionTimers.clear();

    this.arenaCenterX = width * 0.5;
    this.arenaCenterY = height * 0.52;
    this.initialArenaRadius = Math.min(width, height) * 0.40;
    this.arenaRadius = this.initialArenaRadius;
    this.tiltX = 0;
    this.tiltY = 0;

    // 3 Dynamic Pinball Rebound Bumpers on the Gyro Platform
    this.bumpers = [
      { x: this.arenaCenterX, y: this.arenaCenterY - this.arenaRadius * 0.35, radius: 18, color: '#EC4899', pulse: 0 },
      { x: this.arenaCenterX - this.arenaRadius * 0.32, y: this.arenaCenterY + this.arenaRadius * 0.22, radius: 18, color: '#06B6D4', pulse: 0 },
      { x: this.arenaCenterX + this.arenaRadius * 0.32, y: this.arenaCenterY + this.arenaRadius * 0.22, radius: 18, color: '#F59E0B', pulse: 0 }
    ];

    const active = this.getActivePlayers();
    const spawnAngleStep = (Math.PI * 2) / Math.max(1, active.length);
    const spawnDist = this.arenaRadius * 0.60;

    active.forEach((p, idx) => {
      const ang = idx * spawnAngleStep - Math.PI / 2;
      this.playersState.set(p.id, {
        id: p.id,
        x: this.arenaCenterX + Math.cos(ang) * spawnDist,
        y: this.arenaCenterY + Math.sin(ang) * spawnDist,
        vx: 0,
        vy: 0,
        radius: 22,
        mass: 1.0,
        angle: ang + Math.PI,
        rollAnim: 0,
        isAlive: true,
        score: 0,
        knockouts: 0,
        turboCooldown: 0,
        turboActiveTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.25 + Math.random() * 0.25);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Calculate platform tilt from player weights
    let weightX = 0;
    let weightY = 0;
    let aliveCount = 0;

    for (const ps of this.playersState.values()) {
      if (!ps.isAlive) continue;
      weightX += (ps.x - this.arenaCenterX) / this.arenaRadius;
      weightY += (ps.y - this.arenaCenterY) / this.arenaRadius;
      aliveCount++;
    }

    if (aliveCount > 0) {
      const targetTiltX = (weightX / aliveCount) * 18;
      const targetTiltY = (weightY / aliveCount) * 18;
      this.tiltX += (targetTiltX - this.tiltX) * dt * 3.0;
      this.tiltY += (targetTiltY - this.tiltY) * dt * 3.0;
    }

    // Dynamic shrinking platform after 10s of play
    if (this.roundTimer < 25) {
      const minRadius = this.initialArenaRadius * 0.52;
      if (this.arenaRadius > minRadius) {
        this.arenaRadius = Math.max(minRadius, this.arenaRadius - 6.0 * dt);
        if (Math.random() < 0.25) {
          const crumbleAngle = Math.random() * Math.PI * 2;
          const cx = this.arenaCenterX + Math.cos(crumbleAngle) * this.arenaRadius;
          const cy = this.arenaCenterY + Math.sin(crumbleAngle) * (this.arenaRadius * 0.88);
          this.particles.spawnSparks(cx, cy, '#EF4444', 2);
        }
      }
    }

    // Update players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps || !ps.isAlive) continue;

      if (ps.turboCooldown > 0) ps.turboCooldown -= dt;
      if (ps.turboActiveTimer > 0) ps.turboActiveTimer -= dt;

      // Inputs
      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      // Facing angle
      if (steer !== 0 || throttle !== 0) {
        ps.angle = Math.atan2(-throttle, steer);
      }

      // Motor torque acceleration
      const accel = ps.turboActiveTimer > 0 ? 820 : 440;
      if (steer !== 0 || throttle !== 0) {
        ps.vx += steer * accel * dt;
        ps.vy += -throttle * accel * dt;
      }

      // Platform gravity slope slide based on platform tilt
      ps.vx += (this.tiltX / 18) * 120 * dt;
      ps.vy += (this.tiltY / 18) * 120 * dt;

      // Turbo boost impulse
      if (justAction && ps.turboCooldown <= 0) {
        ps.turboCooldown = 1.6;
        ps.turboActiveTimer = 0.35;
        ps.vx += Math.cos(ps.angle) * 380;
        ps.vy += Math.sin(ps.angle) * 380;
        this.audio.playLaser();
        this.particles.shake(4);
        this.particles.spawnSparks(ps.x, ps.y, '#F59E0B', 12);
      }

      // Rolling friction
      ps.vx *= Math.pow(0.96, dt * 60);
      ps.vy *= Math.pow(0.96, dt * 60);

      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Roll animation rotation
      ps.rollAnim += Math.hypot(ps.vx, ps.vy) * dt * 0.05;

      // Check fall off edge
      const distFromCenter = Math.hypot(ps.x - this.arenaCenterX, ps.y - this.arenaCenterY);
      if (distFromCenter > this.arenaRadius + ps.radius * 0.5) {
        ps.isAlive = false;
        this.audio.playExplosion();
        this.particles.shake(7);
        this.particles.spawnExplosion(ps.x, ps.y, '#EF4444', 24);
      } else {
        // Survival score
        ps.score += dt * 25;
      }
    }

    // Sphere vs Sphere Elastic Bumping Physics
    const pList = Array.from(this.playersState.values()).filter((p) => p.isAlive);
    for (let i = 0; i < pList.length; i++) {
      for (let j = i + 1; j < pList.length; j++) {
        const p1 = pList[i];
        const p2 = pList[j];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = p1.radius + p2.radius;

        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Push apart
          const overlap = minDist - dist;
          p1.x -= nx * overlap * 0.5;
          p1.y -= ny * overlap * 0.5;
          p2.x += nx * overlap * 0.5;
          p2.y += ny * overlap * 0.5;

          // Relative velocity along normal
          const kx = p1.vx - p2.vx;
          const ky = p1.vy - p2.vy;
          const velAlongNormal = kx * nx + ky * ny;

          if (velAlongNormal > 0) {
            const impulse = 2 * velAlongNormal / (p1.mass + p2.mass);
            const elasticity = 1.45;
            p1.vx -= impulse * p2.mass * nx * elasticity;
            p1.vy -= impulse * p2.mass * ny * elasticity;
            p2.vx += impulse * p1.mass * nx * elasticity;
            p2.vy += impulse * p1.mass * ny * elasticity;

            this.audio.playBounce();
            this.particles.shake(4);
            this.particles.spawnSparks((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, '#FFFFFF', 10);
          }
        }
      }
    }

    // Dynamic Pinball Bumper Collisions & Rebounds
    for (const b of this.bumpers) {
      b.pulse = Math.max(0, b.pulse - dt * 3.5);
      for (const p of this.playersState.values()) {
        if (!p.isAlive) continue;
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        const dist = Math.hypot(dx, dy);
        const minDist = p.radius + b.radius;
        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          p.x = b.x + nx * minDist;
          p.y = b.y + ny * minDist;
          const reboundSpeed = 440;
          p.vx = nx * reboundSpeed;
          p.vy = ny * reboundSpeed;
          p.score += 10;
          b.pulse = 1.0;
          this.audio.playBounce();
          this.audio.playChime();
          this.particles.shake(5);
          this.particles.spawnImpactShockwave(b.x, b.y, b.color, 26);
          this.particles.showFloatingText('+10 BUMPER!', b.x, b.y - 18, b.color, 16);
        }
      }
    }

    // Check round over: timer expired or <= 1 alive
    const remaining = Array.from(this.playersState.values()).filter((p) => p.isAlive);
    const active = this.getActivePlayers();
    if (this.roundTimer <= 0 || (active.length > 1 && remaining.length <= 1)) {
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
    const bot = this.playersState.get(botId);
    if (!bot || !bot.isAlive) return;

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

    const distFromCenter = Math.hypot(bot.x - this.arenaCenterX, bot.y - this.arenaCenterY);

    // 1. Recover towards center if near edge
    if (distFromCenter > this.arenaRadius * 0.65) {
      const returnAngle = Math.atan2(this.arenaCenterY - bot.y, this.arenaCenterX - bot.x);
      bot.angle = returnAngle;
      bot.vx += Math.cos(returnAngle) * 320 * dt * 4;
      bot.vy += Math.sin(returnAngle) * 320 * dt * 4;

      if (distFromCenter > this.arenaRadius * 0.82 && bot.turboCooldown <= 0) {
        bot.turboCooldown = 1.8;
        bot.turboActiveTimer = 0.35;
        bot.vx += Math.cos(returnAngle) * 340;
        bot.vy += Math.sin(returnAngle) * 340;
      }
      return;
    }

    // 2. Target nearest enemy and ram them off the edge
    const enemies = Array.from(this.playersState.values()).filter((p) => p.isAlive && p.id !== bot.id);
    if (enemies.length > 0) {
      const target = enemies.reduce((prev, curr) => {
        const d1 = Math.hypot(prev.x - bot.x, prev.y - bot.y);
        const d2 = Math.hypot(curr.x - bot.x, curr.y - bot.y);
        return d1 < d2 ? prev : curr;
      });

      let ramAngle = Math.atan2(target.y - bot.y, target.x - bot.x);
      if (difficulty === 'bot_easy') ramAngle += (Math.random() - 0.5) * 0.6;

      bot.angle = ramAngle;
      bot.vx += Math.cos(ramAngle) * 320 * dt * 4;
      bot.vy += Math.sin(ramAngle) * 320 * dt * 4;

      const distToEnemy = Math.hypot(target.x - bot.x, target.y - bot.y);
      if (distToEnemy < 90 && bot.turboCooldown <= 0 && Math.random() < (difficulty === 'bot_hard' ? 0.9 : 0.5)) {
        bot.turboCooldown = 1.8;
        bot.turboActiveTimer = 0.35;
        bot.vx += Math.cos(ramAngle) * 360;
        bot.vy += Math.sin(ramAngle) * 360;
        this.audio.playLaser();
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const ps = this.playersState.get(p.id);
      const pts = ps ? Math.round(ps.score + (ps.isAlive ? 250 : 0)) : 0;
      return {
        playerId: p.id,
        score: pts,
        isAlive: ps?.isAlive || false
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} pushed all rivals off the tilting Gyroscope Platform!`
      : 'All spheres tumbled into the abyss!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Endless bottomless abyss background
    const bgGrad = ctx.createRadialGradient(width * 0.5, height * 0.5, 40, width * 0.5, height * 0.5, width * 0.7);
    bgGrad.addColorStop(0, '#1E1B4B');
    bgGrad.addColorStop(0.6, '#0F172A');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. 3D Cylindrical Tilting Arena Platform
    const px = this.arenaCenterX + this.tiltX;
    const py = this.arenaCenterY + this.tiltY;

    // Platform bottom shadow & bevel depth
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.ellipse(px, py + 18, this.arenaRadius, this.arenaRadius * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();

    // Platform surface ring
    const platGrad = ctx.createRadialGradient(px, py - 10, 10, px, py, this.arenaRadius);
    platGrad.addColorStop(0, '#334155');
    platGrad.addColorStop(0.7, '#1E293B');
    platGrad.addColorStop(1, '#0F172A');

    ctx.fillStyle = platGrad;
    ctx.beginPath();
    ctx.ellipse(px, py, this.arenaRadius, this.arenaRadius * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outer hazard caution rim
    const isDanger = this.roundTimer < 25;
    ctx.strokeStyle = isDanger ? (Math.sin(Date.now() * 0.012) > 0 ? '#EF4444' : '#F59E0B') : '#F59E0B';
    ctx.lineWidth = isDanger ? 8 : 6;
    ctx.beginPath();
    ctx.ellipse(px, py, this.arenaRadius, this.arenaRadius * 0.88, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Inner concentric bullseye circles
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(px, py, this.arenaRadius * 0.5, this.arenaRadius * 0.44, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Draw Pinball Rebound Bumpers on Gyro Platform
    for (const b of this.bumpers) {
      ctx.save();
      const pulseScale = 1.0 + b.pulse * 0.25;
      const bR = b.radius * pulseScale;

      // Drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.arc(b.x, b.y + 4, bR, 0, Math.PI * 2);
      ctx.fill();

      // Outer chrome rim
      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.arc(b.x, b.y, bR + 3, 0, Math.PI * 2);
      ctx.fill();

      // Glowing Neon Cap
      ctx.shadowColor = b.color;
      ctx.shadowBlur = b.pulse > 0.1 ? 22 : 12;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, bR, 0, Math.PI * 2);
      ctx.fill();

      // Top specular highlight
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(b.x - bR * 0.3, b.y - bR * 0.3, bR * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Draw Sphere Players (Mascots in Transparent Gyro Spheres)
    const now = performance.now() * 0.001;
    for (const p of this.playersState.values()) {
      if (!p.isAlive) continue;

      ctx.save();
      // Sphere Drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 8, p.radius, p.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Turbo boost flame plume
      if (p.turboActiveTimer > 0) {
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        const bX = p.x - Math.cos(p.angle) * (p.radius + 10);
        const bY = p.y - Math.sin(p.angle) * (p.radius + 10);
        ctx.arc(bX, bY, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Mascot sitting inside hamster ball
      const isNearEdge = Math.hypot(p.x - this.arenaCenterX, p.y - this.arenaCenterY) > this.arenaRadius * 0.75;
      const mood = p.turboActiveTimer > 0 ? 'focused' : (isNearEdge ? 'shocked' : 'idle');
      this.drawPlayerMascot(ctx, p.id, p.x, p.y, p.radius * 0.72, mood, now);

      ctx.translate(p.x, p.y);

      // Translucent Glass Sphere Shell with specular reflections
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Glass sphere sheen
      const glassSheen = ctx.createLinearGradient(-p.radius, -p.radius, p.radius, p.radius);
      glassSheen.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      glassSheen.addColorStop(0.4, 'rgba(255, 255, 255, 0.08)');
      glassSheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glassSheen;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Rotating motorized gyro band
      ctx.rotate(p.rollAnim);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.radius - 2, p.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();

      // Player Name Pill
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(p.x - 30, p.y - p.radius - 20, 60, 16, 8);
      else ctx.rect(p.x - 30, p.y - p.radius - 20, 60, 16);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.players[p.id]?.name.toUpperCase() || `P${p.id + 1}`, p.x, p.y - p.radius - 12);
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
    ctx.strokeStyle = '#F59E0B';
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
      const ps = this.playersState.get(p.id);
      const px = subBarX + idx * itemW + itemW / 2;
      ctx.fillStyle = p.color;
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const status = ps?.isAlive ? `⚡${Math.round(ps?.score || 0)}` : '💀FALL';
      ctx.fillText(`P${p.id + 1}: ${status}`, px, 67);
    });

    ctx.restore();
  }
}
