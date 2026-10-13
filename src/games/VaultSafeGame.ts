import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface VaultLoot {
  id: number;
  type: 'gold_bar' | 'diamond_necklace' | 'platinum_bond';
  value: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pulsePhase: number;
  collected: boolean;
}

interface SafecrackerPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  tumblerCount: number;
  chargeTime: number; // 0 to 1.3s
  isCharging: boolean;
  overheatTimer: number;
  crackTimer: number;
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  vaultMetal: string;
  vaultTrim: string;
  dialColor: string;
  dialAccent: string;
  floorColor: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Federal Reserve Vault',
    icon: '🏛️',
    bgGradTop: '#1E293B',
    bgGradBottom: '#020617',
    vaultMetal: '#334155',
    vaultTrim: '#F59E0B',
    dialColor: '#D97706',
    dialAccent: '#FEF08A',
    floorColor: '#0F172A'
  },
  {
    name: 'Swiss Cyber Depository',
    icon: '🇨🇭',
    bgGradTop: '#0F172A',
    bgGradBottom: '#020617',
    vaultMetal: '#1E293B',
    vaultTrim: '#38BDF8',
    dialColor: '#0284C7',
    dialAccent: '#BAE6FD',
    floorColor: '#090D16'
  },
  {
    name: 'Old West Bank Bastion',
    icon: '🤠',
    bgGradTop: '#451A03',
    bgGradBottom: '#1C0A00',
    vaultMetal: '#78350F',
    vaultTrim: '#FBBF24',
    dialColor: '#92400E',
    dialAccent: '#FDE68A',
    floorColor: '#291003'
  }
];

export class VaultSafeGame extends BaseGame {
  private crackers: Map<PlayerId, SafecrackerPlayer> = new Map();
  private loots: VaultLoot[] = [];
  private nextEntityId = 1;

  // Giant Central Safe Door
  private safeX = 400;
  private safeY = 300;
  private safeRadius = 110;
  private dialAngle = 0;
  private totalTumblersPopped = 0;
  private doorOpenProgress = 0;

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
    this.crackers.clear();
    this.loots = [];
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.announcementText = '';
    this.announcementTimer = 0;
    this.totalTumblersPopped = 0;
    this.doorOpenProgress = 0;
    this.dialAngle = 0;
    this.lootSpawnTimer = 0.5;
    this.botReactionTimers.clear();

    this.safeX = width / 2;
    this.safeY = height / 2 + 10;
    this.safeRadius = Math.min(width, height) * 0.22;

    const active = this.getActivePlayers();
    const count = active.length;
    const spawnDist = this.safeRadius + 65;

    for (let i = 0; i < count; i++) {
      const p = active[i];
      const angle = (i * 2 * Math.PI) / count - Math.PI / 2;
      const x = this.safeX + Math.cos(angle) * spawnDist;
      const y = this.safeY + Math.sin(angle) * spawnDist;

      this.crackers.set(p.id, {
        id: p.id,
        x,
        y,
        vx: 0,
        vy: 0,
        angle: angle + Math.PI,
        score: 0,
        tumblerCount: 0,
        chargeTime: 0,
        isCharging: false,
        overheatTimer: 0,
        crackTimer: 0,
        stunTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: 0,
        sabotageCount: 0
      });
      this.botReactionTimers.set(p.id, 0);
    }

