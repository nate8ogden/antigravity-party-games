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
    buntingColors: ['#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#8B5CF6', '#EC4899']
  },
  {
    name: 'Neon Circus ⚡',
    skyTop: '#090514',
    skyMid: '#1D0B38',
    skyBot: '#05020A',
    stageColorA: '#180B2B',
    stageColorB: '#2E1065',
    rimColor: '#06B6D4',
    buntingColors: ['#06B6D4', '#EC4899', '#A855F7', '#FBBF24', '#38BDF8', '#F43F5E']
  },
  {
    name: 'Sunset Boardwalk 🌅',
    skyTop: '#431407',
    skyMid: '#7C2D12',
    skyBot: '#1C0A04',
    stageColorA: '#3B1D11',
    stageColorB: '#5A2E1B',
    rimColor: '#FB923C',
    buntingColors: ['#F97316', '#FBBF24', '#EA580C', '#E11D48', '#F472B6', '#FDE047']
  }
];

interface PlayerBalloon {
  id: PlayerId;
  x: number;
  y: number;
  radius: number;
  burstLimit: number;
  isPumping: boolean;
  isSealed: boolean;
  isPopped: boolean;
  score: number;
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
  private allDoneTimer: number = 0;

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

      // Theme pill is at x: 20, y: canvas.height - 44, w: 170, h: 32
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

