import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type BurgerThemeId = 'drive_thru' | 'cyber_kitchen' | 'food_truck';

interface BurgerTheme {
  id: BurgerThemeId;
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  counterColor: string;
  trimColor: string;
  dispenserColor: string;
  accentColor: string;
  pattyColor: string;
}

const THEMES: Record<BurgerThemeId, BurgerTheme> = {
  drive_thru: {
    id: 'drive_thru',
    name: 'Neon Drive-Thru Diner',
    icon: '🍔',
    bgGradTop: '#211208',
    bgGradBottom: '#0e0703',
    counterColor: '#334155',
    trimColor: '#ef4444',
    dispenserColor: '#475569',
    accentColor: '#f59e0b',
    pattyColor: '#5c2c16'
  },
  cyber_kitchen: {
    id: 'cyber_kitchen',
    name: 'Mega-Bite Cyber Grill',
    icon: '⚡',
    bgGradTop: '#090e1a',
    bgGradBottom: '#03060d',
    counterColor: '#0f172a',
    trimColor: '#00f0ff',
    dispenserColor: '#0284c7',
    accentColor: '#00f0ff',
    pattyColor: '#38bdf8'
  },
  food_truck: {
    id: 'food_truck',
    name: 'Gourmet Food Truck Fest',
    icon: '🚚',
    bgGradTop: '#1a180e',
    bgGradBottom: '#0c0a05',
    counterColor: '#451a03',
    trimColor: '#f59e0b',
    dispenserColor: '#78350f',
    accentColor: '#fbbf24',
    pattyColor: '#713f12'
  }
};

const THEME_ORDER: BurgerThemeId[] = ['drive_thru', 'cyber_kitchen', 'food_truck'];

type IngredientType = 'bottom_bun' | 'patty' | 'cheese' | 'lettuce' | 'tomato' | 'wagyu' | 'top_bun' | 'trash';

interface FallingIngredient {
  id: number;
  x: number;
  y: number;
  vy: number;
  type: IngredientType;
  color: string;
  name: string;
  width: number;
  height: number;
  scoreVal: number;
  wobble: number;
}

interface BurgerChef {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  plateWidth: number;
  currentStack: IngredientType[];
  stackWobble: number;
  // Hold-to-Charge Plate Thrust
  isChargingThrust: boolean;
  thrustChargeTimer: number;
  thrustAnim: number;
  // Stats
  burgersCompleted: number;
  score: number;
  combo: number;
  stunTimer: number;
  shuntCooldown: number;
  lastShovedBy: PlayerId | null;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  animTime: number;
}

interface FloatingBurgerText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export class BurgerStackGame extends BaseGame {
  public currentTheme: BurgerThemeId = 'drive_thru';
  public playersState: Map<PlayerId, BurgerChef> = new Map();

  private ingredients: FallingIngredient[] = [];
  private ingIdCounter: number = 0;
  private spawnTimer: number = 0.35;

  private floatingTexts: FloatingBurgerText[] = [];
  private textIdCounter: number = 0;

  private botReactionTimers: Map<PlayerId, number> = new Map();
  private screenShake: number = 0;
  private hitStopTimer: number = 0;
  private animTimer: number = 0;

