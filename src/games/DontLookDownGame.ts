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
  chargeJump: number; // 0..1
  isCharging: boolean;
  highestAltitude: number; // in meters
  currentAltitude: number;
  fallDistance: number;
  fallSoundPlayed: boolean;
  animTimer: number;
  score: number;
  reachedSummit: boolean;
}

interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
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
    // 5:00 minutes time limit (300 seconds)
    this.roundTimer = 300.0;
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
        chargeJump: 0,
        isCharging: false,
        highestAltitude: 0,
        currentAltitude: 0,
        fallDistance: 0,
        fallSoundPlayed: false,
        animTimer: 0,
        score: 0,
        reachedSummit: false
      });
    });

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
      type: 'standard'
    });

    // Summit platform (Goal Peak ~320m)
    this.platforms.push({
      x: this.worldWidth / 2 - 120,
      y: this.summitY,
      w: 240,
      h: 30,
      type: 'bouncy'
    });

    // Procedural Vertical Ascent Platforms
    // From y = groundY - 100 down to summitY + 80
    const stepY = 110;
    const totalSteps = Math.floor((this.groundY - this.summitY - 180) / stepY);

    let lastX = this.worldWidth / 2;

    for (let i = 0; i < totalSteps; i++) {
      const y = this.groundY - 90 - i * stepY;
      const progress = i / totalSteps;

      // Platform width narrows as you climb higher!
      const minW = this.mapTheme === 'magma' ? 65 : 75;
      const maxW = this.mapTheme === 'cyber' ? 140 : 120;
      const w = Math.max(minW, maxW - progress * 40 + (Math.random() - 0.5) * 20);

      // Horizontal offset
      const maxOffset = 220;
      let x = lastX + (Math.random() - 0.5) * maxOffset * 2;
      x = Math.max(50, Math.min(this.worldWidth - w - 50, x));
      lastX = x;

      // Determine platform special type based on map theme
      let type: Platform['type'] = 'standard';
      const roll = Math.random();

      if (this.mapTheme === 'cyber') {
        if (roll < 0.22) type = 'bouncy'; // Neon Jump Pad
        else if (roll < 0.44) type = 'moving'; // Moving Laser Beam
      } else if (this.mapTheme === 'sky') {
        if (roll < 0.25) type = 'updraft'; // Wind updraft
        else if (roll < 0.45) type = 'moving';
      } else if (this.mapTheme === 'magma') {
        if (roll < 0.35) type = 'sinking'; // Basalt sinking stone
        else if (roll < 0.55) type = 'bouncy'; // Magma vent
      }

      const plat: Platform = {
        x,
        y,
        w,
        h: 20,
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
      const isPressed = this.input.isPressed(p.id);

      // Horizontal movement
      if (steer !== 0) {
        ps.vx = steer * 220;
        ps.facing = steer > 0 ? 1 : -1;
      } else if (ps.grounded) {
        ps.vx *= Math.pow(0.82, dt * 60);
      } else {
        ps.vx *= Math.pow(0.94, dt * 60);
      }

      // Jump charging & leaping
      if (ps.grounded) {
        if (isPressed) {
          ps.isCharging = true;
          ps.chargeJump = Math.min(1.0, ps.chargeJump + dt * 2.8);
          // Charging particles
          if (Math.random() < 0.4) {
            this.particles.spawnSparks(ps.x, ps.y + ps.radius, p.colorLight, 1);
          }
        } else if (ps.isCharging) {
          // Launch leap!
          ps.isCharging = false;
          const jumpPower = 380 + ps.chargeJump * 240;
          ps.vy = -jumpPower;
          // In 1-button mode without steer keys, launch with forward horizontal momentum!
          if (steer === 0) {
            ps.vx = ps.facing * (130 + ps.chargeJump * 140);
          }
          ps.grounded = false;
          ps.chargeJump = 0;
          this.audio.playTone(340 + ps.chargeJump * 280, 0.09, 'triangle');
          this.particles.spawnSparks(ps.x, ps.y + ps.radius, '#FFFFFF', 6);
        }
      } else {
        ps.isCharging = false;
        ps.chargeJump = 0;
      }

      // In-Air Gravity & Physics
      if (!ps.grounded) {
        const gravity = 760;
        ps.vy = Math.min(650, ps.vy + gravity * dt);

        // Fall tracking for "Don't Look Down" drama
        if (ps.vy > 120) {
          ps.fallDistance += ps.vy * dt;
          if (ps.fallDistance > 220 && !ps.fallSoundPlayed) {
            ps.fallSoundPlayed = true;
            this.audio.playTone(480, 0.25, 'sawtooth');
            this.particles.shake(0.12);
          }
        }
      } else {
        ps.fallDistance = 0;
        ps.fallSoundPlayed = false;
      }

      // Position integration
      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Horizontal boundaries
      if (ps.x < ps.radius + 15) {
        ps.x = ps.radius + 15;
        ps.vx = 0;
        ps.facing = 1;
      } else if (ps.x > this.worldWidth - ps.radius - 15) {
        ps.x = this.worldWidth - ps.radius - 15;
        ps.vx = 0;
        ps.facing = -1;
      }

      // Platform Collision Detection
      ps.grounded = false;
      const feetY = ps.y + ps.radius;
      const prevFeetY = feetY - ps.vy * dt;

      for (const plat of this.platforms) {
        if (plat.sunk) continue;

        // Updraft Wind Zone
        if (plat.type === 'updraft') {
          if (ps.x >= plat.x && ps.x <= plat.x + plat.w && ps.y >= plat.y - 120 && ps.y <= plat.y) {
            ps.vy -= 850 * dt; // Updraft lift!
            if (Math.random() < 0.3) {
              this.particles.spawnSparks(ps.x, ps.y, '#38BDF8', 1);
            }
          }
        }

        // Standing / Landing on top of platform
        if (ps.vy >= 0 && ps.x >= plat.x - 4 && ps.x <= plat.x + plat.w + 4) {
          if (prevFeetY <= plat.y + 8 && feetY >= plat.y - 4) {
            ps.y = plat.y - ps.radius;
            ps.vy = 0;
            ps.grounded = true;

            // Big landing impact if fell from high
            if (ps.fallDistance > 200) {
              this.particles.shake(0.35);
              this.audio.playBounce();
              this.particles.spawnExplosion(ps.x, ps.y + ps.radius, '#EF4444', 14);
            }

            // Bounce pad launch
            if (plat.type === 'bouncy') {
              ps.vy = -680;
              ps.grounded = false;
              this.audio.playBounce();
              this.particles.spawnSparks(ps.x, ps.y + ps.radius, '#FACC15', 10);
            }

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

    // Find candidate platforms above current position
    let targetPlat: Platform | null = null;
    let minDy = Infinity;

    for (const plat of this.platforms) {
      if (plat.sunk) continue;
      const dy = ps.y - plat.y;
      // Must be above and within realistic jump reach
      if (dy > 20 && dy < (isHard ? 220 : 160)) {
        const dx = Math.abs(ps.x - (plat.x + plat.w / 2));
        if (dx < (isHard ? 260 : 190)) {
          if (dy < minDy) {
            minDy = dy;
            targetPlat = plat;
          }
        }
      }
    }

    if (targetPlat) {
      const targetCenterX = targetPlat.x + targetPlat.w / 2;
      const dx = targetCenterX - ps.x;

      if (ps.grounded) {
        // Run towards align point then charge jump
        if (Math.abs(dx) > 25) {
          const steer = dx > 0 ? 1 : -1;
          this.input.setBotInput(botId, false, steer);
        } else {
          // Charge jump based on height difference
          const neededCharge = Math.min(1.0, minDy / 160);
          if (ps.chargeJump < neededCharge) {
            this.input.setBotInput(botId, true, 0); // Hold to charge
          } else {
            this.input.setBotInput(botId, false, 0); // Release to leap!
          }
        }
      } else {
        // Air control toward platform center
        const steer = Math.abs(dx) > 10 ? (dx > 0 ? 1 : -1) : 0;
        this.input.setBotInput(botId, false, steer);
      }
    } else if (ps.grounded) {
      // Wander or seek nearest bounce pad
      if (Math.random() < (isEasy ? 0.04 : 0.08)) {
        this.input.setBotInput(botId, true, (Math.random() - 0.5) > 0 ? 1 : -1);
      } else {
        this.input.setBotInput(botId, false, 0);
      }
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
      if (this.mapTheme === 'cyber') {
        // Holographic Cyber Ledge
        ctx.shadowColor = plat.type === 'bouncy' ? '#FACC15' : '#38BDF8';
        ctx.shadowBlur = plat.type === 'bouncy' ? 14 : 8;
        ctx.fillStyle = plat.type === 'bouncy' ? '#F59E0B' : '#0F172A';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

        ctx.strokeStyle = plat.type === 'bouncy' ? '#FEF08A' : '#38BDF8';
        ctx.lineWidth = 2;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

        if (plat.type === 'bouncy') {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '900 10px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('▲ BOOST ▲', plat.x + plat.w / 2, plat.y + 13);
        }
      } else if (this.mapTheme === 'sky') {
        // Floating Ancient Marble Ledge
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 2;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

        // Moss trim
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(plat.x, plat.y, plat.w, 4);

        if (plat.type === 'updraft') {
          // Wind updraft visual
          ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
          ctx.fillRect(plat.x, plat.y - 100, plat.w, 100);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(plat.x, plat.y - 100, plat.w, 100);
          ctx.setLineDash([]);
        }
      } else {
        // Volcanic Basalt Ledge
        ctx.fillStyle = plat.type === 'sinking' ? '#78350F' : '#1C1917';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        ctx.strokeStyle = plat.type === 'sinking' ? '#EF4444' : '#F97316';
        ctx.lineWidth = 2;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

        if (plat.type === 'sinking') {
          ctx.fillStyle = '#FCA5A5';
          ctx.font = '900 9px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('⚠️ SINKING', plat.x + plat.w / 2, plat.y + 13);
        }
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

      // Charge Jump Gauge Ring
      if (ps.isCharging && ps.chargeJump > 0) {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, ps.radius + 6, -Math.PI / 2, -Math.PI / 2 + ps.chargeJump * Math.PI * 2);
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
    const hudW = 340;
    const hudH = 26;
    const hudX = width / 2 - hudW / 2;
    const hudY = 56;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(hudX, hudY, hudW, hudH, 13);
    else ctx.rect(hudX, hudY, hudW, hudH);
    ctx.fill();
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Format 5:00 countdown timer as mm:ss
    const mins = Math.floor(this.roundTimer / 60);
    const secs = Math.floor(this.roundTimer % 60);
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const altSummary = active
      .map((p) => {
        const ps = this.playersState.get(p.id);
        return `${p.name}: ${ps?.currentAltitude || 0}m`;
      })
      .join('  •  ');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`⏱️ ${timeStr}   |   ${altSummary}`, width / 2, hudY + 13);
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
    }

    const sorted = [...active].sort((a, b) => {
      const pA = this.playersState.get(a.id)?.highestAltitude || 0;
      const pB = this.playersState.get(b.id)?.highestAltitude || 0;
      return pB - pA;
    });

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      place: idx + 1,
      score: this.playersState.get(p.id)?.highestAltitude || 0
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight:
        winnerId !== null
          ? `${this.getPlayer(winnerId)?.name ?? 'Winner'} conquered the summit (${this.playersState.get(winnerId)?.highestAltitude || 0}m)!`
          : 'The 5-minute climb ended in a stalemate!'
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }
}
