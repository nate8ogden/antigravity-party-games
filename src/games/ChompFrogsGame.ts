import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export type PondTheme = 'emerald' | 'bayou' | 'zen';

type InsectType = 'gnat' | 'firefly' | 'dragonfly' | 'golden_beetle' | 'lotus_butterfly' | 'wasp';

interface Insect {
  id: number;
  type: InsectType;
  x: number;
  y: number;
  z: number; // Flight elevation
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
  hopZ: number;       // Visual vertical height during arc hop
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
  mouthOpen: number;   // 0 to 1
  chewTimer: number;   // funny chewing puffed cheeks
  throatPuff: number;  // rhythmic croaking throat sac
  squashFactor: number;// squash & stretch on hop landing
  stunTimer: number;
  frenzyTimer: number; // Mega Chomp Frenzy mode
  comboCount: number;
  comboTimer: number;
  score: number;
  insectsCaught: number;
  
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
  private butterflySpawnTimer: number = 10;
  private rainParticles: { x: number; y: number; speed: number; len: number }[] = [];
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);

    if (typeof window !== 'undefined') {
      this.keydownListener = (e: KeyboardEvent) => {
        if (e.key === '1') this.switchTheme('emerald', width, height);
        else if (e.key === '2') this.switchTheme('bayou', width, height);
        else if (e.key === '3') this.switchTheme('zen', width, height);
      };
      window.addEventListener('keydown', this.keydownListener);
    }
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
  }

  public switchTheme(theme: PondTheme, width: number, height: number): void {
    this.pondTheme = theme;
    this.audio.playChime();
    this.particles.showFloatingText(
      `POND: ${theme.toUpperCase()}!`,
      width / 2,
      height / 2 - 40,
      theme === 'emerald' ? '#34D399' : theme === 'bayou' ? '#A855F7' : '#38BDF8',
      24
    );
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

    this.pondCenterX = width / 2;
    this.pondCenterY = height / 2 + 16;
    this.pondRadius = Math.min(width, height) * 0.42;

    this.generatePondEnvironment(width, height);
    this.initFrogs(width, height);

    // Initial insect population
    for (let i = 0; i < 16; i++) {
      this.spawnInsect(false);
    }
  }

  private generatePondEnvironment(width: number, height: number): void {
    this.lilyPads = [];
    this.koiFish = [];
    this.ripples = [];

    // 1. Center Giant Lotus Pad (Blooms rare butterflies!)
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

    // 2. Ring of outer floating lily pads
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

    // 3. Ambient Swimming Koi Fish
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

    // 4. Rain Particles for Zen theme
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
      // Spawn players on distinct perimeter lily pads
      let spawnX = this.pondCenterX - 140;
      let spawnY = this.pondCenterY;
      let facing = 0;
      let padId: number | null = 1;

      if (count === 2) {
        if (idx === 0) {
          spawnX = this.pondCenterX - 145;
          spawnY = this.pondCenterY;
          facing = 0; // facing right towards center
          padId = 1;
        } else {
          spawnX = this.pondCenterX + 145;
          spawnY = this.pondCenterY;
          facing = Math.PI; // facing left towards center
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
        maxTongueRange: 135,
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
        botReactionTimer: 0.15 + idx * 0.05,
        botTargetInsectId: null
      });
    });
  }

  private spawnInsect(isButterfly: boolean = false): void {
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
    } else {
      const roll = Math.random();
      if (roll < 0.35) {
        // Gnat swarm
        type = 'gnat';
        value = 50;
        color = '#A3E635';
        glowColor = '#BEF264';
        radius = 7;
        speed = 45;
      } else if (roll < 0.65) {
        // Firefly
        type = 'firefly';
        value = 100;
        color = '#FDE047';
        glowColor = '#FEF08A';
        radius = 9;
        speed = 35;
      } else if (roll < 0.82) {
        // Dragonfly
        type = 'dragonfly';
        value = 220;
        color = '#38BDF8';
        glowColor = '#7DD3FC';
        radius = 11;
        speed = 85;
      } else if (roll < 0.91) {
        // Golden Beetle
        type = 'golden_beetle';
        value = 350;
        color = '#F59E0B';
        glowColor = '#FDE68A';
        radius = 12;
        speed = 30;
      } else {
        // Stinging Wasp
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

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Dynamic Spawners
    this.spawnTimer -= dt;
    const activeInsects = this.insects.filter((ins) => !ins.destroyed && ins.caughtBy === null);
    if (this.spawnTimer <= 0 && activeInsects.length < 18) {
      this.spawnInsect(false);
      this.spawnTimer = 1.0 + Math.random() * 0.7;
    }

    // Queen Lotus Butterfly event every 14 seconds
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
          // Spawn little water ring on hit
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

    // Update Koi Fish Swimming
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

      // Keep within pond
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
          // Dragonflies dart in sharp angles; fireflies drift gently
          const turn = (Math.random() - 0.5) * (ins.type === 'dragonfly' ? 2.2 : 0.8);
          const curAngle = Math.atan2(ins.vy, ins.vx) + turn;
          const speed = Math.hypot(ins.vx, ins.vy);
          ins.vx = Math.cos(curAngle) * speed;
          ins.vy = Math.sin(curAngle) * speed;
        }

        ins.x += ins.vx * dt;
        ins.y += ins.vy * dt;

        // Bounce gently inside pond boundary
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

      // Stun Timer (from wasps or head-on collision)
      if (ps.stunTimer > 0) {
        ps.stunTimer = Math.max(0, ps.stunTimer - dt);
        ps.mouthOpen = 0;
        ps.tongueState = 'IDLE';
        ps.tongueProgress = 0;
        ps.squashFactor = 1.25;
        continue;
      }

      // Frenzy Mode & Combo Timers
      if (ps.frenzyTimer > 0) {
        ps.frenzyTimer = Math.max(0, ps.frenzyTimer - dt);
        // Golden frenzy sparkle trail
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

      // Rhythmically puff vocal throat sac
      ps.throatPuff = Math.sin(performance.now() * 0.007 + Number(p.id)) * 0.5 + 0.5;

      // Handle Hopping & Movement
      ps.hopCooldown = Math.max(0, ps.hopCooldown - dt);

      // Read player inputs
      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const inputMagnitude = Math.hypot(steer, throttle);

      if (inputMagnitude > 0.25) {
        ps.facingAngle = Math.atan2(throttle, steer);
      }

      // Check for Instant Frog Jump
      const justAction = this.input.justAction(p.id);
      const justPressed = this.input.justPressed(p.id);
      const isAction = this.input.isActionPressed(p.id);

      // Free-roam hop if moving
      if (!ps.isHopping && ps.hopCooldown <= 0 && inputMagnitude > 0.3) {
        ps.isHopping = true;
        const jumpBase = ps.onLilypadId !== null ? 240 : 175;
        ps.hopVz = jumpBase;
        ps.hopZ = 2;
        const hopSpeed = ps.onLilypadId !== null ? 220 : 150;
        ps.vx = Math.cos(ps.facingAngle) * hopSpeed;
        ps.vy = Math.sin(ps.facingAngle) * hopSpeed;
        ps.squashFactor = 0.75; // stretch upward
        this.audio.playBounce();

        if (ps.inWater) {
          // Water splash
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

        // Landing
        if (ps.hopZ <= 0) {
          ps.hopZ = 0;
          ps.isHopping = false;
          ps.vx = 0;
          ps.vy = 0;
          ps.hopCooldown = 0.12;
          ps.squashFactor = 1.35; // squash on landing

          // Check if landing on a lily pad
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
            // Pad bob dip
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
        // Friction when on ground/water
        ps.squashFactor += (1.0 - ps.squashFactor) * 8 * dt;
      }

      // Keep Frog inside pond arena boundary
      const distFromPondCenter = Math.hypot(ps.x - this.pondCenterX, ps.y - this.pondCenterY);
      if (distFromPondCenter > this.pondRadius * 0.92) {
        const edgeAngle = Math.atan2(ps.y - this.pondCenterY, ps.x - this.pondCenterX);
        ps.x = this.pondCenterX + Math.cos(edgeAngle) * (this.pondRadius * 0.92);
        ps.y = this.pondCenterY + Math.sin(edgeAngle) * (this.pondRadius * 0.92);
      }

      // Trigger Instant Frog Chomp! (Space, Enter, Action or Tap without moving)
      const triggerChomp = justAction || (justPressed && inputMagnitude < 0.25);
      if (triggerChomp && ps.tongueState === 'IDLE') {
        ps.tongueState = 'SNAP_OUT';
        ps.tongueProgress = 0;
        ps.tongueAngle = ps.facingAngle;
        ps.mouthOpen = 1;
        ps.maxTongueRange = ps.frenzyTimer > 0 ? 195 : 140;
        this.audio.playWhoosh();
      }

      // Instant Tongue Snap Lifecycle
      if (ps.tongueState === 'SNAP_OUT') {
        const snapSpeed = ps.frenzyTimer > 0 ? 1100 : 880; // px/s
        ps.tongueProgress += (snapSpeed / ps.maxTongueRange) * dt;
        ps.tongueLength = Math.min(ps.maxTongueRange, ps.tongueProgress * ps.maxTongueRange);

        const tipX = ps.x + Math.cos(ps.tongueAngle) * ps.tongueLength;
        const tipY = ps.y + Math.sin(ps.tongueAngle) * ps.tongueLength;

        // Snatch insect in path!
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
        const retractSpeed = 1350; // lightning fast snap back into mouth
        ps.tongueProgress -= (retractSpeed / ps.maxTongueRange) * dt;
        ps.tongueLength = Math.max(0, ps.tongueProgress * ps.maxTongueRange);

        const tipX = ps.x + Math.cos(ps.tongueAngle) * ps.tongueLength;
        const tipY = ps.y + Math.sin(ps.tongueAngle) * ps.tongueLength;

        for (const ins of ps.caughtInsects) {
          ins.x = tipX;
          ins.y = tipY;
        }

        // Fully snapped back into frog's mouth!
        if (ps.tongueProgress <= 0) {
          ps.tongueState = 'IDLE';
          ps.tongueProgress = 0;
          ps.tongueLength = 0;
          ps.mouthOpen = 0;

          if (ps.caughtInsects.length > 0) {
            for (const ins of ps.caughtInsects) {
              ins.destroyed = true;

              if (ins.type === 'wasp') {
                // Stung by Wasp!
                ps.score = Math.max(0, ps.score + ins.value);
                ps.stunTimer = 1.6;
                this.audio.playStun();
                this.particles.showFloatingText('STUNG! -150', ps.x, ps.y - 34, '#EF4444', 24);
                this.particles.spawnExplosion(ps.x, ps.y, '#EF4444', 16);
                ps.comboCount = 0;
              } else {
                // Delicious Insect Chomp!
                ps.comboCount += 1;
                ps.comboTimer = 2.8;

                // Frenzy activation at 3 consecutive catches!
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

    // Frog vs Frog Body Bumping Collision
    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const p1 = this.playersState.get(active[i].id);
        const p2 = this.playersState.get(active[j].id);
        if (!p1 || !p2) continue;

        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (dist < 36) {
          const pushAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          const bumpForce = 140;
          p1.x -= Math.cos(pushAngle) * 8;
          p1.y -= Math.sin(pushAngle) * 8;
          p2.x += Math.cos(pushAngle) * 8;
          p2.y += Math.sin(pushAngle) * 8;

          p1.vx = -Math.cos(pushAngle) * bumpForce;
          p1.vy = -Math.sin(pushAngle) * bumpForce;
          p2.vx = Math.cos(pushAngle) * bumpForce;
          p2.vy = Math.sin(pushAngle) * bumpForce;

          p1.isHopping = true;
          p1.hopVz = 120;
          p2.isHopping = true;
          p2.hopVz = 120;

          this.audio.playBounce();
          this.particles.showFloatingText('BOING!', (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 - 20, '#38BDF8', 20);
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
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

    // Reset reaction timer based on difficulty
    ps.botReactionTimer = difficulty === 'bot_hard' ? 0.06 : difficulty === 'bot_normal' ? 0.12 : 0.28;

    // Find optimal target insect
    let bestScore = -9999;
    let bestTarget: Insect | null = null;

    for (const ins of this.insects) {
      if (ins.destroyed || ins.caughtBy !== null) continue;

      const dist = Math.hypot(ins.x - ps.x, ins.y - ps.y);
      if (dist > this.pondRadius * 1.2) continue;

      // Heavy penalty for wasps so bot naturally avoids them
      if (ins.type === 'wasp') {
        if (dist < 60) {
          // Danger close! Run away!
          const fleeAngle = Math.atan2(ps.y - ins.y, ps.x - ins.x);
          const steer = Math.cos(fleeAngle);
          const throttle = Math.sin(fleeAngle);
          this.input.setBotInput(botId, true, steer, throttle, false);
          return;
        }
        continue;
      }

      let targetScore = (ins.value / (dist + 40)) * 100;
      if (ins.type === 'lotus_butterfly') targetScore += 300;
      if (ins.type === 'golden_beetle') targetScore += 180;
      if (ins.type === 'dragonfly') targetScore += 120;

      // Hard bots prioritize high value prey heavily
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

    // Lead calculation for fast insects on Hard bot
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
    const maxRange = ps.frenzyTimer > 0 ? 190 : 135;

    // In Chomp Range & Facing Target: SNAP!
    const tolerance = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.22 : 0.38;
    if (distToTarget <= maxRange && angleDiff < tolerance && ps.tongueState === 'IDLE') {
      if (difficulty === 'bot_easy' && Math.random() < 0.3) {
        // Easy bot occasional hesitate
        this.input.setBotInput(botId, false, 0, 0, false);
        return;
      }
      this.input.setBotInput(botId, true, 0, 0, true);
    } else {
      // Navigate / Hop towards target!
      const steer = Math.cos(angleToTarget);
      const throttle = Math.sin(angleToTarget);
      this.input.setBotInput(botId, true, steer, throttle, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Lush Pond Base & Water Depth
    this.renderPondWaters(ctx, width, height);

    // 2. Swimming Koi Silhouettes
    this.renderKoiFish(ctx);

    // 3. Water Ripples & Splashes
    this.renderWaterRipples(ctx);

    // 4. Floating Lily Pads & Lotus Blossoms
    this.renderLilyPads(ctx);

    // 5. Insects (Flies, Dragonflies, Butterflies, Wasps)
    for (const ins of this.insects) {
      if (ins.destroyed) continue;
      this.renderInsect(ctx, ins);
    }

    // 6. Frogs & Instant Tongues
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderFrogPlayer(ctx, ps, p.color);
    }

    // 7. Ambient Rain (Zen theme)
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

    // 8. Center HUD Pod
    this.renderCenterHudPod(ctx, width);
  }

  private renderPondWaters(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Ambient Garden Surroundings
    if (this.pondTheme === 'emerald') {
      ctx.fillStyle = '#064E3B';
    } else if (this.pondTheme === 'bayou') {
      ctx.fillStyle = '#1E1B4B';
    } else {
      ctx.fillStyle = '#1E293B';
    }
    ctx.fillRect(0, 0, width, height);

    // Deep Pond Gradient
    const pondGrad = ctx.createRadialGradient(
      this.pondCenterX,
      this.pondCenterY,
      10,
      this.pondCenterX,
      this.pondCenterY,
      this.pondRadius
    );

    if (this.pondTheme === 'emerald') {
      pondGrad.addColorStop(0, '#0284C7');
      pondGrad.addColorStop(0.65, '#0369A1');
      pondGrad.addColorStop(1, '#075985');
    } else if (this.pondTheme === 'bayou') {
      pondGrad.addColorStop(0, '#4C1D95');
      pondGrad.addColorStop(0.65, '#312E81');
      pondGrad.addColorStop(1, '#0F172A');
    } else {
      // Zen slate
      pondGrad.addColorStop(0, '#334155');
      pondGrad.addColorStop(0.65, '#1E293B');
      pondGrad.addColorStop(1, '#0F172A');
    }

    ctx.beginPath();
    ctx.arc(this.pondCenterX, this.pondCenterY, this.pondRadius, 0, Math.PI * 2);
    ctx.fillStyle = pondGrad;
    ctx.fill();

    // Pond Bank Border
    ctx.lineWidth = 7;
    ctx.strokeStyle = this.pondTheme === 'emerald' ? '#047857' : this.pondTheme === 'bayou' ? '#6D28D9' : '#475569';
    ctx.stroke();

    // Subtle water caustics rings
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

      // Swimming tail sway
      const sway = Math.sin(performance.now() * 0.008 + fish.length) * 0.35;

      ctx.fillStyle = fish.color;
      ctx.globalAlpha = 0.45; // translucent beneath water surface
      ctx.beginPath();
      ctx.ellipse(0, 0, fish.length * 0.5, fish.length * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tail fin
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

      // Pad drop shadow in water
      ctx.fillStyle = 'rgba(2, 6, 23, 0.35)';
      ctx.beginPath();
      ctx.arc(2, 4, pad.radius, 0, Math.PI * 2);
      ctx.fill();

      // Lush Lily Pad Leaf with V-shaped notch
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

      // Pad leaf veins
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1.2;
      for (let a = 0; a < Math.PI * 2; a += Math.PI * 0.4) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * (pad.radius * 0.8), Math.sin(a) * (pad.radius * 0.8));
        ctx.stroke();
      }

      // Blooming Lotus Flower
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

        // Golden Pollen Core
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

    // Glowing Ambient Halo for Fireflies & Butterflies
    if (ins.type === 'firefly' || ins.type === 'lotus_butterfly' || ins.type === 'golden_beetle') {
      const haloGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, ins.radius * 2.2);
      haloGrad.addColorStop(0, ins.glowColor);
      haloGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(0, 0, ins.radius * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fluttering Translucent Wings
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    const wingFlap = Math.sin(ins.wingAngle) * (ins.radius * 0.7);

    ctx.beginPath();
    ctx.ellipse(-ins.radius * 0.7, -wingFlap, ins.radius * 0.8, ins.radius * 0.4, 0.35, 0, Math.PI * 2);
    ctx.ellipse(ins.radius * 0.7, -wingFlap, ins.radius * 0.8, ins.radius * 0.4, -0.35, 0, Math.PI * 2);
    ctx.fill();

    // Main Insect Torso
    ctx.beginPath();
    ctx.arc(0, 0, ins.radius, 0, Math.PI * 2);
    ctx.fillStyle = ins.color;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    // Insect Features
    if (ins.type === 'wasp') {
      // Warning black stripes
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-ins.radius * 0.6, -ins.radius * 0.3, ins.radius * 1.2, 2.5);
      ctx.fillRect(-ins.radius * 0.6, ins.radius * 0.2, ins.radius * 1.2, 2.5);
    } else if (ins.type === 'lotus_butterfly') {
      // Royal Crown / Sparkling Core
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
    color: string
  ): void {
    // 1. Elastic Sticky Tongue (when active)
    if (ps.tongueLength > 0) {
      const tipX = ps.x + Math.cos(ps.tongueAngle) * ps.tongueLength;
      const tipY = ps.y + Math.sin(ps.tongueAngle) * ps.tongueLength;

      ctx.beginPath();
      ctx.moveTo(ps.x, ps.y);
      ctx.lineTo(tipX, tipY);
      ctx.strokeStyle = ps.frenzyTimer > 0 ? '#F59E0B' : '#F43F5E';
      ctx.lineWidth = ps.frenzyTimer > 0 ? 8 : 5.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Suction Cup Tip
      ctx.beginPath();
      ctx.arc(tipX, tipY, ps.frenzyTimer > 0 ? 10 : 8, 0, Math.PI * 2);
      ctx.fillStyle = ps.frenzyTimer > 0 ? '#D97706' : '#BE123C';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    }

    // 2. Drop Shadow (under frog while airborne)
    if (ps.hopZ > 0) {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.4)';
      ctx.beginPath();
      ctx.ellipse(ps.x, ps.y, 16 + ps.hopZ * 0.1, 10 + ps.hopZ * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Frog Body & Face
    ctx.save();
    // Render elevated if hopping
    ctx.translate(ps.x, ps.y - ps.hopZ);
    ctx.rotate(ps.facingAngle);
    ctx.scale(ps.squashFactor, 1 / ps.squashFactor);

    // Hind Leg Flippers
    ctx.fillStyle = color;
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
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    // Throat Sac (pulsing croak bubble)
    const throatRadius = 7 + ps.throatPuff * 3.5;
    ctx.beginPath();
    ctx.arc(5, 0, throatRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.fill();

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
      // Dizzy X eyes
      ctx.font = '800 9px monospace';
      ctx.fillText('X', 5, -9);
      ctx.fillText('X', 5, 15);
    } else {
      ctx.beginPath();
      ctx.arc(10, -12, 2.8, 0, Math.PI * 2);
      ctx.arc(10, 12, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Frog Mouth (Mouth Snaps Open on Chomp, or Chews on Catch)
    ctx.beginPath();
    if (ps.mouthOpen > 0) {
      // Wide open cartoon snap
      ctx.ellipse(12, 0, 8, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#991B1B';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0F172A';
      ctx.stroke();
    } else if (ps.chewTimer > 0) {
      // Chewing puffed cheeks
      ctx.arc(11, 0, 7, -Math.PI * 0.35, Math.PI * 0.35);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#0F172A';
      ctx.stroke();
    } else {
      // Cheerful frog smile
      ctx.arc(10, 0, 7, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0F172A';
      ctx.stroke();
    }

    ctx.restore();

    // Frenzy Aura Ring if active
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

  private renderCenterHudPod(ctx: CanvasRenderingContext2D, width: number): void {
    const podW = 380;
    const podH = 28;
    const podX = width / 2 - podW / 2;
    const podY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 14);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Map Theme Badge
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = this.pondTheme === 'emerald' ? '#34D399' : this.pondTheme === 'bayou' ? '#A855F7' : '#38BDF8';
    ctx.fillText(`POND: ${this.pondTheme.toUpperCase()} [1-3]`, podX + 16, podY + 18);

    // Timer display
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    const timerColor = this.roundTimer < 10 ? '#EF4444' : '#F1F5F9';
    ctx.fillStyle = timerColor;
    ctx.fillText(`TIME: ${this.roundTimer.toFixed(1)}s`, podX + podW - 16, podY + 18);
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
