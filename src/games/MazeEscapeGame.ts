import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface MazePlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  score: number;
  gemsCollected: number;
  speedBoostTimer: number;
  ghostTimer: number;
  freezeTimer: number;
  invulnerableTimer: number;
  hasTrap: boolean;
  botDecisionTimer: number;
  facingDx: number;
  facingDy: number;
  safeSpawnX: number;
  safeSpawnY: number;
}

interface MazeGem {
  id: number;
  x: number;
  y: number;
  radius: number;
  isRelic: boolean;
  collected: boolean;
}

interface MazeTrap {
  x: number;
  y: number;
  placedBy: PlayerId;
  active: boolean;
}

export interface MazeSentry {
  id: number;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  baseSpeed: number;
  chaseSpeed: number;
  state: 'PATROL' | 'CHASE' | 'RETURN';
  // Invisible Territory Boundaries (Grid & World)
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  homeX: number;
  homeY: number;
  targetPlayerId: PlayerId | null;
  alertState: 'NONE' | 'ALERT' | 'LOST';
  alertTimer: number;
  stunTimer: number;
  facingAngle: number;
  patrolDir: { dx: number; dy: number };
}

export class MazeEscapeGame extends BaseGame {
  private playersState: Map<PlayerId, MazePlayer> = new Map();
  private gems: MazeGem[] = [];
  private traps: MazeTrap[] = [];
  private sentries: MazeSentry[] = [];
  private currentMapName: string = 'Ancient Crypt';
  private wallGrid: boolean[][] = [];
  private cols: number = 27; // Large sprawling labyrinth (previously 19)
  private rows: number = 17; // Large labyrinth height (previously 13)
  private cellW: number = 34;
  private cellH: number = 28;
  private offsetX: number = 20;
  private offsetY: number = 88;
  private gemCounter: number = 0;
  private relicRespawnTimer: number = 0;

  // Backward compatibility getter for existing tests that read activeGame.sentry
  public get sentry(): MazeSentry {
    return (
      this.sentries[0] || {
        id: 0,
        name: 'Alpha Sentry',
        color: '#EF4444',
        x: 0,
        y: 0,
        vx: 110,
        vy: 0,
        radius: 15,
        speed: 110,
        baseSpeed: 105,
        chaseSpeed: 165,
        state: 'PATROL',
        minCol: 1,
        maxCol: 12,
        minRow: 1,
        maxRow: 8,
        minX: 0,
        maxX: 400,
        minY: 0,
        maxY: 300,
        homeX: 200,
        homeY: 150,
        targetPlayerId: null,
        alertState: 'NONE',
        alertTimer: 0,
        stunTimer: 0,
        facingAngle: 0,
        patrolDir: { dx: 1, dy: 0 }
      }
    );
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
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 50;
    this.traps = [];
    this.relicRespawnTimer = 0;

    // Direct manual control mode: releasing keys stops player completely
    this.input.setControlMode('directional');

    // Compute large grid sizing
    this.cols = 27;
    this.rows = 17;
    this.offsetX = 20;
    this.offsetY = 88;
    this.cellW = (width - this.offsetX * 2) / this.cols;
    this.cellH = (height - this.offsetY - 20) / this.rows;

    this.generateProceduralMap();
    this.initPlayers();
    this.initSentries();
    this.syncDebug();
  }

