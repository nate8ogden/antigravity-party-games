import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { CharacterMood } from '../core/CharacterRenderer';

interface AuroraTheme {
  id: string;
  name: string;
  skyTop: string;
  skyBottom: string;
  ribbonPrimary: string;
  ribbonSecondary: string;
  accent: string;
}

const THEMES: AuroraTheme[] = [
  {
    id: 'tromso_aurora',
    name: 'Tromso Emerald Sky',
    skyTop: '#020617',
    skyBottom: '#0f172a',
    ribbonPrimary: 'rgba(16, 185, 129, 0.36)',
    ribbonSecondary: 'rgba(168, 85, 247, 0.32)',
    accent: '#34d399',
  },
  {
    id: 'solar_magenta',
    name: 'Solar Flare Magenta',
    skyTop: '#090514',
    skyBottom: '#1e1b4b',
    ribbonPrimary: 'rgba(236, 72, 153, 0.36)',
    ribbonSecondary: 'rgba(56, 189, 248, 0.32)',
    accent: '#f472b6',
  },
  {
    id: 'celestial_gold',
    name: 'Hyperborea Crown',
    skyTop: '#041019',
    skyBottom: '#082f49',
    ribbonPrimary: 'rgba(250, 204, 21, 0.34)',
    ribbonSecondary: 'rgba(45, 212, 191, 0.32)',
    accent: '#facc15',
  },
];

interface SkyMote {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'star_mote' | 'golden_prism' | 'storm_cloud';
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

interface PrismGlider {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  score: number;
  combo: number;
  auroraCharge: number;
  isHolding: boolean;
  charge: number;
  overchargeTimer: number;
  boostTimer: number;
  baskAccum: number;
  botTimer: number;
  botTargetX: number;
  botTargetY: number;
  botHoldTarget: number;
}

export class AuroraCollectorGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  public gliders: Map<PlayerId, PrismGlider> = new Map();
  private motes: SkyMote[] = [];
  private fxParticles: FxParticle[] = [];
  private nextMoteId = 1;
  private moteSpawnTimer = 0.6;

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
    return THEMES[this.themeIndex]?.name ?? 'Tromso Emerald Sky';
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
    this.motes = [];
    this.fxParticles = [];
    this.gliders.clear();

    const active = this.getActivePlayers();
    const count = Math.max(1, active.length);
    active.forEach((p, idx) => {
      const sx = width * (0.22 + (idx / Math.max(1, count - 1 || 1)) * 0.45);
      const sy = height * (0.38 + (idx % 2) * 0.16);
      this.gliders.set(p.id, {
        id: p.id,
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        angle: 0,
        radius: 22,
        score: 0,
        combo: 1,
        auroraCharge: 0,
        isHolding: false,
        charge: 0,
        overchargeTimer: 0,
        boostTimer: 0,
        baskAccum: 0,
        botTimer: 0.2 + Math.random() * 0.2,
        botTargetX: width * 0.5,
        botTargetY: height * 0.5,
        botHoldTarget: 0,
      });
    });

