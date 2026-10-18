import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { CharacterMood } from '../core/CharacterRenderer';

interface FishingTheme {
  id: string;
  name: string;
  skyTop: string;
  iceTop: string;
  iceCrack: string;
  holeWater: string;
  holeRim: string;
  accent: string;
}

const THEMES: FishingTheme[] = [
  {
    id: 'inuit_bay',
    name: 'Inuit Sapphire Bay',
    skyTop: '#0b192c',
    iceTop: '#e0f2fe',
    iceCrack: '#bae6fd',
    holeWater: '#082f49',
    holeRim: '#38bdf8',
    accent: '#0ea5e9',
  },
  {
    id: 'emerald_fjord',
    name: 'Aurora Fjord Lagoon',
    skyTop: '#042f2e',
    iceTop: '#ecfdf5',
    iceCrack: '#a7f3d0',
    holeWater: '#064e3b',
    holeRim: '#10b981',
    accent: '#34d399',
  },
  {
    id: 'twilight_trench',
    name: 'Polar Twilight Trench',
    skyTop: '#1e1b4b',
    iceTop: '#ede9fe',
    iceCrack: '#c4b5fd',
    holeWater: '#1e1b4b',
    holeRim: '#8b5cf6',
    accent: '#a78bfa',
  },
];

interface IceHole {
  id: number;
  x: number;
  y: number;
  fishType: 'none' | 'arctic_char' | 'king_crab' | 'golden_narwhal' | 'electric_eel';
  timer: number;
  maxTimer: number;
  fishAngle: number;
  ripple: number;
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

interface AnglerPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  score: number;
  combo: number;
  catches: number;
  isHolding: boolean;
  charge: number;
  overchargeTimer: number;
  castAnim: number;
  castTargetX: number;
  castTargetY: number;
  botTimer: number;
  botTargetX: number;
  botTargetY: number;
  botHoldTarget: number;
}

