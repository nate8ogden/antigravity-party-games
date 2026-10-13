import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { CharacterMood } from '../core/CharacterRenderer';

export interface SafeTheme {
  name: string;
  bgGradTop: string;
  bgGradBot: string;
  rivetColor: string;
  doorRim: string;
  doorGradInner: string;
  doorGradOuter: string;
  needleColor: string;
  targetGreen: string;
  themePillColor: string;
}

export const SAFE_THEMES: SafeTheme[] = [
  {
    name: 'Swiss Bank Vault 🏦',
    bgGradTop: '#0F172A',
    bgGradBot: '#1E293B',
    rivetColor: '#475569',
    doorRim: '#334155',
    doorGradInner: '#020617',
    doorGradOuter: '#1E293B',
    needleColor: '#F8FAFC',
    targetGreen: '#10B981',
    themePillColor: '#10B981'
  },
  {
    name: 'Cyber Data Core ⚡',
    bgGradTop: '#060B18',
    bgGradBot: '#0E172A',
    rivetColor: '#38BDF8',
    doorRim: '#0284C7',
    doorGradInner: '#050B14',
    doorGradOuter: '#0C4A6E',
    needleColor: '#38BDF8',
    targetGreen: '#06B6D4',
    themePillColor: '#38BDF8'
  },
  {
    name: 'Pirate Chest Lock 🏴‍☠️',
    bgGradTop: '#1C0E07',
    bgGradBot: '#2E1509',
    rivetColor: '#B45309',
    doorRim: '#78350F',
    doorGradInner: '#1C0A04',
    doorGradOuter: '#451A03',
    needleColor: '#FBBF24',
    targetGreen: '#F59E0B',
    themePillColor: '#F59E0B'
  }
];

interface TumblerTarget {
  startAngle: number;
  spanAngle: number;
  speed: number;
  direction: 1 | -1;
}

interface VaultLock {
  id: PlayerId;
  crackedTumblers: number; // 0 to 3
  score: number;
  currentAngle: number; // in radians
  jamTimer: number; // lockout timer on false tap
  targets: TumblerTarget[];
  doorOpenAnim: number; // 0 to 1
  isUnlocked: boolean;
  isUnderdog: boolean;
  shakeOffset: number;
  recentMood: CharacterMood;
  moodTimer: number;
}

export class SafeDialGame extends BaseGame {
  private locks: Map<PlayerId, VaultLock> = new Map();
  private maxTumblers: number = 3;
  private botReactionTimers: Map<PlayerId, number> = new Map();

