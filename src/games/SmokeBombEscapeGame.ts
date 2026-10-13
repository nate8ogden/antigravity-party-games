import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface Searchlight {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  sweepAngle: number;
  sweepSpeed: number;
}

interface SmokeCloud {
  x: number;
  y: number;
  radius: number;
  duration: number;
  maxDuration: number;
  color: string;
}

interface ContrabandItem {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'crate' | 'blueprint' | 'black_box';
  value: number;
  radius: number;
  pulsePhase: number;
  collected: boolean;
}

interface Infiltrator {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  chargeTime: number; // 0 to 1.3s
  isCharging: boolean;
  overheatTimer: number; // Cough / dud stun
  stealthTimer: number; // Phantom stealth sprint
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
  isUnderdog: boolean;
  smokeCanisters: number;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  dockFloor: string;
  dockBorder: string;
  lightBeam: string;
  lightCore: string;
  smokeColor: string;
  containerColors: string[];
}

const THEMES: VisualTheme[] = [
  {
    name: 'Midnight Naval Shipyard',
    icon: '⚓',
    bgGradTop: '#0B132B',
    bgGradBottom: '#020617',
    dockFloor: '#1E293B',
    dockBorder: '#334155',
    lightBeam: 'rgba(254, 240, 138, 0.28)',
    lightCore: '#FEF08A',
    smokeColor: 'rgba(148, 163, 184, 0.75)',
    containerColors: ['#B45309', '#1E40AF', '#047857']
  },
  {
    name: 'Neon Cyber Port',
    icon: '🌃',
    bgGradTop: '#17062B',
    bgGradBottom: '#030008',
    dockFloor: '#18122B',
    dockBorder: '#6366F1',
    lightBeam: 'rgba(56, 189, 248, 0.30)',
    lightCore: '#38BDF8',
    smokeColor: 'rgba(192, 132, 252, 0.75)',
    containerColors: ['#EC4899', '#8B5CF6', '#06B6D4']
  },
  {
    name: 'Snowy Arctic Drydock',
    icon: '❄️',
    bgGradTop: '#0F2B48',
    bgGradBottom: '#04111E',
    dockFloor: '#334E68',
    dockBorder: '#9FB3C8',
    lightBeam: 'rgba(253, 224, 71, 0.28)',
    lightCore: '#FDE047',
    smokeColor: 'rgba(226, 232, 240, 0.80)',
    containerColors: ['#486581', '#334E68', '#627D98']
  }
];

