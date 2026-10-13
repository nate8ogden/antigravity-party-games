import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface FruitType {
  name: string;
  color: string;
  points: number;
  radius: number;
  isGolden?: boolean;
  isHazard?: boolean;
}

const FRUIT_TYPES: FruitType[] = [
  { name: 'Strawberry', color: '#FF1744', points: 12, radius: 13 },
  { name: 'Banana', color: '#FFEA00', points: 15, radius: 14 },
  { name: 'Watermelon', color: '#00E676', points: 18, radius: 15 },
  { name: 'Pineapple', color: '#FF9100', points: 22, radius: 15 },
  { name: 'Golden Dragonfruit', color: '#FFD700', points: 42, radius: 16, isGolden: true },
  { name: 'Metal Spoon', color: '#90A4AE', points: -15, radius: 12, isHazard: true }
];

interface FallingFruit {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: FruitType;
  rot: number;
  rotSpeed: number;
}

interface BlenderPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  torque: number; // 0 to 100%
  isCharging: boolean;
  fruitsInJug: FruitType[];
  liquidLevel: number; // 0 to 100%
  liquidColor: string;
  bladeAngle: number;
  shuntCooldown: number;
  shuntActiveTimer: number;
  shuntDir: number;
  stunTimer: number;
  score: number;
  smoothiesServed: number;
  combo: number;
  isUnderdog: boolean;
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
}

interface BlenderTheme {
  id: string;
  name: string;
  icon: string;
  bgTop: string;
  bgBottom: string;
  barColor: string;
  barTrim: string;
  deckColor: string;
  accentColor: string;
}

const THEMES: BlenderTheme[] = [
  {
    id: 'tropical_tiki',
    name: 'Tropical Tiki Bar 🍹',
    icon: '🍹',
    bgTop: '#FFF8E1',
    bgBottom: '#FFE082',
    barColor: '#5D4037',
    barTrim: '#FFB300',
    deckColor: '#3E2723',
    accentColor: '#FF6D00'
  },
  {
    id: 'cyber_juice_lab',
    name: 'Cyber Juice Lab ⚡',
    icon: '⚡',
    bgTop: '#0A0E17',
    bgBottom: '#02050A',
    barColor: '#1A233A',
    barTrim: '#00E5FF',
    deckColor: '#0F1626',
    accentColor: '#00E5FF'
  },
  {
    id: 'mediterranean_bistro',
    name: 'Royal Mediterranean 🍇',
    icon: '🍇',
    bgTop: '#FBE9E7',
    bgBottom: '#FFCCBC',
    barColor: '#795548',
    barTrim: '#E64A19',
    deckColor: '#4E342E',
    accentColor: '#D84315'
  }
];

export class FruitBlenderGame extends BaseGame {
  public currentMapName: string = 'Tropical Tiki Bar 🍹';
  private currentThemeIdx: number = 0;

  private blenderPlayers: Map<PlayerId, BlenderPlayer> = new Map();
  private fallingFruits: FallingFruit[] = [];
  private nextFruitId: number = 1;
  private fruitSpawnTimer: number = 0.5;

