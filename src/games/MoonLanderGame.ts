import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface LandingPad {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  multiplier: number;
  occupiedBy: PlayerId | null;
  beaconTimer: number;
}

interface HeliumCanister {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  points: number;
  isJackpot: boolean;
}

interface LunarLander {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  fuel: number;
  score: number;
  consecutiveLandings: number;

  // Hold-to-Charge Retro-Thruster
  isCharging: boolean;
  chargeTime: number; // 0 to 1.2s
  isCushionActive: boolean;
  cushionTimer: number;
  isStalled: boolean;
  stallTimer: number;

  // Landing & crash states
  landedPadId: number | null;
  landedTimer: number;
  crashedTimer: number;
  shuntCooldown: number;
  isUnderdog: boolean;

  // Mascot emotion & animation
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
}

interface MoonTheme {
  id: string;
  name: string;
  icon: string;
  skyDark: string;
  skyLight: string;
  celestialBodyColor: string;
  celestialName: string;
  surfaceColor: string;
  craterColor: string;
  padColor: string;
  accentColor: string;
}

const THEMES: MoonTheme[] = [
  {
    id: 'apollo_tranquility',
    name: 'Apollo Tranquility 🌕',
    icon: '🌕',
    skyDark: '#010206',
    skyLight: '#090D1A',
    celestialBodyColor: '#1E88E5',
    celestialName: 'EARTH',
    surfaceColor: '#37474F',
    craterColor: '#263238',
    padColor: '#00E5FF',
    accentColor: '#00E5FF'
  },
  {
    id: 'mars_olympus',
    name: 'Mars Olympus Caldera 🔴',
    icon: '🔴',
    skyDark: '#120402',
    skyLight: '#260B05',
    celestialBodyColor: '#D84315',
    celestialName: 'PHOBOS',
    surfaceColor: '#8D2B0B',
    craterColor: '#5C1D07',
    padColor: '#FFB300',
    accentColor: '#FF5722'
  },
  {
    id: 'europa_rift',
    name: 'Europa Ice Rift ❄️',
    icon: '❄️',
    skyDark: '#010A14',
    skyLight: '#071F36',
    celestialBodyColor: '#F59E0B',
    celestialName: 'JUPITER',
    surfaceColor: '#1F4E6B',
    craterColor: '#0E2E42',
    padColor: '#00E676',
    accentColor: '#00E676'
  }
];

export class MoonLanderGame extends BaseGame {
  public currentMapName: string = 'Apollo Tranquility 🌕';
  private currentThemeIdx: number = 0;

  private landers: Map<PlayerId, LunarLander> = new Map();
  private pads: LandingPad[] = [];
  private canisters: HeliumCanister[] = [];
  private canisterIdCounter: number = 0;
  private spawnCanisterTimer: number = 2.0;

  // Starfield & procedural surface terrain
  private stars: { x: number; y: number; size: number; alpha: number }[] = [];
  private surfacePoints: { x: number; y: number }[] = [];

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
    this.landers.clear();
    this.pads = [];
    this.canisters = [];
    this.stars = [];
    this.surfacePoints = [];
    this.spawnCanisterTimer = 2.0;

