import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SparkPad {
  x: number;
  y: number;
  isGolden: boolean;
  active: boolean;
}

interface BumperCar {
  id: PlayerId;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  charge: number;
  wasHolding: boolean;
  ramTimer: number;
  score: number;
  streak: number;
  multiplier: number;
  stunTimer: number;
  underdog: boolean;
  lastTapTime: number;
  botTimer: number;
}

type ThemeId = 'electric_pavilion' | 'cyber_bumper_dome' | 'retro_boardwalk';

interface ThemeSpec {
  name: string;
  floorInner: string;
  floorOuter: string;
  wallColor: string;
}

const THEMES: Record<ThemeId, ThemeSpec> = {
  electric_pavilion: {
    name: 'High-Voltage Pavilion',
    floorInner: '#1e1b4b',
    floorOuter: '#09071a',
    wallColor: '#00f5d4',
  },
  cyber_bumper_dome: {
    name: 'Cyber Bumper Thunderdome',
    floorInner: '#3b0764',
    floorOuter: '#140326',
    wallColor: '#f472b6',
  },
  retro_boardwalk: {
    name: 'Boardwalk Smash Ring',
    floorInner: '#0f2942',
    floorOuter: '#040b14',
    wallColor: '#facc15',
  },
};

const THEME_ORDER: ThemeId[] = ['electric_pavilion', 'cyber_bumper_dome', 'retro_boardwalk'];

export class BumperCarDerbyGame extends BaseGame {
  private cars: Map<PlayerId, BumperCar> = new Map();
  private pads: SparkPad[] = [];
  private timeElapsed = 0;
  private suddenDeath = false;
  private hitStopTimer = 0;
  private themeIndex = 0;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 38.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
    if (typeof window !== 'undefined' && !this.keyHandler) {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.themeIndex = (this.themeIndex + 1) % THEME_ORDER.length;
          this.audio.playTap();
        } else if (e.key >= '1' && e.key <= '3') {
          this.themeIndex = parseInt(e.key, 10) - 1;
          this.audio.playTap();
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 38.0;
    this.timeElapsed = 0;
    this.suddenDeath = false;
    this.hitStopTimer = 0;
    this.pads = [];
    this.cars.clear();
    this.floatingTexts = [];
    this.themeIndex = Math.floor(Math.random() * THEME_ORDER.length);

    const w = width || 1280;
    const h = height || 720;
    const cx = w / 2;
    const cy = h / 2 + 15;

    for (let i = 0; i < 6; i++) {
      this.spawnSparkPad(w, h);
    }

    const active = this.getActivePlayers();
    active.forEach((cfg, idx) => {
      const a = (idx / Math.max(1, active.length)) * Math.PI * 2;
      this.cars.set(cfg.id, {
        id: cfg.id,
        color: cfg.color,
        x: cx + Math.cos(a) * 140,
        y: cy + Math.sin(a) * 140,
        vx: 0,
        vy: 0,
        angle: a + Math.PI,
        charge: 0,
        wasHolding: false,
        ramTimer: 0,
        score: 0,
        streak: 0,
        multiplier: 1,
        stunTimer: 0,
        underdog: false,
        lastTapTime: -1,
        botTimer: 0.16,
      });
    });
  }

  public handlePointerDown(x: number, y: number, width: number, height: number): boolean {
    void height;
    if (y < 60 && x > width - 220) {
      this.themeIndex = (this.themeIndex + 1) % THEME_ORDER.length;
      this.audio.playTap();
      return true;
    }
    return false;
  }

