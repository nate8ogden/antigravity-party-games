import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface PlanetCore {
  id: PlayerId;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  shieldAngle: number;
  shieldSpan: number; // angular coverage in radians (~1.1 rad)
  shieldDistance: number;
  pulseTimer: number;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  ownerId: PlayerId | null; // who deflected it last
  life: number;
}

export class MeteorShieldGame extends BaseGame {
  private planets: Map<PlayerId, PlanetCore> = new Map();
  private meteors: Meteor[] = [];
  private meteorSpawnTimer: number = 2.0;
  private arenaCenterX: number = 400;
  private arenaCenterY: number = 300;
  private eliminationOrder: PlayerId[] = [];

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

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 45;
    this.isFinished = false;
    this.planets.clear();
    this.meteors = [];
    this.meteorSpawnTimer = 1.2;
    this.eliminationOrder = [];

    this.arenaCenterX = width / 2;
    this.arenaCenterY = height / 2;

    const active = this.getActivePlayers();
    const count = active.length;

    // Distribute planets in arena quadrants/corners
    const positions = count === 2 ? [
      { x: width * 0.28, y: height * 0.5 },
      { x: width * 0.72, y: height * 0.5 }
    ] : [
      { x: width * 0.28, y: height * 0.35 },
      { x: width * 0.72, y: height * 0.35 },
      { x: width * 0.28, y: height * 0.68 },
      { x: width * 0.72, y: height * 0.68 }
    ];

