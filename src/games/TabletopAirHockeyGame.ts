import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface HockeyMallet {
  id: PlayerId;
  name: string;
  color: string;
  colorLight: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  homeX: number;
  homeY: number;
  radius: number;
  score: number;
  pulseCooldown: number;
}

export class TabletopAirHockeyGame extends BaseGame {
  private mallets: HockeyMallet[] = [];
  private puckX: number = 400;
  private puckY: number = 300;
  private puckVx: number = 240;
  private puckVy: number = 220;
  private puckRadius: number = 15;
  private puckTrail: { x: number; y: number; alpha: number }[] = [];
  private lastTouchPlayerId: PlayerId | null = null;
  private winnerId: PlayerId | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  private isVerticalRink(width: number, height: number): boolean {
    return this.mallets.length <= 2 && (this.input.deviceMode === 'phone' || height > width);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 40.0;
    this.winnerId = null;
    this.lastTouchPlayerId = null;
    this.puckTrail = [];
    this.input.setControlMode('directional');

    const active = this.getActivePlayers();
    const vertical = active.length <= 2 && (this.input.deviceMode === 'phone' || height > width);
    this.mallets = active.map((p, idx) => {
      const pos = this.getGoalHomePos(idx, active.length, width, height, vertical);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        colorLight: p.colorLight,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        homeX: pos.x,
        homeY: pos.y,
        radius: 27,
        score: 0,
        pulseCooldown: 0
      };
    });

