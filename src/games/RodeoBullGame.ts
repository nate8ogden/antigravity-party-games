import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface RodeoCollectible {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'hat' | 'lasso' | 'belt';
  value: number;
  color: string;
  radius: number;
  pulsePhase: number;
}

interface MechanicalBullRider {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  chargeTime: number; // 0 to 1.3
  isCharging: boolean;
  overheatTimer: number;
  buckTimer: number;
  spinTimer: number;
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
}

interface VisualTheme {
  name: string;
  icon: string;
  floorGradTop: string;
  floorGradBottom: string;
  ringBorderColor: string;
  hayColor: string;
  bullChassisColor: string;
  dustColor: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Cheyenne Frontier Arena',
    icon: '🤠',
    floorGradTop: '#4E342E',
    floorGradBottom: '#27170E',
    ringBorderColor: '#8D6E63',
    hayColor: '#FFD54F',
    bullChassisColor: '#3E2723',
    dustColor: 'rgba(215, 204, 200, 0.45)'
  },
  {
    name: 'Neon Cyber Rodeo',
    icon: '⚡',
    floorGradTop: '#0D1B2A',
    floorGradBottom: '#050A10',
    ringBorderColor: '#00E5FF',
    hayColor: '#D500F9',
    bullChassisColor: '#1E293B',
    dustColor: 'rgba(0, 229, 255, 0.35)'
  },
  {
    name: 'Midnight Mud Pit',
    icon: '🌙',
    floorGradTop: '#1C1917',
    floorGradBottom: '#0C0A09',
    ringBorderColor: '#44403C',
    hayColor: '#78716C',
    bullChassisColor: '#292524',
    dustColor: 'rgba(120, 113, 108, 0.45)'
  }
];

export class RodeoBullGame extends BaseGame {
  private riders: Map<PlayerId, MechanicalBullRider> = new Map();
  private items: RodeoCollectible[] = [];
  private nextItemId = 1;
  private spawnTimer = 0;
  private currentThemeIndex = 0;
  private screenShake = 0;
  private hitStopTimer = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private announcementText = '';
  private announcementTimer = 0;

  // Central Rotating Padded Sweep Arm
  private sweepArm = {
    angle: 0,
    speed: 1.1,
    length: 120
  };

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
    this.riders.clear();
    this.items = [];
    this.nextItemId = 1;
    this.spawnTimer = 0.5;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.announcementText = '';
    this.announcementTimer = 0;

    this.sweepArm = {
      angle: 0,
      speed: 1.1,
      length: Math.min(width, height) * 0.24
    };

    // Seed initial items
    for (let i = 0; i < 12; i++) {
      this.spawnItem(width, height);
    }

