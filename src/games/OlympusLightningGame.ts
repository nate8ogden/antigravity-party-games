import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface LightningBolt {
  id: number;
  playerId: PlayerId;
  chargeProgress: number;
  speed: number;
  state: 'charging' | 'striking' | 'caught' | 'missed';
  resultAnim: number;
}

interface ConduitHero {
  id: PlayerId;
  x: number;
  y: number;
  score: number;
  combo: number;
  rodCharged: boolean;
  shockTimer: number;
  activeBolt: LightningBolt | null;
}

export class OlympusLightningGame extends BaseGame {
  public heroes: Map<PlayerId, ConduitHero> = new Map();
  public currentMapName: string = 'Mount Olympus Summit';
  private boltIdCounter: number = 0;
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
    this.heroes.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    active.forEach((p, idx) => {
      const cx = idx * colWidth + colWidth * 0.5;
      this.heroes.set(p.id, {
        id: p.id,
        x: cx,
        y: height * 0.75,
        score: 0,
        combo: 0,
        rodCharged: false,
        shockTimer: 0,
        activeBolt: null,
      });
      this.botReactionTimers.set(p.id, 0);
      this.spawnBoltForHero(p.id);
    });
  }

  private spawnBoltForHero(playerId: PlayerId): void {
    const hero = this.heroes.get(playerId);
    if (!hero) return;

    hero.activeBolt = {
      id: ++this.boltIdCounter,
      playerId,
      chargeProgress: 0,
      speed: 0.6 + Math.random() * 0.35,
      state: 'charging',
      resultAnim: 0,
    };
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      return;
    }

    this.updateBots(dt, width, height);

    this.heroes.forEach((h) => {
      const p = this.getPlayer(h.id);
      if (h.shockTimer > 0) h.shockTimer -= dt;

      const bolt = h.activeBolt;
      if (!bolt) return;

      if (bolt.state === 'charging') {
        bolt.chargeProgress += bolt.speed * dt;

        if (p && !p.type.startsWith('bot_')) {
          const justPressed = this.input.justPressed(h.id) || this.input.justAction(h.id);
          if (justPressed && h.shockTimer <= 0) {
            this.catchBolt(h);
          }
        }

        if (bolt.chargeProgress >= 1.0) {
          bolt.state = 'missed';
          bolt.resultAnim = 0.5;
          h.shockTimer = 0.8;
          h.combo = 0;
          h.score = Math.max(0, h.score - 15);
          this.audio.playTone(110, 0.25, 'sawtooth');
          this.particles.emit(h.x, h.y, 18, '#e74c3c');
        }
      } else {
        bolt.resultAnim -= dt;
        if (bolt.resultAnim <= 0) {
          this.spawnBoltForHero(h.id);
        }
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const h = this.heroes.get(botId);
    if (!h || h.shockTimer > 0) return;

    const bolt = h.activeBolt;
    if (!bolt || bolt.state !== 'charging') return;

    const sweetSpotMin = difficulty === 'bot_hard' ? 0.92 : difficulty === 'bot_normal' ? 0.88 : 0.82;
    if (bolt.chargeProgress >= sweetSpotMin && bolt.chargeProgress <= 0.98) {
      let bTimer = this.botReactionTimers.get(botId) || 0;
      bTimer -= dt;
      if (bTimer <= 0) {
        this.catchBolt(h);
        this.botReactionTimers.set(botId, 0.4);
      }
    }
  }

  private catchBolt(h: ConduitHero): void {
    const bolt = h.activeBolt;
    if (!bolt || bolt.state !== 'charging') return;

    if (bolt.chargeProgress >= 0.85 && bolt.chargeProgress <= 0.99) {
      bolt.state = 'caught';
      bolt.resultAnim = 0.4;
      const pts = 35 + h.combo * 5;
      h.score += pts;
      h.combo++;
      this.audio.playTone(880 + h.combo * 40, 0.15, 'triangle');
      this.particles.emit(h.x, h.y - 30, 22, '#f1c40f');
    } else {
      bolt.state = 'missed';
      bolt.resultAnim = 0.4;
      h.shockTimer = 0.6;
      h.combo = 0;
      h.score = Math.max(0, h.score - 10);
      this.audio.playTone(150, 0.15, 'square');
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1a1423');
    bgGrad.addColorStop(0.4, '#2d1b4e');
    bgGrad.addColorStop(0.8, '#4a235a');
    bgGrad.addColorStop(1, '#1b1226');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(236, 240, 241, 0.12)';
    for (let x = 40; x < width; x += 110) {
      ctx.fillRect(x, 110, 24, height * 0.6);
      ctx.fillRect(x - 6, 100, 36, 12);
    }

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    this.heroes.forEach((h, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#9b59b6';

      ctx.fillStyle = '#bdc3c7';
      ctx.fillRect(h.x - 30, h.y + 12, 60, 24);
      ctx.fillStyle = '#ecf0f1';
      ctx.fillRect(h.x - 35, h.y + 36, 70, 16);

      ctx.save();
      if (h.shockTimer > 0) {
        ctx.translate(h.x + (Math.random() - 0.5) * 6, h.y);
      } else {
        ctx.translate(h.x, h.y);
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-10, -26, 20, 26, 4);
      ctx.fill();

      ctx.fillStyle = '#f5cba7';
      ctx.beginPath();
      ctx.arc(0, -32, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#27ae60';
      ctx.beginPath();
      ctx.arc(0, -36, 5, 0, Math.PI);
      ctx.fill();

      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(8, -10);
      ctx.lineTo(12, -45);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(6, -45);
      ctx.lineTo(18, -45);
      ctx.moveTo(6, -52);
      ctx.lineTo(6, -45);
      ctx.moveTo(18, -52);
      ctx.lineTo(18, -45);
      ctx.stroke();

      ctx.restore();

      const bolt = h.activeBolt;
      if (bolt) {
        const topY = 90;
        const targetY = h.y - 45;
        const currentBoltY = topY + (targetY - topY) * bolt.chargeProgress;

        if (bolt.state === 'charging') {
          const barW = 40;
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(h.x - barW / 2, h.y - 70, barW, 6);
          ctx.fillStyle = 'rgba(241, 196, 15, 0.4)';
          ctx.fillRect(h.x - barW / 2 + barW * 0.85, h.y - 70, barW * 0.14, 6);
          ctx.fillStyle = '#00e5ff';
          ctx.fillRect(h.x - barW / 2, h.y - 70, barW * bolt.chargeProgress, 6);

          ctx.strokeStyle = '#00e5ff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(h.x, topY);
          let segY = topY;
          while (segY < currentBoltY) {
            const nextY = Math.min(currentBoltY, segY + 25);
            const zag = (Math.random() - 0.5) * 16;
            ctx.lineTo(h.x + zag, nextY);
            segY = nextY;
          }
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(h.x, currentBoltY, 7, 0, Math.PI * 2);
          ctx.fill();
        } else if (bolt.state === 'caught') {
          ctx.strokeStyle = '#f1c40f';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(h.x, topY);
          ctx.lineTo(h.x, targetY);
          ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 4;
          ctx.stroke();
        }
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${h.score}`, h.x, height * 0.88);
      if (h.combo > 1) {
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`${h.combo}x SURGE!`, h.x, height * 0.92);
      }
    });

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ TAP ON GOLD SWEET-SPOT TO CATCH LIGHTNING!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.heroes.forEach((h, pId) => scores.set(pId, h.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.heroes.entries())
      .map(([playerId, h]) => ({ playerId, score: h.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} wielded the fury of Zeus!` : 'All struck by thunder!',
    };
  }
}
