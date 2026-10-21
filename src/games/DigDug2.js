/**
 * DigDug2.js
 * Classic 1985 Namco Overhead Island Action Game (Dig Dug II: Trouble in Paradise / Island Driller).
 *
 * Features:
 * - Overhead tropical green island surrounded by animated sparkling blue ocean water
 * - Grid of fault-line pegs (`this.pegs`) across multiple distinct island silhouettes per stage
 * - Action A fires the air pump hose to inflate Pookas and fire-breathing Fygars (4 stages until pop!)
 * - Action B (or Action A on a peg) jackhammers a fault-line crack between pegs or to the coastline
 * - Connected-component flood-fill: connecting a fault line from coast to coast splits the island,
 *   breaking off and sinking the smaller island chunk into the ocean and drowning all monsters on it!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const SPRITES = {
  TAIZO: [
    '...WWWWWW...',
    '..WWWWWWWW..',
    '..WWBBBBWW..',
    '..WFFBBFFW..',
    '...FFFFFF...',
    '..BBBBBBBB..',
    '.BBWWWWWWBB.',
    '.BBWBBBBWBB.',
    '..BBBBBBBB..',
    '...WW..WW...',
    '..RRR..RRR..'
  ],
  POOKA: [
    '...RRRRRR...',
    '..RRRRRRRR..',
    '.RYYYYYYYYR.',
    '.RYBBYYBBYR.',
    'RRYYYYYYYYRR',
    'RRRRRRRRRRRR',
    '.RRRRRRRRRR.',
    '..RRRRRRRR..',
    '...YY..YY...',
    '..YYY..YYY..'
  ],
  FYGAR: [
    '..YY....YY..',
    '.GGGGGGGGGG.',
    '.GWWWWWWWWG.',
    'GGWBBWWBBWGG',
    'GGGGGGGGGGGG',
    'GGRRRRRRRRGG',
    '.GGGGGGGGGG.',
    '..GGGGGGGG..',
    '...OO..OO...',
    '..OOO..OOO..'
  ]
};

const SPRITE_PALETTE = {
  W: PALETTE.WHITE,
  B: '#2563EB',
  F: '#FDBA74',
  R: PALETTE.RED,
  Y: PALETTE.GOLD,
  G: PALETTE.GREEN,
  O: PALETTE.ORANGE
};

export class DigDug2 {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'digdug2';
    this.title = 'Island Driller';
    this.state = 'PLAYING';

    this.width = 960;
    this.height = 540;

    // Island grid dimensions (20x12 tiles of 36px each)
    this.cols = 20;
    this.rows = 12;
    this.tileSize = 36;
    this.originX = Math.floor((this.width - this.cols * this.tileSize) / 2); // 120
    this.originY = 68;

    this.highScore = HighScoreStore.get(this.id);
    this.waterTime = 0;
    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.islandsSunk = 0;

    this._loadLevel(this.level);
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    if (this.audio) {
      this.audio.stopSequence();
    }
  }

  _loadLevel(level) {
    this.grid = [];
    const shapeIdx = (level - 1) % 4;

    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) {
        // Keep outer 1-tile ring as ocean water
        if (r === 0 || r === this.rows - 1 || c === 0 || c === this.cols - 1) {
          row.push(0);
          continue;
        }
        let isLand = true;
        if (shapeIdx === 0) {
          // Stage 1: Classic Tropical Atoll with corner coves
          if ((r <= 1 || r >= this.rows - 2) && (c <= 2 || c >= this.cols - 3)) isLand = false;
        } else if (shapeIdx === 1) {
          // Stage 2: Twin Peninsula Hourglass
          if ((c >= 8 && c <= 11) && (r <= 2 || r >= this.rows - 3)) isLand = false;
          if ((r <= 1 || r >= this.rows - 2) && (c <= 1 || c >= this.cols - 2)) isLand = false;
        } else if (shapeIdx === 2) {
          // Stage 3: Cross Reef Island
          if ((r <= 2 || r >= this.rows - 3) && (c <= 3 || c >= this.cols - 4)) isLand = false;
        } else {
          // Stage 4: Horseshoe Bay Island
          if (r >= 7 && c >= 8 && c <= 11) isLand = false;
          if (r <= 1 && (c <= 2 || c >= this.cols - 3)) isLand = false;
        }
        row.push(isLand ? 1 : 0);
      }
      this.grid.push(row);
    }

    // Build fault-line pegs at even interior grid intersections (vx = 2..18, vy = 2..10)
    this.pegs = [];
    for (let vy = 2; vy <= this.rows - 2; vy += 2) {
      for (let vx = 2; vx <= this.cols - 2; vx += 2) {
        if (this._isVertexOnLand(vx, vy)) {
          this.pegs.push({
            vx,
            vy,
            x: this.originX + vx * this.tileSize,
            y: this.originY + vy * this.tileSize,
            drilled: false
          });
        }
      }
    }

    // Cracks stored as unit grid-edge segments: key = "vx1,vy1-vx2,vy2"
    this.cracks = new Set();
    this.crackLines = [];
    this.sinkingChunks = [];
    this.enemies = [];
    this.particles = [];
    this.floatingTexts = [];
    this.bonusFruit = null;

    // Spawn player near center land
    const spawnTile = this._findSafeLandTile(10, 5);
    this.player = {
      x: this.originX + (spawnTile.c + 0.5) * this.tileSize,
      y: this.originY + (spawnTile.r + 0.5) * this.tileSize,
      dirX: 1,
      dirY: 0,
      speed: 145,
      invuln: 1.6,
      pumpTarget: null,
      pumpLength: 0,
      pumpActive: false,
      pumpCooldown: 0,
      drillAnim: 0
    };

    // Spawn Pookas and Fygars on valid land tiles away from player
    const totalEnemies = Math.min(10, 4 + level);
    for (let i = 0; i < totalEnemies; i++) {
      let er = 2 + Math.floor(Math.random() * (this.rows - 4));
      let ec = 2 + Math.floor(Math.random() * (this.cols - 4));
      const tile = this._findSafeLandTile(ec, er, spawnTile.c, spawnTile.r);
      const isFygar = i % 2 === 1;
      const angle = (i * Math.PI) / 2;
      this.enemies.push({
        id: i + 1,
        type: isFygar ? 'fygar' : 'pooka',
        x: this.originX + (tile.c + 0.5) * this.tileSize,
        y: this.originY + (tile.r + 0.5) * this.tileSize,
        dirX: Math.round(Math.cos(angle)) || 1,
        dirY: Math.round(Math.sin(angle)) || 0,
        speed: 68 + Math.min(45, level * 5),
        inflate: 0, // 0..4 (4 = pop!)
        deflateTimer: 0,
        dirTimer: 0.8 + Math.random() * 1.4,
        fireTimer: 2.5 + Math.random() * 2.5,
        breathingFire: 0
      });
    }

    this.bannerText = `ISLAND ${level} — FAULT DRILLER READY!`;
    this.bannerTimer = 2.0;
  }

  _isVertexOnLand(vx, vy) {
    // A vertex is on the island if at least one of its 4 surrounding tiles is land
    const coords = [
      [vy - 1, vx - 1],
      [vy - 1, vx],
      [vy, vx - 1],
      [vy, vx]
    ];
    return coords.some(
      ([r, c]) => r >= 0 && r < this.rows && c >= 0 && c < this.cols && this.grid[r][c] === 1
    );
  }

  _findSafeLandTile(prefC, prefR, avoidC = -99, avoidR = -99) {
    let best = { c: prefC, r: prefR, dist: 999 };
    for (let r = 1; r < this.rows - 1; r++) {
      for (let c = 1; c < this.cols - 1; c++) {
        if (this.grid[r][c] !== 1) continue;
        if (Math.hypot(c - avoidC, r - avoidR) < 3.2) continue;
        const d = Math.hypot(c - prefC, r - prefR);
        if (d < best.dist) {
          best = { c, r, dist: d };
        }
      }
    }
    return best;
  }

  _edgeKey(x1, y1, x2, y2) {
    if (x1 < x2 || (x1 === x2 && y1 < y2)) {
      return `${x1},${y1}-${x2},${y2}`;
    }
    return `${x2},${y2}-${x1},${y1}`;
  }

  _isLandAtPixel(px, py) {
    const c = Math.floor((px - this.originX) / this.tileSize);
    const r = Math.floor((py - this.originY) / this.tileSize);
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return false;
    return this.grid[r][c] === 1;
  }

  /**
   * Hammers a fault crack from the nearest peg in the player's facing direction
   */
  _triggerFaultDrill() {
    const p = this.player;
    // Find nearest peg within 26px
    let nearestPeg = null;
    let bestDist = 28;
    for (const peg of this.pegs) {
      if (!this._isVertexOnLand(peg.vx, peg.vy)) continue;
      const d = Math.hypot(peg.x - p.x, peg.y - p.y);
      if (d < bestDist) {
        bestDist = d;
        nearestPeg = peg;
      }
    }

    if (!nearestPeg) {
      this._spawnFloatingText('STAND ON A PEG TO DRILL!', p.x, p.y - 24, PALETTE.GOLD);
      this.audio.playDig();
      return;
    }

    nearestPeg.drilled = true;
    p.drillAnim = 0.28;
    this.audio.playDig();
    this.renderer.shake(4, 0.14);

    // Shoot fault line in facing direction (up to next peg = 2 tiles, or until ocean edge)
    const dx = p.dirX;
    const dy = p.dirY;
    let curVx = nearestPeg.vx;
    let curVy = nearestPeg.vy;
    let addedAny = false;

    // Drill up to 2 tiles to the next peg, AND if the next vertex is adjacent to water, continue to water!
    let maxSteps = 2;
    for (let step = 0; step < maxSteps; step++) {
      const nextVx = curVx + dx;
      const nextVy = curVy + dy;
      if (nextVx < 0 || nextVx > this.cols || nextVy < 0 || nextVy > this.rows) break;

      const key = this._edgeKey(curVx, curVy, nextVx, nextVy);
      if (!this.cracks.has(key)) {
        this.cracks.add(key);
        this.crackLines.push({
          x1: this.originX + curVx * this.tileSize,
          y1: this.originY + curVy * this.tileSize,
          x2: this.originX + nextVx * this.tileSize,
          y2: this.originY + nextVy * this.tileSize
        });
        addedAny = true;
      }

      curVx = nextVx;
      curVy = nextVy;

      // If we reached another peg and the tile beyond it is water, extend 1 more unit to reach the coast!
      if (step === 1) {
        const beyondVx = curVx + dx;
        const beyondVy = curVy + dy;
        if (!this._isVertexSurroundedByLand(curVx, curVy)) {
          break;
        } else if (!this._isVertexSurroundedByLand(beyondVx, beyondVy)) {
          maxSteps = 3;
        }
      }
    }

    if (addedAny) {
      this._checkAndSinkDisconnectedChunks();
    }
  }

  _isVertexSurroundedByLand(vx, vy) {
    const coords = [
      [vy - 1, vx - 1],
      [vy - 1, vx],
      [vy, vx - 1],
      [vy, vx]
    ];
    return coords.every(
      ([r, c]) => r >= 0 && r < this.rows && c >= 0 && c < this.cols && this.grid[r][c] === 1
    );
  }

  /**
   * Flood-fills land tiles respecting fault-line cracks along tile boundaries.
   * Any smaller disconnected component breaks off and sinks into the sea!
   */
  _checkAndSinkDisconnectedChunks() {
    const visited = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
    const components = [];

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] !== 1 || visited[r][c]) continue;

        const comp = [];
        const queue = [[r, c]];
        visited[r][c] = true;

        while (queue.length > 0) {
          const [cr, cc] = queue.shift();
          comp.push({ r: cr, c: cc });

          // Check 4 neighbors and verify no fault crack separates the shared tile edge
          const neighbors = [
            { nr: cr - 1, nc: cc, edge: this._edgeKey(cc, cr, cc + 1, cr) }, // top edge
            { nr: cr + 1, nc: cc, edge: this._edgeKey(cc, cr + 1, cc + 1, cr + 1) }, // bottom edge
            { nr: cr, nc: cc - 1, edge: this._edgeKey(cc, cr, cc, cr + 1) }, // left edge
            { nr: cr, nc: cc + 1, edge: this._edgeKey(cc + 1, cr, cc + 1, cr + 1) } // right edge
          ];

          for (const nb of neighbors) {
            if (nb.nr < 0 || nb.nr >= this.rows || nb.nc < 0 || nb.nc >= this.cols) continue;
            if (visited[nb.nr][nb.nc] || this.grid[nb.nr][nb.nc] !== 1) continue;
            if (this.cracks.has(nb.edge)) continue; // Blocked by fault crack!
            visited[nb.nr][nb.nc] = true;
            queue.push([nb.nr, nb.nc]);
          }
        }
        components.push(comp);
      }
    }

    if (components.length <= 1) return;

    // Sort components largest to smallest; keep largest, sink all smaller ones!
    components.sort((a, b) => b.length - a.length);
    const sunkTiles = [];
    for (let i = 1; i < components.length; i++) {
      for (const t of components[i]) {
        this.grid[t.r][t.c] = 0;
        sunkTiles.push(t);
      }
    }

    if (sunkTiles.length === 0) return;

    this.islandsSunk += 1;
    this.renderer.shake(10, 0.45);
    this.audio.playExplosion(0.55, 650);

    // Check which enemies were standing on the sinking chunk
    let drownedCount = 0;
    let sumX = 0;
    let sumY = 0;
    for (const t of sunkTiles) {
      sumX += this.originX + (t.c + 0.5) * this.tileSize;
      sumY += this.originY + (t.r + 0.5) * this.tileSize;
    }
    const centerChunkX = sumX / sunkTiles.length;
    const centerChunkY = sumY / sunkTiles.length;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!this._isLandAtPixel(e.x, e.y)) {
        drownedCount += 1;
        this._spawnSplash(e.x, e.y, PALETTE.CYAN, 16);
        this.enemies.splice(i, 1);
      }
    }

    const chunkBonus = sunkTiles.length * 50 + (drownedCount > 0 ? Math.pow(2, drownedCount) * 500 : 0);
    this.score += chunkBonus;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }

    this.sinkingChunks.push({
      tiles: sunkTiles,
      offsetY: 0,
      alpha: 1.0
    });

    const msg =
      drownedCount > 0
        ? `ISLAND SUNK! ${drownedCount} DROWNED +${chunkBonus}!`
        : `CHUNK SUNK! +${chunkBonus}`;
    this._spawnFloatingText(msg, centerChunkX, centerChunkY, PALETTE.GOLD);

    // If player was standing on the edge of the sunk chunk, nudge onto nearest remaining land if close
    if (!this._isLandAtPixel(this.player.x, this.player.y)) {
      const pc = Math.floor((this.player.x - this.originX) / this.tileSize);
      const pr = Math.floor((this.player.y - this.originY) / this.tileSize);
      const safe = this._findSafeLandTile(pc, pr);
      if (safe.dist <= 2.2) {
        this.player.x = this.originX + (safe.c + 0.5) * this.tileSize;
        this.player.y = this.originY + (safe.r + 0.5) * this.tileSize;
      } else {
        this._hitPlayer();
      }
    }

    // Spawn bonus tropical pineapple after sinking 2 chunks
    if (this.islandsSunk % 2 === 0 && !this.bonusFruit && components[0].length > 0) {
      const pick = components[0][Math.floor(components[0].length / 2)];
      this.bonusFruit = {
        x: this.originX + (pick.c + 0.5) * this.tileSize,
        y: this.originY + (pick.r + 0.5) * this.tileSize,
        timer: 9.0,
        pts: 1000 * this.level
      };
    }
  }

  update(dt) {
    const clampedDt = Math.min(dt, 0.05);
    this.waterTime += clampedDt;

    if (this.state === 'MENU' || this.state === 'GAMEOVER') {
      if (this.input.isJustPressed('actionA') || this.input.isJustPressed('any')) {
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

    if (this.input.isJustPressed('pause')) {
      this.audio.playMenuMove();
      this.state = 'PAUSED';
      return;
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer = Math.max(0, this.bannerTimer - clampedDt);
    }

    // Update sinking island chunks
    for (let i = this.sinkingChunks.length - 1; i >= 0; i--) {
      const ch = this.sinkingChunks[i];
      ch.offsetY += 35 * clampedDt;
      ch.alpha -= 1.25 * clampedDt;
      if (ch.alpha <= 0) {
        this.sinkingChunks.splice(i, 1);
      }
    }

    this._updatePlayer(clampedDt);
    this._updateEnemies(clampedDt);
    this._updateParticles(clampedDt);

    if (this.bonusFruit) {
      this.bonusFruit.timer -= clampedDt;
      if (Math.hypot(this.player.x - this.bonusFruit.x, this.player.y - this.bonusFruit.y) < 22) {
        this.score += this.bonusFruit.pts;
        if (this.score > this.highScore) {
          this.highScore = this.score;
          HighScoreStore.submit(this.id, this.score);
        }
        this.audio.playCoin();
        this._spawnFloatingText(`PINEAPPLE +${this.bonusFruit.pts}`, this.bonusFruit.x, this.bonusFruit.y, PALETTE.GOLD);
        this.bonusFruit = null;
      } else if (this.bonusFruit.timer <= 0) {
        this.bonusFruit = null;
      }
    }

    if (this.enemies.length === 0 && this.sinkingChunks.length === 0) {
      this.level += 1;
      this.audio.playStageClear();
      this._loadLevel(this.level);
    }
  }

  _updatePlayer(dt) {
    const p = this.player;
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (p.pumpCooldown > 0) p.pumpCooldown = Math.max(0, p.pumpCooldown - dt);
    if (p.drillAnim > 0) p.drillAnim = Math.max(0, p.drillAnim - dt);

    const axis = this.input.getAxis();
    if (Math.abs(axis.x) > 0.1 || Math.abs(axis.y) > 0.1) {
      p.pumpActive = false;
      p.pumpTarget = null;
      if (Math.abs(axis.x) >= Math.abs(axis.y)) {
        p.dirX = Math.sign(axis.x);
        p.dirY = 0;
      } else {
        p.dirX = 0;
        p.dirY = Math.sign(axis.y);
      }

      const nx = p.x + axis.x * p.speed * dt;
      const ny = p.y + axis.y * p.speed * dt;
      if (this._isLandAtPixel(nx, p.y)) p.x = nx;
      if (this._isLandAtPixel(p.x, ny)) p.y = ny;
    }

    // Action B: Jackhammer fault peg!
    if (this.input.isJustPressed('actionB')) {
      this._triggerFaultDrill();
      return;
    }

    // Action A: Pump hose OR jackhammer if standing right on a peg with no enemy in front
    if (this.input.isJustPressed('actionA')) {
      if (p.pumpTarget && this.enemies.includes(p.pumpTarget)) {
        this._inflateEnemy(p.pumpTarget);
        return;
      }

      // Check if an enemy is within hose range (76px) in facing direction
      const hoseTipX = p.x + p.dirX * 68;
      const hoseTipY = p.y + p.dirY * 68;
      let hitEnemy = null;
      for (const e of this.enemies) {
        // Check segment from p to hoseTip
        for (let f = 0.25; f <= 1.0; f += 0.25) {
          const sx = p.x + (hoseTipX - p.x) * f;
          const sy = p.y + (hoseTipY - p.y) * f;
          if (Math.hypot(e.x - sx, e.y - sy) < 22) {
            hitEnemy = e;
            break;
          }
        }
        if (hitEnemy) break;
      }

      if (hitEnemy) {
        p.pumpTarget = hitEnemy;
        p.pumpActive = true;
        this._inflateEnemy(hitEnemy);
      } else {
        // Check if standing on a peg — if so, Action A also drills the peg!
        const onPeg = this.pegs.some(
          (peg) => this._isVertexOnLand(peg.vx, peg.vy) && Math.hypot(peg.x - p.x, peg.y - p.y) < 22
        );
        if (onPeg) {
          this._triggerFaultDrill();
        } else {
          p.pumpActive = true;
          p.pumpCooldown = 0.18;
          this.audio.playPump(1);
        }
      }
    } else if (p.pumpCooldown <= 0 && !p.pumpTarget) {
      p.pumpActive = false;
    }
  }

  _inflateEnemy(enemy) {
    enemy.inflate += 1;
    enemy.deflateTimer = 1.1;
    this.audio.playPump(enemy.inflate);

    if (enemy.inflate >= 4) {
      const idx = this.enemies.indexOf(enemy);
      if (idx !== -1) {
        const pts = enemy.type === 'fygar' ? 400 : 250;
        this.score += pts;
        if (this.score > this.highScore) {
          this.highScore = this.score;
          HighScoreStore.submit(this.id, this.score);
        }
        this.audio.playPop();
        this._spawnSplash(enemy.x, enemy.y, PALETTE.PINK, 20);
        this._spawnFloatingText(`POP! +${pts}`, enemy.x, enemy.y, PALETTE.GOLD);
        this.enemies.splice(idx, 1);
      }
      this.player.pumpTarget = null;
      this.player.pumpActive = false;
    }
  }

  _updateEnemies(dt) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      if (e.inflate > 0) {
        e.deflateTimer -= dt;
        if (e.deflateTimer <= 0) {
          e.inflate = Math.max(0, e.inflate - 1);
          e.deflateTimer = 0.95;
          if (e.inflate === 0 && this.player.pumpTarget === e) {
            this.player.pumpTarget = null;
            this.player.pumpActive = false;
          }
        }
        continue;
      }

      if (e.type === 'fygar') {
        if (e.breathingFire > 0) {
          e.breathingFire -= dt;
          // Check if player is in Fygar fire cone
          const fireX = e.x + (e.dirX || 1) * 42;
          const fireY = e.y;
          if (
            this.player.invuln <= 0 &&
            Math.abs(this.player.x - fireX) < 32 &&
            Math.abs(this.player.y - fireY) < 18
          ) {
            this._hitPlayer();
          }
          continue;
        }
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          e.fireTimer = 3.2 + Math.random() * 2.0;
          e.breathingFire = 0.55;
          if (e.dirX === 0) e.dirX = 1;
          this.audio.playLaser(480, 140, 0.2);
          continue;
        }
      }

      e.dirTimer -= dt;
      const nx = e.x + e.dirX * e.speed * dt;
      const ny = e.y + e.dirY * e.speed * dt;

      if (!this._isLandAtPixel(nx, ny) || e.dirTimer <= 0) {
        e.dirTimer = 0.9 + Math.random() * 1.4;
        // Pick direction roughly toward player or valid land
        const dirs = [
          { dx: 1, dy: 0 },
          { dx: -1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: 0, dy: -1 }
        ].filter((d) =>
          this._isLandAtPixel(e.x + d.dx * 22, e.y + d.dy * 22)
        );
        if (dirs.length > 0) {
          dirs.sort((a, b) => {
            const da = Math.hypot(e.x + a.dx * 30 - this.player.x, e.y + a.dy * 30 - this.player.y);
            const db = Math.hypot(e.x + b.dx * 30 - this.player.x, e.y + b.dy * 30 - this.player.y);
            return da - db;
          });
          const pick = Math.random() < 0.65 ? dirs[0] : dirs[Math.floor(Math.random() * dirs.length)];
          e.dirX = pick.dx;
          e.dirY = pick.dy;
        } else {
          e.dirX = -e.dirX;
          e.dirY = -e.dirY;
        }
      } else {
        e.x = nx;
        e.y = ny;
      }

      // Collision with player
      if (this.player.invuln <= 0 && Math.hypot(e.x - this.player.x, e.y - this.player.y) < 20) {
        this._hitPlayer();
      }
    }
  }

  _hitPlayer() {
    this.renderer.shake(8, 0.3);
    this.audio.playHit();
    this._spawnSplash(this.player.x, this.player.y, PALETTE.RED, 24);
    this.lives -= 1;

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.audio.playGameOver();
      this.state = 'GAMEOVER';
    } else {
      const safe = this._findSafeLandTile(10, 5);
      this.player.x = this.originX + (safe.c + 0.5) * this.tileSize;
      this.player.y = this.originY + (safe.r + 0.5) * this.tileSize;
      this.player.invuln = 2.2;
      this.player.pumpTarget = null;
      this.player.pumpActive = false;
    }
  }

  _spawnSplash(x, y, color, count = 16) {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const spd = 40 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.35 + Math.random() * 0.3,
        maxLife: 0.65,
        size: 3 + Math.random() * 3,
        color: i % 2 === 0 ? color : PALETTE.WHITE
      });
    }
  }

  _spawnFloatingText(text, x, y, color) {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -38,
      life: 1.1,
      maxLife: 1.1,
      color
    });
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  render(ctx = this.renderer.ctx) {
    // 1. Animated Sparkling Blue Ocean Water Background
    ctx.fillStyle = '#072F5F';
    ctx.fillRect(0, 38, this.width, this.height - 38);

    ctx.save();
    for (let wy = 54; wy < this.height; wy += 28) {
      for (let wx = 24; wx < this.width; wx += 48) {
        const waveShift = Math.sin(this.waterTime * 3 + wy * 0.08 + wx * 0.05) * 8;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wx + waveShift, wy, 10, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 2. Sinking Island Chunks (falling into the ocean with whitewater foam)
    for (const ch of this.sinkingChunks) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ch.alpha);
      for (const t of ch.tiles) {
        const tx = this.originX + t.c * this.tileSize;
        const ty = this.originY + t.r * this.tileSize + ch.offsetY;
        ctx.fillStyle = '#15803D';
        ctx.fillRect(tx, ty, this.tileSize, this.tileSize);
        ctx.strokeStyle = PALETTE.WHITE;
        ctx.lineWidth = 2;
        ctx.strokeRect(tx, ty, this.tileSize, this.tileSize);
      }
      ctx.restore();
    }

    // 3. Intact Tropical Island Tiles (Sandy cliff rim + lush green grass top)
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] !== 1) continue;
        const tx = this.originX + c * this.tileSize;
        const ty = this.originY + r * this.tileSize;

        // Cliff edge below if bottom neighbor is ocean
        if (r + 1 >= this.rows || this.grid[r + 1][c] === 0) {
          ctx.fillStyle = '#B45309';
          ctx.fillRect(tx, ty + this.tileSize - 2, this.tileSize, 10);
          // White surf foam
          const foam = 2 + Math.sin(this.waterTime * 5 + c) * 1.5;
          ctx.fillStyle = 'rgba(248, 250, 252, 0.75)';
          ctx.fillRect(tx, ty + this.tileSize + 6, this.tileSize, foam);
        }

        // Lush tropical turf
        ctx.fillStyle = (r + c) % 2 === 0 ? '#16A34A' : '#15803D';
        ctx.fillRect(tx, ty, this.tileSize, this.tileSize);

        // Subtle grass tufts
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(tx + 8, ty + 8, 4, 4);
        ctx.fillRect(tx + 22, ty + 20, 4, 4);
      }
    }

    // 4. Jagged Fault-Line Cracks
    ctx.save();
    ctx.strokeStyle = '#1E1B18';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (const cl of this.crackLines) {
      ctx.beginPath();
      ctx.moveTo(cl.x1, cl.y1);
      const midX = (cl.x1 + cl.x2) / 2 + (cl.y1 === cl.y2 ? 0 : 4);
      const midY = (cl.y1 + cl.y2) / 2 + (cl.x1 === cl.x2 ? 0 : -4);
      ctx.lineTo(midX, midY);
      ctx.lineTo(cl.x2, cl.y2);
      ctx.stroke();
    }
    ctx.restore();

    // 5. Fault-Line Pegs
    for (const peg of this.pegs) {
      if (!this._isVertexOnLand(peg.vx, peg.vy)) continue;
      ctx.save();
      ctx.fillStyle = peg.drilled ? PALETTE.ORANGE : PALETTE.GOLD;
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.drilled ? 5 : 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 6. Bonus Tropical Pineapple
    if (this.bonusFruit) {
      this.renderer.drawGlowCircle(this.bonusFruit.x, this.bonusFruit.y, 10, PALETTE.GOLD, 10);
      this.renderer.drawGlowRect(this.bonusFruit.x - 4, this.bonusFruit.y - 15, 8, 6, PALETTE.GREEN, 6);
    }

    // 7. Air Pump Hose
    const p = this.player;
    if (p.pumpActive) {
      const tx = p.pumpTarget ? p.pumpTarget.x : p.x + p.dirX * 56;
      const ty = p.pumpTarget ? p.pumpTarget.y : p.y + p.dirY * 56;
      ctx.save();
      ctx.strokeStyle = PALETTE.RED;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      this.renderer.drawGlowCircle(tx, ty, 5, PALETTE.GOLD, 8);
      ctx.restore();
    }

    // 8. Pookas & Fygars (scaling up with inflation stage!)
    for (const e of this.enemies) {
      const sprite = e.type === 'fygar' ? SPRITES.FYGAR : SPRITES.POOKA;
      const scale = 2.2 + e.inflate * 0.65;
      const w = sprite[0].length * scale;
      const h = sprite.length * scale;
      this.renderer.drawPixelSprite(
        sprite,
        e.x - w / 2,
        e.y - h / 2,
        scale,
        SPRITE_PALETTE,
        e.dirX < 0
      );

      // Fygar fire breath
      if (e.type === 'fygar' && e.breathingFire > 0) {
        const dir = e.dirX || 1;
        this.renderer.drawGlowRect(
          dir > 0 ? e.x + 14 : e.x - 62,
          e.y - 10,
          48,
          20,
          PALETTE.ORANGE,
          14
        );
      }
    }

    // 9. Player (Taizo Hori)
    if (p.invuln <= 0 || Math.floor(p.invuln * 14) % 2 === 0) {
      const scale = 2.2;
      const w = SPRITES.TAIZO[0].length * scale;
      const h = SPRITES.TAIZO.length * scale;
      const jitterY = p.drillAnim > 0 ? (Math.floor(p.drillAnim * 40) % 2) * 3 : 0;
      this.renderer.drawPixelSprite(
        SPRITES.TAIZO,
        p.x - w / 2,
        p.y - h / 2 + jitterY,
        scale,
        SPRITE_PALETTE,
        p.dirX < 0
      );
    }

    // 10. Particles & Floating Texts
    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      ctx.restore();
    }

    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      this.renderer.drawText(ft.text, ft.x, ft.y, {
        font: FONTS.HEADER,
        size: 11,
        color: ft.color,
        align: 'center',
        glow: 8
      });
      ctx.restore();
    }

    if (this.bannerTimer > 0 && this.state === 'PLAYING') {
      this.renderer.drawText(this.bannerText, this.width / 2, 265, {
        font: FONTS.HEADER,
        size: 14,
        color: PALETTE.GOLD,
        align: 'center',
        glow: 12
      });
    }

    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `MONSTERS: ${this.enemies.length}`,
      accent: PALETTE.GREEN
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'ISLAND FAULT-SPLITTING & PUMP EDITION',
      controls: 'ARROWS/WASD: WALK  |  SPACE/Z: PUMP / DRILL PEG  |  X/SHIFT: JACKHAMMER FAULT',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GREEN
    });
  }
}

export default DigDug2;
