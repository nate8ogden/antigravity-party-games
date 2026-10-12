import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Duck {
  x: number;
  y: number;
  angle: number;
  speed: number;
  radius: number;
  orbitRadius: number;
  isGolden: boolean;
  points: number;
  bobTimer: number;
  hookedBy: PlayerId | null;
}

interface RodPlayer {
  id: PlayerId;
  angle: number; // sweeping angle of fishing rod
  sweepDir: number;
  hookDist: number; // distance extended from station
  maxHookDist: number;
  hookState: 'AIMING' | 'DROPPING' | 'REELING';
  score: number;
}

export class DuckPondDerbyGame extends BaseGame {
  private ducks: Duck[] = [];
  private playersState: Map<PlayerId, RodPlayer> = new Map();
  private pondCenterX: number = 0;
  private pondCenterY: number = 0;
  private pondRadius: number = 140;

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
    this.roundTimer = 30;
    this.pondCenterX = width / 2;
    this.pondCenterY = height * 0.46;
    this.pondRadius = Math.min(160, width * 0.28);
    this.ducks = [];
    this.playersState.clear();

    // Populate concentric circulating rubber ducks
    const duckCount = 14;
    for (let i = 0; i < duckCount; i++) {
      const isInner = i % 2 === 0;
      const orbit = isInner ? this.pondRadius * 0.5 : this.pondRadius * 0.82;
      const isGolden = i === 3 || i === 9;
      this.ducks.push({
        x: 0,
        y: 0,
        angle: (i / duckCount) * Math.PI * 2,
        speed: isInner ? 1.4 : -0.9,
        radius: isGolden ? 16 : 14,
        orbitRadius: orbit,
        isGolden,
        points: isGolden ? 50 : (i % 3 === 0 ? 25 : 10),
        bobTimer: Math.random() * Math.PI,
        hookedBy: null
      });
    }

