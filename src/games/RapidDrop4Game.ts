import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type DropThemeId = 'neon' | 'arcade' | 'cosmic';

interface DropTheme {
  id: DropThemeId;
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  boardBg: string;
  boardBorder: string;
  slotColor: string;
  goldenColBg: string;
  accentColor: string;
}

const THEMES: Record<DropThemeId, DropTheme> = {
  neon: {
    id: 'neon',
    name: 'Neon Grid Bastion',
    icon: '⚡',
    bgGradTop: '#0F172A',
    bgGradBottom: '#020617',
    boardBg: '#1E293B',
    boardBorder: '#38BDF8',
    slotColor: '#0B0F19',
    goldenColBg: 'rgba(245, 158, 11, 0.22)',
    accentColor: '#38BDF8'
  },
  arcade: {
    id: 'arcade',
    name: 'Mahogany Arcade',
    icon: '🕹️',
    bgGradTop: '#291804',
    bgGradBottom: '#100A02',
    boardBg: '#451A03',
    boardBorder: '#F59E0B',
    slotColor: '#1C0D02',
    goldenColBg: 'rgba(251, 191, 36, 0.25)',
    accentColor: '#F59E0B'
  },
  cosmic: {
    id: 'cosmic',
    name: 'Cosmic Nebula',
    icon: '🌌',
    bgGradTop: '#1E1B4B',
    bgGradBottom: '#0F0E26',
    boardBg: '#2E1065',
    boardBorder: '#A855F7',
    slotColor: '#110726',
    goldenColBg: 'rgba(216, 180, 254, 0.25)',
    accentColor: '#C084FC'
  }
};

interface DropToken {
  col: number;
  row: number;
  ownerId: PlayerId;
  color: string;
  currentY: number;
  targetY: number;
  isFalling: boolean;
  isWinning: boolean;
  isBomb: boolean;
  alpha: number;
}

interface PlayerDropper {
  id: PlayerId;
  selectedCol: number;
  railX: number;
  vx: number;
  dropCooldown: number;
  chargeTime: number;
  isCharging: boolean;
  score: number;
  connectsMade: number;
  lastSteerTime: number;
  mood: CharacterMood;
  moodTimer: number;
  botReactionTimer: number;
}

export class RapidDrop4Game extends BaseGame {
  private currentThemeId: DropThemeId = 'neon';
  private gridCols = 8;
  private gridRows = 7;
  private cellSize = 42;
  private gridOriginX = 0;
  private gridOriginY = 0;

  // grid[col][row] stores ownerId or null (row 0 is bottom, row rows-1 is top)
  private grid: (PlayerId | null)[][] = [];
  private tokens: DropToken[] = [];
  private playerDroppers: Map<PlayerId, PlayerDropper> = new Map();
  private goldenCol: number = 3;
  private goldenTimer: number = 7.0;

  private animTimer: number = 0;
  private screenShake: number = 0;
  private freezeFrames: number = 0;
  private suddenDeathTriggered: boolean = false;

