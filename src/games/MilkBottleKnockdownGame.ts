import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface BottlePyramid {
  x: number;
  y: number;
  vx: number;
  bottlesLeft: number;
  isGolden: boolean;
  respawnTimer: number;
}

interface ThrownBaseball {
  ownerId: PlayerId;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isHeater: boolean;
  active: boolean;
}

interface PitcherPlayer {
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

type ThemeId = 'sandlot_midway' | 'neon_strike_zone' | 'county_fair_night';

interface ThemeSpec {
  name: string;
  bgTop: string;
  bgBot: string;
  shelfColor: string;
  accent: string;
}

const THEMES: Record<ThemeId, ThemeSpec> = {
  sandlot_midway: {
    name: 'Midway Strikeout Booth',
    bgTop: '#1e1b4b',
    bgBot: '#3b0764',
    shelfColor: '#78350f',
    accent: '#facc15',
  },
  neon_strike_zone: {
    name: 'Neon Fastball Cage',
    bgTop: '#041022',
    bgBot: '#0f2942',
    shelfColor: '#1e293b',
    accent: '#38bdf8',
  },
  county_fair_night: {
    name: 'County Fair Grandstand',
    bgTop: '#31102f',
    bgBot: '#140517',
    shelfColor: '#451a03',
    accent: '#fb7185',
  },
};

const THEME_ORDER: ThemeId[] = ['sandlot_midway', 'neon_strike_zone', 'county_fair_night'];

export class MilkBottleKnockdownGame extends BaseGame {
  private pitchers: Map<PlayerId, PitcherPlayer> = new Map();
  private pyramids: BottlePyramid[] = [];
  private baseballs: ThrownBaseball[] = [];
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
    this.pyramids = [];
    this.baseballs = [];
    this.pitchers.clear();
    this.floatingTexts = [];
    this.themeIndex = Math.floor(Math.random() * THEME_ORDER.length);

    const w = width || 1280;
    const h = height || 720;

    for (let i = 0; i < 5; i++) {
      this.pyramids.push({
        x: w * (0.18 + i * 0.16),
        y: i % 2 === 0 ? h * 0.27 : h * 0.38,
        vx: (i % 2 === 0 ? 1 : -1) * 75,
        bottlesLeft: 6,
        isGolden: i === 2,
        respawnTimer: 0,
      });
    }

