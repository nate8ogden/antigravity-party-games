import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';
import { AchievementManager } from '../core/AchievementManager';

interface SumoPlatform {
  x: number;
  y: number;
  w: number;
  h: number;
  springy: boolean;
}

interface SumoClimber {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  isGrounded: boolean;
  isCharging: boolean;
  chargePower: number;
  aimAngle: number;
  aimOscillation: number;
  stunTimer: number;
  highestY: number;
  score: number;
  alive: boolean;
  fallDuration: number;
}

export class SkylineSumoGame extends BaseGame {
  private climbers: Map<PlayerId, SumoClimber> = new Map();
  private platforms: SumoPlatform[] = [];
  private cameraY: number = 0;
  private cameraZoom: number = 1.0;
  private goalHeight: number = -2200; // rooftop trophy

  // Just For Fun / Target Altitude Speedrun Mode
  public isNoTimeLimit: boolean = false;
  public targetMeters: number = 250;
  public elapsedTime: number = 0;

  // Lakitu Cloud Rescuer Mechanism
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
    const groundY = height - 85;
    if (this.isNoTimeLimit) {
      // 10 pixels per meter in altitude calibration
      this.goalHeight = groundY - this.targetMeters * 10;
      this.roundTimer = Infinity;
    } else {
      this.goalHeight = -2200; // standard rooftop (~280m)
      this.roundTimer = 60;
    }
    this.elapsedTime = 0;
    this.isFinished = false;
    this.climbers.clear();
    this.platforms = [];
    this.cameraY = height - 350;
    this.cameraZoom = 1.0;
    this.rescuerActive = false;
    this.rescuerTargetId = null;
    this.rescuerTargetPlat = null;

    // Ground platform
    this.platforms.push({ x: 30, y: height - 60, w: width - 60, h: 40, springy: false });

    // Procedural upward platforms up to goal with strict non-converging architecture
    let curY = height - 165;
    let tierIndex = 0;

    while (curY > this.goalHeight + 90) {
      const pattern = tierIndex % 4;
      tierIndex++;

      const candidatePlatforms: SumoPlatform[] = [];

      if (pattern === 0) {
        // Pattern 0: Split Left & Right platforms with guaranteed open center gap (>110px)
        const pw1 = 90 + Math.random() * 35;
        const maxPx1 = Math.max(45, width / 2 - 65 - pw1);
        const px1 = 45 + Math.random() * (maxPx1 - 45);
        candidatePlatforms.push({
          x: px1,
          y: curY,
          w: pw1,
          h: 16,
          springy: Math.random() < 0.25
        });

        const pw2 = 90 + Math.random() * 35;
        const minPx2 = width / 2 + 65;
        const maxPx2 = width - 45 - pw2;
        const px2 = minPx2 + Math.random() * Math.max(10, maxPx2 - minPx2);
        candidatePlatforms.push({
          x: px2,
          y: curY,
          w: pw2,
          h: 16,
          springy: Math.random() < 0.25
        });
      } else if (pattern === 1) {
        // Pattern 1: Single Center platform with wide open left and right flanks
        const pw = 120 + Math.random() * 40;
        const px = width / 2 - pw / 2 + (Math.random() - 0.5) * 50;
        candidatePlatforms.push({
          x: Math.max(50, Math.min(width - 50 - pw, px)),
          y: curY,
          w: pw,
          h: 16,
          springy: Math.random() < 0.35 // higher spring chance on central launchpad
        });
      } else if (pattern === 2) {
        // Pattern 2: Staggered asymmetric dual tiers (slight vertical step)
        const pw1 = 85 + Math.random() * 30;
        const px1 = 50 + Math.random() * 60;
        candidatePlatforms.push({
          x: px1,
          y: curY,
          w: pw1,
          h: 16,
          springy: Math.random() < 0.2
        });

        const pw2 = 85 + Math.random() * 30;
        const px2 = width - 50 - pw2 - Math.random() * 60;
        candidatePlatforms.push({
          x: px2,
          y: curY - 22,
          w: pw2,
          h: 16,
          springy: Math.random() < 0.2
        });
      } else {
        // Pattern 3: Triple stepping stones if wide, or balanced dual
        if (width >= 640) {
          const colW = (width - 110) / 3;
          for (let c = 0; c < 3; c++) {
            const pw = 75 + Math.random() * 25;
            const slotStart = 55 + c * colW + 12;
            const slotEnd = 55 + (c + 1) * colW - pw - 12;
            const px = slotStart + Math.random() * Math.max(5, slotEnd - slotStart);
            candidatePlatforms.push({
              x: px,
              y: curY + (c % 2 === 0 ? 0 : -16),
              w: pw,
              h: 16,
              springy: c === 1 && Math.random() < 0.4
            });
          }
        } else {
          const pw = 95 + Math.random() * 35;
          const px = width / 2 - pw / 2 + (Math.random() - 0.5) * 60;
          candidatePlatforms.push({
            x: Math.max(50, Math.min(width - 50 - pw, px)),
            y: curY,
            w: pw,
            h: 16,
            springy: Math.random() < 0.3
          });
        }
      }

      // STRICT CONVERGENCE & OVERLAP VALIDATOR:
      // Guarantee that no platform ever overlaps or converges within 55px horizontally of any platform within 55px vertical distance
      for (const cand of candidatePlatforms) {
        let hasConflict = false;
        for (const ep of this.platforms) {
          const vertDist = Math.abs(cand.y - ep.y);
          if (vertDist < 55) {
            const candRight = cand.x + cand.w;
            const epRight = ep.x + ep.w;
            const horizontalClearance = 55;
            if (!(candRight + horizontalClearance <= ep.x || cand.x >= epRight + horizontalClearance)) {
              hasConflict = true;
              break;
            }
          }
        }
        if (!hasConflict) {
          this.platforms.push(cand);
        }
      }

      // Step up vertically to next tier with comfortable clearance
      curY -= 105 + Math.random() * 25;
    }

