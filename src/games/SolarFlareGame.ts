import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface SolarCore {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: 'prominence_spark' | 'flux_loop' | 'helios_core';
  value: number;
  color: string;
  pulsePhase: number;
}

interface CoronalFlareZone {
  x: number;
  y: number;
  radius: number;
  active: boolean;
  pulseTimer: number;
}

interface SailGlider {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  baseMaxSpeed: number;
  radius: number;
  temperature: number; // 0 to 100
  score: number;

  // Diamond Solar Sail Hold-to-Charge & Surge
  isCharging: boolean;
  chargeTime: number; // 0 to 1.2s
  isSurging: boolean;
  surgeTimer: number;
  isOverheated: boolean;
  overheatTimer: number;

  shuntCooldown: number;
  isUnderdog: boolean;

  // Mascot emotion & animation
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
}

interface StarTheme {
  id: string;
  name: string;
  icon: string;
  photosphereDark: string;
  photosphereLight: string;
  flareGlow: string;
  sailFill: string;
  sailEdge: string;
  sparkColor: string;
  fluxColor: string;
  heliosColor: string;
  accentColor: string;
}

const THEMES: StarTheme[] = [
  {
    id: 'sol_photosphere',
    name: 'Sol Photosphere ☀️',
    icon: '☀️',
    photosphereDark: '#120400',
    photosphereLight: '#3D1302',
    flareGlow: '#FF9800',
    sailFill: 'rgba(255, 235, 59, 0.45)',
    sailEdge: '#FFF59D',
    sparkColor: '#FFEB3B',
    fluxColor: '#FF9800',
    heliosColor: '#FFD700',
    accentColor: '#FFD700'
  },
  {
    id: 'betelgeuse_giant',
    name: 'Betelgeuse Supergiant 🔴',
    icon: '🔴',
    photosphereDark: '#180104',
    photosphereLight: '#3B050E',
    flareGlow: '#FF1744',
    sailFill: 'rgba(255, 82, 82, 0.45)',
    sailEdge: '#FF8A80',
    sparkColor: '#FF5252',
    fluxColor: '#E040FB',
    heliosColor: '#FFD600',
    accentColor: '#FF1744'
  },
  {
    id: 'sirius_hypergiant',
    name: 'Sirius Blue Hypergiant ⚡',
    icon: '⚡',
    photosphereDark: '#010A18',
    photosphereLight: '#072442',
    flareGlow: '#00E5FF',
    sailFill: 'rgba(0, 229, 255, 0.45)',
    sailEdge: '#80DEEA',
    sparkColor: '#00E5FF',
    fluxColor: '#7C4DFF',
    heliosColor: '#FFEA00',
    accentColor: '#00E5FF'
  }
];

export class SolarFlareGame extends BaseGame {
  public currentMapName: string = 'Sol Photosphere ☀️';
  private currentThemeIdx: number = 0;

  private gliders: Map<PlayerId, SailGlider> = new Map();
  private cores: SolarCore[] = [];
  private flareZones: CoronalFlareZone[] = [];
  private coreIdCounter: number = 0;
  private spawnCoreTimer: number = 1.0;

  // Solar flare cycle
  private flareCycleTimer: number = 5.0;
  private isFlareErupting: boolean = false;
  private flareIntensity: number = 0;

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
    this.gliders.clear();
    this.cores = [];
    this.flareZones = [];
    this.coreIdCounter = 0;
    this.spawnCoreTimer = 1.0;
    this.flareCycleTimer = 4.5;
    this.isFlareErupting = false;
    this.flareIntensity = 0;

    // 3 Coronal Mass Ejection Hazard zones
    this.flareZones = [
      { x: width * 0.25, y: height * 0.40, radius: 48, active: false, pulseTimer: 0 },
      { x: width * 0.50, y: height * 0.65, radius: 56, active: false, pulseTimer: 1.2 },
      { x: width * 0.75, y: height * 0.38, radius: 48, active: false, pulseTimer: 2.4 }
    ];

