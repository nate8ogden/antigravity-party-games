import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type TwigTheme = 'rose_garden' | 'cherry_blossom' | 'neon_terrarium';

interface TwigPalette {
  name: string;
  bgTop: string;
  bgBot: string;
  branchColor: string;
  dewColor: string;
}

const THEMES: Record<TwigTheme, TwigPalette> = {
  rose_garden: {
    name: 'Morning Dew Rose Branch',
    bgTop: '#064e3b',
    bgBot: '#022c22',
    branchColor: '#78350f',
    dewColor: '#38bdf8',
  },
  cherry_blossom: {
    name: 'Sakura Blossom Canopy',
    bgTop: '#4c1d95',
    bgBot: '#1e1b4b',
    branchColor: '#581c87',
    dewColor: '#f472b6',
  },
  neon_terrarium: {
    name: 'Bioluminescent Terrarium',
    bgTop: '#090d16',
    bgBot: '#0f172a',
    branchColor: '#10b981',
    dewColor: '#22d3ee',
  },
};

const THEME_KEYS: TwigTheme[] = ['rose_garden', 'cherry_blossom', 'neon_terrarium'];

interface BranchPlatform {
  x1: number;
  x2: number;
  y: number;
  hasDew: boolean;
  hasGoldenBud: boolean;
}

