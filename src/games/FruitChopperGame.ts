import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type FruitChopperThemeId = 'dojo' | 'cyber' | 'tiki';

interface FruitChopperTheme {
  id: FruitChopperThemeId;
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  matLineColor: string;
  borderWood: string;
  accentColor: string;
  petalColor: string;
}

const THEMES: Record<FruitChopperThemeId, FruitChopperTheme> = {
  dojo: {
    id: 'dojo',
    name: 'Bamboo Dojo',
    icon: '🎋',
    bgGradTop: '#1E1B4B',
    bgGradBottom: '#3B0764',
    matLineColor: 'rgba(251, 191, 36, 0.15)',
    borderWood: '#78350F',
    accentColor: '#F59E0B',
    petalColor: '#F472B6'
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Blade Dojo',
    icon: '⚡',
    bgGradTop: '#0B0F2A',
    bgGradBottom: '#030712',
    matLineColor: 'rgba(6, 182, 212, 0.18)',
    borderWood: '#1E1B4B',
    accentColor: '#06B6D4',
    petalColor: '#38BDF8'
  },
  tiki: {
    id: 'tiki',
    name: 'Tropical Tiki Oasis',
    icon: '🍍',
    bgGradTop: '#1E293B',
    bgGradBottom: '#0F172A',
    matLineColor: 'rgba(52, 211, 153, 0.15)',
    borderWood: '#451A03',
    accentColor: '#10B981',
    petalColor: '#FDE68A'
  }
};

const THEME_ORDER: FruitChopperThemeId[] = ['dojo', 'cyber', 'tiki'];

interface Fruit {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: 'watermelon' | 'pineapple' | 'orange' | 'strawberry' | 'dragonfruit' | 'bomb';
  points: number;
  rotation: number;
  rotSpeed: number;
  isSliced: boolean;
  half1X?: number;
  half1Y?: number;
  half2X?: number;
  half2Y?: number;
}

interface ChopperPlayer {
  id: PlayerId;
  bladeX: number;
  bladeY: number;
  score: number;
  slices: number;
  combos: number;
  stunTimer: number;
  slashAnim: number;
  chargeTime: number;
  isCharging: boolean;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  moodTimer: number;
  trail: { x: number; y: number }[];
}

export class FruitChopperGame extends BaseGame {
  public fruits: Fruit[] = [];
  public playersState: Map<PlayerId, ChopperPlayer> = new Map();
  public currentTheme: FruitChopperThemeId = 'dojo';
  public get currentMapName(): string {
    return THEMES[this.currentTheme].name;
  }

  private spawnTimer: number = 0.6;
  private fruitIdCounter: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private canvasRef: HTMLCanvasElement | null = null;

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
    this.setupListeners();
    this.reset(width, height);
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;