    // Top rooftop platform
    this.platforms.push({ x: width / 2 - 130, y: this.goalHeight, w: 260, h: 24, springy: false });

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const startX = 120 + idx * ((width - 240) / Math.max(1, active.length - 1));
      this.climbers.set(p.id, {
        id: p.id,
        x: startX,
        y: groundY,
        vx: 0,
        vy: 0,
        angle: 0,
        isGrounded: true,
        isCharging: false,
        chargePower: 0,
        aimAngle: -Math.PI / 2,
        aimOscillation: 0,
        stunTimer: 0,
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

    this.updateBots(dt, width, height);

    const climberArr = Array.from(this.climbers.values());
    if (climberArr.length === 0) return;

    // 1. Dynamic Camera Tracking with Lookahead & Adaptive Zoom
    // Find highest climber (minY) and lowest climber (maxY)
    let highestY = Infinity;
    let lowestY = -Infinity;
    for (const c of climberArr) {
      if (c.y < highestY) highestY = c.y;
      if (c.y > lowestY) lowestY = c.y;
    }

    // Check if any player and rival/CPU are vertically stacked / directly under each other
    let areUnderEachOther = false;
    for (let i = 0; i < climberArr.length; i++) {
      for (let j = i + 1; j < climberArr.length; j++) {
        const dx = Math.abs(climberArr[i].x - climberArr[j].x);
        const dy = Math.abs(climberArr[i].y - climberArr[j].y);
        // Under each other: narrow horizontal alignment or significant vertical spread
        if (dx < 160 && dy > 50) {
          areUnderEachOther = true;
          break;
        }
      }
      if (areUnderEachOther) break;
    }

    const verticalSpan = Math.max(80, lowestY - highestY);

    // Calculate required zoom to keep both players clearly on screen with generous padding
    // When players/CPU are under each other, zoom out smoothly to frame the entire vertical confrontation
    const verticalPadding = areUnderEachOther ? 340 : 230;
    const requiredViewHeight = verticalSpan + verticalPadding;
    let targetZoom = Math.min(1.0, height / requiredViewHeight);

    if (areUnderEachOther) {
      // Extra zoom out when under each other so the entire stomp trajectory is visible
      targetZoom = Math.min(targetZoom, Math.max(0.45, (height * 0.88) / requiredViewHeight));
    } else {
      targetZoom = Math.max(0.48, targetZoom);
    }

    // Smooth camera zoom
    this.cameraZoom += (targetZoom - this.cameraZoom) * Math.min(1.0, dt * 4.0);

    // Frame camera so both highest and lowest climbers are visible with upward lookahead
    const focusY = highestY * 0.54 + lowestY * 0.46;
    const targetCameraY = focusY - height / 2;
    this.cameraY += (targetCameraY - this.cameraY) * Math.min(1.0, dt * 5.0);

    const gravity = 650;
    const viewHalfHeight = height / (2 * this.cameraZoom);
    const viewBottom = this.cameraY + height / 2 + viewHalfHeight;

    // 2. Process Climbers Physics
    for (const climber of climberArr) {
      if (climber.stunTimer > 0) {
        climber.stunTimer -= dt;
      }

      // Check free fall duration for loop detection
      if (!climber.isGrounded && climber.vy > 100) {
        climber.fallDuration += dt;
      } else if (climber.isGrounded) {
        climber.fallDuration = 0;
      }

      // Lakitu Rescue Trigger: If falling off bottom or stuck in freefall for >1.2s
      const isOffScreenBottom = climber.y > viewBottom + 35;
      const isStuckFalling = climber.fallDuration > 1.2 && climber.vy > 250 && climber.y > highestY + 280;

      if ((isOffScreenBottom || isStuckFalling) && !this.rescuerActive) {
        this.summonCloudRescuer(climber, height);
      }

      // If currently being rescued, let Lakitu handle movement
      if (this.rescuerActive && this.rescuerTargetId === climber.id) {
        continue;
      }

      // Prevent unrescued secondary falling players from plunging into infinity
      if (this.rescuerActive && climber.y > viewBottom + 60) {
        climber.y = viewBottom + 60;
        climber.vy = 0;
      }

      const isPressed = this.input.isPressed(climber.id);
      const justReleased = this.input.justReleased(climber.id);
      const steer = this.input.getSteer(climber.id);
      const action = this.input.isActionPressed(climber.id);
      const throttle = this.input.getThrottle(climber.id);

      // Jump charge trigger: active when action key is held, single-touch pressed, W / Up held, or bot input active
      const isJumpTriggerDown = action || isPressed || throttle > 0.3;

      // Spring charge mechanic:
      if (climber.isGrounded && climber.stunTimer <= 0) {
        if (steer !== 0) {
          climber.aimAngle = -Math.PI / 2 + steer * 0.65;
        } else if (isJumpTriggerDown) {
          climber.aimOscillation += dt * 4.5;
          climber.aimAngle = -Math.PI / 2 + Math.sin(climber.aimOscillation) * 0.75;
        }

        if (isJumpTriggerDown) {
          climber.isCharging = true;
          climber.chargePower = Math.min(1.0, climber.chargePower + dt * 2.0);
        } else if (climber.isCharging && (!isJumpTriggerDown || justReleased)) {
          // Trigger spring leap!
          climber.isCharging = false;
          climber.isGrounded = false;
          const jumpSpeed = 400 + climber.chargePower * 440;
          climber.vx = Math.cos(climber.aimAngle) * jumpSpeed * 0.8;
          climber.vy = Math.sin(climber.aimAngle) * jumpSpeed;
          climber.chargePower = 0;
          this.audio.playBoost();
          this.particles.spawnSparks(climber.x, climber.y + 16, '#FBBF24', 8);
        }
      }

      // Air physics with mid-air steering
      if (!climber.isGrounded) {
        if (steer !== 0) {
          climber.vx += steer * 320 * dt;
        }
        climber.vy += gravity * dt;
        climber.x += climber.vx * dt;
        climber.y += climber.vy * dt;

        // Wall bouncing
        if (climber.x < 24) {
          climber.x = 24;
          climber.vx = Math.abs(climber.vx) * 0.8;
          this.audio.playBounce();
        } else if (climber.x > width - 24) {
          climber.x = width - 24;
          climber.vx = -Math.abs(climber.vx) * 0.8;
          this.audio.playBounce();
        }

        // Platform landing detection (only when falling downwards)
        if (climber.vy > 0) {
          for (const plat of this.platforms) {
            if (
              climber.x >= plat.x &&
              climber.x <= plat.x + plat.w &&
              climber.y + 18 >= plat.y &&
              climber.y + 18 <= plat.y + plat.h + climber.vy * dt * 1.5
            ) {
              if (plat.springy) {
                // Super trampoline bounce!
                climber.vy = -600;
                this.audio.playBounce();
                this.particles.showFloatingText('SPRING BOUNCE!', climber.x, climber.y - 20, '#10B981');
                this.particles.spawnSparks(climber.x, plat.y, '#10B981', 14);
              } else {
                climber.isGrounded = true;
                climber.y = plat.y - 18;
                climber.vx = 0;
                climber.vy = 0;
                climber.fallDuration = 0;
                this.audio.playTap();
              }
              break;
            }
          }
        }

        // Track highest ascent and calculate real-time calibrated meters
        if (climber.y < climber.highestY) {
          climber.highestY = climber.y;
        }
        const altitudeMeters = Math.max(0, Math.floor((height - 85 - climber.y) / 10));
        climber.score = Math.max(climber.score, altitudeMeters);

        // Reached rooftop goal
        if (climber.y <= this.goalHeight + 20) {
          this.isFinished = true;
          this.audio.playFanfare();
          if (climber.id === 0) {
            AchievementManager.getInstance().unlock('sumo_master');
          }
        }
      }
    }

    // 3. Update Lakitu Cloud Rescuer
    this.updateCloudRescuer(dt, width);

    // 4. Head bop and Sumo bump collisions
    for (let i = 0; i < climberArr.length; i++) {
      for (let j = 0; j < climberArr.length; j++) {
        if (i === j) continue;
        const c1 = climberArr[i];
        const c2 = climberArr[j];

        // Head bop collision (bouncing on rival's head)
        if (c1.vy > 100 && Math.hypot(c1.x - c2.x, (c1.y + 16) - (c2.y - 16)) < 26) {
          c1.vy = -540;
          c2.stunTimer = 1.2;
          this.audio.playExplosion();
          this.particles.showFloatingText('HEAD BOP!', c2.x, c2.y - 25, '#F59E0B', 22);
          this.particles.spawnSparks(c2.x, c2.y - 16, '#F59E0B', 15);
        } else {
          // Horizontal sumo body bump
          const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
          if (dist < 36 && dist > 0) {
            const pushDir = c1.x < c2.x ? -1 : 1;
            const overlap = (36 - dist) / 2;
            c1.x -= pushDir * overlap;
            c2.x += pushDir * overlap;
            const pushForce = Math.max(180, Math.abs(c1.vx) + Math.abs(c2.vx) + 140);
            c1.vx = -pushDir * pushForce;
            c2.vx = pushDir * pushForce;
            this.audio.playBounce();
            this.particles.spawnSparks((c1.x + c2.x) / 2, (c1.y + c2.y) / 2, '#F59E0B', 8);
            this.particles.showFloatingText('SUMO BUMP!', (c1.x + c2.x) / 2, Math.min(c1.y, c2.y) - 20, '#EF4444', 16);
          }
        }
      }
    }
  }

  private summonCloudRescuer(climber: SumoClimber, height: number) {
    if (this.rescuerActive) return;

    // Find the true nearest safe platform in 2D space to climber's fall position
    let candidatePlat: SumoPlatform = this.platforms[0];
    let minD = Infinity;

    for (const plat of this.platforms) {
      // Don't rescue directly onto rooftop trophy platform unless already right below rooftop
      if (plat.y <= this.goalHeight + 30 && climber.y > this.goalHeight + 180) {
        continue;
      }

      const platCenterX = plat.x + plat.w / 2;
      const platTopY = plat.y - 18;

      const dx = platCenterX - climber.x;
      const dy = platTopY - climber.y;

      // Platform above climber (dy < 0) gets slight natural priority
      const vertWeight = dy <= 0 ? 0.95 : 1.4;
      const dist = Math.hypot(dx, Math.abs(dy) * vertWeight);

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

  private updateCloudRescuer(dt: number, width: number) {
    if (!this.rescuerActive || this.rescuerTargetId === null) return;

    const climber = this.climbers.get(this.rescuerTargetId);
    if (!climber) {
      this.rescuerActive = false;
      this.rescuerTargetId = null;
      this.rescuerTargetPlat = null;
      return;
    }

    if (this.rescuerState === 'descending') {
      // Cloud swoops down swiftly to catch climber
      this.rescuerY += 460 * dt;
      this.rescuerX += (climber.x - this.rescuerX) * Math.min(1.0, dt * 10);

      // Halt runaway fall while cloud intercepts
      climber.vy = Math.min(climber.vy, 90);

      const distToClimber = Math.hypot(this.rescuerX - climber.x, this.rescuerY - (climber.y - 45));
      if (this.rescuerY >= climber.y - 45 || distToClimber < 32) {
        this.rescuerState = 'lifting';
        this.audio.playTap();
      }
    } else if (this.rescuerState === 'lifting') {
      // Lift climber AND navigate horizontally directly to target platform center
      const targetX = this.rescuerTargetPlatX;
      const targetY = this.rescuerTargetPlatY - 45;

      const dx = targetX - this.rescuerX;
      const dy = targetY - this.rescuerY;
      const dist = Math.hypot(dx, dy);

      // Smooth swift flight towards the platform
      const flightSpeed = 380;
      if (dist > 1) {
        this.rescuerX += (dx / dist) * Math.min(flightSpeed * dt, Math.abs(dx));
        this.rescuerY += (dy / dist) * Math.min(flightSpeed * dt, Math.abs(dy));
      }

      // Lock climber firmly to cloud's fishing hook
      climber.x = this.rescuerX;
      climber.y = this.rescuerY + 45;
      climber.vx = 0;
      climber.vy = 0;

      // Safe landing drop-off at nearest platform
      if (dist < 14 || (Math.abs(dy) < 8 && Math.abs(dx) < 14)) {
        climber.x = targetX;
        climber.y = this.rescuerTargetPlatY;
        climber.isGrounded = true;
        climber.fallDuration = 0;
        climber.stunTimer = 0.35;
        climber.vx = 0;
        climber.vy = 0;

        this.audio.playTap();
        this.particles.showFloatingText('CLOUD RESCUE!', climber.x, climber.y - 28, '#38BDF8', 20);
        this.particles.spawnSparks(climber.x, climber.y, '#38BDF8', 16);

        this.rescuerState = 'leaving';
      }
    } else if (this.rescuerState === 'leaving') {
      // Cloud waves and flies up off-screen
      this.rescuerY -= 480 * dt;
      if (this.rescuerY < this.cameraY - 140) {
        this.rescuerActive = false;
        this.rescuerTargetId = null;
        this.rescuerTargetPlat = null;
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const c = this.climbers.get(botId);
    if (!c || c.stunTimer > 0) return;

    if (c.isGrounded) {
      // Find candidate platforms directly above climber within jumping reach
      const candidates = this.platforms.filter((p) => p.y < c.y - 25 && p.y >= c.y - 300);

      // Prioritize spring launchpads or closest platform vertically above (largest y coordinate less than c.y)
      let targetPlat: SumoPlatform | null = null;
      const springPlat = candidates.find((p) => p.springy && Math.abs(p.x + p.w / 2 - c.x) < 220);

      if (springPlat && difficulty !== 'bot_easy') {
        targetPlat = springPlat;
      } else if (candidates.length > 0) {
        // Pick the closest reachable platform vertically above (curr.y > prev.y)
        targetPlat = candidates.reduce((prev, curr) => (curr.y > prev.y ? curr : prev));
      }

      const targetX = targetPlat ? targetPlat.x + targetPlat.w / 2 : width / 2;
      const dx = targetX - c.x;
      const dy = targetPlat ? c.y - targetPlat.y : 130;

      // Analog steer towards platform center
      let steer = Math.max(-1, Math.min(1, dx / 70));
      if (Math.abs(dx) < 14) steer = 0;

      // Physics-derived launch power needed to reach platform elevation (exact gravity = 650)
      const targetLaunchVy = Math.sqrt(2 * 650 * (dy + 30));
      const aimFactor = Math.abs(Math.sin(-Math.PI / 2 + steer * 0.65));
      const targetSpeed = targetLaunchVy / Math.max(0.6, aimFactor);
      let desiredPower = Math.max(0.25, Math.min(1.0, (targetSpeed - 400) / 440));

      if (difficulty === 'bot_hard') {
        desiredPower += (Math.random() - 0.5) * 0.05;
      } else if (difficulty === 'bot_normal') {
        desiredPower += (Math.random() - 0.5) * 0.12;
      } else {
        desiredPower += (Math.random() - 0.5) * 0.28;
      }
      desiredPower = Math.max(0.2, Math.min(1.0, desiredPower));

      if (!c.isCharging) {
        // Begin charging jump with action = true so isJumpTriggerDown activates
        this.input.setBotInput(botId, true, steer, 0, true);
      } else if (c.chargePower >= desiredPower) {
        // Release spring leap!
        this.input.setBotInput(botId, false, steer, 0, false);
      } else {
        // Continue charging towards target
        this.input.setBotInput(botId, true, steer, 0, true);
      }
    } else {
      // Airborne flight control & landing correction
      let steer = 0;

      if (c.vy > 0) {
        // Descending: steer towards landing platform underneath
        const platformsBelow = this.platforms.filter((p) => p.y >= c.y && p.y <= c.y + 260);
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
          steer = Math.max(-1, Math.min(1, (pCenter - c.x) / 45));
        }
      } else if (difficulty === 'bot_hard') {
        // Ascending / Apex: Target rival heads for a head bop stomp
        for (const opp of this.climbers.values()) {
          if (opp.id !== botId && opp.y > c.y && opp.y < c.y + 100) {
            if (Math.abs(c.x - opp.x) < 70) {
              steer = opp.x > c.x ? 0.8 : -0.8;
              break;
            }
          }
        }
      }

      this.input.setBotInput(botId, false, steer, 0, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // Night Sky Backdrop Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#0F0C20');
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
    ctx.arc(width * 0.82, 85, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Parallax City Skyline Silhouettes in Background
    const parallaxY = -this.cameraY * 0.25;
    ctx.save();
    ctx.fillStyle = '#0B0A1A';
    // Back skyline buildings
    const buildingWidths = [90, 110, 75, 130, 95, 120, 85, 105, 140, 90, 110, 80];
    let curBx = 0;
    for (let i = 0; i < buildingWidths.length; i++) {
      const bw = buildingWidths[i];
      const bh = 220 + ((i * 47) % 180);
      const by = height - bh + parallaxY;
      ctx.fillRect(curBx, by, bw - 6, bh + 400);

      // Window lights
      ctx.fillStyle = (i % 2 === 0) ? 'rgba(253, 224, 71, 0.4)' : 'rgba(56, 189, 248, 0.35)';
      for (let wy = by + 20; wy < by + bh - 30; wy += 22) {
        for (let wx = curBx + 12; wx < curBx + bw - 20; wx += 18) {
          if ((wx + wy) % 5 !== 0) {
            ctx.fillRect(wx, wy, 8, 12);
          }
        }
      }
      ctx.fillStyle = '#0B0A1A';
      curBx += bw;
    }
    ctx.restore();

    ctx.save();
    // Dynamic lookahead and zoom framing
    ctx.translate(width / 2, height / 2);
    ctx.scale(this.cameraZoom, this.cameraZoom);
    ctx.translate(-width / 2, -height / 2);
    ctx.translate(0, -this.cameraY);

    // 1. Skyscraper Scaffolding Columns on Left and Right borders
    ctx.save();
    const towerTopY = this.goalHeight - 60;
    const towerBottomY = height - 40;

    [10, width - 30].forEach((gx) => {
      // Main vertical steel beams
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(gx, towerTopY, 20, towerBottomY - towerTopY);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(gx, towerTopY, 20, towerBottomY - towerTopY);

      // Diagonal cross-truss lattice bracing
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
      ctx.lineWidth = 1.2;
      for (let ty = towerBottomY; ty > towerTopY; ty -= 55) {
        ctx.beginPath();
        ctx.moveTo(gx, ty);
        ctx.lineTo(gx + 20, ty - 55);
        ctx.moveTo(gx + 20, ty);
        ctx.lineTo(gx, ty - 55);
        ctx.stroke();
      }

      // Neon warning aviation beacons every 280px
      for (let by = towerBottomY - 120; by > towerTopY; by -= 280) {
        const beaconPulse = Math.sin(performance.now() * 0.005 + by) > 0.3;
        ctx.save();
        ctx.fillStyle = beaconPulse ? '#EF4444' : '#7F1D1D';
        if (beaconPulse) {
          ctx.shadowColor = '#EF4444';
          ctx.shadowBlur = 10;
        }
        ctx.beginPath();
        ctx.arc(gx + 10, by, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });
    ctx.restore();

    // 2. Dynamic Vertical Stomp Reticle when players/CPU are under each other
    const climberArr = Array.from(this.climbers.values());
    for (let i = 0; i < climberArr.length; i++) {
      for (let j = 0; j < climberArr.length; j++) {
        if (i === j) continue;
        const upper = climberArr[i];
        const lower = climberArr[j];
        if (upper.y < lower.y - 30 && lower.y - upper.y < 420 && Math.abs(upper.x - lower.x) < 75) {
          ctx.save();
          // Animated vertical guide line
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(upper.x, upper.y + 20);
          ctx.lineTo(lower.x, lower.y - 20);
          ctx.stroke();
          ctx.setLineDash([]);

          // Stomp target reticle directly above lower rival
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(lower.x, lower.y - 22, 12, 0, Math.PI * 2);
          ctx.stroke();

          // Reticle crosshair ticks
          ctx.beginPath();
          ctx.moveTo(lower.x - 16, lower.y - 22);
          ctx.lineTo(lower.x + 16, lower.y - 22);
          ctx.moveTo(lower.x, lower.y - 38);
          ctx.lineTo(lower.x, lower.y - 6);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Platforms
    for (const plat of this.platforms) {
      if (plat.springy) {
        // High-tech Neon Spring Launchpad
        ctx.save();
        ctx.shadowColor = '#10B981';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#065F46';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);

        // Neon emerald edge
        ctx.strokeStyle = '#34D399';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        ctx.restore();

        // Hazard Chevron Stripes
        ctx.save();
        ctx.beginPath();
        ctx.rect(plat.x, plat.y, plat.w, plat.h);
        ctx.clip();
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 3;
        for (let sx = plat.x - 20; sx < plat.x + plat.w + 20; sx += 18) {
          ctx.beginPath();
          ctx.moveTo(sx, plat.y);
          ctx.lineTo(sx + 10, plat.y + plat.h);
          ctx.stroke();
        }
        ctx.restore();

        // Spring Label
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 10px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ SPRING ⚡', plat.x + plat.w / 2, plat.y + 12);
      } else {
        // Heavy Industrial Steel Scaffolding Girder
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

        // Girder top highlight plate
        ctx.fillStyle = '#64748B';
        ctx.fillRect(plat.x + 2, plat.y + 1, plat.w - 4, 3);

        // Steel rivets
        ctx.fillStyle = '#94A3B8';
        for (let rx = plat.x + 8; rx < plat.x + plat.w - 4; rx += 24) {
          ctx.beginPath();
          ctx.arc(rx, plat.y + plat.h / 2, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Top Rooftop Helipad & Golden Trophy
    ctx.save();
    ctx.fillStyle = '#F59E0B';
    ctx.shadowColor = '#FBBF24';
    ctx.shadowBlur = 18;
    ctx.font = '900 24px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    const bannerTitle = this.isNoTimeLimit
      ? `🏆 SUMMIT CONQUERED: ${this.targetMeters}m! 🏆`
      : '🏆 ROOFTOP SUMO CHAMPION 🏆';
    ctx.fillText(bannerTitle, width / 2, this.goalHeight - 20);
    ctx.restore();

    // Climbers
    for (const c of this.climbers.values()) {
      const p = this.players[c.id];

      ctx.save();
      ctx.translate(c.x, c.y);

      // Aim trajectory indicator if charging
      if (c.isCharging) {
        ctx.save();
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const aimLen = 55 + c.chargePower * 80;
        ctx.lineTo(Math.cos(c.aimAngle) * aimLen, Math.sin(c.aimAngle) * aimLen);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Mascot Body with Custom Equipped Skins and Expressive Face
      const mood = c.stunTimer > 0 || c.fallDuration > 0.4 ? 'shocked' : c.isCharging ? 'focused' : c.vy < -100 ? 'triumph' : 'idle';
      this.drawPlayerMascot(ctx, c.id, 0, 0, 20, mood, performance.now() * 0.001, c.angle);

      // Black Sumo Belt (Mawashi) with golden buckle
      ctx.fillStyle = '#18181B';
      ctx.fillRect(-15, 6, 30, 6);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(-5, 6.5, 10, 5); // Golden Mawashi buckle

      // Stun stars if stunned
      if (c.stunTimer > 0) {
        ctx.fillStyle = '#FACC15';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★ ★', 0, -26);
      }

      ctx.restore();

      // Height score pill
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(c.x - 22, c.y - 36, 44, 16);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(c.x - 22, c.y - 36, 44, 16);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${c.score}m`, c.x, c.y - 24);
      ctx.restore();
    }

    // Render Lakitu Cloud Rescuer
    if (this.rescuerActive) {
      this.renderCloudRescuer(ctx);
    }

    ctx.restore();
    ctx.restore();

    // Render Tactical Skyscraper Minimap Radar showing both (or up to 4) players calibrating in real-time
    this.renderTowerRadar(ctx, width, height);
  }

  private renderTowerRadar(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const activeClimbers = Array.from(this.climbers.values());
    if (activeClimbers.length === 0) return;

    ctx.save();

    // Responsive dimensions for tactical tower map
    const mapW = 64;
    const mapH = Math.min(390, Math.max(260, height - 120));
    const mapX = width - mapW - 14;
    const mapY = (height - mapH) / 2;

    // 1. Radar Glass Background Container
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(mapX, mapY, mapW, mapH, 12);
    else ctx.rect(mapX, mapY, mapW, mapH);
    ctx.fill();

    // Neon Border with subtle cyan glow
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Map Header Pill
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(mapX + 6, mapY + 6, mapW - 12, 18, 6);
    else ctx.rect(mapX + 6, mapY + 6, mapW - 12, 18);
    ctx.fill();
    ctx.fillStyle = '#38BDF8';
    ctx.font = '900 9px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MAP', mapX + mapW / 2, mapY + 15);

    // 2. Vertical Skyscraper Tower Track
    const trackTopY = mapY + 38;
    const trackBottomY = mapY + mapH - 24;
    const trackH = trackBottomY - trackTopY;
    const groundWorldY = height - 60;
    const totalWorldH = groundWorldY - this.goalHeight; // ~2800px

    const worldToMapY = (wy: number) => {
      const progress = (groundWorldY - wy) / totalWorldH;
      const clamped = Math.max(0, Math.min(1, progress));
      return trackBottomY - clamped * trackH;
    };

    // Central elevator / tower shaft
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(mapX + mapW / 2 - 4, trackTopY, 8, trackH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX + mapW / 2 - 4, trackTopY, 8, trackH);

    // Altitude tick marks and labels at 25%, 50%, 75%
    const maxAltitudeDisplay = this.isNoTimeLimit ? this.targetMeters : 280;
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

    // Top Summit Goal Trophy Emblem
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

    // Bottom Ground Base Plate
    ctx.fillStyle = '#475569';
    ctx.fillRect(mapX + 10, trackBottomY + 2, mapW - 20, 5);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '800 8px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('0m', mapX + mapW / 2, trackBottomY + 14);

    // 3. Camera Viewport Window on Radar
    const halfViewH = height / (2 * this.cameraZoom);
    const viewCenter = this.cameraY + height / 2;
    const camTopY = worldToMapY(viewCenter - halfViewH);
    const camBottomY = worldToMapY(viewCenter + halfViewH);
    const camBoxH = Math.max(14, camBottomY - camTopY);

    ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.fillRect(mapX + 4, camTopY, mapW - 8, camBoxH);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(mapX + 4, camTopY, mapW - 8, camBoxH);
    ctx.setLineDash([]);

    // 4. Render All Players (both or up to 4) Calibrating as they go
    const sortedClimbers = [...activeClimbers].sort((a, b) => a.y - b.y);
    const leaderId = sortedClimbers.length > 0 ? sortedClimbers[0].id : null;

    activeClimbers.forEach((c) => {
      const p = this.players[c.id];
      const pMapY = worldToMapY(c.y);
      const normX = Math.max(0, Math.min(1, c.x / width));
      const pMapX = mapX + 16 + normX * (mapW - 32);

      const altMeters = Math.max(0, Math.floor((groundWorldY - c.y) / 10));

      // Animated pulse ring when charging or leaping
      if (c.isCharging || Math.abs(c.vy) > 200) {
        const pulse = (performance.now() * 0.006) % 1;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5 * (1 - pulse);
        ctx.beginPath();
        ctx.arc(pMapX, pMapY, 7 + pulse * 9, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Player Beacon Dot
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

      // Heraldic Shape / Player ID
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 7.5px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${c.id + 1}`, pMapX, pMapY);

      // Calibrating Altitude Badge Pill (Left of Map)
      const badgeW = 60;
      const badgeH = 18;
      const badgeX = mapX - badgeW - 6;
      const badgeY = Math.max(mapY + 6, Math.min(mapY + mapH - 24, pMapY - 9));

      // Leader line connecting badge to beacon
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(badgeX + badgeW, badgeY + badgeH / 2);
      ctx.lineTo(pMapX - 7, pMapY);
      ctx.stroke();

      // Badge Container
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5);
      else ctx.rect(badgeX, badgeY, badgeW, badgeH);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Badge Text: "P1: 42m" or "P1: ★ 42m" if leading
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

    // Fluffy cloud body
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.arc(-14, 4, 15, 0, Math.PI * 2);
    ctx.arc(14, 4, 15, 0, Math.PI * 2);
    ctx.arc(-24, 8, 10, 0, Math.PI * 2);
    ctx.arc(24, 8, 10, 0, Math.PI * 2);
    ctx.fill();

    // Smiling face with pilot goggles
    ctx.fillStyle = '#0284C7';
    ctx.fillRect(-10, -8, 8, 6);
    ctx.fillRect(2, -8, 8, 6);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(-9, -7, 6, 4);
    ctx.fillRect(3, -7, 6, 4);

    // Goggles strap
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-16, -5);
    ctx.lineTo(16, -5);
    ctx.stroke();

    // Smile
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 2, 6, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Fishing rod and hook
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(12, -2);
    ctx.lineTo(26, -18);
    ctx.stroke();

    // Fishing line dangling down to hook
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(26, -18);
    ctx.lineTo(0, 40);
    ctx.stroke();

    // Metal hook
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
