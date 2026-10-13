import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type BumperBoatsThemeId = 'tropical' | 'cyber' | 'pirate';

interface BumperBoatsTheme {
  id: BumperBoatsThemeId;
  name: string;
  icon: string;
  waterGrad0: string;
  waterGrad1: string;
  vortexCore: string;
  vortexOuter: string;
  dockColor: string;
  dockHighlight: string;
  accentColor: string;
  waterStreamColor: string;
}

const THEMES: Record<BumperBoatsThemeId, BumperBoatsTheme> = {
  tropical: {
    id: 'tropical',
    name: 'Tropical Lagoon',
    icon: '🌴',
    waterGrad0: '#0284C7',
    waterGrad1: '#0369A1',
    vortexCore: '#082F49',
    vortexOuter: 'rgba(14, 165, 233, 0.45)',
    dockColor: '#78350F',
    dockHighlight: '#92400E',
    accentColor: '#38BDF8',
    waterStreamColor: '#BAE6FD'
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Waterpark',
    icon: '⚡',
    waterGrad0: '#1E1B4B',
    waterGrad1: '#0F172A',
    vortexCore: '#312E81',
    vortexOuter: 'rgba(99, 102, 241, 0.45)',
    dockColor: '#0F172A',
    dockHighlight: '#06B6D4',
    accentColor: '#06B6D4',
    waterStreamColor: '#38BDF8'
  },
  pirate: {
    id: 'pirate',
    name: 'Pirate Cove Bay',
    icon: '🏴‍☠️',
    waterGrad0: '#0F2937',
    waterGrad1: '#081720',
    vortexCore: '#020C12',
    vortexOuter: 'rgba(245, 158, 11, 0.35)',
    dockColor: '#451A03',
    dockHighlight: '#B45309',
    accentColor: '#F59E0B',
    waterStreamColor: '#FDE68A'
  }
};

const THEME_ORDER: BumperBoatsThemeId[] = ['tropical', 'cyber', 'pirate'];

interface WaterStream {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: PlayerId;
  life: number;
  isMega: boolean;
  radius: number;
}

interface BumperBoat {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  mass: number;
  score: number;
  bumps: number;
  cannonCooldown: number;
  chargeTime: number;
  isCharging: boolean;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  moodTimer: number;
  waterWake: { x: number; y: number; alpha: number }[];
}

export class BumperBoatsGame extends BaseGame {
  public boats: Map<PlayerId, BumperBoat> = new Map();
  public waterStreams: WaterStream[] = [];
  public currentTheme: BumperBoatsThemeId = 'tropical';
  public get currentMapName(): string {
    return THEMES[this.currentTheme].name;
  }

