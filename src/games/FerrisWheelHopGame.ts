import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type WheelTheme = 'sunset_pier' | 'neon_wonderWheel' | 'starlight_fair';

interface WheelPalette {
  name: string;
  skyTop: string;
  skyBot: string;
  spokeColor: string;
  rimColor: string;
  gondolaColor: string;
}

const THEMES: Record<WheelTheme, WheelPalette> = {
  sunset_pier: {
    name: 'Santa Monica Sunset Pier',
    skyTop: '#1e1b4b',
    skyBot: '#ea580c',
    spokeColor: '#fbbf24',
    rimColor: '#fde047',
    gondolaColor: '#38bdf8',
  },
  neon_wonderWheel: {
    name: 'Coney Island Neon Wheel',
    skyTop: '#090d16',
    skyBot: '#3b0764',
    spokeColor: '#ec4899',
    rimColor: '#22d3ee',
    gondolaColor: '#a855f7',
  },
  starlight_fair: {
    name: 'Grand Victorian World Fair',
    skyTop: '#0c4a6e',
    skyBot: '#0f172a',
    spokeColor: '#e2e8f0',
    rimColor: '#34d399',
    gondolaColor: '#f59e0b',
  },
};

const THEME_KEYS: WheelTheme[] = ['sunset_pier', 'neon_wonderWheel', 'starlight_fair'];

interface Gondola {
  id: number;
  wheelIndex: number; // 0 = left wheel, 1 = right wheel
  angle: number;
  x: number;
  y: number;
  sway: number;
  electrified: boolean;
}

interface PrizeRibbon {
  id: number;
  x: number;
  y: number;
  vy: number;
  kind: 'ribbon' | 'golden_star' | 'firework_hazard';
  active: boolean;
}

interface Hopper {
  id: PlayerId;
  color: string;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  attachedGondolaId: number | null;
  score: number;
  combo: number;
  charge: number;
  holding: boolean;
  apexBoostTimer: number;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class FerrisWheelHopGame extends BaseGame {
  private hoppers: Hopper[] = [];
  private gondolas: Gondola[] = [];
  private ribbons: PrizeRibbon[] = [];
  private wheelAngle = 0;
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
    this.wheelAngle = 0;
    this.gondolas = [];
    this.ribbons = [];
    this.hoppers = [];

    for (let w = 0; w < 2; w++) {
      for (let i = 0; i < 6; i++) {
        this.gondolas.push({
          id: w * 6 + i,
          wheelIndex: w,
          angle: (i * Math.PI * 2) / 6,
          x: width * (w === 0 ? 0.34 : 0.66),
          y: height * 0.52,
          sway: 0,
          electrified: false,
        });
      }
    }

    this.updateGondolaPositions(width, height, 0);

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const startGondola = this.gondolas[idx % this.gondolas.length];
      this.hoppers.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: startGondola.x,
        y: startGondola.y - 12,
        vx: 0,
        vy: 0,
        attachedGondolaId: startGondola.id,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        apexBoostTimer: 0,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.25,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    for (let i = 0; i < 10; i++) {
      this.spawnRibbon(width, height, i);
    }
  }

  private spawnRibbon(width: number, height: number, id: number): void {
    const r = Math.random();
    this.ribbons.push({
      id,
      x: width * (0.22 + Math.random() * 0.56),
      y: height * (0.16 + Math.random() * 0.56),
      vy: (Math.random() - 0.5) * 35,
      kind: r < 0.25 ? 'golden_star' : r < 0.8 ? 'ribbon' : 'firework_hazard',
      active: true,
    });
  }

