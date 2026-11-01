/**
 * GoldenAxe.js
 * Classic 1989 Sega Arcade 2.5D Belt-Scrolling Fantasy Beat 'Em Up — Retro Arcade Studio Edition.
 * Features:
 * - 3 Selectable Legendary Heroes:
 *     1. Ax Battler (The Barbarian: Broadsword, balanced combat, Earth Tremor Magic)
 *     2. Tyris Flare (The Amazon: Longsword, swift acrobatics, Fiery Dragon Magic)
 *     3. Gilius Thunderhead (The Dwarf: Heavy Battle Axe, longest reach, Lightning Storm Magic)
 * - Authentic 2.5D Belt-Scrolling Movement (X horizontal scroll, Z ground depth, Y jump height & gravity)
 * - Complete Combat Moveset:
 *     * 3-Hit Weapon Combo (Slash 1 -> Slash 2 -> Knockdown Cleave / Kick)
 *     * Running Dash Attack (Charging Shoulder Tackle / Lunging Weapon Swipe)
 *     * Downward Aerial Plunge (Mid-Air Jumping Blade Slam)
 *     * Grapple & Throw (Close-quarters grab, knee strike, and over-shoulder throw)
 * - Rideable Bizarrian Mounts:
 *     * Chicken Leg (Cockatrice: sweeping tail-whip attack that trips groups of enemies)
 *     * Fire Dragon (Shoots fiery flame breath projectiles)
 *     * Knock enemies off mounts to hijack them!
 * - Thief Encounters (Blue Potion Thieves & Green Food Thieves dropping magic pots and meat)
 * - Screen-Clearing Elemental Magic Spells (Earth Fissures, Lightning Bolts, and Tyris's Golden Fire Dragon)
 * - Multi-Stage Campaign across Yuria:
 *     Stage 1: Woods of Turtle Village
 *     Stage 2: Across the Sea on the Giant Turtle
 *     Stage 3: Across the Clouds on the Eagle Island
 *     Stage 4: Death Adder's Castle Gate & Throne Room
 * - Diverse Foes: Mace Grunts, Amazon Swordsmen, Skeletons, Bad Brothers hammer giants, and Death Adder!
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

export const HEROES = {
  axbattler: {
    id: 'axbattler',
    name: 'Ax Battler',
    title: 'The Barbarian',
    weapon: 'Broadsword',
    speed: 215,
    maxHp: 100,
    maxPotions: 4,
    reach: 56,
    magicType: 'EARTH',
    themeColor: '#3B82F6',
    hairColor: '#D97706',
    skinColor: '#FBBF24',
    clothColor: '#2563EB',
    desc: 'Balanced warrior wielding a heavy broadsword & seismic earth magic.'
  },
  tyrisflare: {
    id: 'tyrisflare',
    name: 'Tyris Flare',
    title: 'The Amazon',
    weapon: 'Longsword',
    speed: 240,
    maxHp: 85,
    maxPotions: 6,
    reach: 52,
    magicType: 'FIRE',
    themeColor: '#EF4444',
    hairColor: '#FDE047',
    skinColor: '#FCD34D',
    clothColor: '#DC2626',
    desc: 'Swift acrobat with sweeping sword strikes & screen-filling dragon fire.'
  },
  giliusthunderhead: {
    id: 'giliusthunderhead',
    name: 'Gilius Thunderhead',
    title: 'The Dwarf',
    weapon: 'Battle Axe',
    speed: 195,
    maxHp: 115,
    maxPotions: 3,
    reach: 64,
    magicType: 'LIGHTNING',
    themeColor: '#10B981',
    hairColor: '#E2E8F0',
    skinColor: '#FBBF24',
    clothColor: '#059669',
    desc: 'Unyielding dwarf wielding a massive double axe & lethal lightning.'
  }
};

export class GoldenAxe {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'goldenaxe';
    this.title = 'Golden Axe';
    this.width = 960;
    this.height = 540;

    this.state = 'HERO_SELECT'; // HERO_SELECT -> PLAYING -> MAGIC_CASTING -> STAGE_CLEAR -> GAMEOVER
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.stage = 1;
    this.selectedHeroKey = 'axbattler';

    this.reset();
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.stage = 1;
    this.state = 'HERO_SELECT';

    this.cameraX = 0;
    this.stageLength = 3400;
    this.stageClearTimer = 0;
    this.magicTimer = 0;
    this.magicActive = false;

    this.particles = [];
    this.popups = [];
    this.drops = [];
    this.projectiles = [];
    this.enemies = [];
    this.mounts = [];

    this._initPlayer();
  }

  setState(state) {
    this.state = state;
    if (state === 'GAMEOVER') {
      HighScoreStore.submit(this.id, this.score);
    }
  }

  destroy() {
    if (this.audio) {
      this.audio.stopSequence();
    }
  }

  _initPlayer() {
    const hero = HEROES[this.selectedHeroKey] || HEROES.axbattler;
    this.player = {
      hero,
      x: 180,
      z: 400, // Ground depth plane (320 to 480)
      y: 0,   // Jump elevation
      vx: 0,
      vz: 0,
      vy: 0,
      facing: 1, // 1 = right, -1 = left
      hp: hero.maxHp,
      maxHp: hero.maxHp,
      potions: 2,
      maxPotions: hero.maxPotions,
      state: 'IDLE', // IDLE, WALK, RUN, JUMP, ATTACK, JUMP_ATTACK, DASH_ATTACK, GRAPPLE, HURT, KNOCKDOWN
      stateTimer: 0,
      comboStep: 0,
      comboResetTimer: 0,
      invulnTimer: 1.5,
      mount: null,
      lastTapDir: 0,
      tapTimer: 0
    };
  }

  _initStage(stageNum) {
    this.stage = stageNum;
    this.cameraX = 0;
    this.stageLength = 3200 + stageNum * 400;
    this.stageClearTimer = 0;
    this.magicTimer = 0;
    this.magicActive = false;

    this.particles = [];
    this.popups = [];
    this.drops = [];
    this.projectiles = [];
    this.enemies = [];
    this.mounts = [];

    this.player.x = 180;
    this.player.z = 400;
    this.player.y = 0;
    this.player.vx = 0;
    this.player.vz = 0;
    this.player.vy = 0;
    this.player.state = 'IDLE';
    this.player.stateTimer = 0;
    this.player.invulnTimer = 2.0;

    // Spawn Initial Stage Mount (Chicken Leg Cockatrice or Fire Dragon)
    if (stageNum === 1 || stageNum === 3) {
      this.mounts.push({
        type: 'cockatrice',
        name: 'Chicken Leg',
        x: 600,
        z: 410,
        y: 0,
        vx: 0,
        facing: -1,
        rider: null,
        hp: 120,
        attackCooldown: 0,
        color: '#F43F5E'
      });
    } else {
      this.mounts.push({
        type: 'dragon',
        name: 'Fire Dragon',
        x: 650,
        z: 410,
        y: 0,
        vx: 0,
        facing: -1,
        rider: null,
        hp: 140,
        attackCooldown: 0,
        color: '#0284C7'
      });
    }

    // Populate Stage Encounter Waves
    this._spawnStageEnemies(stageNum);

    this.popups.push({
      x: this.width / 2,
      y: 110,
      text: this._getStageTitle(stageNum),
      color: PALETTE.GOLD,
      life: 2.8
    });

    if (this.audio) {
      this.audio.playMusic('goldenaxe');
    }
  }

  _getStageTitle(stageNum) {
    const titles = [
      'STAGE 1: WOODS OF TURTLE VILLAGE',
      'STAGE 2: ACROSS THE SEA ON GIANT TURTLE',
      'STAGE 3: THE EAGLE ISLAND IN THE CLOUDS',
      'STAGE 4: DEATH ADDER THRONE ROOM'
    ];
    return titles[Math.min(titles.length - 1, stageNum - 1)];
  }

  _spawnStageEnemies(stageNum) {
    // Generate paced combat waves along the scrolling track
    const waveDistances = [500, 1050, 1600, 2200, 2750];

    for (let w = 0; w < waveDistances.length; w++) {
      const baseX = waveDistances[w];

      // Regular grunt / amazon foot soldiers
      const count = 2 + Math.min(2, stageNum);
      for (let k = 0; k < count; k++) {
        const typeRoll = (w + k) % 3;
        const type = typeRoll === 0 ? 'grunt' : typeRoll === 1 ? 'amazon' : 'skeleton';
        this.enemies.push(this._createEnemy(type, baseX + k * 80, 340 + ((k * 45) % 130), stageNum));
      }

      // Mid-stage thief carrying potions or food
      if (w === 1 || w === 3) {
        this.enemies.push({
          type: w === 1 ? 'thief_potion' : 'thief_food',
          name: w === 1 ? 'Blue Thief' : 'Green Thief',
          x: baseX + 140,
          z: 380,
          y: 0,
          vx: -130,
          vz: 0,
          facing: -1,
          hp: 20,
          maxHp: 20,
          state: 'RUN',
          stateTimer: 0,
          lootCount: 2,
          color: w === 1 ? '#0284C7' : '#16A34A',
          isThief: true
        });
      }

      // Wave 4 & 5 Mini-Bosses / Boss
      if (w === 3) {
        // Bad Brother Hammer Giant
        this.enemies.push(this._createEnemy('badbrother', baseX + 220, 390, stageNum));
      } else if (w === 4) {
        if (stageNum === 4) {
          // FINAL BOSS: DEATH ADDER
          this.enemies.push(this._createEnemy('deathadder', baseX + 260, 400, stageNum));
        } else {
          // Double Bad Brothers or Skeletons
          this.enemies.push(this._createEnemy('badbrother', baseX + 220, 370, stageNum));
          this.enemies.push(this._createEnemy('skeleton', baseX + 280, 430, stageNum));
        }
      }
    }
  }

  _createEnemy(type, x, z, stageNum) {
    const specs = {
      grunt: {
        name: 'Club Grunt',
        hp: 35 + stageNum * 8,
        speed: 130 + stageNum * 6,
        color: '#D97706',
        weapon: 'Mace',
        reach: 48,
        damage: 10,
        scoreValue: 200
      },
      amazon: {
        name: 'Amazon Warrior',
        hp: 40 + stageNum * 8,
        speed: 165 + stageNum * 8,
        color: '#DC2626',
        weapon: 'Saber',
        reach: 52,
        damage: 12,
        scoreValue: 300
      },
      skeleton: {
        name: 'Silver Skeleton',
        hp: 55 + stageNum * 12,
        speed: 140 + stageNum * 5,
        color: '#E2E8F0',
        weapon: 'Scimitar',
        reach: 54,
        damage: 15,
        scoreValue: 450
      },
      badbrother: {
        name: 'Bad Brother Giant',
        hp: 130 + stageNum * 25,
        speed: 110 + stageNum * 5,
        color: '#7C2D12',
        weapon: 'War Hammer',
        reach: 68,
        damage: 24,
        isBoss: true,
        scoreValue: 1200
      },
      deathadder: {
        name: 'DEATH ADDER',
        hp: 340,
        speed: 145,
        color: '#1E1B4B',
        weapon: 'Golden Axe',
        reach: 75,
        damage: 32,
        isBoss: true,
        isFinalBoss: true,
        scoreValue: 5000
      }
    };

    const s = specs[type] || specs.grunt;
    return {
      type,
      name: s.name,
      x,
      z,
      y: 0,
      vx: 0,
      vz: 0,
      facing: -1,
      hp: s.hp,
      maxHp: s.hp,
      speed: s.speed,
      reach: s.reach,
      damage: s.damage,
      color: s.color,
      isBoss: !!s.isBoss,
      isFinalBoss: !!s.isFinalBoss,
      scoreValue: s.scoreValue,
      state: 'IDLE',
      stateTimer: 0,
      attackCooldown: 1.0 + Math.random() * 0.8,
      invulnTimer: 0,
      mount: null
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
        life: 1.2
      });
    }
  }

  _spawnParticles(x, y, color = PALETTE.GOLD, count = 14, speed = 160) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd = speed * (0.3 + Math.random() * 0.9);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 30,
        color,
        size: 3 + Math.random() * 3,
        life: 0.35 + Math.random() * 0.3
      });
    }
  }

  _castMagic() {
    const p = this.player;
    if (p.potions <= 0 || this.magicActive) return;

    const potsUsed = p.potions;
    p.potions = 0;
    this.magicActive = true;
    this.magicTimer = 2.4;

    this.audio.playExplosion(0.6, 450);
    this.audio.playPowerUp();
    this.renderer.shake(14, 0.6);

    const magicType = p.hero.magicType;
    const damage = 60 + potsUsed * 35;

    // Cinematic Magic Screen Popups & Damage
    if (magicType === 'FIRE') {
      this.popups.push({
        x: this.width / 2,
        y: 130,
        text: potsUsed >= 4 ? 'GREAT GOLDEN DRAGON INFERNO!' : 'FIRE CASCADE!',
        color: PALETTE.GOLD,
        life: 2.2
      });
    } else if (magicType === 'EARTH') {
      this.popups.push({
        x: this.width / 2,
        y: 130,
        text: 'SEISMIC EARTHQUAKE & ROCK SPIKES!',
        color: PALETTE.ORANGE,
        life: 2.2
      });
    } else {
      this.popups.push({
        x: this.width / 2,
        y: 130,
        text: 'DIVINE LIGHTNING STORM!',
        color: PALETTE.CYAN,
        life: 2.2
      });
    }

    // Hit all active enemies on screen
    for (const e of this.enemies) {
      if (Math.abs(e.x - this.cameraX - this.width / 2) < this.width * 0.6) {
        e.hp -= damage;
        e.state = 'KNOCKDOWN';
        e.stateTimer = 0.9;
        e.vx = (e.x > p.x ? 1 : -1) * 260;
        this._spawnParticles(e.x - this.cameraX, e.z - 20, PALETTE.GOLD, 16);
      }
    }
  }

  update(dt) {
    if (this.state === 'HERO_SELECT') {
      // Hero Selection Screen
      if (this.input.isJustPressed('left') || this.input.isJustPressed('up')) {
        this.selectedHeroKey =
          this.selectedHeroKey === 'axbattler'
            ? 'giliusthunderhead'
            : this.selectedHeroKey === 'tyrisflare'
            ? 'axbattler'
            : 'tyrisflare';
        this.audio.playMenuMove();
      } else if (this.input.isJustPressed('right') || this.input.isJustPressed('down')) {
        this.selectedHeroKey =
          this.selectedHeroKey === 'axbattler'
            ? 'tyrisflare'
            : this.selectedHeroKey === 'tyrisflare'
            ? 'giliusthunderhead'
            : 'axbattler';
        this.audio.playMenuMove();
      }

      if (
        this.input.isJustPressed('actionA') ||
        this.input.isJustPressed('actionB') ||
        (this.input.pointer && this.input.pointer.justPressed)
      ) {
        this.audio.playMenuSelect();
        this._initPlayer();
        this._initStage(1);
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

    if (this.state === 'GAMEOVER') {
      if (
        this.input.isJustPressed('actionA') ||
        this.input.isJustPressed('actionB') ||
        (this.input.pointer && this.input.pointer.justPressed)
      ) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'HERO_SELECT';
      }
      return;
    }

    if (this.input.isJustPressed('pause')) {
      this.audio.playMenuMove();
      this.state = 'PAUSED';
      return;
    }

    // Handle Magic Spell Screen Freeze
    if (this.magicActive) {
      this.magicTimer -= dt;
      if (this.magicTimer <= 0) {
        this.magicActive = false;
      }
      // Continue updating particles and popups during magic
      this._updateParticles(dt);
      return;
    }

    // Check Stage Clear Transition
    if (this.stageClearTimer > 0) {
      this.stageClearTimer -= dt;
      if (this.stageClearTimer <= 0) {
        if (this.stage >= 4) {
          // Completed final stage!
          this._addScore(10000, this.width / 2, 200, 'VICTORY OF YURIA! +10000', PALETTE.GOLD);
          this.state = 'GAMEOVER';
        } else {
          this._initStage(this.stage + 1);
        }
      }
      this._updateParticles(dt);
      return;
    }

    const p = this.player;
    if (p.invulnTimer > 0) p.invulnTimer -= dt;
    if (p.tapTimer > 0) p.tapTimer -= dt;

    // 1. Player Controls & Combat State Machine
    const axis = this.input.getAxis();
    const attackPressed = this.input.isJustPressed('actionA') || (this.input.pointer && this.input.pointer.justPressed);
    const jumpPressed = this.input.isJustPressed('actionB');
    const magicPressed = this.input.isJustPressed('actionC') || this.input.isKeyJustPressed('KeyC') || this.input.isKeyJustPressed('Enter');

    if (magicPressed) {
      this._castMagic();
    }

    // Double-tap or sprint detection for Dash Attack
    if (this.input.isJustPressed('right')) {
      if (p.lastTapDir === 1 && p.tapTimer > 0) p.state = 'RUN';
      p.lastTapDir = 1;
      p.tapTimer = 0.28;
    } else if (this.input.isJustPressed('left')) {
      if (p.lastTapDir === -1 && p.tapTimer > 0) p.state = 'RUN';
      p.lastTapDir = -1;
      p.tapTimer = 0.28;
    }

    // Jump Physics (Gravity & Elevation)
    if (p.y > 0 || p.vy !== 0) {
      p.vy -= 980 * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) {
        p.y = 0;
        p.vy = 0;
        if (p.state === 'JUMP' || p.state === 'JUMP_ATTACK') {
          p.state = 'IDLE';
          this.audio.playJump();
        }
      }
    } else if (jumpPressed && p.state !== 'ATTACK' && p.state !== 'HURT' && p.state !== 'KNOCKDOWN') {
      p.vy = 420;
      p.y = 1;
      p.state = 'JUMP';
      this.audio.playJump();
    }

    // Attacks & Combos
    if (attackPressed && p.state !== 'HURT' && p.state !== 'KNOCKDOWN') {
      if (p.y > 0) {
        // Downward Aerial Sword/Axe Slam!
        p.state = 'JUMP_ATTACK';
        p.stateTimer = 0.45;
        this.audio.playLaser(950, 220, 0.1);
        this._performPlayerAttack('AERIAL_SLAM', p.reach * 1.2, 35);
      } else if (p.state === 'RUN') {
        // Charging Dash Tackle / Weapon Sweep!
        p.state = 'DASH_ATTACK';
        p.stateTimer = 0.45;
        p.vx = p.facing * 340;
        this.audio.playLaser(1100, 280, 0.12);
        this._performPlayerAttack('DASH_ATTACK', p.reach * 1.3, 40);
      } else if (p.mount) {
        // Mount Attack: Tail whip or Fireball
        p.state = 'ATTACK';
        p.stateTimer = 0.4;
        if (p.mount.type === 'dragon') {
          this.projectiles.push({
            x: p.x + p.facing * 35,
            z: p.z,
            y: 24,
            vx: p.facing * 480,
            damage: 35,
            color: PALETTE.GOLD
          });
          this.audio.playExplosion(0.2, 800);
        } else {
          // Chicken Leg sweeping tail whip
          this.audio.playLaser(750, 150, 0.12);
          this._performPlayerAttack('TAIL_WHIP', 75, 30);
        }
      } else {
        // 3-Hit Ground Weapon Combo (Slash 1 -> Slash 2 -> Knockdown Cleave)
        p.state = 'ATTACK';
        p.comboStep = (p.comboStep % 3) + 1;
        p.stateTimer = 0.32;
        p.comboResetTimer = 0.7;
        const damage = p.comboStep === 3 ? 32 : 18;
        this.audio.playLaser(900 - p.comboStep * 120, 260, 0.08);
        this._performPlayerAttack(`SLASH_${p.comboStep}`, p.reach, damage, p.comboStep === 3);
      }
    }

    // Combat State Timers
    if (p.stateTimer > 0) {
      p.stateTimer -= dt;
      if (p.stateTimer <= 0) {
        if (p.y <= 0) p.state = 'IDLE';
      }
    }
    if (p.comboResetTimer > 0) {
      p.comboResetTimer -= dt;
      if (p.comboResetTimer <= 0) {
        p.comboStep = 0;
      }
    }

    // Movement Execution
    if (p.state !== 'ATTACK' && p.state !== 'DASH_ATTACK' && p.state !== 'HURT' && p.state !== 'KNOCKDOWN') {
      const spd = p.state === 'RUN' ? p.hero.speed * 1.6 : p.hero.speed;
      p.vx = axis.x * spd;
      p.vz = axis.y * spd * 0.75; // Isometric depth scaling

      if (axis.x !== 0) p.facing = Math.sign(axis.x);

      if (p.y <= 0) {
        if (axis.x !== 0 || axis.y !== 0) {
          if (p.state !== 'RUN') p.state = 'WALK';
        } else {
          p.state = 'IDLE';
        }
      }
    }

    p.x += p.vx * dt;
    p.z += p.vz * dt;

    // Bounds checking
    p.x = Math.max(this.cameraX + 40, Math.min(this.cameraX + this.width - 40, p.x));
    p.z = Math.max(320, Math.min(480, p.z));

    // Update Camera (Scrolls smoothly to the right, cannot scroll backward)
    const targetCamX = Math.max(0, p.x - this.width * 0.38);
    this.cameraX = Math.max(this.cameraX, Math.min(this.stageLength - this.width, targetCamX));

    // Mount Positioning
    if (p.mount) {
      p.mount.x = p.x;
      p.mount.z = p.z;
      p.mount.y = p.y;
      p.mount.facing = p.facing;
    }

    // 2. Projectiles Update
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.x += pr.vx * dt;
      if (Math.abs(pr.x - p.x) > this.width) {
        this.projectiles.splice(i, 1);
        continue;
      }
      // Hit check on enemies
      for (const e of this.enemies) {
        if (Math.abs(e.x - pr.x) < 32 && Math.abs(e.z - pr.z) < 26) {
          e.hp -= pr.damage;
          e.state = 'KNOCKDOWN';
          e.stateTimer = 0.8;
          e.vx = pr.vx > 0 ? 240 : -240;
          this._spawnParticles(e.x - this.cameraX, e.z - 20, PALETTE.GOLD, 14);
          this.projectiles.splice(i, 1);
          break;
        }
      }
    }

    // 3. Enemy AI & Behaviors
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.invulnTimer > 0) e.invulnTimer -= dt;

      // Knockdown / Hurt recoveries
      if (e.state === 'KNOCKDOWN' || e.state === 'HURT') {
        e.stateTimer -= dt;
        e.x += (e.vx || 0) * dt;
        e.vx = (e.vx || 0) * Math.pow(0.01, dt);
        if (e.stateTimer <= 0) {
          if (e.hp <= 0) {
            // Defeated Enemy!
            this._destroyEnemy(i);
            continue;
          }
          e.state = 'IDLE';
        }
        continue;
      }

      // Thief AI: Flee across the screen with loot sacks
      if (e.isThief) {
        e.x += (e.vx || 0) * dt;
        if (e.x < this.cameraX - 100 || e.x > this.cameraX + this.width + 100) {
          this.enemies.splice(i, 1);
        }
        continue;
      }

      // Combatant AI: Track player and attack when in range
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const dist = Math.hypot(dx, dz);

      e.facing = dx > 0 ? 1 : -1;
      e.attackCooldown -= dt;

      if (dist > e.reach) {
        // Approach player in isometric 2.5D space
        const angle = Math.atan2(dz, dx);
        e.vx = Math.cos(angle) * e.speed;
        e.vz = Math.sin(angle) * e.speed * 0.7;
        e.state = 'WALK';
      } else {
        e.vx = 0;
        e.vz = 0;
        e.state = 'IDLE';

        // Attack Player
        if (e.attackCooldown <= 0 && p.invulnTimer <= 0) {
          e.state = 'ATTACK';
          e.stateTimer = 0.4;
          e.attackCooldown = 1.6 + Math.random() * 0.6;
          this.audio.playLaser(450, 180, 0.08);

          // Player takes damage
          p.hp -= e.damage;
          p.invulnTimer = 1.2;
          p.state = 'HURT';
          p.stateTimer = 0.35;
          p.vx = (p.x > e.x ? 1 : -1) * 160;
          this.renderer.shake(8, 0.2);
          this.audio.playExplosion(0.2, 800);
          this._spawnParticles(p.x - this.cameraX, p.z - 25, PALETTE.RED, 12);

          // Dismount if riding
          if (p.mount) {
            p.mount.rider = null;
            p.mount = null;
            this.popups.push({
              x: p.x - this.cameraX,
              y: p.z - 45,
              text: 'DISMOUNTED!',
              color: PALETTE.RED,
              life: 1.0
            });
          }

          if (p.hp <= 0) {
            this._killPlayer();
            return;
          }
        }
      }

      e.x += e.vx * dt;
      e.z += e.vz * dt;
      e.z = Math.max(320, Math.min(480, e.z));
    }

    // 4. Drops Collection (Magic Potions & Meat)
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      drop.life -= dt;
      if (drop.life <= 0) {
        this.drops.splice(i, 1);
        continue;
      }
      if (Math.abs(p.x - drop.x) < 32 && Math.abs(p.z - drop.z) < 24) {
        if (drop.type === 'potion') {
          p.potions = Math.min(p.maxPotions, p.potions + 1);
          this._addScore(200, p.x - this.cameraX, p.z - 40, 'POTION +1 (+200)', PALETTE.CYAN);
          this.audio.playPowerUp();
        } else if (drop.type === 'food') {
          p.hp = Math.min(p.maxHp, p.hp + 35);
          this._addScore(300, p.x - this.cameraX, p.z - 40, 'MEAT +35 HP (+300)', PALETTE.GREEN);
          this.audio.playCoin();
        }
        this.drops.splice(i, 1);
      }
    }

    // 5. Mount Hijacking & Interactions
    if (!p.mount) {
      for (const m of this.mounts) {
        if (!m.rider && Math.abs(p.x - m.x) < 30 && Math.abs(p.z - m.z) < 20) {
          p.mount = m;
          m.rider = p;
          this.audio.playPowerUp();
          this.popups.push({
            x: p.x - this.cameraX,
            y: p.z - 45,
            text: `MOUNTED ${m.name.toUpperCase()}!`,
            color: PALETTE.GOLD,
            life: 1.4
          });
          break;
        }
      }
    }

    // 6. Stage Progression: Trigger stage clear when all wave enemies are slain and reached end
    if (this.enemies.length === 0 && p.x >= this.stageLength - 300 && this.stageClearTimer <= 0) {
      this.stageClearTimer = 2.4;
      this.audio.playStageClear();
      const bonus = 2000 + p.potions * 300 + Math.round(p.hp) * 10;
      this._addScore(bonus, this.width / 2, 160, `STAGE CLEAR BONUS +${bonus}!`, PALETTE.GOLD);
    }

    this._updateParticles(dt);
  }

  _performPlayerAttack(attackType, reach, damage, isKnockdown = false) {
    const p = this.player;
    let hitCount = 0;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const dx = (e.x - p.x) * p.facing;
      const dz = Math.abs(e.z - p.z);

      // Hitbox in front of player with 2.5D depth clearance
      if (dx > -10 && dx < reach && dz < 26) {
        hitCount++;
        e.hp -= damage;
        this.audio.playHit();
        this._spawnParticles(e.x - this.cameraX, e.z - 25, PALETTE.GOLD, 12);

        // If hitting a thief, drop loot!
        if (e.isThief && e.lootCount > 0) {
          e.lootCount--;
          this.drops.push({
            type: e.type === 'thief_potion' ? 'potion' : 'food',
            x: e.x + (Math.random() - 0.5) * 40,
            z: e.z + (Math.random() - 0.5) * 20,
            life: 12
          });
          this.audio.playCoin();
        }

        if (isKnockdown || attackType === 'DASH_ATTACK' || attackType === 'AERIAL_SLAM') {
          e.state = 'KNOCKDOWN';
          e.stateTimer = 0.85;
          e.vx = p.facing * 280;
        } else {
          e.state = 'HURT';
          e.stateTimer = 0.28;
          e.vx = p.facing * 90;
        }

        if (e.hp <= 0 && e.state !== 'KNOCKDOWN') {
          this._destroyEnemy(i);
        }
      }
    }
  }

  _destroyEnemy(index) {
    const e = this.enemies[index];
    this.audio.playExplosion(0.3, 750);
    this.renderer.shake(7, 0.2);
    this._spawnParticles(e.x - this.cameraX, e.z - 20, PALETTE.ORANGE, 22);
    this._addScore(e.scoreValue, e.x - this.cameraX, e.z - 35, `+${e.scoreValue}`);

    if (e.isFinalBoss) {
      this.stageClearTimer = 3.0;
      this.audio.playStageClear();
    }
    this.enemies.splice(index, 1);
  }

  _killPlayer() {
    const p = this.player;
    this.audio.playExplosion(0.5, 600);
    this.renderer.shake(12, 0.4);
    this._spawnParticles(p.x - this.cameraX, p.z - 25, PALETTE.RED, 26);
    this.lives--;

    if (this.lives <= 0) {
      this.state = 'GAMEOVER';
      this.audio.playGameOver();
    } else {
      p.hp = p.maxHp;
      p.invulnTimer = 2.5;
      p.state = 'IDLE';
      p.x = Math.max(this.cameraX + 60, p.x - 80);
      this.popups.push({
        x: p.x - this.cameraX,
        y: p.z - 45,
        text: 'LIFE LOST!',
        color: PALETTE.RED,
        life: 1.2
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
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 32 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
  }

  render(ctx = this.renderer.ctx) {
    if (this.state === 'HERO_SELECT') {
      this._renderHeroSelect(ctx);
      return;
    }

    // 1. Scrolling Fantasy Parallax Background
    this._renderBackground(ctx);

    // 2. Depth-Sorted Characters, Mounts, Drops & Shadows
    const renderables = [];

    // Player
    renderables.push({ type: 'player', obj: this.player, z: this.player.z });

    // Mounts
    for (const m of this.mounts) {
      if (!m.rider) {
        renderables.push({ type: 'mount', obj: m, z: m.z });
      }
    }

    // Enemies
    for (const e of this.enemies) {
      renderables.push({ type: 'enemy', obj: e, z: e.z });
    }

    // Drops
    for (const d of this.drops) {
      renderables.push({ type: 'drop', obj: d, z: d.z });
    }

    // Sort ascending by ground depth Z (farther objects first, nearer in front)
    renderables.sort((a, b) => a.z - b.z);

    for (const item of renderables) {
      if (item.type === 'player') this._renderPlayer(ctx, item.obj);
      else if (item.type === 'enemy') this._renderEnemy(ctx, item.obj);
      else if (item.type === 'mount') this._renderMount(ctx, item.obj);
      else if (item.type === 'drop') this._renderDrop(ctx, item.obj);
    }

    // 3. Projectiles (Dragon Fireballs)
    for (const pr of this.projectiles) {
      const sx = pr.x - this.cameraX;
      this.renderer.drawGlowCircle(sx, pr.z - pr.y, 8, pr.color, 14, true);
    }

    // 4. Magic Fullscreen Cinematic Overlay
    if (this.magicActive) {
      this._renderMagicCinematic(ctx);
    }

    // 5. Particles & Floating Popups
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
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

    // 6. HUD & Arcade Overlays
    this._renderHUD(ctx);
  }

  _renderBackground(ctx) {
    const s = this.stage;

    if (s === 1) {
      // Stage 1: Woods of Turtle Village (Forest & Distant Mountain Peaks)
      ctx.fillStyle = '#1A1829';
      ctx.fillRect(0, 0, this.width, 320);

      // Distant Mountains
      ctx.fillStyle = '#2A2640';
      ctx.beginPath();
      for (let x = 0; x <= this.width; x += 120) {
        const h = 180 + Math.sin((x + this.cameraX * 0.15) * 0.015) * 45;
        ctx.lineTo(x, h);
      }
      ctx.lineTo(this.width, 320);
      ctx.lineTo(0, 320);
      ctx.closePath();
      ctx.fill();

      // Ancient Stone Ruins & Trees
      ctx.fillStyle = '#1C2E24';
      ctx.fillRect(0, 240, this.width, 80);

      // Earthen Road Ground Plane (Z: 320 to 540)
      ctx.fillStyle = '#654321';
      ctx.fillRect(0, 320, this.width, 220);
      ctx.fillStyle = '#4A2E12';
      for (let x = 0; x < this.width; x += 80) {
        ctx.fillRect((x - (this.cameraX % 80)), 340 + (x % 30), 40, 15);
      }
    } else if (s === 2) {
      // Stage 2: Giant Sea Turtle Shell (Deep Blue Ocean Parallax)
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, this.width, 300);

      // Rolling Ocean Waves
      ctx.fillStyle = '#1E3A8A';
      for (let y = 140; y < 300; y += 30) {
        ctx.beginPath();
        for (let x = 0; x <= this.width; x += 40) {
          const wy = y + Math.sin((x + this.cameraX * 0.2 + performance.now() * 0.003) * 0.05) * 8;
          ctx.lineTo(x, wy);
        }
        ctx.lineTo(this.width, 300);
        ctx.lineTo(0, 300);
        ctx.closePath();
        ctx.fill();
      }

      // Sea Turtle Shell Plates (Z: 300 to 540)
      ctx.fillStyle = '#15803D';
      ctx.fillRect(0, 300, this.width, 240);
      ctx.strokeStyle = '#14532D';
      ctx.lineWidth = 3;
      for (let x = -60; x < this.width + 60; x += 90) {
        const sx = x - (this.cameraX % 90);
        ctx.strokeRect(sx, 320, 80, 180);
      }
    } else if (s === 3) {
      // Stage 3: The Eagle Island in the Clouds
      ctx.fillStyle = '#0284C7';
      ctx.fillRect(0, 0, this.width, 300);

      // Drifting White Clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      for (let i = 0; i < 6; i++) {
        const cx = ((i * 180 - this.cameraX * 0.3) % (this.width + 120));
        ctx.beginPath();
        ctx.arc(cx, 120 + (i % 3) * 35, 45, 0, Math.PI * 2);
        ctx.fill();
      }

      // Golden Bird Island Feathers / Deck
      ctx.fillStyle = '#B45309';
      ctx.fillRect(0, 310, this.width, 230);
    } else {
      // Stage 4: Death Adder's Citadel & Throne Room
      ctx.fillStyle = '#090D16';
      ctx.fillRect(0, 0, this.width, 300);

      // Stone Pillars & Flaming Torches
      ctx.fillStyle = '#1E1B4B';
      for (let x = 0; x < this.width; x += 150) {
        const px = x - (this.cameraX % 150);
        ctx.fillRect(px, 60, 28, 250);
        // Torch Fire
        this.renderer.drawGlowCircle(px + 14, 110, 8, PALETTE.ORANGE, 14, true);
      }

      // Polished Obsidian Throne Floor
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, 310, this.width, 230);
    }
  }

  _renderHeroSelect(ctx) {
    this.renderer.clear('#090D16');

    this.renderer.drawText('SELECT YOUR HERO', this.width / 2, 70, {
      font: FONTS.HEADER,
      size: 20,
      color: PALETTE.GOLD,
      align: 'center',
      glow: 10
    });

    const heroKeys = ['axbattler', 'tyrisflare', 'giliusthunderhead'];
    const cardW = 260;
    const startX = (this.width - (3 * cardW + 2 * 30)) / 2;

    for (let i = 0; i < heroKeys.length; i++) {
      const key = heroKeys[i];
      const h = HEROES[key];
      const isSelected = this.selectedHeroKey === key;
      const x = startX + i * (cardW + 30);
      const y = 120;

      // Card Background
      ctx.fillStyle = isSelected ? '#1E293B' : '#0F172A';
      ctx.fillRect(x, y, cardW, 340);
      ctx.strokeStyle = isSelected ? PALETTE.GOLD : '#334155';
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeRect(x, y, cardW, 340);

      if (isSelected) {
        this.renderer.drawGlowRect(x, y, cardW, 340, PALETTE.GOLD, 8, false);
      }

      // Hero Name & Title
      this.renderer.drawText(h.name.toUpperCase(), x + cardW / 2, y + 36, {
        font: FONTS.HEADER,
        size: 13,
        color: isSelected ? PALETTE.GOLD : PALETTE.WHITE,
        align: 'center'
      });
      this.renderer.drawText(h.title, x + cardW / 2, y + 54, {
        font: FONTS.HEADER,
        size: 9,
        color: PALETTE.CYAN,
        align: 'center'
      });

      // Hero Miniature Sprite Figure
      this._drawHeroFigure(ctx, key, x + cardW / 2, y + 155, 1.8);

      // Stats
      const statY = y + 235;
      this.renderer.drawText(`WEAPON: ${h.weapon}`, x + 16, statY, {
        font: FONTS.HEADER,
        size: 8,
        color: PALETTE.WHITE
      });
      this.renderer.drawText(`MAGIC: ${h.magicType} (MAX ${h.maxPotions})`, x + 16, statY + 20, {
        font: FONTS.HEADER,
        size: 8,
        color: PALETTE.GOLD
      });
      this.renderer.drawText(`HEALTH: ${h.maxHp}  |  SPEED: ${h.speed}`, x + 16, statY + 40, {
        font: FONTS.HEADER,
        size: 8,
        color: PALETTE.CYAN
      });

      if (isSelected) {
        this.renderer.drawText('[SELECTED]', x + cardW / 2, y + 325, {
          font: FONTS.HEADER,
          size: 10,
          color: PALETTE.GREEN,
          align: 'center'
        });
      }
    }

    this.renderer.drawText('LEFT/RIGHT: CHOOSE HERO  |  Z / SPACE / BUTTON: START ADVENTURE', this.width / 2, 495, {
      font: FONTS.HEADER,
      size: 11,
      color: PALETTE.CYAN,
      align: 'center',
      glow: 6
    });
  }

  _drawHeroFigure(ctx, heroKey, x, y, scale = 1.0) {
    const h = HEROES[heroKey];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Torso / Muscle
    ctx.fillStyle = h.skinColor;
    ctx.fillRect(-8, -26, 16, 20);

    // Tunic / Armor
    ctx.fillStyle = h.clothColor;
    ctx.fillRect(-9, -14, 18, 14);

    // Head & Hair
    ctx.fillStyle = h.skinColor;
    ctx.fillRect(-6, -38, 12, 12);
    ctx.fillStyle = h.hairColor;
    ctx.fillRect(-7, -42, 14, 8);

    // Legs & Boots
    ctx.fillStyle = '#78350F';
    ctx.fillRect(-7, 0, 6, 16);
    ctx.fillRect(1, 0, 6, 16);

    // Weapon
    if (heroKey === 'giliusthunderhead') {
      // Double-Headed Battle Axe
      ctx.fillStyle = '#64748B';
      ctx.fillRect(10, -38, 4, 38);
      ctx.fillStyle = '#94A3B8';
      ctx.beginPath();
      ctx.arc(12, -32, 12, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Sword
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(10, -42, 4, 38);
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(6, -14, 12, 4);
    }
    ctx.restore();
  }

  _renderPlayer(ctx, p) {
    const sx = p.x - this.cameraX;
    const sy = p.z - p.y;

    // Ground Shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(sx, p.z, 18, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Invulnerability Blinking
    if (p.invulnTimer > 0 && Math.floor(p.invulnTimer * 12) % 2 === 0) return;

    // If Mounted on Chicken Leg or Dragon, render mount first
    if (p.mount) {
      this._renderMount(ctx, p.mount);
    }

    ctx.save();
    ctx.translate(sx, sy - (p.mount ? 28 : 0));
    ctx.scale(p.facing, 1);

    const h = p.hero;

    // Animated Leg Steps
    const legOffset = (p.state === 'WALK' || p.state === 'RUN') ? Math.sin(performance.now() * 0.012) * 6 : 0;
    ctx.fillStyle = '#78350F';
    ctx.fillRect(-6 + legOffset, 0, 6, 16);
    ctx.fillRect(1 - legOffset, 0, 6, 16);

    // Tunic / Armor Belt
    ctx.fillStyle = h.clothColor;
    ctx.fillRect(-9, -14, 18, 14);

    // Torso / Musculature
    ctx.fillStyle = h.skinColor;
    ctx.fillRect(-8, -28, 16, 18);

    // Head & Iconic Hairstyle
    ctx.fillStyle = h.skinColor;
    ctx.fillRect(-6, -40, 12, 12);
    ctx.fillStyle = h.hairColor;
    ctx.fillRect(-7, -44, 14, 7);

    // Weapon Swings during Attack
    ctx.save();
    if (p.state === 'ATTACK' || p.state === 'DASH_ATTACK' || p.state === 'JUMP_ATTACK') {
      const slashAngle = (0.4 - p.stateTimer) * 4.0;
      ctx.translate(6, -20);
      ctx.rotate(slashAngle);

      if (h.id === 'giliusthunderhead') {
        // Battle Axe Swing
        ctx.fillStyle = '#64748B';
        ctx.fillRect(-2, -32, 4, 34);
        ctx.fillStyle = '#94A3B8';
        ctx.beginPath();
        ctx.arc(0, -28, 14, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Sword Slash Arc
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(-2, -36, 4, 38);
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(-5, -6, 10, 4);

        // Neon Blade Slashing Trail
        ctx.strokeStyle = PALETTE.CYAN;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 42, -Math.PI * 0.4, Math.PI * 0.3);
        ctx.stroke();
      }
    } else {
      // Idle / Walking weapon resting on shoulder
      if (h.id === 'giliusthunderhead') {
        ctx.fillStyle = '#64748B';
        ctx.fillRect(8, -32, 4, 32);
        ctx.fillStyle = '#94A3B8';
        ctx.beginPath();
        ctx.arc(10, -28, 10, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(8, -38, 4, 38);
        ctx.fillStyle = PALETTE.GOLD;
        ctx.fillRect(5, -12, 10, 3);
      }
    }
    ctx.restore();

    ctx.restore();
  }

  _renderEnemy(ctx, e) {
    const sx = e.x - this.cameraX;
    const sy = e.z - e.y;

    // Ground Shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(sx, e.z, e.isBoss ? 26 : 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(e.facing, 1);

    if (e.isThief) {
      // Small agile blue or green imp thief with sack over shoulder
      ctx.fillStyle = e.color;
      ctx.fillRect(-7, -22, 14, 18);
      // Imp pointed ears & cap
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(0, -32);
      ctx.lineTo(-8, -20);
      ctx.lineTo(8, -20);
      ctx.closePath();
      ctx.fill();
      // Burlap Loot Sack
      ctx.fillStyle = '#B45309';
      ctx.beginPath();
      ctx.arc(-10, -14, 9, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.isFinalBoss) {
      // DEATH ADDER: Towering giant armored warlord with Golden Axe
      const scale = 1.45;
      ctx.scale(scale, scale);

      // Heavy Horned Helm
      ctx.fillStyle = '#1E1B4B';
      ctx.fillRect(-12, -48, 24, 20);
      ctx.fillStyle = PALETTE.GOLD;
      ctx.beginPath();
      ctx.moveTo(-12, -48);
      ctx.lineTo(-24, -62);
      ctx.lineTo(-12, -40);
      ctx.moveTo(12, -48);
      ctx.lineTo(24, -62);
      ctx.lineTo(12, -40);
      ctx.fill();

      // Armored Torso & Cape
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(-18, -36, 36, 40); // Crimson Cape
      ctx.fillStyle = '#312E81';
      ctx.fillRect(-14, -38, 28, 24); // Steel Breastplate

      // Giant Golden Battle Axe
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(16, -56, 6, 60);
      ctx.beginPath();
      ctx.arc(19, -46, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.WHITE;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (e.type === 'badbrother') {
      // Bad Brother Giant Hammer Bruiser
      const scale = 1.35;
      ctx.scale(scale, scale);

      ctx.fillStyle = e.color;
      ctx.fillRect(-12, -38, 24, 26);
      ctx.fillStyle = '#FBBF24';
      ctx.fillRect(-8, -48, 16, 14);

      // Colossal War Hammer
      ctx.fillStyle = '#475569';
      ctx.fillRect(14, -45, 6, 48);
      ctx.fillRect(8, -45, 18, 14);
    } else if (e.type === 'skeleton') {
      // Resilient Undead Skeleton
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(-6, -34, 12, 14); // Ribs
      ctx.fillRect(-5, -44, 10, 10); // Skull
      // Red glowing eye sockets
      ctx.fillStyle = PALETTE.RED;
      ctx.fillRect(-3, -40, 2, 2);
      ctx.fillRect(1, -40, 2, 2);
      // Scimitar & Round Shield
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(8, -36, 3, 30);
      ctx.fillStyle = '#64748B';
      ctx.beginPath();
      ctx.arc(-8, -24, 10, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Regular Club Grunt or Amazon Swordsman
      ctx.fillStyle = e.color;
      ctx.fillRect(-8, -30, 16, 18);
      ctx.fillStyle = '#FBBF24';
      ctx.fillRect(-6, -40, 12, 12);
      ctx.fillStyle = '#475569';
      ctx.fillRect(8, -34, 4, 28);
    }

    ctx.restore();

    // Enemy Health Bar (for tough enemies & bosses)
    if (e.isBoss || e.hp < e.maxHp) {
      const hpRatio = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(sx - 20, sy - 65, 40, 5);
      ctx.fillStyle = e.isBoss ? PALETTE.GOLD : PALETTE.RED;
      ctx.fillRect(sx - 19, sy - 64, 38 * hpRatio, 3);
    }
  }

  _renderMount(ctx, m) {
    const sx = m.x - this.cameraX;
    const sy = m.z - m.y;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(m.facing, 1);

    if (m.type === 'cockatrice') {
      // Chicken Leg: Pink/Rose bipedal reptile with long sweeping whip tail
      ctx.fillStyle = m.color;
      ctx.beginPath();
      ctx.arc(0, -18, 16, 0, Math.PI * 2);
      ctx.fill();

      // Beak & Head
      ctx.beginPath();
      ctx.moveTo(12, -22);
      ctx.lineTo(26, -18);
      ctx.lineTo(12, -12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(18, -20, 8, 4);

      // Long Whipping Lizard Tail
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-12, -18);
      ctx.quadraticCurveTo(-30, -32, -45, -12);
      ctx.stroke();

      // Bipedal Legs
      ctx.fillStyle = '#78350F';
      ctx.fillRect(-6, -4, 4, 14);
      ctx.fillRect(4, -4, 4, 14);
    } else {
      // Fire Dragon: Blue/Teal armored dragon quadruped
      ctx.fillStyle = m.color;
      ctx.fillRect(-18, -20, 36, 18);
      // Dragon Horned Head
      ctx.beginPath();
      ctx.moveTo(16, -26);
      ctx.lineTo(34, -18);
      ctx.lineTo(16, -10);
      ctx.closePath();
      ctx.fill();
      // Glowing eye
      ctx.fillStyle = PALETTE.GOLD;
      ctx.fillRect(20, -22, 3, 3);
      // Legs
      ctx.fillStyle = '#0369A1';
      ctx.fillRect(-14, -4, 6, 14);
      ctx.fillRect(10, -4, 6, 14);
    }
    ctx.restore();
  }

  _renderDrop(ctx, d) {
    const sx = d.x - this.cameraX;
    const sy = d.z;

    if (d.type === 'potion') {
      // Glowing Blue Magic Potion Jar
      this.renderer.drawGlowCircle(sx, sy - 8, 7, PALETTE.CYAN, 10, true);
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(sx - 3, sy - 18, 6, 5);
    } else {
      // Roasted Meat Leg (Restores Health)
      this.renderer.drawGlowCircle(sx, sy - 8, 8, '#B45309', 8, true);
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(sx - 12, sy - 8, 6, 4);
    }
  }

  _renderMagicCinematic(ctx) {
    const p = this.player;
    const t = this.magicTimer;

    if (p.hero.magicType === 'FIRE') {
      // Screen-filling Dragon Inferno
      ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
      ctx.fillRect(0, 0, this.width, this.height);

      // Colossal Golden Fire Dragon Head sweeps across screen
      ctx.save();
      const dragX = (1.0 - t / 2.4) * (this.width + 400) - 200;
      ctx.translate(dragX, 220);

      this.renderer.drawGlowCircle(0, 0, 75, PALETTE.GOLD, 30, true);
      ctx.fillStyle = PALETTE.ORANGE;
      ctx.beginPath();
      ctx.moveTo(40, -40);
      ctx.lineTo(110, 0);
      ctx.lineTo(40, 40);
      ctx.closePath();
      ctx.fill();

      // Billowing flame breath particles
      for (let i = 0; i < 8; i++) {
        this.renderer.drawGlowCircle(
          80 + i * 45,
          Math.sin(performance.now() * 0.02 + i) * 35,
          24 - i * 2,
          PALETTE.RED,
          16,
          true
        );
      }
      ctx.restore();
    } else if (p.hero.magicType === 'EARTH') {
      // Seismic Earth Tremor & Rising Stone Spikes
      ctx.fillStyle = 'rgba(217, 119, 6, 0.35)';
      ctx.fillRect(0, 0, this.width, this.height);

      for (let x = 60; x < this.width; x += 90) {
        ctx.fillStyle = '#78350F';
        ctx.beginPath();
        ctx.moveTo(x, 480);
        ctx.lineTo(x + 25, 260 + Math.sin(x) * 40);
        ctx.lineTo(x + 50, 480);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = PALETTE.GOLD;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else {
      // Divine Lightning Storm
      ctx.fillStyle = Math.floor(t * 20) % 2 === 0 ? 'rgba(255, 255, 255, 0.45)' : 'rgba(14, 165, 233, 0.35)';
      ctx.fillRect(0, 0, this.width, this.height);

      for (let i = 0; i < 5; i++) {
        const lx = 120 + i * 180 + Math.sin(t * 10 + i) * 40;
        ctx.strokeStyle = PALETTE.WHITE;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx - 20, 160);
        ctx.lineTo(lx + 25, 280);
        ctx.lineTo(lx - 10, 450);
        ctx.stroke();
      }
    }
  }

  _renderHUD(ctx) {
    const p = this.player;

    // Top HUD Bar
    this.renderer.drawHUD({
      title: this.title,
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.stage,
      extraLabel: `${p.hero.name.toUpperCase()}  |  STAGE ${this.stage}`,
      accent: p.hero.themeColor
    });

    // Bottom Status Panel: Health Bar & Blue Magic Potions
    ctx.save();

    // Health Bar
    const hpRatio = Math.max(0, p.hp / p.maxHp);
    this.renderer.drawText('LIFE:', 40, 520, {
      font: FONTS.HEADER,
      size: 11,
      color: PALETTE.WHITE
    });
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = PALETTE.GOLD;
    ctx.lineWidth = 2;
    ctx.fillRect(85, 508, 180, 16);
    ctx.strokeRect(85, 508, 180, 16);

    const hpCol = hpRatio > 0.4 ? PALETTE.GREEN : PALETTE.RED;
    this.renderer.drawGlowRect(87, 510, 176 * hpRatio, 12, hpCol, 6, true);

    // Magic Potion Slots
    this.renderer.drawText('MAGIC POTIONS:', 310, 520, {
      font: FONTS.HEADER,
      size: 11,
      color: PALETTE.CYAN
    });
    for (let k = 0; k < p.maxPotions; k++) {
      const potX = 445 + k * 24;
      if (k < p.potions) {
        this.renderer.drawGlowCircle(potX, 516, 6, PALETTE.CYAN, 8, true);
        ctx.fillStyle = PALETTE.WHITE;
        ctx.fillRect(potX - 2, 509, 4, 3);
      } else {
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(potX - 5, 510, 10, 12);
      }
    }

    // Controls reminder
    this.renderer.drawText('Z: ATTACK/COMBO  |  X: JUMP  |  C/ENTER: CAST MAGIC', 620, 520, {
      font: FONTS.HEADER,
      size: 9.5,
      color: PALETTE.GRAY
    });

    ctx.restore();

    this.renderer.drawStateOverlay(this.state, {
      title: this.title,
      subtitle: '1989 SEGA 2.5D BELT-SCROLLING FANTASY BEAT EM UP',
      controls: 'ARROWS: 2.5D MOVEMENT  |  Z: ATTACK / COMBO  |  X: JUMP  |  C/ENTER: MAGIC',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GOLD
    });
  }
}

export default GoldenAxe;
