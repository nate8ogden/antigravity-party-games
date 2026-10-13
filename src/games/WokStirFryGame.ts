import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface WokIngredient {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  name: string;
  color: string;
  points: number;
  isHazard?: boolean;
  isGolden?: boolean;
  radius: number;
  rot: number;
  rotSpeed: number;
}

const INGREDIENT_TYPES = [
  { name: 'Dragon Noodles', color: '#FFD54F', points: 12, radius: 14 },
  { name: 'Crisp Bok Choy', color: '#66BB6A', points: 15, radius: 13 },
  { name: 'Shiitake Mushroom', color: '#8D6E63', points: 18, radius: 13 },
  { name: 'Fire Chili', color: '#FF3D00', points: 22, radius: 12 },
  { name: 'Golden King Prawn', color: '#FFD700', points: 38, radius: 15, isGolden: true },
  { name: 'Charred Charcoal', color: '#37474F', points: -15, radius: 12, isHazard: true }
];

interface WokChefPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  heat: number; // 0 to 100
  ingredientsInWok: number;
  tossAltitude: number;
  vToss: number;
  chargeTime: number;
  isCharging: boolean;
  bashCooldown: number;
  bashActiveTimer: number;
  bashDir: number;
  stunTimer: number;
  burnCooldown: number;
  score: number;
  dishesPrepared: number;
  combo: number;
  isUnderdog: boolean;
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
}

interface WokTheme {
  id: string;
  name: string;
  icon: string;
  bgTop: string;
  bgBottom: string;
  rangeColor: string;
  rangeTrim: string;
  burnerGlow: string;
  accentColor: string;
}

const THEMES: WokTheme[] = [
  {
    id: 'dragon_night_market',
    name: 'Dragon Night Market 🏮',
    icon: '🏮',
    bgTop: '#1F0B0B',
    bgBottom: '#100505',
    rangeColor: '#2B2B2B',
    rangeTrim: '#D32F2F',
    burnerGlow: '#FF5722',
    accentColor: '#FFD54F'
  },
  {
    id: 'cyber_teppanyaki',
    name: 'Cyber Teppanyaki ⚡',
    icon: '⚡',
    bgTop: '#080E18',
    bgBottom: '#02050A',
    rangeColor: '#1A233A',
    rangeTrim: '#00E5FF',
    burnerGlow: '#00E5FF',
    accentColor: '#00E5FF'
  },
  {
    id: 'royal_palace_wok',
    name: 'Royal Palace Wok 👑',
    icon: '👑',
    bgTop: '#1C1204',
    bgBottom: '#0A0601',
    rangeColor: '#3E2723',
    rangeTrim: '#FFB300',
    burnerGlow: '#FF9800',
    accentColor: '#FFB300'
  }
];

export class WokStirFryGame extends BaseGame {
  public currentMapName: string = 'Dragon Night Market 🏮';
  private currentThemeIdx: number = 0;

  private chefPlayers: Map<PlayerId, WokChefPlayer> = new Map();
  private flyingIngredients: WokIngredient[] = [];
  private nextIngId: number = 1;
  private ingSpawnTimer: number = 0.5;

