import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Tentacle {
  id: number;
  angle: number;
  dist: number;
  warningTimer: number;
  slamTimer: number;
  active: boolean;
}

interface Treasure {
  id: number;
  angle: number;
  dist: number;
  type: 'chest' | 'barrel';
  collected: boolean;
}

interface SailorShip {
  id: PlayerId;
  angle: number;
  dist: number;
  direction: 1 | -1;
  speed: number;
  score: number;
  damage: number;
  combo: number;
  shipHullAnim: number;
}

export class KrakenWhirlpoolGame extends BaseGame {
  public ships: Map<PlayerId, SailorShip> = new Map();
  public tentacles: Tentacle[] = [];
  public treasures: Treasure[] = [];
  public currentMapName: string = 'The Maelstrom of Kraken';

  private tentacleIdCounter: number = 0;
  private treasureIdCounter: number = 0;
  private nextTentacleSpawn: number = 2.0;
  private nextTreasureSpawn: number = 1.5;
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
    this.ships.clear();
    this.tentacles = [];
    this.treasures = [];
    this.botReactionTimers.clear();
    this.nextTentacleSpawn = 1.8;
    this.nextTreasureSpawn = 1.2;

    const active = this.getActivePlayers();
    const count = active.length;
    active.forEach((p, idx) => {
      const startAngle = (idx / count) * Math.PI * 2;
      this.ships.set(p.id, {
        id: p.id,
        angle: startAngle,
        dist: 160 + (idx % 2) * 40,
        direction: 1,
        speed: 1.8,
        score: 0,
        damage: 0,
        combo: 0,
        shipHullAnim: 0,
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

    const cx = width / 2;
    const cy = height / 2 + 10;
    const maxRadius = Math.min(width, height) * 0.44;

    // Tentacle spawning
    this.nextTentacleSpawn -= dt;
    if (this.nextTentacleSpawn <= 0) {
      this.tentacles.push({
        id: ++this.tentacleIdCounter,
        angle: Math.random() * Math.PI * 2,
        dist: 90 + Math.random() * (maxRadius - 110),
        warningTimer: 0.9,
        slamTimer: 0.4,
        active: true,
      });
      this.nextTentacleSpawn = 1.4 + Math.random() * 1.0;
      this.audio.playTone(180, 0.15, 'sawtooth');
    }

    // Treasure spawning
    this.nextTreasureSpawn -= dt;
    if (this.nextTreasureSpawn <= 0) {
      this.treasures.push({
        id: ++this.treasureIdCounter,
        angle: Math.random() * Math.PI * 2,
        dist: 70 + Math.random() * (maxRadius - 80),
        type: Math.random() > 0.4 ? 'chest' : 'barrel',
        collected: false,
      });
      this.nextTreasureSpawn = 2.0;
    }

    // Update Tentacles
    for (let i = this.tentacles.length - 1; i >= 0; i--) {
      const ten = this.tentacles[i];
      if (ten.warningTimer > 0) {
        ten.warningTimer -= dt;
      } else if (ten.slamTimer > 0) {
        ten.slamTimer -= dt;
        if (ten.slamTimer <= 0) {
          ten.active = false;
          const tx = cx + Math.cos(ten.angle) * ten.dist;
          const ty = cy + Math.sin(ten.angle) * ten.dist;
          this.particles.emit(tx, ty, 20, '#1abc9c');
          this.audio.playTone(120, 0.25, 'square');
        }
      } else {
        this.tentacles.splice(i, 1);
      }
    }

    // Update Ships
    this.ships.forEach((s) => {
      const p = this.getPlayer(s.id);
      if (p && !p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(s.id) || this.input.justAction(s.id);
        if (justPressed) {
          s.direction = (s.direction === 1 ? -1 : 1) as 1 | -1;
          this.audio.playTone(340, 0.08, 'triangle');
        }
      }

      s.angle += s.speed * dt;
      const vortexPull = 22 * dt;
      s.dist += s.direction * 75 * dt - vortexPull;

      if (s.dist < 40) {
        s.dist = 45;
        s.score = Math.max(0, s.score - 10 * dt);
        this.audio.playTone(95, 0.1, 'sawtooth');
      } else if (s.dist > maxRadius) {
        s.dist = maxRadius;
      }

      // Treasure collection
      this.treasures.forEach((tr) => {
        if (tr.collected) return;
        const dAngle = Math.abs(tr.angle - s.angle);
        const dDist = Math.abs(tr.dist - s.dist);
        if ((dAngle < 0.2 || dAngle > Math.PI * 2 - 0.2) && dDist < 30) {
          tr.collected = true;
          const pts = tr.type === 'chest' ? 35 : 15;
          s.score += pts + s.combo * 2;
          s.combo++;
          this.audio.playTone(tr.type === 'chest' ? 780 : 540, 0.12, 'sine');
          const px = cx + Math.cos(s.angle) * s.dist;
          const py = cy + Math.sin(s.angle) * s.dist;
          this.particles.emit(px, py, 12, '#f1c40f');
        }
      });

      // Tentacle slam collision
      this.tentacles.forEach((ten) => {
        if (ten.warningTimer <= 0 && ten.slamTimer > 0) {
          const dAngle = Math.abs(ten.angle - s.angle);
          const dDist = Math.abs(ten.dist - s.dist);
          if ((dAngle < 0.25 || dAngle > Math.PI * 2 - 0.25) && dDist < 35) {
            s.score = Math.max(0, s.score - 25);
            s.combo = 0;
            s.dist = Math.max(45, s.dist - 30);
            this.audio.playTone(110, 0.2, 'square');
          }
        }
      });
    });

    this.treasures = this.treasures.filter((t) => !t.collected);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const s = this.ships.get(botId);
    if (!s) return;

    const maxRadius = Math.min(width, height) * 0.44;
    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      const dangerTentacle = this.tentacles.find(
        (t) =>
          Math.abs(t.angle - s.angle) < 0.35 &&
          Math.abs(t.dist - s.dist) < 45 &&
          t.warningTimer > 0
      );
      if (dangerTentacle || s.dist < 60) {
        s.direction = 1;
        bTimer = difficulty === 'bot_hard' ? 0.3 : 0.5;
      } else if (s.dist > maxRadius - 20) {
        s.direction = -1;
        bTimer = 0.3;
      } else {
        const nearbyTreasure = this.treasures.find(
          (tr) => !tr.collected && Math.abs(tr.angle - s.angle) < 0.4
        );
        if (nearbyTreasure) {
          s.direction = nearbyTreasure.dist > s.dist ? 1 : -1;
        }
        bTimer = 0.4;
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2 + 10;
    const maxRadius = Math.min(width, height) * 0.44;

    const bgGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, maxRadius * 1.5);
    bgGrad.addColorStop(0, '#0a192f');
    bgGrad.addColorStop(0.6, '#0f2b48');
    bgGrad.addColorStop(1, '#050e1a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Date.now() * 0.001);
    ctx.strokeStyle = 'rgba(74, 144, 226, 0.25)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 50 + i * 45, 0, Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.fillStyle = '#02060c';
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    this.treasures.forEach((tr) => {
      const tx = cx + Math.cos(tr.angle) * tr.dist;
      const ty = cy + Math.sin(tr.angle) * tr.dist;
      if (tr.type === 'chest') {
        ctx.fillStyle = '#d35400';
        ctx.fillRect(tx - 9, ty - 7, 18, 14);
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(tx - 3, ty - 3, 6, 6);
      } else {
        ctx.fillStyle = '#8b5a2b';
        ctx.beginPath();
        ctx.ellipse(tx, ty, 8, 11, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    this.tentacles.forEach((ten) => {
      const tx = cx + Math.cos(ten.angle) * ten.dist;
      const ty = cy + Math.sin(ten.angle) * ten.dist;

      if (ten.warningTimer > 0) {
        const pulse = 1 - ten.warningTimer / 0.9;
        ctx.fillStyle = `rgba(231, 76, 60, ${0.3 + pulse * 0.4})`;
        ctx.beginPath();
        ctx.ellipse(tx, ty, 28, 14, ten.angle, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#16a085';
        ctx.beginPath();
        ctx.ellipse(tx, ty, 14, 32, ten.angle + Math.PI / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0e6655';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#9b59b6';
        ctx.beginPath();
        ctx.arc(tx - 5, ty, 4, 0, Math.PI * 2);
        ctx.arc(tx + 5, ty, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    this.ships.forEach((s, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#e74c3c';
      const sx = cx + Math.cos(s.angle) * s.dist;
      const sy = cy + Math.sin(s.angle) * s.dist;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(s.angle + Math.PI / 2 + (s.direction === 1 ? 0.3 : -0.3));

      ctx.fillStyle = '#6e2c00';
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(8, 14);
      ctx.lineTo(-8, 14);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(12, 4);
      ctx.lineTo(-12, 4);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#f39c12';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(0, 10);
      ctx.stroke();

      ctx.restore();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${Math.floor(s.score)}`, sx, sy - 24);
    });

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 150, 56, 300, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#1abc9c';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐙 TAP TO STEER IN/OUT • DODGE TENTACLES!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.ships.forEach((s, pId) => scores.set(pId, Math.floor(s.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.ships.entries())
      .map(([playerId, s]) => ({ playerId, score: Math.floor(s.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} conquered the Kraken Maelstrom!` : 'All ships pulled to Davy Jones!',
    };
  }
}
