import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface NodePoint {
  x: number;
  y: number;
  connections: number[];
}

interface GoldenLoot {
  id: number;
  nodeIndex: number;
  type: 'thread' | 'cog';
  collected: boolean;
}

interface LabyrinthRunner {
  id: PlayerId;
  currentNode: number;
  targetNode: number;
  progress: number;
  score: number;
  combo: number;
  stunTimer: number;
}

interface MinotaurState {
  currentNode: number;
  targetNode: number;
  progress: number;
  speed: number;
  chargeTimer: number;
}

export class MinotaurLabyrinthGame extends BaseGame {
  public runners: Map<PlayerId, LabyrinthRunner> = new Map();
  public minotaur: MinotaurState = {
    currentNode: 0,
    targetNode: 1,
    progress: 0,
    speed: 0.9,
    chargeTimer: 0,
  };
  public nodes: NodePoint[] = [];
  public loots: GoldenLoot[] = [];
  public currentMapName: string = 'The Labyrinth of Knossos';

  private lootIdCounter: number = 0;
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
    this.runners.clear();
    this.nodes = [];
    this.loots = [];
    this.botReactionTimers.clear();

    const cx = width / 2;
    const cy = height / 2 + 10;
    const rInner = 80;
    const rMid = 150;
    const rOuter = 210;

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      this.nodes.push({
        x: cx + Math.cos(angle) * rInner,
        y: cy + Math.sin(angle) * rInner,
        connections: [(i + 1) % 6, (i + 5) % 6, i + 6],
      });
    }
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      this.nodes.push({
        x: cx + Math.cos(angle) * rMid,
        y: cy + Math.sin(angle) * rMid,
        connections: [6 + ((i + 1) % 6), 6 + ((i + 5) % 6), i, 12 + i],
      });
    }
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      this.nodes.push({
        x: cx + Math.cos(angle) * rOuter,
        y: cy + Math.sin(angle) * rOuter,
        connections: [12 + ((i + 1) % 6), 12 + ((i + 5) % 6), 6 + i],
      });
    }

    this.minotaur = {
      currentNode: 0,
      targetNode: 1,
      progress: 0,
      speed: 0.85,
      chargeTimer: 0,
    };

    for (let i = 2; i < this.nodes.length; i += 2) {
      this.loots.push({
        id: ++this.lootIdCounter,
        nodeIndex: i,
        type: i % 4 === 0 ? 'thread' : 'cog',
        collected: false,
      });
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const startNode = 12 + (idx * 2) % 6;
      const nextNode = this.nodes[startNode].connections[0];
      this.runners.set(p.id, {
        id: p.id,
        currentNode: startNode,
        targetNode: nextNode,
        progress: 0,
        score: 0,
        combo: 0,
        stunTimer: 0,
      });
      this.botReactionTimers.set(p.id, 0);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      return;
    }

    this.updateBots(dt, width, height);

    // Update Minotaur
    this.minotaur.progress += this.minotaur.speed * dt;
    if (this.minotaur.progress >= 1) {
      this.minotaur.progress = 0;
      this.minotaur.currentNode = this.minotaur.targetNode;
      const curr = this.nodes[this.minotaur.currentNode];
      let bestNext = curr.connections[0];
      let closestDist = Infinity;

      this.runners.forEach((r) => {
        const targetPos = this.nodes[r.currentNode];
        curr.connections.forEach((conn) => {
          const np = this.nodes[conn];
          const dist = Math.hypot(np.x - targetPos.x, np.y - targetPos.y);
          if (dist < closestDist) {
            closestDist = dist;
            bestNext = conn;
          }
        });
      });

      this.minotaur.targetNode = bestNext;
    }

    const mP1 = this.nodes[this.minotaur.currentNode];
    const mP2 = this.nodes[this.minotaur.targetNode];
    const mx = mP1.x + (mP2.x - mP1.x) * this.minotaur.progress;
    const my = mP1.y + (mP2.y - mP1.y) * this.minotaur.progress;

    // Update Runners
    this.runners.forEach((r) => {
      const p = this.getPlayer(r.id);
      if (r.stunTimer > 0) {
        r.stunTimer -= dt;
        return;
      }

      if (p && !p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(r.id) || this.input.justAction(r.id);
        if (justPressed) {
          this.switchBranch(r);
        }
      }

      const runSpeed = 1.35;
      r.progress += runSpeed * dt;
      if (r.progress >= 1) {
        r.progress = 0;
        r.currentNode = r.targetNode;
        const curr = this.nodes[r.currentNode];
        r.targetNode = curr.connections[0];

        this.loots.forEach((l) => {
          if (!l.collected && l.nodeIndex === r.currentNode) {
            l.collected = true;
            const pts = l.type === 'thread' ? 30 : 20;
            r.score += pts + r.combo * 2;
            r.combo++;
            this.audio.playTone(l.type === 'thread' ? 740 : 580, 0.12, 'sine');
            this.particles.emit(this.nodes[r.currentNode].x, this.nodes[r.currentNode].y, 12, '#f1c40f');
          }
        });
      }

      const rP1 = this.nodes[r.currentNode];
      const rP2 = this.nodes[r.targetNode];
      const rx = rP1.x + (rP2.x - rP1.x) * r.progress;
      const ry = rP1.y + (rP2.y - rP1.y) * r.progress;

      const dMinotaur = Math.hypot(mx - rx, my - ry);
      if (dMinotaur < 24 && r.stunTimer <= 0) {
        r.stunTimer = 1.2;
        r.score = Math.max(0, r.score - 25);
        r.combo = 0;
        this.audio.playTone(130, 0.35, 'sawtooth');
        this.particles.emit(rx, ry, 20, '#e74c3c');
      }
    });

    if (this.loots.every((l) => l.collected)) {
      this.loots = [];
      for (let i = 1; i < this.nodes.length; i += 3) {
        this.loots.push({
          id: ++this.lootIdCounter,
          nodeIndex: i,
          type: Math.random() > 0.5 ? 'thread' : 'cog',
          collected: false,
        });
      }
    }
  }

  private switchBranch(r: LabyrinthRunner): void {
    const curr = this.nodes[r.currentNode];
    const curIdx = curr.connections.indexOf(r.targetNode);
    const nextIdx = (curIdx + 1) % curr.connections.length;
    r.targetNode = curr.connections[nextIdx];
    this.audio.playTone(420, 0.08, 'triangle');
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const r = this.runners.get(botId);
    if (!r || r.stunTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      const targetLoot = this.loots.find((l) => !l.collected);
      if (targetLoot && Math.random() < (difficulty === 'bot_hard' ? 0.75 : 0.45)) {
        this.switchBranch(r);
        bTimer = 0.5;
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, 300);
    bgGrad.addColorStop(0, '#2c1e13');
    bgGrad.addColorStop(1, '#0e0804');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#4a3728';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    this.nodes.forEach((n1) => {
      n1.connections.forEach((connIdx) => {
        const n2 = this.nodes[connIdx];
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        ctx.stroke();
      });
    });

    ctx.strokeStyle = '#795548';
    ctx.lineWidth = 6;
    this.nodes.forEach((n1) => {
      n1.connections.forEach((connIdx) => {
        const n2 = this.nodes[connIdx];
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        ctx.stroke();
      });
    });

    this.nodes.forEach((n) => {
      ctx.fillStyle = '#3e2723';
      ctx.beginPath();
      ctx.arc(n.x, n.y, 8, 0, Math.PI * 2);
      ctx.fill();
    });

    this.loots.forEach((l) => {
      if (l.collected) return;
      const n = this.nodes[l.nodeIndex];
      if (l.type === 'thread') {
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(n.x, n.y, 7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#d35400';
        ctx.beginPath();
        ctx.arc(n.x, n.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f39c12';
        ctx.fillRect(n.x - 2, n.y - 2, 4, 4);
      }
    });

    const mP1 = this.nodes[this.minotaur.currentNode];
    const mP2 = this.nodes[this.minotaur.targetNode];
    const mx = mP1.x + (mP2.x - mP1.x) * this.minotaur.progress;
    const my = mP1.y + (mP2.y - mP1.y) * this.minotaur.progress;

    ctx.fillStyle = '#78281f';
    ctx.beginPath();
    ctx.arc(mx, my, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f5b041';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mx - 8, my - 6);
    ctx.lineTo(mx - 15, my - 14);
    ctx.moveTo(mx + 8, my - 6);
    ctx.lineTo(mx + 15, my - 14);
    ctx.stroke();

    this.runners.forEach((r, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#3498db';

      const rP1 = this.nodes[r.currentNode];
      const rP2 = this.nodes[r.targetNode];
      const rx = rP1.x + (rP2.x - rP1.x) * r.progress;
      const ry = rP1.y + (rP2.y - rP1.y) * r.progress;

      ctx.save();
      if (r.stunTimer > 0) {
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.02) * 0.3;
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(rx, ry, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      const angle = Math.atan2(rP2.y - ry, rP2.x - rx);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + Math.cos(angle) * 14, ry + Math.sin(angle) * 14);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${r.score}`, rx, ry - 14);
    });

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐂 TAP TO SWITCH CORRIDOR • ESCAPE THE MINOTAUR!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.runners.forEach((r, pId) => scores.set(pId, r.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.runners.entries())
      .map(([playerId, r]) => ({ playerId, score: r.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} navigated the Knossos Labyrinth!` : 'The Minotaur claimed all challengers!',
    };
  }
}
