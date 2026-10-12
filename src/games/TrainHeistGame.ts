import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface TrainObstacle {
  x: number;
  type: 'overhead' | 'low';
  width: number;
  height: number;
  hit: boolean[];
}

interface GoldSack {
  x: number;
  y: number;
  collected: boolean;
}

export class TrainHeistGame extends BaseGame {
  private scores: Map<PlayerId, number> = new Map();
  private playerY: Map<PlayerId, number> = new Map();
  private playerVY: Map<PlayerId, number> = new Map();
  private playerDucking: Map<PlayerId, boolean> = new Map();
  private isGrounded: Map<PlayerId, boolean> = new Map();
  private obstacles: TrainObstacle[] = [];
  private goldSacks: GoldSack[] = [];
  private trainScroll: number = 0;
  private spawnTimer: number = 0;

  private readonly ROOF_Y = 320;
  private readonly GRAVITY = 1100;
  private readonly JUMP_FORCE = -480;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.scores.clear();
    this.playerY.clear();
    this.playerVY.clear();
    this.playerDucking.clear();
    this.isGrounded.clear();
    this.obstacles = [];
    this.goldSacks = [];
    this.trainScroll = 0;
    this.spawnTimer = 0.5;
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.scores.set(p.id, 0);
      this.playerY.set(p.id, this.ROOF_Y);
      this.playerVY.set(p.id, 0);
      this.playerDucking.set(p.id, false);
      this.isGrounded.set(p.id, true);
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

    this.trainScroll = (this.trainScroll + 300 * dt) % 200;
    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const isPressed = this.input.isPressed(p.id);
      const justPressed = this.input.justPressed(p.id);

      let py = this.playerY.get(p.id) || this.ROOF_Y;
      let vy = this.playerVY.get(p.id) || 0;
      let grounded = this.isGrounded.get(p.id) || false;

      if (justPressed && grounded) {
        vy = this.JUMP_FORCE;
        grounded = false;
        this.audio.playTone(480, 0.08, 'square');
      }

      const isDucking = grounded && isPressed;
      this.playerDucking.set(p.id, isDucking);

      if (!grounded) {
        vy += this.GRAVITY * dt;
        py += vy * dt;
        if (py >= this.ROOF_Y) {
          py = this.ROOF_Y;
          vy = 0;
          grounded = true;
        }
      }

