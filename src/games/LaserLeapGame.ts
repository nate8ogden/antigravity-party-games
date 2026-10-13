import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export interface LaserLeapTheme {
  name: string;
  bgGradStart: string;
  bgGradMid: string;
  bgGradEnd: string;
  ringOuter: string;
  ringInner: string;
  gridLine: string;
  coreGradInner: string;
  coreGradMid: string;
  coreGradOuter: string;
  coreGlow: string;
  beamColor: string;
  beamGlow: string;
  beamCore: string;
  podBase: string;
  podRim: string;
  themePillColor: string;
}

export const LASER_LEAP_THEMES: LaserLeapTheme[] = [
  {
    name: 'Cyber Grid ⚡',
    bgGradStart: '#0F172A',
    bgGradMid: '#020617',
    bgGradEnd: '#000000',
    ringOuter: '#38BDF8',
    ringInner: '#1E293B',
    gridLine: 'rgba(56, 189, 248, 0.08)',
    coreGradInner: '#FFFFFF',
    coreGradMid: '#FB7185',
    coreGradOuter: '#BE123C',
    coreGlow: '#F43F5E',
    beamColor: 'rgba(239, 68, 68, 0.50)',
    beamGlow: '#EF4444',
    beamCore: '#FFFFFF',
    podBase: '#1E293B',
    podRim: '#38BDF8',
    themePillColor: '#38BDF8'
  },
  {
    name: 'Inferno Reactor 🔥',
    bgGradStart: '#431407',
    bgGradMid: '#1C0A04',
    bgGradEnd: '#000000',
    ringOuter: '#F97316',
    ringInner: '#78350F',
    gridLine: 'rgba(249, 115, 22, 0.09)',
    coreGradInner: '#FFFBEB',
    coreGradMid: '#F59E0B',
    coreGradOuter: '#B45309',
    coreGlow: '#F97316',
    beamColor: 'rgba(249, 115, 22, 0.55)',
    beamGlow: '#F97316',
    beamCore: '#FEF08A',
    podBase: '#291711',
    podRim: '#F97316',
    themePillColor: '#F97316'
  },
  {
    name: 'Neon Synthwave 🌆',
    bgGradStart: '#2E1065',
    bgGradMid: '#0F0529',
    bgGradEnd: '#030014',
    ringOuter: '#E879F9',
    ringInner: '#4C1D95',
    gridLine: 'rgba(232, 121, 249, 0.09)',
    coreGradInner: '#FDF4FF',
    coreGradMid: '#C084FC',
    coreGradOuter: '#7E22CE',
    coreGlow: '#E879F9',
    beamColor: 'rgba(217, 70, 239, 0.55)',
    beamGlow: '#EC4899',
    beamCore: '#FDF2F8',
    podBase: '#1F1135',
    podRim: '#E879F9',
    themePillColor: '#E879F9'
  }
];

interface PodJumper {
  id: PlayerId;
  angle: number; // Angle on circular arena ring
  x: number;
  y: number;
  alive: boolean;
  lives: number;
  invulnerableTimer: number;
  isJumping: boolean;
  jumpTimer: number; // 0 to jumpDuration
  jumpDuration: number;
  jumpHeight: number;
  score: number;
  comboStreak: number;
  botReactionTimer: number;
  isUnderdog: boolean;
  landingEffectTimer: number;
}

interface BotLeapState {
  plannedLeadTime: number;
  lastApproachDir: number;
  surpriseTimer: number;
  hasPlannedCurrentSweep: boolean;
  hasPlannedDualSweep: boolean;
}

export class LaserLeapGame extends BaseGame {
  private jumpers: Map<PlayerId, PodJumper> = new Map();
  private arenaCenterX: number = 400;
  private arenaCenterY: number = 300;
  private arenaRadius: number = 210;
  private botStates: Map<PlayerId, BotLeapState> = new Map();

  // Rotating Laser Beam properties
  private laserAngle: number = 0;
  private laserSpeed: number = 2.4; // Radians per sec, accelerates over time
  private laserDir: number = 1; // 1 (clockwise) or -1 (counter-clockwise)
  private reversalTimer: number = 4.0;
  private warningSparkTimer: number = 0;
  private eliminationOrder: PlayerId[] = [];
  private totalJumps: Map<PlayerId, number> = new Map();