  private botReactionTimers: Map<PlayerId, number> = new Map();
  private botTargetIng: Map<PlayerId, number | null> = new Map();

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
    this.flyingIngredients = [];
    this.chefPlayers.clear();
    this.botReactionTimers.clear();
    this.botTargetIng.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.chefPlayers.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height - 110,
        vx: 0,
        heat: 40,
        ingredientsInWok: 0,
        tossAltitude: 0,
        vToss: 0,
        chargeTime: 0,
        isCharging: false,
        bashCooldown: 0,
        bashActiveTimer: 0,
        bashDir: 0,
        stunTimer: 0,
        burnCooldown: 0,
        score: 0,
        dishesPrepared: 0,
        combo: 0,
        isUnderdog: false,
        mood: 'idle',
        moodTimer: 0,
        animTimer: Math.random() * 5
      });
      this.botReactionTimers.set(p.id, 0.15 + Math.random() * 0.1);
      this.botTargetIng.set(p.id, null);
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
    for (const cp of this.chefPlayers.values()) {
      if (cp.score > maxScore) maxScore = cp.score;
    }

    // Update bots
    this.updateBots(dt, width, height);

    // Spawning flying ingredients
    this.ingSpawnTimer -= dt;
    const spawnRate = this.roundTimer < 15 ? 0.42 : 0.7;
    if (this.ingSpawnTimer <= 0) {
      this.ingSpawnTimer = spawnRate + Math.random() * 0.3;
      this.spawnFlyingIngredient(width);
    }

    // Update flying ingredients
    for (let i = this.flyingIngredients.length - 1; i >= 0; i--) {
      const ing = this.flyingIngredients[i];
      ing.x += ing.vx * dt;
      ing.y += ing.vy * dt;
      ing.vy += 240 * dt; // gravity
      ing.rot += ing.rotSpeed * dt;

      // Drop to floor
      if (ing.y > height - 70) {
        this.particles.emit(ing.x, height - 75, 4, ing.color);
        this.flyingIngredients.splice(i, 1);
      }
    }

    // Update chefs
    for (const p of this.getActivePlayers()) {
      const chef = this.chefPlayers.get(p.id);
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

      // Natural wok heating from burner flames (18%/sec, faster during sudden death)
      const heatRate = this.roundTimer < 15 ? 24 : 17;
      chef.heat = Math.min(100, chef.heat + heatRate * dt);

      // Handle Bash Cooldown & Active Timer
      if (chef.bashCooldown > 0) chef.bashCooldown -= dt;
      if (chef.burnCooldown > 0) chef.burnCooldown -= dt;

      if (chef.bashActiveTimer > 0) {
        chef.bashActiveTimer -= dt;
        chef.vx = chef.bashDir * 600;
        this.particles.emit(chef.x - chef.bashDir * 18, chef.y - 15, 2, '#FF5722');
      }

      // Tossed ingredients altitude physics
      if (chef.tossAltitude > 0 || chef.vToss !== 0) {
        chef.tossAltitude += chef.vToss * dt;
        chef.vToss -= 600 * dt;
        if (chef.tossAltitude <= 0) {
          chef.tossAltitude = 0;
          chef.vToss = 0;
        }
      }

      const steer = this.input.getSteer(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      const baseSpeed = chef.isUnderdog ? 330 : 270;

      // Hold-to-Charge Toss & Bash
      if (isAction && chef.bashActiveTimer <= 0) {
        chef.isCharging = true;
        chef.chargeTime = Math.min(1.0, chef.chargeTime + dt * 2.2);
        const chargeSpeed = baseSpeed * 0.45;
        if (Math.abs(steer) > 0.15) {
          chef.vx = steer * chargeSpeed;
        } else {
          chef.vx *= 0.8;
        }
      } else {
        if (chef.isCharging) {
          // Release!
          chef.isCharging = false;
          if (chef.chargeTime > 0.2) {
            this.executeWokAction(chef, steer);
          }
          chef.chargeTime = 0;
        } else if (chef.bashActiveTimer <= 0) {
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

      // Check Wok Burn (Heat >= 100)
      if (chef.heat >= 100 && chef.burnCooldown <= 0) {
        this.triggerWokBurn(chef);
      }

      // Catch Falling Ingredients into Wok
      const wokX = chef.x + (chef.vx > 10 ? 12 : chef.vx < -10 ? -12 : 6);
      const wokY = chef.y - 28;
      const catchRadius = chef.isUnderdog ? 36 : 26;

      for (let i = this.flyingIngredients.length - 1; i >= 0; i--) {
        const ing = this.flyingIngredients[i];
        const dist = Math.hypot(ing.x - wokX, ing.y - wokY);

        if (dist < catchRadius + ing.radius) {
          this.catchIngredient(chef, ing);
          this.flyingIngredients.splice(i, 1);
        }
      }
    }

    // Inter-Player Body & Wok Bash Collisions
    const chefsArr = this.getActivePlayers().map(p => this.chefPlayers.get(p.id)!);
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

          // Check if one was bashing
          if (c1.bashActiveTimer > 0 && c2.bashActiveTimer <= 0) {
            this.executeBashImpact(c1, c2, -dir);
          } else if (c2.bashActiveTimer > 0 && c1.bashActiveTimer <= 0) {
            this.executeBashImpact(c2, c1, dir);
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

  private spawnFlyingIngredient(width: number): void {
    const margin = 70;
    const x = margin + Math.random() * (width - margin * 2);
    const isSuddenDeath = this.roundTimer < 15;
    let pool = INGREDIENT_TYPES;
    if (isSuddenDeath) {
      pool = [
        ...INGREDIENT_TYPES,
        INGREDIENT_TYPES[4], // Golden Prawn
        INGREDIENT_TYPES[3]  // Fire Chili
      ];
    }
    const template = pool[Math.floor(Math.random() * pool.length)];

    this.flyingIngredients.push({
      id: this.nextIngId++,
      x,
      y: 70,
      vx: (Math.random() - 0.5) * 80,
      vy: 110 + Math.random() * 60,
      name: template.name,
      color: template.color,
      points: template.points,
      isHazard: template.isHazard,
      isGolden: template.isGolden,
      radius: template.radius,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 3
    });
  }

  private catchIngredient(chef: WokChefPlayer, ing: WokIngredient): void {
    if (ing.isHazard) {
      // Charcoal hazard: reduces heat, stuns and deducts score
      chef.score = Math.max(0, chef.score + ing.points);
      chef.stunTimer = 0.8;
      chef.combo = 0;
      chef.ingredientsInWok = Math.max(0, chef.ingredientsInWok - 1);
      chef.mood = 'shocked';
      chef.moodTimer = 1.0;
      this.audio.playExplosion();
      this.screenShake = 6;
      this.particles.emit(chef.x, chef.y - 25, 12, ing.color);
      return;
    }

    chef.ingredientsInWok++;
    chef.score += ing.points;
    chef.combo++;
    chef.mood = 'happy';
    chef.moodTimer = 0.6;
    this.audio.playTap();
    this.particles.emit(chef.x, chef.y - 25, 6, ing.color);
  }

  private executeWokAction(chef: WokChefPlayer, steer: number): void {
    // Determine whether this action is a Flaming Toss or a Wok Bash:
    // If holding lateral direction strongly and near a rival, trigger Bash Dash!
    const wantsBash = Math.abs(steer) > 0.4 && chef.bashCooldown <= 0;

    if (wantsBash) {
      const dir = Math.sign(steer);
      chef.bashActiveTimer = 0.22;
      chef.bashDir = dir;
      chef.bashCooldown = 0.8;
      this.audio.playWhoosh();
      this.particles.emit(chef.x, chef.y - 20, 10, '#FF5722');
      return;
    }

    // Otherwise, perform high-altitude Wok Toss!
    chef.vToss = 280;
    chef.tossAltitude = 10;

    // Heat sweet-spot check:
    // Normal sweet spot: 70% to 92%. Underdog sweet spot: 55% to 98%.
    const minSweet = chef.isUnderdog ? 55 : 70;
    const maxSweet = chef.isUnderdog ? 98 : 92;
    const inSweetSpot = chef.heat >= minSweet && chef.heat <= maxSweet;

    // Tossing cools wok by 25%
    chef.heat = Math.max(15, chef.heat - 26);

    if (inSweetSpot) {
      chef.dishesPrepared++;
      const isMasterFlambe = chef.heat >= 75 || Math.random() < 0.35;
      const multiplier = isMasterFlambe ? 2.0 : 1.2;
      const dishBonus = Math.round((20 + chef.ingredientsInWok * 15 + chef.combo * 3) * multiplier);
      chef.score += dishBonus;
      chef.ingredientsInWok = 0; // successfully plated dish!

      chef.mood = 'triumph';
      chef.moodTimer = 1.4;

      if (isMasterFlambe) {
        this.audio.playFanfare();
        this.particles.emit(chef.x, chef.y - 45, 20, '#FFD54F');
        this.particles.emit(chef.x, chef.y - 45, 15, '#FF3D00');
        this.screenShake = 8;
        this.hitStopTimer = 0.04;
      } else {
        this.audio.playScore();
        this.particles.emit(chef.x, chef.y - 35, 10, '#FF9800');
      }
    } else {
      // Lukewarm toss
      chef.score += 5;
      this.audio.playTap();
      this.particles.emit(chef.x, chef.y - 25, 4, '#FFD54F');
    }
  }

  private triggerWokBurn(chef: WokChefPlayer): void {
    chef.heat = 40;
    chef.burnCooldown = 1.2;
    chef.combo = 0;
    chef.ingredientsInWok = 0;
    chef.score = Math.max(0, chef.score - 15);
    chef.stunTimer = 0.75;
    chef.mood = 'shocked';
    chef.moodTimer = 1.2;

    this.audio.playExplosion();
    this.particles.emit(chef.x, chef.y - 25, 14, '#3E2723');
    this.screenShake = 7;
  }

  private executeBashImpact(attacker: WokChefPlayer, victim: WokChefPlayer, dir: number): void {
    attacker.score += 30; // Sabotage bonus
    attacker.mood = 'triumph';
    attacker.moodTimer = 1.2;

    victim.vx = dir * 420;
    victim.stunTimer = 0.75;
    victim.mood = 'shocked';
    victim.moodTimer = 1.2;

    // Dislodge 1-2 ingredients from victim's wok into air
    if (victim.ingredientsInWok > 0) {
      victim.ingredientsInWok--;
      // Spawn flying ingredient for attacker to steal!
      this.flyingIngredients.push({
        id: this.nextIngId++,
        x: victim.x,
        y: victim.y - 40,
        vx: -dir * 120,
        vy: -180,
        name: 'Stolen Noodles',
        color: '#FFD54F',
        points: 20,
        radius: 13,
        rot: 0,
        rotSpeed: 4
      });
    }

    this.audio.playExplosion();
    this.particles.emit((attacker.x + victim.x) * 0.5, attacker.y - 25, 18, '#FF5252');
    this.screenShake = 10;
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

    const chef = this.chefPlayers.get(botId);
    if (!chef || chef.stunTimer > 0) return;

    let delay = 0.24;
    let blunder = false;

    if (difficulty === 'bot_easy') {
      delay = 0.42;
      blunder = Math.random() < 0.22;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11;
    }

    // 1. Heat management: if heat approaching 85%+, trigger toss to avoid burn
    if (chef.heat >= 84 && chef.tossAltitude <= 5) {
      this.executeWokAction(chef, 0);
      this.botReactionTimers.set(botId, delay);
      return;
    }

    // 2. Hard bot: bash nearby rivals who have ingredients
    if (difficulty === 'bot_hard' && chef.bashCooldown <= 0) {
      for (const p of this.getActivePlayers()) {
        if (p.id === botId) continue;
        const rival = this.chefPlayers.get(p.id);
        if (rival && Math.abs(rival.x - chef.x) < 80 && rival.ingredientsInWok > 0) {
          const bashDir = rival.x > chef.x ? 1 : -1;
          this.executeWokAction(chef, bashDir);
          this.botReactionTimers.set(botId, 0.3);
          return;
        }
      }
    }

    // 3. Track best falling ingredient
    let bestIng: WokIngredient | null = null;
    let bestScore = -9999;

    for (const ing of this.flyingIngredients) {
      if (ing.isHazard) continue; // avoid charcoal
      let weight = ing.points;
      if (ing.isGolden) weight += 25;

      const timeToWok = Math.max(0.1, (chef.y - ing.y) / Math.max(1, ing.vy));
      const projectedX = ing.x + ing.vx * timeToWok;
      const dist = Math.abs(projectedX - chef.x);

      const score = weight - dist * 0.4;
      if (score > bestScore) {
        bestScore = score;
        bestIng = ing;
      }
    }

    let steer = 0;
    if (bestIng) {
      const timeToCatch = Math.max(0.05, (chef.y - bestIng.y) / Math.max(1, bestIng.vy));
      const targetX = bestIng.x + bestIng.vx * timeToCatch;

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
      const chef = this.chefPlayers.get(p.id);
      return {
        playerId: p.id,
        score: chef?.score || 0,
        dishes: chef?.dishesPrepared || 0
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
      ? `Player ${winnerId + 1} served ${topPlayer.dishes} sizzling wok noodle platters!`
      : 'The wok fires burned out with no master chef!';

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

    // Decorative Theme Elements
    this.renderThemeBackdrop(ctx, width, height, theme);

    // Wok Range & Burner Gantries
    const rangeY = height - 90;
    ctx.fillStyle = theme.rangeColor;
    ctx.fillRect(0, rangeY, width, 90);

    ctx.fillStyle = theme.rangeTrim;
    ctx.fillRect(0, rangeY, width, 8);

    // Burner fire rings
    this.renderBurnerRings(ctx, width, rangeY, theme);

    // Render Flying Ingredients
    for (const ing of this.flyingIngredients) {
      this.renderIngredientItem(ctx, ing);
    }

    // Render Chef Players
    for (const p of this.getActivePlayers()) {
      const chef = this.chefPlayers.get(p.id);
      if (!chef) continue;
      this.renderChefPlayer(ctx, p, chef, theme);
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
    theme: WokTheme
  ): void {
    ctx.save();
    if (theme.id === 'dragon_night_market') {
      // Hanging Red Lanterns
      for (let x = 40; x < width; x += 110) {
        ctx.strokeStyle = '#8D6E63';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 70);
        ctx.stroke();

        // Lantern oval
        ctx.fillStyle = '#D32F2F';
        ctx.beginPath();
        ctx.ellipse(x, 85, 16, 20, 0, 0, Math.PI * 2);
        ctx.fill();

        // Lantern gold glow
        ctx.fillStyle = '#FFD54F';
        ctx.beginPath();
        ctx.ellipse(x, 85, 8, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (theme.id === 'cyber_teppanyaki') {
      // Neon Circuit Lines
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
      ctx.lineWidth = 1.5;
      for (let x = 0; x < width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height - 90);
        ctx.stroke();
      }
      for (let y = 0; y < height - 90; y += 45) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else {
      // Royal Palace Vermilion & Gold Pillars
      ctx.fillStyle = 'rgba(211, 47, 47, 0.12)';
      for (let x = 0; x < width; x += 120) {
        ctx.fillRect(x, 0, 30, height - 90);
      }
      ctx.fillStyle = 'rgba(255, 179, 0, 0.1)';
      ctx.fillRect(0, 80, width, 12);
    }
    ctx.restore();
  }

  private renderBurnerRings(
    ctx: CanvasRenderingContext2D,
    width: number,
    rangeY: number,
    theme: WokTheme
  ): void {
    ctx.save();
    const count = 5;
    const spacing = width / (count + 1);

    for (let i = 1; i <= count; i++) {
      const bx = spacing * i;
      const by = rangeY + 36;

      // Burner outer ring
      ctx.fillStyle = '#1C1C1C';
      ctx.beginPath();
      ctx.arc(bx, by, 24, 0, Math.PI * 2);
      ctx.fill();

      // Flame glow
      ctx.fillStyle = theme.burnerGlow;
      ctx.beginPath();
      ctx.arc(bx, by, 10 + Math.sin(this.roundTimer * 10 + i) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderIngredientItem(ctx: CanvasRenderingContext2D, ing: WokIngredient): void {
    ctx.save();
    ctx.translate(ing.x, ing.y);
    ctx.rotate(ing.rot);

    if (ing.isGolden) {
      // Golden King Prawn
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(0, 0, ing.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFA000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Specular shine
      ctx.fillStyle = '#FFFDE7';
      ctx.beginPath();
      ctx.arc(-4, -4, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (ing.isHazard) {
      // Charcoal
      ctx.fillStyle = '#263238';
      ctx.beginPath();
      ctx.rect(-ing.radius, -ing.radius, ing.radius * 2, ing.radius * 2);
      ctx.fill();

      ctx.fillStyle = '#FF5252';
      ctx.font = '900 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✕', 0, 0);
    } else {
      // Noodle / Vegetable
      ctx.fillStyle = ing.color;
      ctx.beginPath();
      ctx.arc(0, 0, ing.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderChefPlayer(
    ctx: CanvasRenderingContext2D,
    p: PlayerConfig,
    chef: WokChefPlayer,
    _theme: WokTheme
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

    // Draw Carbon Steel Wok Pan in Hands
    const wokX = chef.x + (chef.vx > 10 ? 14 : chef.vx < -10 ? -14 : 8);
    const wokY = chef.y - 26;

    ctx.save();
    ctx.translate(wokX, wokY);

    // Wok Bowl Geometry
    ctx.fillStyle = chef.isUnderdog ? '#FFB300' : '#212121';
    ctx.beginPath();
    ctx.arc(0, 10, chef.isUnderdog ? 28 : 22, 0, Math.PI);
    ctx.fill();

    ctx.strokeStyle = chef.isUnderdog ? '#FF6F00' : '#424242';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Wooden handle
    ctx.fillStyle = '#795548';
    ctx.fillRect(chef.isUnderdog ? 24 : 18, 4, 16, 6);

    // Airborne Stir-Fry Noodles/Ingredients
    const noodleY = 4 - chef.tossAltitude;
    ctx.fillStyle = '#FFD54F';
    ctx.beginPath();
    ctx.ellipse(0, noodleY, chef.isUnderdog ? 22 : 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ingredients in Wok indicator
    if (chef.ingredientsInWok > 0) {
      ctx.fillStyle = '#FF3D00';
      ctx.beginPath();
      ctx.arc(-4, noodleY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Wok Heat Bar above Chef Head
    const barW = 60;
    const barH = 6;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(chef.x - barW / 2, chef.y - 68, barW, barH);
    ctx.strokeStyle = '#78909C';
    ctx.strokeRect(chef.x - barW / 2, chef.y - 68, barW, barH);

    // Sweet Spot Indicator [70% to 92%]
    const sweetStart = chef.isUnderdog ? 0.55 : 0.70;
    const sweetWidth = chef.isUnderdog ? 0.43 : 0.22;
    ctx.fillStyle = 'rgba(76, 175, 80, 0.45)';
    ctx.fillRect(chef.x - barW / 2 + barW * sweetStart, chef.y - 68, barW * sweetWidth, barH);

    // Heat Level Fill
    const heatFill = (chef.heat / 100) * barW;
    ctx.fillStyle = chef.heat > 92 ? '#FF1744' : chef.heat > 70 ? '#4CAF50' : '#FF9800';
    ctx.fillRect(chef.x - barW / 2, chef.y - 68, heatFill, barH);
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
    // Top-Center Safe Zone (y: 12-44) is completely reserved for global timer
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
    ctx.fillText(`🥡 WOK STIR FRY • ${THEMES[this.currentThemeIdx].name}`, width / 2, 70);
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
    ctx.fillText('Steer: Move • Hold Action: Toss & Bash', width - 28, height - 23);
    ctx.restore();
  }

  private renderCornerPlayerCards(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const chef = this.chefPlayers.get(p.id);
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
      ctx.fillText(`🥡 ${chef.dishesPrepared}`, cx + cardW - 8, cy + 36);

      ctx.restore();
    });
  }
}
