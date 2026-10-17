import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type MeadowJumpTheme = 'clover_meadow' | 'sunlit_pond' | 'starlight_garden';

interface MeadowJumpPalette {
  name: string;
  bgTop: string;
  bgBot: string;
  padColor: string;
}

const THEMES: Record<MeadowJumpTheme, MeadowJumpPalette> = {
  clover_meadow: {
    name: 'Towering Clover Stalk Climb',
    bgTop: '#064e3b',
    bgBot: '#022c22',
    padColor: '#4ade80',
  },
  sunlit_pond: {
    name: 'Golden Sunflower Ascent',
    bgTop: '#0c4a6e',
    bgBot: '#082f49',
    padColor: '#38bdf8',
  },
  starlight_garden: {
    name: 'Moonlit Beanstalk Leap',
    bgTop: '#1e1b4b',
    bgBot: '#090d16',
    padColor: '#a855f7',
  },
};

const THEME_KEYS: MeadowJumpTheme[] = ['clover_meadow', 'sunlit_pond', 'starlight_garden'];

interface CloverLedge {
  id: number;
  x: number;
  y: number;
  w: number;
  vx: number;
  goldenClover: boolean;
}

interface GrasshopperLeaper {
  id: PlayerId;
  color: string;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  aimAngle: number; // Parabolic launch angle
  score: number;
  combo: number;
  charge: number;
  holding: boolean;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class GrasshopperHighJumpGame extends BaseGame {
  private hoppers: GrasshopperLeaper[] = [];
  private ledges: CloverLedge[] = [];
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
    this.hoppers = [];
    this.ledges = [];

    for (let i = 0; i < 6; i++) {
      this.ledges.push({
        id: i,
        x: width * (0.22 + (i % 3) * 0.28),
        y: height * (0.82 - i * 0.12),
        w: 110,
        vx: (i % 2 === 0 ? 1 : -1) * (65 + i * 15),
        goldenClover: i >= 4,
      });
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.hoppers.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: width * (0.32 + idx * 0.18),
        y: height * 0.84,
        vx: 0,
        vy: 0,
        grounded: true,
        aimAngle: -Math.PI * 0.5,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
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

  private showCallout(h: GrasshopperLeaper, text: string): void {
    h.calloutText = text;
    h.calloutTimer = 1.15;
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
      this.hoppers.forEach((h) => this.showCallout(h, 'SKYWARD CLOVER 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    for (const lg of this.ledges) {
      lg.x += lg.vx * dt;
      if (lg.x < width * 0.15 || lg.x > width * 0.85) lg.vx *= -1;
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.hoppers.map((h) => h.score));

    for (const h of this.hoppers) {
      h.underdog = maxScore - h.score >= 150;
      if (h.calloutTimer > 0) h.calloutTimer = Math.max(0, h.calloutTimer - dt);

      const steer = this.input.getSteer(h.id);
      const isHold = this.input.isActionPressed(h.id) || this.input.isPressed(h.id);

      // Aim parabolic trajectory arc with Left/Right steering
      h.aimAngle = Math.max(-Math.PI * 0.78, Math.min(-Math.PI * 0.22, h.aimAngle + steer * 2.2 * dt));

      if (!h.grounded) {
        h.vx += steer * 380 * dt;
        h.vy += 740 * dt;
      } else {
        h.vx *= Math.pow(0.05, dt);
      }

      // Hold-to-charge Parabolic Hind-Leg Launch & Stomp Shunt (72%-98% Sweet Spot)
      if (isHold && h.grounded) {
        h.holding = true;
        h.charge = Math.min(1, h.charge + dt * 0.95);
      } else if (h.holding) {
        const sweet = h.charge >= 0.72 && h.charge <= 0.98;
        const speed = 380 + h.charge * (sweet ? 420 : 290);
        h.vx = Math.cos(h.aimAngle) * speed;
        h.vy = Math.sin(h.aimAngle) * speed;
        h.grounded = false;

        if (sweet) {
          h.score += 85;
          h.combo = Math.min(4, h.combo + 1);
          this.showCallout(h, 'APEX SPRING LEAP +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 11);

          for (const other of this.hoppers) {
            if (other.id !== h.id && Math.hypot(other.x - h.x, other.y - h.y) < 165) {
              other.vx += (other.x >= h.x ? 1 : -1) * 480;
              other.vy = -220;
              other.grounded = false;
              h.score += 70;
              this.showCallout(h, 'SPRING-LEG SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else {
          this.audio.playTap();
        }
        h.holding = false;
        h.charge = 0;
      }

      const prevY = h.y;
      h.x = Math.max(width * 0.08, Math.min(width * 0.92, h.x + h.vx * dt));
      h.y += h.vy * dt;

      if (h.vy > 0) {
        for (const lg of this.ledges) {
          if (Math.abs(h.x - lg.x) < lg.w * 0.55 && prevY <= lg.y + 8 && h.y >= lg.y - 6) {
            h.y = lg.y;
            h.vy = 0;
            h.grounded = true;
            const pts = (lg.goldenClover ? 95 : 40) * h.combo * (this.suddenDeath ? 2 : 1);
            h.score += pts;
            this.showCallout(h, lg.goldenClover ? `GOLDEN CLOVER +${pts}!` : `CLOVER PAD +${pts}`);
            this.audio.playScore();
            break;
          }
        }
      }

      if (h.y >= height * 0.86) {
        h.y = height * 0.86;
        h.vy = 0;
        h.grounded = true;
      }
    }
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    _difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const bot = this.hoppers.find((h) => h.id === botId);
    if (!bot) return;

    const topLedge = this.ledges[4] ?? this.ledges[0];
    if (topLedge) {
      bot.aimAngle = -Math.PI * 0.5 + Math.sign(topLedge.x - bot.x) * 0.18;
    }

    const hold = bot.grounded && (!bot.holding || bot.charge < bot.botChargeGoal);
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

    // Moving Clover Ledges
    for (const lg of this.ledges) {
      ctx.fillStyle = lg.goldenClover ? '#fbbf24' : pal.padColor;
      ctx.beginPath();
      ctx.roundRect(lg.x - lg.w * 0.5, lg.y - 8, lg.w, 16, 8);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    // Hoppers + Dotted Parabolic Trajectory Preview
    for (const h of this.hoppers) {
      ctx.save();
      ctx.translate(h.x, h.y - 12);

      if (h.grounded) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        const spd = 380 + h.charge * 380;
        for (let step = 1; step <= 6; step++) {
          const t = step * 0.08;
          const px = Math.cos(h.aimAngle) * spd * t;
          const py = Math.sin(h.aimAngle) * spd * t + 0.5 * 740 * t * t;
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (h.holding && h.charge > 0.05) {
        const sweet = h.charge >= 0.72 && h.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + h.charge * Math.PI * 2);
        ctx.stroke();
      }

      const mood = h.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, h.id, 0, 0, 16, mood, this.timeElapsed, 0);
      if (h.calloutTimer > 0 && h.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(h.calloutText, 0, -28);
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
      `🦗 GRASSHOPPER HIGH JUMP • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X CLOVER' : ''}`,
      width * 0.5,
      19
    );

    this.hoppers.forEach((h, idx) => {
      ctx.fillStyle = h.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${h.id}: ${Math.round(h.score)} pts (${h.combo}x)`, 90 + idx * 170, 38);
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.hoppers].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 0,
      rankings: sorted.map((h, i) => ({
        playerId: h.id,
        score: Math.round(h.score),
        place: i + 1,
      })),
      mvpHighlight: `Parabolic Leap Champion ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
