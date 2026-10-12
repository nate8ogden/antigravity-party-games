import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface AsteroidGeode {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  gemType: 'ruby' | 'sapphire' | 'emerald';
  points: number;
}

interface MiningLaser {
  playerId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface GemShard {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gemType: 'ruby' | 'sapphire' | 'emerald';
  value: number;
}

interface MinerShip {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  fireCooldown: number;
  score: number;
}

export class AstroMinerGame extends BaseGame {
  private miners: Map<PlayerId, MinerShip> = new Map();
  private asteroids: AsteroidGeode[] = [];
  private lasers: MiningLaser[] = [];
  private shards: GemShard[] = [];
  private asteroidIdCounter: number = 0;
  private shardIdCounter: number = 0;
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
    this.miners.clear();
    this.asteroids = [];
    this.lasers = [];
    this.shards = [];
    this.asteroidIdCounter = 0;
    this.shardIdCounter = 0;

    for (let i = 0; i < 9; i++) {
      this.spawnAsteroid(width, height);
    }

    const active = this.getActivePlayers();
    const spawnOffsets = [
      { x: 100, y: 100, angle: Math.PI * 0.25 },
      { x: width - 100, y: 100, angle: Math.PI * 0.75 },
      { x: 100, y: height - 100, angle: -Math.PI * 0.25 },
      { x: width - 100, y: height - 100, angle: -Math.PI * 0.75 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnOffsets[idx % spawnOffsets.length];
      this.miners.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: pos.angle,
        fireCooldown: 0,
        score: 0
      });
    });
  }

  private spawnAsteroid(width: number, height: number): void {
    const types: ('ruby' | 'sapphire' | 'emerald')[] = ['ruby', 'sapphire', 'emerald'];
    const gemType = types[Math.floor(Math.random() * types.length)];
    const hp = gemType === 'ruby' ? 5 : gemType === 'sapphire' ? 4 : 3;
    const points = gemType === 'ruby' ? 30 : gemType === 'sapphire' ? 20 : 15;

    this.asteroids.push({
      id: ++this.asteroidIdCounter,
      x: 80 + Math.random() * (width - 160),
      y: 80 + Math.random() * (height - 160),
      vx: (Math.random() - 0.5) * 35,
      vy: (Math.random() - 0.5) * 35,
      radius: 20 + hp * 3,
      hp,
      maxHp: hp,
      gemType,
      points
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    this.updateBots(dt, width, height);

    while (this.asteroids.length < 8) {
      this.spawnAsteroid(width, height);
    }

    for (const ast of this.asteroids) {
      ast.x += ast.vx * dt;
      ast.y += ast.vy * dt;

      if (ast.x < ast.radius) { ast.x = ast.radius; ast.vx *= -1; }
      if (ast.x > width - ast.radius) { ast.x = width - ast.radius; ast.vx *= -1; }
      if (ast.y < ast.radius) { ast.y = ast.radius; ast.vy *= -1; }
      if (ast.y > height - ast.radius) { ast.y = height - ast.radius; ast.vy *= -1; }
    }

    for (const [id, m] of this.miners.entries()) {
      if (m.fireCooldown > 0) {
        m.fireCooldown -= dt;
      }

      const turnDir = this.input.getSteer(id);
      m.angle += turnDir * 3.4 * dt;

      const throttle = this.input.getThrottle(id);
      const isThrusting = throttle > 0.3 || this.input.isPressed(id);
      if (isThrusting) {
        const thrust = 200;
        m.vx += Math.cos(m.angle) * thrust * dt;
        m.vy += Math.sin(m.angle) * thrust * dt;

        this.particles.emit(
          m.x - Math.cos(m.angle) * 14,
          m.y - Math.sin(m.angle) * 14,
          2,
          '#FFB74D'
        );
      }

      // Fire laser on Action
      if (this.input.isActionPressed(id) && m.fireCooldown <= 0) {
        m.fireCooldown = 0.22;
        const speed = 460;
        this.lasers.push({
          playerId: id,
          x: m.x + Math.cos(m.angle) * 16,
          y: m.y + Math.sin(m.angle) * 16,
          vx: Math.cos(m.angle) * speed,
          vy: Math.sin(m.angle) * speed,
          life: 0.9
        });
        this.audio.playTone(740, 0.06, 'sawtooth');
      }

      m.vx *= Math.pow(0.95, dt * 60);
      m.vy *= Math.pow(0.95, dt * 60);
      m.x += m.vx * dt;
      m.y += m.vy * dt;

      m.x = Math.max(20, Math.min(width - 20, m.x));
      m.y = Math.max(20, Math.min(height - 20, m.y));

      // Collect gem shards
      for (let i = this.shards.length - 1; i >= 0; i--) {
        const shard = this.shards[i];
        if (Math.hypot(m.x - shard.x, m.y - shard.y) < 22) {
          m.score += shard.value;
          this.audio.playTone(600, 0.08, 'triangle');
          this.particles.emit(shard.x, shard.y, 8, shard.gemType === 'ruby' ? '#E53935' : shard.gemType === 'sapphire' ? '#1E88E5' : '#43A047');
          this.shards.splice(i, 1);
        }
      }
    }

    // Update Lasers
    for (let lIdx = this.lasers.length - 1; lIdx >= 0; lIdx--) {
      const laser = this.lasers[lIdx];
      laser.x += laser.vx * dt;
      laser.y += laser.vy * dt;
      laser.life -= dt;

      if (laser.life <= 0 || laser.x < 0 || laser.x > width || laser.y < 0 || laser.y > height) {
        this.lasers.splice(lIdx, 1);
        continue;
      }

      let hit = false;
      for (let aIdx = this.asteroids.length - 1; aIdx >= 0; aIdx--) {
        const ast = this.asteroids[aIdx];
        if (Math.hypot(laser.x - ast.x, laser.y - ast.y) < ast.radius) {
          hit = true;
          ast.hp--;
          this.audio.playTone(280, 0.08, 'square');
          this.particles.emit(laser.x, laser.y, 6, '#FFCC80');

          if (ast.hp <= 0) {
            this.audio.playTone(420, 0.15, 'sawtooth');
            const count = 3 + Math.floor(Math.random() * 3);
            for (let g = 0; g < count; g++) {
              const a = (g / count) * Math.PI * 2;
              const spd = 60 + Math.random() * 60;
              this.shards.push({
                id: ++this.shardIdCounter,
                x: ast.x,
                y: ast.y,
                vx: Math.cos(a) * spd,
                vy: Math.sin(a) * spd,
                gemType: ast.gemType,
                value: ast.points
              });
            }

            const owner = this.miners.get(laser.playerId);
            if (owner) owner.score += 20;

            this.asteroids.splice(aIdx, 1);
          }
          break;
        }
      }

      if (hit) {
        this.lasers.splice(lIdx, 1);
      }
    }

    // Update Shards
    for (const shard of this.shards) {
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      shard.vx *= Math.pow(0.96, dt * 60);
      shard.vy *= Math.pow(0.96, dt * 60);

      if (shard.x < 15) { shard.x = 15; shard.vx *= -1; }
      if (shard.x > width - 15) { shard.x = width - 15; shard.vx *= -1; }
      if (shard.y < 15) { shard.y = 15; shard.vy *= -1; }
      if (shard.y > height - 15) { shard.y = height - 15; shard.vy *= -1; }
    }
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: string, _width: number, _height: number): void {
    const timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const m = this.miners.get(botId);
    if (!m) return;

    let targetX = _width * 0.5;
    let targetY = _height * 0.5;
    let wantShoot = false;

    if (this.shards.length > 0) {
      let minDist = 99999;
      for (const shard of this.shards) {
        const d = Math.hypot(shard.x - m.x, shard.y - m.y);
        if (d < minDist) {
          minDist = d;
          targetX = shard.x;
          targetY = shard.y;
        }
      }
    } else {
      let minDist = 99999;
      let targetAst: AsteroidGeode | null = null;
      for (const ast of this.asteroids) {
        const d = Math.hypot(ast.x - m.x, ast.y - m.y);
        if (d < minDist) {
          minDist = d;
          targetAst = ast;
        }
      }

      if (targetAst) {
        targetX = targetAst.x;
        targetY = targetAst.y;

        const desiredAngle = Math.atan2(targetY - m.y, targetX - m.x);
        let angleDiff = Math.abs(desiredAngle - m.angle);
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        if (Math.abs(angleDiff) < 0.35 && minDist < 280) {
          wantShoot = true;
        }
      }
    }

    const desiredAngle = Math.atan2(targetY - m.y, targetX - m.x);
    let angleDiff = desiredAngle - m.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    let turn = 0;
    if (angleDiff > 0.15) turn = 1;
    else if (angleDiff < -0.15) turn = -1;

    const thrust = Math.abs(angleDiff) < 1.0;

    let delay = 0.25;
    if (difficulty === 'bot_easy') {
      delay = 0.45;
      if (Math.random() < 0.25) wantShoot = false;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
    }

    this.input.setBotInput(botId, thrust, turn, thrust ? 1 : 0, wantShoot);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#06070B';
    ctx.fillRect(0, 0, width, height);

    // Render Asteroids
    for (const ast of this.asteroids) {
      ctx.save();
      ctx.translate(ast.x, ast.y);

      ctx.fillStyle = '#424242';
      ctx.beginPath();
      ctx.arc(0, 0, ast.radius, 0, Math.PI * 2);
      ctx.fill();

      const gemColor = ast.gemType === 'ruby' ? '#E53935' : ast.gemType === 'sapphire' ? '#1E88E5' : '#43A047';
      ctx.fillStyle = gemColor;
      ctx.beginPath();
      ctx.arc(0, 0, ast.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();

      if (ast.hp < ast.maxHp) {
        ctx.strokeStyle = '#BDBDBD';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-ast.radius * 0.5, 0);
        ctx.lineTo(0, ast.radius * 0.4);
        ctx.lineTo(ast.radius * 0.5, -ast.radius * 0.2);
        ctx.stroke();
      }

      ctx.restore();
    }

    // Render Gem Shards
    for (const shard of this.shards) {
      ctx.save();
      ctx.translate(shard.x, shard.y);
      const color = shard.gemType === 'ruby' ? '#FF1744' : shard.gemType === 'sapphire' ? '#2979FF' : '#00E676';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Render Lasers
    for (const laser of this.lasers) {
      const color = this.getPlayer(laser.playerId)?.color || '#EF4444';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(laser.x, laser.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render Miners
    for (const [id, m] of this.miners.entries()) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.angle);

      const color = this.getPlayer(id)?.color || '#EF4444';

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(-10, -11);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-10, 11);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#CFD8DC';
      ctx.fillRect(8, -2, 7, 4);

      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${m.score}`, m.x, m.y - 18);
    }
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.miners.entries()).map(([playerId, m]) => ({
      playerId,
      score: m.score
    }));
    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `Player ${winnerId + 1} mined the cosmic jackpot with ${scores[0].score} pts!` : 'Ore veins depleted!'
    };
  }
}