  private generateProceduralMap(): void {
    const maps = [
      'Ancient Crypt',
      'Neon Cyber Grid',
      'Overgrown Moss Ruins',
      'Volcanic Catacombs'
    ];
    this.currentMapName = maps[Math.floor(Math.random() * maps.length)];

    // Initialize wall grid (true = solid wall, false = open corridor)
    this.wallGrid = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => false)
    );

    // Outer perimeter walls
    for (let c = 0; c < this.cols; c++) {
      this.wallGrid[0][c] = true;
      this.wallGrid[this.rows - 1][c] = true;
    }
    for (let r = 0; r < this.rows; r++) {
      this.wallGrid[r][0] = true;
      this.wallGrid[r][this.cols - 1] = true;
    }

    const midR = Math.floor(this.rows / 2);
    const midC = Math.floor(this.cols / 2);

    // Labyrinth walls: regular grid pillars with branching corridors
    for (let r = 2; r < this.rows - 2; r += 2) {
      for (let c = 2; c < this.cols - 2; c += 2) {
        // Keep central 3x3 vault clear for the Golden Relic
        if (Math.abs(r - midR) <= 1 && Math.abs(c - midC) <= 2) {
          continue;
        }

        this.wallGrid[r][c] = true;

        // Branch out in 1 direction to create corridors
        const dirs = [
          { dr: -1, dc: 0 },
          { dr: 1, dc: 0 },
          { dr: 0, dc: -1 },
          { dr: 0, dc: 1 }
        ];
        const chosen = dirs[Math.floor(Math.random() * dirs.length)];
        const branchR = r + chosen.dr;
        const branchC = c + chosen.dc;

        // Do not block center vault or perimeter
        if (
          branchR > 0 &&
          branchR < this.rows - 1 &&
          branchC > 0 &&
          branchC < this.cols - 1 &&
          (Math.abs(branchR - midR) > 1 || Math.abs(branchC - midC) > 2)
        ) {
          this.wallGrid[branchR][branchC] = true;
        }
      }
    }

    // Populate Gems in open corridors
    this.gems = [];
    this.gemCounter = 0;

    for (let r = 1; r < this.rows - 1; r++) {
      for (let c = 1; c < this.cols - 1; c++) {
        if (!this.wallGrid[r][c]) {
          const isCenter = r === midR && c === midC;
          // Space out regular gems so the large map has plenty to collect
          if (isCenter || (r % 2 === 1 && c % 2 === 1) || Math.random() < 0.28) {
            this.gems.push({
              id: ++this.gemCounter,
              x: this.offsetX + (c + 0.5) * this.cellW,
              y: this.offsetY + (r + 0.5) * this.cellH,
              radius: isCenter ? 14 : 7,
              isRelic: isCenter,
              collected: false
            });
          }
        }
      }
    }
  }

  private initPlayers(): void {
    this.playersState.clear();
    const active = this.getActivePlayers();

    // 4 Corner spawn positions in open corridors
    const corners = [
      { r: 1, c: 1 },
      { r: 1, c: this.cols - 2 },
      { r: this.rows - 2, c: 1 },
      { r: this.rows - 2, c: this.cols - 2 }
    ];

    active.forEach((p, idx) => {
      const sp = corners[idx % corners.length];
      const px = this.offsetX + (sp.c + 0.5) * this.cellW;
      const py = this.offsetY + (sp.r + 0.5) * this.cellH;

      this.playersState.set(p.id, {
        id: p.id,
        x: px,
        y: py,
        vx: 0,
        vy: 0,
        radius: 12,
        score: 0,
        gemsCollected: 0,
        speedBoostTimer: 0,
        ghostTimer: 0,
        freezeTimer: 0,
        invulnerableTimer: 0,
        hasTrap: true,
        botDecisionTimer: 0.15 + idx * 0.08,
        facingDx: idx % 2 === 0 ? 1 : -1,
        facingDy: 0,
        safeSpawnX: px,
        safeSpawnY: py
      });
    });
  }

  private initSentries(): void {
    this.sentries = [];
    const midR = Math.floor(this.rows / 2);
    const midC = Math.floor(this.cols / 2);

    // 4 Distinct Patrol Quadrants / Invisible Territories
    const zones = [
      {
        id: 1,
        name: 'Crimson Sentry',
        color: '#EF4444',
        minCol: 1,
        maxCol: midC - 1,
        minRow: 1,
        maxRow: midR - 1,
        startCol: 5,
        startRow: 3
      },
      {
        id: 2,
        name: 'Violet Sentry',
        color: '#A855F7',
        minCol: midC + 1,
        maxCol: this.cols - 2,
        minRow: 1,
        maxRow: midR - 1,
        startCol: midC + 4,
        startRow: 3
      },
      {
        id: 3,
        name: 'Amber Sentry',
        color: '#F59E0B',
        minCol: 1,
        maxCol: midC - 1,
        minRow: midR + 1,
        maxRow: this.rows - 2,
        startCol: 5,
        startRow: midR + 4
      },
      {
        id: 4,
        name: 'Cyan Warden',
        color: '#06B6D4',
        minCol: midC + 1,
        maxCol: this.cols - 2,
        minRow: midR + 1,
        maxRow: this.rows - 2,
        startCol: midC + 4,
        startRow: midR + 4
      }
    ];

    zones.forEach((z) => {
      // Find open corridor cell in zone for start
      let startC = z.startCol;
      let startR = z.startRow;
      if (this.wallGrid[startR][startC]) {
        for (let r = z.minRow; r <= z.maxRow; r++) {
          for (let c = z.minCol; c <= z.maxCol; c++) {
            if (!this.wallGrid[r][c]) {
              startR = r;
              startC = c;
              break;
            }
          }
        }
      }

      const hx = this.offsetX + (startC + 0.5) * this.cellW;
      const hy = this.offsetY + (startR + 0.5) * this.cellH;

      this.sentries.push({
        id: z.id,
        name: z.name,
        color: z.color,
        x: hx,
        y: hy,
        vx: 105,
        vy: 0,
        radius: 15,
        speed: 105,
        baseSpeed: 105,
        chaseSpeed: 165,
        state: 'PATROL',
        minCol: z.minCol,
        maxCol: z.maxCol,
        minRow: z.minRow,
        maxRow: z.maxRow,
        minX: this.offsetX + z.minCol * this.cellW,
        maxX: this.offsetX + (z.maxCol + 1) * this.cellW,
        minY: this.offsetY + z.minRow * this.cellH,
        maxY: this.offsetY + (z.maxRow + 1) * this.cellH,
        homeX: hx,
        homeY: hy,
        targetPlayerId: null,
        alertState: 'NONE',
        alertTimer: 0,
        stunTimer: 0,
        facingAngle: 0,
        patrolDir: { dx: 1, dy: 0 }
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Relic respawn maintenance
    if (this.relicRespawnTimer > 0) {
      this.relicRespawnTimer -= dt;
      if (this.relicRespawnTimer <= 0) {
        const midR = Math.floor(this.rows / 2);
        const midC = Math.floor(this.cols / 2);
        this.gems.push({
          id: ++this.gemCounter,
          x: this.offsetX + (midC + 0.5) * this.cellW,
          y: this.offsetY + (midR + 0.5) * this.cellH,
          radius: 15,
          isRelic: true,
          collected: false
        });
        this.particles.showFloatingText('RELIC RESPAWNED!', width / 2, height / 2 - 20, '#F59E0B', 24);
      }
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.freezeTimer > 0) {
        ps.freezeTimer = Math.max(0, ps.freezeTimer - dt);
        ps.vx = 0;
        ps.vy = 0;
        continue;
      }

      if (ps.speedBoostTimer > 0) ps.speedBoostTimer = Math.max(0, ps.speedBoostTimer - dt);
      if (ps.ghostTimer > 0) ps.ghostTimer = Math.max(0, ps.ghostTimer - dt);
      if (ps.invulnerableTimer > 0) ps.invulnerableTimer = Math.max(0, ps.invulnerableTimer - dt);

      // Read Inputs
      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const rawSteer = this.input.getRawSteer(p.id);
      const rawThrottle = this.input.getRawThrottle(p.id);

      let effectiveSteer = 0;
      if (rawSteer !== 0) {
        effectiveSteer = rawSteer;
      } else if (Math.abs(steer) > 0.35) {
        effectiveSteer = steer;
      }

      let effectiveThrottle = 0;
      if (rawThrottle !== 0) {
        effectiveThrottle = rawThrottle;
      } else if (Math.abs(throttle) > 0.35) {
        effectiveThrottle = throttle;
      }

      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      // Place trap
      if (justAction && ps.hasTrap) {
        ps.hasTrap = false;
        this.traps.push({
          x: ps.x,
          y: ps.y,
          placedBy: ps.id,
          active: true
        });
        this.audio.playTap();
        this.particles.showFloatingText('TRAP SET!', ps.x, ps.y - 20, '#38BDF8', 18);
      }

      // Movement: Clean, 100% direct control. Releasing keys stops character completely!
      const baseSpeed = ps.speedBoostTimer > 0 ? 250 : 170;
      if (effectiveSteer !== 0 || effectiveThrottle !== 0) {
        ps.vx = effectiveSteer * baseSpeed;
        ps.vy = -effectiveThrottle * baseSpeed;
        if (effectiveSteer !== 0) ps.facingDx = Math.sign(effectiveSteer);
        if (effectiveThrottle !== 0) ps.facingDy = -Math.sign(effectiveThrottle);
      } else {
        // Zero drift when left alone: character stops dead in tracks!
        ps.vx = 0;
        ps.vy = 0;
      }

      // Wall collision resolution (unless ghost cloak is active)
      if (ps.ghostTimer > 0) {
        ps.x += ps.vx * dt;
        ps.y += ps.vy * dt;
        ps.x = Math.max(this.offsetX + this.cellW + ps.radius, Math.min(this.offsetX + (this.cols - 1) * this.cellW - ps.radius, ps.x));
        ps.y = Math.max(this.offsetY + this.cellH + ps.radius, Math.min(this.offsetY + (this.rows - 1) * this.cellH - ps.radius, ps.y));
      } else {
        this.resolvePlayerWallCollision(ps, dt);
      }

      // Gem collection
      for (const gem of this.gems) {
        if (gem.collected) continue;

        const dist = Math.hypot(ps.x - gem.x, ps.y - gem.y);
        if (dist < ps.radius + gem.radius) {
          gem.collected = true;
          ps.gemsCollected += 1;

          if (gem.isRelic) {
            ps.score += 250;
            this.relicRespawnTimer = 12.0;
            this.audio.playFanfare();
            this.particles.shake(0.35);
            this.particles.showFloatingText('GOLDEN RELIC! +250', ps.x, ps.y - 25, '#F59E0B', 24);
            this.particles.spawnConfetti(gem.x, gem.y, 30);
          } else {
            ps.score += 15;
            this.audio.playTap();
            this.particles.spawnSparks(gem.x, gem.y, '#38BDF8', 6);
          }
        }
      }

      // Trap triggers
      for (const trap of this.traps) {
        if (!trap.active || trap.placedBy === ps.id) continue;
        const d = Math.hypot(ps.x - trap.x, ps.y - trap.y);
        if (d < ps.radius + 12) {
          trap.active = false;
          ps.freezeTimer = 1.6;
          this.audio.playStun();
          this.particles.shake(0.25);
          this.particles.showFloatingText('FROZEN TRAP!', ps.x, ps.y - 25, '#38BDF8', 22);
        }
      }

      // Sentry Collisions with Significant Penalty & Distance Creation
      for (let sIdx = 0; sIdx < this.sentries.length; sIdx++) {
        const sentry = this.sentries[sIdx];
        if (sentry.stunTimer > 0 || ps.invulnerableTimer > 0) continue;

        const sentryDist = Math.hypot(ps.x - sentry.x, ps.y - sentry.y);
        if (sentryDist < ps.radius + sentry.radius) {
          this.handleSentryCollision(ps.id, sIdx);
        }
      }
    }

    // Update All Sentries (Patrol, Territory Bounds, and Alert Chase)
    this.updateSentries(dt);

    this.syncDebug();

    // End round check
    const remainingGems = this.gems.filter((g) => !g.collected);
    if (remainingGems.length === 0 || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public handleSentryCollision(playerId: PlayerId, sentryIndex: number): void {
    const ps = this.playersState.get(playerId);
    const sentry = this.sentries[sentryIndex];
    if (!ps || !sentry) return;

    // 1. Significant Score Penalty & Drop Gems
    const penalty = 120;
    ps.score = Math.max(0, ps.score - penalty);
    const droppedGems = Math.min(ps.gemsCollected, 3);
    ps.gemsCollected = Math.max(0, ps.gemsCollected - droppedGems);

    // 2. Guaranteed Distance Creation:
    // Knock player 200px away or return to safe spawn corridor
    const repelAngle = Math.atan2(ps.y - sentry.y, ps.x - sentry.x);
    let targetX = ps.x + Math.cos(repelAngle) * 190;
    let targetY = ps.y + Math.sin(repelAngle) * 190;

    // Check if target is inside wall or offscreen; if so, warp to player's safe quadrant spawn
    if (this.checkWallOverlap(targetX, targetY, ps.radius + 2)) {
      targetX = ps.safeSpawnX;
      targetY = ps.safeSpawnY;
    }
    ps.x = targetX;
    ps.y = targetY;
    ps.vx = 0;
    ps.vy = 0;

    // 3. Invulnerability shield so player is not immediately re-hit
    ps.invulnerableTimer = 2.4;

    // 4. Stun sentry and reset to territory home
    sentry.stunTimer = 1.5;
    sentry.state = 'RETURN';
    sentry.targetPlayerId = null;
    sentry.alertState = 'LOST';
    sentry.alertTimer = 1.0;
    sentry.x = sentry.homeX;
    sentry.y = sentry.homeY;

    // 5. Sound & VFX feedback
    this.audio.playExplosion();
    this.particles.shake(0.45);
    this.particles.showFloatingText(`SENTRY SMASH! -${penalty} PTS!`, ps.x, ps.y - 30, '#EF4444', 24);
    this.particles.spawnExplosion(sentry.x, sentry.y, sentry.color, 24);
    this.particles.showFloatingText('SHIELD ACTIVE!', ps.x, ps.y + 20, '#38BDF8', 16);
  }

  private resolvePlayerWallCollision(ps: MazePlayer, dt: number): void {
    // Try X movement
    const nextX = ps.x + ps.vx * dt;
    if (!this.checkWallOverlap(nextX, ps.y, ps.radius)) {
      ps.x = nextX;
    }

    // Try Y movement
    const nextY = ps.y + ps.vy * dt;
    if (!this.checkWallOverlap(ps.x, nextY, ps.radius)) {
      ps.y = nextY;
    }
  }

  private checkWallOverlap(x: number, y: number, radius: number): boolean {
    const minC = Math.floor((x - radius - this.offsetX) / this.cellW);
    const maxC = Math.floor((x + radius - this.offsetX) / this.cellW);
    const minR = Math.floor((y - radius - this.offsetY) / this.cellH);
    const maxR = Math.floor((y + radius - this.offsetY) / this.cellH);

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return true;
        if (this.wallGrid[r][c]) {
          const wLeft = this.offsetX + c * this.cellW;
          const wRight = wLeft + this.cellW;
          const wTop = this.offsetY + r * this.cellH;
          const wBottom = wTop + this.cellH;

          // Circle-Box overlap test
          const closeX = Math.max(wLeft, Math.min(x, wRight));
          const closeY = Math.max(wTop, Math.min(y, wBottom));
          if (Math.hypot(x - closeX, y - closeY) < radius) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private updateSentries(dt: number): void {
    for (const sentry of this.sentries) {
      if (sentry.stunTimer > 0) {
        sentry.stunTimer = Math.max(0, sentry.stunTimer - dt);
        continue;
      }

      if (sentry.alertTimer > 0) {
        sentry.alertTimer = Math.max(0, sentry.alertTimer - dt);
        if (sentry.alertTimer <= 0) sentry.alertState = 'NONE';
      }

      // Check proximity for players inside sentry's territory
      const detectionRadius = 145;
      let detectedPlayer: MazePlayer | null = null;
      let closestDist = 9999;

      for (const p of this.getActivePlayers()) {
        const ps = this.playersState.get(p.id);
        if (!ps || ps.ghostTimer > 0 || ps.invulnerableTimer > 0) continue;

        // Is player within sentry's invisible boundary/territory?
        const inTerritory =
          ps.x >= sentry.minX - 10 &&
          ps.x <= sentry.maxX + 10 &&
          ps.y >= sentry.minY - 10 &&
          ps.y <= sentry.maxY + 10;

        if (inTerritory) {
          const d = Math.hypot(ps.x - sentry.x, ps.y - sentry.y);
          if (d < detectionRadius && d < closestDist) {
            closestDist = d;
            detectedPlayer = ps;
          }
        }
      }

      // State Transitions
      if (detectedPlayer) {
        if (sentry.state !== 'CHASE') {
          sentry.state = 'CHASE';
          sentry.alertState = 'ALERT';
          sentry.alertTimer = 1.0;
          this.audio.playWhoosh();
          this.particles.showFloatingText('!', sentry.x, sentry.y - 24, '#EF4444', 22);
        }
        sentry.targetPlayerId = detectedPlayer.id;
      } else if (sentry.state === 'CHASE') {
        // Player fled outside invisible boundary! Sentry gives up chase!
        sentry.state = 'RETURN';
        sentry.targetPlayerId = null;
        sentry.alertState = 'LOST';
        sentry.alertTimer = 1.0;
        this.particles.showFloatingText('?', sentry.x, sentry.y - 24, '#38BDF8', 20);
      }

      // Movement Execution
      const currentSpeed = sentry.state === 'CHASE' ? sentry.chaseSpeed : sentry.baseSpeed;

      if (sentry.state === 'CHASE' && sentry.targetPlayerId !== null) {
        const target = this.playersState.get(sentry.targetPlayerId);
        if (target) {
          // Pursue along corridor toward player
          const toX = target.x - sentry.x;
          const toY = target.y - sentry.y;
          const angle = Math.atan2(toY, toX);
          sentry.facingAngle = angle;

          let stepVx = Math.cos(angle) * currentSpeed;
          let stepVy = Math.sin(angle) * currentSpeed;

          // Wall and boundary avoidance during chase
          const testX = sentry.x + stepVx * dt;
          const testY = sentry.y + stepVy * dt;

          // Enforce invisible territory boundary: sentry stops at edge
          const clampedX = Math.max(sentry.minX + sentry.radius, Math.min(sentry.maxX - sentry.radius, testX));
          const clampedY = Math.max(sentry.minY + sentry.radius, Math.min(sentry.maxY - sentry.radius, testY));

          if (!this.checkWallOverlap(clampedX, sentry.y, sentry.radius)) {
            sentry.x = clampedX;
          }
          if (!this.checkWallOverlap(sentry.x, clampedY, sentry.radius)) {
            sentry.y = clampedY;
          }

          sentry.vx = stepVx;
          sentry.vy = stepVy;
        }
      } else if (sentry.state === 'RETURN') {
        // Return toward home in center of territory
        const toHomeX = sentry.homeX - sentry.x;
        const toHomeY = sentry.homeY - sentry.y;
        const distHome = Math.hypot(toHomeX, toHomeY);

        if (distHome < 15) {
          sentry.state = 'PATROL';
        } else {
          const angle = Math.atan2(toHomeY, toHomeX);
          sentry.facingAngle = angle;
          const stepX = Math.cos(angle) * currentSpeed * dt;
          const stepY = Math.sin(angle) * currentSpeed * dt;

          if (!this.checkWallOverlap(sentry.x + stepX, sentry.y, sentry.radius)) {
            sentry.x += stepX;
          }
          if (!this.checkWallOverlap(sentry.x, sentry.y + stepY, sentry.radius)) {
            sentry.y += stepY;
          }
        }
      } else {
        // PATROL: smooth corridor navigation within territory
        sentry.x += sentry.vx * dt;
        sentry.y += sentry.vy * dt;

        // Check wall collision or reaching invisible boundary
        const hitWall = this.checkWallOverlap(
          sentry.x + Math.sign(sentry.vx) * (sentry.radius + 6),
          sentry.y + Math.sign(sentry.vy) * (sentry.radius + 6),
          sentry.radius
        );
        const hitBoundary =
          sentry.x <= sentry.minX + sentry.radius + 4 ||
          sentry.x >= sentry.maxX - sentry.radius - 4 ||
          sentry.y <= sentry.minY + sentry.radius + 4 ||
          sentry.y >= sentry.maxY - sentry.radius - 4;

        if (hitWall || hitBoundary) {
          // Clamp inside boundary
          sentry.x = Math.max(sentry.minX + sentry.radius + 5, Math.min(sentry.maxX - sentry.radius - 5, sentry.x));
          sentry.y = Math.max(sentry.minY + sentry.radius + 5, Math.min(sentry.maxY - sentry.radius - 5, sentry.y));

          // Choose perpendicular open corridor within territory
          const options = [
            { vx: sentry.baseSpeed, vy: 0 },
            { vx: -sentry.baseSpeed, vy: 0 },
            { vx: 0, vy: sentry.baseSpeed },
            { vx: 0, vy: -sentry.baseSpeed }
          ];
          const valid = options.filter((o) => {
            const tx = sentry.x + o.vx * 0.25;
            const ty = sentry.y + o.vy * 0.25;
            const inBounds = tx >= sentry.minX && tx <= sentry.maxX && ty >= sentry.minY && ty <= sentry.maxY;
            return inBounds && !this.checkWallOverlap(tx, ty, sentry.radius);
          });

          const nonReverse = valid.filter((o) => !(o.vx === -sentry.vx && o.vy === -sentry.vy));
          const pool = nonReverse.length > 0 ? nonReverse : valid;

          if (pool.length > 0) {
            const pick = pool[Math.floor(Math.random() * pool.length)];
            sentry.vx = pick.vx;
            sentry.vy = pick.vy;
          } else {
            sentry.vx = -sentry.vx;
            sentry.vy = -sentry.vy;
          }
        }
      }
    }
  }

  public syncDebug(): void {
    if (typeof window !== 'undefined') {
      const self = this;
      (window as any).__MAZE_ESCAPE_DEBUG__ = {
        get players() {
          return Array.from(self.playersState.values());
        },
        get sentries() {
          return self.sentries;
        },
        get sentry() {
          return self.sentry;
        },
        get gems() {
          return self.gems;
        },
        get wallGrid() {
          return self.wallGrid;
        },
        get roundTimer() {
          return self.roundTimer;
        },
        get isFinished() {
          return self.isFinished;
        },
        get cols() {
          return self.cols;
        },
        get rows() {
          return self.rows;
        },
        triggerSentryCollision: (playerId: PlayerId, sentryIndex: number = 0) =>
          self.handleSentryCollision(playerId, sentryIndex)
      };
    }
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
    if (!ps || ps.freezeTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    ps.botDecisionTimer -= dt;
    if (ps.botDecisionTimer > 0) return;

    const interval =
      difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.14 : 0.22;
    ps.botDecisionTimer = interval;

    // 1. Check for incoming sentry threats (threat avoidance)
    let closestSentryDist = 9999;
    let threatSentry: MazeSentry | null = null;
    for (const sentry of this.sentries) {
      const d = Math.hypot(sentry.x - ps.x, sentry.y - ps.y);
      if (d < 160 && d < closestSentryDist) {
        closestSentryDist = d;
        threatSentry = sentry;
      }
    }

    // 2. Candidate corridor directions
    const candidates = [
      { steer: 1, throttle: 0, dx: 1, dy: 0 },
      { steer: -1, throttle: 0, dx: -1, dy: 0 },
      { steer: 0, throttle: 1, dx: 0, dy: -1 },
      { steer: 0, throttle: -1, dx: 0, dy: 1 }
    ];

    const lookAhead = 16;
    const validMoves = candidates.filter(
      (c) => !this.checkWallOverlap(ps.x + c.dx * lookAhead, ps.y + c.dy * lookAhead, ps.radius)
    );

    if (validMoves.length === 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // 3. Score valid moves based on gem proximity and sentry evasion
    let bestMove = validMoves[0];
    let bestScore = -99999;

    // Find best target gem (prioritize relic)
    let targetX = width / 2;
    let targetY = height / 2;
    let minGemDist = 9999;
    for (const gem of this.gems) {
      if (gem.collected) continue;
      const d = Math.hypot(gem.x - ps.x, gem.y - ps.y);
      const effectiveDist = gem.isRelic ? d * 0.45 : d;
      if (effectiveDist < minGemDist) {
        minGemDist = effectiveDist;
        targetX = gem.x;
        targetY = gem.y;
      }
    }

    for (const move of validMoves) {
      const nextX = ps.x + move.dx * 20;
      const nextY = ps.y + move.dy * 20;

      // Distance to target gem
      const distToGem = Math.hypot(targetX - nextX, targetY - nextY);
      let score = -distToGem;

      // Sentry evasion penalty / reward
      if (threatSentry) {
        const distToSentry = Math.hypot(threatSentry.x - nextX, threatSentry.y - nextY);
        if (distToSentry < 120) {
          score -= (140 - distToSentry) * 4.5;
        } else {
          score += distToSentry * 1.5;
        }

        // Fleeing outside sentry territory boundary is heavily rewarded!
        const outsideTerritory =
          nextX < threatSentry.minX ||
          nextX > threatSentry.maxX ||
          nextY < threatSentry.minY ||
          nextY > threatSentry.maxY;
        if (outsideTerritory) {
          score += 180;
        }
      }

      // Avoid reverse oscillating unless dead end
      if (move.dx === -ps.facingDx && move.dy === -ps.facingDy && validMoves.length > 1) {
        score -= 50;
      }

      // Difficulty noise
      if (difficulty === 'bot_easy') {
        score += (Math.random() - 0.5) * 60;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    // Drop trap if opponents are nearby
    let useTrap = false;
    if (ps.hasTrap && difficulty !== 'bot_easy') {
      for (const p of this.getActivePlayers()) {
        if (p.id === botId) continue;
        const other = this.playersState.get(p.id);
        if (other && Math.hypot(other.x - ps.x, other.y - ps.y) < 70) {
          useTrap = true;
          break;
        }
      }
    }

    this.input.setBotInput(botId, useTrap, bestMove.steer, bestMove.throttle, useTrap);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Maze Backdrop
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, width, height);

    // 2. Maze Floor & Wall Grid
    this.renderMazeWalls(ctx);

    // 3. Faint Territory Boundary Guides for Sentries
    this.renderTerritoryBoundaries(ctx);

    // 4. Traps
    for (const trap of this.traps) {
      if (!trap.active) continue;
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(trap.x, trap.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 5. Gems & Golden Relic
    for (const gem of this.gems) {
      if (gem.collected) continue;
      this.renderGem(ctx, gem);
    }

    // 6. Multiple Sentries
    for (const sentry of this.sentries) {
      this.renderSentry(ctx, sentry);
    }

    // 7. Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderMazePlayer(ctx, ps, p.color);
    }

    // 8. Center HUD Pod
    this.renderCenterHudPod(ctx, width);
  }

  private renderMazeWalls(ctx: CanvasRenderingContext2D): void {
    let wallColor = '#1E293B';
    let wallStroke = '#334155';

    if (this.currentMapName === 'Neon Cyber Grid') {
      wallColor = '#0F172A';
      wallStroke = '#06B6D4';
    } else if (this.currentMapName === 'Overgrown Moss Ruins') {
      wallColor = '#14532D';
      wallStroke = '#166534';
    } else if (this.currentMapName === 'Volcanic Catacombs') {
      wallColor = '#450A0A';
      wallStroke = '#7F1D1D';
    }

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const wx = this.offsetX + c * this.cellW;
        const wy = this.offsetY + r * this.cellH;

        if (this.wallGrid[r][c]) {
          ctx.fillStyle = wallColor;
          ctx.fillRect(wx, wy, this.cellW, this.cellH);
          ctx.strokeStyle = wallStroke;
          ctx.lineWidth = 1.2;
          ctx.strokeRect(wx, wy, this.cellW, this.cellH);
        } else {
          // Floor corridor tile
          ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
          ctx.fillRect(wx + 1, wy + 1, this.cellW - 2, this.cellH - 2);
        }
      }
    }
  }

  private renderTerritoryBoundaries(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const sentry of this.sentries) {
      // Subtle dashed perimeter marking the sentry's invisible boundary
      ctx.strokeStyle = sentry.state === 'CHASE' ? sentry.color : 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = sentry.state === 'CHASE' ? 1.5 : 1;
      ctx.setLineDash([4, 6]);
      ctx.strokeRect(
        sentry.minX,
        sentry.minY,
        sentry.maxX - sentry.minX,
        sentry.maxY - sentry.minY
      );
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  private renderGem(ctx: CanvasRenderingContext2D, gem: MazeGem): void {
    ctx.save();
    ctx.translate(gem.x, gem.y);

    if (gem.isRelic) {
      // Golden Relic Idol
      ctx.beginPath();
      ctx.arc(0, 0, gem.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#F59E0B';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#FEF08A';
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', 0, 4);
    } else {
      // Sparkling Cyan Gem
      ctx.beginPath();
      ctx.moveTo(0, -gem.radius);
      ctx.lineTo(gem.radius, 0);
      ctx.lineTo(0, gem.radius);
      ctx.lineTo(-gem.radius, 0);
      ctx.closePath();
      ctx.fillStyle = '#38BDF8';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderSentry(ctx: CanvasRenderingContext2D, sentry: MazeSentry): void {
    ctx.save();
    ctx.translate(sentry.x, sentry.y);

    // Alert pulsating aura in CHASE mode
    if (sentry.state === 'CHASE') {
      ctx.beginPath();
      ctx.arc(0, 0, sentry.radius + 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, sentry.radius + 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fill();
    }

    // Sentry Body
    ctx.beginPath();
    ctx.arc(0, 0, sentry.radius, 0, Math.PI * 2);
    ctx.fillStyle = sentry.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    // Spiked Horns
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.moveTo(-9, -6);
    ctx.lineTo(-13, -15);
    ctx.lineTo(-5, -9);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(9, -6);
    ctx.lineTo(13, -15);
    ctx.lineTo(5, -9);
    ctx.closePath();
    ctx.fill();

    // Glowing Cyclops Eye (Red if chasing, Yellow if alert, Green/White if patrolling)
    const eyeColor = sentry.state === 'CHASE' ? '#EF4444' : '#FBBF24';
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(1, -1, 2, 0, Math.PI * 2);
    ctx.fill();

    // Alert / Lost popup icon
    if (sentry.alertState === 'ALERT') {
      ctx.font = '900 16px Inter, sans-serif';
      ctx.fillStyle = '#EF4444';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -sentry.radius - 8);
    } else if (sentry.alertState === 'LOST') {
      ctx.font = '900 14px Inter, sans-serif';
      ctx.fillStyle = '#38BDF8';
      ctx.textAlign = 'center';
      ctx.fillText('?', 0, -sentry.radius - 8);
    }

    ctx.restore();
  }

  private renderMazePlayer(
    ctx: CanvasRenderingContext2D,
    ps: MazePlayer,
    color: string
  ): void {
    ctx.save();
    ctx.translate(ps.x, ps.y);

    // Ghost transparency or invulnerability flashing
    if (ps.ghostTimer > 0) {
      ctx.globalAlpha = 0.55;
    } else if (ps.invulnerableTimer > 0 && Math.floor(performance.now() / 100) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    // Invulnerability Protective Shield Sphere
    if (ps.invulnerableTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, ps.radius + 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.fill();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Floor Shadow
    ctx.beginPath();
    ctx.ellipse(0, 7, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // Player Circle Body
    ctx.beginPath();
    ctx.arc(0, 0, ps.radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    // Ice cube overlay if frozen
    if (ps.freezeTimer > 0) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.fillRect(-ps.radius - 2, -ps.radius - 2, (ps.radius + 2) * 2, (ps.radius + 2) * 2);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-ps.radius - 2, -ps.radius - 2, (ps.radius + 2) * 2, (ps.radius + 2) * 2);
    }

    // Eyes facing movement direction
    const eyeOffsetX = ps.facingDx * 3;
    const eyeOffsetY = ps.facingDy * 3;

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-3 + eyeOffsetX, -3 + eyeOffsetY, 2.8, 0, Math.PI * 2);
    ctx.arc(3 + eyeOffsetX, -3 + eyeOffsetY, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-3 + eyeOffsetX, -3 + eyeOffsetY, 1.4, 0, Math.PI * 2);
    ctx.arc(3 + eyeOffsetX, -3 + eyeOffsetY, 1.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Score Tag above player
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${ps.score}`, ps.x, ps.y - 17);
  }

  private renderCenterHudPod(ctx: CanvasRenderingContext2D, width: number): void {
    const podW = 380;
    const podH = 26;
    const podX = width / 2 - podW / 2;
    const podY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 13);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Map Name Badge
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(`MAZE: ${this.currentMapName}`, podX + 14, podY + 17);

    // Sentry status in center
    ctx.font = '700 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    const chasingCount = this.sentries.filter((s) => s.state === 'CHASE').length;
    if (chasingCount > 0) {
      ctx.fillStyle = '#EF4444';
      ctx.fillText(`⚠️ ${chasingCount} SENTRIES ALERT!`, width / 2, podY + 17);
    } else {
      ctx.fillStyle = '#10B981';
      ctx.fillText(`4 SENTRIES PATROLLING`, width / 2, podY + 17);
    }

    // Timer display
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    const timerColor = this.roundTimer < 10 ? '#EF4444' : '#F1F5F9';
    ctx.fillStyle = timerColor;
    ctx.fillText(`TIME: ${this.roundTimer.toFixed(1)}s`, podX + podW - 14, podY + 17);
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const rankings = active
      .map((p) => {
        const ps = this.playersState.get(p.id);
        const score = ps ? ps.score : 0;
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

    let mvpHighlight = 'Labyrinth Master!';
    if (winnerId !== null) {
      const ps = this.playersState.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} escaped with ${ps?.gemsCollected || 0} gems and ${ps?.score || 0} pts!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
