import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter } from '../core/CharacterRenderer';

interface ThumbFighter {
  id: PlayerId;
  color: string;
  colorLight: string;
  name: string;
  baseX: number;
  baseY: number;
  thumbX: number;
  thumbY: number;
  angle: number;
  extendDist: number;
  stamina: number;
  pinProgress: number;
  score: number;
  isLunging: boolean;
  lungeTimer: number;
  cooldown: number;
  pinnedTimer: number;
  botReactionTimer: number;
}

export class ThumbWarWrestleGame extends BaseGame {
  private fighters: ThumbFighter[] = [];
  private ringPhase: number = 0;
  private grappleZoneTimer: number = 0;
  private isGoldStrikeWindow: boolean = false;
  private strikeRingRadius: number = 70;
  private winnerId: PlayerId | null = null;

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

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 30.0;
    this.winnerId = null;
    this.ringPhase = 0;
    this.grappleZoneTimer = 1.6;
    this.isGoldStrikeWindow = false;
    this.strikeRingRadius = 70;
    this.input.setControlMode('single_button');

    const active = this.getActivePlayers();
    const cx = width / 2;
    const cy = height / 2 + 10;
    const ringR = Math.min(width, height) * 0.34;

    this.fighters = active.map((p, idx) => {
      let baseAngle = 0;
      if (active.length === 2) {
        baseAngle = idx === 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      } else {
        const cornerAngles = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.75, Math.PI * 0.25];
        baseAngle = cornerAngles[p.id] ?? (idx * Math.PI * 0.5);
      }
      const bx = cx + Math.cos(baseAngle) * ringR;
      const by = cy + Math.sin(baseAngle) * ringR;
      const aimToCenter = Math.atan2(cy - by, cx - bx);

      return {
        id: p.id,
        color: p.color,
        colorLight: p.colorLight,
        name: p.name,
        baseX: bx,
        baseY: by,
        thumbX: bx + Math.cos(aimToCenter) * 42,
        thumbY: by + Math.sin(aimToCenter) * 42,
        angle: aimToCenter,
        extendDist: 42,
        stamina: 100,
        pinProgress: 0,
        score: 0,
        isLunging: false,
        lungeTimer: 0,
        cooldown: 0,
        pinnedTimer: 0,
        botReactionTimer: 0.25 + Math.random() * 0.35
      };
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    this.ringPhase += dt * 4.0;
    const cx = width / 2;
    const cy = height / 2 + 10;
    const ringR = Math.min(width, height) * 0.34;

    this.grappleZoneTimer -= dt;
    if (this.grappleZoneTimer <= 0) {
      this.isGoldStrikeWindow = !this.isGoldStrikeWindow;
      this.grappleZoneTimer = this.isGoldStrikeWindow ? 1.15 : 1.45 + Math.random() * 0.8;
      if (this.isGoldStrikeWindow) {
        this.audio.playMenuTick();
        this.particles.showFloatingText('⚡ PIN WINDOW OPEN! SLAM NOW! ⚡', cx, cy - ringR - 22, '#FBBF24', 18);
      }
    }

    this.strikeRingRadius = 56 + Math.sin(this.ringPhase * 1.5) * 16;
    this.updateBots(dt, width, height);

    for (let i = 0; i < this.fighters.length; i++) {
      const f = this.fighters[i];

      let baseAngle = 0;
      if (this.fighters.length === 2) {
        baseAngle = i === 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      } else {
        const cornerAngles = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.75, Math.PI * 0.25];
        baseAngle = cornerAngles[f.id] ?? (i * Math.PI * 0.5);
      }
      f.baseX = cx + Math.cos(baseAngle) * ringR;
      f.baseY = cy + Math.sin(baseAngle) * ringR;
      const centerAngle = Math.atan2(cy - f.baseY, cx - f.baseX);

      if (f.cooldown > 0) f.cooldown = Math.max(0, f.cooldown - dt);
      if (f.pinnedTimer > 0) {
        f.pinnedTimer = Math.max(0, f.pinnedTimer - dt);
        f.extendDist = 28;
        f.thumbX = f.baseX + Math.cos(f.angle) * f.extendDist;
        f.thumbY = f.baseY + Math.sin(f.angle) * f.extendDist;
        continue;
      }

      const isBot = this.players.find((p) => p.id === f.id)?.type.startsWith('bot_') ?? false;
      let steer = this.input.getSteer(f.id);
      let throttle = this.input.getThrottle(f.id);
      const justTapped = this.input.justPressed(f.id) || this.input.justAction(f.id);
      const justReleased = this.input.justReleased(f.id);
      const holding = this.input.isPressed(f.id) || this.input.isActionPressed(f.id);

      // Direct touch pointer steering for ultra-responsive phone thumb control
      const touchPtr = !isBot ? this.input.getTouchPointer(f.id) : null;
      if (touchPtr && (Math.abs(touchPtr.dx) > 4 || Math.abs(touchPtr.dy) > 4)) {
        steer = Math.max(-1, Math.min(1, touchPtr.dx / 38));
        throttle = Math.max(-1, Math.min(1, -touchPtr.dy / 38));
      }

      // Compute lateral weave angle from player's thumb drag / steer input
      const isBottomPlayer = Math.sin(baseAngle) > 0;
      const lateralInput = isBottomPlayer ? -steer : steer;
      const forwardInput = isBottomPlayer ? throttle : -throttle;

      const weaveOffset =
        Math.abs(steer) > 0.08
          ? lateralInput * 0.58
          : Math.sin(this.ringPhase * 1.6 + f.id * 1.7) * 0.18;
      f.angle = centerAngle + weaveOffset;

      // Trigger Pin Lunge on tap OR on quick release after positioning
      if ((justTapped || (justReleased && f.stamina >= 25)) && f.cooldown <= 0 && !f.isLunging) {
        f.isLunging = true;
        f.lungeTimer = 0.28;
        f.cooldown = 0.36;
        f.stamina = Math.max(0, f.stamina - 22);
        this.audio.playWhoosh();
      }

      f.stamina = Math.min(100, f.stamina + dt * 38);

      if (f.isLunging) {
        f.lungeTimer -= dt;
        const maxReach = ringR * 1.04;
        f.extendDist = 42 + Math.sin(Math.max(0, 1 - f.lungeTimer / 0.28) * Math.PI) * (maxReach - 42);
        if (f.lungeTimer <= 0) {
          f.isLunging = false;
        }
      } else if (holding) {
        const desiredReach = ringR * Math.max(0.38, Math.min(0.92, 0.72 + forwardInput * 0.22));
        f.extendDist += (desiredReach - f.extendDist) * Math.min(1, dt * 14);
      } else {
        f.extendDist += (44 - f.extendDist) * Math.min(1, dt * 10);
      }

      f.thumbX = f.baseX + Math.cos(f.angle) * f.extendDist;
      f.thumbY = f.baseY + Math.sin(f.angle) * f.extendDist;
    }

