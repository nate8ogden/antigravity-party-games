import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface WaypointRing {
  id: number;
  x: number;
  y: number;
  radius: number;
}

interface NebulaCloud {
  x: number;
  y: number;
  radius: number;
  color: string;
}

interface DriftCraft {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  nitro: number; // 0 to 100
  currentWaypointIdx: number;
  score: number;
  isBoosting: boolean;
}

export class NebulaDriftGame extends BaseGame {
  private craft: Map<PlayerId, DriftCraft> = new Map();
  private waypoints: WaypointRing[] = [];
  private clouds: NebulaCloud[] = [];
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
    this.craft.clear();
    this.waypoints = [];
    this.clouds = [];

    // Nebula dust clouds
    this.clouds = [
      { x: width * 0.25, y: height * 0.35, radius: 90, color: 'rgba(124, 77, 255, 0.25)' },
      { x: width * 0.75, y: height * 0.65, radius: 100, color: 'rgba(0, 229, 255, 0.22)' },
      { x: width * 0.5, y: height * 0.5, radius: 80, color: 'rgba(255, 64, 129, 0.22)' }
    ];

    // Nav Waypoint Ring Circuit
    this.waypoints = [
      { id: 0, x: width * 0.18, y: height * 0.2, radius: 36 },
      { id: 1, x: width * 0.5, y: height * 0.18, radius: 36 },
      { id: 2, x: width * 0.82, y: height * 0.25, radius: 36 },
      { id: 3, x: width * 0.82, y: height * 0.78, radius: 36 },
      { id: 4, x: width * 0.5, y: height * 0.82, radius: 36 },
      { id: 5, x: width * 0.18, y: height * 0.75, radius: 36 }
    ];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.craft.set(p.id, {
        id: p.id,
        x: width * 0.18 + (idx * 20),
        y: height * 0.2 + (idx * 16),
        vx: 0,
        vy: 0,
        angle: 0,
        nitro: 50,
        currentWaypointIdx: 1,
        score: 0,
        isBoosting: false
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

    // Update Craft
    for (const [id, c] of this.craft.entries()) {
      const turnDir = this.input.getSteer(id);
      c.angle += turnDir * 4.0 * dt;

      // Check if inside nebula cloud to recharge nitro
      let inNebula = false;
      for (const cloud of this.clouds) {
        if (Math.hypot(c.x - cloud.x, c.y - cloud.y) < cloud.radius) {
          inNebula = true;
          break;
        }
      }
      if (inNebula) {
        c.nitro = Math.min(100, c.nitro + 45 * dt);
      } else {
        c.nitro = Math.min(100, c.nitro + 12 * dt);
      }

      // Boosting
      c.isBoosting = this.input.isActionPressed(id) && c.nitro > 10;
      let thrustPower = 180;
      if (c.isBoosting) {
        thrustPower = 380;
        c.nitro = Math.max(0, c.nitro - 55 * dt);
      }

      const throttle = this.input.getThrottle(id);
      const isThrusting = throttle > 0.3 || this.input.isPressed(id) || c.isBoosting;
      if (isThrusting) {
        c.vx += Math.cos(c.angle) * thrustPower * dt;
        c.vy += Math.sin(c.angle) * thrustPower * dt;

        this.particles.emit(
          c.x - Math.cos(c.angle) * 14,
          c.y - Math.sin(c.angle) * 14,
          c.isBoosting ? 3 : 1,
          c.isBoosting ? '#00E5FF' : '#E040FB'
        );
      }

      // Low space friction for drifting
      c.vx *= Math.pow(0.975, dt * 60);
      c.vy *= Math.pow(0.975, dt * 60);

      c.x += c.vx * dt;
      c.y += c.vy * dt;

      // Screen clamp
      c.x = Math.max(20, Math.min(width - 20, c.x));
      c.y = Math.max(20, Math.min(height - 20, c.y));

      // Check current target waypoint ring
      const targetWaypoint = this.waypoints[c.currentWaypointIdx];
      if (Math.hypot(c.x - targetWaypoint.x, c.y - targetWaypoint.y) < targetWaypoint.radius) {
        c.score += 50;
        c.currentWaypointIdx = (c.currentWaypointIdx + 1) % this.waypoints.length;
        this.audio.playTone(659, 0.08, 'triangle');
        this.particles.emit(targetWaypoint.x, targetWaypoint.y, 12, '#76FF03');
      }
    }
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: string, _width: number, _height: number): void {
    const timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const c = this.craft.get(botId);
    if (!c) return;

    const targetWaypoint = this.waypoints[c.currentWaypointIdx];
    const dx = targetWaypoint.x - c.x;
    const dy = targetWaypoint.y - c.y;
    const desiredAngle = Math.atan2(dy, dx);

    let angleDiff = desiredAngle - c.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    let turn = 0;
    if (angleDiff > 0.15) turn = 1;
    else if (angleDiff < -0.15) turn = -1;

    const thrust = Math.abs(angleDiff) < 1.0;
    const wantBoost = Math.abs(angleDiff) < 0.3 && c.nitro > 40 && Math.hypot(dx, dy) > 120;

    let delay = 0.25;
    if (difficulty === 'bot_easy') {
      delay = 0.45;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
    }

    this.input.setBotInput(botId, thrust, turn, thrust ? 1 : 0, wantBoost);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#060410';
    ctx.fillRect(0, 0, width, height);

    for (const cloud of this.clouds) {
      ctx.save();
      const grad = ctx.createRadialGradient(cloud.x, cloud.y, cloud.radius * 0.1, cloud.x, cloud.y, cloud.radius);
      grad.addColorStop(0, cloud.color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (let i = 0; i < this.waypoints.length; i++) {
      const wp = this.waypoints[i];
      ctx.strokeStyle = '#455A64';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, wp.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#78909C';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, wp.x, wp.y + 4);
    }

    for (const [id, c] of this.craft.entries()) {
      const wp = this.waypoints[c.currentWaypointIdx];
      const color = this.getPlayer(id)?.color || '#EF4444';

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wp.x, wp.y, wp.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const [id, c] of this.craft.entries()) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);

      const color = this.getPlayer(id)?.color || '#EF4444';

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(-12, -10);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-12, 10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#E0F7FA';
      ctx.beginPath();
      ctx.arc(2, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(c.x - 14, c.y - 18, 28, 3.5);
      ctx.fillStyle = '#00E5FF';
      ctx.fillRect(c.x - 14, c.y - 18, (c.nitro / 100) * 28, 3.5);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${c.score}`, c.x, c.y - 23);
    }
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.craft.entries()).map(([playerId, c]) => ({
      playerId,
      score: c.score
    }));
    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `Player ${winnerId + 1} drifted through the nebula with ${scores[0].score} pts!` : 'Nav circuit completed!'
    };
  }
}