    active.forEach((p, idx) => {
      const pos = positions[idx % positions.length];
      this.planets.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        radius: 26,
        hp: 3,
        maxHp: 3,
        shieldAngle: idx === 0 ? 0 : Math.PI,
        shieldSpan: 1.15, // ~65 degrees
        shieldDistance: 48,
        pulseTimer: 0
      });
    });

    // Spawn 2 initial meteors
    this.spawnMeteor(width, height);
    this.spawnMeteor(width, height);
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Spawn meteors periodically
    this.meteorSpawnTimer -= dt;
    if (this.meteorSpawnTimer <= 0 && this.meteors.length < 8) {
      this.meteorSpawnTimer = Math.max(1.0, 2.2 - (45 - this.roundTimer) * 0.03);
      this.spawnMeteor(width, height);
    }

    // Process Planet Shields & Inputs
    for (const planet of this.planets.values()) {
      if (planet.hp <= 0) continue;

      if (planet.pulseTimer > 0) {
        planet.pulseTimer = Math.max(0, planet.pulseTimer - dt * 3);
      }

      const steer = this.input.getSteer(planet.id);
      const isPressed = this.input.isPressed(planet.id);
      const justAction = this.input.justPressed(planet.id) || this.input.justAction(planet.id);

      // Rotate shield
      if (steer !== 0) {
        planet.shieldAngle += steer * 4.2 * dt;
      } else if (isPressed) {
        // 1-button auto orbit
        planet.shieldAngle += 3.8 * dt;
      }

      // Keep angle in [0, 2*PI)
      const twoPi = Math.PI * 2;
      planet.shieldAngle = ((planet.shieldAngle % twoPi) + twoPi) % twoPi;

      // Kinetic repulsor pulse
      if (justAction) {
        planet.pulseTimer = 1.0;
        this.audio.playBoost();
        this.particles.spawnSparks(
          planet.x + Math.cos(planet.shieldAngle) * planet.shieldDistance,
          planet.y + Math.sin(planet.shieldAngle) * planet.shieldDistance,
          this.players[planet.id]?.color || '#38BDF8',
          10
        );
      }
    }

    // Process Meteors Physics & Deflections
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.life -= dt;

      // Fiery trail particles
      if (Math.random() < 0.4) {
        this.particles.spawnSparks(m.x, m.y, '#F97316', 1);
      }

      // Screen boundary bounces
      if (m.x < 15 || m.x > width - 15) {
        m.vx = -m.vx;
        m.x = Math.max(15, Math.min(width - 15, m.x));
      }
      if (m.y < 15 || m.y > height - 15) {
        m.vy = -m.vy;
        m.y = Math.max(15, Math.min(height - 15, m.y));
      }

      // Check collision with player shields and planet cores
      for (const planet of this.planets.values()) {
        if (planet.hp <= 0) continue;

        const distToCenter = Math.hypot(m.x - planet.x, m.y - planet.y);

        // 1. Check Shield Collision
        const shieldDistMin = planet.shieldDistance - 10;
        const shieldDistMax = planet.shieldDistance + 12;
        if (distToCenter >= shieldDistMin && distToCenter <= shieldDistMax) {
          const meteorAngle = Math.atan2(m.y - planet.y, m.x - planet.x);
          let diff = (meteorAngle - planet.shieldAngle) % (Math.PI * 2);
          if (diff < -Math.PI) diff += Math.PI * 2;
          if (diff > Math.PI) diff -= Math.PI * 2;

          if (Math.abs(diff) <= planet.shieldSpan / 2) {
            // METEOR DEFLECTED BY SHIELD!
            m.ownerId = planet.id;
            this.audio.playLaser();
            this.particles.spawnSparks(m.x, m.y, '#38BDF8', 12);

            // Calculate deflection normal
            const nx = Math.cos(meteorAngle);
            const ny = Math.sin(meteorAngle);

            // Boost speed on kinetic pulse
            const boost = planet.pulseTimer > 0 ? 1.45 : 1.1;
            const curSpeed = Math.hypot(m.vx, m.vy) * boost;

            // Reflect outward from planet center
            m.vx = nx * Math.min(480, curSpeed);
            m.vy = ny * Math.min(480, curSpeed);

            // Nudge outside shield ring
            m.x = planet.x + nx * (planet.shieldDistance + 16);
            m.y = planet.y + ny * (planet.shieldDistance + 16);
            break;
          }
        }

        // 2. Check Planet Core Direct Impact
        if (distToCenter < planet.radius + m.radius) {
          // DIRECT IMPACT DAMAGE!
          planet.hp--;
          this.audio.playExplosion();
          this.particles.addTrauma(0.35);
          this.particles.spawnExplosion(m.x, m.y, '#EF4444', 35);
          this.particles.showFloatingText('-1 CORE HP! 💥', planet.x, planet.y - 35, '#EF4444', 22);

          // Meteor destroyed on impact
          this.meteors.splice(i, 1);

          if (planet.hp <= 0) {
            this.eliminationOrder.push(planet.id);
            this.particles.showFloatingText('PLANET DESTROYED! 💀', planet.x, planet.y - 20, '#EF4444', 24);
          }
          break;
        }
      }
    }

    // Check round over
    const alivePlanets = Array.from(this.planets.values()).filter((p) => p.hp > 0);
    if (alivePlanets.length <= 1 || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private spawnMeteor(width: number, height: number): void {
    // Spawn from arena edges flying inward
    const side = Math.floor(Math.random() * 4);
    let sx = 0;
    let sy = 0;
    if (side === 0) { sx = Math.random() * width; sy = 20; }
    else if (side === 1) { sx = width - 20; sy = Math.random() * height; }
    else if (side === 2) { sx = Math.random() * width; sy = height - 20; }
    else { sx = 20; sy = Math.random() * height; }

    const targetX = width / 2 + (Math.random() - 0.5) * 160;
    const targetY = height / 2 + (Math.random() - 0.5) * 160;
    const dx = targetX - sx;
    const dy = targetY - sy;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = 160 + Math.random() * 80;

    this.meteors.push({
      x: sx,
      y: sy,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      radius: 9,
      speed,
      ownerId: null,
      life: 20
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const planet = this.planets.get(botId);
    if (!planet || planet.hp <= 0) return;

    // Find closest meteor threatening this planet
    let nearestMeteor: Meteor | null = null;
    let minD = Infinity;

    for (const m of this.meteors) {
      const d = Math.hypot(m.x - planet.x, m.y - planet.y);
      // Only consider meteors moving towards planet
      const dot = (m.x - planet.x) * m.vx + (m.y - planet.y) * m.vy;
      if (dot < 0 && d < minD && d < 240) {
        minD = d;
        nearestMeteor = m;
      }
    }

    if (nearestMeteor) {
      const threatAngle = Math.atan2(nearestMeteor.y - planet.y, nearestMeteor.x - planet.x);
      let diff = (threatAngle - planet.shieldAngle) % (Math.PI * 2);
      if (diff < -Math.PI) diff += Math.PI * 2;
      if (diff > Math.PI) diff -= Math.PI * 2;

      // Inaccuracy for easy
      if (difficulty === 'bot_easy' && Math.random() < 0.2) {
        diff += (Math.random() - 0.5) * 0.8;
      }

      if (Math.abs(diff) > 0.08) {
        const steer = diff > 0 ? 1 : -1;
        this.input.setBotInput(botId, false, steer, 0, false);
      } else {
        // Aligned! Repulsor pulse if meteor is very close
        const wantPulse = minD < planet.shieldDistance + 22;
        this.input.setBotInput(botId, false, 0, 0, wantPulse);
      }
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = Array.from(this.planets.values()).sort((a, b) => b.hp - a.hp);
    const winnerId = sorted.length > 0 && sorted[0].hp > 0 ? sorted[0].id : null;

    return {
      winnerId,
      rankings: sorted.map((p, idx) => ({
        playerId: p.id,
        score: p.hp * 100,
        place: idx + 1
      })),
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name}'S PLANETARY SHIELD SURVIVED!` : 'ALL PLANETS CRUMBLED!'
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Deep Space Cosmic Background
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width);
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(0.6, '#090D16');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Distant Stars
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 35; i++) {
      const sx = (i * 137.5) % width;
      const sy = (i * 219.3) % height;
      ctx.globalAlpha = 0.3 + (i % 5) * 0.12;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    ctx.globalAlpha = 1.0;

    // 2. Render Planets and Deflector Shields
    for (const p of this.planets.values()) {
      const pColor = this.players[p.id]?.color || '#38BDF8';

      // Orbital Shield Track Circle
      ctx.strokeStyle = p.hp > 0 ? 'rgba(148, 163, 184, 0.2)' : 'rgba(71, 85, 105, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.shieldDistance, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (p.hp > 0) {
        // Orbiting Deflector Shield Arc
        ctx.save();
        ctx.shadowColor = p.pulseTimer > 0 ? '#FFFFFF' : pColor;
        ctx.shadowBlur = p.pulseTimer > 0 ? 20 : 12;
        ctx.strokeStyle = p.pulseTimer > 0 ? '#FFFFFF' : pColor;
        ctx.lineWidth = p.pulseTimer > 0 ? 8 : 5;
        ctx.beginPath();
        const startA = p.shieldAngle - p.shieldSpan / 2;
        const endA = p.shieldAngle + p.shieldSpan / 2;
        ctx.arc(p.x, p.y, p.shieldDistance, startA, endA);
        ctx.stroke();
        ctx.restore();
      }

      // Planet Sphere
      ctx.save();
      if (p.hp > 0) {
        ctx.shadowColor = pColor;
        ctx.shadowBlur = 14;
        const planetGrad = ctx.createRadialGradient(p.x - 6, p.y - 6, 2, p.x, p.y, p.radius);
        planetGrad.addColorStop(0, '#FFFFFF');
        planetGrad.addColorStop(0.5, pColor);
        planetGrad.addColorStop(1, '#0F172A');
        ctx.fillStyle = planetGrad;
      } else {
        ctx.fillStyle = '#334155'; // Destroyed core
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Core HP Hearts/Bars
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      const hpStr = p.hp > 0 ? '❤️'.repeat(p.hp) : '💀 DEAD';
      ctx.fillText(hpStr, p.x, p.y - p.shieldDistance - 10);
    }

    // 3. Render Meteors
    for (const m of this.meteors) {
      ctx.save();
      ctx.shadowColor = '#F97316';
      ctx.shadowBlur = 12;

      // Fiery Core
      const mGrad = ctx.createRadialGradient(m.x, m.y, 2, m.x, m.y, m.radius);
      mGrad.addColorStop(0, '#FEF08A');
      mGrad.addColorStop(0.5, '#F97316');
      mGrad.addColorStop(1, '#9A3412');
      ctx.fillStyle = mGrad;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      ctx.fill();

      // Flame tail
      const tailAngle = Math.atan2(-m.vy, -m.vx);
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.6)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x + Math.cos(tailAngle) * 16, m.y + Math.sin(tailAngle) * 16);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }
}
