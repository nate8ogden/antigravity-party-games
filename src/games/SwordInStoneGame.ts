import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface ArthurianKnight {
  id: PlayerId;
  x: number;
  y: number;
  pullProgress: number; // 0 to 100%
  meterPos: number; // 0 to 1 oscillating
  meterDir: number;
  meterSpeed: number;
  pullAnimTimer: number;
  slipTimer: number;
  pullCount: number;
  perfectStrikes: number;
}

export class SwordInStoneGame extends BaseGame {
  public playersState: Map<PlayerId, ArthurianKnight> = new Map();
  public currentMapName: string = 'Sanctuary of the Ancient Runestone';

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
        y: height * 0.54,
        pullProgress: 0,
        meterPos: 0.1,
        meterDir: 1,
        meterSpeed: 2.0 + Math.random() * 0.4,
        pullAnimTimer: 0,
        slipTimer: 0,
        pullCount: 0,
        perfectStrikes: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.pullAnimTimer > 0) ps.pullAnimTimer -= dt;
      if (ps.slipTimer > 0) ps.slipTimer -= dt;

      // Oscillate power meter
      ps.meterPos += ps.meterDir * ps.meterSpeed * dt;
      if (ps.meterPos >= 1.0) {
        ps.meterPos = 1.0;
        ps.meterDir = -1;
      } else if (ps.meterPos <= 0.0) {
        ps.meterPos = 0.0;
        ps.meterDir = 1;
      }

      // Check input
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      if (justAction) {
        this.handleTug(ps);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private handleTug(ps: ArthurianKnight): void {
    ps.pullCount++;
    ps.pullAnimTimer = 0.25;

    const centerDist = Math.abs(ps.meterPos - 0.5);

    if (centerDist < 0.08) {
      // PERFECT TUG!
      ps.perfectStrikes++;
      const boost = 14 + Math.random() * 4;
      ps.pullProgress = Math.min(100, ps.pullProgress + boost);
      this.audio.playScore();
      this.particles.spawnSparks(ps.x, ps.y - 20, '#FFD700', 14);
    } else if (centerDist < 0.22) {
      // GOOD TUG
      const boost = 6 + Math.random() * 3;
      ps.pullProgress = Math.min(100, ps.pullProgress + boost);
      this.audio.playTap();
      this.particles.spawnSparks(ps.x, ps.y - 15, '#90CAF9', 6);
    } else {
      // SLIP!
      ps.slipTimer = 0.4;
      ps.pullProgress = Math.max(0, ps.pullProgress - 4);
      this.audio.playBounce();
      this.particles.emit(ps.x, ps.y - 10, 8, '#B0BEC5');
    }

    if (ps.pullProgress >= 100) {
      this.isFinished = true;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const centerDist = Math.abs(ps.meterPos - 0.5);

    let reactionDelay = 0.22;
    let shouldTap = false;

    if (difficulty === 'bot_easy') {
      reactionDelay = 0.45;
      if (centerDist < 0.28 || Math.random() < 0.2) {
        shouldTap = true;
      }
    } else if (difficulty === 'bot_hard') {
      reactionDelay = 0.10;
      if (centerDist < 0.07) {
        shouldTap = true;
      }
    } else {
      reactionDelay = 0.22;
      if (centerDist < 0.14) {
        shouldTap = true;
      }
    }

    if (shouldTap) {
      this.input.setBotInput(botId, true, 0, 0, true);
    }

    this.botReactionTimers.set(botId, reactionDelay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const ps = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: Math.floor(ps?.pullProgress || 0),
        perfect: ps?.perfectStrikes || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topScore = scores[0]?.score || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} drew Excalibur from the Stone (${topScore}%) and was crowned High King!`
      : 'None were worthy to draw Excalibur from the ancient stone!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0d1b1e');
    bgGrad.addColorStop(1, '#1b3b35');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#1e382b';
    ctx.fillRect(0, height * 0.72, width, height * 0.28);
    ctx.strokeStyle = '#2d5340';
    ctx.lineWidth = 2;
    for (let x = 0; x < width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, height * 0.72);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, height * 0.72);
    ctx.lineTo(width, height * 0.72);
    ctx.stroke();

    ctx.save();
    ctx.fillStyle = '#FFD54F';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SWORD IN THE STONE', width / 2, 38);

    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#A5D6A7';
    ctx.fillText('TIME TAP IN GOLDEN SWEET-SPOT • HEAVE EXCALIBUR FROM STONE', width / 2, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px monospace';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);
    ctx.restore();

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderShrine(ctx, ps, p);
    }
  }

  private renderShrine(ctx: CanvasRenderingContext2D, ps: ArthurianKnight, p: PlayerConfig): void {
    ctx.save();

    const boulderW = 110;
    const boulderH = 65;
    ctx.fillStyle = '#455A64';
    ctx.beginPath();
    ctx.ellipse(ps.x, ps.y + 40, boulderW / 2, boulderH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#37474F';
    ctx.lineWidth = 4;
    ctx.stroke();

    const runeGlow = ps.pullProgress / 100;
    ctx.strokeStyle = `rgba(255, 215, 0, ${0.2 + runeGlow * 0.8})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ps.x - 25, ps.y + 35);
    ctx.lineTo(ps.x - 15, ps.y + 45);
    ctx.lineTo(ps.x - 20, ps.y + 55);
    ctx.moveTo(ps.x + 25, ps.y + 35);
    ctx.lineTo(ps.x + 15, ps.y + 45);
    ctx.lineTo(ps.x + 20, ps.y + 55);
    ctx.stroke();

    const liftOffset = (ps.pullProgress / 100) * 45;
    const swordBaseY = ps.y + 20 - liftOffset;

    ctx.fillStyle = '#ECEFF1';
    ctx.fillRect(ps.x - 4, swordBaseY - 60, 8, 60);

    ctx.fillStyle = '#FFD700';
    ctx.fillRect(ps.x - 20, swordBaseY - 65, 40, 8);

    ctx.fillStyle = '#8D6E63';
    ctx.fillRect(ps.x - 3, swordBaseY - 85, 6, 20);
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(ps.x, swordBaseY - 88, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(ps.x - 12, swordBaseY - 75, 8, 0, Math.PI * 2);
    ctx.arc(ps.x + 12, swordBaseY - 75, 8, 0, Math.PI * 2);
    ctx.fill();

    const meterW = 120;
    const meterH = 14;
    const meterY = ps.y - 120;

    ctx.fillStyle = '#263238';
    ctx.fillRect(ps.x - meterW / 2, meterY, meterW, meterH);
    ctx.strokeStyle = '#546E7A';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ps.x - meterW / 2, meterY, meterW, meterH);

    const sweetSpotX = ps.x - meterW / 2 + 0.42 * meterW;
    const sweetSpotW = 0.16 * meterW;
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(sweetSpotX, meterY + 1, sweetSpotW, meterH - 2);

    const needleX = ps.x - meterW / 2 + ps.meterPos * meterW;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(needleX - 2.5, meterY - 3, 5, meterH + 6);
    ctx.strokeStyle = '#D32F2F';
    ctx.lineWidth = 1;
    ctx.strokeRect(needleX - 2.5, meterY - 3, 5, meterH + 6);

    const progH = 80;
    const progW = 10;
    const progX = ps.x + 60;
    const progY = ps.y - 70;

    ctx.fillStyle = '#263238';
    ctx.fillRect(progX, progY, progW, progH);
    ctx.strokeStyle = '#546E7A';
    ctx.strokeRect(progX, progY, progW, progH);

    const filledH = (ps.pullProgress / 100) * progH;
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(progX + 1, progY + progH - filledH, progW - 2, filledH);

    if (ps.slipTimer > 0) {
      ctx.fillStyle = '#EF5350';
      ctx.font = '900 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SLIP! -4%', ps.x, meterY - 8);
    }

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.roundRect(ps.x - 52, ps.y + 75, 104, 32, 6);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name}: ${Math.floor(ps.pullProgress)}%`, ps.x, ps.y + 90);
    ctx.font = '700 10px monospace';
    ctx.fillText(`Perfect: ${ps.perfectStrikes}`, ps.x, ps.y + 102);

    ctx.restore();
  }
}
