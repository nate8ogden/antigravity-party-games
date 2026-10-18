import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type LavaTheme = 'magma_caldera' | 'blue_sulfur_crater' | 'obsidian_forge';

interface LavaPalette {
  name: string;
  lavaTop: string;
  lavaBot: string;
  pillarColor: string;
}

const THEMES: Record<LavaTheme, LavaPalette> = {
  magma_caldera: {
    name: 'Kilauea Magma Caldera',
    lavaTop: '#7f1d1d',
    lavaBot: '#ea580c',
    pillarColor: '#27272a',
  },
  blue_sulfur_crater: {
    name: 'Ijen Blue Fire Crater',
    lavaTop: '#1e1b4b',
    lavaBot: '#0284c7',
    pillarColor: '#334155',
  },
  obsidian_forge: {
    name: 'Golden Obsidian Core',
    lavaTop: '#451a03',
    lavaBot: '#d97706',
    pillarColor: '#18181b',
  },
};

const THEME_KEYS: LavaTheme[] = ['magma_caldera', 'blue_sulfur_crater', 'obsidian_forge'];

interface BasaltPillar {
  id: number;
  x: number;
  y: number;
  state: 'solid' | 'rumbling' | 'submerged';
  timer: number;
  hasRuby: boolean;
  hasGoldenCrown: boolean;
}

interface LavaHopper {
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
  magmaShieldTimer: number;
  singedTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class VolcanoLavaLeapGame extends BaseGame {
  private hoppers: LavaHopper[] = [];
  private pillars: BasaltPillar[] = [];
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
    this.hoppers = [];
    this.pillars = [];

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        this.pillars.push({
          id: r * 4 + c,
          x: width * (0.2 + c * 0.2),
          y: height * (0.28 + r * 0.24),
          state: 'solid',
          timer: 2.0 + Math.random() * 4.0,
          hasRuby: Math.random() < 0.55,
          hasGoldenCrown: Math.random() < 0.22,
        });
      }
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const startPillar = this.pillars[idx % this.pillars.length];
      this.hoppers.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: startPillar.x,
        y: startPillar.y,
        vx: 0,
        vy: 0,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        magmaShieldTimer: 0,
        singedTimer: 0,
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

