/**
 * Syndicate.js
 * Classic 1993 Bullfrog Productions / Electronic Arts Cyberpunk Tactical Squad Shooter ("Syndicate").
 * Commanded by the legendary Eurocorp executive, lead a squad of 4 cybernetically enhanced
 * trenchcoat-clad agents through dystopian rain-slicked megacities.
 * Features:
 * - 4-Agent Strike Team (Alpha, Bravo, Charlie, Delta) moving in squad formation
 * - Devastating Cyber-Arsenal: Twin Uzis, Minigun, Gauss Cannon, Laser Rifle & the Persuadertron
 * - The Persuadertron: Brainwash rival agents, scientists & civilians into an armed follower army!
 * - IPA Adrenaline Overdrive: Cybernetic reflex booster for hyper-speed & rapid-fire auto-aim
 * - Rain-slicked megacity with neon holographic ads, explosive barrels, police hovercars & corporate plazas
 * - 8 Worldwide Corporate Takeover Missions (London, Berlin, Tokyo, New York, Moscow, Sydney, Rio, Atlantic Sector)
 */
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const WEAPONS = [
  { id: 'uzi', name: 'TWIN UZIS', range: 320, fireRate: 0.12, damage: 1, color: '#FACC15', ammoCost: 1, icon: '🔫' },
  { id: 'minigun', name: 'MINIGUN', range: 420, fireRate: 0.05, damage: 1.5, color: '#FB923C', ammoCost: 1, icon: '🔥' },
  { id: 'gauss', name: 'GAUSS GUN', range: 480, fireRate: 0.45, damage: 8, color: '#38BDF8', ammoCost: 3, icon: '💥' },
  { id: 'laser', name: 'LASER RIFLE', range: 500, fireRate: 0.22, damage: 4, color: '#00F0FF', ammoCost: 2, icon: '⚡' },
  { id: 'persuader', name: 'PERSUADERTRON', range: 240, fireRate: 0.18, damage: 0, color: '#C084FC', ammoCost: 0, icon: '🧠' }
];

const MISSIONS = [
  { level: 1, city: 'LONDON', targetText: 'ELIMINATE 10 RIVAL ENFORCERS', requiredKills: 10, requiredPersuaded: 0, rainIntensity: 0.6 },
  { level: 2, city: 'BERLIN', targetText: 'PERSUADE 8 CITIZENS WITH PERSUADERTRON', requiredKills: 0, requiredPersuaded: 8, rainIntensity: 0.7 },
  { level: 3, city: 'TOKYO', targetText: 'DESTROY 14 RIVAL SYNDICATE GUARDS', requiredKills: 14, requiredPersuaded: 0, rainIntensity: 0.8 },
  { level: 4, city: 'NEW YORK', targetText: 'ASSASSINATE 18 CORPORATE ENFORCERS', requiredKills: 18, requiredPersuaded: 0, rainIntensity: 0.85 },
  { level: 5, city: 'MOSCOW', targetText: 'CONVERT 12 SCIENTISTS TO EUROCORP', requiredKills: 0, requiredPersuaded: 12, rainIntensity: 0.9 },
  { level: 6, city: 'SYDNEY', targetText: 'NEUTRALIZE 20 RIVAL CYBORG AGENTS', requiredKills: 20, requiredPersuaded: 0, rainIntensity: 0.75 },
  { level: 7, city: 'RIO', targetText: 'PERSUADE 16 INFORMANTS & CLEAR ENFORCERS', requiredKills: 10, requiredPersuaded: 16, rainIntensity: 0.95 },
  { level: 8, city: 'ATLANTIC SECTOR', targetText: 'FINAL GLOBAL SYNDICATE TAKEOVER (ELIMINATE 25 AGENTS)', requiredKills: 25, requiredPersuaded: 0, rainIntensity: 1.0 }
];

export class Syndicate {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'syndicate';
    this.title = 'Syndicate';

    this.state = 'PLAYING';
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.stage = 1;

    // Viewport dimensions
    this.width = 960;
    this.height = 540;

    // World Map dimensions (scrolling megacity)
    this.worldW = 1600;
    this.worldH = 1200;
    this.camera = { x: 0, y: 0 };

    // Squad configuration: 4 Agents in formation
    this.agents = [];
    this.selectedWeaponIdx = 0; // 0: Uzi, 1: Minigun, 2: Gauss, 3: Laser, 4: Persuadertron
    this.fireCooldown = 0;

    // IPA Adrenaline Overdrive
    this.adrenaline = 100;
    this.isOverdrive = false;
    this.overdriveTimer = 0;

    // World Entities
    this.enemies = [];
    this.civilians = [];
    this.persuaded = []; // Mind-controlled follower entourage
    this.bullets = [];
    this.particles = [];
    this.popups = [];
    this.barrels = [];
    this.buildings = [];
    this.rainDrops = [];

    // Mission Progress
    this.missionKills = 0;
    this.missionPersuaded = 0;
    this.missionClearTimer = 0;
    this.missionFailedTimer = 0;
    this.animTime = 0;

