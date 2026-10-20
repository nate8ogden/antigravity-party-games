/**
 * MissileCommand.js
 * Cold-War Ballistic Defense Arcade Classic
 * Command 3 ABM Defense Batteries (Alpha Left, Beta Center, Gamma Right) protecting 6 crystal
 * neon cities along the bottom skyline. Features Mouse/Touch + D-Pad crosshair targeting,
 * interceptor trajectory vectors, and expanding/contracting circular blast radii that
 * chain-detonate incoming MIRV split warheads and smart bombers!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';
import { Vector2 } from '../engine/Vector2.js';

export class MissileCommand {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'missilecommand';
    this.title = 'Aegis Intercept';
    this.state = 'PLAYING';

    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 6;
    this.level = 1;

    this.groundY = 500;
    this.crosshair = { x: 480, y: 240 };
    this.lastPointer = { x: 480, y: 240 };

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.level = 1;
    this.state = 'PLAYING';

    // 6 Crystal Neon Cities positioned between the 3 ABM Batteries
    const cityXs = [185, 275, 365, 595, 685, 775];
    this.cities = cityXs.map((x, idx) => ({
      id: idx,
      x,
      y: this.groundY,
      alive: true
    }));
    this.lives = 6;

    this._initWave(this.level);
  }

  _initWave(level) {
    // 3 ABM Defense Batteries: Alpha (Left), Beta (Center - Ultra Fast), Gamma (Right)
    this.batteries = [
      { name: 'ALPHA', x: 85, y: this.groundY - 8, ammo: 10, maxAmmo: 10, speed: 560, alive: true },
      { name: 'BETA', x: 480, y: this.groundY - 8, ammo: 10, maxAmmo: 10, speed: 780, alive: true },
      { name: 'GAMMA', x: 875, y: this.groundY - 8, ammo: 10, maxAmmo: 10, speed: 560, alive: true }
    ];

    this.interceptors = [];
    this.enemyMissiles = [];
    this.bombers = [];
    this.explosions = [];
    this.floatingTexts = [];

    this.waveEnemiesRemaining = 10 + level * 4;
    this.spawnTimer = 0.6;
    this.bomberTimer = 4.5;
    this.waveClearTimer = 0;
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.interceptors = [];
    this.enemyMissiles = [];
    this.explosions = [];
  }

  _addScore(pts, x, y, color = PALETTE.GOLD) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    if (x !== undefined && y !== undefined) {
      this.floatingTexts.push({
        text: `+${pts}`,
        x,
        y,
        vy: -35,
        life: 0.75,
        maxLife: 0.75,
        color
      });
    }
  }

  _launchInterceptor(targetX, targetY) {
    const clampedY = Math.max(52, Math.min(this.groundY - 24, targetY));
    const clampedX = Math.max(20, Math.min(940, targetX));

    // Find nearest operational ABM Battery with remaining ammo
    let bestBattery = null;
    let bestDist = Infinity;
    for (const bat of this.batteries) {
      if (bat.alive && bat.ammo > 0) {
        const d = Math.hypot(bat.x - clampedX, bat.y - clampedY);
        if (d < bestDist) {
          bestDist = d;
          bestBattery = bat;
        }
      }
    }

    if (!bestBattery) {
      this.audio.playHit();
      return;
    }

    bestBattery.ammo--;
    const start = new Vector2(bestBattery.x, bestBattery.y - 6);
    const target = new Vector2(clampedX, clampedY);
    const dir = Vector2.sub(target, start).normalize();

    this.interceptors.push({
      startX: start.x,
      startY: start.y,
      x: start.x,
      y: start.y,
      targetX: target.x,
      targetY: target.y,
      vx: dir.x * bestBattery.speed,
      vy: dir.y * bestBattery.speed
    });

    this.audio.playLaser(980, 260, 0.11);
  }

  _spawnExplosion(x, y, maxRadius = 44, isPlayerExplosion = true) {
    this.explosions.push({
      x,
      y,
      radius: 2,
      maxRadius,
      phase: 'EXPANDING', // 'EXPANDING' | 'HOLD' | 'CONTRACTING'
      holdTimer: 0.18,
      isPlayerExplosion,
      colorCycle: 0
    });
    this.audio.playExplosion(0.32, isPlayerExplosion ? 1100 : 600);
  }

  _spawnEnemyICBM(startX = null, startY = 42, canSplit = true) {
    // Pick a target among surviving cities or batteries
    const targets = [
      ...this.cities.filter((c) => c.alive),
      ...this.batteries.filter((b) => b.alive)
    ];
    if (targets.length === 0) return;

    const tgt = targets[Math.floor(Math.random() * targets.length)];
    const sx = startX !== null ? startX : 40 + Math.random() * 880;
    const sy = startY;
    const speed = 58 + this.level * 12 + Math.random() * 20;
    const dir = new Vector2(tgt.x - sx, tgt.y - sy).normalize();

    this.enemyMissiles.push({
      startX: sx,
      startY: sy,
      x: sx,
      y: sy,
      targetX: tgt.x,
      targetY: tgt.y,
      vx: dir.x * speed,
      vy: dir.y * speed,
      canSplit: canSplit && Math.random() < 0.28 + this.level * 0.05,
      splitY: 140 + Math.random() * 110
    });
  }

  update(dt) {
    if (this.state === 'MENU' || this.state === 'GAMEOVER') {
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
      if (this.input.isJustPressed('actionA') || this.input.isJustPressed('pause')) {
        this.setState('PLAYING');
      }
      return;
    }

    if (this.state !== 'PLAYING') return;

    // Crosshair Targeting: Mouse/Touch Pointer + Arrow Keys / D-Pad
    const ptr = this.input.pointer;
    if (
      Math.abs(ptr.x - this.lastPointer.x) > 0.5 ||
      Math.abs(ptr.y - this.lastPointer.y) > 0.5 ||
      ptr.justPressed
    ) {
      this.crosshair.x = ptr.x;
      this.crosshair.y = Math.max(48, Math.min(this.groundY - 20, ptr.y));
      this.lastPointer.x = ptr.x;
      this.lastPointer.y = ptr.y;
    }

    const axis = this.input.getAxis();
    if (Math.hypot(axis.x, axis.y) > 0.05) {
      const aimSpeed = 410;
      this.crosshair.x = Math.max(
        20,
        Math.min(940, this.crosshair.x + axis.x * aimSpeed * dt)
      );
      this.crosshair.y = Math.max(
        48,
        Math.min(this.groundY - 20, this.crosshair.y + axis.y * aimSpeed * dt)
      );
    }

    // Fire ABM Interceptor
    if (ptr.justPressed) {
      this._launchInterceptor(ptr.x, ptr.y);
    } else if (
      this.input.isJustPressed('actionA') ||
      this.input.isJustPressed('actionB')
    ) {
      this._launchInterceptor(this.crosshair.x, this.crosshair.y);
    }

    // Wave Clear Transition
    if (this.waveClearTimer > 0) {
      this.waveClearTimer -= dt;
      if (this.waveClearTimer <= 0) {
        this.level++;
        this._initWave(this.level);
      }
      return;
    }

    // Spawn Incoming ICBMs
    if (this.waveEnemiesRemaining > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = Math.max(0.45, 1.45 - this.level * 0.1);
        const salvo = Math.min(this.waveEnemiesRemaining, 1 + Math.floor(Math.random() * 2));
        for (let i = 0; i < salvo; i++) {
          this._spawnEnemyICBM();
          this.waveEnemiesRemaining--;
        }
      }
    }

    // Spawn Smart Bombers / Satellites across mid-altitude
    this.bomberTimer -= dt;
    if (this.bomberTimer <= 0 && this.waveEnemiesRemaining > 0) {
      this.bomberTimer = Math.max(4.5, 8.0 - this.level * 0.4);
      const fromLeft = Math.random() < 0.5;
      this.bombers.push({
        x: fromLeft ? -30 : 990,
        y: 110 + Math.random() * 90,
        vx: (fromLeft ? 1 : -1) * (95 + this.level * 12),
        dropTimer: 1.5
      });
    }

    // Update Interceptors
    for (let i = this.interceptors.length - 1; i >= 0; i--) {
      const ic = this.interceptors[i];
      const stepX = ic.vx * dt;
      const stepY = ic.vy * dt;
      const remDist = Math.hypot(ic.targetX - ic.x, ic.targetY - ic.y);

      if (remDist <= Math.hypot(stepX, stepY)) {
        this._spawnExplosion(ic.targetX, ic.targetY, 46, true);
        this.interceptors.splice(i, 1);
      } else {
        ic.x += stepX;
        ic.y += stepY;
      }
    }

    // Update Smart Bombers
    for (let i = this.bombers.length - 1; i >= 0; i--) {
      const bm = this.bombers[i];
      bm.x += bm.vx * dt;
      bm.dropTimer -= dt;
      if (bm.dropTimer <= 0 && bm.x > 80 && bm.x < 880) {
        bm.dropTimer = 2.0;
        this._spawnEnemyICBM(bm.x, bm.y, false);
      }
      if (bm.x < -60 || bm.x > 1020) {
        this.bombers.splice(i, 1);
      }
    }

    // Update Enemy ICBMs (including MIRV Multi-Warhead Splitting!)
    for (let i = this.enemyMissiles.length - 1; i >= 0; i--) {
      const em = this.enemyMissiles[i];
      em.x += em.vx * dt;
      em.y += em.vy * dt;

      // MIRV Split check
      if (em.canSplit && em.y >= em.splitY) {
        em.canSplit = false;
        this._spawnEnemyICBM(em.x, em.y, false);
        if (this.level >= 3) {
          this._spawnEnemyICBM(em.x, em.y, false);
        }
      }

      // Check Ground / City / Battery Impact
      if (em.y >= em.targetY) {
        this._spawnExplosion(em.targetX, em.targetY, 34, false);
        this.renderer.shake(7, 0.22);

        // Check if a City or Battery was hit
        for (const c of this.cities) {
          if (c.alive && Math.abs(c.x - em.targetX) < 26) {
            c.alive = false;
          }
        }
        for (const bat of this.batteries) {
          if (bat.alive && Math.abs(bat.x - em.targetX) < 30) {
            bat.alive = false;
            bat.ammo = 0;
          }
        }

        this.lives = this.cities.filter((c) => c.alive).length;
        this.enemyMissiles.splice(i, 1);

        if (this.lives <= 0) {
          HighScoreStore.submit(this.id, this.score);
          this.audio.playGameOver();
          this.setState('GAMEOVER');
          return;
        }
      }
    }

    // Update Expanding / Contracting Circular Blast Radii & Chain Detonations
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.colorCycle += dt * 18;

      if (ex.phase === 'EXPANDING') {
        ex.radius += 115 * dt;
        if (ex.radius >= ex.maxRadius) {
          ex.radius = ex.maxRadius;
          ex.phase = 'HOLD';
        }
      } else if (ex.phase === 'HOLD') {
        ex.holdTimer -= dt;
        if (ex.holdTimer <= 0) {
          ex.phase = 'CONTRACTING';
        }
      } else {
        ex.radius -= 85 * dt;
        if (ex.radius <= 0) {
          this.explosions.splice(i, 1);
          continue;
        }
      }

      // Chain-Destroy Incoming Enemy Missiles inside the Blast Radius!
      for (let j = this.enemyMissiles.length - 1; j >= 0; j--) {
        const em = this.enemyMissiles[j];
        if (Math.hypot(em.x - ex.x, em.y - ex.y) <= ex.radius + 4) {
          const pts = 25 * Math.min(6, this.level);
          this._addScore(pts, em.x, em.y, PALETTE.CYAN);
          // Chain-reaction blast!
          this._spawnExplosion(em.x, em.y, 38, true);
          this.enemyMissiles.splice(j, 1);
        }
      }

      // Destroy Smart Bombers inside Blast Radius!
      for (let j = this.bombers.length - 1; j >= 0; j--) {
        const bm = this.bombers[j];
        if (Math.hypot(bm.x - ex.x, bm.y - ex.y) <= ex.radius + 14) {
          const pts = 100 * Math.min(6, this.level);
          this._addScore(pts, bm.x, bm.y, PALETTE.GOLD);
          this._spawnExplosion(bm.x, bm.y, 44, true);
          this.bombers.splice(j, 1);
        }
      }
    }

    // Update Floating Score Popups
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // Check Wave Completion
    if (
      this.waveEnemiesRemaining <= 0 &&
      this.enemyMissiles.length === 0 &&
      this.bombers.length === 0 &&
      this.explosions.length === 0 &&
      this.waveClearTimer <= 0
    ) {
      const remainingAmmo = this.batteries.reduce((acc, b) => acc + b.ammo, 0);
      const survivingCities = this.cities.filter((c) => c.alive).length;
      const bonus = (remainingAmmo * 15 + survivingCities * 150) * this.level;
      this._addScore(bonus, 480, 240, PALETTE.GREEN);
      this.audio.playStageClear();
      this.waveClearTimer = 2.0;
    }
  }

  render(ctx = this.renderer.ctx) {
    // Deep Space Radar Backdrop
    ctx.fillStyle = PALETTE.BG;
    ctx.fillRect(0, 38, this.renderer.width, this.renderer.height - 38);

    // Draw Enemy ICBM Contrails & Warhead Tips
    for (const em of this.enemyMissiles) {
      ctx.save();
      ctx.strokeStyle = PALETTE.RED;
      ctx.shadowColor = PALETTE.RED;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(em.startX, em.startY);
      ctx.lineTo(em.x, em.y);
      ctx.stroke();
      this.renderer.drawGlowCircle(em.x, em.y, 3, PALETTE.WHITE, 8);
      ctx.restore();
    }

    // Draw Smart Bombers / Satellites
    for (const bm of this.bombers) {
      ctx.save();
      ctx.translate(bm.x, bm.y);
      this.renderer.drawGlowRect(-16, -6, 32, 12, PALETTE.PURPLE, 10);
      this.renderer.drawGlowCircle(0, 0, 5, PALETTE.GOLD, 8);
      ctx.restore();
    }

    // Draw Player ABM Interceptor Contrails & Target 'X' Markers
    for (const ic of this.interceptors) {
      ctx.save();
      ctx.strokeStyle = PALETTE.CYAN;
      ctx.shadowColor = PALETTE.CYAN;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ic.startX, ic.startY);
      ctx.lineTo(ic.x, ic.y);
      ctx.stroke();

      // Target X marker
      ctx.strokeStyle = PALETTE.GOLD;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ic.targetX - 5, ic.targetY - 5);
      ctx.lineTo(ic.targetX + 5, ic.targetY + 5);
      ctx.moveTo(ic.targetX + 5, ic.targetY - 5);
      ctx.lineTo(ic.targetX - 5, ic.targetY + 5);
      ctx.stroke();

      this.renderer.drawGlowCircle(ic.x, ic.y, 3, PALETTE.WHITE, 8);
      ctx.restore();
    }

    // Draw Expanding / Contracting Multi-Color Circular Blast Radii
    const blastPalette = [PALETTE.WHITE, PALETTE.CYAN, PALETTE.PINK, PALETTE.GOLD];
    for (const ex of this.explosions) {
      const col = blastPalette[Math.floor(ex.colorCycle) % blastPalette.length];
      this.renderer.drawGlowCircle(ex.x, ex.y, ex.radius, col, 16, true);
    }

    // Draw Craggy Planetary Terrain & ABM Silo Mounds
    ctx.fillStyle = '#1E1B4B';
    ctx.fillRect(0, this.groundY, this.renderer.width, 540 - this.groundY);
    ctx.strokeStyle = PALETTE.GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    ctx.lineTo(this.renderer.width, this.groundY);
    ctx.stroke();

    // Draw 6 Crystal Neon Cities
    for (const c of this.cities) {
      if (c.alive) {
        // Futuristic crystal skyline domes & spires
        this.renderer.drawGlowRect(c.x - 18, c.y - 12, 36, 12, PALETTE.CYAN, 8);
        this.renderer.drawGlowRect(c.x - 10, c.y - 22, 8, 10, PALETTE.BLUE, 6);
        this.renderer.drawGlowRect(c.x + 2, c.y - 26, 10, 14, PALETTE.CYAN, 8);
      } else {
        // Scorched crater ruin
        ctx.fillStyle = '#334155';
        ctx.fillRect(c.x - 14, c.y - 3, 28, 3);
      }
    }

    // Draw 3 ABM Defense Batteries (Alpha, Beta, Gamma)
    for (const bat of this.batteries) {
      // Silo mound
      ctx.fillStyle = bat.alive ? '#312E81' : '#1E293B';
      ctx.beginPath();
      ctx.moveTo(bat.x - 36, this.groundY);
      ctx.lineTo(bat.x - 20, this.groundY - 18);
      ctx.lineTo(bat.x + 20, this.groundY - 18);
      ctx.lineTo(bat.x + 36, this.groundY);
      ctx.closePath();
      ctx.fill();

      if (bat.alive) {
        // Stacked pyramid of remaining ABM missiles
        const col = bat.ammo <= 3 ? PALETTE.RED : PALETTE.GOLD;
        for (let m = 0; m < bat.ammo; m++) {
          const mx = bat.x - 18 + (m % 5) * 9;
          const my = this.groundY - 14 + Math.floor(m / 5) * 7;
          ctx.fillStyle = col;
          ctx.fillRect(mx, my, 4, 6);
        }
        this.renderer.drawText(`${bat.name}:${bat.ammo}`, bat.x, this.groundY + 22, {
          size: 12,
          color: bat.ammo > 0 ? PALETTE.CYAN : PALETTE.RED,
          align: 'center'
        });
      } else {
        this.renderer.drawText('OUT', bat.x, this.groundY + 22, {
          size: 12,
          color: PALETTE.RED,
          align: 'center'
        });
      }
    }

    // Draw Floating Score Texts
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      this.renderer.drawText(ft.text, ft.x, ft.y, {
        size: 13,
        color: ft.color,
        align: 'center',
        glow: 6
      });
    }
    ctx.globalAlpha = 1;

    if (this.waveClearTimer > 0) {
      this.renderer.drawText('WAVE CLEARED! CITY & ABM BONUS AWARDED!', 480, 210, {
        font: FONTS.HEADER,
        size: 17,
        color: PALETTE.GREEN,
        align: 'center',
        glow: 12
      });
    }

    // Draw Targeting Crosshair
    const cx = this.crosshair.x;
    const cy = this.crosshair.y;
    this.renderer.drawGlowCircle(cx, cy, 12, PALETTE.CYAN, 10, false, 2);
    ctx.strokeStyle = PALETTE.PINK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy);
    ctx.lineTo(cx - 5, cy);
    ctx.moveTo(cx + 5, cy);
    ctx.lineTo(cx + 18, cy);
    ctx.moveTo(cx, cy - 18);
    ctx.lineTo(cx, cy - 5);
    ctx.moveTo(cx, cy + 5);
    ctx.lineTo(cx, cy + 18);
    ctx.stroke();

    const totalAmmo = this.batteries.reduce((acc, b) => acc + b.ammo, 0);
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `ABM:${totalAmmo}`,
      accent: PALETTE.PINK
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'THERMONUCLEAR ABM SKYLINE DEFENSE',
      controls: 'MOUSE/TAP OR ARROWS: AIM  |  CLICK/Z/SPACE/X: LAUNCH ABM INTERCEPTOR',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.PINK
    });
  }
}

export default MissileCommand;
