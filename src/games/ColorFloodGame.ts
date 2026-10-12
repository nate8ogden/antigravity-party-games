import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface FloodCell {
  col: number;
  row: number;
  x: number;
  y: number;
  colorIdx: number; // 0..5
  owner: PlayerId | null; // Player who owns this cell
  captureAnim: number; // 0..1 scale bounce
  isVoid: boolean;
}

interface PlayerFloodState {
  id: PlayerId;
  currentColor: number;
  selectedColorIdx: number;
  score: number; // cells owned
  territoryCount: number;
  lastActionTime: number;
  botReactionTimer: number;
  streak: number;
}

const PALETTE = [
  { name: 'Crimson', fill: '#EF4444', dark: '#B91C1C' },
  { name: 'Cobalt', fill: '#3B82F6', dark: '#1D4ED8' },
  { name: 'Emerald', fill: '#10B981', dark: '#047857' },
  { name: 'Amber', fill: '#F59E0B', dark: '#D97706' },
  { name: 'Purple', fill: '#8B5CF6', dark: '#6D28D9' },
  { name: 'Cyan', fill: '#06B6D4', dark: '#0E7490' }
];

export class ColorFloodGame extends BaseGame {
  private gridCols = 15;
  private gridRows = 11;
  private grid: FloodCell[][] = [];
  private playerStates: Map<PlayerId, PlayerFloodState> = new Map();
  private totalValidCells = 0;
  private currentMapName: string = 'Jewel Quarry';
  private mapSeed: number = 0;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.roundTimer = 50.0;
    this.isFinished = false;
    this.mapSeed = Math.floor(Math.random() * 10000);

    const mapNames = ['Jewel Quarry', 'Neon Mosaic', 'Prism Archipelago', 'Crystal Caverns'];
    this.currentMapName = mapNames[Math.floor(Math.random() * mapNames.length)];

    this.playerStates.clear();
    const active = this.getActivePlayers();

    // Map starting colors to player indices
    const startingColors = [0, 1, 2, 3]; // Red, Blue, Green, Amber

    active.forEach((p, idx) => {
      const initColor = startingColors[idx % startingColors.length];
      this.playerStates.set(p.id, {
        id: p.id,
        currentColor: initColor,
        selectedColorIdx: (initColor + 1) % PALETTE.length,
        score: 1,
        territoryCount: 1,
        lastActionTime: 0,
        botReactionTimer: 0.2 + Math.random() * 0.2,
        streak: 0
      });
    });

