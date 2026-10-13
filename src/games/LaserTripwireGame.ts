import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface LaserTripwire {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  speed: number;
  axis: 'horizontal' | 'vertical' | 'diagonal';
  rangeMin: number;
  rangeMax: number;
  dir: number;
  color: string;
}

interface VaultIntel {
  id: number;
  x: number;
  y: number;
  type: 'microchip' | 'hard_drive' | 'crown_jewel';
  value: number;
  radius: number;
  pulsePhase: number;
  collected: boolean;
}

interface VaultInfiltrator {
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
  phaseTimer: number; // Invulnerable phase-dash
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
  isSuperPhasing: boolean;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  floorColor: string;
  gridLineColor: string;
  wallColor: string;
  laserMain: string;
  laserGlow: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Cyber Titanium Vault',
    icon: '🏢',
    bgGradTop: '#0F172A',
    bgGradBottom: '#020617',
    floorColor: '#1E293B',
    gridLineColor: '#334155',
    wallColor: '#475569',
    laserMain: '#EF4444',
    laserGlow: 'rgba(239, 68, 68, 0.35)'
  },
  {
    name: 'Subterranean Gold Reserve',
    icon: '🏛️',
    bgGradTop: '#451A03',
    bgGradBottom: '#180800',
    floorColor: '#78350F',
    gridLineColor: '#92400E',
    wallColor: '#B45309',
    laserMain: '#F59E0B',
    laserGlow: 'rgba(245, 158, 11, 0.35)'
  },
  {
    name: 'Neo-Tokyo Penthouse Gallery',
    icon: '🏙️',
    bgGradTop: '#1E1B4B',
    bgGradBottom: '#020617',
    floorColor: '#312E81',
    gridLineColor: '#4338CA',
    wallColor: '#6366F1',
    laserMain: '#10B981',
    laserGlow: 'rgba(16, 185, 129, 0.35)'
  }
];

export class LaserTripwireGame extends BaseGame {
  private infiltrators: Map<PlayerId, VaultInfiltrator> = new Map();
  private lasers: LaserTripwire[] = [];
  private intelList: VaultIntel[] = [];
  private nextEntityId = 1;

  private intelSpawnTimer = 0;
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
    this.infiltrators.clear();
    this.lasers = [];
    this.intelList = [];
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.announcementText = '';
    this.announcementTimer = 0;
    this.intelSpawnTimer = 0.5;
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;

    // Spawn players around the vault corners
    const spawnPositions = [
      { x: 100, y: 150 },
      { x: width - 100, y: 150 },
      { x: 100, y: height - 150 },
      { x: width - 100, y: height - 150 }
    ];