    // Check thumb-on-thumb pin collisions & grapple holds in the center ring
    for (let i = 0; i < this.fighters.length; i++) {
      for (let j = i + 1; j < this.fighters.length; j++) {
        const a = this.fighters[i];
        const b = this.fighters[j];
        if (a.pinnedTimer > 0 || b.pinnedTimer > 0) continue;

        const dx = b.thumbX - a.thumbX;
        const dy = b.thumbY - a.thumbY;
        const dist = Math.hypot(dx, dy);

        if (dist < 48) {
          const midX = (a.thumbX + b.thumbX) / 2;
          const midY = (a.thumbY + b.thumbY) / 2;
          const bonusPts = this.isGoldStrikeWindow ? 2 : 1;

          if (a.isLunging && !b.isLunging) {
            a.score += bonusPts;
            b.pinnedTimer = 0.85;
            a.isLunging = false;
            a.pinProgress = 0;
            this.audio.playHitStopThud();
            this.particles.spawnExplosion(midX, midY, a.color, 18);
            this.particles.shake(0.35);
            this.particles.showFloatingText(
              this.isGoldStrikeWindow ? `🔥 GOLD PIN! +2` : `👍 PIN SLAM! +1`,
              midX,
              midY - 18,
              a.colorLight,
              18
            );
          } else if (b.isLunging && !a.isLunging) {
            b.score += bonusPts;
            a.pinnedTimer = 0.85;
            b.isLunging = false;
            b.pinProgress = 0;
            this.audio.playHitStopThud();
            this.particles.spawnExplosion(midX, midY, b.color, 18);
            this.particles.shake(0.35);
            this.particles.showFloatingText(
              this.isGoldStrikeWindow ? `🔥 GOLD PIN! +2` : `👍 PIN SLAM! +1`,
              midX,
              midY - 18,
              b.colorLight,
              18
            );
          } else if (a.isLunging && b.isLunging) {
            a.isLunging = false;
            b.isLunging = false;
            a.cooldown = 0.3;
            b.cooldown = 0.3;
            this.audio.playBounce();
            this.particles.spawnSparks(midX, midY, '#FBBF24', 20);
            this.particles.showFloatingText('💥 THUMB CLASH!', midX, midY - 16, '#FBBF24', 16);
          } else {
            // Sustained Grapple Hold: whoever is extending further & holding builds Pin Progress!
            const aHold = this.input.isPressed(a.id);
            const bHold = this.input.isPressed(b.id);
            if (aHold && !bHold) {
              a.pinProgress += dt * 2.4;
              if (a.pinProgress >= 1.0) {
                a.pinProgress = 0;
                a.score += bonusPts;
                b.pinnedTimer = 0.8;
                this.audio.playHitStopThud();
                this.particles.spawnExplosion(midX, midY, a.color, 16);
                this.particles.showFloatingText(`👍 HOLD PIN! +${bonusPts}`, midX, midY - 18, a.colorLight, 17);
              }
            } else if (bHold && !aHold) {
              b.pinProgress += dt * 2.4;
              if (b.pinProgress >= 1.0) {
                b.pinProgress = 0;
                b.score += bonusPts;
                a.pinnedTimer = 0.8;
                this.audio.playHitStopThud();
                this.particles.spawnExplosion(midX, midY, b.color, 16);
                this.particles.showFloatingText(`👍 HOLD PIN! +${bonusPts}`, midX, midY - 18, b.colorLight, 17);
              }
            }
          }
        }
      }
    }

