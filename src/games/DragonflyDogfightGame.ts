import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type PondTheme = 'lily_pond' | 'koi_sanctuary' | 'neon_wetlands';

interface PondPalette {
  name: string;
  bgTop: string;
  bgBot: string;
  lilyColor: string;
}

const THEMES: Record<PondTheme, PondPalette> = {
  lily_pond: {
    name: 'Tranquil Lily Pond',
    bgTop: '#0369a1',
    bgBot: '#0c4a6e',
    lilyColor: '#4ade80',
  },
  koi_sanctuary: {
    name: 'Imperial Koi Sanctuary',
    bgTop: '#115e59',
    bgBot: '#042f2e',
    lilyColor: '#34d399',
  },
  neon_wetlands: {
    name: 'Cyber Dragonfly Lagoon',
    bgTop: '#1e1b4b',
    bgBot: '#090d16',
    lilyColor: '#22d3ee',
  },
};

const THEME_KEYS: PondTheme[] = ['lily_pond', 'koi_sanctuary', 'neon_wetlands'];

interface AerialTarget {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  goldenDamselfly: boolean;
}

interface DragonflyAce {
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
  machTimer: number;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class DragonflyDogfightGame extends BaseGame {
  private aces: DragonflyAce[] = [];
  private targets: AerialTarget[] = [];
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
    this.aces = [];
    this.targets = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.aces.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: width * (0.3 + idx * 0.2),
        y: height * 0.54,
        vx: 0,
        vy: 0,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        machTimer: 0,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.22,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    for (let i = 0; i < 12; i++) {
      this.targets.push(this.spawnTarget(width, height, i));
    }
  }

  private spawnTarget(width: number, height: number, id: number): AerialTarget {
    return {
      id,
      x: width * (0.14 + Math.random() * 0.72),
      y: height * (0.18 + Math.random() * 0.66),
      vx: (Math.random() - 0.5) * 140,
      vy: (Math.random() - 0.5) * 140,
      goldenDamselfly: Math.random() < 0.28,
    };
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(a: DragonflyAce, text: string): void {
    a.calloutText = text;
    a.calloutTimer = 1.15;
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
      this.aces.forEach((a) => this.showCallout(a, 'SUPERSONIC DOGFIGHT 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    for (const t of this.targets) {
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.x < width * 0.12 || t.x > width * 0.88) t.vx *= -1;
      if (t.y < height * 0.16 || t.y > height * 0.86) t.vy *= -1;
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.aces.map((a) => a.score));

    for (const a of this.aces) {
      a.underdog = maxScore - a.score >= 150;
      if (a.calloutTimer > 0) a.calloutTimer = Math.max(0, a.calloutTimer - dt);
      if (a.machTimer > 0) a.machTimer = Math.max(0, a.machTimer - dt);
      if (a.stunTimer > 0) {
        a.stunTimer = Math.max(0, a.stunTimer - dt);
        continue;
      }

      const sx = this.input.getSteer(a.id);
      const sy = this.input.getThrottle(a.id);
      const isHold = this.input.isActionPressed(a.id) || this.input.isPressed(a.id);

      const accel = 1420 * (a.underdog ? 1.15 : 1.0) * (a.machTimer > 0 ? 1.38 : 1.0);
      a.vx += sx * accel * dt;
      a.vy += (sy !== 0 ? -sy : 0) * accel * dt;
      a.vx *= Math.pow(0.05, dt);
      a.vy *= Math.pow(0.05, dt);

      // Hold-to-charge Supersonic Hover-Dash & Sonic Boom Shunt (72%-98% Sweet Spot)
      if (isHold) {
        a.holding = true;
        a.charge = Math.min(1, a.charge + dt * 0.92);
      } else if (a.holding) {
        const sweet = a.charge >= 0.72 && a.charge <= 0.98;
        if (sweet) {
          a.machTimer = 2.2;
          a.score += 85;
          a.combo = Math.min(4, a.combo + 1);
          this.showCallout(a, 'SUPERSONIC DASH +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 11);

          for (const other of this.aces) {
            if (other.id !== a.id && Math.hypot(other.x - a.x, other.y - a.y) < 170) {
              const dx = other.x - a.x;
              const dy = other.y - a.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              other.vx += (dx / d) * 540;
              other.vy += (dy / d) * 540;
              a.score += 70;
              this.showCallout(a, 'SONIC BOOM SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else if (a.charge > 0.98) {
          a.stunTimer = 0.9;
          a.combo = 1;
          this.showCallout(a, 'WING STALL!');
          this.audio.playStun();
        }
        a.holding = false;
        a.charge = 0;
      }

      a.x = Math.max(width * 0.1, Math.min(width * 0.9, a.x + a.vx * dt));
      a.y = Math.max(height * 0.16, Math.min(height * 0.88, a.y + a.vy * dt));

      for (let i = 0; i < this.targets.length; i++) {
        const t = this.targets[i];
        if (Math.hypot(a.x - t.x, a.y - t.y) < 32) {
          const base = t.goldenDamselfly ? 95 : 50;
          const pts = base * a.combo * (this.suddenDeath ? 2 : 1);
          a.score += pts;
          a.combo = Math.min(4, a.combo + 1);
          this.showCallout(a, t.goldenDamselfly ? `GOLDEN FLY +${pts}!` : `INTERCEPT +${pts}`);
          this.audio.playScore();
          this.particles.spawnSparks(t.x, t.y, '#38bdf8', 10);
          this.targets[i] = this.spawnTarget(width, height, t.id);
        }
      }
    }

    // Ace-to-Ace Dogfight Bumping
    for (let i = 0; i < this.aces.length; i++) {
      for (let j = i + 1; j < this.aces.length; j++) {
        const a = this.aces[i];
        const b = this.aces[j];
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
    const bot = this.aces.find((a) => a.id === botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    const best = this.targets.find((t) => t.goldenDamselfly) ?? this.targets[0];
    if (best) {
      const dx = best.x - bot.x;
      const dy = best.y - bot.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      bot.vx += (dx / d) * 1150 * dt;
      bot.vy += (dy / d) * 1150 * dt;
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

    // Targets
    for (const t of this.targets) {
      ctx.fillStyle = t.goldenDamselfly ? '#fbbf24' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.goldenDamselfly ? 16 : 11, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dragonfly Aces
    for (const a of this.aces) {
      ctx.save();
      ctx.translate(a.x, a.y);
      if (a.holding && a.charge > 0.05) {
        const sweet = a.charge >= 0.72 && a.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + a.charge * Math.PI * 2);
        ctx.stroke();
      }
      const mood = a.stunTimer > 0 ? 'shocked' : a.machTimer > 0 ? 'triumph' : a.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, a.id, 0, 0, 16, mood, this.timeElapsed, a.vx * 0.0005);
      if (a.calloutTimer > 0 && a.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(a.calloutText, 0, -28);
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
      `蜻 DRAGONFLY DOGFIGHT • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X MACH' : ''}`,
      width * 0.5,
      19
    );

    this.aces.forEach((a, idx) => {
      ctx.fillStyle = a.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${a.id}: ${Math.round(a.score)} pts (${a.combo}x)`, 90 + idx * 170, 38);
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.aces].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 1,
      rankings: sorted.map((a, i) => ({
        playerId: a.id,
        score: Math.round(a.score),
        place: i + 1,
      })),
      mvpHighlight: `Lily Pond Aerial Ace ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
