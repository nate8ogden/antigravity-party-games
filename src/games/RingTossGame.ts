import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface BottleTarget {
  id: number;
  tier: number; // 0: Center Golden Decanter, 1: Mid Tray, 2: Outer Tray
  angle: number;
  dist: number;
  points: number;
  isGold: boolean;
  ringsAttached: number;
  claimedBy: PlayerId | null;
  color: string;
}

interface FlyingHoop {
  id: number;
  playerId: PlayerId;
  color: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  targetBottleId: number | null;
  progress: number;
  speed: number;
  scale: number;
  isSupercharged: boolean;
  alive: boolean;
}

interface PitchPlayer {
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
  ringersCount: number;
  combo: number;
  streakTimer: number;
  staggerTimer: number;
  stunTimer: number;
  sabotageCount: number;
  mood: CharacterMood;
  animTimer: number;
  isUnderdog: boolean;
}

interface FloatingToken {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'gold_token' | 'ring_pack';
  value: number;
  radius: number;
  pulsePhase: number;
  collected: boolean;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  woodFloor: string;
  rimColor: string;
  awningA: string;
  awningB: string;
  trayFill: string;
  bottleTiers: string[];
  hoopGlow: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Midway Carnival Gold',
    icon: '🎪',
    bgGradTop: '#3B1506',
    bgGradBottom: '#180702',
    woodFloor: '#78350F',
    rimColor: '#F59E0B',
    awningA: '#EF4444',
    awningB: '#FDE047',
    trayFill: 'rgba(120, 53, 15, 0.65)',
    bottleTiers: ['#FACC15', '#38BDF8', '#EC4899'],
    hoopGlow: '#F59E0B'
  },
  {
    name: 'Cyber Neon Arcade',
    icon: '⚡',
    bgGradTop: '#09132B',
    bgGradBottom: '#020617',
    woodFloor: '#0F172A',
    rimColor: '#06B6D4',
    awningA: '#00D4FF',
    awningB: '#EC4899',
    trayFill: 'rgba(6, 182, 212, 0.25)',
    bottleTiers: ['#FFD700', '#00F0FF', '#39FF14'],
    hoopGlow: '#00F0FF'
  },
  {
    name: 'Retro Vegas Twilight',
    icon: '🎰',
    bgGradTop: '#240B2B',
    bgGradBottom: '#0A020D',
    woodFloor: '#4C0519',
    rimColor: '#FB7185',
    awningA: '#E11D48',
    awningB: '#F59E0B',
    trayFill: 'rgba(244, 63, 94, 0.25)',
    bottleTiers: ['#FDE047', '#A855F7', '#10B981'],
    hoopGlow: '#FB7185'
  }
];

export class RingTossGame extends BaseGame {
  private bottles: BottleTarget[] = [];
  private flyingHoops: FlyingHoop[] = [];
  private playersState: Map<PlayerId, PitchPlayer> = new Map();
  private tokens: FloatingToken[] = [];
  private nextTokenId: number = 1;
  private tokenSpawnTimer: number = 2.0;

  private hoopCounter: number = 0;
  private trayAngles: number[] = [0, 0, 0];
  private traySpeeds: number[] = [0.4, -0.65, 0.85];
  private boothCenterX: number = 400;
  private boothCenterY: number = 230;

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
    this.flyingHoops = [];
    this.tokens = [];
    this.hoopCounter = 0;
    this.trayAngles = [0, 0, 0];
    this.tokenSpawnTimer = 1.5;

    this.boothCenterX = width / 2;
    this.boothCenterY = height * 0.36;

    this.initPlayers(width, height);
    this.initBottles();

