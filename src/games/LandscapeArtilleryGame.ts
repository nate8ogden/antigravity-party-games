import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export interface ArtilleryPlayer {
  id: PlayerId;
  name: string;
  color: string;
  x: number;
  y: number; // surface Y (ground level at character base)
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  facing: 1 | -1; // 1 = right, -1 = left
  aimAngleDeg: number; // elevation angle in degrees (10° to 170°)
  power: number; // 0.1 to 1.0 (slingshot pull-back power)
  isPullingBack: boolean;
  pullBackTime: number;
  headshots: number;
  kills: number;
  score: number;
}

export interface ArtilleryProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  ownerId: PlayerId;
  trail: { x: number; y: number; alpha: number; size: number }[];
  life: number;
}

export interface FloatingCombatText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  vy: number;
}

export interface TerrainCrater {
  x: number;
  y: number;
  radius: number;
}

export type ArtilleryTurnState =
  | 'PAN_TO_PLAYER'
  | 'AIMING'
  | 'FIRING'
  | 'PROJECTILE_FLYING'
  | 'IMPACT_PAUSE'
  | 'NEXT_TURN_DELAY';

export class LandscapeArtilleryGame extends BaseGame {
  private playersState: Map<PlayerId, ArtilleryPlayer> = new Map();
  private terrainHeights: number[] = [];
  private craters: TerrainCrater[] = [];
  private projectile: ArtilleryProjectile | null = null;
  private floatingTexts: FloatingCombatText[] = [];
  private textCounter: number = 0;

  // Turn Management
  private activePlayerIndex: number = 0;
  private turnState: ArtilleryTurnState = 'PAN_TO_PLAYER';
  private turnTimer: number = 25.0; // 25s per turn
  private stateTimer: number = 0;
  private destructionOrder: PlayerId[] = [];

  // Wind & Physics
  private wind: number = 0; // px/s²
  private gravity: number = 460; // px/s²

  // Camera Zoom & Pan System
  private camera = {
    x: 480,
    y: 300,
    zoom: 1.0,
    targetX: 480,
    targetY: 300,
    targetZoom: 1.0
  };

  // Screen Shake
  private screenShake: number = 0;

  // Last Damage Event for deterministic test verification
  public lastDamageEvent: {
    targetId: PlayerId;
    hitType: 'HEADSHOT' | 'BODY' | 'LEG' | 'SPLASH';
    damage: number;
  } | null = null;

  // Pointer / Mouse Drag tracking for Slingshot Pull-Back
  private isPointerDragging: boolean = false;
  private pointerStartX: number = 0;
  private pointerStartY: number = 0;
  private pointerCurrentX: number = 0;
  private pointerCurrentY: number = 0;

  // Bot AI decision cache
  private botAimTargetAngle: number = 45;
  private botAimTargetPower: number = 0.6;
  private botAimHoldTimer: number = 0;

  // Pointer listener references
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private boundPointerMove: ((e: PointerEvent) => void) | null = null;
  private boundPointerUp: (() => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.bindPointerEvents();
  }

  private bindPointerEvents(): void {
    if (typeof window === 'undefined') return;
    const canvas = this.input.getCanvas();
    if (!canvas) return;

    this.boundPointerDown = (e: PointerEvent) => {
      if (this.isFinished || this.turnState !== 'AIMING') return;
      const activeP = this.getActivePlayer();
      if (!activeP || !activeP.alive) return;

      const rect = canvas.getBoundingClientRect();
      const clickScreenX = (e.clientX - rect.left) * (canvas.width / rect.width);
      const clickScreenY = (e.clientY - rect.top) * (canvas.height / rect.height);

      // Convert screen coords to world coords
      const worldX = (clickScreenX - canvas.width / 2) / this.camera.zoom + this.camera.x;
      const worldY = (clickScreenY - canvas.height / 2) / this.camera.zoom + this.camera.y;

      // Check if clicked near active player or general canvas
      this.isPointerDragging = true;
      this.pointerStartX = worldX;
      this.pointerStartY = worldY;
      this.pointerCurrentX = worldX;
      this.pointerCurrentY = worldY;
      activeP.isPullingBack = true;
    };
    canvas.addEventListener('pointerdown', this.boundPointerDown);

    this.boundPointerMove = (e: PointerEvent) => {
      if (!this.isPointerDragging) return;
      const c = this.input.getCanvas();
      if (!c) return;

      const rect = c.getBoundingClientRect();
      const screenX = (e.clientX - rect.left) * (c.width / rect.width);
      const screenY = (e.clientY - rect.top) * (c.height / rect.height);

      const worldX = (screenX - c.width / 2) / this.camera.zoom + this.camera.x;
      const worldY = (screenY - c.height / 2) / this.camera.zoom + this.camera.y;

      this.pointerCurrentX = worldX;
      this.pointerCurrentY = worldY;

      const activeP = this.getActivePlayer();
      if (activeP && activeP.alive) {
        // Drag vector: dragging down-left shoots up-right (slingshot)
        const dx = this.pointerStartX - worldX;
        const dy = this.pointerStartY - worldY;
        const dist = Math.hypot(dx, dy);

        if (dist > 8) {
          // Angle in degrees from 10° to 170°
          let rad = Math.atan2(dy, dx);
          // Normalize to positive angles (above ground)
          if (rad < 0) rad = 0;
          let deg = (rad * 180) / Math.PI;
          deg = Math.max(10, Math.min(170, deg));

          activeP.aimAngleDeg = Math.round(deg);
          activeP.facing = activeP.aimAngleDeg <= 90 ? 1 : -1;
          activeP.power = Math.max(0.15, Math.min(1.0, dist / 140));
        }
      }
    };
    window.addEventListener('pointermove', this.boundPointerMove);

    this.boundPointerUp = () => {
      if (!this.isPointerDragging) return;
      this.isPointerDragging = false;
      const activeP = this.getActivePlayer();
      if (activeP && activeP.alive && this.turnState === 'AIMING') {
        activeP.isPullingBack = false;
        this.fireShot(activeP);
      }
    };
    window.addEventListener('pointerup', this.boundPointerUp);
  }

