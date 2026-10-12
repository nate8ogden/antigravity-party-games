import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SalvageBoat {
  id: PlayerId;
  x: number;
  y: number;
  craneAngle: number;
  craneSpeed: number;
  hookState: 'swinging' | 'dropping' | 'retracting';
  hookLength: number;
  hookX: number;
  hookY: number;
  caughtItem: TreasureItem | null;
  score: number;
  stunTimer: number;
}

interface TreasureItem {
  id: number;
  x: number;
  y: number;
  radius: number;
  type: 'gold_chest' | 'silver_ingot' | 'sea_urchin';
  points: number;
  weight: number;
}

export class SunkenTreasureGame extends BaseGame {
  private boats: Map<PlayerId, SalvageBoat> = new Map();
  private treasures: TreasureItem[] = [];
  private treasureIdCounter: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.boats.clear();
    this.treasures = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const x = width * 0.15 + (idx / Math.max(1, active.length - 1)) * (width * 0.7);
      this.boats.set(p.id, {
        id: p.id,
        x,
        y: height * 0.18,
        craneAngle: 0,
        craneSpeed: 1.8,
        hookState: 'swinging',
        hookLength: 30,
        hookX: x,
        hookY: height * 0.18 + 30,
        caughtItem: null,
        score: 0,
        stunTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });

