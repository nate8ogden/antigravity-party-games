import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type DunkTheme = 'big_top_splash' | 'neon_aqua_show' | 'tiki_lagoon';

interface DunkPalette {
  name: string;
  bgTop: string;
  bgBot: string;
  waterColor: string;
  boothAccent: string;
}

const THEMES: Record<DunkTheme, DunkPalette> = {
  big_top_splash: {
    name: 'Big Top Carnival Tank',
    bgTop: '#1e1b4b',
    bgBot: '#0f172a',
    waterColor: '#0284c7',
    boothAccent: '#ef4444',
  },
  neon_aqua_show: {
    name: 'Cyber Aqua Splashdown',
    bgTop: '#050814',
    bgBot: '#1e1035',
    waterColor: '#06b6d4',
    boothAccent: '#ec4899',
  },
  tiki_lagoon: {
    name: 'Tropical Lagoon Dunk',
    bgTop: '#064e3b',
    bgBot: '#022c22',
    waterColor: '#10b981',
    boothAccent: '#fbbf24',
  },
};

const THEME_KEYS: DunkTheme[] = ['big_top_splash', 'neon_aqua_show', 'tiki_lagoon'];

interface DunkTarget {
  id: number;
  x: number;
  y: number;
  vx: number;
  kind: 'bullseye' | 'golden_bell' | 'decoy_pie';
  clownDunkedTimer: number;
}

interface Softball {
  ownerId: PlayerId;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fastball: boolean;
  active: boolean;
}