  public override destroy(): void {
    super.destroy();
    if (typeof window !== 'undefined') {
      const canvas = this.input.getCanvas();
      if (canvas && this.boundPointerDown) {
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
        this.boundPointerDown = null;
      }
      if (this.boundPointerMove) {
        window.removeEventListener('pointermove', this.boundPointerMove);
        this.boundPointerMove = null;
      }
      if (this.boundPointerUp) {
        window.removeEventListener('pointerup', this.boundPointerUp);
        this.boundPointerUp = null;
      }
    }
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 180;
    this.isFinished = false;
    this.playersState.clear();
    this.craters = [];
    this.projectile = null;
    this.floatingTexts = [];
    this.destructionOrder = [];
    this.screenShake = 0;
    this.lastDamageEvent = null;
    this.activePlayerIndex = 0;
    this.turnState = 'PAN_TO_PLAYER';
    this.stateTimer = 0;
    this.turnTimer = 25.0;

    // Shift initial wind (-30 to +30 px/s²)
    this.generateNewWind();

    // Generate Random Procedural Landscape Heightmap
    this.generateProceduralTerrain(width, height);

    // Place 2 to 4 Players across terrain
    const active = this.getActivePlayers();
    const count = active.length;

    // Spacing ratios across terrain width
    const spawnRatios =
      count === 2
        ? [0.22, 0.78]
        : count === 3
        ? [0.18, 0.5, 0.82]
        : [0.14, 0.38, 0.62, 0.86];

    active.forEach((p, idx) => {
      const rx = spawnRatios[idx % spawnRatios.length];
      const spawnX = Math.round(width * rx);
      const groundY = this.getTerrainHeightAt(spawnX);
      const facing: 1 | -1 = idx === 0 ? 1 : idx === count - 1 ? -1 : idx % 2 === 0 ? 1 : -1;
      const defaultAngle = facing === 1 ? 45 : 135;

      this.playersState.set(p.id, {
        id: p.id,
        name: p.name,
        color: p.color,
        x: spawnX,
        y: groundY,
        vx: 0,
        vy: 0,
        hp: 100,
        maxHp: 100,
        alive: true,
        facing,
        aimAngleDeg: defaultAngle,
        power: 0.6,
        isPullingBack: false,
        pullBackTime: 0,
        headshots: 0,
        kills: 0,
        score: 0
      });
    });

    // Initialize Camera to center
    this.camera.x = width / 2;
    this.camera.y = height / 2;
    this.camera.zoom = 1.0;
    this.camera.targetX = width / 2;
    this.camera.targetY = height / 2;
    this.camera.targetZoom = 1.0;

    // Pan immediately to player 1
    const p1 = this.getActivePlayer();
    if (p1) {
      this.camera.targetX = p1.x;
      this.camera.targetY = p1.y - 25;
      this.camera.targetZoom = 1.45;
    }

    this.syncDebug();
  }

  private generateProceduralTerrain(width: number, height: number): void {
    this.terrainHeights = new Array(Math.ceil(width) + 1);

    const baseHeight = height * 0.65;
    const waveSeed1 = Math.random() * 100;
    const waveSeed2 = Math.random() * 100;
    const waveSeed3 = Math.random() * 100;

    for (let x = 0; x <= width; x++) {
      // 3 sinusoidal octaves with gentle slopes and plateaus
      const h1 = Math.sin((x / width) * Math.PI * 2.2 + waveSeed1) * (height * 0.12);
      const h2 = Math.sin((x / width) * Math.PI * 4.8 + waveSeed2) * (height * 0.05);
      const h3 = Math.cos((x / width) * Math.PI * 7.5 + waveSeed3) * (height * 0.02);

      const surfaceY = baseHeight + h1 + h2 + h3;
      // Clamp to stay nicely within viewable arena
      this.terrainHeights[x] = Math.max(height * 0.35, Math.min(height * 0.82, surfaceY));
    }
  }

