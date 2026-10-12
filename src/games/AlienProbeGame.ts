import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface DataNode {
  id: number;
  x: number;
  y: number;
  value: number;
  pulsePhase: number;
  radius: number;
}

interface DefenseLaser {
  centerX: number;
  centerY: number;
  angle: number;
  angularVelocity: number;
  length: number;
}

interface ProbeSaucer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  cloakEnergy: number;
  isCloaked: boolean;
  stunTimer: number;
}

export class AlienProbeGame extends BaseGame {
  private saucers: Map<PlayerId, ProbeSaucer> = new Map();
  private nodes: DataNode[] = [];
  private lasers: DefenseLaser[] = [];
  private nodeIdCounter: number = 0;
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
    this.saucers.clear();
    this.nodes = [];
    this.lasers = [];
    this.nodeIdCounter = 0;

    // Defense laser towers
    this.lasers = [
      { centerX: width * 0.5, centerY: height * 0.5, angle: 0, angularVelocity: 1.1, length: Math.hypot(width, height) * 0.6 },
      { centerX: width * 0.5, centerY: height * 0.5, angle: Math.PI, angularVelocity: 1.1, length: Math.hypot(width, height) * 0.6 },
      { centerX: width * 0.2, centerY: height * 0.25, angle: 0.5, angularVelocity: -1.4, length: 180 },
      { centerX: width * 0.8, centerY: height * 0.75, angle: 2.2, angularVelocity: -1.4, length: 180 }
    ];

    // Spawn initial data nodes
    for (let i = 0; i < 9; i++) {
      this.spawnDataNode(width, height);
    }

