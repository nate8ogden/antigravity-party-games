import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface FoodItem {
  id: number;
  name: string;
  color: string;
  points: number;
  radius: number;
  isGolden?: boolean;
  isHazard?: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
}

const FOOD_TEMPLATES = [
  { name: 'Tiger Shrimp', color: '#FF7043', points: 15, radius: 14 },
  { name: 'Grilled Zucchini', color: '#66BB6A', points: 12, radius: 13 },
  { name: 'Shiitake Mushroom', color: '#8D6E63', points: 15, radius: 13 },
  { name: 'Sirloin Cube', color: '#D84315', points: 24, radius: 14 },
  { name: 'Golden Wagyu', color: '#FFD700', points: 45, radius: 16, isGolden: true },
  { name: 'Burning Ember', color: '#37474F', points: -15, radius: 12, isHazard: true }
];

interface TeppanyakiChef {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  chargeTime: number;
  isCharging: boolean;
  bowlItems: string[];
  loftAltitude: number;
  vLoft: number;
  shuntCooldown: number;
  shuntActiveTimer: number;
  shuntDir: number;
  stunTimer: number;
  score: number;
  plattersServed: number;
  combo: number;
  isUnderdog: boolean;
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
}

interface TeppanyakiTheme {
  id: string;
  name: string;
  icon: string;
  bgTop: string;
  bgBottom: string;
  griddleColor: string;
  griddleTrim: string;
  counterColor: string;
  accentColor: string;
}

const THEMES: TeppanyakiTheme[] = [
  {
    id: 'ginza_steakhouse',
    name: 'Ginza Hibachi 🥩',
    icon: '🥩',
    bgTop: '#1A0E0A',
    bgBottom: '#0A0503',
    griddleColor: '#263238',
    griddleTrim: '#FF5722',
    counterColor: '#3E2723',
    accentColor: '#FFD54F'
  },
  {
    id: 'cyber_teppan',
    name: 'Cyber Teppan ⚡',
    icon: '⚡',
    bgTop: '#080E18',
    bgBottom: '#02050A',
    griddleColor: '#1A233A',
    griddleTrim: '#00E5FF',
    counterColor: '#0E1726',
    accentColor: '#00E5FF'
  },
  {
    id: 'osaka_street_grill',
    name: 'Osaka Street Grill 🏮',
    icon: '🏮',
    bgTop: '#210C0C',
    bgBottom: '#0D0404',
    griddleColor: '#37474F',
    griddleTrim: '#E53935',
    counterColor: '#4E342E',
    accentColor: '#FF9800'
  }
];

export class TeppanyakiCatchGame extends BaseGame {
  public currentMapName: string = 'Ginza Hibachi 🥩';
  private currentThemeIdx: number = 0;

  private chefs: Map<PlayerId, TeppanyakiChef> = new Map();
  private flyingFoods: FoodItem[] = [];
  private nextFoodId: number = 1;
  private foodSpawnTimer: number = 0.5;

  private botReactionTimers: Map<PlayerId, number> = new Map();
  private botTargetFood: Map<PlayerId, number | null> = new Map();

  private screenShake: number = 0;
  private hitStopTimer: number = 0;

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

