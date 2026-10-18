import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface PondDuck {
  id: number;
  angle: number;
  ringRadius: number;
  speed: number;
  isGolden: boolean;
  isElectricEel: boolean;
  hookedBy: PlayerId | null;
  x: number;
  y: number;
}

interface DuckAngler {
  id: PlayerId;
  color: string;
  baseX: number;
  baseY: number;
  aimAngle: number;
  aimDir: number;
  baseAim: number;
  hookDist: number;
  state: 'aiming' | 'extending' | 'reeling';
  caughtDuck: PondDuck | null;
  score: number;
  streak: number;
  multiplier: number;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
}

type ThemeId = 'carnival_lagoon' | 'rubber_duck_spa' | 'neon_fountain';

interface ThemeSpec {
  name: string;
  pondInner: string;
  pondOuter: string;
  rimColor: string;
}

const THEMES: Record<ThemeId, ThemeSpec> = {
  carnival_lagoon: {
    name: 'Carnival Whirlpool Lagoon',
    pondInner: '#0284c7',
    pondOuter: '#0c4a6e',
    rimColor: '#facc15',
  },
  rubber_duck_spa: {
    name: 'Bubble Bath Duck Spa',
    pondInner: '#2dd4bf',
    pondOuter: '#115e59',
    rimColor: '#f472b6',
  },
  neon_fountain: {
    name: 'Neon Cyber Fountain',
    pondInner: '#4f46e5',
    pondOuter: '#1e1b4b',
    rimColor: '#38bdf8',
  },
};

const THEME_ORDER: ThemeId[] = ['carnival_lagoon', 'rubber_duck_spa', 'neon_fountain'];

