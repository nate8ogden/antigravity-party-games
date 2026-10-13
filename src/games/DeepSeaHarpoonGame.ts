import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface DiverPod {
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

  // Harpoon mechanic
  isCharging: boolean;
  chargeTime: number; // 0 to 1.2s
  isBlownPressure: boolean;
  blownTimer: number;

  // Active harpoon spear & cable
  hasHarpoonOut: boolean;
  harpoonX: number;
  harpoonY: number;
  harpoonVx: number;
  harpoonVy: number;
  harpoonState: 'flying' | 'retracting' | 'idle';
  isSweetSpotShot: boolean;
  reeledCreatureId: number | null;
  reeledPoints: number;

  // Collision & status
  shuntCooldown: number;
  spinoutTimer: number;
  isUnderdog: boolean;

  // Mascot emotion
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
}

interface DeepSeaCreature {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseY: number;
  bobPhase: number;
  radius: number;
  type: 'angler' | 'neon_squid' | 'golden_nautilus' | 'abyssal_shark';
  points: number;
  color: string;
  isPredator: boolean;
}

interface HarpoonTheme {
  id: string;
  name: string;
  icon: string;
  abyssDark: string;
  abyssLight: string;
  lightBeamColor: string;
  creatureAngler: string;
  creatureSquid: string;
  creatureGold: string;
  accentColor: string;
}

const THEMES: HarpoonTheme[] = [
  {
    id: 'challenger_deep',
    name: 'Challenger Deep 🌊',
    icon: '🌊',
    abyssDark: '#010814',
    abyssLight: '#051A33',
    lightBeamColor: 'rgba(0, 229, 255, 0.12)',
    creatureAngler: '#00E5FF',
    creatureSquid: '#00E676',
    creatureGold: '#FFD700',
    accentColor: '#00E5FF'
  },
  {
    id: 'bioluminescent_grotto',
    name: 'Bioluminescent Grotto 🌌',
    icon: '🌌',
    abyssDark: '#0A0318',
    abyssLight: '#200C45',
    lightBeamColor: 'rgba(224, 64, 251, 0.12)',
    creatureAngler: '#E040FB',
    creatureSquid: '#7C4DFF',
    creatureGold: '#FFEA00',
    accentColor: '#E040FB'
  },
  {
    id: 'volcanic_rift',
    name: 'Subsea Volcanic Rift 🌋',
    icon: '🌋',
    abyssDark: '#140500',
    abyssLight: '#381200',
    lightBeamColor: 'rgba(255, 109, 0, 0.12)',
    creatureAngler: '#FF5722',
    creatureSquid: '#FF9100',
    creatureGold: '#FFD600',
    accentColor: '#FF6D00'
  }
];

export class DeepSeaHarpoonGame extends BaseGame {
  public currentMapName: string = 'Challenger Deep 🌊';
  private currentThemeIdx: number = 0;

  private pods: Map<PlayerId, DiverPod> = new Map();
  private creatures: DeepSeaCreature[] = [];
  private creatureIdCounter: number = 0;
  private spawnCreatureTimer: number = 0.5;

  // Marine snow ambient particles
  private marineSnow: { x: number; y: number; speed: number; size: number }[] = [];

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
    this.pods.clear();
    this.creatures = [];
    this.spawnCreatureTimer = 0.5;

