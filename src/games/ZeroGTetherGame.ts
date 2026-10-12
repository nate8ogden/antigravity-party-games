import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface AnchorNode {
  id: number;
  x: number;
  y: number;
  radius: number;
}

interface CargoCapsule {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  color: string;
}

interface TetherAstronaut {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tetherNodeId: number | null;
  tetherLength: number;
  score: number;
  heldCapsules: number;
  boostCooldown: number;
  tetherHoldTime: number;
}

export class ZeroGTetherGame extends BaseGame {
  private astronauts: Map<PlayerId, TetherAstronaut> = new Map();
  private nodes: AnchorNode[] = [];
  private capsules: CargoCapsule[] = [];
  private capsuleIdCounter: number = 0;
  private stationRotation: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.astronauts.clear();
    this.capsules = [];
    this.capsuleIdCounter = 0;
    this.stationRotation = 0;

    // Station anchor nodes
    this.nodes = [
      { id: 0, x: width * 0.5, y: height * 0.5, radius: 18 },
      { id: 1, x: width * 0.3, y: height * 0.3, radius: 14 },
      { id: 2, x: width * 0.7, y: height * 0.3, radius: 14 },
      { id: 3, x: width * 0.3, y: height * 0.7, radius: 14 },
      { id: 4, x: width * 0.7, y: height * 0.7, radius: 14 }
    ];

