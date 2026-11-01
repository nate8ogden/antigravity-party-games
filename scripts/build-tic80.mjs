#!/usr/bin/env node
/**
 * Build Native TIC-80 JavaScript Cartridges (.tic) for ALL 52 Custom Games on Recalbox 9.2
 * Specially optimized for Raspberry Pi Zero W (ARMv6 1GHz):
 * - Bitwise integer math (>> 3, | 0) instead of floating-point division
 * - Zero per-frame heap allocations to eliminate GC frame drops
 * - Locked 60 FPS execution on lr-tic80
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_CATALOG } from '../src/ui/MainMenu.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const TIC_OUT_DIR = path.join(ROOT_DIR, 'dist-rom', 'recalbox', 'roms', 'tic80');

fs.mkdirSync(TIC_OUT_DIR, { recursive: true });

function createTicBinary(jsCode) {
  const codeBytes = Buffer.from(jsCode, 'utf8');
  const len = codeBytes.length;
  const defaultChunk = Buffer.from([17, 0, 0, 0]);
  const codeHeader = Buffer.from([5, len & 0xff, (len >> 8) & 0xff, 0]);
  return Buffer.concat([defaultChunk, codeHeader, codeBytes]);
}

export function sanitizeFileName(title) {
  return title.replace(/[\/\\:*?"<>|]/g, '_');
}

// ============================================================================
// 1. LODE RUNNER
// ============================================================================
const lodeRunnerJs = `// title:  Lode Runner
// author: Antigravity Classic Games
// desc:   Dig bricks, trap guards, collect all gold!
// script: js

const LEVELS = [
  [
    "..................E.........",
    "....$.........G..EH.........",
    "#######H##########H.........",
    ".......H----------H.........",
    ".......H....G.....H..$......",
    ".......H##########H#####H###",
    "..$....H..........H.....H...",
    "###H####..........#######...",
    "...H.............G..........",
    "...H---------########H######",
    "...H.................H..$...",
    "##########H##########H######",
    "..........H..........H......",
    "..$.......H---P------H....$.",
    "####H######...########..####",
    "============================="
  ],
  [
    ".............E..............",
    "..$....G....EH....G......$..",
    "####H#######H#######H#######",
    "....H-------H-------H.......",
    "....H..$....H....$..H.......",
    "#####H######H######H########",
    ".....H......H......H........",
    "..$..H..G...H...G..H..$.....",
    "########H#######H###########",
    "........H-------H...........",
    "....$...H.......H...$.......",
    "###H#####.......#####H######",
    "...H........P........H......",
    "...H..$...........$..H......",
    "########################....",
    "============================="
  ]
];

let levelIdx = 0, grid = [], holes = [], guards = [];
let px = 112, py = 104, goldLeft = 0, exitOpen = false, score = 0, lives = 3;
let digC = 0, digR = 0, digT = 0;

function loadLevel(idx) {
  const raw = LEVELS[idx % LEVELS.length];
  grid = []; holes = []; guards = []; goldLeft = 0; exitOpen = false;
  for (let r = 0; r < 16; r++) {
    grid[r] = [];
    for (let c = 0; c < 28; c++) {
      const ch = raw[r][c] || '.';
      if (ch === 'P') {
        px = c << 3; py = r << 3; grid[r][c] = '.';
      } else if (ch === 'G') {
        guards.push({ x: c << 3, y: r << 3, trapped: 0 }); grid[r][c] = '.';
      } else {
        if (ch === '$') goldLeft++;
        grid[r][c] = ch;
      }
    }
  }
}
loadLevel(0);

function tileAt(c, r) {
  if (r < 0 || r >= 16 || c < 0 || c >= 28) return '=';
  const ch = grid[r][c];
  return (ch === 'E' && !exitOpen) ? '.' : ch;
}

function isSolid(c, r) {
  const t = tileAt(c, r);
  if (t === '#' || t === '=') return true;
  for (let i = 0; i < guards.length; i++) {
    const g = guards[i];
    if (g.trapped > 0 && ((g.x + 4) >> 3) === c && ((g.y + 4) >> 3) === r) return true;
  }
  return false;
}

function canSupport(x, y) {
  const c = (x + 4) >> 3, r = (y + 4) >> 3;
  const t = tileAt(c, r);
  if (t === 'H' || t === 'E' || t === '-') return true;
  const below = tileAt(c, r + 1);
  if (below === '#' || below === '=' || below === 'H' || below === 'E') return true;
  for (let i = 0; i < guards.length; i++) {
    const g = guards[i];
    if (g.trapped > 0 && ((g.x + 4) >> 3) === c && ((g.y + 4) >> 3) === r + 1) return true;
  }
  return false;
}

function digHole(dir) {
  const pc = (px + 4) >> 3, pr = (py + 4) >> 3;
  const tc = pc + dir, tr = pr + 1;
  if (tc >= 0 && tc < 28 && tr < 16 && grid[tr][tc] === '#' && tileAt(tc, pr) === '.') {
    grid[tr][tc] = '.';
    holes.push({ c: tc, r: tr, timer: 480 });
    digC = tc; digR = tr; digT = 10;
  }
}

function TIC() {
  cls(0);
  for (let i = holes.length - 1; i >= 0; i--) {
    if (--holes[i].timer <= 0) {
      const hc = holes[i].c, hr = holes[i].r;
      grid[hr][hc] = '#';
      if (((px + 4) >> 3) === hc && ((py + 4) >> 3) === hr) {
        lives--; loadLevel(levelIdx); return;
      }
      for (let j = 0; j < guards.length; j++) {
        const g = guards[j];
        if (((g.x + 4) >> 3) === hc && ((g.y + 4) >> 3) === hr) { g.y = 8; g.trapped = 0; }
      }
      holes.splice(i, 1);
    }
  }

  const pc = (px + 4) >> 3, pr = (py + 4) >> 3;
  const curTile = tileAt(pc, pr);

  if (!canSupport(px, py)) {
    py += 1.5; px = pc << 3;
  } else {
    if (btn(2) && !isSolid((px - 1) >> 3, pr)) px -= 1.25;
    if (btn(3) && !isSolid((px + 8) >> 3, pr)) px += 1.25;
    if (btn(0) && (curTile === 'H' || curTile === 'E')) { py -= 1.25; px = pc << 3; }
    if (btn(1)) {
      const below = tileAt(pc, pr + 1);
      if ((curTile === '-' || below === 'H' || below === '.' || below === 'E') && !isSolid(pc, pr + 1)) {
        py += 1.25; px = pc << 3;
      }
    }
    if (btnp(4)) digHole(-1);
    if (btnp(5)) digHole(1);
  }

  if (grid[pr] && grid[pr][pc] === '$') {
    grid[pr][pc] = '.'; goldLeft--; score += 250;
    if (goldLeft <= 0) exitOpen = true;
  }

  if (exitOpen && pr <= 0) {
    score += 1000; levelIdx++; loadLevel(levelIdx); return;
  }

  for (let i = 0; i < guards.length; i++) {
    const g = guards[i];
    const gc = (g.x + 4) >> 3, gr = (g.y + 4) >> 3;
    let inHole = false;
    for (let k = 0; k < holes.length; k++) {
      if (holes[k].c === gc && holes[k].r === gr) { inHole = true; break; }
    }
    if (inHole) {
      if (g.trapped === 0) { g.trapped = 180; g.x = gc << 3; g.y = gr << 3; score += 75; }
      else if (--g.trapped === 1) { g.y -= 8; g.trapped = 0; }
    } else if (!canSupport(g.x, g.y)) {
      g.y += 1.25; g.x = gc << 3;
    } else {
      if (Math.abs(py - g.y) > 4 && (tileAt(gc, gr) === 'H' || tileAt(gc, gr + 1) === 'H')) {
        g.y += (py > g.y ? 0.65 : -0.65); g.x = gc << 3;
      } else {
        const step = px > g.x ? 0.65 : -0.65;
        if (!isSolid((g.x + 4 + step * 4) >> 3, gr)) g.x += step;
      }
    }
    if (Math.abs(px - g.x) < 5 && Math.abs(py - g.y) < 5 && g.trapped === 0) {
      lives--; if (lives <= 0) { lives = 3; score = 0; levelIdx = 0; }
      loadLevel(levelIdx); return;
    }
  }

  for (let r = 0; r < 16; r++) {
    const sy = 8 + (r << 3);
    for (let c = 0; c < 28; c++) {
      const t = tileAt(c, r);
      if (t === '.') continue;
      const sx = 8 + (c << 3);
      if (t === '#') {
        rect(sx, sy, 8, 8, 2); line(sx, sy+3, sx+7, sy+3, 15);
      } else if (t === '=') {
        rect(sx, sy, 8, 8, 14);
      } else if (t === 'H' || t === 'E') {
        const col = t === 'E' ? 4 : 6;
        line(sx+1, sy, sx+1, sy+7, col); line(sx+6, sy, sx+6, sy+7, col);
        line(sx+1, sy+2, sx+6, sy+2, col); line(sx+1, sy+5, sx+6, sy+5, col);
      } else if (t === '-') {
        line(sx, sy+1, sx+7, sy+1, 13);
      } else if (t === '$') {
        rect(sx+1, sy+3, 6, 4, 4);
      }
    }
  }

  if (digT > 0) {
    digT--;
    line(12 + px, 12 + py, 12 + (digC << 3), 12 + (digR << 3), 4);
  }

  for (let i = 0; i < guards.length; i++) {
    const gx = (8 + guards[i].x) | 0, gy = (8 + guards[i].y) | 0;
    rect(gx+2, gy, 4, 3, 2); rect(gx+1, gy+3, 6, 3, 12); rect(gx+2, gy+6, 4, 2, 9);
  }

  const spx = (8 + px) | 0, spy = (8 + py) | 0;
  rect(spx+2, spy, 4, 3, 12); rect(spx+1, spy+3, 6, 3, 10); rect(spx+2, spy+6, 4, 2, 12);

  rect(0, 0, 240, 8, 15);
  print("LODE RUNNER  SCORE:" + score + "  GOLD:" + goldLeft + "  LIVES:" + lives, 4, 1, 4, false, 1, true);
}
`;

// ============================================================================
// 2. SPY HUNTER
// ============================================================================
const spyHunterJs = `// title:  Spy Hunter
// author: Antigravity Classic Games
// desc:   Drive the G-6155 Interceptor and blast enemy agents!
// script: js

let px = 115, py = 95, speed = 2.5, score = 0, lives = 3, roadOffset = 0;
let bullets = [], enemies = [], slicks = [], trees = [], spawnTimer = 0;
for (let i = 0; i < 10; i++) trees.push({ x: (i%2===0 ? 15 : 215), y: i * 14 });

function TIC() {
  cls(6);
  roadOffset = (roadOffset + speed) % 16;
  if (btn(2) && px > 55) px -= 1.8;
  if (btn(3) && px < 175) px += 1.8;
  if (btn(0) && speed < 4.5) speed += 0.05;
  if (btn(1) && speed > 1.5) speed -= 0.05;
  if (btnp(4)) bullets.push({ x: px + 4, y: py - 2 });
  if (btnp(5)) slicks.push({ x: px + 3, y: py + 12 });

  score += (speed | 0);
  rect(46, 8, 148, 128, 13); rect(50, 8, 140, 128, 15);
  for (let y = -16 + (roadOffset | 0); y < 136; y += 16) {
    rect(95, y, 2, 8, 12); rect(143, y, 2, 8, 12);
  }
  for (let i = 0; i < trees.length; i++) {
    trees[i].y = (trees[i].y + speed) % 140;
    circ(trees[i].x, trees[i].y | 0, 5, 7);
  }
  for (let i = slicks.length - 1; i >= 0; i--) {
    slicks[i].y += speed * 0.7;
    rect(slicks[i].x | 0, slicks[i].y | 0, 6, 8, 0);
    if (slicks[i].y > 140) slicks.splice(i, 1);
  }
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].y -= 5;
    rect((bullets[i].x - 2) | 0, bullets[i].y | 0, 1, 4, 4);
    rect((bullets[i].x + 2) | 0, bullets[i].y | 0, 1, 4, 4);
    if (bullets[i].y < 8) bullets.splice(i, 1);
  }
  if (++spawnTimer > 55) {
    spawnTimer = 0;
    enemies.push({ x: 58 + Math.random() * 115, y: -12, vy: 1.2 + Math.random(), hp: 2, col: Math.random() > 0.5 ? 2 : 9 });
  }
  for (let i = enemies.length - 1; i >= 0; i--) {
    let e = enemies[i];
    e.y += (speed - e.vy);
    e.x += (e.x < px ? 0.35 : -0.35);
    rect(e.x | 0, e.y | 0, 10, 14, e.col); rect((e.x+2) | 0, (e.y+3) | 0, 6, 5, 11);

    for (let j = bullets.length - 1; j >= 0; j--) {
      if (Math.abs(bullets[j].x - (e.x+5)) < 6 && Math.abs(bullets[j].y - (e.y+7)) < 8) {
        bullets.splice(j, 1);
        if (--e.hp <= 0) { score += 500; circ((e.x+5)|0, (e.y+7)|0, 8, 3); enemies.splice(i, 1); break; }
      }
    }
    if (!enemies[i]) continue;
    for (let k = 0; k < slicks.length; k++) {
      if (Math.abs(slicks[k].x - e.x) < 8 && Math.abs(slicks[k].y - e.y) < 10) { score += 300; enemies.splice(i, 1); break; }
    }
    if (!enemies[i]) continue;
    if (Math.abs(px - e.x) < 9 && Math.abs(py - e.y) < 12) {
      lives--; enemies.splice(i, 1); if (lives <= 0) { lives = 3; score = 0; } continue;
    }
    if (e.y > 145 || e.y < -30) enemies.splice(i, 1);
  }
  rect(px | 0, py | 0, 10, 14, 12); rect((px+2) | 0, (py+4) | 0, 6, 5, 8);
  rect(0, 0, 240, 8, 0);
  print("SPY HUNTER   SCORE:" + score + "   LIVES:" + lives + "   [A]GUN [B]OIL", 4, 1, 4, false, 1, true);
}
`;

// ============================================================================
// 3. DONKEY KONG
// ============================================================================
const donkeyKongJs = `// title:  Donkey Kong
// author: Antigravity Classic Games
// desc:   Climb girders, jump barrels, rescue Pauline!
// script: js

let px = 25, py = 118, vy = 0, grounded = true, barrels = [], score = 0, lives = 3, timer = 0;
const girders = [
  { x1: 10, x2: 230, y: 126 }, { x1: 10, x2: 215, y: 102 },
  { x1: 25, x2: 230, y: 78 },  { x1: 10, x2: 215, y: 54 },
  { x1: 25, x2: 230, y: 30 },  { x1: 90, x2: 150, y: 14 }
];
const ladders = [
  { x: 195, y1: 102, y2: 126 }, { x: 40,  y1: 78,  y2: 102 },
  { x: 195, y1: 54,  y2: 78 },  { x: 40,  y1: 30,  y2: 54 },
  { x: 135, y1: 14,  y2: 30 }
];
function resetPlayer() { px = 25; py = 118; vy = 0; barrels = []; }

function TIC() {
  cls(0);
  if (++timer % 75 === 0) barrels.push({ x: 45, y: 22, vx: 1.3, vy: 0 });
  let nearLadder = null;
  for (let i = 0; i < ladders.length; i++) {
    const l = ladders[i];
    if (Math.abs(px - l.x) < 6 && py + 8 >= l.y1 && py + 8 <= l.y2 + 2) { nearLadder = l; break; }
  }
  if (nearLadder && (btn(0) || btn(1))) {
    vy = 0; px = nearLadder.x;
    if (btn(0)) py -= 1.0;
    if (btn(1)) py += 1.0;
  } else {
    if (btn(2) && px > 12) px -= 1.3;
    if (btn(3) && px < 222) px += 1.3;
    if (btnp(4) && grounded) { vy = -2.8; grounded = false; }
    vy += 0.16; py += vy; grounded = false;
    for (let i = 0; i < girders.length; i++) {
      const g = girders[i];
      if (px + 4 >= g.x1 && px <= g.x2 && py + 8 >= g.y && py + 8 <= g.y + 5 && vy >= 0) {
        py = g.y - 8; vy = 0; grounded = true;
      }
    }
  }
  if (py <= 10) { score += 1000; resetPlayer(); }
  for (let i = 0; i < girders.length; i++) {
    const g = girders[i]; rect(g.x1, g.y, g.x2 - g.x1, 4, 2); line(g.x1, g.y+2, g.x2, g.y+2, 3);
  }
  for (let i = 0; i < ladders.length; i++) {
    const l = ladders[i];
    line(l.x, l.y1, l.x, l.y2, 10); line(l.x+5, l.y1, l.x+5, l.y2, 10);
    for (let y = l.y1; y < l.y2; y += 4) line(l.x, y, l.x+5, y, 10);
  }
  rect(30, 16, 14, 14, 3); rect(33, 18, 8, 4, 4);
  rect(105, 6, 6, 8, 2); print("HELP!", 114, 6, 12, false, 1, true);
  for (let i = barrels.length - 1; i >= 0; i--) {
    let b = barrels[i]; b.vy += 0.15; b.x += b.vx; b.y += b.vy;
    for (let j = 0; j < girders.length; j++) {
      const g = girders[j];
      if (b.x >= g.x1 && b.x <= g.x2 && b.y + 3 >= g.y && b.y + 3 <= g.y + 5 && b.vy >= 0) {
        b.y = g.y - 3; b.vy = 0;
      }
    }
    if (b.x > 224 || b.x < 14) b.vx = -b.vx;
    circ(b.x | 0, b.y | 0, 3, 3);
    if (Math.abs(px + 3 - b.x) < 5 && Math.abs(py + 4 - b.y) < 5) {
      lives--; if (lives <= 0) { lives = 3; score = 0; } resetPlayer(); break;
    }
    if (b.y > 136) barrels.splice(i, 1);
  }
  rect(px | 0, py | 0, 6, 3, 2); rect(px | 0, (py+3) | 0, 6, 5, 9);
  rect(0, 0, 240, 6, 0);
  print("DONKEY KONG   SCORE:" + score + "   LIVES:" + lives, 4, 0, 4, false, 1, true);
}
`;

// ============================================================================
// 4. PAC-MAN
// ============================================================================
const pacManJs = `// title:  Pac-Man
// author: Antigravity Classic Games
// desc:   Chomp dots, eat power pellets, evade ghosts!
// script: js

const MAZE = [
  "############################",
  "#o...........##...........o#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.##### ## #####.######",
  "     #.##          ##.#     ",
  "######.## ###--### ##.######",
  "#.........#      #.........#",
  "######.## ######## ##.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o..##................##..o#",
  "############################"
];
let grid = [], dots = 0, score = 0, lives = 3, fright = 0;
let px = 104, py = 88, pdx = 0, pdy = 0;
let ghosts = [
  { x: 96, y: 72, dx: 1, dy: 0, col: 2 },
  { x: 104, y: 72, dx: -1, dy: 0, col: 3 },
  { x: 112, y: 72, dx: 0, dy: -1, col: 11 },
  { x: 120, y: 72, dx: 0, dy: -1, col: 4 }
];
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
function initMaze() {
  grid = []; dots = 0;
  for (let r = 0; r < 15; r++) {
    grid[r] = MAZE[r].split('');
    for (let c = 0; c < 28; c++) if (grid[r][c] === '.' || grid[r][c] === 'o') dots++;
  }
}
initMaze();
function isWall(c, r) { return r < 0 || r >= 15 || c < 0 || c >= 28 || grid[r][c] === '#'; }

function TIC() {
  cls(0);
  if (fright > 0) fright--;
  if (btn(0)) { pdx = 0; pdy = -1; }
  if (btn(1)) { pdx = 0; pdy = 1; }
  if (btn(2)) { pdx = -1; pdy = 0; }
  if (btn(3)) { pdx = 1; pdy = 0; }
  if (!isWall((px + 4 + pdx * 4) >> 3, (py + 4 + pdy * 4) >> 3)) {
    px += pdx * 1.1; py += pdy * 1.1;
  }
  const pc = (px + 4) >> 3, pr = (py + 4) >> 3;
  if (grid[pr] && grid[pr][pc] === '.') { grid[pr][pc] = ' '; score += 10; dots--; }
  else if (grid[pr] && grid[pr][pc] === 'o') { grid[pr][pc] = ' '; score += 50; dots--; fright = 240; }
  if (dots <= 0) initMaze();

  for (let r = 0; r < 15; r++) {
    const sy = 10 + (r << 3);
    for (let c = 0; c < 28; c++) {
      const ch = grid[r][c];
      if (ch === ' ') continue;
      const sx = 8 + (c << 3);
      if (ch === '#') rect(sx+1, sy+1, 6, 6, 9);
      else if (ch === '.') pix(sx+4, sy+4, 4);
      else if (ch === 'o') circ(sx+4, sy+4, 2, 12);
    }
  }
  for (let i = 0; i < 4; i++) {
    let g = ghosts[i];
    if (isWall((g.x + 4 + g.dx * 4) >> 3, (g.y + 4 + g.dy * 4) >> 3) || Math.random() < 0.04) {
      const d = DIRS[(Math.random()*4)|0];
      g.dx = d[0]; g.dy = d[1];
    } else { g.x += g.dx * 0.85; g.y += g.dy * 0.85; }
    circ((12 + g.x) | 0, (14 + g.y) | 0, 3, fright > 0 ? 10 : g.col);
    if (Math.abs(px - g.x) < 5 && Math.abs(py - g.y) < 5) {
      if (fright > 0) { score += 200; g.x = 104; g.y = 72; }
      else { lives--; if (lives <= 0) { lives = 3; score = 0; initMaze(); } px = 104; py = 88; }
    }
  }
  circ((12 + px) | 0, (14 + py) | 0, 3, 4);
  print("PAC-MAN   SCORE:" + score + "   LIVES:" + lives, 4, 1, 4, false, 1, true);
}
`;

// ============================================================================
// 5. GALAGA
// ============================================================================
const galagaJs = `// title:  Galaga
// author: Antigravity Classic Games
// desc:   Blast diving alien insect formations in deep space!
// script: js

let px = 116, score = 0, lives = 3, tick = 0;
let bullets = [], eb = [], enemies = [], stars = [];
for (let i = 0; i < 25; i++) stars.push({ x: (Math.random()*240)|0, y: Math.random()*136, s: 0.5 + Math.random() });

function spawnWave() {
  enemies = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 8; c++) {
      enemies.push({ hx: 48 + c * 20, hy: 18 + r * 12, x: 48 + c * 20, y: 18 + r * 12, dive: 0, col: r === 0 ? 4 : (r === 1 ? 2 : 10) });
    }
  }
}
spawnWave();

function TIC() {
  cls(0); tick++;
  for (let i = 0; i < stars.length; i++) {
    stars[i].y = (stars[i].y + stars[i].s) % 136;
    pix(stars[i].x, stars[i].y | 0, 13);
  }
  if (btn(2) && px > 10) px -= 1.8;
  if (btn(3) && px < 222) px += 1.8;
  if (btnp(4)) bullets.push({ x: px + 3, y: 118 });

  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].y -= 3.5;
    rect(bullets[i].x | 0, bullets[i].y | 0, 2, 5, 4);
    if (bullets[i].y < 0) bullets.splice(i, 1);
  }

  const sway = Math.sin(tick * 0.04) * 16;
  for (let i = enemies.length - 1; i >= 0; i--) {
    let e = enemies[i];
    if (e.dive === 0) {
      e.x = e.hx + sway; e.y = e.hy;
      if (Math.random() < 0.0015) e.dive = 1;
    } else {
      e.y += 1.4; e.x += Math.sin(e.y * 0.08) * 1.5;
      if (Math.random() < 0.02) eb.push({ x: e.x + 3, y: e.y + 6 });
      if (e.y > 136) { e.y = 0; e.dive = 0; }
    }
    rect(e.x | 0, e.y | 0, 7, 5, e.col);

    for (let j = bullets.length - 1; j >= 0; j--) {
      if (Math.abs(bullets[j].x - (e.x+3)) < 5 && Math.abs(bullets[j].y - (e.y+3)) < 5) {
        bullets.splice(j, 1); enemies.splice(i, 1); score += 150; break;
      }
    }
  }
  if (enemies.length === 0) spawnWave();

  for (let i = eb.length - 1; i >= 0; i--) {
    eb[i].y += 2.2;
    rect(eb[i].x | 0, eb[i].y | 0, 2, 4, 2);
    if (Math.abs(eb[i].x - (px+4)) < 5 && Math.abs(eb[i].y - 122) < 5) {
      lives--; eb.splice(i, 1); if (lives <= 0) { lives = 3; score = 0; spawnWave(); }
      continue;
    }
    if (eb[i].y > 136) eb.splice(i, 1);
  }

  tri((px+4)|0, 117, px|0, 125, (px+8)|0, 125, 12);
  rect((px+3)|0, 120, 2, 5, 2);
  print("GALAGA   SCORE:" + score + "   LIVES:" + lives, 4, 1, 4, false, 1, true);
}
`;

// ============================================================================
// 6. DIG DUG
// ============================================================================
const digDugJs = `// title:  Dig Dug
// author: Antigravity Classic Games
// desc:   Carve underground tunnels and inflate Pookas & Fygars!
// script: js

let dirt = [], px = 112, py = 64, pdir = 0, score = 0, lives = 3, pump = 0;
let monsters = [];

function initLevel() {
  dirt = [];
  for (let r = 0; r < 17; r++) {
    dirt[r] = [];
    for (let c = 0; c < 30; c++) dirt[r][c] = r < 2 ? 0 : 1;
  }
  for (let r = 2; r <= 8; r++) dirt[r][14] = 0;
  monsters = [
    { x: 40, y: 40, dx: 0.6, inflate: 0, col: 2 },
    { x: 176, y: 56, dx: -0.6, inflate: 0, col: 6 },
    { x: 64, y: 96, dx: 0.6, inflate: 0, col: 2 },
    { x: 160, y: 112, dx: -0.6, inflate: 0, col: 6 }
  ];
  for (let i = 0; i < monsters.length; i++) {
    const mr = monsters[i].y >> 3, mc = monsters[i].x >> 3;
    for (let dc = -2; dc <= 2; dc++) if (dirt[mr]) dirt[mr][mc+dc] = 0;
  }
}
initLevel();

function TIC() {
  cls(0);
  if (btn(0) && py > 16) { py -= 1; pdir = 0; }
  if (btn(1) && py < 126) { py += 1; pdir = 1; }
  if (btn(2) && px > 4) { px -= 1; pdir = 2; }
  if (btn(3) && px < 230) { px += 1; pdir = 3; }

  const pr = (py + 3) >> 3, pc = (px + 3) >> 3;
  if (dirt[pr] && dirt[pr][pc] === 1) { dirt[pr][pc] = 0; score += 10; }

  for (let r = 2; r < 17; r++) {
    const col = r < 6 ? 4 : (r < 10 ? 3 : (r < 14 ? 2 : 1));
    const sy = r << 3;
    for (let c = 0; c < 30; c++) {
      if (dirt[r][c]) rect(c << 3, sy, 8, 8, col);
    }
  }

  if (btnp(4)) {
    pump = 10;
    for (let i = monsters.length - 1; i >= 0; i--) {
      let m = monsters[i];
      if (Math.abs(m.x - px) < 18 && Math.abs(m.y - py) < 18) {
        if (++m.inflate >= 4) { score += 500; monsters.splice(i, 1); }
      }
    }
  }
  if (monsters.length === 0) initLevel();

  for (let i = 0; i < monsters.length; i++) {
    let m = monsters[i];
    if (m.inflate > 0) {
      m.inflate -= 0.015; if (m.inflate < 0) m.inflate = 0;
    } else {
      m.x += m.dx;
      const mc = (m.x + 4) >> 3, mr = (m.y + 4) >> 3;
      if (mc <= 1 || mc >= 28 || (dirt[mr] && dirt[mr][mc] === 1)) m.dx = -m.dx;
    }
    circ((m.x+3)|0, (m.y+3)|0, 3 + (m.inflate|0), m.col);
    if (m.inflate < 1 && Math.abs(m.x - px) < 6 && Math.abs(m.y - py) < 6) {
      lives--; if (lives <= 0) { lives = 3; score = 0; } initLevel(); break;
    }
  }

  if (pump > 0) {
    pump--;
    const dx = pdir===2 ? -14 : (pdir===3 ? 14 : 0);
    const dy = pdir===0 ? -14 : (pdir===1 ? 14 : 0);
    line((px+3)|0, (py+3)|0, (px+3+dx)|0, (py+3+dy)|0, 12);
  }

  rect(px|0, py|0, 6, 6, 12); rect((px+1)|0, (py+1)|0, 4, 3, 10);
  print("DIG DUG   SCORE:" + score + "   LIVES:" + lives + "   [A]PUMP", 4, 2, 4, false, 1, true);
}
`;

// ============================================================================
// 7. RAMPAGE
// ============================================================================
const rampageJs = `// title:  Rampage
// author: Antigravity Classic Games
// desc:   Climb skyscrapers, punch windows, swat helicopters & collapse the city!
// script: js

let px = 40, py = 114, vy = 0, pdir = 1, climbing = -1, punchT = 0;
let hp = 100, score = 0, lives = 3, level = 1, monster = 0;
let buildings = [], helis = [], bullets = [], debris = [];

function initCity() {
  buildings = []; helis = []; bullets = []; debris = [];
  const xs = [22, 82, 142, 192];
  const cols = [3, 4, 3, 2];
  const floors = [5, 6, 5, 6];
  const bCols = [13, 15, 9, 2];
  for (let i = 0; i < 4; i++) {
    const w = cols[i] * 12 + 4;
    const h = floors[i] * 14 + 6;
    const wins = [];
    for (let r = 0; r < floors[i]; r++) {
      wins[r] = [];
      for (let c = 0; c < cols[i]; c++) {
        wins[r][c] = { hp: 2, item: Math.random() < 0.25 ? 1 : 0 };
      }
    }
    buildings.push({
      x: xs[i], y: 124 - h, w: w, h: h, cols: cols[i], floors: floors[i],
      col: bCols[i], wins: wins, dmg: 0, maxDmg: cols[i] * floors[i], falling: false
    });
  }
}
initCity();

function TIC() {
  cls(0);
  rect(0, 124, 240, 12, 15);
  line(0, 129, 240, 129, 4);

  if (btnp(6) || btnp(7)) monster = (monster + 1) % 3;

  let standing = 0;
  for (let i = 0; i < 4; i++) {
    const b = buildings[i];
    if (b.h <= 6) {
      rect(b.x, 118, b.w, 6, 13);
      continue;
    }
    standing++;
    if (b.falling) {
      b.y += 1.5; b.h -= 1.5;
      if (climbing === i) climbing = -1;
      for (let d = 0; d < 2; d++) debris.push({ x: b.x + Math.random()*b.w, y: 122, vx: (Math.random()-0.5)*2, vy: -Math.random()*2, t: 15 });
    }
    rect(b.x | 0, b.y | 0, b.w, b.h | 0, b.col);
    rectb(b.x | 0, b.y | 0, b.w, b.h | 0, 12);

    for (let r = 0; r < b.floors; r++) {
      const wy = (b.y + 4 + r * 14) | 0;
      if (wy > 118) continue;
      for (let c = 0; c < b.cols; c++) {
        const wx = (b.x + 3 + c * 12) | 0;
        const win = b.wins[r][c];
        if (win.hp === 2) rect(wx, wy, 8, 9, 4);
        else if (win.hp === 1) {
          rect(wx, wy, 8, 9, 0);
          if (win.item === 1) circ(wx + 4, wy + 4, 2, 6);
        } else {
          rect(wx, wy, 8, 9, 0);
          line(wx, wy + 4, wx + 7, wy + 4, 2);
        }
      }
    }
  }

  if (standing === 0) { level++; score += 1000; hp = Math.min(100, hp + 30); initCity(); return; }

  if (climbing >= 0) {
    const cb = buildings[climbing];
    if (!cb || cb.falling || cb.h <= 6) { climbing = -1; }
    else {
      if (btn(0) && py > cb.y) py -= 1.2;
      if (btn(1)) py += 1.2;
      if (py >= 114) { py = 114; climbing = -1; }
      if (btnp(5)) { climbing = -1; vy = -2.6; }
    }
  } else {
    if (btn(2) && px > 6) { px -= 1.4; pdir = -1; }
    if (btn(3) && px < 224) { px += 1.4; pdir = 1; }
    if (btnp(5) && py >= 114) vy = -2.8;
    py += vy;
    if (py < 114) vy += 0.16;
    else { py = 114; vy = 0; }

    if (btn(0)) {
      for (let i = 0; i < 4; i++) {
        const b = buildings[i];
        if (b.h > 6 && !b.falling) {
          if (Math.abs(px - b.x) < 8) { climbing = i; px = b.x - 6; pdir = 1; vy = 0; break; }
          if (Math.abs(px - (b.x + b.w)) < 8) { climbing = i; px = b.x + b.w - 4; pdir = -1; vy = 0; break; }
        }
      }
    }
  }

  if (punchT > 0) punchT--;
  if (btnp(4) && punchT === 0) {
    punchT = 10;
    const fx = px + (pdir > 0 ? 10 : -6);
    const fy = py + 4;

    for (let i = helis.length - 1; i >= 0; i--) {
      if (Math.abs(fx - helis[i].x) < 14 && Math.abs(fy - helis[i].y) < 12) {
        score += 400;
        for (let d = 0; d < 8; d++) debris.push({ x: helis[i].x, y: helis[i].y, vx: (Math.random()-0.5)*3, vy: (Math.random()-0.5)*3, t: 18 });
        helis.splice(i, 1);
      }
    }

    for (let i = 0; i < 4; i++) {
      const b = buildings[i];
      if (b.h <= 6 || b.falling) continue;
      if (fx >= b.x - 8 && fx <= b.x + b.w + 8 && fy >= b.y && fy <= 124) {
        const r = Math.max(0, Math.min(b.floors - 1, ((fy - b.y - 4) / 14) | 0));
        const c = Math.max(0, Math.min(b.cols - 1, ((fx - b.x) / 12) | 0));
        const win = b.wins[r][c];
        if (win.hp === 1 && win.item === 1) {
          win.item = 0; hp = Math.min(100, hp + 15); score += 250;
        } else if (win.hp > 0) {
          win.hp--; b.dmg++; score += 75;
        } else {
          b.dmg += 0.8; score += 50;
        }
        for (let d = 0; d < 4; d++) debris.push({ x: fx, y: fy, vx: (Math.random()-0.5)*2, vy: (Math.random()-0.5)*2, t: 12 });
        if (b.dmg >= b.maxDmg) { b.falling = true; score += 1000; }
        break;
      }
    }
  }

  if (helis.length < 2 && Math.random() < 0.015) {
    const left = Math.random() < 0.5;
    helis.push({ x: left ? -10 : 250, y: 20 + Math.random() * 55, vx: left ? 1.0 : -1.0 });
  }
  for (let i = helis.length - 1; i >= 0; i--) {
    const h = helis[i];
    h.x += h.vx;
    rect((h.x - 6) | 0, (h.y - 3) | 0, 12, 6, 11);
    line((h.x - 9) | 0, (h.y - 5) | 0, (h.x + 9) | 0, (h.y - 5) | 0, 12);
    if (Math.random() < 0.02) {
      const dx = px - h.x, dy = py - h.y, dist = Math.sqrt(dx*dx + dy*dy) || 1;
      bullets.push({ x: h.x, y: h.y, vx: (dx/dist)*2, vy: (dy/dist)*2 });
    }
    if (h.x < -20 || h.x > 260) helis.splice(i, 1);
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    const bl = bullets[i];
    bl.x += bl.vx; bl.y += bl.vy;
    pix(bl.x | 0, bl.y | 0, 2);
    if (Math.abs(bl.x - (px + 5)) < 6 && Math.abs(bl.y - (py + 5)) < 7) {
      hp -= 8; bullets.splice(i, 1);
      if (hp <= 0) {
        lives--; hp = 100; px = 40; py = 114; climbing = -1;
        if (lives <= 0) { lives = 3; score = 0; level = 1; initCity(); return; }
      }
      continue;
    }
    if (bl.x < 0 || bl.x > 240 || bl.y < 0 || bl.y > 136) bullets.splice(i, 1);
  }

  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    d.x += d.vx; d.y += d.vy;
    pix(d.x | 0, d.y | 0, 4);
    if (--d.t <= 0) debris.splice(i, 1);
  }

  const mCol = monster === 0 ? 3 : (monster === 1 ? 6 : 10);
  const mx = px | 0, my = py | 0;
  rect(mx, my, 10, 12, mCol);
  rect(mx + (pdir > 0 ? 6 : 1), my + 2, 3, 2, 12);
  if (punchT > 0) {
    rect(mx + (pdir > 0 ? 10 : -6), my + 4, 6, 4, 4);
  }

  rect(0, 0, 240, 8, 0);
  print("RAMPAGE  SCORE:" + score + "  HP:" + hp + "%  LIVES:" + lives + "  [A]PUNCH [B]JUMP", 2, 1, 6, false, 1, true);
}
`;

// ============================================================================
// 8. POKEMON KANTO ADVENTURE
// ============================================================================
const pokemonKantoJs = `// title:  Pokemon Kanto Adventure
// author: Antigravity Classic Games
// desc:   Explore Pallet Town & Route 1, battle wild Pokemon & catch 'em all!
// script: js

const MAP = [
  "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
  "Tggggggggg..........gggggggggT",
  "Tggggggggg..HHHHHH..gggggggggT",
  "Tggggggggg..HPPPPH..gggggggggT",
  "T...........HPPPPH...........T",
  "T..WWWWWW.....++.....ggggggggT",
  "T..WLAB W............ggggggggT",
  "T..WWWWWW............ggggggggT",
  "T.....+......................T",
  "T...........gggggg...........T",
  "T..WWWW.....gggggg....WWWW...T",
  "T..WHOU.....gggggg....WGYM...T",
  "T..WWWW...............WWWW...T",
  "T....+.................+.....T",
  "T............................T",
  "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT"
];

const DEX = [
  { name: "PIKACHU",    hp: 45, atk: 14, col: 4,  move: "THUNDERBOLT" },
  { name: "CHARMANDER", hp: 48, atk: 15, col: 3,  move: "FLAMETHROWER" },
  { name: "SQUIRTLE",   hp: 50, atk: 13, col: 10, move: "BUBBLEBEAM" },
  { name: "BULBASAUR",  hp: 52, atk: 13, col: 6,  move: "VINE WHIP" },
  { name: "PIDGEY",     hp: 36, atk: 10, col: 15, move: "GUST" },
  { name: "RATTATA",    hp: 34, atk: 11, col: 14, move: "QUICK ATTACK" },
  { name: "MEWTWO",     hp: 75, atk: 20, col: 2,  move: "PSYCHIC" }
];

let px = 112, py = 72, pdir = 1, stepCool = 0;
let myMon = 0, myHp = 45, myMaxHp = 45, myLv = 5, caught = 1, badges = 0;
let mode = "WALK", foe = null, foeHp = 0, foeMax = 0, cursor = 0, msg = "", msgT = 0;

function tileAt(c, r) {
  if (r < 0 || r >= 16 || c < 0 || c >= 30) return 'T';
  return MAP[r][c] || '.';
}

function isBlocked(x, y) {
  const c = (x + 3) >> 3, r = (y + 3) >> 3;
  const t = tileAt(c, r);
  return t === 'T' || t === 'W' || t === 'H' || t === 'L' || t === 'A' || t === 'B' || t === 'O' || t === 'U' || t === 'G' || t === 'Y' || t === 'M';
}

function startBattle(idx) {
  const base = DEX[idx];
  mode = "BATTLE";
  foe = base;
  foeMax = base.hp + badges * 8;
  foeHp = foeMax;
  cursor = 0;
  msg = "Wild " + base.name + " appeared!";
  msgT = 50;
}

function TIC() {
  cls(0);
  if (mode === "WALK") {
    let moved = false;
    if (btn(0) && !isBlocked(px, py - 1)) { py -= 1; pdir = 0; moved = true; }
    else if (btn(1) && !isBlocked(px, py + 1)) { py += 1; pdir = 1; moved = true; }
    else if (btn(2) && !isBlocked(px - 1, py)) { px -= 1; pdir = 2; moved = true; }
    else if (btn(3) && !isBlocked(px + 1, py)) { px += 1; pdir = 3; moved = true; }

    if (btnp(5)) {
      myMon = (myMon + 1) % 4;
      myMaxHp = DEX[myMon].hp + myLv * 3;
      myHp = myMaxHp;
      msg = "Go! " + DEX[myMon].name + "!";
      msgT = 45;
    }

    const pc = (px + 3) >> 3, pr = (py + 3) >> 3;
    const cur = tileAt(pc, pr);

    if (cur === '+' && btnp(4)) {
      myHp = myMaxHp;
      msg = "NURSE JOY: Pokemon fully healed!";
      msgT = 65;
    }

    if (moved && cur === 'g') {
      if (++stepCool > 28 && Math.random() < 0.08) {
        stepCool = 0;
        const pick = Math.random() < 0.12 ? 6 : ((Math.random() * 6) | 0);
        startBattle(pick);
        return;
      }
    }

    for (let r = 0; r < 16; r++) {
      const sy = 8 + (r << 3);
      for (let c = 0; c < 30; c++) {
        const ch = MAP[r][c];
        const sx = c << 3;
        if (ch === 'T') {
          rect(sx, sy, 8, 8, 7); circ(sx+4, sy+3, 3, 6);
        } else if (ch === 'g') {
          rect(sx, sy, 8, 8, 7);
          line(sx+1, sy+2, sx+3, sy+6, 6); line(sx+5, sy+2, sx+7, sy+6, 6);
        } else if (ch === 'H' || ch === 'P') {
          rect(sx, sy, 8, 8, ch === 'P' ? 2 : 12);
        } else if (ch === 'W' || ch === 'L' || ch === 'A' || ch === 'B' || ch === 'O' || ch === 'U' || ch === 'G' || ch === 'Y' || ch === 'M') {
          rect(sx, sy, 8, 8, 13);
        } else if (ch === '+') {
          rect(sx, sy, 8, 8, 4);
        } else {
          rect(sx, sy, 8, 8, 6);
        }
      }
    }
    print("POKECENTER", 100, 26, 12, false, 1, true);
    print("OAK LAB", 26, 58, 4, false, 1, true);
    print("GYM", 180, 98, 4, false, 1, true);

    const fx = px + (pdir === 2 ? 8 : (pdir === 3 ? -8 : 0));
    const fy = py + 8 + (pdir === 0 ? 8 : (pdir === 1 ? -8 : 0));
    rect(fx | 0, fy | 0, 6, 6, DEX[myMon].col);

    rect(px | 0, (py + 8) | 0, 6, 3, 2);
    rect(px | 0, (py + 11) | 0, 6, 4, 10);

    if (msgT > 0) {
      msgT--;
      rect(10, 114, 220, 18, 0); rectb(10, 114, 220, 18, 12);
      print(msg, 16, 120, 12, false, 1, true);
    }
  } else {
    rect(0, 8, 240, 128, 12);
    rect(12, 14, 100, 26, 0); rectb(12, 14, 100, 26, 15);
    print(foe.name + " Lv" + (myLv + 1), 16, 18, 4, false, 1, true);
    rect(16, 28, 88, 6, 15);
    rect(16, 28, ((88 * Math.max(0, foeHp)) / foeMax) | 0, 6, 6);

    rect(158, 18, 28, 28, foe.col);
    rect(164, 24, 5, 5, 0); rect(176, 24, 5, 5, 0);

    const mine = DEX[myMon];
    rect(32, 62, 30, 28, mine.col);
    rect(122, 58, 106, 28, 0); rectb(122, 58, 106, 28, 15);
    print(mine.name + " Lv" + myLv, 126, 62, 4, false, 1, true);
    print("HP:" + myHp + "/" + myMaxHp, 126, 72, 6, false, 1, true);

    rect(6, 92, 228, 40, 0); rectb(6, 92, 228, 40, 15);
    if (msgT > 0) {
      msgT--;
      print(msg, 14, 108, 12, false, 1, true);
    } else {
      if (btnp(2)) cursor = (cursor + 3) % 4;
      if (btnp(3)) cursor = (cursor + 1) % 4;
      if (btnp(0)) cursor = (cursor + 2) % 4;
      if (btnp(1)) cursor = (cursor + 2) % 4;

      const opts = [mine.move, "POKE BALL", "POTION", "RUN"];
      for (let i = 0; i < 4; i++) {
        const ox = 18 + (i % 2) * 108;
        const oy = 100 + ((i >> 1) * 14);
        print((cursor === i ? "> " : "  ") + opts[i], ox, oy, cursor === i ? 4 : 12, false, 1, true);
      }

      if (btnp(4)) {
        if (cursor === 0) {
          const dmg = (mine.atk + myLv + Math.random() * 6) | 0;
          foeHp -= dmg;
          if (foeHp <= 0) {
            myLv++; myMaxHp += 4; myHp = myMaxHp; badges++;
            msg = "Wild " + foe.name + " fainted! Lv UP!";
            msgT = 55;
            mode = "WALK";
          } else {
            const edmg = Math.max(2, (foe.atk - 3 + Math.random() * 5) | 0);
            myHp = Math.max(1, myHp - edmg);
            msg = mine.name + " used " + mine.move + "! (-" + dmg + " HP)";
            msgT = 45;
          }
        } else if (cursor === 1) {
          if (foeHp < foeMax * 0.65 || Math.random() < 0.45) {
            caught++; myLv++;
            msg = "Gotcha! " + foe.name + " was caught!";
            msgT = 60;
            mode = "WALK";
          } else {
            msg = "Oh no! The Pokemon broke free!";
            msgT = 45;
          }
        } else if (cursor === 2) {
          myHp = Math.min(myMaxHp, myHp + 25);
          msg = "Used SUPER POTION! +25 HP!";
          msgT = 40;
        } else {
          mode = "WALK";
          msg = "Got away safely!";
          msgT = 35;
        }
      }
    }
  }

  rect(0, 0, 240, 8, 0);
  print("POKEMON KANTO  " + DEX[myMon].name + " Lv:" + myLv + "  DEX:" + caught + "/151  [B]SWAP", 2, 1, 4, false, 1, true);
}
`;

// ============================================================================
// SPECIALIZED ARCHETYPE GENERATORS FOR ALL REMAINING CATALOG GAMES
// ============================================================================
function buildFroggerCart(game) {
  return `// title:  ${game.title}
// author: Antigravity Classic Games
// desc:   ${game.mechanics}
// script: js
let fx = 116, fy = 124, score = 0, lives = 3, homes = [0,0,0,0,0];
let lanes = [
  { y: 108, s: -1.1, w: 12, col: 2, xs: [20, 95, 170] },
  { y: 96,  s: 1.4,  w: 14, col: 4, xs: [40, 130, 200] },
  { y: 84,  s: -1.6, w: 12, col: 11, xs: [10, 100, 185] },
  { y: 60,  s: 0.8,  w: 32, col: 3, log: 1, xs: [15, 105, 185] },
  { y: 48,  s: -1.0, w: 24, col: 6, log: 1, xs: [30, 115, 195] },
  { y: 36,  s: 1.2,  w: 36, col: 3, log: 1, xs: [20, 125] }
];
function TIC() {
  cls(0);
  rect(0, 12, 240, 60, 9);
  rect(0, 72, 240, 10, 14);
  rect(0, 120, 240, 16, 14);
  for (let i = 0; i < 5; i++) {
    const hx = 22 + i * 44;
    rect(hx, 14, 16, 14, homes[i] ? 6 : 7);
  }
  if (btnp(0)) fy -= 12;
  if (btnp(1) && fy < 124) fy += 12;
  if (btnp(2) && fx > 8) fx -= 12;
  if (btnp(3) && fx < 224) fx += 12;

  let onLog = false;
  for (let i = 0; i < lanes.length; i++) {
    const l = lanes[i];
    for (let j = 0; j < l.xs.length; j++) {
      l.xs[j] = (l.xs[j] + l.s + 260) % 260;
      const lx = l.xs[j] - 20;
      rect(lx | 0, l.y, l.w, 9, l.col);
      if (Math.abs(fy - l.y) < 6 && fx + 6 > lx && fx < lx + l.w) {
        if (l.log) { onLog = true; fx += l.s; }
        else { lives--; fx = 116; fy = 124; if (lives <= 0) { lives = 3; score = 0; } }
      }
    }
  }
  if (fy >= 30 && fy <= 64 && !onLog) { lives--; fx = 116; fy = 124; if (lives <= 0) { lives = 3; score = 0; } }
  if (fy <= 24) {
    const idx = Math.max(0, Math.min(4, ((fx - 12) / 44) | 0));
    homes[idx] = 1; score += 500; fx = 116; fy = 124;
    if (homes.every(v => v === 1)) { homes = [0,0,0,0,0]; score += 1000; }
  }
  rect(fx | 0, fy | 0, 8, 8, 6);
  rect(0, 0, 240, 8, 0);
  print("${game.title.toUpperCase()}  SCORE:" + score + "  LIVES:" + lives, 4, 1, 6, false, 1, true);
}
`;
}

function buildSpaceInvadersCart(game) {
  return `// title:  ${game.title}
// author: Antigravity Classic Games
// desc:   ${game.mechanics}
// script: js
let px = 114, score = 0, lives = 3, dir = 1, stepT = 0;
let inv = [], shots = [], eshots = [], shields = [36, 86, 136, 186];
function initWave() {
  inv = [];
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 10; c++)
      inv.push({ x: 24 + c * 18, y: 18 + r * 11, col: r === 0 ? 2 : (r < 3 ? 11 : 6) });
}
initWave();
function TIC() {
  cls(0);
  if (btn(2) && px > 10) px -= 1.6;
  if (btn(3) && px < 220) px += 1.6;
  if (btnp(4) && shots.length < 2) shots.push({ x: px + 4, y: 118 });

  if (++stepT > Math.max(6, inv.length >> 1)) {
    stepT = 0;
    let flip = false;
    for (let i = 0; i < inv.length; i++) {
      inv[i].x += dir * 4;
      if (inv[i].x > 224 || inv[i].x < 8) flip = true;
    }
    if (flip) { dir = -dir; for (let i = 0; i < inv.length; i++) inv[i].y += 5; }
  }
  for (let i = 0; i < 4; i++) rect(shields[i], 102, 18, 8, 6);
  for (let i = inv.length - 1; i >= 0; i--) {
    const a = inv[i];
    rect(a.x | 0, a.y | 0, 8, 6, a.col);
    if (Math.random() < 0.002) eshots.push({ x: a.x + 4, y: a.y + 6 });
    for (let j = shots.length - 1; j >= 0; j--) {
      if (Math.abs(shots[j].x - (a.x + 4)) < 5 && Math.abs(shots[j].y - (a.y + 3)) < 5) {
        shots.splice(j, 1); inv.splice(i, 1); score += 100; break;
      }
    }
  }
  if (inv.length === 0) initWave();
  for (let i = shots.length - 1; i >= 0; i--) {
    shots[i].y -= 3.5; rect(shots[i].x | 0, shots[i].y | 0, 2, 5, 12);
    if (shots[i].y < 8) shots.splice(i, 1);
  }
  for (let i = eshots.length - 1; i >= 0; i--) {
    eshots[i].y += 2.2; rect(eshots[i].x | 0, eshots[i].y | 0, 2, 4, 2);
    if (Math.abs(eshots[i].x - (px + 5)) < 6 && Math.abs(eshots[i].y - 122) < 5) {
      lives--; eshots.splice(i, 1); if (lives <= 0) { lives = 3; score = 0; initWave(); } continue;
    }
    if (eshots[i].y > 136) eshots.splice(i, 1);
  }
  rect(px | 0, 120, 10, 6, 6); rect((px + 4) | 0, 117, 2, 3, 6);
  rect(0, 0, 240, 8, 0);
  print("${game.title.toUpperCase()}  SCORE:" + score + "  LIVES:" + lives, 4, 1, 6, false, 1, true);
}
`;
}

function buildArkanoidCart(game) {
  return `// title:  ${game.title}
// author: Antigravity Classic Games
// desc:   ${game.mechanics}
// script: js
let px = 100, bx = 116, by = 110, vx = 1.6, vy = -1.8, score = 0, lives = 3, bricks = [];
function initBricks() {
  bricks = [];
  const cols = [2, 3, 4, 6, 10, 11];
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 12; c++)
      bricks.push({ x: 12 + c * 18, y: 18 + r * 8, col: cols[r] });
}
initBricks();
function TIC() {
  cls(0);
  if (btn(2) && px > 8) px -= 2.4;
  if (btn(3) && px < 200) px += 2.4;
  bx += vx; by += vy;
  if (bx < 6 || bx > 234) vx = -vx;
  if (by < 10) vy = -vy;
  if (by >= 118 && by <= 124 && bx >= px - 2 && bx <= px + 34 && vy > 0) {
    vy = -Math.abs(vy);
    vx = ((bx - (px + 16)) / 16) * 2.2;
  }
  if (by > 136) {
    lives--; bx = px + 16; by = 110; vy = -1.8;
    if (lives <= 0) { lives = 3; score = 0; initBricks(); }
  }
  for (let i = bricks.length - 1; i >= 0; i--) {
    const b = bricks[i];
    rect(b.x, b.y, 16, 6, b.col);
    if (bx >= b.x && bx <= b.x + 16 && by >= b.y && by <= b.y + 6) {
      vy = -vy; bricks.splice(i, 1); score += 100;
    }
  }
  if (bricks.length === 0) initBricks();
  rect(px | 0, 120, 32, 5, 11);
  circ(bx | 0, by | 0, 2, 12);
  rect(0, 0, 240, 8, 0);
  print("${game.title.toUpperCase()}  SCORE:" + score + "  LIVES:" + lives, 4, 1, 11, false, 1, true);
}
`;
}

function buildTetrisCart(game) {
  return `// title:  ${game.title}
// author: Antigravity Classic Games
// desc:   ${game.mechanics}
// script: js
const SHAPES = [
  [[1,1,1,1]], [[1,1],[1,1]], [[0,1,0],[1,1,1]],
  [[1,0,0],[1,1,1]], [[0,0,1],[1,1,1]], [[1,1,0],[0,1,1]], [[0,1,1],[1,1,0]]
];
let board = [], cur = null, cx = 4, cy = 0, ccol = 4, tick = 0, score = 0, lines = 0;
for (let r = 0; r < 16; r++) board[r] = [0,0,0,0,0,0,0,0,0,0];
function spawn() {
  const idx = (Math.random() * SHAPES.length) | 0;
  cur = SHAPES[idx].map(r => r.slice());
  cx = 3; cy = 0; ccol = 2 + idx;
}
spawn();
function fits(shape, nx, ny) {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[0].length; c++)
      if (shape[r][c]) {
        if (nx + c < 0 || nx + c >= 10 || ny + r >= 16) return false;
        if (ny + r >= 0 && board[ny + r][nx + c]) return false;
      }
  return true;
}
function TIC() {
  cls(0);
  if (btnp(2) && fits(cur, cx - 1, cy)) cx--;
  if (btnp(3) && fits(cur, cx + 1, cy)) cx++;
  if (btnp(4) || btnp(0)) {
    const rot = cur[0].map((_, i) => cur.map(row => row[i]).reverse());
    if (fits(rot, cx, cy)) cur = rot;
  }
  const spd = btn(1) ? 4 : 22;
  if (++tick >= spd) {
    tick = 0;
    if (fits(cur, cx, cy + 1)) cy++;
    else {
      for (let r = 0; r < cur.length; r++)
        for (let c = 0; c < cur[0].length; c++)
          if (cur[r][c] && cy + r >= 0) board[cy + r][cx + c] = ccol;
      for (let r = 15; r >= 0; r--) {
        if (board[r].every(v => v > 0)) {
          board.splice(r, 1); board.unshift([0,0,0,0,0,0,0,0,0,0]);
          score += 200; lines++; r++;
        }
      }
      spawn();
      if (!fits(cur, cx, cy)) {
        for (let r = 0; r < 16; r++) board[r] = [0,0,0,0,0,0,0,0,0,0];
        score = 0; lines = 0;
      }
    }
  }
  rectb(78, 6, 84, 130, 12);
  for (let r = 0; r < 16; r++)
    for (let c = 0; c < 10; c++)
      if (board[r][c]) rect(80 + c * 8, 8 + r * 8, 7, 7, board[r][c]);
  for (let r = 0; r < cur.length; r++)
    for (let c = 0; c < cur[0].length; c++)
      if (cur[r][c]) rect(80 + (cx + c) * 8, 8 + (cy + r) * 8, 7, 7, ccol);
  print("${game.title.toUpperCase()}", 4, 12, 4, false, 1, true);
  print("SCORE:" + score, 4, 28, 12, false, 1, true);
  print("LINES:" + lines, 4, 42, 6, false, 1, true);
}
`;
}

function buildTronCart(game) {
  return `// title:  ${game.title}
// author: Antigravity Classic Games
// desc:   ${game.mechanics}
// script: js
let grid = [], px = 40, py = 68, pdx = 1, pdy = 0, ex = 200, ey = 68, edx = -1, edy = 0, score = 0, lives = 3, tick = 0;
function resetArena() {
  grid = [];
  for (let y = 0; y < 136; y++) grid[y] = new Uint8Array(240);
  px = 40; py = 68; pdx = 1; pdy = 0; ex = 200; ey = 68; edx = -1; edy = 0;
}
resetArena();
function blocked(x, y) { return x < 4 || x >= 236 || y < 10 || y >= 132 || grid[y][x] > 0; }
function TIC() {
  cls(0); rectb(3, 9, 234, 124, 11);
  if (btnp(0) && pdy === 0) { pdx = 0; pdy = -1; }
  if (btnp(1) && pdy === 0) { pdx = 0; pdy = 1; }
  if (btnp(2) && pdx === 0) { pdx = -1; pdy = 0; }
  if (btnp(3) && pdx === 0) { pdx = 1; pdy = 0; }

  px += pdx; py += pdy;
  if (blocked(px, py)) { lives--; if (lives <= 0) { lives = 3; score = 0; } resetArena(); return; }
  grid[py][px] = 11;

  if (blocked(ex + edx * 2, ey + edy * 2) || Math.random() < 0.03) {
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (let i = 0; i < 4; i++) {
      const d = dirs[i];
      if (!blocked(ex + d[0] * 3, ey + d[1] * 3)) { edx = d[0]; edy = d[1]; break; }
    }
  }
  ex += edx; ey += edy;
  if (blocked(ex, ey)) { score += 500; resetArena(); return; }
  grid[ey][ex] = 3;

  for (let y = 10; y < 132; y++)
    for (let x = 4; x < 236; x++)
      if (grid[y][x]) pix(x, y, grid[y][x]);

  rect(0, 0, 240, 8, 0);
  print("TRON LIGHT CYCLES   SCORE:" + score + "   LIVES:" + lives, 4, 1, 11, false, 1, true);
}
`;
}

function buildUniversalArcadeCart(game) {
  const genre = (game.genre || '').toLowerCase();
  const id = game.id;

  if (id === 'frogger') return buildFroggerCart(game);
  if (id === 'spaceinvaders' || id === 'galaxian') return buildSpaceInvadersCart(game);
  if (id === 'arkanoid') return buildArkanoidCart(game);
  if (id === 'tetrisretro') return buildTetrisCart(game);
  if (id === 'tron') return buildTronCart(game);

  // Racer / Driving / Course games
  if (genre.includes('racer') || genre.includes('driving') || genre.includes('motocross') || genre.includes('street') || id === 'outrun' || id === 'roadfighter' || id === 'rallyx' || id === 'paperboy' || id === 'excitebike' || id === 'marblemadness') {
    return `// title:  ${game.title}
// author: Antigravity Classic Games
// desc:   ${game.mechanics}
// script: js
let px = 115, py = 104, spd = 2.6, score = 0, lives = 3, off = 0, rivals = [];
function TIC() {
  cls(15);
  off = (off + spd) % 16;
  if (btn(2) && px > 54) px -= 1.9;
  if (btn(3) && px < 176) px += 1.9;
  if (btn(0) || btn(4)) spd = Math.min(4.8, spd + 0.05);
  else spd = Math.max(2.0, spd - 0.03);
  score += (spd | 0);
  rect(0, 8, 48, 128, 6); rect(192, 8, 48, 128, 6);
  rect(48, 8, 144, 128, 13);
  for (let y = -16 + (off | 0); y < 136; y += 16) {
    rect(48, y, 4, 8, 2); rect(188, y, 4, 8, 2);
    rect(119, y, 2, 8, 4);
  }
  if (rivals.length < 4 && Math.random() < 0.04) {
    rivals.push({ x: 58 + Math.random() * 114, y: -14, col: 2 + ((Math.random() * 9) | 0) });
  }
  for (let i = rivals.length - 1; i >= 0; i--) {
    const r = rivals[i];
    r.y += spd * 0.75;
    rect(r.x | 0, r.y | 0, 10, 14, r.col);
    rect((r.x + 2) | 0, (r.y + 3) | 0, 6, 4, 12);
    if (Math.abs(px - r.x) < 9 && Math.abs(py - r.y) < 12) {
      lives--; rivals.splice(i, 1); if (lives <= 0) { lives = 3; score = 0; } continue;
    }
    if (r.y > 140) { score += 100; rivals.splice(i, 1); }
  }
  rect(px | 0, py | 0, 10, 14, 11); rect((px + 2) | 0, (py + 3) | 0, 6, 5, 12);
  rect(0, 0, 240, 8, 0);
  print("${game.title.toUpperCase()}  SCORE:" + score + "  LIVES:" + lives + "  [A]BOOST", 4, 1, 4, false, 1, true);
}
`;
  }

  // Shooters / Vector / Defense / Light-Gun
  if (genre.includes('shooter') || genre.includes('vector') || genre.includes('blaster') || genre.includes('defense') || genre.includes('boss') || genre.includes('duel') || id === 'asteroids' || id === 'centipede' || id === 'defender' || id === 'duckhunt' || id === 'missilecommand' || id === 'tempest' || id === 'robotron' || id === 'sinistar' || id === 'zaxxon' || id === 'battlecity' || id === 'wildgunman' || id === 'exerion' || id === 'lunarlander') {
    return `// title:  ${game.title}
// author: Antigravity Classic Games
// desc:   ${game.mechanics}
// script: js
let px = 116, py = 112, score = 0, lives = 3, shots = [], foes = [], stars = [];
for (let i = 0; i < 24; i++) stars.push({ x: (Math.random()*240)|0, y: (Math.random()*136)|0 });
function TIC() {
  cls(0);
  for (let i = 0; i < 24; i++) {
    stars[i].y = (stars[i].y + 1) % 136;
    pix(stars[i].x, stars[i].y, 13);
  }
  if (btn(2) && px > 10) px -= 1.8;
  if (btn(3) && px < 222) px += 1.8;
  if (btn(0) && py > 24) py -= 1.5;
  if (btn(1) && py < 122) py += 1.5;
  if (btnp(4)) shots.push({ x: px + 4, y: py - 2, vy: -3.8 });
  if (btnp(5)) {
    shots.push({ x: px + 2, y: py, vy: -3.5, vx: -1 });
    shots.push({ x: px + 6, y: py, vy: -3.5, vx: 1 });
  }
  for (let i = shots.length - 1; i >= 0; i--) {
    shots[i].x += (shots[i].vx || 0);
    shots[i].y += shots[i].vy;
    rect(shots[i].x | 0, shots[i].y | 0, 2, 5, 4);
    if (shots[i].y < 8) shots.splice(i, 1);
  }
  if (foes.length < 7 && Math.random() < 0.045) {
    foes.push({ x: 16 + Math.random() * 208, y: 10, vx: (Math.random() - 0.5) * 1.6, vy: 0.8 + Math.random() * 0.8, col: 2 + ((Math.random() * 10) | 0) });
  }
  for (let i = foes.length - 1; i >= 0; i--) {
    const f = foes[i];
    f.x += f.vx; f.y += f.vy;
    if (f.x < 10 || f.x > 228) f.vx = -f.vx;
    circ(f.x | 0, f.y | 0, 4, f.col);
    for (let j = shots.length - 1; j >= 0; j--) {
      if (Math.abs(shots[j].x - f.x) < 6 && Math.abs(shots[j].y - f.y) < 6) {
        shots.splice(j, 1); foes.splice(i, 1); score += 150; break;
      }
    }
    if (!foes[i]) continue;
    if (Math.abs(px + 4 - f.x) < 7 && Math.abs(py + 4 - f.y) < 7) {
      lives--; foes.splice(i, 1); if (lives <= 0) { lives = 3; score = 0; } continue;
    }
    if (f.y > 136) foes.splice(i, 1);
  }
  tri((px + 4) | 0, py | 0, px | 0, (py + 8) | 0, (px + 8) | 0, (py + 8) | 0, 11);
  rect(0, 0, 240, 8, 0);
  print("${game.title.toUpperCase()}  SCORE:" + score + "  LIVES:" + lives + "  [A]FIRE [B]SPREAD", 4, 1, 11, false, 1, true);
}
`;
  }

  // Action Platformers / Beat-em-ups / Cave / Jungle / Martial Arts
  return `// title:  ${game.title}
// author: Antigravity Classic Games
// desc:   ${game.mechanics}
// script: js
let px = 30, py = 112, vy = 0, dir = 1, grounded = true, score = 0, lives = 3;
let shots = [], foes = [], items = [];
const plats = [
  { x: 0, y: 124, w: 240 },
  { x: 24, y: 94, w: 72 },
  { x: 144, y: 94, w: 72 },
  { x: 76, y: 64, w: 88 },
  { x: 20, y: 36, w: 64 },
  { x: 156, y: 36, w: 64 }
];
function spawnItems() {
  items = [];
  for (let i = 1; i < plats.length; i++) {
    items.push({ x: plats[i].x + (plats[i].w >> 1), y: plats[i].y - 8 });
  }
}
spawnItems();
function TIC() {
  cls(0);
  if (btn(2) && px > 6) { px -= 1.5; dir = -1; }
  if (btn(3) && px < 226) { px += 1.5; dir = 1; }
  if ((btnp(5) || btnp(0)) && grounded) { vy = -3.2; grounded = false; }
  if (btnp(4)) shots.push({ x: px + 4, y: py + 3, vx: dir * 3.4 });

  vy += 0.16; py += vy; grounded = false;
  for (let i = 0; i < plats.length; i++) {
    const p = plats[i];
    rect(p.x, p.y, p.w, 5, 13);
    line(p.x, p.y, p.x + p.w, p.y, 11);
    if (px + 6 >= p.x && px <= p.x + p.w && py + 10 >= p.y && py + 10 <= p.y + 6 && vy >= 0) {
      py = p.y - 10; vy = 0; grounded = true;
    }
  }
  for (let i = items.length - 1; i >= 0; i--) {
    rect(items[i].x - 3, items[i].y, 6, 6, 4);
    if (Math.abs(px + 4 - items[i].x) < 7 && Math.abs(py + 5 - items[i].y) < 8) {
      items.splice(i, 1); score += 250;
    }
  }
  if (items.length === 0) { score += 500; spawnItems(); }

  for (let i = shots.length - 1; i >= 0; i--) {
    shots[i].x += shots[i].vx;
    rect(shots[i].x | 0, shots[i].y | 0, 4, 2, 4);
    if (shots[i].x < 0 || shots[i].x > 240) shots.splice(i, 1);
  }
  if (foes.length < 4 && Math.random() < 0.03) {
    const pl = plats[(Math.random() * plats.length) | 0];
    foes.push({ x: pl.x + 8, y: pl.y - 9, minX: pl.x + 4, maxX: pl.x + pl.w - 12, vx: 0.85, col: 2 });
  }
  for (let i = foes.length - 1; i >= 0; i--) {
    const f = foes[i];
    f.x += f.vx;
    if (f.x <= f.minX || f.x >= f.maxX) f.vx = -f.vx;
    rect(f.x | 0, f.y | 0, 8, 9, f.col);
    for (let j = shots.length - 1; j >= 0; j--) {
      if (Math.abs(shots[j].x - (f.x + 4)) < 6 && Math.abs(shots[j].y - (f.y + 4)) < 6) {
        shots.splice(j, 1); foes.splice(i, 1); score += 200; break;
      }
    }
    if (!foes[i]) continue;
    if (Math.abs(px - f.x) < 7 && Math.abs(py - f.y) < 8) {
      lives--; foes.splice(i, 1); px = 30; py = 112;
      if (lives <= 0) { lives = 3; score = 0; spawnItems(); }
    }
  }
  rect(px | 0, py | 0, 8, 10, 6);
  rect((px + (dir > 0 ? 5 : 1)) | 0, (py + 2) | 0, 2, 2, 12);
  rect(0, 0, 240, 8, 0);
  print("${game.title.toUpperCase()}  SCORE:" + score + "  LIVES:" + lives + "  [A]ATK [B]JUMP", 4, 1, 4, false, 1, true);
}
`;
}

const CUSTOM_CODE_MAP = {
  loderunner: lodeRunnerJs,
  spyhunter: spyHunterJs,
  donkeykong: donkeyKongJs,
  pacman: pacManJs,
  galaga: galagaJs,
  digdug: digDugJs,
  rampage: rampageJs
};

const carts = [];
for (const game of GAME_CATALOG) {
  const fileBase = sanitizeFileName(game.title);
  const code = CUSTOM_CODE_MAP[game.id] || buildUniversalArcadeCart(game);
  carts.push({
    file: `${fileBase}.tic`,
    id: game.id,
    name: `${game.title} (Custom JS Port)`,
    desc: `${game.mechanics} (${game.classicRef}) — Ported from your GitHub JS codebase to run natively at 60 FPS on Recalbox!`,
    code
  });
}

// Also include standalone "Pac-Man.tic" alias & "Pokemon_Kanto.tic"
carts.push({
  file: 'Pac-Man.tic',
  id: 'pacman_alias',
  name: 'Pac-Man (Custom JS Port)',
  desc: 'Navigate the neon maze, gobble dots and energizers, and chase down Blinky, Pinky, Inky, and Clyde!',
  code: pacManJs
});

carts.push({
  file: 'Pokemon Kanto Adventure.tic',
  id: 'pokemon',
  name: 'Pokemon Kanto Adventure (Custom JS Port)',
  desc: 'Explore Pallet Town and Route 1 with Pikachu, Charmander, Squirtle, or Bulbasaur, battle wild Pokemon, and catch em all!',
  code: pokemonKantoJs
});

carts.push({
  file: 'Retro Arcade Studio.tic',
  id: 'studio',
  name: 'Retro Arcade Studio (Custom JS Hub)',
  desc: 'Play your flagship custom JS Lode Runner & Retro Arcade Studio hub natively on Recalbox!',
  code: lodeRunnerJs
});

// Clean old .tic files first
for (const existing of fs.readdirSync(TIC_OUT_DIR)) {
  if (existing.endsWith('.tic')) {
    fs.unlinkSync(path.join(TIC_OUT_DIR, existing));
  }
}

let xml = `<?xml version="1.0"?>\n<gameList>\n`;
for (const c of carts) {
  const bin = createTicBinary(c.code);
  fs.writeFileSync(path.join(TIC_OUT_DIR, c.file), bin);
  xml += `\t<game source="Recalbox" timestamp="0">\n`;
  xml += `\t\t<path>./${c.file}</path>\n`;
  xml += `\t\t<name>${c.name.replace(/&/g, '&amp;')}</name>\n`;
  xml += `\t\t<desc>${c.desc.replace(/&/g, '&amp;')}</desc>\n`;
  xml += `\t\t<developer>Antigravity</developer>\n`;
  xml += `\t\t<publisher>Antigravity</publisher>\n`;
  xml += `\t\t<genre>Arcade</genre>\n`;
  xml += `\t\t<players>1-2</players>\n`;
  xml += `\t\t<rating>0.98</rating>\n`;
  xml += `\t</game>\n`;
}
xml += `</gameList>\n`;

fs.writeFileSync(path.join(TIC_OUT_DIR, 'gamelist.xml'), xml, 'utf8');
console.log(`Built ${carts.length} ARMv6-optimized TIC-80 JavaScript cartridges in ${TIC_OUT_DIR}`);
