import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type LabyrinthThemeId = 'knossos' | 'underworld' | 'cyber_maze';

interface LabyrinthTheme {
  name: string;
  bgInner: string;
  bgOuter: string;
  wallOuter: string;
  corridorFloor: string;
  nodeStone: string;
  accent: string;
}

const THEMES: Record<LabyrinthThemeId, LabyrinthTheme> = {
  knossos: {
    name: 'Palace of Knossos',
    bgInner: '#3b2314',
    bgOuter: '#140b05',
    wallOuter: '#5c3a21',
    corridorFloor: '#8c5a36',
    nodeStone: '#432818',
    accent: '#facc15',
  },
  underworld: {
    name: 'Tartarus Bone Maze',
    bgInner: '#1e1035',
    bgOuter: '#080312',
    wallOuter: '#3b1d5e',
    corridorFloor: '#582f87',
    nodeStone: '#24113b',
    accent: '#4ade80',
  },
  cyber_maze: {
    name: 'Daedalus Circuit Grid',
    bgInner: '#0c2340',
    bgOuter: '#030914',
    wallOuter: '#0284c7',
    corridorFloor: '#1e3a8a',
    nodeStone: '#0f172a',
    accent: '#38bdf8',
  },
};

const THEME_ORDER: LabyrinthThemeId[] = ['knossos', 'underworld', 'cyber_maze'];

interface NodePoint {
  x: number;
  y: number;
  connections: number[];
}

interface GoldenLoot {
  id: number;
  nodeIndex: number;
  type: 'thread' | 'cog' | 'aegis';
  collected: boolean;
}

interface Callout {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface LabyrinthRunner {
  id: PlayerId;
  currentNode: number;
  targetNode: number;
  queuedNextNode: number;
  progress: number;
  score: number;
  combo: number;
  stunTimer: number;
  dashTimer: number;
  charge: number;
  charging: boolean;
  shuntCooldown: number;
  skeinsCollected: number;
  shuntsLanded: number;
  botReactionTimer: number;
  botReleaseThreshold: number;
}

interface MinotaurState {
  currentNode: number;
  targetNode: number;
  progress: number;
  speed: number;
  lureTargetPlayer: PlayerId | null;
  lureTimer: number;
}

export class MinotaurLabyrinthGame extends BaseGame {
  public runners: Map<PlayerId, LabyrinthRunner> = new Map();
  public minotaur: MinotaurState = {
    currentNode: 0,
    targetNode: 1,
    progress: 0,
    speed: 0.92,
    lureTargetPlayer: null,
    lureTimer: 0,
  };
  public nodes: NodePoint[] = [];
  public loots: GoldenLoot[] = [];
  public currentMapName: string = 'Palace of Knossos';

  private themeId: LabyrinthThemeId = 'knossos';
  private callouts: Callout[] = [];
  private lootIdCounter: number = 0;
  private animTime: number = 0;
  private screenShake: number = 0;
  private suddenDeathAnnounced: boolean = false;

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 38.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
    this.bindThemeControls();
  }

