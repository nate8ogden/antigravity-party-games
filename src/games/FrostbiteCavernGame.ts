import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { CharacterMood } from '../core/CharacterRenderer';

interface CavernTheme {
  id: string;
  name: string;
  wallTop: string;
  floorTop: string;
  floorBottom: string;
  crystalPrimary: string;
  accent: string;
}

const THEMES: CavernTheme[] = [
  {
    id: 'sapphire_grotto',
    name: 'Sapphire Frost Grotto',
    wallTop: '#082f49',
    floorTop: '#0f172a',
    floorBottom: '#1e293b',
    crystalPrimary: '#38bdf8',
    accent: '#0ea5e9',
  },
  {
    id: 'amethyst_geode',
    name: 'Amethyst Ice Geode',
    wallTop: '#2e1065',
    floorTop: '#1e1b4b',
    floorBottom: '#0f172a',
    crystalPrimary: '#c084fc',
    accent: '#a855f7',
  },
  {
    id: 'emerald_glacier',
    name: 'Sub-Glacial Emerald Cave',
    wallTop: '#064e3b',
    floorTop: '#022c22',
    floorBottom: '#0f172a',
    crystalPrimary: '#34d399',
    accent: '#10b981',
  },
];

interface CavernNode {
  id: number;
  x: number;
  y: number;
  type: 'sapphire_gem' | 'golden_diamond' | 'falling_stalactite';
  fallTimer: number;
  maxFallTimer: number;
  radius: number;
  pulse: number;
}

interface FxParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface CavernMiner {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  score: number;
  combo: number;
  isHolding: boolean;
  charge: number;
  overchargeTimer: number;
  swingAnim: number;
  botTimer: number;
  botTargetX: number;
  botTargetY: number;
  botHoldTarget: number;
}

