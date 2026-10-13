import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type SnakeTheme = 'colosseum' | 'jungle' | 'volcano';

interface ThemeConfig {
  id: SnakeTheme;
  name: string;
  badge: string;
  bgGradient: [string, string];
  arenaFloor: string;
  arenaBorder: string;
  obstacleFill: string;
  obstacleBorder: string;
  gridDotColor: string;
  accentGlow: string;
}

const THEME_CONFIGS: ThemeConfig[] = [
  {
    id: 'colosseum',
    name: 'Neon Colosseum',
    badge: '⚡ NEON COLOSSEUM',
    bgGradient: ['#0B0F19', '#030712'],
    arenaFloor: '#111827',
    arenaBorder: '#06B6D4',
    obstacleFill: '#1E293B',
    obstacleBorder: '#38BDF8',
    gridDotColor: 'rgba(6, 182, 212, 0.18)',
    accentGlow: '#06B6D4'
  },
  {
    id: 'jungle',
    name: 'Cyber Jungle',
    badge: '🌿 CYBER JUNGLE',
    bgGradient: ['#064E3B', '#022C22'],
    arenaFloor: '#052E16',
    arenaBorder: '#10B981',
    obstacleFill: '#14532D',
    obstacleBorder: '#34D399',
    gridDotColor: 'rgba(16, 185, 129, 0.20)',
    accentGlow: '#10B981'
  },
  {
    id: 'volcano',
    name: 'Volcanic Pit',
    badge: '🔥 VOLCANIC PIT',
    bgGradient: ['#1C1917', '#0C0A09'],
    arenaFloor: '#292524',
    arenaBorder: '#EF4444',
    obstacleFill: '#44403C',
    obstacleBorder: '#F97316',
    gridDotColor: 'rgba(239, 68, 68, 0.18)',
    accentGlow: '#F59E0B'
  }
];

interface SnakePoint {
  x: number;
  y: number;
}

interface SnakeState {
  id: PlayerId;
  body: SnakePoint[];
  dirX: number; // -1, 0, 1
  dirY: number;
  nextDirX: number;
  nextDirY: number;
  speed: number;
  baseSpeed: number;
  isAlive: boolean;
  score: number;
  pelletsEaten: number;
  moveTimer: number;
  botReactionTimer: number;
  isBoosting: boolean;
  boostFuel: number; // 0..1
  mood: CharacterMood;
  moodTimer: number;
  isUnderdog: boolean;
  shieldUsed: boolean;
}

interface Pellet {
  id: number;
  x: number;
  y: number;
  isGolden: boolean;
  pulseTimer: number;
}

interface Obstacle {
  x: number;
  y: number;
}

export class SnakeArenaGame extends BaseGame {
  private gridCols = 32;
  private gridRows = 22;
  private cellSize = 22;
  private offsetX = 0;
  private offsetY = 0;

  private snakes: Map<PlayerId, SnakeState> = new Map();
  private pellets: Pellet[] = [];
  private obstacles: Obstacle[] = [];
  public currentTheme: SnakeTheme = 'colosseum';
  private pelletCounter = 0;
  private suddenDeathAnnounced: boolean = false;
  private animTimer: number = 0;

  private lastWidth: number = 960;
  private lastHeight: number = 540;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;

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
    this.roundTimer = 55.0;
    this.isFinished = false;
    this.suddenDeathAnnounced = false;
    this.animTimer = 0;

    this.cellSize = Math.floor(Math.min((width * 0.78) / this.gridCols, (height * 0.68) / this.gridRows));
    this.offsetX = Math.floor((width - this.gridCols * this.cellSize) / 2);
    this.offsetY = Math.floor((height - this.gridRows * this.cellSize) / 2 + 18);

