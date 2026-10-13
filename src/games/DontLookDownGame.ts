import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type MapTheme = 'cyber' | 'sky' | 'magma';

export interface ThemeConfig {
  id: MapTheme;
  name: string;
  bgGradTop: string;
  bgGradMid: string;
  bgGradBottom: string;
  pillColor: string;
}

export const THEME_CONFIGS: ThemeConfig[] = [
  {
    id: 'cyber',
    name: 'Cyber Spire ⚡',
    bgGradTop: '#040714',
    bgGradMid: '#0B112C',
    bgGradBottom: '#1A0B2E',
    pillColor: '#38BDF8'
  },
  {
    id: 'sky',
    name: 'Sky Ruins ☁️',
    bgGradTop: '#0284C7',
    bgGradMid: '#38BDF8',
    bgGradBottom: '#E0F2FE',
    pillColor: '#0EA5E9'
  },
  {
    id: 'magma',
    name: 'Magma Caldera 🔥',
    bgGradTop: '#1C0A0A',
    bgGradMid: '#450A0A',
    bgGradBottom: '#7F1D1D',
    pillColor: '#EF4444'
  }
];

interface ClimberPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  grounded: boolean;
  coyoteTimer: number;
  canDoubleJump: boolean;
  canTripleJump: boolean;
  facing: 1 | -1;
  highestAltitude: number;
  currentAltitude: number;
  fallDistance: number;
  fallSoundPlayed: boolean;
  animTimer: number;
  score: number;
  reachedSummit: boolean;
  isUnderdog: boolean;
  shoveCooldown: number;
}

export type PlatformShape = 'triangle' | 'circle' | 'diamond' | 'hexagon' | 'rectangle';

interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  shape: PlatformShape;
  type: 'standard' | 'bouncy' | 'moving' | 'sinking' | 'updraft';
  vx?: number;
  minX?: number;
  maxX?: number;
  sinkTimer?: number;
  sunk?: boolean;
}

export class DontLookDownGame extends BaseGame {
  public mapTheme: MapTheme = 'cyber';
  public platforms: Platform[] = [];
  private playersState: Map<PlayerId, ClimberPlayer> = new Map();
  private cameraY: number = 0;
  private groundY: number = 3400;
  private summitY: number = 220;
  private worldWidth: number = 800;
  private bgStars: { x: number; y: number; r: number; alpha: number }[] = [];
  private summitReachedWinnerId: PlayerId | null = null;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;

  // Sudden Death State
  private isSuddenDeath: boolean = false;
  private suddenDeathFlashTimer: number = 0;
  private risingVoidY: number = 3500;

  private lastWidth: number = 800;
  private lastHeight: number = 600;

  public get currentMapId(): MapTheme {
    return this.mapTheme;
  }

  public get climbers(): Map<PlayerId, ClimberPlayer> {
    return this.playersState;
  }

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
    this.roundTimer = 90.0;
    this.isFinished = false;
    this.isSuddenDeath = false;
    this.suddenDeathFlashTimer = 0;
    this.summitReachedWinnerId = null;
    this.worldWidth = Math.max(760, width);
    this.groundY = 3400;
    this.summitY = 220;
    this.risingVoidY = this.groundY + 100;
    this.cameraY = this.groundY - height + 100;
    this.playersState.clear();

    this.bgStars = [];
    for (let i = 0; i < 90; i++) {
      this.bgStars.push({
        x: Math.random() * this.worldWidth,
        y: Math.random() * this.groundY,
        r: 0.8 + Math.random() * 1.6,
        alpha: 0.2 + Math.random() * 0.6
      });
    }

    this.generateMapPlatforms();

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const spacing = this.worldWidth / (active.length + 1);
      const px = spacing * (idx + 1);
      const py = this.groundY - 18;

