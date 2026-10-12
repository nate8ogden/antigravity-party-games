import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SpaceAsteroid {
  id: number;
  x: number;
  y: number;
  type: 'gold' | 'platinum' | 'mine';
  radius: number;
  collected: boolean;
}

interface HarpoonRig {
  id: PlayerId;
  x: number;
  y: number;
  angle: number; // swinging pendulum angle
  angleDir: number;
  harpoonDist: number; // 0 (docked) to max
  harpoonState: 'idle' | 'firing' | 'retracting';
  caughtAsteroid: SpaceAsteroid | null;
  score: number;
  combo: number;
  staggerTimer: number;
}

export class AsteroidCatcherGame extends BaseGame {
  public rigs: Map<PlayerId, HarpoonRig> = new Map();
  public asteroids: SpaceAsteroid[] = [];
  public currentMapName: string = 'Kuiper Belt Refinery';

  private astIdCounter: number = 0;
  private nextAstSpawn: number = 1.0;
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
    this.rigs.clear();
    this.asteroids = [];
    this.botReactionTimers.clear();
    this.nextAstSpawn = 1.0;

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    active.forEach((p, idx) => {
      const cx = idx * colWidth + colWidth * 0.5;
      this.rigs.set(p.id, {
        id: p.id,
        x: cx,
        y: 90,
        angle: 0,
        angleDir: 1,
        harpoonDist: 0,
        harpoonState: 'idle',
        caughtAsteroid: null,
        score: 0,
        combo: 0,
        staggerTimer: 0,
      });
      this.botReactionTimers.set(p.id, 0);
    });

