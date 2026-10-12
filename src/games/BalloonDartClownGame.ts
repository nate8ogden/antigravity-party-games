import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Balloon {
  angle: number;
  dist: number;
  radius: number;
  color: string;
  points: number;
  popped: boolean;
  respawnTimer: number;
}

interface Dart {
  playerId: PlayerId;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  alive: boolean;
}

interface DartPlayer {
  id: PlayerId;
  aimX: number;
  aimDir: number;
  dartsLeft: number;
  reloadTimer: number;
  score: number;
}

export class BalloonDartClownGame extends BaseGame {
  private wheelAngle: number = 0;
  private wheelSpeed: number = 1.2;
  private balloons: Balloon[] = [];
  private darts: Dart[] = [];
  private playersState: Map<PlayerId, DartPlayer> = new Map();
  private wheelCenterX: number = 0;
  private wheelCenterY: number = 0;
  private wheelRadius: number = 130;
  private clownHornHonkTimer: number = 0;

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
    this.wheelAngle = 0;
    this.wheelSpeed = 1.3;
    this.wheelCenterX = width / 2;
    this.wheelCenterY = height * 0.38;
    this.wheelRadius = Math.min(150, width * 0.25);
    this.darts = [];
    this.balloons = [];
    this.playersState.clear();
    this.clownHornHonkTimer = 0;

