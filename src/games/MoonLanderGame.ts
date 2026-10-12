import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface LandingPad {
  x: number;
  y: number;
  width: number;
  multiplier: number;
}

interface Lander {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  fuel: number;
  score: number;
  landed: boolean;
  crashed: boolean;
  respawnTimer: number;
}

export class MoonLanderGame extends BaseGame {
  private landers: Map<PlayerId, Lander> = new Map();
  private pads: LandingPad[] = [];
  private stars: { x: number; y: number; size: number; alpha: number }[] = [];
  private surfacePoints: { x: number; y: number }[] = [];
  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.landers.clear();
    this.pads = [];
    this.stars = [];
    this.surfacePoints = [];

    // Background stars
    for (let i = 0; i < 70; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * (height * 0.75),
        size: Math.random() * 2 + 0.8,
        alpha: 0.3 + Math.random() * 0.7
      });
    }

    // Landing pads
    this.pads = [
      { x: width * 0.15, y: height * 0.86, width: 70, multiplier: 1 },
      { x: width * 0.38, y: height * 0.89, width: 50, multiplier: 2 },
      { x: width * 0.62, y: height * 0.89, width: 50, multiplier: 2 },
      { x: width * 0.85, y: height * 0.84, width: 40, multiplier: 3 }
    ];

    // Generate lunar terrain surface
    const segments = 24;
    for (let i = 0; i <= segments; i++) {
      const px = (i / segments) * width;
      let py = height * 0.88 + Math.sin(i * 1.3) * 20;

      // Flatten near pads
      for (const pad of this.pads) {
        if (Math.abs(px - pad.x) < pad.width * 0.7) {
          py = pad.y;
        }
      }
      this.surfacePoints.push({ x: px, y: py });
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const startX = width * 0.15 + (idx / Math.max(1, active.length - 1)) * (width * 0.7);
      this.landers.set(p.id, {
        id: p.id,
        x: startX,
        y: 60 + (idx % 2) * 20,
        vx: (Math.random() - 0.5) * 20,
        vy: 10,
        angle: 0,
        fuel: 100,
        score: 0,
        landed: false,
        crashed: false,
        respawnTimer: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    this.updateBots(dt, width, height);

    const gravity = 80; // lunar gravity

    for (const [id, lander] of this.landers.entries()) {
      if (lander.crashed) {
        lander.respawnTimer -= dt;
        if (lander.respawnTimer <= 0) {
          lander.crashed = false;
          lander.landed = false;
          lander.x = width * 0.2 + Math.random() * (width * 0.6);
          lander.y = 50;
          lander.vx = (Math.random() - 0.5) * 30;
          lander.vy = 10;
          lander.angle = 0;
          lander.fuel = 100;
        }
        continue;
      }

      if (lander.landed) {
        lander.respawnTimer -= dt;
        if (lander.respawnTimer <= 0) {
          lander.landed = false;
          lander.x = width * 0.2 + Math.random() * (width * 0.6);
          lander.y = 50;
          lander.vx = (Math.random() - 0.5) * 30;
          lander.vy = 10;
          lander.angle = 0;
          lander.fuel = 100;
        }
        continue;
      }

      const isThrusting = (this.input.isPressed(id) || this.input.isActionPressed(id) || this.input.getThrottle(id) > 0.3) && lander.fuel > 0;
      const turnDir = this.input.getSteer(id);

      // Rotate lander
      lander.angle += turnDir * 2.5 * dt;

      // Apply thruster
      if (isThrusting) {
        lander.fuel = Math.max(0, lander.fuel - 28 * dt);
        const thrustPower = 200;
        const thrustX = Math.sin(lander.angle) * thrustPower;
        const thrustY = -Math.cos(lander.angle) * thrustPower;
        lander.vx += thrustX * dt;
        lander.vy += thrustY * dt;

        // Exhaust particles
        this.particles.emit(
          lander.x - Math.sin(lander.angle) * 14,
          lander.y + Math.cos(lander.angle) * 14,
          2,
          '#FF9800'
        );
      }

      // Lunar gravity & drag
      lander.vy += gravity * dt;
      lander.vx *= Math.pow(0.99, dt * 60);

      lander.x += lander.vx * dt;
      lander.y += lander.vy * dt;

      // Screen boundary clamp
      if (lander.x < 20) { lander.x = 20; lander.vx = Math.abs(lander.vx) * 0.5; }
      if (lander.x > width - 20) { lander.x = width - 20; lander.vx = -Math.abs(lander.vx) * 0.5; }

      // Check touchdown on pads
      let landedOnPad = false;
      for (const pad of this.pads) {
        if (Math.abs(lander.x - pad.x) < pad.width * 0.5 && Math.abs(lander.y + 12 - pad.y) < 10) {
          const speed = Math.hypot(lander.vx, lander.vy);
          const isUpright = Math.abs(lander.angle) < 0.35; // within ~20 degrees
          if (speed < 90 && isUpright) {
            // Soft touchdown!
            landedOnPad = true;
            lander.landed = true;
            lander.vx = 0;
            lander.vy = 0;
            lander.y = pad.y - 12;
            const points = 100 * pad.multiplier;
            lander.score += points;
            lander.respawnTimer = 1.8;
            this.audio.playTone(523, 0.1, 'triangle');
            setTimeout(() => this.audio.playTone(659, 0.15, 'triangle'), 80);

            // Celebration sparks
            this.particles.emit(lander.x, lander.y, 16, '#4CAF50');
          } else {
            // Hard crash on pad
            this.crashLander(lander);
          }
          break;
        }
      }

      // Check terrain collision
      if (!landedOnPad && !lander.crashed) {
        const groundY = this.getTerrainHeightAt(lander.x, height);
        if (lander.y + 12 >= groundY) {
          this.crashLander(lander);
        }
      }
    }
  }

  private crashLander(lander: Lander): void {
    lander.crashed = true;
    lander.respawnTimer = 2.0;
    this.audio.playTone(110, 0.25, 'sawtooth');
    this.particles.emit(lander.x, lander.y, 25, '#FF1744');
  }

  private getTerrainHeightAt(x: number, defaultHeight: number): number {
    if (this.surfacePoints.length < 2) return defaultHeight * 0.9;
    for (let i = 0; i < this.surfacePoints.length - 1; i++) {
      const p1 = this.surfacePoints[i];
      const p2 = this.surfacePoints[i + 1];
      if (x >= p1.x && x <= p2.x) {
        const t = (x - p1.x) / (p2.x - p1.x);
        return p1.y + t * (p2.y - p1.y);
      }
    }
    return defaultHeight * 0.9;
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: string, _width: number, _height: number): void {
    const timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const lander = this.landers.get(botId);
    if (!lander || lander.crashed || lander.landed) return;

    // Target closest pad
    let bestPad = this.pads[0];
    let minDist = 99999;
    for (const pad of this.pads) {
      const d = Math.abs(lander.x - pad.x);
      if (d < minDist) {
        minDist = d;
        bestPad = pad;
      }
    }

    const dx = bestPad.x - lander.x;
    let turn = 0;
    let thrust = false;

    // Desired horizontal speed towards pad
    const targetVx = Math.max(-60, Math.min(60, dx * 0.8));
    const vxDiff = targetVx - lander.vx;

    // Tilt to steer horizontally
    const desiredAngle = Math.max(-0.4, Math.min(0.4, vxDiff * 0.02));
    if (lander.angle < desiredAngle - 0.08) turn = 1;
    else if (lander.angle > desiredAngle + 0.08) turn = -1;

    // Thrust to control descent rate
    const distToPad = bestPad.y - lander.y;
    const safeVy = distToPad < 120 ? 40 : 80;
    if (lander.vy > safeVy || (distToPad < 60 && lander.vy > 25)) {
      thrust = true;
    }

    let delay = 0.25;
    if (difficulty === 'bot_easy') {
      delay = 0.45;
      if (Math.random() < 0.25) thrust = !thrust;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
    }

    this.input.setBotInput(botId, thrust, turn, thrust ? 1 : 0, thrust);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Deep lunar space
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#020308');
    sky.addColorStop(1, '#0c101c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    // Stars
    for (const s of this.stars) {
      ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }

    // Distant Earth in sky
    ctx.fillStyle = '#1E88E5';
    ctx.beginPath();
    ctx.arc(width * 0.85, height * 0.18, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#43A047';
    ctx.beginPath();
    ctx.arc(width * 0.83, height * 0.16, 12, 0, Math.PI * 2);
    ctx.fill();

    // Lunar terrain
    ctx.fillStyle = '#263238';
    ctx.beginPath();
    if (this.surfacePoints.length > 0) {
      ctx.moveTo(this.surfacePoints[0].x, this.surfacePoints[0].y);
      for (let i = 1; i < this.surfacePoints.length; i++) {
        ctx.lineTo(this.surfacePoints[i].x, this.surfacePoints[i].y);
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();
    }

    // Landing pads
    for (const pad of this.pads) {
      ctx.fillStyle = '#455A64';
      ctx.fillRect(pad.x - pad.width * 0.5, pad.y, pad.width, 10);
      ctx.strokeStyle = pad.multiplier >= 3 ? '#FFD700' : '#00E5FF';
      ctx.lineWidth = 3;
      ctx.strokeRect(pad.x - pad.width * 0.5, pad.y, pad.width, 10);

      // Multiplier label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${pad.multiplier}x`, pad.x, pad.y + 8);
    }

    // Render Landers
    for (const [id, lander] of this.landers.entries()) {
      if (lander.crashed) continue;

      ctx.save();
      ctx.translate(lander.x, lander.y);
      ctx.rotate(lander.angle);

      const color = this.getPlayer(id)?.color || '#EF4444';

      // Capsule body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(9, 6);
      ctx.lineTo(-9, 6);
      ctx.closePath();
      ctx.fill();

      // Window cockpit
      ctx.fillStyle = '#E0F7FA';
      ctx.beginPath();
      ctx.arc(0, -2, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Landing legs
      ctx.strokeStyle = '#CFD8DC';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, 6);
      ctx.lineTo(-11, 14);
      ctx.moveTo(6, 6);
      ctx.lineTo(11, 14);
      ctx.stroke();

      ctx.restore();

      // Fuel bar & score above lander
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(lander.x - 16, lander.y - 24, 32, 4);
      ctx.fillStyle = lander.fuel > 25 ? '#76FF03' : '#FF1744';
      ctx.fillRect(lander.x - 16, lander.y - 24, (lander.fuel / 100) * 32, 4);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${lander.score}`, lander.x, lander.y - 28);
    }
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.landers.entries()).map(([playerId, lander]) => ({
      playerId,
      score: lander.score
    }));
    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `Player ${winnerId + 1} landed masterfully with ${scores[0].score} pts!` : 'All landers touched down!'
    };
  }
}