    for (const f of this.fighters) {
      if (f.score >= 5) {
        this.winnerId = f.id;
        this.isFinished = true;
        return;
      }
    }

    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      const sorted = [...this.fighters].sort((a, b) => b.score - a.score);
      if (sorted.length > 0 && (sorted.length === 1 || sorted[0].score > sorted[1].score)) {
        this.winnerId = sorted[0].id;
      }
      this.isFinished = true;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const f = this.fighters.find((x) => x.id === botId);
    if (!f) return;
    f.botReactionTimer -= dt;
    if (f.botReactionTimer > 0) return;

    const rate = difficulty === 'bot_hard' ? 0.16 : difficulty === 'bot_normal' ? 0.28 : 0.45;
    f.botReactionTimer = rate + Math.random() * 0.18;

    const shouldLunge = this.isGoldStrikeWindow || Math.random() < (difficulty === 'bot_hard' ? 0.65 : 0.42);
    this.input.setBotInput(f.id, shouldLunge, (Math.random() - 0.5) * 0.8, 0, shouldLunge);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2 + 10;
    const ringR = Math.min(width, height) * 0.36;

    const bgGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(width, height) * 0.7);
    bgGrad.addColorStop(0, '#1E1B4B');
    bgGrad.addColorStop(0.6, '#0F172A');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, ringR + 18, 0, Math.PI * 2);
    ctx.fillStyle = '#334155';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#94A3B8';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    const matGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, ringR);
    matGrad.addColorStop(0, this.isGoldStrikeWindow ? '#422006' : '#1E293B');
    matGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = matGrad;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = this.isGoldStrikeWindow ? '#FBBF24' : '#38BDF8';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, this.strikeRingRadius, 0, Math.PI * 2);
    ctx.fillStyle = this.isGoldStrikeWindow ? 'rgba(251, 191, 36, 0.22)' : 'rgba(56, 189, 248, 0.10)';
    ctx.fill();
    ctx.lineWidth = this.isGoldStrikeWindow ? 3 : 2;
    ctx.strokeStyle = this.isGoldStrikeWindow ? '#FBBF24' : 'rgba(56, 189, 248, 0.45)';
    ctx.stroke();

    ctx.fillStyle = this.isGoldStrikeWindow ? '#FDE047' : '#94A3B8';
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.isGoldStrikeWindow ? '⚡ 2X PIN ZONE! ⚡' : '1-2-3-4 THUMB WAR!', cx, cy + 4);
    ctx.restore();

    for (const f of this.fighters) {
      ctx.save();

      ctx.strokeStyle = f.color;
      ctx.lineWidth = 26;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(f.baseX, f.baseY);
      ctx.lineTo(f.thumbX, f.thumbY);
      ctx.stroke();

      ctx.strokeStyle = f.colorLight;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(f.baseX, f.baseY);
      ctx.lineTo(f.thumbX, f.thumbY);
      ctx.stroke();

      const thumbRadius = f.isLunging ? 26 : 21;
      ctx.beginPath();
      ctx.arc(f.thumbX, f.thumbY, thumbRadius, 0, Math.PI * 2);
      ctx.fillStyle = f.pinnedTimer > 0 ? '#64748B' : f.color;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      ctx.save();
      ctx.translate(f.thumbX, f.thumbY);
      ctx.rotate(f.angle);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(4, 0, thumbRadius * 0.55, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.fill();
      ctx.restore();

      drawCharacter(
        ctx,
        f.baseX,
        f.baseY,
        18,
        f.id,
        false,
        f.pinnedTimer > 0 ? 'shocked' : f.isLunging ? 'triumph' : 'focused',
        this.ringPhase
      );

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${f.name}: ${f.score}/5`, f.baseX, f.baseY + (f.baseY > cy ? 30 : -24));
      ctx.restore();
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.fighters].sort((a, b) => b.score - a.score);
    const rankings = sorted.map((f, idx) => ({
      playerId: f.id,
      score: f.score,
      place: idx + 1
    }));
    const top = sorted[0];
    const isTie = sorted.length > 1 && sorted[0].score === sorted[1].score && this.winnerId === null;
    const winnerId = isTie ? null : (this.winnerId ?? top?.id ?? null);

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} dominated the Thumb Ring!` : 'Deadlocked Thumb Grapple!'
    };
  }
}