  public reset(width: number, height: number): void {
    this.roundTimer = 45;
    this.isFinished = false;
    this.balloons.clear();
    this.allDoneTimer = 0;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    // Secret base burst threshold between 76px and 96px
    const baseLimit = 78 + Math.random() * 18;

    active.forEach((p, idx) => {
      this.balloons.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height / 2 + 10,
        radius: 18,
        burstLimit: baseLimit + (Math.random() - 0.5) * 6,
        isPumping: false,
        isSealed: false,
        isPopped: false,
        score: 0,
        multiplier: 1,
        wobbleOffset: Math.random() * 10,
        botTargetRatio: 0.82,
        isUnderdog: false
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Calculate leader score for Underdog Surge
    let maxScore = 0;
    for (const b of this.balloons.values()) {
      if (b.score > maxScore) maxScore = b.score;
    }

    let allDone = true;

    for (const b of this.balloons.values()) {
      if (b.isSealed || b.isPopped) continue;

      allDone = false;
      const isPressed = this.input.isPressed(b.id) || this.input.isActionPressed(b.id);
      const justReleased = this.input.justReleased(b.id);

      // Underdog check: trailing behind by >= 250 points grants Double-Wall safety cushion
      b.isUnderdog = maxScore >= 250 && b.score <= maxScore - 250;
      const effectiveLimit = b.burstLimit * (b.isUnderdog ? 1.15 : 1.0);

      // Calculate dynamic score multiplier based on push-your-luck capacity
      const capacityRatio = b.radius / effectiveLimit;
      if (capacityRatio > 0.92) {
        b.multiplier = 5; // GOLDEN JACKPOT ZONE!
      } else if (capacityRatio > 0.78) {
        b.multiplier = 3; // DANGER ZONE!
      } else if (capacityRatio > 0.55) {
        b.multiplier = 2;
      } else {
        b.multiplier = 1;
      }

      if (isPressed) {
        b.isPumping = true;
        b.radius += dt * 34; // Smooth inflation
        b.wobbleOffset += dt * 16;

        // Check if exceeded burst limit
        if (b.radius >= effectiveLimit) {
          b.isPopped = true;
          b.isPumping = false;
          b.score = 0;
          this.audio.playExplosion();
          this.particles.addTrauma(0.3);
          this.particles.spawnExplosion(b.x, b.y, this.players[b.id].color, 40);
          this.particles.showFloatingText('💥 POP! OVERPUMPED!', b.x, b.y - 20, '#EF4444', 26);
        }
      } else if (justReleased && b.isPumping) {
        // Sealed! Lock in final score with multiplier
        b.isSealed = true;
        b.isPumping = false;
        b.score = Math.round(b.radius * 10 * b.multiplier);
        this.audio.playFanfare();
        this.particles.addTrauma(0.12);
        this.particles.spawnSparks(b.x, b.y, '#10B981', 16);
        this.particles.showFloatingText(`SEALED! ${b.multiplier}X [${b.score} PTS]`, b.x, b.y - b.radius - 20, '#10B981', 22);
      }
    }

    if (allDone || this.roundTimer <= 0) {
      this.allDoneTimer += dt;
      if (this.allDoneTimer > 1.8) {
        this.isFinished = true;
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
    const b = this.balloons.get(botId);
    if (!b || b.isSealed || b.isPopped) return;

    const effectiveLimit = b.burstLimit * (b.isUnderdog ? 1.15 : 1.0);

    // Initialize bot target threshold
    if (b.botTargetRatio === 0.82 && b.radius <= 20) {
      if (difficulty === 'bot_hard') {
        // High level pushes for the 5x Jackpot zone (93% - 97%)
        b.botTargetRatio = 0.93 + Math.random() * 0.04;
      } else if (difficulty === 'bot_normal') {
        // Normal aims for solid 2x or 3x multiplier (80% - 88%)
        b.botTargetRatio = 0.81 + Math.random() * 0.07;
      } else {
        // Easy has a 28% risk of overpumping and popping, else stops early (65% - 76%)
        b.botTargetRatio = Math.random() < 0.28 ? 1.05 : 0.66 + Math.random() * 0.10;
      }
    }

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
        place: idx + 1
      })),
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} INFLATED THE BIGGEST BALLOON!` : 'ALL BALLOONS POPPED!'
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

    // Pennant Flags
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

      // Light bulb at flag peg
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(fx, fy - 1, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

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

      // Brass Floor Pump Cylinder
      const pumpBaseY = height - 52;
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(b.x - 14, pumpBaseY - 24, 28, 28, 4);
      else ctx.rect(b.x - 14, pumpBaseY - 24, 28, 28);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.stroke();

      // T-handle bar (animated down when pumping)
      const handleOffset = b.isPumping ? 8 : 0;
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(b.x - 2, pumpBaseY - 36 + handleOffset, 4, 14);
      ctx.fillStyle = pColor;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(b.x - 16, pumpBaseY - 40 + handleOffset, 32, 6, 3);
      else ctx.rect(b.x - 16, pumpBaseY - 40 + handleOffset, 32, 6);
      ctx.fill();

      // Corrugated air hose
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

      // Character Mascot Operating the Pump!
      let mood: CharacterMood = 'focused';
      if (b.isPopped) mood = 'shocked';
      else if (b.isSealed) mood = 'triumph';
      else if (stress > 0.82) mood = 'shocked';
      else if (b.isPumping) mood = 'happy';

      this.drawPlayerMascot(ctx, b.id, b.x, pumpBaseY - 56, 14, mood, performance.now() * 0.001);

      // Underdog Double-Wall Golden Halo
      if (b.isUnderdog && !b.isPopped) {
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

      // Balloon Rendering
      if (!b.isPopped) {
        const stressRatio = b.radius / effectiveLimit;
        const wobbleX = stressRatio > 0.72 ? Math.sin(b.wobbleOffset) * (stressRatio * 5) : 0;

        // 3D Latex Balloon Body
        const ballX = b.x + wobbleX;
        const ballGrad = ctx.createRadialGradient(
          ballX - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.1,
          ballX, b.y, b.radius
        );
        ballGrad.addColorStop(0, '#FFFFFF');
        ballGrad.addColorStop(0.3, pColor);
        ballGrad.addColorStop(1, this.players[b.id]?.colorDark || '#000000');
        ctx.fillStyle = ballGrad;

        ctx.shadowColor = b.multiplier >= 5 ? '#FBBF24' : stressRatio > 0.82 ? '#EF4444' : pColor;
        ctx.shadowBlur = b.multiplier >= 5 ? 26 : stressRatio > 0.82 ? 22 : 8;
        ctx.beginPath();
        ctx.ellipse(ballX, b.y, b.radius, b.radius * 1.08, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Specular Highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.beginPath();
        ctx.ellipse(ballX - b.radius * 0.35, b.y - b.radius * 0.38, b.radius * 0.22, b.radius * 0.12, -0.6, 0, Math.PI * 2);
        ctx.fill();

        // Multiplier Badge inside balloon
        if (b.multiplier >= 2) {
          ctx.fillStyle = b.multiplier >= 5 ? '#FEF08A' : '#FFFFFF';
          ctx.font = '900 14px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${b.multiplier}X`, ballX, b.y);
        }

        // Strain cracks if near limit
        if (stressRatio > 0.8) {
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ballX, b.y - b.radius * 0.4);
          ctx.lineTo(ballX + 7, b.y - b.radius * 0.1);
          ctx.lineTo(ballX - 5, b.y + b.radius * 0.2);
          ctx.stroke();
        }

        // Balloon tie knot
        ctx.fillStyle = pColor;
        ctx.beginPath();
        ctx.moveTo(ballX - 6, b.y + b.radius * 1.08);
        ctx.lineTo(ballX + 6, b.y + b.radius * 1.08);
        ctx.lineTo(ballX, b.y + b.radius * 1.08 + 7);
        ctx.closePath();
        ctx.fill();

        // Balloon status pill
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(b.x - 50, stageY - 32, 100, 24, 12);
        else ctx.rect(b.x - 50, stageY - 32, 100, 24);
        ctx.fill();
        ctx.strokeStyle = b.multiplier >= 5 ? '#FBBF24' : pColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = b.multiplier >= 5 ? '#FBBF24' : '#FFFFFF';
        ctx.font = '800 11px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (b.isSealed) {
          ctx.fillText(`SEALED: ${b.score}`, b.x, stageY - 20);
        } else if (b.isPumping) {
          ctx.fillText(b.multiplier >= 5 ? `🔥 5X JACKPOT!` : `PUMPING (${b.multiplier}X)`, b.x, stageY - 20);
        } else {
          ctx.fillText(`HOLD TO PUMP`, b.x, stageY - 20);
        }
      } else {
        // Popped Confetti Starburst
        ctx.save();
        ctx.fillStyle = '#EF4444';
        ctx.font = '900 20px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💥 POPPED!', b.x, b.y);
        ctx.restore();
      }

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

    // 4. Interactive Bottom-Left Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
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