    // Populate balloons in concentric circles on wheel
    const balloonColors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
    const spokes = 12;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      const isGold = i % 4 === 0;
      this.balloons.push({
        angle: a,
        dist: this.wheelRadius * 0.8,
        radius: 16,
        color: isGold ? '#FBBF24' : balloonColors[i % balloonColors.length],
        points: isGold ? 30 : 10,
        popped: false,
        respawnTimer: 0
      });
      // Inner ring
      if (i % 2 === 0) {
        this.balloons.push({
          angle: a + 0.25,
          dist: this.wheelRadius * 0.48,
          radius: 14,
          color: '#06B6D4',
          points: 20,
          popped: false,
          respawnTimer: 0
        });
      }
    }

    const active = this.getActivePlayers();
    const count = active.length;
    active.forEach((p, idx) => {
      const zoneW = width / count;
      this.playersState.set(p.id, {
        id: p.id,
        aimX: zoneW * idx + zoneW / 2,
        aimDir: idx % 2 === 0 ? 1 : -1,
        dartsLeft: 3,
        reloadTimer: 0,
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Spin carnival wheel
    this.wheelAngle += this.wheelSpeed * dt;
    if (this.clownHornHonkTimer > 0) this.clownHornHonkTimer -= dt;

    // Respawn balloons
    for (const b of this.balloons) {
      if (b.popped) {
        b.respawnTimer -= dt;
        if (b.respawnTimer <= 0) {
          b.popped = false;
        }
      }
    }

    const active = this.getActivePlayers();
    const count = active.length;
    const zoneW = width / count;

    for (let idx = 0; idx < count; idx++) {
      const p = active[idx];
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.reloadTimer > 0) {
        ps.reloadTimer -= dt;
        if (ps.reloadTimer <= 0) {
          ps.dartsLeft = 3;
        }
      }

      // Sweep crosshair aim
      const minX = zoneW * idx + 30;
      const maxX = zoneW * (idx + 1) - 30;
      ps.aimX += ps.aimDir * dt * 180;
      if (ps.aimX > maxX) {
        ps.aimX = maxX;
        ps.aimDir = -1;
      } else if (ps.aimX < minX) {
        ps.aimX = minX;
        ps.aimDir = 1;
      }

      // Fire Dart
      const justFired = this.input.justPressed(p.id) || this.input.justAction(p.id);
      if (justFired && ps.dartsLeft > 0 && ps.reloadTimer <= 0) {
        ps.dartsLeft--;
        this.fireDart(p.id, p.color, ps.aimX, height - 50);
        if (ps.dartsLeft <= 0) {
          ps.reloadTimer = 0.75; // quiver restock delay
        }
      }
    }

    // Update flying darts
    for (let i = this.darts.length - 1; i >= 0; i--) {
      const d = this.darts[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;

      // Check collision with balloons
      let hit = false;
      for (const b of this.balloons) {
        if (b.popped) continue;
        const bx = this.wheelCenterX + Math.cos(this.wheelAngle + b.angle) * b.dist;
        const by = this.wheelCenterY + Math.sin(this.wheelAngle + b.angle) * b.dist;
        if (Math.hypot(d.x - bx, d.y - by) < b.radius + 8) {
          b.popped = true;
          b.respawnTimer = 2.5;
          hit = true;
          const ps = this.playersState.get(d.playerId);
          if (ps) ps.score += b.points;

          this.audio.playLaser();
          this.particles.showFloatingText(`+${b.points}`, bx, by - 15, b.color, 22);
          this.particles.spawnConfetti(bx, by, 16);
          break;
        }
      }

      // Check clown nose bullseye (center honk)
      if (!hit && Math.hypot(d.x - this.wheelCenterX, d.y - this.wheelCenterY) < 22) {
        hit = true;
        this.clownHornHonkTimer = 0.5;
        this.wheelSpeed = Math.min(3.5, this.wheelSpeed + 0.4);
        const ps = this.playersState.get(d.playerId);
        if (ps) ps.score += 50;
        this.audio.playBounce();
        this.particles.shake(0.3);
        this.particles.showFloatingText('HONK! +50', this.wheelCenterX, this.wheelCenterY - 30, '#EF4444', 26);
        this.particles.spawnExplosion(this.wheelCenterX, this.wheelCenterY, '#F43F5E', 20);
      }

      // Off-screen or hit
      if (hit || d.y < 30) {
        this.darts.splice(i, 1);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private fireDart(pid: PlayerId, color: string, startX: number, startY: number): void {
    // Ballistic dart upward trajectory towards wheel
    const targetY = this.wheelCenterY;
    const dy = targetY - startY;
    const dx = this.wheelCenterX + (startX - this.wheelCenterX) * 0.35 - startX;
    const speed = 720;
    const angle = Math.atan2(dy, dx);

    this.darts.push({
      playerId: pid,
      color,
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      alive: true
    });

    this.audio.playLaser();
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Festive Midway Carnival Booth
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, width);
    bgGrad.addColorStop(0, '#1E293B');
    bgGrad.addColorStop(1, '#0B0F19');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Festive bunting pennants
    ctx.save();
    const flagW = 24;
    for (let fx = 0; fx < width; fx += flagW) {
      ctx.fillStyle = fx % 48 === 0 ? '#EF4444' : '#EAB308';
      ctx.beginPath();
      ctx.moveTo(fx, 0);
      ctx.lineTo(fx + flagW, 0);
      ctx.lineTo(fx + flagW / 2, 22);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 2. Draw Giant Spinning Clown Wheel
    ctx.save();
    ctx.translate(this.wheelCenterX, this.wheelCenterY);

    // Wheel outer rim & wooden spokes
    ctx.fillStyle = '#1E1B4B';
    ctx.beginPath();
    ctx.arc(0, 0, this.wheelRadius + 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 8;
    ctx.stroke();

    // Spokes
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const a = this.wheelAngle + (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * this.wheelRadius, Math.sin(a) * this.wheelRadius);
      ctx.stroke();
    }

    // Draw Balloons
    for (const b of this.balloons) {
      if (b.popped) continue;
      const bx = Math.cos(this.wheelAngle + b.angle) * b.dist;
      const by = Math.sin(this.wheelAngle + b.angle) * b.dist;

      ctx.save();
      ctx.translate(bx, by);
      // Balloon body
      const bGrad = ctx.createRadialGradient(-4, -6, 2, 0, 0, b.radius);
      bGrad.addColorStop(0, '#FFFFFF');
      bGrad.addColorStop(0.3, b.color);
      bGrad.addColorStop(1, '#0F172A');
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, b.radius, b.radius * 1.25, 0, 0, Math.PI * 2);
      ctx.fill();

      // Balloon knot
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(-3, b.radius * 1.25);
      ctx.lineTo(3, b.radius * 1.25);
      ctx.lineTo(0, b.radius * 1.25 + 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Clown Face Center Hub
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#CA8A04';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Clown Big Red Nose (Target)
    const noseScale = this.clownHornHonkTimer > 0 ? 1.4 : 1.0;
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(0, 4, 14 * noseScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Clown smiling mouth
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 6, 22, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();

    // Clown Eyes
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(-11, -12, 4, 0, Math.PI * 2);
    ctx.arc(11, -12, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 3. Draw Flying Darts
    for (const d of this.darts) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.angle + Math.PI / 2);

      // Dart shaft & metallic needle
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(-2, -18, 4, 28);
      ctx.fillStyle = d.color;
      ctx.fillRect(-6, 2, 12, 10); // flight feathers
      ctx.restore();
    }

    // 4. Draw Player Aim Stations
    const active = this.getActivePlayers();
    const count = active.length;
    const zoneW = width / count;

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      if (!ps) return;
      const zoneCenterX = zoneW * idx + zoneW / 2;
      const stationY = height - 48;

      // Station counter
      ctx.fillStyle = '#334155';
      ctx.fillRect(zoneCenterX - zoneW * 0.44, stationY, zoneW * 0.88, 44);
      ctx.fillStyle = p.color;
      ctx.fillRect(zoneCenterX - zoneW * 0.44, stationY, zoneW * 0.88, 4);

      // Score & Darts Left
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      const status = ps.reloadTimer > 0 ? 'RELOADING...' : `DARTS: ${'🎯'.repeat(ps.dartsLeft)}`;
      ctx.fillText(`${p.name}: ${ps.score}`, zoneCenterX, stationY + 20);
      ctx.font = '700 10px monospace';
      ctx.fillStyle = ps.reloadTimer > 0 ? '#F59E0B' : '#94A3B8';
      ctx.fillText(status, zoneCenterX, stationY + 34);

      // Aim Reticle
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(ps.aimX, stationY - 25, 12, 0, Math.PI * 2);
      ctx.moveTo(ps.aimX - 18, stationY - 25);
      ctx.lineTo(ps.aimX + 18, stationY - 25);
      ctx.moveTo(ps.aimX, stationY - 43);
      ctx.lineTo(ps.aimX, stationY - 7);
      ctx.stroke();
      ctx.restore();
    });

    // 5. Header HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 45);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.dartsLeft <= 0 || ps.reloadTimer > 0) return;

    // Check if any balloon lines up with aimX
    const tolerance = difficulty === 'bot_hard' ? 14 : difficulty === 'bot_normal' ? 24 : 40;
    let shouldFire = false;

    for (const b of this.balloons) {
      if (b.popped) continue;
      const bx = this.wheelCenterX + Math.cos(this.wheelAngle + b.angle) * b.dist;
      if (Math.abs(ps.aimX - bx) < tolerance) {
        shouldFire = true;
        break;
      }
    }

    // Clown nose jackpot chance
    if (Math.abs(ps.aimX - this.wheelCenterX) < 18) {
      shouldFire = true;
    }

    if (shouldFire) {
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
      mvpHighlight: winnerId ? `${winnerId} popped the carnival clown wheel!` : 'No balloons popped!'
    };
  }
}