export class PolarIceFishingGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  public fishers: Map<PlayerId, AnglerPlayer> = new Map();
  private holes: IceHole[] = [];
  private fxParticles: FxParticle[] = [];

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
    return THEMES[this.themeIndex]?.name ?? 'Inuit Sapphire Bay';
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
    this.holes = [];
    this.fxParticles = [];
    this.fishers.clear();

    // Create 6 shared augered ice holes arranged in 2 rows of 3
    const cols = 3;
    const rows = 2;
    let id = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hx = width * (0.24 + c * 0.26);
        const hy = height * (0.38 + r * 0.30);
        this.holes.push({
          id: id++,
          x: hx,
          y: hy,
          fishType: c === 1 && r === 0 ? 'golden_narwhal' : 'arctic_char',
          timer: 2.5 + Math.random() * 2.0,
          maxTimer: 3.5,
          fishAngle: Math.random() * Math.PI * 2,
          ripple: 0,
        });
      }
    }

    const active = this.getActivePlayers();
    const count = Math.max(1, active.length);
    active.forEach((p, idx) => {
      const sx = width * (0.25 + (idx / Math.max(1, count - 1 || 1)) * 0.5);
      const sy = height * 0.53;
      this.fishers.set(p.id, {
        id: p.id,
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        angle: 0,
        radius: 22,
        score: 0,
        combo: 1,
        catches: 0,
        isHolding: false,
        charge: 0,
        overchargeTimer: 0,
        castAnim: 0,
        castTargetX: sx,
        castTargetY: sy,
        botTimer: 0.2 + Math.random() * 0.2,
        botTargetX: sx,
        botTargetY: sy,
        botHoldTarget: 0,
      });
    });
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

  private getMaxScore(): number {
    let max = 0;
    this.fishers.forEach((f) => {
      if (f.score > max) max = f.score;
    });
    return max;
  }

  private isUnderdog(f: AnglerPlayer): boolean {
    return this.getMaxScore() - f.score >= 150;
  }

  private spawnNextFishInHole(h: IceHole): void {
    const roll = Math.random();
    if (h.fishType === 'none') {
      if (roll < (this.suddenDeath ? 0.34 : 0.20)) {
        h.fishType = 'golden_narwhal';
        h.maxTimer = 2.8;
      } else if (roll < 0.55) {
        h.fishType = 'king_crab';
        h.maxTimer = 3.4;
      } else if (roll < 0.84) {
        h.fishType = 'arctic_char';
        h.maxTimer = 3.8;
      } else {
        h.fishType = 'electric_eel';
        h.maxTimer = 2.6;
      }
      h.timer = h.maxTimer;
      h.ripple = 1.0;
    } else {
      h.fishType = 'none';
      h.maxTimer = this.suddenDeath ? 0.8 : 1.3 + Math.random() * 0.9;
      h.timer = h.maxTimer;
    }
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
      this.addFloatingText(width * 0.5, height * 0.2, '⚡ SUDDEN DEATH: NARWHAL FRENZY! ⚡', '#facc15', 22);
    }

    // Update ice holes
    for (const h of this.holes) {
      h.fishAngle += safeDt * (h.fishType === 'golden_narwhal' ? 3.4 : 2.2);
      if (h.ripple > 0) h.ripple = Math.max(0, h.ripple - safeDt * 2);
      h.timer -= safeDt;
      if (h.timer <= 0) {
        this.spawnNextFishInHole(h);
      }
    }

    this.updateBots(safeDt, width, height);

    // Update anglers
    this.fishers.forEach((f) => {
      const p = this.getPlayer(f.id);
      if (f.overchargeTimer > 0) f.overchargeTimer = Math.max(0, f.overchargeTimer - safeDt);
      if (f.castAnim > 0) f.castAnim = Math.max(0, f.castAnim - safeDt * 3.2);

      const underdog = this.isUnderdog(f);
      const speedMult = (underdog ? 1.18 : 1.0) * (f.overchargeTimer > 0 ? 0.5 : 1.0);

      if (p && !p.type.startsWith('bot_')) {
        const hasSteer = this.input.hasSteer(f.id);
        const move = { x: this.input.getSteer(f.id), y: -this.input.getThrottle(f.id) };
        if (Math.hypot(move.x, move.y) > 0.08) {
          f.vx += move.x * 760 * speedMult * safeDt;
          f.vy += move.y * 760 * speedMult * safeDt;
          f.angle = Math.atan2(move.y, move.x);
        } else if (!hasSteer && this.input.isPressed(f.id) && f.charge === 0) {
          f.vx += Math.cos(f.angle) * 480 * speedMult * safeDt;
          f.vy += Math.sin(f.angle) * 480 * speedMult * safeDt;
        }

        const holding = this.input.isActionPressed(f.id) || (!hasSteer && this.input.isPressed(f.id));
        if (holding && f.overchargeTimer <= 0) {
          f.isHolding = true;
          f.charge = Math.min(1.15, f.charge + safeDt * 0.85);
          if (f.charge >= 1.05) {
            this.triggerLineSnap(f);
          }
        } else if (f.isHolding) {
          f.isHolding = false;
          if (f.charge >= 0.72 && f.charge <= 0.98) {
            this.executeMasterTrenchHaul(f);
          } else {
            this.executeHookStrike(f, false);
          }
          f.charge = 0;
        } else if (this.input.justAction(f.id) || (!hasSteer && this.input.justPressed(f.id))) {
          this.executeHookStrike(f, false);
        }
      }

      // Slippery ice physics
      f.x += f.vx * safeDt;
      f.y += f.vy * safeDt;
      const damp = Math.pow(0.08, safeDt);
      f.vx *= damp;
      f.vy *= damp;

      // Keep inside ice rink bounds
      const minX = 65;
      const maxX = width - 65;
      const minY = 120;
      const maxY = height - 75;
      if (f.x < minX) {
        f.x = minX;
        f.vx = Math.abs(f.vx) * 0.6;
      } else if (f.x > maxX) {
        f.x = maxX;
        f.vx = -Math.abs(f.vx) * 0.6;
      }
      if (f.y < minY) {
        f.y = minY;
        f.vy = Math.abs(f.vy) * 0.6;
      } else if (f.y > maxY) {
        f.y = maxY;
        f.vy = -Math.abs(f.vy) * 0.6;
      }
    });

    // Elastic Player-to-Player Collisions (m1*v1 + m2*v2)
    const list = Array.from(this.fishers.values());
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
            const impulse = -velAlongNormal * 1.15;
            a.vx -= nx * (impulse + 120);
            a.vy -= ny * (impulse + 120);
            b.vx += nx * (impulse + 120);
            b.vy += ny * (impulse + 120);
            this.audio.playBounce();
            this.emitFx((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, '#e0f2fe', 8, 120);
          }
        }
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

  private findNearestHole(x: number, y: number, maxRange: number): IceHole | null {
    let best: IceHole | null = null;
    let bestDist = maxRange;
    for (const h of this.holes) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = h;
      }
    }
    return best;
  }

  private executeHookStrike(f: AnglerPlayer, isSweetSpot: boolean): void {
    const hole = this.findNearestHole(f.x, f.y, isSweetSpot ? 175 : 115);
    if (!hole) {
      // Quick ice dash toward facing direction when away from a hole
      f.vx += Math.cos(f.angle) * 280;
      f.vy += Math.sin(f.angle) * 280;
      this.audio.playWhoosh();
      return;
    }

    f.castAnim = 1.0;
    f.castTargetX = hole.x;
    f.castTargetY = hole.y;
    hole.ripple = 1.0;

    if (hole.fishType === 'none') {
      this.audio.playTone(220, 0.08, 'triangle');
      this.addFloatingText(hole.x, hole.y - 24, 'EMPTY HOLE!', '#94a3b8', 14);
      return;
    }

    if (hole.fishType === 'electric_eel' && !isSweetSpot && !this.isUnderdog(f)) {
      hole.fishType = 'none';
      hole.timer = 1.0;
      f.overchargeTimer = 1.25;
      f.combo = 1;
      f.score = Math.max(0, f.score - 25);
      this.triggerScreenShake(8);
      this.audio.playBuzzer();
      this.emitFx(hole.x, hole.y, '#38bdf8', 18, 190);
      this.addFloatingText(hole.x, hole.y - 28, '⚡ ELECTRIC EEL SHOCK! -25', '#38bdf8', 16);
      return;
    }

    // Successful catch!
    const basePts =
      hole.fishType === 'golden_narwhal'
        ? 95
        : hole.fishType === 'king_crab'
        ? 70
        : 45;
    const mult = Math.min(4, f.combo);
    const total = basePts * mult + (isSweetSpot ? 55 : 0);
    f.score += total;
    f.combo = Math.min(4, f.combo + 1);
    f.catches++;

    const label =
      hole.fishType === 'golden_narwhal'
        ? `🦄 GOLDEN NARWHAL! +${total}`
        : hole.fishType === 'king_crab'
        ? `🦀 RUBY KING CRAB! +${total}`
        : `🐟 ARCTIC CHAR! +${total}`;
    const col =
      hole.fishType === 'golden_narwhal'
        ? '#facc15'
        : hole.fishType === 'king_crab'
        ? '#fb7185'
        : '#34d399';

    hole.fishType = 'none';
    hole.timer = this.suddenDeath ? 0.75 : 1.2;

    this.hitStopTimer = 0.04;
    this.triggerScreenShake(7);
    this.audio.playScore();
    this.emitFx(hole.x, hole.y, col, 18, 190);
    this.addFloatingText(hole.x, hole.y - 28, label, col, 17);
  }

  private executeMasterTrenchHaul(f: AnglerPlayer): void {
    this.executeHookStrike(f, true);
    this.hitStopTimer = 0.045;
    this.triggerScreenShake(11);
    this.audio.playBoost();
    this.emitFx(f.x, f.y, '#facc15', 20, 220);

    // Ice-Crack Shunt knocks nearby rival anglers away from the fishing hole!
    const underdog = this.isUnderdog(f);
    this.fishers.forEach((other) => {
      if (other.id === f.id) return;
      const dx = other.x - f.x;
      const dy = other.y - f.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 185) {
        const pushA = Math.atan2(dy, dx);
        const force = underdog ? 620 : 500;
        other.vx += Math.cos(pushA) * force;
        other.vy += Math.sin(pushA) * force;
        f.score += 70;
        this.addFloatingText(other.x, other.y - 26, '❄️ ICE-CRACK SHUNT! +70', '#38bdf8', 16);
      }
    });
  }

  private triggerLineSnap(f: AnglerPlayer): void {
    f.isHolding = false;
    f.charge = 0;
    f.overchargeTimer = 1.2;
    f.combo = 1;
    this.triggerScreenShake(6);
    this.audio.playBuzzer();
    this.emitFx(f.x, f.y, '#ef4444', 14, 150);
    this.addFloatingText(f.x, f.y - 28, '⚠️ LINE SNAPPED!', '#ef4444', 15);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const f = this.fishers.get(botId);
    if (!f || f.overchargeTimer > 0) return;

    f.botTimer -= dt;
    if (f.botTimer <= 0) {
      const delay = difficulty === 'bot_hard' ? 0.18 : difficulty === 'bot_normal' ? 0.28 : 0.42;
      f.botTimer = delay + Math.random() * 0.12;

      const blunder =
        difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.12 : 0.03;

      let bestHole: IceHole | null = null;
      let bestScore = -9999;

      for (const h of this.holes) {
        if (h.fishType === 'none') continue;
        if (h.fishType === 'electric_eel' && Math.random() > blunder) continue;
        const d = Math.hypot(h.x - f.x, h.y - f.y);
        const val =
          (h.fishType === 'golden_narwhal'
            ? 320
            : h.fishType === 'king_crab'
            ? 210
            : 130) -
          d * 0.55;
        if (val > bestScore) {
          bestScore = val;
          bestHole = h;
        }
      }

      if (bestHole) {
        f.botTargetX = bestHole.x;
        f.botTargetY = bestHole.y - 36;
        const distToHole = Math.hypot(bestHole.x - f.x, bestHole.y - f.y);
        if (distToHole < 105 && !f.isHolding) {
          if (Math.random() < (difficulty === 'bot_hard' ? 0.55 : 0.35)) {
            f.isHolding = true;
            f.charge = 0;
            f.botHoldTarget = 0.76 + Math.random() * 0.18;
          } else {
            this.executeHookStrike(f, false);
          }
        }
      }
    }

    const dx = f.botTargetX - f.x;
    const dy = f.botTargetY - f.y;
    const d = Math.hypot(dx, dy);
    if (d > 10) {
      const aimA = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.14;
      f.angle = aimA;
      const spd = difficulty === 'bot_hard' ? 700 : difficulty === 'bot_normal' ? 610 : 510;
      f.vx += Math.cos(aimA) * spd * dt;
      f.vy += Math.sin(aimA) * spd * dt;
    }

    if (f.isHolding) {
      f.charge += dt * 0.85;
      if (f.charge >= f.botHoldTarget) {
        f.isHolding = false;
        if (f.charge >= 0.72 && f.charge <= 0.98) {
          this.executeMasterTrenchHaul(f);
        } else {
          this.executeHookStrike(f, false);
        }
        f.charge = 0;
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.fishers.forEach((f, id) => scores.set(id, Math.floor(f.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.fishers.entries())
      .map(([playerId, f]) => ({ playerId, score: Math.floor(f.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });

    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    const winnerName = winnerId ? this.getPlayer(winnerId)?.name ?? winnerId : 'Nobody';

    return {
      winnerId,
      rankings,
      mvpHighlight: `${winnerName} mastered the Deep Trench Frost Holes!`,
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex] ?? THEMES[0];

    ctx.save();
    this.applyScreenShake(ctx);

    // 1. Arctic Horizon & Frozen Bay Ice Sheet
    ctx.fillStyle = theme.skyTop;
    ctx.fillRect(0, 0, width, height);

    // Distant snowy peaks
    ctx.fillStyle = 'rgba(186, 230, 253, 0.16)';
    ctx.beginPath();
    ctx.moveTo(0, 105);
    ctx.lineTo(width * 0.18, 52);
    ctx.lineTo(width * 0.36, 98);
    ctx.lineTo(width * 0.58, 44);
    ctx.lineTo(width * 0.78, 92);
    ctx.lineTo(width, 58);
    ctx.lineTo(width, 110);
    ctx.closePath();
    ctx.fill();

    // 2.5D Translucent Ice Rink Surface
    const rinkX = 36;
    const rinkY = 92;
    const rinkW = width - 72;
    const rinkH = height - 142;

    ctx.fillStyle = theme.iceCrack;
    ctx.beginPath();
    ctx.roundRect(rinkX, rinkY + 12, rinkW, rinkH, 28);
    ctx.fill();

    const iceGrad = ctx.createLinearGradient(0, rinkY, 0, rinkY + rinkH);
    iceGrad.addColorStop(0, '#ffffff');
    iceGrad.addColorStop(1, theme.iceTop);
    ctx.fillStyle = iceGrad;
    ctx.beginPath();
    ctx.roundRect(rinkX, rinkY, rinkW, rinkH, 28);
    ctx.fill();
    ctx.strokeStyle = theme.holeRim;
    ctx.lineWidth = 4;
    ctx.stroke();

    // 2. Render 6 Shared Augered Ice Holes with Visible Underwater Fish
    for (const h of this.holes) {
      ctx.save();
      ctx.translate(h.x, h.y);

      // Ice hole bevel & deep trench water
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.ellipse(0, 4, 48, 30, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = theme.holeWater;
      ctx.beginPath();
      ctx.ellipse(0, 0, 44, 27, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle =
        h.fishType === 'golden_narwhal'
          ? '#facc15'
          : h.fishType === 'electric_eel'
          ? '#ef4444'
          : theme.holeRim;
      ctx.lineWidth = h.fishType === 'none' ? 2.5 : 4;
      ctx.stroke();

      // Water ripple
      if (h.ripple > 0) {
        ctx.strokeStyle = `rgba(224, 242, 254, ${h.ripple.toFixed(2)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 40 * (1 - h.ripple * 0.5), 24 * (1 - h.ripple * 0.5), 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Swimming Fish Silhouette inside the hole
      if (h.fishType !== 'none') {
        const fx = Math.cos(h.fishAngle) * 16;
        const fy = Math.sin(h.fishAngle) * 8;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(h.fishAngle + Math.PI * 0.5);

        if (h.fishType === 'golden_narwhal') {
          ctx.fillStyle = '#facc15';
          ctx.shadowColor = '#facc15';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.ellipse(0, 0, 15, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          // Spiral horn
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(14, 0);
          ctx.lineTo(25, 0);
          ctx.stroke();
          ctx.shadowBlur = 0;
        } else if (h.fishType === 'king_crab') {
          ctx.fillStyle = '#fb7185';
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.fill();
        } else if (h.fishType === 'arctic_char') {
          ctx.fillStyle = '#34d399';
          ctx.beginPath();
          ctx.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Electric Eel
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(-14, -3);
          ctx.quadraticCurveTo(0, 6, 14, -3);
          ctx.stroke();
        }
        ctx.restore();

        // Badge label above hole
        const tag =
          h.fishType === 'golden_narwhal'
            ? '🦄 NARWHAL (+95)'
            : h.fishType === 'king_crab'
            ? '🦀 CRAB (+70)'
            : h.fishType === 'arctic_char'
            ? '🐟 CHAR (+45)'
            : '⚡ EEL HAZARD!';
        ctx.fillStyle =
          h.fishType === 'golden_narwhal'
            ? '#facc15'
            : h.fishType === 'electric_eel'
            ? '#ef4444'
            : '#0f172a';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(tag, 0, -33);
      }

      ctx.restore();
    }

    // 3. Render Angler Players & Fishing Rods
    this.fishers.forEach((f, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#38bdf8';
      const underdog = this.isUnderdog(f);

      // Cast line to hole when striking
      if (f.castAnim > 0) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(f.x, f.y - 12);
        ctx.lineTo(f.castTargetX, f.castTargetY);
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(f.x, f.y);

      // Charge ring (72%-98% Sweet Spot)
      if (f.isHolding && f.charge > 0.04) {
        const ringR = f.radius + 10;
        const inSweet = f.charge >= 0.72 && f.charge <= 0.98;
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, -Math.PI * 0.5 + 0.72 * Math.PI * 2, -Math.PI * 0.5 + 0.98 * Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = inSweet ? '#facc15' : color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, -Math.PI * 0.5, -Math.PI * 0.5 + Math.min(1, f.charge) * Math.PI * 2);
        ctx.stroke();
      }

      if (underdog) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, f.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Shadow on ice
      ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      ctx.beginPath();
      ctx.ellipse(0, 14, 20, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      // Parka Cushion ring
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 2, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 2.5D Carbon Ice-Fishing Rod
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(28, -18);
      ctx.stroke();

      const mood: CharacterMood =
        f.overchargeTimer > 0
          ? 'shocked'
          : f.castAnim > 0
          ? 'triumph'
          : f.isHolding
          ? 'focused'
          : 'happy';
      this.drawPlayerMascot(ctx, pId, 0, -2, 15, mood, this.elapsed, 0);

      // Score label
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${Math.floor(f.score)}`, 0, -28);

      if (f.combo > 1) {
        ctx.fillStyle = '#0284c7';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(`${f.combo}x ANGLER`, 0, 30);
      }

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
      '🎣 Steer: Skate to Ice Holes • Tap: Strike Fish • Hold (72–98%): Master Trench Haul & Ice Shunt!',
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

  public handlePointerDown(x: number, y: number, _width: number, height: number): boolean {
    if (x >= 20 && x <= 190 && y >= height - 44 && y <= height - 12) {
      this.themeIndex = (this.themeIndex + 1) % THEMES.length;
      this.audio.playTap();
      return true;
    }
    return false;
  }
}
