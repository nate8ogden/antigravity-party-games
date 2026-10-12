import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface EnergyReceiver {
  playerId: PlayerId;
  x: number;
  y: number;
  radius: number;
  charge: number; // 0 to 100
}

interface SatelliteUnit {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mirrorAngle: number;
  score: number;
}

export class SatelliteLaserGame extends BaseGame {
  private satellites: Map<PlayerId, SatelliteUnit> = new Map();
  private receivers: Map<PlayerId, EnergyReceiver> = new Map();
  private emitter = { x: 0, y: 0, angle: 0, angularSpeed: 0.8 };
  private laserSegments: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.satellites.clear();
    this.receivers.clear();
    this.laserSegments = [];

    this.emitter = {
      x: width * 0.5,
      y: height * 0.5,
      angle: 0,
      angularSpeed: 0.75
    };

    const active = this.getActivePlayers();
    const cornerPositions = [
      { satX: width * 0.28, satY: height * 0.32, recX: 60, recY: 60 },
      { satX: width * 0.72, satY: height * 0.32, recX: width - 60, recY: 60 },
      { satX: width * 0.28, satY: height * 0.68, recX: 60, recY: height - 60 },
      { satX: width * 0.72, satY: height * 0.68, recX: width - 60, recY: height - 60 }
    ];

