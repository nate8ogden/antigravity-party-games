/**
 * Qbert.js
 * Classic 1982 Isometric Cube Pyramid Puzzler — Retro Arcade Studio Edition.
 * Features a 7-row 3D isometric pyramid (28 cubes), diagonal hop animations,
 * target top-face color changing, Bouncing Red Balls, Purple Eggs that hatch into
 * Coily the Snake (chases Q*bert!), and Spinning Escape Discs that lure Coily off
 * the pyramid for +500 bonus points!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const PYRAMID_ROWS = 7;
const TOP_X = 480;
const TOP_Y = 122;
const CUBE_RX = 34; // Horizontal half-width of cube top diamond
const CUBE_RY = 18; // Vertical half-height of cube top diamond
const CUBE_H = 26;  // Vertical height of cube side faces

const LEVEL_THEMES = [
  // Round 1: 1-hop classic blue/gold pyramid
  {
    name: 'ROUND 1: SINGLE HOP',
    startTop: '#1E293B',
    midTop: PALETTE.BLUE,
    targetTop: PALETTE.GOLD,
    startColor: '#1E293B',
    midColor: PALETTE.BLUE,
    targetColor: PALETTE.GOLD,
    leftFace: '#0E7490',
    rightFace: '#155E75',
    accent: PALETTE.CYAN,
    stepsRequired: 1,
    revertOnExtraHop: false,
    discRows: [2, 4]
  },
  // Round 2: 2-hop multi-step color transition (startColor -> midColor -> targetColor)
  {
    name: 'ROUND 2: DOUBLE HOP',
    startTop: '#31102F',
    midTop: PALETTE.PURPLE,
    targetTop: PALETTE.GREEN,
    startColor: '#31102F',
    midColor: PALETTE.PURPLE,
    targetColor: PALETTE.GREEN,
    leftFace: '#6B21A8',
    rightFace: '#4C1D95',
    accent: PALETTE.PINK,
    stepsRequired: 2,
    revertOnExtraHop: false,
    discRows: [1, 5]
  },
  // Round 3: Revert-on-extra-hop introduced!
  {
    name: 'ROUND 3: REVERT HOP',
    startTop: '#172554',
    midTop: PALETTE.ORANGE,
    targetTop: PALETTE.CYAN,
    startColor: '#172554',
    midColor: PALETTE.ORANGE,
    targetColor: PALETTE.CYAN,
    leftFace: '#9A3412',
    rightFace: '#7C2D12',
    accent: PALETTE.GOLD,
    stepsRequired: 2,
    revertOnExtraHop: true,
    discRows: [2, 5]
  },
  // Round 4: Crimson Neon Matrix (2-step + revert)
  {
    name: 'ROUND 4: CRIMSON MATRIX',
    startTop: '#1F2937',
    midTop: PALETTE.RED,
    targetTop: PALETTE.GOLD,
    startColor: '#1F2937',
    midColor: PALETTE.RED,
    targetColor: PALETTE.GOLD,
    leftFace: '#991B1B',
    rightFace: '#7F1D1D',
    accent: PALETTE.RED,
    stepsRequired: 2,
    revertOnExtraHop: true,
    discRows: [1, 4]
  },
  // Round 5: Emerald Prism (2-step + revert)
  {
    name: 'ROUND 5: EMERALD PRISM',
    startTop: '#064E3B',
    midTop: PALETTE.CYAN,
    targetTop: PALETTE.PINK,
    startColor: '#064E3B',
    midColor: PALETTE.CYAN,
    targetColor: PALETTE.PINK,
    leftFace: '#047857',
    rightFace: '#065F46',
    accent: PALETTE.GREEN,
    stepsRequired: 2,
    revertOnExtraHop: true,
    discRows: [2, 4]
  },
  // Round 6: Solar Flare (2-step + revert)
  {
    name: 'ROUND 6: SOLAR FLARE',
    startTop: '#3B0764',
    midTop: PALETTE.GOLD,
    targetTop: PALETTE.WHITE,
    startColor: '#3B0764',
    midColor: PALETTE.GOLD,
    targetColor: PALETTE.WHITE,
    leftFace: '#B45309',
    rightFace: '#78350F',
    accent: PALETTE.ORANGE,
    stepsRequired: 2,
    revertOnExtraHop: true,
    discRows: [1, 3, 5]
  },
  // Round 7: Cyber Indigo (2-step + revert)
  {
    name: 'ROUND 7: CYBER INDIGO',
    startTop: '#0F172A',
    midTop: PALETTE.PINK,
    targetTop: PALETTE.GREEN,
    startColor: '#0F172A',
    midColor: PALETTE.PINK,
    targetColor: PALETTE.GREEN,
    leftFace: '#1D4ED8',
    rightFace: '#1E3A8A',
    accent: PALETTE.BLUE,
    stepsRequired: 2,
    revertOnExtraHop: true,
    discRows: [2, 5]
  },
  // Round 8: Championship Apex (2-step + revert)
  {
    name: 'ROUND 8: APEX SANCTUM',
    startTop: '#450A0A',
    midTop: PALETTE.PURPLE,
    targetTop: PALETTE.CYAN,
    startColor: '#450A0A',
    midColor: PALETTE.PURPLE,
    targetColor: PALETTE.CYAN,
    leftFace: '#701A75',
    rightFace: '#4A044E',
    accent: PALETTE.PINK,
    stepsRequired: 2,
    revertOnExtraHop: true,
    discRows: [1, 4, 5]
  }
];

export class Qbert {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'qbert';
    this.title = 'Iso Hop';
    this.width = 960;
    this.height = 540;

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.reset();
  }

  // Converts pyramid grid coordinates (r, c) into screen center of the cube's top diamond
  _gridToScreen(r, c) {
    const x = TOP_X + (c - r * 0.5) * (CUBE_RX * 2);
    const y = TOP_Y + r * (CUBE_RY + CUBE_H);
    return { x, y };
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.enemies = [];
    this.particles = [];
    this.popups = [];
    this.spawnTimer = 2.2;
    this.stageClearTimer = 0;
    this.swearTimer = 0;

    this._initPyramid(this.level);
    this._resetQbertPosition();
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.audio.stopSequence();
  }

  _getTheme() {
    return LEVEL_THEMES[(this.level - 1) % LEVEL_THEMES.length];
  }

  _initPyramid(level) {
    const theme = this._getTheme();
    this.stepsRequired = theme.stepsRequired || (level >= 2 ? 2 : 1);
    this.revertOnExtraHop = Boolean(theme.revertOnExtraHop || level >= 3);
    this.targetState = this.stepsRequired;
    this.cubes = [];
    for (let r = 0; r < PYRAMID_ROWS; r++) {
      const rowArr = [];
      for (let c = 0; c <= r; c++) {
        rowArr.push({
          r,
          c,
          state: 0,
          flashTimer: 0
        });
      }
      this.cubes.push(rowArr);
    }

    // Flanking Spinning Escape Discs configured per round
    const discRows = theme.discRows || [2, 4];
    this.discs = [];
    discRows.forEach((r, idx) => {
      this.discs.push({ r, c: -1, active: true, phase: idx * 1.5 });
      this.discs.push({ r, c: r + 1, active: true, phase: idx * 1.5 + 0.75 });
    });
  }

  _resetQbertPosition() {
    const pos = this._gridToScreen(0, 0);
    this.qbert = {
      r: 0,
      c: 0,
      x: pos.x,
      y: pos.y,
      hopping: false,
      hopTimer: 0,
      hopDuration: 0.23,
      startX: pos.x,
      startY: pos.y,
      targetX: pos.x,
      targetY: pos.y,
      targetR: 0,
      targetC: 0,
      ridingDisc: null,
      falling: false,
      vy: 0,
      facing: 'DL',
      invuln: 1.6
    };
  }

  _addScore(pts, x = null, y = null, label = null, color = PALETTE.GOLD) {
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
        life: 0.95
      });
    }
  }

  _isPyramidComplete() {
    for (let r = 0; r < PYRAMID_ROWS; r++) {
      for (let c = 0; c <= r; c++) {
        if (this.cubes[r][c].state < this.targetState) return false;
      }
    }
    return true;
  }

  _startHop(dr, dc, facing) {
    const q = this.qbert;
    if (q.hopping || q.ridingDisc || q.falling || this.swearTimer > 0) return;

    const nr = q.r + dr;
    const nc = q.c + dc;
    const dest = this._gridToScreen(nr, nc);

    q.hopping = true;
    q.hopTimer = 0;
    q.startX = q.x;
    q.startY = q.y;
    q.targetX = dest.x;
    q.targetY = dest.y;
    q.targetR = nr;
    q.targetC = nc;
    q.facing = facing;
    this.audio.playHop();
  }

  _triggerHit(fellOff = false) {
    if (this.qbert.invuln > 0 && !fellOff) return;
    this.lives--;
    this.swearTimer = 1.25;
    this.enemies = [];
    this.audio.playHit();
    this.renderer.shake(8, 0.3);

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
    }
  }

  _spawnEnemy() {
    const hasCoily = this.enemies.some((e) => e.type === 'COILY' || e.type === 'PURPLE_EGG');
    const type = !hasCoily && Math.random() < 0.45 ? 'PURPLE_EGG' : 'RED_BALL';
    const startCol = Math.random() < 0.5 ? 0 : 1;
    const pos = this._gridToScreen(1, startCol);

    this.enemies.push({
      type,
      r: 1,
      c: startCol,
      x: pos.x,
      y: pos.y - 35,
      startX: pos.x,
      startY: pos.y - 35,
      targetX: pos.x,
      targetY: pos.y,
      targetR: 1,
      targetC: startCol,
      hopping: true,
      hopTimer: 0,
      hopDuration: 0.34,
      pauseTimer: 0.35,
      hatchTimer: 0,
      fallingOff: false
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
      if (this.input.isJustPressed('actionA')) {
        this.state = 'PLAYING';
      }
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

    // Stage Clear Celebration Flash
    if (this.stageClearTimer > 0) {
      this.stageClearTimer -= dt;
      if (this.stageClearTimer <= 0) {
        // Award bonus for remaining Escape Discs
        const activeDiscs = this.discs.filter((d) => d.active).length;
        if (activeDiscs > 0) {
          this._addScore(activeDiscs * 100, TOP_X, 95, `DISC BONUS +${activeDiscs * 100}`, PALETTE.CYAN);
        }
        this.level++;
        this.enemies = [];
        this._initPyramid(this.level);
        this._resetQbertPosition();
      }
      return;
    }

    // Swear Bubble Recovery Pause (@!#?@!)
    if (this.swearTimer > 0) {
      this.swearTimer -= dt;
      if (this.swearTimer <= 0) {
        if (this.lives <= 0) {
          this.state = 'GAMEOVER';
          this.audio.playGameOver();
          return;
        }
        if (this.qbert.falling || this.qbert.r < 0 || this.qbert.r >= PYRAMID_ROWS || this.qbert.c < 0 || this.qbert.c > this.qbert.r) {
          this._resetQbertPosition();
        } else {
          const pos = this._gridToScreen(this.qbert.r, this.qbert.c);
          this.qbert.x = pos.x;
          this.qbert.y = pos.y;
          this.qbert.hopping = false;
          this.qbert.invuln = 1.8;
        }
      }
      return;
    }

    // Animate Spinning Escape Discs
    for (const d of this.discs) {
      d.phase += dt * 8;
    }

    const q = this.qbert;
    if (q.invuln > 0) q.invuln = Math.max(0, q.invuln - dt);

    // Handle Q*bert Riding Escape Disc to Apex
    if (q.ridingDisc) {
      const topDest = this._gridToScreen(0, 0);
      const dx = topDest.x - q.x;
      const dy = (topDest.y - 24) - q.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 10) {
        q.ridingDisc.active = false;
        q.ridingDisc = null;
        q.r = 0;
        q.c = 0;
        q.x = topDest.x;
        q.y = topDest.y;
        this._landOnCube(0, 0);
      } else {
        q.x += (dx / dist) * 320 * dt;
        q.y += (dy / dist) * 320 * dt;
      }
    } else if (q.falling) {
      q.vy += 650 * dt;
      q.y += q.vy * dt;
      if (q.y > this.height) {
        this._triggerHit(true);
      }
    } else if (q.hopping) {
      q.hopTimer += dt;
      const t = Math.min(1, q.hopTimer / q.hopDuration);
      const arc = Math.sin(t * Math.PI) * 30;
      q.x = q.startX + (q.targetX - q.startX) * t;
      q.y = q.startY + (q.targetY - q.startY) * t - arc;

      if (t >= 1) {
        q.hopping = false;
        q.r = q.targetR;
        q.c = q.targetC;
        q.x = q.targetX;
        q.y = q.targetY;

        // Check if Q*bert landed on a Valid Pyramid Cube
        if (q.r >= 0 && q.r < PYRAMID_ROWS && q.c >= 0 && q.c <= q.r) {
          this._landOnCube(q.r, q.c);
        } else {
          // Check if Q*bert hopped onto an active Spinning Escape Disc!
          const disc = this.discs.find((d) => d.active && d.r === q.r && d.c === q.c);
          if (disc) {
            q.ridingDisc = disc;
            this.audio.playPowerUp();
          } else {
            // Fell off the pyramid edge!
            q.falling = true;
            q.vy = 60;
            this.audio.playLaser(600, 120, 0.35);
          }
        }
      }
    } else {
      // 4-Way Diagonal Hop Input
      const up = this.input.isJustPressed('up');
      const down = this.input.isJustPressed('down');
      const left = this.input.isJustPressed('left');
      const right = this.input.isJustPressed('right');

      if ((up && this.input.isDown('left')) || (up && !right)) {
        this._startHop(-1, -1, 'UL');
      } else if ((up && this.input.isDown('right')) || (right && !down)) {
        this._startHop(-1, 0, 'UR');
      } else if ((down && this.input.isDown('left')) || (left && !up)) {
        this._startHop(1, 0, 'DL');
      } else if ((down && this.input.isDown('right')) || (down && !left)) {
        this._startHop(1, 1, 'DR');
      } else if (this.input.pointer.justPressed) {
        // Click/Tap direction relative to Q*bert's current cube
        const dx = this.input.pointer.x - q.x;
        const dy = this.input.pointer.y - q.y;
        if (Math.hypot(dx, dy) > 12) {
          if (dy < 0 && dx < 0) this._startHop(-1, -1, 'UL');
          else if (dy < 0 && dx >= 0) this._startHop(-1, 0, 'UR');
          else if (dy >= 0 && dx < 0) this._startHop(1, 0, 'DL');
          else this._startHop(1, 1, 'DR');
        }
      }
    }

    // Spawn Enemies (Red Balls & Purple Eggs)
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(1.7, 3.1 - this.level * 0.2);
      if (this.enemies.length < 4) {
        this._spawnEnemy();
      }
    }

    // Update Enemies (Red Balls, Purple Eggs, and Coily the Snake)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      if (e.hopping) {
        e.hopTimer += dt;
        const t = Math.min(1, e.hopTimer / e.hopDuration);
        const arc = Math.sin(t * Math.PI) * (e.type === 'COILY' ? 36 : 24);
        e.x = e.startX + (e.targetX - e.startX) * t;
        e.y = e.startY + (e.targetY - e.startY) * t - arc;

        if (t >= 1) {
          e.hopping = false;
          e.r = e.targetR;
          e.c = e.targetC;
          e.x = e.targetX;
          e.y = e.targetY;

          if (e.fallingOff || e.r < 0 || e.r >= PYRAMID_ROWS || e.c < 0 || e.c > e.r) {
            if (e.type === 'COILY') {
              // Coily lured off the pyramid edge! +500 Bonus & clear screen!
              this.audio.playPowerUp();
              this._addScore(500, e.x, e.y, 'SERPENT LURED! +500', PALETTE.GOLD);
              this.enemies = [];
              break;
            }
            this.enemies.splice(i, 1);
            continue;
          }

          // Purple Egg reaching bottom row (r = 6) hatches into Coily the Snake!
          if (e.type === 'PURPLE_EGG' && e.r === PYRAMID_ROWS - 1) {
            e.hatchTimer = 0.85;
          } else {
            e.pauseTimer = e.type === 'COILY' ? Math.max(0.2, 0.42 - this.level * 0.03) : 0.35;
          }
        }
      } else if (e.hatchTimer > 0) {
        e.hatchTimer -= dt;
        if (e.hatchTimer <= 0) {
          e.type = 'COILY';
          e.pauseTimer = 0.25;
          this.audio.playPump(2);
        }
      } else {
        e.pauseTimer -= dt;
        if (e.pauseTimer <= 0) {
          let nr = e.r + 1;
          let nc = e.c + (Math.random() < 0.5 ? 0 : 1);

          if (e.type === 'COILY') {
            // Coily chases Q*bert's grid coordinates (even if Q*bert just hopped onto an Escape Disc!)
            const goalR = q.ridingDisc ? q.ridingDisc.r : q.r;
            const goalC = q.ridingDisc ? q.ridingDisc.c : q.c;
            if (goalR < e.r) {
              nr = e.r - 1;
              nc = goalC < e.c ? e.c - 1 : e.c;
            } else {
              nr = e.r + 1;
              nc = goalC > e.c ? e.c + 1 : e.c;
            }
          }

          const dest = this._gridToScreen(nr, nc);
          e.hopping = true;
          e.hopTimer = 0;
          e.startX = e.x;
          e.startY = e.y;
          e.targetX = dest.x;
          e.targetY = dest.y;
          e.targetR = nr;
          e.targetC = nc;
          if (nr < 0 || nr >= PYRAMID_ROWS || nc < 0 || nc > nr) {
            e.fallingOff = true;
          }
          if (e.type === 'COILY') {
            this.audio.playNote(195, 0.06, 'sawtooth', 0.16);
          }
        }
      }

      // Collision with Q*bert
      if (!q.ridingDisc && !q.falling && q.invuln <= 0 && Math.hypot(e.x - q.x, e.y - q.y) < 20) {
        this._triggerHit(false);
        break;
      }
    }

    // Cube flash decay & Popups
    for (let r = 0; r < PYRAMID_ROWS; r++) {
      for (let c = 0; c <= r; c++) {
        if (this.cubes[r][c].flashTimer > 0) {
          this.cubes[r][c].flashTimer = Math.max(0, this.cubes[r][c].flashTimer - dt);
        }
      }
    }

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 26 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  _landOnCube(r, c) {
    const cube = this.cubes[r][c];
    if (cube.state < this.targetState) {
      cube.state++;
      cube.flashTimer = 0.16;
      this.audio.playCoin();
      this._addScore(25, this.qbert.x, this.qbert.y - 18, '+25', PALETTE.GOLD);

      if (this._isPyramidComplete()) {
        this.stageClearTimer = 1.6;
        this.audio.playStageClear();
        this._addScore(1000, TOP_X, 85, `PYRAMID COMPLETE! +1000`, PALETTE.GREEN);
      }
    } else if (this.revertOnExtraHop && cube.state >= this.targetState) {
      // OG Level 3+ mechanic: hopping on an already-completed cube reverts it by 1 step!
      cube.state = Math.max(0, this.targetState - 1);
      cube.flashTimer = 0.14;
      this.audio.playNote(220, 0.06, 'triangle', 0.2);
    }
  }

  _drawIsometricCube(ctx, r, c, cube, theme, flashAll = false) {
    const { x, y } = this._gridToScreen(r, c);

    let topColor = theme.startTop;
    if (flashAll) {
      topColor = Math.floor(performance.now() * 0.015) % 2 === 0 ? PALETTE.GOLD : PALETTE.CYAN;
    } else if (cube.state >= this.targetState) {
      topColor = theme.targetTop;
    } else if (cube.state === 1) {
      topColor = theme.midTop;
    }

    ctx.save();
    // 1. Top Diamond Face
    ctx.fillStyle = topColor;
    if (cube.state >= this.targetState || cube.flashTimer > 0) {
      ctx.shadowColor = topColor;
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    ctx.moveTo(x, y - CUBE_RY);
    ctx.lineTo(x + CUBE_RX, y);
    ctx.lineTo(x, y + CUBE_RY);
    ctx.lineTo(x - CUBE_RX, y);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // 2. Left Vertical Face
    ctx.fillStyle = theme.leftFace;
    ctx.beginPath();
    ctx.moveTo(x - CUBE_RX, y);
    ctx.lineTo(x, y + CUBE_RY);
    ctx.lineTo(x, y + CUBE_RY + CUBE_H);
    ctx.lineTo(x - CUBE_RX, y + CUBE_H);
    ctx.closePath();
    ctx.fill();

    // 3. Right Vertical Face
    ctx.fillStyle = theme.rightFace;
    ctx.beginPath();
    ctx.moveTo(x + CUBE_RX, y);
    ctx.lineTo(x, y + CUBE_RY);
    ctx.lineTo(x, y + CUBE_RY + CUBE_H);
    ctx.lineTo(x + CUBE_RX, y + CUBE_H);
    ctx.closePath();
    ctx.fill();

    // Crisp Neon Wireframe Edges
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.35)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x, y - CUBE_RY);
    ctx.lineTo(x + CUBE_RX, y);
    ctx.lineTo(x, y + CUBE_RY);
    ctx.lineTo(x - CUBE_RX, y);
    ctx.closePath();
    ctx.moveTo(x - CUBE_RX, y);
    ctx.lineTo(x - CUBE_RX, y + CUBE_H);
    ctx.lineTo(x, y + CUBE_RY + CUBE_H);
    ctx.lineTo(x + CUBE_RX, y + CUBE_H);
    ctx.lineTo(x + CUBE_RX, y);
    ctx.moveTo(x, y + CUBE_RY);
    ctx.lineTo(x, y + CUBE_RY + CUBE_H);
    ctx.stroke();

    ctx.restore();
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear(PALETTE.BG);
    const theme = this._getTheme();

    // Target Color Preview Legend in Top-Left
    this.renderer.drawText('CHANGE CUBES TO:', 26, 78, {
      font: FONTS.HUD,
      size: 13,
      color: PALETTE.MUTED
    });
    this.renderer.drawGlowRect(48, 92, 42, 22, theme.targetTop, 10, true);

    // Diagonal Control Compass in Top-Right
    this.renderer.drawText('DIAGONAL HOP CONTROLS:', 755, 75, {
      font: FONTS.HUD,
      size: 12,
      color: PALETTE.MUTED
    });
    this.renderer.drawText('UP: ↖   RIGHT: ↗', 765, 96, {
      font: FONTS.HUD,
      size: 13,
      color: PALETTE.CYAN
    });
    this.renderer.drawText('LEFT: ↙  DOWN: ↘', 765, 116, {
      font: FONTS.HUD,
      size: 13,
      color: PALETTE.CYAN
    });

    // Render Spinning Escape Discs
    for (const d of this.discs) {
      if (!d.active && this.qbert.ridingDisc !== d) continue;
      const pos =
        this.qbert.ridingDisc === d
          ? { x: this.qbert.x, y: this.qbert.y + 8 }
          : this._gridToScreen(d.r, d.c);

      ctx.save();
      ctx.translate(pos.x, pos.y);
      const ringColors = [PALETTE.PINK, PALETTE.CYAN, PALETTE.GOLD];
      for (let k = 0; k < 3; k++) {
        const col = ringColors[(k + Math.floor(d.phase)) % 3];
        ctx.strokeStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 8;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 18 - k * 5, 9 - k * 2.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Render 7-Row Isometric 3D Pyramid
    const flashAll = this.stageClearTimer > 0;
    for (let r = 0; r < PYRAMID_ROWS; r++) {
      for (let c = 0; c <= r; c++) {
        this._drawIsometricCube(ctx, r, c, this.cubes[r][c], theme, flashAll);
      }
    }

    // Render Enemies (Red Balls, Purple Eggs, and Coily the Snake)
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y - 10);
      if (e.type === 'RED_BALL') {
        this.renderer.drawGlowCircle(0, 0, 10, PALETTE.RED, 10, true);
        ctx.fillStyle = PALETTE.WHITE;
        ctx.fillRect(-4, -4, 3, 3);
      } else if (e.type === 'PURPLE_EGG') {
        const shake = e.hatchTimer > 0 ? Math.sin(e.hatchTimer * 40) * 3 : 0;
        this.renderer.drawGlowCircle(shake, 0, 11, PALETTE.PURPLE, 10, true);
      } else if (e.type === 'COILY') {
        // Coiled spring body + menacing snake head
        ctx.strokeStyle = PALETTE.PURPLE;
        ctx.shadowColor = PALETTE.PINK;
        ctx.shadowBlur = 10;
        ctx.lineWidth = 3.5;
        for (let ring = 0; ring < 3; ring++) {
          ctx.beginPath();
          ctx.ellipse(0, 4 - ring * 6, 11, 4.5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        this.renderer.drawGlowCircle(0, -14, 9, PALETTE.PINK, 8, true);
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(-5, -17, 3, 4);
        ctx.fillRect(2, -17, 3, 4);
      }
      ctx.restore();
    }

    // Render Q*bert
    const q = this.qbert;
    const visible = q.invuln <= 0 || Math.floor(q.invuln * 14) % 2 === 0;
    if (visible) {
      ctx.save();
      ctx.translate(q.x, q.y - 12);

      // Feet
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(-7, 9, 5, 5);
      ctx.fillRect(2, 9, 5, 5);

      // Orange Spherical Body
      this.renderer.drawGlowCircle(0, 0, 13, PALETTE.ORANGE, 12, true);

      // Big Cartoon Eyes
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(-6, -8, 5, 6);
      ctx.fillRect(1, -8, 5, 6);
      ctx.fillStyle = PALETTE.BG;
      ctx.fillRect(-4, -6, 2.5, 3);
      ctx.fillRect(3, -6, 2.5, 3);

      // Iconic Tubular Snout pointing in hop direction
      const snoutX = q.facing.includes('L') ? -14 : 14;
      const snoutY = q.facing.includes('U') ? -4 : 4;
      ctx.strokeStyle = PALETTE.ORANGE;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(0, 1);
      ctx.lineTo(snoutX, snoutY);
      ctx.stroke();
      this.renderer.drawGlowCircle(snoutX, snoutY, 4.5, '#7C2D12', 4, true);

      // Classic "@!#?@!" Speech Bubble when hit!
      if (this.swearTimer > 0) {
        ctx.fillStyle = PALETTE.WHITE;
        ctx.fillRect(-38, -44, 76, 24);
        ctx.strokeStyle = PALETTE.PINK;
        ctx.lineWidth = 2;
        ctx.strokeRect(-38, -44, 76, 24);
        this.renderer.drawText('@!#?@!', 0, -28, {
          font: FONTS.HEADER,
          size: 10,
          color: PALETTE.RED,
          align: 'center'
        });
      }
      ctx.restore();
    }

    // Floating Popups
    for (const pop of this.popups) {
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HEADER,
        size: 11,
        color: pop.color,
        align: 'center',
        glow: 8
      });
    }

    // Top HUD
    let cubesRemaining = 0;
    for (let r = 0; r < PYRAMID_ROWS; r++) {
      for (let c = 0; c <= r; c++) {
        if (this.cubes[r][c].state < this.targetState) cubesRemaining++;
      }
    }

    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `CUBES LEFT: ${cubesRemaining}`,
      accent: PALETTE.ORANGE
    });

    // State Overlay
    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1982 ISOMETRIC PYRAMID PUZZLER',
      controls: 'ARROWS/WASD OR CLICK: HOP DIAGONALLY (UP=↖ RIGHT=↗ LEFT=↙ DOWN=↘)',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.ORANGE
    });
  }
}

export default Qbert;
