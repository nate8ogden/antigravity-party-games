import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface BreakbeatLoot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'cassette_tape' | 'gold_boombox' | 'diamond_crown';
  value: number;
  radius: number;
  spinAngle: number;
  pulsePhase: number;
  collected: boolean;
}

interface BBoyDancer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  chargeTime: number; // 0 to 1.3s
  isCharging: boolean;
  overheatTimer: number; // Wipeout stumble stun
  freezePoseTimer: number; // Air flare freeze shockwave active
  stunTimer: number;
  spinVisualAngle: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
  isUnderdog: boolean;
}

interface BoomboxHazard {
  x: number;
  y: number;
  width: number;
  height: number;
  vibrateAmp: number;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  cypherFloor: string;
  cypherRim: string;
  cardboardMat: string;
  boomboxColor: string;
  laserColor: string;
  hypeGlow: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Bronx Subway Cypher',
    icon: '🚇',
    bgGradTop: '#1E120A',
    bgGradBottom: '#0A0502',
    cypherFloor: '#2E1A11',
    cypherRim: '#D97706',
    cardboardMat: '#78350F',
    boomboxColor: '#B45309',
    laserColor: 'rgba(217, 119, 6, 0.22)',
    hypeGlow: '#FBBF24'
  },
  {
    name: 'Neo-Tokyo Street Jam',
    icon: '🌃',
    bgGradTop: '#0F172A',
    bgGradBottom: '#020617',
    cypherFloor: '#1E293B',
    cypherRim: '#06B6D4',
    cardboardMat: '#334155',
    boomboxColor: '#0EA5E9',
    laserColor: 'rgba(6, 182, 212, 0.22)',
    hypeGlow: '#38BDF8'
  },
  {
    name: 'Venice Beach Boardwalk',
    icon: '🌴',
    bgGradTop: '#2A0822',
    bgGradBottom: '#0D020A',
    cypherFloor: '#3B0F2F',
    cypherRim: '#EC4899',
    cardboardMat: '#701A75',
    boomboxColor: '#F43F5E',
    laserColor: 'rgba(236, 72, 153, 0.22)',
    hypeGlow: '#F472B6'
  }
];

export class BreakdanceBattleGame extends BaseGame {
  private dancers: Map<PlayerId, BBoyDancer> = new Map();
  private lootList: BreakbeatLoot[] = [];
  private boomboxes: BoomboxHazard[] = [];
  private currentThemeIdx: number = 0;
  private spawnTimer: number = 0;
  private lootCounter: number = 0;
  private globalBeatPhase: number = 0;
  private screenShake: number = 0;

  // AI timing parameters
  private botReactionTimers: Map<PlayerId, number> = new Map();

  // Floating score popups
  private floatingTexts: { x: number; y: number; text: string; color: string; life: number; maxLife: number }[] = [];