    // Spawn 10 initial solar cores
    for (let i = 0; i < 10; i++) {
      this.spawnSolarCore(width, height);
    }

    const active = this.getActivePlayers();
    const spawnPositions = [
      { x: width * 0.20, y: height * 0.76, angle: -Math.PI * 0.25 },
      { x: width * 0.80, y: height * 0.28, angle: Math.PI * 0.75 },
      { x: width * 0.20, y: height * 0.28, angle: Math.PI * 0.25 },
      { x: width * 0.80, y: height * 0.76, angle: -Math.PI * 0.75 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnPositions[idx % spawnPositions.length];
      this.gliders.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: pos.angle,
        speed: 0,
        baseMaxSpeed: 235,
        radius: 17,
        temperature: 20,
        score: 0,

        isCharging: false,
        chargeTime: 0,
        isSurging: false,
        surgeTimer: 0,
        isOverheated: false,
        overheatTimer: 0,

        shuntCooldown: 0,
        isUnderdog: false,

        mood: 'idle',
        moodTimer: 0,
        animTimer: idx * 0.3
      });

      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  private spawnSolarCore(width: number, height: number): void {
    const roll = Math.random();
    const theme = THEMES[this.currentThemeIdx];

    let type: SolarCore['type'] = 'prominence_spark';
    let val = 20;
    let rad = 11;
    let col = theme.sparkColor;

    if (roll < 0.20) {
      type = 'helios_core';
      val = 75;
      rad = 16;
      col = theme.heliosColor;
    } else if (roll < 0.55) {
      type = 'flux_loop';
      val = 40;
      rad = 13;
      col = theme.fluxColor;
    }

    this.cores.push({
      id: ++this.coreIdCounter,
      x: 60 + Math.random() * (width - 120),
      y: 70 + Math.random() * (height - 140),
      vx: (Math.random() - 0.5) * 25,
      vy: (Math.random() - 0.5) * 25,
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

    // Update solar flare eruption cycle
    this.flareCycleTimer -= dt;
    if (this.flareCycleTimer <= 0) {
      this.isFlareErupting = !this.isFlareErupting;
      this.flareCycleTimer = this.isFlareErupting ? 4.0 : 5.5;

      if (this.isFlareErupting) {
        this.audio.playExplosion();
      }
    }

    const targetIntensity = this.isFlareErupting ? 1.0 : 0.15;
    this.flareIntensity += (targetIntensity - this.flareIntensity) * 2.5 * dt;

    // Update flare zones
    for (const zone of this.flareZones) {
      zone.pulseTimer += dt * 3;
      zone.active = this.isFlareErupting;
    }

    // Maintain solar cores
    this.spawnCoreTimer -= dt;
    if (this.spawnCoreTimer <= 0 && this.cores.length < 11) {
      this.spawnCoreTimer = 1.8 + Math.random() * 1.2;
      this.spawnSolarCore(width, height);
    }

    // Determine max score for Underdog
    let maxScore = 0;
    for (const g of this.gliders.values()) {
      if (g.score > maxScore) maxScore = g.score;
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();

    // 1. Update Gliders
    for (const p of active) {
      const g = this.gliders.get(p.id);
      if (!g) continue;

      g.animTimer += dt;
      if (g.moodTimer > 0) {
        g.moodTimer -= dt;
        if (g.moodTimer <= 0) g.mood = 'idle';
      }

      if (g.shuntCooldown > 0) g.shuntCooldown -= dt;

      // Underdog check: trailing by >= 35 pts
      g.isUnderdog = (maxScore - g.score >= 35);

      // Handle Overheat State
      if (g.overheatTimer > 0) {
        g.overheatTimer -= dt;
        g.temperature = Math.max(20, g.temperature - 45 * dt);
        g.vx *= 0.93;
        g.vy *= 0.93;
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        if (Math.random() < 0.4) {
          this.particles.emit(g.x, g.y, 2, '#FF1744');
        }
        continue;
      }

      const steer = this.input.getSteer(g.id);
      const isActionHeld = this.input.isPressed(g.id) || this.input.isActionPressed(g.id);

      // Turning
      if (steer !== 0) {
        const turnRate = g.isUnderdog ? 4.6 : 3.8;
        g.angle += steer * turnRate * dt;
      }

      // Hold-to-Charge Diamond Solar Sail & Coronal Surge
      if (isActionHeld && !g.isOverheated) {
        g.isCharging = true;
        const chargeRate = g.isUnderdog ? 1.4 : 1.0;
        g.chargeTime = Math.min(1.2, g.chargeTime + dt * chargeRate);
        g.mood = 'focused';

        // Radiation pressure thrust forward while charging
        const thrust = 190;
        g.vx += Math.cos(g.angle) * thrust * dt;
        g.vy += Math.sin(g.angle) * thrust * dt;

        // Temperature increases while unfurling sail (underdog immune)
        if (!g.isUnderdog) {
          const heatRate = this.isFlareErupting ? 35 : 15;
          g.temperature += heatRate * dt;
        }

        // Particle sparks
        if (Math.random() < 0.5) {
          this.particles.emit(g.x, g.y, 2, THEMES[this.currentThemeIdx].flareGlow);
        }

        // Overheat meltdown
        if (g.chargeTime >= 1.2 || g.temperature >= 100) {
          g.isOverheated = true;
          g.overheatTimer = 1.1;
          g.chargeTime = 0;
          g.isCharging = false;
          g.mood = 'shocked';
          g.moodTimer = 1.0;
          this.audio.playExplosion();
          this.particles.spawnExplosion(g.x, g.y, '#FF1744', 16);
        }
      } else if (g.isCharging) {
        // Released -> Trigger Coronal Wind Super-Surge!
        const chargeRatio = g.chargeTime / 1.0;
        g.isCharging = false;
        g.chargeTime = 0;

        const sweetMin = g.isUnderdog ? 0.50 : 0.72;
        const sweetMax = g.isUnderdog ? 1.00 : 0.98;
        const isSweet = chargeRatio >= sweetMin && chargeRatio <= sweetMax;

        if (isSweet) {
          // PERFECT SWEET SPOT: Coronal Wind Super-Surge!
          g.isSurging = true;
          g.surgeTimer = 1.5;
          g.speed = g.baseMaxSpeed * 2.6;
          g.vx = Math.cos(g.angle) * g.speed;
          g.vy = Math.sin(g.angle) * g.speed;
          g.score += 20; // +20 Coronal Surge Bonus!
          g.temperature = Math.max(20, g.temperature - 30); // Cools down from perfect surge!
          g.mood = 'triumph';
          g.moodTimer = 1.2;
          this.audio.playFanfare();
          this.particles.spawnExplosion(g.x, g.y, '#FFD700', 16);
        } else if (chargeRatio > 0.25) {
          // Mini-surge
          g.isSurging = true;
          g.surgeTimer = 0.8;
          g.speed = g.baseMaxSpeed * 1.4;
          g.vx = Math.cos(g.angle) * g.speed;
          g.vy = Math.sin(g.angle) * g.speed;
          this.audio.playScore();
          this.particles.emit(g.x, g.y, 6, '#FFEB3B');
        }
      } else {
        // Natural heat dissipation
        g.temperature = Math.max(20, g.temperature - 30 * dt);

        if (g.isSurging) {
          g.surgeTimer -= dt;
          if (g.surgeTimer <= 0) g.isSurging = false;
        } else {
          // Base cruise decay
          const maxCruise = g.isUnderdog ? g.baseMaxSpeed * 1.25 : g.baseMaxSpeed;
          g.speed = Math.hypot(g.vx, g.vy);
          if (g.speed > maxCruise) {
            g.vx *= 0.95;
            g.vy *= 0.95;
          } else {
            // Gentle radiation drift
            g.vx += Math.cos(g.angle) * 120 * dt;
            g.vy += Math.sin(g.angle) * 120 * dt;
          }
        }
      }

      // Drag
      g.vx *= Math.pow(0.97, dt * 60);
      g.vy *= Math.pow(0.97, dt * 60);
      g.x += g.vx * dt;
      g.y += g.vy * dt;

      // Arena bounds
      const margin = 24;
      if (g.x < margin) { g.x = margin; g.vx = Math.abs(g.vx) * 0.7; this.audio.playBounce(); }
      if (g.x > width - margin) { g.x = width - margin; g.vx = -Math.abs(g.vx) * 0.7; this.audio.playBounce(); }
      if (g.y < margin + 35) { g.y = margin + 35; g.vy = Math.abs(g.vy) * 0.7; this.audio.playBounce(); }
      if (g.y > height - margin) { g.y = height - margin; g.vy = -Math.abs(g.vy) * 0.7; this.audio.playBounce(); }

      // Check Coronal Flare Hazard Zones
      if (this.isFlareErupting && !g.isSurging && !g.isUnderdog) {
        for (const zone of this.flareZones) {
          if (Math.hypot(g.x - zone.x, g.y - zone.y) < g.radius + zone.radius) {
            // Overheated by coronal eruption!
            g.isOverheated = true;
            g.overheatTimer = 1.2;
            g.temperature = 100;
            g.score = Math.max(0, g.score - 20);
            g.mood = 'shocked';
            g.moodTimer = 1.2;
            this.audio.playExplosion();
            this.particles.spawnExplosion(g.x, g.y, '#FF1744', 16);
            break;
          }
        }
      }

      // Check Solar Core Collection
      for (let cIdx = this.cores.length - 1; cIdx >= 0; cIdx--) {
        const c = this.cores[cIdx];
        if (Math.hypot(g.x - c.x, g.y - c.y) < g.radius + c.radius) {
          const suddenDeathMult = this.roundTimer <= 12.0 ? 2 : 1;
          const pts = c.value * suddenDeathMult;
          g.score += pts;
          g.mood = 'happy';
          g.moodTimer = 1.0;
          this.audio.playScore();
          this.particles.spawnExplosion(c.x, c.y, c.color, 12);
          this.cores.splice(cIdx, 1);
        }
      }
    }

    // 2. Physical Elastic Shunting & Thermal Shoving Sabotage ($m_1 v_1 + m_2 v_2$)
    const gliderArray = Array.from(this.gliders.values());
    for (let i = 0; i < gliderArray.length; i++) {
      for (let j = i + 1; j < gliderArray.length; j++) {
        const g1 = gliderArray[i];
        const g2 = gliderArray[j];
        if (g1.overheatTimer > 0 || g2.overheatTimer > 0) continue;

        const dx = g2.x - g1.x;
        const dy = g2.y - g1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = g1.radius + g2.radius + 6;

        if (dist < minDist && dist > 0.001) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          g1.x -= nx * overlap * 0.5;
          g1.y -= ny * overlap * 0.5;
          g2.x += nx * overlap * 0.5;
          g2.y += ny * overlap * 0.5;

          // Check if one glider is Surging or traveling significantly faster (Solar Shunt Sabotage)
          const g1IsShunter = g1.isSurging || Math.hypot(g1.vx, g1.vy) > Math.hypot(g2.vx, g2.vy) + 60;
          const g2IsShunter = g2.isSurging || Math.hypot(g2.vx, g2.vy) > Math.hypot(g1.vx, g1.vy) + 60;

          if (g1IsShunter && g1.shuntCooldown <= 0) {
            g1.score += 30; // +30 Sabotage Bonus!
            g1.shuntCooldown = 1.0;
            g2.temperature = Math.min(100, g2.temperature + 40);
            g2.overheatTimer = 0.8;
            g2.mood = 'shocked';
            g2.moodTimer = 1.2;
            g1.mood = 'triumph';
            g1.moodTimer = 1.2;
            this.audio.playExplosion();
            this.particles.spawnExplosion((g1.x + g2.x) * 0.5, (g1.y + g2.y) * 0.5, '#FF5252', 16);
          } else if (g2IsShunter && g2.shuntCooldown <= 0) {
            g2.score += 30;
            g2.shuntCooldown = 1.0;
            g1.temperature = Math.min(100, g1.temperature + 40);
            g1.overheatTimer = 0.8;
            g1.mood = 'shocked';
            g1.moodTimer = 1.2;
            g2.mood = 'triumph';
            g2.moodTimer = 1.2;
            this.audio.playExplosion();
            this.particles.spawnExplosion((g1.x + g2.x) * 0.5, (g1.y + g2.y) * 0.5, '#FF5252', 16);
          } else {
            this.audio.playBounce();
            this.particles.emit((g1.x + g2.x) * 0.5, (g1.y + g2.y) * 0.5, 4, '#FFFFFF');
          }

          // Elastic impulse
          const kx = g1.vx - g2.vx;
          const ky = g1.vy - g2.vy;
          const pImpulse = 2 * (nx * kx + ny * ky) / 2;
          g1.vx -= pImpulse * nx * 0.85;
          g1.vy -= pImpulse * ny * 0.85;
          g2.vx += pImpulse * nx * 0.85;
          g2.vy += pImpulse * ny * 0.85;
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

    const g = this.gliders.get(botId);
    if (!g || g.overheatTimer > 0) return;

    // Find best solar core
    let bestCore: SolarCore | null = null;
    let bestScore = -999;
    for (const c of this.cores) {
      const d = Math.hypot(c.x - g.x, c.y - g.y);
      const score = (c.value * 2.8) - d * 0.35;
      if (score > bestScore) {
        bestScore = score;
        bestCore = c;
      }
    }

    let targetX = bestCore ? bestCore.x : _width * 0.5;
    let targetY = bestCore ? bestCore.y : _height * 0.5;
    let holdAction = false;

    // Heat management & flare avoidance
    if (g.temperature < 70 && !(this.isFlareErupting && g.temperature > 50)) {
      if (g.chargeTime < 0.85) {
        holdAction = true;
      } else {
        holdAction = false; // Sweet spot release!
      }
    }

    // Coronal flare zone avoidance
    if (this.isFlareErupting && !g.isUnderdog) {
      for (const zone of this.flareZones) {
        const dZone = Math.hypot(zone.x - g.x, zone.y - g.y);
        if (dZone < zone.radius + 60) {
          const evadeAngle = Math.atan2(g.y - zone.y, g.x - zone.x);
          targetX = g.x + Math.cos(evadeAngle) * 90;
          targetY = g.y + Math.sin(evadeAngle) * 90;
        }
      }
    }

    const dx = targetX - g.x;
    const dy = targetY - g.y;
    const targetAngle = Math.atan2(dy, dx);

    let angleDiff = targetAngle - g.angle;
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
      // Hard bot executes predictive sweet spot surges into rivals
      for (const other of this.gliders.values()) {
        if (other.id === botId) continue;
        if (Math.hypot(other.x - g.x, other.y - g.y) < 140 && Math.abs(angleDiff) < 0.3) {
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

    // 1. Boiling Stellar Photosphere Background Gradient
    const photoGrad = ctx.createLinearGradient(0, 0, 0, height);
    photoGrad.addColorStop(0, theme.photosphereDark);
    photoGrad.addColorStop(1, theme.photosphereLight);
    ctx.fillStyle = photoGrad;
    ctx.fillRect(0, 0, width, height);

    // Stellar convection granules / plasma waves
    ctx.strokeStyle = theme.flareGlow;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.18 + this.flareIntensity * 0.25;
    for (let py = 50; py < height - 30; py += 42) {
      ctx.beginPath();
      for (let px = 0; px < width; px += 28) {
        const offset = Math.sin((px * 0.02) + (py * 0.018) + this.roundTimer * 2) * 8;
        if (px === 0) ctx.moveTo(px, py + offset);
        else ctx.lineTo(px, py + offset);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // 2. Coronal Mass Ejection Hazard Zones
    for (const zone of this.flareZones) {
      const pulseR = zone.radius + Math.sin(zone.pulseTimer) * 4;

      ctx.save();
      ctx.strokeStyle = zone.active ? '#FF1744' : theme.flareGlow;
      ctx.lineWidth = zone.active ? 3 : 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, pulseR, 0, Math.PI * 2);
      ctx.stroke();

      if (zone.active) {
        ctx.fillStyle = 'rgba(255, 23, 68, 0.22)';
        ctx.beginPath();
        ctx.arc(zone.x, zone.y, pulseR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠ CME FLARE ⚠', zone.x, zone.y + 3);
      }
      ctx.restore();
    }

    // 3. Render Solar Cores
    for (const c of this.cores) {
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

    // 4. Render Solar Gliders & Mascot Pilots
    for (const [id, g] of this.gliders.entries()) {
      const p = this.players.find(pl => pl.id === id);
      const color = p ? p.color : '#00E5FF';
      const isBot = p ? p.type !== 'human' : false;

      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle);

      // Surface shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(3, 4, g.radius + 4, g.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Diamond Solar Sail (Dynamic Unfurling on Charge / Surge)
      if (g.isCharging || g.isSurging) {
        ctx.save();
        ctx.fillStyle = theme.sailFill;
        ctx.strokeStyle = theme.sailEdge;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(18, 0);     // Bow tip
        ctx.lineTo(-4, -28);   // Starboard sail wing
        ctx.lineTo(-16, 0);    // Stern mast
        ctx.lineTo(-4, 28);    // Port sail wing
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Glider Main Hull (2.5D Sleek Aerodynamic Vessel)
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-12, -11);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-12, 11);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Glass Cockpit with Mascot Captain
      ctx.save();
      ctx.rotate(Math.PI / 2);
      drawCharacter(ctx, 0, 0, 13, id, isBot, g.mood, g.animTimer, undefined);
      ctx.restore();

      // Underdog Thermal Shield
      if (g.isUnderdog) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, g.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Coronal Super-Surge Golden Aura
      if (g.isSurging) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, g.radius + 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Hold-to-Charge Sail Gauge
      if (g.isCharging) {
        const ratio = g.chargeTime / 1.0;
        const sweetMin = g.isUnderdog ? 0.50 : 0.72;
        const sweetMax = g.isUnderdog ? 1.00 : 0.98;
        const isSweet = ratio >= sweetMin && ratio <= sweetMax;

        ctx.strokeStyle = isSweet ? '#00E5FF' : (ratio > sweetMax ? '#FF1744' : '#FFD700');
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, g.radius + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ratio));
        ctx.stroke();
      }

      ctx.restore();

      // Floating Score & Heat Gauge above glider
      ctx.fillStyle = color;
      ctx.font = 'bold 13px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${g.score} pts`, g.x, g.y - 28);

      // Temperature Bar
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(g.x - 18, g.y - 24, 36, 4);
      const heatRatio = Math.min(1, g.temperature / 100);
      ctx.fillStyle = heatRatio > 0.75 ? '#FF1744' : (heatRatio > 0.5 ? '#FF9800' : '#00E676');
      ctx.fillRect(g.x - 18, g.y - 24, heatRatio * 36, 4);

      if (g.overheatTimer > 0) {
        ctx.fillStyle = '#FF1744';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText('⚡ OVERHEAT!', g.x, g.y - 42);
      } else if (g.isSurging) {
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText('⚡ CORONAL SURGE!', g.x, g.y - 42);
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
    ctx.fillText('SOLAR FLARE • CORONAL GLIDER', width / 2, badgeY + 18);
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
      const g = this.gliders.get(p.id);
      if (!g) return;

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
      ctx.fillText(`${g.score} pts`, cardX + 8, cardY + 38);

      ctx.fillStyle = '#B0BEC5';
      ctx.font = '10px Montserrat, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(g.temperature)}°C`, cardX + 122, cardY + 38);
      ctx.restore();
    });
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const g = this.gliders.get(p.id);
      return {
        playerId: p.id,
        score: g ? g.score : 0
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
        ? `Player ${typeof winnerId === 'number' ? winnerId + 1 : winnerId} rode the scorching coronal plasma waves to solar supremacy!`
        : 'All solar gliders melted in the coronal flare!'
    };
  }
}
