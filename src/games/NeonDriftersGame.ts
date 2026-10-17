import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type DriftThemeId = 'tokyo_cyber' | 'synthwave_sunset' | 'orbital_velocity';

interface DriftTheme {
  id: DriftThemeId;
  name: string;
  icon: string;
  bgTop: string;
  bgBottom: string;
  trackAsphalt: string;
  trackBorder: string;
  trackGlow: string;
  gridLine: string;
  accentColor: string;
}

const THEMES: Record<DriftThemeId, DriftTheme> = {
  tokyo_cyber: {
    id: 'tokyo_cyber',
    name: 'Neo-Tokyo Midnight',
    icon: '⚡',
    bgTop: '#070913',
    bgBottom: '#101426',
    trackAsphalt: '#151728',
    trackBorder: '#00E5FF',
    trackGlow: '#E040FB',
    gridLine: '#1E293B',
    accentColor: '#00E5FF'
  },
  synthwave_sunset: {
    id: 'synthwave_sunset',
    name: 'Synthwave Sunset Coast',
    icon: '🌅',
    bgTop: '#1C0624',
    bgBottom: '#3B0D2F',
    trackAsphalt: '#201026',
    trackBorder: '#FF007F',
    trackGlow: '#FFAA00',
    gridLine: '#4A154B',
    accentColor: '#FF007F'
  },
  orbital_velocity: {
    id: 'orbital_velocity',
    name: 'Orbital Hyper-Track',
    icon: '🚀',
    bgTop: '#05070E',
    bgBottom: '#0A1224',
    trackAsphalt: '#101A30',
    trackBorder: '#38BDF8',
    trackGlow: '#3B82F6',
    gridLine: '#1E3A5F',
    accentColor: '#38BDF8'
  }
};

const THEME_ORDER: DriftThemeId[] = ['tokyo_cyber', 'synthwave_sunset', 'orbital_velocity'];

interface Checkpoint {
  x: number;
  y: number;
  radius: number;
}

interface BoostPad {
  x: number;
  y: number;
  angle: number;
  width: number;
  height: number;
  cooldown: number;
}

interface SkidMark {
  x: number;
  y: number;
  color: string;
  alpha: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  timer: number;
  maxTimer: number;
}

interface DrifterCar {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  isDrifting: boolean;
  driftCharge: number; // 0 to 1 (blue), 1 to 2 (orange), 2 to 3 (purple ultra)
  driftTier: 0 | 1 | 2 | 3;
  driftScore: number;
  currentCheckpoint: number;
  lapsCompleted: number;
  turboTimer: number;
  spinTimer: number;
  isUnderdog: boolean;
  shoveCooldown: number;
  stuckTimer: number;
  lastPos: { x: number; y: number };
  currentMood: CharacterMood;
  animTime: number;
}

export class NeonDriftersGame extends BaseGame {
  public currentTheme: DriftThemeId = 'tokyo_cyber';
  public playersState: Map<PlayerId, DrifterCar> = new Map();

  private checkpoints: Checkpoint[] = [];
  private boostPads: BoostPad[] = [];
  private skidMarks: SkidMark[] = [];
  private floatingTexts: FloatingText[] = [];

  private totalLaps: number = 3;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private screenShake: number = 0;
  private hitStopTimer: number = 0;
  private animTimer: number = 0;

