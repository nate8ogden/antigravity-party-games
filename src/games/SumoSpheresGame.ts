import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type SumoSpheresThemeId = 'gyro' | 'cyber' | 'volcano';

interface SumoSpheresTheme {
  id: SumoSpheresThemeId;
  name: string;
  icon: string;
  bgGrad0: string;
  bgGrad1: string;
  platTop: string;
  platBottom: string;
  rimColor: string;
  accentColor: string;
  bumperColors: [string, string, string];
}

const THEMES: Record<SumoSpheresThemeId, SumoSpheresTheme> = {
  gyro: {
    id: 'gyro',
    name: 'Gyroscope Platform',
    icon: '⚙️',
    bgGrad0: '#1E1B4B',
    bgGrad1: '#020617',
    platTop: '#334155',
    platBottom: '#0F172A',
    rimColor: '#F59E0B',
    accentColor: '#38BDF8',
    bumperColors: ['#EC4899', '#06B6D4', '#F59E0B']
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Neon Arena',
    icon: '⚡',
    bgGrad0: '#0B0F2A',
    bgGrad1: '#030712',
    platTop: '#1E1B4B',
    platBottom: '#0F172A',
    rimColor: '#38BDF8',
    accentColor: '#A855F7',
    bumperColors: ['#38BDF8', '#A855F7', '#EC4899']
  },
  volcano: {
    id: 'volcano',
    name: 'Volcanic Caldera',
    icon: '🔥',
    bgGrad0: '#3F1212',
    bgGrad1: '#110303',
    platTop: '#451A1A',
    platBottom: '#1F0A0A',
    rimColor: '#EF4444',
    accentColor: '#F97316',
    bumperColors: ['#F97316', '#EF4444', '#EAB308']
  }
};

const THEME_ORDER: SumoSpheresThemeId[] = ['gyro', 'cyber', 'volcano'];

interface SpherePlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseMass: number;
  angle: number;
  rollAnim: number;
  isAlive: boolean;
  score: number;
  knockouts: number;
  turboCooldown: number;
  turboActiveTimer: number;
  chargeTime: number;
  isCharging: boolean;
  isUnderdog: boolean;
}

interface Bumper {
  x: number;
  y: number;
  radius: number;
  colorIndex: 0 | 1 | 2;
  pulse: number;
}

export class SumoSpheresGame extends BaseGame {
  public playersState: Map<PlayerId, SpherePlayer> = new Map();
  public arenaCenterX: number = 400;
  public arenaCenterY: number = 300;
  public arenaRadius: number = 240;
  public tiltX: number = 0;
  public tiltY: number = 0;

  public currentTheme: SumoSpheresThemeId = 'gyro';
  public get currentMapName(): string {
    return THEMES[this.currentTheme].name;
  }

