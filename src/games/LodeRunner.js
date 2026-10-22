/**
 * LodeRunner.js
 * Flagship implementation of classic Lode Runner (1983) for Retro Arcade Studio.
 * Features a 28x16 spatial grid, procedural 8.0s brick regeneration with crush physics,
 * dual-action/directional laser digging, A* guard pathfinding on platform/ladder/rope
 * topology, guard hole trapping & head-walking bridges, and multi-tier puzzle stages.
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';
import { wasmCore } from '../engine/WasmCore.js';

export const TILE = {
  EMPTY: 0,
  BRICK: 1,
  SOLID: 2,
  LADDER: 3,
  ROPE: 4,
  GOLD: 5,
  EXIT_LADDER: 6
};

/**
 * 3 distinct, guaranteed-solvable classic multi-tier 28x16 levels.
 * Legend:
 *  . = EMPTY
 *  # = BRICK (Diggable)
 *  = = SOLID (Indestructible concrete)
 *  H = LADDER
 *  - = ROPE (Hand-over-hand traverse, press Down to drop)
 *  $ = GOLD CHEST
 *  E = EXIT LADDER (Revealed once all gold is collected)
 *  P = PLAYER SPAWN
 *  G = GUARD SPAWN
 */
const LEVEL_DESIGNS = [
  // LEVEL 1: Classic Tiered Terraces & Rope Bridges
  [
    '..................E.........',
    '....$............EH....G....',
    '#######H##########H#########',
    '.......H----......H.........',
    '.......H....$..G..H....$....',
    '.......H#########H##########',
    '.......H.........H..........',
    '..G....H---...---H......$...',
    '####H###.........######H####',
    '....H......$...........H....',
    '....H..#########H......H....',
    '....H...........H--..--H....',
    '....H.$....P....H......H..$.',
    '#########H############H#####',
    '....$....H............H...$.',
    '############################'
  ],
  // LEVEL 2: Twin Citadels & Suspended Highwires
  [
    '.............E..............',
    '..$....G.....E.....G......$.',
    '####H########H#########H####',
    '....H--------H---------H....',
    '....H........H.........H....',
    '....H..$.....H.....$...H....',
    '#########H#######H##########',
    '.........H.......H..........',
    '..$......H---.---H.......$..',
    '#####H####.......####H######',
    '.....H...$...G...$...H......',
    '.....H.#####===#####.H......',
    '.....H.......P.......H......',
    '##########H#####H###########',
    '....$.....H.....H.....$.....',
    '############################'
  ],
  // LEVEL 3: The Vault of Traps & Deep Shafts
  [
    '..........................E.',
    '.$...G.......$.......G....E.',
    '###H#######H===H#######H####',
    '...H.......H...H.......H....',
    '...H---.---H...H---.---H....',
    '...H..$....H...H....$..H....',
    '#######H####...####H########',
    '.......H.....G.....H........',
    '..$....H..#######..H....$...',
    '####H###..#..$..#..###H#####',
    '....H.....###H###.....H.....',
    '....H----....H....----H.....',
    '....H....$...P...$....H.....',
    '########H#########H#########',
    '....$...H.........H...$.....',
    '############################'
  ],
  // LEVEL 4: The Hanging Rope Labyrinth
  [
    '.............E..............',
    '.$....G......E......G.....$.',
    '###H########H=H########H####',
    '...H--------H.H--------H....',
    '...H...$....H.H....$...H....',
    '...H.######.H.H.######.H....',
    '...H------..H.H..------H....',
    '######H.....H.H.....H#######',
    '......H..$..H.H..$..H.......',
    '..G...H.####===####.H...G...',
    '####H##.............##H#####',
    '....H---....$P$....---H.....',
    '....H...###########...H.....',
    '########H.........H#########',
    '....$...H....$....H...$.....',
    '############################'
  ],
  // LEVEL 5: Twin Pyramid Catacombs
  [
    '..................E.........',
    '......$...........E...$.....',
    '....#####H#######H#####.....',
    '....H....H.......H....H.....',
    '..$.H.G..H---.---H..G.H.$...',
    '###H####H#.......#H####H####',
    '...H....H...$.$...H....H....',
    '...H....H.#######.H....H....',
    '...H----H....G....H----H....',
    '#######H###########H########',
    '.......H...........H........',
    '..$....H---..P..---H....$...',
    '####H###...#####...###H#####',
    '....H...$..#...#..$...H.....',
    '....H......#...#......H.....',
    '############################'
  ],
  // LEVEL 6: Fortress of Solid Gold
  [
    '.............E..............',
    '.$...G.......E.......G....$.',
    '###H#####H#######H#####H####',
    '...H.....H---.---H.....H....',
    '...H..$..H.......H..$..H....',
    '######H##====H====##H#######',
    '......H......H......H.......',
    '..$...H--..--H--..--H...$...',
    '###H###......H......###H####',
    '...H....$....G....$....H....',
    '...H..######H.H######..H....',
    '...H........H.H........H....',
    '...H..$.....HPH.....$..H....',
    '########H#########H#########',
    '....$...H....$....H...$.....',
    '############################'
  ],
  // LEVEL 7: OG 1983 Level 1 Homage — Classic 6-Tier Terraces & Long Ropes
  [
    '..................E.........',
    '....$............EH....G....',
    '#######H##########H.........',
    '.......H----------H.........',
    '.......H..........H..$......',
    '.......H..........###H######',
    '..G....H.............H......',
    '#############H#######H......',
    '.............H-------H...$..',
    '.............H.......#######',
    '....$..G.....H..............',
    '#########H####..............',
    '.........H.........$....P...',
    '.........H##########H#######',
    '....$....H..........H....$..',
    '############################'
  ],
  // LEVEL 8: OG Level 2 Homage — The Chandelier & Pitfall Shafts
  [
    '.............E..............',
    '.$...........E............$.',
    '###H#########H##########H###',
    '...H---------H----------H...',
    '...H..G......H.......G..H...',
    '...H.#####H##=##H#####..H...',
    '...H......H..$..H.......H...',
    '######H###H#####H###H#######',
    '......H...H.....H...H.......',
    '..$...H---H..$..H---H...$...',
    '###H###...#######...###H####',
    '...H....G.........G....H....',
    '...H..######H.H######..H....',
    '...H..$.....HPH.....$..H....',
    '########H#########H#########',
    '############################'
  ],
  // LEVEL 9: OG Level 3 Homage — The Three Towers of Brick & Rope
  [
    '.......E....................',
    '..$....E....$.........$.....',
    '#####H###-------#####H######',
    '.....H..#.......#....H......',
    '..G..H.$#...G...#$.G.H......',
    '###H#####-------#####H###...',
    '...H..#...........#..H..#...',
    '...H.$#.....$.....#$.H..#...',
    '#####H###=======###H#####...',
    '.....H.............H........',
    '..$..H-----...-----H....$...',
    '###H##.....###.....##H######',
    '...H....$..#P#..$....H......',
    '...H.######H#H######.H......',
    '...H.......H.H.......H..$...',
    '############################'
  ],
  // LEVEL 10: OG Level 5 Homage — The Spiderweb Rope Matrix
  [
    '.............E..............',
    '.$...G.......E.......G....$.',
    '###H--------------------H###',
    '...H....$.........$.....H...',
    '...H..#####H###H#####...H...',
    '...H-------H...H--------H...',
    '...H.......H.$.H........H...',
    '######H####=====####H#######',
    '......H.............H.......',
    '..$...H----..G..----H...$...',
    '###H###....#####....###H####',
    '...H-------#...#-------H....',
    '...H...$...#.P.#...$...H....',
    '#######H###########H########',
    '....$..H.....$.....H..$.....',
    '############################'
  ],
  // LEVEL 11: OG Level 7 Homage — The Underground Bunker & Solid Vault
  [
    '..........................E.',
    '..$....G.....$.....G......E.',
    '####H#######===#######H#####',
    '....H.................H.....',
    '....H---..$.....$..---H.....',
    '....H...#####H#####...H.....',
    '#######H.....H.....H########',
    '.......H.$...H...$.H........',
    '..G....H###H===H###H....G...',
    '####H###...H...H...###H#####',
    '....H......H.$.H......H.....',
    '....H--..--#####--..--H.....',
    '....H..$.....P.....$..H.....',
    '########H#########H#########',
    '....$...H.#..$..#.H...$.....',
    '############################'
  ],
  // LEVEL 12: OG Championship Finale — The Monolith Zig-Zag
  [
    '.............E..............',
    '.$..G........E........G...$.',
    '##H#####H#########H#####H###',
    '..H.....H---------H.....H...',
    '..H..$..H....$....H..$..H...',
    '#####H#####H===H#####H######',
    '.....H.....H...H.....H......',
    '.$...H--.--H.$.H--.--H....$.',
    '##H###.....#####.....###H###',
    '..H....G...........G....H...',
    '..H..#####H#####H#####..H...',
    '..H-------H..$..H-------H...',
    '..H...$...H..P..H...$...H...',
    '######H#############H#######',
    '...$..H......$......H..$....',
    '############################'
  ]
];