export class SmokeBombEscapeGame extends BaseGame {
  private infiltrators: Map<PlayerId, Infiltrator> = new Map();
  private lights: Searchlight[] = [];
  private smokeClouds: SmokeCloud[] = [];
  private contrabandList: ContrabandItem[] = [];
  private nextItemId = 1;
  private itemSpawnTimer = 0;

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
  }

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;

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
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const canvasHeight = canvas.height;
      if (mouseX >= 20 && mouseX <= 190 && mouseY >= canvasHeight - 44 && mouseY <= canvasHeight - 12) {
        this.cycleTheme();
      }
    };
    window.addEventListener('click', this.clickHandler);
  }

  private cycleTheme(): void {
    this.currentThemeIndex = (this.currentThemeIndex + 1) % THEMES.length;
    this.audio.playTap();
    this.triggerAnnouncement(`THEME: ${THEMES[this.currentThemeIndex].name}`);
  }

  private setTheme(index: number): void {
    if (index >= 0 && index < THEMES.length) {
      this.currentThemeIndex = index;
      this.audio.playTap();
      this.triggerAnnouncement(`THEME: ${THEMES[this.currentThemeIndex].name}`);
    }
  }

  private triggerAnnouncement(msg: string, duration: number = 1.6): void {
    this.announcementText = msg;
    this.announcementTimer = duration;
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.smokeClouds = [];
    this.contrabandList = [];
    this.nextItemId = 1;
    this.itemSpawnTimer = 0;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.announcementText = '';
    this.announcementTimer = 0;

    const active = this.getActivePlayers();
    this.infiltrators.clear();
    this.botReactionTimers.clear();

    const spawnY = height - 90;
    const spacing = width / (active.length + 1);

    active.forEach((p, idx) => {
      this.infiltrators.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: spawnY,
        vx: 0,
        vy: 0,
        angle: -Math.PI / 2,
        score: 0,
        chargeTime: 0,
        isCharging: false,
        overheatTimer: 0,
        stealthTimer: 0,
        stunTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: 0,
        sabotageCount: 0,
        isUnderdog: false,
        smokeCanisters: 3
      });
      this.botReactionTimers.set(p.id, 0);
    });

    // Motorized Watchtower Searchlights
    this.lights = [
      {
        x: width * 0.25,
        y: height * 0.35,
        vx: 130,
        vy: 40,
        radius: 65,
        baseRadius: 65,
        sweepAngle: 0,
        sweepSpeed: 1.4
      },
      {
        x: width * 0.75,
        y: height * 0.40,
        vx: -140,
        vy: -35,
        radius: 70,
        baseRadius: 70,
        sweepAngle: Math.PI,
        sweepSpeed: -1.2
      },
      {
        x: width * 0.50,
        y: height * 0.62,
        vx: 110,
        vy: -50,
        radius: 60,
        baseRadius: 60,
        sweepAngle: Math.PI / 2,
        sweepSpeed: 1.6
      }
    ];

    // Seed initial contraband items
    for (let i = 0; i < 6; i++) {
      this.spawnContraband(width, height);
    }
  }

  private spawnContraband(width: number, height: number): void {
    const marginX = 80;
    const minY = 100;
    const maxY = height - 120;

    const x = marginX + Math.random() * (width - marginX * 2);
    const y = minY + Math.random() * (maxY - minY);

    const roll = Math.random();
    let type: 'crate' | 'blueprint' | 'black_box' = 'crate';
    let value = 20;
    let radius = 14;

    if (this.roundTimer <= 12) {
      if (roll < 0.35) {
        type = 'black_box';
        value = 75;
        radius = 18;
      } else if (roll < 0.70) {
        type = 'blueprint';
        value = 45;
        radius = 15;
      }
    } else {
      if (roll < 0.15) {
        type = 'black_box';
        value = 75;
        radius = 18;
      } else if (roll < 0.45) {
        type = 'blueprint';
        value = 45;
        radius = 15;
      }
    }

    this.contrabandList.push({
      id: this.nextItemId++,
      x,
      y,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
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

    if (this.announcementTimer > 0) {
      this.announcementTimer -= dt;
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 30);
    }

    const isSuddenDeath = this.roundTimer <= 12.0;

    // Leader score check for Underdog Surge
    let highestScore = 0;
    for (const inf of this.infiltrators.values()) {
      if (inf.score > highestScore) highestScore = inf.score;
    }
    for (const inf of this.infiltrators.values()) {
      inf.isUnderdog = (highestScore - inf.score) >= 35 && highestScore > 30;
    }

    // Spawn contraband periodically
    this.itemSpawnTimer += dt;
    const spawnInterval = isSuddenDeath ? 0.75 : 1.35;
    const maxItems = isSuddenDeath ? 12 : 8;
    if (this.itemSpawnTimer >= spawnInterval && this.contrabandList.filter(c => !c.collected).length < maxItems) {
      this.itemSpawnTimer = 0;
      this.spawnContraband(width, height);
    }

    // Update Searchlights
    const lightSpeedMult = isSuddenDeath ? 1.5 : 1.0;
    for (const light of this.lights) {
      light.sweepAngle += light.sweepSpeed * lightSpeedMult * dt;
      light.x += light.vx * lightSpeedMult * dt;
      light.y += light.vy * lightSpeedMult * dt;

      // Bounce within bounds
      if (light.x < 70) { light.x = 70; light.vx = Math.abs(light.vx); }
      if (light.x > width - 70) { light.x = width - 70; light.vx = -Math.abs(light.vx); }
      if (light.y < 120) { light.y = 120; light.vy = Math.abs(light.vy); }
      if (light.y > height - 120) { light.y = height - 120; light.vy = -Math.abs(light.vy); }

      light.radius = light.baseRadius + Math.sin(light.sweepAngle) * 10;
    }

    // Update Smoke Clouds
    for (const cloud of this.smokeClouds) {
      cloud.duration -= dt;
    }
    this.smokeClouds = this.smokeClouds.filter(c => c.duration > 0);

    // Update Contraband Items
    for (const item of this.contrabandList) {
      if (item.collected) continue;
      item.pulsePhase += dt * 3.5;
      item.x += item.vx * dt;
      item.y += item.vy * dt;

      if (item.x < 60) { item.x = 60; item.vx = -item.vx; }
      if (item.x > width - 60) { item.x = width - 60; item.vx = -item.vx; }
      if (item.y < 90) { item.y = 90; item.vy = -item.vy; }
      if (item.y > height - 100) { item.y = height - 100; item.vy = -item.vy; }
    }

    this.updateBots(dt, width, height);

    // Update Infiltrators
    for (const inf of this.infiltrators.values()) {
      inf.animTimer += dt;

      if (inf.streakTimer > 0) {
        inf.streakTimer -= dt;
        if (inf.streakTimer <= 0) {
          inf.streakCount = 0;
        }
      }

      if (inf.overheatTimer > 0) {
        inf.overheatTimer -= dt;
        inf.mood = 'shocked';
        inf.vx *= Math.pow(0.05, dt);
        inf.vy *= Math.pow(0.05, dt);
        inf.x += inf.vx * dt;
        inf.y += inf.vy * dt;
        continue;
      }

      if (inf.stunTimer > 0) {
        inf.stunTimer -= dt;
        inf.mood = 'shocked';
        inf.vx *= Math.pow(0.1, dt);
        inf.vy *= Math.pow(0.1, dt);
        inf.x += inf.vx * dt;
        inf.y += inf.vy * dt;
        continue;
      }

      if (inf.stealthTimer > 0) {
        inf.stealthTimer -= dt;
      }

      // Input reading
      const steerX = this.input.getSteer(inf.id);
      const throttleY = -this.input.getThrottle(inf.id);
      const actionHeld = this.input.isActionPressed(inf.id) || this.input.isPressed(inf.id);

      // Movement physics
      let baseSpeed = inf.isUnderdog ? 290 : 240;
      if (inf.stealthTimer > 0) baseSpeed *= 1.35;
      const speed = inf.isCharging ? baseSpeed * 0.45 : baseSpeed;

      if (Math.hypot(steerX, throttleY) > 0.15) {
        const moveAng = Math.atan2(throttleY, steerX);
        inf.angle = moveAng;
        inf.vx += Math.cos(moveAng) * speed * 7.5 * dt;
        inf.vy += Math.sin(moveAng) * speed * 7.5 * dt;
      }

      // Damping
      const damping = Math.pow(0.04, dt);
      inf.vx *= damping;
      inf.vy *= damping;

      inf.x += inf.vx * dt;
      inf.y += inf.vy * dt;

      // Arena boundaries
      const minX = 40;
      const maxX = width - 40;
      const minY = 80;
      const maxY = height - 90;

      if (inf.x < minX) { inf.x = minX; inf.vx = -inf.vx * 0.4; }
      if (inf.x > maxX) { inf.x = maxX; inf.vx = -inf.vx * 0.4; }
      if (inf.y < minY) { inf.y = minY; inf.vy = -inf.vy * 0.4; }
      if (inf.y > maxY) { inf.y = maxY; inf.vy = -inf.vy * 0.4; }

      // Action Charging: Smoke Launcher / Ninja Dash Sweet Spot
      if (actionHeld) {
        inf.isCharging = true;
        inf.chargeTime += dt;
        inf.mood = 'focused';

        // Overcharge penalty (> 1.25s)
        if (inf.chargeTime >= 1.25) {
          inf.chargeTime = 0;
          inf.isCharging = false;
          inf.overheatTimer = 0.85;
          inf.score = Math.max(0, inf.score - 5);
          this.audio.playExplosion();
          this.screenShake = 12;
          this.particles.emit(inf.x, inf.y, 24, '#64748B');
          this.triggerAnnouncement(`${this.getPlayer(inf.id)?.name || 'AGENT'} SMOKE CANISTER MISFIRE!`, 1.2);
          continue;
        }
      } else if (inf.isCharging) {
        // Evaluate Sweet Spot
        const chargeRatio = inf.chargeTime / 1.0;
        const sweetSpotMin = inf.isUnderdog ? 0.50 : 0.72;
        const sweetSpotMax = inf.isUnderdog ? 1.05 : 0.98;

        if (chargeRatio >= sweetSpotMin && chargeRatio <= sweetSpotMax) {
          // SWEET SPOT: Giant Dense Smoke Plume & Phantom Sprint!
          inf.stealthTimer = 2.4;
          inf.mood = 'triumph';
          inf.score += 25; // Stealth Ace Bonus!
          this.audio.playScore();
          this.screenShake = 12;

          // Deploy large persistent smoke cloud
          this.smokeClouds.push({
            x: inf.x,
            y: inf.y,
            radius: 85,
            duration: 3.8,
            maxDuration: 3.8,
            color: THEMES[this.currentThemeIndex].smokeColor
          });

          this.particles.emit(inf.x, inf.y, 35, '#94A3B8');
          this.particles.emit(inf.x, inf.y, 18, '#38BDF8');

          // Supersonic Phantom Dash
          inf.vx += Math.cos(inf.angle) * 340;
          inf.vy += Math.sin(inf.angle) * 340;

          // Blind / stun rivals caught in the blast radius
          for (const other of this.infiltrators.values()) {
            if (other.id === inf.id) continue;
            const dist = Math.hypot(other.x - inf.x, other.y - inf.y);
            if (dist <= 95 && other.stealthTimer <= 0) {
              other.stunTimer = 0.75;
              other.mood = 'shocked';
              const pushAng = Math.atan2(other.y - inf.y, other.x - inf.x);
              other.vx += Math.cos(pushAng) * 260;
              other.vy += Math.sin(pushAng) * 260;
              this.particles.emit(other.x, other.y, 16, '#94A3B8');
            }
          }

          this.triggerAnnouncement(`${this.getPlayer(inf.id)?.name || 'AGENT'} DENSE PHOSPHOR SMOKE! (+25 PTS)`, 1.4);
        } else {
          // Minor smoke burst
          this.smokeClouds.push({
            x: inf.x,
            y: inf.y,
            radius: 50,
            duration: 1.8,
            maxDuration: 1.8,
            color: THEMES[this.currentThemeIndex].smokeColor
          });
          inf.vx += Math.cos(inf.angle) * 170;
          inf.vy += Math.sin(inf.angle) * 170;
          this.audio.playTap();
          this.particles.emit(inf.x, inf.y, 14, '#94A3B8');
        }

        inf.chargeTime = 0;
        inf.isCharging = false;
      } else {
        inf.mood = 'idle';
      }

      // Check In-Smoke Status
      const inSmoke = this.smokeClouds.some(c => Math.hypot(c.x - inf.x, c.y - inf.y) < c.radius);

      // Check Searchlight Detection
      if (!inSmoke && inf.stealthTimer <= 0) {
        for (const light of this.lights) {
          const distToLight = Math.hypot(light.x - inf.x, light.y - inf.y);
          if (distToLight < light.radius) {
            // SPOTTED! Alarm triggers, knocked back, points lost
            inf.stunTimer = 0.8;
            inf.score = Math.max(0, inf.score - 10);
            this.audio.playExplosion();
            this.screenShake = 12;

            const repulseAng = Math.atan2(inf.y - light.y, inf.x - light.x);
            inf.vx = Math.cos(repulseAng) * 280;
            inf.vy = Math.sin(repulseAng) * 280;

            this.particles.emit(inf.x, inf.y, 22, '#EF4444');
            this.triggerAnnouncement(`🚨 ${this.getPlayer(inf.id)?.name || 'AGENT'} SPOTTED IN SEARCHLIGHT! (-10 PTS) 🚨`, 1.2);
            break;
          }
        }
      }

      // Check Contraband Item Collection
      const grabRadius = inf.isUnderdog ? 38 : 28;
      for (const item of this.contrabandList) {
        if (item.collected) continue;
        const dist = Math.hypot(item.x - inf.x, item.y - inf.y);
        if (dist <= grabRadius + item.radius) {
          item.collected = true;
          inf.streakCount++;
          inf.streakTimer = 2.8;

          let multiplier = 1.0;
          if (inf.streakCount >= 4) multiplier = 2.5;
          else if (inf.streakCount >= 3) multiplier = 2.0;
          else if (inf.streakCount >= 2) multiplier = 1.5;

          const pts = Math.round((isSuddenDeath ? item.value * 2 : item.value) * multiplier);
          inf.score += pts;

          this.audio.playTap();
          const col = item.type === 'black_box' ? '#F59E0B' : (item.type === 'blueprint' ? '#38BDF8' : '#10B981');
          this.particles.emit(item.x, item.y, 18, col);

          if (item.type === 'black_box') {
            this.audio.playScore();
            this.triggerAnnouncement(`SECRET BLACK BOX RETRIEVED! +${pts} PTS!`, 1.5);
          }
        }
      }
    }

    // Physical Agent-to-Agent Collision & Dock Shunting
    const agentArr = Array.from(this.infiltrators.values());
    for (let i = 0; i < agentArr.length; i++) {
      for (let j = i + 1; j < agentArr.length; j++) {
        const a1 = agentArr[i];
        const a2 = agentArr[j];

        const dx = a2.x - a1.x;
        const dy = a2.y - a1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 40;

        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;

          const overlap = minDist - dist;
          a1.x -= nx * overlap * 0.5;
          a1.y -= ny * overlap * 0.5;
          a2.x += nx * overlap * 0.5;
          a2.y += ny * overlap * 0.5;

          const rvx = a2.vx - a1.vx;
          const rvy = a2.vy - a1.vy;
          const velAlongNorm = rvx * nx + rvy * ny;

          if (velAlongNorm < 0) {
            const restitution = 1.45;
            const impulse = -(1 + restitution) * velAlongNorm * 0.5;

            a1.vx -= nx * impulse;
            a1.vy -= ny * impulse;
            a2.vx += nx * impulse;
            a2.vy += ny * impulse;

            this.audio.playBounce();

            const speed1 = Math.hypot(a1.vx, a1.vy);
            const speed2 = Math.hypot(a2.vx, a2.vy);

            if (speed1 > speed2 + 80 || a1.stealthTimer > 0) {
              a1.sabotageCount++;
              a1.score += 30; // Tackle Sabotage Bonus
              a2.stunTimer = 0.7;
              a2.score = Math.max(0, a2.score - 10);
              this.particles.emit(a2.x, a2.y, 20, '#F59E0B');
              this.triggerAnnouncement(`${this.getPlayer(a1.id)?.name || 'P1'} DOCK-SHUNTED ${this.getPlayer(a2.id)?.name || 'P2'}! (+30 PTS)`, 1.5);
            } else if (speed2 > speed1 + 80 || a2.stealthTimer > 0) {
              a2.sabotageCount++;
              a2.score += 30;
              a1.stunTimer = 0.7;
              a1.score = Math.max(0, a1.score - 10);
              this.particles.emit(a1.x, a1.y, 20, '#F59E0B');
              this.triggerAnnouncement(`${this.getPlayer(a2.id)?.name || 'P2'} DOCK-SHUNTED ${this.getPlayer(a1.id)?.name || 'P1'}! (+30 PTS)`, 1.5);
            }
          }
        }
      }
    }

    // Clean up collected contraband
    this.contrabandList = this.contrabandList.filter(c => !c.collected);
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const inf = this.infiltrators.get(botId);
    if (!inf || inf.stunTimer > 0 || inf.overheatTimer > 0) return;

    let reactionTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (reactionTimer <= 0) {
      const delay = difficulty === 'bot_hard' ? 0.10 : (difficulty === 'bot_normal' ? 0.23 : 0.42);
      reactionTimer = delay + Math.random() * 0.05;
      this.botReactionTimers.set(botId, reactionTimer);

      const cx = width / 2;
      const cy = height / 2;

      // Find best target contraband
      let bestTarget: { x: number; y: number } | null = null;
      let highestWeight = -1;

      for (const item of this.contrabandList) {
        if (item.collected) continue;
        const dist = Math.hypot(item.x - inf.x, item.y - inf.y);
        let weight = (item.value * 2) - dist * 0.2;
        if (item.type === 'black_box') weight += 70;

        if (weight > highestWeight) {
          highestWeight = weight;
          bestTarget = { x: item.x, y: item.y };
        }
      }

      // Hard bots actively target rivals to tackle/shunt them into searchlights
      if (difficulty === 'bot_hard') {
        for (const other of this.infiltrators.values()) {
          if (other.id === botId) continue;
          const distToOther = Math.hypot(other.x - inf.x, other.y - inf.y);
          if (distToOther < 120 && other.score > inf.score) {
            bestTarget = { x: other.x, y: other.y };
            break;
          }
        }
      }

      // Default wander
      if (!bestTarget) {
        bestTarget = { x: cx + (Math.random() - 0.5) * 250, y: cy + (Math.random() - 0.5) * 200 };
      }

      // Easy blunder
      if (difficulty === 'bot_easy' && Math.random() < 0.22) {
        bestTarget = { x: inf.x + (Math.random() - 0.5) * 150, y: inf.y + (Math.random() - 0.5) * 150 };
      }

      // Check searchlight threat
      let dangerLight = false;
      const inSmoke = this.smokeClouds.some(c => Math.hypot(c.x - inf.x, c.y - inf.y) < c.radius);
      if (!inSmoke && inf.stealthTimer <= 0) {
        for (const light of this.lights) {
          const distToLight = Math.hypot(light.x - inf.x, light.y - inf.y);
          if (distToLight < light.radius + 50) {
            dangerLight = true;
            break;
          }
        }
      }

      let targetAng = Math.atan2(bestTarget.y - inf.y, bestTarget.x - inf.x);

      // If in danger of searchlight and not charging, evade or deploy smoke
      if (dangerLight) {
        // Evade opposite to nearest light
        let closestLight = this.lights[0];
        let minDist = 9999;
        for (const l of this.lights) {
          const d = Math.hypot(l.x - inf.x, l.y - inf.y);
          if (d < minDist) { minDist = d; closestLight = l; }
        }
        targetAng = Math.atan2(inf.y - closestLight.y, inf.x - closestLight.x);
      }

      const steerX = Math.cos(targetAng);
      const throttleY = -Math.sin(targetAng);

      // Action button charge logic
      let shouldAction = false;
      if (dangerLight && !inf.isCharging) {
        shouldAction = true; // Deploy smoke immediately!
      } else if (difficulty === 'bot_hard') {
        const targetDist = Math.hypot(bestTarget.x - inf.x, bestTarget.y - inf.y);
        if (!inf.isCharging && targetDist > 80 && Math.random() < 0.65) {
          shouldAction = true;
        } else if (inf.isCharging) {
          const sweetSpotMin = inf.isUnderdog ? 0.50 : 0.72;
          const sweetSpotMax = inf.isUnderdog ? 1.05 : 0.98;
          const chargeRatio = inf.chargeTime / 1.0;
          if (chargeRatio >= sweetSpotMin && chargeRatio <= sweetSpotMax) {
            shouldAction = false; // Sweet spot release!
          } else {
            shouldAction = true;
          }
        }
      } else if (difficulty === 'bot_normal') {
        if (!inf.isCharging && Math.random() < 0.3) {
          shouldAction = true;
        } else if (inf.isCharging && inf.chargeTime > 0.8) {
          shouldAction = false;
        } else if (inf.isCharging) {
          shouldAction = true;
        }
      }

      this.input.setBotInput(botId, shouldAction, steerX, throttleY);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // Screen Shake
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    const theme = THEMES[this.currentThemeIndex];
    const cx = width / 2;

    // Background Gradient (Dark Night Sea / Sky)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Industrial Dock Floor
    const dockMarginX = 30;
    const dockMarginY = 70;
    const dockW = width - dockMarginX * 2;
    const dockH = height - dockMarginY - 30;

    ctx.fillStyle = theme.dockFloor;
    ctx.fillRect(dockMarginX, dockMarginY, dockW, dockH);

    // Dock Concrete Plank Lines
    ctx.strokeStyle = theme.dockBorder;
    ctx.lineWidth = 1.5;
    for (let y = dockMarginY + 40; y < dockMarginY + dockH; y += 40) {
      ctx.beginPath();
      ctx.moveTo(dockMarginX, y);
      ctx.lineTo(dockMarginX + dockW, y);
      ctx.stroke();
    }

    // Yellow / Black Hazard Chevrons on Dock Border
    ctx.save();
    ctx.beginPath();
    ctx.rect(dockMarginX, dockMarginY, dockW, dockH);
    ctx.clip();

    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 6;
    ctx.setLineDash([16, 16]);
    ctx.strokeRect(dockMarginX + 3, dockMarginY + 3, dockW - 6, dockH - 6);
    ctx.setLineDash([]);
    ctx.restore();

    // Static Shipping Containers (2.5D Obstacles / Atmosphere)
    const containers = [
      { x: dockMarginX + 30, y: dockMarginY + 30, w: 70, h: 40, col: theme.containerColors[0] },
      { x: width - dockMarginX - 100, y: dockMarginY + 30, w: 70, h: 40, col: theme.containerColors[1] },
      { x: dockMarginX + 30, y: height - 120, w: 70, h: 40, col: theme.containerColors[2] },
      { x: width - dockMarginX - 100, y: height - 120, w: 70, h: 40, col: theme.containerColors[0] }
    ];

    for (const c of containers) {
      // Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(c.x + 5, c.y + 6, c.w, c.h);

      // Container Top
      ctx.fillStyle = c.col;
      ctx.fillRect(c.x, c.y, c.w, c.h);

      // Ribs
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 2;
      for (let rx = c.x + 10; rx < c.x + c.w; rx += 14) {
        ctx.beginPath();
        ctx.moveTo(rx, c.y);
        ctx.lineTo(rx, c.y + c.h);
        ctx.stroke();
      }

      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x, c.y, c.w, c.h);
    }

    // Render Watchtower Searchlight Cones & Pools
    for (const light of this.lights) {
      // Outer Ambient Glow
      const glowGrad = ctx.createRadialGradient(light.x, light.y, 10, light.x, light.y, light.radius * 1.3);
      glowGrad.addColorStop(0, theme.lightBeam);
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(light.x, light.y, light.radius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // Sharp Core Spotlight Circle
      ctx.strokeStyle = theme.lightCore;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Spotlight Crosshair lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(light.x - light.radius, light.y);
      ctx.lineTo(light.x + light.radius, light.y);
      ctx.moveTo(light.x, light.y - light.radius);
      ctx.lineTo(light.x, light.y + light.radius);
      ctx.stroke();
    }

    // Render Smoke Clouds
    for (const cloud of this.smokeClouds) {
      const alpha = Math.min(1.0, cloud.duration / (cloud.maxDuration * 0.3));
      ctx.save();
      ctx.fillStyle = cloud.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
      ctx.fill();

      // Puffy smoke lobes
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + Date.now() * 0.001;
        const lobeX = cloud.x + Math.cos(ang) * (cloud.radius * 0.45);
        const lobeY = cloud.y + Math.sin(ang) * (cloud.radius * 0.45);
        ctx.beginPath();
        ctx.arc(lobeX, lobeY, cloud.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Render Contraband Items
    for (const item of this.contrabandList) {
      if (item.collected) continue;

      ctx.save();
      ctx.translate(item.x, item.y);
      const bobY = Math.sin(item.pulsePhase) * 4;
      ctx.translate(0, bobY);

      // Item shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 16 - bobY, item.radius * 0.9, item.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      if (item.type === 'black_box') {
        // Presidential Black Box
        ctx.fillStyle = '#F59E0B';
        ctx.shadowColor = '#FBBF24';
        ctx.shadowBlur = 14;
        ctx.fillRect(-item.radius * 0.8, -item.radius * 0.8, item.radius * 1.6, item.radius * 1.6);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.strokeRect(-item.radius * 0.8, -item.radius * 0.8, item.radius * 1.6, item.radius * 1.6);

        // Blinking beacon LED
        ctx.fillStyle = (Math.sin(Date.now() * 0.015) > 0) ? '#EF4444' : '#10B981';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('75', 0, 16);
      } else if (item.type === 'blueprint') {
        // Glowing Blueprint Roll
        ctx.fillStyle = '#0284C7';
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 10;
        ctx.fillRect(-item.radius, -item.radius * 0.5, item.radius * 2, item.radius);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-item.radius, -item.radius * 0.5, item.radius * 2, item.radius);

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('45', 0, 0);
      } else {
        // Contraband Ammo Crate
        ctx.fillStyle = '#10B981';
        ctx.shadowColor = '#34D399';
        ctx.shadowBlur = 8;
        ctx.fillRect(-item.radius * 0.7, -item.radius * 0.7, item.radius * 1.4, item.radius * 1.4);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-item.radius * 0.7, -item.radius * 0.7, item.radius * 1.4, item.radius * 1.4);

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('20', 0, 0);
      }

      ctx.restore();
    }

    // Render Infiltrators
    for (const inf of this.infiltrators.values()) {
      const pConfig = this.getPlayer(inf.id);
      const isBot = pConfig ? pConfig.type !== 'human' : false;

      ctx.save();
      ctx.translate(inf.x, inf.y);

      // Character Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 18, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Underdog Ghost Cloak Aura
      if (inf.isUnderdog) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 30 + Math.sin(Date.now() * 0.01) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Phantom Stealth Sprint Aura
      if (inf.stealthTimer > 0) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.85)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Mascot Character
      drawCharacter(
        ctx,
        0,
        0,
        18,
        inf.id,
        isBot,
        inf.mood,
        inf.animTimer
      );

      // Facing Direction Arrow / Flashlight
      ctx.save();
      ctx.rotate(inf.angle);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, -4);
      ctx.lineTo(16, 0);
      ctx.lineTo(8, 4);
      ctx.stroke();
      ctx.restore();

      // Hold-to-Charge Smoke Launcher Ring
      if (inf.isCharging) {
        const chargeRatio = Math.min(1.0, inf.chargeTime / 1.0);
        const sweetSpotMin = inf.isUnderdog ? 0.50 : 0.72;
        const sweetSpotMax = inf.isUnderdog ? 1.05 : 0.98;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, 30, sweetSpotMin * Math.PI * 2 - Math.PI / 2, sweetSpotMax * Math.PI * 2 - Math.PI / 2);
        ctx.stroke();

        const isSweet = chargeRatio >= sweetSpotMin && chargeRatio <= sweetSpotMax;
        ctx.strokeStyle = isSweet ? '#F59E0B' : '#94A3B8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 30, -Math.PI / 2, chargeRatio * Math.PI * 2 - Math.PI / 2);
        ctx.stroke();

        ctx.fillStyle = isSweet ? '#F59E0B' : '#FFFFFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(isSweet ? 'DENSE SMOKE!' : 'CHARGING...', 0, -38);
      }

      // Status text
      if (inf.overheatTimer > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('MISFIRE DUD', 0, 34);
      } else if (inf.stunTimer > 0) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SPOTTED STUN', 0, 34);
      }

      ctx.restore();
    }

    // Top Global Timer Safe Zone: y: 12-44, x: width/2 - 80 to width/2 + 80
    // Render Minigame Header Badge at y: 56, h: 28
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.5;
    const badgeW = 390;
    const badgeH = 26;
    ctx.beginPath();
    ctx.roundRect(cx - badgeW / 2, 56, badgeW, badgeH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SMOKE BOMB ESCAPE // SHIPYARD SEARCHLIGHT EVASION', cx, 56 + badgeH / 2);
    ctx.restore();

    // Central Announcement Banner
    if (this.announcementTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      const bW = Math.min(width - 40, 480);
      const bH = 34;
      ctx.beginPath();
      ctx.roundRect(cx - bW / 2, height * 0.28, bW, bH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FCD34D';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.announcementText, cx, height * 0.28 + bH / 2);
      ctx.restore();
    }

    // Sudden Death Pulsing Banner
    if (this.roundTimer <= 12.0) {
      ctx.save();
      const pulseSD = Math.sin(Date.now() * 0.008) > 0;
      ctx.fillStyle = pulseSD ? '#EF4444' : '#F97316';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('🚨 HARBOR LOCKDOWN: DOUBLE CONTRABAND! 🚨', cx, 98);
      ctx.restore();
    }

    // Bottom-Left Theme Pill: x: 20, y: height - 44, w: 170, h: 32
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name} [T]`, 30, height - 28);
    ctx.restore();

    // Corner Player Score Cards: y: height - 128 (130x48px)
    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const inf = this.infiltrators.get(p.id);
      if (!inf) continue;

      let cardX = 20;
      if (i === 1) cardX = width - 150;
      else if (i === 2) cardX = 160;
      else if (i === 3) cardX = width - 290;

      const cardY = height - 128;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = inf.isUnderdog ? '#F59E0B' : p.color;
      ctx.lineWidth = inf.isUnderdog ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 130, 48, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 10, cardY + 16);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`${inf.score} PTS`, cardX + 10, cardY + 36);

      if (inf.streakCount > 1) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${inf.streakCount}x`, cardX + 120, cardY + 36);
      }

      ctx.restore();
    }

    ctx.restore(); // End canvas save
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.infiltrators.get(p.id)?.score || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    const winnerInf = winnerId ? this.infiltrators.get(winnerId) : null;
    let highlight = 'All agents captured by naval searchlights!';
    if (winnerId && winnerInf) {
      const pName = this.getPlayer(winnerId)?.name || 'Agent';
      if (winnerInf.sabotageCount >= 2) {
        highlight = `${pName} shoved rivals into searchlights and escaped with contraband!`;
      } else {
        highlight = `${pName} mastered the smoke clouds with ${winnerInf.score} points!`;
      }
    }

    return {
      winnerId,
      rankings,
      mvpHighlight: highlight
    };
  }

  public override destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) {
        window.removeEventListener('keydown', this.keydownHandler);
      }
      if (this.clickHandler) {
        window.removeEventListener('click', this.clickHandler);
      }
    }
    super.destroy();
  }
}
