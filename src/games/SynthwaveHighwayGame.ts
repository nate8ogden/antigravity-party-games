import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface HighwayLoot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'cassette' | 'keytar' | 'platinum_record';
  value: number;
  radius: number;
  pulsePhase: number;
  collected: boolean;
}

interface SynthDrifter {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  chargeTime: number; // 0 to 1.3s
  isCharging: boolean;
  overheatTimer: number; // Spinout blowout stun
  nitroBoostTimer: number; // Supersonic nitro boost
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
  isUnderdog: boolean;
}

interface VisualTheme {
  name: string;
  icon: string;
  skyGradTop: string;
  skyGradBottom: string;
  roadColor: string;
  roadGrid: string;
  guardrailColor: string;
  sunColor: string;
  sunStripe: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Neon Sunset Strip',
    icon: '🌅',
    skyGradTop: '#1E1B4B',
    skyGradBottom: '#4C1D95',
    roadColor: '#180B26',
    roadGrid: 'rgba(244, 63, 94, 0.35)',
    guardrailColor: '#F43F5E',
    sunColor: '#F59E0B',
    sunStripe: '#4C1D95'
  },
  {
    name: 'Cyberpunk Neo-Tokyo',
    icon: '🏙️',
    skyGradTop: '#090D1F',
    skyGradBottom: '#1E1B4B',
    roadColor: '#0A0F1D',
    roadGrid: 'rgba(56, 189, 248, 0.35)',
    guardrailColor: '#38BDF8',
    sunColor: '#EC4899',
    sunStripe: '#1E1B4B'
  },
  {
    name: 'Electric Miami Vice',
    icon: '🌴',
    skyGradTop: '#042F2E',
    skyGradBottom: '#134E4A',
    roadColor: '#0A1C1A',
    roadGrid: 'rgba(45, 212, 191, 0.35)',
    guardrailColor: '#2DD4BF',
    sunColor: '#FBBF24',
    sunStripe: '#134E4A'
  }
];

export class SynthwaveHighwayGame extends BaseGame {
  private drifters: Map<PlayerId, SynthDrifter> = new Map();
  private lootList: HighwayLoot[] = [];
  private nextLootId = 1;
  private lootSpawnTimer = 0;

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
    this.lootList = [];
    this.nextLootId = 1;
    this.lootSpawnTimer = 0;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.announcementText = '';
    this.announcementTimer = 0;

    const active = this.getActivePlayers();
    this.drifters.clear();
    this.botReactionTimers.clear();

    const cx = width / 2;
    const cy = height / 2;
    const spawnDist = Math.min(width, height) * 0.35;

    active.forEach((p, idx) => {
      const angle = (idx / active.length) * Math.PI * 2 - Math.PI / 2;
      this.drifters.set(p.id, {
        id: p.id,
        x: cx + Math.cos(angle) * spawnDist,
        y: cy + Math.sin(angle) * spawnDist,
        vx: 0,
        vy: 0,
        angle: angle + Math.PI,
        score: 0,
        chargeTime: 0,
        isCharging: false,
        overheatTimer: 0,
        nitroBoostTimer: 0,
        stunTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: 0,
        sabotageCount: 0,
        isUnderdog: false
      });
      this.botReactionTimers.set(p.id, 0);
    });

