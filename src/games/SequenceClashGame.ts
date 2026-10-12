import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SequencePlayer {
  id: PlayerId;
  alive: boolean;
  score: number;
  inputIndex: number;
  completedCurrentSequence: boolean;
  flashPad: number | null;
  flashTimer: number;
  mistakeTimer: number;
  lastDirection: number | null;
  activeKeysDown: Set<string>;
  pointerQueue: number[];
}

const PAD_COLORS = ['#38BDF8', '#FACC15', '#EC4899', '#4ADE80'];
const PAD_SYMBOLS = ['▲', '►', '▼', '◄'];
const PAD_KEY_HINTS = ['W / ↑', 'D / →', 'S / ↓', 'A / ←'];

export class SequenceClashGame extends BaseGame {
  private duelists: Map<PlayerId, SequencePlayer> = new Map();
  private sequence: number[] = [];
  private sequenceLength: number = 3;
  private currentStage: 'DEMONSTRATE' | 'INPUT' | 'ROUND_SUMMARY' = 'DEMONSTRATE';
  private demoIndex: number = 0;
  private demoTimer: number = 0;
  private activeDemoPad: number | null = null;
  private inputWindowTimer: number = 6.0;
  private interRoundTimer: number = 1.4;
  private eliminationOrder: PlayerId[] = [];
  private currentRoundNumber: number = 1;
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
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 50;
    this.isFinished = false;
    this.duelists.clear();
    this.eliminationOrder = [];
    this.currentRoundNumber = 1;
    this.sequenceLength = 3;

    const active = this.getActivePlayers();
    active.forEach((p) => {
      this.duelists.set(p.id, {
        id: p.id,
        alive: true,
        score: 0,
        inputIndex: 0,
        completedCurrentSequence: false,
        flashPad: null,
        flashTimer: 0,
        mistakeTimer: 0,
        lastDirection: null,
        activeKeysDown: new Set(),
        pointerQueue: []
      });
    });

    // Ensure pointerdown listener is bound to canvas for direct on-screen pad tapping
    const canvas = this.input.getCanvas();
    if (canvas && !this.boundPointerDown) {
      this.boundPointerDown = this.handlePointerDown.bind(this);
      canvas.addEventListener('pointerdown', this.boundPointerDown);
    }

    // Expose debug hook for testing
    (window as any).__SEQUENCE_CLASH_DEBUG__ = {
      getSequence: () => [...this.sequence],
      getCurrentStage: () => this.currentStage,
      skipDemonstration: () => {
        this.currentStage = 'INPUT';
        this.demoTimer = 0;
        this.activeDemoPad = null;
      },
      getDuelists: () => Array.from(this.duelists.values()).map(d => ({
        id: d.id,
        alive: d.alive,
        score: d.score,
        inputIndex: d.inputIndex,
        completed: d.completedCurrentSequence
      })),
      pressPad: (pid: PlayerId, pad: number) => {
        const d = this.duelists.get(pid);
        if (d) d.pointerQueue.push(pad);
      }
    };

