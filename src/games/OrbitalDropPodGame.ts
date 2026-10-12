import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface DropPodPilot {
  id: PlayerId;
  laneX: number;
  podY: number;
  fallSpeed: number;
  shieldHeat: number; // 0 to 100
  retroBurnAnim: number;
  score: number;
  combo: number;
  overheatTimer: number;
  touchdownTimer: number;
}

export class OrbitalDropPodGame extends BaseGame {
  public pods: Map<PlayerId, DropPodPilot> = new Map();
  public currentMapName: string = 'Orbital Insertion Corridor';
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
    this.pods.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    active.forEach((p, idx) => {
      const cx = idx * colWidth + colWidth * 0.5;
      this.pods.set(p.id, {
        id: p.id,
        laneX: cx,
        podY: 100,
        fallSpeed: 210,
        shieldHeat: 25,
        retroBurnAnim: 0,
        score: 0,
        combo: 0,
        overheatTimer: 0,
        touchdownTimer: 0,
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

    this.pods.forEach((pod) => {
      const p = this.getPlayer(pod.id);

      if (pod.overheatTimer > 0) pod.overheatTimer -= dt;
      if (pod.retroBurnAnim > 0) pod.retroBurnAnim = Math.max(0, pod.retroBurnAnim - dt * 4);

      // Natural re-entry acceleration & heat buildup
      pod.fallSpeed = Math.min(340, pod.fallSpeed + 75 * dt);
      pod.shieldHeat = Math.min(100, pod.shieldHeat + (pod.fallSpeed / 7) * dt);

      // Human input: retro-thruster burn
      if (p && !p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(pod.id) || this.input.justAction(pod.id);
        if (justPressed && pod.overheatTimer <= 0) {
          this.burnRetro(pod);
        }
      }

      // Check thermal sweet spot (40% to 75% heat)
      if (pod.shieldHeat >= 40 && pod.shieldHeat <= 75) {
        pod.score += 15 * dt;
      }

      // Overheat breach
      if (pod.shieldHeat >= 100 && pod.overheatTimer <= 0) {
        pod.overheatTimer = 1.0;
        pod.shieldHeat = 70;
        pod.combo = 0;
        pod.score = Math.max(0, pod.score - 25);
        this.audio.playTone(110, 0.35, 'sawtooth');
        this.particles.emit(pod.laneX, pod.podY, 20, '#e74c3c');
      }

      // Touchdown cycle near bottom of screen
      pod.podY = 120 + ((35 - this.roundTimer) / 35) * (height - 240);
    });
  }

  private burnRetro(pod: DropPodPilot): void {
    pod.retroBurnAnim = 1.0;
    pod.fallSpeed = Math.max(120, pod.fallSpeed - 85);
    pod.shieldHeat = Math.max(15, pod.shieldHeat - 22); // active cooling thruster

    if (pod.shieldHeat >= 35 && pod.shieldHeat <= 70) {
      // Clean thermal regulation
      pod.score += 20 + pod.combo * 2;
      pod.combo++;
      this.audio.playTone(660 + pod.combo * 25, 0.1, 'sine');
      this.particles.emit(pod.laneX, pod.podY + 24, 14, '#00e5ff');
    } else {
      this.audio.playTone(280, 0.08, 'triangle');
      this.particles.emit(pod.laneX, pod.podY + 24, 8, '#f39c12');
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const pod = this.pods.get(botId);
    if (!pod || pod.overheatTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      const threshold = difficulty === 'bot_hard' ? 68 : difficulty === 'bot_normal' ? 74 : 82;
      if (pod.shieldHeat > threshold) {
        this.burnRetro(pod);
        bTimer = difficulty === 'bot_hard' ? 0.3 : 0.45;
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Fiery atmospheric re-entry gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0a0d18');
    bgGrad.addColorStop(0.3, '#1a1829');
    bgGrad.addColorStop(0.7, '#4a1512');
    bgGrad.addColorStop(1, '#641e16');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Streaking re-entry plasma flames
    ctx.strokeStyle = 'rgba(243, 156, 18, 0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const px = ((Date.now() * 0.1 + i * 45) % width);
      const py = ((Date.now() * 0.7 + i * 50) % height);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py + 40);
      ctx.stroke();
    }

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    this.pods.forEach((pod, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#e74c3c';

      // Drop corridor boundary
      ctx.strokeStyle = 'rgba(231, 76, 60, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pod.laneX - colWidth * 0.5 + 4, 60, colWidth - 8, height - 70);

      // Re-entry Drop Pod
      ctx.save();
      ctx.translate(pod.laneX, pod.podY);

      if (pod.overheatTimer > 0) {
        ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
      }

      // Conical Pod Body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(16, 14);
      ctx.lineTo(-16, 14);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Ablative Curved Heat Shield at bottom
      const shieldGlow = pod.shieldHeat > 75 ? '#ff1744' : (pod.shieldHeat > 40 ? '#f39c12' : '#7f8c8d');
      ctx.fillStyle = shieldGlow;
      ctx.beginPath();
      ctx.ellipse(0, 15, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Retro Thruster Flame burst
      if (pod.retroBurnAnim > 0) {
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.moveTo(-10, 18);
        ctx.lineTo(0, 36);
        ctx.lineTo(10, 18);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();

      // Heat Meter Thermometer Bar
      const barW = 54;
      const barH = 7;
      const barX = pod.laneX - barW / 2;
      const barY = pod.podY - 35;

      ctx.fillStyle = '#1c2833';
      ctx.fillRect(barX, barY, barW, barH);

      // Green safe zone
      ctx.fillStyle = 'rgba(0, 230, 118, 0.35)';
      ctx.fillRect(barX + barW * 0.4, barY, barW * 0.35, barH);

      // Heat fill
      ctx.fillStyle = pod.shieldHeat > 75 ? '#ff1744' : (pod.shieldHeat >= 40 ? '#00e676' : '#3498db');
      ctx.fillRect(barX, barY, (barW * pod.shieldHeat) / 100, barH);

      // Score HUD
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${Math.floor(pod.score)}`, pod.laneX, height * 0.88);
      if (pod.combo > 1) {
        ctx.fillStyle = '#00e676';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${pod.combo}x STABLE DESCENT`, pod.laneX, height * 0.92);
      }
    });

    // Top instruction pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('☄️ TAP RETRO-THRUSTERS TO COOL HEAT SHIELD IN GREEN!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.pods.forEach((pod, pId) => scores.set(pId, Math.floor(pod.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.pods.entries())
      .map(([playerId, pod]) => ({ playerId, score: Math.floor(pod.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} performed a textbook atmospheric insertion!` : 'Drop pods incinerated in re-entry!',
    };
  }
}
