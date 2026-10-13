import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface TempoLoot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'beat_cog' | 'tempo_quartz' | 'chrono_sphere';
  value: number;
  radius: number;
  spinAngle: number;
  pulsePhase: number;
  collected: boolean;
}

interface Timekeeper {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  chargeTime: number; // 0 to 1.3s
  isCharging: boolean;
  overheatTimer: number; // Gear jam stun
  downbeatTimer: number; // Downbeat shockwave active
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
  isUnderdog: boolean;
}

interface MetronomeTower {
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
  clockFaceFloor: string;
  clockBorder: string;
  pendulumArm: string;
  pendulumWeight: string;
  laserBeam: string;
  gearColor: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Cyber Neon Metronome',
    icon: '⚡',
    bgGradTop: '#0C1B2E',
    bgGradBottom: '#030810',
    clockFaceFloor: '#12253E',
    clockBorder: '#06B6D4',
    pendulumArm: '#38BDF8',
    pendulumWeight: '#EC4899',
    laserBeam: 'rgba(6, 182, 212, 0.22)',
    gearColor: '#0284C7'
  },
  {
    name: 'Victorian Brass Clocktower',
    icon: '🕰️',
    bgGradTop: '#241407',
    bgGradBottom: '#0A0501',
    clockFaceFloor: '#3B2310',
    clockBorder: '#F59E0B',
    pendulumArm: '#D97706',
    pendulumWeight: '#FBBF24',
    laserBeam: 'rgba(245, 158, 11, 0.22)',
    gearColor: '#92400E'
  },
  {
    name: 'Quantum Chrono Matrix',
    icon: '🔮',
    bgGradTop: '#190A2E',
    bgGradBottom: '#06020D',
    clockFaceFloor: '#291447',
    clockBorder: '#A855F7',
    pendulumArm: '#C084FC',
    pendulumWeight: '#F43F5E',
    laserBeam: 'rgba(168, 85, 247, 0.22)',
    gearColor: '#7E22CE'
  }
];

export class NeonMetronomeGame extends BaseGame {
  private timekeepers: Map<PlayerId, Timekeeper> = new Map();
  private lootList: TempoLoot[] = [];
  private towers: MetronomeTower[] = [];
  private currentThemeIdx: number = 0;
  private spawnTimer: number = 0;
  private lootCounter: number = 0;
  private pendulumAngle: number = 0;
  private pendulumSpeed: number = 3.5;
  private globalTickTimer: number = 0;
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
    this.timekeepers.clear();
    this.lootList = [];
    this.towers = [];
    this.floatingTexts = [];
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.spawnTimer = 0.5;
    this.lootCounter = 0;
    this.pendulumAngle = 0;
    this.pendulumSpeed = 3.5;
    this.globalTickTimer = 0;
    this.screenShake = 0;

    // Define 4 corner metronome towers
    const cx = width / 2;
    const cy = height / 2 + 10;
    this.towers = [
      { x: cx - 180, y: cy - 90, radius: 24, pulseAmp: 0 },
      { x: cx + 180, y: cy - 90, radius: 24, pulseAmp: 0 },
      { x: cx - 180, y: cy + 90, radius: 24, pulseAmp: 0 },
      { x: cx + 180, y: cy + 90, radius: 24, pulseAmp: 0 }
    ];

