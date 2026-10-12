import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface JetSki {
  id: PlayerId;
  x: number;
  y: number;
  speed: number;
  maxSpeed: number;
  angle: number;
  targetAngle: number;
  score: number;
  nextGateIndex: number;
  laps: number;
}

interface SlalomGate {
  id: number;
  x: number;
  y: number;
  radius: number;
  passedSide: 'left' | 'right';
}

export class WaterScooterGame extends BaseGame {
  private skis: Map<PlayerId, JetSki> = new Map();
  private gates: SlalomGate[] = [];
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
    this.skis.clear();
    this.gates = [];

    // Create oval slalom course with floating buoys
    const courseBuoys = [
      { x: width * 0.25, y: height * 0.3, side: 'left' as const },
      { x: width * 0.5, y: height * 0.2, side: 'right' as const },
      { x: width * 0.75, y: height * 0.3, side: 'left' as const },
      { x: width * 0.8, y: height * 0.6, side: 'right' as const },
      { x: width * 0.6, y: height * 0.8, side: 'left' as const },
      { x: width * 0.35, y: height * 0.8, side: 'right' as const },
      { x: width * 0.18, y: height * 0.55, side: 'left' as const }
    ];

    courseBuoys.forEach((b, idx) => {
      this.gates.push({
        id: idx,
        x: b.x,
        y: b.y,
        radius: 18,
        passedSide: b.side
      });
    });

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.skis.set(p.id, {
        id: p.id,
        x: width * 0.2 + idx * 16,
        y: height * 0.5,
        speed: 0,
        maxSpeed: 240,
        angle: -Math.PI / 2,
        targetAngle: -Math.PI / 2,
        score: 0,
        nextGateIndex: 0,
        laps: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();

    for (const p of active) {
      const ski = this.skis.get(p.id);
      if (!ski) continue;

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);

      // Turning
      if (steer !== 0) {
        ski.angle += steer * dt * 3.5;
      }

      // Acceleration
      if (throttle > 0 || this.input.isPressed(p.id)) {
        ski.speed = Math.min(ski.maxSpeed, ski.speed + 280 * dt);
        // Water spray particles behind jet-ski
        if (Math.random() < 0.35) {
          const wakeX = ski.x - Math.cos(ski.angle) * 16;
          const wakeY = ski.y - Math.sin(ski.angle) * 16;
          this.particles.emit(wakeX, wakeY, 2, '#E0F7FA');
        }
      } else {
        ski.speed = Math.max(0, ski.speed - 120 * dt);
      }

      ski.x += Math.cos(ski.angle) * ski.speed * dt;
      ski.y += Math.sin(ski.angle) * ski.speed * dt;

      // Arena boundary bounce
      const margin = 20;
      if (ski.x < margin) { ski.x = margin; ski.angle = Math.PI - ski.angle; ski.speed *= 0.5; }
      if (ski.x > width - margin) { ski.x = width - margin; ski.angle = Math.PI - ski.angle; ski.speed *= 0.5; }
      if (ski.y < margin) { ski.y = margin; ski.angle = -ski.angle; ski.speed *= 0.5; }
      if (ski.y > height - margin) { ski.y = height - margin; ski.angle = -ski.angle; ski.speed *= 0.5; }

      // Check next buoy pass
      const targetGate = this.gates[ski.nextGateIndex];
      const dist = Math.hypot(ski.x - targetGate.x, ski.y - targetGate.y);

      if (dist < targetGate.radius + 24) {
        ski.score += 15;
        this.audio.playScore();
        this.particles.emit(targetGate.x, targetGate.y, 6, '#00E5FF');
        ski.nextGateIndex = (ski.nextGateIndex + 1) % this.gates.length;

        if (ski.nextGateIndex === 0) {
          ski.laps++;
          ski.score += 35;
          this.particles.spawnConfetti(ski.x, ski.y, 14);
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const ski = this.skis.get(botId);
    if (!ski) return;

    const targetGate = this.gates[ski.nextGateIndex];
    const dx = targetGate.x - ski.x;
    const dy = targetGate.y - ski.y;
    const targetAngle = Math.atan2(dy, dx);

    let angleDiff = targetAngle - ski.angle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

    let steer = 0;
    if (Math.abs(angleDiff) > 0.08) {
      steer = angleDiff > 0 ? 1 : -1;
    }

    let delay = 0.25;
    if (difficulty === 'bot_easy') {
      delay = 0.45;
      if (Math.random() < 0.2) steer = -steer;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
    }

    this.input.setBotInput(botId, true, steer, 1, false);
    this.botReactionTimers.set(botId, delay);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Sparkling turquoise sea gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#00BCD4');
    grad.addColorStop(1, '#00838F');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Course track guidelines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.gates[0].x, this.gates[0].y);
    for (let i = 1; i < this.gates.length; i++) {
      ctx.lineTo(this.gates[i].x, this.gates[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    // Render floating buoy gates
    for (const g of this.gates) {
      ctx.fillStyle = g.passedSide === 'left' ? '#00E676' : '#FF1744';
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Top flag marker
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(g.x, g.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render jet-skis
    for (const [id, ski] of this.skis.entries()) {
      const p = this.players.find(pl => pl.id === id);
      const color = p ? p.color : '#FF1744';

      ctx.save();
      ctx.translate(ski.x, ski.y);
      ctx.rotate(ski.angle);

      // Jet-ski pointed hull
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-12, -9);
      ctx.lineTo(-14, 0);
      ctx.lineTo(-12, 9);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Rider helmet
      ctx.fillStyle = '#212121';
      ctx.beginPath();
      ctx.arc(-2, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Score above ski
      ctx.fillStyle = color;
      ctx.font = 'bold 14px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${ski.score} pts`, ski.x, ski.y - 18);
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
      const ski = this.skis.get(p.id);
      return {
        playerId: p.id,
        score: ski ? ski.score : 0
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
      mvpHighlight: winnerId !== null ? `Player ${winnerId + 1} carved the fastest jet-ski slalom!` : 'All jet-skis stalled in the water!'
    };
  }
}
