import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';
import { CharacterMood } from '../core/CharacterRenderer';

export interface BalloonTheme {
  name: string;
  skyTop: string;
  skyMid: string;
  skyBot: string;
  stageColorA: string;
  stageColorB: string;
  rimColor: string;
  buntingColors: string[];
}

export const BALLOON_THEMES: BalloonTheme[] = [
  {
    name: 'Carnival Fair 🎪',
    skyTop: '#0F172A',
    skyMid: '#1E1B4B',
    skyBot: '#020617',
    stageColorA: '#451A03',
    stageColorB: '#78350F',
    rimColor: '#F59E0B',
    buntingColors: ['#EF4444', '#F59E0B', '#10B981', '#06B9D4', '#8B5CF6', '#EC4899'],
  },
  {
    name: 'Neon Circus ⚡',
    skyTop: '#090514',
    skyMid: '#1D0B38',
    skyBot: '#05020A',
    stageColorA: '#180B2B',
    stageColorB: '#2E1065',
    rimColor: '#06B6D4',
    buntingColors: ['#06B6D4', '#EC4899', '#A855F7', '#FBBF24', '#38BDF8', '#F43F5E'],
  },
  {
    name: 'Sunset Boardwalk 🌅',
    skyTop: '#431407',
    skyMid: '#7C2D12',
    skyBot: '#1C0A04',
    stageColorA: '#3B1D11',
    stageColorB: '#5A2E1B',
    rimColor: '#FB923C',
    buntingColors: ['#F97316', '#FBBF24', '#EA580C', '#E11D48', '#F472B6', '#FDE047'],
  },
];

interface ReleasedBalloon {
  x: number;
  y: number;
  vy: number;
  radius: number;
  color: string;
  points: number;
  alpha: number;
}

interface PlayerBalloon {
  id: PlayerId;
  x: number;
  y: number;
  radius: number;
  burstLimit: number;
  isPumping: boolean;
  isGoldenBalloon: boolean;
  stunTimer: number;
  score: number;
  balloonsBanked: number;
  streak: number;
  multiplier: number;
  wobbleOffset: number;
  botTargetRatio: number;
  isUnderdog: boolean;
}

export class BalloonBurstGame extends BaseGame {
  public static readonly THEMES = BALLOON_THEMES;
  private currentThemeIndex: number = 0;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private pointerdownListener: ((e: PointerEvent) => void) | null = null;

