import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface BassFrequency {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'sine_wave' | 'sub_core' | 'mega_808';
  value: number;
  radius: number;
  phase: number;
  collected: boolean;
}

interface BassRaider {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  chargeTime: number; // 0 to 1.3s
  isCharging: boolean;
  overheatTimer: number; // Amp blowout stun
  groundPoundTimer: number; // Seismic bass drop shockwave burst
  stunTimer: number;
  airborneTimer: number; // In-air jump invulnerability
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
  isUnderdog: boolean;
}

interface SubwooferHazards {
  x: number;
  y: number;
  radius: number;
  pulseAmp: number;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  stageFloor: string;
  stageBorder: string;
  subwooferRim: string;
  subwooferCone: string;
  laserColor: string;
  shockwaveColor: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Cyber Bass Coliseum',
    icon: '🔮',
    bgGradTop: '#16082B',
    bgGradBottom: '#07020E',
    stageFloor: '#1E1038',
    stageBorder: '#8B5CF6',
    subwooferRim: '#5B21B6',
    subwooferCone: '#0D041A',
    laserColor: 'rgba(139, 92, 246, 0.25)',
    shockwaveColor: '#A78BFA'
  },
  {
    name: 'Electric Festival Mainstage',
    icon: '⚡',
    bgGradTop: '#1B1403',
    bgGradBottom: '#080501',
    stageFloor: '#2E2207',
    stageBorder: '#F59E0B',
    subwooferRim: '#78350F',
    subwooferCone: '#140D02',
    laserColor: 'rgba(245, 158, 11, 0.25)',
    shockwaveColor: '#FDE047'
  },
  {
    name: 'Industrial Dubstep Bunker',
    icon: '🏭',
    bgGradTop: '#1F0B08',
    bgGradBottom: '#0A0302',
    stageFloor: '#30130E',
    stageBorder: '#EF4444',
    subwooferRim: '#7F1D1D',
    subwooferCone: '#170604',
    laserColor: 'rgba(239, 68, 68, 0.25)',
    shockwaveColor: '#F87171'
  }
];

export class BassDropGame extends BaseGame {
  private raiders: Map<PlayerId, BassRaider> = new Map();
  private frequencies: BassFrequency[] = [];
  private subwoofers: SubwooferHazards[] = [];
  private currentThemeIdx: number = 0;
  private spawnTimer: number = 0;
  private freqCounter: number = 0;
  private globalPulsePhase: number = 0;
  private centralWaveRadius: number = 0;
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
    this.raiders.clear();
    this.frequencies = [];
    this.subwoofers = [];
    this.floatingTexts = [];
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.spawnTimer = 0.5;
    this.freqCounter = 0;
    this.globalPulsePhase = 0;
    this.centralWaveRadius = 0;
    this.screenShake = 0;

    // Define 4 giant corner subwoofers + 1 massive central subwoofer diaphragm
    const cx = width / 2;
    const cy = height / 2 + 10;
    this.subwoofers = [
      { x: cx, y: cy, radius: 65, pulseAmp: 0 },
      { x: 130, y: 155, radius: 42, pulseAmp: 0 },
      { x: width - 130, y: 155, radius: 42, pulseAmp: 0 },
      { x: 130, y: height - 135, radius: 42, pulseAmp: 0 },
      { x: width - 130, y: height - 135, radius: 42, pulseAmp: 0 }
    ];

