import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface TrailPoint {
  x: number;
  y: number;
  color: string;
}

interface DataNode {
  x: number;
  y: number;
  radius: number;
}

interface CyclePlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  stunTimer: number;
  trail: TrailPoint[];
}

export class CyberGridRunnerGame extends BaseGame {
  private playersState: Map<PlayerId, CyclePlayer> = new Map();
  private dataNodes: DataNode[] = [];
  private maxTrailLength: number = 70;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 30;
    this.playersState.clear();
    this.dataNodes = [];

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: idx % 2 === 0 ? 120 : height - 120,
        vx: 0,
        vy: idx % 2 === 0 ? 140 : -140,
        score: 0,
        stunTimer: 0,
        trail: []
      });
    });

    for (let i = 0; i < 6; i++) {
      this.spawnDataNode(width, height);
    }
  }

  private spawnDataNode(width: number, height: number): void {
    this.dataNodes.push({
      x: 50 + Math.random() * (width - 100),
      y: 70 + Math.random() * (height - 120),
      radius: 6
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        continue;
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);

      const speed = 150;
      // 90-degree cardinal turning
      if (Math.abs(steer) > 0.5 && Math.abs(ps.vy) > 0) {
        ps.vx = Math.sign(steer) * speed;
        ps.vy = 0;
      } else if (Math.abs(throttle) > 0.5 && Math.abs(ps.vx) > 0) {
        ps.vy = -Math.sign(throttle) * speed;
        ps.vx = 0;
      }

      // Default initial movement
      if (ps.vx === 0 && ps.vy === 0) {
        ps.vy = speed;
      }

      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Add to light trail
      ps.trail.push({ x: ps.x, y: ps.y, color: p.color });
      if (ps.trail.length > this.maxTrailLength) {
        ps.trail.shift();
      }

      // Check arena bounds collision
      if (ps.x < 20 || ps.x > width - 20 || ps.y < 55 || ps.y > height - 20) {
        this.crashPlayer(ps, width, height);
        continue;
      }

      // Check trail collision
      for (const [otherId, otherPlayer] of this.playersState) {
        const checkPoints = otherId === p.id ? otherPlayer.trail.slice(0, -10) : otherPlayer.trail;
        for (const pt of checkPoints) {
          if (Math.hypot(ps.x - pt.x, ps.y - pt.y) < 10) {
            this.crashPlayer(ps, width, height);
            break;
          }
        }
      }

      // Check Data node collection
      for (let i = this.dataNodes.length - 1; i >= 0; i--) {
        const node = this.dataNodes[i];
        if (Math.hypot(ps.x - node.x, ps.y - node.y) < 18) {
          ps.score += 3;
          this.audio.playScore();
          this.particles.emit(node.x, node.y, 12, '#38bdf8');
          this.dataNodes.splice(i, 1);
          this.spawnDataNode(width, height);
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private crashPlayer(ps: CyclePlayer, width: number, height: number): void {
    ps.stunTimer = 1.3;
    ps.trail = [];
    ps.score = Math.max(0, ps.score - 2);
    this.audio.playExplosion();
    this.particles.shake(0.35);
    this.particles.emit(ps.x, ps.y, 18, '#ef4444');

    // Respawn safe location
    ps.x = 60 + Math.random() * (width - 120);
    ps.y = 80 + Math.random() * (height - 160);
    ps.vx = 0;
    ps.vy = 140;
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.stunTimer > 0) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      return;
    }

    // Check if hitting boundary or trail in current direction
    const lookAhead = difficulty === 'bot_easy' ? 24 : difficulty === 'bot_normal' ? 38 : 52;
    const futureX = ps.x + Math.sign(ps.vx) * lookAhead;
    const futureY = ps.y + Math.sign(ps.vy) * lookAhead;

    let willCollide = futureX < 25 || futureX > width - 25 || futureY < 60 || futureY > height - 25;

    if (!willCollide) {
      for (const [, other] of this.playersState) {
        for (const pt of other.trail) {
          if (Math.hypot(futureX - pt.x, futureY - pt.y) < 14) {
            willCollide = true;
            break;
          }
        }
        if (willCollide) break;
      }
    }

    if (willCollide) {
      // Must turn!
      if (Math.abs(ps.vx) > 0) {
        // Going horizontally -> turn vertically
        let turnUp = ps.y > height / 2 ? -1 : 1;
        if (difficulty === 'bot_easy' && Math.random() < 0.3) turnUp = -turnUp;
        this.input.setBotInput(botId, false, 0, -turnUp);
      } else {
        // Going vertically -> turn horizontally
        let turnLeft = ps.x > width / 2 ? -1 : 1;
        if (difficulty === 'bot_easy' && Math.random() < 0.3) turnLeft = -turnLeft;
        this.input.setBotInput(botId, false, turnLeft, 0);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Pure Black Cyber Grid Arena
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, width, height);

    // Neon Cyan Grid Floor
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 45);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 45; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Outer Laser Wall Border
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(10, 45, width - 20, height - 55);

    // Render Data Nodes
    for (const node of this.dataNodes) {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Render Trails
    for (const [, p] of this.playersState) {
      for (const pt of p.trail) {
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - 3, pt.y - 3, 6, 6);
      }
    }

    // Render Lightcycles
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Lightcycle body
      ctx.fillStyle = p.color;
      ctx.fillRect(-6, -6, 12, 12);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-6, -6, 12, 12);

      // Cockpit glow
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-2, -2, 4, 4);

      if (ps.stunTimer > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('*DEREZZED*', 0, -16);
      }

      ctx.restore();

      // Score
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y + 20);
    }

    // Top HUD
    ctx.fillStyle = 'rgba(5, 5, 15, 0.9)';
    ctx.fillRect(0, 0, width, 36);
    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('CYBER GRID RUNNER', 16, 24);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.roundTimer < 6 ? '#ef4444' : '#f8fafc';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width - 16, 24);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} survived the cyber lightcycle grid trails!` : 'Grid cleared!'
    };
  }
}
