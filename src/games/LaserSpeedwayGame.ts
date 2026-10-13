import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type LaserSpeedwayThemeId = 'tron_circuit' | 'solar_speedway' | 'cyber_underground';

interface SpeedwayTheme {
  id: LaserSpeedwayThemeId;
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  trackFloor: string;
  railColor: string;
  railGlow: string;
  curbColor: string;
  accentColor: string;
  heatColor: string;
}

const THEMES: Record<LaserSpeedwayThemeId, SpeedwayTheme> = {
  tron_circuit: {
    id: 'tron_circuit',
    name: 'Tron Neon Grid',
    icon: '⚡',
    bgGradTop: '#050714',
    bgGradBottom: '#020308',
    trackFloor: '#0b1124',
    railColor: '#00f0ff',
    railGlow: '#00f0ff',
    curbColor: '#ff007f',
    accentColor: '#00f0ff',
    heatColor: '#ef4444'
  },
  solar_speedway: {
    id: 'solar_speedway',
    name: 'Solar Superhighway',
    icon: '🌌',
    bgGradTop: '#160824',
    bgGradBottom: '#090310',
    trackFloor: '#1e0c33',
    railColor: '#f59e0b',
    railGlow: '#f59e0b',
    curbColor: '#8b5cf6',
    accentColor: '#fbbf24',
    heatColor: '#f97316'
  },
  cyber_underground: {
    id: 'cyber_underground',
    name: 'Cyber Underground',
    icon: '🏙️',
    bgGradTop: '#0a0d14',
    bgGradBottom: '#040508',
    trackFloor: '#141822',
    railColor: '#10b981',
    railGlow: '#10b981',
    curbColor: '#eab308',
    accentColor: '#10b981',
    heatColor: '#f43f5e'
  }
};

const THEME_ORDER: LaserSpeedwayThemeId[] = ['tron_circuit', 'solar_speedway', 'cyber_underground'];

interface TrackPickup {
  id: number;
  progress: number; // 0 to 1 along circuit
  lane: number; // 0, 1, 2, 3
  type: 'cryo_gate' | 'energy_orb' | 'emp_disruptor' | 'golden_core';
  bobble: number;
}

interface SlotCarState {
  id: PlayerId;
  progress: number; // 0 to 1 around track loop
  lane: number; // 0 (inner) to 3 (outer)
  targetLane: number;
  laneLerp: number; // continuous float lane for smooth visual translation
  speed: number;
  heat: number; // 0 to 100%
  isOverheated: boolean;
  overheatTimer: number;
  surgeTimer: number;
  isDrafting: boolean;
  draftRivalId: PlayerId | null;
  draftTimer: number;
  laps: number;
  score: number;
  shuntCooldown: number;
  lastShovedBy: PlayerId | null;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  animTime: number;
}

interface FloatingSpeedwayText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export class LaserSpeedwayGame extends BaseGame {
  public currentTheme: LaserSpeedwayThemeId = 'tron_circuit';
  public playersState: Map<PlayerId, SlotCarState> = new Map();

  private trackCenterX: number = 0;
  private trackCenterY: number = 0;
  private radiusX: number = 240;
  private radiusY: number = 150;
  private totalLaps: number = 4;

  private pickups: TrackPickup[] = [];
  private pickupSpawnTimer: number = 1.8;
  private pickupIdCounter: number = 0;
  private floatingTexts: FloatingSpeedwayText[] = [];
  private textIdCounter: number = 0;

  private botReactionTimers: Map<PlayerId, number> = new Map();
  private screenShake: number = 0;
  private hitStopTimer: number = 0;
  private animTimer: number = 0;