    for (let i = 0; i < count; i++) {
      const p = active[i];
      const pos = spawnPositions[i % spawnPositions.length];
      this.infiltrators.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: 0,
        score: 0,
        chargeTime: 0,
        isCharging: false,
        overheatTimer: 0,
        phaseTimer: 0,
        stunTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: 0,
        sabotageCount: 0,
        isSuperPhasing: false
      });
      this.botReactionTimers.set(p.id, 0);
    }

    // Initialize high-tech security laser tripwires
    // Horizontal sweepers
    this.lasers.push({
      id: this.nextEntityId++,
      x1: 40,
      y1: height * 0.35,
      x2: width - 40,
      y2: height * 0.35,
      speed: 110,
      axis: 'horizontal',
      rangeMin: height * 0.22,
      rangeMax: height * 0.78,
      dir: 1,
      color: '#EF4444'
    });
    this.lasers.push({
      id: this.nextEntityId++,
      x1: 40,
      y1: height * 0.65,
      x2: width - 40,
      y2: height * 0.65,
      speed: 130,
      axis: 'horizontal',
      rangeMin: height * 0.22,
      rangeMax: height * 0.78,
      dir: -1,
      color: '#EF4444'
    });

    // Vertical sweepers
    this.lasers.push({
      id: this.nextEntityId++,
      x1: width * 0.35,
      y1: 100,
      x2: width * 0.35,
      y2: height - 100,
      speed: 120,
      axis: 'vertical',
      rangeMin: width * 0.2,
      rangeMax: width * 0.8,
      dir: 1,
      color: '#EF4444'
    });
    this.lasers.push({
      id: this.nextEntityId++,
      x1: width * 0.65,
      y1: 100,
      x2: width * 0.65,
      y2: height - 100,
      speed: 140,
      axis: 'vertical',
      rangeMin: width * 0.2,
      rangeMax: width * 0.8,
      dir: -1,
      color: '#EF4444'
    });

    // Seed initial vault intel items
    for (let i = 0; i < 7; i++) {
      this.spawnIntel(width, height);
    }
  }

  private spawnIntel(width: number, height: number): void {
    const isSuddenDeath = this.roundTimer <= 12.0;
    const marginX = 90;
    const marginY = 130;
    const x = marginX + Math.random() * (width - marginX * 2);
    const y = marginY + Math.random() * (height - marginY * 2);

    const roll = Math.random();
    let type: 'microchip' | 'hard_drive' | 'crown_jewel' = 'microchip';
    let value = 20;
    let radius = 13;

    if (isSuddenDeath && roll < 0.25) {
      type = 'crown_jewel';
      value = 75;
      radius = 18;
    } else if (roll < 0.45) {
      type = 'hard_drive';
      value = 45;
      radius = 15;
    }

    this.intelList.push({
      id: this.nextEntityId++,
      x,
      y,
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
    const speedMult = isSuddenDeath ? 1.45 : 1.0;

    // Highest score for Underdog
    let maxScore = -1;
    this.infiltrators.forEach(inf => { if (inf.score > maxScore) maxScore = inf.score; });

    // 1. Spawner
    this.intelSpawnTimer -= dt;
    if (this.intelSpawnTimer <= 0 && this.intelList.length < 10) {
      this.intelSpawnTimer = (isSuddenDeath ? 0.6 : 1.1) + Math.random() * 0.4;
      this.spawnIntel(width, height);
    }

    // 2. Update Security Lasers
    for (const laser of this.lasers) {
      if (laser.axis === 'horizontal') {
        laser.y1 += laser.speed * speedMult * laser.dir * dt;
        laser.y2 = laser.y1;
        if (laser.y1 <= laser.rangeMin) {
          laser.y1 = laser.rangeMin;
          laser.y2 = laser.rangeMin;
          laser.dir = 1;
        } else if (laser.y1 >= laser.rangeMax) {
          laser.y1 = laser.rangeMax;
          laser.y2 = laser.rangeMax;
          laser.dir = -1;
        }
      } else if (laser.axis === 'vertical') {
        laser.x1 += laser.speed * speedMult * laser.dir * dt;
        laser.x2 = laser.x1;
        if (laser.x1 <= laser.rangeMin) {
          laser.x1 = laser.rangeMin;
          laser.x2 = laser.rangeMin;
          laser.dir = 1;
        } else if (laser.x1 >= laser.rangeMax) {
          laser.x1 = laser.rangeMax;
          laser.x2 = laser.rangeMax;
          laser.dir = -1;
        }
      }
    }

    // 3. Update Infiltrators
    const active = this.getActivePlayers();
    for (const p of active) {
      const inf = this.infiltrators.get(p.id);
      if (!inf) continue;

      inf.animTimer += dt;

      if (inf.phaseTimer > 0) {
        inf.phaseTimer -= dt;
        if (inf.phaseTimer <= 0) {
          inf.isSuperPhasing = false;
        }
      }
      if (inf.streakTimer > 0) {
        inf.streakTimer -= dt;
        if (inf.streakTimer <= 0) {
          inf.streakCount = 0;
        }
      }

      // Stun
      if (inf.stunTimer > 0) {
        inf.stunTimer -= dt;
        inf.vx *= 0.88;
        inf.vy *= 0.88;
        inf.x += inf.vx * dt;
        inf.y += inf.vy * dt;
        inf.mood = 'shocked';
        continue;
      }

      if (inf.overheatTimer > 0) {
        inf.overheatTimer -= dt;
      }

      const isUnderdog = maxScore - inf.score >= 35;

      // Inputs
      const steerX = this.input.getSteer(p.id);
      const throttleY = -this.input.getThrottle(p.id);
      const actionPressed = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      // Cyber movement physics
      let maxSpeed = 230;
      let accel = 800;
      if (inf.isSuperPhasing) {
        maxSpeed = 380;
        accel = 1300;
      } else if (isUnderdog) {
        maxSpeed *= 1.25;
        accel *= 1.25;
      }

      if (steerX !== 0 || throttleY !== 0) {
        inf.vx += steerX * accel * dt;
        inf.vy += throttleY * accel * dt;
        inf.angle = Math.atan2(throttleY, steerX);
      } else {
        inf.vx *= 0.88;
        inf.vy *= 0.88;
      }

      const curSpeed = Math.hypot(inf.vx, inf.vy);
      if (curSpeed > maxSpeed) {
        inf.vx = (inf.vx / curSpeed) * maxSpeed;
        inf.vy = (inf.vy / curSpeed) * maxSpeed;
      }

      inf.x += inf.vx * dt;
      inf.y += inf.vy * dt;

      // Vault walls
      const minX = 44;
      const maxX = width - 44;
      const minY = 90;
      const maxY = height - 70;

      if (inf.x < minX) { inf.x = minX; inf.vx = Math.abs(inf.vx) * 0.5; }
      if (inf.x > maxX) { inf.x = maxX; inf.vx = -Math.abs(inf.vx) * 0.5; }
      if (inf.y < minY) { inf.y = minY; inf.vy = Math.abs(inf.vy) * 0.5; }
      if (inf.y > maxY) { inf.y = maxY; inf.vy = -Math.abs(inf.vy) * 0.5; }

      // Hold-to-Charge Phase Vault Sweet Spot (72%–98%)
      if (inf.overheatTimer <= 0 && inf.stunTimer <= 0) {
        if (actionPressed) {
          inf.isCharging = true;
          inf.chargeTime += dt;
          inf.mood = 'focused';

          if (Math.random() < 0.3) {
            this.particles.emit(inf.x, inf.y, 2, '#38BDF8');
          }

          if (inf.chargeTime > 1.25) {
            // Overheat EMP short-circuit
            inf.isCharging = false;
            inf.chargeTime = 0;
            inf.overheatTimer = 0.85;
            inf.stunTimer = 0.6;
            inf.mood = 'shocked';
            this.audio.playExplosion();
            this.particles.emit(inf.x, inf.y, 16, '#EF4444');
            this.triggerAnnouncement(`${p.name}'s Cloak Short-Circuited!`, 1.1);
          }
        } else if (!actionPressed && inf.isCharging) {
          inf.isCharging = false;
          const ratio = inf.chargeTime / 1.0;
          const sweetMin = isUnderdog ? 0.50 : 0.72;
          const sweetMax = isUnderdog ? 1.05 : 0.98;

          if (ratio >= sweetMin && ratio <= sweetMax) {
            // SUPERSONIC HOLOGRAPHIC PHASE-DASH SWEET SPOT!
            inf.phaseTimer = 1.2;
            inf.isSuperPhasing = true;
            inf.mood = 'triumph';
            inf.streakCount++;
            inf.streakTimer = 4.0;
            const streakMult = Math.min(3.0, 1.0 + (inf.streakCount - 1) * 0.5);
            const aceBonus = Math.floor(25 * streakMult * (isSuddenDeath ? 2 : 1));
            inf.score += aceBonus;

            this.screenShake = 9;
            this.audio.playFanfare();
            this.particles.emit(inf.x, inf.y, 22, '#38BDF8');
            this.particles.emit(inf.x, inf.y, 16, '#06B6D4');
            this.triggerAnnouncement(`★ PHANTOM INFILTRATOR ACE! +${aceBonus} ★`, 1.3);
          } else {
            // Short hop
            inf.phaseTimer = 0.4;
            inf.isSuperPhasing = false;
            this.audio.playTap();
            inf.mood = 'idle';
          }
          inf.chargeTime = 0;
        }
      }

      if (!inf.isCharging && inf.stunTimer <= 0 && inf.phaseTimer <= 0) {
        inf.mood = 'idle';
      }

      // Check laser collisions for non-phased players
      if (inf.phaseTimer <= 0 && inf.stunTimer <= 0) {
        if (!isUnderdog) {
          for (const laser of this.lasers) {
            let hit = false;
            if (laser.axis === 'horizontal') {
              if (Math.abs(laser.y1 - inf.y) < 16 && inf.x >= laser.x1 && inf.x <= laser.x2) {
                hit = true;
              }
            } else if (laser.axis === 'vertical') {
              if (Math.abs(laser.x1 - inf.x) < 16 && inf.y >= laser.y1 && inf.y <= laser.y2) {
                hit = true;
              }
            }

            if (hit) {
              inf.stunTimer = 1.0;
              inf.score = Math.max(0, inf.score - 10);
              inf.vx = -inf.vx * 1.5;
              inf.vy = -inf.vy * 1.5;
              inf.mood = 'shocked';

              this.screenShake = 12;
              this.hitStopTimer = 0.05;
              this.audio.playExplosion();
              this.particles.emit(inf.x, inf.y, 22, '#EF4444');
              this.triggerAnnouncement(`⚡ ${p.name} TRIPPED A SECURITY LASER! -10 ⚡`, 1.1);
              break;
            }
          }
        }
      }
    }

    // 4. Update Intel Items & Collection
    for (let i = this.intelList.length - 1; i >= 0; i--) {
      const intel = this.intelList[i];
      intel.pulsePhase += dt * 4;

      for (const p of active) {
        const inf = this.infiltrators.get(p.id);
        if (!inf || inf.stunTimer > 0) continue;

        const isUnderdog = maxScore - inf.score >= 35;
        const grabRadius = isUnderdog ? intel.radius + 36 : intel.radius + 20;
        const dist = Math.hypot(inf.x - intel.x, inf.y - intel.y);

        if (dist < grabRadius) {
          intel.collected = true;
          const mult = Math.min(3.0, 1.0 + inf.streakCount * 0.5);
          const pts = Math.floor(intel.value * mult * (isSuddenDeath ? 2 : 1));
          inf.score += pts;
          inf.streakCount++;
          inf.streakTimer = 4.0;
          inf.mood = 'triumph';

          this.audio.playScore();
          const col = intel.type === 'crown_jewel' ? '#F43F5E' : intel.type === 'hard_drive' ? '#38BDF8' : '#FBBF24';
          this.particles.emit(intel.x, intel.y, 16, col);
          this.triggerAnnouncement(`${p.name} Snatched ${intel.type.replace('_', ' ').toUpperCase()}! +${pts}`, 0.9);
          break;
        }
      }

      if (intel.collected) {
        this.intelList.splice(i, 1);
      }
    }

    // 5. Elastic Cyber-Bumper Shunts Between Infiltrators
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const p1 = active[i];
        const p2 = active[j];
        const inf1 = this.infiltrators.get(p1.id);
        const inf2 = this.infiltrators.get(p2.id);
        if (!inf1 || !inf2) continue;

        const dx = inf2.x - inf1.x;
        const dy = inf2.y - inf1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 34;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;

          const inf1Phasing = inf1.isSuperPhasing;
          const inf2Phasing = inf2.isSuperPhasing;

          if (inf1Phasing && !inf2Phasing) {
            // INF1 shunts INF2!
            inf2.stunTimer = 0.7;
            inf2.score = Math.max(0, inf2.score - 10);
            inf2.vx = nx * 360;
            inf2.vy = ny * 360;
            inf2.mood = 'shocked';

            const pts = isSuddenDeath ? 60 : 30;
            inf1.score += pts;
            inf1.sabotageCount++;
            inf1.mood = 'triumph';

            this.screenShake = 11;
            this.hitStopTimer = 0.05;
            this.audio.playBounce();
            this.particles.emit((inf1.x + inf2.x) / 2, (inf1.y + inf2.y) / 2, 20, '#38BDF8');
            this.triggerAnnouncement(`CYBER-BUMPER SHUNT! +${pts} Sabotage!`, 1.2);
          } else if (inf2Phasing && !inf1Phasing) {
            inf1.stunTimer = 0.7;
            inf1.score = Math.max(0, inf1.score - 10);
            inf1.vx = -nx * 360;
            inf1.vy = -ny * 360;
            inf1.mood = 'shocked';

            const pts = isSuddenDeath ? 60 : 30;
            inf2.score += pts;
            inf2.sabotageCount++;
            inf2.mood = 'triumph';

            this.screenShake = 11;
            this.hitStopTimer = 0.05;
            this.audio.playBounce();
            this.particles.emit((inf1.x + inf2.x) / 2, (inf1.y + inf2.y) / 2, 20, '#38BDF8');
            this.triggerAnnouncement(`CYBER-BUMPER SHUNT! +${pts} Sabotage!`, 1.2);
          } else {
            const overlap = (minDist - dist) * 0.5;
            inf1.x -= nx * overlap;
            inf1.y -= ny * overlap;
            inf2.x += nx * overlap;
            inf2.y += ny * overlap;

            const kx = inf1.vx - inf2.vx;
            const ky = inf1.vy - inf2.vy;
            const p = 2 * (nx * kx + ny * ky) / 2;
            inf1.vx -= p * nx * 0.8;
            inf1.vy -= p * ny * 0.8;
            inf2.vx += p * nx * 0.8;
            inf2.vy += p * ny * 0.8;

            this.audio.playBounce();
            this.particles.emit((inf1.x + inf2.x) / 2, (inf1.y + inf2.y) / 2, 6, '#38BDF8');
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
    const inf = this.infiltrators.get(botId);
    if (!inf || inf.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) + dt;
    this.botReactionTimers.set(botId, timer);

    const reactionLimit = difficulty === 'bot_easy' ? 0.42 : difficulty === 'bot_normal' ? 0.23 : 0.10;
    if (timer < reactionLimit) {
      return;
    }
    this.botReactionTimers.set(botId, 0);

    // Blunder for Easy
    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
      return;
    }

    let targetX = width / 2;
    let targetY = height / 2;
    let wantAction = false;

    // Check laser threats nearby
    let nearestLaserThreat: LaserTripwire | null = null;
    let minLaserDist = 90;
    for (const laser of this.lasers) {
      let d = Infinity;
      if (laser.axis === 'horizontal') d = Math.abs(laser.y1 - inf.y);
      else if (laser.axis === 'vertical') d = Math.abs(laser.x1 - inf.x);

      if (d < minLaserDist) {
        minLaserDist = d;
        nearestLaserThreat = laser;
      }
    }

    // Nearest intel
    let nearestIntel: VaultIntel | null = null;
    let minIntelDist = 260;
    for (const intel of this.intelList) {
      const d = Math.hypot(intel.x - inf.x, intel.y - inf.y);
      if (d < minIntelDist) {
        minIntelDist = d;
        nearestIntel = intel;
      }
    }

    // Hard rival shunting
    let rivalToShunt: VaultInfiltrator | null = null;
    if (difficulty === 'bot_hard') {
      let minRivalDist = 130;
      for (const [id, r] of this.infiltrators.entries()) {
        if (id !== botId && r.stunTimer <= 0) {
          const d = Math.hypot(r.x - inf.x, r.y - inf.y);
          if (d < minRivalDist) {
            minRivalDist = d;
            rivalToShunt = r;
          }
        }
      }
    }

    if (nearestLaserThreat && inf.phaseTimer <= 0) {
      if (difficulty === 'bot_hard' || (difficulty === 'bot_normal' && Math.random() < 0.75)) {
        // Phase vault through laser!
        if (inf.chargeTime >= 0.75 && inf.chargeTime <= 0.95) {
          wantAction = false; // Launch phase vault!
        } else {
          wantAction = true;
        }
      } else {
        // Run away from laser
        if (nearestLaserThreat.axis === 'horizontal') {
          targetY = nearestLaserThreat.y1 > inf.y ? inf.y - 60 : inf.y + 60;
        } else {
          targetX = nearestLaserThreat.x1 > inf.x ? inf.x - 60 : inf.x + 60;
        }
      }
    } else if (rivalToShunt !== null && difficulty === 'bot_hard' && nearestIntel === null) {
      const targetRival: VaultInfiltrator = rivalToShunt;
      targetX = targetRival.x;
      targetY = targetRival.y;
      if (inf.chargeTime >= 0.76 && inf.chargeTime <= 0.95) {
        wantAction = false;
      } else {
        wantAction = true;
      }
    } else if (nearestIntel) {
      targetX = nearestIntel.x;
      targetY = nearestIntel.y;
    } else {
      targetX = width / 2 + Math.sin(Date.now() * 0.002) * (width * 0.25);
      targetY = height / 2 + Math.cos(Date.now() * 0.002) * (height * 0.2);
    }

    const dx = targetX - inf.x;
    const dy = targetY - inf.y;
    const dist = Math.hypot(dx, dy);
    const steerX = dist > 5 ? Math.max(-1, Math.min(1, dx / 40)) : 0;
    const throttleY = dist > 5 ? Math.max(-1, Math.min(1, dy / 40)) : 0;

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

    // 1. Vault Floor Grid
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = theme.floorColor;
    ctx.fillRect(30, 80, width - 60, height - 140);

    // Floor tile grid
    ctx.strokeStyle = theme.gridLineColor;
    ctx.lineWidth = 1;
    for (let x = 30; x <= width - 30; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 80);
      ctx.lineTo(x, height - 60);
      ctx.stroke();
    }
    for (let y = 80; y <= height - 60; y += 40) {
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(width - 30, y);
      ctx.stroke();
    }

    // Perimeter Vault Walls
    ctx.strokeStyle = theme.wallColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(30, 80, width - 60, height - 140);

    // 2. Render Intel Items
    for (const intel of this.intelList) {
      ctx.save();
      ctx.translate(intel.x, intel.y);
      const bob = Math.sin(intel.pulsePhase) * 3;

      if (intel.type === 'crown_jewel') {
        // Crown Jewel Matrix
        ctx.fillStyle = '#F43F5E';
        ctx.beginPath();
        ctx.moveTo(0, -intel.radius + bob);
        ctx.lineTo(intel.radius, bob);
        ctx.lineTo(0, intel.radius + bob);
        ctx.lineTo(-intel.radius, bob);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFE4E6';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (intel.type === 'hard_drive') {
        // Encrypted Hard Drive
        ctx.fillStyle = '#0284C7';
        ctx.fillRect(-intel.radius, -intel.radius * 0.7 + bob, intel.radius * 2, intel.radius * 1.4);
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.strokeRect(-intel.radius, -intel.radius * 0.7 + bob, intel.radius * 2, intel.radius * 1.4);
      } else {
        // Microchip
        ctx.fillStyle = '#EAB308';
        ctx.fillRect(-intel.radius * 0.8, -intel.radius * 0.8 + bob, intel.radius * 1.6, intel.radius * 1.6);
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-intel.radius * 0.8, -intel.radius * 0.8 + bob, intel.radius * 1.6, intel.radius * 1.6);
      }
      ctx.restore();
    }

    // 3. Render Security Laser Tripwires
    for (const laser of this.lasers) {
      ctx.save();
      // Outer glow
      ctx.strokeStyle = theme.laserGlow;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(laser.x1, laser.y1);
      ctx.lineTo(laser.x2, laser.y2);
      ctx.stroke();

      // Sharp central beam
      ctx.strokeStyle = theme.laserMain;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(laser.x1, laser.y1);
      ctx.lineTo(laser.x2, laser.y2);
      ctx.stroke();

      // Laser emitters at endpoints
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(laser.x1, laser.y1, 6, 0, Math.PI * 2);
      ctx.arc(laser.x2, laser.y2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.laserMain;
      ctx.beginPath();
      ctx.arc(laser.x1, laser.y1, 3, 0, Math.PI * 2);
      ctx.arc(laser.x2, laser.y2, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 4. Render Infiltrators
    const active = this.getActivePlayers();
    let maxScore = -1;
    this.infiltrators.forEach(inf => { if (inf.score > maxScore) maxScore = inf.score; });

    for (const p of active) {
      const inf = this.infiltrators.get(p.id);
      if (!inf) continue;

      const isUnderdog = maxScore - inf.score >= 35;
      const isBot = p.type !== 'human';

      ctx.save();
      ctx.translate(inf.x, inf.y);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 10, 16, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Phase Dash Wake
      if (inf.isSuperPhasing) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-Math.cos(inf.angle) * 30, -Math.sin(inf.angle) * 30);
        ctx.stroke();
      }

      // Charge Ring
      if (inf.isCharging) {
        const ratio = Math.min(1.0, inf.chargeTime / 1.0);
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
          ctx.fillText('PHASE!', 0, -36);
        }
      }

      // Phase Cloak Aura
      if (inf.phaseTimer > 0) {
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Mascot Spy
      drawCharacter(
        ctx,
        0,
        0,
        14,
        p.id,
        isBot,
        inf.mood,
        inf.animTimer
      );

      // Underdog Cyber-Phantom Aura
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

    // 5. Strict UI Layout
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
      isSuddenDeath ? `⚡ RED ALERT: ${Math.ceil(this.roundTimer)}s ⚡` : `⏱️ ${Math.ceil(this.roundTimer)}s`,
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
    ctx.fillText('🔴 LASER TRIPWIRE • VAULT INFILTRATION', width / 2, badgeY + badgeH / 2);

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
      const inf = this.infiltrators.get(p.id);
      if (!inf) return;

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
      ctx.fillText(`${inf.score} pts`, cardX + 32, cardY + 34);

      if (inf.streakCount > 1) {
        ctx.fillStyle = '#4ADE80';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`x${(1 + (inf.streakCount - 1) * 0.5).toFixed(1)}`, cardX + cardW - 8, cardY + 34);
      }
      ctx.restore();
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.infiltrators.entries()).map(([playerId, inf]) => ({
      playerId,
      score: inf.score
    }));
    scores.sort((a, b) => b.score - a.score);

    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null
        ? `${this.getPlayer(winnerId)?.name} ghosted past the high-tech security grid with ${scores[0].score} pts!`
        : 'The bank vault security locked down the vault!'
    };
  }
}