    active.forEach((p, idx) => {
      const pos = cornerPositions[idx % cornerPositions.length];
      this.satellites.set(p.id, {
        id: p.id,
        x: pos.satX,
        y: pos.satY,
        vx: 0,
        vy: 0,
        mirrorAngle: (idx * Math.PI) / 2 + Math.PI * 0.25,
        score: 0
      });

      this.receivers.set(p.id, {
        playerId: p.id,
        x: pos.recX,
        y: pos.recY,
        radius: 28,
        charge: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    this.updateBots(dt, width, height);

    // Rotate central emitter
    this.emitter.angle += this.emitter.angularSpeed * dt;

    // Update satellites
    for (const [id, sat] of this.satellites.entries()) {
      const moveX = this.input.getSteer(id);
      const moveY = -this.input.getThrottle(id);
      const isAction = this.input.isActionPressed(id) || this.input.isPressed(id);

      if (isAction) {
        sat.mirrorAngle += 3.2 * dt;
      }

      sat.vx += moveX * 380 * dt;
      sat.vy += moveY * 380 * dt;

      sat.vx *= Math.pow(0.92, dt * 60);
      sat.vy *= Math.pow(0.92, dt * 60);

      sat.x += sat.vx * dt;
      sat.y += sat.vy * dt;

      sat.x = Math.max(80, Math.min(width - 80, sat.x));
      sat.y = Math.max(80, Math.min(height - 80, sat.y));
    }

    // Cast Laser Ray & Reflections
    this.laserSegments = [];
    let rayX = this.emitter.x;
    let rayY = this.emitter.y;
    let rayAngle = this.emitter.angle;
    let rayColor = '#FFEB3B';

    for (let bounce = 0; bounce < 3; bounce++) {
      let maxLen = 600;

      let closestHitDist = maxLen;
      let hitSat: SatelliteUnit | null = null;
      let hitNormal = 0;

      for (const sat of this.satellites.values()) {
        const d = this.checkRayCircleIntersect(rayX, rayY, rayAngle, sat.x, sat.y, 22);
        if (d > 5 && d < closestHitDist) {
          closestHitDist = d;
          hitSat = sat;
          hitNormal = sat.mirrorAngle + Math.PI / 2;
        }
      }

      let hitReceiver: EnergyReceiver | null = null;
      for (const rec of this.receivers.values()) {
        const d = this.checkRayCircleIntersect(rayX, rayY, rayAngle, rec.x, rec.y, rec.radius);
        if (d > 5 && d < closestHitDist) {
          closestHitDist = d;
          hitSat = null;
          hitReceiver = rec;
        }
      }

      const endX = rayX + Math.cos(rayAngle) * closestHitDist;
      const endY = rayY + Math.sin(rayAngle) * closestHitDist;

      this.laserSegments.push({
        x1: rayX,
        y1: rayY,
        x2: endX,
        y2: endY,
        color: rayColor
      });

      if (hitReceiver) {
        hitReceiver.charge = Math.min(100, hitReceiver.charge + 35 * dt);
        const satOwner = this.satellites.get(hitReceiver.playerId);
        if (satOwner) {
          satOwner.score += Math.round(25 * dt);
        }

        this.particles.emit(endX, endY, 2, '#00E5FF');
        break;
      }

      if (hitSat) {
        rayX = endX;
        rayY = endY;
        const inAngle = rayAngle;
        rayAngle = 2 * hitNormal - inAngle - Math.PI;
        rayColor = this.getPlayer(hitSat.id)?.color || '#EF4444';
      } else {
        break;
      }
    }
  }

  private checkRayCircleIntersect(rx: number, ry: number, rAngle: number, cx: number, cy: number, radius: number): number {
    const dx = Math.cos(rAngle);
    const dy = Math.sin(rAngle);
    const fx = rx - cx;
    const fy = ry - cy;

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - radius * radius;

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return 99999;

    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    return t > 0 ? t : 99999;
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: string, _width: number, _height: number): void {
    const timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const sat = this.satellites.get(botId);
    const rec = this.receivers.get(botId);
    if (!sat || !rec) return;

    const angleFromEmitter = Math.atan2(sat.y - this.emitter.y, sat.x - this.emitter.x);
    const angleToReceiver = Math.atan2(rec.y - sat.y, rec.x - sat.x);

    const desiredNormal = (angleFromEmitter + angleToReceiver) / 2;
    const desiredMirrorAngle = desiredNormal - Math.PI / 2;

    let wantRotate = false;
    let angleDiff = desiredMirrorAngle - sat.mirrorAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    if (Math.abs(angleDiff) > 0.15) {
      wantRotate = true;
    }

    const idealX = (this.emitter.x + rec.x) * 0.5;
    const idealY = (this.emitter.y + rec.y) * 0.5;
    const dx = idealX - sat.x;
    const dy = idealY - sat.y;
    let moveX = 0;
    let moveY = 0;
    if (Math.hypot(dx, dy) > 20) {
      moveX = dx > 0 ? 1 : -1;
      moveY = dy > 0 ? 1 : -1;
    }

    let delay = 0.25;
    if (difficulty === 'bot_easy') {
      delay = 0.45;
      if (Math.random() < 0.25) wantRotate = false;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
    }

    this.input.setBotInput(botId, wantRotate, moveX, -moveY, wantRotate);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#05070E';
    ctx.fillRect(0, 0, width, height);

    for (const seg of this.laserSegments) {
      ctx.strokeStyle = seg.color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();

      ctx.globalAlpha = 1.0;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();
    }

    // Central Sun Laser Emitter
    ctx.save();
    ctx.translate(this.emitter.x, this.emitter.y);
    ctx.fillStyle = '#FF9800';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(this.emitter.angle);
    ctx.fillStyle = '#FFD54F';
    ctx.fillRect(0, -4, 26, 8);
    ctx.restore();

    // Render Corner Energy Receivers
    for (const [id, rec] of this.receivers.entries()) {
      ctx.save();
      ctx.translate(rec.x, rec.y);

      const color = this.getPlayer(id)?.color || '#EF4444';
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, rec.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.2 + (rec.charge / 100) * 0.6;
      ctx.beginPath();
      ctx.arc(0, 0, (rec.charge / 100) * rec.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(rec.charge)}%`, 0, 4);

      ctx.restore();
    }

    // Render Satellites
    for (const [id, sat] of this.satellites.entries()) {
      ctx.save();
      ctx.translate(sat.x, sat.y);

      const color = this.getPlayer(id)?.color || '#EF4444';

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0288D1';
      ctx.fillRect(-22, -4, 10, 8);
      ctx.fillRect(12, -4, 10, 8);

      ctx.rotate(sat.mirrorAngle);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(18, 0);
      ctx.stroke();

      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${sat.score}`, sat.x, sat.y - 18);
    }
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.satellites.entries()).map(([playerId, sat]) => ({
      playerId,
      score: sat.score
    }));
    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `Player ${winnerId + 1} beamed solar energy to victory with ${scores[0].score} pts!` : 'Laser relays cycled!'
    };
  }
}
