import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface CactusHazard {
  id: number;
  x: number;
  y: number;
  radius: number;
  type: 'saguaro' | 'barrel' | 'prickly_pair';
  arms: number;
  height: number;
}

interface Tumbleweed {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  rotSpeed: number;
  kickedBy: PlayerId | null;
  lifetime: number;
}

interface DesertPickup {
  id: number;
  x: number;
  y: number;
  type: 'horseshoe' | 'stirrup' | 'blossom';
  value: number;
  radius: number;
  pulsePhase: number;
  collected: boolean;
}

interface GallopRacer {
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
  sprintTimer: number; // speed burst after dash
  jumpTimer: number; // airborne hurdle leap
  jumpHeight: number;
  stunTimer: number;
  spinTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  gallopPhase: number;
  sabotageCount: number;
  isSuperDashing: boolean;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  duneColor1: string;
  duneColor2: string;
  cactusColor: string;
  cactusHighlight: string;
  dustColor: string;
  mesaColor: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Sonora Desert Dunes',
    icon: '🏜️',
    bgGradTop: '#F59E0B',
    bgGradBottom: '#78350F',
    duneColor1: '#D97706',
    duneColor2: '#B45309',
    cactusColor: '#166534',
    cactusHighlight: '#22C55E',
    dustColor: 'rgba(251, 191, 36, 0.4)',
    mesaColor: '#9A3412'
  },
  {
    name: 'Red Rock Gulch',
    icon: '🔴',
    bgGradTop: '#EA580C',
    bgGradBottom: '#431407',
    duneColor1: '#C2410C',
    duneColor2: '#7C2D12',
    cactusColor: '#14532D',
    cactusHighlight: '#4ADE80',
    dustColor: 'rgba(249, 115, 22, 0.45)',
    mesaColor: '#7F1D1D'
  },
  {
    name: 'Moonlight Prairie',
    icon: '🌙',
    bgGradTop: '#1E1B4B',
    bgGradBottom: '#020617',
    duneColor1: '#312E81',
    duneColor2: '#1E1B4B',
    cactusColor: '#065F46',
    cactusHighlight: '#34D399',
    dustColor: 'rgba(167, 139, 250, 0.35)',
    mesaColor: '#0F172A'
  }
];

export class CactusSlalomGame extends BaseGame {
  private racers: Map<PlayerId, GallopRacer> = new Map();
  private cacti: CactusHazard[] = [];
  private tumbleweeds: Tumbleweed[] = [];
  private pickups: DesertPickup[] = [];
  private nextEntityId = 1;

  private cactusSpawnTimer = 0;
  private tumbleweedSpawnTimer = 0;
  private pickupSpawnTimer = 0;
  private scrollOffset = 0;

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
    this.racers.clear();
    this.cacti = [];
    this.tumbleweeds = [];
    this.pickups = [];
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.scrollOffset = 0;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.announcementText = '';
    this.announcementTimer = 0;
    this.cactusSpawnTimer = 0.5;
    this.tumbleweedSpawnTimer = 2.0;
    this.pickupSpawnTimer = 0.8;
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const startY = height * 0.72;

    for (let i = 0; i < count; i++) {
      const p = active[i];
      const laneSpacing = (width - 160) / Math.max(1, count - 1 || 1);
      const startX = count === 1 ? width / 2 : 80 + i * laneSpacing;

      this.racers.set(p.id, {
        id: p.id,
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        score: 0,
        chargeTime: 0,
        isCharging: false,
        overheatTimer: 0,
        sprintTimer: 0,
        jumpTimer: 0,
        jumpHeight: 0,
        stunTimer: 0,
        spinTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: 0,
        gallopPhase: i * 0.8,
        sabotageCount: 0,
        isSuperDashing: false
      });
      this.botReactionTimers.set(p.id, 0);
    }

