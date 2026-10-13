import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface SerpentEgg {
  id: number;
  x: number;
  y: number;
  type: 'golden_egg' | 'jeweled_fang' | 'opal_crown';
  value: number;
  radius: number;
  pulsePhase: number;
  collected: boolean;
}

interface BabyViper {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  length: number;
}

interface SnakeWrangler {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  chargeTime: number; // 0 to 1.3s
  isCharging: boolean;
  overheatTimer: number;
  lungeTimer: number;
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
  isLassoPinning: boolean;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  pitFloor: string;
  pitRim: string;
  snakeBody: string;
  snakeUnderbelly: string;
  venomColor: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Mojave Serpent Den',
    icon: '🏜️',
    bgGradTop: '#78350F',
    bgGradBottom: '#291205',
    pitFloor: '#92400E',
    pitRim: '#B45309',
    snakeBody: '#15803D',
    snakeUnderbelly: '#86EFAC',
    venomColor: '#22C55E'
  },
  {
    name: 'Obsidian Viper Crypt',
    icon: '🖤',
    bgGradTop: '#1E1B4B',
    bgGradBottom: '#020617',
    pitFloor: '#1E293B',
    pitRim: '#334155',
    snakeBody: '#4C1D95',
    snakeUnderbelly: '#C084FC',
    venomColor: '#A855F7'
  },
  {
    name: 'Sunset Canyon Nest',
    icon: '🌅',
    bgGradTop: '#991B1B',
    bgGradBottom: '#450A0A',
    pitFloor: '#B91C1C',
    pitRim: '#DC2626',
    snakeBody: '#166534',
    snakeUnderbelly: '#FBBF24',
    venomColor: '#EAB308'
  }
];

export class RattlesnakeReflexGame extends BaseGame {
  private wranglers: Map<PlayerId, SnakeWrangler> = new Map();
  private eggs: SerpentEgg[] = [];
  private babyVipers: BabyViper[] = [];
  private nextEntityId = 1;

  // Giant Center Viper Boss State
  private snakeX = 400;
  private snakeY = 300;
  private snakeTargetAngle = 0;
  private snakeHeadAngle = 0;
  private snakeState: 'coiling' | 'rattling' | 'striking' | 'pinned' = 'coiling';
  private snakeTimer = 2.0;
  private rattleIntensity = 0;
  private rattleToneTimer = 0;
  private strikeProgress = 0;
  private strikeTargetX = 400;
  private strikeTargetY = 300;
  private pinnedTimer = 0;

  private eggSpawnTimer = 0;
  private babySpawnTimer = 0;
  private currentThemeIndex = 0;
  private screenShake = 0;
  private hitStopTimer = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private announcementText = '';
  private announcementTimer = 0;

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
    this.wranglers.clear();
    this.eggs = [];
    this.babyVipers = [];
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.announcementText = '';
    this.announcementTimer = 0;
    this.eggSpawnTimer = 0.5;
    this.babySpawnTimer = 3.0;
    this.botReactionTimers.clear();

    this.snakeX = width / 2;
    this.snakeY = height / 2 + 10;
    this.snakeState = 'coiling';
    this.snakeTimer = 2.0;
    this.rattleIntensity = 0;
    this.strikeProgress = 0;
    this.pinnedTimer = 0;

    const active = this.getActivePlayers();
    const count = active.length;
    const pitRadius = Math.min(width, height) * 0.38;

    for (let i = 0; i < count; i++) {
      const p = active[i];
      const angle = (i * 2 * Math.PI) / count - Math.PI / 2;
      const spawnDist = pitRadius * 0.75;

      this.wranglers.set(p.id, {
        id: p.id,
        x: this.snakeX + Math.cos(angle) * spawnDist,
        y: this.snakeY + Math.sin(angle) * spawnDist,
        vx: 0,
        vy: 0,
        angle: angle + Math.PI,
        score: 0,
        chargeTime: 0,
        isCharging: false,
        overheatTimer: 0,
        lungeTimer: 0,
        stunTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: 0,
        sabotageCount: 0,
        isLassoPinning: false
      });
      this.botReactionTimers.set(p.id, 0);
    }