    this.generateObstacles();
    this.spawnSnakes();
    this.pellets = [];
    for (let i = 0; i < 9; i++) {
      this.spawnPellet(false);
    }
    this.syncDebug();
  }

  public syncDebug(): void {
    if (typeof window !== 'undefined') {
      const self = this;
      (window as any).__SNAKE_ARENA_DEBUG__ = {
        get snakes() { return Array.from(self.snakes.values()); },
        get pellets() { return self.pellets; },
        get roundTimer() { return self.roundTimer; },
        get isFinished() { return self.isFinished; },
        get theme() { return self.currentTheme; },
        setTheme: (t: SnakeTheme) => self.setSnakeTheme(t),
        cycleTheme: () => self.cycleTheme(),
        spawnGoldenPellet: () => self.spawnPellet(true)
      };
    }
  }

  private bindKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;
    this.keydownListener = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === '1') {
        this.setSnakeTheme('colosseum');
      } else if (e.key === '2') {
        this.setSnakeTheme('jungle');
      } else if (e.key === '3') {
        this.setSnakeTheme('volcano');
      }
    };
    window.addEventListener('keydown', this.keydownListener);
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
    const curIdx = THEME_CONFIGS.findIndex((t) => t.id === this.currentTheme);
    const nextIdx = (curIdx + 1) % THEME_CONFIGS.length;
    this.setSnakeTheme(THEME_CONFIGS[nextIdx].id);
  }

  public setSnakeTheme(theme: SnakeTheme): void {
    if (this.currentTheme === theme) return;
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnExplosion(100, this.lastHeight - 28, '#06B6D4', 12);
  }

  public destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownListener) {
        window.removeEventListener('keydown', this.keydownListener);
        this.keydownListener = null;
      }
      const canvas = this.input.getCanvas();
      if (canvas && this.boundPointerDown) {
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
        this.boundPointerDown = null;
      }
      delete (window as any).__SNAKE_ARENA_DEBUG__;
    }
  }

  private generateObstacles(): void {
    this.obstacles = [];
    const midX = Math.floor(this.gridCols / 2);
    const midY = Math.floor(this.gridRows / 2);

    // Balanced cross obstacles in corners and mid-lanes
    const offsets = [-7, 7];
    for (const ox of offsets) {
      for (const oy of offsets) {
        this.obstacles.push({ x: midX + ox, y: midY + oy });
        this.obstacles.push({ x: midX + ox + 1, y: midY + oy });
        this.obstacles.push({ x: midX + ox, y: midY + oy + 1 });
      }
    }
  }

  private spawnSnakes(): void {
    this.snakes.clear();
    const active = this.getActivePlayers();

    const spawnPositions: { x: number; y: number; dx: number; dy: number }[] = [
      { x: 4, y: 4, dx: 1, dy: 0 },
      { x: this.gridCols - 5, y: 4, dx: 0, dy: 1 },
      { x: 4, y: this.gridRows - 5, dx: 0, dy: -1 },
      { x: this.gridCols - 5, y: this.gridRows - 5, dx: -1, dy: 0 }
    ];

    active.forEach((p, idx) => {
      const sp = spawnPositions[idx % spawnPositions.length];
      const body: SnakePoint[] = [];
      for (let len = 0; len < 4; len++) {
        body.push({ x: sp.x - sp.dx * len, y: sp.y - sp.dy * len });
      }

      this.snakes.set(p.id, {
        id: p.id,
        body,
        dirX: sp.dx,
        dirY: sp.dy,
        nextDirX: sp.dx,
        nextDirY: sp.dy,
        speed: 8.5,
        baseSpeed: 8.5,
        isAlive: true,
        score: 0,
        pelletsEaten: 0,
        moveTimer: 0,
        botReactionTimer: 0.15 + idx * 0.05,
        isBoosting: false,
        boostFuel: 1.0,
        mood: 'idle',
        moodTimer: 0,
        isUnderdog: false,
        shieldUsed: false
      });
    });
  }

  private spawnPellet(isGolden: boolean): void {
    let attempts = 0;
    while (attempts < 100) {
      attempts++;
      const x = Math.floor(Math.random() * (this.gridCols - 2)) + 1;
      const y = Math.floor(Math.random() * (this.gridRows - 2)) + 1;

      // Check obstacle
      if (this.obstacles.some((o) => o.x === x && o.y === y)) continue;

      // Check snakes
      let occupied = false;
      for (const s of this.snakes.values()) {
        if (s.body.some((b) => b.x === x && b.y === y)) {
          occupied = true;
          break;
        }
      }
      if (occupied) continue;

      this.pellets.push({
        id: ++this.pelletCounter,
        x,
        y,
        isGolden,
        pulseTimer: 0
      });
      break;
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastWidth = width;
    this.lastHeight = height;
    this.animTimer += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update Underdog status (lowest score / eliminated)
    this.updateUnderdogStatus();

    // Sudden Death Urgency: draw snakes toward center with high-value golden food
    if (this.roundTimer <= 15 && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.spawnPellet(true);
      this.spawnPellet(true);
      this.spawnPellet(true);
      this.audio.playFanfare();
      this.particles.shake(0.35);
      this.particles.showFloatingText('SUDDEN DEATH! 🌟 SUPER PELLETS 2X', width / 2, 78, '#F59E0B', 24);
    }

    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    // Spawn golden super pellet occasionally
    if (Math.random() < dt * 0.28 && this.pellets.filter((p) => p.isGolden).length < 4) {
      this.spawnPellet(true);
    }

    // Update pulse animations
    for (const p of this.pellets) {
      p.pulseTimer += dt * 5;
    }

    // Handle bot AI
    this.updateBots(dt, width, height);

    // Human controls
    for (const p of this.getActivePlayers()) {
      const s = this.snakes.get(p.id);
      if (!s || !s.isAlive) continue;

      if (s.moodTimer > 0) {
        s.moodTimer = Math.max(0, s.moodTimer - dt);
        if (s.moodTimer <= 0) s.mood = 'idle';
      }

      // Boost Fuel recharge
      if (!s.isBoosting) {
        s.boostFuel = Math.min(1.0, s.boostFuel + dt * 0.25);
      }

      if (p.type === 'human') {
        const steer = this.input.getSteer(p.id);
        const throttle = this.input.getThrottle(p.id);
        const actionHeld = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
        const justPressed = this.input.justPressed(p.id) || this.input.justAction(p.id);

        // Nitro Boost: hold action
        if (actionHeld && s.boostFuel > 0.15 && s.body.length > 2) {
          s.isBoosting = true;
          s.boostFuel = Math.max(0, s.boostFuel - dt * 0.55);
          s.speed = s.baseSpeed * 1.55;
          s.mood = 'focused';

          // Emit exhaust trail particles
          const head = s.body[0];
          const px = this.offsetX + head.x * this.cellSize + this.cellSize / 2;
          const py = this.offsetY + head.y * this.cellSize + this.cellSize / 2;
          this.particles.emit(px, py, 2, '#F59E0B');
        } else {
          s.isBoosting = false;
          s.speed = s.baseSpeed;
        }

        if (Math.abs(steer) > 0.4) {
          if (steer > 0 && s.dirX === 0) {
            s.nextDirX = 1;
            s.nextDirY = 0;
            this.audio.playTap();
          } else if (steer < 0 && s.dirX === 0) {
            s.nextDirX = -1;
            s.nextDirY = 0;
            this.audio.playTap();
          }
        } else if (Math.abs(throttle) > 0.4) {
          if (throttle > 0 && s.dirY === 0) {
            s.nextDirX = 0;
            s.nextDirY = -1; // up
            this.audio.playTap();
          } else if (throttle < 0 && s.dirY === 0) {
            s.nextDirX = 0;
            s.nextDirY = 1; // down
            this.audio.playTap();
          }
        } else if (justPressed && !actionHeld) {
          // 90 degree clockwise turn for single-button tap
          const newDx = -s.dirY;
          const newDy = s.dirX;
          s.nextDirX = newDx;
          s.nextDirY = newDy;
          this.audio.playTap();
        }
      }
    }

    // Advance snakes
    for (const s of this.snakes.values()) {
      if (!s.isAlive) continue;

      s.moveTimer += dt;
      let effectiveSpeed = s.speed;
      if (s.isUnderdog) effectiveSpeed *= 1.15; // Underdog speed boost
      const stepDuration = 1 / effectiveSpeed;

      if (s.moveTimer >= stepDuration) {
        s.moveTimer -= stepDuration;

        // Apply direction change
        s.dirX = s.nextDirX;
        s.dirY = s.nextDirY;

        const head = s.body[0];
        const nextX = head.x + s.dirX;
        const nextY = head.y + s.dirY;

        // 1. Boundary collision
        if (nextX < 0 || nextX >= this.gridCols || nextY < 0 || nextY >= this.gridRows) {
          this.handleSnakeCrash(s);
          continue;
        }

        // 2. Obstacle collision
        if (this.obstacles.some((o) => o.x === nextX && o.y === nextY)) {
          this.handleSnakeCrash(s);
          continue;
        }

        // 3. Self collision
        if (s.body.slice(1).some((b) => b.x === nextX && b.y === nextY)) {
          this.handleSnakeCrash(s);
          continue;
        }

        // 4. Opponent snake collision
        let crashed = false;
        for (const other of this.snakes.values()) {
          if (!other.isAlive || other.id === s.id) continue;

          // Head-to-Head Clash (Elastic Bounce)
          const otherHead = other.body[0];
          if (otherHead.x === nextX && otherHead.y === nextY) {
            this.handleHeadClash(s, other);
            crashed = true;
            break;
          }

          // Body collision
          if (other.body.some((b) => b.x === nextX && b.y === nextY)) {
            this.handleSnakeCrash(s);
            other.score += 50;
            other.mood = 'triumph';
            other.moodTimer = 1.0;
            crashed = true;
            break;
          }
        }
        if (crashed) continue;

        // Move head forward
        s.body.unshift({ x: nextX, y: nextY });

        // Check pellet eating (with Underdog magnet check)
        const pelletIdx = this.findEatenPelletIndex(s, nextX, nextY);
        if (pelletIdx !== -1) {
          const eaten = this.pellets.splice(pelletIdx, 1)[0];
          s.pelletsEaten++;
          const pts = eaten.isGolden ? 35 : 15;
          s.score += this.roundTimer <= 15 ? pts * 2 : pts;
          s.baseSpeed = Math.min(13.0, s.baseSpeed + 0.12);
          s.mood = 'triumph';
          s.moodTimer = 0.5;

          const px = this.offsetX + nextX * this.cellSize + this.cellSize / 2;
          const py = this.offsetY + nextY * this.cellSize + this.cellSize / 2;
          this.particles.emit(px, py, 6, eaten.isGolden ? '#F59E0B' : '#10B981');
          this.audio.playChime();
          this.spawnPellet(false);
        } else {
          // Regular step: pop tail
          s.body.pop();
        }
      }
    }

    // Check last snake standing
    const alive = Array.from(this.snakes.values()).filter((s) => s.isAlive);
    if (alive.length <= 1 && this.getActivePlayers().length > 1) {
      if (alive.length === 1) {
        alive[0].score += 100;
        alive[0].mood = 'triumph';
      }
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private updateUnderdogStatus(): void {
    const snakes = Array.from(this.snakes.values());
    if (snakes.length < 2) return;

    let maxScore = -1;
    for (const s of snakes) {
      if (s.score > maxScore) maxScore = s.score;
    }

    for (const s of snakes) {
      s.isUnderdog = maxScore - s.score >= 100;
    }
  }

  private findEatenPelletIndex(s: SnakeState, headX: number, headY: number): number {
    // Direct head hit
    let idx = this.pellets.findIndex((p) => p.x === headX && p.y === headY);
    if (idx !== -1) return idx;

    // Underdog Magnet Fang: attracts adjacent pellets within 1 cell
    if (s.isUnderdog) {
      idx = this.pellets.findIndex(
        (p) => Math.abs(p.x - headX) <= 1 && Math.abs(p.y - headY) <= 1
      );
      if (idx !== -1) return idx;
    }

    return -1;
  }

  private handleHeadClash(s1: SnakeState, s2: SnakeState): void {
    this.audio.playBounce();
    this.particles.shake(0.35);

    // Shed 1 tail segment each instead of fatal double kill
    if (s1.body.length > 2) s1.body.pop();
    if (s2.body.length > 2) s2.body.pop();

    s1.mood = 'shocked';
    s1.moodTimer = 0.8;
    s2.mood = 'shocked';
    s2.moodTimer = 0.8;

    const px = this.offsetX + s1.body[0].x * this.cellSize + this.cellSize / 2;
    const py = this.offsetY + s1.body[0].y * this.cellSize + this.cellSize / 2;
    this.particles.spawnExplosion(px, py, '#F59E0B', 16);
    this.particles.showFloatingText('CLASH! 💥', px, py - 20, '#F59E0B', 20);

    // Reverse directions safely
    s1.nextDirX = -s1.dirX;
    s1.nextDirY = -s1.dirY;
    s2.nextDirX = -s2.dirX;
    s2.nextDirY = -s2.dirY;
  }

  private handleSnakeCrash(s: SnakeState): void {
    // Underdog Ghost Scale: absorb 1 crash
    if (s.isUnderdog && !s.shieldUsed && s.body.length > 3) {
      s.shieldUsed = true;
      s.body.splice(-2); // shed 2 tail segments
      this.audio.playBounce();
      this.particles.shake(0.25);
      const head = s.body[0];
      const px = this.offsetX + head.x * this.cellSize + this.cellSize / 2;
      const py = this.offsetY + head.y * this.cellSize + this.cellSize / 2;
      this.particles.showFloatingText('SHIELD SAVED! 🛡️', px, py - 20, '#F59E0B', 18);
      return;
    }

    this.killSnake(s);
  }

  private killSnake(s: SnakeState): void {
    s.isAlive = false;
    s.mood = 'shocked';
    this.audio.playLaser();

    // Turn segments into food pellets
    s.body.forEach((seg, idx) => {
      if (idx % 2 === 0 && this.pellets.length < 28) {
        this.pellets.push({
          id: ++this.pelletCounter,
          x: seg.x,
          y: seg.y,
          isGolden: false,
          pulseTimer: 0
        });
      }

      const px = this.offsetX + seg.x * this.cellSize + this.cellSize / 2;
      const py = this.offsetY + seg.y * this.cellSize + this.cellSize / 2;
      this.particles.emit(px, py, 8, '#EF4444');
    });
  }

  private getFreeSpaceCount(startX: number, startY: number, maxSteps: number = 24): number {
    const queue: { x: number; y: number }[] = [{ x: startX, y: startY }];
    const visited = new Set<string>();
    visited.add(`${startX},${startY}`);

    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];

    let count = 0;
    while (queue.length > 0 && count < maxSteps) {
      const cur = queue.shift()!;
      count++;

      for (const [dc, dr] of dirs) {
        const nx = cur.x + dc;
        const ny = cur.y + dr;
        if (nx >= 0 && nx < this.gridCols && ny >= 0 && ny < this.gridRows) {
          const key = `${nx},${ny}`;
          if (!visited.has(key)) {
            visited.add(key);
            if (!this.obstacles.some((o) => o.x === nx && o.y === ny)) {
              let hitSnake = false;
              for (const other of this.snakes.values()) {
                if (!other.isAlive) continue;
                if (other.body.some((b) => b.x === nx && b.y === ny)) {
                  hitSnake = true;
                  break;
                }
              }
              if (!hitSnake) {
                queue.push({ x: nx, y: ny });
              }
            }
          }
        }
      }
    }
    return count;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const s = this.snakes.get(botId);
    if (!s || !s.isAlive) return;

    s.botReactionTimer -= dt;
    if (s.botReactionTimer > 0) return;

    const baseDelay =
      difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.12 : 0.22;
    s.botReactionTimer = baseDelay;

    const head = s.body[0];

    const options = [
      { dx: s.dirX, dy: s.dirY },
      { dx: -s.dirY, dy: s.dirX },
      { dx: s.dirY, dy: -s.dirX }
    ];

    let bestOption = options[0];
    let bestScore = -99999;

    let targetPellet: Pellet | null = null;
    let minDist = 9999;
    for (const pel of this.pellets) {
      const d = Math.abs(head.x - pel.x) + Math.abs(head.y - pel.y);
      if (d < minDist) {
        minDist = d;
        targetPellet = pel;
      }
    }

    for (const opt of options) {
      const nextX = head.x + opt.dx;
      const nextY = head.y + opt.dy;

      if (nextX < 0 || nextX >= this.gridCols || nextY < 0 || nextY >= this.gridRows) {
        continue;
      }

      if (this.obstacles.some((o) => o.x === nextX && o.y === nextY)) {
        continue;
      }

      let hitBody = false;
      for (const other of this.snakes.values()) {
        if (!other.isAlive) continue;
        if (other.body.some((b) => b.x === nextX && b.y === nextY)) {
          hitBody = true;
          break;
        }
      }
      if (hitBody) continue;

      let score = 100;

      const freeSpace = this.getFreeSpaceCount(nextX, nextY, 18);
      if (freeSpace < 6) {
        score -= (6 - freeSpace) * 40;
      } else {
        score += freeSpace * 3.5;
      }

      if (targetPellet) {
        const d = Math.abs(nextX - targetPellet.x) + Math.abs(nextY - targetPellet.y);
        score -= d * 6;
      }

      const distToBorder = Math.min(nextX, this.gridCols - 1 - nextX, nextY, this.gridRows - 1 - nextY);
      score += distToBorder * 2;

      if (difficulty === 'bot_easy') {
        score += (Math.random() - 0.5) * 45;
      }

      if (score > bestScore) {
        bestScore = score;
        bestOption = opt;
      }
    }

    s.nextDirX = bestOption.dx;
    s.nextDirY = bestOption.dy;

    // Hard AI uses boost to snatch golden pellets
    if (difficulty === 'bot_hard' && targetPellet && targetPellet.isGolden && minDist < 6) {
      s.isBoosting = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;

    const cfg = THEME_CONFIGS.find((t) => t.id === this.currentTheme) || THEME_CONFIGS[0];

    // 1. Stage Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, cfg.bgGradient[0]);
    bgGrad.addColorStop(1, cfg.bgGradient[1]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Arena Floor
    const arenaW = this.gridCols * this.cellSize;
    const arenaH = this.gridRows * this.cellSize;

    ctx.save();
    ctx.fillStyle = cfg.arenaFloor;
    ctx.fillRect(this.offsetX, this.offsetY, arenaW, arenaH);

    ctx.strokeStyle = cfg.arenaBorder;
    ctx.lineWidth = 3;
    ctx.shadowColor = cfg.accentGlow;
    ctx.shadowBlur = this.roundTimer <= 15 ? 16 + Math.sin(this.animTimer * 10) * 8 : 8;
    ctx.strokeRect(this.offsetX, this.offsetY, arenaW, arenaH);
    ctx.restore();

    // Subtle grid dots
    ctx.fillStyle = cfg.gridDotColor;
    for (let c = 1; c < this.gridCols; c++) {
      for (let r = 1; r < this.gridRows; r++) {
        ctx.fillRect(this.offsetX + c * this.cellSize - 1, this.offsetY + r * this.cellSize - 1, 2, 2);
      }
    }

    // 2. Obstacles
    for (const o of this.obstacles) {
      const ox = this.offsetX + o.x * this.cellSize;
      const oy = this.offsetY + o.y * this.cellSize;
      ctx.fillStyle = cfg.obstacleFill;
      ctx.fillRect(ox + 2, oy + 2, this.cellSize - 4, this.cellSize - 4);
      ctx.strokeStyle = cfg.obstacleBorder;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ox + 2, oy + 2, this.cellSize - 4, this.cellSize - 4);
    }

    // 3. Pellets
    for (const p of this.pellets) {
      const px = this.offsetX + p.x * this.cellSize + this.cellSize / 2;
      const py = this.offsetY + p.y * this.cellSize + this.cellSize / 2;
      const rad = (this.cellSize * 0.34) * (1 + Math.sin(p.pulseTimer) * 0.22);

      ctx.save();
      ctx.fillStyle = p.isGolden ? '#F59E0B' : '#10B981';
      ctx.shadowColor = p.isGolden ? '#F59E0B' : '#10B981';
      ctx.shadowBlur = p.isGolden ? 12 : 6;
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Snakes (2.5D Segmented Cylinders)
    for (const p of this.getActivePlayers()) {
      const s = this.snakes.get(p.id);
      if (!s || !s.isAlive) continue;

      s.body.forEach((seg, idx) => {
        const sx = this.offsetX + seg.x * this.cellSize + this.cellSize / 2;
        const sy = this.offsetY + seg.y * this.cellSize + this.cellSize / 2;
        const rad = idx === 0 ? this.cellSize * 0.46 : this.cellSize * 0.38;

        ctx.save();
        ctx.fillStyle = idx === 0 ? p.color : p.colorDark;
        if (s.isBoosting) {
          ctx.shadowColor = '#F59E0B';
          ctx.shadowBlur = 10;
        }
        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Eyes on Head
        if (idx === 0) {
          ctx.fillStyle = '#FFFFFF';
          const eyeOffset = 3.5;
          ctx.beginPath();
          ctx.arc(sx + s.dirY * eyeOffset, sy - s.dirX * eyeOffset, 2.5, 0, Math.PI * 2);
          ctx.arc(sx - s.dirY * eyeOffset, sy + s.dirX * eyeOffset, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Pupils
          ctx.fillStyle = '#0F172A';
          ctx.beginPath();
          ctx.arc(sx + s.dirY * eyeOffset + s.dirX, sy - s.dirX * eyeOffset + s.dirY, 1.2, 0, Math.PI * 2);
          ctx.arc(sx - s.dirY * eyeOffset + s.dirX, sy + s.dirX * eyeOffset + s.dirY, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
    }

    // 5. Corner Player Cards & Mascot Avatars
    this.renderPlayerCornerCards(ctx, width, height, cfg);

    // 6. Center Sub-Header Badge (y: 56, h: 26 - respects top-center y:12-44 safe zone)
    this.renderSubHeaderBadge(ctx, width, cfg);

    // 7. Interactive Theme Pill (bottom-left x: 20, y: height - 44, w: 170, h: 32)
    this.renderThemePill(ctx, height, cfg);

    // 8. Control Hints (bottom-right x: width - 20, y: height - 28, textAlign: right)
    this.renderControlsHUD(ctx, width, height);
  }

  private renderPlayerCornerCards(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cfg: ThemeConfig
  ): void {
    for (const p of this.getActivePlayers()) {
      const s = this.snakes.get(p.id);
      if (!s) continue;

      let px = 20;
      let py = 16;
      let mascotX = px + 175;
      let mascotY = py + 36;

      if (p.corner === 'top-right') {
        px = width - 180;
        mascotX = px - 20;
      } else if (p.corner === 'bottom-left') {
        // Place neatly above theme pill (theme pill is at y: height - 44)
        py = height - 134;
        mascotY = py + 36;
      } else if (p.corner === 'bottom-right') {
        px = width - 180;
        py = height - 134;
        mascotX = px - 20;
        mascotY = py + 36;
      }

      // Container Card
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
      ctx.beginPath();
      ctx.roundRect(px, py, 160, 78, 8);
      ctx.fill();

      // Card border (dashed gold if Underdog)
      if (s.isUnderdog) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 3]);
      } else {
        ctx.strokeStyle = s.isAlive ? p.color : '#64748B';
        ctx.lineWidth = 2;
      }
      ctx.stroke();
      ctx.restore();

      // Name & Score
      ctx.fillStyle = s.isAlive ? p.color : '#94A3B8';
      ctx.font = '700 12px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, px + 10, py + 18);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '800 13px Inter, monospace';
      ctx.fillText(`${s.score} pts`, px + 10, py + 35);

      ctx.fillStyle = s.isAlive ? '#10B981' : '#EF4444';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillText(s.isAlive ? `Len: ${s.body.length}` : 'CRASHED ✖', px + 10, py + 54);

      // Boost meter bar
      if (s.isAlive) {
        ctx.fillStyle = '#334155';
        ctx.fillRect(px + 75, py + 44, 70, 8);
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(px + 75, py + 44, 70 * s.boostFuel, 8);
      }

      // Render Mascot Avatar alongside the card
      const isBot = p.type !== 'human';
      ctx.save();
      drawCharacter(ctx, mascotX, mascotY, 13, psId(p.id), isBot, s.mood, this.animTimer);
      ctx.restore();
    }
  }

  private renderSubHeaderBadge(ctx: CanvasRenderingContext2D, width: number, cfg: ThemeConfig): void {
    const podW = 340;
    const podH = 26;
    const podX = width / 2 - podW / 2;
    const podY = 56; // Safe zone below top-center timer y: 12-44

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 13);
    ctx.fill();

    ctx.strokeStyle = cfg.arenaBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Map Name Badge
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(`ARENA: ${cfg.name}`, podX + 16, podY + 17);

    // Alive status
    const aliveCount = Array.from(this.snakes.values()).filter((s) => s.isAlive).length;
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    if (this.roundTimer <= 15) {
      ctx.fillStyle = '#EF4444';
      ctx.fillText(`⚡ SUDDEN DEATH (${aliveCount} ALIVE)`, podX + podW - 16, podY + 17);
    } else {
      ctx.fillStyle = '#10B981';
      ctx.fillText(`${aliveCount} SNAKES ALIVE`, podX + podW - 16, podY + 17);
    }
    ctx.restore();
  }

  private renderThemePill(ctx: CanvasRenderingContext2D, height: number, cfg: ThemeConfig): void {
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();

    ctx.strokeStyle = cfg.arenaBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(cfg.badge, pillX + 12, pillY + 20);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('[T]', pillX + pillW - 10, pillY + 20);
    ctx.restore();
  }

  private renderControlsHUD(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.fillText('Steer: Guide Direction | Hold Action: Nitro Dash | Tap: 90° Turn', width - 20, height - 28);
    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const sorted = [...active].sort((a, b) => {
      const sa = this.snakes.get(a.id);
      const sb = this.snakes.get(b.id);
      if (!sa || !sb) return 0;
      if (sa.isAlive !== sb.isAlive) {
        return sa.isAlive ? -1 : 1;
      }
      return sb.score - sa.score;
    });

    const winnerId = sorted.length > 0 ? sorted[0].id : null;
    const topScore = this.snakes.get(winnerId ?? 0)?.score || 0;

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      score: this.snakes.get(p.id)?.score || 0,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: `Apex predator! Dominated ${this.currentTheme} with ${topScore} pts and supreme arena control!`
    };
  }
}

function psId(id: PlayerId): PlayerId {
  return id;
}