interface Pitcher {
  id: PlayerId;
  color: string;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  score: number;
  combo: number;
  charge: number;
  holding: boolean;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
  botTargetX: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class DunkClownTankGame extends BaseGame {
  private pitchers: Pitcher[] = [];
  private targets: DunkTarget[] = [];
  private balls: Softball[] = [];
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
    this.pitchers = [];
    this.targets = [];
    this.balls = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.pitchers.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: width * (0.28 + (idx / Math.max(1, active.length - 1)) * 0.44),
        y: height * 0.84,
        vx: 0,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.22,
        botTargetX: width * 0.5,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    this.targets = [
      { id: 1, x: width * 0.25, y: height * 0.34, vx: 135, kind: 'bullseye', clownDunkedTimer: 0 },
      { id: 2, x: width * 0.5, y: height * 0.26, vx: -165, kind: 'golden_bell', clownDunkedTimer: 0 },
      { id: 3, x: width * 0.75, y: height * 0.34, vx: 145, kind: 'bullseye', clownDunkedTimer: 0 },
      { id: 4, x: width * 0.4, y: height * 0.44, vx: 185, kind: 'decoy_pie', clownDunkedTimer: 0 },
    ];
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(p: Pitcher, text: string): void {
    p.calloutText = text;
    p.calloutTimer = 1.15;
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
      this.pitchers.forEach((p) => this.showCallout(p, 'MEGA SPLASH 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    this.updateBots(dt, width, height);

    // Move targets
    for (const t of this.targets) {
      if (t.clownDunkedTimer > 0) {
        t.clownDunkedTimer = Math.max(0, t.clownDunkedTimer - dt);
      }
      t.x += t.vx * (this.suddenDeath ? 1.35 : 1.0) * dt;
      if (t.x < width * 0.14 || t.x > width * 0.86) t.vx *= -1;
    }

    const maxScore = Math.max(0, ...this.pitchers.map((p) => p.score));

    for (const p of this.pitchers) {
      p.underdog = maxScore - p.score >= 150;
      if (p.calloutTimer > 0) p.calloutTimer = Math.max(0, p.calloutTimer - dt);
      if (p.stunTimer > 0) {
        p.stunTimer = Math.max(0, p.stunTimer - dt);
        continue;
      }

      const steer = this.input.getSteer(p.id);
      const justTap = this.input.justPressed(p.id) || this.input.justAction(p.id);
      const isHold = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      p.vx += steer * 1500 * (p.underdog ? 1.15 : 1.0) * dt;
      p.vx *= Math.pow(0.06, dt);
      p.x = Math.max(width * 0.12, Math.min(width * 0.88, p.x + p.vx * dt));

      if (isHold) {
        p.holding = true;
        p.charge = Math.min(1, p.charge + dt * 0.95);
      } else if (p.holding) {
        const sweet = p.charge >= 0.72 && p.charge <= 0.98;
        if (p.charge > 0.98) {
          p.stunTimer = 1.0;
          p.combo = 1;
          this.showCallout(p, 'WILD PITCH SLIP!');
          this.audio.playStun();
        } else {
          this.balls.push({
            ownerId: p.id,
            color: p.color,
            x: p.x,
            y: p.y - 24,
            vx: steer * 90,
            vy: sweet ? -780 : -540,
            fastball: sweet,
            active: true,
          });
          if (sweet) {
            this.showCallout(p, 'HEATER FASTBALL!');
            this.audio.playBoost();
            // Shunt nearby rival pitchers!
            for (const other of this.pitchers) {
              if (other.id !== p.id && Math.abs(other.x - p.x) < 120) {
                other.vx += (other.x >= p.x ? 1 : -1) * 520;
                p.score += 70;
                this.showCallout(p, 'TIDAL SPLASH SHUNT +70!');
                this.audio.playBounce();
              }
            }
          } else {
            this.audio.playTap();
          }
        }
        p.holding = false;
        p.charge = 0;
      } else if (justTap) {
        this.balls.push({
          ownerId: p.id,
          color: p.color,
          x: p.x,
          y: p.y - 24,
          vx: steer * 70,
          vy: -520,
          fastball: false,
          active: true,
        });
        this.audio.playTap();
      }
    }

    // Update Softballs
    for (const b of this.balls) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < 30) {
        b.active = false;
        continue;
      }

      const owner = this.pitchers.find((p) => p.id === b.ownerId);
      if (!owner) continue;

      for (const t of this.targets) {
        const hitRadius = b.fastball ? 44 : 30;
        if (Math.hypot(b.x - t.x, b.y - t.y) < hitRadius) {
          b.active = false;
          if (t.kind === 'decoy_pie' && !b.fastball && !owner.underdog) {
            owner.stunTimer = 1.1;
            owner.combo = 1;
            this.showCallout(owner, 'CREAM PIE SPLAT!');
            this.audio.playStun();
            this.triggerHitStop(40, 9);
          } else {
            t.clownDunkedTimer = 1.6;
            const base = t.kind === 'golden_bell' ? 95 : 55;
            const pts = (base + (b.fastball ? 30 : 0)) * owner.combo * (this.suddenDeath ? 2 : 1);
            owner.score += pts;
            owner.combo = Math.min(4, owner.combo + 1);
            this.showCallout(owner, `CLOWN DUNKED +${pts}!`);
            this.audio.playScore();
            this.particles.spawnSparks(t.x, t.y, '#38bdf8', 14);
            this.triggerHitStop(45, 12);
          }
          break;
        }
      }
    }
    this.balls = this.balls.filter((b) => b.active);

    // Elastic Pitcher-to-Pitcher Bumping
    for (let i = 0; i < this.pitchers.length; i++) {
      for (let j = i + 1; j < this.pitchers.length; j++) {
        const a = this.pitchers[i];
        const b = this.pitchers[j];
        const dx = b.x - a.x;
        if (Math.abs(dx) < 42) {
          const dir = dx >= 0 ? 1 : -1;
          a.vx -= dir * 320;
          b.vx += dir * 320;
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
    const bot = this.pitchers.find((p) => p.id === botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      const valid = this.targets.filter((t) => t.kind !== 'decoy_pie');
      const pick = valid[Math.floor(Math.random() * valid.length)] ?? this.targets[0];
      bot.botTargetX = pick ? pick.x + pick.vx * 0.35 : width * 0.5;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    const diff = bot.botTargetX - bot.x;
    if (Math.abs(diff) > 14) {
      bot.vx += Math.sign(diff) * 1200 * dt;
    }

    const aligned = Math.abs(diff) < 55;
    const hold = (aligned && !bot.holding) || (bot.holding && bot.charge < bot.botChargeGoal);
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

    // Giant Central Glass Splash Tank
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(width * 0.15, height * 0.16, width * 0.7, height * 0.45);
    ctx.fillStyle = pal.waterColor;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(width * 0.15, height * 0.42, width * 0.7, height * 0.19);
    ctx.globalAlpha = 1;

    // Targets & Dunkable Clowns
    for (const t of this.targets) {
      ctx.save();
      ctx.translate(t.x, t.y);
      if (t.kind === 'golden_bell') {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★95', 0, 4);
      } else if (t.kind === 'bullseye') {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(0, 0, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PIE', 0, 4);
      }
      ctx.restore();
    }

    // Softballs
    for (const b of this.balls) {
      ctx.fillStyle = b.fastball ? '#fbbf24' : '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.fastball ? 10 : 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pitchers
    for (const p of this.pitchers) {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.holding && p.charge > 0.05) {
        const sweet = p.charge >= 0.72 && p.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 28, -Math.PI / 2, -Math.PI / 2 + p.charge * Math.PI * 2);
        ctx.stroke();
      }
      const mood = p.stunTimer > 0 ? 'shocked' : p.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, p.id, 0, 0, 18, mood, this.timeElapsed, p.vx * 0.0005);
      if (p.calloutTimer > 0 && p.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.calloutText, 0, -32);
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
      `🎯 DUNK CLOWN TANK • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X SPLASH' : ''}`,
      width * 0.5,
      19
    );

    this.pitchers.forEach((p, idx) => {
      ctx.fillStyle = p.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${p.id}: ${Math.round(p.score)} pts (${p.combo}x)`, 90 + idx * 170, 38);
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.pitchers].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 0,
      rankings: sorted.map((p, i) => ({
        playerId: p.id,
        score: Math.round(p.score),
        place: i + 1,
      })),
      mvpHighlight: `Splashdown Ace ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
