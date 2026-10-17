import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';

interface GridPlayer {
  id: PlayerId;
  gx: number;
  gy: number;
  targetGx: number;
  targetGy: number;
  moveProgress: number; // 0 to 1
  alive: boolean;
  score: number;
  dirIndex: number; // 0: Right, 1: Down, 2: Left, 3: Up
  reverse: boolean;
  charge: number;
  wasHolding: boolean;
  phaseTimer: number;
  stunTimer: number;
  streak: number;
  multiplier: number;
}

interface TileState {
  warningTime: number; // >0 means warning flashing
  laserTime: number;   // >0 means active lethal beam
  hasBattery: boolean;
  isQuantumCore: boolean;
}

interface LaserGridTheme {
  name: string;
  bg: string;
  frameGlow: string;
  frameStroke: string;
  tileEven: string;
  tileOdd: string;
  tileBorder: string;
}

const LASER_GRID_THEMES: LaserGridTheme[] = [
  {
    name: 'Cyber Reactor Grid ⚡',
    bg: '#070A13',
    frameGlow: '#0EA5E9',
    frameStroke: '#0284C7',
    tileEven: '#131D31',
    tileOdd: '#0B1324',
    tileBorder: '#1E293B',
  },
  {
    name: 'Solar Plasma Vault ☀️',
    bg: '#180B05',
    frameGlow: '#F59E0B',
    frameStroke: '#D97706',
    tileEven: '#2B150A',
    tileOdd: '#1C0D06',
    tileBorder: '#451A03',
  },
  {
    name: 'Synthwave Void Matrix 🌌',
    bg: '#0D051A',
    frameGlow: '#EC4899',
    frameStroke: '#A855F7',
    tileEven: '#1F1037',
    tileOdd: '#140926',
    tileBorder: '#3B0764',
  },
];

export class LaserGridReflexGame extends BaseGame {
  private readonly gridSize = 5;
  private tiles: TileState[][] = [];
  private gridPlayers: Map<PlayerId, GridPlayer> = new Map();
  private patternTimer: number = 2.5;
  private laserSpeedMultiplier: number = 1.0;
  private batterySpawnTimer: number = 2.8;
  private targetBatteriesToWin: number = 10;
  private tileSize: number = 64;
  private gridOriginX: number = 0;
  private gridOriginY: number = 0;
  private botMoveTimers: Map<PlayerId, number> = new Map();
  private botDangerTimers: Map<PlayerId, number> = new Map();
  private themeIndex: number = 0;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  public init(width: number, height: number): void {
    this.reset(width, height);
    if (typeof window !== 'undefined' && !this.keyHandler) {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.themeIndex = (this.themeIndex + 1) % LASER_GRID_THEMES.length;
          this.audio.playTap();
        } else if (e.key >= '1' && e.key <= '3') {
          this.themeIndex = parseInt(e.key, 10) - 1;
          this.audio.playTap();
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    super.destroy();
  }

  public handlePointerDown(x: number, y: number, width: number, height: number): boolean {
    void height;
    if (y < 60 && x > width - 230) {
      this.themeIndex = (this.themeIndex + 1) % LASER_GRID_THEMES.length;
      this.audio.playTap();
      return true;
    }
    return false;
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 48;
    this.isFinished = false;
    this.patternTimer = 1.9;
    this.laserSpeedMultiplier = 1.0;
    this.batterySpawnTimer = 2.4;

    this.tileSize = Math.min(104, Math.floor((Math.min(width, height) - 96) / this.gridSize));
    this.gridOriginX = Math.floor((width - this.gridSize * this.tileSize) / 2);
    this.gridOriginY = Math.floor((height - this.gridSize * this.tileSize) / 2);

    this.tiles = [];
    for (let y = 0; y < this.gridSize; y++) {
      const row: TileState[] = [];
      for (let x = 0; x < this.gridSize; x++) {
        row.push({ warningTime: 0, laserTime: 0, hasBattery: false, isQuantumCore: false });
      }
      this.tiles.push(row);
    }

    const cornerCoords = [
      { gx: 0, gy: 0, dir: 0 }, // P1: Top-Left
      { gx: 4, gy: 0, dir: 1 }, // P2: Top-Right
      { gx: 0, gy: 4, dir: 3 }, // P3: Bottom-Left
      { gx: 4, gy: 4, dir: 2 }, // P4: Bottom-Right
    ];

    this.gridPlayers.clear();
    const active = this.getActivePlayers();
    active.forEach((p) => {
      const c = cornerCoords[p.id % cornerCoords.length];
      this.gridPlayers.set(p.id, {
        id: p.id,
        gx: c.gx,
        gy: c.gy,
        targetGx: c.gx,
        targetGy: c.gy,
        moveProgress: 1,
        alive: true,
        score: 0,
        dirIndex: c.dir,
        reverse: false,
        charge: 0,
        wasHolding: false,
        phaseTimer: 0,
        stunTimer: 0,
        streak: 0,
        multiplier: 1,
      });
    });

    // Spawn initial Quantum Core in center
    this.tiles[2][2].hasBattery = true;
    this.tiles[2][2].isQuantumCore = true;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.laserSpeedMultiplier += dt * 0.015;
    this.updateBots(dt, width, height);

    // Update Tiles (warning & active lasers)
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const t = this.tiles[y][x];
        if (t.warningTime > 0) {
          t.warningTime -= dt * this.laserSpeedMultiplier;
          if (t.warningTime <= 0) {
            t.laserTime = 0.58;
            this.audio.playLaser();
            this.particles.addTrauma(0.12);
          }
        } else if (t.laserTime > 0) {
          t.laserTime -= dt;
        }
      }
    }

