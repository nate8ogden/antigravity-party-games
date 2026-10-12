import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface AndroidHolo {
  id: number;
  x: number;
  y: number;
  isGlitching: boolean;
  glitchTimer: number;
}

export class HologramGlitchGame extends BaseGame {
  public holos: AndroidHolo[] = [];
  public scores: Map<PlayerId, number> = new Map();
  public lockouts: Map<PlayerId, number> = new Map();
  public currentMapName: string = 'Cyber Security Terminal';
  private glitchCycleTimer: number = 2.0;
  private currentGlitchIndex: number = -1;
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
    this.scores.clear();
    this.lockouts.clear();
    this.botReactionTimers.clear();
    this.currentGlitchIndex = -1;
    this.glitchCycleTimer = 1.5;

    const cx = width * 0.5;
    const cy = height * 0.55;

    // 4 Hologram projection pedestals
    this.holos = [
      { id: 0, x: cx - 110, y: cy - 70, isGlitching: false, glitchTimer: 0 },
      { id: 1, x: cx + 110, y: cy - 70, isGlitching: false, glitchTimer: 0 },
      { id: 2, x: cx - 110, y: cy + 70, isGlitching: false, glitchTimer: 0 },
      { id: 3, x: cx + 110, y: cy + 70, isGlitching: false, glitchTimer: 0 }
    ];

    this.getActivePlayers().forEach(p => {
      this.scores.set(p.id, 0);
      this.lockouts.set(p.id, 0);
      this.botReactionTimers.set(p.id, 0.2 + Math.random() * 0.3);
    });
  }

  public update(dt: number, _w: number, _h: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.finishRound();
      return;
    }

    this.updateBots(dt, _w, _h);

    // Update lockouts
    this.lockouts.forEach((time, pid) => {
      if (time > 0) this.lockouts.set(pid, Math.max(0, time - dt));
    });

    // Update glitch cycle
    this.glitchCycleTimer -= dt;
    if (this.glitchCycleTimer <= 0) {
      if (this.currentGlitchIndex === -1) {
        // Trigger a glitch on one hologram!
        this.currentGlitchIndex = Math.floor(Math.random() * this.holos.length);
        this.holos[this.currentGlitchIndex].isGlitching = true;
        this.holos[this.currentGlitchIndex].glitchTimer = 1.6;
        this.glitchCycleTimer = 1.8;
        this.audio.playTone(420, 0.05, 'sawtooth');
      } else {
        // Glitch expired without being caught
        this.holos[this.currentGlitchIndex].isGlitching = false;
        this.currentGlitchIndex = -1;
        this.glitchCycleTimer = 1.0 + Math.random() * 1.5;
      }
    }

    // Check player inputs
    this.getActivePlayers().forEach(p => {
      const lock = this.lockouts.get(p.id) || 0;
      if (lock > 0) return;

      if (this.input.justPressed(p.id)) {
        if (this.currentGlitchIndex !== -1) {
          // Purged the glitch successfully!
          const curScore = this.scores.get(p.id) || 0;
          this.scores.set(p.id, curScore + 50);

          const h = this.holos[this.currentGlitchIndex];
          h.isGlitching = false;
          this.particles.emit(h.x, h.y, 16, '#00ffff');
          this.particles.emit(h.x, h.y, 8, '#ffd700');
          this.audio.playTone(720, 0.15, 'sine');

          this.currentGlitchIndex = -1;
          this.glitchCycleTimer = 1.2 + Math.random() * 1.2;
        } else {
          // False alarm!
          this.lockouts.set(p.id, 1.2);
          const curScore = this.scores.get(p.id) || 0;
          this.scores.set(p.id, Math.max(0, curScore - 15));
          this.audio.playTone(130, 0.25, 'sawtooth');
        }
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _w: number,
    _h: number
  ): void {
    const lock = this.lockouts.get(botId) || 0;
    if (lock > 0) return;

    let bTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botReactionTimers.set(botId, bTimer);
      return;
    }

    if (this.currentGlitchIndex !== -1) {
      const reactionDelay = difficulty === 'bot_hard' ? 0.15 : difficulty === 'bot_normal' ? 0.35 : 0.65;
      if (Math.random() < (difficulty === 'bot_hard' ? 0.95 : 0.75)) {
        this.input.triggerBotPress(botId);
        this.botReactionTimers.set(botId, reactionDelay + 0.5);
        return;
      }
    } else {
      // Occasional false trigger on easy bot
      if (difficulty === 'bot_easy' && Math.random() < 0.05) {
        this.input.triggerBotPress(botId);
        this.botReactionTimers.set(botId, 1.0);
        return;
      }
    }

    this.botReactionTimers.set(botId, 0.08);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Holographic Terminal Grid Background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#050712');
    grad.addColorStop(0.5, '#0c122b');
    grad.addColorStop(1, '#060917');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // HUD Instructions
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 170, 56, 340, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#ff007f';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAP FAST WHEN ANY HOLOGRAM GLITCHES! AVOID FALSE ALARMS!', width * 0.5, 69);
    ctx.restore();

    // Render 4 Holograms
    this.holos.forEach(h => {
      ctx.save();
      ctx.translate(h.x, h.y);

      // Pedestal
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.ellipse(0, 32, 28, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = h.isGlitching ? '#ff0055' : '#00e5ff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Hologram projection cone
      const coneGrad = ctx.createLinearGradient(0, 32, 0, -32);
      coneGrad.addColorStop(0, h.isGlitching ? 'rgba(255, 0, 85, 0.4)' : 'rgba(0, 229, 255, 0.3)');
      coneGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(-24, 32);
      ctx.lineTo(-12, -32);
      ctx.lineTo(12, -32);
      ctx.lineTo(24, 32);
      ctx.closePath();
      ctx.fill();

      // Android Avatar Figure
      const jitterX = h.isGlitching ? (Math.random() - 0.5) * 8 : 0;
      ctx.translate(jitterX, 0);

      ctx.fillStyle = h.isGlitching ? '#ff0077' : '#00ffff';
      ctx.shadowColor = h.isGlitching ? '#ff0055' : '#00ffff';
      ctx.shadowBlur = 10;

      // Body
      ctx.fillRect(-10, -10, 20, 26);
      // Head
      ctx.beginPath();
      ctx.arc(0, -20, 8, 0, Math.PI * 2);
      ctx.fill();
      // Visor
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-6, -22, 12, 3);

      // Scanline glitch lines
      if (h.isGlitching) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-16, -14);
        ctx.lineTo(16, -14);
        ctx.moveTo(-18, 4);
        ctx.lineTo(18, 4);
        ctx.stroke();
      }

      ctx.restore();
    });

    // Score Board at bottom
    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / Math.max(count, 1);

    active.forEach((p, idx) => {
      const px = idx * spacing + spacing * 0.5;
      const py = height - 35;
      const score = this.scores.get(p.id) || 0;
      const isLocked = (this.lockouts.get(p.id) || 0) > 0;

      ctx.fillStyle = isLocked ? '#ff3300' : (p.color || '#ffffff');
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${score} Pts ${isLocked ? '[LOCKED]' : ''}`, px, py);
    });
  }

  private finishRound(): void {
    this.isFinished = true;
  }

  public getScores(): Map<PlayerId, number> {
    return new Map(this.scores);
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.scores.entries())
      .map(([playerId, score]) => ({ playerId, score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} detected anomalous glitches with laser precision!` : 'Identity check failed!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
