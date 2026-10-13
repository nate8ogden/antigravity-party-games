import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface DroneTarget {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'scout' | 'hexacopter' | 'apex_mother';
  value: number;
  radius: number;
  pulsePhase: number;
  active: boolean;
}

interface HoverPilot {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  chargeTime: number; // 0 to 1.3s
  isCharging: boolean;
  overheatTimer: number; // Capacitor short-circuit
  empShieldTimer: number; // Overdrive pulse boost
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
  isUnderdog: boolean;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  arenaFloor: string;
  arenaBorder: string;
  gridLine: string;
  empColor: string;
  empGlow: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Cyber Proving Grounds',
    icon: '⚡',
    bgGradTop: '#090D1F',
    bgGradBottom: '#02040A',
    arenaFloor: '#0F172A',
    arenaBorder: '#38BDF8',
    gridLine: 'rgba(56, 189, 248, 0.2)',
    empColor: '#06B6D4',
    empGlow: 'rgba(6, 182, 212, 0.45)'
  },
  {
    name: 'Desert Testing Facility',
    icon: '🏜️',
    bgGradTop: '#2A1805',
    bgGradBottom: '#0D0600',
    arenaFloor: '#451A03',
    arenaBorder: '#F59E0B',
    gridLine: 'rgba(245, 158, 11, 0.2)',
    empColor: '#FBBF24',
    empGlow: 'rgba(251, 191, 36, 0.45)'
  },
  {
    name: 'Orbital Satellite Deck',
    icon: '🛰️',
    bgGradTop: '#1E1B4B',
    bgGradBottom: '#05021A',
    arenaFloor: '#1E293B',
    arenaBorder: '#818CF8',
    gridLine: 'rgba(129, 140, 248, 0.2)',
    empColor: '#A855F7',
    empGlow: 'rgba(168, 85, 247, 0.45)'
  }
];

export class DroneInterceptGame extends BaseGame {
  private pilots: Map<PlayerId, HoverPilot> = new Map();
  private drones: DroneTarget[] = [];
  private nextDroneId = 1;
  private droneSpawnTimer = 0;

  private currentThemeIndex = 0;
  private screenShake = 0;
  private hitStopTimer = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private announcementText = '';
  private announcementTimer = 0;

