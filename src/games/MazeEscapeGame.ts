import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type MazeTheme = 'crypt' | 'cyber' | 'volcanic';

export interface MazeThemeConfig {
  id: MazeTheme;
  name: string;
  bgColor: string;
  wallColor: string;
  wallStroke: string;
  gemColor: string;
  relicColor: string;
  pillColor: string;
}

export const THEME_CONFIGS: MazeThemeConfig[] = [
  {
    id: 'crypt',
    name: 'Ancient Crypt 🏛️',
    bgColor: '#090D16',
    wallColor: '#1E293B',
    wallStroke: '#334155',
    gemColor: '#38BDF8',
    relicColor: '#F59E0B',
    pillColor: '#38BDF8'
  },
  {
    id: 'cyber',
    name: 'Cyber Grid ⚡',
    bgColor: '#030712',
    wallColor: '#0F172A',
    wallStroke: '#06B6D4',
    gemColor: '#06B6D4',
    relicColor: '#F43F5E',
    pillColor: '#06B6D4'
  },
  {
    id: 'volcanic',
    name: 'Volcanic Catacombs 🔥',
    bgColor: '#180B0B',
    wallColor: '#450A0A',
    wallStroke: '#7F1D1D',
    gemColor: '#FBBF24',
    relicColor: '#EF4444',
    pillColor: '#F97316'
  }
];

interface MazePlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  score: number;
  gemsCollected: number;
  speedBoostTimer: number;
  ghostTimer: number;
  freezeTimer: number;
  invulnerableTimer: number;
  hasTrap: boolean;
  botDecisionTimer: number;
  facingDx: number;
  facingDy: number;
  safeSpawnX: number;
  safeSpawnY: number;
  isUnderdog: boolean;
  ghostCooldown: number;
  shoveCooldown: number;
}

interface MazeGem {
  id: number;
  x: number;
  y: number;
  radius: number;
  isRelic: boolean;
  collected: boolean;
}

interface MazeTrap {
  x: number;
  y: number;
  placedBy: PlayerId;
  active: boolean;
}

export interface MazeSentry {
  id: number;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
  baseSpeed: number;
  chaseSpeed: number;
  state: 'PATROL' | 'CHASE' | 'RETURN';
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  homeX: number;
  homeY: number;
  targetPlayerId: PlayerId | null;
  alertState: 'NONE' | 'ALERT' | 'LOST';
  alertTimer: number;
  stunTimer: number;
  facingAngle: number;
  patrolDir: { dx: number; dy: number };
}

export class MazeEscapeGame extends BaseGame {
  private playersState: Map<PlayerId, MazePlayer> = new Map();
  private gems: MazeGem[] = [];
  private traps: MazeTrap[] = [];
  private sentries: MazeSentry[] = [];
  private wallGrid: boolean[][] = [];
  private cols: number = 27;
  private rows: number = 17;
  private cellW: number = 34;
  private cellH: number = 28;
  private offsetX: number = 20;
  private offsetY: number = 88;
  private gemCounter: number = 0;
  private relicRespawnTimer: number = 0;

  public mapTheme: MazeTheme = 'crypt';
  public get currentMapName(): string {
    const theme = THEME_CONFIGS.find((t) => t.id === this.mapTheme);
    return theme ? theme.name : 'Ancient Crypt 🏛️';
  }
  private lastWidth: number = 960;
  private lastHeight: number = 540;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private suddenDeathAnnounced: boolean = false;
  private animTimer: number = 0;

  public get sentry(): MazeSentry {
    return (
      this.sentries[0] || {
        id: 0,
        name: 'Alpha Sentry',
        color: '#EF4444',
        x: 0,
        y: 0,
        vx: 110,
        vy: 0,
        radius: 15,
        speed: 110,
        baseSpeed: 105,
        chaseSpeed: 165,
        state: 'PATROL',
        minCol: 1,
        maxCol: 12,
        minRow: 1,
        maxRow: 8,
        minX: 0,
        maxX: 400,
        minY: 0,
        maxY: 300,
        homeX: 200,
        homeY: 150,
        targetPlayerId: null,
        alertState: 'NONE',
        alertTimer: 0,
        stunTimer: 0,
        facingAngle: 0,
        patrolDir: { dx: 1, dy: 0 }
      }
    );
  }

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.bindKeyboardShortcuts();
    this.bindCanvasPointer();
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 50;
    this.traps = [];
    this.relicRespawnTimer = 0;
    this.suddenDeathAnnounced = false;
    this.animTimer = 0;

    this.input.setControlMode('directional');

    this.cols = 27;
    this.rows = 17;
    this.offsetX = 20;
    this.offsetY = 88;
    this.cellW = (width - this.offsetX * 2) / this.cols;
    this.cellH = (height - this.offsetY - 20) / this.rows;

