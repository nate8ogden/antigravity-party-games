import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface Bandit {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  type: 'raider' | 'dynamiter' | 'boss';
  speed: number;
  angle: number;
  lootType: 'gold' | 'strongbox' | 'gem';
  animTimer: number;
}

interface LootDrop {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'gold' | 'strongbox' | 'gem';
  value: number;
  radius: number;
  pulsePhase: number;
}

interface DynamiteHazard {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuseTimer: number;
  radius: number;
}

interface OutlawRider {
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
  blastTimer: number;
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  gallopPhase: number;
  sabotageCount: number;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  trailColor: string;
  mesaColor: string;
  dustColor: string;
  coachWood: string;
  coachTrim: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Canyon Ambush Trail',
    icon: '🏜️',
    bgGradTop: '#C2410C',
    bgGradBottom: '#431407',
    trailColor: '#9A3412',
    mesaColor: '#7C2D12',
    dustColor: 'rgba(251, 146, 60, 0.4)',
    coachWood: '#571C0C',
    coachTrim: '#FBBF24'
  },
  {
    name: 'Moonlit Pine Pass',
    icon: '🌲',
    bgGradTop: '#1E1B4B',
    bgGradBottom: '#020617',
    trailColor: '#1E293B',
    mesaColor: '#0F172A',
    dustColor: 'rgba(148, 163, 184, 0.35)',
    coachWood: '#1E293B',
    coachTrim: '#38BDF8'
  },
  {
    name: 'Gold Gulch Creek',
    icon: '🌊',
    bgGradTop: '#0D9488',
    bgGradBottom: '#115E59',
    trailColor: '#134E4A',
    mesaColor: '#042F2E',
    dustColor: 'rgba(45, 212, 191, 0.4)',
    coachWood: '#713F12',
    coachTrim: '#FDE047'
  }
];

export class BanditChaseGame extends BaseGame {
  private riders: Map<PlayerId, OutlawRider> = new Map();
  private bandits: Bandit[] = [];
  private lootDrops: LootDrop[] = [];
  private dynamites: DynamiteHazard[] = [];
  private nextEntityId = 1;

  // Moving Stagecoach center
  private coachX = 400;
  private coachY = 300;
  private coachHp = 100;
  private coachWheelAngle = 0;
  private trailScroll = 0;

  private banditSpawnTimer = 0;
  private dynamiteSpawnTimer = 0;
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
    this.riders.clear();
    this.bandits = [];
    this.lootDrops = [];
    this.dynamites = [];
    this.coachHp = 100;
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.trailScroll = 0;
    this.coachWheelAngle = 0;
    this.announcementText = '';
    this.announcementTimer = 0;
    this.banditSpawnTimer = 0.6;
    this.dynamiteSpawnTimer = 2.5;
    this.botReactionTimers.clear();

    this.coachX = width / 2;
    this.coachY = height / 2 + 10;

    const active = this.getActivePlayers();
    const count = active.length;

    // Position players around the stagecoach
    const spawnOffsets = [
      { x: -90, y: -70 },
      { x: 90, y: -70 },
      { x: -90, y: 70 },
      { x: 90, y: 70 }
    ];

    for (let i = 0; i < count; i++) {
      const p = active[i];
      const offset = spawnOffsets[i % spawnOffsets.length];
      this.riders.set(p.id, {
        id: p.id,
        x: this.coachX + offset.x,
        y: this.coachY + offset.y,
        vx: 0,
        vy: 0,
        angle: Math.atan2(-offset.y, -offset.x),
        score: 0,
        chargeTime: 0,
        isCharging: false,
        overheatTimer: 0,
        blastTimer: 0,
        stunTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: 0,
        gallopPhase: i * 0.9,
        sabotageCount: 0
      });
      this.botReactionTimers.set(p.id, 0);
    }

