import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { CharacterMood } from '../core/CharacterRenderer';

export interface CoinTheme {
  name: string;
  bgGradTop: string;
  bgGradBot: string;
  archColor: string;
  pedestalColor: string;
  pedestalTrim: string;
  coinGradTop: string;
  coinGradMid: string;
  coinGradBot: string;
  themePillColor: string;
}

export const COIN_THEMES: CoinTheme[] = [
  {
    name: 'Royal Treasury 👑',
    bgGradTop: '#1E1B4B',
    bgGradBot: '#0F172A',
    archColor: 'rgba(251, 191, 36, 0.12)',
    pedestalColor: '#334155',
    pedestalTrim: '#F59E0B',
    coinGradTop: '#FEF08A',
    coinGradMid: '#F59E0B',
    coinGradBot: '#B45309',
    themePillColor: '#F59E0B'
  },
  {
    name: 'Pirate Galleon 🏴‍☠️',
    bgGradTop: '#451A03',
    bgGradBot: '#1C0A04',
    archColor: 'rgba(251, 146, 60, 0.12)',
    pedestalColor: '#78350F',
    pedestalTrim: '#FB923C',
    coinGradTop: '#FDE047',
    coinGradMid: '#D97706',
    coinGradBot: '#78350F',
    themePillColor: '#FB923C'
  },
  {
    name: 'Cyber Casino 🎰',
    bgGradTop: '#090514',
    bgGradBot: '#1D0B38',
    archColor: 'rgba(236, 72, 153, 0.15)',
    pedestalColor: '#1E1B4B',
    pedestalTrim: '#06B6D4',
    coinGradTop: '#67E8F9',
    coinGradMid: '#EC4899',
    coinGradBot: '#7E22CE',
    themePillColor: '#06B6D4'
  }
];

interface TossCoin {
  x: number;
  y: number;
  vy: number;
  vx: number;
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
  private coins: TossCoin[] = [];
  private tossTimer: number = 1.0;
  private currentToss: number = 0;
  private maxTosses: number = 7;
  private gravity: number = 380; // px/s^2
  private botPlans: Map<PlayerId, BotTossPlan> = new Map();
  private catapultAnim: number = 0;

  // Themes and Listeners
  private currentThemeIndex: number = 0;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private pointerdownListener: ((e: PointerEvent) => void) | null = null;

