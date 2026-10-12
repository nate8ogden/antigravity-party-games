import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface MonorailCar {
  x: number;
  width: number;
  height: number;
}

interface OverheadGantry {
  x: number;
  width: number;
  height: number;
}

interface CryptoBounty {
  x: number;
  y: number;
  collected: boolean;
}

interface MonorailRunner {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  altitude: number;
  vAltitude: number;
  isJumping: boolean;
  isDucking: boolean;
  duckTimer: number;
  score: number;
  bounties: number;
  stunTimer: number;
}

export class MonorailHijackGame extends BaseGame {
  public playersState: Map<PlayerId, MonorailRunner> = new Map();
  public currentMapName: string = 'Neo-Kyoto High-Speed Maglev';

  private trainCars: MonorailCar[] = [];
  private gantries: OverheadGantry[] = [];
  private bounties: CryptoBounty[] = [];
  private trainY: number = 0;
  private gantryTimer: number = 2.0;
  private bountyTimer: number = 1.0;
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
    this.gantries = [];
    this.bounties = [];
    this.botReactionTimers.clear();

    this.trainY = height * 0.72;

    // 4 interconnected monorail cars
    const carW = 160;
    const gap = 30;
    const startX = width * 0.08;
    this.trainCars = [
      { x: startX, width: carW, height: 70 },
      { x: startX + carW + gap, width: carW, height: 70 },
      { x: startX + (carW + gap) * 2, width: carW, height: 70 },
      { x: startX + (carW + gap) * 3, width: carW, height: 70 }
    ];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const car = this.trainCars[idx % this.trainCars.length];
      this.playersState.set(p.id, {
        id: p.id,
        x: car.x + car.width * 0.5,
        y: this.trainY,
        vx: 0,
        altitude: 0,
        vAltitude: 0,
        isJumping: false,
        isDucking: false,
        duckTimer: 0,
        score: 0,
        bounties: 0,
        stunTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, width: number, _height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Spawn overhead tunnel gantries (hazard)
    this.gantryTimer -= dt;
    if (this.gantryTimer <= 0) {
      this.gantryTimer = 2.2 + Math.random() * 1.5;
      this.gantries.push({
        x: width + 40,
        width: 45,
        height: 60 // hangs down from tunnel ceiling
      });
    }

    // Spawn bounties
    this.bountyTimer -= dt;
    if (this.bountyTimer <= 0) {
      this.bountyTimer = 1.2 + Math.random() * 0.8;
      const targetCar = this.trainCars[Math.floor(Math.random() * this.trainCars.length)];
      this.bounties.push({
        x: targetCar.x + 20 + Math.random() * (targetCar.width - 40),
        y: this.trainY - 25,
        collected: false
      });
    }

    // Move gantries left
    for (let i = this.gantries.length - 1; i >= 0; i--) {
      this.gantries[i].x -= 340 * dt;
      if (this.gantries[i].x < -60) {
        this.gantries.splice(i, 1);
      }
    }

    this.updateBots(dt, width, _height);

    for (const p of this.getActivePlayers()) {
      const runner = this.playersState.get(p.id);
      if (!runner) continue;

      if (runner.stunTimer > 0) {
        runner.stunTimer -= dt;
        continue;
      }

      if (runner.duckTimer > 0) {
        runner.duckTimer -= dt;
        if (runner.duckTimer <= 0) runner.isDucking = false;
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      // Horizontal run
      runner.vx = steer * 200;
      runner.x += runner.vx * dt;

      // Jump / Duck
      if (throttle > 0.5 || (justAction && !runner.isJumping)) {
        runner.isJumping = true;
        runner.vAltitude = 260;
        this.audio.playTap();
      } else if (throttle < -0.5) {
        runner.isDucking = true;
        runner.duckTimer = 0.6;
      }

      // Jump physics
      if (runner.isJumping) {
        runner.altitude += runner.vAltitude * dt;
        runner.vAltitude -= 750 * dt;
        if (runner.altitude <= 0) {
          runner.altitude = 0;
          runner.vAltitude = 0;
          runner.isJumping = false;
        }
      }

      // Check on roof vs fell between cars
      let onCar = false;
      for (const car of this.trainCars) {
        if (runner.x >= car.x && runner.x <= car.x + car.width) {
          onCar = true;
          break;
        }
      }

      // If fallen into gap between cars
      if (!onCar && runner.altitude <= 0) {
        runner.stunTimer = 1.0;
        runner.score = Math.max(0, runner.score - 15);
        this.audio.playExplosion();
        this.particles.emit(runner.x, this.trainY + 20, 8, '#E53935');
        // Respawn on nearest car
        runner.x = this.trainCars[0].x + 40;
      }

      // Collect bounties
      for (const b of this.bounties) {
        if (!b.collected && Math.hypot(runner.x - b.x, (runner.y - runner.altitude) - b.y) < 22) {
          b.collected = true;
          runner.bounties++;
          runner.score += 25;
          this.audio.playScore();
          this.particles.spawnSparks(b.x, b.y, '#FFD700', 8);
        }
      }

      // Check overhead gantry collision
      const headY = runner.y - runner.altitude - (runner.isDucking ? 10 : 25);
      for (const g of this.gantries) {
        const inX = Math.abs(runner.x - g.x) < g.width / 2 + 10;
        const gantryBottomY = 160 + g.height;
        if (inX && headY < gantryBottomY) {
          // Whacked by gantry!
          runner.stunTimer = 1.0;
          runner.score = Math.max(0, runner.score - 20);
          this.audio.playExplosion();
          this.particles.emit(runner.x, headY, 10, '#E53935');
          break;
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
    const runner = this.playersState.get(botId);
    if (!runner || runner.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    // Bot targets closest bounty
    let targetX = runner.x;
    const uncollected = this.bounties.filter(b => !b.collected);
    if (uncollected.length > 0) {
      targetX = uncollected[0].x;
    }

    let steer = 0;
    if (Math.abs(targetX - runner.x) > 15) {
      steer = targetX > runner.x ? 1 : -1;
    }

    // Check if gantry approaching
    let duck = false;
    for (const g of this.gantries) {
      if (Math.abs(g.x - runner.x) < 70) {
        duck = true;
        break;
      }
    }

    this.input.setBotInput(botId, false, steer, duck ? -1 : 0, false);

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
      const runner = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: Math.floor(runner?.score || 0),
        bounties: runner?.bounties || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topScore = scores[0]?.score || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} hijacked the Maglev with ${topScore} pts in crypto bounty!`
      : 'The monorail sped into the darkness with no clear victor!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Tunnel walls & neon lights
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, width, height);

    // Header
    ctx.save();
    ctx.fillStyle = '#00E5FF';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MONORAIL HIJACK', width / 2, 38);

    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#FF4081';
    ctx.fillText('LEAP BETWEEN TRAIN CARS • DUCK UNDER OVERHEAD GANTRIES', width / 2, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px monospace';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);
    ctx.restore();

    // Render Monorail Cars
    for (const car of this.trainCars) {
      ctx.fillStyle = '#263238';
      ctx.beginPath();
      ctx.roundRect(car.x, this.trainY, car.width, car.height, 8);
      ctx.fill();

      // Neon window stripe
      ctx.fillStyle = '#00E5FF';
      ctx.fillRect(car.x + 10, this.trainY + 20, car.width - 20, 12);
    }

    // Render Gantries
    for (const g of this.gantries) {
      ctx.fillStyle = '#E53935';
      ctx.fillRect(g.x - g.width / 2, 120, g.width, g.height + 40);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(g.x - g.width / 2, 120, g.width, g.height + 40);
    }

    // Render Bounties
    for (const b of this.bounties) {
      if (b.collected) continue;
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(b.x - 8, b.y - 6, 16, 12);
      ctx.fillStyle = '#212121';
      ctx.fillRect(b.x - 3, b.y - 8, 6, 3); // handle
    }

    // Render Runners
    for (const p of this.getActivePlayers()) {
      const runner = this.playersState.get(p.id);
      if (!runner) continue;

      ctx.save();
      const ry = runner.y - runner.altitude;
      ctx.translate(runner.x, ry);

      if (runner.stunTimer > 0 && Math.floor(runner.stunTimer * 10) % 2 === 0) {
        ctx.globalAlpha = 0.4;
      }

      const bodyH = runner.isDucking ? 14 : 26;

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(-8, -bodyH, 16, bodyH, 4);
      ctx.fill();

      // Visor
      ctx.fillStyle = '#00E5FF';
      ctx.fillRect(-6, -bodyH + 4, 12, 5);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${runner.score}`, 0, -bodyH - 8);

      ctx.restore();
    }
  }
}