    // Seed initial bandits approaching
    for (let i = 0; i < 4; i++) {
      this.spawnBandit(width, height);
    }
  }

  private spawnBandit(width: number, height: number): void {
    const isSuddenDeath = this.roundTimer <= 12.0;
    const side = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;
    const margin = 30;

    if (side === 0) { x = Math.random() * width; y = -margin; }
    else if (side === 1) { x = width + margin; y = Math.random() * height; }
    else if (side === 2) { x = Math.random() * width; y = height + margin; }
    else { x = -margin; y = Math.random() * height; }

    const roll = Math.random();
    let type: 'raider' | 'dynamiter' | 'boss' = 'raider';
    let hp = 1;
    let speed = 90 + Math.random() * 50;
    let lootType: 'gold' | 'strongbox' | 'gem' = 'gold';

    if (isSuddenDeath && roll < 0.25) {
      type = 'boss';
      hp = 3;
      speed = 120;
      lootType = 'gem';
    } else if (roll < 0.35) {
      type = 'dynamiter';
      hp = 1;
      speed = 100;
      lootType = 'strongbox';
    }

    const angle = Math.atan2(this.coachY - y, this.coachX - x);
    this.bandits.push({
      id: this.nextEntityId++,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      hp,
      maxHp: hp,
      type,
      speed,
      angle,
      lootType,
      animTimer: 0
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.roundTimer -= dt;
    if (this.roundTimer <= 0 || this.coachHp <= 0) {
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
    const roadSpeed = isSuddenDeath ? 320 : 220;
    this.trailScroll += roadSpeed * dt;
    this.coachWheelAngle += dt * 8;

    // Coach gentle bobbing
    this.coachY = height / 2 + 10 + Math.sin(this.trailScroll * 0.02) * 5;

    // Underdog metrics
    let maxScore = -1;
    this.riders.forEach(r => { if (r.score > maxScore) maxScore = r.score; });

    // 1. Spawner
    const banditInterval = isSuddenDeath ? 0.7 : 1.1;
    this.banditSpawnTimer -= dt;
    if (this.banditSpawnTimer <= 0) {
      this.banditSpawnTimer = banditInterval + Math.random() * 0.4;
      this.spawnBandit(width, height);
    }

    // 2. Update Riders
    const active = this.getActivePlayers();
    for (const p of active) {
      const rider = this.riders.get(p.id);
      if (!rider) continue;

      rider.animTimer += dt;
      rider.gallopPhase += dt * 11;

      if (rider.blastTimer > 0) {
        rider.blastTimer -= dt;
      }
      if (rider.streakTimer > 0) {
        rider.streakTimer -= dt;
        if (rider.streakTimer <= 0) {
          rider.streakCount = 0;
        }
      }

      // Stun recovery
      if (rider.stunTimer > 0) {
        rider.stunTimer -= dt;
        rider.vx *= 0.88;
        rider.vy *= 0.88;
        rider.x += rider.vx * dt;
        rider.y += rider.vy * dt;
        rider.mood = 'shocked';
        continue;
      }

      if (rider.overheatTimer > 0) {
        rider.overheatTimer -= dt;
      }

      const isUnderdog = maxScore - rider.score >= 35;

      // Inputs
      const steerX = this.input.getSteer(p.id);
      const throttleY = -this.input.getThrottle(p.id);
      const actionPressed = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      // Ride physics
      let maxSpeed = 230;
      let accel = 700;
      if (isUnderdog) {
        maxSpeed *= 1.25;
        accel *= 1.25;
      }

      if (steerX !== 0 || throttleY !== 0) {
        rider.vx += steerX * accel * dt;
        rider.vy += throttleY * accel * dt;
        rider.angle = Math.atan2(throttleY, steerX);
      } else {
        rider.vx *= 0.90;
        rider.vy *= 0.90;
      }

      const speed = Math.hypot(rider.vx, rider.vy);
      if (speed > maxSpeed) {
        rider.vx = (rider.vx / speed) * maxSpeed;
        rider.vy = (rider.vy / speed) * maxSpeed;
      }

      rider.x += rider.vx * dt;
      rider.y += rider.vy * dt;

      // Arena bounds
      const pad = 36;
      rider.x = Math.max(pad, Math.min(width - pad, rider.x));
      rider.y = Math.max(pad, Math.min(height - pad, rider.y));

      // Avoid clipping deep inside stagecoach body
      const coachDist = Math.hypot(rider.x - this.coachX, rider.y - this.coachY);
      if (coachDist < 46) {
        const pushAngle = Math.atan2(rider.y - this.coachY, rider.x - this.coachX);
        rider.x = this.coachX + Math.cos(pushAngle) * 46;
        rider.y = this.coachY + Math.sin(pushAngle) * 46;
        rider.vx += Math.cos(pushAngle) * 120;
        rider.vy += Math.sin(pushAngle) * 120;
      }

      // Hold-to-Charge Buckshot & Lasso Sweet Spot (72%–98%)
      if (rider.overheatTimer <= 0 && rider.stunTimer <= 0) {
        if (actionPressed) {
          rider.isCharging = true;
          rider.chargeTime += dt;
          rider.mood = 'focused';

          if (Math.random() < 0.35) {
            this.particles.emit(rider.x, rider.y, 2, '#FBBF24');
          }

          // Overheat misfire past 1.25s
          if (rider.chargeTime > 1.25) {
            rider.isCharging = false;
            rider.chargeTime = 0;
            rider.overheatTimer = 0.85;
            rider.stunTimer = 0.6;
            rider.mood = 'shocked';
            this.audio.playExplosion();
            this.particles.emit(rider.x, rider.y, 15, '#EF4444');
            this.triggerAnnouncement(`${p.name}'s Shotgun Misfired!`, 1.1);
          }
        } else if (!actionPressed && rider.isCharging) {
          rider.isCharging = false;
          const ratio = rider.chargeTime / 1.0;
          const sweetMin = isUnderdog ? 0.50 : 0.72;
          const sweetMax = isUnderdog ? 1.05 : 0.98;

          rider.blastTimer = 0.25;
          const aimAngle = rider.angle;

          if (ratio >= sweetMin && ratio <= sweetMax) {
            // TWIN-BARREL CONCUSSION BLAST SWEET SPOT!
            rider.mood = 'triumph';
            rider.streakCount++;
            rider.streakTimer = 4.0;
            const streakMult = Math.min(3.0, 1.0 + (rider.streakCount - 1) * 0.5);
            const aceBonus = Math.floor(25 * streakMult * (isSuddenDeath ? 2 : 1));
            rider.score += aceBonus;

            this.screenShake = 11;
            this.audio.playFanfare();
            this.audio.playExplosion();

            // Fire wide blast cone
            this.fireBuckshotBlast(rider, aimAngle, true, isUnderdog, isSuddenDeath);
            this.triggerAnnouncement(`★ TWIN-BARREL ACE BLAST! +${aceBonus} ★`, 1.3);
          } else {
            // Standard single blast
            this.audio.playExplosion();
            this.fireBuckshotBlast(rider, aimAngle, false, isUnderdog, isSuddenDeath);
            rider.mood = 'idle';
          }
          rider.chargeTime = 0;
        }
      }

      if (!rider.isCharging && rider.stunTimer <= 0 && rider.blastTimer <= 0) {
        rider.mood = 'idle';
      }
    }

    // 3. Update Bandits
    for (let i = this.bandits.length - 1; i >= 0; i--) {
      const b = this.bandits[i];
      b.animTimer += dt;

      // Bandits steer towards stagecoach
      const targetAngle = Math.atan2(this.coachY - b.y, this.coachX - b.x);
      b.angle = targetAngle;
      b.vx = Math.cos(targetAngle) * b.speed;
      b.vy = Math.sin(targetAngle) * b.speed;

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Raider attacks stagecoach
      const distToCoach = Math.hypot(b.x - this.coachX, b.y - this.coachY);
      if (distToCoach < 44) {
        // Raid hit on coach!
        this.coachHp = Math.max(0, this.coachHp - (b.type === 'boss' ? 20 : 10));
        this.audio.playExplosion();
        this.screenShake = 9;
        this.particles.emit(this.coachX, this.coachY, 14, '#EF4444');
        this.triggerAnnouncement(`Stagecoach Ambushed! Coach HP: ${Math.ceil(this.coachHp)}%`, 0.9);
        this.bandits.splice(i, 1);
        continue;
      }

      // Dynamiters drop dynamite periodically
      if (b.type === 'dynamiter' && Math.random() < 0.015 && this.dynamites.length < 5) {
        this.dynamites.push({
          id: this.nextEntityId++,
          x: b.x,
          y: b.y,
          vx: (Math.random() - 0.5) * 60,
          vy: (Math.random() - 0.5) * 60,
          fuseTimer: 2.2,
          radius: 12
        });
        this.audio.playTap();
      }
    }

    // 4. Update Sizzling Dynamites
    for (let i = this.dynamites.length - 1; i >= 0; i--) {
      const dyn = this.dynamites[i];
      dyn.x += dyn.vx * dt;
      dyn.y += dyn.vy * dt;
      dyn.fuseTimer -= dt;

      // Sparks
      if (Math.random() < 0.4) {
        this.particles.emit(dyn.x, dyn.y - 6, 2, '#EF4444');
      }

      // Detonation
      if (dyn.fuseTimer <= 0) {
        this.audio.playExplosion();
        this.screenShake = 12;
        this.particles.emit(dyn.x, dyn.y, 22, '#F97316');
        this.particles.emit(dyn.x, dyn.y, 16, '#EF4444');

        // Check damage to riders & coach
        for (const p of active) {
          const rider = this.riders.get(p.id);
          if (!rider || rider.stunTimer > 0) continue;
          const dist = Math.hypot(rider.x - dyn.x, rider.y - dyn.y);
          if (dist < 55) {
            rider.stunTimer = 0.8;
            rider.score = Math.max(0, rider.score - 10);
            rider.vx = (rider.x - dyn.x) * 4;
            rider.vy = (rider.y - dyn.y) * 4;
            rider.mood = 'shocked';
          }
        }

        const coachDist = Math.hypot(this.coachX - dyn.x, this.coachY - dyn.y);
        if (coachDist < 60) {
          this.coachHp = Math.max(0, this.coachHp - 12);
        }

        this.dynamites.splice(i, 1);
      }
    }

    // 5. Update Loot Drops & Collection
    for (let i = this.lootDrops.length - 1; i >= 0; i--) {
      const loot = this.lootDrops[i];
      loot.x += loot.vx * dt;
      loot.y += loot.vy * dt;
      loot.vx *= 0.94;
      loot.vy *= 0.94;
      loot.pulsePhase += dt * 5;

      for (const p of active) {
        const rider = this.riders.get(p.id);
        if (!rider || rider.stunTimer > 0) continue;

        const isUnderdog = maxScore - rider.score >= 35;
        const grabRadius = isUnderdog ? loot.radius + 36 : loot.radius + 22;
        const dist = Math.hypot(rider.x - loot.x, rider.y - loot.y);

        if (dist < grabRadius) {
          // Loot collected!
          const mult = Math.min(3.0, 1.0 + rider.streakCount * 0.5);
          const pts = Math.floor(loot.value * mult * (isSuddenDeath ? 2 : 1));
          rider.score += pts;
          rider.streakCount++;
          rider.streakTimer = 4.0;
          rider.mood = 'triumph';

          this.audio.playScore();
          const col = loot.type === 'gem' ? '#A855F7' : loot.type === 'strongbox' ? '#38BDF8' : '#FBBF24';
          this.particles.emit(loot.x, loot.y, 16, col);
          this.triggerAnnouncement(`${p.name} Snatched ${loot.type.toUpperCase()}! +${pts}`, 0.9);

          this.lootDrops.splice(i, 1);
          break;
        }
      }
    }

    // 6. Elastic Saddle Bumper Shunts Between Riders
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const p1 = active[i];
        const p2 = active[j];
        const r1 = this.riders.get(p1.id);
        const r2 = this.riders.get(p2.id);
        if (!r1 || !r2) continue;

        const dx = r2.x - r1.x;
        const dy = r2.y - r1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 34;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;

          const r1Blasting = r1.blastTimer > 0;
          const r2Blasting = r2.blastTimer > 0;

          if (r1Blasting && !r2Blasting) {
            r2.stunTimer = 0.65;
            r2.score = Math.max(0, r2.score - 10);
            r2.vx = nx * 320;
            r2.vy = ny * 320;
            r2.mood = 'shocked';

            const pts = isSuddenDeath ? 60 : 30;
            r1.score += pts;
            r1.sabotageCount++;
            r1.mood = 'triumph';

            this.screenShake = 10;
            this.hitStopTimer = 0.04;
            this.audio.playBounce();
            this.particles.emit((r1.x + r2.x) / 2, (r1.y + r2.y) / 2, 18, '#F59E0B');
            this.triggerAnnouncement(`SADDLE RAM SHUNT! +${pts} Sabotage!`, 1.1);
          } else if (r2Blasting && !r1Blasting) {
            r1.stunTimer = 0.65;
            r1.score = Math.max(0, r1.score - 10);
            r1.vx = -nx * 320;
            r1.vy = -ny * 320;
            r1.mood = 'shocked';

            const pts = isSuddenDeath ? 60 : 30;
            r2.score += pts;
            r2.sabotageCount++;
            r2.mood = 'triumph';

            this.screenShake = 10;
            this.hitStopTimer = 0.04;
            this.audio.playBounce();
            this.particles.emit((r1.x + r2.x) / 2, (r1.y + r2.y) / 2, 18, '#F59E0B');
            this.triggerAnnouncement(`SADDLE RAM SHUNT! +${pts} Sabotage!`, 1.1);
          } else {
            const overlap = (minDist - dist) * 0.5;
            r1.x -= nx * overlap;
            r1.y -= ny * overlap;
            r2.x += nx * overlap;
            r2.y += ny * overlap;

            const kx = r1.vx - r2.vx;
            const ky = r1.vy - r2.vy;
            const p = 2 * (nx * kx + ny * ky) / 2;
            r1.vx -= p * nx * 0.8;
            r1.vy -= p * ny * 0.8;
            r2.vx += p * nx * 0.8;
            r2.vy += p * ny * 0.8;

            this.audio.playBounce();
            this.particles.emit((r1.x + r2.x) / 2, (r1.y + r2.y) / 2, 6, '#FBBF24');
          }
        }
      }
    }
  }

  private fireBuckshotBlast(rider: OutlawRider, aimAngle: number, isSuper: boolean, isUnderdog: boolean, isSuddenDeath: boolean): void {
    const range = isSuper ? 180 : 120;
    const coneAngle = isUnderdog ? Math.PI * 0.55 : Math.PI * 0.35;

    // Visual buckshot pellets & smoke
    const muzzleX = rider.x + Math.cos(aimAngle) * 20;
    const muzzleY = rider.y + Math.sin(aimAngle) * 20;
    this.particles.emit(muzzleX, muzzleY, isSuper ? 24 : 14, '#FDE047');
    this.particles.emit(muzzleX, muzzleY, 8, '#94A3B8');

    for (let i = this.bandits.length - 1; i >= 0; i--) {
      const b = this.bandits[i];
      const dx = b.x - rider.x;
      const dy = b.y - rider.y;
      const dist = Math.hypot(dx, dy);

      if (dist < range) {
        const bAngle = Math.atan2(dy, dx);
        let diff = Math.abs(bAngle - aimAngle);
        while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

        if (diff < coneAngle / 2) {
          // Hit bandit!
          b.hp -= isSuper ? 2 : 1;
          this.audio.playBounce();
          this.particles.emit(b.x, b.y, 14, '#F59E0B');

          if (b.hp <= 0) {
            // Defeated bandit drops loot!
            const dropVal = b.lootType === 'gem' ? 75 : b.lootType === 'strongbox' ? 45 : 20;
            this.lootDrops.push({
              id: this.nextEntityId++,
              x: b.x,
              y: b.y,
              vx: (Math.random() - 0.5) * 80,
              vy: (Math.random() - 0.5) * 80,
              type: b.lootType,
              value: dropVal,
              radius: b.lootType === 'gem' ? 16 : 14,
              pulsePhase: 0
            });

            rider.score += isSuddenDeath ? 30 : 15;
            rider.mood = 'triumph';
            this.particles.emit(b.x, b.y, 20, '#22C55E');
            this.bandits.splice(i, 1);
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
    const rider = this.riders.get(botId);
    if (!rider || rider.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) + dt;
    this.botReactionTimers.set(botId, timer);

    const reactionLimit = difficulty === 'bot_easy' ? 0.42 : difficulty === 'bot_normal' ? 0.23 : 0.10;
    if (timer < reactionLimit) {
      return;
    }
    this.botReactionTimers.set(botId, 0);

    // Easy blunder chance
    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
      return;
    }

    let targetX = width / 2;
    let targetY = height / 2;
    let wantAction = false;

    // Find nearest bandit
    let nearestBandit: Bandit | null = null;
    let minBanditDist = 300;
    for (const b of this.bandits) {
      const d = Math.hypot(b.x - rider.x, b.y - rider.y);
      if (d < minBanditDist) {
        minBanditDist = d;
        nearestBandit = b;
      }
    }

    // Find nearest dropped loot
    let nearestLoot: LootDrop | null = null;
    let minLootDist = 200;
    for (const loot of this.lootDrops) {
      const d = Math.hypot(loot.x - rider.x, loot.y - rider.y);
      if (d < minLootDist) {
        minLootDist = d;
        nearestLoot = loot;
      }
    }

    // Hard rival shunting
    let rivalToShunt: OutlawRider | null = null;
    if (difficulty === 'bot_hard') {
      let minRivalDist = 130;
      for (const [id, r] of this.riders.entries()) {
        if (id !== botId && r.stunTimer <= 0) {
          const d = Math.hypot(r.x - rider.x, r.y - rider.y);
          if (d < minRivalDist) {
            minRivalDist = d;
            rivalToShunt = r;
          }
        }
      }
    }

    if (nearestLoot) {
      targetX = nearestLoot.x;
      targetY = nearestLoot.y;
    } else if (rivalToShunt !== null && difficulty === 'bot_hard' && nearestBandit === null) {
      const targetRival: OutlawRider = rivalToShunt;
      targetX = targetRival.x;
      targetY = targetRival.y;
      if (rider.chargeTime >= 0.75 && rider.chargeTime <= 0.95) {
        wantAction = false; // Unleash concussion blast!
      } else {
        wantAction = true;
      }
    } else if (nearestBandit) {
      // Intercept bandit
      targetX = nearestBandit.x;
      targetY = nearestBandit.y;

      const aimDist = Math.hypot(nearestBandit.x - rider.x, nearestBandit.y - rider.y);
      if (aimDist < 140) {
        if (difficulty === 'bot_hard') {
          if (rider.chargeTime >= 0.75 && rider.chargeTime <= 0.95) {
            wantAction = false; // Perfect sweet-spot release!
          } else {
            wantAction = true;
          }
        } else if (difficulty === 'bot_normal') {
          wantAction = rider.chargeTime < 0.6;
        } else {
          wantAction = Math.random() < 0.4;
        }
      }
    } else {
      // Escort around coach
      targetX = this.coachX + Math.sin(Date.now() * 0.002 + rider.gallopPhase) * 80;
      targetY = this.coachY + Math.cos(Date.now() * 0.002 + rider.gallopPhase) * 70;
    }

    const dx = targetX - rider.x;
    const dy = targetY - rider.y;
    const dist = Math.hypot(dx, dy);
    const steerX = dist > 6 ? Math.max(-1, Math.min(1, dx / 40)) : 0;
    const throttleY = dist > 6 ? Math.max(-1, Math.min(1, dy / 40)) : 0;

    this.input.setBotInput(botId, wantAction, steerX, throttleY);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIndex];

    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Canyon Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Canyon Cliffs & Mesas
    ctx.fillStyle = theme.mesaColor;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.2);
    ctx.lineTo(width * 0.25, height * 0.12);
    ctx.lineTo(width * 0.55, height * 0.18);
    ctx.lineTo(width * 0.8, height * 0.10);
    ctx.lineTo(width, height * 0.22);
    ctx.lineTo(width, 0);
    ctx.lineTo(0, 0);
    ctx.fill();

    // 2. Parallax Dirt Trail
    ctx.fillStyle = theme.trailColor;
    ctx.fillRect(0, height * 0.15, width, height * 0.7);

    // Scrolling trail ruts
    ctx.strokeStyle = theme.dustColor;
    ctx.lineWidth = 4;
    const rutOffset = (this.trailScroll * 0.6) % 60;
    for (let x = -60; x < width + 60; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x + rutOffset, height * 0.2);
      ctx.lineTo(x + rutOffset + 30, height * 0.85);
      ctx.stroke();
    }

    // 3. Render Speeding Stagecoach
    ctx.save();
    ctx.translate(this.coachX, this.coachY);

    // Stagecoach Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 28, 48, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Carriage Body
    ctx.fillStyle = theme.coachWood;
    ctx.beginPath();
    ctx.roundRect(-38, -26, 76, 52, 8);
    ctx.fill();
    ctx.strokeStyle = theme.coachTrim;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Roof Luggage & Strongbox Rack
    ctx.fillStyle = '#78350F';
    ctx.fillRect(-28, -32, 56, 8);
    ctx.fillStyle = '#FBBF24';
    ctx.fillRect(-12, -38, 24, 8); // Gold strongbox on roof

    // Carriage Windows
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(-26, -14, 18, 18);
    ctx.fillRect(8, -14, 18, 18);
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 2;
    ctx.strokeRect(-26, -14, 18, 18);
    ctx.strokeRect(8, -14, 18, 18);

    // Rotating Spoked Carriage Wheels
    const wheelPositions = [
      { x: -36, y: -22 },
      { x: 36, y: -22 },
      { x: -36, y: 22 },
      { x: 36, y: 22 }
    ];

    for (const wp of wheelPositions) {
      ctx.save();
      ctx.translate(wp.x, wp.y);
      ctx.rotate(this.coachWheelAngle);

      ctx.strokeStyle = '#451A03';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 1.5;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Health Bar above Carriage
    const hpW = 70;
    const hpH = 6;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(-hpW / 2, -48, hpW, hpH);
    ctx.fillStyle = this.coachHp > 35 ? '#22C55E' : '#EF4444';
    ctx.fillRect(-hpW / 2, -48, hpW * (this.coachHp / 100), hpH);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(-hpW / 2, -48, hpW, hpH);

    ctx.restore();

    // 4. Render Loot Drops
    for (const loot of this.lootDrops) {
      ctx.save();
      ctx.translate(loot.x, loot.y);
      const bob = Math.sin(loot.pulsePhase) * 3;

      if (loot.type === 'gem') {
        ctx.fillStyle = '#C084FC';
        ctx.beginPath();
        ctx.moveTo(0, -loot.radius + bob);
        ctx.lineTo(loot.radius, bob);
        ctx.lineTo(0, loot.radius + bob);
        ctx.lineTo(-loot.radius, bob);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FAF5FF';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (loot.type === 'strongbox') {
        ctx.fillStyle = '#0284C7';
        ctx.fillRect(-loot.radius, -loot.radius * 0.7 + bob, loot.radius * 2, loot.radius * 1.4);
        ctx.strokeStyle = '#BAE6FD';
        ctx.lineWidth = 2;
        ctx.strokeRect(-loot.radius, -loot.radius * 0.7 + bob, loot.radius * 2, loot.radius * 1.4);
      } else {
        // Gold Satchel
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(0, bob, loot.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(0, bob, loot.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 5. Render Sizzling Dynamites
    for (const dyn of this.dynamites) {
      ctx.save();
      ctx.translate(dyn.x, dyn.y);
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(-10, -4, 20, 8);
      ctx.strokeStyle = '#450A0A';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-10, -4, 20, 8);

      // Sizzling Fuse
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(16, -6);
      ctx.stroke();

      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.arc(16, -6, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6. Render Bandits
    for (const b of this.bandits) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);

      // Bandit steed
      ctx.fillStyle = '#18181B';
      ctx.beginPath();
      ctx.roundRect(-12, -8, 24, 16, 6);
      ctx.fill();

      // Bandit Rider
      ctx.fillStyle = b.type === 'boss' ? '#7C3AED' : b.type === 'dynamiter' ? '#EA580C' : '#DC2626';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();

      // Bandana / Mask
      ctx.fillStyle = '#000000';
      ctx.fillRect(-2, -3, 8, 6);

      ctx.restore();
    }

    // 7. Render Player Riders
    const active = this.getActivePlayers();
    let maxScore = -1;
    this.riders.forEach(r => { if (r.score > maxScore) maxScore = r.score; });

    for (const p of active) {
      const rider = this.riders.get(p.id);
      if (!rider) continue;

      const isUnderdog = maxScore - rider.score >= 35;
      const isBot = p.type !== 'human';

      ctx.save();
      ctx.translate(rider.x, rider.y);

      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 10, 18, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      // Buckshot Blast Flash
      if (rider.blastTimer > 0) {
        ctx.save();
        ctx.rotate(rider.angle);
        ctx.fillStyle = 'rgba(254, 240, 138, 0.6)';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.arc(10, 0, 75, -Math.PI * 0.2, Math.PI * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Charge Ring & Sweet Spot
      if (rider.isCharging) {
        const ratio = Math.min(1.0, rider.chargeTime / 1.0);
        const sweetMin = isUnderdog ? 0.50 : 0.72;
        const sweetMax = isUnderdog ? 1.05 : 0.98;
        const inSweet = ratio >= sweetMin && ratio <= sweetMax;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(74, 222, 128, 0.45)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, 30, sweetMin * Math.PI * 2 - Math.PI / 2, sweetMax * Math.PI * 2 - Math.PI / 2);
        ctx.stroke();

        ctx.strokeStyle = inSweet ? '#22C55E' : '#EAB308';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 30, -Math.PI / 2, ratio * Math.PI * 2 - Math.PI / 2);
        ctx.stroke();

        if (inSweet) {
          ctx.fillStyle = '#4ADE80';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('BLAST!', 0, -38);
        }
      }

      // Galloping steed
      ctx.save();
      const gallopBob = Math.sin(rider.gallopPhase) * 3;
      ctx.fillStyle = '#92400E';
      ctx.beginPath();
      ctx.roundRect(-12, -7 + gallopBob, 24, 15, 6);
      ctx.fill();

      // Saddle
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(-6, -3 + gallopBob, 12, 10, 3);
      ctx.fill();

      // Mascot Outlaw Rider
      drawCharacter(
        ctx,
        0,
        -12 + gallopBob,
        13,
        p.id,
        isBot,
        rider.mood,
        rider.animTimer
      );
      ctx.restore();

      // Underdog Bounty Aura
      if (isUnderdog) {
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.7)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 34, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    }

    // 8. Strict UI Layout
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
      isSuddenDeath ? `⚡ AMBUSH: ${Math.ceil(this.roundTimer)}s ⚡` : `⏱️ ${Math.ceil(this.roundTimer)}s`,
      width / 2,
      timerBoxY + timerBoxH / 2
    );

    // Minigame Header Badge (y: 56, h: 28)
    const badgeW = 270;
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
    ctx.fillText('🐎 BANDIT CHASE • STAGECOACH ESCORT', width / 2, badgeY + badgeH / 2);

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
      const rider = this.riders.get(p.id);
      if (!rider) return;

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
      ctx.fillText(`${rider.score} pts`, cardX + 32, cardY + 34);

      if (rider.streakCount > 1) {
        ctx.fillStyle = '#4ADE80';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`x${(1 + (rider.streakCount - 1) * 0.5).toFixed(1)}`, cardX + cardW - 8, cardY + 34);
      }
      ctx.restore();
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.riders.entries()).map(([playerId, r]) => ({
      playerId,
      score: r.score
    }));
    scores.sort((a, b) => b.score - a.score);

    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null
        ? `${this.getPlayer(winnerId)?.name} defended the gold shipment like a legend with ${scores[0].score} pts!`
        : 'The outlaws raided the dusty stagecoach!'
    };
  }
}
