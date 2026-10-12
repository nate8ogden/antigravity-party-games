import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface WalrusBasker {
  id: PlayerId;
  x: number;
  y: number;
  angle: number; // facing direction
  bumpAnim: number;
  score: number;
  combo: number;
  knockbackVx: number;
  knockbackVy: number;
  inWaterTimer: number;
}

export class WalrusBaskGame extends BaseGame {
  public walruses: Map<PlayerId, WalrusBasker> = new Map();
  public currentMapName: string = 'Svalbard Drifting Floe';
  private floeRadius: number = 160;
  private orcaAngle: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 35.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 35.0;
    this.walruses.clear();
    this.botReactionTimers.clear();

    const cx = width / 2;
    const cy = height / 2 + 10;
    this.floeRadius = Math.min(width, height) * 0.38;

    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      const a = (idx / count) * Math.PI * 2;
      const dist = this.floeRadius * 0.5;
      this.walruses.set(p.id, {
        id: p.id,
        x: cx + Math.cos(a) * dist,
        y: cy + Math.sin(a) * dist,
        angle: a + Math.PI, // facing center
        bumpAnim: 0,
        score: 0,
        combo: 0,
        knockbackVx: 0,
        knockbackVy: 0,
        inWaterTimer: 0,
      });
      this.botReactionTimers.set(p.id, 0);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      return;
    }

    this.updateBots(dt, width, height);

    const cx = width / 2;
    const cy = height / 2 + 10;
    this.orcaAngle = (this.orcaAngle + dt * 0.9) % (Math.PI * 2);

    this.walruses.forEach((w) => {
      const p = this.getPlayer(w.id);

      if (w.inWaterTimer > 0) {
        w.inWaterTimer -= dt;
        if (w.inWaterTimer <= 0) {
          // Respawn back on ice
          w.x = cx + (Math.random() - 0.5) * 40;
          w.y = cy + (Math.random() - 0.5) * 40;
          w.knockbackVx = 0;
          w.knockbackVy = 0;
        }
        return;
      }

      if (w.bumpAnim > 0) w.bumpAnim = Math.max(0, w.bumpAnim - dt * 4);

      // Rotate continuously to aim tusk bump
      w.angle = (w.angle + dt * 2.4) % (Math.PI * 2);

      // Human input: belly tusk shove
      if (p && !p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(w.id) || this.input.justAction(w.id);
        if (justPressed) {
          this.executeBump(w);
        }
      }

      // Apply knockback momentum
      w.x += w.knockbackVx * dt;
      w.y += w.knockbackVy * dt;
      w.knockbackVx *= Math.pow(0.1, dt);
      w.knockbackVy *= Math.pow(0.1, dt);

      // Center warmth scoring
      const distFromCenter = Math.hypot(w.x - cx, w.y - cy);
      if (distFromCenter < this.floeRadius * 0.4) {
        w.score += 8 * dt;
      }

      // Check if pushed off ice floe into water
      if (distFromCenter > this.floeRadius) {
        w.inWaterTimer = 1.2;
        w.combo = 0;
        w.score = Math.max(0, w.score - 20);
        this.audio.playTone(110, 0.3, 'sawtooth');
        this.particles.emit(w.x, w.y, 18, '#3498db');
      }
    });
  }

  private executeBump(w: WalrusBasker): void {
    w.bumpAnim = 1.0;
    this.audio.playTone(320, 0.08, 'triangle');

    // Check hit against other walruses
    this.walruses.forEach((other) => {
      if (other.id === w.id || other.inWaterTimer > 0) return;

      const dx = other.x - w.x;
      const dy = other.y - w.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 46) {
        // TUSK BUMP HIT!
        const pushAngle = Math.atan2(dy, dx);
        other.knockbackVx = Math.cos(pushAngle) * 360;
        other.knockbackVy = Math.sin(pushAngle) * 360;

        w.score += 25 + w.combo * 3;
        w.combo++;
        this.audio.playTone(620, 0.1, 'sine');
        this.particles.emit((w.x + other.x) / 2, (w.y + other.y) / 2, 12, '#ffffff');
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const w = this.walruses.get(botId);
    if (!w || w.inWaterTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      // Find nearby walrus in facing arc
      let foundTarget = false;
      this.walruses.forEach((other) => {
        if (other.id === botId || other.inWaterTimer > 0) return;
        const dx = other.x - w.x;
        const dy = other.y - w.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 55) {
          const targetAngle = Math.atan2(dy, dx);
          let diff = Math.abs(w.angle - targetAngle);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;

          const tolerance = difficulty === 'bot_hard' ? 0.45 : difficulty === 'bot_normal' ? 0.35 : 0.22;
          if (diff < tolerance) {
            this.executeBump(w);
            foundTarget = true;
          }
        }
      });

      bTimer = foundTarget ? 0.5 : 0.2;
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2 + 10;

    // Arctic ocean deep water background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0a192f');
    bgGrad.addColorStop(0.5, '#0f334c');
    bgGrad.addColorStop(1, '#081724');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Swimming Orca (Dorsal Fin circling the floe)
    const orcaDist = this.floeRadius + 35;
    const ox = cx + Math.cos(this.orcaAngle) * orcaDist;
    const oy = cy + Math.sin(this.orcaAngle) * orcaDist;
    ctx.fillStyle = '#17202a';
    ctx.beginPath();
    ctx.ellipse(ox, oy, 14, 6, this.orcaAngle, 0, Math.PI * 2);
    ctx.fill();
    // Tall black dorsal fin
    ctx.beginPath();
    ctx.moveTo(ox, oy - 2);
    ctx.lineTo(ox - Math.sin(this.orcaAngle) * 14, oy + Math.cos(this.orcaAngle) * 14);
    ctx.lineTo(ox, oy + 4);
    ctx.fill();

    // Drifting White Ice Floe
    ctx.fillStyle = '#ebf5fb';
    ctx.beginPath();
    ctx.arc(cx, cy, this.floeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#aed6f1';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Warm Sunbathing Center Zone
    ctx.fillStyle = 'rgba(241, 196, 15, 0.2)';
    ctx.beginPath();
    ctx.arc(cx, cy, this.floeRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Walruses
    this.walruses.forEach((w, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#8d6e63';

      if (w.inWaterTimer > 0) return; // in water splash

      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.rotate(w.angle);

      // Walrus Round Brown Body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4e342e';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Flippers
      ctx.fillStyle = '#6d4c41';
      ctx.beginPath();
      ctx.ellipse(-12, -10, 6, 3, 0.4, 0, Math.PI * 2);
      ctx.ellipse(-12, 10, 6, 3, -0.4, 0, Math.PI * 2);
      ctx.fill();

      // White Ivory Tusks protruding forward
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(14, -6, 10, 3);
      ctx.fillRect(14, 3, 10, 3);

      // Bump shockwave animation
      if (w.bumpAnim > 0) {
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(16, 0, 16 * (1 - w.bumpAnim + 0.3), -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
      }

      ctx.restore();

      // Score
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${Math.floor(w.score)}`, w.x, w.y - 20);
    });

    // Top instruction pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🦭 TAP TO TUSK SHOVE RIVALS OFF THE ICE FLOE!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.walruses.forEach((w, pId) => scores.set(pId, Math.floor(w.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.walruses.entries())
      .map(([playerId, w]) => ({ playerId, score: Math.floor(w.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} reigned as king of the walrus ice floe!` : 'All walruses knocked into the freezing sea!',
    };
  }
}
