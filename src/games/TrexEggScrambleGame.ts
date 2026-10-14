import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { AudioEngine } from '../core/AudioEngine';
import { InputRouter } from '../core/InputRouter';
import { ParticleSystem } from '../core/ParticleSystem';

type NestTheme = 'jurassic_crater' | 'tar_pit_valley' | 'crystal_cavern';

interface NestPalette {
  name: string;
  bgTop: string;
  bgBot: string;
  nestColor: string;
  rexColor: string;
}

const THEMES: Record<NestTheme, NestPalette> = {
  jurassic_crater: {
    name: 'Jurassic Caldera Nest',
    bgTop: '#14532d',
    bgBot: '#052e16',
    nestColor: '#92400e',
    rexColor: '#dc2626',
  },
  tar_pit_valley: {
    name: 'Amber Dusk Canyon',
    bgTop: '#451a03',
    bgBot: '#1c1917',
    nestColor: '#b45309',
    rexColor: '#f97316',
  },
  crystal_cavern: {
    name: 'Hollow Earth Dino Lair',
    bgTop: '#1e1b4b',
    bgBot: '#090d16',
    nestColor: '#4338ca',
    rexColor: '#ec4899',
  },
};

const THEME_KEYS: NestTheme[] = ['jurassic_crater', 'tar_pit_valley', 'crystal_cavern'];

interface DinoEgg {
  id: number;
  x: number;
  y: number;
  golden: boolean;
}

interface Raider {
  id: PlayerId;
  color: string;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  carryingGolden: boolean;
  carryingCount: number;
  score: number;
  combo: number;
  charge: number;
  holding: boolean;
  camoTimer: number;
  roaredTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class TrexEggScrambleGame extends BaseGame {
  private raiders: Raider[] = [];
  private eggs: DinoEgg[] = [];
  private rexState: 'sleeping' | 'stirring' | 'awake' = 'sleeping';
  private rexTimer = 3.5;
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
    this.rexState = 'sleeping';
    this.rexTimer = 3.5;
    this.raiders = [];
    this.eggs = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const a = (idx * Math.PI * 2) / Math.max(1, active.length);
      this.raiders.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: width * 0.5 + Math.cos(a) * 180,
        y: height * 0.54 + Math.sin(a) * 120,
        vx: 0,
        vy: 0,
        carryingGolden: false,
        carryingCount: 0,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        camoTimer: 0,
        roaredTimer: 0,
        underdog: false,
        botTimer: 0.22,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    for (let i = 0; i < 10; i++) {
      this.eggs.push(this.spawnEgg(width, height, i));
    }
  }

