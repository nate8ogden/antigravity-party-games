import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';
import { AchievementManager } from '../core/AchievementManager';
import { CharacterMood } from '../core/CharacterRenderer';

interface Tank {
  id: PlayerId;
  x: number;
  y: number;
  angle: number;
  speed: number;
  alive: boolean;
  lives: number;
  cooldown: number;
  maxCooldown: number;
  hasShield: boolean;
  tripleShotTimer: number;
  railgunTimer: number;
  kills: number;
  ricochetKills: number;
  lastTapTime: number;
  tractionBoostTimer: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: PlayerId;
  bouncesLeft: number;
  initialBounces: number;
  isRailgun: boolean;
  color: string;
}

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  destructible: boolean;
  health: number;
  isBarrel: boolean;
}

interface PowerUp {
  x: number;
  y: number;
  type: 'shield' | 'triple' | 'mine';
  life: number;
}

interface Mine {
  x: number;
  y: number;
  ownerId: PlayerId;
  timer: number;
}

interface TreadMark {
  x: number;
  y: number;
  angle: number;
  alpha: number;
}

export class CyberTanksGame extends BaseGame {
  private tanks: Map<PlayerId, Tank> = new Map();
  private bullets: Bullet[] = [];
  private obstacles: Obstacle[] = [];
  private powerUps: PowerUp[] = [];
  private mines: Mine[] = [];
  private treadMarks: TreadMark[] = [];
  private arenaBounds = { x: 40, y: 40, w: 900, h: 520 };
  private powerupSpawnTimer: number = 5;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private botAimOffsets: Map<PlayerId, number> = new Map();
  private botLastEvalTimes: Map<PlayerId, number> = new Map();

