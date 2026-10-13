import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface DataCrystal {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: 'matrix_crystal' | 'memory_core' | 'alien_dna';
  value: number;
  color: string;
  pulsePhase: number;
}

interface DefenseLaser {
  centerX: number;
  centerY: number;
  angle: number;
  angularVelocity: number;
  length: number;
  color: string;
}

interface ProbeSaucer {
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

  // Quantum Phasing & Warp Surge
  isCharging: boolean;
  chargeTime: number; // 0 to 1.2s
  isPhasing: boolean;
  phaseTimer: number;
  isEmpStunned: boolean;
  stunTimer: number;

  shuntCooldown: number;
  isUnderdog: boolean;

  // Mascot emotion & animation
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
}

interface ProbeTheme {
  id: string;
  name: string;
  icon: string;
  coreDark: string;
  coreLight: string;
  gridLineColor: string;
  laserBeamColor: string;
  laserCoreColor: string;
  crystalMatrix: string;
  crystalMemory: string;
  crystalDna: string;
  accentColor: string;
}

const THEMES: ProbeTheme[] = [
  {
    id: 'xenon_core',
    name: 'Xenon Mothership Core 🛸',
    icon: '🛸',
    coreDark: '#040914',
    coreLight: '#09162A',
    gridLineColor: '#0E2442',
    laserBeamColor: 'rgba(255, 23, 68, 0.45)',
    laserCoreColor: '#FF1744',
    crystalMatrix: '#00E5FF',
    crystalMemory: '#7C4DFF',
    crystalDna: '#FFD700',
    accentColor: '#00E5FF'
  },
  {
    id: 'cyber_hive',
    name: 'Cyber Matrix Hive ⚡',
    icon: '⚡',
    coreDark: '#011208',
    coreLight: '#062614',
    gridLineColor: '#0C4022',
    laserBeamColor: 'rgba(255, 214, 0, 0.45)',
    laserCoreColor: '#FFD600',
    crystalMatrix: '#00E676',
    crystalMemory: '#00B0FF',
    crystalDna: '#FF9100',
    accentColor: '#00E676'
  },
  {
    id: 'nebula_vault',
    name: 'Abyssal Nebula Vault 🌌',
    icon: '🌌',
    coreDark: '#0E021A',
    coreLight: '#24083E',
    gridLineColor: '#3D1263',
    laserBeamColor: 'rgba(224, 64, 251, 0.45)',
    laserCoreColor: '#E040FB',
    crystalMatrix: '#E040FB',
    crystalMemory: '#00E5FF',
    crystalDna: '#FFEA00',
    accentColor: '#E040FB'
  }
];

export class AlienProbeGame extends BaseGame {
  public currentMapName: string = 'Xenon Mothership Core 🛸';
  private currentThemeIdx: number = 0;

  private saucers: Map<PlayerId, ProbeSaucer> = new Map();
  private crystals: DataCrystal[] = [];
  private lasers: DefenseLaser[] = [];
  private crystalIdCounter: number = 0;
  private spawnCrystalTimer: number = 1.0;

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
    this.saucers.clear();
    this.crystals = [];
    this.lasers = [];
    this.crystalIdCounter = 0;
    this.spawnCrystalTimer = 1.0;

    // Defense Laser Turrets: 2 large central sweeping beams and 2 orbiting satellites
    const theme = THEMES[this.currentThemeIdx];
    this.lasers = [
      { centerX: width * 0.5, centerY: height * 0.52, angle: 0, angularVelocity: 1.05, length: Math.hypot(width, height) * 0.58, color: theme.laserCoreColor },
      { centerX: width * 0.5, centerY: height * 0.52, angle: Math.PI, angularVelocity: 1.05, length: Math.hypot(width, height) * 0.58, color: theme.laserCoreColor },
      { centerX: width * 0.22, centerY: height * 0.28, angle: 0.5, angularVelocity: -1.35, length: 170, color: theme.laserCoreColor },
      { centerX: width * 0.78, centerY: height * 0.76, angle: 2.2, angularVelocity: -1.35, length: 170, color: theme.laserCoreColor }
    ];

