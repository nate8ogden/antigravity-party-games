import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface DeliveryDropZone {
  x: number;
  y: number;
  width: number;
  playerId: PlayerId;
}

interface DeliveryDrone {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hasPackage: boolean;
  packagesDelivered: number;
  score: number;
  rotorAnim: number;
  stunTimer: number;
}

export class DroneDeliveryGame extends BaseGame {
  public playersState: Map<PlayerId, DeliveryDrone> = new Map();
  public currentMapName: string = 'Aero-City Wind Tunnels';

  private dropZones: DeliveryDropZone[] = [];
  private windSpeed: number = 0;
  private windChangeTimer: number = 3.0;
  private packageDepotX: number = 0;
  private packageDepotY: number = 0;
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
    this.playersState.clear();
    this.dropZones = [];
    this.botReactionTimers.clear();

    this.packageDepotX = width / 2;
    this.packageDepotY = height * 0.25;

    const active = this.getActivePlayers();
    const count = active.length;
    const zoneW = 90;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const zx = spacing * (idx + 1);
      const zy = height * 0.85;

      this.dropZones.push({
        x: zx,
        y: zy,
        width: zoneW,
        playerId: p.id
      });

      this.playersState.set(p.id, {
        id: p.id,
        x: zx,
        y: zy - 40,
        vx: 0,
        vy: 0,
        angle: 0,
        hasPackage: true,
        packagesDelivered: 0,
        score: 0,
        rotorAnim: 0,
        stunTimer: 0
      });

      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Dynamic wind turbulence
    this.windChangeTimer -= dt;
    if (this.windChangeTimer <= 0) {
      this.windChangeTimer = 2.5 + Math.random() * 2.5;
      this.windSpeed = (Math.random() - 0.5) * 80;
    }

    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const drone = this.playersState.get(p.id);
      if (!drone) continue;

      if (drone.stunTimer > 0) {
        drone.stunTimer -= dt;
        continue;
      }

      drone.rotorAnim += dt * 40;

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      // Drone flight dynamics
      drone.angle = steer * 0.35;

      // Rotor lift
      const lift = (throttle > 0.1 || isAction) ? -320 : 160; // gravity vs lift
      drone.vy += lift * dt;
      drone.vx += (steer * 260 + this.windSpeed) * dt;

      // Air resistance
      drone.vx *= Math.pow(0.85, dt * 10);
      drone.vy *= Math.pow(0.85, dt * 10);

      drone.x += drone.vx * dt;
      drone.y += drone.vy * dt;

      // Boundary clamp
      const pad = 24;
      drone.x = Math.max(pad, Math.min(width - pad, drone.x));
      drone.y = Math.max(85, Math.min(height - pad, drone.y));

      // Rotor wind particles
      if (Math.random() < 0.2) {
        this.particles.emit(drone.x, drone.y + 12, 1, '#90CAF9');
      }

      // Check depot package pickup
      if (!drone.hasPackage) {
        if (Math.hypot(drone.x - this.packageDepotX, drone.y - this.packageDepotY) < 35) {
          drone.hasPackage = true;
          this.audio.playTap();
          this.particles.spawnSparks(drone.x, drone.y, '#FFD700', 6);
        }
      }

      // Check delivery drop zone
      if (drone.hasPackage) {
        const myZone = this.dropZones.find(z => z.playerId === p.id);
        if (myZone) {
          const dx = Math.abs(drone.x - myZone.x);
          const dy = Math.abs(drone.y - myZone.y);
          if (dx < myZone.width / 2 && dy < 30) {
            drone.hasPackage = false;
            drone.packagesDelivered++;
            drone.score += 30;
            this.audio.playScore();
            this.particles.spawnConfetti(myZone.x, myZone.y, 15);
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
    const drone = this.playersState.get(botId);
    if (!drone || drone.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    let targetX = this.packageDepotX;
    let targetY = this.packageDepotY;

    if (drone.hasPackage) {
      const myZone = this.dropZones.find(z => z.playerId === botId);
      if (myZone) {
        targetX = myZone.x;
        targetY = myZone.y - 20;
      }
    }

    const dx = targetX - drone.x;
    const dy = targetY - drone.y;

    let steer = 0;
    if (Math.abs(dx) > 15) {
      steer = dx > 0 ? 1 : -1;
    }

    const thrust = dy < -10; // need lift

    this.input.setBotInput(botId, thrust, steer, thrust ? 1 : -0.5, thrust);

    let delay = 0.25;
    if (difficulty === 'bot_easy') delay = 0.45;
    else if (difficulty === 'bot_hard') delay = 0.10;

    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const d = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: d?.score || 0,
        delivered: d?.packagesDelivered || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topDelivered = scores[0]?.delivered || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} completed ${topDelivered} drone deliveries!`
      : 'City crosswinds grounded all delivery drones!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // City Skyline & Wind Streamlines
    ctx.fillStyle = '#0a0a16';
    ctx.fillRect(0, 0, width, height);

    // Wind Streamline Indicators
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
    ctx.lineWidth = 1.5;
    const windOffset = (Date.now() * 0.001 * this.windSpeed) % width;
    for (let y = 140; y < height - 80; y += 70) {
      ctx.beginPath();
      ctx.moveTo(windOffset, y);
      ctx.lineTo(windOffset + 60, y);
      ctx.stroke();
    }

    // Header
    ctx.save();
    ctx.fillStyle = '#00E5FF';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DRONE DELIVERY', width / 2, 38);

    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#FFD54F';
    ctx.fillText('STEER & THRUST • PICK UP CARGO CRATES • DROP ON YOUR COLOR PAD', width / 2, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px monospace';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);
    ctx.restore();

    // Package Depot Platform
    ctx.fillStyle = '#263238';
    ctx.fillRect(this.packageDepotX - 50, this.packageDepotY, 100, 14);
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(this.packageDepotX - 10, this.packageDepotY - 14, 20, 14); // Cargo box
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CARGO DEPOT', this.packageDepotX, this.packageDepotY + 26);

    // Render Drop Zones
    for (const z of this.dropZones) {
      const p = this.getPlayer(z.playerId);
      ctx.fillStyle = p ? p.color : '#37474F';
      ctx.fillRect(z.x - z.width / 2, z.y, z.width, 12);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(z.x - z.width / 2, z.y, z.width, 12);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`PAD P${z.playerId + 1}`, z.x, z.y + 24);
    }

    // Render Drones
    for (const p of this.getActivePlayers()) {
      const drone = this.playersState.get(p.id);
      if (!drone) continue;

      ctx.save();
      ctx.translate(drone.x, drone.y);
      ctx.rotate(drone.angle);

      // Drone Central Hub
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();

      // Drone Quad Arms
      ctx.strokeStyle = '#90A4AE';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-16, -8);
      ctx.lineTo(16, 8);
      ctx.moveTo(-16, 8);
      ctx.lineTo(16, -8);
      ctx.stroke();

      // Spinning Rotors
      const spin = Math.sin(drone.rotorAnim) * 8;
      ctx.fillStyle = '#00E5FF';
      ctx.fillRect(-20, -10, spin, 2);
      ctx.fillRect(12, -10, spin, 2);
      ctx.fillRect(-20, 8, spin, 2);
      ctx.fillRect(12, 8, spin, 2);

      // Attached Cargo Package
      if (drone.hasPackage) {
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(-6, 10, 12, 12);
        ctx.strokeStyle = '#795548';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-6, 10, 12, 12);
      }

      ctx.restore();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${drone.score}`, drone.x, drone.y - 18);
    }
  }
}
