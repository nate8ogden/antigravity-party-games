import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface BalloonProjectile {
  id: number;
  ownerId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  wobbleTimer: number;
}

interface PlayerCatapult {
  id: PlayerId;
  side: 'LEFT' | 'RIGHT';
  x: number;
  y: number;
  aimAngle: number; // in radians
  aimAngleSpeed: number;
  minAngle: number;
  maxAngle: number;
  power: number; // 0..1
  isCharging: boolean;
  soaksTaken: number; // 3 soaks = eliminated
  soaksScored: number;
  score: number;
  botReactionTimer: number;
}

export class WaterBalloonBarrageGame extends BaseGame {
  private catapults: Map<PlayerId, PlayerCatapult> = new Map();
  private balloons: BalloonProjectile[] = [];
  private fence = { x: 0, y: 0, width: 24, height: 260 };
  private windSpeed: number = 0; // -30 to +30 px/s^2
  private windTimer: number = 0;
  private currentMapName: string = 'Cedar Picket Fence';
  private gravity: number = 520;
  private balloonCounter: number = 0;

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
    this.balloons = [];
    this.windSpeed = (Math.random() - 0.5) * 40;
    this.windTimer = 4.0;

    const maps = ['Cedar Picket Fence', 'Stone Garden Hedge', 'Double Bamboo Wall', 'Backyard Pergola'];
    this.currentMapName = maps[Math.floor(Math.random() * maps.length)];

    const groundY = height - 90;
    const fenceHeight = Math.min(280, height * 0.45);
    this.fence = {
      x: width / 2 - 12,
      y: groundY - fenceHeight,
      width: 24,
      height: fenceHeight
    };

    this.catapults.clear();
    const active = this.getActivePlayers();

    active.forEach((p, idx) => {
      const isLeft = idx % 2 === 0;
      const x = isLeft
        ? width * 0.14 + (idx >= 2 ? 80 : 0)
        : width * 0.86 - (idx >= 2 ? 80 : 0);
      const y = groundY;

      // Left players aim right (angle ~ 45 deg), right players aim left (angle ~ 135 deg)
      const minA = isLeft ? 0.35 : Math.PI - 1.2;
      const maxA = isLeft ? 1.2 : Math.PI - 0.35;

      this.catapults.set(p.id, {
        id: p.id,
        side: isLeft ? 'LEFT' : 'RIGHT',
        x,
        y,
        aimAngle: (minA + maxA) / 2,
        aimAngleSpeed: 1.6,
        minAngle: minA,
        maxAngle: maxA,
        power: 0,
        isCharging: false,
        soaksTaken: 0,
        soaksScored: 0,
        score: 0,
        botReactionTimer: 0.2 + Math.random() * 0.2
      });
    });
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

    // Shifting Wind
    this.windTimer -= dt;
    if (this.windTimer <= 0) {
      this.windTimer = 3.5 + Math.random() * 3;
      this.windSpeed = (Math.random() - 0.5) * 50;
    }

    // Update Catapult Oscillating Aim & Charging
    for (const cat of this.catapults.values()) {
      if (cat.soaksTaken >= 3) continue;

      // Oscillate aim angle
      cat.aimAngle += cat.aimAngleSpeed * dt;
      if (cat.aimAngle > cat.maxAngle) {
        cat.aimAngle = cat.maxAngle;
        cat.aimAngleSpeed = -Math.abs(cat.aimAngleSpeed);
      } else if (cat.aimAngle < cat.minAngle) {
        cat.aimAngle = cat.minAngle;
        cat.aimAngleSpeed = Math.abs(cat.aimAngleSpeed);
      }

      // Charge power if button held
      if (cat.isCharging) {
        cat.power = Math.min(1.0, cat.power + dt * 1.35);
      }
    }

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Human controls
    for (const p of this.getActivePlayers()) {
      const cat = this.catapults.get(p.id);
      if (!cat || cat.soaksTaken >= 3) continue;

      if (!p.type.startsWith('bot_')) {
        const isPressed = this.input.isPressed(p.id) || this.input.isActionPressed(p.id);
        const wasJustReleased = this.input.justReleased(p.id);

        if (isPressed) {
          if (!cat.isCharging) {
            cat.isCharging = true;
            cat.power = 0.15;
          }
        } else if (wasJustReleased && cat.isCharging) {
          this.launchBalloon(cat);
        }
      }
    }

