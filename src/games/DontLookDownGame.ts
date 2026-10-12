import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export type MapTheme = 'cyber' | 'sky' | 'magma';

interface ClimberPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  grounded: boolean;
  coyoteTimer: number;    // Grace window for instant jump after leaving a platform
  canDoubleJump: boolean; // Mid-air air jump
  facing: 1 | -1;
  highestAltitude: number; // in meters
  currentAltitude: number;
  fallDistance: number;
  fallSoundPlayed: boolean;
  animTimer: number;
  score: number;
  reachedSummit: boolean;
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
    this.roundTimer = 90.0;
    this.isFinished = false;
    this.summitReachedWinnerId = null;
    this.worldWidth = Math.max(760, width);
    this.groundY = 3400;
    this.summitY = 220;
    this.cameraY = this.groundY - height + 100;
    this.playersState.clear();

    // Ambient stars / particles
    this.bgStars = [];
    for (let i = 0; i < 90; i++) {
      this.bgStars.push({
        x: Math.random() * this.worldWidth,
        y: Math.random() * this.groundY,
        r: 0.8 + Math.random() * 1.6,
        alpha: 0.2 + Math.random() * 0.6
      });
    }

    // Generate platforms for current map
    this.generateMapPlatforms();

    // Spawn active players at bottom ground
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
        facing: idx % 2 === 0 ? 1 : -1,
        highestAltitude: 0,
        currentAltitude: 0,
        fallDistance: 0,
        fallSoundPlayed: false,
        animTimer: 0,
        score: 0,
        reachedSummit: false
      });
    });

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
        }
      };
    }

    this.bindKeyboardShortcuts();
  }

  private bindKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;
    this.unbindKeyboardShortcuts();

    this.keydownListener = (e: KeyboardEvent) => {
      if (e.key === '1') {
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

  public destroy(): void {
    this.unbindKeyboardShortcuts();
    if (typeof window !== 'undefined' && (window as any).__DONT_LOOK_DOWN_DEBUG__) {
      delete (window as any).__DONT_LOOK_DOWN_DEBUG__;
    }
  }

  public setMapTheme(theme: MapTheme): void {
    if (this.mapTheme === theme) return;
    this.mapTheme = theme;
    this.generateMapPlatforms();

    // Reposition active players safely at the base
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

    // Procedural Vertical Ascent Platforms with guaranteed diverse geometric shapes
    const stepY = 100;
    const totalSteps = Math.floor((this.groundY - this.summitY - 170) / stepY);

    let lastX = this.worldWidth / 2;

    for (let i = 0; i < totalSteps; i++) {
      const y = this.groundY - 90 - i * stepY;
      const progress = i / totalSteps;

      // Guaranteed cyclic distribution so Triangles, Circles, Diamonds, Hexagons, and Beams are prominent on EVERY run
      const shapeCycle = i % 5;
      let shape: PlatformShape = 'triangle';
      if (shapeCycle === 0) shape = 'triangle';
      else if (shapeCycle === 1) shape = 'circle';
      else if (shapeCycle === 2) shape = 'diamond';
      else if (shapeCycle === 3) shape = 'hexagon';
      else shape = 'rectangle';

      // Bold, unmistakable dimensions for each shape so they are visibly distinct
      let w = 85;
      let h = 50;

      if (shape === 'triangle') {
        w = 82;
        h = 56; // Bold tall neon pyramid
      } else if (shape === 'circle') {
        w = 68;
        h = 68; // Full round planetary orb
      } else if (shape === 'diamond') {
        w = 76;
        h = 58; // Faceted crystal gem
      } else if (shape === 'hexagon') {
        w = 82;
        h = 46; // Chunky techno-honeycomb plate
      } else {
        w = 90;
        h = 24; // Classic metallic girder beam
      }

      // Horizontal offset
      const maxOffset = 210;
      let x = lastX + (Math.random() - 0.5) * maxOffset * 2;
      x = Math.max(45, Math.min(this.worldWidth - w - 45, x));
      lastX = x;

      // Platform special modifiers
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

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      return;
    }

    this.worldWidth = Math.max(760, width);

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
          plat.y += 45 * dt; // Sink downward
          if (plat.sinkTimer <= 0) {
            plat.sunk = true;
          }
        }
      }
    }

    // Update Bots AI
    this.updateBots(dt, width, height);

    // Update Players
    const active = this.getActivePlayers();
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ps.animTimer += dt;
      if (ps.coyoteTimer > 0) ps.coyoteTimer -= dt;

      // Handle Inputs
      const steer = this.input.getSteer(p.id);
      const isActionPressed = this.input.isPressed(p.id) || this.input.isActionPressed(p.id);
      const justJump = this.input.justAction(p.id) || this.input.justPressed(p.id) || this.input.justUp(p.id);

      // Horizontal movement & crisp air steering
      if (steer !== 0) {
        ps.vx = steer * 240;
        ps.facing = steer > 0 ? 1 : -1;
      } else {
        ps.vx *= Math.pow(0.92, dt * 60);
      }

      // INSTANT JUMP - NO STALL!
      if (justJump) {
        if (ps.grounded || ps.coyoteTimer > 0) {
          // Instant ground / platform jump
          ps.vy = -690;
          ps.grounded = false;
          ps.coyoteTimer = 0;
          this.audio.playTap();
          this.particles.spawnSparks(ps.x, ps.y + ps.radius, '#FACC15', 8);
        } else if (ps.canDoubleJump) {
          // Responsive mid-air air jump
          ps.vy = -630;
          ps.canDoubleJump = false;
          this.audio.playBoost();
          this.particles.spawnSparks(ps.x, ps.y + ps.radius, '#38BDF8', 10);
          this.particles.showFloatingText('AIR JUMP! 🚀', ps.x, ps.y - 18, '#38BDF8', 14);
        }
      }

      // In-Air Gravity & Fall Physics
      const gravity = 760;
      ps.vy = Math.min(680, ps.vy + gravity * dt);

      // Fall tracking for dramatic effects
      if (ps.vy > 140) {
        ps.fallDistance += ps.vy * dt;
        if (ps.fallDistance > 240 && !ps.fallSoundPlayed) {
          ps.fallSoundPlayed = true;
          this.audio.playTone(480, 0.22, 'sawtooth');
          this.particles.shake(0.12);
        }
      }

      // Position integration
      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

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

      // Platform Collision Detection with Multi-Shape Geometry
      const feetY = ps.y + ps.radius;
      const prevFeetY = feetY - ps.vy * dt;

      for (const plat of this.platforms) {
        if (plat.sunk) continue;

        // Updraft Wind Zone
        if (plat.type === 'updraft') {
          if (ps.x >= plat.x && ps.x <= plat.x + plat.w && ps.y >= plat.y - 120 && ps.y <= plat.y) {
            ps.vy -= 850 * dt;
            if (Math.random() < 0.3) {
              this.particles.spawnSparks(ps.x, ps.y, '#38BDF8', 1);
            }
          }
        }

        // Descending collision check
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
            // Rectangle / Beam
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

            // Landing impact if fell from high
            if (ps.fallDistance > 200) {
              this.particles.shake(0.35);
              this.audio.playBounce();
              this.particles.spawnExplosion(ps.x, ps.y + ps.radius, '#EF4444', 14);
            }
            ps.fallDistance = 0;
            ps.fallSoundPlayed = false;

            // Instant responsive bounce (boosted if holding jump/action)
            let bounceForce = isActionPressed ? 720 : 560;

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

            // Sinking stone activation
            if (plat.type === 'sinking' && plat.sinkTimer !== undefined) {
              plat.sinkTimer -= dt;
            }

            // Moving platform horizontal push
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
        const bounceForce = isActionPressed ? 720 : 560;
        ps.vy = -bounceForce;
        ps.grounded = false;
        ps.fallDistance = 0;
        ps.fallSoundPlayed = false;
        this.audio.playTone(280, 0.08, 'triangle');
        this.particles.spawnSparks(ps.x, ps.y + ps.radius, '#FFFFFF', 4);
      }

      // Calculate Altitude in meters (Ground = 0m, Summit = 320m)
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

    // Smooth Dynamic Camera Tracking
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
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps) return;

    const isEasy = difficulty === 'bot_easy';
    const isNormal = difficulty === 'bot_normal';
    const isHard = difficulty === 'bot_hard';

    // Find candidate platforms above current position within bounce reach
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
    // Parallax Vertical Background
    this.renderBackground(ctx, width, height);

    ctx.save();
    // Apply Vertical Camera Pan
    ctx.translate(0, -this.cameraY);

    // Render Platforms
    this.renderPlatforms(ctx);

    // Render Altitude Milepost Banners every 50 meters
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

    // Render Summit Crown
    this.renderSummitBeacon(ctx);

    // Render Climbers
    this.renderPlayers(ctx);

    ctx.restore();

    // Screen-Space HUD & Overlays
    this.renderAltitudeGauge(ctx, width, height);
    this.renderCenterHUD(ctx, width);
    this.renderMapSelectorPill(ctx, width, height);
  }

  private renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Dynamic Altitude-based Sky Gradient
    const progress = Math.max(0, Math.min(1, (this.groundY - this.cameraY) / (this.groundY - this.summitY)));

    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    if (this.mapTheme === 'cyber') {
      bgGrad.addColorStop(0, '#040714');
      bgGrad.addColorStop(0.6, '#0B112C');
      bgGrad.addColorStop(1, '#1A0B2E');
    } else if (this.mapTheme === 'sky') {
      bgGrad.addColorStop(0, '#0284C7');
      bgGrad.addColorStop(0.5, '#38BDF8');
      bgGrad.addColorStop(1, '#E0F2FE');
    } else {
      // Magma Caldera
      bgGrad.addColorStop(0, '#1C0A0A');
      bgGrad.addColorStop(0.5, '#450A0A');
      bgGrad.addColorStop(1, '#7F1D1D');
    }

    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Parallax Stars / Ash Particles
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

      // Render Distinct Geometric Shapes
      if (plat.shape === 'triangle') {
        // === BOLD NEON TRIANGLE / PYRAMID ===
        ctx.beginPath();
        ctx.moveTo(cx, plat.y);
        ctx.lineTo(plat.x + plat.w, plat.y + plat.h);
        ctx.lineTo(plat.x, plat.y + plat.h);
        ctx.closePath();

        // 3D Facet Shading: Left slope illuminated, right slope shadowed
        const triCol = plat.type === 'bouncy' ? '#FACC15' : (this.mapTheme === 'cyber' ? '#F43F5E' : (this.mapTheme === 'sky' ? '#FB923C' : '#DC2626'));
        ctx.fillStyle = triCol;
        ctx.shadowColor = triCol;
        ctx.shadowBlur = plat.type === 'bouncy' ? 16 : 8;
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Center spine reflection
        ctx.beginPath();
        ctx.moveTo(cx, plat.y);
        ctx.lineTo(cx, plat.y + plat.h);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Glowing Apex Bead
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx, plat.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Triangle Icon
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 12px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('▲', cx, plat.y + plat.h * 0.65);

      } else if (plat.shape === 'circle') {
        // === BOLD 3D PLANETARY ORB ===
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

        // Planetary Orbital Ring
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius * 1.35, radius * 0.42, 0.25, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Circle Core Icon
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 13px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('●', cx, cy);

      } else if (plat.shape === 'diamond') {
        // === TALL FACETED CRYSTAL GEM ===
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

        // Horizontal and vertical facets
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
        // === HONEYCOMB TECHNO PLATE ===
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
        // === METALLIC RECTANGULAR GIRDER ===
        const isBouncy = plat.type === 'bouncy';
        ctx.shadowColor = isBouncy ? '#FACC15' : '#38BDF8';
        ctx.shadowBlur = isBouncy ? 14 : 6;
        ctx.fillStyle = isBouncy ? '#F59E0B' : (this.mapTheme === 'cyber' ? '#0F172A' : (this.mapTheme === 'sky' ? '#334155' : '#1C1917'));
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

        ctx.strokeStyle = isBouncy ? '#FEF08A' : '#38BDF8';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

        // Corner rivets
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

      // Modifiers: Bounce indicator, Updraft beam, Sinking warning
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

    // Glowing Summit Trophy
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

    // Summit Flagpole & Banner
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

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Speed lines when in long freefall (Don't Look Down!)
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

      // Render Chosen Player Mascot Skin (NO generic circle or annoying ring!)
      const mood = ps.fallDistance > 200 ? 'shocked' : (ps.vy < -120 ? 'triumph' : 'idle');
      this.drawPlayerMascot(ctx, p.id, 0, 0, ps.radius, mood, now * 0.001);

      // Jump foot thruster sparks when leaping upwards
      if (ps.vy < -180) {
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(0, ps.radius + 3, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Player Name & Altitude Indicator Tag
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name} (${ps.currentAltitude}m)`, ps.x, ps.y - ps.radius - 12);
    }
  }

  private renderAltitudeGauge(ctx: CanvasRenderingContext2D, width: number, height: number): void {
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

  private renderMapSelectorPill(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pillX = 24;
    const pillY = height - 42;
    const themeName = this.mapTheme === 'cyber' ? 'CYBER SPIRE' : (this.mapTheme === 'sky' ? 'SKY RUINS' : 'MAGMA CALDERA');

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, 170, 26, 13);
    else ctx.rect(pillX, pillY, 170, 26);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.font = '900 10px Montserrat, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`MAP: ${themeName} [1-3]`, pillX + 85, pillY + 13);
    ctx.restore();
  }

  private renderCenterHUD(ctx: CanvasRenderingContext2D, width: number): void {
    const active = this.getActivePlayers();
    const hudW = 400;
    const hudH = 28;
    const hudX = width / 2 - hudW / 2;
    const hudY = 56;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(hudX, hudY, hudW, hudH, 14);
    else ctx.rect(hudX, hudY, hudW, hudH);
    ctx.fill();
    ctx.strokeStyle = this.roundTimer <= 10 ? '#EF4444' : '#FACC15';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    const secsLeft = Math.ceil(this.roundTimer);
    const timeStr = `⏱️ ${secsLeft}s`;

    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const altSummary = active
      .map((p) => {
        const ps = this.playersState.get(p.id);
        return `${p.name}: ${ps?.currentAltitude || 0}m (Peak: ${ps?.highestAltitude || 0}m)`;
      })
      .join('  •  ');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${timeStr}   |   ${altSummary}`, width / 2, hudY + 14);
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
