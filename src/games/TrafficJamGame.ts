import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface TrafficVehicle {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  color: string;
}

interface CyberSpeedster {
  id: PlayerId;
  x: number;
  y: number;
  targetX: number;
  vx: number;
  speed: number;
  distance: number;
  score: number;
  closeCalls: number;
  stunTimer: number;
}

export class TrafficJamGame extends BaseGame {
  public playersState: Map<PlayerId, CyberSpeedster> = new Map();
  public currentMapName: string = 'Neo-Tokyo Expressway 9';

  private traffic: TrafficVehicle[] = [];
  private lanes: number[] = [];
  private spawnTimer: number = 0.3;
  private roadOffsetY: number = 0;
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
    this.traffic = [];
    this.botReactionTimers.clear();

    const laneCount = 5;
    const roadWidth = width * 0.7;
    const laneW = roadWidth / laneCount;
    const startX = (width - roadWidth) / 2 + laneW / 2;

    this.lanes = [];
    for (let i = 0; i < laneCount; i++) {
      this.lanes.push(startX + i * laneW);
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const lane = (idx + 1) % this.lanes.length;
      this.playersState.set(p.id, {
        id: p.id,
        x: this.lanes[lane],
        y: height * 0.78,
        targetX: this.lanes[lane],
        vx: 0,
        speed: 180,
        distance: 0,
        score: 0,
        closeCalls: 0,
        stunTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, _width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Scroll road texture
    this.roadOffsetY = (this.roadOffsetY + 220 * dt) % 40;

    // Spawn traffic
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.35 + Math.random() * 0.3;
      const lane = this.lanes[Math.floor(Math.random() * this.lanes.length)];
      const colors = ['#546E7A', '#78909C', '#455A64', '#37474F'];
      this.traffic.push({
        x: lane,
        y: -60,
        width: 32,
        height: 52,
        speed: 80 + Math.random() * 60,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    // Update traffic
    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const v = this.traffic[i];
      v.y += (220 - v.speed) * dt; // relative downwards flow
      if (v.y > height + 80) {
        this.traffic.splice(i, 1);
      }
    }

    this.updateBots(dt, _width, height);

    for (const p of this.getActivePlayers()) {
      const car = this.playersState.get(p.id);
      if (!car) continue;

      if (car.stunTimer > 0) {
        car.stunTimer -= dt;
        continue;
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      // Lane steering
      if (this.input.justLeft(p.id)) {
        const curIdx = this.findNearestLane(car.targetX);
        if (curIdx > 0) car.targetX = this.lanes[curIdx - 1];
      } else if (this.input.justRight(p.id)) {
        const curIdx = this.findNearestLane(car.targetX);
        if (curIdx < this.lanes.length - 1) car.targetX = this.lanes[curIdx + 1];
      } else if (Math.abs(steer) > 0.3) {
        car.x += steer * 240 * dt;
        car.targetX = car.x;
      }

      car.x += (car.targetX - car.x) * 12 * dt;

      // Turbo gas
      const maxSpeed = (throttle > 0.2 || isAction) ? 300 : 200;
      car.speed += ((throttle > 0.2 || isAction) ? 140 : -80) * dt;
      car.speed = Math.max(140, Math.min(maxSpeed, car.speed));

      car.distance += car.speed * dt;
      car.score += dt * 15;

      // Exhaust sparks
      if (car.speed > 250) {
        this.particles.emit(car.x, car.y + 24, 1, '#00E5FF');
      }

      // Traffic collision & close call check
      for (const v of this.traffic) {
        const dx = Math.abs(car.x - v.x);
        const dy = Math.abs(car.y - v.y);

        if (dx < 26 && dy < 44) {
          // Crash!
          car.stunTimer = 1.0;
          car.score = Math.max(0, car.score - 25);
          car.speed = 100;
          this.audio.playExplosion();
          this.particles.emit(car.x, car.y, 12, '#E53935');
        } else if (dx < 42 && dy < 48 && dx >= 26) {
          // Close call bonus
          car.closeCalls++;
          car.score += 5;
          this.audio.playTap();
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private findNearestLane(x: number): number {
    let nearest = 0;
    let minDist = 9999;
    this.lanes.forEach((lx, idx) => {
      const d = Math.abs(x - lx);
      if (d < minDist) {
        minDist = d;
        nearest = idx;
      }
    });
    return nearest;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const car = this.playersState.get(botId);
    if (!car || car.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    // Check vehicles in bot's lane
    const ahead = this.traffic.filter(
      v => Math.abs(v.x - car.x) < 30 && v.y < car.y && v.y > car.y - 180
    );

    let steer = 0;
    let turbo = true;

    if (ahead.length > 0) {
      turbo = false;
      const curLane = this.findNearestLane(car.x);
      // Evade to left or right lane with least obstacles
      if (curLane > 0 && Math.random() < 0.5) {
        car.targetX = this.lanes[curLane - 1];
        steer = -1;
      } else if (curLane < this.lanes.length - 1) {
        car.targetX = this.lanes[curLane + 1];
        steer = 1;
      } else if (curLane > 0) {
        car.targetX = this.lanes[curLane - 1];
        steer = -1;
      }
    }

    this.input.setBotInput(botId, turbo, steer, turbo ? 1 : 0, turbo);

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
        score: Math.floor(car?.score || 0),
        distance: Math.floor(car?.distance || 0)
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topDist = scores[0]?.distance || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} weaved through traffic with ${topDist}m distance!`
      : 'Expressway gridlock stopped all racers in a pileup!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // City Backdrop
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, width, height);

    // Highway Road Surface
    const roadWidth = width * 0.7;
    const roadX = (width - roadWidth) / 2;
    ctx.fillStyle = '#1e1e2f';
    ctx.fillRect(roadX, 0, roadWidth, height);

    // Neon Guardrails
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(roadX, 0);
    ctx.lineTo(roadX, height);
    ctx.moveTo(roadX + roadWidth, 0);
    ctx.lineTo(roadX + roadWidth, height);
    ctx.stroke();

    // Lane Dash Markings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 20]);
    for (let i = 1; i < this.lanes.length; i++) {
      const lx = (this.lanes[i - 1] + this.lanes[i]) / 2;
      ctx.beginPath();
      ctx.moveTo(lx, -40 + this.roadOffsetY);
      ctx.lineTo(lx, height + 40);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Header
    ctx.save();
    ctx.fillStyle = '#00E5FF';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TRAFFIC JAM FURY', width / 2, 38);

    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#E040FB';
    ctx.fillText('STEER LANES • HOLD TURBO • WEAVE PAST COMMUTER PODS', width / 2, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px monospace';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);
    ctx.restore();

    // Render Traffic
    for (const v of this.traffic) {
      ctx.fillStyle = v.color;
      ctx.beginPath();
      ctx.roundRect(v.x - v.width / 2, v.y - v.height / 2, v.width, v.height, 4);
      ctx.fill();

      // Taillights
      ctx.fillStyle = '#E53935';
      ctx.fillRect(v.x - 12, v.y + v.height / 2 - 4, 6, 3);
      ctx.fillRect(v.x + 6, v.y + v.height / 2 - 4, 6, 3);
    }

    // Render Players
    for (const p of this.getActivePlayers()) {
      const car = this.playersState.get(p.id);
      if (!car) continue;

      ctx.save();
      ctx.translate(car.x, car.y);

      if (car.stunTimer > 0 && Math.floor(car.stunTimer * 10) % 2 === 0) {
        ctx.globalAlpha = 0.4;
      }

      // Cyber Sports Car
      ctx.fillStyle = '#1A1A24';
      ctx.beginPath();
      ctx.roundRect(-16, -24, 32, 48, 5);
      ctx.fill();

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(-12, -18, 24, 36, 4);
      ctx.fill();

      // Windshield
      ctx.fillStyle = '#00E5FF';
      ctx.beginPath();
      ctx.roundRect(-8, -12, 16, 12, 2);
      ctx.fill();

      // Headlights
      ctx.fillStyle = '#FFFF00';
      ctx.fillRect(-12, -24, 6, 3);
      ctx.fillRect(6, -24, 6, 3);

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.floor(car.score)}`, 0, -30);

      ctx.restore();
    }
  }
}
