import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface PlungerShot {
  id: number;
  playerId: PlayerId;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  isSupercharged: boolean;
  radius: number;
  alive: boolean;
}

interface WaterDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
}

interface PoolLoot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'rubber_duck' | 'beach_ball' | 'water_badge';
  value: number;
  radius: number;
  bobPhase: number;
  collected: boolean;
}

interface DunkLever {
  id: number;
  x: number;
  y: number;
  hp: number; // 2 hits to trigger dunk trapdoor
  color: string;
  wobbleAngle: number;
}

interface DunkPlayerState {
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
  isDunked: boolean;
  dunkTimer: number; // Climbing out of water
  ladderProgress: number; // 0 to 1
  streakCount: number;
  streakTimer: number;
  staggerTimer: number;
  stunTimer: number;
  dunksInflicted: number;
  sabotageCount: number;
  mood: CharacterMood;
  animTimer: number;
  isUnderdog: boolean;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgTop: string;
  bgBottom: string;
  waterColor: string;
  deckColor: string;
  rimColor: string;
  awningA: string;
  awningB: string;
  plungerTint: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Boardwalk Carnival Pier',
    icon: '🎪',
    bgTop: '#1E1B4B',
    bgBottom: '#075985',
    waterColor: '#0284C7',
    deckColor: '#78350F',
    rimColor: '#F59E0B',
    awningA: '#EF4444',
    awningB: '#FDE047',
    plungerTint: '#EF4444'
  },
  {
    name: 'Neon Cyber Hydro-Lab',
    icon: '⚡',
    bgTop: '#081226',
    bgBottom: '#020617',
    waterColor: '#06B6D4',
    deckColor: '#0F172A',
    rimColor: '#00F0FF',
    awningA: '#00D4FF',
    awningB: '#EC4899',
    plungerTint: '#00F0FF'
  },
  {
    name: 'Tropical Lagoon Splash',
    icon: '🌴',
    bgTop: '#164E63',
    bgBottom: '#0E7490',
    waterColor: '#14B8A6',
    deckColor: '#92400E',
    rimColor: '#34D399',
    awningA: '#F43F5E',
    awningB: '#FACC15',
    plungerTint: '#FBBF24'
  }
];

export class DunkTankGame extends BaseGame {
  private playersState: Map<PlayerId, DunkPlayerState> = new Map();
  private shots: PlungerShot[] = [];
  private waterSplashes: WaterDrop[] = [];
  private poolLoot: PoolLoot[] = [];
  private levers: DunkLever[] = [];
  private shotCounter: number = 0;
  private nextLootId: number = 1;
  private lootSpawnTimer: number = 1.5;

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
    this.shots = [];
    this.waterSplashes = [];
    this.poolLoot = [];
    this.levers = [];
    this.botReactionTimers.clear();
    this.shotCounter = 0;
    this.lootSpawnTimer = 1.2;

    this.initPlayers(width, height);
    this.initLevers(width, height);