    for (let i = 0; i < 14; i++) {
      this.spawnCapsule(width, height);
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const node = this.nodes[(idx % 4) + 1];
      this.astronauts.set(p.id, {
        id: p.id,
        x: node.x + 45,
        y: node.y,
        vx: 0,
        vy: 120,
        tetherNodeId: node.id,
        tetherLength: 50,
        score: 0,
        heldCapsules: 0,
        boostCooldown: 0,
        tetherHoldTime: 0
      });
    });
  }

  private spawnCapsule(width: number, height: number): void {
    const isGold = Math.random() < 0.25;
    this.capsules.push({
      id: ++this.capsuleIdCounter,
      x: 60 + Math.random() * (width - 120),
      y: 60 + Math.random() * (height - 120),
      vx: (Math.random() - 0.5) * 40,
      vy: (Math.random() - 0.5) * 40,
      value: isGold ? 40 : 15,
      color: isGold ? '#FFD700' : '#00E5FF'
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    this.updateStagnationWatchdog(dt);
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    this.updateBots(dt, width, height);

    this.stationRotation += 0.4 * dt;

    while (this.capsules.length < 12) {
      this.spawnCapsule(width, height);
    }

    for (const c of this.capsules) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;

      if (c.x < 20) { c.x = 20; c.vx *= -1; }
      if (c.x > width - 20) { c.x = width - 20; c.vx *= -1; }
      if (c.y < 20) { c.y = 20; c.vy *= -1; }
      if (c.y > height - 20) { c.y = height - 20; c.vy *= -1; }
    }

    for (const [id, a] of this.astronauts.entries()) {
      if (a.boostCooldown > 0) a.boostCooldown -= dt;

      const throttle = this.input.getThrottle(id);
      const isReeling = this.input.isActionPressed(id) || this.input.isPressed(id) || throttle > 0.3;

      if (a.tetherNodeId !== null) {
        a.tetherHoldTime += dt;
        const node = this.nodes[a.tetherNodeId];
        const dx = a.x - node.x;
        const dy = a.y - node.y;
        const dist = Math.hypot(dx, dy);

        // Anti-Looping: If tethered to node for > 3.0s, cable overcharges into a slingshot breakout
        if (a.tetherHoldTime >= 3.0) {
          a.tetherNodeId = null;
          a.tetherHoldTime = 0;
          a.boostCooldown = 0.6;
          const currentSpd = Math.max(260, Math.hypot(a.vx, a.vy) * 1.5);
          const launchAngle = Math.atan2(a.vy, a.vx);
          a.vx = Math.cos(launchAngle) * currentSpd;
          a.vy = Math.sin(launchAngle) * currentSpd;
          this.audio.playBoost();
          this.particles.showFloatingText('🚀 SLINGSHOT BREAKOUT!', a.x, a.y - 20, '#00E5FF', 18);
          this.particles.spawnGoBlast(a.x, a.y);
        } else if (a.tetherHoldTime >= 2.0 && Math.random() < 0.4) {
          this.particles.spawnSparks(a.x, a.y, '#EF4444', 2);
        }

        if (isReeling) {
          a.tetherLength = Math.max(25, a.tetherLength - 70 * dt);
          this.particles.emit(a.x, a.y, 1, '#00E5FF');
        } else {
          a.tetherLength = Math.min(110, a.tetherLength + 30 * dt);
        }

        if (dist > a.tetherLength) {
          const spring = 380;
          const pull = (dist - a.tetherLength) * spring;
          const angle = Math.atan2(dy, dx);
          a.vx -= Math.cos(angle) * pull * dt;
          a.vy -= Math.sin(angle) * pull * dt;
        }

        if (throttle < -0.4) {
          a.tetherNodeId = null;
          a.tetherHoldTime = 0;
          this.audio.playTone(300, 0.08, 'sawtooth');
        }
      } else {
        a.tetherHoldTime = 0;
        if (this.input.isActionPressed(id) && a.boostCooldown <= 0) {
          let closestNode: AnchorNode | null = null;
          let minDist = 99999;
          for (const node of this.nodes) {
            const d = Math.hypot(node.x - a.x, node.y - a.y);
            if (d < minDist) {
              minDist = d;
              closestNode = node;
            }
          }

          if (closestNode && minDist < 140) {
            a.tetherNodeId = closestNode.id;
            a.tetherLength = minDist;
            a.boostCooldown = 0.5;
            this.audio.playTone(587, 0.1, 'triangle');
          }
        }
      }

      const moveX = this.input.getSteer(id);
      const moveY = -throttle;

      a.vx += moveX * 120 * dt;
      a.vy += moveY * 120 * dt;

      a.vx *= Math.pow(0.99, dt * 60);
      a.vy *= Math.pow(0.99, dt * 60);

      a.x += a.vx * dt;
      a.y += a.vy * dt;

      if (a.x < 20) { a.x = 20; a.vx *= -0.7; }
      if (a.x > width - 20) { a.x = width - 20; a.vx *= -0.7; }
      if (a.y < 20) { a.y = 20; a.vy *= -0.7; }
      if (a.y > height - 20) { a.y = height - 20; a.vy *= -0.7; }

      // Snatch capsules
      for (let i = this.capsules.length - 1; i >= 0; i--) {
        const c = this.capsules[i];
        if (Math.hypot(a.x - c.x, a.y - c.y) < 22) {
          a.score += c.value;
          a.heldCapsules++;
          this.audio.playTone(659, 0.08, 'sine');
          this.particles.emit(c.x, c.y, 10, c.color);
          this.capsules.splice(i, 1);
        }
      }
    }
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: string, _width: number, _height: number): void {
    const timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const a = this.astronauts.get(botId);
    if (!a) return;

    let wantReel = false;
    let wantRelease = false;

    let closestCapsule: CargoCapsule | null = null;
    let minDist = 99999;
    for (const c of this.capsules) {
      const d = Math.hypot(c.x - a.x, c.y - a.y);
      if (d < minDist) {
        minDist = d;
        closestCapsule = c;
      }
    }

    if (a.tetherNodeId !== null) {
      const speed = Math.hypot(a.vx, a.vy);
      if (speed < 160) {
        wantReel = true;
      }

      if (closestCapsule) {
        const velAngle = Math.atan2(a.vy, a.vx);
        const toCapAngle = Math.atan2(closestCapsule.y - a.y, closestCapsule.x - a.x);
        let diff = Math.abs(velAngle - toCapAngle);
        while (diff > Math.PI) diff -= Math.PI * 2;
        if (Math.abs(diff) < 0.35 && minDist < 240) {
          wantRelease = true;
        }
      }
    } else {
      wantReel = true;
    }

    let delay = 0.25;
    if (difficulty === 'bot_easy') {
      delay = 0.45;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
    }

    this.input.setBotInput(botId, wantReel, 0, wantRelease ? -1 : 1, wantReel);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#03050B';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#263238';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.5, width * 0.28, 0, Math.PI * 2);
    ctx.stroke();

    for (const node of this.nodes) {
      ctx.fillStyle = '#37474F';
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#00E5FF';
      ctx.beginPath();
      ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const c of this.capsules) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    for (const [id, a] of this.astronauts.entries()) {
      const color = this.getPlayer(id)?.color || '#EF4444';

      if (a.tetherNodeId !== null) {
        const node = this.nodes[a.tetherNodeId];
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(a.x, a.y);
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(a.x, a.y);

      ctx.fillStyle = '#ECEFF1';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.fillRect(-6, -3, 12, 6);

      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(3, -2, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${a.score}`, a.x, a.y - 15);
    }
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.astronauts.entries()).map(([playerId, a]) => ({
      playerId,
      score: a.score
    }));
    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `Player ${winnerId + 1} mastered the orbital spacewalk with ${scores[0].score} pts!` : 'Station orbit stable!'
    };
  }
}