    // Initial tokens
    this.spawnToken(width, height);
    this.spawnToken(width, height);
  }

  private initPlayers(width: number, height: number): void {
    this.playersState.clear();
    this.botReactionTimers.clear();
    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const px = spacing * (idx + 1);
      const py = height - 85;
      this.playersState.set(p.id, {
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
        ringersCount: 0,
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

  private initBottles(): void {
    this.bottles = [];
    let bId = 0;

    // Center Golden Champagne Decanter (Tier 0)
    this.bottles.push({
      id: ++bId,
      tier: 0,
      angle: 0,
      dist: 0,
      points: 300,
      isGold: true,
      ringsAttached: 0,
      claimedBy: null,
      color: '#FACC15'
    });

    // Mid Tray: 4 Sparkling Soda Bottles (Tier 1)
    for (let i = 0; i < 4; i++) {
      this.bottles.push({
        id: ++bId,
        tier: 1,
        angle: (i / 4) * Math.PI * 2,
        dist: 75,
        points: 150,
        isGold: i % 2 === 0,
        ringsAttached: 0,
        claimedBy: null,
        color: i % 2 === 0 ? '#FDE047' : '#38BDF8'
      });
    }

    // Outer Tray: 8 Neon Tonic Bottles (Tier 2)
    const outerColors = ['#EF4444', '#10B981', '#A855F7', '#EC4899', '#06B6D4', '#F59E0B', '#3B82F6', '#84CC16'];
    for (let i = 0; i < 8; i++) {
      this.bottles.push({
        id: ++bId,
        tier: 2,
        angle: (i / 8) * Math.PI * 2,
        dist: 140,
        points: 80,
        isGold: false,
        ringsAttached: 0,
        claimedBy: null,
        color: outerColors[i % outerColors.length]
      });
    }
  }

  private spawnToken(width: number, height: number): void {
    if (this.tokens.length >= 4) return;
    const isPack = Math.random() < 0.35;
    this.tokens.push({
      id: this.nextTokenId++,
      x: width * 0.2 + Math.random() * (width * 0.6),
      y: height - 120 + (Math.random() - 0.5) * 50,
      vx: (Math.random() - 0.5) * 25,
      vy: (Math.random() - 0.5) * 20,
      type: isPack ? 'ring_pack' : 'gold_token',
      value: isPack ? 60 : 25,
      radius: isPack ? 15 : 12,
      pulsePhase: Math.random() * Math.PI * 2,
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

    // Rotate Concentric Trays
    for (let t = 0; t < 3; t++) {
      this.trayAngles[t] += this.traySpeeds[t] * speedMult * dt;
    }

    // Update Underdog status (trailing by >= 35 points)
    let maxScore = -Infinity;
    for (const ps of this.playersState.values()) {
      if (ps.score > maxScore) maxScore = ps.score;
    }
    for (const ps of this.playersState.values()) {
      ps.isUnderdog = maxScore - ps.score >= 35 && maxScore > 20;
    }

    // Bot AI Decision cycle
    this.updateBots(dt, width, height);

    // Update Pitchers
    this.updatePitchers(dt, width, height, isSuddenDeath);

    // Pitcher-to-pitcher physical collision on the deck
    this.handlePitcherCollisions();

    // Update Flying Hoops in 3D parabolic perspective
    this.updateFlyingHoops(dt, isSuddenDeath);

    // Update Tokens
    this.updateTokens(dt, width, height);
  }

  private updatePitchers(dt: number, width: number, height: number, isSuddenDeath: boolean): void {
    const active = this.getActivePlayers();

    for (const p of active) {
      const ps = this.playersState.get(p.id);
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

      // 360° locomotion across carnival boardwalk deck
      const inputMag = Math.hypot(steerX, throttleY);
      if (inputMag > 0.1) {
        ps.vx += (steerX / inputMag) * moveSpeed * dt * 8.0;
        ps.vy += (throttleY / inputMag) * moveSpeed * dt * 8.0;
      }
      ps.vx *= Math.pow(0.04, dt);
      ps.vy *= Math.pow(0.04, dt);

      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Clamp to carnival boardwalk deck area
      const minX = 40;
      const maxX = width - 40;
      const minY = height - 140;
      const maxY = height - 55;

      if (ps.x < minX) { ps.x = minX; ps.vx = 0; }
      if (ps.x > maxX) { ps.x = maxX; ps.vx = 0; }
      if (ps.y < minY) { ps.y = minY; ps.vy = 0; }
      if (ps.y > maxY) { ps.y = maxY; ps.vy = 0; }

      // Aim angle is steered toward booth center by default, modified by steerX
      const baseAimAngle = Math.atan2(this.boothCenterY - ps.y, this.boothCenterX - ps.x);
      ps.aimAngle = baseAimAngle + steerX * 0.45;

      // Hold-to-Charge Pitch Power Sweet Spot (72%–98%)
      if (actionHeld && ps.cooldown <= 0) {
        ps.isCharging = true;
        ps.chargeTime += dt;
        ps.mood = 'focused';

        // Overcharge past 1.25s triggers Wild Overthrow!
        if (ps.chargeTime > 1.25) {
          ps.isCharging = false;
          ps.chargeTime = 0;
          ps.cooldown = 0.75;
          ps.staggerTimer = 0.75;
          ps.score = Math.max(0, ps.score - 5);
          ps.combo = 0;
          ps.mood = 'shocked';
          this.audio.playTone(180, 0.25, 'sawtooth');
          this.particles.emit(ps.x, ps.y, 16, '#EF4444');
          this.particles.showFloatingText('WILD OVERTHROW! -5', ps.x, ps.y - 35, '#EF4444', 18);
        }
      } else {
        if (ps.isCharging) {
          // Releasing charged pitch: check sweet spot!
          ps.isCharging = false;
          ps.cooldown = 0.35;

          const sweetMin = ps.isUnderdog ? 0.50 : 0.72;
          const sweetMax = ps.isUnderdog ? 1.05 : 0.98;
          const isSweet = ps.chargeTime >= sweetMin && ps.chargeTime <= sweetMax;

          // Find targeted bottle or calculate throw landing coordinates
          let targetBottle: BottleTarget | null = null;
          let bestAngleDiff = Infinity;

          for (const b of this.bottles) {
            const bAngle = b.angle + this.trayAngles[b.tier];
            const bx = this.boothCenterX + Math.cos(bAngle) * b.dist;
            const by = this.boothCenterY + Math.sin(bAngle) * b.dist;

            const angleToBottle = Math.atan2(by - ps.y, bx - ps.x);
            let diff = Math.abs(angleToBottle - ps.aimAngle);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;

            if (diff < bestAngleDiff && diff < 0.35) {
              bestAngleDiff = diff;
              targetBottle = b;
            }
          }

          let tx = ps.x + Math.cos(ps.aimAngle) * 240;
          let ty = ps.y + Math.sin(ps.aimAngle) * 240;

          if (isSweet && targetBottle) {
            // Supercharged guided hoop locks onto targeted bottle
            const bAngle = targetBottle.angle + this.trayAngles[targetBottle.tier];
            tx = this.boothCenterX + Math.cos(bAngle) * targetBottle.dist;
            ty = this.boothCenterY + Math.sin(bAngle) * targetBottle.dist;
          }

          this.flyingHoops.push({
            id: ++this.hoopCounter,
            playerId: p.id,
            color: p.color,
            startX: ps.x,
            startY: ps.y - 12,
            x: ps.x,
            y: ps.y - 12,
            targetX: tx,
            targetY: ty,
            targetBottleId: targetBottle ? targetBottle.id : null,
            progress: 0,
            speed: isSweet ? 2.3 : 1.8,
            scale: 1.0,
            isSupercharged: isSweet,
            alive: true
          });

          if (isSweet) {
            this.audio.playTone(740, 0.15, 'sine');
            this.audio.playTone(980, 0.12, 'triangle');
            this.particles.emit(ps.x, ps.y - 12, 18, '#FACC15');
            this.particles.showFloatingText('CRITICAL SWEET PITCH! ★', ps.x, ps.y - 40, '#FACC15', 20);
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

  private handlePitcherCollisions(): void {
    const list = Array.from(this.playersState.values());
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

              // Carnival Shunt Sabotage: if player was charging, bump disrupts aim!
              if (a.isCharging) {
                b.score += 30;
                b.sabotageCount++;
                b.mood = 'triumph';
                a.isCharging = false;
                a.chargeTime = 0;
                a.staggerTimer = 0.65;
                a.mood = 'shocked';
                this.audio.playTone(660, 0.14, 'square');
                this.particles.showFloatingText('CARNIVAL SHUNT! +30', b.x, b.y - 35, '#F59E0B', 18);
              } else if (b.isCharging) {
                a.score += 30;
                a.sabotageCount++;
                a.mood = 'triumph';
                b.isCharging = false;
                b.chargeTime = 0;
                b.staggerTimer = 0.65;
                b.mood = 'shocked';
                this.audio.playTone(660, 0.14, 'square');
                this.particles.showFloatingText('CARNIVAL SHUNT! +30', a.x, a.y - 35, '#F59E0B', 18);
              }
            }
          }
        }
      }
    }
  }

  private updateFlyingHoops(dt: number, isSuddenDeath: boolean): void {
    const theme = THEMES[this.currentThemeIdx];

    for (let i = this.flyingHoops.length - 1; i >= 0; i--) {
      const hoop = this.flyingHoops[i];
      if (!hoop.alive) {
        this.flyingHoops.splice(i, 1);
        continue;
      }

      hoop.progress += hoop.speed * dt;
      const t = hoop.progress;
      hoop.x = hoop.startX + (hoop.targetX - hoop.startX) * t;
      // Parabolic flight arc
      hoop.y = hoop.startY + (hoop.targetY - hoop.startY) * t - Math.sin(t * Math.PI) * 75;
      hoop.scale = 1.0 - t * 0.45; // Perspective scaling

      if (hoop.isSupercharged && Math.random() < 0.4) {
        this.particles.emit(hoop.x, hoop.y, 2, theme.hoopGlow);
      }

      // Landing check
      if (t >= 1.0) {
        hoop.alive = false;
        let ringer = false;

        for (const b of this.bottles) {
          const bAngle = b.angle + this.trayAngles[b.tier];
          const bx = this.boothCenterX + Math.cos(bAngle) * b.dist;
          const by = this.boothCenterY + Math.sin(bAngle) * b.dist;

          const dist = Math.hypot(hoop.targetX - bx, hoop.targetY - by);
          const hitThreshold = hoop.isSupercharged ? 32 : 22;

          if (dist <= hitThreshold) {
            ringer = true;
            b.ringsAttached++;

            const ps = this.playersState.get(hoop.playerId);
            if (ps) {
              ps.ringersCount++;
              ps.combo++;
              ps.streakTimer = 4.0;
              ps.mood = 'triumph';

              const mult = isSuddenDeath ? 2 : 1;
              const comboMult = ps.combo >= 3 ? 2.0 : ps.combo >= 2 ? 1.5 : 1.0;
              let earned = Math.round(b.points * mult * comboMult);

              if (hoop.isSupercharged) {
                earned += 25 * mult; // Pitch Ace bonus
              }

              // Check Ring Cap Steal if bottle was claimed by another player
              if (b.claimedBy !== null && b.claimedBy !== hoop.playerId && hoop.isSupercharged) {
                earned += 40 * mult;
                ps.sabotageCount++;
                this.audio.playTone(850, 0.15, 'sawtooth');
                this.particles.showFloatingText('RING CAP STEAL! +40', bx, by - 48, '#EC4899', 22);
              }
              b.claimedBy = hoop.playerId;

              ps.score += earned;
              this.audio.playCoin();
              this.particles.spawnConfetti(bx, by, 16);

              const label = ps.combo >= 2 ? `RINGER! +${earned} (${comboMult}x)` : `RINGER! +${earned}`;
              this.particles.showFloatingText(label, bx, by - 24, b.color, 24);

              if (b.isGold) {
                this.audio.playScore();
                this.particles.showFloatingText('★ GOLDEN DECANTUR! ★', bx, by - 46, '#FACC15', 28);
              }
            }
            break;
          }
        }

        if (!ringer) {
          this.audio.playTap();
          const ps = this.playersState.get(hoop.playerId);
          if (ps) ps.combo = 0;
        }
      }
    }
  }

  private updateTokens(dt: number, width: number, height: number): void {
    this.tokenSpawnTimer -= dt;
    if (this.tokenSpawnTimer <= 0) {
      this.spawnToken(width, height);
      this.tokenSpawnTimer = 2.4;
    }

    for (let i = this.tokens.length - 1; i >= 0; i--) {
      const tok = this.tokens[i];
      if (tok.collected) {
        this.tokens.splice(i, 1);
        continue;
      }

      tok.pulsePhase += dt * 4.0;
      tok.x += tok.vx * dt;
      tok.y += tok.vy * dt;

      // Bounce in deck area
      if (tok.x < 50) { tok.x = 50; tok.vx = Math.abs(tok.vx); }
      if (tok.x > width - 50) { tok.x = width - 50; tok.vx = -Math.abs(tok.vx); }
      if (tok.y < height - 130) { tok.y = height - 130; tok.vy = Math.abs(tok.vy); }
      if (tok.y > height - 60) { tok.y = height - 60; tok.vy = -Math.abs(tok.vy); }

      // Check player collection
      for (const ps of this.playersState.values()) {
        const dist = Math.hypot(ps.x - tok.x, ps.y - tok.y);
        const reach = (ps.isUnderdog ? 28 : 22) + tok.radius;

        if (dist < reach) {
          tok.collected = true;
          ps.score += tok.value;
          ps.mood = 'triumph';
          this.audio.playTone(tok.type === 'ring_pack' ? 880 : 640, 0.12, 'sine');
          this.particles.emit(tok.x, tok.y, 14, tok.type === 'ring_pack' ? '#38BDF8' : '#FACC15');
          this.particles.showFloatingText(`+${tok.value}`, tok.x, tok.y - 20, '#FACC15', 18);
          break;
        }
      }
    }
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const ps = this.playersState.get(botId);
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

    // Pick best bottle target
    let bestTarget: BottleTarget | null = null;
    let bestScore = -9999;

    for (const b of this.bottles) {
      const bAngle = b.angle + this.trayAngles[b.tier];
      const bx = this.boothCenterX + Math.cos(bAngle) * b.dist;
      const by = this.boothCenterY + Math.sin(bAngle) * b.dist;

      const dx = bx - ps.x;
      const dy = by - ps.y;
      const dist = Math.hypot(dx, dy);

      let val = b.points;
      if (b.isGold) val += 180;
      if (b.claimedBy !== null && b.claimedBy !== botId) val += 60; // Incentive to cap steal

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

    // Lead calculation on rotating tray
    const bAngle = bestTarget.angle + this.trayAngles[bestTarget.tier];
    let bx = this.boothCenterX + Math.cos(bAngle) * bestTarget.dist;
    let by = this.boothCenterY + Math.sin(bAngle) * bestTarget.dist;

    if (difficulty !== 'bot_easy') {
      const distToB = Math.hypot(bx - ps.x, by - ps.y);
      const flightTime = distToB / 420;
      const leadAngle = bAngle + this.traySpeeds[bestTarget.tier] * flightTime;
      bx = this.boothCenterX + Math.cos(leadAngle) * bestTarget.dist;
      by = this.boothCenterY + Math.sin(leadAngle) * bestTarget.dist;
    }

    // Move to align horizontally with optimal throwing line
    let steerX = 0;
    let throttleY = 0;
    const targetDeckX = bx;
    const diffX = targetDeckX - ps.x;

    if (Math.abs(diffX) > 15) {
      steerX = diffX > 0 ? 0.7 : -0.7;
    }

    // Aim calculation
    const desiredAim = Math.atan2(by - ps.y, bx - ps.x);
    const aimDiff = desiredAim - ps.aimAngle;
    if (Math.abs(aimDiff) > 0.08) {
      steerX += aimDiff > 0 ? 0.4 : -0.4;
    }

    // Hold-to-charge pitch logic
    let shouldHoldAction = false;
    if (ps.cooldown <= 0) {
      if (!ps.isCharging) {
        shouldHoldAction = true;
      } else {
        const sweetTarget = ps.isUnderdog ? 0.75 : 0.85;
        if (ps.chargeTime >= sweetTarget) {
          shouldHoldAction = false; // Release sweet spot!
        } else {
          shouldHoldAction = true;
        }
      }
    }

    // Bot input routing
    this.input.setBotInput(botId, shouldHoldAction, Math.max(-1, Math.min(1, steerX)), -throttleY);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIdx];

    // Carnival Booth Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Awning Pennants
    this.renderAwnings(ctx, width, theme);

    // Multilevel Concentric Trays & Glass Bottles (2.5D)
    this.renderTraysAndBottles(ctx, theme);

    // Floating Bonus Tokens
    this.renderTokens(ctx);

    // Flying Hoops (3D Parabolic Perspective)
    this.renderHoops(ctx, theme);

    // Pitchers on the Boardwalk Deck
    this.renderPitchers(ctx, width, height, theme);

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

  private renderTraysAndBottles(ctx: CanvasRenderingContext2D, theme: VisualTheme): void {
    ctx.save();
    ctx.translate(this.boothCenterX, this.boothCenterY);

    // 3 Concentric Tray Discs with 2.5D depth
    const radii = [36, 95, 160];
    radii.forEach((r, idx) => {
      // Disc shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 8, r + 4, (r + 4) * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();

      // Disc surface
      ctx.fillStyle = theme.trayFill;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = idx === 0 ? '#FACC15' : theme.rimColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });

    ctx.restore();

    // Render Bottles in sorted Y order for true 2.5D depth
    const sortedBottles = [...this.bottles].sort((a, b) => {
      const aAngle = a.angle + this.trayAngles[a.tier];
      const bAngle = b.angle + this.trayAngles[b.tier];
      const ay = this.boothCenterY + Math.sin(aAngle) * (a.dist * 0.52);
      const by = this.boothCenterY + Math.sin(bAngle) * (b.dist * 0.52);
      return ay - by;
    });

    for (const b of sortedBottles) {
      const bAngle = b.angle + this.trayAngles[b.tier];
      const bx = this.boothCenterX + Math.cos(bAngle) * b.dist;
      const by = this.boothCenterY + Math.sin(bAngle) * (b.dist * 0.52);

      ctx.save();
      ctx.translate(bx, by);

      // Bottle Shadow
      ctx.fillStyle = 'rgba(2, 6, 23, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 10, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Bottle Body
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.roundRect(-7, -8, 14, 18, 4);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Bottle Neck
      ctx.fillStyle = b.color;
      ctx.fillRect(-3, -19, 6, 11);
      ctx.strokeRect(-3, -19, 6, 11);

      // Gold Decanter Star
      if (b.isGold) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('★', 0, 4);
      }

      // Claimed Banner if capped by a player
      if (b.claimedBy !== null) {
        const claimer = this.getPlayer(b.claimedBy);
        if (claimer) {
          ctx.fillStyle = claimer.color;
          ctx.beginPath();
          ctx.arc(0, -23, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Render Attached Rings stacked around bottle neck
      for (let k = 0; k < Math.min(4, b.ringsAttached); k++) {
        ctx.strokeStyle = '#F43F5E';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, -14 + k * 4, 9, 3.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private renderTokens(ctx: CanvasRenderingContext2D): void {
    for (const tok of this.tokens) {
      if (tok.collected) continue;

      ctx.save();
      ctx.translate(tok.x, tok.y);
      const pulse = 1.0 + Math.sin(tok.pulsePhase) * 0.12;
      ctx.scale(pulse, pulse);

      if (tok.type === 'ring_pack') {
        // Ring Pack (+60)
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.roundRect(-10, -10, 20, 20, 4);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⚡', 0, 4);
      } else {
        // Gold Token (+25)
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(0, 0, tok.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FDE68A';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#78350F';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('$', 0, 4);
      }

      ctx.restore();
    }
  }

  private renderHoops(ctx: CanvasRenderingContext2D, theme: VisualTheme): void {
    for (const hoop of this.flyingHoops) {
      if (!hoop.alive) continue;

      ctx.save();
      ctx.translate(hoop.x, hoop.y);
      ctx.scale(hoop.scale, hoop.scale * 0.65);

      if (hoop.isSupercharged) {
        ctx.shadowColor = theme.hoopGlow;
        ctx.shadowBlur = 14;
      }

      // Outer Glowing Ring
      ctx.strokeStyle = hoop.color;
      ctx.lineWidth = hoop.isSupercharged ? 5 : 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.stroke();

      // Inner Highlight Ring
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 13.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  private renderPitchers(ctx: CanvasRenderingContext2D, width: number, height: number, theme: VisualTheme): void {
    // Carnival Boardwalk Deck Floor
    ctx.save();
    ctx.fillStyle = theme.woodFloor;
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
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Aim Line (laser throwing guide)
      ctx.save();
      ctx.rotate(ps.aimAngle);
      ctx.strokeStyle = ps.isCharging ? (ps.chargeTime > 0.72 ? '#10B981' : '#F59E0B') : 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(55, 0);
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

      // Mascot Pitcher
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

    // Safe Top Zone reserved for global timer at y: 12-44
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
    ctx.fillText('NEON RING PITCH 🎪', width / 2, badgeY + 17);

    // Target Decanter HUD at y: 88
    const bannerW = 260;
    const bannerH = 28;
    const bannerX = (width - bannerW) / 2;
    const bannerY = 88;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 6);
    ctx.fill();
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#FDE047';
    ctx.textAlign = 'center';
    ctx.fillText('TARGET: GOLDEN DECANTER (300 PTS)', width / 2, bannerY + 18);

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
      const ps = this.playersState.get(p.id);
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

    let mvpHighlight = 'Carnival Hoop Master!';
    if (winnerId !== null) {
      const ps = this.playersState.get(winnerId);
      mvpHighlight = `${this.getPlayer(winnerId)?.name} scored ${ps?.ringersCount || 0} ringers & ${ps?.sabotageCount || 0} carnival shunts!`;
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