  // Themes and Listeners
  private currentThemeIndex: number = 0;
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
    if (typeof window !== 'undefined' && (window as unknown as { __SAFE_DIAL_DEBUG__?: unknown }).__SAFE_DIAL_DEBUG__) {
      delete (window as unknown as { __SAFE_DIAL_DEBUG__?: unknown }).__SAFE_DIAL_DEBUG__;
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isFinished) return;
      if (e.code === 'KeyT') {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % SAFE_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.pointerdownListener = (e: PointerEvent) => {
      if (this.isFinished) return;
      const canvas = e.target as HTMLCanvasElement;
      if (!canvas || !canvas.getBoundingClientRect) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // Theme pill is at x: 20, y: canvas.height - 44, w: 170, h: 32
      if (clickX >= 20 && clickX <= 190 && clickY >= canvas.height - 44 && clickY <= canvas.height - 12) {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % SAFE_THEMES.length;
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
    this.roundTimer = 50;
    this.isFinished = false;
    this.locks.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    active.forEach((p) => {
      const t1Start = Math.random() * Math.PI * 2;
      const t2Start = Math.random() * Math.PI * 2;
      const t3Start = Math.random() * Math.PI * 2;

      this.locks.set(p.id, {
        id: p.id,
        crackedTumblers: 0,
        score: 0,
        currentAngle: 0,
        jamTimer: 0,
        doorOpenAnim: 0,
        isUnlocked: false,
        isUnderdog: false,
        shakeOffset: 0,
        recentMood: 'focused',
        moodTimer: 0,
        targets: [
          { startAngle: t1Start, spanAngle: 0.75, speed: 2.0, direction: 1 },
          { startAngle: t2Start, spanAngle: 0.58, speed: 2.6, direction: -1 },
          { startAngle: t3Start, spanAngle: 0.46, speed: 3.2, direction: 1 }
        ]
      });
    });

    // Expose debug hook for verification and tests
    (window as unknown as { __SAFE_DIAL_DEBUG__?: unknown }).__SAFE_DIAL_DEBUG__ = {
      getLocks: () =>
        Array.from(this.locks.values()).map((l) => ({
          id: l.id,
          crackedTumblers: l.crackedTumblers,
          currentAngle: l.currentAngle,
          jamTimer: l.jamTimer,
          isUnlocked: l.isUnlocked,
          curTarget: l.targets[l.crackedTumblers] ? { ...l.targets[l.crackedTumblers] } : null
        })),
      setAngle: (pid: PlayerId, angle: number) => {
        const lock = this.locks.get(pid);
        if (lock) lock.currentAngle = angle;
      },
      tap: (pid: PlayerId) => {
        this.input.setBotInput(pid, true);
      }
    };
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    const isSuddenDeath = this.roundTimer <= 15;

    // Check underdog surge: trailing by >= 2 tumblers
    let maxTumblers = 0;
    for (const l of this.locks.values()) {
      if (l.crackedTumblers > maxTumblers) maxTumblers = l.crackedTumblers;
    }
    for (const l of this.locks.values()) {
      l.isUnderdog = maxTumblers >= 2 && l.crackedTumblers <= maxTumblers - 2;
      if (l.shakeOffset > 0) l.shakeOffset = Math.max(0, l.shakeOffset - dt * 12);
      if (l.moodTimer > 0) {
        l.moodTimer -= dt;
      } else {
        l.recentMood = l.jamTimer > 0 ? 'shocked' : 'focused';
      }
    }

    for (const lock of this.locks.values()) {
      if (lock.isUnlocked) {
        lock.doorOpenAnim = Math.min(1.0, lock.doorOpenAnim + dt * 2.5);
        continue;
      }

      if (lock.jamTimer > 0) {
        lock.jamTimer -= dt;
      }

      const curTarget = lock.targets[lock.crackedTumblers];
      if (curTarget) {
        // Sudden Death accelerates dial spin by +30%
        const speedMultiplier = isSuddenDeath ? 1.30 : 1.0;
        lock.currentAngle += curTarget.speed * curTarget.direction * speedMultiplier * dt;
        const twoPi = Math.PI * 2;
        lock.currentAngle = ((lock.currentAngle % twoPi) + twoPi) % twoPi;
      }

      // Check player inputs
      const pressed = (this.input.justPressed(lock.id) || this.input.justAction(lock.id)) && lock.jamTimer <= 0;

      if (pressed && curTarget) {
        const needle = lock.currentAngle;
        const targetStart = curTarget.startAngle;
        // Underdog Surge expands green sector by +35%
        const effectiveSpan = curTarget.spanAngle * (lock.isUnderdog ? 1.35 : 1.0);

        const twoPi = Math.PI * 2;
        let diff = (needle - targetStart) % twoPi;
        if (diff < 0) diff += twoPi;

        const grace = 0.08;
        const isHit = diff <= (effectiveSpan + grace) || diff >= (twoPi - grace);

        if (isHit) {
          // Check Golden Sweet Spot (center 25% of target sector)
          const center = effectiveSpan / 2;
          const distToCenter = Math.abs(diff - center);
          const isSweetSpot = distToCenter <= effectiveSpan * 0.14;

          lock.crackedTumblers++;
          const pts = isSweetSpot ? (isSuddenDeath ? 600 : 400) : 150;
          lock.score += pts;

          const dialPos = this.getDialPosition(lock.id, width, height);

          // Send Safe Vibration Shockwave to rivals!
          for (const other of this.locks.values()) {
            if (other.id !== lock.id) {
              other.shakeOffset = 6;
            }
          }

          if (isSweetSpot) {
            this.audio.playFanfare();
            this.particles.addTrauma(0.25);
            this.particles.spawnExplosion(dialPos.x, dialPos.y, '#FBBF24', 32);
            this.particles.showFloatingText(`🎯 SWEET SPOT! +${pts} PTS! 🔓`, dialPos.x, dialPos.y - 75, '#FBBF24', 24);
            lock.recentMood = 'triumph';
            lock.moodTimer = 1.0;
          } else {
            this.audio.playLaser();
            this.particles.showFloatingText(`TUMBLER ${lock.crackedTumblers} / 3! +${pts} PTS 🔓`, dialPos.x, dialPos.y - 70, '#10B981', 22);
            this.particles.spawnSparks(dialPos.x, dialPos.y, '#34D399', 24);
            lock.recentMood = 'happy';
            lock.moodTimer = 0.8;
          }

          if (lock.crackedTumblers >= this.maxTumblers) {
            lock.isUnlocked = true;
            this.audio.playFanfare();
            this.particles.showFloatingText('VAULT OPENED! 🏆', dialPos.x, dialPos.y - 100, '#F59E0B', 28);
            this.particles.spawnSparks(dialPos.x, dialPos.y, '#FBBF24', 40);
            this.particles.addTrauma(0.4);
            this.isFinished = true;
          }
        } else {
          // Jammed / Missed!
          lock.jamTimer = 0.65;
          lock.recentMood = 'shocked';
          lock.moodTimer = 0.8;
          this.audio.playExplosion();
          const dialPos = this.getDialPosition(lock.id, width, height);
          this.particles.showFloatingText('LOCK JAMMED! ⚠️', dialPos.x, dialPos.y - 70, '#EF4444', 20);
          this.particles.spawnSparks(dialPos.x, dialPos.y, '#EF4444', 16);
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private getDialPosition(pid: PlayerId, width: number, height: number): { x: number; y: number } {
    const active = this.getActivePlayers();
    if (active.length === 2) {
      const isFirst = active[0] && pid === active[0].id;
      return {
        x: isFirst ? width * 0.28 : width * 0.72,
        y: height * 0.52
      };
    }
    const idx = active.findIndex((p) => p.id === pid);
    const validIdx = idx !== -1 ? idx : pid;
    const col = validIdx % 2;
    const row = Math.floor(validIdx / 2);
    return {
      x: col === 0 ? width * 0.28 : width * 0.72,
      y: row === 0 ? height * 0.35 : height * 0.72
    };
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const lock = this.locks.get(botId);
    if (!lock || lock.isUnlocked || lock.jamTimer > 0) return;

    let cd = (this.botReactionTimers.get(botId) || 0) - dt;
    this.botReactionTimers.set(botId, cd);

    const curTarget = lock.targets[lock.crackedTumblers];
    if (!curTarget) return;

    const needle = lock.currentAngle;
    const targetStart = curTarget.startAngle;
    const effectiveSpan = curTarget.spanAngle * (lock.isUnderdog ? 1.35 : 1.0);

    let diff = (needle - targetStart) % (Math.PI * 2);
    if (diff < 0) diff += Math.PI * 2;

    const centerT = effectiveSpan / 2;
    const distToCenter = Math.abs(diff - centerT);

    if (difficulty === 'bot_hard') {
      // Hard bot strikes precisely near center sweet spot
      if (distToCenter < 0.12 && cd <= 0) {
        this.input.setBotInput(botId, true);
        this.botReactionTimers.set(botId, 0.4);
      } else {
        this.input.setBotInput(botId, false);
      }
    } else if (difficulty === 'bot_normal') {
      // Normal bot strikes anywhere in the comfortable mid-sector
      if (diff >= 0.08 && diff <= effectiveSpan - 0.08 && cd <= 0) {
        this.input.setBotInput(botId, true);
        this.botReactionTimers.set(botId, 0.5);
      } else {
        this.input.setBotInput(botId, false);
      }
    } else {
      // Easy bot strikes with late reaction or misses slightly
      if (diff <= effectiveSpan * 1.15 && cd <= 0) {
        if (Math.random() < 0.08) {
          this.input.setBotInput(botId, true);
          this.botReactionTimers.set(botId, 0.6);
        } else if (diff >= 0.15 && diff <= effectiveSpan) {
          this.input.setBotInput(botId, true);
          this.botReactionTimers.set(botId, 0.6);
        }
      } else {
        this.input.setBotInput(botId, false);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const theme = SAFE_THEMES[this.currentThemeIndex];
    const isSuddenDeath = this.roundTimer <= 15;

    // 1. Reinforced Bank Vault Steel Wall
    const steelGrad = ctx.createLinearGradient(0, 0, width, height);
    steelGrad.addColorStop(0, theme.bgGradTop);
    steelGrad.addColorStop(0.5, theme.bgGradBot);
    steelGrad.addColorStop(1, theme.bgGradTop);
    ctx.fillStyle = steelGrad;
    ctx.fillRect(0, 0, width, height);

    // Steel plate rivets
    ctx.fillStyle = theme.rivetColor;
    const rivetDist = 48;
    for (let x = 20; x < width; x += rivetDist) {
      ctx.beginPath();
      ctx.arc(x, 20, 3, 0, Math.PI * 2);
      ctx.arc(x, height - 20, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let y = 20; y < height; y += rivetDist) {
      ctx.beginPath();
      ctx.arc(20, y, 3, 0, Math.PI * 2);
      ctx.arc(width - 20, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Header Instruction (Safely placed at y=56 below stopwatch timer)
    ctx.save();
    const pillW = 340;
    const pillH = 26;
    const pillX = width / 2 - pillW / 2;
    const pillY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 13);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#F87171' : theme.themePillColor;
    ctx.font = '800 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const bannerMsg = isSuddenDeath
      ? '⚡ SUDDEN DEATH: 2X SWEET SPOT BOUNTY! ⚡'
      : 'TAP WHEN DIAL HITS GREEN SECTOR • HIT CENTER SWEET SPOT!';
    ctx.fillText(bannerMsg, width / 2, pillY + pillH / 2);
    ctx.restore();

    // Render Dials for Active Players
    for (const lock of this.locks.values()) {
      const pos = this.getDialPosition(lock.id, width, height);
      this.renderVaultDial(ctx, lock, pos.x, pos.y, theme);
    }

    // Interactive Bottom-Left Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
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

    // On-screen Controls Pill (Offset to right, never overlapping theme pill)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.font = '600 11px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('Tap Action / Space / Enter to Lock Tumbler • Center Sweet Spot = Bonus', width - 24, height - 28);
    ctx.restore();

    ctx.restore();
  }

  private renderVaultDial(
    ctx: CanvasRenderingContext2D,
    lock: VaultLock,
    cx: number,
    cy: number,
    theme: SafeTheme
  ): void {
    const p = this.players[lock.id];
    const dialRadius = 104;

    ctx.save();
    // Clatter tremor shake offset
    const shakeY = (Math.random() - 0.5) * lock.shakeOffset;
    ctx.translate(cx, cy + shakeY);

    // Underdog Stethoscope Golden Aura
    if (lock.isUnderdog) {
      ctx.save();
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, dialRadius + 32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#FBBF24';
      ctx.font = '800 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⭐ UNDERDOG +35% SECTOR', 0, -dialRadius - 38);
    }

    // Vault Door Circular Rim
    ctx.fillStyle = theme.doorRim;
    ctx.beginPath();
    ctx.arc(0, 0, dialRadius + 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = p.color;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Vault Door Body
    const doorGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, dialRadius);
    doorGrad.addColorStop(0, theme.doorGradOuter);
    doorGrad.addColorStop(0.7, theme.doorGradInner);
    doorGrad.addColorStop(1, '#020617');
    ctx.fillStyle = doorGrad;
    ctx.beginPath();
    ctx.arc(0, 0, dialRadius, 0, Math.PI * 2);
    ctx.fill();

    // Heavy Dial Notch Ticks
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 2;
    for (let i = 0; i < 36; i++) {
      const angle = (i * Math.PI * 2) / 36;
      const r1 = dialRadius - 8;
      const r2 = dialRadius - (i % 3 === 0 ? 18 : 12);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * r1, Math.sin(angle) * r1);
      ctx.lineTo(Math.cos(angle) * r2, Math.sin(angle) * r2);
      ctx.stroke();
    }

    // Active Target Sector
    const curTarget = lock.targets[lock.crackedTumblers];
    if (curTarget && !lock.isUnlocked) {
      const effectiveSpan = curTarget.spanAngle * (lock.isUnderdog ? 1.35 : 1.0);

      // Outer Target Sector
      ctx.save();
      ctx.fillStyle = lock.jamTimer > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.45)';
      ctx.strokeStyle = lock.jamTimer > 0 ? '#EF4444' : theme.targetGreen;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, dialRadius - 10, curTarget.startAngle, curTarget.startAngle + effectiveSpan);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Golden Center Sweet Spot
      const sweetStart = curTarget.startAngle + effectiveSpan * 0.38;
      const sweetSpan = effectiveSpan * 0.24;
      ctx.fillStyle = 'rgba(251, 191, 36, 0.7)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, dialRadius - 10, sweetStart, sweetStart + sweetSpan);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 3 Tumbler LED Progress Dots
    const dotSpacing = 28;
    const dotStartX = -dotSpacing;
    for (let i = 0; i < this.maxTumblers; i++) {
      const dx = dotStartX + i * dotSpacing;
      const dy = 55;
      const isCracked = i < lock.crackedTumblers;

      ctx.save();
      ctx.fillStyle = isCracked ? '#10B981' : '#334155';
      ctx.beginPath();
      ctx.arc(dx, dy, 7, 0, Math.PI * 2);
      ctx.fill();

      if (isCracked) {
        ctx.shadowColor = '#10B981';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#A7F3D0';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Central Spinning Dial Needle
    ctx.save();
    ctx.rotate(lock.currentAngle);

    // Heavy Chrome Needle
    ctx.fillStyle = lock.jamTimer > 0 ? '#EF4444' : theme.needleColor;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(dialRadius - 12, 0);
    ctx.lineTo(0, 6);
    ctx.lineTo(-18, 0);
    ctx.closePath();
    ctx.fill();

    // Vibrant needle tip
    ctx.fillStyle = lock.jamTimer > 0 ? '#F87171' : theme.targetGreen;
    ctx.beginPath();
    ctx.moveTo(dialRadius - 32, -4);
    ctx.lineTo(dialRadius - 10, 0);
    ctx.lineTo(dialRadius - 32, 4);
    ctx.closePath();
    ctx.fill();

    // Central Dial Knob Hub
    const hubGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 22);
    hubGrad.addColorStop(0, '#CBD5E1');
    hubGrad.addColorStop(0.8, '#475569');
    hubGrad.addColorStop(1, '#1E293B');
    ctx.fillStyle = hubGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Mascot Safe-Cracker Face
    this.drawPlayerMascot(ctx, lock.id, 0, -dialRadius - 18, 14, lock.recentMood, performance.now() * 0.001);

    // Player Label Badge
    ctx.save();
    ctx.fillStyle = p.color;
    ctx.font = '800 13px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name.toUpperCase()} (${lock.crackedTumblers}/3) [${lock.score} PTS]`, 0, -dialRadius + 2);

    if (lock.jamTimer > 0) {
      ctx.fillStyle = '#EF4444';
      ctx.font = '800 13px sans-serif';
      ctx.fillText('JAMMED!', 0, 85);
    } else if (lock.isUnlocked) {
      ctx.fillStyle = '#F59E0B';
      ctx.font = '900 16px Montserrat, sans-serif';
      ctx.fillText('UNLOCKED! 💰', 0, 85);
    }
    ctx.restore();

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.locks.values()].sort((a, b) => {
      if (a.isUnlocked && !b.isUnlocked) return -1;
      if (b.isUnlocked && !a.isUnlocked) return 1;
      if (b.crackedTumblers !== a.crackedTumblers) return b.crackedTumblers - a.crackedTumblers;
      return b.score - a.score;
    });
    const winner = sorted[0];
    const isDraw =
      sorted.length > 1 &&
      sorted[0].crackedTumblers === sorted[1].crackedTumblers &&
      sorted[0].score === sorted[1].score &&
      !sorted[0].isUnlocked;

    return {
      winnerId: isDraw ? null : winner.id,
      rankings: sorted.map((l, i) => ({
        playerId: l.id,
        score: l.score,
        place: i + 1
      })),
      mvpHighlight: isDraw
        ? 'Stalemate! Safe tumblers remained unbroken.'
        : `${this.players[winner.id].name} cracked the safe combination with ${winner.score} score bounty!`
    };
  }
}