    // Populate sunken treasures across the bottom seabed
    for (let i = 0; i < 14; i++) {
      const isUrchin = Math.random() < 0.3;
      const isGold = !isUrchin && Math.random() < 0.45;

      this.treasures.push({
        id: ++this.treasureIdCounter,
        x: width * 0.1 + Math.random() * (width * 0.8),
        y: height * 0.65 + Math.random() * (height * 0.25),
        radius: isUrchin ? 13 : isGold ? 16 : 12,
        type: isUrchin ? 'sea_urchin' : isGold ? 'gold_chest' : 'silver_ingot',
        points: isUrchin ? -10 : isGold ? 35 : 15,
        weight: isGold ? 1.4 : 1.0
      });
    }
  }

  public update(dt: number, _width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    this.updateBots(dt, _width, height);

    const active = this.getActivePlayers();

    for (const p of active) {
      const b = this.boats.get(p.id);
      if (!b) continue;

      if (b.stunTimer > 0) b.stunTimer -= dt;

      if (b.hookState === 'swinging') {
        b.craneAngle += b.craneSpeed * dt;
        if (b.craneAngle > Math.PI * 0.4 || b.craneAngle < -Math.PI * 0.4) {
          b.craneSpeed = -b.craneSpeed;
        }

        b.hookX = b.x + Math.sin(b.craneAngle) * b.hookLength;
        b.hookY = b.y + Math.cos(b.craneAngle) * b.hookLength;

        // Check input: Drop hook
        const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
        if (justAction && b.stunTimer <= 0) {
          b.hookState = 'dropping';
          this.audio.playTap();
        }
      } else if (b.hookState === 'dropping') {
        b.hookLength += 280 * dt;
        b.hookX = b.x + Math.sin(b.craneAngle) * b.hookLength;
        b.hookY = b.y + Math.cos(b.craneAngle) * b.hookLength;

        // Check collision with treasures
        for (let i = this.treasures.length - 1; i >= 0; i--) {
          const item = this.treasures[i];
          if (Math.hypot(b.hookX - item.x, b.hookY - item.y) < item.radius + 6) {
            b.caughtItem = item;
            b.hookState = 'retracting';
            this.treasures.splice(i, 1);
            this.audio.playBounce();
            break;
          }
        }

        // Reached bottom
        if (b.hookY > height * 0.92 || b.hookLength > height * 0.85) {
          b.hookState = 'retracting';
        }
      } else if (b.hookState === 'retracting') {
        const pullSpeed = b.caughtItem ? 200 / b.caughtItem.weight : 320;
        b.hookLength = Math.max(30, b.hookLength - pullSpeed * dt);
        b.hookX = b.x + Math.sin(b.craneAngle) * b.hookLength;
        b.hookY = b.y + Math.cos(b.craneAngle) * b.hookLength;

        if (b.hookLength <= 30) {
          // Haul landed on deck
          if (b.caughtItem) {
            if (b.caughtItem.type === 'sea_urchin') {
              b.score = Math.max(0, b.score + b.caughtItem.points);
              b.stunTimer = 1.0;
              this.audio.playExplosion();
              this.particles.emit(b.x, b.y, 8, '#37474F');
            } else {
              b.score += b.caughtItem.points;
              this.audio.playScore();
              this.particles.spawnConfetti(b.x, b.y - 10, 14);
            }
            b.caughtItem = null;
          }
          b.hookState = 'swinging';
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
    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const b = this.boats.get(botId);
    if (!b || b.hookState !== 'swinging' || b.stunTimer > 0) return;

    // Check trajectory line for treasures
    let shouldDrop = false;
    let delay = 0.25;

    for (const t of this.treasures) {
      const dx = t.x - b.x;
      const dy = t.y - b.y;
      const angleToTreasure = Math.atan2(dx, dy);

      if (Math.abs(b.craneAngle - angleToTreasure) < 0.12) {
        if (t.type === 'sea_urchin') {
          if (difficulty === 'bot_easy' && Math.random() < 0.35) shouldDrop = true; // easy bot mistake
        } else {
          shouldDrop = true;
          break;
        }
      }
    }

    if (difficulty === 'bot_easy') delay = 0.45;
    else if (difficulty === 'bot_hard') delay = 0.10;

    if (shouldDrop) {
      b.hookState = 'dropping';
      this.audio.playTap();
    }

    this.botReactionTimers.set(botId, delay);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Ocean depth gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0097A7');
    grad.addColorStop(0.3, '#006064');
    grad.addColorStop(1, '#002529');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Seabed reef
    ctx.fillStyle = '#C2B280';
    ctx.fillRect(0, height * 0.9, width, height * 0.1);

    // Render seabed treasures
    for (const t of this.treasures) {
      ctx.save();
      ctx.translate(t.x, t.y);

      if (t.type === 'sea_urchin') {
        ctx.fillStyle = '#212121';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        // Spikes
        ctx.strokeStyle = '#212121';
        ctx.lineWidth = 2;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
          ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
          ctx.stroke();
        }
      } else if (t.type === 'gold_chest') {
        ctx.fillStyle = '#FFB300';
        ctx.fillRect(-12, -8, 24, 16);
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(-10, -6, 20, 12);
        ctx.fillStyle = '#FFD54F';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Silver ingot
        ctx.fillStyle = '#ECEFF1';
        ctx.beginPath();
        ctx.moveTo(-10, 6);
        ctx.lineTo(-7, -6);
        ctx.lineTo(7, -6);
        ctx.lineTo(10, 6);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    // Render boats and winch cables
    for (const [id, b] of this.boats.entries()) {
      const p = this.players.find(pl => pl.id === id);
      const color = p ? p.color : '#00E5FF';

      // Winch steel cable
      ctx.strokeStyle = '#CFD8DC';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.hookX, b.hookY);
      ctx.stroke();

      // Hook anchor
      ctx.fillStyle = '#90A4AE';
      ctx.beginPath();
      ctx.arc(b.hookX, b.hookY, 5, 0, Math.PI * 2);
      ctx.fill();

      // If item is caught on hook
      if (b.caughtItem) {
        ctx.fillStyle = b.caughtItem.type === 'sea_urchin' ? '#212121' : '#FFD54F';
        ctx.beginPath();
        ctx.arc(b.hookX, b.hookY + 8, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Salvage boat hull
      ctx.save();
      ctx.translate(b.x, b.y);

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-20, -4);
      ctx.lineTo(-14, 8);
      ctx.lineTo(14, 8);
      ctx.lineTo(20, -4);
      ctx.closePath();
      ctx.fill();

      // Cabin
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-6, -12, 12, 8);

      ctx.restore();

      // Player Score
      ctx.fillStyle = color;
      ctx.font = 'bold 15px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${b.score} pts`, b.x, b.y - 18);
    }

    // Timer
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(this.roundTimer)}s`, width / 2, 32);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const b = this.boats.get(p.id);
      return {
        playerId: p.id,
        score: b ? b.score : 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `Player ${winnerId + 1} salvaged the pirate galleon fortune!` : 'All crane hooks pulled up rusted kelp!'
    };
  }
}
