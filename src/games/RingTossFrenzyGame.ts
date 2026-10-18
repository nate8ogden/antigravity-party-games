import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CarnivalBottle {
  angle: number;
  ringLayer: number;
  isGolden: boolean;
  ringedBy: PlayerId | null;
  ringAnim: number;
}

interface ThrownRing {
  ownerId: PlayerId;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  vz: number;
  active: boolean;
}

interface TosserPlayer {
  id: PlayerId;
  color: string;
  x: number;
  vx: number;
  aimAngle: number;
  aimDir: number;
  charge: number;
  wasHolding: boolean;
  score: number;
  streak: number;
  multiplier: number;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
}

type ThemeId = 'boardwalk_neon' | 'county_fair_sunset' | 'tiki_pier';

interface ThemeSpec {
  name: string;
  bgTop: string;
  bgBot: string;
  tableColor: string;
  trimColor: string;
}

const THEMES: Record<ThemeId, ThemeSpec> = {
  boardwalk_neon: {
    name: 'Boardwalk Neon Midway',
    bgTop: '#111827',
    bgBot: '#311042',
    tableColor: '#1e293b',
    trimColor: '#38bdf8',
  },
  county_fair_sunset: {
    name: 'County Fair Sunset',
    bgTop: '#451a03',
    bgBot: '#7c2d12',
    tableColor: '#3f2305',
    trimColor: '#facc15',
  },
  tiki_pier: {
    name: 'Starlight Tiki Pier',
    bgTop: '#042f2e',
    bgBot: '#134e4a',
    tableColor: '#0f172a',
    trimColor: '#2dd4bf',
  },
};

const THEME_ORDER: ThemeId[] = ['boardwalk_neon', 'county_fair_sunset', 'tiki_pier'];

export class RingTossFrenzyGame extends BaseGame {
  private tossers: Map<PlayerId, TosserPlayer> = new Map();
  private bottles: CarnivalBottle[] = [];
  private rings: ThrownRing[] = [];
  private turntableAngle = 0;
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
    void height;
    this.isFinished = false;
    this.roundTimer = 38.0;
    this.timeElapsed = 0;
    this.suddenDeath = false;
    this.hitStopTimer = 0;
    this.turntableAngle = 0;
    this.bottles = [];
    this.rings = [];
    this.tossers.clear();
    this.floatingTexts = [];
    this.themeIndex = Math.floor(Math.random() * THEME_ORDER.length);

    const w = width || 1280;

    // Center golden bottle + inner ring (6) + outer ring (10)
    this.bottles.push({ angle: 0, ringLayer: 0, isGolden: true, ringedBy: null, ringAnim: 0 });
    for (let i = 0; i < 6; i++) {
      this.bottles.push({
        angle: (i / 6) * Math.PI * 2,
        ringLayer: 1,
        isGolden: i % 3 === 0,
        ringedBy: null,
        ringAnim: 0,
      });
    }
    for (let i = 0; i < 10; i++) {
      this.bottles.push({
        angle: (i / 10) * Math.PI * 2,
        ringLayer: 2,
        isGolden: i % 5 === 0,
        ringedBy: null,
        ringAnim: 0,
      });
    }

