import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type MeadowTheme = 'sunflower_valley' | 'lavender_provence' | 'royal_apiary';

interface MeadowPalette {
  name: string;
  bgTop: string;
  bgBot: string;
  hiveColor: string;
}

const THEMES: Record<MeadowTheme, MeadowPalette> = {
  sunflower_valley: {
    name: 'Golden Sunflower Meadow',
    bgTop: '#14532d',
    bgBot: '#052e16',
    hiveColor: '#fbbf24',
  },
  lavender_provence: {
    name: 'Provence Lavender Fields',
    bgTop: '#3b0764',
    bgBot: '#1e1b4b',
    hiveColor: '#c084fc',
  },
  royal_apiary: {
    name: 'Royal Botanical Apiary',
    bgTop: '#064e3b',
    bgBot: '#0f172a',
    hiveColor: '#f59e0b',
  },
};

const THEME_KEYS: MeadowTheme[] = ['sunflower_valley', 'lavender_provence', 'royal_apiary'];

interface Blossom {
  id: number;
  x: number;
  y: number;
  royalJelly: boolean;
}

interface PatrollingWasp {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Honeybee {
  id: PlayerId;
  color: string;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  nectarCarried: number;
  score: number;
  combo: number;
  charge: number;
  holding: boolean;
  queenBoostTimer: number;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class HoneybeeNectarRelayGame extends BaseGame {
  private bees: Honeybee[] = [];
  private blossoms: Blossom[] = [];
  private wasps: PatrollingWasp[] = [];
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
    this.bees = [];
    this.blossoms = [];
    this.wasps = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.bees.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: width * (0.3 + idx * 0.2),
        y: height * 0.54,
        vx: 0,
        vy: 0,
        nectarCarried: 0,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        queenBoostTimer: 0,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.22,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    for (let i = 0; i < 10; i++) {
      this.blossoms.push(this.spawnBlossom(width, height, i));
    }

    for (let i = 0; i < 3; i++) {
      this.wasps.push({
        x: width * (0.25 + i * 0.25),
        y: height * (0.25 + i * 0.2),
        vx: (i % 2 === 0 ? 1 : -1) * 145,
        vy: 115,
      });
    }
  }

