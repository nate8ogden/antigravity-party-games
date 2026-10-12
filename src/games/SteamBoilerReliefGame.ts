import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface BoilerChamber {
  id: PlayerId;
  cx: number;
  cy: number;
  pressure: number; // 0 to 100
  heatRate: number;
  venting: boolean;
  score: number;
  blowoutTimer: number;
  whistlePitch: number;
  steamAnim: number;
}

export class SteamBoilerReliefGame extends BaseGame {
  public chambers: Map<PlayerId, BoilerChamber> = new Map();
  public currentMapName: string = 'Royal Ironworks Locomotive Boiler';
  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 35.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 35.0;
    this.chambers.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      let cx = width * 0.25;
      let cy = height * 0.35;
      if (count === 2) {
        cx = idx === 0 ? width * 0.3 : width * 0.7;
        cy = height * 0.55;
      } else {
        if (idx === 1) cx = width * 0.75;
        if (idx === 2) { cx = width * 0.25; cy = height * 0.75; }
        if (idx === 3) { cx = width * 0.75; cy = height * 0.75; }
      }

      this.chambers.set(p.id, {
        id: p.id,
        cx,
        cy,
        pressure: 20 + Math.random() * 20,
        heatRate: 22 + Math.random() * 8,
        venting: false,
        score: 0,
        blowoutTimer: 0,
        whistlePitch: 300,
        steamAnim: 0
      });

