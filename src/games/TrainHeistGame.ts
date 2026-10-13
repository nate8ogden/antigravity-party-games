import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface TrainCar {
  x: number;
  width: number;
  height: number;
  roofY: number;
}

interface LootItem {
  id: number;
  x: number;
  y: number;
  type: 'gold' | 'diamond' | 'safe';
  value: number;
  color: string;
  radius: number;
  pulsePhase: number;
}

interface OverheadHazard {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'watertower' | 'tunnel' | 'signal';
  hitPlayers: Set<PlayerId>;
}

interface TrainBandit {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  isGrounded: boolean;
  isDucking: boolean;
  chargeTime: number; // 0 to 1.3
  isCharging: boolean;
  overheatTimer: number;
  stuntTimer: number;
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
  skyGradTop: string;
  skyGradBottom: string;
  canyonColorA: string;
  canyonColorB: string;
  trainBodyColor: string;
  trainRoofColor: string;
  smokeColor: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Sunset Canyon Express',
    icon: '🌅',
    skyGradTop: '#BF360C',
    skyGradBottom: '#FF8F00',
    canyonColorA: '#8D2B0F',
    canyonColorB: '#5D1905',
    trainBodyColor: '#263238',
    trainRoofColor: '#455A64',
    smokeColor: 'rgba(255, 235, 238, 0.45)'
  },
  {
    name: 'Midnight Moonlit Heist',
    icon: '🌙',
    skyGradTop: '#080E21',
    skyGradBottom: '#1A237E',
    canyonColorA: '#101633',
    canyonColorB: '#090D21',
    trainBodyColor: '#1A1A24',
    trainRoofColor: '#2C2D3E',
    smokeColor: 'rgba(179, 229, 252, 0.35)'
  },
  {
    name: 'Snowy Mountain Pass',
    icon: '❄️',
    skyGradTop: '#37474F',
    skyGradBottom: '#78909C',
    canyonColorA: '#ECEFF1',
    canyonColorB: '#90A4AE',
    trainBodyColor: '#1E293B',
    trainRoofColor: '#E2E8F0',
    smokeColor: 'rgba(255, 255, 255, 0.5)'
  }
];

export class TrainHeistGame extends BaseGame {
  private bandits: Map<PlayerId, TrainBandit> = new Map();
  private loot: LootItem[] = [];
  private hazards: OverheadHazard[] = [];
  private trainCars: TrainCar[] = [];
  private nextLootId = 1;
  private nextHazardId = 1;
  private lootSpawnTimer = 0;
  private hazardSpawnTimer = 0;
  private trainSpeed = 380;
  private trainOffset = 0;
  private currentThemeIndex = 0;
  private screenShake = 0;
  private hitStopTimer = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private announcementText = '';
  private announcementTimer = 0;

  private readonly BASE_ROOF_Y = 380;
  private readonly GRAVITY = 1200;

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
    this.bandits.clear();
    this.loot = [];
    this.hazards = [];
    this.nextLootId = 1;
    this.nextHazardId = 1;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.trainOffset = 0;
    this.trainSpeed = 380;
    this.lootSpawnTimer = 0.6;
    this.hazardSpawnTimer = 1.8;
    this.announcementText = '';
    this.announcementTimer = 0;

    // Train Cars definition
    this.trainCars = [];
    const carWidth = 190;
    const gap = 30;
    for (let i = 0; i < 5; i++) {
      this.trainCars.push({
        x: i * (carWidth + gap) + 40,
        width: carWidth,
        height: 120,
        roofY: this.BASE_ROOF_Y
      });
    }

    // Seed initial loot
    for (let i = 0; i < 10; i++) {
      this.spawnLoot(width, height);
    }

    const active = this.getActivePlayers();
    const spawnOffsets = [width * 0.2, width * 0.4, width * 0.6, width * 0.8];

