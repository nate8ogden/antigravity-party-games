import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Dancer {
  x: number;
  y: number;
  dir: number; // 0: Right, 1: Down, 2: Left, 3: Up
  alive: boolean;
  lives: number;
  score: number;
  falling: number; // 0 to 1 anim
}

const TILE_COLORS = [
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F59E0B', // Amber
  '#10B981'  // Mint
];

const TILE_NAMES = ['PINK', 'CYAN', 'AMBER', 'MINT'];

export class DiscoTileGame extends BaseGame {
  private dancers: Map<PlayerId, Dancer> = new Map();
  private grid: number[][] = []; // 4x4
  private targetColor: number = 0;
  private phase: 'dance' | 'warning' | 'drop' | 'reset' = 'dance';
  private phaseTimer: number = 2.5;
  private dropCount: number = 0;
  private maxDrops: number = 5;
  private readonly GRID_SIZE = 4;
  private floorBounds = { x: 0, y: 0, size: 0, tileSize: 0 };
  private beatPulse: number = 0;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.dancers.clear();
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.dropCount = 0;
    this.phase = 'dance';
    this.phaseTimer = 2.5;
    this.beatPulse = 0;

    const floorSize = Math.min(width, height) * 0.7;
    const startX = (width - floorSize) / 2;
    const startY = (height - floorSize) / 2 + 20;
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
      { gx: 0.5, gy: 0.5, dir: 0 },
      { gx: 3.5, gy: 0.5, dir: 1 },
      { gx: 0.5, gy: 3.5, dir: 3 },
      { gx: 3.5, gy: 3.5, dir: 2 }
    ];

    active.forEach((p, idx) => {
      const sp = spawnOffsets[idx % spawnOffsets.length];
      this.dancers.set(p.id, {
        x: this.floorBounds.x + sp.gx * this.floorBounds.tileSize,
        y: this.floorBounds.y + sp.gy * this.floorBounds.tileSize,
        dir: sp.dir,
        alive: true,
        lives: 2,
        score: 0,
        falling: 0
      });
    });
  }

  private regenerateGrid(): void {
    this.grid = [];
    const pool: number[] = [];
    for (let c = 0; c < 4; c++) {
      for (let k = 0; k < 4; k++) {
        pool.push(c);
      }
    }
    // Shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    let ptr = 0;
    for (let r = 0; r < this.GRID_SIZE; r++) {
      const row: number[] = [];
      for (let c = 0; c < this.GRID_SIZE; c++) {
        row.push(pool[ptr++]);
      }
      this.grid.push(row);
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    this.beatPulse += dt * 3.5;

    // Floor bounds update if resized
    const floorSize = Math.min(width, height) * 0.7;
    this.floorBounds.size = floorSize;
    this.floorBounds.x = (width - floorSize) / 2;
    this.floorBounds.y = (height - floorSize) / 2 + 20;
    this.floorBounds.tileSize = floorSize / this.GRID_SIZE;

    this.updateBots(dt, width, height);

    // Player inputs & movement
    const DIRS = [
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: -1 }
    ];
    const speed = 130;

    for (const p of this.getActivePlayers()) {
      const d = this.dancers.get(p.id);
      if (!d || !d.alive) continue;

      if (this.input.justPressed(p.id)) {
        d.dir = (d.dir + 1) % 4;
        this.audio.playTone(300 + d.dir * 60, 0.05, 'triangle');
      }

      if (d.falling > 0) {
        d.falling += dt * 2.5;
        continue;
      }

      const move = DIRS[d.dir];
      d.x += move.dx * speed * dt;
      d.y += move.dy * speed * dt;

      // Clamp inside floor
      const minX = this.floorBounds.x + 12;
      const maxX = this.floorBounds.x + this.floorBounds.size - 12;
      const minY = this.floorBounds.y + 12;
      const maxY = this.floorBounds.y + this.floorBounds.size - 12;

      if (d.x < minX) { d.x = minX; d.dir = (d.dir + 1) % 4; }
      if (d.x > maxX) { d.x = maxX; d.dir = (d.dir + 1) % 4; }
      if (d.y < minY) { d.y = minY; d.dir = (d.dir + 1) % 4; }
      if (d.y > maxY) { d.y = maxY; d.dir = (d.dir + 1) % 4; }
    }

    // Phase management
    this.phaseTimer -= dt;
    if (this.phaseTimer <= 0) {
      if (this.phase === 'dance') {
        this.phase = 'warning';
        this.phaseTimer = 0.8;
        this.audio.playCountdown(false);
      } else if (this.phase === 'warning') {
        this.phase = 'drop';
        this.phaseTimer = 1.2;
        this.audio.playExplosion();
        this.evaluateSurvival();
      } else if (this.phase === 'drop') {
        this.dropCount++;
        if (this.dropCount >= this.maxDrops || this.getAliveCount() <= 1) {
          this.isFinished = true;
          return;
        }
        this.phase = 'reset';
        this.phaseTimer = 0.5;
      } else if (this.phase === 'reset') {
        this.phase = 'dance';
        this.phaseTimer = 2.5;
        this.regenerateGrid();
        this.targetColor = Math.floor(Math.random() * 4);
        this.audio.playScore();
      }
    }

    if (this.roundTimer <= 0 || this.getAliveCount() <= (this.getActivePlayers().length > 1 ? 1 : 0)) {
      this.isFinished = true;
    }
  }

  private evaluateSurvival(): void {
    for (const p of this.getActivePlayers()) {
      const d = this.dancers.get(p.id);
      if (!d || !d.alive) continue;

      const col = Math.floor((d.x - this.floorBounds.x) / this.floorBounds.tileSize);
      const row = Math.floor((d.y - this.floorBounds.y) / this.floorBounds.tileSize);

      const isValid = row >= 0 && row < this.GRID_SIZE && col >= 0 && col < this.GRID_SIZE;
      const tileColor = isValid ? this.grid[row][col] : -1;

      if (tileColor === this.targetColor) {
        d.score += 100;
        this.particles.emit(d.x, d.y, 10, TILE_COLORS[this.targetColor]);
      } else {
        d.lives--;
        d.falling = 0.01;
        this.audio.playTone(150, 0.2, 'sawtooth');
        this.particles.emit(d.x, d.y, 15, '#EF4444');
        if (d.lives <= 0) {
          d.alive = false;
        }
      }
    }
  }

  private getAliveCount(): number {
    let count = 0;
    for (const d of this.dancers.values()) {
      if (d.alive) count++;
    }
    return count;
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _w: number, _h: number): void {
    const d = this.dancers.get(botId);
    if (!d || !d.alive || d.falling > 0) {
      this.input.setBotInput(botId, false);
      return;
    }

    if (difficulty === 'bot_easy') {
      if (Math.random() < 0.03) {
        this.input.setBotInput(botId, true);
      } else {
        this.input.setBotInput(botId, false);
      }
      return;
    }

    // Find nearest target tile center
    let bestDist = Infinity;
    let targetX = d.x;
    let targetY = d.y;

    for (let r = 0; r < this.GRID_SIZE; r++) {
      for (let c = 0; c < this.GRID_SIZE; c++) {
        if (this.grid[r][c] === this.targetColor) {
          const cx = this.floorBounds.x + (c + 0.5) * this.floorBounds.tileSize;
          const cy = this.floorBounds.y + (r + 0.5) * this.floorBounds.tileSize;
          const dist = Math.hypot(cx - d.x, cy - d.y);
          if (dist < bestDist) {
            bestDist = dist;
            targetX = cx;
            targetY = cy;
          }
        }
      }
    }

    // Determine required direction
    const dx = targetX - d.x;
    const dy = targetY - d.y;
    let desiredDir = d.dir;
    if (Math.abs(dx) > Math.abs(dy)) {
      desiredDir = dx > 0 ? 0 : 2;
    } else {
      desiredDir = dy > 0 ? 1 : 3;
    }

    const turnChance = difficulty === 'bot_hard' ? 0.35 : 0.18;
    if (d.dir !== desiredDir && Math.random() < turnChance) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Dark club dance floor background
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // Neon floor grid
    const { x: fx, y: fy, size, tileSize } = this.floorBounds;

    // Floor shadow/glow
    ctx.save();
    ctx.shadowColor = TILE_COLORS[this.targetColor];
    ctx.shadowBlur = this.phase === 'warning' ? 30 : 15;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.strokeRect(fx - 4, fy - 4, size + 8, size + 8);
    ctx.restore();

    for (let r = 0; r < this.GRID_SIZE; r++) {
      for (let c = 0; c < this.GRID_SIZE; c++) {
        const colorIdx = this.grid[r] ? this.grid[r][c] : 0;
        const tx = fx + c * tileSize;
        const ty = fy + r * tileSize;

        // If in drop phase and tile is not target color, drop it (draw dark pit)
        if (this.phase === 'drop' && colorIdx !== this.targetColor) {
          ctx.fillStyle = '#020617';
          ctx.fillRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);
          ctx.strokeStyle = '#1E293B';
          ctx.lineWidth = 2;
          ctx.strokeRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);
          continue;
        }

        const isTarget = colorIdx === this.targetColor;
        let color = TILE_COLORS[colorIdx];

        ctx.fillStyle = color;
        ctx.fillRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);

        // Pattern on tile
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(tx + 8, ty + 8, tileSize - 16, tileSize - 16);

        if (this.phase === 'warning' && isTarget) {
          const pulse = (Math.sin(this.beatPulse * 6) + 1) * 0.5;
          ctx.fillStyle = `rgba(255,255,255,${0.3 * pulse})`;
          ctx.fillRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);
        }
      }
    }

    // Draw Dancers
    for (const p of this.getActivePlayers()) {
      const d = this.dancers.get(p.id);
      if (!d || !d.alive) continue;

      ctx.save();
      ctx.translate(d.x, d.y);

      if (d.falling > 0) {
        const s = Math.max(0, 1 - d.falling);
        ctx.scale(s, s);
        ctx.rotate(d.falling * 8);
      }

      // Player circle
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Heading arrow
      const angles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
      ctx.rotate(angles[d.dir]);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(4, -6);
      ctx.lineTo(4, 6);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // Top Banner: SAFE TILE TARGET
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(width / 2 - 140, 10, 280, 48);
    ctx.strokeStyle = TILE_COLORS[this.targetColor];
    ctx.lineWidth = 3;
    ctx.strokeRect(width / 2 - 140, 10, 280, 48);

    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'center';
    ctx.fillText('STAND ON COLOR:', width / 2 - 40, 30);

    // Color pill
    ctx.fillStyle = TILE_COLORS[this.targetColor];
    ctx.beginPath();
    ctx.roundRect(width / 2 + 40, 18, 80, 30, 6);
    ctx.fill();

    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(TILE_NAMES[this.targetColor], width / 2 + 80, 38);

    // Phase warning label
    if (this.phase === 'warning') {
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('DROP IMMINENT!', width / 2, fy + size + 35);
    }
    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => {
        const d = this.dancers.get(p.id);
        const score = (d ? d.score + (d.alive ? 500 : 0) : 0);
        return {
          playerId: p.id,
          score,
          place: 1
        };
      })
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} dominated the disco floor!` : 'The party ends!'
    };
  }
}
