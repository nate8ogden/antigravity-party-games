import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type GlideTheme = 'volcano_caldera' | 'canyon_sunset' | 'azure_archipelago';

interface GlidePalette {
  name: string;
  skyTop: string;
  skyBot: string;
  ringColor: string;
  thermalColor: string;
}

const THEMES: Record<GlideTheme, GlidePalette> = {
  volcano_caldera: {
    name: 'Volcanic Thermal Sky',
    skyTop: '#450a0a',
    skyBot: '#ea580c',
    ringColor: '#fbbf24',
    thermalColor: '#f97316',
  },
  canyon_sunset: {
    name: 'Red Rock Mesa Updraft',
    skyTop: '#1e1b4b',
    skyBot: '#f59e0b',
    ringColor: '#38bdf8',
    thermalColor: '#fbbf24',
  },
  azure_archipelago: {
    name: 'Pterosaur Island Breeze',
    skyTop: '#0284c7',
    skyBot: '#bae6fd',
    ringColor: '#fde047',
    thermalColor: '#34d399',
  },
};

const THEME_KEYS: GlideTheme[] = ['volcano_caldera', 'canyon_sunset', 'azure_archipelago'];

interface SkyRing {
  id: number;
  x: number;
  y: number;
  vx: number;
  kind: 'thermal_ring' | 'golden_amber' | 'ash_cloud';
}

interface Flyer {
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
  supersonicTimer: number;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class PterodactylGlideGame extends BaseGame {
  private flyers: Flyer[] = [];
  private rings: SkyRing[] = [];
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
    this.flyers = [];
    this.rings = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.flyers.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: width * 0.24,
        y: height * (0.3 + idx * 0.16),
        vx: 0,
        vy: 0,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        supersonicTimer: 0,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.22,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    for (let i = 0; i < 10; i++) {
      this.rings.push(this.spawnRing(width, height, i));
    }
  }

