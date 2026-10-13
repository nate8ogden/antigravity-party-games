import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

type BalloonKind = 'standard' | 'golden' | 'bomb' | 'speedy';

interface GalleryBalloon {
  id: number;
  tier: number; // 0 (top), 1 (mid), 2 (low)
  x: number;
  y: number;
  radius: number;
  kind: BalloonKind;
  color: string;
  points: number;
  bobPhase: number;
  popped: boolean;
}

interface FlyingDart {
  id: number;
  playerId: PlayerId;
  color: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  isPiercing: boolean;
  pierceRemaining: number;
  alive: boolean;
}

interface DartPlayerState {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimAngle: number;
  chargeTime: number; // 0 to 1.3s
  isCharging: boolean;
  cooldown: number;
  score: number;
  poppedCount: number;
  combo: number;
  streakTimer: number;
  staggerTimer: number;
  stunTimer: number;
  sabotageCount: number;
  mood: CharacterMood;
  animTimer: number;
  isUnderdog: boolean;
}

interface GalleryPlushie {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  points: number;
  radius: number;
  collected: boolean;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgTop: string;
  bgBottom: string;
  boardwalkFloor: string;
  rimColor: string;
  awningA: string;
  awningB: string;
  conveyorColor: string;
  balloonPalette: string[];
}

const THEMES: VisualTheme[] = [
  {
    name: 'Carnival Midway Classic',
    icon: '🎪',
    bgTop: '#3B1506',
    bgBottom: '#180702',
    boardwalkFloor: '#78350F',
    rimColor: '#F59E0B',
    awningA: '#EF4444',
    awningB: '#FDE047',
    conveyorColor: '#451A03',
    balloonPalette: ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#A855F7', '#EC4899']
  },
  {
    name: 'Cyber Neon Gallery',
    icon: '⚡',
    bgTop: '#09132B',
    bgBottom: '#020617',
    boardwalkFloor: '#0F172A',
    rimColor: '#06B6D4',
    awningA: '#00D4FF',
    awningB: '#EC4899',
    conveyorColor: '#1E293B',
    balloonPalette: ['#00F0FF', '#FF007F', '#39FF14', '#FFD700', '#C084FC', '#FB923C']
  },
  {
    name: 'Sunset Boardwalk Pier',
    icon: '🌅',
    bgTop: '#240B2B',
    bgBottom: '#0A020D',
    boardwalkFloor: '#4C0519',
    rimColor: '#FB7185',
    awningA: '#F43F5E',
    awningB: '#FBBF24',
    conveyorColor: '#2D0A1E',
    balloonPalette: ['#FF5722', '#F43F5E', '#14B8A6', '#FACC15', '#A855F7', '#38BDF8']
  }
];

export class BalloonDartGame extends BaseGame {
  private balloons: GalleryBalloon[] = [];
  private flyingDarts: FlyingDart[] = [];
  private playerStates: Map<PlayerId, DartPlayerState> = new Map();
  private plushies: GalleryPlushie[] = [];
  private nextPlushieId: number = 1;
  private plushieSpawnTimer: number = 2.0;

  private balloonCounter: number = 0;
  private dartCounter: number = 0;
  private tierSpeeds: number[] = [70, -105, 135]; // px/s
  private windForce: number = 0;
  private windChangeTimer: number = 3.5;
  private spawnTimer: number = 0;

  private currentThemeIdx: number = 0;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private clickListener: ((e: MouseEvent) => void) | null = null;
  private lastCanvasWidth: number = 800;
  private lastCanvasHeight: number = 600;