      this.playerY.set(p.id, py);
      this.playerVY.set(p.id, vy);
      this.isGrounded.set(p.id, grounded);
    }

    // Spawn obstacles & loot
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.2 + Math.random() * 0.9;
      const type: 'overhead' | 'low' = Math.random() < 0.5 ? 'overhead' : 'low';
      this.obstacles.push({
        x: width + 50,
        type,
        width: type === 'overhead' ? 60 : 35,
        height: type === 'overhead' ? 40 : 35,
        hit: new Array(active.length).fill(false)
      });

      if (Math.random() < 0.75) {
        this.goldSacks.push({
          x: width + 120,
          y: Math.random() < 0.5 ? this.ROOF_Y - 20 : this.ROOF_Y - 80,
          collected: false
        });
      }
    }

    const trainSpeed = 380;
    for (const obs of this.obstacles) {
      obs.x -= trainSpeed * dt;

      for (let i = 0; i < active.length; i++) {
        if (obs.hit[i]) continue;
        const p = active[i];
        const px = 100 + i * 85;
        const py = this.playerY.get(p.id) || this.ROOF_Y;
        const ducking = this.playerDucking.get(p.id) || false;

        if (Math.abs(obs.x - px) < 30) {
          if (obs.type === 'overhead') {
            if (!ducking || py < this.ROOF_Y - 5) {
              obs.hit[i] = true;
              this.scores.set(p.id, Math.max(0, (this.scores.get(p.id) || 0) - 5));
              this.particles.emit(px, py - 20, 8, '#EF4444');
              this.audio.playTone(160, 0.15, 'sawtooth');
            }
          } else {
            if (py >= this.ROOF_Y - 15) {
              obs.hit[i] = true;
              this.scores.set(p.id, Math.max(0, (this.scores.get(p.id) || 0) - 5));
              this.particles.emit(px, py - 10, 8, '#EF4444');
              this.audio.playTone(160, 0.15, 'sawtooth');
            }
          }
        }
      }
    }

    for (const sack of this.goldSacks) {
      if (sack.collected) continue;
      sack.x -= trainSpeed * dt;

      for (let i = 0; i < active.length; i++) {
        const p = active[i];
        const px = 100 + i * 85;
        const py = this.playerY.get(p.id) || this.ROOF_Y;

        if (Math.hypot(sack.x - px, sack.y - (py - 15)) < 32) {
          sack.collected = true;
          this.scores.set(p.id, (this.scores.get(p.id) || 0) + 10);
          this.particles.emit(sack.x, sack.y, 8, '#FBBF24');
          this.audio.playTone(660, 0.08, 'sine');
          break;
        }
      }
    }

    this.obstacles = this.obstacles.filter(o => o.x > -100);
    this.goldSacks = this.goldSacks.filter(s => !s.collected && s.x > -50);
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, _height: number): void {
    const active = this.getActivePlayers();
    const i = active.findIndex(p => p.id === botId);
    if (i === -1) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false);
      return;
    }

    const px = 100 + i * 85;
    const canDodge = difficulty === 'bot_easy' ? Math.random() < 0.68 : true;
    const scanWindow = difficulty === 'bot_easy' ? 120 : difficulty === 'bot_normal' ? 160 : 185;
    const nextObs = this.obstacles.find(o => o.x > px && o.x < px + scanWindow && !o.hit[i]);

    if (nextObs && canDodge) {
      if (nextObs.type === 'overhead') {
        this.input.setBotInput(botId, true);
      } else {
        const jumpDistance = difficulty === 'bot_easy' ? 55 : difficulty === 'bot_normal' ? 70 : 75;
        if (nextObs.x < px + jumpDistance) {
          this.input.setBotInput(botId, true);
        } else {
          this.input.setBotInput(botId, false);
        }
      }
    } else {
      const grabGold = difficulty === 'bot_easy' ? Math.random() < 0.5 : true;
      const highGold = grabGold && this.goldSacks.find(s => !s.collected && s.y < this.ROOF_Y - 40 && s.x > px && s.x < px + 65);
      if (highGold) {
        this.input.setBotInput(botId, true);
      } else {
        this.input.setBotInput(botId, false);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#EA580C');
    skyGrad.addColorStop(0.4, '#F59E0B');
    skyGrad.addColorStop(0.8, '#D97706');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#9A3412';
    ctx.beginPath();
    ctx.moveTo(0, 240);
    ctx.lineTo(150, 180);
    ctx.lineTo(300, 240);
    ctx.lineTo(500, 190);
    ctx.lineTo(700, 240);
    ctx.lineTo(width, 210);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fill();

    ctx.fillStyle = '#374151';
    ctx.fillRect(0, this.ROOF_Y, width, 160);

    ctx.strokeStyle = '#1F2937';
    ctx.lineWidth = 3;
    for (let x = -this.trainScroll; x < width + 100; x += 180) {
      ctx.strokeRect(x, this.ROOF_Y, 175, 120);
      ctx.fillStyle = '#4B5563';
      ctx.fillRect(x + 5, this.ROOF_Y, 165, 8);
    }

    for (const obs of this.obstacles) {
      if (obs.type === 'overhead') {
        ctx.fillStyle = '#78350F';
        ctx.fillRect(obs.x - obs.width / 2, this.ROOF_Y - 75, obs.width, obs.height);
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(obs.x - obs.width / 2, this.ROOF_Y - 75, obs.width, 5);
      } else {
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(obs.x - obs.width / 2, this.ROOF_Y - obs.height, obs.width, obs.height);
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(obs.x - obs.width / 2, this.ROOF_Y - 8, obs.width, 8);
      }
    }

    for (const sack of this.goldSacks) {
      if (sack.collected) continue;
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(sack.x, sack.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#78350F';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', sack.x, sack.y + 4);
    }

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const px = 100 + i * 85;
      const py = this.playerY.get(p.id) || this.ROOF_Y;
      const ducking = this.playerDucking.get(p.id) || false;

      ctx.save();
      ctx.translate(px, py);

      if (ducking) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, -10, 16, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#78350F';
        ctx.fillRect(-16, -20, 32, 4);
        ctx.fillRect(-8, -26, 16, 6);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, -22, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-6, -10);
        ctx.lineTo(-6, 0);
        ctx.moveTo(6, -10);
        ctx.lineTo(6, 0);
        ctx.stroke();
        ctx.fillStyle = '#78350F';
        ctx.fillRect(-16, -34, 32, 4);
        ctx.fillRect(-8, -42, 16, 8);
      }
      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${this.scores.get(p.id) || 0}`, px, 60 + (i % 2) * 20);
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TRAIN HEIST: ${Math.ceil(this.roundTimer)}s`, width / 2, 30);
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} rode the iron horse to riches!` : 'The desert train rode into the sunset!'
    };
  }
}
