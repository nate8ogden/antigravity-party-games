import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface AsteroidGeode {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  type: 'emerald' | 'sapphire' | 'ruby' | 'magma';
  points: number;
  color: string;
  isHazard: boolean;
  angle: number;
  spin: number;
}

interface GemShard {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  value: number;
  color: string;
}

interface MiningRig {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  baseMaxSpeed: number;
  radius: number;
  score: number;
  miningStreak: number;

  // Diamond Plasma Drill Hold-to-Charge & Surge
  isCharging: boolean;
  chargeTime: number; // 0 to 1.2s
  isDrillSurging: boolean;
  surgeTimer: number;
  isStalled: boolean;
  stallTimer: number;

  shuntCooldown: number;
  isUnderdog: boolean;

  // Mascot emotion & animation
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
}

interface AsteroidTheme {
  id: string;
  name: string;
  icon: string;
  spaceDark: string;
  spaceLight: string;
  rockColor: string;
  rockCrust: string;
  gemEmerald: string;
  gemSapphire: string;
  gemRuby: string;
  accentColor: string;
}

const THEMES: AsteroidTheme[] = [
  {
    id: 'kuiper_belt',
    name: 'Kuiper Belt Field ☄️',
    icon: '☄️',
    spaceDark: '#040711',
    spaceLight: '#0C1626',
    rockColor: '#37474F',
    rockCrust: '#546E7A',
    gemEmerald: '#00E676',
    gemSapphire: '#00B0FF',
    gemRuby: '#FF1744',
    accentColor: '#00E5FF'
  },
  {
    id: 'vulcan_forge',
    name: 'Volcanic Vulcan Forge 🌋',
    icon: '🌋',
    spaceDark: '#120401',
    spaceLight: '#260B04',
    rockColor: '#2C1B18',
    rockCrust: '#5D2E24',
    gemEmerald: '#76FF03',
    gemSapphire: '#FF9100',
    gemRuby: '#FF3D00',
    accentColor: '#FF5722'
  },
  {
    id: 'cyber_belt',
    name: 'Crystalline Cyber Belt 💎',
    icon: '💎',
    spaceDark: '#0B0218',
    spaceLight: '#1F0638',
    rockColor: '#2B1442',
    rockCrust: '#5E2B8F',
    gemEmerald: '#00F5FF',
    gemSapphire: '#E040FB',
    gemRuby: '#FFD700',
    accentColor: '#E040FB'
  }
];

export class AstroMinerGame extends BaseGame {
  public currentMapName: string = 'Kuiper Belt Field ☄️';
  private currentThemeIdx: number = 0;

  private rigs: Map<PlayerId, MiningRig> = new Map();
  private asteroids: AsteroidGeode[] = [];
  private shards: GemShard[] = [];
  private asteroidIdCounter: number = 0;
  private shardIdCounter: number = 0;
  private spawnAsteroidTimer: number = 1.0;

  // Starfield
  private stars: { x: number; y: number; size: number; alpha: number }[] = [];

  // Bot AI timers
  private botReactionTimers: Map<PlayerId, number> = new Map();

  // Listeners
  private keydownHandler?: (e: KeyboardEvent) => void;
  private clickHandler?: (e: MouseEvent) => void;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
    this.roundTimer = 38.0;