    this.keyHandler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 't') {
        this.cycleTheme();
      } else if (key === '1') {
        this.setTheme('dojo');
      } else if (key === '2') {
        this.setTheme('cyber');
      } else if (key === '3') {
        this.setTheme('tiki');
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    this.canvasRef = document.querySelector('canvas');
    if (this.canvasRef) {
      this.clickHandler = (e: MouseEvent) => {
        if (!this.canvasRef) return;
        const rect = this.canvasRef.getBoundingClientRect();
        const scaleX = this.canvasRef.width / rect.width;
        const scaleY = this.canvasRef.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        // Theme pill zone: x: 20, y: height - 44, w: 170, h: 32
        const pillY = this.canvasRef.height - 44;
        if (clickX >= 20 && clickX <= 190 && clickY >= pillY && clickY <= pillY + 32) {
          this.cycleTheme();
        }
      };
      this.canvasRef.addEventListener('click', this.clickHandler);
    }
  }

  public cycleTheme(): void {
    const idx = THEME_ORDER.indexOf(this.currentTheme);
    this.setTheme(THEME_ORDER[(idx + 1) % THEME_ORDER.length]);
  }

  public setTheme(themeId: FruitChopperThemeId): void {
    this.currentTheme = themeId;
    this.audio.playTap();
    this.particles.showFloatingText(
      `${THEMES[themeId].icon} ${THEMES[themeId].name}`,
      400,
      120,
      THEMES[themeId].accentColor,
      20
    );
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.fruits = [];
    this.playersState.clear();
    this.botReactionTimers.clear();
    this.spawnTimer = 0.5;
    this.fruitIdCounter = 0;

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        bladeX: width * 0.25 + idx * 130,
        bladeY: height * 0.5,
        score: 0,
        slices: 0,
        combos: 0,
        stunTimer: 0,
        slashAnim: 0,
        chargeTime: 0,
        isCharging: false,
        isUnderdog: false,
        currentMood: 'idle',
        moodTimer: 0,
        trail: []
      });
      this.botReactionTimers.set(p.id, 0.22 + Math.random() * 0.15);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Dynamic Underdog status
    const playersList = Array.from(this.playersState.values());
    const highestScore = Math.max(0, ...playersList.map((p) => p.score));
    playersList.forEach((p) => {
      p.isUnderdog = highestScore >= 300 && p.score <= highestScore - 180;
    });

    // Update bot decisions
    this.updateBots(dt, width, height);

    const isSuddenDeath = this.roundTimer <= 15.0;

    // Spawn fruit waves from bottom of screen
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = isSuddenDeath ? 0.35 + Math.random() * 0.25 : 0.65 + Math.random() * 0.35;
      this.spawnFruitWave(width, height, isSuddenDeath);
    }

    // Update flying fruits physics
    const gravity = 520;
    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const f = this.fruits[i];
      f.vy += gravity * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rotation += f.rotSpeed * dt;

      if (f.isSliced) {
        if (f.half1X !== undefined && f.half1Y !== undefined) {
          f.half1X -= 90 * dt;
          f.half1Y += 50 * dt;
        }
        if (f.half2X !== undefined && f.half2Y !== undefined) {
          f.half2X += 90 * dt;
          f.half2Y += 50 * dt;
        }
      }

      // Remove fruit fallen below screen
      if (f.y > height + 50) {
        this.fruits.splice(i, 1);
      }
    }

    // Update players blade movement & slicing
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.moodTimer > 0) {
        ps.moodTimer -= dt;
      } else {
        ps.currentMood = ps.isCharging ? 'focused' : 'idle';
      }

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        ps.currentMood = 'shocked';
        continue;
      }
      if (ps.slashAnim > 0) ps.slashAnim = Math.max(0, ps.slashAnim - dt * 5.0);

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const actionHeld = this.input.isActionPressed(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      const moveSpeed = ps.isUnderdog ? 500 : 430;
      ps.bladeX += steer * moveSpeed * dt;
      ps.bladeY += -throttle * moveSpeed * dt;

      ps.bladeX = Math.max(40, Math.min(width - 40, ps.bladeX));
      ps.bladeY = Math.max(60, Math.min(height - 60, ps.bladeY));

      // Blade trail
      ps.trail.push({ x: ps.bladeX, y: ps.bladeY });
      if (ps.trail.length > 12) ps.trail.shift();

      // Hold-to-Charge Whirlwind Iaido Slash
      if (actionHeld) {
        ps.isCharging = true;
        ps.chargeTime = Math.min(0.65, ps.chargeTime + dt);
        ps.currentMood = 'focused';
        if (Math.random() < 0.25) {
          this.particles.spawnSparks(ps.bladeX, ps.bladeY, p.color, 1);
        }
      } else if (ps.isCharging || justAction) {
        // Release Katana Slash!
        const isWhirlwind = ps.chargeTime >= 0.5;
        ps.isCharging = false;
        ps.chargeTime = 0;
        ps.slashAnim = 1.0;

        this.executeSlash(ps, p, isWhirlwind, isSuddenDeath);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private executeSlash(
    player: ChopperPlayer,
    pCfg: PlayerConfig,
    isWhirlwind: boolean,
    isSuddenDeath: boolean
  ): void {
    const slashRadius = (isWhirlwind ? 95 : 32) * (player.isUnderdog ? 1.4 : 1.0);
    this.audio.playLaser();
    this.particles.spawnSparks(player.bladeX, player.bladeY, pCfg.color, isWhirlwind ? 24 : 8);

    if (isWhirlwind) {
      this.particles.shake(6);
      this.particles.showFloatingText('IAIDO WHIRLWIND!', player.bladeX, player.bladeY - 30, '#F59E0B', 16);
    }

    let slicedCount = 0;
    const multiplier = (isSuddenDeath ? 2 : 1) * (isWhirlwind ? 1.5 : 1.0);

    for (const f of this.fruits) {
      if (f.isSliced) continue;
      const dist = Math.hypot(f.x - player.bladeX, f.y - player.bladeY);

      if (dist < f.radius + slashRadius) {
        if (f.type === 'bomb') {
          if (!player.isUnderdog) {
            // Bomb explosion penalty
            f.isSliced = true;
            player.stunTimer = 1.4;
            player.score = Math.max(0, player.score - 100);
            player.currentMood = 'shocked';
            player.moodTimer = 1.4;

            this.audio.playExplosion();
            this.particles.shake(8);
            this.particles.spawnExplosion(f.x, f.y, '#EF4444', 26);
            this.particles.showFloatingText('💣 -100 BOMB!', f.x, f.y - 20, '#EF4444', 16);
            break;
          } else {
            // Underdog Dragon Katana slices bombs safely for fireworks!
            f.isSliced = true;
            player.score += 100;
            this.audio.playFanfare();
            this.particles.spawnExplosion(f.x, f.y, '#FBBF24', 22);
            this.particles.showFloatingText('BOMB DEFLECTED! +100', f.x, f.y - 20, '#FBBF24', 15);
          }
        } else {
          // Slice fruit!
          f.isSliced = true;
          f.half1X = f.x - 8;
          f.half1Y = f.y;
          f.half2X = f.x + 8;
          f.half2Y = f.y;
          slicedCount++;

          const pts = Math.round(f.points * multiplier);
          player.slices += 1;
          player.score += pts;
          player.currentMood = 'triumph';
          player.moodTimer = 0.8;

          const splashColor =
            f.type === 'dragonfruit'
              ? '#EC4899'
              : f.type === 'watermelon'
              ? '#EF4444'
              : f.type === 'pineapple'
              ? '#F59E0B'
              : f.type === 'orange'
              ? '#EA580C'
              : '#E11D48';

          this.audio.playTap();
          this.particles.spawnSparks(f.x, f.y, splashColor, 18);
          this.particles.showFloatingText(`+${pts}`, f.x, f.y - 18, splashColor, 14);
        }
      }
    }

    // Multi-slice combo bonus
    if (slicedCount >= 2) {
      player.combos += 1;
      const comboBonus = Math.round(slicedCount * 60 * multiplier);
      player.score += comboBonus;
      this.audio.playScore();
      this.particles.shake(4);
      this.particles.showFloatingText(
        `COMBO x${slicedCount}! +${comboBonus}`,
        player.bladeX,
        player.bladeY - 24,
        '#F59E0B',
        16
      );
    }
  }

  private spawnFruitWave(width: number, height: number, isSuddenDeath: boolean): void {
    const maxWave = isSuddenDeath ? 4 : 3;
    const waveCount = Math.floor(1 + Math.random() * maxWave);
    const types: ('watermelon' | 'pineapple' | 'orange' | 'strawberry' | 'dragonfruit' | 'bomb')[] = [
      'watermelon',
      'pineapple',
      'orange',
      'strawberry',
      'dragonfruit',
      'bomb'
    ];

    for (let i = 0; i < waveCount; i++) {
      const spawnX = width * 0.18 + Math.random() * (width * 0.64);
      const spawnY = height + 20;

      const roll = Math.random();
      let type = types[Math.floor(Math.random() * 4)];
      let pts = 50;
      let radius = 22;

      if (roll < 0.18) {
        type = 'bomb';
        pts = 0;
        radius = 20;
      } else if (isSuddenDeath && roll < 0.38) {
        type = 'dragonfruit';
        pts = 220;
        radius = 26;
      } else if (type === 'watermelon') {
        pts = 60;
        radius = 28;
      } else if (type === 'pineapple') {
        pts = 80;
        radius = 25;
      } else if (type === 'strawberry') {
        pts = 40;
        radius = 18;
      }

      const vx = (Math.random() - 0.5) * 160;
      const vy = -460 - Math.random() * 140;

      this.fruits.push({
        id: this.fruitIdCounter++,
        x: spawnX,
        y: spawnY,
        vx,
        vy,
        radius,
        type,
        points: pts,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 4.0,
        isSliced: false
      });
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const bot = this.playersState.get(botId);
    if (!bot || bot.stunTimer > 0) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;

    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const interval =
      difficulty === 'bot_easy'
        ? 0.38 + Math.random() * 0.20
        : difficulty === 'bot_normal'
        ? 0.20 + Math.random() * 0.12
        : 0.08 + Math.random() * 0.05;
    this.botReactionTimers.set(botId, interval);

    // Accidental bomb strike on Easy/Normal
    const bombs = this.fruits.filter((f) => !f.isSliced && f.type === 'bomb');
    const bombMistake =
      difficulty === 'bot_easy' ? Math.random() < 0.20 : difficulty === 'bot_normal' ? Math.random() < 0.05 : false;
    if (bombs.length > 0 && bombMistake) {
      const bomb = bombs[0];
      bot.bladeX = bomb.x;
      bot.bladeY = bomb.y;
      const pCfg = this.players[botId];
      if (pCfg) this.executeSlash(bot, pCfg, false, this.roundTimer <= 15.0);
      return;
    }

    // Find active valid fruits
    const validFruits = this.fruits.filter((f) => !f.isSliced && f.type !== 'bomb');

    if (validFruits.length > 0) {
      if (difficulty === 'bot_easy' && Math.random() < 0.22) {
        return;
      }

      // Prioritize dragonfruit > pineapple > watermelon
      const target =
        validFruits.find((f) => f.type === 'dragonfruit') ||
        validFruits.find((f) => f.type === 'pineapple') ||
        validFruits[0];

      bot.bladeX = target.x;
      bot.bladeY = target.y;

      if (difficulty === 'bot_easy') {
        bot.bladeX += (Math.random() - 0.5) * 35;
        bot.bladeY += (Math.random() - 0.5) * 25;
      }

      const isWhirlwind = difficulty === 'bot_hard' && validFruits.length >= 2 && Math.random() < 0.45;
      const pCfg = this.players[botId];
      if (pCfg) {
        this.executeSlash(bot, pCfg, isWhirlwind, this.roundTimer <= 15.0);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const ps = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: ps?.score || 0,
        slices: ps?.slices || 0,
        combos: ps?.combos || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const theme = THEMES[this.currentTheme];
    const topSlices = scores[0]?.slices || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} sliced through the ${theme.name} with ${topSlices} clean katana cuts!`
      : 'All fruit fell to the floor intact!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentTheme];

    // 1. Dojo Arena Background
    const wallGrad = ctx.createLinearGradient(0, 0, 0, height);
    wallGrad.addColorStop(0, theme.bgGradTop);
    wallGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative tatami mat grid lines
    ctx.strokeStyle = theme.matLineColor;
    ctx.lineWidth = 1.5;
    for (let x = 0; x < width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Wooden border trim
    ctx.strokeStyle = theme.borderWood;
    ctx.lineWidth = 10;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    // 2. Flying Fruits
    for (const f of this.fruits) {
      ctx.save();

      if (f.isSliced) {
        // Draw 2 separate halves tumbling apart
        const h1X = f.half1X !== undefined ? f.half1X : f.x - 8;
        const h1Y = f.half1Y !== undefined ? f.half1Y : f.y;
        const h2X = f.half2X !== undefined ? f.half2X : f.x + 8;
        const h2Y = f.half2Y !== undefined ? f.half2Y : f.y;

        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(h1X, h1Y, f.radius * 0.75, 0, Math.PI);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(h2X, h2Y, f.radius * 0.75, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }

      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);

      if (f.type === 'watermelon') {
        // Green outer rind
        ctx.fillStyle = '#15803D';
        ctx.beginPath();
        ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
        ctx.fill();

        // Red juicy pulp
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(0, 0, f.radius - 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (f.type === 'pineapple') {
        // Amber pineapple body
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.ellipse(0, 0, f.radius * 0.8, f.radius, 0, 0, Math.PI * 2);
        ctx.fill();

        // Green crown
        ctx.fillStyle = '#16A34A';
        ctx.beginPath();
        ctx.moveTo(0, -f.radius);
        ctx.lineTo(-8, -f.radius - 12);
        ctx.lineTo(0, -f.radius - 16);
        ctx.lineTo(8, -f.radius - 12);
        ctx.closePath();
        ctx.fill();
      } else if (f.type === 'orange') {
        // Orange citrus
        ctx.fillStyle = '#EA580C';
        ctx.beginPath();
        ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (f.type === 'strawberry') {
        // Red strawberry
        ctx.fillStyle = '#E11D48';
        ctx.beginPath();
        ctx.moveTo(0, f.radius);
        ctx.lineTo(-f.radius, -f.radius * 0.5);
        ctx.lineTo(f.radius, -f.radius * 0.5);
        ctx.closePath();
        ctx.fill();
      } else if (f.type === 'dragonfruit') {
        // Pink mythic dragonfruit
        ctx.fillStyle = '#EC4899';
        ctx.beginPath();
        ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, 0, f.radius - 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (f.type === 'bomb') {
        // Black iron bomb with glowing spark fuse
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -f.radius);
        ctx.quadraticCurveTo(8, -f.radius - 8, 14, -f.radius - 6);
        ctx.stroke();

        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(14, -f.radius - 6, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // 3. Katana Blade Trails & Slicing Reticles
    for (const p of this.playersState.values()) {
      const cfg = this.players[p.id];
      const color = cfg ? cfg.color : '#FFFFFF';

      // Katana slash trail
      if (p.trail.length > 1) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        p.trail.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      ctx.save();
      // Charge ring
      if (p.isCharging && p.chargeTime > 0) {
        const ratio = p.chargeTime / 0.65;
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(p.bladeX, p.bladeY, 28, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
        ctx.stroke();
      }

      // Blade Crosshair
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.bladeX, p.bladeY, 16, 0, Math.PI * 2);
      ctx.stroke();

      // Blade slash effect
      if (p.slashAnim > 0) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p.bladeX - 28, p.bladeY - 28);
        ctx.lineTo(p.bladeX + 28, p.bladeY + 28);
        ctx.stroke();
      }

      // Stunned indicator
      if (p.stunTimer > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 12px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡STUNNED!', p.bladeX, p.bladeY + 28);
      }

      // Player Name Pill
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(p.bladeX - 22, p.bladeY - 26, 44, 14, 6);
      else ctx.rect(p.bladeX - 22, p.bladeY - 26, 44, 14);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 9px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cfg?.name.toUpperCase() || `P${p.id + 1}`, p.bladeX, p.bladeY - 19);

      ctx.restore();
    }

    // 4. Draw HUD & Safe-zone elements
    this.renderHUD(ctx, width, height);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const theme = THEMES[this.currentTheme];

    // Minigame Header at y: 56, h: 26 (NEVER overlaps global timer at y: 12-44)
    const headerW = 300;
    const headerH = 26;
    const headerX = width * 0.5 - headerW * 0.5;
    const headerY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(headerX, headerY, headerW, headerH, 6);
    else ctx.rect(headerX, headerY, headerW, headerH);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const isSuddenDeath = this.roundTimer <= 15.0;
    const headerText = isSuddenDeath
      ? `🍉 GOLDEN HARVEST 2X: ${Math.ceil(this.roundTimer)}s 🍉`
      : `${theme.icon} FRUIT CHOPPER — ${theme.name.toUpperCase()}`;
    ctx.fillText(headerText, width * 0.5, headerY + headerH * 0.5);

    // Interactive Theme Pill at bottom-left: x: 20, y: height - 44, w: 170, h: 32
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name}`, pillX + 12, pillY + pillH * 0.5);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '900 9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('[T]', pillX + pillW - 10, pillY + pillH * 0.5);

    // Bottom Right Controls Hint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '600 11px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('WASD / Arrows: Move Blade | Hold Action: Iaido Slash', width - 20, height - 28);

    // Corner Player Cards offset to y: height - 128 (avoids theme pill at y: height - 44)
    const active = this.getActivePlayers();
    const cardW = 110;
    const cardH = 50;

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      let cx = 20;
      let cy = height - 128;

      if (idx === 1) {
        cx = width - cardW - 20;
        cy = height - 128;
      } else if (idx === 2) {
        cx = 20;
        cy = 94;
      } else if (idx === 3) {
        cx = width - cardW - 20;
        cy = 94;
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx, cy, cardW, cardH, 8);
      else ctx.rect(cx, cy, cardW, cardH);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Mascot preview in card
      const isBot = p.type !== 'human';
      const mood: CharacterMood = ps ? ps.currentMood : 'idle';
      drawCharacter(ctx, cx + 22, cy + 25, 14, p.id, isBot, mood, performance.now() * 0.001);

      // Score / Status
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(p.name, cx + 42, cy + 8);

      ctx.fillStyle = theme.accentColor;
      ctx.font = '900 12px "Chakra Petch", monospace';
      ctx.fillText(`🍉 ${Math.round(ps?.score || 0)}`, cx + 42, cy + 26);
    });

    ctx.restore();
  }

  public syncDebug(): void {
    // Expose internal state for headless tests
    (window as any).__FRUIT_CHOPPER_DEBUG__ = {
      roundTimer: this.roundTimer,
      currentTheme: this.currentTheme,
      fruits: this.fruits.map((f) => ({
        id: f.id,
        type: f.type,
        isSliced: f.isSliced
      })),
      players: Array.from(this.playersState.values()).map((p) => ({
        id: p.id,
        score: p.score,
        slices: p.slices,
        combos: p.combos,
        isUnderdog: p.isUnderdog
      }))
    };
  }

  public destroy(): void {
    super.destroy();
    if (typeof window !== 'undefined') {
      if (this.keyHandler) {
        window.removeEventListener('keydown', this.keyHandler);
        this.keyHandler = null;
      }
      if (this.canvasRef && this.clickHandler) {
        this.canvasRef.removeEventListener('click', this.clickHandler);
        this.clickHandler = null;
      }
    }
  }
}