    this.generateProceduralMap();
    this.initPlayers();
    this.initSentries();
    this.syncDebug();
  }

  public syncDebug(): void {
    if (typeof window !== 'undefined') {
      const self = this;
      (window as any).__MAZE_ESCAPE_DEBUG__ = {
        get players() { return Array.from(self.playersState.values()); },
        get sentries() { return self.sentries; },
        get sentry() { return self.sentry; },
        get gems() { return self.gems; },
        get wallGrid() { return self.wallGrid; },
        get roundTimer() { return self.roundTimer; },
        get isFinished() { return self.isFinished; },
        get cols() { return self.cols; },
        get rows() { return self.rows; },
        get theme() { return self.mapTheme; },
        setTheme: (theme: MazeTheme) => self.setMapTheme(theme),
        cycleTheme: () => self.cycleTheme(),
        triggerSentryCollision: (playerId: PlayerId, sentryIndex: number = 0) =>
          self.handleSentryCollision(playerId, sentryIndex)
      };
    }
  }

  private bindCanvasPointer(): void {
    if (typeof window === 'undefined') return;
    const canvas = this.input.getCanvas();
    if (!canvas) return;

    this.boundPointerDown = (e: PointerEvent) => {
      this.handlePointerDown(e);
    };
    canvas.addEventListener('pointerdown', this.boundPointerDown);
  }

  private handlePointerDown(e: PointerEvent): void {
    const canvas = this.input.getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * this.lastWidth;
    const clickY = ((e.clientY - rect.top) / rect.height) * this.lastHeight;

    // Check Theme Pill click at (20, height - 44, 170, 32)
    if (
      clickX >= 20 &&
      clickX <= 190 &&
      clickY >= this.lastHeight - 44 &&
      clickY <= this.lastHeight - 12
    ) {
      this.cycleTheme();
    }
  }

  public cycleTheme(): void {
    const curIdx = THEME_CONFIGS.findIndex((t) => t.id === this.mapTheme);
    const nextIdx = (curIdx + 1) % THEME_CONFIGS.length;
    this.setMapTheme(THEME_CONFIGS[nextIdx].id);
  }

  public setMapTheme(theme: MazeTheme): void {
    if (this.mapTheme === theme) return;
    this.mapTheme = theme;
    this.audio.playTap();
    this.particles.spawnExplosion(100, this.lastHeight - 28, '#38BDF8', 12);
    this.syncDebug();
  }

  private bindKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;
    this.unbindKeyboardShortcuts();

    this.keydownListener = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === '1') {
        this.setMapTheme('crypt');
      } else if (e.key === '2') {
        this.setMapTheme('cyber');
      } else if (e.key === '3') {
        this.setMapTheme('volcanic');
      }
    };
    window.addEventListener('keydown', this.keydownListener);
  }

  private unbindKeyboardShortcuts(): void {
    if (typeof window !== 'undefined' && this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
  }

  public override destroy(): void {
    this.unbindKeyboardShortcuts();
    if (this.boundPointerDown) {
      const canvas = this.input.getCanvas();
      if (canvas) {
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
      }
      this.boundPointerDown = null;
    }
    if (typeof window !== 'undefined' && (window as any).__MAZE_ESCAPE_DEBUG__) {
      delete (window as any).__MAZE_ESCAPE_DEBUG__;
    }
  }

  private generateProceduralMap(): void {
    this.wallGrid = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => false)
    );

    for (let c = 0; c < this.cols; c++) {
      this.wallGrid[0][c] = true;
      this.wallGrid[this.rows - 1][c] = true;
    }
    for (let r = 0; r < this.rows; r++) {
      this.wallGrid[r][0] = true;
      this.wallGrid[r][this.cols - 1] = true;
    }

    const midR = Math.floor(this.rows / 2);
    const midC = Math.floor(this.cols / 2);

    for (let r = 2; r < this.rows - 2; r += 2) {
      for (let c = 2; c < this.cols - 2; c += 2) {
        if (Math.abs(r - midR) <= 1 && Math.abs(c - midC) <= 2) {
          continue;
        }

        this.wallGrid[r][c] = true;

        const dirs = [
          { dr: -1, dc: 0 },
          { dr: 1, dc: 0 },
          { dr: 0, dc: -1 },
          { dr: 0, dc: 1 }
        ];
        const chosen = dirs[Math.floor(Math.random() * dirs.length)];
        const branchR = r + chosen.dr;
        const branchC = c + chosen.dc;

        if (
          branchR > 0 &&
          branchR < this.rows - 1 &&
          branchC > 0 &&
          branchC < this.cols - 1 &&
          (Math.abs(branchR - midR) > 1 || Math.abs(branchC - midC) > 2)
        ) {
          this.wallGrid[branchR][branchC] = true;
        }
      }
    }

    this.gems = [];
    this.gemCounter = 0;

    for (let r = 1; r < this.rows - 1; r++) {
      for (let c = 1; c < this.cols - 1; c++) {
        if (!this.wallGrid[r][c]) {
          const isCenter = r === midR && c === midC;
          if (isCenter || (r % 2 === 1 && c % 2 === 1) || Math.random() < 0.28) {
            this.gems.push({
              id: ++this.gemCounter,
              x: this.offsetX + (c + 0.5) * this.cellW,
              y: this.offsetY + (r + 0.5) * this.cellH,
              radius: isCenter ? 14 : 7,
              isRelic: isCenter,
              collected: false
            });
          }
        }
      }
    }
  }

  private initPlayers(): void {
    this.playersState.clear();
    const active = this.getActivePlayers();

    const corners = [
      { r: 1, c: 1 },
      { r: 1, c: this.cols - 2 },
      { r: this.rows - 2, c: 1 },
      { r: this.rows - 2, c: this.cols - 2 }
    ];

    active.forEach((p, idx) => {
      const sp = corners[idx % corners.length];
      const px = this.offsetX + (sp.c + 0.5) * this.cellW;
      const py = this.offsetY + (sp.r + 0.5) * this.cellH;

      this.playersState.set(p.id, {
        id: p.id,
        x: px,
        y: py,
        vx: 0,
        vy: 0,
        radius: 12,
        score: 0,
        gemsCollected: 0,
        speedBoostTimer: 0,
        ghostTimer: 0,
        freezeTimer: 0,
        invulnerableTimer: 0,
        hasTrap: true,
        botDecisionTimer: 0.15 + idx * 0.08,
        facingDx: idx % 2 === 0 ? 1 : -1,
        facingDy: 0,
        safeSpawnX: px,
        safeSpawnY: py,
        isUnderdog: false,
        ghostCooldown: 0,
        shoveCooldown: 0
      });
    });
  }

  private initSentries(): void {
    this.sentries = [];
    const midR = Math.floor(this.rows / 2);
    const midC = Math.floor(this.cols / 2);

    const zones = [
      {
        id: 1,
        name: 'Crimson Sentry',
        color: '#EF4444',
        minCol: 1,
        maxCol: midC - 1,
        minRow: 1,
        maxRow: midR - 1,
        startCol: 5,
        startRow: 3
      },
      {
        id: 2,
        name: 'Violet Sentry',
        color: '#A855F7',
        minCol: midC + 1,
        maxCol: this.cols - 2,
        minRow: 1,
        maxRow: midR - 1,
        startCol: midC + 4,
        startRow: 3
      },
      {
        id: 3,
        name: 'Amber Sentry',
        color: '#F59E0B',
        minCol: 1,
        maxCol: midC - 1,
        minRow: midR + 1,
        maxRow: this.rows - 2,
        startCol: 5,
        startRow: midR + 4
      },
      {
        id: 4,
        name: 'Cyan Warden',
        color: '#06B6D4',
        minCol: midC + 1,
        maxCol: this.cols - 2,
        minRow: midR + 1,
        maxRow: this.rows - 2,
        startCol: midC + 4,
        startRow: midR + 4
      }
    ];

    zones.forEach((z) => {
      let startC = z.startCol;
      let startR = z.startRow;
      if (this.wallGrid[startR][startC]) {
        for (let r = z.minRow; r <= z.maxRow; r++) {
          for (let c = z.minCol; c <= z.maxCol; c++) {
            if (!this.wallGrid[r][c]) {
              startR = r;
              startC = c;
              break;
            }
          }
        }
      }

      const hx = this.offsetX + (startC + 0.5) * this.cellW;
      const hy = this.offsetY + (startR + 0.5) * this.cellH;

      this.sentries.push({
        id: z.id,
        name: z.name,
        color: z.color,
        x: hx,
        y: hy,
        vx: 105,
        vy: 0,
        radius: 15,
        speed: 105,
        baseSpeed: 105,
        chaseSpeed: 165,
        state: 'PATROL',
        minCol: z.minCol,
        maxCol: z.maxCol,
        minRow: z.minRow,
        maxRow: z.maxRow,
        minX: this.offsetX + z.minCol * this.cellW,
        maxX: this.offsetX + (z.maxCol + 1) * this.cellW,
        minY: this.offsetY + z.minRow * this.cellH,
        maxY: this.offsetY + (z.maxRow + 1) * this.cellH,
        homeX: hx,
        homeY: hy,
        targetPlayerId: null,
        alertState: 'NONE',
        alertTimer: 0,
        stunTimer: 0,
        facingAngle: 0,
        patrolDir: { dx: 1, dy: 0 }
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastWidth = width;
    this.lastHeight = height;
    this.animTimer += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    const isSuddenDeath = this.roundTimer <= 15;

    // Sudden Death Minotaur Enrage Trigger
    if (isSuddenDeath && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.audio.playBoost();
      this.particles.shake(0.5);
      this.particles.showFloatingText('⚠️ MINOTAUR ENRAGE! MEGA RELIC! ⚠️', width / 2, height / 2 - 30, '#FACC15', 28);

      // Spawn Mega Golden Relic
      const midR = Math.floor(this.rows / 2);
      const midC = Math.floor(this.cols / 2);
      this.gems.push({
        id: ++this.gemCounter,
        x: this.offsetX + (midC + 0.5) * this.cellW,
        y: this.offsetY + (midR + 0.5) * this.cellH,
        radius: 18,
        isRelic: true,
        collected: false
      });
    }

    // Underdog Detection (trailing by >= 150 points)
    const active = this.getActivePlayers();
    if (active.length > 1) {
      let minScore = 999999;
      let maxScore = -1;
      for (const p of active) {
        const ps = this.playersState.get(p.id);
        if (!ps) continue;
        if (ps.score < minScore) minScore = ps.score;
        if (ps.score > maxScore) maxScore = ps.score;
      }

      for (const p of active) {
        const ps = this.playersState.get(p.id);
        if (!ps) continue;
        ps.isUnderdog = (maxScore - ps.score >= 150);

        // Underdog auto-charges ghost phase cloak
        if (ps.isUnderdog) {
          ps.ghostCooldown = Math.max(0, ps.ghostCooldown - dt);
          if (ps.ghostCooldown <= 0 && ps.ghostTimer <= 0) {
            ps.ghostTimer = 2.2;
            ps.ghostCooldown = 6.5;
            this.audio.playBoost();
            this.particles.showFloatingText('GHOST CLOAK! 👻', ps.x, ps.y - 25, '#F59E0B', 20);
          }
        }
      }
    } else {
      for (const ps of this.playersState.values()) {
        ps.isUnderdog = false;
      }
    }

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Relic respawn
    if (this.relicRespawnTimer > 0) {
      this.relicRespawnTimer -= dt;
      if (this.relicRespawnTimer <= 0) {
        const midR = Math.floor(this.rows / 2);
        const midC = Math.floor(this.cols / 2);
        this.gems.push({
          id: ++this.gemCounter,
          x: this.offsetX + (midC + 0.5) * this.cellW,
          y: this.offsetY + (midR + 0.5) * this.cellH,
          radius: 15,
          isRelic: true,
          collected: false
        });
        this.particles.showFloatingText('RELIC RESPAWNED!', width / 2, height / 2 - 20, '#F59E0B', 24);
      }
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.shoveCooldown > 0) ps.shoveCooldown = Math.max(0, ps.shoveCooldown - dt);

      if (ps.freezeTimer > 0) {
        ps.freezeTimer = Math.max(0, ps.freezeTimer - dt);
        ps.vx = 0;
        ps.vy = 0;
        continue;
      }

      if (ps.speedBoostTimer > 0) ps.speedBoostTimer = Math.max(0, ps.speedBoostTimer - dt);
      if (ps.ghostTimer > 0) ps.ghostTimer = Math.max(0, ps.ghostTimer - dt);
      if (ps.invulnerableTimer > 0) ps.invulnerableTimer = Math.max(0, ps.invulnerableTimer - dt);

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const rawSteer = this.input.getRawSteer(p.id);
      const rawThrottle = this.input.getRawThrottle(p.id);

      let effectiveSteer = 0;
      if (rawSteer !== 0) effectiveSteer = rawSteer;
      else if (Math.abs(steer) > 0.35) effectiveSteer = steer;

      let effectiveThrottle = 0;
      if (rawThrottle !== 0) effectiveThrottle = rawThrottle;
      else if (Math.abs(throttle) > 0.35) effectiveThrottle = throttle;

      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      if (justAction && ps.hasTrap) {
        ps.hasTrap = false;
        this.traps.push({
          x: ps.x,
          y: ps.y,
          placedBy: ps.id,
          active: true
        });
        this.audio.playTap();
        this.particles.showFloatingText('TRAP SET!', ps.x, ps.y - 20, '#38BDF8', 18);
      }

      const speedMultiplier = ps.isUnderdog ? 1.22 : 1.0;
      const baseSpeed = (ps.speedBoostTimer > 0 ? 250 : 170) * speedMultiplier;

      if (effectiveSteer !== 0 || effectiveThrottle !== 0) {
        ps.vx = effectiveSteer * baseSpeed;
        ps.vy = -effectiveThrottle * baseSpeed;
        if (effectiveSteer !== 0) ps.facingDx = Math.sign(effectiveSteer);
        if (effectiveThrottle !== 0) ps.facingDy = -Math.sign(effectiveThrottle);
      } else {
        ps.vx = 0;
        ps.vy = 0;
      }

      if (ps.ghostTimer > 0) {
        ps.x += ps.vx * dt;
        ps.y += ps.vy * dt;
        ps.x = Math.max(this.offsetX + this.cellW + ps.radius, Math.min(this.offsetX + (this.cols - 1) * this.cellW - ps.radius, ps.x));
        ps.y = Math.max(this.offsetY + this.cellH + ps.radius, Math.min(this.offsetY + (this.rows - 1) * this.cellH - ps.radius, ps.y));
      } else {
        this.resolvePlayerWallCollision(ps, dt);
      }

      // Gem collection
      for (const gem of this.gems) {
        if (gem.collected) continue;

        const dist = Math.hypot(ps.x - gem.x, ps.y - gem.y);
        if (dist < ps.radius + gem.radius) {
          gem.collected = true;
          ps.gemsCollected += 1;

          if (gem.isRelic) {
            const points = isSuddenDeath ? 500 : 250;
            ps.score += points;
            this.relicRespawnTimer = 12.0;
            this.audio.playFanfare();
            this.particles.shake(0.35);
            this.particles.showFloatingText(`GOLDEN RELIC! +${points}`, ps.x, ps.y - 25, '#F59E0B', 24);
            this.particles.spawnConfetti(gem.x, gem.y, 30);
          } else {
            ps.score += 15;
            this.audio.playTap();
            this.particles.spawnSparks(gem.x, gem.y, '#38BDF8', 6);
          }
        }
      }

      // Trap triggers
      for (const trap of this.traps) {
        if (!trap.active || trap.placedBy === ps.id) continue;
        const d = Math.hypot(ps.x - trap.x, ps.y - trap.y);
        if (d < ps.radius + 12) {
          trap.active = false;
          ps.freezeTimer = 1.6;
          this.audio.playStun();
          this.particles.shake(0.25);
          this.particles.showFloatingText('FROZEN TRAP!', ps.x, ps.y - 25, '#38BDF8', 22);
        }
      }

      // Sentry Collisions
      for (let sIdx = 0; sIdx < this.sentries.length; sIdx++) {
        const sentry = this.sentries[sIdx];
        if (sentry.stunTimer > 0 || ps.invulnerableTimer > 0) continue;

        const sentryDist = Math.hypot(ps.x - sentry.x, ps.y - sentry.y);
        if (sentryDist < ps.radius + sentry.radius) {
          this.handleSentryCollision(ps.id, sIdx);
        }
      }
    }

    // Player Shoving in Corridors
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const p1 = this.playersState.get(active[i].id);
        const p2 = this.playersState.get(active[j].id);
        if (!p1 || !p2) continue;

        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (dist < p1.radius + p2.radius + 2 && p1.shoveCooldown <= 0 && p2.shoveCooldown <= 0) {
          const pushAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          const shoveForce = 18;
          p1.x -= Math.cos(pushAngle) * shoveForce;
          p1.y -= Math.sin(pushAngle) * shoveForce;
          p2.x += Math.cos(pushAngle) * shoveForce;
          p2.y += Math.sin(pushAngle) * shoveForce;

          p1.shoveCooldown = 0.35;
          p2.shoveCooldown = 0.35;

          this.audio.playBounce();
          this.particles.showFloatingText('BUMP!', (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 - 18, '#F59E0B', 16);
        }
      }
    }

    // Update Sentries (Enraged in Sudden Death)
    this.updateSentries(dt, isSuddenDeath);

    this.syncDebug();

    const remainingGems = this.gems.filter((g) => !g.collected);
    if (remainingGems.length === 0 || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public handleSentryCollision(playerId: PlayerId, sentryIndex: number): void {
    const ps = this.playersState.get(playerId);
    const sentry = this.sentries[sentryIndex];
    if (!ps || !sentry) return;

    const penalty = 120;
    ps.score = Math.max(0, ps.score - penalty);
    const droppedGems = Math.min(ps.gemsCollected, 3);
    ps.gemsCollected = Math.max(0, ps.gemsCollected - droppedGems);

    const repelAngle = Math.atan2(ps.y - sentry.y, ps.x - sentry.x);
    let targetX = ps.x + Math.cos(repelAngle) * 190;
    let targetY = ps.y + Math.sin(repelAngle) * 190;

    if (this.checkWallOverlap(targetX, targetY, ps.radius + 2)) {
      targetX = ps.safeSpawnX;
      targetY = ps.safeSpawnY;
    }
    ps.x = targetX;
    ps.y = targetY;
    ps.vx = 0;
    ps.vy = 0;

    ps.invulnerableTimer = 2.4;

    sentry.stunTimer = 1.5;
    sentry.state = 'RETURN';
    sentry.targetPlayerId = null;
    sentry.alertState = 'LOST';
    sentry.alertTimer = 1.0;
    sentry.x = sentry.homeX;
    sentry.y = sentry.homeY;

    this.audio.playExplosion();
    this.particles.shake(0.45);
    this.particles.showFloatingText(`SENTRY SMASH! -${penalty} PTS!`, ps.x, ps.y - 30, '#EF4444', 24);
    this.particles.spawnExplosion(sentry.x, sentry.y, sentry.color, 24);
    this.particles.showFloatingText('SHIELD ACTIVE!', ps.x, ps.y + 20, '#38BDF8', 16);
  }

  private resolvePlayerWallCollision(ps: MazePlayer, dt: number): void {
    const nextX = ps.x + ps.vx * dt;
    if (!this.checkWallOverlap(nextX, ps.y, ps.radius)) {
      ps.x = nextX;
    }

    const nextY = ps.y + ps.vy * dt;
    if (!this.checkWallOverlap(ps.x, nextY, ps.radius)) {
      ps.y = nextY;
    }
  }

  private checkWallOverlap(x: number, y: number, radius: number): boolean {
    const minC = Math.floor((x - radius - this.offsetX) / this.cellW);
    const maxC = Math.floor((x + radius - this.offsetX) / this.cellW);
    const minR = Math.floor((y - radius - this.offsetY) / this.cellH);
    const maxR = Math.floor((y + radius - this.offsetY) / this.cellH);

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return true;
        if (this.wallGrid[r][c]) {
          const wLeft = this.offsetX + c * this.cellW;
          const wRight = wLeft + this.cellW;
          const wTop = this.offsetY + r * this.cellH;
          const wBottom = wTop + this.cellH;

          const closeX = Math.max(wLeft, Math.min(x, wRight));
          const closeY = Math.max(wTop, Math.min(y, wBottom));
          if (Math.hypot(x - closeX, y - closeY) < radius) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private updateSentries(dt: number, isEnraged: boolean = false): void {
    for (const sentry of this.sentries) {
      if (sentry.stunTimer > 0) {
        sentry.stunTimer = Math.max(0, sentry.stunTimer - dt);
        continue;
      }

      if (sentry.alertTimer > 0) {
        sentry.alertTimer = Math.max(0, sentry.alertTimer - dt);
        if (sentry.alertTimer <= 0) sentry.alertState = 'NONE';
      }

      const detectionRadius = isEnraged ? 210 : 145;
      let detectedPlayer: MazePlayer | null = null;
      let closestDist = 9999;

      for (const p of this.getActivePlayers()) {
        const ps = this.playersState.get(p.id);
        if (!ps || ps.ghostTimer > 0 || ps.invulnerableTimer > 0) continue;

        const inTerritory =
          ps.x >= sentry.minX - 10 &&
          ps.x <= sentry.maxX + 10 &&
          ps.y >= sentry.minY - 10 &&
          ps.y <= sentry.maxY + 10;

        if (inTerritory || isEnraged) {
          const d = Math.hypot(ps.x - sentry.x, ps.y - sentry.y);
          if (d < detectionRadius && d < closestDist) {
            closestDist = d;
            detectedPlayer = ps;
          }
        }
      }

      if (detectedPlayer) {
        if (sentry.state !== 'CHASE') {
          sentry.state = 'CHASE';
          sentry.alertState = 'ALERT';
          sentry.alertTimer = 1.0;
          this.audio.playWhoosh();
          this.particles.showFloatingText('!', sentry.x, sentry.y - 24, '#EF4444', 22);
        }
        sentry.targetPlayerId = detectedPlayer.id;
      } else if (sentry.state === 'CHASE') {
        sentry.state = 'RETURN';
        sentry.targetPlayerId = null;
        sentry.alertState = 'LOST';
        sentry.alertTimer = 1.0;
        this.particles.showFloatingText('?', sentry.x, sentry.y - 24, '#38BDF8', 20);
      }

      const speedMult = isEnraged ? 1.30 : 1.0;
      const currentSpeed = (sentry.state === 'CHASE' ? sentry.chaseSpeed : sentry.baseSpeed) * speedMult;

      if (sentry.state === 'CHASE' && sentry.targetPlayerId !== null) {
        const target = this.playersState.get(sentry.targetPlayerId);
        if (target) {
          const toX = target.x - sentry.x;
          const toY = target.y - sentry.y;
          const angle = Math.atan2(toY, toX);
          sentry.facingAngle = angle;

          let stepVx = Math.cos(angle) * currentSpeed;
          let stepVy = Math.sin(angle) * currentSpeed;

          const testX = sentry.x + stepVx * dt;
          const testY = sentry.y + stepVy * dt;

          const clampedX = Math.max(sentry.minX + sentry.radius, Math.min(sentry.maxX - sentry.radius, testX));
          const clampedY = Math.max(sentry.minY + sentry.radius, Math.min(sentry.maxY - sentry.radius, testY));

          if (!this.checkWallOverlap(clampedX, sentry.y, sentry.radius)) {
            sentry.x = clampedX;
          }
          if (!this.checkWallOverlap(sentry.x, clampedY, sentry.radius)) {
            sentry.y = clampedY;
          }

          sentry.vx = stepVx;
          sentry.vy = stepVy;
        }
      } else if (sentry.state === 'RETURN') {
        const toHomeX = sentry.homeX - sentry.x;
        const toHomeY = sentry.homeY - sentry.y;
        const distHome = Math.hypot(toHomeX, toHomeY);

        if (distHome < 15) {
          sentry.state = 'PATROL';
        } else {
          const angle = Math.atan2(toHomeY, toHomeX);
          sentry.facingAngle = angle;
          const stepX = Math.cos(angle) * currentSpeed * dt;
          const stepY = Math.sin(angle) * currentSpeed * dt;

          if (!this.checkWallOverlap(sentry.x + stepX, sentry.y, sentry.radius)) {
            sentry.x += stepX;
          }
          if (!this.checkWallOverlap(sentry.x, sentry.y + stepY, sentry.radius)) {
            sentry.y += stepY;
          }
        }
      } else {
        sentry.x += sentry.vx * dt;
        sentry.y += sentry.vy * dt;

        const hitWall = this.checkWallOverlap(
          sentry.x + Math.sign(sentry.vx) * (sentry.radius + 6),
          sentry.y + Math.sign(sentry.vy) * (sentry.radius + 6),
          sentry.radius
        );
        const hitBoundary =
          sentry.x <= sentry.minX + sentry.radius + 4 ||
          sentry.x >= sentry.maxX - sentry.radius - 4 ||
          sentry.y <= sentry.minY + sentry.radius + 4 ||
          sentry.y >= sentry.maxY - sentry.radius - 4;

        if (hitWall || hitBoundary) {
          sentry.x = Math.max(sentry.minX + sentry.radius + 5, Math.min(sentry.maxX - sentry.radius - 5, sentry.x));
          sentry.y = Math.max(sentry.minY + sentry.radius + 5, Math.min(sentry.maxY - sentry.radius - 5, sentry.y));

          const options = [
            { vx: sentry.baseSpeed, vy: 0 },
            { vx: -sentry.baseSpeed, vy: 0 },
            { vx: 0, vy: sentry.baseSpeed },
            { vx: 0, vy: -sentry.baseSpeed }
          ];
          const valid = options.filter((o) => {
            const tx = sentry.x + o.vx * 0.25;
            const ty = sentry.y + o.vy * 0.25;
            const inBounds = tx >= sentry.minX && tx <= sentry.maxX && ty >= sentry.minY && ty <= sentry.maxY;
            return inBounds && !this.checkWallOverlap(tx, ty, sentry.radius);
          });

          const nonReverse = valid.filter((o) => !(o.vx === -sentry.vx && o.vy === -sentry.vy));
          const pool = nonReverse.length > 0 ? nonReverse : valid;

          if (pool.length > 0) {
            const pick = pool[Math.floor(Math.random() * pool.length)];
            sentry.vx = pick.vx;
            sentry.vy = pick.vy;
          } else {
            sentry.vx = -sentry.vx;
            sentry.vy = -sentry.vy;
          }
        }
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.freezeTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    ps.botDecisionTimer -= dt;
    if (ps.botDecisionTimer > 0) return;

    const interval =
      difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.14 : 0.22;
    ps.botDecisionTimer = interval;

    let closestSentryDist = 9999;
    let threatSentry: MazeSentry | null = null;
    for (const sentry of this.sentries) {
      const d = Math.hypot(sentry.x - ps.x, sentry.y - ps.y);
      if (d < 160 && d < closestSentryDist) {
        closestSentryDist = d;
        threatSentry = sentry;
      }
    }

    const candidates = [
      { steer: 1, throttle: 0, dx: 1, dy: 0 },
      { steer: -1, throttle: 0, dx: -1, dy: 0 },
      { steer: 0, throttle: 1, dx: 0, dy: -1 },
      { steer: 0, throttle: -1, dx: 0, dy: 1 }
    ];

    const lookAhead = 16;
    const validMoves = candidates.filter(
      (c) => ps.ghostTimer > 0 || !this.checkWallOverlap(ps.x + c.dx * lookAhead, ps.y + c.dy * lookAhead, ps.radius)
    );

    if (validMoves.length === 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    let bestMove = validMoves[0];
    let bestScore = -99999;

    let targetX = width / 2;
    let targetY = height / 2;
    let minGemDist = 9999;
    for (const gem of this.gems) {
      if (gem.collected) continue;
      const d = Math.hypot(gem.x - ps.x, gem.y - ps.y);
      const effectiveDist = gem.isRelic ? d * 0.45 : d;
      if (effectiveDist < minGemDist) {
        minGemDist = effectiveDist;
        targetX = gem.x;
        targetY = gem.y;
      }
    }

    for (const move of validMoves) {
      const nextX = ps.x + move.dx * 20;
      const nextY = ps.y + move.dy * 20;

      const distToGem = Math.hypot(targetX - nextX, targetY - nextY);
      let score = -distToGem;

      if (threatSentry && ps.ghostTimer <= 0) {
        const distToSentry = Math.hypot(threatSentry.x - nextX, threatSentry.y - nextY);
        if (distToSentry < 120) {
          score -= (140 - distToSentry) * 4.5;
        } else {
          score += distToSentry * 1.5;
        }

        const outsideTerritory =
          nextX < threatSentry.minX ||
          nextX > threatSentry.maxX ||
          nextY < threatSentry.minY ||
          nextY > threatSentry.maxY;
        if (outsideTerritory) {
          score += 180;
        }
      }

      if (move.dx === -ps.facingDx && move.dy === -ps.facingDy && validMoves.length > 1) {
        score -= 50;
      }

      if (difficulty === 'bot_easy') {
        score += (Math.random() - 0.5) * 60;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    let useTrap = false;
    if (ps.hasTrap && difficulty !== 'bot_easy') {
      for (const p of this.getActivePlayers()) {
        if (p.id === botId) continue;
        const other = this.playersState.get(p.id);
        if (other && Math.hypot(other.x - ps.x, other.y - ps.y) < 70) {
          useTrap = true;
          break;
        }
      }
    }

    this.input.setBotInput(botId, useTrap, bestMove.steer, bestMove.throttle, useTrap);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEME_CONFIGS.find((t) => t.id === this.mapTheme) || THEME_CONFIGS[0];

    // Maze Backdrop
    ctx.fillStyle = theme.bgColor;
    ctx.fillRect(0, 0, width, height);

    // Maze Floor & Wall Grid
    this.renderMazeWalls(ctx, theme);

    // Territory Boundary Guides
    this.renderTerritoryBoundaries(ctx);

    // Traps
    for (const trap of this.traps) {
      if (!trap.active) continue;
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(trap.x, trap.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Gems & Golden Relic
    for (const gem of this.gems) {
      if (gem.collected) continue;
      this.renderGem(ctx, gem, theme);
    }

    // Sentries
    for (const sentry of this.sentries) {
      this.renderSentry(ctx, sentry);
    }

    // Players with CharacterRenderer Mascot
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderMazePlayer(ctx, ps, p);
    }

    // Center HUD Pod at y = 56
    this.renderCenterHudPod(ctx, width, theme);

    // Interactive Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
    this.renderThemePill(ctx, height, theme);

    // Control Hints (Right-aligned)
    this.renderControlHints(ctx, width, height);
  }

  private renderMazeWalls(ctx: CanvasRenderingContext2D, theme: MazeThemeConfig): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const wx = this.offsetX + c * this.cellW;
        const wy = this.offsetY + r * this.cellH;

        if (this.wallGrid[r][c]) {
          ctx.fillStyle = theme.wallColor;
          ctx.fillRect(wx, wy, this.cellW, this.cellH);
          ctx.strokeStyle = theme.wallStroke;
          ctx.lineWidth = 1.2;
          ctx.strokeRect(wx, wy, this.cellW, this.cellH);
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
          ctx.fillRect(wx + 1, wy + 1, this.cellW - 2, this.cellH - 2);
        }
      }
    }
  }

  private renderTerritoryBoundaries(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const sentry of this.sentries) {
      ctx.strokeStyle = sentry.state === 'CHASE' ? sentry.color : 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = sentry.state === 'CHASE' ? 1.5 : 1;
      ctx.setLineDash([4, 6]);
      ctx.strokeRect(
        sentry.minX,
        sentry.minY,
        sentry.maxX - sentry.minX,
        sentry.maxY - sentry.minY
      );
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  private renderGem(ctx: CanvasRenderingContext2D, gem: MazeGem, theme: MazeThemeConfig): void {
    ctx.save();
    ctx.translate(gem.x, gem.y);

    if (gem.isRelic) {
      ctx.beginPath();
      ctx.arc(0, 0, gem.radius, 0, Math.PI * 2);
      ctx.fillStyle = theme.relicColor;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#FEF08A';
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', 0, 1);
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -gem.radius);
      ctx.lineTo(gem.radius, 0);
      ctx.lineTo(0, gem.radius);
      ctx.lineTo(-gem.radius, 0);
      ctx.closePath();
      ctx.fillStyle = theme.gemColor;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderSentry(ctx: CanvasRenderingContext2D, sentry: MazeSentry): void {
    ctx.save();
    ctx.translate(sentry.x, sentry.y);

    if (sentry.state === 'CHASE') {
      ctx.beginPath();
      ctx.arc(0, 0, sentry.radius + 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, sentry.radius + 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(0, 0, sentry.radius, 0, Math.PI * 2);
    ctx.fillStyle = sentry.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.moveTo(-9, -6);
    ctx.lineTo(-13, -15);
    ctx.lineTo(-5, -9);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(9, -6);
    ctx.lineTo(13, -15);
    ctx.lineTo(5, -9);
    ctx.closePath();
    ctx.fill();

    const eyeColor = sentry.state === 'CHASE' ? '#EF4444' : '#FBBF24';
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(1, -1, 2, 0, Math.PI * 2);
    ctx.fill();

    if (sentry.alertState === 'ALERT') {
      ctx.font = '900 16px Inter, sans-serif';
      ctx.fillStyle = '#EF4444';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -sentry.radius - 8);
    } else if (sentry.alertState === 'LOST') {
      ctx.font = '900 14px Inter, sans-serif';
      ctx.fillStyle = '#38BDF8';
      ctx.textAlign = 'center';
      ctx.fillText('?', 0, -sentry.radius - 8);
    }

    ctx.restore();
  }

  private renderMazePlayer(
    ctx: CanvasRenderingContext2D,
    ps: MazePlayer,
    p: PlayerConfig
  ): void {
    ctx.save();
    ctx.translate(ps.x, ps.y);

    if (ps.ghostTimer > 0) {
      ctx.globalAlpha = 0.55;
    } else if (ps.invulnerableTimer > 0 && Math.floor(performance.now() / 100) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    // Underdog Ghost Aura
    if (ps.isUnderdog) {
      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, ps.radius + 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#F59E0B';
      ctx.font = '900 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GHOST 👻', 0, ps.radius + 14);
      ctx.restore();
    }

    if (ps.invulnerableTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, ps.radius + 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.fill();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.ellipse(0, 7, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    let mood: CharacterMood = 'focused';
    if (ps.freezeTimer > 0) {
      mood = 'shocked';
    } else if (ps.ghostTimer > 0 || ps.speedBoostTimer > 0) {
      mood = 'triumph';
    } else if (ps.isUnderdog) {
      mood = 'focused';
    } else {
      mood = 'happy';
    }

    const isBot = p.type.startsWith('bot_');

    // Mascot Avatar via CharacterRenderer
    drawCharacter(ctx, 0, 0, ps.radius + 2, p.id, isBot, mood, this.animTimer * 4);

    if (ps.freezeTimer > 0) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.fillRect(-ps.radius - 2, -ps.radius - 2, (ps.radius + 2) * 2, (ps.radius + 2) * 2);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-ps.radius - 2, -ps.radius - 2, (ps.radius + 2) * 2, (ps.radius + 2) * 2);
    }

    ctx.restore();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${ps.score}`, ps.x, ps.y - 17);
  }

  private renderCenterHudPod(ctx: CanvasRenderingContext2D, width: number, theme: MazeThemeConfig): void {
    const podW = 380;
    const podH = 26;
    const podX = width / 2 - podW / 2;
    const podY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 13);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme.pillColor;
    ctx.fillText(theme.name.toUpperCase(), podX + 14, podY + podH / 2);

    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const chasingCount = this.sentries.filter((s) => s.state === 'CHASE').length;
    if (this.roundTimer <= 15) {
      ctx.fillStyle = '#FACC15';
      ctx.fillText('⚡ MINOTAUR ENRAGE!', width / 2, podY + podH / 2);
    } else if (chasingCount > 0) {
      ctx.fillStyle = '#EF4444';
      ctx.fillText(`⚠️ ${chasingCount} SENTRIES ALERT!`, width / 2, podY + podH / 2);
    } else {
      ctx.fillStyle = '#10B981';
      ctx.fillText(`4 SENTRIES PATROLLING`, width / 2, podY + podH / 2);
    }

    // Mini status dots for players
    ctx.textAlign = 'right';
    let dotX = podX + podW - 14;
    const active = this.getActivePlayers();
    for (let i = active.length - 1; i >= 0; i--) {
      const p = active[i];
      ctx.beginPath();
      ctx.arc(dotX, podY + podH / 2, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();
      dotX -= 12;
    }
  }

  private renderThemePill(ctx: CanvasRenderingContext2D, height: number, theme: MazeThemeConfig): void {
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();

    ctx.strokeStyle = theme.pillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(theme.name, pillX + 14, pillY + pillH / 2);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('[T]', pillX + pillW - 12, pillY + pillH / 2);
    ctx.restore();
  }

  private renderControlHints(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText('Arrows/WASD: Move | Space/Action: Drop Trap', width - 24, height - 28);
    ctx.restore();
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const rankings = active
      .map((p) => {
        const ps = this.playersState.get(p.id);
        const score = ps ? ps.score : 0;
        return { playerId: p.id, score, place: 1 };
      })
      .sort((a, b) => b.score - a.score);

    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });

    const winnerId =
      rankings.length > 0 && (rankings.length === 1 || rankings[0].score > rankings[1].score)
        ? rankings[0].playerId
        : null;

    let mvpHighlight = 'Labyrinth Master!';
    if (winnerId !== null) {
      const ps = this.playersState.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} escaped with ${ps?.gemsCollected || 0} gems and ${ps?.score || 0} pts!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