    active.forEach((p, idx) => {
      const sx = spawnOffsets[idx % spawnOffsets.length];
      this.bandits.set(p.id, {
        id: p.id,
        x: sx,
        y: this.BASE_ROOF_Y,
        vx: 0,
        vy: 0,
        score: 0,
        isGrounded: true,
        isDucking: false,
        chargeTime: 0,
        isCharging: false,
        overheatTimer: 0,
        stuntTimer: 0,
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

  private spawnLoot(width: number, _height: number): void {
    const rand = Math.random();
    let type: 'gold' | 'diamond' | 'safe' = 'gold';
    let value = 20;
    let color = '#FFD54F';
    let radius = 12;

    if (rand < 0.55) {
      type = 'gold';
      value = 20;
      color = '#FFD54F';
      radius = 12;
    } else if (rand < 0.85) {
      type = 'diamond';
      value = 40;
      color = '#00E5FF';
      radius = 14;
    } else {
      type = 'safe';
      value = 75;
      color = '#E040FB';
      radius = 17;
    }

    const high = Math.random() < 0.45;
    this.loot.push({
      id: this.nextLootId++,
      x: width + 40 + Math.random() * 200,
      y: high ? this.BASE_ROOF_Y - 90 : this.BASE_ROOF_Y - 24,
      type,
      value,
      color,
      radius,
      pulsePhase: Math.random() * Math.PI * 2
    });
  }

  private spawnHazard(width: number): void {
    const types: ('watertower' | 'tunnel' | 'signal')[] = ['watertower', 'tunnel', 'signal'];
    const type = types[Math.floor(Math.random() * types.length)];
    let hWidth = 60;
    let hHeight = 36;
    let hY = this.BASE_ROOF_Y - 55;

    if (type === 'tunnel') {
      hWidth = 140;
      hHeight = 44;
      hY = this.BASE_ROOF_Y - 60;
    } else if (type === 'signal') {
      hWidth = 35;
      hHeight = 45;
      hY = this.BASE_ROOF_Y - 50;
    }

    this.hazards.push({
      id: this.nextHazardId++,
      x: width + 80,
      y: hY,
      width: hWidth,
      height: hHeight,
      type,
      hitPlayers: new Set()
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
    this.trainSpeed = isSuddenDeath ? 540 : 380;
    this.trainOffset = (this.trainOffset + this.trainSpeed * dt) % (220);

    // Replenish loot
    this.lootSpawnTimer -= dt;
    if (this.lootSpawnTimer <= 0 && this.loot.length < 12) {
      this.spawnLoot(width, height);
      this.lootSpawnTimer = 0.8 + Math.random() * 0.6;
    }

    // Spawn hazards
    this.hazardSpawnTimer -= dt;
    if (this.hazardSpawnTimer <= 0) {
      this.spawnHazard(width);
      this.hazardSpawnTimer = 2.0 + Math.random() * 1.4;
    }

    // Scroll loot
    for (let i = this.loot.length - 1; i >= 0; i--) {
      const item = this.loot[i];
      item.x -= this.trainSpeed * dt;
      item.pulsePhase += dt * 4;
      if (item.x < -60) {
        this.loot.splice(i, 1);
      }
    }

    // Scroll hazards
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const haz = this.hazards[i];
      haz.x -= this.trainSpeed * dt;
      if (haz.x < -160) {
        this.hazards.splice(i, 1);
      }
    }

    // Leader / Underdog calculation
    let topScore = -1;
    for (const b of this.bandits.values()) {
      if (b.score > topScore) topScore = b.score;
    }

    // Update Bandits
    for (const [id, b] of this.bandits.entries()) {
      b.animTimer += dt;
      const isUnderdog = topScore >= 35 && b.score <= topScore - 30;

      if (b.spinTimer > 0) {
        b.spinTimer -= dt;
        b.vx *= Math.pow(0.92, dt * 60);
        b.x += b.vx * dt;
        b.mood = 'shocked';
        continue;
      }

      if (b.stunTimer > 0) {
        b.stunTimer -= dt;
        b.vx *= Math.pow(0.85, dt * 60);
        b.x += b.vx * dt;
        b.mood = 'shocked';
        continue;
      }

      if (b.overheatTimer > 0) {
        b.overheatTimer -= dt;
        b.mood = 'shocked';
      }

      if (b.stuntTimer > 0) {
        b.stuntTimer -= dt;
      }

      if (b.streakTimer > 0) {
        b.streakTimer -= dt;
        if (b.streakTimer <= 0) {
          b.streakCount = 0;
        }
      }

      const steerX = this.input.getSteer(id);
      const throttleY = this.input.getThrottle(id);
      const isAction = this.input.isActionPressed(id) || this.input.isPressed(id);

      // Horizontal running with inertia
      const speedMult = (isUnderdog ? 1.25 : 1.0) * (b.stuntTimer > 0 ? 1.4 : 1.0);
      const runSpeed = 440 * speedMult;
      b.vx += steerX * runSpeed * dt;
      b.vx *= Math.pow(0.91, dt * 60);
      b.x += b.vx * dt;

      // Keep within train visible deck
      const pad = 44;
      b.x = Math.max(pad, Math.min(width - pad, b.x));

      // Ducking input
      b.isDucking = b.isGrounded && throttleY < -0.3;

      // Hold-to-Charge Super Jump & Sweet Spot (72%–98%)
      if (isAction && b.isGrounded && b.overheatTimer <= 0) {
        b.isCharging = true;
        b.chargeTime += dt;
        b.mood = 'focused';

        // Sparks
        if (Math.random() < 0.35) {
          const sparkColor = b.chargeTime >= 0.72 && b.chargeTime <= 0.98 ? '#00E676' : '#FFD54F';
          this.particles.emit(b.x, b.y, 2, sparkColor);
        }

        // Slip blowout if held too long
        if (b.chargeTime > 1.25) {
          b.overheatTimer = 0.95;
          b.chargeTime = 0;
          b.isCharging = false;
          b.mood = 'shocked';
          this.audio.playExplosion();
          this.screenShake = 6;
          this.particles.emit(b.x, b.y, 12, '#FF3D00');
          this.announcementText = 'FOOTING SLIP!';
          this.announcementTimer = 0.8;
        }
      } else if (b.isCharging) {
        // Released! Evaluate jump force
        const sweetSpot = (isUnderdog && b.chargeTime >= 0.50 && b.chargeTime <= 1.05) ||
                          (!isUnderdog && b.chargeTime >= 0.72 && b.chargeTime <= 0.98);

        if (sweetSpot) {
          // Hyper-Rooftop Leap!
          b.vy = -620;
          b.isGrounded = false;
          b.stuntTimer = 1.2;
          b.score += 25;
          b.mood = 'triumph';
          this.audio.playScore();
          this.screenShake = 8;
          this.announcementText = 'HYPER ROOFTOP LEAP! +25';
          this.announcementTimer = 1.0;
          this.particles.emit(b.x, b.y, 16, '#00E676');

          // Vacuum airborne loot within 50px
          for (let l = this.loot.length - 1; l >= 0; l--) {
            const item = this.loot[l];
            if (Math.hypot(b.x - item.x, b.y - item.y) < 55) {
              b.score += item.value * (isSuddenDeath ? 2 : 1);
              this.loot.splice(l, 1);
              this.particles.emit(item.x, item.y, 8, item.color);
            }
          }
        } else {
          // Normal jump
          b.vy = -450;
          b.isGrounded = false;
          b.stuntTimer = 0.3;
          this.audio.playTap();
        }

        b.chargeTime = 0;
        b.isCharging = false;
      } else {
        b.mood = 'idle';
      }

      // Vertical Gravity & Roof Collision
      if (!b.isGrounded) {
        b.vy += this.GRAVITY * dt;
        b.y += b.vy * dt;

        if (b.y >= this.BASE_ROOF_Y) {
          b.y = this.BASE_ROOF_Y;
          b.vy = 0;
          b.isGrounded = true;
          this.particles.emit(b.x, b.y, 4, '#B0BEC5');
        }
      }

      // Hazard Collision (Overhead water towers, tunnels, signals)
      if (!isUnderdog && b.stuntTimer <= 0) {
        for (const haz of this.hazards) {
          if (haz.hitPlayers.has(id)) continue;
          if (Math.abs(b.x - haz.x) < haz.width * 0.5 + 14) {
            // Check vertical collision: if not ducking or airborne into beam
            if (!b.isDucking || b.y < this.BASE_ROOF_Y - 10) {
              haz.hitPlayers.add(id);
              b.spinTimer = 1.1;
              b.score = Math.max(0, b.score - 10);
              this.audio.playBounce();
              this.screenShake = 8;
              this.particles.emit(b.x, b.y - 15, 12, '#EF4444');
              this.announcementText = 'CLOBBERED!';
              this.announcementTimer = 0.8;
              break;
            }
          }
        }
      }

      // Loot Pickup
      const pickupRange = (isUnderdog ? 34 : 26) + (b.stuntTimer > 0 ? 18 : 0);
      for (let l = this.loot.length - 1; l >= 0; l--) {
        const item = this.loot[l];
        if (Math.hypot(b.x - item.x, b.y - item.y) < pickupRange + item.radius) {
          const earned = item.value * (isSuddenDeath ? 2 : 1);
          b.score += earned;
          b.streakCount = Math.min(3, b.streakCount + 1);
          b.streakTimer = 2.0;
          this.audio.playScore();
          this.particles.emit(item.x, item.y, 10, item.color);
          this.loot.splice(l, 1);
          b.mood = 'triumph';
          break;
        }
      }
    }

    // Physical Bandit Collision & Head-Stomping Sabotage
    const banditArray = Array.from(this.bandits.values());
    for (let i = 0; i < banditArray.length; i++) {
      for (let j = i + 1; j < banditArray.length; j++) {
        const b1 = banditArray[i];
        const b2 = banditArray[j];
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 38;

        if (dist < minDist && dist > 0.001) {
          // Check if head stomp: b1 landing on b2 or vice-versa
          if (b1.vy > 100 && b1.y < b2.y - 14) {
            b1.vy = -380; // bounce up
            b1.score += 30;
            b1.sabotageCount++;
            b2.stunTimer = 0.7;
            b2.score = Math.max(0, b2.score - 10);
            this.audio.playBounce();
            this.screenShake = 9;
            this.particles.emit(b2.x, b2.y - 10, 14, '#FF1744');
            this.announcementText = 'ROOFTOP HEAD STOMP! +30';
            this.announcementTimer = 1.0;
            continue;
          } else if (b2.vy > 100 && b2.y < b1.y - 14) {
            b2.vy = -380;
            b2.score += 30;
            b2.sabotageCount++;
            b1.stunTimer = 0.7;
            b1.score = Math.max(0, b1.score - 10);
            this.audio.playBounce();
            this.screenShake = 9;
            this.particles.emit(b1.x, b1.y - 10, 14, '#FF1744');
            this.announcementText = 'ROOFTOP HEAD STOMP! +30';
            this.announcementTimer = 1.0;
            continue;
          }

          // Horizontal body shunting
          const nx = dx / dist;
          const overlap = minDist - dist;
          b1.x -= nx * overlap * 0.5;
          b2.x += nx * overlap * 0.5;

          const kx = b1.vx - b2.vx;
          b1.vx -= kx * 1.25;
          b2.vx += kx * 1.25;

          if (Math.abs(kx) > 120 || b1.stuntTimer > 0 || b2.stuntTimer > 0) {
            this.audio.playBounce();
            this.screenShake = 6;
            this.hitStopTimer = 0.04;

            const attacker = b1.stuntTimer > b2.stuntTimer ? b1 : (b2.stuntTimer > b1.stuntTimer ? b2 : null);
            if (attacker) {
              const victim = attacker === b1 ? b2 : b1;
              attacker.score += 30;
              attacker.sabotageCount++;
              victim.stunTimer = 0.6;
              victim.score = Math.max(0, victim.score - 10);
              this.particles.emit((b1.x + b2.x) * 0.5, b1.y, 14, '#FF1744');
              this.announcementText = 'ROOFTOP SHUNT! +30';
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

    const b = this.bandits.get(botId);
    if (!b || b.spinTimer > 0 || b.stunTimer > 0) return;

    let delay = 0.23;
    let blunderChance = 0.12;

    if (difficulty === 'bot_easy') {
      delay = 0.42;
      blunderChance = 0.22;
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
      blunderChance = 0.02;
    }

    // Look for imminent overhead hazards
    const upcomingHaz = this.hazards.find(h => h.x > b.x && h.x < b.x + 140);
    let wantDuck = false;
    let wantJump = false;

    if (upcomingHaz) {
      if (upcomingHaz.x < b.x + 80) {
        wantDuck = true;
      }
    } else {
      // Hunt nearest loot
      let closestLoot: LootItem | null = null;
      let minDist = 99999;
      for (const item of this.loot) {
        const d = Math.hypot(item.x - b.x, item.y - b.y);
        if (d < minDist) {
          minDist = d;
          closestLoot = item;
        }
      }

      if (closestLoot) {
        if (closestLoot.y < this.BASE_ROOF_Y - 40 && Math.abs(closestLoot.x - b.x) < 70) {
          wantJump = true;
        }
      }
    }

    let steerX = 0;
    if (upcomingHaz) {
      steerX = -0.5; // pull back slightly
    } else {
      steerX = 0.5; // press forward with train
    }

    // Hold-to-charge release at sweet spot
    let wantAction = wantJump || (b.chargeTime > 0 && b.chargeTime < 0.85);
    if (b.chargeTime >= 0.78 && b.chargeTime <= 0.95) {
      wantAction = false;
    }

    if (Math.random() < blunderChance) {
      wantDuck = Math.random() < 0.3;
      wantAction = Math.random() < 0.3;
      steerX += (Math.random() - 0.5) * 0.8;
    }

    this.input.setBotInput(botId, wantAction, steerX, wantDuck ? -1 : 0, wantAction);
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

    // 1. Canyon Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, theme.skyGradTop);
    skyGrad.addColorStop(1, theme.skyGradBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Parallax Canyon Ridge Mountains
    ctx.fillStyle = theme.canyonColorA;
    ctx.beginPath();
    ctx.moveTo(0, 220);
    ctx.lineTo(width * 0.2, 170);
    ctx.lineTo(width * 0.45, 230);
    ctx.lineTo(width * 0.75, 160);
    ctx.lineTo(width, 220);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fill();

    // 3. Locomotive Smokestack Plumes
    ctx.fillStyle = theme.smokeColor;
    for (let i = 0; i < 6; i++) {
      const sx = width * 0.9 - ((this.trainOffset * 2.5 + i * 90) % (width * 1.2));
      const sy = 280 - i * 16;
      ctx.beginPath();
      ctx.arc(sx, sy, 22 + i * 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Speeding Train Cars
    const carW = 200;
    const gap = 24;
    const totalW = carW + gap;

    for (let x = -carW + (this.trainOffset % totalW); x < width + carW; x += totalW) {
      // Car Body
      ctx.fillStyle = theme.trainBodyColor;
      ctx.fillRect(x, this.BASE_ROOF_Y, carW, 140);

      // Car Roof Planks
      ctx.fillStyle = theme.trainRoofColor;
      ctx.fillRect(x, this.BASE_ROOF_Y - 8, carW, 12);

      // Steel Rivets
      ctx.fillStyle = '#CFD8DC';
      for (let rx = x + 10; rx < x + carW; rx += 25) {
        ctx.beginPath();
        ctx.arc(rx, this.BASE_ROOF_Y + 12, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Windows
      ctx.fillStyle = '#FFE082';
      ctx.fillRect(x + 25, this.BASE_ROOF_Y + 35, 30, 24);
      ctx.fillRect(x + 85, this.BASE_ROOF_Y + 35, 30, 24);
      ctx.fillRect(x + 145, this.BASE_ROOF_Y + 35, 30, 24);

      // Car Coupler
      ctx.fillStyle = '#212121';
      ctx.fillRect(x + carW, this.BASE_ROOF_Y + 70, gap, 14);
    }

    // 5. Overhead Hazards (Water Towers, Tunnels, Signals)
    for (const haz of this.hazards) {
      ctx.save();
      ctx.translate(haz.x, haz.y);

      if (haz.type === 'watertower') {
        // Wooden water tower tank
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(-haz.width * 0.5, -haz.height * 0.5, haz.width, haz.height);
        ctx.strokeStyle = '#D7CCC8';
        ctx.lineWidth = 2;
        ctx.strokeRect(-haz.width * 0.5, -haz.height * 0.5, haz.width, haz.height);
        // Spout
        ctx.fillStyle = '#455A64';
        ctx.fillRect(-haz.width * 0.5 - 12, 0, 12, 6);
      } else if (haz.type === 'tunnel') {
        // Low stone arch
        ctx.fillStyle = '#37474F';
        ctx.fillRect(-haz.width * 0.5, -haz.height * 0.5, haz.width, haz.height);
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 3;
        ctx.strokeRect(-haz.width * 0.5, -haz.height * 0.5, haz.width, haz.height);
      } else {
        // Red railway signal
        ctx.fillStyle = '#212121';
        ctx.fillRect(-haz.width * 0.5, -haz.height * 0.5, haz.width, haz.height);
        ctx.fillStyle = '#D32F2F';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DUCK!', 0, -haz.height * 0.5 - 8);
      ctx.restore();
    }

    // 6. Floating Loot Items
    for (const item of this.loot) {
      ctx.save();
      ctx.translate(item.x, item.y);
      const bob = Math.sin(item.pulsePhase) * 3;

      // Glow
      ctx.fillStyle = item.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(0, bob, item.radius * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Core Item
      if (item.type === 'gold') {
        ctx.fillStyle = '#FFD54F';
        ctx.beginPath();
        ctx.arc(0, bob, item.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFA000';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (item.type === 'diamond') {
        ctx.fillStyle = '#00E5FF';
        ctx.fillRect(-item.radius * 0.7, bob - item.radius * 0.7, item.radius * 1.4, item.radius * 1.4);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-item.radius * 0.7, bob - item.radius * 0.7, item.radius * 1.4, item.radius * 1.4);
      } else {
        // Safe
        ctx.fillStyle = '#E040FB';
        ctx.fillRect(-item.radius * 0.8, bob - item.radius * 0.8, item.radius * 1.6, item.radius * 1.6);
        ctx.strokeStyle = '#FFD54F';
        ctx.lineWidth = 2;
        ctx.strokeRect(-item.radius * 0.8, bob - item.radius * 0.8, item.radius * 1.6, item.radius * 1.6);
      }

      // Value label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${item.value}`, 0, bob + item.radius + 12);
      ctx.restore();
    }

    // 7. Bandits with Mascot Faces & Cowboy Hats
    for (const [id, b] of this.bandits.entries()) {
      ctx.save();
      ctx.translate(b.x, b.y);
      const pConfig = this.getPlayer(id);
      const color = pConfig?.color || '#EF4444';
      const isBot = pConfig ? pConfig.type !== 'human' : false;

      // Charge aura
      if (b.isCharging) {
        const pct = Math.min(1, b.chargeTime / 1.0);
        const sweetSpot = b.chargeTime >= 0.72 && b.chargeTime <= 0.98;
        ctx.strokeStyle = sweetSpot ? '#00E676' : '#FFD54F';
        ctx.lineWidth = sweetSpot ? 4 : 2;
        ctx.beginPath();
        ctx.arc(0, -14, 22 + pct * 14, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = sweetSpot ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 213, 79, 0.15)';
        ctx.beginPath();
        ctx.arc(0, -14, 22 + pct * 14, 0, Math.PI * 2);
        ctx.fill();
      }

      // Stunt velocity aura
      if (b.stuntTimer > 0) {
        ctx.strokeStyle = '#00E676';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -14, 26, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (b.isDucking) {
        // Ducked posture
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, -8, 16, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#4E342E';
        ctx.fillRect(-14, -16, 28, 4);
      } else {
        // Upright bandit body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, -14, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Cowboy hat
        ctx.fillStyle = '#4E342E';
        ctx.beginPath();
        ctx.ellipse(0, -22, 18, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#3E2723';
        ctx.beginPath();
        ctx.arc(0, -26, 8, 0, Math.PI * 2);
        ctx.fill();

        // Mascot Face
        drawCharacter(ctx, 0, -14, 10, id, isBot, b.mood, b.animTimer, undefined);
      }

      ctx.restore();

      // Score Pill Above Bandit
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.roundRect(b.x - 22, b.y - (b.isDucking ? 32 : 46), 44, 16, 8);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${b.score}`, b.x, b.y - (b.isDucking ? 20 : 34));
    }

    // 8. Central Announcement Banner
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

    // 9. UI Header Badge (y: 56, h: 28)
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
    ctx.fillText('🚂 TRAIN HEIST • ROOFTOP RUNNER 🚂', width * 0.5, badgeY + 17);
    ctx.restore();

    // 10. Theme Pill (Bottom-Left: x: 20, y: height - 44, w: 170, h: 32)
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

    // 11. Corner Player Cards (y: height - 128, 130x48px)
    const cardW = 130;
    const cardH = 48;
    const cardY = height - 128;
    const active = this.getActivePlayers();

    active.forEach((p, idx) => {
      const b = this.bandits.get(p.id);
      if (!b) return;

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
      ctx.fillText(`${b.score} pts`, cardX + 28, cardY + 38);
      ctx.restore();
    });

    ctx.restore();
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.bandits.entries()).map(([playerId, b]) => ({
      playerId,
      score: b.score
    }));
    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null
        ? `${this.getPlayer(winnerId)?.name} rode the iron horse to riches with ${scores[0].score} pts!`
        : 'The locomotive rolled into the sunset!'
    };
  }
}
