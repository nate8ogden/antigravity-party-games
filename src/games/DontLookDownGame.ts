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
  facing: 1 | -1;
  chargeJump?: number; // legacy optional
  isCharging?: boolean;
  highestAltitude: number; // in meters
  currentAltitude: number;
  fallDistance: number;
  fallSoundPlayed: boolean;
  animTimer: number;
  score: number;
  reachedSummit: boolean;
  springBoostActive?: boolean;
}

export type PlatformShape = 'rectangle' | 'circle' | 'diamond' | 'hexagon' | 'cloud' | 'triangle';

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
    // 90 seconds high-stakes vertical ascent rush
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
        facing: idx % 2 === 0 ? 1 : -1,
        highestAltitude: 0,
        currentAltitude: 0,
        fallDistance: 0,
        fallSoundPlayed: false,
        animTimer: 0,
        score: 0,
        reachedSummit: false,
        springBoostActive: false
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
        setRoundTimer: (t: number) => { this.roundTimer = t; },
        getRoundTimer: () => this.roundTimer,
        setMapTheme: (t: MapTheme) => this.setMapTheme(t)
      };
    }

    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
    }
    this.keydownListener = (e: KeyboardEvent) => {
      if (e.code === 'Digit1' || e.code === 'Numpad1' || e.key === '1') {
        this.setMapTheme('cyber', this.worldWidth, height);
      } else if (e.code === 'Digit2' || e.code === 'Numpad2' || e.key === '2') {
        this.setMapTheme('sky', this.worldWidth, height);
      } else if (e.code === 'Digit3' || e.code === 'Numpad3' || e.key === '3') {
        this.setMapTheme('magma', this.worldWidth, height);
      }
    };
    window.addEventListener('keydown', this.keydownListener);
  }

  public setMapTheme(theme: MapTheme, width?: number, height?: number): void {
    if (this.mapTheme === theme) return;
    this.mapTheme = theme;
    this.audio.playTap();
    this.generateMapPlatforms();
    this.particles.shake(0.3);
  }

  public destroy(): void {
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
  }

  private generateMapPlatforms(): void {
    this.platforms = [];

    // Base ground platform (Ground Level 0m)
    this.platforms.push({
      x: 0,
      y: this.groundY,
      w: this.worldWidth,
      h: 80,
      shape: 'rectangle',
      type: 'standard'
    });

    // Summit platform (Goal Peak ~320m)
    this.platforms.push({
      x: this.worldWidth / 2 - 120,
      y: this.summitY,
      w: 240,
      h: 30,
      shape: 'rectangle',
      type: 'bouncy'
    });

    // Procedural Vertical Ascent Platforms with diverse geometric shapes
    const stepY = 105;
    const totalSteps = Math.floor((this.groundY - this.summitY - 170) / stepY);

    let lastX = this.worldWidth / 2;

    for (let i = 0; i < totalSteps; i++) {
      const y = this.groundY - 90 - i * stepY;
      const progress = i / totalSteps;

      // Select diverse shape
      const shapeRoll = Math.random();
      let shape: PlatformShape = 'rectangle';
      if (this.mapTheme === 'cyber') {
        if (shapeRoll < 0.28) shape = 'hexagon';
        else if (shapeRoll < 0.52) shape = 'diamond';
        else if (shapeRoll < 0.74) shape = 'circle';
        else shape = 'rectangle';
      } else if (this.mapTheme === 'sky') {
        if (shapeRoll < 0.30) shape = 'cloud';
        else if (shapeRoll < 0.55) shape = 'circle';
        else if (shapeRoll < 0.76) shape = 'diamond';
        else shape = 'rectangle';
      } else {
        if (shapeRoll < 0.30) shape = 'triangle';
        else if (shapeRoll < 0.55) shape = 'hexagon';
        else if (shapeRoll < 0.76) shape = 'circle';
        else shape = 'rectangle';
      }

      // Proportional dimensions for each shape
      let w = 85;
      let h = 20;

      if (shape === 'circle') {
        w = Math.round(56 + Math.random() * 24);
        h = w;
      } else if (shape === 'hexagon') {
        w = Math.round(75 + Math.random() * 25);
        h = Math.round(w * 0.65);
      } else if (shape === 'diamond') {
        w = Math.round(65 + Math.random() * 25);
        h = Math.round(w * 0.75);
      } else if (shape === 'cloud') {
        w = Math.round(90 + Math.random() * 30);
        h = 24;
      } else if (shape === 'triangle') {
        w = Math.round(72 + Math.random() * 24);
        h = 32;
      } else {
        const minW = this.mapTheme === 'magma' ? 65 : 75;
        const maxW = this.mapTheme === 'cyber' ? 130 : 115;
        w = Math.max(minW, maxW - progress * 35 + (Math.random() - 0.5) * 20);
        h = 20;
      }

      // Horizontal offset
      const maxOffset = 210;
      let x = lastX + (Math.random() - 0.5) * maxOffset * 2;
      x = Math.max(45, Math.min(this.worldWidth - w - 45, x));
      lastX = x;

      // Determine platform special type based on map theme and shape
      let type: Platform['type'] = 'standard';
      const roll = Math.random();

      if (shape === 'cloud') {
        type = 'standard'; // Soft buoyant spring
      } else if (this.mapTheme === 'cyber') {
        if (roll < 0.22) type = 'bouncy';
        else if (roll < 0.44 && (shape === 'rectangle' || shape === 'hexagon')) type = 'moving';
      } else if (this.mapTheme === 'sky') {
        if (roll < 0.24) type = 'updraft';
        else if (roll < 0.44 && (shape === 'rectangle' || shape === 'circle')) type = 'moving';
      } else if (this.mapTheme === 'magma') {
        if (roll < 0.32) type = 'sinking';
        else if (roll < 0.52) type = 'bouncy';
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
        plat.vx = (Math.random() > 0.5 ? 1 : -1) * (60 + Math.random() * 40);
        plat.minX = Math.max(30, x - 100);
        plat.maxX = Math.min(this.worldWidth - w - 30, x + 100);
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

      // Handle Inputs
      const steer = this.input.getSteer(p.id);
      const isActionPressed = this.input.isPressed(p.id) || this.input.isActionPressed(p.id);

      // Horizontal movement & crisp air steering
      if (steer !== 0) {
        ps.vx = steer * 240;
        ps.facing = steer > 0 ? 1 : -1;
      } else {
        ps.vx *= Math.pow(0.92, dt * 60);
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
      ps.grounded = false;
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
            if (Math.abs(dx) <= radius + ps.radius * 0.8 && ps.y <= cy + 6) {
              const insideRad = Math.max(0, radius * radius - dx * dx);
              const topArcY = cy - Math.sqrt(insideRad);
              if (prevFeetY <= topArcY + 14 && feetY >= topArcY - 8) {
                hasLanded = true;
                landY = topArcY;
                lateralPush = (dx / radius) * 45;
              }
            }
          } else if (plat.shape === 'triangle') {
            const cx = plat.x + plat.w / 2;
            const dx = Math.abs(ps.x - cx);
            if (dx <= plat.w / 2 + 6) {
              const slopeY = plat.y + (dx / (plat.w / 2)) * plat.h;
              if (prevFeetY <= slopeY + 14 && feetY >= slopeY - 8) {
                hasLanded = true;
                landY = slopeY;
                lateralPush = Math.sign(ps.x - cx) * 35;
              }
            }
          } else if (plat.shape === 'diamond') {
            const cx = plat.x + plat.w / 2;
            const dx = Math.abs(ps.x - cx);
            if (dx <= plat.w * 0.46 && prevFeetY <= plat.y + 14 && feetY >= plat.y - 8) {
              hasLanded = true;
              landY = plat.y;
            }
          } else {
            // Rectangle, Cloud, Hexagon
            if (ps.x >= plat.x - 8 && ps.x <= plat.x + plat.w + 8) {
              if (prevFeetY <= plat.y + 14 && feetY >= plat.y - 8) {
                hasLanded = true;
                landY = plat.y;
              }
            }
          }

          if (hasLanded) {
            ps.y = landY - ps.radius;
            ps.vx += lateralPush;
            ps.grounded = true;

            // Landing impact if fell from high
            if (ps.fallDistance > 200) {
              this.particles.shake(0.35);
              this.audio.playBounce();
              this.particles.spawnExplosion(ps.x, ps.y + ps.radius, '#EF4444', 14);
            }
            ps.fallDistance = 0;
            ps.fallSoundPlayed = false;

            // AUTOMATIC JUMP BOUNCE!
            let bounceForce = 540;
            if (isActionPressed) {
              bounceForce = 670; // Spring leap boost!
              ps.springBoostActive = true;
              this.particles.spawnSparks(ps.x, ps.y + ps.radius, '#FACC15', 7);
            } else {
              ps.springBoostActive = false;
            }

            if (plat.type === 'bouncy') {
              bounceForce = Math.max(bounceForce, 740);
              this.audio.playBounce();
              this.particles.spawnExplosion(ps.x, ps.y + ps.radius, '#FACC15', 12);
            } else if (plat.shape === 'cloud') {
              bounceForce = Math.max(bounceForce, 630);
              this.particles.spawnSparks(ps.x, ps.y + ps.radius, '#38BDF8', 6);
            } else if (plat.shape === 'diamond') {
              bounceForce = Math.max(bounceForce, 590);
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

      // Base Ground Automatic Bounce
      if (ps.y >= this.groundY - ps.radius) {
        ps.y = this.groundY - ps.radius;
        const bounceForce = isActionPressed ? 670 : 540;
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
        ps.score = ps.highestAltitude;
      }

      // Reached Summit Victory Check
      if (ps.y <= this.summitY + 20 && !ps.reachedSummit) {
        ps.reachedSummit = true;
        this.summitReachedWinnerId = p.id;
        this.isFinished = true;
        this.audio.playFanfare();
        this.particles.spawnExplosion(ps.x, ps.y, '#FACC15', 40);
        this.particles.showFloatingText('🏆 SUMMIT CONQUERED!', ps.x, ps.y - 25, '#FACC15', 22);
      }
    }

    // Smooth Camera Tracking (Follows highest player)
    let highestPlayerY = this.groundY;
    for (const ps of this.playersState.values()) {
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

      // Must be above bot within reachable bounce height
      if (dy > 15 && dy < maxReachY) {
        let platCenterX = plat.x + plat.w / 2;

        // Lead moving platforms based on arrival time
        if (plat.type === 'moving' && plat.vx) {
          const timeToReach = Math.sqrt((2 * dy) / 760);
          platCenterX += plat.vx * timeToReach;
          platCenterX = Math.max(plat.minX || 30, Math.min(plat.maxX || width - 30, platCenterX));
        }

        const dx = Math.abs(ps.x - platCenterX);
        if (dx < maxReachX) {
          // Score formula: prioritize upward climbing, closer distance, and bonus platforms
          let score = dy * 1.6 - dx * 1.1;

          if (plat.type === 'bouncy') score += 60;
          if (plat.shape === 'cloud') score += 40;
          if (plat.shape === 'diamond') score += 30;
          if (plat.type === 'sinking') score -= 50;

          // Summit platform has highest priority
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

      // Activate Spring Leap Boost if target platform is high up or far across
      const dy = ps.y - bestPlat.y;
      const wantsSpringBoost = dy > (isHard ? 110 : 140) || Math.abs(dx) > 90;

      this.input.setBotInput(botId, wantsSpringBoost, steer);
    } else {
      // If no platforms directly above, steer towards center corridor
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
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '800 11px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`🚩 ${alt}m`, 35, bannerY - 4);
      ctx.restore();
    }

    // Render Summit Beacon
    this.renderSummitBeacon(ctx);

    // Render Players
    this.renderPlayers(ctx);

    ctx.restore();

    // Screen-space UI Overlays
    this.renderAltitudeGauge(ctx, width, height);
    this.renderMapSelectorPill(ctx, width, height);
    this.renderCenterHUD(ctx, width);
  }

  private renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);

    if (this.mapTheme === 'cyber') {
      bgGrad.addColorStop(0, '#0F051D');
      bgGrad.addColorStop(0.5, '#1E1B4B');
      bgGrad.addColorStop(1, '#0B0F19');
    } else if (this.mapTheme === 'sky') {
      bgGrad.addColorStop(0, '#0369A1');
      bgGrad.addColorStop(0.4, '#38BDF8');
      bgGrad.addColorStop(1, '#E0F2FE');
    } else {
      bgGrad.addColorStop(0, '#180808');
      bgGrad.addColorStop(0.5, '#450A0A');
      bgGrad.addColorStop(1, '#1C0606');
    }

    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Parallax vertical stars / dust
    ctx.save();
    for (const s of this.bgStars) {
      const screenY = (s.y - this.cameraY * 0.3) % height;
      const drawY = screenY < 0 ? screenY + height : screenY;
      ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, drawY, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderPlatforms(ctx: CanvasRenderingContext2D): void {
    for (const plat of this.platforms) {
      if (plat.sunk) continue;

      ctx.save();
      const cx = plat.x + plat.w / 2;
      const cy = plat.y + plat.h / 2;

      // Render Distinct Geometric Shapes
      if (plat.shape === 'circle') {
        const radius = plat.w / 2;
        const orbGrad = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.35, radius * 0.1, cx, cy, radius);
        if (this.mapTheme === 'cyber') {
          orbGrad.addColorStop(0, '#A5F3FC');
          orbGrad.addColorStop(0.5, '#06B6D4');
          orbGrad.addColorStop(1, '#083344');
        } else if (this.mapTheme === 'sky') {
          orbGrad.addColorStop(0, '#FDF4FF');
          orbGrad.addColorStop(0.5, '#F472B6');
          orbGrad.addColorStop(1, '#831843');
        } else {
          orbGrad.addColorStop(0, '#FEF08A');
          orbGrad.addColorStop(0.5, '#EA580C');
          orbGrad.addColorStop(1, '#431407');
        }

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = orbGrad;
        ctx.shadowColor = plat.type === 'bouncy' ? '#FACC15' : (this.mapTheme === 'cyber' ? '#06B6D4' : '#F97316');
        ctx.shadowBlur = plat.type === 'bouncy' ? 16 : 8;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Celestial orbital ring
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius * 1.25, radius * 0.4, 0.25, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (plat.shape === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(cx, plat.y);
        ctx.lineTo(plat.x + plat.w, cy);
        ctx.lineTo(cx, plat.y + plat.h);
        ctx.lineTo(plat.x, cy);
        ctx.closePath();

        const gemCol = this.mapTheme === 'cyber' ? '#818CF8' : (this.mapTheme === 'sky' ? '#C084FC' : '#FB923C');
        ctx.fillStyle = gemCol;
        ctx.shadowColor = gemCol;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Facet reflection line
        ctx.beginPath();
        ctx.moveTo(cx, plat.y);
        ctx.lineTo(cx, plat.y + plat.h);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
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
        ctx.shadowBlur = plat.type === 'bouncy' ? 14 : 6;
        ctx.fill();
        ctx.strokeStyle = plat.type === 'bouncy' ? '#FEF08A' : '#38BDF8';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (plat.shape === 'cloud') {
        const r = plat.h / 2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(plat.x, plat.y, plat.w, plat.h, r);
        else ctx.rect(plat.x, plat.y, plat.w, plat.h);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Puffy cloud arcs
        ctx.beginPath();
        ctx.arc(plat.x + plat.w * 0.35, plat.y, 11, Math.PI, Math.PI * 2);
        ctx.arc(plat.x + plat.w * 0.65, plat.y - 3, 14, Math.PI, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      } else if (plat.shape === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(cx, plat.y);
        ctx.lineTo(plat.x + plat.w, plat.y + plat.h);
        ctx.lineTo(plat.x, plat.y + plat.h);
        ctx.closePath();
        ctx.fillStyle = this.mapTheme === 'magma' ? '#7F1D1D' : '#1E293B';
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.strokeStyle = this.mapTheme === 'magma' ? '#EF4444' : '#F59E0B';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Standard Rectangle / Beam
        if (this.mapTheme === 'cyber') {
          ctx.shadowColor = plat.type === 'bouncy' ? '#FACC15' : '#38BDF8';
          ctx.shadowBlur = plat.type === 'bouncy' ? 14 : 8;
          ctx.fillStyle = plat.type === 'bouncy' ? '#F59E0B' : '#0F172A';
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          ctx.strokeStyle = plat.type === 'bouncy' ? '#FEF08A' : '#38BDF8';
          ctx.lineWidth = 2;
          ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        } else if (this.mapTheme === 'sky') {
          ctx.fillStyle = '#F8FAFC';
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          ctx.strokeStyle = '#94A3B8';
          ctx.lineWidth = 2;
          ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
          ctx.fillStyle = '#22C55E';
          ctx.fillRect(plat.x, plat.y, plat.w, 4);
        } else {
          ctx.fillStyle = plat.type === 'sinking' ? '#78350F' : '#1C1917';
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          ctx.strokeStyle = plat.type === 'sinking' ? '#EF4444' : '#F97316';
          ctx.lineWidth = 2;
          ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        }
      }

      // Overlays: Bounce text, Updraft beam, Sinking warning
      if (plat.type === 'bouncy') {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 10px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('▲ BOOST ▲', cx, plat.y + 13);
      } else if (plat.type === 'sinking') {
        ctx.fillStyle = '#FCA5A5';
        ctx.font = '900 9px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ SINKING', cx, plat.y + 13);
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

    // Glowing Summit Trophy / Crown
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
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Spring Boost Aura Ring
      if (ps.springBoostActive) {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#FACC15';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, ps.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

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

      // Tactile Climber Character
      ctx.shadowColor = p.colorDark;
      ctx.shadowBlur = 8;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, ps.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Eyes facing movement direction
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ps.facing * 4, -3, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(ps.facing * 5, -3, 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Player Name & Altitude Indicator Tag
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name} (${ps.currentAltitude}m)`, ps.x, ps.y - ps.radius - 12);
    }
  }

  private renderAltitudeGauge(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Vertical Altitude Bar on Left Screen Margin
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

    // Player Pin Markers on Altitude Gauge
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
    // Map Selector Pill at Bottom Left
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
    const hudW = 380;
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

    // Format 90s countdown timer
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
