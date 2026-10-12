import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface IceObstacle {
  id: number;
  x: number;
  type: 'iceberg' | 'serpent';
  shattered: boolean;
}

interface LongshipRacer {
  id: PlayerId;
  laneY: number;
  shipX: number;
  speed: number;
  score: number;
  combo: number;
  drumBeatPhase: number;
  oarSplashAnim: number;
  foulTimer: number;
  obstacles: IceObstacle[];
  nextObstacleDist: number;
}

export class VikingLongshipGame extends BaseGame {
  public racers: Map<PlayerId, LongshipRacer> = new Map();
  public currentMapName: string = 'Fjords of Valhalla';
  private obsIdCounter: number = 0;
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
    this.racers.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    active.forEach((p, idx) => {
      const laneY = 70 + idx * laneHeight + laneHeight * 0.5;
      this.racers.set(p.id, {
        id: p.id,
        laneY,
        shipX: 90,
        speed: 120,
        score: 0,
        combo: 0,
        drumBeatPhase: 0,
        oarSplashAnim: 0,
        foulTimer: 0,
        obstacles: [],
        nextObstacleDist: 220,
      });
      this.botReactionTimers.set(p.id, 0);
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

    const baseScroll = 140;

    this.racers.forEach((r) => {
      const p = this.getPlayer(r.id);
      if (r.foulTimer > 0) r.foulTimer -= dt;
      if (r.oarSplashAnim > 0) r.oarSplashAnim = Math.max(0, r.oarSplashAnim - dt * 3);

      r.drumBeatPhase = (r.drumBeatPhase + dt * 1.1) % 1.0;

      if (p && !p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(r.id) || this.input.justAction(r.id);
        if (justPressed && r.foulTimer <= 0) {
          this.strokeDrum(r);
        }
      }

      r.speed = Math.max(80, r.speed - 30 * dt);

      r.nextObstacleDist -= (baseScroll + r.speed * 0.4) * dt;
      if (r.nextObstacleDist <= 0) {
        r.obstacles.push({
          id: ++this.obsIdCounter,
          x: width + 40,
          type: Math.random() > 0.4 ? 'iceberg' : 'serpent',
          shattered: false,
        });
        r.nextObstacleDist = 200 + Math.random() * 150;
      }

      for (let i = r.obstacles.length - 1; i >= 0; i--) {
        const obs = r.obstacles[i];
        obs.x -= (baseScroll + r.speed * 0.4) * dt;

        if (!obs.shattered && obs.x <= r.shipX + 35 && obs.x >= r.shipX - 10) {
          if (r.speed > 210) {
            obs.shattered = true;
            r.score += 45 + r.combo * 4;
            r.combo++;
            this.audio.playTone(660, 0.15, 'sine');
            this.particles.emit(obs.x, r.laneY, 16, obs.type === 'iceberg' ? '#aed6f1' : '#27ae60');
          } else {
            obs.shattered = true;
            r.speed = 60;
            r.foulTimer = 0.8;
            r.combo = 0;
            r.score = Math.max(0, r.score - 20);
            this.audio.playTone(120, 0.25, 'sawtooth');
          }
        }

        if (obs.x < -60) {
          r.obstacles.splice(i, 1);
        }
      }
    });
  }

  private strokeDrum(r: LongshipRacer): void {
    if (r.drumBeatPhase >= 0.85 || r.drumBeatPhase <= 0.1) {
      r.speed = Math.min(320, r.speed + 75);
      r.score += 20 + r.combo * 2;
      r.combo++;
      r.oarSplashAnim = 1.0;
      this.audio.playTone(520 + r.combo * 25, 0.12, 'triangle');
      this.particles.emit(r.shipX - 20, r.laneY + 12, 10, '#e0f7fa');
    } else {
      r.foulTimer = 0.6;
      r.combo = 0;
      r.speed = Math.max(50, r.speed - 40);
      this.audio.playTone(140, 0.15, 'square');
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const r = this.racers.get(botId);
    if (!r || r.foulTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      const sweetSpot = difficulty === 'bot_hard' ? 0.94 : difficulty === 'bot_normal' ? 0.88 : 0.82;
      if (r.drumBeatPhase >= sweetSpot) {
        this.strokeDrum(r);
        bTimer = 0.5;
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#152536');
    bgGrad.addColorStop(0.5, '#1e3c54');
    bgGrad.addColorStop(1, '#0e1a26');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    this.racers.forEach((r, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#2980b9';

      ctx.fillStyle = '#1a364d';
      ctx.fillRect(0, r.laneY - laneHeight * 0.45, width, laneHeight);

      ctx.strokeStyle = '#0b1622';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, r.laneY - laneHeight * 0.45);
      ctx.lineTo(width, r.laneY - laneHeight * 0.45);
      ctx.stroke();

      r.obstacles.forEach((obs) => {
        if (obs.shattered) return;
        if (obs.type === 'iceberg') {
          ctx.fillStyle = '#aed6f1';
          ctx.beginPath();
          ctx.moveTo(obs.x - 16, r.laneY + 14);
          ctx.lineTo(obs.x, r.laneY - 20);
          ctx.lineTo(obs.x + 16, r.laneY + 14);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#ebf5fb';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.fillStyle = '#27ae60';
          ctx.beginPath();
          ctx.arc(obs.x, r.laneY - 4, 12, Math.PI, 0);
          ctx.fill();
          ctx.fillStyle = '#e74c3c';
          ctx.fillRect(obs.x + 4, r.laneY - 14, 4, 4);
        }
      });

      const sx = r.shipX;
      const sy = r.laneY;

      ctx.save();
      if (r.foulTimer > 0) {
        ctx.translate(sx, sy);
        ctx.rotate(-0.1);
        ctx.translate(-sx, -sy);
      }

      ctx.fillStyle = '#6e2c00';
      ctx.beginPath();
      ctx.moveTo(sx - 35, sy - 8);
      ctx.lineTo(sx + 35, sy - 8);
      ctx.lineTo(sx + 25, sy + 10);
      ctx.lineTo(sx - 30, sy + 10);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#d35400';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx + 30, sy - 8);
      ctx.quadraticCurveTo(sx + 42, sy - 24, sx + 40, sy - 30);
      ctx.stroke();

      const oarAngle = Math.sin(Date.now() * 0.01 * (r.speed / 70)) * 0.4;
      ctx.strokeStyle = '#d4ac0d';
      ctx.lineWidth = 2;
      for (let ox = -20; ox <= 15; ox += 10) {
        ctx.beginPath();
        ctx.moveTo(sx + ox, sy + 4);
        ctx.lineTo(sx + ox - 8 + Math.cos(oarAngle) * 12, sy + 16 + Math.sin(oarAngle) * 8);
        ctx.stroke();
      }

      ctx.fillStyle = color;
      ctx.fillRect(sx - 8, sy - 32, 16, 22);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 8, sy - 32, 16, 22);

      ctx.restore();

      const drumX = sx + 75;
      const drumY = sy - 12;
      ctx.fillStyle = '#795548';
      ctx.beginPath();
      ctx.arc(drumX, drumY, 14, 0, Math.PI * 2);
      ctx.fill();
      const ringRadius = 14 + (1 - r.drumBeatPhase) * 18;
      ctx.strokeStyle = r.drumBeatPhase > 0.85 ? '#f1c40f' : '#3498db';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(drumX, drumY, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${cfg?.name ?? pId}: ${r.score} pts`, 16, r.laneY - laneHeight * 0.2);
      if (r.combo > 1) {
        ctx.fillStyle = '#f1c40f';
        ctx.fillText(`${r.combo}x VALHALLA SURGE!`, 130, r.laneY - laneHeight * 0.2);
      }
    });

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🥁 TAP ON DRUM BEAT • VALHALLA SURGE TO RAM ICE!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.racers.forEach((r, pId) => scores.set(pId, r.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.racers.entries())
      .map(([playerId, r]) => ({ playerId, score: r.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} led the longship to Valhalla!` : 'Lost in the icy fjord!',
    };
  }
}
