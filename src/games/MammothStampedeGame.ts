import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CanyonHazard {
  id: number;
  x: number;
  type: 'stalactite' | 'ancient_bone';
  cleared: boolean;
}

interface MammothEscapee {
  id: PlayerId;
  laneY: number;
  playerX: number;
  mammothX: number; // chases from left
  yOffset: number;
  vy: number;
  isJumping: boolean;
  score: number;
  combo: number;
  stumbleTimer: number;
  tuskTossTimer: number;
  hazards: CanyonHazard[];
  nextHazardDist: number;
  runAnim: number;
}

export class MammothStampedeGame extends BaseGame {
  public runners: Map<PlayerId, MammothEscapee> = new Map();
  public currentMapName: string = 'Pleistocene Glacier Gorge';
  private hazIdCounter: number = 0;
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
    this.runners.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    active.forEach((p, idx) => {
      const laneY = 70 + idx * laneHeight + laneHeight * 0.55;
      this.runners.set(p.id, {
        id: p.id,
        laneY,
        playerX: width * 0.44,
        mammothX: width * 0.1,
        yOffset: 0,
        vy: 0,
        isJumping: false,
        score: 0,
        combo: 0,
        stumbleTimer: 0,
        tuskTossTimer: 0,
        hazards: [],
        nextHazardDist: 170,
        runAnim: 0,
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

    const scrollSpeed = 210;

    this.runners.forEach((r) => {
      const p = this.getPlayer(r.id);

      if (r.stumbleTimer > 0) r.stumbleTimer -= dt;
      if (r.tuskTossTimer > 0) {
        r.tuskTossTimer -= dt;
        return;
      }

      r.runAnim += dt * 12;

      // Human input
      if (p && !p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(r.id) || this.input.justAction(r.id);
        if (justPressed && !r.isJumping && r.stumbleTimer <= 0) {
          this.executeLeap(r);
        }
      }

      // Jumping physics
      if (r.isJumping) {
        r.yOffset += r.vy * dt;
        r.vy += 850 * dt;
        if (r.yOffset >= 0) {
          r.yOffset = 0;
          r.vy = 0;
          r.isJumping = false;
        }
      }

      // Spawning Hazards
      r.nextHazardDist -= scrollSpeed * dt;
      if (r.nextHazardDist <= 0) {
        r.hazards.push({
          id: ++this.hazIdCounter,
          x: width + 40,
          type: Math.random() < 0.6 ? 'stalactite' : 'ancient_bone',
          cleared: false,
        });
        r.nextHazardDist = 160 + Math.random() * 120;
      }

      // Update Hazards
      for (let i = r.hazards.length - 1; i >= 0; i--) {
        const h = r.hazards[i];
        h.x -= scrollSpeed * dt;

        const dx = Math.abs(h.x - r.playerX);
        if (dx < 26 && !h.cleared) {
          if (h.type === 'stalactite') {
            if (r.yOffset > -20) {
              // Hit fallen stalactite!
              h.cleared = true;
              r.stumbleTimer = 0.8;
              r.combo = 0;
              r.mammothX += 35; // mammoth catches up
              this.audio.playTone(130, 0.25, 'sawtooth');
              this.particles.emit(r.playerX, r.laneY, 14, '#e74c3c');
            } else {
              // Vaulted stalactite
              h.cleared = true;
              r.score += 20 + r.combo * 2;
              r.combo++;
              this.audio.playTone(520, 0.1, 'sine');
            }
          } else {
            // Snagged ancient bone
            h.cleared = true;
            r.score += 35 + r.combo * 3;
            r.combo++;
            r.mammothX = Math.max(width * 0.08, r.mammothX - 25);
            this.audio.playTone(720, 0.12, 'triangle');
            this.particles.emit(h.x, r.laneY - 14, 10, '#f1c40f');
          }
        }

        if (h.x < -60) {
          r.hazards.splice(i, 1);
        }
      }

      // Mammoth chase mechanics
      const recovery = 16 * dt;
      r.mammothX = Math.max(width * 0.08, r.mammothX - recovery);

      if (r.mammothX >= r.playerX - 25 && r.tuskTossTimer <= 0) {
        // MAMMOTH TUSK TOSS!
        r.tuskTossTimer = 1.0;
        r.score = Math.max(0, r.score - 30);
        r.combo = 0;
        r.mammothX = width * 0.1;
        this.audio.playTone(100, 0.35, 'square');
        this.particles.emit(r.playerX, r.laneY, 20, '#d35400');
      }
    });
  }

  private executeLeap(r: MammothEscapee): void {
    r.isJumping = true;
    r.vy = -370;
    this.audio.playTone(340, 0.08, 'sine');
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const r = this.runners.get(botId);
    if (!r || r.isJumping || r.stumbleTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      const lookahead = difficulty === 'bot_hard' ? 90 : difficulty === 'bot_normal' ? 70 : 50;
      const upcoming = r.hazards.find((h) => !h.cleared && h.type === 'stalactite' && h.x > r.playerX && h.x < r.playerX + lookahead);
      if (upcoming) {
        this.executeLeap(r);
        bTimer = difficulty === 'bot_hard' ? 0.35 : 0.55;
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Pleistocene icy canyon background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1c1b29');
    bgGrad.addColorStop(0.5, '#2c3345');
    bgGrad.addColorStop(1, '#151922');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    this.runners.forEach((r, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#e67e22';

      // Frozen canyon path
      ctx.fillStyle = '#90a4ae';
      ctx.fillRect(0, r.laneY + 12, width, 6);
      ctx.fillStyle = '#37474f';
      ctx.fillRect(0, r.laneY + 18, width, laneHeight - 20);

      // Lane separator
      ctx.strokeStyle = '#263238';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, r.laneY - laneHeight * 0.45);
      ctx.lineTo(width, r.laneY - laneHeight * 0.45);
      ctx.stroke();

      // Hazards
      r.hazards.forEach((h) => {
        if (h.cleared && h.type !== 'stalactite') return;
        if (h.type === 'stalactite') {
          // Sharp blue stalactite
          ctx.fillStyle = '#81d4fa';
          ctx.beginPath();
          ctx.moveTo(h.x - 12, r.laneY + 12);
          ctx.lineTo(h.x, r.laneY - 18);
          ctx.lineTo(h.x + 12, r.laneY + 12);
          ctx.closePath();
          ctx.fill();
        } else {
          // Ancient Mammoth Ivory Bone
          ctx.fillStyle = '#fff9c4';
          ctx.beginPath();
          ctx.roundRect(h.x - 10, r.laneY - 14, 20, 8, 3);
          ctx.fill();
        }
      });

      // Raging Woolly Mammoth (chasing from left)
      const mx = r.mammothX;
      const my = r.laneY - 6;

      ctx.save();
      ctx.translate(mx, my);

      // Shaggy Brown Woolly Body
      ctx.fillStyle = '#4e342e';
      ctx.beginPath();
      ctx.ellipse(0, -6, 26, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      // Massive Curved Ivory Tusks
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(18, -4);
      ctx.quadraticCurveTo(34, -20, 36, -30);
      ctx.stroke();

      // Mammoth Trunk
      ctx.strokeStyle = '#3e2723';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.quadraticCurveTo(24, 14, 20, 20);
      ctx.stroke();

      ctx.restore();

      // Runner Explorer
      const px = r.playerX;
      const py = r.laneY + r.yOffset;
      const legOffset = Math.sin(r.runAnim) * 7;

      ctx.save();
      ctx.translate(px, py);

      if (r.stumbleTimer > 0) {
        ctx.rotate(0.3);
      }

      // Explorer body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-8, -24, 16, 22, 3);
      ctx.fill();

      // Fur cap
      ctx.fillStyle = '#d7ccc8';
      ctx.beginPath();
      ctx.arc(0, -28, 8, 0, Math.PI * 2);
      ctx.fill();

      // Legs
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-4, -2);
      ctx.lineTo(-4 - legOffset, 12);
      ctx.moveTo(4, -2);
      ctx.lineTo(4 + legOffset, 12);
      ctx.stroke();

      ctx.restore();

      // HUD
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${cfg?.name ?? pId}: ${r.score} pts`, 16, r.laneY - laneHeight * 0.2);
      if (r.combo > 1) {
        ctx.fillStyle = '#f1c40f';
        ctx.fillText(`${r.combo}x CANYON RUNNER!`, 130, r.laneY - laneHeight * 0.2);
      }
    });

    // Top instruction pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 160, 56, 320, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#f39c12';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🦣 TAP TO LEAP OVER ICICLES & OUTRUN MAMMOTH HERD!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.runners.forEach((r, pId) => scores.set(pId, r.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.runners.entries())
      .map(([playerId, r]) => ({ playerId, score: r.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} outran the raging woolly mammoth herd!` : 'Trampled by the mammoth stampede!',
    };
  }
}