  private updateGondolaPositions(width: number, height: number, dt: number): void {
    const r = Math.min(width, height) * 0.25;
    const cy = height * 0.53;
    const rotSpeed = (this.suddenDeath ? 1.15 : 0.72) * dt;
    this.wheelAngle += rotSpeed;

    for (const g of this.gondolas) {
      const cx = width * (g.wheelIndex === 0 ? 0.34 : 0.66);
      const dir = g.wheelIndex === 0 ? 1 : -1;
      const a = g.angle + this.wheelAngle * dir;
      g.x = cx + Math.cos(a) * r;
      g.y = cy + Math.sin(a) * r;
      g.sway *= Math.pow(0.15, dt);
    }
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(h: Hopper, text: string): void {
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
      this.hoppers.forEach((h) => this.showCallout(h, 'TURBO WHEEL OVERDRIVE!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    this.updateGondolaPositions(width, height, dt);
    this.updateBots(dt, width, height);

    // Update floating prizes
    for (const rb of this.ribbons) {
      rb.y += rb.vy * dt;
      if (rb.y < height * 0.14 || rb.y > height * 0.75) rb.vy *= -1;
    }

    const maxScore = Math.max(0, ...this.hoppers.map((h) => h.score));

    for (const h of this.hoppers) {
      h.underdog = maxScore - h.score >= 150;
      if (h.calloutTimer > 0) h.calloutTimer = Math.max(0, h.calloutTimer - dt);
      if (h.apexBoostTimer > 0) h.apexBoostTimer = Math.max(0, h.apexBoostTimer - dt);
      if (h.stunTimer > 0) h.stunTimer = Math.max(0, h.stunTimer - dt);

      const steer = this.input.getSteer(h.id);
      const justTap = this.input.justPressed(h.id) || this.input.justAction(h.id);
      const isHold = this.input.isActionPressed(h.id) || this.input.isPressed(h.id);

      if (h.attachedGondolaId !== null) {
        const g = this.gondolas.find((item) => item.id === h.attachedGondolaId);
        if (g) {
          h.x = g.x + steer * 14;
          h.y = g.y - 12;
          h.vx = 0;
          h.vy = 0;
        }
      } else {
        // Airborne physics with responsive air-control
        h.vx += steer * 540 * (h.underdog ? 1.15 : 1.0) * dt;
        h.vy += 680 * dt;
        h.x += h.vx * dt;
        h.y += h.vy * dt;

        // Grab nearby gondola if falling
        if (h.vy > -60) {
          for (const g of this.gondolas) {
            if (Math.hypot(h.x - g.x, h.y - g.y) < 34) {
              h.attachedGondolaId = g.id;
              g.sway = h.vx * 0.002;
              const pts = 25 * h.combo;
              h.score += pts;
              this.audio.playTap();
              break;
            }
          }
        }

        // Safety trampoline net at bottom
        if (h.y > height * 0.86) {
          h.y = height * 0.85;
          h.vy = -640;
          h.vx = (width * 0.5 - h.x) * 1.4;
          h.combo = 1;
          this.showCallout(h, 'SAFETY NET BOUNCE!');
          this.audio.playBounce();
        }
      }

      // Hold-to-charge Apex Vault & Gondola Shockwave Shunt (72%-98% Sweet Spot)
      if (isHold && h.stunTimer <= 0) {
        h.holding = true;
        h.charge = Math.min(1, h.charge + dt * 0.92);
      } else if (h.holding) {
        const sweet = h.charge >= 0.72 && h.charge <= 0.98;
        h.attachedGondolaId = null;
        const launchPower = sweet ? 640 : 480;
        h.vy = -launchPower;
        h.vx = steer * 340 + (h.x < width * 0.5 ? 160 : -160);

        if (sweet) {
          h.apexBoostTimer = 2.0;
          h.combo = Math.min(4, h.combo + 1);
          h.score += 80;
          this.showCallout(h, 'APEX VAULT +80!');
          this.audio.playBoost();
          this.triggerHitStop(45, 11);

          // Shunt nearby rivals off their gondolas!
          for (const other of this.hoppers) {
            if (other.id !== h.id && Math.hypot(other.x - h.x, other.y - h.y) < 160) {
              other.attachedGondolaId = null;
              other.vx = (other.x >= h.x ? 1 : -1) * 320;
              other.vy = -260;
              h.score += 70;
              this.showCallout(h, 'GONDOLA SHUNT +70!');
              this.showCallout(other, 'BUMPED OFF!');
              this.audio.playBounce();
            }
          }
        } else if (h.charge > 0.98) {
          h.combo = 1;
          this.showCallout(h, 'OVERCHARGE SLIP!');
          this.audio.playStun();
        } else {
          this.audio.playTap();
        }
        h.holding = false;
        h.charge = 0;
      } else if (justTap && h.attachedGondolaId !== null) {
        h.attachedGondolaId = null;
        h.vy = -490;
        h.vx = steer * 290;
        this.audio.playTap();
      }

      // Collect Ribbons & Stars
      for (let i = 0; i < this.ribbons.length; i++) {
        const rb = this.ribbons[i];
        if (!rb.active) continue;
        if (Math.hypot(h.x - rb.x, h.y - rb.y) < 34) {
          if (rb.kind === 'firework_hazard' && h.apexBoostTimer <= 0 && !h.underdog) {
            h.stunTimer = 1.1;
            h.combo = 1;
            h.vy = 180;
            this.showCallout(h, 'SPARKLER ZAP!');
            this.audio.playStun();
            this.triggerHitStop(40, 10);
          } else {
            const base = rb.kind === 'golden_star' ? 95 : 50;
            const pts = base * h.combo * (this.suddenDeath ? 2 : 1);
            h.score += pts;
            h.combo = Math.min(4, h.combo + 1);
            this.showCallout(h, rb.kind === 'golden_star' ? `GOLDEN STAR +${pts}!` : `RIBBON +${pts}`);
            this.audio.playScore();
            this.particles.spawnSparks(rb.x, rb.y, '#fbbf24', 10);
          }
          rb.x = width * (0.22 + Math.random() * 0.56);
          rb.y = height * (0.16 + Math.random() * 0.56);
        }
      }
    }

    // Player-to-Player Mid-Air & Gondola Bumping
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
          a.attachedGondolaId = null;
          b.attachedGondolaId = null;
          a.vx -= nx * 240;
          a.vy -= ny * 210;
          b.vx += nx * 240;
          b.vy += ny * 210;
          this.audio.playBounce();
          this.triggerHitStop(35, 8);
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
    const bot = this.hoppers.find((h) => h.id === botId);
    if (!bot) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.2 : 0.28;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    // Aim toward nearest star/ribbon
    let targetX = width * 0.5;
    let bestDist = 9999;
    for (const rb of this.ribbons) {
      if (rb.kind === 'firework_hazard') continue;
      const d = Math.hypot(rb.x - bot.x, rb.y - bot.y);
      if (d < bestDist) {
        bestDist = d;
        targetX = rb.x;
      }
    }

    if (bot.attachedGondolaId === null) {
      bot.vx += Math.sign(targetX - bot.x) * 380 * dt;
    }

    const shouldHold =
      bot.attachedGondolaId !== null && (!bot.holding || bot.charge < bot.botChargeGoal);
    this.input.setBotState(botId, shouldHold);
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

    const r = Math.min(width, height) * 0.25;
    const cy = height * 0.53;

    // Draw Twin Counter-Rotating Ferris Wheels
    for (let w = 0; w < 2; w++) {
      const cx = width * (w === 0 ? 0.34 : 0.66);
      ctx.strokeStyle = pal.rimColor;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      for (const g of this.gondolas.filter((item) => item.wheelIndex === w)) {
        ctx.strokeStyle = pal.spokeColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(g.x, g.y);
        ctx.stroke();

        // Gondola cabin
        ctx.fillStyle = pal.gondolaColor;
        ctx.beginPath();
        ctx.roundRect(g.x - 22, g.y - 8, 44, 20, 6);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
    }

    // Safety Trampoline Net
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(width * 0.1, height * 0.87);
    ctx.lineTo(width * 0.9, height * 0.87);
    ctx.stroke();

    // Render Ribbons & Golden Stars
    for (const rb of this.ribbons) {
      ctx.save();
      ctx.translate(rb.x, rb.y);
      if (rb.kind === 'golden_star') {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★95', 0, 4);
      } else if (rb.kind === 'ribbon') {
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', 0, 4);
      }
      ctx.restore();
    }

    // Render Hoppers
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

      const mood =
        h.stunTimer > 0
          ? 'shocked'
          : h.apexBoostTimer > 0
          ? 'triumph'
          : h.holding
          ? 'focused'
          : 'happy';
      this.drawPlayerMascot(ctx, h.id, 0, 0, 16, mood, this.timeElapsed, h.vx * 0.001);

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
      `🎡 FERRIS WHEEL HOP • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X OVERDRIVE' : ''}`,
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
      winnerId: sorted[0]?.id ?? 1,
      rankings: sorted.map((h, i) => ({
        playerId: h.id,
        score: Math.round(h.score),
        place: i + 1,
      })),
      mvpHighlight: `Ferris Wheel Acrobat ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
