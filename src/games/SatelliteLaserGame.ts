import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface EnergyReceiver {
  playerId: PlayerId;
  x: number;
  y: number;
  radius: number;
  charge: number; // 0 to 100
  pulseTimer: number;
}

interface SatelliteUnit {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  mirrorAngle: number;
  score: number;
  chargeTime: number; // 0 to 1.3
  isCharging: boolean;
  overheatTimer: number;
  blastTimer: number;
  beamActiveTimer: number;
  streakCount: number;
  streakTimer: number;
  stunTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
}

interface LaserSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  intensity: number;
  ownerId: PlayerId | null;
}

interface EnergyOrb {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'plasma' | 'prism' | 'supernova';
  points: number;
  radius: number;
  color: string;
  pulsePhase: number;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  starColor: string;
  emitterCoreColor: string;
  emitterRingColor: string;
  laserBeamColor: string;
  gridLineColor: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Solar Corona',
    icon: '☀️',
    bgGradTop: '#150A02',
    bgGradBottom: '#050302',
    starColor: 'rgba(255, 180, 100, 0.45)',
    emitterCoreColor: '#FF6F00',
    emitterRingColor: '#FFD54F',
    laserBeamColor: '#FFE082',
    gridLineColor: 'rgba(255, 160, 50, 0.06)'
  },
  {
    name: 'Neon Orbital Grid',
    icon: '⚡',
    bgGradTop: '#050B18',
    bgGradBottom: '#020409',
    starColor: 'rgba(0, 229, 255, 0.4)',
    emitterCoreColor: '#00E5FF',
    emitterRingColor: '#D500F9',
    laserBeamColor: '#00E5FF',
    gridLineColor: 'rgba(0, 229, 255, 0.08)'
  },
  {
    name: 'Deep Cosmos Void',
    icon: '🌌',
    bgGradTop: '#0D051A',
    bgGradBottom: '#040108',
    starColor: 'rgba(213, 0, 249, 0.4)',
    emitterCoreColor: '#AA00FF',
    emitterRingColor: '#7C4DFF',
    laserBeamColor: '#EA80FC',
    gridLineColor: 'rgba(170, 0, 255, 0.07)'
  }
];

export class SatelliteLaserGame extends BaseGame {
  private satellites: Map<PlayerId, SatelliteUnit> = new Map();
  private receivers: Map<PlayerId, EnergyReceiver> = new Map();
  private laserSegments: LaserSegment[] = [];
  private orbs: EnergyOrb[] = [];
  private nextOrbId = 1;
  private orbSpawnTimer = 0;

  // Central Sun Laser Emitter
  private emitter = {
    x: 0,
    y: 0,
    angle: 0,
    angularSpeed: 0.65,
    pulseTimer: 0,
    radius: 32
  };

  private currentThemeIndex = 0;
  private screenShake = 0;
  private hitStopTimer = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private announcementText = '';
  private announcementTimer = 0;
  private backgroundStars: { x: number; y: number; r: number; blinkOffset: number }[] = [];

  // Input listeners
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
    this.satellites.clear();
    this.receivers.clear();
    this.laserSegments = [];
    this.orbs = [];
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.orbSpawnTimer = 1.0;
    this.announcementText = '';
    this.announcementTimer = 0;

