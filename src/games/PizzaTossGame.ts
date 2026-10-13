import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type PizzaThemeId = 'bella_napoli' | 'neon_slice' | 'roman_piazza';

interface PizzaTheme {
  id: PizzaThemeId;
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  counterColor: string;
  trimColor: string;
  ovenGlow: string;
  accentColor: string;
  crustColor: string;
}

const THEMES: Record<PizzaThemeId, PizzaTheme> = {
  bella_napoli: {
    id: 'bella_napoli',
    name: 'Bella Napoli Pizzeria',
    icon: '🍕',
    bgGradTop: '#2b140c',
    bgGradBottom: '#140804',
    counterColor: '#3e2723',
    trimColor: '#e53935',
    ovenGlow: 'rgba(255, 112, 67, 0.25)',
    accentColor: '#f59e0b',
    crustColor: '#ffa000'
  },
  neon_slice: {
    id: 'neon_slice',
    name: 'Little Italy Neon Slice',
    icon: '⚡',
    bgGradTop: '#0d1021',
    bgGradBottom: '#05070f',
    counterColor: '#1e293b',
    trimColor: '#00f0ff',
    ovenGlow: 'rgba(0, 240, 255, 0.25)',
    accentColor: '#00f0ff',
    crustColor: '#38bdf8'
  },
  roman_piazza: {
    id: 'roman_piazza',
    name: 'Grand Roman Piazza',
    icon: '🏛️',
    bgGradTop: '#2e1c12',
    bgGradBottom: '#170c06',
    counterColor: '#5c3826',
    trimColor: '#10b981',
    ovenGlow: 'rgba(251, 191, 36, 0.22)',
    accentColor: '#fbbf24',
    crustColor: '#f59e0b'
  }
};

const THEME_ORDER: PizzaThemeId[] = ['bella_napoli', 'neon_slice', 'roman_piazza'];

interface ToppingItem {
  id: number;
  x: number;
  y: number;
  vx: number;
  type: 'pepperoni' | 'mushroom' | 'basil' | 'cheese' | 'truffle' | 'charcoal';
}

interface ToppingOnDough {
  relX: number;
  relY: number;
  type: 'pepperoni' | 'mushroom' | 'basil' | 'cheese' | 'truffle';
}

interface AirborneDough {
  id: number;
  ownerId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  spinAngle: number;
  spinSpeed: number;
  toppings: ToppingOnDough[];
  isGoldenSouffle: boolean;
}

interface PizzaChef {
  id: PlayerId;
  x: number;
  y: number;
  targetX: number;
  // Held dough state
  hasDough: boolean;
  heldDoughSize: number;
  heldToppings: ToppingOnDough[];
  heldSpinAngle: number;
  isChargingToss: boolean;
  tossChargeTimer: number;
  // Stats
  pizzasBaked: number;
  score: number;
  combo: number;
  stunTimer: number;
  shuntCooldown: number;
  lastShovedBy: PlayerId | null;
  flopTimer: number;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  animTime: number;
}

interface FloatingPizzaText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export class PizzaTossGame extends BaseGame {
  public currentTheme: PizzaThemeId = 'bella_napoli';
  public playersState: Map<PlayerId, PizzaChef> = new Map();

  private flyingDoughs: AirborneDough[] = [];
  private doughIdCounter: number = 0;
  private toppings: ToppingItem[] = [];
  private toppingIdCounter: number = 0;
  private toppingSpawnTimer: number = 0.6;

