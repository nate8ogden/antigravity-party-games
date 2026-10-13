import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface PitchNote {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'treble_clef' | 'harmony_chord' | 'high_c_crystal';
  value: number;
  radius: number;
  spinAngle: number;
  pulsePhase: number;
  collected: boolean;
}

interface Vocalist {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  chargeTime: number; // 0 to 1.3s
  isCharging: boolean;
  overheatTimer: number; // Voice crack stun
  beltingTimer: number; // High-C acoustic wave active
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
  isUnderdog: boolean;
}

interface MicStand {
  x: number;
  y: number;
  radius: number;
  vibrateAmp: number;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  stageFloor: string;
  stageTrim: string;
  curtainColor: string;
  micColor: string;
  spotlightColor: string;
  noteGlow: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Grand Imperial Opera',
    icon: '🎭',
    bgGradTop: '#2B0612',
    bgGradBottom: '#0D0105',
    stageFloor: '#3B101C',
    stageTrim: '#F59E0B',
    curtainColor: '#881337',
    micColor: '#D97706',
    spotlightColor: 'rgba(254, 240, 138, 0.22)',
    noteGlow: '#FDE047'
  },
  {
    name: 'Neon Tokyo Pop Arena',
    icon: '🌟',
    bgGradTop: '#1E0630',
    bgGradBottom: '#070112',
    stageFloor: '#2E0C47',
    stageTrim: '#EC4899',
    curtainColor: '#701A75',
    micColor: '#06B6D4',
    spotlightColor: 'rgba(236, 72, 153, 0.22)',
    noteGlow: '#06B6D4'
  },
  {
    name: 'Midnight Velvet Lounge',
    icon: '🎷',
    bgGradTop: '#081726',
    bgGradBottom: '#02070D',
    stageFloor: '#112940',
    stageTrim: '#38BDF8',
    curtainColor: '#0C4A6E',
    micColor: '#E2E8F0',
    spotlightColor: 'rgba(56, 189, 248, 0.22)',
    noteGlow: '#38BDF8'
  }
];

export class VocalPitchGame extends BaseGame {
  private vocalists: Map<PlayerId, Vocalist> = new Map();
  private notes: PitchNote[] = [];
  private micStands: MicStand[] = [];
  private currentThemeIdx: number = 0;
  private spawnTimer: number = 0;
  private noteCounter: number = 0;
  private globalAcousticPhase: number = 0;
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
    this.vocalists.clear();
    this.notes = [];
    this.micStands = [];
    this.floatingTexts = [];
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.spawnTimer = 0.5;
    this.noteCounter = 0;
    this.globalAcousticPhase = 0;
    this.screenShake = 0;

    // Place 4 vintage chrome/gold microphone stands on the stage
    const cx = width / 2;
    const cy = height / 2 + 10;
    this.micStands = [
      { x: cx - 140, y: cy - 75, radius: 18, vibrateAmp: 0 },
      { x: cx + 140, y: cy - 75, radius: 18, vibrateAmp: 0 },
      { x: cx - 140, y: cy + 75, radius: 18, vibrateAmp: 0 },
      { x: cx + 140, y: cy + 75, radius: 18, vibrateAmp: 0 }
    ];

