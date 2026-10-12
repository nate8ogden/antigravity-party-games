import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface MonocycleRider {
  id: PlayerId;
  laneY: number;
  x: number;
  vx: number;
  leanAngle: number; // in radians, positive = forward lean
  wheelSpin: number;
  wipeoutTimer: number;
  laps: number;
  score: number;
}

export class MonocycleDerbyGame extends BaseGame {
  public riders: Map<PlayerId, MonocycleRider> = new Map();
  public currentMapName: string = 'Crystal Palace Wooden Velodrome';
  private trackLength: number = 800;
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
    this.trackLength = width - 80;
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 35.0;
    this.trackLength = width - 80;
    this.riders.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    active.forEach((p, idx) => {
      const laneY = 70 + idx * laneHeight + laneHeight * 0.5;

      this.riders.set(p.id, {
        id: p.id,
        laneY,
        x: 60,
        vx: 0,
        leanAngle: 0,
        wheelSpin: 0,
        wipeoutTimer: 0,
        laps: 0,
        score: 0
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

    this.riders.forEach(r => {
      if (r.wipeoutTimer > 0) {
        r.wipeoutTimer -= dt;
        r.vx *= 0.92;
        r.x += r.vx * dt;
        return;
      }

      const isPedaling = this.input.isPressed(r.id);

      if (isPedaling) {
        // Accelerate & lean forward
        r.vx += 260 * dt;
        r.leanAngle += 1.8 * dt;

        // Over-torque wipeout threshold (~0.75 rad or ~43 deg)
        if (r.leanAngle > 0.72) {
          r.wipeoutTimer = 1.4;
          r.vx = -40;
          r.leanAngle = 1.2;
          this.audio.playTone(120, 0.35, 'sawtooth');
          this.particles.emit(r.x, r.laneY, 15, '#ff4400');
        }
      } else {
        // Gyroscope auto-corrects lean back to upright
        if (r.leanAngle > 0) {
          r.leanAngle = Math.max(0, r.leanAngle - 2.4 * dt);
        }
      }

      // Drag
      r.vx *= 0.985;
      r.x += r.vx * dt;
      r.wheelSpin += (r.vx / 20) * dt;

      // Track wrap-around / laps
      if (r.x > width - 50) {
        r.x = 60;
        r.laps++;
        r.score = r.laps * 100 + Math.round(r.x);
        this.audio.playTone(520, 0.1, 'sine');
        this.particles.emit(60, r.laneY, 8, '#ffd700');
      } else {
        r.score = r.laps * 100 + Math.round(r.x);
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
    const r = this.riders.get(botId);
    if (!r || r.wipeoutTimer > 0) return;

    let bTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botReactionTimers.set(botId, bTimer);
      return;
    }

    // Bot tries to keep leanAngle in safe sweet spot (~0.45 to 0.6)
    const maxLean = difficulty === 'bot_hard' ? 0.65 : difficulty === 'bot_normal' ? 0.55 : 0.42;

    if (r.leanAngle < maxLean) {
      this.input.setBotState(botId, true);
    } else {
      this.input.setBotState(botId, false);
    }

    const interval = difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.12 : 0.22;
    this.botReactionTimers.set(botId, interval);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Velodrome Polished Wood Plank Background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#2c1e13');
    grad.addColorStop(0.5, '#422c1d');
    grad.addColorStop(1, '#251910');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Track wood grain lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let ly = 60; ly < height; ly += 16) {
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(width, ly);
      ctx.stroke();
    }

    // HUD Instructions
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 170, 56, 340, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#fed7aa';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOLD TO PEDAL! RELEASE BEFORE OVER-LEAN WIPEOUT!', width * 0.5, 69);
    ctx.restore();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    // Render Monocycles
    this.riders.forEach(r => {
      const cfg = this.players.find(p => p.id === r.id);
      const isWiped = r.wipeoutTimer > 0;
      const wheelR = 24;

      // Track lane separator
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.18)';
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(20, r.laneY + laneHeight * 0.48);
      ctx.lineTo(width - 20, r.laneY + laneHeight * 0.48);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.save();
      ctx.translate(r.x, r.laneY);

      // Tilt according to lean angle
      ctx.rotate(isWiped ? 1.4 : r.leanAngle);

      // Outer Wheel Rim (Brass / Wood)
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, wheelR, 0, Math.PI * 2);
      ctx.stroke();

      // Spinning spokes
      ctx.save();
      ctx.rotate(r.wheelSpin);
      ctx.strokeStyle = '#666666';
      ctx.lineWidth = 1.5;
      for (let s = 0; s < 6; s++) {
        const sa = (s / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(sa) * wheelR, Math.sin(sa) * wheelR);
        ctx.stroke();
      }
      ctx.restore();

      // Inner Hub & Rider Seat (Gyroscopically upright)
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();

      // Rider figure inside
      ctx.fillStyle = isWiped ? '#777777' : (cfg?.color || '#ffffff');
      // Head / Cap
      ctx.beginPath();
      ctx.arc(0, -6, 5, 0, Math.PI * 2);
      ctx.fill();

      // Warning angle arch
      if (r.leanAngle > 0.55 && !isWiped) {
        ctx.fillStyle = '#ff3300';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('LEAN DANGER!', 0, -32);
      }

      ctx.restore();

      // Lap & Score Tag
      ctx.fillStyle = cfg?.color || '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${cfg?.name || 'Player'}: Lap ${r.laps} (${Math.round(r.vx)} mph)`, 20, r.laneY - laneHeight * 0.32);
    });
  }

  private finishRound(): void {
    this.isFinished = true;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.riders.forEach((r, pId) => scores.set(pId, r.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.riders.entries())
      .map(([playerId, r]) => ({ playerId, score: r.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} dominated the monocycle velodrome!` : 'Riders tumbled!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
