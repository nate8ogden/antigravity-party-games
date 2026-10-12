import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export type ArcanaGlyph = 'SUN' | 'MOON' | 'STAR' | 'BOLT' | 'EYE';

interface TarotCard {
  id: ArcanaGlyph;
  name: string;
  color: string;
}

const ARCANA_CARDS: TarotCard[] = [
  { id: 'SUN', name: 'THE SUN', color: '#F59E0B' },
  { id: 'MOON', name: 'THE MOON', color: '#38BDF8' },
  { id: 'STAR', name: 'THE STAR', color: '#A855F7' },
  { id: 'BOLT', name: 'THE TOWER', color: '#EF4444' },
  { id: 'EYE', name: 'THE EYE', color: '#10B981' }
];

interface TarotPlayer {
  id: PlayerId;
  cardIndex: number;
  sweepTimer: number;
  streak: number;
  score: number;
}

export class FortuneTellerTarotGame extends BaseGame {
  private targetCard: TarotCard = ARCANA_CARDS[0];
  private nextRevealTimer: number = 4.0;
  private playersState: Map<PlayerId, TarotPlayer> = new Map();
  private crystalBallGlow: number = 0;

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
    this.crystalBallGlow = 0;
    this.nextRevealTimer = 3.5;
    this.playersState.clear();
    this.pickNewTargetCard();

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        cardIndex: idx % ARCANA_CARDS.length,
        sweepTimer: 0,
        streak: 0,
        score: 0
      });
    });
  }

  private pickNewTargetCard(): void {
    const next = ARCANA_CARDS[Math.floor(Math.random() * ARCANA_CARDS.length)];
    this.targetCard = next;
    this.crystalBallGlow = 1.0;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    if (this.crystalBallGlow > 0) this.crystalBallGlow = Math.max(0, this.crystalBallGlow - dt * 2);

    this.nextRevealTimer -= dt;
    if (this.nextRevealTimer <= 0) {
      this.nextRevealTimer = 3.5;
      this.pickNewTargetCard();
      this.audio.playBounce();
    }

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      // Automatically cycle through cards smoothly
      ps.sweepTimer += dt;
      if (ps.sweepTimer > 0.45) {
        ps.sweepTimer = 0;
        ps.cardIndex = (ps.cardIndex + 1) % ARCANA_CARDS.length;
      }

      // Tap to lock in card
      const tap = this.input.justPressed(p.id);
      if (tap) {
        const curCard = ARCANA_CARDS[ps.cardIndex];
        if (curCard.id === this.targetCard.id) {
          // Correct Arcana Match!
          ps.streak++;
          const pts = 25 * ps.streak;
          ps.score += pts;
          this.audio.playScore();
          this.particles.showFloatingText(`MATCH! +${pts}`, width / 2, height * 0.45 - 30, curCard.color, 24);
          this.particles.spawnConfetti(width / 2, height * 0.45, 14);
          this.pickNewTargetCard();
          this.nextRevealTimer = 3.5;
        } else {
          // Mismatch!
          ps.streak = 0;
          this.audio.playStun();
          this.particles.showFloatingText('CURSE!', width / 2, height * 0.45 - 20, '#EF4444', 18);
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private drawGlyph(
    ctx: CanvasRenderingContext2D,
    glyph: ArcanaGlyph,
    cx: number,
    cy: number,
    radius: number,
    color: string
  ): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;

    switch (glyph) {
      case 'SUN':
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * (radius * 0.65), cy + Math.sin(a) * (radius * 0.65));
          ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
          ctx.stroke();
        }
        break;
      case 'MOON':
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.8, -0.6 * Math.PI, 0.6 * Math.PI, false);
        ctx.quadraticCurveTo(cx - radius * 0.1, cy, cx + Math.cos(-0.6 * Math.PI) * radius * 0.8, cy + Math.sin(-0.6 * Math.PI) * radius * 0.8);
        ctx.closePath();
        ctx.fill();
        break;
      case 'STAR':
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const aOuter = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
          const aInner = aOuter + Math.PI / 5;
          const ox = cx + Math.cos(aOuter) * radius;
          const oy = cy + Math.sin(aOuter) * radius;
          const ix = cx + Math.cos(aInner) * (radius * 0.45);
          const iy = cy + Math.sin(aInner) * (radius * 0.45);
          if (i === 0) ctx.moveTo(ox, oy);
          else ctx.lineTo(ox, oy);
          ctx.lineTo(ix, iy);
        }
        ctx.closePath();
        ctx.fill();
        break;
      case 'BOLT':
        ctx.beginPath();
        ctx.moveTo(cx + radius * 0.2, cy - radius);
        ctx.lineTo(cx - radius * 0.6, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx - radius * 0.3, cy + radius);
        ctx.lineTo(cx + radius * 0.6, cy - radius * 0.1);
        ctx.lineTo(cx, cy - radius * 0.1);
        ctx.closePath();
        ctx.fill();
        break;
      case 'EYE':
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius, radius * 0.55, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.32, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Mystical Velvet Fortune Teller Tent
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 20, width / 2, height / 2, width * 0.7);
    bgGrad.addColorStop(0, '#311042');
    bgGrad.addColorStop(0.6, '#1E082B');
    bgGrad.addColorStop(1, '#0B0212');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Center Mystic Crystal Ball Table
    const tableX = width / 2;
    const tableY = height * 0.38;

    ctx.save();
    // Heavy wooden occult table
    ctx.fillStyle = '#4C1D95';
    ctx.beginPath();
    ctx.ellipse(tableX, tableY + 36, 120, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Crystal Ball Base
    ctx.fillStyle = '#D97706';
    ctx.fillRect(tableX - 22, tableY + 12, 44, 18);

    // Glowing Crystal Ball Sphere
    const ballGrad = ctx.createRadialGradient(tableX - 8, tableY - 14, 4, tableX, tableY, 44);
    ballGrad.addColorStop(0, '#FFFFFF');
    ballGrad.addColorStop(0.3, this.targetCard.color);
    ballGrad.addColorStop(0.8, '#4C1D95');
    ballGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = ballGrad;
    ctx.shadowColor = this.targetCard.color;
    ctx.shadowBlur = 18 + this.crystalBallGlow * 18;
    ctx.beginPath();
    ctx.arc(tableX, tableY, 44, 0, Math.PI * 2);
    ctx.fill();

    // Target Vector Glyph in Crystal Ball
    this.drawGlyph(ctx, this.targetCard.id, tableX, tableY, 20, '#FFFFFF');

    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.fillStyle = this.targetCard.color;
    ctx.textAlign = 'center';
    ctx.fillText(this.targetCard.name, tableX, tableY - 54);
    ctx.restore();

    // 3. Draw Player Tarot Decks
    const active = this.getActivePlayers();
    const count = active.length;
    const zoneW = width / count;

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      if (!ps) return;
      const zoneCenterX = zoneW * idx + zoneW / 2;
      const deckY = height - 70;

      // Platform
      ctx.fillStyle = '#1E1B4B';
      ctx.fillRect(zoneCenterX - zoneW * 0.44, deckY - 14, zoneW * 0.88, 70);
      ctx.fillStyle = p.color;
      ctx.fillRect(zoneCenterX - zoneW * 0.44, deckY - 14, zoneW * 0.88, 4);

      // Score & Streak
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      const streakStr = ps.streak > 1 ? ` (x${ps.streak})` : '';
      ctx.fillText(`${p.name}: ${ps.score}${streakStr}`, zoneCenterX, deckY + 44);

      // 5 Arcana mini cards horizontal spread
      const cardW = 24;
      const cardH = 36;
      const spacing = cardW + 6;
      const startCardX = zoneCenterX - ((ARCANA_CARDS.length - 1) * spacing) / 2;

      ARCANA_CARDS.forEach((card, cIdx) => {
        const cx = startCardX + cIdx * spacing;
        const isSelected = cIdx === ps.cardIndex;

        ctx.save();
        ctx.translate(cx, deckY + 10);
        if (isSelected) {
          ctx.shadowColor = card.color;
          ctx.shadowBlur = 10;
          ctx.fillStyle = card.color;
          ctx.fillRect(-cardW / 2, -cardH / 2 - 4, cardW, cardH);
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.strokeRect(-cardW / 2, -cardH / 2 - 4, cardW, cardH);
        } else {
          ctx.fillStyle = '#312E81';
          ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH);
          ctx.strokeStyle = '#6366F1';
          ctx.lineWidth = 1;
          ctx.strokeRect(-cardW / 2, -cardH / 2, cardW, cardH);
        }

        this.drawGlyph(ctx, card.id, 0, isSelected ? -4 : 0, 8, isSelected ? '#FFFFFF' : card.color);
        ctx.restore();
      });
    });

    // 4. Header HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 35);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps) return;

    const curCard = ARCANA_CARDS[ps.cardIndex];
    if (curCard.id === this.targetCard.id) {
      // Intentional delay / accuracy based on difficulty
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
      mvpHighlight: winnerId ? `${winnerId} divined the arcana futures correctly!` : 'The crystal ball remains veiled!'
    };
  }
}
