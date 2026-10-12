import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface PaintRover {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  tileCount: number;
  turboTimer: number;
}

interface PaintTile {
  col: number;
  row: number;
  x: number;
  y: number;
  ownerId: PlayerId | null;
  splashAnim: number;
}

interface PaintBomb {
  x: number;
  y: number;
  active: boolean;
  respawnTimer: number;
  nextX?: number;
  nextY?: number;
}

export class ColorClashGame extends BaseGame {
  private rovers: Map<PlayerId, PaintRover> = new Map();
  private tiles: PaintTile[][] = [];
  private cols: number = 14;
  private rows: number = 9;
  private tileW: number = 50;
  private tileH: number = 50;
  private gridOriginX: number = 50;
  private gridOriginY: number = 60;
  private paintBombs: PaintBomb[] = [];
  private totalTiles: number = 126;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35;
    this.isFinished = false;
    this.rovers.clear();
    this.tiles = [];
    this.paintBombs = [];

    // Calculate grid dimensions centered
    const marginX = 50;
    const marginY = 65;
    const availableW = width - marginX * 2;
    const availableH = height - marginY * 2;

    this.cols = 14;
    this.rows = 9;
    this.totalTiles = this.cols * this.rows;
    this.tileW = availableW / this.cols;
    this.tileH = availableH / this.rows;
    this.gridOriginX = marginX;
    this.gridOriginY = marginY;

    // Initialize blank neutral grid
    for (let r = 0; r < this.rows; r++) {
      const rowArr: PaintTile[] = [];
      for (let c = 0; c < this.cols; c++) {
        rowArr.push({
          col: c,
          row: r,
          x: this.gridOriginX + c * this.tileW,
          y: this.gridOriginY + r * this.tileH,
          ownerId: null,
          splashAnim: 0
        });
      }
      this.tiles.push(rowArr);
    }

    // Spawn player rovers in distinct corners
    const active = this.getActivePlayers();
    const spawnPoints = [
      { col: 1, row: 1, angle: Math.PI / 4 },
      { col: this.cols - 2, row: this.rows - 2, angle: -Math.PI * 0.75 },
      { col: 1, row: this.rows - 2, angle: -Math.PI / 4 },
      { col: this.cols - 2, row: 1, angle: Math.PI * 0.75 }
    ];

    active.forEach((p, idx) => {
      const sp = spawnPoints[idx % spawnPoints.length];
      const rx = this.gridOriginX + (sp.col + 0.5) * this.tileW;
      const ry = this.gridOriginY + (sp.row + 0.5) * this.tileH;

      this.rovers.set(p.id, {
        id: p.id,
        x: rx,
        y: ry,
        vx: 0,
        vy: 0,
        angle: sp.angle,
        speed: 195,
        tileCount: 0,
        turboTimer: 0
      });

      // Paint starting tile
      this.paintTile(sp.col, sp.row, p.id);
    });

    // Spawn 2 paint bomb canisters at distinct, randomized arena locations
    this.paintBombs = [];
    const b1Pos = this.getRandomBombPosition();
    this.paintBombs.push({
      x: b1Pos.x,
      y: b1Pos.y,
      active: true,
      respawnTimer: 0
    });
    const b2Pos = this.getRandomBombPosition(0);
    this.paintBombs.push({
      x: b2Pos.x,
      y: b2Pos.y,
      active: true,
      respawnTimer: 0
    });