  private bindThemeControls(): void {
    this.cleanupControls();
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        const idx = (THEME_ORDER.indexOf(this.themeId) + 1) % THEME_ORDER.length;
        this.setTheme(THEME_ORDER[idx]);
      } else if (e.key === '1') {
        this.setTheme('knossos');
      } else if (e.key === '2') {
        this.setTheme('underworld');
      } else if (e.key === '3') {
        this.setTheme('cyber_maze');
      }
    };
    this.clickHandler = (e: MouseEvent) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      if (mx >= 20 && mx <= 190 && my >= canvas.height - 44 && my <= canvas.height - 12) {
        const idx = (THEME_ORDER.indexOf(this.themeId) + 1) % THEME_ORDER.length;
        this.setTheme(THEME_ORDER[idx]);
      }
    };
    window.addEventListener('keydown', this.keyHandler);
    window.addEventListener('mousedown', this.clickHandler);
  }

  private setTheme(id: LabyrinthThemeId): void {
    this.themeId = id;
    this.currentMapName = THEMES[id].name;
    this.audio.playTap();
  }

  private cleanupControls(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.clickHandler) {
      window.removeEventListener('mousedown', this.clickHandler);
      this.clickHandler = null;
    }
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 38.0;
    this.runners.clear();
    this.nodes = [];
    this.loots = [];
    this.callouts = [];
    this.animTime = 0;
    this.screenShake = 0;
    this.suddenDeathAnnounced = false;

    const cx = width / 2;
    const cy = height / 2 + 12;
    const rInner = 76;
    const rMid = 142;
    const rOuter = 204;

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
      speed: 0.92,
      lureTargetPlayer: null,
      lureTimer: 0,
    };

    this.seedLoots();

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const startNode = 12 + ((idx * 2) % 6);
      const nextNode = this.nodes[startNode].connections[0];
      const nextNext = this.nodes[nextNode].connections[0];
      this.runners.set(p.id, {
        id: p.id,
        currentNode: startNode,
        targetNode: nextNode,
        queuedNextNode: nextNext,
        progress: 0,
        score: 0,
        combo: 0,
        stunTimer: 0,
        dashTimer: 0,
        charge: 0,
        charging: false,
        shuntCooldown: 0,
        skeinsCollected: 0,
        shuntsLanded: 0,
        botReactionTimer: 0.14,
        botReleaseThreshold: 0.82,
      });
    });
  }

  private seedLoots(): void {
    this.loots = [];
    for (let i = 1; i < this.nodes.length; i += 2) {
      this.loots.push({
        id: ++this.lootIdCounter,
        nodeIndex: i,
        type: i % 5 === 0 ? 'aegis' : i % 3 === 0 ? 'thread' : 'cog',
        collected: false,
      });
    }
  }

  private spawnCallout(x: number, y: number, text: string, color: string): void {
    this.callouts.push({ x, y, text, color, life: 0.95, maxLife: 0.95 });
  }

  private getRunnerCoords(r: LabyrinthRunner): { x: number; y: number } {
    const p1 = this.nodes[r.currentNode];
    const p2 = this.nodes[r.targetNode];
    return {
      x: p1.x + (p2.x - p1.x) * r.progress,
      y: p1.y + (p2.y - p1.y) * r.progress,
    };
  }

  private getMinotaurCoords(): { x: number; y: number } {
    const p1 = this.nodes[this.minotaur.currentNode];
    const p2 = this.nodes[this.minotaur.targetNode];
    return {
      x: p1.x + (p2.x - p1.x) * this.minotaur.progress,
      y: p1.y + (p2.y - p1.y) * this.minotaur.progress,
    };
  }

  private getLeaderScore(): number {
    let best = 0;
    this.runners.forEach((r) => {
      if (r.score > best) best = r.score;
    });
    return best;
  }

  private isUnderdog(r: LabyrinthRunner): boolean {
    return this.getLeaderScore() - r.score >= 110;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.animTime += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.cleanupControls();
      return;
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 26);
    }

    const suddenDeath = this.roundTimer <= 12.0;
    if (suddenDeath && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.audio.playFanfare();
      this.spawnCallout(width * 0.5, height * 0.18, '🐂 BERSERK MINOTAUR RAMPAGE (2X SCORE)! 🐂', '#facc15');
    }

    const scoreMult = suddenDeath ? 2 : 1;

    // Update Minotaur AI & Lure Aggro
    if (this.minotaur.lureTimer > 0) {
      this.minotaur.lureTimer = Math.max(0, this.minotaur.lureTimer - dt);
      if (this.minotaur.lureTimer <= 0) this.minotaur.lureTargetPlayer = null;
    }

    this.minotaur.speed = suddenDeath ? 1.22 : 0.94;
    this.minotaur.progress += this.minotaur.speed * dt;
    if (this.minotaur.progress >= 1) {
      this.minotaur.progress = 0;
      this.minotaur.currentNode = this.minotaur.targetNode;
      const curr = this.nodes[this.minotaur.currentNode];
      let bestNext = curr.connections[0];
      let closestDist = Infinity;

      const luredRunner =
        this.minotaur.lureTargetPlayer !== null
          ? this.runners.get(this.minotaur.lureTargetPlayer)
          : undefined;
      const candidateRunners = luredRunner ? [luredRunner] : Array.from(this.runners.values());

      candidateRunners.forEach((r) => {
        const rPos = this.getRunnerCoords(r);
        curr.connections.forEach((conn) => {
          const np = this.nodes[conn];
          const dist = Math.hypot(np.x - rPos.x, np.y - rPos.y);
          if (dist < closestDist) {
            closestDist = dist;
            bestNext = conn;
          }
        });
      });

      this.minotaur.targetNode = bestNext;
    }

    const mPos = this.getMinotaurCoords();

    this.updateBots(dt, width, height);

    // Update Runners
    this.runners.forEach((r) => {
      if (r.stunTimer > 0) r.stunTimer = Math.max(0, r.stunTimer - dt);
      if (r.dashTimer > 0) r.dashTimer = Math.max(0, r.dashTimer - dt);
      if (r.shuntCooldown > 0) r.shuntCooldown = Math.max(0, r.shuntCooldown - dt);

      const p = this.getPlayer(r.id);
      const underdog = this.isUnderdog(r);

      if (p && !p.type.startsWith('bot_') && r.stunTimer <= 0) {
        const steer = this.input.getSteer(r.id);
        const throttle = this.input.getThrottle(r.id);
        const justTapped = this.input.justPressed(r.id) || this.input.justAction(r.id);
        const holdAction = this.input.isActionPressed(r.id) || this.input.isPressed(r.id);

        // Directional aiming of queued junction turn (or 1-button cycle)
        if (Math.abs(steer) > 0.25 || Math.abs(throttle) > 0.25) {
          this.selectDirectionalBranch(r, steer, throttle);
        } else if (justTapped && !r.charging) {
          this.cycleQueuedBranch(r);
        }

        if (holdAction) {
          r.charging = true;
          r.charge = Math.min(1.0, r.charge + dt * 1.1);
          if (r.charge >= 1.0) {
            r.charging = false;
            r.charge = 0;
          }
        } else if (r.charging) {
          const released = r.charge;
          r.charging = false;
          r.charge = 0;
          if (released >= 0.25) {
            this.executeAriadneDash(r, released, scoreMult);
          }
        }
      }

      if (r.stunTimer > 0) return;

      const baseSpeed = underdog ? 1.56 : 1.38;
      const runSpeed = baseSpeed * (r.dashTimer > 0 ? 2.15 : 1.0);
      r.progress += runSpeed * dt;

      if (r.progress >= 1) {
        r.progress = 0;
        const prevNode = r.currentNode;
        r.currentNode = r.targetNode;
        const curr = this.nodes[r.currentNode];

        // Follow queuedNextNode if valid, otherwise pick first forward connection
        if (curr.connections.includes(r.queuedNextNode)) {
          r.targetNode = r.queuedNextNode;
        } else {
          r.targetNode = curr.connections.find((c) => c !== prevNode) ?? curr.connections[0];
        }

        // Pre-queue default forward branch at the new targetNode
        const nextConnections = this.nodes[r.targetNode].connections;
        r.queuedNextNode =
          nextConnections.find((c) => c !== r.currentNode) ?? nextConnections[0];

        // Collect Loot at Node
        this.loots.forEach((l) => {
          if (!l.collected && l.nodeIndex === r.currentNode) {
            l.collected = true;
            r.skeinsCollected++;
            r.combo++;
            const basePts = l.type === 'aegis' ? 65 : l.type === 'thread' ? 38 : 24;
            const pts = (basePts + Math.min(30, r.combo * 3)) * scoreMult;
            r.score += pts;
            if (l.type === 'aegis') r.dashTimer = Math.max(r.dashTimer, 1.1);
            this.audio.playCoin();
            const np = this.nodes[r.currentNode];
            this.particles.spawnConfetti(np.x, np.y, 12);
            this.spawnCallout(
              np.x,
              np.y - 22,
              l.type === 'aegis' ? `🛡️ +${pts} AEGIS!` : `🧶 +${pts}`,
              '#facc15'
            );
          }
        });
      }

      const rPos = this.getRunnerCoords(r);
      const dMinotaur = Math.hypot(mPos.x - rPos.x, mPos.y - rPos.y);
      if (dMinotaur < 28 && r.stunTimer <= 0) {
        if (r.dashTimer > 0 || underdog) {
          // Dash or Underdog armor Vaults over Minotaur horns for bonus points!
          r.stunTimer = 0.25;
          const pts = 45 * scoreMult;
          r.score += pts;
          this.audio.playBounce();
          this.particles.spawnSparks(rPos.x, rPos.y, '#facc15', 12);
          this.spawnCallout(rPos.x, rPos.y - 28, `🐂 BULL VAULT! +${pts}`, '#facc15');
        } else {
          r.stunTimer = 0.95;
          r.score = Math.max(0, r.score - 25);
          r.combo = 0;
          // Reverse corridor direction away from Minotaur
          const tmp = r.currentNode;
          r.currentNode = r.targetNode;
          r.targetNode = tmp;
          r.progress = 1 - r.progress;
          this.audio.playStun();
          this.particles.spawnExplosion(rPos.x, rPos.y, '#ef4444', 16);
          this.spawnCallout(rPos.x, rPos.y - 28, '-25 GORED!', '#ef4444');
        }
      }
    });

    // Runner-to-Runner Corridor Bodycheck Collisions
    const list = Array.from(this.runners.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const pa = this.getRunnerCoords(a);
        const pb = this.getRunnerCoords(b);
        if (Math.hypot(pb.x - pa.x, pb.y - pa.y) < 24 && a.shuntCooldown <= 0 && b.shuntCooldown <= 0) {
          a.shuntCooldown = 0.6;
          b.shuntCooldown = 0.6;
          if (a.dashTimer > b.dashTimer) {
            b.stunTimer = 0.45;
          } else if (b.dashTimer > a.dashTimer) {
            a.stunTimer = 0.45;
          }
          this.audio.playBounce();
          this.particles.spawnSparks((pa.x + pb.x) * 0.5, (pa.y + pb.y) * 0.5, '#facc15', 8);
        }
      }
    }

    if (this.loots.filter((l) => !l.collected).length <= 2) {
      this.seedLoots();
    }

    // Update Callouts
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y -= 30 * dt;
      c.life -= dt;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }
  }

  private cycleQueuedBranch(r: LabyrinthRunner): void {
    // Notice: we NEVER overwrite r.targetNode mid-corridor (which caused diagonal wall-teleporting!).
    // Instead we cycle r.queuedNextNode at the upcoming junction, or reverse on the current edge if near the start!
    const nextNodeObj = this.nodes[r.targetNode];
    const conns = nextNodeObj.connections;
    const curIdx = conns.indexOf(r.queuedNextNode);
    r.queuedNextNode = conns[(curIdx + 1) % conns.length];
    this.audio.playTap();
  }

  private selectDirectionalBranch(r: LabyrinthRunner, steer: number, throttle: number): void {
    const tNode = this.nodes[r.targetNode];
    let bestConn = r.queuedNextNode;
    let bestDot = -Infinity;
    for (const c of tNode.connections) {
      const cn = this.nodes[c];
      const dx = cn.x - tNode.x;
      const dy = cn.y - tNode.y;
      const len = Math.hypot(dx, dy) || 1;
      const dot = (dx / len) * steer + (dy / len) * throttle;
      if (dot > bestDot) {
        bestDot = dot;
        bestConn = c;
      }
    }
    r.queuedNextNode = bestConn;
  }

  private executeAriadneDash(r: LabyrinthRunner, chargeLevel: number, scoreMult: number): void {
    const isSweetSpot = chargeLevel >= 0.72 && chargeLevel <= 0.98;
    const pos = this.getRunnerCoords(r);

    if (isSweetSpot) {
      r.dashTimer = 1.05;
      this.screenShake = Math.min(12, this.screenShake + 6);
      this.audio.playExplosion();
      this.particles.spawnExplosion(pos.x, pos.y, '#facc15', 18);
      this.spawnCallout(pos.x, pos.y - 28, '⚡ THESEUS THREAD DASH!', '#facc15');

      // Bull-Bell Lure & Labyrinth Shunt against rival runners!
      let luredRival: PlayerId | null = null;
      let nearestRivalDist = Infinity;

      this.runners.forEach((other) => {
        if (other.id === r.id) return;
        const oPos = this.getRunnerCoords(other);
        const d = Math.hypot(oPos.x - pos.x, oPos.y - pos.y);
        if (d < nearestRivalDist) {
          nearestRivalDist = d;
          luredRival = other.id;
        }
        if (d <= 105 && other.shuntCooldown <= 0) {
          other.stunTimer = 0.65;
          other.shuntCooldown = 1.2;
          // Reverse rival's corridor direction!
          const tmp = other.currentNode;
          other.currentNode = other.targetNode;
          other.targetNode = tmp;
          other.progress = 1 - other.progress;

          const pts = 70 * scoreMult;
          r.score += pts;
          r.shuntsLanded++;
          this.audio.playStun();
          this.particles.spawnExplosion(oPos.x, oPos.y, '#facc15', 14);
          this.spawnCallout(oPos.x, oPos.y - 30, `🔔 BULL LURE SHUNT! +${pts}`, '#facc15');
        }
      });

      if (luredRival !== null) {
        this.minotaur.lureTargetPlayer = luredRival;
        this.minotaur.lureTimer = 4.0;
      }
    } else {
      r.dashTimer = 0.45;
      this.audio.playWhoosh();
      this.particles.spawnSparks(pos.x, pos.y, '#fde047', 8);
    }
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

    const scoreMult = this.roundTimer <= 12.0 ? 2 : 1;

    r.botReactionTimer -= dt;
    if (r.botReactionTimer <= 0) {
      r.botReactionTimer =
        difficulty === 'bot_hard' ? 0.10 : difficulty === 'bot_normal' ? 0.23 : 0.40;
      const blunder =
        difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.08 : 0.0;

      const mPos = this.getMinotaurCoords();
      const tNode = this.nodes[r.targetNode];

      // Evaluate each neighbor of r.targetNode by proximity to nearest loot & safety from Minotaur
      let bestConn = tNode.connections[0];
      let bestUtility = -Infinity;

      for (const conn of tNode.connections) {
        const cn = this.nodes[conn];
        const minotaurDist = Math.hypot(cn.x - mPos.x, cn.y - mPos.y);

        let minLootDist = 250;
        for (const l of this.loots) {
          if (l.collected) continue;
          const ln = this.nodes[l.nodeIndex];
          const d = Math.hypot(ln.x - cn.x, ln.y - cn.y);
          if (d < minLootDist) minLootDist = d;
        }

        const backtrackPenalty = conn === r.currentNode ? 65 : 0;
        const utility = -minLootDist + Math.min(140, minotaurDist * 0.9) - backtrackPenalty;
        if (utility > bestUtility) {
          bestUtility = utility;
          bestConn = conn;
        }
      }

      if (Math.random() > blunder) {
        r.queuedNextNode = bestConn;
      } else {
        r.queuedNextNode = tNode.connections[Math.floor(Math.random() * tNode.connections.length)];
      }

      const rPos = this.getRunnerCoords(r);
      const minotaurClose = Math.hypot(mPos.x - rPos.x, mPos.y - rPos.y) < 115;
      if (!r.charging && (minotaurClose || Math.random() < (difficulty === 'bot_hard' ? 0.45 : 0.25))) {
        r.charging = true;
        r.botReleaseThreshold = difficulty === 'bot_hard' ? 0.80 : 0.74;
      }
    }

    if (r.charging) {
      r.charge = Math.min(1.0, r.charge + dt * 1.1);
      if (r.charge >= r.botReleaseThreshold) {
        const released = r.charge;
        r.charging = false;
        r.charge = 0;
        this.executeAriadneDash(r, released, scoreMult);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeId];
    const cx = width / 2;
    const cy = height / 2 + 12;

    ctx.save();
    if (this.screenShake > 0.2) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake,
        (Math.random() - 0.5) * this.screenShake
      );
    }

    // 1. Torchlit Labyrinth Backdrop
    const bgGrad = ctx.createRadialGradient(cx, cy, 35, cx, cy, 340);
    bgGrad.addColorStop(0, theme.bgInner);
    bgGrad.addColorStop(1, theme.bgOuter);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. 2.5D Stone Labyrinth Corridors (Outer bevel + inner floor)
    ctx.strokeStyle = theme.wallOuter;
    ctx.lineWidth = 22;
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

    ctx.strokeStyle = theme.corridorFloor;
    ctx.lineWidth = 11;
    this.nodes.forEach((n1) => {
      n1.connections.forEach((connIdx) => {
        const n2 = this.nodes[connIdx];
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        ctx.stroke();
      });
    });

    // 3. Junction Pillars
    this.nodes.forEach((n) => {
      ctx.fillStyle = theme.nodeStone;
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // 4. Render Golden Ariadne Skeins, Daedalus Cogs & Aegis Relics
    this.loots.forEach((l) => {
      if (l.collected) return;
      const n = this.nodes[l.nodeIndex];
      ctx.save();
      ctx.translate(n.x, n.y);
      if (l.type === 'aegis') {
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (l.type === 'thread') {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-2.5, -2.5, 5, 5);
      }
      ctx.restore();
    });

    // 5. Render 2.5D Minotaur Boss
    const mPos = this.getMinotaurCoords();
    ctx.save();
    ctx.translate(mPos.x, mPos.y);
    const pulse = Math.sin(this.animTime * 8) * 2;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, 24 + pulse, 0, Math.PI * 2);
    ctx.fill();

    // Minotaur Muscular Shoulders & Bull Head
    ctx.fillStyle = '#7f1d1d';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ivory Curved Bull Horns
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.quadraticCurveTo(-22, -16, -16, -24);
    ctx.moveTo(10, -6);
    ctx.quadraticCurveTo(22, -16, 16, -24);
    ctx.stroke();

    // Glowing Red Eyes & Brass Nose Ring
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(-5, -3, 2.5, 0, Math.PI * 2);
    ctx.arc(5, -3, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 6. Render 2.5D Mascot Runners & Queued Ariadne Thread Turn Arrows
    this.runners.forEach((r, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#38bdf8';
      const pos = this.getRunnerCoords(r);
      const tNode = this.nodes[r.targetNode];
      const qNode = this.nodes[r.queuedNextNode];
      const isSweetSpot = r.charge >= 0.72 && r.charge <= 0.98;

      // Glowing Ariadne Thread Preview from Runner -> Target Node -> Queued Next Node
      if (tNode && qNode) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(tNode.x, tNode.y);
        ctx.lineTo(tNode.x + (qNode.x - tNode.x) * 0.42, tNode.y + (qNode.y - tNode.y) * 0.42);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      ctx.save();
      ctx.translate(pos.x, pos.y);

      if (r.dashTimer > 0) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.stroke();
      }

      this.drawPlayerMascot(
        ctx,
        pId,
        0,
        0,
        14,
        r.stunTimer > 0 ? 'shocked' : r.dashTimer > 0 ? 'triumph' : 'focused',
        this.animTime
      );

      // Hold-to-Charge Ariadne Spool Gauge (72%–98% Sweet Spot)
      if (r.charging && r.charge > 0.04) {
        const bw = 38;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(-bw / 2 - 1, -28, bw + 2, 6);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.fillRect(-bw / 2 + bw * 0.72, -27, bw * 0.26, 4);
        ctx.fillStyle = isSweetSpot ? '#facc15' : '#38bdf8';
        ctx.fillRect(-bw / 2, -27, bw * r.charge, 4);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? `P${pId + 1}`}: ${r.score}`, 0, -18);
      ctx.restore();
    });

    // 7. Callouts
    this.callouts.forEach((c) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, c.life / c.maxLife);
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000000';
      ctx.fillText(c.text, c.x + 1, c.y + 1);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    });

    ctx.restore();

    // 8. Top Instruction Pill (y: 56)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 245, 56, 490, 28, 14);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '🐂 STEER/TAP: AIM NEXT TURN • HOLD & RELEASE (72–98%): THREAD DASH & BULL LURE!',
      width / 2,
      74
    );

    // 9. Corner Score Cards (y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const r = this.runners.get(p.id);
      if (!r) return;
      const isLeft = idx % 2 === 0;
      const row = Math.floor(idx / 2);
      const cardX = isLeft ? 18 : width - 178;
      const cardY = height - 128 - row * 56;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 160, 48, 10);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 10, cardY + 18);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`${Math.floor(r.score)} pts`, cardX + 10, cardY + 37);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`🧶${r.skeinsCollected} 🔔${r.shuntsLanded}`, cardX + 150, cardY + 37);
    });

    // 10. Interactive Theme Pill (bottom-left x: 20, y: height - 44, w: 170, h: 32)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 16);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎨 [T] ${theme.name}`, 105, height - 24);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.runners.forEach((r, pId) => scores.set(pId, Math.floor(r.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    this.cleanupControls();
    const rankings = Array.from(this.runners.entries())
      .map(([playerId, r]) => ({ playerId, score: Math.floor(r.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    const winnerCfg = winnerId ? this.getPlayer(winnerId) : undefined;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerCfg
        ? `${winnerCfg.name} mastered the Knossos Labyrinth with ${rankings[0].score} pts!`
        : 'The Minotaur claimed all challengers!',
    };
  }
}
