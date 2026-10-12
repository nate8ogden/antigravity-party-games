import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Submarine {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetAngle: number;
  health: number;
  maxHealth: number;
  torpedoCooldown: number;
  sonarPingTimer: number;
  isAlive: boolean;
  score: number;
}

interface Torpedo {
  id: number;
  ownerId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface RockPillar {
  x: number;
  y: number;
  radius: number;
}

export class SubmarineTorpedoGame extends BaseGame {
  private subs: Map<PlayerId, Submarine> = new Map();
  private torpedoes: Torpedo[] = [];
  private rocks: RockPillar[] = [];
  private torpedoIdCounter: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private arenaWidth: number = 800;
  private arenaHeight: number = 600;
  private sonarPulseRadius: number = 0;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.arenaWidth = width;
    this.arenaHeight = height;
    this.roundTimer = 40.0;
    this.isFinished = false;
    this.subs.clear();
    this.torpedoes = [];
    this.rocks = [];

    // Create tactical rock pillars in trench
    this.rocks.push({ x: width * 0.3, y: height * 0.35, radius: 28 });
    this.rocks.push({ x: width * 0.7, y: height * 0.35, radius: 28 });
    this.rocks.push({ x: width * 0.5, y: height * 0.65, radius: 34 });

    const active = this.getActivePlayers();
    const spawnOffsets = [
      { x: width * 0.2, y: height * 0.2, angle: Math.PI / 4 },
      { x: width * 0.8, y: height * 0.2, angle: (3 * Math.PI) / 4 },
      { x: width * 0.2, y: height * 0.8, angle: -Math.PI / 4 },
      { x: width * 0.8, y: height * 0.8, angle: (-3 * Math.PI) / 4 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnOffsets[idx % spawnOffsets.length];
      this.subs.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: pos.angle,
        targetAngle: pos.angle,
        health: 3,
        maxHealth: 3,
        torpedoCooldown: 0,
        sonarPingTimer: 0,
        isAlive: true,
        score: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.sonarPulseRadius = (this.sonarPulseRadius + dt * 150) % (Math.max(width, height) * 0.8);

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();

    for (const p of active) {
      const sub = this.subs.get(p.id);
      if (!sub || !sub.isAlive) continue;

      if (sub.torpedoCooldown > 0) sub.torpedoCooldown -= dt;
      if (sub.sonarPingTimer > 0) sub.sonarPingTimer -= dt;

      // Input steering
      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isFire = this.input.justAction(p.id) || this.input.justPressed(p.id);

      if (steer !== 0 || throttle !== 0) {
        sub.targetAngle = Math.atan2(-throttle, steer);
      }

      // Smooth submarine turning in water
      let diff = sub.targetAngle - sub.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      sub.angle += diff * Math.min(1.0, dt * 6);

      // Hydrodynamic thrust
      if (Math.abs(steer) > 0.1 || Math.abs(throttle) > 0.1) {
        const speed = 140;
        sub.vx += Math.cos(sub.angle) * speed * dt;
        sub.vy += Math.sin(sub.angle) * speed * dt;

        // Propeller bubbles
        if (Math.random() < 0.25) {
          const propX = sub.x - Math.cos(sub.angle) * 18;
          const propY = sub.y - Math.sin(sub.angle) * 18;
          this.particles.emit(propX, propY, 1, '#81D4FA');
        }
      }

      // Water drag
      sub.vx *= Math.pow(0.85, dt * 10);
      sub.vy *= Math.pow(0.85, dt * 10);

      sub.x += sub.vx * dt;
      sub.y += sub.vy * dt;

      // Arena boundary clamp
      const margin = 20;
      if (sub.x < margin) { sub.x = margin; sub.vx = Math.abs(sub.vx) * 0.5; }
      if (sub.x > width - margin) { sub.x = width - margin; sub.vx = -Math.abs(sub.vx) * 0.5; }
      if (sub.y < margin) { sub.y = margin; sub.vy = Math.abs(sub.vy) * 0.5; }
      if (sub.y > height - margin) { sub.y = height - margin; sub.vy = -Math.abs(sub.vy) * 0.5; }

      // Rock collision
      for (const r of this.rocks) {
        const dx = sub.x - r.x;
        const dy = sub.y - r.y;
        const dist = Math.hypot(dx, dy);
        const minDist = r.radius + 14;
        if (dist < minDist && dist > 0) {
          const push = (minDist - dist);
          sub.x += (dx / dist) * push;
          sub.y += (dy / dist) * push;
          sub.vx *= 0.3;
          sub.vy *= 0.3;
        }
      }

      // Launch Torpedo
      if (isFire && sub.torpedoCooldown <= 0) {
        sub.torpedoCooldown = 0.8;
        this.torpedoes.push({
          id: ++this.torpedoIdCounter,
          ownerId: sub.id,
          x: sub.x + Math.cos(sub.angle) * 16,
          y: sub.y + Math.sin(sub.angle) * 16,
          vx: Math.cos(sub.angle) * 260,
          vy: Math.sin(sub.angle) * 260,
          life: 2.2
        });
        this.audio.playTap();
        this.particles.emit(sub.x, sub.y, 4, '#B0BEC5');
      }
    }

    // Update torpedoes
    for (let i = this.torpedoes.length - 1; i >= 0; i--) {
      const t = this.torpedoes[i];
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.life -= dt;

      // Torpedo trail bubbles
      if (Math.random() < 0.3) {
        this.particles.emit(t.x, t.y, 1, '#E0F7FA');
      }

      let exploded = false;

      // Wall hit
      if (t.x < 10 || t.x > width - 10 || t.y < 10 || t.y > height - 10) {
        exploded = true;
      }

      // Rock hit
      if (!exploded) {
        for (const r of this.rocks) {
          if (Math.hypot(t.x - r.x, t.y - r.y) < r.radius + 4) {
            exploded = true;
            break;
          }
        }
      }

      // Submarine hit
      if (!exploded) {
        for (const p of active) {
          const sub = this.subs.get(p.id);
          if (!sub || !sub.isAlive || sub.id === t.ownerId) continue;

          if (Math.hypot(t.x - sub.x, t.y - sub.y) < 18) {
            exploded = true;
            sub.health--;
            this.audio.playExplosion();
            this.particles.emit(sub.x, sub.y, 12, '#FF5252');

            // Award shooter score
            const shooter = this.subs.get(t.ownerId);
            if (shooter) shooter.score += 25;

            if (sub.health <= 0) {
              sub.isAlive = false;
              if (shooter) shooter.score += 50;
              this.particles.emit(sub.x, sub.y, 20, '#FF1744');
            }
            break;
          }
        }
      }

      if (exploded || t.life <= 0) {
        this.audio.playBounce();
        this.particles.emit(t.x, t.y, 6, '#4DD0E1');
        this.torpedoes.splice(i, 1);
      }
    }

    // Check round over
    const aliveSubs = Array.from(this.subs.values()).filter(s => s.isAlive);
    if ((aliveSubs.length <= 1 && active.length > 1) || this.roundTimer <= 0) {
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
    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const sub = this.subs.get(botId);
    if (!sub || !sub.isAlive) return;

    // Find nearest rival submarine
    let nearest: Submarine | null = null;
    let minDist = Infinity;
    for (const [id, rival] of this.subs.entries()) {
      if (id === botId || !rival.isAlive) continue;
      const d = Math.hypot(rival.x - sub.x, rival.y - sub.y);
      if (d < minDist) {
        minDist = d;
        nearest = rival;
      }
    }

    let steerX = 0;
    let steerY = 0;
    let shoot = false;
    let delay = 0.25;

    if (nearest) {
      const dx = nearest.x - sub.x;
      const dy = nearest.y - sub.y;
      const targetAngle = Math.atan2(dy, dx);
      let angleDiff = Math.abs(sub.angle - targetAngle);
      while (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - Math.PI * 2);

      steerX = Math.cos(targetAngle);
      steerY = Math.sin(targetAngle);

      if (difficulty === 'bot_easy') {
        delay = 0.45;
        if (angleDiff < 0.6 && Math.random() < 0.5) shoot = true;
      } else if (difficulty === 'bot_hard') {
        delay = 0.10;
        if (angleDiff < 0.25) shoot = true;
      } else {
        delay = 0.25;
        if (angleDiff < 0.4) shoot = true;
      }
    }

    this.input.setBotInput(botId, shoot, steerX, -steerY, false);
    this.botReactionTimers.set(botId, delay);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Deep underwater trench gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#001E3D');
    grad.addColorStop(1, '#000A14');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Sonar grid concentric circles
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, this.sonarPulseRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Render rock pillars
    for (const r of this.rocks) {
      ctx.fillStyle = '#263238';
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#37474F';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Render torpedoes
    for (const t of this.torpedoes) {
      ctx.fillStyle = '#00E5FF';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render submarines
    for (const [id, sub] of this.subs.entries()) {
      if (!sub.isAlive) continue;
      const p = this.players.find(pl => pl.id === id);
      const color = p ? p.color : '#00E5FF';

      ctx.save();
      ctx.translate(sub.x, sub.y);
      ctx.rotate(sub.angle);

      // Submarine hull (vector rounded cylinder)
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Conning tower (periscope hatch)
      ctx.fillStyle = '#263238';
      ctx.fillRect(-2, -12, 5, 5);

      // Propeller fin
      ctx.fillStyle = '#CFD8DC';
      ctx.beginPath();
      ctx.moveTo(-16, -6);
      ctx.lineTo(-19, 0);
      ctx.lineTo(-16, 6);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // Health bar above sub
      const barW = 24;
      const barH = 4;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(sub.x - barW / 2, sub.y - 20, barW, barH);
      ctx.fillStyle = sub.health > 1 ? '#00E676' : '#FF1744';
      ctx.fillRect(sub.x - barW / 2, sub.y - 20, (sub.health / sub.maxHealth) * barW, barH);
    }

    // HUD Timer
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(this.roundTimer)}s`, width / 2, 32);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const sub = this.subs.get(p.id);
      const base = sub ? sub.score + (sub.isAlive ? sub.health * 20 : 0) : 0;
      return {
        playerId: p.id,
        score: base
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `Player ${winnerId + 1} dominated the submarine trench!` : 'All submarines sank in the deep trench!'
    };
  }
}