interface Inchworm {
  id: PlayerId;
  color: string;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  scrunchPhase: number;
  score: number;
  combo: number;
  charge: number;
  holding: boolean;
  surgeBoostTimer: number;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class CaterpillarInchwormGame extends BaseGame {
  private worms: Inchworm[] = [];
  private branches: BranchPlatform[] = [];
  private timeElapsed = 0;
  private roundTime = 45;
  private suddenDeath = false;
  private hitStopTimer = 0;
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private themeIdx = 0;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
    if (typeof window !== 'undefined' && !this.keyHandler) {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.themeIdx = (this.themeIdx + 1) % THEME_KEYS.length;
          this.audio.playTap();
        } else if (e.key === '1') this.themeIdx = 0;
        else if (e.key === '2') this.themeIdx = 1;
        else if (e.key === '3') this.themeIdx = 2;
      };
      window.addEventListener('keydown', this.keyHandler);
    }
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    super.destroy();
  }

  public reset(width: number, height: number): void {
    this.timeElapsed = 0;
    this.roundTime = 45;
    this.isFinished = false;
    this.suddenDeath = false;
    this.hitStopTimer = 0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.worms = [];
    this.branches = [
      { x1: width * 0.08, x2: width * 0.44, y: height * 0.78, hasDew: true, hasGoldenBud: false },
      { x1: width * 0.56, x2: width * 0.92, y: height * 0.78, hasDew: true, hasGoldenBud: false },
      { x1: width * 0.24, x2: width * 0.76, y: height * 0.58, hasDew: true, hasGoldenBud: true },
      { x1: width * 0.1, x2: width * 0.45, y: height * 0.38, hasDew: true, hasGoldenBud: false },
      { x1: width * 0.55, x2: width * 0.9, y: height * 0.38, hasDew: false, hasGoldenBud: true },
      { x1: width * 0.32, x2: width * 0.68, y: height * 0.2, hasDew: false, hasGoldenBud: true },
    ];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const b = this.branches[idx % 2];
      this.worms.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: (b.x1 + b.x2) * 0.5,
        y: b.y,
        vx: 0,
        vy: 0,
        grounded: true,
        scrunchPhase: 0,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        surgeBoostTimer: 0,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.22,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(w: Inchworm, text: string): void {
    w.calloutText = text;
    w.calloutTimer = 1.15;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
      return;
    }

    this.timeElapsed += dt;
    const remaining = Math.max(0, this.roundTime - this.timeElapsed);
    if (remaining <= 15 && !this.suddenDeath) {
      this.suddenDeath = true;
      this.audio.playBuzzer();
      this.worms.forEach((w) => this.showCallout(w, 'CANOPY SPRING 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.worms.map((w) => w.score));

    for (const w of this.worms) {
      w.underdog = maxScore - w.score >= 150;
      if (w.calloutTimer > 0) w.calloutTimer = Math.max(0, w.calloutTimer - dt);
      if (w.surgeBoostTimer > 0) w.surgeBoostTimer = Math.max(0, w.surgeBoostTimer - dt);
      if (w.stunTimer > 0) {
        w.stunTimer = Math.max(0, w.stunTimer - dt);
        continue;
      }

      const sx = this.input.getSteer(w.id);
      const justTap = this.input.justPressed(w.id) || this.input.justAction(w.id);
      const isHold = this.input.isActionPressed(w.id) || this.input.isPressed(w.id);

      // Accordion scrunch movement along branches + gravity when airborne
      if (w.grounded) {
        w.vx += sx * 980 * (w.underdog ? 1.15 : 1.0) * dt;
        w.vx *= Math.pow(0.04, dt);
        w.scrunchPhase += Math.abs(w.vx) * dt * 0.08;
        if (justTap) {
          w.vy = -420;
          w.grounded = false;
          this.audio.playTap();
        }
      } else {
        w.vx += sx * 520 * dt;
        w.vy += 680 * dt;
      }

      // Hold-to-contract Accordion Catapult & Branch-Shake Shunt (72%-98% Sweet Spot)
      if (isHold) {
        w.holding = true;
        w.charge = Math.min(1, w.charge + dt * 0.94);
      } else if (w.holding) {
        const sweet = w.charge >= 0.72 && w.charge <= 0.98;
        w.grounded = false;
        w.vy = sweet ? -620 : -460;
        w.vx += sx * 320;
        if (sweet) {
          w.surgeBoostTimer = 2.2;
          w.score += 85;
          w.combo = Math.min(4, w.combo + 1);
          this.showCallout(w, 'ACCORDION CATAPULT +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 11);

          for (const other of this.worms) {
            if (other.id !== w.id && Math.hypot(other.x - w.x, other.y - w.y) < 170) {
              other.grounded = false;
              other.vy = -280;
              other.vx += (other.x >= w.x ? 1 : -1) * 480;
              w.score += 70;
              this.showCallout(w, 'BRANCH SHAKE SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else if (w.charge > 0.98) {
          w.stunTimer = 0.85;
          w.combo = 1;
          this.showCallout(w, 'KNOTTED UP!');
          this.audio.playStun();
        }
        w.holding = false;
        w.charge = 0;
      }

      const prevY = w.y;
      w.x = Math.max(width * 0.08, Math.min(width * 0.92, w.x + w.vx * dt));
      w.y += w.vy * dt;

      // Check landing on multi-tiered branches
      w.grounded = false;
      for (const b of this.branches) {
        if (w.x >= b.x1 && w.x <= b.x2 && prevY <= b.y + 8 && w.y >= b.y - 6 && w.vy >= 0) {
          w.y = b.y;
          w.vy = 0;
          w.grounded = true;

          const mid = (b.x1 + b.x2) * 0.5;
          if (Math.abs(w.x - mid) < 42 && (b.hasGoldenBud || b.hasDew)) {
            const isGold = b.hasGoldenBud;
            b.hasGoldenBud = false;
            b.hasDew = false;
            const pts = (isGold ? 95 : 50) * w.combo * (this.suddenDeath ? 2 : 1);
            w.score += pts;
            w.combo = Math.min(4, w.combo + 1);
            this.showCallout(w, isGold ? `GOLDEN BUD +${pts}!` : `DEW DROP +${pts}`);
            this.audio.playScore();
            this.particles.spawnSparks(mid, b.y, '#fbbf24', 10);
            const randB = this.branches[Math.floor(Math.random() * this.branches.length)];
            if (randB) {
              if (Math.random() < 0.45) randB.hasGoldenBud = true;
              else randB.hasDew = true;
            }
          }
          break;
        }
      }

      if (w.y > height * 0.88) {
        w.y = height * 0.78;
        w.x = width * (w.x < width * 0.5 ? 0.25 : 0.75);
        w.vy = 0;
        w.grounded = true;
      }
    }

    // Worm-to-Worm Bumping
    for (let i = 0; i < this.worms.length; i++) {
      for (let j = i + 1; j < this.worms.length; j++) {
        const a = this.worms[i];
        const b = this.worms[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < 36) {
          const nx = dx / dist;
          a.vx -= nx * 280;
          b.vx += nx * 280;
          this.audio.playBounce();
        }
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    _height: number
  ): void {
    const bot = this.worms.find((w) => w.id === botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    const targetBranch = this.branches.find((b) => b.hasGoldenBud || b.hasDew) ?? this.branches[2];
    const tx = targetBranch ? (targetBranch.x1 + targetBranch.x2) * 0.5 : width * 0.5;
    bot.vx += Math.sign(tx - bot.x) * 850 * dt;

    const hold = !bot.holding || bot.charge < bot.botChargeGoal;
    this.input.setBotState(botId, hold);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pal = THEMES[THEME_KEYS[this.themeIdx]];
    ctx.save();

    if (this.shakeTimer > 0) {
      const s = this.shakeIntensity * (this.shakeTimer / 0.22);
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, pal.bgTop);
    bg.addColorStop(1, pal.bgBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Render Multi-Tiered Rose Branches
    for (const b of this.branches) {
      ctx.strokeStyle = pal.branchColor;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y);
      ctx.lineTo(b.x2, b.y);
      ctx.stroke();

      const mid = (b.x1 + b.x2) * 0.5;
      if (b.hasGoldenBud || b.hasDew) {
        ctx.fillStyle = b.hasGoldenBud ? '#fbbf24' : pal.dewColor;
        ctx.beginPath();
        ctx.arc(mid, b.y - 16, b.hasGoldenBud ? 15 : 11, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Render Accordion Inchworms
    for (const w of this.worms) {
      ctx.save();
      ctx.translate(w.x, w.y - 12);
      if (w.holding && w.charge > 0.05) {
        const sweet = w.charge >= 0.72 && w.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + w.charge * Math.PI * 2);
        ctx.stroke();
      }

      // 3-segment U-arch inchworm body
      const arch = Math.sin(w.scrunchPhase) * 8 + w.charge * 14;
      ctx.fillStyle = w.color;
      ctx.beginPath();
      ctx.arc(-14 + w.charge * 6, -arch, 10, 0, Math.PI * 2);
      ctx.arc(-26 + w.charge * 12, 2, 9, 0, Math.PI * 2);
      ctx.fill();

      const mood = w.stunTimer > 0 ? 'shocked' : w.surgeBoostTimer > 0 ? 'triumph' : w.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, w.id, 0, 0, 15, mood, this.timeElapsed, 0);
      if (w.calloutTimer > 0 && w.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(w.calloutText, 0, -28);
      }
      ctx.restore();
    }

    // HUD
    const remaining = Math.max(0, Math.ceil(this.roundTime - this.timeElapsed));
    ctx.fillStyle = 'rgba(15,23,42,0.82)';
    ctx.fillRect(0, 0, width, 46);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `🐛 CATERPILLAR INCHWORM • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X CANOPY' : ''}`,
      width * 0.5,
      19
    );

    this.worms.forEach((w, idx) => {
      ctx.fillStyle = w.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${w.id}: ${Math.round(w.score)} pts (${w.combo}x)`, 90 + idx * 170, 38);
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.worms].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 0,
      rankings: sorted.map((w, i) => ({
        playerId: w.id,
        score: Math.round(w.score),
        place: i + 1,
      })),
      mvpHighlight: `Canopy Inchworm Champion ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
