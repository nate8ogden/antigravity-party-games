import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CoreStation {
  id: PlayerId;
  x: number;
  y: number;
  coreEnergy: number; // 0 to 100
  energyRate: number; // fluctuation speed
  pulseAnim: number; // visual magnetic shockwave
  score: number;
  combo: number;
  breachTimer: number;
  stableSeconds: number;
}

export class AntimatterContainmentGame extends BaseGame {
  public stations: Map<PlayerId, CoreStation> = new Map();
  public currentMapName: string = 'Antimatter Facility Zero';
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
        y: height * 0.55,
        coreEnergy: 40 + Math.random() * 20,
        energyRate: 35 + Math.random() * 25,
        pulseAnim: 0,
        score: 0,
        combo: 0,
        breachTimer: 0,
        stableSeconds: 0,
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

      if (st.breachTimer > 0) {
        st.breachTimer -= dt;
        return;
      }

      if (st.pulseAnim > 0) st.pulseAnim = Math.max(0, st.pulseAnim - dt * 3.5);

      // Core energy fluctuates upwards
      st.coreEnergy += st.energyRate * dt;

      // Human input
      if (p && !p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(st.id) || this.input.justAction(st.id);
        if (justPressed) {
          this.fireContainmentPulse(st);
        }
      }

      // Check containment breach
      if (st.coreEnergy >= 100) {
        // OVERLOAD BREACH!
        st.breachTimer = 1.0;
        st.coreEnergy = 30;
        st.combo = 0;
        st.score = Math.max(0, st.score - 25);
        this.audio.playTone(110, 0.35, 'sawtooth');
        this.particles.emit(st.x, st.y, 24, '#e74c3c');
      } else if (st.coreEnergy <= 0) {
        // COLLAPSE BREACH!
        st.breachTimer = 1.0;
        st.coreEnergy = 40;
        st.combo = 0;
        st.score = Math.max(0, st.score - 20);
        this.audio.playTone(90, 0.35, 'square');
        this.particles.emit(st.x, st.y, 20, '#9b59b6');
      } else if (st.coreEnergy >= 65 && st.coreEnergy <= 88) {
        // In the sweet zone: continuous stabilization score
        st.stableSeconds += dt;
        if (st.stableSeconds >= 0.5) {
          st.stableSeconds -= 0.5;
          st.score += 5;
        }
      }
    });
  }

  private fireContainmentPulse(st: CoreStation): void {
    st.pulseAnim = 1.0;

    // Sweet stabilization zone is 65% to 88%
    if (st.coreEnergy >= 65 && st.coreEnergy <= 88) {
      // PERFECT CONTAINMENT PULSE!
      const pts = 30 + st.combo * 4;
      st.score += pts;
      st.combo++;
      st.coreEnergy = Math.max(25, st.coreEnergy - 45); // safely resets energy back down
      st.energyRate = 35 + Math.random() * 30; // random new ramp rate
      this.audio.playTone(740 + st.combo * 35, 0.15, 'sine');
      this.particles.emit(st.x, st.y, 16, '#00e5ff');
    } else if (st.coreEnergy < 65) {
      // Early pulse: drops energy too low
      st.coreEnergy = Math.max(0, st.coreEnergy - 35);
      st.combo = 0;
      this.audio.playTone(220, 0.1, 'triangle');
    } else {
      // Late pulse near breach
      st.coreEnergy = Math.max(35, st.coreEnergy - 40);
      st.score += 10;
      this.audio.playTone(440, 0.1, 'sine');
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
    if (!st || st.breachTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      const targetMin = difficulty === 'bot_hard' ? 72 : difficulty === 'bot_normal' ? 66 : 58;
      const targetMax = difficulty === 'bot_hard' ? 84 : difficulty === 'bot_normal' ? 86 : 92;

      if (st.coreEnergy >= targetMin && st.coreEnergy <= targetMax) {
        this.fireContainmentPulse(st);
        bTimer = difficulty === 'bot_hard' ? 0.3 : 0.45;
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Sci-fi deep space antimatter lab background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0a0a14');
    bgGrad.addColorStop(0.5, '#121226');
    bgGrad.addColorStop(1, '#06060c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Glowing circuit grid
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    this.stations.forEach((st, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#00e5ff';

      // Magnetic Torus Ring
      ctx.save();
      ctx.translate(st.x, st.y);

      // Outer magnetic ring
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(0, 0, 55, 0, Math.PI * 2);
      ctx.stroke();

      // Magnetic field emitter coils
      ctx.fillStyle = '#f39c12';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.fillRect(Math.cos(a) * 50 - 5, Math.sin(a) * 50 - 5, 10, 10);
      }

      // Sweet zone indicator ring
      ctx.strokeStyle = 'rgba(0, 230, 118, 0.35)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, 42, 0, Math.PI * 2);
      ctx.stroke();

      // Core singularity sphere
      const coreSize = 14 + (st.coreEnergy / 100) * 22;
      const isBreaching = st.breachTimer > 0;
      const coreColor = isBreaching ? '#e74c3c' : (st.coreEnergy > 65 && st.coreEnergy < 88 ? '#00e676' : '#9b59b6');

      ctx.fillStyle = coreColor;
      ctx.shadowColor = coreColor;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(0, 0, coreSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Pulse wave animation
      if (st.pulseAnim > 0) {
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 55 + (1 - st.pulseAnim) * 35, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      // Energy Progress Arc / Bar
      const barW = 70;
      const barH = 8;
      const barX = st.x - barW / 2;
      const barY = st.y + 75;

      ctx.fillStyle = '#1c2833';
      ctx.fillRect(barX, barY, barW, barH);

      // Sweet zone marker
      ctx.fillStyle = 'rgba(0, 230, 118, 0.4)';
      ctx.fillRect(barX + barW * 0.65, barY, barW * 0.23, barH);

      // Current Energy Fill
      const fillW = (barW * Math.min(100, Math.max(0, st.coreEnergy))) / 100;
      ctx.fillStyle = st.coreEnergy > 88 ? '#e74c3c' : (st.coreEnergy >= 65 ? '#00e676' : '#3498db');
      ctx.fillRect(barX, barY, fillW, barH);

      // Energy Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.floor(st.coreEnergy)}% ENERGY`, st.x, barY + 20);

      // Player Score
      ctx.fillStyle = color;
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${cfg?.name ?? pId}: ${st.score}`, st.x, height * 0.9);
      if (st.combo > 1) {
        ctx.fillStyle = '#00e676';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${st.combo}x STABLE`, st.x, height * 0.94);
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
    ctx.fillText('⚛️ TAP TO PULSE COIL IN GREEN ZONE • AVOID BREACH!', width / 2, 73);
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
      mvpHighlight: winnerId ? `${winnerId} contained the antimatter singularity!` : 'Catastrophic facility breach!',
    };
  }
}
