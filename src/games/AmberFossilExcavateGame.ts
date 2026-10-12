import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface FossilBlock {
  type: 'AMBER' | 'TRILOBITE' | 'STONE';
  health: number;
  revealed: boolean;
  points: number;
}

interface ExcavatorState {
  id: PlayerId;
  cursorRow: number;
  cursorCol: number;
  grid: FossilBlock[][];
  sweepTimer: number;
  cooldown: number;
  score: number;
}

export class AmberFossilExcavateGame extends BaseGame {
  private playersState: Map<PlayerId, ExcavatorState> = new Map();

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

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 30;
    this.playersState.clear();

    const active = this.getActivePlayers();
    active.forEach((p) => {
      this.playersState.set(p.id, {
        id: p.id,
        cursorRow: 0,
        cursorCol: 0,
        grid: this.generateDigGrid(),
        sweepTimer: 0,
        cooldown: 0,
        score: 0
      });
    });
  }

  private generateDigGrid(): FossilBlock[][] {
    const grid: FossilBlock[][] = [];
    for (let r = 0; r < 4; r++) {
      const row: FossilBlock[] = [];
      for (let c = 0; c < 4; c++) {
        const rand = Math.random();
        if (rand < 0.3) {
          row.push({ type: 'AMBER', health: 2, revealed: false, points: 30 });
        } else if (rand < 0.45) {
          row.push({ type: 'TRILOBITE', health: 3, revealed: false, points: 50 });
        } else {
          row.push({ type: 'STONE', health: 1, revealed: false, points: 10 });
        }
      }
      grid.push(row);
    }
    return grid;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.cooldown > 0) {
        ps.cooldown -= dt;
      }

      // Automatically move cursor across grid row by col
      ps.sweepTimer += dt;
      if (ps.sweepTimer > 0.32) {
        ps.sweepTimer = 0;
        ps.cursorCol++;
        if (ps.cursorCol >= 4) {
          ps.cursorCol = 0;
          ps.cursorRow = (ps.cursorRow + 1) % 4;
        }
      }

      // Tap to Chisel!
      const tap = this.input.justPressed(p.id);
      if (tap && ps.cooldown <= 0) {
        const blk = ps.grid[ps.cursorRow][ps.cursorCol];
        if (!blk.revealed) {
          blk.health--;
          this.audio.playTap();

          if (blk.health <= 0) {
            blk.revealed = true;
            ps.score += blk.points;
            if (blk.type === 'AMBER' || blk.type === 'TRILOBITE') {
              this.audio.playScore();
              this.particles.showFloatingText(`+${blk.points} FOSSIL!`, width / 2, height / 2, '#FBBF24', 22);
            }
          }
        }

        // Check if all valuable fossils revealed
        const remainingValuables = ps.grid.flat().filter((b) => !b.revealed && b.type !== 'STONE');
        if (remainingValuables.length === 0) {
          ps.score += 60; // Clean slab bonus
          this.audio.playFanfare();
          this.particles.showFloatingText('SLAB CLEARED! +60', width / 2, height / 2, '#10B981', 24);
          this.particles.spawnConfetti(width / 2, height / 2, 16);
          ps.grid = this.generateDigGrid();
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Sedimentary Shale Quarry Dig Site
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1C1917');
    bgGrad.addColorStop(0.5, '#292524');
    bgGrad.addColorStop(1, '#0C0A09');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Player Excavation Slabs
    const active = this.getActivePlayers();
    const count = active.length;
    const zoneW = width / count;

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      if (!ps) return;
      const zoneCenterX = zoneW * idx + zoneW / 2;
      const slabY = height * 0.52;
      const slabSize = Math.min(zoneW * 0.85, height * 0.65);
      const cellSize = slabSize / 4;
      const startX = zoneCenterX - slabSize / 2;
      const startY = slabY - slabSize / 2;

      // Heavy Stone Slab Frame
      ctx.fillStyle = '#44403C';
      ctx.fillRect(startX - 6, startY - 6, slabSize + 12, slabSize + 12);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(startX - 6, startY - 6, slabSize + 12, slabSize + 12);

      // 4x4 Grid Cells
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const blk = ps.grid[r][c];
          const cx = startX + c * cellSize;
          const cy = startY + r * cellSize;
          const isCursor = r === ps.cursorRow && c === ps.cursorCol;

          ctx.save();
          if (blk.revealed) {
            // Revealed fossil bed
            ctx.fillStyle = '#1C1917';
            ctx.fillRect(cx + 2, cy + 2, cellSize - 4, cellSize - 4);

            if (blk.type === 'AMBER') {
              // Glowing Golden Amber Gem
              ctx.fillStyle = '#F59E0B';
              ctx.shadowColor = '#FBBF24';
              ctx.shadowBlur = 10;
              ctx.beginPath();
              ctx.ellipse(cx + cellSize / 2, cy + cellSize / 2, cellSize * 0.32, cellSize * 0.38, 0.2, 0, Math.PI * 2);
              ctx.fill();
              ctx.shadowBlur = 0;
            } else if (blk.type === 'TRILOBITE') {
              // Ancient Trilobite Carapace
              ctx.fillStyle = '#38BDF8';
              ctx.beginPath();
              ctx.arc(cx + cellSize / 2, cy + cellSize / 2, cellSize * 0.3, 0, Math.PI * 2);
              ctx.fill();
            } else {
              // Rubble
              ctx.fillStyle = '#78716C';
              ctx.fillRect(cx + cellSize * 0.3, cy + cellSize * 0.3, cellSize * 0.4, cellSize * 0.4);
            }
          } else {
            // Unexcavated Rock Layer
            ctx.fillStyle = blk.health === 3 ? '#57534E' : blk.health === 2 ? '#78716C' : '#A8A29E';
            ctx.fillRect(cx + 2, cy + 2, cellSize - 4, cellSize - 4);
            ctx.strokeStyle = '#292524';
            ctx.lineWidth = 1;
            ctx.strokeRect(cx + 2, cy + 2, cellSize - 4, cellSize - 4);

            // Crack lines if damaged
            if (blk.health < (blk.type === 'TRILOBITE' ? 3 : blk.type === 'AMBER' ? 2 : 1)) {
              ctx.strokeStyle = '#000000';
              ctx.beginPath();
              ctx.moveTo(cx + 6, cy + 6);
              ctx.lineTo(cx + cellSize - 6, cy + cellSize - 6);
              ctx.stroke();
            }
          }

          // Chisel Reticle Cursor
          if (isCursor) {
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 3;
            ctx.strokeRect(cx + 1, cy + 1, cellSize - 2, cellSize - 2);

            // Pickaxe symbol in cursor
            ctx.fillStyle = '#FEF08A';
            ctx.beginPath();
            ctx.arc(cx + cellSize / 2, cy + cellSize / 2, 4, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      // Player Score Tag
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, zoneCenterX, startY - 14);
    });

    // 3. Header HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.cooldown > 0) return;

    const blk = ps.grid[ps.cursorRow][ps.cursorCol];
    if (!blk.revealed) {
      const chance = difficulty === 'bot_hard' ? 0.95 : difficulty === 'bot_normal' ? 0.75 : 0.5;
      if (Math.random() < chance) {
        this.input.setBotInput(botId, true, 0, 0, true);
      } else {
        this.input.setBotInput(botId, false, 0, 0, false);
      }
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public getScore(playerId: PlayerId): number {
    return this.playersState.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} unearthed ancient amber fossils like a master paleontologist!` : 'Tied fossil excavation!'
    };
  }
}
