import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface VectorShell {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bounces: number;
  ownerId: PlayerId;
}

interface VectorObstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface VectorPlayer {
  id: PlayerId;
  x: number;
  y: number;
  angle: number;
  score: number;
  cooldown: number;
  stunTimer: number;
}

export class VectorTankBattleGame extends BaseGame {
  private playersState: Map<PlayerId, VectorPlayer> = new Map();
  private shells: VectorShell[] = [];
  private obstacles: VectorObstacle[] = [];
  private radarAngle: number = 0;

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
    this.playersState.clear();
    this.shells = [];
    this.obstacles = [];
    this.radarAngle = 0;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: idx % 2 === 0 ? 90 : height - 80,
        angle: idx % 2 === 0 ? Math.PI / 2 : -Math.PI / 2,
        score: 0,
        cooldown: 0,
        stunTimer: 0
      });
    });

    // Wireframe pyramid/box obstacles
    const midX = width / 2;
    const midY = height / 2;
    this.obstacles.push(
      { x: midX - 120, y: midY - 30, w: 50, h: 50 },
      { x: midX + 70, y: midY - 30, w: 50, h: 50 },
      { x: midX - 25, y: midY - 80, w: 50, h: 40 },
      { x: midX - 25, y: midY + 40, w: 50, h: 40 }
    );
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);
    this.radarAngle = (this.radarAngle + dt * 4) % (Math.PI * 2);

    // Update Shells
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Bounce off screen boundaries
      if (s.x < 15 || s.x > width - 15) {
        s.vx *= -1;
        s.bounces++;
        this.audio.playBounce();
      }
      if (s.y < 45 || s.y > height - 15) {
        s.vy *= -1;
        s.bounces++;
        this.audio.playBounce();
      }

      // Bounce off obstacles
      for (const ob of this.obstacles) {
        if (s.x >= ob.x && s.x <= ob.x + ob.w && s.y >= ob.y && s.y <= ob.y + ob.h) {
          s.vx *= -1;
          s.vy *= -1;
          s.bounces++;
          this.audio.playBounce();
          break;
        }
      }

      if (s.bounces > 2) {
        this.shells.splice(i, 1);
        continue;
      }

      // Hit opponent tank
      for (const p of this.getActivePlayers()) {
        const ps = this.playersState.get(p.id);
        if (!ps || ps.stunTimer > 0) continue;

        if (Math.hypot(s.x - ps.x, s.y - ps.y) < 18) {
          // If not self, or self on bounce
          if (s.ownerId !== p.id || s.bounces > 0) {
            ps.stunTimer = 1.3;
            const shooter = this.playersState.get(s.ownerId);
            if (shooter && s.ownerId !== p.id) {
              shooter.score += 1;
            }
            this.audio.playExplosion();
            this.particles.shake(0.35);
            this.particles.emit(ps.x, ps.y, 16, '#22c55e');
            this.shells.splice(i, 1);
            break;
          }
        }
      }
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        continue;
      }

      if (ps.cooldown > 0) {
        ps.cooldown -= dt;
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isPressed = this.input.isPressed(p.id);

      if (Math.abs(steer) > 0.1) {
        ps.angle += steer * 2.8 * dt;
      }

      if (Math.abs(throttle) > 0.1) {
        const forward = -throttle;
        ps.x += Math.cos(ps.angle) * forward * 110 * dt;
        ps.y += Math.sin(ps.angle) * forward * 110 * dt;
      }

      // Keep within arena
      ps.x = Math.max(30, Math.min(width - 30, ps.x));
      ps.y = Math.max(60, Math.min(height - 30, ps.y));

      // Shoot wireframe shell
      if (isPressed && ps.cooldown <= 0) {
        ps.cooldown = 0.55;
        this.shells.push({
          x: ps.x + Math.cos(ps.angle) * 18,
          y: ps.y + Math.sin(ps.angle) * 18,
          vx: Math.cos(ps.angle) * 260,
          vy: Math.sin(ps.angle) * 260,
          bounces: 0,
          ownerId: p.id
        });
        this.audio.playLaser();
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.stunTimer > 0) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false, 0, 0);
      return;
    }

    // Find nearest opponent
    let nearestOpp: VectorPlayer | null = null;
    let minDist = Infinity;
    for (const [id, opp] of this.playersState) {
      if (id !== botId && opp.stunTimer <= 0) {
        const d = Math.hypot(opp.x - ps.x, opp.y - ps.y);
        if (d < minDist) {
          minDist = d;
          nearestOpp = opp;
        }
      }
    }

    if (nearestOpp) {
      let targetX = nearestOpp.x;
      let targetY = nearestOpp.y;
      if (difficulty === 'bot_hard') {
        // Hard predicts lead
        targetX += Math.cos(nearestOpp.angle) * 20;
        targetY += Math.sin(nearestOpp.angle) * 20;
      }

      let targetAngle = Math.atan2(targetY - ps.y, targetX - ps.x);
      if (difficulty === 'bot_easy') {
        targetAngle += (Math.random() - 0.5) * 0.45;
      } else if (difficulty === 'bot_normal') {
        targetAngle += (Math.random() - 0.5) * 0.18;
      }

      let diff = targetAngle - ps.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      const steer = Math.sign(diff);
      const aimTolerance = difficulty === 'bot_easy' ? 0.35 : difficulty === 'bot_normal' ? 0.22 : 0.12;
      const isAimed = Math.abs(diff) < aimTolerance;
      const throttlePower = difficulty === 'bot_easy' ? -0.5 : difficulty === 'bot_normal' ? -0.8 : -1.0;
      const throttle = minDist > 110 ? throttlePower : 0;

      this.input.setBotInput(botId, isAimed, steer, throttle);
    } else {
      this.input.setBotInput(botId, false, 0, 0);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1980 Vector CRT Screen (Pure Black with Phosphor Glow)
    ctx.fillStyle = '#020b05';
    ctx.fillRect(0, 0, width, height);

    // Vector Arena Border
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 45, width - 20, height - 55);

    // Vector Obstacles (Wireframe Octagons & Rectangles)
    for (const ob of this.obstacles) {
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ob.x, ob.y, ob.w, ob.h);
      // X inner cross
      ctx.beginPath();
      ctx.moveTo(ob.x, ob.y);
      ctx.lineTo(ob.x + ob.w, ob.y + ob.h);
      ctx.moveTo(ob.x + ob.w, ob.y);
      ctx.lineTo(ob.x, ob.y + ob.h);
      ctx.stroke();
    }

    // Render Vector Shells
    for (const s of this.shells) {
      ctx.fillStyle = '#86efac';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Vector trail line
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.05, s.y - s.vy * 0.05);
      ctx.stroke();
    }

    // Render Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);
      ctx.rotate(ps.angle);

      // Wireframe Battlezone Tank
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;

      // Tank Body Rectangle
      ctx.strokeRect(-12, -10, 24, 20);

      // Left & Right Treads
      ctx.strokeRect(-14, -14, 28, 4);
      ctx.strokeRect(-14, 10, 28, 4);

      // Turret Barrel
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(16, 0);
      ctx.stroke();

      // Stun
      if (ps.stunTimer > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('*HIT*', 0, -18);
      }

      ctx.restore();

      // Score
      ctx.fillStyle = '#86efac';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y + 24);
    }

    // Top Right Radar Sweep
    const radarX = width - 40;
    const radarY = 22;
    const radarR = 16;
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(radarX, radarY, radarR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(radarX, radarY);
    ctx.lineTo(radarX + Math.cos(this.radarAngle) * radarR, radarY + Math.sin(this.radarAngle) * radarR);
    ctx.stroke();

    // Top HUD
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('VECTOR TANK BATTLE // 1980', 16, 26);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.roundTimer < 6 ? '#ef4444' : '#86efac';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width - 70, 26);
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
      mvpHighlight: winnerId ? `${winnerId} scored the most wireframe vector tank hits!` : 'Wireframe vector grid cleared!'
    };
  }
}
