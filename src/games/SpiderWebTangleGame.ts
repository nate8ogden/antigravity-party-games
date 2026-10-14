import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type WebTheme = 'morning_dew_web' | 'moonlit_silk' | 'crystal_orb_weaver';

interface WebPalette {
  name: string;
  bgTop: string;
  bgBot: string;
  silkColor: string;
}

const THEMES: Record<WebTheme, WebPalette> = {
  morning_dew_web: {
    name: 'Morning Dew Garden Web',
    bgTop: '#064e3b',
    bgBot: '#022c22',
    silkColor: '#e2e8f0',
  },
  moonlit_silk: {
    name: 'Moonlit Silver Silk',
    bgTop: '#1e1b4b',
    bgBot: '#090d16',
    silkColor: '#38bdf8',
  },
  crystal_orb_weaver: {
    name: 'Golden Orb-Weaver Canopy',
    bgTop: '#451a03',
    bgBot: '#1c1917',
    silkColor: '#fbbf24',
  },
};

const THEME_KEYS: WebTheme[] = ['morning_dew_web', 'moonlit_silk', 'crystal_orb_weaver'];

interface WebPrey {
  id: number;
  x: number;
  y: number;
  kind: 'gnat' | 'golden_scarab' | 'hornet';
}

interface SpiderPlayer {
  id: PlayerId;
  color: string;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  combo: number;
  charge: number;
  holding: boolean;
  silkBoostTimer: number;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class SpiderWebTangleGame extends BaseGame {
  private spiders: SpiderPlayer[] = [];
  private prey: WebPrey[] = [];
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

  public reset(width: number, height: number): void {
    this.timeElapsed = 0;
    this.roundTime = 45;
    this.isFinished = false;
    this.suddenDeath = false;
    this.hitStopTimer = 0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.spiders = [];
    this.prey = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const a = (idx * Math.PI * 2) / Math.max(1, active.length);
      this.spiders.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: width * 0.5 + Math.cos(a) * 110,
        y: height * 0.54 + Math.sin(a) * 90,
        vx: 0,
        vy: 0,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        silkBoostTimer: 0,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.22,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    for (let i = 0; i < 10; i++) {
      this.prey.push(this.spawnPrey(width, height, i));
    }
  }

  private spawnPrey(width: number, height: number, id: number): WebPrey {
    const a = Math.random() * Math.PI * 2;
    const d = 40 + Math.random() * 175;
    const r = Math.random();
    return {
      id,
      x: width * 0.5 + Math.cos(a) * d,
      y: height * 0.54 + Math.sin(a) * d * 0.78,
      kind: r < 0.26 ? 'golden_scarab' : r < 0.82 ? 'gnat' : 'hornet',
    };
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(s: SpiderPlayer, text: string): void {
    s.calloutText = text;
    s.calloutTimer = 1.15;
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
      this.spiders.forEach((s) => this.showCallout(s, 'SILK FRENZY 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.spiders.map((s) => s.score));

    for (const s of this.spiders) {
      s.underdog = maxScore - s.score >= 150;
      if (s.calloutTimer > 0) s.calloutTimer = Math.max(0, s.calloutTimer - dt);
      if (s.silkBoostTimer > 0) s.silkBoostTimer = Math.max(0, s.silkBoostTimer - dt);
      if (s.stunTimer > 0) {
        s.stunTimer = Math.max(0, s.stunTimer - dt);
        continue;
      }

      const sx = this.input.getSteer(s.id);
      const sy = this.input.getThrottle(s.id);
      const isHold = this.input.isActionPressed(s.id) || this.input.isPressed(s.id);

      const accel = 1350 * (s.underdog ? 1.15 : 1.0) * (s.silkBoostTimer > 0 ? 1.35 : 1.0);
      s.vx += sx * accel * dt;
      s.vy += (sy !== 0 ? -sy : 0) * accel * dt;
      s.vx *= Math.pow(0.05, dt);
      s.vy *= Math.pow(0.05, dt);

      // Hold-to-charge Silk Zipline Pounce & Web-Twang Shunt (72%-98% Sweet Spot)
      if (isHold) {
        s.holding = true;
        s.charge = Math.min(1, s.charge + dt * 0.92);
      } else if (s.holding) {
        const sweet = s.charge >= 0.72 && s.charge <= 0.98;
        if (sweet) {
          s.silkBoostTimer = 2.2;
          s.score += 85;
          s.combo = Math.min(4, s.combo + 1);
          this.showCallout(s, 'SILK ZIPLINE +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 11);

          for (const other of this.spiders) {
            if (other.id !== s.id && Math.hypot(other.x - s.x, other.y - s.y) < 170) {
              const dx = other.x - s.x;
              const dy = other.y - s.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              other.vx += (dx / d) * 520;
              other.vy += (dy / d) * 520;
              s.score += 70;
              this.showCallout(s, 'WEB-TWANG SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else if (s.charge > 0.98) {
          s.stunTimer = 0.9;
          s.combo = 1;
          this.showCallout(s, 'STICKY SNARE!');
          this.audio.playStun();
        }
        s.holding = false;
        s.charge = 0;
      }

      s.x = Math.max(width * 0.1, Math.min(width * 0.9, s.x + s.vx * dt));
      s.y = Math.max(height * 0.16, Math.min(height * 0.88, s.y + s.vy * dt));

      for (let i = 0; i < this.prey.length; i++) {
        const pr = this.prey[i];
        if (Math.hypot(s.x - pr.x, s.y - pr.y) < 32) {
          if (pr.kind === 'hornet' && s.silkBoostTimer <= 0 && !s.underdog) {
            s.stunTimer = 1.0;
            s.combo = 1;
            this.showCallout(s, 'HORNET ZAP!');
            this.audio.playStun();
          } else {
            const base = pr.kind === 'golden_scarab' ? 95 : 50;
            const pts = base * s.combo * (this.suddenDeath ? 2 : 1);
            s.score += pts;
            s.combo = Math.min(4, s.combo + 1);
            this.showCallout(s, pr.kind === 'golden_scarab' ? `GOLDEN SCARAB +${pts}!` : `SILK WRAP +${pts}`);
            this.audio.playScore();
            this.particles.spawnSparks(pr.x, pr.y, '#fbbf24', 10);
          }
          this.prey[i] = this.spawnPrey(width, height, pr.id);
        }
      }
    }

    // Spider-to-Spider Bumping
    for (let i = 0; i < this.spiders.length; i++) {
      for (let j = i + 1; j < this.spiders.length; j++) {
        const a = this.spiders[i];
        const b = this.spiders[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < 36) {
          const nx = dx / dist;
          const ny = dy / dist;
          a.vx -= nx * 280;
          a.vy -= ny * 280;
          b.vx += nx * 280;
          b.vy += ny * 280;
          this.audio.playBounce();
        }
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const bot = this.spiders.find((s) => s.id === botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    const best = this.prey.find((p) => p.kind !== 'hornet') ?? this.prey[0];
    if (best) {
      const dx = best.x - bot.x;
      const dy = best.y - bot.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      bot.vx += (dx / d) * 1100 * dt;
      bot.vy += (dy / d) * 1100 * dt;
    }

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

    // Draw Shared Radial Spiderweb
    const cx = width * 0.5;
    const cy = height * 0.54;
    ctx.strokeStyle = pal.silkColor;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      ctx.arc(cx, cy, ring * 48, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let s = 0; s < 8; s++) {
      const a = (s * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * 200, cy + Math.sin(a) * 200);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Prey
    for (const pr of this.prey) {
      ctx.fillStyle =
        pr.kind === 'golden_scarab' ? '#fbbf24' : pr.kind === 'gnat' ? '#38bdf8' : '#ef4444';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.kind === 'golden_scarab' ? 16 : 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Spiders
    for (const s of this.spiders) {
      ctx.save();
      ctx.translate(s.x, s.y);
      if (s.holding && s.charge > 0.05) {
        const sweet = s.charge >= 0.72 && s.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + s.charge * Math.PI * 2);
        ctx.stroke();
      }
      const mood = s.stunTimer > 0 ? 'shocked' : s.silkBoostTimer > 0 ? 'triumph' : s.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, s.id, 0, 0, 16, mood, this.timeElapsed, s.vx * 0.0005);
      if (s.calloutTimer > 0 && s.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(s.calloutText, 0, -28);
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
      `🕸️ SPIDER WEB TANGLE • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X SILK' : ''}`,
      width * 0.5,
      19
    );

    this.spiders.forEach((s, idx) => {
      ctx.fillStyle = s.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${s.id}: ${Math.round(s.score)} pts (${s.combo}x)`, 90 + idx * 170, 38);
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.spiders].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 1,
      rankings: sorted.map((s, i) => ({
        playerId: s.id,
        score: Math.round(s.score),
        place: i + 1,
      })),
      mvpHighlight: `Orb-Weaver Champion ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