  private onKeyDownBound: (e: KeyboardEvent) => void;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.onKeyDownBound = this.handleKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDownBound);
  }

  public init(width: number, height: number): void {
    this.roundTimer = 55.0;
    this.isFinished = false;
    this.animTimer = 0;
    this.screenShake = 0;
    this.freezeFrames = 0;
    this.suddenDeathTriggered = false;
    this.goldenTimer = 6.0;

    const themeKeys: DropThemeId[] = ['neon', 'arcade', 'cosmic'];
    this.currentThemeId = themeKeys[Math.floor(Math.random() * themeKeys.length)];

    this.cellSize = Math.floor(
      Math.min((width * 0.58) / this.gridCols, (height * 0.58) / this.gridRows)
    );
    this.gridOriginX = Math.floor((width - this.gridCols * this.cellSize) / 2);
    this.gridOriginY = Math.floor((height - this.gridRows * this.cellSize) / 2 + 42);

    this.goldenCol = Math.floor(Math.random() * (this.gridCols - 2)) + 1;

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
      const initCol = Math.floor(((idx + 1) * this.gridCols) / (active.length + 1));
      const initX = this.gridOriginX + initCol * this.cellSize + this.cellSize / 2;
      this.playerDroppers.set(p.id, {
        id: p.id,
        selectedCol: initCol,
        railX: initX,
        vx: 0,
        dropCooldown: 0,
        chargeTime: 0,
        isCharging: false,
        score: 0,
        connectsMade: 0,
        lastSteerTime: 0,
        mood: 'idle',
        moodTimer: 0,
        botReactionTimer: 0.15 + Math.random() * 0.2
      });
    });
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 't' || e.key === 'T') {
      this.cycleTheme();
    } else if (e.key === '1') {
      this.setTheme('neon');
    } else if (e.key === '2') {
      this.setTheme('arcade');
    } else if (e.key === '3') {
      this.setTheme('cosmic');
    }
  }

  public cycleTheme(): void {
    const list: DropThemeId[] = ['neon', 'arcade', 'cosmic'];
    const curIdx = list.indexOf(this.currentThemeId);
    this.setTheme(list[(curIdx + 1) % list.length]);
  }

  public setTheme(id: DropThemeId): void {
    if (this.currentThemeId !== id) {
      this.currentThemeId = id;
      this.audio.playTap();
      this.particles.emit(100, 300, 15, THEMES[id].accentColor);
    }
  }

  private isUnderdog(playerId: PlayerId): boolean {
    const scores = Array.from(this.playerDroppers.values()).map((d) => d.score);
    const maxScore = Math.max(...scores, 0);
    const d = this.playerDroppers.get(playerId);
    return !!d && maxScore >= 150 && maxScore - d.score >= 120;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.freezeFrames > 0) {
      this.freezeFrames--;
      return;
    }

    this.animTimer += dt;
    this.roundTimer -= dt;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 14);
    }

    // Shift Golden Column periodically
    this.goldenTimer -= dt;
    if (this.goldenTimer <= 0) {
      this.goldenTimer = 7.0;
      this.goldenCol = Math.floor(Math.random() * this.gridCols);
    }

    // Sudden death check at <= 15s
    if (this.roundTimer <= 15.0 && !this.suddenDeathTriggered) {
      this.suddenDeathTriggered = true;
      this.audio.playWhoosh();
    }

    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    // Update Token Falling Physics
    const fallSpeed = this.suddenDeathTriggered ? 920 : 720;
    for (const t of this.tokens) {
      if (t.isFalling) {
        t.currentY += dt * fallSpeed;
        if (t.currentY >= t.targetY) {
          t.currentY = t.targetY;
          t.isFalling = false;
          this.audio.playBounce();

          if (t.isBomb) {
            // Bomb token shatters rival token below it!
            this.triggerBombExplosion(t);
          } else {
            // Check if 4-in-a-row forms
            this.checkWinCondition(t.ownerId);
          }
        }
      }
    }

    // Update Droppers
    for (const d of this.playerDroppers.values()) {
      if (d.dropCooldown > 0) d.dropCooldown -= dt;
      if (d.moodTimer > 0) {
        d.moodTimer -= dt;
        if (d.moodTimer <= 0) d.mood = 'idle';
      }
    }

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Human controls & Top Rail Navigation
    const active = this.getActivePlayers();
    for (const p of active) {
      const d = this.playerDroppers.get(p.id);
      if (!d) continue;

      if (!p.type.startsWith('bot_')) {
        const steer = this.input.getSteer(p.id);
        const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
        const justReleased = this.input.justReleased(p.id);

        if (Math.abs(steer) > 0.35) {
          if (Date.now() - d.lastSteerTime > 160) {
            d.lastSteerTime = Date.now();
            const step = steer > 0 ? 1 : -1;
            d.selectedCol = Math.max(0, Math.min(this.gridCols - 1, d.selectedCol + step));
            this.audio.playTap();
          }
        }

        // Hold to charge Power Bomb Token
        if (isAction && d.dropCooldown <= 0) {
          d.isCharging = true;
          d.chargeTime += dt;
          d.mood = 'focused';
          if (Math.random() < 0.25) {
            const targetX = this.gridOriginX + d.selectedCol * this.cellSize + this.cellSize / 2;
            this.particles.emit(targetX, this.gridOriginY - 14, 1, p.color);
          }
        }

        if (justReleased && d.isCharging) {
          const isBomb = d.chargeTime >= 0.85;
          this.dropToken(d, isBomb);
          d.isCharging = false;
          d.chargeTime = 0;
        }
      }

      // Smooth rail positioning
      const targetRailX = this.gridOriginX + d.selectedCol * this.cellSize + this.cellSize / 2;
      d.railX += (targetRailX - d.railX) * Math.min(1, dt * 14);
    }

    // Rail Bumping: Shoving rivals along the top rail!
    for (let i = 0; i < active.length; i++) {
      const dA = this.playerDroppers.get(active[i].id);
      if (!dA) continue;

      for (let j = i + 1; j < active.length; j++) {
        const dB = this.playerDroppers.get(active[j].id);
        if (!dB) continue;

        const dist = Math.abs(dB.railX - dA.railX);
        if (dist < this.cellSize * 0.75) {
          // Push apart
          if (dA.railX < dB.railX) {
            dA.selectedCol = Math.max(0, dA.selectedCol - 1);
            dB.selectedCol = Math.min(this.gridCols - 1, dB.selectedCol + 1);
          } else {
            dA.selectedCol = Math.min(this.gridCols - 1, dA.selectedCol + 1);
            dB.selectedCol = Math.max(0, dB.selectedCol - 1);
          }

          dA.mood = 'shocked';
          dA.moodTimer = 0.5;
          dB.mood = 'shocked';
          dB.moodTimer = 0.5;

          this.audio.playBounce();
          this.particles.emit(
            (dA.railX + dB.railX) / 2,
            this.gridOriginY - 14,
            5,
            '#F59E0B'
          );
        }
      }
    }
  }

  private triggerBombExplosion(bombToken: DropToken): void {
    this.audio.playExplosion();
    this.screenShake = 6;
    this.freezeFrames = 2;

    const px = this.gridOriginX + bombToken.col * this.cellSize + this.cellSize / 2;
    const py = bombToken.targetY;
    this.particles.emit(px, py, 18, '#EF4444');

    // Shatter token directly below if exists
    if (bombToken.row > 0) {
      const belowRow = bombToken.row - 1;
      this.grid[bombToken.col][belowRow] = null;
      const idx = this.tokens.findIndex(
        (t) => t.col === bombToken.col && t.row === belowRow && !t.isFalling
      );
      if (idx !== -1) {
        this.tokens.splice(idx, 1);
      }

      // Drop bomb token down to that vacated slot!
      bombToken.row = belowRow;
      bombToken.targetY =
        this.gridOriginY +
        (this.gridRows - 1 - belowRow) * this.cellSize +
        this.cellSize / 2;
      bombToken.isFalling = true;
      this.grid[bombToken.col][belowRow] = bombToken.ownerId;
    }
  }

  private dropToken(dropper: PlayerDropper, isBomb: boolean): boolean {
    if (dropper.dropCooldown > 0) return false;

    const col = dropper.selectedCol;
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

    const underdog = this.isUnderdog(dropper.id);
    const baseCooldown = this.suddenDeathTriggered ? 0.28 : 0.48;
    dropper.dropCooldown = underdog ? baseCooldown * 0.65 : baseCooldown;

    this.grid[col][openRow] = dropper.id;

    const startY = this.gridOriginY - 20;
    const targetY =
      this.gridOriginY +
      (this.gridRows - 1 - openRow) * this.cellSize +
      this.cellSize / 2;
    const pConfig = this.players.find((p) => p.id === dropper.id);

    this.tokens.push({
      col,
      row: openRow,
      ownerId: dropper.id,
      color: isBomb ? '#EF4444' : pConfig?.color || '#38BDF8',
      currentY: startY,
      targetY,
      isFalling: true,
      isWinning: false,
      isBomb,
      alpha: 1.0
    });

    if (isBomb) {
      this.audio.playWhoosh();
    } else {
      this.audio.playTap();
    }
    return true;
  }

  private checkWinCondition(ownerId: PlayerId): void {
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
              const multi = this.suddenDeathTriggered ? 2 : 1;
              const isGold = matchingCells.some((cell) => cell.c === this.goldenCol);
              const scoreAward = (200 + (isGold ? 100 : 0)) * multi;
              dropper.score += scoreAward;
              dropper.mood = 'triumph';
              dropper.moodTimer = 1.2;
            }

            this.audio.playScore();
            this.screenShake = 5;
            this.freezeFrames = 3;

            matchingCells.forEach((cell) => {
              const tok = this.tokens.find((t) => t.col === cell.c && t.row === cell.r);
              if (tok) tok.isWinning = true;

              const px = this.gridOriginX + cell.c * this.cellSize + this.cellSize / 2;
              const py =
                this.gridOriginY +
                (this.gridRows - 1 - cell.r) * this.cellSize +
                this.cellSize / 2;
              this.particles.emit(px, py, 14, '#F59E0B');
            });
            return;
          }
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
        if (
          nc >= 0 &&
          nc < this.gridCols &&
          nr >= 0 &&
          nr < this.gridRows &&
          this.grid[nc][nr] === ownerId
        ) {
          count++;
        } else break;
      }
      for (let step = 1; step < 4; step++) {
        const nc = col - dc * step;
        const nr = openRow - dr * step;
        if (
          nc >= 0 &&
          nc < this.gridCols &&
          nr >= 0 &&
          nr < this.gridRows &&
          this.grid[nc][nr] === ownerId
        ) {
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
      difficulty === 'bot_easy' ? 0.38 : difficulty === 'bot_normal' ? 0.2 : 0.08;
    d.botReactionTimer = baseDelay;

    const validCols: number[] = [];
    for (let c = 0; c < this.gridCols; c++) {
      if (this.grid[c][this.gridRows - 1] === null) validCols.push(c);
    }
    if (validCols.length === 0) return;

    let chosenCol = -1;

    // 1. Can bot win on this drop?
    if (difficulty !== 'bot_easy' || Math.random() < 0.68) {
      for (const c of validCols) {
        if (this.checkHypothetical4(c, botId)) {
          chosenCol = c;
          break;
        }
      }
    }

    // 2. Can any opponent win if bot doesn't block?
    if (
      chosenCol === -1 &&
      (difficulty === 'bot_hard' ||
        (difficulty === 'bot_normal' && Math.random() < 0.82))
    ) {
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
      if (validCols.includes(this.goldenCol) && Math.random() < 0.6) {
        chosenCol = this.goldenCol;
      } else {
        const center = (this.gridCols - 1) / 2;
        validCols.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
        const pool = validCols.slice(0, Math.min(3, validCols.length));
        chosenCol = pool[Math.floor(Math.random() * pool.length)];
      }
    }

    d.selectedCol = chosenCol;
    const isBomb = difficulty === 'bot_hard' && Math.random() < 0.2;
    this.dropToken(d, isBomb);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeId];

    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Arena Floor with Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Vertical Grid Frame with 2.5D Bevel
    const gridW = this.gridCols * this.cellSize;
    const gridH = this.gridRows * this.cellSize;

    // Drop shadow behind board
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(this.gridOriginX + 6, this.gridOriginY + 6, gridW, gridH);

    ctx.fillStyle = theme.boardBg;
    ctx.fillRect(this.gridOriginX, this.gridOriginY, gridW, gridH);
    ctx.strokeStyle = theme.boardBorder;
    ctx.lineWidth = 3.5;
    ctx.strokeRect(this.gridOriginX, this.gridOriginY, gridW, gridH);

    // Golden Column Highlight
    ctx.fillStyle = theme.goldenColBg;
    ctx.fillRect(
      this.gridOriginX + this.goldenCol * this.cellSize,
      this.gridOriginY,
      this.cellSize,
      gridH
    );

    // Golden Column Star Icon on Top
    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '★ 2X',
      this.gridOriginX + this.goldenCol * this.cellSize + this.cellSize / 2,
      this.gridOriginY - 4
    );

    // Column Slots (Empty circular apertures)
    for (let c = 0; c < this.gridCols; c++) {
      for (let r = 0; r < this.gridRows; r++) {
        const cx = this.gridOriginX + c * this.cellSize + this.cellSize / 2;
        const cy = this.gridOriginY + r * this.cellSize + this.cellSize / 2;
        ctx.fillStyle = theme.slotColor;
        ctx.beginPath();
        ctx.arc(cx, cy, this.cellSize * 0.39, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // 3. Settled & Falling Tokens
    for (const tok of this.tokens) {
      const tokX = this.gridOriginX + tok.col * this.cellSize + this.cellSize / 2;
      const tokY = tok.currentY;

      // Drop shadow for tokens
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.arc(tokX, tokY + 3, this.cellSize * 0.38, 0, Math.PI * 2);
      ctx.fill();

      // Outer token body
      ctx.fillStyle = tok.isWinning
        ? '#F59E0B'
        : tok.isBomb
        ? '#EF4444'
        : tok.color;
      ctx.beginPath();
      ctx.arc(tokX, tokY, this.cellSize * 0.37, 0, Math.PI * 2);
      ctx.fill();

      // Inner beveled rim
      ctx.strokeStyle = tok.isWinning ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = tok.isWinning ? 3 : 1.5;
      ctx.stroke();

      // Bomb icon or Winning star
      if (tok.isBomb) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💣', tokX, tokY + 4);
      } else if (tok.isWinning) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★', tokX, tokY + 4);
      }
    }

    // 4. Top Rail Droppers
    for (const p of this.getActivePlayers()) {
      const d = this.playerDroppers.get(p.id);
      if (!d) continue;

      const selX = d.railX;
      const selY = this.gridOriginY - 14;

      // Underdog aiming laser line
      if (this.isUnderdog(p.id)) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(selX, selY + 12);
        ctx.lineTo(selX, this.gridOriginY + gridH);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Charging Power indicator ring
      if (d.isCharging) {
        const ratio = Math.min(1.0, d.chargeTime / 0.85);
        ctx.strokeStyle = ratio >= 1.0 ? '#EF4444' : p.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(selX, selY - 4, 14, 0, Math.PI * 2 * ratio);
        ctx.stroke();
      }

      // Downward pointer arrow
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(selX, selY + 8);
      ctx.lineTo(selX - 9, selY - 10);
      ctx.lineTo(selX + 9, selY - 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore(); // Undo screen shake

    // 5. Header / Instruction Badge (Safe-zone: y: 56, h: 26)
    const headerW = 340;
    const headerH = 26;
    const headerX = width / 2 - headerW / 2;
    const headerY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(headerX, headerY, headerW, headerH, 6);
    else ctx.rect(headerX, headerY, headerW, headerH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${theme.icon} ${theme.name.toUpperCase()} • REAL-TIME 4-IN-A-ROW`,
      width / 2,
      headerY + 17
    );

    // 6. Corner Player HUD Cards with CharacterRenderer Mascots
    // Offset bottom-left card above Theme Pill (y: height - 128)
    for (const p of this.getActivePlayers()) {
      const d = this.playerDroppers.get(p.id);
      if (!d) continue;

      let cx = 16;
      let cy = 72;
      const cardW = 124;
      const cardH = 66;

      if (p.corner === 'top-right') {
        cx = width - cardW - 16;
        cy = 72;
      } else if (p.corner === 'bottom-left') {
        cx = 16;
        cy = height - cardH - 52;
      } else if (p.corner === 'bottom-right') {
        cx = width - cardW - 16;
        cy = height - cardH - 52;
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx, cy, cardW, cardH, 8);
      else ctx.rect(cx, cy, cardW, cardH);
      ctx.fill();
      ctx.stroke();

      // Underdog aura
      if (this.isUnderdog(p.id)) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(cx - 2, cy - 2, cardW + 4, cardH + 4);
        ctx.setLineDash([]);
      }

      // Mascot Avatar
      const isBot = p.type !== 'human';
      drawCharacter(ctx, cx + 22, cy + 33, 16, p.id, isBot, d.mood, this.animTimer);

      // Name & Score
      ctx.fillStyle = p.color;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cx + 46, cy + 22);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`${d.score} pts`, cx + 46, cy + 40);

      ctx.fillStyle = d.connectsMade > 0 ? '#10B981' : '#94A3B8';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(`Connects: ${d.connectsMade}`, cx + 46, cy + 56);
    }

    // 7. Interactive Theme Pill (Bottom-left: x: 20, y: height - 44, w: 170, h: 32)
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${theme.icon} ${theme.name} [T]`, pillX + 10, pillY + 20);

    // 8. Control hints (Bottom-right: x: width - 20, y: height - 28)
    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Steer: Pick Column | Tap: Drop | Hold: Bomb Token', width - 20, height - 24);
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
      mvpHighlight: `Four-in-a-row master! Scored ${topScore} pts in real-time gravity action on ${THEMES[this.currentThemeId].name}!`
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.onKeyDownBound);
  }

  public syncDebug(): Record<string, unknown> {
    return {
      theme: this.currentThemeId,
      roundTimer: this.roundTimer,
      goldenCol: this.goldenCol,
      suddenDeath: this.suddenDeathTriggered,
      tokenCount: this.tokens.length,
      players: Array.from(this.playerDroppers.entries()).map(([id, d]) => ({
        id,
        score: d.score,
        connects: d.connectsMade,
        isUnderdog: this.isUnderdog(id)
      }))
    };
  }
}
