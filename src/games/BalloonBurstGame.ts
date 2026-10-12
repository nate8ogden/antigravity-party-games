import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';

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
  wobbleOffset: number;
  botTargetRatio: number;
}

export class BalloonBurstGame extends BaseGame {
  private balloons: Map<PlayerId, PlayerBalloon> = new Map();
  private allDoneTimer: number = 0;

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 45;
    this.isFinished = false;
    this.balloons.clear();
    this.allDoneTimer = 0;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    // Each round has a shared secret burst threshold around 80-98px
    const baseLimit = 78 + Math.random() * 20;

    active.forEach((p, idx) => {
      this.balloons.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height / 2 + 20,
        radius: 18,
        burstLimit: baseLimit + (Math.random() - 0.5) * 6,
        isPumping: false,
        isSealed: false,
        isPopped: false,
        score: 0,
        wobbleOffset: Math.random() * 10,
        botTargetRatio: 0.82
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    let allDone = true;

    for (const b of this.balloons.values()) {
      if (b.isSealed || b.isPopped) continue;

      allDone = false;
      const isPressed = this.input.isPressed(b.id);
      const justReleased = this.input.justReleased(b.id);

      if (isPressed) {
        b.isPumping = true;
        b.radius += dt * 32; // Inflate!
        b.wobbleOffset += dt * 15;

        // Check if exceeded burst limit
        if (b.radius >= b.burstLimit) {
          b.isPopped = true;
          b.isPumping = false;
          b.score = 0;
          this.audio.playExplosion();
          this.particles.addTrauma(0.2);
          this.particles.spawnExplosion(b.x, b.y, this.players[b.id].color, 35);
          this.particles.showFloatingText('POP! BURST!', b.x, b.y - 20, '#EF4444', 24);
        }
      } else if (justReleased && b.isPumping) {
        // Sealed! Lock in final score
        b.isSealed = true;
        b.isPumping = false;
        b.score = Math.round(b.radius * 10);
        this.audio.playTap();
        this.particles.spawnSparks(b.x, b.y, '#10B981', 12);
        this.particles.showFloatingText(`SEALED! [${b.score} PTS]`, b.x, b.y - b.radius - 20, '#10B981', 20);
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

    // Initialize consistent target ratio for this balloon if at base ratio
    if (b.botTargetRatio === 0.82 && b.radius <= 20) {
      if (difficulty === 'bot_hard') {
        b.botTargetRatio = 0.92 + Math.random() * 0.04; // 92% - 96%
      } else if (difficulty === 'bot_normal') {
        b.botTargetRatio = 0.80 + Math.random() * 0.08; // 80% - 88%
      } else {
        // Easy: 25% chance of greedy overpump (1.04 = pops!), else stops early (65% - 76%)
        b.botTargetRatio = Math.random() < 0.25 ? 1.04 : 0.65 + Math.random() * 0.11;
      }
    }

    const targetRadius = b.burstLimit * b.botTargetRatio;

    if (b.radius < targetRadius) {
      // Hold pump
      this.input.setBotInput(botId, true, 0, 0, false);
    } else {
      // Release to seal!
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

    // 1. Carnival Fairground Night Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#0F172A');
    skyGrad.addColorStop(0.6, '#1E1B4B');
    skyGrad.addColorStop(1, '#020617');
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

    // Colorful Pennant Flags hanging along curve
    const flagColors = ['#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#8B5CF6', '#EC4899'];
    const flagCount = 14;
    for (let i = 0; i < flagCount; i++) {
      const t = (i + 0.5) / flagCount;
      const fx = t * width;
      // Quadratic curve formula: (1-t)^2 * y0 + 2(1-t)t * y1 + t^2 * y2
      const fy = Math.pow(1 - t, 2) * buntingY + 2 * (1 - t) * t * (buntingY + 24) + Math.pow(t, 2) * buntingY;
      const flagW = 18;
      const flagH = 22;

      ctx.fillStyle = flagColors[i % flagColors.length];
      ctx.beginPath();
      ctx.moveTo(fx - flagW / 2, fy);
      ctx.lineTo(fx + flagW / 2, fy);
      ctx.lineTo(fx, fy + flagH);
      ctx.closePath();
      ctx.fill();

      // Glowing light bulb at each flag peg
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(fx, fy - 1, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Wooden Carnival Stage Boardwalk at the Bottom
    const stageY = height - 76;
    ctx.fillStyle = '#451A03';
    ctx.fillRect(0, stageY, width, height - stageY);
    ctx.fillStyle = '#78350F';
    ctx.fillRect(0, stageY, width, 6); // Edge rim
    // Plank dividers
    ctx.strokeStyle = '#270F04';
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
      ctx.roundRect(b.x - 14, pumpBaseY - 24, 28, 28, 4);
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
      ctx.roundRect(b.x - 16, pumpBaseY - 40 + handleOffset, 32, 6, 3);
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
      // Needle
      const stress = b.radius / b.burstLimit;
      const needleAngle = -Math.PI * 0.75 + stress * Math.PI * 1.5;
      ctx.strokeStyle = stress > 0.8 ? '#EF4444' : '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x - 12, pumpBaseY - 14);
      ctx.lineTo(b.x - 12 + Math.cos(needleAngle) * 5, pumpBaseY - 14 + Math.sin(needleAngle) * 5);
      ctx.stroke();

      // Balloon Rendering
      if (!b.isPopped) {
        const stressRatio = b.radius / b.burstLimit;
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

        ctx.shadowColor = pColor;
        ctx.shadowBlur = stressRatio > 0.82 ? 22 : 8;
        ctx.beginPath();
        // Slightly teardrop / oval balloon shape
        ctx.ellipse(ballX, b.y, b.radius, b.radius * 1.08, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Glossy Specular Highlight Crescent
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.beginPath();
        ctx.ellipse(ballX - b.radius * 0.35, b.y - b.radius * 0.38, b.radius * 0.22, b.radius * 0.12, -0.6, 0, Math.PI * 2);
        ctx.fill();

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

        // Balloon status pill (positioned safely above pump or balloon)
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.beginPath();
        ctx.roundRect(b.x - 50, stageY - 32, 100, 24, 12);
        ctx.fill();
        ctx.strokeStyle = pColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 11px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (b.isSealed) {
          ctx.fillText(`SEALED: ${b.score}`, b.x, stageY - 20);
        } else if (b.isPumping) {
          ctx.fillText(`PUMPING!`, b.x, stageY - 20);
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
      ctx.roundRect(b.x - 45, height - 22, 90, 18, 9);
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

    ctx.restore();
  }
}
