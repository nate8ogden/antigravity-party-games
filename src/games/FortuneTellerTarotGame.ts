import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type PlanetariumTheme = 'starlight_dome' | 'aurora_observatory' | 'solar_prism';

interface PlanetariumPalette {
  name: string;
  bgTop: string;
  bgBot: string;
  ringColor: string;
  prismGlow: string;
}

const THEMES: Record<PlanetariumTheme, PlanetariumPalette> = {
  starlight_dome: {
    name: 'Grand Starlight Planetarium',
    bgTop: '#081026',
    bgBot: '#1e1b4b',
    ringColor: '#fbbf24',
    prismGlow: '#38bdf8',
  },
  aurora_observatory: {
    name: 'Borealis Crystal Dome',
    bgTop: '#042f2e',
    bgBot: '#0f172a',
    ringColor: '#34d399',
    prismGlow: '#a855f7',
  },
  solar_prism: {
    name: 'Helios Golden Orrery',
    bgTop: '#27120b',
    bgBot: '#090d16',
    ringColor: '#f59e0b',
    prismGlow: '#fde047',
  },
};

const THEME_KEYS: PlanetariumTheme[] = ['starlight_dome', 'aurora_observatory', 'solar_prism'];

const CONSTELLATION_EMBLEMS = [
  { id: 0, label: 'SUN', icon: '☀', color: '#fbbf24' },
  { id: 1, label: 'MOON', icon: '☽', color: '#38bdf8' },
  { id: 2, label: 'STAR', icon: '★', color: '#a855f7' },
  { id: 3, label: 'COMET', icon: '☄', color: '#34d399' },
];

interface StarGem {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  emblemId: number;
  isGoldenSupernova: boolean;
  isMeteorHazard: boolean;
}

interface Astronomer {
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
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class FortuneTellerTarotGame extends BaseGame {
  private astronomers: Astronomer[] = [];
  private gems: StarGem[] = [];
  private activeEmblemId = 0;
  private emblemSwitchTimer = 6.5;
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
    this.activeEmblemId = Math.floor(Math.random() * CONSTELLATION_EMBLEMS.length);
    this.emblemSwitchTimer = 6.5;
    this.astronomers = [];
    this.gems = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const a = (idx * Math.PI * 2) / Math.max(1, active.length);
      this.astronomers.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: width * 0.5 + Math.cos(a) * 140,
        y: height * 0.54 + Math.sin(a) * 95,
        vx: 0,
        vy: 0,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.22,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    for (let i = 0; i < 12; i++) {
      this.gems.push(this.createGem(width, height, i));
    }
  }

