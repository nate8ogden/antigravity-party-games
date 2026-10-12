import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface TumblerTarget {
  startAngle: number;
  spanAngle: number;
  speed: number;
  direction: 1 | -1;
}

interface VaultLock {
  id: PlayerId;
  crackedTumblers: number; // 0 to 3
  currentAngle: number; // in radians
  jamTimer: number; // lockout timer on false tap
  targets: TumblerTarget[];
  doorOpenAnim: number; // 0 to 1
  isUnlocked: boolean;
}

export class SafeDialGame extends BaseGame {
  private locks: Map<PlayerId, VaultLock> = new Map();
  private maxTumblers: number = 3;
  private botReactionTimers: Map<PlayerId, number> = new Map();

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
    this.locks.clear();

    const active = this.getActivePlayers();
    active.forEach((p) => {
      // Define 3 tumbler challenges
      const t1Start = Math.random() * Math.PI * 2;
      const t2Start = Math.random() * Math.PI * 2;
      const t3Start = Math.random() * Math.PI * 2;

      this.locks.set(p.id, {
        id: p.id,
        crackedTumblers: 0,
        currentAngle: 0,
        jamTimer: 0,
        doorOpenAnim: 0,
        isUnlocked: false,
        targets: [
          { startAngle: t1Start, spanAngle: 0.75, speed: 2.0, direction: 1 },
          { startAngle: t2Start, spanAngle: 0.58, speed: 2.6, direction: -1 },
          { startAngle: t3Start, spanAngle: 0.46, speed: 3.2, direction: 1 }
        ]
      });
    });

