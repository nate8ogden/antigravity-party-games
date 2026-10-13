import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type SushiThemeId = 'ginza_bar' | 'cyber_kaiten' | 'dragon_palace';

interface SushiTheme {
  id: SushiThemeId;
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  counterWood: string;
  beltTrack: string;
  beltSlats: string;
  accentColor: string;
  plateColor: string;
  lanternGlow: string;
}

const THEMES: Record<SushiThemeId, SushiTheme> = {
  ginza_bar: {
    id: 'ginza_bar',
    name: 'Ginza Kaiten Bar',
    icon: '🍣',
    bgGradTop: '#1f130a',
    bgGradBottom: '#0e0804',
    counterWood: '#452b1b',
    beltTrack: '#1e293b',
    beltSlats: '#334155',
    accentColor: '#f59e0b',
    plateColor: '#f8fafc',
    lanternGlow: 'rgba(245, 158, 11, 0.2)'
  },
  cyber_kaiten: {
    id: 'cyber_kaiten',
    name: 'Neo-Kyoto Cyber Kaiten',
    icon: '⚡',
    bgGradTop: '#080d1a',
    bgGradBottom: '#03050a',
    counterWood: '#0f172a',
    beltTrack: '#0284c7',
    beltSlats: '#00f0ff',
    accentColor: '#00f0ff',
    plateColor: '#0f172a',
    lanternGlow: 'rgba(0, 240, 255, 0.25)'
  },
  dragon_palace: {
    id: 'dragon_palace',
    name: 'Dragon Palace Izakaya',
    icon: '🐉',
    bgGradTop: '#240a12',
    bgGradBottom: '#0d0306',
    counterWood: '#581c2f',
    beltTrack: '#831843',
    beltSlats: '#f43f5e',
    accentColor: '#fbbf24',
    plateColor: '#fdf2f8',
    lanternGlow: 'rgba(251, 191, 36, 0.25)'
  }
};

const THEME_ORDER: SushiThemeId[] = ['ginza_bar', 'cyber_kaiten', 'dragon_palace'];

type DishType = 'salmon' | 'tuna' | 'ebi' | 'unagi' | 'golden_otoro' | 'wasabi_bomb';

interface SushiDishInfo {
  type: DishType;
  name: string;
  color: string;
  scoreVal: number;
  isHazard: boolean;
  icon: string;
}

const DISH_CATALOG: Record<DishType, SushiDishInfo> = {
  salmon: { type: 'salmon', name: 'SALMON', color: '#ff7043', scoreVal: 20, isHazard: false, icon: '🍣' },
  tuna: { type: 'tuna', name: 'TUNA', color: '#dc2626', scoreVal: 20, isHazard: false, icon: '🍣' },
  ebi: { type: 'ebi', name: 'EBI SHRIMP', color: '#fb7185', scoreVal: 20, isHazard: false, icon: '🍤' },
  unagi: { type: 'unagi', name: 'UNAGI EEL', color: '#78350f', scoreVal: 25, isHazard: false, icon: '🥢' },
  golden_otoro: { type: 'golden_otoro', name: 'GOLDEN O-TORO', color: '#facc15', scoreVal: 50, isHazard: false, icon: '💎' },
  wasabi_bomb: { type: 'wasabi_bomb', name: 'WASABI BOMB', color: '#84cc16', scoreVal: -15, isHazard: true, icon: '💣' }
};

interface ConveyorPlate {
  id: number;
  x: number;
  type: DishType;
  wobble: number;
}

interface SushiChefPlayer {
  id: PlayerId;
  x: number;
  y: number;
  targetDish: DishType;
  score: number;
  ordersFulfilled: number;
  combo: number;
  // Hold-to-Charge Chopsticks
  isChargingSnatch: boolean;
  snatchChargeTimer: number;
  snatchReach: number;
  snatchAnim: number;
  // Combat
  stunTimer: number;
  shuntCooldown: number;
  lastShovedBy: PlayerId | null;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  animTime: number;
}

interface FloatingSushiText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export class SushiExpressGame extends BaseGame {
  public currentTheme: SushiThemeId = 'ginza_bar';
  public playersState: Map<PlayerId, SushiChefPlayer> = new Map();

