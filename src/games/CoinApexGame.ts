import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface TossCoin {
  x: number;
  y: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  hasCaught: Map<PlayerId, boolean>;
  isApexGlinting: boolean;
  apexGlintAnim: number;
}

interface BotTossPlan {
  targetVy: number;
  tapped: boolean;
}

export class CoinApexGame extends BaseGame {
  private scores: Map<PlayerId, number> = new Map();
  private coin: TossCoin | null = null;
  private tossTimer: number = 1.0;
  private currentToss: number = 0;
  private maxTosses: number = 7;
  private gravity: number = 380; // px/s^2
  private botPlans: Map<PlayerId, BotTossPlan> = new Map();
  private catapultAnim: number = 0;

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

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 55;
    this.isFinished = false;
    this.scores.clear();
    this.botPlans.clear();

    const active = this.getActivePlayers();
    active.forEach((p) => {
      this.scores.set(p.id, 0);
    });

    this.currentToss = 0;
    this.tossTimer = 1.2;
    this.coin = null;

    // Debug hook for tests and telemetry
    (window as any).__COIN_APEX_DEBUG__ = {
      getCoin: () => this.coin ? {
        x: this.coin.x,
        y: this.coin.y,
        vy: this.coin.vy,
        isApexGlinting: this.coin.isApexGlinting
      } : null,
      getScores: () => Array.from(this.scores.entries()).map(([id, score]) => ({ id, score })),
      launchWithVy: (vy: number) => {
        this.launchCoin(width, height);
        if (this.coin) this.coin.vy = vy;
      },
      tap: (pid: PlayerId) => {
        this.input.setBotInput(pid, true);
      },
      getCurrentToss: () => this.currentToss
    };
  }

  private launchCoin(width: number, height: number): void {
    this.currentToss++;
    const hasCaught = new Map<PlayerId, boolean>();
    for (const p of this.getActivePlayers()) {
      hasCaught.set(p.id, false);
    }

    // Varied toss height / initial velocity so each toss has a substantially different arc (quick low pops to sky-high arcs)
    const initialVy = -240 - Math.random() * 240;

    this.coin = {
      x: width / 2,
      y: height * 0.72,
      vy: initialVy,
      rotation: 0,
      rotSpeed: 10 + Math.random() * 6,
      hasCaught,
      isApexGlinting: false,
      apexGlintAnim: 0
    };

    // Calibrate human-like, beatable bot timing plans for this specific toss
    this.botPlans.clear();
    for (const p of this.getActivePlayers()) {
      if (this.players[p.id]?.type.startsWith('bot_')) {
        const diff = this.players[p.id].type as 'bot_easy' | 'bot_normal' | 'bot_hard';
        let targetVy = 0;
        const roll = Math.random();

        if (diff === 'bot_easy') {
          if (roll < 0.45) {
            // Mistimed whiff: early jump or late panic
            targetVy = Math.random() < 0.5 ? -110 : 95;
          } else if (roll < 0.85) {
            // Good catch on descent (+1)
            targetVy = 35 + Math.random() * 35;
          } else {
            // Lucky perfect catch (+3)
            targetVy = (Math.random() - 0.5) * 22;
          }
        } else if (diff === 'bot_normal') {
          if (roll < 0.28) {
            // Human mistake / whiff
            targetVy = Math.random() < 0.5 ? -95 : 90;
          } else if (roll < 0.75) {
            // Good catch (+1)
            targetVy = 32 + Math.random() * 30;
          } else {
            // Perfect catch (+3)
            targetVy = (Math.random() - 0.5) * 20;
          }
        } else {
          // Hard bot
          if (roll < 0.12) {
            targetVy = -90;
          } else if (roll < 0.45) {
            targetVy = 35 + Math.random() * 20;
          } else {
            targetVy = (Math.random() - 0.5) * 16;
          }
        }

        this.botPlans.set(p.id, { targetVy, tapped: false });
      }
    }

    this.catapultAnim = 1.0;
    this.audio.playTap();
    this.particles.spawnSparks(width / 2, height * 0.72, '#F59E0B', 15);
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    if (this.catapultAnim > 0) {
      this.catapultAnim = Math.max(0, this.catapultAnim - dt * 4);
    }

    // Update Coin Physics
    if (this.coin) {
      this.coin.vy += this.gravity * dt;
      this.coin.y += this.coin.vy * dt;
      this.coin.rotation += this.coin.rotSpeed * dt;

      // Check if coin reached apex (vy near 0)
      if (Math.abs(this.coin.vy) < 40 && !this.coin.isApexGlinting) {
        this.coin.isApexGlinting = true;
        this.coin.apexGlintAnim = 1.0;
        this.audio.playLaser();
      }

      if (this.coin.isApexGlinting) {
        this.coin.apexGlintAnim = Math.max(0, this.coin.apexGlintAnim - dt * 2.5);
      }

      // Check player inputs
      for (const p of this.getActivePlayers()) {
        const pressed = (this.input.justPressed(p.id) || this.input.justAction(p.id)) && !this.coin.hasCaught.get(p.id);

        if (pressed) {
          this.coin.hasCaught.set(p.id, true);
          const absVy = Math.abs(this.coin.vy);

          const isFirst = this.getActivePlayers()[0]?.id === p.id;
          const px = isFirst ? width * 0.28 : width * 0.72;
          const py = height * 0.5;

          if (absVy < 30) {
            // PERFECT ZERO-VELOCITY APEX!
            const cur = this.scores.get(p.id) || 0;
            this.scores.set(p.id, cur + 3);
            this.audio.playFanfare();
            this.particles.showFloatingText('PERFECT APEX! +3 PTS! 🌟', px, py - 40, '#F59E0B', 24);
            this.particles.spawnSparks(this.coin.x, this.coin.y, '#FBBF24', 28);
            this.particles.addTrauma(0.3);
          } else if (absVy < 85) {
            // GOOD TIMING
            const cur = this.scores.get(p.id) || 0;
            this.scores.set(p.id, cur + 1);
            this.audio.playTap();
            this.particles.showFloatingText('GOOD CATCH! +1 PT 👍', px, py - 40, '#10B981', 20);
            this.particles.spawnSparks(this.coin.x, this.coin.y, '#34D399', 14);
          } else {
            // WHIFFED (Too early or too late)
            this.audio.playExplosion();
            const tag = this.coin.vy < 0 ? 'TOO EARLY! ❌' : 'TOO LATE! ❌';
            this.particles.showFloatingText(tag, px, py - 40, '#EF4444', 20);
            this.particles.spawnSparks(px, py, '#EF4444', 10);
          }
        }
      }

      // Coin dropped below ground level
      if (this.coin.y > height * 0.76) {
        this.coin = null;
        this.tossTimer = 1.1; // Next toss delay

        if (this.currentToss >= this.maxTosses) {
          this.isFinished = true;
          this.audio.playFanfare();
        }
      }
    } else {
      // Cooldown between tosses
      this.tossTimer -= dt;
      if (this.tossTimer <= 0 && this.currentToss < this.maxTosses) {
        this.launchCoin(width, height);
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
    width: number,
    height: number
  ): void {
    if (!this.coin || this.coin.hasCaught.get(botId)) {
      this.input.setBotInput(botId, false);
      return;
    }

    const plan = this.botPlans.get(botId);
    if (!plan || plan.tapped) {
      this.input.setBotInput(botId, false);
      return;
    }

    const vy = this.coin.vy;
    // Check if coin velocity has reached the bot's planned targetVy
    if (vy >= plan.targetVy) {
      this.input.setBotInput(botId, true);
      plan.tapped = true;
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Vaulted Stone Treasury Backdrop
    const stoneGrad = ctx.createLinearGradient(0, 0, 0, height);
    stoneGrad.addColorStop(0, '#1E293B');
    stoneGrad.addColorStop(0.6, '#0F172A');
    stoneGrad.addColorStop(1, '#020617');
    ctx.fillStyle = stoneGrad;
    ctx.fillRect(0, 0, width, height);

    // Stone chamber arches
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(width / 2, height * 0.72, width * 0.45, Math.PI, 0);
    ctx.stroke();

    // Header Instruction
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '900 24px Montserrat, sans-serif';
    ctx.fillText(`COIN APEX • TOSS ${this.currentToss} / ${this.maxTosses}`, width / 2, 76);

    ctx.fillStyle = '#FBBF24';
    ctx.font = '600 14px sans-serif';
    ctx.fillText('Tap at the peak of the toss when vertical speed hits zero! (+3 Perfect / +1 Good)', width / 2, 98);
    ctx.restore();

    // Spring Catapult Pedestal
    const catX = width / 2;
    const catY = height * 0.72;
    ctx.save();
    ctx.fillStyle = '#334155';
    ctx.fillRect(catX - 35, catY, 70, 40);
    ctx.fillStyle = '#475569';
    ctx.fillRect(catX - 42, catY + 36, 84, 12);

    // Catapult spring coil
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    const springCompress = this.catapultAnim * 8;
    for (let i = 0; i < 4; i++) {
      const sy = catY - 5 + i * (6 - springCompress * 0.5);
      ctx.moveTo(catX - 16, sy);
      ctx.lineTo(catX + 16, sy + 3);
    }
    ctx.stroke();
    ctx.restore();

    // Render Coin
    if (this.coin) {
      this.renderGoldCoin(ctx, this.coin);
    }

    // Render Player Scores & Catch Feedback Boxes
    const active = this.getActivePlayers();
    for (const p of active) {
      const isLeft = p.id === active[0]?.id;
      const px = isLeft ? width * 0.22 : width * 0.78;
      const py = height * 0.72;

      ctx.save();
      ctx.textAlign = 'center';

      // Score Plate
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px - 75, py, 150, 48, 10);
      else ctx.rect(px - 75, py, 150, 48);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 16px Montserrat, sans-serif';
      ctx.fillText(p.name.toUpperCase(), px, py + 22);

      ctx.fillStyle = '#FBBF24';
      ctx.font = '900 18px sans-serif';
      ctx.fillText(`${this.scores.get(p.id) || 0} PTS`, px, py + 42);

      ctx.restore();
    }

    ctx.restore();
  }

  private renderGoldCoin(ctx: CanvasRenderingContext2D, c: TossCoin): void {
    ctx.save();
    ctx.translate(c.x, c.y);

    // 3D Coin tumble compression
    const cosRot = Math.cos(c.rotation);
    const coinRadius = 24;
    const coinScaleX = Math.abs(cosRot);

    // Coin Outer Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 18, coinRadius * coinScaleX, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Golden Coin Rim & Edge Thickness
    ctx.fillStyle = '#B45309';
    ctx.beginPath();
    ctx.ellipse(2, 0, coinRadius * Math.max(0.15, coinScaleX), coinRadius, 0, 0, Math.PI * 2);
    ctx.fill();

    // Coin Front Face
    const coinGrad = ctx.createLinearGradient(-coinRadius, -coinRadius, coinRadius, coinRadius);
    coinGrad.addColorStop(0, '#FDE047');
    coinGrad.addColorStop(0.5, '#F59E0B');
    coinGrad.addColorStop(1, '#D97706');
    ctx.fillStyle = coinGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, coinRadius * Math.max(0.12, coinScaleX), coinRadius, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Apex Glint Star Sparkle
    if (c.isApexGlinting && c.apexGlintAnim > 0) {
      const glintSize = 32 * c.apexGlintAnim;
      ctx.save();
      ctx.shadowColor = '#FBBF24';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#FFFFFF';

      // 4-point diamond sparkle
      ctx.beginPath();
      ctx.moveTo(0, -glintSize);
      ctx.lineTo(glintSize * 0.25, -glintSize * 0.25);
      ctx.lineTo(glintSize, 0);
      ctx.lineTo(glintSize * 0.25, glintSize * 0.25);
      ctx.lineTo(0, glintSize);
      ctx.lineTo(-glintSize * 0.25, glintSize * 0.25);
      ctx.lineTo(-glintSize, 0);
      ctx.lineTo(-glintSize * 0.25, -glintSize * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const sorted = [...active].sort((a, b) => (this.scores.get(b.id) || 0) - (this.scores.get(a.id) || 0));
    const p1Score = this.scores.get(sorted[0].id) || 0;
    const p2Score = sorted.length > 1 ? this.scores.get(sorted[1].id) || 0 : 0;
    const isDraw = sorted.length > 1 && p1Score === p2Score;
    const winner = sorted[0];

    return {
      winnerId: isDraw ? null : winner.id,
      rankings: sorted.map((p, i) => ({
        playerId: p.id,
        score: this.scores.get(p.id) || 0,
        place: i + 1
      })),
      mvpHighlight: isDraw
        ? 'Coin toss duel ended in a tie!'
        : `${winner.name} caught the coin apex with ${p1Score} points!`
    };
  }
}
