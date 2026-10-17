import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface AnchorPylon {
  id: number;
  x: number;
  y: number;
  radius: number;
  pulseTimer: number;
  angle: number;
}

interface CargoPod {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'bio' | 'fuel' | 'antimatter';
  value: number;
  color: string;
  radius: number;
  pulsePhase: number;
}

interface TetherAstronaut {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  tetherPylonId: number | null;
  tetherNodeId?: number | null;
  tetherHoldTime?: number;
  boostCooldown?: number;
  tetherLength: number;
  score: number;
  chargeTime: number; // 0 to 1.3
  isCharging: boolean;
  overheatTimer: number;
  slingshotTimer: number;
  spinTimer: number;
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
  cargoHeld: CargoPod[];
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  earthCurveColor: string;
  stationColor: string;
  pylonGlowColor: string;
  starColor: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Low Earth Orbit',
    icon: '🌍',
    bgGradTop: '#040B1A',
    bgGradBottom: '#01040A',
    earthCurveColor: 'rgba(2, 136, 209, 0.45)',
    stationColor: '#CFD8DC',
    pylonGlowColor: '#00E5FF',
    starColor: 'rgba(255, 255, 255, 0.5)'
  },
  {
    name: 'Lunar Gateway',
    icon: '🌕',
    bgGradTop: '#121214',
    bgGradBottom: '#050508',
    earthCurveColor: 'rgba(189, 189, 189, 0.35)',
    stationColor: '#ECEFF1',
    pylonGlowColor: '#FFD54F',
    starColor: 'rgba(255, 215, 0, 0.45)'
  },
  {
    name: 'Deep Space Station',
    icon: '🌌',
    bgGradTop: '#10051E',
    bgGradBottom: '#04010A',
    earthCurveColor: 'rgba(170, 0, 255, 0.35)',
    stationColor: '#90A4AE',
    pylonGlowColor: '#EA80FC',
    starColor: 'rgba(213, 0, 249, 0.5)'
  }
];

export class ZeroGTetherGame extends BaseGame {
  private astronauts: Map<PlayerId, TetherAstronaut> = new Map();
  private pylons: AnchorPylon[] = [];
  private cargo: CargoPod[] = [];
  private cargoIdCounter = 0;
  private stationRotation = 0;
  private currentThemeIndex = 0;
  private screenShake = 0;
  private hitStopTimer = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private announcementText = '';
  private announcementTimer = 0;
  private stars: { x: number; y: number; r: number; blinkOffset: number }[] = [];

