import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface TableCard {
  id: number;
  rank: 'A' | 'K' | 'Q' | 'J' | '10' | '9';
  suit: 'spade' | 'heart' | 'diamond' | 'club';
  value: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  collected: boolean;
}

interface ChipPot {
  id: number;
  type: 'gold_stack' | 'silver_stack' | 'diamond_pot';
  value: number;
  x: number;
  y: number;
  radius: number;
  pulsePhase: number;
  collected: boolean;
}

interface GamblerPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  cards: { rank: string; suit: string; value: number }[];
  chargeTime: number; // 0 to 1.3s
  isCharging: boolean;
  overheatTimer: number;
  scoopTimer: number;
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
  handRankName: string;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  feltColor: string;
  feltPattern: string;
  tableRail: string;
  railBorder: string;
  cardBack: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Grand Saloon Green Felt',
    icon: '🃏',
    bgGradTop: '#064E3B',
    bgGradBottom: '#022C22',
    feltColor: '#047857',
    feltPattern: '#065F46',
    tableRail: '#78350F',
    railBorder: '#D97706',
    cardBack: '#1D4ED8'
  },
  {
    name: 'Midnight Velvet Club',
    icon: '🍷',
    bgGradTop: '#4C0519',
    bgGradBottom: '#1F0208',
    feltColor: '#881337',
    feltPattern: '#700D28',
    tableRail: '#18181B',
    railBorder: '#F59E0B',
    cardBack: '#BE123C'
  },
  {
    name: 'Deadwood Gold Mine',
    icon: '⛏️',
    bgGradTop: '#451A03',
    bgGradBottom: '#1C0A00',
    feltColor: '#92400E',
    feltPattern: '#78350F',
    tableRail: '#571C0C',
    railBorder: '#FBBF24',
    cardBack: '#B45309'
  }
];

export class WesternPokerGame extends BaseGame {
  private gamblers: Map<PlayerId, GamblerPlayer> = new Map();
  private tableCards: TableCard[] = [];
  private chipPots: ChipPot[] = [];
  private nextEntityId = 1;

  private cardSpawnTimer = 0;
  private potSpawnTimer = 0;
  private currentThemeIndex = 0;
  private screenShake = 0;
  private hitStopTimer = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private announcementText = '';
  private announcementTimer = 0;

