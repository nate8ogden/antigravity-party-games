import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type BalloonTheme = 'backyard' | 'cyber' | 'beach';

interface ThemeConfig {
  id: BalloonTheme;
  name: string;
  badge: string;
  bgGradient: [string, string];
  groundColor: string;
  groundHighlight: string;
  fenceColor: string;
  fenceBorder: string;
  splashColor: string;
  accentGlow: string;
}

const THEME_CONFIGS: ThemeConfig[] = [
  {
    id: 'backyard',
    name: 'Sunny Backyard',
    badge: '🏡 SUNNY BACKYARD',
    bgGradient: ['#0284C7', '#0369A1'],
    groundColor: '#15803D',
    groundHighlight: '#166534',
    fenceColor: '#78350F',
    fenceBorder: '#B45309',
    splashColor: '#38BDF8',
    accentGlow: '#0284C7'
  },
  {
    id: 'cyber',
    name: 'Cyber Splash',
    badge: '⚡ CYBER SPLASH',
    bgGradient: ['#0B0F19', '#030712'],
    groundColor: '#1E293B',
    groundHighlight: '#0F172A',
    fenceColor: '#06B6D4',
    fenceBorder: '#38BDF8',
    splashColor: '#06B6D4',
    accentGlow: '#EC4899'
  },
  {
    id: 'beach',
    name: 'Tropical Beach',
    badge: '🏖️ TROPICAL BEACH',
    bgGradient: ['#0EA5E9', '#0284C7'],
    groundColor: '#D97706',
    groundHighlight: '#B45309',
    fenceColor: '#854D0E',
    fenceBorder: '#CA8A04',
    splashColor: '#22D3EE',
    accentGlow: '#F59E0B'
  }
];

interface BalloonProjectile {
  id: number;
  ownerId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  wobbleTimer: number;
  isMega: boolean;
}

interface PlayerCatapult {
  id: PlayerId;
  side: 'LEFT' | 'RIGHT';
  x: number;
  y: number;
  aimAngle: number;
  minAngle: number;
  maxAngle: number;
  power: number; // 0..1
  isCharging: boolean;
  soaksTaken: number;
  maxSoaks: number;
  soaksScored: number;
  score: number;
  botReactionTimer: number;
  umbrellaTimer: number; // 0..1 (active shield)
  mood: CharacterMood;
  moodTimer: number;
  isUnderdog: boolean;
}

export class WaterBalloonBarrageGame extends BaseGame {
  private catapults: Map<PlayerId, PlayerCatapult> = new Map();
  private balloons: BalloonProjectile[] = [];
  private fence = { x: 0, y: 0, width: 24, height: 260 };
  private windSpeed: number = 0;
  private windTimer: number = 0;
  public currentTheme: BalloonTheme = 'backyard';
  private gravity: number = 520;
  private balloonCounter: number = 0;
  private suddenDeathAnnounced: boolean = false;
  private animTimer: number = 0;

  private lastWidth: number = 960;
  private lastHeight: number = 540;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.bindKeyboardShortcuts();
    this.bindCanvasPointer();
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 55.0;
    this.isFinished = false;
    this.balloons = [];
    this.windSpeed = (Math.random() - 0.5) * 40;
    this.windTimer = 4.0;
    this.suddenDeathAnnounced = false;
    this.animTimer = 0;

    const groundY = height - 90;
    const fenceHeight = Math.min(270, height * 0.44);
    this.fence = {
      x: width / 2 - 12,
      y: groundY - fenceHeight,
      width: 24,
      height: fenceHeight
    };

    this.catapults.clear();
    const active = this.getActivePlayers();

    active.forEach((p, idx) => {
      const isLeft = idx % 2 === 0;
      const x = isLeft
        ? width * 0.14 + (idx >= 2 ? 85 : 0)
        : width * 0.86 - (idx >= 2 ? 85 : 0);
      const y = groundY;

      const minA = isLeft ? 0.35 : Math.PI - 1.25;
      const maxA = isLeft ? 1.25 : Math.PI - 0.35;

      this.catapults.set(p.id, {
        id: p.id,
        side: isLeft ? 'LEFT' : 'RIGHT',
        x,
        y,
        aimAngle: (minA + maxA) / 2,
        minAngle: minA,
        maxAngle: maxA,
        power: 0,
        isCharging: false,
        soaksTaken: 0,
        maxSoaks: 3,
        soaksScored: 0,
        score: 0,
        botReactionTimer: 0.2 + idx * 0.06,
        umbrellaTimer: 0,
        mood: 'idle',
        moodTimer: 0,
        isUnderdog: false
      });
    });

