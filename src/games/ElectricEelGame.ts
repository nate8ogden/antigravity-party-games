import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CavernSub {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  paralyzedTimer: number;
  laps: number;
  targetGateIndex: number;
}

interface ElectricGate {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  isDischarging: boolean;
  cycleTimer: number;
  dischargeDuration: number;
  dormantDuration: number;
}

export class ElectricEelGame extends BaseGame {
  private subs: Map<PlayerId, CavernSub> = new Map();
  private gates: ElectricGate[] = [];
  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 38.0;
    this.isFinished = false;
    this.subs.clear();
    this.gates = [];

    // Create 4 electric eel cavern gates
    const positions = [
      { x: width * 0.28, y: height * 0.35, w: 18, h: 90 },
      { x: width * 0.72, y: height * 0.35, w: 18, h: 90 },
      { x: width * 0.72, y: height * 0.7, w: 18, h: 90 },
      { x: width * 0.28, y: height * 0.7, w: 18, h: 90 }
    ];

    positions.forEach((pos, idx) => {
      this.gates.push({
        id: idx,
        x: pos.x,
        y: pos.y,
        w: pos.w,
        h: pos.h,
        isDischarging: idx % 2 === 0,
        cycleTimer: 1.2 + idx * 0.3,
        dischargeDuration: 1.4,
        dormantDuration: 1.6
      });
    });

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.subs.set(p.id, {
        id: p.id,
        x: width * 0.5 + (idx - active.length / 2) * 24,
        y: height * 0.5,
        vx: 0,
        vy: 0,
        angle: 0,
        score: 0,
        paralyzedTimer: 0,
        laps: 0,
        targetGateIndex: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update electric gates cycle
    for (const g of this.gates) {
      g.cycleTimer -= dt;
      if (g.cycleTimer <= 0) {
        g.isDischarging = !g.isDischarging;
        g.cycleTimer = g.isDischarging ? g.dischargeDuration : g.dormantDuration;
        if (g.isDischarging) {
          this.audio.playBounce();
        }
      }
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();

    for (const p of active) {
      const sub = this.subs.get(p.id);
      if (!sub) continue;

      if (sub.paralyzedTimer > 0) {
        sub.paralyzedTimer -= dt;
        sub.vx *= 0.8;
        sub.vy *= 0.8;
        if (Math.random() < 0.25) {
          this.particles.emit(sub.x, sub.y, 2, '#FFEB3B');
        }
      } else {
        const steer = this.input.getSteer(p.id);
        const throttle = this.input.getThrottle(p.id);

        if (steer !== 0 || throttle !== 0) {
          sub.angle = Math.atan2(-throttle, steer);
          const speed = 190;
          sub.vx += Math.cos(sub.angle) * speed * dt * 4;
          sub.vy += Math.sin(sub.angle) * speed * dt * 4;
        }

        sub.vx *= Math.pow(0.85, dt * 10);
        sub.vy *= Math.pow(0.85, dt * 10);
      }

      sub.x += sub.vx * dt;
      sub.y += sub.vy * dt;

      // Cavern bounds clamp
      const margin = 20;
      if (sub.x < margin) { sub.x = margin; sub.vx = Math.abs(sub.vx); }
      if (sub.x > width - margin) { sub.x = width - margin; sub.vx = -Math.abs(sub.vx); }
      if (sub.y < margin) { sub.y = margin; sub.vy = Math.abs(sub.vy); }
      if (sub.y > height - margin) { sub.y = height - margin; sub.vy = -Math.abs(sub.vy); }

      // Check passing target gate
      const targetGate = this.gates[sub.targetGateIndex];
      const distToGate = Math.hypot(sub.x - targetGate.x, sub.y - targetGate.y);

      if (distToGate < 30) {
        if (targetGate.isDischarging) {
          // ZAP!
          sub.paralyzedTimer = 1.4;
          sub.score = Math.max(0, sub.score - 5);
          this.audio.playExplosion();
          this.particles.emit(sub.x, sub.y, 14, '#FFEB3B');
        } else {
          // Safely passed!
          sub.score += 15;
          sub.targetGateIndex = (sub.targetGateIndex + 1) % this.gates.length;
          if (sub.targetGateIndex === 0) {
            sub.laps++;
            sub.score += 25;
            this.particles.spawnConfetti(sub.x, sub.y, 12);
          }
          this.audio.playScore();
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

    const sub = this.subs.get(botId);
    if (!sub || sub.paralyzedTimer > 0) return;

    const targetGate = this.gates[sub.targetGateIndex];
    const dx = targetGate.x - sub.x;
    const dy = targetGate.y - sub.y;
    const dist = Math.hypot(dx, dy);

    let steerX = Math.cos(Math.atan2(dy, dx));
    let steerY = Math.sin(Math.atan2(dy, dx));
    let delay = 0.25;

    // Check if gate is currently discharging
    if (targetGate.isDischarging && dist < 70) {
      if (difficulty === 'bot_easy') {
        delay = 0.45;
        // Easy bot charges right into the shock!
      } else if (difficulty === 'bot_hard') {
        delay = 0.10;
        // Hard bot stops or circles until discharge ends
        steerX = -steerY;
        steerY = steerX;
      } else {
        delay = 0.25;
        // Normal bot hesitates
        steerX *= 0.2;
        steerY *= 0.2;
      }
    }

    this.input.setBotInput(botId, false, steerX, -steerY, false);
    this.botReactionTimers.set(botId, delay);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Murky cavern depth
    ctx.fillStyle = '#050D1A';
    ctx.fillRect(0, 0, width, height);

    // Cavern rock boundaries
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, width - 12, height - 12);

    // Render Electric Gates (Eel shock coils)
    for (const g of this.gates) {
      ctx.save();
      ctx.translate(g.x, g.y);

      // Top and bottom node pylons
      ctx.fillStyle = '#455A64';
      ctx.beginPath();
      ctx.arc(0, -g.h / 2, 9, 0, Math.PI * 2);
      ctx.arc(0, g.h / 2, 9, 0, Math.PI * 2);
      ctx.fill();

      // Electrical arc between pylons
      if (g.isDischarging) {
        ctx.strokeStyle = '#FFEB3B';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -g.h / 2);
        for (let y = -g.h / 2; y <= g.h / 2; y += 12) {
          const jitter = (Math.random() - 0.5) * 14;
          ctx.lineTo(jitter, y);
        }
        ctx.lineTo(0, g.h / 2);
        ctx.stroke();

        // Glow halo
        ctx.strokeStyle = 'rgba(255, 235, 59, 0.3)';
        ctx.lineWidth = 10;
        ctx.stroke();
      } else {
        // Dormant tether
        ctx.strokeStyle = '#37474F';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -g.h / 2);
        ctx.lineTo(0, g.h / 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    // Render submersibles
    for (const [id, sub] of this.subs.entries()) {
      const p = this.players.find(pl => pl.id === id);
      const color = p ? p.color : '#00E5FF';

      ctx.save();
      ctx.translate(sub.x, sub.y);
      ctx.rotate(sub.angle);

      // Paralyzed electrical jitter
      if (sub.paralyzedTimer > 0) {
        ctx.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
      }

      // Hull
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Headlight cone
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(45, -16);
      ctx.lineTo(45, 16);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // Score above sub
      ctx.fillStyle = color;
      ctx.font = 'bold 14px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${sub.score} pts`, sub.x, sub.y - 18);
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
      const sub = this.subs.get(p.id);
      return {
        playerId: p.id,
        score: sub ? sub.score : 0
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
      mvpHighlight: winnerId !== null ? `Player ${winnerId + 1} navigated the electric cavern circuit!` : 'All submersibles short-circuited in the cavern!'
    };
  }
}
