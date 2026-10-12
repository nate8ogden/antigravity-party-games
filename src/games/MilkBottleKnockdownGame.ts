import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface MilkBottle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  knocked: boolean;
  scoreAwarded: boolean;
}

interface Baseball {
  playerId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alive: boolean;
}

interface PlayerPitcher {
  id: PlayerId;
  aimAngle: number;
  aimDir: number;
  power: number;
  charging: boolean;
  ballsLeft: number;
  reloadTimer: number;
  score: number;
}

export class MilkBottleKnockdownGame extends BaseGame {
  private bottles: MilkBottle[] = [];
  private balls: Baseball[] = [];
  private playersState: Map<PlayerId, PlayerPitcher> = new Map();
  private shelfY: number = 0;
  private shelfX: number = 0;
  private shelfW: number = 0;

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
    this.balls = [];
    this.bottles = [];
    this.playersState.clear();

    this.shelfX = width * 0.22;
    this.shelfW = width * 0.56;
    this.shelfY = height * 0.38;

    this.spawnPyramidRacks(width);

    const active = this.getActivePlayers();
    const count = active.length;
    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        aimAngle: -Math.PI / 2,
        aimDir: idx % 2 === 0 ? 1 : -1,
        power: 0.3,
        charging: false,
        ballsLeft: 3,
        reloadTimer: 0,
        score: 0
      });
    });
  }

  private spawnPyramidRacks(width: number): void {
    this.bottles = [];
    // Spawn 3 pyramid stacks along shelf
    const racks = [width * 0.32, width * 0.5, width * 0.68];
    const bW = 18;
    const bH = 34;

    for (const rx of racks) {
      // Row 1 (3 bottles)
      for (let i = -1; i <= 1; i++) {
        this.bottles.push({
          x: rx + i * (bW + 4),
          y: this.shelfY - bH / 2,
          vx: 0,
          vy: 0,
          rotation: 0,
          vRot: 0,
          knocked: false,
          scoreAwarded: false
        });
      }
      // Row 2 (2 bottles)
      for (let i = -0.5; i <= 0.5; i += 1) {
        this.bottles.push({
          x: rx + i * (bW + 4),
          y: this.shelfY - bH * 1.5 - 2,
          vx: 0,
          vy: 0,
          rotation: 0,
          vRot: 0,
          knocked: false,
          scoreAwarded: false
        });
      }
      // Row 3 (1 bottle apex)
      this.bottles.push({
        x: rx,
        y: this.shelfY - bH * 2.5 - 4,
        vx: 0,
        vy: 0,
        rotation: 0,
        vRot: 0,
        knocked: false,
        scoreAwarded: false
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();
    const count = active.length;

    for (let idx = 0; idx < count; idx++) {
      const p = active[idx];
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.reloadTimer > 0) {
        ps.reloadTimer -= dt;
        if (ps.reloadTimer <= 0) {
          ps.ballsLeft = 3;
        }
      }

      // Sweep aim angle
      ps.aimAngle += ps.aimDir * dt * 2.0;
      const minAngle = -Math.PI * 0.78;
      const maxAngle = -Math.PI * 0.22;
      if (ps.aimAngle > maxAngle) {
        ps.aimAngle = maxAngle;
        ps.aimDir = -1;
      } else if (ps.aimAngle < minAngle) {
        ps.aimAngle = minAngle;
        ps.aimDir = 1;
      }

      const isDown = this.input.isPressed(p.id);
      const justReleased = this.input.justReleased(p.id);

      if (isDown && ps.ballsLeft > 0 && ps.reloadTimer <= 0) {
        ps.charging = true;
        ps.power = Math.min(1.0, ps.power + dt * 1.8);
      } else if (ps.charging && (justReleased || !isDown)) {
        // Pitch baseball
        this.pitchBall(p.id, idx, count, width, height, ps);
        ps.charging = false;
        ps.power = 0.25;
        ps.ballsLeft--;
        if (ps.ballsLeft <= 0) {
          ps.reloadTimer = 0.8;
        }
      }
    }

    // Update flying baseballs
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 220 * dt; // gravity

      // Check collision with milk bottles
      for (const bottle of this.bottles) {
        if (!bottle.knocked) {
          const dist = Math.hypot(b.x - bottle.x, b.y - bottle.y);
          if (dist < b.radius + 14) {
            bottle.knocked = true;
            bottle.vx = b.vx * 0.45 + (Math.random() - 0.5) * 120;
            bottle.vy = b.vy * 0.35 - 90;
            bottle.vRot = (Math.random() - 0.5) * 12;

            if (!bottle.scoreAwarded) {
              bottle.scoreAwarded = true;
              const ps = this.playersState.get(b.playerId);
              if (ps) ps.score += 20;

              this.audio.playExplosion();
              this.particles.showFloatingText('+20', bottle.x, bottle.y - 18, '#F59E0B', 20);
              this.particles.spawnConfetti(bottle.x, bottle.y, 10);
            }
          }
        }
      }

      if (b.y < -40 || b.y > height + 40 || b.x < -40 || b.x > width + 40) {
        this.balls.splice(i, 1);
      }
    }

    // Update tumbling physics bottles
    for (const bottle of this.bottles) {
      if (bottle.knocked) {
        bottle.x += bottle.vx * dt;
        bottle.y += bottle.vy * dt;
        bottle.vy += 420 * dt; // strong gravity
        bottle.rotation += bottle.vRot * dt;

        // Shelf / floor bounce
        if (bottle.y > height - 40) {
          bottle.y = height - 40;
          bottle.vy *= -0.3;
          bottle.vx *= 0.7;
          bottle.vRot *= 0.5;
        }
      }
    }

    // If all bottles knocked, respawn fresh pyramids!
    if (this.bottles.every((b) => b.knocked)) {
      this.spawnPyramidRacks(width);
      this.particles.shake(0.3);
      this.particles.showFloatingText('STRIKE!! +50 BONUS', width / 2, this.shelfY - 40, '#10B981', 28);
      this.audio.playFanfare();
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private pitchBall(
    pid: PlayerId,
    idx: number,
    count: number,
    width: number,
    height: number,
    ps: PlayerPitcher
  ): void {
    const startX = (width / (count + 1)) * (idx + 1);
    const startY = height - 50;
    const speed = 480 + ps.power * 520;

    this.balls.push({
      playerId: pid,
      x: startX,
      y: startY,
      vx: Math.cos(ps.aimAngle) * speed,
      vy: Math.sin(ps.aimAngle) * speed,
      radius: 12,
      alive: true
    });

    this.audio.playLaser();
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Carnival Booth Wooden Plank Backdrop
    ctx.fillStyle = '#1E1B4B';
    ctx.fillRect(0, 0, width, height);

    // Shelf background curtain
    ctx.fillStyle = '#7F1D1D';
    ctx.fillRect(this.shelfX - 20, 40, this.shelfW + 40, this.shelfY - 30);

    // Thick wooden bottle shelf
    ctx.fillStyle = '#78350F';
    ctx.fillRect(this.shelfX, this.shelfY, this.shelfW, 18);
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 3;
    ctx.strokeRect(this.shelfX, this.shelfY, this.shelfW, 18);

    // 2. Draw Milk Bottles
    for (const b of this.bottles) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rotation);

      // Porcelain White Bottle Shape with red band
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.moveTo(-7, -16);
      ctx.lineTo(7, -16);
      ctx.lineTo(7, -6);
      ctx.lineTo(9, 14);
      ctx.lineTo(-9, 14);
      ctx.lineTo(-7, -6);
      ctx.closePath();
      ctx.fill();

      // Red carnival label band
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-8.5, -2, 17, 7);

      // Rim
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();
    }

    // 3. Draw Baseballs
    for (const b of this.balls) {
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      // Red baseball seams
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x - 3, b.y, b.radius * 0.7, -0.6 * Math.PI, 0.6 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.x + 3, b.y, b.radius * 0.7, 0.4 * Math.PI, 1.6 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Draw Player Pitching Stations
    const active = this.getActivePlayers();
    const count = active.length;
    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      if (!ps) return;
      const startX = (width / (count + 1)) * (idx + 1);
      const startY = height - 50;

      // Platform
      ctx.fillStyle = '#334155';
      ctx.fillRect(startX - 44, startY + 10, 88, 40);
      ctx.fillStyle = p.color;
      ctx.fillRect(startX - 40, startY + 12, 80, 4);

      // Score & Balls
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      const bInfo = ps.reloadTimer > 0 ? 'RELOADING' : `BALLS: ${'⚾'.repeat(ps.ballsLeft)}`;
      ctx.fillText(`${p.name}: ${ps.score}`, startX, startY + 28);
      ctx.font = '700 9px monospace';
      ctx.fillStyle = ps.reloadTimer > 0 ? '#F59E0B' : '#94A3B8';
      ctx.fillText(bInfo, startX, startY + 42);

      // Trajectory Arrow
      const arrowLen = 50 + ps.power * 45;
      const arrowX = startX + Math.cos(ps.aimAngle) * arrowLen;
      const arrowY = startY + Math.sin(ps.aimAngle) * arrowLen;

      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = ps.charging ? 3.5 : 2;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(arrowX, arrowY);
      ctx.stroke();

      // Power meter
      if (ps.charging) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(startX - 26, startY - 22, 52, 6);
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(startX - 26, startY - 22, 52 * ps.power, 6);
      }
      ctx.restore();
    });

    // 5. Header HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 30);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.ballsLeft <= 0 || ps.reloadTimer > 0) return;

    const standingBottle = this.bottles.find((b) => !b.knocked);
    if (!standingBottle) return;

    const active = this.getActivePlayers();
    const count = active.length;
    const idx = active.findIndex((p) => p.id === botId);
    const startX = (width / (count + 1)) * (idx + 1);
    const startY = height - 50;

    const idealAngle = Math.atan2(standingBottle.y - startY, standingBottle.x - startX);
    const diff = Math.abs(ps.aimAngle - idealAngle);
    const tol = difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.16 : 0.34;

    if (!ps.charging) {
      if (diff < tol) {
        this.input.setBotInput(botId, true, 0, 0, true);
      } else {
        this.input.setBotInput(botId, false, 0, 0, false);
      }
    } else {
      if (ps.power >= 0.75) {
        this.input.setBotInput(botId, false, 0, 0, false);
      } else {
        this.input.setBotInput(botId, true, 0, 0, true);
      }
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
      mvpHighlight: winnerId ? `${winnerId} toppled the milk bottle pyramids!` : 'No milk bottles knocked!'
    };
  }
}
