import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface DebrisPiece {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  angle: number;
  spin: number;
  type: 'hull_plate' | 'solar_array' | 'plasma_booster' | 'quantum_core';
  value: number;
  color: string;
  heldBy: PlayerId | null;
}

interface DerelictSatellite {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  angle: number;
  spin: number;
}

interface SalvageTug {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  baseMaxSpeed: number;
  radius: number;
  score: number;
  heldCargo: DebrisPiece[];

  // Hold-to-Charge Magnetic Tractor Pulse
  isCharging: boolean;
  chargeTime: number; // 0 to 1.2s
  isPulseActive: boolean;
  pulseTimer: number;
  isEmpStunned: boolean;
  stunTimer: number;

  shuntCooldown: number;
  isUnderdog: boolean;

  // Mascot emotion
  mood: CharacterMood;
  moodTimer: number;
  animTimer: number;
}

interface SpaceTheme {
  id: string;
  name: string;
  icon: string;
  spaceDark: string;
  spaceLight: string;
  planetColor: string;
  planetName: string;
  depotGlow: string;
  accentColor: string;
}

const THEMES: SpaceTheme[] = [
  {
    id: 'low_earth_orbit',
    name: 'Low Earth Orbit 🌍',
    icon: '🌍',
    spaceDark: '#010510',
    spaceLight: '#07152B',
    planetColor: '#1E88E5',
    planetName: 'EARTH',
    depotGlow: '#00E676',
    accentColor: '#00E5FF'
  },
  {
    id: 'saturn_rings',
    name: 'Saturn Ring Scrapfield 🪐',
    icon: '🪐',
    spaceDark: '#120E05',
    spaceLight: '#261C08',
    planetColor: '#F59E0B',
    planetName: 'SATURN',
    depotGlow: '#FFD700',
    accentColor: '#FFB300'
  },
  {
    id: 'nebula_salvage',
    name: 'Nebula Scrap Rift 🌌',
    icon: '🌌',
    spaceDark: '#0D0218',
    spaceLight: '#240838',
    planetColor: '#E040FB',
    planetName: 'NEBULA',
    depotGlow: '#00F5FF',
    accentColor: '#E040FB'
  }
];

export class SpaceJunkSalvageGame extends BaseGame {
  public currentMapName: string = 'Low Earth Orbit 🌍';
  private currentThemeIdx: number = 0;

  private tugs: Map<PlayerId, SalvageTug> = new Map();
  private junk: DebrisPiece[] = [];
  private satellites: DerelictSatellite[] = [];
  private junkIdCounter: number = 0;
  private spawnJunkTimer: number = 1.0;

  // Central Recycling Depot
  private depot = { x: 0, y: 0, radius: 56, pulseTimer: 0 };

  // Starfield
  private stars: { x: number; y: number; size: number; alpha: number }[] = [];

  // Bot AI timers
  private botReactionTimers: Map<PlayerId, number> = new Map();

  // Listeners
  private keydownHandler?: (e: KeyboardEvent) => void;
  private clickHandler?: (e: MouseEvent) => void;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
    this.roundTimer = 38.0;

