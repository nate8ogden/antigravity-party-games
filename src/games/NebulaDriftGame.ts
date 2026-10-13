import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface WaypointGate {
  id: number;
  x: number;
  y: number;
  radius: number;
  pulseTimer: number;
}

interface NebulaCloud {
  x: number;
  y: number;
  radius: number;
  color: string;
}

interface DriftRacer {
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
  currentGateIdx: number;
  laps: number;

  // Nitro & Hold-to-Charge Surge
  nitro: number; // 0 to 100
  isCharging: boolean;
  chargeTime: number; // 0 to 1.2s
  isBoosting: boolean;
  boostTimer: number;
  isStalled: boolean;
  stallTimer: number;

  // Drafting & Shunting
  isDrafting: boolean;
  spinoutTimer: number;
  shuntCooldown: number;
  isUnderdog: boolean;

  // Mascot emotion & animation
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
}

interface NebulaTheme {
  id: string;
  name: string;
  icon: string;
  spaceDark: string;
  spaceLight: string;
  cloudColor1: string;
  cloudColor2: string;
  gateColor: string;
  accentColor: string;
}

const THEMES: NebulaTheme[] = [
  {
    id: 'orion_nebula',
    name: 'Orion Nebula Drift 🌌',
    icon: '🌌',
    spaceDark: '#040311',
    spaceLight: '#110C2B',
    cloudColor1: 'rgba(124, 77, 255, 0.28)',
    cloudColor2: 'rgba(0, 229, 255, 0.22)',
    gateColor: '#00E5FF',
    accentColor: '#00E5FF'
  },
  {
    id: 'crab_pulsar',
    name: 'Crab Pulsar Storm ⚡',
    icon: '⚡',
    spaceDark: '#010E12',
    spaceLight: '#05232A',
    cloudColor1: 'rgba(0, 230, 118, 0.28)',
    cloudColor2: 'rgba(0, 245, 255, 0.22)',
    gateColor: '#00E676',
    accentColor: '#00E676'
  },
  {
    id: 'solar_caldera',
    name: 'Solar Flare Caldera 🔥',
    icon: '🔥',
    spaceDark: '#120500',
    spaceLight: '#2C0D01',
    cloudColor1: 'rgba(255, 87, 34, 0.28)',
    cloudColor2: 'rgba(255, 193, 7, 0.22)',
    gateColor: '#FFD700',
    accentColor: '#FF9800'
  }
];

export class NebulaDriftGame extends BaseGame {
  public currentMapName: string = 'Orion Nebula Drift 🌌';
  private currentThemeIdx: number = 0;

  private racers: Map<PlayerId, DriftRacer> = new Map();
  private gates: WaypointGate[] = [];
  private clouds: NebulaCloud[] = [];

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
    this.racers.clear();
    this.gates = [];
    this.clouds = [];
    this.stars = [];

