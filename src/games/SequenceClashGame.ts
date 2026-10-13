import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export interface SequenceTheme {
  name: string;
  bgGradStart: string;
  bgGradMid: string;
  bgGradEnd: string;
  padBezel: string;
  padInactive: string;
  padColors: string[];
  themePillColor: string;
}

export const SEQUENCE_THEMES: SequenceTheme[] = [
  {
    name: 'Cyber Grid ⚡',
    bgGradStart: '#0F172A',
    bgGradMid: '#090D16',
    bgGradEnd: '#020617',
    padBezel: '#334155',
    padInactive: '#0F172A',
    padColors: ['#38BDF8', '#FACC15', '#EC4899', '#4ADE80'],
    themePillColor: '#38BDF8'
  },
  {
    name: 'Disco Dancefloor 🪩',
    bgGradStart: '#2E1065',
    bgGradMid: '#170638',
    bgGradEnd: '#060114',
    padBezel: '#7E22CE',
    padInactive: '#1E1135',
    padColors: ['#60A5FA', '#F43F5E', '#A855F7', '#FBBF24'],
    themePillColor: '#A855F7'
  },
  {
    name: 'Retro Arcade Synth 🕹️',
    bgGradStart: '#18181B',
    bgGradMid: '#09090B',
    bgGradEnd: '#000000',
    padBezel: '#52525B',
    padInactive: '#18181B',
    padColors: ['#06B6D4', '#E11D48', '#84CC16', '#F59E0B'],
    themePillColor: '#10B981'
  }
];

