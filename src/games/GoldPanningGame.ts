import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface RiverNugget {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'flake' | 'nugget' | 'motherlode';
  value: number;
  color: string;
  radius: number;
  pulsePhase: number;
}

interface RiverBoulder {
  x: number;
  y: number;
  radius: number;
}

interface Prospector {
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
  megaSiftTimer: number;
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
  waterGradTop: string;
  waterGradBottom: string;
  currentLineColor: string;
  boulderColor: string;
  bankColor: string;
  panColor: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Sierra Nevada Creek',
    icon: '🏞️',
    waterGradTop: '#0284C7',
    waterGradBottom: '#0369A1',
    currentLineColor: 'rgba(255, 255, 255, 0.28)',
    boulderColor: '#475569',
    bankColor: '#334155',
    panColor: '#64748B'
  },
  {
    name: 'Klondike Frozen Gulch',
    icon: '❄️',
    waterGradTop: '#0C4A6E',
    waterGradBottom: '#075985',
    currentLineColor: 'rgba(0, 229, 255, 0.35)',
    boulderColor: '#94A3B8',
    bankColor: '#E2E8F0',
    panColor: '#475569'
  },
  {
    name: 'Deadwood Canyon Creek',
    icon: '🏜️',
    waterGradTop: '#B45309',
    waterGradBottom: '#78350F',
    currentLineColor: 'rgba(255, 213, 79, 0.25)',
    boulderColor: '#5D4037',
    bankColor: '#3E2723',
    panColor: '#5D4037'
  }
];

export class GoldPanningGame extends BaseGame {
  private prospectors: Map<PlayerId, Prospector> = new Map();
  private nuggets: RiverNugget[] = [];
  private boulders: RiverBoulder[] = [];
  private nextNuggetId = 1;
  private nuggetIdCounter = 1;
  private spawnTimer = 0;
  private currentThemeIndex = 0;
  private screenShake = 0;
  private hitStopTimer = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private announcementText = '';
  private announcementTimer = 0;
  private waterFlowOffset = 0;

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
    this.prospectors.clear();
    this.nuggets = [];
    this.boulders = [];
    this.nextNuggetId = 1;
    this.nuggetIdCounter = 1;
    this.spawnTimer = 0.5;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.waterFlowOffset = 0;
    this.announcementText = '';
    this.announcementTimer = 0;

    // River boulders
    this.boulders = [
      { x: width * 0.3, y: height * 0.35, radius: 28 },
      { x: width * 0.7, y: height * 0.35, radius: 28 },
      { x: width * 0.3, y: height * 0.65, radius: 28 },
      { x: width * 0.7, y: height * 0.65, radius: 28 },
      { x: width * 0.5, y: height * 0.5, radius: 34 }
    ];

    // Initial nuggets
    for (let i = 0; i < 12; i++) {
      this.spawnNugget(width, height);
    }

