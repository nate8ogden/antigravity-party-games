/**
 * Contra.js
 * Authentic 1987 Side-Scrolling Run-and-Gun Jungle & Alien Fortress Action
 *
 * Features:
 * - Rich arcade/16-bit pixel-art visuals: muscular commando with fluttering red headband,
 *   blue combat pants, 4-frame leg stride, 8-way articulated rifle & muzzle flash,
 *   tucked somersault jump, prone stance, and waist-deep water wading.
 * - Multi-layered Stage 1 Jungle environment: volcanic twilight sky, parallax palm canopies,
 *   animated cliffside waterfalls, chiseled rock strata with serrated jungle turf,
 *   and sequential chain-exploding suspension bridges.
 * - Iconic enemies: Running Red-Tunic Troopers, Aiming Snipers, Armored Hexagonal 12-Way
 *   Rotary Wall Turrets, Winged Falcon Power-Up Capsules ('S' Spread, 'R' Rapid, 'L' Laser),
 *   and the towering Armored Defense Wall Boss Fortress.
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
    this.animTime = 0;

    this.player = null;
    this.platforms = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.capsules = [];
    this.powerups = [];
    this.boss = null;
    this.particles = [];
    this.explosions = [];
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
    this.explosions = [];
    this.popups = [];
    this.stageClearTimer = 0;
    this.runnerSpawnTimer = 1.6;
    this.capsuleTimer = 4.0;

    this._resetPlayer(80, 260, this.player ? this.player.weapon : 'S');

    // Multi-Tier Stage 1 Jungle Cliffs, Rock Ledges & Exploding Suspension Bridges
    this.platforms = [
      { x: 0, y: 340, w: 520, depth: 165, type: 'JUNGLE' },
      { x: 240, y: 245, w: 220, depth: 46, type: 'LEDGE' },
      { x: 530, y: 340, w: 260, depth: 24, type: 'BRIDGE', exploded: false, explodeProgress: 0 },
      { x: 800, y: 390, w: 380, depth: 120, type: 'JUNGLE' },
      { x: 910, y: 280, w: 280, depth: 48, type: 'LEDGE' },
      { x: 1110, y: 190, w: 250, depth: 44, type: 'LEDGE' },
      { x: 1230, y: 350, w: 340, depth: 150, type: 'JUNGLE' },
      { x: 1580, y: 350, w: 260, depth: 24, type: 'BRIDGE', exploded: false, explodeProgress: 0 },
      { x: 1850, y: 410, w: 400, depth: 110, type: 'JUNGLE' },
      { x: 1950, y: 300, w: 260, depth: 46, type: 'LEDGE' },
      { x: 2140, y: 205, w: 260, depth: 44, type: 'LEDGE' },
      { x: 2270, y: 355, w: 380, depth: 150, type: 'JUNGLE' },
      // Boss Arena Ground & Tactical Ledges
      { x: 2520, y: 450, w: 960, depth: 90, type: 'FORTRESS_FLOOR', solid: true },
      { x: 2620, y: 350, w: 180, depth: 38, type: 'LEDGE' },
      { x: 2850, y: 265, w: 170, depth: 38, type: 'LEDGE' }
    ];

    // Populate Snipers & 12-Way Hexagonal Rotary Wall Turrets
    const placements = [
      { x: 380, y: 205, type: 'SNIPER' },
      { x: 700, y: 215, type: 'TURRET' },
      { x: 1050, y: 240, type: 'SNIPER' },
      { x: 1380, y: 312, type: 'TURRET' },
      { x: 1520, y: 220, type: 'TURRET' },
      { x: 2060, y: 260, type: 'SNIPER' },
      { x: 2290, y: 168, type: 'TURRET' },
      { x: 2480, y: 315, type: 'SNIPER' }
    ];

    for (const pl of placements) {
      this.enemies.push({
        type: pl.type,
        x: pl.x,
        y: pl.y,
        w: pl.type === 'TURRET' ? 34 : 26,
        h: pl.type === 'TURRET' ? 34 : 40,
        vx: 0,
        vy: 0,
        hp: pl.type === 'TURRET' ? 5 + this.level : 2,
        maxHp: pl.type === 'TURRET' ? 5 + this.level : 2,
        shootTimer: 1.2 + Math.random(),
        aimAngle: Math.PI,
        hitFlash: 0,
        animPhase: Math.random() * 6
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

    // Iconic Stage 1 Defense Wall Boss Fortress at end of sector
    const baseHp = 55 + this.level * 18;
    this.boss = {
      x: 3240,
      y: 96,
      w: 240,
      h: 354,
      coreX: 3288,
      coreY: 368,
      coreR: 32,
      hp: baseHp,
      maxHp: baseHp,
      alive: true,
      pulse: 0,
      hitFlash: 0,
      roofSniperX: 3268,
      roofSniperY: 60,
      turrets: [
        { x: 3272, y: 252, hp: 16, maxHp: 16, timer: 1.3, recoil: 0, hitFlash: 0 },
        { x: 3338, y: 252, hp: 16, maxHp: 16, timer: 1.9, recoil: 0, hitFlash: 0 }
      ],
      coreTimer: 2.1
    };
  }

  _resetPlayer(x, y, weapon = 'RIFLE') {
    this.player = {
      x,
      y,
      w: 24,
      h: 44,
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
      muzzleFlashTimer: 0,
      invulnTimer: 2.5,
      spinAngle: 0,
      runCycle: 0
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
        vy: Math.sin(a) * spd - 30,
        color,
        size: 3 + Math.random() * 3.5,
        life: 0.4 + Math.random() * 0.35
      });
    }
  }

  _spawnExplosionRing(x, y, radius = 28) {
    this.explosions.push({
      x,
      y,
      maxR: radius,
      life: 0.36,
      maxLife: 0.36
    });
    this._spawnParticles(x, y, '#F97316', 14, 190);
    this._spawnParticles(x, y, '#FEF08A', 8, 130);
  }

  _firePlayerWeapon() {
    const p = this.player;
    const baseAngle = Math.atan2(p.aimY, p.aimX);
    const muzzleX = p.x + p.w / 2 + Math.cos(baseAngle) * 20;
    const muzzleY =
      (p.isProne ? p.y + p.h - 11 : p.inWater ? p.y + 26 : p.y + 16) +
      Math.sin(baseAngle) * 14;

    p.muzzleFlashTimer = 0.065;

    if (p.weapon === 'S') {
      // Iconic 5-Way Spread Shot fan of pulsing red/white energy spheres!
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
          r: 6.5,
          damage: 2,
          type: 'S',
          color: '#EF4444',
          pierce: false
        });
      }
    } else if (p.weapon === 'L') {
      // High-Damage Articulated Cyan/White Laser Beam!
      p.shootCooldown = 0.24;
      this.audio.playLaser(1350, 320, 0.14);
      for (let k = 0; k < 4; k++) {
        this.bullets.push({
          x: muzzleX - Math.cos(baseAngle) * k * 12,
          y: muzzleY - Math.sin(baseAngle) * k * 12,
          vx: Math.cos(baseAngle) * 740,
          vy: Math.sin(baseAngle) * 740,
          r: 5,
          damage: 3.5,
          type: 'L',
           angle: baseAngle,
          color: '#00F0FF',
          pierce: true
        });
      }
    } else {
      // Rapid Machine Gun ('R') or Standard Assault Rifle
      p.shootCooldown = p.weapon === 'R' ? 0.085 : 0.14;
      this.audio.playLaser(760, 260, 0.06);
      this.bullets.push({
        x: muzzleX,
        y: muzzleY,
        vx: Math.cos(baseAngle) * 650,
        vy: Math.sin(baseAngle) * 650,
        r: p.weapon === 'R' ? 5 : 4,
        damage: p.weapon === 'R' ? 2 : 1.5,
        type: p.weapon,
        color: '#FACC15',
        pierce: false
      });
    }
  }

  update(dt) {
    this.animTime += dt;

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
    if (p.muzzleFlashTimer > 0) p.muzzleFlashTimer -= dt;
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
      p.runCycle += dt * 13;
    } else if (right) {
      p.vx = moveSpeed;
      p.facing = 1;
      p.runCycle += dt * 13;
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
        p.dropTimer = 0.22;
        p.onGround = false;
        p.isProne = false;
        p.y += 6;
        this.audio.playMenuMove();
      } else if (p.onGround || p.inWater) {
        p.vy = -490;
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
      p.spinAngle += 17 * dt * p.facing;
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
          prevBottom <= plat.y + 12 &&
          p.y + p.h >= plat.y
        ) {
          p.y = plat.y - p.h;
          p.vy = 0;
          p.onGround = true;
          p.inWater = false;

          // Iconic Contra Stage 1 Suspension Bridge sequential detonation!
          if (plat.type === 'BRIDGE' && p.x > plat.x + 85) {
            plat.exploded = true;
            this.audio.playExplosion(0.45, 900);
            this.renderer.shake(10, 0.28);
            for (let s = 0; s < 4; s++) {
              this._spawnExplosionRing(plat.x + 35 + s * 62, plat.y + 6, 30);
            }
          }
          break;
        }
      }
    }

    // Water Trench Check
    if (!p.onGround && p.y + p.h >= this.waterY && p.x < this.bossLockX) {
      if (!p.inWater) {
        this._spawnParticles(p.x + p.w / 2, this.waterY, PALETTE.CYAN, 12, 130);
      }
      p.y = this.waterY - p.h + 15;
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

    // Spawn Running Red Falcon Troopers
    this.runnerSpawnTimer -= dt;
    if (this.runnerSpawnTimer <= 0 && this.enemies.length < 10) {
      this.enemies.push({
        type: 'RUNNER',
        x: this.cameraX + this.width + 20,
        y: 180,
        w: 24,
        h: 40,
        vx: -175 - this.level * 12,
        vy: 0,
        hp: 1,
        maxHp: 1,
        hitFlash: 0,
        animPhase: Math.random() * 6,
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

    // Update Dropped Winged Falcon Badges
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pw = this.powerups[i];
      pw.vy = Math.min(400, pw.vy + 900 * dt);
      pw.x += pw.vx * dt;
      pw.y += pw.vy * dt;

      for (const plat of this.platforms) {
        if (
          !plat.exploded &&
          pw.x > plat.x &&
          pw.x < plat.x + plat.w &&
          pw.y + 14 >= plat.y &&
          pw.y <= plat.y + 20 &&
          pw.vy > 0
        ) {
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

      if (Math.hypot(p.x + p.w / 2 - pw.x, p.y + p.h / 2 - pw.y) < 30) {
        p.weapon = pw.weaponType;
        this.audio.playPowerUp();
        const names = { S: 'SPREAD GUN (S)!', R: 'RAPID FIRE (R)!', L: 'LASER BEAM (L)!' };
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
          this._spawnExplosionRing(cap.x, cap.y, 24);
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
          e.hitFlash = 0.08;
          this._spawnParticles(b.x, b.y, PALETTE.GOLD, 4, 90);
          if (e.hp <= 0) {
            this.audio.playExplosion(0.25, 1100);
            this._spawnExplosionRing(e.x + e.w / 2, e.y + e.h / 2, 26);
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
          if (tur.hp > 0 && Math.hypot(b.x - tur.x, b.y - tur.y) < 24) {
            tur.hp -= b.damage;
            tur.hitFlash = 0.08;
            this._spawnParticles(b.x, b.y, PALETTE.ORANGE, 5, 110);
            if (tur.hp <= 0) {
              this.audio.playExplosion(0.35, 950);
              this._spawnExplosionRing(tur.x, tur.y, 32);
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
          this.boss.hitFlash = 0.08;
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
            this.renderer.shake(15, 0.5);
            for (let k = 0; k < 5; k++) {
              this._spawnExplosionRing(
                this.boss.coreX + (Math.random() - 0.5) * 90,
                this.boss.coreY - k * 35,
                40
              );
            }
            this._addScore(
              5000 * this.level,
              this.boss.coreX - 80,
              this.boss.coreY - 40,
              PALETTE.GOLD,
              `DEFENSE WALL DESTROYED +${5000 * this.level}!`
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
      if (e.hitFlash > 0) e.hitFlash -= dt;
      e.animPhase += dt * 11;

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
          if (
            !plat.exploded &&
            e.x + e.w > plat.x &&
            e.x < plat.x + plat.w &&
            prevB <= plat.y + 10 &&
            e.y + e.h >= plat.y
          ) {
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
        // SNIPER or 12-Angle Hexagonal Rotary Wall TURRET
        const ang = Math.atan2(p.y + p.h / 2 - (e.y + 17), p.x + p.w / 2 - (e.x + 17));
        e.aimAngle = Math.round(ang / (Math.PI / 6)) * (Math.PI / 6);
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.type === 'TURRET' ? 1.55 : 1.9;
          this.enemyBullets.push({
            x: e.x + 17 + Math.cos(e.aimAngle) * 18,
            y: e.y + 17 + Math.sin(e.aimAngle) * 18,
            vx: Math.cos(e.aimAngle) * 240,
            vy: Math.sin(e.aimAngle) * 240,
            r: 5
          });
        }
      }

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
      if (this.boss.hitFlash > 0) this.boss.hitFlash -= dt;

      for (const tur of this.boss.turrets) {
        if (tur.hitFlash > 0) tur.hitFlash -= dt;
        if (tur.recoil > 0) tur.recoil = Math.max(0, tur.recoil - dt * 28);
        if (tur.hp <= 0) continue;
        tur.timer -= dt;
        if (tur.timer <= 0) {
          tur.timer = 1.6;
          tur.recoil = 7;
          const ang = Math.atan2(p.y + 20 - tur.y, p.x - tur.x);
          this.enemyBullets.push({
            x: tur.x - 16,
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
    this._spawnExplosionRing(this.player.x + 12, this.player.y + 20, 26);
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
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.life -= dt;
      if (ex.life <= 0) this.explosions.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 32 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  /**
   * Draws Stage 1 Jungle Parallax Background: volcanic night sky, distant mountain ridge,
   * palm trees, dense pixel-art canopy leaves, and animated waterfalls.
   */
  _drawJungleBackdrop(ctx) {
    // Deep jungle night sky gradient
    const skyGrad = ctx.createLinearGradient(0, 38, 0, this.height);
    skyGrad.addColorStop(0, '#040B1A');
    skyGrad.addColorStop(0.55, '#071B2C');
    skyGrad.addColorStop(1, '#052E16');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 38, this.width, this.height - 38);

    // Distant volcanic mountain silhouettes (0.18x parallax)
    ctx.fillStyle = '#0B253A';
    ctx.beginPath();
    ctx.moveTo(0, 340);
    for (let mx = 0; mx <= this.width + 160; mx += 120) {
      const worldM = mx + Math.floor(this.cameraX * 0.18);
      const peakY = 165 + Math.sin(worldM * 0.0065) * 48 + Math.cos(worldM * 0.014) * 24;
      ctx.lineTo(mx, peakY);
    }
    ctx.lineTo(this.width, 492);
    ctx.lineTo(0, 492);
    ctx.closePath();
    ctx.fill();

    // Animated Cliffside Waterfalls in background (0.35x parallax)
    for (let i = 0; i < 4; i++) {
      const wfX = ((i * 380 + 180 - this.cameraX * 0.35) % 1520 + 1520) % 1520 - 120;
      ctx.fillStyle = 'rgba(14, 165, 233, 0.25)';
      ctx.fillRect(wfX, 170, 34, 322);
      ctx.fillStyle = 'rgba(186, 230, 253, 0.45)';
      const cascadeOffset = Math.floor(this.animTime * 90) % 24;
      for (let wy = 175 + cascadeOffset; wy < 485; wy += 24) {
        ctx.fillRect(wfX + 4, wy, 8, 12);
        ctx.fillRect(wfX + 18, wy - 8, 10, 12);
      }
    }

    // Lush Jungle Palm Trunks & Layered Foliage Canopy (0.48x parallax)
    for (let i = 0; i < 10; i++) {
      const tx = ((i * 150 - this.cameraX * 0.48) % 1500 + 1500) % 1500 - 120;
      const trunkTop = 140 + (i % 3) * 22;

      // Segmented wooden palm trunk
      ctx.fillStyle = '#451A03';
      ctx.fillRect(tx - 8, trunkTop, 16, 355 - trunkTop);
      ctx.fillStyle = '#78350F';
      for (let by = trunkTop; by < 355; by += 14) {
        ctx.fillRect(tx - 6, by, 10, 9);
      }

      // Multi-layered tropical leaf clusters
      const canopyColors = ['#064E3B', '#047857', '#15803D', '#22C55E'];
      for (let c = 0; c < canopyColors.length; c++) {
        ctx.fillStyle = canopyColors[c];
        const r = 46 - c * 8;
        ctx.beginPath();
        ctx.arc(tx - 22 + c * 6, trunkTop + 8 - c * 3, r, 0, Math.PI * 2);
        ctx.arc(tx + 22 - c * 5, trunkTop + 12 - c * 3, r * 0.9, 0, Math.PI * 2);
        ctx.arc(tx, trunkTop - 10 + c * 2, r * 1.05, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Draws Contra Stage 1 Chiseled Rock Cliffs, Grassy Turf Ledges & Suspension Bridges
   */
  _drawPlatform(ctx, plat) {
    if (plat.exploded) return;

    if (plat.type === 'BRIDGE') {
      // Classic Contra Suspension Bridge with steel cables, wooden planks & support chains
      const segs = Math.floor(plat.w / 26);
      // Overhead suspension cable
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(plat.x, plat.y - 26);
      ctx.quadraticCurveTo(plat.x + plat.w / 2, plat.y - 4, plat.x + plat.w, plat.y - 26);
      ctx.stroke();

      // End support pylons
      ctx.fillStyle = '#475569';
      ctx.fillRect(plat.x - 6, plat.y - 30, 10, 48);
      ctx.fillRect(plat.x + plat.w - 4, plat.y - 30, 10, 48);

      for (let s = 0; s < segs; s++) {
        const sx = plat.x + s * 26;
        // Vertical hanger rod
        ctx.strokeStyle = '#64748B';
        ctx.beginPath();
        ctx.moveTo(sx + 13, plat.y - 16);
        ctx.lineTo(sx + 13, plat.y);
        ctx.stroke();

        // Orange/amber bridge plank segment with steel rivets
        ctx.fillStyle = '#9A3412';
        ctx.fillRect(sx + 1, plat.y, 24, 16);
        ctx.fillStyle = '#F97316';
        ctx.fillRect(sx + 2, plat.y + 2, 22, 6);
        ctx.fillStyle = '#FDE047';
        ctx.fillRect(sx + 5, plat.y + 10, 4, 4);
        ctx.fillRect(sx + 17, plat.y + 10, 4, 4);
      }
      return;
    }

    if (plat.type === 'FORTRESS_FLOOR') {
      // Metallic Alien Base Plating
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(plat.x, plat.y, plat.w, plat.depth || 90);
      ctx.fillStyle = '#334155';
      for (let bx = plat.x; bx < plat.x + plat.w; bx += 48) {
        ctx.fillRect(bx + 2, plat.y + 8, 44, 28);
        ctx.fillStyle = '#64748B';
        ctx.fillRect(bx + 6, plat.y + 12, 4, 4);
        ctx.fillRect(bx + 38, plat.y + 12, 4, 4);
        ctx.fillStyle = '#334155';
      }
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(plat.x, plat.y, plat.w, 6);
      return;
    }

    // Authentic Contra Stage 1 Chiseled Rock Strata + Lush Serrated Green Jungle Turf
    const depth = plat.depth || (plat.type === 'JUNGLE' ? 150 : 44);
    ctx.fillStyle = '#451A03';
    ctx.fillRect(plat.x, plat.y + 8, plat.w, depth - 8);

    // Chiseled brown/amber boulder blocks inside the cliff face
    const brickW = 36;
    const brickH = 20;
    for (let ry = plat.y + 12; ry < plat.y + depth - 6; ry += brickH) {
      const rowOffset = Math.floor((ry - plat.y) / brickH) % 2 === 1 ? 18 : 0;
      for (let rx = plat.x + rowOffset; rx < plat.x + plat.w - 8; rx += brickW) {
        const bw = Math.min(brickW - 3, plat.x + plat.w - rx - 2);
        if (bw <= 6) continue;
        ctx.fillStyle = '#78350F';
        ctx.fillRect(rx + 2, ry, bw, brickH - 3);
        ctx.fillStyle = '#B45309';
        ctx.fillRect(rx + 3, ry + 1, bw - 4, 6);
        ctx.fillStyle = '#D97706';
        ctx.fillRect(rx + 4, ry + 2, bw - 8, 3);
      }
    }

    // Lush Multi-Shaded Green Jungle Turf Overhang on top of rock
    ctx.fillStyle = '#14532D';
    ctx.fillRect(plat.x - 2, plat.y, plat.w + 4, 14);
    ctx.fillStyle = '#16A34A';
    ctx.fillRect(plat.x - 2, plat.y, plat.w + 4, 9);
    ctx.fillStyle = '#4ADE80';
    ctx.fillRect(plat.x, plat.y, plat.w, 4);

    // Serrated hanging grass blades along top edge
    ctx.fillStyle = '#22C55E';
    for (let gx = plat.x + 2; gx < plat.x + plat.w - 6; gx += 12) {
      ctx.fillRect(gx, plat.y + 9, 6, 6);
      ctx.fillStyle = '#15803D';
      ctx.fillRect(gx + 6, plat.y + 11, 5, 5);
      ctx.fillStyle = '#22C55E';
    }
  }

  /**
   * Draws Detailed Pixel-Art Commando (Bill Rizer): muscular tan torso, red headband
   * with fluttering ribbon, blue combat pants, 4-frame pumping legs, and 8-way rifle.
   */
  _drawPlayerCommando(ctx, p) {
    ctx.save();

    if (p.isProne) {
      // Prone low-profile commando lying flat on turf
      const px = Math.floor(p.x - 10);
      const py = Math.floor(p.y + p.h - 16);
      const dir = p.facing >= 0 ? 1 : -1;

      ctx.translate(px + 22, py + 8);
      ctx.scale(dir, 1);

      // Combat boots & blue trousers stretched back
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-22, 2, 7, 6);
      ctx.fillStyle = '#1D4ED8';
      ctx.fillRect(-16, 0, 16, 7);
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(-15, 1, 14, 3);

      // Muscular tan torso & arms forward
      ctx.fillStyle = '#EA580C';
      ctx.fillRect(0, -2, 13, 8);
      ctx.fillStyle = '#FDBA74';
      ctx.fillRect(1, -1, 12, 5);

      // Head & Red Headband
      ctx.fillStyle = '#FDBA74';
      ctx.fillRect(8, -8, 9, 8);
      ctx.fillStyle = '#FACC15'; // Blonde flattop hair
      ctx.fillRect(8, -10, 9, 3);
      ctx.fillStyle = '#EF4444'; // Red headband + tail
      ctx.fillRect(7, -7, 11, 3);
      ctx.fillRect(3, -6, 4, 2);

      // Heavy Assault Rifle barrel
      ctx.fillStyle = '#334155';
      ctx.fillRect(12, -2, 18, 4);
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(24, -1, 8, 2);

      if (p.muzzleFlashTimer > 0) {
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(35, 0, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return;
    }

    if (!p.onGround && !p.inWater) {
      // Iconic Contra tucked somersault spin jump!
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.spinAngle);

      // Blue tucked knees & boots
      ctx.fillStyle = '#1D4ED8';
      ctx.fillRect(-11, 0, 22, 11);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-9, 8, 8, 5);
      // Tan muscular back/chest
      ctx.fillStyle = '#FDBA74';
      ctx.fillRect(-10, -10, 20, 11);
      // Head & Red Headband
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-9, -12, 18, 4);
      // Tucked rifle
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(-13, -3, 26, 4);

      ctx.restore();
      return;
    }

    // Standing, Running, or Waist-Deep in Water
    const cx = Math.floor(p.x + p.w / 2);
    const cy = Math.floor(p.inWater ? p.y + 14 : p.y);
    const dir = p.facing >= 0 ? 1 : -1;
    const stride = Math.abs(p.vx) > 5 ? Math.sin(p.runCycle) : 0;

    // 1. Draw Lower Body (Combat Pants & Boots) unless submerged in water
    if (!p.inWater) {
      ctx.save();
      ctx.translate(cx, cy + 25);
      ctx.scale(dir, 1);

      // Belt
      ctx.fillStyle = '#78350F';
      ctx.fillRect(-7, -2, 14, 3);
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(-2, -2, 4, 3);

      // Left & Right animated legs in blue commando pants
      const leg1X = -6 + stride * 5;
      const leg2X = 1 - stride * 5;
      const leg1Y = Math.max(0, -stride * 3);
      const leg2Y = Math.max(0, stride * 3);

      ctx.fillStyle = '#1E40AF';
      ctx.fillRect(leg2X, 1, 6, 12 - leg2Y);
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(leg2X - 1, 12 - leg2Y, 8, 6);

      ctx.fillStyle = '#2563EB';
      ctx.fillRect(leg1X, 1, 6, 12 - leg1Y);
      ctx.fillStyle = '#60A5FA';
      ctx.fillRect(leg1X + 1, 2, 2, 8);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(leg1X - 1, 12 - leg1Y, 8, 6);
      ctx.restore();
    }

    // 2. Draw Upper Body (Muscular Torso, Head, Red Headband)
    ctx.save();
    ctx.translate(cx, cy + 14);
    ctx.scale(dir, 1);

    // Muscular tan chest & shoulders
    ctx.fillStyle = '#C2410C';
    ctx.fillRect(-8, -3, 16, 14);
    ctx.fillStyle = '#FDBA74';
    ctx.fillRect(-7, -2, 14, 12);
    // Pectoral & ab shading
    ctx.fillStyle = '#EA580C';
    ctx.fillRect(-1, -1, 2, 10);
    ctx.fillRect(-6, 3, 12, 1.5);

    // Head, jaw, blonde flattop & fluttering Red Headband
    ctx.fillStyle = '#FDBA74';
    ctx.fillRect(-5, -13, 11, 10);
    ctx.fillStyle = '#0F172A'; // Eye
    ctx.fillRect(3, -9, 2, 2);
    ctx.fillStyle = '#FACC15'; // Flattop hair
    ctx.fillRect(-6, -16, 12, 4);
    ctx.fillStyle = '#EF4444'; // Iconic Red Headband
    ctx.fillRect(-6, -12, 13, 3);
    // Fluttering headband tails behind head
    const tailWave = Math.sin(this.animTime * 16) * 2;
    ctx.fillRect(-12, -12 + tailWave, 6, 2.5);
    ctx.fillRect(-15, -10 - tailWave, 5, 2);

    ctx.restore();

    // 3. Draw 8-Way Articulated Heavy Assault Rifle & Bicep
    const aimAngle = Math.atan2(p.aimY, p.aimX);
    const shoulderX = cx;
    const shoulderY = cy + 16;

    ctx.save();
    ctx.translate(shoulderX, shoulderY);
    ctx.rotate(aimAngle);

    // Muscular arm holding rifle
    ctx.fillStyle = '#FDBA74';
    ctx.fillRect(0, -3, 11, 6);
    ctx.fillStyle = '#EF4444'; // Red wristband
    ctx.fillRect(8, -3, 3, 6);

    // Heavy Assault Rifle Body, Magazine & Barrel
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(4, -5, 14, 6);
    ctx.fillRect(10, 1, 4, 5); // Curved ammo magazine
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(6, -4, 11, 2.5);
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(18, -3.5, 9, 3); // Steel barrel tip

    // Bright Star Muzzle Flash when firing
    if (p.muzzleFlashTimer > 0) {
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(30, -2, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F97316';
      ctx.fillRect(27, -8, 6, 12);
      ctx.fillRect(24, -5, 13, 6);
    }
    ctx.restore();

    // Water waist splash ring when wading in jungle river
    if (p.inWater) {
      ctx.fillStyle = '#BAE6FD';
      ctx.fillRect(cx - 14, this.waterY - 2, 28, 4);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(cx - 18, this.waterY + 2, 36, 3);
    }

    ctx.restore();
  }

  /**
   * Draws Detailed Contra Enemies: Running Troopers, Aiming Snipers, and
   * 12-Angle Armored Hexagonal Wall Turrets.
   */
  _drawEnemy(ctx, e) {
    const flash = e.hitFlash > 0;

    if (e.type === 'TURRET') {
      // Iconic Contra Armored Hexagonal Rotary Wall Turret
      const tx = e.x + 17;
      const ty = e.y + 17;

      ctx.save();
      ctx.translate(tx, ty);

      // Outer octagonal steel bunker plate
      ctx.fillStyle = flash ? '#FFFFFF' : '#475569';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + Math.PI / 8;
        const r = 18;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner armored ring & rivets
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();

      // Rotating cannon barrel
      ctx.save();
      ctx.rotate(e.aimAngle);
      ctx.fillStyle = '#64748B';
      ctx.fillRect(0, -4, 20, 8);
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(4, -2, 16, 3);
      ctx.restore();

      // Glowing red central targeting core
      ctx.fillStyle = flash ? '#FEF08A' : '#EF4444';
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      return;
    }

    // Humanoid Enemy Soldier (RUNNER or SNIPER)
    const cx = Math.floor(e.x + e.w / 2);
    const cy = Math.floor(e.y);
    const isSniper = e.type === 'SNIPER';
    const facing = isSniper ? (Math.cos(e.aimAngle) >= 0 ? 1 : -1) : -1;
    const stride = isSniper ? 0 : Math.sin(e.animPhase) * 5;

    ctx.save();
    ctx.translate(cx, cy + 22);
    ctx.scale(facing, 1);

    // Legs & Boots
    ctx.fillStyle = flash ? '#FFFFFF' : isSniper ? '#1E3A8A' : '#14532D';
    ctx.fillRect(-5 + stride, 2, 5, 13);
    ctx.fillRect(0 - stride, 2, 5, 13);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(-6 + stride, 13, 7, 5);
    ctx.fillRect(-1 - stride, 13, 7, 5);

    // Armored Tunic Torso (Crimson for Sniper, Olive/Orange for Runner)
    ctx.fillStyle = flash ? '#FFFFFF' : isSniper ? '#DC2626' : '#EA580C';
    ctx.fillRect(-7, -10, 14, 13);
    ctx.fillStyle = '#FDE047'; // Chest harness strap
    ctx.fillRect(-5, -9, 3, 11);

    // Helmet & Visor
    ctx.fillStyle = '#FDBA74';
    ctx.fillRect(-4, -18, 9, 8);
    ctx.fillStyle = isSniper ? '#991B1B' : '#15803D';
    ctx.fillRect(-6, -21, 12, 5);
    ctx.fillStyle = '#0F172A'; // Visor goggles
    ctx.fillRect(1, -16, 4, 3);

    ctx.restore();

    // Sniper / Trooper Rifle
    if (isSniper) {
      ctx.save();
      ctx.translate(cx, cy + 15);
      ctx.rotate(e.aimAngle);
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, -3, 19, 5);
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(12, -2, 8, 2);
      ctx.restore();
    } else {
      ctx.fillStyle = '#334155';
      ctx.fillRect(cx - 14, cy + 14, 14, 4);
    }
  }

  /**
   * Draws Winged Falcon Power-Up Capsules & Badges
   */
  _drawFalconBadge(ctx, x, y, letter, isBlimp = false) {
    ctx.save();
    ctx.translate(Math.floor(x), Math.floor(y));

    if (isBlimp) {
      // Metallic silver/red oval flying capsule pod with fins
      ctx.fillStyle = '#94A3B8';
      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Tail fins
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-22, -10, 6, 20);
      // Central glowing red window
      ctx.beginPath();
      ctx.arc(2, 0, 9, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Iconic Winged Falcon Weapon Badge
      ctx.fillStyle = '#FACC15';
      // Left & Right spread falcon wings
      ctx.beginPath();
      ctx.moveTo(-18, -8);
      ctx.lineTo(-8, -2);
      ctx.lineTo(-15, 7);
      ctx.lineTo(15, 7);
      ctx.lineTo(8, -2);
      ctx.lineTo(18, -8);
      ctx.closePath();
      ctx.fill();

      // Red Octagonal Emblem Center
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(-10, -9, 20, 18);
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-10, -9, 20, 18);
    }

    this.renderer.drawText(letter, 0, 4, {
      font: FONTS.HEADER,
      size: 10,
      color: '#FFFFFF',
      align: 'center'
    });

    ctx.restore();
  }

  /**
   * Draws Stage 1 End Boss: The Armored Defense Wall Fortress
   */
  _drawDefenseWallBoss(ctx, b) {
    ctx.save();

    // Towering multi-tiered steel fortress wall
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(b.x, b.y, b.w, b.h);

    // Metallic steel armor panels & rivets
    for (let py = b.y + 12; py < b.y + b.h - 16; py += 42) {
      ctx.fillStyle = '#334155';
      ctx.fillRect(b.x + 12, py, b.w - 24, 36);
      ctx.fillStyle = '#475569';
      ctx.fillRect(b.x + 16, py + 4, b.w - 32, 10);
      // Rivets
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(b.x + 18, py + 6, 4, 4);
      ctx.fillRect(b.x + b.w - 22, py + 6, 4, 4);
    }

    // Top Fortress Battlement & Roof Sniper
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(b.x - 10, b.y - 12, b.w + 20, 18);
    // Hazard stripes along upper beam
    for (let hx = b.x; hx < b.x + b.w - 12; hx += 24) {
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(hx, b.y + 8, 12, 8);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(hx + 12, b.y + 8, 12, 8);
    }

    // Twin Heavy Artillery Cannons with Recoil
    for (const tur of b.turrets) {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(tur.x - 18, tur.y - 18, 36, 36);
      if (tur.hp > 0) {
        ctx.fillStyle = tur.hitFlash > 0 ? '#FFFFFF' : '#64748B';
        ctx.beginPath();
        ctx.arc(tur.x, tur.y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Twin gun barrels with recoil offset
        const rx = tur.recoil || 0;
        ctx.fillStyle = '#334155';
        ctx.fillRect(tur.x - 28 + rx, tur.y - 7, 22, 5);
        ctx.fillRect(tur.x - 28 + rx, tur.y + 2, 22, 5);
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(tur.x - 26 + rx, tur.y - 6, 16, 2);
        ctx.fillRect(tur.x - 26 + rx, tur.y + 3, 16, 2);
      } else {
        // Destroyed smoking cannon socket
        ctx.fillStyle = '#451A03';
        ctx.beginPath();
        ctx.arc(tur.x, tur.y, 13, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Pulsating Biomechanical Red/Gold Core Door at Base of Wall
    const pulseR = b.coreR + Math.sin(b.pulse) * 3;
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(b.coreX, b.coreY, b.coreR + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = b.hitFlash > 0 ? '#FFFFFF' : '#DC2626';
    ctx.beginPath();
    ctx.arc(b.coreX, b.coreY, pulseR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = b.hitFlash > 0 ? '#FEF08A' : '#F97316';
    ctx.beginPath();
    ctx.arc(b.coreX, b.coreY, pulseR * 0.68, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(b.coreX - 4, b.coreY - 4, pulseR * 0.34, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  render(ctx = this.renderer.ctx) {
    // 1. Multi-layer Parallax Stage 1 Jungle & Waterfall Backdrop
    this._drawJungleBackdrop(ctx);

    ctx.save();
    ctx.translate(-Math.floor(this.cameraX), 0);

    // 2. Draw Jungle River Trench with Shimmering Waves
    const waterGrad = ctx.createLinearGradient(0, this.waterY, 0, this.height);
    waterGrad.addColorStop(0, '#0284C7');
    waterGrad.addColorStop(0.4, '#0369A1');
    waterGrad.addColorStop(1, '#082F49');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, this.waterY, this.bossLockX + 200, this.height - this.waterY);

    // Animated white/cyan wave crests along water surface
    ctx.fillStyle = '#7DD3FC';
    ctx.fillRect(0, this.waterY, this.bossLockX + 200, 3);
    const waveShift = Math.floor(this.animTime * 45) % 36;
    ctx.fillStyle = '#E0F2FE';
    for (let wx = this.cameraX - 40 + waveShift; wx < this.cameraX + this.width + 40; wx += 36) {
      ctx.fillRect(wx, this.waterY + 1, 16, 3);
      ctx.fillRect(wx + 14, this.waterY + 12, 12, 2);
    }

    // 3. Draw Multi-Tier Jungle Cliffs, Grassy Ledges, and Suspension Bridges
    for (const plat of this.platforms) {
      this._drawPlatform(ctx, plat);
    }

    // 4. Draw Defense Wall Boss Fortress at end of sector
    if (this.boss && this.boss.alive) {
      this._drawDefenseWallBoss(ctx, this.boss);
    }

    // 5. Draw Enemies (Runners, Snipers, Hexagonal Rotary Wall Turrets)
    for (const e of this.enemies) {
      this._drawEnemy(ctx, e);
    }

    // 6. Draw Winged Falcon Power-Up Capsules & Dropped Weapon Badges
    for (const cap of this.capsules) {
      this._drawFalconBadge(ctx, cap.x, cap.y, cap.weaponType, true);
    }
    for (const pw of this.powerups) {
      this._drawFalconBadge(ctx, pw.x, pw.y, pw.weaponType, false);
    }

    // 7. Draw Player Commando (Bill Rizer)
    const p = this.player;
    if (p.invulnTimer <= 0 || Math.floor(p.invulnTimer * 14) % 2 === 0) {
      this._drawPlayerCommando(ctx, p);
    }

    // 8. Draw Player & Enemy Bullets (Authentic Spread Orbs & Lasers)
    for (const b of this.bullets) {
      if (b.type === 'S') {
        // Iconic Contra Spread Shot red/white concentric energy orb
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(b.x - 1, b.y - 1, b.r * 0.48, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.type === 'L') {
        ctx.fillStyle = '#00F0FF';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(b.x - 1, b.y - 1, 2, 2);
      }
    }

    for (const eb of this.enemyBullets) {
      ctx.fillStyle = '#FB923C';
      ctx.beginPath();
      ctx.arc(eb.x, eb.y, eb.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(eb.x - 1, eb.y - 1, eb.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    // 9. Draw Expanding Explosion Fireballs & Particles
    for (const ex of this.explosions) {
      const t = 1 - ex.life / ex.maxLife;
      const r = ex.maxR * (0.35 + 0.65 * t);
      ctx.save();
      ctx.globalAlpha = Math.max(0, ex.life / ex.maxLife);
      ctx.fillStyle = '#EA580C';
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

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
