import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface CCTVCamera {
  id: number;
  x: number;
  y: number;
  angle: number;
  sweepDir: number;
  sweepSpeed: number;
  minAngle: number;
  maxAngle: number;
  coneAngle: number;
  length: number;
  alert: boolean;
}

interface MuseumRelic {
  id: number;
  x: number;
  y: number;
  type: 'chalice' | 'scepter' | 'star_diamond';
  value: number;
  radius: number;
  pulsePhase: number;
  collected: boolean;
}

interface SmokeDecoy {
  id: number;
  x: number;
  y: number;
  radius: number;
  lifetime: number;
}

interface CatBurglar {
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
  cloakTimer: number; // Invisibility to cameras
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
  isSuperCloaked: boolean;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  floorColor: string;
  gridLineColor: string;
  pedestalColor: string;
  spotlightColor: string;
  spotlightAlert: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Grand Louvre Gallery',
    icon: '🏛️',
    bgGradTop: '#1E293B',
    bgGradBottom: '#020617',
    floorColor: '#0F172A',
    gridLineColor: '#334155',
    pedestalColor: '#B45309',
    spotlightColor: 'rgba(239, 68, 68, 0.22)',
    spotlightAlert: 'rgba(239, 68, 68, 0.55)'
  },
  {
    name: 'Cyberpunk Tech Expo',
    icon: '🏙️',
    bgGradTop: '#3B0764',
    bgGradBottom: '#0A0118',
    floorColor: '#1E1B4B',
    gridLineColor: '#6366F1',
    pedestalColor: '#0284C7',
    spotlightColor: 'rgba(6, 182, 212, 0.22)',
    spotlightAlert: 'rgba(239, 68, 68, 0.55)'
  },
  {
    name: 'Cairo Antiquities Wing',
    icon: '🏺',
    bgGradTop: '#78350F',
    bgGradBottom: '#291003',
    floorColor: '#451A03',
    gridLineColor: '#92400E',
    pedestalColor: '#D97706',
    spotlightColor: 'rgba(245, 158, 11, 0.22)',
    spotlightAlert: 'rgba(239, 68, 68, 0.55)'
  }
];

export class SecurityCameraGame extends BaseGame {
  private burglars: Map<PlayerId, CatBurglar> = new Map();
  private cameras: CCTVCamera[] = [];
  private relics: MuseumRelic[] = [];
  private smokeClouds: SmokeDecoy[] = [];
  private nextEntityId = 1;

  private relicSpawnTimer = 0;
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
    this.burglars.clear();
    this.cameras = [];
    this.relics = [];
    this.smokeClouds = [];
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.announcementText = '';
    this.announcementTimer = 0;
    this.relicSpawnTimer = 0.5;
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;

    // Spawn 4 players along bottom museum entrance
    const spacing = (width - 160) / Math.max(1, count - 1 || 1);
    for (let i = 0; i < count; i++) {
      const p = active[i];
      const startX = count === 1 ? width / 2 : 80 + i * spacing;
      const startY = height - 120;

      this.burglars.set(p.id, {
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
        cloakTimer: 0,
        stunTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: 0,
        sabotageCount: 0,
        isSuperCloaked: false
      });
      this.botReactionTimers.set(p.id, 0);
    }

    // High-mounted motorized CCTV spotlights sweeping gallery
    this.cameras = [
      {
        id: this.nextEntityId++,
        x: width * 0.25,
        y: 80,
        angle: Math.PI * 0.35,
        sweepDir: 1,
        sweepSpeed: 1.2,
        minAngle: Math.PI * 0.15,
        maxAngle: Math.PI * 0.65,
        coneAngle: 0.34,
        length: height * 0.72,
        alert: false
      },
      {
        id: this.nextEntityId++,
        x: width * 0.75,
        y: 80,
        angle: Math.PI * 0.65,
        sweepDir: -1,
        sweepSpeed: 1.4,
        minAngle: Math.PI * 0.35,
        maxAngle: Math.PI * 0.85,
        coneAngle: 0.34,
        length: height * 0.72,
        alert: false
      },
      {
        id: this.nextEntityId++,
        x: width * 0.50,
        y: 80,
        angle: Math.PI * 0.5,
        sweepDir: 1,
        sweepSpeed: 1.6,
        minAngle: Math.PI * 0.25,
        maxAngle: Math.PI * 0.75,
        coneAngle: 0.28,
        length: height * 0.65,
        alert: false
      }
    ];