  private keydownHandler?: (e: KeyboardEvent) => void;
  private clickHandler?: (e: MouseEvent) => void;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;

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
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const canvasHeight = canvas.height;
      if (mouseX >= 20 && mouseX <= 190 && mouseY >= canvasHeight - 44 && mouseY <= canvasHeight - 12) {
        this.cycleTheme();
      }
    };
    window.addEventListener('click', this.clickHandler);
  }

  private cycleTheme(): void {
    this.currentThemeIndex = (this.currentThemeIndex + 1) % THEMES.length;
    this.audio.playTap();
    this.triggerAnnouncement(`THEME: ${THEMES[this.currentThemeIndex].name}`);
  }

  private setTheme(index: number): void {
    if (index >= 0 && index < THEMES.length) {
      this.currentThemeIndex = index;
      this.audio.playTap();
      this.triggerAnnouncement(`THEME: ${THEMES[this.currentThemeIndex].name}`);
    }
  }

  private triggerAnnouncement(msg: string, duration: number = 1.6): void {
    this.announcementText = msg;
    this.announcementTimer = duration;
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.drones = [];
    this.nextDroneId = 1;
    this.droneSpawnTimer = 0;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.announcementText = '';
    this.announcementTimer = 0;

    const active = this.getActivePlayers();
    this.pilots.clear();
    this.botReactionTimers.clear();

    const cx = width / 2;
    const cy = height / 2;
    const spawnDist = Math.min(width, height) * 0.35;

    active.forEach((p, idx) => {
      const angle = (idx / active.length) * Math.PI * 2 - Math.PI / 2;
      this.pilots.set(p.id, {
        id: p.id,
        x: cx + Math.cos(angle) * spawnDist,
        y: cy + Math.sin(angle) * spawnDist,
        vx: 0,
        vy: 0,
        angle: angle + Math.PI,
        score: 0,
        chargeTime: 0,
        isCharging: false,
        overheatTimer: 0,
        empShieldTimer: 0,
        stunTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: 0,
        sabotageCount: 0,
        isUnderdog: false
      });
      this.botReactionTimers.set(p.id, 0);
    });

    // Seed initial drones
    for (let i = 0; i < 7; i++) {
      this.spawnDrone(width, height);
    }
  }

  private spawnDrone(width: number, height: number): void {
    const marginX = 80;
    const minY = 100;
    const maxY = height - 120;

    const x = marginX + Math.random() * (width - marginX * 2);
    const y = minY + Math.random() * (maxY - minY);

    const roll = Math.random();
    let type: 'scout' | 'hexacopter' | 'apex_mother' = 'scout';
    let value = 20;
    let radius = 13;
    let speed = 90 + Math.random() * 50;

    if (this.roundTimer <= 12) {
      if (roll < 0.35) {
        type = 'apex_mother';
        value = 75;
        radius = 20;
        speed = 70;
      } else if (roll < 0.70) {
        type = 'hexacopter';
        value = 45;
        radius = 16;
        speed = 100;
      }
    } else {
      if (roll < 0.15) {
        type = 'apex_mother';
        value = 75;
        radius = 20;
        speed = 70;
      } else if (roll < 0.45) {
        type = 'hexacopter';
        value = 45;
        radius = 16;
        speed = 100;
      }
    }

    const ang = Math.random() * Math.PI * 2;
    this.drones.push({
      id: this.nextDroneId++,
      x,
      y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      type,
      value,
      radius,
      pulsePhase: Math.random() * Math.PI * 2,
      active: true
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

    if (this.announcementTimer > 0) {
      this.announcementTimer -= dt;
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 30);
    }

    const isSuddenDeath = this.roundTimer <= 12.0;

    // Leader score check for Underdog Surge
    let highestScore = 0;
    for (const p of this.pilots.values()) {
      if (p.score > highestScore) highestScore = p.score;
    }
    for (const p of this.pilots.values()) {
      p.isUnderdog = (highestScore - p.score) >= 35 && highestScore > 30;
    }

    // Spawn drones periodically
    this.droneSpawnTimer += dt;
    const spawnInterval = isSuddenDeath ? 0.7 : 1.3;
    const maxDrones = isSuddenDeath ? 12 : 9;
    if (this.droneSpawnTimer >= spawnInterval && this.drones.filter(d => d.active).length < maxDrones) {
      this.droneSpawnTimer = 0;
      this.spawnDrone(width, height);
    }

    // Update active drones
    for (const drone of this.drones) {
      if (!drone.active) continue;
      drone.pulsePhase += dt * 3.5;
      drone.x += drone.vx * dt;
      drone.y += drone.vy * dt;

      // Bounce within bounds
      if (drone.x < 60) { drone.x = 60; drone.vx = -drone.vx; }
      if (drone.x > width - 60) { drone.x = width - 60; drone.vx = -drone.vx; }
      if (drone.y < 90) { drone.y = 90; drone.vy = -drone.vy; }
      if (drone.y > height - 100) { drone.y = height - 100; drone.vy = -drone.vy; }
    }

    this.updateBots(dt, width, height);

    // Update Pilots
    for (const p of this.pilots.values()) {
      p.animTimer += dt;

      if (p.streakTimer > 0) {
        p.streakTimer -= dt;
        if (p.streakTimer <= 0) {
          p.streakCount = 0;
        }
      }

      if (p.overheatTimer > 0) {
        p.overheatTimer -= dt;
        p.mood = 'shocked';
        p.vx *= Math.pow(0.05, dt);
        p.vy *= Math.pow(0.05, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        continue;
      }

      if (p.stunTimer > 0) {
        p.stunTimer -= dt;
        p.mood = 'shocked';
        p.vx *= Math.pow(0.1, dt);
        p.vy *= Math.pow(0.1, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        continue;
      }

      if (p.empShieldTimer > 0) {
        p.empShieldTimer -= dt;
      }

      // Input reading
      const steerX = this.input.getSteer(p.id);
      const throttleY = -this.input.getThrottle(p.id);
      const actionHeld = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      // Movement physics
      let baseSpeed = p.isUnderdog ? 295 : 245;
      if (p.empShieldTimer > 0) baseSpeed *= 1.40;
      const speed = p.isCharging ? baseSpeed * 0.45 : baseSpeed;

      if (Math.hypot(steerX, throttleY) > 0.15) {
        const moveAng = Math.atan2(throttleY, steerX);
        p.angle = moveAng;
        p.vx += Math.cos(moveAng) * speed * 7.5 * dt;
        p.vy += Math.sin(moveAng) * speed * 7.5 * dt;
      }

      // Kinematic damping
      const damping = Math.pow(0.04, dt);
      p.vx *= damping;
      p.vy *= damping;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Arena boundaries
      const minX = 40;
      const maxX = width - 40;
      const minY = 80;
      const maxY = height - 90;

      if (p.x < minX) { p.x = minX; p.vx = -p.vx * 0.4; }
      if (p.x > maxX) { p.x = maxX; p.vx = -p.vx * 0.4; }
      if (p.y < minY) { p.y = minY; p.vy = -p.vy * 0.4; }
      if (p.y > maxY) { p.y = maxY; p.vy = -p.vy * 0.4; }

      // Action Charging: Microwave EMP Blaster Sweet Spot
      if (actionHeld) {
        p.isCharging = true;
        p.chargeTime += dt;
        p.mood = 'focused';

        // Overcharge penalty (> 1.25s)
        if (p.chargeTime >= 1.25) {
          p.chargeTime = 0;
          p.isCharging = false;
          p.overheatTimer = 0.85;
          p.score = Math.max(0, p.score - 5);
          this.audio.playExplosion();
          this.screenShake = 12;
          this.particles.emit(p.x, p.y, 25, '#EF4444');
          this.triggerAnnouncement(`${this.getPlayer(p.id)?.name || 'PILOT'} EMP CAPACITOR SHORT!`, 1.2);
          continue;
        }
      } else if (p.isCharging) {
        // Evaluate Sweet Spot
        const chargeRatio = p.chargeTime / 1.0;
        const sweetSpotMin = p.isUnderdog ? 0.50 : 0.72;
        const sweetSpotMax = p.isUnderdog ? 1.05 : 0.98;

        if (chargeRatio >= sweetSpotMin && chargeRatio <= sweetSpotMax) {
          // SWEET SPOT: Ultrasonic Microwave EMP Shockwave!
          p.empShieldTimer = 1.6;
          p.mood = 'triumph';
          p.score += 25; // EMP Ace Bonus!
          this.audio.playScore();
          this.screenShake = 14;

          this.particles.emit(p.x, p.y, 35, '#06B6D4');
          this.particles.emit(p.x, p.y, 20, '#F59E0B');

          // Supersonic surge
          p.vx += Math.cos(p.angle) * 360;
          p.vy += Math.sin(p.angle) * 360;

          // Fry all drones within 140px
          const blastRadius = p.isUnderdog ? 190 : 140;
          let friedCount = 0;
          for (const d of this.drones) {
            if (!d.active) continue;
            const dist = Math.hypot(d.x - p.x, d.y - p.y);
            if (dist <= blastRadius) {
              d.active = false;
              friedCount++;
              const pts = (isSuddenDeath ? d.value * 2 : d.value);
              p.score += pts;
              this.particles.emit(d.x, d.y, 16, '#EF4444');
            }
          }

          if (friedCount > 0) {
            this.audio.playBounce();
            this.triggerAnnouncement(`${this.getPlayer(p.id)?.name || 'PILOT'} EMP SHOCKWAVE FRIED ${friedCount} DRONES!`, 1.4);
          } else {
            this.triggerAnnouncement(`${this.getPlayer(p.id)?.name || 'PILOT'} CAPACITOR DISCHARGE!`, 1.2);
          }

          // Stun nearby rivals with EMP shock
          for (const other of this.pilots.values()) {
            if (other.id === p.id) continue;
            const dist = Math.hypot(other.x - p.x, other.y - p.y);
            if (dist <= 110 && other.empShieldTimer <= 0) {
              other.stunTimer = 0.75;
              other.mood = 'shocked';
              const pushAng = Math.atan2(other.y - p.y, other.x - p.x);
              other.vx += Math.cos(pushAng) * 280;
              other.vy += Math.sin(pushAng) * 280;
              this.particles.emit(other.x, other.y, 16, '#06B6D4');
            }
          }
        } else {
          // Minor pulse
          p.vx += Math.cos(p.angle) * 160;
          p.vy += Math.sin(p.angle) * 160;
          this.audio.playTap();
          this.particles.emit(p.x, p.y, 12, '#06B6D4');
        }

        p.chargeTime = 0;
        p.isCharging = false;
      } else {
        p.mood = 'idle';
      }

      // Check Drone Proximity Collision (Direct Intercept)
      const grabRadius = p.isUnderdog ? 38 : 28;
      for (const d of this.drones) {
        if (!d.active) continue;
        const dist = Math.hypot(d.x - p.x, d.y - p.y);
        if (dist <= grabRadius + d.radius) {
          d.active = false;
          p.streakCount++;
          p.streakTimer = 2.8;

          let multiplier = 1.0;
          if (p.streakCount >= 4) multiplier = 2.5;
          else if (p.streakCount >= 3) multiplier = 2.0;
          else if (p.streakCount >= 2) multiplier = 1.5;

          const pts = Math.round((isSuddenDeath ? d.value * 2 : d.value) * multiplier);
          p.score += pts;

          this.audio.playTap();
          const col = d.type === 'apex_mother' ? '#F59E0B' : (d.type === 'hexacopter' ? '#8B5CF6' : '#EF4444');
          this.particles.emit(d.x, d.y, 18, col);

          if (d.type === 'apex_mother') {
            this.audio.playScore();
            this.triggerAnnouncement(`APEX MOTHER DRONE DOWN! +${pts} PTS!`, 1.5);
          }
        }
      }
    }

    // Physical Hovercraft-to-Hovercraft Collision & EMP Shunts
    const pilotArr = Array.from(this.pilots.values());
    for (let i = 0; i < pilotArr.length; i++) {
      for (let j = i + 1; j < pilotArr.length; j++) {
        const p1 = pilotArr[i];
        const p2 = pilotArr[j];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 40;

        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;

          const overlap = minDist - dist;
          p1.x -= nx * overlap * 0.5;
          p1.y -= ny * overlap * 0.5;
          p2.x += nx * overlap * 0.5;
          p2.y += ny * overlap * 0.5;

          const rvx = p2.vx - p1.vx;
          const rvy = p2.vy - p1.vy;
          const velAlongNorm = rvx * nx + rvy * ny;

          if (velAlongNorm < 0) {
            const restitution = 1.45;
            const impulse = -(1 + restitution) * velAlongNorm * 0.5;

            p1.vx -= nx * impulse;
            p1.vy -= ny * impulse;
            p2.vx += nx * impulse;
            p2.vy += ny * impulse;

            this.audio.playBounce();

            const speed1 = Math.hypot(p1.vx, p1.vy);
            const speed2 = Math.hypot(p2.vx, p2.vy);

            if (speed1 > speed2 + 80 || p1.empShieldTimer > 0) {
              p1.sabotageCount++;
              p1.score += 30; // EMP Shunt Sabotage Bonus
              p2.stunTimer = 0.7;
              p2.score = Math.max(0, p2.score - 10);
              this.particles.emit(p2.x, p2.y, 20, '#F59E0B');
              this.triggerAnnouncement(`${this.getPlayer(p1.id)?.name || 'P1'} EMP-SHUNTED ${this.getPlayer(p2.id)?.name || 'P2'}! (+30 PTS)`, 1.5);
            } else if (speed2 > speed1 + 80 || p2.empShieldTimer > 0) {
              p2.sabotageCount++;
              p2.score += 30;
              p1.stunTimer = 0.7;
              p1.score = Math.max(0, p1.score - 10);
              this.particles.emit(p1.x, p1.y, 20, '#F59E0B');
              this.triggerAnnouncement(`${this.getPlayer(p2.id)?.name || 'P2'} EMP-SHUNTED ${this.getPlayer(p1.id)?.name || 'P1'}! (+30 PTS)`, 1.5);
            }
          }
        }
      }
    }

    // Clean up fried drones
    this.drones = this.drones.filter(d => d.active);
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const p = this.pilots.get(botId);
    if (!p || p.stunTimer > 0 || p.overheatTimer > 0) return;

    let reactionTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (reactionTimer <= 0) {
      const delay = difficulty === 'bot_hard' ? 0.10 : (difficulty === 'bot_normal' ? 0.23 : 0.42);
      reactionTimer = delay + Math.random() * 0.05;
      this.botReactionTimers.set(botId, reactionTimer);

      const cx = width / 2;
      const cy = height / 2;

      // Find best target drone
      let bestTarget: { x: number; y: number } | null = null;
      let highestWeight = -1;

      for (const d of this.drones) {
        if (!d.active) continue;
        const dist = Math.hypot(d.x - p.x, d.y - p.y);
        let weight = (d.value * 2) - dist * 0.2;
        if (d.type === 'apex_mother') weight += 70;

        if (weight > highestWeight) {
          highestWeight = weight;
          bestTarget = { x: d.x, y: d.y };
        }
      }

      // Hard bots hunt rivals to EMP shunt them
      if (difficulty === 'bot_hard') {
        for (const other of this.pilots.values()) {
          if (other.id === botId) continue;
          const distToOther = Math.hypot(other.x - p.x, other.y - p.y);
          if (distToOther < 120 && other.score > p.score) {
            bestTarget = { x: other.x, y: other.y };
            break;
          }
        }
      }

      // Default wander
      if (!bestTarget) {
        bestTarget = { x: cx + (Math.random() - 0.5) * 250, y: cy + (Math.random() - 0.5) * 200 };
      }

      // Easy blunder
      if (difficulty === 'bot_easy' && Math.random() < 0.22) {
        bestTarget = { x: p.x + (Math.random() - 0.5) * 150, y: p.y + (Math.random() - 0.5) * 150 };
      }

      const targetAng = Math.atan2(bestTarget.y - p.y, bestTarget.x - p.x);
      const steerX = Math.cos(targetAng);
      const throttleY = -Math.sin(targetAng);

      // Action button charge logic
      let shouldAction = false;
      const targetDist = Math.hypot(bestTarget.x - p.x, bestTarget.y - p.y);

      if (difficulty === 'bot_hard') {
        if (!p.isCharging && targetDist > 80 && Math.random() < 0.65) {
          shouldAction = true;
        } else if (p.isCharging) {
          const sweetSpotMin = p.isUnderdog ? 0.50 : 0.72;
          const sweetSpotMax = p.isUnderdog ? 1.05 : 0.98;
          const chargeRatio = p.chargeTime / 1.0;
          if (chargeRatio >= sweetSpotMin && chargeRatio <= sweetSpotMax) {
            shouldAction = false; // Sweet spot release!
          } else {
            shouldAction = true;
          }
        }
      } else if (difficulty === 'bot_normal') {
        if (!p.isCharging && Math.random() < 0.3) {
          shouldAction = true;
        } else if (p.isCharging && p.chargeTime > 0.8) {
          shouldAction = false;
        } else if (p.isCharging) {
          shouldAction = true;
        }
      }

      this.input.setBotInput(botId, shouldAction, steerX, throttleY);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // Screen Shake
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    const theme = THEMES[this.currentThemeIndex];
    const cx = width / 2;

    // Background Gradient (Cyber Arena / Facility)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Proving Grounds Arena Floor
    const arenaMarginX = 30;
    const arenaMarginY = 70;
    const arenaW = width - arenaMarginX * 2;
    const arenaH = height - arenaMarginY - 30;

    ctx.fillStyle = theme.arenaFloor;
    ctx.fillRect(arenaMarginX, arenaMarginY, arenaW, arenaH);

    // Arena Metallic Grid
    ctx.strokeStyle = theme.gridLine;
    ctx.lineWidth = 1.5;
    for (let x = arenaMarginX + 45; x < arenaMarginX + arenaW; x += 45) {
      ctx.beginPath();
      ctx.moveTo(x, arenaMarginY);
      ctx.lineTo(x, arenaMarginY + arenaH);
      ctx.stroke();
    }
    for (let y = arenaMarginY + 45; y < arenaMarginY + arenaH; y += 45) {
      ctx.beginPath();
      ctx.moveTo(arenaMarginX, y);
      ctx.lineTo(arenaMarginX + arenaW, y);
      ctx.stroke();
    }

    // Glowing Arena Perimeter
    ctx.strokeStyle = theme.arenaBorder;
    ctx.lineWidth = 3;
    ctx.strokeRect(arenaMarginX + 4, arenaMarginY + 4, arenaW - 8, arenaH - 8);

    // Render Drones
    for (const d of this.drones) {
      if (!d.active) continue;

      ctx.save();
      ctx.translate(d.x, d.y);
      const bobY = Math.sin(d.pulsePhase) * 4;
      ctx.translate(0, bobY);

      // Drone shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 18 - bobY, d.radius * 0.9, d.radius * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      if (d.type === 'apex_mother') {
        // Apex Mother Drone (Golden / Red Quad-Gunship)
        ctx.fillStyle = '#F59E0B';
        ctx.shadowColor = '#FBBF24';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, d.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 4 Rotors
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + d.pulsePhase * 3;
          const rx = Math.cos(a) * (d.radius + 6);
          const ry = Math.sin(a) * (d.radius + 6);
          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          ctx.arc(rx, ry, 5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('75', 0, 0);
      } else if (d.type === 'hexacopter') {
        // Hexacopter (Purple 6-rotor drone)
        ctx.fillStyle = '#8B5CF6';
        ctx.shadowColor = '#C084FC';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const px = Math.cos(a) * d.radius;
          const py = Math.sin(a) * d.radius;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('45', 0, 0);
      } else {
        // Scout Drone (Twin-Rotor Red Scout)
        ctx.fillStyle = '#EF4444';
        ctx.shadowColor = '#F87171';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, d.radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 2 Rotors
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(-d.radius, 0, 4, 0, Math.PI * 2);
        ctx.arc(d.radius, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('20', 0, 0);
      }

      ctx.restore();
    }

    // Render Pilots
    for (const p of this.pilots.values()) {
      const pConfig = this.getPlayer(p.id);
      const isBot = pConfig ? pConfig.type !== 'human' : false;

      ctx.save();
      ctx.translate(p.x, p.y);

      // Character Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 18, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Underdog Overdrive Aura
      if (p.isUnderdog) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 30 + Math.sin(Date.now() * 0.01) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // EMP Surge Boost Aura
      if (p.empShieldTimer > 0) {
        ctx.strokeStyle = theme.empColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Mascot Character
      drawCharacter(
        ctx,
        0,
        0,
        18,
        p.id,
        isBot,
        p.mood,
        p.animTimer
      );

      // EMP Cannon Facing Direction
      ctx.save();
      ctx.rotate(p.angle);
      ctx.strokeStyle = theme.empColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, -4);
      ctx.lineTo(16, 0);
      ctx.lineTo(8, 4);
      ctx.stroke();
      ctx.restore();

      // Hold-to-Charge EMP Capacitor Ring
      if (p.isCharging) {
        const chargeRatio = Math.min(1.0, p.chargeTime / 1.0);
        const sweetSpotMin = p.isUnderdog ? 0.50 : 0.72;
        const sweetSpotMax = p.isUnderdog ? 1.05 : 0.98;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, 30, sweetSpotMin * Math.PI * 2 - Math.PI / 2, sweetSpotMax * Math.PI * 2 - Math.PI / 2);
        ctx.stroke();

        const isSweet = chargeRatio >= sweetSpotMin && chargeRatio <= sweetSpotMax;
        ctx.strokeStyle = isSweet ? '#F59E0B' : theme.empColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 30, -Math.PI / 2, chargeRatio * Math.PI * 2 - Math.PI / 2);
        ctx.stroke();

        ctx.fillStyle = isSweet ? '#F59E0B' : '#FFFFFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(isSweet ? 'EMP BURST!' : 'CHARGING...', 0, -38);
      }

      // Status text
      if (p.overheatTimer > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CAPACITOR SHORT', 0, 34);
      } else if (p.stunTimer > 0) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('EMP STUN', 0, 34);
      }

      ctx.restore();
    }

    // Top Global Timer Safe Zone: y: 12-44, x: width/2 - 80 to width/2 + 80
    // Render Minigame Header Badge at y: 56, h: 28
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 1.5;
    const badgeW = 390;
    const badgeH = 26;
    ctx.beginPath();
    ctx.roundRect(cx - badgeW / 2, 56, badgeW, badgeH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#06B6D4';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DRONE INTERCEPT // PROVING GROUND EMP BRAWL', cx, 56 + badgeH / 2);
    ctx.restore();

    // Central Announcement Banner
    if (this.announcementTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      const bW = Math.min(width - 40, 480);
      const bH = 34;
      ctx.beginPath();
      ctx.roundRect(cx - bW / 2, height * 0.28, bW, bH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FCD34D';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.announcementText, cx, height * 0.28 + bH / 2);
      ctx.restore();
    }

    // Sudden Death Pulsing Banner
    if (this.roundTimer <= 12.0) {
      ctx.save();
      const pulseSD = Math.sin(Date.now() * 0.008) > 0;
      ctx.fillStyle = pulseSD ? '#EF4444' : '#F97316';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ AIRSPACE THREAT OMEGA: DOUBLE DRONE SCORES! ⚡', cx, 98);
      ctx.restore();
    }

    // Bottom-Left Theme Pill: x: 20, y: height - 44, w: 170, h: 32
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name} [T]`, 30, height - 28);
    ctx.restore();

    // Corner Player Score Cards: y: height - 128 (130x48px)
    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const pilot = this.pilots.get(p.id);
      if (!pilot) continue;

      let cardX = 20;
      if (i === 1) cardX = width - 150;
      else if (i === 2) cardX = 160;
      else if (i === 3) cardX = width - 290;

      const cardY = height - 128;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = pilot.isUnderdog ? '#F59E0B' : p.color;
      ctx.lineWidth = pilot.isUnderdog ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 130, 48, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 10, cardY + 16);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`${pilot.score} PTS`, cardX + 10, cardY + 36);

      if (pilot.streakCount > 1) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${pilot.streakCount}x`, cardX + 120, cardY + 36);
      }

      ctx.restore();
    }

    ctx.restore(); // End canvas save
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.pilots.get(p.id)?.score || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    const winnerP = winnerId ? this.pilots.get(winnerId) : null;
    let highlight = 'Surveillance drones intercepted the sector!';
    if (winnerId && winnerP) {
      const pName = this.getPlayer(winnerId)?.name || 'Pilot';
      if (winnerP.sabotageCount >= 2) {
        highlight = `${pName} EMP-shunted rivals and cleared the skies of drone swarms!`;
      } else {
        highlight = `${pName} fried the drone swarms with a commanding score of ${winnerP.score}!`;
      }
    }

    return {
      winnerId,
      rankings,
      mvpHighlight: highlight
    };
  }

  public override destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) {
        window.removeEventListener('keydown', this.keydownHandler);
      }
      if (this.clickHandler) {
        window.removeEventListener('click', this.clickHandler);
      }
    }
    super.destroy();
  }
}
