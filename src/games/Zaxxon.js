/**
 * Zaxxon.js
 * Classic 1982 Isometric / Axonometric Diagonal Flight Shooter — Retro Arcade Studio Edition.
 * Features an on-screen Altitude Meter (H - Low/High), ground shadow projection directly below
 * the fighter jet to judge height, Laser Barrier Fortress Walls, Fuel Tank dumps to replenish
 * the ticking Fuel Gauge, enemy interceptors, and the Zaxxon Robot Boss!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const MAX_ALT = 120;
const LANE_LIMIT = 155;

export class Zaxxon {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'zaxxon';
    this.title = 'Iso Fortress';
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
    this._initStage();
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.audio.stopSequence();
  }

  // Projects (distAlongRunway, laneOffset, altitude) into 2D screen coordinates
  // Runway scrolls from Top-Right (dist = 800) to Bottom-Left (dist = -150)
  _isoToScreen(dist, lane, alt = 0) {
    const baseX = 285 + dist * 0.62 + lane * 0.88;
    const baseY = 445 - dist * 0.36 + lane * 0.44 - alt;
    return { x: baseX, y: baseY };
  }

  _initStage() {
    this.scrollDist = 0;
    this.bossDist = 2600 + this.level * 400;
    this.fuel = 100;

    const sectors = [
      {
        name: 'SECTOR 1: ASTEROID ENTRY FORTRESS',
        deckCol: '#131C31',
        gridCol: PALETTE.BLUE,
        wallFill: '#334155',
        wallStroke: PALETTE.ORANGE,
        wallEvery: 465
      },
      {
        name: 'SECTOR 2: OPEN SPACE DOGFIGHT SQUADRON',
        deckCol: '#090D1A',
        gridCol: PALETTE.PURPLE,
        wallFill: '#1E1B4B',
        wallStroke: PALETTE.CYAN,
        wallEvery: 620
      },
      {
        name: 'SECTOR 3: HIGH-WALL LASER CITADEL',
        deckCol: '#1E1B4B',
        gridCol: PALETTE.PINK,
        wallFill: '#3B0764',
        wallStroke: PALETTE.PINK,
        wallEvery: 310
      },
      {
        name: 'SECTOR 4: FUEL DEPOT GAUNTLET',
        deckCol: '#06281E',
        gridCol: PALETTE.GREEN,
        wallFill: '#14532D',
        wallStroke: PALETTE.GOLD,
        wallEvery: 465
      },
      {
        name: 'SECTOR 5: SUPER ZAXXON RED FORTRESS',
        deckCol: '#2A1215',
        gridCol: PALETTE.RED,
        wallFill: '#7F1D1D',
        wallStroke: PALETTE.GOLD,
        wallEvery: 380
      },
      {
        name: 'SECTOR 6: ZAXXON COMMAND CORE',
        deckCol: '#172554',
        gridCol: PALETTE.GOLD,
        wallFill: '#0F172A',
        wallStroke: PALETTE.CYAN,
        wallEvery: 310
      }
    ];
    const sectorIdx = (this.level - 1) % sectors.length;
    this.currentSector = sectors[sectorIdx];

    this.player = {
      lane: 0,
      alt: 36,
      fireCooldown: 0,
      invuln: 2.0
    };

    this.bullets = [];
    this.enemyBullets = [];
    this.objects = [];

    // Populate Fortress Runway with Sector-specific Fuel Tanks, Radar Dishes, Gun Turrets, Laser Walls & Interceptors
    const wallEvery = this.currentSector.wallEvery;
    for (let d = 320; d < this.bossDist - 220; d += 155) {
      if (d % wallEvery === 0) {
        // Fortress Wall with Laser Barrier (either fly OVER alt > 68, or fly THROUGH gap)
        const highGap = (Math.floor(d / 155) + sectorIdx) % 2 === 0;
        this.objects.push({
          type: 'WALL',
          dist: d,
          lane: 0,
          alt: 0,
          minSafeAlt: highGap ? 64 : 24,
          maxSafeAlt: highGap ? 130 : 72,
          hp: 999
        });
      } else {
        // Place Fuel Tanks (low altitude targets!) & Turrets/Radars/Interceptors tailored to sector
        const numItems = 2 + ((d + sectorIdx) % 2);
        for (let k = 0; k < numItems; k++) {
          const lane = -110 + k * 110 + ((d * 17 + k * 43 + sectorIdx * 19) % 40) - 20;
          const kindRoll = (d + k * 3 + sectorIdx) % 5;
          let type = 'FUEL_TANK';
          let alt = 0;
          if (sectorIdx === 1 && kindRoll !== 0) {
            // Sector 2 Open Space Dogfight Squadron: heavy interceptor wave
            type = 'INTERCEPTOR';
            alt = 25 + ((d + k * 29) % 85);
          } else if (sectorIdx === 3 && kindRoll <= 2) {
            // Sector 4 Fuel Depot Gauntlet: dense fuel tanks + guarding turrets
            type = k % 2 === 0 ? 'FUEL_TANK' : 'TURRET';
          } else if (kindRoll === 1) {
            type = 'TURRET';
          } else if (kindRoll === 2) {
            type = 'RADAR';
          } else if (kindRoll === 3) {
            type = 'INTERCEPTOR';
            alt = 25 + ((d + k * 29) % 85);
          }

          this.objects.push({
            type,
            dist: d + k * 28,
            lane: Math.max(-130, Math.min(130, lane)),
            alt,
            hp: type === 'RADAR' ? 2 : 1,
            fireTimer: 1.2 + Math.random()
          });
        }
      }
    }

    // Zaxxon Armored Robot Boss at end of Fortress
    this.boss = {
      active: false,
      dist: this.bossDist,
      lane: 0,
      alt: 30,
      vxLane: 85 + sectorIdx * 8,
      hp: 10 + this.level * 2,
      maxHp: 10 + this.level * 2,
      fireTimer: 1.2,
      flash: 0
    };
  }

  _addScore(pts, x, y, label = null, color = PALETTE.GOLD) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    this.popups.push({
      x,
      y,
      text: label || `+${pts}`,
      color,
      life: 0.9
    });
  }

  _spawnExplosion(x, y, color = PALETTE.ORANGE, count = 14) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 50 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        color,
        life: 0.35 + Math.random() * 0.3
      });
    }
  }

  _killPlayer(reason = 'CRASHED!') {
    if (this.player.invuln > 0) return;
    const pScreen = this._isoToScreen(0, this.player.lane, this.player.alt);
    this._spawnExplosion(pScreen.x, pScreen.y, PALETTE.RED, 26);
    this.audio.playExplosion(0.45, 700);
    this.renderer.shake(10, 0.35);
    this.lives--;

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.state = 'GAMEOVER';
      this.audio.playGameOver();
      return;
    }

    this.fuel = Math.max(55, this.fuel);
    this.player.invuln = 2.4;
    this.player.alt = 65;
    this.popups.push({
      x: pScreen.x,
      y: pScreen.y - 20,
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

    const p = this.player;
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt);

    // 1. Scroll Fortress Runway & Drain Fuel
    const scrollSpeed = this.boss.active ? 0 : 165 + this.level * 12;
    this.scrollDist += scrollSpeed * dt;
    this.fuel = Math.max(0, this.fuel - 3.4 * dt);
    if (this.fuel <= 0) {
      this.fuel = 65;
      this._killPlayer('OUT OF FUEL!');
    }

    // 2. Player Controls: Left/Right banks lane, Up/Down climbs/descends Altitude
    const axis = this.input.getAxis();
    p.lane = Math.max(-LANE_LIMIT, Math.min(LANE_LIMIT, p.lane + axis.x * 210 * dt));
    // Up key (axis.y < 0) climbs altitude; Down key (axis.y > 0) descends altitude
    p.alt = Math.max(4, Math.min(MAX_ALT, p.alt - axis.y * 135 * dt));

    // Fire Lasers (Action A) at current lane & altitude
    if ((this.input.isDown('actionA') || this.input.pointer.down) && p.fireCooldown <= 0) {
      p.fireCooldown = 0.13;
      this.bullets.push({
        dist: 24,
        lane: p.lane,
        alt: p.alt,
        speed: 620
      });
      this.audio.playLaser(1100, 240, 0.08);
    }

    // 3. Update Player Lasers
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.dist += b.speed * dt;
      if (b.dist > 780) {
        this.bullets.splice(i, 1);
        continue;
      }

      let hit = false;
      for (let j = this.objects.length - 1; j >= 0; j--) {
        const obj = this.objects[j];
        if (obj.type === 'WALL') continue;
        const relDist = obj.dist - this.scrollDist;
        const altDiff = Math.abs(b.alt - (obj.alt + 12));
        if (Math.abs(b.dist - relDist) < 28 && Math.abs(b.lane - obj.lane) < 28 && altDiff < 26) {
          hit = true;
          obj.hp--;
          if (obj.hp <= 0) {
            const pos = this._isoToScreen(relDist, obj.lane, obj.alt);
            this._spawnExplosion(pos.x, pos.y, PALETTE.ORANGE, 16);
            this.audio.playExplosion(0.28, 950);

            if (obj.type === 'FUEL_TANK') {
              this.fuel = Math.min(100, this.fuel + 24);
              this._addScore(300, pos.x, pos.y - 14, 'FUEL +25% (+300)', PALETTE.GREEN);
            } else if (obj.type === 'RADAR') {
              this._addScore(1000, pos.x, pos.y - 14, 'RADAR +1000', PALETTE.CYAN);
            } else {
              this._addScore(400, pos.x, pos.y - 14, '+400', PALETTE.GOLD);
            }
            this.objects.splice(j, 1);
          }
          break;
        }
      }

      // Check Boss Hit
      if (!hit && this.boss.active) {
        const relBossDist = this.boss.dist - this.scrollDist;
        if (
          Math.abs(b.dist - relBossDist) < 42 &&
          Math.abs(b.lane - this.boss.lane) < 42 &&
          Math.abs(b.alt - (this.boss.alt + 20)) < 36
        ) {
          hit = true;
          this.boss.hp--;
          this.boss.flash = 0.14;
          const bPos = this._isoToScreen(relBossDist, this.boss.lane, this.boss.alt + 20);
          this._spawnExplosion(bPos.x, bPos.y, PALETTE.CYAN, 10);
          this.audio.playHit();

          if (this.boss.hp <= 0) {
            this._spawnExplosion(bPos.x, bPos.y, PALETTE.GOLD, 42);
            this.audio.playStageClear();
            this.renderer.shake(12, 0.45);
            this._addScore(5000, bPos.x, bPos.y - 20, 'ZAXXON DESTROYED! +5000', PALETTE.GOLD);
            this.level++;
            this._initStage();
            return;
          }
        }
      }

      if (hit) {
        this.bullets.splice(i, 1);
      }
    }

    // 4. Update Fortress Objects & Collisions
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      const relDist = obj.dist - this.scrollDist;
      if (relDist < -90) {
        this.objects.splice(i, 1);
        continue;
      }

      if (obj.type === 'INTERCEPTOR' && relDist < 650) {
        obj.dist -= 75 * dt;
        obj.lane += Math.sin(performance.now() * 0.004 + obj.dist) * 45 * dt;
      }

      // Enemy Firing
      if ((obj.type === 'TURRET' || obj.type === 'INTERCEPTOR') && relDist > 90 && relDist < 540) {
        obj.fireTimer -= dt;
        if (obj.fireTimer <= 0) {
          obj.fireTimer = 1.9;
          this.enemyBullets.push({
            dist: relDist,
            lane: obj.lane,
            alt: obj.type === 'INTERCEPTOR' ? obj.alt : 14,
            vDist: -290
          });
        }
      }

      // Collision with Player Jet (at dist ~ 0)
      if (Math.abs(relDist) < 20) {
        if (obj.type === 'WALL') {
          if (p.alt < obj.minSafeAlt || p.alt > obj.maxSafeAlt) {
            this._killPlayer('HIT FORTRESS WALL!');
          }
        } else if (Math.abs(p.lane - obj.lane) < 24 && Math.abs(p.alt - (obj.alt + 10)) < 20) {
          this._killPlayer('COLLISION!');
        }
      }
    }

    // 5. Activate & Update Zaxxon Boss
    const relBoss = this.boss.dist - this.scrollDist;
    if (relBoss <= 360 && !this.boss.active) {
      this.boss.active = true;
    }
    if (this.boss.active) {
      if (this.boss.flash > 0) this.boss.flash = Math.max(0, this.boss.flash - dt);
      this.boss.lane += this.boss.vxLane * dt;
      if (Math.abs(this.boss.lane) > 110) this.boss.vxLane = -this.boss.vxLane;
      this.boss.alt = 35 + 25 * Math.sin(performance.now() * 0.003);

      this.boss.fireTimer -= dt;
      if (this.boss.fireTimer <= 0) {
        this.boss.fireTimer = Math.max(0.65, 1.25 - this.level * 0.08);
        this.enemyBullets.push({
          dist: relBoss,
          lane: this.boss.lane,
          alt: this.boss.alt + 16,
          vDist: -330
        });
        this.audio.playLaser(520, 140, 0.14);
      }
    }

    // 6. Enemy Bullets
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const eb = this.enemyBullets[i];
      eb.dist += eb.vDist * dt;
      if (eb.dist < -60) {
        this.enemyBullets.splice(i, 1);
        continue;
      }
      if (Math.abs(eb.dist) < 18 && Math.abs(eb.lane - p.lane) < 20 && Math.abs(eb.alt - p.alt) < 20) {
        this.enemyBullets.splice(i, 1);
        this._killPlayer('SHOT DOWN!');
        break;
      }
    }

    // 7. Particles & Popups
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 28 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear('#070B14');

    // 1. Isometric Fortress Runway Deck & Grid Lines
    const sector = this.currentSector || {
      name: 'SECTOR 1: ASTEROID ENTRY FORTRESS',
      deckCol: '#131C31',
      gridCol: PALETTE.BLUE,
      wallFill: '#334155',
      wallStroke: PALETTE.ORANGE
    };
    ctx.save();
    const c1 = this._isoToScreen(-120, -LANE_LIMIT - 20, 0);
    const c2 = this._isoToScreen(780, -LANE_LIMIT - 20, 0);
    const c3 = this._isoToScreen(780, LANE_LIMIT + 20, 0);
    const c4 = this._isoToScreen(-120, LANE_LIMIT + 20, 0);

    ctx.fillStyle = sector.deckCol;
    ctx.beginPath();
    ctx.moveTo(c1.x, c1.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.lineTo(c3.x, c3.y);
    ctx.lineTo(c4.x, c4.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = sector.gridCol;
    ctx.lineWidth = 2;
    ctx.stroke();

    this.renderer.drawText(sector.name, 480, 62, {
      font: FONTS.HEADER,
      size: 11,
      color: sector.wallStroke,
      align: 'center',
      glow: 6
    });

    //Scrolling diagonal deck ribs
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.lineWidth = 1;
    const offset = this.scrollDist % 60;
    for (let d = -60 - offset; d < 780; d += 60) {
      const pL = this._isoToScreen(d, -LANE_LIMIT - 20, 0);
      const pR = this._isoToScreen(d, LANE_LIMIT + 20, 0);
      ctx.beginPath();
      ctx.moveTo(pL.x, pL.y);
      ctx.lineTo(pR.x, pR.y);
      ctx.stroke();
    }
    ctx.restore();

    // 2. Fortress Objects (Sorted back-to-front by distance)
    const visibleObjs = this.objects
      .map((o) => ({ o, relDist: o.dist - this.scrollDist }))
      .filter((item) => item.relDist > -80 && item.relDist < 760)
      .sort((a, b) => b.relDist - a.relDist);

    for (const { o, relDist } of visibleObjs) {
      if (o.type === 'WALL') {
        const wL = this._isoToScreen(relDist, -LANE_LIMIT - 15, 0);
        const wR = this._isoToScreen(relDist, LANE_LIMIT + 15, 0);
        ctx.save();
        ctx.fillStyle = sector.wallFill;
        ctx.strokeStyle = sector.wallStroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(wL.x, wL.y);
        ctx.lineTo(wR.x, wR.y);
        ctx.lineTo(wR.x, wR.y - 62);
        ctx.lineTo(wL.x, wL.y - 62);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Glowing Laser Barrier showing required safe altitude
        const laserAlt = o.minSafeAlt > 50 ? 64 : 84;
        ctx.strokeStyle = PALETTE.PINK;
        ctx.shadowColor = PALETTE.PINK;
        ctx.shadowBlur = 10;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(wL.x, wL.y - laserAlt);
        ctx.lineTo(wR.x, wR.y - laserAlt);
        ctx.stroke();
        ctx.restore();
      } else {
        const ground = this._isoToScreen(relDist, o.lane, 0);
        const pos = this._isoToScreen(relDist, o.lane, o.alt);

        // Ground shadow for airborne interceptors
        if (o.alt > 0) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.beginPath();
          ctx.ellipse(ground.x, ground.y, 12, 6, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        if (o.type === 'FUEL_TANK') {
          this.renderer.drawGlowRect(pos.x - 12, pos.y - 22, 24, 22, PALETTE.RED, 8, true);
          this.renderer.drawText('F', pos.x, pos.y - 6, {
            font: FONTS.HEADER,
            size: 10,
            color: PALETTE.WHITE,
            align: 'center'
          });
        } else if (o.type === 'RADAR') {
          this.renderer.drawGlowCircle(pos.x, pos.y - 16, 11, PALETTE.CYAN, 10, true);
          ctx.fillStyle = '#64748B';
          ctx.fillRect(pos.x - 4, pos.y - 6, 8, 8);
        } else if (o.type === 'TURRET') {
          this.renderer.drawGlowRect(pos.x - 11, pos.y - 14, 22, 14, PALETTE.GOLD, 6, true);
        } else if (o.type === 'INTERCEPTOR') {
          this.renderer.drawGlowCircle(pos.x, pos.y - 8, 10, PALETTE.PURPLE, 10, true);
        }
      }
    }

    // 3. Zaxxon Robot Boss
    if (this.boss.active) {
      const relBoss = this.boss.dist - this.scrollDist;
      const bGround = this._isoToScreen(relBoss, this.boss.lane, 0);
      const bPos = this._isoToScreen(relBoss, this.boss.lane, this.boss.alt);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.ellipse(bGround.x, bGround.y, 26, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      const col = this.boss.flash > 0 ? PALETTE.WHITE : PALETTE.PINK;
      this.renderer.drawGlowRect(bPos.x - 26, bPos.y - 44, 52, 44, col, 14, true);
      this.renderer.drawGlowCircle(bPos.x, bPos.y - 26, 10, PALETTE.GOLD, 10, true);
    }

    // 4. Player Shadow Projection & Vertical Height Guide on Fortress Floor!
    const p = this.player;
    const pShadow = this._isoToScreen(0, p.lane, 0);
    const pPos = this._isoToScreen(0, p.lane, p.alt);

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.ellipse(pShadow.x, pShadow.y, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pShadow.x, pShadow.y);
    ctx.lineTo(pPos.x, pPos.y);
    ctx.stroke();
    ctx.restore();

    // 5. Player Isometric Fighter Jet
    if (p.invuln <= 0 || Math.floor(p.invuln * 14) % 2 === 0) {
      ctx.save();
      ctx.translate(pPos.x, pPos.y);
      ctx.fillStyle = PALETTE.WHITE;
      ctx.strokeStyle = PALETTE.CYAN;
      ctx.shadowColor = PALETTE.CYAN;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(18, -10);
      ctx.lineTo(-6, -16);
      ctx.lineTo(-18, 4);
      ctx.lineTo(6, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Twin thruster glow
      this.renderer.drawGlowCircle(-12, 4, 4.5, PALETTE.ORANGE, 8, true);
      ctx.restore();
    }

    // 6. Lasers & Enemy Shots
    for (const b of this.bullets) {
      const pos = this._isoToScreen(b.dist, b.lane, b.alt);
      this.renderer.drawGlowCircle(pos.x, pos.y, 4, PALETTE.CYAN, 8, true);
    }
    for (const eb of this.enemyBullets) {
      const pos = this._isoToScreen(eb.dist, eb.lane, eb.alt);
      this.renderer.drawGlowCircle(pos.x, pos.y, 4.5, PALETTE.RED, 8, true);
    }

    // 7. Particles & Popups
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
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

    // 8. Left-Side On-Screen ALTITUDE METER (H — Low/High)
    const ax = 28;
    const ay = 105;
    const ah = 320;
    ctx.save();
    this.renderer.drawText('H', ax + 9, ay - 12, {
      font: FONTS.HEADER,
      size: 14,
      color: PALETTE.CYAN,
      align: 'center',
      glow: 8
    });
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.lineWidth = 2;
    ctx.fillRect(ax, ay, 18, ah);
    ctx.strokeRect(ax, ay, 18, ah);

    const altRatio = Math.max(0, Math.min(1, p.alt / MAX_ALT));
    const fillH = altRatio * ah;
    const altCol = altRatio > 0.55 ? PALETTE.CYAN : altRatio > 0.25 ? PALETTE.GREEN : PALETTE.ORANGE;
    this.renderer.drawGlowRect(ax + 3, ay + ah - fillH, 12, fillH, altCol, 8, true);

    this.renderer.drawText('L', ax + 9, ay + ah + 20, {
      font: FONTS.HEADER,
      size: 14,
      color: PALETTE.ORANGE,
      align: 'center'
    });
    ctx.restore();

    // 9. Bottom Fuel Gauge Bar
    ctx.save();
    this.renderer.drawText('FUEL:', 85, 518, {
      font: FONTS.HEADER,
      size: 12,
      color: this.fuel < 25 ? PALETTE.RED : PALETTE.GOLD
    });
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = PALETTE.GOLD;
    ctx.lineWidth = 2;
    ctx.fillRect(155, 504, 240, 16);
    ctx.strokeRect(155, 504, 240, 16);
    const fuelCol = this.fuel < 25 ? PALETTE.RED : PALETTE.GREEN;
    this.renderer.drawGlowRect(157, 506, (this.fuel / 100) * 236, 12, fuelCol, 8, true);
    ctx.restore();

    // 10. Top HUD & State Overlay
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `ALT:${Math.round(p.alt)}m`,
      accent: PALETTE.CYAN
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1982 ISOMETRIC FORTRESS FLIGHT SHOOTER',
      controls: 'UP/DOWN: ALTITUDE  |  LEFT/RIGHT: BANK  |  Z/SPACE: FIRE LASERS',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.CYAN
    });
  }
}

export default Zaxxon;