    const active = this.getActivePlayers();
    const spawnPositions = [
      { x: width * 0.28, y: height * 0.3, angle: Math.PI * 0.25 },
      { x: width * 0.72, y: height * 0.3, angle: Math.PI * 0.75 },
      { x: width * 0.28, y: height * 0.7, angle: -Math.PI * 0.25 },
      { x: width * 0.72, y: height * 0.7, angle: -Math.PI * 0.75 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnPositions[idx % spawnPositions.length];
      this.riders.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: pos.angle,
        score: 0,
        chargeTime: 0,
        isCharging: false,
        overheatTimer: 0,
        buckTimer: 0,
        spinTimer: 0,
        stunTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: idx * 0.5,
        sabotageCount: 0
      });
    });
  }

  private spawnItem(width: number, height: number): void {
    const rand = Math.random();
    let type: 'hat' | 'lasso' | 'belt' = 'hat';
    let value = 20;
    let color = '#FFB300';
    let radius = 10;

    if (rand < 0.55) {
      type = 'hat';
      value = 20;
      color = '#FFB300';
      radius = 10;
    } else if (rand < 0.85) {
      type = 'lasso';
      value = 40;
      color = '#00E5FF';
      radius = 13;
    } else {
      type = 'belt';
      value = 75;
      color = '#FFD54F';
      radius = 16;
    }

    const ang = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * (Math.min(width, height) * 0.35 - 60);

    this.items.push({
      id: this.nextItemId++,
      x: width * 0.5 + Math.cos(ang) * dist,
      y: height * 0.5 + Math.sin(ang) * dist,
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

    // Sudden death acceleration (<= 12s)
    const isSuddenDeath = this.roundTimer <= 12.0;
    this.sweepArm.speed = isSuddenDeath ? 1.9 : 1.1;
    this.sweepArm.angle += this.sweepArm.speed * dt;

    // Replenish items
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.items.length < 12) {
      this.spawnItem(width, height);
      this.spawnTimer = 0.8 + Math.random() * 0.6;
    }

    // Update items
    for (const item of this.items) {
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.pulsePhase += dt * 3.5;

      const cx = width * 0.5;
      const cy = height * 0.5;
      const d = Math.hypot(item.x - cx, item.y - cy);
      const ringR = Math.min(width, height) * 0.42;

      if (d > ringR) {
        const nx = (item.x - cx) / d;
        const ny = (item.y - cy) / d;
        item.vx = -nx * Math.abs(item.vx);
        item.vy = -ny * Math.abs(item.vy);
      }
    }

    // Leader / Underdog calculation
    let topScore = -1;
    for (const r of this.riders.values()) {
      if (r.score > topScore) topScore = r.score;
    }

    // Update Riders
    for (const [id, r] of this.riders.entries()) {
      r.animTimer += dt;
      const isUnderdog = topScore >= 35 && r.score <= topScore - 30;

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

      if (r.buckTimer > 0) {
        r.buckTimer -= dt;
      }

      if (r.streakTimer > 0) {
        r.streakTimer -= dt;
        if (r.streakTimer <= 0) {
          r.streakCount = 0;
        }
      }

      const steerX = this.input.getSteer(id);
      const throttleY = -this.input.getThrottle(id);
      const isAction = this.input.isActionPressed(id) || this.input.isPressed(id);

      // Bull handling movement
      const speedMult = (isUnderdog ? 1.25 : 1.0) * (r.buckTimer > 0 ? 1.4 : 1.0);
      const accel = 440 * speedMult;
      r.vx += steerX * accel * dt;
      r.vy += throttleY * accel * dt;

      // Arena dirt friction
      r.vx *= Math.pow(0.90, dt * 60);
      r.vy *= Math.pow(0.90, dt * 60);

      r.x += r.vx * dt;
      r.y += r.vy * dt;

      // Keep within circular arena boundary
      const cx = width * 0.5;
      const cy = height * 0.5;
      const distFromCenter = Math.hypot(r.x - cx, r.y - cy);
      const ringRadius = Math.min(width, height) * 0.42;

      if (distFromCenter > ringRadius && distFromCenter > 0.001) {
        const nx = (r.x - cx) / distFromCenter;
        const ny = (r.y - cy) / distFromCenter;
        r.x = cx + nx * ringRadius;
        r.y = cy + ny * ringRadius;
        r.vx *= -0.7;
        r.vy *= -0.7;
        this.audio.playBounce();
      }

      // Heading
      if (Math.hypot(r.vx, r.vy) > 18) {
        r.angle = Math.atan2(r.vy, r.vx);
      }

      // Hold-to-Charge Bucking Kick & Sweet Spot (72%–98%)
      if (isAction && r.overheatTimer <= 0) {
        r.isCharging = true;
        r.chargeTime += dt;
        r.mood = 'focused';

        // Charge sparks
        if (Math.random() < 0.35) {
          const sparkColor = r.chargeTime >= 0.72 && r.chargeTime <= 0.98 ? '#00E676' : '#FFB300';
          this.particles.emit(
            r.x + Math.cos(r.angle) * 16,
            r.y + Math.sin(r.angle) * 16,
            2,
            sparkColor
          );
        }

        // Blowout if held too long
        if (r.chargeTime > 1.25) {
          r.overheatTimer = 0.95;
          r.chargeTime = 0;
          r.isCharging = false;
          r.mood = 'shocked';
          this.audio.playExplosion();
          this.screenShake = 6;
          this.particles.emit(r.x, r.y, 14, '#FF3D00');
          this.announcementText = 'HYDRAULIC BLOWOUT!';
          this.announcementTimer = 0.8;
        }
      } else if (r.isCharging) {
        // Released! Evaluate charge
        const sweetSpot = (isUnderdog && r.chargeTime >= 0.50 && r.chargeTime <= 1.05) ||
                          (!isUnderdog && r.chargeTime >= 0.72 && r.chargeTime <= 0.98);

        if (sweetSpot) {
          // Mega-Bucking Bronc Charge!
          r.buckTimer = 1.3;
          r.score += 25;
          r.mood = 'triumph';
          this.audio.playScore();
          this.screenShake = 9;
          this.announcementText = 'MEGA-BUCKING BRONC! +25';
          this.announcementTimer = 1.0;

          // Lunge forward
          r.vx += Math.cos(r.angle) * 440;
          r.vy += Math.sin(r.angle) * 440;

          this.particles.emit(r.x, r.y, 18, '#00E676');
        } else {
          // Normal buck
          r.buckTimer = 0.35;
          this.audio.playTap();
          r.vx += Math.cos(r.angle) * 180;
          r.vy += Math.sin(r.angle) * 180;
        }

        r.chargeTime = 0;
        r.isCharging = false;
      } else {
        r.mood = 'idle';
      }

      // Central Sweep Arm Collision (Unless jumping/bucking or Underdog)
      if (!isUnderdog && r.buckTimer <= 0) {
        const armTipX = cx + Math.cos(this.sweepArm.angle) * this.sweepArm.length;
        const armTipY = cy + Math.sin(this.sweepArm.angle) * this.sweepArm.length;

        // Distance from point to line segment
        const d = this.distToSegment(r.x, r.y, cx, cy, armTipX, armTipY);
        if (d < 24) {
          r.spinTimer = 1.1;
          r.score = Math.max(0, r.score - 10);
          this.audio.playBounce();
          this.screenShake = 8;
          this.particles.emit(r.x, r.y, 12, '#EF4444');
          this.announcementText = 'SWEEP KNOCKOUT!';
          this.announcementTimer = 0.8;
        }
      }

      // Item pickup
      const pickupRange = (isUnderdog ? 34 : 26) + (r.buckTimer > 0 ? 18 : 0);
      for (let i = this.items.length - 1; i >= 0; i--) {
        const item = this.items[i];
        if (Math.hypot(r.x - item.x, r.y - item.y) < pickupRange + item.radius) {
          const earned = item.value * (isSuddenDeath ? 2 : 1);
          r.score += earned;
          r.streakCount = Math.min(3, r.streakCount + 1);
          r.streakTimer = 2.0;
          this.audio.playScore();
          this.particles.emit(item.x, item.y, 12, item.color);
          this.items.splice(i, 1);
          r.mood = 'triumph';
          break;
        }
      }
    }

    // Physical Bull Bumping & Horn-Locking Sabotage
    const riderArray = Array.from(this.riders.values());
    for (let i = 0; i < riderArray.length; i++) {
      for (let j = i + 1; j < riderArray.length; j++) {
        const r1 = riderArray[i];
        const r2 = riderArray[j];
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

          if (impulse > 120 || r1.buckTimer > 0 || r2.buckTimer > 0) {
            this.audio.playBounce();
            this.screenShake = Math.min(14, impulse * 0.06 + 4);
            this.hitStopTimer = 0.04;

            const attacker = r1.buckTimer > r2.buckTimer ? r1 : (r2.buckTimer > r1.buckTimer ? r2 : null);
            if (attacker) {
              const victim = attacker === r1 ? r2 : r1;
              attacker.score += 30;
              attacker.sabotageCount++;
              victim.stunTimer = 0.65;
              victim.score = Math.max(0, victim.score - 10);
              this.particles.emit((r1.x + r2.x) * 0.5, (r1.y + r2.y) * 0.5, 14, '#FF1744');
              this.announcementText = 'BULL HORN SHUNT! +30';
              this.announcementTimer = 1.0;
            }
          }
        }
      }
    }
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: string, width: number, height: number): void {
    const timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const r = this.riders.get(botId);
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

    // Target Selection: Nearest high-value collectible, dodging sweep arm
    let targetX = width * 0.5;
    let targetY = height * 0.5;
    let minDist = 99999;
    let closest: RodeoCollectible | null = null;

    for (const item of this.items) {
      const d = Math.hypot(item.x - r.x, item.y - r.y);
      const weight = item.type === 'belt' ? 0.6 : (item.type === 'lasso' ? 0.8 : 1.0);
      const scoreDist = d * weight;
      if (scoreDist < minDist) {
        minDist = scoreDist;
        closest = item;
      }
    }

    if (closest) {
      targetX = closest.x;
      targetY = closest.y;
    }

    // Avoid sweep arm
    const cx = width * 0.5;
    const cy = height * 0.5;
    const armTipX = cx + Math.cos(this.sweepArm.angle) * this.sweepArm.length;
    const armTipY = cy + Math.sin(this.sweepArm.angle) * this.sweepArm.length;
    const dArm = this.distToSegment(r.x, r.y, cx, cy, armTipX, armTipY);
    let wantBuck = false;

    if (dArm < 50) {
      wantBuck = true; // buck over the sweep arm
    }

    const dx = targetX - r.x;
    const dy = targetY - r.y;
    let steerX = 0;
    let throttleY = 0;

    if (Math.hypot(dx, dy) > 20) {
      steerX = Math.max(-1, Math.min(1, dx / 80));
      throttleY = Math.max(-1, Math.min(1, dy / 80));
    }

    // Sweet-spot timing
    let wantAction = wantBuck || (r.chargeTime > 0 && r.chargeTime < 0.85);
    if (r.chargeTime >= 0.78 && r.chargeTime <= 0.95) {
      wantAction = false;
    }

    if (Math.random() < blunderChance) {
      steerX += (Math.random() - 0.5) * 0.7;
      throttleY += (Math.random() - 0.5) * 0.7;
      wantAction = Math.random() < 0.3;
    }

    this.input.setBotInput(botId, wantAction, steerX, -throttleY, wantAction);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIndex];
    const cx = width * 0.5;
    const cy = height * 0.5;
    const ringR = Math.min(width, height) * 0.42;

    ctx.save();
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

    // 1. Rodeo Dirt Arena Radial Gradient
    const arenaGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, ringR);
    arenaGrad.addColorStop(0, theme.floorGradTop);
    arenaGrad.addColorStop(1, theme.floorGradBottom);
    ctx.fillStyle = arenaGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Circular Arena Fence Wall
    ctx.strokeStyle = theme.ringBorderColor;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Central Sweep Arm Turret & Arm
    ctx.save();
    ctx.translate(cx, cy);

    // Turret base
    ctx.fillStyle = '#263238';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ECEFF1';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Rotating Padded Sweep Arm
    ctx.rotate(this.sweepArm.angle);
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(0, -8, this.sweepArm.length, 16);

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, -8, this.sweepArm.length, 16);

    // Padded end bumper
    ctx.fillStyle = '#FFD54F';
    ctx.beginPath();
    ctx.arc(this.sweepArm.length, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 4. Rodeo Items (Hats, Lassos, Belts)
    for (const item of this.items) {
      ctx.save();
      ctx.translate(item.x, item.y);
      const bob = Math.sin(item.pulsePhase) * 2.5;

      // Glow
      ctx.fillStyle = item.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(0, bob, item.radius * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Core
      if (item.type === 'hat') {
        ctx.fillStyle = '#FFB300';
        ctx.beginPath();
        ctx.ellipse(0, bob, item.radius * 1.2, item.radius * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.type === 'lasso') {
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, bob, item.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Championship Belt Buckle
        ctx.fillStyle = '#FFD54F';
        ctx.fillRect(-item.radius, bob - item.radius * 0.6, item.radius * 2, item.radius * 1.2);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-item.radius, bob - item.radius * 0.6, item.radius * 2, item.radius * 1.2);
      }

      // Value label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${item.value}`, 0, bob + item.radius + 11);
      ctx.restore();
    }

    // 5. Mechanical Bulls with Mascot Riders
    for (const [id, r] of this.riders.entries()) {
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

      // Bucking trail
      if (r.buckTimer > 0) {
        ctx.strokeStyle = '#00E676';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.rotate(r.angle);

      // Mechanical Bull Body
      ctx.fillStyle = theme.bullChassisColor;
      ctx.fillRect(-18, -12, 36, 24);

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-18, -12, 36, 24);

      // Bull Horns
      ctx.strokeStyle = '#ECEFF1';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(14, -12);
      ctx.lineTo(24, -20);
      ctx.moveTo(14, 12);
      ctx.lineTo(24, 20);
      ctx.stroke();

      // Mascot Cowboy in saddle
      drawCharacter(ctx, -2, 0, 10, id, isBot, r.mood, r.animTimer, undefined);

      ctx.restore();

      // Score Pill Above Bull
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.roundRect(r.x - 22, r.y - 38, 44, 16, 8);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${r.score}`, r.x, r.y - 26);
    }

    // 6. Central Announcement Banner
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

    // 7. UI Header Badge (y: 56, h: 28)
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
    ctx.fillText('🐂 RODEO BULL • BRONCO SHOWDOWN 🐂', width * 0.5, badgeY + 17);
    ctx.restore();

    // 8. Theme Pill (Bottom-Left: x: 20, y: height - 44, w: 170, h: 32)
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

    // 9. Corner Player Cards (y: height - 128, 130x48px)
    const cardW = 130;
    const cardH = 48;
    const cardY = height - 128;
    const active = this.getActivePlayers();

    active.forEach((p, idx) => {
      const r = this.riders.get(p.id);
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
    const scores = Array.from(this.riders.entries()).map(([playerId, r]) => ({
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
        ? `${this.getPlayer(winnerId)?.name} rode the bucking bronco to victory with ${scores[0].score} pts!`
        : 'The rodeo showdown concluded!'
    };
  }
}
