/**
 * DuckHunt.js
 * Light-Gun Arcade Shooter
 * Supports both Mouse/Touch click/tap at pointer coordinates AND D-Pad/Arrow crosshair aiming + Action A fire!
 * Features 3 shotgun shells per wave, muzzle flash, dynamic bouncing ducks with wing-flap animations,
 * falling spun ducks on hit, and the iconic hunting dog holding caught ducks or chuckling on a miss!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const DUCK_FLAP_UP = [
  '......GGGG....',
  '.....GGGGWW...',
  '.....GGGGKBO..',
  '.....GGGGGOOO.',
  '..WWWWGGGG....',
  '.RRRRRRBBBB...',
  'RRRRRRRRBBBB..',
  '.RRRR..BBBBBB.',
  '........BBBB..',
  '......OO..OO..'
];

const DUCK_FLAP_MID = [
  '......GGGG....',
  '.....GGGGWW...',
  '.....GGGGKBO..',
  '.....GGGGGOOO.',
  '.....WWWWG....',
  '..BBBBBBBBBB..',
  '.RRRRRRRRBBBB.',
  '..RRRRR..BBBB.',
  '.........BBB..',
  '......OO..OO..'
];

const DUCK_FLAP_DOWN = [
  '......GGGG....',
  '.....GGGGWW...',
  '.....GGGGKBO..',
  '.....GGGGGOOO.',
  '.....WWWWG....',
  '...BBBBBBBB...',
  '..BBBBBBBBBB..',
  '.RRRRR..RRRRR.',
  'RRRR......RRRR',
  '......OO..OO..'
];

const DUCK_SHOT = [
  '....GGGGGG....',
  '...GGWWWWGG...',
  '...GWKWWKWG...',
  '...GGWWWWGG...',
  '....GGOOGG....',
  'RRRRWWWWWWRRRR',
  '.RRRRBBBBBRRR.',
  '..BBBBBBBBBB..',
  '...OO....OO...',
  '..............'
];

const DOG_CATCH_SPRITE = [
  '..KKKK........KKKK..',
  '.KDDDDK.TTTT.KDDDDK.',
  'KDDDDDDTTTTTTDDDDDDK',
  'KDDDDDTTTTTTTTDDDDDK',
  'KDDDDTTWWTTWWTTDDDDK',
  'KDDDDTTWKTTKWTTDDDDK',
  '.KDDDTTWWTTWWTTDDDK.',
  '..KDDTTTKKKKTTTDK...',
  '...TTTTWWKKKKWWTTTT.',
  '..TTTTWWWWWWWWWWTTTT',
  '..TTTTWWKKKKKKWWTTTT',
  '...TTTTWWWWWWWWTTTT.',
  '..TTTTTTTTTTTTTTTT..',
  '.TTTTTTTTTTTTTTTTTT.'
];

const DOG_LAUGH_SPRITE = [
  '..KKKK........KKKK..',
  '.KDDDDK.TTTT.KDDDDK.',
  'KDDDDDDTTTTTTDDDDDDK',
  'KDDDDDTTTTTTTTDDDDDK',
  'KDDDDTTKKTTKKTTDDDDK',
  'KDDDDTTTTTTTTTTDDDDK',
  '.KDDDTTTTKKKKTTDDDK.',
  '..KDDTTWWWWWWWWTDK..',
  '...TTTTWWKKKKWWTTTT.',
  '....TTTWWKPPKWWTTT..',
  '....TTTWWWWWWWWTTT..',
  '...TTTTTTTTTTTTTTTT.',
  '..TTTTTTTTTTTTTTTTTT',
  '.TTTTTTTTTTTTTTTTTT.'
];

export class DuckHunt {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'duckhunt';
    this.title = 'Duck Hunt';
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
    // 1984 Nintendo Sky-Blue Daytime Hunting Backdrop (#38BDF8 sky, turning warm orange/pink on FLY AWAY!)
    if (this.flyAway) {
      const skyGrad = ctx.createLinearGradient(0, 38, 0, this.grassY);
      skyGrad.addColorStop(0, '#FB7185');
      skyGrad.addColorStop(1, '#FDBA74');
      ctx.fillStyle = skyGrad;
    } else {
      ctx.fillStyle = '#38BDF8';
    }
    ctx.fillRect(0, 38, this.renderer.width, this.grassY - 38);

    // Muzzle Flash White-Out Frame
    if (this.muzzleFlashTimer > 0) {
      ctx.fillStyle = 'rgba(248, 250, 252, 0.78)';
      ctx.fillRect(0, 38, this.renderer.width, this.renderer.height - 38);
    }

    // Classic Pixel-Art Deciduous Tree on the Left (x = 120)
    const treeX = 120;
    // Gnarled brown bark trunk, roots, and branches
    ctx.fillStyle = '#78350F';
    ctx.fillRect(treeX - 16, this.grassY - 155, 32, 155);
    ctx.fillRect(treeX - 26, this.grassY - 18, 52, 18); // Roots
    ctx.fillRect(treeX - 42, this.grassY - 115, 28, 12); // Left branch
    ctx.fillRect(treeX + 14, this.grassY - 128, 30, 12); // Right branch
    // Bark highlights
    ctx.fillStyle = '#B45309';
    ctx.fillRect(treeX - 8, this.grassY - 150, 8, 145);
    ctx.fillRect(treeX + 4, this.grassY - 120, 5, 110);

    // Multi-layered Pixel-Art Deciduous Canopy Clusters
    const canopyClusters = [
      { dx: 0, dy: -195, w: 96, h: 52, col: '#14532D' },
      { dx: -44, dy: -162, w: 72, h: 44, col: '#14532D' },
      { dx: 44, dy: -168, w: 76, h: 46, col: '#14532D' },
      { dx: 0, dy: -202, w: 84, h: 44, col: '#15803D' },
      { dx: -38, dy: -168, w: 62, h: 38, col: '#16A34A' },
      { dx: 38, dy: -174, w: 66, h: 38, col: '#16A34A' },
      { dx: -12, dy: -210, w: 54, h: 26, col: '#4ADE80' },
      { dx: 24, dy: -182, w: 36, h: 20, col: '#4ADE80' }
    ];
    for (const c of canopyClusters) {
      ctx.fillStyle = c.col;
      ctx.fillRect(treeX + c.dx - c.w / 2, this.grassY + c.dy, c.w, c.h);
    }
    // Classic red/orange autumn leaf pixel accents on canopy
    ctx.fillStyle = '#FACC15';
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(treeX - 48 + (i * 15) % 92, this.grassY - 200 + (i * 19) % 55, 6, 6);
    }

    // Classic Pixel-Art Bush on the Right (x = 780)
    const bushX = 780;
    ctx.fillStyle = '#14532D';
    ctx.fillRect(bushX - 48, this.grassY - 54, 96, 54);
    ctx.fillRect(bushX - 36, this.grassY - 68, 72, 20);
    ctx.fillStyle = '#16A34A';
    ctx.fillRect(bushX - 42, this.grassY - 50, 84, 42);
    ctx.fillRect(bushX - 28, this.grassY - 64, 56, 18);
    ctx.fillStyle = '#86EFAC';
    ctx.fillRect(bushX - 22, this.grassY - 60, 44, 10);
    ctx.fillRect(bushX - 34, this.grassY - 42, 26, 10);
    // Pixel berries on bush
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(bushX - 26, this.grassY - 32, 5, 5);
    ctx.fillRect(bushX + 18, this.grassY - 38, 5, 5);
    ctx.fillRect(bushX + 2, this.grassY - 52, 5, 5);

    if (this.flyAway) {
      ctx.fillStyle = '#090D16';
      ctx.fillRect(380, 98, 200, 42);
      ctx.strokeStyle = PALETTE.WHITE;
      ctx.lineWidth = 2;
      ctx.strokeRect(380, 98, 200, 42);
      this.renderer.drawText('FLY AWAY!', 480, 126, {
        font: FONTS.HEADER,
        size: 20,
        color: PALETTE.WHITE,
        align: 'center',
        glow: 10
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
        sprite = Math.floor(d.flapTimer * 2) % 2 === 0 ? DUCK_FLAP_DOWN : DUCK_FLAP_MID;
        flipX = Math.floor(d.flapTimer * 3) % 2 === 0;
      } else {
        const frame = Math.floor(d.flapTimer) % 4;
        sprite = frame === 0 ? DUCK_FLAP_UP : frame === 2 ? DUCK_FLAP_DOWN : DUCK_FLAP_MID;
      }

      // 3 Iconic NES Duck Varieties:
      // 1. Green-Headed Mallard (Green head, chestnut wings, tan body)
      // 2. Blue/Magenta Fast Duck (Blue head, magenta wings, cyan body)
      // 3. Red Bonus Duck (Crimson head, black/red wings, gold collar)
      const isRedBonus = d.isFast && d.slotIndex % 2 === 1;
      const palette = isRedBonus
        ? {
            G: '#EF4444', // Red head
            R: '#991B1B', // Deep crimson wing feathers
            B: '#1E293B', // Dark slate/black body
            W: '#FEF08A', // Gold/white neck ring & eye whites
            K: '#090D16',
            O: '#FACC15'  // Bright yellow beak & feet
          }
        : d.isFast
        ? {
            G: '#2563EB', // Royal blue head
            R: '#EC4899', // Magenta flapping wings
            B: '#38BDF8', // Sky-blue plumage
            W: '#FFFFFF',
            K: '#090D16',
            O: '#FACC15'
          }
        : {
            G: '#15803D', // Classic Mallard emerald green head
            R: '#9A3412', // Chestnut brown wing feathers
            B: '#451A03', // Dark brown body
            W: '#FFFFFF', // Crisp white neck ring & shocked eyes
            K: '#090D16',
            O: '#FACC15'  // Yellow bill & webbed feet
          };

      const scale = 3.6;
      const drawX = d.x - (sprite[0].length * scale) / 2;
      const drawY = d.y - (sprite.length * scale) / 2;
      this.renderer.drawPixelSprite(sprite, drawX, drawY, scale, palette, flipX, false);
    }

    // Draw Animated Pixel-Art Hunting Dog popping up behind the grass
    if (this.dog.active && this.dog.yOffset > 2) {
      const dx = 480;
      const dy = this.grassY - this.dog.yOffset - 6;
      const bob = this.dog.mode === 'laugh' ? Math.sin(performance.now() * 0.035) * 4 : 0;
      ctx.save();
      ctx.translate(dx, dy + bob);

      const dogSprite = this.dog.mode === 'catch' ? DOG_CATCH_SPRITE : DOG_LAUGH_SPRITE;
      const dogScale = 3.2;
      const dogPalette = {
        T: '#D97706', // Warm tan hound fur
        D: '#451A03', // Floppy dark brown ears
        W: '#FFFFFF', // White muzzle & eyes
        K: '#090D16', // Black nose & pupils
        P: '#FB7185'  // Pink tongue
      };
      this.renderer.drawPixelSprite(
        dogSprite,
        -(dogSprite[0].length * dogScale) / 2,
        0,
        dogScale,
        dogPalette,
        false,
        false
      );

      if (this.dog.mode === 'catch') {
        // Proudly holding up feathered duck(s) in paws!
        // Right paw duck (Mallard)
        ctx.fillStyle = '#D97706';
        ctx.fillRect(28, 18, 12, 10); // Paw
        ctx.fillStyle = '#9A3412';
        ctx.fillRect(34, 4, 20, 18); // Feathered body
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(38, 0, 12, 4); // Neck ring
        ctx.fillStyle = '#15803D';
        ctx.fillRect(38, -10, 14, 10); // Mallard green head
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(42, -16, 6, 6); // Yellow bill

        if (this.dog.caughtCount > 1) {
          // Left paw second duck (Blue/Magenta duck)
          ctx.fillStyle = '#D97706';
          ctx.fillRect(-40, 18, 12, 10);
          ctx.fillStyle = '#EC4899';
          ctx.fillRect(-54, 4, 20, 18);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(-50, 0, 12, 4);
          ctx.fillStyle = '#2563EB';
          ctx.fillRect(-52, -10, 14, 10);
          ctx.fillStyle = '#FACC15';
          ctx.fillRect(-48, -16, 6, 6);
        }
        this.renderer.drawText(
          this.dog.caughtCount > 1 ? 'DOUBLE CATCH!' : 'GOOD DOG!',
          0,
          -18,
          { size: 13, color: '#FEF08A', align: 'center', glow: 8 }
        );
      } else {
        // Laughing paws shaking at shoulders
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-18, 34, 10, 8);
        ctx.fillRect(8, 34, 10, 8);
        this.renderer.drawText('HEH HEH HEH!', 0, -14, {
          size: 13,
          color: '#FEF08A',
          align: 'center',
          glow: 6
        });
      }
      ctx.restore();
    }

    // Foreground Tall Green Grass Meadow & Earth Band
    ctx.fillStyle = '#14532D';
    ctx.fillRect(0, this.grassY, this.renderer.width, 540 - this.grassY);
    ctx.fillStyle = '#16A34A';
    ctx.fillRect(0, this.grassY, this.renderer.width, 28);
    // Multi-tone tall pixel grass blades
    for (let x = 0; x < 960; x += 12) {
      ctx.fillStyle = x % 24 === 0 ? '#4ADE80' : '#22C55E';
      ctx.beginPath();
      ctx.moveTo(x, this.grassY + 8);
      ctx.lineTo(x + 6, this.grassY - 18 - (x % 3) * 4);
      ctx.lineTo(x + 12, this.grassY + 8);
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
