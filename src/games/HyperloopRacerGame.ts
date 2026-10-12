import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface HyperPod {
  id: PlayerId;
  laneY: number;
  x: number;
  vx: number;
  heat: number; // 0 to 100
  laps: number;
  score: number;
  overheated: boolean;
  overheatTimer: number;
}

export class HyperloopRacerGame extends BaseGame {
  public pods: Map<PlayerId, HyperPod> = new Map();
  public currentMapName: string = 'Trans-Pacific Maglev Hyperloop';
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
    this.pods.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    active.forEach((p, idx) => {
      const laneY = 70 + idx * laneHeight + laneHeight * 0.5;

      this.pods.set(p.id, {
        id: p.id,
        laneY,
        x: 60,
        vx: 80,
        heat: 0,
        laps: 0,
        score: 0,
        overheated: false,
        overheatTimer: 0
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

    this.pods.forEach(pod => {
      if (pod.overheatTimer > 0) {
        pod.overheatTimer -= dt;
        pod.vx *= 0.95;
        pod.x += pod.vx * dt;
        pod.heat = Math.max(0, pod.heat - dt * 40);
        return;
      }

      const isThrusting = this.input.isPressed(pod.id);

      if (isThrusting) {
        // Accelerate
        pod.vx += 320 * dt;
        pod.heat += 45 * dt;

        if (Math.random() < 0.3) {
          this.particles.emit(pod.x - 20, pod.laneY, 2, 'rgba(0, 229, 255, 0.6)');
        }

        if (pod.heat >= 100) {
          // Coil Overheat Scrape!
          pod.overheated = true;
          pod.overheatTimer = 1.3;
          pod.vx = 40;
          this.audio.playTone(130, 0.3, 'sawtooth');
          this.particles.emit(pod.x, pod.laneY, 15, '#ff0055');
        }
      } else {
        // Cooling
        pod.heat = Math.max(0, pod.heat - dt * 50);
      }

      // Natural drag
      pod.vx *= 0.985;
      pod.x += pod.vx * dt;

      // Check lap completion
      if (pod.x > width - 40) {
        pod.x = 50;
        pod.laps++;
        pod.score = pod.laps * 120 + Math.round(pod.x);
        this.audio.playTone(660, 0.1, 'sine');
        this.particles.emit(50, pod.laneY, 10, '#00ffcc');
      } else {
        pod.score = pod.laps * 120 + Math.round(pod.x);
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
    const pod = this.pods.get(botId);
    if (!pod || pod.overheatTimer > 0) return;

    let bTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botReactionTimers.set(botId, bTimer);
      return;
    }

    const heatLimit = difficulty === 'bot_hard' ? 88 : difficulty === 'bot_normal' ? 76 : 60;

    if (pod.heat < heatLimit) {
      this.input.setBotState(botId, true);
    } else {
      this.input.setBotState(botId, false);
    }

    const interval = difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.12 : 0.22;
    this.botReactionTimers.set(botId, interval);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Vacuum Tube Hyperloop Background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#050814');
    grad.addColorStop(0.5, '#0d152e');
    grad.addColorStop(1, '#060a17');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // HUD Instructions
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 170, 56, 340, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOLD TO ENGAGE MAGLEV THRUST! RELEASE TO COOL COILS!', width * 0.5, 69);
    ctx.restore();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    // Render Hyperloop Vacuum Tubes
    this.pods.forEach(pod => {
      const cfg = this.players.find(p => p.id === pod.id);
      const laneY = pod.laneY;

      // Tube Cylinder
      ctx.fillStyle = 'rgba(0, 229, 255, 0.05)';
      ctx.fillRect(20, laneY - 14, width - 40, 28);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, laneY - 14, width - 40, 28);

      // Maglev induction rings along tube
      for (let rx = 60; rx < width - 40; rx += 70) {
        ctx.strokeStyle = 'rgba(255, 0, 128, 0.25)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(rx, laneY, 6, 13, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Pod
      ctx.save();
      ctx.translate(pod.x, laneY);

      // Magnetic levitation glow
      ctx.fillStyle = 'rgba(0, 229, 255, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 8, 16, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pod sleek body
      ctx.fillStyle = pod.overheatTimer > 0 ? '#ff0055' : (cfg?.color || '#00e5ff');
      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Front nose cone
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(14, 0, 6, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Overheat Warning
      if (pod.heat > 75) {
        ctx.fillStyle = '#ff0055';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('HEAT!', 0, -18);
      }

      ctx.restore();

      // Heat Bar & Score
      ctx.fillStyle = cfg?.color || '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${cfg?.name || 'Player'}: Lap ${pod.laps} (${Math.round(pod.vx)} km/h) [Heat: ${Math.round(pod.heat)}%]`, 20, laneY - laneHeight * 0.32);
    });
  }

  private finishRound(): void {
    this.isFinished = true;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.pods.forEach((p, pId) => scores.set(pId, p.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.pods.entries())
      .map(([playerId, p]) => ({ playerId, score: p.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} blasted through the hyperloop at Mach 1!` : 'Hyperloop evacuated!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
