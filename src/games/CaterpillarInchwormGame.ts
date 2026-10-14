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

interface DewPickup {
  id: number;
  x: number;
  y: number;
  kind: 'dew_drop' | 'golden_nectar' | 'thorn';
}

interface Inchworm {
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
  private pickups: DewPickup[] = [];
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
    this.worms = [];
    this.pickups = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.worms.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: width * (0.28 + idx * 0.2),
        y: height * 0.54,
        vx: 0,
        vy: 0,
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

    for (let i = 0; i < 12; i++) {
      this.pickups.push(this.spawnPickup(width, height, i));
    }
  }

  private spawnPickup(width: number, height: number, id: number): DewPickup {
    const r = Math.random();
    return {
      id,
      x: width * (0.14 + Math.random() * 0.72),
      y: height * (0.18 + Math.random() * 0.66),
      kind: r < 0.25 ? 'golden_nectar' : r < 0.82 ? 'dew_drop' : 'thorn',
    };
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
      this.worms.forEach((w) => this.showCallout(w, 'BUTTERFLY SURGE 2X!'));
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
      const sy = this.input.getThrottle(w.id);
      const isHold = this.input.isActionPressed(w.id) || this.input.isPressed(w.id);

      const accel = 1300 * (w.underdog ? 1.15 : 1.0) * (w.surgeBoostTimer > 0 ? 1.35 : 1.0);
      w.vx += sx * accel * dt;
      w.vy += (sy !== 0 ? -sy : 0) * accel * dt;
      w.vx *= Math.pow(0.05, dt);
      w.vy *= Math.pow(0.05, dt);

      // Hold-to-contract Scrunch & Spring-Lunge Shunt (72%-98% Sweet Spot)
      if (isHold) {
        w.holding = true;
        w.charge = Math.min(1, w.charge + dt * 0.92);
      } else if (w.holding) {
        const sweet = w.charge >= 0.72 && w.charge <= 0.98;
        if (sweet) {
          w.surgeBoostTimer = 2.2;
          w.score += 85;
          w.combo = Math.min(4, w.combo + 1);
          this.showCallout(w, 'SPRING LUNGE +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 11);

          for (const other of this.worms) {
            if (other.id !== w.id && Math.hypot(other.x - w.x, other.y - w.y) < 165) {
              const dx = other.x - w.x;
              const dy = other.y - w.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              other.vx += (dx / d) * 520;
              other.vy += (dy / d) * 520;
              w.score += 70;
              this.showCallout(w, 'TWIG BOUNCE SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else if (w.charge > 0.98) {
          w.stunTimer = 0.9;
          w.combo = 1;
          this.showCallout(w, 'TANGLED!');
          this.audio.playStun();
        }
        w.holding = false;
        w.charge = 0;
      }

      w.x = Math.max(width * 0.1, Math.min(width * 0.9, w.x + w.vx * dt));
      w.y = Math.max(height * 0.16, Math.min(height * 0.88, w.y + w.vy * dt));

      for (let i = 0; i < this.pickups.length; i++) {
        const pk = this.pickups[i];
        if (Math.hypot(w.x - pk.x, w.y - pk.y) < 32) {
          if (pk.kind === 'thorn' && w.surgeBoostTimer <= 0 && !w.underdog) {
            w.stunTimer = 1.0;
            w.combo = 1;
            this.showCallout(w, 'ROSE THORN!');
            this.audio.playStun();
          } else {
            const base = pk.kind === 'golden_nectar' ? 95 : 50;
            const pts = base * w.combo * (this.suddenDeath ? 2 : 1);
            w.score += pts;
            w.combo = Math.min(4, w.combo + 1);
            this.showCallout(w, pk.kind === 'golden_nectar' ? `GOLDEN DEW +${pts}!` : `DEW DROP +${pts}`);
            this.audio.playScore();
            this.particles.spawnSparks(pk.x, pk.y, '#38bdf8', 10);
          }
          this.pickups[i] = this.spawnPickup(width, height, pk.id);
        }
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
    const bot = this.worms.find((w) => w.id === botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    const best = this.pickups.find((p) => p.kind !== 'thorn') ?? this.pickups[0];
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

    // Pickups
    for (const pk of this.pickups) {
      ctx.fillStyle =
        pk.kind === 'golden_nectar' ? '#fbbf24' : pk.kind === 'dew_drop' ? pal.dewColor : '#ef4444';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y, pk.kind === 'golden_nectar' ? 16 : 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Inchworms
    for (const w of this.worms) {
      ctx.save();
      ctx.translate(w.x, w.y);
      if (w.holding && w.charge > 0.05) {
        const sweet = w.charge >= 0.72 && w.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + w.charge * Math.PI * 2);
        ctx.stroke();
      }
      // Segmented caterpillar body
      ctx.fillStyle = w.color;
      ctx.beginPath();
      ctx.arc(-14, 4 - w.charge * 10, 10, 0, Math.PI * 2);
      ctx.arc(-26, 6, 9, 0, Math.PI * 2);
      ctx.fill();

      const mood = w.stunTimer > 0 ? 'shocked' : w.surgeBoostTimer > 0 ? 'triumph' : w.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, w.id, 0, 0, 16, mood, this.timeElapsed, w.vx * 0.0005);
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
      `🐛 CATERPILLAR INCHWORM • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X DEW' : ''}`,
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
      winnerId: sorted[0]?.id ?? 1,
      rankings: sorted.map((w, i) => ({
        playerId: w.id,
        score: Math.round(w.score),
        place: i + 1,
      })),
      mvpHighlight: `Dew Branch Champion ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
