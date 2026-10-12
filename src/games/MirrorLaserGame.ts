import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface PlayerMirrorCore {
  id: PlayerId;
  coreX: number;
  coreY: number;
  mirrorX: number;
  mirrorY: number;
  mirrorAngle: number; // 0, PI/4, PI/2, 3PI/4, etc.
  targetMirrorAngle: number;
  health: number; // 3 lives
  score: number;
  laserHits: number;
  damageFlash: number;
  invulnerableTimer: number;
  botReactionTimer: number;
}

interface SecondaryPrism {
  x: number;
  y: number;
  radius: number;
  angle: number;
  isSplitter: boolean;
}

interface LaserRaySegment {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
}

export class MirrorLaserGame extends BaseGame {
  private playerStates: Map<PlayerId, PlayerMirrorCore> = new Map();
  private prisms: SecondaryPrism[] = [];
  private laserSegments: LaserRaySegment[] = [];
  private laserPulseTimer: number = 0;
  private laserInterval: number = 2.4;
  private isLaserFiring: boolean = false;
  private laserFireDuration: number = 0.55;
  private currentMapName: string = 'Prism Chamber';

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.roundTimer = 55.0;
    this.isFinished = false;
    this.laserPulseTimer = 1.2;
    this.isLaserFiring = false;

    const mapNames = ['Prism Chamber', 'Crystal Reflector Hub', 'Quantum Matrix', 'Asteroid Core'];
    this.currentMapName = mapNames[Math.floor(Math.random() * mapNames.length)];

    this.playerStates.clear();
    const active = this.getActivePlayers();

    const cx = width / 2;
    const cy = height / 2 + 10;

    // Pedestal offsets
    const coreDist = Math.min(width * 0.4, height * 0.38);
    const mirrorDist = Math.min(width * 0.22, height * 0.22);