    // Pre-seed some cacti and pickups up ahead
    for (let i = 0; i < 6; i++) {
      this.spawnCactus(width, height * 0.1 + i * 70);
      if (i % 2 === 0) {
        this.spawnPickup(width, height * 0.15 + i * 70);
      }
    }
  }

  private spawnCactus(width: number, yPos: number): void {
    const types: ('saguaro' | 'barrel' | 'prickly_pair')[] = ['saguaro', 'saguaro', 'barrel', 'prickly_pair'];
    const type = types[Math.floor(Math.random() * types.length)];
    const margin = 70;
    const x = margin + Math.random() * (width - margin * 2);
    const radius = type === 'saguaro' ? 22 : type === 'barrel' ? 18 : 20;
    const height = type === 'saguaro' ? 44 : 26;

    this.cacti.push({
      id: this.nextEntityId++,
      x,
      y: yPos,
      radius,
      type,
      arms: Math.floor(Math.random() * 3) + 1,
      height
    });
  }

  private spawnTumbleweed(width: number, yPos?: number): void {
    const y = yPos !== undefined ? yPos : 80 + Math.random() * 200;
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -30 : width + 30;
    const speed = 120 + Math.random() * 100;
    const vx = fromLeft ? speed : -speed;
    const vy = 30 + Math.random() * 40;

    this.tumbleweeds.push({
      id: this.nextEntityId++,
      x,
      y,
      vx,
      vy,
      radius: 18 + Math.random() * 8,
      rotation: 0,
      rotSpeed: (Math.random() * 4 + 3) * (fromLeft ? 1 : -1),
      kickedBy: null,
      lifetime: 9.0
    });
  }

  private spawnPickup(width: number, yPos: number): void {
    const roll = Math.random();
    let type: 'horseshoe' | 'stirrup' | 'blossom' = 'horseshoe';
    let value = 15;
    let radius = 14;

    if (roll < 0.20) {
      type = 'blossom';
      value = 70;
      radius = 18;
    } else if (roll < 0.55) {
      type = 'stirrup';
      value = 35;
      radius = 16;
    }

    const margin = 75;
    const x = margin + Math.random() * (width - margin * 2);

    this.pickups.push({
      id: this.nextEntityId++,
      x,
      y: yPos,
      type,
      value,
      radius,
      pulsePhase: Math.random() * Math.PI * 2,
      collected: false
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
    const scrollSpeed = isSuddenDeath ? 240 : 180;
    this.scrollOffset += scrollSpeed * dt;

    // Highest score for Underdog determination
    let maxScore = -1;
    let minScore = Infinity;
    this.racers.forEach(r => {
      if (r.score > maxScore) maxScore = r.score;
      if (r.score < minScore) minScore = r.score;
    });

    // 1. Update Spawners
    const cactusInterval = isSuddenDeath ? 0.65 : 0.95;
    this.cactusSpawnTimer -= dt;
    if (this.cactusSpawnTimer <= 0) {
      this.cactusSpawnTimer = cactusInterval + Math.random() * 0.3;
      this.spawnCactus(width, -40);
    }

    const tumbleInterval = isSuddenDeath ? 1.8 : 3.2;
    this.tumbleweedSpawnTimer -= dt;
    if (this.tumbleweedSpawnTimer <= 0) {
      this.tumbleweedSpawnTimer = tumbleInterval + Math.random() * 1.0;
      this.spawnTumbleweed(width);
    }

    const pickupInterval = isSuddenDeath ? 0.6 : 0.9;
    this.pickupSpawnTimer -= dt;
    if (this.pickupSpawnTimer <= 0) {
      this.pickupSpawnTimer = pickupInterval + Math.random() * 0.4;
      this.spawnPickup(width, -35);
    }

    // 2. Update Racers
    const active = this.getActivePlayers();
    for (const p of active) {
      const racer = this.racers.get(p.id);
      if (!racer) continue;

      racer.animTimer += dt;
      racer.gallopPhase += dt * (racer.isSuperDashing ? 18 : 10);

      // Streak decay
      if (racer.streakTimer > 0) {
        racer.streakTimer -= dt;
        if (racer.streakTimer <= 0) {
          racer.streakCount = 0;
        }
      }

      // Stun / spin
      if (racer.stunTimer > 0) {
        racer.stunTimer -= dt;
        racer.vx *= 0.88;
        racer.vy *= 0.88;
        racer.x += racer.vx * dt;
        racer.y += racer.vy * dt;
        racer.mood = 'shocked';
        continue;
      }

      // Recover overheat
      if (racer.overheatTimer > 0) {
        racer.overheatTimer -= dt;
      }

      // Hurdle Leap Timer
      if (racer.jumpTimer > 0) {
        racer.jumpTimer -= dt;
        const jumpProgress = Math.sin((1 - racer.jumpTimer / 1.1) * Math.PI);
        racer.jumpHeight = Math.max(0, jumpProgress * 36);
        if (racer.jumpTimer <= 0) {
          racer.jumpHeight = 0;
          racer.isSuperDashing = false;
        }
      } else {
        racer.jumpHeight = 0;
      }

      if (racer.sprintTimer > 0) {
        racer.sprintTimer -= dt;
        if (racer.sprintTimer <= 0 && racer.jumpTimer <= 0) {
          racer.isSuperDashing = false;
        }
      }

      // Underdog status
      const isUnderdog = maxScore - racer.score >= 35;

      // Controls
      const steerX = this.input.getSteer(p.id);
      const throttleY = -this.input.getThrottle(p.id);
      const actionPressed = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      // Base gallop movement physics
      let maxSpeed = 230;
      let accel = 750;
      if (racer.isSuperDashing) {
        maxSpeed = 360;
        accel = 1200;
      } else if (isUnderdog) {
        maxSpeed *= 1.25;
        accel *= 1.25;
      }

      if (steerX !== 0 || throttleY !== 0) {
        racer.vx += steerX * accel * dt;
        racer.vy += throttleY * accel * dt;
        racer.angle = Math.atan2(racer.vy, racer.vx);
      } else {
        racer.vx *= 0.88;
        racer.vy *= 0.88;
      }

      // Clamp speed
      const curSpeed = Math.hypot(racer.vx, racer.vy);
      if (curSpeed > maxSpeed) {
        racer.vx = (racer.vx / curSpeed) * maxSpeed;
        racer.vy = (racer.vy / curSpeed) * maxSpeed;
      }

      racer.x += racer.vx * dt;
      racer.y += racer.vy * dt;

      // Track boundaries
      const minX = 40;
      const maxX = width - 40;
      const minY = 90;
      const maxY = height - 80;

      if (racer.x < minX) { racer.x = minX; racer.vx = Math.abs(racer.vx) * 0.5; }
      if (racer.x > maxX) { racer.x = maxX; racer.vx = -Math.abs(racer.vx) * 0.5; }
      if (racer.y < minY) { racer.y = minY; racer.vy = Math.abs(racer.vy) * 0.5; }
      if (racer.y > maxY) { racer.y = maxY; racer.vy = -Math.abs(racer.vy) * 0.5; }

      // Spur Charge & Hurdle Leap Handling
      if (racer.overheatTimer <= 0 && racer.stunTimer <= 0) {
        if (actionPressed && racer.jumpTimer <= 0) {
          racer.isCharging = true;
          racer.chargeTime += dt;
          racer.mood = 'focused';

          // Emit spur dust
          if (Math.random() < 0.3) {
            this.particles.emit(racer.x, racer.y + 16, 2, '#FDE047');
          }

          // Overheat stumble past 1.25s
          if (racer.chargeTime > 1.25) {
            racer.isCharging = false;
            racer.chargeTime = 0;
            racer.overheatTimer = 0.85;
            racer.stunTimer = 0.6;
            racer.mood = 'shocked';
            this.audio.playBounce();
            this.particles.emit(racer.x, racer.y, 14, '#EF4444');
            this.triggerAnnouncement(`${p.name} Stumbled in the Sand!`, 1.2);
          }
        } else if (!actionPressed && racer.isCharging) {
          racer.isCharging = false;
          const ratio = racer.chargeTime / 1.0; // 0.72 - 0.98 is sweet spot
          const sweetMin = isUnderdog ? 0.50 : 0.72;
          const sweetMax = isUnderdog ? 1.05 : 0.98;

          if (ratio >= sweetMin && ratio <= sweetMax) {
            // GOLDEN HURDLE LEAP SWEET SPOT!
            racer.jumpTimer = 1.1;
            racer.sprintTimer = 1.3;
            racer.isSuperDashing = true;
            racer.mood = 'triumph';
            racer.streakCount++;
            racer.streakTimer = 4.0;
            const streakMult = Math.min(3.0, 1.0 + (racer.streakCount - 1) * 0.5);
            const leapBonus = Math.floor(25 * streakMult * (isSuddenDeath ? 2 : 1));
            racer.score += leapBonus;

            this.screenShake = 9;
            this.audio.playFanfare();
            this.particles.emit(racer.x, racer.y, 25, '#F59E0B');
            this.particles.emit(racer.x, racer.y, 20, '#FACC15');
            this.triggerAnnouncement(`★ STEEPLECHASE LEAP ACE! +${leapBonus} ★`, 1.3);
          } else {
            // Short hop
            racer.jumpTimer = 0.45;
            racer.sprintTimer = 0.5;
            racer.isSuperDashing = false;
            racer.mood = 'idle';
            this.audio.playTap();
            this.particles.emit(racer.x, racer.y, 8, '#D97706');
          }
          racer.chargeTime = 0;
        }
      }

      if (!racer.isCharging && racer.stunTimer <= 0 && racer.jumpTimer <= 0) {
        racer.mood = 'idle';
      }
    }

    // 3. Update Cacti Hazards & Collisions
    for (let i = this.cacti.length - 1; i >= 0; i--) {
      const c = this.cacti[i];
      c.y += scrollSpeed * dt;

      // Check collision with racers
      for (const p of active) {
        const racer = this.racers.get(p.id);
        if (!racer || racer.stunTimer > 0) continue;

        const dist = Math.hypot(racer.x - c.x, racer.y - c.y);
        const hitRadius = c.radius + 18;

        if (dist < hitRadius) {
          // If airborne high enough, clear over the cactus!
          if (racer.jumpHeight > 16) {
            // Hurdle clear bonus!
            if (racer.mood !== 'triumph') {
              racer.score += isSuddenDeath ? 30 : 15;
              racer.mood = 'triumph';
              this.audio.playScore();
              this.particles.emit(c.x, c.y, 10, '#22C55E');
            }
          } else {
            // Ground impact!
            const isUnderdog = maxScore - racer.score >= 35;
            if (isUnderdog) {
              // Underdog Iron Mustang hazard armor: pulverizes the cactus!
              this.audio.playBounce();
              this.particles.emit(c.x, c.y, 18, '#F59E0B');
              this.cacti.splice(i, 1);
              break;
            } else {
              // Spiked!
              racer.stunTimer = 0.85;
              racer.score = Math.max(0, racer.score - 10);
              racer.vx = (racer.x - c.x) * 4;
              racer.vy = (racer.y - c.y) * 4;
              racer.mood = 'shocked';
              this.screenShake = 8;
              this.hitStopTimer = 0.04;
              this.audio.playExplosion();
              this.particles.emit(racer.x, racer.y, 18, '#EF4444');
              this.triggerAnnouncement(`${p.name} Pricked by Saguaro! -10`, 1.0);
            }
          }
        }
      }

      if (c.y > height + 80) {
        this.cacti.splice(i, 1);
      }
    }

    // 4. Update Tumbleweeds & Dynamic Kicking
    for (let i = this.tumbleweeds.length - 1; i >= 0; i--) {
      const tw = this.tumbleweeds[i];
      tw.x += tw.vx * dt;
      tw.y += (tw.vy + scrollSpeed * 0.4) * dt;
      tw.rotation += tw.rotSpeed * dt;
      tw.lifetime -= dt;

      // Check collision with racers
      for (const p of active) {
        const racer = this.racers.get(p.id);
        if (!racer || racer.stunTimer > 0) continue;

        const dist = Math.hypot(racer.x - tw.x, racer.y - tw.y);
        if (dist < tw.radius + 18) {
          if (racer.jumpHeight > 14) {
            // Jumped over!
            continue;
          }

          // If racer is dashing or charging, KICK tumbleweed into rivals!
          if (racer.isSuperDashing || racer.isCharging) {
            tw.kickedBy = p.id;
            const kickAngle = racer.angle || -Math.PI / 2;
            tw.vx = Math.cos(kickAngle) * 380;
            tw.vy = Math.sin(kickAngle) * 380;
            tw.rotSpeed = 12 * Math.sign(tw.vx);
            this.audio.playBounce();
            this.particles.emit(tw.x, tw.y, 12, '#F59E0B');
            this.triggerAnnouncement(`${p.name} Kicked a Tumbleweed!`, 0.9);
          } else {
            // Hit by tumbleweed
            if (tw.kickedBy && tw.kickedBy !== p.id) {
              // Hit by rival's kicked weed!
              const kicker = this.getPlayer(tw.kickedBy);
              const kickerRacer = this.racers.get(tw.kickedBy);
              if (kickerRacer) {
                kickerRacer.score += isSuddenDeath ? 40 : 20;
                kickerRacer.sabotageCount++;
              }
              racer.stunTimer = 0.75;
              racer.score = Math.max(0, racer.score - 10);
              racer.vx = tw.vx * 0.6;
              racer.vy = tw.vy * 0.6;
              racer.mood = 'shocked';
              this.screenShake = 10;
              this.audio.playExplosion();
              this.particles.emit(racer.x, racer.y, 20, '#EF4444');
              this.triggerAnnouncement(`Tumbleweed Strike! +${isSuddenDeath ? 40 : 20} Sabotage!`, 1.2);
              tw.lifetime = 0;
            } else {
              // Gentle brush
              racer.vx += tw.vx * 0.3;
              racer.vy += tw.vy * 0.3;
              this.audio.playTap();
            }
          }
        }
      }

      if (tw.lifetime <= 0 || tw.y > height + 80 || tw.x < -100 || tw.x > width + 100) {
        this.tumbleweeds.splice(i, 1);
      }
    }

    // 5. Update Pickups & Collection
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.y += scrollSpeed * dt;
      pk.pulsePhase += dt * 4;

      for (const p of active) {
        const racer = this.racers.get(p.id);
        if (!racer || racer.stunTimer > 0) continue;

        const isUnderdog = maxScore - racer.score >= 35;
        const grabRadius = isUnderdog ? pk.radius + 38 : pk.radius + 22;

        const dist = Math.hypot(racer.x - pk.x, racer.y - pk.y);
        if (dist < grabRadius) {
          // Collect!
          pk.collected = true;
          const mult = Math.min(3.0, 1.0 + racer.streakCount * 0.5);
          const pts = Math.floor(pk.value * mult * (isSuddenDeath ? 2 : 1));
          racer.score += pts;
          racer.streakCount++;
          racer.streakTimer = 4.0;
          racer.mood = 'triumph';

          this.audio.playScore();
          const col = pk.type === 'blossom' ? '#F43F5E' : pk.type === 'stirrup' ? '#38BDF8' : '#FBBF24';
          this.particles.emit(pk.x, pk.y, pk.type === 'blossom' ? 22 : 12, col);
          this.triggerAnnouncement(`${p.name} Snatched ${pk.type.toUpperCase()}! +${pts}`, 0.9);
          break;
        }
      }

      if (pk.collected || pk.y > height + 60) {
        this.pickups.splice(i, 1);
      }
    }

    // 6. Elastic Bumper Saddle Shunts Between Racers
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const p1 = active[i];
        const p2 = active[j];
        const r1 = this.racers.get(p1.id);
        const r2 = this.racers.get(p2.id);
        if (!r1 || !r2) continue;

        const dx = r2.x - r1.x;
        const dy = r2.y - r1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 36;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Check if either is dashing/jumping for Sabotage Shunt!
          const r1Shunting = r1.isSuperDashing || (r1.jumpTimer > 0 && r1.jumpHeight > 10);
          const r2Shunting = r2.isSuperDashing || (r2.jumpTimer > 0 && r2.jumpHeight > 10);

          if (r1Shunting && !r2Shunting) {
            // R1 shunts R2
            r2.stunTimer = 0.65;
            r2.score = Math.max(0, r2.score - 10);
            r2.vx = nx * 340;
            r2.vy = ny * 340;
            r2.mood = 'shocked';

            const pts = isSuddenDeath ? 60 : 30;
            r1.score += pts;
            r1.sabotageCount++;
            r1.mood = 'triumph';

            this.screenShake = 11;
            this.hitStopTimer = 0.05;
            this.audio.playBounce();
            this.particles.emit((r1.x + r2.x) / 2, (r1.y + r2.y) / 2, 20, '#F59E0B');
            this.triggerAnnouncement(`SADDLE BUMPER SHUNT! +${pts} Sabotage!`, 1.2);
          } else if (r2Shunting && !r1Shunting) {
            // R2 shunts R1
            r1.stunTimer = 0.65;
            r1.score = Math.max(0, r1.score - 10);
            r1.vx = -nx * 340;
            r1.vy = -ny * 340;
            r1.mood = 'shocked';

            const pts = isSuddenDeath ? 60 : 30;
            r2.score += pts;
            r2.sabotageCount++;
            r2.mood = 'triumph';

            this.screenShake = 11;
            this.hitStopTimer = 0.05;
            this.audio.playBounce();
            this.particles.emit((r1.x + r2.x) / 2, (r1.y + r2.y) / 2, 20, '#F59E0B');
            this.triggerAnnouncement(`SADDLE BUMPER SHUNT! +${pts} Sabotage!`, 1.2);
          } else {
            // Standard elastic bumper recoil
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

  private triggerAnnouncement(text: string, duration: number = 1.0): void {
    this.announcementText = text;
    this.announcementTimer = duration;
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const racer = this.racers.get(botId);
    if (!racer || racer.stunTimer > 0) return;

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

    let targetX = racer.x;
    let targetY = height * 0.70; // preferred race height

    // Find nearest threatening cactus
    let nearestThreat: CactusHazard | null = null;
    let minThreatDist = 180;
    for (const c of this.cacti) {
      if (c.y < racer.y && c.y > racer.y - 160 && Math.abs(c.x - racer.x) < 60) {
        const d = Math.hypot(c.x - racer.x, c.y - racer.y);
        if (d < minThreatDist) {
          minThreatDist = d;
          nearestThreat = c;
        }
      }
    }

    // Nearest high-value pickup
    let nearestPickup: DesertPickup | null = null;
    let minPickDist = 220;
    for (const pk of this.pickups) {
      if (pk.y < racer.y + 40 && pk.y > racer.y - 200) {
        const d = Math.hypot(pk.x - racer.x, pk.y - racer.y);
        if (d < minPickDist) {
          minPickDist = d;
          nearestPickup = pk;
        }
      }
    }

    // Nearest rival for Hard shunting
    let rivalToShunt: GallopRacer | null = null;
    if (difficulty === 'bot_hard') {
      let minRivalDist = 140;
      for (const [id, r] of this.racers.entries()) {
        if (id !== botId && r.stunTimer <= 0) {
          const d = Math.hypot(r.x - racer.x, r.y - racer.y);
          if (d < minRivalDist) {
            minRivalDist = d;
            rivalToShunt = r;
          }
        }
      }
    }

    let wantCharge = false;

    if (nearestThreat) {
      if (difficulty === 'bot_hard' || (difficulty === 'bot_normal' && Math.random() < 0.75)) {
        // Hard / normal can choose to hurdle jump over the cactus!
        if (racer.jumpTimer <= 0 && racer.chargeTime >= 0.75) {
          // Release sweet spot!
          wantCharge = false;
        } else if (racer.jumpTimer <= 0) {
          wantCharge = true;
          // Dodge slightly sideways
          targetX = nearestThreat.x > racer.x ? racer.x - 50 : racer.x + 50;
        }
      } else {
        // Easy just weaves away
        targetX = nearestThreat.x > racer.x ? racer.x - 70 : racer.x + 70;
      }
    } else if (rivalToShunt !== null && difficulty === 'bot_hard') {
      const targetRival: GallopRacer = rivalToShunt;
      // Seek rival to execute bumper shunt
      targetX = targetRival.x;
      targetY = targetRival.y;
      if (racer.jumpTimer <= 0) {
        if (racer.chargeTime >= 0.76 && racer.chargeTime <= 0.95) {
          wantCharge = false; // Launch leap shunt!
        } else {
          wantCharge = true;
        }
      }
    } else if (nearestPickup) {
      targetX = nearestPickup.x;
      targetY = nearestPickup.y;
      if (difficulty === 'bot_hard' && minPickDist > 120 && racer.jumpTimer <= 0) {
        wantCharge = racer.chargeTime < 0.8;
      }
    } else {
      // Gallop forward and center
      targetX = width / 2 + Math.sin(Date.now() * 0.002) * (width * 0.25);
    }

    // Calculate steering direction
    const dx = targetX - racer.x;
    const dy = targetY - racer.y;
    const dist = Math.hypot(dx, dy);
    const steerX = dist > 5 ? Math.max(-1, Math.min(1, dx / 40)) : 0;
    const throttleY = dist > 5 ? Math.max(-1, Math.min(1, dy / 40)) : 0;

    this.input.setBotInput(botId, wantCharge, steerX, throttleY);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIndex];

    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Sky & Distant Mesas
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, theme.bgGradTop);
    skyGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Distant Mesa Silhouettes
    ctx.fillStyle = theme.mesaColor;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.35);
    ctx.lineTo(width * 0.15, height * 0.25);
    ctx.lineTo(width * 0.32, height * 0.25);
    ctx.lineTo(width * 0.42, height * 0.38);
    ctx.lineTo(width * 0.65, height * 0.28);
    ctx.lineTo(width * 0.82, height * 0.28);
    ctx.lineTo(width, height * 0.36);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fill();

    // 2. Parallax Sand Dunes & Tracks
    const duneGrad = ctx.createLinearGradient(0, height * 0.2, 0, height);
    duneGrad.addColorStop(0, theme.duneColor1);
    duneGrad.addColorStop(1, theme.duneColor2);
    ctx.fillStyle = duneGrad;
    ctx.fillRect(0, height * 0.3, width, height * 0.7);

    // Dynamic sand dune ridge lines
    ctx.strokeStyle = theme.dustColor;
    ctx.lineWidth = 3;
    const waveOffset = (this.scrollOffset * 0.5) % 120;
    for (let y = height * 0.35; y < height; y += 75) {
      ctx.beginPath();
      const waveY = y + waveOffset;
      ctx.moveTo(0, waveY);
      for (let x = 0; x <= width; x += 40) {
        const dy = Math.sin((x + waveY) * 0.02) * 12;
        ctx.lineTo(x, waveY + dy);
      }
      ctx.stroke();
    }

    // 3. Render Pickups
    for (const pk of this.pickups) {
      ctx.save();
      ctx.translate(pk.x, pk.y);
      const bob = Math.sin(pk.pulsePhase) * 4;

      if (pk.type === 'blossom') {
        // Golden Cactus Blossom (jackpot)
        ctx.fillStyle = '#FB7185';
        ctx.beginPath();
        ctx.arc(0, bob, pk.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFE4E6';
        ctx.beginPath();
        ctx.arc(0, bob, pk.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, bob, pk.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (pk.type === 'stirrup') {
        // Silver Stirrup
        ctx.strokeStyle = '#E0F2FE';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, bob - 2, pk.radius * 0.8, 0.2 * Math.PI, 0.8 * Math.PI, true);
        ctx.lineTo(pk.radius * 0.7, bob + 8);
        ctx.lineTo(-pk.radius * 0.7, bob + 8);
        ctx.closePath();
        ctx.stroke();
      } else {
        // Bronze Horseshoe
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, bob, pk.radius * 0.8, 0.3 * Math.PI, 1.7 * Math.PI);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Render Cacti Hazards
    for (const c of this.cacti) {
      ctx.save();
      ctx.translate(c.x, c.y);

      // Cast shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.beginPath();
      ctx.ellipse(4, 8, c.radius * 1.1, c.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = theme.cactusColor;
      ctx.strokeStyle = theme.cactusHighlight;
      ctx.lineWidth = 2;

      if (c.type === 'saguaro') {
        // Main stem
        ctx.beginPath();
        ctx.roundRect(-7, -c.height, 14, c.height, 7);
        ctx.fill();
        ctx.stroke();

        // Left arm
        ctx.beginPath();
        ctx.moveTo(-7, -c.height * 0.5);
        ctx.lineTo(-18, -c.height * 0.5);
        ctx.lineTo(-18, -c.height * 0.8);
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Right arm
        if (c.arms >= 2) {
          ctx.beginPath();
          ctx.moveTo(7, -c.height * 0.4);
          ctx.lineTo(18, -c.height * 0.4);
          ctx.lineTo(18, -c.height * 0.7);
          ctx.stroke();
        }
      } else if (c.type === 'barrel') {
        // Barrel cactus
        ctx.beginPath();
        ctx.arc(0, -c.radius, c.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Golden flower on top
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.arc(0, -c.radius * 2, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Prickly Pear cluster
        ctx.beginPath();
        ctx.ellipse(0, -12, 12, 16, 0.2, 0, Math.PI * 2);
        ctx.ellipse(-10, -22, 9, 12, -0.4, 0, Math.PI * 2);
        ctx.ellipse(10, -20, 8, 11, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }

    // 5. Render Tumbleweeds
    for (const tw of this.tumbleweeds) {
      ctx.save();
      ctx.translate(tw.x, tw.y);
      ctx.rotate(tw.rotation);

      ctx.strokeStyle = tw.kickedBy ? '#F59E0B' : '#A16207';
      ctx.lineWidth = 2.5;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ctx.beginPath();
        ctx.arc(Math.cos(a) * (tw.radius * 0.4), Math.sin(a) * (tw.radius * 0.4), tw.radius * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 6. Render Racers (Horses + Jockeys)
    const active = this.getActivePlayers();
    let maxScore = -1;
    this.racers.forEach(r => { if (r.score > maxScore) maxScore = r.score; });

    // Sort racers by Y position for proper 2.5D depth
    const sortedRacers = Array.from(this.racers.values()).sort((a, b) => a.y - b.y);

    for (const racer of sortedRacers) {
      const p = this.getPlayer(racer.id);
      if (!p) continue;

      const isUnderdog = maxScore - racer.score >= 35;
      const isBot = p.type !== 'human';
      const drawY = racer.y - racer.jumpHeight;

      ctx.save();
      ctx.translate(racer.x, drawY);

      // Horse shadow on ground
      ctx.save();
      ctx.translate(0, racer.jumpHeight);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      const shadowScale = Math.max(0.5, 1 - racer.jumpHeight / 60);
      ctx.beginPath();
      ctx.ellipse(0, 10, 22 * shadowScale, 11 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Golden Hurdle Dash Trail
      if (racer.isSuperDashing) {
        ctx.save();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-Math.cos(racer.angle) * 35, -Math.sin(racer.angle) * 35);
        ctx.stroke();
        ctx.restore();
      }

      // Spur Charging Ring & Sweet Spot
      if (racer.isCharging) {
        const ratio = Math.min(1.0, racer.chargeTime / 1.0);
        const sweetMin = isUnderdog ? 0.50 : 0.72;
        const sweetMax = isUnderdog ? 1.05 : 0.98;
        const inSweet = ratio >= sweetMin && ratio <= sweetMax;

        // Background meter ring
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.stroke();

        // Sweet spot sector highlight
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.45)';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(0, 0, 32, sweetMin * Math.PI * 2 - Math.PI / 2, sweetMax * Math.PI * 2 - Math.PI / 2);
        ctx.stroke();

        // Active charge arc
        ctx.strokeStyle = inSweet ? '#22C55E' : '#EAB308';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 32, -Math.PI / 2, ratio * Math.PI * 2 - Math.PI / 2);
        ctx.stroke();

        if (inSweet) {
          ctx.fillStyle = '#4ADE80';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('LEAP!', 0, -40);
        }
      }

      // Draw Galloping Steed
      ctx.save();
      const gallopBob = Math.sin(racer.gallopPhase) * 4;
      const legBob = Math.cos(racer.gallopPhase) * 6;

      // Horse body
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.roundRect(-14, -10 + gallopBob, 28, 22, 8);
      ctx.fill();

      // Horse neck & head
      ctx.fillStyle = '#581C87';
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.roundRect(-6, -26 + gallopBob, 12, 18, 5);
      ctx.fill();

      // Horse ears & mane
      ctx.fillStyle = '#451A03';
      ctx.beginPath();
      ctx.moveTo(-5, -28 + gallopBob);
      ctx.lineTo(-2, -34 + gallopBob);
      ctx.lineTo(0, -28 + gallopBob);
      ctx.moveTo(5, -28 + gallopBob);
      ctx.lineTo(2, -34 + gallopBob);
      ctx.lineTo(0, -28 + gallopBob);
      ctx.fill();

      // Horse legs
      ctx.strokeStyle = '#542307';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      // Front legs
      ctx.beginPath();
      ctx.moveTo(-8, 10 + gallopBob);
      ctx.lineTo(-10, 20 + legBob);
      ctx.moveTo(8, 10 + gallopBob);
      ctx.lineTo(10, 20 - legBob);
      ctx.stroke();

      // Saddle
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(-8, -4 + gallopBob, 16, 12, 4);
      ctx.fill();

      // Draw Mascot Jockey
      drawCharacter(
        ctx,
        0,
        -16 + gallopBob,
        14,
        p.id,
        isBot,
        racer.mood,
        racer.animTimer
      );

      ctx.restore();

      // Underdog Iron Mustang Aura
      if (isUnderdog) {
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.7)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 36, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    }

    // 7. Strict UI Elements
    // Top-center timer safe zone (y: 12-44, x: width/2 - 80 to width/2 + 80)
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
      isSuddenDeath ? `⚡ STAMPEDE: ${Math.ceil(this.roundTimer)}s ⚡` : `⏱️ ${Math.ceil(this.roundTimer)}s`,
      width / 2,
      timerBoxY + timerBoxH / 2
    );

    // Minigame Header Badge (y: 56, h: 28)
    const badgeW = 260;
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
    ctx.fillText('🌵 CACTUS SLALOM • DESERT STEEPLECHASE', width / 2, badgeY + badgeH / 2);

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
      const racer = this.racers.get(p.id);
      if (!racer) return;

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

      // Mascot badge
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
      ctx.fillText(`${racer.score} pts`, cardX + 32, cardY + 34);

      if (racer.streakCount > 1) {
        ctx.fillStyle = '#4ADE80';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`x${(1 + (racer.streakCount - 1) * 0.5).toFixed(1)}`, cardX + cardW - 8, cardY + 34);
      }
      ctx.restore();
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.racers.entries()).map(([playerId, r]) => ({
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
        ? `${this.getPlayer(winnerId)?.name} conquered the desert slalom with ${scores[0].score} pts!`
        : 'The steeds galloped peacefully into the sunset!'
    };
  }
}
