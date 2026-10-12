import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Jellyfish {
  id: number;
  x: number;
  y: number;
  radius: number;
  vy: number;
  oscillationPhase: number;
  oscillationSpeed: number;
  color: string;
}

interface JumperDiver {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  highestAltitude: number;
  score: number;
  isGrounded: boolean;
  bounceAnim: number;
}

export class JellyfishJumpGame extends BaseGame {
  private divers: Map<PlayerId, JumperDiver> = new Map();
  private jellies: Jellyfish[] = [];
  private jellyIdCounter: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private cameraY: number = 0;
  private targetCameraY: number = 0;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.divers.clear();
    this.jellies = [];
    this.cameraY = 0;
    this.targetCameraY = 0;

    // Generate ascending column of floating jellyfish
    const colors = ['#E040FB', '#00E5FF', '#76FF03', '#FFD700', '#FF4081'];
    for (let y = height * 0.75; y > -height * 4; y -= 75 + Math.random() * 30) {
      this.jellies.push({
        id: ++this.jellyIdCounter,
        x: width * 0.15 + Math.random() * (width * 0.7),
        y,
        radius: 24 + Math.random() * 12,
        vy: -15 - Math.random() * 20,
        oscillationPhase: Math.random() * Math.PI * 2,
        oscillationSpeed: 2 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const startX = width * 0.2 + (idx / Math.max(1, active.length - 1)) * (width * 0.6);
      this.divers.set(p.id, {
        id: p.id,
        x: startX,
        y: height * 0.82,
        vx: 0,
        vy: -320, // initial launch jump
        highestAltitude: 0,
        score: 0,
        isGrounded: false,
        bounceAnim: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    this.updateBots(dt, width, height);

    // Update floating jellyfish
    for (const j of this.jellies) {
      j.oscillationPhase += dt * j.oscillationSpeed;
      j.x += Math.sin(j.oscillationPhase) * dt * 25;
      j.y += j.vy * dt;
    }

    const active = this.getActivePlayers();

    for (const p of active) {
      const d = this.divers.get(p.id);
      if (!d) continue;

      if (d.bounceAnim > 0) d.bounceAnim -= dt * 4;

      // Horizontal steer
      const steer = this.input.getSteer(p.id);
      d.vx = steer * 220;

      // Gravity
      d.vy += 650 * dt;

      d.x += d.vx * dt;
      d.y += d.vy * dt;

      // Screen horizontal wrap
      if (d.x < 15) d.x = width - 15;
      else if (d.x > width - 15) d.x = 15;

      // Floor bounce safety
      if (d.y > height * 0.88) {
        d.y = height * 0.88;
        d.vy = -380;
        this.audio.playBounce();
        this.particles.emit(d.x, d.y, 4, '#81D4FA');
      }

      // Check collision with jellyfish tops (when descending)
      if (d.vy > 0) {
        for (const j of this.jellies) {
          const dx = d.x - j.x;
          const dy = d.y - j.y;
          // Landed near bell cap
          if (Math.abs(dx) < j.radius * 1.1 && dy > -8 && dy < 16) {
            d.vy = -480; // High super-bounce!
            d.bounceAnim = 1.0;
            this.audio.playBounce();
            this.particles.emit(j.x, j.y, 8, j.color);

            // Altitude score
            const currentAlt = Math.max(0, Math.floor((height * 0.88 - d.y) / 10));
            if (currentAlt > d.highestAltitude) {
              const diff = currentAlt - d.highestAltitude;
              d.highestAltitude = currentAlt;
              d.score += diff;
            }
            break;
          }
        }
      }
    }

    // Camera tracks highest diver smoothly
    let highestY = height * 0.88;
    for (const d of this.divers.values()) {
      if (d.y < highestY) highestY = d.y;
    }
    this.targetCameraY = Math.max(0, (height * 0.5) - highestY);
    this.cameraY += (this.targetCameraY - this.cameraY) * Math.min(1.0, dt * 4);

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const d = this.divers.get(botId);
    if (!d) return;

    // Find best jellyfish directly beneath or near diver trajectory
    let bestJelly: Jellyfish | null = null;
    let minDy = Infinity;

    for (const j of this.jellies) {
      const dy = j.y - d.y;
      if (dy > 0 && dy < 250) {
        if (dy < minDy) {
          minDy = dy;
          bestJelly = j;
        }
      }
    }

    let steer = 0;
    let delay = 0.25;

    if (bestJelly) {
      const dx = bestJelly.x - d.x;
      if (Math.abs(dx) > 10) {
        steer = dx > 0 ? 1 : -1;
      }

      if (difficulty === 'bot_easy') {
        delay = 0.45;
        if (Math.random() < 0.25) steer = -steer;
      } else if (difficulty === 'bot_hard') {
        delay = 0.10;
      }
    }

    this.input.setBotInput(botId, false, steer, 0, false);
    this.botReactionTimers.set(botId, delay);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Oceanic abyss vertical gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#000B18');
    grad.addColorStop(1, '#002B49');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(0, this.cameraY);

    // Render jellyfish
    for (const j of this.jellies) {
      // Don't render offscreen
      if (j.y + this.cameraY < -50 || j.y + this.cameraY > height + 50) continue;

      ctx.save();
      ctx.translate(j.x, j.y);

      // Bioluminescent bell dome
      ctx.fillStyle = j.color;
      ctx.beginPath();
      ctx.arc(0, 0, j.radius, Math.PI, 0);
      ctx.closePath();
      ctx.fill();

      // Tentacles
      ctx.strokeStyle = j.color;
      ctx.lineWidth = 1.8;
      for (let t = -j.radius * 0.7; t <= j.radius * 0.7; t += 7) {
        ctx.beginPath();
        ctx.moveTo(t, 0);
        const wave = Math.sin(j.oscillationPhase + t) * 6;
        ctx.quadraticCurveTo(t + wave, 14, t, 28);
        ctx.stroke();
      }

      ctx.restore();
    }

    // Render divers
    for (const [id, d] of this.divers.entries()) {
      const p = this.players.find(pl => pl.id === id);
      const color = p ? p.color : '#FF1744';

      ctx.save();
      ctx.translate(d.x, d.y);

      // Scuba diver body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, -6, 9, 0, Math.PI * 2);
      ctx.fill();

      // Mask visor
      ctx.fillStyle = '#00E5FF';
      ctx.beginPath();
      ctx.ellipse(3, -6, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Oxygen tank on back
      ctx.fillStyle = '#78909C';
      ctx.fillRect(-12, -10, 5, 12);

      // Flipper feet
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-4, 4);
      ctx.lineTo(-7, 14);
      ctx.lineTo(-2, 14);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();

    // HUD Leaderboard & Altitude
    let rankY = 28;
    for (const p of this.getActivePlayers()) {
      const d = this.divers.get(p.id);
      if (!d) continue;
      ctx.fillStyle = p.color;
      ctx.font = 'bold 13px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${p.name}: ${d.score}m`, 20, rankY);
      rankY += 20;
    }

    // Timer
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(this.roundTimer)}s`, width / 2, 32);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const d = this.divers.get(p.id);
      return {
        playerId: p.id,
        score: d ? d.score : 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `Player ${winnerId + 1} reached the highest jellyfish peak!` : 'The divers washed ashore!'
    };
  }
}