    // Update Balloons
    const groundY = height - 90;
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i];
      b.wobbleTimer += dt * 8;
      b.vx += this.windSpeed * dt;
      b.vy += this.gravity * dt;

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // 1. Check Fence Collision
      if (
        b.x + b.radius >= this.fence.x &&
        b.x - b.radius <= this.fence.x + this.fence.width &&
        b.y + b.radius >= this.fence.y &&
        b.y - b.radius <= this.fence.y + this.fence.height
      ) {
        this.splashBalloon(b, b.x, b.y);
        this.balloons.splice(i, 1);
        continue;
      }

      // 2. Check Ground Collision
      if (b.y + b.radius >= groundY) {
        this.splashBalloon(b, b.x, groundY);
        this.balloons.splice(i, 1);
        continue;
      }

      // 3. Check Opponent Player Hit
      let hitPlayer = false;
      for (const target of this.catapults.values()) {
        if (target.id === b.ownerId || target.soaksTaken >= 3) continue;

        const dist = Math.hypot(b.x - target.x, b.y - (target.y - 20));
        if (dist < b.radius + 24) {
          // Direct Soak!
          target.soaksTaken++;
          const shooter = this.catapults.get(b.ownerId);
          if (shooter) {
            shooter.soaksScored++;
            shooter.score += 100;
          }

          this.splashBalloon(b, b.x, b.y);
          this.balloons.splice(i, 1);
          hitPlayer = true;
          break;
        }
      }
      if (hitPlayer) continue;

      // Screen boundary check
      if (b.x < -40 || b.x > width + 40) {
        this.balloons.splice(i, 1);
      }
    }

    // Check last un-soaked standing
    const activeUnsoaked = Array.from(this.catapults.values()).filter((c) => c.soaksTaken < 3);
    if (activeUnsoaked.length <= 1 && this.getActivePlayers().length > 1) {
      if (activeUnsoaked.length === 1) activeUnsoaked[0].score += 150;
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private launchBalloon(cat: PlayerCatapult): void {
    cat.isCharging = false;
    const launchSpeed = 380 + cat.power * 460;
    const launchAngle = cat.aimAngle;

    const vx = Math.cos(launchAngle) * launchSpeed;
    const vy = -Math.sin(launchAngle) * launchSpeed;

    const pConfig = this.players.find((p) => p.id === cat.id);
    this.balloons.push({
      id: ++this.balloonCounter,
      ownerId: cat.id,
      x: cat.x,
      y: cat.y - 25,
      vx,
      vy,
      radius: 11,
      color: pConfig?.color || '#38BDF8',
      wobbleTimer: 0
    });

    this.audio.playTap();
    cat.power = 0;
  }

  private splashBalloon(b: BalloonProjectile, splashX: number, splashY: number): void {
    this.audio.playBounce();
    // Splash droplets
    this.particles.emit(splashX, splashY, 18, b.color);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const cat = this.catapults.get(botId);
    if (!cat || cat.soaksTaken >= 3) return;

    cat.botReactionTimer -= dt;

    // Find target opponent catapult
    let targetCat: PlayerCatapult | null = null;
    for (const c of this.catapults.values()) {
      if (c.id !== botId && c.side !== cat.side && c.soaksTaken < 3) {
        targetCat = c;
        break;
      }
    }
    if (!targetCat) return;

    const dx = Math.abs(targetCat.x - cat.x);
    // Base 45-degree trajectory
    const baseIdeal = cat.side === 'LEFT' ? Math.PI / 4 : (Math.PI * 3) / 4;
    const windEffect = (cat.side === 'LEFT' ? -this.windSpeed : this.windSpeed) * 0.004;
    const idealAngle = baseIdeal + windEffect;

    const angleTolerance =
      difficulty === 'bot_hard' ? 0.09 : difficulty === 'bot_normal' ? 0.18 : 0.32;

    if (!cat.isCharging) {
      if (cat.botReactionTimer <= 0 && Math.abs(cat.aimAngle - idealAngle) < angleTolerance) {
        cat.isCharging = true;
        cat.power = 0.15;
        const nominalDist = 720;
        const distRatio = Math.max(0.3, Math.min(1.0, dx / nominalDist));
        const chargeDuration = (0.35 + distRatio * 0.32) * (difficulty === 'bot_easy' ? (0.8 + Math.random() * 0.4) : 1.0);
        cat.botReactionTimer = chargeDuration;
      }
    } else {
      if (cat.botReactionTimer <= 0) {
        this.launchBalloon(cat);
        cat.botReactionTimer =
          difficulty === 'bot_easy' ? 1.5 + Math.random() * 0.5 : difficulty === 'bot_normal' ? 1.0 + Math.random() * 0.3 : 0.7;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Backyard Lawn & Sky
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    const groundY = height - 90;

    // Grass Floor
    ctx.fillStyle = '#15803D';
    ctx.fillRect(0, groundY, width, height - groundY);
    ctx.fillStyle = '#166534';
    ctx.fillRect(0, groundY, width, 8);

    // 2. Center Wooden Fence
    ctx.fillStyle = '#78350F';
    ctx.fillRect(this.fence.x, this.fence.y, this.fence.width, this.fence.height);
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.fence.x, this.fence.y, this.fence.width, this.fence.height);

    // Fence slats
    for (let fy = this.fence.y + 20; fy < groundY; fy += 30) {
      ctx.fillStyle = '#451A03';
      ctx.fillRect(this.fence.x + 2, fy, this.fence.width - 4, 3);
    }

    // 3. Wind Indicator
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`ARENA: ${this.currentMapName.toUpperCase()} • WATER BALLOON BARRAGE`, width / 2, 28);

    const windDir = this.windSpeed > 0 ? 'EAST ➡' : '⬅ WEST';
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`WIND: ${Math.round(Math.abs(this.windSpeed))} MPH ${windDir}`, width / 2, 50);

    const timerSec = Math.ceil(this.roundTimer);
    ctx.fillStyle = this.roundTimer < 10 ? '#EF4444' : '#F8FAFC';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`${timerSec}s`, width / 2, 72);

    // 4. Catapults & Players
    for (const p of this.getActivePlayers()) {
      const cat = this.catapults.get(p.id);
      if (!cat) continue;

      ctx.save();
      ctx.translate(cat.x, cat.y);

      // Wooden Catapult Base Frame
      ctx.fillStyle = '#451A03';
      ctx.fillRect(-22, -14, 44, 14);

      // Launcher arm
      const armLen = 38;
      const armEndX = Math.cos(cat.aimAngle) * armLen;
      const armEndY = -Math.sin(cat.aimAngle) * armLen;

      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(armEndX, armEndY);
      ctx.stroke();

      // Bucket & loaded balloon
      ctx.fillStyle = cat.soaksTaken >= 3 ? '#64748B' : p.color;
      ctx.beginPath();
      ctx.arc(armEndX, armEndY, 10, 0, Math.PI * 2);
      ctx.fill();

      // Power Bar indicator when charging
      if (cat.isCharging) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(-24, -46, 48, 8);
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(-22, -44, 44 * cat.power, 4);
      }

      // Soak Water Meter (3 drops)
      for (let s = 0; s < 3; s++) {
        ctx.fillStyle = s < cat.soaksTaken ? '#38BDF8' : '#334155';
        ctx.beginPath();
        ctx.arc(-16 + s * 16, 12, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // 5. Flying Water Balloons
    for (const b of this.balloons) {
      ctx.save();
      ctx.translate(b.x, b.y);

      const wobble = Math.sin(b.wobbleTimer) * 0.15;
      ctx.scale(1 + wobble, 1 - wobble);

      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // Rubber sheen highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.arc(-b.radius * 0.3, -b.radius * 0.3, b.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 6. Corner HUDs
    for (const p of this.getActivePlayers()) {
      const cat = this.catapults.get(p.id);
      if (!cat) continue;

      let px = 20;
      let py = 20;
      if (p.corner === 'top-right') px = width - 160;
      else if (p.corner === 'bottom-left') py = height - 85;
      else if (p.corner === 'bottom-right') {
        px = width - 160;
        py = height - 85;
      }

      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeStyle = cat.soaksTaken < 3 ? p.color : '#64748B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, py, 140, 65, 8);
      else ctx.rect(px, py, 140, 65);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = cat.soaksTaken < 3 ? p.color : '#94A3B8';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, px + 10, py + 20);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`${cat.score} pts`, px + 10, py + 40);

      ctx.fillStyle = cat.soaksTaken < 3 ? '#38BDF8' : '#EF4444';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(cat.soaksTaken < 3 ? `Soaked: ${cat.soaksTaken}/3` : 'DRENCHED ✖', px + 10, py + 56);
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const sorted = [...active].sort((a, b) => {
      const sa = this.catapults.get(a.id);
      const sb = this.catapults.get(b.id);
      if (!sa || !sb) return 0;
      if (sa.soaksTaken !== sb.soaksTaken) {
        return sa.soaksTaken - sb.soaksTaken;
      }
      return sb.score - sa.score;
    });

    const winnerId = sorted.length > 0 ? sorted[0].id : null;
    const topHits = this.catapults.get(winnerId ?? 0)?.soaksScored || 0;

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      score: this.catapults.get(p.id)?.score || 0,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: `Artillery maestro! Launched precision arcs scoring ${topHits} direct soaking hits!`
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }
}
