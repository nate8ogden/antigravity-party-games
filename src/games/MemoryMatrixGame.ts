import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type MatrixTheme = 'synth' | 'arcade' | 'cathedral';

interface ThemeConfig {
  id: MatrixTheme;
  name: string;
  badge: string;
  bgGradient: [string, string];
  boardBorder: string;
  padBaseColor: string;
  padRimColor: string;
  accentGlow: string;
  gridLineColor: string;
}

const THEME_CONFIGS: ThemeConfig[] = [
  {
    id: 'synth',
    name: 'Neon Synth',
    badge: '🎹 NEON SYNTH',
    bgGradient: ['#0B0F19', '#030712'],
    boardBorder: '#06B6D4',
    padBaseColor: '#1E293B',
    padRimColor: '#334155',
    accentGlow: '#EC4899',
    gridLineColor: 'rgba(6, 182, 212, 0.12)'
  },
  {
    id: 'arcade',
    name: 'Retro 8-Bit',
    badge: '🕹️ RETRO 8-BIT',
    bgGradient: ['#18181B', '#09090B'],
    boardBorder: '#F59E0B',
    padBaseColor: '#27272A',
    padRimColor: '#3F3F46',
    accentGlow: '#EF4444',
    gridLineColor: 'rgba(245, 158, 11, 0.12)'
  },
  {
    id: 'cathedral',
    name: 'Cyber Cathedral',
    badge: '⛪ CATHEDRAL',
    bgGradient: ['#0F0C29', '#050314'],
    boardBorder: '#8B5CF6',
    padBaseColor: '#1E1B4B',
    padRimColor: '#312E81',
    accentGlow: '#10B981',
    gridLineColor: 'rgba(139, 92, 246, 0.14)'
  }
];

interface MatrixPad {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  glowColor: string;
  flashTimer: number; // 0..1
  pressAnim: number; // 0..1
  freq: number;
}

interface PlayerMemoryState {
  id: PlayerId;
  cursorIndex: number;
  cursorCycleTimer: number;
  manualSteerCooldown: number;
  stepIndex: number;
  currentScore: number;
  strikes: number;
  isEliminated: boolean;
  hasFinishedSequence: boolean;
  botReactionTimer: number;
  feedbackFlash: 'CORRECT' | 'ERROR' | null;
  feedbackTimer: number;
  mood: CharacterMood;
  moodTimer: number;
  isUnderdog: boolean;
  glitchTimer: number;
  shieldUsed: boolean;
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
  public currentTheme: MatrixTheme = 'synth';
  private suddenDeathAnnounced: boolean = false;
  private animTimer: number = 0;
  private finishOrder: PlayerId[] = [];

  private lastWidth: number = 960;
  private lastHeight: number = 540;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.bindKeyboardShortcuts();
    this.bindCanvasPointer();
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 60.0;
    this.isFinished = false;
    this.currentRoundNumber = 1;
    this.phase = 'PLAYBACK';
    this.playbackTimer = 0.8;
    this.sequenceStep = 0;
    this.suddenDeathAnnounced = false;
    this.animTimer = 0;
    this.finishOrder = [];

    this.playerStates.clear();
    const active = this.getActivePlayers();
    active.forEach((p) => {
      this.playerStates.set(p.id, {
        id: p.id,
        cursorIndex: 0,
        cursorCycleTimer: 0,
        manualSteerCooldown: 0,
        stepIndex: 0,
        currentScore: 0,
        strikes: 0,
        isEliminated: false,
        hasFinishedSequence: false,
        botReactionTimer: 0.3 + Math.random() * 0.2,
        feedbackFlash: null,
        feedbackTimer: 0,
        mood: 'idle',
        moodTimer: 0,
        isUnderdog: false,
        glitchTimer: 0,
        shieldUsed: false
      });
    });

