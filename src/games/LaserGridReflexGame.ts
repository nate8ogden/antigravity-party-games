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
}

interface TileState {
  warningTime: number; // >0 means warning flashing
  laserTime: number;   // >0 means active lethal beam
  hasBattery: boolean;
}

export class LaserGridReflexGame extends BaseGame {
  private readonly gridSize = 5;
  private tiles: TileState[][] = [];
  private gridPlayers: Map<PlayerId, GridPlayer> = new Map();
  private patternTimer: number = 2.5;
  private laserSpeedMultiplier: number = 1.0;
  private batterySpawnTimer: number = 3.5;
  private targetBatteriesToWin: number = 10;
  private tileSize: number = 64;
  private gridOriginX: number = 0;
  private gridOriginY: number = 0;
  private botMoveTimers: Map<PlayerId, number> = new Map();

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 60;
    this.isFinished = false;
    this.patternTimer = 2.0;
    this.laserSpeedMultiplier = 1.0;
    this.batterySpawnTimer = 3.0;

    this.tileSize = Math.min(104, Math.floor((Math.min(width, height) - 96) / this.gridSize));
    this.gridOriginX = Math.floor((width - this.gridSize * this.tileSize) / 2);
    this.gridOriginY = Math.floor((height - this.gridSize * this.tileSize) / 2);

    this.tiles = [];
    for (let y = 0; y < this.gridSize; y++) {
      const row: TileState[] = [];
      for (let x = 0; x < this.gridSize; x++) {
        row.push({ warningTime: 0, laserTime: 0, hasBattery: false });
      }
      this.tiles.push(row);
    }

    // Spawn players in 4 corners of the 5x5 grid
    const cornerCoords = [
      { gx: 0, gy: 0, dir: 0 }, // P1: Top-Left
      { gx: 4, gy: 0, dir: 1 }, // P2: Top-Right
      { gx: 0, gy: 4, dir: 3 }, // P3: Bottom-Left
      { gx: 4, gy: 4, dir: 2 }  // P4: Bottom-Right
    ];

