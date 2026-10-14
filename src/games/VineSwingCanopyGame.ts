import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type CanopyTheme = 'amazon_falls' | 'bioluminescent_jungle' | 'sunset_temple';

interface CanopyPalette {
  name: string;
  skyTop: string;
  skyBot: string;
  vineColor: string;
  leafColor: string;
}

const THEMES: Record<CanopyTheme, CanopyPalette> = {
  amazon_falls: {
    name: 'Amazon Emerald Waterfall',
    skyTop: '#064e3b',
    skyBot: '#022c22',
    vineColor: '#4ade80',
    leafColor: '#10b981',
  },
  bioluminescent_jungle: {
    name: 'Avatar Bioluminescent Canopy',
    skyTop: '#090d16',
    skyBot: '#1e1b4b',
    vineColor: '#22d3ee',
    leafColor: '#a855f7',
  },
  sunset_temple: {
    name: 'Golden Aztec Canopy',
    skyTop: '#451a03',
    skyBot: '#7c2d12',
    vineColor: '#fbbf24',
    leafColor: '#f59e0b',
  },
};

const THEME_KEYS: CanopyTheme[] = ['amazon_falls', 'bioluminescent_jungle', 'sunset_temple'];

interface VineAnchor {
  id: number;
  x: number;
  y: number;
  length: number;
  angle: number;
  angVel: number;
}

interface CanopyPickup {
  id: number;
  x: number;
  y: number;
  kind: 'mango' | 'golden_idol' | 'hornet_nest';
}