    // Spawn 10 initial data crystals
    for (let i = 0; i < 10; i++) {
      this.spawnDataCrystal(width, height);
    }

    const active = this.getActivePlayers();
    const spawnPositions = [
      { x: width * 0.18, y: height * 0.76, angle: -Math.PI * 0.25 },
      { x: width * 0.82, y: height * 0.28, angle: Math.PI * 0.75 },
      { x: width * 0.18, y: height * 0.28, angle: Math.PI * 0.25 },
      { x: width * 0.82, y: height * 0.76, angle: -Math.PI * 0.75 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnPositions[idx % spawnPositions.length];
      this.saucers.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: pos.angle,
        speed: 0,
        baseMaxSpeed: 230,
        radius: 17,
        score: 0,

        isCharging: false,
        chargeTime: 0,
        isPhasing: false,
        phaseTimer: 0,
        isEmpStunned: false,
        stunTimer: 0,

        shuntCooldown: 0,
        isUnderdog: false,

        mood: 'idle',
        moodTimer: 0,
        animTimer: idx * 0.3
      });

      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  private spawnDataCrystal(width: number, height: number): void {
    const roll = Math.random();
    const theme = THEMES[this.currentThemeIdx];

    let type: DataCrystal['type'] = 'matrix_crystal';
    let val = 20;
    let rad = 11;
    let col = theme.crystalMatrix;

    if (roll < 0.20) {
      type = 'alien_dna';
      val = 75;
      rad = 16;
      col = theme.crystalDna;
    } else if (roll < 0.55) {
      type = 'memory_core';
      val = 40;
      rad = 13;
      col = theme.crystalMemory;
    }

    this.crystals.push({
      id: ++this.crystalIdCounter,
      x: 60 + Math.random() * (width - 120),
      y: 70 + Math.random() * (height - 140),
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20,
      radius: rad,
      type,
      value: val,
      color: col,
      pulsePhase: Math.random() * Math.PI * 2
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update defense lasers
    const laserSpeedMult = this.roundTimer <= 12.0 ? 1.4 : 1.0;
    for (const laser of this.lasers) {
      laser.angle += laser.angularVelocity * laserSpeedMult * dt;
    }

    // Maintain data crystals
    this.spawnCrystalTimer -= dt;
    if (this.spawnCrystalTimer <= 0 && this.crystals.length < 11) {
      this.spawnCrystalTimer = 1.8 + Math.random() * 1.2;
      this.spawnDataCrystal(width, height);
    }

    // Determine max score for Underdog
    let maxScore = 0;
    for (const s of this.saucers.values()) {
      if (s.score > maxScore) maxScore = s.score;
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();

    // 1. Update Saucers
    for (const p of active) {
      const s = this.saucers.get(p.id);
      if (!s) continue;

      s.animTimer += dt;
      if (s.moodTimer > 0) {
        s.moodTimer -= dt;
        if (s.moodTimer <= 0) s.mood = 'idle';
      }

      if (s.shuntCooldown > 0) s.shuntCooldown -= dt;

      // Underdog check: trailing by >= 35 pts
      s.isUnderdog = (maxScore - s.score >= 35);

      // Handle EMP stun
      if (s.stunTimer > 0) {
        s.stunTimer -= dt;
        s.angle += 14 * dt; // Wild spin
        s.vx *= 0.93;
        s.vy *= 0.93;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (Math.random() < 0.4) {
          this.particles.emit(s.x, s.y, 2, '#FF1744');
        }
        continue;
      }

      const steer = this.input.getSteer(s.id);
      const isActionHeld = this.input.isPressed(s.id) || this.input.isActionPressed(s.id);

      // Angular rotation
      if (steer !== 0) {
        const turnRate = s.isUnderdog ? 4.5 : 3.8;
        s.angle += steer * turnRate * dt;
      }

      // Hold-to-Charge Quantum Phasing Surge
      if (isActionHeld && !s.isEmpStunned) {
        s.isCharging = true;
        const chargeRate = s.isUnderdog ? 1.4 : 1.0;
        s.chargeTime = Math.min(1.2, s.chargeTime + dt * chargeRate);
        s.mood = 'focused';

        // Cruise thrust forward while charging
        const thrust = 200;
        s.vx += Math.cos(s.angle) * thrust * dt;
        s.vy += Math.sin(s.angle) * thrust * dt;

        // Warp charge particles
        if (Math.random() < 0.5) {
          this.particles.emit(s.x, s.y, 2, '#E040FB');
        }

        // Overcharge Short-Circuit
        if (s.chargeTime >= 1.2) {
          s.isEmpStunned = true;
          s.stunTimer = 1.0;
          s.chargeTime = 0;
          s.isCharging = false;
          s.mood = 'shocked';
          s.moodTimer = 1.0;
          this.audio.playExplosion();
          this.particles.spawnExplosion(s.x, s.y, '#FF1744', 16);
        }
      } else if (s.isCharging) {
        // Action released -> Trigger Quantum Warp Surge!
        const chargeRatio = s.chargeTime / 1.0;
        s.isCharging = false;
        s.chargeTime = 0;

        const sweetMin = s.isUnderdog ? 0.50 : 0.72;
        const sweetMax = s.isUnderdog ? 1.00 : 0.98;
        const isSweet = chargeRatio >= sweetMin && chargeRatio <= sweetMax;

        if (isSweet) {
          // PERFECT SWEET SPOT: Hyper-Phasing Warp Surge!
          s.isPhasing = true;
          s.phaseTimer = 1.6;
          s.speed = s.baseMaxSpeed * 2.5;
          s.vx = Math.cos(s.angle) * s.speed;
          s.vy = Math.sin(s.angle) * s.speed;
          s.score += 20; // +20 Warp Surge Bonus!
          s.mood = 'triumph';
          s.moodTimer = 1.3;
          this.audio.playFanfare();
          this.particles.spawnExplosion(s.x, s.y, '#00E5FF', 16);
        } else if (chargeRatio > 0.25) {
          // Mini-phase
          s.isPhasing = true;
          s.phaseTimer = 0.8;
          s.speed = s.baseMaxSpeed * 1.4;
          s.vx = Math.cos(s.angle) * s.speed;
          s.vy = Math.sin(s.angle) * s.speed;
          this.audio.playScore();
          this.particles.emit(s.x, s.y, 6, '#B388FF');
        }
      } else {
        // Cruise decay
        const maxCruise = s.isUnderdog ? s.baseMaxSpeed * 1.25 : s.baseMaxSpeed;
        if (s.isPhasing) {
          s.phaseTimer -= dt;
          if (s.phaseTimer <= 0) s.isPhasing = false;
        } else {
          s.speed = Math.hypot(s.vx, s.vy);
          if (s.speed > maxCruise) {
            s.vx *= 0.95;
            s.vy *= 0.95;
          } else {
            // Gentle base cruise
            s.vx += Math.cos(s.angle) * 120 * dt;
            s.vy += Math.sin(s.angle) * 120 * dt;
          }
        }
      }

      // Drag
      s.vx *= Math.pow(0.97, dt * 60);
      s.vy *= Math.pow(0.97, dt * 60);
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Arena bounds
      const margin = 24;
      if (s.x < margin) { s.x = margin; s.vx = Math.abs(s.vx) * 0.7; this.audio.playBounce(); }
      if (s.x > width - margin) { s.x = width - margin; s.vx = -Math.abs(s.vx) * 0.7; this.audio.playBounce(); }
      if (s.y < margin + 35) { s.y = margin + 35; s.vy = Math.abs(s.vy) * 0.7; this.audio.playBounce(); }
      if (s.y > height - margin) { s.y = height - margin; s.vy = -Math.abs(s.vy) * 0.7; this.audio.playBounce(); }

      // Check Laser Collision if not phasing
      if (!s.isPhasing) {
        for (const laser of this.lasers) {
          const distToLaser = this.checkPointToSegmentDist(s.x, s.y, laser.centerX, laser.centerY, laser.angle, laser.length);
          if (distToLaser < s.radius + 6) {
            if (s.isUnderdog) {
              // Underdog absorbs laser energy safely into +10 pts!
              s.score += 10;
              this.audio.playScore();
              this.particles.emit(s.x, s.y, 8, '#FFD700');
            } else {
              // Severe laser zap!
              s.stunTimer = 1.1;
              s.score = Math.max(0, s.score - 20);
              s.vx = -Math.cos(laser.angle) * 260;
              s.vy = -Math.sin(laser.angle) * 260;
              s.mood = 'shocked';
              s.moodTimer = 1.2;
              this.audio.playExplosion();
              this.particles.spawnExplosion(s.x, s.y, '#FF1744', 16);
            }
            break;
          }
        }
      }

      // Check Data Crystals Collection
      for (let cIdx = this.crystals.length - 1; cIdx >= 0; cIdx--) {
        const c = this.crystals[cIdx];
        if (Math.hypot(s.x - c.x, s.y - c.y) < s.radius + c.radius) {
          const suddenDeathMult = this.roundTimer <= 12.0 ? 2 : 1;
          const ptsEarned = c.value * suddenDeathMult;
          s.score += ptsEarned;
          s.mood = 'happy';
          s.moodTimer = 1.0;
          this.audio.playScore();
          this.particles.spawnExplosion(c.x, c.y, c.color, 12);
          this.crystals.splice(cIdx, 1);
        }
      }
    }

    // 2. Physical Shunting & Laser Shoving Sabotage ($m_1 v_1 + m_2 v_2$)
    const saucerArray = Array.from(this.saucers.values());
    for (let i = 0; i < saucerArray.length; i++) {
      for (let j = i + 1; j < saucerArray.length; j++) {
        const s1 = saucerArray[i];
        const s2 = saucerArray[j];
        if (s1.stunTimer > 0 || s2.stunTimer > 0) continue;

        const dx = s2.x - s1.x;
        const dy = s2.y - s1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = s1.radius + s2.radius + 6;

        if (dist < minDist && dist > 0.001) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          s1.x -= nx * overlap * 0.5;
          s1.y -= ny * overlap * 0.5;
          s2.x += nx * overlap * 0.5;
          s2.y += ny * overlap * 0.5;

          // Check if one saucer is Phasing or traveling significantly faster (Laser Shunt Sabotage)
          const s1IsShunter = s1.isPhasing || Math.hypot(s1.vx, s1.vy) > Math.hypot(s2.vx, s2.vy) + 60;
          const s2IsShunter = s2.isPhasing || Math.hypot(s2.vx, s2.vy) > Math.hypot(s1.vx, s1.vy) + 60;

          if (s1IsShunter && s1.shuntCooldown <= 0) {
            s1.score += 30; // +30 Shunt Sabotage Bonus!
            s1.shuntCooldown = 1.0;
            s2.stunTimer = 0.8;
            s2.mood = 'shocked';
            s2.moodTimer = 1.2;
            s1.mood = 'triumph';
            s1.moodTimer = 1.2;
            this.audio.playExplosion();
            this.particles.spawnExplosion((s1.x + s2.x) * 0.5, (s1.y + s2.y) * 0.5, '#FF5252', 16);
          } else if (s2IsShunter && s2.shuntCooldown <= 0) {
            s2.score += 30;
            s2.shuntCooldown = 1.0;
            s1.stunTimer = 0.8;
            s1.mood = 'shocked';
            s1.moodTimer = 1.2;
            s2.mood = 'triumph';
            s2.moodTimer = 1.2;
            this.audio.playExplosion();
            this.particles.spawnExplosion((s1.x + s2.x) * 0.5, (s1.y + s2.y) * 0.5, '#FF5252', 16);
          } else {
            this.audio.playBounce();
            this.particles.emit((s1.x + s2.x) * 0.5, (s1.y + s2.y) * 0.5, 4, '#FFFFFF');
          }

          // Elastic impulse
          const kx = s1.vx - s2.vx;
          const ky = s1.vy - s2.vy;
          const pImpulse = 2 * (nx * kx + ny * ky) / 2;
          s1.vx -= pImpulse * nx * 0.85;
          s1.vy -= pImpulse * ny * 0.85;
          s2.vx += pImpulse * nx * 0.85;
          s2.vy += pImpulse * ny * 0.85;
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private checkPointToSegmentDist(px: number, py: number, x1: number, y1: number, angle: number, len: number): number {
    const x2 = x1 + Math.cos(angle) * len;
    const y2 = y1 + Math.sin(angle) * len;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);

    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
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

    const s = this.saucers.get(botId);
    if (!s || s.stunTimer > 0) return;

    // Find best data crystal
    let bestCrystal: DataCrystal | null = null;
    let bestScore = -999;
    for (const c of this.crystals) {
      const d = Math.hypot(c.x - s.x, c.y - s.y);
      const score = (c.value * 2.8) - d * 0.35;
      if (score > bestScore) {
        bestScore = score;
        bestCrystal = c;
      }
    }

    let targetX = bestCrystal ? bestCrystal.x : _width * 0.5;
    let targetY = bestCrystal ? bestCrystal.y : _height * 0.5;
    let holdAction = false;

    // Check if laser is encroaching
    let laserThreat = false;
    for (const laser of this.lasers) {
      const dLaser = this.checkPointToSegmentDist(s.x, s.y, laser.centerX, laser.centerY, laser.angle, laser.length);
      if (dLaser < 45) {
        laserThreat = true;
        // Phase through laser!
        if (s.chargeTime < 0.85) {
          holdAction = true;
        } else {
          holdAction = false; // Sweet spot release to warp through!
        }
        break;
      }
    }

    const dx = targetX - s.x;
    const dy = targetY - s.y;
    const targetAngle = Math.atan2(dy, dx);

    let angleDiff = targetAngle - s.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff -= Math.PI * 2;

    let turn = 0;
    if (Math.abs(angleDiff) > 0.08) {
      turn = angleDiff > 0 ? 1 : -1;
    }

    let delay = 0.24;
    if (difficulty === 'bot_easy') {
      delay = 0.42;
      if (Math.random() < 0.22) turn = -turn;
      if (Math.random() < 0.3) holdAction = false;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11;
      // Hard bot executes predictive laser warps & shunts rivals into beams
      if (laserThreat && s.chargeTime >= 0.82) {
        holdAction = false;
      }

      for (const other of this.saucers.values()) {
        if (other.id === botId) continue;
        if (Math.hypot(other.x - s.x, other.y - s.y) < 140 && Math.abs(angleDiff) < 0.3) {
          holdAction = false; // Unleash warp shunt!
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

    // 1. Vault Reactor Floor Gradient
    const floorGrad = ctx.createLinearGradient(0, 0, 0, height);
    floorGrad.addColorStop(0, theme.coreDark);
    floorGrad.addColorStop(1, theme.coreLight);
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, 0, width, height);

    // Procedural Circuit / Vector Grid lines
    ctx.strokeStyle = theme.gridLineColor;
    ctx.lineWidth = 1.2;
    for (let x = 0; x < width; x += 44) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 44) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Central Reactor Hub
    ctx.save();
    ctx.translate(width * 0.5, height * 0.52);
    ctx.fillStyle = '#1A232E';
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = theme.accentColor;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Render Revolving Defense Lasers
    for (const laser of this.lasers) {
      const endX = laser.centerX + Math.cos(laser.angle) * laser.length;
      const endY = laser.centerY + Math.sin(laser.angle) * laser.length;

      // Wide laser beam glow
      ctx.strokeStyle = theme.laserBeamColor;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(laser.centerX, laser.centerY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Sharp central core beam
      ctx.strokeStyle = theme.laserCoreColor;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = theme.laserCoreColor;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(laser.centerX, laser.centerY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Turret base
      ctx.fillStyle = '#37474F';
      ctx.beginPath();
      ctx.arc(laser.centerX, laser.centerY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.laserCoreColor;
      ctx.beginPath();
      ctx.arc(laser.centerX, laser.centerY, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Render Data Crystals
    for (const c of this.crystals) {
      ctx.save();
      ctx.translate(c.x, c.y);

      // Glow halo
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 12;

      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Pulsing outer orbit ring
      const pulseR = c.radius + 4 + Math.sin(this.roundTimer * 4 + c.pulsePhase) * 3;
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 9px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${c.value}`, 0, 3);
      ctx.restore();
    }

    // 5. Render Alien Probe Saucers & Mascot Pilots
    for (const [id, s] of this.saucers.entries()) {
      const p = this.players.find(pl => pl.id === id);
      const color = p ? p.color : '#00E5FF';
      const isBot = p ? p.type !== 'human' : false;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);

      // Floor shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(3, 4, s.radius + 4, s.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Phasing Holographic Ghost Aura
      if (s.isPhasing) {
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = '#E040FB';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#E040FB';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius + 10, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Saucer Outer Metallic Ring (Iridescent Disc)
      ctx.fillStyle = '#37474F';
      ctx.beginPath();
      ctx.ellipse(0, 0, s.radius + 4, s.radius * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Saucer Core Ring Body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, s.radius, s.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Spinning Thruster Lights on Saucer Perimeter
      for (let i = 0; i < 6; i++) {
        const lightAngle = (i / 6) * Math.PI * 2 + s.animTimer * 4;
        const lx = Math.cos(lightAngle) * (s.radius + 1);
        const ly = Math.sin(lightAngle) * (s.radius * 0.6);
        ctx.fillStyle = '#00E5FF';
        ctx.beginPath();
        ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Glass Cockpit Dome with Mascot Alien Inside
      ctx.save();
      ctx.rotate(Math.PI / 2);
      drawCharacter(ctx, 0, 0, 13, id, isBot, s.mood, s.animTimer, undefined);
      ctx.restore();

      // Underdog Quantum Shield
      if (s.isUnderdog) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Hold-to-Charge Phasing Warp Gauge
      if (s.isCharging) {
        const ratio = s.chargeTime / 1.0;
        const sweetMin = s.isUnderdog ? 0.50 : 0.72;
        const sweetMax = s.isUnderdog ? 1.00 : 0.98;
        const isSweet = ratio >= sweetMin && ratio <= sweetMax;

        ctx.strokeStyle = isSweet ? '#00E5FF' : (ratio > sweetMax ? '#FF1744' : '#FFD700');
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, s.radius + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ratio));
        ctx.stroke();
      }

      ctx.restore();

      // Floating Score & Status above saucer
      ctx.fillStyle = color;
      ctx.font = 'bold 13px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${s.score} pts`, s.x, s.y - 28);

      if (s.stunTimer > 0) {
        ctx.fillStyle = '#FF1744';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText('⚡ LASER ZAP!', s.x, s.y - 42);
      } else if (s.isPhasing) {
        ctx.fillStyle = '#E040FB';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText('⚡ WARP PHASE!', s.x, s.y - 42);
      }
    }

    // 6. Strict UI Overlays (Top-Center Safe Zone & Header Badge)
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
    ctx.fillText('ALIEN PROBE • MOTHERSHIP RECON', width / 2, badgeY + 18);
    ctx.restore();

    // 7. Bottom-Left Theme Pill: x: 20, y: height - 44, w: 170, h: 32
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

    // 8. Player Corner Cards (Safe offset y: height - 128, w: 130, h: 48)
    const cardY = height - 128;
    active.forEach((p, idx) => {
      const s = this.saucers.get(p.id);
      if (!s) return;

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
      ctx.fillText(`${s.score} pts`, cardX + 8, cardY + 38);

      ctx.fillStyle = '#B0BEC5';
      ctx.font = '10px Montserrat, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(s.isPhasing ? 'PHASED' : 'ONLINE', cardX + 122, cardY + 38);
      ctx.restore();
    });
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const s = this.saucers.get(p.id);
      return {
        playerId: p.id,
        score: s ? s.score : 0
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
        ? `Player ${typeof winnerId === 'number' ? winnerId + 1 : winnerId} extracted classified mothership intel with supreme phase-warp evasion!`
        : 'All recon probes were vaporized by mothership defense lasers!'
    };
  }
}
