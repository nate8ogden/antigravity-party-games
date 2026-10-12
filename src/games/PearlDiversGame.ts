import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface ClamStation {
  id: PlayerId;
  x: number;
  y: number;
  diverY: number;
  targetDiverY: number;
  clamState: 'closed' | 'opening' | 'open' | 'snapping';
  stateTimer: number;
  pearlType: 'white' | 'golden';
  pearlValue: number;
  hasPearl: boolean;
  score: number;
  stunTimer: number;
  diveAnim: number;
}

export class PearlDiversGame extends BaseGame {
  private stations: Map<PlayerId, ClamStation> = new Map();
  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.stations.clear();

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const x = width * 0.15 + (idx / Math.max(1, active.length - 1)) * (width * 0.7);
      this.stations.set(p.id, {
        id: p.id,
        x,
        y: height * 0.78, // seabed clam position
        diverY: height * 0.25, // surface diver position
        targetDiverY: height * 0.25,
        clamState: 'closed',
        stateTimer: 1.0 + Math.random() * 1.5,
        pearlType: Math.random() < 0.25 ? 'golden' : 'white',
        pearlValue: 15,
        hasPearl: true,
        score: 0,
        stunTimer: 0,
        diveAnim: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, _width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    this.updateBots(dt, _width, height);

    const active = this.getActivePlayers();

    for (const p of active) {
      const st = this.stations.get(p.id);
      if (!st) continue;

      if (st.stunTimer > 0) st.stunTimer -= dt;

      // Clam open/close cycle
      st.stateTimer -= dt;
      if (st.stateTimer <= 0) {
        if (st.clamState === 'closed') {
          st.clamState = 'opening';
          st.stateTimer = 0.5;
          st.hasPearl = true;
          st.pearlType = Math.random() < 0.25 ? 'golden' : 'white';
          st.pearlValue = st.pearlType === 'golden' ? 35 : 15;
        } else if (st.clamState === 'opening') {
          st.clamState = 'open';
          st.stateTimer = 0.8 + Math.random() * 0.6; // window to grab pearl
        } else if (st.clamState === 'open') {
          st.clamState = 'snapping';
          st.stateTimer = 0.3;
          this.audio.playBounce();
        } else if (st.clamState === 'snapping') {
          st.clamState = 'closed';
          st.stateTimer = 1.0 + Math.random() * 1.5;
        }
      }

      // Smooth diver dive / return
      st.diverY += (st.targetDiverY - st.diverY) * Math.min(1.0, dt * 10);

      // Check input: Single-button Dive!
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      if (justAction && st.stunTimer <= 0 && st.targetDiverY === height * 0.25) {
        this.handleDive(st, height);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private handleDive(st: ClamStation, height: number): void {
    // Send diver plunging down to seabed
    st.targetDiverY = height * 0.72;
    this.audio.playTap();
    this.particles.emit(st.x, st.diverY, 3, '#81D4FA');

    setTimeout(() => {
      // Diver reached clam
      if (st.clamState === 'open' && st.hasPearl) {
        // Successful harvest!
        st.hasPearl = false;
        st.score += st.pearlValue;
        this.audio.playScore();
        this.particles.spawnConfetti(st.x, st.y - 20, 12);
      } else if (st.clamState === 'snapping' || st.clamState === 'closed') {
        // SNAP! Snapped by shell
        st.stunTimer = 1.2;
        st.score = Math.max(0, st.score - 5);
        this.audio.playExplosion();
        this.particles.emit(st.x, st.y, 8, '#FF5252');
      }

      // Return diver to surface
      st.targetDiverY = height * 0.25;
    }, 180);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    height: number
  ): void {
    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const st = this.stations.get(botId);
    if (!st || st.stunTimer > 0 || st.targetDiverY !== height * 0.25) return;

    let shouldDive = false;
    let delay = 0.25;

    if (difficulty === 'bot_easy') {
      delay = 0.45;
      if (st.clamState === 'open' && Math.random() < 0.6) shouldDive = true;
      else if (st.clamState === 'opening' && Math.random() < 0.3) shouldDive = true; // dives too early
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
      if (st.clamState === 'open' && st.hasPearl && st.stateTimer > 0.3) shouldDive = true;
    } else {
      delay = 0.25;
      if (st.clamState === 'open' && st.hasPearl) shouldDive = true;
    }

    if (shouldDive) {
      this.handleDive(st, height);
    }

    this.botReactionTimers.set(botId, delay);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Tropical ocean gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#00838F');
    grad.addColorStop(0.3, '#006064');
    grad.addColorStop(1, '#00363A');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Seabed sand floor
    ctx.fillStyle = '#C2B280';
    ctx.fillRect(0, height * 0.85, width, height * 0.15);

    for (const [id, st] of this.stations.entries()) {
      const p = this.players.find(pl => pl.id === id);
      const color = p ? p.color : '#00E5FF';

      // Oxygen lifeline / cable from surface to diver
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(st.x, 0);
      ctx.lineTo(st.x, st.diverY);
      ctx.stroke();

      // Scuba Diver
      ctx.save();
      ctx.translate(st.x, st.diverY);

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 15, 0, 0, Math.PI * 2);
      ctx.fill();

      // Mask
      ctx.fillStyle = '#00E5FF';
      ctx.beginPath();
      ctx.ellipse(0, 4, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Giant Clam on seabed
      ctx.save();
      ctx.translate(st.x, st.y);

      // Bottom shell
      ctx.fillStyle = '#5D4037';
      ctx.beginPath();
      ctx.arc(0, 6, 26, 0, Math.PI);
      ctx.fill();

      // Clam interior fleshy mantle
      ctx.fillStyle = '#F48FB1';
      ctx.beginPath();
      ctx.ellipse(0, 2, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pearl inside (if open)
      if (st.hasPearl && (st.clamState === 'open' || st.clamState === 'opening')) {
        ctx.fillStyle = st.pearlType === 'golden' ? '#FFD700' : '#ECEFF1';
        ctx.beginPath();
        ctx.arc(0, 0, st.pearlType === 'golden' ? 9 : 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Top shell hinge animation
      const shellOpenAngle = st.clamState === 'open' ? -0.85 :
                             st.clamState === 'opening' ? -0.45 :
                             st.clamState === 'snapping' ? -0.15 : 0;

      ctx.save();
      ctx.translate(-22, 6);
      ctx.rotate(shellOpenAngle);
      ctx.fillStyle = '#6D4C41';
      ctx.beginPath();
      ctx.ellipse(22, -6, 26, 12, 0, Math.PI, 0);
      ctx.fill();
      ctx.restore();

      ctx.restore();

      // Score above station
      ctx.fillStyle = color;
      ctx.font = 'bold 16px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${st.score} pts`, st.x, height * 0.18);
    }

    // Timer
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(this.roundTimer)}s`, width / 2, 32);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const st = this.stations.get(p.id);
      return {
        playerId: p.id,
        score: st ? st.score : 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `Player ${winnerId + 1} harvested the finest ocean pearls!` : 'The giant clams snapped shut empty!'
    };
  }
}
