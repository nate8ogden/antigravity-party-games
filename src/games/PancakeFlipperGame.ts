import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface PancakeGriddle {
  id: PlayerId;
  x: number;
  y: number;
  pancakeState: 'empty' | 'raw' | 'golden' | 'burnt';
  cookTimer: number;
  stackHeight: number;
  score: number;
  combo: number;
  flipAnim: number;
}

export class PancakeFlipperGame extends BaseGame {
  public playersState: Map<PlayerId, PancakeGriddle> = new Map();
  public currentMapName: string = 'Morning Diner Griddle Station';

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

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.playersState.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height * 0.58,
        pancakeState: 'raw',
        cookTimer: 0.6 + Math.random() * 0.4,
        stackHeight: 0,
        score: 0,
        combo: 0,
        flipAnim: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const g = this.playersState.get(p.id);
      if (!g) continue;

      if (g.flipAnim > 0) g.flipAnim -= dt * 4;

      // Cooking lifecycle
      if (g.pancakeState === 'raw') {
        g.cookTimer -= dt;
        if (g.cookTimer <= 0) {
          g.pancakeState = 'golden'; // sweet spot!
          g.cookTimer = 1.0; // 1 second window to flip
        }
      } else if (g.pancakeState === 'golden') {
        g.cookTimer -= dt;
        if (g.cookTimer <= 0) {
          g.pancakeState = 'burnt';
          g.cookTimer = 1.2;
        }
      } else if (g.pancakeState === 'burnt') {
        g.cookTimer -= dt;
        if (g.cookTimer <= 0) {
          // Reset to raw batter
          g.pancakeState = 'raw';
          g.cookTimer = 1.2 + Math.random() * 0.6;
        }
      }

      // Check input
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      if (justAction) {
        this.handleFlip(g);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private handleFlip(g: PancakeGriddle): void {
    g.flipAnim = 1.0;

    if (g.pancakeState === 'golden') {
      // Perfect flip!
      g.combo++;
      g.stackHeight++;
      const pts = 15 + g.combo * 3;
      g.score += pts;
      this.audio.playScore();
      this.particles.spawnSparks(g.x, g.y - 30, '#FFD54F', 10);

      // Sizzle new batter
      g.pancakeState = 'raw';
      g.cookTimer = 1.0 + Math.random() * 0.5;
    } else if (g.pancakeState === 'raw') {
      // Too early! Soggy batter splat
      g.combo = 0;
      g.score = Math.max(0, g.score - 5);
      this.audio.playBounce();
      this.particles.emit(g.x, g.y, 6, '#FFF9C4');

      g.pancakeState = 'raw';
      g.cookTimer = 1.2;
    } else if (g.pancakeState === 'burnt') {
      // Burnt pancake tossed in trash!
      g.combo = 0;
      g.score = Math.max(0, g.score - 10);
      this.audio.playExplosion();
      this.particles.emit(g.x, g.y, 8, '#3E2723');

      g.pancakeState = 'raw';
      g.cookTimer = 1.2;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const g = this.playersState.get(botId);
    if (!g) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    let shouldFlip = false;
    let delay = 0.25;

    if (difficulty === 'bot_easy') {
      delay = 0.45;
      if (g.pancakeState === 'golden' && g.cookTimer < 0.6) {
        shouldFlip = true;
      } else if (Math.random() < 0.15) {
        shouldFlip = true; // accidental premature flip
      }
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
      if (g.pancakeState === 'golden' && g.cookTimer < 0.85) {
        shouldFlip = true;
      }
    } else {
      delay = 0.25;
      if (g.pancakeState === 'golden' && g.cookTimer < 0.7) {
        shouldFlip = true;
      }
    }

    if (shouldFlip) {
      this.input.setBotInput(botId, true, 0, 0, true);
    }

    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const g = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: g?.score || 0,
        stack: g?.stackHeight || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topStack = scores[0]?.stack || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} served a towering stack of ${topStack} golden pancakes!`
      : 'The breakfast griddle was abandoned with burnt batter!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Warm Diner Kitchen Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#2D1B14');
    bgGrad.addColorStop(1, '#4E342E');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Diner Kitchen Stainless Counter
    ctx.fillStyle = '#37474F';
    ctx.fillRect(0, height * 0.72, width, height * 0.28);
    ctx.fillStyle = '#455A64';
    ctx.fillRect(0, height * 0.72, width, 6);

    // Header
    ctx.save();
    ctx.fillStyle = '#FFD54F';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PANCAKE FLIPPER', width / 2, 38);

    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#FFE082';
    ctx.fillText('TIME FLIP AT GOLDEN SIZZLE • STACK TALL TOWERS & AVOID BURNING', width / 2, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px monospace';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);
    ctx.restore();

    // Render Griddle Stations
    for (const p of this.getActivePlayers()) {
      const g = this.playersState.get(p.id);
      if (!g) continue;

      ctx.save();
      ctx.translate(g.x, g.y);

      // Cast iron skillet
      ctx.fillStyle = '#212121';
      ctx.beginPath();
      ctx.ellipse(0, 20, 48, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#424242';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Skillet handle
      ctx.fillStyle = '#424242';
      ctx.fillRect(-6, 38, 12, 28);

      // Cooking pancake
      let pancakeColor = '#FFF9C4'; // raw
      if (g.pancakeState === 'golden') pancakeColor = '#FFB300';
      else if (g.pancakeState === 'burnt') pancakeColor = '#3E2723';

      const pancakeLift = g.flipAnim * 40;
      ctx.fillStyle = pancakeColor;
      ctx.beginPath();
      ctx.ellipse(0, 18 - pancakeLift, 34, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      // Sizzle steam particles if golden
      if (g.pancakeState === 'golden') {
        ctx.fillStyle = '#FFD54F';
        ctx.font = '900 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('FLIP NOW!', 0, -8);
      }

      // Stacked pancakes on side plate
      const plateX = 55;
      ctx.fillStyle = '#ECEFF1';
      ctx.beginPath();
      ctx.ellipse(plateX, 22, 30, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      for (let s = 0; s < Math.min(8, g.stackHeight); s++) {
        ctx.fillStyle = '#FFB300';
        ctx.beginPath();
        ctx.ellipse(plateX, 20 - s * 5, 24, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Butter pat on top of stack
      if (g.stackHeight > 0) {
        ctx.fillStyle = '#FFEE58';
        ctx.fillRect(plateX - 5, 14 - Math.min(8, g.stackHeight) * 5, 10, 6);
      }

      ctx.restore();

      // Player Score Badge
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(g.x - 48, g.y + 75, 96, 30, 6);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${g.score}`, g.x, g.y + 88);
      ctx.font = '700 9px monospace';
      ctx.fillText(`Stack: ${g.stackHeight}`, g.x, g.y + 99);
    }
  }
}
