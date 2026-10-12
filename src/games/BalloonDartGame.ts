import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Balloon {
  angle: number; // angle on wheel (rad)
  dist: number;  // radius on wheel (px)
  color: string;
  isGold: boolean;
  popped: boolean;
}

interface FlyingDart {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  progress: number;
  playerId: PlayerId;
}

interface DartPlayerState {
  aimAngle: number;
  aimDist: number;
  aimDir: number;
  score: number;
  cooldown: number;
}

export class BalloonDartGame extends BaseGame {
  private balloons: Balloon[] = [];
  private flyingDarts: FlyingDart[] = [];
  private playerStates: Map<PlayerId, DartPlayerState> = new Map();
  private wheelAngle: number = 0;
  private wheelSpeed: number = 0.8;
  private speedSurgeTimer: number = 2.0;
  private readonly WHEEL_RADIUS = 160;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.balloons = [];
    this.flyingDarts = [];
    this.playerStates.clear();
    this.wheelAngle = 0;
    this.wheelSpeed = 0.8;
    this.speedSurgeTimer = 2.0;
    this.roundTimer = 25.0;
    this.isFinished = false;

    // Populate balloons on the wheel
    const rings = [60, 110, 150];
    const balloonColors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#EC4899'];

    rings.forEach((r, ringIdx) => {
      const count = ringIdx === 0 ? 6 : ringIdx === 1 ? 10 : 14;
      for (let i = 0; i < count; i++) {
        const isGold = (ringIdx === 1 && i % 3 === 0);
        this.balloons.push({
          angle: (i / count) * Math.PI * 2,
          dist: r,
          color: isGold ? '#FACC15' : balloonColors[(i + ringIdx) % balloonColors.length],
          isGold,
          popped: false
        });
      }
    });

