import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface SubmersiblePlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  chargeTime: number;
  isCharging: boolean;
  isFaradaySurge: boolean;
  surgeTimer: number;
  shuntCooldown: number;
  paralyzedTimer: number;
  invulnerableTimer: number;
  score: number;
  gatesPassed: number;
  isUnderdog: boolean;
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
}

interface EelSegment {
  x: number;
  y: number;
  radius: number;
}

interface ElectricGate {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  isVertical: boolean;
  isDischarging: boolean;
  cycleTimer: number;
  dischargeDuration: number;
  dormantDuration: number;
  passedBy: Set<PlayerId>;
}

interface BatteryCell {
  id: number;
  x: number;
  y: number;
  radius: number;
  type: 'spark' | 'capacitor' | 'faraday_core';
  points: number;
  color: string;
}

interface EelTheme {
  id: string;
  name: string;
  icon: string;
  cavernDark: string;
  cavernLight: string;
  pylonColor: string;
  eelSkin: string;
  eelGlow: string;
  accentColor: string;
}

const THEMES: EelTheme[] = [
  {
    id: 'mariana_zap',
    name: 'Mariana Zap Cavern ⚡',
    icon: '⚡',
    cavernDark: '#001018',
    cavernLight: '#002B3D',
    pylonColor: '#37474F',
    eelSkin: '#0D47A1',
    eelGlow: '#00E5FF',
    accentColor: '#00E5FF'
  },
  {
    id: 'cyber_aqueduct',
    name: 'Cyber Sub-Aqueduct 🤖',
    icon: '🤖',
    cavernDark: '#0A081D',
    cavernLight: '#181534',
    pylonColor: '#263238',
    eelSkin: '#212121',
    eelGlow: '#FF1744',
    accentColor: '#FFD700'
  },
  {
    id: 'sulfur_rift',
    name: 'Molten Sulfur Rift 🌋',
    icon: '🌋',
    cavernDark: '#121A00',
    cavernLight: '#2B3800',
    pylonColor: '#332700',
    eelSkin: '#1B5E20',
    eelGlow: '#76FF03',
    accentColor: '#AEEA00'
  }
];

export class ElectricEelGame extends BaseGame {
  public currentMapName: string = 'Mariana Zap Cavern ⚡';
  private currentThemeIdx: number = 0;

  private subs: Map<PlayerId, SubmersiblePlayer> = new Map();
  private gates: ElectricGate[] = [];
  private batteries: BatteryCell[] = [];
  private batteryIdCounter: number = 0;
  private spawnBatteryTimer: number = 0;

  // Apex Electric Eel Multi-Segment Body
  private eelHeadX: number = 0;
  private eelHeadY: number = 0;
  private eelAngle: number = 0;
  private eelSpeed: number = 135;
  private eelWaypoints: { x: number; y: number }[] = [];
  private currentWaypointIdx: number = 0;
  private eelSegments: EelSegment[] = [];
  private eelDischargeTimer: number = 0;
  private isEelDischarging: boolean = false;

  private botReactionTimers: Map<PlayerId, number> = new Map();
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
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;
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

