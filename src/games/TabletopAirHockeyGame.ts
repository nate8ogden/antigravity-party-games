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
  private puckVx: number = 220;
  private puckVy: number = 180;
  private puckRadius: number = 15;
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

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 35.0;
    this.winnerId = null;
    this.lastTouchPlayerId = null;
    this.input.setControlMode('directional');

    const active = this.getActivePlayers();
    this.mallets = active.map((p, idx) => {
      const pos = this.getGoalHomePos(idx, active.length, width, height);
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
        radius: 26,
        score: 0,
        pulseCooldown: 0
      };
    });

    this.resetPuck(width, height);
  }

  private getGoalHomePos(idx: number, count: number, width: number, height: number) {
    if (count <= 2) {
      return idx === 0
        ? { x: width * 0.18, y: height * 0.54 }
        : { x: width * 0.82, y: height * 0.54 };
    }
    const corners = [
      { x: width * 0.22, y: height * 0.32 },
      { x: width * 0.78, y: height * 0.32 },
      { x: width * 0.22, y: height * 0.76 },
      { x: width * 0.78, y: height * 0.76 }
    ];
    return corners[idx] ?? corners[0];
  }

  private resetPuck(width: number, height: number): void {
    this.puckX = width / 2;
    this.puckY = height * 0.54;
    const angle = (Math.random() - 0.5) * Math.PI * 0.6 + (Math.random() < 0.5 ? 0 : Math.PI);
    const speed = 290;
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
    const goalHalfH = Math.min(85, (bottomBound - topBound) * 0.28);
    const goalCenterY = (topBound + bottomBound) / 2;

    // Update mallets
    for (let i = 0; i < this.mallets.length; i++) {
      const m = this.mallets[i];
      const home = this.getGoalHomePos(i, this.mallets.length, width, height);
      m.homeX = home.x;
      m.homeY = home.y;

      if (m.pulseCooldown > 0) m.pulseCooldown = Math.max(0, m.pulseCooldown - dt);

      const steer = this.input.getSteer(m.id);
      const throttle = -this.input.getThrottle(m.id);
      const tapped = this.input.justPressed(m.id) || this.input.justAction(m.id);

      const speed = 440;
      m.vx = steer * speed;
      m.vy = throttle * speed;

      // Magnetic power-slap towards puck on tap!
      if (tapped && m.pulseCooldown <= 0) {
        m.pulseCooldown = 0.45;
        const dx = this.puckX - m.x;
        const dy = this.puckY - m.y;
        const d = Math.hypot(dx, dy) || 1;
        m.vx = (dx / d) * 650;
        m.vy = (dy / d) * 650;
        this.audio.playFlipper();
      }

      m.x += m.vx * dt;
      m.y += m.vy * dt;

      // Keep mallet on its side of the table in 2P mode
      const isLeft = i % 2 === 0;
      const minX = isLeft ? leftBound + m.radius : width / 2 + m.radius;
      const maxX = isLeft ? width / 2 - m.radius : rightBound - m.radius;
      m.x = Math.max(minX, Math.min(maxX, m.x));
      m.y = Math.max(topBound + m.radius, Math.min(bottomBound - m.radius, m.y));
    }

    // Update Puck
    this.puckX += this.puckVx * dt;
    this.puckY += this.puckVy * dt;

    // Top/Bottom Wall Bounces
    if (this.puckY - this.puckRadius < topBound) {
      this.puckY = topBound + this.puckRadius;
      this.puckVy = Math.abs(this.puckVy);
      this.audio.playBounce();
    } else if (this.puckY + this.puckRadius > bottomBound) {
      this.puckY = bottomBound - this.puckRadius;
      this.puckVy = -Math.abs(this.puckVy);
      this.audio.playBounce();
    }

    // Check Left / Right Goals
    const inGoalCrease = Math.abs(this.puckY - goalCenterY) <= goalHalfH;
    if (this.puckX - this.puckRadius < leftBound) {
      if (inGoalCrease) {
        this.awardGoal('right', width, height);
      } else {
        this.puckX = leftBound + this.puckRadius;
        this.puckVx = Math.abs(this.puckVx);
        this.audio.playBounce();
      }
    } else if (this.puckX + this.puckRadius > rightBound) {
      if (inGoalCrease) {
        this.awardGoal('left', width, height);
      } else {
        this.puckX = rightBound - this.puckRadius;
        this.puckVx = -Math.abs(this.puckVx);
        this.audio.playBounce();
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

        const hitSpeed = Math.min(680, Math.max(360, Math.hypot(this.puckVx, this.puckVy) * 1.08 + Math.hypot(m.vx, m.vy) * 0.45));
        this.puckVx = nx * hitSpeed;
        this.puckVy = ny * hitSpeed;
        this.lastTouchPlayerId = m.id;

        this.audio.playSpike();
        this.particles.spawnSparks(this.puckX, this.puckY, m.colorLight, 12);
      }
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

  private awardGoal(scoringSide: 'left' | 'right', width: number, height: number): void {
    // Award point to players on the scoring side (or last toucher on that side)
    const sideMallets = this.mallets.filter((_, idx) => (scoringSide === 'left' ? idx % 2 === 0 : idx % 2 === 1));
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
    _width: number,
    _height: number
  ): void {
    const m = this.mallets.find((x) => x.id === botId);
    if (!m) return;

    const targetY = this.puckY;
    const dy = targetY - m.y;
    const dx = this.puckX - m.x;
    const dist = Math.hypot(dx, dy);

    const reactMult = difficulty === 'bot_hard' ? 1.0 : difficulty === 'bot_normal' ? 0.75 : 0.5;
    const steerX = Math.max(-1, Math.min(1, (dx / 90) * reactMult));
    const throttleY = Math.max(-1, Math.min(1, (-dy / 70) * reactMult));
    const slap = dist < 72 && Math.random() < (difficulty === 'bot_hard' ? 0.35 : 0.15);

    this.input.setBotInput(botId, slap, steerX, throttleY, slap);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const topBound = 54;
    const bottomBound = height - 22;
    const leftBound = 24;
    const rightBound = width - 24;
    const tableW = rightBound - leftBound;
    const tableH = bottomBound - topBound;
    const goalHalfH = Math.min(85, tableH * 0.28);
    const goalCenterY = (topBound + bottomBound) / 2;

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    // Neon Air Hockey Rink Surface
    const rinkGrad = ctx.createRadialGradient(width / 2, goalCenterY, 20, width / 2, goalCenterY, tableW * 0.65);
    rinkGrad.addColorStop(0, '#0F172A');
    rinkGrad.addColorStop(1, '#090D16');
    ctx.fillStyle = rinkGrad;
    ctx.fillRect(leftBound, topBound, tableW, tableH);

    // Center Line & Faceoff Circle
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(width / 2, topBound);
    ctx.lineTo(width / 2, bottomBound);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(width / 2, goalCenterY, 54, 0, Math.PI * 2);
    ctx.stroke();

    // Rink Outer Neon Rails
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 4;
    ctx.strokeRect(leftBound, topBound, tableW, tableH);

    // Left & Right Glowing Goal Slots
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(leftBound - 6, goalCenterY - goalHalfH, 10, goalHalfH * 2);
    ctx.fillStyle = '#3B82F6';
    ctx.fillRect(rightBound - 4, goalCenterY - goalHalfH, 10, goalHalfH * 2);

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

      // Inner handle knob
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = m.colorLight;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
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
