import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface ForgePlayer {
  id: PlayerId;
  anvilX: number;
  anvilY: number;
  indicatorPos: number; // 0 to 1
  indicatorSpeed: number;
  indicatorDir: number;
  score: number;
  combo: number;
  swordsCompleted: number;
  swordProgress: number; // 0 to 100
  hammerSwingAnim: number;
  sparksTimer: number;
}

export class BlacksmithForgeGame extends BaseGame {
  public playersState: Map<PlayerId, ForgePlayer> = new Map();
  public currentMapName: string = 'Royal Armoury Forge';

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
    const spacing = width / (active.length + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        anvilX: spacing * (idx + 1),
        anvilY: height * 0.58,
        indicatorPos: 0.1,
        indicatorSpeed: 1.2 + Math.random() * 0.3,
        indicatorDir: 1,
        score: 0,
        combo: 0,
        swordsCompleted: 0,
        swordProgress: 0,
        hammerSwingAnim: 0,
        sparksTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.25 + Math.random() * 0.25);
    });
  }

  public update(dt: number, _width: number, _height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bot decisions
    this.updateBots(dt, _width, _height);

    // Update players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.hammerSwingAnim > 0) {
        ps.hammerSwingAnim = Math.max(0, ps.hammerSwingAnim - dt * 5.0);
      }
      if (ps.sparksTimer > 0) {
        ps.sparksTimer -= dt;
      }

      // Oscillate rhythm indicator
      ps.indicatorPos += ps.indicatorDir * ps.indicatorSpeed * dt;
      if (ps.indicatorPos >= 1.0) {
        ps.indicatorPos = 1.0;
        ps.indicatorDir = -1;
      } else if (ps.indicatorPos <= 0.0) {
        ps.indicatorPos = 0.0;
        ps.indicatorDir = 1;
      }

      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      // Hammer strike!
      if (justAction) {
        ps.hammerSwingAnim = 1.0;

        // Sweet spot is centered at 0.5 with width +/- 0.14
        const distFromCenter = Math.abs(ps.indicatorPos - 0.5);

        if (distFromCenter < 0.08) {
          // PERFECT STRIKE!
          ps.combo += 1;
          const mult = Math.min(4, 1 + Math.floor(ps.combo / 2));
          const pts = 120 * mult;
          ps.score += pts;
          ps.swordProgress += 25;

          this.audio.playScore();
          this.particles.shake(4);
          this.particles.spawnExplosion(ps.anvilX, ps.anvilY - 14, '#F59E0B', 20);

          if (ps.swordProgress >= 100) {
            // Sword complete!
            ps.swordProgress = 0;
            ps.swordsCompleted += 1;
            ps.score += 300;
            this.audio.playFanfare();
            this.particles.shake(6);
            this.particles.spawnSparks(ps.anvilX, ps.anvilY - 24, '#38BDF8', 24);
          }
        } else if (distFromCenter < 0.16) {
          // GOOD STRIKE
          ps.score += 60;
          ps.swordProgress += 15;
          this.audio.playTap();
          this.particles.spawnSparks(ps.anvilX, ps.anvilY - 14, '#FBBF24', 8);
        } else {
          // MISS / CLANG!
          ps.combo = 0;
          this.audio.playBounce();
          this.particles.spawnSparks(ps.anvilX, ps.anvilY - 14, '#94A3B8', 6);
        }
      }
    }

    if (this.roundTimer <= 0) {
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
    const bot = this.playersState.get(botId);
    if (!bot) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;

    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const interval =
      difficulty === 'bot_easy'
        ? 0.35 + Math.random() * 0.22
        : difficulty === 'bot_normal'
        ? 0.15 + Math.random() * 0.10
        : 0.05 + Math.random() * 0.04;
    this.botReactionTimers.set(botId, interval);

    // Hit when indicator is in sweet spot (0.5)
    const distFromCenter = Math.abs(bot.indicatorPos - 0.5);
    const targetDist =
      difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.09 : 0.15;

    let action = false;
    if (distFromCenter <= targetDist) {
      action = true; // Strike anvil!
    }

    this.input.setBotInput(botId, action, 0, 0, action);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const ps = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: ps?.score || 0,
        swords: ps?.swordsCompleted || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topSwords = scores[0]?.swords || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} forged ${topSwords} masterwork royal broadswords!`
      : 'Draw! All forge hammers rang true!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Forge Stone Wall & Glow
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1C1917');
    bgGrad.addColorStop(0.6, '#292524');
    bgGrad.addColorStop(1, '#451A03');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Render Anvils & Rhythm Indicators
    for (const ps of this.playersState.values()) {
      const cfg = this.players.find((x) => x.id === ps.id);
      const color = cfg ? cfg.color : '#FFFFFF';

      ctx.save();
      // Anvil Body
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(ps.anvilX - 35, ps.anvilY);
      ctx.lineTo(ps.anvilX + 35, ps.anvilY);
      ctx.lineTo(ps.anvilX + 22, ps.anvilY + 38);
      ctx.lineTo(ps.anvilX - 22, ps.anvilY + 38);
      ctx.closePath();
      ctx.fill();

      // Glowing Hot Steel Blade atop anvil
      const heatColor = ps.swordProgress > 50 ? '#F59E0B' : '#EF4444';
      ctx.fillStyle = heatColor;
      ctx.fillRect(ps.anvilX - 20, ps.anvilY - 6, 40, 6);

      // Blacksmith Hammer
      ctx.save();
      ctx.translate(ps.anvilX + 26, ps.anvilY - 14);
      const swingAngle = ps.hammerSwingAnim > 0 ? -Math.PI / 4 : 0.2;
      ctx.rotate(swingAngle);

      ctx.fillStyle = '#78350F'; // Handle
      ctx.fillRect(-3, -28, 6, 28);
      ctx.fillStyle = color; // Hammer Head
      ctx.fillRect(-12, -36, 24, 12);
      ctx.restore();

      // Rhythm Meter Bar
      const barW = 110;
      const barH = 12;
      const barX = ps.anvilX - barW / 2;
      const barY = ps.anvilY - 65;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(barX, barY, barW, barH);

      // Sweet Spot Zone in Center
      const sweetW = barW * 0.24;
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(ps.anvilX - sweetW / 2, barY, sweetW, barH);

      // Moving Indicator Line
      const indX = barX + ps.indicatorPos * barW;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(indX - 2.5, barY - 4, 5, barH + 8);

      // Sword Progress Bar
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(ps.anvilX - 30, ps.anvilY + 46, 60, 6);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(ps.anvilX - 30, ps.anvilY + 46, (ps.swordProgress / 100) * 60, 6);

      // Combo text
      if (ps.combo >= 2) {
        ctx.fillStyle = '#FBBF24';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${ps.combo}x COMBO!`, ps.anvilX, barY - 8);
      }

      // Player Label
      ctx.fillStyle = color;
      ctx.font = 'bold 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${ps.id + 1}`, ps.anvilX, ps.anvilY + 70);

      ctx.restore();
    }

    // 3. Draw HUD
    this.renderHUD(ctx, width);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();
    // Timer badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 55, 12, 110, 36, 10);
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(this.roundTimer)}s`, width * 0.5, 30);

    // Score bar
    const active = this.getActivePlayers();
    const itemW = 95;
    const subBarW = active.length * itemW;
    const subBarX = width * 0.5 - subBarW * 0.5;

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      const px = subBarX + idx * itemW;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.beginPath();
      ctx.roundRect(px + 4, 52, itemW - 8, 26, 6);
      ctx.fill();

      ctx.fillStyle = p.color;
      ctx.font = 'bold 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${p.id + 1}: ${ps?.score || 0}`, px + itemW * 0.5, 68);
    });
    ctx.restore();
  }
}
