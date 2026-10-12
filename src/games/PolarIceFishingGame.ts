import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface FishBite {
  type: 'arctic_char' | 'king_crab' | 'old_boot';
  biteTimer: number; // reaction window
  state: 'waiting' | 'biting' | 'caught' | 'escaped';
  animTimer: number;
}

interface FisherStation {
  id: PlayerId;
  x: number;
  y: number;
  bobberY: number;
  score: number;
  combo: number;
  staggerTimer: number;
  currentBite: FishBite;
  rodTensionAnim: number;
}

export class PolarIceFishingGame extends BaseGame {
  public fishers: Map<PlayerId, FisherStation> = new Map();
  public currentMapName: string = 'Inuit Frozen Bay';
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
    this.fishers.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    active.forEach((p, idx) => {
      const cx = idx * colWidth + colWidth * 0.5;
      this.fishers.set(p.id, {
        id: p.id,
        x: cx,
        y: height * 0.55,
        bobberY: 0,
        score: 0,
        combo: 0,
        staggerTimer: 0,
        currentBite: {
          type: 'arctic_char',
          biteTimer: 1.2 + Math.random() * 1.5,
          state: 'waiting',
          animTimer: 0,
        },
        rodTensionAnim: 0,
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

    this.fishers.forEach((f) => {
      const p = this.getPlayer(f.id);

      if (f.staggerTimer > 0) f.staggerTimer -= dt;
      if (f.rodTensionAnim > 0) f.rodTensionAnim = Math.max(0, f.rodTensionAnim - dt * 4);

      const b = f.currentBite;
      if (b.state === 'waiting') {
        b.biteTimer -= dt;
        f.bobberY = Math.sin(Date.now() * 0.005) * 2;

        if (b.biteTimer <= 0) {
          // FISH BITES!
          b.state = 'biting';
          b.biteTimer = 0.65; // 0.65s reaction window
          const rand = Math.random();
          b.type = rand < 0.6 ? 'arctic_char' : rand < 0.85 ? 'king_crab' : 'old_boot';
          this.audio.playTone(520, 0.1, 'triangle');
          this.particles.emit(f.x + 22, f.y + 35, 8, '#00e5ff');
        }
      } else if (b.state === 'biting') {
        b.biteTimer -= dt;
        f.bobberY = 16; // submerged bobber

        if (b.biteTimer <= 0) {
          // Fish escaped!
          b.state = 'escaped';
          b.animTimer = 0.5;
          f.combo = 0;
          this.audio.playTone(140, 0.15, 'square');
        }
      } else {
        // Result animation
        b.animTimer -= dt;
        if (b.animTimer <= 0) {
          // Reset to next wait
          b.state = 'waiting';
          b.biteTimer = 1.0 + Math.random() * 2.0;
        }
      }

      // Human input: hook & reel
      if (p && !p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(f.id) || this.input.justAction(f.id);
        if (justPressed && f.staggerTimer <= 0) {
          this.strikeHook(f);
        }
      }
    });
  }

  private strikeHook(f: FisherStation): void {
    f.rodTensionAnim = 1.0;
    const b = f.currentBite;

    if (b.state === 'biting') {
      // CAUGHT FISH!
      b.state = 'caught';
      b.animTimer = 0.5;

      if (b.type === 'old_boot') {
        f.score += 5;
        this.audio.playTone(220, 0.1, 'square');
      } else {
        const pts = b.type === 'king_crab' ? 50 : 30;
        f.score += pts + f.combo * 4;
        f.combo++;
        this.audio.playTone(780 + f.combo * 35, 0.15, 'sine');
        this.particles.emit(f.x + 22, f.y + 20, 16, b.type === 'king_crab' ? '#e74c3c' : '#00e676');
      }
    } else if (b.state === 'waiting') {
      // Premature strike / pulled line too early
      f.staggerTimer = 0.5;
      f.combo = 0;
      f.score = Math.max(0, f.score - 10);
      this.audio.playTone(160, 0.12, 'sawtooth');
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const f = this.fishers.get(botId);
    if (!f || f.staggerTimer > 0) return;

    let bTimer = this.botReactionTimers.get(botId) || 0;
    bTimer -= dt;
    if (bTimer <= 0) {
      if (f.currentBite.state === 'biting') {
        const delay = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.22 : 0.38;
        if (0.65 - f.currentBite.biteTimer >= delay) {
          this.strikeHook(f);
          bTimer = 0.8;
        }
      }
    }
    this.botReactionTimers.set(botId, bTimer);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Arctic frozen lake atmosphere
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#102a43');
    bgGrad.addColorStop(0.5, '#243b53');
    bgGrad.addColorStop(1, '#0e1c28');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    const colWidth = width / Math.max(count, 1);

    this.fishers.forEach((f, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#e74c3c';

      // Thick translucent ice sheet surface
      ctx.fillStyle = '#d9e2ec';
      ctx.fillRect(f.x - colWidth * 0.5 + 4, f.y + 24, colWidth - 8, height - f.y - 24);

      // Augered Circular Ice Hole
      const holeX = f.x + 22;
      const holeY = f.y + 36;
      ctx.fillStyle = '#0f2334';
      ctx.beginPath();
      ctx.ellipse(holeX, holeY, 20, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#627d98';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Fishing Bobber in Hole
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(holeX, holeY + f.bobberY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(holeX, holeY + f.bobberY + 2, 3, 0, Math.PI);
      ctx.fill();

      // Biting splash exclamation
      if (f.currentBite.state === 'biting') {
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('❗ BITE!', holeX, holeY - 14);
      }

      // Fisherman Character sitting on stool
      ctx.save();
      ctx.translate(f.x - 14, f.y);

      // Parka Coat
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-10, -18, 20, 26, 4);
      ctx.fill();

      // Fur Hood
      ctx.fillStyle = '#f5cba7';
      ctx.beginPath();
      ctx.arc(0, -24, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Fishing Rod
      const rodAngle = f.rodTensionAnim > 0 ? -0.4 : -0.15;
      ctx.strokeStyle = '#795548';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(6, -8);
      ctx.lineTo(6 + Math.cos(rodAngle) * 36, -8 + Math.sin(rodAngle) * 36);
      ctx.stroke();

      // Line from rod tip to bobber
      const rodTipX = 6 + Math.cos(rodAngle) * 36;
      const rodTipY = -8 + Math.sin(rodAngle) * 36;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rodTipX, rodTipY);
      ctx.lineTo(holeX - (f.x - 14), holeY - f.y + f.bobberY);
      ctx.stroke();

      ctx.restore();

      // Score HUD
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${f.score}`, f.x, height * 0.9);
      if (f.combo > 1) {
        ctx.fillStyle = '#00e5ff';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${f.combo}x PRIZE CATCH`, f.x, height * 0.94);
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
    ctx.fillText('🎣 TAP AS SOON AS BOBBER BITES TO REEL IN!', width / 2, 73);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.fishers.forEach((f, pId) => scores.set(pId, f.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.fishers.entries())
      .map(([playerId, f]) => ({ playerId, score: f.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} reeled in the finest polar catch!` : 'Fish stripped all the bait!',
    };
  }
}
