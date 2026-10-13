import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export interface AsteroidTheme {
  name: string;
  bgGradInner: string;
  bgGradMid: string;
  bgGradOuter: string;
  starColor: string;
  depotRimColor: string;
  themePillColor: string;
}

export const ASTEROID_THEMES: AsteroidTheme[] = [
  {
    name: 'Deep Cosmos Asteroid Belt 🌌',
    bgGradInner: '#0F172A',
    bgGradMid: '#0B0F19',
    bgGradOuter: '#05070D',
    starColor: 'rgba(255, 255, 255, 0.45)',
    depotRimColor: '#38BDF8',
    themePillColor: '#38BDF8'
  },
  {
    name: 'Solar Flare Nebula ☀️',
    bgGradInner: '#1C0B05',
    bgGradMid: '#120502',
    bgGradOuter: '#080201',
    starColor: 'rgba(254, 240, 138, 0.45)',
    depotRimColor: '#F97316',
    themePillColor: '#F97316'
  },
  {
    name: 'Cyber Matrix Salvage ⚡',
    bgGradInner: '#03191E',
    bgGradMid: '#021014',
    bgGradOuter: '#01080A',
    starColor: 'rgba(52, 211, 153, 0.45)',
    depotRimColor: '#10B981',
    themePillColor: '#10B981'
  }
];

interface MinerShip {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  cargo: number;
  bankedScore: number;
  drillSpin: number;
  bumpCooldown: number;
  raidCooldown: number;
  respawnTimer: number;
  alive: boolean;
  isUnderdog: boolean;
  streak: number;
}

interface Asteroid {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  health: number;
  maxHealth: number;
  tier: 1 | 2;
  color: string;
  angle: number;
  spin: number;
  isGolden?: boolean;
}

interface GemShard {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  color: string;
  glowColor: string;
  sparkleTimer: number;
  magnetTarget: PlayerId | null;
  isGolden?: boolean;
}