    const active = this.getActivePlayers();
    const spawnOffsets = [
      { x: cx - 180, y: cy },
      { x: cx + 180, y: cy },
      { x: cx, y: cy - 110 },
      { x: cx, y: cy + 110 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnOffsets[idx] || { x: cx, y: cy };
      this.vocalists.set(p.id, {
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
        beltingTimer: 0,
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

    // Seed initial pitch notes
    for (let i = 0; i < 6; i++) {
      this.spawnPitchNote(width, height);
    }
  }

  private spawnPitchNote(width: number, height: number): void {
    const isSuddenDeath = this.roundTimer <= 12;
    const roll = Math.random();
    let type: 'treble_clef' | 'harmony_chord' | 'high_c_crystal' = 'treble_clef';
    let value = 20;
    let radius = 13;

    if (isSuddenDeath || roll > 0.85) {
      type = 'high_c_crystal';
      value = 75;
      radius = 18;
    } else if (roll > 0.55) {
      type = 'harmony_chord';
      value = 45;
      radius = 15;
    }

    const marginX = 130;
    const marginY = 120;
    const x = marginX + Math.random() * (width - marginX * 2);
    const y = marginY + Math.random() * (height - marginY * 2 - 30);

    this.notes.push({
      id: ++this.noteCounter,
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
    this.globalAcousticPhase += (5.5 + (isSuddenDeath ? 4.0 : 0)) * dt;

    // Vibrating mic stands
    for (const mic of this.micStands) {
      mic.vibrateAmp = Math.max(0, mic.vibrateAmp - dt * 3.5);
    }

    // Spawn notes periodically
    this.spawnTimer -= dt;
    const maxActiveNotes = isSuddenDeath ? 12 : 8;
    if (this.spawnTimer <= 0 && this.notes.length < maxActiveNotes) {
      this.spawnPitchNote(width, height);
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
    for (const v of this.vocalists.values()) {
      if (v.score > highestScore) highestScore = v.score;
      if (v.score < lowestScore) lowestScore = v.score;
    }
    const scoreGap = highestScore - lowestScore;

    for (const v of this.vocalists.values()) {
      v.isUnderdog = scoreGap >= 35 && v.score === lowestScore;
    }

    // Update AI Bots
    this.updateBots(dt, width, height);

    // Update Vocalists
    for (const p of this.getActivePlayers()) {
      const v = this.vocalists.get(p.id);
      if (!v) continue;

      v.animTimer += dt;

      // Handle Stuns & Voice Crack
      if (v.stunTimer > 0) {
        v.stunTimer -= dt;
        v.vx *= 0.88;
        v.vy *= 0.88;
        v.x += v.vx * dt;
        v.y += v.vy * dt;
        v.mood = 'shocked';
        continue;
      }

      if (v.overheatTimer > 0) {
        v.overheatTimer -= dt;
        v.vx *= 0.85;
        v.vy *= 0.85;
        v.x += v.vx * dt;
        v.y += v.vy * dt;
        v.mood = 'shocked';
        continue;
      }

      if (v.beltingTimer > 0) {
        v.beltingTimer -= dt;
      }

      // Streak decay
      if (v.streakTimer > 0) {
        v.streakTimer -= dt;
        if (v.streakTimer <= 0) {
          v.streakCount = 0;
        }
      }

      // Player Movement Input via InputRouter
      const steerX = this.input.getSteer(p.id);
      const throttleY = -this.input.getThrottle(p.id);
      const actionHeld = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      const mag = Math.hypot(steerX, throttleY);
      if (mag > 0.15) {
        v.angle = Math.atan2(throttleY, steerX);
      }

      const speedMultiplier = v.isUnderdog ? 1.30 : 1.0;
      const baseSpeed = 225 * speedMultiplier;
      const accel = 1450;

      if (mag > 0.15) {
        v.vx += (steerX / mag) * accel * dt;
        v.vy += (throttleY / mag) * accel * dt;
        const currentSpeed = Math.hypot(v.vx, v.vy);
        const maxSpeed = baseSpeed * (v.isCharging ? 0.45 : 1.0);
        if (currentSpeed > maxSpeed) {
          v.vx = (v.vx / currentSpeed) * maxSpeed;
          v.vy = (v.vy / currentSpeed) * maxSpeed;
        }
      } else {
        v.vx *= 0.82;
        v.vy *= 0.82;
      }

      v.x += v.vx * dt;
      v.y += v.vy * dt;

      // Arena boundary collision
      const arenaMinX = 55;
      const arenaMaxX = width - 55;
      const arenaMinY = 95;
      const arenaMaxY = height - 65;

      if (v.x < arenaMinX) { v.x = arenaMinX; v.vx = Math.abs(v.vx) * 0.5; }
      if (v.x > arenaMaxX) { v.x = arenaMaxX; v.vx = -Math.abs(v.vx) * 0.5; }
      if (v.y < arenaMinY) { v.y = arenaMinY; v.vy = Math.abs(v.vy) * 0.5; }
      if (v.y > arenaMaxY) { v.y = arenaMaxY; v.vy = -Math.abs(v.vy) * 0.5; }

      // Mic Stand Collision & Recoil
      for (const mic of this.micStands) {
        const distToMic = Math.hypot(v.x - mic.x, v.y - mic.y);
        const minDist = mic.radius + 14;
        if (distToMic < minDist && distToMic > 0.001) {
          const pushAngle = Math.atan2(v.y - mic.y, v.x - mic.x);
          v.vx = Math.cos(pushAngle) * 260;
          v.vy = Math.sin(pushAngle) * 260;
          v.stunTimer = 0.4;
          v.mood = 'shocked';
          mic.vibrateAmp = 1.0;
          this.audio.playTone(440, 0.1, 'sine');
          this.particles.emit(v.x, v.y, 8, '#F59E0B');
          this.addFloatingText(v.x, v.y - 20, 'MIC FEEDBACK!', '#F59E0B');
        }
      }

      // Hold-to-Charge Belting High-Note Sweet Spot
      if (actionHeld && v.stunTimer <= 0 && v.overheatTimer <= 0) {
        if (!v.isCharging) {
          v.isCharging = true;
          v.chargeTime = 0;
          v.mood = 'focused';
        }
        v.chargeTime += dt;

        // Vibrato ascending pitch audio
        if (Math.random() < 0.22) {
          this.audio.playTone(330 + v.chargeTime * 480, 0.04, 'sine');
        }

        // Particle vocal harmonics
        if (Math.random() < 0.4) {
          this.particles.emit(v.x, v.y, 1, p.color);
        }

        // Overcharge past 1.25s -> Voice Break / Vocal Crack Stun
        if (v.chargeTime >= 1.25) {
          v.isCharging = false;
          v.chargeTime = 0;
          v.overheatTimer = 0.85;
          v.score = Math.max(0, v.score - 5);
          v.mood = 'shocked';
          this.audio.playTone(220, 0.35, 'sawtooth');
          this.particles.emit(v.x, v.y, 14, '#EF4444');
          this.addFloatingText(v.x, v.y - 25, 'VOICE CRACK! -5', '#EF4444');
        }
      } else if (!actionHeld && v.isCharging) {
        // Action Released -> Evaluate Sweet Spot
        v.isCharging = false;
        const normalizedCharge = v.chargeTime / 1.0;
        const isSweetSpot = v.isUnderdog
          ? (normalizedCharge >= 0.50 && normalizedCharge <= 1.05)
          : (normalizedCharge >= 0.72 && normalizedCharge <= 0.98);

        if (isSweetSpot) {
          // Trigger SHATTERING HIGH-C BELTING SHOCKWAVE
          v.beltingTimer = 0.65;
          v.streakCount++;
          v.streakTimer = 4.0;
          const streakMultiplier = Math.min(2.5, 1.0 + (v.streakCount - 1) * 0.5);
          const bonusPts = Math.round(25 * streakMultiplier * (isSuddenDeath ? 2 : 1));
          v.score += bonusPts;
          v.mood = 'triumph';
          this.screenShake = 12;

          // Piercing High-C tone harmony
          this.audio.playTone(1046, 0.35, 'sine'); // High C (C6)
          this.audio.playTone(523, 0.2, 'triangle');
          this.audio.playTone(1318, 0.15, 'sine'); // E6

          this.particles.emit(v.x, v.y, 25, '#EC4899');
          this.particles.emit(v.x, v.y, 15, '#F59E0B');
          this.addFloatingText(v.x, v.y - 30, `HIGH-C BELT! +${bonusPts}`, '#FBBF24');

          // Acoustic shockwave scoops up notes in 140px radius (or 210px for Underdog)
          const vacuumRadius = v.isUnderdog ? 210 : 140;
          for (const n of this.notes) {
            if (n.collected) continue;
            const dist = Math.hypot(n.x - v.x, n.y - v.y);
            if (dist <= vacuumRadius) {
              n.collected = true;
              const val = Math.round(n.value * streakMultiplier * (isSuddenDeath ? 2 : 1));
              v.score += val;
              this.particles.emit(n.x, n.y, 8, '#10B981');
              this.addFloatingText(n.x, n.y - 15, `+${val}`, '#10B981');
            }
          }

          // Daze and knockback rivals in acoustic shockwave
          for (const rival of this.getActivePlayers()) {
            if (rival.id === v.id) continue;
            const other = this.vocalists.get(rival.id);
            if (!other) continue;
            const d = Math.hypot(other.x - v.x, other.y - v.y);
            if (d <= vacuumRadius) {
              other.stunTimer = 0.75;
              const pushAngle = Math.atan2(other.y - v.y, other.x - v.x);
              other.vx += Math.cos(pushAngle) * 330;
              other.vy += Math.sin(pushAngle) * 330;
              other.mood = 'shocked';
              this.particles.emit(other.x, other.y, 10, '#EC4899');
            }
          }
        } else {
          // Off-beat release: melodic slide forward
          v.vx += Math.cos(v.angle) * 185;
          v.vy += Math.sin(v.angle) * 185;
          this.audio.playTone(440, 0.06, 'sine');
          v.mood = 'idle';
        }
        v.chargeTime = 0;
      }
    }

    // Physical Vocalist-to-Vocalist Collision & Mic Stand Shunt Sabotage
    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const v1 = this.vocalists.get(active[i].id);
        const v2 = this.vocalists.get(active[j].id);
        if (!v1 || !v2) continue;

        const dx = v2.x - v1.x;
        const dy = v2.y - v1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 42;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          v1.x -= nx * overlap * 0.5;
          v1.y -= ny * overlap * 0.5;
          v2.x += nx * overlap * 0.5;
          v2.y += ny * overlap * 0.5;

          const vRelX = v1.vx - v2.vx;
          const vRelY = v1.vy - v2.vy;
          const impulse = Math.hypot(vRelX, vRelY);

          v1.vx -= nx * 220;
          v1.vy -= ny * 220;
          v2.vx += nx * 220;
          v2.vy += ny * 220;

          // Mic Stand Shunt Sabotage Bonus
          if (impulse > 160) {
            const aggressor = v1.beltingTimer > 0 || Math.hypot(v1.vx, v1.vy) > Math.hypot(v2.vx, v2.vy) ? v1 : v2;
            const victim = aggressor === v1 ? v2 : v1;

            aggressor.score += 30;
            aggressor.sabotageCount++;
            victim.score = Math.max(0, victim.score - 10);
            victim.stunTimer = 0.70;
            victim.mood = 'shocked';
            aggressor.mood = 'triumph';

            this.audio.playTone(180, 0.18, 'sawtooth');
            this.particles.emit((v1.x + v2.x) / 2, (v1.y + v2.y) / 2, 16, '#EC4899');
            this.addFloatingText(aggressor.x, aggressor.y - 25, 'STAGE SHUNT! +30', '#EC4899');
            this.addFloatingText(victim.x, victim.y - 25, '-10 PTS', '#EF4444');
          }
        }
      }
    }

    // Direct Note Pickup
    for (const v of this.vocalists.values()) {
      if (v.stunTimer > 0) continue;
      for (const n of this.notes) {
        if (n.collected) continue;
        const dist = Math.hypot(n.x - v.x, n.y - v.y);
        const reach = v.isUnderdog ? 36 : 26;
        if (dist < reach + n.radius) {
          n.collected = true;
          const mult = Math.min(2.5, 1.0 + v.streakCount * 0.3) * (isSuddenDeath ? 2 : 1);
          const gained = Math.round(n.value * mult);
          v.score += gained;
          v.mood = 'triumph';
          this.audio.playTone(n.type === 'high_c_crystal' ? 880 : 660, 0.08, 'sine');
          this.particles.emit(n.x, n.y, 10, '#10B981');
          this.addFloatingText(n.x, n.y - 15, `+${gained}`, '#10B981');
        }
      }
    }

    // Filter collected notes
    this.notes = this.notes.filter(n => !n.collected);

    // Update remaining notes floating drift
    for (const n of this.notes) {
      n.spinAngle += 2.0 * dt;
      n.pulsePhase += 4.0 * dt;
      n.x += n.vx * dt;
      n.y += n.vy * dt;

      if (n.x < 110 || n.x > width - 110) n.vx = -n.vx;
      if (n.y < 100 || n.y > height - 90) n.vy = -n.vy;
    }
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const v = this.vocalists.get(botId);
    if (!v || v.stunTimer > 0) return;

    let reactionTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (reactionTimer <= 0) {
      const lag = difficulty === 'bot_hard' ? 0.10 : difficulty === 'bot_normal' ? 0.23 : 0.42;
      reactionTimer = lag + Math.random() * 0.04;
      this.botReactionTimers.set(botId, reactionTimer);

      let targetX = width / 2;
      let targetY = height / 2;
      let targetNote: PitchNote | null = null;

      // Select target: prefer high C crystals, then closest
      let bestDist = Infinity;
      for (const n of this.notes) {
        const d = Math.hypot(n.x - v.x, n.y - v.y);
        const weight = n.type === 'high_c_crystal' ? d * 0.4 : n.type === 'harmony_chord' ? d * 0.7 : d;
        if (weight < bestDist) {
          bestDist = weight;
          targetNote = n;
        }
      }

      // Hard bots actively hunt rivals
      if (difficulty === 'bot_hard' && Math.random() < 0.35) {
        for (const rival of this.getActivePlayers()) {
          if (rival.id === botId) continue;
          const other = this.vocalists.get(rival.id);
          if (other && other.score >= v.score) {
            const distToRival = Math.hypot(other.x - v.x, other.y - v.y);
            if (distToRival < 180) {
              targetX = other.x + (other.vx * 0.2);
              targetY = other.y + (other.vy * 0.2);
              targetNote = null;
              break;
            }
          }
        }
      }

      if (targetNote) {
        targetX = targetNote.x;
        targetY = targetNote.y;
      }

      // Blunder rate
      const blunderRate = difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.08 : 0.0;
      if (Math.random() < blunderRate) {
        targetX += (Math.random() - 0.5) * 200;
        targetY += (Math.random() - 0.5) * 200;
      }

      const angleToTarget = Math.atan2(targetY - v.y, targetX - v.x);
      const steerX = Math.cos(angleToTarget);
      const throttleY = -Math.sin(angleToTarget);

      // Sweet spot hold-to-charge decision
      let shouldAction = false;
      const distToTarget = Math.hypot(targetX - v.x, targetY - v.y);
      if (distToTarget < 160 && !v.isCharging) {
        shouldAction = true;
      } else if (v.isCharging) {
        const sweetSpotMin = v.isUnderdog ? 0.50 : 0.72;
        const sweetSpotMax = v.isUnderdog ? 1.05 : 0.98;
        const chargeRatio = v.chargeTime / 1.0;
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

    // Spotlight Sweeps
    for (let l = 0; l < 4; l++) {
      const spotAngle = Math.sin(this.globalAcousticPhase * 0.4 + l * 1.5) * 0.6;
      const spotX = width * (0.2 + l * 0.2);
      ctx.strokeStyle = theme.spotlightColor;
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(spotX, 0);
      ctx.lineTo(spotX + Math.sin(spotAngle) * height, height);
      ctx.stroke();
    }

    // 2. Center Concert Arena Stage (2.5D Parquet)
    const stageX = 65;
    const stageY = 90;
    const stageW = width - 130;
    const stageH = height - 155;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.roundRect(stageX + 6, stageY + 8, stageW, stageH, 18);
    ctx.fill();

    ctx.fillStyle = theme.stageFloor;
    ctx.strokeStyle = theme.stageTrim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(stageX, stageY, stageW, stageH, 18);
    ctx.fill();
    ctx.stroke();

    // 3. Render 4 Microphone Stands
    for (const mic of this.micStands) {
      this.renderMicStand(ctx, mic, theme);
    }

    // 4. Render Floating Pitch Notes & Crystals
    for (const n of this.notes) {
      this.renderPitchNote(ctx, n);
    }

    // 5. Render Superstar Vocalists
    for (const p of this.getActivePlayers()) {
      const v = this.vocalists.get(p.id);
      if (!v) continue;
      this.renderVocalist(ctx, v, p);
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

  private renderMicStand(ctx: CanvasRenderingContext2D, mic: MicStand, theme: VisualTheme): void {
    ctx.save();
    const vib = (Math.random() - 0.5) * mic.vibrateAmp * 4;

    // Mic Stand Base Plate
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = theme.micColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mic.x + vib, mic.y, mic.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Vertical Stand Tube
    ctx.strokeStyle = theme.micColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mic.x + vib, mic.y);
    ctx.lineTo(mic.x + vib, mic.y - 20);
    ctx.stroke();

    // Vintage Microphone Capsule Head
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.arc(mic.x + vib, mic.y - 24, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  private renderPitchNote(ctx: CanvasRenderingContext2D, n: PitchNote): void {
    ctx.save();
    ctx.translate(n.x, n.y);
    ctx.rotate(n.spinAngle);

    const pulse = 1.0 + Math.sin(n.pulsePhase) * 0.12;
    ctx.scale(pulse, pulse);

    if (n.type === 'high_c_crystal') {
      // Platinum High-C Crystal
      ctx.fillStyle = '#E0F2FE';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -n.radius);
      ctx.lineTo(n.radius * 0.8, 0);
      ctx.lineTo(0, n.radius);
      ctx.lineTo(-n.radius * 0.8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0284C7';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HIGH-C', 0, 3);
    } else if (n.type === 'harmony_chord') {
      // Golden Harmony Chord Note
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(0, 0, n.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('♫', 0, 4);
    } else {
      // Silver Treble Clef
      ctx.fillStyle = '#94A3B8';
      ctx.beginPath();
      ctx.arc(0, 0, n.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#F1F5F9';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('♪', 0, 4);
    }
    ctx.restore();
  }

  private renderVocalist(ctx: CanvasRenderingContext2D, v: Vocalist, p: PlayerConfig): void {
    ctx.save();

    // Underdog glowing aura ring
    if (v.isUnderdog) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(v.x, v.y, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // High-C Belting expanding shockwave ring
    if (v.beltingTimer > 0) {
      const waveRadius = (1.0 - v.beltingTimer / 0.65) * (v.isUnderdog ? 210 : 140);
      ctx.strokeStyle = '#EC4899';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(v.x, v.y, waveRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw Character Mascot
    const isBot = v.id !== 0;
    drawCharacter(ctx, v.x, v.y, 18, v.id, isBot, v.mood, v.animTimer);

    // Handheld Golden Microphone on Mascot
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(v.x + 10, v.y - 12, 4, 12);
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.arc(v.x + 12, v.y - 14, 4, 0, Math.PI * 2);
    ctx.fill();

    // Charging indicator ring
    if (v.isCharging) {
      const norm = Math.min(1.0, v.chargeTime / 1.0);
      const isSweet = v.isUnderdog ? (norm >= 0.50 && norm <= 1.05) : (norm >= 0.72 && norm <= 0.98);

      ctx.strokeStyle = isSweet ? '#10B981' : '#F59E0B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(v.x, v.y, 25, -Math.PI / 2, -Math.PI / 2 + norm * Math.PI * 2);
      ctx.stroke();

      // Sweet spot target zone tick markers
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      const startAngle = -Math.PI / 2 + (v.isUnderdog ? 0.50 : 0.72) * Math.PI * 2;
      const endAngle = -Math.PI / 2 + (v.isUnderdog ? 1.00 : 0.98) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(v.x, v.y, 27, startAngle, endAngle);
      ctx.stroke();
    }

    // Stun / Voice Crack indicator
    if (v.stunTimer > 0 || v.overheatTimer > 0) {
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💫', v.x, v.y - 26);
    }

    // Name & Score Tag
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name}: ${v.score}`, v.x, v.y + 30);

    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number, isSuddenDeath: boolean, theme: VisualTheme): void {
    // 1. Minigame Header Badge (Safe zone y: 56, h: 26)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 190, 56, 380, 26, 13);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : theme.stageTrim;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#FCA5A5' : '#E2E8F0';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      isSuddenDeath
        ? '⚡ STANDING OVATION ENCORE! 2X POINTS ⚡'
        : '🎤 VOCAL PITCH: GRAND OPERA & HIGH-C BELT',
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
      const v = this.vocalists.get(p.id);
      if (!v) return;
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
      ctx.fillText(`${v.score} pts`, pos.x + 10, pos.y + 36);

      if (v.streakCount > 1) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`🔥x${Math.min(2.5, 1.0 + (v.streakCount - 1) * 0.5).toFixed(1)}`, pos.x + 122, pos.y + 36);
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
        score: this.vocalists.get(p.id)?.score || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    const winnerVocalist = winnerId !== null ? this.vocalists.get(winnerId) : null;
    const highlight = winnerId !== null
      ? `${this.getPlayer(winnerId)?.name} earned a standing ovation with shattered High-C notes & ${winnerVocalist?.sabotageCount || 0} mic stand shunts!`
      : 'The stage curtains dropped on a breathtaking vocal duel!';

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
