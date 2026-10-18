import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type PinballTheme = 'arcade' | 'casino' | 'cosmic';

interface ThemeConfig {
  id: PinballTheme;
  name: string;
  badge: string;
  bgGradient: [string, string];
  tableBorder: string;
  tableInnerGlow: string;
  accentGlow: string;
  gridLineColor: string;
  bumperColors: [string, string, string, string];
  ballTrailColor: string;
}

const THEME_CONFIGS: ThemeConfig[] = [
  {
    id: 'arcade',
    name: 'Neon Arcade',
    badge: '⚡ NEON ARCADE',
    bgGradient: ['#0A0F1D', '#040711'],
    tableBorder: '#06B6D4',
    tableInnerGlow: 'rgba(6, 182, 212, 0.22)',
    accentGlow: '#EC4899',
    gridLineColor: 'rgba(56, 189, 248, 0.08)',
    bumperColors: ['#06B6D4', '#EC4899', '#F59E0B', '#10B981'],
    ballTrailColor: 'rgba(6, 182, 212, 0.35)'
  },
  {
    id: 'casino',
    name: 'Vegas Casino',
    badge: '🎰 VEGAS JACKPOT',
    bgGradient: ['#064E3B', '#022C22'],
    tableBorder: '#F59E0B',
    tableInnerGlow: 'rgba(245, 158, 11, 0.25)',
    accentGlow: '#DC2626',
    gridLineColor: 'rgba(245, 158, 11, 0.10)',
    bumperColors: ['#DC2626', '#3B82F6', '#F59E0B', '#10B981'],
    ballTrailColor: 'rgba(245, 158, 11, 0.40)'
  },
  {
    id: 'cosmic',
    name: 'Cosmic Supernova',
    badge: '🌌 COSMIC VOID',
    bgGradient: ['#0F0C29', '#050314'],
    tableBorder: '#8B5CF6',
    tableInnerGlow: 'rgba(139, 92, 246, 0.26)',
    accentGlow: '#38BDF8',
    gridLineColor: 'rgba(139, 92, 246, 0.09)',
    bumperColors: ['#8B5CF6', '#38BDF8', '#F97316', '#F43F5E'],
    ballTrailColor: 'rgba(139, 92, 246, 0.40)'
  }
];

interface PinballPaddle {
  id: PlayerId;
  zone: 'BOTTOM' | 'TOP' | 'LEFT' | 'RIGHT';
  x: number;
  y: number;
  baseWidth: number;
  width: number;
  height: number;
  flipperActive: boolean;
  flipperCharge: number; // 0 to 1
  flipperAnim: number; // 0 to 1
  shields: number;
  maxShields: number;
  score: number;
  goalsScored: number;
  botReactionTimer: number;
  botTargetOffset: number;
  patrolDir: 1 | -1;
  mood: CharacterMood;
  moodTimer: number;
  nudgeCooldown: number;
  dazedTimer: number;
  isUnderdog: boolean;
  lastTouchTime: number;
}

interface PinballBall {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  lastTouch: PlayerId | null;
  speed: number;
  isGolden: boolean;
  trail: { x: number; y: number; alpha: number }[];
  superCharged: boolean;
  chargeTimer: number;
}

interface PinballBumper {
  id: number;
  x: number;
  y: number;
  radius: number;
  color: string;
  flashTimer: number;
  points: number;
  pulseScale: number;
}

interface SlingshotKicker {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  nx: number;
  ny: number;
  flashTimer: number;
}

export class PinballBattleGame extends BaseGame {
  private playersState: Map<PlayerId, PinballPaddle> = new Map();
  private balls: PinballBall[] = [];
  private bumpers: PinballBumper[] = [];
  private slingshots: SlingshotKicker[] = [];
  public currentTheme: PinballTheme = 'arcade';
  public get currentMapName(): string {
    const cfg = THEME_CONFIGS.find((t) => t.id === this.currentTheme);
    return cfg ? cfg.name : 'Neon Arcade';
  }
  private ballCounter: number = 0;
  private multiballSpawned: boolean = false;
  private suddenDeathAnnounced: boolean = false;
  private tableBounds = { minX: 35, maxX: 925, minY: 92, maxY: 515 };
  private tableTilt = { x: 0, y: 0 };
  private tiltDecaySpeed: number = 4.0;
  private tiltCooldown: number = 0;
  private animTimer: number = 0;
  private jackpotScore: number = 1000;

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
    this.isFinished = false;
    this.roundTimer = 45;
    this.ballCounter = 0;
    this.multiballSpawned = false;
    this.suddenDeathAnnounced = false;
    this.animTimer = 0;
    this.tableTilt = { x: 0, y: 0 };
    this.tiltCooldown = 0;
    this.jackpotScore = 1000;

    this.tableBounds = {
      minX: 40,
      maxX: width - 40,
      minY: 92,
      maxY: height - 52
    };