  private whirlpoolX: number = 400;
  private whirlpoolY: number = 300;
  private whirlpoolRadius: number = 75;
  private lagoonBounds = { minX: 60, maxX: 740, minY: 60, maxY: 540 };
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
        this.setTheme('tropical');
      } else if (key === '2') {
        this.setTheme('cyber');
      } else if (key === '3') {
        this.setTheme('pirate');
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

  public setTheme(themeId: BumperBoatsThemeId): void {
    this.currentTheme = themeId;
    this.audio.playTap();
    this.particles.showFloatingText(
      `${THEMES[themeId].icon} ${THEMES[themeId].name}`,
      this.whirlpoolX,
      this.whirlpoolY - 50,
      THEMES[themeId].accentColor,
      20
    );
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.boats.clear();
    this.waterStreams = [];
    this.botReactionTimers.clear();

    this.lagoonBounds = {
      minX: width * 0.08,
      maxX: width * 0.92,
      minY: height * 0.12,
      maxY: height * 0.88
    };

    this.whirlpoolX = width * 0.5;
    this.whirlpoolY = height * 0.5;
    this.whirlpoolRadius = Math.min(width, height) * 0.13;

    const active = this.getActivePlayers();
    const spawnAngleStep = (Math.PI * 2) / Math.max(1, active.length);
    const spawnDist = Math.min(width, height) * 0.32;

    active.forEach((p, idx) => {
      const ang = idx * spawnAngleStep;
      this.boats.set(p.id, {
        id: p.id,
        x: this.whirlpoolX + Math.cos(ang) * spawnDist,
        y: this.whirlpoolY + Math.sin(ang) * spawnDist,
        vx: 0,
        vy: 0,
        angle: ang + Math.PI,
        radius: 22,
        mass: 1.2,
        score: 0,
        bumps: 0,
        cannonCooldown: 0,
        chargeTime: 0,
        isCharging: false,
        isUnderdog: false,
        currentMood: 'idle',
        moodTimer: 0,
        waterWake: []
      });
      this.botReactionTimers.set(p.id, 0.25 + Math.random() * 0.15);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Dynamic Underdog status
    const boatsList = Array.from(this.boats.values());
    const highestScore = Math.max(0, ...boatsList.map((b) => b.score));
    boatsList.forEach((b) => {
      b.isUnderdog = highestScore >= 200 && b.score <= highestScore - 120;
    });

    // Update bot decisions
    this.updateBots(dt, width, height);

    const isSuddenDeath = this.roundTimer <= 15.0;
    const vortexScale = isSuddenDeath ? 1.35 : 1.0;
    const currentVortexRadius = this.whirlpoolRadius * vortexScale;

    // Update boats
    for (const p of this.getActivePlayers()) {
      const b = this.boats.get(p.id);
      if (!b) continue;

      if (b.cannonCooldown > 0) b.cannonCooldown -= dt;
      if (b.moodTimer > 0) {
        b.moodTimer -= dt;
      } else {
        b.currentMood = b.isCharging ? 'focused' : 'idle';
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const actionHeld = this.input.isActionPressed(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      // Rudder steering rotation
      if (steer !== 0) {
        b.angle += steer * dt * (b.isUnderdog ? 3.8 : 3.4);
      }

      // Propeller thrust forward and reverse
      const thrustPower = (b.isUnderdog ? 400 : 330);
      const thrust = throttle * thrustPower;
      b.vx += Math.cos(b.angle) * thrust * dt;
      b.vy += Math.sin(b.angle) * thrust * dt;

      // Water hydrodynamics drag
      b.vx *= Math.pow(0.965, dt * 60);
      b.vy *= Math.pow(0.965, dt * 60);

      // Central Whirlpool tangential vortex pull
      const dx = this.whirlpoolX - b.x;
      const dy = this.whirlpoolY - b.y;
      const distToVortex = Math.hypot(dx, dy);

      if (distToVortex < currentVortexRadius * 2.2 && distToVortex > 5) {
        const pull = (1 - distToVortex / (currentVortexRadius * 2.2)) * (isSuddenDeath ? 200 : 140);
        // Inward radial pull
        b.vx += (dx / distToVortex) * pull * dt;
        b.vy += (dy / distToVortex) * pull * dt;

        // Tangential rotational swirl
        const tanX = -dy / distToVortex;
        const tanY = dx / distToVortex;
        b.vx += tanX * pull * 1.3 * dt;
        b.vy += tanY * pull * 1.3 * dt;

        if (distToVortex < currentVortexRadius * 0.7) {
          b.currentMood = 'shocked';
          b.moodTimer = 0.5;
        }
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Water wake particle trail
      b.waterWake.push({
        x: b.x - Math.cos(b.angle) * b.radius,
        y: b.y - Math.sin(b.angle) * b.radius,
        alpha: 0.8
      });
      if (b.waterWake.length > 12) b.waterWake.shift();
      b.waterWake.forEach((w) => (w.alpha -= dt * 2.5));

      // Hold-to-Charge Mega Hydro Pump
      if (b.cannonCooldown <= 0) {
        if (actionHeld) {
          b.isCharging = true;
          b.chargeTime = Math.min(0.65, b.chargeTime + dt);
          b.currentMood = 'focused';
          if (Math.random() < 0.25) {
            this.particles.spawnSparks(b.x, b.y, THEMES[this.currentTheme].accentColor, 1);
          }
        } else if (b.isCharging || justAction) {
          // Release Water Cannon!
          const isMega = b.chargeTime >= 0.5;
          b.cannonCooldown = isMega ? 0.65 : 0.38;
          b.isCharging = false;
          b.chargeTime = 0;

          const streamSpeed = isMega ? 720 : 580;
          this.waterStreams.push({
            x: b.x + Math.cos(b.angle) * (b.radius + 8),
            y: b.y + Math.sin(b.angle) * (b.radius + 8),
            vx: Math.cos(b.angle) * streamSpeed,
            vy: Math.sin(b.angle) * streamSpeed,
            ownerId: b.id,
            life: isMega ? 0.65 : 0.48,
            isMega,
            radius: isMega ? 11 : 6
          });

          this.audio.playLaser();
          this.particles.shake(isMega ? 5 : 2);
          this.particles.spawnSparks(b.x, b.y, THEMES[this.currentTheme].waterStreamColor, isMega ? 14 : 7);
          if (isMega) {
            this.particles.showFloatingText('MEGA HYDRO!', b.x, b.y - 20, '#38BDF8', 14);
          }
        }
      } else {
        b.isCharging = false;
        b.chargeTime = 0;
      }

      // Lagoon rubber dock perimeter collisions
      if (b.x - b.radius < this.lagoonBounds.minX) {
        b.x = this.lagoonBounds.minX + b.radius;
        b.vx = -b.vx * 0.7;
        this.audio.playBounce();
      } else if (b.x + b.radius > this.lagoonBounds.maxX) {
        b.x = this.lagoonBounds.maxX - b.radius;
        b.vx = -b.vx * 0.7;
        this.audio.playBounce();
      }

      if (b.y - b.radius < this.lagoonBounds.minY) {
        b.y = this.lagoonBounds.minY + b.radius;
        b.vy = -b.vy * 0.7;
        this.audio.playBounce();
      } else if (b.y + b.radius > this.lagoonBounds.maxY) {
        b.y = this.lagoonBounds.maxY - b.radius;
        b.vy = -b.vy * 0.7;
        this.audio.playBounce();
      }

      // Passive score for staying clear of central whirlpool
      if (distToVortex > currentVortexRadius) {
        b.score += dt * 15;
      }
    }

    // Update water streams
    const multiplier = isSuddenDeath ? 2 : 1;
    for (let i = this.waterStreams.length - 1; i >= 0; i--) {
      const s = this.waterStreams[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;

      // Check collision with other boats
      for (const target of this.boats.values()) {
        if (target.id === s.ownerId) continue;

        const dist = Math.hypot(s.x - target.x, s.y - target.y);
        if (dist < target.radius + s.radius) {
          // Water blast knockback!
          const knockbackPower = s.isMega ? 0.75 : 0.45;
          target.vx += s.vx * knockbackPower;
          target.vy += s.vy * knockbackPower;

          const shooter = this.boats.get(s.ownerId);
          if (shooter) {
            const pts = (s.isMega ? 100 : 45) * multiplier;
            shooter.score += pts;
            shooter.currentMood = 'triumph';
            shooter.moodTimer = 0.8;
          }

          target.currentMood = 'shocked';
          target.moodTimer = 0.6;

          // Check if target was pushed into whirlpool!
          const distToVortex = Math.hypot(this.whirlpoolX - target.x, this.whirlpoolY - target.y);
          if (distToVortex < currentVortexRadius && shooter) {
            const dunkPts = 150 * multiplier;
            shooter.score += dunkPts;
            this.audio.playFanfare();
            this.particles.shake(6);
            this.particles.spawnExplosion(target.x, target.y, '#38BDF8', 22);
            this.particles.showFloatingText('VORTEX DUNK! +150', target.x, target.y - 24, '#F59E0B', 16);
          } else {
            this.audio.playBounce();
            this.particles.shake(s.isMega ? 4 : 2);
            this.particles.spawnSparks(target.x, target.y, THEMES[this.currentTheme].accentColor, 12);
          }

          s.life = 0;
          break;
        }
      }

      if (s.life <= 0) {
        this.waterStreams.splice(i, 1);
      }
    }

    // Boat vs Boat Elastic Bumper Collisions
    const bList = Array.from(this.boats.values());
    for (let i = 0; i < bList.length; i++) {
      for (let j = i + 1; j < bList.length; j++) {
        const b1 = bList[i];
        const b2 = bList[j];
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = b1.radius + b2.radius;

        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;

          const overlap = minDist - dist;
          b1.x -= nx * overlap * 0.5;
          b1.y -= ny * overlap * 0.5;
          b2.x += nx * overlap * 0.5;
          b2.y += ny * overlap * 0.5;

          const kx = b1.vx - b2.vx;
          const ky = b1.vy - b2.vy;
          const velAlongNormal = kx * nx + ky * ny;

          if (velAlongNormal > 0) {
            const m1 = b1.mass * (b1.isUnderdog ? 1.3 : 1.0);
            const m2 = b2.mass * (b2.isUnderdog ? 1.3 : 1.0);
            const impulse = (2 * velAlongNormal) / (m1 + m2);
            const elasticity = 1.45;

            b1.vx -= impulse * m2 * nx * elasticity;
            b1.vy -= impulse * m2 * ny * elasticity;
            b2.vx += impulse * m1 * nx * elasticity;
            b2.vy += impulse * m1 * ny * elasticity;

            b1.bumps += 1;
            b2.bumps += 1;
            b1.score += 15 * multiplier;
            b2.score += 15 * multiplier;

            this.audio.playBounce();
            this.particles.shake(4);
            this.particles.spawnSparks((b1.x + b2.x) / 2, (b1.y + b2.y) / 2, '#FFFFFF', 10);
          }
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
    const bot = this.boats.get(botId);
    if (!bot) return;

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

    // 1. Avoid whirlpool center if too close
    const distToVortex = Math.hypot(bot.x - this.whirlpoolX, bot.y - this.whirlpoolY);
    if (distToVortex < this.whirlpoolRadius * 1.5) {
      const escapeAngle = Math.atan2(bot.y - this.whirlpoolY, bot.x - this.whirlpoolX);
      bot.angle = escapeAngle;
      bot.vx += Math.cos(escapeAngle) * 280 * dt * 4;
      bot.vy += Math.sin(escapeAngle) * 280 * dt * 4;
      return;
    }

    // 2. Target nearest enemy boat
    const enemies = Array.from(this.boats.values()).filter((b) => b.id !== bot.id);
    if (enemies.length > 0) {
      const target = enemies.reduce((prev, curr) => {
        const d1 = Math.hypot(prev.x - bot.x, prev.y - bot.y);
        const d2 = Math.hypot(curr.x - bot.x, curr.y - bot.y);
        return d1 < d2 ? prev : curr;
      });

      let targetAngle = Math.atan2(target.y - bot.y, target.x - bot.x);
      if (difficulty === 'bot_easy') {
        targetAngle += (Math.random() - 0.5) * 0.55;
      } else if (difficulty === 'bot_hard') {
        // Predictive aim lead
        const leadTime = Math.hypot(target.x - bot.x, target.y - bot.y) / 600;
        targetAngle = Math.atan2(target.y + target.vy * leadTime - bot.y, target.x + target.vx * leadTime - bot.x);
      }

      bot.angle = targetAngle;
      bot.vx += Math.cos(targetAngle) * 280 * dt * 4;
      bot.vy += Math.sin(targetAngle) * 280 * dt * 4;

      const distToEnemy = Math.hypot(target.x - bot.x, target.y - bot.y);
      const shootChance = difficulty === 'bot_hard' ? 0.85 : difficulty === 'bot_normal' ? 0.55 : 0.3;
      if (distToEnemy < 220 && bot.cannonCooldown <= 0 && Math.random() < shootChance) {
        bot.cannonCooldown = 0.45;
        this.waterStreams.push({
          x: bot.x + Math.cos(bot.angle) * (bot.radius + 8),
          y: bot.y + Math.sin(bot.angle) * (bot.radius + 8),
          vx: Math.cos(bot.angle) * 600,
          vy: Math.sin(bot.angle) * 600,
          ownerId: bot.id,
          life: 0.5,
          isMega: difficulty === 'bot_hard' && Math.random() < 0.35,
          radius: 6
        });
        this.audio.playLaser();
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const b = this.boats.get(p.id);
      return {
        playerId: p.id,
        score: Math.round(b?.score || 0),
        bumps: b?.bumps || 0
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
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} captained the ${theme.name} with supreme water cannon blasts!`
      : 'All bumper boats got caught in the swirling whirlpool!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentTheme];

    // 1. Lagoon Water Background
    const waterGrad = ctx.createLinearGradient(0, 0, width, height);
    waterGrad.addColorStop(0, theme.waterGrad0);
    waterGrad.addColorStop(1, theme.waterGrad1);
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative water ripple waves
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    const now = performance.now() * 0.002;
    for (let y = 60; y < height - 60; y += 45) {
      ctx.beginPath();
      for (let x = 60; x < width - 60; x += 30) {
        const wy = y + Math.sin(now + x * 0.04) * 4;
        if (x === 60) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Whirlpool vortex at center
    ctx.save();
    const isSuddenDeath = this.roundTimer <= 15.0;
    const currentVortexRadius = this.whirlpoolRadius * (isSuddenDeath ? 1.35 : 1.0);

    const vortexGrad = ctx.createRadialGradient(
      this.whirlpoolX,
      this.whirlpoolY,
      8,
      this.whirlpoolX,
      this.whirlpoolY,
      currentVortexRadius * 1.8
    );
    vortexGrad.addColorStop(0, theme.vortexCore);
    vortexGrad.addColorStop(0.5, theme.vortexOuter);
    vortexGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = vortexGrad;
    ctx.beginPath();
    ctx.arc(this.whirlpoolX, this.whirlpoolY, currentVortexRadius * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Swirling vortex spiral arms
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = isSuddenDeath ? 3 : 2;
    ctx.beginPath();
    const spinOffset = performance.now() * 0.005;
    for (let a = 0; a < Math.PI * 4; a += 0.15) {
      const r = (a / (Math.PI * 4)) * currentVortexRadius;
      const vx = this.whirlpoolX + Math.cos(a + spinOffset) * r;
      const vy = this.whirlpoolY + Math.sin(a + spinOffset) * r;
      if (a === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }
    ctx.stroke();
    ctx.restore();

    // Lagoon wooden dock perimeter & tires
    ctx.strokeStyle = theme.dockColor;
    ctx.lineWidth = 14;
    ctx.strokeRect(
      this.lagoonBounds.minX,
      this.lagoonBounds.minY,
      this.lagoonBounds.maxX - this.lagoonBounds.minX,
      this.lagoonBounds.maxY - this.lagoonBounds.minY
    );

    ctx.strokeStyle = theme.dockHighlight;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(
      this.lagoonBounds.minX,
      this.lagoonBounds.minY,
      this.lagoonBounds.maxX - this.lagoonBounds.minX,
      this.lagoonBounds.maxY - this.lagoonBounds.minY
    );

    // 2. Water Stream Projectiles
    for (const s of this.waterStreams) {
      ctx.fillStyle = s.isMega ? '#38BDF8' : theme.waterStreamColor;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();

      // Specular highlight
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(s.x - 2, s.y - 2, s.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Draw Bumper Boats
    for (const b of this.boats.values()) {
      const cfg = this.players[b.id];
      const color = cfg ? cfg.color : '#FFFFFF';

      // Wake trail
      ctx.save();
      for (const w of b.waterWake) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, w.alpha)})`;
        ctx.beginPath();
        ctx.arc(w.x, w.y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.translate(b.x, b.y);

      // Underdog golden hydro shield
      if (b.isUnderdog) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, b.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Charge ring around boat
      if (b.isCharging && b.chargeTime > 0) {
        const ratio = b.chargeTime / 0.65;
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, b.radius + 4, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
        ctx.stroke();
      }

      ctx.rotate(b.angle);

      // Outer Inflatable Rubber Ring
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner Fiberglass Hull
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius - 4, 0, Math.PI * 2);
      ctx.fill();

      // Water Cannon Nozzle
      ctx.fillStyle = '#64748B';
      ctx.fillRect(b.radius - 6, -3, 12, 6);

      // Mascot sitting inside boat cockpit
      const isBot = cfg?.type !== 'human';
      drawCharacter(ctx, -2, 0, 10, b.id, isBot, b.currentMood, performance.now() * 0.001);

      ctx.restore();

      // Player Name Pill
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(b.x - 26, b.y - b.radius - 20, 52, 14, 6);
      else ctx.rect(b.x - 26, b.y - b.radius - 20, 52, 14);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 9px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cfg?.name.toUpperCase() || `P${b.id + 1}`, b.x, b.y - b.radius - 13);
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
      ? `🌪️ VORTEX SURGE 2X: ${Math.ceil(this.roundTimer)}s 🌪️`
      : `${theme.icon} BUMPER BOATS — ${theme.name.toUpperCase()}`;
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
    ctx.fillText('Steer: Turn | Throttle: Thrust | Hold Action: Mega Pump', width - 20, height - 28);

    // Corner Player Cards offset to y: height - 128 (avoids theme pill at y: height - 44)
    const active = this.getActivePlayers();
    const cardW = 110;
    const cardH = 50;

    active.forEach((p, idx) => {
      const b = this.boats.get(p.id);
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
      const mood: CharacterMood = b ? b.currentMood : 'idle';
      drawCharacter(ctx, cx + 22, cy + 25, 14, p.id, isBot, mood, performance.now() * 0.001);

      // Score / Status
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(p.name, cx + 42, cy + 8);

      ctx.fillStyle = theme.accentColor;
      ctx.font = '900 12px "Chakra Petch", monospace';
      ctx.fillText(`🚤 ${Math.round(b?.score || 0)}`, cx + 42, cy + 26);
    });

    ctx.restore();
  }

  public syncDebug(): void {
    // Expose internal state for headless tests
    (window as any).__BUMPER_BOATS_DEBUG__ = {
      roundTimer: this.roundTimer,
      currentTheme: this.currentTheme,
      whirlpoolRadius: this.whirlpoolRadius,
      boats: Array.from(this.boats.values()).map((b) => ({
        id: b.id,
        score: b.score,
        bumps: b.bumps,
        isUnderdog: b.isUnderdog
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
