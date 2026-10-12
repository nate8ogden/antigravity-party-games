import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface BurgerIngredient {
  id: number;
  x: number;
  y: number;
  vy: number;
  type: 'bottom_bun' | 'patty' | 'cheese' | 'lettuce' | 'top_bun' | 'trash';
  color: string;
  width: number;
  height: number;
  laneIdx: number;
}

interface BurgerPlayer {
  id: PlayerId;
  x: number;
  y: number;
  laneMinX: number;
  laneMaxX: number;
  dir: number;
  vx: number;
  plateWidth: number;
  currentStack: string[];
  burgersCompleted: number;
  score: number;
  stunTimer: number;
}

export class BurgerStackGame extends BaseGame {
  public playersState: Map<PlayerId, BurgerPlayer> = new Map();
  public currentMapName: string = 'Drive-Thru Burger Assembly Line';

  private ingredients: BurgerIngredient[] = [];
  private ingIdCounter: number = 0;
  private spawnTimer: number = 0.35;
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
    this.ingredients = [];
    this.playersState.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneW = width / count;

    active.forEach((p, idx) => {
      const minX = idx * laneW + 15;
      const maxX = (idx + 1) * laneW - 15;
      this.playersState.set(p.id, {
        id: p.id,
        x: (minX + maxX) / 2,
        y: height * 0.78,
        laneMinX: minX,
        laneMaxX: maxX,
        dir: 1,
        vx: 0,
        plateWidth: 46,
        currentStack: [],
        burgersCompleted: 0,
        score: 0,
        stunTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, _width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Spawn falling ingredients
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.35 + Math.random() * 0.25;
      this.spawnIngredient();
    }

    this.updateBots(dt, _width, height);

    const active = this.getActivePlayers();

    for (const p of active) {
      const b = this.playersState.get(p.id);
      if (!b) continue;

      if (b.stunTimer > 0) {
        b.stunTimer -= dt;
        continue;
      }

      const steer = this.input.getSteer(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      if (Math.abs(steer) > 0.2) {
        b.vx = steer * 240;
      } else {
        if (justAction) b.dir = -b.dir;
        if (b.x <= b.laneMinX + 22) b.dir = 1;
        else if (b.x >= b.laneMaxX - 22) b.dir = -1;
        b.vx = b.dir * 180;
      }

      b.x += b.vx * dt;
      b.x = Math.max(b.laneMinX + 20, Math.min(b.laneMaxX - 20, b.x));
    }

    // Move ingredients and check catch
    for (let i = this.ingredients.length - 1; i >= 0; i--) {
      const ing = this.ingredients[i];
      ing.y += ing.vy * dt;

      let caught = false;
      for (const p of active) {
        const b = this.playersState.get(p.id);
        if (!b || b.stunTimer > 0) continue;

        const stackTopY = b.y - 12 - b.currentStack.length * 6;
        const dx = Math.abs(ing.x - b.x);
        const dy = Math.abs(ing.y - stackTopY);

        if (dx < b.plateWidth / 2 + 10 && dy < 14) {
          caught = true;
          this.handleCatch(b, ing);
          break;
        }
      }

      if (caught || ing.y > height * 0.85) {
        this.ingredients.splice(i, 1);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private spawnIngredient(): void {
    const active = this.getActivePlayers();
    if (active.length === 0) return;

    const target = active[Math.floor(Math.random() * active.length)];
    const b = this.playersState.get(target.id);
    if (!b) return;

    const roll = Math.random();
    let type: BurgerIngredient['type'] = 'patty';
    let color = '#795548';

    if (roll < 0.25) {
      type = 'bottom_bun';
      color = '#FFB74D';
    } else if (roll < 0.45) {
      type = 'patty';
      color = '#5D4037';
    } else if (roll < 0.65) {
      type = 'cheese';
      color = '#FFD54F';
    } else if (roll < 0.80) {
      type = 'lettuce';
      color = '#66BB6A';
    } else if (roll < 0.92) {
      type = 'top_bun';
      color = '#FFA726';
    } else {
      type = 'trash';
      color = '#78909C';
    }

    this.ingredients.push({
      id: ++this.ingIdCounter,
      x: b.laneMinX + 25 + Math.random() * (b.laneMaxX - b.laneMinX - 50),
      y: 90,
      vy: 140 + Math.random() * 80,
      type,
      color,
      width: type.includes('bun') ? 34 : 30,
      height: 7,
      laneIdx: active.indexOf(target)
    });
  }

  private handleCatch(b: BurgerPlayer, ing: BurgerIngredient): void {
    if (ing.type === 'trash') {
      b.currentStack = [];
      b.score = Math.max(0, b.score - 10);
      b.stunTimer = 1.0;
      this.audio.playExplosion();
      this.particles.emit(b.x, b.y, 10, '#546E7A');
      return;
    }

    // Add ingredient to stack
    b.currentStack.push(ing.type);
    b.score += 5;
    this.audio.playTap();
    this.particles.emit(b.x, b.y - b.currentStack.length * 6, 3, ing.color);

    // If top bun is caught on a stack of 3+ items: BURGER COMPLETE!
    if (ing.type === 'top_bun' && b.currentStack.length >= 3) {
      b.burgersCompleted++;
      b.score += 35;
      b.currentStack = [];
      this.audio.playScore();
      this.particles.spawnConfetti(b.x, b.y - 20, 16);
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

    const b = this.playersState.get(botId);
    if (!b || b.stunTimer > 0) return;

    const laneItems = this.ingredients
      .filter(i => i.x >= b.laneMinX && i.x <= b.laneMaxX && i.y < b.y)
      .sort((a, b) => b.y - a.y);

    let targetX = (b.laneMinX + b.laneMaxX) / 2;

    if (laneItems.length > 0) {
      const item = laneItems[0];
      if (item.type === 'trash') {
        // Easy bots blunder 25% of the time and fail to dodge trash
        const blunders = difficulty === 'bot_easy' ? Math.random() < 0.25 : false;
        if (blunders) {
          targetX = item.x;
        } else {
          targetX = item.x > b.x ? b.laneMinX + 25 : b.laneMaxX - 25;
        }
      } else {
        // Easy bots occasionally miss ingredients
        const misses = difficulty === 'bot_easy' ? (Math.random() - 0.5) * 40 : 0;
        targetX = item.x + misses;
      }
    }

    const dx = targetX - b.x;
    if (Math.abs(dx) > 15) {
      b.dir = dx > 0 ? 1 : -1;
    }

    let delay = 0.25;
    if (difficulty === 'bot_easy') delay = 0.50;
    else if (difficulty === 'bot_hard') delay = 0.08;

    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const b = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: b?.score || 0,
        burgers: b?.burgersCompleted || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topBurgers = scores[0]?.burgers || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} assembled ${topBurgers} deluxe burgers to conquer the kitchen!`
      : 'Drive-thru rush hour backed up with incomplete burger stacks!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Fast food kitchen diner backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1E120A');
    bgGrad.addColorStop(1, '#3E2723');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Header
    ctx.save();
    ctx.fillStyle = '#FFD54F';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BURGER STACK', width / 2, 38);

    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#FFE082';
    ctx.fillText('SLIDE TO CATCH INGREDIENTS • FINISH WITH TOP BUN • AVOID TRASH', width / 2, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px monospace';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);
    ctx.restore();

    // Lane dividers
    const active = this.getActivePlayers();
    const count = active.length;
    const laneW = width / count;

    for (let i = 1; i < count; i++) {
      const lx = i * laneW;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(lx, 90);
      ctx.lineTo(lx, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Counter floor
    ctx.fillStyle = '#37474F';
    ctx.fillRect(0, height * 0.82, width, height * 0.18);

    // Render Falling Ingredients
    for (const ing of this.ingredients) {
      ctx.fillStyle = ing.color;
      ctx.beginPath();
      ctx.roundRect(ing.x - ing.width / 2, ing.y - ing.height / 2, ing.width, ing.height, 3);
      ctx.fill();
    }

    // Render Player Platters & Stacks
    for (const p of active) {
      const b = this.playersState.get(p.id);
      if (!b) continue;

      ctx.save();

      // Platter
      ctx.fillStyle = '#ECEFF1';
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.plateWidth / 2, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Stacked layers
      b.currentStack.forEach((layer, idx) => {
        const ly = b.y - 8 - idx * 7;
        let color = '#795548';
        if (layer.includes('bun')) color = '#FFB74D';
        else if (layer === 'cheese') color = '#FFD54F';
        else if (layer === 'lettuce') color = '#66BB6A';

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(b.x - 16, ly, 32, 6, 2);
        ctx.fill();
      });

      // Score Badge
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(b.x - 45, b.y + 14, 90, 26, 4);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${b.score}`, b.x, b.y + 27);
      ctx.font = '700 8px monospace';
      ctx.fillText(`Burgers: ${b.burgersCompleted}`, b.x, b.y + 36);

      ctx.restore();
    }
  }
}
