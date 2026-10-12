import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface GargoyleSentry {
  x: number;
  y: number;
  state: 'SLEEPING' | 'TELEGRAPH' | 'STARING';
  timer: number;
}

interface RooftopPlayer {
  id: PlayerId;
  x: number;
  y: number;
  startX: number;
  startY: number;
  isMoving: boolean;
  score: number;
}

export class GargoyleStoneStareGame extends BaseGame {
  private sentry: GargoyleSentry = { x: 0, y: 0, state: 'SLEEPING', timer: 3.0 };
  private playersState: Map<PlayerId, RooftopPlayer> = new Map();
  private bellX: number = 0;
  private bellY: number = 0;

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
    this.sentry = { x: width / 2, y: 70, state: 'SLEEPING', timer: 2.8 };
    this.bellX = width / 2;
    this.bellY = 125;
    this.playersState.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const sx = spacing * (idx + 1);
      const sy = height - 50;
      this.playersState.set(p.id, {
        id: p.id,
        x: sx,
        y: sy,
        startX: sx,
        startY: sy,
        isMoving: false,
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Update Gargoyle Sentry
    this.sentry.timer -= dt;
    if (this.sentry.state === 'SLEEPING') {
      if (this.sentry.timer <= 0.8) {
        this.sentry.state = 'TELEGRAPH';
        this.audio.playWhoosh();
      }
    } else if (this.sentry.state === 'TELEGRAPH') {
      if (this.sentry.timer <= 0) {
        this.sentry.state = 'STARING';
        this.sentry.timer = 1.4;
        this.audio.playExplosion();
        this.particles.shake(0.3);
      }
    } else if (this.sentry.state === 'STARING') {
      if (this.sentry.timer <= 0) {
        this.sentry.state = 'SLEEPING';
        this.sentry.timer = 2.6 + Math.random() * 1.5;
      }
    }

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      const steerX = this.input.getSteer(p.id);
      const steerY = -this.input.getThrottle(p.id);
      const mag = Math.hypot(steerX, steerY);
      const isMoving = mag > 0.2 || this.input.isPressed(p.id);
      ps.isMoving = isMoving;

      // Caught moving while gargoyle is staring!
      if (this.sentry.state === 'STARING' && isMoving) {
        ps.x = ps.startX;
        ps.y = ps.startY;
        ps.score = Math.max(0, ps.score - 10);
        this.audio.playStun();
        this.particles.showFloatingText('PETRIFIED! -10', ps.startX, ps.startY - 20, '#EF4444', 20);
        this.particles.spawnExplosion(ps.startX, ps.startY, '#64748B', 10);
        continue;
      }

      if (isMoving) {
        const speed = 200;
        ps.x += (steerX / (mag || 1)) * speed * dt;
        ps.y += (steerY / (mag || 1)) * speed * dt;
      }

      ps.x = Math.max(30, Math.min(width - 30, ps.x));
      ps.y = Math.max(120, Math.min(height - 40, ps.y));

      // Ring Cathedral Bell
      if (Math.hypot(ps.x - this.bellX, ps.y - this.bellY) < 36) {
        ps.score += 40;
        this.audio.playScore();
        this.particles.showFloatingText('BELL CHIMED! +40', this.bellX, this.bellY - 24, '#FBBF24', 24);
        this.particles.spawnConfetti(this.bellX, this.bellY, 14);

        // Reset to start edge for another climb
        ps.x = ps.startX;
        ps.y = ps.startY;
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Gothic Cathedral Rooftop Thunderstorm
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#020617');
    bgGrad.addColorStop(0.5, '#0F172A');
    bgGrad.addColorStop(1, '#1E1B4B');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Gothic Cathedral Spires in backdrop
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.moveTo(30, height);
    ctx.lineTo(30, 140);
    ctx.lineTo(45, 90);
    ctx.lineTo(60, 140);
    ctx.lineTo(60, height);
    ctx.moveTo(width - 60, height);
    ctx.lineTo(width - 60, 140);
    ctx.lineTo(width - 45, 90);
    ctx.lineTo(width - 30, 140);
    ctx.lineTo(width - 30, height);
    ctx.fill();

    // 2. Central Stone Gargoyle Sentry at Top
    const gx = this.sentry.x;
    const gy = this.sentry.y;

    ctx.save();
    ctx.translate(gx, gy);

    // Weathered Stone Gargoyle Body & Perch
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.ellipse(0, 0, 32, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Stone Horns
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(-16, -16);
    ctx.lineTo(-24, -32);
    ctx.lineTo(-8, -20);
    ctx.moveTo(16, -16);
    ctx.lineTo(24, -32);
    ctx.lineTo(8, -20);
    ctx.fill();

    // Gargoyle Stone Eyes
    if (this.sentry.state === 'STARING') {
      ctx.fillStyle = '#EF4444';
      ctx.shadowColor = '#EF4444';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(-10, -4, 5, 0, Math.PI * 2);
      ctx.arc(10, -4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (this.sentry.state === 'TELEGRAPH') {
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(-10, -4, 4, 0, Math.PI * 2);
      ctx.arc(10, -4, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-10, -4, 3, 0, Math.PI * 2);
      ctx.arc(10, -4, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Status warning text banner
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    if (this.sentry.state === 'STARING') {
      ctx.fillStyle = '#EF4444';
      ctx.fillText('GARGOYLE STARE! TURN TO STONE!!', 0, 36);
    } else if (this.sentry.state === 'TELEGRAPH') {
      ctx.fillStyle = '#F59E0B';
      ctx.fillText('⚡ EYES GLOWING... FREEZE! ⚡', 0, 36);
    } else {
      ctx.fillStyle = '#10B981';
      ctx.fillText('Gargoyle Asleep — Climb Rooftop!', 0, 36);
    }
    ctx.restore();

    // 3. Golden Cathedral Bell Target
    ctx.save();
    ctx.translate(this.bellX, this.bellY);
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(0, -4, 16, Math.PI, 0, false);
    ctx.lineTo(18, 12);
    ctx.lineTo(-18, 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#78350F';
    ctx.font = '700 8px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BELL', 0, 8);
    ctx.restore();

    // 4. Draw Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Player circle body (turns stone grey when frozen!)
      const isStone = this.sentry.state === 'STARING' && !ps.isMoving;
      ctx.fillStyle = isStone ? '#64748B' : p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isStone ? '#94A3B8' : '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y - 20);
    }

    // 5. Header HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps) return;

    // React to gargoyle
    if (this.sentry.state === 'STARING' || (this.sentry.state === 'TELEGRAPH' && difficulty !== 'bot_easy')) {
      // Freeze into stone!
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // Steer towards cathedral bell
    const dx = this.bellX - ps.x;
    const dy = this.bellY - ps.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 8) {
      const err = difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.2 : 0.45;
      const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * err;
      this.input.setBotInput(botId, true, Math.cos(angle), -Math.sin(angle), true);
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
      mvpHighlight: winnerId ? `${winnerId} turned to stone and chimed the cathedral rooftop bell!` : 'Tied gargoyle stare!'
    };
  }
}
