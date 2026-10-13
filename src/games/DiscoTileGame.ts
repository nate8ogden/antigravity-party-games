import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface DiscoLoot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'vinyl_45' | 'gold_mic' | 'platinum_mirror_ball';
  value: number;
  radius: number;
  spinAngle: number;
  pulsePhase: number;
  collected: boolean;
}

interface DiscoDancer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  chargeTime: number; // 0 to 1.3s
  isCharging: boolean;
  leapAirTimer: number; // >0 means airborne high-kick spin hover (immune to dropped tiles)
  slipTimer: number; // Split slip stun
  stunTimer: number;
  fallingTimer: number; // >0 means tumbling down into dropped tile pit
  invulnTimer: number; // Respawn invulnerability
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
  isUnderdog: boolean;
  safeGrooveBonusCount: number;
}

interface DanceTile {
  row: number;
  col: number;
  colorIdx: number;
  dropProgress: number; // 0 = fully up, 1 = fully dropped into the dark pit
  pulseAnim: number;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgTop: string;
  bgBottom: string;
  floorRim: string;
  tileColors: string[];
  tileNames: string[];
  mirrorBallFleck: string;
  laserBeam: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Studio 54 Retro Gold',
    icon: '🕺',
    bgTop: '#140727',
    bgBottom: '#07020E',
    floorRim: '#F59E0B',
    tileColors: ['#FF007F', '#FFD700', '#00F0FF', '#9333EA'],
    tileNames: ['HOT PINK', 'DISCO GOLD', 'NEON CYAN', 'VELVET PURPLE'],
    mirrorBallFleck: 'rgba(255, 235, 150, 0.75)',
    laserBeam: 'rgba(245, 158, 11, 0.25)'
  },
  {
    name: 'Neon Cyber Disco',
    icon: '⚡',
    bgTop: '#081329',
    bgBottom: '#020617',
    floorRim: '#06B6D4',
    tileColors: ['#10B981', '#EC4899', '#00D4FF', '#F59E0B'],
    tileNames: ['NEON LIME', 'CYBER PINK', 'LASER BLUE', 'ELEC AMBER'],
    mirrorBallFleck: 'rgba(100, 240, 255, 0.75)',
    laserBeam: 'rgba(6, 182, 212, 0.25)'
  },
  {
    name: 'Roller Rink Groove',
    icon: '🛼',
    bgTop: '#1E0B24',
    bgBottom: '#09030C',
    floorRim: '#EC4899',
    tileColors: ['#FF5722', '#F43F5E', '#14B8A6', '#FACC15'],
    tileNames: ['SUNSET ORANGE', 'BUBBLEGUM', 'AQUAMARINE', 'LEMON POP'],
    mirrorBallFleck: 'rgba(255, 150, 220, 0.75)',
    laserBeam: 'rgba(236, 72, 153, 0.25)'
  }
];

export class DiscoTileGame extends BaseGame {
  private dancers: Map<PlayerId, DiscoDancer> = new Map();
  private grid: DanceTile[][] = [];
  private readonly GRID_SIZE = 5; // 5x5 illuminated dance floor
  private targetColor: number = 0;
  private phase: 'dance' | 'warning' | 'drop' | 'reset' = 'dance';
  private phaseTimer: number = 2.8;
  private beatPulse: number = 0;
  private discoBallAngle: number = 0;
  private floorBounds = { x: 0, y: 0, size: 0, tileSize: 0 };

  private lootItems: DiscoLoot[] = [];
  private nextLootId: number = 1;
  private lootSpawnTimer: number = 1.0;

  private currentThemeIdx: number = 0;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private lastCanvasWidth: number = 800;
  private lastCanvasHeight: number = 600;