  private spawnEgg(width: number, height: number, id: number): DinoEgg {
    const a = Math.random() * Math.PI * 2;
    const d = 35 + Math.random() * 145;
    return {
      id,
      x: width * 0.5 + Math.cos(a) * d,
      y: height * 0.54 + Math.sin(a) * d * 0.72,
      golden: Math.random() < 0.28,
    };
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(r: Raider, text: string): void {
    r.calloutText = text;
    r.calloutTimer = 1.15;
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
      this.raiders.forEach((r) => this.showCallout(r, 'APEX RAGE 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    // T-Rex Sleep / Amber Stir / Crimson Roar state machine
    this.rexTimer -= dt;
    if (this.rexTimer <= 0) {
      if (this.rexState === 'sleeping') {
        this.rexState = 'stirring';
        this.rexTimer = 1.35;
        this.audio.playTone(220, 0.18, 'triangle');
      } else if (this.rexState === 'stirring') {
        this.rexState = 'awake';
        this.rexTimer = 1.75;
        this.audio.playExplosion();
        this.triggerHitStop(35, 9);
      } else {
        this.rexState = 'sleeping';
        this.rexTimer = this.suddenDeath ? 2.4 : 3.4;
      }
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.raiders.map((r) => r.score));

    for (const r of this.raiders) {
      r.underdog = maxScore - r.score >= 150;
      if (r.calloutTimer > 0) r.calloutTimer = Math.max(0, r.calloutTimer - dt);
      if (r.camoTimer > 0) r.camoTimer = Math.max(0, r.camoTimer - dt);
      if (r.roaredTimer > 0) {
        r.roaredTimer = Math.max(0, r.roaredTimer - dt);
        continue;
      }

      const sx = this.input.getSteer(r.id);
      const sy = this.input.getThrottle(r.id);
      const isHold = this.input.isActionPressed(r.id) || this.input.isPressed(r.id);

      const accel = 1350 * (r.underdog ? 1.15 : 1.0);
      r.vx += sx * accel * dt;
      r.vy += (sy !== 0 ? -sy : 0) * accel * dt;
      r.vx *= Math.pow(0.04, dt);
      r.vy *= Math.pow(0.04, dt);
      r.x = Math.max(width * 0.1, Math.min(width * 0.9, r.x + r.vx * dt));
      r.y = Math.max(height * 0.16, Math.min(height * 0.88, r.y + r.vy * dt));

      const speed = Math.hypot(r.vx, r.vy);

      // If T-Rex is awake and raider is moving without Camo-Bush Shield: ROARED BACK!
      if (this.rexState === 'awake' && speed > 48 && r.camoTimer <= 0 && !r.underdog) {
        r.roaredTimer = 1.25;
        r.combo = 1;
        const dx = r.x - width * 0.5;
        const dy = r.y - height * 0.54;
        const d = Math.max(1, Math.hypot(dx, dy));
        r.x = width * 0.5 + (dx / d) * 210;
        r.y = height * 0.54 + (dy / d) * 145;
        this.showCallout(r, 'ROARED BY T-REX!');
        this.audio.playStun();
        this.triggerHitStop(45, 13);
      }

      // Hold-to-charge Camo-Bush Dash & Tail-Whip Shunt (72%-98% Sweet Spot)
      if (isHold) {
        r.holding = true;
        r.charge = Math.min(1, r.charge + dt * 0.92);
      } else if (r.holding) {
        const sweet = r.charge >= 0.72 && r.charge <= 0.98;
        if (sweet) {
          r.camoTimer = 2.4;
          r.score += 85;
          r.combo = Math.min(4, r.combo + 1);
          this.showCallout(r, 'CAMO SHIELD DASH +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 11);

          // Shunt rivals so they move during the T-Rex gaze!
          for (const other of this.raiders) {
            if (other.id !== r.id && Math.hypot(other.x - r.x, other.y - r.y) < 165) {
              const dx = other.x - r.x;
              const dy = other.y - r.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              other.vx += (dx / d) * 560;
              other.vy += (dy / d) * 560;
              r.score += 70;
              this.showCallout(r, 'DINO SHOVE SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else if (r.charge > 0.98) {
          r.roaredTimer = 0.9;
          r.combo = 1;
          this.showCallout(r, 'TWIG SNAP!');
          this.audio.playStun();
        }
        r.holding = false;
        r.charge = 0;
      }

      // Collect Eggs
      for (let i = 0; i < this.eggs.length; i++) {
        const eg = this.eggs[i];
        if (Math.hypot(r.x - eg.x, r.y - eg.y) < 32) {
          const base = eg.golden ? 95 : 50;
          const pts = base * r.combo * (this.suddenDeath ? 2 : 1);
          r.score += pts;
          r.combo = Math.min(4, r.combo + 1);
          this.showCallout(r, eg.golden ? `GOLDEN EGG +${pts}!` : `DINO EGG +${pts}`);
          this.audio.playScore();
          this.particles.spawnSparks(eg.x, eg.y, '#fbbf24', 10);
          this.eggs[i] = this.spawnEgg(width, height, eg.id);
        }
      }
    }

    // Raider-to-Raider Bumping
    for (let i = 0; i < this.raiders.length; i++) {
      for (let j = i + 1; j < this.raiders.length; j++) {
        const a = this.raiders[i];
        const b = this.raiders[j];
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
    const bot = this.raiders.find((r) => r.id === botId);
    if (!bot || bot.roaredTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    // Freeze when T-Rex is stirring or awake unless shielded
    if ((this.rexState === 'awake' || this.rexState === 'stirring') && bot.camoTimer <= 0) {
      bot.vx *= 0.2;
      bot.vy *= 0.2;
      this.input.setBotState(botId, false);
      return;
    }

    let best: DinoEgg | null = null;
    let bestD = 9999;
    for (const eg of this.eggs) {
      const d = Math.hypot(eg.x - bot.x, eg.y - bot.y) - (eg.golden ? 45 : 0);
      if (d < bestD) {
        bestD = d;
        best = eg;
      }
    }

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

    // Central Nest & T-Rex Guardian
    ctx.save();
    ctx.translate(width * 0.5, height * 0.54);
    ctx.strokeStyle = pal.nestColor;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 175, 0, Math.PI * 2);
    ctx.stroke();

    // T-Rex Head & Eye Telegraph
    ctx.fillStyle = pal.rexColor;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.fill();

    const eyeColor =
      this.rexState === 'awake' ? '#ef4444' : this.rexState === 'stirring' ? '#fbbf24' : '#1e293b';
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(-14, -8, 9, 0, Math.PI * 2);
    ctx.arc(14, -8, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      this.rexState === 'awake'
        ? '🦖 FREEZE! ROAR!'
        : this.rexState === 'stirring'
        ? '⚠ STIRRING...'
        : '💤 SLEEPING',
      0,
      22
    );
    ctx.restore();

    // Render Eggs
    for (const eg of this.eggs) {
      ctx.save();
      ctx.translate(eg.x, eg.y);
      ctx.fillStyle = eg.golden ? '#fbbf24' : '#fef3c7';
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = eg.golden ? '#f59e0b' : '#4ade80';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Render Raiders
    for (const r of this.raiders) {
      ctx.save();
      ctx.translate(r.x, r.y);
      if (r.holding && r.charge > 0.05) {
        const sweet = r.charge >= 0.72 && r.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + r.charge * Math.PI * 2);
        ctx.stroke();
      }
      if (r.camoTimer > 0) {
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.stroke();
      }
      const mood = r.roaredTimer > 0 ? 'shocked' : r.camoTimer > 0 ? 'triumph' : r.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, r.id, 0, 0, 16, mood, this.timeElapsed, r.vx * 0.0005);
      if (r.calloutTimer > 0 && r.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(r.calloutText, 0, -28);
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
      `🦖 T-REX EGG SCRAMBLE • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X EGGS' : ''}`,
      width * 0.5,
      19
    );

    this.raiders.forEach((r, idx) => {
      ctx.fillStyle = r.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${r.id}: ${Math.round(r.score)} pts (${r.combo}x)`, 90 + idx * 170, 38);
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.raiders].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 1,
      rankings: sorted.map((r, i) => ({
        playerId: r.id,
        score: Math.round(r.score),
        place: i + 1,
      })),
      mvpHighlight: `Dino Nest Raider ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
