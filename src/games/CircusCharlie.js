/**
 * CircusCharlie.js
 * Classic 1984 Konami Multi-Event Circus Stunt Arcade Game ("Big Top Stunt").
 * Cycles across 3 iconic Big Top stunt events:
 * - Stage 1: Ride a Lion leaping through flaming rings & blazing fire pots!
 * - Stage 2: Walk the High Tightrope leaping over cartwheeling & purple turbo monkeys!
 * - Stage 3: Bounce across rolling circus star-balls & springboards to the Victory Podium!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const EVENT_NAMES = [
  'STAGE 1: FLAMING LION RINGS',
  'STAGE 2: HIGH WIRE MONKEYS',
  'STAGE 3: ROLLING BALL ACROBAT',
  'STAGE 4: GALLOPING HORSE HURDLES',
  'STAGE 5: SWINGING TRAPEZE ACROBAT'
];

const CHARLIE_SPRITE = [
  '..RRRR..',
  '.RYYYYR.',
  '.WWKKWW.',
  '..WWWW..',
  '.BBBBBB.',
  'BYBBBBYB',
  '..RRRR..',
  '.RR..RR.',
  '.WW..WW.'
];

const LION_SPRITE = [
  '....OOOO....',
  '..OOOOOOOO..',
  '.OOWWOOOWWO.',
  '.OOOOOOOOOO.',
  '..OYYYYYYYYO',
  '.OYYYYYYYYYO',
  'O.YYYYYYYYY.',
  '..YY.YY.YY..',
  '..WW.WW.WW..'
];

const HORSE_SPRITE = [
  '........WWWW',
  '.......WWKWW',
  '......WWWWWW',
  '.YYYYWWWWWWW',
  'WWWWWRRRRWWW',
  'WWWWWWWWWWWW',
  '.WWWWWWWWWW.',
  '..WW..WW.WW.',
  '..YY..YY.YY.'
];

const MONKEY_SPRITE = [
  '..BBBBBB..',
  '.BFFFFFFB.',
  'BFKFFFFKFB',
  '.BFFFFFFB.',
  '..BBBBBB..',
  '.BBBBBBBB.',
  'BB.BBBB.BB',
  '...B..B...',
  '..BB..BB..'
];

export class CircusCharlie {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'circuscharlie';
    this.title = 'Circus Charlie';

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.eventIndex = 0; // 0 = Lion Rings, 1 = Tightrope Monkeys, 2 = Rolling Balls
    this.trackLength = 2600; // 100m to 0m
    this.cameraX = 0;
    this.groundY = 446;
    this.wireY = 330;

    this.player = null;
    this.obstacles = [];
    this.particles = [];
    this.popups = [];
    this.bonusTimer = 5000;
    this.stageClearTimer = 0;
    this.deathTimer = 0;
    this.animTime = 0;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.highScore = HighScoreStore.get(this.id);
    this.state = 'PLAYING';
    this.initStage(this.level);
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    if (this.audio && typeof this.audio.stopSequence === 'function') {
      this.audio.stopSequence();
    }
  }

  addScore(pts, x = null, y = null, color = PALETTE.GOLD, label = null) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    if (x !== null && y !== null) {
      this.popups.push({
        text: label ? `${label} +${pts}` : `+${pts}`,
        x,
        y,
        vy: -40,
        life: 1.0,
        maxLife: 1.0,
        color
      });
    }
  }

  initStage(level) {
    this.eventIndex = (level - 1) % 5;
    this.trackLength = 2500 + Math.floor((level - 1) / 5) * 350;
    this.cameraX = 0;
    this.bonusTimer = 5000;
    this.stageClearTimer = 0;
    this.deathTimer = 0;
    this.particles = [];
    this.popups = [];
    this.obstacles = [];

    const baseY = this.eventIndex === 1 ? this.wireY : this.groundY;
    this.player = {
      x: 140,
      y: baseY,
      vx: 0,
      vy: 0,
      grounded: true,
      onBall: null,
      onTrapeze: null,
      horseX: 140,
      facing: 1,
      animFrame: 0
    };

    const speedMult = 1 + Math.floor((level - 1) / 5) * 0.16;

    if (this.eventIndex === 0) {
      // EVENT 1: LION & FLAMING RINGS + FIRE POTS
      for (let x = 440; x < this.trackLength - 220; x += 260) {
        // Ground Fire Pot
        this.obstacles.push({
          type: 'firepot',
          x,
          y: this.groundY,
          hasCoin: x % 520 === 0,
          coinTaken: false,
          passed: false
        });
      }
      for (let x = 560; x < this.trackLength - 180; x += 290) {
        const isBonusRing = x % 580 === 0;
        this.obstacles.push({
          type: 'firering',
          x,
          y: 332,
          rx: 20,
          ry: isBonusRing ? 50 : 62,
          vx: -68 * speedMult,
          isBonusRing,
          passed: false
        });
      }
    } else if (this.eventIndex === 1) {
      // EVENT 2: HIGH TIGHTROPE & CARTWHEELING MONKEYS
      for (let x = 460; x < this.trackLength - 180; x += 240) {
        const isPurple = x % 480 === 0;
        this.obstacles.push({
          type: 'monkey',
          x,
          y: this.wireY,
          vx: (isPurple ? -155 : -92) * speedMult,
          vy: 0,
          isPurple,
          grounded: true,
          passed: false
        });
      }
    } else if (this.eventIndex === 2) {
      // EVENT 3: ROLLING CIRCUS BALLS & SPRINGBOARDS
      let curX = 140;
      let idx = 0;
      while (curX < this.trackLength - 200) {
        const isSpring = idx > 0 && idx % 4 === 0;
        const ball = {
          type: isSpring ? 'springboard' : 'ball',
          x: curX,
          y: this.groundY - 24,
          radius: 24,
          vx: isSpring ? 0 : idx === 0 ? 0 : -52 * speedMult,
          angle: 0,
          passed: false
        };
        this.obstacles.push(ball);
        if (idx === 0) {
          this.player.onBall = ball;
          this.player.y = ball.y - ball.radius;
        }
        curX += 165 + (idx % 2) * 25;
        idx++;
      }
    } else if (this.eventIndex === 3) {
      // EVENT 4: GALLOPING HORSEBACK TRAMPOLINE HURDLES
      let idx = 0;
      for (let x = 420; x < this.trackLength - 220; x += 250) {
        const isHigh = idx % 2 === 1;
        this.obstacles.push({
          type: 'hurdle_trampoline',
          x,
          y: isHigh ? this.groundY - 58 : this.groundY - 36,
          w: 72,
          isHigh,
          deflect: 0,
          passed: false
        });
        idx++;
      }
    } else {
      // EVENT 5: TRAMPOLINE & SWINGING TRAPEZE ACROBATICS
      for (let x = 140; x < this.trackLength - 160; x += 270) {
        this.obstacles.push({
          type: 'floor_trampoline',
          x,
          y: this.groundY - 14,
          w: 96,
          deflect: 0
        });
      }
      let tIdx = 0;
      for (let x = 275; x < this.trackLength - 220; x += 270) {
        this.obstacles.push({
          type: 'trapeze',
          pivotX: x,
          pivotY: 96,
          length: 132,
          phase: tIdx * 1.3,
          swingSpeed: (2.2 + (tIdx % 2) * 0.35) * speedMult,
          x,
          y: 228,
          passed: false
        });
        tIdx++;
      }
    }
  }

  killPlayer(reason = 'OUCH!') {
    if (this.deathTimer > 0 || this.stageClearTimer > 0) return;
    this.lives--;
    this.audio.playHit();
    this.renderer.shake(9, 0.3);

    this.popups.push({
      text: reason,
      x: this.player.x - this.cameraX,
      y: this.player.y - 36,
      vy: -30,
      life: 1.1,
      maxLife: 1.1,
      color: PALETTE.RED
    });

    for (let i = 0; i < 24; i++) {
      const a = (Math.PI * 2 * i) / 24;
      const spd = 60 + Math.random() * 140;
      this.particles.push({
        x: this.player.x - this.cameraX,
        y: this.player.y - 16,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        gravity: 240,
        size: 3.5,
        life: 0.55,
        color: i % 2 === 0 ? PALETTE.GOLD : PALETTE.ORANGE
      });
    }

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.audio.playGameOver();
      this.state = 'GAMEOVER';
    } else {
      this.deathTimer = 1.25;
    }
  }

  update(dt) {
    this.animTime += dt;

    if (this.input.isJustPressed('pause')) {
      this.state = this.state === 'PLAYING' ? 'PAUSED' : 'PLAYING';
      return;
    }

    if (this.state === 'MENU' || this.state === 'GAMEOVER') {
      if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
        this.audio.playMenuSelect();
        this.reset();
      }
      return;
    }

    if (this.state === 'PAUSED') {
      if (this.input.isJustPressed('actionA')) this.state = 'PLAYING';
      return;
    }

    this.updateEffects(dt);

    if (this.stageClearTimer > 0) {
      this.stageClearTimer -= dt;
      if (this.stageClearTimer <= 0) {
        this.level++;
        this.initStage(this.level);
      }
      return;
    }

    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        // Respawn at last 10m checkpoint
        const checkpointX = Math.max(140, Math.floor((this.player.x - 100) / 250) * 250);
        this.initStage(this.level);
        if (this.eventIndex !== 2) {
          this.player.x = checkpointX;
          this.cameraX = Math.max(0, checkpointX - 180);
        }
      }
      return;
    }

    this.bonusTimer = Math.max(0, this.bonusTimer - dt * 110);

    const p = this.player;
    const baseY = this.eventIndex === 1 ? this.wireY : this.groundY;
    const forwardSpeed =
      this.eventIndex === 0 ? 195 : this.eventIndex === 3 ? 210 : this.eventIndex === 1 ? 160 : 155;
    const backSpeed = 95;

    // Movement input (locked horizontal velocity while mid-air, classic Circus Charlie feel!)
    if (p.onTrapeze) {
      // Swinging on Trapeze Bar in Stage 5!
      p.vx = 0;
      p.vy = 0;
      p.x = p.onTrapeze.x;
      p.y = p.onTrapeze.y + 18;
      if (
        this.input.isJustPressed('up') ||
        this.input.isJustPressed('actionA') ||
        this.input.isJustPressed('actionB') ||
        this.input.pointer.justPressed
      ) {
        p.onTrapeze = null;
        p.grounded = false;
        p.vx = 215;
        p.vy = -410;
        p.facing = 1;
        this.audio.playJump();
      }
    } else if (p.grounded) {
      if (this.eventIndex === 3) {
        // Stage 4: White circus horse always gallops forward (can spur faster or rein slower)
        if (this.input.isDown('right')) p.vx = 235;
        else if (this.input.isDown('left')) p.vx = 135;
        else p.vx = 185;
        p.facing = 1;
        p.animFrame += dt * 16;
      } else if (this.input.isDown('right')) {
        p.vx = forwardSpeed;
        p.facing = 1;
        p.animFrame += dt * 14;
      } else if (this.input.isDown('left')) {
        p.vx = -backSpeed;
        p.facing = -1;
        p.animFrame += dt * 10;
      } else {
        p.vx = 0;
      }

      // Jump trigger
      if (
        this.input.isJustPressed('up') ||
        this.input.isJustPressed('actionA') ||
        this.input.isJustPressed('actionB') ||
        this.input.pointer.justPressed
      ) {
        p.grounded = false;
        p.onBall = null;
        p.vy =
          this.eventIndex === 0
            ? -430
            : this.eventIndex === 1
            ? -380
            : this.eventIndex === 3
            ? -445
            : -415;
        if (p.vx === 0) p.vx = forwardSpeed * 0.85;
        this.audio.playHop();
      }
    }

    if (!p.onTrapeze) {
      p.x = Math.max(80, p.x + p.vx * dt);
      if (!p.grounded) {
        p.vy += 860 * dt;
        p.y += p.vy * dt;
      }
    }
    p.horseX = p.x;

    // Event-specific landing & obstacle logic
    if (this.eventIndex === 0) {
      this.updateLionStage(dt, baseY);
    } else if (this.eventIndex === 1) {
      this.updateTightropeStage(dt, baseY);
    } else if (this.eventIndex === 2) {
      this.updateRollingBallStage(dt, baseY);
    } else if (this.eventIndex === 3) {
      this.updateHorseHurdlesStage(dt, baseY);
    } else {
      this.updateTrapezeStage(dt, baseY);
    }

    // Smooth camera follow
    this.cameraX = Math.max(0, Math.min(this.trackLength - 960, p.x - 190));

    // Check Victory Podium arrival at end of track
    const podiumX = this.trackLength - 130;
    if (p.x >= podiumX && p.y <= baseY + 6) {
      p.x = podiumX;
      p.y = baseY - 28;
      p.vx = 0;
      p.vy = 0;
      const bonus = Math.floor(this.bonusTimer / 10) * 10;
      this.addScore(1000 + bonus, p.x - this.cameraX, p.y - 30, PALETTE.GREEN, 'STAGE CLEAR');
      this.audio.playStageClear();
      this.stageClearTimer = 1.65;
    }
  }

  updateLionStage(dt, baseY) {
    const p = this.player;
    if (p.y >= baseY) {
      p.y = baseY;
      p.vy = 0;
      p.grounded = true;
    }

    for (const ob of this.obstacles) {
      if (ob.type === 'firering') {
        ob.x += ob.vx * dt;
        const dx = Math.abs(p.x - ob.x);
        if (dx < 16) {
          const lionCenterY = p.y - 24;
          const topRimY = ob.y - ob.ry;
          const botRimY = ob.y + ob.ry;
          // Hit bottom or top flame rim of ring
          if (Math.abs(lionCenterY - botRimY) < 20 || Math.abs(lionCenterY - topRimY) < 18 || p.grounded) {
            this.killPlayer('BURNED BY RING!');
            return;
          } else if (!ob.passed && lionCenterY > topRimY + 14 && lionCenterY < botRimY - 14) {
            ob.passed = true;
            const pts = ob.isBonusRing ? 500 : 200;
            this.addScore(pts, p.x - this.cameraX, p.y - 50, PALETTE.GOLD, 'RING JUMP');
            this.audio.playCoin();
          }
        }
      } else if (ob.type === 'firepot') {
        if (Math.abs(p.x - ob.x) < 22 && p.y > baseY - 26) {
          this.killPlayer('HOT FIRE POT!');
          return;
        }
        if (!ob.passed && p.x > ob.x + 22) {
          ob.passed = true;
          this.addScore(100, p.x - this.cameraX, p.y - 40, PALETTE.CYAN);
          this.audio.playCoin();
        }
      }
    }
  }

  updateTightropeStage(dt, baseY) {
    const p = this.player;
    if (p.y >= baseY) {
      p.y = baseY;
      p.vy = 0;
      p.grounded = true;
    }

    for (const m of this.obstacles) {
      m.x += m.vx * dt;
      if (!m.grounded) {
        m.vy += 760 * dt;
        m.y += m.vy * dt;
        if (m.y >= baseY) {
          m.y = baseY;
          m.vy = 0;
          m.grounded = true;
        }
      } else if (m.isPurple) {
        // Purple turbo monkeys leap over brown monkeys
        for (const other of this.obstacles) {
          if (other !== m && Math.abs(m.x - other.x) < 42 && m.grounded) {
            m.grounded = false;
            m.vy = -290;
            break;
          }
        }
      }

      if (Math.abs(p.x - m.x) < 20 && Math.abs(p.y - m.y) < 22) {
        this.killPlayer('MONKEY TRIPPED YOU!');
        return;
      }

      if (!m.passed && p.x > m.x + 20) {
        m.passed = true;
        this.addScore(m.isPurple ? 500 : 200, p.x - this.cameraX, p.y - 36, PALETTE.GOLD);
        this.audio.playCoin();
      }
    }
  }

  updateRollingBallStage(dt, baseY) {
    const p = this.player;

    for (const b of this.obstacles) {
      if (b.type === 'ball') {
        if (p.onBall !== b) {
          b.x += b.vx * dt;
          b.angle -= b.vx * dt * 0.04;
        } else {
          // Player balances and rolls the ball forward!
          b.x = p.x;
          b.angle += p.vx * dt * 0.04;
        }
      }
    }

    if (!p.grounded) {
      // Check landing atop a ball or springboard
      if (p.vy > 0) {
        for (const b of this.obstacles) {
          const topY = b.type === 'springboard' ? this.groundY - 16 : b.y - b.radius;
          if (Math.abs(p.x - b.x) < 28 && Math.abs(p.y - topY) < 20) {
            if (b.type === 'springboard') {
              p.y = topY;
              p.vy = -510;
              this.audio.playPowerUp();
              this.addScore(300, p.x - this.cameraX, p.y - 30, PALETTE.CYAN, 'SPRING!');
              return;
            } else {
              p.grounded = true;
              p.onBall = b;
              p.y = topY;
              p.vy = 0;
              if (!b.passed) {
                b.passed = true;
                this.addScore(300, p.x - this.cameraX, p.y - 35, PALETTE.GOLD, 'BALL HOP');
                this.audio.playCoin();
              }
              return;
            }
          }
        }
      }

      // Missed the balls and hit the circus floor!
      if (p.y >= baseY && p.x < this.trackLength - 165) {
        this.killPlayer('FELL OFF THE BALL!');
      }
    }
  }

  updateHorseHurdlesStage(dt, baseY) {
    const p = this.player;

    for (const ob of this.obstacles) {
      if (ob.deflect > 0) ob.deflect = Math.max(0, ob.deflect - dt * 35);

      const halfW = ob.w * 0.5;
      if (Math.abs(p.x - ob.x) <= halfW + 8) {
        // Landing on top of the springboard hurdle platform
        if (!p.grounded && p.vy > 0 && p.y >= ob.y - 12 && p.y <= ob.y + 18) {
          p.y = ob.y;
          p.vy = ob.isHigh ? -470 : -415;
          ob.deflect = 10;
          this.audio.playPowerUp();
          const pts = ob.isHigh ? 500 : 300;
          this.addScore(pts, p.x - this.cameraX, p.y - 36, PALETTE.CYAN, 'HURDLE BOUNCE');
          ob.passed = true;
          return;
        }
        // Running into the hurdle platform from the side while too low
        if (p.y > ob.y + 14) {
          this.killPlayer('TRIPPED ON HURDLE!');
          return;
        }
      }
    }

    // Remount the galloping white circus horse on ground level
    if (p.y >= baseY) {
      p.y = baseY;
      p.vy = 0;
      p.grounded = true;
    }
  }

  updateTrapezeStage(dt, baseY) {
    const p = this.player;

    // Update swinging trapeze bars and floor trampolines
    for (const ob of this.obstacles) {
      if (ob.type === 'trapeze') {
        ob.phase += ob.swingSpeed * dt;
        const maxAngle = 0.62;
        const ang = Math.sin(ob.phase) * maxAngle;
        ob.x = ob.pivotX + Math.sin(ang) * ob.length;
        ob.y = ob.pivotY + Math.cos(ang) * ob.length;

        // Grab trapeze bar mid-air!
        if (!p.onTrapeze && !p.grounded && Math.hypot(p.x - ob.x, (p.y - 18) - ob.y) < 28) {
          p.onTrapeze = ob;
          p.vx = 0;
          p.vy = 0;
          this.audio.playCoin();
          if (!ob.passed) {
            ob.passed = true;
            this.addScore(500, ob.x - this.cameraX, ob.y - 24, PALETTE.GOLD, 'TRAPEZE CATCH');
          }
          return;
        }
      } else if (ob.type === 'floor_trampoline') {
        if (ob.deflect > 0) ob.deflect = Math.max(0, ob.deflect - dt * 35);
        if (!p.onTrapeze && p.vy >= 0 && Math.abs(p.x - ob.x) <= ob.w * 0.5 + 8 && p.y >= ob.y - 8) {
          p.y = ob.y;
          p.grounded = false;
          p.vy = -485;
          p.vx = this.input.isDown('right') ? 210 : this.input.isDown('left') ? -110 : 165;
          ob.deflect = 10;
          this.audio.playHop();
          return;
        }
      }
    }

    if (!p.onTrapeze && p.y >= baseY && p.x < this.trackLength - 165) {
      this.killPlayer('MISSED THE TRAMPOLINE!');
    }
  }

  updateEffects(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += (pt.gravity || 0) * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y += pop.vy * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear('#0B1021');

    this.drawBigTopArena(ctx);
    this.drawObstacles(ctx);
    this.drawPlayer(ctx);
    this.drawEffects(ctx);

    const metersLeft = Math.max(
      0,
      Math.ceil(((this.trackLength - 130 - this.player.x) / (this.trackLength - 270)) * 100)
    );

    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `${ metersLeft }M LEFT  BONUS:${Math.floor(this.bonusTimer)}`,
      accent: PALETTE.GOLD
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: EVENT_NAMES[this.eventIndex],
      controls: 'LEFT/RIGHT: RUN & BALANCE  |  UP/Z/SPACE: STUNT JUMP',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GOLD
    });
  }

  drawBigTopArena(ctx) {
    ctx.save();
    // Red & White striped Big Top Circus valence banner
    const stripeW = 48;
    const offset = -(this.cameraX * 0.35) % (stripeW * 2);
    for (let x = offset - stripeW * 2; x < 960 + stripeW; x += stripeW) {
      const isRed = Math.floor((x - offset) / stripeW) % 2 === 0;
      ctx.fillStyle = isRed ? '#DC2626' : '#F8FAFC';
      ctx.fillRect(x, 40, stripeW, 24);
    }

    // Event banner label
    this.renderer.drawText(EVENT_NAMES[this.eventIndex], 480, 84, {
      font: FONTS.HEADER,
      size: 11,
      color: PALETTE.GOLD,
      align: 'center',
      glow: 8
    });

    // Cheering Big Top Crowd rows
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 110, 960, 95);
    const cheerBob = Math.floor(this.animTime * 8) % 2 === 0 ? 0 : -2;
    for (let cx = 20; cx < 950; cx += 24) {
      ctx.fillStyle = cx % 48 === 0 ? '#F472B6' : '#38BDF8';
      ctx.fillRect(cx, 132 + cheerBob, 10, 10);
      ctx.fillStyle = cx % 72 === 0 ? '#FACC15' : '#4ADE80';
      ctx.fillRect(cx + 8, 162 - cheerBob, 10, 10);
    }

    if (this.eventIndex === 1) {
      // High Tightrope Cable
      ctx.strokeStyle = PALETTE.CYAN;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, this.wireY);
      ctx.lineTo(960, this.wireY);
      ctx.stroke();
    }

    // Circus Ring Floor
    ctx.fillStyle = '#15803D';
    ctx.fillRect(0, this.groundY, 960, 94);
    ctx.fillStyle = '#B91C1C';
    ctx.fillRect(0, this.groundY, 960, 8);

    // Distance meter signs (100m .. 0m)
    for (let m = 100; m >= 0; m -= 10) {
      const worldX = 140 + ((100 - m) / 100) * (this.trackLength - 270);
      const sx = worldX - this.cameraX;
      if (sx > -60 && sx < 1020) {
        ctx.fillStyle = '#0F172A';
        ctx.strokeStyle = PALETTE.GOLD;
        ctx.lineWidth = 2;
        ctx.fillRect(sx - 26, this.groundY + 22, 52, 24);
        ctx.strokeRect(sx - 26, this.groundY + 22, 52, 24);
        this.renderer.drawText(`${m}m`, sx, this.groundY + 39, {
          font: FONTS.HEADER,
          size: 9,
          color: PALETTE.WHITE,
          align: 'center'
        });
      }
    }

    // Victory Podium at 0m
    const podX = this.trackLength - 130 - this.cameraX;
    if (podX < 1020) {
      const podY = this.eventIndex === 1 ? this.wireY : this.groundY;
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(podX - 28, podY - 28, 56, 28);
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(podX - 22, podY - 22, 44, 16);
      this.renderer.drawText('GOAL', podX, podY - 10, {
        font: FONTS.HEADER,
        size: 8,
        color: PALETTE.WHITE,
        align: 'center'
      });
    }
    ctx.restore();
  }

  drawObstacles(ctx) {
    ctx.save();
    const flicker = Math.sin(this.animTime * 28) * 3;

    for (const ob of this.obstacles) {
      const sx = ob.x - this.cameraX;
      if (sx < -80 || sx > 1040) continue;

      if (ob.type === 'firepot') {
        // Brass Fire Pot
        ctx.fillStyle = '#D97706';
        ctx.fillRect(sx - 16, ob.y - 18, 32, 18);
        // Blazing Flames
        ctx.fillStyle = PALETTE.RED;
        ctx.beginPath();
        ctx.moveTo(sx - 14, ob.y - 18);
        ctx.lineTo(sx, ob.y - 44 + flicker);
        ctx.lineTo(sx + 14, ob.y - 18);
        ctx.fill();
        ctx.fillStyle = PALETTE.GOLD;
        ctx.beginPath();
        ctx.moveTo(sx - 8, ob.y - 18);
        ctx.lineTo(sx, ob.y - 34 - flicker);
        ctx.lineTo(sx + 8, ob.y - 18);
        ctx.fill();
      } else if (ob.type === 'firering') {
        // Overhead rope
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, 64);
        ctx.lineTo(sx, ob.y - ob.ry);
        ctx.stroke();

        // Flaming Oval Ring
        ctx.strokeStyle = ob.isBonusRing ? PALETTE.CYAN : PALETTE.ORANGE;
        ctx.shadowColor = ob.isBonusRing ? PALETTE.CYAN : PALETTE.RED;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.ellipse(sx, ob.y, ob.rx, ob.ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ob.type === 'monkey') {
        this.renderer.drawPixelSprite(
          MONKEY_SPRITE,
          sx - 11,
          ob.y - 22,
          2.2,
          {
            B: ob.isPurple ? PALETTE.PURPLE : '#B45309',
            F: '#FDE68A',
            K: '#0B0F19'
          },
          ob.vx < 0
        );
      } else if (ob.type === 'ball') {
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.arc(sx, ob.y, ob.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = PALETTE.RED;
        ctx.lineWidth = 4;
        ctx.stroke();
        // Rotating star stripe
        ctx.fillStyle = PALETTE.BLUE;
        const starX = sx + Math.cos(ob.angle) * 8;
        const starY = ob.y + Math.sin(ob.angle) * 8;
        ctx.fillRect(starX - 5, starY - 5, 10, 10);
      } else if (ob.type === 'springboard') {
        ctx.fillStyle = PALETTE.CYAN;
        ctx.fillRect(sx - 22, this.groundY - 16, 44, 6);
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(sx - 14, this.groundY - 10, 6, 10);
        ctx.fillRect(sx + 8, this.groundY - 10, 6, 10);
      } else if (ob.type === 'hurdle_trampoline') {
        // Elevated Horseback Hurdle Trampoline Platform
        const halfW = ob.w * 0.5;
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(sx - halfW + 4, ob.y, 6, this.groundY - ob.y);
        ctx.fillRect(sx + halfW - 10, ob.y, 6, this.groundY - ob.y);
        ctx.strokeStyle = ob.isHigh ? PALETTE.PINK : PALETTE.CYAN;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(sx - halfW, ob.y);
        ctx.quadraticCurveTo(sx, ob.y + (ob.deflect || 0), sx + halfW, ob.y);
        ctx.stroke();
      } else if (ob.type === 'floor_trampoline') {
        const halfW = ob.w * 0.5;
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(sx - halfW + 4, ob.y, 6, this.groundY - ob.y);
        ctx.fillRect(sx + halfW - 10, ob.y, 6, this.groundY - ob.y);
        ctx.strokeStyle = PALETTE.GREEN;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(sx - halfW, ob.y);
        ctx.quadraticCurveTo(sx, ob.y + (ob.deflect || 0), sx + halfW, ob.y);
        ctx.stroke();
      } else if (ob.type === 'trapeze') {
        const px = ob.pivotX - this.cameraX;
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(px, ob.pivotY);
        ctx.lineTo(sx, ob.y);
        ctx.stroke();
        this.renderer.drawGlowRect(sx - 16, ob.y - 3, 32, 6, PALETTE.GOLD, 8, true);
      }
    }
    ctx.restore();
  }

  drawPlayer(ctx) {
    if (this.deathTimer > 0) return;
    const p = this.player;
    const sx = p.x - this.cameraX;

    if (this.eventIndex === 0) {
      // Draw Lion mount + Charlie riding on top
      this.renderer.drawPixelSprite(
        LION_SPRITE,
        sx - 24,
        p.y - 26,
        3.0,
        {
          O: '#EA580C',
          Y: '#FACC15',
          W: '#F8FAFC'
        },
        p.facing < 0
      );
      this.renderer.drawPixelSprite(
        CHARLIE_SPRITE,
        sx - 10,
        p.y - 48,
        2.5,
        {
          R: '#EF4444',
          Y: '#FFD700',
          W: '#F8FAFC',
          B: '#38BDF8',
          K: '#0B0F19'
        },
        p.facing < 0
      );
    } else if (this.eventIndex === 3) {
      // Stage 4: Draw Galloping White Circus Horse along the ground + Charlie vaulting above!
      const horseSx = (p.horseX || p.x) - this.cameraX;
      this.renderer.drawPixelSprite(
        HORSE_SPRITE,
        horseSx - 24,
        this.groundY - 27,
        3.0,
        {
          W: '#F8FAFC',
          Y: '#FACC15',
          R: '#EF4444',
          K: '#0B0F19'
        },
        false
      );
      const charlieY = p.grounded ? this.groundY - 48 : p.y - 26;
      this.renderer.drawPixelSprite(
        CHARLIE_SPRITE,
        sx - 10,
        charlieY,
        2.5,
        {
          R: '#EF4444',
          Y: '#FFD700',
          W: '#F8FAFC',
          B: '#38BDF8',
          K: '#0B0F19'
        },
        p.facing < 0
      );
    } else {
      this.renderer.drawPixelSprite(
        CHARLIE_SPRITE,
        sx - 11,
        p.y - 26,
        2.8,
        {
          R: '#EF4444',
          Y: '#FFD700',
          W: '#F8FAFC',
          B: '#38BDF8',
          K: '#0B0F19'
        },
        p.facing < 0
      );
    }
  }

  drawEffects(ctx) {
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size * 0.5, pt.y - pt.size * 0.5, pt.size, pt.size);
    }
    for (const pop of this.popups) {
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HEADER,
        size: 10,
        color: pop.color,
        align: 'center',
        glow: 6
      });
    }
  }
}

export default CircusCharlie;