      this.botReactionTimers.set(p.id, 0.2 + Math.random() * 0.3);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.finishRound();
      return;
    }

    this.updateBots(dt, width, height);

    this.chambers.forEach(ch => {
      if (ch.blowoutTimer > 0) {
        ch.blowoutTimer -= dt;
        ch.pressure = Math.max(10, ch.pressure - dt * 25);
        if (Math.random() < 0.4) {
          this.particles.emit(ch.cx, ch.cy - 30, 2, '#444444');
        }
        return;
      }

      // Check input
      ch.venting = this.input.isPressed(ch.id);

      if (ch.venting) {
        // Venting steam drops pressure
        ch.pressure -= dt * 45;
        ch.steamAnim += dt * 8;
        if (Math.random() < 0.5) {
          this.particles.emit(ch.cx, ch.cy - 45, 3, 'rgba(255, 255, 255, 0.85)');
        }

        // Scoring based on pressure range
        if (ch.pressure >= 78 && ch.pressure <= 95) {
          // Optimum superheated steam band!
          ch.score += Math.round(dt * 60);
          if (Math.random() < 0.2) {
            this.audio.playTone(550, 0.05, 'sine');
          }
        } else if (ch.pressure > 40) {
          ch.score += Math.round(dt * 15);
        }

        if (ch.pressure < 5) ch.pressure = 5;
      } else {
        // Coal furnace heats boiler
        ch.pressure += ch.heatRate * dt;
        if (ch.pressure >= 100) {
          // Overpressure BLOWOUT!
          ch.pressure = 100;
          ch.blowoutTimer = 2.0;
          ch.score = Math.max(0, ch.score - 50);
          this.audio.playTone(110, 0.5, 'sawtooth');
          this.particles.emit(ch.cx, ch.cy - 20, 25, '#ff4500');
          this.particles.emit(ch.cx, ch.cy - 40, 20, '#ffffff');
        }
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _w: number,
    _h: number
  ): void {
    const ch = this.chambers.get(botId);
    if (!ch || ch.blowoutTimer > 0) return;

    let bTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botReactionTimers.set(botId, bTimer);
      return;
    }

    const highThreshold = difficulty === 'bot_hard' ? 92 : difficulty === 'bot_normal' ? 88 : 82;
    const lowThreshold = difficulty === 'bot_hard' ? 80 : difficulty === 'bot_normal' ? 70 : 55;

    if (ch.pressure >= highThreshold) {
      this.input.setBotState(botId, true);
    } else if (ch.pressure <= lowThreshold) {
      this.input.setBotState(botId, false);
    }

    const checkInterval = difficulty === 'bot_hard' ? 0.06 : difficulty === 'bot_normal' ? 0.12 : 0.24;
    this.botReactionTimers.set(botId, checkInterval);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Industrial Foundry Background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#121317');
    grad.addColorStop(0.5, '#201b15');
    grad.addColorStop(1, '#151412');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Piping architecture
    ctx.strokeStyle = 'rgba(180, 110, 40, 0.15)';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(20, height * 0.55);
    ctx.lineTo(width - 20, height * 0.55);
    ctx.stroke();

    // HUD Instructions
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 180, 56, 360, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#ffb366';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOLD TO VENT STEAM! KEEP PRESSURE IN GOLD ZONE (80-95)!', width * 0.5, 69);
    ctx.restore();

    // Render Chambers
    this.chambers.forEach(ch => {
      const cfg = this.players.find(p => p.id === ch.id);
      const isBlowout = ch.blowoutTimer > 0;

      // Boiler Tank Hull
      ctx.save();
      ctx.fillStyle = '#262423';
      ctx.strokeStyle = isBlowout ? '#ff3311' : (cfg?.color || '#d4af37');
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(ch.cx - 80, ch.cy - 70, 160, 140, 16);
      ctx.fill();
      ctx.stroke();

      // Top Vent Chimney
      ctx.fillStyle = '#3a342e';
      ctx.fillRect(ch.cx - 14, ch.cy - 92, 28, 22);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 2;
      ctx.strokeRect(ch.cx - 14, ch.cy - 92, 28, 22);

      // Steam Plume from Chimney
      if (ch.venting && !isBlowout) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.moveTo(ch.cx - 10, ch.cy - 92);
        ctx.lineTo(ch.cx - 24, ch.cy - 125);
        ctx.lineTo(ch.cx + 24, ch.cy - 125);
        ctx.lineTo(ch.cx + 10, ch.cy - 92);
        ctx.closePath();
        ctx.fill();
      }

      // Pressure Gauge Face
      const gx = ch.cx;
      const gy = ch.cy - 5;
      const r = 42;

      ctx.fillStyle = '#f8f4e6';
      ctx.beginPath();
      ctx.arc(gx, gy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8b5a2b';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Gauge Color Bands
      const startA = Math.PI * 0.75;
      const totalA = Math.PI * 1.5;

      // Green band (0 to 60)
      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(gx, gy, r - 6, startA, startA + totalA * 0.6);
      ctx.stroke();

      // Gold optimal band (75 to 95)
      ctx.strokeStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(gx, gy, r - 6, startA + totalA * 0.75, startA + totalA * 0.95);
      ctx.stroke();

      // Red Danger band (95 to 100)
      ctx.strokeStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(gx, gy, r - 6, startA + totalA * 0.95, startA + totalA);
      ctx.stroke();

      // Needle
      const needleAngle = startA + (ch.pressure / 100) * totalA;
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + Math.cos(needleAngle) * (r - 10), gy + Math.sin(needleAngle) * (r - 10));
      ctx.stroke();

      // Needle cap
      ctx.fillStyle = '#333333';
      ctx.beginPath();
      ctx.arc(gx, gy, 4, 0, Math.PI * 2);
      ctx.fill();

      // PSI text
      ctx.fillStyle = '#222222';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(ch.pressure)} PSI`, gx, gy + 22);

      // Warning or status text
      if (isBlowout) {
        ctx.fillStyle = '#ff3300';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('BLOWOUT!', ch.cx, ch.cy + 52);
      } else if (ch.pressure >= 78 && ch.pressure <= 95) {
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('OPTIMUM POWER!', ch.cx, ch.cy + 52);
      } else {
        ctx.fillStyle = cfg?.color || '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`${cfg?.name || 'Player'}: ${ch.score} HP`, ch.cx, ch.cy + 52);
      }

      ctx.restore();
    });
  }

  private finishRound(): void {
    this.isFinished = true;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.chambers.forEach((c, pId) => scores.set(pId, c.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.chambers.entries())
      .map(([playerId, c]) => ({ playerId, score: c.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} regulated supreme boiler horsepower!` : 'Boilers depressurized!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
