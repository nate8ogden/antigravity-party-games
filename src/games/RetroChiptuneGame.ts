import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface ChiptuneLoot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'pixel_byte' | 'arpeggio_cartridge' | 'overclock_chip';
  value: number;
  radius: number;
  spinAngle: number;
  pulsePhase: number;
  collected: boolean;
}

interface ChipHacker {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  chargeTime: number; // 0 to 1.3s
  isCharging: boolean;
  overheatTimer: number; // Glitch crash stun
  overdriveTimer: number; // Squarewave blast active
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
  isUnderdog: boolean;
}

interface SynthChannelPin {
  x: number;
  y: number;
  radius: number;
  name: string;
  pulseAmp: number;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  boardFloor: string;
  circuitTrace: string;
  pinColor: string;
  lcdGlow: string;
  laserBeam: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Classic DMG-01 Game Boy',
    icon: '🟢',
    bgGradTop: '#1E3A1E',
    bgGradBottom: '#071207',
    boardFloor: '#2D5A27',
    circuitTrace: '#8BAC0F',
    pinColor: '#9BBC0F',
    lcdGlow: '#0F380F',
    laserBeam: 'rgba(155, 188, 15, 0.22)'
  },
  {
    name: 'Neon Arcade Famicom',
    icon: '🔴',
    bgGradTop: '#2B080C',
    bgGradBottom: '#0A0103',
    boardFloor: '#450A10',
    circuitTrace: '#EF4444',
    pinColor: '#F59E0B',
    lcdGlow: '#7F1D1D',
    laserBeam: 'rgba(239, 68, 68, 0.22)'
  },
  {
    name: 'Cyberpunk Glitch Matrix',
    icon: '💻',
    bgGradTop: '#180B2B',
    bgGradBottom: '#05020D',
    boardFloor: '#2A1149',
    circuitTrace: '#A855F7',
    pinColor: '#06B6D4',
    lcdGlow: '#581C87',
    laserBeam: 'rgba(168, 85, 247, 0.22)'
  }
];

export class RetroChiptuneGame extends BaseGame {
  private hackers: Map<PlayerId, ChipHacker> = new Map();
  private lootList: ChiptuneLoot[] = [];
  private pins: SynthChannelPin[] = [];
  private currentThemeIdx: number = 0;
  private spawnTimer: number = 0;
  private lootCounter: number = 0;
  private globalClockPhase: number = 0;
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
    this.hackers.clear();
    this.lootList = [];
    this.pins = [];
    this.floatingTexts = [];
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.spawnTimer = 0.5;
    this.lootCounter = 0;
    this.globalClockPhase = 0;
    this.screenShake = 0;

    // Define 4 Motherboard Synthesizer Channel Pins
    const cx = width / 2;
    const cy = height / 2 + 10;
    this.pins = [
      { x: cx - 160, y: cy - 80, radius: 24, name: 'PULSE 1', pulseAmp: 0 },
      { x: cx + 160, y: cy - 80, radius: 24, name: 'PULSE 2', pulseAmp: 0 },
      { x: cx - 160, y: cy + 80, radius: 24, name: 'WAVE', pulseAmp: 0 },
      { x: cx + 160, y: cy + 80, radius: 24, name: 'NOISE', pulseAmp: 0 }
    ];

    const active = this.getActivePlayers();
    const spawnOffsets = [
      { x: cx - 110, y: cy },
      { x: cx + 110, y: cy },
      { x: cx, y: cy - 65 },
      { x: cx, y: cy + 65 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnOffsets[idx] || { x: cx, y: cy };
      this.hackers.set(p.id, {
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
        overdriveTimer: 0,
        stunTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: 0,
        sabotageCount: 0,
        isUnderdog: false
      });
      this.botReactionTimers.set(p.id, Math.random() * 0.3);
    });

