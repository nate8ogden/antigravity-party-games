import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface MatrixPad {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  glowColor: string;
  flashTimer: number; // 0..1
  freq: number;
}

interface PlayerMemoryState {
  id: PlayerId;
  cursorIndex: number;
  cursorCycleTimer: number;
  manualSteerCooldown: number;
  pointerAngle: number;
  stepIndex: number;
  currentScore: number;
  strikes: number;
  isEliminated: boolean;
  hasFinishedSequence: boolean;
  botReactionTimer: number;
  feedbackFlash: 'CORRECT' | 'ERROR' | null;
  feedbackTimer: number;
}

export class MemoryMatrixGame extends BaseGame {
  private pads: MatrixPad[] = [];
  private playerStates: Map<PlayerId, PlayerMemoryState> = new Map();
  private sequence: number[] = [];
  private sequenceStep: number = 0;
  private phase: 'PLAYBACK' | 'INPUT' | 'ROUND_SUCCESS' = 'PLAYBACK';
  private playbackTimer: number = 0;
  private playbackInterval: number = 0.55;
  private currentRoundNumber: number = 1;
  private currentMapName: string = 'Neon Synth Stage';

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.roundTimer = 60.0;
    this.isFinished = false;
    this.currentRoundNumber = 1;
    this.phase = 'PLAYBACK';
    this.playbackTimer = 0.8;
    this.sequenceStep = 0;

    const stages = ['Neon Synth Stage', 'Cyber Cathedral', '8-Bit Pulse Arena', 'Prism Frequency'];
    this.currentMapName = stages[Math.floor(Math.random() * stages.length)];

    this.playerStates.clear();
    const active = this.getActivePlayers();
    active.forEach((p) => {
      this.playerStates.set(p.id, {
        id: p.id,
        cursorIndex: 0,
        cursorCycleTimer: 0,
        manualSteerCooldown: 0,
        pointerAngle: 0,
        stepIndex: 0,
        currentScore: 0,
        strikes: 0,
        isEliminated: false,
        hasFinishedSequence: false,
        botReactionTimer: 0.3 + Math.random() * 0.2,
        feedbackFlash: null,
        feedbackTimer: 0
      });
    });