    this.setupArenaGeometry(width, height);
    this.initPlayers(width, height);
    this.spawnBall(width / 2, (this.tableBounds.minY + this.tableBounds.maxY) / 2, false);
    this.syncDebug();
  }

  public syncDebug(): void {
    if (typeof window !== 'undefined') {
      const self = this;
      (window as any).__PINBALL_BATTLE_DEBUG__ = {
        get players() { return Array.from(self.playersState.values()); },
        get balls() { return self.balls; },
        get bumpers() { return self.bumpers; },
        get roundTimer() { return self.roundTimer; },
        get isFinished() { return self.isFinished; },
        get theme() { return self.currentTheme; },
        setTheme: (t: PinballTheme) => self.setPinballTheme(t),
        cycleTheme: () => self.cycleTheme(),
        spawnExtraBall: (golden: boolean = false) =>
          self.spawnBall(
            (self.tableBounds.minX + self.tableBounds.maxX) / 2,
            (self.tableBounds.minY + self.tableBounds.maxY) / 2,
            golden
          )
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
        this.setPinballTheme('arcade');
      } else if (e.key === '2') {
        this.setPinballTheme('casino');
      } else if (e.key === '3') {
        this.setPinballTheme('cosmic');
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
    this.setPinballTheme(THEME_CONFIGS[nextIdx].id);
  }

  public setPinballTheme(theme: PinballTheme): void {
    if (this.currentTheme === theme) return;
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnExplosion(100, this.lastHeight - 28, '#38BDF8', 12);

    // Update bumper palette
    const cfg = THEME_CONFIGS.find((t) => t.id === theme) || THEME_CONFIGS[0];
    this.bumpers.forEach((b, idx) => {
      b.color = cfg.bumperColors[idx % cfg.bumperColors.length];
    });
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
      delete (window as any).__PINBALL_BATTLE_DEBUG__;
    }
  }

  private setupArenaGeometry(width: number, height: number): void {
    const centerX = width / 2;
    const centerY = (this.tableBounds.minY + this.tableBounds.maxY) / 2;
    const cfg = THEME_CONFIGS.find((t) => t.id === this.currentTheme) || THEME_CONFIGS[0];

    // Procedural Bumper Layout: Central Diamond + Corner Launch Bumpers
    this.bumpers = [
      {
        id: 1,
        x: centerX - 80,
        y: centerY - 30,
        radius: 24,
        color: cfg.bumperColors[0],
        flashTimer: 0,
        points: 25,
        pulseScale: 1
      },
      {
        id: 2,
        x: centerX + 80,
        y: centerY - 30,
        radius: 24,
        color: cfg.bumperColors[1],
        flashTimer: 0,
        points: 25,
        pulseScale: 1
      },
      {
        id: 3,
        x: centerX,
        y: centerY + 60,
        radius: 28,
        color: cfg.bumperColors[2],
        flashTimer: 0,
        points: 50,
        pulseScale: 1
      },
      {
        id: 4,
        x: centerX,
        y: centerY - 95,
        radius: 22,
        color: cfg.bumperColors[3],
        flashTimer: 0,
        points: 30,
        pulseScale: 1
      }
    ];

    // Angled Corner Slingshots to keep balls ricocheting into play
    const minX = this.tableBounds.minX;
    const maxX = this.tableBounds.maxX;
    const minY = this.tableBounds.minY;
    const maxY = this.tableBounds.maxY;

    this.slingshots = [
      // Top-Left Corner
      { x1: minX + 10, y1: minY + 70, x2: minX + 70, y2: minY + 10, nx: 0.707, ny: 0.707, flashTimer: 0 },
      // Top-Right Corner
      { x1: maxX - 70, y1: minY + 10, x2: maxX - 10, y2: minY + 70, nx: -0.707, ny: 0.707, flashTimer: 0 },
      // Bottom-Left Corner
      { x1: minX + 10, y1: maxY - 70, x2: minX + 70, y2: maxY - 10, nx: 0.707, ny: -0.707, flashTimer: 0 },
      // Bottom-Right Corner
      { x1: maxX - 70, y1: maxY - 10, x2: maxX - 10, y2: maxY - 70, nx: -0.707, ny: -0.707, flashTimer: 0 }
    ];
  }

  private initPlayers(width: number, height: number): void {
    this.playersState.clear();
    const active = this.getActivePlayers();
    const count = active.length;
    const centerY = (this.tableBounds.minY + this.tableBounds.maxY) / 2;

    if (count === 2) {
      // 2 Players: P1 Bottom, P2 Top
      const zones: ('BOTTOM' | 'TOP')[] = ['BOTTOM', 'TOP'];
      active.forEach((p, idx) => {
        const zone = zones[idx];
        const py = zone === 'BOTTOM' ? this.tableBounds.maxY - 16 : this.tableBounds.minY + 16;
        const baseW = 104;

        this.playersState.set(p.id, {
          id: p.id,
          zone,
          x: width / 2,
          y: py,
          baseWidth: baseW,
          width: baseW,
          height: 16,
          flipperActive: false,
          flipperCharge: 0,
          flipperAnim: 0,
          shields: 5,
          maxShields: 5,
          score: 0,
          goalsScored: 0,
          botReactionTimer: 0.12 + idx * 0.08,
          botTargetOffset: 0,
          patrolDir: 1,
          mood: 'idle',
          moodTimer: 0,
          nudgeCooldown: 0,
          dazedTimer: 0,
          isUnderdog: false,
          lastTouchTime: 0
        });
      });
    } else {
      // 3 or 4 Players: 4 Cardinal Zones (BOTTOM, TOP, LEFT, RIGHT)
      const zones: ('BOTTOM' | 'TOP' | 'LEFT' | 'RIGHT')[] = ['BOTTOM', 'TOP', 'LEFT', 'RIGHT'];
      active.forEach((p, idx) => {
        const zone = zones[idx % zones.length];
        let px = width / 2;
        let py = centerY;
        let pw = 92;
        let ph = 16;

        if (zone === 'BOTTOM') {
          py = this.tableBounds.maxY - 16;
        } else if (zone === 'TOP') {
          py = this.tableBounds.minY + 16;
        } else if (zone === 'LEFT') {
          px = this.tableBounds.minX + 16;
          pw = 16;
          ph = 92;
        } else {
          px = this.tableBounds.maxX - 16;
          pw = 16;
          ph = 92;
        }

        this.playersState.set(p.id, {
          id: p.id,
          zone,
          x: px,
          y: py,
          baseWidth: zone === 'BOTTOM' || zone === 'TOP' ? pw : ph,
          width: pw,
          height: ph,
          flipperActive: false,
          flipperCharge: 0,
          flipperAnim: 0,
          shields: 5,
          maxShields: 5,
          score: 0,
          goalsScored: 0,
          botReactionTimer: 0.12 + idx * 0.08,
          botTargetOffset: 0,
          patrolDir: 1,
          mood: 'idle',
          moodTimer: 0,
          nudgeCooldown: 0,
          dazedTimer: 0,
          isUnderdog: false,
          lastTouchTime: 0
        });
      });
    }
  }

  private spawnBall(x: number, y: number, isGolden: boolean = false): void {
    if (this.balls.length >= 8) {
      this.balls.shift();
    }
    const angle = (Math.random() - 0.5) * Math.PI * 0.8 + (Math.random() > 0.5 ? 0 : Math.PI);
    const speed = isGolden ? 380 : 320;
    this.balls.push({
      id: ++this.ballCounter,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: isGolden ? 11 : 9,
      lastTouch: null,
      speed,
      isGolden,
      trail: [],
      superCharged: isGolden,
      chargeTimer: isGolden ? 999 : 0
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastWidth = width;
    this.lastHeight = height;
    this.animTimer += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Check Underdog status (trailing by shields or score >= 200 pts)
    this.updateUnderdogStatus();

    // Table Tilt Decay
    this.tableTilt.x -= this.tableTilt.x * this.tiltDecaySpeed * dt;
    this.tableTilt.y -= this.tableTilt.y * this.tiltDecaySpeed * dt;
    if (this.tiltCooldown > 0) this.tiltCooldown = Math.max(0, this.tiltCooldown - dt);

    // Multiball drop at 25s remaining
    if (this.roundTimer <= 25 && !this.multiballSpawned) {
      this.multiballSpawned = true;
      const centerY = (this.tableBounds.minY + this.tableBounds.maxY) / 2;
      this.spawnBall(width / 2 - 50, centerY, false);
      this.spawnBall(width / 2 + 50, centerY, false);
      this.audio.playFanfare();
      this.particles.shake(0.35);
      this.particles.showFloatingText('MULTI-BALL FRENZY!!', width / 2, centerY - 45, '#F59E0B', 26);
    }

    // Sudden Death Supernova at 15s remaining
    if (this.roundTimer <= 15 && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      const centerY = (this.tableBounds.minY + this.tableBounds.maxY) / 2;
      this.spawnBall(width / 2, centerY, true);
      this.spawnBall(width / 2 - 60, centerY + 30, true);
      this.audio.playFanfare();
      this.particles.shake(0.5);
      this.particles.showFloatingText('SUDDEN DEATH SUPERNOVA! 🌟 2X PTS', width / 2, centerY - 65, '#EF4444', 28);
    }

    // Update bot inputs via BaseGame
    this.updateBots(dt, width, height);

    // Bumper flash and pulse timers
    for (const b of this.bumpers) {
      if (b.flashTimer > 0) b.flashTimer = Math.max(0, b.flashTimer - dt);
      b.pulseScale = 1.0 + Math.sin(this.animTimer * 4 + b.id) * 0.04;
    }

    // Slingshot flash timers
    for (const s of this.slingshots) {
      if (s.flashTimer > 0) s.flashTimer = Math.max(0, s.flashTimer - dt);
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps || ps.shields <= 0) continue;

      if (ps.moodTimer > 0) {
        ps.moodTimer = Math.max(0, ps.moodTimer - dt);
        if (ps.moodTimer <= 0) ps.mood = 'idle';
      }

      if (ps.nudgeCooldown > 0) ps.nudgeCooldown = Math.max(0, ps.nudgeCooldown - dt);
      if (ps.dazedTimer > 0) {
        ps.dazedTimer = Math.max(0, ps.dazedTimer - dt);
        ps.mood = 'shocked';
        continue; // Dazed paddles cannot steer or flip
      }

      // Read Input
      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const actionHeld = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
      const actionJust = this.input.justAction(p.id) || this.input.justPressed(p.id);

      // Flipper directional tap/hold
      const flipperDirection =
        (ps.zone === 'BOTTOM' && (throttle > 0.4 || this.input.justUp(p.id))) ||
        (ps.zone === 'TOP' && (throttle < -0.4 || this.input.justDown(p.id))) ||
        (ps.zone === 'LEFT' && steer > 0.4) ||
        (ps.zone === 'RIGHT' && steer < -0.4);

      const flipRequested = actionHeld || flipperDirection;
      const flipJust = actionJust || flipperDirection;

      // Charge Mechanic: holding builds power
      if (flipRequested) {
        ps.flipperCharge = Math.min(1.0, ps.flipperCharge + dt * 2.2);
        ps.flipperActive = true;
        ps.flipperAnim = 1.0;
        if (ps.mood !== 'triumph' && ps.mood !== 'shocked') ps.mood = 'focused';
      } else {
        if (ps.flipperCharge >= 0.5) {
          // Release Power Smash
          this.triggerPowerSmash(ps, p.color);
        }
        ps.flipperCharge = 0;
        ps.flipperActive = false;
        ps.flipperAnim = Math.max(0, ps.flipperAnim - dt * 6.0);
      }

      if (flipJust && ps.flipperCharge <= 0.2) {
        this.audio.playFlipper();
      }

      // Table Tilt Nudge: double-tap action or sudden stick jerk
      if (actionJust && ps.nudgeCooldown <= 0 && this.tiltCooldown <= 0) {
        this.performTableTilt(ps, steer, throttle);
      }

      // Dynamic Movement along defense rail
      let moveSpeed = 340;
      if (ps.isUnderdog) moveSpeed *= 1.22; // Underdog speed surge

      // Apply dynamic width (+30% for Underdog)
      const targetW = ps.isUnderdog ? ps.baseWidth * 1.3 : ps.baseWidth;
      if (ps.zone === 'BOTTOM' || ps.zone === 'TOP') {
        ps.width = targetW;
        ps.height = 16;
        const halfW = ps.width / 2;
        const minX = this.tableBounds.minX + halfW + 12;
        const maxX = this.tableBounds.maxX - halfW - 12;

        if (steer !== 0) {
          ps.x += steer * moveSpeed * dt;
        } else {
          ps.x += ps.patrolDir * (moveSpeed * 0.65) * dt;
          if (flipJust) ps.patrolDir = ps.patrolDir === 1 ? -1 : 1;
        }
        if (ps.x <= minX) { ps.x = minX; ps.patrolDir = 1; }
        else if (ps.x >= maxX) { ps.x = maxX; ps.patrolDir = -1; }
      } else {
        // Vertical Left / Right
        ps.width = 16;
        ps.height = targetW;
        const halfH = ps.height / 2;
        const minY = this.tableBounds.minY + halfH + 12;
        const maxY = this.tableBounds.maxY - halfH - 12;

        if (throttle !== 0) {
          ps.y += -throttle * moveSpeed * dt;
        } else {
          ps.y += ps.patrolDir * (moveSpeed * 0.65) * dt;
          if (flipJust) ps.patrolDir = ps.patrolDir === 1 ? -1 : 1;
        }
        if (ps.y <= minY) { ps.y = minY; ps.patrolDir = 1; }
        else if (ps.y >= maxY) { ps.y = maxY; ps.patrolDir = -1; }
      }
    }

    // Update Balls
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];

      // Add to motion trail
      b.trail.unshift({ x: b.x, y: b.y, alpha: 0.6 });
      if (b.trail.length > 8) b.trail.pop();
      b.trail.forEach((t) => (t.alpha -= dt * 3.5));

      // Supercharged timer
      if (b.chargeTimer > 0 && !b.isGolden) {
        b.chargeTimer -= dt;
        if (b.chargeTimer <= 0) b.superCharged = false;
      }

      // Apply Table Tilt Inertia
      b.vx += this.tableTilt.x * dt * 450;
      b.vy += this.tableTilt.y * dt * 450;

      // Underdog Magnetic Repulsor Field (slows down incoming threat in front of goal)
      this.applyUnderdogDeflection(b, dt);

      // Move Ball
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Clamp max velocity
      const currentSpeed = Math.hypot(b.vx, b.vy);
      const maxSpd = b.superCharged ? 650 : 540;
      if (currentSpeed > maxSpd) {
        b.vx = (b.vx / currentSpeed) * maxSpd;
        b.vy = (b.vy / currentSpeed) * maxSpd;
      }

      // Corner Slingshots Collision
      this.checkSlingshotCollision(b);

      // Bumper Collisions
      for (const bmp of this.bumpers) {
        const dx = b.x - bmp.x;
        const dy = b.y - bmp.y;
        const dist = Math.hypot(dx, dy);

        if (dist < b.radius + bmp.radius) {
          const normalX = dx / (dist || 1);
          const normalY = dy / (dist || 1);

          // Violent rebound
          const reboundSpeed = Math.min(580, Math.hypot(b.vx, b.vy) * 1.18 + 45);
          b.vx = normalX * reboundSpeed;
          b.vy = normalY * reboundSpeed;
          b.x = bmp.x + normalX * (b.radius + bmp.radius + 1);
          b.y = bmp.y + normalY * (b.radius + bmp.radius + 1);

          bmp.flashTimer = 0.25;
          this.audio.playBounce();
          this.particles.shake(0.2);
          this.particles.spawnSparks(bmp.x, bmp.y, bmp.color, 14);

          // Award bumper points
          const multiplier = this.roundTimer <= 15 ? 2 : 1;
          const pts = bmp.points * multiplier * (b.isGolden ? 2 : 1);
          if (b.lastTouch !== null) {
            const touchPlayer = this.playersState.get(b.lastTouch);
            if (touchPlayer) {
              touchPlayer.score += pts;
              this.particles.showFloatingText(`+${pts}`, bmp.x, bmp.y - 14, bmp.color, 14);
            }
          }
        }
      }

      // Player Flipper / Paddle Collisions
      for (const p of this.getActivePlayers()) {
        const ps = this.playersState.get(p.id);
        if (!ps || ps.shields <= 0) continue;

        const left = ps.x - ps.width / 2;
        const right = ps.x + ps.width / 2;
        const top = ps.y - ps.height / 2;
        const bottom = ps.y + ps.height / 2;

        if (
          b.x + b.radius >= left &&
          b.x - b.radius <= right &&
          b.y + b.radius >= top &&
          b.y - b.radius <= bottom
        ) {
          b.lastTouch = ps.id;
          ps.lastTouchTime = this.animTimer;
          ps.score += 15;

          const isFlipped = ps.flipperAnim > 0 || ps.flipperCharge > 0.4;
          const flipBoost = isFlipped ? 1.45 : 1.05;

          if (isFlipped && ps.flipperCharge > 0.6) {
            b.superCharged = true;
            b.chargeTimer = 2.5;
            this.particles.spawnExplosion(b.x, b.y, '#F59E0B', 15);
            this.particles.shake(0.28);
          }

          if (ps.zone === 'BOTTOM') {
            const offset = (b.x - ps.x) / (ps.width / 2);
            b.vy = -Math.abs(b.vy) * flipBoost - (isFlipped ? 110 : 0);
            b.vx = offset * 260 + (b.vx * 0.2);
            b.y = top - b.radius - 1;
          } else if (ps.zone === 'TOP') {
            const offset = (b.x - ps.x) / (ps.width / 2);
            b.vy = Math.abs(b.vy) * flipBoost + (isFlipped ? 110 : 0);
            b.vx = offset * 260 + (b.vx * 0.2);
            b.y = bottom + b.radius + 1;
          } else if (ps.zone === 'LEFT') {
            const offset = (b.y - ps.y) / (ps.height / 2);
            b.vx = Math.abs(b.vx) * flipBoost + (isFlipped ? 110 : 0);
            b.vy = offset * 260 + (b.vy * 0.2);
            b.x = right + b.radius + 1;
          } else {
            // RIGHT
            const offset = (b.y - ps.y) / (ps.height / 2);
            b.vx = -Math.abs(b.vx) * flipBoost - (isFlipped ? 110 : 0);
            b.vy = offset * 260 + (b.vy * 0.2);
            b.x = left - b.radius - 1;
          }

          ps.mood = 'triumph';
          ps.moodTimer = 0.4;
          this.audio.playBounce();
          this.particles.spawnSparks(b.x, b.y, p.color, 12);
        }
      }

      // Table Boundary Bounce / Goal Check
      this.checkBallWallAndGoal(b, i, width, height);
    }

    // End round check: time up or all but 1 player out of shields
    const activeWithShields = Array.from(this.playersState.values()).filter((p) => p.shields > 0);
    if (this.roundTimer <= 0 || activeWithShields.length <= 1) {
      this.isFinished = true;
    }
  }

  private triggerPowerSmash(ps: PinballPaddle, color: string): void {
    this.audio.playExplosion();
    this.particles.shake(0.3);
    this.particles.spawnExplosion(ps.x, ps.y, color, 16);
    this.particles.showFloatingText('POWER SMASH! ⚡', ps.x, ps.y - 20, '#F59E0B', 18);

    // Blast any nearby balls
    for (const b of this.balls) {
      const dist = Math.hypot(b.x - ps.x, b.y - ps.y);
      if (dist < 110) {
        b.superCharged = true;
        b.chargeTimer = 3.0;
        b.lastTouch = ps.id;
        const angle = Math.atan2(b.y - ps.y, b.x - ps.x);
        b.vx = Math.cos(angle) * 560;
        b.vy = Math.sin(angle) * 560;
      }
    }
  }

  private performTableTilt(ps: PinballPaddle, steer: number, throttle: number): void {
    ps.nudgeCooldown = 2.0;
    this.tiltCooldown = 0.8;

    let dirX = steer !== 0 ? Math.sign(steer) : (Math.random() > 0.5 ? 1 : -1);
    let dirY = throttle !== 0 ? Math.sign(-throttle) : (Math.random() > 0.5 ? 1 : -1);

    this.tableTilt.x = dirX * 1.5;
    this.tableTilt.y = dirY * 1.5;

    this.audio.playTap();
    this.particles.shake(0.18);
    this.particles.showFloatingText('NUDGE!', ps.x, ps.y - 16, '#38BDF8', 16);
  }

  private updateUnderdogStatus(): void {
    const players = Array.from(this.playersState.values());
    if (players.length < 2) return;

    let maxScore = -1;
    let minScore = Infinity;
    let minShields = Infinity;

    for (const p of players) {
      if (p.score > maxScore) maxScore = p.score;
      if (p.score < minScore) minScore = p.score;
      if (p.shields < minShields) minShields = p.shields;
    }

    for (const p of players) {
      // Underdog if behind by >= 200 pts or lowest shields while others have more
      p.isUnderdog = (maxScore - p.score >= 200) || (p.shields === minShields && minShields <= 2);
    }
  }

  private applyUnderdogDeflection(b: PinballBall, dt: number): void {
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps || !ps.isUnderdog || ps.shields <= 0) continue;

      let inDefenseZone = false;
      if (ps.zone === 'BOTTOM' && b.y > this.tableBounds.maxY - 90 && b.vy > 0) inDefenseZone = true;
      else if (ps.zone === 'TOP' && b.y < this.tableBounds.minY + 90 && b.vy < 0) inDefenseZone = true;
      else if (ps.zone === 'LEFT' && b.x < this.tableBounds.minX + 90 && b.vx < 0) inDefenseZone = true;
      else if (ps.zone === 'RIGHT' && b.x > this.tableBounds.maxX - 90 && b.vx > 0) inDefenseZone = true;

      if (inDefenseZone) {
        // Slow down ball by 28% inside underdog repulsor zone
        b.vx -= b.vx * 0.75 * dt;
        b.vy -= b.vy * 0.75 * dt;
      }
    }
  }

  private checkSlingshotCollision(b: PinballBall): void {
    for (const s of this.slingshots) {
      // Distance from point to line segment
      const dx = s.x2 - s.x1;
      const dy = s.y2 - s.y1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;

      const t = Math.max(0, Math.min(1, ((b.x - s.x1) * dx + (b.y - s.y1) * dy) / lenSq));
      const projX = s.x1 + t * dx;
      const projY = s.y1 + t * dy;
      const dist = Math.hypot(b.x - projX, b.y - projY);

      if (dist < b.radius + 6) {
        // Bounce off slingshot normal with boost
        const dot = b.vx * s.nx + b.vy * s.ny;
        if (dot < 0) {
          b.vx = (b.vx - 2 * dot * s.nx) * 1.15;
          b.vy = (b.vy - 2 * dot * s.ny) * 1.15;
          b.x = projX + s.nx * (b.radius + 7);
          b.y = projY + s.ny * (b.radius + 7);

          s.flashTimer = 0.2;
          this.audio.playBounce();
          this.particles.spawnSparks(projX, projY, '#38BDF8', 8);
        }
      }
    }
  }

  private checkBallWallAndGoal(b: PinballBall, ballIdx: number, width: number, height: number): void {
    // Bottom Goal Check
    if (b.y + b.radius >= this.tableBounds.maxY) {
      const pBottom = Array.from(this.playersState.values()).find((p) => p.zone === 'BOTTOM');
      if (pBottom && pBottom.shields > 0) {
        this.handleGoalScored(pBottom, b);
      } else {
        b.y = this.tableBounds.maxY - b.radius;
        b.vy = -Math.abs(b.vy);
      }
      return;
    }

    // Top Goal Check
    if (b.y - b.radius <= this.tableBounds.minY) {
      const pTop = Array.from(this.playersState.values()).find((p) => p.zone === 'TOP');
      if (pTop && pTop.shields > 0) {
        this.handleGoalScored(pTop, b);
      } else {
        b.y = this.tableBounds.minY + b.radius;
        b.vy = Math.abs(b.vy);
      }
      return;
    }

    // Left Goal Check
    if (b.x - b.radius <= this.tableBounds.minX) {
      const pLeft = Array.from(this.playersState.values()).find((p) => p.zone === 'LEFT');
      if (pLeft && pLeft.shields > 0) {
        this.handleGoalScored(pLeft, b);
      } else {
        b.x = this.tableBounds.minX + b.radius;
        b.vx = Math.abs(b.vx);
      }
      return;
    }

    // Right Goal Check
    if (b.x + b.radius >= this.tableBounds.maxX) {
      const pRight = Array.from(this.playersState.values()).find((p) => p.zone === 'RIGHT');
      if (pRight && pRight.shields > 0) {
        this.handleGoalScored(pRight, b);
      } else {
        b.x = this.tableBounds.maxX - b.radius;
        b.vx = -Math.abs(b.vx);
      }
      return;
    }
  }

  private handleGoalScored(concedingPlayer: PinballPaddle, b: PinballBall): void {
    const damage = this.roundTimer <= 15 ? 2 : 1;
    concedingPlayer.shields = Math.max(0, concedingPlayer.shields - damage);
    concedingPlayer.mood = 'shocked';
    concedingPlayer.moodTimer = 1.2;

    // Award Goal to last toucher
    let goalPts = b.isGolden ? 300 : 150;
    if (this.roundTimer <= 15) goalPts *= 2;

    if (b.lastTouch !== null && b.lastTouch !== concedingPlayer.id) {
      const scorer = this.playersState.get(b.lastTouch);
      if (scorer) {
        scorer.score += goalPts;
        scorer.goalsScored += 1;
        scorer.mood = 'triumph';
        scorer.moodTimer = 1.5;
        this.particles.showFloatingText(`GOAL! +${goalPts}`, b.x, b.y - 25, '#22C55E', 24);
      }
    } else {
      this.particles.showFloatingText('GOAL!', b.x, b.y - 25, '#EF4444', 24);
    }

    this.audio.playExplosion();
    this.particles.shake(0.45);
    this.particles.spawnExplosion(b.x, b.y, '#EF4444', 28);

    // Respawn ball in arena center
    const centerY = (this.tableBounds.minY + this.tableBounds.maxY) / 2;
    b.x = (this.tableBounds.minX + this.tableBounds.maxX) / 2;
    b.y = centerY;
    const a = Math.random() * Math.PI * 2;
    const spd = b.isGolden ? 380 : 320;
    b.vx = Math.cos(a) * spd;
    b.vy = Math.sin(a) * spd;
    b.lastTouch = null;
    b.superCharged = b.isGolden;
    b.chargeTimer = b.isGolden ? 999 : 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.shields <= 0 || ps.dazedTimer > 0) return;

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    const interval =
      difficulty === 'bot_hard' ? 0.04 : difficulty === 'bot_normal' ? 0.08 : 0.16;
    ps.botReactionTimer = interval;

    // Perceptual error offset for humanized tracking
    if (difficulty === 'bot_easy') {
      ps.botTargetOffset = (Math.random() - 0.5) * 36;
    } else if (difficulty === 'bot_normal') {
      ps.botTargetOffset = (Math.random() - 0.5) * 16;
    } else {
      ps.botTargetOffset = 0;
    }

    // Find ball heading toward bot's goal
    let nearestBall: PinballBall | null = null;
    let minDist = 9999;

    for (const b of this.balls) {
      const d = Math.hypot(ps.x - b.x, ps.y - b.y);
      let headingTowardsMe = false;

      if (ps.zone === 'BOTTOM' && b.vy > 0) headingTowardsMe = true;
      else if (ps.zone === 'TOP' && b.vy < 0) headingTowardsMe = true;
      else if (ps.zone === 'LEFT' && b.vx < 0) headingTowardsMe = true;
      else if (ps.zone === 'RIGHT' && b.vx > 0) headingTowardsMe = true;

      if (headingTowardsMe && d < minDist) {
        minDist = d;
        nearestBall = b;
      }
    }

    let steer = 0;
    let throttle = 0;
    let flip = false;

    if (nearestBall) {
      // Anticipate 1 bounce on Hard
      let targetX = nearestBall.x + ps.botTargetOffset;
      let targetY = nearestBall.y + ps.botTargetOffset;

      if (difficulty === 'bot_hard') {
        const timeToHit = Math.abs(ps.y - nearestBall.y) / (Math.abs(nearestBall.vy) || 1);
        if (timeToHit < 0.6) {
          targetX = nearestBall.x + nearestBall.vx * timeToHit;
          // Clamp inside rails
          if (targetX < this.tableBounds.minX) targetX = this.tableBounds.minX + 30;
          if (targetX > this.tableBounds.maxX) targetX = this.tableBounds.maxX - 30;
        }
      }

      if (ps.zone === 'BOTTOM' || ps.zone === 'TOP') {
        const dx = targetX - ps.x;
        if (dx > 10) steer = 1;
        else if (dx < -10) steer = -1;

        if (minDist < 75 && Math.abs(dx) < ps.width * 0.48) {
          flip = true;
        }
      } else {
        const dy = targetY - ps.y;
        if (dy > 10) throttle = -1;
        else if (dy < -10) throttle = 1;

        if (minDist < 75 && Math.abs(dy) < ps.height * 0.48) {
          flip = true;
        }
      }

      // Hard AI clutch tilt nudge when ball is dangerously close to leaking in
      if (difficulty === 'bot_hard' && minDist < 45 && ps.nudgeCooldown <= 0) {
        flip = true;
      }
    }

    // Occasional mis-timing on Easy
    if (difficulty === 'bot_easy' && Math.random() < 0.28) {
      flip = false;
    }

    this.input.setBotInput(botId, flip, steer, throttle, flip);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;

    const cfg = THEME_CONFIGS.find((t) => t.id === this.currentTheme) || THEME_CONFIGS[0];

    // 1. Table Floor Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, cfg.bgGradient[0]);
    bgGrad.addColorStop(1, cfg.bgGradient[1]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative Circuit / Table Floor Grid
    ctx.strokeStyle = cfg.gridLineColor;
    ctx.lineWidth = 1;
    const gridStep = 45;
    for (let x = this.tableBounds.minX; x <= this.tableBounds.maxX; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, this.tableBounds.minY);
      ctx.lineTo(x, this.tableBounds.maxY);
      ctx.stroke();
    }
    for (let y = this.tableBounds.minY; y <= this.tableBounds.maxY; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(this.tableBounds.minX, y);
      ctx.lineTo(this.tableBounds.maxX, y);
      ctx.stroke();
    }

    // Pinball Table Outer Border & Inner Glow
    ctx.save();
    ctx.strokeStyle = cfg.tableBorder;
    ctx.lineWidth = 4;
    ctx.shadowColor = cfg.accentGlow;
    ctx.shadowBlur = this.roundTimer <= 15 ? 16 + Math.sin(this.animTimer * 10) * 8 : 10;
    ctx.strokeRect(
      this.tableBounds.minX,
      this.tableBounds.minY,
      this.tableBounds.maxX - this.tableBounds.minX,
      this.tableBounds.maxY - this.tableBounds.minY
    );
    ctx.restore();

    // 2. Corner Slingshots
    for (const s of this.slingshots) {
      ctx.save();
      ctx.strokeStyle = s.flashTimer > 0 ? '#FFFFFF' : cfg.tableBorder;
      ctx.lineWidth = s.flashTimer > 0 ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();

      // Slingshot guide dots
      ctx.fillStyle = s.flashTimer > 0 ? '#F59E0B' : cfg.accentGlow;
      ctx.beginPath();
      ctx.arc(s.x1, s.y1, 4, 0, Math.PI * 2);
      ctx.arc(s.x2, s.y2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Bumpers
    for (const bmp of this.bumpers) {
      this.renderBumper(ctx, bmp);
    }

    // 4. Pinballs (with Motion Trail & Supercharged glow)
    for (const b of this.balls) {
      this.renderBall(ctx, b, cfg);
    }

    // 5. Players / Flipper Paddles & Mascot Avatars
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      const isBot = p.type !== 'human';
      this.renderPaddle(ctx, ps, p.color, isBot);
    }

    // 6. Center Sub-Header Badge (y: 56, h: 26 - respects top-center y:12-44 safe zone)
    this.renderSubHeaderBadge(ctx, width, cfg);

    // 7. Interactive Theme Pill (bottom-left x: 20, y: height - 44, w: 170, h: 32)
    this.renderThemePill(ctx, height, cfg);

    // 8. Control Hints (bottom-right x: width - 24, y: height - 28, textAlign: right)
    this.renderControlsHUD(ctx, width, height);
  }

  private renderBumper(ctx: CanvasRenderingContext2D, bmp: PinballBumper): void {
    ctx.save();
    ctx.translate(bmp.x, bmp.y);
    const r = bmp.radius * bmp.pulseScale;

    // Glowing Flash Ring if hit
    if (bmp.flashTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, r + 12, 0, Math.PI * 2);
      ctx.fillStyle = `${bmp.color}66`;
      ctx.fill();
    }

    // Bumper Ring
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = bmp.flashTimer > 0 ? '#FFFFFF' : '#1E293B';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = bmp.color;
    ctx.shadowColor = bmp.color;
    ctx.shadowBlur = bmp.flashTimer > 0 ? 14 : 6;
    ctx.stroke();

    // Inner Core Target
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = bmp.color;
    ctx.fill();

    // Value label
    ctx.font = '700 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${bmp.points}`, 0, 0);

    ctx.restore();
  }

  private renderBall(ctx: CanvasRenderingContext2D, b: PinballBall, cfg: ThemeConfig): void {
    // 1. Motion Trail
    for (let i = 0; i < b.trail.length; i++) {
      const t = b.trail[i];
      if (t.alpha <= 0) continue;
      ctx.beginPath();
      ctx.arc(t.x, t.y, b.radius * (1 - i / b.trail.length * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = b.isGolden
        ? `rgba(245, 158, 11, ${t.alpha * 0.7})`
        : b.superCharged
        ? `rgba(239, 68, 68, ${t.alpha * 0.7})`
        : `rgba(6, 182, 212, ${t.alpha * 0.45})`;
      ctx.fill();
    }

    // 2. Ball Body
    ctx.save();
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);

    if (b.isGolden) {
      ctx.fillStyle = '#F59E0B';
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 12;
    } else if (b.superCharged) {
      ctx.fillStyle = '#EF4444';
      ctx.shadowColor = '#EF4444';
      ctx.shadowBlur = 14;
    } else {
      ctx.fillStyle = '#E2E8F0';
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 6;
    }
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    // Chrome reflection glint
    ctx.beginPath();
    ctx.arc(b.x - b.radius * 0.35, b.y - b.radius * 0.35, b.radius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
  }

  private renderPaddle(
    ctx: CanvasRenderingContext2D,
    ps: PinballPaddle,
    color: string,
    isBot: boolean
  ): void {
    if (ps.shields <= 0) {
      // Eliminated marker
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OUT OF SHIELDS', ps.x, ps.y);
      return;
    }

    ctx.save();
    ctx.translate(ps.x, ps.y);

    // Underdog Golden Dashed Repulsor Aura
    if (ps.isUnderdog) {
      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(ps.width, ps.height) * 0.75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Power Charge Glow
    if (ps.flipperCharge > 0.1) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 4 * ps.flipperCharge;
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 12;
      ctx.strokeRect(-ps.width / 2 - 4, -ps.height / 2 - 4, ps.width + 8, ps.height + 8);
    }

    // Paddle Body
    ctx.fillStyle = ps.dazedTimer > 0 ? '#64748B' : color;
    ctx.beginPath();
    ctx.roundRect(-ps.width / 2, -ps.height / 2, ps.width, ps.height, 5);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    // Flipper Pulse Glow when active
    if (ps.flipperAnim > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.roundRect(-ps.width / 2 - 2, -ps.height / 2 - 2, ps.width + 4, ps.height + 4, 6);
      ctx.fill();
    }

    ctx.restore();

    // Render Mascot Avatar above/beside the paddle
    this.renderPaddleMascot(ctx, ps, isBot);

    // Shield pip dots near paddle
    this.renderShieldPips(ctx, ps);
  }

  private renderPaddleMascot(ctx: CanvasRenderingContext2D, ps: PinballPaddle, isBot: boolean): void {
    let mascotX = ps.x;
    let mascotY = ps.y;

    if (ps.zone === 'BOTTOM') {
      mascotY = ps.y + 24;
    } else if (ps.zone === 'TOP') {
      mascotY = ps.y - 24;
    } else if (ps.zone === 'LEFT') {
      mascotX = ps.x - 24;
    } else {
      mascotX = ps.x + 24;
    }

    // Clamp mascot inside screen
    mascotX = Math.max(20, Math.min(this.lastWidth - 20, mascotX));
    mascotY = Math.max(75, Math.min(this.lastHeight - 15, mascotY));

    ctx.save();
    drawCharacter(ctx, mascotX, mascotY, 14, ps.id, isBot, ps.mood, this.animTimer);
    ctx.restore();
  }

  private renderShieldPips(ctx: CanvasRenderingContext2D, ps: PinballPaddle): void {
    const dotSpacing = 9;
    const startX = ps.x - ((ps.maxShields - 1) * dotSpacing) / 2;
    let pipY = ps.zone === 'BOTTOM' ? ps.y - 14 : ps.y + 14;
    if (ps.zone === 'LEFT') pipY = ps.y + ps.height / 2 + 12;
    if (ps.zone === 'RIGHT') pipY = ps.y + ps.height / 2 + 12;

    for (let s = 0; s < ps.maxShields; s++) {
      ctx.beginPath();
      ctx.arc(startX + s * dotSpacing, pipY, 3, 0, Math.PI * 2);
      ctx.fillStyle = s < ps.shields ? (ps.isUnderdog ? '#F59E0B' : '#22C55E') : '#475569';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    }
  }

  private renderSubHeaderBadge(ctx: CanvasRenderingContext2D, width: number, cfg: ThemeConfig): void {
    const podW = 320;
    const podH = 26;
    const podX = width / 2 - podW / 2;
    const podY = 56; // Clean safe zone below global timer y: 12-44

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 13);
    ctx.fill();

    ctx.strokeStyle = cfg.tableBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Map Name Badge
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(`TABLE: ${cfg.name}`, podX + 16, podY + 17);

    // Multiball status or Underdog surge tag
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    if (this.roundTimer <= 15) {
      ctx.fillStyle = '#EF4444';
      ctx.fillText('⚡ SUPERNOVA 2X', podX + podW - 16, podY + 17);
    } else if (this.multiballSpawned) {
      ctx.fillStyle = '#F59E0B';
      ctx.fillText('MULTI-BALL ACTIVE', podX + podW - 16, podY + 17);
    } else {
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('FLIP TO SMASH', podX + podW - 16, podY + 17);
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

    ctx.strokeStyle = cfg.tableBorder;
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
    ctx.fillText('Steer: Paddle | Tap/Hold: Power Flip | Action: Tilt Nudge', width - 20, height - 28);
    ctx.restore();
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const rankings = active
      .map((p) => {
        const ps = this.playersState.get(p.id);
        const score = (ps ? ps.score : 0) + (ps ? ps.shields * 75 : 0);
        return { playerId: p.id, score, place: 1 };
      })
      .sort((a, b) => b.score - a.score);

    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });

    const winnerId =
      rankings.length > 0 && (rankings.length === 1 || rankings[0].score > rankings[1].score)
        ? rankings[0].playerId
        : null;

    let mvpHighlight = 'Pinball Wizard!';
    if (winnerId !== null) {
      const ps = this.playersState.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} dominated the flippers with ${ps?.score || 0} pts & ${ps?.goalsScored || 0} goals!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
