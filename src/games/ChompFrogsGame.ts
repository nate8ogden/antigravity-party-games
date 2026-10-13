import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type PondTheme = 'emerald' | 'bayou' | 'zen';

export interface PondThemeConfig {
  id: PondTheme;
  name: string;
  bgWaterDeep: string;
  bgWaterMid: string;
  bgWaterShallow: string;
  bankBorderColor: string;
  pillColor: string;
}

export const THEME_CONFIGS: PondThemeConfig[] = [
  {
    id: 'emerald',
    name: 'Emerald Oasis 🌿',
    bgWaterDeep: '#075985',
    bgWaterMid: '#0369A1',
    bgWaterShallow: '#0284C7',
    bankBorderColor: '#047857',
    pillColor: '#10B981'
  },
  {
    id: 'bayou',
    name: 'Mystic Bayou 🔮',
    bgWaterDeep: '#0F172A',
    bgWaterMid: '#312E81',
    bgWaterShallow: '#4C1D95',
    bankBorderColor: '#6D28D9',
    pillColor: '#8B5CF6'
  },
  {
    id: 'zen',
    name: 'Zen Rainfall 🌧️',
    bgWaterDeep: '#0F172A',
    bgWaterMid: '#1E293B',
    bgWaterShallow: '#334155',
    bankBorderColor: '#475569',
    pillColor: '#38BDF8'
  }
];

type InsectType = 'gnat' | 'firefly' | 'dragonfly' | 'golden_beetle' | 'lotus_butterfly' | 'wasp';

interface Insect {
  id: number;
  type: InsectType;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  radius: number;
  value: number;
  color: string;
  glowColor: string;
  wingAngle: number;
  flutterSpeed: number;
  flightTimer: number;
  caughtBy: PlayerId | null;
  destroyed: boolean;
}

interface LilyPad {
  id: number;
  x: number;
  y: number;
  radius: number;
  angle: number;
  notchAngle: number;
  hasFlower: boolean;
  flowerColor: string;
  isCenterLotus: boolean;
  bobPhase: number;
  bobSpeed: number;
}

interface WaterRipple {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
  color: string;
}

interface KoiFish {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  length: number;
  color: string;
  turnTimer: number;
}

interface FrogPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingAngle: number;
  hopZ: number;
  hopVz: number;
  isHopping: boolean;
  hopCooldown: number;
  onLilypadId: number | null;
  inWater: boolean;

  // Instant Snap Tongue
  tongueState: 'IDLE' | 'SNAP_OUT' | 'SNAP_IN';
  tongueProgress: number; // 0 to 1
  tongueAngle: number;
  tongueLength: number;
  maxTongueRange: number;
  caughtInsects: Insect[];

  // Visuals & Expressions
  mouthOpen: number;
  chewTimer: number;
  throatPuff: number;
  squashFactor: number;
  stunTimer: number;
  frenzyTimer: number;
  comboCount: number;
  comboTimer: number;
  score: number;
  insectsCaught: number;
  isUnderdog: boolean;
  shoveCooldown: number;

  // AI State
  botReactionTimer: number;
  botTargetInsectId: number | null;
}

export class ChompFrogsGame extends BaseGame {
  public pondTheme: PondTheme = 'emerald';
  private lilyPads: LilyPad[] = [];
  private insects: Insect[] = [];
  private ripples: WaterRipple[] = [];
  private koiFish: KoiFish[] = [];
  private playersState: Map<PlayerId, FrogPlayer> = new Map();
  private pondCenterX: number = 0;
  private pondCenterY: number = 0;
  private pondRadius: number = 240;
  private insectCounter: number = 0;
  private spawnTimer: number = 0;
  private butterflySpawnTimer: number = 8;
  private rainParticles: { x: number; y: number; speed: number; len: number }[] = [];
  private lastWidth: number = 960;
  private lastHeight: number = 540;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private suddenDeathAnnounced: boolean = false;
  private animTimer: number = 0;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.bindKeyboardShortcuts();
    this.bindCanvasPointer();
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45;
    this.insects = [];
    this.ripples = [];
    this.koiFish = [];
    this.insectCounter = 0;
    this.spawnTimer = 0;
    this.butterflySpawnTimer = 8;
    this.suddenDeathAnnounced = false;
    this.animTimer = 0;

    this.pondCenterX = width / 2;
    this.pondCenterY = height / 2 + 16;
    this.pondRadius = Math.min(width, height) * 0.42;

    this.generatePondEnvironment(width, height);
    this.initFrogs(width, height);

    // Initial insect population
    for (let i = 0; i < 16; i++) {
      this.spawnInsect(false);
    }

