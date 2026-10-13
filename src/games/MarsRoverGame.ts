import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface SoilSample {
  id: number;
  x: number;
  y: number;
  type: 'hematite' | 'water_ice' | 'fossil';
  value: number;
  color: string;
  radius: number;
  pulsePhase: number;
}

interface DustDevil {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  spin: number;
}

interface MarsRover {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  samplesHeld: SoilSample[];
  score: number;
  chargeTime: number; // 0 to 1.3
  isCharging: boolean;
  overheatTimer: number;
  burstTimer: number;
  spinTimer: number;
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
  tracks: { x: number; y: number; angle: number; alpha: number }[];
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  craterColor: string;
  duneLineColor: string;
  dustDevilColor: string;
  habitatCoreColor: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Valles Marineris',
    icon: '🔴',
    bgGradTop: '#2A1009',
    bgGradBottom: '#4A1C12',
    craterColor: 'rgba(30, 10, 6, 0.45)',
    duneLineColor: 'rgba(216, 67, 21, 0.15)',
    dustDevilColor: 'rgba(230, 81, 0, 0.45)',
    habitatCoreColor: '#37474F'
  },
  {
    name: 'Planum Boreum Ice Rift',
    icon: '❄️',
    bgGradTop: '#0D212E',
    bgGradBottom: '#1B3B4B',
    craterColor: 'rgba(10, 25, 35, 0.5)',
    duneLineColor: 'rgba(0, 229, 255, 0.18)',
    dustDevilColor: 'rgba(0, 229, 255, 0.4)',
    habitatCoreColor: '#263238'
  },
  {
    name: 'Olympus Caldera',
    icon: '🌋',
    bgGradTop: '#1F0604',
    bgGradBottom: '#380E09',
    craterColor: 'rgba(15, 3, 2, 0.55)',
    duneLineColor: 'rgba(255, 61, 0, 0.2)',
    dustDevilColor: 'rgba(255, 23, 68, 0.5)',
    habitatCoreColor: '#212121'
  }
];

export class MarsRoverGame extends BaseGame {
  private rovers: Map<PlayerId, MarsRover> = new Map();
  private samples: SoilSample[] = [];
  private dustDevils: DustDevil[] = [];
  private sampleIdCounter = 0;
  private rocketLander = { x: 0, y: 0, radius: 46, pulseTimer: 0 };
  private currentThemeIndex = 0;
  private screenShake = 0;
  private hitStopTimer = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private announcementText = '';
  private announcementTimer = 0;
  private craters: { x: number; y: number; r: number }[] = [];

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
    this.rovers.clear();
    this.samples = [];
    this.dustDevils = [];
    this.sampleIdCounter = 0;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.announcementText = '';
    this.announcementTimer = 0;

    this.rocketLander = {
      x: width * 0.5,
      y: height * 0.5,
      radius: 46,
      pulseTimer: 0
    };

    // Procedural terrain craters
    this.craters = [];
    const craterPositions = [
      { x: width * 0.2, y: height * 0.22, r: 42 },
      { x: width * 0.8, y: height * 0.22, r: 48 },
      { x: width * 0.18, y: height * 0.78, r: 45 },
      { x: width * 0.82, y: height * 0.78, r: 52 },
      { x: width * 0.5, y: height * 0.16, r: 34 }
    ];
    for (const c of craterPositions) {
      this.craters.push(c);
    }

    // Spawn initial mineral samples
    for (let i = 0; i < 14; i++) {
      this.spawnSample(width, height);
    }

    // Dynamic Dust Devils
    this.dustDevils = [
      { x: width * 0.28, y: height * 0.35, vx: 50, vy: -35, radius: 36, spin: 0 },
      { x: width * 0.72, y: height * 0.65, vx: -45, vy: 50, radius: 36, spin: 0 }
    ];

