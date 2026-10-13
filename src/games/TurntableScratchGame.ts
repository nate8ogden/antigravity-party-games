import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface VinylLoot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'vinyl_sample' | 'acapella_stem' | 'master_dubplate';
  value: number;
  radius: number;
  spinAngle: number;
  pulsePhase: number;
  collected: boolean;
}

interface SuperstarDJ {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  chargeTime: number; // 0 to 1.3s
  isCharging: boolean;
  overheatTimer: number; // Needle scratch screech stun
  beatDropTimer: number; // Active bass drop shockwave burst
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
  isUnderdog: boolean;
}

interface SpeakerStack {
  x: number;
  y: number;
  width: number;
  height: number;
  pulseAmp: number;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  deckBody: string;
  deckBorder: string;
  platterRim: string;
  vinylGroove: string;
  crossfaderRail: string;
  eqLedActive: string;
  laserColor: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Mega Club Mainstage',
    icon: '🎧',
    bgGradTop: '#140526',
    bgGradBottom: '#070110',
    deckBody: '#1E1233',
    deckBorder: '#A855F7',
    platterRim: '#3B1D61',
    vinylGroove: '#11091C',
    crossfaderRail: '#EC4899',
    eqLedActive: '#06B6D4',
    laserColor: 'rgba(168, 85, 247, 0.25)'
  },
  {
    name: 'Underground Vinyl Vault',
    icon: '📼',
    bgGradTop: '#241408',
    bgGradBottom: '#0D0703',
    deckBody: '#38200E',
    deckBorder: '#D97706',
    platterRim: '#522F13',
    vinylGroove: '#170B04',
    crossfaderRail: '#F59E0B',
    eqLedActive: '#10B981',
    laserColor: 'rgba(245, 158, 11, 0.25)'
  },
  {
    name: 'Cyber Rave Dome',
    icon: '⚡',
    bgGradTop: '#031E21',
    bgGradBottom: '#010A0C',
    deckBody: '#0A2E33',
    deckBorder: '#06B6D4',
    platterRim: '#0E4850',
    vinylGroove: '#021316',
    crossfaderRail: '#10B981',
    eqLedActive: '#F43F5E',
    laserColor: 'rgba(6, 182, 212, 0.25)'
  }
];

export class TurntableScratchGame extends BaseGame {
  private djs: Map<PlayerId, SuperstarDJ> = new Map();
  private samples: VinylLoot[] = [];
  private speakers: SpeakerStack[] = [];
  private currentThemeIdx: number = 0;
  private spawnTimer: number = 0;
  private sampleCounter: number = 0;
  private turntableSpinAngleL: number = 0;
  private turntableSpinAngleR: number = 0;
  private globalBeatPhase: number = 0;

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
    this.djs.clear();
    this.samples = [];
    this.speakers = [];
    this.floatingTexts = [];
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.spawnTimer = 0.5;
    this.sampleCounter = 0;
    this.turntableSpinAngleL = 0;
    this.turntableSpinAngleR = 0;
    this.globalBeatPhase = 0;

    // Define 4 corner speaker stack hazard obstacles
    this.speakers = [
      { x: 50, y: 110, width: 65, height: 110, pulseAmp: 0 },
      { x: width - 115, y: 110, width: 65, height: 110, pulseAmp: 0 },
      { x: 50, y: height - 190, width: 65, height: 100, pulseAmp: 0 },
      { x: width - 115, y: height - 190, width: 65, height: 100, pulseAmp: 0 }
    ];

