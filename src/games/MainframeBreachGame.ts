import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface IceRing {
  radius: number;
  gapAngle: number;
  gapSize: number; // in radians
  speed: number;
  color: string;
}

interface DataPacket {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: PlayerId;
  life: number;
}

interface HackerStation {
  id: PlayerId;
  angle: number;
  score: number;
  cooldown: number;
}

export class MainframeBreachGame extends BaseGame {
  public hackers: Map<PlayerId, HackerStation> = new Map();
  public rings: IceRing[] = [];
  public packets: DataPacket[] = [];
  public currentMapName: string = 'Arasaka Quantum Sub-Grid';
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
    this.hackers.clear();
    this.packets = [];
    this.botReactionTimers.clear();

    const minDim = Math.min(width, height);
    this.rings = [
      { radius: minDim * 0.14, gapAngle: 0, gapSize: 0.9, speed: 2.2, color: '#00e5ff' },
      { radius: minDim * 0.22, gapAngle: Math.PI * 0.5, gapSize: 0.8, speed: -1.7, color: '#d500f9' },
      { radius: minDim * 0.30, gapAngle: Math.PI, gapSize: 0.75, speed: 1.4, color: '#ff0055' }
    ];

    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      const angle = (idx / count) * Math.PI * 2 - Math.PI * 0.5;
      this.hackers.set(p.id, {
        id: p.id,
        angle,
        score: 0,
        cooldown: 0
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

    // Rotate ICE rings
    this.rings.forEach(r => {
      r.gapAngle += r.speed * dt;
    });

    const cx = width * 0.5;
    const cy = height * 0.55;
    const spawnDist = Math.min(width, height) * 0.38;

    // Update hackers
    this.hackers.forEach(h => {
      if (h.cooldown > 0) h.cooldown -= dt;

      if (this.input.justPressed(h.id) && h.cooldown <= 0) {
        h.cooldown = 0.5;
        // Launch packet toward center
        const hx = cx + Math.cos(h.angle) * spawnDist;
        const hy = cy + Math.sin(h.angle) * spawnDist;
        const speed = 280;
        const vx = -Math.cos(h.angle) * speed;
        const vy = -Math.sin(h.angle) * speed;

        this.packets.push({
          x: hx,
          y: hy,
          vx,
          vy,
          ownerId: h.id,
          life: 2.0
        });

        this.audio.playTone(540, 0.08, 'sine');
      }
    });

    // Update packets
    for (let i = this.packets.length - 1; i >= 0; i--) {
      const p = this.packets[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      const dist = Math.hypot(p.x - cx, p.y - cy);
      const angle = Math.atan2(p.y - cy, p.x - cx);

      // Check collision with each ring
      let collidedWithIce = false;
      this.rings.forEach(r => {
        if (Math.abs(dist - r.radius) < 6) {
          // Check if packet hits inside gap
          let diff = Math.abs(angle - r.gapAngle);
          while (diff > Math.PI * 2) diff -= Math.PI * 2;
          const angleDiff = Math.min(diff, Math.PI * 2 - diff);

          if (angleDiff > r.gapSize * 0.5) {
            // Hit ICE barrier!
            collidedWithIce = true;
            this.audio.playTone(160, 0.12, 'sawtooth');
            this.particles.emit(p.x, p.y, 8, r.color);
          }
        }
      });

      // Hit center core!
      if (!collidedWithIce && dist < 16) {
        const hacker = this.hackers.get(p.ownerId);
        if (hacker) {
          hacker.score += 40;
          this.audio.playTone(880, 0.2, 'square');
          this.particles.emit(cx, cy, 20, '#00ffff');
          this.particles.emit(cx, cy, 15, '#ffd700');
        }
        this.packets.splice(i, 1);
        continue;
      }

      if (collidedWithIce || p.life <= 0) {
        this.packets.splice(i, 1);
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _w: number,
    _h: number
  ): void {
    const h = this.hackers.get(botId);
    if (!h || h.cooldown > 0) return;

    let bTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botReactionTimers.set(botId, bTimer);
      return;
    }

    // Packet travels along angle + PI (towards center)
    const inwardAngle = h.angle + Math.PI;

    // Check if rings have gaps currently aligned or soon aligned
    let clearCount = 0;
    this.rings.forEach(r => {
      let diff = Math.abs(inwardAngle - r.gapAngle);
      while (diff > Math.PI * 2) diff -= Math.PI * 2;
      const angleDiff = Math.min(diff, Math.PI * 2 - diff);
      if (angleDiff < r.gapSize * 0.55) {
        clearCount++;
      }
    });

    const minClear = difficulty === 'bot_hard' ? 2 : difficulty === 'bot_normal' ? 1 : 0;
    if (clearCount >= minClear) {
      const accuracy = difficulty === 'bot_hard' ? 0.95 : difficulty === 'bot_normal' ? 0.75 : 0.50;
      if (Math.random() < accuracy) {
        this.input.triggerBotPress(botId);
        this.botReactionTimers.set(botId, 0.4);
        return;
      }
    }

    this.botReactionTimers.set(botId, 0.08);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Cyber Virtual Grid Background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#040711');
    grad.addColorStop(0.5, '#0a1024');
    grad.addColorStop(1, '#050814');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.55;

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
    ctx.fillText('FIRE DATA PACKETS THROUGH ROTATING FIREWALL GAPS!', width * 0.5, 69);
    ctx.restore();

    // Central Core
    ctx.save();
    ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Render ICE Rings
    this.rings.forEach(r => {
      ctx.save();
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 4;
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 8;

      // Draw arc outside gap
      const start = r.gapAngle + r.gapSize * 0.5;
      const end = r.gapAngle + Math.PI * 2 - r.gapSize * 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r.radius, start, end);
      ctx.stroke();

      ctx.restore();
    });

    // Render Packets
    this.packets.forEach(p => {
      const cfg = this.players.find(pl => pl.id === p.ownerId);
      ctx.fillStyle = cfg?.color || '#ffffff';
      ctx.shadowColor = cfg?.color || '#ffffff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Render Hacker Launchers
    const spawnDist = Math.min(width, height) * 0.38;
    this.hackers.forEach(h => {
      const cfg = this.players.find(p => p.id === h.id);
      const hx = cx + Math.cos(h.angle) * spawnDist;
      const hy = cy + Math.sin(h.angle) * spawnDist;

      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(h.angle + Math.PI);

      // Launcher Node
      ctx.fillStyle = '#1c2438';
      ctx.beginPath();
      ctx.roundRect(-10, -10, 20, 20, 4);
      ctx.fill();
      ctx.strokeStyle = cfg?.color || '#00e5ff';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-10, -10, 20, 20);

      // Nozzle pointing to core
      ctx.fillStyle = cfg?.color || '#00e5ff';
      ctx.fillRect(8, -3, 6, 6);

      ctx.restore();

      // Label & Score
      ctx.fillStyle = cfg?.color || '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      const lx = cx + Math.cos(h.angle) * (spawnDist + 24);
      const ly = cy + Math.sin(h.angle) * (spawnDist + 24);
      ctx.fillText(`${cfg?.name || 'Player'}: ${h.score}`, lx, ly);
    });
  }

  private finishRound(): void {
    this.isFinished = true;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.hackers.forEach((h, pId) => scores.set(pId, h.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.hackers.entries())
      .map(([playerId, h]) => ({ playerId, score: h.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} breached the quantum core!` : 'Mainframe lockdown!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
