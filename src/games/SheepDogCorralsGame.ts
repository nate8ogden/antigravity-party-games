import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type SheepThemeId = 'highland' | 'cyber' | 'savannah';

interface SheepTheme {
  id: SheepThemeId;
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  fieldLineColor: string;
  penBg: string;
  penBorder: string;
  gateColor: string;
  sheepBodyColor: string;
  sheepFaceColor: string;
  accentColor: string;
}

const THEMES: Record<SheepThemeId, SheepTheme> = {
  highland: {
    id: 'highland',
    name: 'Highland Pasture',
    icon: '🐑',
    bgGradTop: '#166534',
    bgGradBottom: '#14532D',
    fieldLineColor: '#15803D',
    penBg: 'rgba(30, 41, 59, 0.75)',
    penBorder: '#D97706',
    gateColor: '#F59E0B',
    sheepBodyColor: '#FFFFFF',
    sheepFaceColor: '#1E293B',
    accentColor: '#10B981'
  },
  cyber: {
    id: 'cyber',
    name: 'Neon Cyber Farm',
    icon: '⚡',
    bgGradTop: '#0F172A',
    bgGradBottom: '#020617',
    fieldLineColor: '#1E293B',
    penBg: 'rgba(15, 23, 42, 0.85)',
    penBorder: '#06B6D4',
    gateColor: '#22D3EE',
    sheepBodyColor: '#E0F2FE',
    sheepFaceColor: '#0369A1',
    accentColor: '#38BDF8'
  },
  savannah: {
    id: 'savannah',
    name: 'Sunset Savannah',
    icon: '🌅',
    bgGradTop: '#78350F',
    bgGradBottom: '#451A03',
    fieldLineColor: '#92400E',
    penBg: 'rgba(69, 26, 3, 0.8)',
    penBorder: '#F97316',
    gateColor: '#FBBF24',
    sheepBodyColor: '#FEF3C7',
    sheepFaceColor: '#451A03',
    accentColor: '#F59E0B'
  }
};

type SheepType = 'standard' | 'golden' | 'rainbow' | 'battering';

interface Sheep {
  id: number;
  type: SheepType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fleeVx: number;
  fleeVy: number;
  isCorralled: boolean;
  corralOwner: PlayerId | null;
  wobble: number;
  radius: number;
  points: number;
}

interface DogPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  barkCooldown: number;
  barkShockwave: {
    x: number;
    y: number;
    radius: number;
    maxRadius: number;
    active: boolean;
    isSuper: boolean;
  };
  chargeTime: number;
  isCharging: boolean;
  stunTimer: number;
  corralCount: number;
  score: number;
  mood: CharacterMood;
  moodTimer: number;
  botReactionTimer: number;
  botTargetSheepId: number | null;
}

interface CorralPen {
  ownerId: PlayerId;
  x: number;
  y: number;
  width: number;
  height: number;
  gateX: number;
  gateY: number;
}

export class SheepDogCorralsGame extends BaseGame {
  private currentThemeId: SheepThemeId = 'highland';
  private dogs: Map<PlayerId, DogPlayer> = new Map();
  private sheep: Sheep[] = [];
  private pens: CorralPen[] = [];
  private animTimer: number = 0;
  private freezeFrames: number = 0;
  private screenShake: number = 0;
  private suddenDeathTriggered: boolean = false;
  private rainbowSpawned: boolean = false;

