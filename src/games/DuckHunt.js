/**
 * DuckHunt.js
 * Light-Gun Arcade Shooter
 * Supports both Mouse/Touch click/tap at pointer coordinates AND D-Pad/Arrow crosshair aiming + Action A fire!
 * Features 3 shotgun shells per wave, muzzle flash, dynamic bouncing ducks with wing-flap animations,
 * falling spun ducks on hit, and the iconic hunting dog holding caught ducks or chuckling on a miss!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const DUCK_FLAP_UP = [
  '....GGG...',
  '...GGGGW..',
  '...GGGGKO.',
  'BBBBGGGG..',
  '.BBBBGGG..',
  '..BBBBBB..',
  '...BBBB...',
  '..OO..OO..'
];

const DUCK_FLAP_DOWN = [
  '....GGG...',
  '...GGGGW..',
  '...GGGGKO.',
  '...GGGGG..',
  '.BBBBBBBB.',
  'BBBB..BBBB',
  '..BB..BB..',
  '..OO..OO..'
];

const DUCK_SHOT = [
  '....GGG...',
  '...GWWGW..',
  '...GKKGKO.',
  'BBBBGGGG..',
  'BBBBBBBBBB',
  '.BBBBBBBB.',
  '..OO..OO..',
  '..........'
];

export class DuckHunt {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'duckhunt';
    this.title = 'Wing Blaster';
    this.state = 'PLAYING';

    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.grassY = 415;
    this.crosshair = { x: 480, y: 240 };
    this.lastPointer = { x: 480, y: 270 };

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.state = 'PLAYING';

    this.ducks = [];
    this.particles = [];
    this.floatingTexts = [];
    this.muzzleFlashTimer = 0;
    this.shotMarkers = [];

    this._startRound();
  }

  _startRound() {
    this.roundDuckResults = new Array(10).fill('pending'); // 'pending' | 'hit' | 'miss'
    this.duckCursor = 0;
    this._spawnSubWave();
  }

  _spawnSubWave() {
    this.shells = 3;
    this.waveTimer = Math.max(4.5, 7.2 - this.level * 0.35);
    this.flyAway = false;
    this.ducks = [];
    this.dog = {
      active: false,
      mode: 'catch', // 'catch' | 'laugh'
      caughtCount: 0,
      yOffset: 0,
      timer: 0
    };

    const count = this.level >= 2 ? 2 : 1;
    for (let i = 0; i < count && this.duckCursor < 10; i++) {
      const idx = this.duckCursor++;
      const isFast = Math.random() < 0.35 + this.level * 0.08;
      const startX = 160 + Math.random() * 640;
      const spd = (isFast ? 235 : 175) + this.level * 22;
      const angle = -Math.PI * (0.22 + Math.random() * 0.56);

      this.ducks.push({
        slotIndex: idx,
        x: startX,
        y: this.grassY - 10,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        speed: spd,
        isFast,
        state: 'FLYING', // 'FLYING' | 'SHOT' | 'FALLING' | 'ESCAPED' | 'DONE'
        stateTimer: 0,
        flapTimer: 0,
        bounceTimer: 0.9 + Math.random() * 0.8,
        points: isFast ? 1000 : 500
      });
    }

    this.audio.playHop();
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    this.particles = [];
    this.ducks = [];
  }

  _spawnFeathers(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 20,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        color: i % 2 === 0 ? PALETTE.WHITE : color,
        size: 3 + Math.random() * 3
      });
    }
  }

  _fireShot(targetX, targetY) {
    if (this.shells <= 0 || this.dog.active) return;

    this.shells--;
    this.muzzleFlashTimer = 0.07;
    this.renderer.shake(5, 0.1);
    this.audio.playExplosion(0.22, 1800);

    this.shotMarkers.push({ x: targetX, y: targetY, life: 0.35 });

    let hitAny = false;
    for (const d of this.ducks) {
      if (d.state === 'FLYING') {
        const dist = Math.hypot(d.x - targetX, d.y - targetY);
        if (dist <= 44) {
          d.state = 'SHOT';
          d.stateTimer = 0.38;
          d.vx = 0;
          d.vy = 0;
          this.roundDuckResults[d.slotIndex] = 'hit';
          const pts = d.points * this.level;
          this.score += pts;
          if (this.score > this.highScore) {
            this.highScore = this.score;
            HighScoreStore.submit(this.id, this.score);
          }
          this._spawnFeathers(d.x, d.y, d.isFast ? PALETTE.PINK : PALETTE.GREEN);
          this.floatingTexts.push({
            text: `+${pts}`,
            x: d.x,
            y: d.y - 18,
            vy: -40,
            life: 0.9,
            maxLife: 0.9,
            color: PALETTE.GOLD
          });
          hitAny = true;
          break; // One shell hits one duck unless overlapping
        }
      }
    }

    if (hitAny) {
      this.audio.playCoin();
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

    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - dt);
    }

    // Crosshair Aiming: Hybrid Pointer + D-Pad/Arrow Key Control
    const ptr = this.input.pointer;
    if (
      Math.abs(ptr.x - this.lastPointer.x) > 0.5 ||
      Math.abs(ptr.y - this.lastPointer.y) > 0.5 ||
      ptr.justPressed
    ) {
      this.crosshair.x = ptr.x;
      this.crosshair.y = Math.max(46, Math.min(this.grassY + 10, ptr.y));
      this.lastPointer.x = ptr.x;
      this.lastPointer.y = ptr.y;
    }

    const axis = this.input.getAxis();
    if (Math.hypot(axis.x, axis.y) > 0.05) {
      const aimSpeed = 380;
      this.crosshair.x = Math.max(
        24,
        Math.min(936, this.crosshair.x + axis.x * aimSpeed * dt)
      );
      this.crosshair.y = Math.max(
        48,
        Math.min(this.grassY + 10, this.crosshair.y + axis.y * aimSpeed * dt)
      );
    }

    // Trigger Fire via Mouse/Touch Click OR Action A/B
    if (ptr.justPressed) {
      this._fireShot(ptr.x, ptr.y);
    } else if (
      this.input.isJustPressed('actionA') ||
      this.input.isJustPressed('actionB')
    ) {
      this._fireShot(this.crosshair.x, this.crosshair.y);
    }

    // Update Wave Timer & Fly-Away Trigger
    const flyingDucks = this.ducks.filter((d) => d.state === 'FLYING');
    if (flyingDucks.length > 0 && !this.flyAway) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0 || this.shells <= 0) {
        // Give a brief grace window after last shot before ducks fly away
        if (this.waveTimer <= 0 || (this.shells <= 0 && this.muzzleFlashTimer <= 0)) {
          this.flyAway = true;
          this.audio.playSiren(0.2, true);
          for (const d of flyingDucks) {
            d.vy = -280;
            d.vx = (Math.random() - 0.5) * 140;
          }
        }
      }
    }

    // Update Ducks
    for (const d of this.ducks) {
      d.flapTimer += dt * 12;

      if (d.state === 'FLYING') {
        d.x += d.vx * dt;
        d.y += d.vy * dt;

        if (!this.flyAway) {
          // Bounce off screen boundaries & grass line
          if (d.x < 40) {
            d.x = 40;
            d.vx = Math.abs(d.vx);
          } else if (d.x > 920) {
            d.x = 920;
            d.vx = -Math.abs(d.vx);
          }
          if (d.y < 68) {
            d.y = 68;
            d.vy = Math.abs(d.vy);
          } else if (d.y > this.grassY - 28) {
            d.y = this.grassY - 28;
            d.vy = -Math.abs(d.vy);
          }

          // Dynamic erratic direction changes
          d.bounceTimer -= dt;
          if (d.bounceTimer <= 0) {
            d.bounceTimer = 0.75 + Math.random() * 0.85;
            const ang = (Math.random() - 0.5) * 1.1;
            const curAng = Math.atan2(d.vy, d.vx) + ang;
            d.vx = Math.cos(curAng) * d.speed;
            d.vy = Math.sin(curAng) * d.speed;
            if (Math.abs(d.vy) < 45) {
              d.vy = d.vy < 0 ? -75 : 75;
            }
          }
        } else {
          // Escaping upward off the top of the screen
          if (d.y < 30) {
            d.state = 'ESCAPED';
            this.roundDuckResults[d.slotIndex] = 'miss';
          }
        }
      } else if (d.state === 'SHOT') {
        d.stateTimer -= dt;
        if (d.stateTimer <= 0) {
          d.state = 'FALLING';
          this.audio.playLaser(780, 210, 0.35);
        }
      } else if (d.state === 'FALLING') {
        d.y += 290 * dt;
        d.x += Math.sin(d.flapTimer * 2) * 45 * dt;
        if (d.y >= this.grassY) {
          d.state = 'DONE';
          this.audio.playShove();
        }
      }
    }

    // Check if Sub-Wave is finished -> Trigger Hunting Dog Sequence
    const allResolved =
      this.ducks.length > 0 &&
      this.ducks.every((d) => d.state === 'DONE' || d.state === 'ESCAPED');

    if (allResolved && !this.dog.active) {
      const caught = this.ducks.filter((d) => d.state === 'DONE').length;
      const escaped = this.ducks.filter((d) => d.state === 'ESCAPED').length;

      this.dog.active = true;
      this.dog.caughtCount = caught;
      this.dog.mode = caught > 0 ? 'catch' : 'laugh';
      this.dog.timer = 1.65;
      this.dog.yOffset = 0;

      if (caught > 0) {
        this.audio.playPowerUp();
      } else {
        // Dog chuckle sound
        this.audio.playChiptune([
          { freq: 380, dur: 0.09, type: 'square' },
          { freq: 290, dur: 0.09, type: 'square' },
          { freq: 380, dur: 0.09, type: 'square' },
          { freq: 290, dur: 0.09, type: 'square' }
        ]);
      }

      if (escaped > 0) {
        const totalMisses = this.roundDuckResults.filter((r) => r === 'miss').length;
        if (totalMisses >= 4 && escaped > 0) {
          this.lives--;
          if (this.lives <= 0) {
            HighScoreStore.submit(this.id, this.score);
            this.audio.playGameOver();
            this.setState('GAMEOVER');
            return;
          }
        }
      }
    }

    // Update Hunting Dog Animation
    if (this.dog.active) {
      this.dog.timer -= dt;
      const progress = 1 - this.dog.timer / 1.65;
      if (progress < 0.25) {
        this.dog.yOffset = (progress / 0.25) * 58;
      } else if (progress < 0.78) {
        this.dog.yOffset = 58;
      } else {
        this.dog.yOffset = Math.max(0, ((1 - progress) / 0.22) * 58);
      }

      if (this.dog.timer <= 0) {
        this.dog.active = false;
        if (this.duckCursor >= 10) {
          // Round Complete! Check quota bonus
          const hits = this.roundDuckResults.filter((r) => r === 'hit').length;
          if (hits === 10) {
            this.score += 5000 * this.level;
            this.floatingTexts.push({
              text: `PERFECT ROUND! +${5000 * this.level}`,
              x: 480,
              y: 220,
              vy: -30,
              life: 1.4,
              maxLife: 1.4,
              color: PALETTE.GOLD
            });
          }
          this.audio.playStageClear();
          this.level++;
          this._startRound();
        } else {
          this._spawnSubWave();
        }
      }
    }

    // Update Shot Markers, Particles, Floating Texts
    for (let i = this.shotMarkers.length - 1; i >= 0; i--) {
      this.shotMarkers[i].life -= dt;
      if (this.shotMarkers[i].life <= 0) this.shotMarkers.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  render(ctx = this.renderer.ctx) {
    // Sky Backdrop (turns warm pink-orange on FLY AWAY!)
    ctx.fillStyle = this.flyAway ? '#3B0F2B' : '#0B192C';
    ctx.fillRect(0, 38, this.renderer.width, this.grassY - 38);

    // Muzzle Flash White-Out Frame
    if (this.muzzleFlashTimer > 0) {
      ctx.fillStyle = 'rgba(248, 250, 252, 0.72)';
      ctx.fillRect(0, 38, this.renderer.width, this.renderer.height - 38);
    }

    // Distant Trees & Bushes behind grass
    ctx.fillStyle = '#14532D';
    ctx.fillRect(90, this.grassY - 140, 22, 140);
    this.renderer.drawGlowCircle(101, this.grassY - 150, 48, '#166534', 8);
    this.renderer.drawGlowCircle(780, this.grassY - 35, 38, '#15803D', 6);

    if (this.flyAway) {
      this.renderer.drawText('FLY AWAY!', 480, 130, {
        font: FONTS.HEADER,
        size: 22,
        color: PALETTE.PINK,
        align: 'center',
        glow: 12
      });
    }

    // Draw Ducks (rendered before foreground grass so falling ducks drop behind grass!)
    for (const d of this.ducks) {
      if (d.state === 'DONE' || d.state === 'ESCAPED') continue;

      let sprite = DUCK_FLAP_UP;
      let flipX = d.vx < 0;
      if (d.state === 'SHOT') {
        sprite = DUCK_SHOT;
      } else if (d.state === 'FALLING') {
        sprite = Math.floor(d.flapTimer * 2) % 2 === 0 ? DUCK_FLAP_UP : DUCK_FLAP_DOWN;
        flipX = Math.floor(d.flapTimer * 3) % 2 === 0;
      } else {
        sprite = Math.floor(d.flapTimer) % 2 === 0 ? DUCK_FLAP_UP : DUCK_FLAP_DOWN;
      }

      const palette = {
        G: d.isFast ? PALETTE.PINK : PALETTE.GREEN,
        B: d.isFast ? PALETTE.CYAN : '#92400E',
        W: PALETTE.WHITE,
        K: '#0B0F19',
        O: PALETTE.ORANGE
      };
      const scale = 4.2;
      const drawX = d.x - (sprite[0].length * scale) / 2;
      const drawY = d.y - (sprite.length * scale) / 2;
      this.renderer.drawPixelSprite(sprite, drawX, drawY, scale, palette, flipX, false);
    }

    // Draw Animated Hunting Dog popping up behind the grass
    if (this.dog.active && this.dog.yOffset > 2) {
      const dx = 480;
      const dy = this.grassY - this.dog.yOffset;
      ctx.save();
      ctx.translate(dx, dy);

      // Dog head & floppy ears
      ctx.fillStyle = '#D97706';
      ctx.fillRect(-22, 0, 44, 48);
      ctx.fillStyle = '#451A03';
      ctx.fillRect(-30, 4, 10, 26);
      ctx.fillRect(20, 4, 10, 26);

      // Eyes & snout
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(-12, 8, 8, 8);
      ctx.fillRect(4, 8, 8, 8);
      ctx.fillStyle = '#0B0F19';
      ctx.fillRect(-9, 10, 4, 4);
      ctx.fillRect(7, 10, 4, 4);
      ctx.fillRect(-5, 18, 10, 6);

      if (this.dog.mode === 'catch') {
        // Proud smile + holding caught duck(s) in paws!
        ctx.fillStyle = PALETTE.GREEN;
        ctx.fillRect(28, 8, 22, 16);
        ctx.fillStyle = PALETTE.ORANGE;
        ctx.fillRect(46, 12, 10, 6);
        if (this.dog.caughtCount > 1) {
          ctx.fillStyle = PALETTE.PINK;
          ctx.fillRect(-50, 8, 22, 16);
        }
        this.renderer.drawText(
          this.dog.caughtCount > 1 ? 'DOUBLE CATCH!' : 'GOOD DOG!',
          0,
          -12,
          { size: 13, color: PALETTE.GOLD, align: 'center', glow: 8 }
        );
      } else {
        // Chuckling dog shaking shoulders
        const bob = Math.sin(performance.now() * 0.03) * 4;
        ctx.fillStyle = PALETTE.PINK;
        ctx.fillRect(-8, 26 + bob, 16, 8);
        this.renderer.drawText('HEH HEH HEH!', 0, -12 + bob, {
          size: 13,
          color: PALETTE.ORANGE,
          align: 'center',
          glow: 6
        });
      }
      ctx.restore();
    }

    // Foreground Tall Grass Meadow
    ctx.fillStyle = '#15803D';
    ctx.fillRect(0, this.grassY, this.renderer.width, 540 - this.grassY);
    ctx.fillStyle = PALETTE.GREEN;
    for (let x = 0; x < 960; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, this.grassY);
      ctx.lineTo(x + 8, this.grassY - 16);
      ctx.lineTo(x + 16, this.grassY);
      ctx.fill();
    }

    // Bottom Arcade Control Dashboard (Shells & 10-Duck Round Tracker)
    ctx.fillStyle = '#090D16';
    ctx.fillRect(40, 452, 880, 66);
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 452, 880, 66);

    // 1. SHOT Shells Indicator
    this.renderer.drawText('SHOT', 68, 475, {
      font: FONTS.HEADER,
      size: 12,
      color: PALETTE.CYAN
    });
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < this.shells ? PALETTE.GOLD : '#1E293B';
      ctx.fillRect(68 + i * 22, 484, 12, 22);
      if (i < this.shells) {
        ctx.fillStyle = PALETTE.RED;
        ctx.fillRect(68 + i * 22, 496, 12, 10);
      }
    }

    // 2. HIT 10-Duck Status Tracker
    this.renderer.drawText('HIT QUOTA', 210, 492, {
      font: FONTS.HEADER,
      size: 12,
      color: PALETTE.GREEN
    });
    for (let i = 0; i < 10; i++) {
      const st = this.roundDuckResults[i];
      const col =
        st === 'hit' ? PALETTE.PINK : st === 'miss' ? PALETTE.MUTED : PALETTE.WHITE;
      this.renderer.drawGlowRect(350 + i * 34, 476, 22, 22, col, st === 'hit' ? 8 : 0);
    }

    this.renderer.drawText('CLICK/TAP OR Z/SPACE TO FIRE', 725, 490, {
      font: FONTS.HUD,
      size: 13,
      color: PALETTE.GOLD
    });

    // Draw Feathers & Floating Score Texts
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      this.renderer.drawText(ft.text, ft.x, ft.y, {
        size: 14,
        color: ft.color,
        align: 'center',
        glow: 6
      });
    }
    ctx.globalAlpha = 1;

    // Draw Shot Blast Rings
    for (const sm of this.shotMarkers) {
      ctx.globalAlpha = sm.life / 0.35;
      this.renderer.drawGlowCircle(sm.x, sm.y, 18 * (1 - sm.life), PALETTE.GOLD, 10, false, 2);
    }
    ctx.globalAlpha = 1;

    // Draw Light-Gun Targeting Reticle (Crosshair)
    const cx = this.crosshair.x;
    const cy = this.crosshair.y;
    this.renderer.drawGlowCircle(cx, cy, 18, PALETTE.PINK, 10, false, 2);
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 24, cy);
    ctx.lineTo(cx - 6, cy);
    ctx.moveTo(cx + 6, cy);
    ctx.lineTo(cx + 24, cy);
    ctx.moveTo(cx, cy - 24);
    ctx.lineTo(cx, cy - 6);
    ctx.moveTo(cx, cy + 6);
    ctx.lineTo(cx, cy + 24);
    ctx.stroke();
    this.renderer.drawGlowCircle(cx, cy, 3, PALETTE.GOLD, 6);

    // Top HUD
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `SHELLS:${this.shells}`,
      accent: PALETTE.GREEN
    });

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: 'LIGHT-GUN ZAPPER EDITION',
      controls: 'MOUSE/TAP OR ARROWS: AIM CROSSHAIR  |  CLICK/Z/SPACE: FIRE SHOTGUN',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GREEN
    });
  }
}

export default DuckHunt;
