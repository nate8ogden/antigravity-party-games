/**
 * WildGunman.js
 * Classic 1984 Nintendo Light-Gun Western Showdown ("High Noon Draw").
 * Supports both Mouse/Touch Zapper clicks (input.pointer.justPressed) AND
 * Keyboard/Gamepad quick-draw (Action A / Action B / Arrows).
 * Features 1v1 Desert Duels, 2-Outlaw Double Draws, and Saloon Window Gang Shootouts
 * with "FIRE!!" speech bubbles, millisecond reaction timers, "FOUL!!" early-shot penalties,
 * and slapstick flying-hat & dropping-pants comedy animations!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const OUTLAW_ROSTER = [
  { name: 'SLACKER KID', coat: '#38BDF8', hat: '#FACC15', baseReaction: 0.95, reward: 500 },
  { name: 'EL SOMBRERO', coat: '#10B981', hat: '#F97316', baseReaction: 0.82, reward: 700 },
  { name: 'CHEYENNE', coat: '#A855F7', hat: '#E2E8F0', baseReaction: 0.72, reward: 900 },
  { name: 'TOMBSTONE', coat: '#475569', hat: '#EF4444', baseReaction: 0.62, reward: 1200 },
  { name: 'RED BANDITO', coat: '#EF4444', hat: '#FACC15', baseReaction: 0.52, reward: 1500 }
];

export class WildGunman {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'wildgunman';
    this.title = 'Wild Gunman';

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.mode = 'DUEL_1V1'; // 'DUEL_1V1' | 'DUEL_2V1' | 'SALOON_GANG'
    this.outlaws = [];
    this.saloonWindows = [
      { x: 220, y: 195, w: 96, h: 110, label: 'UPPER LEFT' },
      { x: 480, y: 195, w: 96, h: 110, label: 'UPPER CENTER' },
      { x: 740, y: 195, w: 96, h: 110, label: 'UPPER RIGHT' },
      { x: 240, y: 375, w: 105, h: 125, label: 'LEFT WINDOW' },
      { x: 480, y: 385, w: 125, h: 145, label: 'SALOON DOORS' },
      { x: 720, y: 375, w: 105, h: 125, label: 'RIGHT WINDOW' }
    ];

    this.crosshair = { x: 480, y: 310 };
    this.ammo = 6;
    this.gangRemaining = 0;
    this.gangSpawnTimer = 0;
    this.lastPlayerDrawTime = null;
    this.bannerText = '';
    this.bannerColor = PALETTE.GOLD;
    this.bannerTimer = 0;
    this.roundTransitionTimer = 0;
    this.bulletHoles = [];
    this.particles = [];
    this.popups = [];
    this.animTime = 0;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.highScore = HighScoreStore.get(this.id);
    this.state = 'PLAYING';
    this.initRound(this.level);
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
        vy: -38,
        life: 1.1,
        maxLife: 1.1,
        color
      });
    }
  }

  initRound(level) {
    this.bulletHoles = [];
    this.particles = [];
    this.popups = [];
    this.outlaws = [];
    this.lastPlayerDrawTime = null;
    this.roundTransitionTimer = 0;
    this.bannerText = '';
    this.bannerTimer = 0;

    const cycle = (level - 1) % 3;
    if (cycle === 0) {
      this.mode = 'DUEL_1V1';
      this.ammo = 2;
      this.spawnDuelOutlaw(480, 385, level, 0);
    } else if (cycle === 1) {
      this.mode = 'DUEL_2V1';
      this.ammo = 4;
      this.spawnDuelOutlaw(320, 385, level, 0);
      this.spawnDuelOutlaw(640, 385, level, 1);
    } else {
      this.mode = 'SALOON_GANG';
      this.ammo = 8;
      this.gangRemaining = 6 + Math.min(6, level);
      this.gangSpawnTimer = 0.7;
    }
  }

  spawnDuelOutlaw(targetX, targetY, level, slotIdx = 0) {
    const def = OUTLAW_ROSTER[(level - 1 + slotIdx) % OUTLAW_ROSTER.length];
    const speedScale = Math.max(0.38, def.baseReaction - Math.floor((level - 1) / 3) * 0.06);

    this.outlaws.push({
      slotIdx,
      name: def.name,
      coat: def.coat,
      hat: def.hat,
      reward: def.reward,
      x: slotIdx === 0 ? 110 : 850,
      targetX,
      y: targetY,
      phase: 'WALKING', // 'WALKING' | 'STANDOFF' | 'FIRE' | 'DEFEATED' | 'WON'
      standoffTimer: 1.2 + Math.random() * 1.3 + slotIdx * 0.35,
      reactionLimit: speedScale,
      drawTimer: 0,
      hatOffsetY: 0,
      hatVy: 0,
      pantsDropped: false,
      comedyTimer: 0
    });
  }

  spawnSaloonOutlaw() {
    if (this.gangRemaining <= 0 || this.outlaws.length >= 2) return;
    // Pick an unoccupied saloon window
    const freeWindows = this.saloonWindows.filter(
      (w) => !this.outlaws.some((o) => Math.abs(o.x - w.x) < 20 && Math.abs(o.y - w.y) < 20)
    );
    if (freeWindows.length === 0) return;

    const win = freeWindows[Math.floor(Math.random() * freeWindows.length)];
    const def = OUTLAW_ROSTER[Math.floor(Math.random() * OUTLAW_ROSTER.length)];
    this.gangRemaining--;

    this.outlaws.push({
      name: def.name,
      coat: def.coat,
      hat: def.hat,
      reward: 400,
      x: win.x,
      targetX: win.x,
      y: win.y + 35,
      windowRef: win,
      phase: 'STANDOFF',
      standoffTimer: 0.45 + Math.random() * 0.4,
      reactionLimit: Math.max(0.55, 0.95 - this.level * 0.04),
      drawTimer: 0,
      hatOffsetY: 0,
      hatVy: 0,
      pantsDropped: false,
      comedyTimer: 0
    });
  }

  playFireCue() {
    // Iconic 2-note high-noon "FIRE!!" audio sting
    this.audio.playNote(880, 0.08, 'square', 0.3, 0);
    this.audio.playNote(1318.5, 0.14, 'square', 0.3, 0.08);
  }

  penalizePlayer(reason) {
    this.lives--;
    this.bannerText = reason;
    this.bannerColor = PALETTE.RED;
    this.bannerTimer = 1.4;
    this.audio.playHit();
    this.renderer.shake(10, 0.32);

    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.audio.playGameOver();
      this.state = 'GAMEOVER';
    } else {
      this.roundTransitionTimer = 1.45;
    }
  }

  handlePlayerShot(shotX, shotY, isKeyboardQuickDraw = false) {
    if (this.roundTransitionTimer > 0) return;
    if (this.ammo <= 0) {
      this.audio.playDig();
      return;
    }

    this.ammo--;
    this.renderer.triggerFlash(0.55);
    this.renderer.shake(5, 0.12);
    this.audio.playExplosion(0.18, 1800);

    // If keyboard quick-draw, automatically snap aim to an outlaw in 'FIRE' phase (or closest active outlaw)
    let targetOutlaw = null;
    if (isKeyboardQuickDraw) {
      targetOutlaw =
        this.outlaws.find((o) => o.phase === 'FIRE') ||
        this.outlaws.find((o) => o.phase === 'STANDOFF' || o.phase === 'WALKING');
      if (targetOutlaw) {
        shotX = targetOutlaw.x;
        shotY = targetOutlaw.y - 48;
        this.crosshair.x = shotX;
        this.crosshair.y = shotY;
      }
    } else {
      // Find outlaw under pointer/crosshair
      for (const o of this.outlaws) {
        if (o.phase === 'DEFEATED') continue;
        if (Math.abs(shotX - o.x) <= 56 && shotY >= o.y - 115 && shotY <= o.y + 15) {
          targetOutlaw = o;
          break;
        }
      }
    }

    this.bulletHoles.push({ x: shotX, y: shotY, life: 2.5 });

    // Check if player fired BEFORE any outlaw shouted "FIRE!!" (FOUL!!)
    const anyReadyToFire = this.outlaws.some((o) => o.phase === 'FIRE');
    if (!anyReadyToFire && this.mode !== 'SALOON_GANG') {
      for (const o of this.outlaws) o.phase = 'WON';
      this.penalizePlayer('FOUL!! DREW TOO EARLY!');
      return;
    }

    if (targetOutlaw) {
      if (targetOutlaw.phase !== 'FIRE') {
        this.penalizePlayer('FOUL!! WAIT FOR "FIRE!!"');
        return;
      }

      // Clean Quick-Draw Hit!
      targetOutlaw.phase = 'DEFEATED';
      targetOutlaw.hatVy = -320;
      targetOutlaw.pantsDropped = true;
      targetOutlaw.comedyTimer = 1.25;
      this.lastPlayerDrawTime = targetOutlaw.drawTimer;

      const speedBonus = Math.max(0, Math.floor((targetOutlaw.reactionLimit - targetOutlaw.drawTimer) * 1000));
      const totalPts = targetOutlaw.reward + speedBonus;
      this.addScore(
        totalPts,
        targetOutlaw.x,
        targetOutlaw.y - 95,
        PALETTE.GOLD,
        `${targetOutlaw.drawTimer.toFixed(2)}S DRAW`
      );
      this.audio.playCoin();

      if (this.mode === 'SALOON_GANG') {
        this.ammo = Math.min(8, this.ammo + 1);
      }

      // Check if all outlaws in round are defeated
      const allDefeated =
        this.outlaws.every((o) => o.phase === 'DEFEATED') &&
        (this.mode !== 'SALOON_GANG' || this.gangRemaining <= 0);

      if (allDefeated) {
        this.bannerText = 'NICE SHOOTING, PARTNER!';
        this.bannerColor = PALETTE.GREEN;
        this.bannerTimer = 1.5;
        this.audio.playStageClear();
        this.roundTransitionTimer = 1.6;
      }
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

    // Crosshair tracking (Mouse/Touch + D-Pad steering)
    this.crosshair.x = this.input.pointer.x;
    this.crosshair.y = this.input.pointer.y;
    const axis = this.input.getAxis();
    if (Math.hypot(axis.x, axis.y) > 0.05) {
      this.input.pointer.x = Math.max(40, Math.min(920, this.input.pointer.x + axis.x * 380 * dt));
      this.input.pointer.y = Math.max(60, Math.min(510, this.input.pointer.y + axis.y * 380 * dt));
      this.crosshair.x = this.input.pointer.x;
      this.crosshair.y = this.input.pointer.y;
    }

    if (this.bannerTimer > 0) this.bannerTimer = Math.max(0, this.bannerTimer - dt);
    for (let i = this.popups.length - 1; i >= 0; i--) {
      this.popups[i].y += this.popups[i].vy * dt;
      this.popups[i].life -= dt;
      if (this.popups[i].life <= 0) this.popups.splice(i, 1);
    }
    for (let i = this.bulletHoles.length - 1; i >= 0; i--) {
      this.bulletHoles[i].life -= dt;
      if (this.bulletHoles[i].life <= 0) this.bulletHoles.splice(i, 1);
    }

    if (this.roundTransitionTimer > 0) {
      this.roundTransitionTimer -= dt;
      // Still animate flying hats while transitioning
      this.updateDefeatedOutlaws(dt);
      if (this.roundTransitionTimer <= 0) {
        if (this.bannerColor === PALETTE.GREEN) {
          this.level++;
        }
        this.initRound(this.level);
      }
      return;
    }

    // Handle Player Trigger Pull (Pointer Click OR Action A / B)
    if (this.input.pointer.justPressed) {
      this.handlePlayerShot(this.input.pointer.x, this.input.pointer.y, false);
    } else if (this.input.isJustPressed('actionA') || this.input.isJustPressed('actionB')) {
      this.handlePlayerShot(this.crosshair.x, this.crosshair.y, true);
    }

    // Saloon Gang mode wave spawning
    if (this.mode === 'SALOON_GANG') {
      this.gangSpawnTimer -= dt;
      if (this.gangSpawnTimer <= 0) {
        this.gangSpawnTimer = 1.05;
        this.spawnSaloonOutlaw();
      }
    }

    // Update Outlaw State Machines
    for (let i = this.outlaws.length - 1; i >= 0; i--) {
      const o = this.outlaws[i];
      if (o.phase === 'WALKING') {
        const dir = o.targetX > o.x ? 1 : -1;
        o.x += dir * 145 * dt;
        if (Math.abs(o.x - o.targetX) < 6) {
          o.x = o.targetX;
          o.phase = 'STANDOFF';
          this.audio.playNote(440, 0.12, 'triangle', 0.2, 0);
        }
      } else if (o.phase === 'STANDOFF') {
        o.standoffTimer -= dt;
        if (o.standoffTimer <= 0) {
          o.phase = 'FIRE';
          o.drawTimer = 0;
          this.playFireCue();
        }
      } else if (o.phase === 'FIRE') {
        o.drawTimer += dt;
        if (o.drawTimer >= o.reactionLimit) {
          // Outlaw outdrew the player!
          o.phase = 'WON';
          this.penalizePlayer(`OUTDRAWN BY ${o.name}!`);
          return;
        }
      } else if (o.phase === 'DEFEATED') {
        o.hatOffsetY += o.hatVy * dt;
        o.hatVy += 620 * dt;
        o.comedyTimer -= dt;
        if (this.mode === 'SALOON_GANG' && o.comedyTimer <= 0) {
          this.outlaws.splice(i, 1);
          if (this.gangRemaining <= 0 && this.outlaws.length === 0) {
            this.bannerText = 'SALOON CLEARED!';
            this.bannerColor = PALETTE.GREEN;
            this.bannerTimer = 1.4;
            this.audio.playStageClear();
            this.roundTransitionTimer = 1.5;
          }
        }
      }
    }
  }

  updateDefeatedOutlaws(dt) {
    for (const o of this.outlaws) {
      if (o.phase === 'DEFEATED') {
        o.hatOffsetY += o.hatVy * dt;
        o.hatVy += 620 * dt;
      }
    }
  }

  render(ctx = this.renderer.ctx) {
    if (this.mode === 'SALOON_GANG') {
      this.drawSaloonBackdrop(ctx);
    } else {
      this.drawDesertBackdrop(ctx);
    }

    for (const o of this.outlaws) {
      this.drawOutlaw(ctx, o);
    }

    this.drawScoreboardPanel(ctx);
    this.drawBulletHolesAndCrosshair(ctx);

    for (const pop of this.popups) {
      this.renderer.drawText(pop.text, pop.x, pop.y, {
        font: FONTS.HEADER,
        size: 11,
        color: pop.color,
        align: 'center',
        glow: 8
      });
    }

    if (this.bannerTimer > 0 && this.bannerText) {
      this.renderer.drawText(this.bannerText, 480, 128, {
        font: FONTS.HEADER,
        size: 18,
        color: this.bannerColor,
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
      extraLabel: `AMMO:${'I'.repeat(Math.max(0, this.ammo))}  ${this.mode}`,
      accent: PALETTE.ORANGE
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1984 NINTENDO ZAPPER WESTERN SHOWDOWN',
      controls: 'CLICK/TAP OUTLAW OR PRESS [Z / SPACE] THE INSTANT "FIRE!!" FLASHES!',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.ORANGE
    });
  }

  drawDesertBackdrop(ctx) {
    ctx.save();
    // Sunset Sky & Desert Mesas
    const grad = ctx.createLinearGradient(0, 38, 0, 340);
    grad.addColorStop(0, '#1E1B4B');
    grad.addColorStop(0.55, '#7C2D12');
    grad.addColorStop(1, '#F59E0B');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 38, 960, 302);

    // High Noon Sun
    this.renderer.drawGlowCircle(480, 155, 42, '#FEF08A', 24, true);

    // Sand Floor
    ctx.fillStyle = '#D97706';
    ctx.fillRect(0, 340, 960, 200);
    ctx.fillStyle = '#B45309';
    ctx.fillRect(0, 340, 960, 8);

    // Saguaro Cacti silhouettes
    for (const cx of [125, 835]) {
      ctx.fillStyle = '#15803D';
      ctx.fillRect(cx - 8, 235, 16, 110);
      ctx.fillRect(cx - 26, 265, 18, 10);
      ctx.fillRect(cx - 26, 245, 10, 25);
      ctx.fillRect(cx + 8, 280, 18, 10);
      ctx.fillRect(cx + 16, 255, 10, 30);
    }
    ctx.restore();
  }

  drawSaloonBackdrop(ctx) {
    ctx.save();
    ctx.fillStyle = '#451A03';
    ctx.fillRect(0, 38, 960, 502);

    // Saloon Roof Sign
    ctx.fillStyle = '#78350F';
    ctx.strokeStyle = PALETTE.GOLD;
    ctx.lineWidth = 3;
    ctx.fillRect(280, 52, 400, 44);
    ctx.strokeRect(280, 52, 400, 44);
    this.renderer.drawText('HIGH NOON SALOON', 480, 81, {
      font: FONTS.HEADER,
      size: 15,
      color: PALETTE.GOLD,
      align: 'center',
      glow: 8
    });

    // Draw the 6 Saloon Windows & Doors
    for (const w of this.saloonWindows) {
      const occupied = this.outlaws.some((o) => o.windowRef === w);
      ctx.fillStyle = occupied ? '#1E293B' : '#090D16';
      ctx.fillRect(w.x - w.w * 0.5, w.y - w.h * 0.5, w.w, w.h);
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 4;
      ctx.strokeRect(w.x - w.w * 0.5, w.y - w.h * 0.5, w.w, w.h);
    }
    ctx.restore();
  }

  drawOutlaw(ctx, o) {
    ctx.save();
    const x = o.x;
    const y = o.y;

    // Boots
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(x - 20, y - 14, 14, 14);
    ctx.fillRect(x + 6, y - 14, 14, 14);

    // Legs & Slapstick Dropped Pants when shot!
    if (o.pantsDropped) {
      // Polka-dot boxer shorts exposed!
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(x - 18, y - 44, 36, 24);
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(x - 12, y - 38, 5, 5);
      ctx.fillRect(x + 6, y - 36, 5, 5);
      ctx.fillRect(x - 2, y - 28, 5, 5);
      // Dropped trousers bunched at ankles
      ctx.fillStyle = '#334155';
      ctx.fillRect(x - 22, y - 20, 44, 10);
    } else {
      ctx.fillStyle = '#334155';
      ctx.fillRect(x - 18, y - 44, 15, 30);
      ctx.fillRect(x + 3, y - 44, 15, 30);
    }

    // Poncho / Duster Coat & Gun Belt
    ctx.fillStyle = o.coat;
    ctx.fillRect(x - 24, y - 82, 48, 40);
    ctx.fillStyle = '#78350F';
    ctx.fillRect(x - 24, y - 48, 48, 6);
    ctx.fillStyle = PALETTE.GOLD;
    ctx.fillRect(x - 5, y - 49, 10, 8);

    // Outlaw Head & Bandana
    ctx.fillStyle = '#FDBA74';
    ctx.fillRect(x - 14, y - 104, 28, 22);

    // Eyes flash bright cyan/white on "FIRE!!"
    const eyeColor = o.phase === 'FIRE' ? PALETTE.CYAN : '#0B0F19';
    ctx.fillStyle = eyeColor;
    if (o.phase === 'FIRE') {
      ctx.shadowColor = PALETTE.CYAN;
      ctx.shadowBlur = 12;
    }
    ctx.fillRect(x - 9, y - 97, 6, 5);
    ctx.fillRect(x + 3, y - 97, 6, 5);
    ctx.shadowBlur = 0;

    // Drawn Revolver when in FIRE or WON phase
    if (o.phase === 'FIRE' || o.phase === 'WON') {
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(x + 22, y - 70, 18, 8);
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(x + 34, y - 72, 6, 6);
    }

    // Sombrero / Cowboy Hat (flies up into the air when defeated!)
    const hy = y - 110 + o.hatOffsetY;
    ctx.fillStyle = o.hat;
    ctx.fillRect(x - 28, hy, 56, 7);
    ctx.fillRect(x - 16, hy - 12, 32, 12);

    // Speech Bubble: "FIRE!!"
    if (o.phase === 'FIRE') {
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = PALETTE.RED;
      ctx.lineWidth = 2.5;
      ctx.fillRect(x + 26, y - 134, 84, 30);
      ctx.strokeRect(x + 26, y - 134, 84, 30);
      this.renderer.drawText('FIRE!!', x + 68, y - 114, {
        font: FONTS.HEADER,
        size: 11,
        color: PALETTE.RED,
        align: 'center'
      });
    }
    ctx.restore();
  }

  drawScoreboardPanel(ctx) {
    ctx.save();
    const primary = this.outlaws[0];
    const outlawTime = primary ? primary.reactionLimit.toFixed(2) : '0.75';
    const playerTime =
      this.lastPlayerDrawTime !== null
        ? this.lastPlayerDrawTime.toFixed(2)
        : primary && primary.phase === 'FIRE'
        ? primary.drawTimer.toFixed(2)
        : '0.00';

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = PALETTE.GOLD;
    ctx.lineWidth = 2;
    ctx.fillRect(280, 448, 400, 74);
    ctx.strokeRect(280, 448, 400, 74);

    this.renderer.drawText(`OUTLAW TIME: ${outlawTime}S`, 480, 474, {
      font: FONTS.HEADER,
      size: 11,
      color: PALETTE.GOLD,
      align: 'center'
    });
    this.renderer.drawText(`YOUR DRAW:   ${playerTime}S`, 480, 504, {
      font: FONTS.HEADER,
      size: 11,
      color: PALETTE.CYAN,
      align: 'center'
    });
    ctx.restore();
  }

  drawBulletHolesAndCrosshair(ctx) {
    ctx.save();
    for (const bh of this.bulletHoles) {
      ctx.fillStyle = '#090D16';
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    const cx = this.crosshair.x;
    const cy = this.crosshair.y;
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.lineWidth = 2;
    ctx.shadowColor = PALETTE.CYAN;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.moveTo(cx - 22, cy);
    ctx.lineTo(cx + 22, cy);
    ctx.moveTo(cx, cy - 22);
    ctx.lineTo(cx, cy + 22);
    ctx.stroke();
    ctx.restore();
  }
}

export default WildGunman;
