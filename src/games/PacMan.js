/**
 * PacMan.js
 * Flagship Arcade Maze Chase — PAC-MAN & MS. PAC-MAN Dual Variant Edition
 *
 * Features:
 * - Instant toggle (Action B: X / Shift) between PAC-MAN and MS. PAC-MAN variants
 *   (signature red bow & beauty mark, dynamic maze color themes, wandering bouncing fruit,
 *   and Ms. Pac-Man semi-random ghost scatter/chase behavior).
 * - Authentic 4-Ghost AI Target Tile Logic:
 *   1. Blinky (Red #FF2A55): Direct chase targeting player's current tile (pacCol, pacRow).
 *   2. Pinky (Pink #FF77C8): Ambush targeting 4 tiles ahead of player's facing direction.
 *   3. Inky (Cyan #00F0FF): Flanking vector doubling the line from Blinky through 2 tiles ahead of player.
 *   4. Clyde (Orange #FF9900): Chases directly when Euclidean distance > 8 tiles; retreats to bottom-left corner within 8 tiles.
 * - Power Pellets & Frightened Mode:
 *   - Duration scales down per round: max(2.0, 8.0 - (level - 1) * 0.85)s, flashing white/blue in last 2.0s.
 *   - Cascading ghost eat multipliers: 200 -> 400 -> 800 -> 1600 pts with disembodied eyes racing back to the Ghost House.
 * - Pre-turn input buffering, swipe gesture support, warp tunnels, and procedural Waka/Siren audio.
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const TILE_SIZE = 20;
const COLS = 29;
const ROWS = 23;
const MAZE_WIDTH = COLS * TILE_SIZE;  // 580
const MAZE_HEIGHT = ROWS * TILE_SIZE; // 460
const MAZE_OFFSET_X = Math.floor((960 - MAZE_WIDTH) / 2); // 190
const MAZE_OFFSET_Y = 48;

const DIRS = {
  NONE:  { x: 0,  y: 0,  name: 'NONE',  angle: 0 },
  LEFT:  { x: -1, y: 0,  name: 'LEFT',  angle: Math.PI },
  RIGHT: { x: 1,  y: 0,  name: 'RIGHT', angle: 0 },
  UP:    { x: 0,  y: -1, name: 'UP',    angle: -Math.PI / 2 },
  DOWN:  { x: 0,  y: 1,  name: 'DOWN',  angle: Math.PI / 2 }
};

const DIR_LIST = [DIRS.UP, DIRS.LEFT, DIRS.DOWN, DIRS.RIGHT];

// 29x23 Symmetric Arcade Maze Layouts
// Legend: '#' Wall, '.' Pac-Dot, 'o' Power Pellet, '-' Ghost House Door, ' ' Empty / Tunnel
const MAZE_TEMPLATES = [
  // Maze 0: Classic Pac-Man Layout
  [
    '#############################',
    '#.............#.............#',
    '#o####.#####.#.#####.####o#',
    '#.####.#####.#.#####.####.#',
    '#...........................#',
    '#.####.#.#########.#.####.#',
    '#......#.....#.....#......#',
    '######.##### # #####.######',
    '     #.#           #.#     ',
    '######.# ####-#### #.######',
    '      .  #       #  .      ',
    '######.# ######### #.######',
    '     #.#           #.#     ',
    '######.# ######### #.######',
    '#............#............#',
    '#.####.#####.#.#####.####.#',
    '#o..##....... .......##..o#',
    '###.##.#.#########.#.##.###',
    '#......#.....#.....#......#',
    '#.##########.#.##########.#',
    '#...........................#',
    '#############################',
    '                             '
  ],
  // Maze 1: Ms. Pac-Man Dual-Tunnel Championship Layout
  [
    '#############################',
    '#o.....#####.#.#####.....o#',
    '#.####.#####.#.#####.####.#',
    '#.#..#...............#..#.#',
    '#.#..#.###.#####.###.#..#.#',
    '#......#.....#.....#......#',
    '   ###.#.#########.#.###   ',
    '######.#     #     #.######',
    '#......##### # #####......#',
    '#.####.# ####-#### #.####.#',
    '      .  #       #  .      ',
    '#.####.# ######### #.####.#',
    '#......#           #......#',
    '######.#.#########.#######',
    '   ###.#.....#.....#.###   ',
    '#......#####.#.#####......#',
    '#.####....... .......####.#',
    '#.#..#.#####.#.#####.#..#.#',
    '#o#..#.......#.......#..#o#',
    '#.##########.#.##########.#',
    '#...........................#',
    '#############################',
    '                             '
  ],
  // Maze 2: Ms. Pac-Man Stage 2 Emerald Cross-Corridor Layout
  [
    '#############################',
    '#.............#.............#',
    '#o###.#######.#.#######.###o#',
    '#.#.#...................#.#.#',
    '#.#.#.#####.#####.#####.#.#.#',
    '#.....#.......#.......#.....#',
    '#####.#.##### # #####.#.#####',
    '     .  #           #  .     ',
    '#####.#.# ######### #.#.#####',
    '#.....#.# ####-#### #.#.....#',
    '#.###.#.  #       #  .#.###.#',
    '#.....#.# ######### #.#.....#',
    '#####.#.#           #.#.#####',
    '     .  #.#########.#  .     ',
    '#####.#.......#.......#.#####',
    '#.....#######.#.#######.....#',
    '#.###......... .........###.#',
    '#o..#.#######.#.#######.#..o#',
    '###.#.#.......#.......#.#.###',
    '#.....#.#####.#.#####.#.....#',
    '#...........................#',
    '#############################',
    '                             '
  ],
  // Maze 3: Championship Stage 3 Twin-Warp Labyrinth
  [
    '#############################',
    '#o....#...............#....o#',
    '#.###.#.#####.#.#####.#.###.#',
    '#.###.#.#####.#.#####.#.###.#',
    '#...........................#',
    '###.###.#####.#.#####.###.###',
    '   .#.........#.........#.   ',
    '#####.####### # #######.#####',
    '#.....#               #.....#',
    '#.###.#.  ####-####  .#.###.#',
    '     .    #       #    .     ',
    '#.###.#.  #########  .#.###.#',
    '#.....#               #.....#',
    '#####.#.#############.#.#####',
    '   .#.#.......#.......#.#.   ',
    '###.#.#######.#.#######.#.###',
    '#o............ ............o#',
    '#.#####.#####.#.#####.#####.#',
    '#.....#.......#.......#.....#',
    '#####.#.#####.#.#####.#.#####',
    '#...........................#',
    '#############################',
    '                             '
  ],
  // Maze 4: Ms. Pac-Man Maze 3 (Red & White Corner Loops & Dual Tunnels)
  [
    '#############################',
    '#.......#...........#.......#',
    '#o#####.#.#########.#.#####o#',
    '#.#...#...............#...#.#',
    '#.#...#.#####.#.#####.#...#.#',
    '#.......#.....#.....#.......#',
    '#####.###.#########.###.#####',
    '     .#...............#.     ',
    '#####.#.##### # #####.#.#####',
    '#.....#.# ####-#### #.#.....#',
    '#.###.#.  #       #  .#.###.#',
    '#.....#.# ######### #.#.....#',
    '#####.#.#           #.#.#####',
    '     .#.#############.#.     ',
    '#####.#.......#.......#.#####',
    '#.......#####.#.#####.......#',
    '#o#####....... .......#####o#',
    '#.#...#.#####.#.#####.#...#.#',
    '#.#...#.......#.......#...#.#',
    '#.###########.#.###########.#',
    '#...........................#',
    '#############################',
    '                             '
  ],
  // Maze 5: Ms. Pac-Man Maze 4 (Lavender & Cyan Open Speedways)
  [
    '#############################',
    '#o............#............o#',
    '#.####.######.#.######.####.#',
    '#......#.............#......#',
    '######.#.####.#.####.#.######',
    '      ...#....#....#...      ',
    '######.###.#######.###.######',
    '#..........   #   ..........#',
    '#.####.###### # ######.####.#',
    '#.#..#.#  ####-####  #.#..#.#',
    '#.#..#.#  #       #  #.#..#.#',
    '#.#..#.#  #########  #.#..#.#',
    '#......#             #......#',
    '######.#######.#######.######',
    '      .........#.........    ',
    '######.#####.###.#####.######',
    '#o.....#...... ......#.....o#',
    '#.####.#.###########.#.####.#',
    '#......#......#......#......#',
    '#.###########.#.###########.#',
    '#...........................#',
    '#############################',
    '                             '
  ],
  // Maze 6: Jr. Pac-Man Inspired Wide Arcade Columns
  [
    '#############################',
    '#......#......#......#......#',
    '#o####.#.####.#.####.#.####o#',
    '#.####.#.####.#.####.#.####.#',
    '#...........................#',
    '#.####.######.#.######.####.#',
    '#.#..#........#........#..#.#',
    '#.#..#.###### # ######.#..#.#',
    '#......#             #......#',
    '######.#  ####-####  #.######',
    '      .   #       #   .      ',
    '######.#  #########  #.######',
    '#......#             #......#',
    '#.####.#.###########.#.####.#',
    '#.#..#.#......#......#.#..#.#',
    '#.#..#.######.#.######.#..#.#',
    '#o............ ............o#',
    '#.####.######.#.######.####.#',
    '#....#........#........#....#',
    '####.#.######.#.######.#.####',
    '#...........................#',
    '#############################',
    '                             '
  ],
  // Maze 7: Pac-Mania Cyber Diamond Arena
  [
    '#############################',
    '#o....#.......#.......#....o#',
    '#.###.#.#####.#.#####.#.###.#',
    '#.#...#...............#...#.#',
    '#.#.###.#####.#.#####.###.#.#',
    '#...........#.#.#...........#',
    '   ####.###.# # #.###.####   ',
    '#######.#...     ...#.#######',
    '#.......#.#########.#.......#',
    '#.#####.# ####-#### #.#####.#',
    '       .  #       #  .       ',
    '#.#####.# ######### #.#####.#',
    '#.......#           #.......#',
    '#######.#.#########.#.#######',
    '   ####.#.....#.....#.####   ',
    '#.......#####.#.#####.......#',
    '#o###......... .........###o#',
    '#.#.#.#######.#.#######.#.#.#',
    '#.#.#.........#.........#.#.#',
    '#...#.#######.#.#######.#...#',
    '#...........................#',
    '#############################',
    '                             '
  ]
];

const MAZE_THEMES = [
  { name: 'CLASSIC NEON', wallFill: '#0F1E4A', wallStroke: '#2563EB', glow: '#00F0FF', dotColor: '#FDE68A' },
  { name: 'MS. PAC PINK', wallFill: '#3B0A2A', wallStroke: '#FF007A', glow: '#00F0FF', dotColor: '#FFF1F2' },
  { name: 'EMERALD CYBER', wallFill: '#082F27', wallStroke: '#00FF66', glow: '#FFD700', dotColor: '#FEF08A' },
  { name: 'VIOLET PULSE', wallFill: '#27104E', wallStroke: '#B829FF', glow: '#FF8800', dotColor: '#E0E7FF' },
  { name: 'CRIMSON WHITE', wallFill: '#450A0A', wallStroke: '#EF4444', glow: '#F8FAFC', dotColor: '#FEF08A' },
  { name: 'LAVENDER SKY', wallFill: '#1E1B4B', wallStroke: '#38BDF8', glow: '#C084FC', dotColor: '#FDE68A' },
  { name: 'ARCADE GOLD', wallFill: '#422006', wallStroke: '#F59E0B', glow: '#00FF66', dotColor: '#FFFFFF' },
  { name: 'CYBER TEAL', wallFill: '#042F2E', wallStroke: '#14B8A6', glow: '#FF007A', dotColor: '#FEF08A' }
];

const FRUITS = [
  { name: 'CHERRY',     score: 100,  color: '#FF2A55', accent: '#00FF66' },
  { name: 'STRAWBERRY', score: 300,  color: '#FF007A', accent: '#F8FAFC' },
  { name: 'PEACH',      score: 500,  color: '#FF9900', accent: '#00FF66' },
  { name: 'APPLE',      score: 700,  color: '#EF4444', accent: '#FFD700' },
  { name: 'MELON',      score: 1000, color: '#00FF66', accent: '#FEF08A' },
  { name: 'GALAXIAN',   score: 2000, color: '#00F0FF', accent: '#FFD700' },
  { name: 'BELL',       score: 3000, color: '#FFD700', accent: '#38BDF8' },
  { name: 'KEY',        score: 5000, color: '#38BDF8', accent: '#FFD700' }
];

export class PacMan {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'pacman';
    this.title = 'Pac-Man';

    this.state = 'PLAYING';
    this.isMsPacMan = false;

    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.grid = [];
    this.totalDots = 0;
    this.dotsRemaining = 0;
    this.dotsEatenThisRound = 0;

    this.frightTimer = 0;
    this.frightDuration = 8.0;
    this.ghostEatCombo = 0;

    // Mode wave schedule: alternates SCATTER and CHASE
    this.modeTimer = 0;
    this.modeIndex = 0;
    this.globalMode = 'SCATTER'; // 'SCATTER' | 'CHASE'

    this.sirenTimer = 0;
    this.pelletPulse = 0;
    this.deathTimer = 0;
    this.stageClearTimer = 0;
    this.eatFreezeTimer = 0;

    this.fruit = null;
    this.fruitSpawnsTriggered = 0;
    this.popups = [];
    this.particles = [];

    this.reset();
  }

  setState(nextState) {
    this.state = nextState;
  }

  destroy() {
    if (this.audio && typeof this.audio.stopSequence === 'function') {
      this.audio.stopSequence();
    }
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.popups = [];
    this.particles = [];
    this._initRound(true);
  }

  _initRound(resetDots = true) {
    if (resetDots) {
      this._buildMaze();
      this.dotsEatenThisRound = 0;
      this.fruitSpawnsTriggered = 0;
      this.fruit = null;
    }

    this.frightTimer = 0;
    this.frightDuration = Math.max(2.0, 8.0 - (this.level - 1) * 0.85);
    this.ghostEatCombo = 0;
    this.modeTimer = 0;
    this.modeIndex = 0;
    this.globalMode = 'SCATTER';
    this.deathTimer = 0;
    this.stageClearTimer = 0;
    this.eatFreezeTimer = 0;

    // Player starts at bottom-center alley (col 14, row 16)
    this.player = {
      col: 14,
      row: 16,
      x: 14 * TILE_SIZE + TILE_SIZE / 2,
      y: 16 * TILE_SIZE + TILE_SIZE / 2,
      dir: DIRS.LEFT,
      nextDir: DIRS.LEFT,
      facing: DIRS.LEFT,
      speed: 138 + Math.min(28, (this.level - 1) * 5),
      mouthAngle: 0.2,
      mouthSpeed: 11
    };

    // 4 Iconic Ghosts with exact target tile logic
    const baseGhostSpeed = 126 + Math.min(30, (this.level - 1) * 5);
    this.ghosts = [
      {
        id: 'blinky',
        name: 'SHADOW',
        color: '#FF2A55',
        col: 14,
        row: 8,
        x: 14 * TILE_SIZE + TILE_SIZE / 2,
        y: 8 * TILE_SIZE + TILE_SIZE / 2,
        dir: DIRS.LEFT,
        speed: baseGhostSpeed * 1.02,
        scatterTarget: { col: COLS - 2, row: 0 },
        targetTile: { col: COLS - 2, row: 0 },
        inHouse: false,
        releaseTimer: 0,
        frightened: false,
        eyes: false,
        lastDecisionKey: ''
      },
      {
        id: 'pinky',
        name: 'AMBUSH',
        color: '#FF77C8',
        col: 14,
        row: 10,
        x: 14 * TILE_SIZE + TILE_SIZE / 2,
        y: 10 * TILE_SIZE + TILE_SIZE / 2,
        dir: DIRS.UP,
        speed: baseGhostSpeed * 0.99,
        scatterTarget: { col: 1, row: 0 },
        targetTile: { col: 1, row: 0 },
        inHouse: true,
        releaseTimer: 0.4,
        frightened: false,
        eyes: false,
        lastDecisionKey: ''
      },
      {
        id: 'inky',
        name: 'FLANKER',
        color: '#00F0FF',
        col: 12,
        row: 10,
        x: 12 * TILE_SIZE + TILE_SIZE / 2,
        y: 10 * TILE_SIZE + TILE_SIZE / 2,
        dir: DIRS.UP,
        speed: baseGhostSpeed * 0.96,
        scatterTarget: { col: COLS - 2, row: ROWS - 1 },
        targetTile: { col: COLS - 2, row: ROWS - 1 },
        inHouse: true,
        releaseTimer: Math.max(0.8, 2.8 - (this.level - 1) * 0.4),
        frightened: false,
        eyes: false,
        lastDecisionKey: ''
      },
      {
        id: 'clyde',
        name: 'WANDER',
        color: '#FF9900',
        col: 16,
        row: 10,
        x: 16 * TILE_SIZE + TILE_SIZE / 2,
        y: 10 * TILE_SIZE + TILE_SIZE / 2,
        dir: DIRS.UP,
        speed: baseGhostSpeed * 0.94,
        scatterTarget: { col: 1, row: ROWS - 1 },
        targetTile: { col: 1, row: ROWS - 1 },
        inHouse: true,
        releaseTimer: Math.max(1.5, 5.2 - (this.level - 1) * 0.6),
        frightened: false,
        eyes: false,
        lastDecisionKey: ''
      }
    ];
  }

  _buildMaze() {
    const templateIdx = (this.isMsPacMan ? 1 : 0 + (this.level - 1)) % MAZE_TEMPLATES.length;
    const raw = MAZE_TEMPLATES[templateIdx];
    this.grid = [];
    this.totalDots = 0;

    for (let r = 0; r < ROWS; r++) {
      const rowArr = [];
      const line = (raw[r] || '').padEnd(COLS, ' ');
      for (let c = 0; c < COLS; c++) {
        const ch = line[c];
        if (ch === '#') {
          rowArr.push(1); // Wall
        } else if (ch === '.') {
          rowArr.push(2); // Dot
          this.totalDots++;
        } else if (ch === 'o') {
          rowArr.push(3); // Power Pellet
          this.totalDots++;
        } else if (ch === '-') {
          rowArr.push(4); // Ghost Door
        } else {
          rowArr.push(0); // Empty
        }
      }
      this.grid.push(rowArr);
    }

    // Clear starting position dot if present
    if (this.grid[16] && (this.grid[16][14] === 2 || this.grid[16][14] === 3)) {
      this.grid[16][14] = 0;
      this.totalDots--;
    }
    this.dotsRemaining = this.totalDots;
  }

  _getTheme() {
    const idx = (this.isMsPacMan ? 1 : 0) + (this.level - 1);
    return MAZE_THEMES[idx % MAZE_THEMES.length];
  }

  _addScore(pts) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
  }

  _addPopup(text, x, y, color = PALETTE.WHITE) {
    this.popups.push({
      text: String(text),
      x,
      y,
      color,
      life: 1.0,
      maxLife: 1.0
    });
  }

  _spawnParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd = 40 + Math.random() * 110;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color,
        life: 0.45 + Math.random() * 0.25
      });
    }
  }

  _isTileWalkableForPlayer(col, row) {
    if (row < 0 || row >= ROWS) return false;
    const wrappedCol = ((col % COLS) + COLS) % COLS;
    const cell = this.grid[row][wrappedCol];
    return cell !== 1 && cell !== 4;
  }

  _isTileWalkableForGhost(col, row, allowDoor = false) {
    if (row < 0 || row >= ROWS) return false;
    const wrappedCol = ((col % COLS) + COLS) % COLS;
    const cell = this.grid[row][wrappedCol];
    if (cell === 1) return false;
    if (cell === 4 && !allowDoor) return false;
    return true;
  }

  update(dt) {
    this.pelletPulse += dt * 7.5;

    // Handle non-playing state transitions
    if (this.state === 'MENU') {
      if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.state === 'PAUSED') {
      if (this.input.isJustPressed('pause') || this.input.isJustPressed('actionA')) {
        this.audio.playMenuSelect();
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.state === 'GAMEOVER') {
      if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.input.isJustPressed('pause')) {
      this.audio.playMenuSelect();
      this.state = 'PAUSED';
      return;
    }

    // Action B (X / Shift): Toggle PAC-MAN / MS. PAC-MAN mode at any time!
    if (this.input.isJustPressed('actionB')) {
      this.isMsPacMan = !this.isMsPacMan;
      this.audio.playMenuSelect();
      this._addPopup(
        this.isMsPacMan ? 'MS. PAC-MAN!' : 'PAC-MAN!',
        this.player.x,
        this.player.y - 16,
        this.isMsPacMan ? PALETTE.PINK : PALETTE.GOLD
      );
    }

    // Update popups and particles
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.y -= 24 * dt;
      p.life -= dt;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    // Brief freeze frame when eating a ghost
    if (this.eatFreezeTimer > 0) {
      this.eatFreezeTimer -= dt;
      return;
    }

    // Stage clear celebration pause
    if (this.stageClearTimer > 0) {
      this.stageClearTimer -= dt;
      if (this.stageClearTimer <= 0) {
        this.level++;
        this._initRound(true);
      }
      return;
    }

    // Player death sequence
    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.lives--;
        if (this.lives <= 0) {
          HighScoreStore.submit(this.id, this.score);
          this.audio.playGameOver();
          this.state = 'GAMEOVER';
        } else {
          this._initRound(false);
        }
      }
      return;
    }

    // Read directional input + mobile swipe for pre-turn input buffering
    this._handlePlayerInput();

    // Update Scatter/Chase wave schedule & Frightened timer
    this._updateTimersAndAudio(dt);

    // Move Player
    this._updatePlayer(dt);

    // Update Bonus Fruit
    this._updateFruit(dt);

    // Move Ghosts
    this._updateGhosts(dt);

    // Check Ghost Collisions
    this._checkCollisions();
  }

  _handlePlayerInput() {
    const swipe = this.input.consumeSwipe();
    if (swipe === 'left') this.player.nextDir = DIRS.LEFT;
    else if (swipe === 'right') this.player.nextDir = DIRS.RIGHT;
    else if (swipe === 'up') this.player.nextDir = DIRS.UP;
    else if (swipe === 'down') this.player.nextDir = DIRS.DOWN;

    if (this.input.isDown('left')) this.player.nextDir = DIRS.LEFT;
    else if (this.input.isDown('right')) this.player.nextDir = DIRS.RIGHT;
    else if (this.input.isDown('up')) this.player.nextDir = DIRS.UP;
    else if (this.input.isDown('down')) this.player.nextDir = DIRS.DOWN;
  }

  _updateTimersAndAudio(dt) {
    if (this.frightTimer > 0) {
      this.frightTimer = Math.max(0, this.frightTimer - dt);
      if (this.frightTimer === 0) {
        this.ghostEatCombo = 0;
        for (const g of this.ghosts) {
          g.frightened = false;
        }
      }
    } else {
      // Classic Scatter / Chase wave schedule:
      // 7s Scatter -> 20s Chase -> 7s Scatter -> 20s Chase -> 5s Scatter -> Permanent Chase
      const waveDurations = [7, 20, 7, 20, 5, 9999];
      this.modeTimer += dt;
      if (this.modeTimer >= waveDurations[this.modeIndex]) {
        this.modeTimer = 0;
        this.modeIndex = Math.min(waveDurations.length - 1, this.modeIndex + 1);
        const nextMode = this.modeIndex % 2 === 0 ? 'SCATTER' : 'CHASE';
        if (nextMode !== this.globalMode) {
          this.globalMode = nextMode;
          // Reverse active ghosts on mode switch
          for (const g of this.ghosts) {
            if (!g.inHouse && !g.eyes) {
              g.dir = this._oppositeDir(g.dir);
              g.lastDecisionKey = '';
            }
          }
        }
      }
    }

    // Periodic modulating background siren
    this.sirenTimer += dt;
    if (this.sirenTimer >= 0.34) {
      this.sirenTimer = 0;
      const ratio = this.totalDots > 0 ? this.dotsRemaining / this.totalDots : 1;
      this.audio.playSiren(ratio, this.frightTimer > 0);
    }
  }

  _oppositeDir(dir) {
    if (dir === DIRS.LEFT) return DIRS.RIGHT;
    if (dir === DIRS.RIGHT) return DIRS.LEFT;
    if (dir === DIRS.UP) return DIRS.DOWN;
    if (dir === DIRS.DOWN) return DIRS.UP;
    return DIRS.NONE;
  }

  _updatePlayer(dt) {
    const p = this.player;

    // Immediate 180-degree reversal is always allowed anywhere in a corridor
    if (p.nextDir !== DIRS.NONE && p.nextDir === this._oppositeDir(p.dir)) {
      p.dir = p.nextDir;
      p.facing = p.dir;
    }

    const centerX = p.col * TILE_SIZE + TILE_SIZE / 2;
    const centerY = p.row * TILE_SIZE + TILE_SIZE / 2;
    const distToCenter = Math.hypot(p.x - centerX, p.y - centerY);

    // Pre-turn cornering tolerance (within 5.5px of tile center)
    if (p.nextDir !== DIRS.NONE && p.nextDir !== p.dir && distToCenter <= 5.5) {
      const targetCol = p.col + p.nextDir.x;
      const targetRow = p.row + p.nextDir.y;
      if (this._isTileWalkableForPlayer(targetCol, targetRow)) {
        p.x = centerX;
        p.y = centerY;
        p.dir = p.nextDir;
        p.facing = p.dir;
      }
    }

    // Advance along current direction
    if (p.dir !== DIRS.NONE) {
      const nextX = p.x + p.dir.x * p.speed * dt;
      const nextY = p.y + p.dir.y * p.speed * dt;

      // Check if moving past tile center into a wall
      const aheadCol = p.col + p.dir.x;
      const aheadRow = p.row + p.dir.y;
      const canMoveAhead = this._isTileWalkableForPlayer(aheadCol, aheadRow);

      if (!canMoveAhead) {
        if (
          (p.dir === DIRS.RIGHT && nextX > centerX) ||
          (p.dir === DIRS.LEFT && nextX < centerX) ||
          (p.dir === DIRS.DOWN && nextY > centerY) ||
          (p.dir === DIRS.UP && nextY < centerY)
        ) {
          p.x = centerX;
          p.y = centerY;
        } else {
          p.x = nextX;
          p.y = nextY;
        }
      } else {
        p.x = nextX;
        p.y = nextY;
        // Keep perpendicular axis snapped cleanly to alley center
        if (p.dir.x !== 0) p.y = centerY;
        if (p.dir.y !== 0) p.x = centerX;
      }
    }

    // Left / Right Warp Tunnel wrapping
    if (p.x < 0) p.x += MAZE_WIDTH;
    if (p.x >= MAZE_WIDTH) p.x -= MAZE_WIDTH;

    p.col = Math.max(0, Math.min(COLS - 1, Math.floor(p.x / TILE_SIZE)));
    p.row = Math.max(0, Math.min(ROWS - 1, Math.floor(p.y / TILE_SIZE)));

    // Animate mouth chomp when moving
    const moved = Math.hypot(p.x - centerX, p.y - centerY) > 0.2 || this._isTileWalkableForPlayer(p.col + p.dir.x, p.row + p.dir.y);
    if (moved && p.dir !== DIRS.NONE) {
      p.mouthAngle = 0.05 + Math.abs(Math.sin(performance.now() * 0.015)) * 0.34;
    }

    // Check Dot / Power Pellet consumption
    const cell = this.grid[p.row][p.col];
    if (cell === 2) {
      // Regular Pac-Dot
      this.grid[p.row][p.col] = 0;
      this.dotsRemaining--;
      this.dotsEatenThisRound++;
      this._addScore(10);
      this.audio.playWaka();
      this._checkFruitSpawn();
      this._checkStageClear();
    } else if (cell === 3) {
      // Power Pellet!
      this.grid[p.row][p.col] = 0;
      this.dotsRemaining--;
      this.dotsEatenThisRound++;
      this._addScore(50);
      this.frightDuration = Math.max(2.0, 8.0 - (this.level - 1) * 0.85);
      this.frightTimer = this.frightDuration;
      this.ghostEatCombo = 0;
      this.audio.playPowerUp();
      this._spawnParticles(p.x, p.y, PALETTE.CYAN, 14);

      for (const g of this.ghosts) {
        if (!g.eyes) {
          g.frightened = true;
          if (!g.inHouse) {
            g.dir = this._oppositeDir(g.dir);
            g.lastDecisionKey = '';
          }
        }
      }
      this._checkFruitSpawn();
      this._checkStageClear();
    }
  }

  _checkFruitSpawn() {
    if (
      (this.dotsEatenThisRound === 40 && this.fruitSpawnsTriggered === 0) ||
      (this.dotsEatenThisRound === 100 && this.fruitSpawnsTriggered === 1)
    ) {
      this.fruitSpawnsTriggered++;
      const fruitInfo = FRUITS[Math.min(FRUITS.length - 1, this.level - 1)];

      if (this.isMsPacMan) {
        // Ms. Pac-Man wandering bouncing fruit enters from warp tunnel!
        const fromLeft = Math.random() < 0.5;
        const startCol = fromLeft ? 0 : COLS - 1;
        const startRow = 10;
        this.fruit = {
          ...fruitInfo,
          col: startCol,
          row: startRow,
          x: startCol * TILE_SIZE + TILE_SIZE / 2,
          y: startRow * TILE_SIZE + TILE_SIZE / 2,
          dir: fromLeft ? DIRS.RIGHT : DIRS.LEFT,
          wandering: true,
          timer: 11.0,
          bouncePhase: 0,
          lastDecisionKey: ''
        };
      } else {
        // Classic stationary bonus fruit below ghost house (col 14, row 14)
        this.fruit = {
          ...fruitInfo,
          col: 14,
          row: 14,
          x: 14 * TILE_SIZE + TILE_SIZE / 2,
          y: 14 * TILE_SIZE + TILE_SIZE / 2,
          dir: DIRS.NONE,
          wandering: false,
          timer: 9.5,
          bouncePhase: 0,
          lastDecisionKey: ''
        };
      }
    }
  }

  _updateFruit(dt) {
    if (!this.fruit) return;
    const f = this.fruit;
    f.timer -= dt;
    f.bouncePhase += dt * 9.0;

    if (f.wandering) {
      const speed = 78;
      const centerX = f.col * TILE_SIZE + TILE_SIZE / 2;
      const centerY = f.row * TILE_SIZE + TILE_SIZE / 2;
      const dist = Math.hypot(f.x - centerX, f.y - centerY);
      const key = `${f.col},${f.row}`;

      if (dist <= 3.0 && f.lastDecisionKey !== key) {
        f.x = centerX;
        f.y = centerY;
        f.lastDecisionKey = key;
        const rev = this._oppositeDir(f.dir);
        const options = DIR_LIST.filter(
          (d) => d !== rev && this._isTileWalkableForPlayer(f.col + d.x, f.row + d.y)
        );
        if (options.length > 0) {
          f.dir = options[Math.floor(Math.random() * options.length)];
        } else if (this._isTileWalkableForPlayer(f.col + rev.x, f.row + rev.y)) {
          f.dir = rev;
        }
      }

      f.x += f.dir.x * speed * dt;
      f.y += f.dir.y * speed * dt;
      if (f.x < 0) f.x += MAZE_WIDTH;
      if (f.x >= MAZE_WIDTH) f.x -= MAZE_WIDTH;
      f.col = Math.max(0, Math.min(COLS - 1, Math.floor(f.x / TILE_SIZE)));
      f.row = Math.max(0, Math.min(ROWS - 1, Math.floor(f.y / TILE_SIZE)));
    }

    // Check if Player eats the fruit
    if (Math.hypot(this.player.x - f.x, this.player.y - f.y) < TILE_SIZE * 0.75) {
      this._addScore(f.score);
      this.audio.playCoin();
      this._addPopup(`${f.score}`, f.x, f.y - 6, PALETTE.GOLD);
      this._spawnParticles(f.x, f.y, f.color, 14);
      this.fruit = null;
      return;
    }

    if (f.timer <= 0) {
      this.fruit = null;
    }
  }

  _checkStageClear() {
    if (this.dotsRemaining <= 0 && this.stageClearTimer <= 0) {
      this.stageClearTimer = 2.0;
      this.audio.playStageClear();
      this._addScore(500);
      this._addPopup('ROUND CLEAR! +500', MAZE_WIDTH / 2, MAZE_HEIGHT / 2, PALETTE.GREEN);
    }
  }

  /**
   * Computes exact Ghost AI Target Tile per specification:
   * - Blinky: (pacCol, pacRow)
   * - Pinky: 4 tiles ahead (pacCol + dirX * 4, pacRow + dirY * 4)
   * - Inky: Doubles vector from Blinky through 2 tiles ahead of player
   * - Clyde: Chases player if Euclidean distance > 8 tiles, else retreats to scatter target
   */
  _computeGhostTargetTile(g) {
    const pacCol = this.player.col;
    const pacRow = this.player.row;
    const dirX = this.player.facing.x;
    const dirY = this.player.facing.y;

    if (g.eyes) {
      // Disembodied eyes race back to Ghost House entrance
      return { col: 14, row: 8 };
    }

    if (this.globalMode === 'SCATTER' && !g.frightened) {
      return { ...g.scatterTarget };
    }

    if (g.id === 'blinky') {
      return { col: pacCol, row: pacRow };
    }

    if (g.id === 'pinky') {
      return {
        col: pacCol + dirX * 4,
        row: pacRow + dirY * 4
      };
    }

    if (g.id === 'inky') {
      const blinky = this.ghosts[0];
      const blinkyX = blinky ? blinky.col : pacCol;
      const blinkyY = blinky ? blinky.row : pacRow;
      const pivotX = pacCol + dirX * 2;
      const pivotY = pacRow + dirY * 2;
      return {
        col: blinkyX + (pivotX - blinkyX) * 2,
        row: blinkyY + (pivotY - blinkyY) * 2
      };
    }

    if (g.id === 'clyde') {
      const dist = Math.hypot(g.col - pacCol, g.row - pacRow);
      if (dist > 8) {
        return { col: pacCol, row: pacRow };
      }
      return { ...g.scatterTarget };
    }

    return { col: pacCol, row: pacRow };
  }

  _updateGhosts(dt) {
    for (const g of this.ghosts) {
      // Handle Ghost House exit sequence
      if (g.inHouse) {
        g.releaseTimer -= dt;
        if (g.releaseTimer <= 0) {
          const targetX = 14 * TILE_SIZE + TILE_SIZE / 2;
          const exitY = 8 * TILE_SIZE + TILE_SIZE / 2;
          if (Math.abs(g.x - targetX) > 2) {
            g.x += Math.sign(targetX - g.x) * 85 * dt;
          } else {
            g.x = targetX;
            g.y -= 95 * dt;
            if (g.y <= exitY) {
              g.y = exitY;
              g.col = 14;
              g.row = 8;
              g.inHouse = false;
              g.dir = Math.random() < 0.5 ? DIRS.LEFT : DIRS.RIGHT;
              g.lastDecisionKey = '';
            }
          }
        }
        continue;
      }

      // Compute current speed based on state & warp tunnel slowdown
      let speed = g.speed;
      if (g.eyes) {
        speed = g.speed * 2.15;
      } else if (g.frightened) {
        speed = g.speed * 0.58;
      } else if (g.row === 10 && (g.col <= 4 || g.col >= COLS - 5)) {
        // Tunnel slowdown
        speed = g.speed * 0.65;
      }

      g.targetTile = this._computeGhostTargetTile(g);

      const centerX = g.col * TILE_SIZE + TILE_SIZE / 2;
      const centerY = g.row * TILE_SIZE + TILE_SIZE / 2;
      const distToCenter = Math.hypot(g.x - centerX, g.y - centerY);
      const tileKey = `${g.col},${g.row}`;

      // When Eyes reach the ghost house entrance (col 14, row 8), regenerate!
      if (g.eyes && g.col === 14 && g.row === 8 && distToCenter <= 5) {
        g.x = 14 * TILE_SIZE + TILE_SIZE / 2;
        g.y = 10 * TILE_SIZE + TILE_SIZE / 2;
        g.col = 14;
        g.row = 10;
        g.eyes = false;
        g.frightened = false;
        g.inHouse = true;
        g.releaseTimer = 0.45;
        g.lastDecisionKey = '';
        continue;
      }

      // Intersection decision at tile center
      if (distToCenter <= Math.max(3.2, speed * dt * 1.15) && g.lastDecisionKey !== tileKey) {
        g.x = centerX;
        g.y = centerY;
        g.lastDecisionKey = tileKey;

        const rev = this._oppositeDir(g.dir);
        const candidates = DIR_LIST.filter(
          (d) => d !== rev && this._isTileWalkableForGhost(g.col + d.x, g.row + d.y, g.eyes)
        );

        if (candidates.length === 0) {
          if (this._isTileWalkableForGhost(g.col + rev.x, g.row + rev.y, g.eyes)) {
            g.dir = rev;
          }
        } else if (candidates.length === 1) {
          g.dir = candidates[0];
        } else {
          // Multiple valid paths at intersection
          // Frightened ghosts or Ms. Pac-Man Blinky/Pinky semi-random intersection choices
          const msPacRandom =
            this.isMsPacMan &&
            !g.eyes &&
            (g.id === 'blinky' || g.id === 'pinky') &&
            (this.globalMode === 'SCATTER' || Math.random() < 0.28);

          if (g.frightened || msPacRandom) {
            g.dir = candidates[Math.floor(Math.random() * candidates.length)];
          } else {
            // Standard minimum Euclidean distance to targetTile (tie-breaker: UP, LEFT, DOWN, RIGHT)
            let bestDir = candidates[0];
            let bestDistSq = Infinity;
            for (const d of candidates) {
              const nx = g.col + d.x;
              const ny = g.row + d.y;
              const dx = nx - g.targetTile.col;
              const dy = ny - g.targetTile.row;
              const dSq = dx * dx + dy * dy;
              if (dSq < bestDistSq) {
                bestDistSq = dSq;
                bestDir = d;
              }
            }
            g.dir = bestDir;
          }
        }
      }

      // Advance ghost position
      g.x += g.dir.x * speed * dt;
      g.y += g.dir.y * speed * dt;

      // Warp tunnel wrap
      if (g.x < 0) {
        g.x += MAZE_WIDTH;
        g.lastDecisionKey = '';
      }
      if (g.x >= MAZE_WIDTH) {
        g.x -= MAZE_WIDTH;
        g.lastDecisionKey = '';
      }

      g.col = Math.max(0, Math.min(COLS - 1, Math.floor(g.x / TILE_SIZE)));
      g.row = Math.max(0, Math.min(ROWS - 1, Math.floor(g.y / TILE_SIZE)));
    }
  }

  _checkCollisions() {
    for (const g of this.ghosts) {
      if (g.inHouse || g.eyes) continue;
      const dist = Math.hypot(g.x - this.player.x, g.y - this.player.y);
      if (dist < TILE_SIZE * 0.68) {
        if (g.frightened) {
          // Consume frightened ghost with cascading 200 -> 400 -> 800 -> 1600 score multiplier!
          const pts = 200 * Math.pow(2, Math.min(3, this.ghostEatCombo));
          this.ghostEatCombo++;
          this._addScore(pts);
          g.frightened = false;
          g.eyes = true;
          this.eatFreezeTimer = 0.22;
          this.audio.playPowerUp();
          this._addPopup(`${pts}`, g.x, g.y - 6, PALETTE.CYAN);
          this._spawnParticles(g.x, g.y, g.color, 16);
        } else {
          // Player loses a life!
          this.deathTimer = 1.25;
          this.renderer.shake(8, 0.32);
          this.audio.playHit();
          this.audio.playExplosion(0.35, 700);
          this._spawnParticles(this.player.x, this.player.y, PALETTE.GOLD, 22);
          break;
        }
      }
    }
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear(PALETTE.BG);

    const theme = this._getTheme();

    // Draw side arcade telemetry panels
    this._renderSidePanels(ctx, theme);

    // Draw Maze Arena
    ctx.save();
    ctx.translate(MAZE_OFFSET_X, MAZE_OFFSET_Y);

    this._renderMaze(ctx, theme);
    this._renderBonusFruit(ctx);
    this._renderPlayer(ctx);
    this._renderGhosts(ctx);
    this._renderEffects(ctx);

    ctx.restore();

    // Top Arcade HUD
    this.renderer.drawHUD({
      title: this.isMsPacMan ? 'MS. PAC-MAN' : 'PAC-MAN',
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `[X] ${this.isMsPacMan ? 'MS.PAC' : 'PAC-MAN'}`,
      accent: this.isMsPacMan ? PALETTE.PINK : PALETTE.GOLD
    });

    // State Overlay (MENU / PAUSED / GAMEOVER)
    this.renderer.drawStateOverlay(this.state, {
      title: this.isMsPacMan ? 'MS. PAC-MAN' : 'PAC-MAN',
      subtitle: 'DUAL VARIANT COIN-OP EDITION',
      controls: 'ARROWS/WASD/SWIPE: STEER  |  X/SHIFT: TOGGLE MS. PAC-MAN  |  P: PAUSE',
      score: this.score,
      highScore: this.highScore,
      accent: this.isMsPacMan ? PALETTE.PINK : PALETTE.GOLD
    });
  }

  _renderSidePanels(ctx, theme) {
    // Left Panel: Ghost AI Roster & Live Status
    const lx = 14;
    const ly = 56;
    const lw = 162;
    const lh = 444;

    ctx.save();
    ctx.fillStyle = 'rgba(19, 27, 46, 0.78)';
    ctx.fillRect(lx, ly, lw, lh);
    ctx.strokeStyle = theme.wallStroke;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(lx, ly, lw, lh);

    this.renderer.drawText('GHOST AI TELEMETRY', lx + lw / 2, ly + 24, {
      font: FONTS.HUD,
      size: 12,
      color: theme.glow,
      align: 'center'
    });

    const ghostDescriptions = {
      blinky: 'DIRECT CHASE',
      pinky: '+4 TILE AMBUSH',
      inky: '2X FLANK VECTOR',
      clyde: '8-TILE WANDER'
    };

    this.ghosts.forEach((g, idx) => {
      const gy = ly + 52 + idx * 82;
      ctx.fillStyle = 'rgba(11, 15, 25, 0.75)';
      ctx.fillRect(lx + 10, gy, lw - 20, 68);
      ctx.strokeStyle = g.frightened ? '#38BDF8' : g.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(lx + 10, gy, lw - 20, 68);

      // Mini ghost icon
      ctx.fillStyle = g.frightened ? '#2563EB' : g.color;
      ctx.beginPath();
      ctx.arc(lx + 28, gy + 22, 8, Math.PI, 0);
      ctx.lineTo(lx + 36, gy + 32);
      ctx.lineTo(lx + 20, gy + 32);
      ctx.closePath();
      ctx.fill();

      this.renderer.drawText(g.name, lx + 44, gy + 22, {
        font: FONTS.HEADER,
        size: 9,
        color: g.color
      });

      this.renderer.drawText(ghostDescriptions[g.id], lx + 44, gy + 38, {
        font: FONTS.BODY,
        size: 10,
        color: PALETTE.MUTED
      });

      const statusLabel = g.eyes
        ? 'RETURNING EYES'
        : g.frightened
        ? `FRIGHT (${this.frightTimer.toFixed(1)}S)`
        : g.inHouse
        ? 'GHOST HOUSE'
        : this.globalMode;

      this.renderer.drawText(statusLabel, lx + 20, gy + 56, {
        font: FONTS.HUD,
        size: 10,
        color: g.frightened ? PALETTE.CYAN : PALETTE.WHITE
      });
    });

    // Bottom of left panel: Dots counter
    this.renderer.drawText(`DOTS LEFT: ${this.dotsRemaining}`, lx + lw / 2, ly + lh - 22, {
      font: FONTS.HUD,
      size: 13,
      color: PALETTE.GOLD,
      align: 'center'
    });

    // Right Panel: Variant Mode, Maze Theme & Multiplier Table
    const rx = MAZE_OFFSET_X + MAZE_WIDTH + 14;
    const ry = 56;
    const rw = 162;
    const rh = 444;

    ctx.fillStyle = 'rgba(19, 27, 46, 0.78)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = theme.wallStroke;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rx, ry, rw, rh);

    this.renderer.drawText('CABINET VARIANT', rx + rw / 2, ry + 24, {
      font: FONTS.HUD,
      size: 12,
      color: theme.glow,
      align: 'center'
    });

    this.renderer.drawText(this.isMsPacMan ? 'MS. PAC-MAN' : 'PAC-MAN', rx + rw / 2, ry + 48, {
      font: FONTS.HEADER,
      size: 11,
      color: this.isMsPacMan ? PALETTE.PINK : PALETTE.GOLD,
      align: 'center',
      glow: 8
    });

    this.renderer.drawText('PRESS [X / SHIFT]', rx + rw / 2, ry + 68, {
      font: FONTS.BODY,
      size: 11,
      color: PALETTE.WHITE,
      align: 'center'
    });
    this.renderer.drawText('TO SWITCH VARIANT', rx + rw / 2, ry + 84, {
      font: FONTS.BODY,
      size: 10,
      color: PALETTE.MUTED,
      align: 'center'
    });

    // Fright Combo Multiplier Table
    this.renderer.drawText('FRIGHT MULTIPLIERS', rx + rw / 2, ry + 128, {
      font: FONTS.HUD,
      size: 11,
      color: PALETTE.CYAN,
      align: 'center'
    });

    const combos = [200, 400, 800, 1600];
    combos.forEach((pts, i) => {
      const active = this.frightTimer > 0 && this.ghostEatCombo > i;
      this.renderer.drawText(`${i + 1}X GHOST: ${pts} PTS`, rx + rw / 2, ry + 150 + i * 22, {
        font: FONTS.HUD,
        size: 12,
        color: active ? PALETTE.GREEN : PALETTE.MUTED,
        align: 'center',
        glow: active ? 6 : 0
      });
    });

    // Round Bonus Fruit Badge
    const fruitInfo = FRUITS[Math.min(FRUITS.length - 1, this.level - 1)];
    this.renderer.drawText('ROUND TARGET FRUIT', rx + rw / 2, ry + 266, {
      font: FONTS.HUD,
      size: 11,
      color: PALETTE.GOLD,
      align: 'center'
    });
    this.renderer.drawText(fruitInfo.name, rx + rw / 2, ry + 290, {
      font: FONTS.HEADER,
      size: 10,
      color: fruitInfo.color,
      align: 'center'
    });
    this.renderer.drawText(`+${fruitInfo.score} PTS`, rx + rw / 2, ry + 310, {
      font: FONTS.HUD,
      size: 13,
      color: PALETTE.WHITE,
      align: 'center'
    });

    // Maze Color Theme
    this.renderer.drawText('MAZE THEME', rx + rw / 2, ry + 362, {
      font: FONTS.HUD,
      size: 11,
      color: PALETTE.MUTED,
      align: 'center'
    });
    this.renderer.drawText(theme.name, rx + rw / 2, ry + 382, {
      font: FONTS.HUD,
      size: 12,
      color: theme.glow,
      align: 'center'
    });

    ctx.restore();
  }

  _renderMaze(ctx, theme) {
    // Stage clear flashing effect
    const flashWhite = this.stageClearTimer > 0 && Math.floor(this.stageClearTimer * 10) % 2 === 0;
    const wallStroke = flashWhite ? PALETTE.WHITE : theme.wallStroke;
    const wallFill = flashWhite ? '#334155' : theme.wallFill;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.grid[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        if (cell === 1) {
          ctx.fillStyle = wallFill;
          ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          ctx.strokeStyle = wallStroke;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 1.5, y + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
        } else if (cell === 4) {
          // Ghost House Pink Neon Door
          ctx.fillStyle = PALETTE.PINK;
          ctx.fillRect(x, y + TILE_SIZE / 2 - 2, TILE_SIZE, 4);
        } else if (cell === 2) {
          // Pac-Dot
          ctx.fillStyle = theme.dotColor;
          ctx.fillRect(x + TILE_SIZE / 2 - 2, y + TILE_SIZE / 2 - 2, 4, 4);
        } else if (cell === 3) {
          // Flashing Power Pellet in corners
          const pulseR = 5.5 + Math.sin(this.pelletPulse) * 1.8;
          ctx.save();
          ctx.fillStyle = PALETTE.GOLD;
          ctx.shadowColor = PALETTE.GOLD;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, pulseR, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  _renderBonusFruit(ctx) {
    if (!this.fruit) return;
    const f = this.fruit;
    const bounceY = f.wandering ? Math.abs(Math.sin(f.bouncePhase)) * -5 : 0;
    const fx = Math.round(f.x);
    const fy = Math.round(f.y + bounceY);

    ctx.save();
    ctx.shadowColor = f.color;
    ctx.shadowBlur = 8;

    if (f.name === 'CHERRY') {
      // Twin cherries with curved green stems & white glints
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(fx - 3, fy + 2);
      ctx.quadraticCurveTo(fx - 1, fy - 5, fx + 4, fy - 7);
      ctx.moveTo(fx + 3, fy + 4);
      ctx.quadraticCurveTo(fx + 4, fy - 2, fx + 4, fy - 7);
      ctx.stroke();

      ctx.fillStyle = '#FF2A55';
      ctx.beginPath();
      ctx.arc(fx - 3.5, fy + 3, 3.8, 0, Math.PI * 2);
      ctx.arc(fx + 3, fy + 4.5, 3.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(fx - 5, fy + 1.5, 1.5, 1.5);
      ctx.fillRect(fx + 1.5, fy + 3, 1.5, 1.5);
    } else if (f.name === 'STRAWBERRY') {
      // Strawberry with green leafy crown and white seeds
      ctx.fillStyle = '#FF007A';
      ctx.beginPath();
      ctx.moveTo(fx - 6, fy - 2);
      ctx.lineTo(fx + 6, fy - 2);
      ctx.lineTo(fx, fy + 7);
      ctx.closePath();
      ctx.arc(fx - 2.5, fy - 2, 3.5, Math.PI, 0);
      ctx.arc(fx + 2.5, fy - 2, 3.5, Math.PI, 0);
      ctx.fill();

      // Green leaf cap
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(fx - 4, fy - 6, 8, 2.5);
      ctx.fillRect(fx - 1, fy - 8, 2, 2);

      // White seed dots
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(fx - 3, fy - 1, 1.5, 1.5);
      ctx.fillRect(fx + 1.5, fy - 1, 1.5, 1.5);
      ctx.fillRect(fx - 1, fy + 2, 1.5, 1.5);
    } else if (f.name === 'PEACH') {
      ctx.fillStyle = '#FB923C';
      ctx.beginPath();
      ctx.arc(fx - 1.5, fy + 1, 5.2, 0, Math.PI * 2);
      ctx.arc(fx + 1.5, fy + 1, 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(fx, fy - 6, 5, 2.5);
    } else if (f.name === 'APPLE') {
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(fx - 2, fy + 1, 5, 0, Math.PI * 2);
      ctx.arc(fx + 2, fy + 1, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(fx - 1, fy - 6, 2, 3);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(fx - 4, fy - 1, 1.5, 2.5);
    } else if (f.name === 'GALAXIAN') {
      // Galaxian Flagship pixel icon
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(fx - 2, fy - 6, 4, 10);
      ctx.fillStyle = '#00F0FF';
      ctx.fillRect(fx - 6, fy - 2, 12, 5);
      ctx.fillStyle = '#FF2A55';
      ctx.fillRect(fx - 4, fy - 4, 8, 2);
    } else {
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(fx, fy + 2, 6.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = f.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fx, fy - 4);
      ctx.lineTo(fx + 3, fy - 8);
      ctx.stroke();
    }

    ctx.restore();
  }

  _renderPlayer(ctx) {
    const p = this.player;
    ctx.save();
    ctx.translate(p.x, p.y);

    if (this.deathTimer > 0) {
      // Classic folding death animation
      const progress = 1 - this.deathTimer / 1.25;
      const openAngle = Math.min(Math.PI, progress * Math.PI);
      ctx.fillStyle = PALETTE.GOLD;
      ctx.shadowColor = PALETTE.GOLD;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, 9.5, openAngle, Math.PI * 2 - openAngle);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.rotate(p.facing.angle);

    // Body sphere with chomping mouth
    ctx.fillStyle = PALETTE.GOLD;
    ctx.shadowColor = PALETTE.GOLD;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 9.2, p.mouthAngle * Math.PI, (2 - p.mouthAngle) * Math.PI);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Ms. Pac-Man signature Red Pixel Bow with Blue Knot, Eye & Beauty Mark rotated cleanly with facing angle!
    if (this.isMsPacMan) {
      const flipY = p.facing === DIRS.LEFT ? -1 : 1;
      // Eye
      ctx.fillStyle = '#0B0F19';
      ctx.fillRect(0.5, -5.2 * flipY - 1, 2.2, 2.2);

      // Beauty mark
      ctx.fillStyle = '#0B0F19';
      ctx.fillRect(-3, 2.2 * flipY, 1.8, 1.8);

      // Red lipstick tip
      ctx.fillStyle = '#FF2A55';
      ctx.fillRect(6.5, -2.5 * flipY - 1, 2.2, 2.2);

      // Signature Red Pixel Bow on top of head with Blue Center Knot
      const bowY = -7.8 * flipY;
      ctx.fillStyle = '#FF2A55';
      ctx.fillRect(-6.5, bowY - 2.5, 3.5, 5);
      ctx.fillRect(-1.0, bowY - 2.5, 3.5, 5);
      ctx.fillStyle = '#2563EB';
      ctx.fillRect(-3.2, bowY - 1.5, 2.4, 3);
    }

    ctx.restore();
  }

  _renderGhosts(ctx) {
    const skirtAlt = Math.floor(this.pelletPulse * 1.6) % 2 === 0;

    for (const g of this.ghosts) {
      ctx.save();
      ctx.translate(g.x, g.y);

      if (!g.eyes) {
        // Determine body color (frightened blue or white flash during last 2.0s)
        let bodyColor = g.color;
        if (g.frightened) {
          const isFlashingWhite =
            this.frightTimer <= 2.0 && Math.floor(this.frightTimer * 8) % 2 === 0;
          bodyColor = isFlashingWhite ? '#F8FAFC' : '#1D4ED8';
        }

        ctx.fillStyle = bodyColor;
        ctx.shadowColor = bodyColor;
        ctx.shadowBlur = 8;

        // Classic dome head + 3-scallop wavy bottom skirt (alternating 2 skirt frames as they move!)
        ctx.beginPath();
        ctx.arc(0, -2, 8.8, Math.PI, 0, false);
        ctx.lineTo(8.8, 8.5);
        if (skirtAlt) {
          // Frame 0: 3 scallops
          ctx.lineTo(5.8, 5.2);
          ctx.lineTo(2.9, 8.5);
          ctx.lineTo(0, 5.2);
          ctx.lineTo(-2.9, 8.5);
          ctx.lineTo(-5.8, 5.2);
          ctx.lineTo(-8.8, 8.5);
        } else {
          // Frame 1: shifted scallops
          ctx.lineTo(7.2, 8.5);
          ctx.lineTo(4.4, 5.2);
          ctx.lineTo(1.5, 8.5);
          ctx.lineTo(-1.5, 8.5);
          ctx.lineTo(-4.4, 5.2);
          ctx.lineTo(-7.2, 8.5);
          ctx.lineTo(-8.8, 6.2);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        if (g.frightened) {
          // Classic wavy-mouth frightened face
          const featureColor =
            this.frightTimer <= 2.0 && Math.floor(this.frightTimer * 8) % 2 === 0
              ? '#FF2A55'
              : '#FDE68A';
          ctx.fillStyle = featureColor;
          ctx.fillRect(-4.2, -3.2, 2.5, 2.5);
          ctx.fillRect(1.7, -3.2, 2.5, 2.5);

          ctx.strokeStyle = featureColor;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-5.5, 3.8);
          ctx.lineTo(-3.6, 1.8);
          ctx.lineTo(-1.8, 3.8);
          ctx.lineTo(0, 1.8);
          ctx.lineTo(1.8, 3.8);
          ctx.lineTo(3.6, 1.8);
          ctx.lineTo(5.5, 3.8);
          ctx.stroke();
          ctx.restore();
          continue;
        }
      }

      // Draw Directional Ghost Eyes (white sclera + blue pupils offset in g.dir travel direction)
      const lookX = g.dir.x * 2.2;
      const lookY = g.dir.y * 2.2;

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(-3.3 + lookX * 0.55, -2.2 + lookY * 0.55, 2.8, 3.4, 0, 0, Math.PI * 2);
      ctx.ellipse(3.3 + lookX * 0.55, -2.2 + lookY * 0.55, 2.8, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1D4ED8';
      ctx.beginPath();
      ctx.arc(-3.3 + lookX, -2.2 + lookY, 1.55, 0, Math.PI * 2);
      ctx.arc(3.3 + lookX, -2.2 + lookY, 1.55, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  _renderEffects(ctx) {
    // Particles
    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life * 1.6);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
      ctx.restore();
    }

    // Floating Score Popups (200, 400, 800, 1600, Fruit)
    for (const p of this.popups) {
      this.renderer.drawText(p.text, p.x, p.y, {
        font: FONTS.HEADER,
        size: 11,
        color: p.color,
        align: 'center',
        glow: 8
      });
    }
  }
}

export default PacMan;
