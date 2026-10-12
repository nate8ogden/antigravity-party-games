import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface PendulumBlade {
  id: number;
  pivotX: number;
  pivotY: number;
  length: number;
  angle: number;
  speed: number;
  bladeRadius: number;
}

interface SpikeTrap {
  x: number;
  y: number;
  size: number;
  state: 'inactive' | 'warning' | 'active';
  timer: number;
}

interface DungeonCoin {
  id: number;
  x: number;
  y: number;
  collected: boolean;
}

interface DungeonRunner {
  id: PlayerId;
  x: number;
  y: number;
  startX: number;
  startY: number;
  angle: number;
  speed: number;
  radius: number;
  score: number;
  coinsCount: number;
  lives: number;
  hasEscaped: boolean;
  invulnTimer: number;
  botReactionTimer: number;
}

export class DungeonEscapeGame extends BaseGame {
  public playersState: Map<PlayerId, DungeonRunner> = new Map();
  public currentMapName: string = 'Catacombs of the Dread Citadel';

  private pendulums: PendulumBlade[] = [];
  private traps: SpikeTrap[] = [];
  private coins: DungeonCoin[] = [];
  private exitX: number = 0;
  private exitY: number = 0;
  private exitWidth: number = 80;
  private exitHeight: number = 30;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 40.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 40.0;
    this.isFinished = false;
    this.playersState.clear();
    this.pendulums = [];
    this.traps = [];
    this.coins = [];

    this.exitX = width / 2;
    this.exitY = 85;

    this.pendulums = [
      { id: 1, pivotX: width * 0.28, pivotY: height * 0.38, length: 70, angle: 0, speed: 2.4, bladeRadius: 18 },
      { id: 2, pivotX: width * 0.50, pivotY: height * 0.44, length: 75, angle: Math.PI * 0.5, speed: 2.8, bladeRadius: 20 },
      { id: 3, pivotX: width * 0.72, pivotY: height * 0.38, length: 70, angle: Math.PI, speed: 2.4, bladeRadius: 18 }
    ];

    const trapPositions = [
      { x: width * 0.22, y: height * 0.60 },
      { x: width * 0.40, y: height * 0.62 },
      { x: width * 0.60, y: height * 0.62 },
      { x: width * 0.78, y: height * 0.60 },
      { x: width * 0.35, y: height * 0.30 },
      { x: width * 0.65, y: height * 0.30 }
    ];

    this.traps = trapPositions.map(pos => ({
      x: pos.x,
      y: pos.y,
      size: 38,
      state: 'inactive',
      timer: Math.random() * 2.0
    }));

    let coinId = 0;
    const coinSpots = [
      { x: width * 0.18, y: height * 0.48 },
      { x: width * 0.35, y: height * 0.50 },
      { x: width * 0.50, y: height * 0.52 },
      { x: width * 0.65, y: height * 0.50 },
      { x: width * 0.82, y: height * 0.48 },
      { x: width * 0.25, y: height * 0.25 },
      { x: width * 0.50, y: height * 0.20 },
      { x: width * 0.75, y: height * 0.25 }
    ];

