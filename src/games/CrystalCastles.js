/**
 * CrystalCastles.js
 * Classic 1983 3D Isometric Action-Maze Collector — Retro Arcade Studio Edition.
 * Guide Bentley Bear across multi-tiered isometric castle walkways, ramps, and elevators
 * to collect all sparkling Gems while jumping over Gem Eaters, Crystal Balls, Swarming Bees,
 * and Berthilda the Witch (grab the Magic Hat to defeat her for 3,000 bonus points!).
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const GRID_SIZE = 11;
const TILE_RX = 28;
const TILE_RY = 14;
const ELEV_STEP = 14;
const ORIGIN_X = 480;
const ORIGIN_Y = 128;

const BENTLEY_SPRITE = [
  '.BBB....BBB.',
  'BYYYB..BYYYB',
  '.BBBBBBBBBB.',
  '.BBWWKKWWBB.',
  '.BBBBYYYYBB.',
  '..BBBYYYYB..',
  '.BBBBBBBBBB.',
  'BBBBYYYYBBBB',
  'BB.BYYYYB.BB',
  '...BBBBBB...',
  '..BBB..BBB..',
  '.YYYY..YYYY.'
];

const GEM_EATER_SPRITE = [
  '..RRRRRRRR..',
  '.RRRRRRRRRR.',
  'RRWWKKWWKKRR',
  'RRRRRRRRRRRR',
  'RRWWWWWWWWWR',
  'RRK.K.K.K.RR',
  'RRWWWWWWWWWR',
  '.RRRRRRRRRR.',
  '..RR....RR..',
  '.YYY....YYY.'
];

const CASTLE_THEMES = [
  { name: 'CITADEL STEPS', top: '#1E293B', left: '#0F766E', right: '#115E59', accent: PALETTE.CYAN },
  { name: 'SPIRAL RAMPARTS', top: '#31102F', left: '#7E22CE', right: '#581C87', accent: PALETTE.PINK },
  { name: 'TWIN TOWERS', top: '#172554', left: '#B45309', right: '#78350F', accent: PALETTE.GOLD },
  { name: 'ROYAL LABYRINTH', top: '#064E3B', left: '#047857', right: '#065F46', accent: PALETTE.GREEN },
  { name: 'SPIRAL KEEP', top: '#1E1B4B', left: '#4338CA', right: '#312E81', accent: PALETTE.CYAN },
  { name: 'TWIN BRIDGES', top: '#3F1D38', left: '#BE185D', right: '#831843', accent: PALETTE.PINK },
  { name: 'DIAMOND ZIGGURAT', top: '#271710', left: '#D97706', right: '#92400E', accent: PALETTE.GOLD },
  { name: "BERTHILDA'S CITADEL", top: '#2E1065', left: '#9333EA', right: '#581C87', accent: PALETTE.ORANGE }
];

export class CrystalCastles {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'crystalcastles';
    this.title = 'Crystal Castles';
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
    this.stageClearTimer = 0;
    this.elevatorPhase = 0;

    this._buildCastleLayout(this.level);
    this._resetBentley();
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.audio.stopSequence();
  }

  _buildCastleLayout(level) {
    const layoutIdx = (level - 1) % 8;
    this.grid = [];
    this.gemsRemaining = 0;

    for (let r = 0; r < GRID_SIZE; r++) {
      const row = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        let h = 0;
        let isElevator = false;
        let walkable = true;

        if (layoutIdx === 0) {
          // Layout 0: Concentric terraced ziggurat
          const distEdge = Math.min(r, c, GRID_SIZE - 1 - r, GRID_SIZE - 1 - c);
          h = distEdge;
          if (r === 5 && c === 5) isElevator = true;
        } else if (layoutIdx === 1) {
          // Layout 1: Spiral Ramparts with central courtyard
          if (r <= 2 || r >= 8) h = 2;
          else if (c <= 2 || c >= 8) h = 1;
          else h = 0;
          if ((r === 2 || r === 8) && c === 5) isElevator = true;
        } else if (layoutIdx === 2) {
          // Layout 2: Four Corner Towers connected by causeways
          const inCorner = (r <= 3 || r >= 7) && (c <= 3 || c >= 7);
          const onBridge = r === 5 || c === 5 || r === 2 || r === 8 || c === 2 || c === 8;
          if (inCorner) h = 3;
          else if (onBridge) h = 1;
          else walkable = false;
          if ((r === 2 && c === 2) || (r === 8 && c === 8)) isElevator = true;
        } else if (layoutIdx === 3) {
          // Layout 3: Royal Staircase & Terraces
          h = Math.floor((GRID_SIZE - 1 - Math.abs(r - 5) - Math.abs(c - 5)) * 0.5);
          h = Math.max(0, h);
          if (r === 5 && (c === 1 || c === 9)) isElevator = true;
        } else if (layoutIdx === 4) {
          // Layout 4: Spiral Keep (ascending helical ramp around central keep)
          const ring = Math.max(Math.abs(r - 5), Math.abs(c - 5));
          h = Math.max(0, 4 - Math.floor(ring * 0.8));
          if (ring === 3 && r !== 5 && c !== 5 && r !== 2 && r !== 8) walkable = false;
          if ((r === 5 && c === 5) || (r === 1 && c === 5)) isElevator = true;
        } else if (layoutIdx === 5) {
          // Layout 5: Twin Bridges (three parallel castle wings linked by high sky-bridges)
          const onWing = c <= 3 || c >= 7 || (c >= 4 && c <= 6 && (r <= 2 || r >= 8 || r === 5));
          if (!onWing) walkable = false;
          if (c <= 2 || c >= 8) h = 2;
          else if (r === 5) h = 3;
          else h = 1;
          if ((r === 5 && c === 2) || (r === 5 && c === 8)) isElevator = true;
        } else if (layoutIdx === 6) {
          // Layout 6: Diamond Ziggurat (stepped diagonal diamond terraces with corner bastions)
          const manhattan = Math.abs(r - 5) + Math.abs(c - 5);
          if (manhattan <= 2) h = 4;
          else if (manhattan <= 4) h = 2;
          else if (manhattan <= 6) h = 1;
          else h = 0;
          if ((r === 3 && c === 5) || (r === 7 && c === 5) || (r === 5 && c === 5)) isElevator = true;
        } else {
          // Layout 7: Berthilda's Citadel (fortified citadel with moat gaps and 4 elevators)
          const isMoat =
            (r === 3 || r === 7) && (c === 3 || c === 7);
          if (isMoat) walkable = false;
          if (r >= 4 && r <= 6 && c >= 4 && c <= 6) h = 3;
          else if (r <= 1 || r >= 9 || c <= 1 || c >= 9) h = 2;
          else h = 1;
          if ((r === 2 && c === 5) || (r === 8 && c === 5) || (r === 5 && c === 2) || (r === 5 && c === 8)) {
            isElevator = true;
          }
        }

        const hasGem =
          walkable &&
          !(r === 5 && c === 5) &&
          ((r + c) % 2 === 0 || (r === 1 || r === 9 || c === 1 || c === 9));

        if (hasGem) this.gemsRemaining++;

        row.push({
          r,
          c,
          baseH: h,
          h,
          isElevator,
          walkable,
          hasGem
        });
      }
      this.grid.push(row);
    }

    // Place Magic Hat (invincibility) and Honey Pot (bonus + slows bees)
    this.magicHat = { r: 1, c: 5, active: true };
    this.honeyPot = { r: 9, c: 5, active: true };

    // Spawn Castle Enemies
    this.enemies = [
      { type: 'GEM_EATER', r: 1.5, c: 1.5, vr: 1.6, vc: 0, eatingTimer: 0 },
      { type: 'GEM_EATER', r: 9.0, c: 8.5, vr: 0, vc: -1.6, eatingTimer: 0 },
      { type: 'CRYSTAL_BALL', r: 2.0, c: 8.5, vr: 1.8, vc: -1.8, eatingTimer: 0 },
      { type: 'WITCH', r: 1.5, c: 5.0, vr: 1.2, vc: 1.5, eatingTimer: 0 }
    ];
    if (level >= 2) {
      this.enemies.push({ type: 'BEE_SWARM', r: 8.5, c: 2.0, vr: -1.7, vc: 1.7, eatingTimer: 0 });
    }
  }

  _resetBentley() {
    this.bentley = {
      r: 5.0,
      c: 5.0,
      z: 0,
      vz: 0,
      jumping: false,
      hatTimer: 0,
      invuln: 2.0,
      facing: 1
    };
  }

  _tileAt(r, c) {
    const ri = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(r)));
    const ci = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(c)));
    return this.grid[ri][ci];
  }

  _isoProject(r, c, h = 0, jumpZ = 0) {
    const x = ORIGIN_X + (c - r) * TILE_RX;
    const y = ORIGIN_Y + (c + r) * TILE_RY - h * ELEV_STEP - jumpZ;
    return { x, y };
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
      life: 0.9
    });
  }

  _triggerHit() {
    if (this.bentley.invuln > 0 || this.bentley.hatTimer > 0) return;
    this.lives--;
    this.audio.playHit();
    this.renderer.shake(8, 0.3);

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.state = 'GAMEOVER';
      this.audio.playGameOver();
      return;
    }
    this._resetBentley();
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
        this._buildCastleLayout(this.level);
        this._resetBentley();
      }
      return;
    }

    // Animate Elevators
    this.elevatorPhase += dt * 2.2;
    const elevH = 1.5 + 1.5 * Math.sin(this.elevatorPhase);
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.grid[r][c].isElevator) {
          this.grid[r][c].h = elevH;
        }
      }
    }

    const b = this.bentley;
    if (b.invuln > 0) b.invuln = Math.max(0, b.invuln - dt);
    if (b.hatTimer > 0) b.hatTimer = Math.max(0, b.hatTimer - dt);

    // Bentley Bear Movement in Isometric Space
    const axis = this.input.getAxis();
    let dr = 0;
    let dc = 0;
    if (Math.hypot(axis.x, axis.y) > 0.08) {
      // Map screen-space input (axis.x, axis.y) into isometric grid (dr, dc)
      dc = (axis.x + axis.y) * 0.75;
      dr = (axis.y - axis.x) * 0.75;
      if (axis.x !== 0) b.facing = axis.x > 0 ? 1 : -1;
    } else if (this.input.pointer.down) {
      const curTile = this._tileAt(b.r, b.c);
      const bScreen = this._isoProject(b.r, b.c, curTile.h, b.z);
      const dx = this.input.pointer.x - bScreen.x;
      const dy = this.input.pointer.y - bScreen.y;
      if (Math.hypot(dx, dy) > 12) {
        const nx = dx / Math.hypot(dx, dy);
        const ny = dy / Math.hypot(dx, dy);
        dc = (nx + ny) * 0.75;
        dr = (ny - nx) * 0.75;
        b.facing = dx >= 0 ? 1 : -1;
      }
    }

    const speed = 4.3;
    const nextR = Math.max(0.2, Math.min(GRID_SIZE - 1.2, b.r + dr * speed * dt));
    const nextC = Math.max(0.2, Math.min(GRID_SIZE - 1.2, b.c + dc * speed * dt));
    const targetTile = this._tileAt(nextR, nextC);
    const currentTile = this._tileAt(b.r, b.c);

    // Allow stepping across walkable tiles (or jumping over height differences)
    if (targetTile.walkable && (Math.abs(targetTile.h - currentTile.h) <= 1.6 || b.jumping)) {
      b.r = nextR;
      b.c = nextC;
    }

    // Jump Action (Action A or Action B)
    if ((this.input.isJustPressed('actionA') || this.input.isJustPressed('actionB')) && !b.jumping) {
      b.jumping = true;
      b.vz = 155;
      this.audio.playJump();
    }

    if (b.jumping) {
      b.z += b.vz * dt;
      b.vz -= 460 * dt;
      if (b.z <= 0) {
        b.z = 0;
        b.vz = 0;
        b.jumping = false;
      }
    }

    // Collect Sparkling Gems, Magic Hat, and Honey Pot when near ground
    const tile = this._tileAt(b.r, b.c);
    const bPos = this._isoProject(b.r, b.c, tile.h, b.z);

    if (b.z < 14) {
      if (tile.hasGem) {
        tile.hasGem = false;
        this.gemsRemaining--;
        this.audio.playCoin();
        this._addScore(100, bPos.x, bPos.y - 16, '+100', PALETTE.CYAN);

        if (this.gemsRemaining <= 0) {
          this.stageClearTimer = 1.6;
          this.audio.playStageClear();
          this._addScore(1500, ORIGIN_X, 95, 'CASTLE CLEARED! +1500', PALETTE.GOLD);
          return;
        }
      }

      if (this.magicHat.active && Math.hypot(b.r - this.magicHat.r, b.c - this.magicHat.c) < 0.75) {
        this.magicHat.active = false;
        b.hatTimer = 8.0;
        this.audio.playPowerUp();
        this._addScore(500, bPos.x, bPos.y - 20, 'MAGIC HAT! +500', PALETTE.PINK);
      }

      if (this.honeyPot.active && Math.hypot(b.r - this.honeyPot.r, b.c - this.honeyPot.c) < 0.75) {
        this.honeyPot.active = false;
        this.audio.playPowerUp();
        this._addScore(1000, bPos.x, bPos.y - 20, 'HONEY POT! +1000', PALETTE.GOLD);
      }
    }

    // Update Castle Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.eatingTimer > 0) {
        e.eatingTimer -= dt;
      } else {
        // Gentle tracking toward Bentley or patrolling
        if (Math.random() < dt * 1.4) {
          const toR = b.r - e.r;
          const toC = b.c - e.c;
          const len = Math.hypot(toR, toC) || 1;
          const spd = (e.type === 'WITCH' ? 2.1 : 1.75) + this.level * 0.12;
          e.vr = (toR / len) * spd;
          e.vc = (toC / len) * spd;
        }

        let nr = e.r + e.vr * dt;
        let nc = e.c + e.vc * dt;
        if (nr < 0.5 || nr > GRID_SIZE - 1.5) {
          e.vr = -e.vr;
          nr = Math.max(0.5, Math.min(GRID_SIZE - 1.5, nr));
        }
        if (nc < 0.5 || nc > GRID_SIZE - 1.5) {
          e.vc = -e.vc;
          nc = Math.max(0.5, Math.min(GRID_SIZE - 1.5, nc));
        }
        const et = this._tileAt(nr, nc);
        if (et.walkable) {
          e.r = nr;
          e.c = nc;
          // Gem Eater pauses to chew a gem
          if (e.type === 'GEM_EATER' && et.hasGem && Math.random() < dt * 0.8) {
            e.eatingTimer = 1.6;
          }
        } else {
          e.vr = -e.vr;
          e.vc = -e.vc;
        }
      }

      // Check collision with Bentley Bear
      const distGrid = Math.hypot(e.r - b.r, e.c - b.c);
      if (distGrid < 0.62) {
        if (b.hatTimer > 0 || (e.type === 'GEM_EATER' && e.eatingTimer > 0)) {
          // Defeat enemy!
          const pts = e.type === 'WITCH' ? 3000 : 400;
          const label = e.type === 'WITCH' ? 'WITCH BANISHED! +3000' : `+${pts}`;
          this.audio.playPop();
          this._addScore(pts, bPos.x, bPos.y - 24, label, PALETTE.GOLD);
          // Respawn enemy at corner after delay
          e.r = 1;
          e.c = 1;
          e.eatingTimer = 2.0;
        } else if (b.z < 15) {
          this._triggerHit();
          break;
        }
      }
    }

    // Floating Popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 28 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  _drawIsoColumn(ctx, r, c, cell, theme, flash) {
    if (!cell.walkable) return;
    const { x, y } = this._isoProject(r, c, cell.h, 0);
    const colH = 18 + cell.h * ELEV_STEP;

    const topColor = flash
      ? Math.floor(performance.now() * 0.015) % 2 === 0
        ? PALETTE.GOLD
        : PALETTE.CYAN
      : cell.isElevator
      ? PALETTE.GOLD
      : theme.top;

    ctx.save();
    // Left Face
    ctx.fillStyle = theme.left;
    ctx.beginPath();
    ctx.moveTo(x - TILE_RX, y);
    ctx.lineTo(x, y + TILE_RY);
    ctx.lineTo(x, y + TILE_RY + colH);
    ctx.lineTo(x - TILE_RX, y + colH);
    ctx.closePath();
    ctx.fill();

    // Right Face
    ctx.fillStyle = theme.right;
    ctx.beginPath();
    ctx.moveTo(x + TILE_RX, y);
    ctx.lineTo(x, y + TILE_RY);
    ctx.lineTo(x, y + TILE_RY + colH);
    ctx.lineTo(x + TILE_RX, y + colH);
    ctx.closePath();
    ctx.fill();

    // Top Diamond
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(x, y - TILE_RY);
    ctx.lineTo(x + TILE_RX, y);
    ctx.lineTo(x, y + TILE_RY);
    ctx.lineTo(x - TILE_RX, y);
    ctx.closePath();
    ctx.fill();

    // Trim Edges
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Sparkling Faceted Isometric Diamond Gem on tile
    if (cell.hasGem) {
      const gemColor = (r + c) % 3 === 0 ? PALETTE.CYAN : (r + c) % 3 === 1 ? PALETTE.PINK : PALETTE.GREEN;
      const gy = y - 6;
      ctx.save();
      ctx.fillStyle = gemColor;
      ctx.shadowColor = gemColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(x, gy - 7);
      ctx.lineTo(x + 6, gy);
      ctx.lineTo(x, gy + 6);
      ctx.lineTo(x - 6, gy);
      ctx.closePath();
      ctx.fill();
      // Crown specular facet
      ctx.fillStyle = PALETTE.WHITE;
      ctx.beginPath();
      ctx.moveTo(x, gy - 5);
      ctx.lineTo(x + 3, gy - 1);
      ctx.lineTo(x - 3, gy - 1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear(PALETTE.BG);
    const theme = CASTLE_THEMES[(this.level - 1) % CASTLE_THEMES.length];
    const flash = this.stageClearTimer > 0;

    // 1. Back-to-Front Painter's Algorithm for Isometric Grid
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        this._drawIsoColumn(ctx, r, c, this.grid[r][c], theme, flash);
      }
    }

    // 2. Magic Hat & Honey Pot Power-Ups
    if (this.magicHat.active) {
      const t = this._tileAt(this.magicHat.r, this.magicHat.c);
      const pos = this._isoProject(this.magicHat.r, this.magicHat.c, t.h, 0);
      ctx.save();
      ctx.translate(pos.x, pos.y - 8);
      ctx.fillStyle = PALETTE.PINK;
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(10, 0);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(-12, -2, 24, 4);
      ctx.restore();
    }

    if (this.honeyPot.active) {
      const t = this._tileAt(this.honeyPot.r, this.honeyPot.c);
      const pos = this._isoProject(this.honeyPot.r, this.honeyPot.c, t.h, 0);
      this.renderer.drawGlowCircle(pos.x, pos.y - 8, 8, PALETTE.GOLD, 10, true);
      ctx.fillStyle = PALETTE.ORANGE;
      ctx.fillRect(pos.x - 6, pos.y - 16, 12, 4);
    }

    // 3. Castle Enemies
    for (const e of this.enemies) {
      const t = this._tileAt(e.r, e.c);
      const pos = this._isoProject(e.r, e.c, t.h, e.type === 'WITCH' ? 14 : 0);
      ctx.save();
      ctx.translate(pos.x, pos.y - 10);

      if (e.type === 'GEM_EATER') {
        const col = e.eatingTimer > 0 ? PALETTE.CYAN : PALETTE.RED;
        const scale = 2.0;
        const ew = GEM_EATER_SPRITE[0].length * scale;
        const eh = GEM_EATER_SPRITE.length * scale;
        const chompY = e.eatingTimer > 0 ? Math.sin(performance.now() * 0.04) * 2 : 0;
        this.renderer.drawPixelSprite(
          GEM_EATER_SPRITE,
          pos.x - ew * 0.5 - pos.x,
          pos.y - 10 - eh * 0.5 + chompY - (pos.y - 10),
          scale,
          {
            R: col,
            W: PALETTE.WHITE,
            Y: PALETTE.GOLD,
            K: '#090D16'
          },
          e.vc < 0
        );
      } else if (e.type === 'CRYSTAL_BALL') {
        this.renderer.drawGlowCircle(0, 0, 11, PALETTE.GREEN, 12, true);
        ctx.fillStyle = PALETTE.WHITE;
        ctx.fillRect(-4, -5, 3, 3);
      } else if (e.type === 'WITCH') {
        // Berthilda the Witch on Broomstick
        ctx.strokeStyle = PALETTE.GOLD;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-14, 4);
        ctx.lineTo(14, 4);
        ctx.stroke();
        this.renderer.drawGlowCircle(0, -4, 9, PALETTE.PURPLE, 10, true);
        ctx.fillStyle = PALETTE.PINK;
        ctx.beginPath();
        ctx.moveTo(0, -22);
        ctx.lineTo(9, -8);
        ctx.lineTo(-9, -8);
        ctx.closePath();
        ctx.fill();
      } else {
        // Swarming Bees
        for (let k = 0; k < 4; k++) {
          const bx = Math.cos(performance.now() * 0.015 + k * 1.5) * 9;
          const by = Math.sin(performance.now() * 0.02 + k * 1.5) * 6;
          this.renderer.drawGlowCircle(bx, by, 3.5, PALETTE.GOLD, 6, true);
        }
      }
      ctx.restore();
    }

    // 4. Bentley Bear
    const b = this.bentley;
    const bt = this._tileAt(b.r, b.c);
    const groundPos = this._isoProject(b.r, b.c, bt.h, 0);
    const bPos = this._isoProject(b.r, b.c, bt.h, b.z);

    // Shadow on tile
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(groundPos.x, groundPos.y, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (b.invuln <= 0 || Math.floor(b.invuln * 14) % 2 === 0) {
      const bearCol =
        b.hatTimer > 0
          ? Math.floor(performance.now() * 0.02) % 2 === 0
            ? PALETTE.PINK
            : PALETTE.CYAN
          : '#D97706';
      const scale = 2.2;
      const bw = BENTLEY_SPRITE[0].length * scale;
      const bh = BENTLEY_SPRITE.length * scale;
      this.renderer.drawPixelSprite(
        BENTLEY_SPRITE,
        bPos.x - bw * 0.5,
        bPos.y - bh - 2,
        scale,
        {
          B: bearCol,
          Y: '#FDE68A',
          W: PALETTE.WHITE,
          K: '#090D16'
        },
        b.facing < 0
      );

      // Pointy Magic Wizard Hat if active
      if (b.hatTimer > 0) {
        ctx.save();
        ctx.translate(bPos.x, bPos.y - bh - 2);
        ctx.fillStyle = PALETTE.PINK;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(12, 2);
        ctx.lineTo(-12, 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(-14, 0, 28, 4);
        ctx.restore();
      }
    }

    // 5. Floating Popups & Castle Title Legend
    for (const pop of this.popups) {
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HEADER,
        size: 11,
        color: pop.color,
        align: 'center',
        glow: 8
      });
    }

    this.renderer.drawText(`CASTLE: ${theme.name}`, 24, 72, {
      font: FONTS.HEADER,
      size: 11,
      color: theme.accent,
      glow: 8
    });
    if (b.hatTimer > 0) {
      this.renderer.drawText(`MAGIC HAT: ${b.hatTimer.toFixed(1)}s`, 24, 94, {
        font: FONTS.HUD,
        size: 14,
        color: PALETTE.PINK,
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
      extraLabel: `GEMS:${this.gemsRemaining}`,
      accent: theme.accent
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1983 ISOMETRIC GEM CITADEL',
      controls: 'ARROWS/WASD: GUIDE BENTLEY BEAR  |  Z/SPACE: JUMP OVER FOES',
      score: this.score,
      highScore: this.highScore,
      accent: theme.accent
    });
  }
}

export default CrystalCastles;