    // Spawn initial asteroids
    for (let i = 0; i < 8; i++) {
      this.spawnAsteroid(width, height);
    }
  }

  private spawnAsteroid(width: number, height: number): void {
    const isMine = Math.random() < 0.28;
    const isPlat = Math.random() < 0.35;
    this.asteroids.push({
      id: ++this.astIdCounter,
      x: 40 + Math.random() * (width - 80),
      y: 200 + Math.random() * (height - 280),
      type: isMine ? 'mine' : isPlat ? 'platinum' : 'gold',
      radius: isMine ? 12 : 16,
      collected: false,
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

    // Spawn asteroids if low
    this.nextAstSpawn -= dt;
    if (this.nextAstSpawn <= 0 && this.asteroids.length < 12) {
      this.spawnAsteroid(width, height);
      this.nextAstSpawn = 2.0;
    }

    this.rigs.forEach((r) => {
      const p = this.getPlayer(r.id);

      if (r.staggerTimer > 0) r.staggerTimer -= dt;

      // Pendulum swing when idle
      if (r.harpoonState === 'idle') {
        r.angle += r.angleDir * dt * 2.2;
        if (r.angle > 1.1) {
          r.angle = 1.1;
          r.angleDir = -1;
        } else if (r.angle < -1.1) {
          r.angle = -1.1;
          r.angleDir = 1;
        }

        // Human input: launch harpoon
        if (p && !p.type.startsWith('bot_')) {
          const justPressed = this.input.justPressed(r.id) || this.input.justAction(r.id);
          if (justPressed && r.staggerTimer <= 0) {
            this.fireHarpoon(r);
          }
        }
      } else if (r.harpoonState === 'firing') {
        r.harpoonDist += 360 * dt;
        const tipX = r.x + Math.sin(r.angle) * r.harpoonDist;
        const tipY = r.y + Math.cos(r.angle) * r.harpoonDist;

        // Check collision with asteroids
        for (const ast of this.asteroids) {
          if (!ast.collected && Math.hypot(ast.x - tipX, ast.y - tipY) < ast.radius + 10) {
            ast.collected = true;
            r.caughtAsteroid = ast;
            r.harpoonState = 'retracting';

            if (ast.type === 'mine') {
              // EXPLOSIVE SPACE MINE!
              r.score = Math.max(0, r.score - 20);
              r.combo = 0;
              r.staggerTimer = 0.8;
              this.audio.playTone(110, 0.3, 'sawtooth');
              this.particles.emit(tipX, tipY, 18, '#e74c3c');
            } else {
              this.audio.playTone(520, 0.1, 'triangle');
            }
            break;
          }
        }

        // Reached max extension or screen boundary
        if (r.harpoonDist > 420 || tipY > height - 30 || tipX < 10 || tipX > width - 10) {
          r.harpoonState = 'retracting';
        }
      } else if (r.harpoonState === 'retracting') {
        r.harpoonDist = Math.max(0, r.harpoonDist - 280 * dt);

        if (r.harpoonDist <= 0) {
          r.harpoonDist = 0;
          r.harpoonState = 'idle';

          // Harvest caught asteroid
          if (r.caughtAsteroid && r.caughtAsteroid.type !== 'mine') {
            const pts = r.caughtAsteroid.type === 'platinum' ? 45 : 25;
            r.score += pts + r.combo * 4;
            r.combo++;
            this.audio.playTone(780 + r.combo * 30, 0.15, 'sine');
            this.particles.emit(r.x, r.y + 10, 14, '#f1c40f');
          }
          r.caughtAsteroid = null;
        }
      }
    });

    this.asteroids = this.asteroids.filter((a) => !a.collected);
  }

  private fireHarpoon(r: HarpoonRig): void {
    r.harpoonState = 'firing';
    this.audio.playTone(340, 0.08, 'sine');
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const r = this.rigs.get(botId);
    if (!r || r.harpoonState !== 'idle' || r.staggerTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      // Find candidate non-mine asteroid in line of fire
      for (const ast of this.asteroids) {
        if (ast.type === 'mine') continue;
        const dx = ast.x - r.x;
        const dy = ast.y - r.y;
        if (dy > 30) {
          const targetAngle = Math.atan2(dx, dy);
          const diff = Math.abs(r.angle - targetAngle);
          const tolerance = difficulty === 'bot_hard' ? 0.16 : difficulty === 'bot_normal' ? 0.12 : 0.08;
          if (diff < tolerance) {
            this.fireHarpoon(r);
            bTimer = 0.6;
            break;
          }
        }
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Asteroid belt deep space background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0a0d14');
    bgGrad.addColorStop(0.5, '#151b28');
    bgGrad.addColorStop(1, '#05070a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Floating Asteroids
    this.asteroids.forEach((ast) => {
      ctx.save();
      ctx.translate(ast.x, ast.y);

      if (ast.type === 'gold') {
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(0, 0, ast.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d4ac0d';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (ast.type === 'platinum') {
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.arc(0, 0, ast.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else {
        // Red radioactive spiked mine
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(0, 0, ast.radius, 0, Math.PI * 2);
        ctx.fill();
        // Spikes
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * ast.radius, Math.sin(a) * ast.radius);
          ctx.lineTo(Math.cos(a) * (ast.radius + 6), Math.sin(a) * (ast.radius + 6));
          ctx.stroke();
        }
      }

      ctx.restore();
    });

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    this.rigs.forEach((r, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#f39c12';

      // Mining Gantry
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(r.x - 28, 55, 56, 18);
      ctx.fillStyle = color;
      ctx.fillRect(r.x - 8, 70, 16, 12);

      // Harpoon Tether Cable & Claw
      const tipX = r.x + Math.sin(r.angle) * r.harpoonDist;
      const tipY = r.y + Math.cos(r.angle) * r.harpoonDist;

      ctx.strokeStyle = '#bdc3c7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // Magnetic Claw Tip
      ctx.fillStyle = '#ecf0f1';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 7, 0, Math.PI * 2);
      ctx.fill();

      // Render caught asteroid moving back with claw
      if (r.caughtAsteroid && r.harpoonState === 'retracting') {
        ctx.fillStyle = r.caughtAsteroid.type === 'platinum' ? '#00e5ff' : '#f1c40f';
        ctx.beginPath();
        ctx.arc(tipX, tipY + 12, r.caughtAsteroid.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Score HUD
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${r.score}`, r.x, height * 0.94);
      if (r.combo > 1) {
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${r.combo}x MINING STREAK`, r.x, height * 0.98);
      }
    });

    // Top instruction pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🧲 TAP TO LAUNCH HARPOON • MINE GOLD, DODGE MINES!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.rigs.forEach((r, pId) => scores.set(pId, r.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.rigs.entries())
      .map(([playerId, r]) => ({ playerId, score: r.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} harvested the richest asteroid haul!` : 'Refinery harpoons empty!',
    };
  }
}