    this.syncDebug();
  }

  public syncDebug(): void {
    if (typeof window !== 'undefined') {
      const self = this;
      (window as any).__WATER_BALLOON_DEBUG__ = {
        get catapults() { return Array.from(self.catapults.values()); },
        get balloons() { return self.balloons; },
        get roundTimer() { return self.roundTimer; },
        get isFinished() { return self.isFinished; },
        get theme() { return self.currentTheme; },
        setTheme: (t: BalloonTheme) => self.setBalloonTheme(t),
        cycleTheme: () => self.cycleTheme(),
        launchMegaBalloon: (pid: PlayerId) => {
          const cat = self.catapults.get(pid);
          if (cat) {
            cat.power = 1.0;
            self.launchBalloon(cat);
          }
        }
      };
    }
  }

  private bindKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;
    this.keydownListener = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === '1') {
        this.setBalloonTheme('backyard');
      } else if (e.key === '2') {
        this.setBalloonTheme('cyber');
      } else if (e.key === '3') {
        this.setBalloonTheme('beach');
      }
    };
    window.addEventListener('keydown', this.keydownListener);
  }

  private bindCanvasPointer(): void {
    if (typeof window === 'undefined') return;
    const canvas = this.input.getCanvas();
    if (!canvas) return;

    this.boundPointerDown = (e: PointerEvent) => {
      this.handlePointerDown(e);
    };
    canvas.addEventListener('pointerdown', this.boundPointerDown);
  }

  private handlePointerDown(e: PointerEvent): void {
    const canvas = this.input.getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * this.lastWidth;
    const clickY = ((e.clientY - rect.top) / rect.height) * this.lastHeight;

    // Check Theme Pill click at (20, height - 44, 170, 32)
    if (
      clickX >= 20 &&
      clickX <= 190 &&
      clickY >= this.lastHeight - 44 &&
      clickY <= this.lastHeight - 12
    ) {
      this.cycleTheme();
    }
  }

  public cycleTheme(): void {
    const curIdx = THEME_CONFIGS.findIndex((t) => t.id === this.currentTheme);
    const nextIdx = (curIdx + 1) % THEME_CONFIGS.length;
    this.setBalloonTheme(THEME_CONFIGS[nextIdx].id);
  }

  public setBalloonTheme(theme: BalloonTheme): void {
    if (this.currentTheme === theme) return;
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnExplosion(100, this.lastHeight - 28, '#38BDF8', 12);
  }

  public destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownListener) {
        window.removeEventListener('keydown', this.keydownListener);
        this.keydownListener = null;
      }
      const canvas = this.input.getCanvas();
      if (canvas && this.boundPointerDown) {
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
        this.boundPointerDown = null;
      }
      delete (window as any).__WATER_BALLOON_DEBUG__;
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastWidth = width;
    this.lastHeight = height;
    this.animTimer += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update Underdog status (trailing in soaks or score >= 120 pts)
    this.updateUnderdogStatus();

    // Sudden Death Monsoon at 15s remaining
    if (this.roundTimer <= 15 && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      const groundY = height - 90;
      this.fence.height *= 0.55; // Lower fence by ~45%
      this.fence.y = groundY - this.fence.height;
      this.audio.playFanfare();
      this.particles.shake(0.35);
      this.particles.showFloatingText('SUDDEN DEATH MONSOON! ⛈️ FENCE LOWERED!', width / 2, 78, '#38BDF8', 24);
    }

    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    // Shifting Wind
    this.windTimer -= dt;
    if (this.windTimer <= 0) {
      this.windTimer = 3.5 + Math.random() * 3;
      this.windSpeed = (Math.random() - 0.5) * 55;
    }

    // Update Umbrella timers & mood
    for (const cat of this.catapults.values()) {
      if (cat.umbrellaTimer > 0) {
        cat.umbrellaTimer = Math.max(0, cat.umbrellaTimer - dt);
      }
      if (cat.moodTimer > 0) {
        cat.moodTimer = Math.max(0, cat.moodTimer - dt);
        if (cat.moodTimer <= 0) cat.mood = 'idle';
      }

      // Charge power if holding launch
      if (cat.isCharging) {
        const chargeRate = cat.isUnderdog ? 1.8 : 1.35;
        cat.power = Math.min(1.0, cat.power + dt * chargeRate);
        cat.mood = 'focused';
      }
    }

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Human controls: Kinetic aim + hold power + tap umbrella
    for (const p of this.getActivePlayers()) {
      const cat = this.catapults.get(p.id);
      if (!cat || cat.soaksTaken >= cat.maxSoaks) continue;

      if (p.type === 'human') {
        const steer = this.input.getSteer(p.id);
        const throttle = this.input.getThrottle(p.id);
        const isPressed = this.input.isPressed(p.id) || this.input.isActionPressed(p.id);
        const wasJustReleased = this.input.justReleased(p.id);
        const justAction = this.input.justAction(p.id);

        // Kinetic Aim Angle Control
        if (throttle !== 0) {
          const aimDelta = throttle * dt * 1.8;
          cat.aimAngle = Math.max(cat.minAngle, Math.min(cat.maxAngle, cat.aimAngle + (cat.side === 'LEFT' ? aimDelta : -aimDelta)));
        } else if (steer !== 0) {
          const aimDelta = steer * dt * 1.8;
          cat.aimAngle = Math.max(cat.minAngle, Math.min(cat.maxAngle, cat.aimAngle + (cat.side === 'LEFT' ? -aimDelta : aimDelta)));
        }

        // Umbrella Shield: double tap or separate action
        if (justAction && !cat.isCharging && cat.umbrellaTimer <= 0) {
          cat.umbrellaTimer = 1.0;
          this.audio.playTap();
          this.particles.showFloatingText('UMBRELLA! ☂️', cat.x, cat.y - 45, '#38BDF8', 16);
        }

        // Hold to charge power
        if (isPressed) {
          if (!cat.isCharging) {
            cat.isCharging = true;
            cat.power = 0.15;
          }
        } else if (wasJustReleased && cat.isCharging) {
          this.launchBalloon(cat);
        }
      }
    }

    // Update Balloons
    const groundY = height - 90;
    for (let i = this.balloons.length - 1; i >= 0; i--) {
      const b = this.balloons[i];
      b.wobbleTimer += dt * 8;
      b.vx += this.windSpeed * dt;
      b.vy += this.gravity * dt;

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // 1. Check Fence Collision
      if (
        b.x + b.radius >= this.fence.x &&
        b.x - b.radius <= this.fence.x + this.fence.width &&
        b.y + b.radius >= this.fence.y &&
        b.y - b.radius <= this.fence.y + this.fence.height
      ) {
        this.splashBalloon(b, b.x, b.y);
        this.balloons.splice(i, 1);
        continue;
      }

      // 2. Check Ground Collision
      if (b.y + b.radius >= groundY) {
        this.splashBalloon(b, b.x, groundY);
        this.balloons.splice(i, 1);
        continue;
      }

      // 3. Check Opponent Player Hit / Umbrella Deflection
      let hitTarget = false;
      for (const target of this.catapults.values()) {
        if (target.id === b.ownerId || target.soaksTaken >= target.maxSoaks) continue;

        const dist = Math.hypot(b.x - target.x, b.y - (target.y - 20));
        if (dist < b.radius + (b.isMega ? 34 : 24)) {
          // Umbrella Shield Deflection!
          if (target.umbrellaTimer > 0) {
            b.vx = -b.vx * 1.1;
            b.vy = -Math.abs(b.vy) * 0.9;
            b.ownerId = target.id; // Deflected ownership!
            this.audio.playBounce();
            this.particles.shake(0.25);
            this.particles.showFloatingText('PARRIED! ☂️', target.x, target.y - 45, '#38BDF8', 18);
            target.mood = 'triumph';
            target.moodTimer = 0.8;
            hitTarget = true;
            break;
          }

          // Direct Soak!
          const damage = b.isMega || this.roundTimer <= 15 ? 2 : 1;
          target.soaksTaken += damage;
          target.mood = 'shocked';
          target.moodTimer = 1.2;

          const shooter = this.catapults.get(b.ownerId);
          if (shooter) {
            const pts = (b.isMega ? 160 : 100) * (this.roundTimer <= 15 ? 2 : 1);
            shooter.soaksScored++;
            shooter.score += pts;
            shooter.mood = 'triumph';
            shooter.moodTimer = 1.2;
            this.particles.showFloatingText(`DIRECT SOAK! +${pts}`, target.x, target.y - 35, '#22C55E', 22);
          }

          this.splashBalloon(b, b.x, b.y);
          this.balloons.splice(i, 1);
          hitTarget = true;
          break;
        }
      }
      if (hitTarget) continue;

      // Screen boundary check
      if (b.x < -60 || b.x > width + 60) {
        this.balloons.splice(i, 1);
      }
    }

    // Check last un-soaked standing
    const activeUnsoaked = Array.from(this.catapults.values()).filter((c) => c.soaksTaken < c.maxSoaks);
    if (activeUnsoaked.length <= 1 && this.getActivePlayers().length > 1) {
      if (activeUnsoaked.length === 1) {
        activeUnsoaked[0].score += 150;
        activeUnsoaked[0].mood = 'triumph';
      }
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private updateUnderdogStatus(): void {
    const catapults = Array.from(this.catapults.values());
    if (catapults.length < 2) return;

    let maxSoaks = -1;
    let maxScore = -1;

    for (const c of catapults) {
      if (c.soaksTaken > maxSoaks) maxSoaks = c.soaksTaken;
      if (c.score > maxScore) maxScore = c.score;
    }

    for (const c of catapults) {
      c.isUnderdog = (c.soaksTaken === maxSoaks && maxSoaks >= 1) || (maxScore - c.score >= 120);
      c.maxSoaks = c.isUnderdog ? 4 : 3; // Raincoat armor
    }
  }

  private launchBalloon(cat: PlayerCatapult): void {
    cat.isCharging = false;
    const isMega = cat.power >= 0.85;
    const launchSpeed = 390 + cat.power * 480;
    const launchAngle = cat.aimAngle;

    const vx = Math.cos(launchAngle) * launchSpeed;
    const vy = -Math.sin(launchAngle) * launchSpeed;

    const pConfig = this.players.find((p) => p.id === cat.id);
    this.balloons.push({
      id: ++this.balloonCounter,
      ownerId: cat.id,
      x: cat.x,
      y: cat.y - 25,
      vx,
      vy,
      radius: isMega ? 16 : 11,
      color: pConfig?.color || '#38BDF8',
      wobbleTimer: 0,
      isMega
    });

    this.audio.playTap();
    cat.power = 0;

    if (isMega) {
      this.particles.showFloatingText('MEGA BOMB! 💣', cat.x, cat.y - 45, '#F59E0B', 18);
    }
  }

  private splashBalloon(b: BalloonProjectile, splashX: number, splashY: number): void {
    this.audio.playBounce();
    this.particles.shake(b.isMega ? 0.35 : 0.20);
    this.particles.emit(splashX, splashY, b.isMega ? 28 : 16, b.color);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const cat = this.catapults.get(botId);
    if (!cat || cat.soaksTaken >= cat.maxSoaks) return;

    cat.botReactionTimer -= dt;

    // Check incoming threatening balloons for Umbrella Shield reaction
    for (const b of this.balloons) {
      if (b.ownerId !== botId) {
        const d = Math.hypot(b.x - cat.x, b.y - cat.y);
        if (d < 120 && b.vy > 0 && cat.umbrellaTimer <= 0) {
          if (difficulty === 'bot_hard' || (difficulty === 'bot_normal' && Math.random() < 0.45)) {
            cat.umbrellaTimer = 1.0;
            this.particles.showFloatingText('UMBRELLA! ☂️', cat.x, cat.y - 45, '#38BDF8', 16);
            return;
          }
        }
      }
    }

    // Target selection
    let targetCat: PlayerCatapult | null = null;
    for (const c of this.catapults.values()) {
      if (c.id !== botId && c.side !== cat.side && c.soaksTaken < c.maxSoaks) {
        targetCat = c;
        break;
      }
    }
    if (!targetCat) return;

    const dx = Math.abs(targetCat.x - cat.x);
    const baseIdeal = cat.side === 'LEFT' ? Math.PI / 4 : (Math.PI * 3) / 4;
    const windEffect = (cat.side === 'LEFT' ? -this.windSpeed : this.windSpeed) * 0.0038;
    const idealAngle = baseIdeal + windEffect;

    const angleTolerance =
      difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.16 : 0.30;

    if (!cat.isCharging) {
      // Rotate aim towards ideal angle
      cat.aimAngle += (idealAngle - cat.aimAngle) * Math.min(1, dt * 4);

      if (cat.botReactionTimer <= 0 && Math.abs(cat.aimAngle - idealAngle) < angleTolerance) {
        cat.isCharging = true;
        cat.power = 0.15;
        const nominalDist = 720;
        const distRatio = Math.max(0.35, Math.min(1.0, dx / nominalDist));
        const chargeDuration = (0.35 + distRatio * 0.32) * (difficulty === 'bot_easy' ? (0.8 + Math.random() * 0.4) : 1.0);
        cat.botReactionTimer = chargeDuration;
      }
    } else {
      if (cat.botReactionTimer <= 0) {
        this.launchBalloon(cat);
        cat.botReactionTimer =
          difficulty === 'bot_easy' ? 1.5 + Math.random() * 0.5 : difficulty === 'bot_normal' ? 1.0 + Math.random() * 0.3 : 0.65;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;

    const cfg = THEME_CONFIGS.find((t) => t.id === this.currentTheme) || THEME_CONFIGS[0];

    // 1. Stage Background Sky
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, cfg.bgGradient[0]);
    bgGrad.addColorStop(1, cfg.bgGradient[1]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const groundY = height - 90;

    // Grass / Sand Ground Floor
    ctx.fillStyle = cfg.groundColor;
    ctx.fillRect(0, groundY, width, height - groundY);
    ctx.fillStyle = cfg.groundHighlight;
    ctx.fillRect(0, groundY, width, 8);

    // 2. Center Fence
    ctx.save();
    ctx.fillStyle = cfg.fenceColor;
    ctx.fillRect(this.fence.x, this.fence.y, this.fence.width, this.fence.height);
    ctx.strokeStyle = cfg.fenceBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(this.fence.x, this.fence.y, this.fence.width, this.fence.height);

    for (let fy = this.fence.y + 20; fy < groundY; fy += 28) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(this.fence.x + 2, fy, this.fence.width - 4, 3);
    }
    ctx.restore();

    // 3. Catapults & Players
    for (const p of this.getActivePlayers()) {
      const cat = this.catapults.get(p.id);
      if (!cat) continue;

      ctx.save();
      ctx.translate(cat.x, cat.y);

      // Underdog Raincoat Halo
      if (cat.isUnderdog && cat.soaksTaken < cat.maxSoaks) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(0, -18, 38, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Wooden Catapult Base Frame
      ctx.fillStyle = '#451A03';
      ctx.fillRect(-22, -14, 44, 14);

      // Launcher Arm
      const armLen = 38;
      const armEndX = Math.cos(cat.aimAngle) * armLen;
      const armEndY = -Math.sin(cat.aimAngle) * armLen;

      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(armEndX, armEndY);
      ctx.stroke();

      // Bucket & loaded balloon
      ctx.fillStyle = cat.soaksTaken >= cat.maxSoaks ? '#64748B' : p.color;
      ctx.beginPath();
      ctx.arc(armEndX, armEndY, cat.power >= 0.85 ? 14 : 10, 0, Math.PI * 2);
      ctx.fill();

      // Power Bar Indicator when charging
      if (cat.isCharging) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(-24, -48, 48, 8);
        ctx.fillStyle = cat.power >= 0.85 ? '#EF4444' : '#F59E0B';
        ctx.fillRect(-22, -46, 44 * cat.power, 4);
      }

      // Umbrella Shield visual
      if (cat.umbrellaTimer > 0) {
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(0, -42, 26, Math.PI, 0, false);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Soak Water Meter
      for (let s = 0; s < cat.maxSoaks; s++) {
        ctx.fillStyle = s < cat.soaksTaken ? '#38BDF8' : '#334155';
        ctx.beginPath();
        ctx.arc(-18 + s * 12, 14, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // 4. Flying Water Balloons
    for (const b of this.balloons) {
      ctx.save();
      ctx.translate(b.x, b.y);

      const wobble = Math.sin(b.wobbleTimer) * 0.15;
      ctx.scale(1 + wobble, 1 - wobble);

      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.arc(-b.radius * 0.3, -b.radius * 0.3, b.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 5. Corner Player Cards & Mascot Avatars
    this.renderPlayerCornerCards(ctx, width, height, cfg);

    // 6. Center Sub-Header Badge (y: 56, h: 26 - respects top-center y:12-44 safe zone)
    this.renderSubHeaderBadge(ctx, width, cfg);

    // 7. Interactive Theme Pill (bottom-left x: 20, y: height - 44, w: 170, h: 32)
    this.renderThemePill(ctx, height, cfg);

    // 8. Control Hints (bottom-right x: width - 20, y: height - 28, textAlign: right)
    this.renderControlsHUD(ctx, width, height);
  }

  private renderPlayerCornerCards(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cfg: ThemeConfig
  ): void {
    for (const p of this.getActivePlayers()) {
      const cat = this.catapults.get(p.id);
      if (!cat) continue;

      let px = 20;
      let py = 16;
      let mascotX = px + 175;
      let mascotY = py + 36;

      if (p.corner === 'top-right') {
        px = width - 180;
        mascotX = px - 20;
      } else if (p.corner === 'bottom-left') {
        // Place neatly above theme pill (theme pill is at y: height - 44)
        py = height - 134;
        mascotY = py + 36;
      } else if (p.corner === 'bottom-right') {
        px = width - 180;
        py = height - 134;
        mascotX = px - 20;
        mascotY = py + 36;
      }

      // Container Card
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
      ctx.beginPath();
      ctx.roundRect(px, py, 160, 78, 8);
      ctx.fill();

      // Card border (dashed gold if Underdog)
      if (cat.isUnderdog) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 3]);
      } else {
        ctx.strokeStyle = cat.soaksTaken < cat.maxSoaks ? p.color : '#64748B';
        ctx.lineWidth = 2;
      }
      ctx.stroke();
      ctx.restore();

      // Name & Score
      ctx.fillStyle = cat.soaksTaken < cat.maxSoaks ? p.color : '#94A3B8';
      ctx.font = '700 12px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, px + 10, py + 18);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '800 13px Inter, monospace';
      ctx.fillText(`${cat.score} pts`, px + 10, py + 35);

      ctx.fillStyle = cat.soaksTaken < cat.maxSoaks ? '#38BDF8' : '#EF4444';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillText(cat.soaksTaken < cat.maxSoaks ? `Soaked: ${cat.soaksTaken}/${cat.maxSoaks}` : 'DRENCHED ✖', px + 10, py + 54);

      // Hits counter
      ctx.fillStyle = '#94A3B8';
      ctx.font = '600 10px Inter, sans-serif';
      ctx.fillText(`Direct Hits: ${cat.soaksScored}`, px + 10, py + 70);

      // Render Mascot Avatar alongside the card
      const isBot = p.type !== 'human';
      ctx.save();
      drawCharacter(ctx, mascotX, mascotY, 13, p.id, isBot, cat.mood, this.animTimer);
      ctx.restore();
    }
  }

  private renderSubHeaderBadge(ctx: CanvasRenderingContext2D, width: number, cfg: ThemeConfig): void {
    const podW = 340;
    const podH = 26;
    const podX = width / 2 - podW / 2;
    const podY = 56; // Safe zone below top-center timer y: 12-44

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 13);
    ctx.fill();

    ctx.strokeStyle = cfg.fenceBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Map Name Badge
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(`ARENA: ${cfg.name}`, podX + 16, podY + 17);

    // Wind status
    const windDir = this.windSpeed > 0 ? '➡ EAST' : '⬅ WEST';
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    if (this.roundTimer <= 15) {
      ctx.fillStyle = '#EF4444';
      ctx.fillText('⚡ MONSOON 2X', podX + podW - 16, podY + 17);
    } else {
      ctx.fillStyle = '#38BDF8';
      ctx.fillText(`WIND: ${Math.round(Math.abs(this.windSpeed))} MPH ${windDir}`, podX + podW - 16, podY + 17);
    }
    ctx.restore();
  }

  private renderThemePill(ctx: CanvasRenderingContext2D, height: number, cfg: ThemeConfig): void {
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();

    ctx.strokeStyle = cfg.fenceBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(cfg.badge, pillX + 12, pillY + 20);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('[T]', pillX + pillW - 10, pillY + 20);
    ctx.restore();
  }

  private renderControlsHUD(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.fillText('Steer: Aim Angle | Hold Action: Charge Power | Tap Action: Umbrella Shield ☂️', width - 20, height - 28);
    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const sorted = [...active].sort((a, b) => {
      const sa = this.catapults.get(a.id);
      const sb = this.catapults.get(b.id);
      if (!sa || !sb) return 0;
      if (sa.soaksTaken !== sb.soaksTaken) {
        return sa.soaksTaken - sb.soaksTaken;
      }
      return sb.score - sa.score;
    });

    const winnerId = sorted.length > 0 ? sorted[0].id : null;
    const topHits = this.catapults.get(winnerId ?? 0)?.soaksScored || 0;

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      score: this.catapults.get(p.id)?.score || 0,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: `Artillery maestro! Launched precision arcs scoring ${topHits} direct soaking hits on ${this.currentTheme}!`
    };
  }
}