    // Starfield
    for (let i = 0; i < 75; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * (height * 0.72),
        size: Math.random() * 2 + 0.6,
        alpha: 0.3 + Math.random() * 0.7
      });
    }

    // 4 Landing Pads with various multipliers & heights
    this.pads = [
      { id: 0, x: width * 0.16, y: height * 0.85, width: 85, height: 12, multiplier: 1, occupiedBy: null, beaconTimer: 0 },
      { id: 1, x: width * 0.38, y: height * 0.88, width: 68, height: 12, multiplier: 2, occupiedBy: null, beaconTimer: 0.5 },
      { id: 2, x: width * 0.62, y: height * 0.86, width: 68, height: 12, multiplier: 2, occupiedBy: null, beaconTimer: 1.0 },
      { id: 3, x: width * 0.84, y: height * 0.82, width: 56, height: 12, multiplier: 3, occupiedBy: null, beaconTimer: 1.5 }
    ];

    // Procedural crater terrain
    const segments = 28;
    for (let i = 0; i <= segments; i++) {
      const px = (i / segments) * width;
      let py = height * 0.87 + Math.sin(i * 1.4) * 22;

      // Level out terrain under pads
      for (const pad of this.pads) {
        if (Math.abs(px - pad.x) < pad.width * 0.75) {
          py = pad.y + pad.height;
        }
      }
      this.surfacePoints.push({ x: px, y: py });
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const startX = width * 0.18 + (idx / Math.max(1, active.length - 1)) * (width * 0.64);
      const startY = 70 + (idx % 2) * 25;

      this.landers.set(p.id, {
        id: p.id,
        x: startX,
        y: startY,
        vx: (Math.random() - 0.5) * 24,
        vy: 15,
        angle: 0,
        radius: 17,
        fuel: 100,
        score: 0,
        consecutiveLandings: 0,

        isCharging: false,
        chargeTime: 0,
        isCushionActive: false,
        cushionTimer: 0,
        isStalled: false,
        stallTimer: 0,

        landedPadId: null,
        landedTimer: 0,
        crashedTimer: 0,
        shuntCooldown: 0,
        isUnderdog: false,

        mood: 'idle',
        moodTimer: 0,
        animTimer: idx * 0.3
      });

      this.botReactionTimers.set(p.id, 0.2);
    });

    // Initial Helium Canisters
    for (let i = 0; i < 4; i++) {
      this.spawnCanister(width, height);
    }
  }

  private spawnCanister(width: number, height: number): void {
    const isJackpot = Math.random() < 0.25;
    this.canisters.push({
      id: ++this.canisterIdCounter,
      x: width * 0.12 + Math.random() * (width * 0.76),
      y: height * 0.25 + Math.random() * (height * 0.45),
      vx: (Math.random() - 0.5) * 35,
      vy: (Math.random() - 0.5) * 20,
      radius: isJackpot ? 14 : 10,
      points: isJackpot ? 50 : 25,
      isJackpot
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update pads beacon timer
    for (const pad of this.pads) {
      pad.beaconTimer += dt * 3.5;
    }

    // Helium Canister Spawner & Drift
    this.spawnCanisterTimer -= dt;
    if (this.spawnCanisterTimer <= 0 && this.canisters.length < 6) {
      this.spawnCanisterTimer = 3.5 + Math.random() * 2.0;
      this.spawnCanister(width, height);
    }

    for (const c of this.canisters) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.x < 30 || c.x > width - 30) c.vx *= -1;
      if (c.y < 60 || c.y > height * 0.75) c.vy *= -1;
    }

    // Determine max score for Underdog
    let maxScore = 0;
    for (const l of this.landers.values()) {
      if (l.score > maxScore) maxScore = l.score;
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();
    const gravity = 88; // Lunar gravitational acceleration

    // 1. Update Landers Flight & State
    for (const p of active) {
      const l = this.landers.get(p.id);
      if (!l) continue;

      l.animTimer += dt;
      if (l.moodTimer > 0) {
        l.moodTimer -= dt;
        if (l.moodTimer <= 0) l.mood = 'idle';
      }

      if (l.shuntCooldown > 0) l.shuntCooldown -= dt;
      if (l.stallTimer > 0) l.stallTimer -= dt;

      // Underdog check: trailing by >= 35 pts
      l.isUnderdog = (maxScore - l.score >= 35);

      // Handle Crashed State (Respawn cycle)
      if (l.crashedTimer > 0) {
        l.crashedTimer -= dt;
        if (l.crashedTimer <= 0) {
          // Respawn at top
          l.x = width * 0.2 + Math.random() * (width * 0.6);
          l.y = 65;
          l.vx = (Math.random() - 0.5) * 30;
          l.vy = 15;
          l.angle = 0;
          l.fuel = 100;
          l.landedPadId = null;
          l.mood = 'idle';
        }
        continue;
      }

      // Handle Landed State (Celebration & Lift-off)
      if (l.landedPadId !== null) {
        l.landedTimer -= dt;
        if (l.landedTimer <= 0) {
          // Launch back into orbit!
          l.landedPadId = null;
          l.vy = -180;
          l.fuel = 100;
          l.mood = 'idle';
          this.audio.playTap();
          this.particles.emit(l.x, l.y + 12, 10, '#00E5FF');
        }
        continue;
      }

      // Controls: Tilt & RCS Thruster
      const steer = this.input.getSteer(l.id);
      const isActionHeld = this.input.isPressed(l.id) || this.input.isActionPressed(l.id);

      // Angular rotation
      if (steer !== 0) {
        const agility = l.isUnderdog ? 4.2 : 3.4;
        l.angle += steer * agility * dt;
      }

      // Hold-to-Charge Retro-Thruster & Cushion
      if (isActionHeld && !l.isStalled && l.fuel > 0) {
        l.isCharging = true;
        const chargeRate = l.isUnderdog ? 1.4 : 1.0;
        l.chargeTime = Math.min(1.2, l.chargeTime + dt * chargeRate);
        l.mood = 'focused';

        // Thruster burn fuel consumption
        l.fuel = Math.max(0, l.fuel - 24 * dt);

        // Constant gentle upward thrust while charging
        const thrustPower = 175;
        l.vx += Math.sin(l.angle) * thrustPower * dt;
        l.vy -= Math.cos(l.angle) * thrustPower * dt;

        // Exhaust flame particles
        if (Math.random() < 0.6) {
          const exX = l.x - Math.sin(l.angle) * 16;
          const exY = l.y + Math.cos(l.angle) * 16;
          this.particles.emit(exX, exY, 2, '#FF9800');
        }

        // Overheat Stall blowoff
        if (l.chargeTime >= 1.2) {
          l.isStalled = true;
          l.stallTimer = 1.0;
          l.chargeTime = 0;
          l.isCharging = false;
          l.mood = 'shocked';
          l.moodTimer = 1.0;
          this.audio.playExplosion();
          this.particles.emit(l.x, l.y, 10, '#ECEFF1');
        }
      } else if (l.isCharging) {
        // Thruster Released -> Fire Anti-Grav Cushion Burst!
        const chargeRatio = l.chargeTime / 1.0;
        l.isCharging = false;
        l.chargeTime = 0;

        const sweetMin = l.isUnderdog ? 0.50 : 0.72;
        const sweetMax = l.isUnderdog ? 1.00 : 0.98;
        const isSweet = chargeRatio >= sweetMin && chargeRatio <= sweetMax;

        if (isSweet) {
          // PERFECT SWEET SPOT: Cushion Slam Activated!
          l.isCushionActive = true;
          l.cushionTimer = 1.6;
          l.vy *= 0.25; // Dampen descent speed safely!
          l.vx *= 0.50;
          l.mood = 'triumph';
          l.moodTimer = 1.2;
          this.audio.playFanfare();
          this.particles.spawnExplosion(l.x, l.y, '#00E5FF', 14);
        } else if (chargeRatio > 0.25) {
          // Mini-burn
          l.vy = Math.max(-120, l.vy - 130 * chargeRatio);
          this.audio.playTap();
          this.particles.emit(l.x, l.y + 14, 4, '#FFB300');
        }
      }

      // Update Cushion Timer
      if (l.isCushionActive) {
        l.cushionTimer -= dt;
        if (l.cushionTimer <= 0) {
          l.isCushionActive = false;
        }
      }

      // Lunar gravity & drag
      const currentGrav = l.isCushionActive ? gravity * 0.35 : gravity;
      l.vy += currentGrav * dt;
      l.vx *= Math.pow(0.99, dt * 60);

      l.x += l.vx * dt;
      l.y += l.vy * dt;

      // Arena horizontal clamp
      const margin = 20;
      if (l.x < margin) { l.x = margin; l.vx = Math.abs(l.vx) * 0.6; this.audio.playBounce(); }
      if (l.x > width - margin) { l.x = width - margin; l.vx = -Math.abs(l.vx) * 0.6; this.audio.playBounce(); }

      // Check Collectible Helium-3 Canisters
      for (let cIdx = this.canisters.length - 1; cIdx >= 0; cIdx--) {
        const c = this.canisters[cIdx];
        if (Math.hypot(l.x - c.x, l.y - c.y) < l.radius + c.radius) {
          l.score += c.points;
          l.fuel = Math.min(100, l.fuel + 35);
          l.mood = 'happy';
          l.moodTimer = 1.0;
          this.audio.playScore();
          this.particles.spawnExplosion(c.x, c.y, c.isJackpot ? '#FFD700' : '#00E5FF', 10);
          this.canisters.splice(cIdx, 1);
        }
      }

      // Check Landing Pad Touchdowns
      let landedOnPad = false;
      for (const pad of this.pads) {
        const padLeft = pad.x - pad.width * 0.5;
        const padRight = pad.x + pad.width * 0.5;

        if (l.x >= padLeft && l.x <= padRight && Math.abs(l.y + 14 - pad.y) < 14) {
          const speed = Math.hypot(l.vx, l.vy);
          const isUpright = Math.abs(l.angle) < 0.45; // within ~25 degrees
          const maxSafeSpeed = l.isCushionActive ? 160 : (l.isUnderdog ? 120 : 85);

          if (speed <= maxSafeSpeed && isUpright) {
            // Soft touchdown!
            landedOnPad = true;
            l.landedPadId = pad.id;
            l.landedTimer = 1.8;
            l.vx = 0;
            l.vy = 0;
            l.y = pad.y - 14;
            l.angle = 0;

            l.consecutiveLandings++;
            const suddenDeathMult = this.roundTimer <= 12.0 ? 2 : 1;
            const streakMult = Math.min(3, l.consecutiveLandings);
            const earnedPts = 60 * pad.multiplier * streakMult * suddenDeathMult;
            l.score += earnedPts;

            l.mood = 'triumph';
            l.moodTimer = 1.8;
            this.audio.playFanfare();
            this.particles.spawnConfetti(l.x, l.y, 18);
          } else {
            // Hard crash on pad!
            this.crashLander(l);
          }
          break;
        }
      }

      // Check Craggy Surface Terrain Collision
      if (!landedOnPad && l.crashedTimer <= 0) {
        const groundY = this.getTerrainHeightAt(l.x, height);
        if (l.y + 14 >= groundY) {
          this.crashLander(l);
        }
      }
    }

    // 2. Physical Elastic Shunting Between Lunar Landers ($m_1 v_1 + m_2 v_2$)
    const landerArray = Array.from(this.landers.values());
    for (let i = 0; i < landerArray.length; i++) {
      for (let j = i + 1; j < landerArray.length; j++) {
        const l1 = landerArray[i];
        const l2 = landerArray[j];
        if (l1.crashedTimer > 0 || l2.crashedTimer > 0) continue;

        const dx = l2.x - l1.x;
        const dy = l2.y - l1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = l1.radius + l2.radius + 4;

        if (dist < minDist && dist > 0.001) {
          // Push apart
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          l1.x -= nx * overlap * 0.5;
          l1.y -= ny * overlap * 0.5;
          l2.x += nx * overlap * 0.5;
          l2.y += ny * overlap * 0.5;

          // Pad Ejection / Ram Sabotage:
          // If l1 is landed or hovering over pad, and l2 slams into them with cushion or high speed
          const l1IsShunter = l1.isCushionActive || Math.hypot(l1.vx, l1.vy) > Math.hypot(l2.vx, l2.vy) + 50;
          const l2IsShunter = l2.isCushionActive || Math.hypot(l2.vx, l2.vy) > Math.hypot(l1.vx, l1.vy) + 50;

          if (l1IsShunter && l1.shuntCooldown <= 0) {
            l1.score += 30; // Shunt Sabotage bonus!
            l1.shuntCooldown = 1.0;
            l2.landedPadId = null;
            l2.mood = 'shocked';
            l2.moodTimer = 1.0;
            l1.mood = 'triumph';
            l1.moodTimer = 1.0;
            this.audio.playExplosion();
            this.particles.spawnExplosion((l1.x + l2.x) * 0.5, (l1.y + l2.y) * 0.5, '#FF5252', 14);
          } else if (l2IsShunter && l2.shuntCooldown <= 0) {
            l2.score += 30;
            l2.shuntCooldown = 1.0;
            l1.landedPadId = null;
            l1.mood = 'shocked';
            l1.moodTimer = 1.0;
            l2.mood = 'triumph';
            l2.moodTimer = 1.0;
            this.audio.playExplosion();
            this.particles.spawnExplosion((l1.x + l2.x) * 0.5, (l1.y + l2.y) * 0.5, '#FF5252', 14);
          } else {
            this.audio.playBounce();
            this.particles.emit((l1.x + l2.x) * 0.5, (l1.y + l2.y) * 0.5, 4, '#FFFFFF');
          }

          // Momentum exchange
          const kx = l1.vx - l2.vx;
          const ky = l1.vy - l2.vy;
          const pImpulse = 2 * (nx * kx + ny * ky) / 2;
          l1.vx -= pImpulse * nx * 0.85;
          l1.vy -= pImpulse * ny * 0.85;
          l2.vx += pImpulse * nx * 0.85;
          l2.vy += pImpulse * ny * 0.85;
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private crashLander(lander: LunarLander): void {
    lander.crashedTimer = 2.0;
    lander.consecutiveLandings = 0;
    lander.mood = 'shocked';
    lander.moodTimer = 1.5;
    this.audio.playExplosion();
    this.particles.spawnExplosion(lander.x, lander.y, '#FF1744', 22);
  }

  private getTerrainHeightAt(x: number, defaultHeight: number): number {
    if (this.surfacePoints.length < 2) return defaultHeight * 0.9;
    for (let i = 0; i < this.surfacePoints.length - 1; i++) {
      const p1 = this.surfacePoints[i];
      const p2 = this.surfacePoints[i + 1];
      if (x >= p1.x && x <= p2.x) {
        const t = (x - p1.x) / (p2.x - p1.x);
        return p1.y + t * (p2.y - p1.y);
      }
    }
    return defaultHeight * 0.9;
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

    const l = this.landers.get(botId);
    if (!l || l.crashedTimer > 0 || l.landedPadId !== null) return;

    // Target highest value pad or nearest pad
    let bestPad = this.pads[0];
    let minScore = 99999;
    for (const pad of this.pads) {
      const dist = Math.abs(l.x - pad.x);
      const score = dist - pad.multiplier * 30;
      if (score < minScore) {
        minScore = score;
        bestPad = pad;
      }
    }

    const dx = bestPad.x - l.x;
    let turn = 0;
    let holdAction = false;

    // Desired horizontal speed towards pad
    const targetVx = Math.max(-55, Math.min(55, dx * 0.8));
    const vxDiff = targetVx - l.vx;

    // Desired angle tilt
    const desiredAngle = Math.max(-0.45, Math.min(0.45, vxDiff * 0.025));
    if (l.angle < desiredAngle - 0.08) turn = 1;
    else if (l.angle > desiredAngle + 0.08) turn = -1;

    // Vertical descent rate management
    const distToPad = bestPad.y - l.y;
    const safeVy = distToPad < 130 ? 45 : 90;

    if (l.vy > safeVy || (distToPad < 70 && l.vy > 25)) {
      if (l.chargeTime < 0.85) {
        holdAction = true;
      } else {
        holdAction = false; // Sweet spot release!
      }
    }

    let delay = 0.24;
    if (difficulty === 'bot_easy') {
      delay = 0.42;
      if (Math.random() < 0.22) turn = -turn;
      if (Math.random() < 0.3) holdAction = false;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11;
      // Hard bot executes sweet spot cushions when approaching touchdown
      if (distToPad < 110 && l.chargeTime >= 0.82) {
        holdAction = false; // Cushion slam touchdown!
      }
    }

    this.input.setBotInput(botId, holdAction, turn, holdAction ? 1 : 0, false);
    this.botReactionTimers.set(botId, delay);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const active = this.getActivePlayers();
    const theme = THEMES[this.currentThemeIdx];

    // 1. Lunar Deep Space Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, theme.skyDark);
    skyGrad.addColorStop(1, theme.skyLight);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Stars
    for (const s of this.stars) {
      ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }

    // 3. Distant Celestial Orb (Earth, Phobos, Jupiter)
    ctx.save();
    const orbX = width * 0.84;
    const orbY = height * 0.18;
    const orbR = 32;

    ctx.fillStyle = theme.celestialBodyColor;
    ctx.beginPath();
    ctx.arc(orbX, orbY, orbR, 0, Math.PI * 2);
    ctx.fill();

    // Atmosphere halo
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(theme.celestialName, orbX, orbY + orbR + 14);
    ctx.restore();

    // 4. Craggy Lunar Surface & Craters
    ctx.fillStyle = theme.surfaceColor;
    ctx.beginPath();
    if (this.surfacePoints.length > 0) {
      ctx.moveTo(this.surfacePoints[0].x, this.surfacePoints[0].y);
      for (let i = 1; i < this.surfacePoints.length; i++) {
        ctx.lineTo(this.surfacePoints[i].x, this.surfacePoints[i].y);
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();
    }

    // Crater shading
    ctx.fillStyle = theme.craterColor;
    ctx.beginPath();
    ctx.ellipse(width * 0.28, height * 0.92, 42, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(width * 0.72, height * 0.94, 55, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // 5. Landing Pads (2.5D Hi-Tech Scientific Platforms)
    for (const pad of this.pads) {
      const padLeft = pad.x - pad.width * 0.5;

      // Platform base shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(padLeft + 4, pad.y + 6, pad.width, pad.height);

      // Pad structural frame
      ctx.fillStyle = '#263238';
      ctx.fillRect(padLeft, pad.y, pad.width, pad.height);

      ctx.strokeStyle = pad.multiplier >= 3 ? '#FFD700' : theme.padColor;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(padLeft, pad.y, pad.width, pad.height);

      // Flashing corner beacon lights
      const beaconAlpha = 0.4 + Math.sin(pad.beaconTimer) * 0.5;
      ctx.fillStyle = `rgba(0, 229, 255, ${beaconAlpha})`;
      ctx.beginPath();
      ctx.arc(padLeft + 6, pad.y + 6, 3.5, 0, Math.PI * 2);
      ctx.arc(padLeft + pad.width - 6, pad.y + 6, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Multiplier Label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${pad.multiplier}x PAD`, pad.x, pad.y + 9);
    }

    // 6. Floating Helium-3 Canisters
    for (const c of this.canisters) {
      ctx.save();
      ctx.translate(c.x, c.y);

      // Glow halo
      ctx.shadowColor = c.isJackpot ? '#FFD700' : '#00E5FF';
      ctx.shadowBlur = 12;

      ctx.fillStyle = c.isJackpot ? '#FFD700' : '#00E5FF';
      ctx.beginPath();
      ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 9px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.isJackpot ? 'HE-3+' : 'HE-3', 0, 3);
      ctx.restore();
    }

    // 7. Render Lunar Excursion Modules & Mascot Astronauts
    for (const [id, l] of this.landers.entries()) {
      if (l.crashedTimer > 0) continue;

      const p = this.players.find(pl => pl.id === id);
      const color = p ? p.color : '#00E5FF';
      const isBot = p ? p.type !== 'human' : false;

      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.angle);

      // Lunar shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(2, 6, l.radius + 3, l.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Descent Stage: Gold foil octagonal base
      ctx.fillStyle = '#FFB300';
      ctx.fillRect(-12, 2, 24, 8);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-12, 2, 24, 8);

      // Landing Gear Struts & Footpads
      ctx.strokeStyle = '#ECEFF1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Left leg
      ctx.moveTo(-10, 6);
      ctx.lineTo(-16, 16);
      ctx.lineTo(-19, 16);
      // Right leg
      ctx.moveTo(10, 6);
      ctx.lineTo(16, 16);
      ctx.lineTo(19, 16);
      ctx.stroke();

      // Ascent Stage Capsule Body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, -3, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Mascot Pilot in Helmet Inside Visor
      ctx.save();
      drawCharacter(ctx, 0, -3, 11, id, isBot, l.mood, l.animTimer, undefined);
      ctx.restore();

      // Underdog Magnetic Field Aura
      if (l.isUnderdog) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, l.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Anti-Grav Cushion Blue Shockwave
      if (l.isCushionActive) {
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 6, l.radius + 12, 0, Math.PI);
        ctx.stroke();
      }

      // Hold-to-Charge Thruster Gauge
      if (l.isCharging) {
        const ratio = l.chargeTime / 1.0;
        const sweetMin = l.isUnderdog ? 0.50 : 0.72;
        const sweetMax = l.isUnderdog ? 1.00 : 0.98;
        const isSweet = ratio >= sweetMin && ratio <= sweetMax;

        ctx.strokeStyle = isSweet ? '#00E5FF' : (ratio > sweetMax ? '#FF1744' : '#FFD700');
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, l.radius + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ratio));
        ctx.stroke();
      }

      ctx.restore();

      // Floating Score & Fuel Bar above lander
      ctx.fillStyle = color;
      ctx.font = 'bold 13px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${l.score} pts`, l.x, l.y - 28);

      // Fuel bar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(l.x - 18, l.y - 24, 36, 4);
      ctx.fillStyle = l.fuel > 25 ? '#00E676' : '#FF1744';
      ctx.fillRect(l.x - 18, l.y - 24, (l.fuel / 100) * 36, 4);

      if (l.landedPadId !== null) {
        ctx.fillStyle = '#00E676';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText('TOUCHDOWN!', l.x, l.y - 38);
      } else if (l.isCushionActive) {
        ctx.fillStyle = '#00E5FF';
        ctx.font = 'bold 10px Montserrat, sans-serif';
        ctx.fillText('⚡ CUSHION ACTIVE', l.x, l.y - 38);
      }
    }

    // 8. Strict UI Overlays (Top-Center Safe Zone & Header Badge)
    // Global safe zone for timer: y: 12-44, width 160 centered.
    // Minigame Header Badge at y: 56, h: 28
    ctx.save();
    const badgeW = 270;
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
    ctx.fillText('MOON LANDER • CRATER TOUCHDOWN', width / 2, badgeY + 18);
    ctx.restore();

    // 9. Bottom-Left Theme Pill: x: 20, y: height - 44, w: 170, h: 32
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

    // 10. Player Corner Cards (Safe offset y: height - 128, w: 130, h: 48)
    const cardY = height - 128;
    active.forEach((p, idx) => {
      const l = this.landers.get(p.id);
      if (!l) return;

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
      ctx.fillText(`${l.score} pts`, cardX + 8, cardY + 38);

      ctx.fillStyle = '#B0BEC5';
      ctx.font = '10px Montserrat, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(l.fuel)}% FUEL`, cardX + 122, cardY + 38);
      ctx.restore();
    });
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const l = this.landers.get(p.id);
      return {
        playerId: p.id,
        score: l ? l.score : 0
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
        ? `Player ${typeof winnerId === 'number' ? winnerId + 1 : winnerId} landed on the moon with pinpoint astronaut finesse!`
        : 'All lunar modules ran out of rocket fuel!'
    };
  }
}
