import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SaloonObstacle {
  id: number;
  lane: number;
  type: 'patron' | 'barstool';
  x: number;
  speed: number;
  hit: boolean;
}

interface Mug {
  lane: number;
  x: number;
  speed: number;
  active: boolean;
}

export class SaloonBrawlerGame extends BaseGame {
  private scores: Map<PlayerId, number> = new Map();
  private ducks: Map<PlayerId, boolean> = new Map();
  private stuns: Map<PlayerId, number> = new Map();
  private obstacles: SaloonObstacle[] = [];
  private mugs: Mug[] = [];
  private spawnTimer: number = 0;
  private nextObstacleId: number = 1;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.scores.clear();
    this.ducks.clear();
    this.stuns.clear();
    this.obstacles = [];
    this.mugs = [];
    this.roundTimer = 25.0;
    this.isFinished = false;
    this.spawnTimer = 0.5;

    for (const p of this.getActivePlayers()) {
      this.scores.set(p.id, 0);
      this.ducks.set(p.id, false);
      this.stuns.set(p.id, 0);
    }
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

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const stun = this.stuns.get(p.id) || 0;
      if (stun > 0) {
        this.stuns.set(p.id, Math.max(0, stun - dt));
        this.ducks.set(p.id, false);
        continue;
      }

      const isPressed = this.input.isPressed(p.id);
      const justPressed = this.input.justPressed(p.id);

      if (justPressed) {
        this.mugs.push({
          lane: i,
          x: 140,
          speed: 480,
          active: true
        });
        this.audio.playTone(420, 0.08, 'triangle');
      }

      this.ducks.set(p.id, isPressed);
    }

    // Spawn obstacles
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.55 + Math.random() * 0.45;
      const lane = Math.floor(Math.random() * active.length);
      const type: 'patron' | 'barstool' = Math.random() < 0.55 ? 'patron' : 'barstool';
      this.obstacles.push({
        id: this.nextObstacleId++,
        lane,
        type,
        x: width - 60,
        speed: 200 + Math.random() * 100,
        hit: false
      });
    }

    // Update mugs
    for (const mug of this.mugs) {
      if (!mug.active) continue;
      mug.x += mug.speed * dt;
      if (mug.x > width) {
        mug.active = false;
      }
    }

    // Update obstacles
    for (const obs of this.obstacles) {
      if (obs.hit) continue;
      obs.x -= obs.speed * dt;

      if (obs.type === 'patron') {
        for (const mug of this.mugs) {
          if (mug.active && mug.lane === obs.lane && Math.abs(mug.x - obs.x) < 32) {
            mug.active = false;
            obs.hit = true;
            const p = active[obs.lane];
            if (p) {
              this.scores.set(p.id, (this.scores.get(p.id) || 0) + 10);
              this.particles.emit(obs.x, this.getLaneY(obs.lane, height, active.length), 8, '#F59E0B');
              this.audio.playTone(660, 0.1, 'sine');
            }
            break;
          }
        }
      }

      if (obs.x <= 140 && !obs.hit) {
        obs.hit = true;
        const p = active[obs.lane];
        if (p) {
          const isDucking = this.ducks.get(p.id) || false;
          if (obs.type === 'barstool') {
            if (!isDucking) {
              this.stuns.set(p.id, 1.4);
              this.scores.set(p.id, Math.max(0, (this.scores.get(p.id) || 0) - 5));
              this.particles.emit(140, this.getLaneY(obs.lane, height, active.length), 12, '#EF4444');
              this.audio.playTone(180, 0.2, 'sawtooth');
            } else {
              this.scores.set(p.id, (this.scores.get(p.id) || 0) + 5);
              this.audio.playTone(550, 0.08, 'sine');
            }
          } else {
            this.scores.set(p.id, Math.max(0, (this.scores.get(p.id) || 0) - 2));
            this.audio.playTone(220, 0.1, 'sawtooth');
          }
        }
      }
    }

    this.mugs = this.mugs.filter(m => m.active);
    this.obstacles = this.obstacles.filter(o => !o.hit && o.x > 80);
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, _height: number): void {
    const active = this.getActivePlayers();
    const lane = active.findIndex(p => p.id === botId);
    if (lane === -1) return;

    const incoming = this.obstacles.find(o => o.lane === lane && !o.hit && o.x > 140 && o.x < 420);
    if (incoming) {
      if (incoming.type === 'barstool') {
        if (incoming.x < 240) {
          this.input.setBotInput(botId, true);
        } else {
          this.input.setBotInput(botId, false);
        }
      } else {
        const reaction = difficulty === 'bot_hard' ? 0.8 : difficulty === 'bot_normal' ? 0.6 : 0.4;
        if (Math.random() < reaction * dt * 4) {
          this.input.setBotInput(botId, true);
        } else {
          this.input.setBotInput(botId, false);
        }
      }
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  private getLaneY(lane: number, height: number, totalLanes: number): number {
    const laneHeight = (height - 100) / Math.max(1, totalLanes);
    return 60 + lane * laneHeight + laneHeight / 2;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#27170E';
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const laneHeight = (height - 100) / Math.max(1, active.length);

    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const y = this.getLaneY(i, height, active.length);

      ctx.fillStyle = i % 2 === 0 ? '#3E2723' : '#4E342E';
      ctx.fillRect(20, y - laneHeight * 0.4, width - 40, laneHeight * 0.8);
      ctx.strokeStyle = '#6D4C41';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, y - laneHeight * 0.4, width - 40, laneHeight * 0.8);

      const isDucking = this.ducks.get(p.id) || false;
      const isStunned = (this.stuns.get(p.id) || 0) > 0;

      ctx.save();
      ctx.translate(90, y);
      if (isStunned) {
        ctx.fillStyle = '#9CA3AF';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('STUN', 0, -20);
      } else if (isDucking) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 12, 16, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('DUCK', 0, 26);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8D6E63';
        ctx.fillRect(-18, -14, 36, 4);
        ctx.fillRect(-10, -22, 20, 8);
      }
      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${p.name}: ${this.scores.get(p.id) || 0} pts`, 30, y - laneHeight * 0.25);
    }

    for (const mug of this.mugs) {
      const y = this.getLaneY(mug.lane, height, active.length);
      ctx.fillStyle = '#FBBF24';
      ctx.fillRect(mug.x - 8, y - 10, 16, 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(mug.x - 8, y - 14, 16, 5);
      ctx.strokeStyle = '#D97706';
      ctx.strokeRect(mug.x - 8, y - 10, 16, 20);
    }

    for (const obs of this.obstacles) {
      const y = this.getLaneY(obs.lane, height, active.length);
      if (obs.type === 'patron') {
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.arc(obs.x, y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('THIRSTY', obs.x, y - 18);
      } else {
        ctx.save();
        ctx.translate(obs.x, y);
        ctx.rotate(Date.now() * 0.01);
        ctx.fillStyle = '#B45309';
        ctx.fillRect(-12, -12, 24, 24);
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(-12, -12, 24, 24);
        ctx.restore();
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('DUCK!', obs.x, y - 20);
      }
    }

    ctx.fillStyle = '#F3F4F6';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`SALOON BRAWL: ${Math.ceil(this.roundTimer)}s`, width / 2, 30);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.scores.get(p.id) || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} served up justice in the saloon!` : 'A dusty saloon draw!'
    };
  }
}
