import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CavernCrystal {
  id: number;
  x: number;
  type: 'stalagmite' | 'frost_gem';
  shattered: boolean;
}

interface CavernSledder {
  id: PlayerId;
  laneY: number;
  sledX: number;
  hammerAnim: number; // 0 to 1
  speed: number;
  score: number;
  combo: number;
  stumbleTimer: number;
  crystals: CavernCrystal[];
  nextCrystalDist: number;
}

export class FrostbiteCavernGame extends BaseGame {
  public sledders: Map<PlayerId, CavernSledder> = new Map();
  public currentMapName: string = 'Crystal Ice Grotto';
  private crystalIdCounter: number = 0;
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
    this.sledders.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    active.forEach((p, idx) => {
      const laneY = 70 + idx * laneHeight + laneHeight * 0.55;
      this.sledders.set(p.id, {
        id: p.id,
        laneY,
        sledX: 110,
        hammerAnim: 0,
        speed: 160,
        score: 0,
        combo: 0,
        stumbleTimer: 0,
        crystals: [],
        nextCrystalDist: 170,
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

    const baseScroll = 180;

    this.sledders.forEach((s) => {
      const p = this.getPlayer(s.id);

      if (s.stumbleTimer > 0) s.stumbleTimer -= dt;
      if (s.hammerAnim > 0) s.hammerAnim = Math.max(0, s.hammerAnim - dt * 4.5);

      // Human input: strike hammer
      if (p && !p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(s.id) || this.input.justAction(s.id);
        if (justPressed && s.stumbleTimer <= 0) {
          this.swingHammer(s);
        }
      }

      // Spawning crystals
      s.nextCrystalDist -= (baseScroll + s.speed * 0.4) * dt;
      if (s.nextCrystalDist <= 0) {
        s.crystals.push({
          id: ++this.crystalIdCounter,
          x: width + 40,
          type: Math.random() < 0.35 ? 'frost_gem' : 'stalagmite',
          shattered: false,
        });
        s.nextCrystalDist = 160 + Math.random() * 120;
      }

      // Update crystals
      for (let i = s.crystals.length - 1; i >= 0; i--) {
        const c = s.crystals[i];
        c.x -= (baseScroll + s.speed * 0.4) * dt;

        // Collision with sled front
        if (!c.shattered && c.x <= s.sledX + 35 && c.x >= s.sledX - 10) {
          if (s.hammerAnim > 0.35) {
            // SHATTERED CRYSTAL WITH HAMMER!
            c.shattered = true;
            const pts = c.type === 'frost_gem' ? 50 : 30;
            s.score += pts + s.combo * 3;
            s.combo++;
            this.audio.playTone(c.type === 'frost_gem' ? 840 : 640, 0.12, 'sine');
            this.particles.emit(c.x, s.laneY, 18, c.type === 'frost_gem' ? '#00e5ff' : '#ebf5fb');
          } else {
            // Collided into stalagmite!
            c.shattered = true;
            s.stumbleTimer = 0.8;
            s.combo = 0;
            s.score = Math.max(0, s.score - 20);
            this.audio.playTone(130, 0.25, 'sawtooth');
            this.particles.emit(s.sledX + 20, s.laneY, 14, '#c0392b');
          }
        }

        if (c.x < -60) {
          s.crystals.splice(i, 1);
        }
      }
    });
  }

  private swingHammer(s: CavernSledder): void {
    if (s.hammerAnim <= 0.05) {
      s.hammerAnim = 1.0;
      this.audio.playTone(420, 0.08, 'triangle');
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const s = this.sledders.get(botId);
    if (!s || s.stumbleTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      const upcoming = s.crystals.find((c) => !c.shattered && c.x > s.sledX && c.x < s.sledX + 65);
      if (upcoming) {
        const delay = difficulty === 'bot_hard' ? 0.85 : difficulty === 'bot_normal' ? 0.70 : 0.50;
        if (Math.random() < delay) {
          this.swingHammer(s);
          bTimer = 0.5;
        }
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Crystal grotto ice cavern background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#09131d');
    bgGrad.addColorStop(0.5, '#142738');
    bgGrad.addColorStop(1, '#091520');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Glowing crystalline wall facets
    ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';
    for (let x = 40; x < width; x += 110) {
      ctx.beginPath();
      ctx.moveTo(x, 60);
      ctx.lineTo(x + 25, 95);
      ctx.lineTo(x - 20, 130);
      ctx.closePath();
      ctx.fill();
    }

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    this.sledders.forEach((s, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#00e5ff';

      // Crystal track
      ctx.fillStyle = '#81d4fa';
      ctx.fillRect(0, s.laneY + 12, width, 6);
      ctx.fillStyle = '#1c3b57';
      ctx.fillRect(0, s.laneY + 18, width, laneHeight - 20);

      // Track divider
      ctx.strokeStyle = '#0d2235';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, s.laneY - laneHeight * 0.45);
      ctx.lineTo(width, s.laneY - laneHeight * 0.45);
      ctx.stroke();

      // Crystals
      s.crystals.forEach((c) => {
        if (c.shattered) return;
        if (c.type === 'stalagmite') {
          // Sharp ice stalagmite
          ctx.fillStyle = '#b3e5fc';
          ctx.beginPath();
          ctx.moveTo(c.x - 12, s.laneY + 12);
          ctx.lineTo(c.x, s.laneY - 20);
          ctx.lineTo(c.x + 12, s.laneY + 12);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          // Radiant blue frost gem
          ctx.fillStyle = '#00e5ff';
          ctx.beginPath();
          ctx.moveTo(c.x, s.laneY - 24);
          ctx.lineTo(c.x + 10, s.laneY - 14);
          ctx.lineTo(c.x, s.laneY - 4);
          ctx.lineTo(c.x - 10, s.laneY - 14);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });

      // Sled & Hammer
      ctx.save();
      ctx.translate(s.sledX, s.laneY);

      if (s.stumbleTimer > 0) {
        ctx.rotate(0.25);
      }

      // Sled
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-18, -10, 28, 14, 3);
      ctx.fill();

      // Steel runner
      ctx.strokeStyle = '#bdc3c7';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-22, 6);
      ctx.lineTo(14, 6);
      ctx.stroke();

      // Thermal Pickaxe Hammer
      const hammerAngle = -0.3 + s.hammerAnim * 1.4;
      ctx.save();
      ctx.translate(6, -8);
      ctx.rotate(hammerAngle);

      ctx.strokeStyle = '#795548';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(24, 0);
      ctx.stroke();

      // Hammerhead
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(20, -7, 8, 14);
      ctx.restore();

      ctx.restore();

      // HUD
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${cfg?.name ?? pId}: ${s.score} pts`, 16, s.laneY - laneHeight * 0.2);
      if (s.combo > 1) {
        ctx.fillStyle = '#00e5ff';
        ctx.fillText(`${s.combo}x SHATTER!`, 130, s.laneY - laneHeight * 0.2);
      }
    });

    // Top instruction pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⛏️ TAP TO SWING THERMAL PICKAXE • SHATTER CRYSTALS!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.sledders.forEach((s, pId) => scores.set(pId, s.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.sledders.entries())
      .map(([playerId, s]) => ({ playerId, score: s.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} shattered the Frostbite crystal cavern!` : 'Sleds shattered on stalagmites!',
    };
  }
}
