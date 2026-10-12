import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface LightningArc {
  angle: number;
  length: number;
  intensity: number;
  color: string;
}

interface TeslaCollector {
  id: PlayerId;
  angle: number; // sector position around coil
  rodExtended: boolean;
  score: number;
  charge: number; // 0 to 100
  shortCircuitTimer: number;
  sparksAnim: number;
}

export class TeslaCoilArcGame extends BaseGame {
  public collectors: Map<PlayerId, TeslaCollector> = new Map();
  public currentMapName: string = 'Wardenclyffe High-Voltage Laboratory';
  private coilAngle: number = 0;
  private coilSpeed: number = 2.0;
  private arcs: LightningArc[] = [];
  private pulseTimer: number = 0;
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
    this.collectors.clear();
    this.arcs = [];
    this.coilAngle = 0;
    this.coilSpeed = 2.2;
    this.pulseTimer = 0;
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      // Position around circular arena
      const angle = (idx / count) * Math.PI * 2 - Math.PI * 0.5;
      this.collectors.set(p.id, {
        id: p.id,
        angle,
        rodExtended: false,
        score: 0,
        charge: 0,
        shortCircuitTimer: 0,
        sparksAnim: 0
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

    // Rotate central Tesla emitter
    this.coilAngle += this.coilSpeed * dt;
    this.pulseTimer += dt;

    const cx = width * 0.5;
    const cy = height * 0.55;
    const arenaRadius = Math.min(width, height) * 0.36;

    // Generate lightning arcs
    if (this.arcs.length < 3 || Math.random() < 0.2) {
      const arcSpread = (Math.random() - 0.5) * 0.4;
      this.arcs.push({
        angle: this.coilAngle + arcSpread,
        length: arenaRadius * (0.8 + Math.random() * 0.3),
        intensity: 1.0,
        color: Math.random() < 0.8 ? '#00e5ff' : '#d500f9'
      });
      if (this.arcs.length > 5) this.arcs.shift();
    }

    // Decay arcs
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      this.arcs[i].intensity -= dt * 3.5;
      if (this.arcs[i].intensity <= 0) {
        this.arcs.splice(i, 1);
      }
    }

    // Update collectors
    this.collectors.forEach(c => {
      if (c.shortCircuitTimer > 0) {
        c.shortCircuitTimer -= dt;
        c.rodExtended = false;
        if (Math.random() < 0.3) {
          const px = cx + Math.cos(c.angle) * arenaRadius;
          const py = cy + Math.sin(c.angle) * arenaRadius;
          this.particles.emit(px, py, 2, '#555555');
        }
        return;
      }

      c.rodExtended = this.input.isPressed(c.id);

      const px = cx + Math.cos(c.angle) * arenaRadius;
      const py = cy + Math.sin(c.angle) * arenaRadius;

      // Check if any arc overlaps this collector
      this.arcs.forEach(arc => {
        let diff = Math.abs(arc.angle - c.angle);
        while (diff > Math.PI * 2) diff -= Math.PI * 2;
        const angleDiff = Math.min(diff, Math.PI * 2 - diff);

        if (angleDiff < 0.35 && arc.intensity > 0.4) {
          if (c.rodExtended) {
            // Channel lightning into capacitor!
            c.charge += dt * 50;
            c.score += Math.round(dt * 80);
            this.particles.emit(px, py, 4, '#00ffff');
            if (Math.random() < 0.3) {
              this.audio.playTone(520, 0.06, 'sawtooth');
            }
          }
        }
      });
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _w: number,
    _h: number
  ): void {
    const c = this.collectors.get(botId);
    if (!c || c.shortCircuitTimer > 0) return;

    let bTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botReactionTimers.set(botId, bTimer);
      return;
    }

    let diff = Math.abs(this.coilAngle - c.angle);
    while (diff > Math.PI * 2) diff -= Math.PI * 2;
    const angleDiff = Math.min(diff, Math.PI * 2 - diff);

    const threshold = difficulty === 'bot_hard' ? 0.38 : difficulty === 'bot_normal' ? 0.48 : 0.60;
    if (angleDiff < threshold) {
      this.input.setBotState(botId, true);
    } else {
      this.input.setBotState(botId, false);
    }

    const interval = difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.12 : 0.22;
    this.botReactionTimers.set(botId, interval);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // High-Voltage Lab Dark Background
    const grad = ctx.createRadialGradient(width * 0.5, height * 0.55, 10, width * 0.5, height * 0.55, width * 0.6);
    grad.addColorStop(0, '#101524');
    grad.addColorStop(0.6, '#0b0c16');
    grad.addColorStop(1, '#05060a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.55;
    const arenaRadius = Math.min(width, height) * 0.36;

    // HUD Instructions
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 170, 56, 340, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOLD TO EXTEND GROUND ROD WHEN LIGHTNING STRIKES!', width * 0.5, 69);
    ctx.restore();

    // Floor Insulator Rings
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius, 0, Math.PI * 2);
    ctx.arc(cx, cy, arenaRadius * 0.6, 0, Math.PI * 2);
    ctx.stroke();

    // Render Lightning Arcs
    this.arcs.forEach(arc => {
      ctx.save();
      ctx.strokeStyle = arc.color;
      ctx.lineWidth = 3 * arc.intensity;
      ctx.shadowColor = arc.color;
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(cx, cy);

      const segments = 6;
      let currX = cx;
      let currY = cy;
      const targetX = cx + Math.cos(arc.angle) * arc.length;
      const targetY = cy + Math.sin(arc.angle) * arc.length;

      for (let s = 1; s <= segments; s++) {
        const t = s / segments;
        const nx = cx + (targetX - cx) * t + (Math.random() - 0.5) * 24;
        const ny = cy + (targetY - cy) * t + (Math.random() - 0.5) * 24;
        ctx.lineTo(nx, ny);
        currX = nx;
        currY = ny;
      }
      ctx.stroke();
      ctx.restore();
    });

    // Central Tesla Coil Tower
    ctx.save();
    ctx.fillStyle = '#b87333'; // Copper base
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Toroid top electrode
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fill();

    // Spark emitter pointer
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(this.coilAngle) * 32, cy + Math.sin(this.coilAngle) * 32);
    ctx.stroke();
    ctx.restore();

    // Render Collectors
    this.collectors.forEach(c => {
      const cfg = this.players.find(p => p.id === c.id);
      const px = cx + Math.cos(c.angle) * arenaRadius;
      const py = cy + Math.sin(c.angle) * arenaRadius;

      ctx.save();
      ctx.translate(px, py);

      // Leyden Jar / Battery Base
      ctx.fillStyle = '#222222';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = cfg?.color || '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Ground Rod
      ctx.strokeStyle = c.rodExtended ? '#ffd700' : '#888888';
      ctx.lineWidth = 4;
      const rodDist = c.rodExtended ? 28 : 14;
      const rodAngle = Math.atan2(cy - py, cx - px);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(rodAngle) * rodDist, Math.sin(rodAngle) * rodDist);
      ctx.stroke();

      // Capacitor Glow
      if (c.charge > 0) {
        ctx.fillStyle = 'rgba(0, 229, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, Math.min(22, 10 + c.charge * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Score / Charge Label
      ctx.fillStyle = cfg?.color || '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      const labelDist = arenaRadius + 32;
      const lx = cx + Math.cos(c.angle) * labelDist;
      const ly = cy + Math.sin(c.angle) * labelDist;
      ctx.fillText(`${cfg?.name || 'Player'}: ${c.score} kW`, lx, ly);
    });
  }

  private finishRound(): void {
    this.isFinished = true;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.collectors.forEach((c, pId) => scores.set(pId, c.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.collectors.entries())
      .map(([playerId, c]) => ({ playerId, score: c.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} harnessed raw Tesla voltage!` : 'Capacitors discharged!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
