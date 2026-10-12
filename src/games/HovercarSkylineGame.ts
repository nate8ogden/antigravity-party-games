import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CyberObstacle {
  id: number;
  x: number;
  y: number;
  type: 'truck' | 'barrier' | 'battery';
  passed: boolean;
}

interface Hovercar {
  id: PlayerId;
  laneIdx: number; // 0, 1, or 2
  targetY: number;
  currentY: number;
  speed: number;
  score: number;
  shield: number;
  stumbleTimer: number;
  obstacles: CyberObstacle[];
  spawnTimer: number;
  switchCooldown: number;
  lastThrottle: number;
}

export class HovercarSkylineGame extends BaseGame {
  public cars: Map<PlayerId, Hovercar> = new Map();
  public currentMapName: string = 'Neo-Tokyo Skyline Cyberway';
  private obsCounter: number = 0;
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

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 35.0;
    this.cars.clear();
    this.obsCounter = 0;
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const playerBlockH = (height - 90) / Math.max(count, 1);

    active.forEach((p, idx) => {
      const baseY = 70 + idx * playerBlockH + playerBlockH * 0.5;

      this.cars.set(p.id, {
        id: p.id,
        laneIdx: 1, // center lane of their 3 sub-lanes
        targetY: baseY,
        currentY: baseY,
        speed: 260,
        score: 0,
        shield: 100,
        stumbleTimer: 0,
        obstacles: [],
        spawnTimer: 0.5 + Math.random() * 0.4,
        switchCooldown: 0,
        lastThrottle: 0
      });

      this.botReactionTimers.set(p.id, 0.2 + Math.random() * 0.3);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.finishRound();
      return;
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    const playerBlockH = (height - 90) / Math.max(count, 1);
    const subLaneH = playerBlockH / 3;

    this.cars.forEach((car, pId) => {
      const idx = active.findIndex(p => p.id === pId);
      const baseY = 70 + idx * playerBlockH;

      if (car.stumbleTimer > 0) {
        car.stumbleTimer -= dt;
        car.speed = 100;
      } else {
        car.speed = Math.min(420, car.speed + dt * 10);
      }

      car.score += Math.round(car.speed * dt * 0.1);

      // Support discrete Up/Down directional lane switching as well as tap cycling
      if (car.switchCooldown > 0) car.switchCooldown -= dt;

      const throttle = this.input.getThrottle(car.id);
      const isUp = this.input.justUp(car.id) || (throttle > 0.4 && car.lastThrottle <= 0.4);
      const isDown = this.input.justDown(car.id) || (throttle < -0.4 && car.lastThrottle >= -0.4);
      const isTap = this.input.justAction(car.id) || (this.input.justPressed(car.id) && !isUp && !isDown);

      if (car.stumbleTimer <= 0) {
        if (isUp && car.laneIdx > 0) {
          car.laneIdx--;
          car.switchCooldown = 0.20;
          this.audio.playTone(460 + (2 - car.laneIdx) * 80, 0.05, 'triangle');
          this.particles.emit(70, car.currentY, 4, '#00ffff');
        } else if (isDown && car.laneIdx < 2) {
          car.laneIdx++;
          car.switchCooldown = 0.20;
          this.audio.playTone(460 + (2 - car.laneIdx) * 80, 0.05, 'triangle');
          this.particles.emit(70, car.currentY, 4, '#00ffff');
        } else if (isTap) {
          car.laneIdx = (car.laneIdx + 1) % 3;
          this.audio.playTone(520, 0.05, 'triangle');
          this.particles.emit(70, car.currentY, 4, '#00ffff');
        }
      }
      car.lastThrottle = throttle;

      car.targetY = baseY + car.laneIdx * subLaneH + subLaneH * 0.5;
      car.currentY += (car.targetY - car.currentY) * 12 * dt;

      // Spawn obstacles along the 3 sub-lanes
      car.spawnTimer -= dt;
      if (car.spawnTimer <= 0) {
        car.spawnTimer = 0.8 + Math.random() * 0.5;
        const obsLane = Math.floor(Math.random() * 3);
        const rand = Math.random();
        const type = rand < 0.3 ? 'battery' : rand < 0.7 ? 'truck' : 'barrier';

        car.obstacles.push({
          id: this.obsCounter++,
          x: width + 30,
          y: baseY + obsLane * subLaneH + subLaneH * 0.5,
          type,
          passed: false
        });
      }

      // Move obstacles
      for (let i = car.obstacles.length - 1; i >= 0; i--) {
        const obs = car.obstacles[i];
        obs.x -= car.speed * dt;

        // Collision detection with player hovercar at x = 70
        if (!obs.passed && Math.abs(obs.x - 70) < 24) {
          if (Math.abs(obs.y - car.currentY) < subLaneH * 0.45) {
            obs.passed = true;
            if (obs.type === 'battery') {
              car.score += 40;
              this.audio.playTone(740, 0.1, 'sine');
              this.particles.emit(70, car.currentY, 8, '#00ffcc');
            } else {
              // Crash!
              car.stumbleTimer = 1.0;
              car.shield = Math.max(0, car.shield - 30);
              car.score = Math.max(0, car.score - 25);
              this.audio.playTone(130, 0.3, 'sawtooth');
              this.particles.emit(70, car.currentY, 15, '#ff0055');
            }
          }
        }

        if (obs.x < -40) {
          car.obstacles.splice(i, 1);
        }
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _w: number,
    height: number
  ): void {
    const car = this.cars.get(botId);
    if (!car || car.stumbleTimer > 0) return;

    let bTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botReactionTimers.set(botId, bTimer);
      return;
    }

    const active = this.getActivePlayers();
    const count = active.length;
    const playerBlockH = (height - 90) / Math.max(count, 1);
    const subLaneH = playerBlockH / 3;

    // Check if an obstacle is coming directly in our current lane
    const hazard = car.obstacles.find(o => {
      return (o.type === 'truck' || o.type === 'barrier') &&
        !o.passed &&
        o.x > 70 &&
        o.x < 220 &&
        Math.abs(o.y - car.targetY) < subLaneH * 0.4;
    });

    if (hazard) {
      const dodgeChance = difficulty === 'bot_hard' ? 0.95 : difficulty === 'bot_normal' ? 0.78 : 0.50;
      if (Math.random() < dodgeChance) {
        this.input.triggerBotPress(botId);
        this.botReactionTimers.set(botId, 0.35);
        return;
      }
    }

    this.botReactionTimers.set(botId, 0.08);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Cyber Highway Dark Asphalt & Grid Background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0a0d17');
    grad.addColorStop(0.5, '#121729');
    grad.addColorStop(1, '#090b14');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // HUD Instructions
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 170, 56, 340, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAP TO SWITCH LANES! DODGE TRUCKS, COLLECT BATTERIES!', width * 0.5, 69);
    ctx.restore();

    const active = this.getActivePlayers();
    const count = active.length;
    const playerBlockH = (height - 90) / Math.max(count, 1);
    const subLaneH = playerBlockH / 3;

    // Render Player Highway Sectors
    this.cars.forEach((car, pId) => {
      const cfg = this.players.find(p => p.id === car.id);
      const idx = active.findIndex(p => p.id === pId);
      const baseY = 70 + idx * playerBlockH;

      // Sub-lane markers
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(20, baseY + subLaneH);
      ctx.lineTo(width - 20, baseY + subLaneH);
      ctx.moveTo(20, baseY + subLaneH * 2);
      ctx.lineTo(width - 20, baseY + subLaneH * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Sector border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(20, baseY, width - 40, playerBlockH);

      // Render Obstacles
      car.obstacles.forEach(o => {
        if (o.passed) return;

        ctx.save();
        ctx.translate(o.x, o.y);

        if (o.type === 'battery') {
          // Glowing green battery orb
          ctx.fillStyle = '#00ffcc';
          ctx.shadowColor = '#00ffcc';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-2, -5, 4, 10);
        } else if (o.type === 'truck') {
          // Heavy cyber hauler truck
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.roundRect(-18, -10, 36, 20, 4);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(8, -8, 4, 16);
        } else {
          // Electric grid hazard
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-10, -10);
          ctx.lineTo(10, 10);
          ctx.moveTo(10, -10);
          ctx.lineTo(-10, 10);
          ctx.stroke();
        }

        ctx.restore();
      });

      // Render Hovercar
      ctx.save();
      ctx.translate(70, car.currentY);

      // Hover glow underneath
      ctx.fillStyle = 'rgba(0, 229, 255, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 8, 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Car body
      ctx.fillStyle = car.stumbleTimer > 0 ? '#555555' : (cfg?.color || '#3b82f6');
      ctx.beginPath();
      ctx.roundRect(-16, -7, 32, 14, 5);
      ctx.fill();

      // Neon headlight beam
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.moveTo(16, -4);
      ctx.lineTo(34, -10);
      ctx.lineTo(34, 10);
      ctx.lineTo(16, 4);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // Player Score
      ctx.fillStyle = cfg?.color || '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${cfg?.name || 'Player'}: ${car.score} pts (${Math.round(car.speed)} km/h)`, 26, baseY + 18);
    });
  }

  private finishRound(): void {
    this.isFinished = true;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.cars.forEach((c, pId) => scores.set(pId, c.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.cars.entries())
      .map(([playerId, c]) => ({ playerId, score: c.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} tore up the cyberway skyline!` : 'Hovercars crashed in gridlock!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
