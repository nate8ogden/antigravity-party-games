import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface FrequencyLoot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'decibel_spark' | 'gain_crystal' | 'peak_orb';
  value: number;
  radius: number;
  spinAngle: number;
  pulsePhase: number;
  collected: boolean;
}

interface SpectrumBouncer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  chargeTime: number; // 0 to 1.3s
  isCharging: boolean;
  overheatTimer: number; // Feedback clip stun
  decibelSlamTimer: number; // Slam shockwave active
  stunTimer: number;
  airborneTimer: number; // Jump air time
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
  isUnderdog: boolean;
}

interface EqualizerBand {
  x: number;
  width: number;
  height: number;
  targetHeight: number;
  freqLabel: string;
  surgeSpeed: number;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  stageFloor: string;
  stageBorder: string;
  barLow: string;
  barMid: string;
  barPeak: string;
  laserColor: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Cyber Neon Spectrum',
    icon: '⚡',
    bgGradTop: '#0B132B',
    bgGradBottom: '#020612',
    stageFloor: '#1C2541',
    stageBorder: '#06B6D4',
    barLow: '#10B981',
    barMid: '#F59E0B',
    barPeak: '#EF4444',
    laserColor: 'rgba(6, 182, 212, 0.22)'
  },
  {
    name: 'Vintage Studio Rack',
    icon: '🎛️',
    bgGradTop: '#231508',
    bgGradBottom: '#0A0501',
    stageFloor: '#3A2411',
    stageBorder: '#D97706',
    barLow: '#84CC16',
    barMid: '#EAB308',
    barPeak: '#DC2626',
    laserColor: 'rgba(217, 119, 6, 0.22)'
  },
  {
    name: 'Holographic Rave Grid',
    icon: '🌌',
    bgGradTop: '#17082E',
    bgGradBottom: '#060110',
    stageFloor: '#28114B',
    stageBorder: '#EC4899',
    barLow: '#06B6D4',
    barMid: '#A855F7',
    barPeak: '#F43F5E',
    laserColor: 'rgba(236, 72, 153, 0.22)'
  }
];

export class EqualizerBounceGame extends BaseGame {
  private bouncers: Map<PlayerId, SpectrumBouncer> = new Map();
  private lootList: FrequencyLoot[] = [];
  private eqBands: EqualizerBand[] = [];
  private currentThemeIdx: number = 0;
  private spawnTimer: number = 0;
  private lootCounter: number = 0;
  private globalAudioPhase: number = 0;
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
    this.bouncers.clear();
    this.lootList = [];
    this.eqBands = [];
    this.floatingTexts = [];
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.spawnTimer = 0.5;
    this.lootCounter = 0;
    this.globalAudioPhase = 0;
    this.screenShake = 0;

    // Define 6 physical Equalizer frequency spectrum bands spanning the arena
    const stageX = 65;
    const stageW = width - 130;
    const numBands = 6;
    const bandW = stageW / numBands;
    const labels = ['60Hz', '250Hz', '1kHz', '4kHz', '10kHz', '16kHz'];

    for (let b = 0; b < numBands; b++) {
      this.eqBands.push({
        x: stageX + b * bandW,
        width: bandW,
        height: 60,
        targetHeight: 60,
        freqLabel: labels[b] || `${b}k`,
        surgeSpeed: 2.5 + b * 0.6
      });
    }

    const active = this.getActivePlayers();
    const cx = width / 2;
    const cy = height / 2 + 10;
    const spawnOffsets = [
      { x: cx - 140, y: cy - 70 },
      { x: cx + 140, y: cy - 70 },
      { x: cx - 140, y: cy + 70 },
      { x: cx + 140, y: cy + 70 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnOffsets[idx] || { x: cx, y: cy };
      this.bouncers.set(p.id, {
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
        decibelSlamTimer: 0,
        stunTimer: 0,
        airborneTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: 0,
        sabotageCount: 0,
        isUnderdog: false
      });
      this.botReactionTimers.set(p.id, Math.random() * 0.3);
    });

