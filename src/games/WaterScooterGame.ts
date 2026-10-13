import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface ScooterRacer {
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
  nextGateIdx: number;
  laps: number;
  
  // Turbo mechanic
  isCharging: boolean;
  chargeTime: number; // 0 to 1.2s
  isBoosting: boolean;
  boostTimer: number;
  isCavitated: boolean; // Overcharge penalty
  cavitationTimer: number;

  // Drafting & Shunting
  isDrafting: boolean;
  spinoutTimer: number;
  shuntCooldown: number;
  isUnderdog: boolean;

  // Mascot animation
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
}

interface SlalomBuoy {
  id: number;
  x: number;
  y: number;
  radius: number;
  targetSide: 'left' | 'right';
  bobPhase: number;
  passedBy: Set<PlayerId>;
}

interface GoldenSpeedRing {
  id: number;
  x: number;
  y: number;
  radius: number;
  active: boolean;
  pulseTimer: number;
}

interface WaterTheme {
  id: string;
  name: string;
  icon: string;
  waterDeep: string;
  waterShallow: string;
  waveFoam: string;
  buoyPort: string;
  buoyStarboard: string;
  trackLine: string;
  accentColor: string;
}

const THEMES: WaterTheme[] = [
  {
    id: 'tropical_lagoon',
    name: 'Tropical Lagoon 🏝️',
    icon: '🏝️',
    waterDeep: '#00695C',
    waterShallow: '#00897B',
    waveFoam: '#E0F2F1',
    buoyPort: '#FF1744',
    buoyStarboard: '#00E676',
    trackLine: 'rgba(255, 255, 255, 0.22)',
    accentColor: '#00E5FF'
  },
  {
    id: 'cyber_marina',
    name: 'Cyber Marina ⚡',
    icon: '⚡',
    waterDeep: '#0D0826',
    waterShallow: '#1A1440',
    waveFoam: '#E040FB',
    buoyPort: '#FF0055',
    buoyStarboard: '#00F5FF',
    trackLine: 'rgba(0, 245, 255, 0.28)',
    accentColor: '#FFD700'
  },
  {
    id: 'sunset_canyon',
    name: 'Sunset Wave Canyon 🌅',
    icon: '🌅',
    waterDeep: '#3E1F00',
    waterShallow: '#6D2B00',
    waveFoam: '#FFE082',
    buoyPort: '#D50000',
    buoyStarboard: '#FFD600',
    trackLine: 'rgba(255, 214, 0, 0.25)',
    accentColor: '#FF6D00'
  }
];

export class WaterScooterGame extends BaseGame {
  public currentMapName: string = 'Tropical Lagoon 🏝️';
  private currentThemeIdx: number = 0;

  private racers: Map<PlayerId, ScooterRacer> = new Map();
  private buoys: SlalomBuoy[] = [];
  private goldenRings: GoldenSpeedRing[] = [];
  private goldenRingSpawnTimer: number = 6.0;

  // Wave field simulation
  private waveTime: number = 0;

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

        // Theme pill bounds: x: 20, y: height - 44, w: 170, h: 32
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
    this.racers.clear();
    this.buoys = [];
    this.goldenRings = [];
    this.goldenRingSpawnTimer = 6.0;
    this.waveTime = 0;

    // 8-buoy dynamic circuit with left/right alternating slalom gates
    const buoyPositions = [
      { x: width * 0.22, y: height * 0.32, side: 'left' as const },
      { x: width * 0.40, y: height * 0.22, side: 'right' as const },
      { x: width * 0.65, y: height * 0.25, side: 'left' as const },
      { x: width * 0.82, y: height * 0.40, side: 'right' as const },
      { x: width * 0.78, y: height * 0.70, side: 'left' as const },
      { x: width * 0.58, y: height * 0.80, side: 'right' as const },
      { x: width * 0.36, y: height * 0.75, side: 'left' as const },
      { x: width * 0.16, y: height * 0.56, side: 'right' as const }
    ];