    // Initialize marine snow
    this.marineSnow = [];
    for (let i = 0; i < 45; i++) {
      this.marineSnow.push({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 15 + Math.random() * 25,
        size: 1 + Math.random() * 2
      });
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const startX = width * 0.2 + (idx / Math.max(1, active.length - 1)) * (width * 0.6);
      const startY = height * 0.78;

      this.pods.set(p.id, {
        id: p.id,
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2, // Aiming up into trench
        speed: 0,
        baseMaxSpeed: 215,
        radius: 18,
        score: 0,

        isCharging: false,
        chargeTime: 0,
        isBlownPressure: false,
        blownTimer: 0,

        hasHarpoonOut: false,
        harpoonX: startX,
        harpoonY: startY,
        harpoonVx: 0,
        harpoonVy: 0,
        harpoonState: 'idle',
        isSweetSpotShot: false,
        reeledCreatureId: null,
        reeledPoints: 0,

        shuntCooldown: 0,
        spinoutTimer: 0,
        isUnderdog: false,

        mood: 'idle',
        moodTimer: 0,
        animTimer: idx * 0.35
      });

      this.botReactionTimers.set(p.id, 0.2);
    });

    // Initial fauna
    for (let i = 0; i < 6; i++) {
      this.spawnCreature(width, height, true);
    }
  }

  private spawnCreature(width: number, height: number, initial: boolean = false): void {
    const roll = Math.random();
    const isGold = roll < 0.16;
    const isSquid = !isGold && roll < 0.55;
    const isPredator = !isGold && !isSquid && roll < 0.78; // Abyssal shark hazard

    const dir = Math.random() < 0.5 ? 1 : -1;
    const theme = THEMES[this.currentThemeIdx];

    let cType: DeepSeaCreature['type'] = 'angler';
    let pts = 15;
    let col = theme.creatureAngler;
    let rad = 13;
    let speed = 70 + Math.random() * 50;

    if (isGold) {
      cType = 'golden_nautilus';
      pts = 60;
      col = theme.creatureGold;
      rad = 18;
      speed = 100 + Math.random() * 40;
    } else if (isSquid) {
      cType = 'neon_squid';
      pts = 30;
      col = theme.creatureSquid;
      rad = 15;
      speed = 85 + Math.random() * 45;
    } else if (isPredator) {
      cType = 'abyssal_shark';
      pts = -20;
      col = '#E53935';
      rad = 22;
      speed = 95 + Math.random() * 60;
    }

    const y = height * (0.16 + Math.random() * 0.48);
    const startX = initial ? Math.random() * width : (dir === 1 ? -40 : width + 40);

    this.creatures.push({
      id: ++this.creatureIdCounter,
      x: startX,
      y: y,
      baseY: y,
      bobPhase: Math.random() * Math.PI * 2,
      vx: dir * speed,
      vy: 0,
      radius: rad,
      type: cType,
      points: pts,
      color: col,
      isPredator: isPredator
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update marine snow
    for (const snow of this.marineSnow) {
      snow.y += snow.speed * dt;
      snow.x += Math.sin(snow.y * 0.02) * 8 * dt;
      if (snow.y > height) {
        snow.y = 0;
        snow.x = Math.random() * width;
      }
    }

    // Creature spawner
    this.spawnCreatureTimer -= dt;
    if (this.spawnCreatureTimer <= 0 && this.creatures.length < 9) {
      this.spawnCreatureTimer = 1.0 + Math.random() * 0.9;
      this.spawnCreature(width, height);
    }

    // Determine max score for Underdog
    let maxScore = 0;
    for (const p of this.pods.values()) {
      if (p.score > maxScore) maxScore = p.score;
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();

    // 1. Update Diver Pods & Harpoon Actions
    for (const p of active) {
      const pod = this.pods.get(p.id);
      if (!pod) continue;

      pod.animTimer += dt;
      if (pod.moodTimer > 0) {
        pod.moodTimer -= dt;
        if (pod.moodTimer <= 0) pod.mood = 'idle';
      }

      if (pod.shuntCooldown > 0) pod.shuntCooldown -= dt;
      if (pod.blownTimer > 0) pod.blownTimer -= dt;

      // Underdog check: trailing by >= 30 pts
      pod.isUnderdog = (maxScore - pod.score >= 30);

      // Spinout penalty
      if (pod.spinoutTimer > 0) {
        pod.spinoutTimer -= dt;
        pod.angle += 12 * dt;
        pod.x += pod.vx * dt;
        pod.y += pod.vy * dt;
        pod.vx *= 0.92;
        pod.vy *= 0.92;
        continue;
      }

      const steer = this.input.getSteer(pod.id);
      const isActionHeld = this.input.isPressed(pod.id);

      // Directional turning
      if (steer !== 0) {
        pod.angle += steer * 4.2 * dt;
      }

      // Harpoon charging & firing mechanic
      if (pod.harpoonState === 'idle') {
        if (isActionHeld && !pod.isBlownPressure) {
          pod.isCharging = true;
          const chargeRate = pod.isUnderdog ? 1.4 : 1.0;
          pod.chargeTime = Math.min(1.2, pod.chargeTime + dt * chargeRate);
          pod.mood = 'focused';

          // Overcharge pressure valve blowoff
          if (pod.chargeTime >= 1.2) {
            pod.isBlownPressure = true;
            pod.blownTimer = 1.2;
            pod.chargeTime = 0;
            pod.isCharging = false;
            pod.mood = 'shocked';
            pod.moodTimer = 1.0;
            this.audio.playExplosion();
            this.particles.emit(pod.x, pod.y, 8, '#B0BEC5'); // Vent bubbles
          }
        } else if (pod.isCharging) {
          // Release Harpoon Spear!
          const chargeRatio = pod.chargeTime / 1.0;
          pod.isCharging = false;
          pod.chargeTime = 0;

          // Sweet spot: 72% to 98% (50% to 100% for Underdog)
          const sweetMin = pod.isUnderdog ? 0.50 : 0.72;
          const sweetMax = pod.isUnderdog ? 1.00 : 0.98;
          const isSweet = chargeRatio >= sweetMin && chargeRatio <= sweetMax;

          pod.hasHarpoonOut = true;
          pod.harpoonState = 'flying';
          pod.isSweetSpotShot = isSweet;
          pod.harpoonX = pod.x + Math.cos(pod.angle) * 22;
          pod.harpoonY = pod.y + Math.sin(pod.angle) * 22;

          const spearSpeed = isSweet ? 780 : (460 + chargeRatio * 200);
          pod.harpoonVx = Math.cos(pod.angle) * spearSpeed;
          pod.harpoonVy = Math.sin(pod.angle) * spearSpeed;

          if (isSweet) {
            this.audio.playFanfare();
            this.particles.spawnExplosion(pod.harpoonX, pod.harpoonY, '#00E5FF', 10);
          } else {
            this.audio.playTap();
            this.particles.emit(pod.harpoonX, pod.harpoonY, 4, '#80DEEA');
          }
        }
      }

      // Base submarine swimming thrust
      let maxSpeed = pod.baseMaxSpeed;
      if (pod.isUnderdog) maxSpeed *= 1.25;
      if (pod.harpoonState === 'retracting') maxSpeed *= 0.65; // Heavier drag when reeling

      // Throttle input or gentle forward cruise
      const throttle = this.input.getThrottle(pod.id);
      if (throttle > 0) {
        pod.speed = Math.min(maxSpeed, pod.speed + 240 * dt);
      } else {
        // Natural gentle water damping
        pod.speed = Math.max(0, pod.speed - 110 * dt);
      }

      pod.vx = Math.cos(pod.angle) * pod.speed;
      pod.vy = Math.sin(pod.angle) * pod.speed;

      pod.x += pod.vx * dt;
      pod.y += pod.vy * dt;

      // Arena bounds
      const margin = 24;
      if (pod.x < margin) { pod.x = margin; pod.angle = Math.PI - pod.angle; this.audio.playBounce(); }
      if (pod.x > width - margin) { pod.x = width - margin; pod.angle = Math.PI - pod.angle; this.audio.playBounce(); }
      if (pod.y < margin + 44) { pod.y = margin + 44; pod.angle = -pod.angle; this.audio.playBounce(); }
      if (pod.y > height - margin) { pod.y = height - margin; pod.angle = -pod.angle; this.audio.playBounce(); }

      // Update Flying / Retracting Harpoon Spear
      if (pod.harpoonState === 'flying') {
        pod.harpoonX += pod.harpoonVx * dt;
        pod.harpoonY += pod.harpoonVy * dt;

        // Check max cable range or screen edge
        const cableDist = Math.hypot(pod.harpoonX - pod.x, pod.harpoonY - pod.y);
        const maxRange = pod.isSweetSpotShot ? 480 : 380;

        if (cableDist > maxRange || pod.harpoonX < 0 || pod.harpoonX > width || pod.harpoonY < 0 || pod.harpoonY > height) {
          // Missed -> retract empty
          pod.harpoonState = 'retracting';
        }

        // Check collision with sea creatures
        for (let cIdx = this.creatures.length - 1; cIdx >= 0; cIdx--) {
          const c = this.creatures[cIdx];
          const dist = Math.hypot(pod.harpoonX - c.x, pod.harpoonY - c.y);

          if (dist < c.radius + 10) {
            // Harpoon struck creature!
            if (c.isPredator) {
              // Hit Abyssal Shark: hazardous shock!
              pod.score = Math.max(0, pod.score - 20);
              pod.spinoutTimer = 1.0;
              pod.mood = 'shocked';
              pod.moodTimer = 1.2;
              pod.harpoonState = 'idle';
              pod.hasHarpoonOut = false;
              this.audio.playExplosion();
              this.particles.spawnExplosion(c.x, c.y, '#FF1744', 16);
            } else {
              // Speared prize creature!
              pod.reeledCreatureId = c.id;
              const suddenDeathMult = this.roundTimer <= 12.0 ? 2 : 1;
              const sweetBonus = pod.isSweetSpotShot ? 20 : 0;
              pod.reeledPoints = (c.points + sweetBonus) * suddenDeathMult;
              pod.harpoonState = 'retracting';
              this.audio.playScore();
              this.particles.spawnExplosion(c.x, c.y, c.color, 12);
              this.creatures.splice(cIdx, 1);
            }
            break;
          }
        }
      } else if (pod.harpoonState === 'retracting') {
        // High-tension winch retracts spear back to diver pod
        const dx = pod.x - pod.harpoonX;
        const dy = pod.y - pod.harpoonY;
        const dist = Math.hypot(dx, dy);

        const reelSpeed = (pod.isSweetSpotShot ? 650 : 420);
        if (dist > 15) {
          pod.harpoonX += (dx / dist) * reelSpeed * dt;
          pod.harpoonY += (dy / dist) * reelSpeed * dt;
        } else {
          // Spear successfully banked into diver pod!
          pod.harpoonState = 'idle';
          pod.hasHarpoonOut = false;

          if (pod.reeledCreatureId !== null) {
            pod.score += pod.reeledPoints;
            pod.mood = 'triumph';
            pod.moodTimer = 1.4;
            this.audio.playFanfare();
            this.particles.spawnConfetti(pod.x, pod.y, 16);
            pod.reeledCreatureId = null;
            pod.reeledPoints = 0;
          }
        }
      }
    }

    // 2. Update Sea Creatures Movement & Bobbing
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      c.x += c.vx * dt;
      c.y = c.baseY + Math.sin(c.bobPhase + this.roundTimer * 2.5) * 14;

      if ((c.vx > 0 && c.x > width + 50) || (c.vx < 0 && c.x < -50)) {
        this.creatures.splice(i, 1);
      }
    }

    // 3. Physical Elastic Shunting & Harpoon Cable Hijacking
    const podArray = Array.from(this.pods.values());
    for (let i = 0; i < podArray.length; i++) {
      for (let j = i + 1; j < podArray.length; j++) {
        const p1 = podArray[i];
        const p2 = podArray[j];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = p1.radius + p2.radius + 6;

        if (dist < minDist && dist > 0.001) {
          // Push apart
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          p1.x -= nx * overlap * 0.5;
          p1.y -= ny * overlap * 0.5;
          p2.x += nx * overlap * 0.5;
          p2.y += ny * overlap * 0.5;

          // Harpoon Cable Hijack Sabotage:
          // If p1 rams p2 while p2 is reeling a creature, p1 snaps p2's cable and steals it!
          if (p2.harpoonState === 'retracting' && p2.reeledCreatureId !== null && p1.shuntCooldown <= 0) {
            p1.score += p2.reeledPoints + 30; // +30 pt Hijack Bonus!
            p1.shuntCooldown = 1.0;
            p2.reeledCreatureId = null;
            p2.reeledPoints = 0;
            p2.harpoonState = 'idle';
            p2.hasHarpoonOut = false;
            p2.spinoutTimer = 0.8;
            p2.mood = 'shocked';
            p2.moodTimer = 1.2;
            p1.mood = 'triumph';
            p1.moodTimer = 1.2;
            this.audio.playExplosion();
            this.particles.spawnExplosion((p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5, '#FFD700', 18);
          } else if (p1.harpoonState === 'retracting' && p1.reeledCreatureId !== null && p2.shuntCooldown <= 0) {
            p2.score += p1.reeledPoints + 30; // +30 pt Hijack Bonus!
            p2.shuntCooldown = 1.0;
            p1.reeledCreatureId = null;
            p1.reeledPoints = 0;
            p1.harpoonState = 'idle';
            p1.hasHarpoonOut = false;
            p1.spinoutTimer = 0.8;
            p1.mood = 'shocked';
            p1.moodTimer = 1.2;
            p2.mood = 'triumph';
            p2.moodTimer = 1.2;
            this.audio.playExplosion();
            this.particles.spawnExplosion((p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5, '#FFD700', 18);
          } else {
            // Elastic bumper bounce
            this.audio.playBounce();
            this.particles.emit((p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5, 4, '#FFFFFF');
          }

          // Elastic impulse
          const kx = p1.vx - p2.vx;
          const ky = p1.vy - p2.vy;
          const p = 2 * (nx * kx + ny * ky) / 2;
          p1.vx -= p * nx * 0.85;
          p1.vy -= p * ny * 0.85;
          p2.vx += p * nx * 0.85;
          p2.vy += p * ny * 0.85;
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

    const pod = this.pods.get(botId);
    if (!pod) return;

    // Find best target creature (prioritizing golden nautilus or neon squid, avoiding shark)
    let bestTarget: DeepSeaCreature | null = null;
    let bestScore = -999;

    for (const c of this.creatures) {
      if (c.isPredator) continue; // Avoid sharks
      const dist = Math.hypot(c.x - pod.x, c.y - pod.y);
      const score = (c.points * 3.5) - dist * 0.4;
      if (score > bestScore) {
        bestScore = score;
        bestTarget = c;
      }
    }

    let steer = 0;
    let holdAction = false;
    let throttle = 1;

    if (bestTarget) {
      // Calculate lead aim position
      const leadTime = Math.hypot(bestTarget.x - pod.x, bestTarget.y - pod.y) / 600;
      const aimX = bestTarget.x + bestTarget.vx * leadTime;
      const aimY = bestTarget.y;

      const dx = aimX - pod.x;
      const dy = aimY - pod.y;
      const targetAngle = Math.atan2(dy, dx);

      let angleDiff = targetAngle - pod.angle;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

      if (Math.abs(angleDiff) > 0.08) {
        steer = angleDiff > 0 ? 1 : -1;
      }

      // Harpoon charging heuristic
      if (pod.harpoonState === 'idle') {
        if (Math.abs(angleDiff) < 0.35) {
          // In cone: charge harpoon
          if (pod.chargeTime < 0.85) {
            holdAction = true;
          } else {
            holdAction = false; // Sweet spot release!
          }
        }
      }
    }

    let delay = 0.24;
    if (difficulty === 'bot_easy') {
      delay = 0.42;
      if (Math.random() < 0.22) steer = -steer; // 22% blunder
      if (Math.random() < 0.3) holdAction = false;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11;
      // Hard bot hunts for cable-snapping shunts against rivals reeling items
      for (const other of this.pods.values()) {
        if (other.id === botId) continue;
        if (other.harpoonState === 'retracting' && other.reeledCreatureId !== null) {
          const dRival = Math.hypot(other.x - pod.x, other.y - pod.y);
          if (dRival < 180) {
            // Steer aggressively directly into rival to steal creature!
            const dxR = other.x - pod.x;
            const dyR = other.y - pod.y;
            const ramAngle = Math.atan2(dyR, dxR);
            let diffR = ramAngle - pod.angle;
            while (diffR < -Math.PI) diffR += Math.PI * 2;
            while (diffR > Math.PI) diffR -= Math.PI * 2;
            steer = diffR > 0 ? 1 : -1;
            holdAction = false;
            break;
          }
        }
      }
    }

    this.input.setBotInput(botId, holdAction, steer, throttle, false);
    this.botReactionTimers.set(botId, delay);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const active = this.getActivePlayers();
    const theme = THEMES[this.currentThemeIdx];

    // 1. Deep Oceanic Abyss Background Gradient
    const abyssGrad = ctx.createLinearGradient(0, 0, 0, height);
    abyssGrad.addColorStop(0, theme.abyssDark);
    abyssGrad.addColorStop(1, theme.abyssLight);
    ctx.fillStyle = abyssGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Marine Snow Drift Ambient Particles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (const snow of this.marineSnow) {
      ctx.beginPath();
      ctx.arc(snow.x, snow.y, snow.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Flashlight Spotlight Cones from Diver Pods
    for (const pod of this.pods.values()) {
      ctx.save();
      ctx.translate(pod.x, pod.y);
      ctx.rotate(pod.angle);

      // Light beam
      const beamGrad = ctx.createRadialGradient(0, 0, 10, 220, 0, 320);
      beamGrad.addColorStop(0, theme.lightBeamColor);
      beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(340, -90);
      ctx.lineTo(340, 90);
      ctx.lineTo(0, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 4. Render Deep Sea Creatures
    for (const c of this.creatures) {
      ctx.save();
      ctx.translate(c.x, c.y);

      // Bioluminescent Glow Halo
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 14;

      if (c.type === 'abyssal_shark') {
        // Red shark predator
        ctx.fillStyle = c.color;
        ctx.beginPath();
        const dir = c.vx > 0 ? 1 : -1;
        ctx.ellipse(0, 0, c.radius * 1.5, c.radius * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();

        // Dorsal fin & tail
        ctx.beginPath();
        ctx.moveTo(0, -c.radius * 0.6);
        ctx.lineTo(-dir * 8, -c.radius * 1.5);
        ctx.lineTo(-dir * 16, -c.radius * 0.6);
        ctx.closePath();
        ctx.fill();

        // Eye
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(dir * 12, -3, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (c.type === 'golden_nautilus') {
        // Spiraling Golden Shell
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner spiral shell line
        ctx.strokeStyle = '#E65100';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(-2, 0, c.radius * 0.55, 0, Math.PI * 1.5);
        ctx.stroke();
      } else if (c.type === 'neon_squid') {
        // Neon Squid Body + Tentacles
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, c.radius, c.radius * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tentacles waving
        const dir = c.vx > 0 ? 1 : -1;
        ctx.strokeStyle = c.color;
        ctx.lineWidth = 2.5;
        for (let t = -2; t <= 2; t++) {
          ctx.beginPath();
          ctx.moveTo(-dir * c.radius, t * 4);
          ctx.quadraticCurveTo(
            -dir * (c.radius + 12),
            t * 5 + Math.sin(this.roundTimer * 5 + t) * 6,
            -dir * (c.radius + 20),
            t * 6
          );
          ctx.stroke();
        }
      } else {
        // Anglerfish with glowing antenna lantern
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
        ctx.fill();

        // Lantern stalk
        const dir = c.vx > 0 ? 1 : -1;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(dir * 4, -c.radius);
        ctx.quadraticCurveTo(dir * 16, -c.radius - 12, dir * 18, -c.radius - 6);
        ctx.stroke();

        // Glowing bulb
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.arc(dir * 18, -c.radius - 6, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // 5. Render Harpoon Cables & Flying/Retracting Spears
    for (const pod of this.pods.values()) {
      if (pod.hasHarpoonOut) {
        // High-tension cable line connecting pod to spear tip
        ctx.save();
        ctx.strokeStyle = pod.isSweetSpotShot ? '#00E5FF' : 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = pod.isSweetSpotShot ? 2.5 : 1.8;
        ctx.setLineDash(pod.isSweetSpotShot ? [4, 4] : []);
        ctx.beginPath();
        ctx.moveTo(pod.x, pod.y);
        ctx.lineTo(pod.harpoonX, pod.harpoonY);
        ctx.stroke();
        ctx.restore();

        // Barbed Harpoon Trident Tip
        ctx.save();
        ctx.translate(pod.harpoonX, pod.harpoonY);
        const spearAngle = Math.atan2(pod.harpoonVy, pod.harpoonVx);
        ctx.rotate(spearAngle);

        ctx.fillStyle = pod.isSweetSpotShot ? '#00E5FF' : '#ECEFF1';
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(0, -6);
        ctx.lineTo(2, 0);
        ctx.lineTo(0, 6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Reeled creature indicator
        if (pod.reeledCreatureId !== null) {
          ctx.fillStyle = '#FFD700';
          ctx.beginPath();
          ctx.arc(0, 0, 10, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // 6. Render Submersible Diver Pods & Mascot Captains
    for (const [id, pod] of this.pods.entries()) {
      const p = this.players.find(pl => pl.id === id);
      const color = p ? p.color : '#00E5FF';
      const isBot = p ? p.type !== 'human' : false;

      ctx.save();
      ctx.translate(pod.x, pod.y);
      ctx.rotate(pod.angle);

      // Water shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(3, 4, pod.radius + 4, pod.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pod Submersible Hull (2.5D round bathysphere)
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, pod.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Twin Propulsion Thrusters on flanks
      ctx.fillStyle = '#37474F';
      ctx.fillRect(-16, -pod.radius - 3, 10, 6);
      ctx.fillRect(-16, pod.radius - 3, 10, 6);

      // Forward Pneumatic Harpoon Barrel
      ctx.fillStyle = '#263238';
      ctx.fillRect(8, -4, 16, 8);
      ctx.strokeStyle = '#ECEFF1';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(8, -4, 16, 8);

      // Glass Cockpit Bubble with Mascot Inside
      ctx.save();
      ctx.rotate(Math.PI / 2);
      drawCharacter(ctx, 0, 0, 14, id, isBot, pod.mood, pod.animTimer, undefined);
      ctx.restore();

      // Underdog Poseidon Aura
      if (pod.isUnderdog) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, pod.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Hold-to-Charge Pneumatic Winch Gauge
      if (pod.isCharging) {
        const ratio = pod.chargeTime / 1.0;
        const sweetMin = pod.isUnderdog ? 0.50 : 0.72;
        const sweetMax = pod.isUnderdog ? 1.00 : 0.98;
        const isSweet = ratio >= sweetMin && ratio <= sweetMax;

        ctx.strokeStyle = isSweet ? '#00E5FF' : (ratio > sweetMax ? '#FF1744' : '#FFD700');
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, pod.radius + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ratio));
        ctx.stroke();
      }

      ctx.restore();

      // Floating Score & Status above diver pod
      ctx.fillStyle = color;
      ctx.font = 'bold 13px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${pod.score} pts`, pod.x, pod.y - 28);

      if (pod.harpoonState === 'retracting' && pod.reeledCreatureId !== null) {
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText(`+${pod.reeledPoints} REELING!`, pod.x, pod.y - 42);
      } else if (pod.spinoutTimer > 0) {
        ctx.fillStyle = '#FF5252';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText('💥 SHOCK SPIN!', pod.x, pod.y - 42);
      }
    }

    // 7. Strict UI Overlays (Top-Center Safe Zone & Header Badge)
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
    ctx.fillText('DEEP SEA HARPOON • TRENCH HUNT', width / 2, badgeY + 18);
    ctx.restore();

    // 8. Bottom-Left Theme Pill: x: 20, y: height - 44, w: 170, h: 32
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

    // 9. Player Corner Cards (Safe offset y: height - 128, w: 130, h: 48)
    const cardY = height - 128;
    active.forEach((p, idx) => {
      const pod = this.pods.get(p.id);
      if (!pod) return;

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
      ctx.fillText(`${pod.score} pts`, cardX + 8, cardY + 38);

      ctx.fillStyle = '#B0BEC5';
      ctx.font = '10px Montserrat, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(pod.harpoonState.toUpperCase(), cardX + 122, cardY + 38);
      ctx.restore();
    });
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const pod = this.pods.get(p.id);
      return {
        playerId: p.id,
        score: pod ? pod.score : 0
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
        ? `Player ${typeof winnerId === 'number' ? winnerId + 1 : winnerId} sniped the abyssal depths with lethal harpoon accuracy!`
        : 'The trench remained silent in the pitch black!'
    };
  }
}
