import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';
import { AchievementManager } from '../core/AchievementManager';

type PlatformType = 'steel' | 'spring' | 'moving' | 'crumbling';

interface SumoPlatform {
  x: number;
  y: number;
  w: number;
  h: number;
  type: PlatformType;
  springy: boolean;
  vx: number;
  minX: number;
  maxX: number;
  crumbleTimer: number;    // > 0 when cracking
  collapsedTimer: number;  // > 0 when broken/intangible
}

interface HazardDrone {
  x: number;
  y: number;
  vx: number;
  minX: number;
  maxX: number;
  radius: number;
  pulsePhase: number;
}

interface SumoClimber {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  isGrounded: boolean;
  standingPlat: SumoPlatform | null;
  isCharging: boolean;
  chargePower: number;
  aimAngle: number;
  aimOscillation: number;
  stunTimer: number;
  wallBounceCooldown: number;
  highestY: number;
  score: number;
  alive: boolean;
  fallDuration: number;
}

export class SkylineSumoGame extends BaseGame {
  private climbers: Map<PlayerId, SumoClimber> = new Map();
  private platforms: SumoPlatform[] = [];
  private drones: HazardDrone[] = [];
  private worldWidth: number = 1600;
  private cameraX: number = 0;
  private cameraY: number = 0;
  private cameraZoom: number = 1.0;
  private goalHeight: number = -3000; // ~360m rooftop trophy

  // High-Altitude Crosswind System
  private windForce: number = 0;
  private targetWindForce: number = 0;
  private windChangeTimer: number = 4.0;

  // Just For Fun / Target Altitude Speedrun Mode
  public isNoTimeLimit: boolean = false;
  public targetMeters: number = 350;
  public elapsedTime: number = 0;

  // Lakitu Cloud Rescuer Mechanism (only catches deep abyss falls, drops on lower platform)
  private rescuerActive: boolean = false;
  private rescuerX: number = 0;
  private rescuerY: number = 0;
  private rescuerTargetId: PlayerId | null = null;
  private rescuerTargetPlat: SumoPlatform | null = null;
  private rescuerTargetPlatX: number = 0;
  private rescuerTargetPlatY: number = 0;
  private rescuerState: 'descending' | 'lifting' | 'leaving' = 'descending';
  private rescuerTimer: number = 0;