  // Bound handler for cleanup
  private onKeyDownBound: (e: KeyboardEvent) => void;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.onKeyDownBound = this.handleKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDownBound);
  }

  public init(width: number, height: number): void {
    this.roundTimer = 55.0;
    this.isFinished = false;
    this.animTimer = 0;
    this.freezeFrames = 0;
    this.screenShake = 0;
    this.suddenDeathTriggered = false;
    this.rainbowSpawned = false;

    // Pick random initial theme
    const themeKeys: SheepThemeId[] = ['highland', 'cyber', 'savannah'];
    this.currentThemeId = themeKeys[Math.floor(Math.random() * themeKeys.length)];

    this.setupPens(width, height);
    this.setupDogs(width, height);
    this.setupSheep(width, height);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 't' || e.key === 'T') {
      this.cycleTheme();
    } else if (e.key === '1') {
      this.setTheme('highland');
    } else if (e.key === '2') {
      this.setTheme('cyber');
    } else if (e.key === '3') {
      this.setTheme('savannah');
    }
  }

  public cycleTheme(): void {
    const list: SheepThemeId[] = ['highland', 'cyber', 'savannah'];
    const curIdx = list.indexOf(this.currentThemeId);
    this.setTheme(list[(curIdx + 1) % list.length]);
  }

  public setTheme(id: SheepThemeId): void {
    if (this.currentThemeId !== id) {
      this.currentThemeId = id;
      this.audio.playTap();
      this.particles.emit(100, 300, 15, THEMES[id].accentColor);
    }
  }

  private setupPens(width: number, height: number): void {
    this.pens = [];
    const penW = 124;
    const penH = 92;

    // 4 Corner pens placed safely with ample inner arena space
    // Top-left
    this.pens.push({
      ownerId: 0,
      x: 14,
      y: 72,
      width: penW,
      height: penH,
      gateX: 14 + penW,
      gateY: 72 + penH / 2
    });
    // Top-right
    this.pens.push({
      ownerId: 1,
      x: width - penW - 14,
      y: 72,
      width: penW,
      height: penH,
      gateX: width - penW - 14,
      gateY: 72 + penH / 2
    });
    // Bottom-left (placed high enough so it doesn't collide with theme pill at y: height - 44)
    this.pens.push({
      ownerId: 2,
      x: 14,
      y: height - penH - 52,
      width: penW,
      height: penH,
      gateX: 14 + penW,
      gateY: height - penH / 2 - 52
    });
    // Bottom-right
    this.pens.push({
      ownerId: 3,
      x: width - penW - 14,
      y: height - penH - 52,
      width: penW,
      height: penH,
      gateX: width - penW - 14,
      gateY: height - penH / 2 - 52
    });
  }

  private setupDogs(width: number, height: number): void {
    this.dogs.clear();
    const active = this.getActivePlayers();

    const spawnPositions = [
      { x: 170, y: 130, angle: 0 },
      { x: width - 170, y: 130, angle: Math.PI },
      { x: 170, y: height - 130, angle: 0 },
      { x: width - 170, y: height - 130, angle: Math.PI }
    ];

    active.forEach((p, idx) => {
      const sp = spawnPositions[idx % spawnPositions.length];
      this.dogs.set(p.id, {
        id: p.id,
        x: sp.x,
        y: sp.y,
        vx: 0,
        vy: 0,
        angle: sp.angle,
        speed: 215,
        barkCooldown: 0,
        barkShockwave: {
          x: 0,
          y: 0,
          radius: 0,
          maxRadius: 85,
          active: false,
          isSuper: false
        },
        chargeTime: 0,
        isCharging: false,
        stunTimer: 0,
        corralCount: 0,
        score: 0,
        mood: 'idle',
        moodTimer: 0,
        botReactionTimer: 0.15 + Math.random() * 0.2,
        botTargetSheepId: null
      });
    });
  }

  private setupSheep(width: number, height: number): void {
    this.sheep = [];
    const count = 20;
    const cx = width / 2;
    const cy = height / 2 + 10;

    let idCounter = 0;
    // 2 Golden Rams
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 85;
      this.sheep.push({
        id: idCounter++,
        type: 'golden',
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        vx: (Math.random() - 0.5) * 25,
        vy: (Math.random() - 0.5) * 25,
        fleeVx: 0,
        fleeVy: 0,
        isCorralled: false,
        corralOwner: null,
        wobble: Math.random() * 10,
        radius: 12,
        points: 250
      });
    }

    // 2 Battering Rams
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 30 + Math.random() * 95;
      this.sheep.push({
        id: idCounter++,
        type: 'battering',
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        fleeVx: 0,
        fleeVy: 0,
        isCorralled: false,
        corralOwner: null,
        wobble: Math.random() * 10,
        radius: 13,
        points: 150
      });
    }

    // Remainder standard sheep
    for (let i = idCounter; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 115;
      this.sheep.push({
        id: i,
        type: 'standard',
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        fleeVx: 0,
        fleeVy: 0,
        isCorralled: false,
        corralOwner: null,
        wobble: Math.random() * 10,
        radius: 10,
        points: 100
      });
    }
  }

  private spawnRainbowMythicEwe(width: number, height: number): void {
    if (this.rainbowSpawned) return;
    this.rainbowSpawned = true;
    this.sheep.push({
      id: 999,
      type: 'rainbow',
      x: width / 2,
      y: height / 2,
      vx: 0,
      vy: 0,
      fleeVx: 0,
      fleeVy: 0,
      isCorralled: false,
      corralOwner: null,
      wobble: 0,
      radius: 15,
      points: 500
    });
    this.audio.playChime();
    this.particles.emit(width / 2, height / 2, 35, '#F43F5E');
    this.screenShake = 6;
  }

  private isUnderdog(playerId: PlayerId): boolean {
    const scores = Array.from(this.dogs.values()).map((d) => d.score);
    const maxScore = Math.max(...scores, 0);
    const dog = this.dogs.get(playerId);
    return !!dog && maxScore >= 200 && maxScore - dog.score >= 180;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.freezeFrames > 0) {
      this.freezeFrames--;
      return;
    }

    this.animTimer += dt;
    this.roundTimer -= dt;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 15);
    }

    // Sudden death check at <= 15s
    if (this.roundTimer <= 15.0 && !this.suddenDeathTriggered) {
      this.suddenDeathTriggered = true;
      this.spawnRainbowMythicEwe(width, height);
      this.audio.playWhoosh();
    }

    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Update Dog Players
    const active = this.getActivePlayers();
    for (const p of active) {
      const dog = this.dogs.get(p.id);
      if (!dog) continue;

      if (dog.moodTimer > 0) {
        dog.moodTimer -= dt;
        if (dog.moodTimer <= 0) dog.mood = 'idle';
      }

      if (dog.stunTimer > 0) {
        dog.stunTimer -= dt;
        dog.vx *= 0.85;
        dog.vy *= 0.85;
        dog.x += dog.vx * dt;
        dog.y += dog.vy * dt;
        continue;
      }

      if (dog.barkCooldown > 0) dog.barkCooldown -= dt;

      // Expand active shockwave
      if (dog.barkShockwave.active) {
        const expandSpeed = dog.barkShockwave.isSuper ? 420 : 340;
        dog.barkShockwave.radius += dt * expandSpeed;
        if (dog.barkShockwave.radius >= dog.barkShockwave.maxRadius) {
          dog.barkShockwave.active = false;
        }
      }

      const underdog = this.isUnderdog(p.id);
      const baseSpeed = underdog ? 260 : 215;

      if (!p.type.startsWith('bot_')) {
        const steer = this.input.getSteer(p.id);
        const throttle = this.input.getThrottle(p.id);
        const hasDirection = Math.abs(steer) > 0.15 || Math.abs(throttle) > 0.15;
        const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
        const justReleased = this.input.justReleased(p.id);

        if (hasDirection) {
          dog.angle = Math.atan2(-throttle, steer);
        }

        // Charging Super Bark when holding action
        if (isAction) {
          dog.isCharging = true;
          dog.chargeTime += dt;
          dog.mood = 'focused';
          // Charge particle sparkles
          if (Math.random() < 0.3) {
            this.particles.emit(dog.x, dog.y, 1, p.color);
          }
        }

        if (justReleased && dog.isCharging) {
          if (dog.chargeTime >= 0.75) {
            this.triggerMegaHowl(dog, p);
          } else {
            this.triggerBark(dog, p, false);
          }
          dog.isCharging = false;
          dog.chargeTime = 0;
        }

        // Movement physics
        if (hasDirection) {
          const moveSpeed = dog.isCharging ? baseSpeed * 0.6 : baseSpeed;
          dog.vx = Math.cos(dog.angle) * moveSpeed;
          dog.vy = Math.sin(dog.angle) * moveSpeed;
        } else {
          dog.vx *= 0.8;
          dog.vy *= 0.8;
        }
      }

      dog.x += dog.vx * dt;
      dog.y += dog.vy * dt;

      // Arena boundaries & elastic bounce
      const minX = 24;
      const maxX = width - 24;
      const minY = 76;
      const maxY = height - 24;

      if (dog.x <= minX || dog.x >= maxX) {
        dog.vx *= -0.6;
        dog.x = Math.max(minX, Math.min(maxX, dog.x));
      }
      if (dog.y <= minY || dog.y >= maxY) {
        dog.vy *= -0.6;
        dog.y = Math.max(minY, Math.min(maxY, dog.y));
      }
    }

    // Inter-dog physical elastic collisions (Couch chaos)
    for (let i = 0; i < active.length; i++) {
      const dogA = this.dogs.get(active[i].id);
      if (!dogA) continue;

      for (let j = i + 1; j < active.length; j++) {
        const dogB = this.dogs.get(active[j].id);
        if (!dogB) continue;

        const dx = dogB.x - dogA.x;
        const dy = dogB.y - dogA.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 30;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          dogA.x -= nx * overlap * 0.5;
          dogA.y -= ny * overlap * 0.5;
          dogB.x += nx * overlap * 0.5;
          dogB.y += ny * overlap * 0.5;

          const impulse = 160;
          dogA.vx -= nx * impulse;
          dogA.vy -= ny * impulse;
          dogB.vx += nx * impulse;
          dogB.vy += ny * impulse;

          dogA.mood = 'shocked';
          dogA.moodTimer = 0.5;
          dogB.mood = 'shocked';
          dogB.moodTimer = 0.5;

          this.audio.playBounce();
          this.particles.emit((dogA.x + dogB.x) / 2, (dogA.y + dogB.y) / 2, 6, '#F59E0B');
        }
      }
    }

    // Update Sheep Flocking & Fleeing
    for (const s of this.sheep) {
      if (s.isCorralled) continue;

      s.wobble += dt * 6;

      // 1. Flee from barking shockwaves
      for (const p of active) {
        const dog = this.dogs.get(p.id);
        if (!dog || !dog.barkShockwave.active) continue;

        const d = Math.hypot(s.x - dog.barkShockwave.x, s.y - dog.barkShockwave.y);
        if (d < dog.barkShockwave.radius + s.radius) {
          const angle = Math.atan2(s.y - dog.barkShockwave.y, s.x - dog.barkShockwave.x);
          const force = dog.barkShockwave.isSuper ? 460 : 320;
          s.fleeVx = Math.cos(angle) * force;
          s.fleeVy = Math.sin(angle) * force;

          if (s.type === 'battering') {
            // Provoke battering ram back at dog
            dog.stunTimer = 0.35;
            dog.mood = 'shocked';
            dog.moodTimer = 0.7;
          }
        }
      }

      // 2. Flee from dog proximity
      for (const p of active) {
        const dog = this.dogs.get(p.id);
        if (!dog) continue;

        const distDog = Math.hypot(s.x - dog.x, s.y - dog.y);
        const alertRadius = this.isUnderdog(p.id) ? 95 : 75;

        if (distDog < alertRadius) {
          const angle = Math.atan2(s.y - dog.y, s.x - dog.x);
          s.fleeVx += Math.cos(angle) * 160 * dt;
          s.fleeVy += Math.sin(angle) * 160 * dt;
        }
      }

      // In Sudden Death, uncorralled sheep slowly migrate toward center to intensify showdowns
      if (this.suddenDeathTriggered) {
        const toCx = width / 2 - s.x;
        const toCy = height / 2 + 10 - s.y;
        const distC = Math.hypot(toCx, toCy) || 1;
        s.fleeVx += (toCx / distC) * 20 * dt;
        s.fleeVy += (toCy / distC) * 20 * dt;
      }

      // Decay flee impulses
      s.fleeVx *= 0.93;
      s.fleeVy *= 0.93;

      s.x += (s.vx + s.fleeVx) * dt;
      s.y += (s.vy + s.fleeVy) * dt;

      // Arena walls bounce
      if (s.x < 24 || s.x > width - 24) {
        s.vx *= -1;
        s.x = Math.max(24, Math.min(width - 24, s.x));
      }
      if (s.y < 76 || s.y > height - 24) {
        s.vy *= -1;
        s.y = Math.max(76, Math.min(height - 24, s.y));
      }

      // Check Corral Pens
      for (const pen of this.pens) {
        if (
          s.x >= pen.x &&
          s.x <= pen.x + pen.width &&
          s.y >= pen.y &&
          s.y <= pen.y + pen.height
        ) {
          s.isCorralled = true;
          s.corralOwner = pen.ownerId;
          const dog = this.dogs.get(pen.ownerId);
          if (dog) {
            dog.corralCount++;
            const multi = this.suddenDeathTriggered ? 2 : 1;
            const awarded = s.points * multi;
            dog.score += awarded;
            dog.mood = 'triumph';
            dog.moodTimer = 1.0;
          }

          this.audio.playChime();
          const pConfig = this.players.find((pl) => pl.id === pen.ownerId);
          this.particles.emit(s.x, s.y, 14, pConfig?.color || '#10B981');
          break;
        }
      }
    }

    // Check if all sheep corralled
    if (this.sheep.length > 0 && this.sheep.every((s) => s.isCorralled)) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private triggerBark(dog: DogPlayer, p: PlayerConfig, isSuper: boolean): void {
    if (dog.barkCooldown > 0) return;
    dog.barkCooldown = isSuper ? 0.8 : 0.45;

    const underdog = this.isUnderdog(p.id);
    const maxR = isSuper ? 135 : underdog ? 105 : 85;

    dog.barkShockwave = {
      x: dog.x + Math.cos(dog.angle) * 18,
      y: dog.y + Math.sin(dog.angle) * 18,
      radius: 12,
      maxRadius: maxR,
      active: true,
      isSuper
    };

    if (isSuper) {
      this.audio.playWhoosh();
      this.screenShake = 5;
      this.freezeFrames = 2;
    } else {
      this.audio.playTap();
    }

    this.particles.emit(
      dog.barkShockwave.x,
      dog.barkShockwave.y,
      isSuper ? 12 : 5,
      p.color
    );
  }

  private triggerMegaHowl(dog: DogPlayer, p: PlayerConfig): void {
    this.triggerBark(dog, p, true);

    // Stun nearby rival dogs caught in shockwave
    for (const other of this.dogs.values()) {
      if (other.id === dog.id) continue;
      const d = Math.hypot(other.x - dog.x, other.y - dog.y);
      if (d < 120) {
        other.stunTimer = 0.65;
        other.mood = 'shocked';
        other.moodTimer = 0.8;
        this.particles.emit(other.x, other.y, 8, '#EF4444');
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const dog = this.dogs.get(botId);
    if (!dog || dog.stunTimer > 0) return;

    dog.botReactionTimer -= dt;
    if (dog.botReactionTimer > 0) return;

    dog.botReactionTimer =
      difficulty === 'bot_easy' ? 0.38 : difficulty === 'bot_normal' ? 0.22 : 0.1;

    // Find best target sheep
    let bestSheep: Sheep | null = null;
    let bestScore = -99999;

    const pen = this.pens.find((p) => p.ownerId === botId);
    if (!pen) return;

    for (const s of this.sheep) {
      if (s.isCorralled) continue;

      const distToDog = Math.hypot(dog.x - s.x, dog.y - s.y);
      const distToPen = Math.hypot(pen.gateX - s.x, pen.gateY - s.y);

      // Value weighting: prioritize golden/rainbow and closer sheep
      let weight = s.points * 2 - distToDog * 1.5 - distToPen * 0.8;
      if (difficulty === 'bot_easy') {
        weight += (Math.random() - 0.5) * 200; // error variance
      }

      if (weight > bestScore) {
        bestScore = weight;
        bestSheep = s;
      }
    }

    if (bestSheep) {
      dog.botTargetSheepId = bestSheep.id;

      // Flank behind sheep relative to pen gate
      const toPenX = pen.gateX - bestSheep.x;
      const toPenY = pen.gateY - bestSheep.y;
      const penDist = Math.hypot(toPenX, toPenY) || 1;

      // Ideal herding position is directly behind the sheep facing the gate
      const flankDist = difficulty === 'bot_hard' ? 45 : 60;
      const targetX = bestSheep.x - (toPenX / penDist) * flankDist;
      const targetY = bestSheep.y - (toPenY / penDist) * flankDist;

      const angleToTarget = Math.atan2(targetY - dog.y, targetX - dog.x);
      dog.angle = angleToTarget;

      const underdog = this.isUnderdog(botId);
      const curSpeed = underdog ? 260 : 215;
      dog.vx = Math.cos(dog.angle) * curSpeed;
      dog.vy = Math.sin(dog.angle) * curSpeed;

      const distToSheep = Math.hypot(dog.x - bestSheep.x, dog.y - bestSheep.y);
      const pConfig = this.players.find((p) => p.id === botId);

      // Bark when in position behind sheep
      if (distToSheep < 70 && pConfig) {
        if (difficulty === 'bot_hard' && Math.random() < 0.25) {
          this.triggerMegaHowl(dog, pConfig);
        } else {
          this.triggerBark(dog, pConfig, false);
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeId];

    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Dynamic Floor with Gradient & Subtle Grid/Tufts
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle turf detail
    ctx.fillStyle = theme.fieldLineColor;
    for (let i = 0; i < 45; i++) {
      const gx = (i * 97) % width;
      const gy = 80 + ((i * 61) % (height - 110));
      if (this.currentThemeId === 'cyber') {
        ctx.fillRect(gx, gy, 8, 1);
      } else {
        ctx.fillRect(gx, gy, 4, 3);
      }
    }

    // Center pasture circle
    ctx.strokeStyle = theme.fieldLineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2 + 10, 80, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Corner Corral Pens
    for (const pen of this.pens) {
      const pConfig = this.players.find((p) => p.id === pen.ownerId);

      // Pen background bevel
      ctx.fillStyle = theme.penBg;
      ctx.fillRect(pen.x, pen.y, pen.width, pen.height);

      ctx.strokeStyle = pConfig ? pConfig.color : theme.penBorder;
      ctx.lineWidth = 3;
      ctx.strokeRect(pen.x, pen.y, pen.width, pen.height);

      // Corner fence posts
      ctx.fillStyle = pConfig ? pConfig.colorDark : '#94A3B8';
      ctx.fillRect(pen.x - 3, pen.y - 3, 6, 6);
      ctx.fillRect(pen.x + pen.width - 3, pen.y - 3, 6, 6);
      ctx.fillRect(pen.x - 3, pen.y + pen.height - 3, 6, 6);
      ctx.fillRect(pen.x + pen.width - 3, pen.y + pen.height - 3, 6, 6);

      // Gate opening marker
      ctx.fillStyle = theme.gateColor;
      ctx.beginPath();
      ctx.arc(pen.gateX, pen.gateY, 7, 0, Math.PI * 2);
      ctx.fill();

      // Pen label
      ctx.fillStyle = pConfig ? pConfig.color : '#FFFFFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${pConfig?.name ?? 'Pen'}'s Corral`,
        pen.x + pen.width / 2,
        pen.y + pen.height / 2
      );
    }

    // 3. Sheep Rendering
    for (const s of this.sheep) {
      ctx.save();
      ctx.translate(s.x, s.y);

      // Drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 5, s.radius * 0.9, s.radius * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body color based on type
      let bodyColor = theme.sheepBodyColor;
      if (s.isCorralled) {
        bodyColor = '#94A3B8';
      } else if (s.type === 'golden') {
        bodyColor = '#FBBF24';
      } else if (s.type === 'rainbow') {
        const hue = (this.animTimer * 180 + s.id * 30) % 360;
        bodyColor = `hsl(${hue}, 90%, 65%)`;
      } else if (s.type === 'battering') {
        bodyColor = '#475569';
      }

      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
      ctx.fill();

      // Fluffy bumps
      const bumpR = s.radius * 0.55;
      ctx.beginPath();
      ctx.arc(-s.radius * 0.45, -s.radius * 0.35, bumpR, 0, Math.PI * 2);
      ctx.arc(s.radius * 0.45, -s.radius * 0.35, bumpR, 0, Math.PI * 2);
      ctx.arc(0, s.radius * 0.4, bumpR, 0, Math.PI * 2);
      ctx.fill();

      // Face
      ctx.fillStyle = s.type === 'battering' ? '#0F172A' : theme.sheepFaceColor;
      ctx.beginPath();
      ctx.arc(s.radius * 0.6, 0, s.radius * 0.38, 0, Math.PI * 2);
      ctx.fill();

      // Horns for Golden Ram / Battering Ram
      if (s.type === 'golden' || s.type === 'battering') {
        ctx.strokeStyle = s.type === 'golden' ? '#D97706' : '#94A3B8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.radius * 0.2, -s.radius * 0.6, 4, 0, Math.PI);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 4. Dogs & Bark Waves
    for (const p of this.getActivePlayers()) {
      const dog = this.dogs.get(p.id);
      if (!dog) continue;

      // Underdog golden aura
      if (this.isUnderdog(p.id)) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(dog.x, dog.y, 24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Charging visual indicator
      if (dog.isCharging) {
        const chargeRatio = Math.min(1.0, dog.chargeTime / 0.75);
        ctx.strokeStyle = chargeRatio >= 1.0 ? '#F43F5E' : p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(dog.x, dog.y, 20 + chargeRatio * 10, 0, Math.PI * 2 * chargeRatio);
        ctx.stroke();
      }

      // Shockwave ring
      if (dog.barkShockwave.active) {
        ctx.strokeStyle = dog.barkShockwave.isSuper ? '#F43F5E' : p.color;
        ctx.lineWidth = dog.barkShockwave.isSuper ? 5 : 3;
        ctx.globalAlpha = Math.max(
          0,
          1 - dog.barkShockwave.radius / dog.barkShockwave.maxRadius
        );
        ctx.beginPath();
        ctx.arc(
          dog.barkShockwave.x,
          dog.barkShockwave.y,
          dog.barkShockwave.radius,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      // Stun stars
      if (dog.stunTimer > 0) {
        ctx.fillStyle = '#FBBF24';
        for (let i = 0; i < 3; i++) {
          const sa = this.animTimer * 6 + (i * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.arc(dog.x + Math.cos(sa) * 16, dog.y + Math.sin(sa) * 16 - 10, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Dog body with 2.5D perspective
      ctx.save();
      ctx.translate(dog.x, dog.y);
      ctx.rotate(dog.angle);

      // Drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 4, 15, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dog torso
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Snout
      ctx.fillStyle = p.colorDark;
      ctx.beginPath();
      ctx.arc(13, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();

      // Collar
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(4, -8, 3, 16);

      // Wagging tail
      const tailWag = Math.sin(this.animTimer * 12) * 0.4;
      ctx.save();
      ctx.translate(-14, 0);
      ctx.rotate(tailWag);
      ctx.fillStyle = p.color;
      ctx.fillRect(-6, -2, 6, 4);
      ctx.restore();

      ctx.restore();
    }

    ctx.restore(); // Undo screen shake

    // 5. Header / Instruction Badge (Safe-zone: y: 56, h: 26)
    const headerW = 320;
    const headerH = 26;
    const headerX = width / 2 - headerW / 2;
    const headerY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(headerX, headerY, headerW, headerH, 6);
    else ctx.rect(headerX, headerY, headerW, headerH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${theme.icon} ${theme.name.toUpperCase()} • BARK TO HERD SHEEP`,
      width / 2,
      headerY + 17
    );

    // 6. Corner Player HUD Cards with CharacterRenderer Mascots
    // Offset bottom-left card above Theme Pill (y: height - 134)
    for (const p of this.getActivePlayers()) {
      const dog = this.dogs.get(p.id);
      if (!dog) continue;

      let cx = 16;
      let cy = 72;
      const cardW = 120;
      const cardH = 64;

      if (p.corner === 'top-right') {
        cx = width - cardW - 16;
        cy = 72;
      } else if (p.corner === 'bottom-left') {
        cx = 16;
        cy = height - cardH - 52;
      } else if (p.corner === 'bottom-right') {
        cx = width - cardW - 16;
        cy = height - cardH - 52;
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx, cy, cardW, cardH, 8);
      else ctx.rect(cx, cy, cardW, cardH);
      ctx.fill();
      ctx.stroke();

      // Mascot Avatar
      const isBot = p.type !== 'human';
      drawCharacter(ctx, cx + 22, cy + 32, 16, p.id, isBot, dog.mood, this.animTimer);

      // Name & Score
      ctx.fillStyle = p.color;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cx + 46, cy + 22);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`${dog.score} pts`, cx + 46, cy + 40);

      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(`Penned: ${dog.corralCount}`, cx + 46, cy + 54);
    }

    // 7. Interactive Theme Pill (Bottom-left: x: 20, y: height - 44, w: 170, h: 32)
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${theme.icon} ${theme.name} [T]`, pillX + 10, pillY + 20);

    // 8. Control hints (Bottom-right: x: width - 20, y: height - 28)
    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      'Move: Steer | Tap Action: Bark | Hold: Super Howl',
      width - 20,
      height - 24
    );
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const sorted = [...active].sort((a, b) => {
      const sa = this.dogs.get(a.id)?.score || 0;
      const sb = this.dogs.get(b.id)?.score || 0;
      return sb - sa;
    });

    const winnerId = sorted.length > 0 ? sorted[0].id : null;
    const topCount = this.dogs.get(winnerId ?? 0)?.corralCount || 0;

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      score: this.dogs.get(p.id)?.score || 0,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: `Master Shepherd! Corralled ${topCount} sheep across the ${THEMES[this.currentThemeId].name}!`
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.onKeyDownBound);
  }

  public syncDebug(): Record<string, unknown> {
    return {
      theme: this.currentThemeId,
      roundTimer: this.roundTimer,
      sheepCount: this.sheep.length,
      uncorralled: this.sheep.filter((s) => !s.isCorralled).length,
      suddenDeath: this.suddenDeathTriggered,
      dogs: Array.from(this.dogs.entries()).map(([id, d]) => ({
        id,
        score: d.score,
        corralCount: d.corralCount,
        isUnderdog: this.isUnderdog(id)
      }))
    };
  }
}
