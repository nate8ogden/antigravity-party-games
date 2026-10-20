/**
 * SpyHunter.js
 * Classic 1983 Top-Down High-Speed Highway Combat Driving
 * Features scrolling curved road & bridges, dual Machine Guns, Oil Slick & Smoke Screen
 * rear hazards, enemy spin-outs, Civilian protection, and the Red Weapons Van docking ramp.
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

export class SpyHunter {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'spyhunter';
    this.title = 'Highway Agent';
    this.width = 960;
    this.height = 540;

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.roadSegments = [];
    this.trees = [];
    this.player = null;
    this.bullets = [];
    this.hazards = []; // Oil slicks & smoke screens
    this.vehicles = []; // Enemies, civilians, and Weapons Van
    this.particles = [];
    this.popups = [];

    this.distance = 0;
    this.noPointsTimer = 0;
    this.vanSpawnTimer = 0;
    this.spawnTimer = 0;
    this.themeStep = 0;
    this.themeTimer = 0;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.state = 'PLAYING';

    this.distance = 0;
    this.noPointsTimer = 0;
    this.vanSpawnTimer = 14;
    this.spawnTimer = 1.2;

    this.bullets = [];
    this.hazards = [];
    this.vehicles = [];
    this.particles = [];
    this.popups = [];

    this._initRoad();
    this._resetPlayer();
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
    if (this.noPointsTimer > 0 && pts > 0) return;
    this.score = Math.max(0, this.score + pts);
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    if (x !== null && y !== null) {
      this.popups.push({
        x,
        y,
        text: label || (pts >= 0 ? `+${pts}` : `${pts}`),
        color,
        life: 1.0
      });
    }
  }

  _initRoad() {
    this.roadSegments = [];
    for (let y = 0; y <= this.height + 60; y += 20) {
      this.roadSegments.push({
        y,
        centerX: this.width / 2,
        halfWidth: 195,
        isBridge: false
      });
    }
    this.trees = [];
    for (let i = 0; i < 18; i++) {
      this.trees.push({
        x: i % 2 === 0 ? 45 + Math.random() * 140 : 775 + Math.random() * 140,
        y: Math.random() * this.height,
        r: 14 + Math.random() * 10
      });
    }
  }

  _resetPlayer() {
    const roadCenter = this._getRoadAtY(420).centerX;
    this.player = {
      x: roadCenter,
      y: 420,
      w: 28,
      h: 48,
      vx: 0,
      speed: 380,
      oilAmmo: 6,
      smokeAmmo: 6,
      missileAmmo: 0,
      specialMode: 'OIL', // Alternates 'OIL' and 'SMOKE'
      gunCooldown: 0,
      specialCooldown: 0,
      invulnTimer: 2.2,
      dockedVan: null,
      dockTimer: 0
    };
  }

  _getRoadAtY(y) {
    let closest = this.roadSegments[0];
    let minDiff = Infinity;
    for (const seg of this.roadSegments) {
      const diff = Math.abs(seg.y - y);
      if (diff < minDiff) {
        minDiff = diff;
        closest = seg;
      }
    }
    return closest || { centerX: this.width / 2, halfWidth: 195, isBridge: false };
  }

  _spawnParticles(x, y, color, count = 12, speed = 150) {
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

  _spawnVehicle() {
    const topRoad = this._getRoadAtY(40);
    const laneOffset = (Math.floor(Math.random() * 3) - 1) * 90;
    const x = topRoad.centerX + laneOffset;

    const roll = Math.random();
    if (roll < 0.28) {
      // Innocent Civilian
      this.vehicles.push({
        type: 'civilian',
        x,
        y: -40,
        w: 26,
        h: 44,
        vx: 0,
        speed: 220 + Math.random() * 50,
        hp: 1,
        color: PALETTE.BLUE,
        spinning: false,
        spinAngle: 0
      });
    } else if (roll < 0.56) {
      // Switchblade (Tire Slasher - weaves aggressively toward player)
      this.vehicles.push({
        type: 'switchblade',
        x,
        y: -40,
        w: 30,
        h: 46,
        vx: 0,
        speed: 310 + this.level * 15,
        hp: 3,
        color: PALETTE.ORANGE,
        spinning: false,
        spinAngle: 0,
        slasherOut: true
      });
    } else if (roll < 0.82) {
      // Enforcer (Pursuing Limo that spawns from behind or ahead and shoots)
      const fromBehind = Math.random() < 0.45;
      const spawnY = fromBehind ? this.height + 40 : -40;
      const spawnRoad = this._getRoadAtY(fromBehind ? this.height - 20 : 40);
      this.vehicles.push({
        type: 'enforcer',
        x: spawnRoad.centerX + laneOffset,
        y: spawnY,
        w: 28,
        h: 50,
        vx: 0,
        speed: fromBehind ? 460 : 290,
        hp: 4,
        color: PALETTE.PURPLE,
        shootTimer: 1.4,
        spinning: false,
        spinAngle: 0
      });
    } else {
      // Road Lord (Bulletproof front armor - must be Oil Slicked, Smoked, or rammed off road!)
      this.vehicles.push({
        type: 'roadlord',
        x,
        y: -40,
        w: 34,
        h: 52,
        vx: 0,
        speed: 330,
        hp: 10,
        color: '#94A3B8',
        spinning: false,
        spinAngle: 0
      });
    }
  }

  _spawnWeaponsVan() {
    const topRoad = this._getRoadAtY(40);
    this.vehicles.push({
      type: 'weaponsvan',
      x: topRoad.centerX - 110,
      y: -70,
      w: 44,
      h: 82,
      vx: 0,
      speed: 260,
      hp: 999,
      color: PALETTE.RED,
      spinning: false,
      spinAngle: 0,
      used: false
    });
    this.popups.push({
      x: this.width / 2,
      y: 95,
      text: 'WEAPONS VAN AHEAD! ENTER REAR RAMP!',
      color: PALETTE.GREEN,
      life: 2.2
    });
    this.audio.playPowerUp();
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

    const p = this.player;
    if (p.invulnTimer > 0) p.invulnTimer -= dt;
    if (p.gunCooldown > 0) p.gunCooldown -= dt;
    if (p.specialCooldown > 0) p.specialCooldown -= dt;
    if (this.noPointsTimer > 0) this.noPointsTimer -= dt;

    // Synthesize iconic Peter Gunn style bassline pulse while driving
    this.themeTimer -= dt;
    if (this.themeTimer <= 0) {
      const bassNotes = [110, 110, 123.47, 110, 130.81, 110, 146.83, 138.59];
      this.audio.playNote(bassNotes[this.themeStep % bassNotes.length], 0.11, 'triangle', 0.14);
      this.themeStep++;
      this.themeTimer = 0.22;
    }

    // Speed & Steering Controls
    if (p.dockedVan) {
      p.dockTimer -= dt;
      p.x = p.dockedVan.x;
      p.y = p.dockedVan.y + 18;
      p.speed = p.dockedVan.speed;
      if (p.dockTimer <= 0) {
        p.oilAmmo = 8;
        p.smokeAmmo = 8;
        p.missileAmmo = 10;
        p.invulnTimer = 2.5;
        p.dockedVan.used = true;
        p.dockedVan.speed = 180;
        p.speed = 460;
        p.y = p.dockedVan.y - 55;
        p.dockedVan = null;
        this.audio.playStageClear();
        this._addScore(1500, p.x, p.y, PALETTE.GREEN, 'SYSTEMS UPGRADED +1500');
      }
    } else {
      if (this.input.isDown('up')) {
        p.speed = Math.min(580, p.speed + 260 * dt);
      } else if (this.input.isDown('down')) {
        p.speed = Math.max(210, p.speed - 320 * dt);
      } else {
        p.speed += (390 - p.speed) * 2 * dt;
      }

      const steerSpeed = 310;
      if (this.input.isDown('left')) {
        p.vx = -steerSpeed;
      } else if (this.input.isDown('right')) {
        p.vx = steerSpeed;
      } else {
        p.vx *= Math.pow(0.0005, dt);
      }
      p.x += p.vx * dt;
    }

    // Advance Highway Distance & Score
    const deltaDist = p.speed * dt;
    this.distance += deltaDist;
    this.level = 1 + Math.floor(this.distance / 9000);
    if (this.noPointsTimer <= 0) {
      this._addScore(deltaDist * 0.08);
    }

    // Scroll Road Segments
    for (const seg of this.roadSegments) {
      seg.y += deltaDist;
      if (seg.y > this.height + 40) {
        seg.y -= this.height + 80;
        const curvePhase = this.distance * 0.00085;
        seg.centerX =
          this.width / 2 +
          Math.sin(curvePhase) * 125 +
          Math.cos(curvePhase * 0.47) * 55;
        const bridgeWave = Math.sin(this.distance * 0.00035);
        seg.isBridge = bridgeWave > 0.72;
        seg.halfWidth = seg.isBridge ? 145 : 195;
      }
    }

    // Scroll Roadside Trees
    for (const tree of this.trees) {
      tree.y += deltaDist;
      if (tree.y > this.height + 30) {
        tree.y = -20;
        const topSeg = this._getRoadAtY(0);
        const side = Math.random() < 0.5 ? -1 : 1;
        tree.x = topSeg.centerX + side * (topSeg.halfWidth + 45 + Math.random() * 120);
      }
    }

    // Check Player Road Bounds
    const playerRoad = this._getRoadAtY(p.y);
    const distFromCenter = Math.abs(p.x - playerRoad.centerX);
    if (!p.dockedVan && distFromCenter > playerRoad.halfWidth - 8) {
      if (playerRoad.isBridge && distFromCenter > playerRoad.halfWidth + 8) {
        // Plunged off bridge into river!
        this._destroyPlayer();
        return;
      }
      // Off-road shoulder vibration & slowdown
      p.speed = Math.max(220, p.speed - 240 * dt);
      this.renderer.shake(3, 0.06);
      if (Math.random() < 0.4) {
        this._spawnParticles(p.x, p.y + 20, PALETTE.GOLD, 2, 60);
      }
      p.x = Math.max(
        playerRoad.centerX - playerRoad.halfWidth - 28,
        Math.min(playerRoad.centerX + playerRoad.halfWidth + 28, p.x)
      );
    }

    // Action A: Dual Front Machine Guns (+ Missiles if upgraded)
    if (!p.dockedVan && this.input.isDown('actionA') && p.gunCooldown <= 0) {
      p.gunCooldown = 0.095;
      this.audio.playLaser(880, 260, 0.06);
      this.bullets.push(
        { x: p.x - 9, y: p.y - 24, vy: -760, damage: 1, isMissile: false },
        { x: p.x + 9, y: p.y - 24, vy: -760, damage: 1, isMissile: false }
      );
      if (p.missileAmmo > 0) {
        p.missileAmmo--;
        this.bullets.push({
          x: p.x,
          y: p.y - 28,
          vy: -640,
          damage: 4,
          isMissile: true
        });
      }
    }

    // Action B: Deploy Oil Slick & Smoke Screen Behind Car
    if (!p.dockedVan && this.input.isJustPressed('actionB') && p.specialCooldown <= 0) {
      if (p.oilAmmo > 0 || p.smokeAmmo > 0) {
        p.specialCooldown = 0.28;
        const useSmoke = p.specialMode === 'SMOKE' && p.smokeAmmo > 0;
        if (useSmoke) {
          p.smokeAmmo--;
          p.specialMode = p.oilAmmo > 0 ? 'OIL' : 'SMOKE';
          this.hazards.push({
            type: 'SMOKE',
            x: p.x,
            y: p.y + 34,
            r: 36,
            life: 3.5
          });
          this.audio.playExplosion(0.22, 650);
        } else if (p.oilAmmo > 0) {
          p.oilAmmo--;
          p.specialMode = p.smokeAmmo > 0 ? 'SMOKE' : 'OIL';
          this.hazards.push({
            type: 'OIL',
            x: p.x,
            y: p.y + 30,
            r: 22,
            life: 4.0
          });
          this.audio.playDig();
        }
      }
    }

    // Update Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y += b.vy * dt;
      if (b.y < 38 || b.y > this.height) {
        this.bullets.splice(i, 1);
        continue;
      }

      if (b.enemyShot) {
        if (
          !p.dockedVan &&
          p.invulnTimer <= 0 &&
          Math.abs(b.x - p.x) < 16 &&
          Math.abs(b.y - p.y) < 24
        ) {
          this.bullets.splice(i, 1);
          this._destroyPlayer();
          return;
        }
        continue;
      }

      // Check Player Bullet vs Vehicles
      for (let j = this.vehicles.length - 1; j >= 0; j--) {
        const v = this.vehicles[j];
        if (v.type === 'weaponsvan') continue;
        if (
          Math.abs(b.x - v.x) < v.w / 2 + 6 &&
          Math.abs(b.y - v.y) < v.h / 2 + 6
        ) {
          this.bullets.splice(i, 1);
          if (v.type === 'roadlord' && !b.isMissile) {
            // Bulletproof armor sparks!
            this.audio.playMenuMove();
            this._spawnParticles(b.x, b.y, PALETTE.CYAN, 4, 90);
          } else {
            v.hp -= b.damage;
            this._spawnParticles(b.x, b.y, PALETTE.ORANGE, 6, 110);
            if (v.hp <= 0) {
              this._destroyVehicle(j);
            }
          }
          break;
        }
      }
    }

    // Update Rear Hazards (Oil Slicks & Smoke Screens)
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.y += (p.speed * 0.55) * dt;
      if (h.type === 'SMOKE') {
        h.r = Math.min(54, h.r + 18 * dt);
      }
      h.life -= dt;
      if (h.life <= 0 || h.y > this.height + 50) {
        this.hazards.splice(i, 1);
        continue;
      }

      // Check Enemy Vehicles hitting Oil Slick or Smoke Screen!
      for (const v of this.vehicles) {
        if (v.type === 'weaponsvan' || v.spinning) continue;
        if (Math.hypot(v.x - h.x, v.y - h.y) < h.r + 16) {
          v.spinning = true;
          v.vx = (v.x >= h.x ? 1 : -1) * 280;
          this.audio.playPop();
          if (v.type !== 'civilian') {
            this._addScore(600, v.x, v.y, PALETTE.CYAN, 'SPIN-OUT +600!');
          }
        }
      }
    }

    // Spawn Traffic & Enemies
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.vehicles.length < 7) {
      this._spawnVehicle();
      this.spawnTimer = Math.max(0.75, 1.65 - this.level * 0.1);
    }

    // Spawn Red Weapons Van periodically
    this.vanSpawnTimer -= dt;
    if (this.vanSpawnTimer <= 0) {
      this._spawnWeaponsVan();
      this.vanSpawnTimer = 22;
    }

    // Update Vehicles
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      const vRoad = this._getRoadAtY(v.y);

      if (v.spinning) {
        v.spinAngle += 14 * dt;
        v.x += v.vx * dt;
        v.y += (p.speed - v.speed * 0.4) * dt;
        if (Math.abs(v.x - vRoad.centerX) > vRoad.halfWidth + 14) {
          this._destroyVehicle(i);
          continue;
        }
      } else {
        // Relative vertical motion
        const relVy = p.speed - v.speed;
        v.y += relVy * dt;

        // AI steering behavior
        if (v.type === 'civilian' || v.type === 'weaponsvan') {
          const targetX =
            v.type === 'weaponsvan' && !v.used
              ? vRoad.centerX - 95
              : vRoad.centerX;
          v.x += (targetX - v.x) * 2.5 * dt;
        } else {
          // Enemy pursues player lane
          const dx = p.x - v.x;
          v.vx = Math.sign(dx) * Math.min(165, Math.abs(dx) * 2.2);
          v.x += v.vx * dt;

          // Enforcer fires at player
          if (v.type === 'enforcer') {
            v.shootTimer -= dt;
            if (v.shootTimer <= 0 && Math.abs(v.x - p.x) < 60) {
              v.shootTimer = 1.6;
              this.bullets.push({
                x: v.x,
                y: v.y + (v.y < p.y ? 26 : -26),
                vy: v.y < p.y ? 260 : -520,
                enemyShot: true
              });
              this.audio.playLaser(420, 150, 0.08);
            }
          }
        }
      }

      // Remove off-screen vehicles
      if (v.y < -150 || v.y > this.height + 150) {
        this.vehicles.splice(i, 1);
        continue;
      }

      // Check Player Interaction with Vehicle
      if (!p.dockedVan) {
        const dx = Math.abs(p.x - v.x);
        const dy = Math.abs(p.y - v.y);

        // Docking into Red Weapons Van Rear Ramp!
        if (
          v.type === 'weaponsvan' &&
          !v.used &&
          dx < 26 &&
          p.y > v.y + 10 &&
          p.y < v.y + 62
        ) {
          p.dockedVan = v;
          p.dockTimer = 1.2;
          this.audio.playPowerUp();
          this.popups.push({
            x: v.x,
            y: v.y,
            text: 'REARMING OIL & MISSILES...',
            color: PALETTE.GOLD,
            life: 1.1
          });
          continue;
        }

        // Vehicle-to-Vehicle Ramming
        if (dx < (p.w + v.w) * 0.48 && dy < (p.h + v.h) * 0.46) {
          const pushDir = p.x < v.x ? -1 : 1;
          p.x += pushDir * 18;
          v.x -= pushDir * 28;
          this.audio.playShove();
          this.renderer.shake(6, 0.15);
          this._spawnParticles((p.x + v.x) / 2, (p.y + v.y) / 2, PALETTE.GOLD, 8, 130);

          // Switchblade tire slasher damages player if side-swiped while vulnerable
          if (v.type === 'switchblade' && p.invulnTimer <= 0 && dy < 22) {
            this._destroyPlayer();
            return;
          }

          // Check if enemy was sideswiped off the highway!
          if (Math.abs(v.x - vRoad.centerX) > vRoad.halfWidth - 6) {
            v.spinning = true;
            v.vx = -pushDir * 260;
            this._addScore(500, v.x, v.y, PALETTE.ORANGE, 'SIDESWIPE +500!');
          }
        }
      }
    }

    // Update Particles & Popups
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 35 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  _destroyVehicle(index) {
    const v = this.vehicles[index];
    this.audio.playExplosion(0.35, 1100);
    this.renderer.shake(7, 0.18);
    this._spawnParticles(v.x, v.y, PALETTE.ORANGE, 20, 200);
    this._spawnParticles(v.x, v.y, PALETTE.RED, 12, 140);

    if (v.type === 'civilian') {
      this.noPointsTimer = 3.0;
      this.popups.push({
        x: v.x,
        y: v.y,
        text: 'NO POINTS! CIVILIAN HIT!',
        color: PALETTE.RED,
        life: 1.6
      });
    } else {
      const pts = v.type === 'roadlord' ? 800 : 400;
      this._addScore(pts, v.x, v.y, PALETTE.GOLD);
    }
    this.vehicles.splice(index, 1);
  }

  _destroyPlayer() {
    this.audio.playExplosion(0.5, 900);
    this.renderer.shake(12, 0.35);
    this._spawnParticles(this.player.x, this.player.y, PALETTE.CYAN, 26, 240);
    this._spawnParticles(this.player.x, this.player.y, PALETTE.ORANGE, 18, 180);
    this.lives--;
    if (this.lives <= 0) {
      this.audio.playGameOver();
      this.setState('GAMEOVER');
    } else {
      this._resetPlayer();
    }
  }

  render(ctx = this.renderer.ctx) {
    // Grass / River background
    this.renderer.clear('#0D1E18');

    // Render Scrolling Highway Strips
    const sortedSegs = [...this.roadSegments].sort((a, b) => a.y - b.y);
    for (let i = 0; i < sortedSegs.length; i++) {
      const seg = sortedSegs[i];
      const h = 22;
      if (seg.isBridge) {
        // Blue River beneath Bridge
        ctx.fillStyle = '#0A2E5C';
        ctx.fillRect(0, seg.y, this.width, h);
        // Bridge steel guardrails
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(seg.centerX - seg.halfWidth - 8, seg.y, 8, h);
        ctx.fillRect(seg.centerX + seg.halfWidth, seg.y, 8, h);
      } else {
        // Road Shoulder rumble strips
        ctx.fillStyle = i % 2 === 0 ? '#D97706' : '#78350F';
        ctx.fillRect(seg.centerX - seg.halfWidth - 14, seg.y, 14, h);
        ctx.fillRect(seg.centerX + seg.halfWidth, seg.y, 14, h);
      }

      // Asphalt surface
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(seg.centerX - seg.halfWidth, seg.y, seg.halfWidth * 2, h);

      // Dashed Lane Dividers
      if ((Math.floor((seg.y + this.distance) / 40) % 2) === 0) {
        ctx.fillStyle = 'rgba(248, 250, 252, 0.65)';
        ctx.fillRect(seg.centerX - seg.halfWidth * 0.34, seg.y, 4, 14);
        ctx.fillRect(seg.centerX + seg.halfWidth * 0.34, seg.y, 4, 14);
      }
    }

    // Roadside Trees
    for (const tree of this.trees) {
      const seg = this._getRoadAtY(tree.y);
      if (seg.isBridge) continue;
      if (Math.abs(tree.x - seg.centerX) < seg.halfWidth + 28) continue;
      this.renderer.drawGlowCircle(tree.x, tree.y, tree.r, '#10B981', 6, true);
      ctx.fillStyle = '#047857';
      ctx.beginPath();
      ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }

    // Oil Slicks & Smoke Screens
    for (const h of this.hazards) {
      if (h.type === 'OIL') {
        ctx.fillStyle = '#09090B';
        ctx.beginPath();
        ctx.ellipse(h.x, h.y, h.r, h.r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = PALETTE.PURPLE;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(226, 232, 240, 0.55)';
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Vehicles (Enemies, Civilians, Weapons Van)
    for (const v of this.vehicles) {
      ctx.save();
      ctx.translate(v.x, v.y);
      if (v.spinning) {
        ctx.rotate(v.spinAngle);
      }

      if (v.type === 'weaponsvan') {
        // Red Weapons Van + Rear Ramp
        if (!v.used) {
          ctx.fillStyle = '#94A3B8';
          ctx.fillRect(-16, v.h / 2 - 4, 32, 22);
          ctx.strokeStyle = PALETTE.GREEN;
          ctx.strokeRect(-16, v.h / 2 - 4, 32, 22);
        }
        this.renderer.drawGlowRect(-v.w / 2, -v.h / 2, v.w, v.h, PALETTE.RED, 10, true);
        ctx.fillStyle = PALETTE.WHITE;
        ctx.fillRect(-v.w / 2 + 6, -v.h / 2 + 12, v.w - 12, 6);
        this.renderer.drawText('VAN', 0, 4, {
          font: FONTS.HEADER,
          size: 9,
          color: PALETTE.WHITE,
          align: 'center'
        });
      } else {
        // Switchblade extending wheel spikes
        if (v.type === 'switchblade') {
          ctx.fillStyle = PALETTE.CYAN;
          ctx.fillRect(-v.w / 2 - 7, -12, 7, 5);
          ctx.fillRect(v.w / 2, -12, 7, 5);
          ctx.fillRect(-v.w / 2 - 7, 10, 7, 5);
          ctx.fillRect(v.w / 2, 10, 7, 5);
        }
        this.renderer.drawGlowRect(-v.w / 2, -v.h / 2, v.w, v.h, v.color, 8, true);
        // Windshield
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-v.w / 2 + 4, -v.h / 2 + 8, v.w - 8, 12);
      }
      ctx.restore();
    }

    // Player G-6155 Interceptor Supercar
    const p = this.player;
    if (p.invulnTimer <= 0 || Math.floor(p.invulnTimer * 14) % 2 === 0) {
      this.renderer.drawGlowRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, PALETTE.WHITE, 12, true);
      ctx.fillStyle = PALETTE.CYAN;
      ctx.fillRect(p.x - 4, p.y - p.h / 2, 8, p.h);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(p.x - 9, p.y - 8, 18, 14);
    }

    // Bullets & Missiles
    for (const b of this.bullets) {
      const col = b.enemyShot ? PALETTE.RED : b.isMissile ? PALETTE.GOLD : PALETTE.CYAN;
      this.renderer.drawGlowRect(b.x - 2, b.y - 6, b.isMissile ? 5 : 3, b.isMissile ? 14 : 10, col, 8, true);
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

    // Civilian Penalty Banner
    if (this.noPointsTimer > 0) {
      this.renderer.drawText('NO POINTS - CIVILIAN DESTROYED', this.width / 2, 65, {
        font: FONTS.HEADER,
        size: 12,
        color: PALETTE.RED,
        align: 'center',
        glow: 10
      });
    }

    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `OIL:${p.oilAmmo} SMK:${p.smokeAmmo} MSL:${p.missileAmmo}`,
      accent: PALETTE.CYAN
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'G-6155 INTERCEPTOR HIGHWAY COMBAT',
      controls: 'ARROWS: STEER/SPEED  |  Z/SPACE: MACHINE GUN  |  X/SHIFT: OIL SLICK / SMOKE',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.CYAN
    });
  }
}

export default SpyHunter;