  private floatingTexts: FloatingPizzaText[] = [];
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
          this.setTheme('bella_napoli');
        } else if (e.key === '2') {
          this.setTheme('neon_slice');
        } else if (e.key === '3') {
          this.setTheme('roman_piazza');
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

  public setTheme(theme: PizzaThemeId): void {
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
    this.flyingDoughs = [];
    this.toppings = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.animTimer = 0;
    this.doughIdCounter = 0;
    this.toppingIdCounter = 0;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);
    const counterY = height * 0.60;

    active.forEach((p, idx) => {
      const startX = spacing * (idx + 1);

      this.playersState.set(p.id, {
        id: p.id,
        x: startX,
        y: counterY - 20,
        targetX: startX,
        hasDough: true,
        heldDoughSize: 22,
        heldToppings: [],
        heldSpinAngle: 0,
        isChargingToss: false,
        tossChargeTimer: 0,
        pizzasBaked: 0,
        score: 0,
        combo: 0,
        stunTimer: 0,
        shuntCooldown: 0,
        lastShovedBy: null,
        flopTimer: 0,
        isUnderdog: false,
        currentMood: 'idle',
        animTime: 0
      });

      this.botReactionTimers.set(p.id, 0.2);
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

  private spawnTopping(width: number): void {
    const roll = Math.random();
    let type: ToppingItem['type'] = 'pepperoni';

    if (this.roundTimer <= 15 && Math.random() < 0.3) {
      type = 'truffle'; // Golden Truffle!
    } else if (roll < 0.12) {
      type = 'charcoal'; // Burnt ash hazard
    } else if (roll < 0.30) {
      type = 'cheese';
    } else if (roll < 0.52) {
      type = 'basil';
    } else if (roll < 0.76) {
      type = 'mushroom';
    }

    const fromLeft = Math.random() < 0.5;
    const vx = fromLeft ? 90 + Math.random() * 60 : -90 - Math.random() * 60;
    const x = fromLeft ? -20 : width + 20;
    const y = 140 + Math.random() * 160;

    this.toppings.push({
      id: ++this.toppingIdCounter,
      x,
      y,
      vx,
      type
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

    // Toppings spawn across the kitchen
    this.toppingSpawnTimer -= dt;
    if (this.toppingSpawnTimer <= 0 && this.toppings.length < 8) {
      this.toppingSpawnTimer = this.roundTimer <= 15 ? 0.35 + Math.random() * 0.25 : 0.6 + Math.random() * 0.4;
      this.spawnTopping(width);
    }

    // Move toppings
    for (let i = this.toppings.length - 1; i >= 0; i--) {
      const t = this.toppings[i];
      t.x += t.vx * dt;
      if (t.x < -40 || t.x > width + 40) {
        this.toppings.splice(i, 1);
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

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Update each chef
    for (const p of active) {
      const chef = this.playersState.get(p.id);
      if (!chef) continue;

      chef.animTime += dt * 6;
      if (chef.shuntCooldown > 0) chef.shuntCooldown -= dt;

      // Handle flop timer after dropping dough
      if (chef.flopTimer > 0) {
        chef.flopTimer -= dt;
        if (chef.flopTimer <= 0) {
          chef.hasDough = true;
          chef.heldDoughSize = 22;
          chef.heldToppings = [];
          chef.currentMood = 'idle';
        }
      }

      // Handle stun
      if (chef.stunTimer > 0) {
        chef.stunTimer -= dt;
        chef.currentMood = 'shocked';
        if (chef.stunTimer <= 0) chef.currentMood = 'idle';
      }

      const steer = this.input.getSteer(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      if (chef.stunTimer <= 0) {
        // Lateral chef movement along counter
        const moveSpeed = (chef.isUnderdog ? 280 : 220) * dt;
        chef.x += steer * moveSpeed;
        chef.x = Math.max(60, Math.min(width - 60, chef.x));

        // Hold-to-Charge Dough Toss & Spin
        if (chef.hasDough) {
          chef.heldSpinAngle += dt * 8;

          if (isAction) {
            chef.isChargingToss = true;
            chef.tossChargeTimer += dt;
            chef.heldDoughSize = Math.min(38, 22 + chef.tossChargeTimer * 14);
            chef.currentMood = 'focused';

            if (Math.random() < 0.3) {
              this.particles.spawnSparks(chef.x, chef.y - 20, '#fef08a', 1);
            }
          } else {
            // Release: Toss dough high into the pizzeria air!
            if (chef.isChargingToss && chef.tossChargeTimer >= 0.12) {
              chef.isChargingToss = false;
              const chargeRatio = Math.min(1.0, chef.tossChargeTimer / 1.0);
              this.launchAirborneDough(chef, chargeRatio);
              chef.tossChargeTimer = 0;
            } else {
              chef.isChargingToss = false;
              chef.tossChargeTimer = 0;
            }
          }
        }
      }
    }

    // Update Airborne Doughs in 2.5D kitchen
    for (let i = this.flyingDoughs.length - 1; i >= 0; i--) {
      const d = this.flyingDoughs[i];
      d.vy += 480 * dt; // Gravity
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.spinAngle += d.spinSpeed * dt;

      // Check collision with flying toppings in air
      for (let ti = this.toppings.length - 1; ti >= 0; ti--) {
        const top = this.toppings[ti];
        const dist = Math.hypot(d.x - top.x, d.y - top.y);

        if (dist < d.size + 10) {
          if (top.type === 'charcoal') {
            // Burnt charcoal ruins dough!
            this.audio.playExplosion();
            this.particles.emit(d.x, d.y, 8, '#262626');
            this.addFloatingText('🔥 BURNT ASH! -15', d.x, d.y - 20, '#ef4444', 15);
            // Drop immediately
            d.vy = 280;
            d.toppings = [];
          } else {
            // Snag delicious topping onto pizza!
            if (d.toppings.length < 6) {
              const ang = Math.random() * Math.PI * 2;
              const rad = Math.random() * (d.size - 8);
              d.toppings.push({
                relX: Math.cos(ang) * rad,
                relY: Math.sin(ang) * rad,
                type: top.type
              });
              this.audio.playScore();
              this.particles.spawnSparks(d.x, d.y, '#facc15', 6);
              this.addFloatingText(`+${top.type.toUpperCase()}`, d.x, d.y - 20, '#facc15', 13);
            }
          }
          this.toppings.splice(ti, 1);
        }
      }

      // Check catch by any chef stationed below
      let caught = false;
      const counterY = height * 0.60;

      for (const p of active) {
        const chef = this.playersState.get(p.id);
        if (!chef || chef.hasDough) continue;

        const chefDist = Math.hypot(d.x - chef.x, d.y - chef.y);
        const catchThreshold = chef.isUnderdog ? 44 : 32;

        if (chefDist < catchThreshold && d.vy > 0 && d.y > counterY - 60) {
          // Dough Caught!
          caught = true;
          const isSteal = d.ownerId !== chef.id;

          if (d.toppings.length >= 2 || d.isGoldenSouffle) {
            // BAKE THE PIZZA!
            chef.pizzasBaked++;
            chef.combo++;

            let baseVal = d.isGoldenSouffle ? 60 : 35;
            baseVal += d.toppings.length * 10;
            if (isSteal) baseVal += 25; // Steal bonus!

            const mult = this.roundTimer <= 15 ? 2 : 1;
            const pts = (baseVal + chef.combo * 4) * mult;
            chef.score += pts;

            this.audio.playScore();
            this.audio.playFanfare();
            this.particles.spawnConfetti(chef.x, chef.y - 30, 18);

            if (isSteal) {
              this.hitStopTimer = 0.045; // 45ms hit-stop
              this.screenShake = 6;
              this.addFloatingText(`🍕 PIZZA HEIST! +${pts}`, chef.x, chef.y - 35, '#facc15', 17);
              const victim = this.playersState.get(d.ownerId);
              if (victim) victim.currentMood = 'shocked';
            } else {
              this.addFloatingText(`🍕 BAKED PERFECT! +${pts}`, chef.x, chef.y - 30, '#10b981', 16);
            }

            chef.currentMood = 'triumph';
            chef.hasDough = false;
            chef.flopTimer = 0.5; // Fresh dough ready soon
          } else {
            // Caught safely, keep spinning to add more toppings!
            chef.hasDough = true;
            chef.heldDoughSize = d.size;
            chef.heldToppings = d.toppings;
            this.audio.playTap();
            this.addFloatingText('CAUGHT! ADD MORE TOPPINGS!', chef.x, chef.y - 25, '#fbbf24', 13);
          }

          this.flyingDoughs.splice(i, 1);
          break;
        }
      }

      // Check splat on counter floor
      if (!caught && d.y > counterY - 5) {
        this.audio.playBounce();
        this.particles.emit(d.x, counterY, 8, '#fef08a');
        this.addFloatingText('SPLAT! DROPPED!', d.x, counterY - 20, '#ef4444', 14);

        const owner = this.playersState.get(d.ownerId);
        if (owner && !owner.hasDough) {
          owner.score = Math.max(0, owner.score - 10);
          owner.combo = 0;
          owner.currentMood = 'shocked';
          owner.flopTimer = 0.8;
        }

        this.flyingDoughs.splice(i, 1);
      }
    }

    // Inter-Chef Body Contact & Flour Shunts
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
          this.screenShake = 5;
          this.particles.spawnSparks(midX, c1.y, '#f59e0b', 8);

          // Elastic separation
          const pushSign = c1.x < c2.x ? -1 : 1;
          const shuntForce = 65 * (c1.isUnderdog || c2.isUnderdog ? 1.5 : 1.0);

          c1.x += pushSign * shuntForce;
          c2.x -= pushSign * shuntForce;

          if (c1.shuntCooldown <= 0 && c2.shuntCooldown <= 0) {
            c1.shuntCooldown = 1.0;
            c2.shuntCooldown = 1.0;
            c1.score += 25;
            c2.stunTimer = 0.45;
            c2.lastShovedBy = p1.id;
            c2.currentMood = 'shocked';
            c1.currentMood = 'triumph';
            this.addFloatingText('💥 FLOUR SHUNT! +25', midX, c1.y - 35, p1.color, 15);
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private launchAirborneDough(chef: PizzaChef, chargeRatio: number): void {
    chef.hasDough = false;

    const upwardVel = -360 - chargeRatio * 240;
    const lateralVel = (Math.random() - 0.5) * (chargeRatio * 140);
    const isSouffle = this.roundTimer <= 15 || Math.random() < 0.2;

    this.flyingDoughs.push({
      id: ++this.doughIdCounter,
      ownerId: chef.id,
      x: chef.x,
      y: chef.y - 25,
      vx: lateralVel,
      vy: upwardVel,
      size: chef.heldDoughSize,
      spinAngle: chef.heldSpinAngle,
      spinSpeed: 3.5 + chargeRatio * 4.0,
      toppings: chef.heldToppings,
      isGoldenSouffle: isSouffle
    });

    this.audio.playWhoosh();
    this.particles.spawnSparks(chef.x, chef.y - 20, '#facc15', 6);
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

    let targetX = chef.targetX;
    let shouldToss = false;

    // Check if there is an airborne dough to catch or steal!
    let foundAirborne = false;
    for (const d of this.flyingDoughs) {
      if (d.vy > 0 && d.y > 180 && !chef.hasDough) {
        targetX = d.x;
        foundAirborne = true;
        break;
      }
    }

    // If holding dough, charge and toss
    if (!foundAirborne && chef.hasDough) {
      if (chef.isChargingToss) {
        shouldToss = chef.tossChargeTimer < 0.65; // Release
      } else {
        shouldToss = true; // Start charge
      }
    }

    // Apply blunder
    if (Math.random() < blunderChance) {
      targetX += (Math.random() - 0.5) * 140;
    }

    targetX = Math.max(60, Math.min(width - 60, targetX));
    const steerErr = targetX - chef.x;
    const steer = Math.abs(steerErr) > 12 ? (steerErr > 0 ? 1 : -1) : 0;

    this.input.setBotInput(botId, shouldToss, steer, 0, shouldToss);
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
        baked: chef?.pizzasBaked || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topBaked = scores[0]?.baked || 0;
    const mvpHighlight = winnerId !== null
      ? `Chef ${winnerId + 1} baked ${topBaked} gourmet pizzas to become Napoli Grandmaster!`
      : 'The pizzeria concluded with a wild flour cloud finish!';

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

    // Oven Glow behind counter
    ctx.fillStyle = theme.ovenGlow;
    ctx.beginPath();
    ctx.arc(width / 2, height * 0.45, width * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // 2. Kitchen Counter & Checkered Trim
    const counterY = height * 0.60;
    ctx.fillStyle = theme.counterColor;
    ctx.fillRect(0, counterY, width, height - counterY);

    ctx.fillStyle = theme.trimColor;
    ctx.fillRect(0, counterY - 6, width, 6);

    // 3. Render Flying Toppings
    this.renderToppings(ctx);

    // 4. Render Airborne Doughs
    this.renderAirborneDoughs(ctx, theme);

    // 5. Render Chefs & Held Dough
    this.renderChefs(ctx, theme);

    // 6. Floating Text FX
    this.renderFloatingTexts(ctx);

    ctx.restore(); // Screen shake end

    // 7. Safe UI Layout
    this.renderUI(ctx, width, height, theme);
  }

  private renderToppings(ctx: CanvasRenderingContext2D): void {
    for (const t of this.toppings) {
      ctx.save();
      ctx.translate(t.x, t.y);

      if (t.type === 'pepperoni') {
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fca5a5';
        ctx.beginPath();
        ctx.arc(-2, -2, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (t.type === 'mushroom') {
        ctx.fillStyle = '#d6d3d1';
        ctx.beginPath();
        ctx.arc(0, -2, 7, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(-2, -2, 4, 6);
      } else if (t.type === 'basil') {
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 4, 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (t.type === 'cheese') {
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-6, -3, 12, 6);
      } else if (t.type === 'truffle') {
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💎', 0, 0);
      } else if (t.type === 'charcoal') {
        ctx.fillStyle = '#262626';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(1, 1, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private renderAirborneDoughs(ctx: CanvasRenderingContext2D, theme: PizzaTheme): void {
    for (const d of this.flyingDoughs) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.spinAngle);

      const r = d.size;

      // Glow if Golden Souffle
      if (d.isGoldenSouffle) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Crust edge
      ctx.fillStyle = d.isGoldenSouffle ? '#facc15' : theme.crustColor;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // Tomato sauce core
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(0, 0, r - 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Mozzarella cheese layer
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(0, 0, r - 6, 0, Math.PI * 2);
      ctx.fill();

      // Toppings on dough
      for (const t of d.toppings) {
        ctx.save();
        ctx.translate(t.relX, t.relY);
        if (t.type === 'pepperoni') {
          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.arc(0, 0, 5, 0, Math.PI * 2);
          ctx.fill();
        } else if (t.type === 'mushroom') {
          ctx.fillStyle = '#d6d3d1';
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (t.type === 'basil') {
          ctx.fillStyle = '#16a34a';
          ctx.beginPath();
          ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (t.type === 'cheese' || t.type === 'truffle') {
          ctx.fillStyle = '#facc15';
          ctx.fillRect(-3, -2, 6, 4);
        }
        ctx.restore();
      }

      ctx.restore();
    }
  }

  private renderChefs(ctx: CanvasRenderingContext2D, theme: PizzaTheme): void {
    const active = this.getActivePlayers();

    for (const p of active) {
      const chef = this.playersState.get(p.id);
      if (!chef) continue;

      const isBot = p.type !== 'human';

      ctx.save();
      ctx.translate(chef.x, chef.y);

      // Underdog Golden Glow
      if (chef.isUnderdog) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Mascot Chef Body
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

      // Chef Hat
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -18, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-8, -14, 16, 6);

      // Chef Hands holding/spinning dough
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(-14, -6, 5, 0, Math.PI * 2);
      ctx.arc(14, -6, 5, 0, Math.PI * 2);
      ctx.fill();

      // Held Dough
      if (chef.hasDough) {
        ctx.save();
        ctx.translate(0, -22);
        ctx.rotate(chef.heldSpinAngle);

        const r = chef.heldDoughSize;
        ctx.fillStyle = theme.crustColor;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(0, 0, r - 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(0, 0, r - 5, 0, Math.PI * 2);
        ctx.fill();

        // Charge Ring Indicator
        if (chef.isChargingToss) {
          const prog = Math.min(1.0, chef.tossChargeTimer / 1.0);
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, r + 5, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();
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
    theme: PizzaTheme
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
    ctx.fillText('🍕 PIZZA TOSS • HOLD TO CHARGE SKY TOSS & STEAL RIVALS', width / 2, badgeY + 18);
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
      ctx.fillText('⚡ SUDDEN DEATH: 2X PIZZA VALUE & GOLDEN SOUFFLE FRENZY! ⚡', width / 2, 105);
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

      // Score and pizzas
      ctx.font = '800 11px sans-serif';
      ctx.fillStyle = p.color;
      ctx.textAlign = 'left';
      ctx.fillText(`P${p.id + 1} (${chef.pizzasBaked} 🍕)`, cardX + 44, cardY + 20);

      ctx.font = '900 14px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${chef.score} pts`, cardX + 44, cardY + 38);

      if (chef.isUnderdog) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '900 9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('⚡PIZZAIOLO', cardX + cardW - 6, cardY + 16);
      }

      ctx.restore();
    });

    // 5. Control Hints
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('STEER: Move Chef | HOLD: Charge Sky Toss | CATCH: Catch & Steal', width - 20, height - 14);
    ctx.restore();
  }
}
