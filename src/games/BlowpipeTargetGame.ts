import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type BlowpipeTheme = 'aztec_sun_temple' | 'mayan_jade_ruins' | 'inca_gold_citadel';

interface BlowpipePalette {
  name: string;
  bgTop: string;
  bgBot: string;
  stoneColor: string;
  goldColor: string;
}

const THEMES: Record<BlowpipeTheme, BlowpipePalette> = {
  aztec_sun_temple: {
    name: 'Aztec Golden Sun Gallery',
    bgTop: '#451a03',
    bgBot: '#1c1917',
    stoneColor: '#d97706',
    goldColor: '#fbbf24',
  },
  mayan_jade_ruins: {
    name: 'Mayan Jade Mask Ruins',
    bgTop: '#064e3b',
    bgBot: '#022c22',
    stoneColor: '#10b981',
    goldColor: '#34d399',
  },
  inca_gold_citadel: {
    name: 'Inca Cloud Citadel',
    bgTop: '#1e1b4b',
    bgBot: '#090d16',
    stoneColor: '#38bdf8',
    goldColor: '#fde047',
  },
};

const THEME_KEYS: BlowpipeTheme[] = ['aztec_sun_temple', 'mayan_jade_ruins', 'inca_gold_citadel'];

interface RelicTarget {
  id: number;
  x: number;
  y: number;
  vx: number;
  kind: 'stone_mask' | 'golden_sun' | 'cursed_totem';
}

interface DartShot {
  ownerId: PlayerId;
  x: number;
  y: number;
  vy: number;
  sonic: boolean;
  active: boolean;
}

