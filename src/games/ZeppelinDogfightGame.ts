import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Cannonball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: PlayerId;
  life: number;
}

interface Zeppelin {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  score: number;
  isAlive: boolean;
  fireCooldown: number;
  propAnim: number;
}

export class ZeppelinDogfightGame extends BaseGame {
  public zeppelins: Map<PlayerId, Zeppelin> = new Map();
  public cannonballs: Cannonball[] = [];
  public currentMapName: string = 'Victorian London Skies';
  private botThinkTimers: Map<PlayerId, number> = new Map();

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
    this.zeppelins.clear();
    this.cannonballs = [];
    this.botThinkTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      let x = width * 0.25;
      let y = height * 0.35;
      let angle = 0;
      if (count === 2) {
        x = idx === 0 ? width * 0.2 : width * 0.8;
        y = height * 0.5;
        angle = idx === 0 ? 0 : Math.PI;
      } else {
        if (idx === 1) { x = width * 0.8; y = height * 0.35; angle = Math.PI; }
        if (idx === 2) { x = width * 0.25; y = height * 0.75; angle = -Math.PI * 0.25; }
        if (idx === 3) { x = width * 0.8; y = height * 0.75; angle = -Math.PI * 0.75; }
      }

      this.zeppelins.set(p.id, {
        id: p.id,
        x,
        y,
        vx: 0,
        vy: 0,
        angle,
        hp: 100,
        score: 0,
        isAlive: true,
        fireCooldown: 0,
        propAnim: 0
      });

      this.botThinkTimers.set(p.id, 0.2 + Math.random() * 0.3);
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

    // Update zeppelins
    this.zeppelins.forEach(z => {
      if (!z.isAlive) return;

      z.propAnim += dt * 15;
      if (z.fireCooldown > 0) z.fireCooldown -= dt;

      // Single-button controls: Tap to steer (rotate), hold to steam-thrust forward
      const isPressing = this.input.isPressed(z.id);
      if (isPressing) {
        // Thrust forward
        const thrust = 120;
        z.vx += Math.cos(z.angle) * thrust * dt;
        z.vy += Math.sin(z.angle) * thrust * dt;
        // Steam exhaust particles
        if (Math.random() < 0.3) {
          const backX = z.x - Math.cos(z.angle) * 30;
          const backY = z.y - Math.sin(z.angle) * 30;
          this.particles.emit(backX, backY, 1, 'rgba(230, 230, 230, 0.6)');
        }
      } else {
        // Rotate smoothly
        z.angle += 2.4 * dt;
      }

      // Drag
      z.vx *= 0.96;
      z.vy *= 0.96;

      z.x += z.vx * dt;
      z.y += z.vy * dt;

      // Screen boundaries
      if (z.x < 40) { z.x = 40; z.vx *= -0.5; }
      if (z.x > width - 40) { z.x = width - 40; z.vx *= -0.5; }
      if (z.y < 80) { z.y = 80; z.vy *= -0.5; }
      if (z.y > height - 40) { z.y = height - 40; z.vy *= -0.5; }

      // Auto-fire front steam cannon on tap or cooldown
      if (this.input.justPressed(z.id) && z.fireCooldown <= 0) {
        this.fireCannon(z);
      }
    });

    // Update cannonballs
    for (let i = this.cannonballs.length - 1; i >= 0; i--) {
      const b = this.cannonballs[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      // Check collision against other zeppelins
      let hit = false;
      this.zeppelins.forEach(target => {
        if (!target.isAlive || target.id === b.ownerId) return;
        const dist = Math.hypot(target.x - b.x, target.y - b.y);
        if (dist < 26) {
          hit = true;
          target.hp -= 25;
          this.particles.emit(b.x, b.y, 8, '#ff9900');
          this.audio.playTone(160, 0.2, 'sawtooth');

          const shooter = this.zeppelins.get(b.ownerId);
          if (shooter) shooter.score += 25;

          if (target.hp <= 0) {
            target.hp = 0;
            target.isAlive = false;
            this.particles.emit(target.x, target.y, 25, '#ff4500');
            this.audio.playTone(90, 0.5, 'square');
          }
        }
      });

      if (hit || b.life <= 0 || b.x < 0 || b.x > width || b.y < 50 || b.y > height) {
        this.cannonballs.splice(i, 1);
      }
    }

    // Check round over condition (1 or 0 zeppelins alive)
    let aliveCount = 0;
    this.zeppelins.forEach(z => { if (z.isAlive) aliveCount++; });
    if (aliveCount <= 1 && this.getActivePlayers().length > 1) {
      this.finishRound();
    }
  }

