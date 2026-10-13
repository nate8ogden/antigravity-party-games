import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export interface BasaltPillar {
  id: number;
  x: number;
  y: number;
  col: number;
  row: number;
  radius: number;
  state: 'solid' | 'cracking' | 'submerged' | 'rising';
  stateTimer: number;
  crackLevel: number;
  hasCrystal: boolean;
  geyserWarningTimer: number;
  geyserActiveTimer: number;
  shakeOffset: number;
}

export interface MagmaPlayer {
  id: PlayerId;
  x: number;
  y: number;
  z: number;
  angle: number;
  isAlive: boolean;
  lives: number;
  score: number;
  crystalsCollected: number;
  invulnerableTimer: number;
  currentPillarId: number | null;
  squashAnim: number;

  // Discrete hop state
  isHopping: boolean;
  hopProgress: number;     // 0.0 to 1.0
  hopDuration: number;     // seconds
  hopStartX: number;
  hopStartY: number;
  hopTargetX: number;
  hopTargetY: number;
  hopTargetPillarId: number | null;
  hopCooldown: number;

  // Input debouncing & repeat
  prevSteer: number;
  prevThrottle: number;
  moveHoldTimer: number;
}

export class MagmaHopGame extends BaseGame {
  public pillars: BasaltPillar[] = [];
  public magmaPlayers: Map<PlayerId, MagmaPlayer> = new Map();
  public currentMapName: string = 'Hexagonal Atoll';