  private initialArenaRadius: number = 240;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private botTargetAngles: Map<PlayerId, number> = new Map();
  private bumpers: Bumper[] = [];

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
        this.setTheme('gyro');
      } else if (key === '2') {
        this.setTheme('cyber');
      } else if (key === '3') {
        this.setTheme('volcano');
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

  public setTheme(themeId: SumoSpheresThemeId): void {
    this.currentTheme = themeId;
    this.audio.playTap();
    this.particles.showFloatingText(
      `${THEMES[themeId].icon} ${THEMES[themeId].name}`,
      this.arenaCenterX,
      this.arenaCenterY - 40,
      THEMES[themeId].accentColor,
      20
    );
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.playersState.clear();
    this.botReactionTimers.clear();
    this.botTargetAngles.clear();

    this.arenaCenterX = width * 0.5;
    this.arenaCenterY = height * 0.52;
    this.initialArenaRadius = Math.min(width, height) * 0.40;
    this.arenaRadius = this.initialArenaRadius;
    this.tiltX = 0;
    this.tiltY = 0;

    // 3 Dynamic Pinball Rebound Bumpers on Gyro Platform
    this.bumpers = [
      { x: this.arenaCenterX, y: this.arenaCenterY - this.arenaRadius * 0.35, radius: 20, colorIndex: 0, pulse: 0 },
      { x: this.arenaCenterX - this.arenaRadius * 0.32, y: this.arenaCenterY + this.arenaRadius * 0.22, radius: 20, colorIndex: 1, pulse: 0 },
      { x: this.arenaCenterX + this.arenaRadius * 0.32, y: this.arenaCenterY + this.arenaRadius * 0.22, radius: 20, colorIndex: 2, pulse: 0 }
    ];

    const active = this.getActivePlayers();
    const spawnAngleStep = (Math.PI * 2) / Math.max(1, active.length);
    const spawnDist = this.arenaRadius * 0.60;

    active.forEach((p, idx) => {
      const ang = idx * spawnAngleStep - Math.PI / 2;
      this.playersState.set(p.id, {
        id: p.id,
        x: this.arenaCenterX + Math.cos(ang) * spawnDist,
        y: this.arenaCenterY + Math.sin(ang) * spawnDist,
        vx: 0,
        vy: 0,
        radius: 23,
        baseMass: 1.0,
        angle: ang + Math.PI,
        rollAnim: 0,
        isAlive: true,
        score: 0,
        knockouts: 0,
        turboCooldown: 0,
        turboActiveTimer: 0,
        chargeTime: 0,
        isCharging: false,
        isUnderdog: false
      });
      this.botReactionTimers.set(p.id, 0.2 + Math.random() * 0.15);
      this.botTargetAngles.set(p.id, ang + Math.PI);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Dynamic Underdog status
    const playersList = Array.from(this.playersState.values());
    const highestScore = Math.max(0, ...playersList.map((p) => p.score));
    playersList.forEach((p) => {
      p.isUnderdog = p.isAlive && highestScore >= 120 && p.score <= highestScore - 80;
    });

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Calculate platform tilt from player weights
    let weightX = 0;
    let weightY = 0;
    let aliveCount = 0;

    for (const ps of this.playersState.values()) {
      if (!ps.isAlive) continue;
      const massMultiplier = ps.isUnderdog ? 1.4 : 1.0;
      weightX += ((ps.x - this.arenaCenterX) / this.arenaRadius) * massMultiplier;
      weightY += ((ps.y - this.arenaCenterY) / this.arenaRadius) * massMultiplier;
      aliveCount++;
    }

    if (aliveCount > 0) {
      const targetTiltX = (weightX / aliveCount) * 20;
      const targetTiltY = (weightY / aliveCount) * 20;
      this.tiltX += (targetTiltX - this.tiltX) * dt * 3.5;
      this.tiltY += (targetTiltY - this.tiltY) * dt * 3.5;
    }

    // Sudden Death crumbling arena (< 15s)
    const isSuddenDeath = this.roundTimer <= 15.0;
    if (isSuddenDeath) {
      const minRadius = this.initialArenaRadius * 0.48;
      if (this.arenaRadius > minRadius) {
        this.arenaRadius = Math.max(minRadius, this.arenaRadius - 8.5 * dt);
        if (Math.random() < 0.35) {
          const crumbleAngle = Math.random() * Math.PI * 2;
          const cx = this.arenaCenterX + Math.cos(crumbleAngle) * this.arenaRadius;
          const cy = this.arenaCenterY + Math.sin(crumbleAngle) * (this.arenaRadius * 0.88);
          this.particles.spawnSparks(cx, cy, THEMES[this.currentTheme].rimColor, 3);
        }
      }
    } else if (this.roundTimer < 25) {
      const minRadius = this.initialArenaRadius * 0.65;
      if (this.arenaRadius > minRadius) {
        this.arenaRadius = Math.max(minRadius, this.arenaRadius - 4.0 * dt);
      }
    }

    // Update players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps || !ps.isAlive) continue;

      if (ps.turboCooldown > 0) ps.turboCooldown -= dt;
      if (ps.turboActiveTimer > 0) ps.turboActiveTimer -= dt;

      // Inputs
      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const actionHeld = this.input.isActionPressed(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      // Facing angle
      if (steer !== 0 || throttle !== 0) {
        ps.angle = Math.atan2(-throttle, steer);
      }

      // Hold-to-Charge Turbo Slam
      if (ps.turboCooldown <= 0) {
        if (actionHeld) {
          ps.isCharging = true;
          ps.chargeTime = Math.min(0.65, ps.chargeTime + dt);
          if (Math.random() < 0.25) {
            this.particles.spawnSparks(ps.x, ps.y, THEMES[this.currentTheme].accentColor, 1);
          }
        } else if (ps.isCharging || justAction) {
          // Release Turbo Slam!
          const chargeRatio = Math.max(0.2, ps.chargeTime / 0.65);
          ps.turboCooldown = 1.4;
          ps.turboActiveTimer = 0.35 + chargeRatio * 0.15;
          const impulse = 320 + chargeRatio * 320;
          ps.vx += Math.cos(ps.angle) * impulse;
          ps.vy += Math.sin(ps.angle) * impulse;

          ps.isCharging = false;
          ps.chargeTime = 0;

          this.audio.playLaser();
          this.particles.shake(chargeRatio > 0.7 ? 6 : 4);
          this.particles.spawnSparks(ps.x, ps.y, p.color, Math.round(8 + chargeRatio * 12));
          this.particles.showFloatingText(
            chargeRatio > 0.8 ? 'MEGA SLAM!' : 'TURBO!',
            ps.x,
            ps.y - ps.radius - 12,
            '#F59E0B',
            14
          );
        }
      } else {
        ps.isCharging = false;
        ps.chargeTime = 0;
      }

      // Motor torque acceleration
      const torqueMultiplier = ps.isUnderdog ? 1.25 : 1.0;
      const accel = (ps.turboActiveTimer > 0 ? 880 : 460) * torqueMultiplier;
      if (steer !== 0 || throttle !== 0) {
        ps.vx += steer * accel * dt;
        ps.vy += -throttle * accel * dt;
      }

      // Platform gravity slope slide based on platform tilt
      ps.vx += (this.tiltX / 20) * 130 * dt;
      ps.vy += (this.tiltY / 20) * 130 * dt;

      // Rolling friction
      const friction = ps.turboActiveTimer > 0 ? 0.98 : 0.955;
      ps.vx *= Math.pow(friction, dt * 60);
      ps.vy *= Math.pow(friction, dt * 60);

      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Roll animation rotation
      ps.rollAnim += Math.hypot(ps.vx, ps.vy) * dt * 0.055;

      // Check fall off edge
      const distFromCenter = Math.hypot(ps.x - this.arenaCenterX, ps.y - this.arenaCenterY);
      if (distFromCenter > this.arenaRadius + ps.radius * 0.5) {
        ps.isAlive = false;
        this.audio.playExplosion();
        this.particles.shake(8);
        this.particles.spawnExplosion(ps.x, ps.y, THEMES[this.currentTheme].rimColor, 28);
        this.particles.showFloatingText('RING OUT!', ps.x, ps.y, '#EF4444', 18);
      } else {
        // Survival score
        ps.score += dt * 30;
      }
    }

    // Sphere vs Sphere Elastic Bumping Physics
    const pList = Array.from(this.playersState.values()).filter((p) => p.isAlive);
    for (let i = 0; i < pList.length; i++) {
      for (let j = i + 1; j < pList.length; j++) {
        const p1 = pList[i];
        const p2 = pList[j];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = p1.radius + p2.radius;

        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Push apart
          const overlap = minDist - dist;
          p1.x -= nx * overlap * 0.5;
          p1.y -= ny * overlap * 0.5;
          p2.x += nx * overlap * 0.5;
          p2.y += ny * overlap * 0.5;

          // Relative velocity along normal
          const kx = p1.vx - p2.vx;
          const ky = p1.vy - p2.vy;
          const velAlongNormal = kx * nx + ky * ny;

          if (velAlongNormal > 0) {
            const m1 = p1.baseMass * (p1.isUnderdog ? 1.4 : 1.0);
            const m2 = p2.baseMass * (p2.isUnderdog ? 1.4 : 1.0);
            const impulse = (2 * velAlongNormal) / (m1 + m2);

            // Turbo slam knockback boost
            let elasticity = 1.45;
            if (p1.turboActiveTimer > 0) elasticity *= 1.4;
            if (p2.turboActiveTimer > 0) elasticity *= 1.4;

            p1.vx -= impulse * m2 * nx * elasticity;
            p1.vy -= impulse * m2 * ny * elasticity;
            p2.vx += impulse * m1 * nx * elasticity;
            p2.vy += impulse * m1 * ny * elasticity;

            this.audio.playBounce();
            this.particles.shake(elasticity > 1.6 ? 6 : 4);
            this.particles.spawnSparks((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, '#FFFFFF', 12);
          }
        }
      }
    }

    // Dynamic Pinball Bumper Collisions & Rebounds
    const theme = THEMES[this.currentTheme];
    for (const b of this.bumpers) {
      b.pulse = Math.max(0, b.pulse - dt * 3.5);
      const bColor = theme.bumperColors[b.colorIndex];

      for (const p of this.playersState.values()) {
        if (!p.isAlive) continue;
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        const dist = Math.hypot(dx, dy);
        const minDist = p.radius + b.radius;
        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          p.x = b.x + nx * minDist;
          p.y = b.y + ny * minDist;
          const reboundSpeed = 460;
          p.vx = nx * reboundSpeed;
          p.vy = ny * reboundSpeed;
          p.score += 20;
          b.pulse = 1.0;
          this.audio.playBounce();
          this.audio.playScore();
          this.particles.shake(5);
          this.particles.spawnSparks(b.x, b.y, bColor, 16);
          this.particles.showFloatingText('+20 BUMPER!', b.x, b.y - 18, bColor, 15);
        }
      }
    }

    // Check round over: timer expired or <= 1 alive (for multi-player)
    const remaining = Array.from(this.playersState.values()).filter((p) => p.isAlive);
    const active = this.getActivePlayers();
    if (this.roundTimer <= 0 || (active.length > 1 && remaining.length <= 1)) {
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
    const bot = this.playersState.get(botId);
    if (!bot || !bot.isAlive) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;

    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const interval =
      difficulty === 'bot_easy'
        ? 0.35 + Math.random() * 0.15
        : difficulty === 'bot_normal'
        ? 0.20 + Math.random() * 0.10
        : 0.08 + Math.random() * 0.05;
    this.botReactionTimers.set(botId, interval);

    const distFromCenter = Math.hypot(bot.x - this.arenaCenterX, bot.y - this.arenaCenterY);

    // 1. Recover towards center if near edge
    if (distFromCenter > this.arenaRadius * 0.65) {
      const returnAngle = Math.atan2(this.arenaCenterY - bot.y, this.arenaCenterX - bot.x);
      bot.angle = returnAngle;
      bot.vx += Math.cos(returnAngle) * 340 * dt * 4;
      bot.vy += Math.sin(returnAngle) * 340 * dt * 4;

      if (distFromCenter > this.arenaRadius * 0.82 && bot.turboCooldown <= 0) {
        bot.turboCooldown = 1.4;
        bot.turboActiveTimer = 0.35;
        bot.vx += Math.cos(returnAngle) * 360;
        bot.vy += Math.sin(returnAngle) * 360;
        this.audio.playLaser();
      }
      return;
    }

    // 2. Target nearest enemy and ram them off edge
    const enemies = Array.from(this.playersState.values()).filter((p) => p.isAlive && p.id !== bot.id);
    if (enemies.length > 0) {
      const target = enemies.reduce((prev, curr) => {
        const d1 = Math.hypot(prev.x - bot.x, prev.y - bot.y);
        const d2 = Math.hypot(curr.x - bot.x, curr.y - bot.y);
        return d1 < d2 ? prev : curr;
      });

      let ramAngle = Math.atan2(target.y - bot.y, target.x - bot.x);
      if (difficulty === 'bot_easy') {
        ramAngle += (Math.random() - 0.5) * 0.55;
      } else if (difficulty === 'bot_hard') {
        // Predictive lead
        const leadDist = Math.hypot(target.x - bot.x, target.y - bot.y) / 400;
        ramAngle = Math.atan2(target.y + target.vy * leadDist - bot.y, target.x + target.vx * leadDist - bot.x);
      }

      bot.angle = ramAngle;
      bot.vx += Math.cos(ramAngle) * 340 * dt * 4;
      bot.vy += Math.sin(ramAngle) * 340 * dt * 4;

      const distToEnemy = Math.hypot(target.x - bot.x, target.y - bot.y);
      const slamChance = difficulty === 'bot_hard' ? 0.85 : difficulty === 'bot_normal' ? 0.5 : 0.25;
      if (distToEnemy < 110 && bot.turboCooldown <= 0 && Math.random() < slamChance) {
        bot.turboCooldown = 1.4;
        bot.turboActiveTimer = 0.4;
        bot.vx += Math.cos(ramAngle) * 400;
        bot.vy += Math.sin(ramAngle) * 400;
        this.audio.playLaser();
        this.particles.shake(4);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const ps = this.playersState.get(p.id);
      const pts = ps ? Math.round(ps.score + (ps.isAlive ? 300 : 0)) : 0;
      return {
        playerId: p.id,
        score: pts,
        isAlive: ps?.isAlive || false
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
      ? `Player ${winnerId + 1} dominated the tilting ${theme.name}!`
      : 'All spheres plunged into the abyss!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentTheme];

    // 1. Background radial gradient
    const bgGrad = ctx.createRadialGradient(width * 0.5, height * 0.5, 40, width * 0.5, height * 0.5, width * 0.75);
    bgGrad.addColorStop(0, theme.bgGrad0);
    bgGrad.addColorStop(1, theme.bgGrad1);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative background cyber/abyss grid
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();

    // 2. 3D Cylindrical Tilting Arena Platform
    const px = this.arenaCenterX + this.tiltX;
    const py = this.arenaCenterY + this.tiltY;

    // Platform bottom shadow & bevel depth
    ctx.fillStyle = '#090D16';
    ctx.beginPath();
    ctx.ellipse(px, py + 22, this.arenaRadius, this.arenaRadius * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bevel cylinder wall
    ctx.fillStyle = theme.platBottom;
    ctx.beginPath();
    ctx.ellipse(px, py + 12, this.arenaRadius, this.arenaRadius * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();

    // Platform surface ring
    const platGrad = ctx.createRadialGradient(px, py - 10, 10, px, py, this.arenaRadius);
    platGrad.addColorStop(0, theme.platTop);
    platGrad.addColorStop(0.7, theme.platBottom);
    platGrad.addColorStop(1, '#05070D');

    ctx.fillStyle = platGrad;
    ctx.beginPath();
    ctx.ellipse(px, py, this.arenaRadius, this.arenaRadius * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();

    // Outer hazard caution rim
    const isSuddenDeath = this.roundTimer <= 15.0;
    ctx.strokeStyle = isSuddenDeath
      ? (Math.sin(Date.now() * 0.015) > 0 ? '#EF4444' : theme.rimColor)
      : theme.rimColor;
    ctx.lineWidth = isSuddenDeath ? 8 : 6;
    ctx.beginPath();
    ctx.ellipse(px, py, this.arenaRadius, this.arenaRadius * 0.88, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Inner concentric bullseye circles
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(px, py, this.arenaRadius * 0.5, this.arenaRadius * 0.44, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Draw Pinball Rebound Bumpers on Gyro Platform
    for (const b of this.bumpers) {
      ctx.save();
      const pulseScale = 1.0 + b.pulse * 0.3;
      const bR = b.radius * pulseScale;
      const bColor = theme.bumperColors[b.colorIndex];

      // Drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.arc(b.x, b.y + 4, bR, 0, Math.PI * 2);
      ctx.fill();

      // Outer chrome rim
      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.arc(b.x, b.y, bR + 3, 0, Math.PI * 2);
      ctx.fill();

      // Glowing Neon Cap
      ctx.shadowColor = bColor;
      ctx.shadowBlur = b.pulse > 0.1 ? 24 : 12;
      ctx.fillStyle = bColor;
      ctx.beginPath();
      ctx.arc(b.x, b.y, bR, 0, Math.PI * 2);
      ctx.fill();

      // Top specular highlight
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(b.x - bR * 0.3, b.y - bR * 0.3, bR * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Draw Sphere Players (CharacterRenderer Mascots in Transparent Gyro Spheres)
    for (const p of this.playersState.values()) {
      if (!p.isAlive) continue;

      ctx.save();
      // Sphere Drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 10, p.radius, p.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Turbo boost flame plume
      if (p.turboActiveTimer > 0) {
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        const bX = p.x - Math.cos(p.angle) * (p.radius + 12);
        const bY = p.y - Math.sin(p.angle) * (p.radius + 12);
        ctx.arc(bX, bY, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      // Underdog Heavy Core Aura
      if (p.isUnderdog) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Charge ring
      if (p.isCharging && p.chargeTime > 0) {
        const chargeRatio = p.chargeTime / 0.65;
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 4, -Math.PI / 2, -Math.PI / 2 + chargeRatio * Math.PI * 2);
        ctx.stroke();
      }

      // Draw Mascot inside hamster ball
      const isNearEdge = Math.hypot(p.x - this.arenaCenterX, p.y - this.arenaCenterY) > this.arenaRadius * 0.72;
      let mood: CharacterMood = 'idle';
      if (p.turboActiveTimer > 0 || p.isCharging) {
        mood = 'focused';
      } else if (isNearEdge) {
        mood = 'shocked';
      }
      const isBot = this.players[p.id]?.type !== 'human';
      drawCharacter(ctx, p.x, p.y, p.radius * 0.72, p.id, isBot, mood, performance.now() * 0.001);

      ctx.translate(p.x, p.y);

      // Translucent Glass Sphere Shell with specular reflections
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Glass sphere sheen
      const glassSheen = ctx.createLinearGradient(-p.radius, -p.radius, p.radius, p.radius);
      glassSheen.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      glassSheen.addColorStop(0.4, 'rgba(255, 255, 255, 0.08)');
      glassSheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glassSheen;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Rotating motorized gyro band
      ctx.rotate(p.rollAnim);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.radius - 2, p.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();

      // Player Name Pill
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(p.x - 30, p.y - p.radius - 22, 60, 16, 8);
      else ctx.rect(p.x - 30, p.y - p.radius - 22, 60, 16);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const pCfg = this.players[p.id];
      ctx.fillText(pCfg?.name.toUpperCase() || `P${p.id + 1}`, p.x, p.y - p.radius - 14);
    }

    // 5. Draw HUD & Safe-zone elements
    this.renderHUD(ctx, width, height);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const theme = THEMES[this.currentTheme];

    // Minigame Header at y: 56, h: 26 (NEVER overlaps global timer at y: 12-44)
    const headerW = 280;
    const headerH = 26;
    const headerX = width * 0.5 - headerW * 0.5;
    const headerY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(headerX, headerY, headerW, headerH, 6);
    else ctx.rect(headerX, headerY, headerW, headerH);
    ctx.fill();
    ctx.strokeStyle = theme.rimColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const isSuddenDeath = this.roundTimer <= 15.0;
    const headerText = isSuddenDeath
      ? `⚠️ SUDDEN DEATH CRUMBLE: ${Math.ceil(this.roundTimer)}s ⚠️`
      : `${theme.icon} SUMO SPHERES — ${theme.name.toUpperCase()}`;
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
    ctx.fillText('Steer: Roll | Hold Action: Turbo Slam', width - 20, height - 28);

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
      const mood: CharacterMood = ps?.isAlive ? (ps.isUnderdog ? 'focused' : 'idle') : 'shocked';
      const isBot = p.type !== 'human';
      drawCharacter(ctx, cx + 22, cy + 25, 14, p.id, isBot, mood, performance.now() * 0.001);

      // Score / Status
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(p.name, cx + 42, cy + 8);

      ctx.fillStyle = ps?.isAlive ? theme.accentColor : '#EF4444';
      ctx.font = '900 12px "Chakra Petch", monospace';
      ctx.fillText(ps?.isAlive ? `⚡ ${Math.round(ps.score)}` : '💀 FALL', cx + 42, cy + 26);
    });

    ctx.restore();
  }

  public syncDebug(): void {
    // Expose internal state for headless tests
    (window as any).__SUMO_SPHERES_DEBUG__ = {
      roundTimer: this.roundTimer,
      currentTheme: this.currentTheme,
      arenaRadius: this.arenaRadius,
      tiltX: this.tiltX,
      tiltY: this.tiltY,
      players: Array.from(this.playersState.values()).map((p) => ({
        id: p.id,
        isAlive: p.isAlive,
        score: p.score,
        isUnderdog: p.isUnderdog,
        isCharging: p.isCharging
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
