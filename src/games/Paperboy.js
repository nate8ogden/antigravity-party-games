/**
 * Paperboy.js
 * Classic 1985 Suburban Newspaper Delivery Arcade Game — Retro Arcade Studio Edition.
 * Features an angled isometric-style scrolling suburban avenue, Subscriber (Gold/Cyan)
 * vs Non-Subscriber (Red/Dark) houses, target mailboxes, breakable glass windows,
 * parabolic newspaper throws, sidewalk bundle pickups, and street hazards (Cars, Dogs,
 * Breakdancers, and Runaway Tires).
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const ARENA_TOP = 40;
// Street lane geometry (isometric diagonal slant where road shifts slightly with Y)
const SLANT = -0.18; // x shifts left as y goes up
const BASE_Y = 460;

export const DAYS_OF_WEEK = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
];

export class Paperboy {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'paperboy';
    this.title = 'Paperboy';
    this.width = 960;
    this.height = 540;

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.reset();
  }

  // Computes screen X for a given lane X at a given screen Y to create the classic angled street feel
  _projectX(laneX, y) {
    return laneX + (y - BASE_Y) * SLANT;
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.papersLeft = 10;
    this.scrollDist = 0;
    this.housesDelivered = 0;
    this.subscriberGoal = 10;

    this.houses = [];
    this.obstacles = [];
    this.bundles = [];
    this.thrownPapers = [];
    this.particles = [];
    this.popups = [];

    this.nextHouseY = 360;
    this.obstacleTimer = 1.6;
    this.bundleTimer = 4.2;

    this._spawnRider();
    for (let i = 0; i < 4; i++) {
      this._spawnNextHouse(320 - i * 165);
    }
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.audio.stopSequence();
  }

  _spawnRider() {
    this.rider = {
      laneX: 520, // Sidewalk is ~390..480, Street is ~480..760
      y: 445,
      vx: 0,
      speed: 195,
      invuln: 2.0,
      throwCooldown: 0,
      pedalPhase: 0,
      crashTimer: 0
    };
  }

  _spawnNextHouse(yPos) {
    const isSubscriber = Math.random() < 0.65;
    const accents = [PALETTE.GOLD, PALETTE.CYAN];
    const subColor = accents[Math.floor(Math.random() * accents.length)];
    this.houses.push({
      y: yPos,
      h: 138,
      isSubscriber,
      accent: isSubscriber ? subColor : PALETTE.RED,
      roofColor: isSubscriber ? '#1E293B' : '#1F1224',
      wallColor: isSubscriber ? '#132338' : '#261420',
      mailboxHit: false,
      porchdelivered: false,
      windows: [
        { rx: 105, ry: -32, w: 34, h: 24, broken: false },
        { rx: 165, ry: -32, w: 34, h: 24, broken: false }
      ],
      mailboxOffset: { rx: 328, ry: 18 }
    });
  }

  _spawnObstacle() {
    const types = ['CAR', 'DOG', 'DANCER', 'TIRE'];
    const type = types[Math.floor(Math.random() * types.length)];
    if (type === 'CAR') {
      const inLeftLane = Math.random() < 0.5;
      this.obstacles.push({
        type: 'CAR',
        laneX: inLeftLane ? 565 : 685,
        y: -40,
        vx: 0,
        vy: inLeftLane ? 130 : -75,
        w: 44,
        h: 74,
        color: inLeftLane ? PALETTE.PINK : PALETTE.BLUE,
        phase: 0
      });
    } else if (type === 'DOG') {
      this.obstacles.push({
        type: 'DOG',
        laneX: 350,
        y: 60,
        vx: 65,
        vy: 30,
        w: 28,
        h: 20,
        color: PALETTE.ORANGE,
        phase: 0
      });
    } else if (type === 'DANCER') {
      this.obstacles.push({
        type: 'DANCER',
        laneX: 430,
        y: -30,
        vx: 0,
        vy: 0,
        w: 30,
        h: 30,
        color: PALETTE.PURPLE,
        phase: 0
      });
    } else {
      this.obstacles.push({
        type: 'TIRE',
        laneX: 470 + Math.random() * 220,
        y: -30,
        vx: (Math.random() - 0.5) * 55,
        vy: 145,
        w: 22,
        h: 22,
        color: PALETTE.CYAN,
        phase: 0
      });
    }
  }

  _addScore(pts, x = null, y = null, label = null, color = PALETTE.GOLD) {
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

  _spawnSparks(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        color,
        life: 0.28 + Math.random() * 0.25
      });
    }
  }

  _throwPaper(longThrow = false) {
    if (this.papersLeft <= 0 || this.rider.throwCooldown > 0 || this.rider.crashTimer > 0) return;
    this.papersLeft--;
    this.rider.throwCooldown = 0.22;
    const rx = this._projectX(this.rider.laneX, this.rider.y);
    this.thrownPapers.push({
      x: rx - 10,
      y: this.rider.y - 10,
      z: 14,
      vx: longThrow ? -430 : -320,
      vy: -95 - this.rider.speed * 0.25,
      vz: longThrow ? 230 : 185,
      rot: 0
    });
    this.audio.playSlap();
  }

  _crashRider() {
    if (this.rider.invuln > 0 || this.rider.crashTimer > 0) return;
    this.rider.crashTimer = 1.3;
    this.lives--;
    const rx = this._projectX(this.rider.laneX, this.rider.y);
    this.audio.playExplosion(0.45, 750);
    this.renderer.shake(9, 0.32);
    this._spawnSparks(rx, this.rider.y, PALETTE.RED, 22);
    this._addScore(0, rx, this.rider.y - 20, 'CRASH!', PALETTE.RED);

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
    }
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
      if (this.input.isJustPressed('actionA')) {
        this.state = 'PLAYING';
      }
      return;
    }
    if (this.state === 'GAMEOVER' || this.state === 'VICTORY') {
      if (this.input.isJustPressed('actionA') || this.input.isJustPressed('any') || this.input.pointer.justPressed) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'PLAYING';
      }
      return;
    }

    const r = this.rider;
    if (r.invuln > 0) r.invuln = Math.max(0, r.invuln - dt);
    if (r.throwCooldown > 0) r.throwCooldown = Math.max(0, r.throwCooldown - dt);

    if (r.crashTimer > 0) {
      r.crashTimer -= dt;
      if (r.crashTimer <= 0) {
        if (this.lives <= 0) {
          this.state = 'GAMEOVER';
          this.audio.playGameOver();
          return;
        }
        r.laneX = 455;
        r.invuln = 2.2;
        this.papersLeft = Math.max(this.papersLeft, 6);
      }
    } else {
      // Steering & Speed control
      const steerSpeed = 240;
      if (this.input.isDown('left')) r.laneX -= steerSpeed * dt;
      if (this.input.isDown('right')) r.laneX += steerSpeed * dt;

      const baseSpeed = 185 + (this.level - 1) * 20;
      if (this.input.isDown('up')) {
        r.speed = Math.min(baseSpeed + 95, r.speed + 260 * dt);
      } else if (this.input.isDown('down')) {
        r.speed = Math.max(115, r.speed - 260 * dt);
      } else {
        r.speed += (baseSpeed - r.speed) * Math.min(1, dt * 5);
      }

      // Clamp rider to sidewalk + road bounds (375..780)
      r.laneX = Math.max(375, Math.min(780, r.laneX));
      r.pedalPhase += (r.speed / 45) * dt;

      // Throw rolled newspaper (Action A = standard mailbox/porch arc, Action B = long window arc)
      if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
        this._throwPaper(false);
      } else if (this.input.isJustPressed('actionB')) {
        this._throwPaper(true);
      }
    }

    const scrollDelta = (r.crashTimer > 0 ? 60 : r.speed) * dt;
    this.scrollDist += scrollDelta;

    // Scroll Houses & Spawn new ones at top
    let topHouseY = 9999;
    for (let i = this.houses.length - 1; i >= 0; i--) {
      const h = this.houses[i];
      h.y += scrollDelta;
      if (h.y < topHouseY) topHouseY = h.y;
      if (h.y > this.height + 180) {
        this.houses.splice(i, 1);
      }
    }
    if (topHouseY > -30) {
      this._spawnNextHouse(topHouseY - 165);
    }

    // Spawn Newspaper Bundles on Sidewalk
    this.bundleTimer -= dt;
    if (this.bundleTimer <= 0) {
      this.bundleTimer = 3.6 + Math.random() * 2.5;
      this.bundles.push({
        laneX: 410 + Math.random() * 55,
        y: -20
      });
    }

    const riderScreenX = this._projectX(r.laneX, r.y);

    // Update Bundles
    for (let i = this.bundles.length - 1; i >= 0; i--) {
      const b = this.bundles[i];
      b.y += scrollDelta;
      const bx = this._projectX(b.laneX, b.y);
      if (r.crashTimer <= 0 && Math.hypot(bx - riderScreenX, b.y - r.y) < 28) {
        this.papersLeft = Math.min(20, this.papersLeft + 5);
        this.audio.playCoin();
        this._addScore(50, bx, b.y - 10, '+5 PAPERS', PALETTE.GREEN);
        this.bundles.splice(i, 1);
        continue;
      }
      if (b.y > this.height + 40) this.bundles.splice(i, 1);
    }

    // Spawn & Update Street Obstacles
    this.obstacleTimer -= dt;
    if (this.obstacleTimer <= 0) {
      this.obstacleTimer = Math.max(0.75, 1.85 - this.level * 0.14);
      this._spawnObstacle();
    }

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const ob = this.obstacles[i];
      ob.phase += dt * 10;
      ob.y += scrollDelta + ob.vy * dt;
      ob.laneX += ob.vx * dt;

      if (ob.type === 'DOG' && ob.laneX > 480) {
        // Dog chases rider down the sidewalk/street
        ob.vx = Math.sign(r.laneX - ob.laneX) * 55;
      }

      const ox = this._projectX(ob.laneX, ob.y);
      if (
        r.crashTimer <= 0 &&
        r.invuln <= 0 &&
        Math.abs(ox - riderScreenX) < ob.w * 0.55 + 10 &&
        Math.abs(ob.y - r.y) < ob.h * 0.45 + 12
      ) {
        this._crashRider();
      }

      if (ob.y > this.height + 100 || ob.y < -120) {
        this.obstacles.splice(i, 1);
      }
    }

    // Update Parabolic Thrown Newspapers
    for (let i = this.thrownPapers.length - 1; i >= 0; i--) {
      const p = this.thrownPapers[i];
      p.x += p.vx * dt;
      p.y += (p.vy + (r.crashTimer > 0 ? 60 : r.speed)) * dt;
      p.z += p.vz * dt;
      p.vz -= 520 * dt; // Parabolic gravity
      p.rot += dt * 16;

      // Check impact with Street Obstacles (can stun dogs/dancers with a paper!)
      let hitSomething = false;
      for (let oIdx = this.obstacles.length - 1; oIdx >= 0; oIdx--) {
        const ob = this.obstacles[oIdx];
        if (ob.type === 'CAR') continue;
        const ox = this._projectX(ob.laneX, ob.y);
        if (Math.hypot(p.x - ox, p.y - ob.y) < 24) {
          this._addScore(125, ox, ob.y, 'BONK +125!', PALETTE.CYAN);
          this.audio.playHit();
          this._spawnSparks(ox, ob.y, ob.color, 10);
          this.obstacles.splice(oIdx, 1);
          this.thrownPapers.splice(i, 1);
          hitSomething = true;
          break;
        }
      }
      if (hitSomething) continue;

      // Check impact when paper descends to target height (z <= 14) or reaches house yard/facade (x < 310)
      if (p.z <= 14 || p.x < 310) {
        let resolved = false;
        for (const h of this.houses) {
          const hx = this._projectX(40, h.y);
          const mbX = hx + h.mailboxOffset.rx;
          const mbY = h.y + h.mailboxOffset.ry;

          // 1. Window Smash Check! (Evaluated first so elevated papers shatter windows instead of being swallowed by porch)
          for (const win of h.windows) {
            const wx = hx + win.rx + win.w / 2;
            const wy = h.y + win.ry + win.h / 2;
            const paperScreenY = p.y - p.z;
            const dy = Math.min(Math.abs(paperScreenY - wy), Math.abs(p.y - wy));
            if (!win.broken && Math.abs(p.x - wx) < win.w * 1.15 && dy < win.h * 1.35) {
              win.broken = true;
              resolved = true;
              this.audio.playExplosion(0.22, 2200);
              this._spawnSparks(wx, wy, PALETTE.WHITE, 16);
              this._spawnSparks(wx, wy, PALETTE.CYAN, 8);
              if (h.isSubscriber) {
                h.isSubscriber = false;
                h.accent = PALETTE.RED;
                this._addScore(-100, wx, wy - 10, 'SUBSCRIBER LOST!', PALETTE.RED);
              } else {
                this._addScore(150, wx, wy - 10, 'WINDOW SMASH +150!', PALETTE.PINK);
              }
              break;
            }
          }
          if (resolved) break;

          // 2. Direct Mailbox Hit! (Mailbox is along the sidewalk curb)
          if (!h.mailboxHit && p.z <= 22 && Math.hypot(p.x - mbX, p.y - mbY) < 32) {
            h.mailboxHit = true;
            resolved = true;
            if (h.isSubscriber) {
              this.housesDelivered++;
              this.audio.playPowerUp();
              this._addScore(250, mbX, mbY - 12, 'MAILBOX +250!', PALETTE.GOLD);
              this._spawnSparks(mbX, mbY, PALETTE.GOLD, 16);
            } else {
              this.audio.playCoin();
              this._addScore(100, mbX, mbY - 12, 'BONUS BOX +100', PALETTE.CYAN);
            }
            break;
          }

          // 3. Porch / Doormat Delivery Check (Only when paper drops to ground height z <= 18)
          const porchX = hx + 245;
          const porchY = h.y + 8;
          if (
            !h.porchdelivered &&
            p.z <= 18 &&
            Math.abs(p.x - porchX) < 58 &&
            Math.abs(p.y - porchY) < 46
          ) {
            h.porchdelivered = true;
            resolved = true;
            if (h.isSubscriber) {
              this.housesDelivered++;
              this.audio.playCoin();
              this._addScore(150, porchX, porchY - 10, 'PORCH +150!', PALETTE.GREEN);
              this._spawnSparks(porchX, porchY, PALETTE.GREEN, 12);
            } else {
              this.audio.playHop();
              this._addScore(50, porchX, porchY - 10, '+50', PALETTE.WHITE);
            }
            break;
          }
        }

        if (resolved || p.z <= 0 || p.x < 30) {
          this.thrownPapers.splice(i, 1);
        }
      }
    }

    // Particles & Popups
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += (pt.vy + scrollDelta * 0.5) * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 28 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }

    // Check Route Completion (Day Complete -> Next Street Wave or 7-Day Sunday Victory)
    if (this.housesDelivered >= this.subscriberGoal) {
      if (this.level >= 7) {
        // Grand 7-Day Week Completion & Retirement Victory!
        this.state = 'VICTORY';
        this.audio.playStageClear();
        this._addScore(10000, this.width / 2, 160, '7-DAY SUNDAY COMPLETE! +10,000', PALETTE.GOLD);
        this._spawnSparks(this.width / 2, 270, PALETTE.GOLD, 48);
        this._spawnSparks(this.width / 2, 270, PALETTE.CYAN, 32);
        return;
      }
      const prevDay = DAYS_OF_WEEK[(this.level - 1) % DAYS_OF_WEEK.length];
      this.housesDelivered = 0;
      this.level++;
      const nextDay = DAYS_OF_WEEK[(this.level - 1) % DAYS_OF_WEEK.length];
      this.papersLeft = 20; // Full fresh supply for the new delivery day!
      this.audio.playStageClear();
      this._addScore(1500, this.width / 2, 160, `${prevDay} COMPLETE! +1500 (${nextDay} NEXT)`, PALETTE.GOLD);
      this._spawnSparks(this.width / 2, 180, PALETTE.GOLD, 24);
    }
  }

  _drawStreetAndSidewalk(ctx) {
    // Draw diagonal sidewalk, curb, and 2-lane asphalt street
    const topY = ARENA_TOP;
    const botY = this.height;

    const polyStrip = (laneLeft, laneRight, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(this._projectX(laneLeft, topY), topY);
      ctx.lineTo(this._projectX(laneRight, topY), topY);
      ctx.lineTo(this._projectX(laneRight, botY), botY);
      ctx.lineTo(this._projectX(laneLeft, botY), botY);
      ctx.closePath();
      ctx.fill();
    };

    // Front yards / Lawns on left
    polyStrip(-120, 390, '#0E2923');
    // Concrete Sidewalk
    polyStrip(390, 475, '#334155');
    // Curb highlight
    polyStrip(475, 483, PALETTE.CYAN);
    // Asphalt Street
    polyStrip(483, 795, '#111827');
    // Right curb & verge
    polyStrip(795, 803, PALETTE.PINK);
    polyStrip(803, 1080, '#0F172A');

    // Scrolling sidewalk joints & dashed road center divider
    const stripeSpacing = 60;
    const offset = this.scrollDist % stripeSpacing;
    ctx.strokeStyle = PALETTE.GOLD;
    ctx.lineWidth = 3;
    for (let y = topY - stripeSpacing + offset; y < botY + stripeSpacing; y += stripeSpacing) {
      const x1 = this._projectX(635, y);
      const x2 = this._projectX(635, y + 28);
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y + 28);
      ctx.stroke();

      // Sidewalk seam line
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this._projectX(390, y), y);
      ctx.lineTo(this._projectX(475, y), y);
      ctx.stroke();
      ctx.strokeStyle = PALETTE.GOLD;
      ctx.lineWidth = 3;
    }
  }

  _drawHouse(ctx, h) {
    const hx = this._projectX(40, h.y);
    const hy = h.y;

    ctx.save();
    // Lawn path to porch
    ctx.fillStyle = h.isSubscriber ? 'rgba(0, 240, 255, 0.16)' : 'rgba(255, 42, 85, 0.08)';
    ctx.fillRect(hx + 210, hy - 14, 150, 44);

    // House body
    ctx.fillStyle = h.wallColor;
    ctx.fillRect(hx + 70, hy - 55, 165, 82);
    ctx.strokeStyle = h.accent;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = h.accent;
    ctx.shadowBlur = h.isSubscriber ? 10 : 4;
    ctx.strokeRect(hx + 70, hy - 55, 165, 82);
    ctx.shadowBlur = 0;

    // Angled Roof
    ctx.fillStyle = h.roofColor;
    ctx.beginPath();
    ctx.moveTo(hx + 58, hy - 55);
    ctx.lineTo(hx + 95, hy - 92);
    ctx.lineTo(hx + 220, hy - 92);
    ctx.lineTo(hx + 245, hy - 55);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = h.accent;
    ctx.stroke();

    // Subscriber vs Non-Subscriber Roof Sign
    this.renderer.drawText(
      h.isSubscriber ? '★ SUBSCRIBER ★' : 'NON-SUB (SMASH WINDOWS!)',
      hx + 152,
      hy - 68,
      {
        font: FONTS.HUD,
        size: 10,
        color: h.accent,
        align: 'center',
        glow: h.isSubscriber ? 6 : 0
      }
    );

    // Windows
    for (const win of h.windows) {
      const wx = hx + win.rx;
      const wy = hy + win.ry;
      ctx.fillStyle = win.broken ? '#05070B' : h.isSubscriber ? 'rgba(255, 215, 0, 0.78)' : 'rgba(255, 42, 85, 0.45)';
      ctx.fillRect(wx, wy, win.w, win.h);
      ctx.strokeStyle = h.accent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(wx, wy, win.w, win.h);

      if (win.broken) {
        // Jagged broken glass shards
        ctx.strokeStyle = PALETTE.WHITE;
        ctx.beginPath();
        ctx.moveTo(wx + 4, wy + 4);
        ctx.lineTo(wx + win.w - 5, wy + win.h - 4);
        ctx.moveTo(wx + win.w - 4, wy + 5);
        ctx.lineTo(wx + 6, wy + win.h - 5);
        ctx.stroke();
      }
    }

    // Porch & Target Doormat
    const porchX = hx + 235;
    const porchY = hy - 12;
    ctx.strokeStyle = h.porchdelivered ? PALETTE.GREEN : h.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(porchX, porchY, 38, 36);
    if (h.porchdelivered) {
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(porchX + 10, porchY + 12, 16, 7);
    }

    // Target Mailbox by the Sidewalk
    const mbX = hx + h.mailboxOffset.rx;
    const mbY = hy + h.mailboxOffset.ry;
    ctx.fillStyle = '#475569';
    ctx.fillRect(mbX - 2, mbY, 5, 16);
    const boxColor = h.mailboxHit ? PALETTE.GREEN : h.isSubscriber ? PALETTE.GOLD : PALETTE.MUTED;
    this.renderer.drawGlowRect(mbX - 13, mbY - 12, 26, 15, boxColor, h.isSubscriber ? 10 : 0, true);
    this.renderer.drawText('MAIL', mbX, mbY - 2, {
      font: FONTS.HUD,
      size: 8,
      color: PALETTE.BG,
      align: 'center'
    });

    ctx.restore();
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear(PALETTE.BG);

    // Street, Sidewalk & Yards
    this._drawStreetAndSidewalk(ctx);

    // Render Houses sorted top-to-bottom
    for (const h of this.houses) {
      if (h.y > ARENA_TOP - 80 && h.y < this.height + 120) {
        this._drawHouse(ctx, h);
      }
    }

    // Render Newspaper Pickup Bundles on Sidewalk
    for (const b of this.bundles) {
      const bx = this._projectX(b.laneX, b.y);
      this.renderer.drawGlowRect(bx - 11, b.y - 8, 22, 16, PALETTE.WHITE, 8, true);
      ctx.strokeStyle = PALETTE.PINK;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx - 11, b.y - 8, 22, 16);
    }

    // Render Street Obstacles (Cars, Chasing Dogs, Breakdancers, Lawnmowers)
    for (const ob of this.obstacles) {
      const ox = this._projectX(ob.laneX, ob.y);
      ctx.save();
      ctx.translate(ox, ob.y);
      if (ob.type === 'CAR') {
        // Drop shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(-20, -32, 44, 70);

        // 4 Protruding Rubber Wheels
        ctx.fillStyle = '#090D16';
        ctx.fillRect(-24, -26, 5, 14);
        ctx.fillRect(19, -26, 5, 14);
        ctx.fillRect(-24, 12, 5, 14);
        ctx.fillRect(19, 12, 5, 14);

        // Main Car Chassis
        this.renderer.drawGlowRect(-20, -34, 40, 68, ob.color, 8, true);

        // Chrome Bumpers
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(-19, -36, 38, 3);
        ctx.fillRect(-19, 33, 38, 3);

        // Roof & Tinted Windshields
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-16, -20, 32, 36);
        // Front & Rear Windshield Glass
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(-14, 6, 28, 9);
        ctx.fillRect(-14, -18, 28, 7);
        // Roof panel
        ctx.fillStyle = ob.color;
        ctx.fillRect(-14, -9, 28, 13);
        // Windshield glare line
        ctx.strokeStyle = PALETTE.WHITE;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-10, 8);
        ctx.lineTo(-3, 13);
        ctx.stroke();

        // Headlights & Taillights
        ctx.fillStyle = PALETTE.GOLD;
        ctx.shadowColor = PALETTE.GOLD;
        ctx.shadowBlur = 8;
        ctx.fillRect(-16, 29, 9, 5);
        ctx.fillRect(7, 29, 9, 5);
        ctx.shadowBlur = 0;
        ctx.fillStyle = PALETTE.RED;
        ctx.fillRect(-16, -33, 8, 4);
        ctx.fillRect(8, -33, 8, 4);
      } else if (ob.type === 'DOG') {
        const runSwing = Math.sin(ob.phase * 1.8) * 4;
        const wag = Math.sin(ob.phase * 2.6) * 5;
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 9, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Animated running legs
        ctx.fillStyle = '#9A3412';
        ctx.fillRect(-10 + runSwing, 4, 4, 7);
        ctx.fillRect(-4 - runSwing, 4, 4, 7);
        ctx.fillRect(4 + runSwing, 4, 4, 7);
        ctx.fillRect(9 - runSwing, 4, 4, 7);

        // Wagging Tail
        ctx.strokeStyle = PALETTE.ORANGE;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-12, -2);
        ctx.lineTo(-19, -7 + wag);
        ctx.stroke();

        // Hound Body & Collar
        this.renderer.drawGlowRect(-12, -6, 22, 11, PALETTE.ORANGE, 6, true);
        ctx.fillStyle = PALETTE.RED;
        ctx.fillRect(6, -6, 3, 11);

        // Dog Head, Snout & Floppy Ears
        ctx.fillStyle = PALETTE.ORANGE;
        ctx.fillRect(7, -13, 10, 9);
        ctx.fillRect(15, -10, 6, 5);
        // Floppy Ear
        ctx.fillStyle = '#7C2D12';
        ctx.fillRect(8, -11, 4, 7);
        // Eye & Nose
        ctx.fillStyle = PALETTE.WHITE;
        ctx.fillRect(13, -12, 3, 3);
        ctx.fillStyle = '#090D16';
        ctx.fillRect(19, -10, 3, 3);
      } else if (ob.type === 'DANCER') {
        // Corrugated Cardboard Mat + Boombox Radio
        ctx.fillStyle = '#92400E';
        ctx.fillRect(-20, -15, 40, 30);
        ctx.strokeStyle = '#B45309';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-20, -15, 40, 30);

        // Boombox stereo beside mat
        ctx.fillStyle = '#334155';
        ctx.fillRect(14, -18, 14, 9);
        ctx.fillStyle = '#090D16';
        ctx.fillRect(16, -16, 4, 5);
        ctx.fillRect(22, -16, 4, 5);

        // Spinning Breakdancer in Tracksuit & Sneakers
        ctx.save();
        ctx.rotate(ob.phase);
        // Windmill legs & white sneakers
        ctx.strokeStyle = PALETTE.CYAN;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-14, -4);
        ctx.lineTo(14, 4);
        ctx.moveTo(-6, 12);
        ctx.lineTo(6, -12);
        ctx.stroke();
        ctx.fillStyle = PALETTE.WHITE;
        ctx.fillRect(-16, -6, 4, 4);
        ctx.fillRect(12, 2, 4, 4);
        // Tracksuit torso & headspin cap
        this.renderer.drawGlowRect(-7, -7, 14, 14, PALETTE.PURPLE, 8, true);
        this.renderer.drawGlowCircle(0, 0, 5, PALETTE.GOLD, 4, true);
        ctx.restore();
      } else if (ob.type === 'TIRE') {
        // Runaway Motorized Lawnmower
        const jitter = Math.sin(ob.phase * 4) * 1.2;
        ctx.translate(jitter, 0);
        // Chrome Push Handlebar
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-8, -6);
        ctx.lineTo(-14, -18);
        ctx.moveTo(8, -6);
        ctx.lineTo(14, -18);
        ctx.moveTo(-14, -18);
        ctx.lineTo(14, -18);
        ctx.stroke();

        // 4 Lawnmower Wheels
        ctx.fillStyle = '#090D16';
        ctx.fillRect(-14, -9, 4, 7);
        ctx.fillRect(10, -9, 4, 7);
        ctx.fillRect(-14, 3, 4, 7);
        ctx.fillRect(10, 3, 4, 7);

        // Red Mower Deck & Silver Engine Block
        this.renderer.drawGlowRect(-11, -10, 22, 20, PALETTE.RED, 8, true);
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(-6, -5, 12, 10);
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(-3, -2, 6, 4);
      }
      ctx.restore();
    }

    // Render Thrown Rolled Newspapers with Parabolic Shadow
    for (const p of this.thrownPapers) {
      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Elevated spinning newspaper roll
      ctx.save();
      ctx.translate(p.x, p.y - p.z);
      ctx.rotate(p.rot);
      this.renderer.drawGlowRect(-9, -4, 18, 8, PALETTE.WHITE, 8, true);
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(-2, -4, 4, 8);
      ctx.restore();
    }

    // Render Paperboy Pedaling Bicycle with Handlebar Newspaper Bag
    const r = this.rider;
    const rx = this._projectX(r.laneX, r.y);
    const visible = r.invuln <= 0 || Math.floor(r.invuln * 14) % 2 === 0;
    if (visible) {
      ctx.save();
      ctx.translate(rx, r.y);
      if (r.crashTimer > 0) {
        ctx.rotate(r.crashTimer * 8);
      }

      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 6, 12, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      // Front & Rear Rubber Tires
      ctx.fillStyle = '#090D16';
      ctx.fillRect(-3.5, -26, 7, 14);
      ctx.fillRect(-3.5, 10, 7, 14);
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(-1.5, -23, 3, 8);
      ctx.fillRect(-1.5, 13, 3, 8);

      // Red Bicycle Frame Tube
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(-2.5, -16, 5, 28);

      // Chrome Handlebars & Grips
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-15, -13);
      ctx.lineTo(-8, -17);
      ctx.lineTo(8, -17);
      ctx.lineTo(15, -13);
      ctx.stroke();
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(-17, -14, 4, 4);
      ctx.fillRect(13, -14, 4, 4);

      // Canvas Handlebar Newspaper Bag stuffed with rolled papers
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(-9, -23, 18, 7);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-9, -23, 18, 7);
      if (this.papersLeft > 0) {
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(-6, -25, 4, 3);
        ctx.fillRect(2, -25, 4, 3);
      }

      // Animated Pedaling Legs & Sneakers
      const leftPedalY = Math.sin(r.pedalPhase * 2.2) * 5;
      const rightPedalY = -leftPedalY;
      ctx.fillStyle = '#1D4ED8';
      ctx.fillRect(-10, -2 + leftPedalY, 5, 11);
      ctx.fillRect(5, -2 + rightPedalY, 5, 11);
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(-10, 7 + leftPedalY, 5, 3);
      ctx.fillRect(5, 7 + rightPedalY, 5, 3);

      // Rider Arms reaching to Handlebars
      ctx.strokeStyle = '#FDBA74';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-13, -13);
      ctx.moveTo(8, -4);
      ctx.lineTo(13, -13);
      ctx.stroke();

      // Rider Varsity Jacket Torso & Canvas Shoulder Strap
      this.renderer.drawGlowRect(-9, -8, 18, 15, PALETTE.CYAN, 8, true);
      ctx.strokeStyle = PALETTE.WHITE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, -7);
      ctx.lineTo(8, 6);
      ctx.stroke();

      // Baseball Cap & Visor pointing forward
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(-5, -13, 10, 5);
      this.renderer.drawGlowCircle(0, -5, 6.5, PALETTE.GOLD, 6, true);
      ctx.restore();
    }

    // Particles & Popups
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

    // Top HUD with Day of the Week indicator
    const dayName = DAYS_OF_WEEK[(this.level - 1) % DAYS_OF_WEEK.length];
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `${dayName} (${Math.min(7, this.level)}/7) | PAPERS: ${this.papersLeft} | GOAL: ${this.housesDelivered}/${this.subscriberGoal}`,
      accent: PALETTE.GOLD
    });

    // State Overlay or Grand 7-Day Victory Newspaper
    if (this.state === 'VICTORY') {
      this._drawVictoryOverlay(ctx);
    } else {
      this.renderer.drawStateOverlay(this.state, {
        title: this.title,
        subtitle: `1985 SUBURBAN RUN — ${dayName} DELIVERY`,
        controls: 'ARROWS/WASD: STEER & SPEED  |  Z/SPACE: THROW PAPER  |  X/SHIFT: LONG THROW',
        score: this.score,
        highScore: this.highScore,
        accent: PALETTE.GOLD
      });
    }
  }

  _drawVictoryOverlay(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 8, 16, 0.88)';
    ctx.fillRect(0, 38, this.width, this.height - 38);

    const pw = 680;
    const ph = 380;
    const px = (this.width - pw) / 2;
    const py = (this.height - ph) / 2 + 10;

    // Newsprint background (authentic parchment paper texture)
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 4;
    ctx.strokeRect(px, py, pw, ph);

    // Inner newspaper borders
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 8, py + 8, pw - 16, ph - 16);

    // Newspaper Masthead Header
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(px + 12, py + 12, pw - 24, 48);
    this.renderer.drawText('THE DAILY SUN', this.width / 2, py + 44, {
      font: FONTS.HEADER,
      size: 26,
      color: PALETTE.GOLD,
      align: 'center',
      glow: 6
    });

    // Sub-banner
    this.renderer.drawText(
      'SPECIAL SUNDAY EDITION  •  7-DAY SUBURBAN DELIVERY MARATHON COMPLETE  •  FINAL VICTORY',
      this.width / 2,
      py + 76,
      {
        font: FONTS.HUD,
        size: 9.5,
        color: '#475569',
        align: 'center'
      }
    );

    // Main Victory Headline
    this.renderer.drawText('★ PAPERBOY CONQUERS THE 7-DAY WEEK! ★', this.width / 2, py + 118, {
      font: FONTS.HEADER,
      size: 19,
      color: '#0F172A',
      align: 'center'
    });

    // Story columns
    const story1 =
      'After 7 grueling days braving speeding cars, attack dogs, runaway lawnmowers, and breakdancers, our courier delivered all Sunday editions!';
    const story2 =
      'Subscribers rejoice across suburbia! With a full pension secured and eternal fame in the Arcade Hall of Fame, the Paperboy retires in triumph!';

    this.renderer.drawText(story1, this.width / 2, py + 152, {
      font: FONTS.HUD,
      size: 10.5,
      color: '#334155',
      align: 'center'
    });
    this.renderer.drawText(story2, this.width / 2, py + 178, {
      font: FONTS.HUD,
      size: 10.5,
      color: '#334155',
      align: 'center'
    });

    // Score & Retirement Bonus Box
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(px + 100, py + 214, pw - 200, 68);
    ctx.strokeStyle = PALETTE.GOLD;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 100, py + 214, pw - 200, 68);

    this.renderer.drawText(
      `FINAL SCORE: ${String(Math.floor(this.score)).padStart(6, '0')}    HIGH SCORE: ${String(Math.floor(this.highScore)).padStart(6, '0')}`,
      this.width / 2,
      py + 238,
      {
        font: FONTS.HEADER,
        size: 12.5,
        color: PALETTE.GOLD,
        align: 'center'
      }
    );
    this.renderer.drawText('WEEK COMPLETION BONUS: +10,000 PTS  |  RANK: MASTER COURIER', this.width / 2, py + 264, {
      font: FONTS.HUD,
      size: 10.5,
      color: PALETTE.CYAN,
      align: 'center'
    });

    // Restart prompt
    const pulse = 0.65 + 0.35 * Math.sin(performance.now() * 0.007);
    ctx.globalAlpha = pulse;
    this.renderer.drawText('PRESS [SPACE / Z / TAP] TO START A NEW 7-DAY ROUTE', this.width / 2, py + 330, {
      font: FONTS.HEADER,
      size: 11.5,
      color: '#0F172A',
      align: 'center'
    });
    ctx.globalAlpha = 1.0;

    ctx.restore();
  }
}

export default Paperboy;