    // Seed initial frequency sparks
    for (let i = 0; i < 6; i++) {
      this.spawnLoot(width, height);
    }
  }

  private spawnLoot(width: number, height: number): void {
    const isSuddenDeath = this.roundTimer <= 12;
    const roll = Math.random();
    let type: 'decibel_spark' | 'gain_crystal' | 'peak_orb' = 'decibel_spark';
    let value = 20;
    let radius = 13;

    if (isSuddenDeath || roll > 0.85) {
      type = 'peak_orb';
      value = 75;
      radius = 18;
    } else if (roll > 0.55) {
      type = 'gain_crystal';
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
    this.globalAudioPhase += (5.5 + (isSuddenDeath ? 4.5 : 0)) * dt;

    // Equalizer bands surging height animation
    for (let b = 0; b < this.eqBands.length; b++) {
      const band = this.eqBands[b];
      const sine = Math.sin(this.globalAudioPhase * band.surgeSpeed * 0.4 + b * 1.2);
      band.targetHeight = 35 + Math.abs(sine) * (isSuddenDeath ? 140 : 100);
      band.height += (band.targetHeight - band.height) * dt * 8.0;
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
    for (const b of this.bouncers.values()) {
      if (b.score > highestScore) highestScore = b.score;
      if (b.score < lowestScore) lowestScore = b.score;
    }
    const scoreGap = highestScore - lowestScore;

    for (const b of this.bouncers.values()) {
      b.isUnderdog = scoreGap >= 35 && b.score === lowestScore;
    }

    // Update AI Bots
    this.updateBots(dt, width, height);

    // Update Bouncers
    for (const p of this.getActivePlayers()) {
      const b = this.bouncers.get(p.id);
      if (!b) continue;

      b.animTimer += dt;

      // Handle Stuns & Feedback Clip
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
        b.vx *= 0.85;
        b.vy *= 0.85;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.mood = 'shocked';
        continue;
      }

      if (b.airborneTimer > 0) {
        b.airborneTimer -= dt;
      }

      if (b.decibelSlamTimer > 0) {
        b.decibelSlamTimer -= dt;
      }

      // Streak decay
      if (b.streakTimer > 0) {
        b.streakTimer -= dt;
        if (b.streakTimer <= 0) {
          b.streakCount = 0;
        }
      }

      // Movement Input via InputRouter
      const steerX = this.input.getSteer(p.id);
      const throttleY = -this.input.getThrottle(p.id);
      const actionHeld = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      const mag = Math.hypot(steerX, throttleY);
      if (mag > 0.15) {
        b.angle = Math.atan2(throttleY, steerX);
      }

      const speedMultiplier = b.isUnderdog ? 1.30 : 1.0;
      const baseSpeed = 225 * speedMultiplier;
      const accel = 1450;

      if (mag > 0.15) {
        b.vx += (steerX / mag) * accel * dt;
        b.vy += (throttleY / mag) * accel * dt;
        const currentSpeed = Math.hypot(b.vx, b.vy);
        const maxSpeed = baseSpeed * (b.isCharging ? 0.45 : 1.0);
        if (currentSpeed > maxSpeed) {
          b.vx = (b.vx / currentSpeed) * maxSpeed;
          b.vy = (b.vy / currentSpeed) * maxSpeed;
        }
      } else {
        b.vx *= 0.82;
        b.vy *= 0.82;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Arena boundary collision
      const arenaMinX = 55;
      const arenaMaxX = width - 55;
      const arenaMinY = 95;
      const arenaMaxY = height - 65;

      if (b.x < arenaMinX) { b.x = arenaMinX; b.vx = Math.abs(b.vx) * 0.5; }
      if (b.x > arenaMaxX) { b.x = arenaMaxX; b.vx = -Math.abs(b.vx) * 0.5; }
      if (b.y < arenaMinY) { b.y = arenaMinY; b.vy = Math.abs(b.vy) * 0.5; }
      if (b.y > arenaMaxY) { b.y = arenaMaxY; b.vy = -Math.abs(b.vy) * 0.5; }

      // Physical Equalizer Trampoline Spring Check
      // If standing on a high surging band, player automatically gains trampoline spring bounce
      for (const band of this.eqBands) {
        if (b.x >= band.x && b.x <= band.x + band.width) {
          if (band.height > 95 && b.airborneTimer <= 0 && !b.isCharging) {
            b.airborneTimer = 0.55;
            b.vy = -280;
            this.audio.playTone(320 + band.height * 2.5, 0.05, 'triangle');
            this.particles.emit(b.x, b.y, 6, '#06B6D4');
          }
        }
      }

      // Hold-to-Charge Trampoline Spring / Decibel Slam Sweet Spot
      if (actionHeld && b.stunTimer <= 0 && b.overheatTimer <= 0) {
        if (!b.isCharging) {
          b.isCharging = true;
          b.chargeTime = 0;
          b.mood = 'focused';
        }
        b.chargeTime += dt;

        // Spring compression synthesizer audio
        if (Math.random() < 0.22) {
          this.audio.playTone(220 + b.chargeTime * 480, 0.04, 'sawtooth');
        }

        // Particle charging sparks
        if (Math.random() < 0.4) {
          this.particles.emit(b.x, b.y, 1, p.color);
        }

        // Overcharge past 1.25s -> Audio Clipping / Feedback Overdrive Stun
        if (b.chargeTime >= 1.25) {
          b.isCharging = false;
          b.chargeTime = 0;
          b.overheatTimer = 0.85;
          b.score = Math.max(0, b.score - 5);
          b.mood = 'shocked';
          this.audio.playTone(160, 0.35, 'sawtooth');
          this.particles.emit(b.x, b.y, 14, '#EF4444');
          this.addFloatingText(b.x, b.y - 25, 'AUDIO CLIP! -5', '#EF4444');
        }
      } else if (!actionHeld && b.isCharging) {
        // Action Released -> Evaluate Sweet Spot
        b.isCharging = false;
        const normalizedCharge = b.chargeTime / 1.0;
        const isSweetSpot = b.isUnderdog
          ? (normalizedCharge >= 0.50 && normalizedCharge <= 1.05)
          : (normalizedCharge >= 0.72 && normalizedCharge <= 0.98);

        if (isSweetSpot) {
          // Trigger PEAK DECIBEL TRAMPOLINE SLAM
          b.airborneTimer = 0.75;
          b.decibelSlamTimer = 0.65;
          b.streakCount++;
          b.streakTimer = 4.0;
          const streakMultiplier = Math.min(2.5, 1.0 + (b.streakCount - 1) * 0.5);
          const bonusPts = Math.round(25 * streakMultiplier * (isSuddenDeath ? 2 : 1));
          b.score += bonusPts;
          b.mood = 'triumph';
          this.screenShake = 12;

          // Sonic bass tones
          this.audio.playTone(65, 0.35, 'sawtooth');
          this.audio.playTone(850, 0.1, 'sine');
          this.audio.playTone(1200, 0.06, 'sawtooth');

          this.particles.emit(b.x, b.y, 25, '#10B981');
          this.particles.emit(b.x, b.y, 15, '#F59E0B');
          this.addFloatingText(b.x, b.y - 30, `DECIBEL SLAM! +${bonusPts}`, '#FBBF24');

          // Acoustic shockwave scoops up loot in 140px radius (or 210px for Underdog)
          const vacuumRadius = b.isUnderdog ? 210 : 140;
          for (const loot of this.lootList) {
            if (loot.collected) continue;
            const dist = Math.hypot(loot.x - b.x, loot.y - b.y);
            if (dist <= vacuumRadius) {
              loot.collected = true;
              const val = Math.round(loot.value * streakMultiplier * (isSuddenDeath ? 2 : 1));
              b.score += val;
              this.particles.emit(loot.x, loot.y, 8, '#10B981');
              this.addFloatingText(loot.x, loot.y - 15, `+${val}`, '#10B981');
            }
          }

          // Daze and knockback rivals in shockwave
          for (const rival of this.getActivePlayers()) {
            if (rival.id === b.id) continue;
            const other = this.bouncers.get(rival.id);
            if (!other) continue;
            const distToOther = Math.hypot(other.x - b.x, other.y - b.y);
            if (distToOther <= vacuumRadius) {
              other.stunTimer = 0.75;
              const pushAngle = Math.atan2(other.y - b.y, other.x - b.x);
              other.vx += Math.cos(pushAngle) * 330;
              other.vy += Math.sin(pushAngle) * 330;
              other.mood = 'shocked';
              this.particles.emit(other.x, other.y, 10, '#EC4899');
            }
          }
        } else {
          // Off-beat release: quick slide forward
          b.vx += Math.cos(b.angle) * 185;
          b.vy += Math.sin(b.angle) * 185;
          this.audio.playTone(320, 0.06, 'sine');
          b.mood = 'idle';
        }
        b.chargeTime = 0;
      }
    }

    // Physical Bouncer-to-Bouncer Collision & Equalizer Shunt Sabotage
    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const b1 = this.bouncers.get(active[i].id);
        const b2 = this.bouncers.get(active[j].id);
        if (!b1 || !b2) continue;

        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 42;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          b1.x -= nx * overlap * 0.5;
          b1.y -= ny * overlap * 0.5;
          b2.x += nx * overlap * 0.5;
          b2.y += ny * overlap * 0.5;

          const vRelX = b1.vx - b2.vx;
          const vRelY = b1.vy - b2.vy;
          const impulse = Math.hypot(vRelX, vRelY);

          b1.vx -= nx * 220;
          b1.vy -= ny * 220;
          b2.vx += nx * 220;
          b2.vy += ny * 220;

          // Equalizer Shunt Sabotage Bonus
          if (impulse > 160) {
            const aggressor = b1.decibelSlamTimer > 0 || Math.hypot(b1.vx, b1.vy) > Math.hypot(b2.vx, b2.vy) ? b1 : b2;
            const victim = aggressor === b1 ? b2 : b1;

            aggressor.score += 30;
            aggressor.sabotageCount++;
            victim.score = Math.max(0, victim.score - 10);
            victim.stunTimer = 0.70;
            victim.mood = 'shocked';
            aggressor.mood = 'triumph';

            this.audio.playTone(150, 0.18, 'sawtooth');
            this.particles.emit((b1.x + b2.x) / 2, (b1.y + b2.y) / 2, 16, '#F59E0B');
            this.addFloatingText(aggressor.x, aggressor.y - 25, 'SPECTRUM SHUNT! +30', '#F59E0B');
            this.addFloatingText(victim.x, victim.y - 25, '-10 PTS', '#EF4444');
          }
        }
      }
    }

    // Direct Loot Pickup
    for (const b of this.bouncers.values()) {
      if (b.stunTimer > 0) continue;
      for (const loot of this.lootList) {
        if (loot.collected) continue;
        const dist = Math.hypot(loot.x - b.x, loot.y - b.y);
        const reach = b.isUnderdog ? 36 : 26;
        if (dist < reach + loot.radius) {
          loot.collected = true;
          const mult = Math.min(2.5, 1.0 + b.streakCount * 0.3) * (isSuddenDeath ? 2 : 1);
          const gained = Math.round(loot.value * mult);
          b.score += gained;
          b.mood = 'triumph';
          this.audio.playTone(loot.type === 'peak_orb' ? 880 : 660, 0.08, 'sine');
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
    const b = this.bouncers.get(botId);
    if (!b || b.stunTimer > 0) return;

    let reactionTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (reactionTimer <= 0) {
      const lag = difficulty === 'bot_hard' ? 0.10 : difficulty === 'bot_normal' ? 0.23 : 0.42;
      reactionTimer = lag + Math.random() * 0.04;
      this.botReactionTimers.set(botId, reactionTimer);

      let targetX = width / 2;
      let targetY = height / 2;
      let targetLoot: FrequencyLoot | null = null;

      // Select target: prefer peak orbs, then gain crystals
      let bestDist = Infinity;
      for (const l of this.lootList) {
        const dist = Math.hypot(l.x - b.x, l.y - b.y);
        const weight = l.type === 'peak_orb' ? dist * 0.4 : l.type === 'gain_crystal' ? dist * 0.7 : dist;
        if (weight < bestDist) {
          bestDist = weight;
          targetLoot = l;
        }
      }

      // Hard bots actively hunt rivals
      if (difficulty === 'bot_hard' && Math.random() < 0.35) {
        for (const rival of this.getActivePlayers()) {
          if (rival.id === botId) continue;
          const other = this.bouncers.get(rival.id);
          if (other && other.score >= b.score) {
            const distToRival = Math.hypot(other.x - b.x, other.y - b.y);
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

      const angleToTarget = Math.atan2(targetY - b.y, targetX - b.x);
      const steerX = Math.cos(angleToTarget);
      const throttleY = -Math.sin(angleToTarget);

      // Sweet spot hold-to-charge decision
      let shouldAction = false;
      const distToTarget = Math.hypot(targetX - b.x, targetY - b.y);
      if (distToTarget < 160 && !b.isCharging) {
        shouldAction = true;
      } else if (b.isCharging) {
        const sweetSpotMin = b.isUnderdog ? 0.50 : 0.72;
        const sweetSpotMax = b.isUnderdog ? 1.05 : 0.98;
        const chargeRatio = b.chargeTime / 1.0;
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

    // Laser Light Sweeps
    for (let l = 0; l < 4; l++) {
      const beamAngle = Math.sin(this.globalAudioPhase * 0.4 + l * 1.5) * 0.6;
      const beamX = width * (0.2 + l * 0.2);
      ctx.strokeStyle = theme.laserColor;
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(beamX, 0);
      ctx.lineTo(beamX + Math.sin(beamAngle) * height, height);
      ctx.stroke();
    }

    // 2. Center Equalizer Spectrum Arena Stage
    const stageX = 65;
    const stageY = 90;
    const stageW = width - 130;
    const stageH = height - 155;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.roundRect(stageX + 6, stageY + 8, stageW, stageH, 18);
    ctx.fill();

    ctx.fillStyle = theme.stageFloor;
    ctx.strokeStyle = theme.stageBorder;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(stageX, stageY, stageW, stageH, 18);
    ctx.fill();
    ctx.stroke();

    // 3. Render 6 Surging Equalizer Bands on Stage Floor
    for (let b = 0; b < this.eqBands.length; b++) {
      const band = this.eqBands[b];
      const barH = band.height;
      const barY = stageY + stageH - barH - 8;

      // Equalizer bar gradient
      const barGrad = ctx.createLinearGradient(0, barY + barH, 0, barY);
      barGrad.addColorStop(0, theme.barLow);
      barGrad.addColorStop(0.65, theme.barMid);
      barGrad.addColorStop(1, theme.barPeak);

      ctx.fillStyle = barGrad;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(band.x + 4, barY, band.width - 8, barH);
      ctx.globalAlpha = 1.0;

      // Frequency label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(band.freqLabel, band.x + band.width / 2, stageY + stageH - 12);
    }

    // 4. Render Floating Frequency Loot
    for (const loot of this.lootList) {
      this.renderLoot(ctx, loot);
    }

    // 5. Render Spectrum Bouncers
    for (const p of this.getActivePlayers()) {
      const b = this.bouncers.get(p.id);
      if (!b) continue;
      this.renderBouncer(ctx, b, p);
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

  private renderLoot(ctx: CanvasRenderingContext2D, loot: FrequencyLoot): void {
    ctx.save();
    ctx.translate(loot.x, loot.y);
    ctx.rotate(loot.spinAngle);

    const pulse = 1.0 + Math.sin(loot.pulsePhase) * 0.12;
    ctx.scale(pulse, pulse);

    if (loot.type === 'peak_orb') {
      // Red Peak Overdrive Orb
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(0, 0, loot.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FCA5A5';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('0dB', 0, 3);
    } else if (loot.type === 'gain_crystal') {
      // Amber Gain Crystal
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.moveTo(0, -loot.radius);
      ctx.lineTo(loot.radius * 0.7, 0);
      ctx.lineTo(0, loot.radius);
      ctx.lineTo(-loot.radius * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // Green Decibel Spark
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(0, 0, loot.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#A7F3D0';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#064E3B';
      ctx.beginPath();
      ctx.arc(0, 0, loot.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderBouncer(ctx: CanvasRenderingContext2D, b: SpectrumBouncer, p: PlayerConfig): void {
    ctx.save();

    // Underdog glowing aura ring
    if (b.isUnderdog) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(b.x, b.y, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Decibel Slam expanding shockwave ring
    if (b.decibelSlamTimer > 0) {
      const waveRadius = (1.0 - b.decibelSlamTimer / 0.65) * (b.isUnderdog ? 210 : 140);
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(b.x, b.y, waveRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Airborne offset for trampoline jump
    const isBot = b.id !== 0;
    const yOffset = b.airborneTimer > 0 ? -14 : 0;
    drawCharacter(ctx, b.x, b.y + yOffset, 18, b.id, isBot, b.mood, b.animTimer);

    // Audio Engineer Headphones on Mascot
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y + yOffset - 12, 11, Math.PI, 0);
    ctx.stroke();
    ctx.fillRect(b.x - 13, b.y + yOffset - 8, 4, 7);
    ctx.fillRect(b.x + 9, b.y + yOffset - 8, 4, 7);

    // Charging indicator ring
    if (b.isCharging) {
      const norm = Math.min(1.0, b.chargeTime / 1.0);
      const isSweet = b.isUnderdog ? (norm >= 0.50 && norm <= 1.05) : (norm >= 0.72 && norm <= 0.98);

      ctx.strokeStyle = isSweet ? '#10B981' : '#F59E0B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 25, -Math.PI / 2, -Math.PI / 2 + norm * Math.PI * 2);
      ctx.stroke();

      // Sweet spot target zone tick markers
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      const startAngle = -Math.PI / 2 + (b.isUnderdog ? 0.50 : 0.72) * Math.PI * 2;
      const endAngle = -Math.PI / 2 + (b.isUnderdog ? 1.00 : 0.98) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 27, startAngle, endAngle);
      ctx.stroke();
    }

    // Stun / Feedback indicator
    if (b.stunTimer > 0 || b.overheatTimer > 0) {
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💫', b.x, b.y - 26);
    }

    // Name & Score Tag
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name}: ${b.score}`, b.x, b.y + 30);

    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number, isSuddenDeath: boolean, theme: VisualTheme): void {
    // 1. Minigame Header Badge (Safe zone y: 56, h: 26)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 190, 56, 380, 26, 13);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : theme.stageBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#FCA5A5' : '#E2E8F0';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      isSuddenDeath
        ? '⚡ MAXIMUM GAIN OVERDRIVE (+12dB)! 2X POINTS ⚡'
        : '📊 EQUALIZER BOUNCE: SPECTRUM SLAM & TRAMPOLINE',
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
      const b = this.bouncers.get(p.id);
      if (!b) return;
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
      ctx.fillText(`${b.score} pts`, pos.x + 10, pos.y + 36);

      if (b.streakCount > 1) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`🔥x${Math.min(2.5, 1.0 + (b.streakCount - 1) * 0.5).toFixed(1)}`, pos.x + 122, pos.y + 36);
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
        score: this.bouncers.get(p.id)?.score || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    const winnerBouncer = winnerId !== null ? this.bouncers.get(winnerId) : null;
    const highlight = winnerId !== null
      ? `${this.getPlayer(winnerId)?.name} rode the frequency bands to victory with decibel slams & ${winnerBouncer?.sabotageCount || 0} spectrum shunts!`
      : 'The audio spectrum levels leveled off in a sonic dead-heat!';

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
