import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Card {
  id: number;
  rank: string;
  value: number;
  suit: 'spade' | 'heart' | 'diamond' | 'club';
  x: number;
  claimed: boolean;
}

interface PlayerHand {
  cards: { rank: string; suit: string; value: number }[];
  score: number;
}

export class WesternPokerGame extends BaseGame {
  private hands: Map<PlayerId, PlayerHand> = new Map();
  private riverCards: Card[] = [];
  private spawnTimer: number = 0;
  private nextCardId: number = 1;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.hands.clear();
    this.riverCards = [];
    this.spawnTimer = 0.4;
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.hands.set(p.id, {
        cards: [],
        score: 0
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    this.updateBots(dt, width, height);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.0 + Math.random() * 0.5;
      const ranks = ['A', 'K', 'Q', 'J', '10', '9'];
      const values = [14, 13, 12, 11, 10, 9];
      const suits: ('spade' | 'heart' | 'diamond' | 'club')[] = ['spade', 'heart', 'diamond', 'club'];

      const rIdx = Math.floor(Math.random() * ranks.length);
      const sIdx = Math.floor(Math.random() * suits.length);

      this.riverCards.push({
        id: this.nextCardId++,
        rank: ranks[rIdx],
        value: values[rIdx],
        suit: suits[sIdx],
        x: -50,
        claimed: false
      });
    }

    const riverY = height / 2;
    for (const card of this.riverCards) {
      if (card.claimed) continue;
      card.x += 160 * dt;
    }

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const hand = this.hands.get(p.id);
      if (!hand || hand.cards.length >= 5) continue;

      if (this.input.justPressed(p.id)) {
        const targetX = this.getClaimTargetX(i, width);
        const cardToClaim = this.riverCards.find(c => !c.claimed && Math.abs(c.x - targetX) < 45);

        if (cardToClaim) {
          cardToClaim.claimed = true;
          hand.cards.push({ rank: cardToClaim.rank, suit: cardToClaim.suit, value: cardToClaim.value });
          this.calculateHandScore(hand);
          this.particles.emit(cardToClaim.x, riverY, 8, '#FBBF24');
          this.audio.playTone(550, 0.08, 'sine');
        } else {
          this.audio.playTone(200, 0.05, 'triangle');
        }
      }
    }

    this.riverCards = this.riverCards.filter(c => !c.claimed && c.x < width + 60);

    const allFull = Array.from(this.hands.values()).every(h => h.cards.length >= 5);
    if (allFull) {
      this.isFinished = true;
    }
  }

  private calculateHandScore(hand: PlayerHand): void {
    if (hand.cards.length === 0) return;

    const rankCounts: { [key: string]: number } = {};
    const suitCounts: { [key: string]: number } = {};

    for (const c of hand.cards) {
      rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
      suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
    }

    let score = hand.cards.reduce((sum, c) => sum + c.value, 0);

    const counts = Object.values(rankCounts);
    if (counts.includes(4)) {
      score += 40;
    } else if (counts.includes(3)) {
      score += 25;
    } else if (counts.filter(c => c === 2).length >= 2) {
      score += 20;
    } else if (counts.includes(2)) {
      score += 10;
    }

    const suitMax = Math.max(...Object.values(suitCounts));
    if (suitMax >= 4) {
      score += 30;
    }

    hand.score = score;
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, _height: number): void {
    const active = this.getActivePlayers();
    const i = active.findIndex(p => p.id === botId);
    if (i === -1) return;

    const hand = this.hands.get(botId);
    if (!hand || hand.cards.length >= 5) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false);
      return;
    }

    const targetX = this.getClaimTargetX(i, width);
    const grabTolerance = difficulty === 'bot_easy' ? 18 : difficulty === 'bot_normal' ? 28 : 34;
    const closeCard = this.riverCards.find(c => !c.claimed && Math.abs(c.x - targetX) < grabTolerance);

    if (closeCard) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  private getClaimTargetX(index: number, width: number): number {
    const slots = [
      width * 0.25,
      width * 0.75,
      width * 0.35,
      width * 0.65
    ];
    return slots[index] || width / 2;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#064E3B';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    const riverY = height / 2;

    ctx.fillStyle = '#047857';
    ctx.fillRect(20, riverY - 40, width - 40, 80);
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, riverY - 40, width - 40, 80);

    for (const c of this.riverCards) {
      if (c.claimed) continue;
      this.drawCard(ctx, c.x, riverY, c.rank, c.suit);
    }

    const positions = [
      { x: width * 0.25, y: 70 },
      { x: width * 0.75, y: 70 },
      { x: width * 0.25, y: height - 70 },
      { x: width * 0.75, y: height - 70 }
    ];

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const pos = positions[i] || positions[0];
      const hand = this.hands.get(p.id);
      if (!hand) continue;

      const claimX = this.getClaimTargetX(i, width);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(claimX - 25, riverY - 35, 50, 70);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(pos.x - 110, pos.y - 30, 220, 60);

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(pos.x - 90, pos.y, 12, 0, Math.PI * 2);
      ctx.fill();

      for (let j = 0; j < hand.cards.length; j++) {
        const hc = hand.cards[j];
        this.drawCard(ctx, pos.x - 55 + j * 32, pos.y, hc.rank, hc.suit as any, 0.75);
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${p.name}: ${hand.score} pts`, pos.x - 70, pos.y - 12);
    }

    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`WESTERN POKER SHOWDOWN: ${Math.ceil(this.roundTimer)}s`, width / 2, 25);
  }

  private drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, rank: string, suit: 'spade' | 'heart' | 'diamond' | 'club', scale: number = 1): void {
    const w = 42 * scale;
    const h = 58 * scale;

    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = '#1F2937';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    ctx.fillStyle = suit === 'heart' || suit === 'diamond' ? '#DC2626' : '#111827';
    ctx.font = `bold ${Math.floor(13 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(rank, 0, -2 * scale);

    let suitSymbol = '♠';
    if (suit === 'heart') suitSymbol = '♥';
    else if (suit === 'diamond') suitSymbol = '♦';
    else if (suit === 'club') suitSymbol = '♣';

    ctx.font = `${Math.floor(12 * scale)}px sans-serif`;
    ctx.fillText(suitSymbol, 0, 16 * scale);

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.hands.get(p.id)?.score || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} assembled the ultimate winning poker hand!` : 'The poker chips settled in a draw!'
    };
  }
}