      this.playersState.set(p.id, {
        id: p.id,
        x: px,
        y: py,
        vx: 0,
        vy: 0,
        radius: 14,
        grounded: true,
        coyoteTimer: 0.2,
        canDoubleJump: true,
        canTripleJump: false,
        facing: idx % 2 === 0 ? 1 : -1,
        highestAltitude: 0,
        currentAltitude: 0,
        fallDistance: 0,
        fallSoundPlayed: false,
        animTimer: 0,
        score: 0,
        reachedSummit: false,
        isUnderdog: false,
        shoveCooldown: 0
      });
    });

    const canvas = this.input.getCanvas();
    if (canvas && !this.boundPointerDown) {
      this.boundPointerDown = this.handlePointerDown.bind(this);
      canvas.addEventListener('pointerdown', this.boundPointerDown);
    }

    if (typeof window !== 'undefined') {
      (window as any).__DONT_LOOK_DOWN_DEBUG__ = {
        game: this,
        getPlayer: (id: PlayerId) => this.playersState.get(id),
        getPlatforms: () => this.platforms,
        setPlayerPos: (id: PlayerId, x: number, y: number, vx = 0, vy = 0) => {
          const p = this.playersState.get(id);
          if (p) {
            p.x = x;
            p.y = y;
            p.vx = vx;
            p.vy = vy;
          }
        },
        reachSummit: (id: PlayerId) => {
          const p = this.playersState.get(id);
          if (p) {
            p.x = this.worldWidth / 2;
            p.y = this.summitY;
            p.reachedSummit = true;
            this.summitReachedWinnerId = id;
            this.isFinished = true;
          }
        },
        setTheme: (theme: MapTheme) => {
          this.setMapTheme(theme);
        },
        getThemeIndex: () => THEME_CONFIGS.findIndex((t) => t.id === this.mapTheme),
        setThemeIndex: (idx: number) => {
          const cfg = THEME_CONFIGS[idx % THEME_CONFIGS.length];
          if (cfg) this.setMapTheme(cfg.id);
        }
      };
    }

    this.bindKeyboardShortcuts();
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

  private cycleTheme(): void {
    const curIdx = THEME_CONFIGS.findIndex((t) => t.id === this.mapTheme);
    const nextIdx = (curIdx + 1) % THEME_CONFIGS.length;
    this.setMapTheme(THEME_CONFIGS[nextIdx].id);
  }

  private bindKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;
    this.unbindKeyboardShortcuts();

    this.keydownListener = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === '1') {
        this.setMapTheme('cyber');
      } else if (e.key === '2') {
        this.setMapTheme('sky');
      } else if (e.key === '3') {
        this.setMapTheme('magma');
      }
    };
    window.addEventListener('keydown', this.keydownListener);
  }

  private unbindKeyboardShortcuts(): void {
    if (typeof window !== 'undefined' && this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
  }

  public override destroy(): void {
    this.unbindKeyboardShortcuts();
    if (this.boundPointerDown) {
      const canvas = this.input.getCanvas();
      if (canvas) {
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
      }
      this.boundPointerDown = null;
    }
    if (typeof window !== 'undefined' && (window as any).__DONT_LOOK_DOWN_DEBUG__) {
      delete (window as any).__DONT_LOOK_DOWN_DEBUG__;
    }
  }

  public setMapTheme(theme: MapTheme): void {
    if (this.mapTheme === theme) return;
    this.mapTheme = theme;
    this.generateMapPlatforms();

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      if (ps) {
        const spacing = this.worldWidth / (active.length + 1);
        ps.x = spacing * (idx + 1);
        ps.y = this.groundY - 18;
        ps.vx = 0;
        ps.vy = 0;
        ps.grounded = true;
        ps.coyoteTimer = 0.2;
        ps.canDoubleJump = true;
        ps.currentAltitude = 0;
        ps.fallDistance = 0;
      }
    });

    const themeName = theme === 'cyber' ? 'CYBER SPIRE' : (theme === 'sky' ? 'SKY RUINS' : 'MAGMA CALDERA');
    this.particles.showFloatingText(`MAP: ${themeName}`, this.worldWidth / 2, this.cameraY + 120, '#38BDF8', 22);
    this.audio.playTone(520, 0.12, 'sine');
  }

  private generateMapPlatforms(): void {
    this.platforms = [];

    // Base ground platform
    this.platforms.push({
      x: 0,
      y: this.groundY,
      w: this.worldWidth,
      h: 50,
      shape: 'rectangle',
      type: 'standard'
    });

    // Summit Victory Platform at Top (320m)
    this.platforms.push({
      x: this.worldWidth / 2 - 90,
      y: this.summitY,
      w: 180,
      h: 28,
      shape: 'rectangle',
      type: 'bouncy'
    });

    const stepY = 100;
    const totalSteps = Math.floor((this.groundY - this.summitY - 170) / stepY);

    let lastX = this.worldWidth / 2;

    for (let i = 0; i < totalSteps; i++) {
      const y = this.groundY - 90 - i * stepY;

      const shapeCycle = i % 5;
      let shape: PlatformShape = 'triangle';
      if (shapeCycle === 0) shape = 'triangle';
      else if (shapeCycle === 1) shape = 'circle';
      else if (shapeCycle === 2) shape = 'diamond';
      else if (shapeCycle === 3) shape = 'hexagon';
      else shape = 'rectangle';

      let w = 85;
      let h = 50;

      if (shape === 'triangle') {
        w = 82;
        h = 56;
      } else if (shape === 'circle') {
        w = 68;
        h = 68;
      } else if (shape === 'diamond') {
        w = 76;
        h = 58;
      } else if (shape === 'hexagon') {
        w = 82;
        h = 46;
      } else {
        w = 90;
        h = 24;
      }

      const maxOffset = 210;
      let x = lastX + (Math.random() - 0.5) * maxOffset * 2;
      x = Math.max(45, Math.min(this.worldWidth - w - 45, x));
      lastX = x;

      let type: Platform['type'] = 'standard';
      const roll = Math.random();

      if (shape === 'circle') {
        if (roll < 0.28) type = 'bouncy';
        else if (roll < 0.50) type = 'moving';
      } else if (shape === 'triangle') {
        if (roll < 0.25) type = 'bouncy';
        else if (roll < 0.45 && this.mapTheme === 'sky') type = 'updraft';
      } else if (shape === 'diamond') {
        if (roll < 0.30) type = 'bouncy';
      } else if (shape === 'hexagon') {
        if (roll < 0.30) type = 'moving';
        else if (this.mapTheme === 'magma' && roll < 0.55) type = 'sinking';
      } else {
        if (this.mapTheme === 'magma' && roll < 0.35) type = 'sinking';
        else if (roll < 0.30) type = 'moving';
      }

      const plat: Platform = {
        x,
        y,
        w,
        h,
        shape,
        type
      };

      if (type === 'moving') {
        plat.vx = (Math.random() > 0.5 ? 1 : -1) * (65 + Math.random() * 45);
        plat.minX = Math.max(30, x - 110);
        plat.maxX = Math.min(this.worldWidth - w - 30, x + 110);
      } else if (type === 'sinking') {
        plat.sinkTimer = 1.0;
        plat.sunk = false;
      }

      this.platforms.push(plat);
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastWidth = width;
    this.lastHeight = height;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      return;
    }

    // Sudden Death Activation (<= 15 seconds remaining)
    if (this.roundTimer <= 15.0 && !this.isSuddenDeath) {
      this.isSuddenDeath = true;
      this.audio.playBoost();
      this.particles.shake(6);
    }

    if (this.isSuddenDeath) {
      this.suddenDeathFlashTimer += dt;
      // Rising void storm climbs upwards at 45 px/sec
      this.risingVoidY -= 45 * dt;
    }

    this.worldWidth = Math.max(760, width);

    // Underdog surge calculations
    let maxAltitude = -1;
    for (const ps of this.playersState.values()) {
      if (ps.currentAltitude > maxAltitude) maxAltitude = ps.currentAltitude;
    }
    for (const ps of this.playersState.values()) {
      ps.isUnderdog = maxAltitude >= 40 && ps.currentAltitude <= maxAltitude - 40;
    }

    // Update Moving & Sinking Platforms
    for (const plat of this.platforms) {
      if (plat.type === 'moving' && plat.vx && plat.minX !== undefined && plat.maxX !== undefined) {
        plat.x += plat.vx * dt;
        if (plat.x < plat.minX) {
          plat.x = plat.minX;
          plat.vx *= -1;
        } else if (plat.x > plat.maxX) {
          plat.x = plat.maxX;
          plat.vx *= -1;
        }
      } else if (plat.type === 'sinking' && plat.sinkTimer !== undefined) {
        if (plat.sinkTimer < 1.0) {
          plat.y += 45 * dt;
          if (plat.sinkTimer <= 0) {
            plat.sunk = true;
          }
        }
      }
    }

    this.updateBots(dt, width, height);

    // Update Players
    const active = this.getActivePlayers();
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ps.animTimer += dt;
      if (ps.coyoteTimer > 0) ps.coyoteTimer -= dt;
      if (ps.shoveCooldown > 0) ps.shoveCooldown -= dt;

      const steer = this.input.getSteer(p.id);
      const isActionPressed = this.input.isPressed(p.id) || this.input.isActionPressed(p.id);
      const justJump = this.input.justAction(p.id) || this.input.justPressed(p.id) || this.input.justUp(p.id);

      if (steer !== 0) {
        const moveSpd = ps.isUnderdog ? 290 : 240;
        ps.vx = steer * moveSpd;
        ps.facing = steer > 0 ? 1 : -1;
      } else {
        ps.vx *= Math.pow(0.92, dt * 60);
      }

      // INSTANT JUMP - NO STALL!
      if (justJump) {
        const baseJumpVy = ps.isUnderdog ? -820 : -690;
        if (ps.grounded || ps.coyoteTimer > 0) {
          ps.vy = baseJumpVy;
          ps.grounded = false;
          ps.coyoteTimer = 0;
          this.audio.playTap();
          this.particles.spawnSparks(ps.x, ps.y + ps.radius, '#FACC15', 8);
        } else if (ps.canDoubleJump) {
          ps.vy = ps.isUnderdog ? -750 : -630;
          ps.canDoubleJump = false;
          ps.canTripleJump = ps.isUnderdog;
          this.audio.playBoost();
          this.particles.spawnSparks(ps.x, ps.y + ps.radius, '#38BDF8', 10);
          this.particles.showFloatingText('AIR JUMP! 🚀', ps.x, ps.y - 18, '#38BDF8', 14);
        } else if (ps.canTripleJump) {
          ps.vy = -720;
          ps.canTripleJump = false;
          this.audio.playBoost();
          this.particles.spawnSparks(ps.x, ps.y + ps.radius, '#F59E0B', 14);
          this.particles.showFloatingText('UNDERDOG TRIPLE! ⚡', ps.x, ps.y - 18, '#F59E0B', 16);
        }
      }

      const gravity = 760;
      ps.vy = Math.min(680, ps.vy + gravity * dt);

      if (ps.vy > 140) {
        ps.fallDistance += ps.vy * dt;
        if (ps.fallDistance > 240 && !ps.fallSoundPlayed) {
          ps.fallSoundPlayed = true;
          this.audio.playTone(480, 0.22, 'sawtooth');
          this.particles.shake(0.12);
        }
      }

      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Rising void storm hazard check
      if (this.isSuddenDeath && ps.y >= this.risingVoidY) {
        ps.vy = -780; // Violent thermal geyser blast pushing player back up!
        this.audio.playExplosion();
        this.particles.shake(0.4);
        this.particles.spawnExplosion(ps.x, ps.y, '#EF4444', 20);
        this.particles.showFloatingText('🔥 VOID SURGE!', ps.x, ps.y - 20, '#EF4444', 16);
      }

      // Horizontal boundaries
      if (ps.x < ps.radius + 15) {
        ps.x = ps.radius + 15;
        ps.vx = Math.abs(ps.vx) * 0.4;
        ps.facing = 1;
      } else if (ps.x > this.worldWidth - ps.radius - 15) {
        ps.x = this.worldWidth - ps.radius - 15;
        ps.vx = -Math.abs(ps.vx) * 0.4;
        ps.facing = -1;
      }

      // Platform Collision Detection
      const feetY = ps.y + ps.radius;
      const prevFeetY = feetY - ps.vy * dt;

      for (const plat of this.platforms) {
        if (plat.sunk) continue;

        if (plat.type === 'updraft') {
          if (ps.x >= plat.x && ps.x <= plat.x + plat.w && ps.y >= plat.y - 120 && ps.y <= plat.y) {
            ps.vy -= 850 * dt;
            if (Math.random() < 0.3) {
              this.particles.spawnSparks(ps.x, ps.y, '#38BDF8', 1);
            }
          }
        }

        if (ps.vy >= 0) {
          let hasLanded = false;
          let landY = plat.y;
          let lateralPush = 0;

          if (plat.shape === 'circle') {
            const radius = plat.w / 2;
            const cx = plat.x + radius;
            const cy = plat.y + radius;
            const dx = ps.x - cx;
            if (Math.abs(dx) <= radius + ps.radius * 0.75 && ps.y <= cy + 12) {
              const insideRad = Math.max(0, radius * radius - dx * dx);
              const topArcY = cy - Math.sqrt(insideRad);
              if (prevFeetY <= topArcY + 16 && feetY >= topArcY - 10) {
                hasLanded = true;
                landY = topArcY;
                lateralPush = (dx / radius) * 35;
              }
            }
          } else if (plat.shape === 'triangle') {
            const cx = plat.x + plat.w / 2;
            const dx = Math.abs(ps.x - cx);
            if (dx <= plat.w / 2 + 6) {
              const slopeY = plat.y + (dx / (plat.w / 2)) * plat.h;
              if (prevFeetY <= slopeY + 16 && feetY >= slopeY - 10) {
                hasLanded = true;
                landY = slopeY;
                lateralPush = Math.sign(ps.x - cx) * 30;
              }
            }
          } else if (plat.shape === 'diamond') {
            const cx = plat.x + plat.w / 2;
            const dx = Math.abs(ps.x - cx);
            if (dx <= plat.w / 2) {
              const slopeY = plat.y + (dx / (plat.w / 2)) * (plat.h / 2);
              if (prevFeetY <= slopeY + 16 && feetY >= slopeY - 10) {
                hasLanded = true;
                landY = slopeY;
              }
            }
          } else if (plat.shape === 'hexagon') {
            const cx = plat.x + plat.w / 2;
            const dx = Math.abs(ps.x - cx);
            if (dx <= plat.w / 2 + 4) {
              const shoulderY = plat.y + (Math.max(0, dx - plat.w * 0.25) / (plat.w * 0.25)) * (plat.h * 0.25);
              if (prevFeetY <= shoulderY + 16 && feetY >= shoulderY - 10) {
                hasLanded = true;
                landY = shoulderY;
              }
            }
          } else {
            if (ps.x >= plat.x - 8 && ps.x <= plat.x + plat.w + 8) {
              if (prevFeetY <= plat.y + 16 && feetY >= plat.y - 10) {
                hasLanded = true;
                landY = plat.y;
              }
            }
          }

          if (hasLanded) {
            ps.y = landY - ps.radius;
            ps.vx += lateralPush;
            ps.grounded = true;
            ps.coyoteTimer = 0.22;
            ps.canDoubleJump = true;
            ps.canTripleJump = ps.isUnderdog;

            if (ps.fallDistance > 200) {
              this.particles.shake(0.35);
              this.audio.playBounce();
              this.particles.spawnExplosion(ps.x, ps.y + ps.radius, '#EF4444', 14);
            }
            ps.fallDistance = 0;
            ps.fallSoundPlayed = false;

            let bounceForce = isActionPressed ? 720 : 560;
            if (this.isSuddenDeath) bounceForce *= 1.15; // +15% bounce in sudden death

            if (plat.type === 'bouncy') {
              bounceForce = Math.max(bounceForce, 780);
              this.audio.playBounce();
              this.particles.spawnExplosion(ps.x, ps.y + ps.radius, '#FACC15', 12);
            } else if (plat.shape === 'triangle') {
              bounceForce = Math.max(bounceForce, 640);
              this.audio.playTone(420, 0.08, 'triangle');
              this.particles.spawnSparks(ps.x, ps.y + ps.radius, '#EF4444', 8);
            } else if (plat.shape === 'circle') {
              bounceForce = Math.max(bounceForce, 600);
              this.audio.playTone(380, 0.08, 'sine');
              this.particles.spawnSparks(ps.x, ps.y + ps.radius, '#38BDF8', 6);
            } else if (plat.shape === 'diamond') {
              bounceForce = Math.max(bounceForce, 620);
              this.particles.spawnSparks(ps.x, ps.y + ps.radius, '#C084FC', 6);
            } else {
              this.audio.playTone(320 + Math.min(280, ps.currentAltitude * 0.9), 0.08, 'triangle');
              this.particles.spawnSparks(ps.x, ps.y + ps.radius, '#FFFFFF', 4);
            }

            ps.vy = -bounceForce;
            ps.grounded = false;

            if (plat.type === 'sinking' && plat.sinkTimer !== undefined) {
              plat.sinkTimer -= dt;
            }

            if (plat.type === 'moving' && plat.vx) {
              ps.x += plat.vx * dt;
            }
            break;
          }
        }
      }

      // Base Ground Instant Bounce
      if (ps.y >= this.groundY - ps.radius) {
        ps.y = this.groundY - ps.radius;
        ps.grounded = true;
        ps.coyoteTimer = 0.22;
        ps.canDoubleJump = true;
        ps.canTripleJump = ps.isUnderdog;
        const bounceForce = isActionPressed ? 720 : 560;
        ps.vy = -bounceForce;
        ps.grounded = false;
        ps.fallDistance = 0;
        ps.fallSoundPlayed = false;
        this.audio.playTone(280, 0.08, 'triangle');
        this.particles.spawnSparks(ps.x, ps.y + ps.radius, '#FFFFFF', 4);
      }

      // Altitude tracking
      ps.currentAltitude = Math.max(0, Math.floor((this.groundY - ps.y) / 10));
      if (ps.currentAltitude > ps.highestAltitude) {
        ps.highestAltitude = ps.currentAltitude;
      }

      // Summit Victory Check
      if (ps.y <= this.summitY + 10 && !ps.reachedSummit) {
        ps.reachedSummit = true;
        this.summitReachedWinnerId = ps.id;
        this.isFinished = true;
        this.audio.playFanfare();
        this.particles.spawnExplosion(ps.x, ps.y, '#FACC15', 60);
        this.particles.showFloatingText('👑 SUMMIT CONQUERED!', ps.x, ps.y - 30, '#FACC15', 28);
      }
    }

    // Mid-air Climber Shoving & Trampoline Head-Bouncing
    const climberList = Array.from(this.playersState.values());
    for (let i = 0; i < climberList.length; i++) {
      for (let j = i + 1; j < climberList.length; j++) {
        const c1 = climberList[i];
        const c2 = climberList[j];
        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = c1.radius + c2.radius + 4;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Trampoline head-bounce: higher player bounces off lower player's head!
          if (c1.y < c2.y - 12 && c1.vy > 0 && c1.shoveCooldown <= 0) {
            c1.vy = -820; // Super bounce
            c2.vy = Math.max(260, c2.vy + 200); // Shoved downward
            c1.shoveCooldown = 0.5;
            this.audio.playBounce();
            this.particles.spawnExplosion(c1.x, c2.y, '#FACC15', 12);
            this.particles.showFloatingText('HEAD BOUNCE! 💥', c1.x, c1.y - 20, '#FACC15', 16);
          } else if (c2.y < c1.y - 12 && c2.vy > 0 && c2.shoveCooldown <= 0) {
            c2.vy = -820;
            c1.vy = Math.max(260, c1.vy + 200);
            c2.shoveCooldown = 0.5;
            this.audio.playBounce();
            this.particles.spawnExplosion(c2.x, c1.y, '#FACC15', 12);
            this.particles.showFloatingText('HEAD BOUNCE! 💥', c2.x, c2.y - 20, '#FACC15', 16);
          } else {
            // Lateral elastic collision
            const overlap = (minDist - dist) * 0.5;
            c1.x -= nx * overlap;
            c1.y -= ny * overlap;
            c2.x += nx * overlap;
            c2.y += ny * overlap;

            const rvx = c2.vx - c1.vx;
            const impulse = rvx * nx;
            if (impulse < 0) {
              c1.vx -= nx * (impulse * 0.7);
              c2.vx += nx * (impulse * 0.7);
            }
          }
        }
      }
    }

    // Dynamic Camera Tracking
    let highestPlayerY = this.groundY;
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      if (ps.y < highestPlayerY) {
        highestPlayerY = ps.y;
      }
    }
    const targetCameraY = highestPlayerY - height * 0.58;
    this.cameraY += (targetCameraY - this.cameraY) * Math.min(1, dt * 6.5);
    this.cameraY = Math.max(this.summitY - 80, Math.min(this.groundY - height + 100, this.cameraY));
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    _height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps) return;

    const isNormal = difficulty === 'bot_normal';
    const isHard = difficulty === 'bot_hard';

    let bestPlat: Platform | null = null;
    let bestScore = -Infinity;

    const maxReachY = isHard ? 260 : (isNormal ? 210 : 170);
    const maxReachX = isHard ? 260 : (isNormal ? 210 : 160);

    for (const plat of this.platforms) {
      if (plat.sunk) continue;
      const dy = ps.y - plat.y;

      if (dy > 15 && dy < maxReachY) {
        let platCenterX = plat.x + plat.w / 2;

        if (plat.type === 'moving' && plat.vx) {
          const timeToReach = Math.sqrt((2 * dy) / 760);
          platCenterX += plat.vx * timeToReach;
          platCenterX = Math.max(plat.minX || 30, Math.min(plat.maxX || width - 30, platCenterX));
        }

        const dx = Math.abs(ps.x - platCenterX);
        if (dx < maxReachX) {
          let score = dy * 1.6 - dx * 1.1;

          if (plat.type === 'bouncy') score += 60;
          if (plat.shape === 'triangle') score += 40;
          if (plat.shape === 'circle') score += 35;
          if (plat.shape === 'diamond') score += 30;
          if (plat.type === 'sinking') score -= 50;

          if (plat.y <= this.summitY + 30) score += 250;

          if (score > bestScore) {
            bestScore = score;
            bestPlat = plat;
          }
        }
      }
    }

    if (bestPlat) {
      let targetX = bestPlat.x + bestPlat.w / 2;
      if (bestPlat.type === 'moving' && bestPlat.vx) {
        const timeToReach = Math.max(0.1, (ps.y - bestPlat.y) / 450);
        targetX += bestPlat.vx * timeToReach;
      }

      const dx = targetX - ps.x;
      const alignThreshold = isHard ? 6 : (isNormal ? 12 : 18);

      let steer = 0;
      if (dx > alignThreshold) steer = 1;
      else if (dx < -alignThreshold) steer = -1;

      const dy = ps.y - bestPlat.y;
      const wantsSpringBoost = dy > (isHard ? 110 : 140) || Math.abs(dx) > 90;

      this.input.setBotInput(botId, wantsSpringBoost, steer);
    } else {
      const centerDist = width / 2 - ps.x;
      const steer = Math.abs(centerDist) > 35 ? Math.sign(centerDist) : 0;
      this.input.setBotInput(botId, false, steer);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const curTheme = THEME_CONFIGS.find((t) => t.id === this.mapTheme) || THEME_CONFIGS[0];

    this.renderBackground(ctx, width, height, curTheme);

    ctx.save();
    ctx.translate(0, -this.cameraY);

    this.renderPlatforms(ctx);

    // Altitude Mileposts every 50 meters
    for (let alt = 50; alt <= 300; alt += 50) {
      const bannerY = this.groundY - alt * 10;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(30, bannerY);
      ctx.lineTo(this.worldWidth - 30, bannerY);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '700 11px Montserrat, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${alt}m`, this.worldWidth - 38, bannerY - 4);
      ctx.restore();
    }

    // Rising Void Hazard Line in Sudden Death
    if (this.isSuddenDeath) {
      ctx.save();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
      ctx.fillRect(0, this.risingVoidY, this.worldWidth, this.groundY - this.risingVoidY + 200);
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, this.risingVoidY);
      ctx.lineTo(this.worldWidth, this.risingVoidY);
      ctx.stroke();
      ctx.restore();
    }

    this.renderSummitBeacon(ctx);
    this.renderPlayers(ctx);

    ctx.restore();

    // Screen-space HUD & Overlays
    this.renderAltitudeGauge(ctx, width, height);
    this.renderCenterHUD(ctx, width, curTheme);
    this.renderMapSelectorPill(ctx, width, height, curTheme);
  }

  private renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number, theme: ThemeConfig): void {
    const progress = Math.max(0, Math.min(1, (this.groundY - this.cameraY) / (this.groundY - this.summitY)));

    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(0.6, theme.bgGradMid);
    bgGrad.addColorStop(1, theme.bgGradBottom);

    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#FFFFFF';
    for (const s of this.bgStars) {
      const drawY = ((s.y - this.cameraY * 0.4) % height + height) % height;
      ctx.globalAlpha = s.alpha * (0.3 + progress * 0.7);
      ctx.beginPath();
      ctx.arc(s.x, drawY, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  private renderPlatforms(ctx: CanvasRenderingContext2D): void {
    for (const plat of this.platforms) {
      if (plat.sunk) continue;

      ctx.save();
      const cx = plat.x + plat.w / 2;
      const cy = plat.y + plat.h / 2;

      if (plat.shape === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(cx, plat.y);
        ctx.lineTo(plat.x + plat.w, plat.y + plat.h);
        ctx.lineTo(plat.x, plat.y + plat.h);
        ctx.closePath();

        const triCol = plat.type === 'bouncy' ? '#FACC15' : (this.mapTheme === 'cyber' ? '#F43F5E' : (this.mapTheme === 'sky' ? '#FB923C' : '#DC2626'));
        ctx.fillStyle = triCol;
        ctx.shadowColor = triCol;
        ctx.shadowBlur = plat.type === 'bouncy' ? 16 : 8;
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx, plat.y);
        ctx.lineTo(cx, plat.y + plat.h);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx, plat.y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 12px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('▲', cx, plat.y + plat.h * 0.65);

      } else if (plat.shape === 'circle') {
        const radius = plat.w / 2;
        const orbGrad = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.35, radius * 0.1, cx, cy, radius);
        if (this.mapTheme === 'cyber') {
          orbGrad.addColorStop(0, '#E0F2FE');
          orbGrad.addColorStop(0.5, '#0284C7');
          orbGrad.addColorStop(1, '#082F49');
        } else if (this.mapTheme === 'sky') {
          orbGrad.addColorStop(0, '#FDF4FF');
          orbGrad.addColorStop(0.5, '#A855F7');
          orbGrad.addColorStop(1, '#581C87');
        } else {
          orbGrad.addColorStop(0, '#FEF08A');
          orbGrad.addColorStop(0.5, '#EA580C');
          orbGrad.addColorStop(1, '#431407');
        }

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = orbGrad;
        ctx.shadowColor = plat.type === 'bouncy' ? '#FACC15' : '#38BDF8';
        ctx.shadowBlur = plat.type === 'bouncy' ? 16 : 10;
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(cx, cy, radius * 1.35, radius * 0.42, 0.25, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 13px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('●', cx, cy);

      } else if (plat.shape === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(cx, plat.y);
        ctx.lineTo(plat.x + plat.w, cy);
        ctx.lineTo(cx, plat.y + plat.h);
        ctx.lineTo(plat.x, cy);
        ctx.closePath();

        const gemCol = plat.type === 'bouncy' ? '#FACC15' : (this.mapTheme === 'cyber' ? '#818CF8' : (this.mapTheme === 'sky' ? '#C084FC' : '#FB923C'));
        ctx.fillStyle = gemCol;
        ctx.shadowColor = gemCol;
        ctx.shadowBlur = 12;
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx, plat.y);
        ctx.lineTo(cx, plat.y + plat.h);
        ctx.moveTo(plat.x, cy);
        ctx.lineTo(plat.x + plat.w, cy);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 13px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('◆', cx, cy);

      } else if (plat.shape === 'hexagon') {
        const rx = plat.w / 2;
        const ry = plat.h / 2;
        ctx.beginPath();
        for (let a = 0; a < 6; a++) {
          const ang = (a * Math.PI) / 3;
          const px = cx + Math.cos(ang) * rx;
          const py = cy + Math.sin(ang) * ry;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();

        ctx.fillStyle = plat.type === 'bouncy' ? '#F59E0B' : (this.mapTheme === 'cyber' ? '#0F172A' : '#1E293B');
        ctx.shadowColor = plat.type === 'bouncy' ? '#FACC15' : '#38BDF8';
        ctx.shadowBlur = plat.type === 'bouncy' ? 14 : 8;
        ctx.fill();

        ctx.strokeStyle = plat.type === 'bouncy' ? '#FEF08A' : '#38BDF8';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#38BDF8';
        ctx.font = '900 12px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⬡', cx, cy);

      } else {
        const isBouncy = plat.type === 'bouncy';
        ctx.shadowColor = isBouncy ? '#FACC15' : '#38BDF8';
        ctx.shadowBlur = isBouncy ? 14 : 6;
        ctx.fillStyle = isBouncy ? '#F59E0B' : (this.mapTheme === 'cyber' ? '#0F172A' : (this.mapTheme === 'sky' ? '#334155' : '#1C1917'));
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

        ctx.strokeStyle = isBouncy ? '#FEF08A' : '#38BDF8';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(plat.x + 3, plat.y + 3, 3, 3);
        ctx.fillRect(plat.x + plat.w - 6, plat.y + 3, 3, 3);
        ctx.fillRect(plat.x + 3, plat.y + plat.h - 6, 3, 3);
        ctx.fillRect(plat.x + plat.w - 6, plat.y + plat.h - 6, 3, 3);

        ctx.fillStyle = isBouncy ? '#000000' : '#FFFFFF';
        ctx.font = '900 11px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('▬', cx, cy);
      }

      if (plat.type === 'bouncy') {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 9px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('BOOST', cx, plat.y - 6);
      } else if (plat.type === 'sinking') {
        ctx.fillStyle = '#FCA5A5';
        ctx.font = '900 9px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ SINKING', cx, plat.y - 6);
      } else if (plat.type === 'updraft') {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.fillRect(plat.x, plat.y - 100, plat.w, 100);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(plat.x, plat.y - 100, plat.w, 100);
        ctx.setLineDash([]);
      }

      ctx.restore();
    }
  }

  private renderSummitBeacon(ctx: CanvasRenderingContext2D): void {
    const bx = this.worldWidth / 2;
    const by = this.summitY - 15;

    ctx.save();
    ctx.shadowColor = '#FACC15';
    ctx.shadowBlur = 24;

    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(bx, by, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#78350F';
    ctx.font = '900 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👑', bx, by);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 12px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FINISH SUMMIT (320m)', bx, by - 32);
    ctx.restore();
  }

  private renderPlayers(ctx: CanvasRenderingContext2D): void {
    const active = this.getActivePlayers();
    const now = performance.now();

    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      const isBot = p.type.startsWith('bot_');

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Underdog Jet Boots Golden Aura
      if (ps.isUnderdog) {
        ctx.save();
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, ps.radius + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Speed lines in freefall
      if (ps.fallDistance > 180) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.5;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 10, -ps.radius - 15);
          ctx.lineTo(i * 10, -ps.radius - 35);
          ctx.stroke();
        }
      }

      let mood: CharacterMood = 'focused';
      if (ps.fallDistance > 200) {
        mood = 'shocked';
      } else if (ps.vy < -120 || ps.currentAltitude > 200) {
        mood = 'triumph';
      } else if (ps.grounded) {
        mood = 'happy';
      }

      drawCharacter(ctx, 0, 0, ps.radius, p.id, isBot, mood, now * 0.003);

      if (ps.vy < -180) {
        ctx.fillStyle = ps.isUnderdog ? '#F59E0B' : '#FACC15';
        ctx.beginPath();
        ctx.arc(0, ps.radius + 3, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name} (${ps.currentAltitude}m)`, ps.x, ps.y - ps.radius - 12);
    }
  }

  private renderAltitudeGauge(ctx: CanvasRenderingContext2D, _width: number, height: number): void {
    const barX = 18;
    const barY = 90;
    const barW = 10;
    const barH = height - 160;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    const active = this.getActivePlayers();
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      const ratio = Math.min(1.0, ps.currentAltitude / 320);
      const pinY = barY + barH * (1 - ratio);

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(barX + barW / 2, pinY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderMapSelectorPill(ctx: CanvasRenderingContext2D, _width: number, height: number, theme: ThemeConfig): void {
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.strokeStyle = theme.pillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = 'bold 11px "Outfit", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.name} [T]`, pillX + pillW * 0.5, pillY + pillH * 0.5);

    // Right-aligned control hints
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '11px "Outfit", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('Steer: A/D or Left/Right • Leap: Space/Enter/Up', this.lastWidth - 24, height - 28);
    ctx.restore();
  }

  private renderCenterHUD(ctx: CanvasRenderingContext2D, width: number, theme: ThemeConfig): void {
    const active = this.getActivePlayers();
    const hudW = Math.min(width - 60, 480);
    const hudH = 26;
    const hudX = width / 2 - hudW / 2;
    const hudY = 56;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, hudW, hudH, 13);
    ctx.fill();
    ctx.strokeStyle = this.isSuddenDeath ? '#EF4444' : theme.pillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (this.isSuddenDeath) {
      const flash = Math.sin(this.suddenDeathFlashTimer * 10) > 0;
      ctx.fillStyle = flash ? '#FDE047' : '#EF4444';
      ctx.fillText('⚡ SUDDEN DEATH: RISING VOID TIDE & SUPER SPRING JUMPS! ⚡', width / 2, hudY + 13);
    } else {
      const altSummary = active
        .map((p) => {
          const ps = this.playersState.get(p.id);
          return `${p.name}: ${ps?.currentAltitude || 0}m (Peak: ${ps?.highestAltitude || 0}m)`;
        })
        .join('  •  ');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(altSummary, width / 2, hudY + 13);
    }
    ctx.restore();
  }

  public isRoundOver(): boolean {
    if (this.isFinished) return true;
    if (this.summitReachedWinnerId !== null) return true;
    return this.roundTimer <= 0;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    let winnerId: PlayerId | null = this.summitReachedWinnerId;
    let highestPeak = -1;

    if (winnerId === null) {
      active.forEach((p) => {
        const ps = this.playersState.get(p.id);
        const peak = ps?.highestAltitude || 0;
        if (peak > highestPeak) {
          highestPeak = peak;
          winnerId = p.id;
        }
      });
    } else {
      highestPeak = this.playersState.get(winnerId)?.highestAltitude || 0;
    }

    const sorted = [...active].sort((a, b) => {
      const pA = this.playersState.get(a.id)?.highestAltitude || 0;
      const pB = this.playersState.get(b.id)?.highestAltitude || 0;
      return pB - pA;
    });

    if (sorted.length > 1 && this.summitReachedWinnerId === null) {
      const top1 = this.playersState.get(sorted[0].id)?.highestAltitude || 0;
      const top2 = this.playersState.get(sorted[1].id)?.highestAltitude || 0;
      if (top1 === top2) {
        winnerId = null;
      }
    }

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      place: idx + 1,
      score: this.playersState.get(p.id)?.highestAltitude || 0
    }));

    let highlight = 'The 90s vertical rush ended in an altitude tie!';
    if (this.summitReachedWinnerId !== null) {
      highlight = `🏆 ${this.getPlayer(this.summitReachedWinnerId)?.name ?? 'Winner'} conquered the summit (${highestPeak}m)!`;
    } else if (winnerId !== null) {
      highlight = `🚩 ${this.getPlayer(winnerId)?.name ?? 'Winner'} reached the highest peak (${highestPeak}m) in the 90s rush!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight: highlight
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }
}
