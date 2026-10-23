/**
 * Tron.js
 * Classic 1982 Light Cycle Game Grid Arena
 * Features a 180x96 high-speed 2D collision grid, glowing neon light-wall trails,
 * Turbo Boost & Phase-Brake controls, and raycasting AI cycles that evaluate
 * left/right corridor depth and cut off the player.
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const DIR_VECTORS = [
  { dx: 0, dy: -1 }, // 0: UP
  { dx: 1, dy: 0 },  // 1: RIGHT
  { dx: 0, dy: 1 },  // 2: DOWN
  { dx: -1, dy: 0 }  // 3: LEFT
];

export class Tron {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'tron';
    this.title = 'Tron';
    this.width = 960;
    this.height = 540;

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.cellSize = 5;
    this.gridW = 180; // 900px
    this.gridH = 94;  // 470px
    this.arenaX = 30;
    this.arenaY = 52;

    this.grid = new Uint8Array(this.gridW * this.gridH);
    this.player = null;
    this.aiCycles = [];
    this.particles = [];
    this.popups = [];
    this.roundTransitionTimer = 0;
    this.roundBanner = '';
    this.humTimer = 0;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.state = 'PLAYING';
    this._initRound();
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
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    if (x !== null && y !== null) {
      this.popups.push({
        x,
        y,
        text: label || `+${pts}`,
        color,
        life: 1.1
      });
    }
  }

  _setCell(gx, gy, val) {
    if (gx >= 0 && gx < this.gridW && gy >= 0 && gy < this.gridH) {
      this.grid[gy * this.gridW + gx] = val;
    }
  }

  _getCell(gx, gy) {
    if (gx < 0 || gx >= this.gridW || gy < 0 || gy >= this.gridH) return 255;
    return this.grid[gy * this.gridW + gx];
  }

  _initRound() {
    this.grid.fill(0);
    this.particles = [];
    this.popups = [];
    this.roundTransitionTimer = 0;
    this.roundBanner = '';

    // Add symmetrical Recognizer monolith obstacles on higher levels
    if (this.level >= 3) {
      const blocks = [
        { x: 55, y: 26, w: 6, h: 14 },
        { x: 119, y: 26, w: 6, h: 14 },
        { x: 55, y: 54, w: 6, h: 14 },
        { x: 119, y: 54, w: 6, h: 14 }
      ];
      for (const b of blocks) {
        for (let yy = b.y; yy < b.y + b.h; yy++) {
          for (let xx = b.x; xx < b.x + b.w; xx++) {
            this._setCell(xx, yy, 9);
          }
        }
      }
    }

    // Player Cyan Light Cycle starts on left side heading Right
    const py = Math.floor(this.gridH / 2);
    this.player = {
      id: 1,
      gx: 24,
      gy: py,
      dir: 1, // RIGHT
      nextDir: 1,
      stepAccum: 0,
      baseSpeed: 34, // cells per second
      turboEnergy: 100,
      boosting: false,
      braking: false,
      alive: true,
      color: PALETTE.CYAN,
      trail: [{ gx: 24, gy: py }]
    };
    this._setCell(this.player.gx, this.player.gy, 1);

    // Spawn 1 to 3 Enemy AI Light Cycles on right side heading Left
    const aiCount = Math.min(3, 1 + Math.floor(this.level / 2));
    const aiConfigs = [
      { id: 2, gy: py, color: PALETTE.ORANGE, name: 'SARK' },
      { id: 3, gy: Math.floor(this.gridH * 0.24), color: PALETTE.RED, name: 'CLU' },
      { id: 4, gy: Math.floor(this.gridH * 0.76), color: PALETTE.GOLD, name: 'GUARD' }
    ];

    this.aiCycles = [];
    for (let i = 0; i < aiCount; i++) {
      const cfg = aiConfigs[i];
      const cycle = {
        id: cfg.id,
        name: cfg.name,
        gx: this.gridW - 25,
        gy: cfg.gy,
        dir: 3, // LEFT
        stepAccum: 0,
        baseSpeed: 33 + Math.min(10, this.level * 1.4),
        alive: true,
        color: cfg.color,
        trail: [{ gx: this.gridW - 25, gy: cfg.gy }],
        turnCooldown: 0
      };
      this._setCell(cycle.gx, cycle.gy, cycle.id);
      this.aiCycles.push(cycle);
    }
  }

  /**
   * Raycast from (gx, gy) along direction `dir` and return number of free grid cells
   */
  _raycastDepth(gx, gy, dir, maxDist = 180) {
    const { dx, dy } = DIR_VECTORS[dir];
    let dist = 0;
    let cx = gx + dx;
    let cy = gy + dy;
    while (dist < maxDist && this._getCell(cx, cy) === 0) {
      dist++;
      cx += dx;
      cy += dy;
    }
    return dist;
  }

  /**
   * Evaluate corridor quality for AI turn prediction: combines straight raycast depth
   * with secondary branches from a lookahead point + tactical cutoff of the player.
   */
  _evaluateDirection(ai, candidateDir) {
    const directDepth = this._raycastDepth(ai.gx, ai.gy, candidateDir, 140);
    if (directDepth <= 1) return -1000;

    const { dx, dy } = DIR_VECTORS[candidateDir];
    const sampleStep = Math.min(directDepth, 8);
    const sx = ai.gx + dx * sampleStep;
    const sy = ai.gy + dy * sampleStep;

    const leftBranch = this._raycastDepth(sx, sy, (candidateDir + 3) % 4, 60);
    const rightBranch = this._raycastDepth(sx, sy, (candidateDir + 1) % 4, 60);

    let score = directDepth * 1.4 + (leftBranch + rightBranch) * 0.45;

    // Tactical box-in: slightly prefer turning toward player's projected position if space is ample
    if (this.player && this.player.alive && directDepth > 18) {
      const pVec = DIR_VECTORS[this.player.dir];
      const targetX = this.player.gx + pVec.dx * 10;
      const targetY = this.player.gy + pVec.dy * 10;
      const distBefore = Math.hypot( targetX - ai.gx, targetY - ai.gy );
      const distAfter = Math.hypot( targetX - (ai.gx + dx * 6), targetY - (ai.gy + dy * 6) );
      if (distAfter < distBefore) {
        score += 12;
      }
    }

    return score + (Math.random() * 4 - 2);
  }

  _updateAIDecision(ai) {
    const forwardDepth = this._raycastDepth(ai.gx, ai.gy, ai.dir, 60);
    const leftDir = (ai.dir + 3) % 4;
    const rightDir = (ai.dir + 1) % 4;

    const mustTurn = forwardDepth <= 4;
    const shouldConsiderTurn =
      forwardDepth <= 14 || (ai.turnCooldown <= 0 && Math.random() < 0.08);

    if (mustTurn || shouldConsiderTurn) {
      const fScore = mustTurn ? -999 : this._evaluateDirection(ai, ai.dir);
      const lScore = this._evaluateDirection(ai, leftDir);
      const rScore = this._evaluateDirection(ai, rightDir);

      if (lScore > fScore && lScore >= rScore && lScore > 0) {
        ai.dir = leftDir;
        ai.turnCooldown = 3;
      } else if (rScore > fScore && rScore > lScore && rScore > 0) {
        ai.dir = rightDir;
        ai.turnCooldown = 3;
      }
    }
    if (ai.turnCooldown > 0) ai.turnCooldown--;
  }

  _derezCycle(cycle, isPlayer = false) {
    cycle.alive = false;
    const px = this.arenaX + cycle.gx * this.cellSize;
    const py = this.arenaY + cycle.gy * this.cellSize;

    this.audio.playExplosion(0.42, 1100);
    this.renderer.shake(isPlayer ? 11 : 7, 0.25);

    // Explosion particles at crash site
    for (let i = 0; i < 28; i++) {
      const a = (Math.PI * 2 * i) / 28 + Math.random() * 0.2;
      const spd = 70 + Math.random() * 190;
      this.particles.push({
        x: px,
        y: py,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        color: cycle.color,
        life: 0.65
      });
    }

    // Clear defeated AI cycle's trail from grid so arena stays dynamic
    if (!isPlayer) {
      for (let i = 0; i < cycle.trail.length; i++) {
        const pt = cycle.trail[i];
        if (this._getCell(pt.gx, pt.gy) === cycle.id) {
          this._setCell(pt.gx, pt.gy, 0);
        }
        if (i % 6 === 0) {
          this.particles.push({
            x: this.arenaX + pt.gx * this.cellSize,
            y: this.arenaY + pt.gy * this.cellSize,
            vx: (Math.random() - 0.5) * 60,
            vy: (Math.random() - 0.5) * 60,
            color: cycle.color,
            life: 0.35
          });
        }
      }
      const pts = 600 * this.level;
      this._addScore(pts, px, py - 10, cycle.color, `${cycle.name} DEREZZED +${pts}`);
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

    // Round transition delay
    if (this.roundTransitionTimer > 0) {
      this.roundTransitionTimer -= dt;
      if (this.roundTransitionTimer <= 0) {
        if (!this.player.alive) {
          if (this.lives <= 0) {
            this.audio.playGameOver();
            this.setState('GAMEOVER');
          } else {
            this._initRound();
          }
        } else {
          this.level++;
          this._initRound();
        }
      }
      this._updateParticles(dt);
      return;
    }

    const p = this.player;
    const swipe = this.input.consumeSwipe();

    // 90-degree turn input (prevent 180-degree self-collision)
    if ((this.input.isJustPressed('up') || swipe === 'up') && p.dir !== 2) {
      p.nextDir = 0;
    } else if ((this.input.isJustPressed('right') || swipe === 'right') && p.dir !== 3) {
      p.nextDir = 1;
    } else if ((this.input.isJustPressed('down') || swipe === 'down') && p.dir !== 0) {
      p.nextDir = 2;
    } else if ((this.input.isJustPressed('left') || swipe === 'left') && p.dir !== 1) {
      p.nextDir = 3;
    }

    // Action A: Turbo Boost | Action B: Phase-Brake
    p.boosting = this.input.isDown('actionA') && p.turboEnergy > 0;
    p.braking = !p.boosting && this.input.isDown('actionB');

    if (p.boosting) {
      p.turboEnergy = Math.max(0, p.turboEnergy - 42 * dt);
    } else {
      p.turboEnergy = Math.min(100, p.turboEnergy + 16 * dt);
    }

    const speedMult = p.boosting ? 1.65 : p.braking ? 0.58 : 1.0;
    p.stepAccum += p.baseSpeed * speedMult * dt;

    // Synthesize Light Cycle engine hum
    this.humTimer -= dt;
    if (this.humTimer <= 0) {
      const humFreq = p.boosting ? 260 : p.braking ? 120 : 175;
      this.audio.playNote(humFreq, 0.07, 'sawtooth', 0.08);
      this.humTimer = 0.08;
    }

    while (p.stepAccum >= 1 && p.alive) {
      p.stepAccum -= 1;
      if (p.nextDir !== p.dir) {
        p.dir = p.nextDir;
        this.audio.playMenuMove();
      }
      const vec = DIR_VECTORS[p.dir];
      const nx = p.gx + vec.dx;
      const ny = p.gy + vec.dy;

      if (this._getCell(nx, ny) !== 0) {
        // Player Crashed!
        this.lives--;
        this._derezCycle(p, true);
        this.roundBanner = this.lives > 0 ? 'LIGHT CYCLE DEREZZED!' : 'END OF LINE';
        this.roundTransitionTimer = 1.6;
        break;
      }

      p.gx = nx;
      p.gy = ny;
      this._setCell(nx, ny, p.id);
      p.trail.push({ gx: nx, gy: ny });
      this._addScore(2);
    }

    // Step AI Light Cycles
    for (const ai of this.aiCycles) {
      if (!ai.alive || !p.alive) continue;
      ai.stepAccum += ai.baseSpeed * dt;
      while (ai.stepAccum >= 1 && ai.alive) {
        ai.stepAccum -= 1;
        this._updateAIDecision(ai);
        const vec = DIR_VECTORS[ai.dir];
        const nx = ai.gx + vec.dx;
        const ny = ai.gy + vec.dy;

        if (this._getCell(nx, ny) !== 0) {
          this._derezCycle(ai, false);
          break;
        }
        ai.gx = nx;
        ai.gy = ny;
        this._setCell(nx, ny, ai.id);
        ai.trail.push({ gx: nx, gy: ny });
      }
    }

    // Check if all AI Cycles are eliminated -> Stage Clear!
    if (p.alive && this.aiCycles.every((ai) => !ai.alive) && this.roundTransitionTimer <= 0) {
      this.audio.playStageClear();
      const bonus = 1000 * this.level;
      this._addScore(
        bonus,
        this.width / 2,
        this.height / 2,
        PALETTE.CYAN,
        `GRID SECTOR CLEARED +${bonus}`
      );
      this.roundBanner = `SECTOR ${this.level} COMPLETE!`;
      this.roundTransitionTimer = 1.8;
    }

    this._updateParticles(dt);
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
      pop.y -= 30 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  _drawCycleTrail(ctx, cycle) {
    if (cycle.trail.length < 2) return;
    ctx.save();
    ctx.strokeStyle = cycle.color;
    ctx.shadowColor = cycle.color;
    ctx.shadowBlur = 8;
    ctx.lineWidth = this.cellSize - 0.5;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';

    ctx.beginPath();
    for (let i = 0; i < cycle.trail.length; i++) {
      const pt = cycle.trail[i];
      const px = this.arenaX + pt.gx * this.cellSize + this.cellSize * 0.5;
      const py = this.arenaY + pt.gy * this.cellSize + this.cellSize * 0.5;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  _drawCycleHead(ctx, cycle) {
    if (!cycle.alive) return;
    const cx = this.arenaX + cycle.gx * this.cellSize + this.cellSize * 0.5;
    const cy = this.arenaY + cycle.gy * this.cellSize + this.cellSize * 0.5;

    // 1982 Bally Midway Top-Down Light Cycle Oriented by Travel Direction (dir: 0=UP, 1=RIGHT, 2=DOWN, 3=LEFT)
    // Base orientation draws facing RIGHT (+X), rotated by (dir - 1) * 90deg
    const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
    const rot = angles[cycle.dir] || 0;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    // Outer neon aura glow
    ctx.shadowColor = cycle.color;
    ctx.shadowBlur = 12;

    // Rear Power Wheel Housing & Jet-Wall Emitter
    ctx.fillStyle = cycle.color;
    ctx.beginPath();
    ctx.arc(-6, 0, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#090D16';
    ctx.beginPath();
    ctx.arc(-6, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();

    // Streamlined Enclosed Body Fairing & Tapered Front Wheel Cowling
    ctx.fillStyle = cycle.color;
    ctx.beginPath();
    ctx.moveTo(-8, -4.8);
    ctx.lineTo(3, -4.8);
    ctx.lineTo(10, -2.6);
    ctx.lineTo(10, 2.6);
    ctx.lineTo(3, 4.8);
    ctx.lineTo(-8, 4.8);
    ctx.closePath();
    ctx.fill();

    // Front Wheel Hub inside Cowling
    ctx.fillStyle = PALETTE.WHITE;
    ctx.beginPath();
    ctx.arc(6.5, 0, 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Enclosed Dark Tinted Canopy Dome with Glowing Circuit Trim
    ctx.fillStyle = '#050811';
    ctx.beginPath();
    ctx.ellipse(-0.5, 0, 5.2, 3.0, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.WHITE;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Neon Spine Circuit Rib
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(-7, -0.8, 12, 1.6);

    ctx.restore();
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear('#050811');

    const arenaW = this.gridW * this.cellSize;
    const arenaH = this.gridH * this.cellSize;

    // Perspective Grid Floor lines
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = this.arenaX; x <= this.arenaX + arenaW; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, this.arenaY);
      ctx.lineTo(x, this.arenaY + arenaH);
      ctx.stroke();
    }
    for (let y = this.arenaY; y <= this.arenaY + arenaH; y += 30) {
      ctx.beginPath();
      ctx.moveTo(this.arenaX, y);
      ctx.lineTo(this.arenaX + arenaW, y);
      ctx.stroke();
    }
    ctx.restore();

    // Glowing Outer Game Grid Border
    this.renderer.drawGlowRect(this.arenaX, this.arenaY, arenaW, arenaH, PALETTE.CYAN, 12, false, 2.5);

    // Draw Grid Obstacles Styled as Glowing MCP Grid Cones (cell value 9)
    if (this.level >= 3) {
      const coneBlocks = [
        { x: 55, y: 26, w: 6, h: 14 },
        { x: 119, y: 26, w: 6, h: 14 },
        { x: 55, y: 54, w: 6, h: 14 },
        { x: 119, y: 54, w: 6, h: 14 }
      ];
      const pulse = 0.65 + 0.35 * Math.sin(performance.now() * 0.008);
      for (const b of coneBlocks) {
        const bx = this.arenaX + b.x * this.cellSize;
        const by = this.arenaY + b.y * this.cellSize;
        const bw = b.w * this.cellSize;
        const bh = b.h * this.cellSize;
        const mcx = bx + bw / 2;
        const mcy = by + bh / 2;

        // Outer MCP Crimson/Purple Cone Base
        this.renderer.drawGlowRect(bx, by, bw, bh, PALETTE.RED, 10, true);
        // Inner Concentric MCP Cone Tiers
        ctx.fillStyle = PALETTE.PURPLE;
        ctx.fillRect(bx + 4, by + 6, bw - 8, bh - 12);
        ctx.strokeStyle = PALETTE.GOLD;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx + 4, by + 6, bw - 8, bh - 12);
        // Pulsing MCP Core Apex
        ctx.fillStyle = pulse > 0.8 ? PALETTE.WHITE : PALETTE.GOLD;
        ctx.fillRect(mcx - 4, mcy - 10, 8, 20);
      }
    }

    // Draw Trails & Cycles
    for (const ai of this.aiCycles) {
      if (ai.alive) {
        this._drawCycleTrail(ctx, ai);
        this._drawCycleHead(ctx, ai);
      }
    }
    if (this.player) {
      this._drawCycleTrail(ctx, this.player);
      this._drawCycleHead(ctx, this.player);
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

    if (this.roundBanner) {
      this.renderer.drawText(this.roundBanner, this.width / 2, this.height / 2 - 20, {
        font: FONTS.HEADER,
        size: 20,
        color: PALETTE.CYAN,
        align: 'center',
        glow: 14
      });
    }

    const activeAI = this.aiCycles.filter((a) => a.alive).length;
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `TURBO:${Math.floor(this.player.turboEnergy)}% ENEMIES:${activeAI}`,
      accent: PALETTE.CYAN
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'LIGHT CYCLE GAME GRID ARENA',
      controls: 'ARROWS/WASD: 90° TURN  |  Z/SPACE: TURBO BOOST  |  X/SHIFT: PHASE BRAKE',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.CYAN
    });
  }
}

export default Tron;
