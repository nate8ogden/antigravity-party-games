/**
 * Robotron.js
 * Classic 1982 Williams Frantic Arena Shooter (Robotron: 2084 / Cyber Arena 2084).
 *
 * Features:
 * - High-intensity neon cyber arena with 8-way rapid laser streams (`ACTION A`)
 * - Strafe Aim-Lock & Overdrive Shockwave (`ACTION B`: hold to lock firing angle while strafing,
 *   press when charged to repel Hulks and clear enemy sparks!)
 * - Rescue the Last Human Family (Mommy, Daddy, Mikey) for escalating 1000 -> 2000 -> 3000 -> 5000 bonuses!
 * - Full Robotron cast: Grunts, Indestructible Green Hulks (knockback on hit), Spheroids, Enforcers,
 *   Brains (reprogram humans into Progs!), and geometric Arena Electrodes.
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const SPRITES = {
  HERO: [
    '...YYYY...',
    '..YYYYYY..',
    '..YBBBBY..',
    '...YYYY...',
    '.CCCCCCCC.',
    'CCCCCCCCCC',
    'CC.CCCC.CC',
    '...RRRR...',
    '..RR..RR..',
    '.WW....WW.'
  ],
  GRUNT: [
    '..RRRRRR..',
    '.RRRRRRRR.',
    'RROOOOOORR',
    'RRRRRRRRRR',
    '.RROOOORR.',
    '..RRRRRR..',
    '.RRR..RRR.',
    'RRR....RRR',
    'YY......YY'
  ],
  HULK: [
    '.GGGGGGGG.',
    'GGGGGGGGGG',
    'GGRRRRRRGG',
    'GGGGGGGGGG',
    'GGGGGGGGGG',
    'GGGGGGGGGG',
    '.GGGGGGGG.',
    '.GGG..GGG.',
    'RRRR..RRRR'
  ],
  ENFORCER: [
    '...BBBB...',
    '..BBBBBB..',
    '.BBWWWWBB.',
    'BBBBBBBBBB',
    '.BBBBBBBB.',
    '..BB..BB..',
    '.BB....BB.',
    'WW......WW'
  ],
  BRAIN: [
    '..PPPPPP..',
    '.PPPPPPPP.',
    'PPCCCCCCPP',
    'PPPPPPPPPP',
    'PPPPPPPPPP',
    '.PPPPPPPP.',
    '..P.PP.P..',
    '.P..PP..P.'
  ],
  HUMAN: [
    '...YYYY...',
    '..YYYYYY..',
    '...FFFF...',
    '..GGGGGG..',
    '.GGGGGGGG.',
    '...BBBB...',
    '..BB..BB..'
  ]
};

const SPRITE_PALETTE = {
  Y: PALETTE.GOLD,
  B: PALETTE.BLUE,
  C: PALETTE.CYAN,
  R: PALETTE.RED,
  W: PALETTE.WHITE,
  O: PALETTE.ORANGE,
  G: PALETTE.GREEN,
  P: PALETTE.PURPLE,
  F: '#FDBA74'
};

export class Robotron {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'robotron';
    this.title = 'Cyber Arena 2084';
    this.state = 'PLAYING';

    this.width = 960;
    this.height = 540;
    this.arena = { left: 36, right: 924, top: 52, bottom: 522 };

    this.highScore = HighScoreStore.get(this.id);
    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this._setupWave(this.level);
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    if (this.audio) {
      this.audio.stopSequence();
    }
  }

  _randomArenaPos(minDistFromCenter = 130) {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = this.arena.left + 28 + Math.random() * (this.arena.right - this.arena.left - 56);
      const y = this.arena.top + 28 + Math.random() * (this.arena.bottom - this.arena.top - 56);
      if (Math.hypot(x - this.width / 2, y - 285) >= minDistFromCenter) {
        return { x, y };
      }
    }
    return { x: this.arena.left + 50, y: this.arena.top + 50 };
  }

  _setupWave(level) {
    this.player = {
      x: this.width / 2,
      y: 285,
      speed: 225,
      aimX: 1,
      aimY: 0,
      fireCooldown: 0,
      invuln: 1.8,
      pulseCooldown: 0
    };

    this.humanChain = 0;
    this.lasers = [];
    this.enemyShots = [];
    this.enemies = [];
    this.humans = [];
    this.electrodes = [];
    this.particles = [];
    this.floatingTexts = [];

    // Spawn Last Human Family (Mommy, Daddy, Mikey)
    const names = ['MOMMY', 'DADDY', 'MIKEY'];
    const numHumans = Math.min(6, 3 + Math.floor(level / 2));
    for (let i = 0; i < numHumans; i++) {
      const pos = this._randomArenaPos(75);
      const ang = Math.random() * Math.PI * 2;
      this.humans.push({
        name: names[i % names.length],
        x: pos.x,
        y: pos.y,
        vx: Math.cos(ang) * 42,
        vy: Math.sin(ang) * 42,
        dirTimer: 1.5 + Math.random() * 1.5,
        prog: false
      });
    }

    // Spawn Electrodes
    const numElectrodes = Math.min(14, 6 + level);
    for (let i = 0; i < numElectrodes; i++) {
      const pos = this._randomArenaPos(95);
      this.electrodes.push({
        x: pos.x,
        y: pos.y
      });
    }

    // Spawn Grunts
    const numGrunts = Math.min(28, 10 + level * 3);
    for (let i = 0; i < numGrunts; i++) {
      const pos = this._randomArenaPos(145);
      this.enemies.push({
        type: 'grunt',
        x: pos.x,
        y: pos.y,
        speed: 62 + Math.min(55, level * 5),
        stepTimer: Math.random() * 0.3
      });
    }

    // Spawn Indestructible Green Hulks
    const numHulks = Math.min(6, 2 + Math.floor(level / 2));
    for (let i = 0; i < numHulks; i++) {
      const pos = this._randomArenaPos(160);
      const dirs = [
        [1, 0], [-1, 0], [0, 1], [0, -1]
      ];
      const [dx, dy] = dirs[i % 4];
      this.enemies.push({
        type: 'hulk',
        x: pos.x,
        y: pos.y,
        vx: dx * 58,
        vy: dy * 58,
        dirTimer: 1.4 + Math.random() * 1.5
      });
    }

    // Spawn Spheroids (which manufacture Enforcers)
    const numSpheroids = Math.min(4, 1 + Math.floor(level / 2));
    for (let i = 0; i < numSpheroids; i++) {
      const pos = this._randomArenaPos(170);
      this.enemies.push({
        type: 'spheroid',
        x: pos.x,
        y: pos.y,
        vx: (Math.random() < 0.5 ? -1 : 1) * 115,
        vy: (Math.random() < 0.5 ? -1 : 1) * 115,
        spawnTimer: 2.2 + Math.random() * 1.5,
        spawnsLeft: 3
      });
    }

    // Spawn Brains on wave 2+ (or 1 on wave 1)
    const numBrains = Math.min(4, Math.ceil(level / 2));
    for (let i = 0; i < numBrains; i++) {
      const pos = this._randomArenaPos(175);
      this.enemies.push({
        type: 'brain',
        x: pos.x,
        y: pos.y,
        speed: 55 + level * 4,
        fireTimer: 1.8 + Math.random() * 1.5
      });
    }

    this.bannerText = `WAVE ${level} — SAVE THE LAST HUMAN FAMILY!`;
    this.bannerTimer = 2.0;
  }

  _destructibleEnemiesLeft() {
    return this.enemies.filter((e) => e.type !== 'hulk').length;
  }

  update(dt) {
    const clampedDt = Math.min(dt, 0.05);

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

    if (this.bannerTimer > 0) this.bannerTimer = Math.max(0, this.bannerTimer - clampedDt);

    this._updatePlayer(clampedDt);
    this._updateLasers(clampedDt);
    this._updateHumans(clampedDt);
    this._updateEnemies(clampedDt);
    this._updateEnemyShots(clampedDt);
    this._updateParticles(clampedDt);

    if (this._destructibleEnemiesLeft() === 0) {
      this.level += 1;
      this.audio.playStageClear();
      this._setupWave(this.level);
    }
  }

  _updatePlayer(dt) {
    const p = this.player;
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    if (p.pulseCooldown > 0) p.pulseCooldown = Math.max(0, p.pulseCooldown - dt);

    const axis = this.input.getAxis();
    const lockAim = this.input.isDown('actionB');

    // Update movement
    p.x = Math.max(
      this.arena.left + 16,
      Math.min(this.arena.right - 16, p.x + axis.x * p.speed * dt)
    );
    p.y = Math.max(
      this.arena.top + 16,
      Math.min(this.arena.bottom - 16, p.y + axis.y * p.speed * dt)
    );

    // Update 8-way aim direction (unless holding Action B strafe-lock)
    if (!lockAim && (Math.abs(axis.x) > 0.1 || Math.abs(axis.y) > 0.1)) {
      const len = Math.hypot(axis.x, axis.y);
      p.aimX = axis.x / len;
      p.aimY = axis.y / len;
    } else if (this.input.pointer.down) {
      const dx = this.input.pointer.x - p.x;
      const dy = this.input.pointer.y - p.y;
      const len = Math.hypot(dx, dy);
      if (len > 8) {
        p.aimX = dx / len;
        p.aimY = dy / len;
      }
    }

    // Action B Just Pressed: Cyber Repulsor Shockwave if ready!
    if (this.input.isJustPressed('actionB') && p.pulseCooldown <= 0) {
      p.pulseCooldown = 3.5;
      this.audio.playPowerUp();
      this.renderer.shake(5, 0.18);
      this._spawnExplosion(p.x, p.y, PALETTE.CYAN, 20);
      this.enemyShots = [];
      for (const e of this.enemies) {
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        if (d < 160) {
          e.x = Math.max(this.arena.left + 18, Math.min(this.arena.right - 18, e.x + (dx / d) * 75));
          e.y = Math.max(this.arena.top + 18, Math.min(this.arena.bottom - 18, e.y + (dy / d) * 75));
        }
      }
    }

    // Fire rapid 8-way laser stream (Action A or pointer hold)
    const wantsFire =
      this.input.isDown('actionA') ||
      this.input.isJustPressed('actionA') ||
      this.input.pointer.down;

    if (wantsFire && p.fireCooldown <= 0) {
      p.fireCooldown = 0.085;
      const colors = [PALETTE.CYAN, PALETTE.PINK, PALETTE.GOLD, PALETTE.GREEN];
      this.lasers.push({
        x: p.x + p.aimX * 12,
        y: p.y + p.aimY * 12,
        vx: p.aimX * 660,
        vy: p.aimY * 660,
        color: colors[this.lasers.length % colors.length]
      });
      this.audio.playLaser(1320, 290, 0.065);
    }

    // Check touching an Electrode
    for (let i = this.electrodes.length - 1; i >= 0; i--) {
      const el = this.electrodes[i];
      if (Math.hypot(p.x - el.x, p.y - el.y) < 18) {
        this.electrodes.splice(i, 1);
        if (p.invuln <= 0) {
          this._hitPlayer();
          return;
        }
      }
    }
  }

  _updateLasers(dt) {
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.x += l.vx * dt;
      l.y += l.vy * dt;

      if (
        l.x < this.arena.left ||
        l.x > this.arena.right ||
        l.y < this.arena.top ||
        l.y > this.arena.bottom
      ) {
        this.lasers.splice(i, 1);
        continue;
      }

      // Check hitting Electrodes
      let consumed = false;
      for (let eIdx = this.electrodes.length - 1; eIdx >= 0; eIdx--) {
        const el = this.electrodes[eIdx];
        if (Math.hypot(l.x - el.x, l.y - el.y) < 14) {
          this._awardPoints(25, el.x, el.y, '+25', PALETTE.PURPLE);
          this._spawnExplosion(el.x, el.y, PALETTE.PURPLE, 8);
          this.electrodes.splice(eIdx, 1);
          consumed = true;
          break;
        }
      }
      if (consumed) {
        this.lasers.splice(i, 1);
        continue;
      }

      // Check hitting Enemies
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (Math.hypot(l.x - e.x, l.y - e.y) < 16) {
          consumed = true;
          if (e.type === 'hulk') {
            // Indestructible Hulk gets knocked back by laser impact!
            const len = Math.max(1, Math.hypot(l.vx, l.vy));
            e.x = Math.max(
              this.arena.left + 18,
              Math.min(this.arena.right - 18, e.x + (l.vx / len) * 14)
            );
            e.y = Math.max(
              this.arena.top + 18,
              Math.min(this.arena.bottom - 18, e.y + (l.vy / len) * 14)
            );
            this.audio.playDig();
          } else {
            const pts =
              e.type === 'spheroid'
                ? 1000
                : e.type === 'brain'
                ? 500
                : e.type === 'enforcer'
                ? 150
                : 100;
            const col =
              e.type === 'spheroid'
                ? PALETTE.CYAN
                : e.type === 'brain'
                ? PALETTE.PURPLE
                : PALETTE.RED;
            this._awardPoints(pts, e.x, e.y, `+${pts}`, col);
            this._spawnExplosion(e.x, e.y, col, 16);
            this.audio.playExplosion(0.18, 1250);
            this.enemies.splice(j, 1);
          }
          break;
        }
      }
      if (consumed) {
        this.lasers.splice(i, 1);
        continue;
      }

      // Check intercepting enemy shots / cruise missiles
      for (let k = this.enemyShots.length - 1; k >= 0; k--) {
        const es = this.enemyShots[k];
        if (Math.hypot(l.x - es.x, l.y - es.y) < 12) {
          this.enemyShots.splice(k, 1);
          this.lasers.splice(i, 1);
          this._awardPoints(25, es.x, es.y, '+25', PALETTE.GOLD);
          break;
        }
      }
    }
  }

  _updateHumans(dt) {
    const p = this.player;
    for (let i = this.humans.length - 1; i >= 0; i--) {
      const h = this.humans[i];
      h.dirTimer -= dt;
      if (h.dirTimer <= 0) {
        h.dirTimer = 1.4 + Math.random() * 1.5;
        const ang = Math.random() * Math.PI * 2;
        h.vx = Math.cos(ang) * 42;
        h.vy = Math.sin(ang) * 42;
      }

      h.x += h.vx * dt;
      h.y += h.vy * dt;
      if (h.x < this.arena.left + 16 || h.x > this.arena.right - 16) h.vx = -h.vx;
      if (h.y < this.arena.top + 16 || h.y > this.arena.bottom - 16) h.vy = -h.vy;

      // Player rescues human!
      if (Math.hypot(p.x - h.x, p.y - h.y) < 22) {
        this.humanChain = Math.min(5, this.humanChain + 1);
        const pts = this.humanChain * 1000;
        this._awardPoints(pts, h.x, h.y - 16, `${h.name} SAVED +${pts}!`, PALETTE.GOLD);
        this.audio.playCoin();
        this.humans.splice(i, 1);
        continue;
      }

      // Check if Hulk crushes human or Brain reprograms human into a Prog!
      for (const e of this.enemies) {
        if (e.type === 'hulk' && Math.hypot(e.x - h.x, e.y - h.y) < 20) {
          this._spawnFloatingText('HUMAN LOST!', h.x, h.y, PALETTE.RED);
          this._spawnExplosion(h.x, h.y, PALETTE.RED, 12);
          this.humans.splice(i, 1);
          break;
        } else if (e.type === 'brain' && Math.hypot(e.x - h.x, e.y - h.y) < 20) {
          this._spawnFloatingText('REPROGRAMMED!', h.x, h.y, PALETTE.PURPLE);
          this.enemies.push({
            type: 'grunt',
            x: h.x,
            y: h.y,
            speed: 115
          });
          this.humans.splice(i, 1);
          break;
        }
      }
    }
  }

  _updateEnemies(dt) {
    const p = this.player;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      if (e.type === 'grunt') {
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        e.x += (dx / dist) * e.speed * dt;
        e.y += (dy / dist) * e.speed * dt;
      } else if (e.type === 'hulk') {
        e.dirTimer -= dt;
        if (e.dirTimer <= 0) {
          e.dirTimer = 1.2 + Math.random() * 1.4;
          if (Math.random() < 0.5) {
            e.vx = Math.sign(p.x - e.x) * 60;
            e.vy = 0;
          } else {
            e.vx = 0;
            e.vy = Math.sign(p.y - e.y) * 60;
          }
        }
        e.x = Math.max(this.arena.left + 18, Math.min(this.arena.right - 18, e.x + e.vx * dt));
        e.y = Math.max(this.arena.top + 18, Math.min(this.arena.bottom - 18, e.y + e.vy * dt));
      } else if (e.type === 'spheroid') {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.x < this.arena.left + 20 || e.x > this.arena.right - 20) e.vx = -e.vx;
        if (e.y < this.arena.top + 20 || e.y > this.arena.bottom - 20) e.vy = -e.vy;

        e.spawnTimer -= dt;
        if (e.spawnTimer <= 0 && e.spawnsLeft > 0) {
          e.spawnTimer = 2.4;
          e.spawnsLeft -= 1;
          this.enemies.push({
            type: 'enforcer',
            x: e.x,
            y: e.y,
            vx: (Math.random() - 0.5) * 160,
            vy: (Math.random() - 0.5) * 160,
            fireTimer: 0.8
          });
        }
      } else if (e.type === 'enforcer') {
        e.x += (e.vx || 80) * dt;
        e.y += (e.vy || 80) * dt;
        if (e.x < this.arena.left + 18 || e.x > this.arena.right - 18) e.vx = -e.vx;
        if (e.y < this.arena.top + 18 || e.y > this.arena.bottom - 18) e.vy = -e.vy;

        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          e.fireTimer = 1.35 + Math.random();
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const d = Math.max(1, Math.hypot(dx, dy));
          this.enemyShots.push({
            x: e.x,
            y: e.y,
            vx: (dx / d) * 240,
            vy: (dy / d) * 240,
            homing: false
          });
        }
      } else if (e.type === 'brain') {
        // Seek nearest human if any exist, else stalk player
        let target = p;
        if (this.humans.length > 0) {
          target = this.humans[0];
        }
        const dx = target.x - e.x;
        const dy = target.y - e.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        e.x += (dx / d) * e.speed * dt;
        e.y += (dy / d) * e.speed * dt;

        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          e.fireTimer = 2.0 + Math.random();
          this.enemyShots.push({
            x: e.x,
            y: e.y,
            vx: 0,
            vy: 0,
            homing: true,
            life: 3.2
          });
        }
      }

      // Collision with Electrodes destroys Grunts
      if (e.type === 'grunt') {
        for (let elIdx = this.electrodes.length - 1; elIdx >= 0; elIdx--) {
          const el = this.electrodes[elIdx];
          if (Math.hypot(e.x - el.x, e.y - el.y) < 15) {
            this.electrodes.splice(elIdx, 1);
            this._spawnExplosion(e.x, e.y, PALETTE.ORANGE, 10);
            this.enemies.splice(i, 1);
            break;
          }
        }
      }

      // Collision with Player
      if (p.invuln <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < 18) {
        if (e.type !== 'hulk') this.enemies.splice(i, 1);
        this._hitPlayer();
        return;
      }
    }
  }

  _updateEnemyShots(dt) {
    const p = this.player;
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const es = this.enemyShots[i];
      if (es.homing) {
        es.life -= dt;
        if (es.life <= 0) {
          this.enemyShots.splice(i, 1);
          continue;
        }
        const dx = p.x - es.x;
        const dy = p.y - es.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        es.vx = (dx / d) * 165;
        es.vy = (dy / d) * 165;
      }

      es.x += es.vx * dt;
      es.y += es.vy * dt;

      if (
        es.x < this.arena.left ||
        es.x > this.arena.right ||
        es.y < this.arena.top ||
        es.y > this.arena.bottom
      ) {
        this.enemyShots.splice(i, 1);
        continue;
      }

      if (p.invuln <= 0 && Math.hypot(es.x - p.x, es.y - p.y) < 14) {
        this.enemyShots.splice(i, 1);
        this._hitPlayer();
        return;
      }
    }
  }

  _hitPlayer() {
    this.renderer.shake(10, 0.35);
    this.audio.playExplosion(0.45, 700);
    this._spawnExplosion(this.player.x, this.player.y, PALETTE.WHITE, 28);
    this.lives -= 1;

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.audio.playGameOver();
      this.state = 'GAMEOVER';
    } else {
      this.player.x = this.width / 2;
      this.player.y = 285;
      this.player.invuln = 2.4;
      this.enemyShots = [];
      // Push nearby enemies outward so respawn is always fair
      for (const e of this.enemies) {
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        if (d < 130) {
          e.x += (dx / d) * 120;
          e.y += (dy / d) * 120;
        }
      }
    }
  }

  _awardPoints(pts, x, y, text, color) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    this._spawnFloatingText(text, x, y, color);
  }

  _spawnFloatingText(text, x, y, color) {
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

  _spawnExplosion(x, y, color, count = 16) {
    const colors = [color, PALETTE.CYAN, PALETTE.GOLD, PALETTE.PINK, PALETTE.WHITE];
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const spd = 55 + Math.random() * 170;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        size: 3,
        color: colors[i % colors.length]
      });
    }
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
    this.renderer.clear('#05070F');

    // 1. Electric Neon Containment Border
    const borderColors = [PALETTE.RED, PALETTE.CYAN, PALETTE.PURPLE, PALETTE.GREEN, PALETTE.GOLD];
    const borderColor = borderColors[(this.level - 1) % borderColors.length];
    this.renderer.drawGlowRect(
      this.arena.left,
      this.arena.top,
      this.arena.right - this.arena.left,
      this.arena.bottom - this.arena.top,
      borderColor,
      14,
      false,
      3
    );

    // 2. Geometric Arena Electrodes
    for (const el of this.electrodes) {
      ctx.save();
      ctx.translate(el.x, el.y);
      ctx.rotate(performance.now() * 0.003);
      ctx.strokeStyle = PALETTE.PURPLE;
      ctx.shadowColor = PALETTE.PINK;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      ctx.strokeRect(-7, -7, 14, 14);
      ctx.restore();
    }

    // 3. The Last Human Family (Mommy, Daddy, Mikey)
    for (const h of this.humans) {
      const scale = 2.1;
      const w = SPRITES.HUMAN[0].length * scale;
      const ht = SPRITES.HUMAN.length * scale;
      this.renderer.drawPixelSprite(SPRITES.HUMAN, h.x - w / 2, h.y - ht / 2, scale, SPRITE_PALETTE);
    }

    // 4. Robotron Enemies (Grunts, Hulks, Spheroids, Enforcers, Brains)
    for (const e of this.enemies) {
      if (e.type === 'spheroid') {
        const r = 9 + Math.sin(performance.now() * 0.015) * 3;
        this.renderer.drawGlowCircle(e.x, e.y, r, PALETTE.RED, 12, false, 2.5);
        this.renderer.drawGlowCircle(e.x, e.y, r * 0.5, PALETTE.CYAN, 8, false, 2);
        continue;
      }

      const sprite =
        e.type === 'hulk'
          ? SPRITES.HULK
          : e.type === 'enforcer'
          ? SPRITES.ENFORCER
          : e.type === 'brain'
          ? SPRITES.BRAIN
          : SPRITES.GRUNT;
      const scale = e.type === 'hulk' ? 2.6 : 2.2;
      const w = sprite[0].length * scale;
      const h = sprite.length * scale;
      this.renderer.drawPixelSprite(sprite, e.x - w / 2, e.y - h / 2, scale, SPRITE_PALETTE);
    }

    // 5. Mutant Hero & Aim Reticle
    const p = this.player;
    if (p.invuln <= 0 || Math.floor(p.invuln * 14) % 2 === 0) {
      const scale = 2.2;
      const w = SPRITES.HERO[0].length * scale;
      const h = SPRITES.HERO.length * scale;
      this.renderer.drawPixelSprite(SPRITES.HERO, p.x - w / 2, p.y - h / 2, scale, SPRITE_PALETTE);

      // Subtle directional aim sight
      this.renderer.drawGlowCircle(
        p.x + p.aimX * 24,
        p.y + p.aimY * 24,
        2.5,
        this.input.isDown('actionB') ? PALETTE.GOLD : PALETTE.CYAN,
        8
      );
    }

    // 6. Player Laser Streams & Enemy Sparks
    for (const l of this.lasers) {
      ctx.save();
      ctx.strokeStyle = l.color;
      ctx.shadowColor = l.color;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x - l.vx * 0.02, l.y - l.vy * 0.02);
      ctx.stroke();
      ctx.restore();
    }

    for (const es of this.enemyShots) {
      this.renderer.drawGlowCircle(
        es.x,
        es.y,
        4.5,
        es.homing ? PALETTE.PURPLE : PALETTE.PINK,
        10
      );
    }

    // 7. Particles & Score Popups
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    for (const ft of this.floatingTexts) {
      this.renderer.drawText(ft.text, ft.x, ft.y, {
        font: FONTS.HEADER,
        size: 11,
        color: ft.color,
        align: 'center',
        glow: 8
      });
    }

    if (this.bannerTimer > 0 && this.state === 'PLAYING') {
      this.renderer.drawText(this.bannerText, this.width / 2, 275, {
        font: FONTS.HEADER,
        size: 14,
        color: PALETTE.CYAN,
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
      extraLabel: `HUMANS: ${this.humans.length}`,
      accent: PALETTE.PINK
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'TWIN-STICK NEON CYBER ARENA EDITION',
      controls: 'ARROWS/WASD: MOVE & AIM  |  Z/SPACE/CLICK: 8-WAY LASER  |  X/SHIFT: STRAFE LOCK & PULSE',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.PINK
    });
  }
}

export default Robotron;