  private spawnRing(width: number, height: number, id: number): SkyRing {
    const r = Math.random();
    return {
      id,
      x: width * (0.25 + Math.random() * 0.7),
      y: height * (0.16 + Math.random() * 0.68),
      vx: -(160 + Math.random() * 90),
      kind: r < 0.25 ? 'golden_amber' : r < 0.8 ? 'thermal_ring' : 'ash_cloud',
    };
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(f: Flyer, text: string): void {
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
      this.flyers.forEach((f) => this.showCallout(f, 'THERMAL UPDRAFT 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    for (const rg of this.rings) {
      rg.x += rg.vx * (this.suddenDeath ? 1.3 : 1.0) * dt;
      if (rg.x < -30) {
        rg.x = width + 30;
        rg.y = height * (0.16 + Math.random() * 0.68);
      }
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.flyers.map((f) => f.score));

    for (const f of this.flyers) {
      f.underdog = maxScore - f.score >= 150;
      if (f.calloutTimer > 0) f.calloutTimer = Math.max(0, f.calloutTimer - dt);
      if (f.supersonicTimer > 0) f.supersonicTimer = Math.max(0, f.supersonicTimer - dt);
      if (f.stunTimer > 0) f.stunTimer = Math.max(0, f.stunTimer - dt);

      const sx = this.input.getSteer(f.id);
      const sy = this.input.getThrottle(f.id);
      const justTap = this.input.justPressed(f.id) || this.input.justAction(f.id);
      const isHold = this.input.isActionPressed(f.id) || this.input.isPressed(f.id);

      // Gravity + Wing Flap / Steer
      f.vy += 320 * dt;
      f.vx += sx * 980 * (f.underdog ? 1.15 : 1.0) * dt;
      f.vy += (sy !== 0 ? -sy : 0) * 980 * dt;
      if (justTap) {
        f.vy = -260;
        this.audio.playTap();
      }

      // Hold-to-charge Falcon Swoop Dive & Wing-Gale Shunt (72%-98% Sweet Spot)
      if (isHold && f.stunTimer <= 0) {
        f.holding = true;
        f.charge = Math.min(1, f.charge + dt * 0.92);
        f.vy += 240 * dt;
      } else if (f.holding) {
        const sweet = f.charge >= 0.72 && f.charge <= 0.98;
        if (sweet) {
          f.supersonicTimer = 2.2;
          f.vy = -340;
          f.vx += 260;
          f.score += 85;
          f.combo = Math.min(4, f.combo + 1);
          this.showCallout(f, 'THERMAL SWOOP +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 11);

          for (const other of this.flyers) {
            if (other.id !== f.id && Math.hypot(other.x - f.x, other.y - f.y) < 170) {
              other.vy += (other.y >= f.y ? 1 : -1) * 420;
              f.score += 70;
              this.showCallout(f, 'WING-GALE SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else if (f.charge > 0.98) {
          f.stunTimer = 0.9;
          f.combo = 1;
          this.showCallout(f, 'STALL SPIN!');
          this.audio.playStun();
        }
        f.holding = false;
        f.charge = 0;
      }

      f.vx *= Math.pow(0.08, dt);
      f.vy *= Math.pow(0.25, dt);
      f.x = Math.max(width * 0.1, Math.min(width * 0.88, f.x + f.vx * dt));
      f.y = Math.max(height * 0.14, Math.min(height * 0.86, f.y + f.vy * dt));

      for (const rg of this.rings) {
        if (Math.hypot(f.x - rg.x, f.y - rg.y) < 36) {
          if (rg.kind === 'ash_cloud' && f.supersonicTimer <= 0 && !f.underdog) {
            f.stunTimer = 1.0;
            f.combo = 1;
            this.showCallout(f, 'VOLCANO ASH!');
            this.audio.playStun();
            this.triggerHitStop(40, 9);
          } else {
            const base = rg.kind === 'golden_amber' ? 95 : 55;
            const pts = base * f.combo * (this.suddenDeath ? 2 : 1);
            f.score += pts;
            f.combo = Math.min(4, f.combo + 1);
            this.showCallout(f, rg.kind === 'golden_amber' ? `GOLDEN AMBER +${pts}!` : `SKY RING +${pts}`);
            this.audio.playScore();
            this.particles.spawnSparks(rg.x, rg.y, '#fbbf24', 10);
          }
          rg.x = width + 30;
          rg.y = height * (0.16 + Math.random() * 0.68);
        }
      }
    }

    // Flyer-to-Flyer Mid-Air Bumping
    for (let i = 0; i < this.flyers.length; i++) {
      for (let j = i + 1; j < this.flyers.length; j++) {
        const a = this.flyers[i];
        const b = this.flyers[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < 38) {
          const nx = dx / dist;
          const ny = dy / dist;
          a.vx -= nx * 260;
          a.vy -= ny * 260;
          b.vx += nx * 260;
          b.vy += ny * 260;
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
    height: number
  ): void {
    const bot = this.flyers.find((f) => f.id === botId);
    if (!bot) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    let targetY = height * 0.5;
    let bestD = 9999;
    for (const rg of this.rings) {
      if (rg.kind === 'ash_cloud' || rg.x < bot.x - 20) continue;
      const d = Math.hypot(rg.x - bot.x, rg.y - bot.y);
      if (d < bestD) {
        bestD = d;
        targetY = rg.y;
      }
    }

    bot.vy += Math.sign(targetY - bot.y) * 780 * dt;
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

    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, pal.skyTop);
    sky.addColorStop(1, pal.skyBot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    // Rings
    for (const rg of this.rings) {
      ctx.save();
      ctx.translate(rg.x, rg.y);
      if (rg.kind === 'golden_amber') {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★95', 0, 4);
      } else if (rg.kind === 'thermal_ring') {
        ctx.strokeStyle = pal.ringColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 22, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Flyers
    for (const f of this.flyers) {
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

      // Pterosaur Wings
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.moveTo(-22, -6);
      ctx.lineTo(22, -6);
      ctx.lineTo(0, 10);
      ctx.closePath();
      ctx.fill();

      const mood = f.stunTimer > 0 ? 'shocked' : f.supersonicTimer > 0 ? 'triumph' : f.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, f.id, 0, -4, 15, mood, this.timeElapsed, f.vy * 0.001);
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
      `🦅 PTERODACTYL GLIDE • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X THERMAL' : ''}`,
      width * 0.5,
      19
    );

    this.flyers.forEach((f, idx) => {
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
    const sorted = [...this.flyers].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 1,
      rankings: sorted.map((f, i) => ({
        playerId: f.id,
        score: Math.round(f.score),
        place: i + 1,
      })),
      mvpHighlight: `Sky Thermal Ace ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
