import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface WokChef {
  id: PlayerId;
  x: number;
  y: number;
  heat: number; // 0 to 100%
  tossAltitude: number;
  vToss: number;
  dishesPrepared: number;
  score: number;
  combo: number;
  burnTimer: number;
  shakeAnim: number;
}

export class WokStirFryGame extends BaseGame {
  public playersState: Map<PlayerId, WokChef> = new Map();
  public currentMapName: string = 'Dragon Alley Sizzling Wok';

  private botReactionTimers: Map<PlayerId, number> = new Map();
  private ingredientTimer: number = 2.5;

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
    this.ingredientTimer = 2.0;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height * 0.65,
        heat: 50,
        tossAltitude: 0,
        vToss: 0,
        dishesPrepared: 0,
        score: 0,
        combo: 0,
        burnTimer: 0,
        shakeAnim: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, _width: number, _height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    this.updateBots(dt, _width, _height);

    // Dynamic Random Ingredient Drops
    this.ingredientTimer -= dt;
    if (this.ingredientTimer <= 0) {
      this.ingredientTimer = 2.2 + Math.random() * 2.2;
      const drops = [
        { name: '🍤 GOLDEN PRAWN! +35', pts: 35, color: '#FBBF24' },
        { name: '🌶️ FIRE CHILI! +25', pts: 25, color: '#EF4444' },
        { name: '🥬 CRISP GREENS! +15', pts: 15, color: '#10B981' },
        { name: '🍄 SHIITAKE! +20', pts: 20, color: '#A78BFA' }
      ];
      const drop = drops[Math.floor(Math.random() * drops.length)];

      for (const p of this.getActivePlayers()) {
        const chef = this.playersState.get(p.id);
        if (chef && Math.random() < 0.65) {
          chef.score += drop.pts;
          this.audio.playTone(660, 0.08, 'triangle');
          this.particles.showFloatingText(drop.name, chef.x, chef.y - 35, drop.color, 14);
          this.particles.spawnSparks(chef.x, chef.y - 20, drop.color, 8);
        }
      }
    }