  public setMode(isNoLimit: boolean, targetMeters: number): void {
    this.isNoTimeLimit = isNoLimit;
    this.targetMeters = Math.max(50, Math.min(10000, targetMeters));
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    // Wide multi-lane skyscraper arena (never cramped on portrait phones or desktop!)
    this.worldWidth = Math.max(1520, Math.round(width * 1.85));
    const groundY = height - 85;

    if (this.isNoTimeLimit) {
      this.goalHeight = groundY - this.targetMeters * 10;
      this.roundTimer = Infinity;
    } else {
      this.goalHeight = groundY - 3400; // 340m vertical skyscraper climb!
      this.roundTimer = 75;
    }

    this.elapsedTime = 0;
    this.isFinished = false;
    this.climbers.clear();
    this.platforms = [];
    this.drones = [];
    this.windForce = 0;
    this.targetWindForce = 0;
    this.windChangeTimer = 3.5;

    this.cameraX = (this.worldWidth - width) / 2;
    this.cameraY = height - 360;
    this.cameraZoom = width < 600 ? 0.68 : 0.85;
    this.rescuerActive = false;
    this.rescuerTargetId = null;
    this.rescuerTargetPlat = null;

    // 1. Wide Ground Foundation Platform
    this.platforms.push({
      x: 40,
      y: height - 60,
      w: this.worldWidth - 80,
      h: 42,
      type: 'steel',
      springy: false,
      vx: 0,
      minX: 40,
      maxX: this.worldWidth - 40,
      crumbleTimer: 0,
      collapsedTimer: 0
    });

    // 2. Multi-Lane Wide Skyscraper Procedural Generation with Guaranteed Reachability
    const totalClimbPx = (height - 60) - this.goalHeight;
    let curY = height - 168;
    let tierIndex = 0;
    let prevTierPlatforms: SumoPlatform[] = [this.platforms[0]];

    while (curY > this.goalHeight + 115) {
      const progress = Math.max(0, Math.min(1, ((height - 60) - curY) / totalClimbPx));
      // Alternate between 4 and 5 horizontal lanes across the wide skyscraper
      const numLanes = tierIndex % 2 === 0 ? 4 : 5;
      const sideMargin = 65;
      const usableW = this.worldWidth - sideMargin * 2;
      const laneW = usableW / numLanes;

      const currentTierPlatforms: SumoPlatform[] = [];

      for (let lane = 0; lane < numLanes; lane++) {
        // Leave occasional gaps at higher altitudes so players must read the tower, but guarantee >= 3 girders per tier
        if (progress > 0.25 && numLanes === 5 && lane === ((tierIndex * 2 + 1) % 5) && currentTierPlatforms.length >= 2) {
          continue;
        }

        // Girders become narrower as altitude increases!
        const baseW = Math.max(82, 158 - progress * 64);
        const pw = baseW + Math.random() * 26;
        const laneLeft = sideMargin + lane * laneW + 14;
        const laneRight = Math.max(laneLeft + 8, sideMargin + (lane + 1) * laneW - pw - 14);
        let px = laneLeft + Math.random() * (laneRight - laneLeft);

        // Ensure horizontal reachability from at least one platform in the previous tier (within 290px horizontal jump range)
        const nearestPrev = prevTierPlatforms.reduce((best, p) => {
          const d = Math.abs((p.x + p.w / 2) - (px + pw / 2));
          return d < Math.abs((best.x + best.w / 2) - (px + pw / 2)) ? p : best;
        }, prevTierPlatforms[0]);

        if (nearestPrev) {
          const prevCenter = nearestPrev.x + nearestPrev.w / 2;
          const curCenter = px + pw / 2;
          if (Math.abs(curCenter - prevCenter) > 270) {
            px = Math.max(sideMargin, Math.min(this.worldWidth - sideMargin - pw, prevCenter + Math.sign(curCenter - prevCenter) * 230 - pw / 2));
          }
        }

        // Choose Platform Archetype based on altitude progress
        let pType: PlatformType = 'steel';
        let vx = 0;
        let minX = px;
        let maxX = px + pw;

        const roll = Math.random();
        const springChance = Math.max(0.08, 0.18 - progress * 0.08);
        const movingChance = progress > 0.10 ? Math.min(0.42, 0.16 + progress * 0.30) : 0;
        const crumbleChance = progress > 0.18 ? Math.min(0.32, 0.12 + progress * 0.24) : 0;

        if (roll < springChance) {
          pType = 'spring';
        } else if (roll < springChance + movingChance) {
          pType = 'moving';
          const speed = (65 + progress * 115) * (Math.random() < 0.5 ? 1 : -1);
          vx = speed;
          minX = Math.max(sideMargin, laneLeft - 18);
          maxX = Math.min(this.worldWidth - sideMargin, sideMargin + (lane + 1) * laneW + 18);
        } else if (roll < springChance + movingChance + crumbleChance) {
          pType = 'crumbling';
        }

        const staggerY = (lane % 2 === 0 ? 0 : -14) + (Math.random() - 0.5) * 10;
        const plat: SumoPlatform = {
          x: px,
          y: curY + staggerY,
          w: pw,
          h: 16,
          type: pType,
          springy: pType === 'spring',
          vx,
          minX,
          maxX,
          crumbleTimer: 0,
          collapsedTimer: 0
        };

        this.platforms.push(plat);
        currentTierPlatforms.push(plat);
      }

      // Spawn patrol shock drones on upper tiers (above 28% altitude, every 3rd tier)
      if (progress > 0.28 && tierIndex % 3 === 0) {
        const droneMinX = 120 + (tierIndex % 2) * (this.worldWidth * 0.35);
        const droneMaxX = Math.min(this.worldWidth - 120, droneMinX + this.worldWidth * 0.45);
        this.drones.push({
          x: (droneMinX + droneMaxX) / 2,
          y: curY - 54,
          vx: (110 + progress * 95) * (tierIndex % 2 === 0 ? 1 : -1),
          minX: droneMinX,
          maxX: droneMaxX,
          radius: 15,
          pulsePhase: Math.random() * Math.PI * 2
        });
      }

      if (currentTierPlatforms.length > 0) {
        prevTierPlatforms = currentTierPlatforms;
      }

      // Vertical step between tiers (104-126px: requires a well-charged jump!)
      curY -= 104 + Math.min(22, progress * 16) + Math.random() * 14;
      tierIndex++;
    }

    // 3. Top Rooftop Helipad & Approach Girders
    const roofW = 340;
    const roofX = this.worldWidth / 2 - roofW / 2;
    // Left and right approach girders just below the summit
    this.platforms.push({
      x: roofX - 210,
      y: this.goalHeight + 92,
      w: 130,
      h: 16,
      type: 'moving',
      springy: false,
      vx: 85,
      minX: Math.max(80, roofX - 310),
      maxX: roofX - 30,
      crumbleTimer: 0,
      collapsedTimer: 0
    });
    this.platforms.push({
      x: roofX + roofW + 80,
      y: this.goalHeight + 92,
      w: 130,
      h: 16,
      type: 'moving',
      springy: false,
      vx: -85,
      minX: roofX + roofW + 30,
      maxX: Math.min(this.worldWidth - 80, roofX + roofW + 310),
      crumbleTimer: 0,
      collapsedTimer: 0
    });
    // Summit Trophy Platform
    this.platforms.push({
      x: roofX,
      y: this.goalHeight,
      w: roofW,
      h: 26,
      type: 'steel',
      springy: false,
      vx: 0,
      minX: roofX,
      maxX: roofX + roofW,
      crumbleTimer: 0,
      collapsedTimer: 0
    });

    // Spawn Climbers near the center of the wide foundation so they start in view and can branch out
    const active = this.getActivePlayers();
    const spawnSpan = Math.min(480, this.worldWidth * 0.35);
    const spawnLeft = this.worldWidth / 2 - spawnSpan / 2;
    active.forEach((p, idx) => {
      const startX = active.length === 1
        ? this.worldWidth / 2
        : spawnLeft + idx * (spawnSpan / Math.max(1, active.length - 1));
      this.climbers.set(p.id, {
        id: p.id,
        x: startX,
        y: groundY,
        vx: 0,
        vy: 0,
        angle: 0,
        isGrounded: true,
        standingPlat: this.platforms[0],
        isCharging: false,
        chargePower: 0,
        aimAngle: -Math.PI / 2,
        aimOscillation: 0,
        stunTimer: 0,
        wallBounceCooldown: 0,
        highestY: groundY,
        score: 0,
        alive: true,
        fallDuration: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.elapsedTime += dt;

    if (!this.isNoTimeLimit) {
      this.roundTimer = Math.max(0, this.roundTimer - dt);
      if (this.roundTimer <= 0 && !this.isFinished) {
        this.isFinished = true;
        this.audio.playBuzzer();
      }
    }

    // 1. Update Moving Girders & Crumbling Scaffolds
    for (const plat of this.platforms) {
      if (plat.collapsedTimer > 0) {
        plat.collapsedTimer = Math.max(0, plat.collapsedTimer - dt);
        if (plat.collapsedTimer === 0) {
          plat.crumbleTimer = 0;
        }
        continue;
      }

      if (plat.type === 'moving' && plat.vx !== 0) {
        const prevX = plat.x;
        plat.x += plat.vx * dt;
        if (plat.x < plat.minX) {
          plat.x = plat.minX;
          plat.vx = Math.abs(plat.vx);
        } else if (plat.x + plat.w > plat.maxX) {
          plat.x = plat.maxX - plat.w;
          plat.vx = -Math.abs(plat.vx);
        }
        const deltaX = plat.x - prevX;
        // Carry any grounded climber standing on this moving girder
        for (const c of this.climbers.values()) {
          if (c.isGrounded && c.standingPlat === plat) {
            c.x = Math.max(30, Math.min(this.worldWidth - 30, c.x + deltaX));
          }
        }
      }

      if (plat.type === 'crumbling' && plat.crumbleTimer > 0) {
        plat.crumbleTimer += dt;
        if (plat.crumbleTimer >= 0.78) {
          // Collapse the scaffold!
          plat.collapsedTimer = 3.2;
          plat.crumbleTimer = 0;
          this.audio.playExplosion();
          this.particles.spawnSparks(plat.x + plat.w / 2, plat.y + 8, '#F97316', 14);
          for (const c of this.climbers.values()) {
            if (c.isGrounded && c.standingPlat === plat) {
              c.isGrounded = false;
              c.standingPlat = null;
              c.isCharging = false;
              c.chargePower = 0;
              c.vy = 60;
            }
          }
        }
      }
    }

    // 2. Update Patrol Shock Drones
    for (const d of this.drones) {
      d.pulsePhase += dt * 6;
      d.x += d.vx * dt;
      if (d.x < d.minX) {
        d.x = d.minX;
        d.vx = Math.abs(d.vx);
      } else if (d.x > d.maxX) {
        d.x = d.maxX;
        d.vx = -Math.abs(d.vx);
      }
    }

    // 3. Update High-Altitude Jetstream Crosswinds
    const climberArr = Array.from(this.climbers.values());
    if (climberArr.length === 0) return;

    let highestY = Infinity;
    let lowestY = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;

    for (const c of climberArr) {
      if (c.y < highestY) highestY = c.y;
      if (c.y > lowestY) lowestY = c.y;
      if (c.x < minX) minX = c.x;
      if (c.x > maxX) maxX = c.x;
    }

    const leaderAltMeters = Math.max(0, ((height - 85) - highestY) / 10);
    this.windChangeTimer -= dt;
    if (this.windChangeTimer <= 0) {
      this.windChangeTimer = 4.2 + Math.random() * 2.5;
      if (leaderAltMeters > 65) {
        const maxGust = Math.min(220, 85 + (leaderAltMeters - 65) * 0.55);
        this.targetWindForce = (Math.random() < 0.5 ? -1 : 1) * (0.55 + Math.random() * 0.45) * maxGust;
      } else {
        this.targetWindForce = 0;
      }
    }
    this.windForce += (this.targetWindForce - this.windForce) * Math.min(1, dt * 2.5);

    this.updateBots(dt, this.worldWidth, height);

    // 4. Dynamic 2D Camera Tracking (Horizontal + Vertical + Adaptive Zoom for Wide Map)
    const verticalSpan = Math.max(120, lowestY - highestY);
    const horizontalSpan = Math.max(320, maxX - minX);

    // Focus slightly more on human players if present so a solo human on a phone never loses sight of their sumo
    const humans = climberArr.filter((c) => this.players[c.id]?.type === 'human');
    let focusX = (minX + maxX) / 2;
    let focusY = highestY * 0.56 + lowestY * 0.44 - 50;

    if (humans.length === 1) {
      focusX = humans[0].x * 0.72 + focusX * 0.28;
      focusY = humans[0].y * 0.68 + focusY * 0.32 - 55;
    }

    const reqH = verticalSpan + 320;
    const reqW = Math.min(this.worldWidth * 0.85, Math.max(760, horizontalSpan + 440));
    const zoomY = height / reqH;
    const zoomX = width / reqW;
    const minZoom = width < 600 ? 0.46 : 0.52;
    const maxZoom = width < 600 ? 0.76 : 0.92;
    const targetZoom = Math.max(minZoom, Math.min(maxZoom, Math.min(zoomX, zoomY)));

    this.cameraZoom += (targetZoom - this.cameraZoom) * Math.min(1.0, dt * 4.5);

    const viewW = width / this.cameraZoom;
    const viewH = height / this.cameraZoom;

    const minCamX = viewW / 2 - width / 2;
    const maxCamX = this.worldWidth - viewW / 2 - width / 2;
    const unclampedCamX = focusX - width / 2;
    const targetCameraX = minCamX < maxCamX
      ? Math.max(minCamX, Math.min(maxCamX, unclampedCamX))
      : this.worldWidth / 2 - width / 2;

    const targetCameraY = focusY - height / 2;

    this.cameraX += (targetCameraX - this.cameraX) * Math.min(1.0, dt * 6.0);
    this.cameraY += (targetCameraY - this.cameraY) * Math.min(1.0, dt * 5.5);

    const gravity = 680;
    const viewBottom = this.cameraY + height / 2 + viewH / 2;

    // 5. Process Climbers Physics & Controls
    for (const climber of climberArr) {
      if (climber.stunTimer > 0) {
        climber.stunTimer = Math.max(0, climber.stunTimer - dt);
      }
      if (climber.wallBounceCooldown > 0) {
        climber.wallBounceCooldown = Math.max(0, climber.wallBounceCooldown - dt);
      }

      // Check if standing platform moved out from under climber or collapsed
      if (climber.isGrounded && climber.standingPlat) {
        const sp = climber.standingPlat;
        if (sp.collapsedTimer > 0 || climber.x < sp.x - 10 || climber.x > sp.x + sp.w + 10) {
          climber.isGrounded = false;
          climber.standingPlat = null;
        } else if (sp.type === 'crumbling' && sp.crumbleTimer === 0) {
          sp.crumbleTimer = 0.001; // trigger crumble countdown on contact!
        }
      }

      if (!climber.isGrounded && climber.vy > 100) {
        climber.fallDuration += dt;
      } else if (climber.isGrounded) {
        climber.fallDuration = 0;
      }

      // Cloud Rescuer ONLY catches climbers who plummet far below the camera bottom (no free mid-jump rescues!)
      const isDeepAbyssFall = climber.y > viewBottom + 95 && climber.y < height - 130 && climber.vy > 280;
      if (isDeepAbyssFall && !this.rescuerActive) {
        this.summonCloudRescuer(climber, height);
      }

      if (this.rescuerActive && this.rescuerTargetId === climber.id) {
        continue;
      }

      if (this.rescuerActive && climber.y > viewBottom + 110) {
        climber.y = viewBottom + 110;
        climber.vy = 0;
      }

      const isPressed = this.input.isPressed(climber.id);
      const justReleased = this.input.justReleased(climber.id);
      let steer = this.input.getSteer(climber.id);
      const action = this.input.isActionPressed(climber.id);
      const throttle = this.input.getThrottle(climber.id);
      const isBot = this.players.find((p) => p.id === climber.id)?.type.startsWith('bot_') ?? false;

      // Direct Touch Drag-to-Aim enhancement for Phone/Touch players:
      const touchPtr = !isBot ? this.input.getTouchPointer(climber.id) : null;
      if (touchPtr && Math.abs(touchPtr.dx) > 5) {
        steer = Math.max(-1, Math.min(1, touchPtr.dx / 36));
      }

      const isJumpTriggerDown = action || isPressed || throttle > 0.3;

      if (climber.isGrounded && climber.stunTimer <= 0) {
        if (Math.abs(steer) > 0.06) {
          // Direct manual aiming (touch drag, virtual thumbstick, or A/D / Left/Right keys)
          const targetAim = -Math.PI / 2 + steer * 0.82;
          climber.aimAngle += (targetAim - climber.aimAngle) * Math.min(1, dt * 18);
          climber.aimOscillation = Math.asin(Math.max(-1, Math.min(1, (climber.aimAngle + Math.PI / 2) / 0.72)));
        } else if (isBot) {
          climber.aimAngle = -Math.PI / 2;
        } else if (isJumpTriggerDown) {
          // Pure 1-button hold without steering: smooth pendulum sweep
          climber.aimOscillation += dt * 3.4;
          climber.aimAngle = -Math.PI / 2 + Math.sin(climber.aimOscillation) * 0.72;
        } else {
          climber.aimAngle = -Math.PI / 2;
        }

        // Prevent aiming directly into outer boundary walls
        const wallSafetyMargin = 75;
        if (climber.x < wallSafetyMargin && climber.aimAngle < -Math.PI / 2) {
          climber.aimAngle = -Math.PI / 2;
        } else if (climber.x > this.worldWidth - wallSafetyMargin && climber.aimAngle > -Math.PI / 2) {
          climber.aimAngle = -Math.PI / 2;
        }

        if (isJumpTriggerDown) {
          climber.isCharging = true;
          climber.chargePower = Math.min(1.0, climber.chargePower + dt * 1.85);
        } else if (climber.isCharging && (!isJumpTriggerDown || justReleased)) {
          // Launch spring leap!
          climber.isCharging = false;
          climber.isGrounded = false;
          const platVx = climber.standingPlat ? climber.standingPlat.vx * 0.35 : 0;
          climber.standingPlat = null;
          const jumpSpeed = 420 + climber.chargePower * 460;
          climber.vx = Math.cos(climber.aimAngle) * jumpSpeed * 0.85 + platVx;
          climber.vy = Math.sin(climber.aimAngle) * jumpSpeed;
          climber.chargePower = 0;
          climber.wallBounceCooldown = 0.2;
          this.audio.playBoost();
          this.particles.spawnSparks(climber.x, climber.y + 16, '#FBBF24', 10);
        }
      }

      // Airborne physics with Crosswind & Mid-Air Steering
      if (!climber.isGrounded) {
        if (steer !== 0 && climber.wallBounceCooldown <= 0) {
          climber.vx += steer * 370 * dt;
        }
        // Apply high-altitude crosswind
        const climberAlt = ((height - 85) - climber.y) / 10;
        if (climberAlt > 65) {
          climber.vx += this.windForce * dt;
        }

        climber.vy += gravity * dt;
        climber.x += climber.vx * dt;
        climber.y += climber.vy * dt;
        climber.angle = Math.max(-0.35, Math.min(0.35, climber.vx * 0.0008));

        // Cushioned Outer Tower Wall Bouncing
        const wallLeft = 34;
        const wallRight = this.worldWidth - 34;

        if (climber.x < wallLeft) {
          climber.x = wallLeft;
          if (climber.wallBounceCooldown <= 0) {
            climber.vx = Math.min(140, Math.abs(climber.vx) * 0.35);
            climber.vy *= 0.85;
            climber.wallBounceCooldown = 0.25;
            this.audio.playTap();
            this.particles.spawnDust(climber.x, climber.y, 6);
          } else {
            climber.vx = Math.max(0, climber.vx * 0.5);
          }
        } else if (climber.x > wallRight) {
          climber.x = wallRight;
          if (climber.wallBounceCooldown <= 0) {
            climber.vx = -Math.min(140, Math.abs(climber.vx) * 0.35);
            climber.vy *= 0.85;
            climber.wallBounceCooldown = 0.25;
            this.audio.playTap();
            this.particles.spawnDust(climber.x, climber.y, 6);
          } else {
            climber.vx = Math.min(0, climber.vx * 0.5);
          }
        }

        // Patrol Shock Drone Collision
        for (const d of this.drones) {
          const distD = Math.hypot(climber.x - d.x, climber.y - d.y);
          if (distD < d.radius + 18 && climber.stunTimer <= 0) {
            climber.stunTimer = 0.85;
            climber.vx = (climber.x < d.x ? -1 : 1) * 260;
            climber.vy = Math.max(120, climber.vy);
            this.audio.playExplosion();
            this.particles.spawnSparks(d.x, d.y, '#38BDF8', 16);
            this.particles.showFloatingText('⚡ DRONE ZAP!', climber.x, climber.y - 24, '#38BDF8', 18);
          }
        }

        // Platform Landing Detection (only when descending)
        if (climber.vy > 0) {
          for (const plat of this.platforms) {
            if (plat.collapsedTimer > 0) continue;
            if (
              climber.x >= plat.x - 8 &&
              climber.x <= plat.x + plat.w + 8 &&
              climber.y + 18 >= plat.y &&
              climber.y + 18 <= plat.y + plat.h + Math.max(14, climber.vy * dt * 1.6)
            ) {
              if (plat.springy) {
                climber.vy = -660;
                this.audio.playBounce();
                this.particles.showFloatingText('⚡ SPRING BOOST!', climber.x, climber.y - 20, '#10B981');
                this.particles.spawnSparks(climber.x, plat.y, '#10B981', 14);
              } else {
                climber.isGrounded = true;
                climber.standingPlat = plat;
                climber.y = plat.y - 18;
                climber.vx = 0;
                climber.vy = 0;
                climber.angle = 0;
                climber.fallDuration = 0;
                if (plat.type === 'crumbling' && plat.crumbleTimer === 0) {
                  plat.crumbleTimer = 0.001;
                  this.particles.showFloatingText('⚠️ CRUMBLING!', climber.x, climber.y - 26, '#F97316', 14);
                }
                this.audio.playTap();
              }
              break;
            }
          }
        }

        // Track highest ascent & altitude score
        if (climber.y < climber.highestY) {
          climber.highestY = climber.y;
        }
        const altitudeMeters = Math.max(0, Math.floor((height - 85 - climber.y) / 10));
        climber.score = Math.max(climber.score, altitudeMeters);

        // Reached rooftop goal
        if (climber.y <= this.goalHeight + 22 && Math.abs(climber.x - this.worldWidth / 2) <= 185) {
          this.isFinished = true;
          this.audio.playFanfare();
          if (climber.id === 0) {
            AchievementManager.getInstance().unlock('sumo_master');
          }
        }
      }
    }

    // 6. Update Cloud Rescuer
    this.updateCloudRescuer(dt);

    // 7. Head Bop & Stronger Sumo Belly Bump Collisions
    for (let i = 0; i < climberArr.length; i++) {
      for (let j = 0; j < climberArr.length; j++) {
        if (i === j) continue;
        const c1 = climberArr[i];
        const c2 = climberArr[j];

        // Head bop stomp
        if (c1.vy > 100 && Math.hypot(c1.x - c2.x, (c1.y + 16) - (c2.y - 16)) < 28) {
          c1.vy = -580;
          c2.stunTimer = 1.35;
          c2.isCharging = false;
          c2.chargePower = 0;
          this.audio.playExplosion();
          this.particles.showFloatingText('💥 HEAD STOMP!', c2.x, c2.y - 25, '#F59E0B', 22);
          this.particles.spawnSparks(c2.x, c2.y - 16, '#F59E0B', 15);
        } else if (i < j) {
          // Heavy Sumo Belly Slap Knockback
          const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
          if (dist < 38 && dist > 0) {
            const pushDir = c1.x < c2.x ? -1 : 1;
            const overlap = (38 - dist) / 2;
            c1.x -= pushDir * overlap;
            c2.x += pushDir * overlap;
            const pushForce = Math.max(240, Math.abs(c1.vx) + Math.abs(c2.vx) + 180);
            c1.vx = -pushDir * pushForce;
            c2.vx = pushDir * pushForce;
            if (c1.isGrounded) {
              c1.isGrounded = false;
              c1.standingPlat = null;
              c1.vy = -140;
            }
            if (c2.isGrounded) {
              c2.isGrounded = false;
              c2.standingPlat = null;
              c2.vy = -140;
            }
            this.audio.playBounce();
            this.particles.spawnSparks((c1.x + c2.x) / 2, (c1.y + c2.y) / 2, '#F59E0B', 10);
            this.particles.showFloatingText('💢 SUMO CLASH!', (c1.x + c2.x) / 2, Math.min(c1.y, c2.y) - 20, '#EF4444', 17);
          }
        }
      }
    }
  }

  private summonCloudRescuer(climber: SumoClimber, _height: number) {
    if (this.rescuerActive) return;

    // Find a safe non-collapsed platform LOWER than the camera midpoint (so falling has a real altitude penalty!)
    let candidatePlat: SumoPlatform = this.platforms[0];
    let minD = Infinity;

    for (const plat of this.platforms) {
      if (plat.collapsedTimer > 0 || plat.type === 'crumbling') continue;
      if (plat.y <= this.goalHeight + 60) continue;
      // Only consider platforms at or below climber's recent fall zone (no free upward carries!)
      if (plat.y < climber.y - 160) continue;

      const platCenterX = plat.x + plat.w / 2;
      const platTopY = plat.y - 18;
      const dx = platCenterX - climber.x;
      const dy = platTopY - climber.y;
      const dist = Math.hypot(dx * 0.7, dy);

      if (dist < minD) {
        minD = dist;
        candidatePlat = plat;
      }
    }

    this.rescuerActive = true;
    this.rescuerTargetId = climber.id;
    this.rescuerTargetPlat = candidatePlat;
    this.rescuerTargetPlatX = candidatePlat.x + candidatePlat.w / 2;
    this.rescuerTargetPlatY = candidatePlat.y - 18;
    this.rescuerX = climber.x;
    this.rescuerY = climber.y - 110;
    this.rescuerState = 'descending';
    this.rescuerTimer = 0;

    this.audio.playBounce();
    this.particles.spawnSparks(climber.x, climber.y, '#38BDF8', 12);
  }

  private updateCloudRescuer(dt: number) {
    if (!this.rescuerActive || this.rescuerTargetId === null) return;

    const climber = this.climbers.get(this.rescuerTargetId);
    if (!climber) {
      this.rescuerActive = false;
      this.rescuerTargetId = null;
      this.rescuerTargetPlat = null;
      return;
    }

    if (this.rescuerTargetPlat && this.rescuerTargetPlat.collapsedTimer === 0) {
      this.rescuerTargetPlatX = this.rescuerTargetPlat.x + this.rescuerTargetPlat.w / 2;
      this.rescuerTargetPlatY = this.rescuerTargetPlat.y - 18;
    }

    if (this.rescuerState === 'descending') {
      this.rescuerY += 520 * dt;
      this.rescuerX += (climber.x - this.rescuerX) * Math.min(1.0, dt * 10);
      climber.vy = Math.min(climber.vy, 90);

      const distToClimber = Math.hypot(this.rescuerX - climber.x, this.rescuerY - (climber.y - 45));
      if (this.rescuerY >= climber.y - 45 || distToClimber < 34) {
        this.rescuerState = 'lifting';
        this.audio.playTap();
      }
    } else if (this.rescuerState === 'lifting') {
      const targetX = this.rescuerTargetPlatX;
      const targetY = this.rescuerTargetPlatY - 45;

      const dx = targetX - this.rescuerX;
      const dy = targetY - this.rescuerY;
      const dist = Math.hypot(dx, dy);

      const flightSpeed = 440;
      if (dist > 1) {
        this.rescuerX += (dx / dist) * Math.min(flightSpeed * dt, Math.abs(dx));
        this.rescuerY += (dy / dist) * Math.min(flightSpeed * dt, Math.abs(dy));
      }

      climber.x = this.rescuerX;
      climber.y = this.rescuerY + 45;
      climber.vx = 0;
      climber.vy = 0;

      if (dist < 16 || (Math.abs(dy) < 10 && Math.abs(dx) < 16)) {
        climber.x = targetX;
        climber.y = this.rescuerTargetPlatY;
        climber.isGrounded = true;
        climber.standingPlat = this.rescuerTargetPlat;
        climber.fallDuration = 0;
        climber.stunTimer = 0.55;
        climber.vx = 0;
        climber.vy = 0;

        this.audio.playTap();
        this.particles.showFloatingText('☁️ SAVED (-ALTITUDE)!', climber.x, climber.y - 28, '#38BDF8', 18);
        this.particles.spawnSparks(climber.x, climber.y, '#38BDF8', 16);

        this.rescuerState = 'leaving';
      }
    } else if (this.rescuerState === 'leaving') {
      this.rescuerY -= 520 * dt;
      if (this.rescuerY < this.cameraY - 180) {
        this.rescuerActive = false;
        this.rescuerTargetId = null;
        this.rescuerTargetPlat = null;
      }
    }
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    _height: number
  ): void {
    const c = this.climbers.get(botId);
    if (!c || c.stunTimer > 0) return;

    if (c.isGrounded) {
      // Find reachable platforms in the tier above (within 320px horizontal and 260px vertical)
      const candidates = this.platforms.filter(
        (p) =>
          p.collapsedTimer <= 0 &&
          p.y < c.y - 28 &&
          p.y >= c.y - 260 &&
          Math.abs(p.x + p.w / 2 - c.x) < 330
      );

      let targetPlat: SumoPlatform | null = null;
      const springPlat = candidates.find((p) => p.springy && Math.abs(p.x + p.w / 2 - c.x) < 230);

      if (springPlat && difficulty !== 'bot_easy') {
        targetPlat = springPlat;
      } else if (candidates.length > 0) {
        // Score candidates by vertical gain and horizontal proximity (and bias toward center near summit)
        targetPlat = candidates.reduce((best, curr) => {
          const bestCenter = best.x + best.w / 2;
          const currCenter = curr.x + curr.w / 2;
          const bestScore = (c.y - best.y) * 1.3 - Math.abs(bestCenter - c.x) * 0.55;
          const currScore = (c.y - curr.y) * 1.3 - Math.abs(currCenter - c.x) * 0.55;
          return currScore > bestScore ? curr : best;
        }, candidates[0]);
      }

      // Predict moving platform position ~0.55s ahead
      const predTime = difficulty === 'bot_hard' ? 0.55 : difficulty === 'bot_normal' ? 0.35 : 0.0;
      const targetX = targetPlat
        ? Math.max(targetPlat.minX + 20, Math.min(targetPlat.maxX - 20, targetPlat.x + targetPlat.w / 2 + targetPlat.vx * predTime))
        : width / 2;
      const dx = targetX - c.x - (difficulty !== 'bot_easy' ? this.windForce * 0.22 : 0);
      const dy = targetPlat ? c.y - targetPlat.y : 140;

      let steer = Math.max(-1, Math.min(1, dx / 185));
      if (Math.abs(dx) < 12) steer = 0;

      const wallMargin = 85;
      if (c.x < wallMargin && steer < 0) steer = Math.max(0, steer);
      else if (c.x > width - wallMargin && steer > 0) steer = Math.min(0, steer);

      const targetLaunchVy = Math.sqrt(2 * 680 * (dy + 34));
      const aimFactor = Math.abs(Math.sin(-Math.PI / 2 + steer * 0.82));
      const targetSpeed = targetLaunchVy / Math.max(0.58, aimFactor);
      let desiredPower = Math.max(0.28, Math.min(1.0, (targetSpeed - 420) / 460));

      // If standing on a crumbling platform, jump faster before it collapses!
      if (c.standingPlat && c.standingPlat.type === 'crumbling' && c.standingPlat.crumbleTimer > 0.35) {
        desiredPower = Math.min(desiredPower, 0.52);
      }

      if (difficulty === 'bot_hard') {
        desiredPower += (Math.random() - 0.5) * 0.04;
      } else if (difficulty === 'bot_normal') {
        desiredPower += (Math.random() - 0.5) * 0.10;
      } else {
        desiredPower += (Math.random() - 0.5) * 0.22;
      }
      desiredPower = Math.max(0.24, Math.min(1.0, desiredPower));

      if (!c.isCharging) {
        this.input.setBotInput(botId, true, steer, 0, true);
      } else if (c.chargePower >= desiredPower) {
        this.input.setBotInput(botId, false, steer, 0, false);
      } else {
        this.input.setBotInput(botId, true, steer, 0, true);
      }
    } else {
      let steer = 0;
      if (c.wallBounceCooldown > 0) {
        steer = 0;
      } else if (c.vy > 0) {
        const platformsBelow = this.platforms.filter(
          (p) => p.collapsedTimer <= 0 && p.y >= c.y && p.y <= c.y + 280
        );
        if (platformsBelow.length > 0) {
          let bestPlat = platformsBelow[0];
          let bestDist = Infinity;
          for (const p of platformsBelow) {
            const pCenter = p.x + p.w / 2;
            const d = Math.abs(c.x - pCenter);
            if (d < bestDist) {
              bestDist = d;
              bestPlat = p;
            }
          }
          const pCenter = bestPlat.x + bestPlat.w / 2;
          steer = Math.max(-1, Math.min(1, (pCenter - c.x) / 42));
        }
      } else if (difficulty === 'bot_hard') {
        for (const opp of this.climbers.values()) {
          if (opp.id !== botId && opp.y > c.y && opp.y < c.y + 110 && Math.abs(c.x - opp.x) < 85) {
            steer = opp.x > c.x ? 0.85 : -0.85;
            break;
          }
        }
      }

      this.input.setBotInput(botId, false, steer, 0, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Night Sky Backdrop Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#090714');
    skyGrad.addColorStop(0.45, '#1E1B4B');
    skyGrad.addColorStop(0.85, '#312E81');
    skyGrad.addColorStop(1, '#1E1B4B');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Glowing Cyber Moon
    ctx.save();
    ctx.shadowColor = '#FDE047';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(width * 0.82 - this.cameraX * 0.05, 85, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Parallax Wide City Skyline Silhouettes
    const parallaxX = -this.cameraX * 0.22;
    const parallaxY = -this.cameraY * 0.22;
    ctx.save();
    ctx.fillStyle = '#0B0A1A';
    const buildingWidths = [95, 115, 80, 135, 100, 125, 90, 110, 145, 95, 115, 85, 130, 105, 120, 90, 115, 100];
    let curBx = -220 + parallaxX;
    for (let i = 0; i < buildingWidths.length; i++) {
      const bw = buildingWidths[i];
      const bh = 220 + ((i * 53) % 190);
      const by = height - bh + parallaxY;
      ctx.fillRect(curBx, by, bw - 6, bh + 500);

      ctx.fillStyle = i % 2 === 0 ? 'rgba(253, 224, 71, 0.35)' : 'rgba(56, 189, 248, 0.32)';
      for (let wy = by + 20; wy < by + bh - 30; wy += 24) {
        for (let wx = curBx + 12; wx < curBx + bw - 20; wx += 18) {
          if ((Math.floor(wx) + Math.floor(wy)) % 5 !== 0) {
            ctx.fillRect(wx, wy, 8, 12);
          }
        }
      }
      ctx.fillStyle = '#0B0A1A';
      curBx += bw;
    }
    ctx.restore();

    // 2. World Camera Transform (2D Horizontal + Vertical + Adaptive Zoom)
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(this.cameraZoom, this.cameraZoom);
    ctx.translate(-width / 2, -height / 2);
    ctx.translate(-this.cameraX, -this.cameraY);

    const towerTopY = this.goalHeight - 80;
    const towerBottomY = height - 40;

    // Background Interior Structural Grid Columns across the Wide Skyscraper
    ctx.save();
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.25)';
    ctx.lineWidth = 2;
    const colSpacing = this.worldWidth / 5;
    for (let c = 1; c <= 4; c++) {
      const cx = c * colSpacing;
      ctx.beginPath();
      ctx.moveTo(cx, towerTopY);
      ctx.lineTo(cx, towerBottomY);
      ctx.stroke();
    }
    ctx.restore();

    // Outer Skyscraper Scaffolding Columns on Left & Right World Borders
    ctx.save();
    [10, this.worldWidth - 34].forEach((gx) => {
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(gx, towerTopY, 24, towerBottomY - towerTopY);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(gx, towerTopY, 24, towerBottomY - towerTopY);

      ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
      ctx.lineWidth = 1.2;
      for (let ty = towerBottomY; ty > towerTopY; ty -= 55) {
        ctx.beginPath();
        ctx.moveTo(gx, ty);
        ctx.lineTo(gx + 24, ty - 55);
        ctx.moveTo(gx + 24, ty);
        ctx.lineTo(gx, ty - 55);
        ctx.stroke();
      }

      for (let by = towerBottomY - 120; by > towerTopY; by -= 280) {
        const beaconPulse = Math.sin(performance.now() * 0.005 + by) > 0.3;
        ctx.save();
        ctx.fillStyle = beaconPulse ? '#EF4444' : '#7F1D1D';
        if (beaconPulse) {
          ctx.shadowColor = '#EF4444';
          ctx.shadowBlur = 10;
        }
        ctx.beginPath();
        ctx.arc(gx + 12, by, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });
    ctx.restore();

    // High-Altitude Wind Stream Lines in World Space
    if (Math.abs(this.windForce) > 25) {
      ctx.save();
      const windDir = Math.sign(this.windForce);
      const tNow = performance.now() * 0.001;
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.24)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 16; i++) {
        const wy = this.cameraY + ((i * 73) % (height / this.cameraZoom));
        const wxBase = (tNow * Math.abs(this.windForce) * 2.4 + i * 190) % this.worldWidth;
        const wx = windDir > 0 ? wxBase : this.worldWidth - wxBase;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + windDir * 55, wy);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Dynamic Vertical Stomp Reticle when players/CPU are stacked
    const climberArr = Array.from(this.climbers.values());
    for (let i = 0; i < climberArr.length; i++) {
      for (let j = 0; j < climberArr.length; j++) {
        if (i === j) continue;
        const upper = climberArr[i];
        const lower = climberArr[j];
        if (upper.y < lower.y - 30 && lower.y - upper.y < 420 && Math.abs(upper.x - lower.x) < 75) {
          ctx.save();
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(upper.x, upper.y + 20);
          ctx.lineTo(lower.x, lower.y - 20);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(lower.x, lower.y - 22, 12, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // 3. Render Platforms (Steel, Spring, Moving Crane, Crumbling Concrete)
    for (const plat of this.platforms) {
      if (plat.collapsedTimer > 0) {
        // Ghost outline while regenerating
        ctx.save();
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.25)';
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        ctx.restore();
        continue;
      }

      const shakeX = plat.crumbleTimer > 0 ? (Math.random() - 0.5) * 6 : 0;
      const shakeY = plat.crumbleTimer > 0 ? (Math.random() - 0.5) * 4 : 0;
      const px = plat.x + shakeX;
      const py = plat.y + shakeY;

      if (plat.springy) {
        ctx.save();
        ctx.shadowColor = '#10B981';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#065F46';
        ctx.fillRect(px, py, plat.w, plat.h);
        ctx.strokeStyle = '#34D399';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(px, py, plat.w, plat.h);
        ctx.restore();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 10px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ SPRING ⚡', px + plat.w / 2, py + 12);
      } else if (plat.type === 'moving') {
        // Motorized Crane Girder Track Line
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(plat.minX, py + plat.h / 2);
        ctx.lineTo(plat.maxX, py + plat.h / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#0F172A';
        ctx.fillRect(px, py, plat.w, plat.h);
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, plat.w, plat.h);

        ctx.fillStyle = '#BAE6FD';
        ctx.font = '900 9px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(plat.vx > 0 ? '◄ CRANE ►' : '► CRANE ◄', px + plat.w / 2, py + 11.5);
        ctx.restore();
      } else if (plat.type === 'crumbling') {
        ctx.save();
        ctx.fillStyle = plat.crumbleTimer > 0 ? '#7C2D12' : '#431407';
        ctx.fillRect(px, py, plat.w, plat.h);
        ctx.strokeStyle = plat.crumbleTimer > 0 ? '#EF4444' : '#F97316';
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, plat.w, plat.h);

        // Fracture crack lines
        ctx.strokeStyle = '#FDBA74';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px + plat.w * 0.3, py);
        ctx.lineTo(px + plat.w * 0.35, py + plat.h);
        ctx.moveTo(px + plat.w * 0.7, py);
        ctx.lineTo(px + plat.w * 0.65, py + plat.h);
        ctx.stroke();
        ctx.restore();
      } else {
        // Heavy Steel Girder
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(px, py, plat.w, plat.h);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, plat.w, plat.h);

        ctx.fillStyle = '#64748B';
        ctx.fillRect(px + 2, py + 1, plat.w - 4, 3);

        ctx.fillStyle = '#94A3B8';
        for (let rx = px + 10; rx < px + plat.w - 6; rx += 26) {
          ctx.beginPath();
          ctx.arc(rx, py + plat.h / 2, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 4. Render Patrol Shock Drones
    for (const d of this.drones) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(0, 0, d.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = Math.sin(d.pulsePhase) > 0 ? '#EF4444' : '#38BDF8';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5. Top Rooftop Helipad & Golden Trophy
    ctx.save();
    ctx.fillStyle = '#F59E0B';
    ctx.shadowColor = '#FBBF24';
    ctx.shadowBlur = 18;
    ctx.font = '900 24px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    const bannerTitle = this.isNoTimeLimit
      ? `🏆 SUMMIT CONQUERED: ${this.targetMeters}m! 🏆`
      : '🏆 ROOFTOP SUMO CHAMPION 🏆';
    ctx.fillText(bannerTitle, this.worldWidth / 2, this.goalHeight - 22);
    ctx.restore();

    // 6. Render Climbers & Parabolic Trajectory Preview Arc
    for (const c of this.climbers.values()) {
      const p = this.players[c.id];

      // Parabolic Trajectory Preview Dots when charging
      if (c.isCharging) {
        ctx.save();
        const jumpSpeed = 420 + c.chargePower * 460;
        const platVx = c.standingPlat ? c.standingPlat.vx * 0.35 : 0;
        const v0x = Math.cos(c.aimAngle) * jumpSpeed * 0.85 + platVx;
        const v0y = Math.sin(c.aimAngle) * jumpSpeed;
        const climberAlt = ((height - 85) - c.y) / 10;
        const ax = climberAlt > 65 ? this.windForce : 0;
        const ay = 680;

        for (let step = 1; step <= 10; step++) {
          const t = step * 0.065;
          const arcX = c.x + v0x * t + 0.5 * ax * t * t;
          const arcY = c.y + v0y * t + 0.5 * ay * t * t;
          const dotAlpha = 0.92 - step * 0.075;
          const dotR = Math.max(2.5, 5.5 - step * 0.25);

          ctx.fillStyle = p.color;
          ctx.globalAlpha = dotAlpha;
          ctx.beginPath();
          ctx.arc(arcX, arcY, dotR, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.save();
      ctx.translate(c.x, c.y);

      const mood = c.stunTimer > 0 || c.fallDuration > 0.4 ? 'shocked' : c.isCharging ? 'focused' : c.vy < -100 ? 'triumph' : 'idle';
      this.drawPlayerMascot(ctx, c.id, 0, 0, 20, mood, performance.now() * 0.001, c.angle);

      // Black Sumo Belt (Mawashi) with golden buckle
      ctx.fillStyle = '#18181B';
      ctx.fillRect(-15, 6, 30, 6);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(-5, 6.5, 10, 5);

      if (c.stunTimer > 0) {
        ctx.fillStyle = '#FACC15';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★ ★', 0, -26);
      }

      ctx.restore();

      // Charge Bar & Height Score Pill
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(c.x - 24, c.y - 38, 48, 16);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(c.x - 24, c.y - 38, 48, 16);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${c.score}m`, c.x, c.y - 26);

      if (c.isCharging) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(c.x - 24, c.y - 46, 48, 6);
        ctx.fillStyle = c.chargePower > 0.75 ? '#10B981' : '#FBBF24';
        ctx.fillRect(c.x - 23, c.y - 45, 46 * c.chargePower, 4);
      }
      ctx.restore();
    }

    if (this.rescuerActive) {
      this.renderCloudRescuer(ctx);
    }

    ctx.restore();

    // 7. High-Altitude Wind Indicator Banner (Screen Space)
    if (Math.abs(this.windForce) > 25) {
      ctx.save();
      const windDir = this.windForce > 0 ? '►►►' : '◄◄◄';
      const pillW = 200;
      const pillX = width / 2 - pillW / 2;
      const pillY = 66;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, 24, 8);
      else ctx.rect(pillX, pillY, pillW, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#BAE6FD';
      ctx.font = '800 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🌬️ CROSSWIND ${windDir} ${Math.round(Math.abs(this.windForce))}kt`, width / 2, pillY + 15);
      ctx.restore();
    }

    this.renderTowerRadar(ctx, width, height);
    ctx.restore();
  }

  private renderTowerRadar(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const activeClimbers = Array.from(this.climbers.values());
    if (activeClimbers.length === 0) return;

    ctx.save();

    const mapW = 68;
    const mapH = Math.min(390, Math.max(240, height - 130));
    const mapX = width - mapW - 12;
    const mapY = (height - mapH) / 2;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(mapX, mapY, mapW, mapH, 12);
    else ctx.rect(mapX, mapY, mapW, mapH);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(mapX + 6, mapY + 6, mapW - 12, 18, 6);
    else ctx.rect(mapX + 6, mapY + 6, mapW - 12, 18);
    ctx.fill();
    ctx.fillStyle = '#38BDF8';
    ctx.font = '900 9px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WIDE MAP', mapX + mapW / 2, mapY + 15);

    const trackTopY = mapY + 38;
    const trackBottomY = mapY + mapH - 24;
    const trackH = trackBottomY - trackTopY;
    const groundWorldY = height - 60;
    const totalWorldH = groundWorldY - this.goalHeight;

    const worldToMapY = (wy: number) => {
      const progress = (groundWorldY - wy) / totalWorldH;
      const clamped = Math.max(0, Math.min(1, progress));
      return trackBottomY - clamped * trackH;
    };

    ctx.fillStyle = '#1E293B';
    ctx.fillRect(mapX + 10, trackTopY, mapW - 20, trackH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX + 10, trackTopY, mapW - 20, trackH);

    const maxAltitudeDisplay = this.isNoTimeLimit ? this.targetMeters : 340;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.font = '8px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    [0.25, 0.5, 0.75].forEach((pct) => {
      const ty = trackBottomY - pct * trackH;
      ctx.beginPath();
      ctx.moveTo(mapX + 6, ty);
      ctx.lineTo(mapX + 16, ty);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.stroke();
      ctx.fillText(`${Math.round(pct * maxAltitudeDisplay)}m`, mapX + 6, ty - 6);
    });

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(mapX + mapW / 2, trackTopY - 4, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆', mapX + mapW / 2, trackTopY - 4);

    ctx.fillStyle = '#475569';
    ctx.fillRect(mapX + 10, trackBottomY + 2, mapW - 20, 5);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '800 8px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('0m', mapX + mapW / 2, trackBottomY + 14);

    const halfViewH = height / (2 * this.cameraZoom);
    const viewCenterY = this.cameraY + height / 2;
    const camTopY = worldToMapY(viewCenterY - halfViewH);
    const camBottomY = worldToMapY(viewCenterY + halfViewH);
    const camBoxH = Math.max(14, camBottomY - camTopY);

    ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.fillRect(mapX + 4, camTopY, mapW - 8, camBoxH);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(mapX + 4, camTopY, mapW - 8, camBoxH);
    ctx.setLineDash([]);

    const sortedClimbers = [...activeClimbers].sort((a, b) => a.y - b.y);
    const leaderId = sortedClimbers.length > 0 ? sortedClimbers[0].id : null;

    activeClimbers.forEach((c) => {
      const p = this.players[c.id];
      const pMapY = worldToMapY(c.y);
      const normX = Math.max(0, Math.min(1, c.x / this.worldWidth));
      const pMapX = mapX + 14 + normX * (mapW - 28);

      const altMeters = Math.max(0, Math.floor((groundWorldY - c.y) / 10));

      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(pMapX, pMapY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 7.5px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${c.id + 1}`, pMapX, pMapY);

      const badgeW = 60;
      const badgeH = 18;
      const badgeX = mapX - badgeW - 6;
      const badgeY = Math.max(mapY + 6, Math.min(mapY + mapH - 24, pMapY - 9));

      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(badgeX + badgeW, badgeY + badgeH / 2);
      ctx.lineTo(pMapX - 7, pMapY);
      ctx.stroke();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5);
      else ctx.rect(badgeX, badgeY, badgeW, badgeH);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 9px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const isLeader = c.id === leaderId && altMeters > 5;
      const leadMark = isLeader ? '★ ' : '';
      ctx.fillText(`P${c.id + 1}: ${leadMark}${altMeters}m`, badgeX + badgeW / 2, badgeY + badgeH / 2);
    });

    ctx.restore();
  }

  private renderCloudRescuer(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.rescuerX, this.rescuerY);

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.arc(-14, 4, 15, 0, Math.PI * 2);
    ctx.arc(14, 4, 15, 0, Math.PI * 2);
    ctx.arc(-24, 8, 10, 0, Math.PI * 2);
    ctx.arc(24, 8, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0284C7';
    ctx.fillRect(-10, -8, 8, 6);
    ctx.fillRect(2, -8, 8, 6);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(-9, -7, 6, 4);
    ctx.fillRect(3, -7, 6, 4);

    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-16, -5);
    ctx.lineTo(16, -5);
    ctx.stroke();

    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 2, 6, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(12, -2);
    ctx.lineTo(26, -18);
    ctx.stroke();

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(26, -18);
    ctx.lineTo(0, 40);
    ctx.stroke();

    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 42, 6, 0, Math.PI);
    ctx.stroke();

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const list = Array.from(this.climbers.values()).sort((a, b) => b.score - a.score);
    const winnerId = list.length > 0 ? list[0].id : null;
    if (winnerId === 0) {
      AchievementManager.getInstance().unlock('sumo_master');
    }

    const mins = Math.floor(this.elapsedTime / 60);
    const secs = (this.elapsedTime % 60).toFixed(1);
    const timeFormatted = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    let highlight = 'All slipped down!';
    if (winnerId !== null) {
      if (this.isNoTimeLimit) {
        highlight = `🏆 ${this.players[winnerId].name} conquered ${this.targetMeters}m in ${timeFormatted}!`;
      } else {
        highlight = `${this.players[winnerId].name} bounced highest into the stratosphere (${list[0].score}m)!`;
      }
    }

    return {
      winnerId,
      rankings: list.map((c, idx) => ({ playerId: c.id, score: c.score, place: idx + 1 })),
      mvpHighlight: highlight
    };
  }
}
