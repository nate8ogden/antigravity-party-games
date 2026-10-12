import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SlotCarTrackNode {
  x: number;
  y: number;
  isCorner: boolean;
}

interface SlotCar {
  id: PlayerId;
  trackProgress: number; // 0 to 1 along track perimeter
  speed: number;
  heat: number; // 0 to 100%
  isOverheated: boolean;
  overheatTimer: number;
  laps: number;
  score: number;
  laneRadiusOffset: number;
}

export class LaserSpeedwayGame extends BaseGame {
  public playersState: Map<PlayerId, SlotCar> = new Map();
  public currentMapName: string = 'Neon Slot-Car Speedway';

  private trackNodes: SlotCarTrackNode[] = [];
  private totalLaps: number = 3;
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
    this.botReactionTimers.clear();

    const cx = width / 2;
    const cy = height * 0.54;
    const rx = width * 0.38;
    const ry = height * 0.32;

    this.trackNodes = [
      { x: cx, y: cy - ry, isCorner: false },
      { x: cx + rx * 0.7, y: cy - ry, isCorner: true },
      { x: cx + rx, y: cy, isCorner: true },
      { x: cx + rx * 0.7, y: cy + ry, isCorner: true },
      { x: cx, y: cy + ry, isCorner: false },
      { x: cx - rx * 0.7, y: cy + ry, isCorner: true },
      { x: cx - rx, y: cy, isCorner: true },
      { x: cx - rx * 0.7, y: cy - ry, isCorner: true }
    ];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        trackProgress: 0,
        speed: 0,
        heat: 0,
        isOverheated: false,
        overheatTimer: 0,
        laps: 0,
        score: 0,
        laneRadiusOffset: (idx - (active.length - 1) / 2) * 16
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

      if (car.isOverheated) {
        car.overheatTimer -= dt;
        car.speed *= Math.pow(0.8, dt * 10);
        if (car.overheatTimer <= 0) {
          car.isOverheated = false;
          car.heat = 20;
        }
        continue;
      }

      const isGas = this.input.isActionPressed(p.id) || this.input.isPressed(p.id) || this.input.getThrottle(p.id) > 0.1;

      // Track curvature check: is current progress in a corner?
      const inCorner = (car.trackProgress > 0.08 && car.trackProgress < 0.42) || (car.trackProgress > 0.58 && car.trackProgress < 0.92);

      if (isGas) {
        car.speed = Math.min(0.55, car.speed + 0.6 * dt);
        // Heat generation
        const heatRate = inCorner ? 65 : 22;
        car.heat = Math.min(100, car.heat + heatRate * dt);
      } else {
        car.speed = Math.max(0.08, car.speed - 0.4 * dt);
        car.heat = Math.max(0, car.heat - 40 * dt);
      }

      // Check overheat blowout
      if (car.heat >= 100) {
        car.isOverheated = true;
        car.overheatTimer = 1.4;
        this.audio.playExplosion();
        const pos = this.getTrackPosition(car.trackProgress, car.laneRadiusOffset, width, height);
        this.particles.emit(pos.x, pos.y, 10, '#E53935');
      }

      // Move along track
      const prevProg = car.trackProgress;
      car.trackProgress = (car.trackProgress + car.speed * dt);
      if (car.trackProgress >= 1.0) {
        car.trackProgress -= 1.0;
        car.laps++;
        car.score += 100;
        this.audio.playScore();
        const pos = this.getTrackPosition(car.trackProgress, car.laneRadiusOffset, width, height);
        this.particles.spawnConfetti(pos.x, pos.y, 15);

        if (car.laps >= this.totalLaps) {
          this.isFinished = true;
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private getTrackPosition(prog: number, laneOffset: number, width: number, height: number): { x: number; y: number } {
    const cx = width / 2;
    const cy = height * 0.54;
    const rx = width * 0.38 + laneOffset;
    const ry = height * 0.32 + laneOffset;

    const angle = prog * Math.PI * 2 - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry
    };
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const car = this.playersState.get(botId);
    if (!car || car.isOverheated) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    // Bot manages throttle to avoid overheat
    const inCorner = (car.trackProgress > 0.08 && car.trackProgress < 0.42) || (car.trackProgress > 0.58 && car.trackProgress < 0.92);

    let maxAllowedHeat = 80;
    if (difficulty === 'bot_easy') maxAllowedHeat = 95; // crashes more often!
    else if (difficulty === 'bot_hard') maxAllowedHeat = 75;

    let gas = true;
    if (inCorner && car.heat > maxAllowedHeat) {
      gas = false;
    }

    this.input.setBotInput(botId, gas, 0, gas ? 1 : 0, gas);

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
      return {
        playerId: p.id,
        score: (car?.laps || 0) * 100 + Math.floor((car?.trackProgress || 0) * 100),
        laps: car?.laps || 0
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
      ? `Player ${winnerId + 1} clinched the Laser Speedway with ${topLaps} laps!`
      : 'Speedway capacitor overload halted all slot cars!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, width, height);

    // Render Laser Rails for each lane
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const laneOffset = (idx - (active.length - 1) / 2) * 16;
      const cx = width / 2;
      const cy = height * 0.54;
      const rx = width * 0.38 + laneOffset;
      const ry = height * 0.32 + laneOffset;

      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Header
    ctx.save();
    ctx.fillStyle = '#00E5FF';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LASER SPEEDWAY', width / 2, 38);

    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#FFD54F';
    ctx.fillText('HOLD THROTTLE TO ACCELERATE • RELEASE IN CORNERS TO COOL DOWN', width / 2, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px monospace';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);
    ctx.restore();

    // Render Cars
    for (const p of active) {
      const car = this.playersState.get(p.id);
      if (!car) continue;

      const pos = this.getTrackPosition(car.trackProgress, car.laneRadiusOffset, width, height);

      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Car body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(-10, -6, 20, 12, 3);
      ctx.fill();

      // Overheat warning / flash
      if (car.isOverheated) {
        ctx.fillStyle = '#FF1744';
        ctx.font = '900 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BLOWOUT!', 0, -14);
      }

      ctx.restore();

      // Heat Bar above car
      ctx.fillStyle = '#263238';
      ctx.fillRect(pos.x - 14, pos.y - 12, 28, 4);
      ctx.fillStyle = car.heat > 75 ? '#FF1744' : '#00E5FF';
      ctx.fillRect(pos.x - 14, pos.y - 12, (car.heat / 100) * 28, 4);
    }
  }
}