    this._initRain();
    this._initCityMap();
    this._setupTouchLabels();
    this.reset();
  }

  _setupTouchLabels() {
    if (typeof document === 'undefined') return;
    const subA = document.querySelector('#touch-btn-a .btn-sub-label');
    const subB = document.querySelector('#touch-btn-b .btn-sub-label');
    const mainA = document.querySelector('#touch-btn-a .btn-main-label');
    const mainB = document.querySelector('#touch-btn-b .btn-main-label');
    if (subA) subA.textContent = 'FIRE ARSENAL (Z)';
    if (subB) subB.textContent = 'OVERDRIVE / IPA (X)';
    if (mainA) mainA.textContent = 'FIRE';
    if (mainB) mainB.textContent = 'STIM';
  }

  _restoreTouchLabels() {
    if (typeof document === 'undefined') return;
    const subA = document.querySelector('#touch-btn-a .btn-sub-label');
    const subB = document.querySelector('#touch-btn-b .btn-sub-label');
    const mainA = document.querySelector('#touch-btn-a .btn-main-label');
    const mainB = document.querySelector('#touch-btn-b .btn-main-label');
    if (subA) subA.textContent = 'ACT / DIG-L / JUMP';
    if (subB) subB.textContent = 'ALT / DIG-R / SLAP';
    if (mainA) mainA.textContent = 'A';
    if (mainB) mainB.textContent = 'B';
  }

  _initRain() {
    this.rainDrops = [];
    for (let i = 0; i < 180; i++) {
      this.rainDrops.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        len: 12 + Math.random() * 16,
        speed: 550 + Math.random() * 250,
        alpha: 0.15 + Math.random() * 0.25
      });
    }
  }

  _initCityMap() {
    this.buildings = [];
    // Megacity Skyscraper Corporate Blocks
    const blocks = [
      { x: 100, y: 100, w: 280, h: 220, name: 'EUROCORP R&D', color: '#1E293B', neon: PALETTE.CYAN },
      { x: 480, y: 100, w: 320, h: 220, name: 'BIO-SYNTH LABS', color: '#0F172A', neon: '#EC4899' },
      { x: 920, y: 100, w: 300, h: 220, name: 'DATA-CORE BANK', color: '#1E293B', neon: PALETTE.GOLD },
      { x: 100, y: 440, w: 260, h: 280, name: 'CYBER-POLICE HQ', color: '#0F172A', neon: '#3B82F6' },
      { x: 480, y: 440, w: 340, h: 280, name: 'CENTRAL PLAZA', color: '#1E1B4B', neon: '#A855F7' },
      { x: 940, y: 440, w: 280, h: 280, name: 'CASTELLAN TOWER', color: '#0F172A', neon: PALETTE.RED },
      { x: 100, y: 840, w: 360, h: 240, name: 'SUBWAY CONCOURSE', color: '#1E293B', neon: PALETTE.CYAN },
      { x: 580, y: 840, w: 300, h: 240, name: 'NEO-MARKET SLUMS', color: '#0F172A', neon: '#F97316' },
      { x: 1000, y: 840, w: 260, h: 240, name: 'EXECUTIVE LANDING', color: '#1E293B', neon: PALETTE.GOLD }
    ];
    this.buildings = blocks;

    // Explosive barrels around alleys
    this.barrels = [
      { x: 420, y: 220, hp: 3, maxHp: 3 },
      { x: 440, y: 240, hp: 3, maxHp: 3 },
      { x: 840, y: 380, hp: 3, maxHp: 3 },
      { x: 420, y: 760, hp: 3, maxHp: 3 },
      { x: 880, y: 780, hp: 3, maxHp: 3 },
      { x: 520, y: 760, hp: 3, maxHp: 3 },
      { x: 1260, y: 520, hp: 3, maxHp: 3 }
    ];
  }

  reset() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.stage = 1;
    this.highScore = HighScoreStore.get(this.id);
    this.state = 'PLAYING';
    this.initStage(this.level);
  }

  initStage(lvl) {
    this.level = lvl;
    this.stage = lvl;
    this.mission = MISSIONS[(lvl - 1) % MISSIONS.length];

    this.missionKills = 0;
    this.missionPersuaded = 0;
    this.missionClearTimer = 0;
    this.missionFailedTimer = 0;
    this.adrenaline = 100;
    this.isOverdrive = false;
    this.overdriveTimer = 0;

    this.bullets = [];
    this.particles = [];
    this.persuaded = [];

    // Initialize 4 Eurocorp Trenchcoat Agents
    const startX = 260;
    const startY = 380;
    this.agents = [
      { id: 'alpha', name: 'AGENT ALPHA', x: startX, y: startY, hp: 100, maxHp: 100, speed: 190, angle: 0, coatColor: '#3B271E', alive: true },
      { id: 'bravo', name: 'AGENT BRAVO', x: startX - 24, y: startY + 18, hp: 100, maxHp: 100, speed: 190, angle: 0, coatColor: '#2D1F17', alive: true },
      { id: 'charlie', name: 'AGENT CHARLIE', x: startX - 24, y: startY - 18, hp: 100, maxHp: 100, speed: 190, angle: 0, coatColor: '#362419', alive: true },
      { id: 'delta', name: 'AGENT DELTA', x: startX - 44, y: startY, hp: 100, maxHp: 100, speed: 190, angle: 0, coatColor: '#281B14', alive: true }
    ];

    // Spawn Rival Syndicate Enforcers
    this.enemies = [];
    const enemyCount = 12 + lvl * 3;
    for (let i = 0; i < enemyCount; i++) {
      const eX = 520 + Math.random() * 800;
      const eY = 160 + Math.random() * 850;
      this.enemies.push({
        id: `rival_${i}`,
        x: eX,
        y: eY,
        hp: 12 + lvl * 2,
        maxHp: 12 + lvl * 2,
        speed: 120 + Math.random() * 40,
        angle: Math.PI,
        fireTimer: Math.random() * 1.5,
        fireInterval: 1.2 + Math.random() * 1.0,
        color: i % 3 === 0 ? '#DC2626' : '#991B1B',
        isLeader: i === 0,
        name: i === 0 ? 'CASTELLAN EXECUTIVE' : 'RIVAL AGENT'
      });
    }

    // Spawn Civilians & Scientists
    this.civilians = [];
    const civCount = 18 + lvl * 2;
    for (let i = 0; i < civCount; i++) {
      this.civilians.push({
        id: `civ_${i}`,
        x: 200 + Math.random() * 1100,
        y: 200 + Math.random() * 800,
        hp: 4,
        speed: 70 + Math.random() * 30,
        angle: Math.random() * Math.PI * 2,
        isScientist: i % 4 === 0,
        color: i % 4 === 0 ? '#38BDF8' : '#94A3B8',
        walkTimer: Math.random() * 2
      });
    }

    if (this.audio) {
      this.audio.playMusic('syndicate', true);
    }

    this.popups.push({
      text: `EUROCORP DISPATCH: ${this.mission.city}`,
      x: this.width / 2,
      y: 180,
      color: PALETTE.CYAN,
      size: 18,
      life: 2.5
    });
    this.popups.push({
      text: `MISSION: ${this.mission.targetText}`,
      x: this.width / 2,
      y: 215,
      color: PALETTE.GOLD,
      size: 14,
      life: 3.0
    });
  }

  _initLevel(lvl) {
    this.initStage(lvl);
  }

  loadLevel(lvl) {
    this.initStage(lvl);
  }

  setState(state) {
    this.state = state;
    if (state === 'GAMEOVER') {
      HighScoreStore.submit(this.id, this.score);
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
        color,
        size: label ? 14 : 12,
        life: 1.3
      });
    }
  }

  triggerOverdrive() {
    if (this.adrenaline < 25 || this.isOverdrive) return;
    this.isOverdrive = true;
    this.overdriveTimer = 4.5;
    this.adrenaline = Math.max(0, this.adrenaline - 35);

    if (this.audio) {
      this.audio.playPowerUp();
      this.audio.playNote(580, 0.25, 'sawtooth', 0.28, 0);
      this.audio.playNote(880, 0.35, 'square', 0.25, 0.1);
    }

    const lead = this._getLeadAgent();
    if (lead) {
      this.popups.push({
        text: '⚡ IPA ADRENALINE OVERDRIVE ACTIVATED!',
        x: this.width / 2,
        y: 190,
        color: PALETTE.CYAN,
        size: 16,
        life: 1.5
      });
    }
  }

  cycleWeapon(dir = 1) {
    this.selectedWeaponIdx = (this.selectedWeaponIdx + dir + WEAPONS.length) % WEAPONS.length;
    const w = WEAPONS[this.selectedWeaponIdx];
    if (this.audio) this.audio.playMenuMove();
    this.popups.push({
      text: `${w.icon} WEAPON: ${w.name}`,
      x: this.width / 2,
      y: 120,
      color: w.color,
      size: 14,
      life: 1.1
    });
  }

  _getLeadAgent() {
    return this.agents.find((a) => a.alive) || null;
  }

  update(dt) {
    if (this.state !== 'PLAYING') {
      if (this.state === 'GAMEOVER') {
        if (
          this.input.isJustPressed('actionA') ||
          this.input.isJustPressed('actionB') ||
          this.input.isKeyJustPressed('KeyZ') ||
          this.input.isKeyJustPressed('KeyX') ||
          this.input.isKeyJustPressed('Space')
        ) {
          this.reset();
        }
      }
      return;
    }

    this.animTime += dt;

    // Regenerate IPA Adrenaline
    if (!this.isOverdrive && this.adrenaline < 100) {
      this.adrenaline = Math.min(100, this.adrenaline + dt * 8);
    }

    if (this.isOverdrive) {
      this.overdriveTimer -= dt;
      if (this.overdriveTimer <= 0) {
        this.isOverdrive = false;
      }
    }

    this._updateRain(dt);
    this._updatePlayerSquad(dt);
    this._updateFollowers(dt);
    this._updateEnemies(dt);
    this._updateCivilians(dt);
    this._updateBullets(dt);
    this._updateParticles(dt);
    this._updatePopups(dt);

    // Check Stage Success / Failure
    this._checkMissionStatus(dt);
  }

  _updateRain(dt) {
    for (const r of this.rainDrops) {
      r.y += r.speed * dt;
      r.x -= 80 * dt; // Angle of wind
      if (r.y > this.height) {
        r.y = -r.len;
        r.x = Math.random() * (this.width + 100);
      }
    }
  }

  _updatePlayerSquad(dt) {
    const lead = this._getLeadAgent();
    if (!lead) {
      // Squad wiped out
      this.lives--;
      if (this.lives <= 0) {
        this.state = 'GAMEOVER';
        HighScoreStore.submit(this.id, this.score);
        if (this.audio) this.audio.playGameOver();
      } else {
        this.initStage(this.level);
      }
      return;
    }

    // Directional Movement
    let dx = 0;
    let dy = 0;
    const axis = this.input.getAxis ? this.input.getAxis() : { x: 0, y: 0 };
    dx += axis.x;
    dy += axis.y;

    if (this.input.isDown('left') || this.input.isKeyDown('ArrowLeft') || this.input.isKeyDown('KeyA')) dx -= 1;
    if (this.input.isDown('right') || this.input.isKeyDown('ArrowRight') || this.input.isKeyDown('KeyD')) dx += 1;
    if (this.input.isDown('up') || this.input.isKeyDown('ArrowUp') || this.input.isKeyDown('KeyW')) dy -= 1;
    if (this.input.isDown('down') || this.input.isKeyDown('ArrowDown') || this.input.isKeyDown('KeyS')) dy += 1;

    // Pointer Navigation / Aim
    const ptr = this.input.pointer;
    let targetWorldX = lead.x;
    let targetWorldY = lead.y;

    if (ptr && ptr.down && ptr.y > 60 && ptr.y < this.height - 40) {
      targetWorldX = ptr.x + this.camera.x;
      targetWorldY = ptr.y + this.camera.y;
      const pDx = targetWorldX - lead.x;
      const pDy = targetWorldY - lead.y;
      const dist = Math.hypot(pDx, pDy);
      if (dist > 30) {
        dx = pDx / dist;
        dy = pDy / dist;
      }
    }

    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }

    // Speed multiplier from Overdrive
    const spd = (lead.speed * (this.isOverdrive ? 1.6 : 1.0)) * dt;
    lead.x += dx * spd;
    lead.y += dy * spd;

    // Keep lead in world bounds & avoid buildings
    lead.x = Math.max(30, Math.min(this.worldW - 30, lead.x));
    lead.y = Math.max(30, Math.min(this.worldH - 30, lead.y));
    this._resolveBuildingCollision(lead);

    if (dx !== 0 || dy !== 0) {
      lead.angle = Math.atan2(dy, dx);
    } else if (ptr && ptr.down) {
      lead.angle = Math.atan2(targetWorldY - lead.y, targetWorldX - lead.x);
    }

    // Camera follow lead smoothly
    const targetCamX = lead.x - this.width / 2;
    const targetCamY = lead.y - this.height / 2;
    this.camera.x += (targetCamX - this.camera.x) * 8 * dt;
    this.camera.y += (targetCamY - this.camera.y) * 8 * dt;
    this.camera.x = Math.max(0, Math.min(this.worldW - this.width, this.camera.x));
    this.camera.y = Math.max(0, Math.min(this.worldH - this.height, this.camera.y));

    // Squadmate formation following
    const formationOffsets = [
      { x: 0, y: 0 },
      { x: -26, y: 20 },
      { x: -26, y: -20 },
      { x: -48, y: 0 }
    ];

    let aliveIdx = 0;
    for (const a of this.agents) {
      if (!a.alive) continue;
      if (a !== lead) {
        const off = formationOffsets[aliveIdx] || { x: -30, y: 0 };
        // Rotate offset by lead angle
        const cosA = Math.cos(lead.angle);
        const sinA = Math.sin(lead.angle);
        const rotX = off.x * cosA - off.y * sinA;
        const rotY = off.x * sinA + off.y * cosA;

        const destX = lead.x + rotX;
        const destY = lead.y + rotY;

        a.x += (destX - a.x) * 6 * dt;
        a.y += (destY - a.y) * 6 * dt;
        a.angle = lead.angle;
        this._resolveBuildingCollision(a);
      }
      aliveIdx++;
    }

    // Weapon Switching (`KeyC`, `KeyQ`, `KeyE`, `Digit1`..`Digit5`)
    if (this.input.isKeyJustPressed('KeyC') || this.input.isKeyJustPressed('KeyE')) {
      this.cycleWeapon(1);
    }
    if (this.input.isKeyJustPressed('KeyQ')) {
      this.cycleWeapon(-1);
    }
    for (let k = 1; k <= 5; k++) {
      if (this.input.isKeyJustPressed(`Digit${k}`)) {
        this.selectedWeaponIdx = k - 1;
        this.cycleWeapon(0);
      }
    }

    // Overdrive Stim Trigger (`actionB`, `KeyX`, `Shift`)
    if (
      this.input.isJustPressed('actionB') ||
      this.input.isKeyJustPressed('KeyX') ||
      this.input.isKeyJustPressed('ShiftLeft')
    ) {
      this.triggerOverdrive();
    }

    // Fire Weapon Trigger (`actionA`, `KeyZ`, `Space`, Pointer)
    if (this.fireCooldown > 0) {
      this.fireCooldown -= dt;
    }

    const fireHeld =
      this.input.isDown('actionA') ||
      this.input.isKeyDown('KeyZ') ||
      this.input.isKeyDown('Space') ||
      (ptr && ptr.down && ptr.x > this.width * 0.7 && ptr.y > this.height * 0.65);

    if (fireHeld && this.fireCooldown <= 0) {
      this._fireSquadArsenal();
      const curW = WEAPONS[this.selectedWeaponIdx];
      this.fireCooldown = curW.fireRate * (this.isOverdrive ? 0.55 : 1.0);
    }
  }

  _fireSquadArsenal() {
    const curW = WEAPONS[this.selectedWeaponIdx];

    // Find nearest aim target
    const lead = this._getLeadAgent();
    if (!lead) return;

    let targetAngle = lead.angle;
    const nearestEnemy = this._findNearestEnemy(lead.x, lead.y, curW.range);
    if (nearestEnemy) {
      targetAngle = Math.atan2(nearestEnemy.y - lead.y, nearestEnemy.x - lead.x);
    }

    // Persuadertron Mind-Control Wave
    if (curW.id === 'persuader') {
      if (this.audio) {
        this.audio.playNote(420, 0.16, 'sine', 0.25, 0);
        this.audio.playNote(630, 0.22, 'triangle', 0.2, 0.06);
      }
      this._activatePersuadertron(lead.x, lead.y, curW.range);
      return;
    }

    // Fire for each living agent in squad
    for (const a of this.agents) {
      if (!a.alive) continue;

      const spread = (Math.random() - 0.5) * (curW.id === 'minigun' ? 0.22 : 0.08);
      const shotAngle = targetAngle + spread;
      const speed = curW.id === 'gauss' ? 650 : curW.id === 'laser' ? 900 : 720;

      this.bullets.push({
        x: a.x + Math.cos(shotAngle) * 14,
        y: a.y + Math.sin(shotAngle) * 14,
        vx: Math.cos(shotAngle) * speed,
        vy: Math.sin(shotAngle) * speed,
        damage: curW.damage,
        type: curW.id,
        color: curW.color,
        fromPlayer: true,
        life: curW.range / speed
      });

      // Muzzle flash particle
      this._spawnMuzzleFlash(a.x + Math.cos(shotAngle) * 12, a.y + Math.sin(shotAngle) * 12, curW.color);
    }

    // Also fire for armed persuaded followers!
    for (const p of this.persuaded) {
      if (Math.random() < 0.4) {
        const pAngle = targetAngle + (Math.random() - 0.5) * 0.35;
        this.bullets.push({
          x: p.x,
          y: p.y,
          vx: Math.cos(pAngle) * 580,
          vy: Math.sin(pAngle) * 580,
          damage: 1,
          type: 'uzi',
          color: '#FACC15',
          fromPlayer: true,
          life: 0.6
        });
      }
    }

    // Play Sound FX
    if (this.audio) {
      if (curW.id === 'minigun') {
        this.audio.playLaser(820, 260, 0.04);
      } else if (curW.id === 'gauss') {
        this.audio.playExplosion(0.4, 400);
      } else if (curW.id === 'laser') {
        this.audio.playLaser(1200, 480, 0.12);
      } else {
        this.audio.playLaser(940, 320, 0.06);
      }
    }
  }

  _activatePersuadertron(cx, cy, range) {
    // Expanding psychedelic ring particle
    for (let r = 0; r < 14; r++) {
      const a = (r / 14) * Math.PI * 2;
      this.particles.push({
        x: cx + Math.cos(a) * 15,
        y: cy + Math.sin(a) * 15,
        vx: Math.cos(a) * 120,
        vy: Math.sin(a) * 120,
        life: 0.35,
        maxLife: 0.35,
        color: '#C084FC',
        r: 3
      });
    }

    // Check Civilians in range
    for (let i = this.civilians.length - 1; i >= 0; i--) {
      const civ = this.civilians[i];
      if (Math.hypot(civ.x - cx, civ.y - cy) <= range) {
        this.civilians.splice(i, 1);
        this.persuaded.push({
          x: civ.x,
          y: civ.y,
          speed: civ.speed * 1.3,
          color: '#C084FC',
          isScientist: civ.isScientist
        });
        this.missionPersuaded++;
        this.addScore(250, civ.x, civ.y, '#C084FC', 'PERSUADED!');
        if (this.audio) this.audio.playCoin();
      }
    }

    // Check Enemies in range (lowered HP easier to convert)
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (Math.hypot(e.x - cx, e.y - cy) <= range * 0.75) {
        if (e.hp < e.maxHp * 0.6) {
          this.enemies.splice(i, 1);
          this.persuaded.push({
            x: e.x,
            y: e.y,
            speed: 150,
            color: '#A855F7',
            isScientist: false
          });
          this.missionPersuaded++;
          this.addScore(600, e.x, e.y, '#A855F7', 'AGENT PERSUADED!');
          if (this.audio) this.audio.playCoin();
        }
      }
    }
  }

  _updateFollowers(dt) {
    const lead = this._getLeadAgent();
    if (!lead) return;

    for (let i = 0; i < this.persuaded.length; i++) {
      const p = this.persuaded[i];
      const targetDist = 45 + (i % 6) * 16;
      const angle = (i * 0.9) + this.animTime * 0.5;
      const targetX = lead.x + Math.cos(angle) * targetDist;
      const targetY = lead.y + Math.sin(angle) * targetDist;

      p.x += (targetX - p.x) * 4 * dt;
      p.y += (targetY - p.y) * 4 * dt;
      this._resolveBuildingCollision(p);
    }
  }

  _updateEnemies(dt) {
    const lead = this._getLeadAgent();

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      if (lead) {
        const dist = Math.hypot(lead.x - e.x, lead.y - e.y);
        e.angle = Math.atan2(lead.y - e.y, lead.x - e.x);

        // Advance towards squad if in detection radius (450px)
        if (dist < 480) {
          e.x += Math.cos(e.angle) * e.speed * dt;
          e.y += Math.sin(e.angle) * e.speed * dt;
          this._resolveBuildingCollision(e);

          // Enemy shooting
          e.fireTimer += dt;
          if (e.fireTimer >= e.fireInterval) {
            e.fireTimer = 0;
            this._enemyShoot(e, lead);
          }
        }
      }

      // Check death
      if (e.hp <= 0) {
        this.enemies.splice(i, 1);
        this.missionKills++;
        this.addScore(e.isLeader ? 1500 : 350, e.x, e.y, PALETTE.RED, e.isLeader ? 'EXECUTIVE DOWN!' : 'AGENT DOWN');
        this._spawnBloodSpatter(e.x, e.y);
        if (this.audio) this.audio.playExplosion(0.35, 750);
      }
    }
  }

  _enemyShoot(e, target) {
    const angle = Math.atan2(target.y - e.y, target.x - e.x) + (Math.random() - 0.5) * 0.2;
    this.bullets.push({
      x: e.x + Math.cos(angle) * 12,
      y: e.y + Math.sin(angle) * 12,
      vx: Math.cos(angle) * 520,
      vy: Math.sin(angle) * 520,
      damage: 8,
      type: 'rival_laser',
      color: '#EF4444',
      fromPlayer: false,
      life: 0.8
    });
    if (this.audio) this.audio.playLaser(780, 220, 0.05);
  }

  _updateCivilians(dt) {
    for (const c of this.civilians) {
      c.walkTimer -= dt;
      if (c.walkTimer <= 0) {
        c.walkTimer = 1.5 + Math.random() * 2.5;
        c.angle = Math.random() * Math.PI * 2;
      }
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      c.x = Math.max(40, Math.min(this.worldW - 40, c.x));
      c.y = Math.max(40, Math.min(this.worldH - 40, c.y));
      this._resolveBuildingCollision(c);
    }
  }

  _updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      if (b.life <= 0 || b.x < 0 || b.x > this.worldW || b.y < 0 || b.y > this.worldH) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Check collision with Explosive Barrels
      let hitBarrel = false;
      for (const bar of this.barrels) {
        if (bar.hp > 0 && Math.hypot(b.x - bar.x, b.y - bar.y) < 16) {
          bar.hp -= b.damage;
          hitBarrel = true;
          if (bar.hp <= 0) {
            this._detonateBarrel(bar);
          }
          break;
        }
      }
      if (hitBarrel) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Check collision with Buildings
      if (this._isPointInsideBuilding(b.x, b.y)) {
        this._spawnSparks(b.x, b.y, b.color, 4);
        this.bullets.splice(i, 1);
        continue;
      }

      if (b.fromPlayer) {
        // Player bullet hits Enemy
        let hitEnemy = false;
        for (const e of this.enemies) {
          if (Math.hypot(b.x - e.x, b.y - e.y) < 18) {
            e.hp -= b.damage;
            hitEnemy = true;
            this._spawnBloodSpatter(b.x, b.y, 4);

            if (b.type === 'gauss') {
              this._spawnExplosion(b.x, b.y, 28);
            }
            break;
          }
        }
        if (hitEnemy) {
          this.bullets.splice(i, 1);
          continue;
        }
      } else {
        // Enemy bullet hits Player Squad
        let hitSquad = false;
        for (const a of this.agents) {
          if (a.alive && Math.hypot(b.x - a.x, b.y - a.y) < 16) {
            a.hp -= b.damage;
            hitSquad = true;
            this._spawnBloodSpatter(b.x, b.y, 5);
            if (a.hp <= 0) {
              a.alive = false;
              this.popups.push({
                text: `💀 ${a.name} TERMINATED!`,
                x: this.width / 2,
                y: 200,
                color: PALETTE.RED,
                size: 15,
                life: 1.5
              });
              if (this.audio) this.audio.playExplosion(0.6, 500);
            }
            break;
          }
        }

        // Also check if enemy bullet hits persuaded follower
        if (!hitSquad) {
          for (let pIdx = this.persuaded.length - 1; pIdx >= 0; pIdx--) {
            const p = this.persuaded[pIdx];
            if (Math.hypot(b.x - p.x, b.y - p.y) < 14) {
              this.persuaded.splice(pIdx, 1);
              hitSquad = true;
              this._spawnBloodSpatter(p.x, p.y, 4);
              break;
            }
          }
        }

        if (hitSquad) {
          this.bullets.splice(i, 1);
          continue;
        }
      }
    }
  }

  _detonateBarrel(bar) {
    this._spawnExplosion(bar.x, bar.y, 45);
    if (this.audio) this.audio.playExplosion(0.8, 350);

    // Area damage
    for (const e of this.enemies) {
      if (Math.hypot(e.x - bar.x, e.y - bar.y) < 90) {
        e.hp -= 25;
      }
    }
    for (const a of this.agents) {
      if (a.alive && Math.hypot(a.x - bar.x, a.y - bar.y) < 80) {
        a.hp -= 15;
      }
    }
  }

  _checkMissionStatus(dt) {
    if (this.missionClearTimer > 0) {
      this.missionClearTimer -= dt;
      if (this.missionClearTimer <= 0) {
        this.initStage(this.level + 1);
      }
      return;
    }

    const hasKills = this.mission.requiredKills === 0 || this.missionKills >= this.mission.requiredKills;
    const hasPersuaded = this.mission.requiredPersuaded === 0 || this.missionPersuaded >= this.mission.requiredPersuaded;

    if (hasKills && hasPersuaded && this.missionClearTimer <= 0) {
      this.missionClearTimer = 2.8;
      this.addScore(3000, this.width / 2, 220, PALETTE.GOLD, 'MISSION SUCCESS!');
      if (this.audio) this.audio.playStageClear();
    }
  }

  _findNearestEnemy(x, y, maxRange) {
    let nearest = null;
    let minDist = maxRange;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < minDist) {
        minDist = d;
        nearest = e;
      }
    }
    return nearest;
  }

  _resolveBuildingCollision(entity) {
    const pad = 12;
    for (const b of this.buildings) {
      if (
        entity.x > b.x - pad &&
        entity.x < b.x + b.w + pad &&
        entity.y > b.y - pad &&
        entity.y < b.y + b.h + pad
      ) {
        const left = Math.abs(entity.x - (b.x - pad));
        const right = Math.abs(entity.x - (b.x + b.w + pad));
        const top = Math.abs(entity.y - (b.y - pad));
        const bottom = Math.abs(entity.y - (b.y + b.h + pad));
        const minEdge = Math.min(left, right, top, bottom);

        if (minEdge === left) entity.x = b.x - pad;
        else if (minEdge === right) entity.x = b.x + b.w + pad;
        else if (minEdge === top) entity.y = b.y - pad;
        else entity.y = b.y + b.h + pad;
      }
    }
  }

  _isPointInsideBuilding(x, y) {
    for (const b of this.buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        return true;
      }
    }
    return false;
  }

  _spawnMuzzleFlash(x, y, color) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.08,
      maxLife: 0.08,
      color,
      r: 6
    });
  }

  _spawnBloodSpatter(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 30 + Math.random() * 80;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        color: '#DC2626',
        r: 2 + Math.random() * 2
      });
    }
  }

  _spawnExplosion(x, y, radius = 24) {
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0.35 + Math.random() * 0.4,
        maxLife: 0.7,
        color: i % 3 === 0 ? PALETTE.GOLD : i % 2 === 0 ? PALETTE.ORANGE : PALETTE.RED,
        r: 3 + Math.random() * (radius * 0.2)
      });
    }
  }

  _spawnSparks(x, y, color = PALETTE.GOLD, count = 4) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 20 + Math.random() * 70;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0.15 + Math.random() * 0.2,
        maxLife: 0.35,
        color,
        r: 1.5
      });
    }
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  _updatePopups(dt) {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.life -= dt;
      pop.y -= 20 * dt;
      if (pop.life <= 0) {
        this.popups.splice(i, 1);
      }
    }
  }

  render(ctx = this.renderer.ctx) {
    ctx.save();

    // 1. Dark Dystopian Asphalt Ground
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);

    // 2. City Grid & Wet Pavement Reflections
    this._renderCityMap(ctx);

    // 3. Barrels & Environmental Objects
    this._renderBarrels(ctx);

    // 4. Civilians & Follower Entourage
    this._renderCiviliansAndFollowers(ctx);

    // 5. Rival Syndicate Enemies
    this._renderEnemies(ctx);

    // 6. Player Squad (Eurocorp Agents in Trenchcoats)
    this._renderPlayerSquad(ctx);

    // 7. Bullets & Lasers
    this._renderBullets(ctx);

    // 8. Particles & Blood
    this._renderParticles(ctx);

    ctx.restore();

    // 9. Cyberpunk Rain Overlay
    this._renderRain(ctx);

    // 10. Tactical HUD & IPA Stimulator Gauges
    this._renderHUD(ctx);

    // 11. Popups
    this._renderPopups(ctx);

    // 12. Mission Clear / Game Over Overlays
    if (this.missionClearTimer > 0) {
      this._renderMissionClear(ctx);
    } else if (this.state === 'GAMEOVER') {
      this._renderGameOver(ctx);
    }

    ctx.restore();
  }

  _renderCityMap(ctx) {
    // Street asphalt lanes
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, this.worldW, this.worldH);

    // Neon Road Markings & Zebra Crossings
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.lineWidth = 2;
    for (let x = 60; x < this.worldW; x += 380) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.worldH);
      ctx.stroke();
    }
    for (let y = 60; y < this.worldH; y += 360) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.worldW, y);
      ctx.stroke();
    }

    // Corporate Skyscraper Blocks with Isometric Bevels & Neon Signage
    for (const b of this.buildings) {
      // Base roof
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // Cyber Bezel
      ctx.strokeStyle = b.neon;
      ctx.lineWidth = 2;
      ctx.shadowColor = b.neon;
      ctx.shadowBlur = 8;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.shadowBlur = 0;

      // Holographic Corporate Logo Banner
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(b.x + 12, b.y + 12, b.w - 24, 28);
      ctx.fillStyle = b.neon;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.name, b.x + b.w / 2, b.y + 26);
    }
  }

  _renderBarrels(ctx) {
    for (const bar of this.barrels) {
      if (bar.hp <= 0) continue;
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.arc(bar.x, bar.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Yellow hazard stripe
      ctx.fillStyle = '#FACC15';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', bar.x, bar.y);
    }
  }

  _renderCiviliansAndFollowers(ctx) {
    // Normal Civilians
    for (const c of this.civilians) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);

      // Civilian body & coat
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      // Umbrella / Head
      ctx.fillStyle = c.isScientist ? '#38BDF8' : '#334155';
      ctx.fillRect(-2, -4, 4, 8);
      ctx.restore();
    }

    // Persuaded Followers Entourage
    for (const p of this.persuaded) {
      ctx.save();
      ctx.translate(p.x, p.y);

      // Glowing mind-control halo
      ctx.strokeStyle = '#C084FC';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, -6, 5, 0, Math.PI * 2);
      ctx.stroke();

      // Follower body
      ctx.fillStyle = '#A855F7';
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
      ctx.fill();

      // Drawn Uzi
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(4, -2, 6, 3);
      ctx.restore();
    }
  }

  _renderEnemies(ctx) {
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 8, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Rival Combat Armor
      ctx.fillStyle = e.color;
      ctx.fillRect(-6, -7, 12, 14);

      // Cyber helmet / red visor
      ctx.fillStyle = '#18181B';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(2, -2, 4, 4);

      // Weapon
      ctx.fillStyle = '#71717A';
      ctx.fillRect(4, 2, 8, 3);

      // Health bar
      if (e.hp < e.maxHp) {
        ctx.restore();
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(-12, -16, 24, 3);
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(-12, -16, 24 * (e.hp / e.maxHp), 3);
      }

      ctx.restore();
    }
  }

  _renderPlayerSquad(ctx) {
    for (const a of this.agents) {
      if (!a.alive) continue;

      ctx.save();
      ctx.translate(a.x, a.y);

      // Overdrive motion trail blur
      if (this.isOverdrive) {
        ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
        ctx.beginPath();
        ctx.arc(-Math.cos(a.angle) * 8, -Math.sin(a.angle) * 8, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      // Drop shadow on wet ground
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 9, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(a.angle);

      // Authentic Trenchcoat Silhouette (wide shoulders, trailing coat tails)
      ctx.fillStyle = a.coatColor;
      ctx.beginPath();
      ctx.moveTo(8, -6);
      ctx.lineTo(10, 6);
      ctx.lineTo(-10, 8);
      ctx.lineTo(-8, -8);
      ctx.closePath();
      ctx.fill();

      // Trenchcoat lapels & collar
      ctx.fillStyle = '#1C1917';
      ctx.fillRect(-3, -4, 6, 8);

      // Cybernetic Head & Sunglasses / Glowing Cyan Eye Visor
      ctx.fillStyle = '#FBBF24'; // Skin tone
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      // Cyber Visor / Dark Shades
      ctx.fillStyle = this.isOverdrive ? '#00F0FF' : '#0F172A';
      ctx.fillRect(1, -2.5, 4, 5);

      // Cyber Weapon in hands
      const curW = WEAPONS[this.selectedWeaponIdx];
      ctx.fillStyle = curW.color;
      ctx.fillRect(4, 2, 9, 3);

      // Health bar over squad member
      ctx.restore();
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-12, -18, 24, 3);
      ctx.fillStyle = a.hp > 40 ? '#22C55E' : '#EF4444';
      ctx.fillRect(-12, -18, 24 * (a.hp / a.maxHp), 3);
      ctx.restore();
    }
  }

  _renderBullets(ctx) {
    for (const b of this.bullets) {
      ctx.save();
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = b.type === 'laser' ? 10 : 4;

      if (b.type === 'laser') {
        ctx.fillRect(b.x - 2, b.y - 2, 10, 4);
      } else if (b.type === 'gauss') {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(b.x - 1.5, b.y - 1.5, 4, 4);
      }
      ctx.restore();
    }
  }

  _renderParticles(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _renderRain(ctx) {
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const r of this.rainDrops) {
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x - 5, r.y + r.len);
    }
    ctx.stroke();
  }

  _renderHUD(ctx) {
    ctx.save();

    // Top Bar Background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(0, 0, this.width, 38);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, this.width, 38);

    // City & Target Objective
    ctx.fillStyle = PALETTE.CYAN;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`CITY: ${this.mission.city}  |  OBJECTIVE: ${this.mission.targetText}`, 20, 24);

    // Score & High Score
    ctx.fillStyle = PALETTE.GOLD;
    ctx.textAlign = 'right';
    ctx.fillText(`SCORE: ${this.score.toString().padStart(6, '0')}  HIGH: ${this.highScore.toString().padStart(6, '0')}`, this.width - 20, 24);

    // Bottom Tactical Panel: Weapon Selector & IPA Adrenaline Stimulator
    const panelY = this.height - 42;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(15, panelY, 480, 34);
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.strokeRect(15, panelY, 480, 34);

    // Current Weapon
    const curW = WEAPONS[this.selectedWeaponIdx];
    ctx.fillStyle = curW.color;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${curW.icon} WEAPON [C]: ${curW.name}`, 26, panelY + 22);

    // Followers Count
    ctx.fillStyle = '#C084FC';
    ctx.fillText(`🧠 FOLLOWERS: ${this.persuaded.length}`, 220, panelY + 22);

    // IPA Adrenaline Bar
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('IPA [X]:', 330, panelY + 22);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(380, panelY + 11, 100, 14);
    ctx.fillStyle = this.isOverdrive ? '#00F0FF' : '#38BDF8';
    ctx.fillRect(380, panelY + 11, this.adrenaline, 14);

    ctx.restore();
  }

  _renderPopups(ctx) {
    for (const pop of this.popups) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, pop.life * 1.5);
      ctx.fillStyle = pop.color;
      ctx.font = `bold ${pop.size}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }
  }

  _renderMissionClear(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = PALETTE.GOLD;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EUROCORP MISSION ACCOMPLISHED', this.width / 2, 220);

    ctx.fillStyle = PALETTE.CYAN;
    ctx.font = '16px monospace';
    ctx.fillText(`SECTOR ${this.mission.city} CONQUERED! PREPARING NEXT DEPLOYMENT...`, this.width / 2, 270);

    ctx.restore();
  }

  _renderGameOver(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = PALETTE.RED;
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SYNDICATE AGENTS TERMINATED', this.width / 2, 220);

    ctx.fillStyle = PALETTE.GOLD;
    ctx.font = '18px monospace';
    ctx.fillText(`FINAL CONQUEST SCORE: ${this.score}`, this.width / 2, 275);

    ctx.fillStyle = PALETTE.CYAN;
    ctx.font = '14px monospace';
    ctx.fillText('PRESS FIRE OR TAP SCREEN TO RE-DEPLOY STRIKE TEAM', this.width / 2, 330);

    ctx.restore();
  }

  captureState() {
    return {
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      stage: this.stage,
      state: this.state,
      missionKills: this.missionKills,
      missionPersuaded: this.missionPersuaded,
      selectedWeaponIdx: this.selectedWeaponIdx,
      adrenaline: this.adrenaline
    };
  }

  restoreState(state) {
    if (!state) return;
    this.score = state.score || 0;
    this.highScore = state.highScore || 0;
    this.lives = state.lives !== undefined ? state.lives : 3;
    const tgtStage = state.stage !== undefined ? state.stage : (state.level || 1);
    this.level = state.level !== undefined ? state.level : tgtStage;
    this.state = state.state || 'PLAYING';
    this.missionKills = state.missionKills || 0;
    this.missionPersuaded = state.missionPersuaded || 0;
    this.selectedWeaponIdx = state.selectedWeaponIdx || 0;
    this.adrenaline = state.adrenaline !== undefined ? state.adrenaline : 100;

    this.initStage(tgtStage);
    this.stage = tgtStage;
  }

  destroy() {
    this._restoreTouchLabels();
    if (this.audio) {
      this.audio.stopSequence();
    }
  }
}
