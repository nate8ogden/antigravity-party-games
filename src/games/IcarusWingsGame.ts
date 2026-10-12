import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface GoldenRing {
  id: number;
  x: number;
  y: number;
  collected: boolean;
}

interface Cloud {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface IcarusFlyer {
  id: PlayerId;
  x: number;
  y: number;
  vy: number;
  waxHeat: number;
  wingMeltedTimer: number;
  score: number;
  combo: number;
  wingAngle: number;
}

export class IcarusWingsGame extends BaseGame {
  public flyers: Map<PlayerId, IcarusFlyer> = new Map();
  public rings: GoldenRing[] = [];
  public clouds: Cloud[] = [];
  public currentMapName: string = 'Flight to Mount Olympus';

  private ringIdCounter: number = 0;
  private nextRingDist: number = 140;
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
    this.flyers.clear();
    this.rings = [];
    this.clouds = [
      { x: width * 0.2, y: height * 0.28, w: 90, h: 36 },
      { x: width * 0.6, y: height * 0.32, w: 120, h: 42 },
      { x: width * 0.9, y: height * 0.25, w: 85, h: 34 },
    ];
    this.botReactionTimers.clear();
    this.nextRingDist = 120;

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const startX = width * 0.15 + idx * 35;
      this.flyers.set(p.id, {
        id: p.id,
        x: startX,
        y: height * 0.55,
        vy: 0,
        waxHeat: 10,
        wingMeltedTimer: 0,
        score: 0,
        combo: 0,
        wingAngle: 0,
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

    const scrollSpeed = 160;
    const sunLine = height * 0.22;
    const seaLine = height * 0.82;

    this.clouds.forEach((c) => {
      c.x -= scrollSpeed * 0.5 * dt;
      if (c.x < -130) c.x = width + 50;
    });

    this.nextRingDist -= scrollSpeed * dt;
    if (this.nextRingDist <= 0) {
      this.rings.push({
        id: ++this.ringIdCounter,
        x: width + 30,
        y: sunLine + 30 + Math.random() * (seaLine - sunLine - 60),
        collected: false,
      });
      this.nextRingDist = 140 + Math.random() * 80;
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].x -= scrollSpeed * dt;
      if (this.rings[i].x < -40) {
        this.rings.splice(i, 1);
      }
    }

    this.flyers.forEach((f) => {
      const p = this.getPlayer(f.id);
      if (f.wingMeltedTimer > 0) {
        f.wingMeltedTimer -= dt;
      }

      let shouldFlap = false;
      if (p && !p.type.startsWith('bot_')) {
        shouldFlap = (this.input.justPressed(f.id) || this.input.justAction(f.id)) && f.wingMeltedTimer <= 0;
      }

      if (shouldFlap) {
        this.executeFlap(f);
      }

      f.y += f.vy * dt;
      f.vy += 450 * dt;
      f.wingAngle += (0 - f.wingAngle) * dt * 5;

      const inCloud = this.clouds.some(
        (c) => f.x >= c.x - 20 && f.x <= c.x + c.w + 20 && Math.abs(f.y - c.y) < 35
      );

      if (f.y < sunLine) {
        f.waxHeat += 45 * dt;
        if (f.waxHeat >= 100 && f.wingMeltedTimer <= 0) {
          f.wingMeltedTimer = 1.4;
          f.waxHeat = 60;
          f.combo = 0;
          f.score = Math.max(0, f.score - 20);
          this.audio.playTone(180, 0.3, 'sawtooth');
          this.particles.emit(f.x, f.y, 16, '#f39c12');
        }
      } else if (inCloud) {
        f.waxHeat = Math.max(0, f.waxHeat - 40 * dt);
      } else {
        f.waxHeat = Math.max(0, f.waxHeat - 15 * dt);
      }

      if (f.y > seaLine) {
        f.y = seaLine;
        f.vy = -120;
        f.score = Math.max(0, f.score - 8 * dt);
        this.audio.playTone(120, 0.1, 'square');
      }

      this.rings.forEach((r) => {
        if (!r.collected && Math.hypot(r.x - f.x, r.y - f.y) < 26) {
          r.collected = true;
          f.score += 25 + f.combo * 3;
          f.combo++;
          this.audio.playTone(660 + f.combo * 40, 0.12, 'triangle');
          this.particles.emit(r.x, r.y, 12, '#f1c40f');
        }
      });
    });
  }