  private createGem(width: number, height: number, id: number): StarGem {
    const r = Math.random();
    const angle = Math.random() * Math.PI * 2;
    const dist = 90 + Math.random() * 190;
    return {
      id,
      x: width * 0.5 + Math.cos(angle) * dist,
      y: height * 0.54 + Math.sin(angle) * dist * 0.72,
      vx: (Math.random() - 0.5) * 95,
      vy: (Math.random() - 0.5) * 95,
      emblemId: Math.floor(Math.random() * CONSTELLATION_EMBLEMS.length),
      isGoldenSupernova: r < 0.2,
      isMeteorHazard: r >= 0.84,
    };
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(a: Astronomer, text: string): void {
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
      this.astronomers.forEach((a) => this.showCallout(a, 'COSMIC PRISM 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    this.emblemSwitchTimer -= dt;
    if (this.emblemSwitchTimer <= 0) {
      this.emblemSwitchTimer = 6.0;
      this.activeEmblemId = (this.activeEmblemId + 1) % CONSTELLATION_EMBLEMS.length;
      this.audio.playChime();
    }

    this.updateBots(dt, width, height);

    // Move orbiting star gems
    for (const g of this.gems) {
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (g.x < width * 0.12 || g.x > width * 0.88) g.vx *= -1;
      if (g.y < height * 0.16 || g.y > height * 0.88) g.vy *= -1;
    }

    const maxScore = Math.max(0, ...this.astronomers.map((a) => a.score));

    for (const a of this.astronomers) {
      a.underdog = maxScore - a.score >= 150;
      if (a.calloutTimer > 0) a.calloutTimer = Math.max(0, a.calloutTimer - dt);
      if (a.stunTimer > 0) {
        a.stunTimer = Math.max(0, a.stunTimer - dt);
        continue;
      }

      const sx = this.input.getSteer(a.id);
      const sy = this.input.getThrottle(a.id);
      const pCfg = this.getPlayer(a.id);
      const isBot = pCfg ? pCfg.type.startsWith('bot_') : false;

      const justTap = this.input.justAction(a.id) || (isBot && this.input.justPressed(a.id));
      const isHold = this.input.isActionPressed(a.id) || (isBot && this.input.isPressed(a.id));

      const accel = 1350 * (a.underdog ? 1.15 : 1.0);
      a.vx += sx * accel * dt;
      a.vy += (sy !== 0 ? -sy : 0) * accel * dt;
      a.vx *= Math.pow(0.06, dt);
      a.vy *= Math.pow(0.06, dt);
      a.x = Math.max(width * 0.1, Math.min(width * 0.9, a.x + a.vx * dt));
      a.y = Math.max(height * 0.15, Math.min(height * 0.88, a.y + a.vy * dt));

      // Hold-to-charge Starlight Prism Pulse & Astral Shunt (72%-98% Sweet Spot)
      if (isHold) {
        a.holding = true;
        a.charge = Math.min(1, a.charge + dt * 0.92);
      } else if (a.holding) {
        const sweet = a.charge >= 0.72 && a.charge <= 0.98;
        if (sweet) {
          a.score += 85;
          a.combo = Math.min(4, a.combo + 1);
          this.showCallout(a, 'PRISM SUPERNOVA +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 12);

          // Auto-collect nearby matching or golden gems
          for (let i = 0; i < this.gems.length; i++) {
            const g = this.gems[i];
            if (Math.hypot(g.x - a.x, g.y - a.y) < 165 && !g.isMeteorHazard) {
              a.score += 55;
              this.gems[i] = this.createGem(width, height, g.id);
            }
          }

          // Shunt rival astronomers!
          for (const other of this.astronomers) {
            if (other.id !== a.id && Math.hypot(other.x - a.x, other.y - a.y) < 170) {
              const dx = other.x - a.x;
              const dy = other.y - a.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              other.vx += (dx / d) * 520;
              other.vy += (dy / d) * 520;
              a.score += 70;
              this.showCallout(a, 'ASTRAL PRISM SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else if (a.charge > 0.98) {
          a.stunTimer = 1.0;
          a.combo = 1;
          this.showCallout(a, 'PRISM OVERLOAD!');
          this.audio.playStun();
        }
        a.holding = false;
        a.charge = 0;
      } else if (justTap) {
        // Quick dash toward nearest matching star gem
        const match = this.gems.find((g) => g.emblemId === this.activeEmblemId || g.isGoldenSupernova);
        if (match) {
          const dx = match.x - a.x;
          const dy = match.y - a.y;
          const d = Math.max(1, Math.hypot(dx, dy));
          a.vx += (dx / d) * 380;
          a.vy += (dy / d) * 380;
          this.audio.playTap();
        }
      }

      // Check gem captures
      for (let i = 0; i < this.gems.length; i++) {
        const g = this.gems[i];
        if (Math.hypot(g.x - a.x, g.y - a.y) < 34) {
          if (g.isMeteorHazard && !a.underdog) {
            a.stunTimer = 1.1;
            a.combo = 1;
            this.showCallout(a, 'METEOR SHOCK!');
            this.audio.playStun();
            this.triggerHitStop(40, 9);
          } else if (g.isGoldenSupernova || g.emblemId === this.activeEmblemId) {
            const base = g.isGoldenSupernova ? 95 : 60;
            const pts = base * a.combo * (this.suddenDeath ? 2 : 1);
            a.score += pts;
            a.combo = Math.min(4, a.combo + 1);
            this.showCallout(a, g.isGoldenSupernova ? `GOLDEN NOVA +${pts}!` : `STAR MATCH +${pts}!`);
            this.audio.playScore();
            this.particles.spawnSparks(g.x, g.y, '#fbbf24', 12);
          } else {
            a.score += 15;
            this.audio.playTap();
          }
          this.gems[i] = this.createGem(width, height, g.id);
        }
      }
    }

    // Elastic Body Collision
    for (let i = 0; i < this.astronomers.length; i++) {
      for (let j = i + 1; j < this.astronomers.length; j++) {
        const a = this.astronomers[i];
        const b = this.astronomers[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < 38) {
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
    const bot = this.astronomers.find((a) => a.id === botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    let best: StarGem | null = null;
    let bestD = 9999;
    for (const g of this.gems) {
      if (g.isMeteorHazard) continue;
      if (g.isGoldenSupernova || g.emblemId === this.activeEmblemId) {
        const d = Math.hypot(g.x - bot.x, g.y - bot.y);
        if (d < bestD) {
          bestD = d;
          best = g;
        }
      }
    }

    if (best) {
      const dx = best.x - bot.x;
      const dy = best.y - bot.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      bot.vx += (dx / d) * 1150 * dt;
      bot.vy += (dy / d) * 1150 * dt;
    }

    const shouldHold = (bestD < 145 && !bot.holding) || (bot.holding && bot.charge < bot.botChargeGoal);
    this.input.setBotState(botId, shouldHold);
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

    // Central Grand Planetarium Crystal Prism showing the Target Star Emblem
    const targetEmblem = CONSTELLATION_EMBLEMS[this.activeEmblemId];
    ctx.save();
    ctx.translate(width * 0.5, height * 0.52);
    ctx.strokeStyle = pal.ringColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 62, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = targetEmblem.color;
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(targetEmblem.icon, 0, 4);
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`MATCH: ${targetEmblem.label}`, 0, 24);
    ctx.restore();

    // Render Star Gems
    for (const g of this.gems) {
      const em = CONSTELLATION_EMBLEMS[g.emblemId];
      ctx.save();
      ctx.translate(g.x, g.y);
      if (g.isMeteorHazard) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('☄!', 0, 4);
      } else if (g.isGoldenSupernova) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★95', 0, 4);
      } else {
        const isMatch = g.emblemId === this.activeEmblemId;
        ctx.fillStyle = em.color;
        ctx.beginPath();
        ctx.arc(0, 0, isMatch ? 17 : 13, 0, Math.PI * 2);
        ctx.fill();
        if (isMatch) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(em.icon, 0, 5);
      }
      ctx.restore();
    }

    // Render Astronomers
    for (const a of this.astronomers) {
      ctx.save();
      ctx.translate(a.x, a.y);
      if (a.holding && a.charge > 0.05) {
        const sweet = a.charge >= 0.72 && a.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 28, -Math.PI / 2, -Math.PI / 2 + a.charge * Math.PI * 2);
        ctx.stroke();
      }
      const mood = a.stunTimer > 0 ? 'shocked' : a.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, a.id, 0, 0, 17, mood, this.timeElapsed, a.vx * 0.0005);
      if (a.calloutTimer > 0 && a.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(a.calloutText, 0, -30);
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
      `✨ STARLIGHT PRISM CATCHER • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X NOVA' : ''}`,
      width * 0.5,
      19
    );

    this.astronomers.forEach((a, idx) => {
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
    const sorted = [...this.astronomers].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 0,
      rankings: sorted.map((a, i) => ({
        playerId: a.id,
        score: Math.round(a.score),
        place: i + 1,
      })),
      mvpHighlight: `Starlight Prism Master ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