interface SalvageDepot {
  playerId: PlayerId;
  x: number;
  y: number;
  radius: number;
  color: string;
  pulseTimer: number;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export class AsteroidMinerGame extends BaseGame {
  private ships: Map<PlayerId, MinerShip> = new Map();
  private asteroids: Asteroid[] = [];
  private gems: GemShard[] = [];
  private depots: SalvageDepot[] = [];
  private floatingTexts: FloatingText[] = [];
  private nextTextId = 1;
  private nextAsteroidId = 1;
  private nextGemId = 1;
  private asteroidSpawnTimer = 2.0;
  private starfield: { x: number; y: number; r: number; alpha: number }[] = [];

  // Themes
  private currentThemeIndex: number = 0;

  // Sudden Death State
  private isSuddenDeath: boolean = false;
  private suddenDeathFlashTimer: number = 0;

  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private lastWidth: number = 800;
  private lastHeight: number = 600;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.currentThemeIndex = Math.floor(Math.random() * ASTEROID_THEMES.length);
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.roundTimer = 50;
    this.isFinished = false;
    this.isSuddenDeath = false;
    this.suddenDeathFlashTimer = 0;
    this.ships.clear();
    this.asteroids = [];
    this.gems = [];
    this.depots = [];
    this.floatingTexts = [];
    this.nextAsteroidId = 1;
    this.nextGemId = 1;
    this.asteroidSpawnTimer = 1.0;

    this.starfield = [];
    for (let i = 0; i < 60; i++) {
      this.starfield.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.8 + Math.random() * 1.6,
        alpha: 0.3 + Math.random() * 0.7
      });
    }

    const active = this.getActivePlayers();
    const depotCornerOffsets = [
      { x: 100, y: 100 },
      { x: width - 100, y: 100 },
      { x: 100, y: height - 100 },
      { x: width - 100, y: height - 100 }
    ];

    active.forEach((p, idx) => {
      const corner = depotCornerOffsets[idx % depotCornerOffsets.length];
      const aimAngle = Math.atan2(height / 2 - corner.y, width / 2 - corner.x);

      this.depots.push({
        playerId: p.id,
        x: corner.x,
        y: corner.y,
        radius: 46,
        color: p.color,
        pulseTimer: 0
      });

      this.ships.set(p.id, {
        id: p.id,
        x: corner.x + Math.cos(aimAngle) * 35,
        y: corner.y + Math.sin(aimAngle) * 35,
        vx: 0,
        vy: 0,
        angle: aimAngle,
        radius: 20,
        cargo: 0,
        bankedScore: 0,
        drillSpin: 0,
        bumpCooldown: 0,
        raidCooldown: 0,
        respawnTimer: 0,
        alive: true,
        isUnderdog: false,
        streak: 0
      });
    });

    for (let i = 0; i < 6; i++) {
      this.spawnAsteroid(width, height, 2);
    }
    for (let i = 0; i < 4; i++) {
      this.spawnAsteroid(width, height, 1);
    }

    // Bind event listeners
    const canvas = this.input.getCanvas();
    if (canvas && !this.boundPointerDown) {
      this.boundPointerDown = this.handlePointerDown.bind(this);
      canvas.addEventListener('pointerdown', this.boundPointerDown);
    }
    if (!this.boundKeyDown) {
      this.boundKeyDown = this.handleKeyDown.bind(this);
      window.addEventListener('keydown', this.boundKeyDown);
    }

    if (typeof window !== 'undefined') {
      (window as any).__ASTEROID_MINER_DEBUG__ = {
        game: this,
        getShip: (id: PlayerId) => this.ships.get(id),
        getDepots: () => this.depots,
        getAsteroids: () => this.asteroids,
        getGems: () => this.gems,
        setShipPos: (id: PlayerId, x: number, y: number, vx = 0, vy = 0) => {
          const s = this.ships.get(id);
          if (s) {
            s.x = x;
            s.y = y;
            s.vx = vx;
            s.vy = vy;
          }
        },
        setCargo: (id: PlayerId, cargo: number) => {
          const s = this.ships.get(id);
          if (s) s.cargo = cargo;
        },
        setBankedScore: (id: PlayerId, score: number) => {
          const s = this.ships.get(id);
          if (s) s.bankedScore = score;
        },
        setRoundTimer: (t: number) => {
          this.roundTimer = t;
        },
        getRoundTimer: () => this.roundTimer,
        getThemeIndex: () => this.currentThemeIndex,
        setThemeIndex: (idx: number) => {
          this.currentThemeIndex = idx % ASTEROID_THEMES.length;
        }
      };
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 't' || e.key === 'T') {
      this.toggleTheme();
    }
  }

  private toggleTheme(): void {
    this.currentThemeIndex = (this.currentThemeIndex + 1) % ASTEROID_THEMES.length;
    this.audio.playTap();
  }

  private handlePointerDown(e: PointerEvent): void {
    const canvas = this.input.getCanvas();
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * this.lastWidth;
    const clickY = ((e.clientY - rect.top) / rect.height) * this.lastHeight;

    // Check Theme Pill click: [T] Theme Pill at (20, height - 44, 170, 32)
    if (
      clickX >= 20 &&
      clickX <= 190 &&
      clickY >= this.lastHeight - 44 &&
      clickY <= this.lastHeight - 12
    ) {
      this.toggleTheme();
    }
  }

  public override destroy(): void {
    if (this.boundPointerDown) {
      const canvas = this.input.getCanvas();
      if (canvas) {
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
      }
      this.boundPointerDown = null;
    }
    if (this.boundKeyDown) {
      window.removeEventListener('keydown', this.boundKeyDown);
      this.boundKeyDown = null;
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string): void {
    this.floatingTexts.push({
      id: this.nextTextId++,
      x,
      y,
      text,
      color,
      life: 1.2,
      maxLife: 1.2
    });
  }

  private spawnAsteroid(width: number, height: number, tier: 1 | 2, forceGolden: boolean = false): void {
    const cx = width / 2;
    const cy = height / 2;
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * Math.min(width, height) * 0.28;
    const ax = cx + Math.cos(angle) * dist;
    const ay = cy + Math.sin(angle) * dist;

    const speed = tier === 2 ? 15 + Math.random() * 25 : 30 + Math.random() * 40;
    const moveAngle = Math.random() * Math.PI * 2;

    const isGolden = forceGolden || (this.isSuddenDeath && Math.random() < 0.45);
    const asteroidColors = ['#94A3B8', '#A78BFA', '#38BDF8', '#FBBF24'];
    const col = isGolden ? '#FBBF24' : asteroidColors[Math.floor(Math.random() * asteroidColors.length)];

    this.asteroids.push({
      id: this.nextAsteroidId++,
      x: ax,
      y: ay,
      vx: Math.cos(moveAngle) * speed,
      vy: Math.sin(moveAngle) * speed,
      radius: tier === 2 ? 30 : 18,
      health: isGolden ? 4 : (tier === 2 ? 3 : 1),
      maxHealth: isGolden ? 4 : (tier === 2 ? 3 : 1),
      tier,
      color: col,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 1.5,
      isGolden
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastWidth = width;
    this.lastHeight = height;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Sudden Death Activation (<= 15 seconds remaining)
    if (this.roundTimer <= 15.0 && !this.isSuddenDeath) {
      this.isSuddenDeath = true;
      this.audio.playBoost();
      this.particles.shake(6);
      this.spawnAsteroid(width, height, 2, true);
    }

    if (this.isSuddenDeath) {
      this.suddenDeathFlashTimer += dt;
    }

    // Underdog surge calculations
    let maxBanked = -1;
    for (const ship of this.ships.values()) {
      if (ship.bankedScore > maxBanked) maxBanked = ship.bankedScore;
    }
    for (const ship of this.ships.values()) {
      ship.isUnderdog = maxBanked >= 3 && ship.bankedScore <= maxBanked - 3;
    }

    // Periodic asteroid replenish
    this.asteroidSpawnTimer -= dt;
    if (this.asteroidSpawnTimer <= 0 && this.asteroids.length < 9) {
      this.spawnAsteroid(width, height, Math.random() < 0.6 ? 2 : 1, this.isSuddenDeath && Math.random() < 0.5);
      this.asteroidSpawnTimer = 3.5;
    }

    // Pulse depots
    for (const d of this.depots) {
      d.pulseTimer += dt * 3;
    }

    this.updateBots(dt, width, height);

    // Update Ships
    for (const ship of this.ships.values()) {
      if (!ship.alive) {
        ship.respawnTimer -= dt;
        if (ship.respawnTimer <= 0) {
          ship.alive = true;
          const depot = this.depots.find((d) => d.playerId === ship.id);
          if (depot) {
            ship.x = depot.x;
            ship.y = depot.y;
            ship.vx = 0;
            ship.vy = 0;
            this.particles.spawnExplosion(ship.x, ship.y, '#38BDF8', 15);
          }
        }
        continue;
      }

      if (ship.bumpCooldown > 0) ship.bumpCooldown -= dt;
      if (ship.raidCooldown > 0) ship.raidCooldown -= dt;

      const isThrusting = this.input.isPressed(ship.id) || this.input.isActionPressed(ship.id);
      const steer = this.input.getSteer(ship.id);

      if (steer !== 0) {
        ship.angle += steer * 3.8 * dt;
      } else if (!isThrusting) {
        ship.angle += 1.8 * dt;
      }

      ship.drillSpin += (this.isSuddenDeath ? 20 : 14) * dt;

      if (isThrusting) {
        // Underdog +25% thruster thrust (425 vs 340)
        const thrustPower = (ship.isUnderdog ? 425 : 340) * (this.isSuddenDeath ? 1.15 : 1.0);
        ship.vx += Math.cos(ship.angle) * thrustPower * dt;
        ship.vy += Math.sin(ship.angle) * thrustPower * dt;

        if (Math.random() < 0.45) {
          const exhaustX = ship.x - Math.cos(ship.angle) * (ship.radius + 6);
          const exhaustY = ship.y - Math.sin(ship.angle) * (ship.radius + 6);
          const pCol = this.players[ship.id]?.color || '#F59E0B';
          this.particles.spawnSparks(exhaustX, exhaustY, ship.isUnderdog ? '#F59E0B' : pCol, 1);
        }
      }

      ship.vx *= 0.985;
      ship.vy *= 0.985;

      const maxSpd = ship.isUnderdog ? 310 : 260;
      const curSpd = Math.hypot(ship.vx, ship.vy);
      if (curSpd > maxSpd) {
        ship.vx = (ship.vx / curSpd) * maxSpd;
        ship.vy = (ship.vy / curSpd) * maxSpd;
      }

      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;

      const minX = ship.radius + 15;
      const maxX = width - ship.radius - 15;
      const minY = ship.radius + 15;
      const maxY = height - ship.radius - 15;

      if (ship.x < minX) {
        ship.x = minX;
        ship.vx = Math.abs(ship.vx) * 0.7;
      } else if (ship.x > maxX) {
        ship.x = maxX;
        ship.vx = -Math.abs(ship.vx) * 0.7;
      }

      if (ship.y < minY) {
        ship.y = minY;
        ship.vy = Math.abs(ship.vy) * 0.7;
      } else if (ship.y > maxY) {
        ship.y = maxY;
        ship.vy = -Math.abs(ship.vy) * 0.7;
      }

      // Check Depot Banking
      const myDepot = this.depots.find((d) => d.playerId === ship.id);
      if (myDepot && ship.cargo > 0) {
        const distDepot = Math.hypot(ship.x - myDepot.x, ship.y - myDepot.y);
        if (distDepot < myDepot.radius + ship.radius) {
          // Sudden death double banking bonus
          const pointsEarned = ship.cargo * (this.isSuddenDeath ? 2 : 1);
          ship.bankedScore += pointsEarned;
          this.audio.playTone(587.33, 0.08, 'triangle');
          setTimeout(() => this.audio.playTone(880.0, 0.12, 'sine'), 90);
          this.particles.spawnExplosion(myDepot.x, myDepot.y, '#10B981', ship.cargo * 6);
          this.addFloatingText(myDepot.x, myDepot.y - 20, `+${pointsEarned} SECURED!`, '#10B981');
          ship.cargo = 0;
        }
      }

      // Check Rival Depot Raiding
      if (ship.cargo < 5 && ship.raidCooldown <= 0) {
        for (const rivalDepot of this.depots) {
          if (rivalDepot.playerId !== ship.id) {
            const distRivalDepot = Math.hypot(ship.x - rivalDepot.x, ship.y - rivalDepot.y);
            if (distRivalDepot < rivalDepot.radius + ship.radius) {
              const rivalShip = this.ships.get(rivalDepot.playerId);
              if (rivalShip && rivalShip.bankedScore > 0) {
                rivalShip.bankedScore--;
                ship.cargo++;
                ship.raidCooldown = 1.0;
                this.audio.playTone(349.23, 0.14, 'sawtooth');
                this.particles.spawnExplosion(rivalDepot.x, rivalDepot.y, '#EF4444', 10);
                this.addFloatingText(rivalDepot.x, rivalDepot.y - 20, '🚨 RAIDED! -1', '#EF4444');
                this.addFloatingText(ship.x, ship.y - 20, '💎 STOLEN! +1', '#10B981');
                break;
              }
            }
          }
        }
      }
    }

    // Ship-to-Ship Collisions & Kinetic Stealing
    const shipList = Array.from(this.ships.values()).filter((s) => s.alive);
    for (let i = 0; i < shipList.length; i++) {
      for (let j = i + 1; j < shipList.length; j++) {
        const s1 = shipList[i];
        const s2 = shipList[j];
        const dx = s2.x - s1.x;
        const dy = s2.y - s1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = s1.radius + s2.radius + 4;

        if (dist < minDist && dist > 0.01) {
          const nx = dx / dist;
          const ny = dy / dist;

          const overlap = minDist - dist;
          s1.x -= nx * overlap * 0.5;
          s1.y -= ny * overlap * 0.5;
          s2.x += nx * overlap * 0.5;
          s2.y += ny * overlap * 0.5;

          const vRel = (s1.vx - s2.vx) * nx + (s1.vy - s2.vy) * ny;
          const dot1 = Math.cos(s1.angle) * nx + Math.sin(s1.angle) * ny;
          const dot2 = Math.cos(s2.angle) * (-nx) + Math.sin(s2.angle) * (-ny);

          if (s1.bumpCooldown <= 0 && s2.bumpCooldown <= 0) {
            let attacker: MinerShip;
            let victim: MinerShip;

            if (vRel > 15 || (Math.abs(vRel) <= 15 && dot1 >= dot2)) {
              attacker = s1;
              victim = s2;
            } else {
              attacker = s2;
              victim = s1;
            }

            if (victim.cargo > 0) {
              // Underdog ramming bumper steals 2 gems!
              const stealAmount = Math.min(victim.cargo, attacker.isUnderdog ? 2 : 1);
              victim.cargo -= stealAmount;
              s1.bumpCooldown = 0.6;
              s2.bumpCooldown = 0.6;

              const spaceAvailable = 5 - attacker.cargo;
              const directTake = Math.min(stealAmount, spaceAvailable);
              attacker.cargo += directTake;

              this.audio.playTone(659.25, 0.12, 'sawtooth');
              this.particles.spawnExplosion(attacker.x, attacker.y, '#10B981', 8);
              this.addFloatingText(attacker.x, attacker.y - 25, `💎 STOLEN! +${stealAmount}`, '#10B981');
              this.addFloatingText(victim.x, victim.y - 25, `💥 -${stealAmount} GEM!`, '#EF4444');

              // Spill remaining gems if cargo full
              const spilled = stealAmount - directTake;
              if (spilled > 0) {
                const spillDirX = attacker === s1 ? nx : -nx;
                const spillDirY = attacker === s1 ? ny : -ny;
                for (let k = 0; k < spilled; k++) {
                  this.dropGem(victim.x, victim.y, spillDirX * (140 + k * 20), spillDirY * (140 + k * 20));
                }
              }
            }
          }

          const kx = s1.vx - s2.vx;
          const ky = s1.vy - s2.vy;
          const p = 2 * (nx * kx + ny * ky) / 2;
          s1.vx -= p * nx * 1.2;
          s1.vy -= p * ny * 1.2;
          s2.vx += p * nx * 1.2;
          s2.vy += p * ny * 1.2;

          this.audio.playTone(160, 0.08, 'square');
          this.particles.spawnSparks((s1.x + s2.x) / 2, (s1.y + s2.y) / 2, '#FFFFFF', 6);
        }
      }
    }

    // Update Asteroids
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const ast = this.asteroids[i];
      ast.x += ast.vx * dt;
      ast.y += ast.vy * dt;
      ast.angle += ast.spin * dt;

      if (ast.x < -ast.radius) ast.x = width + ast.radius;
      else if (ast.x > width + ast.radius) ast.x = -ast.radius;
      if (ast.y < -ast.radius) ast.y = height + ast.radius;
      else if (ast.y > height + ast.radius) ast.y = -ast.radius;

      for (const ship of shipList) {
        const drillTipX = ship.x + Math.cos(ship.angle) * (ship.radius + 8);
        const drillTipY = ship.y + Math.sin(ship.angle) * (ship.radius + 8);
        const distDrill = Math.hypot(drillTipX - ast.x, drillTipY - ast.y);

        if (distDrill < ast.radius + 8) {
          ast.health--;
          ship.streak += 1;
          this.audio.playTone(220, 0.06, 'sawtooth');
          this.particles.spawnSparks(drillTipX, drillTipY, ast.color, 8);

          const pushAngle = Math.atan2(ast.y - ship.y, ast.x - ship.x);
          ast.vx += Math.cos(pushAngle) * 90;
          ast.vy += Math.sin(pushAngle) * 90;
          ship.vx -= Math.cos(pushAngle) * 40;
          ship.vy -= Math.sin(pushAngle) * 40;

          if (ast.health <= 0) {
            this.shatterAsteroid(ast);
            this.asteroids.splice(i, 1);
            break;
          }
        }
      }
    }

    // Update Gems
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const gem = this.gems[i];
      gem.x += gem.vx * dt;
      gem.y += gem.vy * dt;
      gem.vx *= 0.96;
      gem.vy *= 0.96;
      gem.sparkleTimer += dt * 4;

      if (gem.x < 15) { gem.x = 15; gem.vx *= -0.5; }
      else if (gem.x > width - 15) { gem.x = width - 15; gem.vx *= -0.5; }
      if (gem.y < 15) { gem.y = 15; gem.vy *= -0.5; }
      else if (gem.y > height - 15) { gem.y = height - 15; gem.vy *= -0.5; }

      let closestDist = 95;
      let targetShip: MinerShip | null = null;
      for (const ship of shipList) {
        if (ship.cargo >= 5) continue;
        const pullRadius = ship.isUnderdog ? 145 : 95;
        const d = Math.hypot(ship.x - gem.x, ship.y - gem.y);
        if (d < pullRadius && d < closestDist) {
          closestDist = d;
          targetShip = ship;
        }
      }

      gem.magnetTarget = targetShip ? targetShip.id : null;

      if (targetShip) {
        const pull = targetShip.isUnderdog ? 290 : 220;
        const angle = Math.atan2(targetShip.y - gem.y, targetShip.x - gem.x);
        gem.vx += Math.cos(angle) * pull * dt;
        gem.vy += Math.sin(angle) * pull * dt;

        if (closestDist < targetShip.radius + 10) {
          const val = gem.value;
          targetShip.cargo = Math.min(5, targetShip.cargo + val);
          this.audio.playTone(784, 0.07, 'sine');
          this.particles.spawnSparks(gem.x, gem.y, gem.color, 6);
          this.gems.splice(i, 1);
          continue;
        }
      }
    }

    // Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y -= 25 * dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private shatterAsteroid(ast: Asteroid): void {
    this.audio.playTone(180, 0.14, 'square');
    this.particles.spawnExplosion(ast.x, ast.y, ast.color, ast.tier === 2 ? 22 : 12);

    const shardCount = ast.isGolden ? 6 : (ast.tier === 2 ? 4 : 2);
    for (let s = 0; s < shardCount; s++) {
      const angle = (s / shardCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const spd = 60 + Math.random() * 80;
      this.dropGem(ast.x, ast.y, Math.cos(angle) * spd, Math.sin(angle) * spd, ast.isGolden);
    }
  }

  private dropGem(x: number, y: number, vx: number, vy: number, isGolden: boolean = false): void {
    const gemColors = [
      { color: '#EF4444', glow: 'rgba(239, 68, 68, 0.6)' },
      { color: '#10B981', glow: 'rgba(16, 185, 129, 0.6)' },
      { color: '#38BDF8', glow: 'rgba(56, 189, 248, 0.6)' },
      { color: '#F59E0B', glow: 'rgba(245, 158, 11, 0.6)' }
    ];
    const pick = isGolden ? { color: '#FDE047', glow: 'rgba(253, 224, 71, 0.8)' } : gemColors[Math.floor(Math.random() * gemColors.length)];

    this.gems.push({
      id: this.nextGemId++,
      x,
      y,
      vx,
      vy,
      value: isGolden ? 2 : 1,
      color: pick.color,
      glowColor: pick.glow,
      sparkleTimer: Math.random() * 6.28,
      magnetTarget: null,
      isGolden
    });
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

    const depot = this.depots.find((d) => d.playerId === botId);
    const isEasy = difficulty === 'bot_easy';
    const isNormal = difficulty === 'bot_normal';
    const isHard = difficulty === 'bot_hard';

    let targetX = width / 2;
    let targetY = height / 2;

    const shouldBank = (ship.cargo >= 4) || (ship.cargo >= 3 && !isEasy) || (this.roundTimer < 8 && ship.cargo > 0);

    let stealTargetShip: MinerShip | null = null;
    let bestStealDist = isHard ? 450 : (isNormal ? 300 : 160);

    if (ship.cargo < 5) {
      for (const [otherId, otherShip] of this.ships.entries()) {
        if (otherId !== ship.id && otherShip.alive && otherShip.cargo > 0) {
          const d = Math.hypot(otherShip.x - ship.x, otherShip.y - ship.y);
          if (d < bestStealDist) {
            bestStealDist = d;
            stealTargetShip = otherShip;
          }
        }
      }
    }

    let raidDepotTarget: SalvageDepot | null = null;
    if (ship.cargo < 4 && !isEasy && !stealTargetShip) {
      for (const d of this.depots) {
        if (d.playerId !== botId) {
          const rival = this.ships.get(d.playerId);
          if (rival && rival.bankedScore > 0) {
            const distToD = Math.hypot(d.x - ship.x, d.y - ship.y);
            if (distToD < (isHard ? 380 : 240)) {
              raidDepotTarget = d;
              break;
            }
          }
        }
      }
    }

    if (shouldBank && depot) {
      targetX = depot.x;
      targetY = depot.y;
    } else if (stealTargetShip) {
      targetX = stealTargetShip.x;
      targetY = stealTargetShip.y;
    } else if (raidDepotTarget) {
      targetX = raidDepotTarget.x;
      targetY = raidDepotTarget.y;
    } else if (this.gems.length > 0 && ship.cargo < 5) {
      let bestDist = Infinity;
      for (const gem of this.gems) {
        const d = Math.hypot(gem.x - ship.x, gem.y - ship.y);
        const effectiveDist = gem.isGolden ? d * 0.6 : d;
        if (effectiveDist < bestDist) {
          bestDist = effectiveDist;
          targetX = gem.x;
          targetY = gem.y;
        }
      }
    } else if (this.asteroids.length > 0) {
      let bestDist = Infinity;
      for (const ast of this.asteroids) {
        const d = Math.hypot(ast.x - ship.x, ast.y - ship.y);
        const effectiveDist = ast.isGolden ? d * 0.5 : d;
        if (effectiveDist < bestDist) {
          bestDist = effectiveDist;
          targetX = ast.x;
          targetY = ast.y;
        }
      }
    }

    const targetAngle = Math.atan2(targetY - ship.y, targetX - ship.x);
    let angleDiff = targetAngle - ship.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const turnTolerance = isHard ? 0.35 : (isNormal ? 0.55 : 0.9);
    if (Math.abs(angleDiff) < turnTolerance) {
      this.input.setBotPressed(botId, true);
    } else {
      this.input.setBotPressed(botId, false);
    }

    const steerSpeed = isHard ? 4.5 : (isNormal ? 3.5 : 2.2);
    ship.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), steerSpeed * dt);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = ASTEROID_THEMES[this.currentThemeIndex];

    // Deep Space Cosmic Gradient
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width * 0.7);
    bgGrad.addColorStop(0, theme.bgGradInner);
    bgGrad.addColorStop(0.6, theme.bgGradMid);
    bgGrad.addColorStop(1, theme.bgGradOuter);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Parallax ambient stars
    ctx.save();
    for (const star of this.starfield) {
      ctx.fillStyle = theme.starColor;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Render Depots
    for (const depot of this.depots) {
      ctx.save();
      const pulseR = depot.radius + Math.sin(depot.pulseTimer) * 4;
      ctx.beginPath();
      ctx.arc(depot.x, depot.y, pulseR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fill();
      ctx.strokeStyle = depot.color;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(depot.x, depot.y, depot.radius * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      ctx.font = '900 13px Montserrat, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DEPOT', depot.x, depot.y - 2);

      const ship = this.ships.get(depot.playerId);
      ctx.font = '800 10px Montserrat, sans-serif';
      ctx.fillStyle = depot.color;
      ctx.fillText(`💎 ${ship?.bankedScore || 0} SECURED`, depot.x, depot.y + 12);
      ctx.restore();
    }

    // Render Asteroids
    for (const ast of this.asteroids) {
      ctx.save();
      ctx.translate(ast.x, ast.y);
      ctx.rotate(ast.angle);

      ctx.beginPath();
      const sides = ast.tier === 2 ? 7 : 5;
      for (let s = 0; s < sides; s++) {
        const a = (s / sides) * Math.PI * 2;
        const radVar = ast.radius * (0.8 + ((s % 2) * 0.35));
        const px = Math.cos(a) * radVar;
        const py = Math.sin(a) * radVar;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      const astGrad = ctx.createLinearGradient(-ast.radius, -ast.radius, ast.radius, ast.radius);
      astGrad.addColorStop(0, ast.isGolden ? '#FDE047' : '#64748B');
      astGrad.addColorStop(0.5, ast.isGolden ? '#D97706' : '#334155');
      astGrad.addColorStop(1, '#1E293B');
      ctx.fillStyle = astGrad;
      ctx.fill();

      ctx.strokeStyle = ast.isGolden ? '#FDE047' : ast.color;
      ctx.lineWidth = ast.isGolden ? 3 : 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, ast.radius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = ast.color;
      ctx.shadowColor = ast.color;
      ctx.shadowBlur = ast.isGolden ? 18 : 10;
      ctx.fill();

      if (ast.health < ast.maxHealth) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-ast.radius * 0.45, -ast.radius * 0.3);
        ctx.lineTo(0, 0);
        ctx.lineTo(ast.radius * 0.35, ast.radius * 0.4);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Render Magnetic Tractor Beams
    for (const gem of this.gems) {
      if (gem.magnetTarget !== null) {
        const target = this.ships.get(gem.magnetTarget);
        if (target && target.alive) {
          ctx.save();
          ctx.strokeStyle = target.isUnderdog ? 'rgba(245, 158, 11, 0.65)' : 'rgba(56, 189, 248, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(gem.x, gem.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Render Gems
    for (const gem of this.gems) {
      ctx.save();
      ctx.translate(gem.x, gem.y);
      ctx.rotate(gem.sparkleTimer);

      ctx.shadowColor = gem.glowColor;
      ctx.shadowBlur = gem.isGolden ? 18 : 12;

      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 9);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fillStyle = gem.color;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.restore();
    }

    // Render Ships
    for (const ship of this.ships.values()) {
      if (!ship.alive) continue;
      const isBot = this.players[ship.id]?.type.startsWith('bot_') ?? false;

      ctx.save();
      ctx.translate(ship.x, ship.y);

      // Underdog Tractor Aura
      if (ship.isUnderdog) {
        ctx.save();
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, ship.radius + 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.rotate(ship.angle);

      const pCfg = this.players[ship.id];
      const shipColor = pCfg?.color || '#38BDF8';

      // Cargo pods trailing behind ship
      for (let c = 0; c < ship.cargo; c++) {
        const podDist = ship.radius + 12 + c * 10;
        const podAngle = Math.PI + Math.sin(this.roundTimer * 6 + c) * 0.4;
        const cx = Math.cos(podAngle) * podDist;
        const cy = Math.sin(podAngle) * podDist;

        ctx.beginPath();
        ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#38BDF8';
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Ship chassis
      ctx.beginPath();
      ctx.moveTo(ship.radius + 4, 0);
      ctx.lineTo(-ship.radius, -ship.radius * 0.85);
      ctx.lineTo(-ship.radius * 0.5, 0);
      ctx.lineTo(-ship.radius, ship.radius * 0.85);
      ctx.closePath();

      ctx.fillStyle = shipColor;
      ctx.shadowColor = shipColor;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Spinning Drill Bumper on bow
      ctx.save();
      ctx.translate(ship.radius + 7, 0);
      ctx.rotate(ship.drillSpin);
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-4, -6);
      ctx.lineTo(-4, 6);
      ctx.closePath();
      ctx.fillStyle = '#FACC15';
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      // Mascot Pilot in Cockpit
      let mood: CharacterMood = 'focused';
      if (ship.bumpCooldown > 0) {
        mood = 'shocked';
      } else if (ship.cargo >= 4 || this.isFinished) {
        mood = 'triumph';
      } else if (ship.streak >= 2) {
        mood = 'happy';
      }

      drawCharacter(ctx, 0, 0, 8, ship.id, isBot, mood, this.roundTimer * 4);

      if (ship.cargo >= 5) {
        ctx.save();
        ctx.fillStyle = '#EF4444';
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 8;
        ctx.font = '900 11px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('FULL! 💎', 0, -ship.radius - 12);
        ctx.restore();
      }

      ctx.restore();

      // Dotted Nav Line to Depot when carrying high cargo
      if (ship.cargo >= 3) {
        const myDepot = this.depots.find((d) => d.playerId === ship.id);
        if (myDepot) {
          ctx.save();
          ctx.strokeStyle = `${shipColor}55`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(ship.x, ship.y);
          ctx.lineTo(myDepot.x, myDepot.y);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Player Name
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pCfg?.name || `P${ship.id + 1}`, ship.x, ship.y - ship.radius - 14);
    }

    // Render Floating Notification Texts
    for (const ft of this.floatingTexts) {
      const alpha = Math.max(0, Math.min(1, ft.life / 0.3));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '900 13px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0F172A';
      ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // Minigame Subheader at safe position y: 56
    this.renderCenterHUD(ctx, width, theme);
  }

  private renderCenterHUD(ctx: CanvasRenderingContext2D, width: number, theme: AsteroidTheme): void {
    const active = this.getActivePlayers();
    const hudW = Math.min(width - 60, 480);
    const hudH = 26;
    const hudX = width / 2 - hudW / 2;
    const hudY = 56;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, hudW, hudH, 13);
    ctx.fill();
    ctx.strokeStyle = this.isSuddenDeath ? '#EF4444' : theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (this.isSuddenDeath) {
      const flash = Math.sin(this.suddenDeathFlashTimer * 10) > 0;
      ctx.fillStyle = flash ? '#FDE047' : '#EF4444';
      ctx.fillText('⚡ SUDDEN DEATH: GOLDEN ASTRAL CORE & 2X BANKING! ⚡', width / 2, hudY + 13);
    } else {
      const summary = active
        .map((p) => {
          const ship = this.ships.get(p.id);
          const score = ship?.bankedScore || 0;
          const cargo = ship?.cargo || 0;
          return `${p.name}: 💎${score} [${cargo}/5]`;
        })
        .join('   •   ');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(summary, width / 2, hudY + 13);
    }
    ctx.restore();

    // Theme Pill at bottom-left: x: 20, y: height - 44, w: 170, h: 32
    ctx.save();
    const pillX = 20;
    const pillY = this.lastHeight - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.strokeStyle = theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.name} [T]`, pillX + pillW * 0.5, pillY + pillH * 0.5);

    // Right-aligned Control Hints
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '11px "Outfit", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('Steer: A/D or Left/Right • Thrust: Space/Enter/W', width - 24, this.lastHeight - 28);
    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished || this.roundTimer <= 0;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    let winnerId: PlayerId | null = null;
    let highestScore = -1;

    active.forEach((p) => {
      const ship = this.ships.get(p.id);
      const sc = ship?.bankedScore || 0;
      if (sc > highestScore) {
        highestScore = sc;
        winnerId = p.id;
      }
    });

    const sorted = [...active].sort((a, b) => {
      const scA = this.ships.get(a.id)?.bankedScore || 0;
      const scB = this.ships.get(b.id)?.bankedScore || 0;
      return scB - scA;
    });

    if (sorted.length > 1) {
      const top1 = this.ships.get(sorted[0].id)?.bankedScore || 0;
      const top2 = this.ships.get(sorted[1].id)?.bankedScore || 0;
      if (top1 === top2) {
        winnerId = null;
      }
    }

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      place: idx + 1,
      score: this.ships.get(p.id)?.bankedScore || 0
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight:
        winnerId !== null
          ? `${this.players[winnerId].name} secured the salvage victory with ${highestScore} celestial gems!`
          : `Salvage shift concluded in a cosmic tie at ${highestScore >= 0 ? highestScore : 0} gems!`
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }
}