    // Seed initial chiptune pickups
    for (let i = 0; i < 6; i++) {
      this.spawnLoot(width, height);
    }
  }

  private spawnLoot(width: number, height: number): void {
    const isSuddenDeath = this.roundTimer <= 12;
    const roll = Math.random();
    let type: 'pixel_byte' | 'arpeggio_cartridge' | 'overclock_chip' = 'pixel_byte';
    let value = 20;
    let radius = 13;

    if (isSuddenDeath || roll > 0.85) {
      type = 'overclock_chip';
      value = 75;
      radius = 18;
    } else if (roll > 0.55) {
      type = 'arpeggio_cartridge';
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
    this.globalClockPhase += (6.5 + (isSuddenDeath ? 4.5 : 0)) * dt;

    // Synthesizer Channel Pins pulse animation
    for (const p of this.pins) {
      p.pulseAmp = Math.max(0, p.pulseAmp - dt * 4.0);
      if (Math.sin(this.globalClockPhase) > 0.88 && p.pulseAmp <= 0.1) {
        p.pulseAmp = 1.0;
        this.audio.playTone(330 + Math.random() * 220, 0.03, 'square');
      }
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

    // Underdog calculation
    let highestScore = -Infinity;
    let lowestScore = Infinity;
    for (const h of this.hackers.values()) {
      if (h.score > highestScore) highestScore = h.score;
      if (h.score < lowestScore) lowestScore = h.score;
    }
    const scoreGap = highestScore - lowestScore;

    for (const h of this.hackers.values()) {
      h.isUnderdog = scoreGap >= 35 && h.score === lowestScore;
    }

    // Update AI Bots
    this.updateBots(dt, width, height);

    // Update Hackers
    for (const p of this.getActivePlayers()) {
      const h = this.hackers.get(p.id);
      if (!h) continue;

      h.animTimer += dt;

      // Handle Stuns & Glitch
      if (h.stunTimer > 0) {
        h.stunTimer -= dt;
        h.vx *= 0.88;
        h.vy *= 0.88;
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        h.mood = 'shocked';
        continue;
      }

      if (h.overheatTimer > 0) {
        h.overheatTimer -= dt;
        h.vx *= 0.85;
        h.vy *= 0.85;
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        h.mood = 'shocked';
        continue;
      }

      if (h.overdriveTimer > 0) {
        h.overdriveTimer -= dt;
      }

      // Streak decay
      if (h.streakTimer > 0) {
        h.streakTimer -= dt;
        if (h.streakTimer <= 0) {
          h.streakCount = 0;
        }
      }

      // Movement Input via InputRouter
      const steerX = this.input.getSteer(p.id);
      const throttleY = -this.input.getThrottle(p.id);
      const actionHeld = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      const mag = Math.hypot(steerX, throttleY);
      if (mag > 0.15) {
        h.angle = Math.atan2(throttleY, steerX);
      }

      const speedMultiplier = h.isUnderdog ? 1.30 : 1.0;
      const baseSpeed = 225 * speedMultiplier;
      const accel = 1450;

      if (mag > 0.15) {
        h.vx += (steerX / mag) * accel * dt;
        h.vy += (throttleY / mag) * accel * dt;
        const currentSpeed = Math.hypot(h.vx, h.vy);
        const maxSpeed = baseSpeed * (h.isCharging ? 0.45 : 1.0);
        if (currentSpeed > maxSpeed) {
          h.vx = (h.vx / currentSpeed) * maxSpeed;
          h.vy = (h.vy / currentSpeed) * maxSpeed;
        }
      } else {
        h.vx *= 0.82;
        h.vy *= 0.82;
      }

      h.x += h.vx * dt;
      h.y += h.vy * dt;

      // Arena boundary collision
      const arenaMinX = 55;
      const arenaMaxX = width - 55;
      const arenaMinY = 95;
      const arenaMaxY = height - 65;

      if (h.x < arenaMinX) { h.x = arenaMinX; h.vx = Math.abs(h.vx) * 0.5; }
      if (h.x > arenaMaxX) { h.x = arenaMaxX; h.vx = -Math.abs(h.vx) * 0.5; }
      if (h.y < arenaMinY) { h.y = arenaMinY; h.vy = Math.abs(h.vy) * 0.5; }
      if (h.y > arenaMaxY) { h.y = arenaMaxY; h.vy = -Math.abs(h.vy) * 0.5; }

      // Synthesizer Channel Pin Collision & Recoil
      for (const pin of this.pins) {
        const distToPin = Math.hypot(h.x - pin.x, h.y - pin.y);
        const minDist = pin.radius + 14;
        if (distToPin < minDist && distToPin > 0.001) {
          const pushAngle = Math.atan2(h.y - pin.y, h.x - pin.x);
          h.vx = Math.cos(pushAngle) * 260;
          h.vy = Math.sin(pushAngle) * 260;
          h.stunTimer = 0.4;
          h.mood = 'shocked';
          pin.pulseAmp = 1.0;
          this.audio.playTone(180, 0.1, 'square');
          this.particles.emit(h.x, h.y, 8, '#A3E635');
          this.addFloatingText(h.x, h.y - 20, 'PIN RECOIL!', '#A3E635');
        }
      }

      // Hold-to-Charge Bitcrush / Squarewave Overdrive Sweet Spot
      if (actionHeld && h.stunTimer <= 0 && h.overheatTimer <= 0) {
        if (!h.isCharging) {
          h.isCharging = true;
          h.chargeTime = 0;
          h.mood = 'focused';
        }
        h.chargeTime += dt;

        // Ascending 8-bit arpeggio audio
        if (Math.random() < 0.22) {
          this.audio.playTone(220 + h.chargeTime * 440, 0.03, 'square');
        }

        // Particle square sparks
        if (Math.random() < 0.4) {
          this.particles.emit(h.x, h.y, 1, p.color);
        }

        // Overcharge past 1.25s -> Buffer Overflow / Glitch Crash Stun
        if (h.chargeTime >= 1.25) {
          h.isCharging = false;
          h.chargeTime = 0;
          h.overheatTimer = 0.85;
          h.score = Math.max(0, h.score - 5);
          h.mood = 'shocked';
          this.audio.playTone(120, 0.35, 'sawtooth');
          this.particles.emit(h.x, h.y, 14, '#EF4444');
          this.addFloatingText(h.x, h.y - 25, 'BUFFER OVERFLOW! -5', '#EF4444');
        }
      } else if (!actionHeld && h.isCharging) {
        // Action Released -> Evaluate Sweet Spot
        h.isCharging = false;
        const normalizedCharge = h.chargeTime / 1.0;
        const isSweetSpot = h.isUnderdog
          ? (normalizedCharge >= 0.50 && normalizedCharge <= 1.05)
          : (normalizedCharge >= 0.72 && normalizedCharge <= 0.98);

        if (isSweetSpot) {
          // Trigger 8-BIT SQUAREWAVE OVERDRIVE BLAST
          h.overdriveTimer = 0.65;
          h.streakCount++;
          h.streakTimer = 4.0;
          const streakMultiplier = Math.min(2.5, 1.0 + (h.streakCount - 1) * 0.5);
          const bonusPts = Math.round(25 * streakMultiplier * (isSuddenDeath ? 2 : 1));
          h.score += bonusPts;
          h.mood = 'triumph';
          this.screenShake = 12;

          // Chiptune power chord
          this.audio.playTone(880, 0.25, 'square');
          this.audio.playTone(440, 0.15, 'square');
          this.audio.playTone(1320, 0.1, 'square');

          this.particles.emit(h.x, h.y, 25, '#A3E635');
          this.particles.emit(h.x, h.y, 15, '#F59E0B');
          this.addFloatingText(h.x, h.y - 30, `OVERDRIVE! +${bonusPts}`, '#FBBF24');

          // Acoustic shockwave scoops up loot in 140px radius (or 210px for Underdog)
          const vacuumRadius = h.isUnderdog ? 210 : 140;
          for (const loot of this.lootList) {
            if (loot.collected) continue;
            const dist = Math.hypot(loot.x - h.x, loot.y - h.y);
            if (dist <= vacuumRadius) {
              loot.collected = true;
              const val = Math.round(loot.value * streakMultiplier * (isSuddenDeath ? 2 : 1));
              h.score += val;
              this.particles.emit(loot.x, loot.y, 8, '#10B981');
              this.addFloatingText(loot.x, loot.y - 15, `+${val}`, '#10B981');
            }
          }

          // Daze and knockback rivals in shockwave
          for (const rival of this.getActivePlayers()) {
            if (rival.id === h.id) continue;
            const other = this.hackers.get(rival.id);
            if (!other) continue;
            const distToOther = Math.hypot(other.x - h.x, other.y - h.y);
            if (distToOther <= vacuumRadius) {
              other.stunTimer = 0.75;
              const pushAngle = Math.atan2(other.y - h.y, other.x - h.x);
              other.vx += Math.cos(pushAngle) * 330;
              other.vy += Math.sin(pushAngle) * 330;
              other.mood = 'shocked';
              this.particles.emit(other.x, other.y, 10, '#A3E635');
            }
          }
        } else {
          // Off-beat release: quick slide forward
          h.vx += Math.cos(h.angle) * 185;
          h.vy += Math.sin(h.angle) * 185;
          this.audio.playTone(320, 0.06, 'square');
          h.mood = 'idle';
        }
        h.chargeTime = 0;
      }
    }

    // Physical Hacker-to-Hacker Collision & Circuit Shunt Sabotage
    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const h1 = this.hackers.get(active[i].id);
        const h2 = this.hackers.get(active[j].id);
        if (!h1 || !h2) continue;

        const dx = h2.x - h1.x;
        const dy = h2.y - h1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 42;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          h1.x -= nx * overlap * 0.5;
          h1.y -= ny * overlap * 0.5;
          h2.x += nx * overlap * 0.5;
          h2.y += ny * overlap * 0.5;

          const vRelX = h1.vx - h2.vx;
          const vRelY = h1.vy - h2.vy;
          const impulse = Math.hypot(vRelX, vRelY);

          h1.vx -= nx * 220;
          h1.vy -= ny * 220;
          h2.vx += nx * 220;
          h2.vy += ny * 220;

          // Circuit Shunt Sabotage Bonus
          if (impulse > 160) {
            const aggressor = h1.overdriveTimer > 0 || Math.hypot(h1.vx, h1.vy) > Math.hypot(h2.vx, h2.vy) ? h1 : h2;
            const victim = aggressor === h1 ? h2 : h1;

            aggressor.score += 30;
            aggressor.sabotageCount++;
            victim.score = Math.max(0, victim.score - 10);
            victim.stunTimer = 0.70;
            victim.mood = 'shocked';
            aggressor.mood = 'triumph';

            this.audio.playTone(150, 0.18, 'sawtooth');
            this.particles.emit((h1.x + h2.x) / 2, (h1.y + h2.y) / 2, 16, '#A3E635');
            this.addFloatingText(aggressor.x, aggressor.y - 25, 'CIRCUIT SHUNT! +30', '#A3E635');
            this.addFloatingText(victim.x, victim.y - 25, '-10 PTS', '#EF4444');
          }
        }
      }
    }

    // Direct Loot Pickup
    for (const h of this.hackers.values()) {
      if (h.stunTimer > 0) continue;
      for (const loot of this.lootList) {
        if (loot.collected) continue;
        const dist = Math.hypot(loot.x - h.x, loot.y - h.y);
        const reach = h.isUnderdog ? 36 : 26;
        if (dist < reach + loot.radius) {
          loot.collected = true;
          const mult = Math.min(2.5, 1.0 + h.streakCount * 0.3) * (isSuddenDeath ? 2 : 1);
          const gained = Math.round(loot.value * mult);
          h.score += gained;
          h.mood = 'triumph';
          this.audio.playTone(loot.type === 'overclock_chip' ? 990 : 660, 0.08, 'square');
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
    const h = this.hackers.get(botId);
    if (!h || h.stunTimer > 0) return;

    let reactionTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (reactionTimer <= 0) {
      const lag = difficulty === 'bot_hard' ? 0.10 : difficulty === 'bot_normal' ? 0.23 : 0.42;
      reactionTimer = lag + Math.random() * 0.04;
      this.botReactionTimers.set(botId, reactionTimer);

      let targetX = width / 2;
      let targetY = height / 2;
      let targetLoot: ChiptuneLoot | null = null;

      // Select target: prefer overclock chips, then cartridges
      let bestDist = Infinity;
      for (const l of this.lootList) {
        const dist = Math.hypot(l.x - h.x, l.y - h.y);
        const weight = l.type === 'overclock_chip' ? dist * 0.4 : l.type === 'arpeggio_cartridge' ? dist * 0.7 : dist;
        if (weight < bestDist) {
          bestDist = weight;
          targetLoot = l;
        }
      }

      // Hard bots actively hunt rivals
      if (difficulty === 'bot_hard' && Math.random() < 0.35) {
        for (const rival of this.getActivePlayers()) {
          if (rival.id === botId) continue;
          const other = this.hackers.get(rival.id);
          if (other && other.score >= h.score) {
            const distToRival = Math.hypot(other.x - h.x, other.y - h.y);
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

      const angleToTarget = Math.atan2(targetY - h.y, targetX - h.x);
      const steerX = Math.cos(angleToTarget);
      const throttleY = -Math.sin(angleToTarget);

      // Sweet spot hold-to-charge decision
      let shouldAction = false;
      const distToTarget = Math.hypot(targetX - h.x, targetY - h.y);
      if (distToTarget < 160 && !h.isCharging) {
        shouldAction = true;
      } else if (h.isCharging) {
        const sweetSpotMin = h.isUnderdog ? 0.50 : 0.72;
        const sweetSpotMax = h.isUnderdog ? 1.05 : 0.98;
        const chargeRatio = h.chargeTime / 1.0;
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

    // Laser / Cathode Scanline Sweeps
    for (let l = 0; l < 4; l++) {
      const beamAngle = Math.sin(this.globalClockPhase * 0.4 + l * 1.5) * 0.6;
      const beamX = width * (0.2 + l * 0.2);
      ctx.strokeStyle = theme.laserBeam;
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(beamX, 0);
      ctx.lineTo(beamX + Math.sin(beamAngle) * height, height);
      ctx.stroke();
    }

    // 2. Motherboard Sound Chip Stage Floor (2.5D PCB)
    const stageX = 65;
    const stageY = 90;
    const stageW = width - 130;
    const stageH = height - 155;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.roundRect(stageX + 6, stageY + 8, stageW, stageH, 18);
    ctx.fill();

    ctx.fillStyle = theme.boardFloor;
    ctx.strokeStyle = theme.circuitTrace;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(stageX, stageY, stageW, stageH, 18);
    ctx.fill();
    ctx.stroke();

    // Circuit PCB Traces
    ctx.strokeStyle = theme.circuitTrace;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.4;
    const cx = width / 2;
    const cy = height / 2 + 10;
    ctx.beginPath();
    ctx.moveTo(stageX + 20, cy);
    ctx.lineTo(cx - 50, cy);
    ctx.lineTo(cx, cy - 50);
    ctx.lineTo(cx, stageY + 20);
    ctx.moveTo(cx + 50, cy);
    ctx.lineTo(stageX + stageW - 20, cy);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // 3. Render 4 Synthesizer Channel Pins
    for (const pin of this.pins) {
      this.renderPin(ctx, pin, theme);
    }

    // 4. Render Floating Chiptune Loot
    for (const loot of this.lootList) {
      this.renderLoot(ctx, loot);
    }

    // 5. Render Chip Hackers
    for (const p of this.getActivePlayers()) {
      const h = this.hackers.get(p.id);
      if (!h) continue;
      this.renderHacker(ctx, h, p);
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

  private renderPin(ctx: CanvasRenderingContext2D, pin: SynthChannelPin, theme: VisualTheme): void {
    ctx.save();
    const scale = 1.0 + pin.pulseAmp * 0.16;

    // Pin base socket
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = theme.circuitTrace;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, pin.radius * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pin center LED
    ctx.fillStyle = pin.pulseAmp > 0.4 ? theme.pinColor : '#1E293B';
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, pin.radius * 0.45 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Pin channel name
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pin.name, pin.x, pin.y + pin.radius + 12);

    ctx.restore();
  }

  private renderLoot(ctx: CanvasRenderingContext2D, loot: ChiptuneLoot): void {
    ctx.save();
    ctx.translate(loot.x, loot.y);
    ctx.rotate(loot.spinAngle);

    const pulse = 1.0 + Math.sin(loot.pulsePhase) * 0.12;
    ctx.scale(pulse, pulse);

    if (loot.type === 'overclock_chip') {
      // Golden Overclock Microchip
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(-loot.radius, -loot.radius, loot.radius * 2, loot.radius * 2);
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-loot.radius, -loot.radius, loot.radius * 2, loot.radius * 2);

      // Chip pin connectors
      ctx.fillStyle = '#18181B';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CPU', 0, 3);
    } else if (loot.type === 'arpeggio_cartridge') {
      // Grey Game Boy Cartridge
      ctx.fillStyle = '#64748B';
      ctx.fillRect(-loot.radius, -loot.radius * 1.1, loot.radius * 2, loot.radius * 2.2);
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 2;
      ctx.strokeRect(-loot.radius, -loot.radius * 1.1, loot.radius * 2, loot.radius * 2.2);

      // Cartridge sticker label
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(-loot.radius * 0.7, -loot.radius * 0.6, loot.radius * 1.4, loot.radius * 1.2);
    } else {
      // 8-Bit Pixel Byte
      ctx.fillStyle = '#A3E635';
      ctx.fillRect(-loot.radius * 0.8, -loot.radius * 0.8, loot.radius * 1.6, loot.radius * 1.6);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-loot.radius * 0.8, -loot.radius * 0.8, loot.radius * 1.6, loot.radius * 1.6);
    }
    ctx.restore();
  }

  private renderHacker(ctx: CanvasRenderingContext2D, h: ChipHacker, p: PlayerConfig): void {
    ctx.save();

    // Underdog glowing aura ring
    if (h.isUnderdog) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(h.x, h.y, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Overdrive expanding shockwave ring
    if (h.overdriveTimer > 0) {
      const waveRadius = (1.0 - h.overdriveTimer / 0.65) * (h.isUnderdog ? 210 : 140);
      ctx.strokeStyle = '#A3E635';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(h.x, h.y, waveRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Mascot hacker
    const isBot = h.id !== 0;
    drawCharacter(ctx, h.x, h.y, 18, h.id, isBot, h.mood, h.animTimer);

    // Retro Handheld Console on Mascot
    ctx.fillStyle = '#475569';
    ctx.fillRect(h.x + 8, h.y - 8, 8, 12);
    ctx.fillStyle = '#A3E635';
    ctx.fillRect(h.x + 10, h.y - 6, 4, 4);

    // Charging indicator ring
    if (h.isCharging) {
      const norm = Math.min(1.0, h.chargeTime / 1.0);
      const isSweet = h.isUnderdog ? (norm >= 0.50 && norm <= 1.05) : (norm >= 0.72 && norm <= 0.98);

      ctx.strokeStyle = isSweet ? '#10B981' : '#F59E0B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 25, -Math.PI / 2, -Math.PI / 2 + norm * Math.PI * 2);
      ctx.stroke();

      // Sweet spot target zone tick markers
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      const startAngle = -Math.PI / 2 + (h.isUnderdog ? 0.50 : 0.72) * Math.PI * 2;
      const endAngle = -Math.PI / 2 + (h.isUnderdog ? 1.00 : 0.98) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 27, startAngle, endAngle);
      ctx.stroke();
    }

    // Stun / Glitch indicator
    if (h.stunTimer > 0 || h.overheatTimer > 0) {
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💫', h.x, h.y - 26);
    }

    // Name & Score Tag
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name}: ${h.score}`, h.x, h.y + 30);

    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number, isSuddenDeath: boolean, theme: VisualTheme): void {
    // 1. Minigame Header Badge (Safe zone y: 56, h: 26)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 190, 56, 380, 26, 13);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : theme.circuitTrace;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#FCA5A5' : '#E2E8F0';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      isSuddenDeath
        ? '⚡ 8-BIT OVERCLOCK MELTDOWN! 2X POINTS ⚡'
        : '👾 RETRO CHIPTUNE: 8-BIT OVERDRIVE & CIRCUIT BRAWL',
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
      const h = this.hackers.get(p.id);
      if (!h) return;
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
      ctx.fillText(`${h.score} pts`, pos.x + 10, pos.y + 36);

      if (h.streakCount > 1) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`🔥x${Math.min(2.5, 1.0 + (h.streakCount - 1) * 0.5).toFixed(1)}`, pos.x + 122, pos.y + 36);
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
        score: this.hackers.get(p.id)?.score || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    const winnerHacker = winnerId !== null ? this.hackers.get(winnerId) : null;
    const highlight = winnerId !== null
      ? `${this.getPlayer(winnerId)?.name} overclocked the 8-bit sound chip with squarewave blasts & ${winnerHacker?.sabotageCount || 0} circuit shunts!`
      : 'The 8-bit chiptune synthesizer locked into an arpeggio draw!';

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