  private plates: ConveyorPlate[] = [];
  private plateIdCounter: number = 0;
  private beltY: number = 0;
  private beltSpeed: number = 160;
  private spawnTimer: number = 0.5;

  private floatingTexts: FloatingSushiText[] = [];
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
          this.setTheme('ginza_bar');
        } else if (e.key === '2') {
          this.setTheme('cyber_kaiten');
        } else if (e.key === '3') {
          this.setTheme('dragon_palace');
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

  public setTheme(theme: SushiThemeId): void {
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
    this.playersState.clear();
    this.plates = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.animTimer = 0;
    this.plateIdCounter = 0;

    this.beltY = height * 0.44;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    const normalDishes: DishType[] = ['salmon', 'tuna', 'ebi', 'unagi'];

    active.forEach((p, idx) => {
      const initialDish = normalDishes[Math.floor(Math.random() * normalDishes.length)];
      const startX = spacing * (idx + 1);

      this.playersState.set(p.id, {
        id: p.id,
        x: startX,
        y: this.beltY + 95,
        targetDish: initialDish,
        score: 0,
        ordersFulfilled: 0,
        combo: 0,
        isChargingSnatch: false,
        snatchChargeTimer: 0,
        snatchReach: 0,
        snatchAnim: 0,
        stunTimer: 0,
        shuntCooldown: 0,
        lastShovedBy: null,
        isUnderdog: false,
        currentMood: 'idle',
        animTime: 0
      });

      this.botReactionTimers.set(p.id, 0.2);
    });

    // Spawn 4 initial plates
    for (let i = 0; i < 5; i++) {
      this.spawnPlate(width * (i / 5));
    }
  }

  private spawnPlate(customX?: number): void {
    const x = customX !== undefined ? customX : -50;
    const roll = Math.random();
    let type: DishType = 'salmon';

    if (this.roundTimer <= 15 && Math.random() < 0.35) {
      type = 'golden_otoro'; // Frenzy!
    } else if (roll < 0.25) type = 'salmon';
    else if (roll < 0.50) type = 'tuna';
    else if (roll < 0.70) type = 'ebi';
    else if (roll < 0.85) type = 'unagi';
    else if (roll < 0.94) type = 'wasabi_bomb';
    else type = 'golden_otoro';

    this.plates.push({
      id: ++this.plateIdCounter,
      x,
      type,
      wobble: Math.random() * Math.PI * 2
    });
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

    // Dynamic conveyor spawning
    this.spawnTimer -= dt;
    const spawnRate = this.roundTimer <= 15 ? 0.38 : 0.65;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = spawnRate + Math.random() * 0.25;
      this.spawnPlate();
    }

    // Advance plates along belt
    const currentBeltSpeed = this.beltSpeed * (this.roundTimer <= 15 ? 1.35 : 1.0);
    for (let i = this.plates.length - 1; i >= 0; i--) {
      const plate = this.plates[i];
      plate.x += currentBeltSpeed * dt;
      plate.wobble += dt * 5;

      if (plate.x > width + 60) {
        this.plates.splice(i, 1);
      }
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
    }

    // Bot AI update
    this.updateBots(dt, width, height);

    // Update each chef
    for (const p of active) {
      const chef = this.playersState.get(p.id);
      if (!chef) continue;

      chef.animTime += dt * 6;
      if (chef.snatchAnim > 0) chef.snatchAnim = Math.max(0, chef.snatchAnim - dt * 5);
      if (chef.shuntCooldown > 0) chef.shuntCooldown -= dt;

      // Stun recovery
      if (chef.stunTimer > 0) {
        chef.stunTimer -= dt;
        chef.currentMood = 'shocked';
        if (chef.stunTimer <= 0) chef.currentMood = 'idle';
      }

      const steer = this.input.getSteer(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      if (chef.stunTimer <= 0) {
        // Lateral running along counter
        const moveSpeed = (chef.isUnderdog ? 290 : 230) * dt;
        chef.x += steer * moveSpeed;
        chef.x = Math.max(60, Math.min(width - 60, chef.x));

        // Hold-to-Charge Telescopic Chopsticks
        if (isAction) {
          chef.isChargingSnatch = true;
          chef.snatchChargeTimer += dt;
          chef.currentMood = 'focused';

          if (Math.random() < 0.3) {
            this.particles.spawnSparks(chef.x, this.beltY + 20, '#facc15', 1);
          }
        } else {
          // Release: Telescopic Snatch!
          if (chef.isChargingSnatch && chef.snatchChargeTimer >= 0.12) {
            chef.isChargingSnatch = false;
            chef.snatchAnim = 1.0;

            const chargeRatio = Math.min(1.0, chef.snatchChargeTimer / 1.0);
            this.executeChopstickSnatch(chef, chargeRatio);

            chef.snatchChargeTimer = 0;
          } else {
            chef.isChargingSnatch = false;
            chef.snatchChargeTimer = 0;
          }
        }
      }
    }

    // Inter-Chef Body Contact & Counter Shunts
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const p1 = active[i];
        const p2 = active[j];
        const c1 = this.playersState.get(p1.id);
        const c2 = this.playersState.get(p2.id);
        if (!c1 || !c2) continue;

        const dist = Math.abs(c1.x - c2.x);
        if (dist < 40) {
          const midX = (c1.x + c2.x) / 2;
          this.audio.playBounce();
          this.hitStopTimer = 0.035;
          this.screenShake = 5;
          this.particles.spawnSparks(midX, c1.y - 20, '#f59e0b', 8);

          // Elastic separation along counter
          const pushSign = c1.x < c2.x ? -1 : 1;
          const shuntForce = 65 * (c1.isUnderdog || c2.isUnderdog ? 1.5 : 1.0);

          c1.x += pushSign * shuntForce;
          c2.x -= pushSign * shuntForce;

          if (c1.shuntCooldown <= 0 && c2.shuntCooldown <= 0) {
            c1.shuntCooldown = 1.0;
            c2.shuntCooldown = 1.0;
            c1.score += 30;
            c2.stunTimer = 0.45;
            c2.lastShovedBy = p1.id;
            c2.currentMood = 'shocked';
            c1.currentMood = 'triumph';
            this.addFloatingText('💥 CHEF SHUNT! +30', midX, c1.y - 45, p1.color, 15);
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private executeChopstickSnatch(chef: SushiChefPlayer, chargeRatio: number): void {
    // Reach width expands with charge
    const grabWidth = 32 + chargeRatio * 32 + (chef.isUnderdog ? 20 : 0);

    let snatchedIdx = -1;
    let closestDist = 9999;

    for (let i = 0; i < this.plates.length; i++) {
      const pDist = Math.abs(this.plates[i].x - chef.x);
      if (pDist < grabWidth && pDist < closestDist) {
        closestDist = pDist;
        snatchedIdx = i;
      }
    }

    if (snatchedIdx !== -1) {
      const plate = this.plates[snatchedIdx];
      const dish = DISH_CATALOG[plate.type];
      this.plates.splice(snatchedIdx, 1);

      if (dish.isHazard) {
        // Wasabi Bomb!
        if (!chef.isUnderdog) {
          chef.combo = 0;
          chef.score = Math.max(0, chef.score - 15);
          chef.stunTimer = 0.9;
          this.audio.playExplosion();
          this.screenShake = 7;
          this.particles.emit(chef.x, this.beltY, 12, '#84cc16');
          this.addFloatingText('💥 WASABI BOMB! -15', chef.x, this.beltY - 25, '#84cc16', 16);
          chef.currentMood = 'shocked';
        } else {
          this.audio.playBounce();
          this.particles.spawnSparks(chef.x, this.beltY, '#fbbf24', 10);
          this.addFloatingText('🛡️ WASABI IMMUNITY!', chef.x, this.beltY - 25, '#fbbf24', 15);
        }
      } else if (plate.type === 'golden_otoro') {
        // Luxury O-Toro Grab!
        chef.combo += 2;
        chef.ordersFulfilled++;
        const mult = this.roundTimer <= 15 ? 2 : 1;
        const pts = 50 * mult;
        chef.score += pts;
        this.audio.playFanfare();
        this.particles.spawnConfetti(chef.x, this.beltY, 20);
        this.addFloatingText(`💎 GOLDEN O-TORO! +${pts}`, chef.x, this.beltY - 30, '#facc15', 18);
        chef.currentMood = 'triumph';
      } else if (plate.type === chef.targetDish) {
        // Perfect Order Match!
        chef.combo++;
        chef.ordersFulfilled++;
        const mult = this.roundTimer <= 15 ? 2 : 1;
        const pts = (dish.scoreVal + chef.combo * 3) * mult;
        chef.score += pts;
        this.audio.playScore();
        this.particles.spawnSparks(chef.x, this.beltY, dish.color, 12);
        this.addFloatingText(`✨ ${dish.name}! +${pts}`, chef.x, this.beltY - 25, dish.color, 16);
        chef.currentMood = 'triumph';

        // Assign next order
        const normalDishes: DishType[] = ['salmon', 'tuna', 'ebi', 'unagi'];
        chef.targetDish = normalDishes[Math.floor(Math.random() * normalDishes.length)];
      } else {
        // Wrong dish snatched! Still gives partial points without combo
        chef.combo = 0;
        const pts = 8;
        chef.score += pts;
        this.audio.playBounce();
        this.particles.spawnSparks(chef.x, this.beltY, '#94a3b8', 6);
        this.addFloatingText(`SNATCHED ${dish.name} +${pts}`, chef.x, this.beltY - 20, '#94a3b8', 13);
      }
    } else {
      // Empty whiff
      this.audio.playWhoosh();
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

    let targetX = chef.x;
    let shouldSnatch = false;

    // Look for target order plate or golden otoro approaching
    let bestPlate: ConveyorPlate | null = null;
    let bestDist = 9999;

    for (const p of this.plates) {
      if (p.type === 'wasabi_bomb' && !chef.isUnderdog) continue;

      // Prioritize golden otoro or matching order
      const isPriority = p.type === 'golden_otoro' || p.type === chef.targetDish;
      const weight = isPriority ? 0.4 : 1.0;
      const dist = Math.abs(p.x - chef.x) * weight;

      if (dist < bestDist) {
        bestDist = dist;
        bestPlate = p;
      }
    }

    if (bestPlate) {
      // Move towards plate intercept
      targetX = bestPlate.x + 15;
      if (Math.abs(bestPlate.x - chef.x) < 35) {
        shouldSnatch = true;
      }
    }

    // Apply blunder
    if (Math.random() < blunderChance) {
      targetX += (Math.random() - 0.5) * 120;
      if (Math.random() < 0.4) shouldSnatch = true;
    }

    targetX = Math.max(60, Math.min(width - 60, targetX));
    const steerErr = targetX - chef.x;
    const steer = Math.abs(steerErr) > 12 ? (steerErr > 0 ? 1 : -1) : 0;

    this.input.setBotInput(botId, shouldSnatch, steer, 0, shouldSnatch);
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
        orders: c?.ordersFulfilled || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topOrders = scores[0]?.orders || 0;
    const mvpHighlight = winnerId !== null
      ? `Chef ${winnerId + 1} served ${topOrders} exquisite plates to become Master Sushi Chef!`
      : 'The conveyor belt was picked clean in a dramatic dead heat!';

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

    // 1. Japanese Izakaya / Cyber Wall Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Warm Paper Lantern Lights along top
    ctx.fillStyle = theme.lanternGlow;
    for (let lx = 60; lx < width; lx += 140) {
      ctx.beginPath();
      ctx.arc(lx, 35, 60, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Conveyor Belt Track & Counter
    this.renderConveyor(ctx, width, height, theme);

    // 3. Render Plates on Belt
    this.renderPlates(ctx, theme);

    // 4. Render Chefs & Chopsticks
    this.renderChefs(ctx, theme);

    // 5. Floating Text FX
    this.renderFloatingTexts(ctx);

    ctx.restore(); // Screen shake end

    // 6. Safe UI Layout
    this.renderUI(ctx, width, height, theme);
  }

  private renderConveyor(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: SushiTheme
  ): void {
    ctx.save();

    // Cedar Countertop
    ctx.fillStyle = theme.counterWood;
    ctx.fillRect(0, this.beltY - 32, width, height - (this.beltY - 32));

    // Polished Counter Lip
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, this.beltY - 32, width, 6);

    // Conveyor Belt Bed
    ctx.fillStyle = theme.beltTrack;
    ctx.fillRect(0, this.beltY - 20, width, 40);

    // Conveyor Rails
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, this.beltY - 20);
    ctx.lineTo(width, this.beltY - 20);
    ctx.moveTo(0, this.beltY + 20);
    ctx.lineTo(width, this.beltY + 20);
    ctx.stroke();

    // Moving Belt Slats
    const slatOffset = (this.animTimer * this.beltSpeed) % 28;
    ctx.strokeStyle = theme.beltSlats;
    ctx.lineWidth = 2;
    for (let x = -28 + slatOffset; x < width + 28; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, this.beltY - 20);
      ctx.lineTo(x, this.beltY + 20);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderPlates(ctx: CanvasRenderingContext2D, theme: SushiTheme): void {
    for (const plate of this.plates) {
      const dish = DISH_CATALOG[plate.type];
      const bob = Math.sin(plate.wobble) * 2;

      ctx.save();
      ctx.translate(plate.x, this.beltY + bob);

      // Ceramic Dish
      ctx.fillStyle = theme.plateColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (plate.type === 'golden_otoro') {
        // Golden Otoro Glow
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.roundRect(-14, -7, 28, 14, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💎', 0, 0);
      } else if (dish.isHazard) {
        // Wasabi Bomb
        ctx.fillStyle = '#84cc16';
        ctx.shadowColor = '#65a30d';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, -2, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💣', 0, -2);
      } else {
        // Nigiri Rice Bed
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(-14, -4, 28, 9, 3);
        ctx.fill();

        // Fresh Sashimi Slice
        ctx.fillStyle = dish.color;
        ctx.beginPath();
        ctx.roundRect(-15, -7, 30, 8, 3);
        ctx.fill();

        // Nori belt
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(-3, -7, 6, 12);
      }

      ctx.restore();
    }
  }

  private renderChefs(ctx: CanvasRenderingContext2D, theme: SushiTheme): void {
    const active = this.getActivePlayers();

    for (const p of active) {
      const chef = this.playersState.get(p.id);
      if (!chef) continue;

      const isBot = p.type !== 'human';
      const targetDish = DISH_CATALOG[chef.targetDish];

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

      // 1. Chef Mascot Character
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

      // Sushi Chef Hachimaki Headband
      ctx.fillStyle = p.color;
      ctx.fillRect(-10, -14, 20, 4);

      // 2. Telescopic Chopsticks extending towards belt
      const reachDist = 20 + chef.snatchAnim * 48;
      ctx.strokeStyle = chef.isUnderdog ? '#fbbf24' : '#cbd5e1';
      ctx.lineWidth = chef.isUnderdog ? 4 : 2.5;

      ctx.beginPath();
      // Left stick
      ctx.moveTo(-6, -6);
      ctx.lineTo(-2, -reachDist);
      // Right stick
      ctx.moveTo(6, -6);
      ctx.lineTo(2, -reachDist);
      ctx.stroke();

      // Charge Arc Ring
      if (chef.isChargingSnatch) {
        const prog = Math.min(1.0, chef.snatchChargeTimer / 1.0);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      // 3. Overhead Order Ticket Parchment
      ctx.save();
      const ticketX = chef.x;
      const ticketY = chef.y - 42;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = targetDish ? targetDish.color : theme.accentColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(ticketX - 44, ticketY - 14, 88, 28, 6);
      ctx.fill();
      ctx.stroke();

      ctx.font = '800 11px sans-serif';
      ctx.fillStyle = targetDish ? targetDish.color : '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(`${targetDish.icon} ${targetDish.name}`, ticketX, ticketY + 4);
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
    theme: SushiTheme
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
    ctx.fillText('🍣 SUSHI EXPRESS • RUN CONVEYOR & SNATCH ORDERS', width / 2, badgeY + 18);
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
      ctx.fillText('⚡ SUDDEN DEATH: 2X ORDER VALUE & GOLDEN O-TORO FRENZY! ⚡', width / 2, 105);
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

      // Score and orders
      ctx.font = '800 11px sans-serif';
      ctx.fillStyle = p.color;
      ctx.textAlign = 'left';
      ctx.fillText(`P${p.id + 1} (${chef.ordersFulfilled} 🍣)`, cardX + 44, cardY + 20);

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
    ctx.fillText('STEER: Run Along Bar | HOLD: Charge Telescopic Snatch | RAM: Chef Shunt', width - 20, height - 14);
    ctx.restore();
  }
}