  private keydownHandler?: (e: KeyboardEvent) => void;
  private clickHandler?: (e: MouseEvent) => void;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 35.0;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (typeof window !== 'undefined') {
      this.keydownHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.cycleTheme();
        } else if (e.key === '1') {
          this.setTheme('drive_thru');
        } else if (e.key === '2') {
          this.setTheme('cyber_kitchen');
        } else if (e.key === '3') {
          this.setTheme('food_truck');
        }
      };
      window.addEventListener('keydown', this.keydownHandler);

      this.clickHandler = (e: MouseEvent) => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        // Theme Pill at bottom-left
        const pillX = 20;
        const pillY = canvas.height - 44;
        const pillW = 170;
        const pillH = 32;

        if (
          clickX >= pillX &&
          clickX <= pillX + pillW &&
          clickY >= pillY &&
          clickY <= pillY + pillH
        ) {
          this.cycleTheme();
        }
      };
      window.addEventListener('click', this.clickHandler);
    }
  }

  public setTheme(theme: BurgerThemeId): void {
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnSparks(105, 556, THEMES[theme].accentColor, 16);
  }

  public cycleTheme(): void {
    const curIdx = THEME_ORDER.indexOf(this.currentTheme);
    const nextIdx = (curIdx + 1) % THEME_ORDER.length;
    this.setTheme(THEME_ORDER[nextIdx]);
  }

  public override destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);
      if (this.clickHandler) window.removeEventListener('click', this.clickHandler);
    }
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.ingredients = [];
    this.playersState.clear();
    this.floatingTexts = [];
    this.botReactionTimers.clear();
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.animTimer = 0;
    this.ingIdCounter = 0;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const startX = spacing * (idx + 1);

      this.playersState.set(p.id, {
        id: p.id,
        x: startX,
        y: height * 0.74,
        vx: 0,
        plateWidth: 50,
        currentStack: ['bottom_bun'],
        stackWobble: 0,
        isChargingThrust: false,
        thrustChargeTimer: 0,
        thrustAnim: 0,
        burgersCompleted: 0,
        score: 0,
        combo: 0,
        stunTimer: 0,
        shuntCooldown: 0,
        lastShovedBy: null,
        isUnderdog: false,
        currentMood: 'idle',
        animTime: 0
      });

      this.botReactionTimers.set(p.id, 0.2);
    });

    // Spawn 3 initial ingredients
    for (let i = 0; i < 3; i++) {
      this.spawnIngredient(width);
    }
  }

  private addFloatingText(text: string, x: number, y: number, color: string, size: number = 14): void {
    this.floatingTexts.push({
      id: ++this.textIdCounter,
      text,
      x,
      y,
      color,
      size,
      life: 0.9,
      maxLife: 0.9
    });
  }

  private spawnIngredient(width: number): void {
    const roll = Math.random();
    let type: IngredientType = 'patty';
    let color = '#5D4037';
    let name = 'PATTY';
    let scoreVal = 15;
    let w = 34;

    if (this.roundTimer <= 15 && Math.random() < 0.35) {
      type = 'wagyu';
      color = '#facc15';
      name = 'GOLDEN WAGYU';
      scoreVal = 35;
      w = 36;
    } else if (roll < 0.22) {
      type = 'patty';
      color = '#5D4037';
      name = 'PATTY';
      scoreVal = 15;
    } else if (roll < 0.40) {
      type = 'cheese';
      color = '#FFD54F';
      name = 'CHEDDAR';
      scoreVal = 10;
      w = 32;
    } else if (roll < 0.58) {
      type = 'lettuce';
      color = '#4ade80';
      name = 'LETTUCE';
      scoreVal = 10;
      w = 34;
    } else if (roll < 0.72) {
      type = 'tomato';
      color = '#ef4444';
      name = 'TOMATO';
      scoreVal = 10;
      w = 30;
    } else if (roll < 0.86) {
      type = 'top_bun';
      color = '#FFA726';
      name = 'TOP BUN';
      scoreVal = 20;
      w = 38;
    } else if (roll < 0.93) {
      type = 'wagyu';
      color = '#facc15';
      name = 'GOLDEN WAGYU';
      scoreVal = 35;
      w = 36;
    } else {
      type = 'trash';
      color = '#64748b';
      name = 'SPOILED ONION';
      scoreVal = -15;
      w = 26;
    }

    const fallSpeed = (150 + Math.random() * 80) * (this.roundTimer <= 15 ? 1.35 : 1.0);

    this.ingredients.push({
      id: ++this.ingIdCounter,
      x: 60 + Math.random() * (width - 120),
      y: 90,
      vy: fallSpeed,
      type,
      color,
      name,
      width: w,
      height: 7,
      scoreVal,
      wobble: Math.random() * Math.PI * 2
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.animTimer += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    // Floating text update
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y -= dt * 28;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Dynamic ingredient spawning
    this.spawnTimer -= dt;
    const maxIngredients = this.roundTimer <= 15 ? 8 : 6;
    if (this.spawnTimer <= 0 && this.ingredients.length < maxIngredients) {
      this.spawnTimer = this.roundTimer <= 15 ? 0.28 + Math.random() * 0.2 : 0.42 + Math.random() * 0.3;
      this.spawnIngredient(width);
    }

    // Underdog calculation
    let maxScore = -1;
    const active = this.getActivePlayers();
    for (const p of active) {
      const chef = this.playersState.get(p.id);
      if (!chef) continue;
      if (chef.score > maxScore) maxScore = chef.score;
    }
    for (const p of active) {
      const chef = this.playersState.get(p.id);
      if (!chef) continue;
      chef.isUnderdog = maxScore - chef.score >= 40 && chef.score < maxScore;
      chef.plateWidth = chef.isUnderdog ? 68 : 50;
    }

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Update chefs
    for (const p of active) {
      const chef = this.playersState.get(p.id);
      if (!chef) continue;

      chef.animTime += dt * 6;
      if (chef.thrustAnim > 0) chef.thrustAnim = Math.max(0, chef.thrustAnim - dt * 5);
      if (chef.shuntCooldown > 0) chef.shuntCooldown -= dt;

      // Stun handling
      if (chef.stunTimer > 0) {
        chef.stunTimer -= dt;
        chef.currentMood = 'shocked';
        if (chef.stunTimer <= 0) chef.currentMood = 'idle';
      }

      const steer = this.input.getSteer(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      if (chef.stunTimer <= 0) {
        // Lateral chef movement
        const moveSpeed = (chef.isUnderdog ? 290 : 230) * dt;
        chef.vx = steer * moveSpeed;
        chef.x += chef.vx;
        chef.x = Math.max(50, Math.min(width - 50, chef.x));

        // Stack wobble physics
        const stackHeight = chef.currentStack.length;
        chef.stackWobble = (chef.vx / 30) * (stackHeight * 0.15);

        // Hold-to-Charge Plate Thrust
        if (isAction) {
          chef.isChargingThrust = true;
          chef.thrustChargeTimer += dt;
          chef.currentMood = 'focused';

          if (Math.random() < 0.3) {
            this.particles.spawnSparks(chef.x, chef.y - 15, '#facc15', 1);
          }
        } else {
          // Release: Upward Tray Thrust & Shunt!
          if (chef.isChargingThrust && chef.thrustChargeTimer >= 0.12) {
            chef.isChargingThrust = false;
            chef.thrustAnim = 1.0;
            this.audio.playWhoosh();
            this.particles.spawnSparks(chef.x, chef.y - 20, '#facc15', 6);
            chef.thrustChargeTimer = 0;
          } else {
            chef.isChargingThrust = false;
            chef.thrustChargeTimer = 0;
          }
        }
      }
    }

    // Move ingredients and handle catching
    for (let i = this.ingredients.length - 1; i >= 0; i--) {
      const ing = this.ingredients[i];
      ing.y += ing.vy * dt;
      ing.wobble += dt * 4;

      let caught = false;
      for (const p of active) {
        const chef = this.playersState.get(p.id);
        if (!chef || chef.stunTimer > 0) continue;

        const stackTopY = chef.y - 12 - chef.currentStack.length * 6;
        const dx = Math.abs(ing.x - chef.x);
        const dy = Math.abs(ing.y - stackTopY);

        const catchWidth = (chef.plateWidth / 2) + (chef.isChargingThrust ? 15 : 6);

        if (dx < catchWidth && dy < 16) {
          caught = true;
          this.handleIngredientCatch(chef, ing);
          break;
        }
      }

      if (caught || ing.y > height * 0.84) {
        this.ingredients.splice(i, 1);
      }
    }

    // Inter-Chef Body Contact & Tray Shunts
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const p1 = active[i];
        const p2 = active[j];
        const c1 = this.playersState.get(p1.id);
        const c2 = this.playersState.get(p2.id);
        if (!c1 || !c2) continue;

        const dist = Math.abs(c1.x - c2.x);
        if (dist < 42) {
          const midX = (c1.x + c2.x) / 2;
          this.audio.playBounce();
          this.hitStopTimer = 0.035;
          this.screenShake = 6;
          this.particles.spawnSparks(midX, c1.y, '#f59e0b', 10);

          // Elastic separation along counter
          const pushSign = c1.x < c2.x ? -1 : 1;
          const shuntForce = 70 * (c1.isUnderdog || c2.isUnderdog ? 1.5 : 1.0);

          c1.x += pushSign * shuntForce;
          c2.x -= pushSign * shuntForce;

          const c1Strong = c1.thrustAnim > 0 || c1.isUnderdog;
          const c2Strong = c2.thrustAnim > 0 || c2.isUnderdog;

          if (c1Strong && !c2Strong && c1.shuntCooldown <= 0) {
            c1.shuntCooldown = 1.0;
            c1.score += 30;
            c2.stunTimer = 0.5;
            c2.lastShovedBy = p1.id;
            c2.currentMood = 'shocked';
            c1.currentMood = 'triumph';

            // Shunt knockoff top item if stack > 2
            if (c2.currentStack.length > 2) {
              const droppedItem = c2.currentStack.pop();
              this.addFloatingText(`💥 SHUNT! KNOCKED OFF ${droppedItem}!`, c2.x, c2.y - 35, '#ef4444', 14);
            } else {
              this.addFloatingText('💥 TRAY SHUNT! +30', midX, c1.y - 35, p1.color, 16);
            }
          } else if (c2Strong && !c1Strong && c2.shuntCooldown <= 0) {
            c2.shuntCooldown = 1.0;
            c2.score += 30;
            c1.stunTimer = 0.5;
            c1.lastShovedBy = p2.id;
            c1.currentMood = 'shocked';
            c2.currentMood = 'triumph';

            if (c1.currentStack.length > 2) {
              const droppedItem = c1.currentStack.pop();
              this.addFloatingText(`💥 SHUNT! KNOCKED OFF ${droppedItem}!`, c1.x, c1.y - 35, '#ef4444', 14);
            } else {
              this.addFloatingText('💥 TRAY SHUNT! +30', midX, c2.y - 35, p2.color, 16);
            }
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private handleIngredientCatch(chef: BurgerChef, ing: FallingIngredient): void {
    if (ing.type === 'trash') {
      if (!chef.isUnderdog) {
        chef.currentStack = ['bottom_bun'];
        chef.score = Math.max(0, chef.score - 15);
        chef.combo = 0;
        chef.stunTimer = 0.8;
        this.audio.playExplosion();
        this.screenShake = 8;
        this.particles.emit(chef.x, chef.y - 20, 10, '#64748b');
        this.addFloatingText('🗑️ TRASH HIT! STACK RUINED -15', chef.x, chef.y - 30, '#ef4444', 15);
        chef.currentMood = 'shocked';
      } else {
        this.audio.playBounce();
        this.particles.spawnSparks(chef.x, chef.y - 20, '#fbbf24', 8);
        this.addFloatingText('🛡️ UNDERDOG TRASH DEFLECT!', chef.x, chef.y - 25, '#fbbf24', 14);
      }
      return;
    }

    if (ing.type === 'top_bun') {
      // CAP THE BURGER!
      const stackLayers = chef.currentStack.length;

      if (stackLayers >= 3) {
        chef.burgersCompleted++;
        chef.combo++;

        // Base completion bonus + height multiplier
        const baseBonus = stackLayers >= 6 ? 80 : 40;
        const mult = this.roundTimer <= 15 ? 2 : 1;
        const pts = (baseBonus + stackLayers * 10 + chef.combo * 5) * mult;
        chef.score += pts;

        this.audio.playScore();
        this.audio.playFanfare();
        this.particles.spawnConfetti(chef.x, chef.y - 30, 20);

        const towerTag = stackLayers >= 6 ? '🍔 GOURMET TOWER CAPPED!' : '🍔 BURGER COMPLETE!';
        this.addFloatingText(`${towerTag} +${pts}`, chef.x, chef.y - 35, '#10b981', 17);
        chef.currentMood = 'triumph';

        // Reset with new bottom bun foundation
        chef.currentStack = ['bottom_bun'];
      } else {
        // Premature top bun with < 3 ingredients: small snack
        chef.score += 15;
        this.audio.playTap();
        this.addFloatingText('MINI SLIDER CAPPED! +15', chef.x, chef.y - 25, '#f59e0b', 13);
        chef.currentStack = ['bottom_bun'];
      }
      return;
    }

    // Add ingredient to burger stack
    chef.currentStack.push(ing.type);
    const mult = this.roundTimer <= 15 ? 2 : 1;
    const pts = ing.scoreVal * mult;
    chef.score += pts;

    if (ing.type === 'wagyu') {
      this.audio.playScore();
      this.particles.spawnSparks(chef.x, chef.y - chef.currentStack.length * 6, '#facc15', 12);
      this.addFloatingText(`💎 GOLDEN WAGYU! +${pts}`, chef.x, chef.y - 30, '#facc15', 16);
    } else {
      this.audio.playTap();
      this.particles.emit(chef.x, chef.y - chef.currentStack.length * 6, 3, ing.color);
      this.addFloatingText(`+${ing.name}`, chef.x, chef.y - 25, ing.color, 12);
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    _height: number
  ): void {
    const chef = this.playersState.get(botId);
    if (!chef || chef.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    let delay = 0.24; // Normal: 220-250ms
    let blunderChance = 0.08;
    if (difficulty === 'bot_easy') {
      delay = 0.42; // Easy: 380-450ms
      blunderChance = 0.22;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11; // Hard: 90-130ms
      blunderChance = 0.01;
    }

    // Look for approaching falling ingredients
    let targetX = chef.x;
    let shouldThrust = false;

    // Sort ingredients by closeness to chef y
    const approaching = this.ingredients
      .filter(i => i.y < chef.y && i.y > 100)
      .sort((a, b) => b.y - a.y);

    if (approaching.length > 0) {
      let targetIng = approaching[0];

      // Hard bots prioritize wagyu or top bun if stack >= 4
      if (difficulty === 'bot_hard') {
        const wagyu = approaching.find(i => i.type === 'wagyu');
        const topBun = approaching.find(i => i.type === 'top_bun' && chef.currentStack.length >= 4);
        if (wagyu) targetIng = wagyu;
        else if (topBun) targetIng = topBun;
      }

      if (targetIng.type === 'trash') {
        if (!chef.isUnderdog) {
          // Dodge away from trash
          targetX = targetIng.x > chef.x ? chef.x - 60 : chef.x + 60;
        }
      } else {
        // Move under ingredient
        targetX = targetIng.x;
        if (Math.abs(targetIng.x - chef.x) < 20 && targetIng.y > chef.y - 70) {
          shouldThrust = true;
        }
      }
    }

    // Apply blunder
    if (Math.random() < blunderChance) {
      targetX += (Math.random() - 0.5) * 120;
    }

    targetX = Math.max(50, Math.min(width - 50, targetX));
    const steerErr = targetX - chef.x;
    const steer = Math.abs(steerErr) > 12 ? (steerErr > 0 ? 1 : -1) : 0;

    this.input.setBotInput(botId, shouldThrust, steer, 0, shouldThrust);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const chef = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: chef?.score || 0,
        burgers: chef?.burgersCompleted || 0
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
      ? `Chef ${winnerId + 1} served ${topBurgers} gourmet burger towers to conquer the kitchen!`
      : 'Drive-thru rush hour ended with messy burger splats!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentTheme];

    // Screen Shake
    ctx.save();
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

    // 1. Kitchen Backdrop Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Overhead Dispensers & Stainless Pipes
    ctx.fillStyle = theme.dispenserColor;
    ctx.fillRect(0, 78, width, 12);
    for (let dx = 80; dx < width; dx += 110) {
      ctx.fillStyle = '#64748b';
      ctx.fillRect(dx - 12, 78, 24, 18);
      ctx.fillStyle = theme.accentColor;
      ctx.beginPath();
      ctx.arc(dx, 96, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Kitchen Prep Counter
    const counterY = height * 0.80;
    ctx.fillStyle = theme.counterColor;
    ctx.fillRect(0, counterY, width, height - counterY);

    ctx.fillStyle = theme.trimColor;
    ctx.fillRect(0, counterY - 6, width, 6);

    // 3. Falling Ingredients
    this.renderFallingIngredients(ctx, theme);

    // 4. Chefs, Platters, & Towering Burger Stacks
    this.renderChefs(ctx, theme);

    // 5. Floating Text FX
    this.renderFloatingTexts(ctx);

    ctx.restore(); // Screen shake end

    // 6. Safe UI Layout
    this.renderUI(ctx, width, height, theme);
  }

  private renderFallingIngredients(ctx: CanvasRenderingContext2D, theme: BurgerTheme): void {
    for (const ing of this.ingredients) {
      ctx.save();
      ctx.translate(ing.x, ing.y);

      if (ing.type === 'wagyu') {
        // Golden Wagyu Glow
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(-ing.width / 2, -ing.height / 2, ing.width, ing.height, 3);
        ctx.fill();

        ctx.fillStyle = '#78350f';
        ctx.font = '900 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('WAGYU', 0, 0);
      } else if (ing.type === 'trash') {
        // Spoiled Onion / Trash Hazard
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ef4444';
        ctx.font = '900 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✕', 0, 0);
      } else {
        // Regular Ingredient
        ctx.fillStyle = ing.type === 'patty' ? theme.pattyColor : ing.color;
        ctx.beginPath();
        ctx.roundRect(-ing.width / 2, -ing.height / 2, ing.width, ing.height, 3);
        ctx.fill();

        // Sesame seeds on top bun
        if (ing.type === 'top_bun') {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(-8, -2, 1, 0, Math.PI * 2);
          ctx.arc(0, -3, 1, 0, Math.PI * 2);
          ctx.arc(8, -2, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }
  }

  private renderChefs(ctx: CanvasRenderingContext2D, theme: BurgerTheme): void {
    const active = this.getActivePlayers();

    for (const p of active) {
      const chef = this.playersState.get(p.id);
      if (!chef) continue;

      const isBot = p.type !== 'human';

      ctx.save();
      ctx.translate(chef.x, chef.y);

      // Underdog Golden Aura
      if (chef.isUnderdog) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 1. Mascot Chef Body
      drawCharacter(
        ctx,
        0,
        0,
        14,
        p.id,
        isBot,
        chef.currentMood,
        chef.animTime,
        undefined
      );

      // Chef Apron / Hat
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -18, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-8, -14, 16, 6);

      // 2. Serving Platter held in hands
      const plateLift = chef.thrustAnim * 24;
      const plateY = -12 - plateLift;

      ctx.fillStyle = chef.isUnderdog ? '#facc15' : '#cbd5e1';
      ctx.beginPath();
      ctx.ellipse(0, plateY, chef.plateWidth / 2, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3. Towering Burger Stack on Platter
      ctx.save();
      ctx.translate(0, plateY);
      ctx.rotate(chef.stackWobble);

      chef.currentStack.forEach((layer, idx) => {
        const ly = -5 - idx * 7;
        let col = '#5D4037';
        let w = 34;

        if (layer.includes('bun')) {
          col = '#FFA726';
          w = 38;
        } else if (layer === 'cheese') {
          col = '#FFD54F';
          w = 32;
        } else if (layer === 'lettuce') {
          col = '#4ade80';
          w = 34;
        } else if (layer === 'tomato') {
          col = '#ef4444';
          w = 30;
        } else if (layer === 'wagyu') {
          col = '#facc15';
          w = 36;
        }

        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.roundRect(-w / 2, ly, w, 6, 2);
        ctx.fill();
      });

      ctx.restore();

      // Charge Arc Ring
      if (chef.isChargingThrust) {
        const prog = Math.min(1.0, chef.thrustChargeTimer / 1.0);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      // Overhead Tag
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`P${p.id + 1}`, chef.x, chef.y - 32);
      ctx.restore();
    }
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    for (const ft of this.floatingTexts) {
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${ft.size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  private renderUI(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: BurgerTheme
  ): void {
    // 1. Minigame Header Badge (Safe at y: 56, h: 28)
    ctx.save();
    ctx.textAlign = 'center';

    const badgeW = 400;
    const badgeH = 28;
    const badgeX = width / 2 - badgeW / 2;
    const badgeY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 14);
    ctx.fill();
    ctx.stroke();

    ctx.font = '800 13px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🍔 BURGER STACK • CATCH FALLING LAYERS & SHUNT RIVALS', width / 2, badgeY + 18);
    ctx.restore();

    // 2. Sudden Death Banner if <= 15s
    if (this.roundTimer <= 15 && this.roundTimer > 0) {
      ctx.save();
      const pulse = 0.8 + Math.sin(this.animTimer * 8) * 0.2;
      ctx.fillStyle = `rgba(239, 68, 68, ${pulse * 0.25})`;
      ctx.fillRect(0, 88, width, 26);

      ctx.fillStyle = '#fef08a';
      ctx.font = '900 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ SUDDEN DEATH: 2X BURGER POINTS & GOLDEN WAGYU FRENZY! ⚡', width / 2, 105);
      ctx.restore();
    }

    // 3. Theme Pill at Bottom-Left (x: 20, y: height - 44, w: 170, h: 32)
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.stroke();

    ctx.font = '700 11px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name}`, pillX + 12, pillY + pillH / 2);

    ctx.font = '800 10px monospace';
    ctx.fillStyle = theme.accentColor;
    ctx.textAlign = 'right';
    ctx.fillText('[T]', pillX + pillW - 12, pillY + pillH / 2);
    ctx.restore();

    // 4. Player Corner Status Cards (Safely offset to y: height - 128, 130x52px)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const chef = this.playersState.get(p.id);
      if (!chef) return;

      const cardW = 130;
      const cardH = 52;
      const isLeft = idx % 2 === 0;
      const isBottom = idx < 2;

      const cardX = isLeft ? 20 : width - cardW - 20;
      const cardY = isBottom ? height - 128 : 110;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = chef.isUnderdog ? '#fbbf24' : p.color;
      ctx.lineWidth = chef.isUnderdog ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 8);
      ctx.fill();
      ctx.stroke();

      // Mini mascot avatar
      drawCharacter(
        ctx,
        cardX + 22,
        cardY + 26,
        14,
        p.id,
        p.type !== 'human',
        chef.currentMood,
        chef.animTime,
        undefined
      );

      // Score and completed burgers
      ctx.font = '800 11px sans-serif';
      ctx.fillStyle = p.color;
      ctx.textAlign = 'left';
      ctx.fillText(`P${p.id + 1} (${chef.burgersCompleted} 🍔)`, cardX + 44, cardY + 20);

      ctx.font = '900 14px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${chef.score} pts`, cardX + 44, cardY + 38);

      if (chef.isUnderdog) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '900 9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('⚡CHEF', cardX + cardW - 6, cardY + 16);
      }

      ctx.restore();
    });

    // 5. Control Hints
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('STEER: Move Plate | HOLD: Stabilize & Magnet | RAM: Tray Shunt', width - 20, height - 14);
    ctx.restore();
  }
}