  // Bot sensory perception buffers
  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.setupThemeListeners();
    this.reset(width, height);
  }

  private setupThemeListeners(): void {
    if (typeof window === 'undefined') return;

    this.keydownListener = (e: KeyboardEvent) => {
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
    window.addEventListener('keydown', this.keydownListener);

    this.clickListener = (e: MouseEvent) => {
      const rect = {
        x: 20,
        y: this.lastCanvasHeight - 44,
        w: 170,
        h: 32
      };
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const cRect = canvas.getBoundingClientRect();
      const scaleX = this.lastCanvasWidth / cRect.width;
      const scaleY = this.lastCanvasHeight / cRect.height;
      const mx = (e.clientX - cRect.left) * scaleX;
      const my = (e.clientY - cRect.top) * scaleY;

      if (mx >= rect.x && mx <= rect.x + rect.w && my >= rect.y && my <= rect.y + rect.h) {
        this.cycleTheme();
      }
    };
    window.addEventListener('click', this.clickListener);
  }

  private cycleTheme(): void {
    this.currentThemeIdx = (this.currentThemeIdx + 1) % THEMES.length;
    this.audio.playTone(540 + this.currentThemeIdx * 80, 0.08, 'triangle');
  }

  private setTheme(idx: number): void {
    if (idx >= 0 && idx < THEMES.length) {
      this.currentThemeIdx = idx;
      this.audio.playTone(540 + this.currentThemeIdx * 80, 0.08, 'triangle');
    }
  }

  public reset(width: number = 800, height: number = 600): void {
    this.lastCanvasWidth = width;
    this.lastCanvasHeight = height;
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.balloons = [];
    this.flyingDarts = [];
    this.plushies = [];
    this.botReactionTimers.clear();
    this.balloonCounter = 0;
    this.dartCounter = 0;
    this.windForce = (Math.random() - 0.5) * 35;
    this.windChangeTimer = 3.5;
    this.spawnTimer = 0;
    this.plushieSpawnTimer = 1.8;

    this.initPlayers(width, height);
    this.populateInitialBalloons(width, height);
  }

  private initPlayers(width: number, height: number): void {
    this.playerStates.clear();
    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const px = spacing * (idx + 1);
      const py = height - 85;
      this.playerStates.set(p.id, {
        id: p.id,
        x: px,
        y: py,
        vx: 0,
        vy: 0,
        aimAngle: -Math.PI / 2,
        chargeTime: 0,
        isCharging: false,
        cooldown: 0,
        score: 0,
        poppedCount: 0,
        combo: 0,
        streakTimer: 0,
        staggerTimer: 0,
        stunTimer: 0,
        sabotageCount: 0,
        mood: 'idle',
        animTimer: 0,
        isUnderdog: false
      });
      this.botReactionTimers.set(p.id, 0);
    });
  }

  private populateInitialBalloons(width: number, height: number): void {
    const tierYs = [height * 0.22, height * 0.35, height * 0.48];
    const theme = THEMES[this.currentThemeIdx];

    tierYs.forEach((ty, tIdx) => {
      const count = 7;
      for (let i = 0; i < count; i++) {
        const x = (width / (count + 1)) * (i + 1) + (Math.random() - 0.5) * 20;
        this.spawnBalloonAt(x, ty, tIdx, theme.balloonPalette[(i + tIdx) % theme.balloonPalette.length]);
      }
    });
  }

  private spawnBalloonAt(x: number, y: number, tier: number, color: string): void {
    const roll = Math.random();
    let kind: BalloonKind = 'standard';
    let points = 100;
    let radius = 17;
    let bColor = color;

    if (roll < 0.14) {
      kind = 'bomb';
      points = 350;
      bColor = '#0F172A'; // Explosive TNT Bomb
      radius = 19;
    } else if (roll < 0.30) {
      kind = 'golden';
      points = 250;
      bColor = '#FBBF24'; // Golden Star Balloon
      radius = 16;
    } else if (roll < 0.45) {
      kind = 'speedy';
      points = 180;
      bColor = '#06B6D4'; // Speedy Hummingbird Balloon
      radius = 14;
    }

    this.balloons.push({
      id: ++this.balloonCounter,
      tier,
      x,
      y,
      radius,
      kind,
      color: bColor,
      points,
      bobPhase: Math.random() * Math.PI * 2,
      popped: false
    });
  }

  private spawnPlushie(width: number, height: number): void {
    if (this.plushies.length >= 3) return;
    this.plushies.push({
      id: this.nextPlushieId++,
      x: width * 0.15 + Math.random() * (width * 0.7),
      y: height - 120 + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 25,
      vy: (Math.random() - 0.5) * 20,
      points: 80,
      radius: 14,
      collected: false
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastCanvasWidth = width;
    this.lastCanvasHeight = height;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      return;
    }

    const isSuddenDeath = this.roundTimer <= 12.0;
    const speedMult = isSuddenDeath ? 1.6 : 1.0;

    // Crosswind update
    this.windChangeTimer -= dt;
    if (this.windChangeTimer <= 0) {
      this.windChangeTimer = 3.0 + Math.random() * 2.5;
      this.windForce = (Math.random() - 0.5) * 55;
    }

    // Underdog check (trailing by >= 35 points)
    let maxScore = -Infinity;
    for (const ps of this.playerStates.values()) {
      if (ps.score > maxScore) maxScore = ps.score;
    }
    for (const ps of this.playerStates.values()) {
      ps.isUnderdog = maxScore - ps.score >= 35 && maxScore > 20;
    }

    // Bot AI Decision cycle
    this.updateBots(dt, width, height);

    // Update Sharpshooter Players
    this.updatePlayers(dt, width, height, isSuddenDeath);

    // Physical Sharpshooter Collisions on the Boardwalk Deck
    this.handlePlayerCollisions();

    // Move Conveyor Balloons & Respawn
    this.updateConveyorBalloons(dt, width, height, speedMult);

    // Update Flying Darts
    this.updateFlyingDarts(dt, isSuddenDeath);

    // Update Plushie Collectibles
    this.updatePlushies(dt, width, height);
  }

  private updatePlayers(dt: number, width: number, height: number, isSuddenDeath: boolean): void {
    const active = this.getActivePlayers();

    for (const p of active) {
      const ps = this.playerStates.get(p.id);
      if (!ps) continue;

      ps.animTimer += dt;
      if (ps.cooldown > 0) ps.cooldown -= dt;
      if (ps.streakTimer > 0) {
        ps.streakTimer -= dt;
        if (ps.streakTimer <= 0) ps.combo = 0;
      }

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        ps.vx *= Math.pow(0.08, dt);
        ps.vy *= Math.pow(0.08, dt);
        ps.x += ps.vx * dt;
        ps.y += ps.vy * dt;
        continue;
      }

      if (ps.staggerTimer > 0) {
        ps.staggerTimer -= dt;
        ps.vx *= Math.pow(0.1, dt);
        ps.vy *= Math.pow(0.1, dt);
        ps.x += ps.vx * dt;
        ps.y += ps.vy * dt;
        continue;
      }

      // Read steer & throttle inputs
      const steerX = this.input.getSteer(p.id);
      const throttleY = -this.input.getThrottle(p.id);
      const actionHeld = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      const moveSpeed = ps.isUnderdog ? 220 : 170;

      // 360° locomotion along boardwalk deck
      const inputMag = Math.hypot(steerX, throttleY);
      if (inputMag > 0.1) {
        ps.vx += (steerX / inputMag) * moveSpeed * dt * 8.0;
        ps.vy += (throttleY / inputMag) * moveSpeed * dt * 8.0;
      }
      ps.vx *= Math.pow(0.04, dt);
      ps.vy *= Math.pow(0.04, dt);

      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Clamp to boardwalk deck boundaries
      const minX = 40;
      const maxX = width - 40;
      const minY = height - 140;
      const maxY = height - 55;

      if (ps.x < minX) { ps.x = minX; ps.vx = 0; }
      if (ps.x > maxX) { ps.x = maxX; ps.vx = 0; }
      if (ps.y < minY) { ps.y = minY; ps.vy = 0; }
      if (ps.y > maxY) { ps.y = maxY; ps.vy = 0; }

      // Aim angle is steered upwards with lateral offset from steerX
      const targetAim = -Math.PI / 2 + steerX * 0.55;
      ps.aimAngle += (targetAim - ps.aimAngle) * dt * 10.0;

      // Hold-to-Charge Crossbow Power Sweet Spot (72%–98%)
      if (actionHeld && ps.cooldown <= 0) {
        ps.isCharging = true;
        ps.chargeTime += dt;
        ps.mood = 'focused';

        // Overcharge past 1.25s triggers Snapped Bowstring Misfire!
        if (ps.chargeTime > 1.25) {
          ps.isCharging = false;
          ps.chargeTime = 0;
          ps.cooldown = 0.75;
          ps.staggerTimer = 0.75;
          ps.score = Math.max(0, ps.score - 5);
          ps.combo = 0;
          ps.mood = 'shocked';
          this.audio.playTone(160, 0.25, 'sawtooth');
          this.particles.emit(ps.x, ps.y, 16, '#EF4444');
          this.particles.showFloatingText('BOWSTRING SNAP! -5', ps.x, ps.y - 35, '#EF4444', 18);
        }
      } else {
        if (ps.isCharging) {
          // Releasing charged dart: check sweet spot!
          ps.isCharging = false;
          ps.cooldown = 0.28;

          const sweetMin = ps.isUnderdog ? 0.50 : 0.72;
          const sweetMax = ps.isUnderdog ? 1.05 : 0.98;
          const isSweet = ps.chargeTime >= sweetMin && ps.chargeTime <= sweetMax;

          const dartSpeed = isSweet ? 880 : 660;
          const dartVx = Math.cos(ps.aimAngle) * dartSpeed;
          const dartVy = Math.sin(ps.aimAngle) * dartSpeed;

          this.flyingDarts.push({
            id: ++this.dartCounter,
            playerId: p.id,
            color: p.color,
            startX: ps.x,
            startY: ps.y - 14,
            x: ps.x,
            y: ps.y - 14,
            vx: dartVx,
            vy: dartVy,
            angle: ps.aimAngle,
            isPiercing: isSweet,
            pierceRemaining: isSweet ? 3 : 1,
            alive: true
          });

          if (isSweet) {
            this.audio.playTone(760, 0.14, 'sine');
            this.audio.playTone(980, 0.12, 'triangle');
            this.particles.emit(ps.x, ps.y - 14, 18, '#FACC15');
            this.particles.showFloatingText('PIERCING PLASMA DART! ★', ps.x, ps.y - 40, '#FACC15', 20);
          } else {
            this.audio.playWhoosh();
          }

          ps.chargeTime = 0;
        } else {
          if (ps.mood !== 'triumph') ps.mood = 'idle';
        }
      }
    }
  }

  private handlePlayerCollisions(): void {
    const list = Array.from(this.playerStates.values());
    const rad = 20;

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = rad * 2;

        if (dist < minDist && dist > 0.01) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          const relVx = b.vx - a.vx;
          const relVy = b.vy - a.vy;
          const impulse = relVx * nx + relVy * ny;

          if (impulse < 0) {
            const p = impulse * 1.35 * 0.5;
            a.vx += nx * p;
            a.vy += ny * p;
            b.vx -= nx * p;
            b.vy -= ny * p;

            const impactSpeed = Math.abs(impulse);
            if (impactSpeed > 80) {
              this.audio.playTone(260 + Math.min(impactSpeed, 280), 0.08, 'triangle');
              this.particles.emit((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, 8, '#FFFFFF');

              // Booth Shunt Sabotage: if player was charging shot, bump disrupts aim!
              if (a.isCharging) {
                b.score += 30;
                b.sabotageCount++;
                b.mood = 'triumph';
                a.isCharging = false;
                a.chargeTime = 0;
                a.staggerTimer = 0.65;
                a.mood = 'shocked';
                this.audio.playTone(660, 0.14, 'square');
                this.particles.showFloatingText('BOOTH SHUNT! +30', b.x, b.y - 35, '#F59E0B', 18);
              } else if (b.isCharging) {
                a.score += 30;
                a.sabotageCount++;
                a.mood = 'triumph';
                b.isCharging = false;
                b.chargeTime = 0;
                b.staggerTimer = 0.65;
                b.mood = 'shocked';
                this.audio.playTone(660, 0.14, 'square');
                this.particles.showFloatingText('BOOTH SHUNT! +30', a.x, a.y - 35, '#F59E0B', 18);
              }
            }
          }
        }
      }
    }
  }

  private updateConveyorBalloons(dt: number, width: number, height: number, speedMult: number): void {
    const tierYs = [height * 0.22, height * 0.35, height * 0.48];
    const theme = THEMES[this.currentThemeIdx];

    // Spawn new balloons on conveyor edges if sparse
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.balloons.filter(b => !b.popped).length < 20) {
      this.spawnTimer = 0.7 + Math.random() * 0.5;
      const t = Math.floor(Math.random() * 3);
      const spawnLeft = this.tierSpeeds[t] > 0;
      const x = spawnLeft ? -25 : width + 25;
      this.spawnBalloonAt(x, tierYs[t], t, theme.balloonPalette[Math.floor(Math.random() * theme.balloonPalette.length)]);
    }

    for (const b of this.balloons) {
      if (b.popped) continue;

      const speedTier = b.kind === 'speedy' ? 1.4 : 1.0;
      b.x += this.tierSpeeds[b.tier] * speedTier * speedMult * dt;
      b.bobPhase += 3.5 * dt;

      // Wrap around edges
      if (b.x > width + 40 && this.tierSpeeds[b.tier] > 0) {
        b.x = -30;
      } else if (b.x < -40 && this.tierSpeeds[b.tier] < 0) {
        b.x = width + 30;
      }
    }
  }

  private updateFlyingDarts(dt: number, isSuddenDeath: boolean): void {
    const mult = isSuddenDeath ? 2 : 1;

    for (let i = this.flyingDarts.length - 1; i >= 0; i--) {
      const dart = this.flyingDarts[i];
      if (!dart.alive) {
        this.flyingDarts.splice(i, 1);
        continue;
      }

      // Crosswind applies to normal darts (underdog players get wind compensation!)
      const ps = this.playerStates.get(dart.playerId);
      if (!dart.isPiercing && (!ps || !ps.isUnderdog)) {
        dart.vx += this.windForce * dt;
      }

      dart.x += dart.vx * dt;
      dart.y += dart.vy * dt;
      dart.angle = Math.atan2(dart.vy, dart.vx);

      if (dart.isPiercing && Math.random() < 0.4) {
        this.particles.emit(dart.x, dart.y, 2, '#FACC15');
      }

      // Check collision with balloons
      for (const b of this.balloons) {
        if (b.popped) continue;

        const bobY = b.y + Math.sin(b.bobPhase) * 6;
        const dist = Math.hypot(dart.x - b.x, dart.y - bobY);

        if (dist < b.radius + 6) {
          b.popped = true;
          dart.pierceRemaining--;
          if (dart.pierceRemaining <= 0) {
            dart.alive = false;
          }

          if (ps) {
            ps.poppedCount++;
            ps.combo++;
            ps.streakTimer = 4.0;
            ps.mood = 'triumph';

            const comboMult = ps.combo >= 3 ? 2.0 : ps.combo >= 2 ? 1.5 : 1.0;
            let earned = Math.round(b.points * mult * comboMult);
            if (dart.isPiercing) earned += 25 * mult;

            ps.score += earned;

            this.audio.playTone(640, 0.08, 'triangle');
            this.particles.emit(b.x, bobY, 18, b.color);
            this.particles.showFloatingText(`+${earned}`, b.x, bobY - 20, b.color, 20);

            // Explosive TNT Bomb triggers chain reaction!
            if (b.kind === 'bomb') {
              this.audio.playExplosion();
              this.particles.spawnConfetti(b.x, bobY, 25);
              this.triggerBombChainReaction(b.x, bobY, ps, mult);
            } else if (b.kind === 'golden') {
              this.audio.playScore();
              this.particles.showFloatingText('★ GOLDEN STAR! ★', b.x, bobY - 40, '#FACC15', 24);
            }
          }
          break;
        }
      }

      // Out of bounds check
      if (dart.y < -30 || dart.x < -30 || dart.x > this.lastCanvasWidth + 30) {
        dart.alive = false;
      }
    }
  }

  private triggerBombChainReaction(bombX: number, bombY: number, detonator: DartPlayerState, mult: number): void {
    const blastRadius = 90;
    for (const b of this.balloons) {
      if (b.popped) continue;
      const bobY = b.y + Math.sin(b.bobPhase) * 6;
      const dist = Math.hypot(bombX - b.x, bombY - bobY);

      if (dist < blastRadius) {
        b.popped = true;
        detonator.poppedCount++;
        const chainPoints = Math.round(b.points * 0.75 * mult);
        detonator.score += chainPoints;

        this.particles.emit(b.x, bobY, 12, b.color);
        this.particles.showFloatingText(`CHAIN! +${chainPoints}`, b.x, bobY - 20, '#F59E0B', 18);
      }
    }
  }

  private updatePlushies(dt: number, width: number, height: number): void {
    this.plushieSpawnTimer -= dt;
    if (this.plushieSpawnTimer <= 0) {
      this.spawnPlushie(width, height);
      this.plushieSpawnTimer = 2.4;
    }

    for (let i = this.plushies.length - 1; i >= 0; i--) {
      const plush = this.plushies[i];
      if (plush.collected) {
        this.plushies.splice(i, 1);
        continue;
      }

      plush.x += plush.vx * dt;
      plush.y += plush.vy * dt;

      // Bounce in boardwalk deck area
      if (plush.x < 50) { plush.x = 50; plush.vx = Math.abs(plush.vx); }
      if (plush.x > width - 50) { plush.x = width - 50; plush.vx = -Math.abs(plush.vx); }
      if (plush.y < height - 130) { plush.y = height - 130; plush.vy = Math.abs(plush.vy); }
      if (plush.y > height - 60) { plush.y = height - 60; plush.vy = -Math.abs(plush.vy); }

      // Check player collection
      for (const ps of this.playerStates.values()) {
        const dist = Math.hypot(ps.x - plush.x, ps.y - plush.y);
        const reach = (ps.isUnderdog ? 28 : 22) + plush.radius;

        if (dist < reach) {
          plush.collected = true;
          ps.score += plush.points;
          ps.mood = 'triumph';
          this.audio.playTone(840, 0.12, 'sine');
          this.particles.emit(plush.x, plush.y, 14, '#EC4899');
          this.particles.showFloatingText('PRIZE PLUSH! +80', plush.x, plush.y - 20, '#EC4899', 18);
          break;
        }
      }
    }
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const ps = this.playerStates.get(botId);
    if (!ps || ps.stunTimer > 0 || ps.staggerTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0);
      return;
    }

    let reactionTimer = this.botReactionTimers.get(botId) || 0;
    reactionTimer += dt;
    this.botReactionTimers.set(botId, reactionTimer);

    const lagThreshold = difficulty === 'bot_easy' ? 0.42 : difficulty === 'bot_normal' ? 0.23 : 0.10;
    if (reactionTimer < lagThreshold) return;
    this.botReactionTimers.set(botId, 0);

    const blunderChance = difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.08 : 0.0;
    const isBlundering = Math.random() < blunderChance;

    // Pick best balloon target
    let bestTarget: GalleryBalloon | null = null;
    let bestScore = -9999;

    for (const b of this.balloons) {
      if (b.popped) continue;
      const bobY = b.y + Math.sin(b.bobPhase) * 6;
      const dx = b.x - ps.x;
      const dy = bobY - ps.y;
      const dist = Math.hypot(dx, dy);

      let val = b.points;
      if (b.kind === 'bomb') val += 200; // High incentive to trigger explosions
      if (b.kind === 'golden') val += 150;

      const score = val - dist * 0.15;
      if (score > bestScore) {
        bestScore = score;
        bestTarget = b;
      }
    }

    if (!bestTarget || isBlundering) {
      this.input.setBotInput(botId, false, (Math.random() - 0.5) * 0.5, 0);
      return;
    }

    // Lead calculation based on conveyor speed and crosswind
    const bobY = bestTarget.y + Math.sin(bestTarget.bobPhase) * 6;
    let targetX = bestTarget.x;
    const distToTarget = Math.hypot(targetX - ps.x, bobY - ps.y);
    const flightTime = distToTarget / 700;

    if (difficulty !== 'bot_easy') {
      const speedTier = bestTarget.kind === 'speedy' ? 1.4 : 1.0;
      targetX += this.tierSpeeds[bestTarget.tier] * speedTier * flightTime;
      // Compensate for crosswind
      targetX -= this.windForce * flightTime * 0.5;
    }

    // Align horizontally with target on boardwalk deck
    let steerX = 0;
    let throttleY = 0;
    const diffX = targetX - ps.x;
    if (Math.abs(diffX) > 15) {
      steerX = diffX > 0 ? 0.7 : -0.7;
    }

    // Aim calculation
    const desiredAim = Math.atan2(bobY - ps.y, targetX - ps.x);
    const aimDiff = desiredAim - ps.aimAngle;
    if (Math.abs(aimDiff) > 0.08) {
      steerX += aimDiff > 0 ? 0.4 : -0.4;
    }

    // Hold-to-charge shot logic
    let shouldHoldAction = false;
    if (ps.cooldown <= 0) {
      if (!ps.isCharging) {
        shouldHoldAction = true;
      } else {
        const sweetTarget = ps.isUnderdog ? 0.75 : 0.85;
        if (ps.chargeTime >= sweetTarget) {
          shouldHoldAction = false; // Release sweet spot piercing dart!
        } else {
          shouldHoldAction = true;
        }
      }
    }

    this.input.setBotInput(botId, shouldHoldAction, Math.max(-1, Math.min(1, steerX)), -throttleY);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIdx];

    // Background Carnival Gallery Wall
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgTop);
    bgGrad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Awning Pennants
    this.renderAwnings(ctx, width, theme);

    // 3 Conveyor Tiers & Balloons (2.5D)
    this.renderConveyorsAndBalloons(ctx, width, height, theme);

    // Prize Plushies
    this.renderPlushies(ctx);

    // Flying Darts
    this.renderDarts(ctx);

    // Sharpshooters on Boardwalk Deck
    this.renderPlayers(ctx, width, height, theme);

    // HUD and UI Layout
    this.renderHUD(ctx, width, height, theme);
  }

  private renderAwnings(ctx: CanvasRenderingContext2D, width: number, theme: VisualTheme): void {
    const pennantCount = 18;
    const pw = width / pennantCount;
    for (let i = 0; i < pennantCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? theme.awningA : theme.awningB;
      ctx.beginPath();
      ctx.moveTo(i * pw, 0);
      ctx.lineTo((i + 1) * pw, 0);
      ctx.lineTo((i + 0.5) * pw, 26);
      ctx.closePath();
      ctx.fill();
    }
  }

  private renderConveyorsAndBalloons(ctx: CanvasRenderingContext2D, width: number, height: number, theme: VisualTheme): void {
    const tierYs = [height * 0.22, height * 0.35, height * 0.48];

    // Draw Conveyor Rails
    tierYs.forEach((ty) => {
      ctx.fillStyle = theme.conveyorColor;
      ctx.fillRect(0, ty + 18, width, 8);
      ctx.strokeStyle = theme.rimColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0, ty + 18, width, 8);
    });

    // Draw Balloons
    for (const b of this.balloons) {
      if (b.popped) continue;

      const bobY = b.y + Math.sin(b.bobPhase) * 6;

      ctx.save();
      ctx.translate(b.x, bobY);

      // Balloon Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 20, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Balloon String
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, b.radius);
      ctx.lineTo(0, b.radius + 8);
      ctx.stroke();

      // Balloon Body
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Kind-specific decoration
      if (b.kind === 'bomb') {
        // TNT Fuse & Spark
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('💣', 0, 4);
      } else if (b.kind === 'golden') {
        // Golden Star
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('★', 0, 4);
      } else if (b.kind === 'speedy') {
        // Speedy Bolt
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⚡', 0, 4);
      }

      ctx.restore();
    }
  }

  private renderPlushies(ctx: CanvasRenderingContext2D): void {
    for (const p of this.plushies) {
      if (p.collected) continue;

      ctx.save();
      ctx.translate(p.x, p.y);

      // Plushie Teddy Bear Icon
      ctx.fillStyle = '#EC4899';
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#F472B6';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Ears
      ctx.beginPath();
      ctx.arc(-9, -10, 5, 0, Math.PI * 2);
      ctx.arc(9, -10, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('🧸', 0, 4);

      ctx.restore();
    }
  }

  private renderDarts(ctx: CanvasRenderingContext2D): void {
    for (const dart of this.flyingDarts) {
      if (!dart.alive) continue;

      ctx.save();
      ctx.translate(dart.x, dart.y);
      ctx.rotate(dart.angle);

      if (dart.isPiercing) {
        ctx.shadowColor = '#FACC15';
        ctx.shadowBlur = 12;
      }

      // Dart Shaft
      ctx.strokeStyle = dart.color;
      ctx.lineWidth = dart.isPiercing ? 3.5 : 2.5;
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(8, 0);
      ctx.stroke();

      // Steel Tip
      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(6, -4);
      ctx.lineTo(6, 4);
      ctx.closePath();
      ctx.fill();

      // Feathers
      ctx.fillStyle = dart.color;
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(-20, -5);
      ctx.lineTo(-14, 0);
      ctx.lineTo(-20, 5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  private renderPlayers(ctx: CanvasRenderingContext2D, width: number, height: number, theme: VisualTheme): void {
    // Boardwalk Deck Floor
    ctx.save();
    ctx.fillStyle = theme.boardwalkFloor;
    ctx.fillRect(0, height - 145, width, 145);
    ctx.strokeStyle = theme.rimColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, height - 145);
    ctx.lineTo(width, height - 145);
    ctx.stroke();
    ctx.restore();

    const active = this.getActivePlayers();

    for (const p of active) {
      const ps = this.playerStates.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Aim Line (Laser Crosshair Guide)
      ctx.save();
      ctx.rotate(ps.aimAngle);
      ctx.strokeStyle = ps.isCharging ? (ps.chargeTime > 0.72 ? '#10B981' : '#F59E0B') : 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(60, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Charge Ring
      if (ps.isCharging) {
        const chargeRatio = Math.min(1.0, ps.chargeTime / 1.0);
        const sweetMin = ps.isUnderdog ? 0.50 : 0.72;
        const sweetMax = ps.isUnderdog ? 1.05 : 0.98;
        const isSweet = ps.chargeTime >= sweetMin && ps.chargeTime <= sweetMax;

        ctx.strokeStyle = isSweet ? '#10B981' : ps.chargeTime > sweetMax ? '#EF4444' : '#F59E0B';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + chargeRatio * Math.PI * 2);
        ctx.stroke();
      }

      // Underdog Halo
      if (ps.isUnderdog) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Stagger / Stun visual
      if (ps.staggerTimer > 0 || ps.stunTimer > 0) {
        ctx.rotate(Math.sin(ps.animTimer * 20) * 0.2);
      }

      // Mascot Sharpshooter
      drawCharacter(ctx, 0, 0, 18, ps.id, ps.id !== 0, ps.mood, ps.animTimer);

      // Streak Combo Pill
      if (ps.combo >= 2) {
        const mult = ps.combo >= 3 ? '2.0x' : '1.5x';
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        ctx.roundRect(-24, -36, 48, 16, 4);
        ctx.fill();
        ctx.strokeStyle = theme.rimColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#FBBF24';
        ctx.textAlign = 'center';
        ctx.fillText(`${mult} COMBO`, 0, -24);
      }

      ctx.restore();
    }
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number, theme: VisualTheme): void {
    ctx.save();

    // Top Safe Zone reserved for global timer at y: 12-44
    // Header Minigame Badge at y: 56
    const badgeW = 280;
    const badgeH = 26;
    const badgeX = (width - badgeW) / 2;
    const badgeY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fill();
    ctx.strokeStyle = theme.rimColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillStyle = '#F8FAFC';
    ctx.textAlign = 'center';
    ctx.fillText('BALLOON DART GALLERY 🎈', width / 2, badgeY + 17);

    // Wind Meter HUD at y: 88
    const windW = 220;
    const windH = 24;
    const windX = (width - windW) / 2;
    const windY = 88;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(windX, windY, windW, windH, 5);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#38BDF8';
    ctx.textAlign = 'center';
    const windDir = this.windForce > 5 ? `WIND: ➔ ${(this.windForce).toFixed(0)} MPH` : this.windForce < -5 ? `WIND: ⬅ ${Math.abs(this.windForce).toFixed(0)} MPH` : 'WIND: CALM';
    ctx.fillText(windDir, width / 2, windY + 16);

    // Theme Pill at bottom-left x: 20, y: height - 44, w: 170, h: 32 with shortcut [T]
    const pillRect = {
      x: 20,
      y: height - 44,
      w: 170,
      h: 32
    };
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(pillRect.x, pillRect.y, pillRect.w, pillRect.h, 6);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#E2E8F0';
    ctx.textAlign = 'center';
    ctx.fillText(`[T] ${theme.name} ${theme.icon}`, pillRect.x + pillRect.w * 0.5, pillRect.y + 20);

    // Corner Player Score Cards at y: height - 128 (130x48px)
    const active = this.getActivePlayers();
    const cardW = 130;
    const cardH = 48;
    const cardY = height - 128;

    active.forEach((p, idx) => {
      const ps = this.playerStates.get(p.id);
      if (!ps) return;

      const cardX = 20 + idx * (cardW + 12);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 6);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Player Name
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillStyle = p.color;
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 10, cardY + 18);

      // Score
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(`${ps.score} pts`, cardX + 10, cardY + 38);

      // Underdog badge on card
      if (ps.isUnderdog) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('⚡SURGE', cardX + cardW - 8, cardY + 18);
      }
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const rankings = active
      .map((p) => {
        const ps = this.playerStates.get(p.id);
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

    let mvpHighlight = 'Carnival Sharpshooter Master!';
    if (winnerId !== null) {
      const ps = this.playerStates.get(winnerId);
      mvpHighlight = `${this.getPlayer(winnerId)?.name} popped ${ps?.poppedCount || 0} balloons & executed ${ps?.sabotageCount || 0} booth shunts!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public override destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownListener) {
        window.removeEventListener('keydown', this.keydownListener);
      }
      if (this.clickListener) {
        window.removeEventListener('click', this.clickListener);
      }
    }
    super.destroy();
  }
}
