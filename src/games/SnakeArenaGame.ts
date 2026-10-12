import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

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
  isAlive: boolean;
  score: number;
  pelletsEaten: number;
  moveTimer: number;
  botReactionTimer: number;
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
  private currentMapName: string = 'Neon Colosseum';
  private pelletCounter = 0;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.roundTimer = 55.0;
    this.isFinished = false;

    const mapNames = ['Neon Colosseum', 'Pillar Citadel', 'Cross Bastion', 'Labyrinth Vault'];
    this.currentMapName = mapNames[Math.floor(Math.random() * mapNames.length)];

    this.cellSize = Math.floor(Math.min((width * 0.8) / this.gridCols, (height * 0.72) / this.gridRows));
    this.offsetX = Math.floor((width - this.gridCols * this.cellSize) / 2);
    this.offsetY = Math.floor((height - this.gridRows * this.cellSize) / 2 + 15);

    this.generateObstacles();
    this.spawnSnakes();
    this.pellets = [];
    for (let i = 0; i < 8; i++) {
      this.spawnPellet(false);
    }
  }

  private generateObstacles(): void {
    this.obstacles = [];

    if (this.currentMapName === 'Pillar Citadel') {
      const px = [8, 23];
      const py = [6, 15];
      for (const x of px) {
        for (const y of py) {
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              this.obstacles.push({ x: x + dx, y: y + dy });
            }
          }
        }
      }
    } else if (this.currentMapName === 'Cross Bastion') {
      const midX = Math.floor(this.gridCols / 2);
      const midY = Math.floor(this.gridRows / 2);
      for (let i = -3; i <= 3; i++) {
        if (i !== 0) {
          this.obstacles.push({ x: midX + i, y: midY });
          this.obstacles.push({ x: midX, y: midY + i });
        }
      }
    } else if (this.currentMapName === 'Labyrinth Vault') {
      for (let c = 6; c < this.gridCols - 6; c += 4) {
        for (let r = 4; r < this.gridRows - 4; r++) {
          if (r % 4 !== 0) {
            this.obstacles.push({ x: c, y: r });
          }
        }
      }
    }
  }

  private spawnSnakes(): void {
    this.snakes.clear();
    const active = this.getActivePlayers();

    const spawnPositions: { x: number; y: number; dx: number; dy: number }[] = [
      { x: 3, y: 3, dx: 1, dy: 0 },
      { x: this.gridCols - 4, y: 3, dx: 0, dy: 1 },
      { x: 3, y: this.gridRows - 4, dx: 0, dy: -1 },
      { x: this.gridCols - 4, y: this.gridRows - 4, dx: -1, dy: 0 }
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
        speed: 8.5, // steps per second
        isAlive: true,
        score: 0,
        pelletsEaten: 0,
        moveTimer: 0,
        botReactionTimer: 0.15 + Math.random() * 0.1
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

    this.roundTimer -= dt;
    this.updateStagnationWatchdog(dt);
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    // Sudden Death Urgency: draw snakes toward center with high-value golden food
    if (this.roundTimer <= 15 && !this.suddenDeathActive) {
      this.suddenDeathActive = true;
      this.spawnPellet(true);
      this.spawnPellet(true);
      this.particles.showFloatingText('⚠️ SUDDEN DEATH! SUPER PELLETS!', width / 2, 70, '#F59E0B', 22);
    }

    // Spawn golden super pellet occasionally
    if (Math.random() < dt * 0.25 && this.pellets.filter((p) => p.isGolden).length < 3) {
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

      if (!p.type.startsWith('bot_')) {
        const steer = this.input.getSteer(p.id);
        const throttle = this.input.getThrottle(p.id);
        const justPressed = this.input.justPressed(p.id) || this.input.justAction(p.id);

        if (Math.abs(steer) > 0.5) {
          if (steer > 0 && s.dirX === 0) {
            s.nextDirX = 1;
            s.nextDirY = 0;
            this.audio.playTap();
          } else if (steer < 0 && s.dirX === 0) {
            s.nextDirX = -1;
            s.nextDirY = 0;
            this.audio.playTap();
          }
        } else if (Math.abs(throttle) > 0.5) {
          if (throttle > 0 && s.dirY === 0) {
            s.nextDirX = 0;
            s.nextDirY = -1; // up
            this.audio.playTap();
          } else if (throttle < 0 && s.dirY === 0) {
            s.nextDirX = 0;
            s.nextDirY = 1; // down
            this.audio.playTap();
          }
        } else if (justPressed) {
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
      const stepDuration = 1 / s.speed;

      if (s.moveTimer >= stepDuration) {
        s.moveTimer -= stepDuration;

        // Apply direction change
        s.dirX = s.nextDirX;
        s.dirY = s.nextDirY;

        const head = s.body[0];
        const nextX = head.x + s.dirX;
        const nextY = head.y + s.dirY;

        // 1. Check arena boundary collision
        if (nextX < 0 || nextX >= this.gridCols || nextY < 0 || nextY >= this.gridRows) {
          this.killSnake(s);
          continue;
        }

        // 2. Check obstacle collision
        if (this.obstacles.some((o) => o.x === nextX && o.y === nextY)) {
          this.killSnake(s);
          continue;
        }

        // 3. Check self collision
        if (s.body.slice(1).some((b) => b.x === nextX && b.y === nextY)) {
          this.killSnake(s);
          continue;
        }

        // 4. Check opponent snake body collision
        let crashed = false;
        for (const other of this.snakes.values()) {
          if (!other.isAlive) continue;
          if (other.body.some((b) => b.x === nextX && b.y === nextY)) {
            this.killSnake(s);
            // Award points to opponent for defensive block
            if (other.id !== s.id) {
              other.score += 50;
            }
            crashed = true;
            break;
          }
        }
        if (crashed) continue;

        // Move head forward
        s.body.unshift({ x: nextX, y: nextY });

        // Check pellet eating
        const pelletIdx = this.pellets.findIndex((p) => p.x === nextX && p.y === nextY);
        if (pelletIdx !== -1) {
          const eaten = this.pellets.splice(pelletIdx, 1)[0];
          s.pelletsEaten++;
          s.score += eaten.isGolden ? 30 : 10;
          s.speed = Math.min(13.0, s.speed + 0.12);

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
        alive[0].score += 100; // Survival bonus
      }
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private killSnake(s: SnakeState): void {
    s.isAlive = false;
    this.audio.playLaser();

    // Turn segments into food pellets
    s.body.forEach((seg, idx) => {
      if (idx % 2 === 0 && this.pellets.length < 25) {
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
      difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.12 : 0.05;
    s.botReactionTimer = baseDelay;

    const head = s.body[0];

    // Directions: Forward, Clockwise, Counter-Clockwise
    const options = [
      { dx: s.dirX, dy: s.dirY },
      { dx: -s.dirY, dy: s.dirX },
      { dx: s.dirY, dy: -s.dirX }
    ];

    // Score each option
    let bestOption = options[0];
    let bestScore = -99999;

    // Find closest pellet
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

      // 1. Wall collision
      if (nextX < 0 || nextX >= this.gridCols || nextY < 0 || nextY >= this.gridRows) {
        continue;
      }

      // 2. Obstacle collision
      if (this.obstacles.some((o) => o.x === nextX && o.y === nextY)) {
        continue;
      }

      // 3. Body collision
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

      // Check open reachability to avoid dead-end traps!
      const freeSpace = this.getFreeSpaceCount(nextX, nextY, 16);
      if (freeSpace < 6) {
        score -= (6 - freeSpace) * 35;
      } else {
        score += freeSpace * 3;
      }

      // Distance to target pellet
      if (targetPellet) {
        const d = Math.abs(nextX - targetPellet.x) + Math.abs(nextY - targetPellet.y);
        score -= d * 5;
      }

      // Avoid walls if possible
      const distToBorder = Math.min(nextX, this.gridCols - 1 - nextX, nextY, this.gridRows - 1 - nextY);
      score += distToBorder * 2;

      // Random jitter on easy
      if (difficulty === 'bot_easy') {
        score += (Math.random() - 0.5) * 50;
      }

      if (score > bestScore) {
        bestScore = score;
        bestOption = opt;
      }
    }

    s.nextDirX = bestOption.dx;
    s.nextDirY = bestOption.dy;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Dark Neon Arena Floor
    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(0, 0, width, height);

    // Arena Perimeter Bounds
    const arenaW = this.gridCols * this.cellSize;
    const arenaH = this.gridRows * this.cellSize;

    ctx.fillStyle = '#111827';
    ctx.fillRect(this.offsetX, this.offsetY, arenaW, arenaH);

    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.strokeRect(this.offsetX, this.offsetY, arenaW, arenaH);

    // Subtle grid dots
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    for (let c = 1; c < this.gridCols; c++) {
      for (let r = 1; r < this.gridRows; r++) {
        ctx.fillRect(this.offsetX + c * this.cellSize - 1, this.offsetY + r * this.cellSize - 1, 2, 2);
      }
    }

    // 2. Obstacles
    ctx.fillStyle = '#475569';
    for (const o of this.obstacles) {
      const ox = this.offsetX + o.x * this.cellSize;
      const oy = this.offsetY + o.y * this.cellSize;
      ctx.fillRect(ox + 2, oy + 2, this.cellSize - 4, this.cellSize - 4);
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ox + 2, oy + 2, this.cellSize - 4, this.cellSize - 4);
    }

    // 3. Pellets
    for (const p of this.pellets) {
      const px = this.offsetX + p.x * this.cellSize + this.cellSize / 2;
      const py = this.offsetY + p.y * this.cellSize + this.cellSize / 2;
      const rad = (this.cellSize * 0.32) * (1 + Math.sin(p.pulseTimer) * 0.2);

      ctx.fillStyle = p.isGolden ? '#F59E0B' : '#10B981';
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 4. Snakes
    for (const p of this.getActivePlayers()) {
      const s = this.snakes.get(p.id);
      if (!s || !s.isAlive) continue;

      s.body.forEach((seg, idx) => {
        const sx = this.offsetX + seg.x * this.cellSize + this.cellSize / 2;
        const sy = this.offsetY + seg.y * this.cellSize + this.cellSize / 2;
        const rad = idx === 0 ? this.cellSize * 0.44 : this.cellSize * 0.38;

        ctx.fillStyle = idx === 0 ? p.color : p.colorDark;
        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
        ctx.fill();

        // Eyes on head
        if (idx === 0) {
          ctx.fillStyle = '#FFFFFF';
          const eyeOffset = 3;
          ctx.beginPath();
          ctx.arc(sx + s.dirY * eyeOffset, sy - s.dirX * eyeOffset, 2, 0, Math.PI * 2);
          ctx.arc(sx - s.dirY * eyeOffset, sy + s.dirX * eyeOffset, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // 5. Header & Timer
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`ARENA: ${this.currentMapName.toUpperCase()} • 4-PLAYER SNAKE DUEL`, width / 2, 28);

    const timerSec = Math.ceil(this.roundTimer);
    ctx.fillStyle = this.roundTimer < 10 ? '#EF4444' : '#F8FAFC';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${timerSec}s`, width / 2, 52);

    // 6. Corner HUDs
    for (const p of this.getActivePlayers()) {
      const s = this.snakes.get(p.id);
      if (!s) continue;

      let px = 20;
      let py = 20;
      if (p.corner === 'top-right') px = width - 160;
      else if (p.corner === 'bottom-left') py = height - 90;
      else if (p.corner === 'bottom-right') {
        px = width - 160;
        py = height - 90;
      }

      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeStyle = s.isAlive ? p.color : '#64748B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, py, 140, 70, 8);
      else ctx.rect(px, py, 140, 70);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = s.isAlive ? p.color : '#94A3B8';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, px + 10, py + 20);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`${s.score} pts`, px + 10, py + 42);

      ctx.fillStyle = s.isAlive ? '#10B981' : '#EF4444';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(s.isAlive ? `Len: ${s.body.length}` : 'CRASHED ✖', px + 10, py + 60);
    }
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
      mvpHighlight: `Apex predator! Dominated ${this.currentMapName} with ${topScore} pts and supreme arena control!`
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }
}