    // Starfield
    for (let i = 0; i < 75; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.6,
        alpha: 0.3 + Math.random() * 0.7
      });
    }

    const theme = THEMES[this.currentThemeIdx];

    // Nebula dust clouds that recharge nitro
    this.clouds = [
      { x: width * 0.28, y: height * 0.35, radius: 95, color: theme.cloudColor1 },
      { x: width * 0.72, y: height * 0.65, radius: 105, color: theme.cloudColor2 },
      { x: width * 0.50, y: height * 0.50, radius: 85, color: theme.cloudColor1 }
    ];

    // 6 Circuit Waypoint Gates
    this.gates = [
      { id: 0, x: width * 0.20, y: height * 0.25, radius: 36, pulseTimer: 0 },
      { id: 1, x: width * 0.50, y: height * 0.20, radius: 36, pulseTimer: 0.5 },
      { id: 2, x: width * 0.80, y: height * 0.28, radius: 36, pulseTimer: 1.0 },
      { id: 3, x: width * 0.80, y: height * 0.74, radius: 36, pulseTimer: 1.5 },
      { id: 4, x: width * 0.50, y: height * 0.80, radius: 36, pulseTimer: 2.0 },
      { id: 5, x: width * 0.20, y: height * 0.72, radius: 36, pulseTimer: 2.5 }
    ];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.racers.set(p.id, {
        id: p.id,
        x: width * 0.20 + (idx % 2 === 0 ? -24 : 24),
        y: height * 0.38 + Math.floor(idx / 2) * 32,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2, // Heading north to gate 0
        speed: 0,
        baseMaxSpeed: 235,
        radius: 17,
        score: 0,
        currentGateIdx: 0,
        laps: 0,

        nitro: 60,
        isCharging: false,
        chargeTime: 0,
        isBoosting: false,
        boostTimer: 0,
        isStalled: false,
        stallTimer: 0,

        isDrafting: false,
        spinoutTimer: 0,
        shuntCooldown: 0,
        isUnderdog: false,

        mood: 'idle',
        moodTimer: 0,
        animTimer: idx * 0.3
      });

      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update gates pulse
    for (const g of this.gates) {
      g.pulseTimer += dt * 3.5;
    }

    // Determine max score for Underdog
    let maxScore = 0;
    for (const r of this.racers.values()) {
      if (r.score > maxScore) maxScore = r.score;
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();

    // 1. Update Drift Racers
    for (const p of active) {
      const r = this.racers.get(p.id);
      if (!r) continue;

      r.animTimer += dt;
      if (r.moodTimer > 0) {
        r.moodTimer -= dt;
        if (r.moodTimer <= 0) r.mood = 'idle';
      }

      if (r.shuntCooldown > 0) r.shuntCooldown -= dt;

      // Underdog check: trailing by >= 35 pts
      r.isUnderdog = (maxScore - r.score >= 35);

      // Handle Spinout
      if (r.spinoutTimer > 0) {
        r.spinoutTimer -= dt;
        r.angle += 14 * dt;
        r.vx *= 0.93;
        r.vy *= 0.93;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        if (Math.random() < 0.4) {
          this.particles.emit(r.x, r.y, 2, '#FF1744');
        }
        continue;
      }

      // Check if inside nebula cloud to recharge nitro
      let inNebula = false;
      for (const cloud of this.clouds) {
        if (Math.hypot(r.x - cloud.x, r.y - cloud.y) < cloud.radius) {
          inNebula = true;
          break;
        }
      }
      const nitroRechargeRate = inNebula ? 45 : (r.isUnderdog ? 30 : 15);
      r.nitro = Math.min(100, r.nitro + nitroRechargeRate * dt);

      // Check slipstream drafting behind any forward rival
      r.isDrafting = false;
      for (const other of this.racers.values()) {
        if (other.id === r.id) continue;
        const dx = other.x - r.x;
        const dy = other.y - r.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 25 && dist < 125) {
          const angleToOther = Math.atan2(dy, dx);
          let diff = angleToOther - r.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;

          if (Math.abs(diff) < 0.55) {
            r.isDrafting = true;
            r.nitro = Math.min(100, r.nitro + 35 * dt);
            if (Math.random() < 0.3) {
              this.particles.emit((r.x + other.x) * 0.5, (r.y + other.y) * 0.5, 1, '#00E5FF');
            }
            break;
          }
        }
      }

      const steer = this.input.getSteer(r.id);
      const isActionHeld = this.input.isPressed(r.id) || this.input.isActionPressed(r.id);

      // Turning with dynamic drift carving
      if (steer !== 0) {
        const turnRate = r.isBoosting ? 3.4 : (r.isUnderdog ? 4.6 : 3.9);
        r.angle += steer * turnRate * dt;
      }

      // Hold-to-Charge Ion Nitro Boost
      if (isActionHeld && !r.isStalled && r.nitro > 10) {
        r.isCharging = true;
        const chargeRate = r.isUnderdog ? 1.4 : 1.0;
        r.chargeTime = Math.min(1.2, r.chargeTime + dt * chargeRate);
        r.mood = 'focused';

        // Cruise thrust forward while charging
        const thrust = 200;
        r.vx += Math.cos(r.angle) * thrust * dt;
        r.vy += Math.sin(r.angle) * thrust * dt;

        // Nitro exhaust sparks
        if (Math.random() < 0.5) {
          const exX = r.x - Math.cos(r.angle) * 16;
          const exY = r.y - Math.sin(r.angle) * 16;
          this.particles.emit(exX, exY, 2, '#00E5FF');
        }

        // Overheat blowout
        if (r.chargeTime >= 1.2) {
          r.isStalled = true;
          r.stallTimer = 1.0;
          r.chargeTime = 0;
          r.isCharging = false;
          r.mood = 'shocked';
          r.moodTimer = 1.0;
          this.audio.playExplosion();
          this.particles.spawnExplosion(r.x, r.y, '#FF1744', 16);
        }
      } else if (r.isCharging) {
        // Released -> Hyper-Ion Drift Burst!
        const chargeRatio = r.chargeTime / 1.0;
        r.isCharging = false;
        r.chargeTime = 0;

        const sweetMin = r.isUnderdog ? 0.50 : 0.72;
        const sweetMax = r.isUnderdog ? 1.00 : 0.98;
        const isSweet = chargeRatio >= sweetMin && chargeRatio <= sweetMax;

        if (isSweet) {
          // PERFECT SWEET SPOT: Hyper-Ion Drift Burst!
          r.isBoosting = true;
          r.boostTimer = 1.5;
          r.speed = r.baseMaxSpeed * 2.6;
          r.vx = Math.cos(r.angle) * r.speed;
          r.vy = Math.sin(r.angle) * r.speed;
          r.score += 20; // +20 Apex Drift Bonus!
          r.nitro = Math.max(0, r.nitro - 25);
          r.mood = 'triumph';
          r.moodTimer = 1.2;
          this.audio.playFanfare();
          this.particles.spawnExplosion(r.x, r.y, '#00E5FF', 16);
        } else if (chargeRatio > 0.25) {
          // Mini nitro burst
          r.isBoosting = true;
          r.boostTimer = 0.8;
          r.speed = r.baseMaxSpeed * 1.4;
          r.vx = Math.cos(r.angle) * r.speed;
          r.vy = Math.sin(r.angle) * r.speed;
          r.nitro = Math.max(0, r.nitro - 15);
          this.audio.playScore();
          this.particles.emit(r.x, r.y, 6, '#80DEEA');
        }
      } else {
        if (r.isBoosting) {
          r.boostTimer -= dt;
          if (r.boostTimer <= 0) r.isBoosting = false;
        } else {
          // Low-friction space drift decay
          const maxCruise = r.isUnderdog ? r.baseMaxSpeed * 1.25 : r.baseMaxSpeed;
          r.speed = Math.hypot(r.vx, r.vy);
          if (r.speed > maxCruise) {
            r.vx *= 0.96;
            r.vy *= 0.96;
          } else {
            // Base cruise thrust
            r.vx += Math.cos(r.angle) * 120 * dt;
            r.vy += Math.sin(r.angle) * 120 * dt;
          }
        }
      }

      // Drag
      r.vx *= Math.pow(0.975, dt * 60);
      r.vy *= Math.pow(0.975, dt * 60);
      r.x += r.vx * dt;
      r.y += r.vy * dt;

      // Arena bounds
      const margin = 24;
      if (r.x < margin) { r.x = margin; r.vx = Math.abs(r.vx) * 0.7; this.audio.playBounce(); }
      if (r.x > width - margin) { r.x = width - margin; r.vx = -Math.abs(r.vx) * 0.7; this.audio.playBounce(); }
      if (r.y < margin + 35) { r.y = margin + 35; r.vy = Math.abs(r.vy) * 0.7; this.audio.playBounce(); }
      if (r.y > height - margin) { r.y = height - margin; r.vy = -Math.abs(r.vy) * 0.7; this.audio.playBounce(); }

      // Check Gate Slalom Passing
      const targetGate = this.gates[r.currentGateIdx];
      if (Math.hypot(r.x - targetGate.x, r.y - targetGate.y) < targetGate.radius + 14) {
        const suddenDeathMult = this.roundTimer <= 12.0 ? 2 : 1;
        r.score += 30 * suddenDeathMult;
        this.audio.playScore();
        this.particles.spawnExplosion(targetGate.x, targetGate.y, THEMES[this.currentThemeIdx].gateColor, 10);

        r.currentGateIdx = (r.currentGateIdx + 1) % this.gates.length;

        // Lap completed!
        if (r.currentGateIdx === 0) {
          r.laps++;
          r.score += 60;
          r.mood = 'triumph';
          r.moodTimer = 1.5;
          this.audio.playFanfare();
          this.particles.spawnConfetti(r.x, r.y, 20);
        }
      }
    }

    // 2. Physical Shunting & Slipstream Sabotage ($m_1 v_1 + m_2 v_2$)
    const racerArray = Array.from(this.racers.values());
    for (let i = 0; i < racerArray.length; i++) {
      for (let j = i + 1; j < racerArray.length; j++) {
        const r1 = racerArray[i];
        const r2 = racerArray[j];
        if (r1.spinoutTimer > 0 || r2.spinoutTimer > 0) continue;

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

          const r1IsShunter = r1.isBoosting || Math.hypot(r1.vx, r1.vy) > Math.hypot(r2.vx, r2.vy) + 60;
          const r2IsShunter = r2.isBoosting || Math.hypot(r2.vx, r2.vy) > Math.hypot(r1.vx, r1.vy) + 60;

          if (r1IsShunter && r1.shuntCooldown <= 0) {
            r1.score += 30; // +30 Sabotage Bonus!
            r1.shuntCooldown = 1.0;
            r2.spinoutTimer = 0.8;
            r2.mood = 'shocked';
            r2.moodTimer = 1.2;
            r1.mood = 'triumph';
            r1.moodTimer = 1.2;
            this.audio.playExplosion();
            this.particles.spawnExplosion((r1.x + r2.x) * 0.5, (r1.y + r2.y) * 0.5, '#FF5252', 16);
          } else if (r2IsShunter && r2.shuntCooldown <= 0) {
            r2.score += 30;
            r2.shuntCooldown = 1.0;
            r1.spinoutTimer = 0.8;
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
    if (!r || r.spinoutTimer > 0) return;

    const targetGate = this.gates[r.currentGateIdx];
    const dx = targetGate.x - r.x;
    const dy = targetGate.y - r.y;
    const targetAngle = Math.atan2(dy, dx);

    let angleDiff = targetAngle - r.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff -= Math.PI * 2;

    let turn = 0;
    if (Math.abs(angleDiff) > 0.08) {
      turn = angleDiff > 0 ? 1 : -1;
    }

    let holdAction = false;
    if (Math.abs(angleDiff) < 0.35 && r.nitro > 25) {
      if (r.chargeTime < 0.85) {
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
      // Hard bot executes predictive sweet spot surges into rivals
      for (const other of this.racers.values()) {
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

    // 1. Deep Space Sky Gradient
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

    // 2. Swirling Nebula Dust Clouds
    for (const cloud of this.clouds) {
      ctx.save();
      const grad = ctx.createRadialGradient(cloud.x, cloud.y, cloud.radius * 0.1, cloud.x, cloud.y, cloud.radius);
      grad.addColorStop(0, cloud.color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Render Circuit Track Waypoint Gates
    for (let i = 0; i < this.gates.length; i++) {
      const g = this.gates[i];
      const pulseR = g.radius + Math.sin(g.pulseTimer) * 3;

      ctx.save();
      ctx.strokeStyle = theme.gateColor;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = theme.gateColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(g.x, g.y, pulseR, 0, Math.PI * 2);
      ctx.stroke();

      // Gate number
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, g.x, g.y + 4);
      ctx.restore();
    }

    // Circuit track dashed guideline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(this.gates[0].x, this.gates[0].y);
    for (let i = 1; i < this.gates.length; i++) {
      ctx.lineTo(this.gates[i].x, this.gates[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Render Drift Craft & Mascot Pilots
    for (const [id, r] of this.racers.entries()) {
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

      // Hyper-Ion Nitro Blast Trail
      if (r.isBoosting) {
        ctx.fillStyle = '#00E5FF';
        ctx.beginPath();
        ctx.moveTo(-14, -6);
        ctx.lineTo(-28 - Math.random() * 10, 0);
        ctx.lineTo(-14, 6);
        ctx.closePath();
        ctx.fill();
      }

      // Drift Interceptor Chassis (2.5D Sleek Hover Craft)
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-12, -12);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-12, 12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Glass Cockpit with Mascot Pilot
      ctx.save();
      ctx.rotate(Math.PI / 2);
      drawCharacter(ctx, 0, 0, 13, id, isBot, r.mood, r.animTimer, undefined);
      ctx.restore();

      // Underdog Warp-Shield Aura
      if (r.isUnderdog) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, r.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Hold-to-Charge Nitro Gauge
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

      // Floating Score & Lap Tag above craft
      ctx.fillStyle = color;
      ctx.font = 'bold 13px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${r.score} pts (L${r.laps})`, r.x, r.y - 28);

      // Nitro bar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(r.x - 18, r.y - 24, 36, 4);
      ctx.fillStyle = '#00E5FF';
      ctx.fillRect(r.x - 18, r.y - 24, (r.nitro / 100) * 36, 4);

      if (r.spinoutTimer > 0) {
        ctx.fillStyle = '#FF1744';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText('⚡ SPINOUT!', r.x, r.y - 42);
      } else if (r.isBoosting) {
        ctx.fillStyle = '#00E5FF';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText('⚡ ION BURST!', r.x, r.y - 42);
      } else if (r.isDrafting) {
        ctx.fillStyle = '#76FF03';
        ctx.font = 'bold 10px Montserrat, sans-serif';
        ctx.fillText('💨 SLIPSTREAM', r.x, r.y - 42);
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
    ctx.fillText('NEBULA DRIFT • ION CIRCUIT', width / 2, badgeY + 18);
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
      const r = this.racers.get(p.id);
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
        ? `Player ${typeof winnerId === 'number' ? winnerId + 1 : winnerId} carved the fastest inertial drift lines through the cosmic nebula!`
        : 'All drift craft stalled in the space dust!'
    };
  }
}