  private lavaOffset: number = 0;
  private crystalSpawnTimer: number = 2.0;
  private geyserCycleTimer: number = 4.0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private arenaW: number = 800;
  private arenaH: number = 600;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 35.0;
  }

  public init(width: number, height: number): void {
    this.arenaW = width;
    this.arenaH = height;
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.arenaW = width;
    this.arenaH = height;
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.pillars = [];
    this.magmaPlayers.clear();
    this.botReactionTimers.clear();
    this.lavaOffset = 0;
    this.crystalSpawnTimer = 1.5;
    this.geyserCycleTimer = 4.0;

    // Generate volcanic basalt stepping stone maps
    const spawnPillars = this.generateRandomMap(width, height);

    // Place initial fire crystals on inner safe stones
    const innerPillars = this.pillars.filter((p) => p.col >= 1 && p.col <= 4);
    for (let i = 0; i < Math.min(5, innerPillars.length); i++) {
      const idx = Math.floor(Math.random() * innerPillars.length);
      if (innerPillars[idx]) innerPillars[idx].hasCrystal = true;
    }

    // Spawn active players centered on designated spawn stones
    const active = this.getActivePlayers();
    active.forEach((p, index) => {
      const pil = spawnPillars[index % spawnPillars.length] || this.pillars[0];

      this.magmaPlayers.set(p.id, {
        id: p.id,
        x: pil.x,
        y: pil.y,
        z: 0,
        angle: 0,
        isAlive: true,
        lives: 3,
        score: 0,
        crystalsCollected: 0,
        invulnerableTimer: 0,
        currentPillarId: pil.id,
        squashAnim: 0,
        isHopping: false,
        hopProgress: 0,
        hopDuration: 0.34,
        hopStartX: pil.x,
        hopStartY: pil.y,
        hopTargetX: pil.x,
        hopTargetY: pil.y,
        hopTargetPillarId: pil.id,
        hopCooldown: 0,
        prevSteer: 0,
        prevThrottle: 0,
        moveHoldTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.35 + Math.random() * 0.25);
    });
  }

  private generateRandomMap(width: number, height: number): BasaltPillar[] {
    const archetypes = ['Hexagonal Atoll', 'Twin Islands', 'Crater Ring', 'Volcanic Archipelago'];
    this.currentMapName = archetypes[Math.floor(Math.random() * archetypes.length)];
    this.pillars = [];

    const cols = 6;
    const rows = 4;
    const startX = width * 0.16;
    const spacingX = (width * 0.68) / (cols - 1);
    const startY = height * 0.28;
    const spacingY = (height * 0.58) / (rows - 1);

    let idCounter = 0;
    const spawns: BasaltPillar[] = [];

    switch (this.currentMapName) {
      case 'Twin Islands':
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const isNarrowBridge = (c === 2 || c === 3) && (r === 0 || r === 3);
            const px = startX + c * spacingX;
            const py = startY + r * spacingY;
            const pil: BasaltPillar = {
              id: idCounter++,
              x: px,
              y: py,
              col: c,
              row: r,
              radius: isNarrowBridge ? 30 : 38,
              state: 'solid',
              stateTimer: 0,
              crackLevel: 0,
              hasCrystal: false,
              geyserWarningTimer: 0,
              geyserActiveTimer: 0,
              shakeOffset: 0
            };
            this.pillars.push(pil);
            if ((c === 1 && r === 1) || (c === 4 && r === 1) || (c === 1 && r === 2) || (c === 4 && r === 2)) {
              spawns.push(pil);
            }
          }
        }
        break;

      case 'Crater Ring':
        const cx = width / 2;
        const cy = height * 0.55;
        const centerPil: BasaltPillar = {
          id: idCounter++,
          x: cx,
          y: cy,
          col: 3,
          row: 2,
          radius: 46,
          state: 'solid',
          stateTimer: 0,
          crackLevel: 0,
          hasCrystal: true,
          geyserWarningTimer: 0,
          geyserActiveTimer: 0,
          shakeOffset: 0
        };
        this.pillars.push(centerPil);

        // Inner ring of 7
        for (let i = 0; i < 7; i++) {
          const ang = (i / 7) * Math.PI * 2;
          const pil: BasaltPillar = {
            id: idCounter++,
            x: cx + Math.cos(ang) * 98,
            y: cy + Math.sin(ang) * 82,
            col: (i % 5) + 1,
            row: 1,
            radius: 36,
            state: 'solid',
            stateTimer: 0,
            crackLevel: 0,
            hasCrystal: false,
            geyserWarningTimer: 0,
            geyserActiveTimer: 0,
            shakeOffset: 0
          };
          this.pillars.push(pil);
        }

        // Outer ring of 16
        for (let i = 0; i < 16; i++) {
          const ang = (i / 16) * Math.PI * 2;
          const pil: BasaltPillar = {
            id: idCounter++,
            x: cx + Math.cos(ang) * 195,
            y: cy + Math.sin(ang) * 155,
            col: i % 6,
            row: Math.floor(i / 4),
            radius: 36,
            state: 'solid',
            stateTimer: 0,
            crackLevel: 0,
            hasCrystal: false,
            geyserWarningTimer: 0,
            geyserActiveTimer: 0,
            shakeOffset: 0
          };
          this.pillars.push(pil);
          if (i === 2 || i === 6 || i === 10 || i === 14) {
            spawns.push(pil);
          }
        }
        break;

      case 'Volcanic Archipelago':
      case 'Hexagonal Atoll':
      default:
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const stagger = (r % 2 === 1) ? spacingX * 0.5 : 0;
            const px = startX + c * spacingX + stagger;
            const py = startY + r * spacingY;
            const pil: BasaltPillar = {
              id: idCounter++,
              x: px,
              y: py,
              col: c,
              row: r,
              radius: 36 + (c + r) % 5,
              state: 'solid',
              stateTimer: 0,
              crackLevel: 0,
              hasCrystal: false,
              geyserWarningTimer: 0,
              geyserActiveTimer: 0,
              shakeOffset: 0
            };
            this.pillars.push(pil);
            if ((c === 1 && r === 1) || (c === 4 && r === 1) || (c === 1 && r === 2) || (c === 4 && r === 2)) {
              spawns.push(pil);
            }
          }
        }
        break;
    }

    if (spawns.length < 4) {
      return this.pillars.slice(0, 4);
    }
    return spawns;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.lavaOffset += dt * 1.6;

    // Update AI bots
    this.updateBots(dt, width, height);

    // Update pillars & geysers
    this.updatePillars(dt);

    // Crystal spawning
    this.crystalSpawnTimer -= dt;
    if (this.crystalSpawnTimer <= 0) {
      this.crystalSpawnTimer = 3.5 + Math.random() * 2.0;
      this.spawnCrystal();
    }

    // Geyser eruptions
    this.geyserCycleTimer -= dt;
    if (this.geyserCycleTimer <= 0) {
      this.geyserCycleTimer = 4.2 + Math.random() * 2.2;
      this.triggerRandomGeysers();
    }

    // Update player movement and hopping
    this.updatePlayers(dt);

    // Check round over condition (time runs out or <= 1 alive in multi-player)
    const active = this.getActivePlayers();
    const alivePlayers = Array.from(this.magmaPlayers.values()).filter((p) => p.isAlive);

    if (this.roundTimer <= 0 || (active.length > 1 && alivePlayers.length <= 1)) {
      this.isFinished = true;
    }
  }

  private updatePillars(dt: number): void {
    for (const pil of this.pillars) {
      // Geyser timers
      if (pil.geyserWarningTimer > 0) {
        pil.geyserWarningTimer -= dt;
        if (pil.geyserWarningTimer <= 0) {
          pil.geyserActiveTimer = 1.3;
          this.audio.playExplosion();
          this.particles.shake(6);
          this.particles.spawnExplosion(pil.x, pil.y, '#FF4500', 18);
        }
      } else if (pil.geyserActiveTimer > 0) {
        pil.geyserActiveTimer -= dt;
        if (Math.random() < 0.45) {
          this.particles.spawnSparks(pil.x + (Math.random() - 0.5) * 24, pil.y - 24, '#FFA500', 3);
        }
      }

      // Pillar state transitions
      switch (pil.state) {
        case 'solid':
          pil.shakeOffset = 0;
          pil.crackLevel = 0;
          break;

        case 'cracking':
          pil.stateTimer -= dt;
          pil.crackLevel = Math.min(1, pil.crackLevel + dt * 0.7);
          pil.shakeOffset = (Math.random() - 0.5) * 4 * pil.crackLevel;
          if (pil.stateTimer <= 0) {
            pil.state = 'submerged';
            pil.stateTimer = 2.6; // stays underwater for 2.6s
            pil.hasCrystal = false;
            this.particles.spawnSparks(pil.x, pil.y, '#FF3300', 16);
            this.audio.playBounce();
          }
          break;

        case 'submerged':
          pil.stateTimer -= dt;
          pil.shakeOffset = 0;
          if (pil.stateTimer <= 0) {
            pil.state = 'rising';
            pil.stateTimer = 0.8;
          }
          break;

        case 'rising':
          pil.stateTimer -= dt;
          pil.crackLevel = Math.max(0, pil.stateTimer / 0.8);
          if (pil.stateTimer <= 0) {
            pil.state = 'solid';
            pil.crackLevel = 0;
          }
          break;
      }
    }
  }

  private spawnCrystal(): void {
    const solidPillars = this.pillars.filter((p) => p.state === 'solid' && !p.hasCrystal);
    if (solidPillars.length > 0) {
      const chosen = solidPillars[Math.floor(Math.random() * solidPillars.length)];
      chosen.hasCrystal = true;
      this.particles.spawnSparks(chosen.x, chosen.y, '#F59E0B', 10);
    }
  }

  private triggerRandomGeysers(): void {
    const candidatePillars = this.pillars.filter(
      (p) => p.state !== 'submerged' && p.geyserWarningTimer <= 0 && p.geyserActiveTimer <= 0
    );
    if (candidatePillars.length === 0) return;

    // Pick 1 to 2 random pillars
    const count = Math.min(candidatePillars.length, Math.random() < 0.6 ? 2 : 1);
    for (let i = 0; i < count; i++) {
      const pickIdx = Math.floor(Math.random() * candidatePillars.length);
      const chosen = candidatePillars.splice(pickIdx, 1)[0];
      if (chosen) {
        chosen.geyserWarningTimer = 1.2; // 1.2s clear telegraph
      }
    }
  }

  private updatePlayers(dt: number): void {
    for (const p of this.magmaPlayers.values()) {
      if (!p.isAlive) continue;

      if (p.invulnerableTimer > 0) p.invulnerableTimer -= dt;
      if (p.hopCooldown > 0) p.hopCooldown -= dt;
      if (p.squashAnim > 0) p.squashAnim = Math.max(0, p.squashAnim - dt * 5.0);

      // Read Input
      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      const justUp = this.input.justUp(p.id);
      const justDown = this.input.justDown(p.id);
      const justLeft = this.input.justLeft(p.id);
      const justRight = this.input.justRight(p.id);

      // Handle Hopping Arc Trajectory
      if (p.isHopping) {
        p.hopProgress += dt / p.hopDuration;
        const t = Math.min(1.0, p.hopProgress);

        // Smooth horizontal movement along arc
        p.x = p.hopStartX + (p.hopTargetX - p.hopStartX) * t;
        p.y = p.hopStartY + (p.hopTargetY - p.hopStartY) * t;

        // Crisp parabolic vertical jump height
        p.z = Math.sin(t * Math.PI) * 44;

        if (p.hopProgress >= 1.0) {
          p.isHopping = false;
          p.z = 0;
          p.squashAnim = 0.8;
          p.hopCooldown = 0.08;
          this.onPlayerLanded(p);
        }
      } else {
        // Player is grounded on a pillar
        this.checkStandingPillar(p, dt);

        // Facing update
        if (steer !== 0 || throttle !== 0) {
          p.angle = Math.atan2(-throttle, steer);
        }

        // Direction key changes or hold repeat
        const justSteerChange = (steer !== 0 && steer !== p.prevSteer) || justLeft || justRight;
        const justThrottleChange = (throttle !== 0 && throttle !== p.prevThrottle) || justUp || justDown;
        const freshDirection = justSteerChange || justThrottleChange;

        if (steer !== 0 || throttle !== 0) {
          p.moveHoldTimer += dt;
        } else {
          p.moveHoldTimer = 0;
        }
        const holdRepeat = p.moveHoldTimer >= 0.38;

        const wantsHop = (freshDirection || holdRepeat || justAction) && p.hopCooldown <= 0;

        if (wantsHop) {
          let hopDx = 0;
          let hopDy = 0;

          if (steer !== 0 || throttle !== 0 || justLeft || justRight || justUp || justDown) {
            let dirX = steer;
            if (justRight) dirX = 1;
            else if (justLeft) dirX = -1;

            let dirY = -throttle;
            if (justUp) dirY = -1;
            else if (justDown) dirY = 1;

            hopDx = dirX;
            hopDy = dirY;
          } else if (justAction) {
            // Space / action tap with neutral directional stick: leap in facing direction or toward nearest safe stone
            hopDx = Math.cos(p.angle);
            hopDy = Math.sin(p.angle);
          }

          if (hopDx !== 0 || hopDy !== 0) {
            const isExplicitDirection = (steer !== 0 || throttle !== 0 || justLeft || justRight || justUp || justDown);
            this.initiatePlayerHop(p, hopDx, hopDy, isExplicitDirection);
            if (holdRepeat) {
              p.moveHoldTimer = 0.05; // Quick repeat rhythm when holding
            }
          }
        }
      }

      // Store previous frame steer/throttle for clean edge-triggered hopping
      p.prevSteer = steer;
      p.prevThrottle = throttle;

      // Geyser burn check while near ground
      if (p.z < 20 && p.invulnerableTimer <= 0) {
        for (const pil of this.pillars) {
          if (pil.geyserActiveTimer > 0) {
            const dist = Math.hypot(p.x - pil.x, p.y - pil.y);
            if (dist < pil.radius + 6) {
              this.damagePlayer(p, 'Scorched by Magma Geyser!');
              break;
            }
          }
        }
      }

      // Arena boundary clamp
      p.x = Math.max(30, Math.min(this.arenaW - 30, p.x));
      p.y = Math.max(30, Math.min(this.arenaH - 30, p.y));
    }

    // Player vs Player bump collision
    const pList = Array.from(this.magmaPlayers.values()).filter((p) => p.isAlive);
    for (let i = 0; i < pList.length; i++) {
      for (let j = i + 1; j < pList.length; j++) {
        const p1 = pList[i];
        const p2 = pList[j];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 26;

        if (dist < minDist && Math.abs(p1.z - p2.z) < 22) {
          const nx = (dx / (dist || 1));
          const ny = (dy / (dist || 1));
          p1.x -= nx * 8;
          p1.y -= ny * 8;
          p2.x += nx * 8;
          p2.y += ny * 8;
          this.audio.playBounce();
          this.particles.spawnSparks((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, '#FFFFFF', 8);
        }
      }
    }
  }

  private initiatePlayerHop(
    p: MagmaPlayer,
    dirX: number,
    dirY: number,
    isExplicitDirection: boolean
  ): void {
    const mag = Math.hypot(dirX, dirY);
    if (mag > 0) {
      dirX /= mag;
      dirY /= mag;
    }
    const targetAngle = Math.atan2(dirY, dirX);
    p.angle = targetAngle;

    // Search neighbor pillars within reachable stepping distance [35px, 190px]
    const neighbors = this.pillars.filter((pil) => {
      if (pil.id === p.currentPillarId) return false;
      const d = Math.hypot(pil.x - p.x, pil.y - p.y);
      return d >= 35 && d <= 190;
    });

    let bestNeighbor: BasaltPillar | null = null;
    let bestScore = -Infinity;

    for (const nb of neighbors) {
      const angleToNb = Math.atan2(nb.y - p.y, nb.x - p.x);
      let diff = angleToNb - targetAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      // Check if within ~81 degrees of the player's chosen direction
      if (Math.abs(diff) < (Math.PI * 0.45)) {
        const align = Math.cos(diff); // 1 = directly on vector
        const dist = Math.hypot(nb.x - p.x, nb.y - p.y);
        const score = align * 100 - (dist / 190) * 20;
        if (score > bestScore) {
          bestScore = score;
          bestNeighbor = nb;
        }
      }
    }

    // If single action button was pressed with no explicit direction and no forward neighbor found,
    // pick the nearest safe solid or crystal-bearing neighbor stone
    if (!bestNeighbor && !isExplicitDirection && neighbors.length > 0) {
      const safeNeighbors = neighbors.filter((n) => n.state === 'solid' && n.geyserActiveTimer <= 0);
      const candidates = safeNeighbors.length > 0 ? safeNeighbors : neighbors;
      bestNeighbor = candidates.reduce((prev, curr) => {
        const dPrev = Math.hypot(prev.x - p.x, prev.y - p.y);
        const dCurr = Math.hypot(curr.x - p.x, curr.y - p.y);
        return dCurr < dPrev ? curr : prev;
      });
    }

    if (bestNeighbor) {
      // Leap cleanly to candidate neighbor pillar!
      this.startHop(p, bestNeighbor.id, bestNeighbor.x, bestNeighbor.y);
    } else if (isExplicitDirection) {
      // Explicitly directed hop with no stone in that direction: leap off the edge into lava!
      const lavaLandingX = p.x + dirX * 125;
      const lavaLandingY = p.y + dirY * 125;
      this.startHop(p, null, lavaLandingX, lavaLandingY);
    }
  }

  private startHop(p: MagmaPlayer, targetPillarId: number | null, tx: number, ty: number): void {
    p.isHopping = true;
    p.hopProgress = 0;
    p.hopDuration = 0.34;
    p.hopStartX = p.x;
    p.hopStartY = p.y;
    p.hopTargetX = tx;
    p.hopTargetY = ty;
    p.hopTargetPillarId = targetPillarId;
    p.angle = Math.atan2(ty - p.y, tx - p.x);

    this.audio.playTap();
    this.particles.spawnSparks(p.x, p.y, '#FF8C00', 6);
  }

  private onPlayerLanded(p: MagmaPlayer): void {
    let landingPillar: BasaltPillar | null = null;
    if (p.hopTargetPillarId !== null) {
      landingPillar = this.pillars.find((x) => x.id === p.hopTargetPillarId) || null;
    }

    if (!landingPillar) {
      landingPillar = this.findNearestPillar(p.x, p.y);
      const dist = landingPillar ? Math.hypot(p.x - landingPillar.x, p.y - landingPillar.y) : 999;
      if (!landingPillar || dist > landingPillar.radius + 6) {
        landingPillar = null;
      }
    }

    if (!landingPillar || landingPillar.state === 'submerged') {
      // Splashed into lava!
      this.damagePlayer(p, 'Fell into Molten Lava!');
    } else if (landingPillar.geyserActiveTimer > 0) {
      // Landed in active geyser
      this.damagePlayer(p, 'Scorched by Magma Geyser!');
    } else {
      // Landed safely on pillar!
      p.currentPillarId = landingPillar.id;
      p.x = landingPillar.x; // Snaps to stone center
      p.y = landingPillar.y;
      this.audio.playTap();
      this.particles.spawnSparks(landingPillar.x, landingPillar.y, '#FFA500', 8);

      // Collect crystal if present
      if (landingPillar.hasCrystal) {
        landingPillar.hasCrystal = false;
        p.score += 100;
        p.crystalsCollected += 1;
        this.audio.playScore();
        this.particles.spawnSparks(landingPillar.x, landingPillar.y, '#F59E0B', 18);
      }

      // Trigger cracking if it was solid
      if (landingPillar.state === 'solid') {
        landingPillar.state = 'cracking';
        landingPillar.stateTimer = 1.8; // 1.8s survival window before sinking
      }
    }
  }

  private checkStandingPillar(p: MagmaPlayer, dt: number): void {
    if (p.currentPillarId === null) return;
    const pil = this.pillars.find((x) => x.id === p.currentPillarId);
    if (!pil) return;

    if (pil.state === 'submerged') {
      this.damagePlayer(p, 'Pillar Submerged!');
    } else if (pil.state === 'cracking') {
      // Passive survival score while bravely holding ground
      p.score += dt * 15;
    }
  }

  private damagePlayer(p: MagmaPlayer, _reason: string): void {
    if (p.invulnerableTimer > 0 || !p.isAlive) return;

    p.lives -= 1;
    this.audio.playExplosion();
    this.particles.shake(8);
    this.particles.spawnExplosion(p.x, p.y, '#FF4500', 22);

    if (p.lives <= 0) {
      p.isAlive = false;
      p.z = 0;
      p.isHopping = false;
    } else {
      p.invulnerableTimer = 1.6;
      p.isHopping = false;
      p.hopCooldown = 0.2;

      // Respawn drop-in on nearest solid safe pillar
      const safePillars = this.pillars.filter(
        (pil) => pil.state === 'solid' && pil.geyserActiveTimer <= 0 && pil.geyserWarningTimer <= 0
      );
      const respawnTarget = safePillars.length > 0
        ? safePillars[Math.floor(Math.random() * safePillars.length)]
        : this.pillars[0];

      p.x = respawnTarget.x;
      p.y = respawnTarget.y;
      p.z = 40; // drop-in from above
      p.currentPillarId = respawnTarget.id;
    }
  }

  private findNearestPillar(x: number, y: number): BasaltPillar | null {
    let nearest: BasaltPillar | null = null;
    let minDist = Infinity;
    for (const pil of this.pillars) {
      const d = Math.hypot(x - pil.x, y - pil.y);
      if (d < minDist) {
        minDist = d;
        nearest = pil;
      }
    }
    return nearest;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const bot = this.magmaPlayers.get(botId);
    if (!bot || !bot.isAlive || bot.isHopping) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;

    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    // Reaction interval calibrated by difficulty
    const nextInterval =
      difficulty === 'bot_easy'
        ? 0.45 + Math.random() * 0.30
        : difficulty === 'bot_normal'
        ? 0.24 + Math.random() * 0.16
        : 0.12 + Math.random() * 0.08;
    this.botReactionTimers.set(botId, nextInterval);

    // Current pillar status
    const curPillar = this.pillars.find((p) => p.id === bot.currentPillarId);
    const mustFlee =
      !curPillar ||
      curPillar.state === 'cracking' ||
      curPillar.state === 'submerged' ||
      curPillar.geyserWarningTimer > 0 ||
      curPillar.geyserActiveTimer > 0;

    // Search reachable neighbor pillars [35px, 190px]
    const candidates = this.pillars.filter((p) => {
      if (p.id === bot.currentPillarId) return false;
      const dist = Math.hypot(p.x - bot.x, p.y - bot.y);
      return dist >= 35 && dist <= 190;
    });

    if (candidates.length === 0) return;

    // Score candidates
    let bestPillar: BasaltPillar | null = null;
    let bestScore = -9999;

    for (const cand of candidates) {
      let score = 0;
      if (cand.state === 'solid') score += 100;
      else if (cand.state === 'rising') score += 40;
      else if (cand.state === 'cracking') score -= (difficulty === 'bot_hard' ? 80 : 30);
      else if (cand.state === 'submerged') score -= 800;

      // Geyser danger
      if (cand.geyserActiveTimer > 0) score -= 900;
      if (cand.geyserWarningTimer > 0) {
        score -= (difficulty === 'bot_easy' ? 60 : 700);
      }

      // Fire crystal incentive
      if (cand.hasCrystal) {
        score += (difficulty === 'bot_hard' ? 240 : 160);
      }

      // Distance penalty to favor close hops
      const dist = Math.hypot(cand.x - bot.x, cand.y - bot.y);
      score -= (dist / 175) * 15;

      // Easy bots make occasional random choices
      if (difficulty === 'bot_easy') {
        score += (Math.random() - 0.5) * 60;
      }

      if (score > bestScore) {
        bestScore = score;
        bestPillar = cand;
      }
    }

    // Decide if bot hops now
    if (bestPillar && (mustFlee || bestScore > 110 || Math.random() < 0.45)) {
      this.startHop(bot, bestPillar.id, bestPillar.x, bestPillar.y);
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const scores = active.map((p) => {
      const mp = this.magmaPlayers.get(p.id);
      const finalScore = mp ? Math.round(mp.score + mp.lives * 150) : 0;
      return {
        playerId: p.id,
        score: finalScore,
        crystals: mp?.crystalsCollected || 0,
        lives: mp?.lives || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);

    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topCrystals = scores[0]?.crystals || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} mastered the basalt pillars with ${topCrystals} crystals!`
      : 'All jumpers consumed by molten fury!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Draw glowing magma sea background with heat waves
    const lavaGrad = ctx.createLinearGradient(0, 0, width, height);
    lavaGrad.addColorStop(0, '#5E0D00');
    lavaGrad.addColorStop(0.5, '#991B00');
    lavaGrad.addColorStop(1, '#4A0800');
    ctx.fillStyle = lavaGrad;
    ctx.fillRect(0, 0, width, height);

    // Molten magma surface ripples
    ctx.save();
    ctx.fillStyle = 'rgba(255, 90, 0, 0.22)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      const waveY = (height / 6) * i + Math.sin(this.lavaOffset + i) * 16;
      ctx.ellipse(width * 0.5, waveY, width * 0.55, 28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Draw Basalt Pillars
    for (const pil of this.pillars) {
      this.renderPillar(ctx, pil);
    }

    // 3. Draw Players
    for (const p of this.magmaPlayers.values()) {
      if (!p.isAlive) continue;
      this.renderPlayer(ctx, p);
    }

    // 4. Draw HUD / Lives & Crystals
    this.renderHUD(ctx, width, height);
  }

  private renderPillar(ctx: CanvasRenderingContext2D, pil: BasaltPillar): void {
    ctx.save();
    const px = pil.x + pil.shakeOffset;
    const py = pil.y;

    if (pil.state === 'submerged') {
      // Molten bubbling patch where pillar sank
      ctx.fillStyle = '#FF3B00';
      ctx.beginPath();
      ctx.arc(px, py, pil.radius * 0.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFE600';
      ctx.beginPath();
      ctx.arc(px, py, pil.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Basalt 3D cylinder shadow
    const sinkDepth = pil.state === 'cracking' ? pil.crackLevel * 8 : (pil.state === 'rising' ? 8 : 0);
    const renderY = py + sinkDepth;

    // Pillar side (depth)
    ctx.fillStyle = '#1A141A';
    ctx.beginPath();
    ctx.ellipse(px, renderY + 12, pil.radius, pil.radius * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pillar stone top surface
    const topGrad = ctx.createRadialGradient(px, renderY - 4, 4, px, renderY, pil.radius);
    if (pil.state === 'cracking') {
      topGrad.addColorStop(0, '#552211');
      topGrad.addColorStop(0.7, '#2D1B18');
      topGrad.addColorStop(1, '#180E0C');
    } else {
      topGrad.addColorStop(0, '#4A4A58');
      topGrad.addColorStop(0.7, '#2C2B36');
      topGrad.addColorStop(1, '#1A1922');
    }

    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.ellipse(px, renderY, pil.radius, pil.radius * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hexagonal / Chiseled border rim
    ctx.strokeStyle = pil.state === 'cracking' ? '#FF5500' : '#68667A';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Cracks if cracking
    if (pil.crackLevel > 0) {
      ctx.strokeStyle = '#FFAA00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px - pil.radius * 0.4, renderY - 8);
      ctx.lineTo(px, renderY);
      ctx.lineTo(px + pil.radius * 0.5, renderY + 6);
      ctx.moveTo(px, renderY);
      ctx.lineTo(px - 6, renderY + 14);
      ctx.stroke();
    }

    // Geyser telegraph / eruption
    if (pil.geyserWarningTimer > 0) {
      ctx.fillStyle = 'rgba(255, 69, 0, 0.55)';
      ctx.beginPath();
      ctx.ellipse(px, renderY, pil.radius * 0.8, pil.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pulsing warning ring
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (pil.geyserActiveTimer > 0) {
      // Fire plume blasting up
      const plumeGrad = ctx.createLinearGradient(px, renderY, px, renderY - 90);
      plumeGrad.addColorStop(0, 'rgba(255, 200, 0, 0.9)');
      plumeGrad.addColorStop(0.5, 'rgba(255, 60, 0, 0.85)');
      plumeGrad.addColorStop(1, 'rgba(200, 0, 0, 0)');

      ctx.fillStyle = plumeGrad;
      ctx.beginPath();
      ctx.moveTo(px - pil.radius * 0.6, renderY);
      ctx.lineTo(px - pil.radius * 0.2, renderY - 95);
      ctx.lineTo(px + pil.radius * 0.2, renderY - 95);
      ctx.lineTo(px + pil.radius * 0.6, renderY);
      ctx.closePath();
      ctx.fill();
    }

    // Fire Crystal on top
    if (pil.hasCrystal) {
      const crystalBob = Math.sin(this.lavaOffset * 3 + pil.id) * 4;
      const cy = renderY - 14 + crystalBob;

      // Glow halo
      ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.beginPath();
      ctx.arc(px, cy, 14, 0, Math.PI * 2);
      ctx.fill();

      // Crystal Diamond
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.moveTo(px, cy - 10);
      ctx.lineTo(px + 7, cy);
      ctx.lineTo(px, cy + 10);
      ctx.lineTo(px - 7, cy);
      ctx.closePath();
      ctx.fill();

      // Highlight facet
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.moveTo(px, cy - 10);
      ctx.lineTo(px + 4, cy);
      ctx.lineTo(px, cy + 4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, p: MagmaPlayer): void {
    const cfg = this.players.find((x) => x.id === p.id);
    const color = cfg ? cfg.color : '#FFFFFF';
    const colorDark = cfg ? cfg.colorDark : '#333333';

    ctx.save();

    // Drop shadow (grows smaller when jumping high)
    const shadowScale = Math.max(0.3, 1 - p.z / 90);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 4, 14 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Invulnerability flashing
    if (p.invulnerableTimer > 0 && Math.floor(p.invulnerableTimer * 12) % 2 === 0) {
      ctx.restore();
      return;
    }

    // Player position elevated by jump Z
    const renderY = p.y - p.z;

    // Body squash/stretch based on jump
    const stretchY = 1 + (p.isHopping ? 0.25 : (p.squashAnim > 0 ? -0.25 : 0));
    const stretchX = 1 / stretchY;

    ctx.translate(p.x, renderY);
    ctx.scale(stretchX, stretchY);

    // Outer glow aura
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    // Character body (armored hopping droid)
    ctx.fillStyle = colorDark;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, -2, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Specular highlight on dome
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.arc(-4, -6, 5, 0, Math.PI * 2);
    ctx.fill();

    // Eye / Visor facing movement direction
    const eyeOffsetX = Math.cos(p.angle) * 5;
    const eyeOffsetY = Math.sin(p.angle) * 5 - 2;

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.ellipse(eyeOffsetX, eyeOffsetY, 6, 5, p.angle, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.arc(eyeOffsetX + 1, eyeOffsetY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Player ID Pill above head
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 10px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`P${p.id + 1}`, 0, -20);

    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, _height: number): void {
    ctx.save();
    // Round timer badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 55, 12, 110, 36, 10);
    ctx.fill();
    ctx.strokeStyle = '#F97316';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(this.roundTimer)}s`, width * 0.5, 30);

    // Center sub-bar displaying player crystal counts & hearts/lives
    const active = this.getActivePlayers();
    const itemW = 120;
    const subBarW = active.length * itemW;
    const subBarX = width * 0.5 - subBarW * 0.5;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(subBarX, 54, subBarW, 26, 6);
    ctx.fill();

    active.forEach((p, idx) => {
      const mp = this.magmaPlayers.get(p.id);
      const px = subBarX + idx * itemW + itemW / 2;
      ctx.fillStyle = p.color;
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const hearts = mp ? '❤️'.repeat(Math.max(0, mp.lives)) : '';
      ctx.fillText(`P${p.id + 1} 💎${mp?.crystalsCollected || 0} ${hearts}`, px, 67);
    });

    ctx.restore();
  }
}