    this.startNewSequence(this.sequenceLength);
  }

  private handlePointerDown(e: PointerEvent): void {
    if (this.currentStage !== 'INPUT') return;
    const canvas = this.input.getCanvas();
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const padDist = 68;
    const padRadius = 42;

    const padOffsets = [
      { x: cx, y: cy - padDist, id: 0 },
      { x: cx + padDist, y: cy, id: 1 },
      { x: cx, y: cy + padDist, id: 2 },
      { x: cx - padDist, y: cy, id: 3 }
    ];

    for (const p of padOffsets) {
      if (Math.abs(clickX - p.x) <= padRadius && Math.abs(clickY - p.y) <= padRadius) {
        const humanPlayers = this.getActivePlayers().filter((pl) => !pl.type.startsWith('bot_'));
        let targetPid: PlayerId = 0;
        if (humanPlayers.length === 1) {
          targetPid = humanPlayers[0].id;
        } else if (humanPlayers.length > 1) {
          targetPid = clickX < canvas.width / 2 ? humanPlayers[0].id : humanPlayers[1].id;
        }
        const d = this.duelists.get(targetPid);
        if (d && d.alive && !d.completedCurrentSequence) {
          d.pointerQueue.push(p.id);
        }
        break;
      }
    }
  }

  public override destroy(): void {
    if (this.boundPointerDown) {
      const canvas = this.input.getCanvas();
      if (canvas) {
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
      }
      this.boundPointerDown = null;
    }
  }

  private startNewSequence(length: number): void {
    this.sequence = [];
    for (let i = 0; i < length; i++) {
      this.sequence.push(Math.floor(Math.random() * 4));
    }
    this.currentStage = 'DEMONSTRATE';
    this.demoIndex = 0;
    this.demoTimer = 0.5;
    this.activeDemoPad = null;
    this.inputWindowTimer = 5.0 + length * 0.8;

    for (const d of this.duelists.values()) {
      if (d.alive) {
        d.inputIndex = 0;
        d.completedCurrentSequence = false;
        d.flashPad = null;
        d.flashTimer = 0;
        d.mistakeTimer = 0;
        d.lastDirection = null;
        d.activeKeysDown.clear();
        d.pointerQueue = [];
      }
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update duelist timers
    for (const d of this.duelists.values()) {
      if (d.flashTimer > 0) d.flashTimer -= dt;
      if (d.mistakeTimer > 0) d.mistakeTimer -= dt;
    }

    if (this.currentStage === 'DEMONSTRATE') {
      this.demoTimer -= dt;
      if (this.demoTimer <= 0) {
        if (this.activeDemoPad !== null) {
          // Turn off current pad, brief gap
          this.activeDemoPad = null;
          this.demoTimer = 0.18;
          this.demoIndex++;
          if (this.demoIndex >= this.sequence.length) {
            // Demonstration complete! Switch to Player Input phase
            this.currentStage = 'INPUT';
            this.audio.playLaser();
            this.particles.showFloatingText('YOUR TURN! REPEAT! 🎮', width / 2, height / 2 - 110, '#38BDF8', 22);
          }
        } else {
          // Light up next pad in sequence
          this.activeDemoPad = this.sequence[this.demoIndex];
          this.demoTimer = 0.42;
          this.audio.playTap();
        }
      }
    } else if (this.currentStage === 'INPUT') {
      this.inputWindowTimer -= dt;
      this.updateBots(dt, width, height);

      // Process Player Inputs
      for (const d of this.duelists.values()) {
        if (!d.alive || d.completedCurrentSequence) continue;

        let chosenPad: number | null = null;

        // 1. Check direct touch / mouse clicks on the holographic pads
        if (d.pointerQueue.length > 0) {
          chosenPad = d.pointerQueue.shift()!;
        }

        // 2. Check crisp raw keyboard inputs (instant 0ms edge detection)
        if (chosenPad === null) {
          const keyMappings: { pad: number; codes: string[] }[] = [
            // Direction 0 (Top / Blue)
            { pad: 0, codes: d.id === 0 ? ['KeyW', 'KeyZ'] : d.id === 1 ? ['ArrowUp'] : d.id === 2 ? ['KeyI'] : ['Numpad8', 'KeyT'] },
            // Direction 1 (Right / Yellow)
            { pad: 1, codes: d.id === 0 ? ['KeyD'] : d.id === 1 ? ['ArrowRight'] : d.id === 2 ? ['KeyL'] : ['Numpad6', 'KeyH'] },
            // Direction 2 (Bottom / Pink)
            { pad: 2, codes: d.id === 0 ? ['KeyS'] : d.id === 1 ? ['ArrowDown'] : d.id === 2 ? ['KeyK'] : ['Numpad2', 'Numpad5', 'KeyG'] },
            // Direction 3 (Left / Green)
            { pad: 3, codes: d.id === 0 ? ['KeyA', 'KeyQ'] : d.id === 1 ? ['ArrowLeft'] : d.id === 2 ? ['KeyJ'] : ['Numpad4', 'KeyF'] }
          ];

          for (const mapping of keyMappings) {
            const isAnyCodeDown = mapping.codes.some((code) => this.input.isRawKeyPressed(code));
            if (isAnyCodeDown) {
              const wasAlreadyDown = mapping.codes.some((code) => d.activeKeysDown.has(code));
              if (!wasAlreadyDown) {
                // New distinct key press!
                mapping.codes.forEach((code) => {
                  if (this.input.isRawKeyPressed(code)) d.activeKeysDown.add(code);
                });
                if (chosenPad === null) {
                  chosenPad = mapping.pad;
                }
              }
            } else {
              mapping.codes.forEach((code) => d.activeKeysDown.delete(code));
            }
          }
        }

        // 3. Directional stick / virtual touch joystick / bot input with debounced edge-triggering
        const steer = this.input.getSteer(d.id);
        const throttle = this.input.getThrottle(d.id);
        const isNeutral = Math.abs(steer) < 0.25 && Math.abs(throttle) < 0.25;

        if (isNeutral) {
          d.lastDirection = null;
        } else if (d.lastDirection === null && chosenPad === null) {
          // Dominant direction axis
          if (Math.abs(throttle) >= Math.abs(steer)) {
            if (throttle > 0.35) chosenPad = 0;      // Top
            else if (throttle < -0.35) chosenPad = 2; // Bottom
          } else {
            if (steer > 0.35) chosenPad = 1;       // Right
            else if (steer < -0.35) chosenPad = 3;  // Left
          }

          if (chosenPad !== null) {
            d.lastDirection = chosenPad;
          }
        }

        if (chosenPad !== null) {
          d.flashPad = chosenPad;
          d.flashTimer = 0.25;

          const cx = width / 2;
          const cy = height / 2;
          const padDist = 68;
          const padOffsets = [
            { x: cx, y: cy - padDist },
            { x: cx + padDist, y: cy },
            { x: cx, y: cy + padDist },
            { x: cx - padDist, y: cy }
          ];
          const padPos = padOffsets[chosenPad];

          const expected = this.sequence[d.inputIndex];
          if (chosenPad === expected) {
            // Correct input!
            d.inputIndex++;
            d.score += 10;
            this.audio.playTap();
            this.particles.spawnSparks(padPos.x, padPos.y, PAD_COLORS[chosenPad], 10);

            if (d.inputIndex >= this.sequence.length) {
              // Completed entire sequence!
              d.completedCurrentSequence = true;
              d.score += 25; // Bonus
              this.audio.playScore();
              this.particles.showFloatingText(`+25 CLEAR!`, cx, cy - 130, '#10B981', 20);
            }
          } else {
            // WRONG PAD! Mistake elimination
            d.alive = false;
            d.mistakeTimer = 1.0;
            this.eliminationOrder.push(d.id);
            this.audio.playExplosion();
            this.particles.addTrauma(0.3);
            this.particles.spawnExplosion(padPos.x, padPos.y, '#EF4444', 28);
            this.particles.showFloatingText(`MISTAKE! ❌`, cx, cy - 130, '#EF4444', 22);
          }
        }
      }

      // Check if all players completed or failed, or input window expired
      const alivePlayers = Array.from(this.duelists.values()).filter((d) => d.alive);
      const allDone = alivePlayers.every((d) => d.completedCurrentSequence);

      if (allDone || this.inputWindowTimer <= 0 || alivePlayers.length <= 1) {
        this.currentStage = 'ROUND_SUMMARY';
        this.interRoundTimer = 1.4;
      }
    } else if (this.currentStage === 'ROUND_SUMMARY') {
      this.interRoundTimer -= dt;
      if (this.interRoundTimer <= 0) {
        const alivePlayers = Array.from(this.duelists.values()).filter((d) => d.alive);
        if (alivePlayers.length <= 1 || this.sequenceLength >= 7 || this.roundTimer <= 0) {
          this.isFinished = true;
        } else {
          // Advance to next longer sequence!
          this.currentRoundNumber++;
          this.sequenceLength++;
          this.startNewSequence(this.sequenceLength);
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const d = this.duelists.get(botId);
    if (!d || !d.alive || d.completedCurrentSequence) return;

    if (this.currentStage !== 'INPUT') return;

    // Simulate bot thinking delay between inputs (0.35s to 0.7s)
    if (Math.random() < 0.08) {
      const expected = this.sequence[d.inputIndex];

      // Error rate based on difficulty
      let mistake = false;
      if (difficulty === 'bot_easy') {
        mistake = Math.random() < 0.28;
      } else if (difficulty === 'bot_normal') {
        mistake = Math.random() < 0.08;
      } else {
        mistake = Math.random() < 0.02; // Hard bot almost never fails
      }

      const inputPad = mistake ? (expected + 1) % 4 : expected;

      // Map pad 0,1,2,3 to steer/throttle
      let steer = 0;
      let throttle = 0;
      if (inputPad === 0) throttle = 1;       // Top
      else if (inputPad === 1) steer = 1;     // Right
      else if (inputPad === 2) throttle = -1; // Bottom
      else if (inputPad === 3) steer = -1;    // Left

      this.input.setBotInput(botId, true, steer, throttle, false);
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = Array.from(this.duelists.values()).sort((a, b) => b.score - a.score);
    const winnerId = sorted.length > 0 && sorted[0].score > 0 ? sorted[0].id : null;
    const winnerName = winnerId !== null ? (this.getPlayer(winnerId)?.name || 'Player') : '';

    return {
      winnerId,
      rankings: sorted.map((d, idx) => ({
        playerId: d.id,
        score: d.score,
        place: idx + 1
      })),
      mvpHighlight: winnerId !== null ? `${winnerName} CRACKED THE SEQUENCE CLASH!` : 'SEQUENCE OVERLOAD!'
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Sleek Cyber Grid Chamber
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, width * 0.7);
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(0.6, '#090D16');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Central 4-Way Holographic Pad Cluster
    const cx = width / 2;
    const cy = height / 2;
    const padDist = 68;
    const padRadius = 38;

    const padOffsets = [
      { x: cx, y: cy - padDist, id: 0 }, // 0: Top
      { x: cx + padDist, y: cy, id: 1 }, // 1: Right
      { x: cx, y: cy + padDist, id: 2 }, // 2: Bottom
      { x: cx - padDist, y: cy, id: 3 }  // 3: Left
    ];

    padOffsets.forEach(({ x, y, id }) => {
      const isDemoActive = this.activeDemoPad === id;

      // Check if any alive duelist is flashing this pad upon input
      let isPlayerFlashing = false;
      let flashColor = '#FFFFFF';
      for (const d of this.duelists.values()) {
        if (d.flashPad === id && d.flashTimer > 0) {
          isPlayerFlashing = true;
          const p = this.getPlayer(d.id);
          flashColor = p?.color || '#FFFFFF';
          break;
        }
      }

      const isLit = isDemoActive || isPlayerFlashing;
      const baseColor = PAD_COLORS[id];

      ctx.save();
      ctx.shadowColor = isLit ? (isPlayerFlashing ? flashColor : '#FFFFFF') : baseColor;
      ctx.shadowBlur = isLit ? 26 : 10;

      // Outer Bezel
      ctx.fillStyle = isLit ? (isPlayerFlashing ? flashColor : '#FFFFFF') : baseColor;
      ctx.beginPath();
      ctx.roundRect(x - padRadius, y - padRadius, padRadius * 2, padRadius * 2, 14);
      ctx.fill();

      // Inner Core
      ctx.fillStyle = isLit ? baseColor : '#0F172A';
      ctx.beginPath();
      ctx.roundRect(x - padRadius + 4, y - padRadius + 4, (padRadius - 4) * 2, (padRadius - 4) * 2, 10);
      ctx.fill();

      // Symbol
      ctx.fillStyle = isLit ? '#FFFFFF' : baseColor;
      ctx.font = 'bold 22px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(PAD_SYMBOLS[id], x, y + 2);

      // Key Hint Label under symbol
      ctx.fillStyle = isLit ? '#FFFFFF' : 'rgba(255, 255, 255, 0.75)';
      ctx.font = '800 10px Montserrat, sans-serif';
      ctx.fillText(PAD_KEY_HINTS[id], x, y + 20);

      ctx.restore();
    });

    // Center Stage Status Display
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 15px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    const statusText = this.currentStage === 'DEMONSTRATE'
      ? `WATCHING MEMORY SEQUENCE [${this.sequence.length} STEPS]`
      : `ENTER SEQUENCE! [${Math.ceil(this.inputWindowTimer)}s]`;
    ctx.fillText(statusText, cx, cy - padDist - 60);

    // Sequence Step Indicator Dots
    const dotSpacing = 16;
    const totalDotW = (this.sequence.length - 1) * dotSpacing;
    const startDotX = cx - totalDotW / 2;
    const dotY = cy - padDist - 40;

    for (let i = 0; i < this.sequence.length; i++) {
      ctx.save();
      const isLit = this.currentStage === 'DEMONSTRATE' && i <= this.demoIndex && this.activeDemoPad !== null;
      ctx.fillStyle = isLit ? '#FFFFFF' : '#475569';
      ctx.beginPath();
      ctx.arc(startDotX + i * dotSpacing, dotY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Render Player Status Pillars
    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      const d = this.duelists.get(p.id);
      if (!d) return;

      const px = count === 2 ? (idx === 0 ? width * 0.16 : width * 0.84) : (idx % 2 === 0 ? width * 0.16 : width * 0.84);
      const py = count === 2 ? height * 0.5 : (idx < 2 ? height * 0.35 : height * 0.65);

      ctx.save();
      // Frosted Player Box
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = d.alive ? p.color : '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(px - 60, py - 44, 120, 88, 12);
      ctx.fill();
      ctx.stroke();

      // Player Name
      ctx.fillStyle = d.alive ? '#FFFFFF' : '#64748B';
      ctx.font = 'bold 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, px, py - 22);

      // Status
      if (!d.alive) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText('❌ ELIMINATED', px, py);
      } else if (d.completedCurrentSequence) {
        ctx.fillStyle = '#10B981';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText('✓ CLEARED!', px, py);
      } else {
        ctx.fillStyle = '#38BDF8';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`STEP: ${d.inputIndex}/${this.sequence.length}`, px, py);
      }

      // Score
      ctx.fillStyle = '#F59E0B';
      ctx.font = '900 13px Montserrat, sans-serif';
      ctx.fillText(`${d.score} PTS`, px, py + 20);

      // Controller Key Guide
      const keyGuide = p.id === 0 ? 'W A S D / TAP' : p.id === 1 ? '↑ ← ↓ →' : p.id === 2 ? 'I J K L' : 'T F G H';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '700 9px monospace';
      ctx.fillText(keyGuide, px, py + 33);

      ctx.restore();
    });

    ctx.restore();
  }
}
