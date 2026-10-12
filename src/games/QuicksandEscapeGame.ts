import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SwingRope {
  x: number;
  width: number;
  active: boolean;
}

interface QuicksandPlayer {
  id: PlayerId;
  x: number;
  depth: number; // 0 = surface/rescued, 100 = submerged
  isEscaped: boolean;
  escapeTimer: number;
  stamina: number;
  score: number;
}

export class QuicksandEscapeGame extends BaseGame {
  private playersState: Map<PlayerId, QuicksandPlayer> = new Map();
  private ropes: SwingRope[] = [];
  private ropeSpawnTimer: number = 0;
  private bubbleTimer: number = 0;

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
    this.roundTimer = 30;
    this.ropeSpawnTimer = 1.0;
    this.bubbleTimer = 0;
    this.ropes = [];
    this.playersState.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        depth: 40,
        isEscaped: false,
        escapeTimer: 0,
        stamina: 100,
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.bubbleTimer += dt;
    this.updateBots(dt, width, height);

    // Periodic overhead vine ropes
    this.ropeSpawnTimer -= dt;
    if (this.ropeSpawnTimer <= 0) {
      this.ropeSpawnTimer = 2.4;
      const rx = 60 + Math.random() * (width - 120);
      this.ropes.push({ x: rx, width: 44, active: true });
    }

    // Clean old ropes
    if (this.ropes.length > 4) this.ropes.shift();

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.isEscaped) {
        ps.escapeTimer -= dt;
        if (ps.escapeTimer <= 0) {
          ps.isEscaped = false;
          ps.depth = 35; // Back into sand for more points
        }
        continue;
      }

      // Natural quicksand sinking suction
      const sinkSpeed = 22 + (ps.depth / 100) * 15;
      ps.depth += sinkSpeed * dt;

      // Vigorous tap to kick up
      const tap = this.input.justPressed(p.id);
      if (tap) {
        ps.depth = Math.max(0, ps.depth - 14);
        ps.score += 2;
        this.audio.playSqueak();
        this.particles.spawnDust(ps.x, height * 0.65, 3);
      }

      // Check grab overhead rope
      const isHolding = this.input.isPressed(p.id);
      if (isHolding && ps.depth < 30) {
        const nearRope = this.ropes.find((r) => r.active && Math.abs(ps.x - r.x) < r.width);
        if (nearRope) {
          nearRope.active = false;
          ps.isEscaped = true;
          ps.escapeTimer = 2.0;
          ps.depth = 0;
          ps.score += 40;
          this.audio.playScore();
          this.particles.showFloatingText('HOISTED! +40', ps.x, height * 0.35, '#10B981', 24);
          this.particles.spawnConfetti(ps.x, height * 0.35, 14);
        }
      }

      // Completely submerged!
      if (ps.depth >= 100) {
        ps.depth = 50;
        ps.score = Math.max(0, ps.score - 10);
        this.audio.playStun();
        this.particles.showFloatingText('SUNK! -10', ps.x, height * 0.75, '#EF4444', 20);
        this.particles.spawnExplosion(ps.x, height * 0.75, '#78350F', 12);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Prehistoric Jungle Canopy & Quicksand Mud Basin
    const mudY = height * 0.48;
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#064E3B');
    bgGrad.addColorStop(mudY / height, '#065F46');
    bgGrad.addColorStop(mudY / height, '#78350F');
    bgGrad.addColorStop(1, '#451A03');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Quicksand Mud Surface Ripples
    ctx.fillStyle = '#92400E';
    ctx.fillRect(0, mudY - 6, width, 12);

    // Mud Bubbles
    for (let i = 0; i < 6; i++) {
      const bx = (width / 6) * i + ((this.bubbleTimer * 20 + i * 40) % 50);
      const bRad = 6 + Math.sin(this.bubbleTimer * 3 + i) * 3;
      ctx.fillStyle = '#B45309';
      ctx.beginPath();
      ctx.arc(bx, mudY, bRad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Overhead Rescue Ropes
    for (const r of this.ropes) {
      if (!r.active) continue;
      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(r.x, 0);
      ctx.lineTo(r.x, mudY - 24);
      ctx.stroke();

      // Golden safety loop handle
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(r.x, mudY - 24, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 8px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GRAB', r.x, mudY - 21);
      ctx.restore();
    }

    // 2. Draw Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      const playerY = ps.isEscaped ? mudY - 70 : mudY + (ps.depth / 100) * 80;
      ctx.translate(ps.x, playerY);

      // Sinking depth indicator bar next to player
      if (!ps.isEscaped) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(18, -25, 6, 50);
        const fillH = (ps.depth / 100) * 50;
        ctx.fillStyle = ps.depth > 70 ? '#EF4444' : ps.depth > 40 ? '#F59E0B' : '#10B981';
        ctx.fillRect(18, -25 + (50 - fillH), 6, fillH);
      }

      // Player circle body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Raised rescue hands
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-10, -4);
      ctx.lineTo(-14, -18);
      ctx.moveTo(10, -4);
      ctx.lineTo(14, -18);
      ctx.stroke();

      ctx.restore();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      const statusText = ps.isEscaped ? 'RESCUED!' : `${Math.floor(ps.depth)}% Sunk`;
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, mudY - 80);
      ctx.font = '700 9px monospace';
      ctx.fillStyle = ps.isEscaped ? '#10B981' : '#F59E0B';
      ctx.fillText(statusText, ps.x, mudY - 68);
    }

    // 3. Header HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.isEscaped) return;

    // Check overhead rope
    const nearRope = this.ropes.find((r) => r.active && Math.abs(ps.x - r.x) < r.width);
    if (nearRope && ps.depth < 30) {
      // Hold to grab rope!
      this.input.setBotInput(botId, true, 0, 0, false);
      return;
    }

    // Tap to kick mud based on depth
    const threshold = difficulty === 'bot_hard' ? 25 : difficulty === 'bot_normal' ? 40 : 60;
    if (ps.depth > threshold) {
      this.input.setBotInput(botId, true, 0, 0, true);
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public getScore(playerId: PlayerId): number {
    return this.playersState.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} escaped the treacherous quicksand pit!` : 'Tied quicksand escape!'
    };
  }
}