  private executeFlap(f: IcarusFlyer): void {
    f.vy = -260;
    f.waxHeat = Math.min(100, f.waxHeat + 4);
    f.wingAngle = -0.6;
    this.audio.playTone(460, 0.08, 'sine');
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    height: number
  ): void {
    const f = this.flyers.get(botId);
    if (!f || f.wingMeltedTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      const targetRing = this.rings.find((r) => !r.collected && r.x > f.x && r.x < f.x + 180);
      const idealY = targetRing ? targetRing.y : height * 0.52;

      if (f.y > idealY + 15 && f.waxHeat < 75) {
        this.executeFlap(f);
        bTimer = difficulty === 'bot_hard' ? 0.2 : difficulty === 'bot_normal' ? 0.32 : 0.45;
      } else {
        bTimer = 0.15;
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const sunLine = height * 0.22;
    const seaLine = height * 0.82;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#f39c12');
    bgGrad.addColorStop(0.2, '#f7dc6f');
    bgGrad.addColorStop(0.5, '#85c1e9');
    bgGrad.addColorStop(0.82, '#2e86c1');
    bgGrad.addColorStop(1, '#1b4f72');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(width * 0.85, 35, 45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 235, 59, 0.25)';
    ctx.beginPath();
    ctx.arc(width * 0.85, 35, 75, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    this.clouds.forEach((c) => {
      ctx.beginPath();
      ctx.roundRect(c.x, c.y - c.h / 2, c.w, c.h, 18);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(c.x + c.w * 0.35, c.y - c.h * 0.4, 20, 0, Math.PI * 2);
      ctx.arc(c.x + c.w * 0.65, c.y - c.h * 0.3, 16, 0, Math.PI * 2);
      ctx.fill();
    });

    this.rings.forEach((r) => {
      if (r.collected) return;
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(241, 196, 15, 0.3)';
      ctx.fill();
    });

    ctx.fillStyle = '#1b4f72';
    ctx.fillRect(0, seaLine, width, height - seaLine);
    ctx.fillStyle = '#5dade2';
    for (let x = 0; x < width; x += 30) {
      ctx.beginPath();
      ctx.arc(x + 15, seaLine, 12, Math.PI, 0);
      ctx.fill();
    }

    this.flyers.forEach((f, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#e74c3c';

      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.wingAngle);

      const wingColor = f.wingMeltedTimer > 0 ? '#d35400' : '#ecf0f1';
      ctx.fillStyle = wingColor;
      ctx.beginPath();
      ctx.moveTo(-6, -4);
      ctx.lineTo(-24, -18);
      ctx.lineTo(-12, 10);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(6, -4);
      ctx.lineTo(24, -18);
      ctx.lineTo(12, 10);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#d4ac0d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(10, 0);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      const barW = 32;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(f.x - barW / 2, f.y - 28, barW, 5);
      ctx.fillStyle = f.waxHeat > 75 ? '#e74c3c' : '#f1c40f';
      ctx.fillRect(f.x - barW / 2, f.y - 28, (barW * f.waxHeat) / 100, 5);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${f.score}`, f.x, f.y - 34);
    });

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🪶 TAP TO FLAP • AVOID SCORCHING SUN & SEA WAVES!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.flyers.forEach((f, pId) => scores.set(pId, f.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.flyers.entries())
      .map(([playerId, f]) => ({ playerId, score: f.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} soared gracefully across the Aegean!` : 'Wings melted into the sea!',
    };
  }
}
