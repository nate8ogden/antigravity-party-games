/**
 * BattleCity.js
 * Classic 1985 Namco Top-Down Tank Warfare & Base Defense ("Tank Battalion").
 * Features a 26x16 destructible tile battlefield protecting the Phoenix Base Emblem,
 * 5 terrain types (Red Brick, White Steel, Camouflage Trees, Blue Water, Slippery Ice),
 * 4 enemy tank classes (Light, Fast, Sniper, 3-Hit Heavy Armor), and 5 flashing power-ups
 * (Star Upgrade, Grenade Wipe, Shovel Steel Base Fortification, Clock Freeze, Helmet Shield).
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const TILE = {
  EMPTY: 0,
  BRICK: 1,
  STEEL: 2,
  TREES: 3,
  WATER: 4,
  ICE: 5,
  BASE: 6,
  BASE_DEAD: 7
};

const DIRS = {
  up: { x: 0, y: -1, angle: 0 },
  right: { x: 1, y: 0, angle: Math.PI * 0.5 },
  down: { x: 0, y: 1, angle: Math.PI },
  left: { x: -1, y: 0, angle: -Math.PI * 0.5 }
};

const ENEMY_TYPES = {
  LIGHT: { name: 'LIGHT', hp: 1, speed: 86, bulletSpeed: 260, pts: 100, color: '#CBD5E1' },
  FAST: { name: 'FAST', hp: 1, speed: 138, bulletSpeed: 290, pts: 200, color: '#38BDF8' },
  SNIPER: { name: 'SNIPER', hp: 1, speed: 95, bulletSpeed: 410, pts: 300, color: '#F59E0B' },
  HEAVY: { name: 'HEAVY', hp: 3, speed: 68, bulletSpeed: 270, pts: 400, color: '#10B981' }
};

const POWERUP_TYPES = ['STAR', 'GRENADE', 'SHOVEL', 'CLOCK', 'HELMET'];

export class BattleCity {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'battlecity';
    this.title = 'Tank Battalion';

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    // 26x16 Tile Grid (28x28px tiles = 728x448 battlefield)
    this.cols = 26;
    this.rows = 16;
    this.tileSize = 28;
    this.arenaX = 36;
    this.arenaY = 58;

    this.grid = [];
    this.brickHp = [];
    this.player = null;
    this.enemies = [];
    this.bullets = [];
    this.powerUp = null;
    this.particles = [];
    this.popups = [];

    this.enemiesRemainingToSpawn = 16;
    this.spawnTimer = 0;
    this.spawnIndex = 0;
    this.freezeTimer = 0;
    this.shovelTimer = 0;
    this.baseDestroyed = false;
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
    this.initStage(this.level, true);
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    if (this.audio && typeof this.audio.stopSequence === 'function') {
      this.audio.stopSequence();
    }
  }

  addScore(pts, x = null, y = null, color = PALETTE.GOLD, label = null) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    if (x !== null && y !== null) {
      this.popups.push({
        text: label ? `${label} +${pts}` : `+${pts}`,
        x,
        y,
        vy: -36,
        life: 1.0,
        maxLife: 1.0,
        color
      });
    }
  }

  initStage(level, fullReset = false) {
    this.bullets = [];
    this.enemies = [];
    this.particles = [];
    this.popups = [];
    this.powerUp = null;
    this.freezeTimer = 0;
    this.shovelTimer = 0;
    this.baseDestroyed = false;
    this.stageClearTimer = 0;
    this.deathTimer = 0;
    this.enemiesRemainingToSpawn = 14 + Math.min(10, level * 2);
    this.spawnTimer = 0.6;
    this.spawnIndex = 0;

    this.buildMap(level);
    const keepStar = !fullReset && this.player ? this.player.starLevel : 0;
    this.spawnPlayer(keepStar);
  }

  buildMap(level) {
    this.grid = [];
    this.brickHp = [];
    for (let r = 0; r < this.rows; r++) {
      this.grid.push(new Uint8Array(this.cols).fill(TILE.EMPTY));
      this.brickHp.push(new Uint8Array(this.cols).fill(0));
    }

    const setTile = (c, r, t) => {
      if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
        this.grid[r][c] = t;
        this.brickHp[r][c] = t === TILE.BRICK ? 2 : 0;
      }
    };

    const layoutIdx = (level - 1) % 3;
    // Construct classic symmetrical columns & terrain bands
    for (let r = 2; r <= 12; r++) {
      if (r === 6 || r === 7) continue;
      for (const c of [2, 3, 6, 7, 10, 11, 14, 15, 18, 19, 22, 23]) {
        setTile(c, r, TILE.BRICK);
      }
    }

    // River / Steel / Forest / Ice features varying by stage layout
    if (layoutIdx === 0) {
      for (let c = 4; c <= 21; c++) {
        if (c === 12 || c === 13) setTile(c, 7, TILE.STEEL);
        else if (c >= 8 && c <= 17) setTile(c, 7, TILE.BRICK);
      }
      for (let r = 5; r <= 9; r++) {
        setTile(0, r, TILE.TREES);
        setTile(1, r, TILE.TREES);
        setTile(24, r, TILE.TREES);
        setTile(25, r, TILE.TREES);
      }
      setTile(5, 4, TILE.STEEL);
      setTile(20, 4, TILE.STEEL);
    } else if (layoutIdx === 1) {
      // River channel with twin bridges
      for (let c = 0; c < this.cols; c++) {
        if (c !== 5 && c !== 6 && c !== 19 && c !== 20) {
          setTile(c, 7, TILE.WATER);
        } else {
          setTile(c, 7, TILE.ICE);
        }
      }
      for (let c = 9; c <= 16; c++) {
        setTile(c, 4, TILE.TREES);
        setTile(c, 10, TILE.ICE);
      }
      setTile(12, 3, TILE.STEEL);
      setTile(13, 3, TILE.STEEL);
    } else {
      // Ice & Steel Fortress
      for (let c = 4; c <= 21; c++) {
        setTile(c, 6, TILE.ICE);
        setTile(c, 8, TILE.TREES);
      }
      for (const c of [4, 5, 12, 13, 20, 21]) {
        setTile(c, 4, TILE.STEEL);
        setTile(c, 10, TILE.STEEL);
      }
    }

    // Clear top 3 enemy spawn zones & player spawn zone
    for (const sc of [0, 1, 12, 13, 24, 25]) {
      setTile(sc, 0, TILE.EMPTY);
      setTile(sc, 1, TILE.EMPTY);
    }
    for (let c = 8; c <= 17; c++) {
      setTile(c, 14, TILE.EMPTY);
      setTile(c, 15, TILE.EMPTY);
    }

    // Phoenix Base Emblem at bottom center (cols 12..13, row 15) + Brick Wall perimeter
    this.fortifyBase(TILE.BRICK);
    setTile(12, 15, TILE.BASE);
    setTile(13, 15, TILE.BASE);
  }

  fortifyBase(wallType = TILE.BRICK) {
    const coords = [
      [11, 14], [12, 14], [13, 14], [14, 14],
      [11, 15], [14, 15]
    ];
    for (const [c, r] of coords) {
      this.grid[r][c] = wallType;
      this.brickHp[r][c] = wallType === TILE.BRICK ? 2 : 0;
    }
  }

  spawnPlayer(starLevel = 0) {
    // Spawn just left of the Phoenix Base
    this.player = {
      x: this.arenaX + 9.5 * this.tileSize,
      y: this.arenaY + 15 * this.tileSize,
      vx: 0,
      vy: 0,
      dir: 'up',
      radius: 11,
      speed: 112,
      starLevel,
      shieldTimer: 3.5, // Spawn helmet shield
      fireCooldown: 0,
      treadTick: 0
    };
  }

  spawnEnemy() {
    if (this.enemiesRemainingToSpawn <= 0 || this.enemies.length >= 5) return;
    const spawnCols = [1, 12.5, 24];
    const sc = spawnCols[this.spawnIndex % spawnCols.length];
    this.spawnIndex++;
    const sx = this.arenaX + sc * this.tileSize;
    const sy = this.arenaY + 0.8 * this.tileSize;

    // Roll enemy archetype
    const roll = (this.spawnIndex + this.level) % 6;
    let typeKey = 'LIGHT';
    if (roll === 1 || roll === 4) typeKey = 'FAST';
    else if (roll === 2) typeKey = 'SNIPER';
    else if (roll === 5) typeKey = 'HEAVY';

    const def = ENEMY_TYPES[typeKey];
    const isBonus = this.spawnIndex % 4 === 0;

    this.enemiesRemainingToSpawn--;
    this.enemies.push({
      typeKey,
      name: def.name,
      hp: def.hp,
      maxHp: def.hp,
      pts: def.pts,
      color: def.color,
      isBonus,
      x: sx,
      y: sy,
      dir: 'down',
      radius: 11,
      speed: def.speed,
      bulletSpeed: def.bulletSpeed,
      fireCooldown: 0.9 + Math.random() * 0.8,
      turnTimer: 1.2 + Math.random() * 1.4,
      treadTick: 0
    });
  }

  worldToTile(x, y) {
    return {
      c: Math.floor((x - this.arenaX) / this.tileSize),
      r: Math.floor((y - this.arenaY) / this.tileSize)
    };
  }

  isTileSolidForTank(c, r) {
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return true;
    const t = this.grid[r][c];
    return t === TILE.BRICK || t === TILE.STEEL || t === TILE.WATER || t === TILE.BASE || t === TILE.BASE_DEAD;
  }

  canTankOccupy(x, y, radius = 11) {
    const corners = [
      { x: x - radius, y: y - radius },
      { x: x + radius, y: y - radius },
      { x: x - radius, y: y + radius },
      { x: x + radius, y: y + radius }
    ];
    for (const pt of corners) {
      const { c, r } = this.worldToTile(pt.x, pt.y);
      if (this.isTileSolidForTank(c, r)) return false;
    }
    return true;
  }

  isTankOnIce(x, y) {
    const { c, r } = this.worldToTile(x, y);
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return false;
    return this.grid[r][c] === TILE.ICE;
  }

  fireBullet(tank, isPlayer) {
    const vec = DIRS[tank.dir];
    const bSpeed = isPlayer ? 310 + tank.starLevel * 55 : tank.bulletSpeed;
    const canBreakSteel = isPlayer && tank.starLevel >= 3;

    this.bullets.push({
      x: tank.x + vec.x * 14,
      y: tank.y + vec.y * 14,
      vx: vec.x * bSpeed,
      vy: vec.y * bSpeed,
      isPlayer,
      canBreakSteel
    });

    if (isPlayer) {
      this.audio.playLaser(560, 180, 0.08);
    }
  }

  spawnRandomPowerUp() {
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    const c = 2 + Math.floor(Math.random() * (this.cols - 4));
    const r = 2 + Math.floor(Math.random() * (this.rows - 5));
    this.powerUp = {
      type,
      x: this.arenaX + (c + 0.5) * this.tileSize,
      y: this.arenaY + (r + 0.5) * this.tileSize,
      timer: 14.0
    };
    this.audio.playCoin();
  }

  collectPowerUp(pu) {
    this.audio.playPowerUp();
    this.addScore(500, pu.x, pu.y - 12, PALETTE.GOLD, pu.type);

    if (pu.type === 'STAR') {
      this.player.starLevel = Math.min(3, this.player.starLevel + 1);
    } else if (pu.type === 'HELMET') {
      this.player.shieldTimer = 12.0;
    } else if (pu.type === 'CLOCK') {
      this.freezeTimer = 10.0;
    } else if (pu.type === 'SHOVEL') {
      this.shovelTimer = 16.0;
      this.fortifyBase(TILE.STEEL);
    } else if (pu.type === 'GRENADE') {
      // Wipe all active enemy tanks on screen!
      for (const e of this.enemies) {
        this.spawnExplosion(e.x, e.y, PALETTE.ORANGE, 22);
        this.addScore(e.pts, e.x, e.y, PALETTE.GOLD);
      }
      this.enemies = [];
      this.audio.playExplosion(0.45, 800);
      this.renderer.shake(10, 0.3);
      this.checkVictory();
    }
    this.powerUp = null;
  }

  spawnExplosion(x, y, color = PALETTE.ORANGE, count = 20) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.2;
      const spd = 45 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 3.5 + Math.random() * 2.5,
        life: 0.4 + Math.random() * 0.25,
        color: i % 2 === 0 ? color : PALETTE.GOLD
      });
    }
  }

  destroyBase() {
    if (this.baseDestroyed) return;
    this.baseDestroyed = true;
    this.grid[15][12] = TILE.BASE_DEAD;
    this.grid[15][13] = TILE.BASE_DEAD;
    const bx = this.arenaX + 13 * this.tileSize;
    const by = this.arenaY + 15.5 * this.tileSize;
    this.spawnExplosion(bx, by, PALETTE.RED, 38);
    this.audio.playExplosion(0.55, 650);
    this.renderer.shake(12, 0.4);
    this.popups.push({
      text: 'PHOENIX BASE DESTROYED!',
      x: bx,
      y: by - 30,
      vy: -25,
      life: 1.5,
      maxLife: 1.5,
      color: PALETTE.RED
    });
    HighScoreStore.submit(this.id, this.score);
    this.audio.playGameOver();
    this.state = 'GAMEOVER';
  }

  killPlayer() {
    if (this.deathTimer > 0 || this.stageClearTimer > 0) return;
    this.lives--;
    this.audio.playExplosion(0.4, 800);
    this.renderer.shake(9, 0.3);
    this.spawnExplosion(this.player.x, this.player.y, PALETTE.GOLD, 26);

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.audio.playGameOver();
      this.state = 'GAMEOVER';
    } else {
      this.deathTimer = 1.2;
    }
  }

  checkVictory() {
    if (this.enemiesRemainingToSpawn <= 0 && this.enemies.length === 0 && this.stageClearTimer <= 0) {
      this.addScore(1500, 400, 260, PALETTE.GREEN, 'BATTALION CLEARED');
      this.audio.playStageClear();
      this.stageClearTimer = 1.6;
    }
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

    this.updateEffects(dt);

    if (this.stageClearTimer > 0) {
      this.stageClearTimer -= dt;
      if (this.stageClearTimer <= 0) {
        this.level++;
        this.initStage(this.level, false);
      }
      return;
    }

    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.spawnPlayer(0);
      }
      return;
    }

    // Power-up timers
    if (this.freezeTimer > 0) this.freezeTimer = Math.max(0, this.freezeTimer - dt);
    if (this.shovelTimer > 0) {
      this.shovelTimer -= dt;
      if (this.shovelTimer <= 0) {
        this.fortifyBase(TILE.BRICK);
      }
    }
    if (this.powerUp) {
      this.powerUp.timer -= dt;
      if (this.powerUp.timer <= 0) this.powerUp = null;
    }

    // Spawn enemy tanks periodically
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(1.4, 2.8 - this.level * 0.15);
      this.spawnEnemy();
    }

    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
  }

  updatePlayer(dt) {
    const p = this.player;
    if (p.shieldTimer > 0) p.shieldTimer = Math.max(0, p.shieldTimer - dt);
    if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt);

    let moveDir = null;
    if (this.input.isDown('up')) moveDir = 'up';
    else if (this.input.isDown('down')) moveDir = 'down';
    else if (this.input.isDown('left')) moveDir = 'left';
    else if (this.input.isDown('right')) moveDir = 'right';

    const onIce = this.isTankOnIce(p.x, p.y);
    const spd = p.speed + p.starLevel * 12;

    if (moveDir) {
      p.dir = moveDir;
      const vec = DIRS[moveDir];
      p.vx = vec.x * spd;
      p.vy = vec.y * spd;
      p.treadTick += dt * 16;
    } else if (onIce) {
      // Slide on ice!
      p.vx *= Math.pow(0.18, dt);
      p.vy *= Math.pow(0.18, dt);
    } else {
      p.vx = 0;
      p.vy = 0;
    }

    if (Math.hypot(p.vx, p.vy) > 2) {
      const nx = p.x + p.vx * dt;
      const ny = p.y + p.vy * dt;
      if (this.canTankOccupy(nx, p.y, p.radius)) p.x = nx;
      if (this.canTankOccupy(p.x, ny, p.radius)) p.y = ny;
    }

    // Fire Cannon
    const activePlayerBullets = this.bullets.filter((b) => b.isPlayer).length;
    const maxBullets = p.starLevel >= 2 ? 2 : 1;
    if (
      (this.input.isJustPressed('actionA') ||
        this.input.isJustPressed('actionB') ||
        this.input.pointer.justPressed) &&
      p.fireCooldown <= 0 &&
      activePlayerBullets < maxBullets
    ) {
      p.fireCooldown = p.starLevel >= 1 ? 0.18 : 0.28;
      this.fireBullet(p, true);
    }

    // Check Power-Up collection
    if (this.powerUp && Math.hypot(p.x - this.powerUp.x, p.y - this.powerUp.y) < 22) {
      this.collectPowerUp(this.powerUp);
    }
  }

  updateEnemies(dt) {
    if (this.freezeTimer > 0) return;

    const baseCenterX = this.arenaX + 13 * this.tileSize;
    const baseCenterY = this.arenaY + 15.5 * this.tileSize;

    for (const e of this.enemies) {
      e.treadTick += dt * 14;
      e.turnTimer -= dt;
      e.fireCooldown -= dt;

      const vec = DIRS[e.dir];
      const nx = e.x + vec.x * e.speed * dt;
      const ny = e.y + vec.y * e.speed * dt;

      if (this.canTankOccupy(nx, ny, e.radius) && e.turnTimer > 0) {
        e.x = nx;
        e.y = ny;
      } else {
        // Choose a new direction biased toward the Phoenix Base or Player
        const dirs = ['down', 'left', 'right', 'up'];
        if (Math.random() < 0.48) {
          if (Math.abs(baseCenterX - e.x) > Math.abs(baseCenterY - e.y)) {
            e.dir = baseCenterX > e.x ? 'right' : 'left';
          } else {
            e.dir = 'down';
          }
        } else {
          e.dir = dirs[Math.floor(Math.random() * dirs.length)];
        }
        e.turnTimer = 0.9 + Math.random() * 1.4;
      }

      if (e.fireCooldown <= 0) {
        e.fireCooldown = 1.1 + Math.random() * 1.1;
        this.fireBullet(e, false);
      }
    }
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Arena bounds check
      if (
        b.x < this.arenaX ||
        b.x > this.arenaX + this.cols * this.tileSize ||
        b.y < this.arenaY ||
        b.y > this.arenaY + this.rows * this.tileSize
      ) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Tile collision check
      const { c, r } = this.worldToTile(b.x, b.y);
      if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
        const t = this.grid[r][c];
        if (t === TILE.BRICK) {
          this.brickHp[r][c]--;
          if (this.brickHp[r][c] <= 0 || b.canBreakSteel) {
            this.grid[r][c] = TILE.EMPTY;
          }
          this.spawnExplosion(b.x, b.y, '#EA580C', 8);
          this.audio.playDig();
          this.bullets.splice(i, 1);
          continue;
        } else if (t === TILE.STEEL) {
          if (b.canBreakSteel) {
            this.grid[r][c] = TILE.EMPTY;
            this.spawnExplosion(b.x, b.y, PALETTE.WHITE, 12);
          } else {
            this.spawnExplosion(b.x, b.y, PALETTE.CYAN, 5);
          }
          this.audio.playHit();
          this.bullets.splice(i, 1);
          continue;
        } else if (t === TILE.BASE) {
          this.bullets.splice(i, 1);
          this.destroyBase();
          return;
        }
      }

      // Bullet-vs-Bullet cancellation
      let cancelled = false;
      for (let j = i - 1; j >= 0; j--) {
        const other = this.bullets[j];
        if (b.isPlayer !== other.isPlayer && Math.hypot(b.x - other.x, b.y - other.y) < 10) {
          this.spawnExplosion(b.x, b.y, PALETTE.WHITE, 6);
          this.bullets.splice(i, 1);
          this.bullets.splice(j, 1);
          i--;
          cancelled = true;
          break;
        }
      }
      if (cancelled) continue;

      // Player bullet hitting Enemy Tanks
      if (b.isPlayer) {
        let hitEnemy = false;
        for (let k = this.enemies.length - 1; k >= 0; k--) {
          const e = this.enemies[k];
          if (Math.hypot(b.x - e.x, b.y - e.y) < e.radius + 4) {
            hitEnemy = true;
            if (e.isBonus) {
              e.isBonus = false;
              this.spawnRandomPowerUp();
            }
            e.hp--;
            if (e.hp <= 0) {
              this.spawnExplosion(e.x, e.y, PALETTE.ORANGE, 22);
              this.audio.playExplosion(0.32, 950);
              this.addScore(e.pts, e.x, e.y, PALETTE.GOLD, e.name);
              this.enemies.splice(k, 1);
              this.checkVictory();
            } else {
              this.audio.playHit();
              this.spawnExplosion(b.x, b.y, PALETTE.GREEN, 6);
            }
            break;
          }
        }
        if (hitEnemy) {
          this.bullets.splice(i, 1);
          continue;
        }
      } else {
        // Enemy bullet hitting Player Tank
        const p = this.player;
        if (this.deathTimer <= 0 && Math.hypot(b.x - p.x, b.y - p.y) < p.radius + 4) {
          this.bullets.splice(i, 1);
          if (p.shieldTimer <= 0) {
            this.killPlayer();
            return;
          } else {
            this.spawnExplosion(b.x, b.y, PALETTE.CYAN, 8);
          }
        }
      }
    }
  }

  updateEffects(dt) {
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
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear('#1E293B');

    // Black Battlefield Interior
    ctx.fillStyle = '#070A12';
    ctx.fillRect(
      this.arenaX,
      this.arenaY,
      this.cols * this.tileSize,
      this.rows * this.tileSize
    );
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      this.arenaX - 2,
      this.arenaY - 2,
      this.cols * this.tileSize + 4,
      this.rows * this.tileSize + 4
    );

    this.drawGroundTiles(ctx);
    this.drawPowerUp(ctx);
    if (this.deathTimer <= 0) {
      this.drawTank(ctx, this.player, true);
    }
    for (const e of this.enemies) {
      this.drawTank(ctx, e, false);
    }
    this.drawBullets(ctx);
    this.drawForestLayer(ctx);
    this.drawSideStatusPanel(ctx);
    this.drawEffects(ctx);

    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `STAR:★${this.player ? this.player.starLevel : 0}  ENEMIES:${this.enemiesRemainingToSpawn + this.enemies.length}`,
      accent: PALETTE.GOLD
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1985 NAMCO TANK BATTALION BASE DEFENSE',
      controls: 'ARROWS/WASD: DRIVE TANK  |  Z/X/SPACE: FIRE CANNON',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GOLD
    });
  }

  drawGroundTiles(ctx) {
    ctx.save();
    const ts = this.tileSize;
    const waterPulse = Math.floor(this.animTime * 4) % 2 === 0;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const t = this.grid[r][c];
        const x = this.arenaX + c * ts;
        const y = this.arenaY + r * ts;

        if (t === TILE.BRICK) {
          ctx.fillStyle = this.brickHp[r][c] === 1 ? '#9A3412' : '#C2410C';
          ctx.fillRect(x + 1, y + 1, ts - 2, ts - 2);
          ctx.fillStyle = '#FDBA74';
          ctx.fillRect(x + 3, y + 4, ts - 6, 3);
          ctx.fillRect(x + 3, y + 16, ts - 6, 3);
        } else if (t === TILE.STEEL) {
          ctx.fillStyle = '#94A3B8';
          ctx.fillRect(x + 1, y + 1, ts - 2, ts - 2);
          ctx.fillStyle = '#F8FAFC';
          ctx.fillRect(x + 5, y + 5, ts - 10, ts - 10);
        } else if (t === TILE.WATER) {
          ctx.fillStyle = waterPulse ? '#0284C7' : '#0369A1';
          ctx.fillRect(x, y, ts, ts);
          ctx.fillStyle = '#7DD3FC';
          ctx.fillRect(x + (waterPulse ? 4 : 10), y + 8, 10, 3);
          ctx.fillRect(x + (waterPulse ? 12 : 5), y + 19, 10, 3);
        } else if (t === TILE.ICE) {
          ctx.fillStyle = 'rgba(186, 230, 253, 0.32)';
          ctx.fillRect(x, y, ts, ts);
          ctx.strokeStyle = '#E0F2FE';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 4, y + ts - 4);
          ctx.lineTo(x + ts - 4, y + 4);
          ctx.stroke();
        }
      }
    }

    // Draw Phoenix Base Emblem spanning (12..13, 15)
    const bx = this.arenaX + 12 * ts;
    const by = this.arenaY + 15 * ts;
    if (!this.baseDestroyed) {
      ctx.fillStyle = PALETTE.GOLD;
      ctx.shadowColor = PALETTE.GOLD;
      ctx.shadowBlur = 10;
      // Eagle wings & crest
      ctx.fillRect(bx + 6, by + 6, ts * 2 - 12, 16);
      ctx.fillRect(bx + 18, by + 2, 20, 24);
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(bx + 23, by + 9, 10, 10);
    } else {
      ctx.fillStyle = '#475569';
      ctx.fillRect(bx + 8, by + 10, ts * 2 - 16, 14);
    }
    ctx.restore();
  }

  drawForestLayer(ctx) {
    ctx.save();
    const ts = this.tileSize;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === TILE.TREES) {
          const x = this.arenaX + c * ts;
          const y = this.arenaY + r * ts;
          ctx.fillStyle = '#15803D';
          ctx.fillRect(x + 1, y + 1, ts - 2, ts - 2);
          ctx.fillStyle = '#22C55E';
          ctx.fillRect(x + 4, y + 4, 8, 8);
          ctx.fillRect(x + 15, y + 6, 8, 8);
          ctx.fillRect(x + 8, y + 15, 10, 8);
        }
      }
    }
    ctx.restore();
  }

  drawTank(ctx, tank, isPlayer) {
    ctx.save();
    ctx.translate(tank.x, tank.y);
    ctx.rotate(DIRS[tank.dir].angle);

    let bodyColor = PALETTE.GOLD;
    if (!isPlayer) {
      if (tank.isBonus && Math.floor(this.animTime * 10) % 2 === 0) {
        bodyColor = PALETTE.RED;
      } else if (tank.typeKey === 'HEAVY') {
        bodyColor = tank.hp === 3 ? '#10B981' : tank.hp === 2 ? '#FACC15' : '#94A3B8';
      } else {
        bodyColor = tank.color;
      }
    }

    // Left & Right Tank Treads
    ctx.fillStyle = '#334155';
    ctx.fillRect(-11, -11, 5, 22);
    ctx.fillRect(6, -11, 5, 22);
    const treadOffset = Math.floor(tank.treadTick) % 4;
    ctx.fillStyle = '#94A3B8';
    for (let ty = -10 + treadOffset; ty < 10; ty += 5) {
      ctx.fillRect(-11, ty, 5, 2);
      ctx.fillRect(6, ty, 5, 2);
    }

    // Main Chassis & Turret
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-7, -8, 14, 16);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(-4, -4, 8, 8);

    // Cannon Barrel pointing UP in local rotated space
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-2, -15, 4, 11);

    ctx.restore();

    // Helmet Invulnerability Shield ring around Player Tank
    if (isPlayer && tank.shieldTimer > 0) {
      this.renderer.drawGlowCircle(
        tank.x,
        tank.y,
        16,
        Math.floor(this.animTime * 16) % 2 === 0 ? PALETTE.CYAN : PALETTE.WHITE,
        10,
        false,
        2
      );
    }
  }

  drawPowerUp(ctx) {
    if (!this.powerUp) return;
    if (Math.floor(this.animTime * 8) % 2 === 0) return;
    const pu = this.powerUp;
    ctx.save();
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = PALETTE.PINK;
    ctx.lineWidth = 2;
    ctx.shadowColor = PALETTE.PINK;
    ctx.shadowBlur = 10;
    ctx.fillRect(pu.x - 14, pu.y - 12, 28, 24);
    ctx.strokeRect(pu.x - 14, pu.y - 12, 28, 24);
    this.renderer.drawText(pu.type.slice(0, 3), pu.x, pu.y + 4, {
      font: FONTS.HEADER,
      size: 7.5,
      color: PALETTE.GOLD,
      align: 'center'
    });
    ctx.restore();
  }

  drawBullets(ctx) {
    ctx.save();
    for (const b of this.bullets) {
      ctx.fillStyle = b.isPlayer ? PALETTE.GOLD : PALETTE.WHITE;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 6;
      ctx.fillRect(b.x - 3, b.y - 3, 6, 6);
    }
    ctx.restore();
  }

  drawSideStatusPanel(ctx) {
    const px = 784;
    ctx.save();
    ctx.fillStyle = '#0F172A';
    ctx.strokeStyle = PALETTE.GOLD;
    ctx.lineWidth = 2;
    ctx.fillRect(px, 58, 152, 448);
    ctx.strokeRect(px, 58, 152, 448);

    this.renderer.drawText('ENEMY FORCES', px + 76, 84, {
      font: FONTS.HEADER,
      size: 9,
      color: PALETTE.RED,
      align: 'center'
    });

    const totalLeft = this.enemiesRemainingToSpawn + this.enemies.length;
    for (let i = 0; i < totalLeft; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ix = px + 44 + col * 46;
      const iy = 104 + row * 22;
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(ix, iy, 14, 12);
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(ix + 5, iy - 4, 4, 6);
    }

    if (this.freezeTimer > 0) {
      this.renderer.drawText(`FREEZE: ${this.freezeTimer.toFixed(1)}S`, px + 76, 420, {
        font: FONTS.HUD,
        size: 13,
        color: PALETTE.CYAN,
        align: 'center'
      });
    }
    if (this.shovelTimer > 0) {
      this.renderer.drawText(`STEEL BASE: ${this.shovelTimer.toFixed(1)}S`, px + 76, 445, {
        font: FONTS.HUD,
        size: 13,
        color: PALETTE.WHITE,
        align: 'center'
      });
    }

    this.renderer.drawText(`STAGE ${this.level}`, px + 76, 482, {
      font: FONTS.HEADER,
      size: 11,
      color: PALETTE.GOLD,
      align: 'center'
    });
    ctx.restore();
  }

  drawEffects(ctx) {
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size * 0.5, pt.y - pt.size * 0.5, pt.size, pt.size);
    }
    for (const pop of this.popups) {
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HEADER,
        size: 9.5,
        color: pop.color,
        align: 'center',
        glow: 6
      });
    }
  }
}

export default BattleCity;
