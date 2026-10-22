/**
 * RallyX.js
 * Classic 1980 Top-Down Scrolling Maze Racer with Radar & Smoke Screen — Retro Arcade Studio Edition.
 * Collect all 10 Checkered Flags (including the Special 'S' 2x multiplier flag and Lucky 'L' flag)
 * using the live Right-Side Radar Minimap while deploying Smoke Screen clouds to spin out chasing Red Cars!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const MAP_COLS = 36;
const MAP_ROWS = 28;
const TILE = 48;
const WORLD_W = MAP_COLS * TILE;
const WORLD_H = MAP_ROWS * TILE;
const VIEW_W = 730;

export class RallyX {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'rallyx';
    this.title = 'Smoke Rally';
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

    this._initStage();
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.audio.stopSequence();
  }

  _initStage() {
    this.fuel = 100;
    this.flagMultiplier = 1;
    this.flagsCollected = 0;
    this.smokes = [];

    const biomes = [
      { name: 'DESERT SANDSTONE', roadCol: '#292524', wallOuter: '#B45309', wallInner: PALETTE.GREEN },
      { name: 'EMERALD PARK', roadCol: '#1C2826', wallOuter: '#15803D', wallInner: '#86EFAC' },
      { name: 'NIGHT NEON CITY', roadCol: '#0F172A', wallOuter: '#1D4ED8', wallInner: PALETTE.CYAN },
      { name: 'CRIMSON CANYON', roadCol: '#2A1215', wallOuter: '#991B1B', wallInner: PALETTE.ORANGE },
      { name: 'ARCTIC TUNNELS', roadCol: '#1E293B', wallOuter: '#0284C7', wallInner: PALETTE.WHITE },
      { name: 'COASTAL DOCKS', roadCol: '#172554', wallOuter: '#CA8A04', wallInner: PALETTE.GOLD },
      { name: 'GOLDEN DUNES', roadCol: '#271E14', wallOuter: '#D97706', wallInner: '#FDE047' },
      { name: 'CHAMPIONSHIP CIRCUIT', roadCol: '#18181B', wallOuter: '#7E22CE', wallInner: PALETTE.PINK }
    ];
    const stageIdx = (this.level - 1) % 8;
    this.currentBiome = biomes[stageIdx];

    // Build scrolling maze grid (1 = Hedge/Block Wall, 0 = Road) with 8 distinct OG Namco layouts
    this.maze = [];
    for (let r = 0; r < MAP_ROWS; r++) {
      const row = new Array(MAP_COLS).fill(0);
      for (let c = 0; c < MAP_COLS; c++) {
        const inSpawnHub = r >= 12 && r <= 16 && c >= 15 && c <= 21;
        if (r === 0 || r === MAP_ROWS - 1 || c === 0 || c === MAP_COLS - 1) {
          row[c] = 1;
        } else if (!inSpawnHub) {
          if (stageIdx === 0) {
            if ((r % 4 === 2 && c % 5 !== 0) || (c % 6 === 3 && r % 4 !== 0)) row[c] = 1;
          } else if (stageIdx === 1) {
            if ((r % 5 === 2 && c % 4 !== 0) || (c % 5 === 2 && r % 3 === 1)) row[c] = 1;
          } else if (stageIdx === 2) {
            if ((r % 3 === 1 && c % 6 !== 0 && c % 6 !== 1) || (c % 7 === 3 && r % 5 !== 0)) row[c] = 1;
          } else if (stageIdx === 3) {
            if ((r % 4 === 1 && (c + r) % 5 !== 0) || (c % 5 === 3 && r % 4 !== 2)) row[c] = 1;
          } else if (stageIdx === 4) {
            if ((r % 4 === 2 && c % 6 !== 2) || (c % 4 === 2 && r % 5 === 1)) row[c] = 1;
          } else if (stageIdx === 5) {
            if ((r % 5 === 3 && c % 4 !== 1) || (c % 6 === 2 && r % 3 !== 0)) row[c] = 1;
          } else if (stageIdx === 6) {
            if ((r % 3 === 2 && c % 5 !== 0 && c % 5 !== 4) || (c % 5 === 2 && r % 4 === 1)) row[c] = 1;
          } else {
            if ((r % 4 === 2 && c % 4 !== 0) || (c % 5 === 3 && r % 4 !== 0)) row[c] = 1;
          }
        }
      }
      this.maze.push(row);
    }

    // Place 10 Flags (8 Normal, 1 Special 'S' 2x Flag, 1 Lucky 'L' Flag) rotated/shifted per layout
    this.flags = [];
    const colShift = (stageIdx * 3) % 7;
    const baseFlagSpots = [
      { r: 3, c: 4 + colShift, type: 'NORMAL' },
      { r: 3, c: 16, type: 'NORMAL' },
      { r: 3, c: 31 - colShift, type: 'SPECIAL' },
      { r: 9, c: 7, type: 'NORMAL' },
      { r: 9, c: 28, type: 'NORMAL' },
      { r: 15, c: 4, type: 'LUCKY' },
      { r: 15, c: 31, type: 'NORMAL' },
      { r: 21, c: 10, type: 'NORMAL' },
      { r: 21, c: 25, type: 'NORMAL' },
      { r: 25, c: 18, type: 'NORMAL' }
    ];
    for (const fs of baseFlagSpots) {
      // Clear a 3x3 pocket around each flag so it is always reachable
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = Math.max(1, Math.min(MAP_ROWS - 2, fs.r + dr));
          const nc = Math.max(1, Math.min(MAP_COLS - 2, fs.c + dc));
          this.maze[nr][nc] = 0;
        }
      }
      this.flags.push({
        x: (fs.c + 0.5) * TILE,
        y: (fs.r + 0.5) * TILE,
        type: fs.type,
        collected: false
      });
    }

    // Place hazardous Rocks on road (increases across the 8 layouts)
    const rockCoords = [
      { c: 11, r: 7 },
      { c: 24, r: 11 },
      { c: 14, r: 23 },
      { c: 8, r: 18 },
      { c: 27, r: 6 },
      { c: 22, r: 22 }
    ];
    const numRocks = Math.min(rockCoords.length, 3 + Math.floor(stageIdx / 2));
    this.rocks = [];
    for (let i = 0; i < numRocks; i++) {
      const rc = rockCoords[(i + stageIdx) % rockCoords.length];
      this.maze[rc.r][rc.c] = 0;
      this.rocks.push({
        x: (rc.c + 0.5) * TILE,
        y: (rc.r + 0.5) * TILE
      });
    }

    this._resetCars();
  }

  _resetCars() {
    this.player = {
      x: 18.5 * TILE,
      y: 14.5 * TILE,
      vx: 0,
      vy: -220,
      angle: -Math.PI * 0.5,
      smokeCooldown: 0,
      invuln: 2.0
    };

    this.rivals = [];
    const spawns = [
      { c: 4, r: 24 },
      { c: 31, r: 24 },
      { c: 4, r: 4 },
      { c: 31, r: 4 },
      { c: 18, r: 4 }
    ];
    const numRivals = Math.min(5, 2 + this.level);
    for (let i = 0; i < numRivals; i++) {
      const sp = spawns[i % spawns.length];
      this.rivals.push({
        x: (sp.c + 0.5) * TILE,
        y: (sp.r + 0.5) * TILE,
        vx: 180,
        vy: 0,
        angle: 0,
        spinTimer: 0
      });
    }
  }

  _isWallAt(wx, wy, pad = 12) {
    const pts = [
      { x: wx - pad, y: wy - pad },
      { x: wx + pad, y: wy - pad },
      { x: wx - pad, y: wy + pad },
      { x: wx + pad, y: wy + pad }
    ];
    for (const pt of pts) {
      const c = Math.floor(pt.x / TILE);
      const r = Math.floor(pt.y / TILE);
      if (r < 0 || r >= MAP_ROWS || c < 0 || c >= MAP_COLS || this.maze[r][c] === 1) {
        return true;
      }
    }
    return false;
  }

  _addScore(pts, wx, wy, label = null, color = PALETTE.GOLD) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    this.popups.push({
      wx,
      wy,
      text: label || `+${pts}`,
      color,
      life: 0.95
    });
  }

  _crashPlayer(reason = 'CRASH!') {
    if (this.player.invuln > 0) return;
    this.lives--;
    this.audio.playExplosion(0.45, 700);
    this.renderer.shake(10, 0.35);

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.state = 'GAMEOVER';
      this.audio.playGameOver();
      return;
    }

    this.fuel = Math.max(60, this.fuel);
    this._resetCars();
    this.popups.push({
      wx: this.player.x,
      wy: this.player.y - 24,
      text: reason,
      color: PALETTE.RED,
      life: 1.1
    });
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
        this._initStage();
      }
      return;
    }

    const p = this.player;
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (p.smokeCooldown > 0) p.smokeCooldown = Math.max(0, p.smokeCooldown - dt);

    // 1. Fuel Consumption
    this.fuel = Math.max(0, this.fuel - 2.6 * dt);
    const speed = this.fuel > 0 ? 235 : 95;

    // 2. Player Car Steering & Sliding along corridors
    const axis = this.input.getAxis();
    if (Math.hypot(axis.x, axis.y) > 0.1) {
      p.vx = axis.x * speed;
      p.vy = axis.y * speed;
      p.angle = Math.atan2(p.vy, p.vx);
    } else {
      p.vx = Math.cos(p.angle) * speed;
      p.vy = Math.sin(p.angle) * speed;
    }

    const nextX = p.x + p.vx * dt;
    const nextY = p.y + p.vy * dt;
    if (!this._isWallAt(nextX, p.y, 13)) p.x = nextX;
    if (!this._isWallAt(p.x, nextY, 13)) p.y = nextY;

    // 3. Deploy Smoke Screen Cloud (Action A or Action B)
    if (
      (this.input.isDown('actionA') || this.input.isDown('actionB')) &&
      p.smokeCooldown <= 0 &&
      this.fuel > 4
    ) {
      p.smokeCooldown = 0.22;
      this.fuel = Math.max(0, this.fuel - 2.2);
      this.smokes.push({
        x: p.x - Math.cos(p.angle) * 26,
        y: p.y - Math.sin(p.angle) * 26,
        life: 3.2
      });
      this.audio.playDig();
    }

    for (let i = this.smokes.length - 1; i >= 0; i--) {
      this.smokes[i].life -= dt;
      if (this.smokes[i].life <= 0) this.smokes.splice(i, 1);
    }

    // 4. Collect Flags
    let remainingFlags = 0;
    for (const f of this.flags) {
      if (f.collected) continue;
      remainingFlags++;
      if (Math.hypot(f.x - p.x, f.y - p.y) < 26) {
        f.collected = true;
        remainingFlags--;
        this.flagsCollected++;
        if (f.type === 'SPECIAL') {
          this.flagMultiplier = 2;
          this.audio.playPowerUp();
          this._addScore(1000, f.x, f.y, 'SPECIAL FLAG! 2X PTS!', PALETTE.PINK);
        } else if (f.type === 'LUCKY') {
          this.fuel = Math.min(100, this.fuel + 30);
          this.audio.playPowerUp();
          this._addScore(800, f.x, f.y, 'LUCKY FLAG! +FUEL', PALETTE.GREEN);
        } else {
          const pts = this.flagsCollected * 100 * this.flagMultiplier;
          this.audio.playCoin();
          this._addScore(pts, f.x, f.y, `+${pts}`, PALETTE.GOLD);
        }
      }
    }

    if (remainingFlags === 0) {
      const fuelBonus = Math.round(this.fuel * 20);
      this.stageClearTimer = 1.6;
      this.audio.playStageClear();
      this._addScore(fuelBonus, p.x, p.y, `ROUND CLEAR! FUEL +${fuelBonus}`, PALETTE.GREEN);
      return;
    }

    // 5. Check Rock Hazards
    for (const rk of this.rocks) {
      if (Math.hypot(rk.x - p.x, rk.y - p.y) < 24) {
        this._crashPlayer('HIT ROCK!');
        return;
      }
    }

    // 6. Update Pursuing Red Rival Cars
    const rivalSpeed = 175 + this.level * 12;
    for (const rv of this.rivals) {
      // Check if Rival drives into a Smoke Cloud!
      for (const sm of this.smokes) {
        if (Math.hypot(rv.x - sm.x, rv.y - sm.y) < 28 && rv.spinTimer <= 0) {
          rv.spinTimer = 3.0;
          this.audio.playHop();
          this._addScore(150, rv.x, rv.y, 'SMOKED! +150', PALETTE.CYAN);
        }
      }

      if (rv.spinTimer > 0) {
        rv.spinTimer -= dt;
        rv.angle += 14 * dt;
        continue;
      }

      // Steer toward Player
      const dx = p.x - rv.x;
      const dy = p.y - rv.y;
      const desiredAngle =
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : Math.PI) : dy > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;

      const tryX = rv.x + Math.cos(desiredAngle) * rivalSpeed * dt;
      const tryY = rv.y + Math.sin(desiredAngle) * rivalSpeed * dt;
      if (!this._isWallAt(tryX, tryY, 12)) {
        rv.x = tryX;
        rv.y = tryY;
        rv.angle = desiredAngle;
      } else {
        // Slide along open axis
        const altX = rv.x + Math.cos(rv.angle) * rivalSpeed * dt;
        const altY = rv.y + Math.sin(rv.angle) * rivalSpeed * dt;
        if (!this._isWallAt(altX, altY, 12)) {
          rv.x = altX;
          rv.y = altY;
        } else {
          rv.angle += Math.PI * 0.5;
        }
      }

      if (Math.hypot(rv.x - p.x, rv.y - p.y) < 24) {
        this._crashPlayer('CAUGHT BY RIVAL!');
        return;
      }
    }

    // 7. Popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.wy -= 28 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear('#1E1B18');

    const camX = Math.max(0, Math.min(WORLD_W - VIEW_W, this.player.x - VIEW_W * 0.5));
    const camY = Math.max(0, Math.min(WORLD_H - (this.height - 38), this.player.y - (this.height - 38) * 0.5));

    // 1. Left Scrolling Maze Viewport (0..730, y: 38..540)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 38, VIEW_W, this.height - 38);
    ctx.clip();
    ctx.translate(-camX, 38 - camY);

    // Biome Road Background
    const biome = this.currentBiome || { name: 'DESERT SANDSTONE', roadCol: '#292524', wallOuter: '#B45309', wallInner: PALETTE.GREEN };
    ctx.fillStyle = biome.roadCol;
    ctx.fillRect(camX, camY, VIEW_W, this.height - 38);

    // Maze Hedge Walls
    const startC = Math.max(0, Math.floor(camX / TILE));
    const endC = Math.min(MAP_COLS - 1, Math.ceil((camX + VIEW_W) / TILE));
    const startR = Math.max(0, Math.floor(camY / TILE));
    const endR = Math.min(MAP_ROWS - 1, Math.ceil((camY + this.height) / TILE));

    for (let r = startR; r <= endR; r++) {
      for (let c = startC; c <= endC; c++) {
        if (this.maze[r][c] === 1) {
          ctx.fillStyle = biome.wallOuter;
          ctx.fillRect(c * TILE + 2, r * TILE + 2, TILE - 4, TILE - 4);
          ctx.fillStyle = biome.wallInner;
          ctx.fillRect(c * TILE + 8, r * TILE + 8, TILE - 16, TILE - 16);
        }
      }
    }

    // Rocks
    for (const rk of this.rocks) {
      this.renderer.drawGlowCircle(rk.x, rk.y, 14, '#78716C', 6, true);
    }

    // Checkered Flags (Normal, Special 'S', Lucky 'L')
    for (const f of this.flags) {
      if (f.collected) continue;
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(f.x - 2, f.y - 14, 3, 28);
      const flagCol = f.type === 'SPECIAL' ? PALETTE.PINK : f.type === 'LUCKY' ? PALETTE.GREEN : PALETTE.GOLD;
      this.renderer.drawGlowRect(f.x + 1, f.y - 14, 16, 12, flagCol, 8, true);
      if (f.type !== 'NORMAL') {
        this.renderer.drawText(f.type === 'SPECIAL' ? 'S' : 'L', f.x + 9, f.y - 4, {
          font: FONTS.HEADER,
          size: 9,
          color: PALETTE.WHITE,
          align: 'center'
        });
      }
    }

    // Smoke Screen Clouds
    for (const sm of this.smokes) {
      this.renderer.drawGlowCircle(sm.x, sm.y, 18, PALETTE.WHITE, 12, true);
    }

    // Red Rival Cars
    for (const rv of this.rivals) {
      ctx.save();
      ctx.translate(rv.x, rv.y);
      ctx.rotate(rv.angle);
      this.renderer.drawGlowRect(-14, -9, 28, 18, PALETTE.RED, 8, true);
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(4, -6, 6, 12);
      ctx.restore();
    }

    // Player Blue Formula Car
    const p = this.player;
    if (p.invuln <= 0 || Math.floor(p.invuln * 14) % 2 === 0) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      this.renderer.drawGlowRect(-14, -9, 28, 18, PALETTE.CYAN, 10, true);
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(4, -6, 7, 12);
      ctx.restore();
    }

    // Popups
    for (const pop of this.popups) {
      this.renderer.drawText(pop.text, pop.wx, pop.wy, {
        font: FONTS.HEADER,
        size: 11,
        color: pop.color,
        align: 'center',
        glow: 8
      });
    }

    ctx.restore();

    // 2. Right-Side Radar Minimap & Fuel Dashboard (x: 730..960)
    ctx.save();
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(VIEW_W, 38, this.width - VIEW_W, this.height - 38);
    ctx.strokeStyle = PALETTE.GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(VIEW_W, 38);
    ctx.lineTo(VIEW_W, this.height);
    ctx.stroke();

    // Fuel Bar
    this.renderer.drawText('FUEL GAUGE', VIEW_W + 115, 68, {
      font: FONTS.HEADER,
      size: 11,
      color: PALETTE.GOLD,
      align: 'center'
    });
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(VIEW_W + 25, 78, 180, 16);
    ctx.strokeRect(VIEW_W + 25, 78, 180, 16);
    const fuelCol = this.fuel < 25 ? PALETTE.RED : PALETTE.GREEN;
    this.renderer.drawGlowRect(VIEW_W + 27, 80, (this.fuel / 100) * 176, 12, fuelCol, 6, true);

    // Live Radar Minimap
    const rx = VIEW_W + 20;
    const ry = 128;
    const rw = 190;
    const rh = 330;
    this.renderer.drawText('LIVE RADAR', VIEW_W + 115, 118, {
      font: FONTS.HEADER,
      size: 11,
      color: PALETTE.CYAN,
      align: 'center'
    });
    ctx.fillStyle = '#050814';
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);

    const sx = rw / WORLD_W;
    const sy = rh / WORLD_H;

    // Flags on Radar (Yellow/Pink pulsing dots)
    for (const f of this.flags) {
      if (f.collected) continue;
      ctx.fillStyle = f.type === 'SPECIAL' ? PALETTE.PINK : PALETTE.GOLD;
      ctx.fillRect(rx + f.x * sx - 2.5, ry + f.y * sy - 2.5, 5, 5);
    }

    // Rival Cars on Radar (Red dots)
    for (const rv of this.rivals) {
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(rx + rv.x * sx - 3, ry + rv.y * sy - 3, 6, 6);
    }

    // Player Car on Radar (Blinking Cyan/White dot)
    this.renderer.drawGlowCircle(rx + p.x * sx, ry + p.y * sy, 4, PALETTE.CYAN, 8, true);

    this.renderer.drawText(`MULTIPLIER: ${this.flagMultiplier}X`, VIEW_W + 115, 492, {
      font: FONTS.HEADER,
      size: 11,
      color: this.flagMultiplier > 1 ? PALETTE.PINK : PALETTE.MUTED,
      align: 'center'
    });
    ctx.restore();

    // 3. Top HUD & State Overlay
    const flagsLeft = this.flags.filter((f) => !f.collected).length;
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `FLAGS:${flagsLeft}`,
      accent: PALETTE.GOLD
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1980 MAZE RACER & SMOKE SCREEN',
      controls: 'ARROWS/WASD: STEER CAR  |  Z/SPACE: DEPLOY SMOKE SCREEN',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GOLD
    });
  }
}

export default RallyX;
