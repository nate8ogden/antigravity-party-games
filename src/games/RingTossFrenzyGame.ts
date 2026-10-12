import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Bottle {
  x: number;
  y: number;
  radius: number;
  points: number;
  color: string;
  wobble: number;
  ringRingCount: number;
}

interface Ring {
  playerId: PlayerId;
  color: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  startX: number;
  startY: number;
  flightTimer: number;
  totalFlightTime: number;
  radius: number;
  landed: boolean;
}

interface PlayerBooth {
  id: PlayerId;
  angle: number; // aim angle in radians
  aimDir: number;
  charging: boolean;
  power: number; // 0 to 1
  cooldown: number;
  score: number;
  ringsThrown: number;
}

export class RingTossFrenzyGame extends BaseGame {
  private bottles: Bottle[] = [];
  private rings: Ring[] = [];
  private booths: Map<PlayerId, PlayerBooth> = new Map();

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
    this.rings = [];
    this.bottles = [];
    this.booths.clear();

    // Create center cluster of carnival glass bottles
    const centerX = width / 2;
    const centerY = height * 0.45;
    const rows = 4;
    const cols = 5;
    const spacingX = 42;
    const spacingY = 36;
    const startX = centerX - ((cols - 1) * spacingX) / 2;
    const startY = centerY - ((rows - 1) * spacingY) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isGolden = (r === 1 || r === 2) && c === 2;
        const isSilver = (r === 0 || r === 3) && (c === 1 || c === 3);
        const pts = isGolden ? 50 : isSilver ? 25 : 10;
        const color = isGolden ? '#F59E0B' : isSilver ? '#38BDF8' : '#EC4899';
        this.bottles.push({
          x: startX + c * spacingX + (r % 2 === 1 ? 10 : -10),
          y: startY + r * spacingY,
          radius: 14,
          points: pts,
          color,
          wobble: 0,
          ringRingCount: 0
        });
      }
    }

    const active = this.getActivePlayers();
    const count = active.length;
    active.forEach((p, idx) => {
      const slotX = (width / (count + 1)) * (idx + 1);
      this.booths.set(p.id, {
        id: p.id,
        angle: -Math.PI / 2,
        aimDir: 1,
        charging: false,
        power: 0.2,
        cooldown: 0,
        score: 0,
        ringsThrown: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();
    const count = active.length;

    for (let idx = 0; idx < count; idx++) {
      const p = active[idx];
      const booth = this.booths.get(p.id);
      if (!booth) continue;

      if (booth.cooldown > 0) booth.cooldown -= dt;

      // Oscillate aim angle
      booth.angle += booth.aimDir * dt * 1.8;
      const minAngle = -Math.PI * 0.78;
      const maxAngle = -Math.PI * 0.22;
      if (booth.angle > maxAngle) {
        booth.angle = maxAngle;
        booth.aimDir = -1;
      } else if (booth.angle < minAngle) {
        booth.angle = minAngle;
        booth.aimDir = 1;
      }

      // Check inputs
      const isDown = this.input.isPressed(p.id);
      const justReleased = this.input.justReleased(p.id);

      if (isDown && booth.cooldown <= 0) {
        booth.charging = true;
        booth.power = Math.min(1.0, booth.power + dt * 1.5);
      } else if (booth.charging && (justReleased || !isDown)) {
        // Throw ring
        this.throwRing(p.id, p.color, idx, count, width, height, booth);
        booth.charging = false;
        booth.power = 0.15;
        booth.cooldown = 0.45; // Anti-spam delay
      }
    }

    // Update airborne rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.flightTimer += dt;
      const progress = Math.min(1.0, ring.flightTimer / ring.totalFlightTime);

      // Parabolic flight
      const currentX = ring.startX + (ring.targetX - ring.startX) * progress;
      const linearY = ring.startY + (ring.targetY - ring.startY) * progress;
      const arcHeight = Math.sin(progress * Math.PI) * 90;
      ring.x = currentX;
      ring.y = linearY - arcHeight;
      ring.radius = 16 - Math.sin(progress * Math.PI) * 4;

      if (progress >= 1.0 && !ring.landed) {
        ring.landed = true;
        this.checkRingLanding(ring);
      }

      // Remove after lingering
      if (ring.flightTimer > ring.totalFlightTime + 0.6) {
        this.rings.splice(i, 1);
      }
    }

    // Bottle wobble dampening
    for (const b of this.bottles) {
      if (b.wobble > 0) b.wobble = Math.max(0, b.wobble - dt * 4);
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private throwRing(
    pid: PlayerId,
    pColor: string,
    idx: number,
    count: number,
    width: number,
    height: number,
    booth: PlayerBooth
  ): void {
    const startX = (width / (count + 1)) * (idx + 1);
    const startY = height - 55;
    const throwDist = 120 + booth.power * (height * 0.52);
    const targetX = startX + Math.cos(booth.angle) * throwDist;
    const targetY = startY + Math.sin(booth.angle) * throwDist;

    this.rings.push({
      playerId: pid,
      color: pColor,
      x: startX,
      y: startY,
      startX,
      startY,
      targetX,
      targetY,
      flightTimer: 0,
      totalFlightTime: 0.65,
      radius: 16,
      landed: false
    });

    booth.ringsThrown++;
    this.audio.playLaser(); // Whistle whoosh
  }

  private checkRingLanding(ring: Ring): void {
    let bestBottle: Bottle | null = null;
    let minDist = 22;

    for (const b of this.bottles) {
      const d = Math.hypot(ring.x - b.x, ring.y - b.y);
      if (d < minDist) {
        minDist = d;
        bestBottle = b;
      }
    }

    if (bestBottle) {
      bestBottle.wobble = 1.0;
      bestBottle.ringRingCount++;
      const booth = this.booths.get(ring.playerId);
      if (booth) booth.score += bestBottle.points;

      this.audio.playScore();
      this.particles.showFloatingText(`+${bestBottle.points}`, bestBottle.x, bestBottle.y - 20, bestBottle.color, 20);
      this.particles.spawnConfetti(bestBottle.x, bestBottle.y, 14);
    } else {
      this.audio.playBounce();
      this.particles.spawnDust(ring.x, ring.y, 6);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Carnival Midway Booth Tent Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1E1B4B');
    bgGrad.addColorStop(0.4, '#312E81');
    bgGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Striped carnival canopy overhead
    const canopyHeight = 44;
    const stripeW = 28;
    for (let x = 0; x < width; x += stripeW) {
      ctx.fillStyle = (Math.floor(x / stripeW) % 2 === 0) ? '#EF4444' : '#F8FAFC';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeW, 0);
      ctx.lineTo(x + stripeW / 2, canopyHeight);
      ctx.closePath();
      ctx.fill();
    }

    // Glowing string carnival fairy lights
    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, canopyHeight);
    for (let lx = 30; lx < width; lx += 36) {
      const ly = canopyHeight + Math.sin(lx * 0.15) * 8 + 4;
      ctx.lineTo(lx, ly);
    }
    ctx.stroke();

    for (let lx = 30; lx < width; lx += 36) {
      const ly = canopyHeight + Math.sin(lx * 0.15) * 8 + 4;
      ctx.fillStyle = lx % 72 === 0 ? '#38BDF8' : '#FDE047';
      ctx.beginPath();
      ctx.arc(lx, ly, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Wooden bottle shelf table
    ctx.fillStyle = '#78350F';
    const tableY = height * 0.35;
    const tableH = height * 0.28;
    ctx.fillRect(width * 0.18, tableY, width * 0.64, tableH);
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 4;
    ctx.strokeRect(width * 0.18, tableY, width * 0.64, tableH);

    // 2. Draw Bottles
    for (const b of this.bottles) {
      ctx.save();
      const wobbleOffset = Math.sin(b.wobble * Math.PI * 8) * (b.wobble * 4);
      ctx.translate(b.x + wobbleOffset, b.y);

      // Bottle shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 10, b.radius, b.radius * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // Bottle body
      const bottleGrad = ctx.createLinearGradient(-b.radius, -20, b.radius, 10);
      bottleGrad.addColorStop(0, '#FFFFFF');
      bottleGrad.addColorStop(0.3, b.color);
      bottleGrad.addColorStop(1, '#0F172A');
      ctx.fillStyle = bottleGrad;

      // Draw glass bottle silhouette
      ctx.beginPath();
      ctx.moveTo(-b.radius * 0.4, -22);
      ctx.lineTo(b.radius * 0.4, -22);
      ctx.lineTo(b.radius * 0.4, -12);
      ctx.lineTo(b.radius * 0.85, 0);
      ctx.lineTo(b.radius * 0.85, 12);
      ctx.lineTo(-b.radius * 0.85, 12);
      ctx.lineTo(-b.radius * 0.85, 0);
      ctx.lineTo(-b.radius * 0.4, -12);
      ctx.closePath();
      ctx.fill();

      // Bottle rim
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Crown points text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${b.points}`, 0, 8);

      ctx.restore();
    }

    // 3. Draw Rings
    for (const ring of this.rings) {
      ctx.save();
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 4;
      ctx.shadowColor = ring.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.ellipse(ring.x, ring.y, ring.radius, ring.radius * 0.65, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Draw Player Throwing Stations & Aim Guides
    const active = this.getActivePlayers();
    const count = active.length;
    active.forEach((p, idx) => {
      const booth = this.booths.get(p.id);
      if (!booth) return;
      const startX = (width / (count + 1)) * (idx + 1);
      const startY = height - 55;

      // Booth rail
      ctx.fillStyle = '#475569';
      ctx.fillRect(startX - 48, startY + 12, 96, 42);
      ctx.fillStyle = p.color;
      ctx.fillRect(startX - 44, startY + 14, 88, 5);

      // Score display
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 13px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${booth.score}`, startX, startY + 34);

      // Aim trajectory arrow & charge arc
      const guideDist = 55 + booth.power * 45;
      const endX = startX + Math.cos(booth.angle) * guideDist;
      const endY = startY + Math.sin(booth.angle) * guideDist;

      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = booth.charging ? 3.5 : 2;
      ctx.setLineDash(booth.charging ? [] : [4, 4]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ring ready in hand
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(startX, startY, 14, 9, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Power gauge meter
      if (booth.charging) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(startX - 30, startY - 26, 60, 8);
        const pGrad = ctx.createLinearGradient(startX - 30, 0, startX + 30, 0);
        pGrad.addColorStop(0, '#22C55E');
        pGrad.addColorStop(0.7, '#EAB308');
        pGrad.addColorStop(1, '#EF4444');
        ctx.fillStyle = pGrad;
        ctx.fillRect(startX - 30, startY - 26, 60 * booth.power, 8);
      }
      ctx.restore();
    });

    // 5. Timer HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const booth = this.booths.get(botId);
    if (!booth) return;

    // Pick high value bottles
    const targetBottle = this.bottles[12] || this.bottles[0];
    const active = this.getActivePlayers();
    const count = active.length;
    const idx = active.findIndex((p) => p.id === botId);
    const startX = (width / (count + 1)) * (idx + 1);
    const startY = height - 55;
    const idealAngle = Math.atan2(targetBottle.y - startY, targetBottle.x - startX);
    const angleDiff = Math.abs(booth.angle - idealAngle);

    const angleTol = difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.16 : 0.32;
    const idealPower = Math.min(0.9, Math.max(0.3, Math.hypot(targetBottle.x - startX, targetBottle.y - startY) / (height * 0.6)));

    if (!booth.charging) {
      if (angleDiff < angleTol && booth.cooldown <= 0) {
        this.input.setBotInput(botId, true, 0, 0, true);
      } else {
        this.input.setBotInput(botId, false, 0, 0, false);
      }
    } else {
      if (booth.power >= idealPower) {
        this.input.setBotInput(botId, false, 0, 0, false);
      } else {
        this.input.setBotInput(botId, true, 0, 0, true);
      }
    }
  }

  public getScore(playerId: PlayerId): number {
    return this.booths.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.booths.entries())
      .map(([playerId, b]) => ({ playerId, score: b.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} landed master bottle ringers!` : 'No ringers landed!'
    };
  }
}