    if (typeof window !== 'undefined') {
      this.keydownHandler = (e: KeyboardEvent) => {
        if (e.code === 'KeyT') {
          this.cycleTheme();
        } else if (e.code === 'Digit1') {
          this.setTheme(0);
        } else if (e.code === 'Digit2') {
          this.setTheme(1);
        } else if (e.code === 'Digit3') {
          this.setTheme(2);
        }
      };
      window.addEventListener('keydown', this.keydownHandler);

      this.clickHandler = (e: MouseEvent) => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
        const mouseY = ((e.clientY - rect.top) / rect.height) * canvas.height;

        // Theme pill: x: 20, y: height - 44, w: 170, h: 32
        const pillY = canvas.height - 44;
        if (mouseX >= 20 && mouseX <= 190 && mouseY >= pillY && mouseY <= pillY + 32) {
          this.cycleTheme();
        }
      };
      window.addEventListener('click', this.clickHandler);
    }
  }

  public override destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);
      if (this.clickHandler) window.removeEventListener('click', this.clickHandler);
    }
    super.destroy();
  }

  public cycleTheme(): void {
    this.setTheme((this.currentThemeIdx + 1) % THEMES.length);
  }

  public setTheme(idx: number): void {
    this.currentThemeIdx = (idx + THEMES.length) % THEMES.length;
    this.currentMapName = THEMES[this.currentThemeIdx].name;
    this.audio.playTap();
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 38.0;
    this.isFinished = false;
    this.rigs.clear();
    this.asteroids = [];
    this.shards = [];
    this.stars = [];
    this.asteroidIdCounter = 0;
    this.shardIdCounter = 0;
    this.spawnAsteroidTimer = 1.0;

    // Starfield
    for (let i = 0; i < 75; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.6,
        alpha: 0.3 + Math.random() * 0.7
      });
    }

    // Spawn 10 initial asteroids
    for (let i = 0; i < 10; i++) {
      this.spawnAsteroid(width, height);
    }

    const active = this.getActivePlayers();
    const spawnOffsets = [
      { x: 95, y: 95, angle: Math.PI * 0.25 },
      { x: width - 95, y: 95, angle: Math.PI * 0.75 },
      { x: 95, y: height - 120, angle: -Math.PI * 0.25 },
      { x: width - 95, y: height - 120, angle: -Math.PI * 0.75 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnOffsets[idx % spawnOffsets.length];
      this.rigs.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: pos.angle,
        speed: 0,
        baseMaxSpeed: 225,
        radius: 18,
        score: 0,
        miningStreak: 0,

        isCharging: false,
        chargeTime: 0,
        isDrillSurging: false,
        surgeTimer: 0,
        isStalled: false,
        stallTimer: 0,

        shuntCooldown: 0,
        isUnderdog: false,

        mood: 'idle',
        moodTimer: 0,
        animTimer: idx * 0.3
      });

      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  private spawnAsteroid(width: number, height: number): void {
    const roll = Math.random();
    const theme = THEMES[this.currentThemeIdx];

    let type: AsteroidGeode['type'] = 'emerald';
    let pts = 25;
    let rad = 22;
    let hp = 3;
    let col = theme.gemEmerald;
    let isHazard = false;

    if (roll < 0.18) {
      type = 'magma';
      pts = -20;
      rad = 26;
      hp = 4;
      col = '#FF1744';
      isHazard = true;
    } else if (roll < 0.38) {
      type = 'ruby';
      pts = 75;
      rad = 28;
      hp = 4;
      col = theme.gemRuby;
    } else if (roll < 0.68) {
      type = 'sapphire';
      pts = 45;
      rad = 24;
      hp = 3;
      col = theme.gemSapphire;
    }

    this.asteroids.push({
      id: ++this.asteroidIdCounter,
      x: 60 + Math.random() * (width - 120),
      y: 70 + Math.random() * (height - 140),
      vx: (Math.random() - 0.5) * 28,
      vy: (Math.random() - 0.5) * 28,
      radius: rad,
      hp,
      maxHp: hp,
      type,
      points: pts,
      color: col,
      isHazard,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 1.5
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update asteroids drift
    for (const ast of this.asteroids) {
      ast.x += ast.vx * dt;
      ast.y += ast.vy * dt;
      ast.angle += ast.spin * dt;

      if (ast.x < ast.radius + 15) { ast.x = ast.radius + 15; ast.vx *= -1; }
      if (ast.x > width - ast.radius - 15) { ast.x = width - ast.radius - 15; ast.vx *= -1; }
      if (ast.y < ast.radius + 40) { ast.y = ast.radius + 40; ast.vy *= -1; }
      if (ast.y > height - ast.radius - 15) { ast.y = height - ast.radius - 15; ast.vy *= -1; }
    }

    // Maintain asteroid count
    this.spawnAsteroidTimer -= dt;
    if (this.spawnAsteroidTimer <= 0 && this.asteroids.length < 11) {
      this.spawnAsteroidTimer = 2.0 + Math.random() * 1.5;
      this.spawnAsteroid(width, height);
    }

    // Determine max score for Underdog
    let maxScore = 0;
    for (const r of this.rigs.values()) {
      if (r.score > maxScore) maxScore = r.score;
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();

    // 1. Update Mining Rigs
    for (const p of active) {
      const r = this.rigs.get(p.id);
      if (!r) continue;

      r.animTimer += dt;
      if (r.moodTimer > 0) {
        r.moodTimer -= dt;
        if (r.moodTimer <= 0) r.mood = 'idle';
      }

      if (r.shuntCooldown > 0) r.shuntCooldown -= dt;

      // Underdog check: trailing by >= 35 pts
      r.isUnderdog = (maxScore - r.score >= 35);

      // Handle Stalled State
      if (r.stallTimer > 0) {
        r.stallTimer -= dt;
        r.vx *= 0.93;
        r.vy *= 0.93;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        if (Math.random() < 0.4) {
          this.particles.emit(r.x, r.y, 2, '#FF1744');
        }
        continue;
      }

      const steer = this.input.getSteer(r.id);
      const isActionHeld = this.input.isPressed(r.id) || this.input.isActionPressed(r.id);

      // Turning
      if (steer !== 0) {
        const turnRate = r.isUnderdog ? 4.5 : 3.8;
        r.angle += steer * turnRate * dt;
      }

      // Hold-to-Charge Diamond Plasma Drill & Surge
      if (isActionHeld && !r.isStalled) {
        r.isCharging = true;
        const chargeRate = r.isUnderdog ? 1.4 : 1.0;
        r.chargeTime = Math.min(1.2, r.chargeTime + dt * chargeRate);
        r.mood = 'focused';

        // Cruise thrust forward while revving drill
        const thrust = 190;
        r.vx += Math.cos(r.angle) * thrust * dt;
        r.vy += Math.sin(r.angle) * thrust * dt;

        // Drill tip plasma sparks
        if (Math.random() < 0.5) {
          const drillX = r.x + Math.cos(r.angle) * 22;
          const drillY = r.y + Math.sin(r.angle) * 22;
          this.particles.emit(drillX, drillY, 2, '#FFD700');
        }

        // Overheat motor stall
        if (r.chargeTime >= 1.2) {
          r.isStalled = true;
          r.stallTimer = 1.0;
          r.chargeTime = 0;
          r.isCharging = false;
          r.miningStreak = 0;
          r.mood = 'shocked';
          r.moodTimer = 1.0;
          this.audio.playExplosion();
          this.particles.spawnExplosion(r.x, r.y, '#FF1744', 16);
        }
      } else if (r.isCharging) {
        // Released -> Hyper-Drill Kinetic Breaker!
        const chargeRatio = r.chargeTime / 1.0;
        r.isCharging = false;
        r.chargeTime = 0;

        const sweetMin = r.isUnderdog ? 0.50 : 0.72;
        const sweetMax = r.isUnderdog ? 1.00 : 0.98;
        const isSweet = chargeRatio >= sweetMin && chargeRatio <= sweetMax;

        if (isSweet) {
          // PERFECT SWEET SPOT: Hyper-Drill Kinetic Breaker!
          r.isDrillSurging = true;
          r.surgeTimer = 1.5;
          r.speed = r.baseMaxSpeed * 2.55;
          r.vx = Math.cos(r.angle) * r.speed;
          r.vy = Math.sin(r.angle) * r.speed;
          r.score += 20; // +20 Drill Breaker Bonus!
          r.mood = 'triumph';
          r.moodTimer = 1.2;
          this.audio.playFanfare();
          this.particles.spawnExplosion(r.x, r.y, '#00E5FF', 16);

          // Vacuum up loose shards in 150px range
          for (const s of this.shards) {
            if (Math.hypot(s.x - r.x, s.y - r.y) < 150) {
              const pullAngle = Math.atan2(r.y - s.y, r.x - s.x);
              s.vx += Math.cos(pullAngle) * 380;
              s.vy += Math.sin(pullAngle) * 380;
            }
          }
        } else if (chargeRatio > 0.25) {
          // Mini drill burst
          r.isDrillSurging = true;
          r.surgeTimer = 0.8;
          r.speed = r.baseMaxSpeed * 1.4;
          r.vx = Math.cos(r.angle) * r.speed;
          r.vy = Math.sin(r.angle) * r.speed;
          this.audio.playScore();
          this.particles.emit(r.x, r.y, 6, '#FFD54F');
        }
      } else {
        if (r.isDrillSurging) {
          r.surgeTimer -= dt;
          if (r.surgeTimer <= 0) r.isDrillSurging = false;
        } else {
          // Base cruise decay
          const maxCruise = r.isUnderdog ? r.baseMaxSpeed * 1.25 : r.baseMaxSpeed;
          r.speed = Math.hypot(r.vx, r.vy);
          if (r.speed > maxCruise) {
            r.vx *= 0.95;
            r.vy *= 0.95;
          } else {
            r.vx += Math.cos(r.angle) * 120 * dt;
            r.vy += Math.sin(r.angle) * 120 * dt;
          }
        }
      }

      // Drag
      r.vx *= Math.pow(0.97, dt * 60);
      r.vy *= Math.pow(0.97, dt * 60);
      r.x += r.vx * dt;
      r.y += r.vy * dt;

      // Arena bounds
      const margin = 24;
      if (r.x < margin) { r.x = margin; r.vx = Math.abs(r.vx) * 0.7; this.audio.playBounce(); }
      if (r.x > width - margin) { r.x = width - margin; r.vx = -Math.abs(r.vx) * 0.7; this.audio.playBounce(); }
      if (r.y < margin + 35) { r.y = margin + 35; r.vy = Math.abs(r.vy) * 0.7; this.audio.playBounce(); }
      if (r.y > height - margin) { r.y = height - margin; r.vy = -Math.abs(r.vy) * 0.7; this.audio.playBounce(); }

      // Check Collision with Asteroids
      for (let aIdx = this.asteroids.length - 1; aIdx >= 0; aIdx--) {
        const ast = this.asteroids[aIdx];
        if (Math.hypot(r.x - ast.x, r.y - ast.y) < r.radius + ast.radius) {
          if (ast.isHazard) {
            // Hit Magma Asteroid
            if (!r.isDrillSurging && !r.isUnderdog) {
              r.isStalled = true;
              r.stallTimer = 1.1;
              r.miningStreak = 0;
              r.score = Math.max(0, r.score - 20);
              r.mood = 'shocked';
              r.moodTimer = 1.2;
              this.audio.playExplosion();
              this.particles.spawnExplosion(ast.x, ast.y, '#FF1744', 18);
              this.asteroids.splice(aIdx, 1);
              break;
            } else {
              // Drill surge shatters magma hazard safely!
              this.audio.playExplosion();
              this.particles.spawnExplosion(ast.x, ast.y, '#FFD700', 16);
              this.asteroids.splice(aIdx, 1);
              break;
            }
          } else {
            // Mined normal geode!
            r.miningStreak++;
            const suddenDeathMult = this.roundTimer <= 12.0 ? 2 : 1;
            const streakMult = Math.min(3, r.miningStreak);
            const earnedPts = ast.points * streakMult * suddenDeathMult;
            r.score += earnedPts;

            // Spawn floating gem shards
            const shardCount = 3 + Math.floor(Math.random() * 3);
            for (let s = 0; s < shardCount; s++) {
              const a = (s / shardCount) * Math.PI * 2;
              const spd = 70 + Math.random() * 70;
              this.shards.push({
                id: ++this.shardIdCounter,
                x: ast.x,
                y: ast.y,
                vx: Math.cos(a) * spd,
                vy: Math.sin(a) * spd,
                radius: 8,
                value: 15,
                color: ast.color
              });
            }

            r.mood = 'triumph';
            r.moodTimer = 1.4;
            this.audio.playFanfare();
            this.particles.spawnExplosion(ast.x, ast.y, ast.color, 18);
            this.asteroids.splice(aIdx, 1);
            break;
          }
        }
      }

      // Check Shard Pickups
      const vacuumRange = r.isUnderdog ? 38 : 24;
      for (let sIdx = this.shards.length - 1; sIdx >= 0; sIdx--) {
        const shard = this.shards[sIdx];
        if (Math.hypot(r.x - shard.x, r.y - shard.y) < r.radius + vacuumRange) {
          r.score += shard.value;
          this.audio.playScore();
          this.particles.emit(shard.x, shard.y, 6, shard.color);
          this.shards.splice(sIdx, 1);
        }
      }
    }

    // 2. Physical Shunting & Geode Claim Sabotage ($m_1 v_1 + m_2 v_2$)
    const rigArray = Array.from(this.rigs.values());
    for (let i = 0; i < rigArray.length; i++) {
      for (let j = i + 1; j < rigArray.length; j++) {
        const r1 = rigArray[i];
        const r2 = rigArray[j];
        if (r1.isStalled || r2.isStalled) continue;

        const dx = r2.x - r1.x;
        const dy = r2.y - r1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = r1.radius + r2.radius + 6;

        if (dist < minDist && dist > 0.001) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          r1.x -= nx * overlap * 0.5;
          r1.y -= ny * overlap * 0.5;
          r2.x += nx * overlap * 0.5;
          r2.y += ny * overlap * 0.5;

          const r1IsShunter = r1.isDrillSurging || Math.hypot(r1.vx, r1.vy) > Math.hypot(r2.vx, r2.vy) + 60;
          const r2IsShunter = r2.isDrillSurging || Math.hypot(r2.vx, r2.vy) > Math.hypot(r1.vx, r1.vy) + 60;

          if (r1IsShunter && r1.shuntCooldown <= 0) {
            r1.score += 30; // +30 Sabotage Bonus!
            r1.shuntCooldown = 1.0;
            r2.miningStreak = 0;
            r2.isStalled = true;
            r2.stallTimer = 0.8;
            r2.mood = 'shocked';
            r2.moodTimer = 1.2;
            r1.mood = 'triumph';
            r1.moodTimer = 1.2;
            this.audio.playExplosion();
            this.particles.spawnExplosion((r1.x + r2.x) * 0.5, (r1.y + r2.y) * 0.5, '#FF5252', 16);
          } else if (r2IsShunter && r2.shuntCooldown <= 0) {
            r2.score += 30;
            r2.shuntCooldown = 1.0;
            r1.miningStreak = 0;
            r1.isStalled = true;
            r1.stallTimer = 0.8;
            r1.mood = 'shocked';
            r1.moodTimer = 1.2;
            r2.mood = 'triumph';
            r2.moodTimer = 1.2;
            this.audio.playExplosion();
            this.particles.spawnExplosion((r1.x + r2.x) * 0.5, (r1.y + r2.y) * 0.5, '#FF5252', 16);
          } else {
            this.audio.playBounce();
            this.particles.emit((r1.x + r2.x) * 0.5, (r1.y + r2.y) * 0.5, 4, '#FFFFFF');
          }

          // Elastic impulse
          const kx = r1.vx - r2.vx;
          const ky = r1.vy - r2.vy;
          const pImpulse = 2 * (nx * kx + ny * ky) / 2;
          r1.vx -= pImpulse * nx * 0.85;
          r1.vy -= pImpulse * ny * 0.85;
          r2.vx += pImpulse * nx * 0.85;
          r2.vy += pImpulse * ny * 0.85;
        }
      }
    }

    // 3. Update Gem Shards Drift
    for (const shard of this.shards) {
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      shard.vx *= Math.pow(0.97, dt * 60);
      shard.vy *= Math.pow(0.97, dt * 60);

      if (shard.x < 15) { shard.x = 15; shard.vx *= -1; }
      if (shard.x > width - 15) { shard.x = width - 15; shard.vx *= -1; }
      if (shard.y < 45) { shard.y = 45; shard.vy *= -1; }
      if (shard.y > height - 15) { shard.y = height - 15; shard.vy *= -1; }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const r = this.rigs.get(botId);
    if (!r || r.isStalled) return;

    let targetX = _width * 0.5;
    let targetY = _height * 0.5;
    let holdAction = false;

    // First priority: vacuum loose gem shards
    if (this.shards.length > 0) {
      let minDist = 99999;
      for (const s of this.shards) {
        const d = Math.hypot(s.x - r.x, s.y - r.y);
        if (d < minDist) {
          minDist = d;
          targetX = s.x;
          targetY = s.y;
        }
      }
    } else {
      // Find highest value non-hazard geode
      let bestAst: AsteroidGeode | null = null;
      let bestScore = -999;

      for (const ast of this.asteroids) {
        if (ast.isHazard) continue; // Avoid magma
        const d = Math.hypot(ast.x - r.x, ast.y - r.y);
        const score = (ast.points * 3.0) - d * 0.4;
        if (score > bestScore) {
          bestScore = score;
          bestAst = ast;
        }
      }

      if (bestAst) {
        targetX = bestAst.x;
        targetY = bestAst.y;

        const dAst = Math.hypot(bestAst.x - r.x, bestAst.y - r.y);
        if (dAst < 160) {
          if (r.chargeTime < 0.85) {
            holdAction = true;
          } else {
            holdAction = false; // Sweet spot release to drill shatter!
          }
        }
      }
    }

    // Magma hazard avoidance
    if (!r.isUnderdog) {
      for (const ast of this.asteroids) {
        if (ast.isHazard && Math.hypot(ast.x - r.x, ast.y - r.y) < 70) {
          const evadeAngle = Math.atan2(r.y - ast.y, r.x - ast.x);
          targetX = r.x + Math.cos(evadeAngle) * 90;
          targetY = r.y + Math.sin(evadeAngle) * 90;
        }
      }
    }

    const dx = targetX - r.x;
    const dy = targetY - r.y;
    const targetAngle = Math.atan2(dy, dx);

    let angleDiff = targetAngle - r.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff -= Math.PI * 2;

    let turn = 0;
    if (Math.abs(angleDiff) > 0.08) {
      turn = angleDiff > 0 ? 1 : -1;
    }

    let delay = 0.24;
    if (difficulty === 'bot_easy') {
      delay = 0.42;
      if (Math.random() < 0.22) turn = -turn;
      if (Math.random() < 0.3) holdAction = false;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11;
      // Hard bot executes predictive sweet spot surges into rivals
      for (const other of this.rigs.values()) {
        if (other.id === botId) continue;
        if (Math.hypot(other.x - r.x, other.y - r.y) < 140 && Math.abs(angleDiff) < 0.3) {
          holdAction = false; // Unleash surge to shunt rival!
          break;
        }
      }
    }

    this.input.setBotInput(botId, holdAction, turn, 1, false);
    this.botReactionTimers.set(botId, delay);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const active = this.getActivePlayers();
    const theme = THEMES[this.currentThemeIdx];

    // 1. Cosmic Void Background Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, theme.spaceDark);
    skyGrad.addColorStop(1, theme.spaceLight);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Stars
    for (const s of this.stars) {
      ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }

    // 2. Render Asteroids & Geode Cores
    for (const ast of this.asteroids) {
      ctx.save();
      ctx.translate(ast.x, ast.y);
      ctx.rotate(ast.angle);

      // Outer rugged rock crust
      ctx.fillStyle = theme.rockColor;
      ctx.beginPath();
      ctx.arc(0, 0, ast.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = theme.rockCrust;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Glowing inner gem geode core
      ctx.shadowColor = ast.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = ast.color;
      ctx.beginPath();
      ctx.arc(0, 0, ast.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Magma hazard warning flames
      if (ast.isHazard) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('MAGMA', 0, 3);
      } else {
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 9px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`+${ast.points}`, 0, 3);
      }

      ctx.restore();
    }

    // 3. Render Gem Shards
    for (const s of this.shards) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.moveTo(0, -s.radius);
      ctx.lineTo(s.radius * 0.8, 0);
      ctx.lineTo(0, s.radius);
      ctx.lineTo(-s.radius * 0.8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Render Mining Rigs & Mascot Miners
    for (const [id, r] of this.rigs.entries()) {
      const p = this.players.find(pl => pl.id === id);
      const color = p ? p.color : '#00E5FF';
      const isBot = p ? p.type !== 'human' : false;

      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.angle);

      // Space shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(3, 4, r.radius + 4, r.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hyper-Drill Kinetic Breaker Aura
      if (r.isDrillSurging) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, r.radius + 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Mining Rig Heavy Chassis (2.5D Hex Industrial Rig)
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-12, -13);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-12, 13);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Front Diamond Plasma Drill Bit
      ctx.fillStyle = '#ECEFF1';
      ctx.beginPath();
      ctx.moveTo(14, -6);
      ctx.lineTo(24, 0);
      ctx.lineTo(14, 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Glass Cockpit with Mascot Miner Inside
      ctx.save();
      ctx.rotate(Math.PI / 2);
      drawCharacter(ctx, 0, 0, 13, id, isBot, r.mood, r.animTimer, undefined);
      ctx.restore();

      // Underdog Diamond Cutter Aura
      if (r.isUnderdog) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, r.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Hold-to-Charge Drill Gauge
      if (r.isCharging) {
        const ratio = r.chargeTime / 1.0;
        const sweetMin = r.isUnderdog ? 0.50 : 0.72;
        const sweetMax = r.isUnderdog ? 1.00 : 0.98;
        const isSweet = ratio >= sweetMin && ratio <= sweetMax;

        ctx.strokeStyle = isSweet ? '#00E5FF' : (ratio > sweetMax ? '#FF1744' : '#FFD700');
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, r.radius + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ratio));
        ctx.stroke();
      }

      ctx.restore();

      // Floating Score & Mining Streak Tag above rig
      ctx.fillStyle = color;
      ctx.font = 'bold 13px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      const streakLabel = r.miningStreak > 1 ? ` (x${r.miningStreak} STREAK!)` : '';
      ctx.fillText(`${r.score} pts${streakLabel}`, r.x, r.y - 28);

      if (r.isStalled) {
        ctx.fillStyle = '#FF1744';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText('⚡ MOTOR STALL!', r.x, r.y - 42);
      } else if (r.isDrillSurging) {
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText('⚡ HYPER-DRILL SURGE!', r.x, r.y - 42);
      }
    }

    // 5. Strict UI Overlays (Top-Center Safe Zone & Header Badge)
    // Global safe zone for timer: y: 12-44, width 160 centered.
    // Minigame Header Badge at y: 56, h: 28
    ctx.save();
    const badgeW = 280;
    const badgeH = 28;
    const badgeX = (width - badgeW) / 2;
    const badgeY = 56;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 14);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ASTRO MINER • GEODE BREAKER', width / 2, badgeY + 18);
    ctx.restore();

    // 6. Bottom-Left Theme Pill: x: 20, y: height - 44, w: 170, h: 32
    ctx.save();
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${theme.name} [T]`, pillX + 10, pillY + 20);
    ctx.restore();

    // 7. Player Corner Cards (Safe offset y: height - 128, w: 130, h: 48)
    const cardY = height - 128;
    active.forEach((p, idx) => {
      const r = this.rigs.get(p.id);
      if (!r) return;

      const cardX = 20 + idx * 142;
      if (cardX + 130 > width) return;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 130, 48, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = 'bold 12px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 8, cardY + 18);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px Montserrat, sans-serif';
      ctx.fillText(`${r.score} pts`, cardX + 8, cardY + 38);

      ctx.fillStyle = '#B0BEC5';
      ctx.font = '10px Montserrat, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${r.miningStreak}x STREAK`, cardX + 122, cardY + 38);
      ctx.restore();
    });
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const r = this.rigs.get(p.id);
      return {
        playerId: p.id,
        score: r ? r.score : 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null
        ? `Player ${typeof winnerId === 'number' ? winnerId + 1 : winnerId} shattered the asteroid belt with supreme diamond plasma drilling!`
        : 'All mining rigs ran out of drill bits!'
    };
  }
}