    const active = this.getActivePlayers();
    const spawnOffsets = [
      { x: width * 0.28, y: height * 0.40 },
      { x: width * 0.72, y: height * 0.40 },
      { x: width * 0.35, y: height * 0.70 },
      { x: width * 0.65, y: height * 0.70 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnOffsets[idx] || { x: width * 0.5, y: height * 0.5 };
      this.djs.set(p.id, {
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
        beatDropTimer: 0,
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

    // Seed initial vinyl samples
    for (let i = 0; i < 6; i++) {
      this.spawnSample(width, height);
    }
  }

  private spawnSample(width: number, height: number): void {
    const isSuddenDeath = this.roundTimer <= 12;
    const roll = Math.random();
    let type: 'vinyl_sample' | 'acapella_stem' | 'master_dubplate' = 'vinyl_sample';
    let value = 20;
    let radius = 13;

    if (isSuddenDeath || roll > 0.85) {
      type = 'master_dubplate';
      value = 75;
      radius = 18;
    } else if (roll > 0.55) {
      type = 'acapella_stem';
      value = 45;
      radius = 15;
    }

    // Spawn inside the main DJ console arena, avoiding boundaries and corner speakers
    const marginX = 140;
    const marginY = 120;
    const x = marginX + Math.random() * (width - marginX * 2);
    const y = marginY + Math.random() * (height - marginY * 2 - 40);

    this.samples.push({
      id: ++this.sampleCounter,
      x,
      y,
      vx: (Math.random() - 0.5) * 25,
      vy: (Math.random() - 0.5) * 25,
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

    const isSuddenDeath = this.roundTimer <= 12;

    // Turntables continuous spin
    this.turntableSpinAngleL += (3.5 + (isSuddenDeath ? 2.5 : 0)) * dt;
    this.turntableSpinAngleR -= (3.5 + (isSuddenDeath ? 2.5 : 0)) * dt;
    this.globalBeatPhase += (8.0 + (isSuddenDeath ? 4.0 : 0)) * dt;

    // Speaker stacks vibration pulse
    for (const spk of this.speakers) {
      spk.pulseAmp = Math.max(0, spk.pulseAmp - dt * 3.5);
      if (Math.sin(this.globalBeatPhase) > 0.85 && spk.pulseAmp <= 0.1) {
        spk.pulseAmp = 1.0;
      }
    }

    // Spawn samples periodically
    this.spawnTimer -= dt;
    const maxActiveSamples = isSuddenDeath ? 12 : 8;
    if (this.spawnTimer <= 0 && this.samples.length < maxActiveSamples) {
      this.spawnSample(width, height);
      this.spawnTimer = isSuddenDeath ? 0.9 : 1.6;
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
    for (const dj of this.djs.values()) {
      if (dj.score > highestScore) highestScore = dj.score;
      if (dj.score < lowestScore) lowestScore = dj.score;
    }
    const scoreGap = highestScore - lowestScore;

    for (const dj of this.djs.values()) {
      dj.isUnderdog = scoreGap >= 35 && dj.score === lowestScore;
    }

    // Update AI Bots
    this.updateBots(dt, width, height);

    // Update DJs
    for (const p of this.getActivePlayers()) {
      const dj = this.djs.get(p.id);
      if (!dj) continue;

      dj.animTimer += dt;

      // Handle Stuns & Screech
      if (dj.stunTimer > 0) {
        dj.stunTimer -= dt;
        dj.vx *= 0.88;
        dj.vy *= 0.88;
        dj.x += dj.vx * dt;
        dj.y += dj.vy * dt;
        dj.mood = 'shocked';
        continue;
      }

      if (dj.overheatTimer > 0) {
        dj.overheatTimer -= dt;
        dj.vx *= 0.85;
        dj.vy *= 0.85;
        dj.x += dj.vx * dt;
        dj.y += dj.vy * dt;
        dj.mood = 'shocked';
        continue;
      }

      if (dj.beatDropTimer > 0) {
        dj.beatDropTimer -= dt;
      }

      // Streak timer decay
      if (dj.streakTimer > 0) {
        dj.streakTimer -= dt;
        if (dj.streakTimer <= 0) {
          dj.streakCount = 0;
        }
      }

      // Player Movement Input via InputRouter
      const steerX = this.input.getSteer(p.id);
      const throttleY = -this.input.getThrottle(p.id);
      const actionHeld = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      const mag = Math.hypot(steerX, throttleY);
      if (mag > 0.15) {
        dj.angle = Math.atan2(throttleY, steerX);
      }

      const speedMultiplier = dj.isUnderdog ? 1.30 : 1.0;
      const baseSpeed = 220 * speedMultiplier;
      const accel = 1400;

      if (mag > 0.15) {
        dj.vx += (steerX / mag) * accel * dt;
        dj.vy += (throttleY / mag) * accel * dt;
        const currentSpeed = Math.hypot(dj.vx, dj.vy);
        const maxSpeed = baseSpeed * (dj.isCharging ? 0.45 : 1.0);
        if (currentSpeed > maxSpeed) {
          dj.vx = (dj.vx / currentSpeed) * maxSpeed;
          dj.vy = (dj.vy / currentSpeed) * maxSpeed;
        }
      } else {
        dj.vx *= 0.82;
        dj.vy *= 0.82;
      }

      dj.x += dj.vx * dt;
      dj.y += dj.vy * dt;

      // Arena boundary collision
      const arenaMinX = 40;
      const arenaMaxX = width - 40;
      const arenaMinY = 90;
      const arenaMaxY = height - 60;

      if (dj.x < arenaMinX) { dj.x = arenaMinX; dj.vx = Math.abs(dj.vx) * 0.5; }
      if (dj.x > arenaMaxX) { dj.x = arenaMaxX; dj.vx = -Math.abs(dj.vx) * 0.5; }
      if (dj.y < arenaMinY) { dj.y = arenaMinY; dj.vy = Math.abs(dj.vy) * 0.5; }
      if (dj.y > arenaMaxY) { dj.y = arenaMaxY; dj.vy = -Math.abs(dj.vy) * 0.5; }

      // Speaker Stack Hazard Collision
      for (const spk of this.speakers) {
        const closestX = Math.max(spk.x, Math.min(dj.x, spk.x + spk.width));
        const closestY = Math.max(spk.y, Math.min(dj.y, spk.y + spk.height));
        const dist = Math.hypot(dj.x - closestX, dj.y - closestY);
        if (dist < 22) {
          const pushAngle = Math.atan2(dj.y - (spk.y + spk.height / 2), dj.x - (spk.x + spk.width / 2));
          dj.vx = Math.cos(pushAngle) * 260;
          dj.vy = Math.sin(pushAngle) * 260;
          dj.stunTimer = 0.45;
          dj.mood = 'shocked';
          this.audio.playTone(110, 0.15, 'sawtooth');
          this.particles.emit(dj.x, dj.y, 8, '#EC4899');
          this.addFloatingText(dj.x, dj.y - 20, 'SUB BASS RECOIL!', '#EC4899');
        }
      }

      // Hold-to-Charge Vinyl Scratch / Beat Drop Mechanic
      if (actionHeld && dj.stunTimer <= 0 && dj.overheatTimer <= 0) {
        if (!dj.isCharging) {
          dj.isCharging = true;
          dj.chargeTime = 0;
          dj.mood = 'focused';
        }
        dj.chargeTime += dt;

        // Scratch audio feedback
        if (Math.random() < 0.22) {
          this.audio.playTone(340 + Math.random() * 260, 0.04, 'sawtooth');
        }

        // Particle spin sparks
        if (Math.random() < 0.4) {
          this.particles.emit(dj.x, dj.y, 1, p.color);
        }

        // Overcharge past 1.25s -> Needle Screech Stun
        if (dj.chargeTime >= 1.25) {
          dj.isCharging = false;
          dj.chargeTime = 0;
          dj.overheatTimer = 0.85; // 0.85s needle slip stun
          dj.score = Math.max(0, dj.score - 5);
          dj.mood = 'shocked';
          this.audio.playTone(180, 0.35, 'sawtooth');
          this.particles.emit(dj.x, dj.y, 14, '#EF4444');
          this.addFloatingText(dj.x, dj.y - 25, 'NEEDLE SCRATCH! -5', '#EF4444');
        }
      } else if (!actionHeld && dj.isCharging) {
        // Action Released -> Evaluate Sweet Spot
        dj.isCharging = false;
        const normalizedCharge = dj.chargeTime / 1.0;
        const isSweetSpot = dj.isUnderdog
          ? (normalizedCharge >= 0.50 && normalizedCharge <= 1.05)
          : (normalizedCharge >= 0.72 && normalizedCharge <= 0.98);

        if (isSweetSpot) {
          // Trigger MEGA BEAT DROP & BASS WAVE
          dj.beatDropTimer = 0.65;
          dj.streakCount++;
          dj.streakTimer = 4.0;
          const streakMultiplier = Math.min(2.5, 1.0 + (dj.streakCount - 1) * 0.5);
          const bonusPts = Math.round(25 * streakMultiplier * (isSuddenDeath ? 2 : 1));
          dj.score += bonusPts;
          dj.mood = 'triumph';

          // Sonic sub-bass tone + crisp kick
          this.audio.playTone(60, 0.3, 'sine');
          this.audio.playTone(120, 0.15, 'triangle');
          this.audio.playTone(880, 0.08, 'sawtooth');

          this.particles.emit(dj.x, dj.y, 25, '#F59E0B');
          this.particles.emit(dj.x, dj.y, 15, '#EC4899');
          this.addFloatingText(dj.x, dj.y - 30, `BEAT DROP! +${bonusPts}`, '#FBBF24');

          // Acoustic shockwave scoops up samples in 140px radius (or 210px for Underdog)
          const vacuumRadius = dj.isUnderdog ? 210 : 140;
          for (const s of this.samples) {
            if (s.collected) continue;
            const dist = Math.hypot(s.x - dj.x, s.y - dj.y);
            if (dist <= vacuumRadius) {
              s.collected = true;
              const val = Math.round(s.value * streakMultiplier * (isSuddenDeath ? 2 : 1));
              dj.score += val;
              this.particles.emit(s.x, s.y, 8, '#10B981');
              this.addFloatingText(s.x, s.y - 15, `+${val}`, '#10B981');
            }
          }

          // Stun nearby rivals in shockwave radius
          for (const rival of this.getActivePlayers()) {
            if (rival.id === dj.id) continue;
            const other = this.djs.get(rival.id);
            if (!other) continue;
            const d = Math.hypot(other.x - dj.x, other.y - dj.y);
            if (d <= vacuumRadius) {
              other.stunTimer = 0.75;
              const pushAngle = Math.atan2(other.y - dj.y, other.x - dj.x);
              other.vx += Math.cos(pushAngle) * 320;
              other.vy += Math.sin(pushAngle) * 320;
              other.mood = 'shocked';
              this.particles.emit(other.x, other.y, 10, '#EC4899');
            }
          }
        } else {
          // Off-beat release: minor dash forward
          dj.vx += Math.cos(dj.angle) * 180;
          dj.vy += Math.sin(dj.angle) * 180;
          this.audio.playTone(280, 0.06, 'sine');
          dj.mood = 'idle';
        }
        dj.chargeTime = 0;
      }
    }

    // Physical DJ-to-DJ Collision & Crossfader Body Check
    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const dj1 = this.djs.get(active[i].id);
        const dj2 = this.djs.get(active[j].id);
        if (!dj1 || !dj2) continue;

        const dx = dj2.x - dj1.x;
        const dy = dj2.y - dj1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 42;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          dj1.x -= nx * overlap * 0.5;
          dj1.y -= ny * overlap * 0.5;
          dj2.x += nx * overlap * 0.5;
          dj2.y += ny * overlap * 0.5;

          const vRelX = dj1.vx - dj2.vx;
          const vRelY = dj1.vy - dj2.vy;
          const impulse = Math.hypot(vRelX, vRelY);

          // Elastic bounce
          dj1.vx -= nx * 220;
          dj1.vy -= ny * 220;
          dj2.vx += nx * 220;
          dj2.vy += ny * 220;

          // Crossfader Body Check Sabotage
          if (impulse > 160) {
            const aggressor = dj1.beatDropTimer > 0 || Math.hypot(dj1.vx, dj1.vy) > Math.hypot(dj2.vx, dj2.vy) ? dj1 : dj2;
            const victim = aggressor === dj1 ? dj2 : dj1;

            aggressor.score += 30;
            aggressor.sabotageCount++;
            victim.score = Math.max(0, victim.score - 10);
            victim.stunTimer = 0.70;
            victim.mood = 'shocked';
            aggressor.mood = 'triumph';

            this.audio.playTone(130, 0.18, 'sawtooth');
            this.particles.emit((dj1.x + dj2.x) / 2, (dj1.y + dj2.y) / 2, 16, '#F43F5E');
            this.addFloatingText(aggressor.x, aggressor.y - 25, 'CROSSFADER CHECK! +30', '#F43F5E');
            this.addFloatingText(victim.x, victim.y - 25, '-10 PTS', '#EF4444');
          }
        }
      }
    }

    // Direct Sample Pickup
    for (const dj of this.djs.values()) {
      if (dj.stunTimer > 0) continue;
      for (const s of this.samples) {
        if (s.collected) continue;
        const dist = Math.hypot(s.x - dj.x, s.y - dj.y);
        const reach = dj.isUnderdog ? 36 : 26;
        if (dist < reach + s.radius) {
          s.collected = true;
          const mult = Math.min(2.5, 1.0 + dj.streakCount * 0.3) * (isSuddenDeath ? 2 : 1);
          const gained = Math.round(s.value * mult);
          dj.score += gained;
          dj.mood = 'triumph';
          this.audio.playTone(s.type === 'master_dubplate' ? 780 : 540, 0.08, 'sine');
          this.particles.emit(s.x, s.y, 10, '#10B981');
          this.addFloatingText(s.x, s.y - 15, `+${gained}`, '#10B981');
        }
      }
    }

    // Filter collected samples
    this.samples = this.samples.filter(s => !s.collected);

    // Update remaining samples floating drift
    for (const s of this.samples) {
      s.spinAngle += 2.2 * dt;
      s.pulsePhase += 4.0 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      if (s.x < 130 || s.x > width - 130) s.vx = -s.vx;
      if (s.y < 110 || s.y > height - 100) s.vy = -s.vy;
    }
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const dj = this.djs.get(botId);
    if (!dj || dj.stunTimer > 0) return;

    let reactionTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (reactionTimer <= 0) {
      // Calibrated sensory-motor lag
      const lag = difficulty === 'bot_hard' ? 0.10 : difficulty === 'bot_normal' ? 0.23 : 0.42;
      reactionTimer = lag + Math.random() * 0.04;
      this.botReactionTimers.set(botId, reactionTimer);

      // AI Decision Logic
      let targetX = width / 2;
      let targetY = height / 2;
      let targetSample: VinylLoot | null = null;

      // Select target: prefer master dubplates, then closest stem/sample
      let bestDist = Infinity;
      for (const s of this.samples) {
        const d = Math.hypot(s.x - dj.x, s.y - dj.y);
        const weight = s.type === 'master_dubplate' ? d * 0.4 : s.type === 'acapella_stem' ? d * 0.7 : d;
        if (weight < bestDist) {
          bestDist = weight;
          targetSample = s;
        }
      }

      // Hard bots actively hunt rivals if nearby or leading
      if (difficulty === 'bot_hard' && Math.random() < 0.35) {
        for (const rival of this.getActivePlayers()) {
          if (rival.id === botId) continue;
          const other = this.djs.get(rival.id);
          if (other && other.score >= dj.score) {
            const distToRival = Math.hypot(other.x - dj.x, other.y - dj.y);
            if (distToRival < 180) {
              targetX = other.x + (other.vx * 0.2);
              targetY = other.y + (other.vy * 0.2);
              targetSample = null;
              break;
            }
          }
        }
      }

      if (targetSample) {
        targetX = targetSample.x;
        targetY = targetSample.y;
      }

      // Intentional blunder rate on Easy (22%) and Normal (8%)
      const blunderRate = difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.08 : 0.0;
      if (Math.random() < blunderRate) {
        targetX += (Math.random() - 0.5) * 200;
        targetY += (Math.random() - 0.5) * 200;
      }

      // Calculate directional vectors
      const angleToTarget = Math.atan2(targetY - dj.y, targetX - dj.x);
      const steerX = Math.cos(angleToTarget);
      const throttleY = -Math.sin(angleToTarget);

      // Sweet spot hold-to-charge decision
      let shouldAction = false;
      const distToTarget = Math.hypot(targetX - dj.x, targetY - dj.y);
      if (distToTarget < 160 && !dj.isCharging) {
        shouldAction = true;
      } else if (dj.isCharging) {
        const sweetSpotMin = dj.isUnderdog ? 0.50 : 0.72;
        const sweetSpotMax = dj.isUnderdog ? 1.05 : 0.98;
        const chargeRatio = dj.chargeTime / 1.0;
        if (chargeRatio >= sweetSpotMin && chargeRatio <= sweetSpotMax) {
          shouldAction = false; // Release sweet spot!
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

    // 1. Dynamic 2.5D Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Laser Light Beam Sweeps
    ctx.save();
    for (let l = 0; l < 4; l++) {
      const laserAngle = Math.sin(this.globalBeatPhase * 0.5 + l * 1.5) * 0.8;
      const laserX = width * (0.2 + l * 0.2);
      ctx.strokeStyle = theme.laserColor;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(laserX, 0);
      ctx.lineTo(laserX + Math.sin(laserAngle) * height, height);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Central DJ Mixing Console Stage (2.5D Deck Body)
    const consoleX = 70;
    const consoleY = 95;
    const consoleW = width - 140;
    const consoleH = height - 165;

    // Console Shadow & Outer Trim
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.roundRect(consoleX + 6, consoleY + 10, consoleW, consoleH, 20);
    ctx.fill();

    ctx.fillStyle = theme.deckBody;
    ctx.strokeStyle = theme.deckBorder;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(consoleX, consoleY, consoleW, consoleH, 20);
    ctx.fill();
    ctx.stroke();

    // Dual Giant Spinning Turntables (Platters)
    const platterRadius = Math.min(consoleW * 0.22, consoleH * 0.36);
    const platterLeft = { x: consoleX + consoleW * 0.26, y: consoleY + consoleH * 0.5 };
    const platterRight = { x: consoleX + consoleW * 0.74, y: consoleY + consoleH * 0.5 };

    this.renderTurntable(ctx, platterLeft.x, platterLeft.y, platterRadius, this.turntableSpinAngleL, theme, 'CH 1');
    this.renderTurntable(ctx, platterRight.x, platterRight.y, platterRadius, this.turntableSpinAngleR, theme, 'CH 2');

    // Central Mixer: Crossfader Rail & VU Equalizer Meters
    const mixerCenterX = consoleX + consoleW * 0.5;
    this.renderMixerSection(ctx, mixerCenterX, consoleY + consoleH * 0.5, consoleH * 0.7, theme);

    // 3. Render 4 Corner Speaker Stacks with Bass Thump
    for (const spk of this.speakers) {
      this.renderSpeakerStack(ctx, spk);
    }

    // 4. Render Vinyl Pickups & Stems
    for (const s of this.samples) {
      this.renderSample(ctx, s);
    }

    // 5. Render Superstar DJs
    for (const p of this.getActivePlayers()) {
      const dj = this.djs.get(p.id);
      if (!dj) continue;
      this.renderDJ(ctx, dj, p);
    }

    // 6. Floating Texts & Shockwave Rings
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
  }

  private renderTurntable(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, spinAngle: number, theme: VisualTheme, label: string): void {
    ctx.save();
    // Platter Well Shadow
    ctx.fillStyle = '#06020A';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.fill();

    // Outer Platter Rim
    ctx.fillStyle = theme.platterRim;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Strobe dots along rim
    ctx.fillStyle = '#E2E8F0';
    for (let dot = 0; dot < 24; dot++) {
      const angle = dot * (Math.PI / 12) + spinAngle * 0.4;
      const dotX = cx + Math.cos(angle) * (r - 6);
      const dotY = cy + Math.sin(angle) * (r - 6);
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vinyl Record Body
    ctx.fillStyle = theme.vinylGroove;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 12, 0, Math.PI * 2);
    ctx.fill();

    // Grooves
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let g = 0.4; g <= 0.85; g += 0.15) {
      ctx.beginPath();
      ctx.arc(cx, cy, (r - 12) * g, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Center Slipmat
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // Center Spindle
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();

    // Rotating Marker Strip on Vinyl
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(spinAngle) * (r - 14), cy + Math.sin(spinAngle) * (r - 14));
    ctx.stroke();

    // Tonearm & Needle Base
    const armBaseX = cx + r * 0.85;
    const armBaseY = cy - r * 0.85;
    ctx.fillStyle = '#94A3B8';
    ctx.beginPath();
    ctx.arc(armBaseX, armBaseY, 10, 0, Math.PI * 2);
    ctx.fill();

    // Tonearm Pivot to Needle on Record
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(armBaseX, armBaseY);
    ctx.lineTo(cx + r * 0.4, cy - r * 0.1);
    ctx.lineTo(cx + r * 0.35, cy + r * 0.15);
    ctx.stroke();

    // Cartridge Needle Head
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(cx + r * 0.31, cy + r * 0.13, 8, 12);

    // Channel label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy + r + 18);

    ctx.restore();
  }

  private renderMixerSection(ctx: CanvasRenderingContext2D, cx: number, cy: number, height: number, theme: VisualTheme): void {
    ctx.save();
    const mixerW = 60;
    const halfH = height * 0.5;

    // Mixer background trench
    ctx.fillStyle = '#0B0414';
    ctx.beginPath();
    ctx.roundRect(cx - mixerW / 2, cy - halfH, mixerW, height, 8);
    ctx.fill();

    // VU Meters (Left & Right Channel)
    const numLeds = 8;
    const ledH = 6;
    const ledGap = 3;
    for (let side = -1; side <= 1; side += 2) {
      const ledX = cx + side * 14;
      const activeLeds = Math.floor(Math.abs(Math.sin(this.globalBeatPhase * 1.5 + side)) * numLeds);
      for (let l = 0; l < numLeds; l++) {
        const ledY = cy - 40 - l * (ledH + ledGap);
        const isLit = l <= activeLeds;
        ctx.fillStyle = isLit ? (l >= 6 ? '#EF4444' : l >= 4 ? '#F59E0B' : theme.eqLedActive) : '#1E1233';
        ctx.fillRect(ledX - 4, ledY, 8, ledH);
      }
    }

    // Crossfader Rail
    const railY = cy + halfH * 0.55;
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 22, railY);
    ctx.lineTo(cx + 22, railY);
    ctx.stroke();

    // Crossfader Knob
    const faderOffset = Math.sin(this.globalBeatPhase * 0.8) * 12;
    ctx.fillStyle = theme.crossfaderRail;
    ctx.fillRect(cx + faderOffset - 5, railY - 8, 10, 16);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx + faderOffset - 5, railY - 8, 10, 16);

    ctx.restore();
  }

  private renderSpeakerStack(ctx: CanvasRenderingContext2D, spk: SpeakerStack): void {
    ctx.save();
    // Main Cabinet
    ctx.fillStyle = '#0F091A';
    ctx.strokeStyle = '#331B4D';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(spk.x, spk.y, spk.width, spk.height, 6);
    ctx.fill();
    ctx.stroke();

    // Dual Subwoofer Cones with Bass Thump scaling
    const coneRadius = spk.width * 0.32;
    const scale = 1.0 + spk.pulseAmp * 0.18;
    const cy1 = spk.y + spk.height * 0.32;
    const cy2 = spk.y + spk.height * 0.72;
    const cx = spk.x + spk.width * 0.5;

    for (const coneY of [cy1, cy2]) {
      ctx.fillStyle = '#1D132D';
      ctx.beginPath();
      ctx.arc(cx, coneY, coneRadius * scale, 0, Math.PI * 2);
      ctx.fill();

      // Cone center dust cap
      ctx.fillStyle = spk.pulseAmp > 0.4 ? '#EC4899' : '#0B0414';
      ctx.beginPath();
      ctx.arc(cx, coneY, coneRadius * 0.4 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderSample(ctx: CanvasRenderingContext2D, s: VinylLoot): void {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.spinAngle);

    // Glowing aura
    const pulse = 1.0 + Math.sin(s.pulsePhase) * 0.12;
    ctx.scale(pulse, pulse);

    if (s.type === 'master_dubplate') {
      // Golden Master Dubplate
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Center hole
      ctx.fillStyle = '#18181B';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.type === 'acapella_stem') {
      // Neon Stem Cassette / Disc
      ctx.fillStyle = '#06B6D4';
      ctx.beginPath();
      ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#A5F3FC';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Stem label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STEM', 0, 3);
    } else {
      // Black 7-inch Vinyl Sample
      ctx.fillStyle = '#18181B';
      ctx.beginPath();
      ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#71717A';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Red Center Label
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(0, 0, s.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderDJ(ctx: CanvasRenderingContext2D, dj: SuperstarDJ, p: PlayerConfig): void {
    ctx.save();

    // Underdog glowing aura ring
    if (dj.isUnderdog) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(dj.x, dj.y, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Beat Drop expanding shockwave ring
    if (dj.beatDropTimer > 0) {
      const waveRadius = (1.0 - dj.beatDropTimer / 0.65) * (dj.isUnderdog ? 210 : 140);
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(dj.x, dj.y, waveRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw Character Mascot
    const isBot = dj.id !== 0;
    drawCharacter(ctx, dj.x, dj.y, 18, dj.id, isBot, dj.mood, dj.animTimer);

    // DJ Headphones on mascot
    ctx.fillStyle = '#18181B';
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(dj.x, dj.y - 12, 11, Math.PI, 0); // Headband
    ctx.stroke();
    // Earcups
    ctx.beginPath();
    ctx.ellipse(dj.x - 12, dj.y - 6, 4, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(dj.x + 12, dj.y - 6, 4, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Charging indicator ring
    if (dj.isCharging) {
      const norm = Math.min(1.0, dj.chargeTime / 1.0);
      const isSweet = dj.isUnderdog ? (norm >= 0.50 && norm <= 1.05) : (norm >= 0.72 && norm <= 0.98);

      ctx.strokeStyle = isSweet ? '#10B981' : '#F59E0B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(dj.x, dj.y, 25, -Math.PI / 2, -Math.PI / 2 + norm * Math.PI * 2);
      ctx.stroke();

      // Sweet spot target zone tick markers
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      const startAngle = -Math.PI / 2 + (dj.isUnderdog ? 0.50 : 0.72) * Math.PI * 2;
      const endAngle = -Math.PI / 2 + (dj.isUnderdog ? 1.00 : 0.98) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(dj.x, dj.y, 27, startAngle, endAngle);
      ctx.stroke();
    }

    // Overheat / Stun star indicator
    if (dj.stunTimer > 0 || dj.overheatTimer > 0) {
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💫', dj.x, dj.y - 26);
    }

    // Name & Score Tag
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name}: ${dj.score}`, dj.x, dj.y + 30);

    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number, isSuddenDeath: boolean, theme: VisualTheme): void {
    // 1. Minigame Header Badge (Safe zone y: 56, h: 26)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 190, 56, 380, 26, 13);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : theme.deckBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#FCA5A5' : '#E2E8F0';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      isSuddenDeath
        ? '⚡ FESTIVAL HEADLINER ENCORE! 2X POINTS ⚡'
        : '🎧 TURNTABLE SCRATCH: BEAT DROP & VINYL CLASH',
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
      const dj = this.djs.get(p.id);
      if (!dj) return;
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
      ctx.fillText(`${dj.score} pts`, pos.x + 10, pos.y + 36);

      if (dj.streakCount > 1) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`🔥x${Math.min(2.5, 1.0 + (dj.streakCount - 1) * 0.5).toFixed(1)}`, pos.x + 122, pos.y + 36);
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
        score: this.djs.get(p.id)?.score || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    const winnerDJ = winnerId !== null ? this.djs.get(winnerId) : null;
    const highlight = winnerId !== null
      ? `${this.getPlayer(winnerId)?.name} owned the stage with master beat drops & ${winnerDJ?.sabotageCount || 0} crossfader body checks!`
      : 'The vinyl platter stopped spinning in a chaotic audio dead-heat!';

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