    for (const p of this.getActivePlayers()) {
      const chef = this.playersState.get(p.id);
      if (!chef) continue;

      if (chef.burnTimer > 0) chef.burnTimer -= dt;
      if (chef.shakeAnim > 0) chef.shakeAnim -= dt * 6;

      // Natural flame heat rise with random micro-flareups
      const flare = Math.random() < 0.15 ? 35 : 20;
      chef.heat = Math.min(100, chef.heat + flare * dt);

      // Tossed noodles physics
      if (chef.tossAltitude > 0 || chef.vToss !== 0) {
        chef.tossAltitude += chef.vToss * dt;
        chef.vToss -= 550 * dt;
        if (chef.tossAltitude <= 0) {
          chef.tossAltitude = 0;
          chef.vToss = 0;
        }
      }

      // Check input: Wok Shake / Toss
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      if (justAction) {
        this.handleWokToss(chef);
      }

      // Check if heat burns
      if (chef.heat >= 100) {
        chef.burnTimer = 1.0;
        chef.combo = 0;
        chef.score = Math.max(0, chef.score - 10);
        chef.heat = 40;
        this.audio.playExplosion();
        this.particles.emit(chef.x, chef.y - 20, 10, '#3E2723');
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private handleWokToss(chef: WokChef): void {
    chef.shakeAnim = 1.0;
    chef.vToss = 240;

    // Check if heat was in sweet spot [45% to 80%] before cooling
    const inSweetSpot = chef.heat >= 45 && chef.heat <= 80;

    // Tossing cools wok down by 22%
    chef.heat = Math.max(10, chef.heat - 22);

    if (inSweetSpot) {
      chef.combo++;
      chef.dishesPrepared++;

      // 28% chance of explosive Master Flambé critical!
      const isFlambe = Math.random() < 0.28;
      const multiplier = isFlambe ? 2.0 : 1.0;
      const pts = Math.round((15 + chef.combo * 3) * multiplier);
      chef.score += pts;

      if (isFlambe) {
        this.audio.playBoost();
        this.particles.showFloatingText('🔥 MASTER FLAMBÉ! 2x!', chef.x, chef.y - 45, '#F59E0B', 18);
        this.particles.spawnExplosion(chef.x, chef.y - 30, '#FF5722', 12);
      } else {
        this.audio.playScore();
        this.particles.spawnSparks(chef.x, chef.y - 30, '#FF9800', 8);
      }
    } else {
      chef.score += 5;
      this.audio.playTap();
      this.particles.emit(chef.x, chef.y - 20, 3, '#FFD54F');
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const chef = this.playersState.get(botId);
    if (!chef) return;

    let toss = false;
    let delay = 0.25;

    // Toss when heat approaches sweet spot (70-85%)
    if (chef.heat > 70 && chef.tossAltitude < 20) {
      toss = true;
    }

    if (difficulty === 'bot_easy') {
      delay = 0.45;
      if (chef.heat > 85) toss = true; // delays until nearly burnt
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
      if (chef.heat > 68) toss = true;
    }

    if (toss) {
      this.handleWokToss(chef);
    }

    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const c = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: c?.score || 0,
        dishes: c?.dishesPrepared || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topDishes = scores[0]?.dishes || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} tossed ${topDishes} sizzling wok noodle platters!`
      : 'The wok fires burned out with no master chef!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Sizzling Asian Street Food Night Market
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1C0D0D');
    bgGrad.addColorStop(1, '#3B1A1A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Header
    ctx.save();
    ctx.fillStyle = '#FFD54F';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WOK STIR FRY', width / 2, 38);

    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#FF8A65';
    ctx.fillText('SHAKE WOK IN ORANGE SWEET-SPOT • TOSS DRAGON NOODLES & AVOID BURNING', width / 2, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px monospace';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);
    ctx.restore();

    // Steel prep counter
    ctx.fillStyle = '#37474F';
    ctx.fillRect(0, height * 0.72, width, height * 0.28);

    // Render Woks & Noodles
    for (const p of this.getActivePlayers()) {
      const chef = this.playersState.get(p.id);
      if (!chef) continue;

      ctx.save();
      const shakeOffset = Math.sin(chef.shakeAnim * Math.PI * 2) * 5;
      ctx.translate(chef.x + shakeOffset, chef.y);

      // Gas Burner Flame underneath
      ctx.fillStyle = '#FF5722';
      ctx.beginPath();
      ctx.arc(0, 30, 20, 0, Math.PI);
      ctx.fill();

      // Carbon Steel Wok Pan
      ctx.fillStyle = '#212121';
      ctx.beginPath();
      ctx.arc(0, 16, 42, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#424242';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Wooden Handle
      ctx.fillStyle = '#795548';
      ctx.fillRect(36, 10, 28, 8);

      // Airborne Noodles & Scallions
      const noodleY = 10 - chef.tossAltitude;
      ctx.fillStyle = '#FFD54F';
      ctx.beginPath();
      ctx.ellipse(0, noodleY, 30, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Green scallions
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(-10, noodleY - 4, 5, 4);
      ctx.fillRect(8, noodleY - 3, 5, 4);

      ctx.restore();

      // Wok Flame Heat Bar
      const barW = 75;
      const barH = 8;
      ctx.fillStyle = '#263238';
      ctx.fillRect(chef.x - barW / 2, chef.y - 75, barW, barH);
      ctx.strokeStyle = '#546E7A';
      ctx.strokeRect(chef.x - barW / 2, chef.y - 75, barW, barH);

      // Sweet spot bracket [65% to 88%]
      ctx.fillStyle = 'rgba(76, 175, 80, 0.4)';
      ctx.fillRect(chef.x - barW / 2 + barW * 0.65, chef.y - 75, barW * 0.23, barH);

      // Heat Fill
      const heatW = (chef.heat / 100) * barW;
      ctx.fillStyle = chef.heat > 88 ? '#FF1744' : chef.heat > 65 ? '#4CAF50' : '#FF9800';
      ctx.fillRect(chef.x - barW / 2, chef.y - 75, heatW, barH);

      if (chef.burnTimer > 0) {
        ctx.fillStyle = '#FF1744';
        ctx.font = '900 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BURNT! -10', chef.x, chef.y - 85);
      }

      // Score Badge
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(chef.x - 45, chef.y + 36, 90, 28, 5);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${chef.score}`, chef.x, chef.y + 50);
      ctx.font = '700 8px monospace';
      ctx.fillText(`Dishes: ${chef.dishesPrepared}`, chef.x, chef.y + 60);
    }
  }
}
