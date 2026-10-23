/**
 * Galaxian.js
 * Classic 1979 Namco Arcade Space Shooter (Star Swarm) for Retro Arcade Studio.
 *
 * Features:
 * - Shimmering RGB arcade starfield & convecting 46-alien fleet formation:
 *   - 2 Flagship Galaxians (top row), 6 Red Commanders, 8 Purple Emissaries, 30 Cyan Hornets
 * - Curved peel-off loop + sinusoidal dive-bombing attack runs with enemy missile volleys
 * - Authentic Flagship + 2 Red Escort V-formation dives (up to 800 Mystery Bonus points!)
 * - Detailed pixel-art Galaxip starfighter with nose missile visually docked until fired
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const SPRITES = {
  GALAXIP_LOADED: [
    '.....YY.....',
    '.....YY.....',
    '....YYYY....',
    '....WWWW....',
    '...WWBBWW...',
    '..WRWWWWWR..',
    '..WRWWWWWR..',
    '.WWRWWWWWRWW',
    'WWWRRWWWRRWW',
    'WW.RR..RR.WW',
    'W..R....R..W'
  ],
  GALAXIP_EMPTY: [
    '............',
    '............',
    '.....WW.....',
    '....WWWW....',
    '...WWBBWW...',
    '..WRWWWWWR..',
    '..WRWWWWWR..',
    '.WWRWWWWWRWW',
    'WWWRRWWWRRWW',
    'WW.RR..RR.WW',
    'W..R....R..W'
  ],
  FLAGSHIP: [
    '....YYYY....',
    '..YYYYYYYY..',
    '.YYRRRRRRYY.',
    'YYRRRRRRRRYY',
    'YYRBBBBBBBRY',
    '.YYBBBBBBYY.',
    '..YYYYYYYY..',
    '.YY.YYYY.YY.',
    'YY...YY...YY'
  ],
  COMMANDER_0: [
    '..RR....RR..',
    '.RRRR..RRRR.',
    'RRRRYYYYRRRR',
    'RRRYYYYYYRRR',
    '.RRRRRRRRRR.',
    '..RRYYYYRR..',
    '...RRRRRR...',
    '..RR.RR.RR..',
    '.RR......RR.'
  ],
  COMMANDER_1: [
    '....R..R....',
    '..RRR..RRR..',
    '.RRRYYYYRRR.',
    '.RRYYYYYYRR.',
    '..RRRRRRRR..',
    '...RYYYYR...',
    '...RRRRRR...',
    '....R..R....',
    '............'
  ],
  EMISSARY_0: [
    '..PP....PP..',
    '.PPPP..PPPP.',
    'PPPPCCCCPPPP',
    '.PPPPPPPPPP.',
    '..PPWWWWPP..',
    '...PPPPPP...',
    '..PP.PP.PP..',
    '.PP......PP.'
  ],
  EMISSARY_1: [
    '....P..P....',
    '..PPP..PPP..',
    '.PPPCCCCPPP.',
    '..PPPPPPPP..',
    '...PWWWWP...',
    '...PPPPPP...',
    '....P..P....',
    '............'
  ],
  HORNET_0: [
    '..CC....CC..',
    '.CCCC..CCCC.',
    'CCCCRRRRCCCC',
    '.CCCCCCCCCC.',
    '..CCYYYYCC..',
    '...CCCCCC...',
    '..CC.CC.CC..',
    '.CC......CC.'
  ],
  HORNET_1: [
    '....C..C....',
    '..CCC..CCC..',
    '.CCCRRRRCCC.',
    '..CCCCCCCC..',
    '...CYYYYC...',
    '...CCCCCC...',
    '....C..C....',
    '............'
  ]
};

const SPRITE_PALETTE = {
  W: PALETTE.WHITE,
  Y: PALETTE.GOLD,
  R: PALETTE.RED,
  B: PALETTE.BLUE,
  C: PALETTE.CYAN,
  P: PALETTE.PURPLE
};

export class Galaxian {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'galaxian';
    this.title = 'Galaxian';
    this.state = 'PLAYING';

    this.width = 960;
    this.height = 540;
    this.highScore = HighScoreStore.get(this.id);

    this.stars = [];
    this._initStars();
    this.reset();
  }

  _initStars() {
    this.stars = [];
    const colors = [PALETTE.RED, PALETTE.CYAN, PALETTE.GOLD, PALETTE.GREEN, PALETTE.PURPLE, PALETTE.WHITE];
    for (let i = 0; i < 95; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: 40 + Math.random() * (this.height - 40),
        speed: 35 + Math.random() * 85,
        size: i % 4 === 0 ? 2.5 : 2,
        color: colors[i % colors.length],
        blinkTimer: Math.random() * 1.5,
        blinkRate: 2.5 + Math.random() * 5
      });
    }
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.player = {
      x: this.width / 2,
      y: 488,
      speed: 320,
      invuln: 1.5,
      dashCooldown: 0,
      dashTimer: 0,
      dashDir: 0
    };

    // Single nose-docked missile (authentic Galaxian mechanic, fast travel)
    this.missile = null;
    this.enemyMissiles = [];
    this.aliens = [];
    this.particles = [];
    this.floatingTexts = [];

    this.swayTime = 0;
    this.swayOffsetX = 0;
    this.diveTimer = 1.4;
    this.humTimer = 0;
    this.bannerText = 'WE ARE THE GALAXIANS — MISSION 1';
    this.bannerTimer = 2.0;

    this._spawnFleet(this.level);
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    if (this.audio) {
      this.audio.stopSequence();
    }
  }

  _getSlotPosition(row, col) {
    const spacingX = 48;
    const spacingY = 32;
    const centerCol = 4.5;
    const breathe = 1 + Math.sin(this.swayTime * 2.4) * 0.06;
    const x = this.width / 2 + this.swayOffsetX + (col - centerCol) * spacingX * breathe;
    const y = 82 + row * spacingY;
    return { x, y };
  }

  _spawnFleet(level) {
    this.aliens = [];
    this.enemyMissiles = [];
    this.diveTimer = Math.max(0.65, 1.55 - level * 0.1);

    let idCounter = 1;
    const addAlien = (row, col, type) => {
      const pos = this._getSlotPosition(row, col);
      this.aliens.push({
        id: idCounter++,
        row,
        col,
        type, // 'flagship' | 'commander' | 'emissary' | 'hornet'
        x: pos.x,
        y: pos.y,
        angle: 0,
        state: 'formation', // 'formation' | 'peeling' | 'diving' | 'returning'
        timer: 0,
        peelDir: col < 4.5 ? -1 : 1,
        startX: pos.x,
        startY: pos.y,
        targetX: this.width / 2,
        vx: 0,
        vy: 0,
        fireCooldown: 0,
        escortsTotal: 0,
        escortsKilled: 0,
        leaderId: null
      });
    };

    // Row 0: 2 Flagship Galaxians (cols 3 and 6)
    addAlien(0, 3, 'flagship');
    addAlien(0, 6, 'flagship');

    // Row 1: 6 Red Commanders (cols 2..7)
    for (let c = 2; c <= 7; c++) {
      addAlien(1, c, 'commander');
    }

    // Row 2: 8 Purple Emissaries (cols 1..8)
    for (let c = 1; c <= 8; c++) {
      addAlien(2, c, 'emissary');
    }

    // Rows 3..5: 30 Cyan Hornets (cols 0..9)
    for (let r = 3; r <= 5; r++) {
      for (let c = 0; c <= 9; c++) {
        addAlien(r, c, 'hornet');
      }
    }
  }

  _startDive(alien, leader = null, escortOffsetX = 0) {
    alien.state = 'peeling';
    alien.timer = 0;
    alien.startX = alien.x;
    alien.startY = alien.y;
    alien.peelDir = leader ? leader.peelDir : alien.col < 4.5 ? -1 : 1;
    alien.leaderId = leader ? leader.id : null;
    alien.escortOffsetX = escortOffsetX;
    alien.fireCooldown = 0.35 + Math.random() * 0.35;
  }

  _dispatchDiveGroup() {
    const inFormation = this.aliens.filter((a) => a.state === 'formation');
    if (inFormation.length === 0) return;

    // 28% chance to launch a Flagship + 2 Red Commanders escort V-formation!
    const flagships = inFormation.filter((a) => a.type === 'flagship');
    if (flagships.length > 0 && Math.random() < 0.28) {
      const flag = flagships[Math.floor(Math.random() * flagships.length)];
      const escorts = inFormation
        .filter((a) => a.type === 'commander' && Math.abs(a.col - flag.col) <= 2)
        .slice(0, 2);

      flag.escortsTotal = escorts.length;
      flag.escortsKilled = 0;
      this._startDive(flag, null, 0);

      escorts.forEach((esc, idx) => {
        const offsetX = idx === 0 ? -34 : 34;
        this._startDive(esc, flag, offsetX);
      });
      this.audio.playSiren(0.2, false);
      return;
    }

    // Otherwise pick 1 or 2 flankers from outer columns
    const sorted = [...inFormation].sort(
      (a, b) => Math.abs(b.col - 4.5) - Math.abs(a.col - 4.5)
    );
    const pool = sorted.slice(0, Math.min(8, sorted.length));
    const diver = pool[Math.floor(Math.random() * pool.length)];
    this._startDive(diver, null, 0);
  }

  update(dt) {
    const clampedDt = Math.min(dt, 0.05);

    // Update shimmering starfield
    for (const s of this.stars) {
      s.y += s.speed * clampedDt;
      s.blinkTimer += s.blinkRate * clampedDt;
      if (s.y > this.height) {
        s.y = 40;
        s.x = Math.random() * this.width;
      }
    }

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

    if (this.bannerTimer > 0) {
      this.bannerTimer = Math.max(0, this.bannerTimer - clampedDt);
    }

    // Convecting swarm sway & background pulse
    this.swayTime += clampedDt;
    this.swayOffsetX = Math.sin(this.swayTime * 1.35) * 145;

    this.humTimer -= clampedDt;
    if (this.humTimer <= 0) {
      this.humTimer = 0.28;
      this.audio.playMarch();
    }

    this._updatePlayer(clampedDt);
    this._updateMissile(clampedDt);
    this._updateAliens(clampedDt);
    this._updateEnemyMissiles(clampedDt);
    this._updateParticles(clampedDt);

    if (this.aliens.length === 0) {
      this.level += 1;
      this.bannerText = `FLAGSHIP ARMADA ${this.level} — PREPARE FOR DIVE`;
      this.bannerTimer = 2.2;
      this.audio.playStageClear();
      this._spawnFleet(this.level);
    }
  }

  _updatePlayer(dt) {
    const p = this.player;
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (p.dashCooldown > 0) p.dashCooldown = Math.max(0, p.dashCooldown - dt);

    const axis = this.input.getAxis();
    let moveX = axis.x;
    if (this.input.pointer.down && this.input.pointer.y > 40) {
      const diff = this.input.pointer.x - p.x;
      if (Math.abs(diff) > 6) moveX = Math.max(-1, Math.min(1, diff / 45));
    }

    // Action B: Tactical thruster evasive boost
    if (this.input.isJustPressed('actionB') && p.dashCooldown <= 0) {
      p.dashTimer = 0.16;
      p.dashCooldown = 0.75;
      p.dashDir = moveX !== 0 ? Math.sign(moveX) : 1;
      this.audio.playHop();
    }

    let speed = p.speed;
    if (p.dashTimer > 0) {
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      speed = p.speed * 2.2;
      moveX = p.dashDir;
    }

    p.x = Math.max(36, Math.min(this.width - 36, p.x + moveX * speed * dt));

    // Action A: Fire nose-docked missile
    const wantsFire =
      this.input.isJustPressed('actionA') ||
      this.input.isDown('actionA') ||
      this.input.pointer.down;

    if (wantsFire && !this.missile) {
      this.missile = {
        x: p.x,
        y: p.y - 16,
        vy: -740
      };
      this.audio.playLaser(1350, 320, 0.09);
    }
  }

  _updateMissile(dt) {
    if (!this.missile) return;
    this.missile.y += this.missile.vy * dt;

    if (this.missile.y < 38) {
      this.missile = null;
      return;
    }

    for (let i = this.aliens.length - 1; i >= 0; i--) {
      const a = this.aliens[i];
      if (Math.abs(this.missile.x - a.x) < 16 && Math.abs(this.missile.y - a.y) < 14) {
        this._destroyAlien(i);
        this.missile = null;
        return;
      }
    }
  }

  _updateAliens(dt) {
    this.diveTimer -= dt;
    if (this.diveTimer <= 0) {
      this.diveTimer = Math.max(0.55, 1.45 - this.level * 0.09);
      this._dispatchDiveGroup();
    }

    const diveSpeed = 235 + Math.min(130, this.level * 18);

    for (let i = this.aliens.length - 1; i >= 0; i--) {
      const a = this.aliens[i];
      const slot = this._getSlotPosition(a.row, a.col);

      if (a.state === 'formation') {
        a.x += (slot.x - a.x) * Math.min(1, dt * 12);
        a.y += (slot.y - a.y) * Math.min(1, dt * 12);
        a.angle = 0;
      } else if (a.state === 'peeling') {
        // Peel upward and outward in an arc for 0.48s before swooping down
        a.timer += dt;
        const t = Math.min(1, a.timer / 0.48);
        const arcAngle = -Math.PI / 2 + a.peelDir * t * Math.PI;
        const radius = 38;
        const centerX = a.startX + a.peelDir * radius;
        const centerY = a.startY;
        const prevX = a.x;
        const prevY = a.y;
        a.x = centerX - a.peelDir * Math.cos(t * Math.PI) * radius;
        a.y = centerY - Math.sin(t * Math.PI) * radius;
        a.angle = Math.atan2(a.y - prevY, a.x - prevX) + Math.PI / 2;

        if (t >= 1) {
          a.state = 'diving';
          a.timer = 0;
          a.targetX = this.player.x + (a.escortOffsetX || 0);
        }
      } else if (a.state === 'diving') {
        a.timer += dt;
        const prevX = a.x;
        const prevY = a.y;

        // Sinusoidal swoop tracking toward player X
        const steer = (this.player.x + (a.escortOffsetX || 0) - a.x) * 1.4;
        const wave = Math.cos(a.timer * 5.2) * 140 * a.peelDir;
        a.vx = Math.max(-260, Math.min(260, steer + wave));
        a.vy = diveSpeed;

        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.angle = Math.atan2(a.y - prevY, a.x - prevX) + Math.PI / 2;

        // Fire enemy missiles during dive
        a.fireCooldown -= dt;
        if (a.fireCooldown <= 0 && a.y > 110 && a.y < 390) {
          a.fireCooldown = Math.max(0.45, 0.85 - this.level * 0.04);
          const dx = this.player.x - a.x;
          const dy = this.player.y - a.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          this.enemyMissiles.push({
            x: a.x,
            y: a.y + 10,
            vx: (dx / dist) * 170,
            vy: 290 + this.level * 15
          });
        }

        if (a.y > this.height + 24) {
          a.y = 42;
          a.state = 'returning';
        }
      } else if (a.state === 'returning') {
        const dx = slot.x - a.x;
        const dy = slot.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 10) {
          a.state = 'formation';
          a.angle = 0;
          a.leaderId = null;
        } else {
          a.x += (dx / dist) * 280 * dt;
          a.y += (dy / dist) * 280 * dt;
          a.angle = Math.atan2(dy, dx) + Math.PI / 2;
        }
      }

      // Check collision with Galaxip
      if (this.player.invuln <= 0 && Math.hypot(a.x - this.player.x, a.y - this.player.y) < 22) {
        this._destroyAlien(i);
        this._hitPlayer();
      }
    }
  }

  _updateEnemyMissiles(dt) {
    for (let i = this.enemyMissiles.length - 1; i >= 0; i--) {
      const m = this.enemyMissiles[i];
      m.x += m.vx * dt;
      m.y += m.vy * dt;

      if (m.y > this.height || m.x < 0 || m.x > this.width) {
        this.enemyMissiles.splice(i, 1);
        continue;
      }

      if (
        this.player.invuln <= 0 &&
        Math.abs(m.x - this.player.x) < 13 &&
        Math.abs(m.y - this.player.y) < 13
      ) {
        this.enemyMissiles.splice(i, 1);
        this._hitPlayer();
      }
    }
  }

  _destroyAlien(index) {
    const a = this.aliens[index];
    if (!a) return;

    const inFlight = a.state !== 'formation';
    let pts = 30;
    let color = PALETTE.CYAN;

    if (a.type === 'hornet') {
      pts = inFlight ? 60 : 30;
      color = PALETTE.CYAN;
    } else if (a.type === 'emissary') {
      pts = inFlight ? 80 : 40;
      color = PALETTE.PURPLE;
    } else if (a.type === 'commander') {
      pts = inFlight ? 100 : 50;
      color = PALETTE.RED;
      // Notify leader Flagship if this Commander was escorting it
      if (a.leaderId) {
        const leader = this.aliens.find((al) => al.id === a.leaderId);
        if (leader) leader.escortsKilled += 1;
      }
    } else if (a.type === 'flagship') {
      color = PALETTE.GOLD;
      if (!inFlight) {
        pts = 60;
      } else if (a.escortsTotal === 2 && a.escortsKilled === 2) {
        pts = 800; // Iconic 800-pt Flagship Mystery Bonus!
      } else if (a.escortsTotal >= 1) {
        pts = 300;
      } else {
        pts = 150;
      }
    }

    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }

    this._spawnExplosion(a.x, a.y, color, a.type === 'flagship' ? 28 : 18);
    this._spawnFloatingText(pts >= 300 ? `${pts}!` : `+${pts}`, a.x, a.y, color);
    this.audio.playExplosion(0.26, 1150);
    this.aliens.splice(index, 1);
  }

  _hitPlayer() {
    this.renderer.shake(8, 0.32);
    this.audio.playExplosion(0.45, 750);
    this._spawnExplosion(this.player.x, this.player.y, PALETTE.RED, 30);
    this.lives -= 1;

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.audio.playGameOver();
      this.state = 'GAMEOVER';
    } else {
      this.player.x = this.width / 2;
      this.player.invuln = 2.2;
    }
  }

  _spawnExplosion(x, y, color, count = 18) {
    const colors = [color, PALETTE.GOLD, PALETTE.RED, PALETTE.WHITE];
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
      const spd = 40 + Math.random() * 180;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.35 + Math.random() * 0.3,
        maxLife: 0.65,
        size: 2 + Math.random() * 2.5,
        color: colors[i % colors.length]
      });
    }
  }

  _spawnFloatingText(text, x, y, color) {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -45,
      life: 0.95,
      maxLife: 0.95,
      color
    });
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
    this.renderer.clear(PALETTE.BG);

    // 1. Shimmering RGB Arcade Starfield
    ctx.save();
    for (const s of this.stars) {
      if (Math.sin(s.blinkTimer) < -0.25) continue;
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.restore();

    // 2. Convecting Alien Fleet & Diving Attackers
    const flap = Math.floor(this.swayTime * 4.5) % 2;
    for (const a of this.aliens) {
      this._renderAlien(ctx, a, flap);
    }

    // 3. Galaxip Player Starfighter (with nose missile visually docked when ready)
    if (this.player.invuln <= 0 || Math.floor(this.player.invuln * 14) % 2 === 0) {
      const sprite = this.missile ? SPRITES.GALAXIP_EMPTY : SPRITES.GALAXIP_LOADED;
      const scale = 2.3;
      const w = sprite[0].length * scale;
      const h = sprite.length * scale;
      this.renderer.drawPixelSprite(
        sprite,
        this.player.x - w / 2,
        this.player.y - h / 2,
        scale,
        SPRITE_PALETTE
      );
    }

    // 4. Nose Missile & Enemy Missiles
    if (this.missile) {
      this.renderer.drawGlowRect(this.missile.x - 2, this.missile.y - 7, 4, 14, PALETTE.GOLD, 10);
    }
    for (const m of this.enemyMissiles) {
      this.renderer.drawGlowRect(m.x - 2, m.y - 5, 4, 10, PALETTE.PINK, 8);
    }

    // 5. Particles & Score Popups
    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      ctx.restore();
    }

    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      this.renderer.drawText(ft.text, ft.x, ft.y, {
        font: FONTS.HEADER,
        size: 11,
        color: ft.color,
        align: 'center',
        glow: 8
      });
      ctx.restore();
    }

    // 6. Stage Pennant Flags in bottom-right corner
    for (let i = 0; i < Math.min(8, this.level); i++) {
      const fx = this.width - 28 - i * 16;
      const fy = 512;
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(fx, fy, 2, 16);
      ctx.fillStyle = PALETTE.RED;
      ctx.beginPath();
      ctx.moveTo(fx + 2, fy);
      ctx.lineTo(fx + 12, fy + 4);
      ctx.lineTo(fx + 2, fy + 8);
      ctx.closePath();
      ctx.fill();
    }

    if (this.bannerTimer > 0 && this.state === 'PLAYING') {
      this.renderer.drawText(this.bannerText, this.width / 2, 275, {
        font: FONTS.HEADER,
        size: 14,
        color: PALETTE.GOLD,
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
      extraLabel: `SWARM: ${this.aliens.length}`,
      accent: PALETTE.GOLD
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'CONVECTING FLEET & FLAGSHIP ESCORT EDITION',
      controls: 'ARROWS/A-D: STEER GALAXIP  |  SPACE/Z: FIRE NOSE MISSILE  |  X/SHIFT: EVADE DASH',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GOLD
    });
  }

  _renderAlien(ctx, a, flap) {
    let sprite = SPRITES.HORNET_0;
    if (a.type === 'flagship') {
      sprite = SPRITES.FLAGSHIP;
    } else if (a.type === 'commander') {
      sprite = flap === 0 ? SPRITES.COMMANDER_0 : SPRITES.COMMANDER_1;
    } else if (a.type === 'emissary') {
      sprite = flap === 0 ? SPRITES.EMISSARY_0 : SPRITES.EMISSARY_1;
    } else {
      sprite = flap === 0 ? SPRITES.HORNET_0 : SPRITES.HORNET_1;
    }

    const scale = 2.1;
    const w = sprite[0].length * scale;
    const h = sprite.length * scale;

    ctx.save();
    ctx.translate(a.x, a.y);
    if (a.angle) ctx.rotate(a.angle);
    this.renderer.drawPixelSprite(sprite, -w / 2, -h / 2, scale, SPRITE_PALETTE);
    ctx.restore();
  }
}

export default Galaxian;