  private botReactionTimers: Map<PlayerId, number> = new Map();
  private botTargetFruit: Map<PlayerId, number | null> = new Map();

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
    this.fallingFruits = [];
    this.blenderPlayers.clear();
    this.botReactionTimers.clear();
    this.botTargetFruit.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.blenderPlayers.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height - 110,
        vx: 0,
        torque: 0,
        isCharging: false,
        fruitsInJug: [],
        liquidLevel: 0,
        liquidColor: '#FF4081',
        bladeAngle: 0,
        shuntCooldown: 0,
        shuntActiveTimer: 0,
        shuntDir: 0,
        stunTimer: 0,
        score: 0,
        smoothiesServed: 0,
        combo: 0,
        isUnderdog: false,
        mood: 'idle',
        moodTimer: 0,
        animTimer: Math.random() * 5
      });
      this.botReactionTimers.set(p.id, 0.15 + Math.random() * 0.1);
      this.botTargetFruit.set(p.id, null);
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
    for (const bp of this.blenderPlayers.values()) {
      if (bp.score > maxScore) maxScore = bp.score;
    }

    // Update bots
    this.updateBots(dt, width, height);

    // Spawning falling fruits
    this.fruitSpawnTimer -= dt;
    const spawnRate = this.roundTimer < 15 ? 0.42 : 0.72;
    if (this.fruitSpawnTimer <= 0) {
      this.fruitSpawnTimer = spawnRate + Math.random() * 0.3;
      this.spawnFallingFruit(width);
    }

    // Update falling fruits
    for (let i = this.fallingFruits.length - 1; i >= 0; i--) {
      const f = this.fallingFruits[i];
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 230 * dt; // gravity
      f.rot += f.rotSpeed * dt;

      // Splat on bar counter
      if (f.y > height - 70) {
        this.particles.emit(f.x, height - 75, 4, f.type.color);
        this.fallingFruits.splice(i, 1);
      }
    }

    // Update blender chefs
    for (const p of this.getActivePlayers()) {
      const bp = this.blenderPlayers.get(p.id);
      if (!bp) continue;

      bp.animTimer += dt;
      if (bp.moodTimer > 0) {
        bp.moodTimer -= dt;
        if (bp.moodTimer <= 0) bp.mood = 'idle';
      }

      // Check Underdog
      bp.isUnderdog = maxScore >= 35 && bp.score <= maxScore - 30;

      // Handle Stun
      if (bp.stunTimer > 0) {
        bp.stunTimer -= dt;
        bp.vx *= 0.85;
        bp.x += bp.vx * dt;
        bp.x = Math.max(45, Math.min(width - 45, bp.x));
        continue;
      }

      // Blade spin animation
      const bladeSpeed = bp.isCharging ? 18 : 6;
      bp.bladeAngle += bladeSpeed * dt * Math.PI * 2;

      // Handle Shunt Cooldown & Active Timer
      if (bp.shuntCooldown > 0) bp.shuntCooldown -= dt;
      if (bp.shuntActiveTimer > 0) {
        bp.shuntActiveTimer -= dt;
        bp.vx = bp.shuntDir * 580;
        this.particles.emit(bp.x - bp.shuntDir * 16, bp.y - 15, 2, '#00E5FF');
      }

      const steer = this.input.getSteer(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      const baseSpeed = bp.isUnderdog ? 330 : 270;

      // Hold-to-Charge Torque & Blitz Action
      if (isAction && bp.shuntActiveTimer <= 0) {
        bp.isCharging = true;
        bp.torque = Math.min(100, bp.torque + 80 * dt);

        const chargeMoveSpeed = baseSpeed * 0.45;
        if (Math.abs(steer) > 0.15) {
          bp.vx = steer * chargeMoveSpeed;
        } else {
          bp.vx *= 0.8;
        }
      } else {
        if (bp.isCharging) {
          // Release: Execute Blitz Pulse or Pitcher Shunt!
          bp.isCharging = false;
          if (bp.torque > 0.2) {
            this.executeBlenderAction(bp, steer);
          }
          bp.torque = 0;
        } else if (bp.shuntActiveTimer <= 0) {
          if (Math.abs(steer) > 0.15) {
            bp.vx = steer * baseSpeed;
          } else {
            bp.vx *= 0.82;
          }
        }
      }

      bp.x += bp.vx * dt;
      // Screen bounds
      if (bp.x < 50) {
        bp.x = 50;
        bp.vx = 0;
      }
      if (bp.x > width - 50) {
        bp.x = width - 50;
        bp.vx = 0;
      }

      // Catch Falling Fruits into Jug
      const jugX = bp.x + (bp.vx > 10 ? 12 : bp.vx < -10 ? -12 : 6);
      const jugY = bp.y - 30;
      const catchRadius = bp.isUnderdog ? 36 : 26;

      for (let i = this.fallingFruits.length - 1; i >= 0; i--) {
        const f = this.fallingFruits[i];
        const dist = Math.hypot(f.x - jugX, f.y - jugY);

        if (dist < catchRadius + f.type.radius) {
          this.catchFruit(bp, f.type);
          this.fallingFruits.splice(i, 1);
        }
      }
    }

    // Inter-Player Body & Pitcher Shunt Collisions
    const chefsArr = this.getActivePlayers().map(p => this.blenderPlayers.get(p.id)!);
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
            this.executePitcherShunt(c1, c2, -dir);
          } else if (c2.shuntActiveTimer > 0 && c1.shuntActiveTimer <= 0) {
            this.executePitcherShunt(c2, c1, dir);
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

  private spawnFallingFruit(width: number): void {
    const margin = 70;
    const x = margin + Math.random() * (width - margin * 2);
    const isSuddenDeath = this.roundTimer < 15;
    let pool = FRUIT_TYPES;
    if (isSuddenDeath) {
      pool = [
        ...FRUIT_TYPES,
        FRUIT_TYPES[4], // Golden Dragonfruit
        FRUIT_TYPES[3]  // Pineapple
      ];
    }
    const template = pool[Math.floor(Math.random() * pool.length)];

    this.fallingFruits.push({
      id: this.nextFruitId++,
      x,
      y: 70,
      vx: (Math.random() - 0.5) * 80,
      vy: 110 + Math.random() * 60,
      type: template,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 3
    });
  }

  private catchFruit(bp: BlenderPlayer, fruit: FruitType): void {
    if (fruit.isHazard) {
      // Metal spoon! If not underdog, causes immediate blade jam stun
      if (!bp.isUnderdog) {
        bp.score = Math.max(0, bp.score + fruit.points);
        bp.stunTimer = 0.85;
        bp.combo = 0;
        bp.mood = 'shocked';
        bp.moodTimer = 1.0;
        this.audio.playExplosion();
        this.screenShake = 6;
        this.particles.emit(bp.x, bp.y - 30, 12, fruit.color);
        return;
      }
    }

    bp.fruitsInJug.push(fruit);
    bp.liquidLevel = Math.min(100, bp.liquidLevel + 25);
    bp.liquidColor = fruit.color;
    bp.score += fruit.points;
    bp.mood = 'happy';
    bp.moodTimer = 0.6;
    this.audio.playTap();
    this.particles.emit(bp.x, bp.y - 30, 6, fruit.color);
  }

  private executeBlenderAction(bp: BlenderPlayer, steer: number): void {
    // If holding lateral direction strongly and near a rival, trigger Pitcher Shunt!
    const wantsShunt = Math.abs(steer) > 0.35 && bp.shuntCooldown <= 0;
    if (wantsShunt) {
      bp.shuntActiveTimer = 0.22;
      bp.shuntDir = Math.sign(steer);
      bp.shuntCooldown = 0.8;
      this.audio.playWhoosh();
      this.particles.emit(bp.x, bp.y - 20, 10, '#00E5FF');
      return;
    }

    // Otherwise, execute Master Tropical Smoothie Blitz!
    if (bp.fruitsInJug.length === 0) {
      // Empty whir
      this.audio.playTap();
      return;
    }

    const inSweetSpot = bp.torque >= 70 && bp.torque <= 98;
    const multiplier = inSweetSpot ? 2.0 : 1.2;
    const fruitCount = bp.fruitsInJug.length;
    const smoothieBonus = Math.round((25 + fruitCount * 15 + bp.combo * 4) * multiplier);

    bp.score += smoothieBonus;
    bp.smoothiesServed++;
    bp.combo++;
    bp.fruitsInJug = [];
    bp.liquidLevel = 0;

    bp.mood = 'triumph';
    bp.moodTimer = 1.4;

    if (inSweetSpot) {
      this.audio.playFanfare();
      this.particles.emit(bp.x, bp.y - 45, 22, bp.liquidColor);
      this.particles.emit(bp.x, bp.y - 45, 14, '#FFD700');
      this.screenShake = 8;
      this.hitStopTimer = 0.04;
    } else {
      this.audio.playScore();
      this.particles.emit(bp.x, bp.y - 35, 10, bp.liquidColor);
    }
  }

  private executePitcherShunt(attacker: BlenderPlayer, victim: BlenderPlayer, dir: number): void {
    attacker.score += 30; // Sabotage bonus
    attacker.mood = 'triumph';
    attacker.moodTimer = 1.2;

    victim.vx = dir * 420;
    victim.stunTimer = 0.75;
    victim.mood = 'shocked';
    victim.moodTimer = 1.2;

    // Dislodge 1-2 fruits from victim's blender into air for attacker to steal!
    if (victim.fruitsInJug.length > 0) {
      const stolen = victim.fruitsInJug.pop()!;
      this.fallingFruits.push({
        id: this.nextFruitId++,
        x: victim.x,
        y: victim.y - 45,
        vx: -dir * 110,
        vy: -170,
        type: stolen,
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

    const bp = this.blenderPlayers.get(botId);
    if (!bp || bp.stunTimer > 0) return;

    let delay = 0.24;
    let blunder = false;

    if (difficulty === 'bot_easy') {
      delay = 0.42;
      blunder = Math.random() < 0.22;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11;
    }

    // 1. If pitcher has 2+ fruits, trigger blitz
    if (bp.fruitsInJug.length >= 2) {
      this.executeBlenderAction(bp, 0);
      this.botReactionTimers.set(botId, delay);
      return;
    }

    // 2. Hard bot: pitcher shunt nearby rivals
    if (difficulty === 'bot_hard' && bp.shuntCooldown <= 0) {
      for (const p of this.getActivePlayers()) {
        if (p.id === botId) continue;
        const rival = this.blenderPlayers.get(p.id);
        if (rival && Math.abs(rival.x - bp.x) < 80 && rival.fruitsInJug.length > 0) {
          const shuntDir = rival.x > bp.x ? 1 : -1;
          this.executeBlenderAction(bp, shuntDir);
          this.botReactionTimers.set(botId, 0.3);
          return;
        }
      }
    }

    // 3. Locate best falling fruit
    let bestFruit: FallingFruit | null = null;
    let bestScore = -9999;

    for (const f of this.fallingFruits) {
      if (f.type.isHazard) continue; // avoid spoons
      let weight = f.type.points;
      if (f.type.isGolden) weight += 30;

      const timeToGround = Math.max(0.1, (bp.y - f.y) / Math.max(1, f.vy));
      const projectedX = f.x + f.vx * timeToGround;
      const dist = Math.abs(projectedX - bp.x);

      const score = weight - dist * 0.4;
      if (score > bestScore) {
        bestScore = score;
        bestFruit = f;
      }
    }

    let steer = 0;
    if (bestFruit) {
      const timeToCatch = Math.max(0.05, (bp.y - bestFruit.y) / Math.max(1, bestFruit.vy));
      const targetX = bestFruit.x + bestFruit.vx * timeToCatch;

      if (Math.abs(targetX - bp.x) > 16) {
        steer = targetX > bp.x ? 1 : -1;
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
      const bp = this.blenderPlayers.get(p.id);
      return {
        playerId: p.id,
        score: bp?.score || 0,
        smoothies: bp?.smoothiesServed || 0
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
      ? `Player ${winnerId + 1} served ${topPlayer.smoothies} fresh tropical master smoothies!`
      : 'The blender counter was covered in spilled fruit nectar!';

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

    // Tropical Bar Counter
    const barY = height - 90;
    ctx.fillStyle = theme.barColor;
    ctx.fillRect(0, barY, width, 90);

    ctx.fillStyle = theme.barTrim;
    ctx.fillRect(0, barY, width, 8);

    // Floor deck
    ctx.fillStyle = theme.deckColor;
    ctx.fillRect(0, height - 25, width, 25);

    // Render Falling Fruits
    for (const f of this.fallingFruits) {
      this.renderFruitItem(ctx, f);
    }

    // Render Blender Chefs
    for (const p of this.getActivePlayers()) {
      const bp = this.blenderPlayers.get(p.id);
      if (!bp) continue;
      this.renderBlenderPlayer(ctx, p, bp, theme);
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
    theme: BlenderTheme
  ): void {
    ctx.save();
    if (theme.id === 'tropical_tiki') {
      // Palm Thatch Awning
      ctx.fillStyle = 'rgba(93, 64, 55, 0.15)';
      for (let x = 20; x < width; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 40, 70);
        ctx.lineTo(x + 80, 0);
        ctx.closePath();
        ctx.fill();
      }
    } else if (theme.id === 'cyber_juice_lab') {
      // Glowing Hologram Centrifuges
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
      ctx.lineWidth = 1.5;
      for (let x = 0; x < width; x += 55) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height - 90);
        ctx.stroke();
      }
    } else {
      // Mediterranean Sunlit Arches
      ctx.fillStyle = 'rgba(216, 67, 21, 0.12)';
      for (let x = 40; x < width; x += 110) {
        ctx.fillRect(x, 40, 30, height - 130);
      }
    }
    ctx.restore();
  }

  private renderFruitItem(ctx: CanvasRenderingContext2D, f: FallingFruit): void {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);

    if (f.type.isGolden) {
      // Golden Dragonfruit
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(0, 0, f.type.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFA000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Specular highlight
      ctx.fillStyle = '#FFFDE7';
      ctx.beginPath();
      ctx.arc(-4, -4, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.type.isHazard) {
      // Metal spoon
      ctx.fillStyle = '#90A4AE';
      ctx.beginPath();
      ctx.rect(-4, -f.type.radius, 8, f.type.radius * 2);
      ctx.fill();

      ctx.fillStyle = '#FF5252';
      ctx.font = '900 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✕', 0, 0);
    } else {
      // Fresh Fruit sphere
      ctx.fillStyle = f.type.color;
      ctx.beginPath();
      ctx.arc(0, 0, f.type.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderBlenderPlayer(
    ctx: CanvasRenderingContext2D,
    p: PlayerConfig,
    bp: BlenderPlayer,
    _theme: BlenderTheme
  ): void {
    ctx.save();

    // Underdog Golden Glow Aura
    if (bp.isUnderdog) {
      ctx.save();
      const auraPulse = Math.sin(bp.animTimer * 8) * 6 + 18;
      const grad = ctx.createRadialGradient(bp.x, bp.y - 30, 10, bp.x, bp.y - 30, auraPulse + 25);
      grad.addColorStop(0, 'rgba(255, 215, 0, 0.45)');
      grad.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bp.x, bp.y - 30, auraPulse + 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Torque Charge Ring
    if (bp.torque > 0) {
      ctx.save();
      const chargeRatio = bp.torque / 100;
      ctx.strokeStyle = '#FF6D00';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(bp.x, bp.y - 25, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargeRatio);
      ctx.stroke();
      ctx.restore();
    }

    // Draw Chef Mascot
    const isBot = p.type !== 'human';
    drawCharacter(
      ctx,
      bp.x,
      bp.y - 22,
      22,
      p.id,
      isBot,
      bp.mood,
      bp.animTimer,
      undefined
    );

    // Draw Chef Toque Hat
    ctx.save();
    ctx.translate(bp.x, bp.y - 44);
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

    // Draw Blender Pitcher in Chef's Hands
    const jugX = bp.x + (bp.vx > 10 ? 14 : bp.vx < -10 ? -14 : 8);
    const jugY = bp.y - 28;

    ctx.save();
    ctx.translate(jugX, jugY);

    // Glass Jar Body (Trapezoid)
    ctx.fillStyle = bp.isUnderdog ? 'rgba(255, 215, 0, 0.35)' : 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.moveTo(-10, -20);
    ctx.lineTo(10, -20);
    ctx.lineTo(7, 10);
    ctx.lineTo(-7, 10);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = bp.isUnderdog ? '#FFD700' : 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Liquid inside jug
    if (bp.liquidLevel > 0) {
      const liquidH = (bp.liquidLevel / 100) * 24;
      ctx.fillStyle = bp.liquidColor;
      ctx.beginPath();
      ctx.rect(-6, 10 - liquidH, 12, liquidH);
      ctx.fill();
    }

    // Blender Motor Base
    ctx.fillStyle = '#37474F';
    ctx.fillRect(-8, 10, 16, 8);

    // Spinning Blade inside base
    ctx.save();
    ctx.translate(0, 8);
    ctx.rotate(bp.bladeAngle);
    ctx.strokeStyle = '#CFD8DC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.stroke();
    ctx.restore();

    ctx.restore();

    // Overhead Name & Score Badge
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(bp.x - 38, bp.y + 12, 76, 22, 6);
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.font = '900 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name}: ${bp.score}`, bp.x, bp.y + 27);
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
    ctx.fillText(`🍹 FRUIT BLENDER • ${THEMES[this.currentThemeIdx].name}`, width / 2, 70);
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
    ctx.fillText('Steer: Move • Hold Action: Blitz & Shunt', width - 28, height - 23);
    ctx.restore();
  }

  private renderCornerPlayerCards(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const bp = this.blenderPlayers.get(p.id);
      if (!bp) return;

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
      ctx.fillText(`${bp.score} pts`, cx + 10, cy + 36);

      ctx.fillStyle = '#FFD54F';
      ctx.font = '700 10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`🍹 ${bp.smoothiesServed}`, cx + cardW - 8, cy + 36);

      ctx.restore();
    });
  }
}
