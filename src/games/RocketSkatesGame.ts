import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface VelodromeSkater {
  id: PlayerId;
  angle: number; // orbital angle around velodrome track
  distance: number;
  speed: number;
  boostGauge: number;
  isBoosting: boolean;
  laps: number;
  score: number;
  laneRadius: number; // inner vs outer lane
}

interface TrackHazard {
  id: number;
  angle: number;
  laneRadius: number;
  type: 'battery' | 'oil_slick' | 'speed_pad';
}

export class RocketSkatesGame extends BaseGame {
  public playersState: Map<PlayerId, VelodromeSkater> = new Map();
  public currentMapName: string = 'Neon Velodrome 3000';

  private centerX: number = 0;
  private centerY: number = 0;
  private baseRadius: number = 140;
  private totalLaps: number = 3;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private hazards: TrackHazard[] = [];
  private hazardSpawnTimer: number = 2.0;
  private hazardIdCounter: number = 0;

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
    this.hazards = [];
    this.hazardSpawnTimer = 1.5;

    this.centerX = width / 2;
    this.centerY = height * 0.54;

    // Spawn 4 initial random track items
    for (let i = 0; i < 4; i++) {
      this.spawnRandomHazard();
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const laneOffset = (idx - (active.length - 1) / 2) * 20;
      this.playersState.set(p.id, {
        id: p.id,
        angle: -Math.PI / 2,
        distance: 0,
        speed: 1.2,
        boostGauge: 100,
        isBoosting: false,
        laps: 0,
        score: 0,
        laneRadius: this.baseRadius + laneOffset
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  private spawnRandomHazard(): void {
    const types: ('battery' | 'oil_slick' | 'speed_pad')[] = ['battery', 'oil_slick', 'speed_pad'];
    const type = types[Math.floor(Math.random() * types.length)];
    this.hazards.push({
      id: ++this.hazardIdCounter,
      angle: Math.random() * Math.PI * 2,
      laneRadius: this.baseRadius + (Math.random() - 0.5) * 55,
      type
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    this.updateBots(dt, width, height);

    // Dynamic Random Track Hazard Spawning
    this.hazardSpawnTimer -= dt;
    if ((this.hazardSpawnTimer <= 0 || this.hazards.length < 2) && this.hazards.length < 6) {
      this.hazardSpawnTimer = 1.5 + Math.random() * 1.5;
      this.spawnRandomHazard();
    }

    for (const p of this.getActivePlayers()) {
      const s = this.playersState.get(p.id);
      if (!s) continue;

      const steer = this.input.getSteer(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      // Lane shifting
      s.laneRadius += steer * 60 * dt;
      s.laneRadius = Math.max(this.baseRadius - 35, Math.min(this.baseRadius + 35, s.laneRadius));

      // Nitro Thruster
      if (isAction && s.boostGauge > 0) {
        s.isBoosting = true;
        s.boostGauge = Math.max(0, s.boostGauge - dt * 35);
        s.speed = Math.min(3.4, s.speed + 2.4 * dt);

        // Rocket exhaust
        const px = this.centerX + Math.cos(s.angle) * s.laneRadius;
        const py = this.centerY + Math.sin(s.angle) * s.laneRadius;
        this.particles.emit(px, py, 1, '#FF7043');
      } else {
        s.isBoosting = false;
        s.boostGauge = Math.min(100, s.boostGauge + dt * 15);
        s.speed = Math.max(1.2, s.speed - 0.8 * dt);
      }

      // Check collision with dynamic track items
      for (let hi = this.hazards.length - 1; hi >= 0; hi--) {
        const h = this.hazards[hi];
        let diffAngle = Math.abs(s.angle - h.angle) % (Math.PI * 2);
        if (diffAngle > Math.PI) diffAngle = Math.PI * 2 - diffAngle;
        const laneDist = Math.abs(s.laneRadius - h.laneRadius);

        if (diffAngle < 0.14 && laneDist < 20) {
          const px = this.centerX + Math.cos(h.angle) * h.laneRadius;
          const py = this.centerY + Math.sin(h.angle) * h.laneRadius;
          if (h.type === 'battery') {
            s.boostGauge = 100;
            this.audio.playBoost();
            this.particles.showFloatingText('⚡ NITRO BATTERY!', px, py - 20, '#38BDF8', 16);
            this.particles.spawnSparks(px, py, '#38BDF8', 10);
          } else if (h.type === 'speed_pad') {
            s.speed = 3.6;
            this.audio.playScore();
            this.particles.showFloatingText('⏩ SUPER CHARGE!', px, py - 20, '#F59E0B', 16);
            this.particles.spawnSparks(px, py, '#FBBF24', 12);
          } else if (h.type === 'oil_slick') {
            s.speed = Math.max(0.6, s.speed * 0.4);
            this.audio.playBounce();
            this.particles.showFloatingText('🛢️ SLIP!', px, py - 20, '#EF4444', 16);
            this.particles.spawnSparks(px, py, '#EF4444', 8);
          }
          this.hazards.splice(hi, 1);
        }
      }

      // Orbital advancement
      const prevAngle = s.angle;
      s.angle += s.speed * dt;
      s.distance += s.speed * s.laneRadius * dt;
      s.score = Math.floor(s.distance * 0.1);

      // Lap counter check
      if (prevAngle < 3 * Math.PI / 2 && s.angle >= 3 * Math.PI / 2) {
        s.laps++;
        s.score += 100;
        this.audio.playScore();
        const px = this.centerX + Math.cos(s.angle) * s.laneRadius;
        const py = this.centerY + Math.sin(s.angle) * s.laneRadius;
        this.particles.spawnConfetti(px, py, 15);

        if (s.laps >= this.totalLaps) {
          this.isFinished = true;
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
    const s = this.playersState.get(botId);
    if (!s) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    // Bot boosts when gauge > 40%
    const boost = s.boostGauge > 40;

    // Steer towards optimal inner lane
    let steer = 0;
    if (s.laneRadius > this.baseRadius - 15) {
      steer = -0.5; // pull inward for shorter perimeter
    }

    this.input.setBotInput(botId, boost, steer, boost ? 1 : 0, boost);

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
      const s = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: s?.score || 0,
        laps: s?.laps || 0
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
      ? `Player ${winnerId + 1} rocketed around the Velodrome with ${topLaps} laps!`
      : 'Velodrome heats concluded with a photo finish draw!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, width, height);

    // Velodrome Track Surface (Circular Banked Oval)
    ctx.strokeStyle = '#1e1e30';
    ctx.lineWidth = 90;
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, this.baseRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner & Outer Neon Curb Rails
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, this.baseRadius - 45, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#FF4081';
    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, this.baseRadius + 45, 0, Math.PI * 2);
    ctx.stroke();

    // Finish Line
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(this.centerX, this.centerY - this.baseRadius - 45);
    ctx.lineTo(this.centerX, this.centerY - this.baseRadius + 45);
    ctx.stroke();

    // Render Dynamic Track Items (Batteries, Speed Pads, Oil Slicks)
    for (const h of this.hazards) {
      const hx = this.centerX + Math.cos(h.angle) * h.laneRadius;
      const hy = this.centerY + Math.sin(h.angle) * h.laneRadius;

      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(h.angle + Math.PI / 2);

      if (h.type === 'battery') {
        ctx.fillStyle = '#38BDF8';
        ctx.shadowColor = '#0284C7';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(-7, -7, 14, 14, 3);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡', 0, 3);
      } else if (h.type === 'speed_pad') {
        ctx.fillStyle = '#F59E0B';
        ctx.shadowColor = '#D97706';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(8, 6);
        ctx.lineTo(-8, 6);
        ctx.closePath();
        ctx.fill();
      } else if (h.type === 'oil_slick') {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.7)';
        ctx.shadowColor = '#7E22CE';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.ellipse(0, 0, 11, 7, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Header
    ctx.save();
    ctx.fillStyle = '#00E5FF';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ROCKET SKATES', width / 2, 38);

    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#FFD54F';
    ctx.fillText('HOLD TO FIRE NITRO THRUSTER • CUT TIGHT TURNS IN INNER LANE', width / 2, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px monospace';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);
    ctx.restore();

    // Render Skaters
    for (const p of this.getActivePlayers()) {
      const s = this.playersState.get(p.id);
      if (!s) continue;

      const px = this.centerX + Math.cos(s.angle) * s.laneRadius;
      const py = this.centerY + Math.sin(s.angle) * s.laneRadius;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(s.angle + Math.PI / 2);

      // Roller Skater Body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(-8, -12, 16, 24, 4);
      ctx.fill();

      // Skates
      ctx.fillStyle = '#212121';
      ctx.fillRect(-10, 8, 4, 8);
      ctx.fillRect(6, 8, 4, 8);

      // Rocket Backpack
      ctx.fillStyle = s.isBoosting ? '#FF5722' : '#90A4AE';
      ctx.fillRect(-6, -14, 12, 6);

      ctx.restore();

      // Lap count above skater
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`L${s.laps + 1}`, px, py - 18);
    }
  }
}