  // Theme Event Listeners
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
    this.currentThemeIdx = (this.currentThemeIdx + 1) % THEMES.length;
    this.audio.playTap();
  }

  private setTheme(idx: number): void {
    if (idx >= 0 && idx < THEMES.length) {
      this.currentThemeIdx = idx;
      this.audio.playTap();
    }
  }

  public reset(width: number = 800, height: number = 600): void {
    this.dancers.clear();
    this.lootList = [];
    this.boomboxes = [];
    this.floatingTexts = [];
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.spawnTimer = 0.5;
    this.lootCounter = 0;
    this.globalBeatPhase = 0;
    this.screenShake = 0;

    // Define 4 corner boombox speaker towers
    this.boomboxes = [
      { x: 55, y: 110, width: 70, height: 45, vibrateAmp: 0 },
      { x: width - 125, y: 110, width: 70, height: 45, vibrateAmp: 0 },
      { x: 55, y: height - 145, width: 70, height: 45, vibrateAmp: 0 },
      { x: width - 125, y: height - 145, width: 70, height: 45, vibrateAmp: 0 }
    ];

    const active = this.getActivePlayers();
    const cx = width / 2;
    const cy = height / 2 + 10;
    const spawnOffsets = [
      { x: cx - 150, y: cy - 70 },
      { x: cx + 150, y: cy - 70 },
      { x: cx - 150, y: cy + 70 },
      { x: cx + 150, y: cy + 70 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnOffsets[idx] || { x: cx, y: cy };
      this.dancers.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: Math.PI * 0.5,
        score: 0,
        chargeTime: 0,
        isCharging: false,
        overheatTimer: 0,
        freezePoseTimer: 0,
        stunTimer: 0,
        spinVisualAngle: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: 0,
        sabotageCount: 0,
        isUnderdog: false
      });
      this.botReactionTimers.set(p.id, Math.random() * 0.3);
    });

    // Seed initial breakbeat pickups
    for (let i = 0; i < 6; i++) {
      this.spawnLoot(width, height);
    }
  }

  private spawnLoot(width: number, height: number): void {
    const isSuddenDeath = this.roundTimer <= 12;
    const roll = Math.random();
    let type: 'cassette_tape' | 'gold_boombox' | 'diamond_crown' = 'cassette_tape';
    let value = 20;
    let radius = 13;

    if (isSuddenDeath || roll > 0.85) {
      type = 'diamond_crown';
      value = 75;
      radius = 18;
    } else if (roll > 0.55) {
      type = 'gold_boombox';
      value = 45;
      radius = 15;
    }

    const marginX = 130;
    const marginY = 120;
    const x = marginX + Math.random() * (width - marginX * 2);
    const y = marginY + Math.random() * (height - marginY * 2 - 30);

    this.lootList.push({
      id: ++this.lootCounter,
      x,
      y,
      vx: (Math.random() - 0.5) * 26,
      vy: (Math.random() - 0.5) * 26,
      type,
      value,
      radius,
      spinAngle: Math.random() * Math.PI * 2,
      pulsePhase: Math.random() * Math.PI * 2,
      collected: false
    });
  }

  private addFloatingText(x: number, y: number, text: string, color: string): void {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      life: 0.85,
      maxLife: 0.85
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

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

    const isSuddenDeath = this.roundTimer <= 12;
    this.globalBeatPhase += (6.5 + (isSuddenDeath ? 4.5 : 0)) * dt;

    // Boombox vibration decay
    for (const b of this.boomboxes) {
      b.vibrateAmp = Math.max(0, b.vibrateAmp - dt * 3.5);
    }

    // Spawn loot periodically
    this.spawnTimer -= dt;
    const maxActiveLoot = isSuddenDeath ? 12 : 8;
    if (this.spawnTimer <= 0 && this.lootList.length < maxActiveLoot) {
      this.spawnLoot(width, height);
      this.spawnTimer = isSuddenDeath ? 0.85 : 1.5;
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y -= 25 * dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Compute Underdog status (trailing by >= 35 points)
    let highestScore = -Infinity;
    let lowestScore = Infinity;
    for (const d of this.dancers.values()) {
      if (d.score > highestScore) highestScore = d.score;
      if (d.score < lowestScore) lowestScore = d.score;
    }
    const scoreGap = highestScore - lowestScore;

    for (const d of this.dancers.values()) {
      d.isUnderdog = scoreGap >= 35 && d.score === lowestScore;
    }

    // Update AI Bots
    this.updateBots(dt, width, height);

    // Update B-Boys
    for (const p of this.getActivePlayers()) {
      const d = this.dancers.get(p.id);
      if (!d) continue;

      d.animTimer += dt;

      // Handle Stuns & Wipeout
      if (d.stunTimer > 0) {
        d.stunTimer -= dt;
        d.vx *= 0.88;
        d.vy *= 0.88;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.mood = 'shocked';
        continue;
      }

      if (d.overheatTimer > 0) {
        d.overheatTimer -= dt;
        d.vx *= 0.85;
        d.vy *= 0.85;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.mood = 'shocked';
        continue;
      }

      if (d.freezePoseTimer > 0) {
        d.freezePoseTimer -= dt;
      }

      // Streak timer decay
      if (d.streakTimer > 0) {
        d.streakTimer -= dt;
        if (d.streakTimer <= 0) {
          d.streakCount = 0;
        }
      }

      // Movement Input
      const steerX = this.input.getSteer(p.id);
      const throttleY = -this.input.getThrottle(p.id);
      const actionHeld = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      const mag = Math.hypot(steerX, throttleY);
      if (mag > 0.15) {
        d.angle = Math.atan2(throttleY, steerX);
      }

      const speedMultiplier = d.isUnderdog ? 1.30 : 1.0;
      const baseSpeed = 230 * speedMultiplier;
      const accel = 1450;

      if (mag > 0.15) {
        d.vx += (steerX / mag) * accel * dt;
        d.vy += (throttleY / mag) * accel * dt;
        const currentSpeed = Math.hypot(d.vx, d.vy);
        const maxSpeed = baseSpeed * (d.isCharging ? 0.45 : 1.0);
        if (currentSpeed > maxSpeed) {
          d.vx = (d.vx / currentSpeed) * maxSpeed;
          d.vy = (d.vy / currentSpeed) * maxSpeed;
        }
      } else {
        d.vx *= 0.82;
        d.vy *= 0.82;
      }

      d.x += d.vx * dt;
      d.y += d.vy * dt;

      // Arena boundary collision
      const arenaMinX = 55;
      const arenaMaxX = width - 55;
      const arenaMinY = 95;
      const arenaMaxY = height - 65;

      if (d.x < arenaMinX) { d.x = arenaMinX; d.vx = Math.abs(d.vx) * 0.5; }
      if (d.x > arenaMaxX) { d.x = arenaMaxX; d.vx = -Math.abs(d.vx) * 0.5; }
      if (d.y < arenaMinY) { d.y = arenaMinY; d.vy = Math.abs(d.vy) * 0.5; }
      if (d.y > arenaMaxY) { d.y = arenaMaxY; d.vy = -Math.abs(d.vy) * 0.5; }

      // Boombox Hazard Collision
      for (const b of this.boomboxes) {
        const closestX = Math.max(b.x, Math.min(d.x, b.x + b.width));
        const closestY = Math.max(b.y, Math.min(d.y, b.y + b.height));
        const dist = Math.hypot(d.x - closestX, d.y - closestY);
        if (dist < 20) {
          const pushAngle = Math.atan2(d.y - (b.y + b.height / 2), d.x - (b.x + b.width / 2));
          d.vx = Math.cos(pushAngle) * 260;
          d.vy = Math.sin(pushAngle) * 260;
          d.stunTimer = 0.4;
          d.mood = 'shocked';
          b.vibrateAmp = 1.0;
          this.audio.playTone(130, 0.15, 'sawtooth');
          this.particles.emit(d.x, d.y, 8, '#EC4899');
          this.addFloatingText(d.x, d.y - 20, 'BOOMBOX RECOIL!', '#EC4899');
        }
      }

      // Hold-to-Charge Windmill Spin / Air Flare Freeze Sweet Spot
      if (actionHeld && d.stunTimer <= 0 && d.overheatTimer <= 0) {
        if (!d.isCharging) {
          d.isCharging = true;
          d.chargeTime = 0;
          d.mood = 'focused';
        }
        d.chargeTime += dt;
        d.spinVisualAngle += 18.0 * dt;

        // Breakbeat scratch audio
        if (Math.random() < 0.22) {
          this.audio.playTone(380 + d.chargeTime * 320, 0.04, 'sawtooth');
        }

        // Particle spin dust
        if (Math.random() < 0.4) {
          this.particles.emit(d.x, d.y, 1, p.color);
        }

        // Overcharge past 1.25s -> Wipeout Stumble
        if (d.chargeTime >= 1.25) {
          d.isCharging = false;
          d.chargeTime = 0;
          d.overheatTimer = 0.85;
          d.score = Math.max(0, d.score - 5);
          d.mood = 'shocked';
          this.audio.playTone(170, 0.35, 'sawtooth');
          this.particles.emit(d.x, d.y, 14, '#EF4444');
          this.addFloatingText(d.x, d.y - 25, 'WIPEOUT! -5', '#EF4444');
        }
      } else if (!actionHeld && d.isCharging) {
        // Action Released -> Evaluate Sweet Spot
        d.isCharging = false;
        const normalizedCharge = d.chargeTime / 1.0;
        const isSweetSpot = d.isUnderdog
          ? (normalizedCharge >= 0.50 && normalizedCharge <= 1.05)
          : (normalizedCharge >= 0.72 && normalizedCharge <= 0.98);

        if (isSweetSpot) {
          // Trigger GRAVITY-DEFYING AIR FLARE FREEZE & HYPE SHOCKWAVE
          d.freezePoseTimer = 0.70;
          d.streakCount++;
          d.streakTimer = 4.0;
          const streakMultiplier = Math.min(2.5, 1.0 + (d.streakCount - 1) * 0.5);
          const bonusPts = Math.round(25 * streakMultiplier * (isSuddenDeath ? 2 : 1));
          d.score += bonusPts;
          d.mood = 'triumph';
          this.screenShake = 12;

          // Crisp horn hit + bass kick
          this.audio.playTone(70, 0.3, 'sawtooth');
          this.audio.playTone(580, 0.15, 'sine');
          this.audio.playTone(880, 0.1, 'sawtooth');

          this.particles.emit(d.x, d.y, 25, '#F59E0B');
          this.particles.emit(d.x, d.y, 15, '#EC4899');
          this.addFloatingText(d.x, d.y - 30, `AIR FLARE FREEZE! +${bonusPts}`, '#FBBF24');

          // Acoustic shockwave scoops up loot in 140px radius (or 210px for Underdog)
          const vacuumRadius = d.isUnderdog ? 210 : 140;
          for (const loot of this.lootList) {
            if (loot.collected) continue;
            const dist = Math.hypot(loot.x - d.x, loot.y - d.y);
            if (dist <= vacuumRadius) {
              loot.collected = true;
              const val = Math.round(loot.value * streakMultiplier * (isSuddenDeath ? 2 : 1));
              d.score += val;
              this.particles.emit(loot.x, loot.y, 8, '#10B981');
              this.addFloatingText(loot.x, loot.y - 15, `+${val}`, '#10B981');
            }
          }

          // Daze and knockback rivals in shockwave
          for (const rival of this.getActivePlayers()) {
            if (rival.id === d.id) continue;
            const other = this.dancers.get(rival.id);
            if (!other) continue;
            const distToOther = Math.hypot(other.x - d.x, other.y - d.y);
            if (distToOther <= vacuumRadius) {
              other.stunTimer = 0.75;
              const pushAngle = Math.atan2(other.y - d.y, other.x - d.x);
              other.vx += Math.cos(pushAngle) * 330;
              other.vy += Math.sin(pushAngle) * 330;
              other.mood = 'shocked';
              this.particles.emit(other.x, other.y, 10, '#EC4899');
            }
          }
        } else {
          // Off-beat release: quick slide forward
          d.vx += Math.cos(d.angle) * 185;
          d.vy += Math.sin(d.angle) * 185;
          this.audio.playTone(320, 0.06, 'sine');
          d.mood = 'idle';
        }
        d.chargeTime = 0;
      }
    }

    // Physical Dancer-to-Dancer Collision & Cypher Tackle Shunt
    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const d1 = this.dancers.get(active[i].id);
        const d2 = this.dancers.get(active[j].id);
        if (!d1 || !d2) continue;

        const dx = d2.x - d1.x;
        const dy = d2.y - d1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 42;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          d1.x -= nx * overlap * 0.5;
          d1.y -= ny * overlap * 0.5;
          d2.x += nx * overlap * 0.5;
          d2.y += ny * overlap * 0.5;

          const vRelX = d1.vx - d2.vx;
          const vRelY = d1.vy - d2.vy;
          const impulse = Math.hypot(vRelX, vRelY);

          d1.vx -= nx * 220;
          d1.vy -= ny * 220;
          d2.vx += nx * 220;
          d2.vy += ny * 220;

          // Cypher Tackle Sabotage Bonus
          if (impulse > 160) {
            const aggressor = d1.freezePoseTimer > 0 || Math.hypot(d1.vx, d1.vy) > Math.hypot(d2.vx, d2.vy) ? d1 : d2;
            const victim = aggressor === d1 ? d2 : d1;

            aggressor.score += 30;
            aggressor.sabotageCount++;
            victim.score = Math.max(0, victim.score - 10);
            victim.stunTimer = 0.70;
            victim.mood = 'shocked';
            aggressor.mood = 'triumph';

            this.audio.playTone(140, 0.18, 'sawtooth');
            this.particles.emit((d1.x + d2.x) / 2, (d1.y + d2.y) / 2, 16, '#F59E0B');
            this.addFloatingText(aggressor.x, aggressor.y - 25, 'CYPHER SHUNT! +30', '#F59E0B');
            this.addFloatingText(victim.x, victim.y - 25, '-10 PTS', '#EF4444');
          }
        }
      }
    }

    // Direct Loot Pickup
    for (const d of this.dancers.values()) {
      if (d.stunTimer > 0) continue;
      for (const loot of this.lootList) {
        if (loot.collected) continue;
        const dist = Math.hypot(loot.x - d.x, loot.y - d.y);
        const reach = d.isUnderdog ? 36 : 26;
        if (dist < reach + loot.radius) {
          loot.collected = true;
          const mult = Math.min(2.5, 1.0 + d.streakCount * 0.3) * (isSuddenDeath ? 2 : 1);
          const gained = Math.round(loot.value * mult);
          d.score += gained;
          d.mood = 'triumph';
          this.audio.playTone(loot.type === 'diamond_crown' ? 880 : 640, 0.08, 'sine');
          this.particles.emit(loot.x, loot.y, 10, '#10B981');
          this.addFloatingText(loot.x, loot.y - 15, `+${gained}`, '#10B981');
        }
      }
    }

    // Filter collected loot
    this.lootList = this.lootList.filter(l => !l.collected);

    // Update remaining loot floating drift
    for (const l of this.lootList) {
      l.spinAngle += 2.0 * dt;
      l.pulsePhase += 4.0 * dt;
      l.x += l.vx * dt;
      l.y += l.vy * dt;

      if (l.x < 110 || l.x > width - 110) l.vx = -l.vx;
      if (l.y < 100 || l.y > height - 90) l.vy = -l.vy;
    }
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const d = this.dancers.get(botId);
    if (!d || d.stunTimer > 0) return;

    let reactionTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (reactionTimer <= 0) {
      const lag = difficulty === 'bot_hard' ? 0.10 : difficulty === 'bot_normal' ? 0.23 : 0.42;
      reactionTimer = lag + Math.random() * 0.04;
      this.botReactionTimers.set(botId, reactionTimer);

      let targetX = width / 2;
      let targetY = height / 2;
      let targetLoot: BreakbeatLoot | null = null;

      // Select target: prefer crowns, then boomboxes
      let bestDist = Infinity;
      for (const l of this.lootList) {
        const dist = Math.hypot(l.x - d.x, l.y - d.y);
        const weight = l.type === 'diamond_crown' ? dist * 0.4 : l.type === 'gold_boombox' ? dist * 0.7 : dist;
        if (weight < bestDist) {
          bestDist = weight;
          targetLoot = l;
        }
      }

      // Hard bots actively hunt rivals
      if (difficulty === 'bot_hard' && Math.random() < 0.35) {
        for (const rival of this.getActivePlayers()) {
          if (rival.id === botId) continue;
          const other = this.dancers.get(rival.id);
          if (other && other.score >= d.score) {
            const distToRival = Math.hypot(other.x - d.x, other.y - d.y);
            if (distToRival < 180) {
              targetX = other.x + (other.vx * 0.2);
              targetY = other.y + (other.vy * 0.2);
              targetLoot = null;
              break;
            }
          }
        }
      }

      if (targetLoot) {
        targetX = targetLoot.x;
        targetY = targetLoot.y;
      }

      // Blunder rate
      const blunderRate = difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.08 : 0.0;
      if (Math.random() < blunderRate) {
        targetX += (Math.random() - 0.5) * 200;
        targetY += (Math.random() - 0.5) * 200;
      }

      const angleToTarget = Math.atan2(targetY - d.y, targetX - d.x);
      const steerX = Math.cos(angleToTarget);
      const throttleY = -Math.sin(angleToTarget);

      // Sweet spot hold-to-charge decision
      let shouldAction = false;
      const distToTarget = Math.hypot(targetX - d.x, targetY - d.y);
      if (distToTarget < 160 && !d.isCharging) {
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

      this.input.setBotInput(botId, shouldAction, steerX, throttleY);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIdx];
    const isSuddenDeath = this.roundTimer <= 12;

    ctx.save();
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

    // 1. Dynamic 2.5D Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Laser / Streetlight Sweeps
    for (let l = 0; l < 4; l++) {
      const beamAngle = Math.sin(this.globalBeatPhase * 0.4 + l * 1.5) * 0.6;
      const beamX = width * (0.2 + l * 0.2);
      ctx.strokeStyle = theme.laserColor;
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(beamX, 0);
      ctx.lineTo(beamX + Math.sin(beamAngle) * height, height);
      ctx.stroke();
    }

    // 2. Center Cypher Arena (2.5D Linoleum / Cardboard Dance Mat)
    const stageX = 65;
    const stageY = 90;
    const stageW = width - 130;
    const stageH = height - 155;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.roundRect(stageX + 6, stageY + 8, stageW, stageH, 18);
    ctx.fill();

    ctx.fillStyle = theme.cypherFloor;
    ctx.strokeStyle = theme.cypherRim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(stageX, stageY, stageW, stageH, 18);
    ctx.fill();
    ctx.stroke();

    // Cardboard Cypher Circle in Stage Center
    const cx = width / 2;
    const cy = height / 2 + 10;
    ctx.fillStyle = theme.cardboardMat;
    ctx.beginPath();
    ctx.arc(cx, cy, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.hypeGlow;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Render 4 Boomboxes
    for (const b of this.boomboxes) {
      this.renderBoombox(ctx, b, theme);
    }

    // 4. Render Floating Breakbeat Loot
    for (const loot of this.lootList) {
      this.renderLoot(ctx, loot);
    }

    // 5. Render B-Boy Dancers
    for (const p of this.getActivePlayers()) {
      const d = this.dancers.get(p.id);
      if (!d) continue;
      this.renderDancer(ctx, d, p);
    }

    // 6. Floating Texts & Shockwave Bursts
    for (const ft of this.floatingTexts) {
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.globalAlpha = 1.0;
    }

    // 7. Strict Safe Layout HUD
    this.renderHUD(ctx, width, height, isSuddenDeath, theme);

    ctx.restore();
  }

  private renderBoombox(ctx: CanvasRenderingContext2D, b: BoomboxHazard, theme: VisualTheme): void {
    ctx.save();
    const vib = (Math.random() - 0.5) * b.vibrateAmp * 4;

    // Boombox Body
    ctx.fillStyle = theme.boomboxColor;
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(b.x + vib, b.y, b.width, b.height, 6);
    ctx.fill();
    ctx.stroke();

    // Dual Speakers on Boombox
    const spkW = b.height * 0.6;
    for (const offset of [b.width * 0.25, b.width * 0.75]) {
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(b.x + vib + offset, b.y + b.height * 0.5, spkW * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Speaker Cone center
      ctx.fillStyle = '#94A3B8';
      ctx.beginPath();
      ctx.arc(b.x + vib + offset, b.y + b.height * 0.5, spkW * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center Cassette Deck
    ctx.fillStyle = '#334155';
    ctx.fillRect(b.x + vib + b.width * 0.42, b.y + b.height * 0.25, b.width * 0.16, b.height * 0.5);

    ctx.restore();
  }

  private renderLoot(ctx: CanvasRenderingContext2D, loot: BreakbeatLoot): void {
    ctx.save();
    ctx.translate(loot.x, loot.y);
    ctx.rotate(loot.spinAngle);

    const pulse = 1.0 + Math.sin(loot.pulsePhase) * 0.12;
    ctx.scale(pulse, pulse);

    if (loot.type === 'diamond_crown') {
      // Diamond Hype Crown
      ctx.fillStyle = '#38BDF8';
      ctx.strokeStyle = '#E0F2FE';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-loot.radius, loot.radius * 0.6);
      ctx.lineTo(-loot.radius * 0.8, -loot.radius * 0.6);
      ctx.lineTo(-loot.radius * 0.3, 0);
      ctx.lineTo(0, -loot.radius);
      ctx.lineTo(loot.radius * 0.3, 0);
      ctx.lineTo(loot.radius * 0.8, -loot.radius * 0.6);
      ctx.lineTo(loot.radius, loot.radius * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HYPE', 0, loot.radius * 0.4);
    } else if (loot.type === 'gold_boombox') {
      // Gold Mini Boombox
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(-loot.radius, -loot.radius * 0.65, loot.radius * 2, loot.radius * 1.3);
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      ctx.strokeRect(-loot.radius, -loot.radius * 0.65, loot.radius * 2, loot.radius * 1.3);

      // Mini Speakers
      ctx.fillStyle = '#18181B';
      ctx.beginPath();
      ctx.arc(-loot.radius * 0.5, 0, loot.radius * 0.35, 0, Math.PI * 2);
      ctx.arc(loot.radius * 0.5, 0, loot.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Silver Cassette Tape
      ctx.fillStyle = '#64748B';
      ctx.fillRect(-loot.radius, -loot.radius * 0.6, loot.radius * 2, loot.radius * 1.2);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-loot.radius, -loot.radius * 0.6, loot.radius * 2, loot.radius * 1.2);

      // Cassette spools
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-loot.radius * 0.45, 0, 3, 0, Math.PI * 2);
      ctx.arc(loot.radius * 0.45, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderDancer(ctx: CanvasRenderingContext2D, d: BBoyDancer, p: PlayerConfig): void {
    ctx.save();

    // Underdog glowing aura ring
    if (d.isUnderdog) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(d.x, d.y, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Air Flare Freeze expanding shockwave ring
    if (d.freezePoseTimer > 0) {
      const waveRadius = (1.0 - d.freezePoseTimer / 0.70) * (d.isUnderdog ? 210 : 140);
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(d.x, d.y, waveRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw Character Mascot
    const isBot = d.id !== 0;
    ctx.save();
    if (d.isCharging) {
      // Spinning windmill animation rotation
      ctx.translate(d.x, d.y);
      ctx.rotate(d.spinVisualAngle);
      drawCharacter(ctx, 0, 0, 18, d.id, isBot, d.mood, d.animTimer);
      ctx.restore();
    } else {
      drawCharacter(ctx, d.x, d.y, 18, d.id, isBot, d.mood, d.animTimer);
    }

    // Backward B-Boy Cap / Visor on Mascot
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(d.x, d.y - 12, 10, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(d.x - 12, d.y - 13, 6, 3); // Brim facing back

    // Charging indicator ring
    if (d.isCharging) {
      const norm = Math.min(1.0, d.chargeTime / 1.0);
      const isSweet = d.isUnderdog ? (norm >= 0.50 && norm <= 1.05) : (norm >= 0.72 && norm <= 0.98);

      ctx.strokeStyle = isSweet ? '#10B981' : '#F59E0B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 25, -Math.PI / 2, -Math.PI / 2 + norm * Math.PI * 2);
      ctx.stroke();

      // Sweet spot target zone tick markers
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      const startAngle = -Math.PI / 2 + (d.isUnderdog ? 0.50 : 0.72) * Math.PI * 2;
      const endAngle = -Math.PI / 2 + (d.isUnderdog ? 1.00 : 0.98) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 27, startAngle, endAngle);
      ctx.stroke();
    }

    // Stun / Wipeout indicator
    if (d.stunTimer > 0 || d.overheatTimer > 0) {
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💫', d.x, d.y - 26);
    }

    // Name & Score Tag
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name}: ${d.score}`, d.x, d.y + 30);

    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number, isSuddenDeath: boolean, theme: VisualTheme): void {
    // 1. Minigame Header Badge (Safe zone y: 56, h: 26)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 190, 56, 380, 26, 13);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : theme.cypherRim;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#FCA5A5' : '#E2E8F0';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      isSuddenDeath
        ? '⚡ BC-ONE CHAMPIONSHIP CYPHER! 2X POINTS ⚡'
        : '🕺 BREAKDANCE: WINDMILL SPIN & AIR FLARE FREEZE',
      width / 2,
      73
    );

    // 2. Theme Pill (Safe bottom-left x: 20, y: height - 44, w: 170, h: 32)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 8);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${theme.icon} ${theme.name} [T]`, 30, height - 24);

    // 3. Player Corner Cards (Safe zone y: height - 128, w: 130, h: 48)
    const active = this.getActivePlayers();
    const cornerPositions = [
      { x: 20, y: height - 110 },
      { x: width - 150, y: height - 110 },
      { x: 20, y: height - 165 },
      { x: width - 150, y: height - 165 }
    ];

    active.forEach((p, idx) => {
      const d = this.dancers.get(p.id);
      if (!d) return;
      const pos = cornerPositions[idx] || cornerPositions[0];

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.roundRect(pos.x, pos.y, 130, 48, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, pos.x + 10, pos.y + 18);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`${d.score} pts`, pos.x + 10, pos.y + 36);

      if (d.streakCount > 1) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`🔥x${Math.min(2.5, 1.0 + (d.streakCount - 1) * 0.5).toFixed(1)}`, pos.x + 122, pos.y + 36);
      }
    });
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.dancers.get(p.id)?.score || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    const winnerDancer = winnerId !== null ? this.dancers.get(winnerId) : null;
    const highlight = winnerId !== null
      ? `${this.getPlayer(winnerId)?.name} owned the cardboard cypher with air flare freezes & ${winnerDancer?.sabotageCount || 0} boombox shunts!`
      : 'The b-boy crew battle ended in a legendary dead-heat freeze!';

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
