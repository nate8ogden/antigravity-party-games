import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type PancakeThemeId = 'retro_diner' | 'cyber_kitchen' | 'royal_patisserie';

interface KitchenTheme {
  id: PancakeThemeId;
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  counterColor: string;
  griddleSurface: string;
  griddleGlow: string;
  accentColor: string;
  pancakeGolden: string;
  pancakeBurnt: string;
}

const THEMES: Record<PancakeThemeId, KitchenTheme> = {
  retro_diner: {
    id: 'retro_diner',
    name: 'Retro Breakfast Diner',
    icon: '🥞',
    bgGradTop: '#2b1810',
    bgGradBottom: '#140a06',
    counterColor: '#334155',
    griddleSurface: '#1e293b',
    griddleGlow: 'rgba(245, 158, 11, 0.25)',
    accentColor: '#f59e0b',
    pancakeGolden: '#f59e0b',
    pancakeBurnt: '#3f1d14'
  },
  cyber_kitchen: {
    id: 'cyber_kitchen',
    name: 'Cyber Molecular Kitchen',
    icon: '⚡',
    bgGradTop: '#09101d',
    bgGradBottom: '#04070d',
    counterColor: '#0f172a',
    griddleSurface: '#0284c7',
    griddleGlow: 'rgba(0, 240, 255, 0.3)',
    accentColor: '#00f0ff',
    pancakeGolden: '#38bdf8',
    pancakeBurnt: '#1e293b'
  },
  royal_patisserie: {
    id: 'royal_patisserie',
    name: 'Royal French Patisserie',
    icon: '👑',
    bgGradTop: '#230b1e',
    bgGradBottom: '#0f040d',
    counterColor: '#4a153b',
    griddleSurface: '#831843',
    griddleGlow: 'rgba(244, 114, 182, 0.25)',
    accentColor: '#f472b6',
    pancakeGolden: '#fbbf24',
    pancakeBurnt: '#2d0612'
  }
};

const THEME_ORDER: PancakeThemeId[] = ['retro_diner', 'cyber_kitchen', 'royal_patisserie'];

interface FlyingPancake {
  id: number;
  ownerId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  quality: 'golden' | 'burnt' | 'souffle';
  isAirborne: boolean;
}

interface ChefStation {
  id: PlayerId;
  x: number;
  y: number;
  targetX: number;
  panX: number;
  panY: number;
  // Griddle cooking state
  pancakeState: 'empty' | 'raw' | 'golden' | 'overcooked' | 'burnt';
  pancakeType: 'standard' | 'blueberry' | 'souffle';
  cookTimer: number;
  // Hold-to-Charge Spatula
  isChargingFlip: boolean;
  flipChargeTimer: number;
  flipAnim: number;
  stackHeight: number;
  score: number;
  combo: number;
  shuntCooldown: number;
  lastShovedBy: PlayerId | null;
  stunTimer: number;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  animTime: number;
}

interface FloatingPancakeText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export class PancakeFlipperGame extends BaseGame {
  public currentTheme: PancakeThemeId = 'retro_diner';
  public playersState: Map<PlayerId, ChefStation> = new Map();

