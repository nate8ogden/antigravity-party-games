/**
 * Contra.js
 * Classic 1987 Side-Scrolling Run-and-Gun Jungle & Alien Fortress Action
 * Features 8-way directional aiming, prone low-profile dodging, somersault jumps,
 * drop-down platforms (Down + Action B), water trenches, exploding bridges,
 * flying power-up capsules (Spread Shot 'S', Rapid 'R', Laser 'L'), wall turrets,
 * and a multi-part destructible Defense Wall Boss Core at the end of each sector.
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

export class Contra {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'contra';
    this.title = 'Commando Strike';
    this.width = 960;
    this.height = 540;

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.cameraX = 0;
    this.bossLockX = 2520;
    this.waterY = 492;

    this.player = null;
    this.platforms = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.capsules = [];
    this.powerups = [];
    this.boss = null;
    this.particles = [];
    this.popups = [];

    this.runnerSpawnTimer = 0;
    this.capsuleTimer = 0;
    this.stageClearTimer = 0;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.state = 'PLAYING';
    this._initStage();
  }

  setState(state) {
    this.state = state;
    if (state === 'GAMEOVER') {
      HighScoreStore.submit(this.id, this.score);
    }
  }

  destroy() {
    if (this.audio) {
      this.audio.stopSequence();
    }
  }

  _addScore(pts, x = null, y = null, color = PALETTE.GOLD, label = null) {
    this.score += Math.floor(pts);
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    if (x !== null && y !== null) {
      this.popups.push({
        x,
        y,
        text: label || `+${Math.floor(pts)}`,
        color,
        life: 1.0
      });
    }
  }

  _initStage() {
    this.cameraX = 0;
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.capsules = [];
    this.powerups = [];
    this.particles = [];
    this.popups = [];
    this.stageClearTimer = 0;
    this.runnerSpawnTimer = 1.6;
    this.capsuleTimer = 4.0;

    this._resetPlayer(80, 260, this.player ? this.player.weapon : 'S');

    // Build Multi-Tier Jungle Platforms & Bridges
    this.platforms = [
      { x: 0, y: 340, w: 520, type: 'JUNGLE' },
      { x: 240, y: 245, w: 220, type: 'LEDGE' },
      { x: 550, y: 340, w: 240, type: 'BRIDGE', exploded: false },
      { x: 820, y: 390, w: 360, type: 'JUNGLE' },
      { x: 920, y: 280, w: 280, type: 'LEDGE' },
      { x: 1120, y: 190, w: 240, type: 'LEDGE' },
      { x: 1240, y: 350, w: 320, type: 'JUNGLE' },
      { x: 1600, y: 350, w: 240, type: 'BRIDGE', exploded: false },
      { x: 1870, y: 410, w: 380, type: 'JUNGLE' },
      { x: 1960, y: 300, w: 260, type: 'LEDGE' },
      { x: 2150, y: 205, w: 260, type: 'LEDGE' },
      { x: 2280, y: 355, w: 380, type: 'JUNGLE' },
      // Boss Arena Ground & Platforms
      { x: 2520, y: 450, w: 960, type: 'FORTRESS_FLOOR', solid: true },
      { x: 2620, y: 350, w: 180, type: 'LEDGE' },
      { x: 2850, y: 265, w: 170, type: 'LEDGE' }
    ];

    // Populate Static Wall Turrets & Snipers along sector
    const placements = [
      { x: 380, y: 225, type: 'SNIPER' },
      { x: 720, y: 210, type: 'TURRET' },
      { x: 1050, y: 260, type: 'SNIPER' },
      { x: 1380, y: 330, type: 'TURRET' },
      { x: 1520, y: 220, type: 'TURRET' },
      { x: 2060, y: 280, type: 'SNIPER' },
      { x: 2290, y: 185, type: 'TURRET' },
      { x: 2480, y: 335, type: 'SNIPER' }
    ];

    for (const pl of placements) {
      this.enemies.push({
        type: pl.type,
        x: pl.x,
        y: pl.y,
        w: 28,
        h: 32,
        vx: 0,
        vy: 0,
        hp: pl.type === 'TURRET' ? 5 + this.level : 2,
        shootTimer: 1.2 + Math.random(),
        aimAngle: Math.PI
      });
    }

    // Spawn Initial Spread Shot Flying Capsule so player can enjoy Spread Shot early
    this.capsules.push({
      x: 120,
      baseY: 135,
      y: 135,
      vx: 145,
      weaponType: 'S',
      phase: 0
    });

    // Defense Wall Boss Fortress at end of sector
    const baseHp = 55 + this.level * 18;
    this.boss = {
      x: 3260,
      y: 120,
      w: 220,
      h: 330,
      coreX: 3290,
      coreY: 365,
      coreR: 32,
      hp: baseHp,
      maxHp: baseHp,
      alive: true,
      pulse: 0,
      turrets: [
        { x: 3275, y: 255, hp: 16, maxHp: 16, timer: 1.3 },
        { x: 3335, y: 255, hp: 16, maxHp: 16, timer: 1.9 }
      ],
      coreTimer: 2.1
    };
  }

  _resetPlayer(x, y, weapon = 'RIFLE') {
    this.player = {
      x,
      y,
      w: 24,
      h: 42,
      vx: 0,
      vy: 0,
      facing: 1,
      aimX: 1,
      aimY: 0,
      onGround: false,
      inWater: false,
      isProne: false,
      dropTimer: 0,
      weapon: weapon || 'RIFLE', // 'RIFLE' | 'S' (Spread) | 'R' (Rapid) | 'L' (Laser)
      shootCooldown: 0,
      invulnTimer: 2.5,
      spinAngle: 0
    };
  }

  _spawnParticles(x, y, color, count = 12, speed = 160) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        color,
        size: 3 + Math.random() * 3,
        life: 0.4 + Math.random() * 0.3
      });
    }
  }

  _firePlayerWeapon() {
    const p = this.player;
    const baseAngle = Math.atan2(p.aimY, p.aimX);
    const muzzleX = p.x + p.w / 2 + Math.cos(baseAngle) * 18;
    const muzzleY =
      (p.isProne ? p.y + p.h - 10 : p.y + 16) + Math.sin(baseAngle) * 14;

    if (p.weapon === 'S') {
      // Iconic 5-Way Spread Shot fan of glowing red energy orbs!
      p.shootCooldown = 0.17;
      this.audio.playLaser(920, 220, 0.09);
      const spreadOffsets = [-0.34, -0.17, 0, 0.17, 0.34];
      for (const off of spreadOffsets) {
        const ang = baseAngle + off;
        this.bullets.push({
          x: muzzleX,
          y: muzzleY,
          vx: Math.cos(ang) * 580,
          vy: Math.sin(ang) * 580,
          r: 6,
          damage: 2,
          color: PALETTE.RED,
          pierce: false
        });
      }
    } else if (p.weapon === 'L') {
      // High-Damage Piercing Laser Beam!
      p.shootCooldown = 0.24;
      this.audio.playLaser(1350, 320, 0.14);
      for (let k = 0; k < 3; k++) {
        this.bullets.push({
          x: muzzleX - Math.cos(baseAngle) * k * 14,
          y: muzzleY - Math.sin(baseAngle) * k * 14,
          vx: Math.cos(baseAngle) * 740,
          vy: Math.sin(baseAngle) * 740,
          r: 5,
          damage: 3.5,
          color: PALETTE.CYAN,
          pierce: true
        });
      }
    } else {
      // Rapid Fire ('R') or Standard Rifle
      p.shootCooldown = p.weapon === 'R' ? 0.085 : 0.14;
      this.audio.playLaser(760, 260, 0.06);
      this.bullets.push({
        x: muzzleX,
        y: muzzleY,
        vx: Math.cos(baseAngle) * 650,
        vy: Math.sin(baseAngle) * 650,
        r: p.weapon === 'R' ? 5 : 4,
        damage: p.weapon === 'R' ? 2 : 1.5,
        color: PALETTE.GOLD,
        pierce: false
      });
    }
  }

  update(dt) {
    if (this.state === 'MENU') {
      if (
        this.input.isJustPressed('actionA') ||
        this.input.isJustPressed('actionB') ||
        this.input.pointer.justPressed
      ) {
        this.audio.playMenuSelect();
        this.reset();
        this.setState('PLAYING');
      }
      return;
    }

    if (this.state === 'PAUSED') {
      if (this.input.isJustPressed('pause') || this.input.isJustPressed('actionA')) {
        this.audio.playMenuSelect();
        this.setState('PLAYING');
      }
      return;
    }

    if (this.state === 'GAMEOVER') {
      if (
        this.input.isJustPressed('actionA') ||
        this.input.isJustPressed('actionB') ||
        this.input.pointer.justPressed
      ) {
        this.audio.playMenuSelect();
        this.reset();
        this.setState('PLAYING');
      }
      return;
    }

    if (this.input.isJustPressed('pause')) {
      this.audio.playMenuMove();
      this.setState('PAUSED');
      return;
    }

    // Stage Clear celebration transition
    if (this.stageClearTimer > 0) {
      this.stageClearTimer -= dt;
      this._updateParticles(dt);
      if (this.stageClearTimer <= 0) {
        this.level++;
        this._initStage();
      }
      return;
    }

    const p = this.player;
    if (p.invulnTimer > 0) p.invulnTimer -= dt;
    if (p.shootCooldown > 0) p.shootCooldown -= dt;
    if (p.dropTimer > 0) p.dropTimer -= dt;

    // 8-Way Directional Input & Prone Stance
    const left = this.input.isDown('left');
    const right = this.input.isDown('right');
    const up = this.input.isDown('up');
    const down = this.input.isDown('down');

    const moveSpeed = p.inWater ? 155 : 225;
    if (left) {
      p.vx = -moveSpeed;
      p.facing = -1;
    } else if (right) {
      p.vx = moveSpeed;
      p.facing = 1;
    } else {
      p.vx = 0;
    }

    // Hold Down while stationary on ground -> Go Prone!
    p.isProne = p.onGround && !p.inWater && down && !left && !right;

    // Compute 8-Way Aim Vector
    let ax = 0;
    let ay = 0;
    if (left) ax = -1;
    else if (right) ax = 1;
    if (up) ay = -1;
    else if (down && (!p.onGround || left || right)) ay = 1;

    if (ax === 0 && ay === 0) {
      ax = p.facing;
      ay = 0;
    }
    const len = Math.hypot(ax, ay) || 1;
    p.aimX = ax / len;
    p.aimY = ay / len;

    // Action B: Jump or Drop Down Through Platform (Down + Action B)
    if (this.input.isJustPressed('actionB')) {
      if (p.onGround && down && !left && !right) {
        // Drop down through one-way platform
        p.dropTimer = 0.22;
        p.onGround = false;
        p.isProne = false;
        p.y += 6;
        this.audio.playMenuMove();
      } else if (p.onGround || p.inWater) {
        p.vy = -485;
        p.onGround = false;
        p.inWater = false;
        p.isProne = false;
        this.audio.playJump();
      }
    }

    // Action A: Fire Weapon
    if (this.input.isDown('actionA') && p.shootCooldown <= 0) {
      this._firePlayerWeapon();
    }

    // Apply Gravity & Move Player
    const prevBottom = p.y + p.h;
    p.vy = Math.min(540, p.vy + 1150 * dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (!p.onGround && !p.inWater) {
      p.spinAngle += 16 * dt * p.facing;
    } else {
      p.spinAngle = 0;
    }

    // Check Platform Landing
    p.onGround = false;
    if (p.vy >= 0) {
      for (const plat of this.platforms) {
        if (plat.exploded) continue;
        if (p.dropTimer > 0 && !plat.solid) continue;

        if (
          p.x + p.w > plat.x + 4 &&
          p.x < plat.x + plat.w - 4 &&
          prevBottom <= plat.y + 10 &&
          p.y + p.h >= plat.y
        ) {
          p.y = plat.y - p.h;
          p.vy = 0;
          p.onGround = true;
          p.inWater = false;

          // Exploding Suspension Bridge dramatic detonation!
          if (plat.type === 'BRIDGE' && p.x > plat.x + 80) {
            plat.exploded = true;
            this.audio.playExplosion(0.4, 900);
            this.renderer.shake(9, 0.25);
            this._spawnParticles(plat.x + plat.w / 2, plat.y, PALETTE.ORANGE, 24, 220);
          }
          break;
        }
      }
    }

    // Water Trench Check
    if (!p.onGround && p.y + p.h >= this.waterY && p.x < this.bossLockX) {
      if (!p.inWater) {
        this._spawnParticles(p.x + p.w / 2, this.waterY, PALETTE.CYAN, 10, 120);
      }
      p.y = this.waterY - p.h + 14;
      p.vy = 0;
      p.inWater = true;
      p.onGround = true;
    }

    // Scroll Camera Forward (One-way Contra scroll up to Boss Arena lock)
    const targetCam = Math.min(this.bossLockX, Math.max(this.cameraX, p.x - 280));
    this.cameraX += (targetCam - this.cameraX) * 8 * dt;
    p.x = Math.max(this.cameraX + 16, Math.min(this.cameraX + this.width - 140, p.x));

    // Spawn Flying Power-Up Capsules periodically
    this.capsuleTimer -= dt;
    if (this.capsuleTimer <= 0) {
      const types = ['S', 'R', 'L', 'S'];
      const wType = types[Math.floor(Math.random() * types.length)];
      this.capsules.push({
        x: this.cameraX - 30,
        baseY: 115 + Math.random() * 55,
        y: 130,
        vx: 165,
        weaponType: wType,
        phase: 0
      });
      this.capsuleTimer = 8.5;
    }

    // Spawn Running Red Falcon Soldiers
    this.runnerSpawnTimer -= dt;
    if (this.runnerSpawnTimer <= 0 && this.enemies.length < 10) {
      this.enemies.push({
        type: 'RUNNER',
        x: this.cameraX + this.width + 20,
        y: 180,
        w: 22,
        h: 38,
        vx: -175 - this.level * 12,
        vy: 0,
        hp: 1,
        onGround: false
      });
      this.runnerSpawnTimer = Math.max(1.1, 2.2 - this.level * 0.15);
    }

    // Update Flying Capsules
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const cap = this.capsules[i];
      cap.phase += dt * 5;
      cap.x += cap.vx * dt;
      cap.y = cap.baseY + Math.sin(cap.phase) * 32;
      if (cap.x > this.cameraX + this.width + 80) {
        this.capsules.splice(i, 1);
      }
    }

    // Update Dropped Power-Up Badges
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pw = this.powerups[i];
      pw.vy = Math.min(400, pw.vy + 900 * dt);
      pw.x += pw.vx * dt;
      pw.y += pw.vy * dt;

      for (const plat of this.platforms) {
        if (!plat.exploded && pw.x > plat.x && pw.x < plat.x + plat.w && pw.y + 14 >= plat.y && pw.y <= plat.y + 20 && pw.vy > 0) {
          pw.y = plat.y - 14;
          pw.vy = 0;
          pw.vx = 0;
        }
      }
      if (pw.y + 14 >= this.waterY) {
        pw.y = this.waterY - 14;
        pw.vy = 0;
        pw.vx = 0;
      }

      // Check Player Pickup
      if (Math.hypot(p.x + p.w / 2 - pw.x, p.y + p.h / 2 - pw.y) < 28) {
        p.weapon = pw.weaponType;
        this.audio.playPowerUp();
        const names = { S: 'SPREAD SHOT!', R: 'RAPID FIRE!', L: 'LASER BEAM!' };
        this._addScore(500, pw.x, pw.y - 10, PALETTE.CYAN, names[pw.weaponType] || 'POWER UP!');
        this.powerups.splice(i, 1);
      }
    }

    // Update Player Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (
        b.x < this.cameraX - 40 ||
        b.x > this.cameraX + this.width + 40 ||
        b.y < 38 ||
        b.y > this.height
      ) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Check Hit vs Flying Capsules
      let consumed = false;
      for (let j = this.capsules.length - 1; j >= 0; j--) {
        const cap = this.capsules[j];
        if (Math.hypot(b.x - cap.x, b.y - cap.y) < 22) {
          this.audio.playExplosion(0.2, 1200);
          this._spawnParticles(cap.x, cap.y, PALETTE.RED, 12, 150);
          this.powerups.push({
            x: cap.x,
            y: cap.y,
            vx: 50,
            vy: -220,
            weaponType: cap.weaponType
          });
          this.capsules.splice(j, 1);
          if (!b.pierce) {
            this.bullets.splice(i, 1);
            consumed = true;
          }
          break;
        }
      }
      if (consumed) continue;

      // Check Hit vs Enemies
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (
          b.x > e.x - 6 &&
          b.x < e.x + e.w + 6 &&
          b.y > e.y - 6 &&
          b.y < e.y + e.h + 6
        ) {
          e.hp -= b.damage;
          this._spawnParticles(b.x, b.y, PALETTE.GOLD, 4, 90);
          if (e.hp <= 0) {
            this.audio.playExplosion(0.25, 1100);
            this._spawnParticles(e.x + e.w / 2, e.y + e.h / 2, PALETTE.ORANGE, 14, 170);
            this._addScore(e.type === 'TURRET' ? 500 : 200, e.x, e.y);
            this.enemies.splice(j, 1);
          }
          if (!b.pierce) {
            this.bullets.splice(i, 1);
            consumed = true;
          }
          break;
        }
      }
      if (consumed) continue;

      // Check Hit vs Defense Wall Boss Turrets & Core
      if (this.boss && this.boss.alive && this.cameraX >= this.bossLockX - 80) {
        for (const tur of this.boss.turrets) {
          if (tur.hp > 0 && Math.hypot(b.x - tur.x, b.y - tur.y) < 22) {
            tur.hp -= b.damage;
            this._spawnParticles(b.x, b.y, PALETTE.ORANGE, 5, 110);
            if (tur.hp <= 0) {
              this.audio.playExplosion(0.35, 950);
              this._addScore(1000, tur.x, tur.y, PALETTE.GOLD, 'CANNON DESTROYED +1000');
            }
            if (!b.pierce) {
              this.bullets.splice(i, 1);
              consumed = true;
            }
            break;
          }
        }
        if (consumed) continue;

        if (Math.hypot(b.x - this.boss.coreX, b.y - this.boss.coreY) < this.boss.coreR + 6) {
          this.boss.hp -= b.damage;
          this._spawnParticles(b.x, b.y, PALETTE.PINK, 6, 130);
          if (!b.pierce) {
            this.bullets.splice(i, 1);
          }
          if (this.boss.hp <= 0) {
            this.boss.alive = false;
            this.enemyBullets = [];
            this.enemies = [];
            this.audio.playExplosion(0.65, 800);
            this.audio.playStageClear();
            this.renderer.shake(14, 0.45);
            this._spawnParticles(this.boss.coreX, this.boss.coreY, PALETTE.RED, 36, 260);
            this._spawnParticles(this.boss.coreX, this.boss.coreY, PALETTE.GOLD, 24, 200);
            this._addScore(
              5000 * this.level,
              this.boss.coreX - 80,
              this.boss.coreY - 40,
              PALETTE.GOLD,
              `DEFENSE CORE DESTROYED +${5000 * this.level}!`
            );
            this.stageClearTimer = 2.6;
          }
        }
      }
    }

    // Update Enemies
    const pHitTop = p.isProne ? p.y + p.h - 18 : p.y + 4;
    const pHitBottom = p.y + p.h;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.x < this.cameraX - 80) {
        this.enemies.splice(i, 1);
        continue;
      }
      if (e.x > this.cameraX + this.width + 60) continue;

      if (e.type === 'RUNNER') {
        const prevB = e.y + e.h;
        e.vy = Math.min(480, e.vy + 1050 * dt);
        e.x += e.vx * dt;
        e.y += e.vy * dt;

        for (const plat of this.platforms) {
          if (!plat.exploded && e.x + e.w > plat.x && e.x < plat.x + plat.w && prevB <= plat.y + 10 && e.y + e.h >= plat.y) {
            e.y = plat.y - e.h;
            e.vy = 0;
            break;
          }
        }
        if (e.y > this.height) {
          this.enemies.splice(i, 1);
          continue;
        }
      } else {
        // SNIPER or 8-Way Rotating Wall TURRET
        const ang = Math.atan2(p.y + p.h / 2 - (e.y + 16), p.x + p.w / 2 - (e.x + 14));
        // Snap turret angle to 12/8 discrete steps
        e.aimAngle = Math.round(ang / (Math.PI / 6)) * (Math.PI / 6);
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.type === 'TURRET' ? 1.55 : 1.9;
          this.enemyBullets.push({
            x: e.x + 14 + Math.cos(e.aimAngle) * 16,
            y: e.y + 16 + Math.sin(e.aimAngle) * 16,
            vx: Math.cos(e.aimAngle) * 240,
            vy: Math.sin(e.aimAngle) * 240,
            r: 5
          });
        }
      }

      // Check Player Contact with Enemy
      if (
        p.invulnTimer <= 0 &&
        p.x + p.w - 4 > e.x &&
        p.x + 4 < e.x + e.w &&
        pHitBottom > e.y &&
        pHitTop < e.y + e.h
      ) {
        this._damagePlayer();
        break;
      }
    }

    // Update Defense Wall Boss Attacks
    if (this.boss && this.boss.alive && this.cameraX >= this.bossLockX - 30) {
      this.boss.pulse += dt * 6;
      for (const tur of this.boss.turrets) {
        if (tur.hp <= 0) continue;
        tur.timer -= dt;
        if (tur.timer <= 0) {
          tur.timer = 1.6;
          const ang = Math.atan2(p.y + 20 - tur.y, p.x - tur.x);
          this.enemyBullets.push({
            x: tur.x - 12,
            y: tur.y,
            vx: Math.cos(ang) * 260,
            vy: Math.sin(ang) * 260,
            r: 6
          });
        }
      }

      this.boss.coreTimer -= dt;
      if (this.boss.coreTimer <= 0) {
        this.boss.coreTimer = 2.0;
        // Core lobs arcing plasma fireballs
        this.enemyBullets.push({
          x: this.boss.coreX - 20,
          y: this.boss.coreY,
          vx: -210 - Math.random() * 110,
          vy: -240,
          gravity: 380,
          r: 8
        });
        this.audio.playLaser(360, 140, 0.14);
      }
    }

    // Update Enemy Bullets
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const eb = this.enemyBullets[i];
      if (eb.gravity) eb.vy += eb.gravity * dt;
      eb.x += eb.vx * dt;
      eb.y += eb.vy * dt;

      if (
        eb.x < this.cameraX - 30 ||
        eb.x > this.cameraX + this.width + 30 ||
        eb.y < 38 ||
        eb.y > this.height
      ) {
        this.enemyBullets.splice(i, 1);
        continue;
      }

      if (
        p.invulnTimer <= 0 &&
        eb.x > p.x + 2 &&
        eb.x < p.x + p.w - 2 &&
        eb.y > pHitTop &&
        eb.y < pHitBottom
      ) {
        this.enemyBullets.splice(i, 1);
        this._damagePlayer();
        break;
      }
    }

    this._updateParticles(dt);
  }

  _damagePlayer() {
    this.audio.playHit();
    this.renderer.shake(10, 0.28);
    this._spawnParticles(this.player.x + 12, this.player.y + 20, PALETTE.CYAN, 20, 200);
    this.lives--;
    if (this.lives <= 0) {
      this.audio.playGameOver();
      this.setState('GAMEOVER');
    } else {
      const respawnX = Math.max(this.cameraX + 70, this.player.x - 60);
      this._resetPlayer(respawnX, 140, 'RIFLE');
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
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 32 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear('#07101E');

    // Parallax Jungle Canopy & Alien Mountains
    ctx.fillStyle = '#0B1F1D';
    for (let i = 0; i < 12; i++) {
      const tx = ((i * 220 - this.cameraX * 0.35) % 2400 + 2400) % 2400 - 200;
      ctx.beginPath();
      ctx.arc(tx, 260, 110, Math.PI, 0);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(-Math.floor(this.cameraX), 0);

    // Draw Water Trench along Jungle
    ctx.fillStyle = '#0284C7';
    ctx.fillRect(0, this.waterY, this.bossLockX + 200, this.height - this.waterY);
    this.renderer.drawGlowRect(0, this.waterY, this.bossLockX + 200, 4, PALETTE.CYAN, 8, true);

    // Draw Multi-Tier Jungle Platforms, Ledges, and Bridges
    for (const plat of this.platforms) {
      if (plat.exploded) continue;
      if (plat.type === 'BRIDGE') {
        this.renderer.drawGlowRect(plat.x, plat.y, plat.w, 14, PALETTE.ORANGE, 8, true);
      } else if (plat.type === 'FORTRESS_FLOOR') {
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(plat.x, plat.y, plat.w, 90);
        this.renderer.drawGlowRect(plat.x, plat.y, plat.w, 6, PALETTE.CYAN, 8, true);
      } else {
        // Jungle rock base + vivid green grass top
        ctx.fillStyle = '#78350F';
        ctx.fillRect(plat.x, plat.y, plat.w, 22);
        this.renderer.drawGlowRect(plat.x, plat.y, plat.w, 6, PALETTE.GREEN, 8, true);
      }
    }

    // Draw Defense Wall Boss Fortress at end of sector
    if (this.boss && this.boss.alive) {
      const b = this.boss;
      ctx.fillStyle = '#334155';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      this.renderer.drawGlowRect(b.x, b.y, b.w, b.h, PALETTE.PURPLE, 10, false, 3);

      // Boss Twin Artillery Turrets
      for (const tur of b.turrets) {
        if (tur.hp > 0) {
          this.renderer.drawGlowCircle(tur.x, tur.y, 18, PALETTE.ORANGE, 10, true);
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(tur.x - 24, tur.y - 4, 20, 8);
        }
      }

      // Pulsating Alien Defense Core
      const coreGlow = 12 + Math.sin(b.pulse) * 6;
      this.renderer.drawGlowCircle(b.coreX, b.coreY, b.coreR, PALETTE.RED, coreGlow, true);
      this.renderer.drawGlowCircle(b.coreX, b.coreY, b.coreR * 0.55, PALETTE.GOLD, 8, true);
    }

    // Draw Enemies (Runners, Snipers, Rotating Wall Turrets)
    for (const e of this.enemies) {
      if (e.type === 'TURRET') {
        this.renderer.drawGlowRect(e.x, e.y, e.w, e.h, '#64748B', 6, true);
        this.renderer.drawGlowCircle(e.x + 14, e.y + 16, 11, PALETTE.RED, 8, true);
        ctx.strokeStyle = PALETTE.WHITE;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(e.x + 14, e.y + 16);
        ctx.lineTo(
          e.x + 14 + Math.cos(e.aimAngle) * 18,
          e.y + 16 + Math.sin(e.aimAngle) * 18
        );
        ctx.stroke();
      } else {
        this.renderer.drawGlowRect(
          e.x,
          e.y,
          e.w,
          e.h,
          e.type === 'SNIPER' ? PALETTE.PINK : PALETTE.ORANGE,
          8,
          true
        );
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(e.x + 4, e.y + 4, e.w - 8, 6);
      }
    }

    // Draw Flying Power-Up Capsules & Falcon Weapon Badges
    for (const cap of this.capsules) {
      this.renderer.drawGlowCircle(cap.x, cap.y, 16, PALETTE.RED, 10, true);
      this.renderer.drawText(cap.weaponType, cap.x, cap.y + 4, {
        font: FONTS.HEADER,
        size: 11,
        color: PALETTE.WHITE,
        align: 'center'
      });
    }
    for (const pw of this.powerups) {
      this.renderer.drawGlowRect(pw.x - 14, pw.y - 10, 28, 20, PALETTE.RED, 10, true);
      this.renderer.drawText(pw.weaponType, pw.x, pw.y + 5, {
        font: FONTS.HEADER,
        size: 11,
        color: PALETTE.GOLD,
        align: 'center'
      });
    }

    // Draw Player Commando (Bill Rizer)
    const p = this.player;
    if (p.invulnTimer <= 0 || Math.floor(p.invulnTimer * 14) % 2 === 0) {
      ctx.save();
      if (p.isProne) {
        // Low-profile prone posture
        this.renderer.drawGlowRect(p.x - 8, p.y + p.h - 14, 40, 14, PALETTE.CYAN, 8, true);
        ctx.fillStyle = PALETTE.RED;
        ctx.fillRect(p.x + (p.facing > 0 ? 22 : -6), p.y + p.h - 16, 10, 4);
      } else if (!p.onGround && !p.inWater) {
        // Mid-air somersault spin jump!
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.rotate(p.spinAngle);
        this.renderer.drawGlowCircle(0, 0, 14, PALETTE.CYAN, 10, true);
        ctx.fillStyle = PALETTE.RED;
        ctx.fillRect(-10, -4, 20, 5);
      } else {
        // Standing / Running / Water posture
        const drawH = p.inWater ? 22 : p.h;
        const drawY = p.inWater ? p.y + 16 : p.y;
        this.renderer.drawGlowRect(p.x, drawY, p.w, drawH, PALETTE.CYAN, 8, true);
        // Red Commando Headband
        ctx.fillStyle = PALETTE.RED;
        ctx.fillRect(p.x, drawY + 3, p.w, 5);
        // 8-Way Aimed Rifle Barrel
        const cx = p.x + p.w / 2;
        const cy = drawY + 16;
        ctx.strokeStyle = PALETTE.WHITE;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + p.aimX * 22, cy + p.aimY * 22);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw Player & Enemy Bullets
    for (const b of this.bullets) {
      this.renderer.drawGlowCircle(b.x, b.y, b.r, b.color, 10, true);
    }
    for (const eb of this.enemyBullets) {
      this.renderer.drawGlowCircle(eb.x, eb.y, eb.r, PALETTE.PINK, 10, true);
    }

    // Particles & Popups
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
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

    ctx.restore();

    // Boss Core Health Bar when in Boss Arena
    if (this.boss && this.boss.alive && this.cameraX >= this.bossLockX - 60) {
      const ratio = Math.max(0, this.boss.hp / this.boss.maxHp);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(320, 52, 320, 12);
      this.renderer.drawGlowRect(320, 52, 320 * ratio, 12, PALETTE.RED, 8, true);
      this.renderer.drawText('DEFENSE WALL CORE', 480, 78, {
        font: FONTS.HEADER,
        size: 10,
        color: PALETTE.GOLD,
        align: 'center'
      });
    }

    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `WPN: ${this.player.weapon === 'S' ? 'SPREAD (S)' : this.player.weapon}`,
      accent: PALETTE.RED
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '8-WAY RUN & GUN JUNGLE FORTRESS ASSAULT',
      controls: 'ARROWS: 8-WAY AIM & PRONE  |  Z/SPACE: FIRE  |  X/SHIFT: JUMP (DOWN+X: DROP)',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.RED
    });
  }
}

export default Contra;
