import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type LeafTheme = 'emerald_rose_leaf' | 'autumn_maple' | 'neon_botanical';

interface LeafPalette {
  name: string;
  bgTop: string;
  bgBot: string;
  leafColor: string;
}

const THEMES: Record<LeafTheme, LeafPalette> = {
  emerald_rose_leaf: {
    name: 'Emerald Rose Canopy',
    bgTop: '#064e3b',
    bgBot: '#022c22',
    leafColor: '#16a34a',
  },
  autumn_maple: {
    name: 'Crimson Maple Leaf',
    bgTop: '#451a03',
    bgBot: '#1c1917',
    leafColor: '#ea580c',
  },
  neon_botanical: {
    name: 'Cyber Botanical Dome',
    bgTop: '#090d16',
    bgBot: '#1e1b4b',
    leafColor: '#10b981',
  },
};

const THEME_KEYS: LeafTheme[] = ['emerald_rose_leaf', 'autumn_maple', 'neon_botanical'];

interface AphidPrey {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  royalGolden: boolean;
}

interface LadybugPlayer {
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
  flutterTimer: number;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class LadybugAphidHuntGame extends BaseGame {
  private ladybugs: LadybugPlayer[] = [];
  private aphids: AphidPrey[] = [];
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
    this.ladybugs = [];
    this.aphids = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.ladybugs.push({
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
        flutterTimer: 0,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.22,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    for (let i = 0; i < 12; i++) {
      this.aphids.push(this.spawnAphid(width, height, i));
    }
  }

  private spawnAphid(width: number, height: number, id: number): AphidPrey {
    return {
      id,
      x: width * (0.14 + Math.random() * 0.72),
      y: height * (0.18 + Math.random() * 0.66),
      vx: (Math.random() - 0.5) * 110,
      vy: (Math.random() - 0.5) * 110,
      royalGolden: Math.random() < 0.28,
    };
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(l: LadybugPlayer, text: string): void {
    l.calloutText = text;
    l.calloutTimer = 1.15;
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
      this.ladybugs.forEach((l) => this.showCallout(l, 'ROYAL APHID SWARM 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    for (const ap of this.aphids) {
      ap.x += ap.vx * dt;
      ap.y += ap.vy * dt;
      if (ap.x < width * 0.12 || ap.x > width * 0.88) ap.vx *= -1;
      if (ap.y < height * 0.16 || ap.y > height * 0.86) ap.vy *= -1;
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.ladybugs.map((l) => l.score));

    for (const l of this.ladybugs) {
      l.underdog = maxScore - l.score >= 150;
      if (l.calloutTimer > 0) l.calloutTimer = Math.max(0, l.calloutTimer - dt);
      if (l.flutterTimer > 0) l.flutterTimer = Math.max(0, l.flutterTimer - dt);
      if (l.stunTimer > 0) {
        l.stunTimer = Math.max(0, l.stunTimer - dt);
        continue;
      }

      const sx = this.input.getSteer(l.id);
      const sy = this.input.getThrottle(l.id);
      const isHold = this.input.isActionPressed(l.id) || this.input.isPressed(l.id);

      const accel = 1380 * (l.underdog ? 1.15 : 1.0) * (l.flutterTimer > 0 ? 1.35 : 1.0);
      l.vx += sx * accel * dt;
      l.vy += (sy !== 0 ? -sy : 0) * accel * dt;
      l.vx *= Math.pow(0.05, dt);
      l.vy *= Math.pow(0.05, dt);

      // Hold-to-charge Wing-Flutter Blitz & Shell Bump Shunt (72%-98% Sweet Spot)
      if (isHold) {
        l.holding = true;
        l.charge = Math.min(1, l.charge + dt * 0.92);
      } else if (l.holding) {
        const sweet = l.charge >= 0.72 && l.charge <= 0.98;
        if (sweet) {
          l.flutterTimer = 2.2;
          l.score += 85;
          l.combo = Math.min(4, l.combo + 1);
          this.showCallout(l, 'FLUTTER BLITZ +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 11);

          for (const other of this.ladybugs) {
            if (other.id !== l.id && Math.hypot(other.x - l.x, other.y - l.y) < 170) {
              const dx = other.x - l.x;
              const dy = other.y - l.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              other.vx += (dx / d) * 520;
              other.vy += (dy / d) * 520;
              l.score += 70;
              this.showCallout(l, 'SHELL BUMP SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else if (l.charge > 0.98) {
          l.stunTimer = 0.9;
          l.combo = 1;
          this.showCallout(l, 'SHELL FLIP!');
          this.audio.playStun();
        }
        l.holding = false;
        l.charge = 0;
      }

      l.x = Math.max(width * 0.1, Math.min(width * 0.9, l.x + l.vx * dt));
      l.y = Math.max(height * 0.16, Math.min(height * 0.88, l.y + l.vy * dt));

      for (let i = 0; i < this.aphids.length; i++) {
        const ap = this.aphids[i];
        if (Math.hypot(l.x - ap.x, l.y - ap.y) < 32) {
          const base = ap.royalGolden ? 95 : 50;
          const pts = base * l.combo * (this.suddenDeath ? 2 : 1);
          l.score += pts;
          l.combo = Math.min(4, l.combo + 1);
          this.showCallout(l, ap.royalGolden ? `ROYAL APHID +${pts}!` : `APHID +${pts}`);
          this.audio.playScore();
          this.particles.spawnSparks(ap.x, ap.y, '#4ade80', 10);
          this.aphids[i] = this.spawnAphid(width, height, ap.id);
        }
      }
    }

    // Ladybug-to-Ladybug Bumping
    for (let i = 0; i < this.ladybugs.length; i++) {
      for (let j = i + 1; j < this.ladybugs.length; j++) {
        const a = this.ladybugs[i];
        const b = this.ladybugs[j];
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
    const bot = this.ladybugs.find((l) => l.id === botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    const best = this.aphids.find((a) => a.royalGolden) ?? this.aphids[0];
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

    // Aphids
    for (const ap of this.aphids) {
      ctx.fillStyle = ap.royalGolden ? '#fbbf24' : '#4ade80';
      ctx.beginPath();
      ctx.arc(ap.x, ap.y, ap.royalGolden ? 15 : 11, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ladybugs
    for (const l of this.ladybugs) {
      ctx.save();
      ctx.translate(l.x, l.y);
      if (l.holding && l.charge > 0.05) {
        const sweet = l.charge >= 0.72 && l.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + l.charge * Math.PI * 2);
        ctx.stroke();
      }
      const mood = l.stunTimer > 0 ? 'shocked' : l.flutterTimer > 0 ? 'triumph' : l.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, l.id, 0, 0, 16, mood, this.timeElapsed, l.vx * 0.0005);
      if (l.calloutTimer > 0 && l.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(l.calloutText, 0, -28);
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
      `🐞 LADYBUG APHID HUNT • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X APHIDS' : ''}`,
      width * 0.5,
      19
    );

    this.ladybugs.forEach((l, idx) => {
      ctx.fillStyle = l.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${l.id}: ${Math.round(l.score)} pts (${l.combo}x)`, 90 + idx * 170, 38);
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.ladybugs].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 1,
      rankings: sorted.map((l, i) => ({
        playerId: l.id,
        score: Math.round(l.score),
        place: i + 1,
      })),
      mvpHighlight: `Rose Leaf Champion ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
