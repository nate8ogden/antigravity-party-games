import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type FireflyTheme = 'midnight_meadow' | 'lantern_marsh' | 'starlight_glade';

interface FireflyPalette {
  name: string;
  bgTop: string;
  bgBot: string;
  glowColor: string;
}

const THEMES: Record<FireflyTheme, FireflyPalette> = {
  midnight_meadow: {
    name: 'Midnight Meadow Beacon',
    bgTop: '#020617',
    bgBot: '#064e3b',
    glowColor: '#fde047',
  },
  lantern_marsh: {
    name: 'Bioluminescent Bayou',
    bgTop: '#090d16',
    bgBot: '#1e1b4b',
    glowColor: '#22d3ee',
  },
  starlight_glade: {
    name: 'Fairy Lantern Woods',
    bgTop: '#1e1035',
    bgBot: '#0f172a',
    glowColor: '#4ade80',
  },
};

const THEME_KEYS: FireflyTheme[] = ['midnight_meadow', 'lantern_marsh', 'starlight_glade'];

interface PulseRing {
  radius: number;
  golden: boolean;
  hitBy: Set<PlayerId>;
}

interface FireflyPlayer {
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
  flashGlowTimer: number;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class FireflyNightBeaconGame extends BaseGame {
  private fireflies: FireflyPlayer[] = [];
  private pulseRings: PulseRing[] = [];
  private spawnRingTimer = 1.6;
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
    this.pulseRings = [{ radius: 30, golden: false, hitBy: new Set() }];
    this.fireflies = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const a = (idx * Math.PI * 2) / Math.max(1, active.length);
      this.fireflies.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: width * 0.5 + Math.cos(a) * 145,
        y: height * 0.54 + Math.sin(a) * 115,
        vx: 0,
        vy: 0,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        flashGlowTimer: 0,
        stunTimer: 0,
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

  private showCallout(f: FireflyPlayer, text: string): void {
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
      this.fireflies.forEach((f) => this.showCallout(f, 'HARMONY RESONANCE 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    // Spawn expanding Mother Beacon Rhythm Rings
    this.spawnRingTimer -= dt;
    if (this.spawnRingTimer <= 0) {
      this.spawnRingTimer = this.suddenDeath ? 1.15 : 1.55;
      this.pulseRings.push({
        radius: 20,
        golden: Math.random() < 0.3,
        hitBy: new Set(),
      });
    }

    for (const rg of this.pulseRings) {
      rg.radius += 165 * dt;
    }
    this.pulseRings = this.pulseRings.filter((rg) => rg.radius < 340);

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.fireflies.map((f) => f.score));
    const cx = width * 0.5;
    const cy = height * 0.54;

    for (const f of this.fireflies) {
      f.underdog = maxScore - f.score >= 150;
      if (f.calloutTimer > 0) f.calloutTimer = Math.max(0, f.calloutTimer - dt);
      if (f.flashGlowTimer > 0) f.flashGlowTimer = Math.max(0, f.flashGlowTimer - dt);
      if (f.stunTimer > 0) {
        f.stunTimer = Math.max(0, f.stunTimer - dt);
        continue;
      }

      const sx = this.input.getSteer(f.id);
      const sy = this.input.getThrottle(f.id);
      const pCfg = this.getPlayer(f.id);
      const isBot = pCfg ? pCfg.type.startsWith('bot_') : false;
      const hasSteer = this.input.hasSteer(f.id);

      const justTap = this.input.justAction(f.id) || (isBot && this.input.justPressed(f.id)) || (!hasSteer && !isBot && this.input.justPressed(f.id));
      const isHold = this.input.isActionPressed(f.id) || (isBot && this.input.isPressed(f.id)) || (!hasSteer && !isBot && this.input.isPressed(f.id));

      const accel = 1350 * (f.underdog ? 1.15 : 1.0);
      f.vx += sx * accel * dt;
      f.vy += (sy !== 0 ? -sy : 0) * accel * dt;
      f.vx *= Math.pow(0.05, dt);
      f.vy *= Math.pow(0.05, dt);
      f.x = Math.max(width * 0.1, Math.min(width * 0.9, f.x + f.vx * dt));
      f.y = Math.max(height * 0.16, Math.min(height * 0.88, f.y + f.vy * dt));

      const distFromBeacon = Math.hypot(f.x - cx, f.y - cy);

      if (justTap) {
        f.flashGlowTimer = 0.35;
        this.checkRingSync(f, distFromBeacon, false);
      }

      // Hold-to-charge Solar Resonance Flash & Dazzle Shunt (72%-98% Sweet Spot)
      if (isHold) {
        f.holding = true;
        f.charge = Math.min(1, f.charge + dt * 0.92);
      } else if (f.holding) {
        const sweet = f.charge >= 0.72 && f.charge <= 0.98;
        if (sweet) {
          f.flashGlowTimer = 1.2;
          this.checkRingSync(f, distFromBeacon, true);
          f.score += 85;
          f.combo = Math.min(4, f.combo + 1);
          this.showCallout(f, 'SOLAR BEACON SYNC +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 11);

          for (const other of this.fireflies) {
            if (other.id !== f.id && Math.hypot(other.x - f.x, other.y - f.y) < 170) {
              const dx = other.x - f.x;
              const dy = other.y - f.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              other.vx += (dx / d) * 520;
              other.vy += (dy / d) * 520;
              f.score += 70;
              this.showCallout(f, 'DAZZLE SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else if (f.charge > 0.98) {
          f.stunTimer = 0.85;
          f.combo = 1;
          this.showCallout(f, 'LANTERN FLICKER!');
          this.audio.playStun();
        }
        f.holding = false;
        f.charge = 0;
      }
    }

    // Firefly-to-Firefly Bumping
    for (let i = 0; i < this.fireflies.length; i++) {
      for (let j = i + 1; j < this.fireflies.length; j++) {
        const a = this.fireflies[i];
        const b = this.fireflies[j];
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

  private checkRingSync(f: FireflyPlayer, distFromBeacon: number, wideWindow: boolean): void {
    const tol = wideWindow ? 65 : 36;
    for (const rg of this.pulseRings) {
      if (!rg.hitBy.has(f.id) && Math.abs(rg.radius - distFromBeacon) < tol) {
        rg.hitBy.add(f.id);
        const base = rg.golden ? 95 : 65;
        const pts = base * f.combo * (this.suddenDeath ? 2 : 1);
        f.score += pts;
        f.combo = Math.min(4, f.combo + 1);
        this.showCallout(f, rg.golden ? `GOLDEN SYNC +${pts}!` : `HARMONY SYNC +${pts}!`);
        this.audio.playChime();
        this.particles.spawnSparks(f.x, f.y, '#fde047', 12);
        return;
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
    const bot = this.fireflies.find((f) => f.id === botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    const cx = width * 0.5;
    const cy = height * 0.54;
    const dist = Math.hypot(bot.x - cx, bot.y - cy);
    const rg = this.pulseRings[0];
    if (rg) {
      const dir = rg.radius > dist ? 1 : -1;
      const dx = (bot.x - cx) / Math.max(1, dist);
      const dy = (bot.y - cy) / Math.max(1, dist);
      bot.vx += dx * dir * 900 * dt;
      bot.vy += dy * dir * 900 * dt;
    }

    const hold = !bot.holding || bot.charge < bot.botChargeGoal;
    this.input.setBotInput(botId, hold, Math.sign(bot.vx), Math.sign(-bot.vy), hold);
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

    const cx = width * 0.5;
    const cy = height * 0.54;

    // Central Mother Beacon Lantern
    ctx.fillStyle = pal.glowColor;
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.fill();

    // Expanding Rhythm Pulse Rings
    for (const rg of this.pulseRings) {
      ctx.strokeStyle = rg.golden ? '#fbbf24' : pal.glowColor;
      ctx.lineWidth = rg.golden ? 5 : 3;
      ctx.beginPath();
      ctx.arc(cx, cy, rg.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Fireflies
    for (const f of this.fireflies) {
      ctx.save();
      ctx.translate(f.x, f.y);
      if (f.flashGlowTimer > 0) {
        ctx.fillStyle = 'rgba(253,224,71,0.35)';
        ctx.beginPath();
        ctx.arc(0, 0, 34, 0, Math.PI * 2);
        ctx.fill();
      }
      if (f.holding && f.charge > 0.05) {
        const sweet = f.charge >= 0.72 && f.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + f.charge * Math.PI * 2);
        ctx.stroke();
      }
      const mood = f.stunTimer > 0 ? 'shocked' : f.flashGlowTimer > 0 ? 'triumph' : f.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, f.id, 0, 0, 16, mood, this.timeElapsed, f.vx * 0.0005);
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
      `✨ FIREFLY NIGHT BEACON • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X SYNC' : ''}`,
      width * 0.5,
      19
    );

    this.fireflies.forEach((f, idx) => {
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
    const sorted = [...this.fireflies].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 0,
      rankings: sorted.map((f, i) => ({
        playerId: f.id,
        score: Math.round(f.score),
        place: i + 1,
      })),
      mvpHighlight: `Beacon Harmony Master ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(x: number, y: number, width: number, height: number): boolean {
    if (this.isFinished) return false;
    if (y <= 48) {
      this.themeIdx = (this.themeIdx + 1) % THEME_KEYS.length;
      this.audio.playTap();
      return true;
    }
    const midX = width / 2;
    const active = this.fireflies.filter((f) => {
      const pCfg = this.getPlayer(f.id);
      return pCfg && !pCfg.type.startsWith('bot_');
    });
    const firefly = active.find((f) => (f.id === 0 ? x < midX : x >= midX)) || active[0];
    if (firefly && firefly.stunTimer <= 0) {
      const dx = x - firefly.x;
      const dy = y - firefly.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      firefly.vx += (dx / dist) * 440;
      firefly.vy += (dy / dist) * 440;
      firefly.flashGlowTimer = 0.4;
      this.checkRingSync(firefly, Math.hypot(firefly.x - width * 0.5, firefly.y - height * 0.54), false);
      this.audio.playTap();
      return true;
    }
    return false;
  }
}