    // Expose debug hook for verification and tests
    (window as any).__SAFE_DIAL_DEBUG__ = {
      getLocks: () => Array.from(this.locks.values()).map(l => ({
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
        lock.currentAngle += curTarget.speed * curTarget.direction * dt;
        // Normalize angle to [0, 2PI)
        const twoPi = Math.PI * 2;
        lock.currentAngle = ((lock.currentAngle % twoPi) + twoPi) % twoPi;
      }

      // Check player inputs (both single-button justPressed and action)
      const pressed = (this.input.justPressed(lock.id) || this.input.justAction(lock.id)) && lock.jamTimer <= 0;

      if (pressed && curTarget) {
        // Test if needle is within green target sector
        const needle = lock.currentAngle;
        const targetStart = curTarget.startAngle;
        const targetSpan = curTarget.spanAngle;

        const twoPi = Math.PI * 2;
        let diff = (needle - targetStart) % twoPi;
        if (diff < 0) diff += twoPi;

        // Generous grace buffer (0.08 rad ~ 4.6 deg) so edges register reliably
        const grace = 0.08;
        const isHit = diff <= (targetSpan + grace) || diff >= (twoPi - grace);

        if (isHit) {
          // SUCCESSFUL TUMBLER CRACK!
          lock.crackedTumblers++;
          this.audio.playLaser();
          const dialPos = this.getDialPosition(lock.id, width, height);
          this.particles.showFloatingText(`TUMBLER ${lock.crackedTumblers} / 3! 🔓`, dialPos.x, dialPos.y - 70, '#10B981', 22);
          this.particles.spawnSparks(dialPos.x, dialPos.y, '#34D399', 24);

          if (lock.crackedTumblers >= this.maxTumblers) {
            lock.isUnlocked = true;
            this.audio.playFanfare();
            this.particles.showFloatingText('VAULT OPENED! 🏆', dialPos.x, dialPos.y - 100, '#F59E0B', 28);
            this.particles.spawnSparks(dialPos.x, dialPos.y, '#FBBF24', 40);
            this.particles.addTrauma(0.4);
            this.isFinished = true;
          }
        } else {
          // JAMMED / MISSED!
          lock.jamTimer = 0.65;
          this.audio.playExplosion();
          const dialPos = this.getDialPosition(lock.id, width, height);
          this.particles.showFloatingText('LOCK JAMMED! ⚠️', dialPos.x, dialPos.y - 70, '#EF4444', 20);
          this.particles.spawnSparks(dialPos.x, dialPos.y, '#EF4444', 15);
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
    // 3 or 4 players quadrant
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
    const targetSpan = curTarget.spanAngle;

    let diff = (needle - targetStart) % (Math.PI * 2);
    if (diff < 0) diff += Math.PI * 2;

    // Center of green zone
    const centerT = targetSpan / 2;
    const distToCenter = Math.abs(diff - centerT);

    // AI timing accuracy based on difficulty
    if (difficulty === 'bot_hard') {
      // Hard bot strikes precisely near center of zone
      if (distToCenter < 0.12 && cd <= 0) {
        this.input.setBotInput(botId, true);
        this.botReactionTimers.set(botId, 0.4);
      } else {
        this.input.setBotInput(botId, false);
      }
    } else if (difficulty === 'bot_normal') {
      // Normal bot strikes anywhere in the comfortable mid-sector
      if (diff >= 0.08 && diff <= targetSpan - 0.08 && cd <= 0) {
        this.input.setBotInput(botId, true);
        this.botReactionTimers.set(botId, 0.5);
      } else {
        this.input.setBotInput(botId, false);
      }
    } else {
      // Easy bot strikes with late reaction or misses slightly
      if (diff <= targetSpan * 1.15 && cd <= 0) {
        // 25% chance of misjudging and jamming
        if (Math.random() < 0.08) {
          this.input.setBotInput(botId, true);
          this.botReactionTimers.set(botId, 0.6);
        } else if (diff >= 0.15 && diff <= targetSpan) {
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

    // 1. Heavy Reinforced Bank Vault Steel Wall
    const steelGrad = ctx.createLinearGradient(0, 0, width, height);
    steelGrad.addColorStop(0, '#0F172A');
    steelGrad.addColorStop(0.5, '#1E293B');
    steelGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = steelGrad;
    ctx.fillRect(0, 0, width, height);

    // Steel plate rivets
    ctx.fillStyle = '#475569';
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

    // Header Instruction
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '900 24px Montserrat, sans-serif';
    ctx.fillText('SAFE DIAL LOCK • CRACK 3 TUMBLERS', width / 2, 76);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 14px sans-serif';
    ctx.fillText('Tap when the spinning dial enters the green sector • Do not jam!', width / 2, 98);
    ctx.restore();

    // Render Dials for Active Players
    for (const lock of this.locks.values()) {
      const pos = this.getDialPosition(lock.id, width, height);
      this.renderVaultDial(ctx, lock, pos.x, pos.y);
    }

    ctx.restore();
  }

  private renderVaultDial(
    ctx: CanvasRenderingContext2D,
    lock: VaultLock,
    cx: number,
    cy: number
  ): void {
    const p = this.players[lock.id];
    const dialRadius = 110;

    ctx.save();
    ctx.translate(cx, cy);

    // Vault Door Circular Rim
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(0, 0, dialRadius + 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = p.color;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Vault Door Body
    const doorGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, dialRadius);
    doorGrad.addColorStop(0, '#1E293B');
    doorGrad.addColorStop(0.7, '#0F172A');
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

    // Active Green Target Sector
    const curTarget = lock.targets[lock.crackedTumblers];
    if (curTarget && !lock.isUnlocked) {
      ctx.save();
      ctx.fillStyle = lock.jamTimer > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.45)';
      ctx.strokeStyle = lock.jamTimer > 0 ? '#EF4444' : '#10B981';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, dialRadius - 10, curTarget.startAngle, curTarget.startAngle + curTarget.spanAngle);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
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

    // Central Spinning Dial Needle (pointing along positive X to align with angle 0)
    ctx.save();
    ctx.rotate(lock.currentAngle);

    // Heavy Chrome Needle
    ctx.fillStyle = lock.jamTimer > 0 ? '#EF4444' : '#F8FAFC';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(dialRadius - 12, 0);
    ctx.lineTo(0, 6);
    ctx.lineTo(-18, 0);
    ctx.closePath();
    ctx.fill();

    // Vibrant needle indicator tip pointing directly at target arc
    ctx.fillStyle = lock.jamTimer > 0 ? '#F87171' : '#34D399';
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

    // Player Label Badge
    ctx.save();
    ctx.fillStyle = p.color;
    ctx.font = '800 15px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name.toUpperCase()} (${lock.crackedTumblers}/3)`, 0, -dialRadius - 16);

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
      return b.crackedTumblers - a.crackedTumblers;
    });
    const winner = sorted[0];
    const isDraw = sorted.length > 1 && sorted[0].crackedTumblers === sorted[1].crackedTumblers && !sorted[0].isUnlocked;

    return {
      winnerId: isDraw ? null : winner.id,
      rankings: sorted.map((l, i) => ({
        playerId: l.id,
        score: l.crackedTumblers,
        place: i + 1
      })),
      mvpHighlight: isDraw
        ? 'Stalemate! Safe tumblers remained unbroken.'
        : `${this.players[winner.id].name} cracked the safe combination with ${winner.crackedTumblers}/3 tumblers!`
    };
  }
}