    const active = this.getActivePlayers();
    active.forEach((cfg, idx) => {
      const startX = w * (0.25 + (idx / Math.max(1, active.length - 1)) * 0.5);
      this.pitchers.set(cfg.id, {
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
      this.addFloatingText(width / 2, 100, '⚡ FASTBALL FRENZY! 2X STRIKEOUTS! ⚡', '#facc15', 24);
    }

    for (const pyr of this.pyramids) {
      pyr.x += pyr.vx * (this.suddenDeath ? 1.35 : 1.0) * dt;
      if (pyr.x < 130 || pyr.x > width - 130) {
        pyr.vx *= -1;
      }
      if (pyr.respawnTimer > 0) {
        pyr.respawnTimer -= dt;
        if (pyr.respawnTimer <= 0) {
          pyr.bottlesLeft = 6;
          pyr.isGolden = Math.random() < (this.suddenDeath ? 0.45 : 0.28);
        }
      }
    }

    const moundY = height - 74;

    let maxScore = 0;
    this.pitchers.forEach((p) => {
      if (p.score > maxScore) maxScore = p.score;
    });

    this.updateBots(dt, width, height);

    this.pitchers.forEach((p) => {
      p.underdog = maxScore - p.score >= 120;
      if (p.stunTimer > 0) p.stunTimer -= dt;

      const pCfg = this.getPlayer(p.id);
      const isBot = pCfg ? pCfg.type.startsWith('bot_') : false;
      const hasSteer = this.input.hasSteer(p.id);

      const steer = hasSteer ? this.input.getSteer(p.id) : 0;
      if (Math.abs(steer) > 0.1 && p.stunTimer <= 0) {
        p.vx += steer * (p.underdog ? 680 : 560) * dt;
      } else if (!hasSteer && p.stunTimer <= 0) {
        p.vx += p.aimDir * (p.underdog ? 260 : 200) * dt;
      }

      p.aimAngle += p.aimDir * 1.45 * dt;
      if (p.aimAngle > -Math.PI / 2 + 0.5) {
        p.aimAngle = -Math.PI / 2 + 0.5;
        p.aimDir = -1;
      } else if (p.aimAngle < -Math.PI / 2 - 0.5) {
        p.aimAngle = -Math.PI / 2 - 0.5;
        p.aimDir = 1;
      }

      const holding = p.stunTimer <= 0 && (
        this.input.isActionPressed(p.id) ||
        (isBot && this.input.isPressed(p.id)) ||
        (!hasSteer && !isBot && this.input.isPressed(p.id))
      );
      if (holding) {
        p.charge += dt * 1.1;
        p.wasHolding = true;
        if (p.charge >= 1.2) {
          p.charge = 0;
          p.wasHolding = false;
          p.stunTimer = 0.85;
          p.streak = 0;
          p.multiplier = 1;
          this.audio.playBuzzer();
          this.addFloatingText(p.x, moundY - 36, 'WILD PITCH OVERCHARGE!', '#ff2a85', 17);
        }
      } else if (p.wasHolding) {
        p.wasHolding = false;
        const isHeater = p.charge >= 0.72 && p.charge <= 1.05;
        const speed = (isHeater ? 680 : 480) * (p.underdog ? 1.15 : 1.0);
        this.baseballs.push({
          ownerId: p.id,
          color: p.color,
          x: p.x,
          y: moundY - 22,
          vx: Math.cos(p.aimAngle) * speed,
          vy: Math.sin(p.aimAngle) * speed,
          isHeater,
          active: true,
        });
        p.charge = 0;
        this.audio.playWhoosh();
      }

      p.x += p.vx * dt;
      p.vx *= 0.88;
      p.x = Math.max(110, Math.min(width - 110, p.x));
    });

    // Mound player-to-player collisions
    const list = Array.from(this.pitchers.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (Math.abs(b.x - a.x) < 48) {
          const sign = b.x >= a.x ? 1 : -1;
          const overlap = 48 - Math.abs(b.x - a.x);
          a.x -= sign * overlap * 0.5;
          b.x += sign * overlap * 0.5;
          a.vx = -sign * 290;
          b.vx = sign * 290;
          this.audio.playBounce();
        }
      }
    }

    // Mid-air baseball-to-baseball deflections!
    for (let i = 0; i < this.baseballs.length; i++) {
      for (let j = i + 1; j < this.baseballs.length; j++) {
        const b1 = this.baseballs[i];
        const b2 = this.baseballs[j];
        if (!b1.active || !b2.active) continue;
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < 28) {
          const nx = dx / d;
          const ny = dy / d;
          b1.vx -= nx * 240;
          b2.vx += nx * 240;
          this.audio.playBounce();
          this.particles.emit((b1.x + b2.x) / 2, (b1.y + b2.y) / 2, 10, '#ffffff');
        }
      }
    }

    // Update baseballs & check pyramid strikes
    for (const ball of this.baseballs) {
      if (!ball.active) continue;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.y < 30 || ball.x < 20 || ball.x > width - 20) {
        ball.active = false;
        continue;
      }

      for (const pyr of this.pyramids) {
        if (pyr.bottlesLeft <= 0) continue;
        if (Math.hypot(ball.x - pyr.x, ball.y - pyr.y) < 44) {
          ball.active = false;
          const owner = this.pitchers.get(ball.ownerId);
          const knocked = ball.isHeater ? pyr.bottlesLeft : Math.min(pyr.bottlesLeft, 3);
          pyr.bottlesLeft -= knocked;
          if (pyr.bottlesLeft <= 0) {
            pyr.respawnTimer = 1.6;
          }

          if (owner) {
            owner.streak++;
            owner.multiplier = owner.streak >= 4 ? 4 : owner.streak >= 2 ? 2 : 1;
            const pts =
              (knocked * (pyr.isGolden ? 25 : 12) + (pyr.bottlesLeft <= 0 ? 35 : 0)) *
              owner.multiplier *
              (this.suddenDeath ? 2 : 1);
            owner.score += pts;
            this.audio.playExplosion();
            this.hitStopTimer = 0.04;
            this.particles.emit(pyr.x, pyr.y, 18, pyr.isGolden ? '#facc15' : '#ffffff');
            this.addFloatingText(
              pyr.x,
              pyr.y - 26,
              `${pyr.bottlesLeft <= 0 ? 'FULL STRIKE! ' : ''}+${pts} (${owner.multiplier}x)`,
              pyr.isGolden || ball.isHeater ? '#facc15' : '#38bdf8',
              pyr.bottlesLeft <= 0 ? 21 : 18
            );
          }
          break;
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
    void width;
    const p = this.pitchers.get(botId);
    if (!p || p.stunTimer > 0) {
      this.input.setBotState(botId, false);
      return;
    }

    p.botTimer -= dt;
    const moundY = height - 74;

    let aligned = false;
    for (const pyr of this.pyramids) {
      if (pyr.bottlesLeft <= 0) continue;
      const ang = Math.atan2(pyr.y - (moundY - 22), pyr.x - p.x);
      if (Math.abs(ang - p.aimAngle) < 0.24) {
        aligned = true;
        break;
      }
    }

    const releaseCharge = difficulty === 'bot_hard' ? 0.82 : difficulty === 'bot_normal' ? 0.76 : 0.58;
    if (p.charge >= releaseCharge || (aligned && p.charge > 0.45)) {
      this.input.setBotState(botId, false);
    } else {
      this.input.setBotState(botId, true);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const moundY = height - 74;
    const theme = THEMES[THEME_ORDER[this.themeIndex]];

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.bgTop);
    bg.addColorStop(1, theme.bgBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Draw Bottle Pyramids on Pedestal Shelves
    for (const pyr of this.pyramids) {
      ctx.save();
      ctx.fillStyle = theme.shelfColor;
      ctx.fillRect(pyr.x - 46, pyr.y + 18, 92, 12);
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(pyr.x - 46, pyr.y + 18, 92, 12);

      if (pyr.bottlesLeft > 0) {
        const positions = [
          { dx: -22, dy: 6 },
          { dx: 0, dy: 6 },
          { dx: 22, dy: 6 },
          { dx: -11, dy: -14 },
          { dx: 11, dy: -14 },
          { dx: 0, dy: -34 },
        ];
        for (let i = 0; i < pyr.bottlesLeft; i++) {
          const b = positions[i];
          ctx.fillStyle = pyr.isGolden ? '#facc15' : '#f8fafc';
          ctx.fillRect(pyr.x + b.dx - 7, pyr.y + b.dy - 10, 14, 22);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.strokeRect(pyr.x + b.dx - 7, pyr.y + b.dy - 10, 14, 22);
        }
      }
      ctx.restore();
    }

    // Draw Flying Baseballs
    for (const ball of this.baseballs) {
      if (!ball.active) continue;
      ctx.save();
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.isHeater ? 12 : 9, 0, Math.PI * 2);
      ctx.fillStyle = ball.isHeater ? '#facc15' : '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ef4444';
      ctx.stroke();
      ctx.restore();
    }

    // Draw Pitchers & Aim Guides
    this.pitchers.forEach((p) => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p.x, moundY - 22);
      ctx.lineTo(
        p.x + Math.cos(p.aimAngle) * (90 + p.charge * 120),
        moundY - 22 + Math.sin(p.aimAngle) * (90 + p.charge * 120)
      );
      ctx.strokeStyle = p.charge >= 0.72 ? '#facc15' : p.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.restore();

      const mood = p.stunTimer > 0 ? 'shocked' : p.charge >= 0.72 ? 'triumph' : 'focused';
      this.drawPlayerMascot(ctx, p.id, p.x, moundY, 22, mood, this.timeElapsed, 0);
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
    const rankings = Array.from(this.pitchers.values())
      .map((p) => ({ playerId: p.id, score: Math.floor(p.score), place: 1 }))
      .sort((a, b) => b.score - a.score);
    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });
    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `Player ${winnerId} shattered the Milk Bottle Pyramids!` : 'Strikeout showdown complete!',
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
