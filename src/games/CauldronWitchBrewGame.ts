import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export type IngredientType = 'EYE' | 'MUSHROOM' | 'WING' | 'SKULL';

interface PotionIngredient {
  type: IngredientType;
  name: string;
  color: string;
}

const INGREDIENTS: PotionIngredient[] = [
  { type: 'EYE', name: 'EYE OF NEWT', color: '#EF4444' },
  { type: 'MUSHROOM', name: 'NIGHTSHADE', color: '#A855F7' },
  { type: 'WING', name: 'BAT WING', color: '#1E293B' },
  { type: 'SKULL', name: 'CRYSTAL SKULL', color: '#38BDF8' }
];

interface WitchPlayer {
  id: PlayerId;
  targetIngredient: PotionIngredient;
  currentIndex: number;
  cycleTimer: number;
  streak: number;
  sootTimer: number;
  score: number;
}

export class CauldronWitchBrewGame extends BaseGame {
  private playersState: Map<PlayerId, WitchPlayer> = new Map();
  private steamBubbleTimer: number = 0;

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
    this.steamBubbleTimer = 0;
    this.playersState.clear();

    const active = this.getActivePlayers();
    active.forEach((p) => {
      this.playersState.set(p.id, {
        id: p.id,
        targetIngredient: this.pickRandomIngredient(),
        currentIndex: 0,
        cycleTimer: 0,
        streak: 0,
        sootTimer: 0,
        score: 0
      });
    });
  }

  private pickRandomIngredient(): PotionIngredient {
    return INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)];
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.steamBubbleTimer += dt * 5;
    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.sootTimer > 0) ps.sootTimer = Math.max(0, ps.sootTimer - dt);

      // Automatically cycle through ingredients on pedestal
      ps.cycleTimer += dt;
      if (ps.cycleTimer > 0.45) {
        ps.cycleTimer = 0;
        ps.currentIndex = (ps.currentIndex + 1) % INGREDIENTS.length;
      }

      // Tap to drop ingredient into cauldron
      const tap = this.input.justPressed(p.id);
      if (tap && ps.sootTimer <= 0) {
        const curIng = INGREDIENTS[ps.currentIndex];
        if (curIng.type === ps.targetIngredient.type) {
          // Correct potion ingredient!
          ps.streak++;
          const pts = 25 * Math.min(4, ps.streak);
          ps.score += pts;
          this.audio.playScore();
          this.particles.showFloatingText(`BREWED! +${pts}`, width / 2, height * 0.45, '#10B981', 22);
          this.particles.spawnConfetti(width / 2, height * 0.45, 12);
          ps.targetIngredient = this.pickRandomIngredient();
        } else {
          // Fizzled brew!
          ps.streak = 0;
          ps.sootTimer = 0.8;
          this.audio.playStun();
          this.particles.showFloatingText('FIZZLED!', width / 2, height * 0.45, '#EF4444', 18);
          this.particles.spawnExplosion(width / 2, height * 0.45, '#78350F', 8);
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private drawIngredientGlyph(
    ctx: CanvasRenderingContext2D,
    type: IngredientType,
    cx: number,
    cy: number,
    radius: number,
    color: string
  ): void {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;

    switch (type) {
      case 'EYE':
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.25, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'MUSHROOM':
        // Mushroom Cap
        ctx.beginPath();
        ctx.arc(cx, cy - radius * 0.2, radius, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Stem
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(cx - radius * 0.3, cy - radius * 0.2, radius * 0.6, radius * 0.9);
        break;
      case 'WING':
        // Bat Wing
        ctx.beginPath();
        ctx.moveTo(cx - radius, cy);
        ctx.lineTo(cx, cy - radius);
        ctx.lineTo(cx + radius, cy);
        ctx.lineTo(cx + radius * 0.5, cy + radius * 0.5);
        ctx.lineTo(cx, cy + radius * 0.2);
        ctx.lineTo(cx - radius * 0.5, cy + radius * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      case 'SKULL':
        ctx.beginPath();
        ctx.arc(cx, cy - radius * 0.2, radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillRect(cx - radius * 0.4, cy + radius * 0.3, radius * 0.8, radius * 0.5);
        // Eye sockets
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(cx - radius * 0.3, cy - radius * 0.1, radius * 0.2, 0, Math.PI * 2);
        ctx.arc(cx + radius * 0.3, cy - radius * 0.1, radius * 0.2, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Witch's Apothecary Cobwebbed Room
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1E1B4B');
    bgGrad.addColorStop(0.5, '#064E3B');
    bgGrad.addColorStop(1, '#022C22');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    const zoneW = width / count;

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      if (!ps) return;
      const zoneCenterX = zoneW * idx + zoneW / 2;
      const cauldronY = height * 0.62;

      // Recipe Scroll at Top of Station
      const scrollY = 90;
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.roundRect(zoneCenterX - 45, scrollY - 24, 90, 48, 8);
      ctx.fill();
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#78350F';
      ctx.font = '900 8px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RECIPE NEEDED:', zoneCenterX, scrollY - 10);
      ctx.font = '900 9px Montserrat, sans-serif';
      ctx.fillStyle = '#DC2626';
      ctx.fillText(ps.targetIngredient.name, zoneCenterX, scrollY + 16);

      // Target Recipe Glyph Icon
      this.drawIngredientGlyph(ctx, ps.targetIngredient.type, zoneCenterX, scrollY + 2, 7, ps.targetIngredient.color);

      // Heavy Iron Cauldron
      ctx.save();
      ctx.translate(zoneCenterX, cauldronY);

      // Bubbling Emerald Potion Brew Surface
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.ellipse(0, -18, 36, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Steam Bubbles rising
      ctx.fillStyle = '#A7F3D0';
      const bubOffset = (this.steamBubbleTimer + idx) % 20;
      ctx.beginPath();
      ctx.arc(-10, -24 - bubOffset, 4, 0, Math.PI * 2);
      ctx.arc(12, -28 - bubOffset, 5, 0, Math.PI * 2);
      ctx.fill();

      // Cauldron Pot Belly
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Feet & Rim
      ctx.fillStyle = '#334155';
      ctx.fillRect(-38, -20, 76, 5);
      ctx.fillRect(-24, 34, 10, 8);
      ctx.fillRect(14, 34, 10, 8);
      ctx.restore();

      // Ingredient Pedestal (cycling ingredients)
      const pedY = height - 55;
      ctx.fillStyle = '#334155';
      ctx.fillRect(zoneCenterX - 45, pedY - 14, 90, 45);
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 2;
      ctx.strokeRect(zoneCenterX - 45, pedY - 14, 90, 45);

      // Display cycling ingredient
      const curIng = INGREDIENTS[ps.currentIndex];
      this.drawIngredientGlyph(ctx, curIng.type, zoneCenterX, pedY + 8, 12, curIng.color);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 8px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAP TO DROP', zoneCenterX, pedY + 24);

      // Score
      ctx.font = '900 12px Montserrat, sans-serif';
      ctx.fillText(`${p.name}: ${ps.score}`, zoneCenterX, pedY - 24);
    });

    // 2. Header HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.sootTimer > 0) return;

    const curIng = INGREDIENTS[ps.currentIndex];
    if (curIng.type === ps.targetIngredient.type) {
      const chance = difficulty === 'bot_hard' ? 0.95 : difficulty === 'bot_normal' ? 0.75 : 0.45;
      if (Math.random() < chance) {
        this.input.setBotInput(botId, true, 0, 0, true);
      } else {
        this.input.setBotInput(botId, false, 0, 0, false);
      }
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public getScore(playerId: PlayerId): number {
    return this.playersState.get(playerId)?.score ?? 0;
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
      mvpHighlight: winnerId ? `${winnerId} concocted enchanted witch potions with arcane perfection!` : 'Tied witch brewing!'
    };
  }
}