    this.setupMatrix(width, height);
    this.generateNewSequence(3);
    this.syncDebug();
  }

  public syncDebug(): void {
    if (typeof window !== 'undefined') {
      const self = this;
      (window as any).__MEMORY_MATRIX_DEBUG__ = {
        get players() { return Array.from(self.playerStates.values()); },
        get pads() { return self.pads; },
        get sequence() { return self.sequence; },
        get phase() { return self.phase; },
        get roundTimer() { return self.roundTimer; },
        get isFinished() { return self.isFinished; },
        get theme() { return self.currentTheme; },
        setTheme: (t: MatrixTheme) => self.setMatrixTheme(t),
        cycleTheme: () => self.cycleTheme(),
        submitInput: (pid: PlayerId, padIdx: number) => self.submitPlayerInput(pid, padIdx)
      };
    }
  }

  private bindKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;
    this.keydownListener = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === '1') {
        this.setMatrixTheme('synth');
      } else if (e.key === '2') {
        this.setMatrixTheme('arcade');
      } else if (e.key === '3') {
        this.setMatrixTheme('cathedral');
      }
    };
    window.addEventListener('keydown', this.keydownListener);
  }

  private bindCanvasPointer(): void {
    if (typeof window === 'undefined') return;
    const canvas = this.input.getCanvas();
    if (!canvas) return;

    this.boundPointerDown = (e: PointerEvent) => {
      this.handlePointerDown(e);
    };
    canvas.addEventListener('pointerdown', this.boundPointerDown);
  }

  private handlePointerDown(e: PointerEvent): void {
    const canvas = this.input.getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * this.lastWidth;
    const clickY = ((e.clientY - rect.top) / rect.height) * this.lastHeight;

    // Check Theme Pill click at (20, height - 44, 170, 32)
    if (
      clickX >= 20 &&
      clickX <= 190 &&
      clickY >= this.lastHeight - 44 &&
      clickY <= this.lastHeight - 12
    ) {
      this.cycleTheme();
    }
  }

  public cycleTheme(): void {
    const curIdx = THEME_CONFIGS.findIndex((t) => t.id === this.currentTheme);
    const nextIdx = (curIdx + 1) % THEME_CONFIGS.length;
    this.setMatrixTheme(THEME_CONFIGS[nextIdx].id);
  }

  public setMatrixTheme(theme: MatrixTheme): void {
    if (this.currentTheme === theme) return;
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnExplosion(100, this.lastHeight - 28, '#06B6D4', 12);
  }

  public destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownListener) {
        window.removeEventListener('keydown', this.keydownListener);
        this.keydownListener = null;
      }
      const canvas = this.input.getCanvas();
      if (canvas && this.boundPointerDown) {
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
        this.boundPointerDown = null;
      }
      delete (window as any).__MEMORY_MATRIX_DEBUG__;
    }
  }

  private setupMatrix(width: number, height: number): void {
    this.pads = [];
    const cols = 3;
    const rows = 3;
    const padSize = Math.min(width * 0.11, height * 0.15, 84);
    const gap = 16;
    const totalW = cols * padSize + (cols - 1) * gap;
    const totalH = rows * padSize + (rows - 1) * gap;
    const startX = width / 2 - totalW / 2;
    const startY = height / 2 - totalH / 2 + 18;

    const padColors = [
      { color: '#EF4444', glow: 'rgba(239, 68, 68, 0.85)', freq: 261.63 }, // C4
      { color: '#F59E0B', glow: 'rgba(245, 158, 11, 0.85)', freq: 293.66 }, // D4
      { color: '#10B981', glow: 'rgba(16, 185, 129, 0.85)', freq: 329.63 }, // E4
      { color: '#06B6D4', glow: 'rgba(6, 182, 212, 0.85)', freq: 392.00 }, // G4
      { color: '#3B82F6', glow: 'rgba(59, 130, 246, 0.85)', freq: 440.00 }, // A4
      { color: '#8B5CF6', glow: 'rgba(139, 92, 246, 0.85)', freq: 523.25 }, // C5
      { color: '#EC4899', glow: 'rgba(236, 72, 153, 0.85)', freq: 587.33 }, // D5
      { color: '#F97316', glow: 'rgba(249, 115, 22, 0.85)', freq: 659.25 }, // E5
      { color: '#14B8A6', glow: 'rgba(20, 184, 166, 0.85)', freq: 783.99 }  // G5
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
          pressAnim: 0,
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

    this.lastWidth = width;
    this.lastHeight = height;
    this.animTimer += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update Underdog status (highest strikes or trailing by >= 150 pts)
    this.updateUnderdogStatus();

    // Sudden Death Hyper-Beat at 15s remaining
    if (this.roundTimer <= 15 && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.playbackInterval = 0.25; // High speed synth arpeggios
      this.audio.playFanfare();
      this.particles.shake(0.35);
      this.particles.showFloatingText('HYPER-BEAT OVERDRIVE! ⚡ 2X PTS', width / 2, 78, '#EF4444', 24);
    }

    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    // Decay pad flash and press animations
    for (const pad of this.pads) {
      if (pad.flashTimer > 0) {
        pad.flashTimer = Math.max(0, pad.flashTimer - dt * 2.8);
      }
      if (pad.pressAnim > 0) {
        pad.pressAnim = Math.max(0, pad.pressAnim - dt * 4.5);
      }
    }

    // Feedback flash and glitch decay
    for (const ps of this.playerStates.values()) {
      if (ps.feedbackTimer > 0) {
        ps.feedbackTimer = Math.max(0, ps.feedbackTimer - dt);
        if (ps.feedbackTimer === 0) ps.feedbackFlash = null;
      }
      if (ps.moodTimer > 0) {
        ps.moodTimer = Math.max(0, ps.moodTimer - dt);
        if (ps.moodTimer <= 0) ps.mood = 'idle';
      }
      if (ps.glitchTimer > 0) {
        ps.glitchTimer = Math.max(0, ps.glitchTimer - dt);
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
            pad.pressAnim = 1.0;
            this.audio.playChime();
            this.particles.emit(pad.x, pad.y, 6, pad.color);
          }
          this.sequenceStep++;
          this.playbackTimer = this.playbackInterval;
        } else {
          // Playback finished, switch to INPUT phase
          this.phase = 'INPUT';
          this.finishOrder = [];
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
      // Input navigation for active players
      for (const p of this.getActivePlayers()) {
        const ps = this.playerStates.get(p.id);
        if (!ps || ps.isEliminated || ps.hasFinishedSequence) continue;

        if (ps.manualSteerCooldown > 0) {
          ps.manualSteerCooldown -= dt;
        }

        // Human inputs
        if (p.type === 'human') {
          const steer = this.input.getSteer(p.id);
          const throttle = this.input.getThrottle(p.id);
          const justPressed = this.input.justPressed(p.id) || this.input.justAction(p.id);

          let didManualMove = false;
          if (ps.manualSteerCooldown <= 0) {
            const curCol = ps.cursorIndex % 3;
            const curRow = Math.floor(ps.cursorIndex / 3);

            // Glitch inverter if affected by rival's sabotage
            const dirMultiplier = ps.glitchTimer > 0 ? -1 : 1;

            if (steer * dirMultiplier > 0.4) {
              const newCol = Math.min(2, curCol + 1);
              ps.cursorIndex = curRow * 3 + newCol;
              ps.manualSteerCooldown = 0.20;
              didManualMove = true;
              this.audio.playTap();
            } else if (steer * dirMultiplier < -0.4) {
              const newCol = Math.max(0, curCol - 1);
              ps.cursorIndex = curRow * 3 + newCol;
              ps.manualSteerCooldown = 0.20;
              didManualMove = true;
              this.audio.playTap();
            } else if (throttle * dirMultiplier > 0.4) {
              const newRow = Math.max(0, curRow - 1);
              ps.cursorIndex = newRow * 3 + curCol;
              ps.manualSteerCooldown = 0.20;
              didManualMove = true;
              this.audio.playTap();
            } else if (throttle * dirMultiplier < -0.4) {
              const newRow = Math.min(2, curRow + 1);
              ps.cursorIndex = newRow * 3 + curCol;
              ps.manualSteerCooldown = 0.20;
              didManualMove = true;
              this.audio.playTap();
            }
          }

          if (!didManualMove && ps.manualSteerCooldown <= 0) {
            // Auto-advance cursor rhythmically across pads (0..8) for effortless 1-touch play
            ps.cursorCycleTimer += dt;
            if (ps.cursorCycleTimer >= 0.45) {
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
        const baseInterval = this.roundTimer <= 15 ? 0.25 : 0.55;
        this.playbackInterval = Math.max(0.24, baseInterval - this.currentRoundNumber * 0.03);
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

  private updateUnderdogStatus(): void {
    const players = Array.from(this.playerStates.values());
    if (players.length < 2) return;

    let maxScore = -1;
    let maxStrikes = -1;
    for (const p of players) {
      if (p.currentScore > maxScore) maxScore = p.currentScore;
      if (p.strikes > maxStrikes) maxStrikes = p.strikes;
    }

    for (const p of players) {
      p.isUnderdog = (maxScore - p.currentScore >= 150) || (p.strikes === maxStrikes && maxStrikes >= 1);
    }
  }

  private submitPlayerInput(playerId: PlayerId, padIdx: number): void {
    const ps = this.playerStates.get(playerId);
    if (!ps || ps.isEliminated || ps.hasFinishedSequence) return;

    const pad = this.pads[padIdx];
    if (pad) {
      pad.flashTimer = 0.8;
      pad.pressAnim = 1.0;
      this.particles.emit(pad.x, pad.y, 8, pad.color);
    }

    const expectedPad = this.sequence[ps.stepIndex];

    if (padIdx === expectedPad) {
      // Correct!
      this.audio.playChime();
      ps.stepIndex++;

      // Speed bonus multiplier if you answer among the fastest
      let pts = 10 * this.currentRoundNumber;
      if (this.roundTimer <= 15) pts *= 2; // Sudden Death 2X

      ps.currentScore += pts;
      ps.feedbackFlash = 'CORRECT';
      ps.feedbackTimer = 0.3;
      ps.mood = 'triumph';
      ps.moodTimer = 0.6;

      if (ps.stepIndex >= this.sequence.length) {
        // Sequence completed successfully for this round!
        ps.hasFinishedSequence = true;
        this.finishOrder.push(playerId);

        // First to finish gets Speed Bonus +50% and fires Glitch Sabotage to rivals!
        if (this.finishOrder.length === 1 && this.getActivePlayers().length > 1) {
          const speedBonus = 25 * this.currentRoundNumber;
          ps.currentScore += speedBonus;
          this.particles.showFloatingText(`1ST! +${speedBonus} FAST RUSH! ⚡`, pad.x, pad.y - 25, '#F59E0B', 18);
          this.sabotageRivals(playerId);
        }

        this.audio.playFanfare();
      }
    } else {
      // Wrong pad!
      // Underdog Echo Shield: first strike absorbed
      if (ps.isUnderdog && !ps.shieldUsed) {
        ps.shieldUsed = true;
        this.audio.playBounce();
        ps.feedbackFlash = 'CORRECT'; // Soft save
        ps.feedbackTimer = 0.5;
        this.particles.showFloatingText('SHIELDED! NO STRIKE', pad.x, pad.y - 20, '#F59E0B', 16);
      } else {
        this.audio.playLaser();
        ps.strikes++;
        ps.feedbackFlash = 'ERROR';
        ps.feedbackTimer = 0.6;
        ps.mood = 'shocked';
        ps.moodTimer = 0.8;

        if (ps.strikes >= 3) {
          ps.isEliminated = true;
          this.particles.spawnExplosion(pad.x, pad.y, '#EF4444', 20);
        }
      }
    }
  }

  private sabotageRivals(winnerId: PlayerId): void {
    // Sabotage rivals with brief glitch distortion
    for (const p of this.getActivePlayers()) {
      if (p.id !== winnerId) {
        const rival = this.playerStates.get(p.id);
        if (rival && !rival.isEliminated && !rival.hasFinishedSequence) {
          rival.glitchTimer = 1.2;
          this.particles.showFloatingText('GLITCHED! ⚠️', rival.cursorIndex * 20, 100, '#EC4899', 14);
        }
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
      difficulty === 'bot_hard'
        ? 0.14 + Math.random() * 0.08
        : difficulty === 'bot_normal'
        ? 0.28 + Math.random() * 0.12
        : 0.45 + Math.random() * 0.25;
    ps.botReactionTimer = delay;

    const expected = this.sequence[ps.stepIndex];
    if (expected === undefined) return;

    let targetPad = expected;

    // Error injection on Easy/Normal
    if (difficulty === 'bot_easy' && this.currentRoundNumber >= 3 && Math.random() < 0.28) {
      targetPad = (expected + 1) % this.pads.length;
    } else if (difficulty === 'bot_normal' && this.currentRoundNumber >= 6 && Math.random() < 0.14) {
      targetPad = (expected + 1) % this.pads.length;
    }

    ps.cursorIndex = targetPad;
    this.submitPlayerInput(botId, targetPad);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;

    const cfg = THEME_CONFIGS.find((t) => t.id === this.currentTheme) || THEME_CONFIGS[0];

    // 1. Stage Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, cfg.bgGradient[0]);
    bgGrad.addColorStop(1, cfg.bgGradient[1]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative stage grid
    ctx.strokeStyle = cfg.gridLineColor;
    ctx.lineWidth = 1;
    for (let x = 40; x < width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 80);
      ctx.lineTo(x, height - 50);
      ctx.stroke();
    }

    // 2. Matrix Pads (2.5D Tactile Drum Pads)
    for (const pad of this.pads) {
      this.renderMatrixPad(ctx, pad, cfg);
    }

    // 3. Target Indicators for Active Players during Input
    if (this.phase === 'INPUT') {
      this.renderPlayerReticles(ctx);
    }

    // 4. Player Corner Podiums & Mascot Avatars
    this.renderPlayerCornerCards(ctx, width, height, cfg);

    // 5. Center Sub-Header Badge (y: 56, h: 26 - respects top-center y:12-44 safe zone)
    this.renderSubHeaderBadge(ctx, width, cfg);

    // 6. Interactive Theme Pill (bottom-left x: 20, y: height - 44, w: 170, h: 32)
    this.renderThemePill(ctx, height, cfg);

    // 7. Control Hints (bottom-right x: width - 20, y: height - 28, textAlign: right)
    this.renderControlsHUD(ctx, width, height);
  }

  private renderMatrixPad(ctx: CanvasRenderingContext2D, pad: MatrixPad, cfg: ThemeConfig): void {
    ctx.save();
    ctx.translate(pad.x, pad.y);

    // Glow halo when flashing
    if (pad.flashTimer > 0) {
      ctx.fillStyle = pad.glowColor;
      ctx.beginPath();
      ctx.arc(0, 0, pad.size * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }

    // Underdog Golden Clue glint during input phase
    for (const ps of this.playerStates.values()) {
      if (ps.isUnderdog && !ps.isEliminated && !ps.hasFinishedSequence && this.phase === 'INPUT') {
        const expected = this.sequence[ps.stepIndex];
        if (expected === pad.id) {
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, pad.size * 0.65, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // 2.5D Beveled Base
    const depression = pad.pressAnim * 4;
    ctx.fillStyle = cfg.padBaseColor;
    ctx.beginPath();
    ctx.roundRect(-pad.size / 2, -pad.size / 2 + 4, pad.size, pad.size, 10);
    ctx.fill();

    // Pad Rim
    ctx.fillStyle = cfg.padRimColor;
    ctx.beginPath();
    ctx.roundRect(-pad.size / 2, -pad.size / 2 + depression, pad.size, pad.size - 4, 10);
    ctx.fill();

    // Pad Inner Face (Rubber pad)
    const alpha = 0.40 + pad.flashTimer * 0.60;
    ctx.fillStyle = pad.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.roundRect(-pad.size / 2 + 5, -pad.size / 2 + 5 + depression, pad.size - 10, pad.size - 14, 8);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Pad Note Number
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${pad.id + 1}`, 0, depression);

    ctx.restore();
  }

  private renderPlayerReticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.getActivePlayers()) {
      const ps = this.playerStates.get(p.id);
      if (!ps || ps.isEliminated || ps.hasFinishedSequence) continue;

      const pad = this.pads[ps.cursorIndex];
      if (!pad) continue;

      const s = pad.size / 2 + 6;
      ctx.save();
      ctx.translate(pad.x, pad.y);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;

      // Glitch visual jitter
      if (ps.glitchTimer > 0) {
        ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
      }

      // Corner targeting brackets
      const bLen = 12;
      ctx.beginPath();
      ctx.moveTo(-s, -s + bLen); ctx.lineTo(-s, -s); ctx.lineTo(-s + bLen, -s);
      ctx.moveTo(s - bLen, -s); ctx.lineTo(s, -s); ctx.lineTo(s, -s + bLen);
      ctx.moveTo(-s, s - bLen); ctx.lineTo(-s, s); ctx.lineTo(-s + bLen, s);
      ctx.moveTo(s - bLen, s); ctx.lineTo(s, s); ctx.lineTo(s, s - bLen);
      ctx.stroke();

      // Player Tag
      ctx.fillStyle = p.color;
      ctx.font = '700 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${p.id + 1}`, 0, s + 14);

      ctx.restore();
    }
  }

  private renderPlayerCornerCards(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cfg: ThemeConfig
  ): void {
    for (const p of this.getActivePlayers()) {
      const ps = this.playerStates.get(p.id);
      if (!ps) continue;

      let px = 20;
      let py = 16;
      let mascotX = px + 175;
      let mascotY = py + 36;

      if (p.corner === 'top-right') {
        px = width - 180;
        mascotX = px - 20;
      } else if (p.corner === 'bottom-left') {
        // Place neatly above theme pill (theme pill is at y: height - 44)
        py = height - 134;
        mascotY = py + 36;
      } else if (p.corner === 'bottom-right') {
        px = width - 180;
        py = height - 134;
        mascotX = px - 20;
        mascotY = py + 36;
      }

      // Container Card
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
      ctx.beginPath();
      ctx.roundRect(px, py, 160, 78, 8);
      ctx.fill();

      // Card border (dashed gold if Underdog)
      if (ps.isUnderdog) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 3]);
      } else {
        ctx.strokeStyle = ps.isEliminated ? '#64748B' : p.color;
        ctx.lineWidth = 2;
      }
      ctx.stroke();
      ctx.restore();

      // Name & Score
      ctx.fillStyle = ps.isEliminated ? '#94A3B8' : p.color;
      ctx.font = '700 12px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, px + 10, py + 18);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '800 13px Inter, monospace';
      const status = ps.isEliminated
        ? 'ELIMINATED'
        : ps.hasFinishedSequence
        ? 'DONE! ✓'
        : `Step ${ps.stepIndex}/${this.sequence.length}`;
      ctx.fillText(status, px + 10, py + 35);

      // Strikes (X X X)
      for (let s = 0; s < 3; s++) {
        ctx.fillStyle = s < ps.strikes ? '#EF4444' : '#475569';
        ctx.font = '700 13px sans-serif';
        ctx.fillText('✖', px + 10 + s * 16, py + 54);
      }

      // Score
      ctx.fillStyle = '#F59E0B';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillText(`${ps.currentScore} pts`, px + 75, py + 54);

      // Feedback flash
      if (ps.feedbackFlash) {
        ctx.fillStyle = ps.feedbackFlash === 'CORRECT' ? '#10B981' : '#EF4444';
        ctx.font = '700 10px Inter, sans-serif';
        ctx.fillText(ps.feedbackFlash, px + 10, py + 70);
      }

      // Render Mascot Avatar alongside the card
      const isBot = p.type !== 'human';
      ctx.save();
      drawCharacter(ctx, mascotX, mascotY, 13, ps.id, isBot, ps.mood, this.animTimer);
      ctx.restore();
    }
  }

  private renderSubHeaderBadge(ctx: CanvasRenderingContext2D, width: number, cfg: ThemeConfig): void {
    const podW = 340;
    const podH = 26;
    const podX = width / 2 - podW / 2;
    const podY = 56; // Safe zone below top-center timer y: 12-44

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 13);
    ctx.fill();

    ctx.strokeStyle = cfg.boardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Map Name Badge
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(`STAGE: ${cfg.name} (R${this.currentRoundNumber})`, podX + 16, podY + 17);

    // Sequence status
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    if (this.phase === 'PLAYBACK') {
      ctx.fillStyle = '#38BDF8';
      ctx.fillText(`LISTEN: ${this.sequence.length} NOTES`, podX + podW - 16, podY + 17);
    } else if (this.phase === 'INPUT') {
      ctx.fillStyle = '#10B981';
      ctx.fillText('REPEAT SEQUENCE!', podX + podW - 16, podY + 17);
    } else {
      ctx.fillStyle = '#F59E0B';
      ctx.fillText('ROUND SUCCESS! ✓', podX + podW - 16, podY + 17);
    }
    ctx.restore();
  }

  private renderThemePill(ctx: CanvasRenderingContext2D, height: number, cfg: ThemeConfig): void {
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();

    ctx.strokeStyle = cfg.boardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(cfg.badge, pillX + 12, pillY + 20);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('[T]', pillX + pillW - 10, pillY + 20);
    ctx.restore();
  }

  private renderControlsHUD(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.fillText('Steer: Target Pad | Tap: Strike Pad | Finish 1st for Fast Rush!', width - 20, height - 28);
    ctx.restore();
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
      mvpHighlight: `Masterful memory! Reached Round ${this.currentRoundNumber} with ${topScore} pts on ${this.currentTheme}!`
    };
  }
}