  public isMultiRound: boolean = true;
  public targetWins: number = 2; // Best of 3: first to 2 round wins
  public currentRound: number = 1;
  public maxRounds: number = 3;
  public roundWins: Map<PlayerId, number> = new Map();
  public roundState: 'PLAYING' | 'ROUND_END' | 'MATCH_OVER' = 'PLAYING';
  public roundEndTimer: number = 0;
  public roundWinnerId: PlayerId | null = null;

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundWins.clear();
    const active = this.getActivePlayers();
    for (const p of active) {
      this.roundWins.set(p.id, 0);
    }
    this.currentRound = 1;
    this.roundState = 'PLAYING';
    this.roundWinnerId = null;
    this.isFinished = false;
    this.startNewSubRound(width, height);
  }

  public startNewSubRound(width: number, height: number): void {
    this.roundTimer = 45;
    this.suddenDeathActive = false;
    this.bullets = [];
    this.powerUps = [];
    this.mines = [];
    this.treadMarks = [];
    this.powerupSpawnTimer = 6;
    this.roundState = 'PLAYING';
    this.roundWinnerId = null;

    // Define arena centered
    const marginX = Math.max(30, width * 0.06);
    const marginY = Math.max(30, height * 0.08);
    this.arenaBounds = {
      x: marginX,
      y: marginY,
      w: width - marginX * 2,
      h: height - marginY * 2
    };

    const cx = this.arenaBounds.x + this.arenaBounds.w / 2;
    const cy = this.arenaBounds.y + this.arenaBounds.h / 2;
    const ow = Math.min(80, this.arenaBounds.w * 0.12);
    const oh = Math.min(80, this.arenaBounds.h * 0.16);

    // Procedural dense map generation: obstacles everywhere except the 4 corner spawn points!
    this.generateRandomMap(cx, cy, ow, oh);

    // Spawn / respawn tanks in corners with generous clearance
    const active = this.getActivePlayers();
    const spawnOffsets = [
      { x: this.arenaBounds.x + 60, y: this.arenaBounds.y + 60, angle: Math.PI / 4 }, // P1
      { x: this.arenaBounds.x + this.arenaBounds.w - 60, y: this.arenaBounds.y + 60, angle: (Math.PI * 3) / 4 }, // P2
      { x: this.arenaBounds.x + 60, y: this.arenaBounds.y + this.arenaBounds.h - 60, angle: -Math.PI / 4 }, // P3
      { x: this.arenaBounds.x + this.arenaBounds.w - 60, y: this.arenaBounds.y + this.arenaBounds.h - 60, angle: (-Math.PI * 3) / 4 } // P4
    ];

    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const pos = spawnOffsets[p.id % spawnOffsets.length];
      const existing = this.tanks.get(p.id);
      if (existing) {
        existing.x = pos.x;
        existing.y = pos.y;
        existing.angle = pos.angle;
        existing.speed = 0;
        existing.alive = true;
        existing.lives = 3;
        existing.cooldown = 0;
        existing.maxCooldown = 1.2;
        existing.hasShield = false;
        existing.tripleShotTimer = 0;
        existing.railgunTimer = 0;
        existing.tractionBoostTimer = 0;
      } else {
        this.tanks.set(p.id, {
          id: p.id,
          x: pos.x,
          y: pos.y,
          angle: pos.angle,
          speed: 0,
          alive: true,
          lives: 3,
          cooldown: 0,
          maxCooldown: 1.2,
          hasShield: false,
          tripleShotTimer: 0,
          railgunTimer: 0,
          kills: 0,
          ricochetKills: 0,
          lastTapTime: 0,
          tractionBoostTimer: 0
        });
      }
    }

    if (typeof window !== 'undefined' && (window as any).__GAME_MANAGER__) {
      (window as any).__GAME_MANAGER__.matchElapsedSeconds = 0;
    }
  }

  public currentMapName: string = 'Crossroads';

  private generateRandomMap(cx: number, cy: number, ow: number, oh: number): void {
    const archetypes = ['Crate Labyrinth', 'Pillar Fortress', 'Trench Alleys', 'Crossroads', 'Ricochet Courtyard'];
    this.currentMapName = archetypes[Math.floor(Math.random() * archetypes.length)];
    this.obstacles = [];

    // The 4 corner spawn bays (clear radius of 105px guarantees tanks never get blocked at spawn)
    const spawnOffsets = [
      { x: this.arenaBounds.x + 60, y: this.arenaBounds.y + 60 },
      { x: this.arenaBounds.x + this.arenaBounds.w - 60, y: this.arenaBounds.y + 60 },
      { x: this.arenaBounds.x + 60, y: this.arenaBounds.y + this.arenaBounds.h - 60 },
      { x: this.arenaBounds.x + this.arenaBounds.w - 60, y: this.arenaBounds.y + this.arenaBounds.h - 60 }
    ];

    const isNearSpawn = (x: number, y: number, w: number, h: number, margin: number = 105) => {
      const centerX = x + w / 2;
      const centerY = y + h / 2;
      return spawnOffsets.some((sp) => Math.hypot(centerX - sp.x, centerY - sp.y) < margin);
    };

    // Dense grid covering the arena from edge to edge
    const startX = this.arenaBounds.x + 36;
    const endX = this.arenaBounds.x + this.arenaBounds.w - 36;
    const startY = this.arenaBounds.y + 36;
    const endY = this.arenaBounds.y + this.arenaBounds.h - 36;
    const stepX = 58;
    const stepY = 52;
    const cols = Math.floor((endX - startX) / stepX);
    const rows = Math.floor((endY - startY) / stepY);

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const ox = startX + c * stepX;
        const oy = startY + r * stepY;
        const size = 36;

        if (isNearSpawn(ox, oy, size, size, 105)) {
          continue; // Keep all 4 player spawn corners 100% clear!
        }

        // Determine obstacle placement and type based on the archetype
        let shouldPlace = false;
        let isDestructible = true;
        let health = 3;
        let isBarrel = false;
        let obsW = size;
        let obsH = size;

        switch (this.currentMapName) {
          case 'Crate Labyrinth':
            // High-density urban warehouse maze (place in ~55% of cells)
            if ((c + r) % 2 === 0 || c % 3 === 1) {
              shouldPlace = true;
              const rnd = (c * 17 + r * 31) % 10;
              if (rnd < 6) {
                isDestructible = true;
                health = 3;
                isBarrel = false;
              } else if (rnd < 8) {
                isDestructible = true;
                health = 1;
                isBarrel = true;
                obsW = 32;
                obsH = 32;
              } else {
                isDestructible = false;
                health = 100;
                isBarrel = false;
              }
            }
            break;

          case 'Pillar Fortress':
            // Fortified titanium pillars with connecting crate depots
            if (c % 2 === 1 && r % 2 === 1) {
              shouldPlace = true;
              isDestructible = false;
              health = 100;
              isBarrel = false;
              obsW = 40;
              obsH = 40;
            } else if ((c + r) % 3 === 0) {
              shouldPlace = true;
              const isB = (c * 7 + r * 13) % 4 === 0;
              isDestructible = true;
              health = isB ? 1 : 3;
              isBarrel = isB;
              obsW = isB ? 32 : 36;
              obsH = isB ? 32 : 36;
            }
            break;

          case 'Trench Alleys':
            // Long horizontal trenches and defensive bunker barriers
            if (r % 2 === 1 && c % 4 !== 2) {
              shouldPlace = true;
              isDestructible = false;
              health = 100;
              isBarrel = false;
            } else if (c % 3 === 0 && (c + r) % 2 === 1) {
              shouldPlace = true;
              const isB = (c + r) % 3 === 0;
              isDestructible = true;
              health = isB ? 1 : 3;
              isBarrel = isB;
              obsW = isB ? 32 : 36;
              obsH = isB ? 32 : 36;
            }
            break;

          case 'Crossroads':
            // Central cross citadel with radiating diagonal barricade wings
            const midC = Math.floor(cols / 2);
            const midR = Math.floor(rows / 2);
            const distFromMid = Math.hypot(c - midC, r - midR);
            if (distFromMid < 2.2) {
              shouldPlace = true;
              isDestructible = false;
              health = 100;
              isBarrel = false;
            } else if (Math.abs(c - midC) === Math.abs(r - midR) || (c + r) % 2 === 0) {
              shouldPlace = true;
              const rnd = (c * 19 + r * 23) % 10;
              isDestructible = rnd >= 2;
              health = rnd < 2 ? 100 : rnd < 5 ? 1 : 3;
              isBarrel = rnd >= 2 && rnd < 5;
              obsW = isBarrel ? 32 : 36;
              obsH = isBarrel ? 32 : 36;
            }
            break;

          case 'Ricochet Courtyard':
          default:
            // Geometric diamond and zigzag layout engineered for bank shots
            if ((c * 2 + r) % 3 === 0 || (c + r * 2) % 4 === 0) {
              shouldPlace = true;
              const rnd = (c * 11 + r * 29) % 10;
              isDestructible = rnd >= 4;
              health = rnd < 4 ? 100 : rnd < 7 ? 1 : 3;
              isBarrel = rnd >= 4 && rnd < 7;
              obsW = isBarrel ? 32 : 36;
              obsH = isBarrel ? 32 : 36;
            }
            break;
        }

        if (shouldPlace) {
          this.obstacles.push({
            x: ox + (size - obsW) / 2,
            y: oy + (size - obsH) / 2,
            w: obsW,
            h: obsH,
            destructible: isDestructible,
            health,
            isBarrel
          });
        }
      }
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.roundState === 'ROUND_END') {
      this.roundEndTimer -= dt;
      if (this.roundEndTimer <= 0) {
        let maxWins = 0;
        for (const wins of this.roundWins.values()) {
          if (wins > maxWins) maxWins = wins;
        }

        if (maxWins >= this.targetWins || this.currentRound >= this.maxRounds) {
          this.roundState = 'MATCH_OVER';
          this.isFinished = true;
          return;
        }

        // Advance to next round in Best of 3
        this.currentRound++;
        this.startNewSubRound(width, height);
      }
      return;
    }

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Sudden Death Demolition: if roundTimer <= 15 or stagnation triggers, break all crates to bust stalemates
    this.updateStagnationWatchdog(dt, () => {
      this.demolishDestructibleCrates();
    });
    if (this.roundTimer <= 15 && !this.suddenDeathActive) {
      this.suddenDeathActive = true;
      this.demolishDestructibleCrates();
      this.audio.playExplosion();
      this.particles.showFloatingText('⚠️ SUDDEN DEATH CRATE COLLAPSE!', 480, 80, '#EF4444', 22);
    }

    // Spawn power-ups
    this.powerupSpawnTimer -= dt;
    if (this.powerupSpawnTimer <= 0 && this.powerUps.length < 3) {
      this.powerupSpawnTimer = 8 + Math.random() * 5;
      const types: ('shield' | 'triple' | 'mine')[] = ['shield', 'triple', 'mine'];
      const chosen = types[Math.floor(Math.random() * types.length)];
      this.powerUps.push({
        x: this.arenaBounds.x + 60 + Math.random() * (this.arenaBounds.w - 120),
        y: this.arenaBounds.y + 60 + Math.random() * (this.arenaBounds.h - 120),
        type: chosen,
        life: 15
      });
    }

    // Update powerups decay
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      this.powerUps[i].life -= dt;
      if (this.powerUps[i].life <= 0) this.powerUps.splice(i, 1);
    }

    // Process Tanks
    for (const tank of this.tanks.values()) {
      if (!tank.alive) continue;

      tank.cooldown = Math.max(0, tank.cooldown - dt);
      if (tank.tripleShotTimer > 0) tank.tripleShotTimer -= dt;
      if (tank.railgunTimer > 0) tank.railgunTimer -= dt;

      const isPressed = this.input.isPressed(tank.id);
      const justPressed = this.input.justPressed(tank.id);
      const steer = this.input.getSteer(tank.id);
      const throttle = this.input.getThrottle(tank.id);
      const action = this.input.isActionPressed(tank.id) || this.input.justAction(tank.id);

      // Multi-control steering & acceleration:
      // Desktop / Keyboard: WASD, Arrow keys, or Steer Left/Right
      if (steer !== 0) {
        tank.angle += steer * 3.8 * dt;
      } else if (!isPressed && throttle === 0) {
        // Single-button mobile fallback: gentle auto-rotation when idle
        tank.angle += 2.2 * dt;
      }

      // Universal Anti-Loop Detection: prevent endless in-place spinning
      this.trackAntiLoop(tank.id, tank.x, tank.y, tank.angle, dt, 42, () => {
        // Traction Breakout: burst tank forward out of circular loop trap
        tank.tractionBoostTimer = 1.0;
        tank.speed = 200;
        this.particles.showFloatingText('⚡ TRACTION BREAKOUT!', tank.x, tank.y - 25, '#38BDF8', 18);
        this.particles.spawnSparks(tank.x, tank.y, '#38BDF8', 12);
        this.audio.playBoost();
      });

      if (tank.tractionBoostTimer > 0) {
        tank.tractionBoostTimer -= dt;
        tank.speed = Math.max(tank.speed, 180);
      } else if (throttle > 0) {
        tank.speed = Math.min(220, tank.speed + 450 * dt);
      } else if (throttle < 0) {
        tank.speed = Math.max(-110, tank.speed - 350 * dt);
      } else if (isPressed && steer === 0) {
        // Single button hold: drive forward smoothly!
        tank.speed = Math.min(200, tank.speed + 400 * dt);
      } else {
        // Friction when no throttle
        tank.speed *= Math.pow(0.82, dt * 60);
      }

      // Instant firing on action key (Space, Enter, etc.) or crisp tap
      if (action || (justPressed && steer === 0 && throttle === 0)) {
        this.fireBullet(tank);
      }

      // Move tank forward
      const nextX = tank.x + Math.cos(tank.angle) * tank.speed * dt;
      const nextY = tank.y + Math.sin(tank.angle) * tank.speed * dt;

      // Obstacle & boundary collision
      const radius = 18;
      if (
        nextX - radius >= this.arenaBounds.x &&
        nextX + radius <= this.arenaBounds.x + this.arenaBounds.w &&
        !this.checkObstacleCollision(nextX, tank.y, radius)
      ) {
        tank.x = nextX;
      }
      if (
        nextY - radius >= this.arenaBounds.y &&
        nextY + radius <= this.arenaBounds.y + this.arenaBounds.h &&
        !this.checkObstacleCollision(tank.x, nextY, radius)
      ) {
        tank.y = nextY;
      }

      // Power-up pickup
      for (let i = this.powerUps.length - 1; i >= 0; i--) {
        const pu = this.powerUps[i];
        if (Math.hypot(tank.x - pu.x, tank.y - pu.y) < radius + 16) {
          this.audio.playBoost();
          if (pu.type === 'shield') {
            tank.hasShield = true;
            this.particles.showFloatingText('SHIELD!', tank.x, tank.y - 20, '#60A5FA');
          } else if (pu.type === 'triple') {
            tank.tripleShotTimer = 8;
            this.particles.showFloatingText('TRIPLE SHOT!', tank.x, tank.y - 20, '#F59E0B');
          } else if (pu.type === 'mine') {
            this.mines.push({ x: tank.x, y: tank.y, ownerId: tank.id, timer: 1.5 });
            this.particles.showFloatingText('MINE PLANTED!', tank.x, tank.y - 20, '#EF4444');
          }
          this.powerUps.splice(i, 1);
        }
      }

      // Tank tread marks
      if (Math.abs(tank.speed) > 25) {
        if (Math.random() < 0.35) {
          this.treadMarks.push({
            x: tank.x,
            y: tank.y,
            angle: tank.angle,
            alpha: 0.55
          });
          if (this.treadMarks.length > 160) {
            this.treadMarks.shift();
          }
        }
      }

      // Tank tracks smoke
      if (Math.random() < 0.2 && tank.speed > 50) {
        this.particles.spawnSmoke(tank.x - Math.cos(tank.angle) * 14, tank.y - Math.sin(tank.angle) * 14);
      }
    }

    // Fade tread marks
    for (let i = this.treadMarks.length - 1; i >= 0; i--) {
      this.treadMarks[i].alpha -= dt * 0.05;
      if (this.treadMarks[i].alpha <= 0) {
        this.treadMarks.splice(i, 1);
      }
    }

    // Update Mines
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const mine = this.mines[i];
      if (mine.timer > 0) {
        mine.timer -= dt;
        continue;
      }
      for (const tank of this.tanks.values()) {
        if (!tank.alive) continue;
        if (Math.hypot(tank.x - mine.x, tank.y - mine.y) < 28) {
          this.audio.playExplosion();
          this.particles.spawnExplosion(mine.x, mine.y, '#EF4444', 32);
          this.damageTank(tank, mine.ownerId);
          this.mines.splice(i, 1);
          break;
        }
      }
    }

    // Update Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt * 60;
      b.y += b.vy * dt * 60;

      // Bounce on arena borders
      let bounced = false;
      if (b.x < this.arenaBounds.x) {
        b.x = this.arenaBounds.x;
        b.vx = -b.vx;
        bounced = true;
      } else if (b.x > this.arenaBounds.x + this.arenaBounds.w) {
        b.x = this.arenaBounds.x + this.arenaBounds.w;
        b.vx = -b.vx;
        bounced = true;
      }
      if (b.y < this.arenaBounds.y) {
        b.y = this.arenaBounds.y;
        b.vy = -b.vy;
        bounced = true;
      } else if (b.y > this.arenaBounds.y + this.arenaBounds.h) {
        b.y = this.arenaBounds.y + this.arenaBounds.h;
        b.vy = -b.vy;
        bounced = true;
      }

      // Obstacle collision
      for (const obs of this.obstacles) {
        if (b.x >= obs.x && b.x <= obs.x + obs.w && b.y >= obs.y && b.y <= obs.y + obs.h) {
          bounced = true;
          // reflect
          const overlapLeft = Math.abs(b.x - obs.x);
          const overlapRight = Math.abs(b.x - (obs.x + obs.w));
          const overlapTop = Math.abs(b.y - obs.y);
          const overlapBottom = Math.abs(b.y - (obs.y + obs.h));
          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
          if (minOverlap === overlapLeft) {
            b.x = obs.x - 1;
            b.vx = -Math.abs(b.vx);
          } else if (minOverlap === overlapRight) {
            b.x = obs.x + obs.w + 1;
            b.vx = Math.abs(b.vx);
          } else if (minOverlap === overlapTop) {
            b.y = obs.y - 1;
            b.vy = -Math.abs(b.vy);
          } else {
            b.y = obs.y + obs.h + 1;
            b.vy = Math.abs(b.vy);
          }

          if (obs.destructible) {
            obs.health--;
            this.particles.spawnSparks(b.x, b.y, obs.isBarrel ? '#FF4500' : '#D97706', 8);
            if (obs.health <= 0) {
              this.destroyObstacle(obs);
            }
          }
          break;
        }
      }

      if (bounced) {
        b.bouncesLeft--;
        this.audio.playBounce();
        this.particles.spawnSparks(b.x, b.y, b.color, 6);
        if (b.bouncesLeft <= 0) {
          this.bullets.splice(i, 1);
          continue;
        }
      }

      // Tank hit detection
      for (const tank of this.tanks.values()) {
        if (!tank.alive) continue;
        if (Math.hypot(tank.x - b.x, tank.y - b.y) < 20) {
          const wasRicochet = b.bouncesLeft < b.initialBounces;
          this.damageTank(tank, b.ownerId, wasRicochet);
          this.bullets.splice(i, 1);
          break;
        }
      }
    }

    // Check round over
    const aliveCount = Array.from(this.tanks.values()).filter((t) => t.alive).length;
    if (aliveCount <= 1 || this.roundTimer <= 0) {
      if (this.roundState === 'PLAYING') {
        this.roundState = 'ROUND_END';
        this.roundEndTimer = 2.4;

        const aliveTanks = Array.from(this.tanks.values()).filter((t) => t.alive);
        let roundWinner: PlayerId | null = null;
        if (aliveTanks.length === 1) {
          roundWinner = aliveTanks[0].id;
        } else if (aliveTanks.length > 1) {
          aliveTanks.sort((a, b) => b.lives !== a.lives ? b.lives - a.lives : b.kills - a.kills);
          roundWinner = aliveTanks[0].id;
        }

        this.roundWinnerId = roundWinner;
        if (roundWinner !== null) {
          const currentWins = (this.roundWins.get(roundWinner) || 0) + 1;
          this.roundWins.set(roundWinner, currentWins);
          this.audio.playFanfare();
          this.particles.showFloatingText(
            `${this.players[roundWinner].name} WINS ROUND ${this.currentRound}!`,
            width / 2,
            height / 2 - 30,
            this.players[roundWinner].color,
            30
          );
        } else {
          this.audio.playExplosion();
          this.particles.showFloatingText(`ROUND DRAW!`, width / 2, height / 2 - 30, '#F59E0B', 30);
        }
      }
    }
  }

  private fireBullet(tank: Tank) {
    if (tank.cooldown > 0) {
      this.audio.playMenuTick();
      return;
    }
    const reloadDuration = tank.tripleShotTimer > 0 ? 0.75 : 1.2;
    tank.cooldown = reloadDuration;
    tank.maxCooldown = reloadDuration;
    this.audio.playLaser();
    this.particles.addTrauma(0.08);

    // Muzzle flash sparks
    const muzzleX = tank.x + Math.cos(tank.angle) * 22;
    const muzzleY = tank.y + Math.sin(tank.angle) * 22;
    this.particles.spawnSparks(muzzleX, muzzleY, '#FDE68A', 6);

    const speed = 7.5;
    const pColor = this.players[tank.id].color;

    if (tank.tripleShotTimer > 0) {
      [-0.25, 0, 0.25].forEach((spread) => {
        const angle = tank.angle + spread;
        this.bullets.push({
          x: tank.x + Math.cos(angle) * 22,
          y: tank.y + Math.sin(angle) * 22,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          ownerId: tank.id,
          bouncesLeft: 3,
          initialBounces: 3,
          isRailgun: false,
          color: pColor
        });
      });
    } else {
      this.bullets.push({
        x: tank.x + Math.cos(tank.angle) * 22,
        y: tank.y + Math.sin(tank.angle) * 22,
        vx: Math.cos(tank.angle) * speed,
        vy: Math.sin(tank.angle) * speed,
        ownerId: tank.id,
        bouncesLeft: 3,
        initialBounces: 3,
        isRailgun: false,
        color: pColor
      });
    }
  }

  private damageTank(tank: Tank, attackerId: PlayerId, wasRicochet: boolean = false) {
    if (tank.hasShield) {
      tank.hasShield = false;
      this.audio.playBounce();
      this.particles.spawnSparks(tank.x, tank.y, '#60A5FA', 18);
      this.particles.showFloatingText('BLOCKED!', tank.x, tank.y - 20, '#60A5FA');
      return;
    }

    tank.lives--;
    this.audio.playExplosion();
    this.particles.spawnExplosion(tank.x, tank.y, this.players[tank.id].color, 24);

    if (tank.lives <= 0) {
      tank.alive = false;
      this.audio.playHitStopThud();
      this.particles.showFloatingText('DESTROYED!', tank.x, tank.y - 25, '#EF4444', 28);
      const attacker = this.tanks.get(attackerId);
      if (attacker && attacker.id !== tank.id) {
        attacker.kills++;
        if (wasRicochet && attacker.id === 0) {
          attacker.ricochetKills = (attacker.ricochetKills || 0) + 1;
          if (attacker.ricochetKills >= 2) {
            AchievementManager.getInstance().unlock('tank_sniper');
          }
        }
      }
    } else {
      this.particles.showFloatingText(`LIVES: ${tank.lives}`, tank.x, tank.y - 20, '#F59E0B');
    }
  }

  private destroyObstacle(obs: Obstacle) {
    const idx = this.obstacles.indexOf(obs);
    if (idx !== -1) {
      this.obstacles.splice(idx, 1);
      const cx = obs.x + obs.w / 2;
      const cy = obs.y + obs.h / 2;
      if (obs.isBarrel) {
        this.audio.playExplosion();
        this.particles.spawnExplosion(cx, cy, '#FF4500', 36);
        // Blast nearby tanks
        for (const tank of this.tanks.values()) {
          if (tank.alive && Math.hypot(tank.x - cx, tank.y - cy) < 90) {
            this.damageTank(tank, tank.id);
          }
        }
      } else {
        this.audio.playBounce();
        this.particles.spawnSparks(cx, cy, '#D97706', 15);
      }
    }
  }

  private demolishDestructibleCrates(): void {
    const toRemove = this.obstacles.filter((o) => o.destructible);
    for (const obs of toRemove) {
      this.particles.spawnExplosion(obs.x + obs.w / 2, obs.y + obs.h / 2, obs.isBarrel ? '#EF4444' : '#D97706', 16);
    }
    this.obstacles = this.obstacles.filter((o) => !o.destructible);
  }

  private checkObstacleCollision(x: number, y: number, r: number): boolean {
    for (const obs of this.obstacles) {
      if (
        x + r > obs.x &&
        x - r < obs.x + obs.w &&
        y + r > obs.y &&
        y - r < obs.y + obs.h
      ) {
        return true;
      }
    }
    return false;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const tank = this.tanks.get(botId);
    if (!tank || !tank.alive) return;

    // Difficulty parameters
    // Easy: high aim jitter, zero lead, slow reactions, 20% blunder rate
    // Normal: moderate jitter, 50% lead, balanced 220ms reaction, tactical fire
    // Hard: tight aim, 95% lead, rapid reaction, active obstacle hugging
    const leadFactor = difficulty === 'bot_hard' ? 0.92 : difficulty === 'bot_normal' ? 0.5 : 0.0;
    const maxJitter = difficulty === 'bot_hard' ? 0.03 : difficulty === 'bot_normal' ? 0.14 : 0.38;
    const reactionDelay = difficulty === 'bot_hard' ? 0.09 : difficulty === 'bot_normal' ? 0.22 : 0.42;

    // Update bot timer and jitter periodically (every 0.2s)
    let lastEval = this.botLastEvalTimes.get(botId) || 0;
    lastEval += dt;
    if (lastEval > 0.2) {
      lastEval = 0;
      const jitter = (Math.random() - 0.5) * 2 * maxJitter;
      this.botAimOffsets.set(botId, jitter);
    }
    this.botLastEvalTimes.set(botId, lastEval);

    const aimJitter = this.botAimOffsets.get(botId) || 0;

    // Find nearest target tank
    let nearestTarget: Tank | null = null;
    let minDist = Infinity;
    for (const other of this.tanks.values()) {
      if (other.id !== botId && other.alive) {
        const d = Math.hypot(other.x - tank.x, other.y - tank.y);
        if (d < minDist) {
          minDist = d;
          nearestTarget = other;
        }
      }
    }

    if (!nearestTarget) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // Kinematic target lead position
    const bulletSpeed = 340;
    const flightTime = minDist / bulletSpeed;
    const targetVx = Math.cos(nearestTarget.angle) * nearestTarget.speed;
    const targetVy = Math.sin(nearestTarget.angle) * nearestTarget.speed;
    const leadX = nearestTarget.x + targetVx * flightTime * leadFactor;
    const leadY = nearestTarget.y + targetVy * flightTime * leadFactor;

    // Desired angle toward target with difficulty jitter
    const targetAngle = Math.atan2(leadY - tank.y, leadX - tank.x) + aimJitter;
    let diff = targetAngle - tank.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    // Whiskers obstacle avoidance: check forward rays (0, +30 deg, -30 deg)
    const checkDist = 65;
    const fwdX = tank.x + Math.cos(tank.angle) * checkDist;
    const fwdY = tank.y + Math.sin(tank.angle) * checkDist;
    const leftX = tank.x + Math.cos(tank.angle - 0.52) * checkDist;
    const leftY = tank.y + Math.sin(tank.angle - 0.52) * checkDist;
    const rightX = tank.x + Math.cos(tank.angle + 0.52) * checkDist;
    const rightY = tank.y + Math.sin(tank.angle + 0.52) * checkDist;

    const hitFwd = this.checkObstacleCollision(fwdX, fwdY, 18) ||
      fwdX < this.arenaBounds.x + 25 || fwdX > this.arenaBounds.x + this.arenaBounds.w - 25 ||
      fwdY < this.arenaBounds.y + 25 || fwdY > this.arenaBounds.y + this.arenaBounds.h - 25;
    const hitLeft = this.checkObstacleCollision(leftX, leftY, 18);
    const hitRight = this.checkObstacleCollision(rightX, rightY, 18);

    let steerDir = diff > 0.08 ? 1 : diff < -0.08 ? -1 : 0;
    let throttle = 1;

    // Obstacle deflection
    if (hitFwd) {
      throttle = 0.2;
      steerDir = hitLeft ? 1 : -1;
    } else if (hitLeft) {
      steerDir = 1;
    } else if (hitRight) {
      steerDir = -1;
    }

    // Barrel proximity safety check: don't shoot explosive barrels if too close
    let barrelInFiringLine = false;
    for (const obs of this.obstacles) {
      if (obs.isBarrel) {
        const obsDx = obs.x + obs.w / 2 - tank.x;
        const obsDy = obs.y + obs.h / 2 - tank.y;
        const obsDist = Math.hypot(obsDx, obsDy);
        if (obsDist < 110) {
          const obsAngle = Math.atan2(obsDy, obsDx);
          let obsDiff = obsAngle - tank.angle;
          while (obsDiff > Math.PI) obsDiff -= Math.PI * 2;
          while (obsDiff < -Math.PI) obsDiff += Math.PI * 2;
          if (Math.abs(obsDiff) < 0.4) {
            barrelInFiringLine = true;
            break;
          }
        }
      }
    }

    // Reaction timer accumulation
    let reactionTimer = this.botReactionTimers.get(botId) || 0;
    const angleTolerance = difficulty === 'bot_hard' ? 0.18 : difficulty === 'bot_normal' ? 0.32 : 0.55;
    const isFacing = Math.abs(diff) < angleTolerance;

    if (isFacing && !barrelInFiringLine) {
      reactionTimer += dt;
    } else {
      reactionTimer = Math.max(0, reactionTimer - dt * 2);
    }
    this.botReactionTimers.set(botId, reactionTimer);

    // Firing cadence
    const canShoot = reactionTimer >= reactionDelay && tank.cooldown <= 0;
    const blunder = difficulty === 'bot_easy' && Math.random() < 0.15;
    const shouldShoot = canShoot && !blunder && !barrelInFiringLine;

    this.input.setBotInput(botId, true, steerDir, throttle, shouldShoot);
    if (shouldShoot) {
      this.fireBullet(tank);
      this.botReactionTimers.set(botId, 0); // Reset reaction timer after shot
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Draw sci-fi metallic grid floor
    ctx.save();
    ctx.fillStyle = '#111827';
    ctx.fillRect(this.arenaBounds.x, this.arenaBounds.y, this.arenaBounds.w, this.arenaBounds.h);

    // Grid lines
    ctx.strokeStyle = 'rgba(55, 65, 81, 0.4)';
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = this.arenaBounds.x; x < this.arenaBounds.x + this.arenaBounds.w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, this.arenaBounds.y);
      ctx.lineTo(x, this.arenaBounds.y + this.arenaBounds.h);
      ctx.stroke();
    }
    for (let y = this.arenaBounds.y; y < this.arenaBounds.y + this.arenaBounds.h; y += step) {
      ctx.beginPath();
      ctx.moveTo(this.arenaBounds.x, y);
      ctx.lineTo(this.arenaBounds.x + this.arenaBounds.w, y);
      ctx.stroke();
    }

    // Draw floor tread marks
    for (const tm of this.treadMarks) {
      ctx.save();
      ctx.translate(tm.x, tm.y);
      ctx.rotate(tm.angle);
      ctx.fillStyle = `rgba(15, 23, 42, ${tm.alpha * 0.45})`;
      ctx.fillRect(-6, -15, 12, 4);
      ctx.fillRect(-6, 11, 12, 4);
      ctx.restore();
    }

    // Outer neon boundary
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.strokeRect(this.arenaBounds.x, this.arenaBounds.y, this.arenaBounds.w, this.arenaBounds.h);

    // Draw Obstacles
    for (const obs of this.obstacles) {
      if (obs.isBarrel) {
        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.arc(obs.x + obs.w / 2, obs.y + obs.h / 2, obs.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (obs.destructible) {
        ctx.fillStyle = '#D97706';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#FDE68A';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      } else {
        ctx.fillStyle = '#374151';
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeStyle = '#6B7280';
        ctx.lineWidth = 3;
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      }
    }

    // Draw Procedural Vector PowerUps
    for (const pu of this.powerUps) {
      ctx.save();
      ctx.translate(pu.x, pu.y);
      const bob = Math.sin(performance.now() * 0.005 + pu.x) * 3;
      ctx.translate(0, bob);

      // Floor shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 16 - bob, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pod outer sphere
      const pColor = pu.type === 'shield' ? '#3B82F6' : pu.type === 'triple' ? '#F59E0B' : '#EF4444';
      const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, 15);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.35, pColor);
      grad.addColorStop(1, '#0F172A');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Procedural Vector Icon
      if (pu.type === 'shield') {
        // Metallic shield crest
        ctx.fillStyle = '#93C5FD';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(5, -3);
        ctx.lineTo(4, 4);
        ctx.lineTo(0, 7);
        ctx.lineTo(-4, 4);
        ctx.lineTo(-5, -3);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else if (pu.type === 'triple') {
        // Lightning bolt chevron
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.moveTo(1, -7);
        ctx.lineTo(-4, 0);
        ctx.lineTo(0, 0);
        ctx.lineTo(-1, 7);
        ctx.lineTo(4, 0);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        // Spike naval mine core
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1.8;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
          ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
          ctx.stroke();
        }
        ctx.fillStyle = Math.sin(performance.now() * 0.01) > 0 ? '#FCA5A5' : '#EF4444';
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // Draw Mines
    for (const mine of this.mines) {
      ctx.save();
      const pulse = Math.sin(performance.now() * 0.01) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(239, 68, 68, ${pulse})`;
      ctx.beginPath();
      ctx.arc(mine.x, mine.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Bullets
    for (const b of this.bullets) {
      ctx.save();
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw Tanks
    for (const tank of this.tanks.values()) {
      if (!tank.alive) continue;
      const p = this.players[tank.id];

      ctx.save();
      ctx.translate(tank.x, tank.y);
      ctx.rotate(tank.angle);

      // Tank Body
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillRect(-16, -14, 32, 28);

      // Tank Treads
      ctx.fillStyle = '#1F2937';
      ctx.fillRect(-18, -16, 36, 6);
      ctx.fillRect(-18, 10, 36, 6);

      // Barrel
      ctx.fillStyle = '#E5E7EB';
      ctx.fillRect(0, -3.5, 20, 7);

      // Turret base
      ctx.fillStyle = p.colorDark;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();

      // Mascot Commander seated in cupola hatch
      const mood: CharacterMood = !tank.alive ? 'shocked' : tank.lives === 1 ? 'shocked' : tank.kills > 0 ? 'triumph' : 'focused';
      this.drawPlayerMascot(ctx, tank.id, -2, 0, 9, mood, performance.now() * 0.001);

      // Hatch Rim
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(-2, 0, 9, 0, Math.PI * 2);
      ctx.stroke();

      // Shield Aura
      if (tank.hasShield) {
        ctx.strokeStyle = '#60A5FA';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      // Vector Health Shields above tank
      const lifeW = 7;
      const lifeSpacing = 9;
      const totalLifeW = (3 - 1) * lifeSpacing + lifeW;
      const startX = tank.x - totalLifeW / 2;
      const lifeY = tank.y - 26;

      for (let l = 0; l < 3; l++) {
        const lx = startX + l * lifeSpacing;
        const isFilled = l < tank.lives;
        ctx.save();
        ctx.fillStyle = isFilled ? (tank.lives === 1 ? '#EF4444' : '#10B981') : 'rgba(51, 65, 85, 0.7)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(lx, lifeY, lifeW, 5, 2);
        else ctx.rect(lx, lifeY, lifeW, 5);
        ctx.fill();
        ctx.strokeStyle = isFilled ? '#FFFFFF' : '#475569';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      }

      // Tactical Reload meter below health shields
      if (tank.cooldown > 0) {
        const reloadRatio = 1 - tank.cooldown / (tank.maxCooldown || 1.2);
        const barW = 26;
        const barH = 3;
        const barX = tank.x - barW / 2;
        const barY = tank.y - 18;

        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

        ctx.fillStyle = reloadRatio >= 0.85 ? '#10B981' : reloadRatio >= 0.4 ? '#F59E0B' : '#EF4444';
        ctx.fillRect(barX, barY, barW * Math.max(0, Math.min(1, reloadRatio)), barH);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);
        ctx.restore();
      }
    }

    // Top Scoreboard Badge: Best of 3 Tracker
    ctx.save();
    const active = this.getActivePlayers();
    const p1 = active[0];
    const p2 = active[1];
    const p1Wins = p1 ? this.roundWins.get(p1.id) || 0 : 0;
    const p2Wins = p2 ? this.roundWins.get(p2.id) || 0 : 0;

    const badgeW = 280;
    const badgeH = 26;
    const badgeX = this.arenaBounds.x + (this.arenaBounds.w - badgeW) / 2;
    const badgeY = this.arenaBounds.y + 8;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
    else ctx.rect(badgeX, badgeY, badgeW, badgeH);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 12px "Fredoka", "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#E2E8F0';

    const p1Stars = '★'.repeat(p1Wins) + '☆'.repeat(Math.max(0, this.targetWins - p1Wins));
    const p2Stars = '★'.repeat(p2Wins) + '☆'.repeat(Math.max(0, this.targetWins - p2Wins));

    ctx.fillText(`${p1?.name || 'P1'}: ${p1Stars}   ROUND ${this.currentRound}/3   ${p2Stars} :${p2?.name || 'P2'}`, badgeX + badgeW / 2, badgeY + badgeH / 2);
    ctx.restore();

    // Round end overlay banner
    if (this.roundState === 'ROUND_END') {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(this.arenaBounds.x, this.arenaBounds.y, this.arenaBounds.w, this.arenaBounds.h);

      const winP = this.roundWinnerId !== null ? this.players[this.roundWinnerId] : null;
      const title = winP ? `${winP.name.toUpperCase()} WINS ROUND ${this.currentRound}!` : 'ROUND DRAW!';
      const color = winP ? winP.color : '#F59E0B';

      ctx.textAlign = 'center';
      ctx.font = 'bold 28px "Fredoka", "Nunito", sans-serif';
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillText(title, this.arenaBounds.x + this.arenaBounds.w / 2, this.arenaBounds.y + this.arenaBounds.h / 2 - 15);

      ctx.shadowBlur = 0;
      ctx.font = 'bold 16px "Fredoka", "Nunito", sans-serif';
      ctx.fillStyle = '#E2E8F0';
      const willFinish = (winP && (this.roundWins.get(winP.id) || 0) >= this.targetWins) || this.currentRound >= this.maxRounds;
      const sub = willFinish
        ? `BEST OF 3 MATCH FINISHED! (${p1Wins} - ${p2Wins})`
        : `NEXT ROUND IN ${Math.max(1, Math.ceil(this.roundEndTimer))}s... (SERIES: ${p1Wins} - ${p2Wins})`;
      ctx.fillText(sub, this.arenaBounds.x + this.arenaBounds.w / 2, this.arenaBounds.y + this.arenaBounds.h / 2 + 20);
      ctx.restore();
    }

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const list = Array.from(this.tanks.values()).sort((a, b) => {
      const aWins = this.roundWins.get(a.id) || 0;
      const bWins = this.roundWins.get(b.id) || 0;
      if (aWins !== bWins) return bWins - aWins;
      if (a.alive && !b.alive) return -1;
      if (!a.alive && b.alive) return 1;
      if (a.kills !== b.kills) return b.kills - a.kills;
      return b.lives - a.lives;
    });

    const winnerId = list.length > 0 && (this.roundWins.get(list[0].id) || 0) > 0 ? list[0].id : (list[0]?.alive ? list[0].id : null);
    if (winnerId === 0 && (this.roundWins.get(0) || 0) >= 2) {
      AchievementManager.getInstance().unlock('perfectionist');
    }

    const seriesScore = Array.from(this.roundWins.entries())
      .map(([pid, w]) => `${this.players[pid].name}: ${w}`)
      .join(' | ');

    return {
      winnerId,
      rankings: list.map((t, idx) => ({
        playerId: t.id,
        score: (this.roundWins.get(t.id) || 0) * 10 + t.kills * 2 + (t.alive ? 3 : 0),
        place: idx + 1
      })),
      mvpHighlight: winnerId !== null
        ? `${this.players[winnerId].name} won the Best of 3 (${seriesScore})!`
        : `Best of 3 ended in a draw! (${seriesScore})`
    };
  }
}
