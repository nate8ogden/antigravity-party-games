/**
 * RollingThunder.js
 * Classic 1986 Namco / Atari Games Espionage Platform Shooter.
 * Original Arcade Soundtrack composed by Junko Ozawa on Namco System 86.
 *
 * Features:
 * - Secret Agent Albatross (WCPO Rolling Thunder espionage unit) in iconic trenchcoat
 * - Multi-tiered Geldra secret base (upper catwalk railings and lower floor levels)
 * - Super Jump & Catwalk Leaping: leap to upper railings or drop down between tiers
 * - Tactical Door System: enter doorways for concealment from enemy fire;
 *   find "BULLETS" doors (+ammo) and "ARMS" doors (fully-automatic Submachine Gun!)
 * - Geldra Terrorist Syndicate: Green Grunt Maskers, Pink Grenadiers, Yellow Jumpers,
 *   Black Elite Machine Gunners, Gelzo Mutant Bats, and charging Guard Panthers
 * - Semi-auto pistol with authentic empty-chamber dry fire + full-auto SMG bullet streams
 * - 2-hit health gauge, 120s mission timer, and Leila Blitz rescue finale!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const TIER_LOWER_Y = 440;
const TIER_UPPER_Y = 265;
const GRAVITY = 720;
const STAGE_LENGTH = 3800;

export class RollingThunder {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'rollingthunder';
    this.title = 'Rolling Thunder';
    this.width = 960;
    this.height = 540;

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.timer = 120;

    this.cameraX = 0;
    this.player = {
      x: 120,
      y: TIER_LOWER_Y,
      vx: 0,
      vy: 0,
      dir: 1,
      tier: 'lower', // 'lower' | 'upper'
      onGround: true,
      crouching: false,
      inDoor: false,
      doorRef: null,
      invuln: 0,
      health: 2, // 2-hit health gauge
      weapon: 'PISTOL', // 'PISTOL' | 'MACHINEGUN'
      ammo: 45,
      dryFireTimer: 0,
      fireCooldown: 0,
      walkFrame: 0,
      dead: false,
      respawnTimer: 0
    };

    this.bullets = [];
    this.enemyBullets = [];
    this.grenades = [];
    this.firePatches = [];
    this.enemies = [];
    this.particles = [];
    this.popups = [];
    this.doors = [];
    this.catwalks = [];

    this._generateStage(this.level);
  }

  setState(state) {
    this.state = state;
  }

  destroy() {
    if (this.audio) {
      this.audio.stopSequence();
    }
  }

  _generateStage(level) {
    this.doors = [];
    this.catwalks = [];
    this.enemies = [];

    // Continuous upper catwalk segments with tactical gaps
    const catwalkSegments = [
      { startX: 200, endX: 780 },
      { startX: 920, endX: 1620 },
      { startX: 1780, endX: 2480 },
      { startX: 2620, endX: 3420 }
    ];

    for (const seg of catwalkSegments) {
      this.catwalks.push({
        x: seg.startX,
        y: TIER_UPPER_Y,
        w: seg.endX - seg.startX,
        h: 16
      });
    }

    // Infiltration Doors along both upper and lower levels
    const doorTypes = ['PLAIN', 'BULLETS', 'PLAIN', 'ARMS', 'PLAIN', 'BULLETS', 'PLAIN'];
    let doorIdx = 0;

    for (let x = 320; x < STAGE_LENGTH - 400; x += 220 + Math.floor(Math.sin(x) * 40)) {
      const isUpper = x > 380 && (x % 500 < 250);
      const y = isUpper ? TIER_UPPER_Y : TIER_LOWER_Y;
      const type = doorTypes[doorIdx % doorTypes.length];
      doorIdx++;

      this.doors.push({
        x,
        y,
        w: 52,
        h: 74,
        type, // 'PLAIN' | 'BULLETS' | 'ARMS'
        looted: false,
        occupiedByEnemy: false
      });
    }

    // Final Holding Cell Door for Leila Blitz at stage end
    this.doors.push({
      x: STAGE_LENGTH - 180,
      y: TIER_LOWER_Y,
      w: 64,
      h: 80,
      type: 'LEILA_CELL',
      looted: false,
      occupiedByEnemy: false
    });

    // Enemy Patrols & Ambushes
    for (let x = 450; x < STAGE_LENGTH - 300; x += 190 + Math.random() * 80) {
      const onUpper = x > 300 && Math.random() < 0.45;
      const y = onUpper ? TIER_UPPER_Y : TIER_LOWER_Y;
      const roll = Math.random();
      let enemyType = 'GREEN_MASKER';

      if (roll < 0.28) enemyType = 'GREEN_MASKER'; // Standard pistol patrol
      else if (roll < 0.52) enemyType = 'PINK_MASKER'; // Grenadier
      else if (roll < 0.74) enemyType = 'YELLOW_MASKER'; // Leaping ambusher
      else if (roll < 0.88) enemyType = 'BLACK_MASKER'; // Elite SMG rapid-fire
      else if (roll < 0.95 && !onUpper) enemyType = 'PANTHER'; // Fast ground beast
      else enemyType = 'GELZO_BAT'; // Ceiling mutant bat

      this.enemies.push(this._createEnemy(enemyType, x, y));
    }
  }

  _createEnemy(type, x, y) {
    const base = {
      type,
      x,
      y: type === 'GELZO_BAT' ? y - 110 : y,
      vx: type === 'PANTHER' ? -210 : -75 - Math.random() * 30,
      vy: 0,
      dir: -1,
      tier: y === TIER_UPPER_Y ? 'upper' : 'lower',
      shootTimer: 1.2 + Math.random() * 1.5,
      jumpTimer: 2.0 + Math.random() * 2.5,
      health: type === 'BLACK_MASKER' ? 2 : 1,
      walkFrame: 0,
      onGround: true,
      active: false
    };

    switch (type) {
      case 'GREEN_MASKER':
        base.color = '#22C55E';
        base.pts = 100;
        break;
      case 'PINK_MASKER':
        base.color = '#EC4899';
        base.pts = 150;
        break;
      case 'YELLOW_MASKER':
        base.color = '#EAB308';
        base.pts = 200;
        break;
      case 'BLACK_MASKER':
        base.color = '#334155';
        base.pts = 300;
        break;
      case 'PANTHER':
        base.color = '#0F172A';
        base.pts = 250;
        break;
      case 'GELZO_BAT':
        base.color = '#8B5CF6';
        base.pts = 200;
        base.baseY = y - 100;
        base.sineAngle = Math.random() * Math.PI * 2;
        break;
    }
    return base;
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

  _firePlayerWeapon() {
    const p = this.player;
    if (p.dead || p.inDoor) return;

    if (p.ammo <= 0) {
      // Empty chamber dry fire with audible click
      if (p.dryFireTimer <= 0) {
        this.audio.playNote(300, 0.04, 'triangle', 0.15);
        p.dryFireTimer = 0.35;
      }
      return;
    }

    const isSMG = p.weapon === 'MACHINEGUN';
    const cooldown = isSMG ? 0.095 : 0.22;
    if (p.fireCooldown > 0) return;

    p.fireCooldown = cooldown;
    p.ammo--;

    const bulletY = p.crouching ? p.y - 18 : p.y - 42;
    const bulletX = p.x + p.dir * 28;

    this.bullets.push({
      x: bulletX,
      y: bulletY,
      vx: p.dir * 880,
      isSMG,
      life: 1.1
    });

    if (isSMG) {
      this.audio.playNote(920 + Math.random() * 120, 0.05, 'sawtooth', 0.22);
    } else {
      this.audio.playExplosion(0.12, 1400);
    }

    this.renderer.shake(isSMG ? 2 : 4, 0.08);

    // Muzzle flash particle
    this.particles.push({
      x: bulletX,
      y: bulletY,
      vx: p.dir * 40,
      vy: (Math.random() - 0.5) * 30,
      color: PALETTE.GOLD,
      size: 5,
      life: 0.08
    });
  }

  _killPlayer() {
    const p = this.player;
    if (p.dead || p.invuln > 0) return;

    p.health--;
    p.invuln = 1.6;
    this.audio.playHit();
    this.renderer.shake(8, 0.25);

    if (p.health <= 0) {
      p.dead = true;
      p.respawnTimer = 2.0;
      this.lives--;
      this.audio.playExplosion(0.45, 800);

      // Spawn dramatic red defeat feathers/particles
      for (let i = 0; i < 18; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 180;
        this.particles.push({
          x: p.x,
          y: p.y - 30,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          color: i % 2 === 0 ? '#78350F' : PALETTE.RED,
          size: 4,
          life: 0.5 + Math.random() * 0.4
        });
      }

      if (this.lives <= 0) {
        HighScoreStore.submit(this.id, this.score);
      }
    }
  }

  update(dt) {
    if (this.state === 'MENU') {
      if (
        this.input.isJustPressed('actionA') ||
        this.input.isJustPressed('actionB') ||
        this.input.isJustPressed('any')
      ) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.state === 'PAUSED') {
      if (this.input.isJustPressed('actionA') || this.input.isJustPressed('pause')) {
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.state === 'GAMEOVER') {
      if (
        this.input.isJustPressed('actionA') ||
        this.input.isJustPressed('actionB') ||
        this.input.isJustPressed('any') ||
        this.input.pointer?.justPressed
      ) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'PLAYING';
      }
      return;
    }

    // Mission Countdown Timer
    this.timer = Math.max(0, this.timer - dt);
    if (this.timer <= 0 && !this.player.dead) {
      this._killPlayer();
    }

    const p = this.player;

    // Respawn / Game Over Check
    if (p.dead) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) {
        if (this.lives <= 0) {
          this.state = 'GAMEOVER';
          this.audio.playGameOver();
          return;
        }
        // Respawn Albatross safely on lower tier
        p.dead = false;
        p.health = 2;
        p.invuln = 2.2;
        p.x = Math.max(100, this.cameraX + 100);
        p.y = TIER_LOWER_Y;
        p.vx = 0;
        p.vy = 0;
        p.onGround = true;
        p.inDoor = false;
        p.weapon = 'PISTOL';
        p.ammo = 35;
      }
    } else {
      if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
      if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt);
      if (p.dryFireTimer > 0) p.dryFireTimer = Math.max(0, p.dryFireTimer - dt);

      // Door Concealment & Looting Logic
      const nearDoor = this.doors.find(
        (d) => Math.abs(d.x - p.x) < 26 && Math.abs(d.y - p.y) < 18
      );

      if (this.input.isJustPressed('up') && nearDoor && !p.inDoor && p.onGround) {
        // Step into doorway cover!
        p.inDoor = true;
        p.doorRef = nearDoor;
        p.vx = 0;
        this.audio.playNote(480, 0.06, 'triangle', 0.2);

        // Loot ammo / machine gun from specialty doors
        if (!nearDoor.looted) {
          nearDoor.looted = true;
          if (nearDoor.type === 'BULLETS') {
            p.ammo += 30;
            this.audio.playCoin();
            this._addScore(500, nearDoor.x, nearDoor.y - 80, '+30 BULLETS!', PALETTE.GOLD);
          } else if (nearDoor.type === 'ARMS') {
            p.weapon = 'MACHINEGUN';
            p.ammo += 60;
            this.audio.playPowerUp();
            this._addScore(1000, nearDoor.x, nearDoor.y - 80, 'MACHINE GUN!!', PALETTE.CYAN);
          } else if (nearDoor.type === 'LEILA_CELL') {
            // Stage Clear Rescue Finale!
            this.audio.playStageClear();
            this._addScore(5000, nearDoor.x, nearDoor.y - 90, 'LEILA RESCUED! +5000', PALETTE.GREEN);
            this.level++;
            this.timer = 120;
            p.inDoor = false;
            p.x = 120;
            p.y = TIER_LOWER_Y;
            this.cameraX = 0;
            this._generateStage(this.level);
            return;
          }
        }
      } else if (p.inDoor) {
        // Exit door when pressing down, left, right, or shooting
        if (
          this.input.isJustPressed('down') ||
          this.input.isJustPressed('actionA') ||
          this.input.isJustPressed('actionB') ||
          Math.abs(this.input.getAxis().x) > 0.4
        ) {
          p.inDoor = false;
          p.doorRef = null;
          this.audio.playNote(380, 0.05, 'triangle', 0.18);
        }
      }

      // Horizontal Movement (when not taking cover in a door)
      if (!p.inDoor) {
        p.crouching = this.input.isDown('down') && p.onGround;

        let moveDir = 0;
        if (this.input.isDown('left')) moveDir -= 1;
        if (this.input.isDown('right')) moveDir += 1;

        if (moveDir !== 0 && !p.crouching) {
          p.dir = moveDir;
          p.vx = moveDir * 240;
          p.walkFrame += dt * 9;
        } else {
          p.vx = 0;
          p.walkFrame = 0;
        }

        // Catwalk Drop Down: Down + Jump drops through upper railing to lower floor
        const dropPressed =
          this.input.isDown('down') &&
          (this.input.isJustPressed('actionB') ||
            this.input.isJustPressed('jump') ||
            this.input.isKeyJustPressed('KeyX'));

        if (dropPressed && p.onGround && p.y <= TIER_UPPER_Y + 10) {
          p.y += 18;
          p.vy = 120;
          p.onGround = false;
          this.audio.playHop();
        } else {
          // Normal & High Catwalk Leaps
          const jumpPressed =
            this.input.isJustPressed('actionB') ||
            this.input.isJustPressed('jump') ||
            this.input.isKeyJustPressed('KeyX') ||
            (this.input.isJustPressed('up') && !nearDoor);

          if (jumpPressed && p.onGround) {
            // Super Leap if holding UP to reach high catwalk railing!
            const highJump = this.input.isDown('up');
            p.vy = highJump ? -530 : -390;
            p.onGround = false;
            this.audio.playHop();
          }
        }

        // Firing Weapons (Action A, Z, Space, Pointer Click, or Auto-Fire for SMG)
        const isSMG = p.weapon === 'MACHINEGUN';
        const shootInput = isSMG
          ? this.input.isDown('actionA') ||
            this.input.isKeyDown('KeyZ') ||
            this.input.isKeyDown('Space') ||
            this.input.pointer?.isDown
          : this.input.isJustPressed('actionA') ||
            this.input.isKeyJustPressed('KeyZ') ||
            this.input.isKeyJustPressed('Space') ||
            this.input.pointer?.justPressed;

        if (shootInput) {
          this._firePlayerWeapon();
        }
      }

      // Gravity & Vertical Physics
      if (!p.onGround) {
        p.vy += GRAVITY * dt;
        p.y += p.vy * dt;
      }

      p.x += p.vx * dt;
      p.x = Math.max(40, Math.min(STAGE_LENGTH - 60, p.x));

      // Catwalk & Lower Floor Platform Collisions
      p.onGround = false;

      // Landing on upper catwalk railing
      if (p.vy >= 0 && p.y >= TIER_UPPER_Y && p.y <= TIER_UPPER_Y + 22) {
        const onCatwalk = this.catwalks.some(
          (c) => p.x >= c.x - 12 && p.x <= c.x + c.w + 12
        );
        if (onCatwalk) {
          p.y = TIER_UPPER_Y;
          p.vy = 0;
          p.onGround = true;
          p.tier = 'upper';
        }
      }

      // Landing on solid lower floor
      if (p.y >= TIER_LOWER_Y) {
        p.y = TIER_LOWER_Y;
        p.vy = 0;
        p.onGround = true;
        p.tier = 'lower';
      }

      // Smooth horizontal camera tracking
      const targetCamX = p.x - 380;
      this.cameraX += (targetCamX - this.cameraX) * 8 * dt;
      this.cameraX = Math.max(0, Math.min(STAGE_LENGTH - this.width, this.cameraX));
    }

    // Update Player Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < this.cameraX - 40 || b.x > this.cameraX + this.width + 40) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Bullet hit enemy check
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (!e.active) continue;
        const hitboxH = e.type === 'PANTHER' ? 24 : 54;
        const hitboxW = e.type === 'PANTHER' ? 44 : 26;

        if (
          Math.abs(b.x - e.x) < hitboxW &&
          b.y >= e.y - hitboxH &&
          b.y <= e.y + 6
        ) {
          e.health--;
          this.bullets.splice(i, 1);

          // Bullet spark particle
          this.particles.push({
            x: b.x,
            y: b.y,
            vx: -b.vx * 0.1,
            vy: (Math.random() - 0.5) * 80,
            color: PALETTE.GOLD,
            size: 3,
            life: 0.15
          });

          if (e.health <= 0) {
            this.audio.playExplosion(0.18, 1100);
            this._addScore(e.pts, e.x, e.y - 35, `+${e.pts}`, e.color);

            // Feathers / defeat burst
            for (let k = 0; k < 12; k++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = 40 + Math.random() * 120;
              this.particles.push({
                x: e.x,
                y: e.y - 20,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                color: e.color,
                size: 3,
                life: 0.35 + Math.random() * 0.25
              });
            }
            this.enemies.splice(j, 1);
          } else {
            this.audio.playHit();
          }
          break;
        }
      }
    }

    // Update Enemies (AI Patrol, Leaping & Shooting)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      // Activate enemies when near camera viewport
      if (!e.active) {
        if (e.x >= this.cameraX - 60 && e.x <= this.cameraX + this.width + 120) {
          e.active = true;
        } else {
          continue;
        }
      }

      // Gelzo Bat sinusoidal swoop
      if (e.type === 'GELZO_BAT') {
        e.sineAngle += dt * 4;
        e.x += e.vx * dt;
        e.y = e.baseY + Math.sin(e.sineAngle) * 55;
      } else if (e.type === 'PANTHER') {
        // Fast panther charge
        e.x += e.vx * dt;
      } else {
        // Masker Foot Soldier AI
        e.x += e.vx * dt;
        e.walkFrame += dt * 7;

        // Turn around at catwalk ends
        if (e.tier === 'upper') {
          const onCatwalk = this.catwalks.some(
            (c) => e.x >= c.x && e.x <= c.x + c.w
          );
          if (!onCatwalk) {
            e.vx = -e.vx;
            e.dir = e.vx > 0 ? 1 : -1;
          }
        }

        // Yellow Masker leaps between tiers to intercept player!
        if (e.type === 'YELLOW_MASKER') {
          e.jumpTimer -= dt;
          if (e.jumpTimer <= 0 && e.onGround) {
            e.jumpTimer = 2.2 + Math.random() * 2;
            e.vy = e.tier === 'lower' ? -490 : -280;
            e.onGround = false;
          }
        }

        // Masker Weapon Attacks
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && Math.abs(e.x - p.x) < 460) {
          e.shootTimer = e.type === 'BLACK_MASKER' ? 1.6 : 2.2 + Math.random() * 1.5;
          e.dir = p.x < e.x ? -1 : 1;

          if (e.type === 'PINK_MASKER') {
            // Throw Arcing Grenade / Molotov
            this.grenades.push({
              x: e.x,
              y: e.y - 36,
              vx: e.dir * (180 + Math.random() * 80),
              vy: -260,
              life: 1.2
            });
            this.audio.playHop();
          } else {
            // Shoot Pistol / SMG bullet
            const count = e.type === 'BLACK_MASKER' ? 2 : 1;
            for (let c = 0; c < count; c++) {
              this.enemyBullets.push({
                x: e.x + e.dir * 22,
                y: e.y - 36,
                vx: e.dir * (380 + c * 40),
                life: 1.6
              });
            }
            this.audio.playNote(220, 0.06, 'sawtooth', 0.16);
          }
        }

        // Enemy Gravity & Landing
        if (!e.onGround) {
          e.vy += GRAVITY * dt;
          e.y += e.vy * dt;

          if (e.vy >= 0 && e.y >= TIER_UPPER_Y && e.y <= TIER_UPPER_Y + 20) {
            const onCatwalk = this.catwalks.some(
              (c) => e.x >= c.x && e.x <= c.x + c.w
            );
            if (onCatwalk) {
              e.y = TIER_UPPER_Y;
              e.vy = 0;
              e.onGround = true;
              e.tier = 'upper';
            }
          }
          if (e.y >= TIER_LOWER_Y) {
            e.y = TIER_LOWER_Y;
            e.vy = 0;
            e.onGround = true;
            e.tier = 'lower';
          }
        }
      }

      // Contact Damage with Player
      if (
        !p.dead &&
        !p.inDoor &&
        Math.abs(p.x - e.x) < 32 &&
        Math.abs(p.y - e.y) < 38
      ) {
        this._killPlayer();
      }
    }

    // Update Enemy Bullets
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const eb = this.enemyBullets[i];
      eb.x += eb.vx * dt;
      eb.life -= dt;
      if (eb.life <= 0 || eb.x < this.cameraX - 40 || eb.x > this.cameraX + this.width + 40) {
        this.enemyBullets.splice(i, 1);
        continue;
      }

      // Hit Player check (bullets pass harmlessly if player is ducked in a door!)
      if (!p.dead && !p.inDoor) {
        const playerH = p.crouching ? 28 : 56;
        if (
          Math.abs(eb.x - p.x) < 22 &&
          eb.y >= p.y - playerH &&
          eb.y <= p.y + 4
        ) {
          this.enemyBullets.splice(i, 1);
          this._killPlayer();
        }
      }
    }

    // Update Grenades
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.vy += GRAVITY * dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.life -= dt;

      // Grenade explosion on ground impact
      if (g.y >= TIER_LOWER_Y || g.life <= 0) {
        this.audio.playExplosion(0.24, 600);
        this.renderer.shake(5, 0.15);

        // Spawn burning fire patch
        this.firePatches.push({
          x: g.x,
          y: TIER_LOWER_Y,
          life: 2.2
        });

        // Fire explosion particles
        for (let k = 0; k < 14; k++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 30 + Math.random() * 90;
          this.particles.push({
            x: g.x,
            y: TIER_LOWER_Y - 8,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 30,
            color: k % 2 === 0 ? PALETTE.ORANGE : PALETTE.RED,
            size: 4,
            life: 0.4
          });
        }

        this.grenades.splice(i, 1);
      }
    }

    // Update Fire Patches
    for (let i = this.firePatches.length - 1; i >= 0; i--) {
      const fp = this.firePatches[i];
      fp.life -= dt;
      if (fp.life <= 0) {
        this.firePatches.splice(i, 1);
        continue;
      }

      if (!p.dead && !p.inDoor && Math.abs(p.x - fp.x) < 28 && p.y >= TIER_LOWER_Y - 10) {
        this._killPlayer();
      }
    }

    // Update Particles & Popups
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 26 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear('#0B0F19');

    ctx.save();
    ctx.translate(-this.cameraX, 0);

    // =========================================================================
    // 1. BACKGROUND SCENERY (Geldra Subterranean Base / Warehouses)
    // =========================================================================
    // Steel girders & underground cavern backdrop
    ctx.fillStyle = '#111827';
    ctx.fillRect(this.cameraX, 40, this.width, 500);

    // Distant vertical support pillars & wall conduits
    ctx.fillStyle = '#1E293B';
    for (let x = Math.floor(this.cameraX / 140) * 140; x < this.cameraX + this.width + 140; x += 140) {
      ctx.fillRect(x, 40, 24, 460);
      ctx.fillStyle = '#334155';
      ctx.fillRect(x + 8, 40, 8, 460);
      ctx.fillStyle = '#1E293B';
    }

    // Overhead industrial pipes & fluorescent strip lights
    for (let x = Math.floor(this.cameraX / 180) * 180; x < this.cameraX + this.width + 180; x += 180) {
      this.renderer.drawGlowRect(x, 52, 60, 4, PALETTE.CYAN, 8, true);
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(x, 52, 60, 4);
    }

    // =========================================================================
    // 2. TACTICAL DOORS (Plain, Bullets, Arms, and Leila's Cell)
    // =========================================================================
    for (const d of this.doors) {
      if (d.x < this.cameraX - 80 || d.x > this.cameraX + this.width + 80) continue;

      ctx.save();
      // Door frame & recess
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(d.x - d.w / 2, d.y - d.h, d.w, d.h);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.strokeRect(d.x - d.w / 2, d.y - d.h, d.w, d.h);

      // Door panels (recessed dark interior when player is hiding inside!)
      const isPlayerInside = this.player.inDoor && this.player.doorRef === d;
      if (isPlayerInside) {
        ctx.fillStyle = '#020617';
        ctx.fillRect(d.x - d.w / 2 + 4, d.y - d.h + 4, d.w - 8, d.h - 4);
      } else {
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(d.x - d.w / 2 + 4, d.y - d.h + 4, d.w - 8, d.h - 4);
        ctx.fillStyle = '#334155';
        ctx.fillRect(d.x - d.w / 2 + 8, d.y - d.h + 8, d.w - 16, 22);
        ctx.fillRect(d.x - d.w / 2 + 8, d.y - d.h + 36, d.w - 16, 30);
      }

      // Overhead Signboard
      if (d.type === 'BULLETS') {
        ctx.fillStyle = '#B45309';
        ctx.fillRect(d.x - 30, d.y - d.h - 16, 60, 14);
        this.renderer.drawText('BULLETS', d.x, d.y - d.h - 6, {
          font: FONTS.HEADER,
          size: 8,
          color: PALETTE.GOLD,
          align: 'center',
          glow: d.looted ? 0 : 6
        });
      } else if (d.type === 'ARMS') {
        ctx.fillStyle = '#0E7490';
        ctx.fillRect(d.x - 26, d.y - d.h - 16, 52, 14);
        this.renderer.drawText('ARMS', d.x, d.y - d.h - 6, {
          font: FONTS.HEADER,
          size: 8,
          color: PALETTE.CYAN,
          align: 'center',
          glow: d.looted ? 0 : 8
        });
      } else if (d.type === 'LEILA_CELL') {
        ctx.fillStyle = '#991B1B';
        ctx.fillRect(d.x - 32, d.y - d.h - 18, 64, 16);
        this.renderer.drawText('LEILA CELL', d.x, d.y - d.h - 6, {
          font: FONTS.HEADER,
          size: 8,
          color: PALETTE.PINK,
          align: 'center',
          glow: 10
        });
      }
      ctx.restore();
    }

    // =========================================================================
    // 3. MULTI-TIER PLATFORMS & CATWALK RAILINGS
    // =========================================================================
    // Upper Catwalks
    for (const c of this.catwalks) {
      if (c.x + c.w < this.cameraX - 40 || c.x > this.cameraX + this.width + 40) continue;

      ctx.save();
      // Grated steel platform slab
      ctx.fillStyle = '#334155';
      ctx.fillRect(c.x, c.y, c.w, c.h);

      // Warning hazard stripe edge
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(c.x, c.y, c.w, 3);

      // Safety railing posts
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 2;
      for (let rx = c.x + 8; rx < c.x + c.w; rx += 28) {
        ctx.beginPath();
        ctx.moveTo(rx, c.y);
        ctx.lineTo(rx, c.y - 18);
        ctx.stroke();
      }
      // Top horizontal handrail
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - 18);
      ctx.lineTo(c.x + c.w, c.y - 18);
      ctx.stroke();

      ctx.restore();
    }

    // Lower Main Floor (Solid reinforced concrete & hazard border)
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(this.cameraX, TIER_LOWER_Y, this.width, 100);
    ctx.fillStyle = '#E2E8F0';
    for (let x = Math.floor(this.cameraX / 40) * 40; x < this.cameraX + this.width + 40; x += 40) {
      ctx.fillStyle = (x / 40) % 2 === 0 ? '#F59E0B' : '#0F172A';
      ctx.fillRect(x, TIER_LOWER_Y, 20, 5);
    }

    // Fire Patches on Floor
    for (const fp of this.firePatches) {
      const flicker = Math.sin(performance.now() * 0.02 + fp.x) * 4;
      ctx.save();
      this.renderer.drawGlowCircle(fp.x, fp.y - 8, 14 + flicker, PALETTE.ORANGE, 12, true);
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(fp.x - 16, fp.y - 10 + flicker, 32, 10);
      ctx.restore();
    }

    // =========================================================================
    // 4. GELDRA ENEMIES
    // =========================================================================
    for (const e of this.enemies) {
      if (!e.active) continue;

      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(e.dir, 1);

      if (e.type === 'PANTHER') {
        // Fast sleek black predator panther
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-22, -18, 44, 16);
        // Head & glowing red eyes
        ctx.fillRect(16, -22, 12, 12);
        ctx.fillStyle = PALETTE.RED;
        ctx.fillRect(22, -20, 3, 3);
        // Running legs
        const pStride = Math.sin(performance.now() * 0.02) * 6;
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-18 + pStride, -4, 6, 8);
        ctx.fillRect(12 - pStride, -4, 6, 8);
      } else if (e.type === 'GELZO_BAT') {
        // Mutant bat wings flapping in flight
        const wingFlap = Math.sin(performance.now() * 0.025) * 8;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(-18, -14 + wingFlap);
        ctx.lineTo(-8, 6);
        ctx.lineTo(0, 0);
        ctx.lineTo(8, 6);
        ctx.lineTo(18, -14 + wingFlap);
        ctx.closePath();
        ctx.fill();
        // Glowing red eyes
        ctx.fillStyle = PALETTE.RED;
        ctx.fillRect(-3, -4, 2, 2);
        ctx.fillRect(1, -4, 2, 2);
      } else {
        // Geldra Masker (Hooded Soldier)
        const stride = Math.sin(e.walkFrame) * 5;

        // Boots & Uniform Pants
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-8 + stride, -14, 7, 14);
        ctx.fillRect(1 - stride, -14, 7, 14);

        // Colored Masker Uniform Coat
        ctx.fillStyle = e.color;
        ctx.fillRect(-12, -42, 24, 28);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-12, -26, 24, 4); // Ammo belt

        // Full-face Masker Hood
        ctx.fillStyle = e.color;
        ctx.fillRect(-9, -58, 18, 16);
        // Visor Eye Slit
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(1, -52, 7, 4);

        // Aimed Weapon
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(6, -34, 16, 5);
      }
      ctx.restore();
    }

    // =========================================================================
    // 5. PLAYER: SECRET AGENT ALBATROSS
    // =========================================================================
    const p = this.player;
    if (!p.dead && (!this.player.inDoor || Math.floor(performance.now() * 0.01) % 2 === 0)) {
      const visible = p.invuln <= 0 || Math.floor(p.invuln * 16) % 2 === 0;
      if (visible) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(p.dir, 1);

        const stride = p.onGround && p.vx !== 0 ? Math.sin(p.walkFrame) * 6 : 0;

        if (p.crouching) {
          // Crouching pose (low profile to dodge high bullets!)
          ctx.fillStyle = '#0F172A'; // Black agent dress shoes
          ctx.fillRect(-10, -8, 10, 8);
          ctx.fillRect(2, -8, 10, 8);

          // Brown espionage trenchcoat folded
          ctx.fillStyle = '#78350F';
          ctx.fillRect(-14, -26, 28, 18);
          ctx.fillStyle = '#451A03';
          ctx.fillRect(-14, -18, 28, 3); // Gun belt

          // Agent Head & sleek hair
          ctx.fillStyle = '#FDBA74';
          ctx.fillRect(-8, -38, 16, 12);
          ctx.fillStyle = '#1E1B4B';
          ctx.fillRect(-9, -42, 18, 6);

          // Level-aimed Weapon
          ctx.fillStyle = p.weapon === 'MACHINEGUN' ? PALETTE.CYAN : '#E2E8F0';
          ctx.fillRect(8, -22, p.weapon === 'MACHINEGUN' ? 24 : 15, 5);
        } else {
          // Standing & Running Agent Pose
          ctx.fillStyle = '#0F172A'; // Black agent trousers & dress shoes
          ctx.fillRect(-8 + stride, -16, 7, 16);
          ctx.fillRect(1 - stride, -16, 7, 16);

          // Classic Brown Espionage Trenchcoat
          ctx.fillStyle = '#78350F';
          ctx.fillRect(-12, -46, 24, 30);
          // Flowing coat tails when running
          if (p.vx !== 0) {
            ctx.fillStyle = '#572607';
            ctx.fillRect(-18, -32, 8, 16);
          }

          // Sleek Black Turtleneck & Gun Holster Belt
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(-6, -46, 12, 14);
          ctx.fillStyle = '#451A03';
          ctx.fillRect(-12, -30, 24, 4);

          // Head & Agent Sunglasses
          ctx.fillStyle = '#FDBA74';
          ctx.fillRect(-8, -60, 16, 14);
          ctx.fillStyle = '#1E1B4B';
          ctx.fillRect(-9, -64, 18, 6); // Slick hair
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(1, -55, 6, 3); // Cool sunglasses

          // Extended Weapon Arm
          ctx.fillStyle = '#78350F';
          ctx.fillRect(2, -42, 12, 6);
          ctx.fillStyle = p.weapon === 'MACHINEGUN' ? PALETTE.CYAN : '#E2E8F0';
          ctx.fillRect(14, -43, p.weapon === 'MACHINEGUN' ? 24 : 14, 5);
        }
        ctx.restore();
      }
    }

    // =========================================================================
    // 6. PROJECTILES (Player & Enemy Bullets, Grenades)
    // =========================================================================
    // Player Bullets
    for (const b of this.bullets) {
      ctx.save();
      this.renderer.drawGlowRect(b.x - 6, b.y - 2, 12, 4, b.isSMG ? PALETTE.CYAN : PALETTE.GOLD, 8, true);
      ctx.fillStyle = '#FFF';
      ctx.fillRect(b.x - 6, b.y - 2, 12, 4);
      ctx.restore();
    }

    // Enemy Bullets
    for (const eb of this.enemyBullets) {
      ctx.save();
      this.renderer.drawGlowCircle(eb.x, eb.y, 3.5, PALETTE.RED, 8, true);
      ctx.fillStyle = '#FFAA00';
      ctx.fillRect(eb.x - 4, eb.y - 2, 8, 4);
      ctx.restore();
    }

    // Arcing Grenades
    for (const g of this.grenades) {
      ctx.save();
      this.renderer.drawGlowCircle(g.x, g.y, 4, PALETTE.PINK, 6, true);
      ctx.fillStyle = '#374151';
      ctx.fillRect(g.x - 3, g.y - 3, 6, 6);
      ctx.restore();
    }

    // Particles & Popups
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
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

    ctx.restore(); // Undo camera translation

    // =========================================================================
    // 7. TOP HUD (Score, Health Meter, Weapon Ammo, Timer, Lives)
    // =========================================================================
    const pHealthBar = '█ '.repeat(Math.max(0, p.health));
    const weaponLabel = p.weapon === 'MACHINEGUN' ? `SMG: ${p.ammo}` : `GUN: ${p.ammo}`;
    const doorHint = p.inDoor ? ' [IN COVER]' : '';

    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: `LIFE:[${pHealthBar.trim()}]  ${weaponLabel}  TIME:${Math.ceil(this.timer)}s${doorHint}`,
      accent: PALETTE.GOLD
    });

    // State Overlay for Menu, Paused, and Game Over
    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1986 NAMCO ESPIONAGE COVERT-OPS',
      controls: 'LEFT/RIGHT: RUN  |  DOWN: DUCK/COVER  |  UP: DOOR/SUPER JUMP  |  Z: SHOOT  |  X: JUMP',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GOLD
    });
  }
}

export default RollingThunder;
