import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface QuantumBarrier {
  x: number;
  cleared: boolean;
}

interface ParticleRunner {
  id: PlayerId;
  laneY: number;
  isPhased: boolean; // true = wave / intangible, false = solid particle
  coherence: number; // 0 to 100
  score: number;
  speed: number;
  stumbleTimer: number;
  barriers: QuantumBarrier[];
  spawnTimer: number;
}

export class QuantumTunnelingGame extends BaseGame {
  public runners: Map<PlayerId, ParticleRunner> = new Map();
  public currentMapName: string = 'CERN Quantum Accelerator Ring';
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
    this.runners.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    active.forEach((p, idx) => {
      const laneY = 70 + idx * laneHeight + laneHeight * 0.5;
      this.runners.set(p.id, {
        id: p.id,
        laneY,
        isPhased: false,
        coherence: 100,
        score: 0,
        speed: 260,
        stumbleTimer: 0,
        barriers: [],
        spawnTimer: 0.6 + Math.random() * 0.4
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

    const playerX = 80;

    this.runners.forEach(r => {
      if (r.stumbleTimer > 0) {
        r.stumbleTimer -= dt;
        r.speed = 100;
      } else {
        r.speed = Math.min(400, r.speed + dt * 10);
      }

      r.score += Math.round(r.speed * dt * 0.1);

      // Check phase shift input
      r.isPhased = this.input.isPressed(r.id);

      if (r.isPhased) {
        r.coherence = Math.max(0, r.coherence - dt * 35);
        if (r.coherence <= 0) {
          r.isPhased = false; // Depleted coherence forces collapse to solid!
        }
        if (Math.random() < 0.3) {
          this.particles.emit(playerX, r.laneY, 2, 'rgba(0, 229, 255, 0.6)');
        }
      } else {
        r.coherence = Math.min(100, r.coherence + dt * 45);
      }

      // Spawn barriers
      r.spawnTimer -= dt;
      if (r.spawnTimer <= 0) {
        r.spawnTimer = 1.0 + Math.random() * 0.8;
        r.barriers.push({
          x: width + 20,
          cleared: false
        });
      }

      // Move barriers
      for (let i = r.barriers.length - 1; i >= 0; i--) {
        const b = r.barriers[i];
        b.x -= r.speed * dt;

        // Collision detection at playerX = 80
        if (!b.cleared && Math.abs(b.x - playerX) < 18) {
          b.cleared = true;
          if (r.isPhased) {
            // Tunnelled cleanly!
            r.score += 35;
            this.audio.playTone(660, 0.1, 'sine');
            this.particles.emit(playerX, r.laneY, 8, '#00ffff');
          } else {
            // Smashed into solid hadron wall!
            r.stumbleTimer = 1.0;
            r.score = Math.max(0, r.score - 25);
            this.audio.playTone(130, 0.25, 'sawtooth');
            this.particles.emit(playerX, r.laneY, 15, '#ff0055');
          }
        }

        if (b.x < -30) {
          r.barriers.splice(i, 1);
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
    const r = this.runners.get(botId);
    if (!r || r.stumbleTimer > 0) return;

    let bTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botReactionTimers.set(botId, bTimer);
      return;
    }

    const playerX = 80;
    const upcoming = r.barriers.find(b => !b.cleared && b.x > playerX && b.x < playerX + 110);

    if (upcoming && r.coherence > 15) {
      const accuracy = difficulty === 'bot_hard' ? 0.95 : difficulty === 'bot_normal' ? 0.80 : 0.55;
      if (Math.random() < accuracy) {
        this.input.setBotState(botId, true); // Hold to phase shift
        this.botReactionTimers.set(botId, 0.35);
        return;
      }
    } else {
      this.input.setBotState(botId, false); // Release to recharge
    }

    this.botReactionTimers.set(botId, 0.08);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Accelerator Tunnel Background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#060914');
    grad.addColorStop(0.5, '#0f172e');
    grad.addColorStop(1, '#070a17');
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
    ctx.fillText('HOLD TO PHASE-SHIFT & TUNNEL THROUGH QUANTUM BARRIERS!', width * 0.5, 69);
    ctx.restore();

    const playerX = 80;
    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    // Render Accelerator Rails
    this.runners.forEach(r => {
      const cfg = this.players.find(p => p.id === r.id);
      const laneY = r.laneY;

      // Magnetic Rail
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(20, laneY + 12);
      ctx.lineTo(width - 20, laneY + 12);
      ctx.stroke();

      // Barriers
      r.barriers.forEach(b => {
        if (b.cleared) return;
        ctx.fillStyle = '#ff0055';
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 8;
        ctx.fillRect(b.x - 6, laneY - 20, 12, 32);
        ctx.shadowBlur = 0;
      });

      // Quantum Particle / Wave
      ctx.save();
      ctx.translate(playerX, laneY);

      if (r.isPhased) {
        // Intangible glowing wave packet
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Solid dense particle
        ctx.fillStyle = cfg?.color || '#ff007f';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Coherence meter & score
      ctx.fillStyle = cfg?.color || '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${cfg?.name || 'Player'}: ${r.score}m (Coherence: ${Math.round(r.coherence)}%)`, 20, laneY - laneHeight * 0.32);
    });
  }

  private finishRound(): void {
    this.isFinished = true;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.runners.forEach((r, pId) => scores.set(pId, r.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.runners.entries())
      .map(([playerId, r]) => ({ playerId, score: r.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} dissolved subatomic barriers with quantum ease!` : 'Waveforms collapsed!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