  private keydownHandler?: (e: KeyboardEvent) => void;
  private clickHandler?: (e: MouseEvent) => void;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 35.0;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (typeof window !== 'undefined') {
      this.keydownHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.cycleTheme();
        } else if (e.key === '1') {
          this.setTheme('tron_circuit');
        } else if (e.key === '2') {
          this.setTheme('solar_speedway');
        } else if (e.key === '3') {
          this.setTheme('cyber_underground');
        }
      };
      window.addEventListener('keydown', this.keydownHandler);

      this.clickHandler = (e: MouseEvent) => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        // Theme Pill at bottom-left
        const pillX = 20;
        const pillY = canvas.height - 44;
        const pillW = 170;
        const pillH = 32;

        if (
          clickX >= pillX &&
          clickX <= pillX + pillW &&
          clickY >= pillY &&
          clickY <= pillY + pillH
        ) {
          this.cycleTheme();
        }
      };
      window.addEventListener('click', this.clickHandler);
    }
  }

  public setTheme(theme: LaserSpeedwayThemeId): void {
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnSparks(105, 556, THEMES[theme].accentColor, 16);
  }

  public cycleTheme(): void {
    const curIdx = THEME_ORDER.indexOf(this.currentTheme);
    const nextIdx = (curIdx + 1) % THEME_ORDER.length;
    this.setTheme(THEME_ORDER[nextIdx]);
  }

  public override destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) window.removeEventListener('keydown', this.keydownHandler);
      if (this.clickHandler) window.removeEventListener('click', this.clickHandler);
    }
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.playersState.clear();
    this.pickups = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.animTimer = 0;
    this.pickupIdCounter = 0;

    this.trackCenterX = width / 2;
    this.trackCenterY = height * 0.53;
    this.radiusX = Math.min(270, width * 0.34);
    this.radiusY = Math.min(170, height * 0.28);

    // Initial pickups on track
    for (let i = 0; i < 6; i++) {
      this.spawnRandomPickup(i / 6);
    }

    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      const assignedLane = idx % 4;
      const startProg = 0.96 - idx * 0.04;

      this.playersState.set(p.id, {
        id: p.id,
        progress: startProg,
        lane: assignedLane,
        targetLane: assignedLane,
        laneLerp: assignedLane,
        speed: 0.18,
        heat: 0,
        isOverheated: false,
        overheatTimer: 0,
        surgeTimer: 0,
        isDrafting: false,
        draftRivalId: null,
        draftTimer: 0,
        laps: 0,
        score: 0,
        shuntCooldown: 0,
        lastShovedBy: null,
        isUnderdog: false,
        currentMood: 'idle',
        animTime: 0
      });

      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  private spawnRandomPickup(preferredProg?: number): void {
    const types: ('cryo_gate' | 'energy_orb' | 'emp_disruptor' | 'golden_core')[] = [
      'cryo_gate',
      'energy_orb',
      'emp_disruptor',
      'golden_core'
    ];
    const roll = Math.random();
    let type: 'cryo_gate' | 'energy_orb' | 'emp_disruptor' | 'golden_core' = 'energy_orb';
    if (roll < 0.35) type = 'cryo_gate';
    else if (roll < 0.65) type = 'energy_orb';
    else if (roll < 0.85) type = 'emp_disruptor';
    else type = 'golden_core';

    const prog = preferredProg !== undefined ? preferredProg : Math.random();
    const lane = Math.floor(Math.random() * 4);

    this.pickups.push({
      id: ++this.pickupIdCounter,
      progress: prog,
      lane,
      type,
      bobble: Math.random() * Math.PI * 2
    });
  }

  private addFloatingText(text: string, x: number, y: number, color: string, size: number = 14): void {
    this.floatingTexts.push({
      id: ++this.textIdCounter,
      text,
      x,
      y,
      color,
      size,
      life: 0.9,
      maxLife: 0.9
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.animTimer += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y -= dt * 28;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Dynamic pickups spawn
    this.pickupSpawnTimer -= dt;
    const maxPickups = this.roundTimer <= 15 ? 8 : 6;
    if (this.pickupSpawnTimer <= 0 && this.pickups.length < maxPickups) {
      this.pickupSpawnTimer = this.roundTimer <= 15 ? 1.0 + Math.random() * 0.8 : 1.6 + Math.random() * 1.2;
      this.spawnRandomPickup();
    }
    for (const pu of this.pickups) {
      pu.bobble += dt * 4;
    }

    // Underdog calculation
    let maxScore = -1;
    const active = this.getActivePlayers();
    for (const p of active) {
      const c = this.playersState.get(p.id);
      if (!c) continue;
      if (c.score > maxScore) maxScore = c.score;
    }
    for (const p of active) {
      const c = this.playersState.get(p.id);
      if (!c) continue;
      c.isUnderdog = maxScore - c.score >= 50 && c.score < maxScore;
    }

    // Bot AI update
    this.updateBots(dt, width, height);

    // Update each slot car
    for (const p of active) {
      const car = this.playersState.get(p.id);
      if (!car) continue;

      car.animTime += dt * 6;
      if (car.shuntCooldown > 0) car.shuntCooldown -= dt;

      // Handle Overheat blowout stun
      if (car.isOverheated) {
        car.overheatTimer -= dt;
        car.speed *= Math.pow(0.2, dt);
        car.currentMood = 'shocked';
        const carPos = this.getCarCoords(car.progress, car.laneLerp);
        if (Math.random() < 0.4) {
          this.particles.spawnSparks(carPos.x, carPos.y, '#ef4444', 3);
        }
        if (car.overheatTimer <= 0) {
          car.isOverheated = false;
          car.heat = 15;
          car.currentMood = 'idle';
        }
      }

      // Input Lane Changing
      const steer = this.input.getSteer(p.id);
      const isGas = this.input.isActionPressed(p.id) || this.input.isPressed(p.id) || this.input.getThrottle(p.id) > 0.1;

      if (!car.isOverheated) {
        // Lateral lane switching (-1 left/inward, +1 right/outward)
        if (Math.abs(steer) > 0.45 && car.shuntCooldown <= 0) {
          if (steer < -0.45 && car.lane > 0) {
            car.lane--;
            car.shuntCooldown = 0.32;
            this.audio.playTap();
          } else if (steer > 0.45 && car.lane < 3) {
            car.lane++;
            car.shuntCooldown = 0.32;
            this.audio.playTap();
          }
        }

        // Smooth visual lane interpolation
        car.laneLerp += (car.lane - car.laneLerp) * (18 * dt);

        // Curvature check: are we in the banked hairpin corners?
        // Progress 0.15 to 0.42 = Right corner; 0.65 to 0.92 = Left corner
        const inCorner =
          (car.progress > 0.12 && car.progress < 0.44) ||
          (car.progress > 0.62 && car.progress < 0.94);

        // Throttle & Heat management
        if (isGas) {
          car.currentMood = 'focused';
          const maxSpeed = (car.surgeTimer > 0 ? 0.65 : 0.44) * (car.isUnderdog ? 1.25 : 1.0);
          car.speed = Math.min(maxSpeed, car.speed + 0.65 * dt);

          // Heat accumulation (inside lanes build heat faster due to tight radius)
          const laneHeatFactor = 1.0 + (3 - car.lane) * 0.2;
          const heatRate = (inCorner ? 58 : 22) * laneHeatFactor * (car.isUnderdog ? 0.5 : 1.0);
          car.heat = Math.min(100, car.heat + heatRate * dt);

          // Exhaust spark particles
          const carPos = this.getCarCoords(car.progress, car.laneLerp);
          if (Math.random() < 0.3) {
            this.particles.emit(carPos.x, carPos.y, 1, car.isUnderdog ? '#fbbf24' : p.color);
          }
        } else {
          // Release gas: Check Sweet Spot Hyper-Surge vs Cooling
          if (car.heat >= 80 && car.heat < 99 && car.surgeTimer <= 0) {
            // Sweet spot discharge!
            car.surgeTimer = 1.0;
            car.score += 25;
            car.heat = 20;
            car.speed = 0.62;
            this.audio.playWhoosh();
            this.screenShake = 5;

            const carPos = this.getCarCoords(car.progress, car.laneLerp);
            this.particles.spawnSparks(carPos.x, carPos.y, '#00f0ff', 14);
            this.addFloatingText('⚡ LASER HYPER-SURGE! +25', carPos.x, carPos.y - 25, '#00f0ff', 16);
            car.currentMood = 'triumph';
          } else {
            // Normal cooling
            car.speed = Math.max(0.12, car.speed - 0.42 * dt);
            const coolRate = (car.isUnderdog ? 65 : 42) * (car.isDrafting ? 1.6 : 1.0);
            car.heat = Math.max(0, car.heat - coolRate * dt);
            if (car.currentMood === 'focused') car.currentMood = 'idle';
          }
        }

        // Active surge decay
        if (car.surgeTimer > 0) {
          car.surgeTimer -= dt;
          if (car.surgeTimer <= 0 && car.currentMood === 'triumph') car.currentMood = 'idle';
        }

        // Overheat blowout trigger if heat hits 100%
        if (car.heat >= 100) {
          car.isOverheated = true;
          car.overheatTimer = 0.9;
          car.heat = 40;
          car.score = Math.max(0, car.score - 15);
          this.audio.playExplosion();
          this.screenShake = 8;

          const carPos = this.getCarCoords(car.progress, car.laneLerp);
          this.particles.spawnSparks(carPos.x, carPos.y, '#ef4444', 16);
          this.addFloatingText('💥 CAPACITOR BLOWOUT! -15', carPos.x, carPos.y - 25, '#ef4444', 16);
        }
      }

      // Drafting mechanics: Check if trailing behind a rival in the same or adjacent lane
      car.isDrafting = false;
      car.draftRivalId = null;
      for (const rival of active) {
        if (rival.id === p.id) continue;
        const rc = this.playersState.get(rival.id);
        if (!rc) continue;

        let progDiff = (rc.progress - car.progress) % 1.0;
        if (progDiff < 0) progDiff += 1.0;

        const laneDiff = Math.abs(car.lane - rc.lane);
        if (progDiff > 0.02 && progDiff < 0.14 && laneDiff <= 0.5) {
          car.isDrafting = true;
          car.draftRivalId = rival.id;
          car.draftTimer += dt;
          car.speed = Math.min(0.58, car.speed + dt * 0.4);

          const myPos = this.getCarCoords(car.progress, car.laneLerp);
          if (Math.random() < 0.25) {
            this.particles.spawnSparks(myPos.x, myPos.y, '#38bdf8', 1);
          }

          if (car.draftTimer >= 0.7) {
            car.draftTimer = 0;
            car.score += 25;
            car.speed = 0.62;
            this.audio.playScore();
            this.addFloatingText('💨 SLIPSTREAM PASS! +25', myPos.x, myPos.y - 25, '#38bdf8', 15);
            car.currentMood = 'triumph';
          }
          break;
        }
      }
      if (!car.isDrafting) {
        car.draftTimer = Math.max(0, car.draftTimer - dt * 1.5);
      }

      // Collect Track Pickups
      for (let pi = this.pickups.length - 1; pi >= 0; pi--) {
        const pu = this.pickups[pi];
        let diffProg = Math.abs(car.progress - pu.progress) % 1.0;
        if (diffProg > 0.5) diffProg = 1.0 - diffProg;
        const diffLane = Math.abs(car.lane - pu.lane);

        if (diffProg < 0.035 && diffLane < 0.7) {
          const puPos = this.getCarCoords(pu.progress, pu.lane);

          if (pu.type === 'cryo_gate') {
            car.heat = 0;
            car.score += 15;
            car.speed = Math.min(0.55, car.speed + 0.15);
            this.audio.playScore();
            this.particles.spawnSparks(puPos.x, puPos.y, '#38bdf8', 12);
            this.addFloatingText('❄️ CRYO VENT! 0% HEAT +15', puPos.x, puPos.y - 25, '#38bdf8', 15);
          } else if (pu.type === 'energy_orb') {
            car.score += 15;
            this.audio.playScore();
            this.particles.spawnSparks(puPos.x, puPos.y, '#f59e0b', 8);
            this.addFloatingText('⚡ VOLT ORB! +15', puPos.x, puPos.y - 25, '#f59e0b', 14);
          } else if (pu.type === 'emp_disruptor') {
            if (!car.isUnderdog) {
              car.heat = Math.min(100, car.heat + 35);
              car.speed = Math.max(0.1, car.speed * 0.5);
              this.audio.playBounce();
              this.particles.spawnSparks(puPos.x, puPos.y, '#f43f5e', 12);
              this.addFloatingText('🔴 EMP SURGE! +35% HEAT', puPos.x, puPos.y - 25, '#ef4444', 15);
              car.currentMood = 'shocked';
            } else {
              this.addFloatingText('🛡️ UNDERDOG EMP IMMUNITY!', puPos.x, puPos.y - 25, '#fbbf24', 15);
            }
          } else if (pu.type === 'golden_core') {
            car.score += 50;
            car.heat = 0;
            this.audio.playFanfare();
            this.particles.spawnConfetti(puPos.x, puPos.y, 20);
            this.addFloatingText('💎 GOLDEN LASER CORE! +50', puPos.x, puPos.y - 25, '#facc15', 18);
          }

          this.pickups.splice(pi, 1);
        }
      }

      // Orbital progress along track
      const prevProg = car.progress;
      // Inside rail advances progress slightly faster per unit speed due to shorter circumference
      const laneAdvantage = 1.0 + (3 - car.lane) * 0.04;
      car.progress += car.speed * laneAdvantage * dt;

      // Wrap lap
      if (car.progress >= 1.0) {
        car.progress -= 1.0;
        car.laps++;
        const lapBonus = this.roundTimer <= 15 ? 200 : 100;
        car.score += lapBonus;
        this.audio.playScore();

        const carPos = this.getCarCoords(car.progress, car.laneLerp);
        this.particles.spawnConfetti(carPos.x, carPos.y, 16);
        this.addFloatingText(`🏁 LAP ${car.laps}! +${lapBonus}`, carPos.x, carPos.y - 30, '#10b981', 17);
        car.currentMood = 'triumph';

        if (car.laps >= this.totalLaps) {
          this.isFinished = true;
        }
      }
    }

    // Inter-Player Body Contact & Rail Shunts
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const p1 = active[i];
        const p2 = active[j];
        const c1 = this.playersState.get(p1.id);
        const c2 = this.playersState.get(p2.id);
        if (!c1 || !c2) continue;

        let diffProg = Math.abs(c1.progress - c2.progress) % 1.0;
        if (diffProg > 0.5) diffProg = 1.0 - diffProg;
        const diffLane = Math.abs(c1.lane - c2.lane);

        // When cars are side by side in same or neighboring lane
        if (diffProg < 0.04 && diffLane <= 1) {
          const pos1 = this.getCarCoords(c1.progress, c1.laneLerp);
          const pos2 = this.getCarCoords(c2.progress, c2.laneLerp);
          const midX = (pos1.x + pos2.x) / 2;
          const midY = (pos1.y + pos2.y) / 2;

          this.audio.playBounce();
          this.hitStopTimer = 0.045; // 45ms hit-stop
          this.screenShake = 6;
          this.particles.spawnSparks(midX, midY, '#f59e0b', 12);

          const c1Strong = c1.surgeTimer > 0 || c1.speed > c2.speed + 0.1 || c1.isUnderdog;
          const c2Strong = c2.surgeTimer > 0 || c2.speed > c1.speed + 0.1 || c2.isUnderdog;

          if (c1Strong && !c2Strong && c1.shuntCooldown <= 0) {
            c1.shuntCooldown = 1.0;
            c1.score += 35;
            c2.heat = Math.min(100, c2.heat + 25);
            c2.lane = Math.min(3, c2.lane + 1);
            c2.lastShovedBy = p1.id;
            c2.currentMood = 'shocked';
            c1.currentMood = 'triumph';
            this.addFloatingText('💥 RAIL SHUNT! +35', midX, midY - 25, p1.color, 16);
          } else if (c2Strong && !c1Strong && c2.shuntCooldown <= 0) {
            c2.shuntCooldown = 1.0;
            c2.score += 35;
            c1.heat = Math.min(100, c1.heat + 25);
            c1.lane = Math.max(0, c1.lane - 1);
            c1.lastShovedBy = p2.id;
            c1.currentMood = 'shocked';
            c2.currentMood = 'triumph';
            this.addFloatingText('💥 RAIL SHUNT! +35', midX, midY - 25, p2.color, 16);
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  // Calculate 2D position and tangent angle along track circuit
  private getCarCoords(prog: number, laneIndex: number): { x: number; y: number; angle: number } {
    // 4 discrete laser rails: laneIndex from 0 to 3
    const laneOffset = (laneIndex - 1.5) * 22;
    const rx = this.radiusX + laneOffset;
    const ry = this.radiusY + laneOffset * 0.85;

    const angle = prog * Math.PI * 2 - Math.PI / 2;
    const x = this.trackCenterX + Math.cos(angle) * rx;
    const y = this.trackCenterY + Math.sin(angle) * ry;

    // Tangent angle along velocity
    const tx = -Math.sin(angle) * rx;
    const ty = Math.cos(angle) * ry;
    const tangAngle = Math.atan2(ty, tx);

    return { x, y, angle: tangAngle };
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const car = this.playersState.get(botId);
    if (!car || car.isOverheated) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    let reactionDelay = 0.24; // Normal: 220-250ms
    let blunderChance = 0.08;
    if (difficulty === 'bot_easy') {
      reactionDelay = 0.42; // Easy: 380-450ms
      blunderChance = 0.22;
    } else if (difficulty === 'bot_hard') {
      reactionDelay = 0.11; // Hard: 90-130ms
      blunderChance = 0.01;
    }

    const inCorner =
      (car.progress > 0.12 && car.progress < 0.44) ||
      (car.progress > 0.62 && car.progress < 0.94);

    // Throttle management
    let maxAllowedHeat = 82;
    if (difficulty === 'bot_easy') maxAllowedHeat = 98; // Blunders into blowouts!
    else if (difficulty === 'bot_hard') maxAllowedHeat = 88; // Sweet spot mastery

    let gas = true;
    if (car.heat > maxAllowedHeat && inCorner) {
      gas = false;
    }

    // Lane selection
    let bestLane = car.lane;
    let foundPickup = false;

    // Check upcoming pickups within 0.03 to 0.20 progress ahead
    for (const pu of this.pickups) {
      let pDist = (pu.progress - car.progress) % 1.0;
      if (pDist < 0) pDist += 1.0;

      if (pDist > 0.02 && pDist < 0.18) {
        if (pu.type === 'emp_disruptor' && !car.isUnderdog) {
          // Avoid EMP lane
          if (car.lane === pu.lane) {
            bestLane = pu.lane > 0 ? pu.lane - 1 : pu.lane + 1;
          }
        } else if (pu.type === 'cryo_gate' || pu.type === 'golden_core' || pu.type === 'energy_orb') {
          bestLane = pu.lane;
          foundPickup = true;
          break;
        }
      }
    }

    // If no pickup, Hard bots try to draft rival or hug inside apex lane
    if (!foundPickup) {
      if (difficulty === 'bot_hard') {
        for (const [rid, rc] of this.playersState.entries()) {
          if (rid === botId) continue;
          let pDist = (rc.progress - car.progress) % 1.0;
          if (pDist < 0) pDist += 1.0;

          if (pDist > 0.03 && pDist < 0.16) {
            bestLane = rc.lane; // line up to draft
            break;
          }
        }
      } else {
        // Favor inner rail 0 or 1 for shorter line
        bestLane = 1;
      }
    }

    // Apply blunder
    if (Math.random() < blunderChance) {
      bestLane = Math.floor(Math.random() * 4);
    }

    let steer = 0;
    if (bestLane < car.lane) steer = -1;
    else if (bestLane > car.lane) steer = 1;

    this.input.setBotInput(botId, gas, steer, gas ? 1 : 0, gas);
    this.botReactionTimers.set(botId, reactionDelay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const car = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: car?.score || 0,
        laps: car?.laps || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topLaps = scores[0]?.laps || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} clinched the Laser Speedway with ${scores[0].score} pts and ${topLaps} laps!`
      : 'Laser Speedway capacitor overloads halted all slot cars!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentTheme];

    // Screen Shake
    ctx.save();
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

    // 1. Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative grid and horizon lights
    this.renderAtmosphere(ctx, width, height, theme);

    // 2. Speedway Track Surface & 4 Laser Rails
    this.renderTrack(ctx, theme);

    // 3. Track Pickups (Cryo Gates, Energy Orbs, EMPs, Golden Cores)
    this.renderPickups(ctx, theme);

    // 4. Slot Cars & Mascot Drivers
    this.renderCars(ctx);

    // 5. Floating Text FX
    this.renderFloatingTexts(ctx);

    ctx.restore(); // Screen shake end

    // 6. Safe UI Layout
    this.renderUI(ctx, width, height, theme);
  }

  private renderAtmosphere(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: SpeedwayTheme
  ): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;

    for (let x = 0; x < width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Holographic corner beacons
    ctx.fillStyle = theme.accentColor;
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.arc(this.trackCenterX, this.trackCenterY, this.radiusX + 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderTrack(ctx: CanvasRenderingContext2D, theme: SpeedwayTheme): void {
    ctx.save();

    // Speedway Roadbed (Broad asphalt/cyber loop)
    ctx.strokeStyle = theme.trackFloor;
    ctx.lineWidth = 110;
    ctx.beginPath();
    ctx.ellipse(this.trackCenterX, this.trackCenterY, this.radiusX, this.radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Outer & Inner Curbs
    ctx.strokeStyle = theme.curbColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(this.trackCenterX, this.trackCenterY, this.radiusX - 55, this.radiusY - 48, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(this.trackCenterX, this.trackCenterY, this.radiusX + 55, this.radiusY + 48, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 4 Laser Guide Rails
    for (let lane = 0; lane < 4; lane++) {
      const laneOffset = (lane - 1.5) * 22;
      const rx = this.radiusX + laneOffset;
      const ry = this.radiusY + laneOffset * 0.85;

      // Glow layer
      ctx.strokeStyle = theme.railGlow;
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.ellipse(this.trackCenterX, this.trackCenterY, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Sharp central laser line
      ctx.strokeStyle = theme.railColor;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(this.trackCenterX, this.trackCenterY, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Checkered Finish Gate at Progress = 0 (Top or Right side)
    const finP1 = this.getCarCoords(0, 0);
    const finP2 = this.getCarCoords(0, 3);
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(finP1.x, finP1.y);
    ctx.lineTo(finP2.x, finP2.y);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FINISH', finP1.x, finP1.y - 12);

    ctx.restore();
  }

  private renderPickups(ctx: CanvasRenderingContext2D, _theme: SpeedwayTheme): void {
    for (const pu of this.pickups) {
      const pos = this.getCarCoords(pu.progress, pu.lane);
      const bob = Math.sin(pu.bobble) * 3;

      ctx.save();
      ctx.translate(pos.x, pos.y + bob);

      if (pu.type === 'cryo_gate') {
        // Cyan Cryo Cooling Gate
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#0284c7';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.roundRect(-9, -9, 18, 18, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('❄️', 0, 0);
      } else if (pu.type === 'energy_orb') {
        // Golden Volt Orb
        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#d97706';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', 0, 0);
      } else if (pu.type === 'emp_disruptor') {
        // Red EMP Disruptor
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#dc2626';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(9, 7);
        ctx.lineTo(-9, 7);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('EMP', 0, 2);
      } else if (pu.type === 'golden_core') {
        // High-Value Golden Laser Core
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#78350f';
        ctx.font = '900 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💎', 0, 0);
      }

      ctx.restore();
    }
  }

  private renderCars(ctx: CanvasRenderingContext2D): void {
    const active = this.getActivePlayers();

    for (const p of active) {
      const car = this.playersState.get(p.id);
      if (!car) continue;

      const pos = this.getCarCoords(car.progress, car.laneLerp);
      const isBot = p.type !== 'human';

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(pos.angle + Math.PI / 2);

      // Slipstream visual trail
      if (car.isDrafting) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, 22);
        ctx.lineTo(-5, 6);
        ctx.moveTo(10, 22);
        ctx.lineTo(5, 6);
        ctx.stroke();
      }

      // Underdog Photon Shield
      if (car.isUnderdog) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Slot Car Chassis Underglow
      ctx.fillStyle = car.surgeTimer > 0 ? '#00f0ff' : p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.roundRect(-10, -14, 20, 28, 4);
      ctx.fill();

      // Guide Pin Slot Line underneath
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(0, 10);
      ctx.stroke();

      // Mascot Driver in Center Cockpit
      drawCharacter(
        ctx,
        0,
        0,
        12,
        p.id,
        isBot,
        car.currentMood,
        car.animTime,
        undefined
      );

      // Heat Venting Steam when cooling
      if (car.heat > 60 && !car.isOverheated) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(-8, 12, 3, 0, Math.PI * 2);
        ctx.arc(8, 12, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Heat Meter & Lap Tag above car
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`P${p.id + 1} • L${car.laps + 1}`, pos.x, pos.y - 24);

      // Capacitor Heat Bar
      const barW = 28;
      const barH = 4;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(pos.x - barW / 2, pos.y - 20, barW, barH);

      // Color code heat: cyan (0-60%), orange (60-80%), purple sweet spot (80-99%), red (100%)
      let heatCol = '#38bdf8';
      if (car.heat >= 80) heatCol = '#a855f7';
      else if (car.heat >= 60) heatCol = '#f59e0b';
      if (car.isOverheated) heatCol = '#ef4444';

      ctx.fillStyle = heatCol;
      ctx.fillRect(pos.x - barW / 2, pos.y - 20, (car.heat / 100) * barW, barH);
      ctx.restore();
    }
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    for (const ft of this.floatingTexts) {
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${ft.size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  private renderUI(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: SpeedwayTheme
  ): void {
    // 1. Minigame Header Badge (Safe at y: 56, h: 28)
    ctx.save();
    ctx.textAlign = 'center';

    const badgeW = 390;
    const badgeH = 28;
    const badgeX = width / 2 - badgeW / 2;
    const badgeY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 14);
    ctx.fill();
    ctx.stroke();

    ctx.font = '800 13px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🏎️ LASER SPEEDWAY • SWITCH LANES & MANAGE HEAT', width / 2, badgeY + 18);
    ctx.restore();

    // 2. Sudden Death Banner if <= 15s
    if (this.roundTimer <= 15 && this.roundTimer > 0) {
      ctx.save();
      const pulse = 0.8 + Math.sin(this.animTimer * 8) * 0.2;
      ctx.fillStyle = `rgba(239, 68, 68, ${pulse * 0.25})`;
      ctx.fillRect(0, 88, width, 26);

      ctx.fillStyle = '#fef08a';
      ctx.font = '900 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ SUDDEN DEATH: 2X LAP POINTS & HYPER VOLTAGE! ⚡', width / 2, 105);
      ctx.restore();
    }

    // 3. Theme Pill at Bottom-Left (x: 20, y: height - 44, w: 170, h: 32)
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.stroke();

    ctx.font = '700 11px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name}`, pillX + 12, pillY + pillH / 2);

    ctx.font = '800 10px monospace';
    ctx.fillStyle = theme.accentColor;
    ctx.textAlign = 'right';
    ctx.fillText('[T]', pillX + pillW - 12, pillY + pillH / 2);
    ctx.restore();

    // 4. Player Corner Status Cards (Safely offset to y: height - 128, 130x52px)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const car = this.playersState.get(p.id);
      if (!car) return;

      const cardW = 130;
      const cardH = 52;
      const isLeft = idx % 2 === 0;
      const isBottom = idx < 2;

      const cardX = isLeft ? 20 : width - cardW - 20;
      const cardY = isBottom ? height - 128 : 110;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = car.isUnderdog ? '#fbbf24' : p.color;
      ctx.lineWidth = car.isUnderdog ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 8);
      ctx.fill();
      ctx.stroke();

      // Mini mascot avatar
      drawCharacter(
        ctx,
        cardX + 22,
        cardY + 26,
        14,
        p.id,
        p.type !== 'human',
        car.currentMood,
        car.animTime,
        undefined
      );

      // Score and laps
      ctx.font = '800 11px sans-serif';
      ctx.fillStyle = p.color;
      ctx.textAlign = 'left';
      ctx.fillText(`P${p.id + 1} (${car.laps} Laps)`, cardX + 44, cardY + 20);

      ctx.font = '900 14px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${car.score} pts`, cardX + 44, cardY + 38);

      if (car.isUnderdog) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '900 9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('⚡SURGE', cardX + cardW - 6, cardY + 16);
      }

      ctx.restore();
    });

    // 5. Control Hints
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('STEER: Switch Rails | HOLD: Throttle | RELEASE AT 80%: Hyper-Surge', width - 20, height - 14);
    ctx.restore();
  }
}