    const active = this.getActivePlayers();
    const spawnOffsets = [
      { x: cx - 160, y: cy - 90 },
      { x: cx + 160, y: cy - 90 },
      { x: cx - 160, y: cy + 90 },
      { x: cx + 160, y: cy + 90 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnOffsets[idx] || { x: cx, y: cy };
      this.raiders.set(p.id, {
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
        groundPoundTimer: 0,
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

    // Seed initial bass frequencies
    for (let i = 0; i < 6; i++) {
      this.spawnFrequency(width, height);
    }
  }

  private spawnFrequency(width: number, height: number): void {
    const isSuddenDeath = this.roundTimer <= 12;
    const roll = Math.random();
    let type: 'sine_wave' | 'sub_core' | 'mega_808' = 'sine_wave';
    let value = 20;
    let radius = 13;

    if (isSuddenDeath || roll > 0.85) {
      type = 'mega_808';
      value = 75;
      radius = 18;
    } else if (roll > 0.55) {
      type = 'sub_core';
      value = 45;
      radius = 15;
    }

    const marginX = 110;
    const marginY = 110;
    const x = marginX + Math.random() * (width - marginX * 2);
    const y = marginY + Math.random() * (height - marginY * 2 - 30);

    this.frequencies.push({
      id: ++this.freqCounter,
      x,
      y,
      vx: (Math.random() - 0.5) * 28,
      vy: (Math.random() - 0.5) * 28,
      type,
      value,
      radius,
      phase: Math.random() * Math.PI * 2,
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

    // Subwoofer Pulse & Central Acoustic Shockwave Loop
    this.globalPulsePhase += (6.5 + (isSuddenDeath ? 4.5 : 0)) * dt;
    const beatTrigger = Math.sin(this.globalPulsePhase);

    // Expanding central shockwave ring
    const waveSpeed = isSuddenDeath ? 280 : 210;
    this.centralWaveRadius += waveSpeed * dt;
    if (this.centralWaveRadius > width * 0.45) {
      this.centralWaveRadius = 15;
      this.audio.playTone(55, 0.25, 'sine');
      this.screenShake = Math.min(10, this.screenShake + 4);
    }

    for (const sub of this.subwoofers) {
      sub.pulseAmp = Math.max(0, sub.pulseAmp - dt * 3.5);
      if (beatTrigger > 0.88 && sub.pulseAmp <= 0.1) {
        sub.pulseAmp = 1.0;
      }
    }

    // Spawn frequencies periodically
    this.spawnTimer -= dt;
    const maxActiveFreq = isSuddenDeath ? 12 : 8;
    if (this.spawnTimer <= 0 && this.frequencies.length < maxActiveFreq) {
      this.spawnFrequency(width, height);
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
    for (const r of this.raiders.values()) {
      if (r.score > highestScore) highestScore = r.score;
      if (r.score < lowestScore) lowestScore = r.score;
    }
    const scoreGap = highestScore - lowestScore;

    for (const r of this.raiders.values()) {
      r.isUnderdog = scoreGap >= 35 && r.score === lowestScore;
    }

    // Update AI Bots
    this.updateBots(dt, width, height);

    const cx = width / 2;
    const cy = height / 2 + 10;

    // Update Raiders
    for (const p of this.getActivePlayers()) {
      const r = this.raiders.get(p.id);
      if (!r) continue;

      r.animTimer += dt;

      // Handle Stuns & Blowout
      if (r.stunTimer > 0) {
        r.stunTimer -= dt;
        r.vx *= 0.88;
        r.vy *= 0.88;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.mood = 'shocked';
        continue;
      }

      if (r.overheatTimer > 0) {
        r.overheatTimer -= dt;
        r.vx *= 0.85;
        r.vy *= 0.85;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.mood = 'shocked';
        continue;
      }

      if (r.airborneTimer > 0) {
        r.airborneTimer -= dt;
      }

      if (r.groundPoundTimer > 0) {
        r.groundPoundTimer -= dt;
      }

      // Streak timer decay
      if (r.streakTimer > 0) {
        r.streakTimer -= dt;
        if (r.streakTimer <= 0) {
          r.streakCount = 0;
        }
      }

      // Player Movement Input via InputRouter
      const steerX = this.input.getSteer(p.id);
      const throttleY = -this.input.getThrottle(p.id);
      const actionHeld = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      const mag = Math.hypot(steerX, throttleY);
      if (mag > 0.15) {
        r.angle = Math.atan2(throttleY, steerX);
      }

      const speedMultiplier = r.isUnderdog ? 1.30 : 1.0;
      const baseSpeed = 225 * speedMultiplier;
      const accel = 1450;

      if (mag > 0.15) {
        r.vx += (steerX / mag) * accel * dt;
        r.vy += (throttleY / mag) * accel * dt;
        const currentSpeed = Math.hypot(r.vx, r.vy);
        const maxSpeed = baseSpeed * (r.isCharging ? 0.45 : 1.0);
        if (currentSpeed > maxSpeed) {
          r.vx = (r.vx / currentSpeed) * maxSpeed;
          r.vy = (r.vy / currentSpeed) * maxSpeed;
        }
      } else {
        r.vx *= 0.82;
        r.vy *= 0.82;
      }

      r.x += r.vx * dt;
      r.y += r.vy * dt;

      // Arena boundary collision
      const arenaMinX = 50;
      const arenaMaxX = width - 50;
      const arenaMinY = 95;
      const arenaMaxY = height - 65;

      if (r.x < arenaMinX) { r.x = arenaMinX; r.vx = Math.abs(r.vx) * 0.5; }
      if (r.x > arenaMaxX) { r.x = arenaMaxX; r.vx = -Math.abs(r.vx) * 0.5; }
      if (r.y < arenaMinY) { r.y = arenaMinY; r.vy = Math.abs(r.vy) * 0.5; }
      if (r.y > arenaMaxY) { r.y = arenaMaxY; r.vy = -Math.abs(r.vy) * 0.5; }

      // Subwoofer Physical Collision & Recoil
      for (const sub of this.subwoofers) {
        const distToSub = Math.hypot(r.x - sub.x, r.y - sub.y);
        const pushRadius = sub.radius + 14;
        if (distToSub < pushRadius && distToSub > 0.001) {
          const pushAngle = Math.atan2(r.y - sub.y, r.x - sub.x);
          r.vx = Math.cos(pushAngle) * 260;
          r.vy = Math.sin(pushAngle) * 260;
          r.stunTimer = 0.4;
          r.mood = 'shocked';
          this.audio.playTone(105, 0.12, 'sawtooth');
          this.particles.emit(r.x, r.y, 8, '#8B5CF6');
          this.addFloatingText(r.x, r.y - 20, 'CONE RECOIL!', '#A78BFA');
        }
      }

      // Central Shockwave Ring Hazard (knocks players unless airborne or charging jump)
      if (r.airborneTimer <= 0) {
        const distFromCenter = Math.hypot(r.x - cx, r.y - cy);
        if (Math.abs(distFromCenter - this.centralWaveRadius) < 14) {
          const pushAng = Math.atan2(r.y - cy, r.x - cx);
          r.vx += Math.cos(pushAng) * 220;
          r.vy += Math.sin(pushAng) * 220;
          r.stunTimer = 0.45;
          r.mood = 'shocked';
          this.audio.playTone(130, 0.15, 'sawtooth');
          this.particles.emit(r.x, r.y, 6, '#EF4444');
          this.addFloatingText(r.x, r.y - 18, 'SHOCKWAVE KNOCK!', '#EF4444');
        }
      }

      // Hold-to-Charge Acoustic Subwoofer Jump / Shockwave Blast
      if (actionHeld && r.stunTimer <= 0 && r.overheatTimer <= 0) {
        if (!r.isCharging) {
          r.isCharging = true;
          r.chargeTime = 0;
          r.mood = 'focused';
        }
        r.chargeTime += dt;

        // Subwoofer pitch riser
        if (Math.random() < 0.22) {
          this.audio.playTone(140 + r.chargeTime * 350, 0.04, 'triangle');
        }

        // Particle charging sparks
        if (Math.random() < 0.4) {
          this.particles.emit(r.x, r.y, 1, p.color);
        }

        // Overcharge past 1.25s -> Amplifier Blowout Stun
        if (r.chargeTime >= 1.25) {
          r.isCharging = false;
          r.chargeTime = 0;
          r.overheatTimer = 0.85;
          r.score = Math.max(0, r.score - 5);
          r.mood = 'shocked';
          this.audio.playTone(160, 0.35, 'sawtooth');
          this.particles.emit(r.x, r.y, 14, '#EF4444');
          this.addFloatingText(r.x, r.y - 25, 'AMP BLOWOUT! -5', '#EF4444');
        }
      } else if (!actionHeld && r.isCharging) {
        // Action Released -> Evaluate Sweet Spot
        r.isCharging = false;
        const normalizedCharge = r.chargeTime / 1.0;
        const isSweetSpot = r.isUnderdog
          ? (normalizedCharge >= 0.50 && normalizedCharge <= 1.05)
          : (normalizedCharge >= 0.72 && normalizedCharge <= 0.98);

        if (isSweetSpot) {
          // Trigger SEISMIC BASS DROP JUMP & GROUND POUND
          r.airborneTimer = 0.75; // Air jump invulnerability
          r.groundPoundTimer = 0.65;
          r.streakCount++;
          r.streakTimer = 4.0;
          const streakMultiplier = Math.min(2.5, 1.0 + (r.streakCount - 1) * 0.5);
          const bonusPts = Math.round(25 * streakMultiplier * (isSuddenDeath ? 2 : 1));
          r.score += bonusPts;
          r.mood = 'triumph';
          this.screenShake = 14;

          // Sonic bass tones
          this.audio.playTone(50, 0.35, 'sawtooth');
          this.audio.playTone(90, 0.2, 'sine');
          this.audio.playTone(850, 0.08, 'sawtooth');

          this.particles.emit(r.x, r.y, 25, '#8B5CF6');
          this.particles.emit(r.x, r.y, 15, '#F59E0B');
          this.addFloatingText(r.x, r.y - 30, `SEISMIC DROP! +${bonusPts}`, '#FBBF24');

          // Shockwave vacuums up frequencies in 140px radius (or 210px for Underdog)
          const vacuumRadius = r.isUnderdog ? 210 : 140;
          for (const f of this.frequencies) {
            if (f.collected) continue;
            const dist = Math.hypot(f.x - r.x, f.y - r.y);
            if (dist <= vacuumRadius) {
              f.collected = true;
              const val = Math.round(f.value * streakMultiplier * (isSuddenDeath ? 2 : 1));
              r.score += val;
              this.particles.emit(f.x, f.y, 8, '#10B981');
              this.addFloatingText(f.x, f.y - 15, `+${val}`, '#10B981');
            }
          }

          // Stun and knockback rivals in shockwave
          for (const rival of this.getActivePlayers()) {
            if (rival.id === r.id) continue;
            const other = this.raiders.get(rival.id);
            if (!other || other.airborneTimer > 0) continue;
            const d = Math.hypot(other.x - r.x, other.y - r.y);
            if (d <= vacuumRadius) {
              other.stunTimer = 0.75;
              const pushAngle = Math.atan2(other.y - r.y, other.x - r.x);
              other.vx += Math.cos(pushAngle) * 330;
              other.vy += Math.sin(pushAngle) * 330;
              other.mood = 'shocked';
              this.particles.emit(other.x, other.y, 10, '#8B5CF6');
            }
          }
        } else {
          // Off-beat release: short hop
          r.vx += Math.cos(r.angle) * 190;
          r.vy += Math.sin(r.angle) * 190;
          this.audio.playTone(260, 0.06, 'sine');
          r.mood = 'idle';
        }
        r.chargeTime = 0;
      }
    }

    // Physical Raider-to-Raider Collision & Speaker Shunt Sabotage
    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const r1 = this.raiders.get(active[i].id);
        const r2 = this.raiders.get(active[j].id);
        if (!r1 || !r2) continue;

        const dx = r2.x - r1.x;
        const dy = r2.y - r1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 42;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          r1.x -= nx * overlap * 0.5;
          r1.y -= ny * overlap * 0.5;
          r2.x += nx * overlap * 0.5;
          r2.y += ny * overlap * 0.5;

          const vRelX = r1.vx - r2.vx;
          const vRelY = r1.vy - r2.vy;
          const impulse = Math.hypot(vRelX, vRelY);

          r1.vx -= nx * 220;
          r1.vy -= ny * 220;
          r2.vx += nx * 220;
          r2.vy += ny * 220;

          // Speaker Shunt Sabotage Bonus
          if (impulse > 160) {
            const aggressor = r1.groundPoundTimer > 0 || Math.hypot(r1.vx, r1.vy) > Math.hypot(r2.vx, r2.vy) ? r1 : r2;
            const victim = aggressor === r1 ? r2 : r1;

            aggressor.score += 30;
            aggressor.sabotageCount++;
            victim.score = Math.max(0, victim.score - 10);
            victim.stunTimer = 0.70;
            victim.mood = 'shocked';
            aggressor.mood = 'triumph';

            this.audio.playTone(120, 0.18, 'sawtooth');
            this.particles.emit((r1.x + r2.x) / 2, (r1.y + r2.y) / 2, 16, '#8B5CF6');
            this.addFloatingText(aggressor.x, aggressor.y - 25, 'SPEAKER SHUNT! +30', '#8B5CF6');
            this.addFloatingText(victim.x, victim.y - 25, '-10 PTS', '#EF4444');
          }
        }
      }
    }

    // Direct Frequency Pickup
    for (const r of this.raiders.values()) {
      if (r.stunTimer > 0) continue;
      for (const f of this.frequencies) {
        if (f.collected) continue;
        const dist = Math.hypot(f.x - r.x, f.y - r.y);
        const reach = r.isUnderdog ? 36 : 26;
        if (dist < reach + f.radius) {
          f.collected = true;
          const mult = Math.min(2.5, 1.0 + r.streakCount * 0.3) * (isSuddenDeath ? 2 : 1);
          const gained = Math.round(f.value * mult);
          r.score += gained;
          r.mood = 'triumph';
          this.audio.playTone(f.type === 'mega_808' ? 780 : 560, 0.08, 'sine');
          this.particles.emit(f.x, f.y, 10, '#10B981');
          this.addFloatingText(f.x, f.y - 15, `+${gained}`, '#10B981');
        }
      }
    }

    // Filter collected frequencies
    this.frequencies = this.frequencies.filter(f => !f.collected);

    // Update remaining frequencies floating drift
    for (const f of this.frequencies) {
      f.phase += 4.2 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;

      if (f.x < 110 || f.x > width - 110) f.vx = -f.vx;
      if (f.y < 100 || f.y > height - 90) f.vy = -f.vy;
    }
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const r = this.raiders.get(botId);
    if (!r || r.stunTimer > 0) return;

    let reactionTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (reactionTimer <= 0) {
      const lag = difficulty === 'bot_hard' ? 0.10 : difficulty === 'bot_normal' ? 0.23 : 0.42;
      reactionTimer = lag + Math.random() * 0.04;
      this.botReactionTimers.set(botId, reactionTimer);

      let targetX = width / 2;
      let targetY = height / 2;
      let targetFreq: BassFrequency | null = null;

      // Select target: prefer mega 808s, then closest
      let bestDist = Infinity;
      for (const f of this.frequencies) {
        const d = Math.hypot(f.x - r.x, f.y - r.y);
        const weight = f.type === 'mega_808' ? d * 0.4 : f.type === 'sub_core' ? d * 0.7 : d;
        if (weight < bestDist) {
          bestDist = weight;
          targetFreq = f;
        }
      }

      // Hard bots hunt rivals to ground-pound them
      if (difficulty === 'bot_hard' && Math.random() < 0.35) {
        for (const rival of this.getActivePlayers()) {
          if (rival.id === botId) continue;
          const other = this.raiders.get(rival.id);
          if (other && other.score >= r.score) {
            const distToRival = Math.hypot(other.x - r.x, other.y - r.y);
            if (distToRival < 180) {
              targetX = other.x + (other.vx * 0.2);
              targetY = other.y + (other.vy * 0.2);
              targetFreq = null;
              break;
            }
          }
        }
      }

      if (targetFreq) {
        targetX = targetFreq.x;
        targetY = targetFreq.y;
      }

      // Blunder rate
      const blunderRate = difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.08 : 0.0;
      if (Math.random() < blunderRate) {
        targetX += (Math.random() - 0.5) * 200;
        targetY += (Math.random() - 0.5) * 200;
      }

      // Steering
      const angleToTarget = Math.atan2(targetY - r.y, targetX - r.x);
      const steerX = Math.cos(angleToTarget);
      const throttleY = -Math.sin(angleToTarget);

      // Hold-to-charge action decision
      let shouldAction = false;
      const distToTarget = Math.hypot(targetX - r.x, targetY - r.y);
      if (distToTarget < 160 && !r.isCharging) {
        shouldAction = true;
      } else if (r.isCharging) {
        const sweetSpotMin = r.isUnderdog ? 0.50 : 0.72;
        const sweetSpotMax = r.isUnderdog ? 1.05 : 0.98;
        const chargeRatio = r.chargeTime / 1.0;
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
      const laserAngle = Math.sin(this.globalPulsePhase * 0.4 + l * 1.6) * 0.7;
      const laserX = width * (0.2 + l * 0.2);
      ctx.strokeStyle = theme.laserColor;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(laserX, 0);
      ctx.lineTo(laserX + Math.sin(laserAngle) * height, height);
      ctx.stroke();
    }

    // 2. Central Subwoofer Arena Floor (2.5D Stadium Stage)
    const stageX = 60;
    const stageY = 85;
    const stageW = width - 120;
    const stageH = height - 150;

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

    // 3. Render 5 Subwoofers (Center Diaphragm + 4 Corner Woofers)
    for (const sub of this.subwoofers) {
      this.renderSubwoofer(ctx, sub, theme);
    }

    // 4. Central Expanding Acoustic Shockwave Ring
    ctx.strokeStyle = theme.shockwaveColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2 + 10, this.centralWaveRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 5. Render Floating Bass Frequencies
    for (const f of this.frequencies) {
      this.renderFrequency(ctx, f);
    }

    // 6. Render Bass Raiders
    for (const p of this.getActivePlayers()) {
      const r = this.raiders.get(p.id);
      if (!r) continue;
      this.renderRaider(ctx, r, p);
    }

    // 7. Floating Texts & Shockwave Bursts
    for (const ft of this.floatingTexts) {
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.globalAlpha = 1.0;
    }

    // 8. Strict Safe Layout HUD
    this.renderHUD(ctx, width, height, isSuddenDeath, theme);

    ctx.restore();
  }

  private renderSubwoofer(ctx: CanvasRenderingContext2D, sub: SubwooferHazards, theme: VisualTheme): void {
    ctx.save();
    // Subwoofer Cabinet Outer Rim
    ctx.fillStyle = theme.subwooferRim;
    ctx.beginPath();
    ctx.arc(sub.x, sub.y, sub.radius + 6, 0, Math.PI * 2);
    ctx.fill();

    // Vibrating Speaker Cone with Bass Thump
    const scale = 1.0 + sub.pulseAmp * 0.16;
    ctx.fillStyle = theme.subwooferCone;
    ctx.strokeStyle = theme.stageBorder;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(sub.x, sub.y, sub.radius * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Center Dust Cap
    ctx.fillStyle = sub.pulseAmp > 0.4 ? '#8B5CF6' : '#2D154B';
    ctx.beginPath();
    ctx.arc(sub.x, sub.y, sub.radius * 0.35 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderFrequency(ctx: CanvasRenderingContext2D, f: BassFrequency): void {
    ctx.save();
    ctx.translate(f.x, f.y);

    const pulse = 1.0 + Math.sin(f.phase) * 0.14;
    ctx.scale(pulse, pulse);

    if (f.type === 'mega_808') {
      // Golden 808 Mega-Kick
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('808', 0, 3);
    } else if (f.type === 'sub_core') {
      // Purple Sub Core Frequency
      ctx.fillStyle = '#8B5CF6';
      ctx.beginPath();
      ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#DDD6FE';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SUB', 0, 3);
    } else {
      // Cyan Sine Wave
      ctx.fillStyle = '#06B6D4';
      ctx.beginPath();
      ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#A5F3FC';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Sine wave symbol
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.quadraticCurveTo(-3, -5, 0, 0);
      ctx.quadraticCurveTo(3, 5, 6, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderRaider(ctx: CanvasRenderingContext2D, r: BassRaider, p: PlayerConfig): void {
    ctx.save();

    // Underdog glowing aura ring
    if (r.isUnderdog) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(r.x, r.y, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Seismic Ground Pound expanding shockwave ring
    if (r.groundPoundTimer > 0) {
      const waveRadius = (1.0 - r.groundPoundTimer / 0.65) * (r.isUnderdog ? 210 : 140);
      ctx.strokeStyle = '#8B5CF6';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, waveRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw Character Mascot (with airborne jump visual offset)
    const isBot = r.id !== 0;
    const yOffset = r.airborneTimer > 0 ? -12 : 0;
    drawCharacter(ctx, r.x, r.y + yOffset, 18, r.id, isBot, r.mood, r.animTimer);

    // Subwoofer Backpack on Mascot
    ctx.fillStyle = '#1E1B4B';
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(r.x - 10, r.y + yOffset - 16, 20, 10, 3);
    ctx.fill();
    ctx.stroke();

    // Charging indicator ring
    if (r.isCharging) {
      const norm = Math.min(1.0, r.chargeTime / 1.0);
      const isSweet = r.isUnderdog ? (norm >= 0.50 && norm <= 1.05) : (norm >= 0.72 && norm <= 0.98);

      ctx.strokeStyle = isSweet ? '#10B981' : '#F59E0B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 25, -Math.PI / 2, -Math.PI / 2 + norm * Math.PI * 2);
      ctx.stroke();

      // Sweet spot target zone tick markers
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      const startAngle = -Math.PI / 2 + (r.isUnderdog ? 0.50 : 0.72) * Math.PI * 2;
      const endAngle = -Math.PI / 2 + (r.isUnderdog ? 1.00 : 0.98) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 27, startAngle, endAngle);
      ctx.stroke();
    }

    // Stun / Blowout indicator
    if (r.stunTimer > 0 || r.overheatTimer > 0) {
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💫', r.x, r.y - 26);
    }

    // Name & Score Tag
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name}: ${r.score}`, r.x, r.y + 30);

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
        ? '⚡ SUB-BASS EARTHQUAKE TEMPEST! 2X POINTS ⚡'
        : '🔊 BASS DROP: SOUNDWAVE JUMP & GROUND POUND',
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
      const r = this.raiders.get(p.id);
      if (!r) return;
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
      ctx.fillText(`${r.score} pts`, pos.x + 10, pos.y + 36);

      if (r.streakCount > 1) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`🔥x${Math.min(2.5, 1.0 + (r.streakCount - 1) * 0.5).toFixed(1)}`, pos.x + 122, pos.y + 36);
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
        score: this.raiders.get(p.id)?.score || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    const winnerRaider = winnerId !== null ? this.raiders.get(winnerId) : null;
    const highlight = winnerId !== null
      ? `${this.getPlayer(winnerId)?.name} detonated seismic bass ground pounds and ${winnerRaider?.sabotageCount || 0} speaker shunts!`
      : 'The subwoofer soundwaves cancelled each other out in a harmonic draw!';

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
