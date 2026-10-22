/**
 * Pengo.js
 * Classic 1982 Ice-Block Pushing Maze Arcade Game — Retro Arcade Studio Edition.
 * Guide Pengo the red penguin through a grid of cyan Ice Blocks and 3 glowing Diamond Blocks.
 * Push ice blocks to slide and crush Sno-Bees (or shatter blocked ice blocks), vibrate the
 * electric arena walls to stun nearby Sno-Bees, and line up all 3 Diamond Blocks for a 10,000 pt Jackpot!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const COLS = 15;
const ROWS = 11;
const TILE = 40;
const OFFSET_X = Math.floor((960 - COLS * TILE) * 0.5);
const OFFSET_Y = 66;

export class Pengo {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'pengo';
    this.title = 'Ice Pusher';
    this.width = 960;
    this.height = 540;

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.particles = [];
    this.popups = [];
    this.wallBuzz = { top: 0, bottom: 0, left: 0, right: 0 };
    this.diamondBonusAwarded = false;
    this.stageClearTimer = 0;

    this._initMaze();
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.audio.stopSequence();
  }

  _initMaze() {
    this.diamondBonusAwarded = false;
    this.slidingBlocks = [];
    this.shatteringBlocks = [];

    const MAZE_LAYOUTS = [
      {
        // Act 1: Classic Sega Cross-Grid Pillars & Triangle Diamond Puzzle
        name: 'ACT 1: ANTARCTIC LABYRINTH',
        wallPredicate: (r, c) =>
          (r % 2 === 1 && c % 2 === 1) ||
          (r % 2 === 1 && (c === 4 || c === 10)) ||
          (c % 4 === 2 && (r === 2 || r === 8)),
        diamonds: [{ r: 2, c: 3 }, { r: 5, c: 11 }, { r: 8, c: 3 }],
        eggs: [{ r: 1, c: 1 }, { r: 9, c: 13 }]
      },
      {
        // Act 2: Twin Ice Rings & Horizontal Corridor
        name: 'ACT 2: TWIN ICE RINGS',
        wallPredicate: (r, c) => {
          const leftRing = r >= 2 && r <= 8 && c >= 1 && c <= 5 && (r === 2 || r === 8 || c === 1 || c === 5) && r !== 5;
          const rightRing = r >= 2 && r <= 8 && c >= 9 && c <= 13 && (r === 2 || r === 8 || c === 9 || c === 13) && r !== 5;
          const centerPillars = c === 7 && (r === 1 || r === 3 || r === 7 || r === 9);
          return leftRing || rightRing || centerPillars;
        },
        diamonds: [{ r: 3, c: 3 }, { r: 5, c: 3 }, { r: 7, c: 11 }],
        eggs: [{ r: 2, c: 1 }, { r: 8, c: 13 }]
      },
      {
        // Act 3: Vertical Slalom Chutes
        name: 'ACT 3: GLACIER SLALOM',
        wallPredicate: (r, c) =>
          (c % 2 === 1 && r >= 1 && r <= 9 && (r + Math.floor(c / 2)) % 3 !== 0),
        diamonds: [{ r: 2, c: 2 }, { r: 2, c: 8 }, { r: 8, c: 12 }],
        eggs: [{ r: 1, c: 3 }, { r: 9, c: 11 }]
      },
      {
        // Act 4: Spiral Ice Fortress
        name: 'ACT 4: SPIRAL FORTRESS',
        wallPredicate: (r, c) => {
          const outer = (r === 1 || r === 9) && c >= 2 && c <= 12 && c !== 7;
          const sides = (c === 2 || c === 12) && r >= 1 && r <= 9 && r !== 5;
          const inner = (r === 3 || r === 7) && c >= 4 && c <= 10 && c !== 7;
          return outer || sides || inner;
        },
        diamonds: [{ r: 4, c: 5 }, { r: 6, c: 9 }, { r: 2, c: 7 }],
        eggs: [{ r: 1, c: 2 }, { r: 9, c: 12 }, { r: 3, c: 10 }]
      },
      {
        // Act 5: Checkerboard Ice Field
        name: 'ACT 5: CRYSTAL CHECKERBOARD',
        wallPredicate: (r, c) =>
          (r >= 1 && r <= 9 && c >= 1 && c <= 13 && (r + c) % 2 === 0 && (r % 2 === 1 || c % 3 === 1)),
        diamonds: [{ r: 1, c: 4 }, { r: 5, c: 4 }, { r: 9, c: 10 }],
        eggs: [{ r: 1, c: 2 }, { r: 9, c: 2 }, { r: 5, c: 12 }]
      },
      {
        // Act 6: Hourglass Funnel
        name: 'ACT 6: FROZEN HOURGLASS',
        wallPredicate: (r, c) => {
          const diag1 = Math.abs(c - (r + 2)) <= 0 && r >= 1 && r <= 9;
          const diag2 = Math.abs(c - (12 - r)) <= 0 && r >= 1 && r <= 9;
          const bars = (r === 2 || r === 8) && c >= 4 && c <= 10 && c !== 7;
          const wings = (c === 1 || c === 13) && r >= 3 && r <= 7;
          return diag1 || diag2 || bars || wings;
        },
        diamonds: [{ r: 3, c: 7 }, { r: 7, c: 4 }, { r: 7, c: 10 }],
        eggs: [{ r: 2, c: 5 }, { r: 8, c: 9 }]
      },
      {
        // Act 7: Crossroad Bastions (Four Quadrant Vaults)
        name: 'ACT 7: FOUR BASTIONS',
        wallPredicate: (r, c) => {
          if (r === 5 || c === 7) return false;
          const qR = r < 5 ? r : 10 - r;
          const qC = c < 7 ? c : 14 - c;
          return (qR >= 1 && qR <= 3 && qC >= 1 && qC <= 5) && !(qR === 2 && (qC === 2 || qC === 4));
        },
        diamonds: [{ r: 2, c: 2 }, { r: 2, c: 12 }, { r: 8, c: 7 }],
        eggs: [{ r: 1, c: 5 }, { r: 9, c: 9 }, { r: 3, c: 11 }]
      },
      {
        // Act 8: Zig-Zag Ice Chutes Finale
        name: 'ACT 8: POLAR CITADEL',
        wallPredicate: (r, c) =>
          (r % 2 === 1 && c >= 1 && c <= 13 && c !== ((r * 3) % 11) + 2 && c !== 7) ||
          (r % 2 === 0 && (c === 3 || c === 11) && r > 0 && r < 10),
        diamonds: [{ r: 1, c: 7 }, { r: 5, c: 2 }, { r: 9, c: 7 }],
        eggs: [{ r: 3, c: 5 }, { r: 7, c: 9 }, { r: 1, c: 11 }]
      }
    ];

    const layout = MAZE_LAYOUTS[(this.level - 1) % MAZE_LAYOUTS.length];
    this.mazeName = layout.name;

    // 0 = Empty, 1 = Ice Block, 2 = Diamond Block, 3 = Ice Block with Hidden Sno-Bee Egg
    this.grid = [];
    for (let r = 0; r < ROWS; r++) {
      const row = new Array(COLS).fill(0);
      for (let c = 0; c < COLS; c++) {
        if (layout.wallPredicate(r, c)) {
          row[c] = 1;
        }
      }
      this.grid.push(row);
    }

    // Clear Pengo starting tile in center
    this.grid[5][7] = 0;
    this.grid[5][6] = 0;
    this.grid[5][8] = 0;

    // Place 3 Indestructible Glowing Diamond Blocks
    for (const dc of layout.diamonds) {
      this.grid[dc.r][dc.c] = 2;
    }

    // Place Hidden Sno-Bee Eggs inside Ice Blocks
    for (const eg of layout.eggs) {
      if (this.grid[eg.r][eg.c] !== 2) {
        this.grid[eg.r][eg.c] = 3;
      }
    }

    this._resetPengo();

    // Spawn Sno-Bees
    this.snoBees = [];
    const corners = [
      { r: 0, c: 0 },
      { r: 0, c: COLS - 1 },
      { r: ROWS - 1, c: 0 },
      { r: ROWS - 1, c: COLS - 1 }
    ];
    const count = Math.min(4, 3 + Math.floor(this.level / 2));
    for (let i = 0; i < count; i++) {
      const sp = corners[i % corners.length];
      this.grid[sp.r][sp.c] = 0;
      this.snoBees.push({
        r: sp.r,
        c: sp.c,
        dr: i < 2 ? 1 : -1,
        dc: 0,
        stunTimer: 0,
        color: i % 2 === 0 ? PALETTE.GREEN : PALETTE.PINK
      });
    }
  }

  _resetPengo() {
    this.pengo = {
      r: 5,
      c: 7,
      dr: 0,
      dc: 1,
      moveCooldown: 0,
      invuln: 2.0
    };
  }

  _tileCenter(r, c) {
    return {
      x: OFFSET_X + (c + 0.5) * TILE,
      y: OFFSET_Y + (r + 0.5) * TILE
    };
  }

  _addScore(pts, x, y, label = null, color = PALETTE.GOLD) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    this.popups.push({
      x,
      y,
      text: label || `+${pts}`,
      color,
      life: 0.95
    });
  }

  _spawnSparks(x, y, color = PALETTE.CYAN, count = 12) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 130;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        color,
        life: 0.3 + Math.random() * 0.25
      });
    }
  }

  _checkDiamondAlignment() {
    if (this.diamondBonusAwarded) return;
    const diamonds = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.grid[r][c] === 2) diamonds.push({ r, c });
      }
    }
    if (diamonds.length < 3) return;

    diamonds.sort((a, b) => (a.r !== b.r ? a.r - b.r : a.c - b.c));
    const sameRow =
      diamonds[0].r === diamonds[1].r &&
      diamonds[1].r === diamonds[2].r &&
      diamonds[1].c === diamonds[0].c + 1 &&
      diamonds[2].c === diamonds[1].c + 1;
    const sameCol =
      diamonds[0].c === diamonds[1].c &&
      diamonds[1].c === diamonds[2].c &&
      diamonds[1].r === diamonds[0].r + 1 &&
      diamonds[2].r === diamonds[1].r + 1;

    if (sameRow || sameCol) {
      this.diamondBonusAwarded = true;
      this.audio.playStageClear();
      this.renderer.shake(10, 0.4);
      const pos = this._tileCenter(diamonds[1].r, diamonds[1].c);
      this._addScore(10000, pos.x, pos.y, 'DIAMOND LINEUP! +10000', PALETTE.GOLD);
      for (const sb of this.snoBees) {
        sb.stunTimer = 5.0;
      }
    }
  }

  _pushOrBuzz() {
    const p = this.pengo;
    const tr = Math.round(p.r) + p.dr;
    const tc = Math.round(p.c) + p.dc;

    // 1. Pushing Outer Arena Electric Wall -> Vibrates & Stuns Sno-Bees near that wall!
    if (tr < 0 || tr >= ROWS || tc < 0 || tc >= COLS) {
      if (tr < 0) this.wallBuzz.top = 0.45;
      if (tr >= ROWS) this.wallBuzz.bottom = 0.45;
      if (tc < 0) this.wallBuzz.left = 0.45;
      if (tc >= COLS) this.wallBuzz.right = 0.45;

      this.audio.playLaser(480, 180, 0.15);
      this.renderer.shake(5, 0.2);

      for (const sb of this.snoBees) {
        if (
          (tr < 0 && sb.r <= 1.2) ||
          (tr >= ROWS && sb.r >= ROWS - 2.2) ||
          (tc < 0 && sb.c <= 1.2) ||
          (tc >= COLS && sb.c >= COLS - 2.2)
        ) {
          sb.stunTimer = 4.0;
          const pos = this._tileCenter(sb.r, sb.c);
          this._spawnSparks(pos.x, pos.y, PALETTE.GOLD, 10);
        }
      }
      return;
    }

    // 2. Pushing an Ice Block or Diamond Block
    const cellType = this.grid[tr][tc];
    if (cellType > 0) {
      const behindR = tr + p.dr;
      const behindC = tc + p.dc;
      const canSlide =
        behindR >= 0 &&
        behindR < ROWS &&
        behindC >= 0 &&
        behindC < COLS &&
        this.grid[behindR][behindC] === 0;

      if (canSlide) {
        this.grid[tr][tc] = 0;
        this.slidingBlocks.push({
          r: tr,
          c: tc,
          dr: p.dr,
          dc: p.dc,
          type: cellType,
          crushedCount: 0
        });
        this.audio.playHop();
      } else if (cellType !== 2) {
        // Blocked normal Ice Block shatters!
        this.grid[tr][tc] = 0;
        const pos = this._tileCenter(tr, tc);
        this._spawnSparks(pos.x, pos.y, PALETTE.CYAN, 14);
        this.audio.playDig();
        if (cellType === 3) {
          this._addScore(500, pos.x, pos.y - 10, 'EGG CRUSHED! +500', PALETTE.GREEN);
        } else {
          this._addScore(30, pos.x, pos.y - 10, '+30', PALETTE.CYAN);
        }
      }
    }
  }

  update(dt) {
    if (this.state === 'MENU') {
      if (this.input.isJustPressed('actionA') || this.input.isJustPressed('any')) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'PLAYING';
      }
      return;
    }
    if (this.state === 'PAUSED') {
      if (this.input.isJustPressed('actionA')) this.state = 'PLAYING';
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

    if (this.stageClearTimer > 0) {
      this.stageClearTimer -= dt;
      if (this.stageClearTimer <= 0) {
        this.level++;
        this._initMaze();
      }
      return;
    }

    // Decay electric wall buzz
    for (const k of ['top', 'bottom', 'left', 'right']) {
      if (this.wallBuzz[k] > 0) this.wallBuzz[k] = Math.max(0, this.wallBuzz[k] - dt);
    }

    const p = this.pengo;
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (p.moveCooldown > 0) p.moveCooldown = Math.max(0, p.moveCooldown - dt);

    // 1. Pengo Grid Movement & Direction
    let reqDr = 0;
    let reqDc = 0;
    if (this.input.isDown('up')) reqDr = -1;
    else if (this.input.isDown('down')) reqDr = 1;
    else if (this.input.isDown('left')) reqDc = -1;
    else if (this.input.isDown('right')) reqDc = 1;

    if (reqDr !== 0 || reqDc !== 0) {
      p.dr = reqDr;
      p.dc = reqDc;
      if (p.moveCooldown <= 0) {
        const nr = p.r + reqDr;
        const nc = p.c + reqDc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && this.grid[nr][nc] === 0) {
          p.r = nr;
          p.c = nc;
          p.moveCooldown = 0.13;
        }
      }
    }

    // Push Ice Block / Vibrate Wall (Action A or Action B)
    if (this.input.isJustPressed('actionA') || this.input.isJustPressed('actionB')) {
      this._pushOrBuzz();
    }

    // 2. Update High-Speed Sliding Ice & Diamond Blocks
    const slideSpeed = 14.5;
    for (let i = this.slidingBlocks.length - 1; i >= 0; i--) {
      const b = this.slidingBlocks[i];
      const nextR = b.r + b.dr * slideSpeed * dt;
      const nextC = b.c + b.dc * slideSpeed * dt;

      // Check if sliding block crushes any Sno-Bees!
      for (let j = this.snoBees.length - 1; j >= 0; j--) {
        const sb = this.snoBees[j];
        if (Math.hypot(sb.r - nextR, sb.c - nextC) < 0.65) {
          b.crushedCount++;
          const pts = b.crushedCount === 1 ? 400 : b.crushedCount === 2 ? 1600 : 3200;
          const pos = this._tileCenter(sb.r, sb.c);
          this._spawnSparks(pos.x, pos.y, sb.color, 18);
          this.audio.playPop();
          this._addScore(pts, pos.x, pos.y - 12, `CRUSHED! +${pts}`, PALETTE.GOLD);
          this.snoBees.splice(j, 1);
        }
      }

      // Check if next cell ahead is blocked or out of bounds
      const checkR = b.dr > 0 ? Math.ceil(nextR) : b.dr < 0 ? Math.floor(nextR) : Math.round(b.r);
      const checkC = b.dc > 0 ? Math.ceil(nextC) : b.dc < 0 ? Math.floor(nextC) : Math.round(b.c);

      if (
        checkR < 0 ||
        checkR >= ROWS ||
        checkC < 0 ||
        checkC >= COLS ||
        this.grid[checkR][checkC] !== 0
      ) {
        const stopR = Math.max(0, Math.min(ROWS - 1, checkR - b.dr));
        const stopC = Math.max(0, Math.min(COLS - 1, checkC - b.dc));
        this.grid[stopR][stopC] = b.type;
        this.slidingBlocks.splice(i, 1);
        if (b.type === 2) {
          this._checkDiamondAlignment();
        }
      } else {
        b.r = nextR;
        b.c = nextC;
      }
    }

    // 3. Check Stage Clear (all Sno-Bees crushed!)
    if (this.snoBees.length === 0) {
      this.stageClearTimer = 1.5;
      this.audio.playStageClear();
      this._addScore(1500, this.width * 0.5, 120, 'ICE ARENA CLEARED! +1500', PALETTE.GREEN);
      return;
    }

    // 4. Update Sno-Bees AI & Collisions
    for (let i = this.snoBees.length - 1; i >= 0; i--) {
      const sb = this.snoBees[i];
      if (sb.stunTimer > 0) {
        sb.stunTimer = Math.max(0, sb.stunTimer - dt);
      } else {
        const spd = 2.6 + this.level * 0.22;
        const nr = sb.r + sb.dr * spd * dt;
        const nc = sb.c + sb.dc * spd * dt;
        const tr = Math.round(nr + sb.dr * 0.35);
        const tc = Math.round(nc + sb.dc * 0.35);

        if (tr >= 0 && tr < ROWS && tc >= 0 && tc < COLS && this.grid[tr][tc] === 0) {
          sb.r = nr;
          sb.c = nc;
          // Occasionally turn toward Pengo at intersections
          if (Math.random() < dt * 1.6) {
            sb.r = Math.round(sb.r);
            sb.c = Math.round(sb.c);
            const dirs = [
              { dr: -1, dc: 0 },
              { dr: 1, dc: 0 },
              { dr: 0, dc: -1 },
              { dr: 0, dc: 1 }
            ].filter((d) => {
              const rr = sb.r + d.dr;
              const cc = sb.c + d.dc;
              return rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && this.grid[rr][cc] === 0;
            });
            if (dirs.length > 0) {
              const pick = dirs[Math.floor(Math.random() * dirs.length)];
              sb.dr = pick.dr;
              sb.dc = pick.dc;
            }
          }
        } else {
          // Break through normal ice block or pick a new open direction
          if (tr >= 0 && tr < ROWS && tc >= 0 && tc < COLS && this.grid[tr][tc] === 1 && Math.random() < 0.25) {
            this.grid[tr][tc] = 0;
          }
          sb.r = Math.round(sb.r);
          sb.c = Math.round(sb.c);
          const dirs = [
            { dr: -1, dc: 0 },
            { dr: 1, dc: 0 },
            { dr: 0, dc: -1 },
            { dr: 0, dc: 1 }
          ];
          const pick = dirs[Math.floor(Math.random() * dirs.length)];
          sb.dr = pick.dr;
          sb.dc = pick.dc;
        }
      }

      // Collision with Pengo
      if (Math.hypot(sb.r - p.r, sb.c - p.c) < 0.65) {
        if (sb.stunTimer > 0) {
          // Squash stunned Sno-Bee!
          const pos = this._tileCenter(sb.r, sb.c);
          this._spawnSparks(pos.x, pos.y, sb.color, 14);
          this.audio.playCoin();
          this._addScore(200, pos.x, pos.y - 10, 'SQUASHED! +200', PALETTE.CYAN);
          this.snoBees.splice(i, 1);
        } else if (p.invuln <= 0) {
          this.lives--;
          this.audio.playHit();
          this.renderer.shake(8, 0.3);
          if (this.lives <= 0) {
            HighScoreStore.submit(this.id, this.score);
            this.state = 'GAMEOVER';
            this.audio.playGameOver();
            return;
          }
          this._resetPengo();
          break;
        }
      }
    }

    // 5. Particles & Popups
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 28 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  _drawBlock(ctx, x, y, type) {
    if (type === 2) {
      // Glowing Diamond Block
      const col = Math.floor(performance.now() * 0.012) % 2 === 0 ? PALETTE.GOLD : PALETTE.PINK;
      this.renderer.drawGlowRect(x + 3, y + 3, TILE - 6, TILE - 6, col, 12, true);
      ctx.fillStyle = PALETTE.WHITE;
      ctx.beginPath();
      ctx.moveTo(x + TILE * 0.5, y + 8);
      ctx.lineTo(x + TILE - 8, y + TILE * 0.5);
      ctx.lineTo(x + TILE * 0.5, y + TILE - 8);
      ctx.lineTo(x + 8, y + TILE * 0.5);
      ctx.closePath();
      ctx.fill();
    } else {
      // Cyan Ice Block (type 3 pulses faintly with a hidden Sno-Bee egg)
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      ctx.strokeStyle = PALETTE.CYAN;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillRect(x + 7, y + 7, 10, 4);
      if (type === 3 && Math.floor(performance.now() * 0.008) % 2 === 0) {
        this.renderer.drawGlowCircle(x + TILE * 0.5, y + TILE * 0.5, 5, PALETTE.GREEN, 6, true);
      }
    }
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear('#071120');

    // 1. Ice Arena Floor & Electric Vibrating Outer Walls
    const arenaW = COLS * TILE;
    const arenaH = ROWS * TILE;
    ctx.fillStyle = '#0B192C';
    ctx.fillRect(OFFSET_X, OFFSET_Y, arenaW, arenaH);

    const drawWall = (x, y, w, h, buzz) => {
      const col = buzz > 0 ? PALETTE.GOLD : PALETTE.BLUE;
      const jx = buzz > 0 ? (Math.random() - 0.5) * 6 : 0;
      const jy = buzz > 0 ? (Math.random() - 0.5) * 6 : 0;
      this.renderer.drawGlowRect(x + jx, y + jy, w, h, col, buzz > 0 ? 14 : 6, true);
    };
    drawWall(OFFSET_X - 8, OFFSET_Y - 8, arenaW + 16, 8, this.wallBuzz.top);
    drawWall(OFFSET_X - 8, OFFSET_Y + arenaH, arenaW + 16, 8, this.wallBuzz.bottom);
    drawWall(OFFSET_X - 8, OFFSET_Y - 8, 8, arenaH + 16, this.wallBuzz.left);
    drawWall(OFFSET_X + arenaW, OFFSET_Y - 8, 8, arenaH + 16, this.wallBuzz.right);

    // 2. Stationary & Sliding Ice/Diamond Blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.grid[r][c] > 0) {
          this._drawBlock(ctx, OFFSET_X + c * TILE, OFFSET_Y + r * TILE, this.grid[r][c]);
        }
      }
    }
    for (const sb of this.slidingBlocks) {
      this._drawBlock(ctx, OFFSET_X + sb.c * TILE, OFFSET_Y + sb.r * TILE, sb.type);
    }

    // 3. Sno-Bees
    for (const sb of this.snoBees) {
      const pos = this._tileCenter(sb.r, sb.c);
      const col = sb.stunTimer > 0 ? PALETTE.CYAN : sb.color;
      const shake = sb.stunTimer > 0 ? Math.sin(performance.now() * 0.05) * 3 : 0;
      this.renderer.drawGlowCircle(pos.x + shake, pos.y, 13, col, 10, true);
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(pos.x - 6, pos.y - 5, 4, 5);
      ctx.fillRect(pos.x + 2, pos.y - 5, 4, 5);
    }

    // 4. Red Penguin Pengo
    const p = this.pengo;
    if (p.invuln <= 0 || Math.floor(p.invuln * 14) % 2 === 0) {
      const pos = this._tileCenter(p.r, p.c);
      this.renderer.drawGlowCircle(pos.x, pos.y, 14, PALETTE.RED, 10, true);
      ctx.fillStyle = PALETTE.WHITE;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y + 3, 8, 0, Math.PI * 2);
      ctx.fill();
      // Yellow Beak pointing in facing direction
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(pos.x + p.dc * 10 - 4, pos.y + p.dr * 10 - 4, 8, 8);
    }

    // 5. Particles & Popups
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
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

    // 6. Top HUD & State Overlay
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `${this.mazeName || 'ICE ARENA'}  SNO-BEES:${this.snoBees.length}`,
      accent: PALETTE.CYAN
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1982 ICE-BLOCK MAZE PUZZLER',
      controls: 'ARROWS/WASD: MOVE  |  Z/SPACE: PUSH ICE BLOCK OR VIBRATE WALL',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.CYAN
    });
  }
}

export default Pengo;