  private addFloatingText(x: number, y: number, text: string, color: string, size = 18): void {
    this.floatingTexts.push({ x, y, text, color, alpha: 1, vy: -52, size });
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = `900 ${ft.size}px "Outfit", sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  private spawnSparkPad(w: number, h: number): void {
    const cx = w / 2;
    const cy = h / 2 + 15;
    const a = Math.random() * Math.PI * 2;
    const r = 65 + Math.random() * (Math.min(w, h) * 0.28);
    this.pads.push({
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r,
      isGolden: Math.random() < (this.suddenDeath ? 0.45 : 0.25),
      active: true,
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= dt * 1.1;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.timeElapsed += dt;
    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    if (this.roundTimer <= 15 && !this.suddenDeath) {
      this.suddenDeath = true;
      this.audio.playFanfare();
      this.addFloatingText(width / 2, 100, '⚡ SHRINKING HIGH-VOLTAGE RING! 2X SMASH! ⚡', '#facc15', 24);
    }

    const cx = width / 2;
    const cy = height / 2 + 15;
    const maxRadius = Math.min(width, height) * (this.suddenDeath ? 0.35 : 0.43);

    let activePads = 0;
    for (const p of this.pads) if (p.active) activePads++;
    while (activePads < 6) {
      this.spawnSparkPad(width, height);
      activePads++;
    }

    let maxScore = 0;
    this.cars.forEach((c) => {
      if (c.score > maxScore) maxScore = c.score;
    });

    this.updateBots(dt, width, height);

    this.cars.forEach((c) => {
      c.underdog = maxScore - c.score >= 120;
      if (c.stunTimer > 0) c.stunTimer -= dt;
      if (c.ramTimer > 0) c.ramTimer -= dt;

      const cfg = this.getPlayer(c.id);
      const isBot = cfg ? cfg.type.startsWith('bot_') : false;

      if (!isBot && c.stunTimer <= 0) {
        const move = { x: this.input.getSteer(c.id), y: -this.input.getThrottle(c.id) };
        const mag = Math.hypot(move.x, move.y);
        if (mag > 0.1) {
          c.angle = Math.atan2(move.y, move.x);
          const accel = c.underdog ? 720 : 620;
          c.vx += (move.x / mag) * accel * dt;
          c.vy += (move.y / mag) * accel * dt;
        } else if (this.input.justPressed(c.id) || this.input.justAction(c.id)) {
          // Active directional snap: tap to pivot 45 deg, double-tap for 180 turnaround!
          if (this.timeElapsed - c.lastTapTime < 0.28) {
            c.angle += Math.PI;
          } else {
            c.angle += Math.PI / 4;
          }
          c.lastTapTime = this.timeElapsed;
          c.vx += Math.cos(c.angle) * 160;
          c.vy += Math.sin(c.angle) * 160;
          this.audio.playTap();
        }
      }

      const holding = c.stunTimer <= 0 && (this.input.isActionPressed(c.id) || this.input.isPressed(c.id));
      if (holding) {
        c.charge = Math.min(1.2, c.charge + dt * 1.15);
        c.wasHolding = true;
      } else if (c.wasHolding) {
        c.wasHolding = false;
        if (c.charge > 0.16) {
          const ramImpulse = (420 + c.charge * 420) * (c.underdog ? 1.25 : 1.0);
          c.vx += Math.cos(c.angle) * ramImpulse;
          c.vy += Math.sin(c.angle) * ramImpulse;
          c.ramTimer = 0.5;
          this.audio.playBoost();
          this.particles.emit(c.x, c.y, 14, c.color);
        }
        c.charge = 0;
      }

      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vx *= 0.92;
      c.vy *= 0.92;

      // Spark Pad collection
      for (const pad of this.pads) {
        if (!pad.active) continue;
        if (Math.hypot(c.x - pad.x, c.y - pad.y) < 34) {
          pad.active = false;
          c.streak++;
          c.multiplier = c.streak >= 4 ? 4 : c.streak >= 2 ? 2 : 1;
          const pts = (pad.isGolden ? 60 : 25) * c.multiplier * (this.suddenDeath ? 2 : 1);
          c.score += pts;
          this.audio.playScore();
          this.particles.emit(pad.x, pad.y, 14, pad.isGolden ? '#facc15' : '#00f5d4');
          this.addFloatingText(pad.x, pad.y - 20, `+${pts} (${c.multiplier}x)`, pad.isGolden ? '#facc15' : '#00f5d4', 18);
        }
      }

      // Electrified Perimeter Wall bounce + zap
      const distC = Math.hypot(c.x - cx, c.y - cy);
      if (distC > maxRadius - 26) {
        const nx = (c.x - cx) / distC;
        const ny = (c.y - cy) / distC;
        c.x = cx + nx * (maxRadius - 26);
        c.y = cy + ny * (maxRadius - 26);
        c.vx = -nx * 360;
        c.vy = -ny * 360;
        c.streak = 0;
        c.multiplier = 1;
        this.audio.playStun();
        this.particles.emit(c.x, c.y, 16, '#ff2a85');
        this.addFloatingText(c.x, c.y - 22, 'WALL ZAP!', '#ff2a85', 17);
      }
    });

    // Elastic High-Impulse Bumper Car Collisions!
    const list = Array.from(this.cars.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 48;
        if (dist > 0 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          const speedA = Math.hypot(a.vx, a.vy);
          const speedB = Math.hypot(b.vx, b.vy);
          const impulse = Math.max(340, (speedA + speedB) * 0.85);

          a.vx = -nx * impulse * (b.underdog ? 1.35 : 1);
          a.vy = -ny * impulse * (b.underdog ? 1.35 : 1);
          b.vx = nx * impulse * (a.underdog ? 1.35 : 1);
          b.vy = ny * impulse * (a.underdog ? 1.35 : 1);

          if (speedA > speedB + 50) {
            const pts = 45 * a.multiplier * (this.suddenDeath ? 2 : 1);
            a.score += pts;
            this.addFloatingText(b.x, b.y - 24, `RAM SMASH! +${pts}`, '#facc15', 20);
          } else if (speedB > speedA + 50) {
            const pts = 45 * b.multiplier * (this.suddenDeath ? 2 : 1);
            b.score += pts;
            this.addFloatingText(a.x, a.y - 24, `RAM SMASH! +${pts}`, '#facc15', 20);
          }

          this.hitStopTimer = 0.045;
          this.audio.playExplosion();
          this.particles.emit((a.x + b.x) / 2, (a.y + b.y) / 2, 18, '#facc15');
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
    const c = this.cars.get(botId);
    if (!c || c.stunTimer > 0) {
      this.input.setBotState(botId, false);
      return;
    }

    const cx = width / 2;
    const cy = height / 2 + 15;

    c.botTimer -= dt;
    if (c.botTimer <= 0) {
      c.botTimer = difficulty === 'bot_hard' ? 0.14 : difficulty === 'bot_normal' ? 0.24 : 0.36;

      let bestPad: SparkPad | null = null;
      let bestD = Infinity;
      for (const p of this.pads) {
        if (!p.active) continue;
        const d = Math.hypot(p.x - c.x, p.y - c.y) - (p.isGolden ? 80 : 0);
        if (d < bestD) {
          bestD = d;
          bestPad = p;
        }
      }

      if (bestPad) {
        c.angle = Math.atan2(bestPad.y - c.y, bestPad.x - c.x) + (Math.random() - 0.5) * 0.24;
      } else {
        c.angle = Math.atan2(cy - c.y, cx - c.x);
      }
    }

    const accel = difficulty === 'bot_hard' ? 460 : difficulty === 'bot_normal' ? 370 : 280;
    c.vx += Math.cos(c.angle) * accel * dt;
    c.vy += Math.sin(c.angle) * accel * dt;
    this.input.setBotState(botId, c.charge < 0.55 && Math.random() < 0.65);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2 + 15;
    const maxRadius = Math.min(width, height) * (this.suddenDeath ? 0.35 : 0.43);
    const theme = THEMES[THEME_ORDER[this.themeIndex]];

    const bg = ctx.createRadialGradient(cx, cy, 30, cx, cy, Math.max(width, height) * 0.65);
    bg.addColorStop(0, theme.floorInner);
    bg.addColorStop(1, theme.floorOuter);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Electrified Bumper Ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);
    ctx.strokeStyle = theme.wallColor;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.restore();

    // Draw Spark Pads
    for (const p of this.pads) {
      if (!p.active) continue;
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.isGolden ? 20 : 16, 0, Math.PI * 2);
      ctx.fillStyle = p.isGolden ? '#facc15' : '#00f5d4';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 11px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.isGolden ? '⚡60' : '+25', p.x, p.y);
      ctx.restore();
    }

    // Draw Bumper Cars
    this.cars.forEach((c) => {
      ctx.save();
      // Heavy rubber bumper ring around avatar
      ctx.beginPath();
      ctx.arc(c.x, c.y, 26, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = c.ramTimer > 0 ? '#facc15' : c.color;
      ctx.stroke();

      if (c.charge > 0.05) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, 28 + c.charge * 14, 0, Math.PI * 2);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();

      const mood = c.stunTimer > 0 ? 'shocked' : c.ramTimer > 0 ? 'triumph' : 'focused';
      this.drawPlayerMascot(ctx, c.id, c.x, c.y, 20, mood, this.timeElapsed, 0);
    });

    this.renderFloatingTexts(ctx);

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(width - 215, 14, 200, 32);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 13px "Outfit", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`🎨 ${theme.name} [T]`, width - 24, 35);
    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.cars.values())
      .map((c) => ({ playerId: c.id, score: Math.floor(c.score), place: 1 }))
      .sort((a, b) => b.score - a.score);
    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });
    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `Player ${winnerId} dominated the Bumper Car Thunderdome!` : 'Bumper derby complete!',
    };
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    super.destroy();
  }
}