  // Visual Themes & Audio
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
    if (typeof window !== 'undefined' && (window as unknown as { __LASER_LEAP_DEBUG__?: unknown }).__LASER_LEAP_DEBUG__) {
      delete (window as unknown as { __LASER_LEAP_DEBUG__?: unknown }).__LASER_LEAP_DEBUG__;
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isFinished) return;
      if (e.code === 'KeyT') {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % LASER_LEAP_THEMES.length;
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
        this.currentThemeIndex = (this.currentThemeIndex + 1) % LASER_LEAP_THEMES.length;
        this.audio.playTap();
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

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 45;
    this.isFinished = false;
    this.suddenDeathAnnounced = false;
    this.jumpers.clear();
    this.botStates.clear();
    this.eliminationOrder = [];
    this.totalJumps.clear();
    this.animTimer = 0;

    this.arenaCenterX = width / 2;
    this.arenaCenterY = height / 2;
    this.arenaRadius = Math.min(width, height) * 0.36;

    this.laserAngle = 0;
    this.laserSpeed = 2.4;
    this.laserDir = 1;
    this.reversalTimer = 3.8 + Math.random() * 2.2;
    this.warningSparkTimer = 0;

    const active = this.getActivePlayers();
    const count = active.length;

    // Distribute player pods evenly around perimeter
    active.forEach((p, idx) => {
      const baseAngle = (idx / count) * Math.PI * 2 - Math.PI / 2;
      const px = this.arenaCenterX + Math.cos(baseAngle) * this.arenaRadius;
      const py = this.arenaCenterY + Math.sin(baseAngle) * this.arenaRadius;

      this.jumpers.set(p.id, {
        id: p.id,
        angle: baseAngle,
        x: px,
        y: py,
        alive: true,
        lives: 3,
        invulnerableTimer: 0,
        isJumping: false,
        jumpTimer: 0,
        jumpDuration: 0.44,
        jumpHeight: 0,
        score: 0,
        comboStreak: 0,
        botReactionTimer: 0,
        isUnderdog: false,
        landingEffectTimer: 0
      });
      this.totalJumps.set(p.id, 0);
      this.botStates.set(p.id, {
        plannedLeadTime: 0.20,
        lastApproachDir: 1,
        surpriseTimer: 0,
        hasPlannedCurrentSweep: false,
        hasPlannedDualSweep: false
      });
    });

    // Expose debug hook for testing
    (window as any).__LASER_LEAP_DEBUG__ = {
      getJumpers: () => Array.from(this.jumpers.values()).map(j => ({
        id: j.id,
        angle: j.angle,
        x: j.x,
        y: j.y,
        alive: j.alive,
        lives: j.lives,
        isJumping: j.isJumping,
        jumpHeight: j.jumpHeight,
        score: j.score,
        comboStreak: j.comboStreak,
        isUnderdog: j.isUnderdog
      })),
      getLaser: () => ({
        angle: this.laserAngle,
        speed: this.laserSpeed,
        dir: this.laserDir,
        reversalTimer: this.reversalTimer
      }),
      setLaser: (angle: number, speed: number, dir: number) => {
        this.laserAngle = angle;
        this.laserSpeed = speed;
        this.laserDir = dir;
      },
      jump: (pid: PlayerId) => {
        this.input.setBotInput(pid, true);
      },
      getBotState: (pid: PlayerId) => this.botStates.get(pid),
      getTheme: () => LASER_LEAP_THEMES[this.currentThemeIndex].name,
      setTheme: (idx: number) => {
        this.currentThemeIndex = Math.max(0, Math.min(idx, LASER_LEAP_THEMES.length - 1));
      }
    };
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.animTimer += dt;

    // Check Sudden Death trigger at 15s remaining
    const isSuddenDeath = this.roundTimer <= 15;
    if (isSuddenDeath && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.audio.playExplosion();
      this.particles.addTrauma(0.4);
      this.particles.showFloatingText('⚡ DUAL LASER OVERDRIVE! ⚡', width / 2, height / 2 - 50, '#FACC15', 28);
    }

    // Accelerate laser sweep speed gradually (faster during sudden death)
    const baseSpeed = 2.4 + (45 - this.roundTimer) * 0.09;
    this.laserSpeed = Math.min(7.0, isSuddenDeath ? baseSpeed * 1.25 : baseSpeed);

    // Direction reversal countdown
    this.reversalTimer -= dt;
    if (this.reversalTimer <= 0.6 && this.reversalTimer > 0) {
      this.warningSparkTimer += dt * 15;
    }
    if (this.reversalTimer <= 0) {
      this.laserDir = -this.laserDir;
      this.reversalTimer = 3.0 + Math.random() * 2.8;
      this.warningSparkTimer = 0;
      this.audio.playLaser();
      this.particles.spawnSparks(this.arenaCenterX, this.arenaCenterY, '#FACC15', 24);
      this.particles.showFloatingText('REVERSE! ⚡', this.arenaCenterX, this.arenaCenterY - 45, '#FACC15', 24);

      // Inflict surprise latency on bots so reversals feel human
      for (const [pid, bState] of this.botStates.entries()) {
        const p = this.getPlayer(pid);
        if (!p || !p.type.startsWith('bot_')) continue;
        const diff = p.type as 'bot_easy' | 'bot_normal' | 'bot_hard';
        const surprise = diff === 'bot_easy' ? 0.36 : diff === 'bot_normal' ? 0.22 : 0.08;
        bState.surpriseTimer = surprise;
        bState.hasPlannedCurrentSweep = false;
        bState.hasPlannedDualSweep = false;
      }
    }

    // Advance primary laser sweep angle
    const prevLaserAngle = this.laserAngle;
    this.laserAngle += this.laserDir * this.laserSpeed * dt;
    const twoPi = Math.PI * 2;
    this.laserAngle = ((this.laserAngle % twoPi) + twoPi) % twoPi;

    // Secondary dual laser during Sudden Death (diametrically opposite)
    const prevDualAngle = ((prevLaserAngle + Math.PI) % twoPi + twoPi) % twoPi;
    const dualLaserAngle = ((this.laserAngle + Math.PI) % twoPi + twoPi) % twoPi;

    // Calculate Leader and Underdog
    let minScore = Infinity;
    let maxScore = -Infinity;
    let minLives = 4;
    let maxLives = 0;
    for (const j of this.jumpers.values()) {
      if (!j.alive) continue;
      if (j.score < minScore) minScore = j.score;
      if (j.score > maxScore) maxScore = j.score;
      if (j.lives < minLives) minLives = j.lives;
      if (j.lives > maxLives) maxLives = j.lives;
    }

    // Update Underdog status and Jump Hangtime
    for (const j of this.jumpers.values()) {
      if (!j.alive) {
        j.isUnderdog = false;
        continue;
      }
      const scoreDeficit = maxScore - j.score;
      const livesDeficit = maxLives - j.lives;
      j.isUnderdog = (scoreDeficit >= 40 || livesDeficit >= 1) && j.lives > 0;

      // Underdog spring boots grant +18% jump duration (extra hangtime buffer)
      j.jumpDuration = j.isUnderdog ? 0.52 : 0.44;
    }

    this.updateBots(dt, width, height);

    // Process Jumpers
    for (const j of this.jumpers.values()) {
      if (!j.alive) continue;

      if (j.invulnerableTimer > 0) {
        j.invulnerableTimer = Math.max(0, j.invulnerableTimer - dt);
      }
      if (j.landingEffectTimer > 0) {
        j.landingEffectTimer = Math.max(0, j.landingEffectTimer - dt);
      }

      // Handle jump inputs
      const justPressed = this.input.justPressed(j.id) || this.input.justAction(j.id);
      if (justPressed && !j.isJumping) {
        j.isJumping = true;
        j.jumpTimer = 0;
        this.audio.playBoost();
        this.particles.spawnSparks(j.x, j.y + 10, j.isUnderdog ? '#F59E0B' : '#38BDF8', 8);
        const cur = this.totalJumps.get(j.id) || 0;
        this.totalJumps.set(j.id, cur + 1);
      }

      // Jump parabolic arc physics
      if (j.isJumping) {
        j.jumpTimer += dt;
        const progress = Math.min(1.0, j.jumpTimer / j.jumpDuration);
        const peakHeight = j.isUnderdog ? 54 : 44;
        j.jumpHeight = Math.sin(progress * Math.PI) * peakHeight;

        if (j.jumpTimer >= j.jumpDuration) {
          j.isJumping = false;
          j.jumpTimer = 0;
          j.jumpHeight = 0;
          j.landingEffectTimer = 0.25;
          this.audio.playTap();
          this.particles.spawnSparks(j.x, j.y + 12, '#94A3B8', 6);
        }
      }

      // Check Laser Collision Sweep for Primary Beam
      const podAngleNorm = ((j.angle % twoPi) + twoPi) % twoPi;
      const sweptPrimary = this.isAngleBetween(prevLaserAngle, this.laserAngle, podAngleNorm, this.laserDir);
      const sweptDual = isSuddenDeath && this.isAngleBetween(prevDualAngle, dualLaserAngle, podAngleNorm, this.laserDir);

      if (sweptPrimary || sweptDual) {
        if (!j.isJumping || j.jumpHeight < 16) {
          // If already invulnerable from previous hit, ignore damage
          if (j.invulnerableTimer <= 0) {
            j.lives--;
            j.comboStreak = 0;
            j.invulnerableTimer = 1.35;
            this.audio.playExplosion();
            this.particles.addTrauma(0.35);
            this.particles.spawnExplosion(j.x, j.y, this.players[j.id].color, 30);
            this.particles.spawnSparks(j.x, j.y, '#EF4444', 22);

            if (j.lives <= 0) {
              j.alive = false;
              this.eliminationOrder.push(j.id);
              this.particles.showFloatingText('ELIMINATED! 💥', j.x, j.y - 45, '#EF4444', 24);
            } else {
              j.score = Math.max(0, j.score - 15);
              this.particles.showFloatingText(`-15 PTS • ${j.lives} ❤️ LEFT!`, j.x, j.y - 45, '#F87171', 18);
            }
          }
        } else {
          // Successful jump over the laser beam!
          j.comboStreak++;
          let points = 10;
          let label = '+10 CLEARED!';
          let color = '#10B981';

          if (j.comboStreak >= 4) {
            points = 50;
            label = `🔥 OVERCHARGE +50! (${j.comboStreak}X)`;
            color = '#F59E0B';
            this.audio.playScore();
            this.particles.spawnSparks(j.x, j.y - j.jumpHeight, '#FACC15', 16);
          } else if (j.comboStreak === 3) {
            points = 35;
            label = `⚡ COMBO +35! (3X)`;
            color = '#38BDF8';
            this.audio.playScore();
            this.particles.spawnSparks(j.x, j.y - j.jumpHeight, '#38BDF8', 12);
          } else if (j.comboStreak === 2) {
            points = 20;
            label = `+20 DOUBLE!`;
            color = '#34D399';
            this.particles.spawnSparks(j.x, j.y - j.jumpHeight, '#34D399', 8);
          }

          j.score += points;
          this.particles.showFloatingText(label, j.x, j.y - j.jumpHeight - 20, color, 16);
        }
      }
    }

    // Check round over
    const aliveCount = Array.from(this.jumpers.values()).filter((j) => j.alive).length;
    if (aliveCount <= 1 || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private isAngleBetween(a1: number, a2: number, target: number, dir: number): boolean {
    const twoPi = Math.PI * 2;
    if (dir > 0) {
      // Clockwise
      let diff = (a2 - a1) % twoPi;
      if (diff < 0) diff += twoPi;
      let targetDiff = (target - a1) % twoPi;
      if (targetDiff < 0) targetDiff += twoPi;
      return targetDiff <= diff;
    } else {
      // Counter-clockwise
      let diff = (a1 - a2) % twoPi;
      if (diff < 0) diff += twoPi;
      let targetDiff = (a1 - target) % twoPi;
      if (targetDiff < 0) targetDiff += twoPi;
      return targetDiff <= diff;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const j = this.jumpers.get(botId);
    if (!j || !j.alive || j.isJumping) {
      this.input.setBotInput(botId, false);
      return;
    }

    const bState = this.botStates.get(botId);
    if (bState && bState.surpriseTimer > 0) {
      bState.surpriseTimer -= dt;
      this.input.setBotInput(botId, false);
      return;
    }

    const twoPi = Math.PI * 2;
    const podAngle = ((j.angle % twoPi) + twoPi) % twoPi;
    const curLaser = this.laserAngle;
    const isSuddenDeath = this.roundTimer <= 15;

    // Calculate time to impact for primary beam
    let angularDistPrimary = 0;
    if (this.laserDir > 0) {
      angularDistPrimary = (podAngle - curLaser) % twoPi;
      if (angularDistPrimary < 0) angularDistPrimary += twoPi;
    } else {
      angularDistPrimary = (curLaser - podAngle) % twoPi;
      if (angularDistPrimary < 0) angularDistPrimary += twoPi;
    }
    const timeToImpactPrimary = angularDistPrimary / (this.laserSpeed || 1);

    // Calculate time to impact for dual beam
    let timeToImpact = timeToImpactPrimary;
    if (isSuddenDeath) {
      const dualLaserAngle = ((curLaser + Math.PI) % twoPi + twoPi) % twoPi;
      let angularDistDual = 0;
      if (this.laserDir > 0) {
        angularDistDual = (podAngle - dualLaserAngle) % twoPi;
        if (angularDistDual < 0) angularDistDual += twoPi;
      } else {
        angularDistDual = (dualLaserAngle - podAngle) % twoPi;
        if (angularDistDual < 0) angularDistDual += twoPi;
      }
      const timeToImpactDual = angularDistDual / (this.laserSpeed || 1);
      timeToImpact = Math.min(timeToImpactPrimary, timeToImpactDual);
    }

    if (bState) {
      if (timeToImpact > 0.65) {
        bState.hasPlannedCurrentSweep = false;
      }

      if (!bState.hasPlannedCurrentSweep && timeToImpact <= 0.65) {
        bState.hasPlannedCurrentSweep = true;
        const roll = Math.random();

        if (difficulty === 'bot_easy') {
          // Easy: 24% early jump, 16% late jump, 60% safe jump
          if (roll < 0.24) {
            bState.plannedLeadTime = 0.44 + Math.random() * 0.06;
          } else if (roll < 0.40) {
            bState.plannedLeadTime = 0.02 + Math.random() * 0.03;
          } else {
            bState.plannedLeadTime = 0.16 + Math.random() * 0.13;
          }
        } else if (difficulty === 'bot_normal') {
          // Normal: 10% early jump, 6% late jump, 84% safe jump
          if (roll < 0.10) {
            bState.plannedLeadTime = 0.42 + Math.random() * 0.05;
          } else if (roll < 0.16) {
            bState.plannedLeadTime = 0.025 + Math.random() * 0.025;
          } else {
            bState.plannedLeadTime = 0.17 + Math.random() * 0.11;
          }
        } else {
          // Hard: 2% early jump, 2% late jump, 96% safe jump
          if (roll < 0.02) {
            bState.plannedLeadTime = 0.41 + Math.random() * 0.04;
          } else if (roll < 0.04) {
            bState.plannedLeadTime = 0.03 + Math.random() * 0.02;
          } else {
            bState.plannedLeadTime = 0.19 + Math.random() * 0.08;
          }
        }
      }

      if (timeToImpact <= bState.plannedLeadTime && timeToImpact > 0.01) {
        this.input.setBotInput(botId, true);
      } else {
        this.input.setBotInput(botId, false);
      }
    } else {
      if (timeToImpact <= 0.20 && timeToImpact > 0.02) {
        this.input.setBotInput(botId, true);
      } else {
        this.input.setBotInput(botId, false);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const survivors = Array.from(this.jumpers.values()).filter((j) => j.alive);
    // Sort survivors by score, then elimination order
    survivors.sort((a, b) => b.score - a.score || b.lives - a.lives);
    const winnerId = survivors.length >= 1 ? survivors[0].id : (this.eliminationOrder[this.eliminationOrder.length - 1] ?? null);

    const rankedIds = [
      ...survivors.map((s) => s.id),
      ...[...this.eliminationOrder].reverse()
    ];

    return {
      winnerId,
      rankings: rankedIds.map((pid, idx) => ({
        playerId: pid,
        score: Math.round(this.jumpers.get(pid)?.score || 0),
        place: idx + 1
      })),
      mvpHighlight: winnerId !== null
        ? `${this.players[winnerId].name} MASTERED THE NEON LASER ROPE WITH ${this.jumpers.get(winnerId)?.score || 0} PTS!`
        : 'ALL JUMPERS WERE OVERCHARGED!'
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const theme = LASER_LEAP_THEMES[this.currentThemeIndex];
    const isSuddenDeath = this.roundTimer <= 15;

    // 1. High-Tech Theme Arena Background
    const bgGrad = ctx.createRadialGradient(
      this.arenaCenterX, this.arenaCenterY, 30,
      this.arenaCenterX, this.arenaCenterY, this.arenaRadius + 90
    );
    bgGrad.addColorStop(0, theme.bgGradStart);
    bgGrad.addColorStop(0.65, theme.bgGradMid);
    bgGrad.addColorStop(1, theme.bgGradEnd);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Circuit Grid Lines
    ctx.save();
    ctx.strokeStyle = theme.gridLine;
    ctx.lineWidth = 1;
    const step = 44;
    for (let x = 0; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();

    // 2. High-Voltage Ring Track
    ctx.save();
    ctx.strokeStyle = theme.ringOuter;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = theme.ringOuter;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, this.arenaRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = theme.ringInner;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, this.arenaRadius * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 3. Central Power Spindle
    ctx.save();
    ctx.shadowColor = theme.coreGlow;
    ctx.shadowBlur = 24;
    const coreGrad = ctx.createRadialGradient(
      this.arenaCenterX, this.arenaCenterY, 3,
      this.arenaCenterX, this.arenaCenterY, 34
    );
    coreGrad.addColorStop(0, theme.coreGradInner);
    coreGrad.addColorStop(0.45, theme.coreGradMid);
    coreGrad.addColorStop(1, theme.coreGradOuter);
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, 28, 0, Math.PI * 2);
    ctx.fill();

    // Spindle spinning notches
    ctx.strokeStyle = theme.coreGradInner;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const notchAngle = this.laserAngle + (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(
        this.arenaCenterX + Math.cos(notchAngle) * 14,
        this.arenaCenterY + Math.sin(notchAngle) * 14
      );
      ctx.lineTo(
        this.arenaCenterX + Math.cos(notchAngle) * 26,
        this.arenaCenterY + Math.sin(notchAngle) * 26
      );
      ctx.stroke();
    }
    ctx.restore();

    // 4. Laser Beams (Primary Beam & Sudden Death Secondary Beam)
    const renderLaserBeam = (angle: number, isSecondary: boolean = false) => {
      const beamLength = this.arenaRadius + 32;
      const beamEndX = this.arenaCenterX + Math.cos(angle) * beamLength;
      const beamEndY = this.arenaCenterY + Math.sin(angle) * beamLength;

      ctx.save();
      // Outer Glow Sheath
      ctx.shadowColor = isSecondary ? '#FACC15' : theme.beamGlow;
      ctx.shadowBlur = 25;
      ctx.strokeStyle = isSecondary ? 'rgba(250, 204, 21, 0.45)' : theme.beamColor;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(this.arenaCenterX, this.arenaCenterY);
      ctx.lineTo(beamEndX, beamEndY);
      ctx.stroke();

      // Middle Beam
      ctx.strokeStyle = isSecondary ? '#FDE047' : theme.beamGlow;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(this.arenaCenterX, this.arenaCenterY);
      ctx.lineTo(beamEndX, beamEndY);
      ctx.stroke();

      // Sharp Core Needle
      ctx.strokeStyle = theme.beamCore;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(this.arenaCenterX, this.arenaCenterY);
      ctx.lineTo(beamEndX, beamEndY);
      ctx.stroke();
      ctx.restore();
    };

    renderLaserBeam(this.laserAngle, false);
    if (isSuddenDeath) {
      renderLaserBeam(this.laserAngle + Math.PI, true);
    }

    // Direction reversal warning effect
    if (this.reversalTimer <= 0.6) {
      ctx.save();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(
        this.arenaCenterX,
        this.arenaCenterY,
        38 + Math.sin(this.warningSparkTimer) * 7,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.restore();
    }

    // 5. Render Player Pods and Mascot Jumpers
    for (const j of this.jumpers.values()) {
      const pColor = this.players[j.id]?.color || '#38BDF8';
      const isBot = this.players[j.id]?.type.startsWith('bot_') ?? false;

      // Pod Base Platform
      ctx.save();
      ctx.fillStyle = j.alive ? theme.podBase : '#0B0F19';
      ctx.strokeStyle = j.alive ? pColor : '#334155';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(j.x, j.y, 25, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Underdog Golden Shimmer Aura
      if (j.isUnderdog && j.alive) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.ellipse(j.x, j.y, 31, 19, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Landing ripple
      if (j.landingEffectTimer > 0 && j.alive) {
        const ringProgress = 1 - j.landingEffectTimer / 0.25;
        ctx.strokeStyle = pColor;
        ctx.lineWidth = 2 * (1 - ringProgress);
        ctx.beginPath();
        ctx.ellipse(j.x, j.y, 25 + ringProgress * 18, 14 + ringProgress * 10, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Shadow when airborne
      if (j.isJumping && j.alive) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        const shadowScale = Math.max(0.35, 1 - j.jumpHeight / 65);
        ctx.beginPath();
        ctx.ellipse(j.x, j.y, 20 * shadowScale, 11 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (!j.alive) {
        // Ghost / Eliminated Marker
        ctx.save();
        ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.font = '700 12px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('OUT', j.x, j.y + 4);
        ctx.restore();
        continue;
      }

      // Invulnerability flicker
      if (j.invulnerableTimer > 0 && Math.floor(j.invulnerableTimer * 12) % 2 === 0) {
        // Skip rendering character sprite on alternate frames for flashing effect
      } else {
        // Determine Mascot Mood
        let mood: CharacterMood = 'focused';
        if (j.invulnerableTimer > 0) {
          mood = 'shocked';
        } else if (j.isJumping && j.comboStreak >= 2) {
          mood = 'happy';
        } else if (this.isFinished) {
          mood = 'triumph';
        }

        const renderY = j.y - j.jumpHeight;

        // Render Character Mascot Face
        drawCharacter(ctx, j.x, renderY - 14, 16, j.id, isBot, mood, this.animTimer);

        // Jump Boots Jets / Electric Sparks
        if (j.isJumping) {
          ctx.save();
          ctx.fillStyle = j.isUnderdog ? '#F59E0B' : '#38BDF8';
          ctx.beginPath();
          ctx.arc(j.x - 7, renderY + 2, 3.5, 0, Math.PI * 2);
          ctx.arc(j.x + 7, renderY + 2, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Hearts & Score Badge Above Player
      ctx.save();
      ctx.textAlign = 'center';
      const badgeY = j.y - j.jumpHeight - 38;

      // Energy Battery Hearts
      let heartsStr = '';
      for (let h = 0; h < j.lives; h++) heartsStr += '❤️';
      ctx.font = '11px sans-serif';
      ctx.fillText(heartsStr, j.x, badgeY - 12);

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 11px Montserrat, sans-serif';
      ctx.fillText(`${j.score} PTS`, j.x, badgeY);

      // Streak badge
      if (j.comboStreak >= 2) {
        ctx.fillStyle = j.comboStreak >= 4 ? '#F59E0B' : '#38BDF8';
        ctx.font = '800 10px Montserrat, sans-serif';
        ctx.fillText(`${j.comboStreak}X STREAK`, j.x, badgeY + 12);
      }
      ctx.restore();
    }

    // 6. Header Badge (y: 56)
    ctx.save();
    const pillW = 400;
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
        ? '⚡ DUAL LASER OVERDRIVE! JUMP DOUBLE BEAMS! ⚡'
        : 'TIMED LEAP • AVOID HIGH-VOLTAGE LASER • BUILD STREAKS!',
      width / 2,
      pillY + pillH / 2
    );
    ctx.restore();

    // 7. Interactive Bottom-Left Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
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

    // 8. On-screen Controls Pill (Offset to right, never overlapping theme pill)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.font = '600 11px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('Tap / Space / Enter: Jump Over Laser', width - 24, height - 28);
    ctx.restore();

    ctx.restore();
  }
}