  private spawnBlossom(width: number, height: number, id: number): Blossom {
    return {
      id,
      x: width * (0.14 + Math.random() * 0.72),
      y: height * (0.18 + Math.random() * 0.66),
      royalJelly: Math.random() < 0.28,
    };
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(b: Honeybee, text: string): void {
    b.calloutText = text;
    b.calloutTimer = 1.15;
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
      this.bees.forEach((b) => this.showCallout(b, 'ROYAL HARVEST 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    for (const w of this.wasps) {
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      if (w.x < width * 0.1 || w.x > width * 0.9) w.vx *= -1;
      if (w.y < height * 0.16 || w.y > height * 0.86) w.vy *= -1;
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.bees.map((b) => b.score));
    const hiveX = width * 0.5;
    const hiveY = height * 0.52;

    for (const b of this.bees) {
      b.underdog = maxScore - b.score >= 150;
      if (b.calloutTimer > 0) b.calloutTimer = Math.max(0, b.calloutTimer - dt);
      if (b.queenBoostTimer > 0) b.queenBoostTimer = Math.max(0, b.queenBoostTimer - dt);
      if (b.stunTimer > 0) {
        b.stunTimer = Math.max(0, b.stunTimer - dt);
        continue;
      }

      const sx = this.input.getSteer(b.id);
      const sy = this.input.getThrottle(b.id);
      const isHold = this.input.isActionPressed(b.id) || this.input.isPressed(b.id);

      // Direct 2D flight (eliminated passive auto-rotation!)
      const accel = 1400 * (b.underdog ? 1.15 : 1.0) * (b.queenBoostTimer > 0 ? 1.35 : 1.0);
      b.vx += sx * accel * dt;
      b.vy += (sy !== 0 ? -sy : 0) * accel * dt;
      b.vx *= Math.pow(0.05, dt);
      b.vy *= Math.pow(0.05, dt);

      // Hold-to-charge Pollen Vortex Dash & Buzz-Shock Shunt (72%-98% Sweet Spot)
      if (isHold) {
        b.holding = true;
        b.charge = Math.min(1, b.charge + dt * 0.92);
      } else if (b.holding) {
        const sweet = b.charge >= 0.72 && b.charge <= 0.98;
        if (sweet) {
          b.queenBoostTimer = 2.2;
          b.score += 85;
          b.combo = Math.min(4, b.combo + 1);
          this.showCallout(b, 'POLLEN VORTEX +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 11);

          for (const other of this.bees) {
            if (other.id !== b.id && Math.hypot(other.x - b.x, other.y - b.y) < 170) {
              const dx = other.x - b.x;
              const dy = other.y - b.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              other.vx += (dx / d) * 520;
              other.vy += (dy / d) * 520;
              b.score += 70;
              this.showCallout(b, 'BUZZ-SHOCK SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else if (b.charge > 0.98) {
          b.stunTimer = 0.9;
          b.combo = 1;
          this.showCallout(b, 'WING FATIGUE!');
          this.audio.playStun();
        }
        b.holding = false;
        b.charge = 0;
      }

      b.x = Math.max(width * 0.1, Math.min(width * 0.9, b.x + b.vx * dt));
      b.y = Math.max(height * 0.16, Math.min(height * 0.88, b.y + b.vy * dt));

      // Sip Blossoms
      for (let i = 0; i < this.blossoms.length; i++) {
        const bl = this.blossoms[i];
        if (Math.hypot(b.x - bl.x, b.y - bl.y) < 32) {
          const base = bl.royalJelly ? 95 : 50;
          const pts = base * b.combo * (this.suddenDeath ? 2 : 1);
          b.score += pts;
          b.nectarCarried++;
          b.combo = Math.min(4, b.combo + 1);
          this.showCallout(b, bl.royalJelly ? `ROYAL JELLY +${pts}!` : `NECTAR +${pts}`);
          this.audio.playScore();
          this.particles.spawnSparks(bl.x, bl.y, '#fbbf24', 10);
          this.blossoms[i] = this.spawnBlossom(width, height, bl.id);
        }
      }

      // Deposit Nectar at Central Golden Hive
      if (b.nectarCarried > 0 && Math.hypot(b.x - hiveX, b.y - hiveY) < 48) {
        const bonus = b.nectarCarried * 45 * (this.suddenDeath ? 2 : 1);
        b.score += bonus;
        b.nectarCarried = 0;
        this.showCallout(b, `HIVE DEPOSIT +${bonus}!`);
        this.audio.playChime();
      }

      // Wasp collisions
      for (const w of this.wasps) {
        if (Math.hypot(b.x - w.x, b.y - w.y) < 28 && b.queenBoostTimer <= 0 && !b.underdog) {
          b.stunTimer = 1.0;
          b.combo = 1;
          this.showCallout(b, 'WASP STING!');
          this.audio.playStun();
          this.triggerHitStop(40, 9);
        }
      }
    }

    // Bee-to-Bee Bumping
    for (let i = 0; i < this.bees.length; i++) {
      for (let j = i + 1; j < this.bees.length; j++) {
        const a = this.bees[i];
        const b = this.bees[j];
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
    const bot = this.bees.find((b) => b.id === botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    const best = this.blossoms.find((bl) => bl.royalJelly) ?? this.blossoms[0];
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

    // Central Golden Honeycomb Hive
    ctx.fillStyle = pal.hiveColor;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.52, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🍯 HIVE', width * 0.5, height * 0.52 + 4);

    // Blossoms
    for (const bl of this.blossoms) {
      ctx.fillStyle = bl.royalJelly ? '#fbbf24' : '#f472b6';
      ctx.beginPath();
      ctx.arc(bl.x, bl.y, bl.royalJelly ? 16 : 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Wasps
    for (const w of this.wasps) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(w.x, w.y, 13, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bees
    for (const b of this.bees) {
      ctx.save();
      ctx.translate(b.x, b.y);
      if (b.holding && b.charge > 0.05) {
        const sweet = b.charge >= 0.72 && b.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + b.charge * Math.PI * 2);
        ctx.stroke();
      }
      const mood = b.stunTimer > 0 ? 'shocked' : b.queenBoostTimer > 0 ? 'triumph' : b.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, b.id, 0, 0, 16, mood, this.timeElapsed, b.vx * 0.0005);
      if (b.calloutTimer > 0 && b.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.calloutText, 0, -28);
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
      `🐝 HONEYBEE NECTAR RELAY • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X HONEY' : ''}`,
      width * 0.5,
      19
    );

    this.bees.forEach((b, idx) => {
      ctx.fillStyle = b.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${b.id}: ${Math.round(b.score)} pts (${b.combo}x)`, 90 + idx * 170, 38);
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.bees].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 1,
      rankings: sorted.map((b, i) => ({
        playerId: b.id,
        score: Math.round(b.score),
        place: i + 1,
      })),
      mvpHighlight: `Queen's Harvest Champion ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
