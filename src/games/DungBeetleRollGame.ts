import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type BeetleTheme = 'moss_meadow' | 'scarab_dunes' | 'crystal_garden';

interface BeetlePalette {
  name: string;
  bgTop: string;
  bgBot: string;
  sphereColor: string;
}

const THEMES: Record<BeetleTheme, BeetlePalette> = {
  moss_meadow: {
    name: 'Emerald Moss Garden',
    bgTop: '#14532d',
    bgBot: '#052e16',
    sphereColor: '#4ade80',
  },
  scarab_dunes: {
    name: 'Golden Scarab Dunes',
    bgTop: '#78350f',
    bgBot: '#451a03',
    sphereColor: '#fbbf24',
  },
  crystal_garden: {
    name: 'Starlight Geode Sphere',
    bgTop: '#1e1b4b',
    bgBot: '#090d16',
    sphereColor: '#38bdf8',
  },
};

const THEME_KEYS: BeetleTheme[] = ['moss_meadow', 'scarab_dunes', 'crystal_garden'];

interface SoilClump {
  id: number;
  x: number;
  y: number;
  golden: boolean;
}

interface BeetleRoller {
  id: PlayerId;
  color: string;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ballRadius: number;
  score: number;
  combo: number;
  charge: number;
  holding: boolean;
  boulderBoostTimer: number;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class DungBeetleRollGame extends BaseGame {
  private beetles: BeetleRoller[] = [];
  private clumps: SoilClump[] = [];
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
    this.beetles = [];
    this.clumps = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.beetles.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: width * (0.3 + idx * 0.2),
        y: height * 0.54,
        vx: 0,
        vy: 0,
        ballRadius: 20,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        boulderBoostTimer: 0,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.22,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    for (let i = 0; i < 12; i++) {
      this.clumps.push(this.spawnClump(width, height, i));
    }
  }

