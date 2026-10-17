import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type ColonyTheme = 'picnic_meadow' | 'red_sand_anthill' | 'crystal_burrow';

interface ColonyPalette {
  name: string;
  bgTop: string;
  bgBot: string;
  pantryColor: string;
}

const THEMES: Record<ColonyTheme, ColonyPalette> = {
  picnic_meadow: {
    name: 'Checkered Picnic Blanket',
    bgTop: '#14532d',
    bgBot: '#451a03',
    pantryColor: '#fbbf24',
  },
  red_sand_anthill: {
    name: 'Sonoran Red Clay Colony',
    bgTop: '#7c2d12',
    bgBot: '#27120b',
    pantryColor: '#f59e0b',
  },
  crystal_burrow: {
    name: 'Subterranean Crystal Nest',
    bgTop: '#1e1b4b',
    bgBot: '#090d16',
    pantryColor: '#38bdf8',
  },
};

const THEME_KEYS: ColonyTheme[] = ['picnic_meadow', 'red_sand_anthill', 'crystal_burrow'];

interface PicnicMorsel {
  id: number;
  x: number;
  y: number;
  kind: 'berry' | 'golden_sugar_cube' | 'spicy_pepper';
}

interface WorkerAnt {
  id: PlayerId;
  color: string;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  carryingGolden: boolean;
  carryingItem: boolean;
  score: number;
  combo: number;
  charge: number;
  holding: boolean;
  herculesTimer: number;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class AntColonyHaulGame extends BaseGame {
  private ants: WorkerAnt[] = [];
  private morsels: PicnicMorsel[] = [];
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
    this.ants = [];
    this.morsels = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.ants.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: width * (0.3 + idx * 0.2),
        y: height * 0.76,
        vx: 0,
        vy: 0,
        carryingGolden: false,
        carryingItem: false,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        herculesTimer: 0,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.22,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    for (let i = 0; i < 10; i++) {
      this.morsels.push(this.spawnMorsel(width, height, i));
    }
  }