  public getTerrainHeightAt(x: number): number {
    const clampedX = Math.max(0, Math.min(this.terrainHeights.length - 1, Math.floor(x)));
    return this.terrainHeights[clampedX] ?? 400;
  }

  private carveCrater(cx: number, cy: number, radius: number): void {
    this.craters.push({ x: cx, y: cy, radius });
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(this.terrainHeights.length - 1, Math.ceil(cx + radius));

    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = Math.sqrt(Math.max(0, radius * radius - dx * dx));
      const craterFloor = cy + dy;
      // Deform downward
      if (craterFloor > this.terrainHeights[x]) {
        this.terrainHeights[x] = Math.max(this.terrainHeights[x], craterFloor);
      }
    }
  }

  private generateNewWind(): void {
    // Wind between -32 and +32 px/s²
    this.wind = Math.round((Math.random() - 0.5) * 64);
  }

  public getActivePlayer(): ArtilleryPlayer | null {
    const active = this.getActivePlayers();
    if (active.length === 0) return null;
    const pid = active[this.activePlayerIndex % active.length].id;
    return this.playersState.get(pid) ?? null;
  }

  public syncDebug(): void {
    if (typeof window !== 'undefined') {
      (window as any).__LANDSCAPE_ARTILLERY_DEBUG__ = {
        players: Array.from(this.playersState.values()),
        activePlayerIndex: this.activePlayerIndex,
        activePlayerId: this.getActivePlayer()?.id ?? null,
        turnState: this.turnState,
        turnTimer: this.turnTimer,
        wind: this.wind,
        projectile: this.projectile,
        floatingTexts: this.floatingTexts,
        lastDamageEvent: this.lastDamageEvent,
        camera: { ...this.camera },
        craters: this.craters,
        isFinished: this.isFinished
      };
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.stateTimer += dt;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    this.syncDebug();

    // Process Turn State Machine
    switch (this.turnState) {
      case 'PAN_TO_PLAYER':
        this.updatePanToPlayer(dt);
        break;

      case 'AIMING':
        this.updateAiming(dt, width, height);
        break;

      case 'FIRING':
        this.updateFiring(dt);
        break;

      case 'PROJECTILE_FLYING':
        this.updateProjectile(dt, width, height);
        break;

      case 'IMPACT_PAUSE':
        this.updateImpactPause(dt, width, height);
        break;

      case 'NEXT_TURN_DELAY':
        this.updateNextTurnDelay(dt, width, height);
        break;
    }

    // Settle any player standing over a carved crater
    for (const ps of this.playersState.values()) {
      if (!ps.alive) continue;
      const targetY = this.getTerrainHeightAt(ps.x);
      if (ps.y < targetY) {
        ps.vy += this.gravity * dt;
        ps.y = Math.min(targetY, ps.y + ps.vy * dt);
        if (ps.y >= targetY) {
          ps.vy = 0;
          ps.y = targetY;
        }
      }
    }

    // Update Floating Combat Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life += dt;
      ft.y += ft.vy * dt;
      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Update Camera smoothly towards target
    const camLerp = 1 - Math.exp(-6.5 * dt);
    this.camera.x += (this.camera.targetX - this.camera.x) * camLerp;
    this.camera.y += (this.camera.targetY - this.camera.y) * camLerp;
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * camLerp;

    // Check round timeout
    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private updatePanToPlayer(dt: number): void {
    const activeP = this.getActivePlayer();
    if (!activeP || !activeP.alive) {
      this.advanceToNextPlayer();
      return;
    }

    // Smoothly zoom in onto active player
    this.camera.targetX = activeP.x;
    this.camera.targetY = activeP.y - 30;
    this.camera.targetZoom = 1.45;

    const dx = Math.abs(this.camera.x - this.camera.targetX);
    const dy = Math.abs(this.camera.y - this.camera.targetY);

    if (this.stateTimer > 0.4 || (dx < 12 && dy < 12)) {
      this.turnState = 'AIMING';
      this.turnTimer = 25.0;
      this.stateTimer = 0;
    }
  }

  private updateAiming(dt: number, width: number, height: number): void {
    const activeP = this.getActivePlayer();
    if (!activeP || !activeP.alive) {
      this.advanceToNextPlayer();
      return;
    }

    this.turnTimer = Math.max(0, this.turnTimer - dt);

    // Keep camera focused on active player
    this.camera.targetX = activeP.x;
    this.camera.targetY = activeP.y - 30;
    this.camera.targetZoom = 1.45;

    // Bot AI update if active player is a bot
    const activeConfig = this.getActivePlayers().find((p) => p.id === activeP.id);
    const isBot = activeConfig ? activeConfig.type !== 'human' : false;

    if (isBot) {
      this.updateBots(dt, width, height);
    } else {
      // Human Keyboard Controls
      // 1. Aim Left/Right: Steer shifts angle
      const steer = this.input.getSteer(activeP.id);
      if (steer !== 0) {
        // Adjust angle in degrees (steer right: decreases angle towards right 10°, steer left: increases angle towards 170°)
        activeP.aimAngleDeg -= steer * 55 * dt;
        activeP.aimAngleDeg = Math.max(10, Math.min(170, activeP.aimAngleDeg));
        activeP.facing = activeP.aimAngleDeg <= 90 ? 1 : -1;
      }

      // 2. Power Pull-Back: Throttle Down pulls back (+power), Throttle Up pushes forward (-power)
      const throttle = this.input.getThrottle(activeP.id); // +1 up, -1 down
      if (throttle !== 0) {
        // Pull back increases power
        activeP.power -= throttle * 0.45 * dt;
        activeP.power = Math.max(0.15, Math.min(1.0, activeP.power));
      }

      // 3. Action button: Hold to pull back, release to fire
      const isAction = this.input.isActionPressed(activeP.id);
      if (isAction) {
        activeP.isPullingBack = true;
        activeP.pullBackTime += dt;
        // Oscillate/ramp power smoothly
        const ramp = activeP.pullBackTime / 1.2;
        if (ramp <= 1.0) {
          activeP.power = 0.2 + ramp * 0.8;
        } else {
          activeP.power = 0.85 + Math.sin((ramp - 1.0) * Math.PI * 4) * 0.15;
        }
      } else if (activeP.isPullingBack) {
        // Released Action Button: FIRE!
        activeP.isPullingBack = false;
        this.fireShot(activeP);
        return;
      }

      // 4. Instant Action Trigger (if just pressed and not dragging)
      if (this.input.justAction(activeP.id) && !activeP.isPullingBack) {
        this.input.consumeAction(activeP.id);
        this.fireShot(activeP);
        return;
      }
    }

    // If turn timer expires, auto-fire!
    if (this.turnTimer <= 0) {
      this.fireShot(activeP);
    }
  }

  public fireShot(player: ArtilleryPlayer): void {
    if (this.turnState !== 'AIMING') return;

    this.turnState = 'FIRING';
    this.stateTimer = 0;

    const angleRad = (player.aimAngleDeg * Math.PI) / 180;
    // Launch speed scales from 240 to 620 based on power
    const speed = 230 + player.power * 410;
    const vx = Math.cos(angleRad) * speed;
    const vy = -Math.sin(angleRad) * speed; // negative Y is upward

    // Spawn projectile from player barrel/head
    const spawnX = player.x + Math.cos(angleRad) * 22;
    const spawnY = player.y - 20 - Math.sin(angleRad) * 22;

    this.projectile = {
      x: spawnX,
      y: spawnY,
      vx,
      vy,
      radius: 6,
      ownerId: player.id,
      trail: [],
      life: 0
    };

    this.audio.playWhoosh();
    this.particles.spawnExplosion(spawnX, spawnY, player.color, 8);

    // Zoom camera slightly back to follow trajectory
    this.camera.targetZoom = 1.18;
  }

  private updateFiring(dt: number): void {
    if (this.stateTimer >= 0.15) {
      this.turnState = 'PROJECTILE_FLYING';
      this.stateTimer = 0;
    }
  }

  private updateProjectile(dt: number, width: number, height: number): void {
    if (!this.projectile) {
      this.turnState = 'IMPACT_PAUSE';
      this.stateTimer = 0;
      return;
    }

    const p = this.projectile;
    p.life += dt;

    // Apply wind and gravity ballistics
    p.vx += this.wind * dt;
    p.vy += this.gravity * dt;

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Camera smoothly follows the projectile in mid-air
    this.camera.targetX = p.x;
    this.camera.targetY = p.y;
    this.camera.targetZoom = 1.15;

    // Add trail particle
    p.trail.push({ x: p.x, y: p.y, alpha: 0.85, size: 4 });
    if (p.trail.length > 22) p.trail.shift();

    for (const t of p.trail) {
      t.alpha = Math.max(0, t.alpha - dt * 2.2);
    }

    // 1. Direct Hit Check with Players
    for (const target of this.playersState.values()) {
      if (!target.alive || target.id === p.ownerId) continue;

      // Character body: Width 24px, Height 36px (feet at target.y, head at target.y - 34)
      const dx = Math.abs(p.x - target.x);
      const dy = p.y - target.y; // dy < 0 means above ground feet

      if (dx <= 16 && p.y >= target.y - 36 && p.y <= target.y + 4) {
        // Direct Body Hit! Evaluate locational body part
        this.handlePlayerHit(target, p.x, p.y);
        this.detonateProjectile(p.x, p.y, true);
        return;
      }
    }

    // 2. Terrain Collision Check
    const groundY = this.getTerrainHeightAt(p.x);
    if (p.y >= groundY - 2) {
      // Hit the terrain landscape!
      this.checkSplashDamage(p.x, p.y);
      this.detonateProjectile(p.x, groundY, false);
      return;
    }

    // 3. Out of Bounds Check (left, right, bottom)
    if (p.x < -100 || p.x > width + 100 || p.y > height + 80) {
      // Complete miss out of arena bounds
      this.addFloatingText(Math.max(50, Math.min(width - 50, p.x)), height * 0.7, '💨 MISSED!', '#94A3B8', 13);
      this.projectile = null;
      this.turnState = 'IMPACT_PAUSE';
      this.stateTimer = 0;
    }
  }

  private handlePlayerHit(target: ArtilleryPlayer, hitX: number, hitY: number): void {
    // Locational Damage Multipliers:
    // Character height: 36px from target.y down to target.y - 36
    // Head: top 10px (hitY <= target.y - 25) -> 2.5x critical damage (50 HP)
    // Torso / Body: middle 15px (target.y - 25 < hitY <= target.y - 10) -> 1.0x standard damage (25 HP)
    // Limbs / Legs: bottom 11px (hitY > target.y - 10) -> 0.6x glancing damage (15 HP)

    let hitType: 'HEADSHOT' | 'BODY' | 'LEG' = 'BODY';
    let damage = 25;
    let label = '🎯 BODY HIT! -25';
    let textColor = '#FB923C';
    let textSize = 16;

    if (hitY <= target.y - 25) {
      // HEADSHOT! Critical 2.5x
      hitType = 'HEADSHOT';
      damage = 50;
      label = '💥 CRITICAL HEADSHOT! -50';
      textColor = '#EF4444';
      textSize = 20;
      this.screenShake = 18;
      this.audio.playExplosion();
      this.audio.playHitStopThud();

      const owner = this.getActivePlayer();
      if (owner) {
        owner.headshots += 1;
        owner.score += 150;
      }
    } else if (hitY > target.y - 10) {
      // LEG / LIMB HIT! Glancing 0.6x
      hitType = 'LEG';
      damage = 15;
      label = '⚡ LEG HIT! -15';
      textColor = '#FACC15';
      textSize = 14;
      this.screenShake = 8;
      this.audio.playHitStopThud();
      this.audio.playBounce();

      const owner = this.getActivePlayer();
      if (owner) owner.score += 50;
    } else {
      // BODY / TORSO HIT! Standard 1.0x
      hitType = 'BODY';
      damage = 25;
      label = '🎯 BODY HIT! -25';
      textColor = '#F97316';
      textSize = 16;
      this.screenShake = 12;
      this.audio.playHitStopThud();

      const owner = this.getActivePlayer();
      if (owner) owner.score += 80;
    }

    target.hp = Math.max(0, target.hp - damage);
    this.addFloatingText(target.x, target.y - 38, label, textColor, textSize);

    // Record damage event for deterministic Playwright verification
    this.lastDamageEvent = {
      targetId: target.id,
      hitType,
      damage
    };

    if (target.hp <= 0 && target.alive) {
      target.alive = false;
      this.destructionOrder.push(target.id);
      this.addFloatingText(target.x, target.y - 56, '☠️ ELIMINATED!', '#DC2626', 18);
      const owner = this.getActivePlayer();
      if (owner) owner.kills += 1;
    }
  }

  private checkSplashDamage(cx: number, cy: number): void {
    const blastRadius = 42;
    for (const target of this.playersState.values()) {
      if (!target.alive) continue;
      const targetCenterY = target.y - 16;
      const dist = Math.hypot(target.x - cx, targetCenterY - cy);

      if (dist <= blastRadius) {
        const falloff = 1 - dist / blastRadius;
        const splashDmg = Math.max(6, Math.round(18 * falloff));
        target.hp = Math.max(0, target.hp - splashDmg);

        this.addFloatingText(target.x, target.y - 36, `💥 BLAST! -${splashDmg}`, '#FB923C', 13);
        this.lastDamageEvent = {
          targetId: target.id,
          hitType: 'SPLASH',
          damage: splashDmg
        };

        if (target.hp <= 0 && target.alive) {
          target.alive = false;
          this.destructionOrder.push(target.id);
          this.addFloatingText(target.x, target.y - 54, '☠️ ELIMINATED!', '#DC2626', 17);
        }
      }
    }
  }

  private detonateProjectile(cx: number, cy: number, hitDirectly: boolean): void {
    // Carve crater in terrain
    const craterR = hitDirectly ? 22 : 28;
    this.carveCrater(cx, cy, craterR);

    // Spawn explosion juice
    this.particles.spawnExplosion(cx, cy, '#F97316', 16);
    this.particles.spawnExplosion(cx, cy, '#FACC15', 12);
    this.particles.spawnExplosion(cx, cy, '#475569', 10);
    this.screenShake = Math.max(this.screenShake, 12);

    this.projectile = null;
    this.turnState = 'IMPACT_PAUSE';
    this.stateTimer = 0;
  }

  private updateImpactPause(dt: number, width: number, height: number): void {
    // Hold on impact scene for 0.85s so players register the explosion and damage numbers
    if (this.stateTimer >= 0.85) {
      this.turnState = 'NEXT_TURN_DELAY';
      this.stateTimer = 0;
    }
  }

  private updateNextTurnDelay(dt: number, width: number, height: number): void {
    // Check win condition
    const survivors = Array.from(this.playersState.values()).filter((p) => p.alive);
    if (survivors.length <= 1) {
      this.isFinished = true;
      return;
    }

    if (this.stateTimer >= 0.4) {
      this.advanceToNextPlayer();
    }
  }

  private advanceToNextPlayer(): void {
    const active = this.getActivePlayers();
    const total = active.length;

    // Shift wind for new turn
    this.generateNewWind();

    // Advance to next alive player
    for (let step = 1; step <= total; step++) {
      const nextIdx = (this.activePlayerIndex + step) % total;
      const pid = active[nextIdx].id;
      const ps = this.playersState.get(pid);
      if (ps && ps.alive) {
        this.activePlayerIndex = nextIdx;
        this.turnState = 'PAN_TO_PLAYER';
        this.stateTimer = 0;
        this.turnTimer = 25.0;

        // Reset bot decision cache
        this.botAimHoldTimer = 0;
        return;
      }
    }

    this.isFinished = true;
  }

  private addFloatingText(x: number, y: number, text: string, color: string, size: number): void {
    this.floatingTexts.push({
      id: this.textCounter++,
      x,
      y,
      text,
      color,
      size,
      life: 0,
      maxLife: 1.4,
      vy: -32
    });
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // Screen Shake Offset
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#0F172A'); // Deep twilight dusk
    skyGrad.addColorStop(0.4, '#1E293B');
    skyGrad.addColorStop(0.7, '#334155');
    skyGrad.addColorStop(1, '#475569');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle background stars / moon
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(width * 0.85, 75, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(width * 0.85 - 8, 70, 22, 0, Math.PI * 2);
    ctx.fill();

    // Apply Camera Transform
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    // 1. Render Destructible Terrain
    this.renderTerrain(ctx, width, height);

    // 2. Render Aiming Slingshot & Trajectory Arc (if active player is aiming)
    if (this.turnState === 'AIMING') {
      const activeP = this.getActivePlayer();
      if (activeP && activeP.alive) {
        this.renderSlingshotAim(ctx, activeP);
      }
    }

    // 3. Render Players
    this.renderPlayers(ctx);

    // 4. Render Projectile & Trail
    if (this.projectile) {
      this.renderProjectile(ctx, this.projectile);
    }

    // 5. Render Floating Combat Damage Numbers
    for (const ft of this.floatingTexts) {
      const alpha = Math.max(0, 1 - ft.life / ft.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${ft.size}px Inter, sans-serif`;
      ctx.textAlign = 'center';

      // Drop shadow for crisp readability
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillText(ft.text, ft.x + 2, ft.y + 2);

      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore(); // Restore Camera Transform

    // 6. Screen-Space HUD & Turn Corridor
    this.renderHUD(ctx, width, height);

    ctx.restore();
  }

  private renderTerrain(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // Fill Terrain Body (strata layers)
    ctx.beginPath();
    ctx.moveTo(0, height + 50);
    ctx.lineTo(0, this.terrainHeights[0]);

    for (let x = 1; x <= width; x++) {
      ctx.lineTo(x, this.terrainHeights[x]);
    }

    ctx.lineTo(width, height + 50);
    ctx.closePath();

    // Soil & rock gradient
    const terrainGrad = ctx.createLinearGradient(0, height * 0.4, 0, height);
    terrainGrad.addColorStop(0, '#15803D'); // Emerald top
    terrainGrad.addColorStop(0.08, '#166534'); // Darker foliage
    terrainGrad.addColorStop(0.18, '#854D0E'); // Rich brown earth
    terrainGrad.addColorStop(0.5, '#713F12'); // Dense soil
    terrainGrad.addColorStop(1, '#334155'); // Deep bedrock
    ctx.fillStyle = terrainGrad;
    ctx.fill();

    // Grass Top Rim Outline
    ctx.beginPath();
    ctx.moveTo(0, this.terrainHeights[0]);
    for (let x = 1; x <= width; x++) {
      ctx.lineTo(x, this.terrainHeights[x]);
    }
    ctx.strokeStyle = '#4ADE80'; // Neon lime grass crest
    ctx.lineWidth = 4;
    ctx.stroke();

    // Render Crater Scorches
    for (const c of this.craters) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius, 0, Math.PI);
      ctx.strokeStyle = 'rgba(24, 24, 27, 0.55)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderSlingshotAim(ctx: CanvasRenderingContext2D, player: ArtilleryPlayer): void {
    ctx.save();

    const rad = (player.aimAngleDeg * Math.PI) / 180;
    const handX = player.x;
    const handY = player.y - 18;

    // Slingshot Pull-Back Tension Line
    const pullDist = 18 + player.power * 45;
    const pullX = handX - Math.cos(rad) * pullDist;
    const pullY = handY + Math.sin(rad) * pullDist;

    // Elastic band
    ctx.beginPath();
    ctx.moveTo(handX - 6, handY);
    ctx.lineTo(pullX, pullY);
    ctx.lineTo(handX + 6, handY);
    ctx.strokeStyle = player.power > 0.8 ? '#EF4444' : player.power > 0.5 ? '#F97316' : '#FACC15';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Glowing projectile poised in slingshot cradle
    ctx.beginPath();
    ctx.arc(pullX, pullY, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = player.color;
    ctx.stroke();

    // Dotted Trajectory Prediction Guide (First 10 steps)
    const speed = 230 + player.power * 410;
    const initVx = Math.cos(rad) * speed;
    const initVy = -Math.sin(rad) * speed;

    ctx.fillStyle = player.color;
    for (let i = 1; i <= 10; i++) {
      const t = i * 0.055;
      const dotX = handX + initVx * t + 0.5 * this.wind * t * t;
      const dotY = handY + initVy * t + 0.5 * this.gravity * t * t;
      const alpha = Math.max(0.15, 1 - i / 11);

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 3.5 - i * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Live Readout Above Player: Angle & Power
    ctx.font = '800 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    const bannerText = `🎯 ${Math.round(player.aimAngleDeg)}°  •  ⚡ ${Math.round(player.power * 100)}%`;

    // Banner pill background
    const metrics = ctx.measureText(bannerText);
    const pillW = metrics.width + 16;
    const pillY = player.y - 62;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(player.x - pillW / 2, pillY - 14, pillW, 20, 10);
    ctx.fill();
    ctx.strokeStyle = player.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(bannerText, player.x, pillY);

    ctx.restore();
  }

  private renderPlayers(ctx: CanvasRenderingContext2D): void {
    const activeP = this.getActivePlayer();

    for (const p of this.playersState.values()) {
      if (!p.alive) {
        // Render funny comical headstone / fallen tank
        this.renderFallenPlayer(ctx, p.x, p.y, p.color);
        continue;
      }

      ctx.save();

      // Active player turn indicator bounce arrow
      if (this.turnState === 'AIMING' && activeP && activeP.id === p.id) {
        const bounce = Math.sin(performance.now() * 0.008) * 5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 75 + bounce);
        ctx.lineTo(p.x - 7, p.y - 87 + bounce);
        ctx.lineTo(p.x + 7, p.y - 87 + bounce);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Ground shadow
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 2, 16, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fill();

      // 1. Legs / Limbs (Glancing zone: y - 10 to y)
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(p.x - 7, p.y - 10, 5, 10);
      ctx.fillRect(p.x + 2, p.y - 10, 5, 10);

      // 2. Torso / Body (Standard zone: y - 25 to y - 10)
      ctx.beginPath();
      ctx.roundRect(p.x - 11, p.y - 25, 22, 16, 4);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Armor plate highlight on chest
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(p.x - 6, p.y - 22, 12, 6);

      // 3. Head / Helmet (Critical Headshot zone: y - 36 to y - 25)
      ctx.beginPath();
      ctx.arc(p.x, p.y - 30, 8.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Visor / Eye facing shot direction
      const eyeDir = p.facing;
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(p.x + eyeDir * 3 - 2, p.y - 32, 4, 3);

      // Health bar above head
      const barW = 32;
      const barH = 5;
      const barX = p.x - barW / 2;
      const barY = p.y - 46;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

      const hpRatio = Math.max(0, p.hp / p.maxHp);
      ctx.fillStyle = hpRatio > 0.5 ? '#22C55E' : hpRatio > 0.25 ? '#F59E0B' : '#EF4444';
      ctx.fillRect(barX, barY, barW * hpRatio, barH);

      // Player Name Tag
      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText(p.name, p.x, p.y - 52);

      ctx.restore();
    }
  }

  private renderFallenPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    ctx.save();
    // Headstone / grave marker
    ctx.beginPath();
    ctx.roundRect(x - 10, y - 22, 20, 22, [6, 6, 0, 0]);
    ctx.fillStyle = '#64748B';
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RIP', x, y - 9);
    ctx.restore();
  }

  private renderProjectile(ctx: CanvasRenderingContext2D, p: ArtilleryProjectile): void {
    ctx.save();

    // Render Trail
    for (const t of p.trail) {
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(249, 115, 22, ${t.alpha})`;
      ctx.fill();
    }

    // Glowing core & shell
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(253, 224, 71, 0.5)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#EF4444';
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // Modern Top Header Corridor
    const podW = Math.min(620, width - 40);
    const podH = 46;
    const podX = (width - podW) / 2;
    const podY = 16;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Active Player Turn Badge on Left
    const activeP = this.getActivePlayer();
    if (activeP) {
      ctx.beginPath();
      ctx.arc(podX + 24, podY + podH / 2, 12, 0, Math.PI * 2);
      ctx.fillStyle = activeP.color;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 13px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${activeP.name.toUpperCase()}'S TURN`, podX + 44, podY + 28);
    }

    // Center Wind Indicator
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px Inter, monospace';
    const windAbs = Math.abs(this.wind);
    const windArrow = this.wind > 5 ? '>>>' : this.wind < -5 ? '<<<' : '•';
    ctx.fillStyle = this.wind > 5 ? '#38BDF8' : this.wind < -5 ? '#F43F5E' : '#94A3B8';
    ctx.fillText(`💨 WIND: ${windArrow} ${windAbs} mph`, width / 2, podY + 28);

    // Turn Timer on Right
    ctx.textAlign = 'right';
    ctx.font = '800 15px Inter, monospace';
    const timerSecs = Math.ceil(this.turnTimer);
    ctx.fillStyle = timerSecs <= 5 ? '#EF4444' : '#FACC15';
    ctx.fillText(`⏱️ ${timerSecs}s`, podX + podW - 20, podY + 29);

    // Active Player Instruction Tip at Bottom
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(
      'Controls: Left/Right to Aim • Down/Up or Hold Fire to Pull Back • Space/Enter to Launch',
      width / 2,
      height - 18
    );

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();

    // Survivors ranked by HP and score, then destruction order
    const survivors = active
      .filter((p) => this.playersState.get(p.id)?.alive)
      .sort((a, b) => {
        const sa = this.playersState.get(a.id)!;
        const sb = this.playersState.get(b.id)!;
        if (sb.hp !== sa.hp) return sb.hp - sa.hp;
        return sb.score - sa.score;
      });

    const eliminated = this.destructionOrder
      .slice()
      .reverse()
      .map((id) => active.find((p) => p.id === id)!)
      .filter(Boolean);

    const fullOrder = [...survivors, ...eliminated];

    const rankings = fullOrder.map((p, idx) => ({
      playerId: p.id,
      score: this.playersState.get(p.id)?.score ?? 0,
      place: idx + 1
    }));

    const winnerId = fullOrder.length > 0 ? fullOrder[0].id : null;
    const winner = active.find((p) => p.id === winnerId);
    const winnerStats = winner ? this.playersState.get(winner.id) : null;

    const highlight = winnerStats?.headshots
      ? `${winner?.name ?? 'Player'} ruled the battlefield with ${winnerStats.headshots} critical Headshot(s)!`
      : `${winner?.name ?? 'Player'} claimed artillery supremacy across the hills!`;

    return {
      winnerId,
      rankings,
      mvpHighlight: highlight
    };
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || !ps.alive || this.turnState !== 'AIMING') return;

    // Find nearest alive enemy
    const enemies = this.getActivePlayers()
      .filter((p) => p.id !== botId && this.playersState.get(p.id)?.alive)
      .map((p) => this.playersState.get(p.id)!);

    if (enemies.length === 0) return;

    // Pick closest enemy
    enemies.sort((a, b) => Math.abs(a.x - ps.x) - Math.abs(b.x - ps.x));
    const target = enemies[0];

    const dx = target.x - ps.x;
    const dy = target.y - ps.y; // positive dy means target is lower than bot
    const dist = Math.abs(dx);
    const dir = dx > 0 ? 1 : -1;

    // Calculate approximate ballistic launch solution
    // Angle in degrees: 40° to 65° depending on distance
    let baseAngle = dir === 1 ? 50 : 130;
    if (dist > width * 0.5) {
      baseAngle = dir === 1 ? 42 : 138;
    }

    // Ballistic velocity estimate for range:
    // R = v^2 * sin(2*theta) / g -> v = sqrt(g * R / sin(2*theta))
    const thetaRad = ((dir === 1 ? baseAngle : 180 - baseAngle) * Math.PI) / 180;
    const sin2Theta = Math.sin(2 * thetaRad) || 0.9;
    const estSpeed = Math.sqrt((this.gravity * dist) / sin2Theta) - this.wind * 0.4;
    // Map speed to power (speed = 230 + power * 410)
    let calculatedPower = Math.max(0.2, Math.min(1.0, (estSpeed - 230) / 410));

    // Apply difficulty modifiers
    if (difficulty === 'bot_easy') {
      baseAngle += (Math.random() - 0.5) * 16;
      calculatedPower = Math.max(0.2, Math.min(1.0, calculatedPower + (Math.random() - 0.5) * 0.25));
    } else if (difficulty === 'bot_normal') {
      baseAngle += (Math.random() - 0.5) * 6;
      calculatedPower = Math.max(0.2, Math.min(1.0, calculatedPower + (Math.random() - 0.5) * 0.08));
    } else if (difficulty === 'bot_hard') {
      // Precision trajectory aimed directly at head level (y - 30)
      const headDy = dy - 28;
      calculatedPower = Math.max(0.2, Math.min(1.0, calculatedPower + (headDy > 0 ? -0.03 : 0.03)));
    }

    ps.aimAngleDeg = Math.round(Math.max(10, Math.min(170, baseAngle)));
    ps.facing = ps.aimAngleDeg <= 90 ? 1 : -1;
    ps.power = calculatedPower;

    // Bot pauses 0.8s to simulate aiming, then fires
    this.botAimHoldTimer += dt;
    if (this.botAimHoldTimer >= 0.85) {
      this.fireShot(ps);
      this.botAimHoldTimer = 0;
    }
  }
}