  // Bot sensory perception buffers
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private botTargetTiles: Map<PlayerId, { row: number; col: number }> = new Map();
  private botIntentActions: Map<PlayerId, boolean> = new Map();

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.setupThemeListeners();
    this.reset(width, height);
  }

  private setupThemeListeners(): void {
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
      const rect = {
        x: 20,
        y: this.lastCanvasHeight - 44,
        w: 170,
        h: 32
      };
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const cRect = canvas.getBoundingClientRect();
      const scaleX = this.lastCanvasWidth / cRect.width;
      const scaleY = this.lastCanvasHeight / cRect.height;
      const mx = (e.clientX - cRect.left) * scaleX;
      const my = (e.clientY - cRect.top) * scaleY;

      if (mx >= rect.x && mx <= rect.x + rect.w && my >= rect.y && my <= rect.y + rect.h) {
        this.cycleTheme();
      }
    };
    window.addEventListener('click', this.clickHandler);
  }

  private cycleTheme(): void {
    this.currentThemeIdx = (this.currentThemeIdx + 1) % THEMES.length;
    this.audio.playTone(520 + this.currentThemeIdx * 80, 0.08, 'triangle');
  }

  private setTheme(idx: number): void {
    if (idx >= 0 && idx < THEMES.length) {
      this.currentThemeIdx = idx;
      this.audio.playTone(520 + this.currentThemeIdx * 80, 0.08, 'triangle');
    }
  }

  public reset(width: number = 800, height: number = 600): void {
    this.lastCanvasWidth = width;
    this.lastCanvasHeight = height;
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.beatPulse = 0;
    this.discoBallAngle = 0;
    this.phase = 'dance';
    this.phaseTimer = 2.8;
    this.dancers.clear();
    this.lootItems = [];
    this.lootSpawnTimer = 0.8;
    this.botReactionTimers.clear();
    this.botTargetTiles.clear();
    this.botIntentActions.clear();

    const floorSize = Math.min(width * 0.72, height * 0.62);
    const startX = (width - floorSize) / 2;
    const startY = (height - floorSize) / 2 + 35;
    this.floorBounds = {
      x: startX,
      y: startY,
      size: floorSize,
      tileSize: floorSize / this.GRID_SIZE
    };

    this.regenerateGrid();
    this.targetColor = Math.floor(Math.random() * 4);

    const active = this.getActivePlayers();
    const spawnOffsets = [
      { gx: 1, gy: 1, angle: Math.PI * 0.25 },
      { gx: 3, gy: 1, angle: Math.PI * 0.75 },
      { gx: 1, gy: 3, angle: -Math.PI * 0.25 },
      { gx: 3, gy: 3, angle: -Math.PI * 0.75 }
    ];

    active.forEach((p, idx) => {
      const sp = spawnOffsets[idx % spawnOffsets.length];
      this.dancers.set(p.id, {
        id: p.id,
        x: this.floorBounds.x + (sp.gx + 0.5) * this.floorBounds.tileSize,
        y: this.floorBounds.y + (sp.gy + 0.5) * this.floorBounds.tileSize,
        vx: 0,
        vy: 0,
        angle: sp.angle,
        score: 0,
        chargeTime: 0,
        isCharging: false,
        leapAirTimer: 0,
        slipTimer: 0,
        stunTimer: 0,
        fallingTimer: 0,
        invulnTimer: 0.5,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: 0,
        sabotageCount: 0,
        isUnderdog: false,
        safeGrooveBonusCount: 0
      });
      this.botReactionTimers.set(p.id, 0);
    });

    // Spawn starting loot items
    for (let i = 0; i < 4; i++) {
      this.spawnLootItem();
    }
  }

  private regenerateGrid(): void {
    this.grid = [];
    // Ensure all 4 colors are represented evenly across the 25 tiles
    const pool: number[] = [];
    for (let c = 0; c < 4; c++) {
      for (let k = 0; k < 6; k++) {
        pool.push(c);
      }
    }
    pool.push(Math.floor(Math.random() * 4)); // 25th tile

    // Shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    let ptr = 0;
    for (let r = 0; r < this.GRID_SIZE; r++) {
      const row: DanceTile[] = [];
      for (let c = 0; c < this.GRID_SIZE; c++) {
        row.push({
          row: r,
          col: c,
          colorIdx: pool[ptr++],
          dropProgress: 0,
          pulseAnim: Math.random() * Math.PI * 2
        });
      }
      this.grid.push(row);
    }
  }

  private spawnLootItem(): void {
    if (this.lootItems.length >= 7) return;

    // Pick a random tile coordinate
    const r = Math.floor(Math.random() * this.GRID_SIZE);
    const c = Math.floor(Math.random() * this.GRID_SIZE);
    const cx = this.floorBounds.x + (c + 0.5) * this.floorBounds.tileSize;
    const cy = this.floorBounds.y + (r + 0.5) * this.floorBounds.tileSize;

    const roll = Math.random();
    let type: 'vinyl_45' | 'gold_mic' | 'platinum_mirror_ball' = 'vinyl_45';
    let val = 20;
    let rad = 13;

    if (roll < 0.2) {
      type = 'platinum_mirror_ball';
      val = 75;
      rad = 16;
    } else if (roll < 0.55) {
      type = 'gold_mic';
      val = 45;
      rad = 14;
    }

    this.lootItems.push({
      id: this.nextLootId++,
      x: cx + (Math.random() - 0.5) * (this.floorBounds.tileSize * 0.4),
      y: cy + (Math.random() - 0.5) * (this.floorBounds.tileSize * 0.4),
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20,
      type,
      value: val,
      radius: rad,
      spinAngle: Math.random() * Math.PI * 2,
      pulsePhase: Math.random() * Math.PI * 2,
      collected: false
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastCanvasWidth = width;
    this.lastCanvasHeight = height;
    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    const isSuddenDeath = this.roundTimer <= 12.0;
    const bpmSpeed = isSuddenDeath ? 5.8 : 3.8;
    this.beatPulse += dt * bpmSpeed;
    this.discoBallAngle += dt * (isSuddenDeath ? 1.4 : 0.8);

    // Floor bounds update if resized
    const floorSize = Math.min(width * 0.72, height * 0.62);
    this.floorBounds.size = floorSize;
    this.floorBounds.x = (width - floorSize) / 2;
    this.floorBounds.y = (height - floorSize) / 2 + 35;
    this.floorBounds.tileSize = floorSize / this.GRID_SIZE;

    // Underdog status check (trailing by >= 35 points)
    let maxScore = -Infinity;
    for (const d of this.dancers.values()) {
      if (d.score > maxScore) maxScore = d.score;
    }
    for (const d of this.dancers.values()) {
      d.isUnderdog = maxScore - d.score >= 35 && maxScore > 20;
    }

    // Phase management
    this.updatePhases(dt, isSuddenDeath);

    // Bot AI decision cycle
    this.updateBots(dt, width, height);

    // Update Dancers
    this.updateDancers(dt, isSuddenDeath);

    // Physical Dancer-to-Dancer collisions
    this.handleDancerCollisions(dt);

    // Update Loot items
    this.updateLoot(dt, isSuddenDeath);
  }

  private updatePhases(dt: number, isSuddenDeath: boolean): void {
    this.phaseTimer -= dt;

    // Animate tile drop/rise progress
    for (let r = 0; r < this.GRID_SIZE; r++) {
      for (let c = 0; c < this.GRID_SIZE; c++) {
        const tile = this.grid[r][c];
        tile.pulseAnim += dt * 4.0;
        if (this.phase === 'drop') {
          if (tile.colorIdx !== this.targetColor) {
            tile.dropProgress = Math.min(1.0, tile.dropProgress + dt * 4.0);
          } else {
            tile.dropProgress = 0;
          }
        } else if (this.phase === 'reset' || this.phase === 'dance') {
          tile.dropProgress = Math.max(0, tile.dropProgress - dt * 5.0);
        }
      }
    }

    if (this.phaseTimer <= 0) {
      if (this.phase === 'dance') {
        this.phase = 'warning';
        this.phaseTimer = isSuddenDeath ? 0.85 : 1.25;
        this.audio.playCountdown(false);
      } else if (this.phase === 'warning') {
        this.phase = 'drop';
        this.phaseTimer = isSuddenDeath ? 1.1 : 1.6;
        this.audio.playExplosion();
        this.evaluateSurvivalAndBonuses(isSuddenDeath);
      } else if (this.phase === 'drop') {
        this.phase = 'reset';
        this.phaseTimer = 0.55;
        this.audio.playScore();
      } else if (this.phase === 'reset') {
        this.phase = 'dance';
        this.phaseTimer = isSuddenDeath ? 1.8 : 2.7;
        this.regenerateGrid();
        this.targetColor = Math.floor(Math.random() * 4);
      }
    }
  }

  private evaluateSurvivalAndBonuses(isSuddenDeath: boolean): void {
    const mult = isSuddenDeath ? 2 : 1;
    for (const d of this.dancers.values()) {
      if (d.fallingTimer > 0) continue;

      // If dancer is airborne via Spin Leap, they safely hover over dropping tiles!
      if (d.leapAirTimer > 0) {
        d.score += 25 * mult;
        d.safeGrooveBonusCount++;
        d.mood = 'triumph';
        this.audio.playTone(680, 0.12, 'sine');
        this.particles.emit(d.x, d.y, 14, '#F59E0B');
        continue;
      }

      const col = Math.floor((d.x - this.floorBounds.x) / this.floorBounds.tileSize);
      const row = Math.floor((d.y - this.floorBounds.y) / this.floorBounds.tileSize);

      const isValid = row >= 0 && row < this.GRID_SIZE && col >= 0 && col < this.GRID_SIZE;
      const tileColor = isValid ? this.grid[row][col].colorIdx : -1;

      if (tileColor === this.targetColor) {
        // Safe on announced color!
        const bonus = 60 * mult;
        d.score += bonus;
        d.safeGrooveBonusCount++;
        d.streakCount++;
        d.streakTimer = 4.0;
        d.mood = 'triumph';
        this.audio.playTone(550 + Math.min(d.streakCount * 50, 400), 0.15, 'sine');
        const theme = THEMES[this.currentThemeIdx];
        this.particles.emit(d.x, d.y, 16, theme.tileColors[this.targetColor]);
      } else {
        // Stepped onto a dropping tile or abyss!
        d.fallingTimer = 0.85;
        d.score = Math.max(0, d.score - 30);
        d.streakCount = 0;
        d.mood = 'shocked';
        this.audio.playTone(130, 0.25, 'sawtooth');
        this.particles.emit(d.x, d.y, 22, '#EF4444');

        // Scatter loose loot when falling
        this.spawnLootItem();
      }
    }
  }

  private updateDancers(dt: number, isSuddenDeath: boolean): void {
    const active = this.getActivePlayers();
    const theme = THEMES[this.currentThemeIdx];

    for (const p of active) {
      const d = this.dancers.get(p.id);
      if (!d) continue;

      d.animTimer += dt;
      if (d.streakTimer > 0) {
        d.streakTimer -= dt;
        if (d.streakTimer <= 0) d.streakCount = 0;
      }

      if (d.invulnTimer > 0) d.invulnTimer -= dt;
      if (d.stunTimer > 0) {
        d.stunTimer -= dt;
        d.vx *= Math.pow(0.1, dt);
        d.vy *= Math.pow(0.1, dt);
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        continue;
      }

      if (d.slipTimer > 0) {
        d.slipTimer -= dt;
        d.vx *= Math.pow(0.05, dt);
        d.vy *= Math.pow(0.05, dt);
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        continue;
      }

      if (d.fallingTimer > 0) {
        d.fallingTimer -= dt;
        d.vx *= 0.8;
        d.vy *= 0.8;
        if (d.fallingTimer <= 0) {
          // Respawn dancer safely on the center tile with invulnerability
          d.x = this.floorBounds.x + (Math.floor(this.GRID_SIZE / 2) + 0.5) * this.floorBounds.tileSize;
          d.y = this.floorBounds.y + (Math.floor(this.GRID_SIZE / 2) + 0.5) * this.floorBounds.tileSize;
          d.vx = 0;
          d.vy = 0;
          d.invulnTimer = 1.2;
          d.mood = 'idle';
          this.particles.emit(d.x, d.y, 15, theme.floorRim);
        }
        continue;
      }

      if (d.leapAirTimer > 0) {
        d.leapAirTimer -= dt;
        d.angle += dt * 14.0; // High-kick spin rotation
        // Drift forward during leap
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        this.clampDancerInBounds(d);
        // Spin leap particle trail
        if (Math.random() < 0.35) {
          this.particles.emit(d.x, d.y, 2, theme.tileColors[this.targetColor]);
        }
        continue;
      }

      // Read steer & throttle inputs
      const steerX = this.input.getSteer(p.id);
      const throttleY = -this.input.getThrottle(p.id);
      const actionHeld = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      // Underdog surge bonus
      const speedMultiplier = d.isUnderdog ? 1.30 : 1.0;
      const baseMoveSpeed = 190 * speedMultiplier;

      // Handle hold-to-charge Spin Move / High-Kick Leap
      if (actionHeld) {
        d.isCharging = true;
        d.chargeTime += dt;
        d.mood = 'focused';

        // Slow down slightly while winding up spin momentum
        d.vx += steerX * baseMoveSpeed * 0.45 * dt * 8.0;
        d.vy += throttleY * baseMoveSpeed * 0.45 * dt * 8.0;
        d.vx *= Math.pow(0.04, dt);
        d.vy *= Math.pow(0.04, dt);

        if (d.chargeTime > 0.1) {
          d.angle += dt * 9.0;
        }

        // Overcharge past 1.25s triggers Disco Split Slip!
        if (d.chargeTime > 1.25) {
          d.isCharging = false;
          d.chargeTime = 0;
          d.slipTimer = 0.85;
          d.score = Math.max(0, d.score - 5);
          d.mood = 'shocked';
          this.audio.playTone(160, 0.22, 'sawtooth');
          this.particles.emit(d.x, d.y, 16, '#F87171');
        }
      } else {
        if (d.isCharging) {
          // Releasing charged action: check sweet spot!
          d.isCharging = false;
          const sweetMin = d.isUnderdog ? 0.50 : 0.72;
          const sweetMax = d.isUnderdog ? 1.05 : 0.98;

          if (d.chargeTime >= sweetMin && d.chargeTime <= sweetMax) {
            // PERFECT SWEET SPOT: Acrobatic High-Kick Leap & Spin Hover!
            d.leapAirTimer = 0.85;
            d.mood = 'triumph';
            const mult = isSuddenDeath ? 2 : 1;
            d.score += 25 * mult;

            // Forward leap velocity
            const leapSpeed = 240 * speedMultiplier;
            const inputMag = Math.hypot(steerX, throttleY);
            if (inputMag > 0.1) {
              d.vx = (steerX / inputMag) * leapSpeed;
              d.vy = (throttleY / inputMag) * leapSpeed;
            } else {
              d.vx = Math.cos(d.angle) * leapSpeed;
              d.vy = Math.sin(d.angle) * leapSpeed;
            }

            this.audio.playTone(720, 0.18, 'sine');
            this.audio.playTone(940, 0.15, 'triangle');
            this.particles.emit(d.x, d.y, 25, '#FFD700');

            // Vacuum loot in radius
            const vacRadius = d.isUnderdog ? 210 : 140;
            this.vacuumLootAround(d, vacRadius);

            // Shunt nearby rivals
            this.pushRivalsAway(d, 120, 320);
          } else if (d.chargeTime < sweetMin && d.chargeTime > 0.1) {
            // Undercharged short hop
            d.leapAirTimer = 0.35;
            const leapSpeed = 160;
            const inputMag = Math.hypot(steerX, throttleY);
            if (inputMag > 0.1) {
              d.vx = (steerX / inputMag) * leapSpeed;
              d.vy = (throttleY / inputMag) * leapSpeed;
            }
            this.audio.playTone(420, 0.08, 'triangle');
            this.vacuumLootAround(d, 70);
          }
          d.chargeTime = 0;
        } else {
          // Normal 360° steering locomotion
          const inputMag = Math.hypot(steerX, throttleY);
          if (inputMag > 0.08) {
            d.vx += (steerX / inputMag) * baseMoveSpeed * dt * 10.0;
            d.vy += (throttleY / inputMag) * baseMoveSpeed * dt * 10.0;
            d.angle = Math.atan2(throttleY, steerX);
            if (d.mood !== 'triumph') d.mood = 'idle';
          }
          d.vx *= Math.pow(0.03, dt);
          d.vy *= Math.pow(0.03, dt);
        }
      }

      d.x += d.vx * dt;
      d.y += d.vy * dt;
      this.clampDancerInBounds(d);
    }
  }

  private clampDancerInBounds(d: DiscoDancer): void {
    const margin = 16;
    const minX = this.floorBounds.x + margin;
    const maxX = this.floorBounds.x + this.floorBounds.size - margin;
    const minY = this.floorBounds.y + margin;
    const maxY = this.floorBounds.y + this.floorBounds.size - margin;

    if (d.x < minX) { d.x = minX; d.vx = Math.abs(d.vx) * 0.4; }
    if (d.x > maxX) { d.x = maxX; d.vx = -Math.abs(d.vx) * 0.4; }
    if (d.y < minY) { d.y = minY; d.vy = Math.abs(d.vy) * 0.4; }
    if (d.y > maxY) { d.y = maxY; d.vy = -Math.abs(d.vy) * 0.4; }
  }

  private vacuumLootAround(d: DiscoDancer, radius: number): void {
    for (const item of this.lootItems) {
      if (item.collected) continue;
      const dist = Math.hypot(item.x - d.x, item.y - d.y);
      if (dist < radius) {
        const angle = Math.atan2(d.y - item.y, d.x - item.x);
        item.vx += Math.cos(angle) * 380;
        item.vy += Math.sin(angle) * 380;
      }
    }
  }

  private pushRivalsAway(source: DiscoDancer, radius: number, force: number): void {
    for (const rival of this.dancers.values()) {
      if (rival.id === source.id || rival.fallingTimer > 0) continue;
      const dist = Math.hypot(rival.x - source.x, rival.y - source.y);
      if (dist < radius && dist > 1) {
        const nx = (rival.x - source.x) / dist;
        const ny = (rival.y - source.y) / dist;
        rival.vx += nx * force;
        rival.vy += ny * force;
        rival.stunTimer = 0.5;
        rival.mood = 'shocked';
        this.particles.emit(rival.x, rival.y, 8, '#F59E0B');
      }
    }
  }

  private handleDancerCollisions(dt: number): void {
    const list = Array.from(this.dancers.values());
    const rad = 18;

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.fallingTimer > 0 || b.fallingTimer > 0) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = rad * 2;

        if (dist < minDist && dist > 0.01) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          // Push apart
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          // Elastic impulse exchange
          const relVx = b.vx - a.vx;
          const relVy = b.vy - a.vy;
          const impulse = (relVx * nx + relVy * ny);

          if (impulse < 0) {
            const restitution = 1.35;
            const p = impulse * restitution * 0.5;
            a.vx += nx * p;
            a.vy += ny * p;
            b.vx -= nx * p;
            b.vy -= ny * p;

            const impactSpeed = Math.abs(impulse);
            if (impactSpeed > 100) {
              this.audio.playTone(280 + Math.min(impactSpeed, 300), 0.08, 'triangle');
              this.particles.emit((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, 8, '#FFFFFF');

              // Check if a shunted player was pushed onto a dropping tile (Sabotage Shunt!)
              this.checkShuntSabotage(a, b);
              this.checkShuntSabotage(b, a);
            }
          }
        }
      }
    }
  }

  private checkShuntSabotage(attacker: DiscoDancer, victim: DiscoDancer): void {
    if (this.phase !== 'warning' && this.phase !== 'drop') return;

    const col = Math.floor((victim.x - this.floorBounds.x) / this.floorBounds.tileSize);
    const row = Math.floor((victim.y - this.floorBounds.y) / this.floorBounds.tileSize);
    const isValid = row >= 0 && row < this.GRID_SIZE && col >= 0 && col < this.GRID_SIZE;

    if (!isValid || this.grid[row][col].colorIdx !== this.targetColor) {
      // Victim was shunted into unsafe/dropping tile!
      attacker.score += 30;
      attacker.sabotageCount++;
      attacker.mood = 'triumph';
      victim.mood = 'shocked';
      victim.stunTimer = 0.65;
      this.audio.playTone(700, 0.12, 'square');
      this.particles.emit(victim.x, victim.y, 14, '#EC4899');
    }
  }

  private updateLoot(dt: number, isSuddenDeath: boolean): void {
    this.lootSpawnTimer -= dt;
    if (this.lootSpawnTimer <= 0) {
      this.spawnLootItem();
      this.lootSpawnTimer = isSuddenDeath ? 1.0 : 1.8;
    }

    const margin = 12;
    const minX = this.floorBounds.x + margin;
    const maxX = this.floorBounds.x + this.floorBounds.size - margin;
    const minY = this.floorBounds.y + margin;
    const maxY = this.floorBounds.y + this.floorBounds.size - margin;

    for (let i = this.lootItems.length - 1; i >= 0; i--) {
      const item = this.lootItems[i];
      if (item.collected) {
        this.lootItems.splice(i, 1);
        continue;
      }

      item.spinAngle += dt * 3.5;
      item.pulsePhase += dt * 4.0;
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.vx *= Math.pow(0.1, dt);
      item.vy *= Math.pow(0.1, dt);

      // Bounce loot off arena rims
      if (item.x < minX) { item.x = minX; item.vx = Math.abs(item.vx); }
      if (item.x > maxX) { item.x = maxX; item.vx = -Math.abs(item.vx); }
      if (item.y < minY) { item.y = minY; item.vy = Math.abs(item.vy); }
      if (item.y > maxY) { item.y = maxY; item.vy = -Math.abs(item.vy); }

      // Check dancer collection
      for (const d of this.dancers.values()) {
        if (d.fallingTimer > 0) continue;
        const pickupRadius = (d.isUnderdog ? 32 : 24) + item.radius;
        const dist = Math.hypot(d.x - item.x, d.y - item.y);

        if (dist < pickupRadius) {
          item.collected = true;
          const mult = isSuddenDeath ? 2 : 1;
          const streakMultiplier = 1.0 + Math.min(d.streakCount * 0.25, 1.5);
          const pointsEarned = Math.round(item.value * mult * streakMultiplier);

          d.score += pointsEarned;
          d.streakCount++;
          d.streakTimer = 3.5;
          d.mood = 'triumph';

          this.audio.playTone(
            item.type === 'platinum_mirror_ball' ? 950 : item.type === 'gold_mic' ? 760 : 540,
            0.12,
            'triangle'
          );

          const theme = THEMES[this.currentThemeIdx];
          const partColor = item.type === 'platinum_mirror_ball'
            ? '#E2E8F0'
            : item.type === 'gold_mic'
            ? '#FBBF24'
            : theme.tileColors[0];
          this.particles.emit(item.x, item.y, 14, partColor);
          break;
        }
      }
    }
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _w: number, _h: number): void {
    const d = this.dancers.get(botId);
    if (!d || d.fallingTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0);
      return;
    }

    let reactionTimer = this.botReactionTimers.get(botId) || 0;
    reactionTimer += dt;
    this.botReactionTimers.set(botId, reactionTimer);

    // Calibrated reaction lag thresholds
    const lagThreshold = difficulty === 'bot_easy' ? 0.42 : difficulty === 'bot_normal' ? 0.23 : 0.10;
    if (reactionTimer < lagThreshold) return;
    this.botReactionTimers.set(botId, 0);

    // Blunder chance for human-like mistake dynamics
    const blunderChance = difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.08 : 0.0;
    const isBlundering = Math.random() < blunderChance;

    let targetX = d.x;
    let targetY = d.y;
    let shouldHoldAction = false;

    // Phase reaction logic
    if ((this.phase === 'warning' || this.phase === 'drop') && !isBlundering) {
      // Find nearest safe tile center
      let bestDist = Infinity;
      let safeTile = { row: 2, col: 2 };

      for (let r = 0; r < this.GRID_SIZE; r++) {
        for (let c = 0; c < this.GRID_SIZE; c++) {
          if (this.grid[r][c].colorIdx === this.targetColor) {
            const cx = this.floorBounds.x + (c + 0.5) * this.floorBounds.tileSize;
            const cy = this.floorBounds.y + (r + 0.5) * this.floorBounds.tileSize;
            const dist = Math.hypot(cx - d.x, cy - d.y);
            if (dist < bestDist) {
              bestDist = dist;
              safeTile = { row: r, col: c };
            }
          }
        }
      }

      this.botTargetTiles.set(botId, safeTile);
      targetX = this.floorBounds.x + (safeTile.col + 0.5) * this.floorBounds.tileSize;
      targetY = this.floorBounds.y + (safeTile.row + 0.5) * this.floorBounds.tileSize;

      // On Hard / Normal: if drop is imminent (<0.45s) and still far from safe tile, charge Spin Leap!
      if (difficulty !== 'bot_easy' && this.phase === 'warning' && this.phaseTimer < 0.45 && bestDist > 40) {
        shouldHoldAction = true;
      }
    } else {
      // In dance or reset phase: hunt for highest-value loot or nudge rivals
      let bestLootDist = Infinity;
      let targetLoot: DiscoLoot | null = null;

      for (const item of this.lootItems) {
        if (item.collected) continue;
        const weight = item.type === 'platinum_mirror_ball' ? 2.5 : item.type === 'gold_mic' ? 1.5 : 1.0;
        const dist = Math.hypot(item.x - d.x, item.y - d.y) / weight;
        if (dist < bestLootDist) {
          bestLootDist = dist;
          targetLoot = item;
        }
      }

      if (targetLoot) {
        targetX = targetLoot.x;
        targetY = targetLoot.y;
      } else {
        // Dance towards center
        targetX = this.floorBounds.x + this.floorBounds.size * 0.5;
        targetY = this.floorBounds.y + this.floorBounds.size * 0.5;
      }

      // Hard bots occasionally charge sweet spot leaps to vacuum loot and shove rivals
      if (difficulty === 'bot_hard' && Math.random() < 0.15 && !d.isCharging) {
        shouldHoldAction = true;
      }
    }

    // Handle releasing sweet spot for bots
    if (d.isCharging) {
      const sweetTarget = d.isUnderdog ? 0.75 : 0.85;
      if (d.chargeTime >= sweetTarget) {
        shouldHoldAction = false;
      } else {
        shouldHoldAction = true;
      }
    }

    // Calculate steer and throttle to target
    const dx = targetX - d.x;
    const dy = targetY - d.y;
    const dist = Math.hypot(dx, dy);

    let steerX = 0;
    let throttleY = 0;

    if (dist > 8) {
      steerX = dx / dist;
      throttleY = dy / dist;
    }

    // Add slight angular noise for Easy/Normal
    if (difficulty === 'bot_easy') {
      const noise = (Math.random() - 0.5) * 0.5;
      steerX += noise;
      throttleY += noise;
    }

    // Set bot inputs (note: in our input router throttle is inverted for upward navigation)
    this.input.setBotInput(botId, shouldHoldAction, steerX, -throttleY);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeIdx];

    // Background club gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgTop);
    bgGrad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Laser Light Sweeps in Background
    this.renderLaserBeams(ctx, width, height, theme);

    // 2.5D Dance Floor & Tiles
    this.renderDiscoFloor(ctx, theme);

    // Collectibles / Loot
    this.renderLoot(ctx, theme);

    // Dancers
    this.renderDancers(ctx, theme);

    // Giant 2.5D Overhead Spinning Mirror Ball & Flecks
    this.renderMirrorBall(ctx, width, height, theme);

    // HUD and UI Layout
    this.renderHUD(ctx, width, height, theme);
  }

  private renderLaserBeams(ctx: CanvasRenderingContext2D, width: number, height: number, theme: VisualTheme): void {
    ctx.save();
    const beamCount = 4;
    for (let i = 0; i < beamCount; i++) {
      const angle = Math.sin(this.beatPulse * 0.6 + i * 1.5) * 0.6 + (i - 1.5) * 0.4;
      const startX = width * (0.2 + i * 0.2);
      const startY = 0;
      const len = height * 1.2;
      const endX = startX + Math.sin(angle) * len;
      const endY = startY + Math.cos(angle) * len;

      ctx.strokeStyle = theme.laserBeam;
      ctx.lineWidth = 14 + Math.sin(this.beatPulse * 2.0 + i) * 6;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderDiscoFloor(ctx: CanvasRenderingContext2D, theme: VisualTheme): void {
    const { x: fx, y: fy, size, tileSize } = this.floorBounds;

    ctx.save();

    // 2.5D Floor base bevel & shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(fx - 12, fy - 6, size + 24, size + 36, 12);
    ctx.fill();

    // Floor outer glowing rim
    ctx.strokeStyle = theme.floorRim;
    ctx.lineWidth = 6;
    ctx.shadowColor = theme.floorRim;
    ctx.shadowBlur = this.phase === 'warning' ? 24 : 12;
    ctx.beginPath();
    ctx.roundRect(fx - 4, fy - 4, size + 8, size + 8, 8);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Render individual 5x5 Dance Tiles
    for (let r = 0; r < this.GRID_SIZE; r++) {
      for (let c = 0; c < this.GRID_SIZE; c++) {
        const tile = this.grid[r][c];
        const tx = fx + c * tileSize;
        const ty = fy + r * tileSize;
        const isTarget = tile.colorIdx === this.targetColor;

        if (tile.dropProgress > 0) {
          // Render dark drop pit below
          ctx.fillStyle = '#030712';
          ctx.fillRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);
          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);

          // Perspective falling tile rendering
          if (tile.dropProgress < 1.0) {
            const dropY = tile.dropProgress * 48;
            const dropScale = 1.0 - tile.dropProgress * 0.35;
            ctx.save();
            ctx.translate(tx + tileSize * 0.5, ty + tileSize * 0.5 + dropY);
            ctx.scale(dropScale, dropScale);
            ctx.fillStyle = theme.tileColors[tile.colorIdx];
            ctx.globalAlpha = 1.0 - tile.dropProgress;
            ctx.fillRect(-tileSize * 0.45, -tileSize * 0.45, tileSize * 0.9, tileSize * 0.9);
            ctx.restore();
          }
          continue;
        }

        // Active Tile Surface
        const baseColor = theme.tileColors[tile.colorIdx];
        ctx.fillStyle = baseColor;
        ctx.fillRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);

        // Geometric neon inset pattern
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(tx + 8, ty + 8, tileSize - 16, tileSize - 16);

        // Warning phase strobe
        if (this.phase === 'warning') {
          if (!isTarget) {
            const warningStrobe = (Math.sin(this.beatPulse * 16.0) + 1) * 0.5;
            ctx.fillStyle = `rgba(239, 68, 68, ${0.45 * warningStrobe})`;
            ctx.fillRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);
          } else {
            // Pulse the safe tile gently
            const safePulse = (Math.sin(this.beatPulse * 8.0) + 1) * 0.5;
            ctx.fillStyle = `rgba(255, 255, 255, ${0.4 * safePulse})`;
            ctx.fillRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);
          }
        } else {
          // Dance phase ambient beat glow
          const tileBeat = (Math.sin(this.beatPulse * 2.5 + tile.pulseAnim) + 1) * 0.5;
          ctx.fillStyle = `rgba(255, 255, 255, ${0.12 * tileBeat})`;
          ctx.fillRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);
        }
      }
    }

    ctx.restore();
  }

  private renderLoot(ctx: CanvasRenderingContext2D, theme: VisualTheme): void {
    ctx.save();
    for (const item of this.lootItems) {
      if (item.collected) continue;

      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.spinAngle);

      const pulseScale = 1.0 + Math.sin(item.pulsePhase) * 0.12;
      ctx.scale(pulseScale, pulseScale);

      if (item.type === 'platinum_mirror_ball') {
        // Platinum Disco Mirror Ball (+75)
        ctx.fillStyle = '#CBD5E1';
        ctx.beginPath();
        ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Shimmer grid
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-6, -6, 5, 5);
        ctx.fillRect(1, -6, 5, 5);
        ctx.fillRect(-6, 1, 5, 5);
        ctx.fillRect(1, 1, 5, 5);
      } else if (item.type === 'gold_mic') {
        // Gold Disco Microphone (+45)
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(0, -4, item.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FDE68A';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Handle
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(-3, 2, 6, 10);
      } else {
        // Glowing Vinyl 45 (+20)
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = theme.tileColors[0];
        ctx.lineWidth = 2;
        ctx.stroke();

        // Vinyl Center Label
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(0, 0, item.radius * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
    ctx.restore();
  }

  private renderDancers(ctx: CanvasRenderingContext2D, theme: VisualTheme): void {
    const active = this.getActivePlayers();

    for (const p of active) {
      const d = this.dancers.get(p.id);
      if (!d) continue;

      ctx.save();
      ctx.translate(d.x, d.y);

      // Invulnerability flashing
      if (d.invulnTimer > 0 && Math.sin(this.beatPulse * 20.0) > 0) {
        ctx.globalAlpha = 0.45;
      }

      // Falling into pit anim
      if (d.fallingTimer > 0) {
        const fallProgress = 1.0 - d.fallingTimer / 0.85;
        const scale = Math.max(0.01, 1.0 - fallProgress * 0.8);
        ctx.scale(scale, scale);
        ctx.rotate(fallProgress * 12.0);
      }

      // High-Kick Leap elevation & shadow
      if (d.leapAirTimer > 0) {
        const leapH = Math.sin((d.leapAirTimer / 0.85) * Math.PI) * 24;
        // Drop shadow on floor
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, leapH, 16, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Elevate dancer
        ctx.translate(0, -leapH);

        // Spin leap aura ring
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Hold-to-Charge Ring
      if (d.isCharging) {
        const chargeRatio = Math.min(1.0, d.chargeTime / 1.0);
        const sweetMin = d.isUnderdog ? 0.50 : 0.72;
        const sweetMax = d.isUnderdog ? 1.05 : 0.98;
        const isSweet = d.chargeTime >= sweetMin && d.chargeTime <= sweetMax;

        ctx.strokeStyle = isSweet ? '#10B981' : d.chargeTime > sweetMax ? '#EF4444' : '#F59E0B';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + chargeRatio * Math.PI * 2);
        ctx.stroke();
      }

      // Underdog fiery crown halo
      if (d.isUnderdog) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw mascot character using drawCharacter
      ctx.save();
      ctx.rotate(d.angle);
      drawCharacter(ctx, 0, 0, 17, p.id, p.id !== 0, d.mood, d.animTimer);
      ctx.restore();

      // Render Streak Multiplier Pill above head
      if (d.streakCount >= 2) {
        const mult = (1.0 + Math.min(d.streakCount * 0.25, 1.5)).toFixed(1);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        ctx.roundRect(-24, -36, 48, 16, 4);
        ctx.fill();
        ctx.strokeStyle = theme.floorRim;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#FBBF24';
        ctx.textAlign = 'center';
        ctx.fillText(`${mult}x STREAK`, 0, -24);
      }

      ctx.restore();
    }
  }

  private renderMirrorBall(ctx: CanvasRenderingContext2D, width: number, height: number, theme: VisualTheme): void {
    const ballX = width * 0.5;
    const ballY = 40;
    const ballR = 26;

    ctx.save();

    // Mirror ball cord hanging from ceiling
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ballX, 0);
    ctx.lineTo(ballX, ballY);
    ctx.stroke();

    // Ball 2.5D sphere
    const ballGrad = ctx.createRadialGradient(ballX - 8, ballY - 8, 4, ballX, ballY, ballR);
    ballGrad.addColorStop(0, '#FFFFFF');
    ballGrad.addColorStop(0.5, '#CBD5E1');
    ballGrad.addColorStop(1, '#475569');
    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Sparkling Light Flecks projected across dance floor
    const fleckCount = 14;
    for (let i = 0; i < fleckCount; i++) {
      const fAngle = this.discoBallAngle * 2.0 + (i * Math.PI * 2) / fleckCount;
      const fDist = (height * 0.35) + Math.sin(i * 1.7) * (height * 0.2);
      const fx = ballX + Math.cos(fAngle) * fDist;
      const fy = (height * 0.5) + Math.sin(fAngle) * (fDist * 0.45);

      ctx.fillStyle = theme.mirrorBallFleck;
      ctx.beginPath();
      ctx.arc(fx, fy, 4 + Math.sin(fAngle * 3.0) * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number, theme: VisualTheme): void {
    ctx.save();

    // Top safe zone reserved for global timer at y: 12-44
    // Header Minigame Badge at y: 56
    const badgeW = 280;
    const badgeH = 26;
    const badgeX = (width - badgeW) / 2;
    const badgeY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fill();
    ctx.strokeStyle = theme.floorRim;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillStyle = '#F8FAFC';
    ctx.textAlign = 'center';
    ctx.fillText('DISCO TILE SHOWDOWN 🕺', width / 2, badgeY + 17);

    // Target Safe Color Announcement Banner at y: 88
    const bannerW = 320;
    const bannerH = 34;
    const bannerX = (width - bannerW) / 2;
    const bannerY = 88;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 8);
    ctx.fill();
    ctx.strokeStyle = theme.tileColors[this.targetColor];
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'left';
    ctx.fillText('SAFE COLOR:', bannerX + 16, bannerY + 21);

    // Color Swatch Pill
    const pillX = bannerX + 104;
    const pillY = bannerY + 6;
    const pillW = 196;
    const pillH = 22;

    ctx.fillStyle = theme.tileColors[this.targetColor];
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 5);
    ctx.fill();

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    const phaseLabel = this.phase === 'warning' ? `⚠️ DROP IN ${this.phaseTimer.toFixed(1)}s!` : theme.tileNames[this.targetColor];
    ctx.fillText(phaseLabel, pillX + pillW * 0.5, pillY + 15);

    // Bottom-left Theme Pill at x: 20, y: height - 44, w: 170, h: 32 with shortcut [T]
    const pillRect = {
      x: 20,
      y: height - 44,
      w: 170,
      h: 32
    };
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(pillRect.x, pillRect.y, pillRect.w, pillRect.h, 6);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#E2E8F0';
    ctx.textAlign = 'center';
    ctx.fillText(`[T] ${theme.name} ${theme.icon}`, pillRect.x + pillRect.w * 0.5, pillRect.y + 20);

    // Corner Player Score Cards at y: height - 128 (130x48px)
    const active = this.getActivePlayers();
    const cardW = 130;
    const cardH = 48;
    const cardY = height - 128;

    active.forEach((p, idx) => {
      const d = this.dancers.get(p.id);
      if (!d) return;

      const cardX = 20 + idx * (cardW + 12);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 6);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Player Name
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillStyle = p.color;
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 10, cardY + 18);

      // Score
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(`${d.score} pts`, cardX + 10, cardY + 38);

      // Underdog badge on card
      if (d.isUnderdog) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('⚡SURGE', cardX + cardW - 8, cardY + 18);
      }
    });

    ctx.restore();
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
      ? `${this.getPlayer(winnerId)?.name} ruled the Studio 54 dance floor with ${winnerDancer?.safeGrooveBonusCount || 0} safe grooves & ${winnerDancer?.sabotageCount || 0} floor shunts!`
      : 'The disco dance floor ended in an electrifying tie!';

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