  private balloons: Map<PlayerId, PlayerBalloon> = new Map();
  private releasedBalloons: ReleasedBalloon[] = [];
  private suddenDeath: boolean = false;

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  public destroy(): void {
    this.removeListeners();
    super.destroy();
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isFinished) return;
      if (e.code === 'KeyT') {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % BALLOON_THEMES.length;
        this.audio.playTap();
      } else if (e.key >= '1' && e.key <= '3') {
        this.currentThemeIndex = parseInt(e.key, 10) - 1;
        this.audio.playTap();
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.pointerdownListener = (e: PointerEvent) => {
      if (this.isFinished) return;
      const canvas = e.target as HTMLCanvasElement;
      if (!canvas || !canvas.getBoundingClientRect) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      if (clickX >= 20 && clickX <= 190 && clickY >= canvas.height - 44 && clickY <= canvas.height - 12) {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % BALLOON_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('pointerdown', this.pointerdownListener);
  }

  private removeListeners(): void {
    if (typeof window === 'undefined') return;
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
    if (this.pointerdownListener) {
      window.removeEventListener('pointerdown', this.pointerdownListener);
      this.pointerdownListener = null;
    }
  }

  private nextBotTarget(difficulty: string): number {
    if (difficulty === 'bot_hard') return 0.86 + Math.random() * 0.1;
    if (difficulty === 'bot_normal') return 0.75 + Math.random() * 0.14;
    return Math.random() < 0.25 ? 1.04 : 0.62 + Math.random() * 0.16;
  }

  private resetNozzleBalloon(b: PlayerBalloon): void {
    b.radius = 18;
    b.burstLimit = 78 + Math.random() * 18;
    b.isPumping = false;
    b.isGoldenBalloon = Math.random() < (this.suddenDeath ? 0.45 : 0.22);
    const pCfg = this.players[b.id];
    b.botTargetRatio = this.nextBotTarget(pCfg?.type || 'bot_normal');
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 38;
    this.isFinished = false;
    this.suddenDeath = false;
    this.balloons.clear();
    this.releasedBalloons = [];

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const b: PlayerBalloon = {
        id: p.id,
        x: spacing * (idx + 1),
        y: height / 2 + 10,
        radius: 18,
        burstLimit: 80 + Math.random() * 16,
        isPumping: false,
        isGoldenBalloon: false,
        stunTimer: 0,
        score: 0,
        balloonsBanked: 0,
        streak: 0,
        multiplier: 1,
        wobbleOffset: Math.random() * 10,
        botTargetRatio: this.nextBotTarget(p.type),
        isUnderdog: false,
      };
      this.balloons.set(p.id, b);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 15 && !this.suddenDeath) {
      this.suddenDeath = true;
      this.audio.playFanfare();
      this.particles.showFloatingText('⚡ GOLDEN HELIUM RUSH! 2X BANK VALUE! ⚡', width / 2, 95, '#FBBF24', 24);
    }

    for (let i = this.releasedBalloons.length - 1; i >= 0; i--) {
      const rb = this.releasedBalloons[i];
      rb.y += rb.vy * dt;
      rb.alpha -= dt * 0.65;
      if (rb.alpha <= 0 || rb.y < -80) {
        this.releasedBalloons.splice(i, 1);
      }
    }

    this.updateBots(dt, width, height);

    let maxScore = 0;
    for (const b of this.balloons.values()) {
      if (b.score > maxScore) maxScore = b.score;
    }

    for (const b of this.balloons.values()) {
      if (b.stunTimer > 0) {
        b.stunTimer -= dt;
        continue;
      }

      const isPressed = this.input.isPressed(b.id) || this.input.isActionPressed(b.id);
      const justReleased = this.input.justReleased(b.id) || (!isPressed && b.isPumping);

      b.isUnderdog = maxScore >= 350 && b.score <= maxScore - 350;
      const effectiveLimit = b.burstLimit * (b.isUnderdog ? 1.15 : 1.0);

      const capacityRatio = b.radius / effectiveLimit;
      if (capacityRatio >= 0.9) {
        b.multiplier = 5; // GOLDEN JACKPOT SWEET SPOT!
      } else if (capacityRatio >= 0.72) {
        b.multiplier = 3; // SWEET SPOT ZONE!
      } else if (capacityRatio >= 0.5) {
        b.multiplier = 2;
      } else {
        b.multiplier = 1;
      }

      if (isPressed) {
        b.isPumping = true;
        b.radius += dt * (b.isUnderdog ? 40 : 35);
        b.wobbleOffset += dt * 16;

        if (b.radius >= effectiveLimit) {
          // Overpumped POP! Stuns briefly and resets nozzle balloon without wiping banked score!
          b.stunTimer = 0.95;
          b.streak = 0;
          this.audio.playExplosion();
          this.particles.addTrauma(0.28);
          this.particles.spawnExplosion(b.x, b.y, this.players[b.id].color, 36);
          this.particles.showFloatingText('💥 POP! OVERPUMPED!', b.x, b.y - 20, '#EF4444', 24);
          this.resetNozzleBalloon(b);
        }
      } else if (justReleased && b.isPumping) {
        if (b.radius >= 28) {
          b.streak++;
          b.balloonsBanked++;
          const goldenBonus = b.isGoldenBalloon ? 1.5 : 1.0;
          const sdBonus = this.suddenDeath ? 1.5 : 1.0;
          const pts = Math.round(b.radius * 3.2 * b.multiplier * goldenBonus * sdBonus);
          b.score += pts;

          this.releasedBalloons.push({
            x: b.x,
            y: b.y,
            vy: -190,
            radius: b.radius,
            color: b.isGoldenBalloon ? '#FBBF24' : this.players[b.id].color,
            points: pts,
            alpha: 1.0,
          });

          this.audio.playScore();
          this.particles.addTrauma(0.12);
          this.particles.spawnSparks(b.x, b.y, '#10B981', 16);
          this.particles.showFloatingText(
            `BANKED! +${pts} (${b.multiplier}X)`,
            b.x,
            b.y - b.radius - 20,
            b.multiplier >= 3 ? '#FBBF24' : '#10B981',
            21
          );

          // 72%-98% Sweet-Spot Seal triggers an Acoustic Pressure Shunt on rival balloons!
          if (capacityRatio >= 0.72 && capacityRatio <= 0.99) {
            for (const other of this.balloons.values()) {
              if (other.id === b.id || other.stunTimer > 0) continue;
              if (other.isPumping && other.radius > 28) {
                other.radius += 7.5;
                other.wobbleOffset += 4;
                this.particles.showFloatingText('PRESSURE SHUNT!', other.x, other.y - other.radius - 16, '#F43F5E', 16);
              }
            }
          }

          this.resetNozzleBalloon(b);
        } else {
          b.isPumping = false;
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    void dt;
    void difficulty;
    void width;
    void height;
    const b = this.balloons.get(botId);
    if (!b || b.stunTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    const effectiveLimit = b.burstLimit * (b.isUnderdog ? 1.15 : 1.0);
    const targetRadius = effectiveLimit * b.botTargetRatio;

    if (b.radius < targetRadius) {
      this.input.setBotInput(botId, true, 0, 0, false);
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = Array.from(this.balloons.values()).sort((a, b) => b.score - a.score);
    const winnerId = sorted.length > 0 && sorted[0].score > 0 ? sorted[0].id : null;

    return {
      winnerId,
      rankings: sorted.map((b, idx) => ({
        playerId: b.id,
        score: b.score,
        place: idx + 1,
      })),
      mvpHighlight:
        winnerId !== null
          ? `${this.players[winnerId].name} banked ${sorted[0].balloonsBanked} balloons for ${sorted[0].score} pts!`
          : 'ALL BALLOONS POPPED!',
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    const theme = BALLOON_THEMES[this.currentThemeIndex];

    // 1. Dynamic Carnival Night Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, theme.skyTop);
    skyGrad.addColorStop(0.6, theme.skyMid);
    skyGrad.addColorStop(1, theme.skyBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Glowing string lights & Festive Bunting Flags
    const buntingY = 46;
    ctx.save();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, buntingY);
    ctx.quadraticCurveTo(width / 2, buntingY + 24, width, buntingY);
    ctx.stroke();

    const flagCount = 14;
    for (let i = 0; i < flagCount; i++) {
      const t = (i + 0.5) / flagCount;
      const fx = t * width;
      const fy = Math.pow(1 - t, 2) * buntingY + 2 * (1 - t) * t * (buntingY + 24) + Math.pow(t, 2) * buntingY;
      const flagW = 18;
      const flagH = 22;

      ctx.fillStyle = theme.buntingColors[i % theme.buntingColors.length];
      ctx.beginPath();
      ctx.moveTo(fx - flagW / 2, fy);
      ctx.lineTo(fx + flagW / 2, fy);
      ctx.lineTo(fx, fy + flagH);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(fx, fy - 1, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Floating Banked Balloons ascending into the sky
    for (const rb of this.releasedBalloons) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, rb.alpha);
      ctx.fillStyle = rb.color;
      ctx.beginPath();
      ctx.ellipse(rb.x, rb.y, rb.radius * 0.85, rb.radius * 0.95, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 13px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${rb.points}`, rb.x, rb.y);
      ctx.restore();
    }

    // 2. Wooden Carnival Stage Boardwalk at the Bottom
    const stageY = height - 76;
    ctx.fillStyle = theme.stageColorA;
    ctx.fillRect(0, stageY, width, height - stageY);
    ctx.fillStyle = theme.stageColorB;
    ctx.fillRect(0, stageY, width, 6);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 2;
    for (let px = 0; px < width; px += 48) {
      ctx.beginPath();
      ctx.moveTo(px, stageY);
      ctx.lineTo(px, height);
      ctx.stroke();
    }

    // 3. Balloons & Air Pumps
    for (const b of this.balloons.values()) {
      ctx.save();
      const pColor = this.players[b.id]?.color || '#FFFFFF';

      const pumpBaseY = height - 52;
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(b.x - 14, pumpBaseY - 24, 28, 28, 4);
      else ctx.rect(b.x - 14, pumpBaseY - 24, 28, 28);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.stroke();

      const handleOffset = b.isPumping ? 8 : 0;
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(b.x - 2, pumpBaseY - 36 + handleOffset, 4, 14);
      ctx.fillStyle = pColor;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(b.x - 16, pumpBaseY - 40 + handleOffset, 32, 6, 3);
      else ctx.rect(b.x - 16, pumpBaseY - 40 + handleOffset, 32, 6);
      ctx.fill();

      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(b.x + 10, pumpBaseY - 10);
      ctx.bezierCurveTo(b.x + 28, pumpBaseY, b.x + 28, b.y + b.radius + 18, b.x, b.y + b.radius + 6);
      ctx.stroke();

      // Pressure Gauge
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(b.x - 12, pumpBaseY - 14, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const effectiveLimit = b.burstLimit * (b.isUnderdog ? 1.15 : 1.0);
      const stress = b.radius / effectiveLimit;
      const needleAngle = -Math.PI * 0.75 + stress * Math.PI * 1.5;
      ctx.strokeStyle = stress > 0.8 ? '#EF4444' : '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x - 12, pumpBaseY - 14);
      ctx.lineTo(b.x - 12 + Math.cos(needleAngle) * 5, pumpBaseY - 14 + Math.sin(needleAngle) * 5);
      ctx.stroke();

      let mood: CharacterMood = 'focused';
      if (b.stunTimer > 0) mood = 'shocked';
      else if (stress > 0.82) mood = 'shocked';
      else if (b.isPumping) mood = 'happy';

      this.drawPlayerMascot(ctx, b.id, b.x, pumpBaseY - 56, 14, mood, performance.now() * 0.001);

      if (b.isUnderdog && b.stunTimer <= 0) {
        ctx.save();
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      if (b.stunTimer <= 0) {
        const stressRatio = b.radius / effectiveLimit;
        const wobbleX = stressRatio > 0.72 ? Math.sin(b.wobbleOffset) * (stressRatio * 5) : 0;

        const ballX = b.x + wobbleX;
        const baseColor = b.isGoldenBalloon ? '#FBBF24' : pColor;
        const ballGrad = ctx.createRadialGradient(
          ballX - b.radius * 0.3,
          b.y - b.radius * 0.3,
          b.radius * 0.1,
          ballX,
          b.y,
          b.radius
        );
        ballGrad.addColorStop(0, '#FFFFFF');
        ballGrad.addColorStop(0.3, baseColor);
        ballGrad.addColorStop(1, this.players[b.id]?.colorDark || '#000000');
        ctx.fillStyle = ballGrad;

        ctx.shadowColor = b.multiplier >= 5 ? '#FBBF24' : stressRatio > 0.82 ? '#EF4444' : baseColor;
        ctx.shadowBlur = b.multiplier >= 5 ? 26 : stressRatio > 0.82 ? 22 : 8;
        ctx.beginPath();
        ctx.ellipse(ballX, b.y, b.radius, b.radius * 1.08, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.beginPath();
        ctx.ellipse(
          ballX - b.radius * 0.35,
          b.y - b.radius * 0.38,
          b.radius * 0.22,
          b.radius * 0.12,
          -0.6,
          0,
          Math.PI * 2
        );
        ctx.fill();

        if (b.multiplier >= 2) {
          ctx.fillStyle = b.multiplier >= 5 ? '#FEF08A' : '#FFFFFF';
          ctx.font = '900 14px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${b.multiplier}X`, ballX, b.y);
        }

        if (stressRatio > 0.8) {
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ballX, b.y - b.radius * 0.4);
          ctx.lineTo(ballX + 7, b.y - b.radius * 0.1);
          ctx.lineTo(ballX - 5, b.y + b.radius * 0.2);
          ctx.stroke();
        }

        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.moveTo(ballX - 6, b.y + b.radius * 1.08);
        ctx.lineTo(ballX + 6, b.y + b.radius * 1.08);
        ctx.lineTo(ballX, b.y + b.radius * 1.08 + 7);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.save();
        ctx.fillStyle = '#EF4444';
        ctx.font = '900 18px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💥 SNAP STUN!', b.x, b.y);
        ctx.restore();
      }

      // Status & Banked Score Pill
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(b.x - 58, stageY - 32, 116, 24, 12);
      else ctx.rect(b.x - 58, stageY - 32, 116, 24);
      ctx.fill();
      ctx.strokeStyle = b.multiplier >= 3 ? '#FBBF24' : pColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = b.multiplier >= 3 ? '#FBBF24' : '#FFFFFF';
      ctx.font = '800 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`BANK: ${b.score} (${b.multiplier}X)`, b.x, stageY - 20);

      // Player Name Pill on Boardwalk
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(b.x - 45, height - 22, 90, 18, 9);
      else ctx.rect(b.x - 45, height - 22, 90, 18);
      ctx.fill();
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.players[b.id].name.toUpperCase(), b.x, height - 13);

      ctx.restore();
    }

    // 4. Interactive Bottom-Left Theme Pill
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, height - 44, 170, 32, 16);
    else ctx.rect(20, height - 44, 170, 32);
    ctx.fill();
    ctx.strokeStyle = theme.rimColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.rimColor;
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.name} [T]`, 20 + 85, height - 44 + 16);
    ctx.restore();

    ctx.restore();
  }
}