interface Swinger {
  id: PlayerId;
  color: string;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  vineId: number | null;
  score: number;
  combo: number;
  charge: number;
  holding: boolean;
  tarzanBoostTimer: number;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class VineSwingCanopyGame extends BaseGame {
  private swingers: Swinger[] = [];
  private vines: VineAnchor[] = [];
  private pickups: CanopyPickup[] = [];
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
    this.vines = [];
    this.pickups = [];
    this.swingers = [];

    for (let i = 0; i < 5; i++) {
      this.vines.push({
        id: i,
        x: width * (0.18 + i * 0.16),
        y: 52,
        length: height * 0.44,
        angle: (i % 2 === 0 ? 1 : -1) * 0.55,
        angVel: 0,
      });
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const v = this.vines[idx % this.vines.length];
      this.swingers.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: v.x + Math.sin(v.angle) * v.length,
        y: v.y + Math.cos(v.angle) * v.length,
        vx: 0,
        vy: 0,
        vineId: v.id,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        tarzanBoostTimer: 0,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.24,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    for (let i = 0; i < 10; i++) {
      this.pickups.push(this.makePickup(width, height, i));
    }
  }

  private makePickup(width: number, height: number, id: number): CanopyPickup {
    const r = Math.random();
    return {
      id,
      x: width * (0.14 + Math.random() * 0.72),
      y: height * (0.22 + Math.random() * 0.54),
      kind: r < 0.24 ? 'golden_idol' : r < 0.82 ? 'mango' : 'hornet_nest',
    };
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(s: Swinger, text: string): void {
    s.calloutText = text;
    s.calloutTimer = 1.15;
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
      this.swingers.forEach((s) => this.showCallout(s, 'JUNGLE RUSH 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    // Update Pendulum Vines
    for (const v of this.vines) {
      const grav = 4.2 * (this.suddenDeath ? 1.25 : 1.0);
      v.angVel += -grav * Math.sin(v.angle) * dt;
      v.angVel *= Math.pow(0.92, dt);
      if (Math.abs(v.angle) < 0.15 && Math.abs(v.angVel) < 0.6) {
        v.angVel += (v.angVel >= 0 ? 1 : -1) * 1.4 * dt;
      }
      v.angle += v.angVel * dt;
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.swingers.map((s) => s.score));

    for (const s of this.swingers) {
      s.underdog = maxScore - s.score >= 150;
      if (s.calloutTimer > 0) s.calloutTimer = Math.max(0, s.calloutTimer - dt);
      if (s.tarzanBoostTimer > 0) s.tarzanBoostTimer = Math.max(0, s.tarzanBoostTimer - dt);
      if (s.stunTimer > 0) s.stunTimer = Math.max(0, s.stunTimer - dt);

      const steer = this.input.getSteer(s.id);
      const justTap = this.input.justPressed(s.id) || this.input.justAction(s.id);
      const isHold = this.input.isActionPressed(s.id) || this.input.isPressed(s.id);

      if (s.vineId !== null) {
        const v = this.vines.find((item) => item.id === s.vineId);
        if (v) {
          v.angVel += steer * 3.2 * dt;
          s.x = v.x + Math.sin(v.angle) * v.length;
          s.y = v.y + Math.cos(v.angle) * v.length;
          s.vx = Math.cos(v.angle) * v.angVel * v.length;
          s.vy = -Math.sin(v.angle) * v.angVel * v.length;
        }
      } else {
        s.vx += steer * 520 * (s.underdog ? 1.15 : 1.0) * dt;
        s.vy += 640 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;

        // Auto-catch nearby vine tip
        for (const v of this.vines) {
          const tipX = v.x + Math.sin(v.angle) * v.length;
          const tipY = v.y + Math.cos(v.angle) * v.length;
          if (Math.hypot(s.x - tipX, s.y - tipY) < 42 && s.vy > -120) {
            s.vineId = v.id;
            v.angVel += s.vx * 0.003;
            s.score += 20 * s.combo;
            this.audio.playTap();
            break;
          }
        }

        // Waterfall bouncy lilypad floor
        if (s.y > height * 0.86) {
          s.y = height * 0.85;
          s.vy = -620;
          s.vx = (width * 0.5 - s.x) * 1.4;
          s.combo = 1;
          this.showCallout(s, 'LILYPAD BOUNCE!');
          this.audio.playBounce();
        }
      }

      // Hold-to-charge Tarzan Whip-Slingshot & Canopy Shunt (72%-98% Sweet Spot)
      if (isHold && s.stunTimer <= 0) {
        s.holding = true;
        s.charge = Math.min(1, s.charge + dt * 0.92);
      } else if (s.holding) {
        const sweet = s.charge >= 0.72 && s.charge <= 0.98;
        s.vineId = null;
        s.vy = sweet ? -620 : -460;
        s.vx += steer * 340;
        if (sweet) {
          s.tarzanBoostTimer = 2.0;
          s.score += 85;
          s.combo = Math.min(4, s.combo + 1);
          this.showCallout(s, 'TARZAN WHIP-SLING +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 12);

          for (const other of this.swingers) {
            if (other.id !== s.id && Math.hypot(other.x - s.x, other.y - s.y) < 165) {
              other.vineId = null;
              other.vx = (other.x >= s.x ? 1 : -1) * 340;
              other.vy = -240;
              s.score += 70;
              this.showCallout(s, 'CANOPY VINE SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else if (s.charge > 0.98) {
          s.combo = 1;
          this.showCallout(s, 'VINE SLIP!');
          this.audio.playStun();
        } else {
          this.audio.playTap();
        }
        s.holding = false;
        s.charge = 0;
      } else if (justTap && s.vineId !== null) {
        s.vineId = null;
        s.vy = -460;
        s.vx += steer * 260;
        this.audio.playTap();
      }

      // Collect Tropical Fruits & Golden Idols
      for (let i = 0; i < this.pickups.length; i++) {
        const pk = this.pickups[i];
        if (Math.hypot(s.x - pk.x, s.y - pk.y) < 34) {
          if (pk.kind === 'hornet_nest' && s.tarzanBoostTimer <= 0 && !s.underdog) {
            s.stunTimer = 1.0;
            s.combo = 1;
            this.showCallout(s, 'HORNET STING!');
            this.audio.playStun();
            this.triggerHitStop(40, 9);
          } else {
            const base = pk.kind === 'golden_idol' ? 95 : 50;
            const pts = base * s.combo * (this.suddenDeath ? 2 : 1);
            s.score += pts;
            s.combo = Math.min(4, s.combo + 1);
            this.showCallout(s, pk.kind === 'golden_idol' ? `GOLDEN IDOL +${pts}!` : `MANGO +${pts}`);
            this.audio.playScore();
            this.particles.spawnSparks(pk.x, pk.y, '#fbbf24', 10);
          }
          this.pickups[i] = this.makePickup(width, height, pk.id);
        }
      }
    }

    // Elastic Mid-Air Swinger Bumping
    for (let i = 0; i < this.swingers.length; i++) {
      for (let j = i + 1; j < this.swingers.length; j++) {
        const a = this.swingers[i];
        const b = this.swingers[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < 36) {
          const nx = dx / dist;
          const ny = dy / dist;
          a.vineId = null;
          b.vineId = null;
          a.vx -= nx * 240;
          a.vy -= ny * 220;
          b.vx += nx * 240;
          b.vy += ny * 220;
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
    const bot = this.swingers.find((s) => s.id === botId);
    if (!bot) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.2 : 0.28;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    let targetX = width * 0.5;
    for (const pk of this.pickups) {
      if (pk.kind !== 'hornet_nest') {
        targetX = pk.x;
        break;
      }
    }
    if (bot.vineId === null) {
      bot.vx += Math.sign(targetX - bot.x) * 380 * dt;
    }

    const hold = bot.vineId !== null && (!bot.holding || bot.charge < bot.botChargeGoal);
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

    // Draw Hanging Liana Vines
    for (const v of this.vines) {
      const tipX = v.x + Math.sin(v.angle) * v.length;
      const tipY = v.y + Math.cos(v.angle) * v.length;
      ctx.strokeStyle = pal.vineColor;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(v.x, v.y);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      ctx.fillStyle = pal.leafColor;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pickups
    for (const pk of this.pickups) {
      ctx.save();
      ctx.translate(pk.x, pk.y);
      if (pk.kind === 'golden_idol') {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★95', 0, 4);
      } else if (pk.kind === 'mango') {
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Swingers
    for (const s of this.swingers) {
      ctx.save();
      ctx.translate(s.x, s.y);
      if (s.holding && s.charge > 0.05) {
        const sweet = s.charge >= 0.72 && s.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + s.charge * Math.PI * 2);
        ctx.stroke();
      }
      const mood = s.stunTimer > 0 ? 'shocked' : s.tarzanBoostTimer > 0 ? 'triumph' : s.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, s.id, 0, 0, 16, mood, this.timeElapsed, s.vx * 0.001);
      if (s.calloutTimer > 0 && s.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(s.calloutText, 0, -28);
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
      `🌿 VINE SWING CANOPY • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X RUSH' : ''}`,
      width * 0.5,
      19
    );

    this.swingers.forEach((s, idx) => {
      ctx.fillStyle = s.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${s.id}: ${Math.round(s.score)} pts (${s.combo}x)`, 90 + idx * 170, 38);
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.swingers].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 1,
      rankings: sorted.map((s, i) => ({
        playerId: s.id,
        score: Math.round(s.score),
        place: i + 1,
      })),
      mvpHighlight: `Canopy King ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
