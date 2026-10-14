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

interface HydroPulse {
  ownerId: PlayerId;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
}

interface AerialDrone {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  golden: boolean;
}

interface DragonflyFighter {
  id: PlayerId;
  color: string;
  isBot: boolean;
  x: number;
  y: number;
  heading: number;
  speed: number;
  score: number;
  combo: number;
  charge: number;
  holding: boolean;
  afterburnerTimer: number;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class DragonflyDogfightGame extends BaseGame {
  private fighters: DragonflyFighter[] = [];
  private pulses: HydroPulse[] = [];
  private drones: AerialDrone[] = [];
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
    this.fighters = [];
    this.pulses = [];
    this.drones = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const a = (idx * Math.PI * 2) / Math.max(1, active.length);
      this.fighters.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: width * 0.5 + Math.cos(a) * 140,
        y: height * 0.54 + Math.sin(a) * 100,
        heading: a + Math.PI,
        speed: 230,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        afterburnerTimer: 0,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.22,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    for (let i = 0; i < 6; i++) {
      this.drones.push({
        id: i,
        x: width * (0.2 + Math.random() * 0.6),
        y: height * (0.2 + Math.random() * 0.6),
        vx: (Math.random() - 0.5) * 140,
        vy: (Math.random() - 0.5) * 140,
        golden: i % 2 === 0,
      });
    }
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(f: DragonflyFighter, text: string): void {
    f.calloutText = text;
    f.calloutTimer = 1.15;
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
      this.fighters.forEach((f) => this.showCallout(f, 'MACH DOGFIGHT 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    for (const d of this.drones) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.x < width * 0.12 || d.x > width * 0.88) d.vx *= -1;
      if (d.y < height * 0.16 || d.y > height * 0.86) d.vy *= -1;
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.fighters.map((f) => f.score));

    for (const f of this.fighters) {
      f.underdog = maxScore - f.score >= 150;
      if (f.calloutTimer > 0) f.calloutTimer = Math.max(0, f.calloutTimer - dt);
      if (f.afterburnerTimer > 0) f.afterburnerTimer = Math.max(0, f.afterburnerTimer - dt);
      if (f.stunTimer > 0) {
        f.stunTimer = Math.max(0, f.stunTimer - dt);
        continue;
      }

      const steer = this.input.getSteer(f.id);
      const justTap = this.input.justPressed(f.id) || this.input.justAction(f.id);
      const isHold = this.input.isActionPressed(f.id) || this.input.isPressed(f.id);

      // 360° Jet-Fighter banking & Hydro-Pulse Cannon
      f.heading += steer * 3.8 * dt;
      const spd = (f.afterburnerTimer > 0 ? 340 : 230) * (f.underdog ? 1.15 : 1.0);
      f.x += Math.cos(f.heading) * spd * dt;
      f.y += Math.sin(f.heading) * spd * dt;

      if (f.x < width * 0.08) {
        f.x = width * 0.08;
        f.heading = Math.PI - f.heading;
      } else if (f.x > width * 0.92) {
        f.x = width * 0.92;
        f.heading = Math.PI - f.heading;
      }
      if (f.y < height * 0.14) {
        f.y = height * 0.14;
        f.heading = -f.heading;
      } else if (f.y > height * 0.88) {
        f.y = height * 0.88;
        f.heading = -f.heading;
      }

      if (justTap) {
        this.pulses.push({
          ownerId: f.id,
          color: f.color,
          x: f.x + Math.cos(f.heading) * 20,
          y: f.y + Math.sin(f.heading) * 20,
          vx: Math.cos(f.heading) * 580,
          vy: Math.sin(f.heading) * 580,
          active: true,
        });
        this.audio.playTap();
      }

      // Hold-to-charge Afterburner Barrel-Roll & Triple Hydro Salvo (72%-98% Sweet Spot)
      if (isHold) {
        f.holding = true;
        f.charge = Math.min(1, f.charge + dt * 0.92);
      } else if (f.holding) {
        const sweet = f.charge >= 0.72 && f.charge <= 0.98;
        if (sweet) {
          f.afterburnerTimer = 2.2;
          f.score += 85;
          f.combo = Math.min(4, f.combo + 1);
          this.showCallout(f, 'AFTERBURNER SALVO +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 11);

          for (const spread of [-0.22, 0, 0.22]) {
            const a = f.heading + spread;
            this.pulses.push({
              ownerId: f.id,
              color: f.color,
              x: f.x,
              y: f.y,
              vx: Math.cos(a) * 640,
              vy: Math.sin(a) * 640,
              active: true,
            });
          }
        }
        f.holding = false;
        f.charge = 0;
      }
    }

    // Update Hydro-Pulse Projectiles
    for (const p of this.pulses) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
        p.active = false;
        continue;
      }
      const owner = this.fighters.find((f) => f.id === p.ownerId);
      if (!owner) continue;

      for (const d of this.drones) {
        if (Math.hypot(p.x - d.x, p.y - d.y) < 30) {
          p.active = false;
          const pts = (d.golden ? 95 : 55) * owner.combo * (this.suddenDeath ? 2 : 1);
          owner.score += pts;
          owner.combo = Math.min(4, owner.combo + 1);
          this.showCallout(owner, d.golden ? `GOLDEN DRONE +${pts}!` : `SPLASH HIT +${pts}`);
          this.audio.playScore();
          this.particles.spawnSparks(d.x, d.y, '#38bdf8', 12);
          d.x = width * (0.2 + Math.random() * 0.6);
          d.y = height * (0.2 + Math.random() * 0.6);
          break;
        }
      }

      for (const rival of this.fighters) {
        if (rival.id !== owner.id && Math.hypot(p.x - rival.x, p.y - rival.y) < 28) {
          p.active = false;
          rival.heading += Math.PI * 0.5;
          owner.score += 70;
          this.showCallout(owner, 'DOGFIGHT TAG +70!');
          this.audio.playBounce();
          this.triggerHitStop(40, 10);
          break;
        }
      }
    }
    this.pulses = this.pulses.filter((p) => p.active);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    _difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const bot = this.fighters.find((f) => f.id === botId);
    if (!bot) return;

    const target = this.drones[0];
    if (target) {
      const desired = Math.atan2(target.y - bot.y, target.x - bot.x);
      const diff = Math.atan2(Math.sin(desired - bot.heading), Math.cos(desired - bot.heading));
      bot.heading += Math.sign(diff) * 3.0 * dt;
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

    // Drones
    for (const d of this.drones) {
      ctx.fillStyle = d.golden ? '#fbbf24' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.golden ? 16 : 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hydro-Pulse Rings
    for (const p of this.pulses) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Fighters
    for (const f of this.fighters) {
      ctx.save();
      ctx.translate(f.x, f.y);
      if (f.holding && f.charge > 0.05) {
        const sweet = f.charge >= 0.72 && f.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + f.charge * Math.PI * 2);
        ctx.stroke();
      }
      const mood = f.afterburnerTimer > 0 ? 'triumph' : f.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, f.id, 0, 0, 16, mood, this.timeElapsed, 0);
      if (f.calloutTimer > 0 && f.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(f.calloutText, 0, -28);
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
      `🛩️ DRAGONFLY DOGFIGHT • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X MACH' : ''}`,
      width * 0.5,
      19
    );

    this.fighters.forEach((f, idx) => {
      ctx.fillStyle = f.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${f.id}: ${Math.round(f.score)} pts (${f.combo}x)`, 90 + idx * 170, 38);
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.fighters].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 1,
      rankings: sorted.map((f, i) => ({
        playerId: f.id,
        score: Math.round(f.score),
        place: i + 1,
      })),
      mvpHighlight: `Dogfight Ace ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
