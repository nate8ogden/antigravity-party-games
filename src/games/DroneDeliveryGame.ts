import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type DroneThemeId = 'aero_skyport' | 'stormy_canyon' | 'orbital_hangar';

interface DroneTheme {
  id: DroneThemeId;
  name: string;
  icon: string;
  skyTop: string;
  skyBottom: string;
  depotColor: string;
  windColor: string;
  padGlow: string;
  rotorColor: string;
  accentColor: string;
}

const THEMES: Record<DroneThemeId, DroneTheme> = {
  aero_skyport: {
    id: 'aero_skyport',
    name: 'Aero-City Metropolis Skyport',
    icon: '🏙️',
    skyTop: '#090B14',
    skyBottom: '#151D33',
    depotColor: '#1E293B',
    windColor: 'rgba(0, 229, 255, 0.18)',
    padGlow: '#00E5FF',
    rotorColor: '#38BDF8',
    accentColor: '#00E5FF'
  },
  stormy_canyon: {
    id: 'stormy_canyon',
    name: 'Thunderstorm Canyon Depot',
    icon: '⚡',
    skyTop: '#0C0F14',
    skyBottom: '#1B242A',
    depotColor: '#27272A',
    windColor: 'rgba(245, 158, 11, 0.22)',
    padGlow: '#F59E0B',
    rotorColor: '#FDE047',
    accentColor: '#F59E0B'
  },
  orbital_hangar: {
    id: 'orbital_hangar',
    name: 'Orbital Zero-G Cargo Bay',
    icon: '🚀',
    skyTop: '#05070E',
    skyBottom: '#0D1B2A',
    depotColor: '#1F2937',
    windColor: 'rgba(168, 85, 247, 0.20)',
    padGlow: '#A855F7',
    rotorColor: '#C084FC',
    accentColor: '#A855F7'
  }
};

const THEME_ORDER: DroneThemeId[] = ['aero_skyport', 'stormy_canyon', 'orbital_hangar'];

type CargoType = 'standard' | 'titanium' | 'quantum';

interface CargoCrate {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: CargoType;
  points: number;
  carrierId: PlayerId | null;
  grounded: boolean;
}

interface DeliveryDropZone {
  x: number;
  y: number;
  width: number;
  playerId: PlayerId;
}

interface FloatingDroneText {
  x: number;
  y: number;
  text: string;
  color: string;
  timer: number;
  maxTimer: number;
}

interface DeliveryDrone {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  carryingCargoId: number | null;
  packagesDelivered: number;
  score: number;
  rotorAnim: number;
  thrustCharge: number;
  turboTimer: number;
  empCooldown: number;
  stunTimer: number;
  isUnderdog: boolean;
  tractorBeam: boolean;
  lastShovedBy: PlayerId | null;
  shoveTimer: number;
  stuckTimer: number;
  lastPos: { x: number; y: number };
  currentMood: CharacterMood;
  animTime: number;
}

export class DroneDeliveryGame extends BaseGame {
  public currentTheme: DroneThemeId = 'aero_skyport';
  public playersState: Map<PlayerId, DeliveryDrone> = new Map();

  private dropZones: DeliveryDropZone[] = [];
  private crates: CargoCrate[] = [];
  private floatingTexts: FloatingDroneText[] = [];