  public override destroy(): void {
    super.destroy();
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);
      if (this.clickHandler) window.removeEventListener('click', this.clickHandler);
    }
  }

  public cycleTheme(): void {
    this.currentThemeIdx = (this.currentThemeIdx + 1) % THEMES.length;
    this.currentMapName = THEMES[this.currentThemeIdx].name;
    this.audio.playTap();
  }

  public setTheme(idx: number): void {
    if (idx >= 0 && idx < THEMES.length) {
      this.currentThemeIdx = idx;
      this.currentMapName = THEMES[this.currentThemeIdx].name;
      this.audio.playTap();
    }
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 38.0;
    this.isFinished = false;
    this.subs.clear();
    this.gates = [];
    this.batteries = [];
    this.botReactionTimers.clear();
    this.spawnBatteryTimer = 0.5;

    // Create 4 Cavern Pylon Gates (slalom passage)
    const gateDefs = [
      { x: width * 0.28, y: height * 0.32, w: 20, h: 84, isVert: true },
      { x: width * 0.72, y: height * 0.32, w: 20, h: 84, isVert: true },
      { x: width * 0.72, y: height * 0.72, w: 20, h: 84, isVert: true },
      { x: width * 0.28, y: height * 0.72, w: 20, h: 84, isVert: true }
    ];

    gateDefs.forEach((pos, idx) => {
      this.gates.push({
        id: idx,
        x: pos.x,
        y: pos.y,
        w: pos.w,
        h: pos.h,
        isVertical: pos.isVert,
        isDischarging: idx % 2 === 0,
        cycleTimer: 1.4 + idx * 0.3,
        dischargeDuration: 1.5,
        dormantDuration: 1.7,
        passedBy: new Set()
      });
    });

    // Apex Electric Eel Patrol Path
    this.eelWaypoints = [
      { x: width * 0.25, y: height * 0.22 },
      { x: width * 0.75, y: height * 0.22 },
      { x: width * 0.75, y: height * 0.82 },
      { x: width * 0.25, y: height * 0.82 }
    ];
    this.currentWaypointIdx = 0;
    this.eelHeadX = this.eelWaypoints[0].x;
    this.eelHeadY = this.eelWaypoints[0].y;
    this.eelAngle = 0;
    this.eelDischargeTimer = 3.0;
    this.isEelDischarging = false;

    // Initialize 14 inverse-kinematic eel body segments
    this.eelSegments = [];
    for (let i = 0; i < 14; i++) {
      this.eelSegments.push({
        x: this.eelHeadX - i * 16,
        y: this.eelHeadY,
        radius: Math.max(9, 18 - i * 0.75)
      });
    }

    const active = this.getActivePlayers();
    const count = active.length;
    const startY = height * 0.52;

    active.forEach((p, idx) => {
      const step = width / (count + 1);
      const startX = step * (idx + 1);

      this.subs.set(p.id, {
        id: p.id,
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        angle: 0,
        radius: 19,
        chargeTime: 0,
        isCharging: false,
        isFaradaySurge: false,
        surgeTimer: 0,
        shuntCooldown: 0,
        paralyzedTimer: 0,
        invulnerableTimer: 1.0,
        score: 0,
        gatesPassed: 0,
        isUnderdog: false,
        mood: 'idle',
        moodTimer: 0,
        animTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.25);
    });

    for (let i = 0; i < 8; i++) {
      this.spawnBattery(width, height);
    }
  }

  private spawnBattery(width: number, height: number): void {
    const roll = Math.random();
    let type: BatteryCell['type'] = 'spark';
    let points = 20;
    let radius = 10;
    let color = '#00E5FF';

    if (roll < 0.3) {
      type = 'capacitor';
      points = 35;
      radius = 13;
      color = '#FFD54F';
    } else if (roll < 0.45) {
      type = 'faraday_core';
      points = 60;
      radius = 15;
      color = '#E040FB';
    }

    const minX = width * 0.15;
    const maxX = width * 0.85;
    const minY = height * 0.18;
    const maxY = height * 0.84;

    this.batteries.push({
      id: ++this.batteryIdCounter,
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
      radius,
      type,
      points,
      color
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    const isSuddenDeath = this.roundTimer <= 15.0;

    // Update Electric Pylon Gates
    for (const g of this.gates) {
      g.cycleTimer -= dt;
      if (g.cycleTimer <= 0) {
        g.isDischarging = !g.isDischarging;
        g.cycleTimer = g.isDischarging ? g.dischargeDuration : g.dormantDuration;
        g.passedBy.clear(); // Reset passage tracking for new cycle
      }
    }

    // Update Apex Electric Eel Patrol Navigation
    const targetWp = this.eelWaypoints[this.currentWaypointIdx];
    const dx = targetWp.x - this.eelHeadX;
    const dy = targetWp.y - this.eelHeadY;
    const distToWp = Math.hypot(dx, dy);

    if (distToWp < 25) {
      this.currentWaypointIdx = (this.currentWaypointIdx + 1) % this.eelWaypoints.length;
    }

    const targetAngle = Math.atan2(dy, dx);
    let angleDiff = targetAngle - this.eelAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.eelAngle += angleDiff * Math.min(1.0, dt * 4.0);

    const eelSpeed = (this.eelSpeed + (isSuddenDeath ? 45 : 0));
    this.eelHeadX += Math.cos(this.eelAngle) * eelSpeed * dt;
    this.eelHeadY += Math.sin(this.eelAngle) * eelSpeed * dt;

    // Multi-Segment Inverse Kinematics
    let prevX = this.eelHeadX;
    let prevY = this.eelHeadY;
    for (let i = 0; i < this.eelSegments.length; i++) {
      const seg = this.eelSegments[i];
      const segDx = prevX - seg.x;
      const segDy = prevY - seg.y;
      const segDist = Math.hypot(segDx, segDy) || 1;
      const targetDist = 16;
      seg.x = prevX - (segDx / segDist) * targetDist;
      seg.y = prevY - (segDy / segDist) * targetDist;
      prevX = seg.x;
      prevY = seg.y;
    }

    // Eel High-Voltage Discharge Cycle
    this.eelDischargeTimer -= dt;
    if (this.eelDischargeTimer <= 0) {
      this.isEelDischarging = !this.isEelDischarging;
      this.eelDischargeTimer = this.isEelDischarging ? (isSuddenDeath ? 3.0 : 2.0) : 3.5;
      if (this.isEelDischarging) {
        this.audio.playExplosion();
      }
    }

    // Battery cell restocking
    this.spawnBatteryTimer += dt;
    if (this.spawnBatteryTimer > (isSuddenDeath ? 1.5 : 2.5) && this.batteries.length < 14) {
      this.spawnBatteryTimer = 0;
      this.spawnBattery(width, height);
    }

    // Underdog calculation
    let maxScore = -1;
    for (const s of this.subs.values()) {
      if (s.score > maxScore) maxScore = s.score;
    }
    for (const s of this.subs.values()) {
      s.isUnderdog = maxScore - s.score >= 35 && maxScore > 20;
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();

    // Update Submersibles
    for (const p of active) {
      const s = this.subs.get(p.id);
      if (!s) continue;

      s.animTimer += dt;
      if (s.paralyzedTimer > 0) {
        s.paralyzedTimer -= dt;
        s.angle += dt * 22; // Hilarious spin!
      }
      if (s.invulnerableTimer > 0) s.invulnerableTimer -= dt;
      if (s.shuntCooldown > 0) s.shuntCooldown -= dt;
      if (s.moodTimer > 0) {
        s.moodTimer -= dt;
        if (s.moodTimer <= 0) s.mood = 'idle';
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      if (s.paralyzedTimer <= 0) {
        const hasInput = Math.hypot(steer, throttle) > 0.15;
        if (hasInput) {
          const moveAngle = Math.atan2(-throttle, steer);
          s.angle = moveAngle;

          const baseSpeed = s.isUnderdog ? 270 : 220;
          const targetVx = Math.cos(moveAngle) * baseSpeed;
          const targetVy = Math.sin(moveAngle) * baseSpeed;

          s.vx += (targetVx - s.vx) * Math.min(1.0, dt * 7.5);
          s.vy += (targetVy - s.vy) * Math.min(1.0, dt * 7.5);

          if (Math.random() < 0.28) {
            this.particles.emit(s.x - Math.cos(s.angle) * 16, s.y - Math.sin(s.angle) * 16, 2, '#80DEEA');
          }
        } else {
          s.vx *= Math.pow(0.3, dt);
          s.vy *= Math.pow(0.3, dt);
        }

        // Hold-to-Charge Faraday Turbo Boost
        if (isAction) {
          s.isCharging = true;
          s.chargeTime += dt;
          s.mood = 'focused';
          if (Math.random() < 0.25) {
            this.particles.spawnSparks(s.x, s.y, '#00E5FF', 2);
          }
        } else if (s.isCharging) {
          const ratio = Math.min(1.0, s.chargeTime / 1.0);
          const isSweet = ratio >= 0.72 && ratio <= 0.98;

          s.isCharging = false;
          s.chargeTime = 0;
          s.isFaradaySurge = true;
          s.surgeTimer = isSweet ? 0.55 : 0.35;

          const boostMag = (isSweet ? 480 : 350) * (s.isUnderdog ? 1.2 : 1.0);
          s.vx = Math.cos(s.angle) * boostMag;
          s.vy = Math.sin(s.angle) * boostMag;

          if (isSweet) {
            this.audio.playExplosion();
            this.particles.spawnConfetti(s.x, s.y, 16);
            s.mood = 'triumph';
            s.moodTimer = 1.2;
          } else {
            this.audio.playBounce();
          }
        }
      } else {
        s.vx *= Math.pow(0.2, dt);
        s.vy *= Math.pow(0.2, dt);
      }

      if (s.surgeTimer > 0) {
        s.surgeTimer -= dt;
        if (s.surgeTimer <= 0) s.isFaradaySurge = false;
        this.particles.emit(s.x - Math.cos(s.angle) * 18, s.y - Math.sin(s.angle) * 18, 3, '#00E5FF');
      }

      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Cavern boundary clamp
      if (s.x < s.radius + 15) { s.x = s.radius + 15; s.vx = 0; }
      if (s.x > width - s.radius - 15) { s.x = width - s.radius - 15; s.vx = 0; }
      if (s.y < s.radius + 50) { s.y = s.radius + 50; s.vy = 0; }
      if (s.y > height - s.radius - 15) { s.y = height - s.radius - 15; s.vy = 0; }

      // Collect Battery Cells
      for (let i = this.batteries.length - 1; i >= 0; i--) {
        const b = this.batteries[i];
        const reach = s.radius + b.radius + (s.isUnderdog ? 20 : 6);
        if (Math.hypot(s.x - b.x, s.y - b.y) < reach) {
          const awarded = b.points * (isSuddenDeath ? 2 : 1);
          s.score += awarded;
          this.audio.playScore();
          this.particles.spawnSparks(b.x, b.y, b.color, 10);
          if (b.type === 'faraday_core') {
            s.mood = 'triumph';
            s.moodTimer = 1.3;
            this.particles.spawnConfetti(s.x, s.y, 16);
          }
          this.batteries.splice(i, 1);
          break;
        }
      }

      // Check Electric Pylon Gate Passage
      for (const g of this.gates) {
        const inX = s.x >= g.x - g.w && s.x <= g.x + g.w * 2;
        const inY = s.y >= g.y && s.y <= g.y + g.h;

        if (inX && inY) {
          if (g.isDischarging) {
            if (s.isFaradaySurge || s.isUnderdog) {
              // Absorbed harmlessly!
              if (!g.passedBy.has(s.id)) {
                s.score += 30; // Electro-Ram Absorption bonus!
                g.passedBy.add(s.id);
                this.audio.playScore();
                this.particles.spawnConfetti(s.x, s.y, 12);
              }
            } else if (s.invulnerableTimer <= 0 && s.paralyzedTimer <= 0) {
              // High Voltage Shock!
              s.score = Math.max(0, s.score - 15);
              s.paralyzedTimer = 1.1;
              s.mood = 'shocked';
              s.moodTimer = 1.3;
              this.audio.playExplosion();
              this.particles.spawnSparks(s.x, s.y, '#00E5FF', 16);
            }
          } else {
            // Uncharged clean slalom gate!
            if (!g.passedBy.has(s.id)) {
              g.passedBy.add(s.id);
              s.score += 25;
              s.gatesPassed++;
              this.audio.playScore();
              this.particles.spawnSparks(s.x, s.y, '#FFD54F', 8);
            }
          }
        }
      }

      // Check Electric Eel Collision
      for (const seg of this.eelSegments) {
        if (Math.hypot(s.x - seg.x, s.y - seg.y) < s.radius + seg.radius) {
          if (s.isFaradaySurge || s.isUnderdog) {
            // Faraday surge shocks the eel!
            s.score += 25;
            this.audio.playScore();
            this.particles.spawnConfetti(s.x, s.y, 14);
          } else if (s.invulnerableTimer <= 0 && s.paralyzedTimer <= 0) {
            // Paralyzed by the eel!
            s.score = Math.max(0, s.score - 20);
            s.paralyzedTimer = 1.2;
            s.mood = 'shocked';
            s.moodTimer = 1.4;
            this.audio.playExplosion();
            this.particles.spawnSparks(s.x, s.y, '#00E5FF', 18);
          }
        }
      }
    }

    // Inter-Sub Bumper Collisions & Shunts
    const subsArr = Array.from(this.subs.values());
    for (let i = 0; i < subsArr.length; i++) {
      for (let j = i + 1; j < subsArr.length; j++) {
        const s1 = subsArr[i];
        const s2 = subsArr[j];

        const dx = s2.x - s1.x;
        const dy = s2.y - s1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = s1.radius + s2.radius;

        if (dist < minDist && dist > 0) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          s1.x -= nx * overlap * 0.5;
          s1.y -= ny * overlap * 0.5;
          s2.x += nx * overlap * 0.5;
          s2.y += ny * overlap * 0.5;

          const vRel = (s1.vx - s2.vx) * nx + (s1.vy - s2.vy) * ny;
          s1.vx -= nx * vRel * 0.75;
          s1.vy -= ny * vRel * 0.75;
          s2.vx += nx * vRel * 0.75;
          s2.vy += ny * vRel * 0.75;

          // Pylon / Electro Shunt
          if (s1.isFaradaySurge && s2.invulnerableTimer <= 0) {
            s2.vx += nx * 440;
            s2.vy += ny * 440;
            s2.paralyzedTimer = 0.9;
            s2.mood = 'shocked';
            s2.moodTimer = 1.2;
            s1.score += 30; // Sabotage bonus
            this.audio.playExplosion();
            this.particles.spawnSparks(s2.x, s2.y, '#FF9800', 14);
          } else if (s2.isFaradaySurge && s1.invulnerableTimer <= 0) {
            s1.vx -= nx * 440;
            s1.vy -= ny * 440;
            s1.paralyzedTimer = 0.9;
            s1.mood = 'shocked';
            s1.moodTimer = 1.2;
            s2.score += 30;
            this.audio.playExplosion();
            this.particles.spawnSparks(s1.x, s1.y, '#FF9800', 14);
          } else {
            this.audio.playBounce();
          }
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

    const s = this.subs.get(botId);
    if (!s || s.paralyzedTimer > 0) return;

    let steerX = 0;
    let steerY = 0;
    let shouldCharge = false;

    // Check danger from Eel Head
    const eelDist = Math.hypot(this.eelHeadX - s.x, this.eelHeadY - s.y);
    if (eelDist < 120 && !s.isUnderdog) {
      // Flee away from eel
      const awayAngle = Math.atan2(s.y - this.eelHeadY, s.x - this.eelHeadX);
      steerX = Math.cos(awayAngle);
      steerY = Math.sin(awayAngle);
      if (difficulty === 'bot_hard') shouldCharge = true;
    } else {
      // Target nearest battery cell or uncharged gate
      let bestTarget: { x: number; y: number } | null = null;
      let bestDist = Infinity;

      for (const b of this.batteries) {
        const d = Math.hypot(b.x - s.x, b.y - s.y);
        const weight = b.type === 'faraday_core' ? 0.4 : 1.0;
        const weightedDist = d * weight;
        if (weightedDist < bestDist) {
          bestDist = weightedDist;
          bestTarget = b;
        }
      }

      if (bestTarget) {
        const dx = bestTarget.x - s.x;
        const dy = bestTarget.y - s.y;
        const seekAngle = Math.atan2(dy, dx);
        steerX = Math.cos(seekAngle);
        steerY = Math.sin(seekAngle);

        if (bestDist < 120 && difficulty === 'bot_hard') {
          shouldCharge = true;
        }
      }
    }

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      steerX = -steerX;
      steerY = -steerY;
    }

    this.input.setBotInput(botId, shouldCharge, steerX, -steerY, false);

    const delay = difficulty === 'bot_hard' ? 0.11 : difficulty === 'bot_normal' ? 0.23 : 0.42;
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const s = this.subs.get(p.id);
      return {
        playerId: p.id,
        score: s?.score || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topScore = scores[0]?.score || 0;
    const mvpHighlight = winnerId !== null
      ? `Pilot P${winnerId + 1} threaded the high-voltage cavern gates with ${topScore} points!`
      : 'All exploration submersibles were grounded by electric eel shocks!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIdx];

    // Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.cavernDark);
    bgGrad.addColorStop(1, theme.cavernLight);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Stalactite & Cavern Rock Outlines
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.moveTo(0, 50);
    ctx.lineTo(60, 95);
    ctx.lineTo(120, 50);
    ctx.lineTo(width * 0.45, 80);
    ctx.lineTo(width * 0.55, 50);
    ctx.lineTo(width, 75);
    ctx.lineTo(width, 0);
    ctx.lineTo(0, 0);
    ctx.fill();
    ctx.restore();

    // Render Electric Pylon Gates
    for (const g of this.gates) {
      ctx.save();
      // Pylon Posts
      ctx.fillStyle = theme.pylonColor;
      ctx.fillRect(g.x, g.y, g.w, g.h);
      ctx.strokeStyle = '#78909C';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(g.x, g.y, g.w, g.h);

      // Electric Arc / Discharge Field
      if (g.isDischarging) {
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(g.x + g.w * 0.5, g.y);
        for (let py = g.y; py <= g.y + g.h; py += 12) {
          ctx.lineTo(g.x + g.w * 0.5 + (Math.random() - 0.5) * 16, py);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Safe green slalom indicator
        ctx.fillStyle = '#00E676';
        ctx.beginPath();
        ctx.arc(g.x + g.w * 0.5, g.y + g.h * 0.5, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Render Apex Electric Eel
    ctx.save();
    // Glowing dorsal electric aura
    if (this.isEelDischarging) {
      ctx.strokeStyle = theme.eelGlow;
      ctx.lineWidth = 28;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(this.eelHeadX, this.eelHeadY);
      for (const seg of this.eelSegments) {
        ctx.lineTo(seg.x, seg.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    // Eel Segments Body
    for (let i = this.eelSegments.length - 1; i >= 0; i--) {
      const seg = this.eelSegments[i];
      ctx.fillStyle = theme.eelSkin;
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, seg.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = theme.eelGlow;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Eel Head & Yellow Eyes
    ctx.fillStyle = theme.eelSkin;
    ctx.beginPath();
    ctx.arc(this.eelHeadX, this.eelHeadY, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.eelGlow;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#FFEB3B';
    const eyeOffsetX = Math.cos(this.eelAngle + Math.PI * 0.4) * 12;
    const eyeOffsetY = Math.sin(this.eelAngle + Math.PI * 0.4) * 12;
    ctx.beginPath();
    ctx.arc(this.eelHeadX + eyeOffsetX, this.eelHeadY + eyeOffsetY, 4, 0, Math.PI * 2);
    ctx.arc(this.eelHeadX - eyeOffsetX, this.eelHeadY - eyeOffsetY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Render Battery Cells
    for (const b of this.batteries) {
      ctx.save();
      ctx.translate(b.x, b.y);

      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      if (b.type === 'spark') {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-2, -2, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.type === 'capacitor') {
        ctx.fillStyle = '#FFD54F';
        ctx.fillRect(-b.radius, -b.radius * 0.6, b.radius * 2, b.radius * 1.2);
        ctx.strokeStyle = '#FF6F00';
        ctx.lineWidth = 2;
        ctx.strokeRect(-b.radius, -b.radius * 0.6, b.radius * 2, b.radius * 1.2);
      } else {
        // Faraday Core
        ctx.fillStyle = '#E040FB';
        ctx.beginPath();
        ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Render Submersibles
    for (const s of this.subs.values()) {
      const pConfig = this.players.find((p) => p.id === s.id);
      const pColor = pConfig ? pConfig.color : '#38BDF8';
      const isBot = pConfig ? pConfig.type !== 'human' : false;

      ctx.save();
      ctx.translate(s.x, s.y);

      // Underdog Tesla Shield Aura
      if (s.isUnderdog) {
        ctx.save();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, s.radius + 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Faraday Surge Shock Ring
      if (s.isFaradaySurge) {
        ctx.fillStyle = 'rgba(0, 229, 255, 0.45)';
        ctx.beginPath();
        ctx.arc(0, 0, s.radius + 10, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.rotate(s.angle);

      // Sub Hull
      ctx.fillStyle = '#ECEFF1';
      ctx.beginPath();
      ctx.ellipse(0, 0, s.radius * 1.25, s.radius * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();

      // Colored Racing Trim
      ctx.fillStyle = pColor;
      ctx.fillRect(-s.radius * 0.8, -s.radius * 0.35, s.radius * 1.6, s.radius * 0.7);

      // Bronze Propeller
      ctx.fillStyle = '#FFB300';
      ctx.fillRect(-s.radius * 1.35, -4, 4, 8);

      // Headlight Beam
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.moveTo(s.radius * 1.1, -4);
      ctx.lineTo(s.radius * 3.0, -18);
      ctx.lineTo(s.radius * 3.0, 18);
      ctx.lineTo(s.radius * 1.1, 4);
      ctx.closePath();
      ctx.fill();

      // Mascot Pilot
      drawCharacter(
        ctx,
        2,
        0,
        12,
        s.id,
        isBot,
        s.mood,
        s.animTimer,
        undefined
      );

      ctx.restore();

      // Charging Gauge Ring
      if (s.isCharging) {
        const ratio = Math.min(1.0, s.chargeTime / 1.0);
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.strokeStyle = ratio >= 0.72 && ratio <= 0.98 ? '#00E676' : '#00E5FF';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius + 14, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * ratio);
        ctx.stroke();

        if (ratio >= 0.72 && ratio <= 0.98) {
          ctx.fillStyle = '#00E676';
          ctx.font = '900 11px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('SWEET SPOT!', 0, -s.radius - 18);
        }
        ctx.restore();
      }

      // Paralysis Electric Sparks
      if (s.paralyzedTimer > 0) {
        ctx.save();
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Minigame Header Badge (Safe zone y: 56)
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(width / 2 - 120, 56, 240, 28);
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(width / 2 - 120, 56, 240, 28);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 13px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ ELECTRIC EEL SLALOM', width / 2, 75);
    ctx.restore();

    // Theme Pill at Bottom-Left (Rule compliant: x: 20, y: height - 44, w: 170, h: 32)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(20, height - 44, 170, 32);
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(20, height - 44, 170, 32);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`[T] ${theme.name}`, 28, height - 24);
    ctx.restore();

    // Corner Player Cards safely offset to y: height - 128 (130x48px)
    const activeSubs = Array.from(this.subs.values());
    const cardPositions = [
      { x: 18, y: height - 128 },
      { x: width - 148, y: height - 128 },
      { x: 18, y: 88 },
      { x: width - 148, y: 88 }
    ];

    activeSubs.forEach((s, idx) => {
      if (idx >= cardPositions.length) return;
      const pos = cardPositions[idx];
      const pConfig = this.players.find((p) => p.id === s.id);
      const pColor = pConfig ? pConfig.color : '#38BDF8';
      const pNum = typeof s.id === 'number' ? (s.id as number) + 1 : String(s.id).slice(-1);

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(pos.x, pos.y, 130, 48);
      ctx.strokeStyle = pColor;
      ctx.lineWidth = s.isUnderdog ? 3 : 1.5;
      ctx.strokeRect(pos.x, pos.y, 130, 48);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${pNum} ${s.isUnderdog ? '⭐ UNDERDOG' : 'PILOT'}`, pos.x + 8, pos.y + 18);

      ctx.fillStyle = '#FFD54F';
      ctx.font = '900 16px Montserrat, sans-serif';
      ctx.fillText(`${s.score} PTS`, pos.x + 8, pos.y + 40);

      if (s.paralyzedTimer > 0) {
        ctx.fillStyle = '#00E5FF';
        ctx.font = '11px sans-serif';
        ctx.fillText('⚡ ZAPPED', pos.x + 70, pos.y + 40);
      }
      ctx.restore();
    });
  }
}