  // Mascot and Catcher state
  private playerCatchMood: Map<PlayerId, { mood: CharacterMood; timer: number }> = new Map();

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  public destroy(): void {
    this.removeListeners();
    super.destroy();
    if (typeof window !== 'undefined' && (window as unknown as { __COIN_APEX_DEBUG__?: unknown }).__COIN_APEX_DEBUG__) {
      delete (window as unknown as { __COIN_APEX_DEBUG__?: unknown }).__COIN_APEX_DEBUG__;
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isFinished) return;
      if (e.code === 'KeyT') {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % COIN_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.pointerdownListener = (e: PointerEvent) => {
      if (this.isFinished) return;
      const canvas = e.target as HTMLCanvasElement;
      if (!canvas || !canvas.getBoundingClientRect) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // Theme pill is at x: 20, y: canvas.height - 44, w: 170, h: 32
      if (clickX >= 20 && clickX <= 190 && clickY >= canvas.height - 44 && clickY <= canvas.height - 12) {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % COIN_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('pointerdown', this.pointerdownListener);
  }

  private removeListeners(): void {
    if (typeof window === 'undefined') return;
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
    if (this.pointerdownListener) {
      window.removeEventListener('pointerdown', this.pointerdownListener);
      this.pointerdownListener = null;
    }
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 55;
    this.isFinished = false;
    this.scores.clear();
    this.botPlans.clear();
    this.playerCatchMood.clear();
    this.coins = [];

    const active = this.getActivePlayers();
    active.forEach((p) => {
      this.scores.set(p.id, 0);
      this.playerCatchMood.set(p.id, { mood: 'focused', timer: 0 });
    });

    this.currentToss = 0;
    this.tossTimer = 1.2;

    // Debug hook for tests and telemetry
    (window as unknown as { __COIN_APEX_DEBUG__?: unknown }).__COIN_APEX_DEBUG__ = {
      getCoin: () =>
        this.coins.length > 0
          ? {
              x: this.coins[0].x,
              y: this.coins[0].y,
              vy: this.coins[0].vy,
              isApexGlinting: this.coins[0].isApexGlinting
            }
          : null,
      getScores: () => Array.from(this.scores.entries()).map(([id, score]) => ({ id, score })),
      launchWithVy: (vy: number) => {
        this.launchCoin(width, height);
        if (this.coins.length > 0) this.coins[0].vy = vy;
      },
      tap: (pid: PlayerId) => {
        this.input.setBotInput(pid, true);
      },
      getCurrentToss: () => this.currentToss
    };
  }

  public get coin(): any {
    return this.coins[0] || null;
  }

  public launchCoin(width: number, height: number): void {
    this.currentToss++;
    const isSuddenDeath = this.currentToss >= this.maxTosses - 1 || this.roundTimer <= 15;

    // Spawn 1 or 2 coins (twin coin volley in sudden death!)
    const coinCount = isSuddenDeath ? 2 : 1;
    this.coins = [];

    for (let c = 0; c < coinCount; c++) {
      const hasCaught = new Map<PlayerId, boolean>();
      for (const p of this.getActivePlayers()) {
        hasCaught.set(p.id, false);
      }

      const initialVy = -240 - Math.random() * 230 - c * 30;
      const initialVx = coinCount > 1 ? (c === 0 ? -35 : 35) : 0;

      this.coins.push({
        x: width / 2 + (coinCount > 1 ? (c === 0 ? -25 : 25) : 0),
        y: height * 0.72,
        vy: initialVy,
        vx: initialVx,
        rotation: Math.random() * Math.PI,
        rotSpeed: 10 + Math.random() * 6,
        hasCaught,
        isApexGlinting: false,
        apexGlintAnim: 0
      });
    }

    // Calibrate bot timing plans
    this.botPlans.clear();
    for (const p of this.getActivePlayers()) {
      if (this.players[p.id]?.type.startsWith('bot_')) {
        const diff = this.players[p.id].type as 'bot_easy' | 'bot_normal' | 'bot_hard';
        let targetVy = 0;
        const roll = Math.random();

        if (diff === 'bot_easy') {
          if (roll < 0.40) {
            targetVy = Math.random() < 0.5 ? -110 : 95;
          } else if (roll < 0.80) {
            targetVy = 35 + Math.random() * 35;
          } else {
            targetVy = (Math.random() - 0.5) * 22;
          }
        } else if (diff === 'bot_normal') {
          if (roll < 0.25) {
            targetVy = Math.random() < 0.5 ? -95 : 90;
          } else if (roll < 0.70) {
            targetVy = 32 + Math.random() * 30;
          } else {
            targetVy = (Math.random() - 0.5) * 20;
          }
        } else {
          if (roll < 0.10) {
            targetVy = -90;
          } else if (roll < 0.40) {
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
    this.particles.spawnSparks(width / 2, height * 0.72, '#F59E0B', 16);
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    if (this.catapultAnim > 0) {
      this.catapultAnim = Math.max(0, this.catapultAnim - dt * 4);
    }

    // Check underdog status: trailing by >= 350 pts
    let maxScore = 0;
    for (const s of this.scores.values()) {
      if (s > maxScore) maxScore = s;
    }

    // Update player catch moods
    for (const [pid, moodState] of this.playerCatchMood.entries()) {
      if (moodState.timer > 0) {
        moodState.timer -= dt;
      } else {
        moodState.mood = 'focused';
      }
    }

    // Update Coins Physics
    let allCoinsFell = this.coins.length > 0;
    for (const coin of this.coins) {
      coin.vy += this.gravity * dt;
      coin.y += coin.vy * dt;
      coin.x += coin.vx * dt;
      coin.rotation += coin.rotSpeed * dt;

      if (Math.abs(coin.vy) < 40 && !coin.isApexGlinting) {
        coin.isApexGlinting = true;
        coin.apexGlintAnim = 1.0;
        this.audio.playLaser();
      }

      if (coin.isApexGlinting) {
        coin.apexGlintAnim = Math.max(0, coin.apexGlintAnim - dt * 2.5);
      }

      // Check player inputs for catching this coin
      for (const p of this.getActivePlayers()) {
        const pressed = (this.input.justPressed(p.id) || this.input.justAction(p.id)) && !coin.hasCaught.get(p.id);

        if (pressed) {
          coin.hasCaught.set(p.id, true);
          const absVy = Math.abs(coin.vy);

          const isUnderdog = maxScore >= 4 && (this.scores.get(p.id) || 0) <= maxScore - 3;
          // Underdog tolerance cushion (+25 px/s)
          const effectiveAbsVy = Math.max(0, absVy - (isUnderdog ? 25 : 0));

          const isFirst = this.getActivePlayers()[0]?.id === p.id;
          const px = isFirst ? width * 0.22 : width * 0.78;
          const py = height * 0.58;

          if (effectiveAbsVy < 26) {
            // PERFECT APEX!
            const cur = this.scores.get(p.id) || 0;
            const pts = 3;
            this.scores.set(p.id, cur + pts);
            this.audio.playFanfare();
            this.particles.showFloatingText('🌟 PERFECT APEX! +3 PTS!', px, py - 40, '#F59E0B', 24);
            this.particles.spawnExplosion(coin.x, coin.y, '#FBBF24', 32);
            this.particles.addTrauma(0.3);

            const m = this.playerCatchMood.get(p.id);
            if (m) {
              m.mood = 'triumph';
              m.timer = 1.2;
            }
          } else if (effectiveAbsVy < 60) {
            // CLEAN APEX (+1)
            const cur = this.scores.get(p.id) || 0;
            const pts = 1;
            this.scores.set(p.id, cur + pts);
            this.audio.playScore();
            this.particles.showFloatingText('✨ CLEAN CATCH! +1 PT', px, py - 40, '#38BDF8', 22);
            this.particles.spawnSparks(coin.x, coin.y, '#38BDF8', 18);

            const m = this.playerCatchMood.get(p.id);
            if (m) {
              m.mood = 'happy';
              m.timer = 0.8;
            }
          } else if (effectiveAbsVy < 95) {
            // GOOD CATCH (+1)
            const cur = this.scores.get(p.id) || 0;
            const pts = 1;
            this.scores.set(p.id, cur + pts);
            this.audio.playTap();
            this.particles.showFloatingText('GOOD CATCH! +1 PT 👍', px, py - 40, '#10B981', 19);
            this.particles.spawnSparks(coin.x, coin.y, '#34D399', 12);

            const m = this.playerCatchMood.get(p.id);
            if (m) {
              m.mood = 'happy';
              m.timer = 0.6;
            }
          } else {
            // WHIFFED
            this.audio.playExplosion();
            const tag = coin.vy < 0 ? 'TOO EARLY! ❌' : 'TOO LATE! ❌';
            this.particles.showFloatingText(tag, px, py - 40, '#EF4444', 20);
            this.particles.spawnSparks(px, py, '#EF4444', 10);

            const m = this.playerCatchMood.get(p.id);
            if (m) {
              m.mood = 'shocked';
              m.timer = 0.8;
            }
          }
        }
      }

      if (coin.y <= height * 0.76) {
        allCoinsFell = false;
      }
    }

    if (this.coins.length > 0 && allCoinsFell) {
      this.coins = [];
      this.tossTimer = 1.1;

      if (this.currentToss >= this.maxTosses) {
        this.isFinished = true;
        this.audio.playFanfare();
      }
    } else if (this.coins.length === 0) {
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
    if (this.coins.length === 0) {
      this.input.setBotInput(botId, false);
      return;
    }

    const firstCoin = this.coins[0];
    if (!firstCoin || firstCoin.hasCaught.get(botId)) {
      this.input.setBotInput(botId, false);
      return;
    }

    const plan = this.botPlans.get(botId);
    if (!plan || plan.tapped) {
      this.input.setBotInput(botId, false);
      return;
    }

    const vy = firstCoin.vy;
    if (vy >= plan.targetVy) {
      this.input.setBotInput(botId, true);
      plan.tapped = true;
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const theme = COIN_THEMES[this.currentThemeIndex];
    const isSuddenDeath = this.currentToss >= this.maxTosses - 1 || this.roundTimer <= 15;

    // 1. Vaulted Chamber Backdrop
    const stoneGrad = ctx.createLinearGradient(0, 0, 0, height);
    stoneGrad.addColorStop(0, theme.bgGradTop);
    stoneGrad.addColorStop(0.6, theme.bgGradBot);
    stoneGrad.addColorStop(1, '#020617');
    ctx.fillStyle = stoneGrad;
    ctx.fillRect(0, 0, width, height);

    // Stone chamber arches
    ctx.strokeStyle = isSuddenDeath ? 'rgba(239, 68, 68, 0.18)' : theme.archColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(width / 2, height * 0.72, width * 0.45, Math.PI, 0);
    ctx.stroke();

    // Header Instruction Banner (Safely at y=56 below stopwatch timer)
    ctx.save();
    const pillW = 340;
    const pillH = 26;
    const pillX = width / 2 - pillW / 2;
    const pillY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 13);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#F87171' : theme.themePillColor;
    ctx.font = '800 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const bannerMsg = isSuddenDeath
      ? `⚡ FINAL TOSSES: TWIN COIN VOLLEY! ⚡`
      : `TOSS ${this.currentToss} / ${this.maxTosses} • TAP AT ZERO-VELOCITY APEX!`;
    ctx.fillText(bannerMsg, width / 2, pillY + pillH / 2);
    ctx.restore();

    // Spring Catapult Pedestal
    const catX = width / 2;
    const catY = height * 0.72;
    ctx.save();
    ctx.fillStyle = theme.pedestalColor;
    ctx.fillRect(catX - 35, catY, 70, 40);
    ctx.fillStyle = theme.pedestalTrim;
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

    // Render Coins
    for (const coin of this.coins) {
      this.renderGoldCoin(ctx, coin, theme);
    }

    // Render Player Scores, Mascots & Catcher Nets
    const active = this.getActivePlayers();
    let maxScore = 0;
    for (const s of this.scores.values()) {
      if (s > maxScore) maxScore = s;
    }

    for (const p of active) {
      const isLeft = p.id === active[0]?.id;
      const px = isLeft ? width * 0.22 : width * 0.78;
      const py = height * 0.72;
      const isUnderdog = maxScore >= 4 && (this.scores.get(p.id) || 0) <= maxScore - 3;

      ctx.save();
      ctx.textAlign = 'center';

      // Underdog Tractor Beam Golden Halo
      if (isUnderdog) {
        ctx.save();
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(px, py - 40, 48, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#FBBF24';
        ctx.font = '800 10px Montserrat, sans-serif';
        ctx.fillText('⭐ UNDERDOG +25 TOLERANCE', px, py - 95);
      }

      // Mascot Catcher
      const moodState = this.playerCatchMood.get(p.id);
      this.drawPlayerMascot(ctx, p.id, px, py - 52, 16, moodState?.mood || 'focused', performance.now() * 0.001);

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
      ctx.font = '800 14px Montserrat, sans-serif';
      ctx.fillText(p.name.toUpperCase(), px, py + 20);

      ctx.fillStyle = '#FBBF24';
      ctx.font = '900 18px sans-serif';
      ctx.fillText(`${this.scores.get(p.id) || 0} PTS`, px, py + 40);

      ctx.restore();
    }

    // Interactive Bottom-Left Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, height - 44, 170, 32, 16);
    else ctx.rect(20, height - 44, 170, 32);
    ctx.fill();
    ctx.strokeStyle = theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.themePillColor;
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.name} [T]`, 20 + 85, height - 44 + 16);
    ctx.restore();

    // On-screen Controls Pill (Offset to right, never overlapping theme pill)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.font = '600 11px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('Tap Action / Space / Enter at Apex • 5X Jackpot at True 0 m/s', width - 24, height - 28);
    ctx.restore();

    ctx.restore();
  }

  private renderGoldCoin(ctx: CanvasRenderingContext2D, c: TossCoin, theme: CoinTheme): void {
    ctx.save();
    ctx.translate(c.x, c.y);

    const cosRot = Math.cos(c.rotation);
    const coinRadius = 24;
    const coinScaleX = Math.abs(cosRot);

    // Coin Outer Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 18, coinRadius * coinScaleX, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Golden Coin Rim & Edge Thickness
    ctx.fillStyle = theme.coinGradBot;
    ctx.beginPath();
    ctx.ellipse(2, 0, coinRadius * Math.max(0.15, coinScaleX), coinRadius, 0, 0, Math.PI * 2);
    ctx.fill();

    // Coin Front Face
    const coinGrad = ctx.createLinearGradient(-coinRadius, -coinRadius, coinRadius, coinRadius);
    coinGrad.addColorStop(0, theme.coinGradTop);
    coinGrad.addColorStop(0.5, theme.coinGradMid);
    coinGrad.addColorStop(1, theme.coinGradBot);
    ctx.fillStyle = coinGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, coinRadius * Math.max(0.12, coinScaleX), coinRadius, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Apex Glint Star Sparkle
    if (c.isApexGlinting && c.apexGlintAnim > 0) {
      const glintSize = 34 * c.apexGlintAnim;
      ctx.save();
      ctx.shadowColor = '#FBBF24';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#FFFFFF';

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