    for (let i = 0; i < 6; i++) {
      this.spawnMote(width, height, true);
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

  private getAuroraY(x: number, height: number, secondary = false): number {
    const phase = secondary ? 1.15 : 0;
    return (
      height * 0.48 +
      Math.sin(this.elapsed * 2.1 + x * 0.0085 + phase) * 85 +
      Math.cos(this.elapsed * 1.2 - x * 0.004 + phase) * 35
    );
  }

  private spawnMote(width: number, height: number, randomX = false): void {
    const roll = Math.random();
    const type: SkyMote['type'] =
      roll < (this.suddenDeath ? 0.32 : 0.22)
        ? 'golden_prism'
        : roll < 0.78
        ? 'star_mote'
        : 'storm_cloud';

    const sx = randomX ? width * (0.25 + Math.random() * 0.7) : width + 36;
    const sy = height * (0.2 + Math.random() * 0.58);
    this.motes.push({
      id: this.nextMoteId++,
      x: sx,
      y: sy,
      vx: -(125 + Math.random() * 65) * (this.suddenDeath ? 1.25 : 1.0),
      vy: (Math.random() - 0.5) * 28,
      type,
      radius: type === 'golden_prism' ? 16 : type === 'storm_cloud' ? 18 : 13,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  private getMaxScore(): number {
    let max = 0;
    this.gliders.forEach((g) => {
      if (g.score > max) max = g.score;
    });
    return max;
  }

  private isUnderdog(g: PrismGlider): boolean {
    return this.getMaxScore() - g.score >= 150;
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
      this.triggerScreenShake(10);
      this.audio.playExplosion();
      this.addFloatingText(width * 0.5, height * 0.2, '⚡ SUDDEN DEATH: SOLAR SUPER-STORM! ⚡', '#facc15', 22);
    }

    this.moteSpawnTimer -= safeDt;
    if (this.moteSpawnTimer <= 0) {
      this.moteSpawnTimer = this.suddenDeath ? 0.55 : 0.85;
      if (this.motes.length < 12) {
        this.spawnMote(width, height, false);
      }
    }

    this.updateBots(safeDt, width, height);

    // Update Gliders
    this.gliders.forEach((g) => {
      const p = this.getPlayer(g.id);
      if (g.overchargeTimer > 0) g.overchargeTimer = Math.max(0, g.overchargeTimer - safeDt);
      if (g.boostTimer > 0) g.boostTimer = Math.max(0, g.boostTimer - safeDt);

      const underdog = this.isUnderdog(g);
      const speedMult = (underdog ? 1.18 : 1.0) * (g.overchargeTimer > 0 ? 0.55 : 1.0);

      if (p && !p.type.startsWith('bot_')) {
        const move = { x: this.input.getSteer(g.id), y: -this.input.getThrottle(g.id) };
        if (Math.hypot(move.x, move.y) > 0.08) {
          g.vx += move.x * 780 * speedMult * safeDt;
          g.vy += move.y * 780 * speedMult * safeDt;
          g.angle = Math.atan2(move.y, move.x) * 0.35;
        } else {
          // Gentle gravity glide when not steering vertically
          g.vy += 120 * safeDt;
          g.angle *= Math.pow(0.08, safeDt);
        }

        const holding = this.input.isActionPressed(g.id) || this.input.isPressed(g.id);
        if (holding && g.overchargeTimer <= 0) {
          g.isHolding = true;
          g.charge = Math.min(1.15, g.charge + safeDt * 0.85);
          if (g.charge >= 1.05) {
            this.triggerPrismOverload(g);
          }
        } else if (g.isHolding) {
          g.isHolding = false;
          if (g.charge >= 0.72 && g.charge <= 0.98) {
            this.executePrismNova(g);
          } else {
            this.executeWingGust(g);
          }
          g.charge = 0;
        } else if (this.input.justPressed(g.id) || this.input.justAction(g.id)) {
          this.executeWingGust(g);
        }
      }

      g.x += g.vx * safeDt;
      g.y += g.vy * safeDt;
      const damp = Math.pow(0.09, safeDt);
      g.vx *= damp;
      g.vy *= damp;

      // Keep inside sky bounds
      const minX = 60;
      const maxX = width - 60;
      const minY = 75;
      const maxY = height - 70;
      if (g.x < minX) {
        g.x = minX;
        g.vx = Math.abs(g.vx) * 0.5;
      } else if (g.x > maxX) {
        g.x = maxX;
        g.vx = -Math.abs(g.vx) * 0.5;
      }
      if (g.y < minY) {
        g.y = minY;
        g.vy = Math.abs(g.vy) * 0.5;
      } else if (g.y > maxY) {
        g.y = maxY;
        g.vy = -Math.abs(g.vy) * 0.5;
      }

      // Check if surfing inside Aurora Borealis Ribbon
      const ribbonY1 = this.getAuroraY(g.x, height, false);
      const ribbonY2 = this.getAuroraY(g.x, height, true);
      const distRibbon = Math.min(Math.abs(g.y - ribbonY1), Math.abs(g.y - ribbonY2));

      if (distRibbon < 52) {
        g.baskAccum += safeDt * (this.suddenDeath ? 26 : 18);
        if (g.baskAccum >= 10) {
          const pts = Math.floor(g.baskAccum);
          g.score += pts;
          g.baskAccum -= pts;
        }
        g.auroraCharge = Math.min(100, g.auroraCharge + 40 * safeDt);
        if (g.auroraCharge >= 100) {
          g.auroraCharge = 0;
          const burst = 55 * Math.min(4, g.combo);
          g.score += burst;
          g.combo = Math.min(4, g.combo + 1);
          this.audio.playScore();
          this.emitFx(g.x, g.y, '#34d399', 14, 170);
          this.addFloatingText(g.x, g.y - 26, `✨ AURORA HARMONY! +${burst}`, '#34d399', 16);
        }
      } else {
        g.auroraCharge = Math.max(0, g.auroraCharge - 18 * safeDt);
      }
    });

    // Elastic Glider-to-Glider Collisions (m1*v1 + m2*v2)
    const list = Array.from(this.gliders.values());
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
            a.vx -= nx * (impulse + 135);
            a.vy -= ny * (impulse + 135);
            b.vx += nx * (impulse + 135);
            b.vy += ny * (impulse + 135);
            this.audio.playBounce();
            this.emitFx((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, '#a855f7', 10, 140);
          }
        }
      }
    }

    // Update Motes & Collisions
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      m.pulse += safeDt * 5;
      m.x += m.vx * safeDt;
      m.y += m.vy * safeDt;

      let collected = false;
      this.gliders.forEach((g) => {
        if (collected) return;
        const d = Math.hypot(g.x - m.x, g.y - m.y);
        if (d < g.radius + m.radius) {
          collected = true;
          if (m.type === 'storm_cloud') {
            if (g.boostTimer <= 0 && !this.isUnderdog(g)) {
              g.overchargeTimer = 1.1;
              g.combo = 1;
              g.score = Math.max(0, g.score - 25);
              g.vy += 260;
              this.triggerScreenShake(7);
              this.audio.playExplosion();
              this.emitFx(m.x, m.y, '#ef4444', 16, 180);
              this.addFloatingText(m.x, m.y - 20, '⛈️ STORM BOLT! -25', '#ef4444', 16);
            } else {
              g.score += 35;
              this.emitFx(m.x, m.y, '#38bdf8', 12, 150);
              this.addFloatingText(m.x, m.y - 20, '🛡️ PRISM SHIELD! +35', '#38bdf8', 15);
            }
          } else {
            const basePts = m.type === 'golden_prism' ? 90 : 45;
            const mult = Math.min(4, g.combo);
            const total = basePts * mult;
            g.score += total;
            g.combo = Math.min(4, g.combo + 1);
            this.audio.playScore();
            const col = m.type === 'golden_prism' ? '#facc15' : '#38bdf8';
            this.emitFx(m.x, m.y, col, 14, 160);
            this.addFloatingText(
              m.x,
              m.y - 20,
              m.type === 'golden_prism' ? `💎 SOLAR PRISM! +${total}` : `⭐ STAR MOTE! +${total}`,
              col,
              16
            );
          }
        }
      });

      if (collected || m.x < -50) {
        this.motes.splice(i, 1);
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

  private executeWingGust(g: PrismGlider): void {
    g.vy -= 220;
    g.vx += 140;
    g.boostTimer = 0.35;
    this.audio.playWhoosh();
    this.emitFx(g.x - 16, g.y + 6, '#34d399', 8, 120);
  }

  private executePrismNova(g: PrismGlider): void {
    g.boostTimer = 0.75;
    g.score += 85;
    g.combo = Math.min(4, g.combo + 1);

    this.hitStopTimer = 0.045;
    this.triggerScreenShake(11);
    this.audio.playBoost();
    this.emitFx(g.x, g.y, '#facc15', 22, 240);
    this.addFloatingText(g.x, g.y - 34, '🌈 PRISM NOVA SURGE! +85', '#facc15', 18);

    // Vacuum nearby Star Motes & Golden Prisms toward this glider
    for (const m of this.motes) {
      if (m.type === 'storm_cloud') continue;
      const d = Math.hypot(m.x - g.x, m.y - g.y);
      if (d < 240) {
        const pullA = Math.atan2(g.y - m.y, g.x - m.x);
        m.vx = Math.cos(pullA) * 380;
        m.vy = Math.sin(pullA) * 380;
      }
    }

    // Aurora Wave Shunt knocks nearby rival gliders out of the ribbon!
    const underdog = this.isUnderdog(g);
    this.gliders.forEach((other) => {
      if (other.id === g.id) return;
      const dx = other.x - g.x;
      const dy = other.y - g.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 190) {
        const pushA = Math.atan2(dy, dx);
        const force = underdog ? 600 : 480;
        other.vx += Math.cos(pushA) * force;
        other.vy += Math.sin(pushA) * force;
        g.score += 70;
        this.addFloatingText(other.x, other.y - 26, '✨ AURORA WAVE SHUNT! +70', '#34d399', 16);
      }
    });
  }

  private triggerPrismOverload(g: PrismGlider): void {
    g.isHolding = false;
    g.charge = 0;
    g.overchargeTimer = 1.2;
    g.combo = 1;
    this.triggerScreenShake(6);
    this.audio.playBuzzer();
    this.emitFx(g.x, g.y, '#ef4444', 14, 150);
    this.addFloatingText(g.x, g.y - 28, '⚠️ PRISM OVERLOAD!', '#ef4444', 15);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const g = this.gliders.get(botId);
    if (!g || g.overchargeTimer > 0) return;

    g.botTimer -= dt;
    if (g.botTimer <= 0) {
      const delay = difficulty === 'bot_hard' ? 0.18 : difficulty === 'bot_normal' ? 0.28 : 0.42;
      g.botTimer = delay + Math.random() * 0.1;

      const blunder =
        difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.12 : 0.03;

      let bestMote: SkyMote | null = null;
      let bestScore = -9999;
      for (const m of this.motes) {
        if (m.type === 'storm_cloud' && Math.random() > blunder) continue;
        const d = Math.hypot(m.x - g.x, m.y - g.y);
        const val = (m.type === 'golden_prism' ? 280 : 150) - d * 0.55;
        if (val > bestScore) {
          bestScore = val;
          bestMote = m;
        }
      }

      if (bestMote && bestScore > 20) {
        g.botTargetX = Math.max(90, Math.min(width - 90, bestMote.x));
        g.botTargetY = bestMote.y;
      } else {
        g.botTargetX = width * 0.42;
        g.botTargetY = this.getAuroraY(g.x, height, false);
      }

      if (!g.isHolding && Math.random() < (difficulty === 'bot_hard' ? 0.45 : 0.25)) {
        g.isHolding = true;
        g.charge = 0;
        g.botHoldTarget = 0.76 + Math.random() * 0.18;
      }
    }

    const dx = g.botTargetX - g.x;
    const dy = g.botTargetY - g.y;
    const d = Math.hypot(dx, dy);
    if (d > 10) {
      const aimA = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.14;
      const spd = difficulty === 'bot_hard' ? 720 : difficulty === 'bot_normal' ? 620 : 520;
      g.vx += Math.cos(aimA) * spd * dt;
      g.vy += Math.sin(aimA) * spd * dt;
      g.angle = Math.sin(aimA) * 0.3;
    }

    if (g.isHolding) {
      g.charge += dt * 0.85;
      if (g.charge >= g.botHoldTarget) {
        g.isHolding = false;
        if (g.charge >= 0.72 && g.charge <= 0.98) {
          this.executePrismNova(g);
        } else {
          this.executeWingGust(g);
        }
        g.charge = 0;
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.gliders.forEach((g, id) => scores.set(id, Math.floor(g.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.gliders.entries())
      .map(([playerId, g]) => ({ playerId, score: Math.floor(g.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });

    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    const winnerName = winnerId ? this.getPlayer(winnerId)?.name ?? winnerId : 'Nobody';

    return {
      winnerId,
      rankings,
      mvpHighlight: `${winnerName} wove the Northern Lights into a Celestial Prism Crown!`,
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex] ?? THEMES[0];

    ctx.save();
    this.applyScreenShake(ctx);

    // 1. Starry Night Arctic Sky
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.skyTop);
    bgGrad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Twinkling stars
    for (let i = 0; i < 45; i++) {
      const sx = ((i * 89 + Math.floor(this.elapsed * 12)) % width + width) % width;
      const sy = (i * 47) % (height * 0.82);
      const alpha = 0.35 + 0.5 * Math.sin(this.elapsed * 3 + i);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
      ctx.fillRect(sx, sy, 2, 2);
    }

    // 2. Flowing Multi-Layered 2.5D Aurora Borealis Ribbons
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = theme.ribbonPrimary;
    ctx.lineWidth = 68;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 24) {
      const y = this.getAuroraY(x, height, false);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = theme.ribbonSecondary;
    ctx.lineWidth = 42;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 24) {
      const y = this.getAuroraY(x, height, true);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    // Snowy Fjord Mountain Silhouettes along bottom
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, height - 48);
    ctx.lineTo(width * 0.2, height - 76);
    ctx.lineTo(width * 0.42, height - 44);
    ctx.lineTo(width * 0.68, height - 82);
    ctx.lineTo(width * 0.88, height - 52);
    ctx.lineTo(width, height - 70);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // 3. Render Star Motes, Golden Solar Prisms, & Geomagnetic Storm Clouds
    for (const m of this.motes) {
      ctx.save();
      ctx.translate(m.x, m.y + Math.sin(m.pulse) * 4);

      if (m.type === 'golden_prism') {
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(14, 0);
        ctx.lineTo(0, 16);
        ctx.lineTo(-14, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (m.type === 'star_mote') {
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Geomagnetic Storm Cloud
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(-6, 0, 12, 0, Math.PI * 2);
        ctx.arc(6, -2, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(2, 4);
        ctx.lineTo(-4, 13);
        ctx.lineTo(3, 13);
        ctx.lineTo(-2, 22);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Render 2.5D Celestial Prism Gliders
    this.gliders.forEach((g, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#38bdf8';
      const underdog = this.isUnderdog(g);

      ctx.save();
      ctx.translate(g.x, g.y);

      // Hold-to-charge ring (72%-98% Sweet Spot)
      if (g.isHolding && g.charge > 0.04) {
        const ringR = g.radius + 11;
        const inSweet = g.charge >= 0.72 && g.charge <= 0.98;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
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
        ctx.arc(0, 0, ringR, -Math.PI * 0.5, -Math.PI * 0.5 + Math.min(1, g.charge) * Math.PI * 2);
        ctx.stroke();
      }

      if (underdog) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, g.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.save();
      ctx.rotate(g.angle);

      // 2.5D Swept Crystal Wings
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-22, 12);
      ctx.lineTo(26, 0);
      ctx.lineTo(-22, -12);
      ctx.lineTo(-12, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      const mood: CharacterMood =
        g.overchargeTimer > 0
          ? 'shocked'
          : g.boostTimer > 0
          ? 'triumph'
          : g.isHolding
          ? 'focused'
          : 'happy';
      this.drawPlayerMascot(ctx, pId, -2, -2, 14, mood, this.elapsed, 0);
      ctx.restore();

      // Aurora Prism Charge Bar above glider
      const barW = 36;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(-barW * 0.5, -26, barW, 5);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(-barW * 0.5, -26, (barW * g.auroraCharge) / 100, 5);

      // Score Tag
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${Math.floor(g.score)}`, 0, -32);

      ctx.restore();
    });

    // 5. FX Particles
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

    // 6. Top Control Banner
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
      '✨ Steer: Surf Aurora Ribbons • Tap: Wing Gust • Hold (72–98%): Prism Nova & Wave Shunt!',
      width * 0.5,
      31
    );

    // 7. Clickable Bottom-Left Theme Pill
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