    this.setupMatrix(width, height);
    this.generateNewSequence(3);
  }

  private setupMatrix(width: number, height: number): void {
    this.pads = [];
    const cols = 3;
    const rows = 3;
    const padSize = Math.min(width * 0.11, height * 0.15, 84);
    const gap = 14;
    const totalW = cols * padSize + (cols - 1) * gap;
    const totalH = rows * padSize + (rows - 1) * gap;
    const startX = width / 2 - totalW / 2;
    const startY = height / 2 - totalH / 2 + 15;

    const padColors = [
      { color: '#EF4444', glow: 'rgba(239, 68, 68, 0.8)', freq: 261.63 }, // C4
      { color: '#F59E0B', glow: 'rgba(245, 158, 11, 0.8)', freq: 293.66 }, // D4
      { color: '#10B981', glow: 'rgba(16, 185, 129, 0.8)', freq: 329.63 }, // E4
      { color: '#06B6D4', glow: 'rgba(6, 182, 212, 0.8)', freq: 392.00 }, // G4
      { color: '#3B82F6', glow: 'rgba(59, 130, 246, 0.8)', freq: 440.00 }, // A4
      { color: '#8B5CF6', glow: 'rgba(139, 92, 246, 0.8)', freq: 523.25 }, // C5
      { color: '#EC4899', glow: 'rgba(236, 72, 153, 0.8)', freq: 587.33 }, // D5
      { color: '#F97316', glow: 'rgba(249, 115, 22, 0.8)', freq: 659.25 }, // E5
      { color: '#14B8A6', glow: 'rgba(20, 184, 166, 0.8)', freq: 783.99 }  // G5
    ];

    let id = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const colDef = padColors[id % padColors.length];
        this.pads.push({
          id,
          x: startX + c * (padSize + gap) + padSize / 2,
          y: startY + r * (padSize + gap) + padSize / 2,
          size: padSize,
          color: colDef.color,
          glowColor: colDef.glow,
          flashTimer: 0,
          freq: colDef.freq
        });
        id++;
      }
    }
  }

  private generateNewSequence(length: number): void {
    this.sequence = [];
    for (let i = 0; i < length; i++) {
      this.sequence.push(Math.floor(Math.random() * this.pads.length));
    }
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

    // Decay pad flash animations
    for (const pad of this.pads) {
      if (pad.flashTimer > 0) {
        pad.flashTimer = Math.max(0, pad.flashTimer - dt * 2.5);
      }
    }

    // Feedback flash decay
    for (const ps of this.playerStates.values()) {
      if (ps.feedbackTimer > 0) {
        ps.feedbackTimer = Math.max(0, ps.feedbackTimer - dt);
        if (ps.feedbackTimer === 0) ps.feedbackFlash = null;
      }
    }

    if (this.phase === 'PLAYBACK') {
      this.playbackTimer -= dt;
      if (this.playbackTimer <= 0) {
        if (this.sequenceStep < this.sequence.length) {
          const padIdx = this.sequence[this.sequenceStep];
          const pad = this.pads[padIdx];
          if (pad) {
            pad.flashTimer = 1.0;
            this.audio.playChime();
          }
          this.sequenceStep++;
          this.playbackTimer = this.playbackInterval;
        } else {
          // Playback finished, switch to INPUT phase
          this.phase = 'INPUT';
          for (const ps of this.playerStates.values()) {
            if (!ps.isEliminated) {
              ps.stepIndex = 0;
              ps.hasFinishedSequence = false;
            }
          }
        }
      }
      return;
    }

    if (this.phase === 'INPUT') {
      // Input navigation for each player across the 3x3 matrix
      for (const p of this.getActivePlayers()) {
        const ps = this.playerStates.get(p.id);
        if (!ps || ps.isEliminated || ps.hasFinishedSequence) continue;

        if (ps.manualSteerCooldown > 0) {
          ps.manualSteerCooldown -= dt;
        }

        // Human inputs
        if (!p.type.startsWith('bot_')) {
          const steer = this.input.getSteer(p.id);
          const throttle = this.input.getThrottle(p.id);
          const justPressed = this.input.justPressed(p.id) || this.input.justAction(p.id);

          let didManualMove = false;
          if (ps.manualSteerCooldown <= 0) {
            const curCol = ps.cursorIndex % 3;
            const curRow = Math.floor(ps.cursorIndex / 3);

            if (steer > 0.4) {
              const newCol = Math.min(2, curCol + 1);
              ps.cursorIndex = curRow * 3 + newCol;
              ps.manualSteerCooldown = 0.22;
              didManualMove = true;
              this.audio.playTap();
            } else if (steer < -0.4) {
              const newCol = Math.max(0, curCol - 1);
              ps.cursorIndex = curRow * 3 + newCol;
              ps.manualSteerCooldown = 0.22;
              didManualMove = true;
              this.audio.playTap();
            } else if (throttle > 0.4) {
              const newRow = Math.max(0, curRow - 1);
              ps.cursorIndex = newRow * 3 + curCol;
              ps.manualSteerCooldown = 0.22;
              didManualMove = true;
              this.audio.playTap();
            } else if (throttle < -0.4) {
              const newRow = Math.min(2, curRow + 1);
              ps.cursorIndex = newRow * 3 + curCol;
              ps.manualSteerCooldown = 0.22;
              didManualMove = true;
              this.audio.playTap();
            }
          }

          if (!didManualMove && ps.manualSteerCooldown <= 0) {
            // Auto-advance cursor rhythmically across pads (0..8) so 1-button touch can hit any pad!
            ps.cursorCycleTimer += dt;
            if (ps.cursorCycleTimer >= 0.5) {
              ps.cursorCycleTimer = 0;
              ps.cursorIndex = (ps.cursorIndex + 1) % this.pads.length;
            }
          }

          if (justPressed) {
            this.submitPlayerInput(ps.id, ps.cursorIndex);
          }
        }
      }

      // Update bot AI
      this.updateBots(dt, width, height);

      // Check if all non-eliminated players finished this sequence
      const activeUneliminated = Array.from(this.playerStates.values()).filter((p) => !p.isEliminated);
      if (activeUneliminated.length === 0) {
        this.isFinished = true;
        this.audio.playFanfare();
        return;
      }

      const allFinished = activeUneliminated.every((p) => p.hasFinishedSequence);
      if (allFinished) {
        this.phase = 'ROUND_SUCCESS';
        this.playbackTimer = 1.0;
        this.audio.playFanfare();
      }
    } else if (this.phase === 'ROUND_SUCCESS') {
      this.playbackTimer -= dt;
      if (this.playbackTimer <= 0) {
        // Advance to next round: lengthen sequence by 1
        this.currentRoundNumber++;
        this.sequence.push(Math.floor(Math.random() * this.pads.length));
        this.sequenceStep = 0;
        this.phase = 'PLAYBACK';
        this.playbackInterval = Math.max(0.28, 0.55 - this.currentRoundNumber * 0.03);
        this.playbackTimer = 0.6;
      }
    }

    // Check elimination win condition
    const survivors = Array.from(this.playerStates.values()).filter((p) => !p.isEliminated);
    if (survivors.length <= 1 && this.getActivePlayers().length > 1) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private submitPlayerInput(playerId: PlayerId, padIdx: number): void {
    const ps = this.playerStates.get(playerId);
    if (!ps || ps.isEliminated || ps.hasFinishedSequence) return;

    const pad = this.pads[padIdx];
    if (pad) {
      pad.flashTimer = 0.8;
      this.particles.emit(pad.x, pad.y, 8, pad.color);
    }

    const expectedPad = this.sequence[ps.stepIndex];

    if (padIdx === expectedPad) {
      // Correct!
      this.audio.playChime();
      ps.stepIndex++;
      ps.currentScore += 10 * this.currentRoundNumber;
      ps.feedbackFlash = 'CORRECT';
      ps.feedbackTimer = 0.3;

      if (ps.stepIndex >= this.sequence.length) {
        // Sequence completed successfully for this round!
        ps.hasFinishedSequence = true;
        this.audio.playFanfare();
      }
    } else {
      // Wrong pad!
      this.audio.playLaser();
      ps.strikes++;
      ps.feedbackFlash = 'ERROR';
      ps.feedbackTimer = 0.6;

      if (ps.strikes >= 3) {
        ps.isEliminated = true;
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const ps = this.playerStates.get(botId);
    if (!ps || ps.isEliminated || ps.hasFinishedSequence) return;

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    const delay =
      difficulty === 'bot_easy' ? 0.45 + Math.random() * 0.3 : difficulty === 'bot_normal' ? 0.28 + Math.random() * 0.15 : 0.12 + Math.random() * 0.08;
    ps.botReactionTimer = delay;

    const expected = this.sequence[ps.stepIndex];
    if (expected === undefined) return;

    let targetPad = expected;

    // Error injection on Easy/Normal
    if (difficulty === 'bot_easy' && this.currentRoundNumber >= 3 && Math.random() < 0.25) {
      targetPad = (expected + 1) % this.pads.length;
    } else if (difficulty === 'bot_normal' && this.currentRoundNumber >= 6 && Math.random() < 0.15) {
      targetPad = (expected + 1) % this.pads.length;
    }

    ps.cursorIndex = targetPad;
    this.submitPlayerInput(botId, targetPad);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Dark Neon Stage Background
    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(0, 0, width, height);

    // 2. Stage Header & Sequence Length
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`STAGE: ${this.currentMapName.toUpperCase()} • ROUND ${this.currentRoundNumber}`, width / 2, 28);

    ctx.fillStyle = this.phase === 'PLAYBACK' ? '#38BDF8' : '#F59E0B';
    ctx.font = 'bold 16px monospace';
    const statusText =
      this.phase === 'PLAYBACK'
        ? `MEMORIZE SEQUENCE (${this.sequence.length} NOTES)...`
        : this.phase === 'INPUT'
        ? 'REPEAT THE SEQUENCE!'
        : 'EXCELLENT! NEXT ROUND...';
    ctx.fillText(statusText, width / 2, 54);

    // 3. Matrix Pads
    for (const pad of this.pads) {
      ctx.save();
      ctx.translate(pad.x, pad.y);

      // Glow backdrop when flashing
      if (pad.flashTimer > 0) {
        ctx.fillStyle = pad.glowColor;
        ctx.beginPath();
        ctx.arc(0, 0, pad.size * 0.75, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pad Frame
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-pad.size / 2, -pad.size / 2, pad.size, pad.size, 10);
      else ctx.rect(-pad.size / 2, -pad.size / 2, pad.size, pad.size);
      ctx.fill();

      // Pad Inner Face
      const alpha = 0.35 + pad.flashTimer * 0.65;
      ctx.fillStyle = pad.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-pad.size / 2 + 4, -pad.size / 2 + 4, pad.size - 8, pad.size - 8, 8);
      else ctx.rect(-pad.size / 2 + 4, -pad.size / 2 + 4, pad.size - 8, pad.size - 8);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Note Icon / Number
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${pad.id + 1}`, 0, 0);

      ctx.restore();
    }

    // 4. Target Indicators for Active Players during Input
    if (this.phase === 'INPUT') {
      for (const p of this.getActivePlayers()) {
        const ps = this.playerStates.get(p.id);
        if (!ps || ps.isEliminated || ps.hasFinishedSequence) continue;

        const pad = this.pads[ps.cursorIndex];
        if (!pad) continue;

        const s = pad.size / 2 + 5;
        ctx.save();
        ctx.translate(pad.x, pad.y);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;

        // Corner targeting reticles
        const bLen = 12;
        // Top-left
        ctx.beginPath();
        ctx.moveTo(-s, -s + bLen); ctx.lineTo(-s, -s); ctx.lineTo(-s + bLen, -s);
        ctx.stroke();
        // Top-right
        ctx.beginPath();
        ctx.moveTo(s - bLen, -s); ctx.lineTo(s, -s); ctx.lineTo(s, -s + bLen);
        ctx.stroke();
        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(-s, s - bLen); ctx.lineTo(-s, s); ctx.lineTo(-s + bLen, s);
        ctx.stroke();
        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(s - bLen, s); ctx.lineTo(s, s); ctx.lineTo(s, s - bLen);
        ctx.stroke();

        // Player Tag
        ctx.fillStyle = p.color;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`P${p.id + 1}`, 0, s + 13);

        ctx.restore();
      }
    }

    // 5. Corner Player Podiums
    for (const p of this.getActivePlayers()) {
      const ps = this.playerStates.get(p.id);
      if (!ps) continue;

      let px = 20;
      let py = 20;
      if (p.corner === 'top-right') px = width - 170;
      else if (p.corner === 'bottom-left') py = height - 100;
      else if (p.corner === 'bottom-right') {
        px = width - 170;
        py = height - 100;
      }

      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeStyle = ps.isEliminated ? '#64748B' : p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, py, 150, 80, 8);
      else ctx.rect(px, py, 150, 80);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = ps.isEliminated ? '#94A3B8' : p.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, px + 10, py + 20);

      // Score / Progress
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 15px monospace';
      const status = ps.isEliminated
        ? 'ELIMINATED'
        : ps.hasFinishedSequence
        ? 'DONE! ✓'
        : `Step ${ps.stepIndex}/${this.sequence.length}`;
      ctx.fillText(status, px + 10, py + 42);

      // Strikes (X X X)
      ctx.font = 'bold 13px sans-serif';
      for (let s = 0; s < 3; s++) {
        ctx.fillStyle = s < ps.strikes ? '#EF4444' : '#475569';
        ctx.fillText('✖', px + 10 + s * 16, py + 64);
      }

      // Feedback flash
      if (ps.feedbackFlash) {
        ctx.fillStyle = ps.feedbackFlash === 'CORRECT' ? '#10B981' : '#EF4444';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(ps.feedbackFlash, px + 75, py + 64);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const sorted = [...active].sort((a, b) => {
      const sa = this.playerStates.get(a.id);
      const sb = this.playerStates.get(b.id);
      if (!sa || !sb) return 0;
      if (sa.isEliminated !== sb.isEliminated) {
        return sa.isEliminated ? 1 : -1;
      }
      return sb.currentScore - sa.currentScore;
    });

    const winnerId = sorted.length > 0 ? sorted[0].id : null;
    const topScore = this.playerStates.get(winnerId ?? 0)?.currentScore || 0;

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      score: this.playerStates.get(p.id)?.currentScore || 0,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: `Masterful memory! Reached Round ${this.currentRoundNumber} with ${topScore} pts on ${this.currentMapName}!`
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }
}