    // Initial pool loot items
    for (let i = 0; i < 4; i++) {
      this.spawnLoot(width, height);
    }
  }

  private initPlayers(width: number, height: number): void {
    this.playersState.clear();
    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = (width * 0.7) / (count + 1);

    active.forEach((p, idx) => {
      const px = width * 0.15 + spacing * (idx + 1);
      const py = height * 0.58; // On boardwalk deck
      this.playersState.set(p.id, {
        id: p.id,
        x: px,
        y: py,
        vx: 0,
        vy: 0,
        aimAngle: idx < count / 2 ? 0.2 : Math.PI - 0.2,
        chargeTime: 0,
        isCharging: false,
        cooldown: 0,
        score: 0,
        isDunked: false,
        dunkTimer: 0,
        ladderProgress: 1.0,
        streakCount: 0,
        streakTimer: 0,
        staggerTimer: 0,
        stunTimer: 0,
        dunksInflicted: 0,
        sabotageCount: 0,
        mood: 'idle',
        animTimer: 0,
        isUnderdog: false
      });
      this.botReactionTimers.set(p.id, 0);
    });
  }

  private initLevers(width: number, height: number): void {
    this.levers = [];
    const count = 4;
    const spacing = (width * 0.75) / (count + 1);
    const leverY = height * 0.32;

    for (let i = 0; i < count; i++) {
      this.levers.push({
        id: i + 1,
        x: width * 0.12 + spacing * (i + 1),
        y: leverY,
        hp: 2,
        color: i % 2 === 0 ? '#EF4444' : '#F59E0B',
        wobbleAngle: 0
      });
    }
  }

  private spawnLoot(width: number, height: number): void {
    if (this.poolLoot.length >= 6) return;
    const roll = Math.random();
    let type: 'rubber_duck' | 'beach_ball' | 'water_badge' = 'rubber_duck';
    let val = 45;
    let rad = 14;

    if (roll < 0.25) {
      type = 'water_badge';
      val = 75;
      rad = 16;
    } else if (roll < 0.55) {
      type = 'beach_ball';
      val = 50;
      rad = 15;
    }

    this.poolLoot.push({
      id: this.nextLootId++,
      x: width * 0.12 + Math.random() * (width * 0.76),
      y: height * 0.76 + (Math.random() - 0.5) * 50,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 15,
      type,
      value: val,
      radius: rad,
      bobPhase: Math.random() * Math.PI * 2,
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

    // Underdog check (trailing by >= 35 points)
    let maxScore = -Infinity;
    for (const ps of this.playersState.values()) {
      if (ps.score > maxScore) maxScore = ps.score;
    }
    for (const ps of this.playersState.values()) {
      ps.isUnderdog = maxScore - ps.score >= 35 && maxScore > 20;
    }

    // Bot AI decision cycle
    this.updateBots(dt, width, height);

    // Update Water Splash Particles
    this.updateWaterSplashes(dt, height);

    // Update Players
    this.updatePlayers(dt, width, height, isSuddenDeath);

    // Physical Boardwalk Player Collisions
    this.handlePlayerCollisions();

    // Update Plunger Shots
    this.updateShots(dt, width, height, isSuddenDeath);

    // Update Pool Loot
    this.updatePoolLoot(dt, width, height, isSuddenDeath);
  }

  private updateWaterSplashes(dt: number, height: number): void {
    for (let i = this.waterSplashes.length - 1; i >= 0; i--) {
      const drop = this.waterSplashes[i];
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      drop.vy += 520 * dt;
      drop.alpha -= 1.3 * dt;
      if (drop.alpha <= 0 || drop.y > height) {
        this.waterSplashes.splice(i, 1);
      }
    }
  }

  private updatePlayers(dt: number, width: number, height: number, isSuddenDeath: boolean): void {
    const active = this.getActivePlayers();

    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ps.animTimer += dt;
      if (ps.cooldown > 0) ps.cooldown -= dt;
      if (ps.streakTimer > 0) {
        ps.streakTimer -= dt;
        if (ps.streakTimer <= 0) ps.streakCount = 0;
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

      // Handle Dunked State: in the pool water scrambling up ladder!
      if (ps.isDunked) {
        ps.dunkTimer -= dt;
        const climbRate = ps.isUnderdog ? 0.8 : 0.45;
        const actionTap = this.input.justAction(p.id) || this.input.justPressed(p.id);

        if (actionTap) {
          ps.ladderProgress = Math.min(1.0, ps.ladderProgress + (ps.isUnderdog ? 0.55 : 0.32));
          this.audio.playTone(320, 0.08, 'sine');
          this.spawnSplashBurst(ps.x, ps.y, 8);
        } else {
          ps.ladderProgress = Math.min(1.0, ps.ladderProgress + climbRate * dt);
        }

        if (ps.ladderProgress >= 1.0 || ps.dunkTimer <= 0) {
          // Recovered back to the boardwalk deck!
          ps.isDunked = false;
          ps.ladderProgress = 1.0;
          ps.y = height * 0.58;
          ps.mood = 'idle';
          this.particles.showFloatingText('BACK ON DECK!', ps.x, ps.y - 40, '#38BDF8', 20);
        }
        continue;
      }

      // Read steer & throttle inputs
      const steerX = this.input.getSteer(p.id);
      const throttleY = -this.input.getThrottle(p.id);
      const actionHeld = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      const moveSpeed = ps.isUnderdog ? 220 : 170;

      // 360° locomotion on boardwalk bridge
      const inputMag = Math.hypot(steerX, throttleY);
      if (inputMag > 0.1) {
        ps.vx += (steerX / inputMag) * moveSpeed * dt * 8.0;
        ps.vy += (throttleY / inputMag) * moveSpeed * dt * 8.0;
        ps.aimAngle = Math.atan2(throttleY, steerX);
      }
      ps.vx *= Math.pow(0.04, dt);
      ps.vy *= Math.pow(0.04, dt);

      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Clamp to boardwalk deck
      const minX = 50;
      const maxX = width - 50;
      const minY = height * 0.48;
      const maxY = height * 0.68;

      if (ps.x < minX) { ps.x = minX; ps.vx = 0; }
      if (ps.x > maxX) { ps.x = maxX; ps.vx = 0; }
      if (ps.y < minY) { ps.y = minY; ps.vy = 0; }
      if (ps.y > maxY) {
        // Walked off boardwalk into water!
        this.triggerDunk(ps, null, isSuddenDeath);
      }

      // Hold-to-Charge Hydro-Plunger Blaster Sweet Spot (72%–98%)
      if (actionHeld && ps.cooldown <= 0) {
        ps.isCharging = true;
        ps.chargeTime += dt;
        ps.mood = 'focused';

        // Overcharge past 1.25s triggers Cannon Backfire Blowout!
        if (ps.chargeTime > 1.25) {
          ps.isCharging = false;
          ps.chargeTime = 0;
          ps.cooldown = 0.75;
          ps.staggerTimer = 0.75;
          ps.score = Math.max(0, ps.score - 5);
          ps.mood = 'shocked';
          this.audio.playTone(170, 0.25, 'sawtooth');
          this.spawnSplashBurst(ps.x, ps.y, 14);
          this.particles.showFloatingText('CANNON BLOWOUT! -5', ps.x, ps.y - 35, '#EF4444', 18);
        }
      } else {
        if (ps.isCharging) {
          // Releasing charged shot: check sweet spot!
          ps.isCharging = false;
          ps.cooldown = 0.32;

          const sweetMin = ps.isUnderdog ? 0.50 : 0.72;
          const sweetMax = ps.isUnderdog ? 1.05 : 0.98;
          const isSweet = ps.chargeTime >= sweetMin && ps.chargeTime <= sweetMax;

          const speed = isSweet ? 860 : 640;
          const vx = Math.cos(ps.aimAngle) * speed;
          const vy = Math.sin(ps.aimAngle) * speed;

          this.shots.push({
            id: ++this.shotCounter,
            playerId: p.id,
            color: p.color,
            x: ps.x + Math.cos(ps.aimAngle) * 28,
            y: ps.y + Math.sin(ps.aimAngle) * 28,
            vx,
            vy,
            angle: ps.aimAngle,
            isSupercharged: isSweet,
            radius: isSweet ? 12 : 9,
            alive: true
          });

          if (isSweet) {
            this.audio.playTone(740, 0.15, 'sine');
            this.audio.playTone(980, 0.12, 'triangle');
            this.spawnSplashBurst(ps.x, ps.y, 12);
            this.particles.showFloatingText('SUPERCHARGED TORPEDO! ★', ps.x, ps.y - 40, '#FACC15', 20);
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
    const list = Array.from(this.playersState.values());
    const rad = 20;

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.isDunked || b.isDunked) continue;

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

              // Boardwalk Shunt Sabotage: if player was charging shot, bump disrupts aim!
              if (a.isCharging) {
                b.score += 30;
                b.sabotageCount++;
                b.mood = 'triumph';
                a.isCharging = false;
                a.chargeTime = 0;
                a.staggerTimer = 0.65;
                a.mood = 'shocked';
                this.audio.playTone(660, 0.14, 'square');
                this.particles.showFloatingText('BOARDWALK SHUNT! +30', b.x, b.y - 35, '#F59E0B', 18);
              } else if (b.isCharging) {
                a.score += 30;
                a.sabotageCount++;
                a.mood = 'triumph';
                b.isCharging = false;
                b.chargeTime = 0;
                b.staggerTimer = 0.65;
                b.mood = 'shocked';
                this.audio.playTone(660, 0.14, 'square');
                this.particles.showFloatingText('BOARDWALK SHUNT! +30', a.x, a.y - 35, '#F59E0B', 18);
              }
            }
          }
        }
      }
    }
  }

  private triggerDunk(victim: DunkPlayerState, dunker: DunkPlayerState | null, isSuddenDeath: boolean): void {
    if (victim.isDunked) return;

    victim.isDunked = true;
    victim.dunkTimer = 3.0;
    victim.ladderProgress = 0;
    victim.y = this.lastCanvasHeight * 0.78; // Submerged in pool
    victim.vx = 0;
    victim.vy = 0;
    victim.mood = 'shocked';

    this.audio.playExplosion();
    this.spawnSplashBurst(victim.x, victim.y, 25);
    this.particles.showFloatingText('SPLASHDOWN DUNK!', victim.x, victim.y - 45, '#0284C7', 24);

    if (dunker) {
      const mult = isSuddenDeath ? 2 : 1;
      const earned = 40 * mult;
      dunker.score += earned;
      dunker.dunksInflicted++;
      dunker.sabotageCount++;
      dunker.streakCount++;
      dunker.streakTimer = 4.0;
      dunker.mood = 'triumph';
      this.particles.showFloatingText(`DUNK SABOTAGE! +${earned}`, dunker.x, dunker.y - 40, '#F59E0B', 22);
    }
  }

  private spawnSplashBurst(x: number, y: number, count: number): void {
    const theme = THEMES[this.currentThemeIdx];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 1.2) + Math.random() * (Math.PI * 0.6);
      const speed = 140 + Math.random() * 220;
      this.waterSplashes.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: theme.waterColor,
        alpha: 0.9
      });
    }
  }

  private updateShots(dt: number, width: number, height: number, isSuddenDeath: boolean): void {
    const mult = isSuddenDeath ? 2 : 1;

    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i];
      if (!shot.alive) {
        this.shots.splice(i, 1);
        continue;
      }

      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;

      // Check hit on Dunk Levers
      for (const lever of this.levers) {
        const dist = Math.hypot(shot.x - lever.x, shot.y - lever.y);
        if (dist < 26) {
          shot.alive = false;
          lever.hp--;
          lever.wobbleAngle = (Math.random() - 0.5) * 0.5;

          const shooter = this.playersState.get(shot.playerId);
          if (shooter) {
            shooter.score += 25 * mult;
            this.audio.playTone(600, 0.1, 'triangle');
            this.particles.showFloatingText(`LEVER HIT! +${25 * mult}`, lever.x, lever.y - 20, '#F59E0B', 18);

            // If lever triggered to 0, dunk the closest rival!
            if (lever.hp <= 0) {
              lever.hp = 2;
              let closestRival: DunkPlayerState | null = null;
              let bestRivalDist = Infinity;

              for (const r of this.playersState.values()) {
                if (r.id !== shot.playerId && !r.isDunked) {
                  const d = Math.hypot(r.x - lever.x, r.y - lever.y);
                  if (d < bestRivalDist) {
                    bestRivalDist = d;
                    closestRival = r;
                  }
                }
              }

              if (closestRival) {
                this.triggerDunk(closestRival, shooter, isSuddenDeath);
              }
            }
          }
          break;
        }
      }

      // Check hit on players directly (knockback)
      for (const p of this.getActivePlayers()) {
        if (p.id === shot.playerId) continue;
        const ps = this.playersState.get(p.id);
        if (!ps || ps.isDunked) continue;

        const dist = Math.hypot(shot.x - ps.x, shot.y - ps.y);
        if (dist < (ps.isUnderdog ? 20 : 24)) {
          shot.alive = false;
          const force = shot.isSupercharged ? 380 : 240;
          ps.vx += Math.cos(shot.angle) * force;
          ps.vy += Math.sin(shot.angle) * force;
          ps.stunTimer = 0.55;
          ps.mood = 'shocked';
          this.audio.playTone(320, 0.1, 'sawtooth');
          this.spawnSplashBurst(ps.x, ps.y, 10);

          const shooter = this.playersState.get(shot.playerId);
          if (shooter) {
            shooter.score += 15 * mult;
            shooter.streakCount++;
            shooter.streakTimer = 3.5;
            shooter.mood = 'triumph';
          }
          break;
        }
      }

      // Out of bounds check
      if (shot.x < -30 || shot.x > width + 30 || shot.y < -30 || shot.y > height + 30) {
        shot.alive = false;
      }
    }
  }

  private updatePoolLoot(dt: number, width: number, height: number, isSuddenDeath: boolean): void {
    this.lootSpawnTimer -= dt;
    if (this.lootSpawnTimer <= 0) {
      this.spawnLoot(width, height);
      this.lootSpawnTimer = isSuddenDeath ? 1.2 : 2.0;
    }

    const mult = isSuddenDeath ? 2 : 1;

    for (let i = this.poolLoot.length - 1; i >= 0; i--) {
      const loot = this.poolLoot[i];
      if (loot.collected) {
        this.poolLoot.splice(i, 1);
        continue;
      }

      loot.bobPhase += dt * 3.0;
      loot.x += loot.vx * dt;
      loot.y += loot.vy * dt;

      // Bounce in pool
      if (loot.x < 60) { loot.x = 60; loot.vx = Math.abs(loot.vx); }
      if (loot.x > width - 60) { loot.x = width - 60; loot.vx = -Math.abs(loot.vx); }
      if (loot.y < height * 0.70) { loot.y = height * 0.70; loot.vy = Math.abs(loot.vy); }
      if (loot.y > height * 0.88) { loot.y = height * 0.88; loot.vy = -Math.abs(loot.vy); }

      // Check player collection while submerged or near pool
      for (const ps of this.playersState.values()) {
        const dist = Math.hypot(ps.x - loot.x, ps.y - loot.y);
        const reach = (ps.isUnderdog ? 32 : 24) + loot.radius;

        if (dist < reach) {
          loot.collected = true;
          const streakMult = 1.0 + Math.min(ps.streakCount * 0.25, 1.5);
          const earned = Math.round(loot.value * mult * streakMult);

          ps.score += earned;
          ps.mood = 'triumph';
          this.audio.playTone(loot.type === 'water_badge' ? 920 : 700, 0.12, 'sine');
          this.particles.emit(loot.x, loot.y, 14, loot.type === 'water_badge' ? '#FACC15' : '#38BDF8');
          this.particles.showFloatingText(`+${earned}`, loot.x, loot.y - 20, '#FACC15', 18);
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

    // In pool: mash climb button
    if (ps.isDunked) {
      if (Math.random() < (difficulty === 'bot_hard' ? 0.75 : 0.45)) {
        this.input.setBotInput(botId, true, 0, 0);
      } else {
        this.input.setBotInput(botId, false, 0, 0);
      }
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

    // Target a rival player or Dunk Lever
    let targetX = width / 2;
    let targetY = height * 0.32;

    // Prefer Dunk Levers to trigger splashdowns
    let bestLever: DunkLever | null = null;
    let bestDist = Infinity;
    for (const lev of this.levers) {
      const d = Math.hypot(lev.x - ps.x, lev.y - ps.y);
      if (d < bestDist) {
        bestDist = d;
        bestLever = lev;
      }
    }

    if (bestLever && !isBlundering) {
      targetX = bestLever.x;
      targetY = bestLever.y;
    } else {
      // Target closest non-dunked rival
      for (const r of this.playersState.values()) {
        if (r.id !== botId && !r.isDunked) {
          targetX = r.x;
          targetY = r.y;
          break;
        }
      }
    }

    // Move to align with target
    let steerX = 0;
    let throttleY = 0;
    const diffX = targetX - ps.x;
    if (Math.abs(diffX) > 20) {
      steerX = diffX > 0 ? 0.7 : -0.7;
    }

    // Aim calculation
    const desiredAim = Math.atan2(targetY - ps.y, targetX - ps.x);
    ps.aimAngle = desiredAim;

    // Hold-to-charge shot logic
    let shouldHoldAction = false;
    if (ps.cooldown <= 0) {
      if (!ps.isCharging) {
        shouldHoldAction = true;
      } else {
        const sweetTarget = ps.isUnderdog ? 0.75 : 0.85;
        if (ps.chargeTime >= sweetTarget) {
          shouldHoldAction = false; // Release sweet spot torpedo!
        } else {
          shouldHoldAction = true;
        }
      }
    }

    this.input.setBotInput(botId, shouldHoldAction, Math.max(-1, Math.min(1, steerX)), -throttleY);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIdx];

    // Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgTop);
    bgGrad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Awning Pennants
    this.renderAwnings(ctx, width, theme);

    // Dunk Levers & Targets
    this.renderLevers(ctx, theme);

    // Giant Waterpark Splashdown Pool (2.5D)
    this.renderPool(ctx, width, height, theme);

    // Pool Collectibles
    this.renderPoolLoot(ctx);

    // Boardwalk Deck Bridge
    this.renderBoardwalkDeck(ctx, width, height, theme);

    // Water Splash Droplets
    this.renderWaterSplashes(ctx);

    // Plunger Shots
    this.renderShots(ctx, theme);

    // Prankster Players & Mascots
    this.renderPlayers(ctx, theme);

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

  private renderLevers(ctx: CanvasRenderingContext2D, theme: VisualTheme): void {
    for (const lev of this.levers) {
      ctx.save();
      ctx.translate(lev.x, lev.y);
      ctx.rotate(lev.wobbleAngle);

      // Support Pole
      ctx.fillStyle = '#475569';
      ctx.fillRect(-3, 0, 6, 40);

      // Bullseye Lever Target
      ctx.fillStyle = lev.color;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Inner Bullseye Ring
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();

      // Lever HP indicator dots
      for (let k = 0; k < lev.hp; k++) {
        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(-5 + k * 10, -24, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private renderPool(ctx: CanvasRenderingContext2D, width: number, height: number, theme: VisualTheme): void {
    const poolY = height * 0.68;
    const poolH = height - poolY;

    ctx.save();

    // Pool Water Surface Gradient
    const waterGrad = ctx.createLinearGradient(0, poolY, 0, height);
    waterGrad.addColorStop(0, theme.waterColor);
    waterGrad.addColorStop(1, '#0369A1');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, poolY, width, poolH);

    // Pool Top Shimmer Lip
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, poolY);
    ctx.lineTo(width, poolY);
    ctx.stroke();

    ctx.restore();
  }

  private renderBoardwalkDeck(ctx: CanvasRenderingContext2D, width: number, height: number, theme: VisualTheme): void {
    const deckY = height * 0.48;
    const deckH = height * 0.20;

    ctx.save();

    // Wooden Boardwalk Bridge
    ctx.fillStyle = theme.deckColor;
    ctx.fillRect(40, deckY, width - 80, deckH);
    ctx.strokeStyle = theme.rimColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(40, deckY, width - 80, deckH);

    // Planks detail
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = 2;
    for (let px = 60; px < width - 60; px += 35) {
      ctx.beginPath();
      ctx.moveTo(px, deckY);
      ctx.lineTo(px, deckY + deckH);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderPoolLoot(ctx: CanvasRenderingContext2D): void {
    for (const loot of this.poolLoot) {
      if (loot.collected) continue;

      const bobY = loot.y + Math.sin(loot.bobPhase) * 4;

      ctx.save();
      ctx.translate(loot.x, bobY);

      if (loot.type === 'rubber_duck') {
        // Yellow Rubber Ducky (+45)
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(0, 0, loot.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Orange Beak
        ctx.fillStyle = '#EA580C';
        ctx.fillRect(6, -2, 6, 4);
      } else if (loot.type === 'beach_ball') {
        // Striped Beach Ball (+50)
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(0, 0, loot.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#3B82F6';
        ctx.beginPath();
        ctx.arc(0, 0, loot.radius * 0.6, 0, Math.PI);
        ctx.fill();
      } else {
        // Golden Water Badge (+75)
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(0, 0, loot.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('★', 0, 4);
      }

      ctx.restore();
    }
  }

  private renderWaterSplashes(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const drop of this.waterSplashes) {
      ctx.fillStyle = drop.color;
      ctx.globalAlpha = drop.alpha;
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderShots(ctx: CanvasRenderingContext2D, theme: VisualTheme): void {
    for (const shot of this.shots) {
      if (!shot.alive) continue;

      ctx.save();
      ctx.translate(shot.x, shot.y);
      ctx.rotate(shot.angle);

      if (shot.isSupercharged) {
        ctx.shadowColor = theme.rimColor;
        ctx.shadowBlur = 12;
      }

      // Wooden Handle
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();

      // Rubber Suction Cup
      ctx.fillStyle = theme.plungerTint;
      ctx.beginPath();
      ctx.arc(10, 0, shot.radius, -Math.PI / 2, Math.PI / 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();
    }
  }

  private renderPlayers(ctx: CanvasRenderingContext2D, theme: VisualTheme): void {
    const active = this.getActivePlayers();

    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Aim Line (Laser Guide)
      if (!ps.isDunked) {
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
      }

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

      // Mascot Prankster
      drawCharacter(ctx, 0, 0, 18, ps.id, ps.id !== 0, ps.mood, ps.animTimer);

      // Ladder Climb Progress Pill if dunked in pool
      if (ps.isDunked) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        ctx.roundRect(-24, -36, 48, 16, 4);
        ctx.fill();
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#38BDF8';
        ctx.textAlign = 'center';
        ctx.fillText(`CLIMB ${(ps.ladderProgress * 100).toFixed(0)}%`, 0, -25);
      }

      // Streak Pill
      if (ps.streakCount >= 2 && !ps.isDunked) {
        const mult = (1.0 + Math.min(ps.streakCount * 0.25, 1.5)).toFixed(1);
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
        ctx.fillText(`${mult}x DUNK`, 0, -24);
      }

      ctx.restore();
    }
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number, theme: VisualTheme): void {
    ctx.save();

    // Top Safe Zone reserved for global timer at y: 12-44
    // Header Minigame Badge at y: 56
    const badgeW = 320;
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
    ctx.fillText('PLUNGER DUNK SPLASHDOWN 🎯💦', width / 2, badgeY + 17);

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

    let mvpHighlight = 'Carnival Dunk Tank Champion!';
    if (winnerId !== null) {
      const ps = this.playersState.get(winnerId);
      mvpHighlight = `${this.getPlayer(winnerId)?.name} plunged rivals into the drink with ${ps?.dunksInflicted || 0} dunks & ${ps?.sabotageCount || 0} boardwalk shunts!`;
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