    const active = this.getActivePlayers();
    const spawnOffsets = [
      { x: width * 0.2, y: height * 0.8 },
      { x: width * 0.8, y: height * 0.2 },
      { x: width * 0.2, y: height * 0.2 },
      { x: width * 0.8, y: height * 0.8 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnOffsets[idx % spawnOffsets.length];
      this.saucers.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        score: 0,
        cloakEnergy: 100,
        isCloaked: false,
        stunTimer: 0
      });
    });
  }

  private spawnDataNode(width: number, height: number): void {
    const isRare = Math.random() < 0.25;
    this.nodes.push({
      id: ++this.nodeIdCounter,
      x: 60 + Math.random() * (width - 120),
      y: 60 + Math.random() * (height - 120),
      value: isRare ? 50 : 20,
      pulsePhase: Math.random() * Math.PI * 2,
      radius: isRare ? 14 : 10
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    this.updateBots(dt, width, height);

    // Update lasers
    for (const laser of this.lasers) {
      laser.angle += laser.angularVelocity * dt;
    }

    // Maintain data nodes
    while (this.nodes.length < 8) {
      this.spawnDataNode(width, height);
    }

    // Update saucers
    for (const [id, s] of this.saucers.entries()) {
      if (s.stunTimer > 0) {
        s.stunTimer -= dt;
        s.vx *= Math.pow(0.92, dt * 60);
        s.vy *= Math.pow(0.92, dt * 60);
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        continue;
      }

      const moveX = this.input.getSteer(id);
      const moveY = -this.input.getThrottle(id);
      const isAction = this.input.isActionPressed(id) || this.input.isPressed(id);

      // Cloak handling
      if (isAction && s.cloakEnergy > 10) {
        s.isCloaked = true;
        s.cloakEnergy = Math.max(0, s.cloakEnergy - 35 * dt);
      } else {
        s.isCloaked = false;
        s.cloakEnergy = Math.min(100, s.cloakEnergy + 20 * dt);
      }

      const accel = 420;
      s.vx += moveX * accel * dt;
      s.vy += moveY * accel * dt;

      // Friction
      s.vx *= Math.pow(0.90, dt * 60);
      s.vy *= Math.pow(0.90, dt * 60);

      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Boundaries
      s.x = Math.max(20, Math.min(width - 20, s.x));
      s.y = Math.max(20, Math.min(height - 20, s.y));

      // Thruster trail
      if (Math.hypot(s.vx, s.vy) > 20) {
        this.particles.emit(
          s.x,
          s.y,
          1,
          s.isCloaked ? '#B388FF' : '#00E5FF'
        );
      }

      // Check Laser Collision if not cloaked
      if (!s.isCloaked) {
        for (const laser of this.lasers) {
          if (this.checkPointToSegmentDist(s.x, s.y, laser.centerX, laser.centerY, laser.angle, laser.length) < 16) {
            s.stunTimer = 1.2;
            s.score = Math.max(0, s.score - 15);
            s.vx = -Math.cos(laser.angle) * 220;
            s.vy = -Math.sin(laser.angle) * 220;
            this.audio.playTone(150, 0.2, 'sawtooth');
            this.particles.emit(s.x, s.y, 15, '#FF1744');
            break;
          }
        }
      }

      // Check collecting Data Nodes
      for (let i = this.nodes.length - 1; i >= 0; i--) {
        const node = this.nodes[i];
        if (Math.hypot(s.x - node.x, s.y - node.y) < node.radius + 14) {
          s.score += node.value;
          this.audio.playTone(587, 0.08, 'triangle');
          setTimeout(() => this.audio.playTone(784, 0.1, 'triangle'), 50);

          this.particles.emit(node.x, node.y, 12, node.value >= 50 ? '#FFD700' : '#00E5FF');
          this.nodes.splice(i, 1);
        }
      }
    }
  }

  private checkPointToSegmentDist(px: number, py: number, x1: number, y1: number, angle: number, len: number): number {
    const x2 = x1 + Math.cos(angle) * len;
    const y2 = y1 + Math.sin(angle) * len;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);

    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: string, _width: number, _height: number): void {
    const timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const s = this.saucers.get(botId);
    if (!s || s.stunTimer > 0) return;

    let bestNode: DataNode | null = null;
    let bestScore = -99999;
    for (const node of this.nodes) {
      const d = Math.hypot(node.x - s.x, node.y - s.y);
      const score = (node.value / (d + 30));
      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }

    let moveX = 0;
    let moveY = 0;
    let wantCloak = false;

    if (bestNode) {
      const dx = bestNode.x - s.x;
      const dy = bestNode.y - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 5) {
        moveX = dx / dist;
        moveY = dy / dist;
      }
    }

    for (const laser of this.lasers) {
      const dist = this.checkPointToSegmentDist(s.x, s.y, laser.centerX, laser.centerY, laser.angle, laser.length);
      if (dist < 40) {
        if (s.cloakEnergy > 20) {
          wantCloak = true;
        } else {
          moveX = -moveX;
          moveY = -moveY;
        }
      }
    }

    let delay = 0.25;
    if (difficulty === 'bot_easy') {
      delay = 0.45;
      if (Math.random() < 0.25) wantCloak = false;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
    }

    this.input.setBotInput(botId, wantCloak, moveX, -moveY, wantCloak);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Mothership interior grid background
    ctx.fillStyle = '#060B12';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#0F2537';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Render Laser Beams
    for (const laser of this.lasers) {
      const endX = laser.centerX + Math.cos(laser.angle) * laser.length;
      const endY = laser.centerY + Math.sin(laser.angle) * laser.length;

      ctx.strokeStyle = 'rgba(255, 23, 68, 0.3)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(laser.centerX, laser.centerY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      ctx.strokeStyle = '#FF1744';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(laser.centerX, laser.centerY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      ctx.fillStyle = '#37474F';
      ctx.beginPath();
      ctx.arc(laser.centerX, laser.centerY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FF1744';
      ctx.beginPath();
      ctx.arc(laser.centerX, laser.centerY, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render Data Nodes
    for (const node of this.nodes) {
      ctx.save();
      ctx.translate(node.x, node.y);

      const color = node.value >= 50 ? '#FFD700' : '#00E5FF';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, node.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, node.radius + 4 + Math.sin(Date.now() * 0.006 + node.pulsePhase) * 2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    // Render Probe Saucers
    for (const [id, s] of this.saucers.entries()) {
      ctx.save();
      ctx.translate(s.x, s.y);

      if (s.isCloaked) {
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = '#B388FF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.stroke();
      }

      const color = this.getPlayer(id)?.color || '#EF4444';

      ctx.fillStyle = '#455A64';
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, -3, 6, Math.PI, 0);
      ctx.fill();

      ctx.fillStyle = '#E0F7FA';
      ctx.beginPath();
      ctx.arc(0, -4, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      if (s.stunTimer > 0) {
        ctx.fillStyle = '#FF1744';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('EMP SHOCK', s.x, s.y - 20);
      }

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(s.x - 14, s.y - 18, 28, 3.5);
      ctx.fillStyle = s.isCloaked ? '#B388FF' : '#00E5FF';
      ctx.fillRect(s.x - 14, s.y - 18, (s.cloakEnergy / 100) * 28, 3.5);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${s.score}`, s.x, s.y - 23);
    }
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.saucers.entries()).map(([playerId, s]) => ({
      playerId,
      score: s.score
    }));
    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `Player ${winnerId + 1} extracted alien intel with ${scores[0].score} pts!` : 'Probes retreated!'
    };
  }
}