  // Key / Click listeners
  private keydownHandler?: (e: KeyboardEvent) => void;
  private clickHandler?: (e: MouseEvent) => void;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
    this.setupListeners();
  }

  private setupListeners(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === '1') {
        this.setTheme(0);
      } else if (e.key === '2') {
        this.setTheme(1);
      } else if (e.key === '3') {
        this.setTheme(2);
      }
    };
    window.addEventListener('keydown', this.keydownHandler);

    this.clickHandler = (e: MouseEvent) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      // Theme pill check: bottom-left x: 20, y: height - 44, w: 170, h: 32
      const canvasHeight = canvas.height;
      if (clickX >= 20 && clickX <= 190 && clickY >= canvasHeight - 44 && clickY <= canvasHeight - 12) {
        this.cycleTheme();
      }
    };
    window.addEventListener('click', this.clickHandler);
  }

  public cycleTheme(): void {
    this.currentThemeIndex = (this.currentThemeIndex + 1) % THEMES.length;
    this.audio.playTap();
  }

  public setTheme(idx: number): void {
    if (idx >= 0 && idx < THEMES.length) {
      this.currentThemeIndex = idx;
      this.audio.playTap();
    }
  }

  public override destroy(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = undefined;
    }
    if (this.clickHandler) {
      window.removeEventListener('click', this.clickHandler);
      this.clickHandler = undefined;
    }
    super.destroy();
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.astronauts.clear();
    this.cargo = [];
    this.cargoIdCounter = 0;
    this.stationRotation = 0;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.announcementText = '';
    this.announcementTimer = 0;

    // Generate persistent starfield
    this.stars = [];
    for (let i = 0; i < 75; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.8 + 0.5,
        blinkOffset: Math.random() * Math.PI * 2
      });
    }

    // Station Anchor Pylons (Central hub + 4 perimeter nodes)
    this.pylons = [
      { id: 0, x: width * 0.5, y: height * 0.5, radius: 26, pulseTimer: 0, angle: 0 },
      { id: 1, x: width * 0.28, y: height * 0.32, radius: 18, pulseTimer: 0, angle: 0 },
      { id: 2, x: width * 0.72, y: height * 0.32, radius: 18, pulseTimer: 0, angle: 0 },
      { id: 3, x: width * 0.28, y: height * 0.68, radius: 18, pulseTimer: 0, angle: 0 },
      { id: 4, x: width * 0.72, y: height * 0.68, radius: 18, pulseTimer: 0, angle: 0 }
    ];

    // Seed cargo pods
    for (let i = 0; i < 14; i++) {
      this.spawnCargo(width, height);
    }

    const active = this.getActivePlayers();
    const spawnPositions = [
      { x: width * 0.35, y: height * 0.35, angle: Math.PI * 0.25 },
      { x: width * 0.65, y: height * 0.35, angle: Math.PI * 0.75 },
      { x: width * 0.35, y: height * 0.65, angle: -Math.PI * 0.25 },
      { x: width * 0.65, y: height * 0.65, angle: -Math.PI * 0.75 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnPositions[idx % spawnPositions.length];
      this.astronauts.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: pos.angle,
        tetherPylonId: null,
        tetherLength: 75,
        score: 0,
        chargeTime: 0,
        isCharging: false,
        overheatTimer: 0,
        slingshotTimer: 0,
        spinTimer: 0,
        stunTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: idx * 0.5,
        sabotageCount: 0,
        cargoHeld: []
      });
    });
  }

  private spawnCargo(width: number, height: number): void {
    const rand = Math.random();
    let type: 'bio' | 'fuel' | 'antimatter' = 'bio';
    let value = 20;
    let color = '#00E5FF';
    let radius = 10;

    if (rand < 0.5) {
      type = 'bio';
      value = 20;
      color = '#00E5FF';
      radius = 10;
    } else if (rand < 0.85) {
      type = 'fuel';
      value = 40;
      color = '#76FF03';
      radius = 12;
    } else {
      type = 'antimatter';
      value = 75;
      color = '#FFD54F';
      radius = 15;
    }

    this.cargo.push({
      id: ++this.cargoIdCounter,
      x: 70 + Math.random() * (width - 140),
      y: 70 + Math.random() * (height - 140),
      vx: (Math.random() - 0.5) * 35,
      vy: (Math.random() - 0.5) * 35,
      type,
      value,
      color,
      radius,
      pulsePhase: Math.random() * Math.PI * 2
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    if (this.announcementTimer > 0) {
      this.announcementTimer -= dt;
      if (this.announcementTimer <= 0) {
        this.announcementText = '';
      }
    }

    this.updateBots(dt, width, height);

    // Replenish cargo
    while (this.cargo.length < 12) {
      this.spawnCargo(width, height);
    }

    // Sudden death check (<= 12s)
    const isSuddenDeath = this.roundTimer <= 12.0;
    this.stationRotation += (isSuddenDeath ? 0.75 : 0.45) * dt;

    // Animate pylons
    for (const pylon of this.pylons) {
      pylon.angle = this.stationRotation;
      if (pylon.pulseTimer > 0) {
        pylon.pulseTimer -= dt;
      }
    }

    // Update drifting cargo
    for (const c of this.cargo) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.pulsePhase += dt * 3.5;

      if (c.x < 40 || c.x > width - 40) c.vx *= -1;
      if (c.y < 40 || c.y > height - 40) c.vy *= -1;
    }

    // Leader / Underdog calculation
    let topScore = -1;
    for (const a of this.astronauts.values()) {
      if (a.score > topScore) topScore = a.score;
    }

    // Update Astronauts
    for (const [id, a] of this.astronauts.entries()) {
      a.animTimer += dt;
      const isUnderdog = topScore >= 35 && a.score <= topScore - 30;

      if (a.spinTimer > 0) {
        a.spinTimer -= dt;
        a.angle += 11 * dt;
        a.vx *= Math.pow(0.94, dt * 60);
        a.vy *= Math.pow(0.94, dt * 60);
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.mood = 'shocked';
        continue;
      }

      if (a.stunTimer > 0) {
        a.stunTimer -= dt;
        a.vx *= Math.pow(0.88, dt * 60);
        a.vy *= Math.pow(0.88, dt * 60);
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.mood = 'shocked';
        continue;
      }

      if (a.overheatTimer > 0) {
        a.overheatTimer -= dt;
        a.mood = 'shocked';
      }

      if (a.slingshotTimer > 0) {
        a.slingshotTimer -= dt;
      }

      if (a.streakTimer > 0) {
        a.streakTimer -= dt;
        if (a.streakTimer <= 0) {
          a.streakCount = 0;
        }
      }

      const steerX = this.input.getSteer(id);
      const throttleY = -this.input.getThrottle(id);
      const isAction = this.input.isActionPressed(id) || this.input.isPressed(id);

      // Jetpack Thruster physics
      const speedMult = (isUnderdog ? 1.25 : 1.0) * (a.slingshotTimer > 0 ? 1.6 : 1.0);
      const thrust = 380 * speedMult;
      a.vx += steerX * thrust * dt;
      a.vy += throttleY * thrust * dt;

      // Inertial zero-G drag
      const dragFactor = a.slingshotTimer > 0 ? 0.99 : 0.92;
      a.vx *= Math.pow(dragFactor, dt * 60);
      a.vy *= Math.pow(dragFactor, dt * 60);

      a.x += a.vx * dt;
      a.y += a.vy * dt;

      // Keep within station bounds
      const pad = 42;
      a.x = Math.max(pad, Math.min(width - pad, a.x));
      a.y = Math.max(pad, Math.min(height - pad, a.y));

      // Astronaut heading
      if (Math.hypot(a.vx, a.vy) > 20) {
        a.angle = Math.atan2(a.vy, a.vx);
      }

      // Sync tether node aliases & handle auto-slingshot if tethered > 3.0s
      if (a.tetherNodeId !== undefined && a.tetherNodeId !== null && a.tetherPylonId === null) {
        a.tetherPylonId = a.tetherNodeId;
      }
      if (a.tetherPylonId !== null) {
        a.tetherHoldTime = (a.tetherHoldTime ?? 0) + dt;
        if (a.tetherHoldTime >= 3.0) {
          const pylon = this.pylons[a.tetherPylonId % this.pylons.length] || this.pylons[0];
          const toPylonAngle = Math.atan2(a.y - pylon.y, a.x - pylon.x);
          const launchAngle = toPylonAngle + Math.PI * 0.5 * (a.vx * Math.sin(toPylonAngle) - a.vy * Math.cos(toPylonAngle) >= 0 ? 1 : -1);
          const launchSpeed = 460;
          a.vx = Math.cos(launchAngle) * launchSpeed;
          a.vy = Math.sin(launchAngle) * launchSpeed;
          a.tetherPylonId = null;
          a.tetherNodeId = null;
          a.tetherHoldTime = 0;
          a.chargeTime = 0;
          a.isCharging = false;
          a.slingshotTimer = 1.0;
          a.boostCooldown = 1.0;
          this.audio.playBoost();
          this.particles.emit(a.x, a.y, 16, '#00E676');
        }
      }

      // Tether Mechanics & Tension Hold-to-Charge
      if (isAction && a.overheatTimer <= 0) {
        a.isCharging = true;
        a.chargeTime += dt;
        a.mood = 'focused';

        // If not attached to a pylon, find closest pylon in grapple range
        if (a.tetherPylonId === null) {
          let closestPylon: AnchorPylon | null = null;
          let minDist = isUnderdog ? 220 : 160;
          for (const p of this.pylons) {
            const d = Math.hypot(p.x - a.x, p.y - a.y);
            if (d < minDist) {
              minDist = d;
              closestPylon = p;
            }
          }

          if (closestPylon) {
            a.tetherPylonId = closestPylon.id;
            a.tetherLength = Math.max(45, minDist);
            closestPylon.pulseTimer = 0.4;
            this.audio.playTap();
          }
        }

        // When tethered, apply centripetal tension spring pull
        if (a.tetherPylonId !== null) {
          const pylon = this.pylons[a.tetherPylonId];
          const dx = a.x - pylon.x;
          const dy = a.y - pylon.y;
          const dist = Math.hypot(dx, dy);

          if (dist > a.tetherLength) {
            const tension = (dist - a.tetherLength) * 550;
            const ang = Math.atan2(dy, dx);
            a.vx -= Math.cos(ang) * tension * dt;
            a.vy -= Math.sin(ang) * tension * dt;
          }

          // Tension sparks
          if (Math.random() < 0.35) {
            const sparkColor = a.chargeTime >= 0.72 && a.chargeTime <= 0.98 ? '#00E676' : '#FFD54F';
            this.particles.emit(a.x, a.y, 2, sparkColor);
          }
        }

        // Cable snap blowout if held too long (> 1.25s)
        if (a.chargeTime > 1.25) {
          a.overheatTimer = 0.95;
          a.chargeTime = 0;
          a.isCharging = false;
          a.tetherPylonId = null;
          a.mood = 'shocked';
          this.audio.playExplosion();
          this.screenShake = 7;
          this.particles.emit(a.x, a.y, 14, '#FF3D00');
          this.announcementText = 'TETHER SNAP!';
          this.announcementTimer = 0.8;
        }
      } else if (a.isCharging) {
        // Released! Evaluate charge
        const sweetSpot = (isUnderdog && a.chargeTime >= 0.50 && a.chargeTime <= 1.05) ||
                          (!isUnderdog && a.chargeTime >= 0.72 && a.chargeTime <= 0.98);

        if (sweetSpot && a.tetherPylonId !== null) {
          // Hyper-Orbital Slingshot Whip!
          const pylon = this.pylons[a.tetherPylonId];
          const toPylonAngle = Math.atan2(a.y - pylon.y, a.x - pylon.x);
          const launchAngle = toPylonAngle + Math.PI * 0.5 * (a.vx * Math.sin(toPylonAngle) - a.vy * Math.cos(toPylonAngle) > 0 ? 1 : -1);

          a.vx = Math.cos(launchAngle) * 580;
          a.vy = Math.sin(launchAngle) * 580;
          a.slingshotTimer = 1.4;
          a.score += 25;
          a.mood = 'triumph';
          this.audio.playScore();
          this.screenShake = 9;
          this.particles.emit(a.x, a.y, 18, '#00E676');
          this.announcementText = 'SLINGSHOT WHIP! +25';
          this.announcementTimer = 1.0;

          // Vacuum all nearby cargo
          for (let c = this.cargo.length - 1; c >= 0; c--) {
            const pod = this.cargo[c];
            if (Math.hypot(a.x - pod.x, a.y - pod.y) < 55) {
              a.score += pod.value * (isSuddenDeath ? 2 : 1);
              a.cargoHeld.push(pod);
              this.cargo.splice(c, 1);
              this.particles.emit(pod.x, pod.y, 8, pod.color);
            }
          }
        } else {
          // Normal release
          a.slingshotTimer = 0.3;
          this.audio.playTap();
        }

        a.tetherPylonId = null;
        a.chargeTime = 0;
        a.isCharging = false;
      } else {
        a.mood = 'idle';
      }

      // Regular Cargo Pickup
      const pickupRange = (isUnderdog ? 32 : 24) + (a.slingshotTimer > 0 ? 18 : 0);
      for (let c = this.cargo.length - 1; c >= 0; c--) {
        const pod = this.cargo[c];
        if (Math.hypot(a.x - pod.x, a.y - pod.y) < pickupRange + pod.radius) {
          const earned = pod.value * (isSuddenDeath ? 2 : 1);
          a.score += earned;
          a.cargoHeld.push(pod);
          this.cargo.splice(c, 1);
          this.audio.playScore();
          this.particles.emit(pod.x, pod.y, 10, pod.color);
          a.mood = 'triumph';
          break;
        }
      }

      a.tetherNodeId = a.tetherPylonId;
      a.boostCooldown = Math.max(a.slingshotTimer, a.overheatTimer);
    }

    // Physical Astronaut Collision & Bumper Sabotage
    const astroArray = Array.from(this.astronauts.values());
    for (let i = 0; i < astroArray.length; i++) {
      for (let j = i + 1; j < astroArray.length; j++) {
        const a1 = astroArray[i];
        const a2 = astroArray[j];
        const dx = a2.x - a1.x;
        const dy = a2.y - a1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 38;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          a1.x -= nx * overlap * 0.5;
          a1.y -= ny * overlap * 0.5;
          a2.x += nx * overlap * 0.5;
          a2.y += ny * overlap * 0.5;

          const kx = a1.vx - a2.vx;
          const ky = a1.vy - a2.vy;
          const p = 2 * (nx * kx + ny * ky) / 2;

          const impulse = Math.hypot(kx, ky);
          a1.vx -= p * nx * 1.35;
          a1.vy -= p * ny * 1.35;
          a2.vx += p * nx * 1.35;
          a2.vy += p * ny * 1.35;

          if (impulse > 130 || a1.slingshotTimer > 0 || a2.slingshotTimer > 0) {
            this.audio.playBounce();
            this.screenShake = Math.min(14, impulse * 0.06 + 4);
            this.hitStopTimer = 0.04;

            const attacker = a1.slingshotTimer > a2.slingshotTimer ? a1 : (a2.slingshotTimer > a1.slingshotTimer ? a2 : null);
            if (attacker) {
              const victim = attacker === a1 ? a2 : a1;
              attacker.score += 30;
              attacker.sabotageCount++;
              victim.stunTimer = 0.6;
              victim.tetherPylonId = null; // Snap victim's tether!

              // Dislodge carried cargo pod from victim!
              if (victim.cargoHeld.length > 0) {
                const dropped = victim.cargoHeld.pop()!;
                dropped.x = victim.x + (Math.random() - 0.5) * 35;
                dropped.y = victim.y + (Math.random() - 0.5) * 35;
                this.cargo.push(dropped);
              }

              this.particles.emit((a1.x + a2.x) * 0.5, (a1.y + a2.y) * 0.5, 14, '#FF1744');
              this.announcementText = 'EVA BUMPER SHUNT! +30';
              this.announcementTimer = 1.0;
            }
          }
        }
      }
    }
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: string, _width: number, _height: number): void {
    const timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const a = this.astronauts.get(botId);
    if (!a || a.spinTimer > 0 || a.stunTimer > 0) return;

    let delay = 0.23;
    let blunderChance = 0.12;

    if (difficulty === 'bot_easy') {
      delay = 0.42;
      blunderChance = 0.22;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
      blunderChance = 0.02;
    }

    // Target Selection: Hunt nearest valuable cargo
    let targetX = _width * 0.5;
    let targetY = _height * 0.5;
    let minDist = 99999;
    let closest: CargoPod | null = null;

    for (const c of this.cargo) {
      const d = Math.hypot(c.x - a.x, c.y - a.y);
      const weight = c.type === 'antimatter' ? 0.6 : (c.type === 'fuel' ? 0.8 : 1.0);
      const scoreDist = d * weight;
      if (scoreDist < minDist) {
        minDist = scoreDist;
        closest = c;
      }
    }

    if (closest) {
      targetX = closest.x;
      targetY = closest.y;
    }

    const dx = targetX - a.x;
    const dy = targetY - a.y;
    let steerX = 0;
    let throttleY = 0;

    if (Math.hypot(dx, dy) > 20) {
      steerX = Math.max(-1, Math.min(1, dx / 80));
      throttleY = Math.max(-1, Math.min(1, dy / 80));
    }

    // Tether action trigger: Hold when near pylon to slingshot toward target
    let wantTether = false;
    for (const p of this.pylons) {
      const d = Math.hypot(p.x - a.x, p.y - a.y);
      if (d < 140 && (a.chargeTime > 0 || Math.hypot(a.vx, a.vy) < 140)) {
        wantTether = true;
        break;
      }
    }

    // Perfect release timing at sweet spot
    if (a.chargeTime >= 0.76 && a.chargeTime <= 0.95) {
      wantTether = false;
    }

    if (Math.random() < blunderChance) {
      steerX += (Math.random() - 0.5) * 0.7;
      throttleY += (Math.random() - 0.5) * 0.7;
      wantTether = Math.random() < 0.4;
    }

    this.input.setBotInput(botId, wantTether, steerX, -throttleY, wantTether);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIndex];

    ctx.save();
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

    // 1. Orbital Void Gradient
    const bgGrad = ctx.createRadialGradient(
      width * 0.5, height * 0.5, 40,
      width * 0.5, height * 0.5, Math.max(width, height) * 0.75
    );
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Distant Earth Horizon Curve
    ctx.strokeStyle = theme.earthCurveColor;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 1.8, height * 1.2, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    // 3. Starfield
    ctx.fillStyle = theme.starColor;
    for (const star of this.stars) {
      const alpha = 0.35 + Math.sin(star.blinkOffset + this.stationRotation) * 0.25;
      ctx.globalAlpha = Math.max(0.1, alpha);
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // 4. Station Ring Truss & Solar Panels
    ctx.save();
    ctx.translate(width * 0.5, height * 0.5);
    ctx.rotate(this.stationRotation);

    // Outer Station Ring
    ctx.strokeStyle = 'rgba(207, 216, 220, 0.2)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 160, 0, Math.PI * 2);
    ctx.stroke();

    // Spokes
    ctx.strokeStyle = 'rgba(207, 216, 220, 0.15)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI * 0.5);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(160, 0);
      ctx.stroke();
    }
    ctx.restore();

    // 5. Anchor Pylons
    for (const pylon of this.pylons) {
      ctx.save();
      ctx.translate(pylon.x, pylon.y);

      // Pulse glow
      if (pylon.pulseTimer > 0) {
        ctx.strokeStyle = theme.pylonGlowColor;
        ctx.lineWidth = 3;
        ctx.globalAlpha = pylon.pulseTimer / 0.4;
        ctx.beginPath();
        ctx.arc(0, 0, pylon.radius + (0.4 - pylon.pulseTimer) * 35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      // Pylon Body
      ctx.fillStyle = '#263238';
      ctx.beginPath();
      ctx.arc(0, 0, pylon.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = theme.pylonGlowColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Rotating beacon light
      ctx.fillStyle = theme.pylonGlowColor;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6. Floating Cargo Pods
    for (const pod of this.cargo) {
      ctx.save();
      ctx.translate(pod.x, pod.y);
      const bob = Math.sin(pod.pulsePhase) * 2.5;

      // Glow
      ctx.fillStyle = pod.color;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(0, bob, pod.radius * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Pod Core
      ctx.fillStyle = pod.color;
      ctx.beginPath();
      ctx.arc(0, bob, pod.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Points label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${pod.value}`, 0, bob + pod.radius + 11);
      ctx.restore();
    }

    // 7. Active Tethers
    for (const a of this.astronauts.values()) {
      if (a.tetherPylonId !== null) {
        const pylon = this.pylons[a.tetherPylonId];
        const pConfig = this.getPlayer(a.id);
        const color = pConfig?.color || '#00E5FF';

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(pylon.x, pylon.y);
        ctx.lineTo(a.x, a.y);
        ctx.stroke();

        // High tension electric arc
        if (a.chargeTime >= 0.72 && a.chargeTime <= 0.98) {
          ctx.strokeStyle = '#00E676';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(pylon.x, pylon.y);
          ctx.lineTo(a.x, a.y);
          ctx.stroke();
        }
      }
    }

    // 8. Astronauts with Mascot Pilots & EVA Thruster Packs
    for (const [id, a] of this.astronauts.entries()) {
      ctx.save();
      ctx.translate(a.x, a.y);
      const pConfig = this.getPlayer(id);
      const color = pConfig?.color || '#EF4444';
      const isBot = pConfig ? pConfig.type !== 'human' : false;

      // Charge aura
      if (a.isCharging) {
        const pct = Math.min(1, a.chargeTime / 1.0);
        const sweetSpot = a.chargeTime >= 0.72 && a.chargeTime <= 0.98;
        ctx.strokeStyle = sweetSpot ? '#00E676' : '#FFD54F';
        ctx.lineWidth = sweetSpot ? 4 : 2;
        ctx.beginPath();
        ctx.arc(0, 0, 22 + pct * 14, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = sweetSpot ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 213, 79, 0.15)';
        ctx.beginPath();
        ctx.arc(0, 0, 22 + pct * 14, 0, Math.PI * 2);
        ctx.fill();
      }

      // Slingshot velocity trail
      if (a.slingshotTimer > 0) {
        ctx.strokeStyle = '#00E676';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.rotate(a.angle);

      // Heavy EVA Thruster Backpack
      ctx.fillStyle = '#37474F';
      ctx.fillRect(-15, -12, 8, 24);

      // Thruster Plumes
      if (Math.hypot(a.vx, a.vy) > 30) {
        ctx.fillStyle = '#00E5FF';
        ctx.fillRect(-20, -10, 5, 6);
        ctx.fillRect(-20, 4, 5, 6);
      }

      // Spacesuit Torso
      ctx.fillStyle = '#ECEFF1';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Mascot Spacewalker in gold-tint helmet visor
      drawCharacter(ctx, 2, 0, 10, id, isBot, a.mood, a.animTimer, undefined);

      ctx.restore();

      // Score Pill Above Spacewalker
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.roundRect(a.x - 22, a.y - 36, 44, 16, 8);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${a.score}`, a.x, a.y - 24);
    }

    // 9. Central Announcement Banner
    if (this.announcementTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.beginPath();
      ctx.roundRect(width * 0.5 - 150, height * 0.36, 300, 36, 10);
      ctx.fill();
      ctx.strokeStyle = '#FFD54F';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFEB3B';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.announcementText, width * 0.5, height * 0.36 + 23);
      ctx.restore();
    }

    // 10. UI Header Badge (y: 56, h: 28)
    ctx.save();
    const badgeW = 260;
    const badgeH = 26;
    const badgeX = width * 0.5 - badgeW * 0.5;
    const badgeY = 56;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 13);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚀 ZERO-G TETHER • EVA SLINGSHOT 🚀', width * 0.5, badgeY + 17);
    ctx.restore();

    // 11. Theme Pill (Bottom-Left: x: 20, y: height - 44, w: 170, h: 32)
    ctx.save();
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${theme.icon} ${theme.name}`, pillX + 12, pillY + 20);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('[T] / [1-3]', pillX + pillW - 10, pillY + 20);
    ctx.restore();

    // 12. Corner Player Cards (y: height - 128, 130x48px)
    const cardW = 130;
    const cardH = 48;
    const cardY = height - 128;
    const active = this.getActivePlayers();

    active.forEach((p, idx) => {
      const a = this.astronauts.get(p.id);
      if (!a) return;

      let cardX = 20;
      if (idx === 1) cardX = width - cardW - 20;
      else if (idx === 2) cardX = 160;
      else if (idx === 3) cardX = width - cardW - 160;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Color pip
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(cardX + 14, cardY + 24, 7, 0, Math.PI * 2);
      ctx.fill();

      // Name & Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 28, cardY + 20);

      ctx.fillStyle = '#FFD54F';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${a.score} pts`, cardX + 28, cardY + 38);
      ctx.restore();
    });

    ctx.restore();
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.astronauts.entries()).map(([playerId, a]) => ({
      playerId,
      score: a.score
    }));
    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null
        ? `Player ${winnerId + 1} mastered the orbital spacewalk with ${scores[0].score} pts!`
        : 'Station orbit stable!'
    };
  }
}
