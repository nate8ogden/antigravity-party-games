import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';

interface Planet {
  x: number;
  y: number;
  radius: number;
  mass: number;
  color: string;
}

interface Ship {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  tetheredPlanet: Planet | null;
  tetherAngle: number;
  tetherRadius: number;
  tetherDir: number; // 1 or -1
  alive: boolean;
  crystals: number;
  empCooldown: number;
  tetherDuration: number;
  tetherRotations: number;
}

interface Crystal {
  x: number;
  y: number;
  color: string;
  value: number;
}

interface BlackHole {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export class OrbitalSlingshotGame extends BaseGame {
  private planets: Planet[] = [];
  private ships: Map<PlayerId, Ship> = new Map();
  private crystals: Crystal[] = [];
  private blackHole: BlackHole | null = null;
  private crystalSpawnTimer: number = 2.0;
  private targetCrystals: number = 20;
  private botTetherCooldowns: Map<PlayerId, number> = new Map();
  private botOrbitDuration: Map<PlayerId, number> = new Map();
  private themeIndex: number = 0;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  private themes = [
    {
      name: 'Violet Nebula',
      coreColor: '#0F0E2A',
      midColor: '#050716',
      outerColor: '#020308',
      accentColor: '#38BDF8'
    },
    {
      name: 'Crimson Supernova',
      coreColor: '#2A0A18',
      midColor: '#16040D',
      outerColor: '#080105',
      accentColor: '#F43F5E'
    },
    {
      name: 'Emerald Quasar',
      coreColor: '#06281E',
      midColor: '#031510',
      outerColor: '#010806',
      accentColor: '#10B981'
    }
  ];