  private spawnMorsel(width: number, height: number, id: number): PicnicMorsel {
    const r = Math.random();
    return {
      id,
      x: width * (0.14 + Math.random() * 0.72),
      y: height * (0.18 + Math.random() * 0.45),
      kind: r < 0.28 ? 'golden_sugar_cube' : r < 0.84 ? 'berry' : 'spicy_pepper',
    };
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(a: WorkerAnt, text: string): void {
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
      this.ants.forEach((a) => this.showCallout(a, 'COLONY FEAST 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.ants.map((a) => a.score));
    const pantryX = width * 0.5;
    const pantryY = height * 0.82;

    for (const a of this.ants) {
      a.underdog = maxScore - a.score >= 150;
      if (a.calloutTimer > 0) a.calloutTimer = Math.max(0, a.calloutTimer - dt);
      if (a.herculesTimer > 0) a.herculesTimer = Math.max(0, a.herculesTimer - dt);
      if (a.stunTimer > 0) {
        a.stunTimer = Math.max(0, a.stunTimer - dt);
        continue;
      }

      const sx = this.input.getSteer(a.id);
      const sy = this.input.getThrottle(a.id);
      const isHold = this.input.isActionPressed(a.id) || this.input.isPressed(a.id);

      const accel = 1350 * (a.underdog ? 1.15 : 1.0) * (a.herculesTimer > 0 ? 1.35 : 1.0);
      a.vx += sx * accel * dt;
      a.vy += (sy !== 0 ? -sy : 0) * accel * dt;
      a.vx *= Math.pow(0.05, dt);
      a.vy *= Math.pow(0.05, dt);

      // Hold-to-charge Hercules Mandible Sprint & Colony Shunt (72%-98% Sweet Spot)
      if (isHold) {
        a.holding = true;
        a.charge = Math.min(1, a.charge + dt * 0.92);
      } else if (a.holding) {
        const sweet = a.charge >= 0.72 && a.charge <= 0.98;
        if (sweet) {
          a.herculesTimer = 2.2;
          a.score += 85;
          a.combo = Math.min(4, a.combo + 1);
          this.showCallout(a, 'HERCULES HAUL +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 11);

          for (const other of this.ants) {
            if (other.id !== a.id && Math.hypot(other.x - a.x, other.y - a.y) < 165) {
              const dx = other.x - a.x;
              const dy = other.y - a.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              other.vx += (dx / d) * 520;
              other.vy += (dy / d) * 520;
              other.carryingItem = false;
              a.score += 70;
              this.showCallout(a, 'MANDIBLE SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else if (a.charge > 0.98) {
          a.stunTimer = 0.9;
          a.combo = 1;
          this.showCallout(a, 'HEAVY DROP!');
          this.audio.playStun();
        }
        a.holding = false;
        a.charge = 0;
      }

      a.x = Math.max(width * 0.1, Math.min(width * 0.9, a.x + a.vx * dt));
      a.y = Math.max(height * 0.16, Math.min(height * 0.88, a.y + a.vy * dt));

      for (let i = 0; i < this.morsels.length; i++) {
        const m = this.morsels[i];
        if (Math.hypot(a.x - m.x, a.y - m.y) < 32) {
          if (m.kind === 'spicy_pepper' && a.herculesTimer <= 0 && !a.underdog) {
            a.stunTimer = 1.0;
            a.combo = 1;
            this.showCallout(a, 'CHILI BURN!');
            this.audio.playStun();
          } else {
            const base = m.kind === 'golden_sugar_cube' ? 95 : 50;
            const pts = base * a.combo * (this.suddenDeath ? 2 : 1);
            a.score += pts;
            a.carryingItem = true;
            a.carryingGolden = m.kind === 'golden_sugar_cube';
            a.combo = Math.min(4, a.combo + 1);
            this.showCallout(a, m.kind === 'golden_sugar_cube' ? `GOLDEN SUGAR +${pts}!` : `BERRY +${pts}`);
            this.audio.playScore();
            this.particles.spawnSparks(m.x, m.y, '#fbbf24', 10);
          }
          this.morsels[i] = this.spawnMorsel(width, height, m.id);
        }
      }

      if (a.carryingItem && Math.hypot(a.x - pantryX, a.y - pantryY) < 48) {
        const bonus = (a.carryingGolden ? 85 : 45) * (this.suddenDeath ? 2 : 1);
        a.score += bonus;
        a.carryingItem = false;
        this.showCallout(a, `PANTRY HAUL +${bonus}!`);
        this.audio.playChime();
      }
    }

    // Ant-to-Ant Bumping
    for (let i = 0; i < this.ants.length; i++) {
      for (let j = i + 1; j < this.ants.length; j++) {
        const a = this.ants[i];
        const b = this.ants[j];
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
    width: number,
    height: number
  ): void {
    const bot = this.ants.find((a) => a.id === botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    const tx = bot.carryingItem ? width * 0.5 : (this.morsels[0]?.x ?? width * 0.5);
    const ty = bot.carryingItem ? height * 0.82 : (this.morsels[0]?.y ?? height * 0.4);
    const dx = tx - bot.x;
    const dy = ty - bot.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    bot.vx += (dx / d) * 1100 * dt;
    bot.vy += (dy / d) * 1100 * dt;

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

    // Queen's Pantry Goal
    ctx.fillStyle = pal.pantryColor;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.82, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👑 PANTRY', width * 0.5, height * 0.82 + 4);

    // Morsels
    for (const m of this.morsels) {
      ctx.fillStyle =
        m.kind === 'golden_sugar_cube' ? '#fbbf24' : m.kind === 'berry' ? '#ec4899' : '#ef4444';
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.kind === 'golden_sugar_cube' ? 16 : 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ants
    for (const a of this.ants) {
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
      const mood = a.stunTimer > 0 ? 'shocked' : a.herculesTimer > 0 ? 'triumph' : a.holding ? 'focused' : 'happy';
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
      `🐜 ANT COLONY HAUL • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X HAUL' : ''}`,
      width * 0.5,
      19
    );

    this.ants.forEach((a, idx) => {
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
    const sorted = [...this.ants].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 0,
      rankings: sorted.map((a, i) => ({
        playerId: a.id,
        score: Math.round(a.score),
        place: i + 1,
      })),
      mvpHighlight: `Colony Haul Champion ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