    const active = this.getActivePlayers();
    active.forEach((cfg, idx) => {
      const startX = w * (0.25 + (idx / Math.max(1, active.length - 1)) * 0.5);
      this.tossers.set(cfg.id, {
        id: cfg.id,
        color: cfg.color,
        x: startX,
        vx: 0,
        aimAngle: -Math.PI / 2,
        aimDir: 1,
        charge: 0,
        wasHolding: false,
        score: 0,
        streak: 0,
        multiplier: 1,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.18,
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

  private getBottlePos(b: CarnivalBottle, cx: number, cy: number): { x: number; y: number } {
    if (b.ringLayer === 0) return { x: cx, y: cy };
    const radius = b.ringLayer === 1 ? 85 : 165;
    const dir = b.ringLayer === 1 ? 1 : -0.7;
    const a = b.angle + this.turntableAngle * dir;
    return {
      x: cx + Math.cos(a) * radius,
      y: cy + Math.sin(a) * radius * 0.72,
    };
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
      this.addFloatingText(width / 2, 100, '⚡ GOLDEN BOTTLE FRENZY! 2X POINTS! ⚡', '#facc15', 24);
    }

    const cx = width / 2;
    const cy = height * 0.39;
    const counterY = height - 74;

    this.turntableAngle += (this.suddenDeath ? 1.35 : 0.85) * dt;

    for (const b of this.bottles) {
      if (b.ringAnim > 0) {
        b.ringAnim -= dt;
        if (b.ringAnim <= 0) {
          b.ringedBy = null;
          b.isGolden = Math.random() < (this.suddenDeath ? 0.45 : 0.25);
        }
      }
    }

    let maxScore = 0;
    this.tossers.forEach((t) => {
      if (t.score > maxScore) maxScore = t.score;
    });

    this.updateBots(dt, width, height);

    this.tossers.forEach((t) => {
      t.underdog = maxScore - t.score >= 120;
      if (t.stunTimer > 0) t.stunTimer -= dt;

      const isBot = this.getPlayer(t.id)?.type.startsWith('bot_');
      const hasSteer = this.input.hasSteer(t.id);
      const steer = hasSteer ? this.input.getSteer(t.id) : 0;
      if (Math.abs(steer) > 0.1 && t.stunTimer <= 0) {
        t.vx += steer * (t.underdog ? 680 : 560) * dt;
      } else if (!hasSteer && t.stunTimer <= 0) {
        t.vx += t.aimDir * (t.underdog ? 280 : 220) * dt;
      }

      // Sweep aim reticle toward turntable
      const baseAim = Math.atan2(cy - counterY, cx - t.x);
      t.aimAngle += t.aimDir * 1.35 * dt;
      if (t.aimAngle > baseAim + 0.48) {
        t.aimAngle = baseAim + 0.48;
        t.aimDir = -1;
      } else if (t.aimAngle < baseAim - 0.48) {
        t.aimAngle = baseAim - 0.48;
        t.aimDir = 1;
      }

      const holding = t.stunTimer <= 0 && (
        this.input.isActionPressed(t.id) ||
        (isBot && this.input.isPressed(t.id)) ||
        (!hasSteer && !isBot && this.input.isPressed(t.id))
      );
      if (holding) {
        t.charge += dt * 1.05;
        t.wasHolding = true;
        if (t.charge >= 1.25) {
          // Overcharge fumble stun!
          t.charge = 0;
          t.wasHolding = false;
          t.stunTimer = 0.85;
          t.streak = 0;
          t.multiplier = 1;
          this.audio.playBuzzer();
          this.addFloatingText(t.x, counterY - 36, 'OVERCHARGE FUMBLE!', '#ff2a85', 17);
        }
      } else if (t.wasHolding) {
        t.wasHolding = false;
        const speed = 260 + t.charge * 380;
        this.rings.push({
          ownerId: t.id,
          color: t.color,
          x: t.x,
          y: counterY - 16,
          vx: Math.cos(t.aimAngle) * speed,
          vy: Math.sin(t.aimAngle) * speed,
          z: 10,
          vz: 190,
          active: true,
        });
        t.charge = 0;
        this.audio.playWhoosh();
      }

      t.x += t.vx * dt;
      t.vx *= 0.88;
      t.x = Math.max(120, Math.min(width - 120, t.x));
    });

    // Player-to-player counter bumping!
    const list = Array.from(this.tossers.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (Math.abs(b.x - a.x) < 48) {
          const sign = b.x >= a.x ? 1 : -1;
          const overlap = 48 - Math.abs(b.x - a.x);
          a.x -= sign * overlap * 0.5;
          b.x += sign * overlap * 0.5;
          a.vx = -sign * 280;
          b.vx = sign * 280;
          this.audio.playBounce();
        }
      }
    }

    // Mid-air ring-to-ring collisions!
    for (let i = 0; i < this.rings.length; i++) {
      for (let j = i + 1; j < this.rings.length; j++) {
        const r1 = this.rings[i];
        const r2 = this.rings[j];
        if (!r1.active || !r2.active) continue;
        const dx = r2.x - r1.x;
        const dy = r2.y - r1.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < 32 && Math.abs(r1.z - r2.z) < 25) {
          const nx = dx / d;
          const ny = dy / d;
          r1.vx -= nx * 180;
          r1.vy -= ny * 180;
          r2.vx += nx * 180;
          r2.vy += ny * 180;
          this.audio.playBounce();
          this.particles.emit((r1.x + r2.x) / 2, (r1.y + r2.y) / 2, 10, '#ffffff');
          this.addFloatingText((r1.x + r2.x) / 2, (r1.y + r2.y) / 2, 'RING CLASH!', '#facc15', 16);
        }
      }
    }

    // Update thrown rings & check bottle landings
    for (const r of this.rings) {
      if (!r.active) continue;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.z += r.vz * dt;
      r.vz -= 360 * dt;

      if (r.z <= 0) {
        r.active = false;
        const owner = this.tossers.get(r.ownerId);
        let scored = false;

        for (const b of this.bottles) {
          if (b.ringedBy !== null) continue;
          const bPos = this.getBottlePos(b, cx, cy);
          const snapRadius = owner?.underdog ? 36 : 30;
          if (Math.hypot(r.x - bPos.x, r.y - bPos.y) <= snapRadius) {
            scored = true;
            b.ringedBy = r.ownerId;
            b.ringAnim = 1.6;
            if (owner) {
              owner.streak++;
              owner.multiplier = owner.streak >= 4 ? 4 : owner.streak >= 2 ? 2 : 1;
              const pts = (b.isGolden ? 80 : 30) * owner.multiplier * (this.suddenDeath ? 2 : 1);
              owner.score += pts;
              this.audio.playScore();
              this.hitStopTimer = 0.04;
              this.particles.emit(bPos.x, bPos.y, 18, b.isGolden ? '#facc15' : r.color);
              this.addFloatingText(
                bPos.x,
                bPos.y - 22,
                `RINGER! +${pts} (${owner.multiplier}x)`,
                b.isGolden ? '#facc15' : '#38bdf8',
                b.isGolden ? 21 : 18
              );
            }
            break;
          }
        }

        if (!scored && owner) {
          owner.streak = 0;
          owner.multiplier = 1;
          this.audio.playTap();
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
    const t = this.tossers.get(botId);
    if (!t || t.stunTimer > 0) {
      this.input.setBotState(botId, false);
      return;
    }

    t.botTimer -= dt;
    const cx = width / 2;
    const cy = height * 0.39;
    const counterY = height - 74;

    // Pick a golden unringed bottle to aim for
    let targetBottle: CarnivalBottle | null = null;
    let bestScore = Infinity;
    for (const b of this.bottles) {
      if (b.ringedBy !== null) continue;
      const pos = this.getBottlePos(b, cx, cy);
      const dist = Math.hypot(pos.x - t.x, pos.y - (counterY - 16));
      const score = dist - (b.isGolden ? 120 : 0);
      if (score < bestScore) {
        bestScore = score;
        targetBottle = b;
      }
    }

    if (targetBottle) {
      const pos = this.getBottlePos(targetBottle, cx, cy);
      const desiredDist = Math.hypot(pos.x - t.x, pos.y - (counterY - 16));
      // Flight time is roughly 2 * 190 / 360 = 1.05s, so speed needed = desiredDist / 1.05
      const neededSpeed = desiredDist / 1.05;
      const idealCharge = Math.max(0.15, Math.min(0.95, (neededSpeed - 260) / 380));
      const noise = difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.12 : 0.22;

      if (t.charge >= idealCharge + (Math.random() - 0.5) * noise) {
        this.input.setBotState(botId, false);
      } else {
        this.input.setBotState(botId, true);
      }
    } else {
      this.input.setBotState(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const cx = width / 2;
    const cy = height * 0.39;
    const counterY = height - 74;
    const theme = THEMES[THEME_ORDER[this.themeIndex]];

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.bgTop);
    bg.addColorStop(1, theme.bgBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // 2.5D Rotating Bottle Turntable
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, 210, 210 * 0.72, 0, 0, Math.PI * 2);
    ctx.fillStyle = theme.tableColor;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = theme.trimColor;
    ctx.stroke();
    ctx.restore();

    // Draw Bottles
    for (const b of this.bottles) {
      const pos = this.getBottlePos(b, cx, cy);
      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Bottle base & neck
      ctx.fillStyle = b.isGolden ? '#facc15' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -5, 6, 0, Math.PI * 2);
      ctx.fill();

      if (b.ringedBy !== null) {
        ctx.beginPath();
        ctx.arc(0, 0, 21, 0, Math.PI * 2);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 5;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw Preview Reticles & Tossers along Booth Counter
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(80, counterY - 28, width - 160, 68);

    this.tossers.forEach((t) => {
      if (t.charge > 0.02) {
        const speed = 260 + t.charge * 380;
        const landX = t.x + Math.cos(t.aimAngle) * speed * 1.05;
        const landY = counterY - 16 + Math.sin(t.aimAngle) * speed * 1.05;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(t.x, counterY - 16);
        ctx.lineTo(landX, landY);
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(landX, landY, 22, 0, Math.PI * 2);
        ctx.strokeStyle = t.charge > 1.05 ? '#ff2a85' : t.color;
        ctx.lineWidth = 4;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.restore();
      }

      const mood = t.stunTimer > 0 ? 'shocked' : t.charge > 0.1 ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, t.id, t.x, counterY, 22, mood, this.timeElapsed, 0);
    });

    // Draw Flying Rings
    for (const r of this.rings) {
      if (!r.active) continue;
      ctx.save();
      const scale = 1 + r.z * 0.008;
      ctx.translate(r.x, r.y - r.z * 0.6);
      ctx.scale(scale, scale * 0.78);
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.restore();
    }

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
    const rankings = Array.from(this.tossers.values())
      .map((t) => ({ playerId: t.id, score: Math.floor(t.score), place: 1 }))
      .sort((a, b) => b.score - a.score);
    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });
    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `Player ${winnerId} ringed every Golden Bottle!` : 'Midway ring toss complete!',
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
