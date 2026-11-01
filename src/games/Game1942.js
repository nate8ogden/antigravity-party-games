/**
 * Game1942.js
 * Classic 1984 Capcom Vertical Air-Combat Arcade Shmup ("1942").
 * Features the legendary P-38 Lightning fighter flying over the Pacific Theater,
 * high-altitude 360° Loop-the-Loop evasive barrel rolls, Twin Escort Fighter wingmen,
 * swooping Red Zero formations with [POW] icon drops, Ki-48 twin-engine bombers,
 * and the massive multi-turreted Ayako Heavy Super-Bomber flagship battle!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const STAGE_CONFIGS = [
  { stageNum: 32, name: 'MIDWAY ATOLL', seaColor: '#0C4A6E', islandColor: '#059669', sandColor: '#FBBF24', targetEnemies: 35 },
  { stageNum: 28, name: 'MARSHALL ISLANDS', seaColor: '#075985', islandColor: '#10B981', sandColor: '#FDE68A', targetEnemies: 42 },
  { stageNum: 24, name: 'WAKE ISLAND', seaColor: '#0369A1', islandColor: '#047857', sandColor: '#F59E0B', targetEnemies: 48 },
  { stageNum: 20, name: 'GUADALCANAL', seaColor: '#1E40AF', islandColor: '#15803D', sandColor: '#FBBF24', targetEnemies: 54 },
  { stageNum: 16, name: 'NEW GUINEA', seaColor: '#1D4ED8', islandColor: '#166534', sandColor: '#FDE047', targetEnemies: 60 },
  { stageNum: 12, name: 'PHILIPPINE SEA', seaColor: '#1E3A8A', islandColor: '#065F46', sandColor: '#F59E0B', targetEnemies: 66 },
  { stageNum: 8, name: 'OKINAWA', seaColor: '#172554', islandColor: '#14532D', sandColor: '#FBBF24', targetEnemies: 72 },
  { stageNum: 4, name: 'TOKYO BAY', seaColor: '#0F172A', islandColor: '#1F2937', sandColor: '#D97706', targetEnemies: 80 }
];

export class Game1942 {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'game1942';
    this.title = '1942';

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.stage = 1;

    // Viewport dimensions
    this.width = 960;
    this.height = 540;

    // Ocean & island scenery
    this.scrollSpeed = 90;
    this.scrollY = 0;
    this.islands = [];
    this.clouds = [];
    this.ships = [];

    // Entities
    this.player = null;
    this.playerBullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.powerups = [];
    this.particles = [];
    this.popups = [];

    // Formation tracker for 100% squad wipe bonuses
    this.formations = new Map();
    this.formationCounter = 0;

    // Spawning timers
    this.spawnTimer = 0;
    this.nextSpawnDelay = 1.2;
    this.stageEnemiesSpawned = 0;
    this.stageKills = 0;
    this.boss = null;
    this.bossSpawned = false;

    // Transition / clear timers
    this.stageClearTimer = 0;
    this.deathTimer = 0;

    this._initScenery();
    this._setupTouchLabels();
    this.reset();
  }

  _setupTouchLabels() {
    if (typeof document === 'undefined') return;
    const subA = document.querySelector('#touch-btn-a .btn-sub-label');
    const subB = document.querySelector('#touch-btn-b .btn-sub-label');
    if (subA) subA.textContent = 'FIRE (Z)';
    if (subB) subB.textContent = 'LOOP (X)';
  }

  _restoreTouchLabels() {
    if (typeof document === 'undefined') return;
    const subA = document.querySelector('#touch-btn-a .btn-sub-label');
    const subB = document.querySelector('#touch-btn-b .btn-sub-label');
    if (subA) subA.textContent = 'ACT / DIG-L / JUMP';
    if (subB) subB.textContent = 'ALT / DIG-R / SLAP';
  }

  _initScenery() {
    this.islands = [];
    for (let i = 0; i < 7; i++) {
      this.islands.push({
        x: 80 + Math.random() * 800,
        y: Math.random() * 900 - 300,
        w: 90 + Math.random() * 140,
        h: 60 + Math.random() * 90,
        palms: Math.floor(3 + Math.random() * 5)
      });
    }

    this.clouds = [];
    for (let i = 0; i < 9; i++) {
      this.clouds.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        r: 30 + Math.random() * 45,
        speed: 40 + Math.random() * 30,
        alpha: 0.15 + Math.random() * 0.2
      });
    }

    this.ships = [];
    for (let i = 0; i < 3; i++) {
      this.ships.push({
        x: 120 + i * 280,
        y: -100 - i * 350,
        type: i % 2 === 0 ? 'carrier' : 'destroyer',
        w: i % 2 === 0 ? 54 : 32,
        h: i % 2 === 0 ? 150 : 80,
        speed: 35
      });
    }
  }

  reset() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.stage = 1;
    this.highScore = HighScoreStore.get(this.id);
    this.state = 'PLAYING';
    this.initStage(this.level);
  }

  initStage(lvl) {
    this.level = lvl;
    this.stage = lvl;
    this.stageConfig = STAGE_CONFIGS[(lvl - 1) % STAGE_CONFIGS.length];

    this.stageEnemiesSpawned = 0;
    this.stageKills = 0;
    this.boss = null;
    this.bossSpawned = false;
    this.stageClearTimer = 0;
    this.deathTimer = 0;

    this.playerBullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.powerups = [];
    this.formations.clear();

    this._initPlayer();

    if (this.audio) {
      this.audio.playMusic('game1942', true);
    }

    this.popups.push({
      text: `STAGE ${this.stageConfig.stageNum} — ${this.stageConfig.name}`,
      x: this.width / 2,
      y: 220,
      color: PALETTE.GOLD,
      size: 18,
      life: 2.5
    });
  }

  _initLevel(lvl) {
    this.initStage(lvl);
  }

  loadLevel(lvl) {
    this.initStage(lvl);
  }

  _initPlayer() {
    this.player = {
      x: this.width / 2,
      y: 440,
      vx: 0,
      vy: 0,
      speed: 310,
      tilt: 0, // Bank angle (-1 to 1)
      fireCooldown: 0,
      hasWingmen: false, // Twin Escort Fighter wingmen powerup
      wingmenHp: 2,
      loopsLeft: 3, // 360-degree loop roll charges
      isLooping: false,
      loopTimer: 0,
      loopDuration: 0.85,
      invulnerableTimer: 2.0,
      propellerAngle: 0
    };
  }

  setState(state) {
    this.state = state;
    if (state === 'GAMEOVER') {
      HighScoreStore.submit(this.id, this.score);
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
        color,
        size: label ? 14 : 12,
        life: 1.2
      });
    }
  }

  triggerLoopRoll() {
    if (!this.player || this.player.isLooping || this.player.loopsLeft <= 0 || this.state !== 'PLAYING') return;
    this.player.isLooping = true;
    this.player.loopTimer = 0;
    this.player.loopsLeft--;

    if (this.audio) {
      this.audio.playNote(180, 0.12, 'sawtooth', 0.22, 0);
      this.audio.playNote(360, 0.25, 'sine', 0.3, 0.08);
      this.audio.playNote(540, 0.22, 'triangle', 0.25, 0.25);
    }

    this.popups.push({
      text: '360° LOOP ROLL!',
      x: this.player.x,
      y: this.player.y - 40,
      color: PALETTE.CYAN,
      size: 15,
      life: 0.9
    });
  }

  triggerMegaBomb() {
    if (this.audio) {
      this.audio.playExplosion(0.6, 600);
      this.audio.playPowerUp();
    }
    // Turn all enemy bullets into floating +100 bonus stars
    for (const b of this.enemyBullets) {
      this.addScore(100, b.x, b.y, PALETTE.GOLD);
      this._spawnSparks(b.x, b.y, PALETTE.GOLD, 6);
    }
    this.enemyBullets = [];

    // Damage or kill all active minor enemies
    for (const e of this.enemies) {
      if (e.isBoss) {
        e.hp -= 20;
      } else {
        e.hp = 0;
        this.addScore(e.points, e.x, e.y, PALETTE.GOLD);
        this._spawnExplosion(e.x, e.y, 22);
      }
    }
    this.popups.push({
      text: '💥 MEGA BOMB BLAST!',
      x: this.width / 2,
      y: 200,
      color: PALETTE.ORANGE,
      size: 20,
      life: 1.5
    });
  }

  update(dt) {
    if (this.state !== 'PLAYING') {
      if (this.state === 'GAMEOVER') {
        if (this.input.isJustPressed('actionA') || this.input.isJustPressed('actionB') || this.input.isKeyJustPressed('KeyZ') || this.input.isKeyJustPressed('KeyX') || this.input.isKeyJustPressed('Space')) {
          this.reset();
        }
      }
      return;
    }

    this._updateScenery(dt);
    this._updatePlayer(dt);
    this._updateBullets(dt);
    this._updateEnemies(dt);
    this._updatePowerups(dt);
    this._updateParticles(dt);
    this._updatePopups(dt);

    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        if (this.lives > 0) {
          this._initPlayer();
        } else {
          this.state = 'GAMEOVER';
          HighScoreStore.submit(this.id, this.score);
          if (this.audio) this.audio.playGameOver();
        }
      }
    }

    // Stage Clear Progression
    if (this.stageClearTimer > 0) {
      this.stageClearTimer -= dt;
      if (this.stageClearTimer <= 0) {
        this.initStage(this.level + 1);
      }
    } else if (
      this.stageEnemiesSpawned >= this.stageConfig.targetEnemies &&
      this.enemies.length === 0 &&
      !this.bossSpawned
    ) {
      // Spawn Flagship Ayako Boss
      this._spawnAyakoBoss();
    }
  }

  _updateScenery(dt) {
    this.scrollY += this.scrollSpeed * dt;

    // Scroll Islands
    for (const island of this.islands) {
      island.y += this.scrollSpeed * dt;
      if (island.y > this.height + 150) {
        island.y = -150 - Math.random() * 200;
        island.x = 80 + Math.random() * 800;
      }
    }

    // Scroll Ships
    for (const ship of this.ships) {
      ship.y += (this.scrollSpeed - ship.speed) * dt;
      if (ship.y > this.height + 200) {
        ship.y = -200 - Math.random() * 300;
        ship.x = 100 + Math.random() * 760;
      }
    }

    // Scroll Clouds
    for (const cloud of this.clouds) {
      cloud.y += cloud.speed * dt;
      if (cloud.y > this.height + cloud.r) {
        cloud.y = -cloud.r;
        cloud.x = Math.random() * this.width;
      }
    }
  }

  _updatePlayer(dt) {
    if (!this.player) return;

    if (this.player.invulnerableTimer > 0) {
      this.player.invulnerableTimer -= dt;
    }

    // Loop Roll update
    if (this.player.isLooping) {
      this.player.loopTimer += dt;
      this.player.propellerAngle += dt * 45;
      if (this.player.loopTimer >= this.player.loopDuration) {
        this.player.isLooping = false;
        this.player.loopTimer = 0;
      }
      return; // Player cannot move or shoot during 360 loop
    }

    // Controls: Directional Input
    let dx = 0;
    let dy = 0;
    const axis = this.input.getAxis ? this.input.getAxis() : { x: 0, y: 0 };
    dx += axis.x;
    dy += axis.y;

    if (this.input.isDown('left') || this.input.isKeyDown('ArrowLeft') || this.input.isKeyDown('KeyA')) dx -= 1;
    if (this.input.isDown('right') || this.input.isKeyDown('ArrowRight') || this.input.isKeyDown('KeyD')) dx += 1;
    if (this.input.isDown('up') || this.input.isKeyDown('ArrowUp') || this.input.isKeyDown('KeyW')) dy -= 1;
    if (this.input.isDown('down') || this.input.isKeyDown('ArrowDown') || this.input.isKeyDown('KeyS')) dy += 1;

    // Pointer / Touch Drag
    const ptr = this.input.pointer;
    if (ptr && ptr.down && ptr.y > 60 && ptr.y < this.height - 40) {
      const pDx = ptr.x - this.player.x;
      const pDy = ptr.y - this.player.y;
      const dist = Math.hypot(pDx, pDy);
      if (dist > 15) {
        dx = pDx / dist;
        dy = pDy / dist;
      }
    }

    // Normalize
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }

    this.player.x += dx * this.player.speed * dt;
    this.player.y += dy * this.player.speed * dt;

    // Screen Bounds
    this.player.x = Math.max(30, Math.min(this.width - 30, this.player.x));
    this.player.y = Math.max(50, Math.min(this.height - 40, this.player.y));

    // Bank angle tilt
    const targetTilt = dx * 0.8;
    this.player.tilt += (targetTilt - this.player.tilt) * 12 * dt;
    this.player.propellerAngle += dt * 30;

    // Actions: Fire (Z / Space / Touch A)
    if (this.player.fireCooldown > 0) {
      this.player.fireCooldown -= dt;
    }

    const firePressed =
      this.input.isDown('actionA') ||
      this.input.isKeyDown('KeyZ') ||
      this.input.isKeyDown('Space') ||
      (ptr && ptr.down && ptr.x > this.width * 0.7 && ptr.y > this.height * 0.65);

    if (firePressed && this.player.fireCooldown <= 0) {
      this._firePlayerMachineGuns();
      this.player.fireCooldown = 0.11; // High cadence twin machine guns
    }

    // Actions: Loop Roll (X / Touch B)
    if (
      this.input.isJustPressed('actionB') ||
      this.input.isKeyJustPressed('KeyX') ||
      this.input.isKeyJustPressed('KeyC') ||
      this.input.isKeyJustPressed('Enter')
    ) {
      this.triggerLoopRoll();
    }
  }

  _firePlayerMachineGuns() {
    if (!this.player) return;

    if (this.audio) {
      this.audio.playLaser(980, 240, 0.05);
    }

    // Main P-38 Twin Guns
    this.playerBullets.push(
      { x: this.player.x - 7, y: this.player.y - 18, vx: 0, vy: -780 },
      { x: this.player.x + 7, y: this.player.y - 18, vx: 0, vy: -780 }
    );

    // Twin Escort Wingmen Guns
    if (this.player.hasWingmen) {
      // Left Escort Fighter
      this.playerBullets.push(
        { x: this.player.x - 38, y: this.player.y - 4, vx: -30, vy: -780 },
        { x: this.player.x - 30, y: this.player.y - 4, vx: 0, vy: -780 }
      );
      // Right Escort Fighter
      this.playerBullets.push(
        { x: this.player.x + 30, y: this.player.y - 4, vx: 0, vy: -780 },
        { x: this.player.x + 38, y: this.player.y - 4, vx: 30, vy: -780 }
      );
    }
  }

  _updateBullets(dt) {
    // Player Bullets
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const b = this.playerBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.y < -20 || b.x < -20 || b.x > this.width + 20) {
        this.playerBullets.splice(i, 1);
        continue;
      }

      // Check collision against Enemies
      let bulletHit = false;
      for (const e of this.enemies) {
        if (Math.abs(b.x - e.x) < e.hitRadius && Math.abs(b.y - e.y) < e.hitRadius) {
          e.hp--;
          bulletHit = true;
          this._spawnSparks(b.x, b.y, PALETTE.GOLD, 3);

          if (this.audio) {
            this.audio.playHit();
          }

          if (e.hp <= 0) {
            this._destroyEnemy(e);
          }
          break;
        }
      }

      if (bulletHit) {
        this.playerBullets.splice(i, 1);
      }
    }

    // Enemy Bullets
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.y > this.height + 20 || b.y < -30 || b.x < -30 || b.x > this.width + 30) {
        this.enemyBullets.splice(i, 1);
        continue;
      }

      // Check collision against Player
      if (
        this.player &&
        !this.player.isLooping &&
        this.player.invulnerableTimer <= 0 &&
        this.deathTimer <= 0
      ) {
        // First check wingmen protection
        if (this.player.hasWingmen) {
          const distLeft = Math.hypot(b.x - (this.player.x - 34), b.y - (this.player.y + 6));
          const distRight = Math.hypot(b.x - (this.player.x + 34), b.y - (this.player.y + 6));
          if (distLeft < 14 || distRight < 14) {
            this.player.wingmenHp--;
            this._spawnExplosion(b.x, b.y, 16);
            if (this.player.wingmenHp <= 0) {
              this.player.hasWingmen = false;
              this.popups.push({
                text: 'WINGMAN LOST!',
                x: this.player.x,
                y: this.player.y - 30,
                color: PALETTE.RED,
                size: 13,
                life: 1.0
              });
            }
            this.enemyBullets.splice(i, 1);
            continue;
          }
        }

        // Main plane hit
        const pDist = Math.hypot(b.x - this.player.x, b.y - this.player.y);
        if (pDist < 16) {
          this.enemyBullets.splice(i, 1);
          this._killPlayer();
          break;
        }
      }
    }
  }

  _destroyEnemy(e) {
    const idx = this.enemies.indexOf(e);
    if (idx !== -1) {
      this.enemies.splice(idx, 1);
    }

    this._spawnExplosion(e.x, e.y, e.isBoss ? 45 : e.isBomber ? 28 : 18);
    this.addScore(e.points, e.x, e.y, PALETTE.GOLD);
    this.stageKills++;

    if (this.audio) {
      this.audio.playExplosion(e.isBoss ? 0.8 : 0.35, e.isBoss ? 450 : 850);
    }

    // Formation tracking for 100% squad wipe
    if (e.formationId) {
      const f = this.formations.get(e.formationId);
      if (f) {
        f.destroyedCount++;
        if (f.destroyedCount >= f.totalPlanes) {
          // 100% SQUADRON DEFEATED!
          this.addScore(1000, e.x, e.y - 25, PALETTE.CYAN, '100% SQUAD!');
          this._spawnPowerup(e.x, e.y);
          if (this.audio) this.audio.playCoin();
          this.formations.delete(e.formationId);
        }
      }
    }

    // Boss Defeat
    if (e.isBoss) {
      this.boss = null;
      this.stageClearTimer = 2.5;
      this.popups.push({
        text: '🏆 AYAKO DOWN! STAGE COMPLETE!',
        x: this.width / 2,
        y: 240,
        color: PALETTE.GOLD,
        size: 20,
        life: 2.5
      });
      if (this.audio) this.audio.playStageClear();
    }
  }

  _killPlayer() {
    this._spawnExplosion(this.player.x, this.player.y, 35);
    this.lives--;
    this.deathTimer = 1.6;
    this.player = null;

    if (this.audio) {
      this.audio.playExplosion(0.7, 500);
    }
  }

  _updateEnemies(dt) {
    // Spawning waves
    if (this.stageEnemiesSpawned < this.stageConfig.targetEnemies && !this.bossSpawned) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= this.nextSpawnDelay) {
        this.spawnTimer = 0;
        this.nextSpawnDelay = 1.0 + Math.random() * 1.5;
        this._spawnEnemyWave();
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.t += dt;

      // Update movement pattern
      if (e.type === 'green_zero') {
        // Swooping curve
        e.y += e.speed * dt;
        e.x += Math.sin(e.t * 3.5 + e.phase) * 160 * dt;
      } else if (e.type === 'red_squadron') {
        // Coordinated dive & peel
        e.y += e.speed * dt;
        e.x += e.vx * dt;
        if (e.t > 0.8 && !e.peeled) {
          e.peeled = true;
          e.vx = (e.slot % 2 === 0 ? 1 : -1) * (140 + Math.random() * 60);
        }
      } else if (e.type === 'ki48_bomber') {
        // Heavy slow descent with slight horizontal wander
        e.y += e.speed * dt;
        e.x += Math.sin(e.t * 1.2) * 50 * dt;
      } else if (e.type === 'ayako_boss') {
        // Heavy Flagship hovering and pacing
        e.y = Math.min(130, e.y + 45 * dt);
        e.x += Math.sin(e.t * 0.8) * 140 * dt;
      }

      // Firing Logic
      e.fireTimer += dt;
      if (e.fireTimer >= e.fireInterval) {
        e.fireTimer = 0;
        this._enemyShoot(e);
      }

      // Offscreen removal
      if (e.y > this.height + 60 || e.x < -80 || e.x > this.width + 80) {
        this.enemies.splice(i, 1);
      }
    }
  }

  _spawnEnemyWave() {
    const waveType = Math.random();
    this.formationCounter++;
    const formId = `form_${this.formationCounter}`;

    if (waveType < 0.45) {
      // 5-Plane Red Squadron (Drops POW if all eliminated)
      const count = 5;
      const startX = 140 + Math.random() * (this.width - 280);
      this.formations.set(formId, { totalPlanes: count, destroyedCount: 0 });

      for (let i = 0; i < count; i++) {
        this.enemies.push({
          type: 'red_squadron',
          formationId: formId,
          slot: i,
          x: startX + (i - 2) * 32,
          y: -40 - i * 36,
          vx: 0,
          speed: 210,
          hp: 1,
          hitRadius: 15,
          points: 150,
          t: 0,
          phase: 0,
          peeled: false,
          fireTimer: Math.random() * 0.5,
          fireInterval: 1.6 + Math.random() * 0.8
        });
      }
      this.stageEnemiesSpawned += count;
    } else if (waveType < 0.8) {
      // 4-Plane Green Zero V-Formation
      const count = 4;
      const startX = 180 + Math.random() * (this.width - 360);
      for (let i = 0; i < count; i++) {
        this.enemies.push({
          type: 'green_zero',
          x: startX + (i % 2 === 0 ? -1 : 1) * Math.ceil(i / 2) * 44,
          y: -40 - i * 30,
          speed: 180,
          hp: 1,
          hitRadius: 14,
          points: 100,
          t: 0,
          phase: i * 0.4,
          fireTimer: Math.random() * 0.6,
          fireInterval: 1.8 + Math.random() * 1.0
        });
      }
      this.stageEnemiesSpawned += count;
    } else {
      // Heavy Ki-48 Twin-Engine Bomber
      this.enemies.push({
        type: 'ki48_bomber',
        isBomber: true,
        x: 150 + Math.random() * (this.width - 300),
        y: -70,
        speed: 95,
        hp: 9,
        hitRadius: 26,
        points: 600,
        t: 0,
        fireTimer: 0.8,
        fireInterval: 1.2
      });
      this.stageEnemiesSpawned += 2;
    }
  }

  _spawnAyakoBoss() {
    this.bossSpawned = true;
    const boss = {
      type: 'ayako_boss',
      isBoss: true,
      x: this.width / 2,
      y: -140,
      hp: 65,
      maxHp: 65,
      hitRadius: 65,
      points: 5000,
      t: 0,
      fireTimer: 0.5,
      fireInterval: 0.9
    };
    this.boss = boss;
    this.enemies.push(boss);

    this.popups.push({
      text: '⚠️ WARNING: DAIHISHYO AYAKO SUPER-BOMBER!',
      x: this.width / 2,
      y: 200,
      color: PALETTE.RED,
      size: 18,
      life: 2.2
    });
    if (this.audio) this.audio.playExplosion(0.8, 300);
  }

  _enemyShoot(e) {
    if (!this.player || this.state !== 'PLAYING') return;

    const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    const speed = 240;

    if (e.type === 'ayako_boss') {
      // 5-Way Flak Spread
      for (let offset = -2; offset <= 2; offset++) {
        const a = angle + offset * 0.22;
        this.enemyBullets.push({
          x: e.x + offset * 25,
          y: e.y + 30,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed
        });
      }
    } else if (e.type === 'ki48_bomber') {
      // 3-Way Spread
      for (let offset = -1; offset <= 1; offset++) {
        const a = angle + offset * 0.26;
        this.enemyBullets.push({
          x: e.x,
          y: e.y + 18,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed
        });
      }
    } else {
      // Aimed Single Bullet
      this.enemyBullets.push({
        x: e.x,
        y: e.y + 12,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed
      });
    }
  }

  _spawnPowerup(x, y) {
    const types = ['wingmen', 'megabomb', 'loop', 'points'];
    const pType = types[Math.floor(Math.random() * types.length)];
    this.powerups.push({
      x,
      y,
      type: pType,
      vx: (Math.random() - 0.5) * 40,
      vy: 85,
      t: 0
    });
  }

  _updatePowerups(dt) {
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.t += dt;
      p.y += p.vy * dt;
      p.x += Math.sin(p.t * 3.5) * 60 * dt;

      if (p.y > this.height + 30) {
        this.powerups.splice(i, 1);
        continue;
      }

      // Check collision with Player
      if (this.player && Math.hypot(p.x - this.player.x, p.y - this.player.y) < 28) {
        this._collectPowerup(p);
        this.powerups.splice(i, 1);
      }
    }
  }

  _collectPowerup(p) {
    if (this.audio) this.audio.playPowerUp();

    if (p.type === 'wingmen') {
      this.player.hasWingmen = true;
      this.player.wingmenHp = 2;
      this.addScore(1000, p.x, p.y, PALETTE.CYAN, 'TWIN WINGMEN!');
    } else if (p.type === 'megabomb') {
      this.triggerMegaBomb();
    } else if (p.type === 'loop') {
      this.player.loopsLeft = Math.min(5, this.player.loopsLeft + 1);
      this.addScore(500, p.x, p.y, PALETTE.GOLD, '+1 LOOP ROLL!');
    } else {
      this.addScore(2000, p.x, p.y, PALETTE.GOLD, 'SUPER BONUS!');
    }
  }

  _spawnExplosion(x, y, radius = 20) {
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0.3 + Math.random() * 0.45,
        maxLife: 0.6,
        color: i % 3 === 0 ? PALETTE.GOLD : i % 3 === 1 ? PALETTE.ORANGE : PALETTE.RED,
        r: 2 + Math.random() * (radius * 0.22)
      });
    }
  }

  _spawnSparks(x, y, color = PALETTE.GOLD, count = 4) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 30 + Math.random() * 90;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0.15 + Math.random() * 0.2,
        maxLife: 0.35,
        color,
        r: 1.5 + Math.random() * 2
      });
    }
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  _updatePopups(dt) {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.life -= dt;
      pop.y -= 25 * dt;
      if (pop.life <= 0) {
        this.popups.splice(i, 1);
      }
    }
  }

  render(ctx = this.renderer.ctx) {
    ctx.save();

    // 1. Ocean Background
    const seaColor = this.stageConfig ? this.stageConfig.seaColor : '#0C4A6E';
    ctx.fillStyle = seaColor;
    ctx.fillRect(0, 0, this.width, this.height);

    // Dynamic wave ripples
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    const waveOffset = (this.scrollY * 0.6) % 30;
    for (let y = waveOffset - 30; y < this.height; y += 30) {
      ctx.beginPath();
      for (let x = 0; x < this.width; x += 60) {
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 15, y - 4, x + 30, y);
      }
      ctx.stroke();
    }

    // 2. Islands & Atolls
    this._renderIslands(ctx);

    // 3. Warships
    this._renderShips(ctx);

    // 4. Powerups
    this._renderPowerups(ctx);

    // 5. Enemies
    this._renderEnemies(ctx);

    // 6. Player P-38 Lightning & Escorts
    this._renderPlayer(ctx);

    // 7. Bullets
    this._renderBullets(ctx);

    // 8. Particles
    this._renderParticles(ctx);

    // 9. Clouds
    this._renderClouds(ctx);

    // 10. HUD Overlay
    this._renderHUD(ctx);

    // 11. Popups
    this._renderPopups(ctx);

    // 12. Game Over Overlay
    if (this.state === 'GAMEOVER') {
      this._renderGameOver(ctx);
    }

    ctx.restore();
  }

  _renderIslands(ctx) {
    const sandCol = this.stageConfig ? this.stageConfig.sandColor : '#FBBF24';
    const isleCol = this.stageConfig ? this.stageConfig.islandColor : '#059669';

    for (const isl of this.islands) {
      if (isl.y + isl.h < 0 || isl.y - isl.h > this.height) continue;

      // Sand shoreline
      ctx.fillStyle = sandCol;
      ctx.beginPath();
      ctx.ellipse(isl.x, isl.y, isl.w / 2 + 10, isl.h / 2 + 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Green interior jungle
      ctx.fillStyle = isleCol;
      ctx.beginPath();
      ctx.ellipse(isl.x, isl.y, isl.w / 2, isl.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Palm foliage dots
      ctx.fillStyle = '#064E3B';
      for (let p = 0; p < isl.palms; p++) {
        const px = isl.x + Math.sin(p * 2.3) * (isl.w * 0.28);
        const py = isl.y + Math.cos(p * 1.7) * (isl.h * 0.26);
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _renderShips(ctx) {
    for (const ship of this.ships) {
      if (ship.y + ship.h < 0 || ship.y - ship.h > this.height) continue;

      ctx.save();
      ctx.translate(ship.x, ship.y);

      // Foam wake behind ship
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.moveTo(-ship.w * 0.6, ship.h * 0.5);
      ctx.lineTo(-ship.w * 1.2, ship.h * 0.9);
      ctx.lineTo(ship.w * 1.2, ship.h * 0.9);
      ctx.lineTo(ship.w * 0.6, ship.h * 0.5);
      ctx.fill();

      // Steel Hull
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.ellipse(0, 0, ship.w * 0.5, ship.h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      if (ship.type === 'carrier') {
        // Flight deck runway
        ctx.fillStyle = '#475569';
        ctx.fillRect(-ship.w * 0.38, -ship.h * 0.44, ship.w * 0.76, ship.h * 0.88);

        // Deck stripe
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(0, -ship.h * 0.4);
        ctx.lineTo(0, ship.h * 0.4);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // Destroyer Gun Turrets
        ctx.fillStyle = '#64748B';
        ctx.beginPath();
        ctx.arc(0, -ship.h * 0.25, 7, 0, Math.PI * 2);
        ctx.arc(0, ship.h * 0.25, 7, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  _renderPowerups(ctx) {
    for (const p of this.powerups) {
      ctx.save();
      ctx.translate(p.x, p.y);

      // Glowing badge disc
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner POW text
      ctx.fillStyle = '#1E1B4B';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('POW', 0, 1);

      ctx.restore();
    }
  }

  _renderEnemies(ctx) {
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);

      if (e.type === 'green_zero') {
        // Mitsubishi A6M Green Zero
        ctx.fillStyle = '#15803D';
        // Wings
        ctx.fillRect(-18, -3, 36, 6);
        // Fuselage
        ctx.fillStyle = '#166534';
        ctx.fillRect(-4, -14, 8, 28);
        // Hinomaru Red Roundels
        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.arc(-11, 0, 3, 0, Math.PI * 2);
        ctx.arc(11, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'red_squadron') {
        // Red Ace Fighter
        ctx.fillStyle = '#DC2626';
        // Wings
        ctx.fillRect(-18, -3, 36, 6);
        // Fuselage
        ctx.fillStyle = '#991B1B';
        ctx.fillRect(-4, -14, 8, 28);
        // Gold accents
        ctx.fillStyle = '#FBBF24';
        ctx.fillRect(-2, -12, 4, 6);
      } else if (e.type === 'ki48_bomber') {
        // Ki-48 Heavy Twin Bomber
        ctx.fillStyle = '#3F3F46';
        // Main Swept Wings
        ctx.fillRect(-44, -5, 88, 12);
        // Fuselage
        ctx.fillStyle = '#27272A';
        ctx.fillRect(-8, -26, 16, 56);
        // Twin Engines
        ctx.fillStyle = '#71717A';
        ctx.fillRect(-24, -14, 10, 24);
        ctx.fillRect(14, -14, 10, 24);
        // Red Roundels
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(-32, 1, 4.5, 0, Math.PI * 2);
        ctx.arc(32, 1, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Health Bar for Bomber
        if (e.hp < 9) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(-22, -34, 44, 4);
          ctx.fillStyle = '#22C55E';
          ctx.fillRect(-22, -34, 44 * (e.hp / 9), 4);
        }
      } else if (e.type === 'ayako_boss') {
        // Massive Ayako Super-Bomber Flagship
        // Giant wings
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(-120, -10, 240, 24);
        // Fuselage
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-24, -40, 48, 85);
        // 4 Wing Engines
        ctx.fillStyle = '#475569';
        for (const ex of [-85, -45, 45, 85]) {
          ctx.fillRect(ex - 7, -20, 14, 38);
          // Spinning yellow prop discs
          ctx.fillStyle = '#FACC15';
          ctx.beginPath();
          ctx.ellipse(ex, -22, 12, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#475569';
        }

        // Turret Domes
        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.arc(0, -15, 9, 0, Math.PI * 2);
        ctx.arc(-65, 2, 7, 0, Math.PI * 2);
        ctx.arc(65, 2, 7, 0, Math.PI * 2);
        ctx.fill();

        // Boss Health Bar
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(-90, -55, 180, 8);
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-90, -55, 180 * (e.hp / e.maxHp), 8);
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 1;
        ctx.strokeRect(-90, -55, 180, 8);
      }

      ctx.restore();
    }
  }

  _renderPlayer(ctx) {
    if (!this.player) return;

    ctx.save();
    ctx.translate(this.player.x, this.player.y);

    // Loop Roll 3D Transformation
    if (this.player.isLooping) {
      const progress = this.player.loopTimer / this.player.loopDuration;
      // Loop Scale: grows up to 2.2x scale in center of loop
      const scale = 1.0 + Math.sin(progress * Math.PI) * 1.25;
      const angle = progress * Math.PI * 2;

      ctx.scale(scale, scale);
      ctx.rotate(angle);

      // Inverted drop shadow
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 25 * scale;
    } else {
      // Normal bank tilt
      ctx.rotate(this.player.tilt * 0.28);

      // Invulnerability flash
      if (this.player.invulnerableTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
        ctx.globalAlpha = 0.45;
      }
    }

    // P-38 Lightning Drawing
    this._drawP38(ctx, 0, 0);

    // Twin Escort Wingmen
    if (this.player.hasWingmen && !this.player.isLooping) {
      this._drawEscortFighter(ctx, -34, 10);
      this._drawEscortFighter(ctx, 34, 10);
    }

    ctx.restore();
  }

  _drawP38(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);

    // Main Silver Wings
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(-34, -4, 68, 8);

    // Twin Booms (P-38 trademark twin-tail design)
    ctx.fillStyle = '#64748B';
    ctx.fillRect(-17, -18, 7, 36);
    ctx.fillRect(10, -18, 7, 36);

    // Center Cockpit Pod
    ctx.fillStyle = '#475569';
    ctx.fillRect(-5, -16, 10, 26);
    // Glass Canopy
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(-3, -12, 6, 12);

    // Horizontal Stabilizer & Twin Rudders connecting booms
    ctx.fillStyle = '#64748B';
    ctx.fillRect(-18, 14, 36, 4);

    // Spinning Propellers (Twin engines)
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.ellipse(-13.5, -20, 11, 2.5, 0, 0, Math.PI * 2);
    ctx.ellipse(13.5, -20, 11, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // USAAF Star insignia on wings
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-26, 0, 3, 0, Math.PI * 2);
    ctx.arc(26, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawEscortFighter(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);

    // Miniature Escort Pursuit Plane
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(-12, -2, 24, 4);
    ctx.fillStyle = '#0284C7';
    ctx.fillRect(-3, -8, 6, 16);

    // Mini yellow prop
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.ellipse(0, -9, 6, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _renderBullets(ctx) {
    // Player Bullets: Brilliant Gold Tracers
    ctx.fillStyle = '#FEF08A';
    ctx.shadowColor = PALETTE.GOLD;
    ctx.shadowBlur = 6;
    for (const b of this.playerBullets) {
      ctx.fillRect(b.x - 1.5, b.y - 6, 3, 12);
    }
    ctx.shadowBlur = 0;

    // Enemy Bullets: Red glowing orbs
    ctx.fillStyle = '#EF4444';
    ctx.strokeStyle = '#FCA5A5';
    ctx.lineWidth = 1;
    for (const b of this.enemyBullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  _renderParticles(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _renderClouds(ctx) {
    ctx.fillStyle = '#FFFFFF';
    for (const c of this.clouds) {
      ctx.save();
      ctx.globalAlpha = c.alpha;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.arc(c.x + c.r * 0.5, c.y - c.r * 0.2, c.r * 0.7, 0, Math.PI * 2);
      ctx.arc(c.x - c.r * 0.5, c.y + c.r * 0.1, c.r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _renderHUD(ctx) {
    ctx.save();
    // Top Bar Background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(0, 0, this.width, 36);

    ctx.fillStyle = PALETTE.CYAN;
    ctx.font = FONTS.HUD;
    ctx.textAlign = 'left';
    ctx.fillText(`1UP: ${this.score.toString().padStart(6, '0')}`, 20, 24);

    ctx.fillStyle = PALETTE.GOLD;
    ctx.textAlign = 'center';
    ctx.fillText(`HIGH: ${this.highScore.toString().padStart(6, '0')}`, this.width / 2, 24);

    // Stage & Lives
    ctx.textAlign = 'right';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(
      `STAGE ${this.stageConfig ? this.stageConfig.stageNum : 32}`,
      this.width - 150,
      24
    );

    // Lives icons (Mini P-38s)
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText('LIVES:', this.width - 80, 24);
    for (let i = 0; i < this.lives; i++) {
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(this.width - 25 + i * 8, 14, 5, 12);
    }

    // Bottom Loops Indicator
    if (this.player) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(15, this.height - 35, 140, 26);
      ctx.strokeStyle = PALETTE.CYAN;
      ctx.lineWidth = 1;
      ctx.strokeRect(15, this.height - 35, 140, 26);

      ctx.fillStyle = PALETTE.CYAN;
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`LOOPS [X]: ${this.player.loopsLeft}`, 24, this.height - 18);
    }

    ctx.restore();
  }

  _renderPopups(ctx) {
    for (const pop of this.popups) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, pop.life * 1.5);
      ctx.fillStyle = pop.color;
      ctx.font = `bold ${pop.size}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }
  }

  _renderGameOver(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = PALETTE.RED;
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', this.width / 2, 230);

    ctx.fillStyle = PALETTE.GOLD;
    ctx.font = '18px monospace';
    ctx.fillText(`FINAL SCORE: ${this.score}`, this.width / 2, 280);

    ctx.fillStyle = PALETTE.CYAN;
    ctx.font = '14px monospace';
    ctx.fillText('PRESS FIRE OR TAP SCREEN TO SORTIE AGAIN', this.width / 2, 330);

    ctx.restore();
  }

  captureState() {
    return {
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      stage: this.stage,
      state: this.state,
      stageKills: this.stageKills,
      hasWingmen: this.player ? this.player.hasWingmen : false,
      loopsLeft: this.player ? this.player.loopsLeft : 3
    };
  }

  restoreState(state) {
    if (!state) return;
    this.score = state.score || 0;
    this.highScore = state.highScore || 0;
    this.lives = state.lives !== undefined ? state.lives : 3;
    const tgtStage = state.stage !== undefined ? state.stage : (state.level || 1);
    this.level = state.level !== undefined ? state.level : tgtStage;
    this.state = state.state || 'PLAYING';
    this.stageKills = state.stageKills || 0;

    this.initStage(tgtStage);
    this.stage = tgtStage;
    if (this.player) {
      this.player.hasWingmen = !!state.hasWingmen;
      this.player.loopsLeft = state.loopsLeft !== undefined ? state.loopsLeft : 3;
    }
  }

  destroy() {
    this._restoreTouchLabels();
    if (this.audio) {
      this.audio.stopSequence();
    }
  }
}
