/**
 * Pitfall.js
 * Multi-Screen Jungle Adventure (Upper Canopy + Underground Scorpion Tunnel)
 * Run, jump over rolling logs, scorpions, and snapping crocodile jaws (safe when closed,
 * deadly when open!), and swing on jungle vines over expanding tar pits & quicksand!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const HARRY_RUN_1 = [
  '..YYYY..',
  '.FFFFFF.',
  '..FFFF..',
  '.GGGGGG.',
  'GG.GG.GG',
  '...GG...',
  '..BBBB..',
  '.BB..BB.',
  'BB....BB',
  'KK....KK'
];

const HARRY_RUN_2 = [
  '..YYYY..',
  '.FFFFFF.',
  '..FFFF..',
  '..GGGG..',
  '.GGGGGG.',
  '...GG...',
  '..BBBB..',
  '..BB.BB.',
  '.KK..KK.',
  '........'
];

const PITFALL_SCORPION_1 = [
  '..WWW.......',
  '.WW..W......',
  '.WW.........',
  '..WWWWWWWWRR',
  '.WWWWWWWWWWR',
  '..W.W.W.W...',
  '.W..W.W..W..'
];

const PITFALL_SCORPION_2 = [
  '...WWW......',
  '..WW..W.....',
  '.WW.........',
  '..WWWWWWWWRR',
  '.WWWWWWWWWWR',
  '..W.W.W.W...',
  '..W..W..W...'
];

const PITFALL_COBRA_SPRITE = [
  '...KKKKR..',
  '..KKYKK...',
  '..KKKK....',
  '...KK.....',
  '..KKKK....',
  '.KKKKKK...',
  'KKKKKKKK..'
];

export class Pitfall {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'pitfall';
    this.title = 'Pitfall!';
    this.state = 'PLAYING';

    this.score = 2000;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.upperGroundY = 352;
    this.lowerGroundY = 502;

    this.reset();
  }

  reset() {
    this.score = 2000;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.state = 'PLAYING';

    this.screenIndex = 0;
    this.collectedTreasures = new Set();
    this.treasuresFound = 0;
    this.timeLeft = 1200; // 20:00 classic timer in seconds
    this.particles = [];
    this.floatingTexts = [];

    this.player = {
      x: 110,
      y: this.upperGroundY,
      vx: 0,
      vy: 0,
      dir: 1,
      onGround: true,
      onVine: false,
      vineReleaseCooldown: 0,
      climbing: false,
      floor: 'upper', // 'upper' | 'lower'
      invulnTimer: 1.0,
      animTime: 0
    };

    this._loadScreen(this.screenIndex);
  }

  _loadScreen(index) {
    // 12 Handcrafted OG Activision Pitfall! Jungle Screens before procedural fallback
    const OG_SCREENS = [
      { name: 'TAR PIT & SWINGING VINE', pit: 'tarPit', halfW: 125, vine: true, ladder: true, logs: 1, treasure: null },
      { name: 'CROCODILE POND & VINE', pit: 'crocPond', halfW: 155, vine: true, ladder: false, logs: 0, treasure: 'GOLD BAR' },
      { name: 'QUICKSAND & TWIN LOGS', pit: 'quicksand', halfW: 130, vine: true, ladder: true, logs: 2, treasure: 'DIAMOND RING' },
      { name: 'SCORPION CAVERN LADDER', pit: 'tarPit', halfW: 110, vine: false, ladder: true, logs: 1, treasure: 'SILVER BAR' },
      { name: 'THREE-CROCODILE CROSSING', pit: 'crocPond', halfW: 160, vine: false, ladder: false, logs: 0, treasure: 'RUBY CHALICE' },
      { name: 'COBRA & CAMPFIRE TREASURY', pit: 'tarPit', halfW: 120, vine: true, ladder: false, logs: 1, treasure: 'MONEY BAG', cobra: true },
      { name: 'DISAPPEARING TAR PIT', pit: 'quicksand', halfW: 145, vine: true, ladder: true, logs: 2, treasure: null },
      { name: 'DIAMOND RING VAULT', pit: 'crocPond', halfW: 155, vine: true, ladder: false, logs: 1, treasure: 'DIAMOND RING' },
      { name: 'TWIN ROLLING LOGS PASS', pit: 'tarPit', halfW: 125, vine: true, ladder: true, logs: 2, treasure: 'GOLD BAR' },
      { name: 'QUICKSAND VINE CHASM', pit: 'quicksand', halfW: 150, vine: true, ladder: false, logs: 1, treasure: 'RUBY CHALICE', cobra: true },
      { name: 'CROCODILE KING LAGOON', pit: 'crocPond', halfW: 165, vine: false, ladder: true, logs: 1, treasure: 'SILVER BAR' },
      { name: 'GOLDEN IDOL SANCTUARY', pit: 'tarPit', halfW: 135, vine: true, ladder: true, logs: 2, treasure: 'DIAMOND RING', cobra: true }
    ];

    const normalizedIdx = ((index % 255) + 255) % 255;
    let spec;
    if (normalizedIdx < OG_SCREENS.length) {
      spec = OG_SCREENS[normalizedIdx];
    } else {
      // Procedural fallback for screens beyond the 12 handcrafted screens
      const mod = normalizedIdx % 5;
      spec = {
        name: `JUNGLE SECTOR ${normalizedIdx + 1}`,
        pit: mod === 1 || mod === 3 ? 'crocPond' : mod === 2 ? 'quicksand' : 'tarPit',
        halfW: mod === 1 || mod === 3 ? 155 : 125,
        vine: mod !== 1,
        ladder: mod % 2 === 0,
        logs: mod === 4 ? 2 : mod === 1 ? 0 : 1,
        treasure: mod === 0 ? null : ['GOLD BAR', 'DIAMOND RING', 'RUBY CHALICE'][normalizedIdx % 3],
        cobra: mod === 3
      };
    }

    this.screenName = spec.name;
    const hasCrocPond = spec.pit === 'crocPond';

    this.pit = {
      type: spec.pit,
      cx: 480,
      baseHalfW: spec.halfW,
      halfW: spec.halfW,
      expandPhase: 0
    };

    this.vine = spec.vine
      ? {
          anchorX: 480,
          anchorY: 72,
          length: 215,
          angle: -0.65,
          angularVel: 0,
          maxAngle: 0.68,
          phase: 0
        }
      : null;

    this.crocodiles = [];
    if (hasCrocPond) {
      const xs = [395, 480, 565];
      xs.forEach((cx, i) => {
        this.crocodiles.push({
          x: cx,
          y: this.upperGroundY,
          width: 48,
          mouthOpen: false,
          timer: 1.2 + i * 0.45,
          cycleOpen: 1.15,
          cycleClosed: 2.1
        });
      });
    }

    this.ladder = spec.ladder
      ? {
          x: 740,
          topY: this.upperGroundY,
          bottomY: this.lowerGroundY
        }
      : null;

    this.logs = [];
    for (let i = 0; i < spec.logs; i++) {
      this.logs.push({
        x: 860 - i * 220,
        y: this.upperGroundY - 12,
        vx: -(150 + this.level * 18),
        radius: 12,
        rot: 0,
        jumped: false
      });
    }

    // Optional rattling Cobra / Campfire hazard guarding the right bank
    this.cobra = spec.cobra
      ? {
          x: 685,
          y: this.upperGroundY,
          phase: 0
        }
      : null;

    this.scorpion = {
      x: 480,
      y: this.lowerGroundY,
      vx: 95 + this.level * 12,
      dir: 1,
      anim: 0
    };

    // Treasure on right bank if not already collected on this screen
    this.treasure = null;
    if (!this.collectedTreasures.has(index) && spec.treasure) {
      const catalog = {
        'GOLD BAR': { name: 'GOLD BAR', pts: 2000, color: PALETTE.GOLD },
        'DIAMOND RING': { name: 'DIAMOND RING', pts: 3000, color: PALETTE.CYAN },
        'RUBY CHALICE': { name: 'RUBY CHALICE', pts: 2500, color: PALETTE.PINK },
        'SILVER BAR': { name: 'SILVER BAR', pts: 2000, color: PALETTE.WHITE },
        'MONEY BAG': { name: 'MONEY BAG', pts: 2500, color: PALETTE.GREEN }
      };
      const t = catalog[spec.treasure] || catalog['GOLD BAR'];
      this.treasure = {
        x: 815,
        y: this.upperGroundY - 16,
        ...t,
        bob: 0
      };
    }
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.particles = [];
    this.floatingTexts = [];
  }

  _playTarzanYodel() {
    this.audio.playChiptune([
      { freq: 440, dur: 0.08, type: 'square' },
      { freq: 587.33, dur: 0.08, type: 'square' },
      { freq: 440, dur: 0.08, type: 'square' },
      { freq: 659.25, dur: 0.12, type: 'square' },
      { freq: 523.25, dur: 0.08, type: 'square' },
      { freq: 659.25, dur: 0.16, type: 'square' }
    ]);
  }

  _spawnParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 110;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 35,
        life: 0.4 + Math.random() * 0.35,
        maxLife: 0.75,
        color,
        size: 3 + Math.random() * 3
      });
    }
  }

  _loseLife(reason = 'HAZARD!') {
    const p = this.player;
    if (p.invulnTimer > 0) return;
    this.lives--;
    this.renderer.shake(7, 0.25);
    this.audio.playExplosion(0.45, 650);
    this._spawnParticles(p.x, p.y - 18, 18, PALETTE.RED);

    this.floatingTexts.push({
      text: reason,
      x: p.x,
      y: p.y - 45,
      vy: -35,
      life: 1.0,
      maxLife: 1.0,
      color: PALETTE.RED
    });

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.audio.playGameOver();
      this.setState('GAMEOVER');
      return;
    }

    // Respawn on safe left bank
    p.x = 110;
    p.y = this.upperGroundY;
    p.vx = 0;
    p.vy = 0;
    p.onGround = true;
    p.onVine = false;
    p.climbing = false;
    p.floor = 'upper';
    p.invulnTimer = 1.6;
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

    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.audio.playGameOver();
      this.setState('GAMEOVER');
      return;
    }

    const p = this.player;
    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    if (p.vineReleaseCooldown > 0) p.vineReleaseCooldown = Math.max(0, p.vineReleaseCooldown - dt);

    const axis = this.input.getAxis();
    const jumpPressed =
      this.input.isJustPressed('actionA') ||
      this.input.isJustPressed('up') ||
      this.input.pointer.justPressed;

    // Update Swinging Vine Pendulum
    if (this.vine) {
      this.vine.phase += dt * 2.55;
      this.vine.angle = Math.sin(this.vine.phase) * this.vine.maxAngle;
      this.vine.tipX = this.vine.anchorX + Math.sin(this.vine.angle) * this.vine.length;
      this.vine.tipY = this.vine.anchorY + Math.cos(this.vine.angle) * this.vine.length;
    }

    // Update Expanding Quicksand / Tar Pit
    if (this.pit.type === 'quicksand') {
      this.pit.expandPhase += dt * 1.4;
      this.pit.halfW = this.pit.baseHalfW * (0.65 + 0.35 * Math.sin(this.pit.expandPhase));
    } else if (this.pit.type === 'tarPit') {
      this.pit.expandPhase += dt * 0.9;
      this.pit.halfW = this.pit.baseHalfW * (0.85 + 0.15 * Math.sin(this.pit.expandPhase));
    }

    // Update Snapping Crocodile Jaws
    for (const croc of this.crocodiles) {
      croc.timer -= dt;
      if (croc.timer <= 0) {
        croc.mouthOpen = !croc.mouthOpen;
        croc.timer = croc.mouthOpen ? croc.cycleOpen : croc.cycleClosed;
      }
    }

    // Player Movement State Machine (Vine / Ladder / Ground & Air)
    if (p.onVine && this.vine) {
      p.x = this.vine.tipX;
      p.y = this.vine.tipY + 12;
      p.vx = Math.cos(this.vine.phase) * this.vine.maxAngle * 220;
      p.vy = 0;

      if (
        this.input.isJustPressed('actionB') ||
        this.input.isJustPressed('down') ||
        this.input.isJustPressed('actionA')
      ) {
        p.onVine = false;
        p.vineReleaseCooldown = 0.45;
        p.onGround = false;
        p.vy = -170;
        p.vx = Math.cos(this.vine.phase) * 210 + axis.x * 90;
        this.audio.playJump();
      }
    } else if (p.climbing && this.ladder) {
      p.x = this.ladder.x;
      p.vx = 0;
      p.vy = axis.y * 140;
      p.y += p.vy * dt;

      if (p.y <= this.upperGroundY) {
        p.y = this.upperGroundY;
        p.climbing = false;
        p.onGround = true;
        p.floor = 'upper';
      } else if (p.y >= this.lowerGroundY) {
        p.y = this.lowerGroundY;
        p.climbing = false;
        p.onGround = true;
        p.floor = 'lower';
      } else if (jumpPressed && Math.abs(axis.x) > 0.2) {
        p.climbing = false;
        p.onGround = false;
        p.vy = -210;
        p.vx = axis.x * 180;
      }
    } else {
      // Standard running / jumping
      const speed = 205;
      p.vx = axis.x * speed;
      if (axis.x > 0.1) p.dir = 1;
      else if (axis.x < -0.1) p.dir = -1;

      if (Math.abs(p.vx) > 5 && p.onGround) {
        p.animTime += dt * 10;
      }

      p.x += p.vx * dt;

      // Check Ladder Grab
      if (this.ladder && Math.abs(p.x - this.ladder.x) < 22) {
        if (
          (p.floor === 'upper' && axis.y > 0.4) ||
          (p.floor === 'lower' && axis.y < -0.4)
        ) {
          p.climbing = true;
          p.onGround = false;
          p.x = this.ladder.x;
        }
      }

      const targetGroundY = p.floor === 'upper' ? this.upperGroundY : this.lowerGroundY;

      if (p.onGround) {
        if (jumpPressed) {
          p.vy = -315;
          p.onGround = false;
          this.audio.playJump();
        }
      } else {
        p.vy += 760 * dt;
        p.y += p.vy * dt;

        // Check grabbing Swinging Vine in mid-air
        if (
          this.vine &&
          p.floor === 'upper' &&
          p.vineReleaseCooldown <= 0 &&
          Math.hypot(p.x - this.vine.tipX, p.y - 20 - this.vine.tipY) < 34
        ) {
          p.onVine = true;
          this._playTarzanYodel();
          this.score += 100;
        }

        if (p.y >= targetGroundY) {
          p.y = targetGroundY;
          p.vy = 0;
          p.onGround = true;
        }
      }

      // Check Pit / Crocodile / Ladder Shaft Hazards when on Upper Ground
      if (p.floor === 'upper' && p.onGround && !p.onVine) {
        const inPitRange = Math.abs(p.x - this.pit.cx) < this.pit.halfW - 8;
        if (inPitRange) {
          if (this.pit.type === 'crocPond') {
            // Check if standing on a closed-mouth crocodile
            let safeOnCroc = false;
            let bittenByCroc = false;
            for (const croc of this.crocodiles) {
              if (Math.abs(p.x - croc.x) < croc.width * 0.55) {
                if (croc.mouthOpen) {
                  bittenByCroc = true;
                } else {
                  safeOnCroc = true;
                }
                break;
              }
            }
            if (bittenByCroc) {
              this._loseLife('CHOMPED BY CROCODILE!');
            } else if (!safeOnCroc) {
              this._loseLife('FELL IN SWAMP!');
            }
          } else {
            this._loseLife(
              this.pit.type === 'quicksand' ? 'SUNK IN QUICKSAND!' : 'SUNK IN TAR PIT!'
            );
          }
        }
      }
    }

    // Screen Transitions (Left/Right edge scrolling)
    if (p.x > 948) {
      p.x = 20;
      const step = p.floor === 'lower' ? 3 : 1; // Underground passage moves 3x screens!
      this.screenIndex += step;
      if (this.screenIndex > 0 && this.screenIndex % 4 === 0) {
        this.level++;
      }
      this._loadScreen(this.screenIndex);
    } else if (p.x < 12) {
      p.x = 940;
      const step = p.floor === 'lower' ? 3 : 1;
      this.screenIndex -= step;
      this._loadScreen(this.screenIndex);
    }

    // Update Rolling Logs
    for (const log of this.logs) {
      log.x += log.vx * dt;
      log.rot -= 8 * dt;
      if (log.x < -20) {
        log.x = 980;
        log.jumped = false;
      }

      // Check player jumping over or tripping on rolling log
      if (p.floor === 'upper' && !p.onVine) {
        const dx = Math.abs(p.x - log.x);
        if (dx < 20) {
          if (p.y > this.upperGroundY - 18) {
            // Tripped on rolling log: deduct points & knock back
            if (p.invulnTimer <= 0) {
              this.score = Math.max(0, this.score - 100);
              this.audio.playHit();
              this.renderer.shake(4, 0.12);
              p.invulnTimer = 0.6;
              p.vy = -160;
              p.onGround = false;
              this.floatingTexts.push({
                text: '-100 LOG TRIP!',
                x: p.x,
                y: p.y - 36,
                vy: -35,
                life: 0.7,
                maxLife: 0.7,
                color: PALETTE.ORANGE
              });
            }
          } else if (!log.jumped && p.vy < 0) {
            log.jumped = true;
            this.score += 100;
            this.audio.playHop();
            this.floatingTexts.push({
              text: '+100 HURDLE!',
              x: log.x,
              y: log.y - 24,
              vy: -35,
              life: 0.7,
              maxLife: 0.7,
              color: PALETTE.CYAN
            });
          }
        }
      }
    }

    // Update Underground Scorpion
    if (this.scorpion) {
      const s = this.scorpion;
      s.anim += dt * 10;
      if (p.floor === 'lower') {
        s.dir = p.x > s.x ? 1 : -1;
      }
      s.x += s.dir * s.vx * dt;
      if (s.x > 890) {
        s.x = 890;
        s.dir = -1;
      } else if (s.x < 70) {
        s.x = 70;
        s.dir = 1;
      }

      if (
        p.floor === 'lower' &&
        Math.abs(p.x - s.x) < 22 &&
        Math.abs(p.y - s.y) < 20
      ) {
        this._loseLife('STUNG BY SCORPION!');
      }
    }

    // Update Cobra / Campfire Hazard on right bank
    if (this.cobra) {
      this.cobra.phase += dt * 9;
      if (
        p.floor === 'upper' &&
        !p.onVine &&
        Math.abs(p.x - this.cobra.x) < 18 &&
        p.y > this.upperGroundY - 18
      ) {
        this._loseLife('BITTEN BY COBRA!');
      }
    }

    // Check Treasure Pickup
    if (this.treasure && p.floor === 'upper') {
      this.treasure.bob += dt * 5;
      if (Math.hypot(p.x - this.treasure.x, p.y - 16 - this.treasure.y) < 30) {
        this.collectedTreasures.add(this.screenIndex);
        this.treasuresFound++;
        this.score += this.treasure.pts;
        if (this.score > this.highScore) {
          this.highScore = this.score;
          HighScoreStore.submit(this.id, this.score);
        }
        this.audio.playStageClear();
        this._spawnParticles(this.treasure.x, this.treasure.y, 24, this.treasure.color);
        this.floatingTexts.push({
          text: `${this.treasure.name} +${this.treasure.pts}!`,
          x: this.treasure.x,
          y: this.treasure.y - 20,
          vy: -40,
          life: 1.2,
          maxLife: 1.2,
          color: this.treasure.color
        });
        this.treasure = null;
      }
    }

    // Update Particles & Floating Texts
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 200 * dt;
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
    // Iconic Activision 1982 Jungle Canopy Background
    ctx.fillStyle = '#0B3824';
    ctx.fillRect(0, 38, this.renderer.width, this.upperGroundY - 38);

    // 4 Tall Brown Tree Trunks rising from the ground to the top foliage canopy
    const trunkPositions = [95, 290, 670, 865];
    for (const tx of trunkPositions) {
      // Main trunk column
      ctx.fillStyle = '#4A2506';
      ctx.fillRect(tx - 20, 74, 40, this.upperGroundY - 74);
      // Flared root base on jungle floor
      ctx.fillRect(tx - 28, this.upperGroundY - 12, 56, 12);
      ctx.fillRect(tx - 24, this.upperGroundY - 22, 48, 10);
      // Spreading upper branches into the canopy
      ctx.fillRect(tx - 34, 74, 68, 14);
      ctx.fillRect(tx - 26, 88, 52, 10);
      // Vertical bark shadow grooves
      ctx.fillStyle = '#2E1502';
      ctx.fillRect(tx - 8, 84, 6, this.upperGroundY - 84);
      ctx.fillRect(tx + 4, 84, 5, this.upperGroundY - 84);
    }

    // Lush Pixelated Green Foliage Canopy across the top of the screen
    ctx.fillStyle = '#15803D';
    ctx.fillRect(0, 38, this.renderer.width, 46);
    ctx.fillStyle = '#166534';
    ctx.fillRect(0, 38, this.renderer.width, 18);

    // Stepped pixelated leaf arches hanging between the tree trunks
    for (let x = 0; x < 960; x += 64) {
      ctx.fillStyle = '#15803D';
      ctx.fillRect(x + 4, 84, 56, 10);
      ctx.fillRect(x + 12, 94, 40, 8);
      ctx.fillRect(x + 22, 102, 20, 6);
      // Bright pixel leaf highlights
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(x + 10, 56, 18, 6);
      ctx.fillRect(x + 34, 66, 16, 6);
      ctx.fillRect(x + 18, 80, 24, 6);
    }

    // Upper Jungle Floor (Atari Gold/Tan Dirt Path + Green Grass Rim)
    ctx.fillStyle = '#CA8A04';
    ctx.fillRect(0, this.upperGroundY, this.renderer.width, 28);
    ctx.fillStyle = '#A16207';
    ctx.fillRect(0, this.upperGroundY + 20, this.renderer.width, 8);
    ctx.fillStyle = '#15803D';
    ctx.fillRect(0, this.upperGroundY, this.renderer.width, 6);

    // Underground Passage Background & Iconic Red Brick Wall with Mortar Lines
    const tunnelTop = this.upperGroundY + 28;
    const tunnelH = this.lowerGroundY - tunnelTop;
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, tunnelTop, this.renderer.width, tunnelH);

    // Classic Activision Red Brick Wall panels & background brickwork in the underground tunnel
    const drawBrickPanel = (bx, bw, alpha = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#991B1B';
      ctx.fillRect(bx, tunnelTop, bw, tunnelH);
      ctx.fillStyle = '#CBD5E1';
      const brickH = 12;
      const brickW = 24;
      for (let by = tunnelTop; by < this.lowerGroundY; by += brickH) {
        ctx.fillRect(bx, by, bw, 2);
        const rowIdx = Math.floor((by - tunnelTop) / brickH);
        const offset = (rowIdx % 2) * (brickW / 2);
        for (let mx = bx + offset; mx < bx + bw; mx += brickW) {
          ctx.fillRect(mx, by, 2, brickH);
        }
      }
      ctx.restore();
    };
    // Subtle full-tunnel brick backdrop + solid iconic red brick wall columns on left/right
    drawBrickPanel(0, this.renderer.width, 0.22);
    drawBrickPanel(18, 48, 0.92);
    drawBrickPanel(894, 48, 0.92);

    // Underground Tunnel Floor
    ctx.fillStyle = '#7F1D1D';
    ctx.fillRect(0, this.lowerGroundY, this.renderer.width, 540 - this.lowerGroundY);
    ctx.fillStyle = '#B91C1C';
    ctx.fillRect(0, this.lowerGroundY, this.renderer.width, 5);

    // Draw Pit (Tar Pit / Quicksand / Crocodile Pond)
    if (this.pit.halfW > 4) {
      const pitColor =
        this.pit.type === 'crocPond'
          ? '#0284C7'
          : this.pit.type === 'quicksand'
          ? '#38BDF8'
          : '#0B0F19';
      ctx.fillStyle = pitColor;
      ctx.fillRect(
        this.pit.cx - this.pit.halfW,
        this.upperGroundY - 2,
        this.pit.halfW * 2,
        18
      );
      ctx.strokeStyle = this.pit.type === 'tarPit' ? PALETTE.PURPLE : PALETTE.CYAN;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        this.pit.cx - this.pit.halfW,
        this.upperGroundY - 2,
        this.pit.halfW * 2,
        18
      );
    }

    // Draw Pixel-Art Crocodile Heads in Pond
    for (const croc of this.crocodiles) {
      ctx.save();
      ctx.translate(croc.x, croc.y);
      // Lower pixel jaw & throat submerged at water line
      ctx.fillStyle = '#15803D';
      ctx.fillRect(-22, -5, 44, 7);
      ctx.fillStyle = PALETTE.GREEN;
      ctx.fillRect(-20, -6, 40, 4);

      if (croc.mouthOpen) {
        // Hinged upper pixel-art jaw raised wide open with white interlocking teeth!
        ctx.save();
        ctx.translate(10, -6);
        ctx.rotate(-0.46);
        ctx.fillStyle = PALETTE.GREEN;
        ctx.fillRect(-32, -8, 40, 7);
        ctx.fillStyle = '#166534';
        ctx.fillRect(-30, -11, 10, 4); // Nostrils & brow bump
        ctx.fillRect(-10, -12, 12, 5);
        // Upper white pixel teeth
        ctx.fillStyle = PALETTE.WHITE;
        for (let t = -28; t <= 2; t += 7) {
          ctx.fillRect(t, -1, 3, 4);
        }
        ctx.restore();
        // Lower white pixel teeth
        ctx.fillStyle = PALETTE.WHITE;
        for (let t = -18; t <= 6; t += 7) {
          ctx.fillRect(t, -9, 3, 3);
        }
        // Glowing red eye
        this.renderer.drawGlowCircle(6, -12, 3, PALETTE.RED, 6);
      } else {
        // Closed flat pixel-art crocodile head (safe to step on!)
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(-22, -11, 44, 6);
        // Nostrils & ridged brow
        ctx.fillStyle = '#15803D';
        ctx.fillRect(-20, -14, 6, 3);
        ctx.fillRect(4, -15, 12, 4);
        // Eye
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(8, -14, 5, 3);
        // Closed tooth seam
        ctx.fillStyle = PALETTE.WHITE;
        for (let t = -16; t <= 8; t += 8) {
          ctx.fillRect(t, -6, 3, 2);
        }
      }
      ctx.restore();
    }

    // Draw Ladder Shaft
    if (this.ladder) {
      ctx.fillStyle = '#090D16';
      ctx.fillRect(this.ladder.x - 18, this.upperGroundY, 36, 28);
      ctx.strokeStyle = PALETTE.GOLD;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(this.ladder.x - 10, this.ladder.topY);
      ctx.lineTo(this.ladder.x - 10, this.ladder.bottomY);
      ctx.moveTo(this.ladder.x + 10, this.ladder.topY);
      ctx.lineTo(this.ladder.x + 10, this.ladder.bottomY);
      for (let y = this.ladder.topY + 12; y < this.ladder.bottomY; y += 16) {
        ctx.moveTo(this.ladder.x - 10, y);
        ctx.lineTo(this.ladder.x + 10, y);
      }
      ctx.stroke();
    }

    // Draw Swinging Jungle Vine
    if (this.vine) {
      ctx.save();
      ctx.strokeStyle = PALETTE.GREEN;
      ctx.shadowColor = PALETTE.GREEN;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(this.vine.anchorX, this.vine.anchorY);
      ctx.lineTo(this.vine.tipX, this.vine.tipY);
      ctx.stroke();
      this.renderer.drawGlowCircle(this.vine.tipX, this.vine.tipY, 5, PALETTE.GOLD, 8);
      ctx.restore();
    }

    // Draw Rolling Logs
    for (const log of this.logs) {
      ctx.save();
      ctx.translate(log.x, log.y);
      ctx.rotate(log.rot);
      this.renderer.drawGlowCircle(0, 0, log.radius, '#92400E', 6);
      ctx.strokeStyle = PALETTE.GOLD;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-log.radius + 2, 0);
      ctx.lineTo(log.radius - 2, 0);
      ctx.moveTo(0, -log.radius + 2);
      ctx.lineTo(0, log.radius - 2);
      ctx.stroke();
      ctx.restore();
    }

    // Draw Underground Scorpion (Detailed Pixel-Art Sprite)
    if (this.scorpion) {
      const s = this.scorpion;
      const sprite = Math.floor(s.anim) % 2 === 0 ? PITFALL_SCORPION_1 : PITFALL_SCORPION_2;
      const palette = {
        W: PALETTE.WHITE,
        R: PALETTE.RED
      };
      const scale = 2.6;
      this.renderer.drawPixelSprite(
        sprite,
        s.x - (12 * scale) / 2,
        s.y - 7 * scale,
        scale,
        palette,
        s.dir < 0,
        false
      );
    }

    // Draw Cobra & Campfire Hazard if present on screen
    if (this.cobra) {
      const cx = this.cobra.x;
      const cy = this.cobra.y;
      const flicker = Math.floor(this.cobra.phase * 2) % 2 === 0;

      // Pixel-Art Cobra Sprite
      const cobraPalette = {
        K: '#E2E8F0',
        Y: PALETTE.GOLD,
        R: PALETTE.RED
      };
      this.renderer.drawPixelSprite(
        PITFALL_COBRA_SPRITE,
        cx - 14,
        cy - 21,
        3,
        cobraPalette,
        flicker,
        false
      );

      // Flickering Pixel-Art Campfire beside the Cobra
      const fx = cx + 22;
      ctx.save();
      // Crossed firewood logs
      ctx.fillStyle = '#78350F';
      ctx.fillRect(fx - 10, cy - 5, 20, 5);
      ctx.fillStyle = '#92400E';
      ctx.fillRect(fx - 7, cy - 8, 14, 4);
      // Multi-layered flickering pixel flames
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(fx - 8, cy - 16, 16, 8);
      ctx.fillStyle = PALETTE.ORANGE;
      ctx.fillRect(fx - 6, cy - (flicker ? 22 : 19), 12, 10);
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(fx - 3, cy - (flicker ? 25 : 21), 6, 9);
      ctx.restore();
    }

    if (this.screenName) {
      this.renderer.drawText(this.screenName, 480, 62, {
        font: FONTS.HEADER,
        size: 11,
        color: PALETTE.GOLD,
        align: 'center',
        glow: 6
      });
    }

    // Draw Treasure
    if (this.treasure) {
      const ty = this.treasure.y + Math.sin(this.treasure.bob) * 4;
      this.renderer.drawGlowRect(
        this.treasure.x - 12,
        ty - 8,
        24,
        16,
        this.treasure.color,
        14
      );
      this.renderer.drawText(this.treasure.name, this.treasure.x, ty - 14, {
        size: 10,
        color: this.treasure.color,
        align: 'center'
      });
    }

    // Draw Pitfall Harry
    const p = this.player;
    if (p.invulnTimer <= 0 || Math.floor(p.invulnTimer * 16) % 2 === 0) {
      const sprite =
        !p.onGround || Math.floor(p.animTime) % 2 === 1 ? HARRY_RUN_2 : HARRY_RUN_1;
      const palette = {
        Y: '#CA8A04',
        F: '#FDBA74',
        G: PALETTE.GREEN,
        B: '#166534',
        K: PALETTE.WHITE
      };
      const scale = 3.6;
      const drawX = p.x - (sprite[0].length * scale) / 2;
      const drawY = p.y - sprite.length * scale;
      this.renderer.drawPixelSprite(sprite, drawX, drawY, scale, palette, p.dir < 0, false);
    }

    // Draw Particles & Floating Texts
    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

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

    // Screen & Timer status
    const mins = Math.floor(this.timeLeft / 60);
    const secs = Math.floor(this.timeLeft % 60);
    const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;

    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `TIME ${timeStr}`,
      accent: PALETTE.GOLD
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'JUNGLE VINE & CROCODILE ADVENTURE',
      controls: 'ARROWS: RUN/CLIMB  |  Z/SPACE/UP: JUMP & GRAB VINE',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GOLD
    });
  }
}

export default Pitfall;