  private spawnClump(width: number, height: number, id: number): SoilClump {
    return {
      id,
      x: width * (0.14 + Math.random() * 0.72),
      y: height * (0.18 + Math.random() * 0.66),
      golden: Math.random() < 0.28,
    };
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(b: BeetleRoller, text: string): void {
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
      this.beetles.forEach((b) => this.showCallout(b, 'COLOSSAL SPHERE 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.beetles.map((b) => b.score));
    const goalX = width * 0.5;
    const goalY = height * 0.52;

    for (const b of this.beetles) {
      b.underdog = maxScore - b.score >= 150;
      if (b.calloutTimer > 0) b.calloutTimer = Math.max(0, b.calloutTimer - dt);
      if (b.boulderBoostTimer > 0) b.boulderBoostTimer = Math.max(0, b.boulderBoostTimer - dt);
      if (b.stunTimer > 0) {
        b.stunTimer = Math.max(0, b.stunTimer - dt);
        continue;
      }

      const sx = this.input.getSteer(b.id);
      const sy = this.input.getThrottle(b.id);
      const isHold = this.input.isActionPressed(b.id) || this.input.isPressed(b.id);

      const accel = 1350 * (b.underdog ? 1.15 : 1.0) * (b.boulderBoostTimer > 0 ? 1.35 : 1.0);
      b.vx += sx * accel * dt;
      b.vy += (sy !== 0 ? -sy : 0) * accel * dt;
      b.vx *= Math.pow(0.05, dt);
      b.vy *= Math.pow(0.05, dt);

      // Hold-to-charge Scarab Boulder Bowl & Smash Shunt (72%-98% Sweet Spot)
      if (isHold) {
        b.holding = true;
        b.charge = Math.min(1, b.charge + dt * 0.92);
      } else if (b.holding) {
        const sweet = b.charge >= 0.72 && b.charge <= 0.98;
        if (sweet) {
          b.boulderBoostTimer = 2.2;
          b.score += 85;
          b.combo = Math.min(4, b.combo + 1);
          this.showCallout(b, 'BOULDER BOWL +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 12);

          for (const other of this.beetles) {
            if (other.id !== b.id && Math.hypot(other.x - b.x, other.y - b.y) < 175) {
              const dx = other.x - b.x;
              const dy = other.y - b.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              other.vx += (dx / d) * 560;
              other.vy += (dy / d) * 560;
              other.ballRadius = Math.max(18, other.ballRadius - 6);
              b.score += 70;
              this.showCallout(b, 'SPHERE SMASH SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else if (b.charge > 0.98) {
          b.stunTimer = 0.9;
          b.combo = 1;
          this.showCallout(b, 'SPHERE SPINOUT!');
          this.audio.playStun();
        }
        b.holding = false;
        b.charge = 0;
      }

      b.x = Math.max(width * 0.1, Math.min(width * 0.9, b.x + b.vx * dt));
      b.y = Math.max(height * 0.16, Math.min(height * 0.88, b.y + b.vy * dt));

      for (let i = 0; i < this.clumps.length; i++) {
        const c = this.clumps[i];
        if (Math.hypot(b.x - c.x, b.y - c.y) < b.ballRadius + 14) {
          const base = c.golden ? 95 : 50;
          const pts = base * b.combo * (this.suddenDeath ? 2 : 1);
          b.score += pts;
          b.ballRadius = Math.min(44, b.ballRadius + (c.golden ? 5 : 3));
          b.combo = Math.min(4, b.combo + 1);
          this.showCallout(b, c.golden ? `GOLDEN SCARAB +${pts}!` : `MOSS CLUMP +${pts}`);
          this.audio.playScore();
          this.particles.spawnSparks(c.x, c.y, '#4ade80', 10);
          this.clumps[i] = this.spawnClump(width, height, c.id);
        }
      }

      // Bank oversize sphere in center goal
      if (b.ballRadius >= 30 && Math.hypot(b.x - goalX, b.y - goalY) < 48) {
        const bonus = Math.round(b.ballRadius * 2.5) * (this.suddenDeath ? 2 : 1);
        b.score += bonus;
        b.ballRadius = 20;
        this.showCallout(b, `SPHERE BANKED +${bonus}!`);
        this.audio.playChime();
      }
    }

    // Elastic Sphere-to-Sphere Bumping
    for (let i = 0; i < this.beetles.length; i++) {
      for (let j = i + 1; j < this.beetles.length; j++) {
        const a = this.beetles[i];
        const b = this.beetles[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < a.ballRadius + b.ballRadius) {
          const nx = dx / dist;
          const ny = dy / dist;
          a.vx -= nx * 320;
          a.vy -= ny * 320;
          b.vx += nx * 320;
          b.vy += ny * 320;
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
    const bot = this.beetles.find((b) => b.id === botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    const best = this.clumps.find((c) => c.golden) ?? this.clumps[0];
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

    // Center Compost Goal
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.52, 42, 0, Math.PI * 2);
    ctx.stroke();

    // Clumps
    for (const c of this.clumps) {
      ctx.fillStyle = c.golden ? '#fbbf24' : pal.sphereColor;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.golden ? 16 : 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Beetles & Rolling Spheres
    for (const b of this.beetles) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = pal.sphereColor;
      ctx.beginPath();
      ctx.arc(0, 0, b.ballRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      if (b.holding && b.charge > 0.05) {
        const sweet = b.charge >= 0.72 && b.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, b.ballRadius + 8, -Math.PI / 2, -Math.PI / 2 + b.charge * Math.PI * 2);
        ctx.stroke();
      }
      const mood = b.stunTimer > 0 ? 'shocked' : b.boulderBoostTimer > 0 ? 'triumph' : b.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, b.id, 0, 0, 15, mood, this.timeElapsed, b.vx * 0.0005);
      if (b.calloutTimer > 0 && b.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.calloutText, 0, -b.ballRadius - 12);
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
      `🪲 DUNG BEETLE ROLL • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X SPHERE' : ''}`,
      width * 0.5,
      19
    );

    this.beetles.forEach((b, idx) => {
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
    const sorted = [...this.beetles].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 1,
      rankings: sorted.map((b, i) => ({
        playerId: b.id,
        score: Math.round(b.score),
        place: i + 1,
      })),
      mvpHighlight: `Colossal Sphere Champion ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
