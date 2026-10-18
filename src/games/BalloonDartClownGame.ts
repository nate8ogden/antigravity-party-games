import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface WheelBalloon {
  angle: number;
  ringDist: number;
  color: string;
  isGoldStar: boolean;
  isWaterBomb: boolean;
  poppedTimer: number;
}

interface FlyingDart {
  ownerId: PlayerId;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
}

interface DartShooter {
  id: PlayerId;
  color: string;
  reticleAngle: number;
  reticleDist: number;
  reticleDir: number;
  charge: number;
  wasHolding: boolean;
  score: number;
  streak: number;
  multiplier: number;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
}

type ThemeId = 'midway_bigtop' | 'neon_boardwalk' | 'retro_arcade';

interface ThemeSpec {
  name: string;
  bgTop: string;
  bgBot: string;
  wheelFill: string;
  wheelStroke: string;
}

const THEMES: Record<ThemeId, ThemeSpec> = {
  midway_bigtop: {
    name: 'Big Top Carnival Wheel',
    bgTop: '#3b0764',
    bgBot: '#1e1b4b',
    wheelFill: '#4c1d95',
    wheelStroke: '#facc15',
  },
  neon_boardwalk: {
    name: 'Neon Boardwalk Pier',
    bgTop: '#082f49',
    bgBot: '#020617',
    wheelFill: '#0f172a',
    wheelStroke: '#38bdf8',
  },
  retro_arcade: {
    name: 'Retro Midway Gallery',
    bgTop: '#450a0a',
    bgBot: '#1c1917',
    wheelFill: '#292524',
    wheelStroke: '#fb7185',
  },
};

const THEME_ORDER: ThemeId[] = ['midway_bigtop', 'neon_boardwalk', 'retro_arcade'];

export class BalloonDartClownGame extends BaseGame {
  private shooters: Map<PlayerId, DartShooter> = new Map();
  private balloons: WheelBalloon[] = [];
  private darts: FlyingDart[] = [];
  private wheelAngle = 0;
  private wheelSpeed = 1.15;
  private noseFlashTimer = 0;
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
    void width;
    void height;
    this.isFinished = false;
    this.roundTimer = 38.0;
    this.timeElapsed = 0;
    this.suddenDeath = false;
    this.hitStopTimer = 0;
    this.wheelAngle = 0;
    this.wheelSpeed = 1.15;
    this.noseFlashTimer = 0;
    this.balloons = [];
    this.darts = [];
    this.shooters.clear();
    this.floatingTexts = [];
    this.themeIndex = Math.floor(Math.random() * THEME_ORDER.length);

    const palette = ['#38bdf8', '#4ade80', '#f472b6', '#c084fc'];
    for (let i = 0; i < 8; i++) {
      this.balloons.push({
        angle: (i / 8) * Math.PI * 2,
        ringDist: 92,
        color: palette[i % palette.length],
        isGoldStar: i % 4 === 0,
        isWaterBomb: i === 2,
        poppedTimer: 0,
      });
    }
    for (let i = 0; i < 12; i++) {
      this.balloons.push({
        angle: (i / 12) * Math.PI * 2,
        ringDist: 168,
        color: palette[i % palette.length],
        isGoldStar: i % 4 === 0,
        isWaterBomb: i % 6 === 3,
        poppedTimer: 0,
      });
    }