    // Seed initial highway loot
    for (let i = 0; i < 7; i++) {
      this.spawnLoot(width, height);
    }
  }

  private spawnLoot(width: number, height: number): void {
    const marginX = 80;
    const minY = 100;
    const maxY = height - 120;

    const x = marginX + Math.random() * (width - marginX * 2);
    const y = minY + Math.random() * (maxY - minY);

    const roll = Math.random();
    let type: 'cassette' | 'keytar' | 'platinum_record' = 'cassette';
    let value = 20;
    let radius = 14;

    if (this.roundTimer <= 12) {
      if (roll < 0.35) {
        type = 'platinum_record';
        value = 75;
        radius = 18;
      } else if (roll < 0.70) {
        type = 'keytar';
        value = 45;
        radius = 16;
      }
    } else {
      if (roll < 0.15) {
        type = 'platinum_record';
        value = 75;
        radius = 18;
      } else if (roll < 0.45) {
        type = 'keytar';
        value = 45;
        radius = 16;
      }
    }

    this.lootList.push({
      id: this.nextLootId++,
      x,
      y,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.5) * 14,
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
    for (const d of this.drifters.values()) {
      if (d.score > highestScore) highestScore = d.score;
    }
    for (const d of this.drifters.values()) {
      d.isUnderdog = (highestScore - d.score) >= 35 && highestScore > 30;
    }

    // Spawn loot periodically
    this.lootSpawnTimer += dt;
    const spawnInterval = isSuddenDeath ? 0.7 : 1.3;
    const maxLoot = isSuddenDeath ? 12 : 9;
    if (this.lootSpawnTimer >= spawnInterval && this.lootList.filter(l => !l.collected).length < maxLoot) {
      this.lootSpawnTimer = 0;
      this.spawnLoot(width, height);
    }

    // Update floating loot
    for (const loot of this.lootList) {
      if (loot.collected) continue;
      loot.pulsePhase += dt * 3.5;
      loot.x += loot.vx * dt;
      loot.y += loot.vy * dt;

      // Bounce within bounds
      if (loot.x < 60) { loot.x = 60; loot.vx = -loot.vx; }
      if (loot.x > width - 60) { loot.x = width - 60; loot.vx = -loot.vx; }
      if (loot.y < 90) { loot.y = 90; loot.vy = -loot.vy; }
      if (loot.y > height - 100) { loot.y = height - 100; loot.vy = -loot.vy; }
    }

    this.updateBots(dt, width, height);

    // Update Drifters
    for (const d of this.drifters.values()) {
      d.animTimer += dt;

      if (d.streakTimer > 0) {
        d.streakTimer -= dt;
        if (d.streakTimer <= 0) {
          d.streakCount = 0;
        }
      }

      if (d.overheatTimer > 0) {
        d.overheatTimer -= dt;
        d.mood = 'shocked';
        d.vx *= Math.pow(0.05, dt);
        d.vy *= Math.pow(0.05, dt);
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        continue;
      }

      if (d.stunTimer > 0) {
        d.stunTimer -= dt;
        d.mood = 'shocked';
        d.vx *= Math.pow(0.1, dt);
        d.vy *= Math.pow(0.1, dt);
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        continue;
      }

      if (d.nitroBoostTimer > 0) {
        d.nitroBoostTimer -= dt;
      }

      // Input reading
      const steerX = this.input.getSteer(d.id);
      const throttleY = -this.input.getThrottle(d.id);
      const actionHeld = this.input.isActionPressed(d.id) || this.input.isPressed(d.id);

      // Movement physics
      let baseSpeed = d.isUnderdog ? 295 : 245;
      if (d.nitroBoostTimer > 0) baseSpeed *= 1.45;
      const speed = d.isCharging ? baseSpeed * 0.45 : baseSpeed;

      if (Math.hypot(steerX, throttleY) > 0.15) {
        const moveAng = Math.atan2(throttleY, steerX);
        d.angle = moveAng;
        d.vx += Math.cos(moveAng) * speed * 7.5 * dt;
        d.vy += Math.sin(moveAng) * speed * 7.5 * dt;
      }

      // Kinematic damping
      const damping = Math.pow(0.04, dt);
      d.vx *= damping;
      d.vy *= damping;

      d.x += d.vx * dt;
      d.y += d.vy * dt;

      // Arena boundaries (Highway guardrails)
      const minX = 40;
      const maxX = width - 40;
      const minY = 80;
      const maxY = height - 90;

      if (d.x < minX) { d.x = minX; d.vx = -d.vx * 0.4; }
      if (d.x > maxX) { d.x = maxX; d.vx = -d.vx * 0.4; }
      if (d.y < minY) { d.y = minY; d.vy = -d.vy * 0.4; }
      if (d.y > maxY) { d.y = maxY; d.vy = -d.vy * 0.4; }

      // Action Charging: Turbo Nitrous Burnout Sweet Spot
      if (actionHeld) {
        d.isCharging = true;
        d.chargeTime += dt;
        d.mood = 'focused';

        // Overcharge penalty (> 1.25s)
        if (d.chargeTime >= 1.25) {
          d.chargeTime = 0;
          d.isCharging = false;
          d.overheatTimer = 0.85;
          d.score = Math.max(0, d.score - 5);
          this.audio.playExplosion();
          this.screenShake = 12;
          this.particles.emit(d.x, d.y, 25, '#EF4444');
          this.triggerAnnouncement(`${this.getPlayer(d.id)?.name || 'RACER'} ENGINE BLOWOUT!`, 1.2);
          continue;
        }
      } else if (d.isCharging) {
        // Evaluate Sweet Spot
        const chargeRatio = d.chargeTime / 1.0;
        const sweetSpotMin = d.isUnderdog ? 0.50 : 0.72;
        const sweetSpotMax = d.isUnderdog ? 1.05 : 0.98;

        if (chargeRatio >= sweetSpotMin && chargeRatio <= sweetSpotMax) {
          // SWEET SPOT: Supersonic Neon Nitro Burnout!
          d.nitroBoostTimer = 1.6;
          d.mood = 'triumph';
          d.score += 25; // Drift Ace Bonus!
          this.audio.playScore();
          this.screenShake = 14;

          this.particles.emit(d.x, d.y, 35, '#F43F5E');
          this.particles.emit(d.x, d.y, 20, '#38BDF8');

          // Supersonic rocket dash
          d.vx += Math.cos(d.angle) * 380;
          d.vy += Math.sin(d.angle) * 380;

          // Siphon nearby music tapes within 140px
          const siphonRadius = d.isUnderdog ? 190 : 140;
          let siphonedCount = 0;
          for (const loot of this.lootList) {
            if (loot.collected) continue;
            const dist = Math.hypot(loot.x - d.x, loot.y - d.y);
            if (dist <= siphonRadius) {
              loot.collected = true;
              siphonedCount++;
              const pts = (isSuddenDeath ? loot.value * 2 : loot.value);
              d.score += pts;
              this.particles.emit(loot.x, loot.y, 16, '#F43F5E');
            }
          }

          if (siphonedCount > 0) {
            this.audio.playBounce();
            this.triggerAnnouncement(`${this.getPlayer(d.id)?.name || 'RACER'} NITRO VACUUM (+${siphonedCount} TAPES)!`, 1.4);
          } else {
            this.triggerAnnouncement(`${this.getPlayer(d.id)?.name || 'RACER'} NITRO BURNOUT!`, 1.2);
          }

          // Stun nearby rivals with slipstream burnout
          for (const other of this.drifters.values()) {
            if (other.id === d.id) continue;
            const dist = Math.hypot(other.x - d.x, other.y - d.y);
            if (dist <= 110 && other.nitroBoostTimer <= 0) {
              other.stunTimer = 0.75;
              other.mood = 'shocked';
              const pushAng = Math.atan2(other.y - d.y, other.x - d.x);
              other.vx += Math.cos(pushAng) * 280;
              other.vy += Math.sin(pushAng) * 280;
              this.particles.emit(other.x, other.y, 16, '#F59E0B');
            }
          }
        } else {
          // Minor nitro puff
          d.vx += Math.cos(d.angle) * 160;
          d.vy += Math.sin(d.angle) * 160;
          this.audio.playTap();
          this.particles.emit(d.x, d.y, 12, '#38BDF8');
        }

        d.chargeTime = 0;
        d.isCharging = false;
      } else {
        d.mood = 'idle';
      }

      // Check Loot Pickup
      const grabRadius = d.isUnderdog ? 38 : 28;
      for (const loot of this.lootList) {
        if (loot.collected) continue;
        const dist = Math.hypot(loot.x - d.x, loot.y - d.y);
        if (dist <= grabRadius + loot.radius) {
          loot.collected = true;
          d.streakCount++;
          d.streakTimer = 2.8;

          let multiplier = 1.0;
          if (d.streakCount >= 4) multiplier = 2.5;
          else if (d.streakCount >= 3) multiplier = 2.0;
          else if (d.streakCount >= 2) multiplier = 1.5;

          const pts = Math.round((isSuddenDeath ? loot.value * 2 : loot.value) * multiplier);
          d.score += pts;

          this.audio.playTap();
          const col = loot.type === 'platinum_record' ? '#F59E0B' : (loot.type === 'keytar' ? '#38BDF8' : '#F43F5E');
          this.particles.emit(loot.x, loot.y, 18, col);

          if (loot.type === 'platinum_record') {
            this.audio.playScore();
            this.triggerAnnouncement(`PLATINUM RECORD RETRIEVED! +${pts} PTS!`, 1.5);
          }
        }
      }
    }

    // Physical Car-to-Car Collision & Guardrail Shunts
    const drifterArr = Array.from(this.drifters.values());
    for (let i = 0; i < drifterArr.length; i++) {
      for (let j = i + 1; j < drifterArr.length; j++) {
        const d1 = drifterArr[i];
        const d2 = drifterArr[j];

        const dx = d2.x - d1.x;
        const dy = d2.y - d1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 40;

        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;

          const overlap = minDist - dist;
          d1.x -= nx * overlap * 0.5;
          d1.y -= ny * overlap * 0.5;
          d2.x += nx * overlap * 0.5;
          d2.y += ny * overlap * 0.5;

          const rvx = d2.vx - d1.vx;
          const rvy = d2.vy - d1.vy;
          const velAlongNorm = rvx * nx + rvy * ny;

          if (velAlongNorm < 0) {
            const restitution = 1.45;
            const impulse = -(1 + restitution) * velAlongNorm * 0.5;

            d1.vx -= nx * impulse;
            d1.vy -= ny * impulse;
            d2.vx += nx * impulse;
            d2.vy += ny * impulse;

            this.audio.playBounce();

            const speed1 = Math.hypot(d1.vx, d1.vy);
            const speed2 = Math.hypot(d2.vx, d2.vy);

            if (speed1 > speed2 + 80 || d1.nitroBoostTimer > 0) {
              d1.sabotageCount++;
              d1.score += 30; // Guardrail Shunt Sabotage Bonus
              d2.stunTimer = 0.7;
              d2.score = Math.max(0, d2.score - 10);
              this.particles.emit(d2.x, d2.y, 20, '#F59E0B');
              this.triggerAnnouncement(`${this.getPlayer(d1.id)?.name || 'P1'} HIGHWAY-SHUNTED ${this.getPlayer(d2.id)?.name || 'P2'}! (+30 PTS)`, 1.5);
            } else if (speed2 > speed1 + 80 || d2.nitroBoostTimer > 0) {
              d2.sabotageCount++;
              d2.score += 30;
              d1.stunTimer = 0.7;
              d1.score = Math.max(0, d1.score - 10);
              this.particles.emit(d1.x, d1.y, 20, '#F59E0B');
              this.triggerAnnouncement(`${this.getPlayer(d2.id)?.name || 'P2'} HIGHWAY-SHUNTED ${this.getPlayer(d1.id)?.name || 'P1'}! (+30 PTS)`, 1.5);
            }
          }
        }
      }
    }

    // Clean up collected loot
    this.lootList = this.lootList.filter(l => !l.collected);
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const d = this.drifters.get(botId);
    if (!d || d.stunTimer > 0 || d.overheatTimer > 0) return;

    let reactionTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (reactionTimer <= 0) {
      const delay = difficulty === 'bot_hard' ? 0.10 : (difficulty === 'bot_normal' ? 0.23 : 0.42);
      reactionTimer = delay + Math.random() * 0.05;
      this.botReactionTimers.set(botId, reactionTimer);

      const cx = width / 2;
      const cy = height / 2;

      // Find best target highway loot
      let bestTarget: { x: number; y: number } | null = null;
      let highestWeight = -1;

      for (const loot of this.lootList) {
        if (loot.collected) continue;
        const dist = Math.hypot(loot.x - d.x, loot.y - d.y);
        let weight = (loot.value * 2) - dist * 0.2;
        if (loot.type === 'platinum_record') weight += 70;

        if (weight > highestWeight) {
          highestWeight = weight;
          bestTarget = { x: loot.x, y: loot.y };
        }
      }

      // Hard bots actively hunt rivals to highway-shunt them
      if (difficulty === 'bot_hard') {
        for (const other of this.drifters.values()) {
          if (other.id === botId) continue;
          const distToOther = Math.hypot(other.x - d.x, other.y - d.y);
          if (distToOther < 120 && other.score > d.score) {
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
        bestTarget = { x: d.x + (Math.random() - 0.5) * 150, y: d.y + (Math.random() - 0.5) * 150 };
      }

      const targetAng = Math.atan2(bestTarget.y - d.y, bestTarget.x - d.x);
      const steerX = Math.cos(targetAng);
      const throttleY = -Math.sin(targetAng);

      // Action button charge logic
      let shouldAction = false;
      const targetDist = Math.hypot(bestTarget.x - d.x, bestTarget.y - d.y);

      if (difficulty === 'bot_hard') {
        if (!d.isCharging && targetDist > 80 && Math.random() < 0.65) {
          shouldAction = true;
        } else if (d.isCharging) {
          const sweetSpotMin = d.isUnderdog ? 0.50 : 0.72;
          const sweetSpotMax = d.isUnderdog ? 1.05 : 0.98;
          const chargeRatio = d.chargeTime / 1.0;
          if (chargeRatio >= sweetSpotMin && chargeRatio <= sweetSpotMax) {
            shouldAction = false; // Sweet spot release!
          } else {
            shouldAction = true;
          }
        }
      } else if (difficulty === 'bot_normal') {
        if (!d.isCharging && Math.random() < 0.3) {
          shouldAction = true;
        } else if (d.isCharging && d.chargeTime > 0.8) {
          shouldAction = false;
        } else if (d.isCharging) {
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
    const cy = height / 2;

    // Background Gradient (Synthwave Sunset / Horizon)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.skyGradTop);
    bgGrad.addColorStop(1, theme.skyGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Giant Striped Retrowave Sun on Horizon
    const sunRadius = 70;
    const sunX = cx;
    const sunY = height * 0.28;

    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = theme.sunColor;
    ctx.fillRect(sunX - sunRadius, sunY - sunRadius, sunRadius * 2, sunRadius * 2);

    // Horizontal Sun Blinds / Stripes
    ctx.fillStyle = theme.sunStripe;
    for (let sy = sunY - 20; sy < sunY + sunRadius; sy += 12) {
      const h = ((sy - sunY + 20) / (sunRadius + 20)) * 6 + 2;
      ctx.fillRect(sunX - sunRadius, sy, sunRadius * 2, h);
    }
    ctx.restore();

    // 2.5D Synthwave Highway Arena
    const roadMarginX = 30;
    const roadMarginY = 70;
    const roadW = width - roadMarginX * 2;
    const roadH = height - roadMarginY - 30;

    ctx.fillStyle = theme.roadColor;
    ctx.fillRect(roadMarginX, roadMarginY, roadW, roadH);

    // Neon Highway Grid Lines
    ctx.strokeStyle = theme.roadGrid;
    ctx.lineWidth = 1.5;
    for (let x = roadMarginX + 45; x < roadMarginX + roadW; x += 45) {
      ctx.beginPath();
      ctx.moveTo(x, roadMarginY);
      ctx.lineTo(x, roadMarginY + roadH);
      ctx.stroke();
    }
    for (let y = roadMarginY + 45; y < roadMarginY + roadH; y += 45) {
      ctx.beginPath();
      ctx.moveTo(roadMarginX, y);
      ctx.lineTo(roadMarginX + roadW, y);
      ctx.stroke();
    }

    // Glowing Neon Highway Guardrails
    ctx.strokeStyle = theme.guardrailColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(roadMarginX + 4, roadMarginY + 4, roadW - 8, roadH - 8);

    // Render Floating Highway Loot
    for (const loot of this.lootList) {
      if (loot.collected) continue;

      ctx.save();
      ctx.translate(loot.x, loot.y);
      const bobY = Math.sin(loot.pulsePhase) * 4;
      ctx.translate(0, bobY);

      // Loot shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 18 - bobY, loot.radius * 0.9, loot.radius * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      if (loot.type === 'platinum_record') {
        // Platinum Vinyl Record
        ctx.fillStyle = '#F59E0B';
        ctx.shadowColor = '#FBBF24';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, loot.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Vinyl Grooves
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, loot.radius * 0.6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('75', 0, 0);
      } else if (loot.type === 'keytar') {
        // Synthesizer Keytar
        ctx.fillStyle = '#06B6D4';
        ctx.shadowColor = '#22D3EE';
        ctx.shadowBlur = 10;
        ctx.fillRect(-loot.radius, -loot.radius * 0.6, loot.radius * 2, loot.radius * 1.2);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-loot.radius, -loot.radius * 0.6, loot.radius * 2, loot.radius * 1.2);

        // White piano keys
        ctx.fillStyle = '#FFFFFF';
        for (let k = -loot.radius + 3; k < loot.radius - 3; k += 5) {
          ctx.fillRect(k, -loot.radius * 0.4, 3, loot.radius * 0.8);
        }

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('45', 0, 16);
      } else {
        // Digital Audio Cassette
        ctx.fillStyle = '#F43F5E';
        ctx.shadowColor = '#FB7185';
        ctx.shadowBlur = 8;
        ctx.fillRect(-loot.radius * 0.9, -loot.radius * 0.6, loot.radius * 1.8, loot.radius * 1.2);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-loot.radius * 0.9, -loot.radius * 0.6, loot.radius * 1.8, loot.radius * 1.2);

        // Cassette reel holes
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(-loot.radius * 0.4, 0, 3, 0, Math.PI * 2);
        ctx.arc(loot.radius * 0.4, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('20', 0, 0);
      }

      ctx.restore();
    }

    // Render Drifters
    for (const d of this.drifters.values()) {
      const pConfig = this.getPlayer(d.id);
      const isBot = pConfig ? pConfig.type !== 'human' : false;

      ctx.save();
      ctx.translate(d.x, d.y);

      // Character Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 18, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Underdog Slipstream Aura
      if (d.isUnderdog) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 30 + Math.sin(Date.now() * 0.01) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Nitro Burnout Aura
      if (d.nitroBoostTimer > 0) {
        ctx.strokeStyle = '#F43F5E';
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
        d.id,
        isBot,
        d.mood,
        d.animTimer
      );

      // Retro Car Hood Facing Direction
      ctx.save();
      ctx.rotate(d.angle);
      ctx.strokeStyle = '#F43F5E';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, -4);
      ctx.lineTo(16, 0);
      ctx.lineTo(8, 4);
      ctx.stroke();
      ctx.restore();

      // Hold-to-Charge Nitro Ring
      if (d.isCharging) {
        const chargeRatio = Math.min(1.0, d.chargeTime / 1.0);
        const sweetSpotMin = d.isUnderdog ? 0.50 : 0.72;
        const sweetSpotMax = d.isUnderdog ? 1.05 : 0.98;

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
        ctx.strokeStyle = isSweet ? '#F59E0B' : '#F43F5E';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 30, -Math.PI / 2, chargeRatio * Math.PI * 2 - Math.PI / 2);
        ctx.stroke();

        ctx.fillStyle = isSweet ? '#F59E0B' : '#FFFFFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(isSweet ? 'NITRO READY!' : 'CHARGING...', 0, -38);
      }

      // Status text
      if (d.overheatTimer > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ENGINE BLOWOUT', 0, 34);
      } else if (d.stunTimer > 0) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SPINOUT STUN', 0, 34);
      }

      ctx.restore();
    }

    // Top Global Timer Safe Zone: y: 12-44, x: width/2 - 80 to width/2 + 80
    // Render Minigame Header Badge at y: 56, h: 28
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#F43F5E';
    ctx.lineWidth = 1.5;
    const badgeW = 390;
    const badgeH = 26;
    ctx.beginPath();
    ctx.roundRect(cx - badgeW / 2, 56, badgeW, badgeH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FB7185';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SYNTHWAVE HIGHWAY // OUTRUN DRIFT BRAWL', cx, 56 + badgeH / 2);
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
      ctx.fillText('⚡ OUTRUN TURBO HORIZON: DOUBLE TAPE SCORES! ⚡', cx, 98);
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
      const d = this.drifters.get(p.id);
      if (!d) continue;

      let cardX = 20;
      if (i === 1) cardX = width - 150;
      else if (i === 2) cardX = 160;
      else if (i === 3) cardX = width - 290;

      const cardY = height - 128;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = d.isUnderdog ? '#F59E0B' : p.color;
      ctx.lineWidth = d.isUnderdog ? 2.5 : 1.5;
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
      ctx.fillText(`${d.score} PTS`, cardX + 10, cardY + 36);

      if (d.streakCount > 1) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${d.streakCount}x`, cardX + 120, cardY + 36);
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
        score: this.drifters.get(p.id)?.score || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    const winnerD = winnerId ? this.drifters.get(winnerId) : null;
    let highlight = 'The synthwave sunset faded into purple twilight!';
    if (winnerId && winnerD) {
      const pName = this.getPlayer(winnerId)?.name || 'Drifter';
      if (winnerD.sabotageCount >= 2) {
        highlight = `${pName} highway-shunted rivals into the guardrails and drifted to victory!`;
      } else {
        highlight = `${pName} conquered the neon superhighway with an outrun score of ${winnerD.score}!`;
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
