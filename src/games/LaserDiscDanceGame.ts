import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type DirectionPrompt = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface DancePlayer {
  id: PlayerId;
  score: number;
  combo: number;
  lastAction: string;
  feedbackTimer: number;
  feedbackText: string;
  feedbackColor: string;
}

export class LaserDiscDanceGame extends BaseGame {
  private playersState: Map<PlayerId, DancePlayer> = new Map();
  private discAngle: number = 0;
  private currentPrompt: DirectionPrompt = 'UP';
  private promptTimer: number = 1.6;
  private promptWindow: number = 1.6;
  private directions: DirectionPrompt[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 30;
    this.playersState.clear();
    this.discAngle = 0;
    this.currentPrompt = 'UP';
    this.promptWindow = 1.4;
    this.promptTimer = this.promptWindow;

    const active = this.getActivePlayers();
    active.forEach((p) => {
      this.playersState.set(p.id, {
        id: p.id,
        score: 0,
        combo: 0,
        lastAction: '',
        feedbackTimer: 0,
        feedbackText: '',
        feedbackColor: '#ffffff'
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);
    this.discAngle += dt * 4;

    this.promptTimer -= dt;
    if (this.promptTimer <= 0) {
      // Pick next prompt
      this.currentPrompt = this.directions[Math.floor(Math.random() * this.directions.length)];
      this.promptWindow = Math.max(0.8, 1.4 - (30 - this.roundTimer) * 0.02);
      this.promptTimer = this.promptWindow;
      this.audio.playTone(330, 0.08);
    }

    // Process Player Inputs
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.feedbackTimer > 0) {
        ps.feedbackTimer -= dt;
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const pressed = this.input.justPressed(p.id);

      let chosenDir: DirectionPrompt | null = null;
      if (throttle > 0.5) chosenDir = 'UP';
      else if (throttle < -0.5) chosenDir = 'DOWN';
      else if (steer < -0.5) chosenDir = 'LEFT';
      else if (steer > 0.5) chosenDir = 'RIGHT';
      else if (pressed) {
        // Single button fallback taps current prompt
        chosenDir = this.currentPrompt;
      }

      if (chosenDir && chosenDir !== ps.lastAction) {
        ps.lastAction = chosenDir;

        if (chosenDir === this.currentPrompt) {
          // Correct!
          const timingAccuracy = this.promptTimer / this.promptWindow;
          const isPerfect = timingAccuracy > 0.3 && timingAccuracy < 0.8;

          ps.combo++;
          const pts = isPerfect ? 3 : 1;
          ps.score += pts;
          ps.feedbackTimer = 0.5;
          ps.feedbackText = isPerfect ? 'PERFECT! +3' : 'GOOD! +1';
          ps.feedbackColor = isPerfect ? '#fde047' : '#38bdf8';

          this.audio.playTone(isPerfect ? 660 : 440, 0.12);
          this.particles.emit(width / 2, height / 2, isPerfect ? 16 : 8, ps.feedbackColor);
        } else {
          // Miss
          ps.combo = 0;
          ps.feedbackTimer = 0.5;
          ps.feedbackText = 'MISS!';
          ps.feedbackColor = '#ef4444';
          this.audio.playBuzzer();
        }
      } else if (!chosenDir) {
        ps.lastAction = '';
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false, 0, 0);
      return;
    }

    const delay = difficulty === 'bot_hard' ? 0.65 : difficulty === 'bot_normal' ? 0.45 : 0.25;
    const isTimingGood = this.promptTimer < this.promptWindow * delay && ps.lastAction === '';

    if (isTimingGood) {
      let steer = 0;
      let throttle = 0;
      let prompt = this.currentPrompt;
      // Easy bots occasionally press the wrong arrow
      if (difficulty === 'bot_easy' && Math.random() < 0.25) {
        const wrongDirs = this.directions.filter(d => d !== prompt);
        prompt = wrongDirs[Math.floor(Math.random() * wrongDirs.length)];
      }

      if (prompt === 'UP') throttle = 1;
      else if (prompt === 'DOWN') throttle = -1;
      else if (prompt === 'LEFT') steer = -1;
      else if (prompt === 'RIGHT') steer = 1;

      this.input.setBotInput(botId, true, steer, throttle);
    } else {
      this.input.setBotInput(botId, false, 0, 0);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 80s LaserDisc Neon Grid
    ctx.fillStyle = '#090514';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2 + 10;
    const discRadius = Math.min(width, height) * 0.35;

    // Spinning Holographic LaserDisc
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.discAngle);

    // Outer Silver Mirror Disc
    const grad = ctx.createRadialGradient(0, 0, 20, 0, 0, discRadius);
    grad.addColorStop(0, '#e2e8f0');
    grad.addColorStop(0.3, '#38bdf8');
    grad.addColorStop(0.6, '#ec4899');
    grad.addColorStop(0.85, '#a855f7');
    grad.addColorStop(1, '#64748b');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, discRadius, 0, Math.PI * 2);
    ctx.fill();

    // Grooves
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    for (let r = 30; r < discRadius - 10; r += 12) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Center Spindle Hole
    ctx.fillStyle = '#090514';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    // 4 Neon Directional Arrow Indicators
    const arrowDist = discRadius + 32;
    this.drawArrow(ctx, cx, cy - arrowDist, 'UP', this.currentPrompt === 'UP');
    this.drawArrow(ctx, cx, cy + arrowDist, 'DOWN', this.currentPrompt === 'DOWN');
    this.drawArrow(ctx, cx - arrowDist, cy, 'LEFT', this.currentPrompt === 'LEFT');
    this.drawArrow(ctx, cx + arrowDist, cy, 'RIGHT', this.currentPrompt === 'RIGHT');

    // Render Players Status
    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    for (let idx = 0; idx < active.length; idx++) {
      const p = active[idx];
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      const px = spacing * (idx + 1);
      const py = height - 30;

      ctx.fillStyle = p.color;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score} [${ps.combo}x]`, px, py);

      if (ps.feedbackTimer > 0) {
        ctx.fillStyle = ps.feedbackColor;
        ctx.font = 'bold 14px monospace';
        ctx.fillText(ps.feedbackText, px, py - 20);
      }
    }

    // Top HUD
    ctx.fillStyle = 'rgba(9, 5, 20, 0.9)';
    ctx.fillRect(0, 0, width, 36);
    ctx.fillStyle = '#ec4899';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('LASERDISC DANCE // QTE', 16, 24);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.roundTimer < 6 ? '#ef4444' : '#f8fafc';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width - 16, 24);
  }

  private drawArrow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    dir: DirectionPrompt,
    isActive: boolean
  ): void {
    ctx.save();
    ctx.translate(x, y);

    let angle = 0;
    if (dir === 'DOWN') angle = Math.PI;
    else if (dir === 'LEFT') angle = -Math.PI / 2;
    else if (dir === 'RIGHT') angle = Math.PI / 2;
    ctx.rotate(angle);

    if (isActive) {
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#ffffff';
    } else {
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#64748b';
    }

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(14, 6);
    ctx.lineTo(6, 6);
    ctx.lineTo(6, 18);
    ctx.lineTo(-6, 18);
    ctx.lineTo(-6, 6);
    ctx.lineTo(-14, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} mastered the LaserDisc synth dance rhythm!` : 'The disc spun to an end!'
    };
  }
}