interface Hunter {
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

export class BlowpipeTargetGame extends BaseGame {
  private hunters: Hunter[] = [];
  private targets: RelicTarget[] = [];
  private darts: DartShot[] = [];
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
    this.hunters = [];
    this.targets = [];
    this.darts = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.hunters.push({
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
      { id: 1, x: width * 0.25, y: height * 0.26, vx: 155, kind: 'golden_sun' },
      { id: 2, x: width * 0.5, y: height * 0.36, vx: -135, kind: 'stone_mask' },
      { id: 3, x: width * 0.75, y: height * 0.3, vx: 145, kind: 'stone_mask' },
      { id: 4, x: width * 0.4, y: height * 0.46, vx: 175, kind: 'cursed_totem' },
    ];
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(h: Hunter, text: string): void {
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
      this.hunters.forEach((h) => this.showCallout(h, 'SUN TEMPLE 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    for (const t of this.targets) {
      t.x += t.vx * (this.suddenDeath ? 1.3 : 1.0) * dt;
      if (t.x < width * 0.14 || t.x > width * 0.86) t.vx *= -1;
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.hunters.map((h) => h.score));

    for (const h of this.hunters) {
      h.underdog = maxScore - h.score >= 150;
      if (h.calloutTimer > 0) h.calloutTimer = Math.max(0, h.calloutTimer - dt);
      if (h.stunTimer > 0) {
        h.stunTimer = Math.max(0, h.stunTimer - dt);
        continue;
      }

      const steer = this.input.getSteer(h.id);
      const justTap = this.input.justPressed(h.id) || this.input.justAction(h.id);
      const isHold = this.input.isActionPressed(h.id) || this.input.isPressed(h.id);

      h.vx += steer * 1450 * (h.underdog ? 1.15 : 1.0) * dt;
      h.vx *= Math.pow(0.06, dt);
      h.x = Math.max(width * 0.12, Math.min(width * 0.88, h.x + h.vx * dt));

      if (isHold) {
        h.holding = true;
        h.charge = Math.min(1, h.charge + dt * 0.94);
      } else if (h.holding) {
        const sweet = h.charge >= 0.72 && h.charge <= 0.98;
        if (h.charge > 0.98) {
          h.stunTimer = 0.9;
          h.combo = 1;
          this.showCallout(h, 'OUT OF BREATH!');
          this.audio.playStun();
        } else {
          this.darts.push({
            ownerId: h.id,
            x: h.x,
            y: h.y - 24,
            vy: sweet ? -840 : -560,
            sonic: sweet,
            active: true,
          });
          if (sweet) {
            this.showCallout(h, 'SONIC DART!');
            this.audio.playBoost();
            for (const other of this.hunters) {
              if (other.id !== h.id && Math.abs(other.x - h.x) < 125) {
                other.vx += (other.x >= h.x ? 1 : -1) * 520;
                h.score += 70;
                this.showCallout(h, 'BAMBOO GUST SHUNT +70!');
                this.audio.playBounce();
              }
            }
          } else {
            this.audio.playTap();
          }
        }
        h.holding = false;
        h.charge = 0;
      } else if (justTap) {
        this.darts.push({
          ownerId: h.id,
          x: h.x,
          y: h.y - 24,
          vy: -540,
          sonic: false,
          active: true,
        });
        this.audio.playTap();
      }
    }

    for (const d of this.darts) {
      if (!d.active) continue;
      d.y += d.vy * dt;
      if (d.y < 30) {
        d.active = false;
        continue;
      }
      const owner = this.hunters.find((h) => h.id === d.ownerId);
      if (!owner) continue;

      for (const t of this.targets) {
        if (Math.hypot(d.x - t.x, d.y - t.y) < (d.sonic ? 42 : 28)) {
          d.active = false;
          if (t.kind === 'cursed_totem' && !d.sonic && !owner.underdog) {
            owner.stunTimer = 1.0;
            owner.combo = 1;
            this.showCallout(owner, 'CURSED TOTEM!');
            this.audio.playStun();
          } else {
            const base = t.kind === 'golden_sun' ? 95 : 55;
            const pts = (base + (d.sonic ? 30 : 0)) * owner.combo * (this.suddenDeath ? 2 : 1);
            owner.score += pts;
            owner.combo = Math.min(4, owner.combo + 1);
            this.showCallout(owner, t.kind === 'golden_sun' ? `GOLDEN SUN +${pts}!` : `MASK HIT +${pts}`);
            this.audio.playScore();
            this.particles.spawnSparks(t.x, t.y, '#fbbf24', 12);
            this.triggerHitStop(45, 11);
          }
          break;
        }
      }
    }
    this.darts = this.darts.filter((d) => d.active);

    // Hunter-to-Hunter Bumping
    for (let i = 0; i < this.hunters.length; i++) {
      for (let j = i + 1; j < this.hunters.length; j++) {
        const a = this.hunters[i];
        const b = this.hunters[j];
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
    const bot = this.hunters.find((h) => h.id === botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      const valid = this.targets.filter((t) => t.kind !== 'cursed_totem');
      const pick = valid[Math.floor(Math.random() * valid.length)] ?? this.targets[0];
      bot.botTargetX = pick ? pick.x + pick.vx * 0.3 : width * 0.5;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    const diff = bot.botTargetX - bot.x;
    bot.vx += Math.sign(diff) * 1150 * dt;
    const hold = (Math.abs(diff) < 55 && !bot.holding) || (bot.holding && bot.charge < bot.botChargeGoal);
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
      ctx.save();
      ctx.translate(t.x, t.y);
      if (t.kind === 'golden_sun') {
        ctx.fillStyle = pal.goldColor;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('☀95', 0, 4);
      } else if (t.kind === 'stone_mask') {
        ctx.fillStyle = pal.stoneColor;
        ctx.fillRect(-18, -18, 36, 36);
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, 0, 17, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Darts
    for (const d of this.darts) {
      ctx.strokeStyle = d.sonic ? '#fbbf24' : '#ffffff';
      ctx.lineWidth = d.sonic ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x, d.y + 18);
      ctx.stroke();
    }

    // Hunters
    for (const h of this.hunters) {
      ctx.save();
      ctx.translate(h.x, h.y);
      if (h.holding && h.charge > 0.05) {
        const sweet = h.charge >= 0.72 && h.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 28, -Math.PI / 2, -Math.PI / 2 + h.charge * Math.PI * 2);
        ctx.stroke();
      }
      const mood = h.stunTimer > 0 ? 'shocked' : h.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, h.id, 0, 0, 18, mood, this.timeElapsed, h.vx * 0.0005);
      if (h.calloutTimer > 0 && h.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(h.calloutText, 0, -32);
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
      `🎋 BLOWPIPE TARGET • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X SUN' : ''}`,
      width * 0.5,
      19
    );

    this.hunters.forEach((h, idx) => {
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
    const sorted = [...this.hunters].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 1,
      rankings: sorted.map((h, i) => ({
        playerId: h.id,
        score: Math.round(h.score),
        place: i + 1,
      })),
      mvpHighlight: `Blowpipe Sharpshooter ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