    // Seed initial loose loot near the safe
    for (let i = 0; i < 6; i++) {
      this.spawnLoot(width, height);
    }
  }

  private spawnLoot(width: number, height: number): void {
    const isSuddenDeath = this.roundTimer <= 12.0;
    const angle = Math.random() * Math.PI * 2;
    const dist = this.safeRadius + 30 + Math.random() * (Math.min(width, height) * 0.22);

    const roll = Math.random();
    let type: 'gold_bar' | 'diamond_necklace' | 'platinum_bond' = 'gold_bar';
    let value = 20;
    let radius = 13;

    if (isSuddenDeath && roll < 0.25) {
      type = 'platinum_bond';
      value = 75;
      radius = 18;
    } else if (roll < 0.45) {
      type = 'diamond_necklace';
      value = 45;
      radius = 15;
    }

    this.loots.push({
      id: this.nextEntityId++,
      type,
      value,
      x: this.safeX + Math.cos(angle) * dist,
      y: this.safeY + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 40,
      vy: (Math.random() - 0.5) * 40,
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

    // Highest score for Underdog
    let maxScore = -1;
    this.crackers.forEach(c => { if (c.score > maxScore) maxScore = c.score; });

    // 1. Spawner
    this.lootSpawnTimer -= dt;
    if (this.lootSpawnTimer <= 0 && this.loots.length < 12) {
      this.lootSpawnTimer = (isSuddenDeath ? 0.6 : 1.2) + Math.random() * 0.4;
      this.spawnLoot(width, height);
    }

    // 2. Dial rotation
    this.dialAngle += dt * 0.8;

    // 3. Update Crackers
    const active = this.getActivePlayers();
    for (const p of active) {
      const c = this.crackers.get(p.id);
      if (!c) continue;

      c.animTimer += dt;

      if (c.crackTimer > 0) {
        c.crackTimer -= dt;
      }
      if (c.streakTimer > 0) {
        c.streakTimer -= dt;
        if (c.streakTimer <= 0) {
          c.streakCount = 0;
        }
      }

      // Stun
      if (c.stunTimer > 0) {
        c.stunTimer -= dt;
        c.vx *= 0.88;
        c.vy *= 0.88;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.mood = 'shocked';
        continue;
      }

      if (c.overheatTimer > 0) {
        c.overheatTimer -= dt;
      }

      const isUnderdog = maxScore - c.score >= 35;

      // Inputs
      const steerX = this.input.getSteer(p.id);
      const throttleY = -this.input.getThrottle(p.id);
      const actionPressed = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      // Movement
      let maxSpeed = 220;
      let accel = 750;
      if (isUnderdog) {
        maxSpeed *= 1.25;
        accel *= 1.25;
      }

      if (steerX !== 0 || throttleY !== 0) {
        c.vx += steerX * accel * dt;
        c.vy += throttleY * accel * dt;
        c.angle = Math.atan2(throttleY, steerX);
      } else {
        c.vx *= 0.90;
        c.vy *= 0.90;
      }

      const curSpeed = Math.hypot(c.vx, c.vy);
      if (curSpeed > maxSpeed) {
        c.vx = (c.vx / curSpeed) * maxSpeed;
        c.vy = (c.vy / curSpeed) * maxSpeed;
      }

      c.x += c.vx * dt;
      c.y += c.vy * dt;

      // Keep within arena bounds
      const pad = 38;
      c.x = Math.max(pad, Math.min(width - pad, c.x));
      c.y = Math.max(pad + 50, Math.min(height - pad, c.y));

      // Constrain outside safe body
      const distToSafe = Math.hypot(c.x - this.safeX, c.y - this.safeY);
      const minSafeDist = this.safeRadius + 18;
      if (distToSafe < minSafeDist) {
        const pushAngle = Math.atan2(c.y - this.safeY, c.x - this.safeX);
        c.x = this.safeX + Math.cos(pushAngle) * minSafeDist;
        c.y = this.safeY + Math.sin(pushAngle) * minSafeDist;
        c.vx += Math.cos(pushAngle) * 80;
        c.vy += Math.sin(pushAngle) * 80;
      }

      // Hold-to-Charge Stethoscope Safe Crack Sweet Spot (72%–98%)
      if (c.overheatTimer <= 0 && c.stunTimer <= 0) {
        if (actionPressed) {
          c.isCharging = true;
          c.chargeTime += dt;
          c.mood = 'focused';

          if (Math.random() < 0.3) {
            this.particles.emit(c.x, c.y, 2, '#FBBF24');
          }

          if (c.chargeTime > 1.25) {
            // Overheat slip
            c.isCharging = false;
            c.chargeTime = 0;
            c.overheatTimer = 0.85;
            c.stunTimer = 0.6;
            c.mood = 'shocked';
            this.audio.playBounce();
            this.particles.emit(c.x, c.y, 14, '#EF4444');
            this.triggerAnnouncement(`${p.name}'s Stethoscope Slipped!`, 1.1);
          }
        } else if (!actionPressed && c.isCharging) {
          c.isCharging = false;
          const ratio = c.chargeTime / 1.0;
          const sweetMin = isUnderdog ? 0.50 : 0.72;
          const sweetMax = isUnderdog ? 1.05 : 0.98;

          c.crackTimer = 0.35;

          if (ratio >= sweetMin && ratio <= sweetMax) {
            // PRECISION TUMBLER POP ACE!
            c.mood = 'triumph';
            c.streakCount++;
            c.streakTimer = 4.0;
            c.tumblerCount++;
            this.totalTumblersPopped++;

            const streakMult = Math.min(3.0, 1.0 + (c.streakCount - 1) * 0.5);
            const aceBonus = Math.floor(25 * streakMult * (isSuddenDeath ? 2 : 1));
            c.score += aceBonus;

            this.screenShake = 10;
            this.audio.playFanfare();
            this.particles.emit(this.safeX, this.safeY, 20, '#F59E0B');

            // Burst loose loot from safe!
            for (let k = 0; k < 2; k++) {
              this.spawnLoot(width, height);
            }
            this.triggerAnnouncement(`★ TUMBLER POP ACE! +${aceBonus} ★`, 1.3);
          } else {
            // Minor dial click
            this.audio.playTap();
            c.score += isSuddenDeath ? 10 : 5;
            c.mood = 'idle';
          }
          c.chargeTime = 0;
        }
      }

      if (!c.isCharging && c.stunTimer <= 0 && c.crackTimer <= 0) {
        c.mood = 'idle';
      }
    }

    // 4. Update Loots & Collection
    for (let i = this.loots.length - 1; i >= 0; i--) {
      const loot = this.loots[i];
      loot.x += loot.vx * dt;
      loot.y += loot.vy * dt;
      loot.vx *= 0.95;
      loot.vy *= 0.95;
      loot.pulsePhase += dt * 4;

      for (const p of active) {
        const c = this.crackers.get(p.id);
        if (!c || c.stunTimer > 0) continue;

        const isUnderdog = maxScore - c.score >= 35;
        const grabRadius = isUnderdog ? loot.radius + 36 : loot.radius + 20;
        const dist = Math.hypot(c.x - loot.x, c.y - loot.y);

        if (dist < grabRadius) {
          loot.collected = true;
          const mult = Math.min(3.0, 1.0 + c.streakCount * 0.5);
          const pts = Math.floor(loot.value * mult * (isSuddenDeath ? 2 : 1));
          c.score += pts;
          c.streakCount++;
          c.streakTimer = 4.0;
          c.mood = 'triumph';

          this.audio.playScore();
          const col = loot.type === 'platinum_bond' ? '#C084FC' : loot.type === 'diamond_necklace' ? '#38BDF8' : '#F59E0B';
          this.particles.emit(loot.x, loot.y, 16, col);
          this.triggerAnnouncement(`${p.name} Snatched ${loot.type.replace('_', ' ').toUpperCase()}! +${pts}`, 0.9);
          break;
        }
      }

      if (loot.collected) {
        this.loots.splice(i, 1);
      }
    }

    // 5. Elastic Shoulder Ram Shunts Between Safecrackers
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const p1 = active[i];
        const p2 = active[j];
        const c1 = this.crackers.get(p1.id);
        const c2 = this.crackers.get(p2.id);
        if (!c1 || !c2) continue;

        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 34;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;

          const c1Cracking = c1.crackTimer > 0;
          const c2Cracking = c2.crackTimer > 0;

          if (c1Cracking && !c2Cracking) {
            // C1 rams C2!
            c2.stunTimer = 0.7;
            c2.score = Math.max(0, c2.score - 10);
            c2.vx = nx * 340;
            c2.vy = ny * 340;
            c2.mood = 'shocked';

            const pts = isSuddenDeath ? 60 : 30;
            c1.score += pts;
            c1.sabotageCount++;
            c1.mood = 'triumph';

            // Spill loot onto the vault floor!
            this.spawnLoot(width, height);

            this.screenShake = 11;
            this.hitStopTimer = 0.05;
            this.audio.playBounce();
            this.particles.emit((c1.x + c2.x) / 2, (c1.y + c2.y) / 2, 20, '#F59E0B');
            this.triggerAnnouncement(`VAULT SHOULDER RAM! +${pts} Sabotage!`, 1.2);
          } else if (c2Cracking && !c1Cracking) {
            c1.stunTimer = 0.7;
            c1.score = Math.max(0, c1.score - 10);
            c1.vx = -nx * 340;
            c1.vy = -ny * 340;
            c1.mood = 'shocked';

            const pts = isSuddenDeath ? 60 : 30;
            c2.score += pts;
            c2.sabotageCount++;
            c2.mood = 'triumph';

            this.spawnLoot(width, height);

            this.screenShake = 11;
            this.hitStopTimer = 0.05;
            this.audio.playBounce();
            this.particles.emit((c1.x + c2.x) / 2, (c1.y + c2.y) / 2, 20, '#F59E0B');
            this.triggerAnnouncement(`VAULT SHOULDER RAM! +${pts} Sabotage!`, 1.2);
          } else {
            const overlap = (minDist - dist) * 0.5;
            c1.x -= nx * overlap;
            c1.y -= ny * overlap;
            c2.x += nx * overlap;
            c2.y += ny * overlap;

            const kx = c1.vx - c2.vx;
            const ky = c1.vy - c2.vy;
            const p = 2 * (nx * kx + ny * ky) / 2;
            c1.vx -= p * nx * 0.8;
            c1.vy -= p * ny * 0.8;
            c2.vx += p * nx * 0.8;
            c2.vy += p * ny * 0.8;

            this.audio.playBounce();
            this.particles.emit((c1.x + c2.x) / 2, (c1.y + c2.y) / 2, 6, '#FBBF24');
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
    const c = this.crackers.get(botId);
    if (!c || c.stunTimer > 0) return;

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

    let targetX = this.safeX;
    let targetY = this.safeY;
    let wantAction = false;

    // Nearest loot
    let nearestLoot: VaultLoot | null = null;
    let minLootDist = 220;
    for (const loot of this.loots) {
      const d = Math.hypot(loot.x - c.x, loot.y - c.y);
      if (d < minLootDist) {
        minLootDist = d;
        nearestLoot = loot;
      }
    }

    // Hard rival shunting
    let rivalToShunt: SafecrackerPlayer | null = null;
    if (difficulty === 'bot_hard') {
      let minRivalDist = 130;
      for (const [id, r] of this.crackers.entries()) {
        if (id !== botId && r.stunTimer <= 0) {
          const d = Math.hypot(r.x - c.x, r.y - c.y);
          if (d < minRivalDist) {
            minRivalDist = d;
            rivalToShunt = r;
          }
        }
      }
    }

    const distToSafe = Math.hypot(c.x - this.safeX, c.y - this.safeY);

    if (rivalToShunt !== null && difficulty === 'bot_hard' && nearestLoot === null) {
      const targetRival: SafecrackerPlayer = rivalToShunt;
      targetX = targetRival.x;
      targetY = targetRival.y;
      if (c.chargeTime >= 0.76 && c.chargeTime <= 0.95) {
        wantAction = false;
      } else {
        wantAction = true;
      }
    } else if (nearestLoot) {
      targetX = nearestLoot.x;
      targetY = nearestLoot.y;
    } else if (distToSafe < this.safeRadius + 50) {
      // Near safe: listen & crack tumblers!
      targetX = this.safeX;
      targetY = this.safeY;
      if (difficulty === 'bot_hard') {
        if (c.chargeTime >= 0.75 && c.chargeTime <= 0.95) wantAction = false;
        else wantAction = true;
      } else if (difficulty === 'bot_normal') {
        wantAction = c.chargeTime < 0.75;
      } else {
        wantAction = Math.random() < 0.45;
      }
    } else {
      // Approach safe dial
      targetX = this.safeX;
      targetY = this.safeY;
    }

    const dx = targetX - c.x;
    const dy = targetY - c.y;
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

    // 1. Vault Floor
    const bgGrad = ctx.createRadialGradient(this.safeX, this.safeY, 50, this.safeX, this.safeY, Math.max(width, height));
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Floor plates
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Giant Round Vault Safe Door in Center
    ctx.save();
    ctx.translate(this.safeX, this.safeY);

    // Outer safe rim & massive steel bolts
    ctx.fillStyle = theme.vaultMetal;
    ctx.beginPath();
    ctx.arc(0, 0, this.safeRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = theme.vaultTrim;
    ctx.lineWidth = 8;
    ctx.stroke();

    // 8 Radial Locking Bolts
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(this.safeRadius - 10, -6, 22, 12);
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.safeRadius - 10, -6, 22, 12);
      ctx.restore();
    }

    // Inner Combination Dial
    ctx.save();
    ctx.rotate(this.dialAngle);
    ctx.fillStyle = theme.dialColor;
    ctx.beginPath();
    ctx.arc(0, 0, this.safeRadius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.dialAccent;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Dial tick marks
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    for (let d = 0; d < Math.PI * 2; d += Math.PI / 6) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(d) * (this.safeRadius * 0.42), Math.sin(d) * (this.safeRadius * 0.42));
      ctx.lineTo(Math.cos(d) * (this.safeRadius * 0.52), Math.sin(d) * (this.safeRadius * 0.52));
      ctx.stroke();
    }
    ctx.restore();

    // Central Vault Handle / Wheel
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.dialAccent;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Tumbler Status indicator
    ctx.fillStyle = '#FDE047';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.totalTumblersPopped} POPS`, 0, 32);

    ctx.restore();

    // 3. Render Vault Loot
    for (const loot of this.loots) {
      ctx.save();
      ctx.translate(loot.x, loot.y);
      const bob = Math.sin(loot.pulsePhase) * 3;

      if (loot.type === 'platinum_bond') {
        // Platinum Vault Bond
        ctx.fillStyle = '#C084FC';
        ctx.fillRect(-loot.radius, -loot.radius * 0.7 + bob, loot.radius * 2, loot.radius * 1.4);
        ctx.strokeStyle = '#FAF5FF';
        ctx.lineWidth = 2;
        ctx.strokeRect(-loot.radius, -loot.radius * 0.7 + bob, loot.radius * 2, loot.radius * 1.4);
      } else if (loot.type === 'diamond_necklace') {
        // Diamond Necklace
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(0, bob, loot.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#BAE6FD';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Gold Bullion Bar
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(-loot.radius, -loot.radius * 0.5 + bob, loot.radius * 2, loot.radius);
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-loot.radius, -loot.radius * 0.5 + bob, loot.radius * 2, loot.radius);
      }
      ctx.restore();
    }

    // 4. Render Safecrackers
    const active = this.getActivePlayers();
    let maxScore = -1;
    this.crackers.forEach(c => { if (c.score > maxScore) maxScore = c.score; });

    for (const p of active) {
      const c = this.crackers.get(p.id);
      if (!c) continue;

      const isUnderdog = maxScore - c.score >= 35;
      const isBot = p.type !== 'human';

      ctx.save();
      ctx.translate(c.x, c.y);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 10, 16, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Charge Ring
      if (c.isCharging) {
        const ratio = Math.min(1.0, c.chargeTime / 1.0);
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
          ctx.fillText('CRACK!', 0, -36);
        }
      }

      // Stethoscope acoustic line when listening to safe
      if (c.isCharging) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.safeX - c.x, this.safeY - c.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw Mascot Safecracker
      drawCharacter(
        ctx,
        0,
        0,
        14,
        p.id,
        isBot,
        c.mood,
        c.animTimer
      );

      // Underdog Stethoscope Amplifier Aura
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
      isSuddenDeath ? `⚡ BREACH: ${Math.ceil(this.roundTimer)}s ⚡` : `⏱️ ${Math.ceil(this.roundTimer)}s`,
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
    ctx.fillText('🔒 VAULT SAFE • STETHOSCOPE CRACK', width / 2, badgeY + badgeH / 2);

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
      const c = this.crackers.get(p.id);
      if (!c) return;

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
      ctx.fillText(`${c.score} pts`, cardX + 32, cardY + 34);

      if (c.streakCount > 1) {
        ctx.fillStyle = '#4ADE80';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`x${(1 + (c.streakCount - 1) * 0.5).toFixed(1)}`, cardX + cardW - 8, cardY + 34);
      }
      ctx.restore();
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = Array.from(this.crackers.entries()).map(([playerId, c]) => ({
      playerId,
      score: c.score
    }));
    scores.sort((a, b) => b.score - a.score);

    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({ playerId: s.playerId, score: s.score, place: idx + 1 }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null
        ? `${this.getPlayer(winnerId)?.name} cracked the titanium bank vault with master acoustic stethoscope control (${scores[0].score} pts)!`
        : 'The bank vault held firm against the acoustic crackers!'
    };
  }
}