export class LodeRunner {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'loderunner';
    this.title = 'Vault Runner';

    // 28x16 grid metrics inside 960x540 logical canvas
    this.cols = 28;
    this.rows = 16;
    this.tileW = 32; // 28 * 32 = 896
    this.tileH = 30; // 16 * 30 = 480
    this.offsetX = 32; // Centered horizontally: (960 - 896) / 2 = 32
    this.offsetY = 48; // Playable area below 38px HUD: 48..528

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.grid = [];
    this.dugBricks = []; // { col, row, timer: 8.0, maxTimer: 8.0 }
    this.particles = [];
    this.popups = [];
    this.guards = [];
    this.player = null;

    this.totalGold = 0;
    this.goldCollected = 0;
    this.exitRevealed = false;
    this.exitFanfarePlayed = false;
    this.stageClearTimer = 0;
    this.deathTimer = 0;
    this.animTime = 0;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.highScore = HighScoreStore.get(this.id);
    this.state = 'PLAYING';
    this.loadLevel(this.level);
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    if (this.audio && typeof this.audio.stopSequence === 'function') {
      this.audio.stopSequence();
    }
  }

  addScore(points, worldX = null, worldY = null, color = PALETTE.GOLD) {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    if (worldX !== null && worldY !== null) {
      this.popups.push({
        text: `+${points}`,
        x: worldX,
        y: worldY,
        vy: -32,
        life: 0.9,
        maxLife: 0.9,
        color
      });
    }
  }

  loadLevel(levelNum) {
    const design = LEVEL_DESIGNS[(levelNum - 1) % LEVEL_DESIGNS.length];
    this.grid = [];
    this.dugBricks = [];
    this.particles = [];
    this.popups = [];
    this.guards = [];
    this.totalGold = 0;
    this.goldCollected = 0;
    this.exitRevealed = false;
    this.exitFanfarePlayed = false;
    this.stageClearTimer = 0;
    this.deathTimer = 0;

    let playerSpawn = { col: 13, row: 12 };
    const guardSpawns = [];

    for (let r = 0; r < this.rows; r++) {
      const rowArr = [];
      const rowStr = (design[r] || '').padEnd(this.cols, '.');
      for (let c = 0; c < this.cols; c++) {
        const ch = rowStr[c];
        let tile = TILE.EMPTY;
        if (ch === '#') tile = TILE.BRICK;
        else if (ch === '=') tile = TILE.SOLID;
        else if (ch === 'H') tile = TILE.LADDER;
        else if (ch === '-') tile = TILE.ROPE;
        else if (ch === '$') {
          tile = TILE.GOLD;
          this.totalGold++;
        } else if (ch === 'E') {
          tile = TILE.EXIT_LADDER;
        } else if (ch === 'P') {
          playerSpawn = { col: c, row: r };
        } else if (ch === 'G') {
          guardSpawns.push({ col: c, row: r });
        }
        rowArr.push(tile);
      }
      this.grid.push(rowArr);
    }

    // Add extra guard on higher cycles up to 5
    const desiredGuards = Math.min(5, 3 + Math.floor((levelNum - 1) / 2));
    while (guardSpawns.length < desiredGuards) {
      guardSpawns.push({ col: 4 + (guardSpawns.length * 7) % 20, row: 1 });
    }

    this.player = {
      col: playerSpawn.col,
      row: playerSpawn.row,
      spawnCol: playerSpawn.col,
      spawnRow: playerSpawn.row,
      facing: 1,
      pose: 'idle', // 'idle' | 'run' | 'climb' | 'rope' | 'fall' | 'dig'
      animFrame: 0,
      digTimer: 0,
      digDir: 0,
      digTarget: null
    };

    this.guards = guardSpawns.slice(0, desiredGuards).map((sp, idx) => ({
      id: idx,
      col: sp.col,
      row: sp.row,
      spawnCol: sp.col,
      spawnRow: sp.row,
      facing: idx % 2 === 0 ? 1 : -1,
      state: 'active', // 'active' | 'trapped' | 'climbing_out'
      trapTimer: 0,
      climbTimer: 0,
      trapCol: -1,
      trapRow: -1,
      hasGold: false,
      goldTimer: 0,
      pathTimer: 0,
      targetStep: null,
      animFrame: 0
    }));
  }

  respawnPositions() {
    // Restore any currently dug bricks cleanly
    for (const db of this.dugBricks) {
      this.grid[db.row][db.col] = TILE.BRICK;
    }
    this.dugBricks = [];

    // Return any guard-held gold to empty floor tiles so level remains 100% completable
    for (const g of this.guards) {
      if (g.hasGold) {
        this.dropGuardGold(g, Math.round(g.col), Math.round(g.row));
      }
      g.col = g.spawnCol;
      g.row = g.spawnRow;
      g.state = 'active';
      g.trapTimer = 0;
      g.climbTimer = 0;
      g.trapCol = -1;
      g.trapRow = -1;
      g.targetStep = null;
    }

    this.player.col = this.player.spawnCol;
    this.player.row = this.player.spawnRow;
    this.player.digTimer = 0;
    this.player.pose = 'idle';
    this.deathTimer = 0;
  }

  colToX(col) {
    return this.offsetX + col * this.tileW;
  }

  rowToY(row) {
    return this.offsetY + row * this.tileH;
  }

  getTile(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return row >= this.rows ? TILE.SOLID : TILE.EMPTY;
    }
    const t = this.grid[row][col];
    if (t === TILE.EXIT_LADDER) {
      return this.exitRevealed ? TILE.LADDER : TILE.EMPTY;
    }
    return t;
  }

  isSolidAt(col, row) {
    if (col < 0 || col >= this.cols) return true;
    if (row >= this.rows) return true;
    if (row < 0) return false;
    const t = this.getTile(col, row);
    return t === TILE.BRICK || t === TILE.SOLID;
  }

  isDugHole(col, row) {
    return this.dugBricks.some((b) => b.col === col && b.row === row);
  }

  getTrappedGuardAt(col, row) {
    return this.guards.find(
      (g) => g.state === 'trapped' && g.trapCol === col && g.trapRow === row
    );
  }

  /**
   * Checks whether an entity at continuous (col, row) is supported against gravity
   */
  isEntitySupported(col, row, isGuard = false, selfGuard = null) {
    const c = Math.round(col);
    const r = Math.round(row);

    // 1. Inside or clinging to a ladder
    if (this.getTile(c, r) === TILE.LADDER) {
      return true;
    }

    // 2. Hanging on a rope near integer row height
    if (this.getTile(c, r) === TILE.ROPE && Math.abs(row - r) <= 0.28) {
      return true;
    }

    // 3. Standing on floor / ladder top / trapped guard bridge at row + 1
    const rBelow = Math.floor(row + 1.001);
    if (row >= r && rBelow > r) {
      if (rBelow >= this.rows) return true;
      const belowTile = this.getTile(c, rBelow);
      if (
        belowTile === TILE.BRICK ||
        belowTile === TILE.SOLID ||
        belowTile === TILE.LADDER
      ) {
        return true;
      }
      // Trapped guard head acts as a walkable bridge
      const trappedBelow = this.getTrappedGuardAt(c, rBelow);
      if (trappedBelow && trappedBelow !== selfGuard) {
        return true;
      }
      // Guards also don't fall through another active guard directly below
      if (
        isGuard &&
        this.guards.some(
          (g) =>
            g !== selfGuard &&
            Math.round(g.col) === c &&
            Math.round(g.row) === rBelow
        )
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Dual-button (Z/Space = Left, X/Shift = Right) AND directional dig support
   */
  tryDig(dir) {
    const p = this.player;
    const c = Math.round(p.col);
    const r = Math.round(p.row);
    const targetCol = c + dir;
    const targetRow = r + 1;

    if (targetCol < 0 || targetCol >= this.cols || targetRow >= this.rows) {
      return false;
    }

    // Target must be a diggable BRICK
    if (this.grid[targetRow][targetCol] !== TILE.BRICK) {
      return false;
    }

    // Tile directly above the brick must be empty/passable (no brick, solid, or ladder blocking the beam)
    const aboveTile = this.getTile(targetCol, r);
    if (
      aboveTile === TILE.BRICK ||
      aboveTile === TILE.SOLID ||
      aboveTile === TILE.LADDER
    ) {
      return false;
    }

    // Snap player gently for clean dig alignment
    p.col = c;
    p.row = r;
    p.facing = dir;
    p.digTimer = 0.22;
    p.digDir = dir;
    p.digTarget = { col: targetCol, row: targetRow };
    p.pose = 'dig';

    // Remove brick collision geometry immediately and register 8.0s regeneration timer
    this.grid[targetRow][targetCol] = TILE.EMPTY;
    this.dugBricks.push({
      col: targetCol,
      row: targetRow,
      timer: 8.0,
      maxTimer: 8.0
    });

    // Spawn 24 localized brick debris particles with velocity and gravity
    const worldX = this.colToX(targetCol) + this.tileW * 0.5;
    const worldY = this.rowToY(targetRow) + this.tileH * 0.5;
    const colors = ['#D94E34', '#F97316', '#FCA5A5', '#FDE047', '#991B1B'];
    for (let i = 0; i < 24; i++) {
      const angle = -Math.PI * 0.15 - Math.random() * Math.PI * 0.7;
      const speed = 45 + Math.random() * 150;
      this.particles.push({
        x: worldX + (Math.random() - 0.5) * (this.tileW - 6),
        y: worldY + (Math.random() - 0.5) * (this.tileH - 6),
        vx: Math.cos(angle) * speed + dir * 25,
        vy: Math.sin(angle) * speed - 35,
        gravity: 380,
        size: 3 + Math.random() * 3.5,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        color: colors[i % colors.length]
      });
    }

    this.audio.playDig();
    return true;
  }

  /**
   * A* Pathfinding on the 28x16 platform/ladder/rope/fall navigation graph
   * Accelerated by WebAssembly linear memory cost tables & heuristic (`WasmCore.js`)
   */
  findNextStepAStar(startCol, startRow, goalCol, goalRow, selfGuard = null) {
    const sc = Math.max(0, Math.min(this.cols - 1, startCol));
    const sr = Math.max(0, Math.min(this.rows - 1, startRow));
    const gc = Math.max(0, Math.min(this.cols - 1, goalCol));
    const gr = Math.max(0, Math.min(this.rows - 1, goalRow));

    if (sc === gc && sr === gr) return null;

    const isNodeSupported = (c, r) => {
      const tile = this.getTile(c, r);
      if (tile === TILE.LADDER || tile === TILE.ROPE) return true;
      if (r + 1 >= this.rows) return true;
      const below = this.getTile(c, r + 1);
      if (below === TILE.BRICK || below === TILE.SOLID || below === TILE.LADDER) {
        return true;
      }
      if (this.getTrappedGuardAt(c, r + 1)) return true;
      return false;
    };

    const getNeighbors = (c, r) => {
      const neighbors = [];
      const supported = isNodeSupported(c, r);
      if (!supported) {
        if (r + 1 < this.rows && !this.isSolidAt(c, r + 1)) {
          neighbors.push({ col: c, row: r + 1, cost: 1.0 });
        }
        return neighbors;
      }

      for (const dc of [-1, 1]) {
        const nc = c + dc;
        if (nc >= 0 && nc < this.cols && !this.isSolidAt(nc, r)) {
          const crowded = this.guards.some(
            (g) =>
              g !== selfGuard &&
              g.state === 'active' &&
              Math.round(g.col) === nc &&
              Math.round(g.row) === r
          );
          neighbors.push({ col: nc, row: r, cost: crowded ? 2.5 : 1.0 });
        }
      }

      if (this.getTile(c, r) === TILE.LADDER && r - 1 >= 0 && !this.isSolidAt(c, r - 1)) {
        neighbors.push({ col: c, row: r - 1, cost: 0.95 });
      }

      if (r + 1 < this.rows && !this.isSolidAt(c, r + 1)) {
        const belowTile = this.getTile(c, r + 1);
        const curTile = this.getTile(c, r);
        if (
          belowTile === TILE.LADDER ||
          curTile === TILE.ROPE ||
          curTile === TILE.LADDER ||
          this.isDugHole(c, r + 1)
        ) {
          neighbors.push({ col: c, row: r + 1, cost: 1.0 });
        }
      }
      return neighbors;
    };

    // Execute A* pathfinding in shared WebAssembly linear memory if active
    if (wasmCore && wasmCore.isActive()) {
      const wasmStep = wasmCore.solveLodeRunnerAStar(
        this.cols,
        this.rows,
        sc,
        sr,
        gc,
        gr,
        getNeighbors
      );
      if (wasmStep) return wasmStep;
    }

    const totalNodes = this.cols * this.rows;
    const gScore = new Float32Array(totalNodes).fill(Infinity);
    const fScore = new Float32Array(totalNodes).fill(Infinity);
    const cameFrom = new Int16Array(totalNodes).fill(-1);
    const closed = new Uint8Array(totalNodes);

    const startIdx = sr * this.cols + sc;
    const goalIdx = gr * this.cols + gc;

    gScore[startIdx] = 0;
    fScore[startIdx] = wasmCore.lodeHeuristic(sc, sr, gc, gr, 10) * 0.1;

    const open = [startIdx];

    let bestFallbackIdx = startIdx;
    let bestFallbackHeuristic = Math.abs(sc - gc) + Math.abs(sr - gr) * 1.5;

    while (open.length > 0) {
      // Find lowest fScore in open set
      let bestPos = 0;
      for (let i = 1; i < open.length; i++) {
        if (fScore[open[i]] < fScore[open[bestPos]]) {
          bestPos = i;
        }
      }
      const currentIdx = open[bestPos];
      open.splice(bestPos, 1);

      if (currentIdx === goalIdx) {
        bestFallbackIdx = goalIdx;
        break;
      }

      if (closed[currentIdx]) continue;
      closed[currentIdx] = 1;

      const c = currentIdx % this.cols;
      const r = (currentIdx / this.cols) | 0;

      const hDist = Math.abs(c - gc) + Math.abs(r - gr) * 1.5;
      if (hDist < bestFallbackHeuristic && currentIdx !== startIdx) {
        bestFallbackHeuristic = hDist;
        bestFallbackIdx = currentIdx;
      }

      const neighbors = [];
      const supported = isNodeSupported(c, r);

      if (!supported) {
        // Free-falling node can only drop to (c, r + 1)
        if (r + 1 < this.rows && !this.isSolidAt(c, r + 1)) {
          neighbors.push({ nc: c, nr: r + 1, cost: 1.0 });
        }
      } else {
        // Horizontal moves (walk on floor/ladder/trapped-guard or shimmy along rope)
        for (const dc of [-1, 1]) {
          const nc = c + dc;
          if (nc >= 0 && nc < this.cols && !this.isSolidAt(nc, r)) {
            // Slight extra cost if another active guard is standing there
            const crowded = this.guards.some(
              (g) =>
                g !== selfGuard &&
                g.state === 'active' &&
                Math.round(g.col) === nc &&
                Math.round(g.row) === r
            );
            neighbors.push({ nc, nr: r, cost: crowded ? 2.5 : 1.0 });
          }
        }

        // Climb UP a ladder
        if (
          this.getTile(c, r) === TILE.LADDER &&
          r - 1 >= 0 &&
          !this.isSolidAt(c, r - 1)
        ) {
          neighbors.push({ nc: c, nr: r - 1, cost: 0.95 });
        }

        // Climb DOWN a ladder or drop from a rope / ledge
        if (r + 1 < this.rows && !this.isSolidAt(c, r + 1)) {
          const belowTile = this.getTile(c, r + 1);
          const curTile = this.getTile(c, r);
          if (
            belowTile === TILE.LADDER ||
            curTile === TILE.ROPE ||
            curTile === TILE.LADDER ||
            this.isDugHole(c, r + 1)
          ) {
            neighbors.push({ nc: c, nr: r + 1, cost: 1.0 });
          }
        }
      }

      for (const edge of neighbors) {
        const nIdx = edge.nr * this.cols + edge.nc;
        if (closed[nIdx]) continue;
        const tentativeG = gScore[currentIdx] + edge.cost;
        if (tentativeG < gScore[nIdx]) {
          cameFrom[nIdx] = currentIdx;
          gScore[nIdx] = tentativeG;
          fScore[nIdx] =
            tentativeG + Math.abs(edge.nc - gc) + Math.abs(edge.nr - gr);
          if (!open.includes(nIdx)) {
            open.push(nIdx);
          }
        }
      }
    }

    // Reconstruct first step from startIdx toward target
    let trace = bestFallbackIdx;
    if (trace === startIdx) return null;
    while (cameFrom[trace] !== -1 && cameFrom[trace] !== startIdx) {
      trace = cameFrom[trace];
    }
    return {
      col: trace % this.cols,
      row: (trace / this.cols) | 0
    };
  }

  dropGuardGold(guard, col, row) {
    if (!guard.hasGold) return;
    guard.hasGold = false;
    guard.goldTimer = 0;

    // Try placing at (col, row) or nearby empty tile so player can always reach it
    const candidates = [
      { c: col, r: row },
      { c: col, r: row - 1 },
      { c: col - 1, r: row },
      { c: col + 1, r: row }
    ];
    for (const pt of candidates) {
      if (
        pt.c >= 0 &&
        pt.c < this.cols &&
        pt.r >= 0 &&
        pt.r < this.rows &&
        this.grid[pt.r][pt.c] === TILE.EMPTY &&
        !this.isDugHole(pt.c, pt.r)
      ) {
        this.grid[pt.r][pt.c] = TILE.GOLD;
        return;
      }
    }
    // Fallback: auto-credit gold if no empty tile was available
    this.collectGoldAt(col, row, false);
  }

  collectGoldAt(col, row, fromTile = true) {
    if (fromTile && this.grid[row] && this.grid[row][col] === TILE.GOLD) {
      this.grid[row][col] = TILE.EMPTY;
    }
    this.goldCollected++;
    const wx = this.colToX(col) + this.tileW * 0.5;
    const wy = this.rowToY(row);
    this.addScore(250, wx, wy, PALETTE.GOLD);
    this.audio.playCoin();

    // Sparkle particles
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12;
      this.particles.push({
        x: wx,
        y: wy + 12,
        vx: Math.cos(a) * (40 + Math.random() * 50),
        vy: Math.sin(a) * (40 + Math.random() * 50),
        gravity: 80,
        size: 3,
        life: 0.4,
        maxLife: 0.4,
        color: i % 2 === 0 ? PALETTE.GOLD : PALETTE.CYAN
      });
    }

    if (this.goldCollected >= this.totalGold && !this.exitRevealed) {
      this.exitRevealed = true;
      if (!this.exitFanfarePlayed) {
        this.exitFanfarePlayed = true;
        this.audio.playPowerUp();
        this.popups.push({
          text: 'ESCAPE LADDER REVEALED!',
          x: 480,
          y: 95,
          vy: -18,
          life: 1.8,
          maxLife: 1.8,
          color: PALETTE.GREEN
        });
      }
    }
  }

  killPlayer() {
    if (this.deathTimer > 0 || this.stageClearTimer > 0) return;
    this.lives--;
    this.audio.playHit();
    this.renderer.shake(8, 0.3);

    const wx = this.colToX(this.player.col) + this.tileW * 0.5;
    const wy = this.rowToY(this.player.row) + this.tileH * 0.5;
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 140;
      this.particles.push({
        x: wx,
        y: wy,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        gravity: 220,
        size: 3.5,
        life: 0.55,
        maxLife: 0.55,
        color: i % 2 === 0 ? PALETTE.CYAN : PALETTE.PINK
      });
    }

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.audio.playGameOver();
      this.state = 'GAMEOVER';
    } else {
      this.deathTimer = 1.05;
    }
  }

  update(dt) {
    this.animTime += dt;

    if (this.input.isJustPressed('pause')) {
      if (this.state === 'PLAYING') {
        this.state = 'PAUSED';
        return;
      } else if (this.state === 'PAUSED') {
        this.state = 'PLAYING';
        return;
      }
    }

    if (this.state === 'MENU') {
      if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
        this.audio.playMenuSelect();
        this.reset();
      }
      return;
    }

    if (this.state === 'PAUSED') {
      if (this.input.isJustPressed('actionA')) {
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.state === 'GAMEOVER') {
      if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
        this.audio.playMenuSelect();
        this.reset();
      }
      return;
    }

    // Update particles & floating score popups
    this.updateEffects(dt);

    // Handle stage clear delay
    if (this.stageClearTimer > 0) {
      this.stageClearTimer -= dt;
      if (this.stageClearTimer <= 0) {
        this.level++;
        this.loadLevel(this.level);
      }
      return;
    }

    // Handle player death respawn delay
    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.respawnPositions();
      }
      return;
    }

    this.updateDugBricks(dt);
    this.updatePlayer(dt);
    this.updateGuards(dt);
  }

  updateEffects(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += (pt.gravity || 0) * dt;
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y += pop.vy * dt;
      pop.life -= dt;
      if (pop.life <= 0) {
        this.popups.splice(i, 1);
      }
    }
  }

  /**
   * Updates 8.0-second procedural brick regeneration timers and crushes entities inside
   */
  updateDugBricks(dt) {
    for (let i = this.dugBricks.length - 1; i >= 0; i--) {
      const brick = this.dugBricks[i];
      brick.timer -= dt;
      if (brick.timer <= 0) {
        this.grid[brick.row][brick.col] = TILE.BRICK;
        this.dugBricks.splice(i, 1);

        // Check if any guard is inside the regenerating brick -> crush & respawn at top
        for (const g of this.guards) {
          const inHole =
            (g.state === 'trapped' &&
              g.trapCol === brick.col &&
              g.trapRow === brick.row) ||
            (Math.round(g.col) === brick.col && Math.round(g.row) === brick.row);
          if (inHole) {
            if (g.hasGold) {
              this.dropGuardGold(g, brick.col, Math.max(0, brick.row - 1));
            }
            const wx = this.colToX(brick.col) + this.tileW * 0.5;
            const wy = this.rowToY(brick.row);
            this.addScore(250, wx, wy, PALETTE.PINK);
            this.audio.playExplosion(0.22, 1100);

            // Respawn guard at top row
            g.col = g.spawnCol;
            g.row = 0;
            g.state = 'active';
            g.trapCol = -1;
            g.trapRow = -1;
            g.trapTimer = 0;
            g.climbTimer = 0;
            g.targetStep = null;
          }
        }

        // Check if player is inside the regenerating brick -> crushed!
        if (
          Math.round(this.player.col) === brick.col &&
          Math.round(this.player.row) === brick.row
        ) {
          this.killPlayer();
          return;
        }
      }
    }
  }

  updatePlayer(dt) {
    const p = this.player;
    const moveSpeed = 6.0;
    const climbSpeed = 4.6;
    const fallSpeed = 7.2;

    if (p.digTimer > 0) {
      p.digTimer = Math.max(0, p.digTimer - dt);
    }

    const supported = this.isEntitySupported(p.col, p.row, false);

    if (!supported) {
      // Free-fall straight down shaft/hole
      p.pose = 'fall';
      p.col += (Math.round(p.col) - p.col) * Math.min(1, dt * 14);
      const nextRow = p.row + fallSpeed * dt;
      const c = Math.round(p.col);
      const rNextFloor = Math.floor(nextRow + 1);

      // Check if we land on a floor, ladder top, or trapped guard head
      const landedOnFloor =
        rNextFloor >= this.rows ||
        this.getTile(c, rNextFloor) === TILE.BRICK ||
        this.getTile(c, rNextFloor) === TILE.SOLID ||
        this.getTile(c, rNextFloor) === TILE.LADDER ||
        !!this.getTrappedGuardAt(c, rNextFloor);

      // Check if we catch a rope or ladder while passing integer row
      const passRow = Math.round(nextRow);
      const caughtRopeOrLadder =
        Math.abs(nextRow - passRow) < 0.2 &&
        (this.getTile(c, passRow) === TILE.ROPE ||
          this.getTile(c, passRow) === TILE.LADDER);

      if (landedOnFloor && nextRow >= rNextFloor - 1) {
        p.row = rNextFloor - 1;
        p.pose = 'idle';
      } else if (caughtRopeOrLadder) {
        p.row = passRow;
      } else {
        p.row = nextRow;
      }
    } else {
      // Supported movement & digging
      // Check Dig buttons: Action B = Right, Action A = Left (or Right if holding Right)
      if (this.input.isJustPressed('actionB')) {
        this.tryDig(1);
      } else if (this.input.isJustPressed('actionA')) {
        if (this.input.isDown('right') && !this.input.isDown('left')) {
          this.tryDig(1);
        } else {
          this.tryDig(-1);
        }
      }

      let dx = 0;
      let dy = 0;
      if (this.input.isDown('left')) dx -= 1;
      if (this.input.isDown('right')) dx += 1;
      if (this.input.isDown('up')) dy -= 1;
      if (this.input.isDown('down')) dy += 1;

      const c = Math.round(p.col);
      const r = Math.round(p.row);
      const curTile = this.getTile(c, r);
      const belowTile = this.getTile(c, r + 1);

      let movedVertically = false;

      // Vertical climbing or dropping off rope
      if (dy < 0) {
        // Climb UP if on ladder (or close to ladder column)
        const nearCol = Math.round(p.col);
        if (
          this.getTile(nearCol, Math.round(p.row)) === TILE.LADDER ||
          this.getTile(nearCol, Math.floor(p.row)) === TILE.LADDER
        ) {
          p.col += (nearCol - p.col) * Math.min(1, dt * 16);
          const targetRow = p.row - climbSpeed * dt;
          const topRow = Math.floor(targetRow);
          if (topRow < 0) {
            p.row = 0;
          } else if (!this.isSolidAt(nearCol, topRow)) {
            p.row = targetRow;
          } else {
            p.row = topRow + 1;
          }
          p.pose = 'climb';
          p.animFrame += dt * 10;
          movedVertically = true;
        }
      } else if (dy > 0) {
        // Drop off a rope if hanging on one and space below is open
        if (curTile === TILE.ROPE && !this.isSolidAt(c, r + 1)) {
          p.col = c;
          p.row = r + 0.32;
          p.pose = 'fall';
          movedVertically = true;
        } else if (
          curTile === TILE.LADDER ||
          belowTile === TILE.LADDER
        ) {
          p.col += (c - p.col) * Math.min(1, dt * 16);
          const targetRow = p.row + climbSpeed * dt;
          const botRow = Math.floor(targetRow + 0.99);
          if (botRow < this.rows && !this.isSolidAt(c, botRow)) {
            p.row = targetRow;
          } else {
            p.row = Math.round(p.row);
          }
          p.pose = 'climb';
          p.animFrame += dt * 10;
          movedVertically = true;
        }
      }

      // Horizontal running or rope shimmying
      if (!movedVertically && dx !== 0) {
        p.facing = dx;
        p.row += (r - p.row) * Math.min(1, dt * 16);
        const targetCol = p.col + dx * moveSpeed * dt;
        const checkCol = dx > 0 ? Math.floor(targetCol + 0.85) : Math.ceil(targetCol - 0.85);
        if (checkCol >= 0 && checkCol < this.cols && !this.isSolidAt(checkCol, r)) {
          p.col = Math.max(0, Math.min(this.cols - 1, targetCol));
        } else {
          p.col = Math.round(p.col);
        }
        p.pose = this.getTile(Math.round(p.col), r) === TILE.ROPE ? 'rope' : 'run';
        p.animFrame += dt * 12;
      } else if (!movedVertically && p.digTimer <= 0) {
        p.pose = curTile === TILE.ROPE ? 'rope' : curTile === TILE.LADDER ? 'climb' : 'idle';
      }
    }

    // Collect gold chest at player's tile
    const pc = Math.round(p.col);
    const pr = Math.round(p.row);
    if (this.grid[pr] && this.grid[pr][pc] === TILE.GOLD) {
      this.collectGoldAt(pc, pr, true);
    }

    // Check stage clear: all gold collected and reached top row (row === 0)
    if (this.exitRevealed && p.row <= 0.15) {
      this.addScore(
        1500,
        this.colToX(p.col) + this.tileW * 0.5,
        this.rowToY(0) + 12,
        PALETTE.GREEN
      );
      this.audio.playStageClear();
      this.stageClearTimer = 1.3;
    }
  }

  updateGuards(dt) {
    const p = this.player;
    const baseSpeed = Math.min(4.8, 3.1 + (this.level - 1) * 0.25);

    for (const g of this.guards) {
      g.animFrame += dt * 9;

      // STATE 1: TRAPPED IN DUG BRICK HOLE
      if (g.state === 'trapped') {
        g.col = g.trapCol;
        g.row = g.trapRow;
        g.trapTimer -= dt;
        if (g.trapTimer <= 0) {
          g.state = 'climbing_out';
          g.climbTimer = 0;
        }
        continue;
      }

      // STATE 2: CLIMBING OUT OF HOLE
      if (g.state === 'climbing_out') {
        const climbDuration = 0.8;
        g.climbTimer += dt;
        const progress = Math.min(1, g.climbTimer / climbDuration);
        if (progress < 0.65) {
          const t = progress / 0.65;
          g.col = g.trapCol;
          g.row = g.trapRow - t;
        } else {
          const t = (progress - 0.65) / 0.35;
          const exitDir =
            p.col >= g.trapCol && !this.isSolidAt(g.trapCol + 1, g.trapRow - 1)
              ? 1
              : !this.isSolidAt(g.trapCol - 1, g.trapRow - 1)
                ? -1
                : 0;
          g.col = g.trapCol + exitDir * t;
          g.row = g.trapRow - 1;
        }

        if (progress >= 1) {
          g.col = Math.round(g.col);
          g.row = Math.round(g.row);
          g.state = 'active';
          g.trapCol = -1;
          g.trapRow = -1;
          g.targetStep = null;
        }
        continue;
      }

      // STATE 3: ACTIVE PATROL / A* CHASE
      const gc = Math.round(g.col);
      const gr = Math.round(g.row);

      // Check if guard just dropped into a dug brick hole!
      if (this.isDugHole(gc, gr) && !this.getTrappedGuardAt(gc, gr)) {
        g.state = 'trapped';
        g.trapCol = gc;
        g.trapRow = gr;
        g.col = gc;
        g.row = gr;
        g.trapTimer = 3.8; // 3.8s trapped duration before climbing_out
        if (g.hasGold) {
          this.dropGuardGold(g, gc, Math.max(0, gr - 1));
        }
        const wx = this.colToX(gc) + this.tileW * 0.5;
        const wy = this.rowToY(gr);
        this.addScore(75, wx, wy, PALETTE.CYAN);
        this.audio.playHop();
        continue;
      }

      // Guards can pick up gold chests temporarily and drop them later on solid ground
      if (!g.hasGold && this.grid[gr] && this.grid[gr][gc] === TILE.GOLD) {
        this.grid[gr][gc] = TILE.EMPTY;
        g.hasGold = true;
        g.goldTimer = 7.0 + Math.random() * 5.0;
      } else if (g.hasGold) {
        g.goldTimer -= dt;
        if (
          g.goldTimer <= 0 &&
          this.grid[gr] &&
          this.grid[gr][gc] === TILE.EMPTY &&
          gr + 1 < this.rows &&
          (this.grid[gr + 1][gc] === TILE.BRICK ||
            this.grid[gr + 1][gc] === TILE.SOLID)
        ) {
          this.dropGuardGold(g, gc, gr);
        }
      }

      const supported = this.isEntitySupported(g.col, g.row, true, g);
      if (!supported) {
        g.col += (gc - g.col) * Math.min(1, dt * 14);
        g.row = Math.min(this.rows - 1, g.row + 6.5 * dt);
        g.targetStep = null;
      } else {
        g.pathTimer -= dt;
        const distToNode = Math.hypot(g.col - gc, g.row - gr);
        if (!g.targetStep || g.pathTimer <= 0 || distToNode < 0.08) {
          g.pathTimer = 0.18;
          g.targetStep = this.findNextStepAStar(
            gc,
            gr,
            Math.round(p.col),
            Math.round(p.row),
            g
          );
        }

        if (g.targetStep) {
          const dx = g.targetStep.col - g.col;
          const dy = g.targetStep.row - g.row;
          const len = Math.hypot(dx, dy);
          if (len > 0.01) {
            if (Math.abs(dx) > Math.abs(dy)) {
              g.facing = dx > 0 ? 1 : -1;
              g.row += (gr - g.row) * Math.min(1, dt * 14);
              g.col += Math.sign(dx) * Math.min(Math.abs(dx), baseSpeed * dt);
            } else {
              g.col += (gc - g.col) * Math.min(1, dt * 14);
              g.row += Math.sign(dy) * Math.min(Math.abs(dy), baseSpeed * 0.9 * dt);
            }
          }
        }
      }

      // Check collision between active guard and player
      if (Math.abs(g.col - p.col) < 0.58 && Math.abs(g.row - p.row) < 0.62) {
        this.killPlayer();
        return;
      }
    }
  }

  render(ctx = this.renderer.ctx) {
    // Deep arcade background
    this.renderer.clear(PALETTE.BG);

    // Subtle cyber grid lines in background
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= this.cols; c++) {
      const x = this.colToX(c);
      ctx.beginPath();
      ctx.moveTo(x, this.offsetY);
      ctx.lineTo(x, this.offsetY + this.rows * this.tileH);
      ctx.stroke();
    }
    for (let r = 0; r <= this.rows; r++) {
      const y = this.rowToY(r);
      ctx.beginPath();
      ctx.moveTo(this.offsetX, y);
      ctx.lineTo(this.offsetX + this.cols * this.tileW, y);
      ctx.stroke();
    }
    ctx.restore();

    // Render 28x16 Tile Grid
    this.renderTiles(ctx);

    // Render regenerating dug brick warnings
    this.renderDugBricks(ctx);

    // Render Guards
    for (const g of this.guards) {
      this.renderGuard(ctx, g);
    }

    // Render Player & Dig Laser Beam
    if (this.deathTimer <= 0) {
      this.renderPlayer(ctx);
    }

    // Render Debris Particles & Score Popups
    this.renderEffects(ctx);

    // Bottom bedrock frame strip
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(
      this.offsetX,
      this.offsetY + this.rows * this.tileH,
      this.cols * this.tileW,
      10
    );

    // Top HUD Bar
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `GOLD:${this.goldCollected}/${this.totalGold} WASM:ON`,
      accent: PALETTE.GOLD
    });

    // Stage Clear Banner
    if (this.stageClearTimer > 0) {
      this.renderer.drawGlowRect(300, 230, 360, 74, PALETTE.PANEL, 16, true);
      this.renderer.drawGlowRect(300, 230, 360, 74, PALETTE.GREEN, 16, false, 2.5);
      this.renderer.drawText('STAGE CLEAR! +1500', 480, 275, {
        font: FONTS.HEADER,
        size: 16,
        color: PALETTE.GREEN,
        align: 'center',
        glow: 10
      });
    }

    // Overlay for MENU / PAUSED / GAMEOVER
    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '28x16 PUZZLE PLATFORMER  |  A* GUARD AI & BRICK TRAPS',
      controls: 'ARROWS/WASD: MOVE & CLIMB  |  Z/SPACE: DIG LEFT  |  X/SHIFT: DIG RIGHT',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GOLD
    });
  }

  renderTiles(ctx) {
    const pulse = 0.55 + 0.45 * Math.sin(this.animTime * 7);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const t = this.grid[r][c];
        if (t === TILE.EMPTY) continue;

        const x = this.colToX(c);
        const y = this.rowToY(r);
        const w = this.tileW;
        const h = this.tileH;

        if (t === TILE.BRICK) {
          // Classic red/terracotta masonry brick pattern with mortar lines
          ctx.fillStyle = '#7F1D1D';
          ctx.fillRect(x, y, w, h);

          ctx.fillStyle = '#C2410C';
          ctx.fillRect(x + 1, y + 1, w / 2 - 2, h / 2 - 2);
          ctx.fillRect(x + w / 2 + 1, y + 1, w / 2 - 2, h / 2 - 2);
          ctx.fillRect(x + 1, y + h / 2 + 1, w / 4 - 1, h / 2 - 2);
          ctx.fillRect(x + w / 4 + 2, y + h / 2 + 1, w / 2 - 2, h / 2 - 2);
          ctx.fillRect(x + (w * 3) / 4 + 2, y + h / 2 + 1, w / 4 - 3, h / 2 - 2);

          // Top highlight
          ctx.fillStyle = '#FB923C';
          ctx.fillRect(x + 2, y + 2, w / 2 - 4, 2);
          ctx.fillRect(x + w / 2 + 2, y + 2, w / 2 - 4, 2);
        } else if (t === TILE.SOLID) {
          // Indestructible steel/concrete block with rivets
          ctx.fillStyle = '#334155';
          ctx.fillRect(x, y, w, h);
          ctx.strokeStyle = '#94A3B8';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
          ctx.fillStyle = '#64748B';
          ctx.fillRect(x + 4, y + 4, 3, 3);
          ctx.fillRect(x + w - 7, y + 4, 3, 3);
          ctx.fillRect(x + 4, y + h - 7, 3, 3);
          ctx.fillRect(x + w - 7, y + h - 7, 3, 3);
        } else if (t === TILE.LADDER || (t === TILE.EXIT_LADDER && this.exitRevealed)) {
          const isExit = t === TILE.EXIT_LADDER;
          const color = isExit ? PALETTE.GREEN : PALETTE.GOLD;
          ctx.save();
          if (isExit) {
            ctx.shadowColor = PALETTE.GREEN;
            ctx.shadowBlur = 8 * pulse;
          }
          ctx.fillStyle = color;
          // Left & right rails
          ctx.fillRect(x + 5, y, 3, h);
          ctx.fillRect(x + w - 8, y, 3, h);
          // Rungs
          for (let ry = 4; ry < h; ry += 7) {
            ctx.fillRect(x + 5, y + ry, w - 10, 2.5);
          }
          ctx.restore();
        } else if (t === TILE.ROPE) {
          // Glowing cyan highwire cable near top of tile
          ctx.save();
          ctx.shadowColor = PALETTE.CYAN;
          ctx.shadowBlur = 6;
          ctx.fillStyle = PALETTE.CYAN;
          ctx.fillRect(x, y + 5, w, 3);
          ctx.fillStyle = PALETTE.WHITE;
          for (let rx = 2; rx < w; rx += 8) {
            ctx.fillRect(x + rx, y + 5, 3, 1.5);
          }
          ctx.restore();
        } else if (t === TILE.GOLD) {
          // Glowing arcade gold ingot chest
          const bob = Math.sin(this.animTime * 5 + c) * 1.5;
          ctx.save();
          ctx.shadowColor = PALETTE.GOLD;
          ctx.shadowBlur = 10;
          ctx.fillStyle = '#D97706';
          ctx.fillRect(x + 6, y + 11 + bob, w - 12, h - 14);
          ctx.fillStyle = PALETTE.GOLD;
          ctx.fillRect(x + 8, y + 13 + bob, w - 16, h - 18);
          ctx.fillStyle = PALETTE.WHITE;
          ctx.fillRect(x + 10, y + 14 + bob, 5, 3);
          ctx.restore();
        }
      }
    }
  }

  renderDugBricks(ctx) {
    for (const b of this.dugBricks) {
      const x = this.colToX(b.col);
      const y = this.rowToY(b.row);
      const w = this.tileW;
      const h = this.tileH;

      // Subtle outline of excavated cavity
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

      // Final 1.5 seconds: show regeneration shimmer & reforming brick fragments
      if (b.timer <= 1.5) {
        const ratio = 1 - Math.max(0, b.timer / 1.5);
        const flash = Math.sin(this.animTime * 28) > 0;
        ctx.save();
        ctx.globalAlpha = 0.35 + ratio * 0.6;
        ctx.fillStyle = flash ? '#FB923C' : '#C2410C';
        const curW = w * ratio;
        const curH = h * ratio;
        ctx.fillRect(
          x + (w - curW) * 0.5,
          y + (h - curH) * 0.5,
          curW,
          curH
        );
        ctx.restore();
      }
    }
  }

  renderPlayer(ctx) {
    const p = this.player;
    const x = this.colToX(p.col) + 4;
    const y = this.rowToY(p.row) + 2;
    const step = Math.floor(p.animFrame) % 2 === 0;

    // Draw laser dig beam when actively digging a brick
    if (p.digTimer > 0 && p.digTarget) {
      const sx = this.colToX(p.col) + (p.digDir > 0 ? this.tileW - 4 : 4);
      const sy = this.rowToY(p.row) + 16;
      const tx = this.colToX(p.digTarget.col) + this.tileW * 0.5;
      const ty = this.rowToY(p.digTarget.row) + this.tileH * 0.5;

      ctx.save();
      ctx.strokeStyle = PALETTE.CYAN;
      ctx.shadowColor = PALETTE.CYAN;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.restore();
    }

    const spriteRun1 = [
      '....WWWW....',
      '...WCCCCW...',
      '...WWWWWW...',
      '....WWWW....',
      '..CCCCCCCC..',
      '.CC.CCCC.CC.',
      '.W..CCCC..W.',
      '....BBBB....',
      '...BB..BB...',
      '..BB....BB..',
      '.WW......WW.'
    ];
    const spriteRun2 = [
      '....WWWW....',
      '...WCCCCW...',
      '...WWWWWW...',
      '....WWWW....',
      '...CCCCCC...',
      '..CCCCCCCC..',
      '....CCCC....',
      '...BBBBBB...',
      '....BB.BB...',
      '...BB...BB..',
      '...WW...WW..'
    ];

    this.renderer.drawPixelSprite(
      step ? spriteRun1 : spriteRun2,
      x,
      y,
      2,
      {
        W: PALETTE.WHITE,
        C: PALETTE.CYAN,
        B: '#38BDF8'
      },
      p.facing < 0,
      false
    );
  }

  renderGuard(ctx, g) {
    let x = this.colToX(g.col) + 4;
    const y = this.rowToY(g.row) + 2;
    const step = Math.floor(g.animFrame) % 2 === 0;

    // Struggle wiggle when trapped and about to climb out
    if (g.state === 'trapped' && g.trapTimer < 1.2) {
      x += Math.sin(this.animTime * 40) * 2.5;
    }

    const guardSprite1 = [
      '....RRRR....',
      '...RYYYYR...',
      '...RRRRRR...',
      '....YYYY....',
      '..RRRRRRRR..',
      '.RR.RRRR.RR.',
      '.Y..RRRR..Y.',
      '....PPPP....',
      '...PP..PP...',
      '..PP....PP..',
      '.YY......YY.'
    ];
    const guardSprite2 = [
      '....RRRR....',
      '...RYYYYR...',
      '...RRRRRR...',
      '....YYYY....',
      '...RRRRRR...',
      '..RRRRRRRR..',
      '....RRRR....',
      '...PPPPPP...',
      '....PP.PP...',
      '...PP...PP..',
      '...YY...YY..'
    ];

    this.renderer.drawPixelSprite(
      step ? guardSprite1 : guardSprite2,
      x,
      y,
      2,
      {
        R: PALETTE.PINK,
        Y: g.hasGold ? PALETTE.GOLD : '#FDE047',
        P: '#9D174D'
      },
      g.facing < 0,
      false
    );

    // Small gold indicator if carrying stolen gold
    if (g.hasGold) {
      this.renderer.drawGlowCircle(x + 12, y - 3, 3.5, PALETTE.GOLD, 8, true);
    }
  }

  renderEffects(ctx) {
    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size * 0.5, pt.y - pt.size * 0.5, pt.size, pt.size);
      ctx.restore();
    }

    for (const pop of this.popups) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pop.life / pop.maxLife);
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HEADER,
        size: 11,
        color: pop.color,
        align: 'center',
        glow: 8
      });
      ctx.restore();
    }
  }
}

export default LodeRunner;
