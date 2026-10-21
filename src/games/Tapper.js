/**
 * Tapper.js
 * Classic 1983 Bally Midway Arcade Action Game (Root Beer Tapper / Root Beer Dash).
 *
 * Features:
 * - 4 parallel saloon bar counters at y = 140, 240, 340, 440 with brass keg taps on the right
 * - UP/DOWN teleports the bartender between the 4 bar taps; LEFT/RIGHT runs along the counter
 *   to catch returning empty mugs and collect tip bills (+500 pts + Can-Can Show distraction!)
 * - ACTION A fills & slides a frosty root beer mug down the counter; ACTION B quick-snaps to tap
 * - 4 distinct saloon themes across levels (Western Saloon, Sports Grill, Punk Club, Cosmic Cantina)
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const SPRITES = {
  BARTENDER: [
    '...KKKKKK...',
    '..KKKKKKKK..',
    '..FFFFFFFF..',
    '..FFKKKKFF..',
    '...FFFFFF...',
    '..WWWWWWWW..',
    '.WWRRRRRRWW.',
    '.WWRRRRRRWW.',
    '..RRRRRRRR..',
    '...KK..KK...'
  ],
  PATRON: [
    '...HHHHHH...',
    '..HHHHHHHH..',
    '...FFFFFF...',
    '..CCCCCCCC..',
    '.CCCCCCCCCC.',
    '..CCCCCCCC..',
    '...BBBBBB...',
    '...BB..BB...',
    '..KK....KK..'
  ],
  MUG_FULL: [
    '.WWWWWW.',
    'WWWWWWWW',
    'GGGGGGGG',
    'GGGGGGGG',
    'GGGGGGGG',
    'GGGGGGGG',
    '.GGGGGG.'
  ],
  MUG_EMPTY: [
    '........',
    '.WWWWWW.',
    '.W....W.',
    '.W....W.',
    '.W....W.',
    '.W....W.',
    '.WWWWWW.'
  ]
};

const BARTENDER_PALETTE = {
  K: '#1E293B',
  F: '#FDBA74',
  W: PALETTE.WHITE,
  R: PALETTE.RED
};

const MUG_PALETTE = {
  W: PALETTE.WHITE,
  G: '#D97706'
};

export class Tapper {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'tapper';
    this.title = 'Root Beer Dash';
    this.state = 'PLAYING';

    this.width = 960;
    this.height = 540;
    this.highScore = HighScoreStore.get(this.id);

    // 4 parallel saloon bar counters at y = 140, 240, 340, 440
    this.bars = [
      { y: 140, leftX: 150, rightX: 800, tapX: 822 },
      { y: 240, leftX: 125, rightX: 815, tapX: 837 },
      { y: 340, leftX: 100, rightX: 830, tapX: 852 },
      { y: 440, leftX: 75, rightX: 845, tapX: 867 }
    ];

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this._setupWave(this.level);
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    if (this.audio) {
      this.audio.stopSequence();
    }
  }

  _setupWave(level) {
    this.bartender = {
      barIdx: 0,
      x: this.bars[0].tapX,
      y: this.bars[0].y,
      pouringTimer: 0,
      speed: 280
    };

    this.patrons = [];
    this.mugs = []; // { barIdx, x, vx, full: true|false }
    this.tips = []; // { barIdx, x, timer }
    this.particles = [];
    this.floatingTexts = [];

    this.patronsRemainingToSpawn = 10 + level * 4;
    this.spawnTimer = 0.6;
    this.showDancerTimer = 0;

    // Spawn 1 patron on each bar immediately
    for (let b = 0; b < 4; b++) {
      this._spawnPatron(b, this.bars[b].leftX + 20 + b * 14);
      this.patronsRemainingToSpawn = Math.max(0, this.patronsRemainingToSpawn - 1);
    }

    const themes = ['WESTERN SALOON', 'SPORTS GRILL', 'NEON PUNK CLUB', 'COSMIC CANTINA'];
    this.themeName = themes[(level - 1) % themes.length];
    this.bannerText = `STAGE ${level}: ${this.themeName}`;
    this.bannerTimer = 2.0;
  }

  _spawnPatron(barIdx, customX = null) {
    const bar = this.bars[barIdx];
    const colors = [PALETTE.CYAN, PALETTE.GREEN, PALETTE.PURPLE, PALETTE.PINK, PALETTE.ORANGE];
    const hats = ['#92400E', PALETTE.GOLD, PALETTE.RED, PALETTE.BLUE];
    this.patrons.push({
      barIdx,
      x: customX !== null ? customX : bar.leftX + 8,
      y: bar.y,
      speed: 42 + Math.min(48, this.level * 5.5) + Math.random() * 14,
      state: 'advancing', // 'advancing' | 'drinking' | 'distracted'
      drinkTimer: 0,
      hasSentEmpty: false,
      shirtColor: colors[(barIdx + this.patrons.length) % colors.length],
      hatColor: hats[barIdx % hats.length]
    });
  }

  update(dt) {
    const clampedDt = Math.min(dt, 0.05);

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
    if (this.showDancerTimer > 0) {
      this.showDancerTimer = Math.max(0, this.showDancerTimer - clampedDt);
    }

    this._updateBartender(clampedDt);
    this._updateMugs(clampedDt);
    this._updatePatrons(clampedDt);
    this._updateTips(clampedDt);
    this._updateParticles(clampedDt);

    // Check stage clear
    const activeMugs = this.mugs.length;
    if (this.patrons.length === 0 && this.patronsRemainingToSpawn <= 0 && activeMugs === 0) {
      this.score += 1000;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        HighScoreStore.submit(this.id, this.score);
      }
      this.level += 1;
      this.audio.playStageClear();
      this._setupWave(this.level);
    }
  }

  _updateBartender(dt) {
    const bt = this.bartender;
    if (bt.pouringTimer > 0) {
      bt.pouringTimer = Math.max(0, bt.pouringTimer - dt);
    }

    // UP / DOWN teleports between the 4 bar taps
    if (this.input.isJustPressed('up')) {
      bt.barIdx = (bt.barIdx + 3) % 4;
      bt.x = this.bars[bt.barIdx].tapX;
      bt.y = this.bars[bt.barIdx].y;
      this.audio.playHop();
    } else if (this.input.isJustPressed('down')) {
      bt.barIdx = (bt.barIdx + 1) % 4;
      bt.x = this.bars[bt.barIdx].tapX;
      bt.y = this.bars[bt.barIdx].y;
      this.audio.playHop();
    }

    const bar = this.bars[bt.barIdx];

    // LEFT / RIGHT runs along the bar counter to catch empty mugs or grab tips
    const axis = this.input.getAxis();
    if (Math.abs(axis.x) > 0.1) {
      bt.x = Math.max(bar.leftX + 24, Math.min(bar.tapX, bt.x + axis.x * bt.speed * dt));
    }

    // ACTION B snaps back to the keg tap immediately
    if (this.input.isJustPressed('actionB')) {
      bt.x = bar.tapX;
      this.audio.playHop();
    }

    // ACTION A snaps to the keg tap and slides a frosty root beer mug down the counter
    if (this.input.isJustPressed('actionA') && bt.pouringTimer <= 0) {
      bt.x = bar.tapX;
      bt.pouringTimer = 0.16;
      this.mugs.push({
        barIdx: bt.barIdx,
        x: bar.rightX - 8,
        y: bar.y - 16,
        vx: -310,
        full: true
      });
      this.audio.playPump(2);
    }
  }

  _updateMugs(dt) {
    const bt = this.bartender;

    for (let i = this.mugs.length - 1; i >= 0; i--) {
      const m = this.mugs[i];
      const bar = this.bars[m.barIdx];
      m.x += m.vx * dt;

      if (m.full) {
        // Check if full mug hits an advancing thirsty patron on this bar
        let hitIndex = -1;
        let closestDist = 9999;
        for (let j = 0; j < this.patrons.length; j++) {
          const p = this.patrons[j];
          if (p.barIdx === m.barIdx && p.state !== 'drinking' && Math.abs(p.x - m.x) < 22) {
            const d = Math.abs(p.x - m.x);
            if (d < closestDist) {
              closestDist = d;
              hitIndex = j;
            }
          }
        }

        if (hitIndex !== -1) {
          const patron = this.patrons[hitIndex];
          this.mugs.splice(i, 1);
          this._servePatron(patron);
          continue;
        }

        // If full mug slides off the left end of the counter -> SMASH! Costs a life!
        if (m.x <= bar.leftX) {
          this.mugs.splice(i, 1);
          this._loseLife('MUG SMASHED OFF COUNTER!', bar.leftX, bar.y);
          return;
        }
      } else {
        // Empty mug sliding back rightward toward the bartender
        if (
          bt.barIdx === m.barIdx &&
          Math.abs(bt.x - m.x) < 28
        ) {
          this.mugs.splice(i, 1);
          this._awardPoints(100, m.x, bar.y - 26, 'CAUGHT +100', PALETTE.CYAN);
          this.audio.playCoin();
          continue;
        }

        if (m.x >= bar.tapX + 8) {
          this.mugs.splice(i, 1);
          this._loseLife('EMPTY MUG DROPPED!', bar.rightX, bar.y);
          return;
        }
      }
    }
  }

  _servePatron(patron) {
    const bar = this.bars[patron.barIdx];
    this._awardPoints(50, patron.x, bar.y - 28, '+50', PALETTE.GOLD);
    this.audio.playWaka();

    // Knock patron backward while chugging root beer
    patron.state = 'drinking';
    patron.drinkTimer = 1.05;
  }

  _updatePatrons(dt) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.patronsRemainingToSpawn > 0) {
      this.spawnTimer = Math.max(0.85, 2.1 - this.level * 0.12);
      const barIdx = Math.floor(Math.random() * 4);
      this._spawnPatron(barIdx);
      this.patronsRemainingToSpawn -= 1;
    }

    for (let i = this.patrons.length - 1; i >= 0; i--) {
      const p = this.patrons[i];
      const bar = this.bars[p.barIdx];

      if (p.state === 'drinking') {
        p.x -= 115 * dt;
        p.drinkTimer -= dt;

        // Knocked all the way out the left saloon door!
        if (p.x <= bar.leftX + 6) {
          this._awardPoints(100, bar.leftX + 20, bar.y - 26, 'SATISFIED +100!', PALETTE.GREEN);
          this._spawnSplash(bar.leftX + 12, bar.y - 16, PALETTE.GOLD, 12);
          this.patrons.splice(i, 1);
          continue;
        }

        // Finished drinking mid-bar -> slide empty mug back rightward and resume advancing!
        if (p.drinkTimer <= 0) {
          p.state = 'advancing';
          this.mugs.push({
            barIdx: p.barIdx,
            x: p.x + 12,
            y: bar.y - 16,
            vx: 110 + this.level * 10,
            full: false
          });

          // 35% chance to leave a green Tip Dollar Bill on the counter!
          if (Math.random() < 0.35) {
            this.tips.push({
              barIdx: p.barIdx,
              x: p.x,
              y: bar.y - 16,
              timer: 8.5
            });
          }
        }
      } else {
        // Advancing toward tap (paused if distracted by Can-Can dancers!)
        if (this.showDancerTimer > 0 && i % 2 === 0) {
          continue;
        }
        p.x += p.speed * dt;
        if (p.x >= bar.rightX - 10) {
          this._loseLife('PATRON REACHED THE TAP!', bar.rightX, bar.y);
          return;
        }
      }
    }
  }

  _updateTips(dt) {
    const bt = this.bartender;
    for (let i = this.tips.length - 1; i >= 0; i--) {
      const t = this.tips[i];
      t.timer -= dt;
      if (bt.barIdx === t.barIdx && Math.abs(bt.x - t.x) < 26) {
        this._awardPoints(500, t.x, t.y - 20, 'TIP +$500! DANCERS!', PALETTE.GREEN);
        this.audio.playPowerUp();
        this.showDancerTimer = 4.0;
        this.tips.splice(i, 1);
      } else if (t.timer <= 0) {
        this.tips.splice(i, 1);
      }
    }
  }

  _loseLife(reason, x, y) {
    this.renderer.shake(9, 0.35);
    this.audio.playExplosion(0.45, 700);
    this._spawnSplash(x, y - 14, PALETTE.RED, 24);
    this.bannerText = reason;
    this.bannerTimer = 1.8;

    this.lives -= 1;
    if (this.lives <= 0) {
      HighScoreStore.submit(this.id, this.score);
      this.audio.playGameOver();
      this.state = 'GAMEOVER';
    } else {
      // Clear mugs and push patrons back slightly so player can recover cleanly
      this.mugs = [];
      for (const p of this.patrons) {
        const bar = this.bars[p.barIdx];
        p.x = Math.max(bar.leftX + 16, p.x - 140);
        p.state = 'advancing';
      }
      this.bartender.x = this.bars[this.bartender.barIdx].tapX;
    }
  }

  _awardPoints(pts, x, y, text, color) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -40,
      life: 0.95,
      maxLife: 0.95,
      color
    });
  }

  _spawnSplash(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count;
      const spd = 45 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
        size: 3,
        color: i % 2 === 0 ? color : PALETTE.WHITE
      });
    }
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
    // 1. Warm Saloon Wood Flooring Background
    ctx.fillStyle = '#1C120C';
    ctx.fillRect(0, 38, this.width, this.height - 38);

    // Subtle wood plank lines
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.35)';
    ctx.lineWidth = 1;
    for (let y = 60; y < this.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    // 2. Back-Wall Can-Can Stage Banner (lights up when a Tip is collected!)
    ctx.fillStyle = this.showDancerTimer > 0 ? '#4C1D95' : '#271710';
    ctx.fillRect(260, 48, 440, 44);
    ctx.strokeStyle = this.showDancerTimer > 0 ? PALETTE.PINK : '#92400E';
    ctx.lineWidth = 2;
    ctx.strokeRect(260, 48, 440, 44);
    this.renderer.drawText(
      this.showDancerTimer > 0
        ? '💃 CAN-CAN STAGE SHOW! PATRONS DISTRACTED! 💃'
        : `🍺 ${this.themeName || 'ROOT BEER SALOON'} — SERVE COLD ROOT BEER! 🍺`,
      this.width / 2,
      75,
      {
        font: FONTS.HEADER,
        size: 11,
        color: this.showDancerTimer > 0 ? PALETTE.GOLD : PALETTE.ORANGE,
        align: 'center',
        glow: this.showDancerTimer > 0 ? 10 : 4
      }
    );

    // 3. The 4 Parallel Saloon Bar Counters (y = 140, 240, 340, 440)
    for (let i = 0; i < this.bars.length; i++) {
      const bar = this.bars[i];

      // Left swinging saloon doors
      ctx.fillStyle = '#78350F';
      ctx.fillRect(bar.leftX - 28, bar.y - 42, 22, 54);
      ctx.strokeStyle = PALETTE.GOLD;
      ctx.strokeRect(bar.leftX - 28, bar.y - 42, 22, 54);

      // Mahogany Bar Counter Base & Polished Brass Top Rail
      ctx.fillStyle = '#451A03';
      ctx.fillRect(bar.leftX, bar.y, bar.rightX - bar.leftX, 28);
      ctx.fillStyle = '#92400E';
      ctx.fillRect(bar.leftX - 4, bar.y - 6, bar.rightX - bar.leftX + 8, 10);
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bar.leftX - 4, bar.y - 6, bar.rightX - bar.leftX + 8, 10);

      // Right-end Oak Root Beer Keg & Brass Tap Handle
      ctx.fillStyle = '#78350F';
      ctx.fillRect(bar.rightX + 8, bar.y - 32, 38, 36);
      ctx.strokeStyle = PALETTE.GOLD;
      ctx.lineWidth = 2;
      ctx.strokeRect(bar.rightX + 8, bar.y - 32, 38, 36);

      // Brass Tap Lever
      ctx.strokeStyle = this.bartender.barIdx === i ? PALETTE.CYAN : PALETTE.GOLD;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(bar.rightX + 14, bar.y - 26);
      ctx.lineTo(bar.rightX + 8, bar.y - 42);
      ctx.stroke();
    }

    // 4. Thirsty Patrons Advancing Along Each Bar
    for (const p of this.patrons) {
      const palette = {
        H: p.hatColor,
        F: '#FDBA74',
        C: p.shirtColor,
        B: '#1E3A8A',
        K: '#0F172A'
      };
      const scale = 2.6;
      const w = SPRITES.PATRON[0].length * scale;
      const h = SPRITES.PATRON.length * scale;
      this.renderer.drawPixelSprite(
        SPRITES.PATRON,
        p.x - w / 2,
        p.y - h - 4,
        scale,
        palette
      );

      if (p.state === 'drinking') {
        this.renderer.drawPixelSprite(
          SPRITES.MUG_FULL,
          p.x + 8,
          p.y - 24,
          1.8,
          MUG_PALETTE
        );
      }
    }

    // 5. Tip Dollar Bills on Bar Counters
    for (const t of this.tips) {
      this.renderer.drawGlowRect(t.x - 9, t.y, 18, 10, PALETTE.GREEN, 8);
      this.renderer.drawText('$', t.x, t.y + 9, {
        font: FONTS.HEADER,
        size: 8,
        color: PALETTE.WHITE,
        align: 'center'
      });
    }

    // 6. Sliding Full & Empty Root Beer Mugs
    for (const m of this.mugs) {
      const sprite = m.full ? SPRITES.MUG_FULL : SPRITES.MUG_EMPTY;
      const scale = 2.1;
      const w = sprite[0].length * scale;
      const h = sprite.length * scale;
      this.renderer.drawPixelSprite(sprite, m.x - w / 2, m.y - h / 2, scale, MUG_PALETTE);
    }

    // 7. Bartender
    const bt = this.bartender;
    const btScale = 2.7;
    const bw = SPRITES.BARTENDER[0].length * btScale;
    const bh = SPRITES.BARTENDER.length * btScale;
    this.renderer.drawPixelSprite(
      SPRITES.BARTENDER,
      bt.x - bw / 2,
      bt.y - bh - 4,
      btScale,
      BARTENDER_PALETTE
    );

    // 8. Particles & Floating Score Popups
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }

    for (const ft of this.floatingTexts) {
      this.renderer.drawText(ft.text, ft.x, ft.y, {
        font: FONTS.HEADER,
        size: 11,
        color: ft.color,
        align: 'center',
        glow: 8
      });
    }

    if (this.bannerTimer > 0 && this.state === 'PLAYING') {
      this.renderer.drawText(this.bannerText, this.width / 2, 275, {
        font: FONTS.HEADER,
        size: 15,
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
      extraLabel: `PATRONS: ${this.patrons.length + this.patronsRemainingToSpawn}`,
      accent: PALETTE.ORANGE
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '4-BAR ROOT BEER SALOON EDITION',
      controls: 'UP/DOWN: SWITCH BAR  |  SPACE/Z: POUR & SLIDE MUG  |  LEFT/RIGHT: CATCH MUGS & TIPS',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.ORANGE
    });
  }
}

export default Tapper;