    const angles = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.75, Math.PI * 0.25];

    active.forEach((p, idx) => {
      const a = angles[idx % angles.length];
      const coreX = cx + Math.cos(a) * coreDist;
      const coreY = cy + Math.sin(a) * coreDist;
      const mirrorX = cx + Math.cos(a) * mirrorDist;
      const mirrorY = cy + Math.sin(a) * mirrorDist;

      // Default mirror angles: 45 degrees relative to cardinal axis
      const initAngle = a + Math.PI / 4;

      this.playerStates.set(p.id, {
        id: p.id,
        coreX,
        coreY,
        mirrorX,
        mirrorY,
        mirrorAngle: initAngle,
        targetMirrorAngle: initAngle,
        health: 3,
        score: 0,
        laserHits: 0,
        damageFlash: 0,
        invulnerableTimer: 0,
        botReactionTimer: 0.2 + Math.random() * 0.2
      });
    });

    this.generatePrisms(cx, cy);
  }

  private generatePrisms(cx: number, cy: number): void {
    this.prisms = [];
    if (this.currentMapName === 'Prism Chamber') {
      // 4 cardinal crystal satellites
      const dist = 110;
      this.prisms.push({ x: cx + dist, y: cy, radius: 14, angle: 0, isSplitter: true });
      this.prisms.push({ x: cx - dist, y: cy, radius: 14, angle: Math.PI, isSplitter: true });
      this.prisms.push({ x: cx, y: cy + dist, radius: 14, angle: Math.PI / 2, isSplitter: true });
      this.prisms.push({ x: cx, y: cy - dist, radius: 14, angle: -Math.PI / 2, isSplitter: true });
    } else if (this.currentMapName === 'Quantum Matrix') {
      // 2 center orbital splitters
      this.prisms.push({ x: cx - 70, y: cy - 40, radius: 16, angle: Math.PI / 4, isSplitter: false });
      this.prisms.push({ x: cx + 70, y: cy + 40, radius: 16, angle: -Math.PI / 4, isSplitter: false });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    // Smooth mirror rotation animation & invulnerability decay
    for (const ps of this.playerStates.values()) {
      ps.mirrorAngle += (ps.targetMirrorAngle - ps.mirrorAngle) * Math.min(1, dt * 16);
      if (ps.damageFlash > 0) {
        ps.damageFlash = Math.max(0, ps.damageFlash - dt * 2.5);
      }
      if (ps.invulnerableTimer > 0) {
        ps.invulnerableTimer = Math.max(0, ps.invulnerableTimer - dt);
      }
    }

    // Laser Pulse Cycle
    this.laserPulseTimer -= dt;
    if (!this.isLaserFiring) {
      if (this.laserPulseTimer <= 0) {
        this.isLaserFiring = true;
        this.laserPulseTimer = this.laserFireDuration;
        this.audio.playLaser();
        this.fireLaser(width, height);
      }
    } else {
      if (this.laserPulseTimer <= 0) {
        this.isLaserFiring = false;
        this.laserPulseTimer = this.laserInterval;
        this.laserSegments = [];
      } else {
        // Continuous trace while firing
        this.fireLaser(width, height);
      }
    }

    // Update bot AI
    this.updateBots(dt, width, height);

    // Human controls
    for (const p of this.getActivePlayers()) {
      const ps = this.playerStates.get(p.id);
      if (!ps || ps.health <= 0) continue;

      if (!p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(p.id) || this.input.justAction(p.id);
        const steer = this.input.getSteer(p.id);

        if (justPressed) {
          // Tap rotates mirror 45 degrees (PI/4)
          ps.targetMirrorAngle += Math.PI / 4;
          this.audio.playTap();
        } else if (Math.abs(steer) > 0.6) {
          ps.targetMirrorAngle += Math.sign(steer) * (Math.PI / 4);
          this.audio.playTap();
        }
      }
    }

    // Check last core standing
    const alive = Array.from(this.playerStates.values()).filter((p) => p.health > 0);
    if (alive.length <= 1 && this.getActivePlayers().length > 1) {
      if (alive.length === 1) alive[0].score += 150;
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private fireLaser(width: number, height: number): void {
    this.laserSegments = [];
    const cx = width / 2;
    const cy = height / 2 + 10;

    // Fire 4 beams from center core along cardinal or diagonal rays
    const baseAngles = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];

    for (const a of baseAngles) {
      this.traceRay(cx, cy, Math.cos(a), Math.sin(a), 0, null, width, height);
    }
  }

  private traceRay(
    startX: number,
    startY: number,
    dirX: number,
    dirY: number,
    bounces: number,
    lastReflectorId: PlayerId | null,
    width: number,
    height: number
  ): void {
    if (bounces > 6) return;

    let closestDist = 9999;
    let hitType: 'WALL' | 'MIRROR' | 'CORE' | 'PRISM' = 'WALL';
    let hitObject: unknown = null;
    let hitNormalX = 0;
    let hitNormalY = 0;

    // 1. Check Mirror Hits
    for (const ps of this.playerStates.values()) {
      if (ps.health <= 0) continue;
      const d = this.rayCircleIntersect(startX, startY, dirX, dirY, ps.mirrorX, ps.mirrorY, 18);
      if (d !== null && d > 4 && d < closestDist) {
        closestDist = d;
        hitType = 'MIRROR';
        hitObject = ps;
        // Mirror normal is perpendicular to mirrorAngle
        const normAngle = ps.mirrorAngle + Math.PI / 2;
        hitNormalX = Math.cos(normAngle);
        hitNormalY = Math.sin(normAngle);
      }
    }

    // 2. Check Core Hits
    for (const ps of this.playerStates.values()) {
      if (ps.health <= 0) continue;
      const d = this.rayCircleIntersect(startX, startY, dirX, dirY, ps.coreX, ps.coreY, 24);
      if (d !== null && d > 4 && d < closestDist) {
        closestDist = d;
        hitType = 'CORE';
        hitObject = ps;
      }
    }

    // 3. Check Prism Hits
    for (const pr of this.prisms) {
      const d = this.rayCircleIntersect(startX, startY, dirX, dirY, pr.x, pr.y, pr.radius);
      if (d !== null && d > 4 && d < closestDist) {
        closestDist = d;
        hitType = 'PRISM';
        hitObject = pr;
      }
    }

    // 4. Default Wall Boundary Hit
    if (closestDist === 9999) {
      let tX = 9999;
      let tY = 9999;
      if (dirX > 0) tX = (width - startX) / dirX;
      else if (dirX < 0) tX = (0 - startX) / dirX;

      if (dirY > 0) tY = (height - startY) / dirY;
      else if (dirY < 0) tY = (0 - startY) / dirY;

      closestDist = Math.min(tX, tY);
      hitType = 'WALL';
    }

    const endX = startX + dirX * closestDist;
    const endY = startY + dirY * closestDist;

    this.laserSegments.push({
      startX,
      startY,
      endX,
      endY,
      color: lastReflectorId !== null ? this.players.find((p) => p.id === lastReflectorId)?.color || '#38BDF8' : '#38BDF8'
    });

    if (hitType === 'MIRROR') {
      const ps = hitObject as PlayerMirrorCore;
      // Calculate reflection vector: R = V - 2*(V dot N)*N
      const dot = dirX * hitNormalX + dirY * hitNormalY;
      const refX = dirX - 2 * dot * hitNormalX;
      const refY = dirY - 2 * dot * hitNormalY;

      this.particles.emit(endX, endY, 6, '#F59E0B');

      this.traceRay(endX, endY, refX, refY, bounces + 1, ps.id, width, height);
    } else if (hitType === 'CORE') {
      const ps = hitObject as PlayerMirrorCore;
      if (ps.health > 0 && ps.invulnerableTimer <= 0) {
        ps.health--;
        ps.invulnerableTimer = 0.85;
        ps.damageFlash = 1.0;
        this.audio.playBounce();

        if (lastReflectorId !== null && lastReflectorId !== ps.id) {
          const shooter = this.playerStates.get(lastReflectorId);
          if (shooter) {
            shooter.score += 100;
            shooter.laserHits++;
          }
        }

        this.particles.emit(endX, endY, 12, '#EF4444');
      }
    } else if (hitType === 'PRISM') {
      const pr = hitObject as SecondaryPrism;
      if (pr.isSplitter) {
        // Split into 2 diagonal beams
        const a1 = Math.atan2(dirY, dirX) + Math.PI / 4;
        const a2 = Math.atan2(dirY, dirX) - Math.PI / 4;
        this.traceRay(endX, endY, Math.cos(a1), Math.sin(a1), bounces + 1, lastReflectorId, width, height);
        this.traceRay(endX, endY, Math.cos(a2), Math.sin(a2), bounces + 1, lastReflectorId, width, height);
      }
    }
  }

  private rayCircleIntersect(
    rx: number,
    ry: number,
    dx: number,
    dy: number,
    cx: number,
    cy: number,
    radius: number
  ): number | null {
    const fx = rx - cx;
    const fy = ry - cy;
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - radius * radius;

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;

    const sqrtDisc = Math.sqrt(discriminant);
    const t1 = (-b - sqrtDisc) / (2 * a);
    const t2 = (-b + sqrtDisc) / (2 * a);

    if (t1 > 0) return t1;
    if (t2 > 0) return t2;
    return null;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playerStates.get(botId);
    if (!ps || ps.health <= 0) return;

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    const baseDelay =
      difficulty === 'bot_easy' ? 0.65 : difficulty === 'bot_normal' ? 0.32 : 0.12;
    ps.botReactionTimer = baseDelay;

    if (difficulty === 'bot_easy' && Math.random() < 0.45) {
      ps.targetMirrorAngle += Math.PI / 4;
      return;
    }

    const cx = width / 2;
    const cy = height / 2 + 10;
    const inDx = ps.mirrorX - cx;
    const inDy = ps.mirrorY - cy;
    const inLen = Math.hypot(inDx, inDy) || 1;
    const inX = inDx / inLen;
    const inY = inDy / inLen;

    const candidateAngles: number[] = [];
    for (let k = 0; k < 8; k++) {
      candidateAngles.push((k * Math.PI) / 4);
    }

    let bestAngle = ps.targetMirrorAngle;
    let bestScore = -9999;

    for (const testAngle of candidateAngles) {
      const normAngle = testAngle + Math.PI / 2;
      const nx = Math.cos(normAngle);
      const ny = Math.sin(normAngle);

      const dot = inX * nx + inY * ny;
      const rx = inX - 2 * dot * nx;
      const ry = inY - 2 * dot * ny;

      // Penalize reflecting toward self
      const ownDx = ps.coreX - ps.mirrorX;
      const ownDy = ps.coreY - ps.mirrorY;
      const ownLen = Math.hypot(ownDx, ownDy) || 1;
      const ownDot = rx * (ownDx / ownLen) + ry * (ownDy / ownLen);

      let score = -ownDot * 200;

      // Reward reflecting toward opponents
      for (const opp of this.playerStates.values()) {
        if (opp.id === botId || opp.health <= 0) continue;
        const oppDx = opp.coreX - ps.mirrorX;
        const oppDy = opp.coreY - ps.mirrorY;
        const oppLen = Math.hypot(oppDx, oppDy) || 1;
        const oppDot = rx * (oppDx / oppLen) + ry * (oppDy / oppLen);
        if (oppDot > 0.6) score += oppDot * 150;
      }

      if (score > bestScore) {
        bestScore = score;
        bestAngle = testAngle;
      }
    }

    ps.targetMirrorAngle = bestAngle;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Dark Laboratory Floor
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2 + 10;

    // 2. Central Emitter Core
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Pulsing central crystal
    const pulseScale = 1 + (this.isLaserFiring ? 0.3 : (1 - this.laserPulseTimer / this.laserInterval) * 0.2);
    ctx.fillStyle = this.isLaserFiring ? '#38BDF8' : '#0284C7';
    ctx.beginPath();
    ctx.arc(cx, cy, 16 * pulseScale, 0, Math.PI * 2);
    ctx.fill();

    // 3. Secondary Prisms
    for (const pr of this.prisms) {
      ctx.fillStyle = '#64748B';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Splitter icon
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Laser Beams
    if (this.laserSegments.length > 0) {
      ctx.save();
      for (const seg of this.laserSegments) {
        // Outer glow
        ctx.strokeStyle = seg.color;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(seg.startX, seg.startY);
        ctx.lineTo(seg.endX, seg.endY);
        ctx.stroke();

        // Inner beam
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(seg.startX, seg.startY);
        ctx.lineTo(seg.endX, seg.endY);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 5. Player Pedestals & Mirrors
    for (const p of this.getActivePlayers()) {
      const ps = this.playerStates.get(p.id);
      if (!ps) continue;

      // Base Core
      ctx.save();
      ctx.translate(ps.coreX, ps.coreY);

      ctx.fillStyle = ps.health <= 0 ? '#334155' : ps.damageFlash > 0 ? '#EF4444' : p.colorDark;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ps.health <= 0 ? '#64748B' : p.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Core Shield Rings (Lives)
      if (ps.health > 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${ps.health} HP`, 0, 0);
      } else {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✖', 0, 0);
      }
      ctx.restore();

      // Mirror Pedestal & Rotatable Reflector
      if (ps.health > 0) {
        ctx.save();
        ctx.translate(ps.mirrorX, ps.mirrorY);

        // Pedestal base
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Angled Mirror Blade
        ctx.rotate(ps.mirrorAngle);
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(-18, -3, 36, 6);
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-18, -3, 36, 6);

        ctx.restore();
      }
    }

    // 6. Header & Timer
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`CHAMBER: ${this.currentMapName.toUpperCase()} • MIRROR LASER REFLEX`, width / 2, 28);

    const timerSec = Math.ceil(this.roundTimer);
    ctx.fillStyle = this.roundTimer < 10 ? '#EF4444' : '#F8FAFC';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${timerSec}s`, width / 2, 52);

    // 7. Corner HUDs
    for (const p of this.getActivePlayers()) {
      const ps = this.playerStates.get(p.id);
      if (!ps) continue;

      let px = 20;
      let py = 20;
      if (p.corner === 'top-right') px = width - 160;
      else if (p.corner === 'bottom-left') py = height - 90;
      else if (p.corner === 'bottom-right') {
        px = width - 160;
        py = height - 90;
      }

      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeStyle = ps.health > 0 ? p.color : '#64748B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, py, 140, 70, 8);
      else ctx.rect(px, py, 140, 70);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = ps.health > 0 ? p.color : '#94A3B8';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, px + 10, py + 20);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`${ps.score} pts`, px + 10, py + 42);

      ctx.fillStyle = ps.health > 0 ? '#10B981' : '#EF4444';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(ps.health > 0 ? `Shields: ${ps.health}/3` : 'CORE DESTROYED', px + 10, py + 60);
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const sorted = [...active].sort((a, b) => {
      const sa = this.playerStates.get(a.id);
      const sb = this.playerStates.get(b.id);
      if (!sa || !sb) return 0;
      if (sa.health !== sb.health) {
        return sb.health - sa.health;
      }
      return sb.score - sa.score;
    });

    const winnerId = sorted.length > 0 ? sorted[0].id : null;
    const topHits = this.playerStates.get(winnerId ?? 0)?.laserHits || 0;

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      score: this.playerStates.get(p.id)?.score || 0,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: `Optical mastermind! Deflected laser beams with ${topHits} direct core strikes!`
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }
}