    const active = this.getActivePlayers();
    const spawnOffsets = [
      { x: cx - 120, y: cy - 60 },
      { x: cx + 120, y: cy - 60 },
      { x: cx - 120, y: cy + 60 },
      { x: cx + 120, y: cy + 60 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnOffsets[idx] || { x: cx, y: cy };
      this.timekeepers.set(p.id, {
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
        downbeatTimer: 0,
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

    // Seed initial tempo cogs
    for (let i = 0; i < 6; i++) {
      this.spawnLoot(width, height);
    }
  }

  private spawnLoot(width: number, height: number): void {
    const isSuddenDeath = this.roundTimer <= 12;
    const roll = Math.random();
    let type: 'beat_cog' | 'tempo_quartz' | 'chrono_sphere' = 'beat_cog';
    let value = 20;
    let radius = 13;

    if (isSuddenDeath || roll > 0.85) {
      type = 'chrono_sphere';
      value = 75;
      radius = 18;
    } else if (roll > 0.55) {
      type = 'tempo_quartz';
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
    this.pendulumSpeed = isSuddenDeath ? 6.5 : 3.8;

    // Metronome Pendulum Swing
    this.globalTickTimer += this.pendulumSpeed * dt;
    const prevAngle = this.pendulumAngle;
    this.pendulumAngle = Math.sin(this.globalTickTimer) * 0.72; // +/- ~41 degrees

    // Tick audio on peak swing direction reversal
    if (Math.sign(this.pendulumAngle) !== Math.sign(prevAngle)) {
      this.audio.playTone(880, 0.03, 'sine');
      for (const t of this.towers) {
        t.pulseAmp = 1.0;
      }
    }

    // Towers pulse decay
    for (const t of this.towers) {
      t.pulseAmp = Math.max(0, t.pulseAmp - dt * 4.0);
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
    for (const tk of this.timekeepers.values()) {
      if (tk.score > highestScore) highestScore = tk.score;
      if (tk.score < lowestScore) lowestScore = tk.score;
    }
    const scoreGap = highestScore - lowestScore;

    for (const tk of this.timekeepers.values()) {
      tk.isUnderdog = scoreGap >= 35 && tk.score === lowestScore;
    }

    // Update AI Bots
    this.updateBots(dt, width, height);

    const cx = width / 2;
    const cy = height / 2 + 10;
    const pendulumLength = 135;
    const pendulumBobX = cx + Math.sin(this.pendulumAngle) * pendulumLength;
    const pendulumBobY = (cy - 70) + Math.cos(this.pendulumAngle) * pendulumLength;

    // Update Timekeepers
    for (const p of this.getActivePlayers()) {
      const tk = this.timekeepers.get(p.id);
      if (!tk) continue;

      tk.animTimer += dt;

      // Handle Stuns & Gear Jam
      if (tk.stunTimer > 0) {
        tk.stunTimer -= dt;
        tk.vx *= 0.88;
        tk.vy *= 0.88;
        tk.x += tk.vx * dt;
        tk.y += tk.vy * dt;
        tk.mood = 'shocked';
        continue;
      }

      if (tk.overheatTimer > 0) {
        tk.overheatTimer -= dt;
        tk.vx *= 0.85;
        tk.vy *= 0.85;
        tk.x += tk.vx * dt;
        tk.y += tk.vy * dt;
        tk.mood = 'shocked';
        continue;
      }

      if (tk.downbeatTimer > 0) {
        tk.downbeatTimer -= dt;
      }

      // Streak decay
      if (tk.streakTimer > 0) {
        tk.streakTimer -= dt;
        if (tk.streakTimer <= 0) {
          tk.streakCount = 0;
        }
      }

      // Movement Input via InputRouter
      const steerX = this.input.getSteer(p.id);
      const throttleY = -this.input.getThrottle(p.id);
      const actionHeld = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      const mag = Math.hypot(steerX, throttleY);
      if (mag > 0.15) {
        tk.angle = Math.atan2(throttleY, steerX);
      }

      const speedMultiplier = tk.isUnderdog ? 1.30 : 1.0;
      const baseSpeed = 225 * speedMultiplier;
      const accel = 1450;

      if (mag > 0.15) {
        tk.vx += (steerX / mag) * accel * dt;
        tk.vy += (throttleY / mag) * accel * dt;
        const currentSpeed = Math.hypot(tk.vx, tk.vy);
        const maxSpeed = baseSpeed * (tk.isCharging ? 0.45 : 1.0);
        if (currentSpeed > maxSpeed) {
          tk.vx = (tk.vx / currentSpeed) * maxSpeed;
          tk.vy = (tk.vy / currentSpeed) * maxSpeed;
        }
      } else {
        tk.vx *= 0.82;
        tk.vy *= 0.82;
      }

      tk.x += tk.vx * dt;
      tk.y += tk.vy * dt;

      // Arena boundary collision
      const arenaMinX = 55;
      const arenaMaxX = width - 55;
      const arenaMinY = 95;
      const arenaMaxY = height - 65;

      if (tk.x < arenaMinX) { tk.x = arenaMinX; tk.vx = Math.abs(tk.vx) * 0.5; }
      if (tk.x > arenaMaxX) { tk.x = arenaMaxX; tk.vx = -Math.abs(tk.vx) * 0.5; }
      if (tk.y < arenaMinY) { tk.y = arenaMinY; tk.vy = Math.abs(tk.vy) * 0.5; }
      if (tk.y > arenaMaxY) { tk.y = arenaMaxY; tk.vy = -Math.abs(tk.vy) * 0.5; }

      // Central Sweeping Pendulum Bob Hazard
      const distToBob = Math.hypot(tk.x - pendulumBobX, tk.y - pendulumBobY);
      if (distToBob < 26) {
        const pushAng = Math.atan2(tk.y - pendulumBobY, tk.x - pendulumBobX);
        tk.vx = Math.cos(pushAng) * 320;
        tk.vy = Math.sin(pushAng) * 320;
        tk.stunTimer = 0.55;
        tk.mood = 'shocked';
        this.audio.playTone(180, 0.15, 'sawtooth');
        this.particles.emit(tk.x, tk.y, 12, '#EC4899');
        this.addFloatingText(tk.x, tk.y - 20, 'PENDULUM SLAM!', '#EC4899');
      }

      // Tower Hazard Collision
      for (const t of this.towers) {
        const distToTower = Math.hypot(tk.x - t.x, tk.y - t.y);
        const minDist = t.radius + 14;
        if (distToTower < minDist && distToTower > 0.001) {
          const pushAngle = Math.atan2(tk.y - t.y, tk.x - t.x);
          tk.vx = Math.cos(pushAngle) * 260;
          tk.vy = Math.sin(pushAngle) * 260;
          tk.stunTimer = 0.4;
          tk.mood = 'shocked';
          t.pulseAmp = 1.0;
          this.audio.playTone(220, 0.1, 'sawtooth');
          this.particles.emit(tk.x, tk.y, 8, '#06B6D4');
          this.addFloatingText(tk.x, tk.y - 20, 'TOWER RECOIL!', '#06B6D4');
        }
      }

      // Hold-to-Charge Tempo Sync / Downbeat Shockwave Sweet Spot
      if (actionHeld && tk.stunTimer <= 0 && tk.overheatTimer <= 0) {
        if (!tk.isCharging) {
          tk.isCharging = true;
          tk.chargeTime = 0;
          tk.mood = 'focused';
        }
        tk.chargeTime += dt;

        // Clockwork winding audio
        if (Math.random() < 0.22) {
          this.audio.playTone(400 + tk.chargeTime * 360, 0.04, 'triangle');
        }

        // Particle charging sparks
        if (Math.random() < 0.4) {
          this.particles.emit(tk.x, tk.y, 1, p.color);
        }

        // Overcharge past 1.25s -> Broken Spring / Gear Jam Stun
        if (tk.chargeTime >= 1.25) {
          tk.isCharging = false;
          tk.chargeTime = 0;
          tk.overheatTimer = 0.85;
          tk.score = Math.max(0, tk.score - 5);
          tk.mood = 'shocked';
          this.audio.playTone(150, 0.35, 'sawtooth');
          this.particles.emit(tk.x, tk.y, 14, '#EF4444');
          this.addFloatingText(tk.x, tk.y - 25, 'GEAR JAM! -5', '#EF4444');
        }
      } else if (!actionHeld && tk.isCharging) {
        // Action Released -> Evaluate Sweet Spot
        tk.isCharging = false;
        const normalizedCharge = tk.chargeTime / 1.0;
        const isSweetSpot = tk.isUnderdog
          ? (normalizedCharge >= 0.50 && normalizedCharge <= 1.05)
          : (normalizedCharge >= 0.72 && normalizedCharge <= 0.98);

        if (isSweetSpot) {
          // Trigger RESONANT DOWNBEAT SHOCKWAVE
          tk.downbeatTimer = 0.65;
          tk.streakCount++;
          tk.streakTimer = 4.0;
          const streakMultiplier = Math.min(2.5, 1.0 + (tk.streakCount - 1) * 0.5);
          const bonusPts = Math.round(25 * streakMultiplier * (isSuddenDeath ? 2 : 1));
          tk.score += bonusPts;
          tk.mood = 'triumph';
          this.screenShake = 12;

          // Sonic downbeat chime & chime
          this.audio.playTone(1050, 0.3, 'sine');
          this.audio.playTone(520, 0.15, 'triangle');
          this.audio.playTone(80, 0.2, 'sawtooth');

          this.particles.emit(tk.x, tk.y, 25, '#06B6D4');
          this.particles.emit(tk.x, tk.y, 15, '#F59E0B');
          this.addFloatingText(tk.x, tk.y - 30, `DOWNBEAT PULSE! +${bonusPts}`, '#FBBF24');

          // Acoustic shockwave scoops up loot in 140px radius (or 210px for Underdog)
          const vacuumRadius = tk.isUnderdog ? 210 : 140;
          for (const loot of this.lootList) {
            if (loot.collected) continue;
            const dist = Math.hypot(loot.x - tk.x, loot.y - tk.y);
            if (dist <= vacuumRadius) {
              loot.collected = true;
              const val = Math.round(loot.value * streakMultiplier * (isSuddenDeath ? 2 : 1));
              tk.score += val;
              this.particles.emit(loot.x, loot.y, 8, '#10B981');
              this.addFloatingText(loot.x, loot.y - 15, `+${val}`, '#10B981');
            }
          }

          // Daze and knockback rivals in shockwave
          for (const rival of this.getActivePlayers()) {
            if (rival.id === tk.id) continue;
            const other = this.timekeepers.get(rival.id);
            if (!other) continue;
            const distToOther = Math.hypot(other.x - tk.x, other.y - tk.y);
            if (distToOther <= vacuumRadius) {
              other.stunTimer = 0.75;
              const pushAngle = Math.atan2(other.y - tk.y, other.x - tk.x);
              other.vx += Math.cos(pushAngle) * 330;
              other.vy += Math.sin(pushAngle) * 330;
              other.mood = 'shocked';
              this.particles.emit(other.x, other.y, 10, '#06B6D4');
            }
          }
        } else {
          // Off-beat release: quick slide forward
          tk.vx += Math.cos(tk.angle) * 185;
          tk.vy += Math.sin(tk.angle) * 185;
          this.audio.playTone(320, 0.06, 'sine');
          tk.mood = 'idle';
        }
        tk.chargeTime = 0;
      }
    }

    // Physical Timekeeper-to-Timekeeper Collision & Pendulum Shunt Sabotage
    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const tk1 = this.timekeepers.get(active[i].id);
        const tk2 = this.timekeepers.get(active[j].id);
        if (!tk1 || !tk2) continue;

        const dx = tk2.x - tk1.x;
        const dy = tk2.y - tk1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 42;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          tk1.x -= nx * overlap * 0.5;
          tk1.y -= ny * overlap * 0.5;
          tk2.x += nx * overlap * 0.5;
          tk2.y += ny * overlap * 0.5;

          const vRelX = tk1.vx - tk2.vx;
          const vRelY = tk1.vy - tk2.vy;
          const impulse = Math.hypot(vRelX, vRelY);

          tk1.vx -= nx * 220;
          tk1.vy -= ny * 220;
          tk2.vx += nx * 220;
          tk2.vy += ny * 220;

          // Pendulum Shunt Sabotage Bonus
          if (impulse > 160) {
            const aggressor = tk1.downbeatTimer > 0 || Math.hypot(tk1.vx, tk1.vy) > Math.hypot(tk2.vx, tk2.vy) ? tk1 : tk2;
            const victim = aggressor === tk1 ? tk2 : tk1;

            aggressor.score += 30;
            aggressor.sabotageCount++;
            victim.score = Math.max(0, victim.score - 10);
            victim.stunTimer = 0.70;
            victim.mood = 'shocked';
            aggressor.mood = 'triumph';

            this.audio.playTone(160, 0.18, 'sawtooth');
            this.particles.emit((tk1.x + tk2.x) / 2, (tk1.y + tk2.y) / 2, 16, '#06B6D4');
            this.addFloatingText(aggressor.x, aggressor.y - 25, 'PENDULUM SHUNT! +30', '#06B6D4');
            this.addFloatingText(victim.x, victim.y - 25, '-10 PTS', '#EF4444');
          }
        }
      }
    }

    // Direct Loot Pickup
    for (const tk of this.timekeepers.values()) {
      if (tk.stunTimer > 0) continue;
      for (const loot of this.lootList) {
        if (loot.collected) continue;
        const dist = Math.hypot(loot.x - tk.x, loot.y - tk.y);
        const reach = tk.isUnderdog ? 36 : 26;
        if (dist < reach + loot.radius) {
          loot.collected = true;
          const mult = Math.min(2.5, 1.0 + tk.streakCount * 0.3) * (isSuddenDeath ? 2 : 1);
          const gained = Math.round(loot.value * mult);
          tk.score += gained;
          tk.mood = 'triumph';
          this.audio.playTone(loot.type === 'chrono_sphere' ? 880 : 660, 0.08, 'sine');
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
    const tk = this.timekeepers.get(botId);
    if (!tk || tk.stunTimer > 0) return;

    let reactionTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (reactionTimer <= 0) {
      const lag = difficulty === 'bot_hard' ? 0.10 : difficulty === 'bot_normal' ? 0.23 : 0.42;
      reactionTimer = lag + Math.random() * 0.04;
      this.botReactionTimers.set(botId, reactionTimer);

      let targetX = width / 2;
      let targetY = height / 2;
      let targetLoot: TempoLoot | null = null;

      // Select target: prefer chrono spheres, then quartz
      let bestDist = Infinity;
      for (const l of this.lootList) {
        const dist = Math.hypot(l.x - tk.x, l.y - tk.y);
        const weight = l.type === 'chrono_sphere' ? dist * 0.4 : l.type === 'tempo_quartz' ? dist * 0.7 : dist;
        if (weight < bestDist) {
          bestDist = weight;
          targetLoot = l;
        }
      }

      // Hard bots actively hunt rivals
      if (difficulty === 'bot_hard' && Math.random() < 0.35) {
        for (const rival of this.getActivePlayers()) {
          if (rival.id === botId) continue;
          const other = this.timekeepers.get(rival.id);
          if (other && other.score >= tk.score) {
            const distToRival = Math.hypot(other.x - tk.x, other.y - tk.y);
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

      const angleToTarget = Math.atan2(targetY - tk.y, targetX - tk.x);
      const steerX = Math.cos(angleToTarget);
      const throttleY = -Math.sin(angleToTarget);

      // Sweet spot hold-to-charge decision
      let shouldAction = false;
      const distToTarget = Math.hypot(targetX - tk.x, targetY - tk.y);
      if (distToTarget < 160 && !tk.isCharging) {
        shouldAction = true;
      } else if (tk.isCharging) {
        const sweetSpotMin = tk.isUnderdog ? 0.50 : 0.72;
        const sweetSpotMax = tk.isUnderdog ? 1.05 : 0.98;
        const chargeRatio = tk.chargeTime / 1.0;
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
      const beamAngle = Math.sin(this.globalTickTimer * 0.4 + l * 1.5) * 0.6;
      const beamX = width * (0.2 + l * 0.2);
      ctx.strokeStyle = theme.laserBeam;
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(beamX, 0);
      ctx.lineTo(beamX + Math.sin(beamAngle) * height, height);
      ctx.stroke();
    }

    // 2. Center Clockwork Metronome Arena Stage
    const stageX = 65;
    const stageY = 90;
    const stageW = width - 130;
    const stageH = height - 155;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.roundRect(stageX + 6, stageY + 8, stageW, stageH, 18);
    ctx.fill();

    ctx.fillStyle = theme.clockFaceFloor;
    ctx.strokeStyle = theme.clockBorder;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(stageX, stageY, stageW, stageH, 18);
    ctx.fill();
    ctx.stroke();

    // Central Metronome Arc & Swinging Pendulum
    const cx = width / 2;
    const cy = height / 2 + 10;
    const pendulumLength = 135;

    // Metronome Calibrated Arc Guide
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy - 70, pendulumLength, Math.PI / 2 - 0.75, Math.PI / 2 + 0.75);
    ctx.stroke();

    // Pendulum Arm
    const pendulumBobX = cx + Math.sin(this.pendulumAngle) * pendulumLength;
    const pendulumBobY = (cy - 70) + Math.cos(this.pendulumAngle) * pendulumLength;

    ctx.strokeStyle = theme.pendulumArm;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 70);
    ctx.lineTo(pendulumBobX, pendulumBobY);
    ctx.stroke();

    // Pendulum Sliding Weight
    ctx.fillStyle = theme.pendulumWeight;
    ctx.beginPath();
    ctx.arc(pendulumBobX, pendulumBobY, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. Render 4 Metronome Towers
    for (const t of this.towers) {
      this.renderTower(ctx, t, theme);
    }

    // 4. Render Floating Tempo Loot
    for (const loot of this.lootList) {
      this.renderLoot(ctx, loot);
    }

    // 5. Render Timekeepers
    for (const p of this.getActivePlayers()) {
      const tk = this.timekeepers.get(p.id);
      if (!tk) continue;
      this.renderTimekeeper(ctx, tk, p);
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

  private renderTower(ctx: CanvasRenderingContext2D, t: MetronomeTower, theme: VisualTheme): void {
    ctx.save();
    const scale = 1.0 + t.pulseAmp * 0.16;

    // Tower base
    ctx.fillStyle = theme.gearColor;
    ctx.strokeStyle = theme.clockBorder;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.radius * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Tower center beacon
    ctx.fillStyle = t.pulseAmp > 0.4 ? '#EC4899' : '#0F172A';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.radius * 0.45 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderLoot(ctx: CanvasRenderingContext2D, loot: TempoLoot): void {
    ctx.save();
    ctx.translate(loot.x, loot.y);
    ctx.rotate(loot.spinAngle);

    const pulse = 1.0 + Math.sin(loot.pulsePhase) * 0.12;
    ctx.scale(pulse, pulse);

    if (loot.type === 'chrono_sphere') {
      // Golden Chrono Sphere
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(0, 0, loot.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#18181B';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('120', 0, 3);
    } else if (loot.type === 'tempo_quartz') {
      // Silver Tempo Quartz
      ctx.fillStyle = '#06B6D4';
      ctx.beginPath();
      ctx.moveTo(0, -loot.radius);
      ctx.lineTo(loot.radius * 0.7, 0);
      ctx.lineTo(0, loot.radius);
      ctx.lineTo(-loot.radius * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#E0F2FE';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // Bronze Beat Cog
      ctx.fillStyle = '#D97706';
      ctx.beginPath();
      ctx.arc(0, 0, loot.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FDE68A';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.arc(0, 0, loot.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderTimekeeper(ctx: CanvasRenderingContext2D, tk: Timekeeper, p: PlayerConfig): void {
    ctx.save();

    // Underdog glowing aura ring
    if (tk.isUnderdog) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(tk.x, tk.y, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Downbeat expanding shockwave ring
    if (tk.downbeatTimer > 0) {
      const waveRadius = (1.0 - tk.downbeatTimer / 0.65) * (tk.isUnderdog ? 210 : 140);
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(tk.x, tk.y, waveRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw Character Mascot
    const isBot = tk.id !== 0;
    drawCharacter(ctx, tk.x, tk.y, 18, tk.id, isBot, tk.mood, tk.animTimer);

    // Conductor's Tuning Fork on Mascot
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tk.x + 10, tk.y - 4);
    ctx.lineTo(tk.x + 10, tk.y - 16);
    ctx.lineTo(tk.x + 6, tk.y - 22);
    ctx.moveTo(tk.x + 10, tk.y - 16);
    ctx.lineTo(tk.x + 14, tk.y - 22);
    ctx.stroke();

    // Charging indicator ring
    if (tk.isCharging) {
      const norm = Math.min(1.0, tk.chargeTime / 1.0);
      const isSweet = tk.isUnderdog ? (norm >= 0.50 && norm <= 1.05) : (norm >= 0.72 && norm <= 0.98);

      ctx.strokeStyle = isSweet ? '#10B981' : '#F59E0B';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(tk.x, tk.y, 25, -Math.PI / 2, -Math.PI / 2 + norm * Math.PI * 2);
      ctx.stroke();

      // Sweet spot target zone tick markers
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2;
      const startAngle = -Math.PI / 2 + (tk.isUnderdog ? 0.50 : 0.72) * Math.PI * 2;
      const endAngle = -Math.PI / 2 + (tk.isUnderdog ? 1.00 : 0.98) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(tk.x, tk.y, 27, startAngle, endAngle);
      ctx.stroke();
    }

    // Stun / Gear Jam indicator
    if (tk.stunTimer > 0 || tk.overheatTimer > 0) {
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💫', tk.x, tk.y - 26);
    }

    // Name & Score Tag
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name}: ${tk.score}`, tk.x, tk.y + 30);

    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number, isSuddenDeath: boolean, theme: VisualTheme): void {
    // 1. Minigame Header Badge (Safe zone y: 56, h: 26)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 190, 56, 380, 26, 13);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : theme.clockBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#FCA5A5' : '#E2E8F0';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      isSuddenDeath
        ? '⚡ HYPER-TEMPO OVERDRIVE (240 BPM)! 2X POINTS ⚡'
        : '⏱️ NEON METRONOME: PENDULUM SWING & DOWNBEAT CLASH',
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
      const tk = this.timekeepers.get(p.id);
      if (!tk) return;
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
      ctx.fillText(`${tk.score} pts`, pos.x + 10, pos.y + 36);

      if (tk.streakCount > 1) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`🔥x${Math.min(2.5, 1.0 + (tk.streakCount - 1) * 0.5).toFixed(1)}`, pos.x + 122, pos.y + 36);
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
        score: this.timekeepers.get(p.id)?.score || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    const winnerTK = winnerId !== null ? this.timekeepers.get(winnerId) : null;
    const highlight = winnerId !== null
      ? `${this.getPlayer(winnerId)?.name} kept clockwork rhythm with resonant downbeats & ${winnerTK?.sabotageCount || 0} pendulum shunts!`
      : 'The clockwork pendulum chimed to a halt in a perfect draw!';

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