  private keydownHandler?: (e: KeyboardEvent) => void;
  private clickHandler?: (e: MouseEvent) => void;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
    this.setupListeners();
  }

  private setupListeners(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === '1') {
        this.setTheme(0);
      } else if (e.key === '2') {
        this.setTheme(1);
      } else if (e.key === '3') {
        this.setTheme(2);
      }
    };
    window.addEventListener('keydown', this.keydownHandler);

    this.clickHandler = (e: MouseEvent) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const canvasHeight = canvas.height;
      if (clickX >= 20 && clickX <= 190 && clickY >= canvasHeight - 44 && clickY <= canvasHeight - 12) {
        this.cycleTheme();
      }
    };
    window.addEventListener('click', this.clickHandler);
  }

  public cycleTheme(): void {
    this.currentThemeIndex = (this.currentThemeIndex + 1) % THEMES.length;
    this.audio.playTap();
  }

  public setTheme(idx: number): void {
    if (idx >= 0 && idx < THEMES.length) {
      this.currentThemeIndex = idx;
      this.audio.playTap();
    }
  }

  public override destroy(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = undefined;
    }
    if (this.clickHandler) {
      window.removeEventListener('click', this.clickHandler);
      this.clickHandler = undefined;
    }
    super.destroy();
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.gamblers.clear();
    this.tableCards = [];
    this.chipPots = [];
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.announcementText = '';
    this.announcementTimer = 0;
    this.cardSpawnTimer = 0.4;
    this.potSpawnTimer = 1.8;
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const tableRadiusX = width * 0.38;
    const tableRadiusY = height * 0.32;
    const cx = width / 2;
    const cy = height / 2 + 10;

    for (let i = 0; i < count; i++) {
      const p = active[i];
      const angle = (i * 2 * Math.PI) / count - Math.PI / 2;
      const spawnX = cx + Math.cos(angle) * (tableRadiusX * 0.75);
      const spawnY = cy + Math.sin(angle) * (tableRadiusY * 0.75);

      this.gamblers.set(p.id, {
        id: p.id,
        x: spawnX,
        y: spawnY,
        vx: 0,
        vy: 0,
        angle: angle + Math.PI,
        score: 0,
        cards: [],
        chargeTime: 0,
        isCharging: false,
        overheatTimer: 0,
        scoopTimer: 0,
        stunTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: 0,
        sabotageCount: 0,
        handRankName: 'High Card'
      });
      this.botReactionTimers.set(p.id, 0);
    }

    // Seed initial cards and chip stacks on the table
    for (let i = 0; i < 6; i++) {
      this.spawnCard(width, height);
    }
    for (let i = 0; i < 3; i++) {
      this.spawnChipPot(width, height);
    }
  }

  private spawnCard(width: number, height: number): void {
    const ranks: ('A' | 'K' | 'Q' | 'J' | '10' | '9')[] = ['A', 'K', 'Q', 'J', '10', '9'];
    const values = [14, 13, 12, 11, 10, 9];
    const suits: ('spade' | 'heart' | 'diamond' | 'club')[] = ['spade', 'heart', 'diamond', 'club'];

    const rIdx = Math.floor(Math.random() * ranks.length);
    const sIdx = Math.floor(Math.random() * suits.length);

    const cx = width / 2;
    const cy = height / 2 + 10;
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * (Math.min(width, height) * 0.28);

    this.tableCards.push({
      id: this.nextEntityId++,
      rank: ranks[rIdx],
      suit: suits[sIdx],
      value: values[rIdx],
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 30,
      vy: (Math.random() - 0.5) * 30,
      rotation: (Math.random() - 0.5) * 0.8,
      rotSpeed: (Math.random() - 0.5) * 0.5,
      collected: false
    });
  }

  private spawnChipPot(width: number, height: number): void {
    const isSuddenDeath = this.roundTimer <= 12.0;
    const cx = width / 2;
    const cy = height / 2 + 10;
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * (Math.min(width, height) * 0.26);

    const roll = Math.random();
    let type: 'gold_stack' | 'silver_stack' | 'diamond_pot' = 'gold_stack';
    let value = 25;
    let radius = 14;

    if (isSuddenDeath && roll < 0.3) {
      type = 'diamond_pot';
      value = 75;
      radius = 18;
    } else if (roll < 0.45) {
      type = 'silver_stack';
      value = 45;
      radius = 16;
    }

    this.chipPots.push({
      id: this.nextEntityId++,
      type,
      value,
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      radius,
      pulsePhase: Math.random() * Math.PI * 2,
      collected: false
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }
    if (this.announcementTimer > 0) {
      this.announcementTimer -= dt;
    }

    this.updateBots(dt, width, height);

    const isSuddenDeath = this.roundTimer <= 12.0;
    const cx = width / 2;
    const cy = height / 2 + 10;
    const tableRadiusX = width * 0.38;
    const tableRadiusY = height * 0.32;

    // Highest score for Underdog
    let maxScore = -1;
    this.gamblers.forEach(g => { if (g.score > maxScore) maxScore = g.score; });

    // 1. Spawner
    this.cardSpawnTimer -= dt;
    if (this.cardSpawnTimer <= 0 && this.tableCards.length < 10) {
      this.cardSpawnTimer = (isSuddenDeath ? 0.6 : 1.0) + Math.random() * 0.4;
      this.spawnCard(width, height);
    }

    this.potSpawnTimer -= dt;
    if (this.potSpawnTimer <= 0 && this.chipPots.length < 5) {
      this.potSpawnTimer = (isSuddenDeath ? 1.4 : 2.5) + Math.random() * 0.6;
      this.spawnChipPot(width, height);
    }

    // 2. Update Table Cards
    for (const card of this.tableCards) {
      card.x += card.vx * dt;
      card.y += card.vy * dt;
      card.rotation += card.rotSpeed * dt;
      card.vx *= 0.96;
      card.vy *= 0.96;
    }

    // 3. Update Gamblers
    const active = this.getActivePlayers();
    for (const p of active) {
      const g = this.gamblers.get(p.id);
      if (!g) continue;

      g.animTimer += dt;

      if (g.scoopTimer > 0) {
        g.scoopTimer -= dt;
      }
      if (g.streakTimer > 0) {
        g.streakTimer -= dt;
        if (g.streakTimer <= 0) {
          g.streakCount = 0;
        }
      }

      // Stun
      if (g.stunTimer > 0) {
        g.stunTimer -= dt;
        g.vx *= 0.88;
        g.vy *= 0.88;
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        g.mood = 'shocked';
        continue;
      }

      if (g.overheatTimer > 0) {
        g.overheatTimer -= dt;
      }

      const isUnderdog = maxScore - g.score >= 35;

      // Inputs
      const steerX = this.input.getSteer(p.id);
      const throttleY = -this.input.getThrottle(p.id);
      const actionPressed = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      // Felt running physics
      let maxSpeed = 230;
      let accel = 750;
      if (isUnderdog) {
        maxSpeed *= 1.25;
        accel *= 1.25;
      }

      if (steerX !== 0 || throttleY !== 0) {
        g.vx += steerX * accel * dt;
        g.vy += throttleY * accel * dt;
        g.angle = Math.atan2(throttleY, steerX);
      } else {
        g.vx *= 0.90;
        g.vy *= 0.90;
      }

      const curSpeed = Math.hypot(g.vx, g.vy);
      if (curSpeed > maxSpeed) {
        g.vx = (g.vx / curSpeed) * maxSpeed;
        g.vy = (g.vy / curSpeed) * maxSpeed;
      }

      g.x += g.vx * dt;
      g.y += g.vy * dt;

      // Keep within table oval boundary
      const normX = (g.x - cx) / tableRadiusX;
      const normY = (g.y - cy) / tableRadiusY;
      const distFromCenter = Math.hypot(normX, normY);

      if (distFromCenter > 0.92) {
        const edgeAngle = Math.atan2(normY, normX);
        g.x = cx + Math.cos(edgeAngle) * (tableRadiusX * 0.92);
        g.y = cy + Math.sin(edgeAngle) * (tableRadiusY * 0.92);
        g.vx *= -0.5;
        g.vy *= -0.5;
      }

      // Hold-to-Charge Felt Scoop & Sweet Spot (72%–98%)
      if (g.overheatTimer <= 0 && g.stunTimer <= 0) {
        if (actionPressed) {
          g.isCharging = true;
          g.chargeTime += dt;
          g.mood = 'focused';

          if (Math.random() < 0.3) {
            this.particles.emit(g.x, g.y, 2, '#FBBF24');
          }

          if (g.chargeTime > 1.25) {
            // Overheat chip fumble
            g.isCharging = false;
            g.chargeTime = 0;
            g.overheatTimer = 0.85;
            g.stunTimer = 0.6;
            g.mood = 'shocked';
            this.audio.playBounce();
            this.particles.emit(g.x, g.y, 14, '#EF4444');
            this.triggerAnnouncement(`${p.name} Fumbled Their Chips!`, 1.1);
          }
        } else if (!actionPressed && g.isCharging) {
          g.isCharging = false;
          const ratio = g.chargeTime / 1.0;
          const sweetMin = isUnderdog ? 0.50 : 0.72;
          const sweetMax = isUnderdog ? 1.05 : 0.98;

          g.scoopTimer = 0.35;

          if (ratio >= sweetMin && ratio <= sweetMax) {
            // FELT SCOOP SWEET SPOT!
            g.mood = 'triumph';
            g.streakCount++;
            g.streakTimer = 4.0;
            const streakMult = Math.min(3.0, 1.0 + (g.streakCount - 1) * 0.5);
            const aceBonus = Math.floor(25 * streakMult * (isSuddenDeath ? 2 : 1));
            g.score += aceBonus;

            this.screenShake = 9;
            this.audio.playFanfare();
            this.particles.emit(g.x, g.y, 22, '#F59E0B');
            this.triggerAnnouncement(`★ ROYAL FELT SCOOP ACE! +${aceBonus} ★`, 1.3);

            // Large scoop area
            this.performScoop(g, true, isUnderdog, isSuddenDeath, p.name);
          } else {
            // Short scoop
            this.audio.playTap();
            this.performScoop(g, false, isUnderdog, isSuddenDeath, p.name);
            g.mood = 'idle';
          }
          g.chargeTime = 0;
        }
      }

      if (!g.isCharging && g.stunTimer <= 0 && g.scoopTimer <= 0) {
        g.mood = 'idle';
      }
    }

    // 4. Elastic Elbow Felt Shunts Between Gamblers
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const p1 = active[i];
        const p2 = active[j];
        const g1 = this.gamblers.get(p1.id);
        const g2 = this.gamblers.get(p2.id);
        if (!g1 || !g2) continue;

        const dx = g2.x - g1.x;
        const dy = g2.y - g1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 34;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;

          const g1Scoop = g1.scoopTimer > 0;
          const g2Scoop = g2.scoopTimer > 0;

          if (g1Scoop && !g2Scoop) {
            // G1 elbows G2!
            g2.stunTimer = 0.65;
            g2.score = Math.max(0, g2.score - 10);
            g2.vx = nx * 340;
            g2.vy = ny * 340;
            g2.mood = 'shocked';

            const pts = isSuddenDeath ? 60 : 30;
            g1.score += pts;
            g1.sabotageCount++;
            g1.mood = 'triumph';

            // Knock a card loose from rival's hand if they have cards!
            if (g2.cards.length > 0) {
              const dropped = g2.cards.pop()!;
              this.tableCards.push({
                id: this.nextEntityId++,
                rank: dropped.rank as any,
                suit: dropped.suit as any,
                value: dropped.value,
                x: g2.x + nx * 30,
                y: g2.y + ny * 30,
                vx: nx * 100,
                vy: ny * 100,
                rotation: Math.random() * Math.PI,
                rotSpeed: 2,
                collected: false
              });
              this.recalculateHand(g2);
            }

            this.screenShake = 11;
            this.hitStopTimer = 0.04;
            this.audio.playBounce();
            this.particles.emit((g1.x + g2.x) / 2, (g1.y + g2.y) / 2, 18, '#F59E0B');
            this.triggerAnnouncement(`ELBOW FELT SHUNT! +${pts} Sabotage!`, 1.1);
          } else if (g2Scoop && !g1Scoop) {
            g1.stunTimer = 0.65;
            g1.score = Math.max(0, g1.score - 10);
            g1.vx = -nx * 340;
            g1.vy = -ny * 340;
            g1.mood = 'shocked';

            const pts = isSuddenDeath ? 60 : 30;
            g2.score += pts;
            g2.sabotageCount++;
            g2.mood = 'triumph';

            if (g1.cards.length > 0) {
              const dropped = g1.cards.pop()!;
              this.tableCards.push({
                id: this.nextEntityId++,
                rank: dropped.rank as any,
                suit: dropped.suit as any,
                value: dropped.value,
                x: g1.x - nx * 30,
                y: g1.y - ny * 30,
                vx: -nx * 100,
                vy: -ny * 100,
                rotation: Math.random() * Math.PI,
                rotSpeed: 2,
                collected: false
              });
              this.recalculateHand(g1);
            }

            this.screenShake = 11;
            this.hitStopTimer = 0.04;
            this.audio.playBounce();
            this.particles.emit((g1.x + g2.x) / 2, (g1.y + g2.y) / 2, 18, '#F59E0B');
            this.triggerAnnouncement(`ELBOW FELT SHUNT! +${pts} Sabotage!`, 1.1);
          } else {
            const overlap = (minDist - dist) * 0.5;
            g1.x -= nx * overlap;
            g1.y -= ny * overlap;
            g2.x += nx * overlap;
            g2.y += ny * overlap;

            const kx = g1.vx - g2.vx;
            const ky = g1.vy - g2.vy;
            const p = 2 * (nx * kx + ny * ky) / 2;
            g1.vx -= p * nx * 0.8;
            g1.vy -= p * ny * 0.8;
            g2.vx += p * nx * 0.8;
            g2.vy += p * ny * 0.8;

            this.audio.playBounce();
            this.particles.emit((g1.x + g2.x) / 2, (g1.y + g2.y) / 2, 6, '#FBBF24');
          }
        }
      }
    }

    // 5. Cleanup collected entities
    this.tableCards = this.tableCards.filter(c => !c.collected);
    this.chipPots = this.chipPots.filter(cp => !cp.collected);
  }

  private performScoop(g: GamblerPlayer, isSweet: boolean, isUnderdog: boolean, isSuddenDeath: boolean, playerName: string): void {
    const radius = isSweet ? 54 : 32;

    // Check table cards
    for (const card of this.tableCards) {
      if (card.collected) continue;
      const d = Math.hypot(card.x - g.x, card.y - g.y);
      if (d < radius && g.cards.length < 5) {
        card.collected = true;
        g.cards.push({ rank: card.rank, suit: card.suit, value: card.value });
        this.recalculateHand(g);
        this.audio.playScore();
        this.particles.emit(card.x, card.y, 14, '#FDE047');
        this.triggerAnnouncement(`${playerName} Drafted ${card.rank} of ${card.suit.toUpperCase()}S!`, 0.9);
      }
    }

    // Check chip pots
    for (const pot of this.chipPots) {
      if (pot.collected) continue;
      const d = Math.hypot(pot.x - g.x, pot.y - g.y);
      if (d < radius + pot.radius) {
        pot.collected = true;
        const mult = Math.min(3.0, 1.0 + g.streakCount * 0.5);
        const pts = Math.floor(pot.value * mult * (isSuddenDeath ? 2 : 1));
        g.score += pts;
        this.audio.playScore();
        const col = pot.type === 'diamond_pot' ? '#38BDF8' : '#F59E0B';
        this.particles.emit(pot.x, pot.y, 18, col);
        this.triggerAnnouncement(`${playerName} Scooped ${pot.type.replace('_', ' ').toUpperCase()}! +${pts}`, 0.9);
      }
    }
  }

  private recalculateHand(g: GamblerPlayer): void {
    if (g.cards.length === 0) {
      g.handRankName = 'High Card';
      return;
    }

    const rankCounts: { [key: string]: number } = {};
    const suitCounts: { [key: string]: number } = {};
    let baseScore = 0;

    for (const c of g.cards) {
      rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
      suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
      baseScore += c.value;
    }

    const counts = Object.values(rankCounts);
    const maxSuit = Math.max(...Object.values(suitCounts));

    let handBonus = 0;
    if (counts.includes(4)) {
      handBonus = 70;
      g.handRankName = 'Four of a Kind!';
    } else if (counts.includes(3) && counts.includes(2)) {
      handBonus = 55;
      g.handRankName = 'Full House!';
    } else if (maxSuit >= 5) {
      handBonus = 50;
      g.handRankName = 'Flush!';
    } else if (counts.includes(3)) {
      handBonus = 35;
      g.handRankName = 'Three of a Kind!';
    } else if (counts.filter(c => c === 2).length >= 2) {
      handBonus = 25;
      g.handRankName = 'Two Pair!';
    } else if (counts.includes(2)) {
      handBonus = 15;
      g.handRankName = 'One Pair!';
    } else {
      g.handRankName = 'High Card';
    }

    g.score += handBonus;
  }

  private triggerAnnouncement(text: string, duration: number = 1.0): void {
    this.announcementText = text;
    this.announcementTimer = duration;
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const g = this.gamblers.get(botId);
    if (!g || g.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) + dt;
    this.botReactionTimers.set(botId, timer);

    const reactionLimit = difficulty === 'bot_easy' ? 0.42 : difficulty === 'bot_normal' ? 0.23 : 0.10;
    if (timer < reactionLimit) {
      return;
    }
    this.botReactionTimers.set(botId, 0);

    // Easy blunder
    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
      return;
    }

    let targetX = width / 2;
    let targetY = height / 2;
    let wantAction = false;

    // Prioritize cards matching current hand rank
    let bestCard: TableCard | null = null;
    let minCardDist = 320;
    for (const card of this.tableCards) {
      if (card.collected) continue;
      const d = Math.hypot(card.x - g.x, card.y - g.y);
      if (d < minCardDist) {
        minCardDist = d;
        bestCard = card;
      }
    }

    // Nearest chip pot
    let bestPot: ChipPot | null = null;
    let minPotDist = 260;
    for (const pot of this.chipPots) {
      if (pot.collected) continue;
      const d = Math.hypot(pot.x - g.x, pot.y - g.y);
      if (d < minPotDist) {
        minPotDist = d;
        bestPot = pot;
      }
    }

    // Hard rival shunting
    let rivalToShunt: GamblerPlayer | null = null;
    if (difficulty === 'bot_hard') {
      let minRivalDist = 130;
      for (const [id, r] of this.gamblers.entries()) {
        if (id !== botId && r.stunTimer <= 0) {
          const d = Math.hypot(r.x - g.x, r.y - g.y);
          if (d < minRivalDist) {
            minRivalDist = d;
            rivalToShunt = r;
          }
        }
      }
    }

    if (bestPot && (g.cards.length >= 5 || minPotDist < minCardDist)) {
      targetX = bestPot.x;
      targetY = bestPot.y;
      if (minPotDist < 50) {
        if (difficulty === 'bot_hard') {
          if (g.chargeTime >= 0.75 && g.chargeTime <= 0.95) wantAction = false;
          else wantAction = true;
        } else {
          wantAction = false;
        }
      } else if (difficulty !== 'bot_easy') {
        wantAction = g.chargeTime < 0.8;
      }
    } else if (rivalToShunt !== null && difficulty === 'bot_hard' && bestCard === null) {
      const targetRival: GamblerPlayer = rivalToShunt;
      targetX = targetRival.x;
      targetY = targetRival.y;
      if (g.chargeTime >= 0.76 && g.chargeTime <= 0.95) {
        wantAction = false;
      } else {
        wantAction = true;
      }
    } else if (bestCard && g.cards.length < 5) {
      targetX = bestCard.x;
      targetY = bestCard.y;
      if (minCardDist < 48) {
        if (difficulty === 'bot_hard') {
          if (g.chargeTime >= 0.75 && g.chargeTime <= 0.95) wantAction = false;
          else wantAction = true;
        } else {
          wantAction = false;
        }
      } else if (difficulty !== 'bot_easy') {
        wantAction = g.chargeTime < 0.8;
      }
    } else {
      // Roam table
      targetX = width / 2 + Math.sin(Date.now() * 0.002) * (width * 0.2);
      targetY = height / 2 + Math.cos(Date.now() * 0.002) * (height * 0.15);
    }

    const dx = targetX - g.x;
    const dy = targetY - g.y;
    const dist = Math.hypot(dx, dy);
    const steerX = dist > 6 ? Math.max(-1, Math.min(1, dx / 40)) : 0;
    const throttleY = dist > 6 ? Math.max(-1, Math.min(1, dy / 40)) : 0;

    this.input.setBotInput(botId, wantAction, steerX, throttleY);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIndex];
    const cx = width / 2;
    const cy = height / 2 + 10;
    const tableRadiusX = width * 0.38;
    const tableRadiusY = height * 0.32;

    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Saloon Parlor Floor
    const bgGrad = ctx.createRadialGradient(cx, cy, 50, cx, cy, Math.max(width, height));
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Oval Saloon Poker Table
    // Outer Table Rail & Armrest
    ctx.fillStyle = theme.tableRail;
    ctx.beginPath();
    ctx.ellipse(cx, cy, tableRadiusX + 22, tableRadiusY + 22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = theme.railBorder;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Table Felt
    ctx.fillStyle = theme.feltColor;
    ctx.beginPath();
    ctx.ellipse(cx, cy, tableRadiusX, tableRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Felt Pattern Grid
    ctx.strokeStyle = theme.feltPattern;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, tableRadiusX * 0.65, tableRadiusY * 0.65, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Render Chip Pots
    for (const pot of this.chipPots) {
      ctx.save();
      ctx.translate(pot.x, pot.y);
      const bob = Math.sin(pot.pulsePhase) * 3;

      if (pot.type === 'diamond_pot') {
        // Royal Diamond Pot
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(0, bob, pot.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#BAE6FD';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💎', 0, bob + 4);
      } else {
        // Gold / Silver Chip Stack
        const col = pot.type === 'silver_stack' ? '#94A3B8' : '#F59E0B';
        const trim = pot.type === 'silver_stack' ? '#E2E8F0' : '#FEF08A';

        for (let s = 0; s < 3; s++) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.ellipse(0, bob - s * 4, pot.radius, pot.radius * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = trim;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 4. Render Table Cards
    for (const card of this.tableCards) {
      ctx.save();
      ctx.translate(card.x, card.y);
      ctx.rotate(card.rotation);

      // Card shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(-17, -23, 34, 48);

      // Card body
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(-16, -24, 32, 48, 3);
      ctx.fill();
      ctx.strokeStyle = '#1F2937';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Card rank & suit
      ctx.fillStyle = card.suit === 'heart' || card.suit === 'diamond' ? '#DC2626' : '#111827';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(card.rank, 0, -5);

      let suitSymbol = '♠';
      if (card.suit === 'heart') suitSymbol = '♥';
      else if (card.suit === 'diamond') suitSymbol = '♦';
      else if (card.suit === 'club') suitSymbol = '♣';

      ctx.font = '11px sans-serif';
      ctx.fillText(suitSymbol, 0, 12);

      ctx.restore();
    }

    // 5. Render Gamblers
    const active = this.getActivePlayers();
    let maxScore = -1;
    this.gamblers.forEach(g => { if (g.score > maxScore) maxScore = g.score; });

    for (const p of active) {
      const g = this.gamblers.get(p.id);
      if (!g) continue;

      const isUnderdog = maxScore - g.score >= 35;
      const isBot = p.type !== 'human';

      ctx.save();
      ctx.translate(g.x, g.y);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 10, 16, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Scoop Charge Ring
      if (g.isCharging) {
        const ratio = Math.min(1.0, g.chargeTime / 1.0);
        const sweetMin = isUnderdog ? 0.50 : 0.72;
        const sweetMax = isUnderdog ? 1.05 : 0.98;
        const inSweet = ratio >= sweetMin && ratio <= sweetMax;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(74, 222, 128, 0.45)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, 28, sweetMin * Math.PI * 2 - Math.PI / 2, sweetMax * Math.PI * 2 - Math.PI / 2);
        ctx.stroke();

        ctx.strokeStyle = inSweet ? '#22C55E' : '#EAB308';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 28, -Math.PI / 2, ratio * Math.PI * 2 - Math.PI / 2);
        ctx.stroke();

        if (inSweet) {
          ctx.fillStyle = '#4ADE80';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('SCOOP!', 0, -36);
        }
      }

      // Felt Scoop Swirl when scooping
      if (g.scoopTimer > 0) {
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(Math.cos(g.angle) * 20, Math.sin(g.angle) * 20, 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Mascot Gambler
      drawCharacter(
        ctx,
        0,
        0,
        14,
        p.id,
        isBot,
        g.mood,
        g.animTimer
      );

      // Carried Hand indicator above head
      if (g.cards.length > 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${g.cards.length}/5 [${g.handRankName}]`, 0, -22);
      }

      // Underdog Ace Aura
      if (isUnderdog) {
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.7)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    }

    // 6. Strict UI Layout
    const isSuddenDeath = this.roundTimer <= 12.0;
    const timerBoxX = width / 2 - 80;
    const timerBoxY = 12;
    const timerBoxW = 160;
    const timerBoxH = 32;

    ctx.fillStyle = isSuddenDeath ? 'rgba(239, 68, 68, 0.85)' : 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.roundRect(timerBoxX, timerBoxY, timerBoxW, timerBoxH, 16);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#FCA5A5' : 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      isSuddenDeath ? `⚡ ALL-IN: ${Math.ceil(this.roundTimer)}s ⚡` : `⏱️ ${Math.ceil(this.roundTimer)}s`,
      width / 2,
      timerBoxY + timerBoxH / 2
    );

    // Minigame Header Badge (y: 56, h: 28)
    const badgeW = 280;
    const badgeH = 28;
    const badgeX = width / 2 - badgeW / 2;
    const badgeY = 56;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#FDE047';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('🃏 WESTERN POKER • HIGH ROLLER BRAWL', width / 2, badgeY + badgeH / 2);

    // Announcement Pill
    if (this.announcementTimer > 0 && this.announcementText) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.beginPath();
      ctx.roundRect(width / 2 - 180, 96, 360, 32, 8);
      ctx.fill();
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FDE047';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.announcementText, width / 2, 112);
      ctx.restore();
    }

    // Theme Pill (bottom-left x: 20, y: height - 44, w: 170, h: 32)
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name} [T]`, pillX + 12, pillY + pillH / 2);

    // Player Cards at Corners (y: height - 128, 130x48px)
    active.forEach((p, idx) => {
      const g = this.gamblers.get(p.id);
      if (!g) return;

      const cardW = 130;
      const cardH = 48;
      const isRight = idx % 2 === 1;
      const isTop = idx >= 2;
      const cardX = isRight ? width - cardW - 20 : 20;
      const cardY = isTop ? height - 128 - cardH - 10 : height - 128;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(cardX + 16, cardY + 24, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.name, cardX + 32, cardY + 16);

      ctx.fillStyle = '#FDE047';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${g.score} pts`, cardX + 32, cardY + 34);

      if (g.cards.length > 0) {
        ctx.fillStyle = '#4ADE80';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${g.cards.length}/5`, cardX + cardW - 8, cardY + 34);
      }
      ctx.restore();
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.gamblers.entries()).map(([playerId, g]) => ({
      playerId,
      score: g.score
    }));
    scores.sort((a, b) => b.score - a.score);

    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null
        ? `${this.getPlayer(winnerId)?.name} assembled a legendary poker hand to win with ${scores[0].score} pts!`
        : 'The chips settled evenly across the saloon felt!'
    };
  }
}