    if (typeof window !== 'undefined') {
      this.keydownHandler = (e: KeyboardEvent) => {
        if (e.code === 'KeyT') {
          this.cycleTheme();
        } else if (e.code === 'Digit1') {
          this.setTheme(0);
        } else if (e.code === 'Digit2') {
          this.setTheme(1);
        } else if (e.code === 'Digit3') {
          this.setTheme(2);
        }
      };
      window.addEventListener('keydown', this.keydownHandler);

      this.clickHandler = (e: MouseEvent) => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
        const mouseY = ((e.clientY - rect.top) / rect.height) * canvas.height;

        // Theme pill: x: 20, y: height - 44, w: 170, h: 32
        const pillY = canvas.height - 44;
        if (mouseX >= 20 && mouseX <= 190 && mouseY >= pillY && mouseY <= pillY + 32) {
          this.cycleTheme();
        }
      };
      window.addEventListener('click', this.clickHandler);
    }
  }

  public override destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);
      if (this.clickHandler) window.removeEventListener('click', this.clickHandler);
    }
    super.destroy();
  }

  public cycleTheme(): void {
    this.setTheme((this.currentThemeIdx + 1) % THEMES.length);
  }

  public setTheme(idx: number): void {
    this.currentThemeIdx = (idx + THEMES.length) % THEMES.length;
    this.currentMapName = THEMES[this.currentThemeIdx].name;
    this.audio.playTap();
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 38.0;
    this.isFinished = false;
    this.tugs.clear();
    this.junk = [];
    this.satellites = [];
    this.stars = [];
    this.junkIdCounter = 0;
    this.spawnJunkTimer = 1.0;

    this.depot = { x: width * 0.5, y: height * 0.52, radius: 56, pulseTimer: 0 };

    // Starfield
    for (let i = 0; i < 75; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.6,
        alpha: 0.3 + Math.random() * 0.7
      });
    }

    // Spawn 2 Derelict Satellites
    this.satellites = [
      { x: width * 0.25, y: height * 0.32, vx: 26, vy: -18, radius: 18, angle: 0, spin: 0.4 },
      { x: width * 0.75, y: height * 0.72, vx: -24, vy: 20, radius: 18, angle: Math.PI, spin: -0.4 }
    ];

    // Spawn 20 initial scrap pieces
    for (let i = 0; i < 20; i++) {
      this.spawnJunkPiece(width, height);
    }

    const active = this.getActivePlayers();
    const spawnCorners = [
      { x: 95, y: 95, angle: Math.PI * 0.25 },
      { x: width - 95, y: 95, angle: Math.PI * 0.75 },
      { x: 95, y: height - 120, angle: -Math.PI * 0.25 },
      { x: width - 95, y: height - 120, angle: -Math.PI * 0.75 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnCorners[idx % spawnCorners.length];
      this.tugs.set(p.id, {
        id: p.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: pos.angle,
        speed: 0,
        baseMaxSpeed: 210,
        radius: 18,
        score: 0,
        heldCargo: [],

        isCharging: false,
        chargeTime: 0,
        isPulseActive: false,
        pulseTimer: 0,
        isEmpStunned: false,
        stunTimer: 0,

        shuntCooldown: 0,
        isUnderdog: false,

        mood: 'idle',
        moodTimer: 0,
        animTimer: idx * 0.3
      });

      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  private spawnJunkPiece(width: number, height: number): void {
    const roll = Math.random();
    let type: DebrisPiece['type'] = 'hull_plate';
    let val = 15;
    let rad = 10;
    let col = '#90A4AE';

    if (roll < 0.42) {
      type = 'hull_plate';
      val = 15;
      rad = 10;
      col = '#B0BEC5';
    } else if (roll < 0.72) {
      type = 'solar_array';
      val = 25;
      rad = 14;
      col = '#1976D2';
    } else if (roll < 0.90) {
      type = 'plasma_booster';
      val = 45;
      rad = 16;
      col = '#FF5722';
    } else {
      type = 'quantum_core';
      val = 80;
      rad = 17;
      col = '#FFD700';
    }

    let x = 0;
    let y = 0;
    do {
      x = 50 + Math.random() * (width - 100);
      y = 60 + Math.random() * (height - 120);
    } while (Math.hypot(x - this.depot.x, y - this.depot.y) < this.depot.radius + 45);

    this.junk.push({
      id: ++this.junkIdCounter,
      x,
      y,
      vx: (Math.random() - 0.5) * 32,
      vy: (Math.random() - 0.5) * 32,
      radius: rad,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 2.2,
      type,
      value: val,
      color: col,
      heldBy: null
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.depot.pulseTimer += dt * 3.0;

    // Spawner to maintain junk in orbit
    this.spawnJunkTimer -= dt;
    if (this.spawnJunkTimer <= 0 && this.junk.length < 22) {
      this.spawnJunkTimer = 2.0 + Math.random() * 1.5;
      this.spawnJunkPiece(width, height);
    }

    // Update satellites
    for (const sat of this.satellites) {
      sat.x += sat.vx * dt;
      sat.y += sat.vy * dt;
      sat.angle += sat.spin * dt;

      if (sat.x < 35 || sat.x > width - 35) sat.vx *= -1;
      if (sat.y < 55 || sat.y > height - 40) sat.vy *= -1;
    }

    // Determine max score for Underdog
    let maxScore = 0;
    for (const t of this.tugs.values()) {
      if (t.score > maxScore) maxScore = t.score;
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();

    // 1. Update Salvage Tugs
    for (const p of active) {
      const tug = this.tugs.get(p.id);
      if (!tug) continue;

      tug.animTimer += dt;
      if (tug.moodTimer > 0) {
        tug.moodTimer -= dt;
        if (tug.moodTimer <= 0) tug.mood = 'idle';
      }

      if (tug.shuntCooldown > 0) tug.shuntCooldown -= dt;

      // Underdog check: trailing by >= 35 pts
      tug.isUnderdog = (maxScore - tug.score >= 35);
      const maxCargoCapacity = tug.isUnderdog ? 4 : 3;

      // Handle EMP stun
      if (tug.stunTimer > 0) {
        tug.stunTimer -= dt;
        tug.vx *= 0.94;
        tug.vy *= 0.94;
        tug.x += tug.vx * dt;
        tug.y += tug.vy * dt;
        if (Math.random() < 0.4) {
          this.particles.emit(tug.x, tug.y, 2, '#FF1744');
        }
        continue;
      }

      const steer = this.input.getSteer(tug.id);
      const isActionHeld = this.input.isPressed(tug.id) || this.input.isActionPressed(tug.id);

      // Turning
      if (steer !== 0) {
        const turnSpeed = tug.isUnderdog ? 4.2 : 3.5;
        tug.angle += steer * turnSpeed * dt;
      }

      // Hold-to-Charge Magnetic Tractor Pulse
      if (isActionHeld && !tug.isEmpStunned) {
        tug.isCharging = true;
        const chargeRate = tug.isUnderdog ? 1.4 : 1.0;
        tug.chargeTime = Math.min(1.2, tug.chargeTime + dt * chargeRate);
        tug.mood = 'focused';

        // Cruise thrust forward while charging
        const thrust = 180;
        tug.vx += Math.cos(tug.angle) * thrust * dt;
        tug.vy += Math.sin(tug.angle) * thrust * dt;

        // Thruster sparks
        if (Math.random() < 0.5) {
          const exX = tug.x - Math.cos(tug.angle) * 16;
          const exY = tug.y - Math.sin(tug.angle) * 16;
          this.particles.emit(exX, exY, 2, '#00E5FF');
        }

        // Overcharge backfire EMP
        if (tug.chargeTime >= 1.2) {
          tug.isEmpStunned = true;
          tug.stunTimer = 1.0;
          tug.chargeTime = 0;
          tug.isCharging = false;
          tug.mood = 'shocked';
          tug.moodTimer = 1.0;

          // Scatter all held cargo!
          for (const piece of tug.heldCargo) {
            piece.heldBy = null;
            piece.vx = (Math.random() - 0.5) * 120;
            piece.vy = (Math.random() - 0.5) * 120;
          }
          tug.heldCargo = [];

          this.audio.playExplosion();
          this.particles.spawnExplosion(tug.x, tug.y, '#FF1744', 16);
        }
      } else if (tug.isCharging) {
        // Released -> Unleash Magnetic Tractor Pulse!
        const chargeRatio = tug.chargeTime / 1.0;
        tug.isCharging = false;
        tug.chargeTime = 0;

        const sweetMin = tug.isUnderdog ? 0.50 : 0.72;
        const sweetMax = tug.isUnderdog ? 1.00 : 0.98;
        const isSweet = chargeRatio >= sweetMin && chargeRatio <= sweetMax;

        if (isSweet) {
          // PERFECT SWEET SPOT: Super-Tractor Omnidirectional Pulse!
          tug.isPulseActive = true;
          tug.pulseTimer = 1.4;
          tug.score += 20; // +20 Grav-Catch Bonus!
          tug.mood = 'triumph';
          tug.moodTimer = 1.2;
          this.audio.playFanfare();
          this.particles.spawnExplosion(tug.x, tug.y, '#00E5FF', 16);

          // Vacuum up loose debris in 180px radius
          for (const j of this.junk) {
            if (j.heldBy !== null && j.heldBy !== tug.id) continue;
            if (Math.hypot(j.x - tug.x, j.y - tug.y) < 185) {
              const pullAngle = Math.atan2(tug.y - j.y, tug.x - j.x);
              j.vx += Math.cos(pullAngle) * 450;
              j.vy += Math.sin(pullAngle) * 450;
            }
          }
        } else if (chargeRatio > 0.25) {
          // Mini frontal tractor cone
          tug.isPulseActive = true;
          tug.pulseTimer = 0.7;
          this.audio.playTap();
          this.particles.emit(tug.x, tug.y, 6, '#80DEEA');
        }
      } else {
        // Forward cruise decay
        const maxCruise = tug.isUnderdog ? tug.baseMaxSpeed * 1.25 : tug.baseMaxSpeed;
        tug.speed = Math.hypot(tug.vx, tug.vy);
        if (tug.speed > maxCruise) {
          tug.vx *= 0.96;
          tug.vy *= 0.96;
        }
      }

      // Pulse timer update
      if (tug.isPulseActive) {
        tug.pulseTimer -= dt;
        if (tug.pulseTimer <= 0) tug.isPulseActive = false;
      }

      // Drag
      tug.vx *= Math.pow(0.97, dt * 60);
      tug.vy *= Math.pow(0.97, dt * 60);
      tug.x += tug.vx * dt;
      tug.y += tug.vy * dt;

      // Arena bounds
      const margin = 24;
      if (tug.x < margin) { tug.x = margin; tug.vx = Math.abs(tug.vx) * 0.7; this.audio.playBounce(); }
      if (tug.x > width - margin) { tug.x = width - margin; tug.vx = -Math.abs(tug.vx) * 0.7; this.audio.playBounce(); }
      if (tug.y < margin + 35) { tug.y = margin + 35; tug.vy = Math.abs(tug.vy) * 0.7; this.audio.playBounce(); }
      if (tug.y > height - margin) { tug.y = height - margin; tug.vy = -Math.abs(tug.vy) * 0.7; this.audio.playBounce(); }

      // Check Cargo Pickups
      if (tug.heldCargo.length < maxCargoCapacity) {
        for (const j of this.junk) {
          if (j.heldBy !== null) continue;
          const dJunk = Math.hypot(j.x - tug.x, j.y - tug.y);

          // Close capture range
          if (dJunk < tug.radius + j.radius + 12) {
            j.heldBy = tug.id;
            tug.heldCargo.push(j);
            tug.mood = 'happy';
            tug.moodTimer = 0.8;
            this.audio.playTap();
            this.particles.emit(j.x, j.y, 4, j.color);
            if (tug.heldCargo.length >= maxCargoCapacity) break;
          }
        }
      }

      // Check Recycling Depot Delivery
      const distToDepot = Math.hypot(tug.x - this.depot.x, tug.y - this.depot.y);
      if (distToDepot < this.depot.radius + 18 && tug.heldCargo.length > 0) {
        // Calculate Combo Multiplier: 1x, 1.5x, 2.5x, 3.5x
        const comboCount = tug.heldCargo.length;
        const comboMult = comboCount === 1 ? 1.0 : (comboCount === 2 ? 1.5 : (comboCount === 3 ? 2.5 : 3.5));
        const suddenDeathMult = this.roundTimer <= 12.0 ? 2 : 1;

        let totalValue = 0;
        for (const piece of tug.heldCargo) {
          totalValue += piece.value;
          // Remove from world
          const idx = this.junk.indexOf(piece);
          if (idx >= 0) this.junk.splice(idx, 1);
        }

        const awardedScore = Math.round(totalValue * comboMult * suddenDeathMult);
        tug.score += awardedScore;
        tug.heldCargo = [];

        tug.mood = 'triumph';
        tug.moodTimer = 1.6;
        this.audio.playFanfare();
        this.particles.spawnConfetti(this.depot.x, this.depot.y, 22);
      }

      // Check Satellite Hazards Collision
      for (const sat of this.satellites) {
        if (Math.hypot(tug.x - sat.x, tug.y - sat.y) < tug.radius + sat.radius) {
          // Struck satellite hazard: EMP blast
          if (!tug.isUnderdog) {
            tug.stunTimer = 1.2;
            tug.mood = 'shocked';
            tug.moodTimer = 1.2;

            for (const cargo of tug.heldCargo) {
              cargo.heldBy = null;
              cargo.vx = (Math.random() - 0.5) * 110;
              cargo.vy = (Math.random() - 0.5) * 110;
            }
            tug.heldCargo = [];

            this.audio.playExplosion();
            this.particles.spawnExplosion(tug.x, tug.y, '#FF1744', 16);
          } else {
            // Underdog has magnetic hazard armor!
            this.audio.playBounce();
          }
        }
      }
    }

    // 2. Physical Elastic Shunting & Cargo Piracy Hijacks ($m_1 v_1 + m_2 v_2$)
    const tugArray = Array.from(this.tugs.values());
    for (let i = 0; i < tugArray.length; i++) {
      for (let j = i + 1; j < tugArray.length; j++) {
        const t1 = tugArray[i];
        const t2 = tugArray[j];
        if (t1.stunTimer > 0 || t2.stunTimer > 0) continue;

        const dx = t2.x - t1.x;
        const dy = t2.y - t1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = t1.radius + t2.radius + 6;

        if (dist < minDist && dist > 0.001) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          t1.x -= nx * overlap * 0.5;
          t1.y -= ny * overlap * 0.5;
          t2.x += nx * overlap * 0.5;
          t2.y += ny * overlap * 0.5;

          // Cargo Piracy Sabotage:
          // Ramming a rival carrying cargo with a pulse or high velocity dislodges their cargo!
          const t1IsRammer = t1.isPulseActive || Math.hypot(t1.vx, t1.vy) > Math.hypot(t2.vx, t2.vy) + 50;
          const t2IsRammer = t2.isPulseActive || Math.hypot(t2.vx, t2.vy) > Math.hypot(t1.vx, t1.vy) + 50;

          if (t1IsRammer && t2.heldCargo.length > 0 && t1.shuntCooldown <= 0) {
            t1.score += 30; // +30 Sabotage Bonus!
            t1.shuntCooldown = 1.0;
            t2.stunTimer = 0.8;
            t2.mood = 'shocked';
            t2.moodTimer = 1.2;
            t1.mood = 'triumph';
            t1.moodTimer = 1.2;

            for (const c of t2.heldCargo) {
              c.heldBy = null;
              c.vx = nx * 140 + (Math.random() - 0.5) * 60;
              c.vy = ny * 140 + (Math.random() - 0.5) * 60;
            }
            t2.heldCargo = [];

            this.audio.playExplosion();
            this.particles.spawnExplosion((t1.x + t2.x) * 0.5, (t1.y + t2.y) * 0.5, '#FF5252', 16);
          } else if (t2IsRammer && t1.heldCargo.length > 0 && t2.shuntCooldown <= 0) {
            t2.score += 30;
            t2.shuntCooldown = 1.0;
            t1.stunTimer = 0.8;
            t1.mood = 'shocked';
            t1.moodTimer = 1.2;
            t2.mood = 'triumph';
            t2.moodTimer = 1.2;

            for (const c of t1.heldCargo) {
              c.heldBy = null;
              c.vx = -nx * 140 + (Math.random() - 0.5) * 60;
              c.vy = -ny * 140 + (Math.random() - 0.5) * 60;
            }
            t1.heldCargo = [];

            this.audio.playExplosion();
            this.particles.spawnExplosion((t1.x + t2.x) * 0.5, (t1.y + t2.y) * 0.5, '#FF5252', 16);
          } else {
            this.audio.playBounce();
            this.particles.emit((t1.x + t2.x) * 0.5, (t1.y + t2.y) * 0.5, 4, '#FFFFFF');
          }

          // Elastic impulse
          const kx = t1.vx - t2.vx;
          const ky = t1.vy - t2.vy;
          const pImpulse = 2 * (nx * kx + ny * ky) / 2;
          t1.vx -= pImpulse * nx * 0.85;
          t1.vy -= pImpulse * ny * 0.85;
          t2.vx += pImpulse * nx * 0.85;
          t2.vy += pImpulse * ny * 0.85;
        }
      }
    }

    // 3. Update Junk Debris Trailing Behind Tugs
    for (const j of this.junk) {
      if (j.heldBy === null) {
        j.x += j.vx * dt;
        j.y += j.vy * dt;
        j.angle += j.spin * dt;
        j.vx *= Math.pow(0.99, dt * 60);
        j.vy *= Math.pow(0.99, dt * 60);

        if (j.x < 20) { j.x = 20; j.vx *= -1; }
        if (j.x > width - 20) { j.x = width - 20; j.vx *= -1; }
        if (j.y < 45) { j.y = 45; j.vy *= -1; }
        if (j.y > height - 20) { j.y = height - 20; j.vy *= -1; }
      } else {
        const tug = this.tugs.get(j.heldBy);
        if (tug) {
          const slot = tug.heldCargo.indexOf(j);
          const followDist = 26 + slot * 18;
          const targetX = tug.x - Math.cos(tug.angle) * followDist;
          const targetY = tug.y - Math.sin(tug.angle) * followDist;
          j.x += (targetX - j.x) * 14 * dt;
          j.y += (targetY - j.y) * 14 * dt;
        } else {
          j.heldBy = null;
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const tug = this.tugs.get(botId);
    if (!tug || tug.stunTimer > 0) return;

    let targetX = this.depot.x;
    let targetY = this.depot.y;
    let holdAction = false;

    // Delivery condition: cargo >= 2 or timer low
    if (tug.heldCargo.length >= 2 || (tug.heldCargo.length >= 1 && this.roundTimer < 8)) {
      targetX = this.depot.x;
      targetY = this.depot.y;
    } else {
      // Find highest value closest junk
      let bestJunk: DebrisPiece | null = null;
      let bestScore = -999;

      for (const j of this.junk) {
        if (j.heldBy !== null) continue;
        const d = Math.hypot(j.x - tug.x, j.y - tug.y);
        const score = (j.value * 2.5) - d * 0.35;
        if (score > bestScore) {
          bestScore = score;
          bestJunk = j;
        }
      }

      if (bestJunk) {
        targetX = bestJunk.x;
        targetY = bestJunk.y;

        const dJunk = Math.hypot(bestJunk.x - tug.x, bestJunk.y - tug.y);
        if (dJunk < 150) {
          if (tug.chargeTime < 0.85) {
            holdAction = true;
          } else {
            holdAction = false; // Sweet spot release!
          }
        }
      }
    }

    // Satellite hazard avoidance
    for (const sat of this.satellites) {
      const dSat = Math.hypot(sat.x - tug.x, sat.y - tug.y);
      if (dSat < 80) {
        const evadeAngle = Math.atan2(tug.y - sat.y, tug.x - sat.x);
        targetX = tug.x + Math.cos(evadeAngle) * 90;
        targetY = tug.y + Math.sin(evadeAngle) * 90;
      }
    }

    const dx = targetX - tug.x;
    const dy = targetY - tug.y;
    const targetAngle = Math.atan2(dy, dx);

    let angleDiff = targetAngle - tug.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    let turn = 0;
    if (Math.abs(angleDiff) > 0.08) {
      turn = angleDiff > 0 ? 1 : -1;
    }

    let delay = 0.24;
    if (difficulty === 'bot_easy') {
      delay = 0.42;
      if (Math.random() < 0.22) turn = -turn;
      if (Math.random() < 0.3) holdAction = false;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11;
      // Hard bot hunts for cargo piracy ramming against loaded rivals
      for (const other of this.tugs.values()) {
        if (other.id === botId) continue;
        if (other.heldCargo.length >= 2 && Math.hypot(other.x - tug.x, other.y - tug.y) < 160) {
          const dxR = other.x - tug.x;
          const dyR = other.y - tug.y;
          const ramAngle = Math.atan2(dyR, dxR);
          let diffR = ramAngle - tug.angle;
          while (diffR > Math.PI) diffR -= Math.PI * 2;
          while (diffR < -Math.PI) diffR += Math.PI * 2;
          turn = diffR > 0 ? 1 : -1;
          holdAction = false; // Unleash pulse to ram!
          break;
        }
      }
    }

    this.input.setBotInput(botId, holdAction, turn, 1, false);
    this.botReactionTimers.set(botId, delay);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const active = this.getActivePlayers();
    const theme = THEMES[this.currentThemeIdx];

    // 1. Orbital Deep Space Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, theme.spaceDark);
    skyGrad.addColorStop(1, theme.spaceLight);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Stars
    for (const s of this.stars) {
      ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }

    // 3. Distant Celestial Planetary Curve in Corner
    ctx.save();
    ctx.beginPath();
    ctx.arc(width * 0.1, height * 1.25, width * 0.65, 0, Math.PI * 2);
    const planetGrad = ctx.createRadialGradient(
      width * 0.1, height * 1.25, width * 0.1,
      width * 0.1, height * 1.25, width * 0.65
    );
    planetGrad.addColorStop(0, theme.planetColor);
    planetGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0.8)');
    planetGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = planetGrad;
    ctx.fill();
    ctx.restore();

    // 4. Central Fusion Recycling Barge / Depot (2.5D Hexagonal Hub)
    ctx.save();
    ctx.translate(this.depot.x, this.depot.y);

    // Intake pulse shockwaves
    const pulseR = this.depot.radius + Math.sin(this.depot.pulseTimer) * 6;
    ctx.strokeStyle = theme.depotGlow;
    ctx.lineWidth = 3;
    ctx.shadowColor = theme.depotGlow;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
    ctx.stroke();

    // Depot main hull
    ctx.fillStyle = '#1A232E';
    ctx.beginPath();
    ctx.arc(0, 0, this.depot.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Core furnace
    ctx.fillStyle = 'rgba(0, 230, 118, 0.25)';
    ctx.beginPath();
    ctx.arc(0, 0, this.depot.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FUSION', 0, -4);
    ctx.fillText('DEPOT', 0, 12);
    ctx.restore();

    // 5. Render Loose Scrap Pieces
    for (const j of this.junk) {
      if (j.heldBy !== null) continue;

      ctx.save();
      ctx.translate(j.x, j.y);
      ctx.rotate(j.angle);

      // Glow halo
      ctx.shadowColor = j.color;
      ctx.shadowBlur = 10;

      if (j.type === 'quantum_core') {
        // Glowing gold satellite core
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(0, 0, j.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 9px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('+80', 0, 3);
      } else if (j.type === 'plasma_booster') {
        // Orange plasma thruster rocket
        ctx.fillStyle = '#FF5722';
        ctx.fillRect(-j.radius * 0.6, -j.radius, j.radius * 1.2, j.radius * 2);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-j.radius * 0.6, -j.radius, j.radius * 1.2, j.radius * 2);
      } else if (j.type === 'solar_array') {
        // Blue solar panel
        ctx.fillStyle = '#1976D2';
        ctx.fillRect(-j.radius, -j.radius * 0.5, j.radius * 2, j.radius);
        ctx.strokeStyle = '#90CAF9';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-j.radius, -j.radius * 0.5, j.radius * 2, j.radius);
      } else {
        // Hexagonal hull plate
        ctx.fillStyle = j.color;
        ctx.beginPath();
        for (let s = 0; s < 6; s++) {
          const a = (s / 6) * Math.PI * 2;
          const px = Math.cos(a) * j.radius;
          const py = Math.sin(a) * j.radius;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      ctx.restore();
    }

    // 6. Derelict Satellites (EMP Hazard)
    for (const sat of this.satellites) {
      ctx.save();
      ctx.translate(sat.x, sat.y);
      ctx.rotate(sat.angle);

      // Hazard aura
      ctx.strokeStyle = 'rgba(255, 23, 68, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, sat.radius + 10, 0, Math.PI * 2);
      ctx.stroke();

      // Satellite bus body
      ctx.fillStyle = '#ECEFF1';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.strokeStyle = '#B0BEC5';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-8, -8, 16, 16);

      // Solar wings
      ctx.fillStyle = '#0288D1';
      ctx.fillRect(-28, -6, 18, 12);
      ctx.fillRect(10, -6, 18, 12);

      // Antenna dish
      ctx.strokeStyle = '#FF1744';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(0, -18);
      ctx.stroke();

      ctx.restore();
    }

    // 7. Render Salvage Tugs & Mascot Pilots
    for (const [id, tug] of this.tugs.entries()) {
      const p = this.players.find(pl => pl.id === id);
      const color = p ? p.color : '#00E5FF';
      const isBot = p ? p.type !== 'human' : false;

      ctx.save();
      ctx.translate(tug.x, tug.y);
      ctx.rotate(tug.angle);

      // Space shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(3, 4, tug.radius + 4, tug.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Magnetic Tractor Pulse Wave
      if (tug.isPulseActive) {
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, tug.radius + 18, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Tug Hull Chassis (2.5D Heavy-Duty Industrial Craft)
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-14, -14);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-14, 14);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Front Reinforced Grapple Clamps
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(12, -7);
      ctx.lineTo(19, -12);
      ctx.moveTo(12, 7);
      ctx.lineTo(19, 12);
      ctx.stroke();

      // Glass Cockpit with Mascot Astronaut Inside
      ctx.save();
      ctx.rotate(Math.PI / 2);
      drawCharacter(ctx, 0, 0, 13, id, isBot, tug.mood, tug.animTimer, undefined);
      ctx.restore();

      // Underdog Grav-Armor
      if (tug.isUnderdog) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, tug.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Hold-to-Charge Magnet Gauge
      if (tug.isCharging) {
        const ratio = tug.chargeTime / 1.0;
        const sweetMin = tug.isUnderdog ? 0.50 : 0.72;
        const sweetMax = tug.isUnderdog ? 1.00 : 0.98;
        const isSweet = ratio >= sweetMin && ratio <= sweetMax;

        ctx.strokeStyle = isSweet ? '#00E5FF' : (ratio > sweetMax ? '#FF1744' : '#FFD700');
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, tug.radius + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ratio));
        ctx.stroke();
      }

      ctx.restore();

      // Render Trailing Held Cargo
      for (const piece of tug.heldCargo) {
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.fillStyle = piece.color;
        ctx.beginPath();
        ctx.arc(0, 0, piece.radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // Floating Score & Cargo counter
      ctx.fillStyle = color;
      ctx.font = 'bold 13px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${tug.score} pts (${tug.heldCargo.length}/${tug.isUnderdog ? 4 : 3})`, tug.x, tug.y - 28);

      if (tug.stunTimer > 0) {
        ctx.fillStyle = '#FF1744';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText('⚡ EMP STUNNED!', tug.x, tug.y - 42);
      } else if (tug.isPulseActive) {
        ctx.fillStyle = '#00E5FF';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.fillText('⚡ TRACTOR PULSE!', tug.x, tug.y - 42);
      }
    }

    // 8. Strict UI Overlays (Top-Center Safe Zone & Header Badge)
    // Global safe zone for timer: y: 12-44, width 160 centered.
    // Minigame Header Badge at y: 56, h: 28
    ctx.save();
    const badgeW = 280;
    const badgeH = 28;
    const badgeX = (width - badgeW) / 2;
    const badgeY = 56;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 14);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPACE JUNK SALVAGE • ORBITAL TUG', width / 2, badgeY + 18);
    ctx.restore();

    // 9. Bottom-Left Theme Pill: x: 20, y: height - 44, w: 170, h: 32
    ctx.save();
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${theme.name} [T]`, pillX + 10, pillY + 20);
    ctx.restore();

    // 10. Player Corner Cards (Safe offset y: height - 128, w: 130, h: 48)
    const cardY = height - 128;
    active.forEach((p, idx) => {
      const tug = this.tugs.get(p.id);
      if (!tug) return;

      const cardX = 20 + idx * 142;
      if (cardX + 130 > width) return;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 130, 48, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = 'bold 12px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 8, cardY + 18);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px Montserrat, sans-serif';
      ctx.fillText(`${tug.score} pts`, cardX + 8, cardY + 38);

      ctx.fillStyle = '#B0BEC5';
      ctx.font = '10px Montserrat, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${tug.heldCargo.length} CARGO`, cardX + 122, cardY + 38);
      ctx.restore();
    });
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const tug = this.tugs.get(p.id);
      return {
        playerId: p.id,
        score: tug ? tug.score : 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null
        ? `Player ${typeof winnerId === 'number' ? winnerId + 1 : winnerId} dominated orbital salvage with master-class tractor maneuvers!`
        : 'All orbital scrap disintegrated in atmospheric re-entry!'
    };
  }
}