    this.coins = coinSpots.map(c => ({
      id: ++coinId,
      x: c.x,
      y: c.y,
      collected: false
    }));

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const sx = spacing * (idx + 1);
      const sy = height * 0.86;
      this.playersState.set(p.id, {
        id: p.id,
        x: sx,
        y: sy,
        startX: sx,
        startY: sy,
        angle: -Math.PI / 2,
        speed: 130,
        radius: 14,
        score: 0,
        coinsCount: 0,
        lives: 3,
        hasEscaped: false,
        invulnTimer: 0,
        botReactionTimer: 0.2
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    for (const pen of this.pendulums) {
      pen.angle += pen.speed * dt;
    }

    for (const trap of this.traps) {
      trap.timer -= dt;
      if (trap.timer <= 0) {
        if (trap.state === 'inactive') {
          trap.state = 'warning';
          trap.timer = 0.8;
        } else if (trap.state === 'warning') {
          trap.state = 'active';
          trap.timer = 1.2;
        } else {
          trap.state = 'inactive';
          trap.timer = 1.5 + Math.random() * 1.5;
        }
      }
    }

    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps || ps.hasEscaped) continue;

      if (ps.invulnTimer > 0) {
        ps.invulnTimer -= dt;
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      if (Math.hypot(steer, throttle) > 0.3) {
        ps.angle = Math.atan2(-throttle, steer);
        ps.x += Math.cos(ps.angle) * ps.speed * dt;
        ps.y += Math.sin(ps.angle) * ps.speed * dt;
      } else {
        if (justAction) {
          ps.angle += Math.PI / 2;
        }
        ps.x += Math.cos(ps.angle) * (ps.speed * 0.75) * dt;
        ps.y += Math.sin(ps.angle) * (ps.speed * 0.75) * dt;
      }

      const pad = 24;
      ps.x = Math.max(pad, Math.min(width - pad, ps.x));
      ps.y = Math.max(80, Math.min(height - pad, ps.y));

      // Coin pickup
      for (const coin of this.coins) {
        if (!coin.collected && Math.hypot(ps.x - coin.x, ps.y - coin.y) < ps.radius + 10) {
          coin.collected = true;
          ps.coinsCount++;
          ps.score += 10;
          this.audio.playScore();
          this.particles.spawnSparks(coin.x, coin.y, '#FFD700', 6);
        }
      }

      // Exit reach check
      const dxExit = Math.abs(ps.x - this.exitX);
      const dyExit = Math.abs(ps.y - this.exitY);
      if (dxExit < this.exitWidth / 2 && dyExit < this.exitHeight / 2) {
        ps.hasEscaped = true;
        ps.score += 50;
        this.audio.playFanfare();
        this.particles.spawnConfetti(ps.x, ps.y, 25);
        this.isFinished = true;
        return;
      }

      // Check hazards if not invulnerable
      if (ps.invulnTimer <= 0) {
        let hit = false;

        for (const pen of this.pendulums) {
          const bladeX = pen.pivotX + Math.sin(pen.angle) * pen.length;
          const bladeY = pen.pivotY + Math.cos(pen.angle) * pen.length;
          const dist = Math.hypot(ps.x - bladeX, ps.y - bladeY);
          if (dist < ps.radius + pen.bladeRadius) {
            hit = true;
            break;
          }
        }

        if (!hit) {
          for (const trap of this.traps) {
            if (trap.state === 'active') {
              const inTrapX = Math.abs(ps.x - trap.x) < trap.size / 2 + ps.radius * 0.5;
              const inTrapY = Math.abs(ps.y - trap.y) < trap.size / 2 + ps.radius * 0.5;
              if (inTrapX && inTrapY) {
                hit = true;
                break;
              }
            }
          }
        }

        if (hit) {
          this.handlePlayerHit(ps);
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private handlePlayerHit(ps: DungeonRunner): void {
    ps.lives--;
    ps.score = Math.max(0, ps.score - 10);
    ps.invulnTimer = 1.5;
    this.audio.playExplosion();
    this.particles.emit(ps.x, ps.y, 10, '#E53935');

    ps.x = ps.startX;
    ps.y = ps.startY;
    ps.angle = -Math.PI / 2;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.hasEscaped) return;

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    let targetX = this.exitX;
    let targetY = this.exitY;

    const uncollected = this.coins.filter(c => !c.collected);
    if (uncollected.length > 0 && Math.random() < 0.6) {
      let nearestCoin = uncollected[0];
      let minDist = Math.hypot(ps.x - nearestCoin.x, ps.y - nearestCoin.y);
      for (const c of uncollected) {
        const d = Math.hypot(ps.x - c.x, ps.y - c.y);
        if (d < minDist) {
          minDist = d;
          nearestCoin = c;
        }
      }
      if (minDist < 120) {
        targetX = nearestCoin.x;
        targetY = nearestCoin.y;
      }
    }

    let avoidHazard = false;
    let avoidDir = 0;

    for (const pen of this.pendulums) {
      const bladeX = pen.pivotX + Math.sin(pen.angle) * pen.length;
      const bladeY = pen.pivotY + Math.cos(pen.angle) * pen.length;
      const dist = Math.hypot(ps.x - bladeX, ps.y - bladeY);
      if (dist < 45) {
        avoidHazard = true;
        avoidDir = ps.x > bladeX ? 1 : -1;
        break;
      }
    }

    if (!avoidHazard) {
      for (const trap of this.traps) {
        if (trap.state === 'active' || trap.state === 'warning') {
          const dist = Math.hypot(ps.x - trap.x, ps.y - trap.y);
          if (dist < 40) {
            avoidHazard = true;
            avoidDir = ps.x > trap.x ? 1 : -1;
            break;
          }
        }
      }
    }

    let steer = 0;
    let throttle = 0;

    if (avoidHazard) {
      steer = avoidDir;
      throttle = 0;
    } else {
      const ang = Math.atan2(targetY - ps.y, targetX - ps.x);
      steer = Math.cos(ang);
      throttle = Math.sin(ang);
    }

    this.input.setBotInput(botId, false, steer, -throttle, false);

    let delay = 0.25;
    if (difficulty === 'bot_easy') delay = 0.45;
    else if (difficulty === 'bot_hard') delay = 0.10;

    ps.botReactionTimer = delay;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const ps = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: ps?.score || 0,
        escaped: ps?.hasEscaped || false
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
      ? `Player ${winnerId + 1} navigated the Citadel to victory (${topScore} pts)!`
      : 'The dungeon claimed all challengers!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#151520');
    bgGrad.addColorStop(1, '#242436');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#2d2d44';
    ctx.lineWidth = 1.5;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 80);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 80; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#FFD54F';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DUNGEON MAZE RUNNER', width / 2, 38);

    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#B0BEC5';
    ctx.fillText('STEER/TAP TO TURN • DODGE PENDULUM BLADES & REACH THE PORTCULLIS', width / 2, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px monospace';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);

    // Golden Portcullis Exit
    ctx.save();
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(this.exitX - this.exitWidth / 2, this.exitY - 10, this.exitWidth, 20);
    ctx.fillStyle = '#212121';
    for (let x = this.exitX - this.exitWidth / 2 + 8; x < this.exitX + this.exitWidth / 2; x += 12) {
      ctx.fillRect(x, this.exitY - 8, 4, 16);
    }
    ctx.fillStyle = '#FFD700';
    ctx.font = '900 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★ ESCAPE ★', this.exitX, this.exitY - 14);
    ctx.restore();

    for (const trap of this.traps) {
      this.renderTrap(ctx, trap);
    }

    for (const coin of this.coins) {
      if (coin.collected) continue;
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFA000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    for (const pen of this.pendulums) {
      this.renderPendulum(ctx, pen);
    }

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderRunner(ctx, ps, p);
    }
  }

  private renderTrap(ctx: CanvasRenderingContext2D, trap: SpikeTrap): void {
    ctx.save();
    ctx.fillStyle = '#1c1c28';
    ctx.fillRect(trap.x - trap.size / 2, trap.y - trap.size / 2, trap.size, trap.size);
    ctx.strokeStyle = '#37474F';
    ctx.lineWidth = 2;
    ctx.strokeRect(trap.x - trap.size / 2, trap.y - trap.size / 2, trap.size, trap.size);

    if (trap.state === 'warning') {
      ctx.fillStyle = 'rgba(229, 57, 53, 0.4)';
      ctx.fillRect(trap.x - trap.size / 2 + 2, trap.y - trap.size / 2 + 2, trap.size - 4, trap.size - 4);
      ctx.fillStyle = '#E53935';
      ctx.font = '900 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', trap.x, trap.y + 4);
    } else if (trap.state === 'active') {
      ctx.fillStyle = '#ECEFF1';
      const spikeCount = 3;
      const step = trap.size / (spikeCount + 1);
      for (let ix = 1; ix <= spikeCount; ix++) {
        for (let iy = 1; iy <= spikeCount; iy++) {
          const sx = trap.x - trap.size / 2 + ix * step;
          const sy = trap.y - trap.size / 2 + iy * step;
          ctx.beginPath();
          ctx.moveTo(sx - 3, sy + 3);
          ctx.lineTo(sx + 3, sy + 3);
          ctx.lineTo(sx, sy - 5);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  private renderPendulum(ctx: CanvasRenderingContext2D, pen: PendulumBlade): void {
    ctx.save();
    const bladeX = pen.pivotX + Math.sin(pen.angle) * pen.length;
    const bladeY = pen.pivotY + Math.cos(pen.angle) * pen.length;

    ctx.fillStyle = '#78909C';
    ctx.beginPath();
    ctx.arc(pen.pivotX, pen.pivotY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#B0BEC5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pen.pivotX, pen.pivotY);
    ctx.lineTo(bladeX, bladeY);
    ctx.stroke();

    ctx.fillStyle = '#CFD8DC';
    ctx.beginPath();
    ctx.arc(bladeX, bladeY, pen.bladeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#37474F';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(bladeX - 3, bladeY - 3, pen.bladeRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderRunner(ctx: CanvasRenderingContext2D, ps: DungeonRunner, p: PlayerConfig): void {
    ctx.save();
    ctx.translate(ps.x, ps.y);

    if (ps.invulnTimer > 0 && Math.floor(ps.invulnTimer * 10) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, 0, ps.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(Math.cos(ps.angle) * (ps.radius - 4), Math.sin(ps.angle) * (ps.radius - 4), 3.5, 0, Math.PI * 2);
    ctx.fill();

    if (ps.hasEscaped) {
      ctx.fillStyle = '#FFD700';
      ctx.font = '900 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('👑 ESCAPED!', 0, -ps.radius - 6);
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(-24, ps.radius + 4, 48, 14, 3);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${ps.score} pts`, 0, ps.radius + 15);

    ctx.restore();
  }
}