    const active = this.getActivePlayers();
    active.forEach((cfg, idx) => {
      this.shooters.set(cfg.id, {
        id: cfg.id,
        color: cfg.color,
        reticleAngle: (idx / Math.max(1, active.length)) * Math.PI * 2,
        reticleDist: 120,
        reticleDir: 1,
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

  public handlePointerDown(x: number, y: number, width: number = 960, height: number = 540): boolean {
    void height;
    if (y < 60 && x > width - 220) {
      this.themeIndex = (this.themeIndex + 1) % THEME_ORDER.length;
      this.audio.playTap();
      return true;
    }
    const midX = width / 2;
    const active = Array.from(this.shooters.values()).filter((s) => {
      const p = this.getPlayer(s.id);
      return p && !p.type.startsWith('bot_');
    });
    const shooter = active.find((s) => (s.id === 0 ? x < midX : x >= midX)) || active[0];
    if (shooter && shooter.stunTimer <= 0) {
      this.fireDartAtReticle(shooter, width * 0.5, 340);
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
      this.addFloatingText(width / 2, 100, '⚡ JACKPOT WHEEL OVERDRIVE! 2X POINTS! ⚡', '#facc15', 24);
    }

    if (this.noseFlashTimer > 0) this.noseFlashTimer -= dt;
    this.wheelAngle += this.wheelSpeed * (this.suddenDeath ? 1.35 : 1.0) * dt;

    for (const b of this.balloons) {
      if (b.poppedTimer > 0) {
        b.poppedTimer -= dt;
        if (b.poppedTimer <= 0) {
          b.isGoldStar = Math.random() < (this.suddenDeath ? 0.42 : 0.25);
          b.isWaterBomb = !b.isGoldStar && Math.random() < 0.16;
        }
      }
    }

    const cx = width / 2;
    const cy = height / 2 + 15;

    let maxScore = 0;
    this.shooters.forEach((s) => {
      if (s.score > maxScore) maxScore = s.score;
    });

    this.updateBots(dt, width, height);

    this.shooters.forEach((s) => {
      s.underdog = maxScore - s.score >= 120;
      if (s.stunTimer > 0) s.stunTimer -= dt;

      // Reticle orbits and sweeps radially across the wheel
      const steer = this.input.getSteer(s.id);
      const throttle = this.input.getThrottle(s.id);
      if (Math.abs(steer) > 0.1 && s.stunTimer <= 0) {
        s.reticleAngle += steer * 3.2 * dt;
      } else {
        s.reticleAngle -= 1.35 * dt;
      }

      if (Math.abs(throttle) > 0.1 && s.stunTimer <= 0) {
        s.reticleDist = Math.max(0, Math.min(185, s.reticleDist + throttle * 160 * dt));
      } else {
        s.reticleDist += s.reticleDir * 145 * dt;
        if (s.reticleDist > 185) {
          s.reticleDist = 185;
          s.reticleDir = -1;
        } else if (s.reticleDist < 0) {
          s.reticleDist = 0;
          s.reticleDir = 1;
        }
      }

      const pCfg = this.getPlayer(s.id);
      const isBot = pCfg ? pCfg.type.startsWith('bot_') : false;
      const hasSteer = this.input.hasSteer(s.id);
      const holding = s.stunTimer <= 0 && (this.input.isActionPressed(s.id) || (isBot && this.input.isPressed(s.id)) || (!hasSteer && !isBot && this.input.isPressed(s.id)));
      if (holding) {
        s.charge = Math.min(1.0, s.charge + dt * 1.2);
        s.wasHolding = true;
      } else if (s.wasHolding) {
        s.wasHolding = false;
        this.fireDartAtReticle(s, cx, cy);
        s.charge = 0;
      }
    });
  }

  private fireDartAtReticle(s: DartShooter, cx: number, cy: number): void {
    const rx = cx + Math.cos(s.reticleAngle) * s.reticleDist;
    const ry = cy + Math.sin(s.reticleAngle) * s.reticleDist;
    const blastRadius = 30 + s.charge * 34 + (s.underdog ? 14 : 0);

    this.audio.playWhoosh();
    this.particles.emit(rx, ry, 10, s.color);

    // Check if hit the central Honking Clown Nose bullseye!
    if (Math.hypot(rx - cx, ry - cy) < 34) {
      this.wheelSpeed = -this.wheelSpeed; // Reverses wheel spin to mess up rivals!
      this.noseFlashTimer = 0.45;
      s.streak++;
      s.multiplier = s.streak >= 4 ? 4 : s.streak >= 2 ? 2 : 1;
      const pts = 75 * s.multiplier * (this.suddenDeath ? 2 : 1);
      s.score += pts;
      this.audio.playFanfare();
      this.hitStopTimer = 0.045;
      this.addFloatingText(cx, cy - 28, `HONK BULLSEYE! SPIN REVERSED! +${pts}`, '#facc15', 20);
      return;
    }

    // Check if reticle bumped another shooter's reticle (sabotage shove!)
    this.shooters.forEach((other) => {
      if (other.id === s.id) return;
      const ox = cx + Math.cos(other.reticleAngle) * other.reticleDist;
      const oy = cy + Math.sin(other.reticleAngle) * other.reticleDist;
      if (Math.hypot(ox - rx, oy - ry) < 48) {
        other.reticleAngle += 0.85;
        this.addFloatingText(ox, oy - 20, 'RETICLE JOSTLED!', s.color, 16);
      }
    });

    let poppedCount = 0;
    let ptsGained = 0;
    let hitBomb = false;

    for (const b of this.balloons) {
      if (b.poppedTimer > 0) continue;
      const ba = b.angle + this.wheelAngle;
      const bx = cx + Math.cos(ba) * b.ringDist;
      const by = cy + Math.sin(ba) * b.ringDist;

      if (Math.hypot(bx - rx, by - ry) <= blastRadius) {
        b.poppedTimer = 2.4;
        if (b.isWaterBomb && !s.underdog) {
          hitBomb = true;
        } else {
          poppedCount++;
          ptsGained += b.isGoldStar ? 65 : 25;
          this.particles.emit(bx, by, 14, b.isGoldStar ? '#facc15' : b.color);
        }
      }
    }

    if (hitBomb) {
      s.streak = 0;
      s.multiplier = 1;
      s.stunTimer = 0.85;
      this.audio.playStun();
      this.addFloatingText(rx, ry - 20, 'WATER BOMB SPLASH! STUNNED', '#ff2a85', 17);
    } else if (poppedCount > 0) {
      s.streak += poppedCount;
      s.multiplier = s.streak >= 5 ? 4 : s.streak >= 3 ? 2 : 1;
      const total = ptsGained * s.multiplier * (this.suddenDeath ? 2 : 1);
      s.score += total;
      this.audio.playScore();
      this.hitStopTimer = 0.035;
      this.addFloatingText(
        rx,
        ry - 22,
        `POP! +${total} (${s.multiplier}x)`,
        poppedCount >= 2 ? '#facc15' : '#38bdf8',
        19
      );
    } else {
      s.streak = 0;
      s.multiplier = 1;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const s = this.shooters.get(botId);
    if (!s || s.stunTimer > 0) {
      this.input.setBotState(botId, false);
      return;
    }

    s.botTimer -= dt;
    if (s.botTimer > 0) return;

    const cx = width / 2;
    const cy = height / 2 + 15;
    const rx = cx + Math.cos(s.reticleAngle) * s.reticleDist;
    const ry = cy + Math.sin(s.reticleAngle) * s.reticleDist;

    let overTarget = Math.hypot(rx - cx, ry - cy) < 28;
    for (const b of this.balloons) {
      if (b.poppedTimer > 0 || b.isWaterBomb) continue;
      const ba = b.angle + this.wheelAngle;
      const bx = cx + Math.cos(ba) * b.ringDist;
      const by = cy + Math.sin(ba) * b.ringDist;
      if (Math.hypot(bx - rx, by - ry) < 34) {
        overTarget = true;
        break;
      }
    }

    if (overTarget) {
      s.botTimer = difficulty === 'bot_hard' ? 0.14 : difficulty === 'bot_normal' ? 0.24 : 0.36;
      this.input.setBotState(botId, false);
    } else {
      this.input.setBotState(botId, true);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2 + 15;
    const theme = THEMES[THEME_ORDER[this.themeIndex]];

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.bgTop);
    bg.addColorStop(1, theme.bgBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Rotating Carnival Wheel
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.wheelAngle);
    ctx.beginPath();
    ctx.arc(0, 0, 215, 0, Math.PI * 2);
    ctx.fillStyle = theme.wheelFill;
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = theme.wheelStroke;
    ctx.stroke();

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 215, Math.sin(a) * 215);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();

    // Central Honking Clown Nose Bullseye
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, this.noseFlashTimer > 0 ? 34 : 26, 0, Math.PI * 2);
    ctx.fillStyle = this.noseFlashTimer > 0 ? '#facc15' : '#ef4444';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();

    // Draw Balloons on Wheel
    for (const b of this.balloons) {
      if (b.poppedTimer > 0) continue;
      const ba = b.angle + this.wheelAngle;
      const bx = cx + Math.cos(ba) * b.ringDist;
      const by = cy + Math.sin(ba) * b.ringDist;

      ctx.save();
      ctx.beginPath();
      ctx.arc(bx, by, b.isGoldStar ? 22 : 18, 0, Math.PI * 2);
      ctx.fillStyle = b.isWaterBomb ? '#ff2a85' : b.isGoldStar ? '#facc15' : b.color;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = '900 11px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.isWaterBomb ? '💣' : b.isGoldStar ? '★65' : '+25', bx, by);
      ctx.restore();
    }

    // Draw Shooter Reticles & Mascots
    let idx = 0;
    this.shooters.forEach((s) => {
      const rx = cx + Math.cos(s.reticleAngle) * s.reticleDist;
      const ry = cy + Math.sin(s.reticleAngle) * s.reticleDist;

      ctx.save();
      ctx.beginPath();
      ctx.arc(rx, ry, 20 + s.charge * 22, 0, Math.PI * 2);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rx - 12, ry);
      ctx.lineTo(rx + 12, ry);
      ctx.moveTo(rx, ry - 12);
      ctx.lineTo(rx, ry + 12);
      ctx.stroke();
      ctx.restore();

      const px = width * (0.18 + idx * 0.21);
      const py = height - 48;
      const mood = s.stunTimer > 0 ? 'shocked' : s.multiplier >= 2 ? 'triumph' : 'focused';
      this.drawPlayerMascot(ctx, s.id, px, py, 22, mood, this.timeElapsed, 0);
      idx++;
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
    const rankings = Array.from(this.shooters.values())
      .map((s) => ({ playerId: s.id, score: Math.floor(s.score), place: 1 }))
      .sort((a, b) => b.score - a.score);
    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });
    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `Player ${winnerId} popped the Jackpot Wheel!` : 'Balloon dart shootout complete!',
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