    const active = this.getActivePlayers();
    const spawnCorners = [
      { x: 90, y: 90, angle: Math.PI * 0.25 },
      { x: width - 90, y: 90, angle: Math.PI * 0.75 },
      { x: 90, y: height - 90, angle: -Math.PI * 0.25 },
      { x: width - 90, y: height - 90, angle: -Math.PI * 0.75 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnCorners[idx % spawnCorners.length];
      this.rovers.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: pos.angle,
        samplesHeld: [],
        score: 0,
        chargeTime: 0,
        isCharging: false,
        overheatTimer: 0,
        burstTimer: 0,
        spinTimer: 0,
        stunTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: idx * 0.5,
        sabotageCount: 0,
        tracks: []
      });
    });
  }

  private spawnSample(width: number, height: number): void {
    const rand = Math.random();
    let type: 'hematite' | 'water_ice' | 'fossil' = 'hematite';
    let value = 20;
    let color = '#FF7043';
    let radius = 10;

    if (rand < 0.5) {
      type = 'hematite';
      value = 20;
      color = '#FF7043';
      radius = 10;
    } else if (rand < 0.85) {
      type = 'water_ice';
      value = 40;
      color = '#00E5FF';
      radius = 12;
    } else {
      type = 'fossil';
      value = 75;
      color = '#FFD54F';
      radius = 15;
    }

    let x = 0;
    let y = 0;
    let attempts = 0;
    do {
      x = 70 + Math.random() * (width - 140);
      y = 70 + Math.random() * (height - 140);
      attempts++;
    } while (attempts < 20 && Math.hypot(x - width * 0.5, y - height * 0.5) < 95);

    this.samples.push({
      id: ++this.sampleIdCounter,
      x,
      y,
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

    // Replenish samples up to 12
    while (this.samples.length < 12) {
      this.spawnSample(width, height);
    }

    // Sudden death check (<= 12s)
    const isSuddenDeath = this.roundTimer <= 12.0;

    // Update Dust Devils
    for (const dd of this.dustDevils) {
      const speedMult = isSuddenDeath ? 1.5 : 1.0;
      dd.x += dd.vx * speedMult * dt;
      dd.y += dd.vy * speedMult * dt;
      dd.spin += 6.5 * dt;

      if (dd.x < 50 || dd.x > width - 50) dd.vx *= -1;
      if (dd.y < 50 || dd.y > height - 50) dd.vy *= -1;

      if (Math.random() < 0.3) {
        this.particles.emit(dd.x, dd.y, 2, THEMES[this.currentThemeIndex].dustDevilColor);
      }
    }

    // Leader / Underdog calculation
    let topScore = -1;
    for (const r of this.rovers.values()) {
      if (r.score > topScore) topScore = r.score;
    }

    // Update Rovers
    for (const [id, r] of this.rovers.entries()) {
      r.animTimer += dt;
      const isUnderdog = topScore >= 35 && r.score <= topScore - 30;

      // Track aging
      for (let t = r.tracks.length - 1; t >= 0; t--) {
        r.tracks[t].alpha -= dt * 0.45;
        if (r.tracks[t].alpha <= 0) {
          r.tracks.splice(t, 1);
        }
      }

      if (r.spinTimer > 0) {
        r.spinTimer -= dt;
        r.angle += 12 * dt;
        r.vx *= Math.pow(0.92, dt * 60);
        r.vy *= Math.pow(0.92, dt * 60);
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.mood = 'shocked';
        continue;
      }

      if (r.stunTimer > 0) {
        r.stunTimer -= dt;
        r.vx *= Math.pow(0.85, dt * 60);
        r.vy *= Math.pow(0.85, dt * 60);
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.mood = 'shocked';
        continue;
      }

      if (r.overheatTimer > 0) {
        r.overheatTimer -= dt;
        r.mood = 'shocked';
      }

      if (r.burstTimer > 0) {
        r.burstTimer -= dt;
      }

      if (r.streakTimer > 0) {
        r.streakTimer -= dt;
        if (r.streakTimer <= 0) {
          r.streakCount = 0;
        }
      }

      // Responsive directional steering & throttle
      const steer = this.input.getSteer(id);
      const throttle = -this.input.getThrottle(id);
      const isAction = this.input.isActionPressed(id) || this.input.isPressed(id);

      // Direct turn rate
      if (Math.abs(steer) > 0.1) {
        r.angle += steer * 4.2 * dt;
      }

      // Propulsion speed
      const baseAccel = 360 * (isUnderdog ? 1.25 : 1.0) * (r.burstTimer > 0 ? 1.35 : 1.0);
      let driveX = 0;
      let driveY = 0;

      if (Math.abs(throttle) > 0.1) {
        driveX = Math.cos(r.angle) * throttle * baseAccel;
        driveY = Math.sin(r.angle) * throttle * baseAccel;
      } else if (Math.abs(steer) > 0.2) {
        // Forward roll while steering
        driveX = Math.cos(r.angle) * 160;
        driveY = Math.sin(r.angle) * 160;
      }

      r.vx += driveX * dt;
      r.vy += driveY * dt;

      // Surface friction
      r.vx *= Math.pow(0.91, dt * 60);
      r.vy *= Math.pow(0.91, dt * 60);

      r.x += r.vx * dt;
      r.y += r.vy * dt;

      // Keep within arena bounds
      const pad = 44;
      r.x = Math.max(pad, Math.min(width - pad, r.x));
      r.y = Math.max(pad, Math.min(height - pad, r.y));

      // Leave tread marks when moving
      const speed = Math.hypot(r.vx, r.vy);
      if (speed > 25 && Math.random() < 0.4) {
        r.tracks.push({
          x: r.x - Math.cos(r.angle) * 14,
          y: r.y - Math.sin(r.angle) * 14,
          angle: r.angle,
          alpha: 0.6
        });
      }

      // Hold-to-Charge Coring Drill & Sweet Spot (72%–98%)
      if (isAction && r.overheatTimer <= 0) {
        r.isCharging = true;
        r.chargeTime += dt;
        r.mood = 'focused';

        // Charge sparks
        if (Math.random() < 0.3) {
          const sparkColor = r.chargeTime >= 0.72 && r.chargeTime <= 0.98 ? '#00E676' : '#FFD54F';
          this.particles.emit(
            r.x + Math.cos(r.angle) * 18,
            r.y + Math.sin(r.angle) * 18,
            2,
            sparkColor
          );
        }

        // Overheat blowout
        if (r.chargeTime > 1.25) {
          r.overheatTimer = 0.95;
          r.chargeTime = 0;
          r.isCharging = false;
          r.mood = 'shocked';
          this.audio.playExplosion();
          this.screenShake = 7;
          this.particles.emit(r.x, r.y, 14, '#FF3D00');
          this.announcementText = 'DRILL BLOWOUT!';
          this.announcementTimer = 0.8;
        }
      } else if (r.isCharging) {
        // Released! Evaluate charge
        const sweetSpot = (isUnderdog && r.chargeTime >= 0.50 && r.chargeTime <= 1.05) ||
                          (!isUnderdog && r.chargeTime >= 0.72 && r.chargeTime <= 0.98);

        if (sweetSpot) {
          // Hyper-Drill Kinetic Breaker!
          r.burstTimer = 1.8;
          r.score += 25;
          this.audio.playScore();
          this.screenShake = 9;
          r.mood = 'triumph';
          this.announcementText = 'HYPER-DRILL BREAKER! +25';
          this.announcementTimer = 1.0;

          // Vacuum all samples in 48px radius
          for (let s = this.samples.length - 1; s >= 0; s--) {
            const samp = this.samples[s];
            if (Math.hypot(r.x - samp.x, r.y - samp.y) < 48 && r.samplesHeld.length < 3) {
              r.samplesHeld.push(samp);
              this.samples.splice(s, 1);
              this.particles.emit(samp.x, samp.y, 8, samp.color);
            }
          }

          // Emit supersonic shockwave
          this.particles.emit(r.x, r.y, 16, '#00E676');
        } else {
          // Normal drill scoop
          r.burstTimer = 0.4;
          this.audio.playTap();
        }

        r.chargeTime = 0;
        r.isCharging = false;
      } else {
        r.mood = 'idle';
      }

      // Regular sample drilling/pickup
      const pickupRange = (isUnderdog ? 36 : 26) + (r.burstTimer > 0 ? 16 : 0);
      for (let s = this.samples.length - 1; s >= 0; s--) {
        const samp = this.samples[s];
        if (Math.hypot(r.x - samp.x, r.y - samp.y) < pickupRange && r.samplesHeld.length < 3) {
          r.samplesHeld.push(samp);
          this.samples.splice(s, 1);
          this.audio.playTap();
          this.particles.emit(samp.x, samp.y, 8, samp.color);
          break;
        }
      }

      // Habitat rocket lander delivery
      const distToRocket = Math.hypot(r.x - this.rocketLander.x, r.y - this.rocketLander.y);
      if (distToRocket < this.rocketLander.radius + 18 && r.samplesHeld.length > 0) {
        let earned = 0;
        for (const s of r.samplesHeld) {
          earned += s.value;
        }

        // Streak multiplier
        r.streakCount = Math.min(3, r.streakCount + 1);
        r.streakTimer = 2.0;
        const multiplier = r.streakCount === 3 ? 2.0 : (r.streakCount === 2 ? 1.5 : 1.0);
        const finalEarned = Math.round(earned * multiplier * (isSuddenDeath ? 2 : 1));

        r.score += finalEarned;
        r.samplesHeld = [];
        r.mood = 'triumph';
        this.audio.playScore();
        this.rocketLander.pulseTimer = 0.5;
        this.particles.emit(this.rocketLander.x, this.rocketLander.y, 18, '#FFD54F');
        this.announcementText = `DELIVERY +${finalEarned} pts! (${multiplier}x)`;
        this.announcementTimer = 1.0;
      }

      // Dust devil hazard collision (unless in underdog storm immunity or burst active)
      if (!isUnderdog && r.burstTimer <= 0) {
        for (const dd of this.dustDevils) {
          if (Math.hypot(r.x - dd.x, r.y - dd.y) < dd.radius + 16) {
            r.spinTimer = 1.2;
            r.vx = (Math.random() - 0.5) * 260;
            r.vy = (Math.random() - 0.5) * 260;
            this.audio.playExplosion();
            this.screenShake = 8;
            this.particles.emit(r.x, r.y, 12, '#D84315');
            break;
          }
        }
      }
    }

    // Physical Bumper Shunts & Sample Theft Sabotage
    const roverArray = Array.from(this.rovers.values());
    for (let i = 0; i < roverArray.length; i++) {
      for (let j = i + 1; j < roverArray.length; j++) {
        const r1 = roverArray[i];
        const r2 = roverArray[j];
        const dx = r2.x - r1.x;
        const dy = r2.y - r1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 42;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          r1.x -= nx * overlap * 0.5;
          r1.y -= ny * overlap * 0.5;
          r2.x += nx * overlap * 0.5;
          r2.y += ny * overlap * 0.5;

          const kx = r1.vx - r2.vx;
          const ky = r1.vy - r2.vy;
          const p = 2 * (nx * kx + ny * ky) / 2;

          const impulse = Math.hypot(kx, ky);
          r1.vx -= p * nx * 1.35;
          r1.vy -= p * ny * 1.35;
          r2.vx += p * nx * 1.35;
          r2.vy += p * ny * 1.35;

          if (impulse > 120 || r1.burstTimer > 0 || r2.burstTimer > 0) {
            this.audio.playBounce();
            this.screenShake = Math.min(14, impulse * 0.06 + 4);
            this.hitStopTimer = 0.04;

            const attacker = r1.burstTimer > r2.burstTimer ? r1 : (r2.burstTimer > r1.burstTimer ? r2 : null);
            if (attacker) {
              const victim = attacker === r1 ? r2 : r1;
              attacker.score += 30;
              attacker.sabotageCount++;
              victim.stunTimer = 0.6;

              // Dislodge carried sample from victim!
              if (victim.samplesHeld.length > 0) {
                const dropped = victim.samplesHeld.pop()!;
                dropped.x = victim.x + (Math.random() - 0.5) * 30;
                dropped.y = victim.y + (Math.random() - 0.5) * 30;
                this.samples.push(dropped);
              }

              this.particles.emit((r1.x + r2.x) * 0.5, (r1.y + r2.y) * 0.5, 14, '#FF1744');
              this.announcementText = 'SAMPLE PIRACY SHUNT! +30';
              this.announcementTimer = 1.0;
            }
          }
        }
      }
    }

    if (this.rocketLander.pulseTimer > 0) {
      this.rocketLander.pulseTimer -= dt;
    }
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: string, _width: number, _height: number): void {
    const timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const r = this.rovers.get(botId);
    if (!r || r.spinTimer > 0 || r.stunTimer > 0) return;

    let delay = 0.23;
    let blunderChance = 0.12;

    if (difficulty === 'bot_easy') {
      delay = 0.42;
      blunderChance = 0.22;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
      blunderChance = 0.02;
    }

    // Target Selection: Deliver to habitat when full, otherwise hunt closest high-value sample
    let targetX = this.rocketLander.x;
    let targetY = this.rocketLander.y;
    let wantDrill = false;

    if (r.samplesHeld.length >= 2) {
      targetX = this.rocketLander.x;
      targetY = this.rocketLander.y;
    } else {
      let minDist = 99999;
      let closest: SoilSample | null = null;
      for (const s of this.samples) {
        const d = Math.hypot(s.x - r.x, s.y - r.y);
        const weight = s.type === 'fossil' ? 0.6 : (s.type === 'water_ice' ? 0.8 : 1.0);
        const scoreDist = d * weight;
        if (scoreDist < minDist) {
          minDist = scoreDist;
          closest = s;
        }
      }

      if (closest) {
        targetX = closest.x;
        targetY = closest.y;
        if (Math.hypot(closest.x - r.x, closest.y - r.y) < 45) {
          wantDrill = true;
        }
      }
    }

    // Direction calculation
    const desiredAngle = Math.atan2(targetY - r.y, targetX - r.x);
    let angleDiff = desiredAngle - r.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    let steer = 0;
    if (angleDiff > 0.15) steer = 1;
    else if (angleDiff < -0.15) steer = -1;

    let throttle = Math.abs(angleDiff) < 1.2 ? 1 : 0.4;

    // Sweet-spot timing for charge
    let wantAction = wantDrill || (r.chargeTime > 0 && r.chargeTime < 0.85);
    if (r.chargeTime >= 0.78 && r.chargeTime <= 0.95) {
      wantAction = false; // Release at sweet spot!
    }

    if (Math.random() < blunderChance) {
      steer += (Math.random() - 0.5) * 0.8;
      throttle = Math.random() < 0.4 ? 0 : 1;
      wantAction = Math.random() < 0.3;
    }

    this.input.setBotInput(botId, wantAction, steer, -throttle, wantAction);
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

    // 1. Martian Terrain Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Dune Ridge Lines
    ctx.strokeStyle = theme.duneLineColor;
    ctx.lineWidth = 3;
    for (let d = 90; d < height; d += 110) {
      ctx.beginPath();
      ctx.moveTo(0, d);
      ctx.bezierCurveTo(width * 0.3, d - 25, width * 0.7, d + 25, width, d);
      ctx.stroke();
    }

    // 3. Impact Craters
    ctx.fillStyle = theme.craterColor;
    for (const c of this.craters) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x - 3, c.y - 3, c.r * 0.9, Math.PI * 0.2, Math.PI * 1.2);
      ctx.stroke();
    }

    // 4. Rover Tread Tracks
    for (const r of this.rovers.values()) {
      for (const tr of r.tracks) {
        ctx.save();
        ctx.translate(tr.x, tr.y);
        ctx.rotate(tr.angle);
        ctx.fillStyle = `rgba(0, 0, 0, ${tr.alpha * 0.4})`;
        ctx.fillRect(-4, -8, 8, 3);
        ctx.fillRect(-4, 5, 8, 3);
        ctx.restore();
      }
    }

    // 5. Central Rocket Lander / Habitat Dock
    ctx.save();
    ctx.translate(this.rocketLander.x, this.rocketLander.y);

    // Docking ring glow
    const landerPulse = this.rocketLander.pulseTimer;
    if (landerPulse > 0) {
      ctx.strokeStyle = '#FFD54F';
      ctx.lineWidth = 4;
      ctx.globalAlpha = landerPulse / 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, this.rocketLander.radius + (0.5 - landerPulse) * 45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    // Rocket Chassis base
    ctx.fillStyle = theme.habitatCoreColor;
    ctx.beginPath();
    ctx.arc(0, 0, this.rocketLander.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ECEFF1';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Rocket Pod Silhouette
    ctx.fillStyle = '#CFD8DC';
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(12, 12);
    ctx.lineTo(-12, 12);
    ctx.closePath();
    ctx.fill();

    // Rocket Red Fin Accents
    ctx.fillStyle = '#D32F2F';
    ctx.fillRect(-16, 8, 6, 8);
    ctx.fillRect(10, 8, 6, 8);

    // Habitat label
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HABITAT DOCK', 0, 26);
    ctx.restore();

    // 6. Soil Samples with Shimmer & Labels
    for (const s of this.samples) {
      ctx.save();
      ctx.translate(s.x, s.y);
      const bob = Math.sin(s.pulsePhase) * 2;

      // Glow
      ctx.fillStyle = s.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(0, bob, s.radius * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Core
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(0, bob, s.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Points label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${s.value}`, 0, bob + s.radius + 11);
      ctx.restore();
    }

    // 7. Dust Devils (Swirling Vortex)
    for (const dd of this.dustDevils) {
      ctx.save();
      ctx.translate(dd.x, dd.y);
      ctx.rotate(dd.spin);

      ctx.strokeStyle = theme.dustDevilColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, dd.radius, 0, Math.PI * 1.6);
      ctx.stroke();

      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, dd.radius * 0.65, Math.PI * 0.5, Math.PI * 2.1);
      ctx.stroke();

      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, dd.radius * 0.3, Math.PI, Math.PI * 2.8);
      ctx.stroke();
      ctx.restore();
    }

    // 8. 6-Wheel Rovers with Mascot Drivers & Pneumatic Drills
    for (const [id, r] of this.rovers.entries()) {
      ctx.save();
      ctx.translate(r.x, r.y);
      const pConfig = this.getPlayer(id);
      const color = pConfig?.color || '#EF4444';
      const isBot = pConfig ? pConfig.type !== 'human' : false;

      // Charge aura
      if (r.isCharging) {
        const pct = Math.min(1, r.chargeTime / 1.0);
        const sweetSpot = r.chargeTime >= 0.72 && r.chargeTime <= 0.98;
        ctx.strokeStyle = sweetSpot ? '#00E676' : '#FFD54F';
        ctx.lineWidth = sweetSpot ? 4 : 2;
        ctx.beginPath();
        ctx.arc(0, 0, 24 + pct * 14, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = sweetSpot ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 213, 79, 0.15)';
        ctx.beginPath();
        ctx.arc(0, 0, 24 + pct * 14, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.rotate(r.angle);

      // 6 Heavy-Duty Wheels
      ctx.fillStyle = '#212121';
      [-12, 0, 12].forEach(wx => {
        ctx.fillRect(wx - 4, -16, 8, 5);
        ctx.fillRect(wx - 4, 11, 8, 5);
      });

      // Rover Chassis
      ctx.fillStyle = color;
      ctx.fillRect(-15, -11, 30, 22);

      ctx.strokeStyle = '#ECEFF1';
      ctx.lineWidth = 2;
      ctx.strokeRect(-15, -11, 30, 22);

      // Solar Panel Roof Section
      ctx.fillStyle = '#0277BD';
      ctx.fillRect(-11, -8, 12, 16);

      // Front Pneumatic Coring Drill
      ctx.fillStyle = r.burstTimer > 0 ? '#FFD54F' : '#90A4AE';
      ctx.fillRect(15, -4, 10, 8);

      if (r.burstTimer > 0) {
        ctx.strokeStyle = '#00E676';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(25, -5);
        ctx.lineTo(34, 0);
        ctx.lineTo(25, 5);
        ctx.stroke();
      }

      // Mascot Astronaut in pressurized cockpit dome
      drawCharacter(ctx, 4, 0, 11, id, isBot, r.mood, r.animTimer, undefined);

      ctx.restore();

      // Carried Sample Icons on roof rack
      for (let i = 0; i < r.samplesHeld.length; i++) {
        ctx.save();
        ctx.translate(r.x - 10 + i * 10, r.y - 25);
        ctx.fillStyle = r.samplesHeld[i].color;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // Score Pill Above Rover
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.roundRect(r.x - 22, r.y - 42, 44, 16, 8);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${r.score}`, r.x, r.y - 30);
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
    ctx.fillText('🔴 MARS ROVER • RED DUNE DRILL 🔴', width * 0.5, badgeY + 17);
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
      const r = this.rovers.get(p.id);
      if (!r) return;

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
      ctx.fillText(`${r.score} pts`, cardX + 28, cardY + 38);
      ctx.restore();
    });

    ctx.restore();
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.rovers.entries()).map(([playerId, r]) => ({
      playerId,
      score: r.score
    }));
    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null
        ? `Player ${winnerId + 1} excavated Mars to victory with ${scores[0].score} pts!`
        : 'Martian sol concluded!'
    };
  }
}
