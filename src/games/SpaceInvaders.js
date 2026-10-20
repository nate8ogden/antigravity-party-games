/**
 * SpaceInvaders.js
 * Flagship Deluxe Arcade Implementation of Space Invaders (1978) for Retro Arcade Studio.
 *
 * Features:
 * - Authentic 5x11 (55 invaders) fleet grid:
 *   Row 0: 11 Squid invaders (30 pts, Neon Pink)
 *   Rows 1-2: 22 Crab invaders (20 pts, Electric Cyan)
 *   Rows 3-4: 22 Octopus invaders (10 pts, Vivid Green)
 * - 2-frame classic pixel-art animation toggled on every fleet march step
 * - Dynamic fleet step interval & 4-note descending bass pulse (audio.playMarch()):
 *   stepInterval = Math.max(0.045, 0.045 + (aliveCount / 55) * 0.58)
 * - 4 Destructible Defense Bunkers at y = 415 backed by a 22x16 voxel erosion matrix
 *   with blast crater carving and green pixel debris on player or alien shot impact
 * - Mystery Flying Saucer (UFO) at y = 62 with warbling synth pulse and 50/100/150/300 pt bonuses
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';
import { wasmCore } from '../engine/WasmCore.js';

const INVADER_SPRITES = {
  // Row 0: Squid (8x8 matrix)
  SQUID_0: [
    '...PP...',
    '..PPPP..',
    '.PPPPPP.',
    'PP.PP.PP',
    'PPPPPPPP',
    '..P..P..',
    '.P.PP.P.',
    'P.P..P.P'
  ],
  SQUID_1: [
    '...PP...',
    '..PPPP..',
    '.PPPPPP.',
    'PP.PP.PP',
    'PPPPPPPP',
    '.P.PP.P.',
    'P......P',
    '.P....P.'
  ],
  // Rows 1-2: Crab (11x8 matrix)
  CRAB_0: [
    '..C.....C..',
    '...C...C...',
    '..CCCCCCC..',
    '.CC.CCC.CC.',
    'CCCCCCCCCCC',
    'C.CCCCCCC.C',
    'C.C.....C.C',
    '...CC.CC...'
  ],
  CRAB_1: [
    '..C.....C..',
    'C..C...C..C',
    'C.CCCCCCC.C',
    'CCC.CCC.CCC',
    'CCCCCCCCCCC',
    '.CCCCCCCCC.',
    '..C.....C..',
    '.C.......C.'
  ],
  // Rows 3-4: Octopus (12x8 matrix)
  OCTOPUS_0: [
    '....GGGG....',
    '.GGGGGGGGGG.',
    'GGGGGGGGGGGG',
    'GGG..GG..GGG',
    'GGGGGGGGGGGG',
    '...GG..GG...',
    '..GG.GG.GG..',
    'GG........GG'
  ],
  OCTOPUS_1: [
    '....GGGG....',
    '.GGGGGGGGGG.',
    'GGGGGGGGGGGG',
    'GGG..GG..GGG',
    'GGGGGGGGGGGG',
    '..GGG..GGG..',
    '.GG..GG..GG.',
    '..GG....GG..'
  ],
  // Mystery UFO (16x7 matrix)
  UFO: [
    '.....RRRRRR.....',
    '...RRRRRRRRRR...',
    '..RRRRRRRRRRRR..',
    '.RR.RR.RR.RR.RR.',
    'RRRRRRRRRRRRRRRR',
    '..RRR..RR..RRR..',
    '...R........R...'
  ],
  // Player Laser Cannon (13x8 matrix)
  CANNON: [
    '......G......',
    '.....GGG.....',
    '.....GGG.....',
    '.GGGGGGGGGGG.',
    'GGGGGGGGGGGGG',
    'GGGGGGGGGGGGG',
    'GGGGGGGGGGGGG',
    'GGGGGGGGGGGGG'
  ]
};

const SPRITE_COLORS = {
  P: PALETTE.PINK,
  C: PALETTE.CYAN,
  G: PALETTE.GREEN,
  R: PALETTE.RED,
  Y: PALETTE.GOLD,
  W: PALETTE.WHITE
};

const UFO_BONUS_TABLE = [100, 50, 50, 100, 150, 100, 100, 50, 300, 100, 100, 100, 50, 150, 100];

export class SpaceInvaders {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'spaceinvaders';
    this.title = 'Cosmic Armada';
    this.state = 'PLAYING';

    this.width = 960;
    this.height = 540;

    this.highScore = HighScoreStore.get(this.id);
    this.bgStars = [];
    this._initBackgroundStars();
    this.reset();
  }

  _initBackgroundStars() {
    this.bgStars = [];
    for (let i = 0; i < 65; i++) {
      this.bgStars.push({
        x: Math.random() * this.width,
        y: 42 + Math.random() * 440,
        size: Math.random() < 0.25 ? 2 : 1.5,
        phase: Math.random() * Math.PI * 2,
        speed: 1.5 + Math.random() * 3
      });
    }
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.shotsFiredCount = 0;

    this.player = {
      x: this.width / 2,
      y: 488,
      speed: 310,
      fireCooldown: 0,
      invulnTimer: 1.0
    };

    this.playerBullets = [];
    this.alienBullets = [];
    this.particles = [];
    this.floatingTexts = [];

    this.ufo = null;
    this.ufoSpawnTimer = 11.5;
    this.ufoSirenTimer = 0;

    this._initBunkers();
    this._spawnFleet(this.level);
  }

  setState(nextState) {
    this.state = nextState;
  }

  destroy() {
    if (this.audio) {
      this.audio.stopSequence();
    }
  }

  /**
   * Builds 4 classic arch-shaped defense bunkers at y = 415 backed by a 22x16 voxel matrix
   */
  _initBunkers() {
    this.bunkers = [];
    const cols = 22;
    const rows = 16;
    const voxelSize = 4; // 88x64 px per bunker
    const bunkerCenters = [200, 386, 574, 760];

    for (const cx of bunkerCenters) {
      const grid = [];
      for (let r = 0; r < rows; r++) {
        const rowArr = [];
        for (let c = 0; c < cols; c++) {
          let solid = true;
          // Bevel top-left and top-right corners for classic arcade arch silhouette
          if (r + c < 4) solid = false;
          if (r + (cols - 1 - c) < 4) solid = false;
          // Carve hollow bottom arch under the shield
          if (r >= 10 && c >= 6 && c <= 15) solid = false;
          if (r === 9 && c >= 7 && c <= 14) solid = false;
          rowArr.push(solid ? 1 : 0);
        }
        grid.push(rowArr);
      }

      this.bunkers.push({
        x: Math.round(cx - (cols * voxelSize) / 2),
        y: 415 - (rows * voxelSize) / 2,
        cols,
        rows,
        voxelSize,
        grid
      });
    }
  }

  /**
   * Spawns the 5 rows x 11 columns (55 invaders) fleet grid
   */
  _spawnFleet(level) {
    this.invaders = [];
    this.alienBullets = [];
    this.animFrame = 0;
    this.fleetDir = 1; // 1 = right, -1 = left
    this.stepTimer = 0;
    this.alienFireTimer = 0.9;

    const cols = 11;
    const rows = 5;
    const spacingX = 52;
    const spacingY = 38;
    const startX = (this.width - (cols - 1) * spacingX) / 2;
    const startY = Math.min(185, 102 + (level - 1) * 14);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let type = 'octopus';
        let points = 10;
        let color = PALETTE.GREEN;

        if (r === 0) {
          type = 'squid';
          points = 30;
          color = PALETTE.PINK;
        } else if (r === 1 || r === 2) {
          type = 'crab';
          points = 20;
          color = PALETTE.CYAN;
        }

        this.invaders.push({
          row: r,
          col: c,
          type,
          points,
          color,
          x: startX + c * spacingX,
          y: startY + r * spacingY,
          alive: true
        });
      }
    }
  }

  getAliveCount() {
    let count = 0;
    for (const inv of this.invaders) {
      if (inv.alive) count++;
    }
    return count;
  }

  getStepInterval() {
    const aliveCount = this.getAliveCount();
    return Math.max(0.045, 0.045 + (aliveCount / 55) * 0.58);
  }

  update(dt) {
    const clampedDt = Math.min(dt, 0.05);

    for (const s of this.bgStars) {
      s.phase += s.speed * clampedDt;
    }

    if (this.state === 'MENU') {
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

    if (this.state === 'GAMEOVER') {
      if (this.input.isJustPressed('actionA') || this.input.isJustPressed('any')) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.input.isJustPressed('pause')) {
      this.audio.playMenuMove();
      this.state = 'PAUSED';
      return;
    }

    this._updatePlayer(clampedDt);
    this._updateFleetMarch(clampedDt);
    this._updateUFO(clampedDt);
    this._updateProjectiles(clampedDt);
    this._updateParticles(clampedDt);

    // Check if wave is cleared
    if (this.getAliveCount() === 0) {
      this.level += 1;
      this.audio.playStageClear();
      this._spawnFloatingText(`WAVE ${this.level}`, this.width / 2, 250, PALETTE.GOLD);
      this._spawnFleet(this.level);
    }
  }

  _updatePlayer(dt) {
    const p = this.player;
    if (p.invulnTimer > 0) {
      p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    }
    if (p.fireCooldown > 0) {
      p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    }

    const axis = this.input.getAxis();
    let moveX = axis.x;
    if (this.input.pointer.down && this.input.pointer.y > 40) {
      const diff = this.input.pointer.x - p.x;
      if (Math.abs(diff) > 6) {
        moveX = Math.max(-1, Math.min(1, diff / 45));
      }
    }

    p.x = Math.max(46, Math.min(this.width - 46, p.x + moveX * p.speed * dt));

    const wantsFire =
      this.input.isJustPressed('actionA') ||
      (this.input.isDown('actionA') && p.fireCooldown <= 0) ||
      (this.input.pointer.down && p.fireCooldown <= 0);

    // Classic Space Invaders allows 1 active player laser bolt (or rapid reload when destroyed)
    if (wantsFire && p.fireCooldown <= 0 && this.playerBullets.length < 2) {
      p.fireCooldown = 0.24;
      this.shotsFiredCount += 1;
      this.audio.playLaser(1100, 210, 0.12);
      this.playerBullets.push({
        x: p.x,
        y: p.y - 14,
        vy: -590
      });
    }
  }

  _updateFleetMarch(dt) {
    const stepInterval = this.getStepInterval();
    this.stepTimer += dt;

    if (this.stepTimer >= stepInterval) {
      this.stepTimer -= stepInterval;
      this._stepFleetOnce();
    }

    // Periodic alien projectile firing from bottom-most invaders of active columns
    this.alienFireTimer -= dt;
    if (this.alienFireTimer <= 0) {
      const aliveRatio = this.getAliveCount() / 55;
      this.alienFireTimer = Math.max(0.32, 0.45 + aliveRatio * 0.65 - this.level * 0.04);
      this._fireAlienProjectile();
    }
  }

  _stepFleetOnce() {
    const aliveInvaders = this.invaders.filter((inv) => inv.alive);
    if (aliveInvaders.length === 0) return;

    // Play the iconic 4-note descending bass pulse
    this.audio.playMarch();

    // Toggle 2-frame invader animation
    this.animFrame = (this.animFrame + 1) % 2;

    const stepX = 14 * this.fleetDir;
    const dropY = 18;

    // Check if next horizontal step crosses screen edge (x < 40 or x > 920)
    let hitEdge = false;
    for (const inv of aliveInvaders) {
      const nextX = inv.x + stepX;
      if (nextX < 40 || nextX > 920) {
        hitEdge = true;
        break;
      }
    }

    if (hitEdge) {
      this.fleetDir *= -1;
      for (const inv of aliveInvaders) {
        inv.y += dropY;
      }
    } else {
      for (const inv of aliveInvaders) {
        inv.x += stepX;
      }
    }

    // Erode bunkers if low-marching invaders touch them, or trigger Game Over at cannon line
    for (const inv of aliveInvaders) {
      if (inv.y >= 370) {
        this._erodeBunkersAtPoint(inv.x, inv.y + 8, 3.2, false);
      }
      if (inv.y >= this.player.y - 16) {
        // Invaders reached bottom defense line!
        HighScoreStore.submit(this.id, this.score);
        this.audio.playGameOver();
        this.state = 'GAMEOVER';
        return;
      }
    }
  }

  _fireAlienProjectile() {
    if (this.alienBullets.length >= 4 + Math.min(3, this.level)) return;

    // Find bottom-most alive invader in each column
    const bottomByCol = new Map();
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      const existing = bottomByCol.get(inv.col);
      if (!existing || inv.row > existing.row) {
        bottomByCol.set(inv.col, inv);
      }
    }

    const shooters = Array.from(bottomByCol.values());
    if (shooters.length === 0) return;

    // Choose between Rolling (tracks player column), Plunger, or Squiggly shot
    const shotTypes = ['rolling', 'plunger', 'squiggly'];
    const shotType = shotTypes[Math.floor(Math.random() * shotTypes.length)];

    let shooter = shooters[Math.floor(Math.random() * shooters.length)];
    if (shotType === 'rolling') {
      // Rolling shot prioritizes column closest to player cannon
      shooters.sort((a, b) => Math.abs(a.x - this.player.x) - Math.abs(b.x - this.player.x));
      shooter = shooters[0];
    }

    const speed =
      shotType === 'squiggly'
        ? 250 + this.level * 12
        : shotType === 'plunger'
        ? 220 + this.level * 10
        : 205 + this.level * 10;

    this.alienBullets.push({
      x: shooter.x,
      y: shooter.y + 12,
      vy: speed,
      type: shotType,
      phase: 0
    });
  }

  _updateUFO(dt) {
    if (!this.ufo) {
      this.ufoSpawnTimer -= dt;
      if (this.ufoSpawnTimer <= 0) {
        this.ufoSpawnTimer = 15 + Math.random() * 7;
        const fromLeft = Math.random() < 0.5;
        this.ufo = {
          x: fromLeft ? -36 : this.width + 36,
          y: 62,
          vx: fromLeft ? 135 : -135
        };
      }
      return;
    }

    this.ufo.x += this.ufo.vx * dt;
    this.ufoSirenTimer += dt;
    if (this.ufoSirenTimer >= 0.24) {
      this.ufoSirenTimer = 0;
      this.audio.playSiren(0.25, false);
    }

    if (
      (this.ufo.vx > 0 && this.ufo.x > this.width + 48) ||
      (this.ufo.vx < 0 && this.ufo.x < -48)
    ) {
      this.ufo = null;
    }
  }

  /**
   * Checks if (x, y) hits a solid voxel inside any of the 4 bunkers; if so, erodes a blast crater
   * of radius `craterRadius` in voxel coordinates and spawns green pixel debris.
   */
  _erodeBunkersAtPoint(x, y, craterRadius = 2.6, spawnDebris = true) {
    for (const b of this.bunkers) {
      const w = b.cols * b.voxelSize;
      const h = b.rows * b.voxelSize;
      if (x < b.x - 4 || x > b.x + w + 4 || y < b.y - 4 || y > b.y + h + 4) {
        continue;
      }

      const hitCol = Math.floor((x - b.x) / b.voxelSize);
      const hitRow = Math.floor((y - b.y) / b.voxelSize);

      // Verify if a solid voxel is at or immediately adjacent to the impact point
      let touchedSolid = false;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = hitRow + dr;
          const cc = hitCol + dc;
          if (rr >= 0 && rr < b.rows && cc >= 0 && cc < b.cols && b.grid[rr][cc] > 0) {
            touchedSolid = true;
            break;
          }
        }
        if (touchedSolid) break;
      }

      if (!touchedSolid) continue;

      // Carve blast crater out of the voxel grid via WebAssembly linear memory kernel
      wasmCore.erodeVoxelMatrix(b.grid, hitCol, hitRow, craterRadius);

      if (spawnDebris) {
        this._spawnExplosion(x, y, PALETTE.GREEN, 10, 95);
        this.audio.playDig();
      }
      return true;
    }
    return false;
  }

  _updateProjectiles(dt) {
    // Update player laser bolts
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const pb = this.playerBullets[i];
      pb.y += pb.vy * dt;

      if (pb.y < 40) {
        this._spawnExplosion(pb.x, 42, PALETTE.RED, 6, 70);
        this.playerBullets.splice(i, 1);
        continue;
      }

      // 1. Check collision with destructible defense bunkers
      if (this._erodeBunkersAtPoint(pb.x, pb.y, 2.3, true)) {
        this.playerBullets.splice(i, 1);
        continue;
      }

      // 2. Check collision with Mystery Flying Saucer (UFO)
      if (
        this.ufo &&
        Math.abs(pb.x - this.ufo.x) < 22 &&
        Math.abs(pb.y - this.ufo.y) < 12
      ) {
        const bonusValues = [50, 100, 150, 300];
        const tableBonus = UFO_BONUS_TABLE[this.shotsFiredCount % UFO_BONUS_TABLE.length];
        const bonus = bonusValues.includes(tableBonus) ? tableBonus : 100;

        this.score += bonus;
        if (this.score > this.highScore) {
          this.highScore = this.score;
          HighScoreStore.submit(this.id, this.score);
        }

        this.audio.playPowerUp();
        this._spawnExplosion(this.ufo.x, this.ufo.y, PALETTE.RED, 26, 180);
        this._spawnFloatingText(`${bonus}`, this.ufo.x, this.ufo.y, PALETTE.GOLD);
        this.ufo = null;
        this.playerBullets.splice(i, 1);
        continue;
      }

      // 3. Check collision with alien projectiles mid-air
      let interceptedShot = false;
      for (let k = this.alienBullets.length - 1; k >= 0; k--) {
        const ab = this.alienBullets[k];
        if (Math.abs(pb.x - ab.x) < 7 && Math.abs(pb.y - ab.y) < 10) {
          this._spawnExplosion(ab.x, ab.y, PALETTE.GOLD, 8, 90);
          this.alienBullets.splice(k, 1);
          interceptedShot = true;
          break;
        }
      }
      if (interceptedShot) {
        this.playerBullets.splice(i, 1);
        continue;
      }

      // 4. Check collision with marching fleet invaders
      let hitInvader = false;
      for (const inv of this.invaders) {
        if (!inv.alive) continue;
        if (Math.abs(pb.x - inv.x) < 15 && Math.abs(pb.y - inv.y) < 12) {
          inv.alive = false;
          hitInvader = true;
          this.score += inv.points;
          if (this.score > this.highScore) {
            this.highScore = this.score;
            HighScoreStore.submit(this.id, this.score);
          }
          this.audio.playExplosion(0.24, 1250);
          this._spawnExplosion(inv.x, inv.y, inv.color, 18, 150);
          this._spawnFloatingText(`+${inv.points}`, inv.x, inv.y - 6, inv.color);
          break;
        }
      }

      if (hitInvader) {
        this.playerBullets.splice(i, 1);
      }
    }

    // Update alien projectiles (Rolling, Plunger, Squiggly)
    for (let i = this.alienBullets.length - 1; i >= 0; i--) {
      const ab = this.alienBullets[i];
      ab.y += ab.vy * dt;
      ab.phase += dt * 18;

      if (ab.y > 512) {
        this._spawnExplosion(ab.x, 512, PALETTE.GREEN, 5, 60);
        this.alienBullets.splice(i, 1);
        continue;
      }

      // Check collision with destructible defense bunkers
      if (this._erodeBunkersAtPoint(ab.x, ab.y, 2.7, true)) {
        this.alienBullets.splice(i, 1);
        continue;
      }

      // Check collision with player laser cannon
      if (
        this.player.invulnTimer <= 0 &&
        Math.abs(ab.x - this.player.x) < 16 &&
        Math.abs(ab.y - this.player.y) < 12
      ) {
        this.alienBullets.splice(i, 1);
        this._hitPlayer();
      }
    }
  }

  _hitPlayer() {
    this.renderer.shake(8, 0.32);
    this.audio.playExplosion(0.45, 780);
    this._spawnExplosion(this.player.x, this.player.y, PALETTE.GREEN, 30, 190);

    this.lives -= 1;
    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.audio.playGameOver();
      this.state = 'GAMEOVER';
    } else {
      this.player.x = this.width / 2;
      this.player.invulnTimer = 2.0;
    }
  }

  _spawnExplosion(x, y, color, count = 14, maxSpeed = 140) {
    const colors = [color, PALETTE.WHITE, PALETTE.GOLD];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 30 + Math.random() * maxSpeed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.28 + Math.random() * 0.3,
        maxLife: 0.58,
        size: 2.5 + Math.random() * 2.5,
        color: colors[i % colors.length]
      });
    }
  }

  _spawnFloatingText(text, x, y, color = PALETTE.GOLD) {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -38,
      life: 0.9,
      maxLife: 0.9,
      color
    });
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear(PALETTE.BG);

    // 1. Subtle deep-space starfield & phosphor ground baseline
    ctx.save();
    for (const s of this.bgStars) {
      ctx.globalAlpha = 0.25 + 0.35 * Math.sin(s.phase);
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.restore();

    // Glowing green arcade ground line at y = 514
    this.renderer.drawGlowRect(30, 514, this.width - 60, 2, PALETTE.GREEN, 8);

    // 2. Render 4 Destructible Defense Bunkers (voxel grids)
    this._renderBunkers(ctx);

    // 3. Render Mystery Flying Saucer (UFO) at y = 62
    if (this.ufo) {
      const scale = 2.4;
      const w = INVADER_SPRITES.UFO[0].length * scale;
      const h = INVADER_SPRITES.UFO.length * scale;
      this.renderer.drawPixelSprite(
        INVADER_SPRITES.UFO,
        this.ufo.x - w / 2,
        this.ufo.y - h / 2,
        scale,
        SPRITE_COLORS
      );
    }

    // 4. Render 5x11 Invader Fleet with 2-frame step animation
    this._renderFleet();

    // 5. Render Player Laser Cannon
    if (
      this.player.invulnTimer <= 0 ||
      Math.floor(this.player.invulnTimer * 14) % 2 === 0
    ) {
      const scale = 2.4;
      const w = INVADER_SPRITES.CANNON[0].length * scale;
      const h = INVADER_SPRITES.CANNON.length * scale;
      this.renderer.drawPixelSprite(
        INVADER_SPRITES.CANNON,
        this.player.x - w / 2,
        this.player.y - h / 2,
        scale,
        SPRITE_COLORS
      );
    }

    // 6. Render Player & Alien Projectiles
    for (const pb of this.playerBullets) {
      this.renderer.drawGlowRect(pb.x - 2, pb.y - 7, 4, 14, PALETTE.GREEN, 10);
    }

    for (const ab of this.alienBullets) {
      this._renderAlienProjectile(ctx, ab);
    }

    // 7. Render Explosions & Floating Score Popups
    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 6;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      ctx.restore();
    }

    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      this.renderer.drawText(ft.text, ft.x, ft.y, {
        font: FONTS.HEADER,
        size: 12,
        color: ft.color,
        align: 'center',
        glow: 8
      });
      ctx.restore();
    }

    // 8. Top Arcade HUD & State Overlay
    const aliveCount = this.getAliveCount();
    this.renderer.drawHUD({
      title: 'SPACE INVADERS',
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `FLEET: ${aliveCount}/55`,
      accent: PALETTE.GREEN
    });

    this.renderer.drawStateOverlay(this.state, {
      title: 'SPACE INVADERS',
      subtitle: '5x11 FLEET MARCH & DESTRUCTIBLE VOXEL BUNKERS',
      controls: 'ARROWS/A-D: SLIDE CANNON  |  SPACE/Z/CLICK: FIRE LASER  |  P: PAUSE',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GREEN
    });
  }

  _renderBunkers(ctx) {
    ctx.save();
    ctx.fillStyle = PALETTE.GREEN;
    ctx.shadowColor = PALETTE.GREEN;
    ctx.shadowBlur = 6;

    for (const b of this.bunkers) {
      const vs = b.voxelSize;
      for (let r = 0; r < b.rows; r++) {
        const rowArr = b.grid[r];
        for (let c = 0; c < b.cols; c++) {
          if (rowArr[c] > 0) {
            ctx.fillRect(b.x + c * vs, b.y + r * vs, vs, vs);
          }
        }
      }
    }
    ctx.restore();
  }

  _renderFleet() {
    const scale = 2.3;
    for (const inv of this.invaders) {
      if (!inv.alive) continue;

      let sprite = null;
      if (inv.type === 'squid') {
        sprite = this.animFrame === 0 ? INVADER_SPRITES.SQUID_0 : INVADER_SPRITES.SQUID_1;
      } else if (inv.type === 'crab') {
        sprite = this.animFrame === 0 ? INVADER_SPRITES.CRAB_0 : INVADER_SPRITES.CRAB_1;
      } else {
        sprite = this.animFrame === 0 ? INVADER_SPRITES.OCTOPUS_0 : INVADER_SPRITES.OCTOPUS_1;
      }

      const w = sprite[0].length * scale;
      const h = sprite.length * scale;
      this.renderer.drawPixelSprite(
        sprite,
        inv.x - w / 2,
        inv.y - h / 2,
        scale,
        SPRITE_COLORS
      );
    }
  }

  _renderAlienProjectile(ctx, ab) {
    const flip = Math.floor(ab.phase) % 2 === 0 ? 1 : -1;
    ctx.save();
    if (ab.type === 'squiggly') {
      ctx.strokeStyle = PALETTE.PINK;
      ctx.shadowColor = PALETTE.PINK;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(ab.x - 3 * flip, ab.y - 6);
      ctx.lineTo(ab.x + 3 * flip, ab.y - 2);
      ctx.lineTo(ab.x - 3 * flip, ab.y + 2);
      ctx.lineTo(ab.x + 3 * flip, ab.y + 6);
      ctx.stroke();
    } else if (ab.type === 'plunger') {
      ctx.fillStyle = PALETTE.CYAN;
      ctx.shadowColor = PALETTE.CYAN;
      ctx.shadowBlur = 8;
      ctx.fillRect(ab.x - 1.5, ab.y - 6, 3, 12);
      ctx.fillRect(ab.x - 4, ab.y + (flip > 0 ? 3 : -3), 8, 2.5);
    } else {
      // Rolling shot
      ctx.fillStyle = PALETTE.GOLD;
      ctx.shadowColor = PALETTE.GOLD;
      ctx.shadowBlur = 8;
      ctx.fillRect(ab.x - 1.5, ab.y - 6, 3, 12);
      ctx.fillRect(ab.x - 3.5, ab.y - 1, 7, 2);
    }
    ctx.restore();
  }
}

export default SpaceInvaders;