  private keydownHandler?: (e: KeyboardEvent) => void;
  private clickHandler?: (e: MouseEvent) => void;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 45.0;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (typeof window !== 'undefined') {
      this.keydownHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.cycleTheme();
        } else if (e.key === '1') {
          this.setTheme('tokyo_cyber');
        } else if (e.key === '2') {
          this.setTheme('synthwave_sunset');
        } else if (e.key === '3') {
          this.setTheme('orbital_velocity');
        }
      };
      window.addEventListener('keydown', this.keydownHandler);

      this.clickHandler = (e: MouseEvent) => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        // Theme Pill bounding box at bottom-left
        const pillX = 20;
        const pillY = canvas.height - 44;
        const pillW = 170;
        const pillH = 32;

        if (
          clickX >= pillX &&
          clickX <= pillX + pillW &&
          clickY >= pillY &&
          clickY <= pillY + pillH
        ) {
          this.cycleTheme();
        }
      };
      window.addEventListener('click', this.clickHandler);
    }
  }

  public cycleTheme(): void {
    const curIdx = THEME_ORDER.indexOf(this.currentTheme);
    const nextIdx = (curIdx + 1) % THEME_ORDER.length;
    this.setTheme(THEME_ORDER[nextIdx]);
  }

  public setTheme(theme: DriftThemeId): void {
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnSparks(105, 556, THEMES[theme].accentColor, 16);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 45.0;
    this.isFinished = false;
    this.playersState.clear();
    this.botReactionTimers.clear();
    this.skidMarks = [];
    this.floatingTexts = [];
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.animTimer = 0;

    // Grand Neon Figure-8 Circuit Checkpoints
    const cx = width / 2;
    const cy = height * 0.54;
    this.checkpoints = [
      { x: cx, y: height * 0.84, radius: 52 },
      { x: width * 0.84, y: cy + 30, radius: 56 },
      { x: width * 0.74, y: height * 0.24, radius: 52 },
      { x: cx, y: cy - 10, radius: 48 },
      { x: width * 0.26, y: height * 0.24, radius: 52 },
      { x: width * 0.16, y: cy + 30, radius: 56 }
    ];

    // Neon Nitro Boost Pads on straights
    this.boostPads = [
      { x: cx + 120, y: height * 0.84, angle: 0, width: 44, height: 26, cooldown: 0 },
      { x: width * 0.74 - 40, y: height * 0.24 - 10, angle: -Math.PI * 0.75, width: 44, height: 26, cooldown: 0 },
      { x: cx - 120, y: height * 0.84, angle: Math.PI, width: 44, height: 26, cooldown: 0 }
    ];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const offsetX = (idx - (active.length - 1) / 2) * 34;
      this.playersState.set(p.id, {
        id: p.id,
        x: cx - 80 + offsetX,
        y: height * 0.84,
        vx: 0,
        vy: 0,
        angle: 0, // facing right toward checkpoint 1
        speed: 0,
        isDrifting: false,
        driftCharge: 0,
        driftTier: 0,
        driftScore: 0,
        currentCheckpoint: 0,
        lapsCompleted: 0,
        turboTimer: 0,
        spinTimer: 0,
        isUnderdog: false,
        shoveCooldown: 0,
        stuckTimer: 0,
        lastPos: { x: cx - 80 + offsetX, y: height * 0.84 },
        currentMood: 'focused',
        animTime: 0
      });
      this.botReactionTimers.set(p.id, 0.15 + Math.random() * 0.1);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.animTimer += dt;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 14);
    }

    // Fade skid marks
    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      this.skidMarks[i].alpha -= dt * 0.35;
      if (this.skidMarks[i].alpha <= 0) {
        this.skidMarks.splice(i, 1);
      }
    }

    // Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.timer -= dt;
      ft.y -= 25 * dt;
      if (ft.timer <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Update Boost Pads cooldown
    for (const pad of this.boostPads) {
      if (pad.cooldown > 0) pad.cooldown -= dt;
    }

    // Evaluate Underdog
    this.updateUnderdogStatus();

    // Update Bots
    this.updateBots(dt, width, height);

    const isSuddenDeath = this.roundTimer <= 15.0;
    const active = this.getActivePlayers();

    for (const p of active) {
      const car = this.playersState.get(p.id);
      if (!car) continue;

      car.animTime += dt;
      if (car.turboTimer > 0) car.turboTimer -= dt;
      if (car.spinTimer > 0) car.spinTimer -= dt;
      if (car.shoveCooldown > 0) car.shoveCooldown -= dt;

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isAction = this.input.isActionPressed(p.id);
      const justReleased = !isAction && car.driftTier > 0;

      // Handle spinout
      if (car.spinTimer > 0) {
        car.angle += 12 * dt;
        car.speed *= 0.92;
        car.currentMood = 'shocked';
      } else {
        // Active Steering & Drift Mechanics
        // Holding Action enters Power Drift mode!
        const wantsDrift = isAction || (Math.abs(steer) > 0.45 && car.speed > 130);
        car.isDrifting = wantsDrift && car.speed > 90;

        const turnSpeed = car.isDrifting ? 3.9 : 2.9;
        car.angle += steer * turnSpeed * dt;

        // Acceleration / Braking
        let topSpeed = 230;
        if (car.turboTimer > 0) topSpeed = 340;
        if (car.isUnderdog) topSpeed += 35;
        if (isSuddenDeath) topSpeed += 25;

        const accelRate = car.turboTimer > 0 ? 480 : (throttle > 0.1 || isAction ? 290 : 0);

        if (throttle > 0.1 || isAction) {
          car.speed = Math.min(topSpeed, car.speed + accelRate * dt);
        } else if (throttle < -0.1) {
          // Brakes
          car.speed = Math.max(-90, car.speed - 320 * dt);
        } else {
          // Rolling resistance
          car.speed *= Math.pow(0.88, dt * 10);
        }

        // Drift Spark Charging
        if (car.isDrifting) {
          const chargeRate = car.isUnderdog ? 2.5 : 1.35;
          car.driftCharge += dt * chargeRate;
          car.driftScore += dt * 120 * (car.driftTier + 1);

          // Update drift tier
          if (car.driftCharge > 2.0) {
            car.driftTier = 3; // Purple Ultra Spark!
          } else if (car.driftCharge > 1.0) {
            car.driftTier = 2; // Orange Spark!
          } else if (car.driftCharge > 0.3) {
            car.driftTier = 1; // Blue Spark!
          }

          // Leave skid marks & sparks
          const leftWheelX = car.x - Math.cos(car.angle) * 16 + Math.sin(car.angle) * 9;
          const leftWheelY = car.y - Math.sin(car.angle) * 16 - Math.cos(car.angle) * 9;
          const rightWheelX = car.x - Math.cos(car.angle) * 16 - Math.sin(car.angle) * 9;
          const rightWheelY = car.y - Math.sin(car.angle) * 16 + Math.cos(car.angle) * 9;

          if (this.skidMarks.length < 120) {
            this.skidMarks.push({ x: leftWheelX, y: leftWheelY, color: p.color, alpha: 0.6 });
            this.skidMarks.push({ x: rightWheelX, y: rightWheelY, color: p.color, alpha: 0.6 });
          }

          const sparkColor = car.driftTier === 3 ? '#C084FC' : (car.driftTier === 2 ? '#F97316' : '#38BDF8');
          this.particles.spawnSparks(leftWheelX, leftWheelY, sparkColor, 2);
          this.particles.spawnSparks(rightWheelX, rightWheelY, sparkColor, 2);
        } else {
          // Released drift! Check for Turbo Boost release
          if ((justReleased || !isAction) && car.driftTier > 0) {
            // Turbo Boost!
            const boostDur = 0.5 + car.driftTier * 0.45;
            car.turboTimer = boostDur;
            this.screenShake = 3.5 + car.driftTier * 1.5;
            this.audio.playWhoosh();
            this.particles.spawnSparks(car.x, car.y, '#FFFFFF', 16);

            const tierNames = ['', 'TURBO BOOST! ⚡', 'SUPER BOOST! 🔥', 'ULTRA OVERDRIVE! 💥'];
            this.addFloatingText(car.x, car.y - 20, tierNames[car.driftTier], p.color);
            car.driftScore += car.driftTier * 100;
          }
          car.driftCharge = 0;
          car.driftTier = 0;
        }

        // Mood update
        if (car.turboTimer > 0) car.currentMood = 'triumph';
        else if (car.isDrifting) car.currentMood = 'focused';
        else car.currentMood = 'idle';
      }

      // Physics integration with drift slip
      const forwardX = Math.cos(car.angle) * car.speed;
      const forwardY = Math.sin(car.angle) * car.speed;
      const grip = car.isDrifting ? 0.74 : 0.93;

      car.vx = car.vx * grip + forwardX * (1 - grip);
      car.vy = car.vy * grip + forwardY * (1 - grip);

      car.x += car.vx * dt;
      car.y += car.vy * dt;

      // Arena Wall Collision
      const margin = 24;
      const topMargin = 78;
      if (car.x < margin || car.x > width - margin || car.y < topMargin || car.y > height - margin) {
        car.x = Math.max(margin, Math.min(width - margin, car.x));
        car.y = Math.max(topMargin, Math.min(height - margin, car.y));
        car.speed *= 0.65;
        this.audio.playBounce();
        this.particles.spawnSparks(car.x, car.y, '#F59E0B', 8);
      }

      // Stuck detection for AI
      const distMoved = Math.hypot(car.x - car.lastPos.x, car.y - car.lastPos.y);
      if (distMoved < 5 && Math.abs(car.speed) < 30) {
        car.stuckTimer += dt;
      } else {
        car.stuckTimer = 0;
      }
      car.lastPos.x = car.x;
      car.lastPos.y = car.y;

      // Nitro Boost Pad Triggers
      for (const pad of this.boostPads) {
        if (pad.cooldown <= 0 && Math.hypot(car.x - pad.x, car.y - pad.y) < 28) {
          pad.cooldown = 1.2;
          car.turboTimer = 1.1;
          car.speed = Math.max(car.speed, 320);
          this.audio.playWhoosh();
          this.screenShake = 4.0;
          this.particles.spawnSparks(pad.x, pad.y, THEMES[this.currentTheme].accentColor, 18);
          this.addFloatingText(car.x, car.y - 20, 'NITRO PAD! ⚡', THEMES[this.currentTheme].accentColor);
        }
      }

      // Checkpoint and Lap Tracking
      const targetCp = this.checkpoints[car.currentCheckpoint];
      const distToCp = Math.hypot(car.x - targetCp.x, car.y - targetCp.y);

      if (distToCp < targetCp.radius) {
        car.currentCheckpoint = (car.currentCheckpoint + 1) % this.checkpoints.length;
        this.particles.spawnSparks(targetCp.x, targetCp.y, p.color, 8);

        if (car.currentCheckpoint === 0) {
          // Completed a lap!
          car.lapsCompleted++;
          this.audio.playScore();
          this.particles.spawnConfetti(car.x, car.y, 25);
          this.addFloatingText(car.x, car.y - 24, `LAP ${car.lapsCompleted}/${this.totalLaps}! 🏁`, '#FFD700');

          if (car.lapsCompleted >= this.totalLaps) {
            this.audio.playFanfare();
            this.isFinished = true;
            return;
          }
        }
      }
    }

    // Inter-car Elastic Collisions & Shunts (m1*v1 + m2*v2)
    for (let i = 0; i < active.length; i++) {
      const c1 = this.playersState.get(active[i].id);
      if (!c1) continue;

      for (let j = i + 1; j < active.length; j++) {
        const c2 = this.playersState.get(active[j].id);
        if (!c2) continue;

        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 26; // car collision radius

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          // Push apart
          c1.x -= nx * overlap * 0.5;
          c1.y -= ny * overlap * 0.5;
          c2.x += nx * overlap * 0.5;
          c2.y += ny * overlap * 0.5;

          // Check for Ramming Shunts
          const relativeSpeed = Math.hypot(c1.vx - c2.vx, c1.vy - c2.vy);
          if (c1.turboTimer > 0 || c2.turboTimer > 0 || relativeSpeed > 140) {
            this.screenShake = 6.5;
            this.hitStopTimer = 0.045;
            this.audio.playExplosion();
            this.particles.spawnSparks((c1.x + c2.x) / 2, (c1.y + c2.y) / 2, '#EF4444', 20);

            if (c1.turboTimer > 0 && c2.turboTimer <= 0) {
              c2.spinTimer = 0.35;
              c2.vx += nx * 240;
              c2.vy += ny * 240;
              c1.driftScore += 120;
              this.addFloatingText(c1.x, c1.y - 20, 'RAM SHUNT! +120', '#10B981');
            } else if (c2.turboTimer > 0 && c1.turboTimer <= 0) {
              c1.spinTimer = 0.35;
              c1.vx -= nx * 240;
              c1.vy -= ny * 240;
              c2.driftScore += 120;
              this.addFloatingText(c2.x, c2.y - 20, 'RAM SHUNT! +120', '#10B981');
            } else {
              // Mutual bump
              c1.vx -= nx * 140;
              c1.vy -= ny * 140;
              c2.vx += nx * 140;
              c2.vy += ny * 140;
            }
          } else {
            // Elastic bump
            const kx = c1.vx - c2.vx;
            const ky = c1.vy - c2.vy;
            const p = 2 * (nx * kx + ny * ky) / 2;
            c1.vx -= p * nx * 0.8;
            c1.vy -= p * ny * 0.8;
            c2.vx += p * nx * 0.8;
            c2.vy += p * ny * 0.8;
            this.audio.playBounce();
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private updateUnderdogStatus(): void {
    const active = this.getActivePlayers();
    if (active.length < 2) return;

    let maxLaps = -1;
    let minLaps = Infinity;
    for (const p of active) {
      const c = this.playersState.get(p.id);
      if (!c) continue;
      if (c.lapsCompleted > maxLaps) maxLaps = c.lapsCompleted;
      if (c.lapsCompleted < minLaps) minLaps = c.lapsCompleted;
    }

    for (const p of active) {
      const c = this.playersState.get(p.id);
      if (!c) continue;
      // Trailing by >= 1 lap or substantially behind
      c.isUnderdog = maxLaps - c.lapsCompleted >= 1;
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string): void {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      timer: 1.1,
      maxTimer: 1.1
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const car = this.playersState.get(botId);
    if (!car) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    // Reaction Delays:
    // Easy: 380-450ms, blunders, wide turns
    // Normal: 220-250ms, clean drifting around hairpins
    // Hard: 90-130ms, tight racing lines, aggressive boost charging & shunts
    let delay = 0.24;
    let blunderChance = 0.0;
    if (difficulty === 'bot_easy') {
      delay = 0.40 + Math.random() * 0.08;
      blunderChance = 0.16;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11 + Math.random() * 0.04;
      blunderChance = 0.0;
    } else {
      delay = 0.23 + Math.random() * 0.05;
      blunderChance = 0.05;
    }
    this.botReactionTimers.set(botId, delay);

    // Auto-reverse if stuck against wall
    if (car.stuckTimer > 0.3) {
      this.input.setBotInput(botId, false, 0, -1.0, false);
      return;
    }

    const targetCp = this.checkpoints[car.currentCheckpoint];
    let targetX = targetCp.x;
    let targetY = targetCp.y;

    if (Math.random() < blunderChance) {
      targetX += (Math.random() - 0.5) * 50;
      targetY += (Math.random() - 0.5) * 50;
    }

    const targetAngle = Math.atan2(targetY - car.y, targetX - car.x);
    let angleDiff = targetAngle - car.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    let steer = 0;
    if (Math.abs(angleDiff) > 0.12) {
      steer = angleDiff > 0 ? 1 : -1;
    }

    // Throttle & Drift logic
    let throttle = 1.0;
    let wantsDrift = false;

    if (Math.abs(angleDiff) > 0.45 && car.speed > 110) {
      wantsDrift = true;
      if (Math.abs(angleDiff) > 1.2 && car.speed > 160) {
        throttle = 0.4; // tap brakes on extreme hairpin
      }
    }

    // Release drift boost when car aligns with checkpoint
    if (car.isDrifting && Math.abs(angleDiff) < 0.25 && car.driftTier >= 1) {
      wantsDrift = false; // releases boost!
    }

    this.input.setBotInput(botId, wantsDrift, steer, throttle, wantsDrift);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const car = this.playersState.get(p.id);
      const totalScore =
        (car?.lapsCompleted || 0) * 1000 +
        (car?.currentCheckpoint || 0) * 120 +
        Math.floor(car?.driftScore || 0);
      return {
        playerId: p.id,
        score: totalScore,
        laps: car?.lapsCompleted || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topLaps = scores[0]?.laps || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} clinched the Grand Prix victory with ${topLaps} laps (${scores[0].score} pts)!`
      : 'The midnight race finished in a smoke screen draw!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentTheme];

    // Screen Shake Offset
    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Atmosphere Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgTop);
    bgGrad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Cyberpunk Horizon Grid
    ctx.strokeStyle = theme.gridLine;
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 70);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 70; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Neon Asphalt Circuit Track
    ctx.strokeStyle = theme.trackAsphalt;
    ctx.lineWidth = 68;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    this.checkpoints.forEach((cp, idx) => {
      if (idx === 0) ctx.moveTo(cp.x, cp.y);
      else ctx.lineTo(cp.x, cp.y);
    });
    ctx.closePath();
    ctx.stroke();

    // Outer Neon Glow Rails
    ctx.strokeStyle = theme.trackBorder;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = theme.trackBorder;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner Dashed Racing Line
    ctx.strokeStyle = theme.trackGlow;
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 12]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Skid Marks
    for (const sm of this.skidMarks) {
      ctx.fillStyle = sm.color;
      ctx.globalAlpha = sm.alpha * 0.45;
      ctx.beginPath();
      ctx.arc(sm.x, sm.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // 4. Boost Pads
    for (const pad of this.boostPads) {
      this.renderBoostPad(ctx, pad, theme);
    }

    // 5. Checkpoints Markers
    for (let i = 0; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i];
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, cp.radius, 0, Math.PI * 2);
      ctx.stroke();

      if (i === 0) {
        // Start/Finish Line Banner
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 10px "Chakra Petch", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🏁 FINISH LINE', cp.x, cp.y - cp.radius - 6);
      }
    }

    // 6. Render Drifter Cars
    for (const p of this.getActivePlayers()) {
      const car = this.playersState.get(p.id);
      if (!car) continue;
      this.renderCar(ctx, car, p, theme);
    }

    // 7. Floating Texts
    for (const ft of this.floatingTexts) {
      ctx.save();
      const alpha = Math.min(1.0, ft.timer / (ft.maxTimer * 0.4));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 12px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore(); // Restore screenshake

    // 8. Safe UI & Theme Pill (strictly preserving y: 12-44 for Global Timer)
    this.renderSafeUI(ctx, width, height);
  }

  private renderBoostPad(ctx: CanvasRenderingContext2D, pad: BoostPad, theme: DriftTheme): void {
    ctx.save();
    ctx.translate(pad.x, pad.y);
    ctx.rotate(pad.angle);

    const pulse = (Math.sin(this.animTimer * 10) + 1) * 0.5;
    ctx.fillStyle = `rgba(0, 229, 255, ${0.35 + pulse * 0.35})`;
    ctx.beginPath();
    ctx.roundRect(-pad.width / 2, -pad.height / 2, pad.width, pad.height, 4);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Chevrons >>>
    ctx.fillStyle = '#FFFFFF';
    for (let x = -pad.width / 2 + 10; x <= pad.width / 2 - 10; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x - 4, -7);
      ctx.lineTo(x + 4, 0);
      ctx.lineTo(x - 4, 7);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderCar(ctx: CanvasRenderingContext2D, car: DrifterCar, p: PlayerConfig, theme: DriftTheme): void {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    // Turbo Boost Flame Exhaust
    if (car.turboTimer > 0) {
      ctx.save();
      const flameLen = 18 + Math.random() * 12;
      ctx.fillStyle = theme.accentColor;
      ctx.beginPath();
      ctx.moveTo(-16, -5);
      ctx.lineTo(-16 - flameLen, 0);
      ctx.lineTo(-16, 5);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(-16, -2.5);
      ctx.lineTo(-16 - flameLen * 0.6, 0);
      ctx.lineTo(-16, 2.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Car Chassis (Futuristic Cyber Drifter)
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.roundRect(-16, -11, 32, 22, 5);
    ctx.fill();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Racing Livery Bonnet
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.roundRect(-4, -8, 14, 16, 3);
    ctx.fill();

    // Mascot Driver Bubble Cockpit
    ctx.save();
    ctx.translate(2, 0);
    // Draw miniature mascot in driver seat
    drawCharacter(
      ctx,
      0,
      0,
      7,
      p.id,
      p.type !== 'human',
      car.currentMood,
      car.animTime,
      undefined
    );
    ctx.restore();

    // Windshield Glass Dome
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(2, 0, 7.5, 0, Math.PI * 2);
    ctx.stroke();

    // Twin Neon Headlights
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(14, -8, 3, 3);
    ctx.fillRect(14, 5, 3, 3);

    // Twin Neon Brake Lights
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(-16, -8, 2.5, 3);
    ctx.fillRect(-16, 5, 2.5, 3);

    ctx.restore(); // Restore car transform

    // Floating Over-Car HUD
    ctx.save();
    if (car.driftTier > 0) {
      const sparkColor = car.driftTier === 3 ? '#C084FC' : (car.driftTier === 2 ? '#F97316' : '#38BDF8');
      ctx.fillStyle = sparkColor;
      ctx.font = 'bold 10px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      const tierLabel = car.driftTier === 3 ? 'ULTRA SPARK! 💥' : (car.driftTier === 2 ? 'SUPER SPARK! 🔥' : 'DRIFT SPARK ⚡');
      ctx.fillText(tierLabel, car.x, car.y - 20);
    } else if (car.isUnderdog) {
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 9px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ OVERDRIVE', car.x, car.y - 18);
    }
    ctx.restore();
  }

  private renderSafeUI(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Minigame Header Badge at y: 56 (Strictly leaving y: 12-44 clear for Global Timer!)
    const isSuddenDeath = this.roundTimer <= 15.0;
    const badgeW = 280;
    const badgeH = 28;
    const badgeX = (width - badgeW) * 0.5;
    const badgeY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : '#00E5FF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#EF4444' : '#FFFFFF';
    ctx.font = 'bold 12px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const statusText = isSuddenDeath
      ? '🔥 FINAL LAP OVERDRIVE! 2X DRIFT POINTS'
      : 'HOLD ACTION TO DRIFT • RELEASE TO TURBO BOOST';
    ctx.fillText(statusText, width * 0.5, badgeY + badgeH * 0.5);

    // 2. Corner Player Status Cards (Offset to y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const car = this.playersState.get(p.id);
      let cardX = 20;
      let cardY = height - 128;

      if (idx === 0) {
        cardX = 20;
        cardY = height - 128;
      } else if (idx === 1) {
        cardX = width - 150;
        cardY = height - 128;
      } else if (idx === 2) {
        cardX = 20;
        cardY = 92;
      } else {
        cardX = width - 150;
        cardY = 92;
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 130, 52, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Mini Mascot Icon
      ctx.save();
      ctx.translate(cardX + 22, cardY + 26);
      drawCharacter(
        ctx,
        0,
        0,
        14,
        p.id,
        p.type !== 'human',
        car?.currentMood || 'idle',
        0,
        undefined
      );
      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`P${p.id + 1} (${p.type === 'human' ? 'YOU' : 'BOT'})`, cardX + 42, cardY + 7);

      ctx.fillStyle = p.color;
      ctx.font = 'bold 12px "Chakra Petch", monospace';
      ctx.fillText(`Lap ${Math.min(this.totalLaps, (car?.lapsCompleted || 0) + 1)}/${this.totalLaps}`, cardX + 42, cardY + 23);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px "Chakra Petch", monospace';
      ctx.fillText(`${Math.floor(car?.driftScore || 0)} pts`, cardX + 42, cardY + 38);
    });

    // 3. Interactive Theme Pill at bottom-left (x: 20, y: height - 44, w: 170, h: 32)
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;
    const theme = THEMES[this.currentTheme];

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px "Chakra Petch", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name.slice(0, 13)}`, pillX + 12, pillY + pillH * 0.5);

    ctx.fillStyle = theme.accentColor;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('[T]', pillX + pillW - 10, pillY + pillH * 0.5);

    // 4. Control Hints (bottom-right)
    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px "Chakra Petch", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('STEER: A/D/STICK • HOLD ACTION: DRIFT • RELEASE: BOOST', width - 20, height - 14);

    ctx.restore();
  }

  public handlePointerDown(x: number, y: number, width: number, height: number): boolean {
    if (this.isFinished) return false;
    const p1 = this.playersState.get(0);
    if (!p1 || p1.spinTimer > 0) return false;

    if (x >= 20 && x <= 190 && y >= height - 44 && y <= height - 12) {
      this.cycleTheme();
      return true;
    }

    // Steer car angle towards tap point
    const targetAngle = Math.atan2(y - p1.y, x - p1.x);
    p1.angle = targetAngle;
    p1.speed = Math.min(230, p1.speed + 120);
    this.audio.playTap();
    return true;
  }

  public syncDebug(): void {
    // Debug inspection helper
  }

  public destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) {
        window.removeEventListener('keydown', this.keydownHandler);
      }
      if (this.clickHandler) {
        window.removeEventListener('click', this.clickHandler);
      }
    }
  }
}
