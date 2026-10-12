import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface DesertObstacle {
  x: number;
  y: number;
  type: 'cactus' | 'horseshoe';
  hit: boolean;
}

interface HorseState {
  x: number;
  vx: number;
  dir: number;
  stunTimer: number;
  score: number;
}

export class CactusSlalomGame extends BaseGame {
  private horses: Map<PlayerId, HorseState> = new Map();
  private obstacles: DesertObstacle[] = [];
  private spawnTimer: number = 0;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, _height: number = 600): void {
    this.horses.clear();
    this.obstacles = [];
    this.spawnTimer = 0.4;
    this.roundTimer = 25.0;
    this.isFinished = false;

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const startX = this.getTrackLaneCenter(i, width, active.length);
      this.horses.set(p.id, {
        x: startX,
        vx: 0,
        dir: 1,
        stunTimer: 0,
        score: 0
      });
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
    const trackWidth = width / Math.max(1, active.length);

    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const horse = this.horses.get(p.id);
      if (!horse) continue;

      if (horse.stunTimer > 0) {
        horse.stunTimer -= dt;
        continue;
      }

      horse.score += dt * 5;

      if (this.input.justPressed(p.id)) {
        horse.dir *= -1;
        this.audio.playTone(400, 0.04, 'triangle');
      }

      horse.vx = horse.dir * 180;
      horse.x += horse.vx * dt;

      const minX = i * trackWidth + 25;
      const maxX = (i + 1) * trackWidth - 25;
      if (horse.x < minX) {
        horse.x = minX;
        horse.dir = 1;
      } else if (horse.x > maxX) {
        horse.x = maxX;
        horse.dir = -1;
      }
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.5 + Math.random() * 0.4;
      for (let i = 0; i < active.length; i++) {
        const laneLeft = i * trackWidth + 30;
        const laneW = trackWidth - 60;
        const ox = laneLeft + Math.random() * laneW;
        const isHorseshoe = Math.random() < 0.35;
        this.obstacles.push({
          x: ox,
          y: -30,
          type: isHorseshoe ? 'horseshoe' : 'cactus',
          hit: false
        });
      }
    }

    const scrollSpeed = 240;
    const playerY = height - 80;

    for (const obs of this.obstacles) {
      if (obs.hit) continue;
      obs.y += scrollSpeed * dt;

      for (let i = 0; i < active.length; i++) {
        const p = active[i];
        const horse = this.horses.get(p.id);
        if (!horse || horse.stunTimer > 0) continue;

        if (Math.hypot(obs.x - horse.x, obs.y - playerY) < 26) {
          obs.hit = true;
          if (obs.type === 'cactus') {
            horse.stunTimer = 1.0;
            horse.score = Math.max(0, horse.score - 10);
            this.particles.emit(horse.x, playerY, 12, '#EF4444');
            this.audio.playTone(160, 0.15, 'sawtooth');
          } else {
            horse.score += 15;
            this.particles.emit(obs.x, obs.y, 8, '#FBBF24');
            this.audio.playTone(720, 0.08, 'sine');
          }
          break;
        }
      }
    }

    this.obstacles = this.obstacles.filter(o => !o.hit && o.y < height + 50);
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, height: number): void {
    const playerY = height - 80;
    const horse = this.horses.get(botId);
    if (!horse || horse.stunTimer > 0) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false);
      return;
    }

    const scanWindow = difficulty === 'bot_easy' ? 90 : difficulty === 'bot_normal' ? 140 : 175;
    const canDodge = difficulty === 'bot_easy' ? Math.random() < 0.68 : true;

    const danger = this.obstacles.find(
      o => !o.hit && o.type === 'cactus' && o.y > playerY - scanWindow && o.y < playerY && Math.abs(o.x - horse.x) < 35
    );

    if (danger && canDodge) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  private getTrackLaneCenter(index: number, width: number, total: number): number {
    const trackWidth = width / Math.max(1, total);
    return trackWidth * index + trackWidth / 2;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#D97706';
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const trackWidth = width / Math.max(1, active.length);

    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    for (let i = 1; i < active.length; i++) {
      ctx.beginPath();
      ctx.moveTo(i * trackWidth, 0);
      ctx.lineTo(i * trackWidth, height);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    for (const obs of this.obstacles) {
      if (obs.hit) continue;

      if (obs.type === 'cactus') {
        ctx.fillStyle = '#15803D';
        ctx.fillRect(obs.x - 4, obs.y - 16, 8, 28);
        ctx.fillRect(obs.x - 14, obs.y - 8, 10, 4);
        ctx.fillRect(obs.x - 14, obs.y - 16, 4, 10);
        ctx.fillRect(obs.x + 4, obs.y - 4, 10, 4);
        ctx.fillRect(obs.x + 10, obs.y - 12, 4, 10);
      } else {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, 8, 0.3 * Math.PI, 1.7 * Math.PI);
        ctx.stroke();
      }
    }

    const playerY = height - 80;
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const horse = this.horses.get(p.id);
      if (!horse) continue;

      ctx.save();
      ctx.translate(horse.x, playerY);

      if (horse.stunTimer > 0) {
        ctx.rotate(Date.now() * 0.02);
      }

      ctx.fillStyle = '#78350F';
      ctx.fillRect(-10, -18, 20, 36);

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, -2, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#451A03';
      ctx.fillRect(-12, -8, 24, 3);
      ctx.fillRect(-6, -13, 12, 5);

      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${Math.floor(horse.score)}`, this.getTrackLaneCenter(i, width, active.length), 30);
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`CACTUS SLALOM: ${Math.ceil(this.roundTimer)}s`, width / 2, 55);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: Math.floor(this.horses.get(p.id)?.score || 0),
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} out-galloped the prickly desert!` : 'The horses rested under the desert sun!'
    };
  }
}