    const active = this.getActivePlayers();
    const spawnPositions = [
      { x: width * 0.25, y: height * 0.25, angle: Math.PI * 0.25 },
      { x: width * 0.75, y: height * 0.25, angle: Math.PI * 0.75 },
      { x: width * 0.25, y: height * 0.75, angle: -Math.PI * 0.25 },
      { x: width * 0.75, y: height * 0.75, angle: -Math.PI * 0.75 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnPositions[idx % spawnPositions.length];
      this.prospectors.set(p.id, {
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
        megaSiftTimer: 0,
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

  private spawnNugget(width: number, height: number): void {
    const rand = Math.random();
    let type: 'flake' | 'nugget' | 'motherlode' = 'flake';
    let value = 20;
    let color = '#FFD54F';
    let radius = 10;

    if (rand < 0.55) {
      type = 'flake';
      value = 20;
      color = '#FFD54F';
      radius = 10;
    } else if (rand < 0.85) {
      type = 'nugget';
      value = 40;
      color = '#FFA000';
      radius = 13;
    } else {
      type = 'motherlode';
      value = 75;
      color = '#FF6F00';
      radius = 16;
    }

    this.nuggets.push({
      id: this.nextNuggetId++,
      x: 70 + Math.random() * (width - 140),
      y: -20,
      vx: (Math.random() - 0.5) * 45,
      vy: 80 + Math.random() * 60,
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
    const flowSpeed = isSuddenDeath ? 140 : 80;
    this.waterFlowOffset = (this.waterFlowOffset + flowSpeed * dt) % 120;

    // Spawn drifting gold nuggets
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.nuggets.length < 14) {
      this.spawnNugget(width, height);
      this.spawnTimer = 0.6 + Math.random() * 0.5;
    }

    // Update drifting nuggets downstream
    for (let i = this.nuggets.length - 1; i >= 0; i--) {
      const nug = this.nuggets[i];
      nug.x += nug.vx * dt;
      nug.y += (nug.vy + flowSpeed * 0.5) * dt;
      nug.pulsePhase += dt * 3.5;

      // River boundary bounce
      if (nug.x < 50 || nug.x > width - 50) nug.vx *= -1;

      // Recycle if drifted past bottom
      if (nug.y > height + 30) {
        this.nuggets.splice(i, 1);
      }
    }

    // Leader / Underdog calculation
    let topScore = -1;
    for (const p of this.prospectors.values()) {
      if (p.score > topScore) topScore = p.score;
    }

    // Update Prospectors
    for (const [id, p] of this.prospectors.entries()) {
      p.animTimer += dt;
      const isUnderdog = topScore >= 35 && p.score <= topScore - 30;

      if (p.spinTimer > 0) {
        p.spinTimer -= dt;
        p.angle += 12 * dt;
        p.vx *= Math.pow(0.92, dt * 60);
        p.vy *= Math.pow(0.92, dt * 60);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.mood = 'shocked';
        continue;
      }

      if (p.stunTimer > 0) {
        p.stunTimer -= dt;
        p.vx *= Math.pow(0.85, dt * 60);
        p.vy *= Math.pow(0.85, dt * 60);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.mood = 'shocked';
        continue;
      }

      if (p.overheatTimer > 0) {
        p.overheatTimer -= dt;
        p.mood = 'shocked';
      }

      if (p.megaSiftTimer > 0) {
        p.megaSiftTimer -= dt;
      }

      if (p.streakTimer > 0) {
        p.streakTimer -= dt;
        if (p.streakTimer <= 0) {
          p.streakCount = 0;
        }
      }

      const steerX = this.input.getSteer(id);
      const throttleY = -this.input.getThrottle(id);
      const isAction = this.input.isActionPressed(id) || this.input.isPressed(id);

      // River wading movement
      const speedMult = (isUnderdog ? 1.25 : 1.0) * (p.megaSiftTimer > 0 ? 1.35 : 1.0);
      const accel = 420 * speedMult;
      p.vx += steerX * accel * dt;
      p.vy += throttleY * accel * dt;

      // River current gentle pull downstream
      p.vy += 35 * dt;

      // Water friction
      p.vx *= Math.pow(0.90, dt * 60);
      p.vy *= Math.pow(0.90, dt * 60);

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Keep within river banks
      const pad = 48;
      p.x = Math.max(pad, Math.min(width - pad, p.x));
      p.y = Math.max(pad, Math.min(height - pad, p.y));

      // Boulder bounce
      for (const b of this.boulders) {
        const d = Math.hypot(p.x - b.x, p.y - b.y);
        const minDist = b.radius + 18;
        if (d < minDist && d > 0.001) {
          const nx = (p.x - b.x) / d;
          const ny = (p.y - b.y) / d;
          p.x = b.x + nx * minDist;
          p.y = b.y + ny * minDist;
          p.vx *= -0.6;
          p.vy *= -0.6;
        }
      }

      // Heading
      if (Math.hypot(p.vx, p.vy) > 18) {
        p.angle = Math.atan2(p.vy, p.vx);
      }

      // Hold-to-Charge Resonant Silt Swirl & Sweet Spot (72%–98%)
      if (isAction && p.overheatTimer <= 0) {
        p.isCharging = true;
        p.chargeTime += dt;
        p.mood = 'focused';

        // Silt swirl particles
        if (Math.random() < 0.35) {
          const sparkColor = p.chargeTime >= 0.72 && p.chargeTime <= 0.98 ? '#00E676' : '#FFD54F';
          this.particles.emit(
            p.x + (Math.random() - 0.5) * 22,
            p.y + (Math.random() - 0.5) * 22,
            2,
            sparkColor
          );
        }

        // Pan spill blowout if held too long
        if (p.chargeTime > 1.25) {
          p.overheatTimer = 0.95;
          p.chargeTime = 0;
          p.isCharging = false;
          p.mood = 'shocked';
          this.audio.playExplosion();
          this.screenShake = 6;
          this.particles.emit(p.x, p.y, 14, '#795548');
          this.announcementText = 'PAN SPILLED!';
          this.announcementTimer = 0.8;
        }
      } else if (p.isCharging) {
        // Released! Evaluate charge
        const sweetSpot = (isUnderdog && p.chargeTime >= 0.50 && p.chargeTime <= 1.05) ||
                          (!isUnderdog && p.chargeTime >= 0.72 && p.chargeTime <= 0.98);

        if (sweetSpot) {
          // Mother Lode Mega-Sift!
          p.megaSiftTimer = 1.3;
          p.score += 25;
          p.mood = 'triumph';
          this.audio.playScore();
          this.screenShake = 8;
          this.announcementText = 'MOTHER LODE MEGA-SIFT! +25';
          this.announcementTimer = 1.0;

          // Vacuum all nearby nuggets in 55px radius
          for (let n = this.nuggets.length - 1; n >= 0; n--) {
            const nug = this.nuggets[n];
            if (Math.hypot(p.x - nug.x, p.y - nug.y) < 55) {
              p.score += nug.value * (isSuddenDeath ? 2 : 1);
              this.particles.emit(nug.x, nug.y, 10, nug.color);
              this.nuggets.splice(n, 1);
            }
          }

          this.particles.emit(p.x, p.y, 16, '#00E676');
        } else {
          // Normal scoop
          p.megaSiftTimer = 0.35;
          this.audio.playTap();
        }

        p.chargeTime = 0;
        p.isCharging = false;
      } else {
        p.mood = 'idle';
      }

      // Regular Nugget Collection
      const pickupRange = (isUnderdog ? 34 : 25) + (p.megaSiftTimer > 0 ? 18 : 0);
      for (let n = this.nuggets.length - 1; n >= 0; n--) {
        const nug = this.nuggets[n];
        if (Math.hypot(p.x - nug.x, p.y - nug.y) < pickupRange + nug.radius) {
          const earned = nug.value * (isSuddenDeath ? 2 : 1);
          p.score += earned;
          p.streakCount = Math.min(3, p.streakCount + 1);
          p.streakTimer = 2.0;
          this.audio.playScore();
          this.particles.emit(nug.x, nug.y, 12, nug.color);
          this.nuggets.splice(n, 1);
          p.mood = 'triumph';
          break;
        }
      }
    }

    // Physical Prospector Bumping & Claim-Jumper Sabotage
    const prosArray = Array.from(this.prospectors.values());
    for (let i = 0; i < prosArray.length; i++) {
      for (let j = i + 1; j < prosArray.length; j++) {
        const p1 = prosArray[i];
        const p2 = prosArray[j];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 38;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          p1.x -= nx * overlap * 0.5;
          p1.y -= ny * overlap * 0.5;
          p2.x += nx * overlap * 0.5;
          p2.y += ny * overlap * 0.5;

          const kx = p1.vx - p2.vx;
          const ky = p1.vy - p2.vy;
          const pImpulse = 2 * (nx * kx + ny * ky) / 2;

          const impulse = Math.hypot(kx, ky);
          p1.vx -= pImpulse * nx * 1.35;
          p1.vy -= pImpulse * ny * 1.35;
          p2.vx += pImpulse * nx * 1.35;
          p2.vy += pImpulse * ny * 1.35;

          if (impulse > 120 || p1.megaSiftTimer > 0 || p2.megaSiftTimer > 0) {
            this.audio.playBounce();
            this.screenShake = Math.min(14, impulse * 0.06 + 4);
            this.hitStopTimer = 0.04;

            const attacker = p1.megaSiftTimer > p2.megaSiftTimer ? p1 : (p2.megaSiftTimer > p1.megaSiftTimer ? p2 : null);
            if (attacker) {
              const victim = attacker === p1 ? p2 : p1;
              attacker.score += 30;
              attacker.sabotageCount++;
              victim.stunTimer = 0.65;
              victim.score = Math.max(0, victim.score - 10);
              this.particles.emit((p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5, 14, '#FF1744');
              this.announcementText = 'CLAIM-JUMPER SHUNT! +30';
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

    const p = this.prospectors.get(botId);
    if (!p || p.spinTimer > 0 || p.stunTimer > 0) return;

    let delay = 0.23;
    let blunderChance = 0.12;

    if (difficulty === 'bot_easy') {
      delay = 0.42;
      blunderChance = 0.22;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
      blunderChance = 0.02;
    }

    // Target Selection: Closest high-value gold nugget
    let targetX = _width * 0.5;
    let targetY = _height * 0.5;
    let minDist = 99999;
    let closest: RiverNugget | null = null;

    for (const nug of this.nuggets) {
      const d = Math.hypot(nug.x - p.x, nug.y - p.y);
      const weight = nug.type === 'motherlode' ? 0.6 : (nug.type === 'nugget' ? 0.8 : 1.0);
      const scoreDist = d * weight;
      if (scoreDist < minDist) {
        minDist = scoreDist;
        closest = nug;
      }
    }

    if (closest) {
      targetX = closest.x;
      targetY = closest.y;
    }

    const dx = targetX - p.x;
    const dy = targetY - p.y;
    let steerX = 0;
    let throttleY = 0;

    if (Math.hypot(dx, dy) > 20) {
      steerX = Math.max(-1, Math.min(1, dx / 80));
      throttleY = Math.max(-1, Math.min(1, dy / 80));
    }

    // Sweet-spot timing
    let wantAction = (closest && Math.hypot(closest.x - p.x, closest.y - p.y) < 45) ||
                     (p.chargeTime > 0 && p.chargeTime < 0.85);

    if (p.chargeTime >= 0.78 && p.chargeTime <= 0.95) {
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

    ctx.save();
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

    // 1. Mountain River Water Gradient
    const waterGrad = ctx.createLinearGradient(0, 0, 0, height);
    waterGrad.addColorStop(0, theme.waterGradTop);
    waterGrad.addColorStop(1, theme.waterGradBottom);
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Flowing Water Current Lines
    ctx.strokeStyle = theme.currentLineColor;
    ctx.lineWidth = 2.5;
    for (let y = -40 + this.waterFlowOffset; y < height + 40; y += 45) {
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.bezierCurveTo(width * 0.35, y + 15, width * 0.65, y - 15, width - 30, y);
      ctx.stroke();
    }

    // 3. River Banks (Left & Right)
    ctx.fillStyle = theme.bankColor;
    ctx.fillRect(0, 0, 30, height);
    ctx.fillRect(width - 30, 0, 30, height);

    // 4. Granite Riverbed Boulders
    for (const b of this.boulders) {
      ctx.save();
      ctx.translate(b.x, b.y);

      // Boulder shadow & body
      ctx.fillStyle = theme.boulderColor;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // Boulder highlight rim
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-2, -2, b.radius * 0.85, Math.PI * 0.8, Math.PI * 1.8);
      ctx.stroke();
      ctx.restore();
    }

    // 5. Drifting Gold Nuggets
    for (const nug of this.nuggets) {
      ctx.save();
      ctx.translate(nug.x, nug.y);
      const bob = Math.sin(nug.pulsePhase) * 2.5;

      // Glow
      ctx.fillStyle = nug.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(0, bob, nug.radius * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Core Nugget
      ctx.fillStyle = nug.color;
      ctx.beginPath();
      ctx.arc(0, bob, nug.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Points label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${nug.value}`, 0, bob + nug.radius + 11);
      ctx.restore();
    }

    // 6. Prospectors with Gold Pans & Floppy Hats
    for (const [id, p] of this.prospectors.entries()) {
      ctx.save();
      ctx.translate(p.x, p.y);
      const pConfig = this.getPlayer(id);
      const color = pConfig?.color || '#EF4444';
      const isBot = pConfig ? pConfig.type !== 'human' : false;

      // Charge aura
      if (p.isCharging) {
        const pct = Math.min(1, p.chargeTime / 1.0);
        const sweetSpot = p.chargeTime >= 0.72 && p.chargeTime <= 0.98;
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

      // Mega-Sift aura
      if (p.megaSiftTimer > 0) {
        ctx.strokeStyle = '#00E676';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.rotate(p.angle);

      // Gold Pan in front of prospector
      ctx.fillStyle = theme.panColor;
      ctx.beginPath();
      ctx.arc(14, 0, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#CFD8DC';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Swirling water inside pan
      if (p.isCharging) {
        ctx.strokeStyle = '#FFD54F';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(14, 0, 7, p.animTimer * 12, p.animTimer * 12 + Math.PI);
        ctx.stroke();
      }

      // Prospector Body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Floppy Prospector Hat
      ctx.fillStyle = '#795548';
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      // Mascot face in center
      drawCharacter(ctx, 0, 0, 9, id, isBot, p.mood, p.animTimer, undefined);

      ctx.restore();

      // Score Pill Above Prospector
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.roundRect(p.x - 22, p.y - 36, 44, 16, 8);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.score}`, p.x, p.y - 24);
    }

    // 7. Central Announcement Banner
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

    // 8. UI Header Badge (y: 56, h: 28)
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
    ctx.fillText('⛏️ GOLD PANNING • RIVER RUSH ⛏️', width * 0.5, badgeY + 17);
    ctx.restore();

    // 9. Theme Pill (Bottom-Left: x: 20, y: height - 44, w: 170, h: 32)
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

    // 10. Corner Player Cards (y: height - 128, 130x48px)
    const cardW = 130;
    const cardH = 48;
    const cardY = height - 128;
    const active = this.getActivePlayers();

    active.forEach((p, idx) => {
      const pros = this.prospectors.get(p.id);
      if (!pros) return;

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
      ctx.fillText(`${pros.score} pts`, cardX + 28, cardY + 38);
      ctx.restore();
    });

    ctx.restore();
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.prospectors.entries()).map(([playerId, p]) => ({
      playerId,
      score: p.score
    }));
    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null
        ? `${this.getPlayer(winnerId)?.name} struck the mother lode with ${scores[0].score} pts!`
        : 'All river gold washed downstream!'
    };
  }
}