    for (const p of this.getActivePlayers()) {
      this.playerStates.set(p.id, {
        aimAngle: Math.random() * Math.PI * 2,
        aimDist: 100,
        aimDir: 1,
        score: 0,
        cooldown: 0
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    // Dynamic Random Wheel Rotation & Speed Surges
    this.speedSurgeTimer -= dt;
    if (this.speedSurgeTimer <= 0) {
      // 25% chance of reversing direction, and variable spin speed
      const isReverse = Math.random() < 0.28;
      this.wheelSpeed = (isReverse ? -1 : 1) * (0.6 + Math.random() * 1.3);
      this.speedSurgeTimer = 2.5 + Math.random() * 3.0;
    }
    this.wheelAngle += dt * this.wheelSpeed;
    this.updateBots(dt, width, height);

    const wheelCenter = { x: width / 2, y: height * 0.42 };

    // Update Player Crosshairs & Throw
    for (const p of this.getActivePlayers()) {
      const state = this.playerStates.get(p.id);
      if (!state) continue;

      state.aimAngle += dt * 1.8 * state.aimDir;
      state.aimDist = 70 + Math.sin(state.aimAngle * 2) * 60;

      if (state.cooldown > 0) state.cooldown -= dt;

      if (this.input.justPressed(p.id) && state.cooldown <= 0) {
        state.cooldown = 0.35;
        this.audio.playWhoosh();

        const targetX = wheelCenter.x + Math.cos(state.aimAngle) * state.aimDist;
        const targetY = wheelCenter.y + Math.sin(state.aimAngle) * state.aimDist;

        this.flyingDarts.push({
          x: targetX,
          y: height - 20,
          targetX,
          targetY,
          progress: 0,
          playerId: p.id
        });
      }
    }

    // Update Flying Darts
    for (let i = this.flyingDarts.length - 1; i >= 0; i--) {
      const d = this.flyingDarts[i];
      d.progress += dt * 3.5;

      d.y = (height - 20) + (d.targetY - (height - 20)) * d.progress;

      if (d.progress >= 1) {
        // Hit detection on wheel balloons
        let poppedCount = 0;
        for (const b of this.balloons) {
          if (b.popped) continue;

          // Compute absolute position on wheel
          const currentAngle = b.angle + this.wheelAngle;
          const bx = wheelCenter.x + Math.cos(currentAngle) * b.dist;
          const by = wheelCenter.y + Math.sin(currentAngle) * b.dist;

          const dist = Math.hypot(d.targetX - bx, d.targetY - by);
          if (dist < 22) {
            b.popped = true;
            poppedCount++;
            const pts = b.isGold ? 75 : 25;
            const pState = this.playerStates.get(d.playerId);
            if (pState) pState.score += pts;

            this.audio.playTone(b.isGold ? 880 : 520, 0.1, 'triangle');
            this.particles.emit(bx, by, b.isGold ? 20 : 12, b.color);
            break;
          }
        }

        if (poppedCount === 0) {
          this.audio.playTone(220, 0.05, 'sine'); // Thud into cork board
        }

        this.flyingDarts.splice(i, 1);
      }
    }

    // Respawn balloons if mostly popped
    const unpopped = this.balloons.filter(b => !b.popped).length;
    if (unpopped <= 3) {
      this.balloons.forEach(b => { b.popped = false; });
      this.audio.playTone(660, 0.15, 'square');
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const state = this.playerStates.get(botId);
    if (!state || state.cooldown > 0) {
      this.input.setBotInput(botId, false);
      return;
    }

    const wheelCenter = { x: width / 2, y: height * 0.42 };
    const curX = wheelCenter.x + Math.cos(state.aimAngle) * state.aimDist;
    const curY = wheelCenter.y + Math.sin(state.aimAngle) * state.aimDist;

    // Find nearest balloon to reticle
    let nearestDist = Infinity;
    for (const b of this.balloons) {
      if (b.popped) continue;
      const bAngle = b.angle + this.wheelAngle;
      const bx = wheelCenter.x + Math.cos(bAngle) * b.dist;
      const by = wheelCenter.y + Math.sin(bAngle) * b.dist;
      const dist = Math.hypot(curX - bx, curY - by);
      if (dist < nearestDist) {
        nearestDist = dist;
      }
    }

    const thresh = difficulty === 'bot_hard' ? 22 : difficulty === 'bot_normal' ? 35 : 55;
    if (nearestDist <= thresh) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Dark carnival tent backdrop
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);

    const wheelCenter = { x: width / 2, y: height * 0.42 };

    // Wooden Cork Wheel
    ctx.save();
    ctx.translate(wheelCenter.x, wheelCenter.y);

    // Wheel shadow & outer rim
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.arc(0, 0, this.WHEEL_RADIUS + 12, 0, Math.PI * 2);
    ctx.fill();

    // Cork surface
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.arc(0, 0, this.WHEEL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Wheel concentric rings
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, Math.PI * 2);
    ctx.arc(0, 0, 110, 0, Math.PI * 2);
    ctx.arc(0, 0, 150, 0, Math.PI * 2);
    ctx.stroke();

    // Center bullseye pin
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    // Draw Balloons on wheel
    for (const b of this.balloons) {
      if (b.popped) continue;

      const angle = b.angle + this.wheelAngle;
      const bx = Math.cos(angle) * b.dist;
      const by = Math.sin(angle) * b.dist;

      ctx.save();
      ctx.translate(bx, by);

      // Balloon body
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 16, angle, 0, Math.PI * 2);
      ctx.fill();

      // Balloon knot
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(0, 16, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Specular shine
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(-3, -5, 3, 6, angle, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();

    // Flying Darts
    for (const d of this.flyingDarts) {
      ctx.save();
      ctx.translate(d.targetX, d.y);
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(-4, 10);
      ctx.lineTo(4, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Player Aim Crosshairs
    for (const p of this.getActivePlayers()) {
      const state = this.playerStates.get(p.id);
      if (!state) continue;

      const cx = wheelCenter.x + Math.cos(state.aimAngle) * state.aimDist;
      const cy = wheelCenter.y + Math.sin(state.aimAngle) * state.aimDist;

      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.moveTo(cx - 18, cy);
      ctx.lineTo(cx + 18, cy);
      ctx.moveTo(cx, cy - 18);
      ctx.lineTo(cx, cy + 18);
      ctx.stroke();
      ctx.restore();
    }

    // Player Score Bar at Bottom
    const active = this.getActivePlayers();
    const count = active.length;
    active.forEach((p, idx) => {
      const state = this.playerStates.get(p.id);
      if (!state) return;

      const px = (width / (count + 1)) * (idx + 1);
      const py = height - 35;

      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.roundRect(px - 45, py - 15, 90, 30, 6);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${state.score} PTS`, px, py + 5);
    });

    // Top Header
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`BALLOON DART • TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.playerStates.get(p.id)?.score || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} popped a carnival high score!` : 'The dartboard settled!'
    };
  }
}
