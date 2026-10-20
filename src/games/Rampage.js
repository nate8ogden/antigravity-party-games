/**
 * Rampage.js
 * Giant Kaiju City Destruction Arcade Game
 * Climb multi-story skyscrapers, punch structural windows, eat food/civilians for health,
 * dodge & swat military helicopters, tanks, and dynamite until the entire skyline collapses!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';
import { Vector2 } from '../engine/Vector2.js';

const KAIJU_IDLE = [
  '..GGGGGG..',
  '.GGGGGGGG.',
  'GGWKGWWKGG',
  'GGGGGGGGGG',
  '.GGRRRRGG.',
  'GGGGGGGGGG',
  'GGGGGGGGGG',
  '.GGGGGGGG.',
  '.GGG..GGG.',
  '.KK....KK.'
];

const KAIJU_PUNCH = [
  '..GGGGGG....',
  '.GGGGGGGG...',
  'GGWKGWWKGG..',
  'GGGGGGGGGGGG',
  '.GGRRRRGGGGY',
  'GGGGGGGGGGGG',
  'GGGGGGGGGG..',
  '.GGGGGGGG...',
  '.GGG..GGG...',
  '.KK....KK...'
];

export class Rampage {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'rampage';
    this.title = 'Kaiju Crush';
    this.state = 'PLAYING';

    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.groundY = 500;
    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.state = 'PLAYING';

    this.particles = [];
    this.floatingTexts = [];
    this.projectiles = [];
    this.enemies = [];
    this.dynamites = [];

    this._initPlayer();
    this._buildCity(this.level);
  }

  _initPlayer() {
    this.player = {
      x: 180,
      y: this.groundY,
      vx: 0,
      vy: 0,
      width: 44,
      height: 52,
      dir: 1,
      climbingBuilding: null,
      climbSide: 'left', // 'left' | 'right'
      onGround: true,
      health: 100,
      maxHealth: 100,
      punchTimer: 0,
      punchCooldown: 0,
      invulnTimer: 1.2,
      animTime: 0
    };
  }

  _buildCity(level) {
    this.buildings = [];
    this.enemies = [];
    this.projectiles = [];
    this.dynamites = [];
    this.enemySpawnTimer = 1.8;
    this.dynamiteTimer = 4.5;
    this.levelClearTimer = 0;

    const numBuildings = 4;
    const marginX = 95;
    const spacing = 195;
    const colors = ['#1E293B', '#334155', '#27272A', '#1E1B4B', '#31102F'];
    const trimColors = [PALETTE.CYAN, PALETTE.ORANGE, PALETTE.GOLD, PALETTE.PURPLE, PALETTE.PINK];

    for (let i = 0; i < numBuildings; i++) {
      const cols = 3;
      const floors = Math.min(8, 5 + Math.floor((level + i) / 2));
      const cellW = 42;
      const cellH = 38;
      const bWidth = cols * cellW + 16;
      const bHeight = floors * cellH + 14;
      const bx = marginX + i * spacing;
      const by = this.groundY - bHeight;

      const windows = [];
      for (let r = 0; r < floors; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
          let item = null;
          const roll = Math.random();
          if (roll < 0.22) item = 'food';
          else if (roll < 0.36) item = 'civilian';
          else if (roll < 0.44) item = 'gold';
          else if (roll < 0.50) item = 'hazard';

          row.push({
            row: r,
            col: c,
            hp: 2,
            maxHp: 2,
            lit: Math.random() < 0.65,
            item,
            itemRevealed: false,
            itemTimer: 0
          });
        }
        windows.push(row);
      }

      const maxStructuralHp = Math.ceil(floors * cols * 1.15);
      this.buildings.push({
        index: i,
        x: bx,
        y: by,
        width: bWidth,
        height: bHeight,
        baseHeight: bHeight,
        cols,
        floors,
        cellW,
        cellH,
        color: colors[(i + level) % colors.length],
        trimColor: trimColors[(i + level) % trimColors.length],
        windows,
        damage: 0,
        maxDamage: maxStructuralHp,
        collapsing: false,
        collapsed: false,
        collapseSpeed: 0,
        shakeOffset: 0
      });
    }
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.particles = [];
    this.projectiles = [];
    this.enemies = [];
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
        vy: -45,
        life: 0.85,
        maxLife: 0.85,
        color
      });
    }
  }

  _spawnParticles(x, y, count, color, speed = 120, gravity = 260) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const mag = (0.3 + Math.random() * 0.7) * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * mag,
        vy: Math.sin(angle) * mag - 30,
        gravity,
        life: 0.35 + Math.random() * 0.45,
        maxLife: 0.8,
        size: 3 + Math.random() * 4,
        color
      });
    }
  }

  _damagePlayer(amount) {
    if (this.player.invulnTimer > 0) return;
    this.player.health -= amount;
    this.player.invulnTimer = 0.65;
    this.renderer.shake(6, 0.18);
    this.audio.playHit();
    this._spawnParticles(this.player.x, this.player.y - 26, 10, PALETTE.RED, 140);

    if (this.player.health <= 0) {
      this.lives--;
      this.audio.playExplosion(0.5, 700);
      if (this.lives <= 0) {
        HighScoreStore.submit(this.id, this.score);
        this.audio.playGameOver();
        this.setState('GAMEOVER');
      } else {
        this.player.health = this.player.maxHealth;
        this.player.climbingBuilding = null;
        this.player.onGround = true;
        this.player.y = this.groundY;
        this.player.vy = 0;
        this.player.invulnTimer = 2.0;
        this.floatingTexts.push({
          text: 'KAIJU ENRAGED!',
          x: this.player.x,
          y: this.player.y - 60,
          vy: -30,
          life: 1.2,
          maxLife: 1.2,
          color: PALETTE.PINK
        });
      }
    }
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

    const p = this.player;
    p.animTime += dt;
    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    if (p.punchTimer > 0) p.punchTimer = Math.max(0, p.punchTimer - dt);
    if (p.punchCooldown > 0) p.punchCooldown = Math.max(0, p.punchCooldown - dt);

    const axis = this.input.getAxis();

    // Climbing / Ground Movement Logic
    if (p.climbingBuilding) {
      const b = p.climbingBuilding;
      if (b.collapsing || b.collapsed) {
        p.climbingBuilding = null;
        p.onGround = false;
      } else {
        const climbSpeed = 145;
        p.vy = axis.y * climbSpeed;
        p.y += p.vy * dt;

        // Keep attached to building edge
        if (p.climbSide === 'left') {
          p.x = b.x - 6;
          p.dir = 1;
        } else {
          p.x = b.x + b.width + 6;
          p.dir = -1;
        }

        // Reach ground
        if (p.y >= this.groundY) {
          p.y = this.groundY;
          p.climbingBuilding = null;
          p.onGround = true;
          p.vy = 0;
        } else if (p.y < b.y + 18) {
          // Roof limit
          p.y = b.y + 18;
        }

        // Switch sides or jump off
        if (this.input.isJustPressed('actionB')) {
          p.climbingBuilding = null;
          p.onGround = false;
          p.vy = -280;
          p.vx = axis.x !== 0 ? axis.x * 210 : -p.dir * 160;
          this.audio.playJump();
        } else if (p.y >= this.groundY - 14 && Math.abs(axis.x) > 0.3) {
          p.climbingBuilding = null;
          p.onGround = true;
          p.y = this.groundY;
        }
      }
    } else {
      // Ground or Airborne movement
      const moveSpeed = 190;
      p.vx = axis.x * moveSpeed;
      if (axis.x > 0.1) p.dir = 1;
      else if (axis.x < -0.1) p.dir = -1;

      p.x += p.vx * dt;
      p.x = Math.max(36, Math.min(924, p.x));

      if (p.onGround) {
        // Jump with Action B
        if (this.input.isJustPressed('actionB')) {
          p.vy = -340;
          p.onGround = false;
          this.audio.playJump();
        }

        // Latch onto a building side when pressing UP near its left/right wall
        if (axis.y < -0.3) {
          for (const b of this.buildings) {
            if (b.collapsed || b.collapsing) continue;
            const distLeft = Math.abs(p.x - b.x);
            const distRight = Math.abs(p.x - (b.x + b.width));
            if (distLeft < 28) {
              p.climbingBuilding = b;
              p.climbSide = 'left';
              p.x = b.x - 6;
              p.dir = 1;
              p.onGround = false;
              p.y -= 8;
              break;
            } else if (distRight < 28) {
              p.climbingBuilding = b;
              p.climbSide = 'right';
              p.x = b.x + b.width + 6;
              p.dir = -1;
              p.onGround = false;
              p.y -= 8;
              break;
            }
          }
        }
      } else {
        // Gravity while airborne
        p.vy += 680 * dt;
        p.y += p.vy * dt;

        // Can grab building mid-air if holding UP
        if (axis.y < -0.3) {
          for (const b of this.buildings) {
            if (b.collapsed || b.collapsing) continue;
            if (p.y > b.y + 15 && p.y < this.groundY) {
              if (Math.abs(p.x - b.x) < 24) {
                p.climbingBuilding = b;
                p.climbSide = 'left';
                p.vy = 0;
                p.vx = 0;
                break;
              } else if (Math.abs(p.x - (b.x + b.width)) < 24) {
                p.climbingBuilding = b;
                p.climbSide = 'right';
                p.vy = 0;
                p.vx = 0;
                break;
              }
            }
          }
        }

        if (p.y >= this.groundY) {
          p.y = this.groundY;
          p.vy = 0;
          p.onGround = true;
          this.renderer.shake(3, 0.08);
          this.audio.playShove();
        }
      }
    }

    // Punch Mechanic (Action A or Pointer Click)
    if (
      (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) &&
      p.punchCooldown <= 0
    ) {
      p.punchTimer = 0.18;
      p.punchCooldown = 0.22;
      this._performPunch();
    }

    // Update Buildings & Window Items
    let activeBuildings = 0;
    for (const b of this.buildings) {
      if (b.collapsed) continue;
      activeBuildings++;

      // Update revealed window bonuses
      for (let r = 0; r < b.floors; r++) {
        for (let c = 0; c < b.cols; c++) {
          const w = b.windows[r][c];
          if (w.itemRevealed && w.item) {
            w.itemTimer -= dt;
            if (w.itemTimer <= 0) {
              w.item = null;
              w.itemRevealed = false;
            }
          }
        }
      }

      // Check structural collapse trigger
      if (!b.collapsing && b.damage >= b.maxDamage) {
        b.collapsing = true;
        b.collapseSpeed = 95;
        this.audio.playExplosion(0.65, 550);
        this.renderer.shake(9, 0.45);
        this._addScore(1000 * this.level, b.x + b.width / 2, b.y + 40, PALETTE.CYAN);
        if (p.climbingBuilding === b) {
          p.climbingBuilding = null;
          p.onGround = false;
          p.vy = -180;
        }
      }

      if (b.collapsing) {
        b.collapseSpeed += 220 * dt;
        const drop = b.collapseSpeed * dt;
        b.y += drop;
        b.height -= drop;
        b.shakeOffset = (Math.random() * 2 - 1) * 5;

        // Emit rubble & smoke cloud along base
        if (Math.random() < 0.65) {
          this._spawnParticles(
            b.x + Math.random() * b.width,
            this.groundY - 8,
            3,
            Math.random() < 0.5 ? '#94A3B8' : PALETTE.ORANGE,
            110,
            180
          );
        }

        if (b.height <= 18) {
          b.height = 14;
          b.y = this.groundY - 14;
          b.collapsing = false;
          b.collapsed = true;
          this.audio.playExplosion(0.5, 400);
          this._spawnParticles(b.x + b.width / 2, this.groundY - 10, 28, '#CBD5E1', 180, 240);
        }
      }
    }

    // Spawn Military Helicopters & Tanks
    this.enemySpawnTimer -= dt;
    if (this.enemySpawnTimer <= 0 && activeBuildings > 0) {
      this.enemySpawnTimer = Math.max(1.4, 3.4 - this.level * 0.25);
      if (this.enemies.length < 4 + this.level) {
        const fromLeft = Math.random() < 0.5;
        const isHeli = Math.random() < 0.58;
        if (isHeli) {
          this.enemies.push({
            type: 'heli',
            x: fromLeft ? -30 : 990,
            y: 90 + Math.random() * 170,
            vx: (fromLeft ? 1 : -1) * (85 + this.level * 12),
            vy: 0,
            dir: fromLeft ? 1 : -1,
            fireTimer: 1.2 + Math.random() * 1.2,
            rotorPhase: 0
          });
        } else {
          this.enemies.push({
            type: 'tank',
            x: fromLeft ? -35 : 995,
            y: this.groundY,
            vx: (fromLeft ? 1 : -1) * (55 + this.level * 8),
            dir: fromLeft ? 1 : -1,
            fireTimer: 1.5 + Math.random() * 1.2
          });
        }
      }
    }

    // Spawn Dynamite sticks near buildings
    this.dynamiteTimer -= dt;
    if (this.dynamiteTimer <= 0 && activeBuildings > 0) {
      this.dynamiteTimer = Math.max(3.5, 6.5 - this.level * 0.3);
      const standing = this.buildings.filter((b) => !b.collapsed && !b.collapsing);
      if (standing.length > 0) {
        const targetB = standing[Math.floor(Math.random() * standing.length)];
        this.dynamites.push({
          x: targetB.x + targetB.width / 2,
          y: this.groundY - 8,
          fuse: 3.0,
          building: targetB
        });
      }
    }

    // Update Dynamite
    for (let i = this.dynamites.length - 1; i >= 0; i--) {
      const dyn = this.dynamites[i];
      dyn.fuse -= dt;
      if (Math.random() < 0.4) {
        this._spawnParticles(dyn.x, dyn.y - 10, 1, PALETTE.GOLD, 50, -40);
      }
      if (dyn.fuse <= 0) {
        this.audio.playExplosion(0.45, 800);
        this.renderer.shake(7, 0.25);
        this._spawnParticles(dyn.x, dyn.y - 8, 20, PALETTE.ORANGE, 170, 220);
        if (dyn.building && !dyn.building.collapsed) {
          dyn.building.damage += 4;
        }
        if (Math.hypot(p.x - dyn.x, p.y - dyn.y) < 68) {
          this._damagePlayer(18);
        }
        this.dynamites.splice(i, 1);
      }
    }

    // Update Enemies (Helicopters & Tanks)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.x += e.vx * dt;
      if (e.type === 'heli') {
        e.rotorPhase += dt * 25;
        e.y += Math.sin(e.rotorPhase * 0.15) * 18 * dt;
      }

      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        e.fireTimer = Math.max(1.1, 2.4 - this.level * 0.15);
        const dx = p.x - e.x;
        const dy = p.y - 26 - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 460) {
          const spd = e.type === 'tank' ? 250 : 220;
          this.projectiles.push({
            x: e.x,
            y: e.type === 'tank' ? e.y - 14 : e.y + 6,
            vx: (dx / dist) * spd,
            vy: (dy / dist) * spd,
            color: e.type === 'tank' ? PALETTE.ORANGE : PALETTE.PINK,
            damage: e.type === 'tank' ? 12 : 8,
            radius: e.type === 'tank' ? 5 : 3.5
          });
          this.audio.playLaser(550, 180, 0.09);
        }
      }

      if (e.x < -80 || e.x > 1040) {
        this.enemies.splice(i, 1);
      }
    }

    // Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;

      if (
        Math.abs(proj.x - p.x) < 22 &&
        proj.y >= p.y - p.height &&
        proj.y <= p.y
      ) {
        this._damagePlayer(proj.damage);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (proj.x < 0 || proj.x > 960 || proj.y < 38 || proj.y > this.groundY) {
        this.projectiles.splice(i, 1);
      }
    }

    // Update Particles & Floating Texts
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += pt.gravity * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // Check City Demolition Completion
    if (activeBuildings === 0) {
      this.levelClearTimer += dt;
      if (this.levelClearTimer === dt) {
        this.audio.playStageClear();
        this._addScore(2500 * this.level, 480, 220, PALETTE.GREEN);
      }
      if (this.levelClearTimer > 2.2) {
        this.level++;
        this.player.health = Math.min(this.player.maxHealth, this.player.health + 35);
        this._buildCity(this.level);
      }
    }
  }

  _performPunch() {
    const p = this.player;
    const punchX = p.x + p.dir * 30;
    const punchY = p.y - 28;

    this.renderer.shake(4, 0.1);
    this.audio.playShove();

    // 1. Check punching enemies (Helicopters / Tanks)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const ey = e.type === 'tank' ? e.y - 12 : e.y;
      if (Math.hypot(punchX - e.x, punchY - ey) < 46) {
        this.audio.playExplosion(0.35, 900);
        this._spawnParticles(e.x, ey, 18, PALETTE.ORANGE, 160);
        const pts = e.type === 'heli' ? 400 : 350;
        this._addScore(pts, e.x, ey - 10, PALETTE.GOLD);
        this.enemies.splice(i, 1);
        return;
      }
    }

    // 2. Check punching Dynamite (defuses/throws it for bonus!)
    for (let i = this.dynamites.length - 1; i >= 0; i--) {
      const dyn = this.dynamites[i];
      if (Math.hypot(punchX - dyn.x, punchY - dyn.y) < 44) {
        this.audio.playCoin();
        this._spawnParticles(dyn.x, dyn.y, 12, PALETTE.CYAN, 130);
        this._addScore(300, dyn.x, dyn.y - 15, PALETTE.CYAN);
        this.dynamites.splice(i, 1);
        return;
      }
    }

    // 3. Check punching Building Windows / Structural Blocks
    for (const b of this.buildings) {
      if (b.collapsed || b.collapsing) continue;
      if (
        punchX >= b.x - 18 &&
        punchX <= b.x + b.width + 18 &&
        punchY >= b.y &&
        punchY <= b.y + b.height
      ) {
        // Find nearest window cell
        const relY = Math.max(0, Math.min(b.height - 1, punchY - (b.y + 10)));
        const r = Math.min(b.floors - 1, Math.floor(relY / b.cellH));

        let c = 0;
        if (p.climbingBuilding === b) {
          c = p.climbSide === 'left' ? 0 : b.cols - 1;
          // If edge window already broken, reach into middle column
          if (b.windows[r][c].hp <= 0 && b.cols > 1) {
            c = 1;
          }
        } else {
          const relX = Math.max(0, Math.min(b.width - 1, punchX - (b.x + 8)));
          c = Math.min(b.cols - 1, Math.floor(relX / b.cellW));
        }

        const win = b.windows[r][c];
        const wx = b.x + 8 + c * b.cellW + b.cellW / 2;
        const wy = b.y + 10 + r * b.cellH + b.cellH / 2;

        // If item is revealed, eat/grab it!
        if (win.itemRevealed && win.item) {
          if (win.item === 'food' || win.item === 'civilian') {
            const heal = win.item === 'food' ? 14 : 20;
            p.health = Math.min(p.maxHealth, p.health + heal);
            this.audio.playPowerUp();
            this._addScore(250, wx, wy, PALETTE.GREEN);
            this.floatingTexts.push({
              text: `+${heal} HP`,
              x: wx,
              y: wy - 16,
              vy: -40,
              life: 0.9,
              maxLife: 0.9,
              color: PALETTE.GREEN
            });
          } else if (win.item === 'gold') {
            this.audio.playCoin();
            this._addScore(500, wx, wy, PALETTE.GOLD);
          } else if (win.item === 'hazard') {
            this._damagePlayer(10);
            this.floatingTexts.push({
              text: 'SHOCK!',
              x: wx,
              y: wy - 16,
              vy: -40,
              life: 0.8,
              maxLife: 0.8,
              color: PALETTE.RED
            });
          }
          win.item = null;
          win.itemRevealed = false;
          return;
        }

        // Otherwise smash the window/block
        if (win.hp > 0) {
          win.hp--;
          b.damage++;
          this._spawnParticles(wx, wy, 10, PALETTE.CYAN, 130);
          this._addScore(75, wx, wy, PALETTE.WHITE);
          if (win.hp === 1 && win.item) {
            win.itemRevealed = true;
            win.itemTimer = 4.5;
          }
        } else {
          // Punching exposed structural girder deals structural damage
          b.damage += 0.75;
          this._spawnParticles(wx, wy, 7, '#94A3B8', 100);
          this._addScore(50, wx, wy, PALETTE.ORANGE);
        }
        return;
      }
    }
  }

  render(ctx = this.renderer.ctx) {
    // Night Metropolis Backdrop
    ctx.fillStyle = PALETTE.BG;
    ctx.fillRect(0, 38, this.renderer.width, this.renderer.height - 38);

    // Distant silhouette skyline
    ctx.fillStyle = '#111827';
    for (let i = 0; i < 12; i++) {
      const sx = i * 84;
      const sh = 90 + ((i * 47) % 130);
      ctx.fillRect(sx, this.groundY - sh, 76, sh);
    }

    // Draw Destructible Skyscrapers
    for (const b of this.buildings) {
      ctx.save();
      const bx = b.x + (b.collapsing ? b.shakeOffset : 0);

      if (b.collapsed) {
        // Pile of smoking rubble
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(b.x - 10, this.groundY);
        ctx.lineTo(b.x + 25, this.groundY - 22);
        ctx.lineTo(b.x + b.width * 0.5, this.groundY - 14);
        ctx.lineTo(b.x + b.width - 20, this.groundY - 26);
        ctx.lineTo(b.x + b.width + 10, this.groundY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        continue;
      }

      // Building body clipped above groundY
      ctx.beginPath();
      ctx.rect(bx - 4, 40, b.width + 8, this.groundY - 40);
      ctx.clip();

      ctx.fillStyle = b.color;
      ctx.fillRect(bx, b.y, b.width, b.height);
      ctx.strokeStyle = b.trimColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, b.y, b.width, b.height);

      // Structural Integrity Bar on Roof
      const integrity = Math.max(0, 1 - b.damage / b.maxDamage);
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(bx + 12, b.y - 9, b.width - 24, 5);
      ctx.fillStyle =
        integrity > 0.5 ? PALETTE.GREEN : integrity > 0.25 ? PALETTE.GOLD : PALETTE.RED;
      ctx.fillRect(bx + 12, b.y - 9, (b.width - 24) * integrity, 5);

      // Windows & Structural Holes
      for (let r = 0; r < b.floors; r++) {
        for (let c = 0; c < b.cols; c++) {
          const w = b.windows[r][c];
          const wx = bx + 8 + c * b.cellW + 4;
          const wy = b.y + 10 + r * b.cellH + 4;
          const ww = b.cellW - 8;
          const wh = b.cellH - 8;

          if (w.hp === 2) {
            ctx.fillStyle = w.lit ? '#FEF08A' : '#1E293B';
            ctx.fillRect(wx, wy, ww, wh);
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1;
            ctx.strokeRect(wx, wy, ww, wh);
          } else if (w.hp === 1) {
            // Cracked window
            ctx.fillStyle = '#0F172A';
            ctx.fillRect(wx, wy, ww, wh);
            ctx.strokeStyle = PALETTE.CYAN;
            ctx.beginPath();
            ctx.moveTo(wx, wy);
            ctx.lineTo(wx + ww, wy + wh);
            ctx.moveTo(wx + ww, wy);
            ctx.lineTo(wx, wy + wh);
            ctx.stroke();
          } else {
            // Smashed structural hole with exposed girder
            ctx.fillStyle = '#090D16';
            ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
            ctx.strokeStyle = PALETTE.RED;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(wx, wy + wh / 2 - 2, ww, 4);
          }

          // Revealed Item inside window
          if (w.itemRevealed && w.item) {
            const cx = wx + ww / 2;
            const cy = wy + wh / 2;
            if (w.item === 'food') {
              this.renderer.drawGlowCircle(cx, cy, 6, PALETTE.GREEN, 8);
            } else if (w.item === 'civilian') {
              this.renderer.drawGlowCircle(cx, cy - 3, 4, PALETTE.PINK, 8);
              ctx.fillStyle = PALETTE.WHITE;
              ctx.fillRect(cx - 3, cy + 1, 6, 7);
            } else if (w.item === 'gold') {
              this.renderer.drawGlowRect(cx - 6, cy - 4, 12, 8, PALETTE.GOLD, 10);
            } else if (w.item === 'hazard') {
              this.renderer.drawGlowCircle(cx, cy, 6, PALETTE.RED, 10);
            }
          }
        }
      }
      ctx.restore();
    }

    // Street Pavement
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, this.groundY, this.renderer.width, this.renderer.height - this.groundY);
    ctx.strokeStyle = PALETTE.GOLD;
    ctx.setLineDash([18, 14]);
    ctx.beginPath();
    ctx.moveTo(0, this.groundY + 20);
    ctx.lineTo(this.renderer.width, this.groundY + 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Dynamite Sticks
    for (const dyn of this.dynamites) {
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(dyn.x - 6, dyn.y - 12, 12, 12);
      this.renderer.drawText(dyn.fuse.toFixed(1), dyn.x, dyn.y - 16, {
        size: 11,
        color: PALETTE.GOLD,
        align: 'center'
      });
    }

    // Draw Player Kaiju
    const p = this.player;
    if (p.invulnTimer <= 0 || Math.floor(p.invulnTimer * 16) % 2 === 0) {
      const sprite = p.punchTimer > 0 ? KAIJU_PUNCH : KAIJU_IDLE;
      const palette = {
        G: PALETTE.GREEN,
        W: PALETTE.WHITE,
        K: '#0B0F19',
        R: PALETTE.PINK,
        Y: PALETTE.GOLD
      };
      const scale = 4.5;
      const drawX = p.x - (sprite[0].length * scale) / 2;
      const drawY = p.y - sprite.length * scale;
      this.renderer.drawPixelSprite(sprite, drawX, drawY, scale, palette, p.dir < 0, false);

      // Punch Shockwave
      if (p.punchTimer > 0) {
        this.renderer.drawGlowCircle(
          p.x + p.dir * 30,
          p.y - 28,
          12,
          PALETTE.GOLD,
          12,
          false,
          2.5
        );
      }
    }

    // Draw Enemies (Helicopters & Tanks)
    for (const e of this.enemies) {
      if (e.type === 'heli') {
        ctx.save();
        ctx.translate(e.x, e.y);
        // Helicopter body
        this.renderer.drawGlowRect(-16, -8, 32, 16, PALETTE.CYAN, 8);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(e.dir > 0 ? 2 : -14, -5, 12, 8);
        // Tail boom
        ctx.fillStyle = PALETTE.CYAN;
        ctx.fillRect(e.dir > 0 ? -28 : 16, -3, 12, 5);
        // Spinning Rotor
        const bladeW = 22 * Math.cos(e.rotorPhase);
        ctx.strokeStyle = PALETTE.WHITE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-bladeW, -12);
        ctx.lineTo(bladeW, -12);
        ctx.stroke();
        ctx.restore();
      } else {
        // Tank on street
        ctx.save();
        ctx.translate(e.x, e.y);
        this.renderer.drawGlowRect(-18, -12, 36, 12, PALETTE.ORANGE, 8);
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(-10, -20, 20, 8);
        ctx.fillRect(e.dir > 0 ? 8 : -24, -18, 16, 4);
        ctx.restore();
      }
    }

    // Draw Projectiles
    for (const proj of this.projectiles) {
      this.renderer.drawGlowCircle(proj.x, proj.y, proj.radius, proj.color, 10);
    }

    // Draw Rubble & Smoke Particles
    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    // Draw Floating Score / Heal Popups
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

    // Kaiju Health Bar in Upper Left Arena
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(16, 46, 184, 16);
    const hpRatio = Math.max(0, p.health / p.maxHealth);
    const hpColor = hpRatio > 0.5 ? PALETTE.GREEN : hpRatio > 0.25 ? PALETTE.GOLD : PALETTE.RED;
    this.renderer.drawGlowRect(18, 48, 180 * hpRatio, 12, hpColor, 6);
    this.renderer.drawText(`KAIJU HP: ${Math.ceil(p.health)}%`, 208, 59, {
      size: 12,
      color: PALETTE.WHITE
    });

    // Top HUD Bar
    const standingCount = this.buildings.filter((b) => !b.collapsed).length;
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `TOWERS:${standingCount}`,
      accent: PALETTE.GREEN
    });

    // State Overlay
    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'KAIJU SKYSCRAPER DEMOLITION',
      controls: 'ARROWS: WALK/CLIMB  |  Z/SPACE: PUNCH  |  X/SHIFT: JUMP',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GREEN
    });
  }
}

export default Rampage;
