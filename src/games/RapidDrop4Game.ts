import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface DropToken {
  col: number;
  row: number;
  ownerId: PlayerId;
  color: string;
  currentY: number;
  targetY: number;
  isFalling: boolean;
  isWinning: boolean;
}

interface PlayerDropper {
  id: PlayerId;
  selectedCol: number;
  dropCooldown: number;
  score: number;
  connectsMade: number;
  lastSteerTime: number;
  sweepTimer: number;
  sweepDir: number;
  botReactionTimer: number;
}

export class RapidDrop4Game extends BaseGame {
  private gridCols = 8;
  private gridRows = 7;
  private cellSize = 42;
  private gridOriginX = 0;
  private gridOriginY = 0;

  // grid[col][row] stores ownerId or null (row 0 is bottom, row rows-1 is top)
  private grid: (PlayerId | null)[][] = [];
  private tokens: DropToken[] = [];
  private playerDroppers: Map<PlayerId, PlayerDropper> = new Map();
  private currentMapName: string = 'Neon Grid Bastion';
  private goldenCol: number = 3;

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

    const maps = ['Neon Grid Bastion', 'Cyber Arcade Matrix', 'Quantum Token Hall', 'Retro Slot Stadium'];
    this.currentMapName = maps[Math.floor(Math.random() * maps.length)];
    this.goldenCol = Math.floor(Math.random() * (this.gridCols - 2)) + 1;

    this.cellSize = Math.floor(Math.min((width * 0.6) / this.gridCols, (height * 0.62) / this.gridRows));
    this.gridOriginX = Math.floor((width - this.gridCols * this.cellSize) / 2);
    this.gridOriginY = Math.floor((height - this.gridRows * this.cellSize) / 2 + 35);

    // Initialize empty grid
    this.grid = [];
    for (let c = 0; c < this.gridCols; c++) {
      this.grid[c] = [];
      for (let r = 0; r < this.gridRows; r++) {
        this.grid[c][r] = null;
      }
    }
    this.tokens = [];

    this.playerDroppers.clear();
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.playerDroppers.set(p.id, {
        id: p.id,
        selectedCol: (idx * 2) % this.gridCols,
        dropCooldown: 0,
        score: 0,
        connectsMade: 0,
        lastSteerTime: 0,
        sweepTimer: 0,
        sweepDir: idx % 2 === 0 ? 1 : -1,
        botReactionTimer: 0.2 + Math.random() * 0.2
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    // Update Token Falling Physics
    for (const t of this.tokens) {
      if (t.isFalling) {
        t.currentY += dt * 680;
        if (t.currentY >= t.targetY) {
          t.currentY = t.targetY;
          t.isFalling = false;
          this.audio.playBounce();

          // Check if this newly settled token triggers a 4-in-a-row
          this.checkWinCondition(t.ownerId);
        }
      }
    }

    // Update Droppers
    for (const d of this.playerDroppers.values()) {
      if (d.dropCooldown > 0) d.dropCooldown -= dt;
    }

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Human controls
    for (const p of this.getActivePlayers()) {
      const d = this.playerDroppers.get(p.id);
      if (!d) continue;

      if (!p.type.startsWith('bot_')) {
        const steer = this.input.getSteer(p.id);
        const wantsDrop = this.input.justAction(p.id) || (this.input.justPressed(p.id) && Math.abs(steer) <= 0.4);

        if (Math.abs(steer) > 0.4) {
          if (Date.now() - d.lastSteerTime > 180) {
            d.lastSteerTime = Date.now();
            const step = steer > 0 ? 1 : -1;
            d.selectedCol = (d.selectedCol + step + this.gridCols) % this.gridCols;
            this.audio.playTap();
          }
        } else if (Date.now() - d.lastSteerTime > 800) {
          // Auto-sweep columns so single-touch mobile players can drop across the whole board
          d.sweepTimer += dt;
          if (d.sweepTimer >= 0.32) {
            d.sweepTimer = 0;
            d.selectedCol += d.sweepDir;
            if (d.selectedCol >= this.gridCols - 1) {
              d.selectedCol = this.gridCols - 1;
              d.sweepDir = -1;
            } else if (d.selectedCol <= 0) {
              d.selectedCol = 0;
              d.sweepDir = 1;
            }
          }
        }

        if (wantsDrop) {
          // If current column is full, advance to nearest open column
          if (this.grid[d.selectedCol][this.gridRows - 1] !== null) {
            for (let offset = 1; offset < this.gridCols; offset++) {
              const right = (d.selectedCol + offset) % this.gridCols;
              const left = (d.selectedCol - offset + this.gridCols) % this.gridCols;
              if (this.grid[right][this.gridRows - 1] === null) {
                d.selectedCol = right;
                break;
              } else if (this.grid[left][this.gridRows - 1] === null) {
                d.selectedCol = left;
                break;
              }
            }
          }
          this.dropToken(d);
        }
      }
    }
  }

  private checkHypothetical4(col: number, ownerId: PlayerId): boolean {
    let openRow = -1;
    for (let r = 0; r < this.gridRows; r++) {
      if (this.grid[col][r] === null) {
        openRow = r;
        break;
      }
    }
    if (openRow === -1) return false;

    this.grid[col][openRow] = ownerId;
    let forms4 = false;

    const dirs = [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1]
    ];

    for (const [dc, dr] of dirs) {
      let count = 1;
      for (let step = 1; step < 4; step++) {
        const nc = col + dc * step;
        const nr = openRow + dr * step;
        if (nc >= 0 && nc < this.gridCols && nr >= 0 && nr < this.gridRows && this.grid[nc][nr] === ownerId) {
          count++;
        } else break;
      }
      for (let step = 1; step < 4; step++) {
        const nc = col - dc * step;
        const nr = openRow - dr * step;
        if (nc >= 0 && nc < this.gridCols && nr >= 0 && nr < this.gridRows && this.grid[nc][nr] === ownerId) {
          count++;
        } else break;
      }
      if (count >= 4) {
        forms4 = true;
        break;
      }
    }

    this.grid[col][openRow] = null;
    return forms4;
  }

