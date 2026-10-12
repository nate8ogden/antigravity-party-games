import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CoasterPlayer {
  id: PlayerId;
  distance: number;
  speed: number;
  braking: boolean;
  derailed: boolean;
  recoverTimer: number;
  score: number;
  thrillCombo: number;
}

export class RollerCoasterBrakeGame extends BaseGame {
  private playersState: Map<PlayerId, CoasterPlayer> = new Map();
  private trackLength: number = 2400;

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
    this.playersState.clear();

    const active = this.getActivePlayers();
    active.forEach((p) => {
      this.playersState.set(p.id, {
        id: p.id,
        distance: 0,
        speed: 180,
        braking: false,
        derailed: false,
        recoverTimer: 0,
        score: 0,
        thrillCombo: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.derailed) {
        ps.recoverTimer -= dt;
        if (ps.recoverTimer <= 0) {
          ps.derailed = false;
          ps.speed = 140;
        }
        continue;
      }

      const wantsBrake = this.input.isPressed(p.id);
      ps.braking = wantsBrake;

      // Track curvature at current distance
      const curveIntensity = this.getCurveDanger(ps.distance);

      if (ps.braking) {
        ps.speed = Math.max(80, ps.speed - dt * 380);
        // Brake sparks
        if (Math.random() < 0.3) {
          this.particles.spawnDust(width * 0.45, height * 0.5, 2);
        }
      } else {
        // Accelerate on slopes
        ps.speed = Math.min(460, ps.speed + dt * 220);
      }

      // Check danger curve speed limit
      if (curveIntensity > 0.7) {
        if (ps.speed > 260) {
          // Derailed!
          ps.derailed = true;
          ps.recoverTimer = 1.2;
          ps.thrillCombo = 0;
          this.audio.playExplosion();
          this.particles.shake(0.35);
          this.particles.showFloatingText('DERAILED! SLOW DOWN!', width * 0.5, height * 0.45, '#EF4444', 24);
        } else if (ps.speed > 160 && ps.braking) {
          // Perfect Braking Thrill!
          ps.thrillCombo++;
          const thrillPts = 10 * ps.thrillCombo;
          ps.score += thrillPts;
          this.audio.playBoost();
          this.particles.showFloatingText(`THRILL x${ps.thrillCombo}! +${thrillPts}`, width * 0.5, height * 0.45, '#F59E0B', 18);
        }
      }

      ps.distance = (ps.distance + ps.speed * dt) % this.trackLength;
      ps.score += Math.floor(ps.speed * dt * 0.1);
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private getCurveDanger(dist: number): number {
    // Sharp curves at repeating track intervals
    const phase = (dist % 600) / 600;
    if (phase > 0.4 && phase < 0.65) {
      return Math.sin(((phase - 0.4) / 0.25) * Math.PI);
    }
    return 0;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Twilight Fairground Amusement Park Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(0.6, '#312E81');
    bgGrad.addColorStop(1, '#1E1B4B');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Distant carnival skyline (Ferris Wheel silhouette)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width * 0.85, height * 0.35, 60, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Draw Roller Coaster Tracks for each player lane
    const active = this.getActivePlayers();
    const count = active.length;
    const laneH = (height * 0.7) / count;

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      if (!ps) return;
      const laneY = 70 + idx * laneH + laneH * 0.5;

      // Wooden Trestle Support Beams
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 4;
      for (let tx = 20; tx < width; tx += 48) {
        ctx.beginPath();
        ctx.moveTo(tx, laneY);
        ctx.lineTo(tx - 12, height);
        ctx.moveTo(tx, laneY);
        ctx.lineTo(tx + 12, height);
        ctx.stroke();
      }

      // Track Rails (Undulating sine hills)
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 10) {
        const worldX = ps.distance + x;
        const hill = Math.sin(worldX * 0.015) * 24 + Math.sin(worldX * 0.04) * 12;
        if (x === 0) ctx.moveTo(x, laneY + hill);
        else ctx.lineTo(x, laneY + hill);
      }
      ctx.stroke();

      // Sharp Danger Warning Zones
      const curveDanger = this.getCurveDanger(ps.distance + width * 0.5);
      if (curveDanger > 0.4) {
        ctx.fillStyle = '#EF4444';
        ctx.font = '900 13px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠ DANGER CURVE: BRAKE!', width * 0.5, laneY - 45);
      }

      // Player Coaster Car
      const carX = width * 0.35;
      const carHill = Math.sin((ps.distance + carX) * 0.015) * 24 + Math.sin((ps.distance + carX) * 0.04) * 12;
      const carY = laneY + carHill - 14;

      ctx.save();
      ctx.translate(carX, carY);

      if (ps.derailed) {
        ctx.rotate(0.5);
        ctx.fillStyle = '#EF4444';
        ctx.font = '16px sans-serif';
        ctx.fillText('💥', 0, 0);
      } else {
        // Coaster Car Body
        ctx.fillStyle = p.color;
        ctx.fillRect(-22, -10, 44, 20);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.strokeRect(-22, -10, 44, 20);

        // Wheels
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(-14, 11, 5, 0, Math.PI * 2);
        ctx.arc(14, 11, 5, 0, Math.PI * 2);
        ctx.fill();

        // Brake indicator / Thrill flames
        if (ps.braking) {
          ctx.fillStyle = '#F59E0B';
          ctx.font = 'bold 9px sans-serif';
          ctx.fillText('BRAKE', -16, -15);
        }
      }
      ctx.restore();

      // Player Info & Speed Gauge
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 12px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${p.name} | SCORE: ${ps.score} | SPEED: ${Math.round(ps.speed)} MPH`, 24, laneY - 26);
    });

    // 3. Header HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 35);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.derailed) return;

    const danger = this.getCurveDanger(ps.distance + 80);
    const speedThreshold = difficulty === 'bot_hard' ? 220 : difficulty === 'bot_normal' ? 180 : 150;

    if (danger > 0.5 && ps.speed > speedThreshold) {
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
      mvpHighlight: winnerId ? `${winnerId} conquered the extreme roller coaster drops!` : 'Coaster halted!'
    };
  }
}
