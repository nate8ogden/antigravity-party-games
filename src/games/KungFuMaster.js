/**
 * KungFuMaster.js
 * Classic 1984 Irem Martial Arts Beat-'Em-Up ("Dragon Dojo" / Spartan X).
 * Features 5 floors of the Devil's Temple, 6 distinct martial arts strikes
 * (Standing/Crouching/Jumping Punch & Kick), Grippers that latch on (mash Left/Right
 * to shake off!), Knife Throwers (high & low daggers), acrobatic Tom-Toms,
 * falling Dragon Pots, and 5 iconic Temple Bosses with dual Player vs. Boss health bars.
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const BOSS_DEFS = [
  { floor: 1, name: 'STICK MASTER WANG', hp: 100, color: '#F59E0B', weapon: 'staff' },
  { floor: 2, name: 'BOOMERANG GIANT', hp: 120, color: '#10B981', weapon: 'boomerang' },
  { floor: 3, name: 'IRON TITAN', hp: 140, color: '#38BDF8', weapon: 'smash' },
  { floor: 4, name: 'SHADOW MAGICIAN', hp: 150, color: '#B829FF', weapon: 'magic' },
  { floor: 5, name: 'GRANDMASTER MR. X', hp: 180, color: '#FF2A55', weapon: 'master' }
];

export class KungFuMaster {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'kungfumaster';
    this.title = 'Dragon Dojo';

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1; // Floor 1..5 cycling

    this.groundY = 448;
    this.corridorLength = 2100;
    this.cameraX = 0;

    this.player = null;
    this.boss = null;
    this.enemies = [];
    this.projectiles = [];
    this.dragonPots = [];
    this.particles = [];
    this.popups = [];

    this.spawnTimer = 0;
    this.potTimer = 0;
    this.floorTimer = 60;
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
    this.initFloor(this.level);
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
        vy: -38,
        life: 0.95,
        maxLife: 0.95,
        color
      });
    }
  }

  initFloor(level) {
    this.cameraX = 0;
    this.enemies = [];
    this.projectiles = [];
    this.dragonPots = [];
    this.particles = [];
    this.popups = [];
    this.spawnTimer = 0.8;
    this.potTimer = 2.4;
    this.floorTimer = 60;
    this.stageClearTimer = 0;
    this.deathTimer = 0;

    this.player = {
      x: 160,
      y: this.groundY,
      vy: 0,
      facing: 1,
      speed: 195,
      hp: 100,
      maxHp: 100,
      grounded: true,
      crouching: false,
      attackType: null, // 'punch' | 'kick'
      attackHeight: 'high', // 'high' | 'low' | 'air'
      attackTimer: 0,
      attackHitDone: false,
      grabbedCount: 0,
      shakeEscapeProgress: 0,
      invulnTimer: 0,
      animFrame: 0
    };

    const bossDef = BOSS_DEFS[(level - 1) % BOSS_DEFS.length];
    const scale = 1 + Math.floor((level - 1) / 5) * 0.25;
    this.boss = {
      name: bossDef.name,
      weapon: bossDef.weapon,
      color: bossDef.color,
      x: this.corridorLength - 180,
      y: this.groundY,
      facing: -1,
      hp: Math.round(bossDef.hp * scale),
      maxHp: Math.round(bossDef.hp * scale),
      active: false,
      defeated: false,
      attackTimer: 1.2,
      pose: 'idle', // 'idle' | 'strike' | 'guardLow' | 'guardHigh'
      poseTimer: 0
    };
  }

  spawnEnemy() {
    if (this.enemies.length >= 6 || this.boss.active) return;
    const p = this.player;
    // Spawn from ahead (70%) or behind (30%)
    const fromRight = Math.random() < 0.72;
    const sx = fromRight
      ? Math.min(this.corridorLength - 80, this.cameraX + 980)
      : Math.max(40, this.cameraX - 20);

    const roll = Math.random();
    let type = 'gripper';
    if (roll < 0.24) type = 'knifethrower';
    else if (roll < 0.44) type = 'tomtom';

    this.enemies.push({
      type,
      x: sx,
      y: this.groundY,
      vy: 0,
      facing: fromRight ? -1 : 1,
      speed: type === 'tomtom' ? 145 : type === 'knifethrower' ? 105 : 128 + this.level * 5,
      hp: type === 'knifethrower' ? 2 : 1,
      latched: false,
      throwCooldown: 1.4,
      leaping: false,
      knockoutVy: 0,
      knockoutVx: 0,
      dead: false
    });
  }

  spawnDragonPot() {
    const px = this.cameraX + 180 + Math.random() * 620;
    this.dragonPots.push({
      x: px,
      y: 92,
      vy: 0,
      falling: false,
      warnTimer: 0.75
    });
  }

  damagePlayer(amount, label = null) {
    const p = this.player;
    if (p.invulnTimer > 0 || this.deathTimer > 0 || this.stageClearTimer > 0) return;
    p.hp = Math.max(0, p.hp - amount);
    this.audio.playHit();
    this.renderer.shake(5, 0.16);
    if (label) {
      this.popups.push({
        text: label,
        x: p.x - this.cameraX,
        y: p.y - 68,
        vy: -30,
        life: 0.85,
        maxLife: 0.85,
        color: PALETTE.RED
      });
    }
    if (p.hp <= 0) {
      this.killPlayer();
    }
  }

  killPlayer() {
    if (this.deathTimer > 0 || this.stageClearTimer > 0) return;
    this.lives--;
    this.audio.playExplosion(0.38, 700);
    this.renderer.shake(10, 0.32);

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.audio.playGameOver();
      this.state = 'GAMEOVER';
    } else {
      this.deathTimer = 1.3;
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
        this.initFloor(this.level);
      }
      return;
    }

    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.player.hp = this.player.maxHp;
        this.player.grabbedCount = 0;
        this.enemies = [];
        this.projectiles = [];
      }
      return;
    }

    this.floorTimer = Math.max(0, this.floorTimer - dt);
    if (this.floorTimer <= 0) {
      this.killPlayer();
      return;
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(0.85, 1.85 - this.level * 0.1);
      this.spawnEnemy();
    }

    if (this.level >= 2) {
      this.potTimer -= dt;
      if (this.potTimer <= 0) {
        this.potTimer = 2.8;
        this.spawnDragonPot();
      }
    }

    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateProjectilesAndPots(dt);

    this.cameraX = Math.max(0, Math.min(this.corridorLength - 960, this.player.x - 360));
  }

  updatePlayer(dt) {
    const p = this.player;
    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);

    // Count latched Grippers
    const latchedEnemies = this.enemies.filter((e) => e.latched && !e.dead);
    p.grabbedCount = latchedEnemies.length;

    if (p.grabbedCount > 0) {
      // Drain player health while grabbed! Mash Left/Right/Action to shake off!
      p.hp = Math.max(0, p.hp - p.grabbedCount * 11 * dt);
      if (p.hp <= 0) {
        this.killPlayer();
        return;
      }
      if (
        this.input.isJustPressed('left') ||
        this.input.isJustPressed('right') ||
        this.input.isJustPressed('actionA') ||
        this.input.isJustPressed('actionB')
      ) {
        p.shakeEscapeProgress++;
        this.audio.playShove();
        if (p.shakeEscapeProgress >= 4) {
          p.shakeEscapeProgress = 0;
          // Throw off all latched Grippers!
          for (const le of latchedEnemies) {
            le.latched = false;
            le.dead = true;
            le.knockoutVx = (le.x < p.x ? -1 : 1) * 240;
            le.knockoutVy = -260;
            this.addScore(100, le.x - this.cameraX, le.y - 45, PALETTE.CYAN, 'THROW OFF');
          }
          p.invulnTimer = 0.45;
        }
      }
      return;
    }

    // Crouch & Jump
    p.crouching = p.grounded && this.input.isDown('down');
    if (p.grounded && this.input.isJustPressed('up')) {
      p.grounded = false;
      p.crouching = false;
      p.vy = -420;
      this.audio.playHop();
    }

    if (!p.grounded) {
      p.vy += 940 * dt;
      p.y += p.vy * dt;
      if (p.y >= this.groundY) {
        p.y = this.groundY;
        p.vy = 0;
        p.grounded = true;
      }
    }

    // Trigger Punch (Action A) or Kick (Action B)
    if (p.attackTimer <= 0) {
      const wantPunch = this.input.isJustPressed('actionA') || this.input.pointer.justPressed;
      const wantKick = this.input.isJustPressed('actionB');
      if (wantPunch || wantKick) {
        p.attackType = wantPunch ? 'punch' : 'kick';
        p.attackHeight = !p.grounded ? 'air' : p.crouching ? 'low' : 'high';
        p.attackTimer = wantPunch ? 0.19 : 0.24;
        p.attackHitDone = false;
        this.audio.playSlap();
      }
    } else {
      p.attackTimer -= dt;
      if (!p.attackHitDone && p.attackTimer < 0.14) {
        p.attackHitDone = true;
        this.resolvePlayerStrike();
      }
    }

    // Horizontal walking (cannot walk while crouching or standing-striking)
    if (!p.crouching && (p.attackTimer <= 0 || !p.grounded)) {
      if (this.input.isDown('left')) {
        p.facing = -1;
        p.x = Math.max(48, p.x - p.speed * dt);
        p.animFrame += dt * 14;
      } else if (this.input.isDown('right')) {
        p.facing = 1;
        const maxRight = this.boss && !this.boss.defeated ? this.boss.x - 36 : this.corridorLength - 60;
        p.x = Math.min(maxRight, p.x + p.speed * dt);
        p.animFrame += dt * 14;
      }
    }
  }

  resolvePlayerStrike() {
    const p = this.player;
    const reach = p.attackType === 'kick' ? 66 : 52;
    const hitCenterX = p.x + p.facing * (reach * 0.55);
    const hitY = p.attackHeight === 'low' ? p.y - 18 : p.y - 44;

    // 1. Check hitting regular enemies
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.abs(e.x - hitCenterX) <= reach * 0.65 && Math.abs((e.y - 32) - hitY) <= 44) {
        e.hp--;
        if (e.hp <= 0) {
          e.dead = true;
          e.knockoutVx = p.facing * 260;
          e.knockoutVy = -270;
          const pts = p.attackType === 'punch' ? 200 : 100;
          this.addScore(
            pts,
            e.x - this.cameraX,
            e.y - 52,
            PALETTE.GOLD,
            p.attackType === 'punch' ? 'KUNG-FU PUNCH' : 'SNAP KICK'
          );
          this.audio.playShove();
        } else {
          e.x += p.facing * 28;
          this.audio.playHit();
        }
      }
    }

    // 2. Check deflecting daggers / projectiles with strikes!
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      if (Math.abs(pr.x - hitCenterX) < 38 && Math.abs(pr.y - hitY) < 28) {
        this.projectiles.splice(i, 1);
        this.addScore(150, pr.x - this.cameraX, pr.y, PALETTE.CYAN, 'DEFLECT!');
        this.audio.playCoin();
      }
    }

    // 3. Check hitting the Floor Boss!
    if (this.boss && this.boss.active && !this.boss.defeated) {
      const b = this.boss;
      if (Math.abs(b.x - hitCenterX) <= reach * 0.75) {
        // Boss blocks if guarding at same height
        const blocked =
          (b.pose === 'guardHigh' && p.attackHeight !== 'low') ||
          (b.pose === 'guardLow' && p.attackHeight === 'low');

        if (blocked) {
          this.audio.playDig();
          this.popups.push({
            text: 'GUARDED!',
            x: b.x - this.cameraX,
            y: b.y - 68,
            vy: -30,
            life: 0.6,
            maxLife: 0.6,
            color: PALETTE.MUTED
          });
        } else {
          const dmg = p.attackType === 'punch' ? 18 : 14;
          b.hp = Math.max(0, b.hp - dmg);
          b.x = Math.min(this.corridorLength - 70, b.x + p.facing * 18);
          this.audio.playShove();
          this.renderer.shake(6, 0.16);
          this.addScore(300, b.x - this.cameraX, b.y - 64, PALETTE.GOLD, 'BOSS HIT');

          if (b.hp <= 0) {
            b.defeated = true;
            const timeBonus = Math.floor(this.floorTimer) * 50;
            this.addScore(2000 + timeBonus, b.x - this.cameraX, b.y - 75, PALETTE.GREEN, 'FLOOR BOSS DEFEATED!');
            this.audio.playStageClear();
            this.stageClearTimer = 1.75;
          }
        }
      }
    }
  }

  updateEnemies(dt) {
    const p = this.player;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) {
        e.x += e.knockoutVx * dt;
        e.y += e.knockoutVy * dt;
        e.knockoutVy += 880 * dt;
        if (e.y > 560) this.enemies.splice(i, 1);
        continue;
      }

      if (e.latched) {
        e.x = p.x + (e.facing < 0 ? 14 : -14);
        e.y = p.y;
        continue;
      }

      e.facing = p.x >= e.x ? 1 : -1;
      const dist = Math.abs(p.x - e.x);

      if (e.type === 'gripper') {
        e.x += e.facing * e.speed * dt;
        if (dist < 20 && Math.abs(p.y - e.y) < 28) {
          e.latched = true;
          this.audio.playHit();
        }
      } else if (e.type === 'tomtom') {
        if (!e.leaping && dist < 110 && dist > 45) {
          e.leaping = true;
          e.vy = -340;
          this.audio.playHop();
        }
        e.x += e.facing * e.speed * dt;
        if (e.leaping) {
          e.vy += 820 * dt;
          e.y += e.vy * dt;
          if (e.y >= this.groundY) {
            e.y = this.groundY;
            e.vy = 0;
            e.leaping = false;
          }
        }
        if (dist < 18 && Math.abs((p.y - 26) - (e.y - 20)) < 24) {
          this.damagePlayer(14, 'TOM-TOM HEADBUTT!');
          e.dead = true;
          e.knockoutVx = -e.facing * 180;
          e.knockoutVy = -200;
        }
      } else if (e.type === 'knifethrower') {
        if (dist > 220) {
          e.x += e.facing * e.speed * dt;
        } else if (dist < 130) {
          e.x -= e.facing * e.speed * 0.7 * dt;
        }
        e.throwCooldown -= dt;
        if (e.throwCooldown <= 0) {
          e.throwCooldown = 1.65;
          const isLow = Math.random() < 0.45;
          this.projectiles.push({
            x: e.x + e.facing * 16,
            y: isLow ? this.groundY - 18 : this.groundY - 46,
            vx: e.facing * 290,
            isLow,
            isBoomerang: false,
            timer: 3.0
          });
          this.audio.playLaser(780, 420, 0.06);
        }
      }
    }
  }

  updateBoss(dt) {
    const b = this.boss;
    const p = this.player;
    if (!b || b.defeated) return;

    if (p.x >= this.corridorLength - 580) {
      b.active = true;
    }
    if (!b.active) return;

    b.facing = p.x < b.x ? -1 : 1;
    const dist = Math.abs(p.x - b.x);

    if (b.poseTimer > 0) {
      b.poseTimer -= dt;
      if (b.poseTimer <= 0) b.pose = 'idle';
    }

    // Approach or space relative to Thomas
    if (dist > 78) {
      b.x += b.facing * 98 * dt;
    } else if (dist < 46) {
      b.x -= b.facing * 75 * dt;
    }

    b.attackTimer -= dt;
    if (b.attackTimer <= 0) {
      b.attackTimer = Math.max(0.75, 1.35 - this.level * 0.08);
      const roll = Math.random();
      if (roll < 0.32) {
        b.pose = Math.random() < 0.5 ? 'guardHigh' : 'guardLow';
        b.poseTimer = 0.65;
      } else if (b.weapon === 'boomerang' || b.weapon === 'magic') {
        b.pose = 'strike';
        b.poseTimer = 0.4;
        const isLow = Math.random() < 0.5;
        this.projectiles.push({
          x: b.x + b.facing * 20,
          y: isLow ? this.groundY - 20 : this.groundY - 48,
          vx: b.facing * 280,
          isLow,
          isBoomerang: true,
          timer: 2.6
        });
        this.audio.playLaser(520, 220, 0.1);
      } else {
        b.pose = 'strike';
        b.poseTimer = 0.35;
        if (dist < 82) {
          this.damagePlayer(18, `${b.name} STRIKE!`);
        }
      }
    }
  }

  updateProjectilesAndPots(dt) {
    const p = this.player;
    const playerTop = p.crouching ? p.y - 30 : p.y - 58;
    const playerBot = p.y;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.x += pr.vx * dt;
      pr.timer -= dt;
      if (pr.isBoomerang && pr.timer < 1.3 && !pr.reversed) {
        pr.reversed = true;
        pr.vx *= -1;
      }

      if (Math.abs(pr.x - p.x) < 16 && pr.y >= playerTop && pr.y <= playerBot) {
        this.projectiles.splice(i, 1);
        this.damagePlayer(16, pr.isBoomerang ? 'BOOMERANG HIT!' : 'DAGGER HIT!');
        continue;
      }

      if (pr.timer <= 0 || pr.x < this.cameraX - 60 || pr.x > this.cameraX + 1020) {
        this.projectiles.splice(i, 1);
      }
    }

    for (let i = this.dragonPots.length - 1; i >= 0; i--) {
      const pot = this.dragonPots[i];
      if (!pot.falling) {
        pot.warnTimer -= dt;
        if (pot.warnTimer <= 0) pot.falling = true;
      } else {
        pot.vy += 650 * dt;
        pot.y += pot.vy * dt;
        if (Math.abs(pot.x - p.x) < 20 && Math.abs(pot.y - (p.y - 30)) < 26) {
          this.dragonPots.splice(i, 1);
          this.damagePlayer(15, 'DRAGON POT!');
          continue;
        }
        if (pot.y >= this.groundY) {
          this.dragonPots.splice(i, 1);
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
    this.renderer.clear('#120B1D');

    this.drawTempleBackground(ctx);
    this.drawHealthBars(ctx);
    this.drawDragonPots(ctx);
    this.drawEnemies(ctx);
    this.drawBoss(ctx);
    this.drawPlayer(ctx);
    this.drawProjectiles(ctx);
    this.drawEffects(ctx);

    const floorNum = ((this.level - 1) % 5) + 1;
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `FLOOR:${floorNum}/5  TIME:${Math.ceil(this.floorTimer)}`,
      accent: PALETTE.RED
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: "1984 DEVIL'S TEMPLE MARTIAL ARTS",
      controls: 'ARROWS: WALK/JUMP/CROUCH  |  Z/SPACE: PUNCH  |  X/SHIFT: KICK',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.RED
    });
  }

  drawTempleBackground(ctx) {
    ctx.save();
    // Ornate upper beams
    ctx.fillStyle = '#7F1D1D';
    ctx.fillRect(0, 82, 960, 14);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(0, 94, 960, 3);

    // Repeating Shoji Paper Screens & Crimson Temple Pillars
    const spacing = 180;
    const startPillar = Math.floor(this.cameraX / spacing) * spacing;
    for (let wx = startPillar; wx < this.cameraX + 1040; wx += spacing) {
      const sx = wx - this.cameraX;
      // Shoji lattice panel
      ctx.fillStyle = '#FEF3C7';
      ctx.fillRect(sx + 28, 120, 124, 290);
      ctx.strokeStyle = '#92400E';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 28, 120, 124, 290);
      for (let gy = 160; gy < 400; gy += 48) {
        ctx.beginPath();
        ctx.moveTo(sx + 28, gy);
        ctx.lineTo(sx + 152, gy);
        ctx.stroke();
      }

      // Crimson lacquered pillar
      ctx.fillStyle = '#B91C1C';
      ctx.fillRect(sx, 96, 24, 352);
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(sx - 2, 96, 28, 10);
      ctx.fillRect(sx - 2, 438, 28, 10);
    }

    // Temple tatami / wood floor
    ctx.fillStyle = '#78350F';
    ctx.fillRect(0, this.groundY, 960, 92);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(0, this.groundY, 960, 5);

    // Stairs to next floor at right end
    const stairX = this.corridorLength - 110 - this.cameraX;
    if (stairX < 980) {
      for (let s = 0; s < 6; s++) {
        ctx.fillStyle = '#D97706';
        ctx.fillRect(stairX + s * 18, this.groundY - (s + 1) * 22, 90, 22);
      }
    }
    ctx.restore();
  }

  drawHealthBars(ctx) {
    ctx.save();
    // Player (THOMAS) Health Bar
    this.renderer.drawText('THOMAS', 28, 66, {
      font: FONTS.HEADER,
      size: 9,
      color: PALETTE.GOLD
    });
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(110, 54, 210, 14);
    ctx.fillStyle = PALETTE.GOLD;
    ctx.fillRect(110, 54, 210 * (this.player.hp / this.player.maxHp), 14);
    ctx.strokeStyle = PALETTE.WHITE;
    ctx.strokeRect(110, 54, 210, 14);

    // Temple Boss Health Bar
    if (this.boss) {
      this.renderer.drawText('MASTER', 865, 66, {
        font: FONTS.HEADER,
        size: 9,
        color: PALETTE.RED
      });
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(640, 54, 210, 14);
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(640, 54, 210 * (this.boss.hp / this.boss.maxHp), 14);
      ctx.strokeStyle = PALETTE.WHITE;
      ctx.strokeRect(640, 54, 210, 14);
    }

    if (this.player.grabbedCount > 0) {
      this.renderer.drawText('GRABBED! MASH LEFT / RIGHT TO SHAKE OFF!', 480, 68, {
        font: FONTS.HEADER,
        size: 9.5,
        color: PALETTE.CYAN,
        align: 'center',
        glow: 8
      });
    }
    ctx.restore();
  }

  drawFighter(ctx, x, y, facing, height, giColor, beltColor, attackType, attackHeight) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);

    // Legs
    ctx.fillStyle = giColor;
    ctx.fillRect(-10, -22, 8, 22);
    ctx.fillRect(2, -22, 8, 22);

    // Torso Gi & Black Belt
    const bodyH = height - 22;
    ctx.fillStyle = giColor;
    ctx.fillRect(-12, -height, 24, bodyH);
    ctx.fillStyle = beltColor;
    ctx.fillRect(-13, -26, 26, 5);

    // Head & Headband
    ctx.fillStyle = '#FDBA74';
    ctx.fillRect(-8, -height - 16, 16, 15);
    ctx.fillStyle = PALETTE.RED;
    ctx.fillRect(-9, -height - 13, 18, 4);

    // Extended Strike Limb (Punch or Kick)
    if (attackType === 'punch') {
      const py = attackHeight === 'low' ? -22 : -height + 8;
      ctx.fillStyle = giColor;
      ctx.fillRect(10, py, 24, 7);
      ctx.fillStyle = '#FDBA74';
      ctx.fillRect(32, py - 1, 9, 9);
    } else if (attackType === 'kick') {
      const ky = attackHeight === 'low' ? -12 : -height + 12;
      ctx.fillStyle = giColor;
      ctx.fillRect(8, ky, 34, 9);
      ctx.fillStyle = '#FDBA74';
      ctx.fillRect(40, ky - 2, 8, 11);
    }

    ctx.restore();
  }

  drawPlayer(ctx) {
    if (this.deathTimer > 0) return;
    const p = this.player;
    const sx = p.x - this.cameraX;
    const h = p.crouching ? 34 : 52;
    this.drawFighter(
      ctx,
      sx,
      p.y,
      p.facing,
      h,
      '#F8FAFC',
      '#0B0F19',
      p.attackTimer > 0 ? p.attackType : null,
      p.attackHeight
    );
  }

  drawEnemies(ctx) {
    for (const e of this.enemies) {
      const sx = e.x - this.cameraX;
      if (sx < -60 || sx > 1020) continue;
      const h = e.type === 'tomtom' ? 30 : 50;
      const gi = e.type === 'knifethrower' ? '#38BDF8' : e.type === 'tomtom' ? '#F472B6' : '#A855F7';
      this.drawFighter(ctx, sx, e.y, e.facing, h, gi, '#FACC15', null, 'high');
    }
  }

  drawBoss(ctx) {
    const b = this.boss;
    if (!b || b.defeated) return;
    const sx = b.x - this.cameraX;
    if (sx < -80 || sx > 1040) return;

    this.drawFighter(
      ctx,
      sx,
      b.y,
      b.facing,
      58,
      b.color,
      '#FFD700',
      b.pose === 'strike' ? 'punch' : null,
      'high'
    );

    // Boss Nameplate
    this.renderer.drawText(b.name, sx, b.y - 84, {
      font: FONTS.HEADER,
      size: 8.5,
      color: PALETTE.GOLD,
      align: 'center'
    });
  }

  drawDragonPots(ctx) {
    ctx.save();
    for (const pot of this.dragonPots) {
      const sx = pot.x - this.cameraX;
      ctx.fillStyle = PALETTE.ORANGE;
      ctx.fillRect(sx - 10, pot.y - 12, 20, 24);
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(sx - 12, pot.y - 14, 24, 5);
    }
    ctx.restore();
  }

  drawProjectiles(ctx) {
    ctx.save();
    for (const pr of this.projectiles) {
      const sx = pr.x - this.cameraX;
      ctx.fillStyle = pr.isBoomerang ? PALETTE.GOLD : PALETTE.CYAN;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 8;
      if (pr.isBoomerang) {
        ctx.fillRect(sx - 9, pr.y - 9, 18, 5);
        ctx.fillRect(sx - 9, pr.y - 9, 5, 18);
      } else {
        ctx.fillRect(sx - 10, pr.y - 2, 20, 4);
      }
    }
    ctx.restore();
  }

  drawEffects(ctx) {
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

export default KungFuMaster;