    this.generateMap(width, height);
  }

  private generateMap(width: number, height: number): void {
    this.grid = [];
    this.totalValidCells = 0;

    const cellW = Math.min(width * 0.72 / this.gridCols, height * 0.65 / this.gridRows);
    const startX = (width - this.gridCols * cellW) / 2;
    const startY = (height - this.gridRows * cellW) / 2 + 10;

    for (let c = 0; c < this.gridCols; c++) {
      this.grid[c] = [];
      for (let r = 0; r < this.gridRows; r++) {
        // Leave corners for players
        const isCorner0 = c === 0 && r === 0;
        const isCorner1 = c === this.gridCols - 1 && r === 0;
        const isCorner2 = c === 0 && r === this.gridRows - 1;
        const isCorner3 = c === this.gridCols - 1 && r === this.gridRows - 1;

        // Procedural void / obstacle cells (except around corners)
        let isVoid = false;
        const isNearCorner =
          (c <= 1 && r <= 1) ||
          (c >= this.gridCols - 2 && r <= 1) ||
          (c <= 1 && r >= this.gridRows - 2) ||
          (c >= this.gridCols - 2 && r >= this.gridRows - 2);

        if (!isNearCorner) {
          const noise = Math.sin(c * 1.5 + this.mapSeed) * Math.cos(r * 1.8 + this.mapSeed);
          if (noise > 0.65) {
            isVoid = true;
          }
        }

        let colorIdx = Math.floor(Math.random() * PALETTE.length);

        let owner: PlayerId | null = null;
        if (isCorner0 && this.playerStates.has(0)) {
          owner = 0;
          colorIdx = 0;
        } else if (isCorner1 && this.playerStates.has(1)) {
          owner = 1;
          colorIdx = 1;
        } else if (isCorner2 && this.playerStates.has(2)) {
          owner = 2;
          colorIdx = 2;
        } else if (isCorner3 && this.playerStates.has(3)) {
          owner = 3;
          colorIdx = 3;
        }

        if (!isVoid) this.totalValidCells++;

        this.grid[c][r] = {
          col: c,
          row: r,
          x: startX + c * cellW + cellW / 2,
          y: startY + r * cellW + cellW / 2,
          colorIdx,
          owner,
          captureAnim: owner !== null ? 1 : 0,
          isVoid
        };
      }
    }

    this.recalculateScores();
  }

  private recalculateScores(): void {
    const counts = new Map<PlayerId, number>();
    for (const p of this.getActivePlayers()) {
      counts.set(p.id, 0);
    }

    for (let c = 0; c < this.gridCols; c++) {
      for (let r = 0; r < this.gridRows; r++) {
        const cell = this.grid[c][r];
        if (cell.owner !== null && counts.has(cell.owner)) {
          counts.set(cell.owner, (counts.get(cell.owner) || 0) + 1);
        }
      }
    }

    for (const [pid, count] of counts.entries()) {
      const ps = this.playerStates.get(pid);
      if (ps) {
        ps.score = count;
        ps.territoryCount = count;
      }
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;

    // Handle bot AI
    this.updateBots(dt, width, height);

    // Human controls
    for (const p of this.getActivePlayers()) {
      const ps = this.playerStates.get(p.id);
      if (!ps) continue;

      if (!p.type.startsWith('bot_')) {
        const justPressed = this.input.justPressed(p.id) || this.input.justAction(p.id);
        const steer = this.input.getSteer(p.id);

        if (justPressed) {
          // Commit flood with selected color
          this.executeFlood(ps.id, ps.selectedColorIdx);
        } else if (Math.abs(steer) > 0.5) {
          if (Date.now() - ps.lastActionTime > 200) {
            ps.lastActionTime = Date.now();
            const step = steer > 0 ? 1 : -1;
            ps.selectedColorIdx = (ps.selectedColorIdx + step + PALETTE.length) % PALETTE.length;
            this.audio.playTap();
          }
        }
      }
    }

    // Cell capture animation decay
    for (let c = 0; c < this.gridCols; c++) {
      for (let r = 0; r < this.gridRows; r++) {
        const cell = this.grid[c][r];
        if (cell.captureAnim > 0) {
          cell.captureAnim = Math.max(0, cell.captureAnim - dt * 2.5);
        }
      }
    }

    // Check win condition (>50% of arena or timer 0)
    for (const ps of this.playerStates.values()) {
      if (ps.score >= this.totalValidCells * 0.5) {
        this.isFinished = true;
        this.audio.playFanfare();
        return;
      }
    }

    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private getNextLegalColor(playerId: PlayerId, startIdx: number): number {
    const unavailable = new Set<number>();
    const ps = this.playerStates.get(playerId);
    if (ps) unavailable.add(ps.currentColor);
    for (const other of this.playerStates.values()) {
      if (other.id !== playerId) unavailable.add(other.currentColor);
    }

    for (let i = 0; i < PALETTE.length; i++) {
      const idx = (startIdx + i) % PALETTE.length;
      if (!unavailable.has(idx)) return idx;
    }
    return (startIdx + 1) % PALETTE.length;
  }

  private executeFlood(playerId: PlayerId, targetColorIdx: number): boolean {
    const ps = this.playerStates.get(playerId);
    if (!ps) return false;

    // Disallow picking own current color
    if (targetColorIdx === ps.currentColor) {
      ps.selectedColorIdx = this.getNextLegalColor(playerId, targetColorIdx + 1);
      return false;
    }

    // Disallow picking another player's active current color
    for (const other of this.playerStates.values()) {
      if (other.id !== playerId && other.currentColor === targetColorIdx) {
        ps.selectedColorIdx = this.getNextLegalColor(playerId, targetColorIdx + 1);
        return false;
      }
    }

    ps.currentColor = targetColorIdx;

    // Flood fill from all cells owned by this player
    // 1. Change all currently owned cells to targetColorIdx
    const owned: FloodCell[] = [];
    for (let c = 0; c < this.gridCols; c++) {
      for (let r = 0; r < this.gridRows; r++) {
        const cell = this.grid[c][r];
        if (cell.owner === playerId) {
          cell.colorIdx = targetColorIdx;
          cell.captureAnim = 1.0;
          owned.push(cell);
        }
      }
    }

    // 2. Expand into any adjacent non-void cells that already match targetColorIdx
    let newlyCaptured = 0;
    const queue = [...owned];
    const visited = new Set<string>();
    owned.forEach((c) => visited.add(`${c.col},${c.row}`));

    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const [dc, dr] of dirs) {
        const nc = cur.col + dc;
        const nr = cur.row + dr;
        if (nc >= 0 && nc < this.gridCols && nr >= 0 && nr < this.gridRows) {
          const key = `${nc},${nr}`;
          if (!visited.has(key)) {
            visited.add(key);
            const neighbor = this.grid[nc][nr];
            if (!neighbor.isVoid && (neighbor.owner === null || neighbor.owner !== playerId)) {
              if (neighbor.colorIdx === targetColorIdx) {
                neighbor.owner = playerId;
                neighbor.captureAnim = 1.0;
                newlyCaptured++;
                queue.push(neighbor);

                this.particles.emit(neighbor.x, neighbor.y, 6, PALETTE[targetColorIdx].fill);
              }
            }
          }
        }
      }
    }

    this.recalculateScores();

    if (newlyCaptured > 0) {
      this.audio.playChime();
      ps.streak++;
    } else {
      this.audio.playTap();
      ps.streak = 0;
    }

    // Auto-advance selected color to highest-gain legal color for seamless single-touch play!
    let bestNext = this.getNextLegalColor(playerId, targetColorIdx + 1);
    let bestGain = -1;
    for (let c = 0; c < PALETTE.length; c++) {
      if (c === ps.currentColor) continue;
      let isOpponent = false;
      for (const o of this.playerStates.values()) {
        if (o.id !== playerId && o.currentColor === c) isOpponent = true;
      }
      if (isOpponent) continue;

      const gain = this.simulateGain(playerId, c);
      if (gain > bestGain) {
        bestGain = gain;
        bestNext = c;
      }
    }
    ps.selectedColorIdx = bestNext;
    return true;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const ps = this.playerStates.get(botId);
    if (!ps) return;

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    const baseDelay =
      difficulty === 'bot_easy' ? 0.7 + Math.random() * 0.4 : difficulty === 'bot_normal' ? 0.35 + Math.random() * 0.2 : 0.18 + Math.random() * 0.1;
    ps.botReactionTimer = baseDelay;

    // Evaluate each available color
    const unavailableColors = new Set<number>();
    unavailableColors.add(ps.currentColor);
    for (const other of this.playerStates.values()) {
      if (other.id !== botId) unavailableColors.add(other.currentColor);
    }

    let bestColor = -1;
    let maxGain = -1;

    for (let c = 0; c < PALETTE.length; c++) {
      if (unavailableColors.has(c)) continue;

      const gain = this.simulateGain(botId, c);
      if (gain > maxGain) {
        maxGain = gain;
        bestColor = c;
      }
    }

    if (difficulty === 'bot_easy' && Math.random() < 0.35) {
      // Pick random available color
      const available = Array.from({ length: PALETTE.length }, (_, i) => i).filter(
        (i) => !unavailableColors.has(i)
      );
      if (available.length > 0) {
        bestColor = available[Math.floor(Math.random() * available.length)];
      }
    } else if (maxGain === 0) {
      // When all immediate gains are 0, pick a random legal color to progress
      const available = Array.from({ length: PALETTE.length }, (_, i) => i).filter(
        (i) => !unavailableColors.has(i)
      );
      if (available.length > 0) {
        bestColor = available[Math.floor(Math.random() * available.length)];
      }
    }

    if (bestColor !== -1) {
      this.executeFlood(botId, bestColor);
    }
  }

  private simulateGain(botId: PlayerId, colorIdx: number): number {
    const queue: FloodCell[] = [];
    const visited = new Set<string>();

    for (let c = 0; c < this.gridCols; c++) {
      for (let r = 0; r < this.gridRows; r++) {
        const cell = this.grid[c][r];
        if (cell.owner === botId) {
          queue.push(cell);
          visited.add(`${c},${r}`);
        }
      }
    }

    let gain = 0;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const [dc, dr] of dirs) {
        const nc = cur.col + dc;
        const nr = cur.row + dr;
        if (nc >= 0 && nc < this.gridCols && nr >= 0 && nr < this.gridRows) {
          const key = `${nc},${nr}`;
          if (!visited.has(key)) {
            visited.add(key);
            const neighbor = this.grid[nc][nr];
            if (!neighbor.isVoid && neighbor.owner !== botId && neighbor.colorIdx === colorIdx) {
              gain++;
              queue.push(neighbor); // Traverse full connected component
            }
          }
        }
      }
    }

    return gain;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Dark Board Background
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // 2. Map & Mode Header
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`MAP: ${this.currentMapName.toUpperCase()} • TERRITORY FLOOD DUEL`, width / 2, 28);

    // Timer & Status
    const timerSec = Math.ceil(this.roundTimer);
    ctx.fillStyle = this.roundTimer < 10 ? '#EF4444' : '#F8FAFC';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${timerSec}s`, width / 2, 52);

    // 3. Grid Cells
    const cellW = Math.min((width * 0.72) / this.gridCols, (height * 0.65) / this.gridRows);
    const rad = 4;

    for (let c = 0; c < this.gridCols; c++) {
      for (let r = 0; r < this.gridRows; r++) {
        const cell = this.grid[c][r];
        if (cell.isVoid) {
          // Void block
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(cell.x - cellW / 2 + 2, cell.y - cellW / 2 + 2, cellW - 4, cellW - 4);
          continue;
        }

        const colDef = PALETTE[cell.colorIdx];
        const scale = 1 + cell.captureAnim * 0.2;
        const curW = (cellW - 3) * scale;

        ctx.save();
        ctx.translate(cell.x, cell.y);

        // Cell shadow
        ctx.fillStyle = colDef.dark;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-curW / 2, -curW / 2 + 2, curW, curW, rad);
        else ctx.rect(-curW / 2, -curW / 2 + 2, curW, curW);
        ctx.fill();

        // Main cell face
        ctx.fillStyle = colDef.fill;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-curW / 2, -curW / 2, curW, curW - 2, rad);
        else ctx.rect(-curW / 2, -curW / 2, curW, curW - 2);
        ctx.fill();

        // Owner crest / indicator
        if (cell.owner !== null) {
          const ownerConfig = this.players.find((p) => p.id === cell.owner);
          if (ownerConfig) {
            ctx.fillStyle = ownerConfig.color;
            ctx.beginPath();
            ctx.arc(0, -1, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        ctx.restore();
      }
    }

    // 4. Player Corner Podiums & Color Pickers
    for (const p of this.getActivePlayers()) {
      const ps = this.playerStates.get(p.id);
      if (!ps) continue;

      let px = 20;
      let py = 20;
      let alignRight = false;
      let alignBottom = false;

      if (p.corner === 'top-right') {
        px = width - 180;
        alignRight = true;
      } else if (p.corner === 'bottom-left') {
        py = height - 110;
        alignBottom = true;
      } else if (p.corner === 'bottom-right') {
        px = width - 180;
        py = height - 110;
        alignRight = true;
        alignBottom = true;
      }

      // Container Card
      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, py, 160, 92, 8);
      else ctx.rect(px, py, 160, 92);
      ctx.fill();
      ctx.stroke();

      // Name & Score
      ctx.fillStyle = p.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, px + 10, py + 20);

      const percent = Math.round((ps.score / Math.max(1, this.totalValidCells)) * 100);
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`${ps.score} tiles (${percent}%)`, px + 10, py + 40);

      // Color Palette bar
      const barY = py + 54;
      const swW = 20;
      PALETTE.forEach((pal, i) => {
        const swX = px + 10 + i * (swW + 4);
        const isCurrent = ps.currentColor === i;
        const isSelected = ps.selectedColorIdx === i;

        // Is color locked by opponent?
        let isOpponent = false;
        for (const o of this.playerStates.values()) {
          if (o.id !== p.id && o.currentColor === i) isOpponent = true;
        }

        ctx.fillStyle = isOpponent ? '#475569' : pal.fill;
        ctx.fillRect(swX, barY, swW, swW);

        if (isSelected && !isOpponent) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.strokeRect(swX - 2, barY - 2, swW + 4, swW + 4);
        }

        if (isCurrent) {
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(swX + swW / 2, barY + swW / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Quick tap hint
      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px sans-serif';
      ctx.fillText('Tap: Flood | Steer: Pick', px + 10, py + 88);
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const sorted = [...active].sort((a, b) => {
      const sa = this.playerStates.get(a.id)?.score || 0;
      const sb = this.playerStates.get(b.id)?.score || 0;
      return sb - sa;
    });

    const winnerId = sorted.length > 0 ? sorted[0].id : null;
    const topScore = this.playerStates.get(winnerId ?? 0)?.score || 0;

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      score: this.playerStates.get(p.id)?.score || 0,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: `Dominant expansion! Captured ${topScore} tiles across ${this.currentMapName}!`
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }
}