    const active = this.getActivePlayers();
    const count = active.length;
    active.forEach((p, idx) => {
      // 4 player corners or edge stations
      this.playersState.set(p.id, {
        id: p.id,
        angle: (idx / count) * Math.PI * 2 - Math.PI / 2,
        sweepDir: 1,
        hookDist: 20,
        maxHookDist: this.pondRadius * 1.05,
        hookState: 'AIMING',
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Update ducks swimming in circular pond current
    for (const d of this.ducks) {
      if (d.hookedBy === null) {
        d.angle += d.speed * dt;
        d.bobTimer += dt * 3;
        d.x = this.pondCenterX + Math.cos(d.angle) * d.orbitRadius;
        d.y = this.pondCenterY + Math.sin(d.angle) * d.orbitRadius + Math.sin(d.bobTimer) * 3;
      }
    }

    const active = this.getActivePlayers();
    const count = active.length;

    for (let idx = 0; idx < count; idx++) {
      const p = active[idx];
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      const stationBaseAngle = (idx / count) * Math.PI * 2 - Math.PI / 2;
      const stationX = this.pondCenterX + Math.cos(stationBaseAngle) * (this.pondRadius + 45);
      const stationY = this.pondCenterY + Math.sin(stationBaseAngle) * (this.pondRadius + 45);

      if (ps.hookState === 'AIMING') {
        // Sweep rod angle around inward cone
        ps.angle += ps.sweepDir * dt * 1.6;
        const inwardAngle = Math.atan2(this.pondCenterY - stationY, this.pondCenterX - stationX);
        const minAngle = inwardAngle - 0.75;
        const maxAngle = inwardAngle + 0.75;

        if (ps.angle > maxAngle) {
          ps.angle = maxAngle;
          ps.sweepDir = -1;
        } else if (ps.angle < minAngle) {
          ps.angle = minAngle;
          ps.sweepDir = 1;
        }

        // Tap to launch magnetic hook
        const tap = this.input.justPressed(p.id) || this.input.justAction(p.id);
        if (tap) {
          ps.hookState = 'DROPPING';
          this.audio.playLaser();
        }
      } else if (ps.hookState === 'DROPPING') {
        ps.hookDist += dt * 320;
        const hookX = stationX + Math.cos(ps.angle) * ps.hookDist;
        const hookY = stationY + Math.sin(ps.angle) * ps.hookDist;

        // Check duck snag
        for (const d of this.ducks) {
          if (d.hookedBy === null && Math.hypot(hookX - d.x, hookY - d.y) < d.radius + 10) {
            d.hookedBy = p.id;
            ps.hookState = 'REELING';
            this.audio.playChime();
            this.particles.spawnConfetti(d.x, d.y, 10);
            break;
          }
        }

        // Max distance reached -> reel back
        if (ps.hookDist >= ps.maxHookDist) {
          ps.hookState = 'REELING';
          this.audio.playBounce();
        }
      } else if (ps.hookState === 'REELING') {
        ps.hookDist = Math.max(20, ps.hookDist - dt * 260);

        // Keep hooked duck attached to hook
        const hookX = stationX + Math.cos(ps.angle) * ps.hookDist;
        const hookY = stationY + Math.sin(ps.angle) * ps.hookDist;
        for (const d of this.ducks) {
          if (d.hookedBy === p.id) {
            d.x = hookX;
            d.y = hookY;
          }
        }

        if (ps.hookDist <= 20) {
          // Reeled in completely
          for (const d of this.ducks) {
            if (d.hookedBy === p.id) {
              ps.score += d.points;
              this.audio.playScore();
              this.particles.showFloatingText(`+${d.points}!`, stationX, stationY - 20, d.isGolden ? '#F59E0B' : '#38BDF8', 22);
              // Respawn duck in pond
              d.hookedBy = null;
              d.angle += Math.PI;
              d.x = this.pondCenterX + Math.cos(d.angle) * d.orbitRadius;
              d.y = this.pondCenterY + Math.sin(d.angle) * d.orbitRadius;
            }
          }
          ps.hookState = 'AIMING';
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Fairground Wooden Deck Floor
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // 2. Circular Carnival Duck Pond
    ctx.save();
    ctx.translate(this.pondCenterX, this.pondCenterY);

    // Pond outer wooden tub rim
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.arc(0, 0, this.pondRadius + 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Swirling blue water with radial depth gradient
    const waterGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, this.pondRadius);
    waterGrad.addColorStop(0, '#38BDF8');
    waterGrad.addColorStop(0.7, '#0284C7');
    waterGrad.addColorStop(1, '#0369A1');
    ctx.fillStyle = waterGrad;
    ctx.beginPath();
    ctx.arc(0, 0, this.pondRadius, 0, Math.PI * 2);
    ctx.fill();

    // Water swirling whirlpool ripples
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    for (let r = 35; r < this.pondRadius; r += 32) {
      ctx.beginPath();
      ctx.arc(0, 0, r, performance.now() * 0.001, performance.now() * 0.001 + Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.restore();

    // 3. Draw Rubber Ducks
    for (const d of this.ducks) {
      ctx.save();
      ctx.translate(d.x, d.y);

      // Water ripple beneath duck
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 4, d.radius + 4, (d.radius + 4) * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Duck Body
      ctx.fillStyle = d.isGolden ? '#FBBF24' : '#FDE047';
      ctx.beginPath();
      ctx.ellipse(0, 2, d.radius, d.radius * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();

      // Duck Head
      const headX = Math.sign(d.speed) * (d.radius * 0.55);
      ctx.beginPath();
      ctx.arc(headX, -6, d.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // Duck Orange Beak
      ctx.fillStyle = '#EA580C';
      ctx.beginPath();
      const beakDir = Math.sign(d.speed) || 1;
      ctx.moveTo(headX + beakDir * 6, -8);
      ctx.lineTo(headX + beakDir * 14, -5);
      ctx.lineTo(headX + beakDir * 6, -2);
      ctx.closePath();
      ctx.fill();

      // Duck Eye
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(headX + beakDir * 2, -7, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Golden Star Badge
      if (d.isGolden) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', 0, 4);
      }
      ctx.restore();
    }

    // 4. Draw Fishing Rod Stations, Lines, and Magnetic Hooks
    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      if (!ps) return;

      const stationBaseAngle = (idx / count) * Math.PI * 2 - Math.PI / 2;
      const stationX = this.pondCenterX + Math.cos(stationBaseAngle) * (this.pondRadius + 45);
      const stationY = this.pondCenterY + Math.sin(stationBaseAngle) * (this.pondRadius + 45);

      // Station Platform
      ctx.save();
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(stationX, stationY, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Player Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${ps.score}`, stationX, stationY + 4);

      // Fishing Rod
      const rodTipX = stationX + Math.cos(ps.angle) * 36;
      const rodTipY = stationY + Math.sin(ps.angle) * 36;
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(stationX, stationY);
      ctx.lineTo(rodTipX, rodTipY);
      ctx.stroke();

      // Fishing Line
      const hookX = stationX + Math.cos(ps.angle) * ps.hookDist;
      const hookY = stationY + Math.sin(ps.angle) * ps.hookDist;
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rodTipX, rodTipY);
      ctx.lineTo(hookX, hookY);
      ctx.stroke();

      // Magnetic Red/Silver Horseshoe Hook
      ctx.save();
      ctx.translate(hookX, hookY);
      ctx.rotate(ps.angle + Math.PI / 2);
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(0, 0, 7, Math.PI, 0);
      ctx.lineTo(7, 8);
      ctx.lineTo(4, 8);
      ctx.lineTo(4, 0);
      ctx.arc(0, 0, 4, 0, Math.PI, true);
      ctx.lineTo(-4, 8);
      ctx.lineTo(-7, 8);
      ctx.closePath();
      ctx.fill();

      // Silver magnetic tips
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(-7, 5, 3, 3);
      ctx.fillRect(4, 5, 3, 3);
      ctx.restore();

      ctx.restore();
    });

    // 5. Header HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 35);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.hookState !== 'AIMING') return;

    const active = this.getActivePlayers();
    const count = active.length;
    const idx = active.findIndex((p) => p.id === botId);
    const stationBaseAngle = (idx / count) * Math.PI * 2 - Math.PI / 2;
    const stationX = this.pondCenterX + Math.cos(stationBaseAngle) * (this.pondRadius + 45);
    const stationY = this.pondCenterY + Math.sin(stationBaseAngle) * (this.pondRadius + 45);

    // Look for golden duck first
    let target = this.ducks.find((d) => d.isGolden && d.hookedBy === null) || this.ducks.find((d) => d.hookedBy === null);
    if (!target) return;

    const idealAngle = Math.atan2(target.y - stationY, target.x - stationX);
    const angleDiff = Math.abs(ps.angle - idealAngle);

    const tolerance = difficulty === 'bot_hard' ? 0.09 : difficulty === 'bot_normal' ? 0.18 : 0.35;

    if (angleDiff < tolerance) {
      this.input.setBotInput(botId, true, 0, 0, true);
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public getScore(playerId: PlayerId): number {
    return this.playersState.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} reeled in the golden derby ducks!` : 'No ducks reeled in!'
    };
  }
}