  public init(width: number, height: number): void {
    this.reset(width, height);
    if (typeof window !== 'undefined' && !this.keyHandler) {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.themeIndex = (this.themeIndex + 1) % this.themes.length;
          this.audio.playTap();
        } else if (e.key === '1') {
          this.themeIndex = 0;
        } else if (e.key === '2') {
          this.themeIndex = 1;
        } else if (e.key === '3') {
          this.themeIndex = 2;
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    super.destroy();
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 75;
    this.isFinished = false;
    this.crystals = [];
    this.crystalSpawnTimer = 1.5;
    this.ships.clear();
    this.botTetherCooldowns.clear();
    this.botOrbitDuration.clear();

    const cx = width / 2;
    const cy = height / 2;

    // Procedural Celestial Star System Generation
    this.generateRandomStarSystem(cx, cy, width, height);

    // Wandering black hole hazard
    this.blackHole = {
      x: cx,
      y: cy - height * 0.35,
      vx: 25,
      vy: 18,
      radius: 20
    };

    // Spawn crystals
    for (let i = 0; i < 12; i++) {
      this.spawnRandomCrystal(width, height);
    }

    // Spawn ships orbiting corner planets
    const active = this.getActivePlayers();
    const cornerPlanets = [this.planets[1], this.planets[2], this.planets[3], this.planets[4]];
    active.forEach((p, idx) => {
      const pl = cornerPlanets[p.id % cornerPlanets.length];
      const startAngle = (Math.PI / 2) * p.id;
      const dist = pl.radius + 35;
      this.ships.set(p.id, {
        id: p.id,
        x: pl.x + Math.cos(startAngle) * dist,
        y: pl.y + Math.sin(startAngle) * dist,
        vx: -Math.sin(startAngle) * 120,
        vy: Math.cos(startAngle) * 120,
        angle: startAngle + Math.PI / 2,
        tetheredPlanet: pl,
        tetherAngle: startAngle,
        tetherRadius: dist,
        tetherDir: 1,
        alive: true,
        crystals: 0,
        empCooldown: 0,
        tetherDuration: 0,
        tetherRotations: 0
      });
    });
  }

  public currentMapName: string = 'Gas Giant System';

  private generateRandomStarSystem(cx: number, cy: number, width: number, height: number): void {
    const archetypes = ['Gas Giant System', 'Binary Pulsar', 'Diamond Constellation', 'Cosmic Nebula'];
    this.currentMapName = archetypes[Math.floor(Math.random() * archetypes.length)];
    this.planets = [];

    const rx = width * 0.25;
    const ry = height * 0.22;

    switch (this.currentMapName) {
      case 'Gas Giant System':
        this.planets = [
          { x: cx, y: cy, radius: 44, mass: 650, color: '#38BDF8' }, // Center gas giant
          { x: cx - rx, y: cy - ry, radius: 28, mass: 350, color: '#F472B6' },
          { x: cx + rx, y: cy - ry, radius: 28, mass: 350, color: '#A78BFA' },
          { x: cx - rx, y: cy + ry, radius: 28, mass: 350, color: '#34D399' },
          { x: cx + rx, y: cy + ry, radius: 28, mass: 350, color: '#FBBF24' }
        ];
        break;

      case 'Binary Pulsar':
        // Two core stars in center + 4 perimeter satellite stations
        this.planets = [
          { x: cx - 65, y: cy, radius: 36, mass: 500, color: '#F59E0B' },
          { x: cx - rx * 1.1, y: cy - ry * 0.9, radius: 26, mass: 340, color: '#EC4899' },
          { x: cx + rx * 1.1, y: cy - ry * 0.9, radius: 26, mass: 340, color: '#06B6D4' },
          { x: cx - rx * 1.1, y: cy + ry * 0.9, radius: 26, mass: 340, color: '#10B981' },
          { x: cx + rx * 1.1, y: cy + ry * 0.9, radius: 26, mass: 340, color: '#A855F7' },
          { x: cx + 65, y: cy, radius: 36, mass: 500, color: '#38BDF8' }
        ];
        break;

      case 'Diamond Constellation':
        // Diamond 4 outer anchors + center anchor
        this.planets = [
          { x: cx, y: cy, radius: 32, mass: 450, color: '#EAB308' },
          { x: cx - rx * 1.1, y: cy - ry, radius: 27, mass: 340, color: '#EC4899' },
          { x: cx + rx * 1.1, y: cy - ry, radius: 27, mass: 340, color: '#38BDF8' },
          { x: cx - rx * 1.1, y: cy + ry, radius: 27, mass: 340, color: '#10B981' },
          { x: cx + rx * 1.1, y: cy + ry, radius: 27, mass: 340, color: '#F97316' }
        ];
        break;

      case 'Cosmic Nebula':
      default:
        // Varied radii and masses with guaranteed safe quadrant anchors
        this.planets = [
          { x: cx, y: cy, radius: 38 + Math.random() * 8, mass: 550, color: '#6366F1' },
          { x: cx - rx * (0.9 + Math.random() * 0.2), y: cy - ry * (0.9 + Math.random() * 0.2), radius: 26, mass: 350, color: '#F472B6' },
          { x: cx + rx * (0.9 + Math.random() * 0.2), y: cy - ry * (0.9 + Math.random() * 0.2), radius: 26, mass: 350, color: '#38BDF8' },
          { x: cx - rx * (0.9 + Math.random() * 0.2), y: cy + ry * (0.9 + Math.random() * 0.2), radius: 26, mass: 350, color: '#10B981' },
          { x: cx + rx * (0.9 + Math.random() * 0.2), y: cy + ry * (0.9 + Math.random() * 0.2), radius: 26, mass: 350, color: '#FBBF24' }
        ];
        break;
    }
  }

  private spawnRandomCrystal(width: number, height: number) {
    const margin = 60;
    this.crystals.push({
      x: margin + Math.random() * (width - margin * 2),
      y: margin + Math.random() * (height - margin * 2),
      color: Math.random() > 0.3 ? '#38BDF8' : '#F59E0B',
      value: Math.random() > 0.3 ? 1 : 2
    });
  }

  private isTetherActive(pid: PlayerId): boolean {
    const p = this.players[pid];
    if (p && p.type.startsWith('bot_')) {
      const bot = this.input.getBotInput(pid);
      return bot.pressed || bot.action;
    }
    return this.input.isPlayerTetherDown(pid) || this.input.isPressed(pid) || this.input.isActionPressed(pid);
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Update wandering black hole
    if (this.blackHole) {
      this.blackHole.x += this.blackHole.vx * dt;
      this.blackHole.y += this.blackHole.vy * dt;
      if (this.blackHole.x < 50 || this.blackHole.x > width - 50) this.blackHole.vx *= -1;
      if (this.blackHole.y < 50 || this.blackHole.y > height - 50) this.blackHole.vy *= -1;
    }

    // Spawn crystals
    this.crystalSpawnTimer -= dt;
    if (this.crystalSpawnTimer <= 0 && this.crystals.length < 20) {
      this.crystalSpawnTimer = 2.0;
      this.spawnRandomCrystal(width, height);
    }

    // Update Ships
    for (const ship of this.ships.values()) {
      if (!ship.alive) continue;

      if (ship.empCooldown > 0) ship.empCooldown -= dt;

      // Only the dedicated player tether key (W for P1, Up Arrow for P2) works!
      const isPressed = this.isTetherActive(ship.id);

      if (isPressed && ship.empCooldown <= 0) {
        // Find nearest planet if not tethered
        if (!ship.tetheredPlanet) {
          let closest: Planet | null = null;
          let minD = Infinity;
          for (const pl of this.planets) {
            const d = Math.hypot(ship.x - pl.x, ship.y - pl.y);
            if (d < 180 && d < minD) {
              minD = d;
              closest = pl;
            }
          }
          if (closest) {
            ship.tetheredPlanet = closest;
            ship.tetherRadius = Math.max(closest.radius + 22, minD);
            ship.tetherAngle = Math.atan2(ship.y - closest.y, ship.x - closest.x);
            ship.tetherRotations = 0;
            ship.tetherDuration = 0;

            // Determine orbit direction based on current velocity tangent
            const tangentX = -Math.sin(ship.tetherAngle);
            const tangentY = Math.cos(ship.tetherAngle);
            const dot = ship.vx * tangentX + ship.vy * tangentY;
            ship.tetherDir = dot >= 0 ? 1 : -1;
            this.audio.playTap();
          }
        }

        // Orbit around tethered planet
        if (ship.tetheredPlanet) {
          const pl = ship.tetheredPlanet;
          const orbitalSpeed = (220 / ship.tetherRadius) * ship.tetherDir;
          const angleDelta = orbitalSpeed * dt;
          ship.tetherAngle += angleDelta;
          ship.tetherDuration += dt;
          ship.tetherRotations += Math.abs(angleDelta) / (Math.PI * 2);
          ship.x = pl.x + Math.cos(ship.tetherAngle) * ship.tetherRadius;
          ship.y = pl.y + Math.sin(ship.tetherAngle) * ship.tetherRadius;

          // Tangential release velocity
          const tangX = -Math.sin(ship.tetherAngle) * ship.tetherDir;
          const tangY = Math.cos(ship.tetherAngle) * ship.tetherDir;
          const speedMag = 250;
          ship.vx = tangX * speedMag;
          ship.vy = tangY * speedMag;
          ship.angle = Math.atan2(ship.vy, ship.vx);

          // Anti-Loop Gravity Slingshot: if orbiting > 2.8 times, snap tether with high-velocity breakout launch!
          if (ship.tetherRotations >= 2.8) {
            ship.tetheredPlanet = null;
            ship.empCooldown = 0.6;
            const breakoutSpeed = 380;
            ship.vx = tangX * breakoutSpeed;
            ship.vy = tangY * breakoutSpeed;
            ship.tetherRotations = 0;
            ship.tetherDuration = 0;
            this.audio.playBoost();
            this.particles.spawnGoBlast(ship.x, ship.y);
            this.particles.showFloatingText('🚀 GRAVITY SLINGSHOT BREAKOUT!', ship.x, ship.y - 25, '#38BDF8', 18);
          } else if (ship.tetherRotations >= 1.8) {
            // Cable tension sparks warning
            if (Math.random() < 0.6) {
              this.particles.spawnSparks(ship.x, ship.y, '#EF4444', 3);
            }
          } else if (Math.random() < 0.3) {
            this.particles.spawnSparks(ship.x, ship.y, '#38BDF8', 2);
          }
        }
      } else {
        // Tether released - slingshot fling!
        if (ship.tetheredPlanet) {
          ship.tetheredPlanet = null;
          ship.tetherRotations = 0;
          ship.tetherDuration = 0;
          this.audio.playBoost();
        }
      }

      // If NOT currently tethered to a planet, ship glides purely on space inertia (NO steering, NO engine throttle without a planet)
      if (!ship.tetheredPlanet) {
        // Maintain minimum cruising speed so ships never stall motionless in zero-g space
        const currentSpeed = Math.hypot(ship.vx, ship.vy);
        if (currentSpeed < 180 && currentSpeed > 0.01) {
          const factor = 180 / currentSpeed;
          ship.vx *= factor;
          ship.vy *= factor;
        }

        ship.x += ship.vx * dt;
        ship.y += ship.vy * dt;
        if (Math.hypot(ship.vx, ship.vy) > 10) {
          ship.angle = Math.atan2(ship.vy, ship.vx);
        }

        // Screen boundary wrap
        if (ship.x < 0) ship.x = width;
        else if (ship.x > width) ship.x = 0;
        if (ship.y < 0) ship.y = height;
        else if (ship.y > height) ship.y = 0;
      }

      // Check black hole collision
      if (this.blackHole && Math.hypot(ship.x - this.blackHole.x, ship.y - this.blackHole.y) < this.blackHole.radius + 14) {
        ship.alive = false;
        this.audio.playExplosion();
        this.particles.spawnExplosion(ship.x, ship.y, '#6D28D9', 30);
        this.particles.showFloatingText('CRUSHED IN SINGULARITY!', ship.x, ship.y, '#A78BFA', 22);
      }

      // Check planet surface crash (if too close)
      for (const pl of this.planets) {
        if (Math.hypot(ship.x - pl.x, ship.y - pl.y) < pl.radius + 8) {
          // Bounce off planet preserving dynamic rebound speed
          const normAngle = Math.atan2(ship.y - pl.y, ship.x - pl.x);
          const reboundSpeed = Math.max(220, Math.hypot(ship.vx, ship.vy) * 0.92);
          ship.vx = Math.cos(normAngle) * reboundSpeed;
          ship.vy = Math.sin(normAngle) * reboundSpeed;
          ship.tetheredPlanet = null;
          this.audio.playBounce();
          this.particles.spawnSparks(ship.x, ship.y, '#FBBF24', 8);
        }
      }

      // Collect crystals
      for (let i = this.crystals.length - 1; i >= 0; i--) {
        const cr = this.crystals[i];
        if (Math.hypot(ship.x - cr.x, ship.y - cr.y) < 22) {
          ship.crystals += cr.value;
          this.audio.playScore();
          this.particles.showFloatingText(`+${cr.value}`, cr.x, cr.y - 15, cr.color);
          this.particles.spawnSparks(cr.x, cr.y, cr.color, 12);
          this.crystals.splice(i, 1);

          if (ship.crystals >= this.targetCrystals) {
            this.isFinished = true;
          }
        }
      }
    }

    // Check round over
    const aliveCount = Array.from(this.ships.values()).filter((s) => s.alive).length;
    if (aliveCount <= 1 || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ship = this.ships.get(botId);
    if (!ship || !ship.alive) return;

    // Find highest value nearest crystal
    let targetCrystal: Crystal | null = null;
    let bestScore = -Infinity;
    for (const cr of this.crystals) {
      const d = Math.hypot(cr.x - ship.x, cr.y - ship.y);
      const score = (cr.value * 200) - d;
      if (score > bestScore) {
        bestScore = score;
        targetCrystal = cr;
      }
    }

    if (!targetCrystal) return;

    // Check black hole danger along projected vector
    const checkBlackHoleSafety = (vx: number, vy: number): boolean => {
      if (!this.blackHole || difficulty === 'bot_easy') return true;
      const spd = Math.hypot(vx, vy) || 1;
      const dirX = vx / spd;
      const dirY = vy / spd;
      for (let dist = 30; dist < 220; dist += 30) {
        const px = ship.x + dirX * dist;
        const py = ship.y + dirY * dist;
        if (Math.hypot(px - this.blackHole.x, py - this.blackHole.y) < 65) {
          return false; // Dangerous slingshot path into singularity!
        }
      }
      return true;
    };

    // Decrement bot re-tether cooldown
    let cd = this.botTetherCooldowns.get(botId) || 0;
    if (cd > 0) {
      cd -= dt;
      this.botTetherCooldowns.set(botId, Math.max(0, cd));
    }

    if (ship.tetheredPlanet) {
      // Track orbit duration to prevent infinite spinning
      let orbitDur = (this.botOrbitDuration.get(botId) || 0) + dt;
      this.botOrbitDuration.set(botId, orbitDur);

      // Slingshot release calculation
      const toCrystalX = targetCrystal.x - ship.x;
      const toCrystalY = targetCrystal.y - ship.y;
      const dot = ship.vx * toCrystalX + ship.vy * toCrystalY;
      const magV = Math.hypot(ship.vx, ship.vy);
      const magC = Math.hypot(toCrystalX, toCrystalY);
      const cosAngle = dot / (magV * magC + 0.001);

      const requiredAlignment = difficulty === 'bot_hard' ? 0.82 : difficulty === 'bot_normal' ? 0.60 : 0.45;
      const isPathSafe = checkBlackHoleSafety(ship.vx, ship.vy);

      // Release tether if well aligned, or force release if orbiting too long
      const shouldRelease = (cosAngle > requiredAlignment && isPathSafe) || (orbitDur > 1.2 && cosAngle > 0.25) || orbitDur > 1.8;

      if (shouldRelease) {
        // Release tether to fling towards crystal!
        this.botTetherCooldowns.set(botId, 1.0); // Cooldown prevents instant re-grabbing the same planet
        this.botOrbitDuration.set(botId, 0);
        this.input.setBotInput(botId, false, 0, 0, false);
      } else {
        // Hold tether to continue rotating
        this.input.setBotInput(botId, true, 0, 0, false);
      }
    } else {
      this.botOrbitDuration.set(botId, 0);

      // Free flight: evaluate if passing near a planet to tether for slingshot redirection
      let shouldTether = false;
      if (cd <= 0) {
        for (const pl of this.planets) {
          const d = Math.hypot(ship.x - pl.x, ship.y - pl.y);
          if (d < 160) {
            const angleToPlanet = Math.atan2(pl.y - ship.y, pl.x - ship.x);
            const angleToTarget = Math.atan2(targetCrystal.y - ship.y, targetCrystal.x - ship.x);
            // If planet is positioned between ship and target or provides good slingshot arc
            if (Math.abs(angleToPlanet - angleToTarget) > 0.35) {
              shouldTether = true;
              break;
            }
          }
        }
      }

      this.input.setBotInput(botId, shouldTether, 0, 0, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const curTheme = this.themes[this.themeIndex] || this.themes[0];
    ctx.save();

    // 1. Deep Space Nebula & Cosmic Dust
    const spaceGrad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, Math.max(width, height) * 0.75);
    spaceGrad.addColorStop(0, curTheme.coreColor);
    spaceGrad.addColorStop(0.5, curTheme.midColor);
    spaceGrad.addColorStop(1, curTheme.outerColor);
    ctx.fillStyle = spaceGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle twinkling stars
    const now = performance.now();
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 137.5) % width);
      const sy = ((i * 223.1) % height);
      const twinkle = (Math.sin(now * 0.003 + i) + 1) * 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + twinkle * 0.6})`;
      ctx.beginPath();
      ctx.arc(sx, sy, (i % 3 === 0) ? 1.5 : 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Planets with 3D Spherical Shading & Atmospheric Rim Glow
    for (const pl of this.planets) {
      ctx.save();

      // Atmospheric outer glow
      const atmoGrad = ctx.createRadialGradient(pl.x, pl.y, pl.radius * 0.8, pl.x, pl.y, pl.radius * 1.5);
      atmoGrad.addColorStop(0, pl.color);
      atmoGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = atmoGrad;
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, pl.radius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Planet sphere body with directional lighting (light from top-left)
      const sphereGrad = ctx.createRadialGradient(
        pl.x - pl.radius * 0.35, pl.y - pl.radius * 0.35, pl.radius * 0.1,
        pl.x, pl.y, pl.radius
      );
      sphereGrad.addColorStop(0, '#FFFFFF');
      sphereGrad.addColorStop(0.25, pl.color);
      sphereGrad.addColorStop(0.85, '#0B0F19');
      sphereGrad.addColorStop(1, '#020617');
      ctx.fillStyle = sphereGrad;
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, pl.radius, 0, Math.PI * 2);
      ctx.fill();

      // Surface crater details on moon-like planets
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.arc(pl.x - pl.radius * 0.2, pl.y + pl.radius * 0.1, pl.radius * 0.22, 0, Math.PI * 2);
      ctx.arc(pl.x + pl.radius * 0.25, pl.y - pl.radius * 0.15, pl.radius * 0.18, 0, Math.PI * 2);
      ctx.fill();

      // Thin orbital gravity ring indicator
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, pl.radius + 16, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    // 3. Wandering Black Hole (Accretion Disk & Gravitational Singularity)
    if (this.blackHole) {
      ctx.save();
      const bh = this.blackHole;
      const swirl = (now * 0.004) % (Math.PI * 2);

      // Swirling Accretion Disk (Luminous relativistic matter ring)
      ctx.save();
      ctx.translate(bh.x, bh.y);
      ctx.rotate(swirl);
      const diskGrad = ctx.createLinearGradient(-bh.radius * 1.8, 0, bh.radius * 1.8, 0);
      diskGrad.addColorStop(0, 'rgba(236, 72, 153, 0)');
      diskGrad.addColorStop(0.3, '#EC4899');
      diskGrad.addColorStop(0.5, '#F59E0B');
      diskGrad.addColorStop(0.7, '#8B5CF6');
      diskGrad.addColorStop(1, 'rgba(139, 92, 246, 0)');
      ctx.strokeStyle = diskGrad;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(0, 0, bh.radius * 1.8, bh.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Gravitational photon ring
      ctx.strokeStyle = '#C084FC';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, bh.radius + 2, 0, Math.PI * 2);
      ctx.stroke();

      // Event Horizon Void (Pure absolute black)
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, bh.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Faceted Floating Space Crystals (Sparkling Diamond Gemstones)
    for (const cr of this.crystals) {
      ctx.save();
      ctx.translate(cr.x, cr.y);
      const rot = now * 0.0025;
      ctx.rotate(rot);

      // Gemstone glow
      ctx.shadowColor = cr.color;
      ctx.shadowBlur = 14;

      // Faceted Diamond Rhombus
      ctx.fillStyle = cr.color;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(8, 0);
      ctx.lineTo(0, 9);
      ctx.lineTo(-8, 0);
      ctx.closePath();
      ctx.fill();

      // Internal facet bevel highlights
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(4, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-4, 0);
      ctx.lineTo(0, 9);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // 5. Interceptor Starships and Gravity Tether Beams
    for (const ship of this.ships.values()) {
      if (!ship.alive) continue;
      const p = this.players[ship.id];

      // Radiant Gravity Tether Plasma Beam
      if (ship.tetheredPlanet) {
        ctx.save();
        const isHighTension = ship.tetherRotations >= 1.8;
        const beamColor = isHighTension
          ? (Math.sin(performance.now() * 0.03) > 0 ? '#EF4444' : '#FBBF24')
          : p.color;

        ctx.shadowColor = beamColor;
        ctx.shadowBlur = isHighTension ? 16 : 12;
        ctx.strokeStyle = beamColor;
        ctx.lineWidth = isHighTension ? 4.5 : 3;

        // Add subtle tension shudder if cable is about to snap into slingshot
        const tensionJitterX = isHighTension ? (Math.random() - 0.5) * 3 : 0;
        const tensionJitterY = isHighTension ? (Math.random() - 0.5) * 3 : 0;

        ctx.beginPath();
        ctx.moveTo(ship.tetheredPlanet.x, ship.tetheredPlanet.y);
        ctx.lineTo(ship.x + tensionJitterX, ship.y + tensionJitterY);
        ctx.stroke();

        // White core plasma line
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.angle);

      // Plasma Thruster Flame
      ctx.fillStyle = '#38BDF8';
      ctx.shadowColor = '#06B6D4';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(-6, -4);
      ctx.lineTo(-16 - Math.random() * 6, 0);
      ctx.lineTo(-6, 4);
      ctx.closePath();
      ctx.fill();

      // Sleek Sci-Fi Interceptor Chassis
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();

      // Cockpit Canopy Glass
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.ellipse(2, 0, 5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#67E8F9';
      ctx.beginPath();
      ctx.ellipse(3, 0, 3, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Frosted Crystal Score Pill
      ctx.save();
      const pillY = ship.y - 24;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.roundRect(ship.x - 30, pillY - 10, 60, 20, 10);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`💎 ${ship.crystals}`, ship.x, pillY);
      ctx.restore();
    }

    // Theme Pill at Bottom-Left (x: 20, y: height - 44)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, height - 44, 380, 30, 15);
    else ctx.fillRect(20, height - 44, 380, 30);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = curTheme.accentColor;
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `🪐 [T] [${this.themeIndex + 1}/3] ${curTheme.name} • ${this.currentMapName}`,
      34,
      height - 29
    );
    ctx.restore();

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const list = Array.from(this.ships.values()).sort((a, b) => b.crystals - a.crystals);
    const winnerId = list.length > 0 ? list[0].id : null;
    return {
      winnerId,
      rankings: list.map((s, idx) => ({ playerId: s.id, score: s.crystals, place: idx + 1 })),
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} mined ${list[0].crystals} space crystals!` : 'Lost in space!'
    };
  }
}