    buoyPositions.forEach((b, idx) => {
      this.buoys.push({
        id: idx,
        x: b.x,
        y: b.y,
        radius: 18,
        targetSide: b.side,
        bobPhase: idx * 0.8,
        passedBy: new Set()
      });
    });

    const active = this.getActivePlayers();
    const spawnBaseX = width * 0.20;
    const spawnBaseY = height * 0.52;

    active.forEach((p, idx) => {
      // Staggered grid starting positions along initial heading (north)
      const offsetX = (idx % 2 === 0 ? -24 : 24);
      const offsetY = Math.floor(idx / 2) * 36;

      this.racers.set(p.id, {
        id: p.id,
        x: spawnBaseX + offsetX,
        y: spawnBaseY + offsetY,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2, // Heading north toward buoy 0
        speed: 0,
        baseMaxSpeed: 235,
        radius: 17,
        score: 0,
        nextGateIdx: 0,
        laps: 0,

        isCharging: false,
        chargeTime: 0,
        isBoosting: false,
        boostTimer: 0,
        isCavitated: false,
        cavitationTimer: 0,

        isDrafting: false,
        spinoutTimer: 0,
        shuntCooldown: 0,
        isUnderdog: false,

        mood: 'idle',
        moodTimer: 0,
        animTimer: idx * 0.4
      });

      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.waveTime += dt * 3.0;

    // Golden speed ring spawner
    this.goldenRingSpawnTimer -= dt;
    if (this.goldenRingSpawnTimer <= 0) {
      this.goldenRingSpawnTimer = 8.5;
      if (this.goldenRings.length < 2) {
        // Spawn along open straights
        const rx = width * (0.3 + Math.random() * 0.4);
        const ry = height * (0.35 + Math.random() * 0.35);
        this.goldenRings.push({
          id: Date.now() + Math.random(),
          x: rx,
          y: ry,
          radius: 26,
          active: true,
          pulseTimer: 0
        });
      }
    }

    // Update golden rings
    for (let i = this.goldenRings.length - 1; i >= 0; i--) {
      const ring = this.goldenRings[i];
      ring.pulseTimer += dt * 4;
    }

    // Determine leader score for Underdog Wave-Runner
    let maxScore = 0;
    for (const r of this.racers.values()) {
      if (r.score > maxScore) maxScore = r.score;
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();

    // 1. Process Racer Inputs & State Updates
    for (const p of active) {
      const r = this.racers.get(p.id);
      if (!r) continue;

      r.animTimer += dt;
      if (r.moodTimer > 0) {
        r.moodTimer -= dt;
        if (r.moodTimer <= 0) r.mood = 'idle';
      }

      if (r.shuntCooldown > 0) r.shuntCooldown -= dt;
      if (r.cavitationTimer > 0) r.cavitationTimer -= dt;

      // Underdog check: trailing by >= 30 pts
      r.isUnderdog = (maxScore - r.score >= 30);

      // Handle spinout
      if (r.spinoutTimer > 0) {
        r.spinoutTimer -= dt;
        r.angle += 14.0 * dt; // Rapid spin
        r.speed = Math.max(0, r.speed - 300 * dt);
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.vx *= 0.92;
        r.vy *= 0.92;
        // Splash particles during spinout
        if (Math.random() < 0.4) {
          this.particles.emit(r.x, r.y, 2, '#FFFFFF');
        }
        continue;
      }

      // Read steer & action
      const steer = this.input.getSteer(r.id);
      const isActionHeld = this.input.isPressed(r.id);

      // Turning physics (angular agility slightly reduced at top speed for realistic water carving)
      const turnAgility = r.isBoosting ? 3.2 : 4.4;
      if (steer !== 0) {
        r.angle += steer * turnAgility * dt;
      }

      // Check slipstream drafting behind any forward rival
      r.isDrafting = false;
      for (const other of this.racers.values()) {
        if (other.id === r.id) continue;
        const dx = other.x - r.x;
        const dy = other.y - r.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 25 && dist < 120) {
          // Check if rival is ahead within ~40 degree cone
          const angleToOther = Math.atan2(dy, dx);
          let diff = angleToOther - r.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;

          if (Math.abs(diff) < 0.55) {
            // In draft wake!
            r.isDrafting = true;
            // Visual slipstream trails
            if (Math.random() < 0.3) {
              this.particles.emit((r.x + other.x) * 0.5, (r.y + other.y) * 0.5, 1, '#00E5FF');
            }
            break;
          }
        }
      }

      // Hold-to-Charge Hydro-Turbo Mechanic
      if (isActionHeld && !r.isCavitated) {
        r.isCharging = true;
        // Trailing underdog charges faster
        const chargeRate = r.isUnderdog ? 1.4 : 1.0;
        r.chargeTime = Math.min(1.2, r.chargeTime + dt * chargeRate);
        r.mood = 'focused';

        // Auto-acceleration while charging
        const normalCruise = r.baseMaxSpeed * 0.75;
        r.speed = Math.min(normalCruise, r.speed + 220 * dt);

        // Charging cavitation check: holding beyond 1.2s causes cavitation
        if (r.chargeTime >= 1.2) {
          r.isCavitated = true;
          r.cavitationTimer = 1.3;
          r.chargeTime = 0;
          r.isCharging = false;
          r.speed *= 0.45;
          r.mood = 'shocked';
          r.moodTimer = 1.0;
          this.audio.playExplosion();
          this.particles.emit(r.x, r.y, 10, '#B0BEC5'); // Steam clouds
        }
      } else if (r.isCharging) {
        // Action released -> trigger boost based on charge ratio
        const chargeRatio = r.chargeTime / 1.0; // 0 to 1 scale
        r.isCharging = false;
        r.chargeTime = 0;

        // Sweet spot window: Underdog gets 50%-100%, normal gets 72%-98%
        const sweetMin = r.isUnderdog ? 0.50 : 0.72;
        const sweetMax = r.isUnderdog ? 1.00 : 0.98;

        if (chargeRatio >= sweetMin && chargeRatio <= sweetMax) {
          // PERFECT SWEET SPOT: Overcharged Jet-Blast!
          r.isBoosting = true;
          r.boostTimer = 1.4;
          r.speed = r.baseMaxSpeed * 2.35;
          r.score += 15;
          r.mood = 'triumph';
          r.moodTimer = 1.2;
          this.audio.playFanfare();
          this.particles.spawnExplosion(r.x, r.y, '#00E5FF', 14);
        } else if (chargeRatio > 0.25) {
          // Mini-boost
          r.isBoosting = true;
          r.boostTimer = 0.75;
          r.speed = r.baseMaxSpeed * (1.3 + chargeRatio * 0.4);
          this.audio.playScore();
          this.particles.emit(r.x, r.y, 6, '#80DEEA');
        }
      } else {
        // Passive cruise acceleration
        let maxAllowedSpeed = r.baseMaxSpeed;
        if (r.isUnderdog) maxAllowedSpeed *= 1.22;
        if (r.isDrafting) maxAllowedSpeed *= 1.32;

        if (r.isBoosting) {
          r.boostTimer -= dt;
          if (r.boostTimer <= 0) {
            r.isBoosting = false;
          }
        } else {
          // Standard cruise decay
          if (r.speed > maxAllowedSpeed) {
            r.speed = Math.max(maxAllowedSpeed, r.speed - 180 * dt);
          } else {
            // Gentle base acceleration
            r.speed = Math.min(maxAllowedSpeed, r.speed + 160 * dt);
          }
        }
      }

      // Apply forward velocity
      r.vx = Math.cos(r.angle) * r.speed;
      r.vy = Math.sin(r.angle) * r.speed;

      r.x += r.vx * dt;
      r.y += r.vy * dt;

      // Dynamic Roostertail Water Wake
      if (r.speed > 80 && Math.random() < 0.6) {
        const wakeDist = 20;
        const wakeX = r.x - Math.cos(r.angle) * wakeDist;
        const wakeY = r.y - Math.sin(r.angle) * wakeDist;
        const foamColor = r.isBoosting ? '#00E5FF' : THEMES[this.currentThemeIdx].waveFoam;
        this.particles.emit(wakeX, wakeY, r.isBoosting ? 4 : 2, foamColor);
      }

      // Boundary Bounce with splash
      const margin = 26;
      if (r.x < margin) {
        r.x = margin;
        r.angle = Math.PI - r.angle;
        r.speed *= 0.65;
        this.audio.playBounce();
      }
      if (r.x > width - margin) {
        r.x = width - margin;
        r.angle = Math.PI - r.angle;
        r.speed *= 0.65;
        this.audio.playBounce();
      }
      if (r.y < margin + 40) { // Top safe zone
        r.y = margin + 40;
        r.angle = -r.angle;
        r.speed *= 0.65;
        this.audio.playBounce();
      }
      if (r.y > height - margin) {
        r.y = height - margin;
        r.angle = -r.angle;
        r.speed *= 0.65;
        this.audio.playBounce();
      }

      // Check Buoy Gates
      const targetBuoy = this.buoys[r.nextGateIdx];
      if (targetBuoy) {
        const bDist = Math.hypot(r.x - targetBuoy.x, r.y - targetBuoy.y);

        // Near-gate pass threshold
        if (bDist < targetBuoy.radius + 36) {
          // Check lateral side carving
          // Vector from buoy to scooter
          const toX = r.x - targetBuoy.x;
          const toY = r.y - targetBuoy.y;
          // Buoy targetSide determines required flank: left of buoy or right of buoy
          // Award gate slalom score
          const gatePts = this.roundTimer <= 12.0 ? 40 : 25; // Sudden death double gate pts
          r.score += gatePts;
          this.audio.playScore();
          this.particles.emit(targetBuoy.x, targetBuoy.y, 8, THEMES[this.currentThemeIdx].accentColor);

          r.nextGateIdx = (r.nextGateIdx + 1) % this.buoys.length;

          // Lap completed!
          if (r.nextGateIdx === 0) {
            r.laps++;
            r.score += 50;
            r.mood = 'triumph';
            r.moodTimer = 1.5;
            this.audio.playFanfare();
            this.particles.spawnConfetti(r.x, r.y, 20);
          }
        }
      }

      // Check Golden Speed Rings
      for (const ring of this.goldenRings) {
        if (!ring.active) continue;
        const rDist = Math.hypot(r.x - ring.x, r.y - ring.y);
        if (rDist < r.radius + ring.radius) {
          ring.active = false;
          r.score += 50;
          r.isBoosting = true;
          r.boostTimer = 2.0;
          r.speed = r.baseMaxSpeed * 2.5;
          r.mood = 'triumph';
          r.moodTimer = 1.5;
          this.audio.playFanfare();
          this.particles.spawnExplosion(ring.x, ring.y, '#FFD700', 18);
        }
      }
    }

    // Clean inactive golden rings
    this.goldenRings = this.goldenRings.filter(g => g.active);

    // 2. Physical Elastic Bumper Ram Collisions (m1 v1 + m2 v2)
    const racerArray = Array.from(this.racers.values());
    for (let i = 0; i < racerArray.length; i++) {
      for (let j = i + 1; j < racerArray.length; j++) {
        const r1 = racerArray[i];
        const r2 = racerArray[j];

        const dx = r2.x - r1.x;
        const dy = r2.y - r1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = r1.radius + r2.radius + 6;

        if (dist < minDist && dist > 0.001) {
          // Overlap separation
          const overlap = (minDist - dist);
          const nx = dx / dist;
          const ny = dy / dist;

          r1.x -= nx * overlap * 0.5;
          r1.y -= ny * overlap * 0.5;
          r2.x += nx * overlap * 0.5;
          r2.y += ny * overlap * 0.5;

          // Check if one scooter rammed the other with Boost/Turbo
          const r1IsRammer = r1.isBoosting || r1.speed > r2.speed + 60;
          const r2IsRammer = r2.isBoosting || r2.speed > r1.speed + 60;

          if (r1IsRammer && r1.shuntCooldown <= 0) {
            r1.score += 30; // Bumper Ram Sabotage bonus!
            r1.shuntCooldown = 1.0;
            r2.spinoutTimer = 0.8;
            r2.mood = 'shocked';
            r2.moodTimer = 1.0;
            r1.mood = 'triumph';
            r1.moodTimer = 1.0;
            this.audio.playExplosion();
            this.particles.spawnExplosion((r1.x + r2.x) * 0.5, (r1.y + r2.y) * 0.5, '#FF5252', 12);
          } else if (r2IsRammer && r2.shuntCooldown <= 0) {
            r2.score += 30; // Bumper Ram Sabotage bonus!
            r2.shuntCooldown = 1.0;
            r1.spinoutTimer = 0.8;
            r1.mood = 'shocked';
            r1.moodTimer = 1.0;
            r2.mood = 'triumph';
            r2.moodTimer = 1.0;
            this.audio.playExplosion();
            this.particles.spawnExplosion((r1.x + r2.x) * 0.5, (r1.y + r2.y) * 0.5, '#FF5252', 12);
          } else {
            // Elastic bumper bounce
            this.audio.playBounce();
            this.particles.emit((r1.x + r2.x) * 0.5, (r1.y + r2.y) * 0.5, 4, '#FFFFFF');
          }

          // Elastic momentum exchange
          const kx = r1.vx - r2.vx;
          const ky = r1.vy - r2.vy;
          const p = 2 * (nx * kx + ny * ky) / 2;

          r1.vx -= p * nx * 0.85;
          r1.vy -= p * ny * 0.85;
          r2.vx += p * nx * 0.85;
          r2.vy += p * ny * 0.85;

          r1.speed = Math.hypot(r1.vx, r1.vy);
          r2.speed = Math.hypot(r2.vx, r2.vy);
        }
      }
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

    const r = this.racers.get(botId);
    if (!r) return;

    // Target current buoy gate or nearby golden ring
    let targetX = 0;
    let targetY = 0;

    // Check if golden ring is nearby
    let foundRing = false;
    for (const ring of this.goldenRings) {
      if (ring.active && Math.hypot(ring.x - r.x, ring.y - r.y) < 220) {
        targetX = ring.x;
        targetY = ring.y;
        foundRing = true;
        break;
      }
    }

    if (!foundRing) {
      const buoy = this.buoys[r.nextGateIdx];
      if (buoy) {
        // Offset target slightly to carve around the required buoy flank
        const flankOffset = buoy.targetSide === 'left' ? -22 : 22;
        targetX = buoy.x + Math.sin(r.angle) * flankOffset;
        targetY = buoy.y - Math.cos(r.angle) * flankOffset;
      }
    }

    // Predictive steering calculation
    const dx = targetX - r.x;
    const dy = targetY - r.y;
    const targetAngle = Math.atan2(dy, dx);

    let angleDiff = targetAngle - r.angle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

    let steer = 0;
    if (Math.abs(angleDiff) > 0.08) {
      steer = angleDiff > 0 ? 1 : -1;
    }

    // Hold action to charge turbo boost
    let holdAction = false;

    // Calibrated difficulty behavior
    let delay = 0.23;
    if (difficulty === 'bot_easy') {
      delay = 0.40;
      if (Math.random() < 0.22) steer = -steer; // 22% blunder
      if (Math.random() < 0.4 && r.chargeTime < 0.6) holdAction = true;
    } else if (difficulty === 'bot_normal') {
      delay = 0.23;
      // Normal bot uses turbo on straights and releases near sweet spot
      if (Math.abs(angleDiff) < 0.4) {
        if (r.chargeTime < 0.85) {
          holdAction = true;
        } else {
          holdAction = false; // Release for sweet spot!
        }
      }
    } else {
      // Hard Bot: 90-130ms reaction, sweet spot timing, aggressive bumper shunts
      delay = 0.11;

      // Hard bot hunts sweet spot: charges to 0.85s then releases
      if (Math.abs(angleDiff) < 0.35 && r.chargeTime < 0.88) {
        holdAction = true;
      } else if (r.chargeTime >= 0.85) {
        holdAction = false; // Perfect sweet-spot release
      }

      // Check if a rival is right ahead to execute a Bumper Shunt
      for (const other of this.racers.values()) {
        if (other.id === botId) continue;
        const dOther = Math.hypot(other.x - r.x, other.y - r.y);
        if (dOther < 95 && Math.abs(angleDiff) < 0.3) {
          holdAction = false; // Unleash blast to shunt them!
        }
      }
    }

    this.input.setBotInput(botId, holdAction, steer, 1, false);
    this.botReactionTimers.set(botId, delay);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const active = this.getActivePlayers();
    const theme = THEMES[this.currentThemeIdx];

    // 1. Water Surface Gradient & Procedural Waves
    const seaGrad = ctx.createLinearGradient(0, 0, 0, height);
    seaGrad.addColorStop(0, theme.waterDeep);
    seaGrad.addColorStop(1, theme.waterShallow);
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, 0, width, height);

    // Procedural wave mesh caustics
    ctx.strokeStyle = theme.waveFoam;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.18;
    for (let wy = 50; wy < height - 30; wy += 38) {
      ctx.beginPath();
      for (let wx = 0; wx < width; wx += 24) {
        const waveOffset = Math.sin((wx * 0.02) + (wy * 0.015) + this.waveTime) * 6;
        if (wx === 0) ctx.moveTo(wx, wy + waveOffset);
        else ctx.lineTo(wx, wy + waveOffset);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // 2. Slalom Track Course Guidelines
    ctx.strokeStyle = theme.trackLine;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    if (this.buoys.length > 0) {
      ctx.moveTo(this.buoys[0].x, this.buoys[0].y);
      for (let i = 1; i < this.buoys.length; i++) {
        ctx.lineTo(this.buoys[i].x, this.buoys[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 3. Golden Speed Rings
    for (const ring of this.goldenRings) {
      if (!ring.active) continue;
      const pulse = Math.sin(ring.pulseTimer) * 4;
      const drawR = ring.radius + pulse;

      ctx.save();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, drawR, 0, Math.PI * 2);
      ctx.stroke();

      // Inner glowing star/spokes
      ctx.fillStyle = 'rgba(255, 215, 0, 0.25)';
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, drawR - 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('+50 BOOST', ring.x, ring.y + 4);
      ctx.restore();
    }

    // 4. Slalom Buoys (with 2.5D shadow, bobbing flag, and bells)
    for (const b of this.buoys) {
      const bobY = b.y + Math.sin(this.waveTime + b.bobPhase) * 3;
      const isPort = b.targetSide === 'left';
      const buoyColor = isPort ? theme.buoyPort : theme.buoyStarboard;

      // Water shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(b.x + 4, bobY + 8, b.radius, b.radius * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();

      // Buoy Body (2.5D cylindrical dome)
      const buoyGrad = ctx.createRadialGradient(b.x - 4, bobY - 4, 3, b.x, bobY, b.radius);
      buoyGrad.addColorStop(0, '#FFFFFF');
      buoyGrad.addColorStop(0.3, buoyColor);
      buoyGrad.addColorStop(1, '#1A1A1A');
      ctx.fillStyle = buoyGrad;
      ctx.beginPath();
      ctx.arc(b.x, bobY, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Slalom Indicator Arrow / Flag
      ctx.fillStyle = buoyColor;
      ctx.beginPath();
      ctx.arc(b.x, bobY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Guide text: "L" or "R"
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isPort ? 'PORT' : 'STBD', b.x, bobY + 3);
    }

    // 5. Render Jet-Ski Racers & Mascot Captains
    for (const [id, r] of this.racers.entries()) {
      const p = this.players.find(pl => pl.id === id);
      const color = p ? p.color : '#00E5FF';

      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.angle);

      // Jet-ski water shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.beginPath();
      ctx.ellipse(3, 4, 22, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Jet-blast flame / roostertails
      if (r.isBoosting) {
        ctx.fillStyle = '#00E5FF';
        ctx.beginPath();
        ctx.moveTo(-16, -6);
        ctx.lineTo(-32 - Math.random() * 12, 0);
        ctx.lineTo(-16, 6);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(-16, -3);
        ctx.lineTo(-24, 0);
        ctx.lineTo(-16, 3);
        ctx.closePath();
        ctx.fill();
      }

      // Jet-Ski Sleek 2.5D Hull
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(22, 0);       // Sharp pointed bow
      ctx.lineTo(8, -13);      // Front starboard sponson
      ctx.lineTo(-16, -11);    // Stern starboard
      ctx.lineTo(-20, 0);      // Engine transom
      ctx.lineTo(-16, 11);     // Stern port
      ctx.lineTo(8, 13);       // Front port sponson
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Sponson Trim & Decals
      ctx.fillStyle = '#212121';
      ctx.fillRect(-12, -7, 18, 14);

      // Handlebars & Windshield
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.moveTo(10, -5);
      ctx.lineTo(13, 0);
      ctx.lineTo(10, 5);
      ctx.closePath();
      ctx.fill();

      // Mascot Rider sitting on the seat
      ctx.save();
      ctx.translate(0, 0);
      ctx.rotate(Math.PI / 2); // Rotate character facing forward
      const isBot = p ? p.type !== 'human' : false;
      drawCharacter(ctx, 0, 0, 14, id, isBot, r.mood, r.animTimer, undefined);
      ctx.restore();

      // Underdog Golden Hydrofoil Aura
      if (r.isUnderdog) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, r.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Charge Ring Visual
      if (r.isCharging) {
        const ratio = r.chargeTime / 1.0;
        const sweetMin = r.isUnderdog ? 0.50 : 0.72;
        const sweetMax = r.isUnderdog ? 1.00 : 0.98;
        const isSweet = ratio >= sweetMin && ratio <= sweetMax;

        ctx.strokeStyle = isSweet ? '#00E5FF' : (ratio > sweetMax ? '#FF1744' : '#FFD700');
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, r.radius + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ratio));
        ctx.stroke();
      }

      ctx.restore();

      // Floating Score & Lap Tag above racer
      ctx.fillStyle = color;
      ctx.font = 'bold 13px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${r.score} pts (L${r.laps})`, r.x, r.y - 24);

      // Status indicator: "DRAFTING", "TURBO", "SPIN!"
      if (r.isBoosting) {
        ctx.fillStyle = '#00E5FF';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText('⚡ HYDRO-TURBO!', r.x, r.y - 38);
      } else if (r.isDrafting) {
        ctx.fillStyle = '#76FF03';
        ctx.font = 'bold 10px Montserrat, sans-serif';
        ctx.fillText('💨 SLIPSTREAM', r.x, r.y - 38);
      } else if (r.spinoutTimer > 0) {
        ctx.fillStyle = '#FF5252';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText('💥 SPINOUT!', r.x, r.y - 38);
      }
    }

    // 6. UI Overlays (Strict Top-Center Timer Safe Zone & Minigame Badge)
    // Global safe zone for timer: y: 12-44, width 160 centered.
    // Minigame Header Badge at y: 56, h: 28
    ctx.save();
    const badgeW = 260;
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
    ctx.fillText('WATER SCOOTER • SLALOM SPRINT', width / 2, badgeY + 18);
    ctx.restore();

    // 7. Bottom-Left Theme Pill: x: 20, y: height - 44, w: 170, h: 32
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

    // 8. Player Corner Cards (Safe offset y: height - 128, w: 130, h: 48)
    const cardY = height - 128;
    active.forEach((p, idx) => {
      const r = this.racers.get(p.id);
      if (!r) return;

      const cardX = 20 + idx * 142;
      if (cardX + 130 > width) return; // Prevent horizontal screen overflow

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
      ctx.fillText(`Lap ${r.laps + 1}`, cardX + 122, cardY + 38);
      ctx.restore();
    });
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const r = this.racers.get(p.id);
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
        ? `Player ${typeof winnerId === 'number' ? winnerId + 1 : winnerId} dominated the water slalom with lightning-fast carving!`
        : 'All water scooters stalled in the waves!'
    };
  }
}