    // Seed initial eggs around snake nest
    for (let i = 0; i < 7; i++) {
      this.spawnEgg(width, height);
    }
  }

  private spawnEgg(width: number, height: number): void {
    const isSuddenDeath = this.roundTimer <= 12.0;
    const pitRadius = Math.min(width, height) * 0.38;
    const angle = Math.random() * Math.PI * 2;
    const dist = 65 + Math.random() * (pitRadius - 80);

    const roll = Math.random();
    let type: 'golden_egg' | 'jeweled_fang' | 'opal_crown' = 'golden_egg';
    let value = 20;
    let radius = 14;

    if (isSuddenDeath && roll < 0.25) {
      type = 'opal_crown';
      value = 75;
      radius = 18;
    } else if (roll < 0.45) {
      type = 'jeweled_fang';
      value = 45;
      radius = 16;
    }

    this.eggs.push({
      id: this.nextEntityId++,
      x: this.snakeX + Math.cos(angle) * dist,
      y: this.snakeY + Math.sin(angle) * dist,
      type,
      value,
      radius,
      pulsePhase: Math.random() * Math.PI * 2,
      collected: false
    });
  }

  private spawnBabyViper(): void {
    const angle = Math.random() * Math.PI * 2;
    const speed = 70 + Math.random() * 40;
    this.babyVipers.push({
      id: this.nextEntityId++,
      x: this.snakeX,
      y: this.snakeY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      length: 24 + Math.random() * 8
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
    }

    this.updateBots(dt, width, height);

    const isSuddenDeath = this.roundTimer <= 12.0;
    const pitRadius = Math.min(width, height) * 0.38;

    // Highest score for Underdog
    let maxScore = -1;
    this.wranglers.forEach(w => { if (w.score > maxScore) maxScore = w.score; });

    // 1. Spawner
    this.eggSpawnTimer -= dt;
    if (this.eggSpawnTimer <= 0 && this.eggs.length < 12) {
      this.eggSpawnTimer = (isSuddenDeath ? 0.7 : 1.2) + Math.random() * 0.4;
      this.spawnEgg(width, height);
    }

    if (isSuddenDeath) {
      this.babySpawnTimer -= dt;
      if (this.babySpawnTimer <= 0 && this.babyVipers.length < 6) {
        this.babySpawnTimer = 2.0;
        this.spawnBabyViper();
      }
    }

    // 2. Update Giant Rattlesnake Boss AI & Strike Lifecycle
    if (this.snakeState === 'pinned') {
      this.pinnedTimer -= dt;
      if (this.pinnedTimer <= 0) {
        this.snakeState = 'coiling';
        this.snakeTimer = 1.8;
      }
    } else if (this.snakeState === 'coiling') {
      this.snakeTimer -= dt;
      this.rattleIntensity = 0;
      // Head tracks closest wrangler
      let closestW: SnakeWrangler | null = null;
      let closestDist = Infinity;
      this.wranglers.forEach(w => {
        const d = Math.hypot(w.x - this.snakeX, w.y - this.snakeY);
        if (d < closestDist) {
          closestDist = d;
          closestW = w;
        }
      });

      if (closestW) {
        const targetAngle = Math.atan2((closestW as SnakeWrangler).y - this.snakeY, (closestW as SnakeWrangler).x - this.snakeX);
        this.snakeHeadAngle += (targetAngle - this.snakeHeadAngle) * 4 * dt;
      }

      if (this.snakeTimer <= 0) {
        // Transition to rattling warning phase!
        this.snakeState = 'rattling';
        this.snakeTimer = 1.4 + Math.random() * 0.8;
        this.rattleIntensity = 1.0;
      }
    } else if (this.snakeState === 'rattling') {
      this.snakeTimer -= dt;
      this.rattleToneTimer -= dt;
      if (this.rattleToneTimer <= 0) {
        this.rattleToneTimer = 0.08;
        this.audio.playTone(850, 0.03, 'sine');
      }

      // Vigorously track nearest target
      let targetWrangler: SnakeWrangler | null = null;
      let minDist = Infinity;
      this.wranglers.forEach(w => {
        const d = Math.hypot(w.x - this.snakeX, w.y - this.snakeY);
        if (d < minDist) {
          minDist = d;
          targetWrangler = w;
        }
      });

      if (targetWrangler) {
        const tw = targetWrangler as SnakeWrangler;
        this.strikeTargetX = tw.x;
        this.strikeTargetY = tw.y;
        this.snakeHeadAngle = Math.atan2(tw.y - this.snakeY, tw.x - this.snakeX);
      }

      if (this.snakeTimer <= 0) {
        // EXPLOSIVE VIPER LUNGE STRIKE!
        this.snakeState = 'striking';
        this.strikeProgress = 0;
        this.audio.playExplosion();
        this.screenShake = 12;
      }
    } else if (this.snakeState === 'striking') {
      this.strikeProgress += dt * 4.5; // fast forward lunge
      const lungeMaxDist = 160;
      const curLungeDist = Math.sin(Math.min(1.0, this.strikeProgress) * Math.PI) * lungeMaxDist;
      const headX = this.snakeX + Math.cos(this.snakeHeadAngle) * curLungeDist;
      const headY = this.snakeY + Math.sin(this.snakeHeadAngle) * curLungeDist;

      // Check bite collisions with wranglers
      const active = this.getActivePlayers();
      for (const p of active) {
        const w = this.wranglers.get(p.id);
        if (!w || w.stunTimer > 0) continue;

        const isUnderdog = maxScore - w.score >= 35;
        const dist = Math.hypot(w.x - headX, w.y - headY);

        if (dist < 34) {
          if (isUnderdog) {
            // Underdog venom immunity: shrugs off bite!
            this.audio.playBounce();
            this.particles.emit(w.x, w.y, 16, '#FBBF24');
          } else {
            // BITTEN!
            w.stunTimer = 1.1;
            w.score = Math.max(0, w.score - 15);
            w.vx = Math.cos(this.snakeHeadAngle) * 360;
            w.vy = Math.sin(this.snakeHeadAngle) * 360;
            w.mood = 'shocked';

            this.screenShake = 14;
            this.hitStopTimer = 0.05;
            this.audio.playExplosion();
            this.particles.emit(w.x, w.y, 22, '#EF4444');
            this.triggerAnnouncement(`⚡ ${p.name} WAS BITTEN BY THE VIPER! -15 ⚡`, 1.2);
          }
        }
      }

      if (this.strikeProgress >= 1.0) {
        this.snakeState = 'coiling';
        this.snakeTimer = 1.8;
      }
    }

    // 3. Update Baby Vipers
    for (let i = this.babyVipers.length - 1; i >= 0; i--) {
      const bv = this.babyVipers[i];
      bv.x += bv.vx * dt;
      bv.y += bv.vy * dt;

      // Pit boundary bounce
      const dFromCenter = Math.hypot(bv.x - this.snakeX, bv.y - this.snakeY);
      if (dFromCenter > pitRadius - 20) {
        bv.vx = -bv.vx;
        bv.vy = -bv.vy;
        bv.angle += Math.PI;
      }

      // Check contact with wranglers
      const active = this.getActivePlayers();
      for (const p of active) {
        const w = this.wranglers.get(p.id);
        if (!w || w.stunTimer > 0) continue;
        if (Math.hypot(w.x - bv.x, w.y - bv.y) < 24) {
          w.stunTimer = 0.5;
          w.score = Math.max(0, w.score - 5);
          w.mood = 'shocked';
          this.audio.playBounce();
          this.particles.emit(w.x, w.y, 8, '#EF4444');
        }
      }
    }

    // 4. Update Wranglers
    const active = this.getActivePlayers();
    for (const p of active) {
      const w = this.wranglers.get(p.id);
      if (!w) continue;

      w.animTimer += dt;

      if (w.lungeTimer > 0) {
        w.lungeTimer -= dt;
      }
      if (w.streakTimer > 0) {
        w.streakTimer -= dt;
        if (w.streakTimer <= 0) {
          w.streakCount = 0;
        }
      }

      // Stun
      if (w.stunTimer > 0) {
        w.stunTimer -= dt;
        w.vx *= 0.88;
        w.vy *= 0.88;
        w.x += w.vx * dt;
        w.y += w.vy * dt;
        w.mood = 'shocked';
        continue;
      }

      if (w.overheatTimer > 0) {
        w.overheatTimer -= dt;
      }

      const isUnderdog = maxScore - w.score >= 35;

      // Inputs
      const steerX = this.input.getSteer(p.id);
      const throttleY = -this.input.getThrottle(p.id);
      const actionPressed = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      // Movement
      let maxSpeed = 220;
      let accel = 700;
      if (isUnderdog) {
        maxSpeed *= 1.25;
        accel *= 1.25;
      }

      if (steerX !== 0 || throttleY !== 0) {
        w.vx += steerX * accel * dt;
        w.vy += throttleY * accel * dt;
        w.angle = Math.atan2(throttleY, steerX);
      } else {
        w.vx *= 0.90;
        w.vy *= 0.90;
      }

      const curSpeed = Math.hypot(w.vx, w.vy);
      if (curSpeed > maxSpeed) {
        w.vx = (w.vx / curSpeed) * maxSpeed;
        w.vy = (w.vy / curSpeed) * maxSpeed;
      }

      w.x += w.vx * dt;
      w.y += w.vy * dt;

      // Constrain inside pit
      const distFromCenter = Math.hypot(w.x - this.snakeX, w.y - this.snakeY);
      if (distFromCenter > pitRadius - 22) {
        const rimAngle = Math.atan2(w.y - this.snakeY, w.x - this.snakeX);
        w.x = this.snakeX + Math.cos(rimAngle) * (pitRadius - 22);
        w.y = this.snakeY + Math.sin(rimAngle) * (pitRadius - 22);
        w.vx *= -0.5;
        w.vy *= -0.5;
      }

      // Constrain outside center snake coil
      if (distFromCenter < 38) {
        const pushAngle = Math.atan2(w.y - this.snakeY, w.x - this.snakeX);
        w.x = this.snakeX + Math.cos(pushAngle) * 38;
        w.y = this.snakeY + Math.sin(pushAngle) * 38;
        w.vx += Math.cos(pushAngle) * 100;
        w.vy += Math.sin(pushAngle) * 100;
      }

      // Hold-to-Charge Lasso & Lunge Sweet Spot (72%–98%)
      if (w.overheatTimer <= 0 && w.stunTimer <= 0) {
        if (actionPressed) {
          w.isCharging = true;
          w.chargeTime += dt;
          w.mood = 'focused';

          if (Math.random() < 0.3) {
            this.particles.emit(w.x, w.y, 2, '#FDE047');
          }

          if (w.chargeTime > 1.25) {
            // Overheat trip
            w.isCharging = false;
            w.chargeTime = 0;
            w.overheatTimer = 0.85;
            w.stunTimer = 0.6;
            w.mood = 'shocked';
            this.audio.playBounce();
            this.particles.emit(w.x, w.y, 14, '#EF4444');
            this.triggerAnnouncement(`${p.name} Tripped in the Sand!`, 1.1);
          }
        } else if (!actionPressed && w.isCharging) {
          w.isCharging = false;
          const ratio = w.chargeTime / 1.0;
          const sweetMin = isUnderdog ? 0.50 : 0.72;
          const sweetMax = isUnderdog ? 1.05 : 0.98;

          w.lungeTimer = 0.35;

          if (ratio >= sweetMin && ratio <= sweetMax) {
            // ELECTRIC SERPENT-SNARE LUNGE SWEET SPOT!
            w.mood = 'triumph';
            w.streakCount++;
            w.streakTimer = 4.0;

            const streakMult = Math.min(3.0, 1.0 + (w.streakCount - 1) * 0.5);
            const aceBonus = Math.floor(25 * streakMult * (isSuddenDeath ? 2 : 1));
            w.score += aceBonus;

            this.screenShake = 10;
            this.audio.playFanfare();
            this.particles.emit(w.x, w.y, 20, '#F59E0B');

            // Check if lassoing giant viper head to pin it down!
            const distToSnake = Math.hypot(w.x - this.snakeX, w.y - this.snakeY);
            if (distToSnake < 130 && (this.snakeState === 'rattling' || this.snakeState === 'striking')) {
              this.snakeState = 'pinned';
              this.pinnedTimer = 2.0;
              w.score += isSuddenDeath ? 60 : 35;
              w.sabotageCount++;
              this.audio.playScore();
              this.particles.emit(this.snakeX, this.snakeY, 25, '#22C55E');
              this.triggerAnnouncement(`★ ${p.name} PINNED THE VIPER! +${isSuddenDeath ? 60 : 35} ★`, 1.4);
            } else {
              this.triggerAnnouncement(`★ LASSO LUNGE ACE! +${aceBonus} ★`, 1.2);
            }
          } else {
            // Standard grab
            this.audio.playTap();
            w.mood = 'idle';
          }
          w.chargeTime = 0;
        }
      }

      if (!w.isCharging && w.stunTimer <= 0 && w.lungeTimer <= 0) {
        w.mood = 'idle';
      }
    }

    // 5. Update Eggs & Snatching
    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const egg = this.eggs[i];
      egg.pulsePhase += dt * 4;

      for (const p of active) {
        const w = this.wranglers.get(p.id);
        if (!w || w.stunTimer > 0) continue;

        const isUnderdog = maxScore - w.score >= 35;
        const grabRadius = isUnderdog ? egg.radius + 36 : egg.radius + 20;
        const dist = Math.hypot(w.x - egg.x, w.y - egg.y);

        if (dist < grabRadius) {
          egg.collected = true;
          const mult = Math.min(3.0, 1.0 + w.streakCount * 0.5);
          const pts = Math.floor(egg.value * mult * (isSuddenDeath ? 2 : 1));
          w.score += pts;
          w.streakCount++;
          w.streakTimer = 4.0;
          w.mood = 'triumph';

          this.audio.playScore();
          const col = egg.type === 'opal_crown' ? '#C084FC' : egg.type === 'jeweled_fang' ? '#38BDF8' : '#FBBF24';
          this.particles.emit(egg.x, egg.y, 16, col);
          this.triggerAnnouncement(`${p.name} Snatched ${egg.type.replace('_', ' ').toUpperCase()}! +${pts}`, 0.9);
          break;
        }
      }

      if (egg.collected) {
        this.eggs.splice(i, 1);
      }
    }

    // 6. Elastic Wrangler Boot Shunts Between Players
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const p1 = active[i];
        const p2 = active[j];
        const w1 = this.wranglers.get(p1.id);
        const w2 = this.wranglers.get(p2.id);
        if (!w1 || !w2) continue;

        const dx = w2.x - w1.x;
        const dy = w2.y - w1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 34;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;

          const w1Lunge = w1.lungeTimer > 0;
          const w2Lunge = w2.lungeTimer > 0;

          if (w1Lunge && !w2Lunge) {
            // W1 shunts W2 into danger!
            w2.stunTimer = 0.7;
            w2.score = Math.max(0, w2.score - 10);
            w2.vx = nx * 340;
            w2.vy = ny * 340;
            w2.mood = 'shocked';

            const pts = isSuddenDeath ? 60 : 30;
            w1.score += pts;
            w1.sabotageCount++;
            w1.mood = 'triumph';

            this.screenShake = 11;
            this.hitStopTimer = 0.05;
            this.audio.playBounce();
            this.particles.emit((w1.x + w2.x) / 2, (w1.y + w2.y) / 2, 18, '#F59E0B');
            this.triggerAnnouncement(`WRANGLER BOOT SHUNT! +${pts} Sabotage!`, 1.2);
          } else if (w2Lunge && !w1Lunge) {
            w1.stunTimer = 0.7;
            w1.score = Math.max(0, w1.score - 10);
            w1.vx = -nx * 340;
            w1.vy = -ny * 340;
            w1.mood = 'shocked';

            const pts = isSuddenDeath ? 60 : 30;
            w2.score += pts;
            w2.sabotageCount++;
            w2.mood = 'triumph';

            this.screenShake = 11;
            this.hitStopTimer = 0.05;
            this.audio.playBounce();
            this.particles.emit((w1.x + w2.x) / 2, (w1.y + w2.y) / 2, 18, '#F59E0B');
            this.triggerAnnouncement(`WRANGLER BOOT SHUNT! +${pts} Sabotage!`, 1.2);
          } else {
            const overlap = (minDist - dist) * 0.5;
            w1.x -= nx * overlap;
            w1.y -= ny * overlap;
            w2.x += nx * overlap;
            w2.y += ny * overlap;

            const kx = w1.vx - w2.vx;
            const ky = w1.vy - w2.vy;
            const p = 2 * (nx * kx + ny * ky) / 2;
            w1.vx -= p * nx * 0.8;
            w1.vy -= p * ny * 0.8;
            w2.vx += p * nx * 0.8;
            w2.vy += p * ny * 0.8;

            this.audio.playBounce();
            this.particles.emit((w1.x + w2.x) / 2, (w1.y + w2.y) / 2, 6, '#FBBF24');
          }
        }
      }
    }
  }

  private triggerAnnouncement(text: string, duration: number = 1.0): void {
    this.announcementText = text;
    this.announcementTimer = duration;
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const w = this.wranglers.get(botId);
    if (!w || w.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) + dt;
    this.botReactionTimers.set(botId, timer);

    const reactionLimit = difficulty === 'bot_easy' ? 0.42 : difficulty === 'bot_normal' ? 0.23 : 0.10;
    if (timer < reactionLimit) {
      return;
    }
    this.botReactionTimers.set(botId, 0);

    // Blunder chance for Easy
    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
      return;
    }

    let targetX = this.snakeX;
    let targetY = this.snakeY;
    let wantAction = false;

    // Viper threat awareness: if snake is rattling/striking, back away or pin it!
    const distToSnake = Math.hypot(w.x - this.snakeX, w.y - this.snakeY);

    // Nearest egg
    let nearestEgg: SerpentEgg | null = null;
    let minEggDist = 260;
    for (const egg of this.eggs) {
      const d = Math.hypot(egg.x - w.x, egg.y - w.y);
      if (d < minEggDist) {
        minEggDist = d;
        nearestEgg = egg;
      }
    }

    // Hard rival shunting
    let rivalToShunt: SnakeWrangler | null = null;
    if (difficulty === 'bot_hard') {
      let minRivalDist = 120;
      for (const [id, r] of this.wranglers.entries()) {
        if (id !== botId && r.stunTimer <= 0) {
          const d = Math.hypot(r.x - w.x, r.y - w.y);
          if (d < minRivalDist) {
            minRivalDist = d;
            rivalToShunt = r;
          }
        }
      }
    }

    if (this.snakeState === 'rattling' || this.snakeState === 'striking') {
      if (difficulty === 'bot_hard' && distToSnake < 140) {
        // Hard tries to pin the viper!
        targetX = this.snakeX;
        targetY = this.snakeY;
        if (w.chargeTime >= 0.75 && w.chargeTime <= 0.95) {
          wantAction = false; // Launch lasso pin!
        } else {
          wantAction = true;
        }
      } else {
        // Back away from center!
        const awayAngle = Math.atan2(w.y - this.snakeY, w.x - this.snakeX);
        targetX = this.snakeX + Math.cos(awayAngle) * 200;
        targetY = this.snakeY + Math.sin(awayAngle) * 200;
      }
    } else if (rivalToShunt !== null && difficulty === 'bot_hard' && nearestEgg === null) {
      const targetRival: SnakeWrangler = rivalToShunt;
      targetX = targetRival.x;
      targetY = targetRival.y;
      if (w.chargeTime >= 0.76 && w.chargeTime <= 0.95) {
        wantAction = false;
      } else {
        wantAction = true;
      }
    } else if (nearestEgg) {
      targetX = nearestEgg.x;
      targetY = nearestEgg.y;
      if (minEggDist < 60) {
        wantAction = false;
      } else if (difficulty !== 'bot_easy') {
        wantAction = w.chargeTime < 0.8;
      }
    } else {
      // Circle pit
      targetX = this.snakeX + Math.sin(Date.now() * 0.002) * 120;
      targetY = this.snakeY + Math.cos(Date.now() * 0.002) * 120;
    }

    const dx = targetX - w.x;
    const dy = targetY - w.y;
    const dist = Math.hypot(dx, dy);
    const steerX = dist > 5 ? Math.max(-1, Math.min(1, dx / 40)) : 0;
    const throttleY = dist > 5 ? Math.max(-1, Math.min(1, dy / 40)) : 0;

    this.input.setBotInput(botId, wantAction, steerX, throttleY);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIndex];
    const pitRadius = Math.min(width, height) * 0.38;

    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Desert Cavern Floor
    const bgGrad = ctx.createRadialGradient(this.snakeX, this.snakeY, 40, this.snakeX, this.snakeY, Math.max(width, height));
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Circular Stone Serpent Pit
    ctx.fillStyle = theme.pitFloor;
    ctx.beginPath();
    ctx.arc(this.snakeX, this.snakeY, pitRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = theme.pitRim;
    ctx.lineWidth = 10;
    ctx.stroke();

    // Inner rim details
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(this.snakeX, this.snakeY, pitRadius - 6, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Render Eggs & Serpent Fangs
    for (const egg of this.eggs) {
      ctx.save();
      ctx.translate(egg.x, egg.y);
      const bob = Math.sin(egg.pulsePhase) * 3;

      if (egg.type === 'opal_crown') {
        // Opal Brood Crown
        ctx.fillStyle = '#C084FC';
        ctx.beginPath();
        ctx.arc(0, bob, egg.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FAF5FF';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#E9D5FF';
        ctx.fillRect(-6, bob - 12, 12, 6);
      } else if (egg.type === 'jeweled_fang') {
        // Jeweled Fang
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.moveTo(0, bob - egg.radius);
        ctx.lineTo(egg.radius * 0.7, bob + egg.radius);
        ctx.lineTo(-egg.radius * 0.7, bob + egg.radius);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#BAE6FD';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Golden Egg
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.ellipse(0, bob, egg.radius * 0.8, egg.radius, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Render Giant Rattlesnake Boss in Center
    ctx.save();
    ctx.translate(this.snakeX, this.snakeY);

    // Coiled body rings
    ctx.strokeStyle = theme.snakeBody;
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, Math.PI * 1.85);
    ctx.stroke();

    ctx.strokeStyle = theme.snakeUnderbelly;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0.4, Math.PI * 1.7);
    ctx.stroke();

    // Rattle Tail (animating violently when rattling)
    ctx.save();
    ctx.translate(-36, 12);
    if (this.rattleIntensity > 0) {
      ctx.rotate((Math.random() - 0.5) * 0.6);
    }
    ctx.fillStyle = '#D97706';
    for (let r = 0; r < 4; r++) {
      ctx.beginPath();
      ctx.ellipse(-r * 6, 0, 4, 6 - r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Viper Head & Strike Arc
    let curLungeDist = 0;
    if (this.snakeState === 'striking') {
      curLungeDist = Math.sin(Math.min(1.0, this.strikeProgress) * Math.PI) * 160;
    }

    const headX = Math.cos(this.snakeHeadAngle) * curLungeDist;
    const headY = Math.sin(this.snakeHeadAngle) * curLungeDist;

    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(this.snakeHeadAngle);

    // Viper Head Shape
    ctx.fillStyle = this.snakeState === 'striking' ? '#EF4444' : theme.snakeBody;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-8, -14);
    ctx.lineTo(-14, 0);
    ctx.lineTo(-8, 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fierce Yellow/Red Eyes
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(0, -7, 3, 0, Math.PI * 2);
    ctx.arc(0, 7, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, -8, 1, 3);
    ctx.fillRect(0, 6, 1, 3);

    // Forked Tongue when rattling or striking
    if (this.snakeState === 'rattling' || this.snakeState === 'striking') {
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(28, 0);
      ctx.lineTo(34, -4);
      ctx.moveTo(28, 0);
      ctx.lineTo(34, 4);
      ctx.stroke();
    }

    // Pinned Lasso visual
    if (this.snakeState === 'pinned') {
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
    ctx.restore();

    // 5. Render Baby Vipers
    for (const bv of this.babyVipers) {
      ctx.save();
      ctx.translate(bv.x, bv.y);
      ctx.rotate(bv.angle);

      ctx.strokeStyle = theme.snakeBody;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-bv.length, 0);
      ctx.quadraticCurveTo(-bv.length / 2, 6, 0, 0);
      ctx.stroke();

      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6. Render Wranglers
    const active = this.getActivePlayers();
    let maxScore = -1;
    this.wranglers.forEach(w => { if (w.score > maxScore) maxScore = w.score; });

    for (const p of active) {
      const w = this.wranglers.get(p.id);
      if (!w) continue;

      const isUnderdog = maxScore - w.score >= 35;
      const isBot = p.type !== 'human';

      ctx.save();
      ctx.translate(w.x, w.y);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 10, 16, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Lasso Charge Ring
      if (w.isCharging) {
        const ratio = Math.min(1.0, w.chargeTime / 1.0);
        const sweetMin = isUnderdog ? 0.50 : 0.72;
        const sweetMax = isUnderdog ? 1.05 : 0.98;
        const inSweet = ratio >= sweetMin && ratio <= sweetMax;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(74, 222, 128, 0.45)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, 28, sweetMin * Math.PI * 2 - Math.PI / 2, sweetMax * Math.PI * 2 - Math.PI / 2);
        ctx.stroke();

        ctx.strokeStyle = inSweet ? '#22C55E' : '#EAB308';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 28, -Math.PI / 2, ratio * Math.PI * 2 - Math.PI / 2);
        ctx.stroke();

        if (inSweet) {
          ctx.fillStyle = '#4ADE80';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('LASSO!', 0, -36);
        }
      }

      // Lasso whip visual when lunging
      if (w.lungeTimer > 0) {
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(Math.cos(w.angle) * 22, Math.sin(w.angle) * 22, 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Mascot Snake Wrangler
      drawCharacter(
        ctx,
        0,
        0,
        14,
        p.id,
        isBot,
        w.mood,
        w.animTimer
      );

      // Underdog Snake-Charmer Aura
      if (isUnderdog) {
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.7)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    }

    // 7. Strict UI Elements
    const isSuddenDeath = this.roundTimer <= 12.0;
    const timerBoxX = width / 2 - 80;
    const timerBoxY = 12;
    const timerBoxW = 160;
    const timerBoxH = 32;

    ctx.fillStyle = isSuddenDeath ? 'rgba(239, 68, 68, 0.85)' : 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.roundRect(timerBoxX, timerBoxY, timerBoxW, timerBoxH, 16);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#FCA5A5' : 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      isSuddenDeath ? `⚡ VENOM FRENZY: ${Math.ceil(this.roundTimer)}s ⚡` : `⏱️ ${Math.ceil(this.roundTimer)}s`,
      width / 2,
      timerBoxY + timerBoxH / 2
    );

    // Minigame Header Badge (y: 56, h: 28)
    const badgeW = 280;
    const badgeH = 28;
    const badgeX = width / 2 - badgeW / 2;
    const badgeY = 56;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#FDE047';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('🐍 RATTLESNAKE REFLEX • PIT WRANGLER', width / 2, badgeY + badgeH / 2);

    // Announcement Pill
    if (this.announcementTimer > 0 && this.announcementText) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.beginPath();
      ctx.roundRect(width / 2 - 180, 96, 360, 32, 8);
      ctx.fill();
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FDE047';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.announcementText, width / 2, 112);
      ctx.restore();
    }

    // Theme Pill (bottom-left x: 20, y: height - 44, w: 170, h: 32)
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name} [T]`, pillX + 12, pillY + pillH / 2);

    // Player Cards at Corners (y: height - 128, 130x48px)
    active.forEach((p, idx) => {
      const w = this.wranglers.get(p.id);
      if (!w) return;

      const cardW = 130;
      const cardH = 48;
      const isRight = idx % 2 === 1;
      const isTop = idx >= 2;
      const cardX = isRight ? width - cardW - 20 : 20;
      const cardY = isTop ? height - 128 - cardH - 10 : height - 128;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(cardX + 16, cardY + 24, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.name, cardX + 32, cardY + 16);

      ctx.fillStyle = '#FDE047';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${w.score} pts`, cardX + 32, cardY + 34);

      if (w.streakCount > 1) {
        ctx.fillStyle = '#4ADE80';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`x${(1 + (w.streakCount - 1) * 0.5).toFixed(1)}`, cardX + cardW - 8, cardY + 34);
      }
      ctx.restore();
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.wranglers.entries()).map(([playerId, w]) => ({
      playerId,
      score: w.score
    }));
    scores.sort((a, b) => b.score - a.score);

    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null
        ? `${this.getPlayer(winnerId)?.name} out-wrangled the serpent pit with ${scores[0].score} pts!`
        : 'The rattlesnakes claimed the desert pit!'
    };
  }
}
