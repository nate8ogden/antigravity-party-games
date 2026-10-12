import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Bathysphere {
  id: PlayerId;
  angle: number; // orbital angle around center
  distance: number; // radius from center
  orbitSpeed: number;
  radialVelocity: number;
  lives: number;
  score: number;
  isAlive: boolean;
  inkBlindTimer: number;
  turboCooldown: number;
}

interface PlanktonOrb {
  id: number;
  angle: number;
  distance: number;
  points: number;
}

export class OctopusInkGame extends BaseGame {
  private subs: Map<PlayerId, Bathysphere> = new Map();
  private orbs: PlanktonOrb[] = [];
  private orbIdCounter: number = 0;
  private krakenRotation: number = 0;
  private tentacleWave: number = 0;
  private inkPuffs: { x: number; y: number; radius: number; life: number }[] = [];
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private spawnOrbTimer: number = 0;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 38.0;
    this.isFinished = false;
    this.subs.clear();
    this.orbs = [];
    this.inkPuffs = [];
    this.krakenRotation = 0;
    this.tentacleWave = 0;
    this.spawnOrbTimer = 0.5;

    const active = this.getActivePlayers();
    const baseDist = Math.min(width, height) * 0.36;

    active.forEach((p, idx) => {
      const angle = (idx / active.length) * Math.PI * 2;
      this.subs.set(p.id, {
        id: p.id,
        angle,
        distance: baseDist,
        orbitSpeed: 1.2,
        radialVelocity: 0,
        lives: 3,
        score: 0,
        isAlive: true,
        inkBlindTimer: 0,
        turboCooldown: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });

    for (let i = 0; i < 6; i++) {
      this.spawnOrb(width, height);
    }
  }

  private spawnOrb(width: number, height: number): void {
    const minD = Math.min(width, height) * 0.18;
    const maxD = Math.min(width, height) * 0.42;
    this.orbs.push({
      id: ++this.orbIdCounter,
      angle: Math.random() * Math.PI * 2,
      distance: minD + Math.random() * (maxD - minD),
      points: 15
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.krakenRotation += dt * 0.45;
    this.tentacleWave += dt * 3.0;

    // Ink puff sputters from kraken
    if (Math.random() < 0.04 && this.inkPuffs.length < 5) {
      const puffAngle = Math.random() * Math.PI * 2;
      const puffDist = 45 + Math.random() * 60;
      this.inkPuffs.push({
        x: width / 2 + Math.cos(puffAngle) * puffDist,
        y: height / 2 + Math.sin(puffAngle) * puffDist,
        radius: 20 + Math.random() * 15,
        life: 4.0
      });
    }

    // Update ink puffs
    for (let i = this.inkPuffs.length - 1; i >= 0; i--) {
      const puff = this.inkPuffs[i];
      puff.life -= dt;
      puff.radius += dt * 5;
      if (puff.life <= 0) {
        this.inkPuffs.splice(i, 1);
      }
    }

    this.spawnOrbTimer -= dt;
    if (this.spawnOrbTimer <= 0 && this.orbs.length < 8) {
      this.spawnOrbTimer = 1.8;
      this.spawnOrb(width, height);
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();
    const cx = width / 2;
    const cy = height / 2;
    const minRadius = Math.min(width, height) * 0.14;
    const maxRadius = Math.min(width, height) * 0.46;

    for (const p of active) {
      const sub = this.subs.get(p.id);
      if (!sub || !sub.isAlive) continue;

      if (sub.inkBlindTimer > 0) sub.inkBlindTimer -= dt;
      if (sub.turboCooldown > 0) sub.turboCooldown -= dt;

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      // Orbit control (left/right changes angular speed, throttle moves in/out)
      const baseSpeed = sub.inkBlindTimer > 0 ? 0.7 : 1.4;
      sub.angle += (sub.orbitSpeed * baseSpeed + steer * 1.5) * dt;
      sub.distance += (-throttle * 140) * dt;

      // Turbo surge
      if (justAction && sub.turboCooldown <= 0) {
        sub.turboCooldown = 1.5;
        sub.angle += Math.sign(sub.orbitSpeed) * 0.35;
        this.audio.playTap();
        const subX = cx + Math.cos(sub.angle) * sub.distance;
        const subY = cy + Math.sin(sub.angle) * sub.distance;
        this.particles.emit(subX, subY, 6, '#00E5FF');
      }

      // Radius boundary limits
      sub.distance = Math.max(minRadius, Math.min(maxRadius, sub.distance));

      const subX = cx + Math.cos(sub.angle) * sub.distance;
      const subY = cy + Math.sin(sub.angle) * sub.distance;

      // Ink puff collision
      for (const puff of this.inkPuffs) {
        if (Math.hypot(subX - puff.x, subY - puff.y) < puff.radius + 10) {
          if (sub.inkBlindTimer <= 0) {
            sub.inkBlindTimer = 2.0;
            this.audio.playBounce();
            this.particles.emit(subX, subY, 8, '#212121');
          }
        }
      }

      // Check collision with 6 giant rotating kraken tentacles
      const numTentacles = 6;
      for (let t = 0; t < numTentacles; t++) {
        const tAngle = this.krakenRotation + (t / numTentacles) * Math.PI * 2;
        let diff = Math.abs(sub.angle - tAngle);
        while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

        // Sweeping tentacle reach
        const reach = Math.min(width, height) * 0.38 + Math.sin(this.tentacleWave + t) * 25;
        if (diff < 0.16 && sub.distance < reach) {
          sub.lives--;
          sub.distance += 40; // knocked outward
          sub.score = Math.max(0, sub.score - 10);
          this.audio.playExplosion();
          this.particles.emit(subX, subY, 14, '#FF5252');

          if (sub.lives <= 0) {
            sub.isAlive = false;
          }
          break;
        }
      }

      // Orb collection
      for (let i = this.orbs.length - 1; i >= 0; i--) {
        const orb = this.orbs[i];
        const orbX = cx + Math.cos(orb.angle) * orb.distance;
        const orbY = cy + Math.sin(orb.angle) * orb.distance;

        if (Math.hypot(subX - orbX, subY - orbY) < 22) {
          sub.score += orb.points;
          this.audio.playScore();
          this.particles.spawnConfetti(orbX, orbY, 8);
          this.orbs.splice(i, 1);
        }
      }
    }

    const aliveCount = Array.from(this.subs.values()).filter(s => s.isAlive).length;
    if ((aliveCount <= 1 && active.length > 1) || this.roundTimer <= 0) {
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

    let steer = 0;
    let throttle = 0;
    let delay = 0.25;

    // Find nearest orb
    let nearestOrb: PlanktonOrb | null = null;
    let minAngleDiff = Infinity;
    for (const orb of this.orbs) {
      let diff = Math.abs(sub.angle - orb.angle);
      while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
      if (diff < minAngleDiff) {
        minAngleDiff = diff;
        nearestOrb = orb;
      }
    }

    if (nearestOrb) {
      let dAngle = nearestOrb.angle - sub.angle;
      while (dAngle < -Math.PI) dAngle += Math.PI * 2;
      while (dAngle > Math.PI) dAngle -= Math.PI * 2;

      steer = dAngle > 0 ? 1 : -1;
      throttle = nearestOrb.distance > sub.distance ? -1 : 1;
    }

    if (difficulty === 'bot_easy') {
      delay = 0.45;
      if (Math.random() < 0.2) steer = -steer;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
    }

    this.input.setBotInput(botId, false, steer, throttle, false);
    this.botReactionTimers.set(botId, delay);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Whirlpool abyss background
    const grad = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width * 0.6);
    grad.addColorStop(0, '#001020');
    grad.addColorStop(1, '#002B49');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    // Render ink clouds
    for (const puff of this.inkPuffs) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.beginPath();
      ctx.arc(puff.x, puff.y, puff.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render 6 giant kraken tentacles
    const numTentacles = 6;
    for (let t = 0; t < numTentacles; t++) {
      const tAngle = this.krakenRotation + (t / numTentacles) * Math.PI * 2;
      const reach = Math.min(width, height) * 0.38 + Math.sin(this.tentacleWave + t) * 25;

      ctx.strokeStyle = '#D81B60';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy);

      const midX = cx + Math.cos(tAngle + 0.2) * (reach * 0.55);
      const midY = cy + Math.sin(tAngle + 0.2) * (reach * 0.55);
      const endX = cx + Math.cos(tAngle) * reach;
      const endY = cy + Math.sin(tAngle) * reach;

      ctx.quadraticCurveTo(midX, midY, endX, endY);
      ctx.stroke();

      // Suction cup rings
      ctx.fillStyle = '#FF80AB';
      ctx.beginPath();
      ctx.arc(endX, endY, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Kraken head center
    ctx.fillStyle = '#C2185B';
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.fill();

    // Ominous yellow kraken eyes
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(cx - 10, cy - 6, 5, 0, Math.PI * 2);
    ctx.arc(cx + 10, cy - 6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(cx - 10, cy - 6, 2, 0, Math.PI * 2);
    ctx.arc(cx + 10, cy - 6, 2, 0, Math.PI * 2);
    ctx.fill();

    // Render plankton orbs
    for (const orb of this.orbs) {
      const ox = cx + Math.cos(orb.angle) * orb.distance;
      const oy = cy + Math.sin(orb.angle) * orb.distance;

      ctx.fillStyle = '#00E5FF';
      ctx.beginPath();
      ctx.arc(ox, oy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Render player bathyspheres
    for (const [id, sub] of this.subs.entries()) {
      if (!sub.isAlive) continue;
      const p = this.players.find(pl => pl.id === id);
      const color = p ? p.color : '#00E5FF';

      const sx = cx + Math.cos(sub.angle) * sub.distance;
      const sy = cy + Math.sin(sub.angle) * sub.distance;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(sub.angle + Math.PI / 2);

      // Bathysphere sphere body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Porthole window
      ctx.fillStyle = '#80D8FF';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Lives above bathysphere
      for (let l = 0; l < 3; l++) {
        ctx.fillStyle = l < sub.lives ? '#FF1744' : '#546E7A';
        ctx.beginPath();
        ctx.arc(sx - 10 + l * 10, sy - 18, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Timer
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
      return {
        playerId: p.id,
        score: sub ? sub.score + (sub.isAlive ? sub.lives * 25 : 0) : 0
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
      mvpHighlight: winnerId !== null ? `Player ${winnerId + 1} escaped the kraken vortex!` : 'The kraken dragged all bathyspheres into the ink!'
    };
  }
}