  private windSpeed: number = 0;
  private windChangeTimer: number = 2.5;
  private packageDepotX: number = 0;
  private packageDepotY: number = 0;
  private crateIdCounter: number = 0;

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
          this.setTheme('aero_skyport');
        } else if (e.key === '2') {
          this.setTheme('stormy_canyon');
        } else if (e.key === '3') {
          this.setTheme('orbital_hangar');
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

  public cycleTheme(): void {
    const curIdx = THEME_ORDER.indexOf(this.currentTheme);
    const nextIdx = (curIdx + 1) % THEME_ORDER.length;
    this.setTheme(THEME_ORDER[nextIdx]);
  }

  public setTheme(theme: DroneThemeId): void {
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnSparks(105, 556, THEMES[theme].accentColor, 16);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.playersState.clear();
    this.dropZones = [];
    this.crates = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.animTimer = 0;
    this.crateIdCounter = 0;

    this.packageDepotX = width / 2;
    this.packageDepotY = height * 0.24;

    const active = this.getActivePlayers();
    const count = active.length;
    const zoneW = 95;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const zx = spacing * (idx + 1);
      const zy = height * 0.85;

      this.dropZones.push({
        x: zx,
        y: zy,
        width: zoneW,
        playerId: p.id
      });

      this.playersState.set(p.id, {
        id: p.id,
        x: zx,
        y: zy - 45,
        vx: 0,
        vy: 0,
        angle: 0,
        carryingCargoId: null,
        packagesDelivered: 0,
        score: 0,
        rotorAnim: 0,
        thrustCharge: 0,
        turboTimer: 0,
        empCooldown: 0,
        stunTimer: 0,
        isUnderdog: false,
        tractorBeam: false,
        lastShovedBy: null,
        shoveTimer: 0,
        stuckTimer: 0,
        lastPos: { x: zx, y: zy - 45 },
        currentMood: 'focused',
        animTime: 0
      });

      this.botReactionTimers.set(p.id, 0.15 + Math.random() * 0.1);
    });

    // Spawn initial cargo crate batch at depot
    this.spawnDepotCargo(3);
  }

  private spawnDepotCargo(count: number = 1): void {
    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      let type: CargoType = 'standard';
      let points = 30;

      if (roll < 0.35) {
        type = 'titanium';
        points = 55;
      } else if (roll < 0.50 && this.roundTimer <= 15.0) {
        type = 'quantum';
        points = 85;
      }

      this.crates.push({
        id: ++this.crateIdCounter,
        x: this.packageDepotX + (Math.random() - 0.5) * 60,
        y: this.packageDepotY - 14,
        vx: (Math.random() - 0.5) * 20,
        vy: 0,
        type,
        points,
        carrierId: null,
        grounded: true
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.animTimer += dt;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 14);
    }

    const isSuddenDeath = this.roundTimer <= 15.0;

    // 1. Dynamic Wind Turbulence
    this.windChangeTimer -= dt;
    if (this.windChangeTimer <= 0) {
      this.windChangeTimer = (isSuddenDeath ? 1.5 : 2.5) + Math.random() * 2.0;
      this.windSpeed = (Math.random() - 0.5) * (isSuddenDeath ? 140 : 90);
    }

    // 2. Ensure Depot always has cargo crates available
    const uncarriedDepotCrates = this.crates.filter(c => c.carrierId === null && c.grounded);
    if (uncarriedDepotCrates.length < 2) {
      this.spawnDepotCargo(isSuddenDeath ? 2 : 1);
    }

    // 3. Update Floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.timer -= dt;
      ft.y -= 25 * dt;
      if (ft.timer <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // 4. Update Underdog
    this.updateUnderdogStatus();

    // 5. Update Bots
    this.updateBots(dt, width, height);

    // 6. Update Players
    const active = this.getActivePlayers();
    for (const p of active) {
      const drone = this.playersState.get(p.id);
      if (!drone) continue;

      drone.animTime += dt;
      drone.rotorAnim += dt * (drone.turboTimer > 0 ? 65 : 40);

      if (drone.turboTimer > 0) drone.turboTimer -= dt;
      if (drone.empCooldown > 0) drone.empCooldown -= dt;
      if (drone.shoveTimer > 0) {
        drone.shoveTimer -= dt;
        if (drone.shoveTimer <= 0) drone.lastShovedBy = null;
      }

      if (drone.stunTimer > 0) {
        drone.stunTimer -= dt;
        drone.vy += 220 * dt; // tumble downwards
        drone.y += drone.vy * dt;
        drone.currentMood = 'shocked';
        continue;
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isCharging = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      const justReleased = this.input.justReleased(p.id);

      // Drone bank tilt angle
      drone.angle = steer * 0.38;

      // Hold-to-Charge Turbo Thruster / EMP Shockwave
      if (isCharging) {
        drone.thrustCharge = Math.min(1.0, drone.thrustCharge + dt * 2.4);
        this.particles.spawnSparks(drone.x, drone.y + 12, p.color, 1);
      }

      if (justReleased && drone.thrustCharge > 0.25) {
        // Unleash Turbo Air-Dash / EMP Shockwave
        drone.turboTimer = 0.6 + drone.thrustCharge * 0.5;
        this.screenShake = 4.5;
        this.audio.playWhoosh();
        this.particles.spawnSparks(drone.x, drone.y, '#FFFFFF', 14);

        if (drone.carryingCargoId !== null || drone.empCooldown <= 0) {
          // EMP shockwave radiates!
          drone.empCooldown = 2.0;
          this.audio.playExplosion();
          this.particles.spawnSparks(drone.x, drone.y, THEMES[this.currentTheme].accentColor, 18);
          this.addFloatingText(drone.x, drone.y - 25, '⚡ EMP PULSE!', THEMES[this.currentTheme].accentColor);

          // Force rivals nearby to drop cargo!
          for (const other of active) {
            if (other.id === p.id) continue;
            const rival = this.playersState.get(other.id);
            if (rival && Math.hypot(rival.x - drone.x, rival.y - drone.y) < 110) {
              rival.stunTimer = 0.65;
              this.dropCargo(rival);
              this.addFloatingText(rival.x, rival.y - 25, 'CARGO DROPPED!', '#EF4444');
            }
          }
        }
        drone.thrustCharge = 0;
      }

      // Aerodynamic Flight Physics
      const liftForce = (throttle > 0.1 || isCharging) ? -380 : 190;
      const speedMult = drone.turboTimer > 0 ? 1.8 : (drone.isUnderdog ? 1.25 : 1.0);
      const effectiveWind = drone.isUnderdog ? this.windSpeed * 0.3 : this.windSpeed;

      drone.vy += liftForce * speedMult * dt;
      drone.vx += (steer * 280 * speedMult + effectiveWind) * dt;

      // Kinematic air drag
      drone.vx *= Math.pow(0.84, dt * 10);
      drone.vy *= Math.pow(0.84, dt * 10);

      drone.x += drone.vx * dt;
      drone.y += drone.vy * dt;

      // Arena Boundaries
      const pad = 24;
      drone.x = Math.max(pad, Math.min(width - pad, drone.x));
      drone.y = Math.max(88, Math.min(height - pad, drone.y));

      // Rotor wind particles
      if (Math.random() < 0.25) {
        this.particles.emit(drone.x, drone.y + 14, 1, THEMES[this.currentTheme].rotorColor);
      }

      // Mood
      if (drone.turboTimer > 0) drone.currentMood = 'triumph';
      else if (drone.isUnderdog) drone.currentMood = 'focused';
      else drone.currentMood = 'idle';

      // 7. Cargo Pickup Check (At Depot or Mid-Air loose crates)
      if (drone.carryingCargoId === null) {
        const pickupRadius = drone.tractorBeam ? 44 : 28;
        for (const crate of this.crates) {
          if (crate.carrierId === null) {
            if (Math.hypot(drone.x - crate.x, drone.y - crate.y) < pickupRadius) {
              crate.carrierId = drone.id;
              crate.grounded = false;
              drone.carryingCargoId = crate.id;
              this.audio.playTap();
              this.particles.spawnSparks(drone.x, drone.y, '#FFD700', 8);

              if (!crate.grounded) {
                // Snatched mid-air!
                drone.score += 25;
                this.addFloatingText(drone.x, drone.y - 25, 'AIR SNATCH! +25 📦', '#10B981');
              }
              break;
            }
          }
        }
      }

      // 8. Cargo Delivery Check (At Player's Drop Zone)
      if (drone.carryingCargoId !== null) {
        const myZone = this.dropZones.find(z => z.playerId === p.id);
        if (myZone) {
          const dx = Math.abs(drone.x - myZone.x);
          const dy = Math.abs(drone.y - myZone.y);

          if (dx < myZone.width / 2 && dy < 34) {
            // Touchdown delivery!
            const deliveredCrate = this.crates.find(c => c.id === drone.carryingCargoId);
            const basePts = deliveredCrate ? deliveredCrate.points : 30;
            const pts = basePts * (isSuddenDeath ? 2 : 1);

            drone.score += pts;
            drone.packagesDelivered++;
            this.audio.playScore();
            this.screenShake = 3.5;
            this.particles.spawnConfetti(myZone.x, myZone.y, 20);
            this.addFloatingText(myZone.x, myZone.y - 25, `DELIVERY! +${pts} 🏆`, p.color);

            // Remove delivered crate
            this.crates = this.crates.filter(c => c.id !== drone.carryingCargoId);
            drone.carryingCargoId = null;
          }
        }
      }
    }

    // 9. Update loose crates physics (falling if dropped)
    for (const crate of this.crates) {
      if (crate.carrierId !== null) {
        const carrier = this.playersState.get(crate.carrierId);
        if (carrier) {
          crate.x = carrier.x;
          crate.y = carrier.y + 16;
          crate.vx = carrier.vx;
          crate.vy = carrier.vy;
        }
      } else if (!crate.grounded) {
        crate.vy += 320 * dt; // gravity
        crate.x += (crate.vx + this.windSpeed * 0.5) * dt;
        crate.y += crate.vy * dt;

        if (crate.y >= height - 36) {
          crate.y = height - 36;
          crate.vy = 0;
          crate.vx = 0;
          crate.grounded = true;
        }
      }
    }

    // 10. Inter-Drone Elastic Mid-Air Clashing (m1*v1 + m2*v2)
    for (let i = 0; i < active.length; i++) {
      const d1 = this.playersState.get(active[i].id);
      if (!d1 || d1.stunTimer > 0) continue;

      for (let j = i + 1; j < active.length; j++) {
        const d2 = this.playersState.get(active[j].id);
        if (!d2 || d2.stunTimer > 0) continue;

        const dx = d2.x - d1.x;
        const dy = d2.y - d1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 32;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          d1.x -= nx * overlap * 0.5;
          d1.y -= ny * overlap * 0.5;
          d2.x += nx * overlap * 0.5;
          d2.y += ny * overlap * 0.5;

          // Check if either is under Turbo
          if (d1.turboTimer > 0 || d2.turboTimer > 0) {
            this.screenShake = 6.5;
            this.hitStopTimer = 0.045;
            this.audio.playExplosion();

            if (d1.turboTimer > 0 && d2.turboTimer <= 0) {
              d2.stunTimer = 0.45;
              d2.vx += nx * 280;
              d2.vy += ny * 280;
              this.dropCargo(d2);
              d1.score += 35;
              this.particles.spawnSparks(d2.x, d2.y, '#EF4444', 18);
              this.addFloatingText(d1.x, d1.y - 25, 'ROTOR SMASH! +35 💥', '#10B981');
            } else if (d2.turboTimer > 0 && d1.turboTimer <= 0) {
              d1.stunTimer = 0.45;
              d1.vx -= nx * 280;
              d1.vy -= ny * 280;
              this.dropCargo(d1);
              d2.score += 35;
              this.particles.spawnSparks(d1.x, d1.y, '#EF4444', 18);
              this.addFloatingText(d2.x, d2.y - 25, 'ROTOR SMASH! +35 💥', '#10B981');
            }
          } else {
            // Elastic bump
            const kx = d1.vx - d2.vx;
            const ky = d1.vy - d2.vy;
            const p = 2 * (nx * kx + ny * ky) / 2;
            d1.vx -= p * nx * 0.8;
            d1.vy -= p * ny * 0.8;
            d2.vx += p * nx * 0.8;
            d2.vy += p * ny * 0.8;
            this.audio.playBounce();
            this.particles.spawnSparks((d1.x + d2.x) / 2, (d1.y + d2.y) / 2, '#F59E0B', 8);
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private dropCargo(drone: DeliveryDrone): void {
    if (drone.carryingCargoId !== null) {
      const crate = this.crates.find(c => c.id === drone.carryingCargoId);
      if (crate) {
        crate.carrierId = null;
        crate.grounded = false;
        crate.vx = (Math.random() - 0.5) * 80;
        crate.vy = -60;
      }
      drone.carryingCargoId = null;
    }
  }

  private updateUnderdogStatus(): void {
    const active = this.getActivePlayers();
    if (active.length < 2) return;

    let maxScore = -1;
    let minScore = Infinity;
    for (const p of active) {
      const d = this.playersState.get(p.id);
      if (!d) continue;
      if (d.score > maxScore) maxScore = d.score;
      if (d.score < minScore) minScore = d.score;
    }

    for (const p of active) {
      const d = this.playersState.get(p.id);
      if (!d) continue;
      if (maxScore - d.score >= 40) {
        if (!d.isUnderdog) {
          d.isUnderdog = true;
          d.tractorBeam = true;
        }
      } else {
        d.isUnderdog = false;
      }
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string): void {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      timer: 1.1,
      maxTimer: 1.1
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const drone = this.playersState.get(botId);
    if (!drone || drone.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    // Reaction Delays:
    // Easy: 380-450ms, blunders with wind
    // Normal: 220-250ms, cleanly navigates depot & landing pad
    // Hard: 90-130ms, turbo dashes to snatch crates, triggers EMP shockwaves
    let delay = 0.24;
    let blunderChance = 0.0;
    if (difficulty === 'bot_easy') {
      delay = 0.40 + Math.random() * 0.08;
      blunderChance = 0.18;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11 + Math.random() * 0.04;
      blunderChance = 0.0;
    } else {
      delay = 0.23 + Math.random() * 0.05;
      blunderChance = 0.06;
    }
    this.botReactionTimers.set(botId, delay);

    let targetX = this.packageDepotX;
    let targetY = this.packageDepotY;

    if (drone.carryingCargoId !== null) {
      // Fly to my colored drop zone!
      const myZone = this.dropZones.find(z => z.playerId === botId);
      if (myZone) {
        targetX = myZone.x;
        targetY = myZone.y - 20;
      }
    } else {
      // Seek closest available cargo crate
      const available = this.crates.filter(c => c.carrierId === null);
      if (available.length > 0) {
        let nearest = available[0];
        let minDist = Math.hypot(drone.x - nearest.x, drone.y - nearest.y);
        for (const c of available) {
          const d = Math.hypot(drone.x - c.x, drone.y - c.y);
          if (d < minDist) {
            minDist = d;
            nearest = c;
          }
        }
        targetX = nearest.x;
        targetY = nearest.y - 10;
      }
    }

    if (Math.random() < blunderChance) {
      targetX += (Math.random() - 0.5) * 50;
      targetY += (Math.random() - 0.5) * 50;
    }

    const dx = targetX - drone.x;
    const dy = targetY - drone.y;

    let steer = 0;
    if (Math.abs(dx) > 14) {
      steer = dx > 0 ? 1 : -1;
    }

    const thrust = dy < -12; // need rotor lift

    // Hard bot: trigger turbo/EMP when near rival with cargo!
    let triggerAction = false;
    if (difficulty === 'bot_hard') {
      for (const p of this.getActivePlayers()) {
        if (p.id !== botId) {
          const rival = this.playersState.get(p.id);
          if (rival && rival.carryingCargoId !== null && Math.hypot(rival.x - drone.x, rival.y - drone.y) < 90) {
            triggerAction = true;
          }
        }
      }
    }

    this.input.setBotInput(botId, triggerAction, steer, thrust ? 1.0 : -0.4, triggerAction);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const d = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: d?.score || 0,
        delivered: d?.packagesDelivered || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topDelivered = scores[0]?.delivered || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} dominated the airspace with ${topDelivered} successful deliveries (${scores[0].score} pts)!`
      : 'City crosswinds grounded all delivery drones!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentTheme];

    // Screen Shake Offset
    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Atmosphere Gradient Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.skyTop);
    bgGrad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Wind Streamline Indicators
    ctx.strokeStyle = theme.windColor;
    ctx.lineWidth = 2;
    const windOffset = (this.animTimer * this.windSpeed * 3) % width;
    for (let y = 140; y < height - 80; y += 65) {
      ctx.beginPath();
      ctx.moveTo(windOffset, y);
      ctx.lineTo(windOffset + 70, y);
      ctx.stroke();
    }

    // 2. Central Cargo Depot Platform
    ctx.fillStyle = theme.depotColor;
    ctx.fillRect(this.packageDepotX - 60, this.packageDepotY, 120, 16);
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(this.packageDepotX - 60, this.packageDepotY, 120, 16);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('★ CENTRAL CARGO DEPOT ★', this.packageDepotX, this.packageDepotY + 28);

    // 3. Render Drop Zones
    for (const z of this.dropZones) {
      const p = this.getPlayer(z.playerId);
      const padColor = p ? p.color : '#37474F';

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(z.x - z.width / 2, z.y, z.width, 14);
      ctx.strokeStyle = padColor;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(z.x - z.width / 2, z.y, z.width, 14);

      // Glowing Landing Target Chevron
      ctx.fillStyle = padColor;
      ctx.beginPath();
      ctx.moveTo(z.x - 12, z.y + 4);
      ctx.lineTo(z.x, z.y + 11);
      ctx.lineTo(z.x + 12, z.y + 4);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`PAD P${z.playerId + 1}`, z.x, z.y + 26);
    }

    // 4. Render Cargo Crates
    for (const crate of this.crates) {
      this.renderCrate(ctx, crate, theme);
    }

    // 5. Render Drones with Mascot Pilots
    for (const p of this.getActivePlayers()) {
      const drone = this.playersState.get(p.id);
      if (!drone) continue;
      this.renderDrone(ctx, drone, p, theme);
    }

    // 6. Floating texts
    for (const ft of this.floatingTexts) {
      ctx.save();
      const alpha = Math.min(1.0, ft.timer / (ft.maxTimer * 0.4));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 12px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore(); // Restore screenshake

    // 7. Safe UI & Theme Pill (Strictly preserving y: 12-44 for Global Timer)
    this.renderSafeUI(ctx, width, height);
  }

  private renderCrate(ctx: CanvasRenderingContext2D, crate: CargoCrate, theme: DroneTheme): void {
    ctx.save();
    ctx.translate(crate.x, crate.y);

    if (crate.type === 'titanium') {
      ctx.fillStyle = '#64748B';
      ctx.beginPath();
      ctx.roundRect(-8, -8, 16, 16, 3);
      ctx.fill();
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Ti', 0, 0);
    } else if (crate.type === 'quantum') {
      ctx.fillStyle = '#A855F7';
      ctx.shadowColor = '#A855F7';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.roundRect(-9, -9, 18, 18, 4);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.roundRect(-7, -7, 14, 14, 2);
      ctx.fill();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Strapping cross
      ctx.strokeStyle = '#78350F';
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(7, 0);
      ctx.moveTo(0, -7);
      ctx.lineTo(0, 7);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderDrone(ctx: CanvasRenderingContext2D, drone: DeliveryDrone, p: PlayerConfig, theme: DroneTheme): void {
    ctx.save();
    ctx.translate(drone.x, drone.y);
    ctx.rotate(drone.angle);

    if (drone.stunTimer > 0 && Math.floor(drone.stunTimer * 10) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    // Underdog Tractor Beam Aura
    if (drone.tractorBeam) {
      ctx.save();
      const pulse = (Math.sin(this.animTimer * 8) + 1) * 0.5;
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 22 + pulse * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Quadcopter Arms
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-18, -10);
    ctx.lineTo(18, 10);
    ctx.moveTo(-18, 10);
    ctx.lineTo(18, -10);
    ctx.stroke();

    // 4 Spinning Rotors
    const spin = Math.sin(drone.rotorAnim) * 10;
    ctx.fillStyle = theme.rotorColor;
    ctx.fillRect(-22, -12, spin, 2.5);
    ctx.fillRect(14, -12, -spin, 2.5);
    ctx.fillRect(-22, 10, -spin, 2.5);
    ctx.fillRect(14, 10, spin, 2.5);

    // Aerodynamic Central Drone Hub
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Transparent Pilot Dome with Mascot Pilot
    ctx.save();
    drawCharacter(
      ctx,
      0,
      0,
      7,
      p.id,
      p.type !== 'human',
      drone.currentMood,
      drone.animTime,
      undefined
    );
    ctx.restore();

    ctx.restore(); // Restore drone transform

    // HUD Badge above drone
    ctx.save();
    ctx.translate(drone.x, drone.y);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-24, -34, 48, 14, 3);
    ctx.fill();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${drone.score} pts`, 0, -27);
    ctx.restore();
  }

  private renderSafeUI(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Minigame Header Badge at y: 56 (Strictly leaving y: 12-44 clear for Global Timer!)
    const isSuddenDeath = this.roundTimer <= 15.0;
    const badgeW = 280;
    const badgeH = 28;
    const badgeX = (width - badgeW) * 0.5;
    const badgeY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : '#00E5FF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#EF4444' : '#FFFFFF';
    ctx.font = 'bold 12px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const statusText = isSuddenDeath
      ? '🔥 GUST HURRICANE! 2X POINTS & QUANTUM CORES'
      : 'FETCH CARGO CRATES • DELIVER TO COLOR PAD';
    ctx.fillText(statusText, width * 0.5, badgeY + badgeH * 0.5);

    // 2. Corner Player Status Cards (Offset to y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const drone = this.playersState.get(p.id);
      let cardX = 20;
      let cardY = height - 128;

      if (idx === 0) {
        cardX = 20;
        cardY = height - 128;
      } else if (idx === 1) {
        cardX = width - 150;
        cardY = height - 128;
      } else if (idx === 2) {
        cardX = 20;
        cardY = 92;
      } else {
        cardX = width - 150;
        cardY = 92;
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 130, 52, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Mini Mascot Icon
      ctx.save();
      ctx.translate(cardX + 22, cardY + 26);
      drawCharacter(
        ctx,
        0,
        0,
        14,
        p.id,
        p.type !== 'human',
        drone?.currentMood || 'idle',
        0,
        undefined
      );
      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`P${p.id + 1} (${p.type === 'human' ? 'YOU' : 'BOT'})`, cardX + 42, cardY + 7);

      ctx.fillStyle = p.color;
      ctx.font = 'bold 12px "Chakra Petch", monospace';
      ctx.fillText(`${drone?.score || 0} pts`, cardX + 42, cardY + 23);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px "Chakra Petch", monospace';
      ctx.fillText(`📦 ${drone?.packagesDelivered || 0} delivered`, cardX + 42, cardY + 38);
    });

    // 3. Interactive Theme Pill at bottom-left (x: 20, y: height - 44, w: 170, h: 32)
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;
    const theme = THEMES[this.currentTheme];

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px "Chakra Petch", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name.slice(0, 13)}`, pillX + 12, pillY + pillH * 0.5);

    ctx.fillStyle = theme.accentColor;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('[T]', pillX + pillW - 10, pillY + pillH * 0.5);

    // 4. Control Hints (bottom-right)
    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px "Chakra Petch", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('STEER: TILT • W/SPACE: ROTOR LIFT • HOLD ACTION: EMP', width - 20, height - 14);

    ctx.restore();
  }

  public syncDebug(): void {
    // Debug inspection helper
  }

  public destroy(): void {
    super.destroy();
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) {
        window.removeEventListener('keydown', this.keydownHandler);
      }
      if (this.clickHandler) {
        window.removeEventListener('click', this.clickHandler);
      }
    }
  }
}
