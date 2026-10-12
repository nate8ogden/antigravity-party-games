import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface PulsarStation {
  id: PlayerId;
  x: number;
  y: number;
  sweepAngle: number; // 0 to 2pi dish azimuth
  beamAngle: number; // pulsar emission cone
  spinSpeed: number; // rotation frequency
  isBeaming: boolean;
  score: number;
  combo: number;
  staggerTimer: number;
  lockAnim: number;
}

export class PulsarSignalGame extends BaseGame {
  public stations: Map<PlayerId, PulsarStation> = new Map();
  public currentMapName: string = 'Crab Nebula Radio Observatory';
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
    this.stations.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    active.forEach((p, idx) => {
      const cx = idx * colWidth + colWidth * 0.5;
      this.stations.set(p.id, {
        id: p.id,
        x: cx,
        y: height * 0.58,
        sweepAngle: 0,
        beamAngle: Math.PI * 0.5,
        spinSpeed: 2.2 + Math.random() * 0.6,
        isBeaming: false,
        score: 0,
        combo: 0,
        staggerTimer: 0,
        lockAnim: 0,
      });
      this.botReactionTimers.set(p.id, 0);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      return;
    }

    this.updateBots(dt, width, height);

    this.stations.forEach((st) => {
      const p = this.getPlayer(st.id);

      if (st.staggerTimer > 0) st.staggerTimer -= dt;
      if (st.lockAnim > 0) st.lockAnim = Math.max(0, st.lockAnim - dt * 3);

      // Sweep the dish antenna angle continuously
      st.sweepAngle = (st.sweepAngle + st.spinSpeed * dt) % (Math.PI * 2);

      // Human input
      if (p && !p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(st.id) || this.input.justAction(st.id);
        if (justPressed && st.staggerTimer <= 0) {
          this.tuneFrequency(st);
        }
      }
    });
  }

  private tuneFrequency(st: PulsarStation): void {
    // Check alignment between antenna sweep and the target pulsar beam
    let diff = Math.abs(st.sweepAngle - st.beamAngle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;

    if (diff < 0.45) {
      // PULSAR SYNCHRONIZED!
      st.lockAnim = 1.0;
      const pts = 35 + st.combo * 5;
      st.score += pts;
      st.combo++;
      // Change to next random beam target angle
      st.beamAngle = (st.beamAngle + 1.2 + Math.random() * 2.5) % (Math.PI * 2);
      st.spinSpeed = Math.min(3.8, st.spinSpeed + 0.15);
      this.audio.playTone(840 + st.combo * 35, 0.15, 'sine');
      this.particles.emit(st.x, st.y - 15, 18, '#00e5ff');
    } else {
      // STATIC NOISE / WHIFF!
      st.staggerTimer = 0.5;
      st.combo = 0;
      st.score = Math.max(0, st.score - 10);
      this.audio.playTone(140, 0.2, 'sawtooth');
      this.particles.emit(st.x, st.y, 8, '#7f8c8d');
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const st = this.stations.get(botId);
    if (!st || st.staggerTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      let diff = Math.abs(st.sweepAngle - st.beamAngle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;

      const tolerance = difficulty === 'bot_hard' ? 0.40 : difficulty === 'bot_normal' ? 0.32 : 0.22;
      if (diff < tolerance) {
        this.tuneFrequency(st);
        bTimer = 0.45;
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Deep cosmos Crab Nebula background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#070b14');
    bgGrad.addColorStop(0.5, '#121d30');
    bgGrad.addColorStop(1, '#05070d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    this.stations.forEach((st, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#00e5ff';

      // Observatory pedestal
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(st.x - 30, st.y + 40, 60, 20);

      // Rotating Radio Telescope Dish
      ctx.save();
      ctx.translate(st.x, st.y);

      // Radar scan ring
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 52, 0, Math.PI * 2);
      ctx.stroke();

      // Target Pulsar Emission Beam (Flashing lighthouse sector)
      ctx.strokeStyle = 'rgba(241, 196, 15, 0.45)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 52, st.beamAngle - 0.35, st.beamAngle + 0.35);
      ctx.stroke();

      // Pulsar beam center star
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(Math.cos(st.beamAngle) * 52, Math.sin(st.beamAngle) * 52, 6, 0, Math.PI * 2);
      ctx.fill();

      // Sweep Antenna Needle
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(st.sweepAngle) * 52, Math.sin(st.sweepAngle) * 52);
      ctx.stroke();

      // Telescope dish center
      ctx.fillStyle = '#ecf0f1';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();

      // Lock flash effect
      if (st.lockAnim > 0) {
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 52 + (1 - st.lockAnim) * 25, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      // Frequency readouts
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${st.score}`, st.x, height * 0.88);
      if (st.combo > 1) {
        ctx.fillStyle = '#00e5ff';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${st.combo}x FREQ LOCK`, st.x, height * 0.92);
      }
    });

    // Top instruction pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📡 TAP WHEN DISH ALIGNS WITH GOLD PULSAR BEAM!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.stations.forEach((st, pId) => scores.set(pId, st.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.stations.entries())
      .map(([playerId, st]) => ({ playerId, score: st.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} decoded the pulsar radio frequency!` : 'Signal lost in cosmic static!',
    };
  }
}
