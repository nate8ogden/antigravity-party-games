import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface ClockGear {
  x: number;
  y: number;
  radius: number;
  rotation: number;
  points: number;
}

interface TowerPlayer {
  id: PlayerId;
  x: number;
  y: number;
  isDucking: boolean;
  score: number;
  stunTimer: number;
  vx: number;
}

export class CursedClocktowerPendulumGame extends BaseGame {
  private playersState: Map<PlayerId, TowerPlayer> = new Map();
  private gears: ClockGear[] = [];
  private pendulumAngle: number = 0;
  private pendulumSpeed: number = 2.4;
  private pendulumLength: number = 200;
  private bgGearAngle: number = 0;

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
    this.gears = [];
    this.pendulumAngle = -1.1;
    this.pendulumSpeed = 2.4;
    this.pendulumLength = height * 0.72;
    this.bgGearAngle = 0;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height - 50,
        isDucking: false,
        score: 0,
        stunTimer: 0,
        vx: 0
      });
    });

    for (let i = 0; i < 4; i++) {
      this.spawnGear(width, height);
    }
  }

  private spawnGear(width: number, height: number): void {
    this.gears.push({
      x: 80 + Math.random() * (width - 160),
      y: height - 60 - Math.random() * 40,
      radius: 14 + Math.random() * 6,
      rotation: 0,
      points: Math.random() < 0.3 ? 2 : 1
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);
    this.bgGearAngle += dt * 0.5;

    // Harmonic Pendulum Physics
    const maxSwing = 1.15;
    this.pendulumAngle = Math.sin((30 - this.roundTimer) * this.pendulumSpeed) * maxSwing;

    const pivotX = width / 2;
    const pivotY = 20;
    const bobX = pivotX + Math.sin(this.pendulumAngle) * this.pendulumLength;
    const bobY = pivotY + Math.cos(this.pendulumAngle) * this.pendulumLength;

    // Check swoosh sound near lowest point
    if (Math.abs(this.pendulumAngle) < 0.1 && Math.random() < 0.3) {
      this.audio.playWhoosh();
    }

    // Update Gears
    for (const g of this.gears) {
      g.rotation += dt * 2;
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        ps.x += ps.vx * dt;
        ps.vx *= 0.95;
        ps.x = Math.max(30, Math.min(width - 30, ps.x));
        continue;
      }

      const steer = this.input.getSteer(p.id);
      const isPressed = this.input.isPressed(p.id);

      ps.isDucking = isPressed;

      const speed = ps.isDucking ? 60 : 180;
      ps.x += steer * speed * dt;
      ps.x = Math.max(30, Math.min(width - 30, ps.x));

      // Collect Gears
      for (let i = this.gears.length - 1; i >= 0; i--) {
        const g = this.gears[i];
        const dist = Math.hypot(ps.x - g.x, ps.y - g.y);
        if (dist < 26) {
          ps.score += g.points;
          this.audio.playScore();
          this.particles.emit(g.x, g.y, 14, '#fbbf24');
          this.gears.splice(i, 1);
          this.spawnGear(width, height);
        }
      }

      // Check collision with pendulum blade
      const distToBob = Math.hypot(ps.x - bobX, (ps.y - (ps.isDucking ? 0 : 12)) - bobY);
      if (distToBob < 36) {
        // If ducking and bob is high enough, safe!
        // But if bob is very low and hit occurs:
        if (!ps.isDucking || bobY > ps.y - 10) {
          ps.stunTimer = 1.3;
          ps.vx = Math.sign(Math.cos(this.pendulumAngle)) * 260;
          ps.score = Math.max(0, ps.score - 1);
          this.audio.playExplosion();
          this.particles.shake(0.4);
          this.particles.emit(ps.x, ps.y, 18, '#ef4444');
        }
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
    width: number,
    _height: number
  ): void {
    const pivotX = width / 2;
    const pivotY = 20;
    const bobX = pivotX + Math.sin(this.pendulumAngle) * this.pendulumLength;
    const bobY = pivotY + Math.cos(this.pendulumAngle) * this.pendulumLength;

    const ps = this.playersState.get(botId);
    if (!ps || ps.stunTimer > 0) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false, 0, 0);
      return;
    }

    const distToBlade = Math.hypot(ps.x - bobX, ps.y - bobY);

    // Duck if pendulum is sweeping right at us
    let duck = false;
    const duckThreshold = difficulty === 'bot_easy' ? 52 : difficulty === 'bot_normal' ? 68 : 78;
    const duckSuccess = difficulty === 'bot_easy' ? Math.random() < 0.72 : true;
    if (distToBlade < duckThreshold && duckSuccess) {
      duck = true;
    }

    // Find nearest gear
    let steerX = 0;
    let nearestGear: ClockGear | null = null;
    let minDist = Infinity;
    for (const g of this.gears) {
      const d = Math.abs(g.x - ps.x);
      if (d < minDist) {
        minDist = d;
        nearestGear = g;
      }
    }

    if (nearestGear && !duck) {
      steerX = Math.sign(nearestGear.x - ps.x);
    }

    this.input.setBotInput(botId, duck, steerX, 0);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Dark Clocktower Rafters Background
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, width, height);

    // Giant background clock gears
    ctx.save();
    ctx.translate(width / 2, height / 2 - 20);
    ctx.rotate(this.bgGearAngle);
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(0, 0, 110, 0, Math.PI * 2);
    ctx.stroke();

    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      ctx.fillStyle = '#27272a';
      ctx.fillRect(Math.cos(a) * 115 - 8, Math.sin(a) * 115 - 8, 16, 16);
    }
    ctx.restore();

    // Rafter floor beam
    const floorY = height - 35;
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(0, floorY, width, 35);
    ctx.strokeStyle = '#52525b';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, floorY, width, 35);

    // Render Collectible Clockwork Gears
    for (const g of this.gears) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.rotation);

      ctx.fillStyle = g.points > 1 ? '#fbbf24' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(0, 0, g.radius, 0, Math.PI * 2);
      ctx.fill();

      // Cog teeth
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.fillRect(Math.cos(a) * g.radius - 3, Math.sin(a) * g.radius - 3, 6, 6);
      }

      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.arc(0, 0, g.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Render Pendulum
    const pivotX = width / 2;
    const pivotY = 20;
    const bobX = pivotX + Math.sin(this.pendulumAngle) * this.pendulumLength;
    const bobY = pivotY + Math.cos(this.pendulumAngle) * this.pendulumLength;

    // Pivot mount
    ctx.fillStyle = '#71717a';
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 12, 0, Math.PI * 2);
    ctx.fill();

    // Pendulum Brass Shaft
    ctx.strokeStyle = '#a1a1aa';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();

    // Crescent Blade & Bob
    ctx.save();
    ctx.translate(bobX, bobY);
    ctx.rotate(this.pendulumAngle);

    // Glowing blade edge
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 15;

    // Heavy round counterweight
    ctx.fillStyle = '#71717a';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    // Sharp crescent scythe blade
    ctx.fillStyle = '#e4e4e7';
    ctx.beginPath();
    ctx.arc(0, 8, 38, -Math.PI * 0.8, -Math.PI * 0.2, false);
    ctx.quadraticCurveTo(0, 24, 0, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    // Render Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      const drawY = ps.isDucking ? ps.y + 8 : ps.y;
      ctx.translate(ps.x, drawY);

      // Body
      ctx.fillStyle = p.color;
      if (ps.isDucking) {
        // Flattened crouching circle
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Ducking label or stun stars
      if (ps.stunTimer > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('*HIT!*', 0, -20);
      } else if (ps.isDucking) {
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('DUCK!', 0, -14);
      }

      ctx.restore();

      // Score
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y + 24);
    }

    // Top HUD
    ctx.fillStyle = 'rgba(24, 24, 27, 0.9)';
    ctx.fillRect(0, 0, width, 36);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('CURSED CLOCKTOWER PENDULUM', 16, 24);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.roundTimer < 6 ? '#ef4444' : '#f8fafc';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width - 16, 24);
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
      mvpHighlight: winnerId ? `${winnerId} dodged the lethal scythe blade!` : 'Time stopped in the bell tower!'
    };
  }
}