  private showCallout(h: LavaHopper, text: string): void {
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
      this.hoppers.forEach((h) => this.showCallout(h, 'ERUPTION 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    for (const pl of this.pillars) {
      pl.timer -= dt;
      if (pl.timer <= 0) {
        if (pl.state === 'solid') {
          pl.state = 'rumbling';
          pl.timer = 1.4;
        } else if (pl.state === 'rumbling') {
          pl.state = 'submerged';
          pl.timer = 1.6;
        } else {
          pl.state = 'solid';
          pl.timer = 3.0 + Math.random() * 2.5;
          pl.hasRuby = Math.random() < 0.6;
          pl.hasGoldenCrown = Math.random() < 0.25;
        }
      }
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.hoppers.map((h) => h.score));

    for (const h of this.hoppers) {
      h.underdog = maxScore - h.score >= 150;
      if (h.calloutTimer > 0) h.calloutTimer = Math.max(0, h.calloutTimer - dt);
      if (h.magmaShieldTimer > 0) h.magmaShieldTimer = Math.max(0, h.magmaShieldTimer - dt);
      if (h.singedTimer > 0) {
        h.singedTimer = Math.max(0, h.singedTimer - dt);
        continue;
      }

      const sx = this.input.getSteer(h.id);
      const sy = this.input.getThrottle(h.id);
      const pCfg = this.getPlayer(h.id);
      const isBot = pCfg ? pCfg.type.startsWith('bot_') : false;
      const hasSteer = this.input.hasSteer(h.id);

      const isHold = this.input.isActionPressed(h.id) || (isBot && this.input.isPressed(h.id)) || (!hasSteer && !isBot && this.input.isPressed(h.id));

      const accel = 1350 * (h.underdog ? 1.15 : 1.0);
      h.vx += sx * accel * dt;
      h.vy += (sy !== 0 ? -sy : 0) * accel * dt;
      h.vx *= Math.pow(0.05, dt);
      h.vy *= Math.pow(0.05, dt);

      // Hold-to-charge Meteor Slam Leap & Magma Shunt (72%-98% Sweet Spot)
      if (isHold) {
        h.holding = true;
        h.charge = Math.min(1, h.charge + dt * 0.92);
      } else if (h.holding) {
        const sweet = h.charge >= 0.72 && h.charge <= 0.98;
        if (sweet) {
          h.magmaShieldTimer = 2.4;
          h.score += 85;
          h.combo = Math.min(4, h.combo + 1);
          this.showCallout(h, 'METEOR LEAP +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 11);

          for (const other of this.hoppers) {
            if (other.id !== h.id && Math.hypot(other.x - h.x, other.y - h.y) < 170) {
              const dx = other.x - h.x;
              const dy = other.y - h.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              other.vx += (dx / (d || 0.001)) * 540;
              other.vy += (dy / (d || 0.001)) * 540;
              h.score += 70;
              this.showCallout(h, 'BASALT SHOCK SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else if (h.charge > 0.98) {
          h.singedTimer = 0.9;
          h.combo = 1;
          this.showCallout(h, 'OVERHEAT!');
          this.audio.playStun();
        }
        h.holding = false;
        h.charge = 0;
      }

      h.x = Math.max(width * 0.1, Math.min(width * 0.9, h.x + h.vx * dt));
      h.y = Math.max(height * 0.16, Math.min(height * 0.88, h.y + h.vy * dt));

      for (const pl of this.pillars) {
        if (Math.hypot(h.x - pl.x, h.y - pl.y) < 42 && pl.state !== 'submerged') {
          if (pl.hasGoldenCrown) {
            pl.hasGoldenCrown = false;
            const pts = 95 * h.combo * (this.suddenDeath ? 2 : 1);
            h.score += pts;
            h.combo = Math.min(4, h.combo + 1);
            this.showCallout(h, `FIRE CROWN +${pts}!`);
            this.audio.playScore();
            this.particles.spawnSparks(pl.x, pl.y, '#fbbf24', 12);
          } else if (pl.hasRuby) {
            pl.hasRuby = false;
            const pts = 50 * h.combo * (this.suddenDeath ? 2 : 1);
            h.score += pts;
            h.combo = Math.min(4, h.combo + 1);
            this.showCallout(h, `FIRE RUBY +${pts}`);
            this.audio.playTap();
          }
        }
      }
    }

    // Hopper-to-Hopper Bumping
    for (let i = 0; i < this.hoppers.length; i++) {
      for (let j = i + 1; j < this.hoppers.length; j++) {
        const a = this.hoppers[i];
        const b = this.hoppers[j];
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
    const bot = this.hoppers.find((h) => h.id === botId);
    if (!bot || bot.singedTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    let dx = 0, dy = 0;
    const best = this.pillars.find((p) => p.state === 'solid' && (p.hasGoldenCrown || p.hasRuby)) ?? this.pillars[0];
    if (best) {
      dx = best.x - bot.x;
      dy = best.y - bot.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      bot.vx += (dx / (d || 0.001)) * 1100 * dt;
      bot.vy += (dy / (d || 0.001)) * 1100 * dt;
    }

    const hold = !bot.holding || bot.charge < bot.botChargeGoal;
    this.input.setBotInput(botId, hold, Math.sign(dx), Math.sign(-dy), hold);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pal = THEMES[THEME_KEYS[this.themeIdx]];
    ctx.save();

    if (this.shakeTimer > 0) {
      const s = this.shakeIntensity * (this.shakeTimer / 0.22);
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, pal.lavaTop);
    bg.addColorStop(1, pal.lavaBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Basalt Pillars
    for (const pl of this.pillars) {
      if (pl.state === 'submerged') continue;
      ctx.save();
      ctx.translate(pl.x, pl.y);
      ctx.fillStyle = pl.state === 'rumbling' ? '#ef4444' : pal.pillarColor;
      ctx.beginPath();
      ctx.arc(0, 0, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.stroke();

      if (pl.hasGoldenCrown) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
      } else if (pl.hasRuby) {
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Hoppers
    for (const h of this.hoppers) {
      ctx.save();
      ctx.translate(h.x, h.y);
      if (h.holding && h.charge > 0.05) {
        const sweet = h.charge >= 0.72 && h.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + h.charge * Math.PI * 2);
        ctx.stroke();
      }
      const mood = h.singedTimer > 0 ? 'shocked' : h.magmaShieldTimer > 0 ? 'triumph' : h.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, h.id, 0, 0, 17, mood, this.timeElapsed, h.vx * 0.0005);
      if (h.calloutTimer > 0 && h.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(h.calloutText, 0, -28);
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
      `🌋 VOLCANO LAVA LEAP • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X MAGMA' : ''}`,
      width * 0.5,
      19
    );

    this.hoppers.forEach((h, idx) => {
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
    const sorted = [...this.hoppers].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 0,
      rankings: sorted.map((h, i) => ({
        playerId: h.id,
        score: Math.round(h.score),
        place: i + 1,
      })),
      mvpHighlight: `Caldera Pillar Champion ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(x: number, y: number, _width: number, _height: number): boolean {
    if (this.isFinished) return false;
    if (y <= 48) {
      this.themeIdx = (this.themeIdx + 1) % THEME_KEYS.length;
      this.audio.playTap();
      return true;
    }
    const p1 = this.hoppers.find(h => h.id === 0);
    if (!p1 || p1.singedTimer > 0) return false;

    const dx = x - p1.x;
    const dy = y - p1.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    p1.vx += (dx / (d || 0.001)) * 480;
    p1.vy += (dy / (d || 0.001)) * 480;
    this.audio.playTap();
    return true;
  }
}