export class FrostbiteCavernGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  public sledders: Map<PlayerId, CavernMiner> = new Map();
  private nodes: CavernNode[] = [];
  private fxParticles: FxParticle[] = [];
  private nextNodeId = 1;
  private spawnTimer = 0.7;

  private themeIndex = 0;
  private elapsed = 0;
  private hitStopTimer = 0;
  private screenShake = 0;
  private suddenDeath = false;

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 45.0;
  }

  public get currentMapName(): string {
    return THEMES[this.themeIndex]?.name ?? 'Sapphire Frost Grotto';
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
    this.bindThemeControls();
  }

  private bindThemeControls(): void {
    if (typeof window === 'undefined') return;
    this.cleanupThemeControls();

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        this.themeIndex = (this.themeIndex + 1) % THEMES.length;
        this.audio.playTap();
      } else if (e.key === '1') {
        this.themeIndex = 0;
        this.audio.playTap();
      } else if (e.key === '2') {
        this.themeIndex = 1;
        this.audio.playTap();
      } else if (e.key === '3') {
        this.themeIndex = 2;
        this.audio.playTap();
      }
    };

    this.clickHandler = (e: MouseEvent) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;

      const px = 20;
      const py = canvas.height - 44;
      const pw = 170;
      const ph = 32;
      if (cx >= px && cx <= px + pw && cy >= py && cy <= py + ph) {
        this.themeIndex = (this.themeIndex + 1) % THEMES.length;
        this.audio.playTap();
      }
    };

    window.addEventListener('keydown', this.keyHandler);
    window.addEventListener('mousedown', this.clickHandler);
  }

  private cleanupThemeControls(): void {
    if (typeof window === 'undefined') return;
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.clickHandler) {
      window.removeEventListener('mousedown', this.clickHandler);
      this.clickHandler = null;
    }
  }

  public cleanup(): void {
    this.cleanupThemeControls();
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45.0;
    this.elapsed = 0;
    this.hitStopTimer = 0;
    this.screenShake = 0;
    this.suddenDeath = false;
    this.nodes = [];
    this.fxParticles = [];
    this.sledders.clear();

    const active = this.getActivePlayers();
    const count = Math.max(1, active.length);
    active.forEach((p, idx) => {
      const sx = width * (0.28 + (idx / Math.max(1, count - 1 || 1)) * 0.44);
      const sy = height * 0.55;
      this.sledders.set(p.id, {
        id: p.id,
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        angle: 0,
        radius: 22,
        score: 0,
        combo: 1,
        isHolding: false,
        charge: 0,
        overchargeTimer: 0,
        swingAnim: 0,
        botTimer: 0.2 + Math.random() * 0.2,
        botTargetX: sx,
        botTargetY: sy,
        botHoldTarget: 0,
      });
    });

    for (let i = 0; i < 7; i++) {
      this.spawnNode(width, height);
    }
  }

  private triggerScreenShake(amount: number): void {
    this.screenShake = Math.min(18, Math.max(this.screenShake, amount));
  }

  private applyScreenShake(ctx: CanvasRenderingContext2D): void {
    if (this.screenShake > 0.2) {
      const dx = (Math.random() - 0.5) * this.screenShake * 1.6;
      const dy = (Math.random() - 0.5) * this.screenShake * 1.6;
      ctx.translate(dx, dy);
    }
  }

  private emitFx(x: number, y: number, color: string, count = 12, speed = 150): void {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const spd = speed * (0.4 + Math.random() * 0.8);
      this.fxParticles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 3 + Math.random() * 4,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.3,
      });
    }
  }

  private spawnNode(width: number, height: number): void {
    const roll = Math.random();
    const type: CavernNode['type'] =
      roll < (this.suddenDeath ? 0.32 : 0.22)
        ? 'golden_diamond'
        : roll < 0.72
        ? 'sapphire_gem'
        : 'falling_stalactite';

    const dur = type === 'falling_stalactite' ? (this.suddenDeath ? 1.15 : 1.55) : 10.0;
    this.nodes.push({
      id: this.nextNodeId++,
      x: width * (0.14 + Math.random() * 0.72),
      y: height * (0.24 + Math.random() * 0.56),
      type,
      fallTimer: dur,
      maxFallTimer: dur,
      radius: type === 'falling_stalactite' ? 28 : type === 'golden_diamond' ? 18 : 16,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  private getMaxScore(): number {
    let max = 0;
    this.sledders.forEach((s) => {
      if (s.score > max) max = s.score;
    });
    return max;
  }

  private isUnderdog(s: CavernMiner): boolean {
    return this.getMaxScore() - s.score >= 150;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    const safeDt = Math.min(0.05, dt);
    this.elapsed += safeDt;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - safeDt * 28);
    }

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= safeDt;
      return;
    }

    this.roundTimer = Math.max(0, this.roundTimer - safeDt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.cleanupThemeControls();
      return;
    }

    if (this.roundTimer <= 12.0 && !this.suddenDeath) {
      this.suddenDeath = true;
      this.triggerScreenShake(11);
      this.audio.playExplosion();
      this.addFloatingText(width * 0.5, height * 0.18, '⚡ SUDDEN DEATH: CAVERN QUAKE! ⚡', '#facc15', 22);
    }

    this.spawnTimer -= safeDt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.suddenDeath ? 0.55 : 0.85;
      if (this.nodes.length < 13) {
        this.spawnNode(width, height);
      }
    }

    this.updateBots(safeDt, width, height);

    // Update Miners
    this.sledders.forEach((s) => {
      const p = this.getPlayer(s.id);
      if (s.overchargeTimer > 0) s.overchargeTimer = Math.max(0, s.overchargeTimer - safeDt);
      if (s.swingAnim > 0) s.swingAnim = Math.max(0, s.swingAnim - safeDt * 4);

      const underdog = this.isUnderdog(s);
      const speedMult = (underdog ? 1.18 : 1.0) * (s.overchargeTimer > 0 ? 0.55 : 1.0);

      if (p && !p.type.startsWith('bot_')) {
        const move = { x: this.input.getSteer(s.id), y: -this.input.getThrottle(s.id) };
        if (Math.hypot(move.x, move.y) > 0.08) {
          s.vx += move.x * 780 * speedMult * safeDt;
          s.vy += move.y * 780 * speedMult * safeDt;
          s.angle = Math.atan2(move.y, move.x);
        }

        const holding = this.input.isActionPressed(s.id) || this.input.isPressed(s.id);
        if (holding && s.overchargeTimer <= 0) {
          s.isHolding = true;
          s.charge = Math.min(1.15, s.charge + safeDt * 0.85);
          if (s.charge >= 1.05) {
            this.triggerPickJam(s);
          }
        } else if (s.isHolding) {
          s.isHolding = false;
          if (s.charge >= 0.72 && s.charge <= 0.98) {
            this.executeThermalShockwave(s);
          } else {
            this.executePickaxeStrike(s, 72);
          }
          s.charge = 0;
        } else if (this.input.justPressed(s.id) || this.input.justAction(s.id)) {
          this.executePickaxeStrike(s, 72);
        }
      }

      s.x += s.vx * safeDt;
      s.y += s.vy * safeDt;
      const damp = Math.pow(0.08, safeDt);
      s.vx *= damp;
      s.vy *= damp;

      // Bounds
      const minX = 60;
      const maxX = width - 60;
      const minY = 110;
      const maxY = height - 68;
      if (s.x < minX) {
        s.x = minX;
        s.vx = Math.abs(s.vx) * 0.5;
      } else if (s.x > maxX) {
        s.x = maxX;
        s.vx = -Math.abs(s.vx) * 0.5;
      }
      if (s.y < minY) {
        s.y = minY;
        s.vy = Math.abs(s.vy) * 0.5;
      } else if (s.y > maxY) {
        s.y = maxY;
        s.vy = -Math.abs(s.vy) * 0.5;
      }
    });

    // Elastic Player-to-Player Collisions (m1*v1 + m2*v2)
    const list = Array.from(this.sledders.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.radius + b.radius;
        if (dist > 0 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          const rvx = b.vx - a.vx;
          const rvy = b.vy - a.vy;
          const velAlongNormal = rvx * nx + rvy * ny;
          if (velAlongNormal < 0) {
            const impulse = -velAlongNormal * 1.2;
            a.vx -= nx * (impulse + 140);
            a.vy -= ny * (impulse + 140);
            b.vx += nx * (impulse + 140);
            b.vy += ny * (impulse + 140);
            this.audio.playBounce();
            this.emitFx((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, '#38bdf8', 10, 140);
          }
        }
      }
    }

    // Update Cavern Nodes & Falling Stalactites
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      n.pulse += safeDt * 5;
      n.fallTimer -= safeDt;

      if (n.type === 'falling_stalactite' && n.fallTimer <= 0) {
        // Stalactite crashes onto cavern floor!
        this.triggerScreenShake(7);
        this.audio.playExplosion();
        this.emitFx(n.x, n.y, '#7dd3fc', 16, 190);

        this.sledders.forEach((s) => {
          const d = Math.hypot(s.x - n.x, s.y - n.y);
          if (d < s.radius + n.radius + 8 && !this.isUnderdog(s)) {
            s.overchargeTimer = 1.1;
            s.combo = 1;
            s.score = Math.max(0, s.score - 25);
            const pushA = Math.atan2(s.y - n.y, s.x - n.x);
            s.vx += Math.cos(pushA) * 380;
            s.vy += Math.sin(pushA) * 380;
            this.addFloatingText(s.x, s.y - 24, '❄️ STALACTITE CRASH! -25', '#ef4444', 16);
          }
        });

        // Transform crashed stalactite into a mineable Sapphire Gem!
        n.type = 'sapphire_gem';
        n.radius = 16;
        n.fallTimer = 8.0;
        n.maxFallTimer = 8.0;
        continue;
      }

      // Passive touch collection or pickaxe strike
      let mined = false;
      this.sledders.forEach((s) => {
        if (mined || n.type === 'falling_stalactite') return;
        if (Math.hypot(s.x - n.x, s.y - n.y) < s.radius + n.radius) {
          mined = true;
          this.awardCrystal(s, n, false);
        }
      });

      if (mined || n.fallTimer <= 0) {
        this.nodes.splice(i, 1);
      }
    }

    // Update FX particles
    for (let i = this.fxParticles.length - 1; i >= 0; i--) {
      const p = this.fxParticles[i];
      p.life += safeDt;
      p.x += p.vx * safeDt;
      p.y += p.vy * safeDt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.life >= p.maxLife) {
        this.fxParticles.splice(i, 1);
      }
    }
  }

  private awardCrystal(s: CavernMiner, n: CavernNode, sweetBonus: boolean): void {
    const basePts = n.type === 'golden_diamond' ? 95 : 50;
    const mult = Math.min(4, s.combo);
    const total = basePts * mult + (sweetBonus ? 35 : 0);
    s.score += total;
    s.combo = Math.min(4, s.combo + 1);
    this.audio.playScore();
    const col = n.type === 'golden_diamond' ? '#facc15' : '#38bdf8';
    this.emitFx(n.x, n.y, col, 16, 180);
    this.addFloatingText(
      n.x,
      n.y - 22,
      n.type === 'golden_diamond' ? `💎 PERMAFROST DIAMOND! +${total}` : `⛏️ SAPPHIRE GEM! +${total}`,
      col,
      16
    );
  }

  private executePickaxeStrike(s: CavernMiner, range: number): void {
    s.swingAnim = 1.0;
    s.vx += Math.cos(s.angle) * 210;
    s.vy += Math.sin(s.angle) * 210;
    this.audio.playWhoosh();

    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      if (n.type === 'falling_stalactite') continue;
      if (Math.hypot(n.x - s.x, n.y - s.y) <= range) {
        this.awardCrystal(s, n, false);
        this.nodes.splice(i, 1);
      }
    }
  }

  private executeThermalShockwave(s: CavernMiner): void {
    s.swingAnim = 1.0;
    s.score += 85;
    s.combo = Math.min(4, s.combo + 1);

    this.hitStopTimer = 0.045;
    this.triggerScreenShake(12);
    this.audio.playBoost();
    this.emitFx(s.x, s.y, '#facc15', 22, 240);
    this.addFloatingText(s.x, s.y - 34, '⛏️ THERMAL SHOCKWAVE SMASH! +85', '#facc15', 18);

    // Shatter all crystals in wide 165px radius!
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      if (n.type === 'falling_stalactite') continue;
      if (Math.hypot(n.x - s.x, n.y - s.y) <= 165) {
        this.awardCrystal(s, n, true);
        this.nodes.splice(i, 1);
      }
    }

    // Frost-Wave Shunt blasts rival miners away!
    const underdog = this.isUnderdog(s);
    this.sledders.forEach((other) => {
      if (other.id === s.id) return;
      const dx = other.x - s.x;
      const dy = other.y - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 190) {
        const pushA = Math.atan2(dy, dx);
        const force = underdog ? 600 : 480;
        other.vx += Math.cos(pushA) * force;
        other.vy += Math.sin(pushA) * force;
        s.score += 70;
        this.addFloatingText(other.x, other.y - 26, '❄️ FROST-WAVE SHUNT! +70', '#38bdf8', 16);
      }
    });
  }

  private triggerPickJam(s: CavernMiner): void {
    s.isHolding = false;
    s.charge = 0;
    s.overchargeTimer = 1.15;
    s.combo = 1;
    this.triggerScreenShake(6);
    this.audio.playBuzzer();
    this.emitFx(s.x, s.y, '#ef4444', 14, 150);
    this.addFloatingText(s.x, s.y - 28, '⚠️ THERMAL OVERHEAT!', '#ef4444', 15);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const s = this.sledders.get(botId);
    if (!s || s.overchargeTimer > 0) return;

    s.botTimer -= dt;
    if (s.botTimer <= 0) {
      const delay = difficulty === 'bot_hard' ? 0.18 : difficulty === 'bot_normal' ? 0.28 : 0.42;
      s.botTimer = delay + Math.random() * 0.1;

      let bestNode: CavernNode | null = null;
      let bestScore = -9999;
      for (const n of this.nodes) {
        if (n.type === 'falling_stalactite') continue;
        const d = Math.hypot(n.x - s.x, n.y - s.y);
        const val = (n.type === 'golden_diamond' ? 280 : 150) - d * 0.5;
        if (val > bestScore) {
          bestScore = val;
          bestNode = n;
        }
      }

      if (bestNode) {
        s.botTargetX = bestNode.x;
        s.botTargetY = bestNode.y;
        if (Math.hypot(bestNode.x - s.x, bestNode.y - s.y) < 120 && !s.isHolding) {
          if (Math.random() < (difficulty === 'bot_hard' ? 0.5 : 0.3)) {
            s.isHolding = true;
            s.charge = 0;
            s.botHoldTarget = 0.76 + Math.random() * 0.18;
          } else {
            this.executePickaxeStrike(s, 72);
          }
        }
      } else {
        s.botTargetX = width * 0.5;
        s.botTargetY = height * 0.55;
      }
    }

    const dx = s.botTargetX - s.x;
    const dy = s.botTargetY - s.y;
    const d = Math.hypot(dx, dy);
    if (d > 10) {
      const aimA = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.14;
      s.angle = aimA;
      const spd = difficulty === 'bot_hard' ? 720 : difficulty === 'bot_normal' ? 620 : 520;
      s.vx += Math.cos(aimA) * spd * dt;
      s.vy += Math.sin(aimA) * spd * dt;
    }

    if (s.isHolding) {
      s.charge += dt * 0.85;
      if (s.charge >= s.botHoldTarget) {
        s.isHolding = false;
        if (s.charge >= 0.72 && s.charge <= 0.98) {
          this.executeThermalShockwave(s);
        } else {
          this.executePickaxeStrike(s, 72);
        }
        s.charge = 0;
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.sledders.forEach((s, id) => scores.set(id, Math.floor(s.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.sledders.entries())
      .map(([playerId, s]) => ({ playerId, score: Math.floor(s.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });

    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    const winnerName = winnerId ? this.getPlayer(winnerId)?.name ?? winnerId : 'Nobody';

    return {
      winnerId,
      rankings,
      mvpHighlight: `${winnerName} mined the Permafrost Diamonds of Frostbite Cavern!`,
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex] ?? THEMES[0];

    ctx.save();
    this.applyScreenShake(ctx);

    // 1. Sub-Glacial Crystal Cavern Background
    ctx.fillStyle = theme.wallTop;
    ctx.fillRect(0, 0, width, 96);

    const floorGrad = ctx.createLinearGradient(0, 96, 0, height);
    floorGrad.addColorStop(0, theme.floorTop);
    floorGrad.addColorStop(1, theme.floorBottom);
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, 96, width, height - 96);

    // Hanging ceiling icicles
    ctx.fillStyle = theme.crystalPrimary;
    for (let x = 35; x < width; x += 65) {
      ctx.beginPath();
      ctx.moveTo(x - 14, 42);
      ctx.lineTo(x, 88);
      ctx.lineTo(x + 14, 42);
      ctx.closePath();
      ctx.fill();
    }

    // 2. Render Crystals & Falling Stalactite Warning Shadows
    for (const n of this.nodes) {
      ctx.save();
      ctx.translate(n.x, n.y);

      if (n.type === 'falling_stalactite') {
        const progress = 1 - Math.max(0, n.fallTimer / n.maxFallTimer);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.beginPath();
        ctx.arc(0, 0, n.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, n.radius * (1 - progress * 0.7), 0, Math.PI * 2);
        ctx.stroke();

        // Falling ice spike descending from ceiling
        const spikeY = -180 * (1 - progress);
        ctx.fillStyle = '#bae6fd';
        ctx.beginPath();
        ctx.moveTo(-12, spikeY - 36);
        ctx.lineTo(0, spikeY);
        ctx.lineTo(12, spikeY - 36);
        ctx.closePath();
        ctx.fill();
      } else if (n.type === 'golden_diamond') {
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(15, 0);
        ctx.lineTo(0, 18);
        ctx.lineTo(-15, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Sapphire Frost Gem Cluster
        ctx.fillStyle = theme.crystalPrimary;
        ctx.beginPath();
        ctx.moveTo(0, -17);
        ctx.lineTo(13, 6);
        ctx.lineTo(-13, 6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Render 2.5D Thermal Pickaxe Sleds & Miners
    this.sledders.forEach((s, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#38bdf8';
      const underdog = this.isUnderdog(s);

      ctx.save();
      ctx.translate(s.x, s.y);

      if (s.isHolding && s.charge > 0.04) {
        const ringR = s.radius + 11;
        const inSweet = s.charge >= 0.72 && s.charge <= 0.98;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, -Math.PI * 0.5 + 0.72 * Math.PI * 2, -Math.PI * 0.5 + 0.98 * Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = inSweet ? '#facc15' : color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, -Math.PI * 0.5, -Math.PI * 0.5 + Math.min(1, s.charge) * Math.PI * 2);
        ctx.stroke();
      }

      if (underdog) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Miner Sled Chassis
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 2, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Thermal Pickaxe Swing
      ctx.save();
      ctx.rotate(s.angle + (s.swingAnim > 0 ? Math.sin(s.swingAnim * Math.PI) * 1.2 : 0));
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(30, 0);
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.fillRect(26, -8, 6, 16);
      ctx.restore();

      const mood: CharacterMood =
        s.overchargeTimer > 0
          ? 'shocked'
          : s.swingAnim > 0
          ? 'triumph'
          : s.isHolding
          ? 'focused'
          : 'happy';
      this.drawPlayerMascot(ctx, pId, 0, -2, 15, mood, this.elapsed, 0);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${Math.floor(s.score)}`, 0, -28);

      ctx.restore();
    });

    // 4. FX Particles
    for (const p of this.fxParticles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    this.renderFloatingTexts(ctx);

    // 5. Top Control Banner
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 295, 12, 590, 30, 15);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '⛏️ Steer: Skate Cavern • Tap: Thermal Pickaxe • Hold (72–98%): Shockwave Smash & Shunt!',
      width * 0.5,
      31
    );

    // 6. Clickable Bottom-Left Theme Pill
    const px = 20;
    const py = height - 44;
    const pw = 170;
    const ph = 32;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 16);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎨 ${theme.name} [T]`, px + pw * 0.5, py + 20);

    ctx.restore();
  }

  private addFloatingText(x: number, y: number, text: string, color: string, size = 16): void {
    this.floatingTexts.push({ x, y, text, color, alpha: 1, vy: -38, size });
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.alpha));
      ctx.font = `900 ${ft.size}px "Outfit", system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(2, 6, 23, 0.9)";
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

}
