import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Raft {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  lives: number;
  score: number;
  isAlive: boolean;
  invulnerableTimer: number;
}

interface Shark {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetRaftId: PlayerId | null;
  speed: number;
}

interface Lifebuoy {
  id: number;
  x: number;
  y: number;
  points: number;
}

export class SharkBaitGame extends BaseGame {
  private rafts: Map<PlayerId, Raft> = new Map();
  private sharks: Shark[] = [];
  private lifebuoys: Lifebuoy[] = [];
  private buoyIdCounter: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private spawnBuoyTimer: number = 0;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 40.0;
    this.isFinished = false;
    this.rafts.clear();
    this.sharks = [];
    this.lifebuoys = [];
    this.spawnBuoyTimer = 0.5;

    // Spawn 2 sharks in center
    this.sharks.push({
      id: 1,
      x: width * 0.45,
      y: height * 0.5,
      vx: 0,
      vy: 0,
      angle: 0,
      targetRaftId: null,
      speed: 120
    });
    this.sharks.push({
      id: 2,
      x: width * 0.55,
      y: height * 0.5,
      vx: 0,
      vy: 0,
      angle: Math.PI,
      targetRaftId: null,
      speed: 130
    });

    const active = this.getActivePlayers();
    const spawnCorners = [
      { x: width * 0.2, y: height * 0.2 },
      { x: width * 0.8, y: height * 0.2 },
      { x: width * 0.2, y: height * 0.8 },
      { x: width * 0.8, y: height * 0.8 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnCorners[idx % spawnCorners.length];
      this.rafts.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: 0,
        lives: 3,
        score: 0,
        isAlive: true,
        invulnerableTimer: 1.0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });

    // Spawn initial lifebuoys
    for (let i = 0; i < 5; i++) {
      this.spawnBuoy(width, height);
    }
  }

  private spawnBuoy(width: number, height: number): void {
    this.lifebuoys.push({
      id: ++this.buoyIdCounter,
      x: width * 0.15 + Math.random() * (width * 0.7),
      y: height * 0.15 + Math.random() * (height * 0.7),
      points: 15
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    this.spawnBuoyTimer -= dt;
    if (this.spawnBuoyTimer <= 0 && this.lifebuoys.length < 6) {
      this.spawnBuoyTimer = 2.0;
      this.spawnBuoy(width, height);
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();

    // Update rafts
    for (const p of active) {
      const r = this.rafts.get(p.id);
      if (!r || !r.isAlive) continue;

      if (r.invulnerableTimer > 0) r.invulnerableTimer -= dt;

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);

      if (steer !== 0 || throttle !== 0) {
        r.angle = Math.atan2(-throttle, steer);
        const speed = 190;
        r.vx += Math.cos(r.angle) * speed * dt * 4;
        r.vy += Math.sin(r.angle) * speed * dt * 4;

        if (Math.random() < 0.2) {
          this.particles.emit(r.x, r.y, 1, '#E0F7FA');
        }
      }

      // Water drag
      r.vx *= Math.pow(0.82, dt * 10);
      r.vy *= Math.pow(0.82, dt * 10);

      r.x += r.vx * dt;
      r.y += r.vy * dt;

      // Arena boundary bounce
      const margin = 20;
      if (r.x < margin) { r.x = margin; r.vx = Math.abs(r.vx); }
      if (r.x > width - margin) { r.x = width - margin; r.vx = -Math.abs(r.vx); }
      if (r.y < margin) { r.y = margin; r.vy = Math.abs(r.vy); }
      if (r.y > height - margin) { r.y = height - margin; r.vy = -Math.abs(r.vy); }

      // Check lifebuoy pickup
      for (let i = this.lifebuoys.length - 1; i >= 0; i--) {
        const b = this.lifebuoys[i];
        if (Math.hypot(r.x - b.x, r.y - b.y) < 26) {
          r.score += b.points;
          this.audio.playScore();
          this.particles.spawnConfetti(b.x, b.y, 8);
          this.lifebuoys.splice(i, 1);
        }
      }
    }

    // Update sharks
    for (const shark of this.sharks) {
      // Find nearest living raft
      let nearestRaft: Raft | null = null;
      let minDist = 300; // detection radius
      for (const r of this.rafts.values()) {
        if (!r.isAlive) continue;
        const d = Math.hypot(r.x - shark.x, r.y - shark.y);
        if (d < minDist) {
          minDist = d;
          nearestRaft = r;
        }
      }

      if (nearestRaft) {
        const dx = nearestRaft.x - shark.x;
        const dy = nearestRaft.y - shark.y;
        const targetAngle = Math.atan2(dy, dx);
        let diff = targetAngle - shark.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        shark.angle += diff * Math.min(1.0, dt * 4);
      } else {
        // Patrol wander
        shark.angle += dt * 0.8;
      }

      shark.vx = Math.cos(shark.angle) * shark.speed;
      shark.vy = Math.sin(shark.angle) * shark.speed;
      shark.x += shark.vx * dt;
      shark.y += shark.vy * dt;

      // Shark boundary bounce
      if (shark.x < 30) { shark.x = 30; shark.angle = 0; }
      if (shark.x > width - 30) { shark.x = width - 30; shark.angle = Math.PI; }
      if (shark.y < 30) { shark.y = 30; shark.angle = Math.PI / 2; }
      if (shark.y > height - 30) { shark.y = height - 30; shark.angle = -Math.PI / 2; }

      // Check collision with rafts
      for (const r of this.rafts.values()) {
        if (!r.isAlive || r.invulnerableTimer > 0) continue;

        if (Math.hypot(shark.x - r.x, shark.y - r.y) < 24) {
          r.lives--;
          r.invulnerableTimer = 1.8;
          r.score = Math.max(0, r.score - 10);
          this.audio.playExplosion();
          this.particles.emit(r.x, r.y, 14, '#FF1744');

          // Knockback
          r.vx = Math.cos(shark.angle) * 280;
          r.vy = Math.sin(shark.angle) * 280;

          if (r.lives <= 0) {
            r.isAlive = false;
          }
        }
      }
    }

    // Check round over
    const aliveCount = Array.from(this.rafts.values()).filter(r => r.isAlive).length;
    if ((aliveCount <= 1 && active.length > 1) || this.roundTimer <= 0) {
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

    const r = this.rafts.get(botId);
    if (!r || !r.isAlive) return;

    // Check nearest shark threat
    let nearestShark: Shark | null = null;
    let minSharkDist = Infinity;
    for (const sh of this.sharks) {
      const d = Math.hypot(sh.x - r.x, sh.y - r.y);
      if (d < minSharkDist) {
        minSharkDist = d;
        nearestShark = sh;
      }
    }

    let steerX = 0;
    let steerY = 0;
    let delay = 0.25;

    // If shark is close, flee!
    if (nearestShark && minSharkDist < 160) {
      const dx = r.x - nearestShark.x;
      const dy = r.y - nearestShark.y;
      const fleeAngle = Math.atan2(dy, dx);
      steerX = Math.cos(fleeAngle);
      steerY = Math.sin(fleeAngle);
    } else {
      // Seek nearest lifebuoy
      let nearestBuoy: Lifebuoy | null = null;
      let minBuoyDist = Infinity;
      for (const b of this.lifebuoys) {
        const d = Math.hypot(b.x - r.x, b.y - r.y);
        if (d < minBuoyDist) {
          minBuoyDist = d;
          nearestBuoy = b;
        }
      }

      if (nearestBuoy) {
        const dx = nearestBuoy.x - r.x;
        const dy = nearestBuoy.y - r.y;
        const seekAngle = Math.atan2(dy, dx);
        steerX = Math.cos(seekAngle);
        steerY = Math.sin(seekAngle);
      }
    }

    if (difficulty === 'bot_easy') {
      delay = 0.45;
      if (Math.random() < 0.2) steerX = -steerX;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
    }

    this.input.setBotInput(botId, false, steerX, -steerY, false);
    this.botReactionTimers.set(botId, delay);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Tropical ocean lagoon gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0277BD');
    grad.addColorStop(1, '#01579B');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Render lifebuoys
    for (const b of this.lifebuoys) {
      ctx.fillStyle = '#FF5252';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 11, 0, Math.PI * 2);
      ctx.fill();

      // White inner hole
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render sharks (ominous dorsal fins breaking surface)
    for (const sh of this.sharks) {
      ctx.save();
      ctx.translate(sh.x, sh.y);
      ctx.rotate(sh.angle);

      // Water ripple wake behind fin
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-16, -6);
      ctx.lineTo(-24, -10);
      ctx.moveTo(-16, 6);
      ctx.lineTo(-24, 10);
      ctx.stroke();

      // Sharp dorsal fin
      ctx.fillStyle = '#263238';
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-6, -14);
      ctx.lineTo(-8, 0);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // Render player rafts
    for (const [id, r] of this.rafts.entries()) {
      if (!r.isAlive) continue;
      const p = this.players.find(pl => pl.id === id);
      const color = p ? p.color : '#FF1744';

      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.angle);

      if (r.invulnerableTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
        ctx.globalAlpha = 0.5;
      }

      // Inflatable rubber tube ring
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Inner seating hollow
      ctx.fillStyle = '#263238';
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      ctx.globalAlpha = 1.0;

      // Render life hearts above raft
      for (let l = 0; l < 3; l++) {
        ctx.fillStyle = l < r.lives ? '#FF1744' : '#546E7A';
        ctx.beginPath();
        ctx.arc(r.x - 12 + l * 12, r.y - 18, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
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
      const r = this.rafts.get(p.id);
      return {
        playerId: p.id,
        score: r ? r.score + (r.isAlive ? r.lives * 25 : 0) : 0
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
      mvpHighlight: winnerId !== null ? `Player ${winnerId + 1} survived the shark feeding frenzy!` : 'The lagoon sharks claimed all rescue rafts!'
    };
  }
}