export class DuckPondDerbyGame extends BaseGame {
  private anglers: Map<PlayerId, DuckAngler> = new Map();
  private ducks: PondDuck[] = [];
  private timeElapsed = 0;
  private suddenDeath = false;
  private hitStopTimer = 0;
  private themeIndex = 0;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];

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
    if (typeof window !== 'undefined' && !this.keyHandler) {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.themeIndex = (this.themeIndex + 1) % THEME_ORDER.length;
          this.audio.playTap();
        } else if (e.key >= '1' && e.key <= '3') {
          this.themeIndex = parseInt(e.key, 10) - 1;
          this.audio.playTap();
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 38.0;
    this.timeElapsed = 0;
    this.suddenDeath = false;
    this.hitStopTimer = 0;
    this.ducks = [];
    this.anglers.clear();
    this.floatingTexts = [];
    this.themeIndex = Math.floor(Math.random() * THEME_ORDER.length);

    const w = width || 1280;
    const h = height || 720;
    const cx = w / 2;
    const cy = h / 2 + 15;

    for (let i = 0; i < 14; i++) {
      const ring = i < 6 ? 95 : 175;
      const a = (i / (i < 6 ? 6 : 8)) * Math.PI * 2;
      const isGolden = i % 4 === 0;
      const isElectricEel = !isGolden && i % 6 === 2;
      this.ducks.push({
        id: i,
        angle: a,
        ringRadius: ring,
        speed: (i < 6 ? 1.35 : -0.95) * (isGolden ? 1.25 : 1.0),
        isGolden,
        isElectricEel,
        hookedBy: null,
        x: cx + Math.cos(a) * ring,
        y: cy + Math.sin(a) * ring,
      });
    }

    const active = this.getActivePlayers();
    active.forEach((cfg, idx) => {
      const a = (idx / Math.max(1, active.length)) * Math.PI * 2 + Math.PI / 4;
      const rimDist = Math.min(w, h) * 0.41;
      const bx = cx + Math.cos(a) * rimDist;
      const by = cy + Math.sin(a) * rimDist;
      const toCenter = Math.atan2(cy - by, cx - bx);

      this.anglers.set(cfg.id, {
        id: cfg.id,
        color: cfg.color,
        baseX: bx,
        baseY: by,
        aimAngle: toCenter,
        aimDir: 1,
        baseAim: toCenter,
        hookDist: 28,
        state: 'aiming',
        caughtDuck: null,
        score: 0,
        streak: 0,
        multiplier: 1,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.18,
      });
    });
  }

  public handlePointerDown(x: number, y: number, width: number, height: number): boolean {
    void height;
    if (y < 60 && x > width - 220) {
      this.themeIndex = (this.themeIndex + 1) % THEME_ORDER.length;
      this.audio.playTap();
      return true;
    }
    return false;
  }

  private addFloatingText(x: number, y: number, text: string, color: string, size = 18): void {
    this.floatingTexts.push({ x, y, text, color, alpha: 1, vy: -52, size });
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = `900 ${ft.size}px "Outfit", sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= dt * 1.1;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.timeElapsed += dt;
    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    if (this.roundTimer <= 15 && !this.suddenDeath) {
      this.suddenDeath = true;
      this.audio.playFanfare();
      this.addFloatingText(width / 2, 100, '⚡ GOLDEN FLOCK FRENZY! 2X DUCK VALUE! ⚡', '#facc15', 24);
    }

    const cx = width / 2;
    const cy = height / 2 + 15;

    for (const d of this.ducks) {
      if (d.hookedBy === null) {
        d.angle += d.speed * (this.suddenDeath ? 1.3 : 1.0) * dt;
        d.x = cx + Math.cos(d.angle) * d.ringRadius;
        d.y = cy + Math.sin(d.angle) * d.ringRadius;
      }
    }

    let maxScore = 0;
    this.anglers.forEach((a) => {
      if (a.score > maxScore) maxScore = a.score;
    });

    this.updateBots(dt, width, height);

    this.anglers.forEach((a) => {
      a.underdog = maxScore - a.score >= 120;
      if (a.stunTimer > 0) a.stunTimer -= dt;

      if (a.state === 'aiming') {
        a.aimAngle += a.aimDir * 1.55 * dt;
        if (a.aimAngle > a.baseAim + 0.68) {
          a.aimAngle = a.baseAim + 0.68;
          a.aimDir = -1;
        } else if (a.aimAngle < a.baseAim - 0.68) {
          a.aimAngle = a.baseAim - 0.68;
          a.aimDir = 1;
        }

        if (a.stunTimer <= 0 && (this.input.justPressed(a.id) || this.input.justAction(a.id))) {
          a.state = 'extending';
          this.audio.playWhoosh();
        }
      } else if (a.state === 'extending') {
        const extSpeed = a.underdog ? 540 : 450;
        a.hookDist += extSpeed * dt;
        const hx = a.baseX + Math.cos(a.aimAngle) * a.hookDist;
        const hy = a.baseY + Math.sin(a.aimAngle) * a.hookDist;

        for (const d of this.ducks) {
          if (Math.hypot(d.x - hx, d.y - hy) < 28) {
            // Cutthroat Gold Miner-style Hook Steal! Even if another player hooked it, we can snatch it!
            if (d.hookedBy !== null && d.hookedBy !== a.id) {
              const victim = this.anglers.get(d.hookedBy);
              if (victim) victim.caughtDuck = null;
              this.addFloatingText(hx, hy - 22, 'DUCK STOLEN!', a.color, 20);
            }
            d.hookedBy = a.id;
            a.caughtDuck = d;
            a.state = 'reeling';
            this.audio.playTap();
            this.particles.emit(hx, hy, 12, d.isGolden ? '#facc15' : '#38bdf8');
            break;
          }
        }

        if (a.hookDist >= 340) {
          a.state = 'reeling';
        }
      } else if (a.state === 'reeling') {
        const reelSpeed = (a.caughtDuck?.isGolden ? 340 : 410) * (a.underdog ? 1.25 : 1.0);
        a.hookDist -= reelSpeed * dt;
        const hx = a.baseX + Math.cos(a.aimAngle) * a.hookDist;
        const hy = a.baseY + Math.sin(a.aimAngle) * a.hookDist;

        if (a.caughtDuck) {
          a.caughtDuck.x = hx;
          a.caughtDuck.y = hy;
        }

        if (a.hookDist <= 28) {
          a.hookDist = 28;
          a.state = 'aiming';

          if (a.caughtDuck) {
            const duck = a.caughtDuck;
            a.caughtDuck = null;
            duck.hookedBy = null;
            duck.angle = Math.random() * Math.PI * 2;
            duck.isGolden = Math.random() < (this.suddenDeath ? 0.45 : 0.28);
            duck.isElectricEel = !duck.isGolden && Math.random() < 0.16;

            if (duck.isElectricEel && !a.underdog) {
              a.streak = 0;
              a.multiplier = 1;
              a.stunTimer = 0.9;
              this.audio.playStun();
              this.particles.emit(a.baseX, a.baseY, 18, '#ff2a85');
              this.addFloatingText(a.baseX, a.baseY - 24, 'ELECTRIC EEL SHOCK!', '#ff2a85', 18);
            } else {
              a.streak++;
              a.multiplier = a.streak >= 4 ? 4 : a.streak >= 2 ? 2 : 1;
              const pts = (duck.isGolden ? 75 : 25) * a.multiplier * (this.suddenDeath ? 2 : 1);
              a.score += pts;
              this.audio.playScore();
              this.hitStopTimer = 0.035;
              this.particles.emit(a.baseX, a.baseY, 16, duck.isGolden ? '#facc15' : a.color);
              this.addFloatingText(
                a.baseX,
                a.baseY - 26,
                `+${pts} (${a.multiplier}x)`,
                duck.isGolden ? '#facc15' : '#38bdf8',
                19
              );
            }
          }
        }
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    void width;
    void height;
    const a = this.anglers.get(botId);
    if (!a || a.state !== 'aiming' || a.stunTimer > 0) {
      this.input.setBotState(botId, false);
      return;
    }

    a.botTimer -= dt;
    if (a.botTimer > 0) {
      this.input.setBotState(botId, false);
      return;
    }

    let aligned = false;
    for (const d of this.ducks) {
      if (d.isElectricEel) continue;
      const angToDuck = Math.atan2(d.y - a.baseY, d.x - a.baseX);
      const diff = Math.abs(Math.atan2(Math.sin(angToDuck - a.aimAngle), Math.cos(angToDuck - a.aimAngle)));
      const tol = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.18 : 0.26;
      if (diff < tol) {
        aligned = true;
        break;
      }
    }

    if (aligned) {
      a.botTimer = difficulty === 'bot_hard' ? 0.16 : difficulty === 'bot_normal' ? 0.26 : 0.4;
      this.input.setBotState(botId, true);
    } else {
      this.input.setBotState(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2 + 15;
    const pondR = Math.min(width, height) * 0.37;
    const theme = THEMES[THEME_ORDER[this.themeIndex]];

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Whirlpool Pond
    const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, pondR);
    grad.addColorStop(0, theme.pondInner);
    grad.addColorStop(1, theme.pondOuter);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, pondR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = theme.rimColor;
    ctx.stroke();
    ctx.restore();

    // Draw Ducks
    for (const d of this.ducks) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.beginPath();
      ctx.arc(0, 0, d.isGolden ? 19 : 15, 0, Math.PI * 2);
      ctx.fillStyle = d.isElectricEel ? '#ff2a85' : d.isGolden ? '#facc15' : '#fde047';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = '900 11px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.isElectricEel ? '⚡' : d.isGolden ? '👑75' : '🦆', 0, 0);
      ctx.restore();
    }

    // Draw Anglers & Magnetic Winch Lines
    this.anglers.forEach((a) => {
      const hx = a.baseX + Math.cos(a.aimAngle) * a.hookDist;
      const hy = a.baseY + Math.sin(a.aimAngle) * a.hookDist;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(a.baseX, a.baseY);
      ctx.lineTo(hx, hy);
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(hx, hy, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      const mood = a.stunTimer > 0 ? 'shocked' : a.caughtDuck ? 'triumph' : 'focused';
      this.drawPlayerMascot(ctx, a.id, a.baseX, a.baseY, 22, mood, this.timeElapsed, 0);
    });

    this.renderFloatingTexts(ctx);

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(width - 215, 14, 200, 32);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 13px "Outfit", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`🎨 ${theme.name} [T]`, width - 24, 35);
    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.anglers.values())
      .map((a) => ({ playerId: a.id, score: Math.floor(a.score), place: 1 }))
      .sort((a, b) => b.score - a.score);
    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });
    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `Player ${winnerId} reeled in the Golden Duck Flock!` : 'Duck pond derby complete!',
    };
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    super.destroy();
  }
}