    if (typeof window !== 'undefined') {
      this.keydownHandler = (e: KeyboardEvent) => {
        if (e.code === 'KeyT') {
          this.cycleTheme();
        } else if (e.code === 'Digit1') {
          this.setTheme(0);
        } else if (e.code === 'Digit2') {
          this.setTheme(1);
        } else if (e.code === 'Digit3') {
          this.setTheme(2);
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
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.flyingFoods = [];
    this.chefs.clear();
    this.botReactionTimers.clear();
    this.botTargetFood.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.chefs.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height - 110,
        vx: 0,
        chargeTime: 0,
        isCharging: false,
        bowlItems: [],
        loftAltitude: 0,
        vLoft: 0,
        shuntCooldown: 0,
        shuntActiveTimer: 0,
        shuntDir: 0,
        stunTimer: 0,
        score: 0,
        plattersServed: 0,
        combo: 0,
        isUnderdog: false,
        mood: 'idle',
        moodTimer: 0,
        animTimer: Math.random() * 5
      });
      this.botReactionTimers.set(p.id, 0.15 + Math.random() * 0.1);
      this.botTargetFood.set(p.id, null);
    });

    this.currentThemeIdx = 0;
    this.currentMapName = THEMES[0].name;
  }

  public cycleTheme(): void {
    this.currentThemeIdx = (this.currentThemeIdx + 1) % THEMES.length;
    this.currentMapName = THEMES[this.currentThemeIdx].name;
    this.audio.playTap();
  }

  public setTheme(index: number): void {
    if (index >= 0 && index < THEMES.length) {
      this.currentThemeIdx = index;
      this.currentMapName = THEMES[this.currentThemeIdx].name;
      this.audio.playTap();
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 30);
    }

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Identify leader score for Underdog surge
    let maxScore = 0;
    for (const c of this.chefs.values()) {
      if (c.score > maxScore) maxScore = c.score;
    }

    // Update bots
    this.updateBots(dt, width, height);

    // Spawning flying food parabolas
    this.foodSpawnTimer -= dt;
    const spawnRate = this.roundTimer < 15 ? 0.42 : 0.72;
    if (this.foodSpawnTimer <= 0) {
      this.foodSpawnTimer = spawnRate + Math.random() * 0.3;
      this.spawnFlyingFood(width);
    }

    // Update flying food
    for (let i = this.flyingFoods.length - 1; i >= 0; i--) {
      const f = this.flyingFoods[i];
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 240 * dt; // gravity
      f.rot += f.rotSpeed * dt;

      // Splat on iron griddle
      if (f.y > height - 70) {
        this.particles.emit(f.x, height - 75, 4, f.color);
        this.flyingFoods.splice(i, 1);
      }
    }

    // Update chefs
    for (const p of this.getActivePlayers()) {
      const chef = this.chefs.get(p.id);
      if (!chef) continue;

      chef.animTimer += dt;
      if (chef.moodTimer > 0) {
        chef.moodTimer -= dt;
        if (chef.moodTimer <= 0) chef.mood = 'idle';
      }

      // Check Underdog
      chef.isUnderdog = maxScore >= 35 && chef.score <= maxScore - 30;

      // Handle Stun
      if (chef.stunTimer > 0) {
        chef.stunTimer -= dt;
        chef.vx *= 0.85;
        chef.x += chef.vx * dt;
        chef.x = Math.max(45, Math.min(width - 45, chef.x));
        continue;
      }

      // Handle Shunt Cooldown & Active Timer
      if (chef.shuntCooldown > 0) chef.shuntCooldown -= dt;
      if (chef.shuntActiveTimer > 0) {
        chef.shuntActiveTimer -= dt;
        chef.vx = chef.shuntDir * 580;
        this.particles.emit(chef.x - chef.shuntDir * 16, chef.y - 15, 2, '#FF5722');
      }

      // Loft altitude physics
      if (chef.loftAltitude > 0 || chef.vLoft !== 0) {
        chef.loftAltitude += chef.vLoft * dt;
        chef.vLoft -= 580 * dt;
        if (chef.loftAltitude <= 0) {
          chef.loftAltitude = 0;
          chef.vLoft = 0;
        }
      }

      const steer = this.input.getSteer(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      const baseSpeed = chef.isUnderdog ? 330 : 270;

      // Hold-to-Charge Loft & Spatula Shunt
      if (isAction && chef.shuntActiveTimer <= 0) {
        chef.isCharging = true;
        chef.chargeTime = Math.min(1.0, chef.chargeTime + dt * 2.2);

        const chargeMoveSpeed = baseSpeed * 0.45;
        if (Math.abs(steer) > 0.15) {
          chef.vx = steer * chargeMoveSpeed;
        } else {
          chef.vx *= 0.8;
        }
      } else {
        if (chef.isCharging) {
          // Release: Flambé Loft or Spatula Shunt!
          chef.isCharging = false;
          if (chef.chargeTime > 0.2) {
            this.executeChefAction(chef, steer);
          }
          chef.chargeTime = 0;
        } else if (chef.shuntActiveTimer <= 0) {
          if (Math.abs(steer) > 0.15) {
            chef.vx = steer * baseSpeed;
          } else {
            chef.vx *= 0.82;
          }
        }
      }

      chef.x += chef.vx * dt;
      // Screen bounds
      if (chef.x < 50) {
        chef.x = 50;
        chef.vx = 0;
      }
      if (chef.x > width - 50) {
        chef.x = width - 50;
        chef.vx = 0;
      }

      // Catch Falling Food in Bowl
      const bowlX = chef.x + (chef.vx > 10 ? 12 : chef.vx < -10 ? -12 : 6);
      const bowlY = chef.y - 28;
      const catchRadius = chef.isUnderdog ? 36 : 26;

      for (let i = this.flyingFoods.length - 1; i >= 0; i--) {
        const f = this.flyingFoods[i];
        const dist = Math.hypot(f.x - bowlX, f.y - bowlY);

        if (dist < catchRadius + f.radius) {
          this.catchFood(chef, f);
          this.flyingFoods.splice(i, 1);
        }
      }
    }

    // Inter-Player Body & Shunt Collisions
    const chefsArr = this.getActivePlayers().map(p => this.chefs.get(p.id)!);
    for (let i = 0; i < chefsArr.length; i++) {
      for (let j = i + 1; j < chefsArr.length; j++) {
        const c1 = chefsArr[i];
        const c2 = chefsArr[j];
        const dist = Math.abs(c1.x - c2.x);
        const touchDist = 48;

        if (dist < touchDist) {
          const overlap = touchDist - dist;
          const dir = c1.x < c2.x ? -1 : 1;
          c1.x += dir * overlap * 0.5;
          c2.x -= dir * overlap * 0.5;

          // Check if one was shunting
          if (c1.shuntActiveTimer > 0 && c2.shuntActiveTimer <= 0) {
            this.executeSpatulaShunt(c1, c2, -dir);
          } else if (c2.shuntActiveTimer > 0 && c1.shuntActiveTimer <= 0) {
            this.executeSpatulaShunt(c2, c1, dir);
          } else {
            // Normal bump
            const avgVx = (c1.vx + c2.vx) * 0.5;
            c1.vx = avgVx + dir * 110;
            c2.vx = avgVx - dir * 110;
            this.audio.playBounce();
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private spawnFlyingFood(width: number): void {
    const margin = 70;
    const x = margin + Math.random() * (width - margin * 2);
    const isSuddenDeath = this.roundTimer < 15;
    let pool = FOOD_TEMPLATES;
    if (isSuddenDeath) {
      pool = [
        ...FOOD_TEMPLATES,
        FOOD_TEMPLATES[4], // Golden Wagyu
        FOOD_TEMPLATES[0]  // Tiger Shrimp
      ];
    }
    const template = pool[Math.floor(Math.random() * pool.length)];

    this.flyingFoods.push({
      id: this.nextFoodId++,
      name: template.name,
      color: template.color,
      points: template.points,
      radius: template.radius,
      isGolden: template.isGolden,
      isHazard: template.isHazard,
      x,
      y: 70,
      vx: (Math.random() - 0.5) * 80,
      vy: 110 + Math.random() * 60,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 3
    });
  }

  private catchFood(chef: TeppanyakiChef, food: FoodItem): void {
    if (food.isHazard) {
      // Burning ember! If not underdog, causes burn stun
      if (!chef.isUnderdog) {
        chef.score = Math.max(0, chef.score + food.points);
        chef.stunTimer = 0.85;
        chef.combo = 0;
        chef.mood = 'shocked';
        chef.moodTimer = 1.0;
        this.audio.playExplosion();
        this.screenShake = 6;
        this.particles.emit(chef.x, chef.y - 25, 12, food.color);
        return;
      }
    }

    chef.bowlItems.push(food.name);
    chef.score += food.points;
    chef.combo++;
    chef.mood = 'happy';
    chef.moodTimer = 0.6;
    this.audio.playTap();
    this.particles.emit(chef.x, chef.y - 25, 6, food.color);
  }

  private executeChefAction(chef: TeppanyakiChef, steer: number): void {
    // If moving horizontally with high force, trigger Spatula Shunt Dash!
    const wantsShunt = Math.abs(steer) > 0.35 && chef.shuntCooldown <= 0;
    if (wantsShunt) {
      chef.shuntActiveTimer = 0.22;
      chef.shuntDir = Math.sign(steer);
      chef.shuntCooldown = 0.8;
      this.audio.playWhoosh();
      this.particles.emit(chef.x, chef.y - 20, 10, '#FF5722');
      return;
    }

    // Otherwise, perform high-arc Hibachi Flambé Loft!
    chef.vLoft = 270;
    chef.loftAltitude = 10;

    if (chef.bowlItems.length === 0) {
      this.audio.playTap();
      return;
    }

    const inSweetSpot = chef.chargeTime >= 0.72 && chef.chargeTime <= 0.98;
    const multiplier = inSweetSpot ? 2.0 : 1.2;
    const itemCount = chef.bowlItems.length;
    const platterBonus = Math.round((25 + itemCount * 15 + chef.combo * 4) * multiplier);

    chef.score += platterBonus;
    chef.plattersServed++;
    chef.bowlItems = [];

    chef.mood = 'triumph';
    chef.moodTimer = 1.4;

    if (inSweetSpot) {
      this.audio.playFanfare();
      this.particles.emit(chef.x, chef.y - 45, 22, '#FFD54F');
      this.particles.emit(chef.x, chef.y - 45, 15, '#FF5722');
      this.screenShake = 8;
      this.hitStopTimer = 0.04;
    } else {
      this.audio.playScore();
      this.particles.emit(chef.x, chef.y - 35, 10, '#FF9800');
    }
  }

  private executeSpatulaShunt(attacker: TeppanyakiChef, victim: TeppanyakiChef, dir: number): void {
    attacker.score += 30; // Sabotage bonus
    attacker.mood = 'triumph';
    attacker.moodTimer = 1.2;

    victim.vx = dir * 420;
    victim.stunTimer = 0.75;
    victim.mood = 'shocked';
    victim.moodTimer = 1.2;

    // Pop loose food item out of victim's bowl into air for attacker to steal!
    if (victim.bowlItems.length > 0) {
      victim.bowlItems.pop();
      this.flyingFoods.push({
        id: this.nextFoodId++,
        name: 'Stolen Tiger Shrimp',
        color: '#FF7043',
        points: 25,
        radius: 14,
        x: victim.x,
        y: victim.y - 45,
        vx: -dir * 110,
        vy: -170,
        rot: 0,
        rotSpeed: 4
      });
    }

    this.audio.playExplosion();
    this.particles.emit((attacker.x + victim.x) * 0.5, attacker.y - 25, 18, '#FF5252');
    this.screenShake = 9;
    this.hitStopTimer = 0.045;
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

    const chef = this.chefs.get(botId);
    if (!chef || chef.stunTimer > 0) return;

    let delay = 0.24;
    let blunder = false;

    if (difficulty === 'bot_easy') {
      delay = 0.42;
      blunder = Math.random() < 0.22;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11;
    }

    // 1. If chef has 2+ items in bowl, perform loft
    if (chef.bowlItems.length >= 2 && chef.loftAltitude <= 5) {
      this.executeChefAction(chef, 0);
      this.botReactionTimers.set(botId, delay);
      return;
    }

    // 2. Hard bot: shunt nearby rivals
    if (difficulty === 'bot_hard' && chef.shuntCooldown <= 0) {
      for (const p of this.getActivePlayers()) {
        if (p.id === botId) continue;
        const rival = this.chefs.get(p.id);
        if (rival && Math.abs(rival.x - chef.x) < 80 && rival.bowlItems.length > 0) {
          const shuntDir = rival.x > chef.x ? 1 : -1;
          this.executeChefAction(chef, shuntDir);
          this.botReactionTimers.set(botId, 0.3);
          return;
        }
      }
    }

    // 3. Locate best falling food
    let bestFood: FoodItem | null = null;
    let bestScore = -9999;

    for (const f of this.flyingFoods) {
      if (f.isHazard) continue; // avoid embers
      let weight = f.points;
      if (f.isGolden) weight += 30;

      const timeToGround = Math.max(0.1, (chef.y - f.y) / Math.max(1, f.vy));
      const projectedX = f.x + f.vx * timeToGround;
      const dist = Math.abs(projectedX - chef.x);

      const score = weight - dist * 0.4;
      if (score > bestScore) {
        bestScore = score;
        bestFood = f;
      }
    }

    let steer = 0;
    if (bestFood) {
      const timeToCatch = Math.max(0.05, (chef.y - bestFood.y) / Math.max(1, bestFood.vy));
      const targetX = bestFood.x + bestFood.vx * timeToCatch;

      if (Math.abs(targetX - chef.x) > 16) {
        steer = targetX > chef.x ? 1 : -1;
      }
    }

    if (blunder) {
      steer = -steer;
    }

    this.input.setBotInput(botId, false, steer, 0, false);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const c = this.chefs.get(p.id);
      return {
        playerId: p.id,
        score: c?.score || 0,
        platters: c?.plattersServed || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topPlayer = scores[0];
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} served ${topPlayer.platters} succulent flambé teppanyaki platters!`
      : 'The hibachi grill cooled down with no master teppan chef!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIdx];

    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgTop);
    bgGrad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Backdrop
    this.renderThemeBackdrop(ctx, width, height, theme);

    // Iron Griddle Counter
    const griddleY = height - 90;
    ctx.fillStyle = theme.griddleColor;
    ctx.fillRect(0, griddleY, width, 90);

    ctx.fillStyle = theme.griddleTrim;
    ctx.fillRect(0, griddleY, width, 8);

    // Counter floor trim
    ctx.fillStyle = theme.counterColor;
    ctx.fillRect(0, height - 25, width, 25);

    // Render Flying Food
    for (const f of this.flyingFoods) {
      this.renderFoodItem(ctx, f);
    }

    // Render Chefs
    for (const p of this.getActivePlayers()) {
      const chef = this.chefs.get(p.id);
      if (!chef) continue;
      this.renderChef(ctx, p, chef, theme);
    }

    // Render Particles
    this.particles.render(ctx);

    ctx.restore();

    // UI Header & Theme Pill
    this.renderUI(ctx, width, height);
  }

  private renderThemeBackdrop(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: TeppanyakiTheme
  ): void {
    ctx.save();
    if (theme.id === 'ginza_steakhouse') {
      // Warm Amber Lanterns & Wood Paneling
      for (let x = 40; x < width; x += 110) {
        ctx.fillStyle = 'rgba(255, 112, 67, 0.15)';
        ctx.beginPath();
        ctx.ellipse(x, 80, 16, 20, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (theme.id === 'cyber_teppan') {
      // Laser Griddle Induction Lines
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
      ctx.lineWidth = 1.5;
      for (let x = 0; x < width; x += 55) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height - 90);
        ctx.stroke();
      }
    } else {
      // Osaka Street Festival Banners
      ctx.fillStyle = 'rgba(229, 57, 53, 0.15)';
      for (let x = 30; x < width; x += 70) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 35, 60);
        ctx.lineTo(x + 70, 0);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private renderFoodItem(ctx: CanvasRenderingContext2D, f: FoodItem): void {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);

    if (f.isGolden) {
      // Golden Wagyu Medallion
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFA000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Specular shine
      ctx.fillStyle = '#FFFDE7';
      ctx.beginPath();
      ctx.arc(-4, -4, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.isHazard) {
      // Burning ember
      ctx.fillStyle = '#263238';
      ctx.beginPath();
      ctx.rect(-f.radius, -f.radius, f.radius * 2, f.radius * 2);
      ctx.fill();

      ctx.fillStyle = '#FF5252';
      ctx.font = '900 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✕', 0, 0);
    } else {
      // Sizzling Tiger Shrimp / Veggie
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderChef(
    ctx: CanvasRenderingContext2D,
    p: PlayerConfig,
    chef: TeppanyakiChef,
    _theme: TeppanyakiTheme
  ): void {
    ctx.save();

    // Underdog Golden Glow Aura
    if (chef.isUnderdog) {
      ctx.save();
      const auraPulse = Math.sin(chef.animTimer * 8) * 6 + 18;
      const grad = ctx.createRadialGradient(chef.x, chef.y - 30, 10, chef.x, chef.y - 30, auraPulse + 25);
      grad.addColorStop(0, 'rgba(255, 215, 0, 0.45)');
      grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(chef.x, chef.y - 30, auraPulse + 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Charge Indicator Ring
    if (chef.chargeTime > 0) {
      ctx.save();
      const chargeRatio = chef.chargeTime / 1.0;
      ctx.strokeStyle = '#FF5722';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(chef.x, chef.y - 25, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargeRatio);
      ctx.stroke();
      ctx.restore();
    }

    // Draw Chef Mascot
    const isBot = p.type !== 'human';
    drawCharacter(
      ctx,
      chef.x,
      chef.y - 22,
      22,
      p.id,
      isBot,
      chef.mood,
      chef.animTimer,
      undefined
    );

    // Draw Chef Toque Hat
    ctx.save();
    ctx.translate(chef.x, chef.y - 44);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(12, 0);
    ctx.lineTo(14, -14);
    ctx.quadraticCurveTo(0, -24, -14, -14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Draw Spatula & Bowl in Chef's Hands
    const bowlX = chef.x + (chef.vx > 10 ? 14 : chef.vx < -10 ? -14 : 8);
    const bowlY = chef.y - 28;

    ctx.save();
    ctx.translate(bowlX, bowlY);

    // Ceramic Catch Bowl
    ctx.fillStyle = chef.isUnderdog ? '#FFD700' : '#ECEFF1';
    ctx.beginPath();
    ctx.arc(0, 8, chef.isUnderdog ? 22 : 16, 0, Math.PI);
    ctx.fill();

    ctx.strokeStyle = chef.isUnderdog ? '#FF8F00' : '#78909C';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dual Stainless Spatulas
    ctx.fillStyle = '#B0BEC5';
    ctx.fillRect(-14, -10, 5, 14);
    ctx.fillRect(9, -10, 5, 14);

    // Lofted Items inside Bowl
    const loftY = 2 - chef.loftAltitude;
    if (chef.bowlItems.length > 0) {
      ctx.fillStyle = '#FF7043';
      ctx.beginPath();
      ctx.arc(0, loftY, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Overhead Name & Score Badge
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(chef.x - 38, chef.y + 12, 76, 22, 6);
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.font = '900 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name}: ${chef.score}`, chef.x, chef.y + 27);
    ctx.restore();

    ctx.restore();
  }

  private renderUI(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Top-Center Safe Zone (y: 12-44) is strictly reserved for global timer
    // Minigame Header Badge strictly at y: 56
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 130, 56, 260, 28, 8);
    ctx.fill();

    ctx.fillStyle = '#FFD54F';
    ctx.font = '900 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🥩 TEPPANYAKI CATCH • ${THEMES[this.currentThemeIdx].name}`, width / 2, 70);
    ctx.restore();

    // Theme Pill (bottom-left at x: 20, y: height - 44, w: 170, h: 32)
    ctx.save();
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    ctx.fill();

    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#38BDF8';
    ctx.font = '900 11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`[T] ${THEMES[this.currentThemeIdx].name}`, pillX + 10, pillY + pillH / 2);
    ctx.restore();

    // Player Cards at Corners (Offset to y: height - 128 to never overlap Theme Pill)
    this.renderCornerPlayerCards(ctx, width, height);

    // Control Hints at Bottom Right
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(width - 260, height - 36, 240, 26, 6);
    ctx.fill();

    ctx.fillStyle = '#E2E8F0';
    ctx.font = '700 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('Steer: Move • Hold Action: Loft & Shunt', width - 28, height - 23);
    ctx.restore();
  }

  private renderCornerPlayerCards(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const chef = this.chefs.get(p.id);
      if (!chef) return;

      const cardW = 130;
      const cardH = 48;
      let cx = 20;
      let cy = height - 128; // safe offset above Theme Pill

      if (idx === 1) {
        cx = width - cardW - 20;
        cy = height - 128;
      } else if (idx === 2) {
        cx = 20;
        cy = 90;
      } else if (idx === 3) {
        cx = width - cardW - 20;
        cy = 90;
      }

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(cx, cy, cardW, cardH, 6);
      ctx.fill();

      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = '900 12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cx + 10, cy + 18);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 13px monospace';
      ctx.fillText(`${chef.score} pts`, cx + 10, cy + 36);

      ctx.fillStyle = '#FFD54F';
      ctx.font = '700 10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`🥩 ${chef.plattersServed}`, cx + cardW - 8, cy + 36);

      ctx.restore();
    });
  }
}