    // Trigger new laser patterns
    this.patternTimer -= dt * this.laserSpeedMultiplier;
    if (this.patternTimer <= 0) {
      this.patternTimer = Math.max(1.05, 2.1 - (48 - this.roundTimer) * 0.02);
      this.triggerLaserPattern();
    }

    // Battery spawning
    this.batterySpawnTimer -= dt;
    if (this.batterySpawnTimer <= 0) {
      this.batterySpawnTimer = 2.6;
      this.spawnBattery();
    }

    const deltas = [
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: -1 },
    ];

    let maxScore = 0;
    for (const gp of this.gridPlayers.values()) {
      if (gp.score > maxScore) maxScore = gp.score;
    }

    // Process Player Inputs and Movements
    for (const gp of this.gridPlayers.values()) {
      if (!gp.alive) continue;

      if (gp.phaseTimer > 0) gp.phaseTimer -= dt;
      if (gp.stunTimer > 0) {
        gp.stunTimer -= dt;
        continue;
      }

      const isUnderdog = maxScore - gp.score >= 3;
      const isPressed = this.input.isPressed(gp.id);
      const justPressed = this.input.justPressed(gp.id);
      const holdingAction = this.input.isActionPressed(gp.id);

      // Hold-to-Charge Overcharge Phase & EMP Shunt (72% - 98% Sweet Spot)
      if (holdingAction) {
        gp.wasHolding = true;
        gp.charge = Math.min(1.05, gp.charge + dt * (isUnderdog ? 1.05 : 0.85));
        if (gp.charge >= 1.02) {
          gp.charge = 0;
          gp.wasHolding = false;
          gp.stunTimer = 0.55;
          const px = this.gridOriginX + (gp.gx + 0.5) * this.tileSize;
          const py = this.gridOriginY + (gp.gy + 0.5) * this.tileSize;
          this.audio.playBuzzer();
          this.particles.showFloatingText('OVERLOAD!', px, py - 24, '#EF4444', 18);
        }
      } else if (gp.wasHolding) {
        const released = gp.charge;
        gp.charge = 0;
        gp.wasHolding = false;
        if (released >= 0.72 && released <= 0.98) {
          gp.phaseTimer = 1.65;
          gp.score += 1;
          const px = this.gridOriginX + (gp.gx + 0.5) * this.tileSize;
          const py = this.gridOriginY + (gp.gy + 0.5) * this.tileSize;
          this.audio.playBoost();
          this.particles.spawnSparks(px, py, '#38BDF8', 22);
          this.particles.showFloatingText('PHASE SURGE! +1', px, py - 26, '#38BDF8', 20);

          // EMP Tile Shunt against nearby rivals (Manhattan distance <= 2)
          for (const other of this.gridPlayers.values()) {
            if (other.id === gp.id || !other.alive) continue;
            const dist = Math.abs(other.gx - gp.gx) + Math.abs(other.gy - gp.gy);
            if (dist <= 2) {
              const pushDx = Math.sign(other.gx - gp.gx) || deltas[gp.dirIndex].dx;
              const pushDy = Math.sign(other.gy - gp.gy) || deltas[gp.dirIndex].dy;
              other.targetGx = Math.max(0, Math.min(this.gridSize - 1, other.gx + pushDx));
              other.targetGy = Math.max(0, Math.min(this.gridSize - 1, other.gy + pushDy));
              other.moveProgress = 0;
              const ox = this.gridOriginX + (other.gx + 0.5) * this.tileSize;
              const oy = this.gridOriginY + (other.gy + 0.5) * this.tileSize;
              this.particles.showFloatingText('EMP SHUNT!', ox, oy - 22, '#F59E0B', 18);
            }
          }
        }
      }

      const steer = this.input.getSteer(gp.id);
      const throttle = this.input.getThrottle(gp.id);

      let desiredDir: number | null = null;
      if (throttle > 0) desiredDir = 3;      // Up
      else if (throttle < 0) desiredDir = 1; // Down
      else if (steer > 0) desiredDir = 0;    // Right
      else if (steer < 0) desiredDir = 2;    // Left
      else if (justPressed) {
        desiredDir = (gp.dirIndex + (isPressed ? -1 : 1) + 4) % 4;
      }

      if (desiredDir !== null && gp.moveProgress >= 1) {
        const nx = gp.gx + deltas[desiredDir].dx;
        const ny = gp.gy + deltas[desiredDir].dy;
        if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
          gp.dirIndex = desiredDir;
          gp.targetGx = nx;
          gp.targetGy = ny;
          gp.moveProgress = 0;
          this.audio.playTap();

          // Check if stepping onto a tile occupied by a rival -> Shove them 1 tile!
          for (const other of this.gridPlayers.values()) {
            if (other.id !== gp.id && other.alive && other.gx === nx && other.gy === ny) {
              const shoveX = Math.max(0, Math.min(this.gridSize - 1, other.gx + deltas[desiredDir].dx));
              const shoveY = Math.max(0, Math.min(this.gridSize - 1, other.gy + deltas[desiredDir].dy));
              other.targetGx = shoveX;
              other.targetGy = shoveY;
              other.moveProgress = 0;
              this.audio.playBounce();
              const ox = this.gridOriginX + (other.gx + 0.5) * this.tileSize;
              const oy = this.gridOriginY + (other.gy + 0.5) * this.tileSize;
              this.particles.spawnSparks(ox, oy, '#FFFFFF', 12);
              this.particles.showFloatingText('SHOVED!', ox, oy - 18, this.players[gp.id].color, 18);
            }
          }
        }
      }

      // Smooth step interpolation
      if (gp.moveProgress < 1) {
        const stepSpeed = gp.phaseTimer > 0 ? 15 : isUnderdog ? 12 : 10;
        gp.moveProgress = Math.min(1, gp.moveProgress + dt * stepSpeed);
        if (gp.moveProgress >= 1) {
          gp.gx = gp.targetGx;
          gp.gy = gp.targetGy;

          const tile = this.tiles[gp.gy][gp.gx];
          if (tile.hasBattery) {
            const isQuantum = tile.isQuantumCore;
            tile.hasBattery = false;
            tile.isQuantumCore = false;
            gp.streak++;
            gp.multiplier = gp.streak >= 4 ? 3 : gp.streak >= 2 ? 2 : 1;
            const gained = (isQuantum ? 2 : 1) * (gp.streak >= 3 ? 2 : 1);
            gp.score += gained;
            this.audio.playScore();
            const px = this.gridOriginX + (gp.gx + 0.5) * this.tileSize;
            const py = this.gridOriginY + (gp.gy + 0.5) * this.tileSize;
            this.particles.showFloatingText(
              isQuantum ? `⚡ QUANTUM CORE! +${gained}` : `+${gained} BATTERY!`,
              px,
              py - 20,
              isQuantum ? '#38BDF8' : '#F59E0B',
              20
            );
            this.particles.spawnSparks(px, py, isQuantum ? '#38BDF8' : '#F59E0B', 16);

            if (gp.score >= this.targetBatteriesToWin) {
              this.isFinished = true;
            }
          }
        }
      }

      // Check laser collision (Phase Armor protects against lasers; otherwise stuns & drops 1 battery so players stay in the action!)
      const curTile = this.tiles[gp.gy][gp.gx];
      if (curTile.laserTime > 0.1 && gp.phaseTimer <= 0) {
        const px = this.gridOriginX + (gp.gx + 0.5) * this.tileSize;
        const py = this.gridOriginY + (gp.gy + 0.5) * this.tileSize;
        gp.phaseTimer = 1.35; // Post-hit invulnerability buffer
        gp.stunTimer = 0.65;
        gp.streak = 0;
        gp.multiplier = 1;
        if (gp.score > 0 && !isUnderdog) {
          gp.score = Math.max(0, gp.score - 1);
        }
        this.audio.playExplosion();
        this.particles.spawnExplosion(px, py, this.players[gp.id].color, 26);
        this.particles.showFloatingText('LASER ZAP! -1', px, py, '#EF4444', 22);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private triggerLaserPattern(): void {
    const patternType = Math.floor(Math.random() * 4);
    if (patternType === 0) {
      const r = Math.floor(Math.random() * this.gridSize);
      const c = Math.floor(Math.random() * this.gridSize);
      for (let i = 0; i < this.gridSize; i++) {
        this.tiles[r][i].warningTime = 0.9;
        this.tiles[i][c].warningTime = 0.9;
      }
    } else if (patternType === 1) {
      const offset = Math.random() > 0.5 ? 0 : 1;
      for (let y = 0; y < this.gridSize; y++) {
        for (let x = 0; x < this.gridSize; x++) {
          if ((x + y) % 2 === offset) {
            this.tiles[y][x].warningTime = 1.0;
          }
        }
      }
    } else if (patternType === 2) {
      for (let i = 0; i < this.gridSize; i++) {
        this.tiles[0][i].warningTime = 0.9;
        this.tiles[this.gridSize - 1][i].warningTime = 0.9;
        this.tiles[i][0].warningTime = 0.9;
        this.tiles[i][this.gridSize - 1].warningTime = 0.9;
      }
    } else {
      const r1 = Math.floor(Math.random() * this.gridSize);
      const r2 = (r1 + 2) % this.gridSize;
      for (let i = 0; i < this.gridSize; i++) {
        this.tiles[r1][i].warningTime = 0.9;
        this.tiles[r2][i].warningTime = 0.9;
      }
    }
  }

  private spawnBattery(): void {
    const emptyCells: { x: number; y: number }[] = [];
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (!this.tiles[y][x].hasBattery && this.tiles[y][x].laserTime <= 0 && this.tiles[y][x].warningTime <= 0) {
          emptyCells.push({ x, y });
        }
      }
    }
    if (emptyCells.length > 0) {
      const choice = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      this.tiles[choice.y][choice.x].hasBattery = true;
      this.tiles[choice.y][choice.x].isQuantumCore = Math.random() < 0.28;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    void width;
    void height;
    const gp = this.gridPlayers.get(botId);
    if (!gp || !gp.alive || gp.moveProgress < 1 || gp.stunTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    const curTile = this.tiles[gp.gy][gp.gx];
    const isDangerous = curTile.warningTime > 0 || curTile.laserTime > 0;

    let dangerTime = this.botDangerTimers.get(botId) || 0;
    if (isDangerous) {
      dangerTime += dt;
      this.botDangerTimers.set(botId, dangerTime);
    } else {
      dangerTime = 0;
      this.botDangerTimers.set(botId, 0);
    }

    const dangerReactionRequired = difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.26 : 0.45;
    if (isDangerous && dangerTime < dangerReactionRequired) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    const moveCadence = difficulty === 'bot_hard' ? 0.16 : difficulty === 'bot_normal' ? 0.36 : 0.58;
    let timer = this.botMoveTimers.get(botId) || 0;
    timer += dt;
    this.botMoveTimers.set(botId, timer);

    if (!isDangerous && timer < moveCadence) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    let targetBattery: { x: number; y: number } | null = null;
    let minBatteryDist = Infinity;
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        if (this.tiles[y][x].hasBattery) {
          const d = Math.abs(x - gp.gx) + Math.abs(y - gp.gy);
          if (d < minBatteryDist) {
            minBatteryDist = d;
            targetBattery = { x, y };
          }
        }
      }
    }

    const deltas = [
      { dir: 0, dx: 1, dy: 0, steer: 1, throttle: 0 },
      { dir: 1, dx: 0, dy: 1, steer: 0, throttle: -1 },
      { dir: 2, dx: -1, dy: 0, steer: -1, throttle: 0 },
      { dir: 3, dx: 0, dy: -1, steer: 0, throttle: 1 },
    ];

    let bestScore = -Infinity;
    let bestDelta: (typeof deltas)[0] | null = null;
    const shuffledDeltas = [...deltas].sort(() => Math.random() - 0.5);

    for (const d of shuffledDeltas) {
      const nx = gp.gx + d.dx;
      const ny = gp.gy + d.dy;
      if (nx < 0 || nx >= this.gridSize || ny < 0 || ny >= this.gridSize) continue;

      const neighborTile = this.tiles[ny][nx];
      let score = 0;

      if (neighborTile.laserTime > 0) score -= 100000;
      else if (neighborTile.warningTime > 0) score -= 50000;
      else score += 100;

      if (neighborTile.hasBattery) score += neighborTile.isQuantumCore ? 3200 : 2000;

      if (targetBattery) {
        const dist = Math.abs(nx - targetBattery.x) + Math.abs(ny - targetBattery.y);
        score -= dist * 25;
      }

      if (difficulty === 'bot_normal') {
        score += (Math.random() - 0.5) * 80;
      } else if (difficulty === 'bot_easy') {
        score += (Math.random() - 0.5) * 450;
      }

      if (score > bestScore) {
        bestScore = score;
        bestDelta = d;
      }
    }

    if (bestDelta && (isDangerous || bestScore > 0)) {
      this.botMoveTimers.set(botId, 0);
      this.input.setBotInput(botId, true, bestDelta.steer, bestDelta.throttle, false);
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const theme = LASER_GRID_THEMES[this.themeIndex];

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);

    const totalGridSize = this.gridSize * this.tileSize;

    // Outer Arena Containment Frame with Neon Glow
    ctx.save();
    ctx.shadowColor = theme.frameGlow;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = theme.frameStroke;
    ctx.lineWidth = 3;
    ctx.strokeRect(this.gridOriginX - 8, this.gridOriginY - 8, totalGridSize + 16, totalGridSize + 16);
    ctx.restore();

    // Corner Energy Pylons
    const pylonSize = 14;
    const corners = [
      { x: this.gridOriginX - 12, y: this.gridOriginY - 12 },
      { x: this.gridOriginX + totalGridSize - 2, y: this.gridOriginY - 12 },
      { x: this.gridOriginX - 12, y: this.gridOriginY + totalGridSize - 2 },
      { x: this.gridOriginX + totalGridSize - 2, y: this.gridOriginY + totalGridSize - 2 },
    ];
    for (const c of corners) {
      ctx.fillStyle = theme.frameStroke;
      ctx.fillRect(c.x, c.y, pylonSize, pylonSize);
      ctx.fillStyle = theme.frameGlow;
      ctx.fillRect(c.x + 3, c.y + 3, pylonSize - 6, pylonSize - 6);
    }

    // Floor Grid Tiles
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const px = this.gridOriginX + x * this.tileSize;
        const py = this.gridOriginY + y * this.tileSize;
        const t = this.tiles[y][x];

        if (t.laserTime > 0) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.90)';
        } else if (t.warningTime > 0) {
          const isFlash = Math.sin(t.warningTime * 24) > 0;
          ctx.fillStyle = isFlash ? 'rgba(239, 68, 68, 0.55)' : 'rgba(245, 158, 11, 0.35)';
        } else {
          ctx.fillStyle = (x + y) % 2 === 0 ? theme.tileEven : theme.tileOdd;
        }

        ctx.fillRect(px + 2, py + 2, this.tileSize - 4, this.tileSize - 4);

        if (t.warningTime > 0 && t.laserTime <= 0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(px + 2, py + 2, this.tileSize - 4, this.tileSize - 4);
          ctx.clip();
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
          ctx.lineWidth = 3;
          for (let d = -this.tileSize; d < this.tileSize * 2; d += 16) {
            ctx.beginPath();
            ctx.moveTo(px + d, py);
            ctx.lineTo(px + d + this.tileSize, py + this.tileSize);
            ctx.stroke();
          }
          ctx.restore();
        }

        ctx.strokeStyle = t.laserTime > 0 ? '#EF4444' : t.warningTime > 0 ? '#F59E0B' : theme.tileBorder;
        ctx.lineWidth = t.laserTime > 0 ? 3 : 1;
        ctx.strokeRect(px + 2, py + 2, this.tileSize - 4, this.tileSize - 4);

        // Overcharge Energy Battery / Quantum Core
        if (t.hasBattery && t.laserTime <= 0) {
          const cx = px + this.tileSize / 2;
          const cy = py + this.tileSize / 2;
          const pulse = Math.sin(performance.now() * 0.008) * 4;

          ctx.save();
          ctx.shadowColor = t.isQuantumCore ? '#38BDF8' : '#F59E0B';
          ctx.shadowBlur = 18;
          ctx.fillStyle = t.isQuantumCore ? '#38BDF8' : '#FBBF24';
          ctx.beginPath();
          ctx.arc(cx, cy, (t.isQuantumCore ? 17 : 14) + pulse, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          for (let pt = 0; pt < 6; pt++) {
            const a = (pt * Math.PI) / 3;
            const hx = cx + Math.cos(a) * (t.isQuantumCore ? 10 : 8);
            const hy = cy + Math.sin(a) * (t.isQuantumCore ? 10 : 8);
            if (pt === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // Active Laser Beam Core
        if (t.laserTime > 0) {
          ctx.save();
          ctx.shadowColor = '#EF4444';
          ctx.shadowBlur = 16;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(px + this.tileSize / 2 - 5, py, 10, this.tileSize);
          ctx.fillRect(px, py + this.tileSize / 2 - 5, this.tileSize, 10);
          ctx.restore();
        }
      }
    }

    // Render Players
    const now = performance.now() * 0.001;
    for (const gp of this.gridPlayers.values()) {
      if (!gp.alive) continue;
      const p = this.players[gp.id];

      const curX = this.gridOriginX + (gp.gx + (gp.targetGx - gp.gx) * gp.moveProgress + 0.5) * this.tileSize;
      const curY = this.gridOriginY + (gp.gy + (gp.targetGy - gp.gy) * gp.moveProgress + 0.5) * this.tileSize;

      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(curX, curY + this.tileSize * 0.28, this.tileSize * 0.28, this.tileSize * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Phase Armor Aura
      if (gp.phaseTimer > 0) {
        ctx.save();
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(curX, curY, this.tileSize * 0.38, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Fixed [gy][gx] indexing!
      const currentTile = this.tiles[gp.gy]?.[gp.gx];
      const isDanger = currentTile && currentTile.warningTime > 0;
      const mood = gp.stunTimer > 0 || isDanger ? 'shocked' : gp.phaseTimer > 0 ? 'triumph' : gp.moveProgress < 1 ? 'focused' : 'idle';

      this.drawPlayerMascot(ctx, gp.id, curX, curY, this.tileSize * 0.32, mood, now);

      // Hold-to-Charge Bar
      if (gp.charge > 0.02) {
        const bx = curX - 24;
        const by = curY + this.tileSize * 0.32;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(bx, by, 48, 6);
        ctx.fillStyle = gp.charge >= 0.72 && gp.charge <= 0.98 ? '#38BDF8' : '#F59E0B';
        ctx.fillRect(bx, by, 48 * Math.min(1, gp.charge), 6);
      }

      // Score Pill Tag above head
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      const tagW = 44;
      const tagH = 16;
      if (ctx.roundRect) ctx.roundRect(curX - tagW / 2, curY - this.tileSize * 0.38 - 14, tagW, tagH, 8);
      else ctx.rect(curX - tagW / 2, curY - this.tileSize * 0.38 - 14, tagW, tagH);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`⚡${gp.score}`, curX, curY - this.tileSize * 0.38 - 6);

      ctx.restore();
    }

    // Theme Badge
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(width - 225, 14, 210, 30);
    ctx.strokeStyle = theme.frameGlow;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(width - 225, 14, 210, 30);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 12px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`🎨 ${theme.name} [T]`, width - 24, 33);
    ctx.restore();

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const list = Array.from(this.gridPlayers.values()).sort((a, b) => b.score - a.score);
    const winnerId = list.length > 0 ? list[0].id : null;
    return {
      winnerId,
      rankings: list.map((gp, idx) => ({ playerId: gp.id, score: gp.score, place: idx + 1 })),
      mvpHighlight:
        winnerId !== null
          ? `${this.players[winnerId].name} harvested ${list[0].score} Reactor Cores on the Laser Grid!`
          : 'Grid scorched everyone!',
    };
  }
}