    this.resetPuck(width, height);
  }

  private getGoalHomePos(idx: number, count: number, width: number, height: number, vertical: boolean) {
    const topBound = 54;
    const bottomBound = height - 22;
    const midY = (topBound + bottomBound) / 2;

    if (count <= 2) {
      if (vertical) {
        // Phone 2P Face-to-Face: Player 1 (idx 0) defends Bottom Goal, Player 2 (idx 1) defends Top Goal!
        return idx === 0
          ? { x: width * 0.5, y: bottomBound - (bottomBound - topBound) * 0.18 }
          : { x: width * 0.5, y: topBound + (bottomBound - topBound) * 0.18 };
      }
      return idx === 0
        ? { x: width * 0.18, y: midY }
        : { x: width * 0.82, y: midY };
    }
    const corners = [
      { x: width * 0.22, y: topBound + (bottomBound - topBound) * 0.28 },
      { x: width * 0.78, y: topBound + (bottomBound - topBound) * 0.28 },
      { x: width * 0.22, y: topBound + (bottomBound - topBound) * 0.72 },
      { x: width * 0.78, y: topBound + (bottomBound - topBound) * 0.72 }
    ];
    return corners[idx] ?? corners[0];
  }

  private resetPuck(width: number, height: number): void {
    const topBound = 54;
    const bottomBound = height - 22;
    this.puckX = width / 2;
    this.puckY = (topBound + bottomBound) / 2;
    this.puckTrail = [];
    const vertical = this.isVerticalRink(width, height);
    const baseAngle = vertical
      ? (Math.random() < 0.5 ? Math.PI * 0.5 : -Math.PI * 0.5)
      : (Math.random() < 0.5 ? 0 : Math.PI);
    const angle = baseAngle + (Math.random() - 0.5) * Math.PI * 0.55;
    const speed = 320;
    this.puckVx = Math.cos(angle) * speed;
    this.puckVy = Math.sin(angle) * speed;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    this.updateBots(dt, width, height);

    const topBound = 54;
    const bottomBound = height - 22;
    const leftBound = 24;
    const rightBound = width - 24;
    const midX = width / 2;
    const midY = (topBound + bottomBound) / 2;
    const vertical = this.isVerticalRink(width, height);
    const goalHalfSpan = vertical
      ? Math.min(95, (rightBound - leftBound) * 0.30)
      : Math.min(88, (bottomBound - topBound) * 0.28);

    const rawTouches = this.input.getAllActiveTouches();

    // Update mallets
    for (let i = 0; i < this.mallets.length; i++) {
      const m = this.mallets[i];
      const home = this.getGoalHomePos(i, this.mallets.length, width, height, vertical);
      m.homeX = home.x;
      m.homeY = home.y;

      if (m.pulseCooldown > 0) m.pulseCooldown = Math.max(0, m.pulseCooldown - dt);

      const isBot = this.players.find((p) => p.id === m.id)?.type.startsWith('bot_') ?? false;
      const steer = this.input.getSteer(m.id);
      const throttle = -this.input.getThrottle(m.id);
      const tapped = this.input.justPressed(m.id) || this.input.justAction(m.id);

      // Compute allowed half-rink bounds for this mallet
      let minX = leftBound + m.radius;
      let maxX = rightBound - m.radius;
      let minY = topBound + m.radius;
      let maxY = bottomBound - m.radius;

      if (vertical) {
        if (i === 0) {
          // Player 1: Bottom Half
          minY = midY + m.radius;
          maxY = bottomBound - m.radius;
        } else {
          // Player 2: Top Half
          minY = topBound + m.radius;
          maxY = midY - m.radius;
        }
      } else {
        const isLeft = i % 2 === 0;
        minX = isLeft ? leftBound + m.radius : midX + m.radius;
        maxX = isLeft ? midX - m.radius : rightBound - m.radius;
      }

      // Check for direct 1:1 touch finger inside player's half (or assigned to m.id)
      let directTouch = !isBot
        ? rawTouches.find((t) => {
            if (vertical) {
              return i === 0 ? t.y >= midY - 20 : t.y < midY + 20;
            }
            return i % 2 === 0 ? t.x < midX : t.x >= midX;
          }) || rawTouches.find((t) => t.pid === m.id)
        : undefined;

      if (directTouch && !isBot) {
        // Direct 1:1 responsive mallet tracking toward finger position!
        const targetX = Math.max(minX, Math.min(maxX, directTouch.x));
        const targetY = Math.max(minY, Math.min(maxY, directTouch.y));
        const dx = targetX - m.x;
        const dy = targetY - m.y;
        const dist = Math.hypot(dx, dy);
        const maxTrackSpeed = 1450;
        if (dist > 1) {
          const step = Math.min(dist, maxTrackSpeed * dt);
          const nx = (dx / (dist || 0.001)) * step;
          const ny = (dy / (dist || 0.001)) * step;
          m.vx = nx / Math.max(0.001, dt);
          m.vy = ny / Math.max(0.001, dt);
          m.x += nx;
          m.y += ny;
        } else {
          m.vx *= 0.5;
          m.vy *= 0.5;
        }
      } else {
        // Analog joystick / keyboard / bot velocity control
        const speed = 520;
        m.vx = steer * speed;
        m.vy = throttle * speed;

        // Magnetic power-slap lunge towards puck on tap / action button!
        if (tapped && m.pulseCooldown <= 0) {
          m.pulseCooldown = 0.42;
          const dx = this.puckX - m.x;
          const dy = this.puckY - m.y;
          const d = Math.hypot(dx, dy) || 1;
          m.vx = (dx / (d || 0.001)) * 740;
          m.vy = (dy / (d || 0.001)) * 740;
          this.audio.playFlipper();
        }

        m.x += m.vx * dt;
        m.y += m.vy * dt;
      }

      m.x = Math.max(minX, Math.min(maxX, m.x));
      m.y = Math.max(minY, Math.min(maxY, m.y));
    }

    // Update Puck with sub-stepping for crisp high-speed collisions
    const subSteps = 2;
    const subDt = dt / subSteps;
    for (let s = 0; s < subSteps; s++) {
      this.puckX += this.puckVx * subDt;
      this.puckY += this.puckVy * subDt;

      if (vertical) {
        // Left / Right Side Wall Bounces
        if (this.puckX - this.puckRadius < leftBound) {
          this.puckX = leftBound + this.puckRadius;
          this.puckVx = Math.abs(this.puckVx);
          this.audio.playBounce();
        } else if (this.puckX + this.puckRadius > rightBound) {
          this.puckX = rightBound - this.puckRadius;
          this.puckVx = -Math.abs(this.puckVx);
          this.audio.playBounce();
        }

        // Top / Bottom Goal Crease Checks
        const inGoalCrease = Math.abs(this.puckX - midX) <= goalHalfSpan;
        if (this.puckY - this.puckRadius < topBound) {
          if (inGoalCrease) {
            this.awardGoal('bottom', width, height);
            break;
          } else {
            this.puckY = topBound + this.puckRadius;
            this.puckVy = Math.abs(this.puckVy);
            this.audio.playBounce();
          }
        } else if (this.puckY + this.puckRadius > bottomBound) {
          if (inGoalCrease) {
            this.awardGoal('top', width, height);
            break;
          } else {
            this.puckY = bottomBound - this.puckRadius;
            this.puckVy = -Math.abs(this.puckVy);
            this.audio.playBounce();
          }
        }
      } else {
        // Horizontal Rink: Top / Bottom Wall Bounces
        if (this.puckY - this.puckRadius < topBound) {
          this.puckY = topBound + this.puckRadius;
          this.puckVy = Math.abs(this.puckVy);
          this.audio.playBounce();
        } else if (this.puckY + this.puckRadius > bottomBound) {
          this.puckY = bottomBound - this.puckRadius;
          this.puckVy = -Math.abs(this.puckVy);
          this.audio.playBounce();
        }

        // Left / Right Goal Crease Checks
        const inGoalCrease = Math.abs(this.puckY - midY) <= goalHalfSpan;
        if (this.puckX - this.puckRadius < leftBound) {
          if (inGoalCrease) {
            this.awardGoal('right', width, height);
            break;
          } else {
            this.puckX = leftBound + this.puckRadius;
            this.puckVx = Math.abs(this.puckVx);
            this.audio.playBounce();
          }
        } else if (this.puckX + this.puckRadius > rightBound) {
          if (inGoalCrease) {
            this.awardGoal('left', width, height);
            break;
          } else {
            this.puckX = rightBound - this.puckRadius;
            this.puckVx = -Math.abs(this.puckVx);
            this.audio.playBounce();
          }
        }
      }

      // Mallet-Puck Collisions
      for (const m of this.mallets) {
        const dx = this.puckX - m.x;
        const dy = this.puckY - m.y;
        const dist = Math.hypot(dx, dy);
        const minDist = this.puckRadius + m.radius;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          this.puckX = m.x + nx * (minDist + 2);
          this.puckY = m.y + ny * (minDist + 2);

          const malletSpeed = Math.min(900, Math.hypot(m.vx, m.vy));
          const hitSpeed = Math.min(760, Math.max(390, Math.hypot(this.puckVx, this.puckVy) * 1.06 + malletSpeed * 0.48));
          this.puckVx = nx * hitSpeed;
          this.puckVy = ny * hitSpeed;
          this.lastTouchPlayerId = m.id;

          this.audio.playSpike();
          this.particles.spawnSparks(this.puckX, this.puckY, m.colorLight, 12);
        }
      }
    }

    // Puck trail update
    this.puckTrail.push({ x: this.puckX, y: this.puckY, alpha: 0.65 });
    if (this.puckTrail.length > 10) this.puckTrail.shift();
    for (const pt of this.puckTrail) {
      pt.alpha = Math.max(0, pt.alpha - dt * 3.2);
    }

    // Check 5-goal victory or timer
    for (const m of this.mallets) {
      if (m.score >= 5) {
        this.winnerId = m.id;
        this.isFinished = true;
        return;
      }
    }

    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      const sorted = [...this.mallets].sort((a, b) => b.score - a.score);
      if (sorted.length > 0 && (sorted.length === 1 || sorted[0].score > sorted[1].score)) {
        this.winnerId = sorted[0].id;
      }
      this.isFinished = true;
    }
  }

  private awardGoal(scoringSide: 'left' | 'right' | 'top' | 'bottom', width: number, height: number): void {
    let sideMallets: HockeyMallet[] = [];
    if (scoringSide === 'bottom') {
      sideMallets = [this.mallets[0]].filter(Boolean);
    } else if (scoringSide === 'top') {
      sideMallets = [this.mallets[1] || this.mallets[0]].filter(Boolean);
    } else {
      sideMallets = this.mallets.filter((_, idx) => (scoringSide === 'left' ? idx % 2 === 0 : idx % 2 === 1));
    }
    const scorer = sideMallets.find((m) => m.id === this.lastTouchPlayerId) || sideMallets[0] || this.mallets[0];

    if (scorer) {
      scorer.score += 1;
      this.audio.playPointScore(scorer.id);
      this.particles.spawnExplosion(this.puckX, this.puckY, scorer.color, 26);
      this.particles.shake(0.45);
      this.particles.showFloatingText(`🚨 GOAL! ${scorer.name.toUpperCase()} +1`, width / 2, height / 2, scorer.colorLight, 22);
    }
    this.resetPuck(width, height);
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const m = this.mallets.find((x) => x.id === botId);
    if (!m) return;

    const vertical = this.isVerticalRink(width, height);
    const midY = (54 + height - 22) / 2;
    const midX = width / 2;

    // If puck is in bot's half, attack it; otherwise guard home crease tracking puck laterally
    let targetX = this.puckX;
    let targetY = this.puckY;

    if (vertical) {
      const puckInBotHalf = this.puckY < midY + 25;
      if (!puckInBotHalf) {
        targetX = Math.max(width * 0.25, Math.min(width * 0.75, this.puckX));
        targetY = m.homeY;
      }
    } else {
      const puckInBotHalf = this.puckX > midX - 25;
      if (!puckInBotHalf) {
        targetX = m.homeX;
        targetY = Math.max(height * 0.25, Math.min(height * 0.80, this.puckY));
      }
    }

    const dx = targetX - m.x;
    const dy = targetY - m.y;
    const distToPuck = Math.hypot(this.puckX - m.x, this.puckY - m.y);

    const reactMult = difficulty === 'bot_hard' ? 1.0 : difficulty === 'bot_normal' ? 0.78 : 0.55;
    const steerX = Math.max(-1, Math.min(1, (dx / 75) * reactMult));
    const throttleY = Math.max(-1, Math.min(1, (-dy / 75) * reactMult));
    const slap = distToPuck < 76 && Math.random() < (difficulty === 'bot_hard' ? 0.38 : 0.16);

    this.input.setBotInput(botId, slap, steerX, throttleY, slap);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const topBound = 54;
    const bottomBound = height - 22;
    const leftBound = 24;
    const rightBound = width - 24;
    const tableW = rightBound - leftBound;
    const tableH = bottomBound - topBound;
    const midX = width / 2;
    const midY = (topBound + bottomBound) / 2;
    const vertical = this.isVerticalRink(width, height);
    const goalHalfSpan = vertical
      ? Math.min(95, tableW * 0.30)
      : Math.min(88, tableH * 0.28);

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    // Neon Air Hockey Rink Surface
    const rinkGrad = ctx.createRadialGradient(midX, midY, 20, midX, midY, Math.max(tableW, tableH) * 0.65);
    rinkGrad.addColorStop(0, '#0F172A');
    rinkGrad.addColorStop(1, '#090D16');
    ctx.fillStyle = rinkGrad;
    ctx.fillRect(leftBound, topBound, tableW, tableH);

    // Center Line & Faceoff Circle
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(leftBound, midY);
      ctx.lineTo(rightBound, midY);
    } else {
      ctx.moveTo(midX, topBound);
      ctx.lineTo(midX, bottomBound);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(midX, midY, 52, 0, Math.PI * 2);
    ctx.stroke();

    // Rink Outer Neon Rails
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 4;
    ctx.strokeRect(leftBound, topBound, tableW, tableH);

    // Glowing Goal Slots & Crease Arcs
    if (vertical) {
      // Top Goal (Player 2) & Bottom Goal (Player 1)
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(midX - goalHalfSpan, topBound - 5, goalHalfSpan * 2, 10);
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(midX - goalHalfSpan, bottomBound - 5, goalHalfSpan * 2, 10);
    } else {
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(leftBound - 6, midY - goalHalfSpan, 10, goalHalfSpan * 2);
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(rightBound - 4, midY - goalHalfSpan, 10, goalHalfSpan * 2);
    }

    // Render Puck Trail
    for (let i = 0; i < this.puckTrail.length; i++) {
      const pt = this.puckTrail[i];
      if (pt.alpha <= 0.02) continue;
      ctx.save();
      ctx.globalAlpha = pt.alpha * 0.45;
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, this.puckRadius * (0.4 + (i / this.puckTrail.length) * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Mallets
    for (const m of this.mallets) {
      ctx.save();
      ctx.shadowColor = m.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      ctx.fillStyle = m.color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = m.colorLight;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${m.score}`, m.x, m.y + 4);
      ctx.restore();
    }

    // Render Glowing Neon Puck
    ctx.save();
    ctx.shadowColor = '#FBBF24';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(this.puckX, this.puckY, this.puckRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#FDE047';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.mallets].sort((a, b) => b.score - a.score);
    const rankings = sorted.map((m, idx) => ({
      playerId: m.id,
      score: m.score,
      place: idx + 1
    }));
    const top = sorted[0];
    const isTie = sorted.length > 1 && sorted[0].score === sorted[1].score && this.winnerId === null;
    const winnerId = isTie ? null : (this.winnerId ?? top?.id ?? null);

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} ruled the Tabletop Rink!` : 'Air Hockey Overtime Draw!'
    };
  }
}
