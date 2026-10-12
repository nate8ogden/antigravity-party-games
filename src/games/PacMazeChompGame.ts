import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Pellet {
  x: number;
  y: number;
  isEnergizer: boolean;
  collected: boolean;
}

interface MazeGhost {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  isFrightened: boolean;
}

interface PacPlayer {
  id: PlayerId;
  x: number;
  y: number;
  angle: number;
  score: number;
  powerTimer: number;
  stunTimer: number;
  mouthAngle: number;
}

export class PacMazeChompGame extends BaseGame {
  private playersState: Map<PlayerId, PacPlayer> = new Map();
  private pellets: Pellet[] = [];
  private ghosts: MazeGhost[] = [];

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 30;
    this.playersState.clear();
    this.pellets = [];
    this.ghosts = [];

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height - 50,
        angle: -Math.PI / 2,
        score: 0,
        powerTimer: 0,
        stunTimer: 0,
        mouthAngle: 0.2
      });
    });

    // Populate Pellet Grid
    const stepX = 35;
    const stepY = 32;
    for (let x = 45; x < width - 40; x += stepX) {
      for (let y = 60; y < height - 50; y += stepY) {
        const isCorner =
          (x <= 60 || x >= width - 60) && (y <= 80 || y >= height - 80);
        this.pellets.push({
          x,
          y,
          isEnergizer: isCorner,
          collected: false
        });
      }
    }

    // Spawn 2 roaming maze ghosts
    this.ghosts.push(
      { x: width / 2 - 30, y: height / 2, vx: 70, vy: 0, color: '#ef4444', isFrightened: false },
      { x: width / 2 + 30, y: height / 2, vx: -70, vy: 0, color: '#f472b6', isFrightened: false }
    );
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Update Ghosts
    for (const g of this.ghosts) {
      g.x += g.vx * dt;
      g.y += g.vy * dt;

      if (g.x < 35 || g.x > width - 35) g.vx *= -1;
      if (g.y < 55 || g.y > height - 40) g.vy *= -1;

      // Random turn
      if (Math.random() < 0.02) {
        if (Math.random() < 0.5) {
          g.vx = (Math.random() < 0.5 ? 70 : -70);
          g.vy = 0;
        } else {
          g.vx = 0;
          g.vy = (Math.random() < 0.5 ? 70 : -70);
        }
      }
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        continue;
      }

      if (ps.powerTimer > 0) {
        ps.powerTimer -= dt;
      }

      // Mouth animation
      ps.mouthAngle = Math.abs(Math.sin((30 - this.roundTimer) * 12)) * 0.4 + 0.05;

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);

      const moveSpeed = ps.powerTimer > 0 ? 170 : 130;
      if (Math.abs(steer) > 0.1 || Math.abs(throttle) > 0.1) {
        ps.angle = Math.atan2(-throttle, steer);
        ps.x += steer * moveSpeed * dt;
        ps.y += -throttle * moveSpeed * dt;
      }

      ps.x = Math.max(30, Math.min(width - 30, ps.x));
      ps.y = Math.max(55, Math.min(height - 40, ps.y));

      // Chomp Pellets
      for (const pellet of this.pellets) {
        if (pellet.collected) continue;
        const dist = Math.hypot(ps.x - pellet.x, ps.y - pellet.y);
        if (dist < (pellet.isEnergizer ? 18 : 12)) {
          pellet.collected = true;
          if (pellet.isEnergizer) {
            ps.score += 25;
            ps.powerTimer = 5.0;
            this.audio.playBoost();
            this.particles.emit(pellet.x, pellet.y, 14, '#fde047');
          } else {
            ps.score += 2;
            if (Math.random() < 0.25) this.audio.playChomp();
          }
        }
      }

      // Check Ghost interaction
      for (const g of this.ghosts) {
        const dist = Math.hypot(ps.x - g.x, ps.y - g.y);
        if (dist < 22) {
          if (ps.powerTimer > 0) {
            // Chomp ghost!
            ps.score += 50;
            g.x = width / 2;
            g.y = height / 2;
            this.audio.playScore();
            this.particles.emit(g.x, g.y, 18, '#38bdf8');
          } else {
            // Ghost caught player
            ps.stunTimer = 1.2;
            ps.score = Math.max(0, ps.score - 5);
            this.audio.playStun();
            this.particles.shake(0.3);
            this.particles.emit(ps.x, ps.y, 12, '#ef4444');
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.stunTimer > 0) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false, 0, 0);
      return;
    }

    // If power mode active, hunt nearest ghost
    if (ps.powerTimer > 0 && this.ghosts.length > 0) {
      const g = this.ghosts[0];
      const dx = g.x - ps.x;
      const dy = g.y - ps.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 10) {
        this.input.setBotInput(botId, true, dx / dist, -dy / dist);
        return;
      }
    }

    // Avoid ghosts if not powered
    const avoidDist = difficulty === 'bot_easy' ? 45 : difficulty === 'bot_normal' ? 62 : 80;
    const canDodgeGhost = difficulty === 'bot_easy' ? Math.random() < 0.70 : true;
    if (canDodgeGhost) {
      for (const g of this.ghosts) {
        const dist = Math.hypot(ps.x - g.x, ps.y - g.y);
        if (dist < avoidDist) {
          const avoidX = Math.sign(ps.x - g.x);
          const avoidY = Math.sign(ps.y - g.y);
          this.input.setBotInput(botId, false, avoidX, -avoidY);
          return;
        }
      }
    }

    // Find nearest uncollected pellet
    let nearest: Pellet | null = null;
    let minDist = Infinity;
    for (const pel of this.pellets) {
      if (pel.collected) continue;
      const d = Math.hypot(pel.x - ps.x, pel.y - ps.y);
      if (d < minDist) {
        minDist = d;
        nearest = pel;
      }
    }

    if (nearest) {
      const dx = nearest.x - ps.x;
      const dy = nearest.y - ps.y;
      const dist = Math.hypot(dx, dy);
      this.input.setBotInput(botId, true, dx / dist, -dy / dist);
    } else {
      this.input.setBotInput(botId, false, 0, 0);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Pure Black Arcade Maze Screen
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, width, height);

    // Double Blue Neon Maze Outer Border
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3;
    ctx.strokeRect(15, 45, width - 30, height - 55);

    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 1;
    ctx.strokeRect(19, 49, width - 38, height - 63);

    // Render Pellets
    for (const p of this.pellets) {
      if (p.collected) continue;
      if (p.isEnergizer) {
        // Flashing big power pellet
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Normal pellet
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
    }

    // Render Ghosts
    for (const g of this.ghosts) {
      ctx.save();
      ctx.translate(g.x, g.y);

      // Ghost dome & skirt
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.arc(0, -2, 10, Math.PI, 0);
      ctx.lineTo(10, 8);
      ctx.lineTo(5, 5);
      ctx.lineTo(0, 8);
      ctx.lineTo(-5, 5);
      ctx.lineTo(-10, 8);
      ctx.closePath();
      ctx.fill();

      // Ghost eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-4, -2, 3, 0, Math.PI * 2);
      ctx.arc(4, -2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e3a8a';
      ctx.beginPath();
      ctx.arc(-3, -2, 1.5, 0, Math.PI * 2);
      ctx.arc(5, -2, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Render Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      if (ps.powerTimer > 0) {
        ctx.shadowColor = '#fde047';
        ctx.shadowBlur = 12;
      }

      ctx.rotate(ps.angle);

      // Chomp Disc Wedge Shape
      ctx.fillStyle = ps.powerTimer > 0 ? '#fde047' : p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 13, ps.mouthAngle, Math.PI * 2 - ps.mouthAngle);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Stun
      if (ps.stunTimer > 0) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('*STUN*', 0, -18);
      }

      ctx.restore();

      // Score
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y + 24);
    }

    // Top HUD
    ctx.fillStyle = 'rgba(3, 7, 18, 0.9)';
    ctx.fillRect(0, 0, width, 36);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('PAC MAZE CHOMP', 16, 24);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.roundTimer < 6 ? '#ef4444' : '#f8fafc';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width - 16, 24);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} chomped the most pellets and ghosts!` : 'Maze cleared!'
    };
  }
}
