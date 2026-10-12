import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Checkpoint {
  x: number;
  y: number;
  radius: number;
}

interface DrifterCar {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVel: number;
  speed: number;
  driftFactor: number;
  isDrifting: boolean;
  driftScore: number;
  currentCheckpoint: number;
  lapsCompleted: number;
  nitroBoostTimer: number;
  skidTimer: number;
}

export class NeonDriftersGame extends BaseGame {
  public playersState: Map<PlayerId, DrifterCar> = new Map();
  public currentMapName: string = 'Neo-Shinjuku Drift Circuit';

  private checkpoints: Checkpoint[] = [];
  private totalLaps: number = 3;
  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 45.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 45.0;
    this.isFinished = false;
    this.playersState.clear();
    this.botReactionTimers.clear();

    // Circuit Checkpoints forming a neon figure-8 / grand oval
    const cx = width / 2;
    const cy = height / 2;
    this.checkpoints = [
      { x: cx, y: height * 0.82, radius: 45 },
      { x: width * 0.82, y: cy + 40, radius: 50 },
      { x: width * 0.75, y: height * 0.22, radius: 45 },
      { x: cx, y: cy, radius: 40 },
      { x: width * 0.25, y: height * 0.22, radius: 45 },
      { x: width * 0.18, y: cy + 40, radius: 50 }
    ];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const offsetX = (idx - (active.length - 1) / 2) * 28;
      this.playersState.set(p.id, {
        id: p.id,
        x: cx + offsetX,
        y: height * 0.82 + 10,
        vx: 0,
        vy: 0,
        angle: 0, // facing right
        angularVel: 0,
        speed: 0,
        driftFactor: 0.92,
        isDrifting: false,
        driftScore: 0,
        currentCheckpoint: 0,
        lapsCompleted: 0,
        nitroBoostTimer: 0,
        skidTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const car = this.playersState.get(p.id);
      if (!car) continue;

      if (car.nitroBoostTimer > 0) car.nitroBoostTimer -= dt;
      if (car.skidTimer > 0) car.skidTimer -= dt;

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      // Steering
      const turnSpeed = car.isDrifting ? 3.8 : 2.8;
      car.angle += steer * turnSpeed * dt;

      // Acceleration / Braking
      const maxSpeed = car.nitroBoostTimer > 0 ? 320 : 220;
      const accel = car.nitroBoostTimer > 0 ? 380 : 260;

      if (throttle > 0.1 || isAction) {
        car.speed = Math.min(maxSpeed, car.speed + accel * dt);
      } else if (throttle < -0.1) {
        car.speed = Math.max(-80, car.speed - 240 * dt);
      } else {
        car.speed *= Math.pow(0.85, dt * 10);
      }

      // Drift calculation
      car.isDrifting = Math.abs(steer) > 0.4 && car.speed > 120;
      if (car.isDrifting) {
        car.driftScore += dt * 100;
        car.skidTimer = 0.1;

        // Tire smoke & neon sparks
        this.particles.emit(
          car.x - Math.cos(car.angle) * 14,
          car.y - Math.sin(car.angle) * 14,
          1,
          p.color
        );
      }

      // Velocity with drift slide
      const forwardX = Math.cos(car.angle) * car.speed;
      const forwardY = Math.sin(car.angle) * car.speed;

      const grip = car.isDrifting ? 0.78 : 0.94;
      car.vx = car.vx * grip + forwardX * (1 - grip);
      car.vy = car.vy * grip + forwardY * (1 - grip);

      car.x += car.vx * dt;
      car.y += car.vy * dt;

      // Boundary clamp
      const pad = 24;
      car.x = Math.max(pad, Math.min(width - pad, car.x));
      car.y = Math.max(70, Math.min(height - pad, car.y));

      // Checkpoint tracking
      const targetCp = this.checkpoints[car.currentCheckpoint];
      const distToCp = Math.hypot(car.x - targetCp.x, car.y - targetCp.y);

      if (distToCp < targetCp.radius) {
        car.currentCheckpoint = (car.currentCheckpoint + 1) % this.checkpoints.length;
        if (car.currentCheckpoint === 0) {
          car.lapsCompleted++;
          this.audio.playScore();
          this.particles.spawnConfetti(car.x, car.y, 15);

          if (car.lapsCompleted >= this.totalLaps) {
            this.isFinished = true;
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
    const car = this.playersState.get(botId);
    if (!car) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const targetCp = this.checkpoints[car.currentCheckpoint];
    const targetAngle = Math.atan2(targetCp.y - car.y, targetCp.x - car.x);

    let angleDiff = targetAngle - car.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    let steer = 0;
    if (Math.abs(angleDiff) > 0.15) {
      steer = angleDiff > 0 ? 1 : -1;
    }

    let throttle = 1.0;
    if (Math.abs(angleDiff) > 1.2 && car.speed > 130) {
      throttle = 0.2; // brake on tight hairpin
    }

    this.input.setBotInput(botId, true, steer, throttle, true);

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
      const car = this.playersState.get(p.id);
      const totalScore = (car?.lapsCompleted || 0) * 1000 + (car?.currentCheckpoint || 0) * 100 + Math.floor(car?.driftScore || 0);
      return {
        playerId: p.id,
        score: totalScore,
        laps: car?.lapsCompleted || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topLaps = scores[0]?.laps || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} dominated the Neo-Shinjuku Drift with ${topLaps} laps!`
      : 'The midnight race finished in a smoke screen draw!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Cyberpunk Dark Metropolis Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0a0a14');
    bgGrad.addColorStop(1, '#14142b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Neon Asphalt Track Path
    ctx.strokeStyle = '#232342';
    ctx.lineWidth = 60;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    this.checkpoints.forEach((cp, idx) => {
      if (idx === 0) ctx.moveTo(cp.x, cp.y);
      else ctx.lineTo(cp.x, cp.y);
    });
    ctx.closePath();
    ctx.stroke();

    // Glowing Neon Track Edges
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Checkpoint guides
    for (let i = 0; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i];
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, cp.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Top Header
    ctx.save();
    ctx.fillStyle = '#00E5FF';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NEON DRIFTERS', width / 2, 38);

    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#E040FB';
    ctx.fillText('STEER INTO HAIRPINS TO DRIFT • COMPLETE 3 LAPS FOR GLORY', width / 2, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px monospace';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);
    ctx.restore();

    // Render Cars
    for (const p of this.getActivePlayers()) {
      const car = this.playersState.get(p.id);
      if (!car) continue;
      this.renderCar(ctx, car, p);
    }
  }

  private renderCar(ctx: CanvasRenderingContext2D, car: DrifterCar, p: PlayerConfig): void {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    // Tire Skid Trails
    if (car.isDrifting) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillRect(-16, -10, 8, 4);
      ctx.fillRect(-16, 6, 8, 4);
    }

    // Car Body (Aerodynamic Cyber Drifter)
    ctx.fillStyle = '#1A1A24';
    ctx.beginPath();
    ctx.roundRect(-15, -9, 30, 18, 4);
    ctx.fill();

    // Player Colored Racing Livery
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.roundRect(-10, -7, 20, 14, 3);
    ctx.fill();

    // Cockpit windshield
    ctx.fillStyle = '#00E5FF';
    ctx.beginPath();
    ctx.ellipse(2, 0, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Neon Headlights
    ctx.fillStyle = '#FFFF00';
    ctx.fillRect(12, -7, 3, 3);
    ctx.fillRect(12, 4, 3, 3);

    // Neon Tail Lights
    ctx.fillStyle = '#FF1744';
    ctx.fillRect(-15, -7, 2, 3);
    ctx.fillRect(-15, 4, 2, 3);

    ctx.restore();

    // Lap HUD above car
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Lap ${car.lapsCompleted + 1}/${this.totalLaps}`, car.x, car.y - 16);
  }
}