    this.syncDebug();
  }

  public syncDebug(): void {
    if (typeof window !== 'undefined') {
      (window as any).__CHOMP_FROGS_DEBUG__ = {
        players: Array.from(this.playersState.values()),
        insects: this.insects,
        lilyPads: this.lilyPads,
        roundTimer: this.roundTimer,
        isFinished: this.isFinished,
        theme: this.pondTheme,
        setTheme: (theme: PondTheme) => this.switchTheme(theme),
        cycleTheme: () => this.cycleTheme()
      };
    }
  }

  private bindCanvasPointer(): void {
    if (typeof window === 'undefined') return;
    const canvas = this.input.getCanvas();
    if (!canvas) return;

    this.boundPointerDown = (e: PointerEvent) => {
      this.handlePointerDown(e);
    };
    canvas.addEventListener('pointerdown', this.boundPointerDown);
  }

  private handlePointerDown(e: PointerEvent): void {
    const canvas = this.input.getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * this.lastWidth;
    const clickY = ((e.clientY - rect.top) / rect.height) * this.lastHeight;

    // Check Theme Pill click at (20, height - 44, 170, 32)
    if (
      clickX >= 20 &&
      clickX <= 190 &&
      clickY >= this.lastHeight - 44 &&
      clickY <= this.lastHeight - 12
    ) {
      this.cycleTheme();
    }
  }

  public cycleTheme(): void {
    const curIdx = THEME_CONFIGS.findIndex((t) => t.id === this.pondTheme);
    const nextIdx = (curIdx + 1) % THEME_CONFIGS.length;
    this.switchTheme(THEME_CONFIGS[nextIdx].id);
  }

  public switchTheme(theme: PondTheme): void {
    if (this.pondTheme === theme) return;
    this.pondTheme = theme;
    this.audio.playTap();
    this.particles.spawnExplosion(100, this.lastHeight - 28, '#38BDF8', 12);
    this.syncDebug();
  }

  private bindKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;
    this.unbindKeyboardShortcuts();

    this.keydownListener = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === '1') {
        this.switchTheme('emerald');
      } else if (e.key === '2') {
        this.switchTheme('bayou');
      } else if (e.key === '3') {
        this.switchTheme('zen');
      }
    };
    window.addEventListener('keydown', this.keydownListener);
  }

  private unbindKeyboardShortcuts(): void {
    if (typeof window !== 'undefined' && this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
  }

  public override destroy(): void {
    super.destroy();
    this.unbindKeyboardShortcuts();
    if (this.boundPointerDown) {
      const canvas = this.input.getCanvas();
      if (canvas) {
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
      }
      this.boundPointerDown = null;
    }
    if (typeof window !== 'undefined' && (window as any).__CHOMP_FROGS_DEBUG__) {
      delete (window as any).__CHOMP_FROGS_DEBUG__;
    }
  }

  private generatePondEnvironment(width: number, height: number): void {
    this.lilyPads = [];
    this.koiFish = [];
    this.ripples = [];

    // Center Giant Lotus Pad
    this.lilyPads.push({
      id: 0,
      x: this.pondCenterX,
      y: this.pondCenterY,
      radius: 64,
      angle: 0,
      notchAngle: Math.PI * 0.25,
      hasFlower: true,
      flowerColor: '#F43F5E',
      isCenterLotus: true,
      bobPhase: 0,
      bobSpeed: 1.2
    });

    // Ring of outer floating lily pads
    const padCount = 8;
    const ringRadius = this.pondRadius * 0.62;
    for (let i = 0; i < padCount; i++) {
      const angle = (i / padCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const dist = ringRadius + (Math.random() - 0.5) * 35;
      const px = this.pondCenterX + Math.cos(angle) * dist;
      const py = this.pondCenterY + Math.sin(angle) * dist;

      this.lilyPads.push({
        id: i + 1,
        x: px,
        y: py,
        radius: 36 + Math.random() * 12,
        angle: Math.random() * Math.PI * 2,
        notchAngle: Math.random() * Math.PI * 2,
        hasFlower: i % 2 === 0,
        flowerColor: i % 4 === 0 ? '#FB7185' : '#FDE047',
        isCenterLotus: false,
        bobPhase: Math.random() * Math.PI * 2,
        bobSpeed: 1.5 + Math.random() * 0.8
      });
    }

    // Ambient Swimming Koi Fish
    const koiColors = ['#F97316', '#EF4444', '#FFFFFF', '#FBBF24'];
    for (let i = 0; i < 4; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (this.pondRadius * 0.7);
      this.koiFish.push({
        x: this.pondCenterX + Math.cos(angle) * dist,
        y: this.pondCenterY + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        angle: Math.random() * Math.PI * 2,
        speed: 25 + Math.random() * 20,
        length: 22 + Math.random() * 10,
        color: koiColors[i % koiColors.length],
        turnTimer: 2 + Math.random() * 3
      });
    }

    // Rain Particles for Zen theme
    this.rainParticles = [];
    for (let i = 0; i < 45; i++) {
      this.rainParticles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 400 + Math.random() * 250,
        len: 8 + Math.random() * 8
      });
    }
  }

  private initFrogs(width: number, height: number): void {
    this.playersState.clear();
    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      let spawnX = this.pondCenterX - 140;
      let spawnY = this.pondCenterY;
      let facing = 0;
      let padId: number | null = 1;

      if (count === 2) {
        if (idx === 0) {
          spawnX = this.pondCenterX - 145;
          spawnY = this.pondCenterY;
          facing = 0;
          padId = 1;
        } else {
          spawnX = this.pondCenterX + 145;
          spawnY = this.pondCenterY;
          facing = Math.PI;
          padId = 5;
        }
      } else {
        const angle = (idx / count) * Math.PI * 2;
        spawnX = this.pondCenterX + Math.cos(angle) * (this.pondRadius * 0.6);
        spawnY = this.pondCenterY + Math.sin(angle) * (this.pondRadius * 0.6);
        facing = angle + Math.PI;
        padId = idx + 1;
      }

      this.playersState.set(p.id, {
        id: p.id,
        x: spawnX,
        y: spawnY,
        vx: 0,
        vy: 0,
        facingAngle: facing,
        hopZ: 0,
        hopVz: 0,
        isHopping: false,
        hopCooldown: 0,
        onLilypadId: padId,
        inWater: false,
        tongueState: 'IDLE',
        tongueProgress: 0,
        tongueAngle: facing,
        tongueLength: 0,
        maxTongueRange: 140,
        caughtInsects: [],
        mouthOpen: 0,
        chewTimer: 0,
        throatPuff: 0,
        squashFactor: 1,
        stunTimer: 0,
        frenzyTimer: 0,
        comboCount: 0,
        comboTimer: 0,
        score: 0,
        insectsCaught: 0,
        isUnderdog: false,
        shoveCooldown: 0,
        botReactionTimer: 0.15 + idx * 0.05,
        botTargetInsectId: null
      });
    });
  }

  private spawnInsect(isButterfly: boolean = false, isQueenDragonfly: boolean = false): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (this.pondRadius * 0.82);
    const x = this.pondCenterX + Math.cos(angle) * dist;
    const y = this.pondCenterY + Math.sin(angle) * dist;

    let type: InsectType = 'firefly';
    let value = 100;
    let color = '#FDE047';
    let glowColor = '#FEF08A';
    let radius = 9;
    let speed = 40 + Math.random() * 25;

    if (isButterfly) {
      type = 'lotus_butterfly';
      value = 500;
      color = '#F43F5E';
      glowColor = '#FDA4AF';
      radius = 15;
      speed = 75;
    } else if (isQueenDragonfly) {
      type = 'dragonfly';
      value = 300;
      color = '#FACC15';
      glowColor = '#FEF08A';
      radius = 14;
      speed = 95;
    } else {
      const roll = Math.random();
      if (roll < 0.35) {
        type = 'gnat';
        value = 50;
        color = '#A3E635';
        glowColor = '#BEF264';
        radius = 7;
        speed = 45;
      } else if (roll < 0.65) {
        type = 'firefly';
        value = 100;
        color = '#FDE047';
        glowColor = '#FEF08A';
        radius = 9;
        speed = 35;
      } else if (roll < 0.82) {
        type = 'dragonfly';
        value = 220;
        color = '#38BDF8';
        glowColor = '#7DD3FC';
        radius = 11;
        speed = 85;
      } else if (roll < 0.91) {
        type = 'golden_beetle';
        value = 350;
        color = '#F59E0B';
        glowColor = '#FDE68A';
        radius = 12;
        speed = 30;
      } else {
        type = 'wasp';
        value = -150;
        color = '#EF4444';
        glowColor = '#FCA5A5';
        radius = 11;
        speed = 55;
      }
    }

    const moveAngle = Math.random() * Math.PI * 2;
    this.insects.push({
      id: ++this.insectCounter,
      type,
      x,
      y,
      z: 6 + Math.random() * 14,
      vx: Math.cos(moveAngle) * speed,
      vy: Math.sin(moveAngle) * speed,
      radius,
      value,
      color,
      glowColor,
      wingAngle: 0,
      flutterSpeed: 18 + Math.random() * 12,
      flightTimer: 1 + Math.random() * 2,
      caughtBy: null,
      destroyed: false
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastWidth = width;
    this.lastHeight = height;
    this.animTimer += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    const isSuddenDeath = this.roundTimer <= 15;

    // Sudden Death Swarm Event
    if (isSuddenDeath && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.audio.playBoost();
      this.particles.shake(0.5);
      this.particles.showFloatingText('⚡ QUEEN INSECT SWARM! ⚡', width / 2, height / 2 - 30, '#FACC15', 30);
      // Spawn 3 Queen Dragonflies
      for (let q = 0; q < 3; q++) {
        this.spawnInsect(false, true);
      }
    }

    // Determine Underdog Frog
    const active = this.getActivePlayers();
    if (active.length > 1) {
      let minScore = 999999;
      let maxScore = -1;
      for (const p of active) {
        const ps = this.playersState.get(p.id);
        if (!ps) continue;
        if (ps.score < minScore) minScore = ps.score;
        if (ps.score > maxScore) maxScore = ps.score;
      }

      for (const p of active) {
        const ps = this.playersState.get(p.id);
        if (!ps) continue;
        // Underdog triggers when trailing by 250+ points
        ps.isUnderdog = (maxScore - ps.score >= 250);
      }
    } else {
      for (const ps of this.playersState.values()) {
        ps.isUnderdog = false;
      }
    }

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Dynamic Spawners
    this.spawnTimer -= dt;
    const activeInsects = this.insects.filter((ins) => !ins.destroyed && ins.caughtBy === null);
    const maxInsects = isSuddenDeath ? 24 : 18;
    if (this.spawnTimer <= 0 && activeInsects.length < maxInsects) {
      this.spawnInsect(false, isSuddenDeath && Math.random() < 0.35);
      this.spawnTimer = isSuddenDeath ? 0.6 : 1.0 + Math.random() * 0.7;
    }

    // Queen Lotus Butterfly
    this.butterflySpawnTimer -= dt;
    if (this.butterflySpawnTimer <= 0) {
      this.spawnInsect(true);
      this.butterflySpawnTimer = 14 + Math.random() * 6;
      this.particles.showFloatingText('👑 ROYAL BUTTERFLY BLOOMS!', this.pondCenterX, this.pondCenterY - 30, '#F43F5E', 24);
      this.audio.playChime();
    }

    // Update Water Ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rip = this.ripples[i];
      rip.r += 40 * dt;
      rip.alpha -= 0.65 * dt;
      if (rip.alpha <= 0 || rip.r >= rip.maxR) {
        this.ripples.splice(i, 1);
      }
    }

    // Update Rain Particles
    if (this.pondTheme === 'zen') {
      for (const r of this.rainParticles) {
        r.y += r.speed * dt;
        r.x += 60 * dt;
        if (r.y > height) {
          r.y = -10;
          r.x = Math.random() * width;
          if (Math.random() < 0.25) {
            this.ripples.push({
              x: r.x,
              y: Math.random() * height,
              r: 2,
              maxR: 12,
              alpha: 0.4,
              color: '#93C5FD'
            });
          }
        }
      }
    }

    // Update Koi Fish
    for (const fish of this.koiFish) {
      fish.turnTimer -= dt;
      if (fish.turnTimer <= 0) {
        fish.turnTimer = 2 + Math.random() * 3;
        fish.angle += (Math.random() - 0.5) * 1.5;
        fish.vx = Math.cos(fish.angle) * fish.speed;
        fish.vy = Math.sin(fish.angle) * fish.speed;
      }
      fish.x += fish.vx * dt;
      fish.y += fish.vy * dt;

      const dCenter = Math.hypot(fish.x - this.pondCenterX, fish.y - this.pondCenterY);
      if (dCenter > this.pondRadius * 0.78) {
        const backAngle = Math.atan2(this.pondCenterY - fish.y, this.pondCenterX - fish.x);
        fish.angle = backAngle + (Math.random() - 0.5) * 0.4;
        fish.vx = Math.cos(fish.angle) * fish.speed;
        fish.vy = Math.sin(fish.angle) * fish.speed;
      }
    }

    // Update Insects
    for (const ins of this.insects) {
      if (ins.destroyed) continue;
      ins.wingAngle += ins.flutterSpeed * dt;

      if (ins.caughtBy === null) {
        ins.flightTimer -= dt;
        if (ins.flightTimer <= 0) {
          ins.flightTimer = 0.8 + Math.random() * 1.6;
          const turn = (Math.random() - 0.5) * (ins.type === 'dragonfly' ? 2.2 : 0.8);
          const curAngle = Math.atan2(ins.vy, ins.vx) + turn;
          const speed = Math.hypot(ins.vx, ins.vy);
          ins.vx = Math.cos(curAngle) * speed;
          ins.vy = Math.sin(curAngle) * speed;
        }

        ins.x += ins.vx * dt;
        ins.y += ins.vy * dt;

        const distCenter = Math.hypot(ins.x - this.pondCenterX, ins.y - this.pondCenterY);
        if (distCenter > this.pondRadius * 0.86) {
          const normal = Math.atan2(ins.y - this.pondCenterY, ins.x - this.pondCenterX);
          ins.vx = -Math.cos(normal) * Math.abs(ins.vx);
          ins.vy = -Math.sin(normal) * Math.abs(ins.vy);
        }
      }
    }

    // Update Lily Pads Bobbing
    for (const pad of this.lilyPads) {
      pad.bobPhase += pad.bobSpeed * dt;
    }

    // Update Frog Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.shoveCooldown > 0) {
        ps.shoveCooldown = Math.max(0, ps.shoveCooldown - dt);
      }

      if (ps.stunTimer > 0) {
        ps.stunTimer = Math.max(0, ps.stunTimer - dt);
        ps.mouthOpen = 0;
        ps.tongueState = 'IDLE';
        ps.tongueProgress = 0;
        ps.squashFactor = 1.25;
        continue;
      }

      if (ps.frenzyTimer > 0) {
        ps.frenzyTimer = Math.max(0, ps.frenzyTimer - dt);
        if (Math.random() < 0.4) {
          this.particles.spawnConfetti(ps.x + (Math.random() - 0.5) * 16, ps.y + (Math.random() - 0.5) * 16, 2);
        }
      }

      if (ps.comboTimer > 0) {
        ps.comboTimer = Math.max(0, ps.comboTimer - dt);
        if (ps.comboTimer <= 0) {
          ps.comboCount = 0;
        }
      }

      if (ps.chewTimer > 0) {
        ps.chewTimer = Math.max(0, ps.chewTimer - dt);
      }

      ps.throatPuff = Math.sin(performance.now() * 0.007 + Number(p.id)) * 0.5 + 0.5;
      ps.hopCooldown = Math.max(0, ps.hopCooldown - dt);

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const inputMagnitude = Math.hypot(steer, throttle);

      if (inputMagnitude > 0.25) {
        ps.facingAngle = Math.atan2(throttle, steer);
      }

      const justAction = this.input.justAction(p.id);
      const justPressed = this.input.justPressed(p.id);

      // Underdog +25% hop speed
      const hopSpeedMult = ps.isUnderdog ? 1.25 : 1.0;

      // Free-roam hop
      if (!ps.isHopping && ps.hopCooldown <= 0 && inputMagnitude > 0.3) {
        ps.isHopping = true;
        const jumpBase = (ps.onLilypadId !== null ? 240 : 175) * hopSpeedMult;
        ps.hopVz = jumpBase;
        ps.hopZ = 2;
        const hopSpeed = (ps.onLilypadId !== null ? 220 : 150) * hopSpeedMult;
        ps.vx = Math.cos(ps.facingAngle) * hopSpeed;
        ps.vy = Math.sin(ps.facingAngle) * hopSpeed;
        ps.squashFactor = 0.75;
        this.audio.playBounce();

        if (ps.inWater) {
          this.ripples.push({
            x: ps.x,
            y: ps.y,
            r: 6,
            maxR: 32,
            alpha: 0.7,
            color: '#38BDF8'
          });
        }
      }

      // Airborne Hop Physics
      if (ps.isHopping) {
        ps.hopVz -= 820 * dt;
        ps.hopZ += ps.hopVz * dt;
        ps.x += ps.vx * dt;
        ps.y += ps.vy * dt;

        if (ps.hopZ <= 0) {
          ps.hopZ = 0;
          ps.isHopping = false;
          ps.vx = 0;
          ps.vy = 0;
          ps.hopCooldown = 0.12;
          ps.squashFactor = 1.35;

          let landedOnPad: LilyPad | null = null;
          for (const pad of this.lilyPads) {
            const dist = Math.hypot(ps.x - pad.x, ps.y - pad.y);
            if (dist <= pad.radius + 6) {
              landedOnPad = pad;
              break;
            }
          }

          if (landedOnPad) {
            ps.onLilypadId = landedOnPad.id;
            ps.inWater = false;
            landedOnPad.bobPhase += 0.8;
          } else {
            ps.onLilypadId = null;
            ps.inWater = true;
            this.audio.playSnowSplat();
            this.ripples.push({
              x: ps.x,
              y: ps.y,
              r: 8,
              maxR: 44,
              alpha: 0.8,
              color: '#38BDF8'
            });
          }
        }
      } else {
        ps.squashFactor += (1.0 - ps.squashFactor) * 8 * dt;
      }

      // Boundary clamp
      const distFromPondCenter = Math.hypot(ps.x - this.pondCenterX, ps.y - this.pondCenterY);
      if (distFromPondCenter > this.pondRadius * 0.92) {
        const edgeAngle = Math.atan2(ps.y - this.pondCenterY, ps.x - this.pondCenterX);
        ps.x = this.pondCenterX + Math.cos(edgeAngle) * (this.pondRadius * 0.92);
        ps.y = this.pondCenterY + Math.sin(edgeAngle) * (this.pondRadius * 0.92);
      }

      // Chomp Action
      const triggerChomp = justAction || (justPressed && inputMagnitude < 0.25);
      if (triggerChomp && ps.tongueState === 'IDLE') {
        ps.tongueState = 'SNAP_OUT';
        ps.tongueProgress = 0;
        ps.tongueAngle = ps.facingAngle;
        ps.mouthOpen = 1;
        // Underdog gets +35% base tongue reach! Frenzy gives max reach
        const baseReach = ps.isUnderdog ? 190 : 140;
        ps.maxTongueRange = ps.frenzyTimer > 0 ? 210 : baseReach;
        this.audio.playWhoosh();
      }

      // Tongue Snap Lifecycle
      if (ps.tongueState === 'SNAP_OUT') {
        const snapSpeed = ps.frenzyTimer > 0 ? 1150 : (ps.isUnderdog ? 1020 : 880);
        ps.tongueProgress += (snapSpeed / ps.maxTongueRange) * dt;
        ps.tongueLength = Math.min(ps.maxTongueRange, ps.tongueProgress * ps.maxTongueRange);

        const tipX = ps.x + Math.cos(ps.tongueAngle) * ps.tongueLength;
        const tipY = ps.y + Math.sin(ps.tongueAngle) * ps.tongueLength;

        let caughtOne = false;
        for (const ins of this.insects) {
          if (ins.destroyed || ins.caughtBy !== null) continue;

          const dist = Math.hypot(tipX - ins.x, tipY - ins.y);
          if (dist <= ins.radius + 18) {
            ins.caughtBy = ps.id;
            ps.caughtInsects.push(ins);
            caughtOne = true;
            break;
          }
        }

        if (caughtOne || ps.tongueProgress >= 1.0) {
          ps.tongueState = 'SNAP_IN';
        }
      } else if (ps.tongueState === 'SNAP_IN') {
        const retractSpeed = 1350;
        ps.tongueProgress -= (retractSpeed / ps.maxTongueRange) * dt;
        ps.tongueLength = Math.max(0, ps.tongueProgress * ps.maxTongueRange);

        const tipX = ps.x + Math.cos(ps.tongueAngle) * ps.tongueLength;
        const tipY = ps.y + Math.sin(ps.tongueAngle) * ps.tongueLength;

        for (const ins of ps.caughtInsects) {
          ins.x = tipX;
          ins.y = tipY;
        }

        if (ps.tongueProgress <= 0) {
          ps.tongueState = 'IDLE';
          ps.tongueProgress = 0;
          ps.tongueLength = 0;
          ps.mouthOpen = 0;

          if (ps.caughtInsects.length > 0) {
            for (const ins of ps.caughtInsects) {
              ins.destroyed = true;

              if (ins.type === 'wasp') {
                if (ps.isUnderdog) {
                  // Underdog Wasp Repellent: Wasp turns to honey bonus!
                  ps.score += 150;
                  this.audio.playScore();
                  this.particles.showFloatingText('HONEY BONUS! +150 🍯', ps.x, ps.y - 34, '#FACC15', 22);
                  this.particles.spawnExplosion(ps.x, ps.y, '#FACC15', 16);
                } else {
                  ps.score = Math.max(0, ps.score + ins.value);
                  ps.stunTimer = 1.6;
                  this.audio.playStun();
                  this.particles.showFloatingText('STUNG! -150', ps.x, ps.y - 34, '#EF4444', 24);
                  this.particles.spawnExplosion(ps.x, ps.y, '#EF4444', 16);
                  ps.comboCount = 0;
                }
              } else {
                ps.comboCount += 1;
                ps.comboTimer = 2.8;

                if (ps.comboCount >= 3 && ps.frenzyTimer <= 0) {
                  ps.frenzyTimer = 5.0;
                  this.audio.playBoost();
                  this.particles.showFloatingText('🔥 FROG FRENZY! 2x TONGUE!', ps.x, ps.y - 48, '#F59E0B', 24);
                }

                const multiplier = ps.frenzyTimer > 0 ? 1.5 : 1.0;
                const earned = Math.round(ins.value * multiplier);
                ps.score += earned;
                ps.insectsCaught += 1;
                ps.chewTimer = 0.55;
                this.audio.playChomp();

                const label = ps.comboCount >= 2 ? `+${earned} (${ps.comboCount}x COMBO!)` : `+${earned}`;
                this.particles.showFloatingText(label, ps.x, ps.y - 32, ins.color, 24);
                this.particles.spawnConfetti(ps.x, ps.y, 14);
              }
            }
            ps.caughtInsects = [];
          }
        }
      }
    }

    // Frog vs Frog Body Bumping Collision & Prey Stealing!
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const p1 = this.playersState.get(active[i].id);
        const p2 = this.playersState.get(active[j].id);
        if (!p1 || !p2) continue;

        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (dist < 36 && p1.shoveCooldown <= 0 && p2.shoveCooldown <= 0) {
          const pushAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          const bumpForce = 150;
          p1.x -= Math.cos(pushAngle) * 8;
          p1.y -= Math.sin(pushAngle) * 8;
          p2.x += Math.cos(pushAngle) * 8;
          p2.y += Math.sin(pushAngle) * 8;

          p1.vx = -Math.cos(pushAngle) * bumpForce;
          p1.vy = -Math.sin(pushAngle) * bumpForce;
          p2.vx = Math.cos(pushAngle) * bumpForce;
          p2.vy = Math.sin(pushAngle) * bumpForce;

          p1.isHopping = true;
          p1.hopVz = 130;
          p2.isHopping = true;
          p2.hopVz = 130;

          p1.shoveCooldown = 0.4;
          p2.shoveCooldown = 0.4;

          // Couch Griefing: Drop caught insects on impact!
          if (p1.caughtInsects.length > 0) {
            for (const ins of p1.caughtInsects) {
              ins.caughtBy = null;
              ins.flightTimer = 0.5;
            }
            p1.caughtInsects = [];
            p1.tongueState = 'IDLE';
            p1.tongueLength = 0;
            this.particles.showFloatingText('INSECT DROPPED!', p1.x, p1.y - 30, '#F59E0B', 20);
          }

          if (p2.caughtInsects.length > 0) {
            for (const ins of p2.caughtInsects) {
              ins.caughtBy = null;
              ins.flightTimer = 0.5;
            }
            p2.caughtInsects = [];
            p2.tongueState = 'IDLE';
            p2.tongueLength = 0;
            this.particles.showFloatingText('INSECT DROPPED!', p2.x, p2.y - 30, '#F59E0B', 20);
          }

          this.audio.playBounce();
          this.particles.showFloatingText('BOING!', (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 - 20, '#38BDF8', 20);
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }

    this.syncDebug();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.stunTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    ps.botReactionTimer = difficulty === 'bot_hard' ? 0.06 : difficulty === 'bot_normal' ? 0.12 : 0.28;

    let bestScore = -9999;
    let bestTarget: Insect | null = null;

    for (const ins of this.insects) {
      if (ins.destroyed || ins.caughtBy !== null) continue;

      const dist = Math.hypot(ins.x - ps.x, ins.y - ps.y);
      if (dist > this.pondRadius * 1.2) continue;

      // Avoid wasps unless underdog has repellent
      if (ins.type === 'wasp') {
        if (!ps.isUnderdog && dist < 60) {
          const fleeAngle = Math.atan2(ps.y - ins.y, ps.x - ins.x);
          const steer = Math.cos(fleeAngle);
          const throttle = Math.sin(fleeAngle);
          this.input.setBotInput(botId, true, steer, throttle, false);
          return;
        }
        if (!ps.isUnderdog) continue;
      }

      let targetScore = (ins.value / (dist + 40)) * 100;
      if (ins.type === 'lotus_butterfly') targetScore += 300;
      if (ins.type === 'golden_beetle') targetScore += 180;
      if (ins.type === 'dragonfly') targetScore += 120;

      if (difficulty === 'bot_hard' && ins.value >= 250) {
        targetScore *= 1.4;
      }

      if (targetScore > bestScore) {
        bestScore = targetScore;
        bestTarget = ins;
      }
    }

    if (!bestTarget) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    let targetX = bestTarget.x;
    let targetY = bestTarget.y;
    const distToTarget = Math.hypot(targetX - ps.x, targetY - ps.y);

    if (difficulty === 'bot_hard') {
      const flightTime = distToTarget / 900;
      targetX += bestTarget.vx * flightTime;
      targetY += bestTarget.vy * flightTime;
    }

    const angleToTarget = Math.atan2(targetY - ps.y, targetX - ps.x);
    const angleDiff = Math.abs(ps.facingAngle - angleToTarget);
    const maxRange = ps.frenzyTimer > 0 ? 195 : (ps.isUnderdog ? 180 : 135);

    const tolerance = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.22 : 0.38;
    if (distToTarget <= maxRange && angleDiff < tolerance && ps.tongueState === 'IDLE') {
      if (difficulty === 'bot_easy' && Math.random() < 0.25) {
        this.input.setBotInput(botId, false, 0, 0, false);
        return;
      }
      this.input.setBotInput(botId, true, 0, 0, true);
    } else {
      const steer = Math.cos(angleToTarget);
      const throttle = Math.sin(angleToTarget);
      this.input.setBotInput(botId, true, steer, throttle, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEME_CONFIGS.find((t) => t.id === this.pondTheme) || THEME_CONFIGS[0];

    // Pond Base & Water Depth
    this.renderPondWaters(ctx, width, height, theme);

    // Swimming Koi Silhouettes
    this.renderKoiFish(ctx);

    // Water Ripples
    this.renderWaterRipples(ctx);

    // Floating Lily Pads
    this.renderLilyPads(ctx);

    // Insects
    for (const ins of this.insects) {
      if (ins.destroyed) continue;
      this.renderInsect(ctx, ins);
    }

    // Frogs & Instant Tongues
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderFrogPlayer(ctx, ps, p);
    }

    // Ambient Rain (Zen theme)
    if (this.pondTheme === 'zen') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.2;
      for (const r of this.rainParticles) {
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x + 3, r.y + r.len);
        ctx.stroke();
      }
    }

    // Minigame HUD Pod at y = 56
    this.renderCenterHudPod(ctx, width, theme);

    // Theme Indicator Pill (bottom-left, x: 20, y: height - 44, w: 170, h: 32)
    this.renderThemePill(ctx, height, theme);

    // Control Hints (Right-aligned)
    this.renderControlHints(ctx, width, height);
  }

  private renderPondWaters(ctx: CanvasRenderingContext2D, width: number, height: number, theme: PondThemeConfig): void {
    if (this.pondTheme === 'emerald') {
      ctx.fillStyle = '#064E3B';
    } else if (this.pondTheme === 'bayou') {
      ctx.fillStyle = '#1E1B4B';
    } else {
      ctx.fillStyle = '#1E293B';
    }
    ctx.fillRect(0, 0, width, height);

    const pondGrad = ctx.createRadialGradient(
      this.pondCenterX,
      this.pondCenterY,
      10,
      this.pondCenterX,
      this.pondCenterY,
      this.pondRadius
    );

    pondGrad.addColorStop(0, theme.bgWaterShallow);
    pondGrad.addColorStop(0.65, theme.bgWaterMid);
    pondGrad.addColorStop(1, theme.bgWaterDeep);

    ctx.beginPath();
    ctx.arc(this.pondCenterX, this.pondCenterY, this.pondRadius, 0, Math.PI * 2);
    ctx.fillStyle = pondGrad;
    ctx.fill();

    ctx.lineWidth = 7;
    ctx.strokeStyle = theme.bankBorderColor;
    ctx.stroke();

    const time = performance.now() * 0.002;
    for (let r = 40; r < this.pondRadius; r += 55) {
      ctx.beginPath();
      ctx.arc(this.pondCenterX, this.pondCenterY, r + Math.sin(time + r) * 4, 0.4, 2.2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.stroke();
    }
  }

  private renderKoiFish(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const fish of this.koiFish) {
      ctx.save();
      ctx.translate(fish.x, fish.y);
      ctx.rotate(fish.angle);

      const sway = Math.sin(performance.now() * 0.008 + fish.length) * 0.35;

      ctx.fillStyle = fish.color;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.ellipse(0, 0, fish.length * 0.5, fish.length * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-fish.length * 0.5, 0);
      ctx.lineTo(-fish.length * 0.85, -fish.length * 0.25 + sway * 8);
      ctx.lineTo(-fish.length * 0.85, fish.length * 0.25 + sway * 8);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
    ctx.restore();
  }

  private renderWaterRipples(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const rip of this.ripples) {
      ctx.beginPath();
      ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
      ctx.strokeStyle = rip.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = Math.max(0, rip.alpha);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderLilyPads(ctx: CanvasRenderingContext2D): void {
    for (const pad of this.lilyPads) {
      ctx.save();
      const bobY = Math.sin(pad.bobPhase) * 3;
      ctx.translate(pad.x, pad.y + bobY);

      ctx.fillStyle = 'rgba(2, 6, 23, 0.35)';
      ctx.beginPath();
      ctx.arc(2, 4, pad.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = pad.isCenterLotus ? '#15803D' : '#16A34A';
      ctx.beginPath();
      const notchStart = pad.notchAngle + 0.35;
      const notchEnd = pad.notchAngle + Math.PI * 2 - 0.35;
      ctx.arc(0, 0, pad.radius, notchStart, notchEnd);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#14532D';
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1.2;
      for (let a = 0; a < Math.PI * 2; a += Math.PI * 0.4) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * (pad.radius * 0.8), Math.sin(a) * (pad.radius * 0.8));
        ctx.stroke();
      }

      if (pad.hasFlower) {
        const petalCount = pad.isCenterLotus ? 8 : 6;
        const petalLen = pad.isCenterLotus ? 22 : 14;
        const petalW = pad.isCenterLotus ? 10 : 7;

        for (let i = 0; i < petalCount; i++) {
          const pAngle = (i / petalCount) * Math.PI * 2;
          ctx.save();
          ctx.rotate(pAngle);
          ctx.beginPath();
          ctx.ellipse(petalLen * 0.65, 0, petalLen * 0.6, petalW * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = pad.flowerColor;
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(0, 0, pad.isCenterLotus ? 9 : 5, 0, Math.PI * 2);
        ctx.fillStyle = '#FBBF24';
        ctx.fill();
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private renderInsect(ctx: CanvasRenderingContext2D, ins: Insect): void {
    ctx.save();
    ctx.translate(ins.x, ins.y - ins.z);

    if (ins.type === 'firefly' || ins.type === 'lotus_butterfly' || ins.type === 'golden_beetle' || ins.color === '#FACC15') {
      const haloGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, ins.radius * 2.2);
      haloGrad.addColorStop(0, ins.glowColor);
      haloGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(0, 0, ins.radius * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    const wingFlap = Math.sin(ins.wingAngle) * (ins.radius * 0.7);

    ctx.beginPath();
    ctx.ellipse(-ins.radius * 0.7, -wingFlap, ins.radius * 0.8, ins.radius * 0.4, 0.35, 0, Math.PI * 2);
    ctx.ellipse(ins.radius * 0.7, -wingFlap, ins.radius * 0.8, ins.radius * 0.4, -0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, ins.radius, 0, Math.PI * 2);
    ctx.fillStyle = ins.color;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    if (ins.type === 'wasp') {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-ins.radius * 0.6, -ins.radius * 0.3, ins.radius * 1.2, 2.5);
      ctx.fillRect(-ins.radius * 0.6, ins.radius * 0.2, ins.radius * 1.2, 2.5);
    } else if (ins.type === 'lotus_butterfly') {
      ctx.beginPath();
      ctx.arc(0, 0, ins.radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }

    ctx.restore();
  }

  private renderFrogPlayer(
    ctx: CanvasRenderingContext2D,
    ps: FrogPlayer,
    p: PlayerConfig
  ): void {
    // 1. Elastic Sticky Tongue
    if (ps.tongueLength > 0) {
      const tipX = ps.x + Math.cos(ps.tongueAngle) * ps.tongueLength;
      const tipY = ps.y + Math.sin(ps.tongueAngle) * ps.tongueLength;

      ctx.beginPath();
      ctx.moveTo(ps.x, ps.y);
      ctx.lineTo(tipX, tipY);
      ctx.strokeStyle = ps.frenzyTimer > 0 ? '#F59E0B' : (ps.isUnderdog ? '#FACC15' : '#F43F5E');
      ctx.lineWidth = ps.frenzyTimer > 0 ? 8 : 5.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(tipX, tipY, ps.frenzyTimer > 0 ? 10 : 8, 0, Math.PI * 2);
      ctx.fillStyle = ps.frenzyTimer > 0 ? '#D97706' : (ps.isUnderdog ? '#EAB308' : '#BE123C');
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    }

    // 2. Drop Shadow under airborne frog
    if (ps.hopZ > 0) {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.4)';
      ctx.beginPath();
      ctx.ellipse(ps.x, ps.y, 16 + ps.hopZ * 0.1, 10 + ps.hopZ * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Underdog Golden Aura
    if (ps.isUnderdog) {
      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(ps.x, ps.y - ps.hopZ, 24, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#F59E0B';
      ctx.font = '900 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SURGE 🍯', ps.x, ps.y - ps.hopZ + 30);
      ctx.restore();
    }

    // 4. Frog Body & Face
    ctx.save();
    ctx.translate(ps.x, ps.y - ps.hopZ);
    ctx.rotate(ps.facingAngle);
    ctx.scale(ps.squashFactor, 1 / ps.squashFactor);

    // Hind Leg Flippers
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(-14, -14, 8, 5, -0.4, 0, Math.PI * 2);
    ctx.ellipse(-14, 14, 8, 5, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    // Main Torso
    ctx.beginPath();
    ctx.ellipse(0, 0, 19, 15, 0, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    // Throat Sac
    const throatRadius = 7 + ps.throatPuff * 3.5;
    ctx.beginPath();
    ctx.arc(5, 0, throatRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.fill();

    // Mascot Avatar Rider on Frog Back
    let mood: CharacterMood = 'focused';
    if (ps.stunTimer > 0) {
      mood = 'shocked';
    } else if (ps.chewTimer > 0 || ps.frenzyTimer > 0) {
      mood = 'triumph';
    } else if (ps.isHopping) {
      mood = 'happy';
    } else if (ps.isUnderdog) {
      mood = 'focused';
    } else {
      mood = 'idle';
    }

    const isBot = p.type.startsWith('bot_');
    ctx.save();
    ctx.translate(-2, 0);
    drawCharacter(ctx, 0, 0, 10, p.id, isBot, mood, this.animTimer * 3);
    ctx.restore();

    // Bulging Frog Eyes
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(8, -12, 6, 0, Math.PI * 2);
    ctx.arc(8, 12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    // Animated Pupils
    ctx.fillStyle = '#0F172A';
    if (ps.stunTimer > 0) {
      ctx.font = '800 9px monospace';
      ctx.fillText('X', 5, -9);
      ctx.fillText('X', 5, 15);
    } else {
      ctx.beginPath();
      ctx.arc(10, -12, 2.8, 0, Math.PI * 2);
      ctx.arc(10, 12, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Frog Mouth
    ctx.beginPath();
    if (ps.mouthOpen > 0) {
      ctx.ellipse(12, 0, 8, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#991B1B';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0F172A';
      ctx.stroke();
    } else if (ps.chewTimer > 0) {
      ctx.arc(11, 0, 7, -Math.PI * 0.35, Math.PI * 0.35);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#0F172A';
      ctx.stroke();
    } else {
      ctx.arc(10, 0, 7, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0F172A';
      ctx.stroke();
    }

    ctx.restore();

    // Frenzy Ring
    if (ps.frenzyTimer > 0) {
      ctx.beginPath();
      ctx.arc(ps.x, ps.y - ps.hopZ, 26, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#F59E0B';
      ctx.stroke();
    }

    // Score Tag above frog
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${ps.score} pts`, ps.x, ps.y - ps.hopZ - 28);
  }

  private renderCenterHudPod(ctx: CanvasRenderingContext2D, width: number, theme: PondThemeConfig): void {
    const podW = 340;
    const podH = 26;
    const podX = width / 2 - podW / 2;
    const podY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 13);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Map Name Badge
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme.pillColor;
    ctx.fillText(theme.name.toUpperCase(), podX + 16, podY + podH / 2);

    // Center Sudden Death or Status
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    if (this.roundTimer <= 15) {
      ctx.fillStyle = '#FACC15';
      ctx.fillText('⚡ QUEEN INSECT SWARM', width / 2, podY + podH / 2);
    } else {
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('LILYPAD HOP & BUG CHOMP', width / 2, podY + podH / 2);
    }

    // Player Status Mini-Dots on Right
    ctx.textAlign = 'right';
    let dotX = podX + podW - 16;
    const active = this.getActivePlayers();
    for (let i = active.length - 1; i >= 0; i--) {
      const p = active[i];
      const ps = this.playersState.get(p.id);

      ctx.beginPath();
      ctx.arc(dotX, podY + podH / 2, 5, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();

      dotX -= 14;
    }
  }

  private renderThemePill(ctx: CanvasRenderingContext2D, height: number, theme: PondThemeConfig): void {
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();

    ctx.strokeStyle = theme.pillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(theme.name, pillX + 14, pillY + pillH / 2);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('[T]', pillX + pillW - 12, pillY + pillH / 2);
    ctx.restore();
  }

  private renderControlHints(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText('Steer: Aim & Hop | Action/Space: Instant Chomp', width - 24, height - 28);
    ctx.restore();
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const rankings = active
      .map((p) => {
        const ps = this.playersState.get(p.id);
        const score = ps ? ps.score : 0;
        return { playerId: p.id, score, place: 1 };
      })
      .sort((a, b) => b.score - a.score);

    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });

    const winnerId =
      rankings.length > 0 && (rankings.length === 1 || rankings[0].score > rankings[1].score)
        ? rankings[0].playerId
        : null;

    let mvpHighlight = 'Pond Apex Predator!';
    if (winnerId !== null) {
      const ps = this.playersState.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} devoured ${ps?.insectsCaught || 0} insects!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
