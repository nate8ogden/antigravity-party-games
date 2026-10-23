/**
 * TetrisRetro.js
 * Dual-Mode Arcade Puzzle Cabinet ("Neon Blocks & Gems"):
 * 1. TETRIS RETRO: 10x20 7-Tetromino Line Clearing with 7-Bag randomizer, Ghost Piece
 *    preview, Next & Hold boxes, Wall-Kick rotation, Soft/Hard Drop, and TETRIS! 4-line combos.
 * 2. COLUMNS GEMS: 6x13 Sega Columns Jewel-Triad Matching where Up/Action A cycles the
 *    3-gem column order and horizontal, vertical, and diagonal 3+ matches trigger cascading
 *    gravity chain combos!
 * Switch modes anytime via the on-screen cabinet tabs or pressing [TAB / C]!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const TETROMINOES = [
  {
    id: 'I',
    color: '#00F0FF',
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  },
  {
    id: 'O',
    color: '#FFD700',
    matrix: [
      [1, 1],
      [1, 1]
    ]
  },
  {
    id: 'T',
    color: '#B829FF',
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  {
    id: 'S',
    color: '#00FF66',
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ]
  },
  {
    id: 'Z',
    color: '#FF2A55',
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ]
  },
  {
    id: 'J',
    color: '#38BDF8',
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  {
    id: 'L',
    color: '#FF8800',
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ]
  }
];

const GEM_PALETTE = [
  null,
  { name: 'RUBY', color: '#FF2A55', rim: '#FDA4AF', shape: 'diamond' },
  { name: 'SAPPHIRE', color: '#38BDF8', rim: '#BAE6FD', shape: 'octagon' },
  { name: 'EMERALD', color: '#00FF66', rim: '#A7F3D0', shape: 'square' },
  { name: 'TOPAZ', color: '#FFD700', rim: '#FEF08A', shape: 'triangle' },
  { name: 'AMETHYST', color: '#B829FF', rim: '#E9D5FF', shape: 'hex' },
  { name: 'CYAN STAR', color: '#00F0FF', rim: '#CFFAFE', shape: 'circle' }
];

export class TetrisRetro {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'tetrisretro';
    this.title = 'Tetris & Columns';

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 1;
    this.level = 1;

    this.cabinetMode = 'TETRIS'; // 'TETRIS' | 'COLUMNS'

    // Mode tab hitboxes for mouse/touch switching
    this.tabTetrisRect = { x: 48, y: 66, w: 185, h: 36 };
    this.tabColumnsRect = { x: 48, y: 112, w: 185, h: 36 };

    // Tetris state (10x20 grid, 22px cells)
    this.tCols = 10;
    this.tRows = 20;
    this.tCell = 22;
    this.tBoardX = 370;
    this.tBoardY = 64;
    this.tGrid = [];
    this.tBag = [];
    this.tActive = null;
    this.tNext = null;
    this.tHold = null;
    this.tCanHold = true;
    this.linesCleared = 0;

    // Columns state (6x13 grid, 34px cells)
    this.cCols = 6;
    this.cRows = 13;
    this.cCell = 34;
    this.cBoardX = 378;
    this.cBoardY = 64;
    this.cGrid = [];
    this.cActive = null;
    this.cNextGems = [1, 2, 3];
    this.cCascadeTimer = 0;
    this.cChainCount = 0;
    this.gemsCleared = 0;

    this.dropTimer = 0;
    this.moveRepeatTimer = 0;
    this.comboStreak = 0;
    this.particles = [];
    this.popups = [];
    this.animTime = 0;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.lives = 1;
    this.level = 1;
    this.highScore = HighScoreStore.get(this.id);
    this.state = 'PLAYING';
    this.particles = [];
    this.popups = [];
    this.comboStreak = 0;
    this.initTetrisBoard();
    this.initColumnsBoard();
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    if (this.audio && typeof this.audio.stopSequence === 'function') {
      this.audio.stopSequence();
    }
  }

  addScore(pts, x = 480, y = 260, color = PALETTE.GOLD, label = null) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    this.popups.push({
      text: label ? `${label} +${pts}` : `+${pts}`,
      x,
      y,
      vy: -38,
      life: 1.0,
      maxLife: 1.0,
      color
    });
  }

  switchCabinetMode(newMode) {
    this.cabinetMode = newMode;
    this.dropTimer = 0;
    this.audio.playMenuSelect();
    this.popups.push({
      text: newMode === 'TETRIS' ? 'TETRIS RETRO MODE' : 'COLUMNS JEWELS MODE',
      x: 480,
      y: 120,
      vy: -25,
      life: 1.1,
      maxLife: 1.1,
      color: PALETTE.CYAN
    });
  }

  // ===========================================================================
  // TETRIS RETRO LOGIC (10x20 Matrix)
  // ===========================================================================
  initTetrisBoard() {
    this.tGrid = [];
    for (let r = 0; r < this.tRows; r++) {
      this.tGrid.push(new Array(this.tCols).fill(null));
    }
    this.tBag = [];
    this.tHold = null;
    this.tCanHold = true;
    this.linesCleared = 0;
    this.tNext = this.pullFromBag();
    this.spawnTetromino();
  }

  pullFromBag() {
    if (this.tBag.length === 0) {
      this.tBag = [...TETROMINOES];
      for (let i = this.tBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.tBag[i], this.tBag[j]] = [this.tBag[j], this.tBag[i]];
      }
    }
    const def = this.tBag.pop();
    return {
      id: def.id,
      color: def.color,
      matrix: def.matrix.map((row) => [...row])
    };
  }

  spawnTetromino(customDef = null) {
    const piece = customDef || this.tNext || this.pullFromBag();
    if (!customDef) {
      this.tNext = this.pullFromBag();
    }
    this.tActive = {
      id: piece.id,
      color: piece.color,
      matrix: piece.matrix.map((r) => [...r]),
      c: Math.floor((this.tCols - piece.matrix[0].length) / 2),
      r: 0
    };
    this.tCanHold = true;

    if (!this.canTetrominoFit(this.tActive.matrix, this.tActive.c, this.tActive.r)) {
      this.triggerGameOver();
    }
  }

  canTetrominoFit(matrix, baseC, baseR) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const gc = baseC + c;
        const gr = baseR + r;
        if (gc < 0 || gc >= this.tCols || gr >= this.tRows) return false;
        if (gr >= 0 && this.tGrid[gr][gc] !== null) return false;
      }
    }
    return true;
  }

  rotateMatrixCW(mat) {
    const N = mat.length;
    const out = Array.from({ length: N }, () => new Array(N).fill(0));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        out[c][N - 1 - r] = mat[r][c];
      }
    }
    return out;
  }

  rotateTetromino() {
    const p = this.tActive;
    const rotated = this.rotateMatrixCW(p.matrix);
    // Standard wall-kick offsets
    for (const kickC of [0, -1, 1, -2, 2]) {
      if (this.canTetrominoFit(rotated, p.c + kickC, p.r)) {
        p.matrix = rotated;
        p.c += kickC;
        this.audio.playMenuMove();
        return;
      }
    }
  }

  holdTetromino() {
    if (!this.tCanHold || !this.tActive) return;
    const currentDef = TETROMINOES.find((t) => t.id === this.tActive.id);
    const prevHold = this.tHold;
    this.tHold = {
      id: currentDef.id,
      color: currentDef.color,
      matrix: currentDef.matrix.map((r) => [...r])
    };
    this.spawnTetromino(prevHold);
    this.tCanHold = false;
    this.audio.playHop();
  }

  getGhostRow() {
    const p = this.tActive;
    if (!p) return 0;
    let gr = p.r;
    while (this.canTetrominoFit(p.matrix, p.c, gr + 1)) {
      gr++;
    }
    return gr;
  }

  lockTetromino() {
    const p = this.tActive;
    for (let r = 0; r < p.matrix.length; r++) {
      for (let c = 0; c < p.matrix[r].length; c++) {
        if (!p.matrix[r][c]) continue;
        const gr = p.r + r;
        const gc = p.c + c;
        if (gr >= 0 && gr < this.tRows && gc >= 0 && gc < this.tCols) {
          this.tGrid[gr][gc] = p.color;
        }
      }
    }
    this.audio.playDig();
    this.clearCompletedLines();
    this.spawnTetromino();
  }

  clearCompletedLines() {
    let cleared = 0;
    for (let r = this.tRows - 1; r >= 0; r--) {
      if (this.tGrid[r].every((cell) => cell !== null)) {
        // Spawn row burst particles
        for (let c = 0; c < this.tCols; c++) {
          this.spawnCellBurst(
            this.tBoardX + (c + 0.5) * this.tCell,
            this.tBoardY + (r + 0.5) * this.tCell,
            this.tGrid[r][c]
          );
        }
        this.tGrid.splice(r, 1);
        this.tGrid.unshift(new Array(this.tCols).fill(null));
        cleared++;
        r++;
      }
    }

    if (cleared > 0) {
      this.linesCleared += cleared;
      this.comboStreak++;
      this.level = Math.max(this.level, 1 + Math.floor(this.linesCleared / 10));
      const baseTable = [0, 100, 300, 500, 800];
      const labels = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS!!'];
      const pts = baseTable[cleared] * this.level + (this.comboStreak - 1) * 50;
      this.addScore(
        pts,
        480,
        240,
        cleared === 4 ? PALETTE.CYAN : PALETTE.GOLD,
        labels[cleared]
      );
      if (cleared === 4) {
        this.audio.playPowerUp();
        this.renderer.shake(7, 0.22);
      } else {
        this.audio.playCoin();
      }
    } else {
      this.comboStreak = 0;
    }
  }

  // ===========================================================================
  // COLUMNS GEMS LOGIC (6x13 Jewel Well)
  // ===========================================================================
  initColumnsBoard() {
    this.cGrid = [];
    for (let r = 0; r < this.cRows; r++) {
      this.cGrid.push(new Array(this.cCols).fill(0));
    }
    this.cCascadeTimer = 0;
    this.cChainCount = 0;
    this.gemsCleared = 0;
    this.cNextGems = this.randomGemTriad();
    this.spawnColumnsTriad();
  }

  randomGemTriad() {
    const randGem = () => 1 + Math.floor(Math.random() * 6);
    return [randGem(), randGem(), randGem()];
  }

  spawnColumnsTriad() {
    const gems = [...this.cNextGems];
    this.cNextGems = this.randomGemTriad();
    const startCol = 2;
    this.cActive = {
      c: startCol,
      r: 0, // Bottom gem of the 3-gem vertical triad is at r, middle at r-1, top at r-2
      gems
    };

    if (this.cGrid[0][startCol] !== 0) {
      this.triggerGameOver();
    }
  }

  canColumnsFit(col, bottomRow) {
    if (col < 0 || col >= this.cCols || bottomRow >= this.cRows) return false;
    for (let k = 0; k < 3; k++) {
      const r = bottomRow - k;
      if (r >= 0 && this.cGrid[r][col] !== 0) return false;
    }
    return true;
  }

  cycleColumnsTriad() {
    if (!this.cActive) return;
    // Rotate [top, mid, bot] -> [bot, top, mid]
    const g = this.cActive.gems;
    this.cActive.gems = [g[2], g[0], g[1]];
    this.audio.playMenuMove();
  }

  lockColumnsTriad() {
    const a = this.cActive;
    for (let k = 0; k < 3; k++) {
      const gr = a.r - k;
      if (gr >= 0 && gr < this.cRows) {
        this.cGrid[gr][a.c] = a.gems[2 - k];
      }
    }
    this.cActive = null;
    this.cChainCount = 0;
    this.audio.playDig();
    this.resolveColumnsMatches();
  }

  resolveColumnsMatches() {
    const toClear = Array.from({ length: this.cRows }, () => new Array(this.cCols).fill(false));
    let foundMatch = false;

    const dirs = [
      { dc: 1, dr: 0 },  // Horizontal
      { dc: 0, dr: 1 },  // Vertical
      { dc: 1, dr: 1 },  // Diagonal Down-Right
      { dc: 1, dr: -1 }  // Diagonal Up-Right
    ];

    for (let r = 0; r < this.cRows; r++) {
      for (let c = 0; c < this.cCols; c++) {
        const gem = this.cGrid[r][c];
        if (gem === 0) continue;

        for (const { dc, dr } of dirs) {
          let count = 1;
          while (
            r + dr * count >= 0 &&
            r + dr * count < this.cRows &&
            c + dc * count >= 0 &&
            c + dc * count < this.cCols &&
            this.cGrid[r + dr * count][c + dc * count] === gem
          ) {
            count++;
          }
          if (count >= 3) {
            foundMatch = true;
            for (let i = 0; i < count; i++) {
              toClear[r + dr * i][c + dc * i] = true;
            }
          }
        }
      }
    }

    if (foundMatch) {
      this.cChainCount++;
      let jewelsShattered = 0;
      for (let r = 0; r < this.cRows; r++) {
        for (let c = 0; c < this.cCols; c++) {
          if (toClear[r][c]) {
            const gemIdx = this.cGrid[r][c];
            this.spawnCellBurst(
              this.cBoardX + (c + 0.5) * this.cCell,
              this.cBoardY + (r + 0.5) * this.cCell,
              GEM_PALETTE[gemIdx].color
            );
            this.cGrid[r][c] = 0;
            jewelsShattered++;
          }
        }
      }

      // Gravity collapse remaining gems downward
      for (let c = 0; c < this.cCols; c++) {
        let writeR = this.cRows - 1;
        for (let r = this.cRows - 1; r >= 0; r--) {
          if (this.cGrid[r][c] !== 0) {
            this.cGrid[writeR][c] = this.cGrid[r][c];
            if (writeR !== r) this.cGrid[r][c] = 0;
            writeR--;
          }
        }
      }

      this.gemsCleared += jewelsShattered;
      this.level = Math.max(this.level, 1 + Math.floor(this.gemsCleared / 25));
      const pts = jewelsShattered * 100 * this.cChainCount * this.level;
      this.addScore(
        pts,
        480,
        240,
        this.cChainCount > 1 ? PALETTE.PINK : PALETTE.GOLD,
        this.cChainCount > 1 ? `CHAIN x${this.cChainCount}!` : `${jewelsShattered} GEMS`
      );
      if (this.cChainCount > 1) {
        this.audio.playPowerUp();
        this.renderer.shake(6, 0.18);
      } else {
        this.audio.playCoin();
      }

      // Schedule next cascade check!
      this.cCascadeTimer = 0.28;
    } else {
      this.spawnColumnsTriad();
    }
  }

  spawnCellBurst(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8 + Math.random() * 0.3;
      const spd = 45 + Math.random() * 115;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 3.5,
        life: 0.42,
        color
      });
    }
  }

  triggerGameOver() {
    HighScoreStore.submit(this.id, this.score);
    this.audio.playGameOver();
    this.state = 'GAMEOVER';
  }

  update(dt) {
    this.animTime += dt;

    if (this.input.isJustPressed('pause')) {
      this.state = this.state === 'PLAYING' ? 'PAUSED' : 'PLAYING';
      return;
    }

    if (this.state === 'MENU' || this.state === 'GAMEOVER') {
      if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
        this.audio.playMenuSelect();
        this.reset();
      }
      return;
    }

    if (this.state === 'PAUSED') {
      if (this.input.isJustPressed('actionA')) this.state = 'PLAYING';
      return;
    }

    // Mode Toggle via Tab / KeyC or clicking the left-panel Cabinet Mode Tabs
    if (this.input.isKeyJustPressed('Tab') || this.input.isKeyJustPressed('KeyC')) {
      this.switchCabinetMode(this.cabinetMode === 'TETRIS' ? 'COLUMNS' : 'TETRIS');
    }
    if (this.input.pointer.justPressed) {
      const px = this.input.pointer.x;
      const py = this.input.pointer.y;
      const inRect = (r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
      if (inRect(this.tabTetrisRect)) {
        this.switchCabinetMode('TETRIS');
        return;
      } else if (inRect(this.tabColumnsRect)) {
        this.switchCabinetMode('COLUMNS');
        return;
      }
    }

    // Update particles & popups
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y += pop.vy * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }

    if (this.cabinetMode === 'TETRIS') {
      this.updateTetris(dt);
    } else {
      this.updateColumns(dt);
    }
  }

  updateTetris(dt) {
    const p = this.tActive;
    if (!p) return;

    // Horizontal movement
    if (this.input.isJustPressed('left')) {
      if (this.canTetrominoFit(p.matrix, p.c - 1, p.r)) {
        p.c--;
        this.audio.playMenuMove();
      }
      this.moveRepeatTimer = 0.17;
    } else if (this.input.isJustPressed('right')) {
      if (this.canTetrominoFit(p.matrix, p.c + 1, p.r)) {
        p.c++;
        this.audio.playMenuMove();
      }
      this.moveRepeatTimer = 0.17;
    } else if (this.input.isDown('left') || this.input.isDown('right')) {
      this.moveRepeatTimer -= dt;
      if (this.moveRepeatTimer <= 0) {
        this.moveRepeatTimer = 0.065;
        const dc = this.input.isDown('left') ? -1 : 1;
        if (this.canTetrominoFit(p.matrix, p.c + dc, p.r)) {
          p.c += dc;
        }
      }
    }

    // Rotate (Up or Action A)
    if (this.input.isJustPressed('up') || this.input.isJustPressed('actionA')) {
      this.rotateTetromino();
    }

    // Hard Drop (Action B) or Hold Piece (Key H)
    if (this.input.isKeyJustPressed('KeyH')) {
      this.holdTetromino();
      return;
    }
    if (this.input.isJustPressed('actionB')) {
      const ghostR = this.getGhostRow();
      const dropped = Math.max(0, ghostR - p.r);
      p.r = ghostR;
      this.score += dropped * 2;
      this.lockTetromino();
      return;
    }

    // Gravity & Soft Drop
    const baseInterval = Math.max(0.11, 0.72 - (this.level - 1) * 0.055);
    const interval = this.input.isDown('down') ? 0.045 : baseInterval;
    this.dropTimer += dt;
    if (this.dropTimer >= interval) {
      this.dropTimer = 0;
      if (this.canTetrominoFit(p.matrix, p.c, p.r + 1)) {
        p.r++;
        if (this.input.isDown('down')) this.score += 1;
      } else {
        this.lockTetromino();
      }
    }
  }

  updateColumns(dt) {
    if (this.cCascadeTimer > 0) {
      this.cCascadeTimer -= dt;
      if (this.cCascadeTimer <= 0) {
        this.resolveColumnsMatches();
      }
      return;
    }

    const a = this.cActive;
    if (!a) return;

    if (this.input.isJustPressed('left') && this.canColumnsFit(a.c - 1, a.r)) {
      a.c--;
      this.audio.playMenuMove();
    } else if (this.input.isJustPressed('right') && this.canColumnsFit(a.c + 1, a.r)) {
      a.c++;
      this.audio.playMenuMove();
    }

    // Up or Action A cycles the 3 jewels inside the column!
    if (this.input.isJustPressed('up') || this.input.isJustPressed('actionA')) {
      this.cycleColumnsTriad();
    }

    // Action B Hard Drops the jewel column!
    if (this.input.isJustPressed('actionB')) {
      while (this.canColumnsFit(a.c, a.r + 1)) {
        a.r++;
        this.score += 2;
      }
      this.lockColumnsTriad();
      return;
    }

    const baseInterval = Math.max(0.12, 0.72 - (this.level - 1) * 0.05);
    const interval = this.input.isDown('down') ? 0.05 : baseInterval;
    this.dropTimer += dt;
    if (this.dropTimer >= interval) {
      this.dropTimer = 0;
      if (this.canColumnsFit(a.c, a.r + 1)) {
        a.r++;
      } else {
        this.lockColumnsTriad();
      }
    }
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear('#070B16');

    this.drawModeSelectorPanel(ctx);

    if (this.cabinetMode === 'TETRIS') {
      this.drawTetrisCabinet(ctx);
    } else {
      this.drawColumnsCabinet(ctx);
    }

    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size * 0.5, pt.y - pt.size * 0.5, pt.size, pt.size);
    }
    for (const pop of this.popups) {
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HEADER,
        size: 11,
        color: pop.color,
        align: 'center',
        glow: 8
      });
    }

    const statLabel =
      this.cabinetMode === 'TETRIS'
        ? `LINES:${this.linesCleared}  MODE:TETRIS`
        : `GEMS:${this.gemsCleared}  MODE:COLUMNS`;

    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: statLabel,
      accent: PALETTE.PINK
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'DUAL CABINET: TETRIS RETRO + SEGA COLUMNS JEWELS',
      controls: 'LEFT/RIGHT: MOVE | UP/Z: ROTATE/CYCLE | DOWN: SOFT | X: HARD DROP | C/TAB: SWITCH GAME',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.PINK
    });
  }

  drawModeSelectorPanel(ctx) {
    ctx.save();
    const tabs = [
      { rect: this.tabTetrisRect, id: 'TETRIS', label: '1. TETRIS RETRO', color: PALETTE.CYAN },
      { rect: this.tabColumnsRect, id: 'COLUMNS', label: '2. COLUMNS GEMS', color: PALETTE.PINK }
    ];

    for (const t of tabs) {
      const active = this.cabinetMode === t.id;
      ctx.fillStyle = active ? 'rgba(0, 240, 255, 0.16)' : '#0F172A';
      ctx.strokeStyle = active ? t.color : '#334155';
      ctx.lineWidth = active ? 2.5 : 1.5;
      if (active) {
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 10;
      }
      ctx.fillRect(t.rect.x, t.rect.y, t.rect.w, t.rect.h);
      ctx.strokeRect(t.rect.x, t.rect.y, t.rect.w, t.rect.h);
      ctx.shadowBlur = 0;

      this.renderer.drawText(t.label, t.rect.x + t.rect.w * 0.5, t.rect.y + 23, {
        font: FONTS.HEADER,
        size: 9,
        color: active ? t.color : PALETTE.MUTED,
        align: 'center'
      });
    }

    this.renderer.drawText('CLICK TAB OR PRESS [C]', 140, 168, {
      font: FONTS.HUD,
      size: 12,
      color: PALETTE.GOLD,
      align: 'center'
    });
    ctx.restore();
  }

  drawTetrisCabinet(ctx) {
    ctx.save();
    const bx = this.tBoardX;
    const by = this.tBoardY;
    const bw = this.tCols * this.tCell;
    const bh = this.tRows * this.tCell;

    // Well frame
    ctx.fillStyle = '#0B1020';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = PALETTE.CYAN;
    ctx.shadowBlur = 12;
    ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.shadowBlur = 0;

    // Subtle Matrix Gridlines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.10)';
    ctx.lineWidth = 1;
    for (let c = 1; c < this.tCols; c++) {
      ctx.beginPath();
      ctx.moveTo(bx + c * this.tCell, by);
      ctx.lineTo(bx + c * this.tCell, by + bh);
      ctx.stroke();
    }
    for (let r = 1; r < this.tRows; r++) {
      ctx.beginPath();
      ctx.moveTo(bx, by + r * this.tCell);
      ctx.lineTo(bx + bw, by + r * this.tCell);
      ctx.stroke();
    }

    // Locked blocks
    for (let r = 0; r < this.tRows; r++) {
      for (let c = 0; c < this.tCols; c++) {
        if (this.tGrid[r][c]) {
          this.drawBeveledBlock(
            ctx,
            bx + c * this.tCell,
            by + r * this.tCell,
            this.tCell,
            this.tGrid[r][c]
          );
        }
      }
    }

    // Ghost Piece & Active Tetromino
    if (this.tActive) {
      const ghostR = this.getGhostRow();
      const p = this.tActive;
      for (let r = 0; r < p.matrix.length; r++) {
        for (let c = 0; c < p.matrix[r].length; c++) {
          if (!p.matrix[r][c]) continue;
          // Ghost outline
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = 2;
          ctx.strokeRect(
            bx + (p.c + c) * this.tCell + 2,
            by + (ghostR + r) * this.tCell + 2,
            this.tCell - 4,
            this.tCell - 4
          );
          ctx.globalAlpha = 1;

          // Active piece cell
          if (p.r + r >= 0) {
            this.drawBeveledBlock(
              ctx,
              bx + (p.c + c) * this.tCell,
              by + (p.r + r) * this.tCell,
              this.tCell,
              p.color
            );
          }
        }
      }
    }

    // Right Panel: NEXT PIECE & CONTROLS
    const rx = 640;
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.lineWidth = 2;
    ctx.fillRect(rx, 70, 170, 140);
    ctx.strokeRect(rx, 70, 170, 140);
    this.renderer.drawText('NEXT TETROMINO', rx + 85, 94, {
      font: FONTS.HEADER,
      size: 9,
      color: PALETTE.GOLD,
      align: 'center'
    });

    if (this.tNext) {
      const m = this.tNext.matrix;
      const startX = rx + 85 - (m[0].length * 20) * 0.5;
      const startY = 120;
      for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
          if (m[r][c]) {
            this.drawBeveledBlock(ctx, startX + c * 20, startY + r * 20, 20, this.tNext.color);
          }
        }
      }
    }

    // Hold Box ([H] Key)
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = PALETTE.PURPLE;
    ctx.fillRect(rx, 235, 170, 130);
    ctx.strokeRect(rx, 235, 170, 130);
    this.renderer.drawText('HOLD PIECE [H]', rx + 85, 258, {
      font: FONTS.HEADER,
      size: 9,
      color: PALETTE.PURPLE,
      align: 'center'
    });
    if (this.tHold) {
      const m = this.tHold.matrix;
      const startX = rx + 85 - (m[0].length * 20) * 0.5;
      const startY = 280;
      for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
          if (m[r][c]) {
            this.drawBeveledBlock(ctx, startX + c * 20, startY + r * 20, 20, this.tHold.color);
          }
        }
      }
    }
    ctx.restore();
  }

  drawColumnsCabinet(ctx) {
    ctx.save();
    const bx = this.cBoardX;
    const by = this.cBoardY;
    const bw = this.cCols * this.cCell;
    const bh = this.cRows * this.cCell;

    ctx.fillStyle = '#110B22';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = PALETTE.PINK;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = PALETTE.PINK;
    ctx.shadowBlur = 12;
    ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.shadowBlur = 0;

    // Locked Jewels
    for (let r = 0; r < this.cRows; r++) {
      for (let c = 0; c < this.cCols; c++) {
        const gIdx = this.cGrid[r][c];
        if (gIdx > 0) {
          this.drawJewel(
            ctx,
            bx + c * this.cCell,
            by + r * this.cCell,
            this.cCell,
            GEM_PALETTE[gIdx]
          );
        }
      }
    }

    // Active Falling 3-Jewel Column
    if (this.cActive) {
      const a = this.cActive;
      for (let k = 0; k < 3; k++) {
        const gr = a.r - k;
        if (gr >= 0) {
          const gemDef = GEM_PALETTE[a.gems[2 - k]];
          this.drawJewel(ctx, bx + a.c * this.cCell, by + gr * this.cCell, this.cCell, gemDef);
        }
      }
    }

    // Next Jewel Triad Preview
    const rx = 640;
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = PALETTE.PINK;
    ctx.lineWidth = 2;
    ctx.fillRect(rx, 70, 175, 190);
    ctx.strokeRect(rx, 70, 175, 190);
    this.renderer.drawText('NEXT JEWEL TRIAD', rx + 87, 96, {
      font: FONTS.HEADER,
      size: 9,
      color: PALETTE.GOLD,
      align: 'center'
    });

    for (let k = 0; k < 3; k++) {
      const gemDef = GEM_PALETTE[this.cNextGems[k]];
      this.drawJewel(ctx, rx + 70, 114 + k * 38, 34, gemDef);
    }

    this.renderer.drawText('[UP/Z] CYCLE GEMS', rx + 87, 295, {
      font: FONTS.HUD,
      size: 13,
      color: PALETTE.CYAN,
      align: 'center'
    });
    this.renderer.drawText('[X] HARD DROP', rx + 87, 320, {
      font: FONTS.HUD,
      size: 13,
      color: PALETTE.GOLD,
      align: 'center'
    });
    ctx.restore();
  }

  drawBeveledBlock(ctx, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(x + 2, y + 2, size - 4, 3);
    ctx.fillRect(x + 2, y + 2, 3, size - 4);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(x + 2, y + size - 4, size - 4, 3);
  }

  drawJewel(ctx, x, y, size, gemDef) {
    if (!gemDef) return;
    ctx.save();
    ctx.fillStyle = gemDef.color;
    ctx.shadowColor = gemDef.color;
    ctx.shadowBlur = 8;

    const cx = x + size * 0.5;
    const cy = y + size * 0.5;
    const r = size * 0.38;

    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = gemDef.rim;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner specular facet
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(cx - 3, cy - 3, 6, 6);
    ctx.restore();
  }
}

export default TetrisRetro;