  private flyingPancakes: FlyingPancake[] = [];
  private flyingIdCounter: number = 0;
  private floatingTexts: FloatingPancakeText[] = [];
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
          this.setTheme('retro_diner');
        } else if (e.key === '2') {
          this.setTheme('cyber_kitchen');
        } else if (e.key === '3') {
          this.setTheme('royal_patisserie');
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

  public setTheme(theme: PancakeThemeId): void {
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
    this.flyingPancakes = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.animTimer = 0;
    this.flyingIdCounter = 0;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const startX = spacing * (idx + 1);
      const startY = height * 0.58;

      this.playersState.set(p.id, {
        id: p.id,
        x: startX,
        y: startY,
        targetX: startX,
        panX: startX + 28,
        panY: startY + 22,
        pancakeState: 'raw',
        pancakeType: Math.random() < 0.25 ? 'blueberry' : 'standard',
        cookTimer: 0.8 + Math.random() * 0.4,
        isChargingFlip: false,
        flipChargeTimer: 0,
        flipAnim: 0,
        stackHeight: 0,
        score: 0,
        combo: 0,
        shuntCooldown: 0,
        lastShovedBy: null,
        stunTimer: 0,
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

    // Underdog status calculation
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

    // Update each chef station
    for (const p of active) {
      const chef = this.playersState.get(p.id);
      if (!chef) continue;

      chef.animTime += dt * 5;
      if (chef.flipAnim > 0) chef.flipAnim = Math.max(0, chef.flipAnim - dt * 4);
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
        // Lateral Chef Movement along counter
        const moveSpeed = (chef.isUnderdog ? 280 : 220) * dt;
        chef.x += steer * moveSpeed;
        chef.x = Math.max(70, Math.min(width - 70, chef.x));
        chef.panX = chef.x + 28;

        // Cooking lifecycle progression in the pan
        if (chef.pancakeState === 'raw') {
          chef.cookTimer -= dt;
          if (chef.cookTimer <= 0) {
            chef.pancakeState = 'golden'; // Golden sweet spot!
            chef.cookTimer = 1.1; // Window to flip
            this.particles.spawnSparks(chef.panX, chef.panY - 10, '#fef08a', 4);
          }
        } else if (chef.pancakeState === 'golden') {
          chef.cookTimer -= dt;
          if (chef.cookTimer <= 0) {
            chef.pancakeState = 'overcooked';
            chef.cookTimer = 0.9;
          }
        } else if (chef.pancakeState === 'overcooked') {
          chef.cookTimer -= dt;
          if (chef.cookTimer <= 0) {
            chef.pancakeState = 'burnt';
            chef.cookTimer = 1.4;
            this.particles.emit(chef.panX, chef.panY - 10, 4, '#1c1917');
          }
        } else if (chef.pancakeState === 'burnt') {
          chef.cookTimer -= dt;
          if (chef.cookTimer <= 0) {
            // Auto trash burnt pancake
            chef.pancakeState = 'raw';
            chef.pancakeType = this.roundTimer <= 15 ? 'souffle' : Math.random() < 0.3 ? 'blueberry' : 'standard';
            chef.cookTimer = 1.0 + Math.random() * 0.4;
          }
        }

        // Hold-to-Charge Spatula Loft Flip
        if (isAction) {
          chef.isChargingFlip = true;
          chef.flipChargeTimer += dt;
          chef.currentMood = 'focused';

          if (Math.random() < 0.25) {
            this.particles.spawnSparks(chef.panX, chef.panY - 6, '#facc15', 1);
          }
        } else {
          // Release: Launch pancake flip into the air!
          if (chef.isChargingFlip && chef.flipChargeTimer >= 0.15) {
            chef.isChargingFlip = false;
            chef.flipAnim = 1.0;

            const chargeRatio = Math.min(1.0, chef.flipChargeTimer / 1.2);
            this.executePancakeFlip(chef, chargeRatio);

            chef.flipChargeTimer = 0;
          } else {
            chef.isChargingFlip = false;
            chef.flipChargeTimer = 0;
          }
        }
      }
    }

    // Update Flying Airborne Pancakes
    for (let i = this.flyingPancakes.length - 1; i >= 0; i--) {
      const fp = this.flyingPancakes[i];
      fp.vy += 700 * dt; // Gravity
      fp.x += fp.vx * dt;
      fp.y += fp.vy * dt;
      fp.rotation += fp.rotSpeed * dt;

      // Check collision/catch with all chef pans
      let caught = false;
      for (const p of active) {
        const chef = this.playersState.get(p.id);
        if (!chef) continue;

        const panDist = Math.hypot(fp.x - chef.panX, fp.y - chef.panY);
        const catchThreshold = chef.isUnderdog ? 38 : 26;

        if (panDist < catchThreshold && fp.vy > 0) {
          // Pancake caught!
          caught = true;
          const isSteal = fp.ownerId !== chef.id;

          if (fp.quality === 'burnt') {
            // Burnt splat
            chef.score = Math.max(0, chef.score - 10);
            chef.combo = 0;
            chef.stunTimer = 0.5;
            this.audio.playExplosion();
            this.particles.emit(chef.panX, chef.panY, 8, '#262626');
            this.addFloatingText('🔥 BURNT SPLAT! -10', chef.panX, chef.panY - 25, '#ef4444', 15);
            chef.currentMood = 'shocked';
          } else {
            // Delicious cooked pancake catch!
            chef.stackHeight++;
            chef.combo++;

            let baseVal = fp.quality === 'souffle' ? 50 : 20;
            if (isSteal) baseVal += 20; // Steal bonus!

            const mult = this.roundTimer <= 15 ? 2 : 1;
            const pts = (baseVal + chef.combo * 3) * mult;
            chef.score += pts;

            this.audio.playScore();
            this.particles.spawnConfetti(chef.panX, chef.panY, 15);

            if (isSteal) {
              this.hitStopTimer = 0.045; // 45ms hit-stop on steal
              this.screenShake = 6;
              this.addFloatingText(`🥞 PANCAKE HEIST! +${pts}`, chef.panX, chef.panY - 30, '#facc15', 17);
              // Disappoint the victim
              const victim = this.playersState.get(fp.ownerId);
              if (victim) victim.currentMood = 'shocked';
            } else {
              this.addFloatingText(`🥞 TALL LOFT! +${pts}`, chef.panX, chef.panY - 25, '#10b981', 15);
            }
            chef.currentMood = 'triumph';
          }

          this.flyingPancakes.splice(i, 1);
          break;
        }
      }

      // Check pancake hit counter floor or offscreen
      if (!caught && fp.y > height * 0.72) {
        this.audio.playBounce();
        this.particles.spawnSparks(fp.x, height * 0.72, '#94a3b8', 6);
        this.flyingPancakes.splice(i, 1);
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
        if (dist < 42) {
          const midX = (c1.x + c2.x) / 2;
          this.audio.playBounce();
          this.hitStopTimer = 0.035;
          this.screenShake = 5;
          this.particles.spawnSparks(midX, c1.y, '#f59e0b', 8);

          // Elastic separation along counter
          const pushSign = c1.x < c2.x ? -1 : 1;
          const shuntForce = 60 * (c1.isUnderdog || c2.isUnderdog ? 1.5 : 1.0);

          c1.x += pushSign * shuntForce;
          c2.x -= pushSign * shuntForce;

          if (c1.shuntCooldown <= 0 && c2.shuntCooldown <= 0) {
            c1.shuntCooldown = 1.0;
            c2.shuntCooldown = 1.0;
            c1.score += 25;
            c2.stunTimer = 0.4;
            c2.lastShovedBy = p1.id;
            c2.currentMood = 'shocked';
            c1.currentMood = 'triumph';
            this.addFloatingText('💥 CHEF SHUNT! +25', midX, c1.y - 30, p1.color, 15);
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private executePancakeFlip(chef: ChefStation, chargeRatio: number): void {
    if (chef.pancakeState === 'raw') {
      // Early flip: soggy raw batter splatters in pan
      chef.combo = 0;
      chef.score = Math.max(0, chef.score - 5);
      this.audio.playBounce();
      this.particles.emit(chef.panX, chef.panY, 8, '#fef9c3');
      this.addFloatingText('SOGGY RAW BATTER! -5', chef.panX, chef.panY - 20, '#ef4444', 13);
      chef.currentMood = 'shocked';

      chef.pancakeState = 'raw';
      chef.cookTimer = 1.0;
      return;
    }

    const isGolden = chef.pancakeState === 'golden' || chef.pancakeState === 'overcooked';
    const isBurnt = chef.pancakeState === 'burnt';
    const isSouffle = chef.pancakeType === 'souffle';

    // Velocity scale based on hold charge
    const upwardVel = -380 - chargeRatio * 240;
    // Lateral loft based on chef aim / steer
    const lateralVel = (Math.random() - 0.5) * (chargeRatio * 160);

    this.flyingPancakes.push({
      id: ++this.flyingIdCounter,
      ownerId: chef.id,
      x: chef.panX,
      y: chef.panY - 12,
      vx: lateralVel,
      vy: upwardVel,
      rotation: 0,
      rotSpeed: 6.0 + Math.random() * 4.0,
      quality: isBurnt ? 'burnt' : isSouffle ? 'souffle' : 'golden',
      isAirborne: true
    });

    this.audio.playWhoosh();
    this.particles.spawnSparks(chef.panX, chef.panY - 10, '#facc15', 6);

    // Reset pan with new raw batter
    chef.pancakeState = 'raw';
    chef.pancakeType = this.roundTimer <= 15 ? 'souffle' : Math.random() < 0.25 ? 'blueberry' : 'standard';
    chef.cookTimer = 1.0 + Math.random() * 0.4;
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
    let shouldFlip = false;

    // Check if there is an airborne golden pancake to catch or steal!
    let foundAirborne = false;
    for (const fp of this.flyingPancakes) {
      if (fp.quality !== 'burnt' && fp.vy > 0 && fp.y > 180) {
        // Move pan under the falling pancake
        targetX = fp.x - 28;
        foundAirborne = true;
        break;
      }
    }

    // If no airborne pancake, handle own pan
    if (!foundAirborne) {
      if (chef.pancakeState === 'golden') {
        if (chef.isChargingFlip) {
          // Release flip
          shouldFlip = false;
        } else {
          // Start charge
          shouldFlip = true;
        }
      } else if (chef.pancakeState === 'burnt') {
        shouldFlip = true; // Toss away
      }
    }

    // Apply blunder
    if (Math.random() < blunderChance) {
      targetX += (Math.random() - 0.5) * 120;
      if (Math.random() < 0.5) shouldFlip = true; // Premature flip!
    }

    targetX = Math.max(70, Math.min(width - 70, targetX));
    const steerErr = targetX - chef.x;
    const steer = Math.abs(steerErr) > 10 ? (steerErr > 0 ? 1 : -1) : 0;

    this.input.setBotInput(botId, shouldFlip, steer, 0, shouldFlip);
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
        stack: chef?.stackHeight || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topStack = scores[0]?.stack || 0;
    const mvpHighlight = winnerId !== null
      ? `Chef ${winnerId + 1} stacked a towering breakfast of ${topStack} golden pancakes!`
      : 'The breakfast kitchen was overwhelmed by burnt batter!';

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

    // 1. Kitchen Wall Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Diner Kitchen Tiles
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 45) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height * 0.7);
      ctx.stroke();
    }
    for (let y = 0; y < height * 0.7; y += 45) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Kitchen Griddle Counter
    ctx.fillStyle = theme.counterColor;
    ctx.fillRect(0, height * 0.7, width, height * 0.3);

    // Chrome Countertop Edge Trim
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, height * 0.7, width, 8);

    // 3. Render Chef Stations, Pans, & Stacks
    this.renderChefs(ctx, theme);

    // 4. Render Airborne Flying Pancakes
    this.renderFlyingPancakes(ctx, theme);

    // 5. Floating Text FX
    this.renderFloatingTexts(ctx);

    ctx.restore(); // Screen shake end

    // 6. Safe UI Layout
    this.renderUI(ctx, width, height, theme);
  }

  private renderChefs(ctx: CanvasRenderingContext2D, theme: KitchenTheme): void {
    const active = this.getActivePlayers();

    for (const p of active) {
      const chef = this.playersState.get(p.id);
      if (!chef) continue;

      const isBot = p.type !== 'human';

      // 1. Tower Stack on Counter
      const stackPlateX = chef.x - 32;
      const stackPlateY = chef.y + 38;

      ctx.save();
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.ellipse(stackPlateX, stackPlateY, 26, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Stacked golden pancakes
      const maxRenderStack = Math.min(10, chef.stackHeight);
      for (let s = 0; s < maxRenderStack; s++) {
        ctx.fillStyle = theme.pancakeGolden;
        ctx.beginPath();
        ctx.ellipse(stackPlateX, stackPlateY - 4 - s * 5, 22, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Butter Pat on top of stack
      if (chef.stackHeight > 0) {
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(stackPlateX - 5, stackPlateY - 9 - maxRenderStack * 5, 10, 6);
      }
      ctx.restore();

      // 2. Chef Mascot Character
      ctx.save();
      ctx.translate(chef.x, chef.y);

      // Underdog Golden Glow
      if (chef.isUnderdog) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Mascot Chef
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

      ctx.restore();

      // 3. Cast Iron Skillet & Cooking Batter
      ctx.save();
      const panLift = chef.flipAnim * 28;
      ctx.translate(chef.panX, chef.panY - panLift);

      // Skillet Handle
      ctx.fillStyle = '#475569';
      ctx.fillRect(-18, -4, 18, 6);

      // Skillet Bowl
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(14, 0, 26, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Cooking Pancake Batter inside skillet
      let pancakeColor = '#fef08a'; // raw
      if (chef.pancakeState === 'golden') pancakeColor = theme.pancakeGolden;
      else if (chef.pancakeState === 'overcooked') pancakeColor = '#b45309';
      else if (chef.pancakeState === 'burnt') pancakeColor = theme.pancakeBurnt;

      ctx.fillStyle = pancakeColor;
      ctx.beginPath();
      ctx.ellipse(14, 0, 19, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      // Golden Sweet Spot Steam & Indicator
      if (chef.pancakeState === 'golden') {
        ctx.fillStyle = '#facc15';
        ctx.font = '900 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⚡FLIP!', 14, -16);
      }

      // Flip Charge Tension Ring
      if (chef.isChargingFlip) {
        const prog = Math.min(1.0, chef.flipChargeTimer / 1.2);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(14, 0, 22, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      // Overhead Tag
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`P${p.id + 1}`, chef.x, chef.y - 28);
      ctx.restore();
    }
  }

  private renderFlyingPancakes(ctx: CanvasRenderingContext2D, theme: KitchenTheme): void {
    for (const fp of this.flyingPancakes) {
      ctx.save();
      ctx.translate(fp.x, fp.y);
      ctx.rotate(fp.rotation);

      if (fp.quality === 'souffle') {
        // Glowing Golden Souffle
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👑', 0, 0);
      } else if (fp.quality === 'burnt') {
        // Charred Burnt Pancake
        ctx.fillStyle = theme.pancakeBurnt;
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Golden Brown Fluffy Pancake
        ctx.fillStyle = theme.pancakeGolden;
        ctx.shadowColor = '#d97706';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-4, -3, 8, 4); // Butter pat
      }

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
    theme: KitchenTheme
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
    ctx.fillText('🥞 PANCAKE FLIPPER • HOLD TO LOFT FLIP & STEAL RIVALS', width / 2, badgeY + 18);
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
      ctx.fillText('⚡ SUDDEN DEATH: 2X STACK POINTS & GOLDEN SOUFFLE FRENZY! ⚡', width / 2, 105);
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

      // Score and stack
      ctx.font = '800 11px sans-serif';
      ctx.fillStyle = p.color;
      ctx.textAlign = 'left';
      ctx.fillText(`P${p.id + 1} (${chef.stackHeight} 🥞)`, cardX + 44, cardY + 20);

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
    ctx.fillText('STEER: Move Chef & Pan | HOLD: Loft Flip | CATCH: Catch & Steal', width - 20, height - 14);
    ctx.restore();
  }
}
