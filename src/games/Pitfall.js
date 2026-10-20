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

export class Pitfall {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'pitfall';
    this.title = 'Jungle Strider';
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
    const mod = ((index % 5) + 5) % 5;

    // Determine screen hazard configuration
    // 0: Expanding Tar Pit + Swinging Vine + Ladder + Scorpion
    // 1: Crocodile Pond (3 Crocs opening/closing jaws) + Gold Bar
    // 2: Quicksand Pit + Swinging Vine + Rolling Logs + Diamond Ring
    // 3: Crocodile Pond + Rolling Log + Treasure
    // 4: Tar Pit + Double Rolling Logs + Underground Ladder + Treasure
    const hasCrocPond = mod === 1 || mod === 3;
    const hasQuicksand = mod === 2;
    const hasTarPit = mod === 0 || mod === 4;
    const hasVine = hasTarPit || hasQuicksand || mod === 3;
    const hasLadder = mod === 0 || mod === 2 || mod === 4;

    this.pit = {
      type: hasCrocPond ? 'crocPond' : hasQuicksand ? 'quicksand' : 'tarPit',
      cx: 480,
      baseHalfW: hasCrocPond ? 155 : 125,
      halfW: hasCrocPond ? 155 : 125,
      expandPhase: 0
    };

    this.vine = hasVine
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

    this.ladder = hasLadder
      ? {
          x: 740,
          topY: this.upperGroundY,
          bottomY: this.lowerGroundY
        }
      : null;

    this.logs = [];
    if (mod === 0 || mod === 2 || mod === 3 || mod === 4) {
      this.logs.push({
        x: 860,
        y: this.upperGroundY - 12,
        vx: -(150 + this.level * 18),
        radius: 12,
        rot: 0,
        jumped: false
      });
      if (mod === 4) {
        this.logs.push({
          x: 640,
          y: this.upperGroundY - 12,
          vx: -(150 + this.level * 18),
          radius: 12,
          rot: 0,
          jumped: false
        });
      }
    }

    this.scorpion = {
      x: 480,
      y: this.lowerGroundY,
      vx: 95 + this.level * 12,
      dir: 1,
      anim: 0
    };

    // Treasure on right bank if not already collected on this screen
    this.treasure = null;
    if (!this.collectedTreasures.has(index) && (mod === 1 || mod === 2 || mod === 3 || mod === 4)) {
      const types = [
        { name: 'GOLD BAR', pts: 2000, color: PALETTE.GOLD },
        { name: 'DIAMOND RING', pts: 3000, color: PALETTE.CYAN },
        { name: 'RUBY CHALICE', pts: 2500, color: PALETTE.PINK }
      ];
      const t = types[Math.abs(index) % types.length];
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
    // Jungle Canopy Background
    ctx.fillStyle = '#06281E';
    ctx.fillRect(0, 38, this.renderer.width, this.upperGroundY - 38);

    // Jungle Tree Trunks & Canopy Leaves
    const trunkPositions = [80, 270, 690, 880];
    ctx.fillStyle = '#3F2305';
    for (const tx of trunkPositions) {
      ctx.fillRect(tx - 18, 70, 36, this.upperGroundY - 70);
      ctx.fillStyle = '#2B1702';
      ctx.fillRect(tx - 6, 70, 12, this.upperGroundY - 70);
      ctx.fillStyle = '#3F2305';
    }

    // Upper Lush Leaf Canopy Archway
    ctx.fillStyle = '#047857';
    ctx.fillRect(0, 38, this.renderer.width, 46);
    for (let x = 0; x < 960; x += 60) {
      ctx.beginPath();
      ctx.arc(x + 30, 84, 34, 0, Math.PI);
      ctx.fill();
    }

    // Upper Jungle Floor
    ctx.fillStyle = '#CA8A04';
    ctx.fillRect(0, this.upperGroundY, this.renderer.width, 28);
    ctx.fillStyle = '#15803D';
    ctx.fillRect(0, this.upperGroundY, this.renderer.width, 6);

    // Underground Scorpion Tunnel Background
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, this.upperGroundY + 28, this.renderer.width, this.lowerGroundY - (this.upperGroundY + 28));
    ctx.fillStyle = '#7F1D1D';
    ctx.fillRect(0, this.lowerGroundY, this.renderer.width, 540 - this.lowerGroundY);

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

    // Draw Crocodiles in Pond
    for (const croc of this.crocodiles) {
      ctx.save();
      ctx.translate(croc.x, croc.y);
      ctx.fillStyle = PALETTE.GREEN;
      // Lower jaw / head base
      ctx.fillRect(-22, -6, 44, 8);
      if (croc.mouthOpen) {
        // Upper jaw raised at menacing angle with white teeth!
        ctx.save();
        ctx.rotate(-0.48);
        ctx.fillStyle = PALETTE.GREEN;
        ctx.fillRect(-20, -12, 40, 7);
        ctx.fillStyle = PALETTE.WHITE;
        for (let t = -14; t <= 14; t += 7) {
          ctx.fillRect(t, -5, 3, 4);
        }
        ctx.restore();
        // Red warning eye
        this.renderer.drawGlowCircle(-12, -10, 3, PALETTE.RED, 6);
      } else {
        // Closed flat head (safe to step on!)
        ctx.fillStyle = '#22C55E';
        ctx.fillRect(-22, -11, 44, 6);
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(-14, -14, 5, 4);
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

    // Draw Underground Scorpion
    if (this.scorpion) {
      const s = this.scorpion;
      ctx.save();
      ctx.translate(s.x, s.y - 10);
      ctx.scale(s.dir, 1);
      this.renderer.drawGlowRect(-12, -4, 22, 10, PALETTE.WHITE, 8);
      // Raised stinger tail
      ctx.strokeStyle = PALETTE.PINK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-10, -4);
      ctx.lineTo(-16, -14);
      ctx.lineTo(-8, -18);
      ctx.stroke();
      // Pincers
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(10, -6, 6, 5);
      ctx.restore();
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
