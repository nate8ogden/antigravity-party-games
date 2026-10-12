import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface VaultTumbler {
  id: PlayerId;
  cx: number;
  cy: number;
  needleAngle: number;
  needleSpeed: number;
  targetAngle: number;
  targetArc: number; // width of sweet spot
  pinsUnlocked: number; // 0 to 3
  score: number;
  vaultsCracked: number;
  lockAnim: number;
  resetTimer: number;
}

export class PressureGaugeLockGame extends BaseGame {
  public tumblers: Map<PlayerId, VaultTumbler> = new Map();
  public currentMapName: string = 'Bank of England Clockwork Vault';
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
    this.tumblers.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      let cx = width * 0.25;
      let cy = height * 0.35;
      if (count === 2) {
        cx = idx === 0 ? width * 0.3 : width * 0.7;
        cy = height * 0.55;
      } else {
        if (idx === 1) cx = width * 0.75;
        if (idx === 2) { cx = width * 0.25; cy = height * 0.75; }
        if (idx === 3) { cx = width * 0.75; cy = height * 0.75; }
      }

      this.tumblers.set(p.id, {
        id: p.id,
        cx,
        cy,
        needleAngle: 0,
        needleSpeed: 2.4,
        targetAngle: Math.PI * 0.2 + Math.random() * (Math.PI * 1.6),
        targetArc: 0.42,
        pinsUnlocked: 0,
        score: 0,
        vaultsCracked: 0,
        lockAnim: 0,
        resetTimer: 0
      });

      this.botReactionTimers.set(p.id, 0.2 + Math.random() * 0.3);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.finishRound();
      return;
    }

    this.updateBots(dt, width, height);

    this.tumblers.forEach(t => {
      if (t.resetTimer > 0) t.resetTimer -= dt;
      if (t.lockAnim > 0) t.lockAnim -= dt * 3;

      // Needle rotates
      t.needleAngle += t.needleSpeed * dt;

      if (this.input.justPressed(t.id)) {
        this.attemptPinPick(t);
      }
    });
  }

  private attemptPinPick(t: VaultTumbler): void {
    if (t.resetTimer > 0) return;

    const normNeedle = ((t.needleAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const normTarget = ((t.targetAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    let diff = Math.abs(normNeedle - normTarget);
    diff = Math.min(diff, Math.PI * 2 - diff);

    if (diff < t.targetArc * 0.5) {
      // Pin Clicked!
      t.pinsUnlocked++;
      t.score += 25 * t.pinsUnlocked;
      t.lockAnim = 1.0;
      this.audio.playTone(380 + t.pinsUnlocked * 120, 0.1, 'triangle');
      this.particles.emit(t.cx, t.cy, 8, '#ffd700');

      if (t.pinsUnlocked >= 3) {
        // Vault Cracked!
        t.vaultsCracked++;
        t.score += 100;
        t.pinsUnlocked = 0;
        this.audio.playTone(680, 0.3, 'sine');
        this.particles.emit(t.cx, t.cy, 20, '#00ffcc');
      }

      // Next tumbler sweet spot
      t.targetAngle = Math.PI * 0.2 + Math.random() * (Math.PI * 1.6);
      t.targetArc = Math.max(0.24, 0.42 - t.pinsUnlocked * 0.06);
      t.needleSpeed = (t.needleSpeed > 0 ? -1 : 1) * (2.4 + t.pinsUnlocked * 0.8);
    } else {
      // Pin Reset Slip!
      t.resetTimer = 0.5;
      if (t.pinsUnlocked > 0) t.pinsUnlocked--;
      this.audio.playTone(140, 0.2, 'sawtooth');
      this.particles.emit(t.cx, t.cy, 10, '#ff4400');
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _w: number,
    _h: number
  ): void {
    const t = this.tumblers.get(botId);
    if (!t || t.resetTimer > 0) return;

    let bTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botReactionTimers.set(botId, bTimer);
      return;
    }

    const normNeedle = ((t.needleAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const normTarget = ((t.targetAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let diff = Math.abs(normNeedle - normTarget);
    diff = Math.min(diff, Math.PI * 2 - diff);

    const hitWindow = t.targetArc * 0.45;
    if (diff < hitWindow) {
      const accuracy = difficulty === 'bot_hard' ? 0.95 : difficulty === 'bot_normal' ? 0.78 : 0.50;
      if (Math.random() < accuracy) {
        this.attemptPinPick(t);
        this.botReactionTimers.set(botId, 0.4);
        return;
      }
    }

    this.botReactionTimers.set(botId, 0.06);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Steampunk Bank Vault Wall
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#12161b');
    grad.addColorStop(0.5, '#1e242b');
    grad.addColorStop(1, '#0e1215');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // HUD Instructions
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 170, 56, 340, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAP WHEN NEEDLE HITS GOLD SWEET SPOT TO SET PINS!', width * 0.5, 69);
    ctx.restore();

    // Render Vault Dials
    this.tumblers.forEach(t => {
      const cfg = this.players.find(p => p.id === t.id);
      const isResetting = t.resetTimer > 0;
      const radius = 48;

      ctx.save();
      ctx.translate(t.cx, t.cy);

      // Outer Dial Rim (Heavy Brass Plate)
      ctx.fillStyle = '#2c251d';
      ctx.beginPath();
      ctx.arc(0, 0, radius + 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isResetting ? '#ef4444' : (cfg?.color || '#d4af37');
      ctx.lineWidth = 4;
      ctx.stroke();

      // Dial Face
      ctx.fillStyle = '#0a0a0d';
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      // Sweet Spot Arc
      ctx.save();
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 8;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, radius - 6, t.targetAngle - t.targetArc * 0.5, t.targetAngle + t.targetArc * 0.5);
      ctx.stroke();
      ctx.restore();

      // Pin Indicators (3 pins around center)
      for (let p = 0; p < 3; p++) {
        const pinA = -Math.PI * 0.5 + (p - 1) * 0.6;
        const px = Math.cos(pinA) * 22;
        const py = Math.sin(pinA) * 22;
        ctx.fillStyle = p < t.pinsUnlocked ? '#2ecc71' : '#444444';
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Tumbler Needle
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(t.needleAngle) * (radius - 8), Math.sin(t.needleAngle) * (radius - 8));
      ctx.stroke();

      // Center Hub
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Label & Score
      ctx.fillStyle = cfg?.color || '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name || 'Player'}: ${t.score} Pts (${t.vaultsCracked} Cracked)`, t.cx, t.cy + radius + 30);
    });
  }

  private finishRound(): void {
    this.isFinished = true;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.tumblers.forEach((t, pId) => scores.set(pId, t.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.tumblers.entries())
      .map(([playerId, t]) => ({ playerId, score: t.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} cracked the clockwork bank vault!` : 'Vault pins held fast!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