interface SequencePlayer {
  id: PlayerId;
  alive: boolean;
  lives: number;
  score: number;
  inputIndex: number;
  completedCurrentSequence: boolean;
  flashPad: number | null;
  flashTimer: number;
  mistakeTimer: number;
  lastDirection: number | null;
  activeKeysDown: Set<string>;
  pointerQueue: number[];
  inputStartTime: number;
  isUnderdog: boolean;
}

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

  // Visual Themes & Polish
  private currentThemeIndex: number = 0;
  private animTimer: number = 0;
  private suddenDeathAnnounced: boolean = false;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private pointerdownListener: ((e: PointerEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  public destroy(): void {
    this.removeListeners();
    super.destroy();
    if (typeof window !== 'undefined' && (window as unknown as { __SEQUENCE_CLASH_DEBUG__?: unknown }).__SEQUENCE_CLASH_DEBUG__) {
      delete (window as unknown as { __SEQUENCE_CLASH_DEBUG__?: unknown }).__SEQUENCE_CLASH_DEBUG__;
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isFinished) return;
      if (e.code === 'KeyT') {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % SEQUENCE_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.pointerdownListener = (e: PointerEvent) => {
      if (this.isFinished) return;
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // Theme pill at x: 20, y: canvas.height - 44, w: 170, h: 32
      if (clickX >= 20 && clickX <= 190 && clickY >= canvas.height - 44 && clickY <= canvas.height - 12) {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % SEQUENCE_THEMES.length;
        this.audio.playTap();
        return;
      }

      // Check direct touch / mouse clicks on the holographic pads
      if (this.currentStage !== 'INPUT') return;

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const padDist = 70;
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
    };
    window.addEventListener('pointerdown', this.pointerdownListener);
  }

  private removeListeners(): void {
    if (typeof window === 'undefined') return;
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
    if (this.pointerdownListener) {
      window.removeEventListener('pointerdown', this.pointerdownListener);
      this.pointerdownListener = null;
    }
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.roundTimer = 50;
    this.isFinished = false;
    this.suddenDeathAnnounced = false;
    this.duelists.clear();
    this.eliminationOrder = [];
    this.currentRoundNumber = 1;
    this.sequenceLength = 3;
    this.animTimer = 0;

    const active = this.getActivePlayers();
    active.forEach((p) => {
      this.duelists.set(p.id, {
        id: p.id,
        alive: true,
        lives: 3,
        score: 0,
        inputIndex: 0,
        completedCurrentSequence: false,
        flashPad: null,
        flashTimer: 0,
        mistakeTimer: 0,
        lastDirection: null,
        activeKeysDown: new Set(),
        pointerQueue: [],
        inputStartTime: 0,
        isUnderdog: false
      });
    });

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
        lives: d.lives,
        score: d.score,
        inputIndex: d.inputIndex,
        completed: d.completedCurrentSequence,
        isUnderdog: d.isUnderdog
      })),
      pressPad: (pid: PlayerId, pad: number) => {
        const d = this.duelists.get(pid);
        if (d) d.pointerQueue.push(pad);
      },
      getTheme: () => SEQUENCE_THEMES[this.currentThemeIndex].name,
      setTheme: (idx: number) => {
        this.currentThemeIndex = Math.max(0, Math.min(idx, SEQUENCE_THEMES.length - 1));
      }
    };

    this.startNewSequence(this.sequenceLength);
  }

  private startNewSequence(length: number): void {
    this.sequence = [];
    for (let i = 0; i < length; i++) {
      this.sequence.push(Math.floor(Math.random() * 4));
    }
    this.currentStage = 'DEMONSTRATE';
    this.demoIndex = 0;
    this.demoTimer = 0.45;
    this.activeDemoPad = null;
    this.inputWindowTimer = 5.0 + length * 0.75;

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
        d.inputStartTime = 0;
      }
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.animTimer += dt;
    const isSuddenDeath = this.roundTimer <= 15 || this.sequenceLength >= 6;

    if (isSuddenDeath && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.audio.playExplosion();
      this.particles.addTrauma(0.4);
      this.particles.showFloatingText('⚡ HYPER SEQUENCE OVERDRIVE! ⚡', width / 2, height / 2 - 120, '#FACC15', 28);
    }

    // Determine Underdog status
    let maxScore = -Infinity;
    let minScore = Infinity;
    let maxLives = 0;
    let minLives = 4;
    for (const d of this.duelists.values()) {
      if (d.score > maxScore) maxScore = d.score;
      if (d.score < minScore) minScore = d.score;
      if (d.lives > maxLives) maxLives = d.lives;
      if (d.lives < minLives) minLives = d.lives;
    }

    for (const d of this.duelists.values()) {
      d.isUnderdog = (d.alive && (maxLives - d.lives >= 1 || (maxScore - d.score >= 50 && maxScore > 0)));
    }

    // Update duelist timers
    for (const d of this.duelists.values()) {
      if (d.flashTimer > 0) d.flashTimer -= dt;
      if (d.mistakeTimer > 0) d.mistakeTimer -= dt;
    }

    if (this.currentStage === 'DEMONSTRATE') {
      this.demoTimer -= dt;
      if (this.demoTimer <= 0) {
        if (this.activeDemoPad !== null) {
          this.activeDemoPad = null;
          this.demoTimer = isSuddenDeath ? 0.12 : 0.18;
          this.demoIndex++;
          if (this.demoIndex >= this.sequence.length) {
            this.currentStage = 'INPUT';
            this.audio.playLaser();
            this.particles.showFloatingText('YOUR TURN! REPEAT! 🎮', width / 2, height / 2 - 120, '#38BDF8', 22);
            for (const d of this.duelists.values()) {
              d.inputStartTime = this.inputWindowTimer;
            }
          }
        } else {
          this.activeDemoPad = this.sequence[this.demoIndex];
          this.demoTimer = isSuddenDeath ? 0.28 : 0.40;
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

        // 1. Direct touch / pointer taps
        if (d.pointerQueue.length > 0) {
          chosenPad = d.pointerQueue.shift()!;
        }

        // 2. Crisp keyboard mappings
        if (chosenPad === null) {
          const keyMappings: { pad: number; codes: string[] }[] = [
            { pad: 0, codes: d.id === 0 ? ['KeyW', 'KeyZ'] : d.id === 1 ? ['ArrowUp'] : d.id === 2 ? ['KeyI'] : ['Numpad8', 'KeyT'] },
            { pad: 1, codes: d.id === 0 ? ['KeyD'] : d.id === 1 ? ['ArrowRight'] : d.id === 2 ? ['KeyL'] : ['Numpad6', 'KeyH'] },
            { pad: 2, codes: d.id === 0 ? ['KeyS'] : d.id === 1 ? ['ArrowDown'] : d.id === 2 ? ['KeyK'] : ['Numpad2', 'Numpad5', 'KeyG'] },
            { pad: 3, codes: d.id === 0 ? ['KeyA', 'KeyQ'] : d.id === 1 ? ['ArrowLeft'] : d.id === 2 ? ['KeyJ'] : ['Numpad4', 'KeyF'] }
          ];

          for (const mapping of keyMappings) {
            const isAnyCodeDown = mapping.codes.some((code) => this.input.isRawKeyPressed(code));
            if (isAnyCodeDown) {
              const wasAlreadyDown = mapping.codes.some((code) => d.activeKeysDown.has(code));
              if (!wasAlreadyDown) {
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

        // 3. Directional stick / touch joystick with edge-triggering
        const steer = this.input.getSteer(d.id);
        const throttle = this.input.getThrottle(d.id);
        const isNeutral = Math.abs(steer) < 0.25 && Math.abs(throttle) < 0.25;

        if (isNeutral) {
          d.lastDirection = null;
        } else if (d.lastDirection === null && chosenPad === null) {
          if (Math.abs(throttle) >= Math.abs(steer)) {
            if (throttle > 0.35) chosenPad = 0;
            else if (throttle < -0.35) chosenPad = 2;
          } else {
            if (steer > 0.35) chosenPad = 1;
            else if (steer < -0.35) chosenPad = 3;
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
          const padDist = 70;
          const padOffsets = [
            { x: cx, y: cy - padDist },
            { x: cx + padDist, y: cy },
            { x: cx, y: cy + padDist },
            { x: cx - padDist, y: cy }
          ];
          const padPos = padOffsets[chosenPad];
          const theme = SEQUENCE_THEMES[this.currentThemeIndex];

          const expected = this.sequence[d.inputIndex];
          if (chosenPad === expected) {
            // Correct input step!
            d.inputIndex++;
            d.score += 10;
            this.audio.playTap();
            this.particles.spawnSparks(padPos.x, padPos.y, theme.padColors[chosenPad], 12);

            if (d.inputIndex >= this.sequence.length) {
              // Completed entire sequence cleanly!
              d.completedCurrentSequence = true;
              const timeTaken = d.inputStartTime - this.inputWindowTimer;
              let bonus = 25;
              let label = '+25 CLEAR!';
              let color = '#10B981';

              if (timeTaken <= 1.5) {
                bonus = 50;
                label = '⚡ BLAZING SPEED! +50!';
                color = '#F59E0B';
                this.audio.playScore();
              } else if (timeTaken <= 3.0) {
                bonus = 35;
                label = '✨ SWIFT! +35!';
                color = '#38BDF8';
                this.audio.playScore();
              }

              d.score += bonus;
              this.particles.showFloatingText(label, cx, cy - 130, color, 20);
            }
          } else {
            // WRONG PAD! Deduct 1 Life / Heart instead of instant total game-over
            d.lives--;
            d.score = Math.max(0, d.score - 15);
            d.mistakeTimer = 1.0;
            d.inputIndex = 0; // Reset index for this round so player can retry

            this.audio.playExplosion();
            this.particles.addTrauma(0.3);
            this.particles.spawnExplosion(padPos.x, padPos.y, '#EF4444', 30);

            if (d.lives <= 0) {
              d.alive = false;
              this.eliminationOrder.push(d.id);
              this.particles.showFloatingText('OUT OF HEARTS! 💀', cx, cy - 130, '#EF4444', 24);
            } else {
              this.particles.showFloatingText(`MISTAKE! -15 (${d.lives} ❤️ LEFT)`, cx, cy - 130, '#F87171', 18);
            }
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
    _dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const d = this.duelists.get(botId);
    if (!d || !d.alive || d.completedCurrentSequence) return;
    if (this.currentStage !== 'INPUT') return;

    if (Math.random() < 0.08) {
      const expected = this.sequence[d.inputIndex];

      let mistake = false;
      if (difficulty === 'bot_easy') {
        mistake = Math.random() < 0.28;
      } else if (difficulty === 'bot_normal') {
        mistake = Math.random() < 0.08;
      } else {
        mistake = Math.random() < 0.02;
      }

      const inputPad = mistake ? (expected + 1) % 4 : expected;

      let steer = 0;
      let throttle = 0;
      if (inputPad === 0) throttle = 1;
      else if (inputPad === 1) steer = 1;
      else if (inputPad === 2) throttle = -1;
      else if (inputPad === 3) steer = -1;

      this.input.setBotInput(botId, true, steer, throttle, false);
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = Array.from(this.duelists.values()).sort(
      (a, b) => b.score - a.score || b.lives - a.lives
    );
    const winnerId = sorted.length > 0 && sorted[0].score > 0 ? sorted[0].id : null;
    const winnerName = winnerId !== null ? (this.getPlayer(winnerId)?.name || 'Player') : '';

    return {
      winnerId,
      rankings: sorted.map((d, idx) => ({
        playerId: d.id,
        score: d.score,
        place: idx + 1
      })),
      mvpHighlight: winnerId !== null
        ? `${winnerName} MASTERED THE CYBER SEQUENCE WITH ${sorted[0].score} PTS!`
        : 'SEQUENCE OVERLOAD!'
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const theme = SEQUENCE_THEMES[this.currentThemeIndex];
    const isSuddenDeath = this.roundTimer <= 15 || this.sequenceLength >= 6;

    // 1. Sleek Theme Chamber Floor
    const bgGrad = ctx.createRadialGradient(
      width / 2, height / 2, 40,
      width / 2, height / 2, width * 0.75
    );
    bgGrad.addColorStop(0, theme.bgGradStart);
    bgGrad.addColorStop(0.65, theme.bgGradMid);
    bgGrad.addColorStop(1, theme.bgGradEnd);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Central 4-Way Holographic Pad Cluster
    const cx = width / 2;
    const cy = height / 2;
    const padDist = 70;
    const padRadius = 38;

    const padOffsets = [
      { x: cx, y: cy - padDist, id: 0 },
      { x: cx + padDist, y: cy, id: 1 },
      { x: cx, y: cy + padDist, id: 2 },
      { x: cx - padDist, y: cy, id: 3 }
    ];

    // Underdog Memory Assistance Hint
    let underdogTargetPad: number | null = null;
    for (const d of this.duelists.values()) {
      if (d.isUnderdog && d.alive && !d.completedCurrentSequence && this.currentStage === 'INPUT') {
        underdogTargetPad = this.sequence[d.inputIndex];
        break;
      }
    }

    padOffsets.forEach(({ x, y, id }) => {
      const isDemoActive = this.activeDemoPad === id;

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
      const baseColor = theme.padColors[id];

      ctx.save();
      ctx.shadowColor = isLit ? (isPlayerFlashing ? flashColor : '#FFFFFF') : baseColor;
      ctx.shadowBlur = isLit ? 26 : 10;

      // Underdog pulse halo
      if (underdogTargetPad === id) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - padRadius - 5, y - padRadius - 5, (padRadius + 5) * 2, (padRadius + 5) * 2, 16);
        else ctx.rect(x - padRadius - 5, y - padRadius - 5, (padRadius + 5) * 2, (padRadius + 5) * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Outer Bezel
      ctx.fillStyle = isLit ? (isPlayerFlashing ? flashColor : '#FFFFFF') : baseColor;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - padRadius, y - padRadius, padRadius * 2, padRadius * 2, 14);
      else ctx.rect(x - padRadius, y - padRadius, padRadius * 2, padRadius * 2);
      ctx.fill();

      // Inner Core
      ctx.fillStyle = isLit ? baseColor : theme.padInactive;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - padRadius + 4, y - padRadius + 4, (padRadius - 4) * 2, (padRadius - 4) * 2, 10);
      else ctx.rect(x - padRadius + 4, y - padRadius + 4, (padRadius - 4) * 2, (padRadius - 4) * 2);
      ctx.fill();

      // Direction Symbol
      ctx.fillStyle = isLit ? '#FFFFFF' : baseColor;
      ctx.font = 'bold 22px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(PAD_SYMBOLS[id], x, y + 2);

      // Key Hint Label
      ctx.fillStyle = isLit ? '#FFFFFF' : 'rgba(255, 255, 255, 0.75)';
      ctx.font = '800 10px Montserrat, sans-serif';
      ctx.fillText(PAD_KEY_HINTS[id], x, y + 20);

      ctx.restore();
    });

    // Center Stage Status Text
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 14px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    const statusText = this.currentStage === 'DEMONSTRATE'
      ? `MEMORIZE SEQUENCE [${this.sequence.length} STEPS]`
      : `INPUT SEQUENCE! [${Math.ceil(this.inputWindowTimer)}s]`;
    ctx.fillText(statusText, cx, cy - padDist - 55);

    // Sequence Step Indicator Dots
    const dotSpacing = 16;
    const totalDotW = (this.sequence.length - 1) * dotSpacing;
    const startDotX = cx - totalDotW / 2;
    const dotY = cy - padDist - 36;

    for (let i = 0; i < this.sequence.length; i++) {
      ctx.save();
      const isLit = this.currentStage === 'DEMONSTRATE' && i <= this.demoIndex && this.activeDemoPad !== null;
      ctx.fillStyle = isLit ? '#FFFFFF' : '#475569';
      ctx.beginPath();
      ctx.arc(startDotX + i * dotSpacing, dotY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // 3. Render Player Status Pillars with Mascot Faces
    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      const d = this.duelists.get(p.id);
      if (!d) return;
      const isBot = p.type.startsWith('bot_');

      const px = count === 2
        ? (idx === 0 ? width * 0.16 : width * 0.84)
        : (idx % 2 === 0 ? width * 0.16 : width * 0.84);
      const py = count === 2
        ? height * 0.52
        : (idx < 2 ? height * 0.38 : height * 0.68);

      ctx.save();
      // Frosted Player Box
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = d.isUnderdog ? '#F59E0B' : (d.alive ? p.color : '#475569');
      ctx.lineWidth = d.isUnderdog ? 2.5 : 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px - 62, py - 46, 124, 96, 12);
      else ctx.rect(px - 62, py - 46, 124, 96);
      ctx.fill();
      ctx.stroke();

      // Mascot Avatar atop Box
      let mood: CharacterMood = 'focused';
      if (d.mistakeTimer > 0) {
        mood = 'shocked';
      } else if (d.completedCurrentSequence) {
        mood = 'happy';
      } else if (this.isFinished) {
        mood = 'triumph';
      }

      drawCharacter(ctx, px, py - 20, 14, p.id, isBot, mood, this.animTimer);

      // Lives / Hearts
      let heartsStr = '';
      for (let h = 0; h < d.lives; h++) heartsStr += '❤️';
      if (d.lives <= 0) heartsStr = '💀 DEAD';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(heartsStr, px, py);

      // Status / Steps
      if (!d.alive) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText('ELIMINATED', px, py + 14);
      } else if (d.completedCurrentSequence) {
        ctx.fillStyle = '#10B981';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText('✓ CLEARED!', px, py + 14);
      } else {
        ctx.fillStyle = '#38BDF8';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`STEP: ${d.inputIndex}/${this.sequence.length}`, px, py + 14);
      }

      // Score
      ctx.fillStyle = '#F59E0B';
      ctx.font = '800 12px Montserrat, sans-serif';
      ctx.fillText(`${d.score} PTS`, px, py + 28);

      // Controller Key Guide
      const keyGuide = p.id === 0 ? 'W A S D / TAP' : p.id === 1 ? '↑ ← ↓ →' : p.id === 2 ? 'I J K L' : 'T F G H';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '700 9px monospace';
      ctx.fillText(keyGuide, px, py + 40);

      ctx.restore();
    });

    // 4. Header Instruction Badge (y: 56)
    ctx.save();
    const pillW = 440;
    const pillH = 26;
    const pillX = width / 2 - pillW / 2;
    const pillY = 56;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 13);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#F87171' : '#FFFFFF';
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      isSuddenDeath
        ? '⚡ HYPER OVERDRIVE! FAST SEQUENCES & 2X BONUS! ⚡'
        : 'MEMORIZE PATTERN • TAP OR USE WASD/ARROWS • SPEED COUNTS!',
      width / 2,
      pillY + pillH / 2
    );
    ctx.restore();

    // 5. Interactive Bottom-Left Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, height - 44, 170, 32, 16);
    else ctx.rect(20, height - 44, 170, 32);
    ctx.fill();
    ctx.strokeStyle = theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.themePillColor;
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.name} [T]`, 20 + 85, height - 44 + 16);
    ctx.restore();

    // 6. On-screen Controls Pill (Offset to right, never overlapping theme pill)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.font = '600 11px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('WASD / Arrows / Direct Tap on Hologram', width - 24, height - 28);
    ctx.restore();

    ctx.restore();
  }
}