  private dropToken(dropper: PlayerDropper): boolean {
    if (dropper.dropCooldown > 0) return false;

    const col = dropper.selectedCol;
    // Find lowest open row in this column
    let openRow = -1;
    for (let r = 0; r < this.gridRows; r++) {
      if (this.grid[col][r] === null) {
        openRow = r;
        break;
      }
    }

    if (openRow === -1) {
      // Column is full!
      return false;
    }

    dropper.dropCooldown = 0.55; // 550ms cooldown
    this.grid[col][openRow] = dropper.id;

    const startY = this.gridOriginY - 30;
    const targetY = this.gridOriginY + (this.gridRows - 1 - openRow) * this.cellSize + this.cellSize / 2;
    const pConfig = this.players.find((p) => p.id === dropper.id);

    this.tokens.push({
      col,
      row: openRow,
      ownerId: dropper.id,
      color: pConfig?.color || '#38BDF8',
      currentY: startY,
      targetY,
      isFalling: true,
      isWinning: false
    });

    this.audio.playTap();
    return true;
  }

  private checkWinCondition(ownerId: PlayerId): void {
    // Check 4-in-a-row for this player
    const dirs = [
      [1, 0], // Horizontal
      [0, 1], // Vertical
      [1, 1], // Diagonal up
      [1, -1] // Diagonal down
    ];

    for (let c = 0; c < this.gridCols; c++) {
      for (let r = 0; r < this.gridRows; r++) {
        if (this.grid[c][r] !== ownerId) continue;

        for (const [dc, dr] of dirs) {
          let count = 1;
          const matchingCells: { c: number; r: number }[] = [{ c, r }];

          for (let step = 1; step < 4; step++) {
            const nc = c + dc * step;
            const nr = r + dr * step;
            if (nc >= 0 && nc < this.gridCols && nr >= 0 && nr < this.gridRows) {
              if (this.grid[nc][nr] === ownerId) {
                count++;
                matchingCells.push({ c: nc, r: nr });
              } else break;
            } else break;
          }

          if (count >= 4) {
            // 4-IN-A-ROW FORMED!
            const dropper = this.playerDroppers.get(ownerId);
            if (dropper) {
              dropper.connectsMade++;
              dropper.score += 150;
            }

            this.audio.playFanfare();

            // Highlight tokens & emit victory particles
            matchingCells.forEach((cell) => {
              const tok = this.tokens.find((t) => t.col === cell.c && t.row === cell.r);
              if (tok) tok.isWinning = true;

              const px = this.gridOriginX + cell.c * this.cellSize + this.cellSize / 2;
              const py = this.gridOriginY + (this.gridRows - 1 - cell.r) * this.cellSize + this.cellSize / 2;

              this.particles.emit(px, py, 12, '#F59E0B');
            });

            this.isFinished = true;
            return;
          }
        }
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const d = this.playerDroppers.get(botId);
    if (!d || d.dropCooldown > 0) return;

    d.botReactionTimer -= dt;
    if (d.botReactionTimer > 0) return;

    const baseDelay =
      difficulty === 'bot_easy' ? 0.38 : difficulty === 'bot_normal' ? 0.22 : 0.08;
    d.botReactionTimer = baseDelay;

    const validCols: number[] = [];
    for (let c = 0; c < this.gridCols; c++) {
      if (this.grid[c][this.gridRows - 1] === null) validCols.push(c);
    }
    if (validCols.length === 0) return;

    let chosenCol = -1;

    // 1. Can bot win on this drop?
    if (difficulty !== 'bot_easy' || Math.random() < 0.65) {
      for (const c of validCols) {
        if (this.checkHypothetical4(c, botId)) {
          chosenCol = c;
          break;
        }
      }
    }

    // 2. Can any opponent win if bot doesn't block?
    if (chosenCol === -1 && (difficulty === 'bot_hard' || (difficulty === 'bot_normal' && Math.random() < 0.8))) {
      for (const p of this.getActivePlayers()) {
        if (p.id === botId) continue;
        for (const c of validCols) {
          if (this.checkHypothetical4(c, p.id)) {
            chosenCol = c;
            break;
          }
        }
        if (chosenCol !== -1) break;
      }
    }

    // 3. Fallback: Favor golden column or center
    if (chosenCol === -1) {
      if (validCols.includes(this.goldenCol) && Math.random() < 0.5) {
        chosenCol = this.goldenCol;
      } else {
        // Sort by distance to center
        const center = (this.gridCols - 1) / 2;
        validCols.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
        const pool = validCols.slice(0, Math.min(3, validCols.length));
        chosenCol = pool[Math.floor(Math.random() * pool.length)];
      }
    }

    d.selectedCol = chosenCol;
    this.dropToken(d);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Dark Neon Arena Floor
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // 2. Header & Timer
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`ARENA: ${this.currentMapName.toUpperCase()} • RAPID DROP 4 DUEL`, width / 2, 28);

    const timerSec = Math.ceil(this.roundTimer);
    ctx.fillStyle = this.roundTimer < 10 ? '#EF4444' : '#F8FAFC';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${timerSec}s`, width / 2, 52);

    // 3. Vertical Grid Frame
    const gridW = this.gridCols * this.cellSize;
    const gridH = this.gridRows * this.cellSize;

    ctx.fillStyle = '#1E293B';
    ctx.fillRect(this.gridOriginX, this.gridOriginY, gridW, gridH);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.strokeRect(this.gridOriginX, this.gridOriginY, gridW, gridH);

    // Column Slots (Empty circles)
    for (let c = 0; c < this.gridCols; c++) {
      for (let r = 0; r < this.gridRows; r++) {
        const cx = this.gridOriginX + c * this.cellSize + this.cellSize / 2;
        const cy = this.gridOriginY + r * this.cellSize + this.cellSize / 2;
        ctx.fillStyle = '#0B0F19';
        ctx.beginPath();
        ctx.arc(cx, cy, this.cellSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Golden Column Highlight
    ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
    ctx.fillRect(
      this.gridOriginX + this.goldenCol * this.cellSize,
      this.gridOriginY,
      this.cellSize,
      gridH
    );

    // 4. Settled & Falling Tokens
    for (const tok of this.tokens) {
      const tokX = this.gridOriginX + tok.col * this.cellSize + this.cellSize / 2;
      const tokY = tok.currentY;

      ctx.fillStyle = tok.isWinning ? '#F59E0B' : tok.color;
      ctx.beginPath();
      ctx.arc(tokX, tokY, this.cellSize * 0.38, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = tok.isWinning ? 3 : 1.5;
      ctx.stroke();
    }

    // 5. Dropper Selectors above Grid
    for (const p of this.getActivePlayers()) {
      const d = this.playerDroppers.get(p.id);
      if (!d) continue;

      const selX = this.gridOriginX + d.selectedCol * this.cellSize + this.cellSize / 2;
      const selY = this.gridOriginY - 14;

      // Downward pointer arrow
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(selX, selY + 8);
      ctx.lineTo(selX - 9, selY - 10);
      ctx.lineTo(selX + 9, selY - 10);
      ctx.closePath();
      ctx.fill();
    }

    // 6. Corner HUDs
    for (const p of this.getActivePlayers()) {
      const d = this.playerDroppers.get(p.id);
      if (!d) continue;

      let px = 20;
      let py = 20;
      if (p.corner === 'top-right') px = width - 160;
      else if (p.corner === 'bottom-left') py = height - 90;
      else if (p.corner === 'bottom-right') {
        px = width - 160;
        py = height - 90;
      }

      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, py, 140, 70, 8);
      else ctx.rect(px, py, 140, 70);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, px + 10, py + 20);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`${d.score} pts`, px + 10, py + 42);

      ctx.fillStyle = d.connectsMade > 0 ? '#10B981' : '#94A3B8';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(d.connectsMade > 0 ? '4-IN-A-ROW! 🏆' : 'Connecting...', px + 10, py + 60);
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const sorted = [...active].sort((a, b) => {
      const sa = this.playerDroppers.get(a.id)?.score || 0;
      const sb = this.playerDroppers.get(b.id)?.score || 0;
      return sb - sa;
    });

    const winnerId = sorted.length > 0 ? sorted[0].id : null;
    const topScore = this.playerDroppers.get(winnerId ?? 0)?.score || 0;

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      score: this.playerDroppers.get(p.id)?.score || 0,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: `Strategic genius! Connected 4 in a row scoring ${topScore} pts on ${this.currentMapName}!`
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }
}
