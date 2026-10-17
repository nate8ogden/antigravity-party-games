import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type SlalomTheme = 'pebble_garden' | 'zen_rock_garden' | 'neon_circuit';

interface SlalomPalette {
  name: string;
  bgTop: string;
  bgBot: string;
  gateColor: string;
}

const THEMES: Record<SlalomTheme, SlalomPalette> = {
  pebble_garden: {
    name: 'Garden Pebble Slalom',
    bgTop: '#14532d',
    bgBot: '#052e16',
    gateColor: '#ef4444',
  },
  zen_rock_garden: {
    name: 'Kyoto Zen Stone Course',
    bgTop: '#334155',
    bgBot: '#0f172a',
    gateColor: '#fbbf24',
  },
  neon_circuit: {
    name: 'Cyber Slalom Track',
    bgTop: '#1e1b4b',
    bgBot: '#090d16',
    gateColor: '#22d3ee',
  },
};

const THEME_KEYS: SlalomTheme[] = ['pebble_garden', 'zen_rock_garden', 'neon_circuit'];

interface SlalomGate {
  id: number;
  x: number;
  y: number;
  vy: number;
  golden: boolean;
}

interface CentipedeRacer {
  id: PlayerId;
  color: string;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  trail: { x: number; y: number }[];
  score: number;
  combo: number;
  charge: number;
  holding: boolean;
  turboTimer: number;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class CentipedeSlalomGame extends BaseGame {
  private racers: CentipedeRacer[] = [];
  private gates: SlalomGate[] = [];
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
    this.racers = [];
    this.gates = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const sx = width * (0.32 + idx * 0.18);
      const sy = height * 0.78;
      this.racers.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: sx,
        y: sy,
        vx: 0,
        trail: Array.from({ length: 6 }, (_, k) => ({ x: sx, y: sy + k * 12 })),
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        turboTimer: 0,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.22,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    for (let i = 0; i < 5; i++) {
      this.gates.push({
        id: i,
        x: width * (0.25 + (i % 3) * 0.25),
        y: height * (0.15 + i * 0.16),
        vy: 190,
        golden: i % 2 === 1,
      });
    }
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(r: CentipedeRacer, text: string): void {
    r.calloutText = text;
    r.calloutTimer = 1.15;
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
      this.racers.forEach((r) => this.showCallout(r, 'SLALOM OVERDRIVE 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    for (const g of this.gates) {
      g.y += g.vy * (this.suddenDeath ? 1.35 : 1.0) * dt;
      if (g.y > height * 0.92) {
        g.y = 50;
        g.x = width * (0.2 + Math.random() * 0.6);
        g.golden = Math.random() < 0.35;
      }
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.racers.map((r) => r.score));

    for (const r of this.racers) {
      r.underdog = maxScore - r.score >= 150;
      if (r.calloutTimer > 0) r.calloutTimer = Math.max(0, r.calloutTimer - dt);
      if (r.turboTimer > 0) r.turboTimer = Math.max(0, r.turboTimer - dt);
      if (r.stunTimer > 0) {
        r.stunTimer = Math.max(0, r.stunTimer - dt);
        continue;
      }

      const steer = this.input.getSteer(r.id);
      const isHold = this.input.isActionPressed(r.id) || this.input.isPressed(r.id);

      // Direct lateral slalom carving (eliminated passive circle rotation!)
      r.vx += steer * 1550 * (r.underdog ? 1.15 : 1.0) * (r.turboTimer > 0 ? 1.35 : 1.0) * dt;
      r.vx *= Math.pow(0.05, dt);
      r.x = Math.max(width * 0.12, Math.min(width * 0.88, r.x + r.vx * dt));

      // Update body segment trail
      r.trail.unshift({ x: r.x, y: r.y });
      if (r.trail.length > 7) r.trail.pop();
      r.trail.forEach((seg, idx) => {
        seg.y = r.y + idx * 10;
      });

      // Hold-to-charge Whip-Tail Carve & Slalom Shunt (72%-98% Sweet Spot)
      if (isHold) {
        r.holding = true;
        r.charge = Math.min(1, r.charge + dt * 0.92);
      } else if (r.holding) {
        const sweet = r.charge >= 0.72 && r.charge <= 0.98;
        if (sweet) {
          r.turboTimer = 2.2;
          r.score += 85;
          r.combo = Math.min(4, r.combo + 1);
          this.showCallout(r, 'WHIP-TAIL CARVE +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 11);

          for (const other of this.racers) {
            if (other.id !== r.id && Math.abs(other.x - r.x) < 150) {
              other.vx += (other.x >= r.x ? 1 : -1) * 560;
              r.score += 70;
              this.showCallout(r, 'TAIL-WHIP SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else if (r.charge > 0.98) {
          r.stunTimer = 0.9;
          r.combo = 1;
          this.showCallout(r, 'TANGLED SEGMENTS!');
          this.audio.playStun();
        }
        r.holding = false;
        r.charge = 0;
      }

      for (const g of this.gates) {
        if (Math.abs(g.y - r.y) < 18 && Math.abs(g.x - r.x) < 48) {
          g.y = 50;
          g.x = width * (0.2 + Math.random() * 0.6);
          const base = g.golden ? 95 : 55;
          const pts = base * r.combo * (this.suddenDeath ? 2 : 1);
          r.score += pts;
          r.combo = Math.min(4, r.combo + 1);
          this.showCallout(r, g.golden ? `GOLDEN GATE +${pts}!` : `CLEAN SLALOM +${pts}`);
          this.audio.playScore();
          this.particles.spawnSparks(r.x, r.y, '#fbbf24', 10);
        }
      }
    }

    // Racer-to-Racer Bumping
    for (let i = 0; i < this.racers.length; i++) {
      for (let j = i + 1; j < this.racers.length; j++) {
        const a = this.racers[i];
        const b = this.racers[j];
        const dx = b.x - a.x;
        if (Math.abs(dx) < 38) {
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
    _width: number,
    _height: number
  ): void {
    const bot = this.racers.find((r) => r.id === botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    // Steer toward closest upcoming gate
    let nextGate: SlalomGate | null = null;
    let bestY = -999;
    for (const g of this.gates) {
      if (g.y < bot.y && g.y > bestY) {
        bestY = g.y;
        nextGate = g;
      }
    }
    if (nextGate) {
      bot.vx += Math.sign(nextGate.x - bot.x) * 1200 * dt;
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

    // Slalom Gates
    for (const g of this.gates) {
      ctx.fillStyle = g.golden ? '#fbbf24' : pal.gateColor;
      ctx.beginPath();
      ctx.arc(g.x - 44, g.y, 12, 0, Math.PI * 2);
      ctx.arc(g.x + 44, g.y, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = g.golden ? '#fde047' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(g.x - 32, g.y);
      ctx.lineTo(g.x + 32, g.y);
      ctx.stroke();
    }

    // Centipede Racers
    for (const r of this.racers) {
      for (let k = r.trail.length - 1; k >= 1; k--) {
        const seg = r.trail[k];
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.arc(seg.x, seg.y, 12 - k, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(r.x, r.y);
      if (r.holding && r.charge > 0.05) {
        const sweet = r.charge >= 0.72 && r.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + r.charge * Math.PI * 2);
        ctx.stroke();
      }
      const mood = r.stunTimer > 0 ? 'shocked' : r.turboTimer > 0 ? 'triumph' : r.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, r.id, 0, 0, 16, mood, this.timeElapsed, r.vx * 0.0005);
      if (r.calloutTimer > 0 && r.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(r.calloutText, 0, -28);
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
      `🐛 CENTIPEDE SLALOM • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X GATES' : ''}`,
      width * 0.5,
      19
    );

    this.racers.forEach((r, idx) => {
      ctx.fillStyle = r.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${r.id}: ${Math.round(r.score)} pts (${r.combo}x)`, 90 + idx * 170, 38);
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.racers].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 0,
      rankings: sorted.map((r, i) => ({
        playerId: r.id,
        score: Math.round(r.score),
        place: i + 1,
      })),
      mvpHighlight: `Slalom Weave Champion ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