    // Expose debug hook for testing
    (window as any).__COLOR_CLASH_DEBUG__ = {
      getBombs: () => this.paintBombs.map((b) => ({
        x: b.x,
        y: b.y,
        active: b.active,
        respawnTimer: b.respawnTimer,
        nextX: b.nextX,
        nextY: b.nextY
      })),
      getRovers: () => Array.from(this.rovers.values()).map((r) => ({
        id: r.id,
        x: r.x,
        y: r.y,
        turboTimer: r.turboTimer,
        tileCount: r.tileCount
      })),
      triggerPickup: (bombIndex: number, roverId: PlayerId) => {
        const b = this.paintBombs[bombIndex];
        const r = this.rovers.get(roverId);
        if (b && r) {
          r.x = b.x;
          r.y = b.y;
        }
      },
      getRandomBombPosition: (excludeIndex?: number) => this.getRandomBombPosition(excludeIndex)
    };
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Update tile splash animations
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const t = this.tiles[r][c];
        if (t.splashAnim > 0) {
          t.splashAnim = Math.max(0, t.splashAnim - dt * 4);
        }
      }
    }

    // Update paint bombs
    for (let i = 0; i < this.paintBombs.length; i++) {
      const b = this.paintBombs[i];
      if (!b.active) {
        b.respawnTimer -= dt;
        if (b.respawnTimer <= 0) {
          b.active = true;
          if (b.nextX !== undefined && b.nextY !== undefined) {
            b.x = b.nextX;
            b.y = b.nextY;
          } else {
            const nextPos = this.getRandomBombPosition(i);
            b.x = nextPos.x;
            b.y = nextPos.y;
          }
          b.nextX = undefined;
          b.nextY = undefined;
          this.particles.spawnSparks(b.x, b.y, '#F59E0B', 16);
          this.particles.showFloatingText('BOMB LANDED! 💣', b.x, b.y - 20, '#F59E0B', 18);
          this.audio.playTap();
        }
      }
    }

    // Process Player Rovers
    for (const rover of this.rovers.values()) {
      if (rover.turboTimer > 0) {
        rover.turboTimer -= dt;
      }

      const steer = this.input.getSteer(rover.id);
      const throttle = this.input.getThrottle(rover.id);
      const isPressed = this.input.isActionPressed(rover.id) || (this.input.isPressed(rover.id) && steer === 0 && throttle === 0);

      const curSpeed = rover.turboTimer > 0 ? rover.speed * 1.5 : rover.speed;
      const inputY = -throttle;

      if (steer !== 0 || throttle !== 0) {
        // Direct directional steering with WASD / Arrow keys
        const targetAngle = Math.atan2(inputY, steer);
        // Smooth turn towards target direction
        rover.angle = targetAngle;
        rover.vx += (Math.cos(rover.angle) * curSpeed - rover.vx) * dt * 9;
        rover.vy += (Math.sin(rover.angle) * curSpeed - rover.vy) * dt * 9;
      } else if (isPressed) {
        // 1-button auto drive forward
        rover.vx += (Math.cos(rover.angle) * curSpeed - rover.vx) * dt * 8;
        rover.vy += (Math.sin(rover.angle) * curSpeed - rover.vy) * dt * 8;
      } else {
        // Idle clockwise slow turn so 1-button players can re-orient
        rover.angle += dt * 3.2;
        rover.vx *= Math.pow(0.85, dt * 60);
        rover.vy *= Math.pow(0.85, dt * 60);
      }

      rover.x += rover.vx * dt;
      rover.y += rover.vy * dt;

      // Arena bounds clamp
      const minX = this.gridOriginX + 16;
      const maxX = this.gridOriginX + this.cols * this.tileW - 16;
      const minY = this.gridOriginY + 16;
      const maxY = this.gridOriginY + this.rows * this.tileH - 16;

      rover.x = Math.max(minX, Math.min(maxX, rover.x));
      rover.y = Math.max(minY, Math.min(maxY, rover.y));

      // Paint current occupied tile
      const col = Math.floor((rover.x - this.gridOriginX) / this.tileW);
      const row = Math.floor((rover.y - this.gridOriginY) / this.tileH);
      if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
        this.paintTile(col, row, rover.id);
      }

      // Check Paint Bomb pickup
      for (let i = 0; i < this.paintBombs.length; i++) {
        const b = this.paintBombs[i];
        if (b.active && Math.hypot(rover.x - b.x, rover.y - b.y) < 26) {
          b.active = false;
          b.respawnTimer = 4.5 + Math.random() * 2.0;
          const nextPos = this.getRandomBombPosition(i);
          b.nextX = nextPos.x;
          b.nextY = nextPos.y;
          rover.turboTimer = 3.5;
          const pColor = this.getPlayer(rover.id)?.color || '#38BDF8';
          this.audio.playExplosion();
          this.particles.addTrauma(0.25);
          this.particles.spawnExplosion(b.x, b.y, pColor, 35);
          this.particles.showFloatingText('PAINT BURST! 💣', b.x, b.y - 20, pColor, 24);

          // Explode 3x3 tiles surrounding the bomb into this player's color
          const bombCol = Math.floor((b.x - this.gridOriginX) / this.tileW);
          const bombRow = Math.floor((b.y - this.gridOriginY) / this.tileH);
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const tc = bombCol + dc;
              const tr = bombRow + dr;
              if (tc >= 0 && tc < this.cols && tr >= 0 && tr < this.rows) {
                this.paintTile(tc, tr, rover.id);
              }
            }
          }
        }
      }

      // Paint trail particles
      const roverColor = this.getPlayer(rover.id)?.color || '#38BDF8';
      if (Math.random() < 0.3 && Math.hypot(rover.vx, rover.vy) > 40) {
        this.particles.spawnSparks(rover.x, rover.y, roverColor, 1);
      }
    }

    // Recalculate tile ownership counts
    const counts = new Map<PlayerId, number>();
    for (const p of this.getActivePlayers()) counts.set(p.id, 0);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const owner = this.tiles[r][c].ownerId;
        if (owner !== null && counts.has(owner)) {
          counts.set(owner, (counts.get(owner) || 0) + 1);
        }
      }
    }

    for (const [pid, cnt] of counts.entries()) {
      const rov = this.rovers.get(pid);
      if (rov) rov.tileCount = cnt;
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private getRandomBombPosition(excludeIndex?: number): { x: number; y: number } {
    let bestCandidate = {
      x: this.gridOriginX + (Math.floor(this.cols / 2) + 0.5) * this.tileW,
      y: this.gridOriginY + (Math.floor(this.rows / 2) + 0.5) * this.tileH
    };
    let bestScore = -Infinity;

    // Available tile column and row bounds (avoid outer-most borders for better gameplay)
    const minCol = 1;
    const maxCol = this.cols - 2;
    const minRow = 1;
    const maxRow = this.rows - 2;

    for (let attempt = 0; attempt < 35; attempt++) {
      const col = minCol + Math.floor(Math.random() * (maxCol - minCol + 1));
      const row = minRow + Math.floor(Math.random() * (maxRow - minRow + 1));
      const candX = this.gridOriginX + (col + 0.5) * this.tileW;
      const candY = this.gridOriginY + (row + 0.5) * this.tileH;

      // Distance to other paint bombs (active or scheduled landing target)
      let minOtherBombDist = Infinity;
      for (let i = 0; i < this.paintBombs.length; i++) {
        if (excludeIndex !== undefined && i === excludeIndex) continue;
        const other = this.paintBombs[i];
        const ox = other.active ? other.x : (other.nextX ?? other.x);
        const oy = other.active ? other.y : (other.nextY ?? other.y);
        const d = Math.hypot(candX - ox, candY - oy);
        if (d < minOtherBombDist) minOtherBombDist = d;
      }

      // Distance to all rovers
      let minRoverDist = Infinity;
      for (const rov of this.rovers.values()) {
        const d = Math.hypot(candX - rov.x, candY - rov.y);
        if (d < minRoverDist) minRoverDist = d;
      }

      // Ideal requirements: at least 3.2 tiles away from other bomb, at least 75px from any rover
      const bombSeparationOk = minOtherBombDist >= this.tileW * 3.2;
      const roverClearanceOk = minRoverDist >= 75;

      if (bombSeparationOk && roverClearanceOk) {
        return { x: candX, y: candY };
      }

      // Weighted score prioritizing separation
      const score = Math.min(minOtherBombDist, 250) + Math.min(minRoverDist, 180);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = { x: candX, y: candY };
      }
    }

    return bestCandidate;
  }

  private paintTile(col: number, row: number, pid: PlayerId): void {
    const t = this.tiles[row][col];
    if (t.ownerId !== pid) {
      t.ownerId = pid;
      t.splashAnim = 1.0;
      this.audio.playTap();
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const rover = this.rovers.get(botId);
    if (!rover) return;

    // 1. Look for active Paint Bombs first (or incoming reticles)
    let targetX = width / 2;
    let targetY = height / 2;
    let foundBomb = false;

    for (const b of this.paintBombs) {
      if (b.active) {
        targetX = b.x;
        targetY = b.y;
        foundBomb = true;
        break;
      } else if (b.respawnTimer <= 1.0 && b.nextX !== undefined && b.nextY !== undefined && difficulty !== 'bot_easy') {
        targetX = b.nextX;
        targetY = b.nextY;
        foundBomb = true;
        break;
      }
    }

    // 2. If no bomb, find nearest unpainted or opponent tile
    if (!foundBomb) {
      let bestDist = Infinity;
      const myCol = Math.floor((rover.x - this.gridOriginX) / this.tileW);
      const myRow = Math.floor((rover.y - this.gridOriginY) / this.tileH);

      // Search radiating outwards
      const radius = difficulty === 'bot_hard' ? 5 : difficulty === 'bot_normal' ? 3 : 2;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const tc = myCol + dc;
          const tr = myRow + dr;
          if (tc >= 0 && tc < this.cols && tr >= 0 && tr < this.rows) {
            const tile = this.tiles[tr][tc];
            if (tile.ownerId !== botId) {
              const d = Math.hypot(tile.x - rover.x, tile.y - rover.y);
              if (d < bestDist) {
                bestDist = d;
                targetX = tile.x + this.tileW / 2;
                targetY = tile.y + this.tileH / 2;
              }
            }
          }
        }
      }
    }

    const dx = targetX - rover.x;
    const dy = targetY - rover.y;
    const mag = Math.hypot(dx, dy) || 1;

    let steerX = dx / mag;
    let steerY = dy / mag;

    // Inaccuracy / blunder for easy bots
    if (difficulty === 'bot_easy') {
      steerX += (Math.random() - 0.5) * 0.8;
      steerY += (Math.random() - 0.5) * 0.8;
    }

    const finalMag = Math.hypot(steerX, steerY) || 1;
    // Pass -steerY because throttle > 0 is Up (-Y)
    this.input.setBotInput(botId, true, steerX / finalMag, -steerY / finalMag, false);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = Array.from(this.rovers.values()).sort((a, b) => b.tileCount - a.tileCount);
    const winnerId = sorted.length > 0 && sorted[0].tileCount > 0 ? sorted[0].id : null;
    const winnerName = winnerId !== null ? (this.getPlayer(winnerId)?.name || 'Player') : '';

    return {
      winnerId,
      rankings: sorted.map((r, idx) => ({
        playerId: r.id,
        score: r.tileCount,
        place: idx + 1
      })),
      mvpHighlight: winnerId !== null ? `${winnerName} PAINTED THE ARENA (${sorted[0].tileCount} TILES)!` : 'DRAW! ARENA UNCLAIMED!'
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Sleek Dark Canvas Floor
    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(0, 0, width, height);

    // 2. Render Paint Tiles Grid
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const t = this.tiles[r][c];
        const tx = t.x + 1.5;
        const ty = t.y + 1.5;
        const tw = this.tileW - 3;
        const th = this.tileH - 3;

        if (t.ownerId !== null) {
          const pColor = this.getPlayer(t.ownerId)?.color || '#38BDF8';
          ctx.save();
          ctx.fillStyle = pColor;
          ctx.globalAlpha = 0.85 + t.splashAnim * 0.15;
          ctx.fillRect(tx, ty, tw, th);

          // Tile beveled gloss
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.fillRect(tx, ty, tw, 4);
          ctx.restore();
        } else {
          // Neutral unpainted dark grid tile
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(tx, ty, tw, th);
        }
      }
    }

    // 3. Render Paint Bomb Pickups & Incoming Telegraphs
    for (const b of this.paintBombs) {
      if (!b.active) {
        if (b.respawnTimer <= 1.2 && b.nextX !== undefined && b.nextY !== undefined) {
          // Render incoming bomb drop reticle
          ctx.save();
          const p = 1.0 - (b.respawnTimer / 1.2);
          const ringRadius = 13 + (1 - p) * 22;
          ctx.strokeStyle = `rgba(245, 158, 11, ${0.4 + p * 0.6})`;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(b.nextX, b.nextY, ringRadius, 0, Math.PI * 2);
          ctx.stroke();

          // Reticle crosshair
          ctx.strokeStyle = '#FACC15';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);
          const crossSize = 6;
          ctx.beginPath();
          ctx.moveTo(b.nextX - crossSize, b.nextY);
          ctx.lineTo(b.nextX + crossSize, b.nextY);
          ctx.moveTo(b.nextX, b.nextY - crossSize);
          ctx.lineTo(b.nextX + crossSize, b.nextY);
          ctx.stroke();

          // Small shadow beneath landing zone
          ctx.fillStyle = `rgba(0, 0, 0, ${0.2 + p * 0.3})`;
          ctx.beginPath();
          ctx.ellipse(b.nextX, b.nextY + 12, 10 * p, 5 * p, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        continue;
      }

      ctx.save();
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 15;

      // Golden Bomb Sphere
      const bombGrad = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, 14);
      bombGrad.addColorStop(0, '#FEF08A');
      bombGrad.addColorStop(0.6, '#F59E0B');
      bombGrad.addColorStop(1, '#B45309');
      ctx.fillStyle = bombGrad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 13, 0, Math.PI * 2);
      ctx.fill();

      // Bomb fuse & spark
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y - 12, 6, 0, Math.PI);
      ctx.stroke();

      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(b.x + 6, b.y - 15, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Render Paint Rovers
    for (const rover of this.rovers.values()) {
      const pColor = this.getPlayer(rover.id)?.color || '#38BDF8';

      ctx.save();
      ctx.translate(rover.x, rover.y);
      ctx.rotate(rover.angle);

      // Rover Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(2, 3, 16, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rover Body
      ctx.shadowColor = rover.turboTimer > 0 ? '#FACC15' : pColor;
      ctx.shadowBlur = rover.turboTimer > 0 ? 16 : 8;
      ctx.fillStyle = pColor;
      ctx.beginPath();
      ctx.roundRect(-14, -10, 28, 20, 5);
      ctx.fill();

      // Front Paint Roller Barrel
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(10, -11, 7, 22, 3);
      ctx.fill();

      // Rear Wheels
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-12, -13, 6, 4);
      ctx.fillRect(-12, 9, 6, 4);

      ctx.restore();

      // Percentage / Count Badge floating above rover
      const pct = Math.round((rover.tileCount / this.totalTiles) * 100);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${pct}%`, rover.x, rover.y - 20);
    }

    // 5. Top Center Live Territory Ownership Bar
    const barW = Math.min(420, width * 0.6);
    const barH = 14;
    const barX = width / 2 - barW / 2;
    const barY = 24;

    ctx.save();
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 7);
    ctx.fill();

    let curOffset = barX;
    for (const rover of this.rovers.values()) {
      const pColor = this.players[rover.id]?.color || '#38BDF8';
      const segmentW = (rover.tileCount / this.totalTiles) * barW;
      if (segmentW > 0) {
        ctx.fillStyle = pColor;
        ctx.fillRect(curOffset, barY, segmentW, barH);
        curOffset += segmentW;
      }
    }
    ctx.restore();

    ctx.restore();
  }
}