    // Generate persistent starfield
    this.backgroundStars = [];
    for (let i = 0; i < 70; i++) {
      this.backgroundStars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.8 + 0.6,
        blinkOffset: Math.random() * Math.PI * 2
      });
    }

    this.emitter = {
      x: width * 0.5,
      y: height * 0.5,
      angle: 0,
      angularSpeed: 0.65,
      pulseTimer: 0,
      radius: 32
    };

    const active = this.getActivePlayers();
    const cornerReceivers = [
      { recX: 75, recY: 75, satX: width * 0.3, satY: height * 0.32, angle: Math.PI * 0.25 },
      { recX: width - 75, recY: 75, satX: width * 0.7, satY: height * 0.32, angle: Math.PI * 0.75 },
      { recX: 75, recY: height - 75, satX: width * 0.3, satY: height * 0.68, angle: -Math.PI * 0.25 },
      { recX: width - 75, recY: height - 75, satX: width * 0.7, satY: height * 0.68, angle: -Math.PI * 0.75 }
    ];

    active.forEach((p, idx) => {
      const cfg = cornerReceivers[idx % cornerReceivers.length];
      this.satellites.set(p.id, {
        id: p.id,
        x: cfg.satX,
        y: cfg.satY,
        vx: 0,
        vy: 0,
        angle: cfg.angle,
        mirrorAngle: cfg.angle,
        score: 0,
        chargeTime: 0,
        isCharging: false,
        overheatTimer: 0,
        blastTimer: 0,
        beamActiveTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        stunTimer: 0,
        mood: 'idle',
        animTimer: idx * 0.5,
        sabotageCount: 0
      });

      this.receivers.set(p.id, {
        playerId: p.id,
        x: cfg.recX,
        y: cfg.recY,
        radius: 34,
        charge: 0,
        pulseTimer: 0
      });
    });

    // Seed initial orbs
    this.spawnOrb(width, height, 'plasma');
    this.spawnOrb(width, height, 'prism');
  }

  private spawnOrb(width: number, height: number, forceType?: 'plasma' | 'prism' | 'supernova'): void {
    const types: ('plasma' | 'prism' | 'supernova')[] = ['plasma', 'plasma', 'prism', 'supernova'];
    const type = forceType || types[Math.floor(Math.random() * types.length)];
    let points = 25;
    let radius = 14;
    let color = '#00E5FF';

    if (type === 'prism') {
      points = 45;
      radius = 17;
      color = '#D500F9';
    } else if (type === 'supernova') {
      points = 75;
      radius = 21;
      color = '#FFD54F';
    }

    const ang = Math.random() * Math.PI * 2;
    const dist = 90 + Math.random() * (Math.min(width, height) * 0.38 - 90);
    const ox = width * 0.5 + Math.cos(ang) * dist;
    const oy = height * 0.5 + Math.sin(ang) * dist;

    this.orbs.push({
      id: this.nextOrbId++,
      x: ox,
      y: oy,
      vx: (Math.random() - 0.5) * 35,
      vy: (Math.random() - 0.5) * 35,
      type,
      points,
      radius,
      color,
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

    // Sudden death acceleration at <= 12s
    const isSuddenDeath = this.roundTimer <= 12.0;
    const rotationRate = isSuddenDeath ? 0.95 : 0.65;
    this.emitter.angularSpeed = rotationRate;
    this.emitter.angle += this.emitter.angularSpeed * dt;
    this.emitter.pulseTimer += dt * 3;

    // Leader / Underdog tracking
    let topScore = -1;
    for (const sat of this.satellites.values()) {
      if (sat.score > topScore) topScore = sat.score;
    }

    // Update satellites
    for (const [id, sat] of this.satellites.entries()) {
      sat.animTimer += dt;
      const isUnderdog = topScore >= 35 && sat.score <= topScore - 30;

      if (sat.stunTimer > 0) {
        sat.stunTimer -= dt;
        sat.vx *= Math.pow(0.85, dt * 60);
        sat.vy *= Math.pow(0.85, dt * 60);
        sat.x += sat.vx * dt;
        sat.y += sat.vy * dt;
        sat.mood = 'shocked';
        continue;
      }

      if (sat.overheatTimer > 0) {
        sat.overheatTimer -= dt;
        sat.mood = 'shocked';
      }

      if (sat.blastTimer > 0) {
        sat.blastTimer -= dt;
      }

      if (sat.streakTimer > 0) {
        sat.streakTimer -= dt;
        if (sat.streakTimer <= 0) {
          sat.streakCount = 0;
        }
      }

      const moveX = this.input.getSteer(id);
      const moveY = -this.input.getThrottle(id);
      const isAction = this.input.isActionPressed(id) || this.input.isPressed(id);

      // Movement handling with inertia
      const speedMult = isUnderdog ? 1.25 : 1.0;
      const accel = 440 * speedMult;
      sat.vx += moveX * accel * dt;
      sat.vy += moveY * accel * dt;

      // Friction
      sat.vx *= Math.pow(0.91, dt * 60);
      sat.vy *= Math.pow(0.91, dt * 60);

      sat.x += sat.vx * dt;
      sat.y += sat.vy * dt;

      // Keep within bounds (safe zones)
      const pad = 52;
      sat.x = Math.max(pad, Math.min(width - pad, sat.x));
      sat.y = Math.max(pad, Math.min(height - pad, sat.y));

      // Steer heading
      if (Math.hypot(sat.vx, sat.vy) > 15) {
        sat.angle = Math.atan2(sat.vy, sat.vx);
      }

      // Hold-to-Charge Mirror Alignment & Solar Focus Burst
      if (isAction && sat.overheatTimer <= 0) {
        sat.isCharging = true;
        sat.chargeTime += dt;
        sat.mood = 'focused';

        // Rotate mirror progressively toward nearest angle or active direction
        sat.mirrorAngle += 2.8 * dt;

        // Charge sound / sparks
        if (Math.random() < 0.3) {
          const sparkColor = sat.chargeTime >= 0.72 && sat.chargeTime <= 0.98 ? '#FFEB3B' : '#00E5FF';
          this.particles.emit(
            sat.x + (Math.random() - 0.5) * 20,
            sat.y + (Math.random() - 0.5) * 20,
            2,
            sparkColor
          );
        }

        // Overheat penalty if held too long (> 1.25s)
        if (sat.chargeTime > 1.25) {
          sat.overheatTimer = 0.95;
          sat.chargeTime = 0;
          sat.isCharging = false;
          sat.mood = 'shocked';
          this.audio.playExplosion();
          this.screenShake = 6;
          this.particles.emit(sat.x, sat.y, 14, '#FF3D00');
          this.announcementText = `OVERHEAT!`;
          this.announcementTimer = 0.8;
        }
      } else if (sat.isCharging) {
        // Released! Evaluate charge
        const sweetSpot = (isUnderdog && sat.chargeTime >= 0.50 && sat.chargeTime <= 1.05) ||
                          (!isUnderdog && sat.chargeTime >= 0.72 && sat.chargeTime <= 0.98);

        if (sweetSpot) {
          // Hyper-Focus Solar Blast
          sat.blastTimer = 0.85;
          sat.score += 25;
          this.audio.playScore();
          this.screenShake = 8;
          sat.mood = 'triumph';
          this.announcementText = `SOLAR FOCUS BURST! +25`;
          this.announcementTimer = 1.0;

          // Emit hyper burst particles
          const burstAngle = sat.mirrorAngle + Math.PI / 2;
          for (let p = 0; p < 18; p++) {
            const spread = (Math.random() - 0.5) * 0.8;
            this.particles.emit(
              sat.x + Math.cos(burstAngle + spread) * 20,
              sat.y + Math.sin(burstAngle + spread) * 20,
              1,
              '#FFEA00'
            );
          }

          // Instantly charge receiver +12%
          const myRec = this.receivers.get(id);
          if (myRec) {
            myRec.charge = Math.min(100, myRec.charge + 12);
            myRec.pulseTimer = 0.5;
          }
        } else {
          // Regular release
          sat.blastTimer = 0.25;
          this.audio.playTap();
        }

        sat.chargeTime = 0;
        sat.isCharging = false;
      } else {
        sat.mood = 'idle';
      }
    }

    // Physical Bumper Shunts & Hijack Sabotage between satellites
    const satArray = Array.from(this.satellites.values());
    for (let i = 0; i < satArray.length; i++) {
      for (let j = i + 1; j < satArray.length; j++) {
        const s1 = satArray[i];
        const s2 = satArray[j];
        const dx = s2.x - s1.x;
        const dy = s2.y - s1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 44; // combined radius

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          s1.x -= nx * overlap * 0.5;
          s1.y -= ny * overlap * 0.5;
          s2.x += nx * overlap * 0.5;
          s2.y += ny * overlap * 0.5;

          // Elastic bounce
          const kx = s1.vx - s2.vx;
          const ky = s1.vy - s2.vy;
          const p = 2 * (nx * kx + ny * ky) / 2;

          const impulse = Math.hypot(kx, ky);
          s1.vx -= p * nx * 1.35;
          s1.vy -= p * ny * 1.35;
          s2.vx += p * nx * 1.35;
          s2.vy += p * ny * 1.35;

          // Check if one shunted the other violently
          if (impulse > 120 || s1.blastTimer > 0 || s2.blastTimer > 0) {
            this.audio.playBounce();
            this.screenShake = Math.min(14, impulse * 0.06 + 4);
            this.hitStopTimer = 0.04;

            const attacker = s1.blastTimer > s2.blastTimer ? s1 : (s2.blastTimer > s1.blastTimer ? s2 : null);
            if (attacker) {
              const victim = attacker === s1 ? s2 : s1;
              attacker.score += 30;
              attacker.sabotageCount++;
              victim.stunTimer = 0.55;
              victim.mirrorAngle += (Math.random() - 0.5) * 1.5; // disorient mirror
              this.particles.emit((s1.x + s2.x) * 0.5, (s1.y + s2.y) * 0.5, 12, '#FF1744');
              this.announcementText = `ORBITAL SHUNT! +30`;
              this.announcementTimer = 1.0;
            }
          }
        }
      }
    }

    // Raycast & Laser Reflections
    this.laserSegments = [];
    const emitterAngles = isSuddenDeath
      ? [this.emitter.angle, this.emitter.angle + Math.PI * 0.5, this.emitter.angle + Math.PI, this.emitter.angle + Math.PI * 1.5]
      : [this.emitter.angle, this.emitter.angle + Math.PI];

    for (const startAngle of emitterAngles) {
      let rayX = this.emitter.x;
      let rayY = this.emitter.y;
      let rayAngle = startAngle;
      let rayColor = THEMES[this.currentThemeIndex].laserBeamColor;
      let activeOwner: PlayerId | null = null;

      for (let bounce = 0; bounce < 3; bounce++) {
        const maxLen = 650;
        let closestHitDist = maxLen;
        let hitSat: SatelliteUnit | null = null;
        let hitNormal = 0;

        for (const sat of this.satellites.values()) {
          // Satellites with blast active have wider mirror capture cone
          const hitRadius = sat.blastTimer > 0 ? 32 : 24;
          const d = this.checkRayCircleIntersect(rayX, rayY, rayAngle, sat.x, sat.y, hitRadius);
          if (d > 6 && d < closestHitDist) {
            closestHitDist = d;
            hitSat = sat;
            hitNormal = sat.mirrorAngle + Math.PI / 2;
          }
        }

        let hitReceiver: EnergyReceiver | null = null;
        for (const rec of this.receivers.values()) {
          const d = this.checkRayCircleIntersect(rayX, rayY, rayAngle, rec.x, rec.y, rec.radius);
          if (d > 6 && d < closestHitDist) {
            closestHitDist = d;
            hitSat = null;
            hitReceiver = rec;
          }
        }

        const endX = rayX + Math.cos(rayAngle) * closestHitDist;
        const endY = rayY + Math.sin(rayAngle) * closestHitDist;

        this.laserSegments.push({
          x1: rayX,
          y1: rayY,
          x2: endX,
          y2: endY,
          color: rayColor,
          intensity: activeOwner !== null ? 1.4 : 1.0,
          ownerId: activeOwner
        });

        if (hitReceiver) {
          // Energy reception
          const recPlayer = this.getPlayer(hitReceiver.playerId);
          const ownerSat = activeOwner !== null ? this.satellites.get(activeOwner) : null;

          // If the reflecting satellite delivered beam to their own receiver: Huge Points!
          if (activeOwner === hitReceiver.playerId && ownerSat) {
            const streamRate = (isSuddenDeath ? 60 : 36) * dt;
            ownerSat.score += Math.round(streamRate);
            hitReceiver.charge = Math.min(100, hitReceiver.charge + 28 * dt);
            hitReceiver.pulseTimer = 0.3;
            ownerSat.beamActiveTimer += dt;
            ownerSat.streakCount = Math.min(5, ownerSat.streakCount + 1);
            ownerSat.streakTimer = 1.2;
            ownerSat.mood = 'triumph';

            if (Math.random() < 0.25) {
              this.particles.emit(endX, endY, 3, recPlayer?.color || '#00E5FF');
              this.audio.playTap();
            }
          } else if (activeOwner !== null && activeOwner !== hitReceiver.playerId) {
            // Hijack / Sabotage: reflected beam into rival receiver or cross-grid
            const robber = this.satellites.get(activeOwner);
            if (robber) {
              robber.score += Math.round(18 * dt);
            }
          }
          break;
        }

        if (hitSat) {
          activeOwner = hitSat.id;
          rayX = endX;
          rayY = endY;
          const inAngle = rayAngle;
          rayAngle = 2 * hitNormal - inAngle - Math.PI;
          const pConfig = this.getPlayer(hitSat.id);
          rayColor = pConfig?.color || '#EF4444';
          hitSat.beamActiveTimer += dt;

          if (Math.random() < 0.2) {
            this.particles.emit(rayX, rayY, 2, rayColor);
          }
        } else {
          break;
        }
      }
    }

    // Orb updates & collection
    this.orbSpawnTimer -= dt;
    if (this.orbSpawnTimer <= 0 && this.orbs.length < 5) {
      this.spawnOrb(width, height);
      this.orbSpawnTimer = 3.5 + Math.random() * 2.0;
    }

    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      orb.pulsePhase += dt * 4;

      // Bounce orbs off walls
      if (orb.x < 50 || orb.x > width - 50) orb.vx *= -1;
      if (orb.y < 50 || orb.y > height - 50) orb.vy *= -1;

      // Check pickup by satellites
      for (const sat of this.satellites.values()) {
        const d = Math.hypot(sat.x - orb.x, sat.y - orb.y);
        const pickupRadius = (sat.blastTimer > 0 ? 36 : 26) + orb.radius;
        if (d < pickupRadius) {
          sat.score += orb.points;
          this.audio.playScore();
          this.particles.emit(orb.x, orb.y, 16, orb.color);
          this.announcementText = `+${orb.points} ${orb.type.toUpperCase()}!`;
          this.announcementTimer = 0.8;
          this.orbs.splice(i, 1);
          break;
        }
      }
    }

    // Receiver pulse timers
    for (const rec of this.receivers.values()) {
      if (rec.pulseTimer > 0) {
        rec.pulseTimer -= dt;
      }
    }
  }

  private checkRayCircleIntersect(rx: number, ry: number, rAngle: number, cx: number, cy: number, radius: number): number {
    const dx = Math.cos(rAngle);
    const dy = Math.sin(rAngle);
    const fx = rx - cx;
    const fy = ry - cy;

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - radius * radius;

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return 99999;

    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    return t > 0 ? t : 99999;
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: string, width: number, height: number): void {
    const timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const sat = this.satellites.get(botId);
    const rec = this.receivers.get(botId);
    if (!sat || !rec) return;

    // Difficulty delays
    let delay = 0.24;
    let blunderChance = 0.12;

    if (difficulty === 'bot_easy') {
      delay = 0.42;
      blunderChance = 0.22;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11;
      blunderChance = 0.02;
    }

    // Target selection: Nearest Orb, or Ideal Laser Intercept Point
    let targetX = (this.emitter.x + rec.x) * 0.5;
    let targetY = (this.emitter.y + rec.y) * 0.5;

    // Find closest valuable orb
    let closestOrbDist = 200;
    for (const orb of this.orbs) {
      const d = Math.hypot(orb.x - sat.x, orb.y - sat.y);
      if (d < closestOrbDist) {
        closestOrbDist = d;
        targetX = orb.x;
        targetY = orb.y;
      }
    }

    // Steer toward target
    const dx = targetX - sat.x;
    const dy = targetY - sat.y;
    let steerX = 0;
    let throttleY = 0;

    if (Math.hypot(dx, dy) > 25) {
      steerX = Math.max(-1, Math.min(1, dx / 80));
      throttleY = Math.max(-1, Math.min(1, dy / 80));
    }

    // Mirror calculation: Reflect emitter beam directly to home receiver
    const angleFromEmitter = Math.atan2(sat.y - this.emitter.y, sat.x - this.emitter.x);
    const angleToReceiver = Math.atan2(rec.y - sat.y, rec.x - sat.x);
    const desiredNormal = (angleFromEmitter + angleToReceiver) / 2;
    const desiredMirrorAngle = desiredNormal - Math.PI / 2;

    let angleDiff = desiredMirrorAngle - sat.mirrorAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    let wantAction = false;
    // On hard/normal, time charge burst when aligned
    if (Math.abs(angleDiff) > 0.25 || (sat.chargeTime < 0.85 && sat.chargeTime > 0)) {
      wantAction = true;
    }

    if (sat.chargeTime >= 0.78 && sat.chargeTime <= 0.95) {
      // Perfect release!
      wantAction = false;
    }

    // Blunder roll
    if (Math.random() < blunderChance) {
      wantAction = Math.random() < 0.5;
      steerX += (Math.random() - 0.5) * 0.6;
      throttleY += (Math.random() - 0.5) * 0.6;
    }

    this.input.setBotInput(botId, wantAction, steerX, throttleY, wantAction);
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

    // 1. Deep Space Background Gradient
    const bgGrad = ctx.createRadialGradient(
      this.emitter.x, this.emitter.y, 40,
      this.emitter.x, this.emitter.y, Math.max(width, height) * 0.75
    );
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Starfield
    ctx.fillStyle = theme.starColor;
    for (const star of this.backgroundStars) {
      const alpha = 0.35 + Math.sin(this.emitter.pulseTimer + star.blinkOffset) * 0.25;
      ctx.globalAlpha = Math.max(0.1, alpha);
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // 3. Orbital Grid Rings
    ctx.strokeStyle = theme.gridLineColor;
    ctx.lineWidth = 1.5;
    for (let r = 80; r < Math.min(width, height) * 0.45; r += 75) {
      ctx.beginPath();
      ctx.arc(this.emitter.x, this.emitter.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 4. Render Laser Beams with Multi-layered Glow
    for (const seg of this.laserSegments) {
      // Outer glow
      ctx.save();
      ctx.strokeStyle = seg.color;
      ctx.globalAlpha = 0.3 * seg.intensity;
      ctx.lineWidth = 10 * seg.intensity;
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();

      // Core beam
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 3.5 * seg.intensity;
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();

      // Piercing white laser center
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();
      ctx.restore();
    }

    // 5. Central Sun Emitter
    ctx.save();
    ctx.translate(this.emitter.x, this.emitter.y);

    // Corona aura
    const coronaGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 48);
    coronaGrad.addColorStop(0, 'rgba(255, 235, 59, 0.85)');
    coronaGrad.addColorStop(0.5, 'rgba(255, 111, 0, 0.4)');
    coronaGrad.addColorStop(1, 'rgba(255, 61, 0, 0)');
    ctx.fillStyle = coronaGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 48 + Math.sin(this.emitter.pulseTimer) * 4, 0, Math.PI * 2);
    ctx.fill();

    // Emitter Core
    ctx.fillStyle = theme.emitterCoreColor;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = theme.emitterRingColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Rotating lens lenses
    ctx.rotate(this.emitter.angle);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(14, -4, 18, 8);
    ctx.fillRect(-32, -4, 18, 8);
    ctx.restore();

    // 6. Floating Energy Orbs
    for (const orb of this.orbs) {
      ctx.save();
      ctx.translate(orb.x, orb.y);
      const bob = Math.sin(orb.pulsePhase) * 3;

      // Glow
      ctx.fillStyle = orb.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(0, bob, orb.radius * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Core
      ctx.fillStyle = orb.color;
      ctx.beginPath();
      ctx.arc(0, bob, orb.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-orb.radius * 0.3, bob - orb.radius * 0.3, orb.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Points label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${orb.points}`, 0, bob + orb.radius + 12);
      ctx.restore();
    }

    // 7. Render Energy Receivers (Bases)
    for (const [id, rec] of this.receivers.entries()) {
      ctx.save();
      ctx.translate(rec.x, rec.y);
      const pConfig = this.getPlayer(id);
      const color = pConfig?.color || '#EF4444';

      // Base ring
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, rec.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Pulse wave when receiving energy
      if (rec.pulseTimer > 0) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.globalAlpha = rec.pulseTimer / 0.3;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, rec.radius + (0.3 - rec.pulseTimer) * 40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      // Charged core
      const chargePct = rec.charge / 100;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.25 + chargePct * 0.65;
      ctx.beginPath();
      ctx.arc(0, 0, rec.radius * Math.max(0.2, chargePct), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Battery label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(rec.charge)}%`, 0, 4);

      // Player Corner Tag
      ctx.fillStyle = color;
      ctx.font = '900 11px sans-serif';
      ctx.fillText(pConfig?.name || `P${id + 1}`, 0, rec.radius + 15);
      ctx.restore();
    }

    // 8. Render Satellites with Mascot Astronauts & Parabolic Mirrors
    for (const [id, sat] of this.satellites.entries()) {
      ctx.save();
      ctx.translate(sat.x, sat.y);
      const pConfig = this.getPlayer(id);
      const color = pConfig?.color || '#EF4444';
      const isBot = pConfig ? pConfig.type !== 'human' : false;

      // Charge Aura
      if (sat.isCharging) {
        const pct = Math.min(1, sat.chargeTime / 1.0);
        const sweetSpot = sat.chargeTime >= 0.72 && sat.chargeTime <= 0.98;
        ctx.strokeStyle = sweetSpot ? '#00E676' : '#FFD600';
        ctx.lineWidth = sweetSpot ? 4 : 2;
        ctx.beginPath();
        ctx.arc(0, 0, 24 + pct * 14, 0, Math.PI * 2);
        ctx.stroke();

        // Charge Ring Fill
        ctx.fillStyle = sweetSpot ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 214, 0, 0.15)';
        ctx.beginPath();
        ctx.arc(0, 0, 24 + pct * 14, 0, Math.PI * 2);
        ctx.fill();
      }

      // Stun / Shocked Ring
      if (sat.stunTimer > 0) {
        ctx.strokeStyle = '#FF1744';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Satellite Chassis
      ctx.fillStyle = '#263238';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Solar Panel Wings
      ctx.fillStyle = '#0288D1';
      ctx.fillRect(-28, -6, 10, 12);
      ctx.fillRect(18, -6, 10, 12);

      ctx.strokeStyle = '#81D4FA';
      ctx.lineWidth = 1;
      ctx.strokeRect(-28, -6, 10, 12);
      ctx.strokeRect(18, -6, 10, 12);

      // Mascot Astronaut Pilot in cockpit
      drawCharacter(ctx, 0, 0, 11, id, isBot, sat.mood, sat.animTimer, undefined);

      // Parabolic Reflector Mirror
      ctx.save();
      ctx.rotate(sat.mirrorAngle);
      ctx.strokeStyle = sat.blastTimer > 0 ? '#FFEB3B' : '#ECEFF1';
      ctx.lineWidth = sat.blastTimer > 0 ? 5 : 3.5;
      ctx.beginPath();
      ctx.arc(0, -6, 20, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();

      // Mirror bracket
      ctx.fillStyle = '#90A4AE';
      ctx.fillRect(-3, -10, 6, 8);
      ctx.restore();

      // Score Pill Above Satellite
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.roundRect(-22, -34, 44, 18, 9);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${sat.score}`, 0, -21);

      ctx.restore();
    }

    // 9. Central Announcement Banner
    if (this.announcementTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.beginPath();
      ctx.roundRect(width * 0.5 - 140, height * 0.36, 280, 36, 10);
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
    ctx.fillText('⚡ SATELLITE LASER • SOLAR RELAY GRID ⚡', width * 0.5, badgeY + 17);
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
      const sat = this.satellites.get(p.id);
      if (!sat) return;

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
      ctx.fillText(`${sat.score} pts`, cardX + 28, cardY + 38);
      ctx.restore();
    });

    ctx.restore();
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.satellites.entries()).map(([playerId, sat]) => ({
      playerId,
      score: sat.score
    }));
    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null
        ? `Player ${winnerId + 1} beamed solar energy to victory with ${scores[0].score} pts!`
        : 'Laser relays cycled!'
    };
  }
}