    // Seed initial relics
    for (let i = 0; i < 7; i++) {
      this.spawnRelic(width, height);
    }
  }

  private spawnRelic(width: number, height: number): void {
    const isSuddenDeath = this.roundTimer <= 12.0;
    const marginX = 90;
    const marginY = 140;
    const x = marginX + Math.random() * (width - marginX * 2);
    const y = marginY + Math.random() * (height - marginY * 2);

    const roll = Math.random();
    let type: 'chalice' | 'scepter' | 'star_diamond' = 'chalice';
    let value = 20;
    let radius = 13;

    if (isSuddenDeath && roll < 0.25) {
      type = 'star_diamond';
      value = 75;
      radius = 18;
    } else if (roll < 0.45) {
      type = 'scepter';
      value = 45;
      radius = 15;
    }

    this.relics.push({
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
    const camSpeedMult = isSuddenDeath ? 1.75 : 1.0;

    // Highest score for Underdog
    let maxScore = -1;
    this.burglars.forEach(b => { if (b.score > maxScore) maxScore = b.score; });

    // 1. Spawner
    this.relicSpawnTimer -= dt;
    if (this.relicSpawnTimer <= 0 && this.relics.length < 10) {
      this.relicSpawnTimer = (isSuddenDeath ? 0.6 : 1.1) + Math.random() * 0.4;
      this.spawnRelic(width, height);
    }

    // 2. Update CCTV Cameras
    for (const cam of this.cameras) {
      cam.angle += cam.sweepDir * cam.sweepSpeed * camSpeedMult * dt;
      if (cam.angle >= cam.maxAngle) {
        cam.angle = cam.maxAngle;
        cam.sweepDir = -1;
      } else if (cam.angle <= cam.minAngle) {
        cam.angle = cam.minAngle;
        cam.sweepDir = 1;
      }
      cam.alert = false;
    }

    // 3. Update Smoke Decoy Clouds
    for (let i = this.smokeClouds.length - 1; i >= 0; i--) {
      const smk = this.smokeClouds[i];
      smk.lifetime -= dt;
      if (smk.lifetime <= 0) {
        this.smokeClouds.splice(i, 1);
      }
    }

    // 4. Update Burglars
    const active = this.getActivePlayers();
    for (const p of active) {
      const b = this.burglars.get(p.id);
      if (!b) continue;

      b.animTimer += dt;

      if (b.cloakTimer > 0) {
        b.cloakTimer -= dt;
        if (b.cloakTimer <= 0) {
          b.isSuperCloaked = false;
        }
      }
      if (b.streakTimer > 0) {
        b.streakTimer -= dt;
        if (b.streakTimer <= 0) {
          b.streakCount = 0;
        }
      }

      // Stun
      if (b.stunTimer > 0) {
        b.stunTimer -= dt;
        b.vx *= 0.88;
        b.vy *= 0.88;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.mood = 'shocked';
        continue;
      }

      if (b.overheatTimer > 0) {
        b.overheatTimer -= dt;
      }

      const isUnderdog = maxScore - b.score >= 35;

      // Inputs
      const steerX = this.input.getSteer(p.id);
      const throttleY = -this.input.getThrottle(p.id);
      const actionPressed = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      // Stealth movement physics
      let maxSpeed = 230;
      let accel = 800;
      if (b.isSuperCloaked) {
        maxSpeed = 360;
        accel = 1200;
      } else if (isUnderdog) {
        maxSpeed *= 1.25;
        accel *= 1.25;
      }

      if (steerX !== 0 || throttleY !== 0) {
        b.vx += steerX * accel * dt;
        b.vy += throttleY * accel * dt;
        b.angle = Math.atan2(throttleY, steerX);
      } else {
        b.vx *= 0.88;
        b.vy *= 0.88;
      }

      const curSpeed = Math.hypot(b.vx, b.vy);
      if (curSpeed > maxSpeed) {
        b.vx = (b.vx / curSpeed) * maxSpeed;
        b.vy = (b.vy / curSpeed) * maxSpeed;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Gallery bounds
      const pad = 40;
      b.x = Math.max(pad, Math.min(width - pad, b.x));
      b.y = Math.max(pad + 50, Math.min(height - pad, b.y));

      // Hold-to-Charge Smoke Grenade / Camouflage Sweet Spot (72%–98%)
      if (b.overheatTimer <= 0 && b.stunTimer <= 0) {
        if (actionPressed) {
          b.isCharging = true;
          b.chargeTime += dt;
          b.mood = 'focused';

          if (Math.random() < 0.3) {
            this.particles.emit(b.x, b.y, 2, '#94A3B8');
          }

          if (b.chargeTime > 1.25) {
            // Overheat smoke pop in hands
            b.isCharging = false;
            b.chargeTime = 0;
            b.overheatTimer = 0.85;
            b.stunTimer = 0.6;
            b.mood = 'shocked';
            this.audio.playExplosion();
            this.particles.emit(b.x, b.y, 16, '#64748B');
            this.triggerAnnouncement(`${p.name} Coughed in Smoke!`, 1.1);
          }
        } else if (!actionPressed && b.isCharging) {
          b.isCharging = false;
          const ratio = b.chargeTime / 1.0;
          const sweetMin = isUnderdog ? 0.50 : 0.72;
          const sweetMax = isUnderdog ? 1.05 : 0.98;

          if (ratio >= sweetMin && ratio <= sweetMax) {
            // PERFECT CARBON FREEZE & SHADOW CLOAK SWEET SPOT!
            b.cloakTimer = 1.4;
            b.isSuperCloaked = true;
            b.mood = 'triumph';
            b.streakCount++;
            b.streakTimer = 4.0;
            const streakMult = Math.min(3.0, 1.0 + (b.streakCount - 1) * 0.5);
            const aceBonus = Math.floor(25 * streakMult * (isSuddenDeath ? 2 : 1));
            b.score += aceBonus;

            // Spawn smoke cloud
            this.smokeClouds.push({
              id: this.nextEntityId++,
              x: b.x,
              y: b.y,
              radius: 65,
              lifetime: 2.2
            });

            this.screenShake = 9;
            this.audio.playFanfare();
            this.particles.emit(b.x, b.y, 24, '#38BDF8');
            this.triggerAnnouncement(`★ GHOST INFILTRATOR ACE! +${aceBonus} ★`, 1.3);
          } else {
            // Quick freeze
            b.cloakTimer = 0.45;
            b.isSuperCloaked = false;
            this.audio.playTap();
            b.mood = 'idle';
          }
          b.chargeTime = 0;
        }
      }

      if (!b.isCharging && b.stunTimer <= 0 && b.cloakTimer <= 0) {
        b.mood = 'idle';
      }

      // Check camera vision cone detection
      if (b.cloakTimer <= 0 && b.stunTimer <= 0 && !isUnderdog) {
        // Is player in a smoke cloud?
        let inSmoke = false;
        for (const smk of this.smokeClouds) {
          if (Math.hypot(b.x - smk.x, b.y - smk.y) < smk.radius) {
            inSmoke = true;
            break;
          }
        }

        if (!inSmoke) {
          for (const cam of this.cameras) {
            const dx = b.x - cam.x;
            const dy = b.y - cam.y;
            const dist = Math.hypot(dx, dy);

            if (dist <= cam.length) {
              const angleToPlayer = Math.atan2(dy, dx);
              let diff = Math.abs(angleToPlayer - cam.angle);
              while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

              if (diff < cam.coneAngle) {
                // Moving inside camera spotlight: BUSTED!
                if (curSpeed > 18) {
                  cam.alert = true;
                  b.stunTimer = 1.0;
                  b.score = Math.max(0, b.score - 10);
                  b.vx = -b.vx * 1.4;
                  b.vy = -b.vy * 1.4;
                  b.mood = 'shocked';

                  this.screenShake = 12;
                  this.hitStopTimer = 0.05;
                  this.audio.playExplosion();
                  this.particles.emit(b.x, b.y, 20, '#EF4444');
                  this.triggerAnnouncement(`🚨 ${p.name} SPOTTED BY SECURITY! -10 🚨`, 1.1);
                  break;
                }
              }
            }
          }
        }
      }
    }

    // 5. Update Relics & Collection
    for (let i = this.relics.length - 1; i >= 0; i--) {
      const relic = this.relics[i];
      relic.pulsePhase += dt * 4;

      for (const p of active) {
        const b = this.burglars.get(p.id);
        if (!b || b.stunTimer > 0) continue;

        const isUnderdog = maxScore - b.score >= 35;
        const grabRadius = isUnderdog ? relic.radius + 36 : relic.radius + 20;
        const dist = Math.hypot(b.x - relic.x, b.y - relic.y);

        if (dist < grabRadius) {
          relic.collected = true;
          const mult = Math.min(3.0, 1.0 + b.streakCount * 0.5);
          const pts = Math.floor(relic.value * mult * (isSuddenDeath ? 2 : 1));
          b.score += pts;
          b.streakCount++;
          b.streakTimer = 4.0;
          b.mood = 'triumph';

          this.audio.playScore();
          const col = relic.type === 'star_diamond' ? '#38BDF8' : relic.type === 'scepter' ? '#F43F5E' : '#FBBF24';
          this.particles.emit(relic.x, relic.y, 16, col);
          this.triggerAnnouncement(`${p.name} Snatched ${relic.type.replace('_', ' ').toUpperCase()}! +${pts}`, 0.9);
          break;
        }
      }

      if (relic.collected) {
        this.relics.splice(i, 1);
      }
    }

    // 6. Elastic Museum Body Shunts Between Burglars
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const p1 = active[i];
        const p2 = active[j];
        const b1 = this.burglars.get(p1.id);
        const b2 = this.burglars.get(p2.id);
        if (!b1 || !b2) continue;

        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 34;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;

          const b1Cloaked = b1.isSuperCloaked;
          const b2Cloaked = b2.isSuperCloaked;

          if (b1Cloaked && !b2Cloaked) {
            // B1 shunts B2!
            b2.stunTimer = 0.7;
            b2.score = Math.max(0, b2.score - 10);
            b2.vx = nx * 360;
            b2.vy = ny * 360;
            b2.mood = 'shocked';

            const pts = isSuddenDeath ? 60 : 30;
            b1.score += pts;
            b1.sabotageCount++;
            b1.mood = 'triumph';

            this.screenShake = 11;
            this.hitStopTimer = 0.05;
            this.audio.playBounce();
            this.particles.emit((b1.x + b2.x) / 2, (b1.y + b2.y) / 2, 20, '#38BDF8');
            this.triggerAnnouncement(`MUSEUM BODY SHUNT! +${pts} Sabotage!`, 1.2);
          } else if (b2Cloaked && !b1Cloaked) {
            b1.stunTimer = 0.7;
            b1.score = Math.max(0, b1.score - 10);
            b1.vx = -nx * 360;
            b1.vy = -ny * 360;
            b1.mood = 'shocked';

            const pts = isSuddenDeath ? 60 : 30;
            b2.score += pts;
            b2.sabotageCount++;
            b2.mood = 'triumph';

            this.screenShake = 11;
            this.hitStopTimer = 0.05;
            this.audio.playBounce();
            this.particles.emit((b1.x + b2.x) / 2, (b1.y + b2.y) / 2, 20, '#38BDF8');
            this.triggerAnnouncement(`MUSEUM BODY SHUNT! +${pts} Sabotage!`, 1.2);
          } else {
            const overlap = (minDist - dist) * 0.5;
            b1.x -= nx * overlap;
            b1.y -= ny * overlap;
            b2.x += nx * overlap;
            b2.y += ny * overlap;

            const kx = b1.vx - b2.vx;
            const ky = b1.vy - b2.vy;
            const p = 2 * (nx * kx + ny * ky) / 2;
            b1.vx -= p * nx * 0.8;
            b1.vy -= p * ny * 0.8;
            b2.vx += p * nx * 0.8;
            b2.vy += p * ny * 0.8;

            this.audio.playBounce();
            this.particles.emit((b1.x + b2.x) / 2, (b1.y + b2.y) / 2, 6, '#38BDF8');
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
    const b = this.burglars.get(botId);
    if (!b || b.stunTimer > 0) return;

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

    // Check camera spotlights approaching
    let inSpotlightDanger = false;
    for (const cam of this.cameras) {
      const dx = b.x - cam.x;
      const dy = b.y - cam.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= cam.length) {
        const angleToPlayer = Math.atan2(dy, dx);
        let diff = Math.abs(angleToPlayer - cam.angle);
        while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

        if (diff < cam.coneAngle + 0.08) {
          inSpotlightDanger = true;
          break;
        }
      }
    }

    // Nearest relic
    let nearestRelic: MuseumRelic | null = null;
    let minRelicDist = 260;
    for (const relic of this.relics) {
      const d = Math.hypot(relic.x - b.x, relic.y - b.y);
      if (d < minRelicDist) {
        minRelicDist = d;
        nearestRelic = relic;
      }
    }

    // Hard rival shunting
    let rivalToShunt: CatBurglar | null = null;
    if (difficulty === 'bot_hard') {
      let minRivalDist = 130;
      for (const [id, r] of this.burglars.entries()) {
        if (id !== botId && r.stunTimer <= 0) {
          const d = Math.hypot(r.x - b.x, r.y - b.y);
          if (d < minRivalDist) {
            minRivalDist = d;
            rivalToShunt = r;
          }
        }
      }
    }

    if (inSpotlightDanger && b.cloakTimer <= 0) {
      if (difficulty === 'bot_hard' || (difficulty === 'bot_normal' && Math.random() < 0.75)) {
        // Deploy shadow cloak / carbon freeze!
        if (b.chargeTime >= 0.75 && b.chargeTime <= 0.95) {
          wantAction = false; // Launch cloak!
        } else {
          wantAction = true;
        }
      } else {
        // Easy freezes in place
        wantAction = false;
      }
    } else if (rivalToShunt !== null && difficulty === 'bot_hard' && nearestRelic === null) {
      const targetRival: CatBurglar = rivalToShunt;
      targetX = targetRival.x;
      targetY = targetRival.y;
      if (b.chargeTime >= 0.76 && b.chargeTime <= 0.95) {
        wantAction = false;
      } else {
        wantAction = true;
      }
    } else if (nearestRelic) {
      targetX = nearestRelic.x;
      targetY = nearestRelic.y;
    } else {
      targetX = width / 2 + Math.sin(Date.now() * 0.002) * (width * 0.25);
      targetY = height / 2 + Math.cos(Date.now() * 0.002) * (height * 0.2);
    }

    const dx = targetX - b.x;
    const dy = targetY - b.y;
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

    // 1. Museum Gallery Floor
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = theme.floorColor;
    ctx.fillRect(30, 80, width - 60, height - 140);

    // Marble tile floor grid
    ctx.strokeStyle = theme.gridLineColor;
    ctx.lineWidth = 1;
    for (let x = 30; x <= width - 30; x += 45) {
      ctx.beginPath();
      ctx.moveTo(x, 80);
      ctx.lineTo(x, height - 60);
      ctx.stroke();
    }
    for (let y = 80; y <= height - 60; y += 45) {
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(width - 30, y);
      ctx.stroke();
    }

    // 2. Render CCTV Camera Spotlights
    for (const cam of this.cameras) {
      ctx.save();
      ctx.fillStyle = cam.alert ? theme.spotlightAlert : theme.spotlightColor;
      ctx.beginPath();
      ctx.moveTo(cam.x, cam.y);
      ctx.arc(cam.x, cam.y, cam.length, cam.angle - cam.coneAngle, cam.angle + cam.coneAngle);
      ctx.closePath();
      ctx.fill();

      // Camera Mount & Body
      ctx.fillStyle = '#64748B';
      ctx.beginPath();
      ctx.arc(cam.x, cam.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = cam.alert ? '#EF4444' : '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Lens dot
      ctx.fillStyle = cam.alert ? '#EF4444' : '#22C55E';
      ctx.beginPath();
      ctx.arc(cam.x, cam.y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 3. Render Smoke Clouds
    for (const smk of this.smokeClouds) {
      ctx.save();
      ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.beginPath();
      ctx.arc(smk.x, smk.y, smk.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Render Relics
    for (const relic of this.relics) {
      ctx.save();
      ctx.translate(relic.x, relic.y);
      const bob = Math.sin(relic.pulsePhase) * 3;

      // Pedestal underneath
      ctx.fillStyle = theme.pedestalColor;
      ctx.beginPath();
      ctx.roundRect(-relic.radius, 4, relic.radius * 2, 10, 3);
      ctx.fill();

      if (relic.type === 'star_diamond') {
        // Star of the Nile Diamond
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.moveTo(0, -relic.radius + bob);
        ctx.lineTo(relic.radius, bob);
        ctx.lineTo(0, relic.radius + bob);
        ctx.lineTo(-relic.radius, bob);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#BAE6FD';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (relic.type === 'scepter') {
        // Royal Ruby Scepter
        ctx.fillStyle = '#F43F5E';
        ctx.beginPath();
        ctx.arc(0, bob - 4, relic.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, bob);
        ctx.lineTo(0, bob + 12);
        ctx.stroke();
      } else {
        // Gold Chalice
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(0, bob, relic.radius * 0.8, 0, Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 5. Render Burglars
    const active = this.getActivePlayers();
    let maxScore = -1;
    this.burglars.forEach(b => { if (b.score > maxScore) maxScore = b.score; });

    for (const p of active) {
      const b = this.burglars.get(p.id);
      if (!b) continue;

      const isUnderdog = maxScore - b.score >= 35;
      const isBot = p.type !== 'human';

      ctx.save();
      ctx.translate(b.x, b.y);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 10, 16, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Charge Ring
      if (b.isCharging) {
        const ratio = Math.min(1.0, b.chargeTime / 1.0);
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
          ctx.fillText('CLOAK!', 0, -36);
        }
      }

      // Shadow Cloak visual
      if (b.cloakTimer > 0) {
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Mascot Cat Burglar
      drawCharacter(
        ctx,
        0,
        0,
        14,
        p.id,
        isBot,
        b.mood,
        b.animTimer
      );

      // Underdog Aura
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

    // 6. Strict UI Layout
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
      isSuddenDeath ? `⚡ LOCKDOWN: ${Math.ceil(this.roundTimer)}s ⚡` : `⏱️ ${Math.ceil(this.roundTimer)}s`,
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
    ctx.fillText('📹 CAMERA FREEZE • MUSEUM HEIST', width / 2, badgeY + badgeH / 2);

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
      const b = this.burglars.get(p.id);
      if (!b) return;

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
      ctx.fillText(`${b.score} pts`, cardX + 32, cardY + 34);

      if (b.streakCount > 1) {
        ctx.fillStyle = '#4ADE80';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`x${(1 + (b.streakCount - 1) * 0.5).toFixed(1)}`, cardX + cardW - 8, cardY + 34);
      }
      ctx.restore();
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.burglars.entries()).map(([playerId, b]) => ({
      playerId,
      score: b.score
    }));
    scores.sort((a, b) => b.score - a.score);

    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null
        ? `${this.getPlayer(winnerId)?.name} ghosted past the CCTV security cameras with ${scores[0].score} pts!`
        : 'The museum cameras captured all intruders!'
    };
  }
}