    this.gridPlayers.clear();
    const active = this.getActivePlayers();
    active.forEach((p) => {
      const c = cornerCoords[p.id];
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
        reverse: false
      });
    });

    // Spawn initial battery in center
    this.tiles[2][2].hasBattery = true;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.laserSpeedMultiplier += dt * 0.015; // Gradually accelerate lasers!
    this.updateBots(dt, width, height);

    // Update Tiles (warning & active lasers)
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const t = this.tiles[y][x];
        if (t.warningTime > 0) {
          t.warningTime -= dt * this.laserSpeedMultiplier;
          if (t.warningTime <= 0) {
            t.laserTime = 0.6; // Lethal beam active
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
      this.patternTimer = Math.max(1.1, 2.2 - (60 - this.roundTimer) * 0.02);
      this.triggerLaserPattern();
    }

    // Battery spawning
    this.batterySpawnTimer -= dt;
    if (this.batterySpawnTimer <= 0) {
      this.batterySpawnTimer = 4.0;
      this.spawnBattery();
    }

    // Move directions: 0: Right, 1: Down, 2: Left, 3: Up
    const deltas = [
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: -1 }
    ];

    // Process Player Inputs and Movements
    for (const gp of this.gridPlayers.values()) {
      if (!gp.alive) continue;

      const isPressed = this.input.isPressed(gp.id);
      const justPressed = this.input.justPressed(gp.id);

      const steer = this.input.getSteer(gp.id);
      const throttle = this.input.getThrottle(gp.id);

      // Direct 4-way hopping with WASD or Arrow Keys
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
        }
      }

      // Smooth step interpolation
      if (gp.moveProgress < 1) {
        gp.moveProgress = Math.min(1, gp.moveProgress + dt * 10);
        if (gp.moveProgress >= 1) {
          gp.gx = gp.targetGx;
          gp.gy = gp.targetGy;

          // Check battery pickup
          if (this.tiles[gp.gy][gp.gx].hasBattery) {
            this.tiles[gp.gy][gp.gx].hasBattery = false;
            gp.score++;
            this.audio.playScore();
            const px = this.gridOriginX + (gp.gx + 0.5) * this.tileSize;
            const py = this.gridOriginY + (gp.gy + 0.5) * this.tileSize;
            this.particles.showFloatingText('+1 BATTERY!', px, py - 20, '#F59E0B');
            this.particles.spawnSparks(px, py, '#F59E0B', 15);

            if (gp.score >= this.targetBatteriesToWin) {
              this.isFinished = true;
            }
          }
        }
      }

      // Check lethal laser collision
      const curTile = this.tiles[gp.gy][gp.gx];
      if (curTile.laserTime > 0.1) {
        gp.alive = false;
        this.audio.playExplosion();
        const px = this.gridOriginX + (gp.gx + 0.5) * this.tileSize;
        const py = this.gridOriginY + (gp.gy + 0.5) * this.tileSize;
        this.particles.spawnExplosion(px, py, this.players[gp.id].color, 30);
        this.particles.showFloatingText('ZAPPED!', px, py, '#EF4444', 24);
      }
    }

    // Win condition check
    const aliveCount = Array.from(this.gridPlayers.values()).filter((p) => p.alive).length;
    if (aliveCount <= 1 || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private triggerLaserPattern() {
    const patternType = Math.floor(Math.random() * 4);
    if (patternType === 0) {
      // Cross pattern (random row + col)
      const r = Math.floor(Math.random() * this.gridSize);
      const c = Math.floor(Math.random() * this.gridSize);
      for (let i = 0; i < this.gridSize; i++) {
        this.tiles[r][i].warningTime = 0.9;
        this.tiles[i][c].warningTime = 0.9;
      }
    } else if (patternType === 1) {
      // Checkerboard half
      const offset = Math.random() > 0.5 ? 0 : 1;
      for (let y = 0; y < this.gridSize; y++) {
        for (let x = 0; x < this.gridSize; x++) {
          if ((x + y) % 2 === offset) {
            this.tiles[y][x].warningTime = 1.0;
          }
        }
      }
    } else if (patternType === 2) {
      // Perimeter sweep
      for (let i = 0; i < this.gridSize; i++) {
        this.tiles[0][i].warningTime = 0.9;
        this.tiles[this.gridSize - 1][i].warningTime = 0.9;
        this.tiles[i][0].warningTime = 0.9;
        this.tiles[i][this.gridSize - 1].warningTime = 0.9;
      }
    } else {
      // 2 Random rows or cols
      const r1 = Math.floor(Math.random() * this.gridSize);
      const r2 = (r1 + 2) % this.gridSize;
      for (let i = 0; i < this.gridSize; i++) {
        this.tiles[r1][i].warningTime = 0.9;
        this.tiles[r2][i].warningTime = 0.9;
      }
    }
  }

  private spawnBattery() {
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
    }
  }

  private botDangerTimers: Map<PlayerId, number> = new Map();

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const gp = this.gridPlayers.get(botId);
    if (!gp || !gp.alive || gp.moveProgress < 1) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    const curTile = this.tiles[gp.gy][gp.gx];
    const isDangerous = curTile.warningTime > 0 || curTile.laserTime > 0;

    // Track danger exposure time for realistic human reaction delay
    let dangerTime = this.botDangerTimers.get(botId) || 0;
    if (isDangerous) {
      dangerTime += dt;
      this.botDangerTimers.set(botId, dangerTime);
    } else {
      dangerTime = 0;
      this.botDangerTimers.set(botId, 0);
    }

    // Reaction latency to laser warning (human players take 250-350ms to react)
    const dangerReactionRequired = difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.28 : 0.48;
    if (isDangerous && dangerTime < dangerReactionRequired) {
      // Human perceptual delay: still processing the flashing warning
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // Normal movement cadence (when not in immediate mortal danger)
    const moveCadence = difficulty === 'bot_hard' ? 0.16 : difficulty === 'bot_normal' ? 0.38 : 0.62;
    let timer = this.botMoveTimers.get(botId) || 0;
    timer += dt;
    this.botMoveTimers.set(botId, timer);

    if (!isDangerous && timer < moveCadence) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // On normal/easy, occasional hesitation / pause
    if (!isDangerous && difficulty === 'bot_normal' && Math.random() < 0.18) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }
    if (!isDangerous && difficulty === 'bot_easy' && Math.random() < 0.35) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // Find nearest battery
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

    // Evaluate 4 neighbors:
    const deltas = [
      { dir: 0, dx: 1, dy: 0, steer: 1, throttle: 0 },
      { dir: 1, dx: 0, dy: 1, steer: 0, throttle: -1 },
      { dir: 2, dx: -1, dy: 0, steer: -1, throttle: 0 },
      { dir: 3, dx: 0, dy: -1, steer: 0, throttle: 1 }
    ];

    let bestScore = -Infinity;
    let bestDelta: typeof deltas[0] | null = null;

    // Shuffle candidate order to avoid predictable clockwise bias on ties
    const shuffledDeltas = [...deltas].sort(() => Math.random() - 0.5);

    for (const d of shuffledDeltas) {
      const nx = gp.gx + d.dx;
      const ny = gp.gy + d.dy;
      if (nx < 0 || nx >= this.gridSize || ny < 0 || ny >= this.gridSize) continue;

      const neighborTile = this.tiles[ny][nx];
      let score = 0;

      // Heavy penalties for laser hazards
      if (neighborTile.laserTime > 0) score -= 100000;
      else if (neighborTile.warningTime > 0) score -= 50000;
      else score += 100;

      // Reward batteries
      if (neighborTile.hasBattery) score += 2000;

      // Proximity to target battery
      if (targetBattery) {
        const dist = Math.abs(nx - targetBattery.x) + Math.abs(ny - targetBattery.y);
        score -= dist * 25;
      }

      // Add human-like imperfection on normal and easy
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

    // Dark cyberpunk background with subtle grid ambiance
    ctx.fillStyle = '#070A13';
    ctx.fillRect(0, 0, width, height);

    const totalGridSize = this.gridSize * this.tileSize;

    // Outer Arena Containment Frame with Neon Glow
    ctx.save();
    ctx.shadowColor = '#0EA5E9';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 3;
    ctx.strokeRect(this.gridOriginX - 8, this.gridOriginY - 8, totalGridSize + 16, totalGridSize + 16);
    ctx.restore();

    // Corner Energy Pylons
    const pylonSize = 14;
    const corners = [
      { x: this.gridOriginX - 12, y: this.gridOriginY - 12 },
      { x: this.gridOriginX + totalGridSize - 2, y: this.gridOriginY - 12 },
      { x: this.gridOriginX - 12, y: this.gridOriginY + totalGridSize - 2 },
      { x: this.gridOriginX + totalGridSize - 2, y: this.gridOriginY + totalGridSize - 2 }
    ];
    for (const c of corners) {
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(c.x, c.y, pylonSize, pylonSize);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(c.x + 3, c.y + 3, pylonSize - 6, pylonSize - 6);
    }

    // Floor Grid Tiles
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const px = this.gridOriginX + x * this.tileSize;
        const py = this.gridOriginY + y * this.tileSize;
        const t = this.tiles[y][x];

        // Base tile fill
        if (t.laserTime > 0) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.90)';
        } else if (t.warningTime > 0) {
          const isFlash = Math.sin(t.warningTime * 24) > 0;
          ctx.fillStyle = isFlash ? 'rgba(239, 68, 68, 0.55)' : 'rgba(245, 158, 11, 0.35)';
        } else {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#131D31' : '#0B1324';
        }

        ctx.fillRect(px + 2, py + 2, this.tileSize - 4, this.tileSize - 4);

        // Warning Hazard diagonal pattern
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

        // Tile border & inner circuit bevel
        ctx.strokeStyle = t.laserTime > 0 ? '#EF4444' : t.warningTime > 0 ? '#F59E0B' : '#1E293B';
        ctx.lineWidth = t.laserTime > 0 ? 3 : 1;
        ctx.strokeRect(px + 2, py + 2, this.tileSize - 4, this.tileSize - 4);

        // Overcharge Energy Battery
        if (t.hasBattery && t.laserTime <= 0) {
          const cx = px + this.tileSize / 2;
          const cy = py + this.tileSize / 2;
          const pulse = Math.sin(performance.now() * 0.008) * 4;

          // Ambient Battery Glow
          ctx.save();
          ctx.shadowColor = '#F59E0B';
          ctx.shadowBlur = 18;
          ctx.fillStyle = '#FBBF24';
          ctx.beginPath();
          ctx.arc(cx, cy, 14 + pulse, 0, Math.PI * 2);
          ctx.fill();

          // Hexagonal Power Core
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          for (let pt = 0; pt < 6; pt++) {
            const a = (pt * Math.PI) / 3;
            const hx = cx + Math.cos(a) * 8;
            const hy = cy + Math.sin(a) * 8;
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

      // Interpolate position
      const curX = this.gridOriginX + (gp.gx + (gp.targetGx - gp.gx) * gp.moveProgress + 0.5) * this.tileSize;
      const curY = this.gridOriginY + (gp.gy + (gp.targetGy - gp.gy) * gp.moveProgress + 0.5) * this.tileSize;

      ctx.save();
      // Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(curX, curY + this.tileSize * 0.28, this.tileSize * 0.28, this.tileSize * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Check if tile has active warning
      const currentTile = this.tiles[gp.gx]?.[gp.gy];
      const isDanger = currentTile && currentTile.warningTime > 0;
      const mood = isDanger ? 'shocked' : (gp.moveProgress < 1 ? 'focused' : 'idle');

      // Draw Mascot character
      this.drawPlayerMascot(ctx, gp.id, curX, curY, this.tileSize * 0.32, mood, now);

      // Score Pill Tag above head
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      const tagW = 42;
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
      ctx.fillText(`${gp.score}`, curX, curY - this.tileSize * 0.38 - 6);

      ctx.restore();
    }

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const list = Array.from(this.gridPlayers.values()).sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.alive && !b.alive) return -1;
      if (!a.alive && b.alive) return 1;
      return 0;
    });

    const winnerId = list.length > 0 ? list[0].id : null;
    return {
      winnerId,
      rankings: list.map((gp, idx) => ({ playerId: gp.id, score: gp.score * 2 + (gp.alive ? 3 : 0), place: idx + 1 })),
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} gathered ${list[0].score} batteries while dodging laser grids!` : 'Grid scorched everyone!'
    };
  }
}
