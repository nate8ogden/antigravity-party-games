import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface PipeObstacle {
  distance: number; // distance along tunnel
  angle: number; // angle on perimeter
  radius: number;
  type: 'mine' | 'warp_ring';
  collected: boolean;
}

interface GravityPod {
  id: PlayerId;
  angle: number; // 0 to 2*PI around pipe perimeter
  distance: number;
  speed: number;
  nitroTimer: number;
  score: number;
  ringsCollected: number;
  stunTimer: number;
}

export class GravityPodsGame extends BaseGame {
  public playersState: Map<PlayerId, GravityPod> = new Map();
  public currentMapName: string = 'Sub-Orbital Magnetic Tube';

  private pipeRadius: number = 130;
  private obstacles: PipeObstacle[] = [];
  private spawnTimer: number = 0.5;
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
    this.obstacles = [];
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        angle: (idx / count) * Math.PI * 2,
        distance: 0,
        speed: 180,
        nitroTimer: 0,
        score: 0,
        ringsCollected: 0,
        stunTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, _width: number, _height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Spawn obstacles ahead in the pipeline
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.45 + Math.random() * 0.35;
      const isMine = Math.random() < 0.5;
      this.obstacles.push({
        distance: 600, // spawn far in distance
        angle: Math.random() * Math.PI * 2,
        radius: isMine ? 14 : 20,
        type: isMine ? 'mine' : 'warp_ring',
        collected: false
      });
    }

    // Move obstacles towards camera
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.distance -= 240 * dt;
      if (obs.distance < -40) {
        this.obstacles.splice(i, 1);
      }
    }

    this.updateBots(dt, _width, _height);

    for (const p of this.getActivePlayers()) {
      const pod = this.playersState.get(p.id);
      if (!pod) continue;

      if (pod.stunTimer > 0) {
        pod.stunTimer -= dt;
        continue;
      }

      if (pod.nitroTimer > 0) pod.nitroTimer -= dt;

      const steer = this.input.getSteer(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      // Rotate around pipe perimeter
      pod.angle += steer * 3.6 * dt;

      // Speed & distance
      const maxSpd = pod.nitroTimer > 0 ? 300 : 200;
      pod.speed = isAction ? Math.min(maxSpd, pod.speed + 160 * dt) : Math.max(160, pod.speed - 100 * dt);

      pod.distance += pod.speed * dt;
      pod.score += dt * 10;

      // Check collision with obstacles at distance ~ 0
      for (const obs of this.obstacles) {
        if (Math.abs(obs.distance) < 25) {
          let angleDiff = Math.abs(pod.angle - obs.angle);
          while (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - Math.PI * 2);

          if (angleDiff < 0.35) {
            if (obs.type === 'warp_ring' && !obs.collected) {
              obs.collected = true;
              pod.ringsCollected++;
              pod.score += 25;
              pod.nitroTimer = 2.0;
              this.audio.playScore();
              this.particles.spawnConfetti(_width / 2, _height * 0.54, 12);
            } else if (obs.type === 'mine') {
              pod.stunTimer = 1.0;
              pod.score = Math.max(0, pod.score - 20);
              this.audio.playExplosion();
              this.particles.emit(_width / 2, _height * 0.54, 10, '#E53935');
            }
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
    const pod = this.playersState.get(botId);
    if (!pod || pod.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    // Look for approaching obstacles
    const ahead = this.obstacles.filter(o => o.distance > 0 && o.distance < 200);

    let steer = 0;
    if (ahead.length > 0) {
      const target = ahead[0];
      let angleDiff = target.angle - pod.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      if (target.type === 'mine') {
        // Dodge away from mine
        if (Math.abs(angleDiff) < 0.8) {
          steer = angleDiff > 0 ? -1 : 1;
        }
      } else {
        // Seek warp ring
        if (Math.abs(angleDiff) > 0.15) {
          steer = angleDiff > 0 ? 1 : -1;
        }
      }
    }

    this.input.setBotInput(botId, true, steer, 1, true);

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
      const pod = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: Math.floor(pod?.score || 0),
        rings: pod?.ringsCollected || 0
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
      ? `Player ${winnerId + 1} navigated the Magnetic Tube with ${topScore} pts!`
      : 'The magnetic pipeline destabilized with no sole survivor!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#06060e';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height * 0.54;

    // Concentric Perspective Pipeline Rings
    for (let r = 20; r <= this.pipeRadius; r += 28) {
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Outer Pipeline Rim
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, this.pipeRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Header
    ctx.save();
    ctx.fillStyle = '#00E5FF';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GRAVITY PODS', width / 2, 38);

    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#FFD54F';
    ctx.fillText('ROTATE AROUND MAGNETIC TUBE • DODGE MINES & SNATCH WARP RINGS', width / 2, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px monospace';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);
    ctx.restore();

    // Render Obstacles in Perspective
    for (const obs of this.obstacles) {
      if (obs.collected) continue;
      // Perspective scale: distance from 600 down to 0
      const scale = Math.max(0.1, 1 - obs.distance / 600);
      const ringRadius = this.pipeRadius * scale;
      const ox = cx + Math.cos(obs.angle) * ringRadius;
      const oy = cy + Math.sin(obs.angle) * ringRadius;

      if (obs.type === 'mine') {
        ctx.fillStyle = '#E53935';
        ctx.beginPath();
        ctx.arc(ox, oy, obs.radius * scale, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(ox, oy, obs.radius * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Render Player Pods (positioned on outer rim)
    for (const p of this.getActivePlayers()) {
      const pod = this.playersState.get(p.id);
      if (!pod) continue;

      const px = cx + Math.cos(pod.angle) * this.pipeRadius;
      const py = cy + Math.sin(pod.angle) * this.pipeRadius;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(pod.angle + Math.PI / 2);

      // Anti-Grav Pod Cockpit
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(-8, -12, 16, 24, 4);
      ctx.fill();

      // Repulsor Engine Glow
      ctx.fillStyle = '#00E5FF';
      ctx.beginPath();
      ctx.arc(0, 12, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.floor(pod.score)}`, px, py - 16);
    }
  }
}
