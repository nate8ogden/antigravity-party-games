import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CloverPad {
  x: number;
  y: number;
  radius: number;
  isGolden: boolean;
  points: number;
}

interface GrasshopperPlayer {
  id: PlayerId;
  laneY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  charge: number; // 0 to 1
  isCharging: boolean;
  isAirborne: boolean;
  score: number;
}

export class GrasshopperHighJumpGame extends BaseGame {
  private playersState: Map<PlayerId, GrasshopperPlayer> = new Map();
  private pads: CloverPad[] = [];

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
    this.pads = [];
    this.playersState.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneH = (height - 80) / count;

    active.forEach((p, idx) => {
      const laneY = 70 + idx * laneH + laneH / 2;
      this.playersState.set(p.id, {
        id: p.id,
        laneY,
        x: 50,
        y: laneY,
        vx: 0,
        vy: 0,
        charge: 0,
        isCharging: false,
        isAirborne: false,
        score: 0
      });

      // Spawn clover pads along lane
      for (let x = 160; x < width - 40; x += 110) {
        const isGold = Math.random() < 0.3;
        this.pads.push({
          x,
          y: laneY + 8,
          radius: 20,
          isGolden: isGold,
          points: isGold ? 35 : 20
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

      if (!ps.isAirborne) {
        if (isPressed) {
          ps.isCharging = true;
          ps.charge = Math.min(1.0, ps.charge + dt * 2.2);
        } else if (justReleased || (!isPressed && ps.isCharging)) {
          // Launch High Jump!
          ps.isCharging = false;
          ps.isAirborne = true;
          const power = 300 + ps.charge * 320;
          ps.vx = power * 0.7;
          ps.vy = -power * 0.8;
          ps.charge = 0;
          this.audio.playWhoosh();
          this.particles.spawnDust(ps.x, ps.laneY, 5);
        }
      } else {
        // Airborne trajectory
        ps.vy += 800 * dt; // Gravity
        ps.x += ps.vx * dt;
        ps.y += ps.vy * dt;

        // Check landing on lane ground
        if (ps.y >= ps.laneY) {
          ps.y = ps.laneY;
          ps.vy = 0;
          ps.vx = 0;
          ps.isAirborne = false;

          // Check if landed on or near a clover pad
          const landedPad = this.pads.find(
            (pad) => Math.abs(pad.y - (ps.laneY + 8)) < 15 && Math.abs(ps.x - pad.x) < pad.radius + 10
          );

          if (landedPad) {
            ps.score += landedPad.points;
            this.audio.playScore();
            this.particles.showFloatingText(`+${landedPad.points} CLOVER!`, ps.x, ps.y - 20, landedPad.isGolden ? '#FBBF24' : '#10B981', 20);
            this.particles.spawnConfetti(ps.x, ps.y, 8);
          } else {
            this.audio.playBounce();
          }

          // Reached track end -> reset position with bonus
          if (ps.x > width - 50) {
            ps.score += 40;
            this.audio.playScore();
            this.particles.showFloatingText('LAWN CLEARED! +40', width - 80, ps.laneY - 24, '#FBBF24', 22);
            this.particles.spawnConfetti(width - 80, ps.laneY, 14);
            ps.x = 50;
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Sunny Summer Garden Lawn
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

      // Divider line
      if (idx > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 70 + idx * laneH);
        ctx.lineTo(width, 70 + idx * laneH);
        ctx.stroke();
      }

      // Lawn Grass Ground line
      ctx.fillStyle = '#166534';
      ctx.fillRect(0, laneY + 6, width, 12);
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(0, laneY + 4, width, 2);

      // Draw Clover Pads
      for (const pad of this.pads) {
        if (Math.abs(pad.y - (laneY + 8)) > 15) continue;
        ctx.save();
        ctx.translate(pad.x, pad.y);

        // 3-leaf clover
        ctx.fillStyle = pad.isGolden ? '#FBBF24' : '#10B981';
        for (let a = 0; a < Math.PI * 2; a += (Math.PI * 2) / 3) {
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * 8, Math.sin(a) * 8, 7, 5, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Draw Grasshopper
      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Charge power spring coil indicator
      if (ps.isCharging) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(-18, -30, 36, 6);
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(-18, -30, 36 * ps.charge, 6);
      }

      // Grasshopper Body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, -2, 14, 6, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Powerful Hind Legs
      ctx.strokeStyle = '#84CC16';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(-14, -12 + (ps.isCharging ? 6 : 0));
      ctx.lineTo(-6, 6);
      ctx.stroke();

      // Antennae
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(12, -4);
      ctx.lineTo(20, -12);
      ctx.stroke();
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
    if (!ps || ps.isAirborne) return;

    if (ps.isCharging) {
      const idealCharge = difficulty === 'bot_hard' ? 0.75 : difficulty === 'bot_normal' ? 0.6 : 0.45;
      if (ps.charge >= idealCharge) {
        // Release to jump!
        this.input.setBotInput(botId, false, 0, 0, false);
      } else {
        this.input.setBotInput(botId, true, 0, 0, false);
      }
    } else {
      // Begin charge
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
      mvpHighlight: winnerId ? `${winnerId} launched towering grasshopper leaps across the garden clover!` : 'Tied high jumps!'
    };
  }
}