  private fireCannon(z: Zeppelin): void {
    z.fireCooldown = 0.65;
    const noseX = z.x + Math.cos(z.angle) * 32;
    const noseY = z.y + Math.sin(z.angle) * 32;
    const speed = 280;
    this.cannonballs.push({
      x: noseX,
      y: noseY,
      vx: Math.cos(z.angle) * speed + z.vx * 0.5,
      vy: Math.sin(z.angle) * speed + z.vy * 0.5,
      ownerId: z.id,
      life: 2.2
    });
    this.audio.playTone(280, 0.1, 'square');
    this.particles.emit(noseX, noseY, 4, '#ffdd44');
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _w: number,
    _h: number
  ): void {
    const z = this.zeppelins.get(botId);
    if (!z || !z.isAlive) return;

    let bTimer = (this.botThinkTimers.get(botId) || 0) - dt;
    if (bTimer > 0) {
      this.botThinkTimers.set(botId, bTimer);
      return;
    }

    // Find closest alive opponent
    let closest: Zeppelin | null = null;
    let minDist = 9999;
    this.zeppelins.forEach(other => {
      if (other.id !== botId && other.isAlive) {
        const d = Math.hypot(other.x - z.x, other.y - z.y);
        if (d < minDist) {
          minDist = d;
          closest = other;
        }
      }
    });

    if (closest) {
      const targetAngle = Math.atan2((closest as Zeppelin).y - z.y, (closest as Zeppelin).x - z.x);
      let diff = targetAngle - z.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;

      // If pointing roughly toward opponent, thrust and fire!
      if (Math.abs(diff) < 0.35) {
        this.input.setBotState(botId, true);
        if (z.fireCooldown <= 0 && Math.random() < (difficulty === 'bot_hard' ? 0.9 : 0.6)) {
          this.fireCannon(z);
        }
      } else {
        this.input.setBotState(botId, false);
      }
    }

    const interval = difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.15 : 0.28;
    this.botThinkTimers.set(botId, interval);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // London Dusk Sky
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#1a1824');
    grad.addColorStop(0.6, '#3a2e39');
    grad.addColorStop(1, '#543b42');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Silhouetted Big Ben and London Bridge towers in fog
    ctx.save();
    ctx.fillStyle = 'rgba(20, 16, 22, 0.4)';
    ctx.fillRect(width * 0.1, height - 70, 30, 70);
    ctx.beginPath();
    ctx.moveTo(width * 0.1 - 4, height - 70);
    ctx.lineTo(width * 0.1 + 15, height - 110);
    ctx.lineTo(width * 0.1 + 34, height - 70);
    ctx.fill();
    ctx.restore();

    // HUD Instructions
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 170, 56, 340, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#fceabb';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAP: ROTATE & SHOOT | HOLD: STEAM THRUST', width * 0.5, 69);
    ctx.restore();

    // Render Cannonballs
    ctx.fillStyle = '#ffcc00';
    this.cannonballs.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Render Zeppelins
    this.zeppelins.forEach(z => {
      if (!z.isAlive) return;
      const cfg = this.players.find(p => p.id === z.id);

      ctx.save();
      ctx.translate(z.x, z.y);
      ctx.rotate(z.angle);

      // Gas Envelope (Airship Body)
      ctx.fillStyle = cfg?.color || '#b8860b';
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      // Brass Ring Ribs
      ctx.strokeStyle = '#3a2a1a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(-8, 0, 13, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.arc(8, 0, 13, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();

      // Gondola cabin below
      ctx.fillStyle = '#5c3a21';
      ctx.fillRect(-10, 8, 20, 6);

      // Tail Fins & Propeller
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(-30, -8, 6, 16);
      const propScale = Math.sin(z.propAnim);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(-33, -6 * propScale, 2, 12 * propScale);

      // Front Cannon nozzle
      ctx.fillStyle = '#222222';
      ctx.fillRect(24, -2, 8, 4);

      ctx.restore();

      // HP Bar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(z.x - 22, z.y - 24, 44, 5);
      ctx.fillStyle = z.hp > 50 ? '#2ecc71' : z.hp > 25 ? '#f1c40f' : '#e74c3c';
      ctx.fillRect(z.x - 22, z.y - 24, 44 * (z.hp / 100), 5);
    });
  }

  private finishRound(): void {
    this.isFinished = true;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.zeppelins.forEach((z, pId) => scores.set(pId, z.score + (z.isAlive ? 50 : 0)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.zeppelins.entries())
      .map(([playerId, z]) => ({ playerId, score: z.score + (z.isAlive ? 50 : 0), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} conquered the skies!` : 'Zeppelins grounded in fog!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}
