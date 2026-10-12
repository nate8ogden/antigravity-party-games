import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface DewDrop {
  x: number;
  y: number;
  type: 'DEW' | 'SPROUT';
  points: number;
  collected: boolean;
}

interface InchwormPlayer {
  id: PlayerId;
  laneY: number;
  headX: number;
  tailX: number;
  archHeight: number; // 0 (flat) to 22 (arched)
  isContracting: boolean;
  score: number;
}

export class CaterpillarInchwormGame extends BaseGame {
  private playersState: Map<PlayerId, InchwormPlayer> = new Map();
  private drops: DewDrop[] = [];

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
    this.drops = [];
    this.playersState.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneH = (height - 80) / count;

    active.forEach((p, idx) => {
      const laneY = 70 + idx * laneH + laneH / 2;
      this.playersState.set(p.id, {
        id: p.id,
        laneY,
        headX: 70,
        tailX: 35,
        archHeight: 0,
        isContracting: false,
        score: 0
      });
    });

    this.spawnDewDrops(width, height);
  }

  private spawnDewDrops(width: number, height: number): void {
    const active = this.getActivePlayers();
    const count = active.length;
    const laneH = (height - 80) / count;

    this.drops = [];
    active.forEach((_, idx) => {
      const laneY = 70 + idx * laneH + laneH / 2;
      for (let x = 120; x < width - 40; x += 85) {
        const isSprout = Math.random() < 0.3;
        this.drops.push({
          x,
          y: laneY - 14,
          type: isSprout ? 'SPROUT' : 'DEW',
          points: isSprout ? 30 : 15,
          collected: false
        });
      }
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      const isPressed = this.input.isPressed(p.id);
      const justReleased = this.input.justReleased(p.id);

      if (isPressed) {
        // Phase 1: Contract tail forward, building body arch
        if (!ps.isContracting) {
          ps.isContracting = true;
          this.audio.playSqueak();
        }
        ps.archHeight = Math.min(24, ps.archHeight + dt * 140);
        // Pull tail towards head
        const idealGap = 16;
        if (ps.headX - ps.tailX > idealGap) {
          ps.tailX += (ps.headX - ps.tailX - idealGap) * dt * 12;
        }
      } else if (justReleased || (!isPressed && ps.isContracting)) {
        // Phase 2: Extend head forward vigorously!
        ps.isContracting = false;
        const extensionPower = (ps.archHeight / 24) * 48 + 15;
        ps.headX += extensionPower;
        ps.archHeight = 0;
        this.audio.playBounce();
        this.particles.spawnDust(ps.tailX, ps.laneY + 4, 3);
      }

      // Check collecting dew drops
      for (const d of this.drops) {
        if (!d.collected && Math.abs(d.y - (ps.laneY - 14)) < 20 && Math.abs(ps.headX - d.x) < 20) {
          d.collected = true;
          ps.score += d.points;
          this.audio.playScore();
          this.particles.showFloatingText(`+${d.points}`, d.x, d.y - 14, d.type === 'SPROUT' ? '#10B981' : '#38BDF8', 18);
          this.particles.spawnConfetti(d.x, d.y, 6);
        }
      }

      // Reached branch end -> wrap back with lap bonus
      if (ps.headX > width - 30) {
        ps.score += 40;
        this.audio.playScore();
        this.particles.showFloatingText('BRANCH CROSSED! +40', width - 60, ps.laneY - 24, '#FBBF24', 22);
        this.particles.spawnConfetti(width - 60, ps.laneY, 12);
        ps.headX = 70;
        ps.tailX = 35;
        ps.archHeight = 0;
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Garden Morning Dawn
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#064E3B');
    bgGrad.addColorStop(0.6, '#065F46');
    bgGrad.addColorStop(1, '#022C22');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    const laneH = (height - 80) / count;

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      if (!ps) return;
      const laneY = 70 + idx * laneH + laneH / 2;

      // Wooden garden twig branch
      ctx.fillStyle = '#78350F';
      ctx.fillRect(0, laneY + 6, width, 12);
      ctx.strokeStyle = '#451A03';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, laneY + 6, width, 12);

      // Little green rose leaves growing along branch
      ctx.fillStyle = '#10B981';
      for (let x = 60; x < width; x += 110) {
        ctx.beginPath();
        ctx.ellipse(x, laneY + 16, 12, 6, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Dew Drops & Sprouts in this lane
      for (const d of this.drops) {
        if (d.collected || Math.abs(d.y - (laneY - 14)) > 20) continue;
        ctx.save();
        ctx.translate(d.x, d.y);

        if (d.type === 'DEW') {
          // Glistening morning water droplet
          ctx.fillStyle = '#38BDF8';
          ctx.beginPath();
          ctx.arc(0, 4, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(-2, 2, 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Tender green leaf sprout
          ctx.fillStyle = '#84CC16';
          ctx.beginPath();
          ctx.ellipse(0, 2, 8, 4, -0.3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Draw Caterpillar
      ctx.save();
      const midX = (ps.headX + ps.tailX) / 2;
      const archY = laneY + 6 - ps.archHeight;

      // Arched green segmented body
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ps.tailX, laneY + 4);
      ctx.quadraticCurveTo(midX, archY, ps.headX, laneY + 4);
      ctx.stroke();

      // Caterpillar Head
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(ps.headX + 4, laneY + 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Antennae
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ps.headX + 4, laneY - 4);
      ctx.lineTo(ps.headX + 10, laneY - 12);
      ctx.stroke();

      // Little eye
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(ps.headX + 6, laneY, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${p.name}: ${ps.score}`, 16, laneY - 18);
    });

    // Header HUD
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
    if (!ps) return;

    // Rhythmic contraction and extension loop
    if (ps.isContracting) {
      const idealArch = difficulty === 'bot_hard' ? 22 : difficulty === 'bot_normal' ? 18 : 12;
      if (ps.archHeight >= idealArch) {
        // Release to spring forward!
        this.input.setBotInput(botId, false, 0, 0, false);
      } else {
        this.input.setBotInput(botId, true, 0, 0, false);
      }
    } else {
      // Begin contract
      this.input.setBotInput(botId, true, 0, 0, false);
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
      mvpHighlight: winnerId ? `${winnerId} inched smoothly down the garden twigs!` : 'Tied caterpillar inching!'
    };
  }
}
