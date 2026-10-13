import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type CyberDemolitionThemeId = 'scrap_junkyard' | 'cyber_core' | 'magma_foundry';

interface DemolitionTheme {
  id: CyberDemolitionThemeId;
  name: string;
  icon: string;
  bgColor: string;
  gridColor: string;
  floorPlate: string;
  barrierColor: string;
  accentColor: string;
  hazardColor: string;
  ballColor: string;
}

const THEMES: Record<CyberDemolitionThemeId, DemolitionTheme> = {
  scrap_junkyard: {
    id: 'scrap_junkyard',
    name: 'Neon Scrap Junkyard',
    icon: '🛠️',
    bgColor: '#12141a',
    gridColor: 'rgba(255, 255, 255, 0.05)',
    floorPlate: '#1a1d26',
    barrierColor: '#eab308',
    accentColor: '#38bdf8',
    hazardColor: '#ef4444',
    ballColor: '#475569'
  },
  cyber_core: {
    id: 'cyber_core',
    name: 'Cyber Megastructure',
    icon: '⚡',
    bgColor: '#090d16',
    gridColor: 'rgba(56, 189, 248, 0.08)',
    floorPlate: '#0f172a',
    barrierColor: '#00f0ff',
    accentColor: '#00f0ff',
    hazardColor: '#f43f5e',
    ballColor: '#1e293b'
  },
  magma_foundry: {
    id: 'magma_foundry',
    name: 'Magma Slag Foundry',
    icon: '🔥',
    bgColor: '#180c08',
    gridColor: 'rgba(249, 115, 22, 0.08)',
    floorPlate: '#24120b',
    barrierColor: '#ea580c',
    accentColor: '#f97316',
    hazardColor: '#f59e0b',
    ballColor: '#3f1a0e'
  }
};

const THEME_ORDER: CyberDemolitionThemeId[] = ['scrap_junkyard', 'cyber_core', 'magma_foundry'];

interface ScrapStructure {
  id: number;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  type: 'pillar' | 'quantum_vault' | 'explosive_silo';
  shake: number;
}

interface ScrapDebris {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  type: 'titanium' | 'quantum_core';
  life: number;
}

interface DemolitionTruck {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  // Wrecking ball physics
  ballX: number;
  ballY: number;
  ballVx: number;
  ballVy: number;
  chainLength: number;
  baseChainLength: number;
  ballRadius: number;
  // Hold-to-Charge Winch & Whip
  isChargingWhip: boolean;
  whipChargeTimer: number;
  whipTier: number;
  turboTimer: number;
  // Combat stats
  score: number;
  towersCrushed: number;
  debrisCollected: number;
  stunTimer: number;
  spinAngle: number;
  shuntCooldown: number;
  lastShovedBy: PlayerId | null;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  animTime: number;
}

interface FloatingDemoText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export class CyberDemolitionGame extends BaseGame {
  public currentTheme: CyberDemolitionThemeId = 'scrap_junkyard';
  public playersState: Map<PlayerId, DemolitionTruck> = new Map();

  private structures: ScrapStructure[] = [];
  private debrisList: ScrapDebris[] = [];
  private floatingTexts: FloatingDemoText[] = [];

  private structureIdCounter: number = 0;
  private debrisIdCounter: number = 0;
  private textIdCounter: number = 0;
  private spawnTimer: number = 2.0;

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
          this.setTheme('scrap_junkyard');
        } else if (e.key === '2') {
          this.setTheme('cyber_core');
        } else if (e.key === '3') {
          this.setTheme('magma_foundry');
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

  public setTheme(theme: CyberDemolitionThemeId): void {
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
    this.structures = [];
    this.debrisList = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.animTimer = 0;
    this.structureIdCounter = 0;
    this.debrisIdCounter = 0;

    const cx = width / 2;
    const cy = height * 0.54;

    // Initial 5 scrap structures in center arena
    const initialTowers: { x: number; y: number; type: 'pillar' | 'quantum_vault' | 'explosive_silo' }[] = [
      { x: cx, y: cy, type: 'quantum_vault' },
      { x: cx - 130, y: cy - 75, type: 'pillar' },
      { x: cx + 130, y: cy - 75, type: 'pillar' },
      { x: cx - 130, y: cy + 75, type: 'explosive_silo' },
      { x: cx + 130, y: cy + 75, type: 'pillar' }
    ];

    for (const t of initialTowers) {
      this.spawnStructure(t.x, t.y, t.type);
    }

    const active = this.getActivePlayers();
    const count = active.length;
    const spawnRadius = Math.min(width, height) * 0.35;

    active.forEach((p, idx) => {
      const ang = (idx / count) * Math.PI * 2;
      const tx = cx + Math.cos(ang) * spawnRadius;
      const ty = cy + Math.sin(ang) * spawnRadius;

      this.playersState.set(p.id, {
        id: p.id,
        x: tx,
        y: ty,
        vx: 0,
        vy: 0,
        angle: ang + Math.PI,
        speed: 0,
        ballX: tx - Math.cos(ang) * 55,
        ballY: ty - Math.sin(ang) * 55,
        ballVx: 0,
        ballVy: 0,
        chainLength: 55,
        baseChainLength: 55,
        ballRadius: 15,
        isChargingWhip: false,
        whipChargeTimer: 0,
        whipTier: 0,
        turboTimer: 0,
        score: 0,
        towersCrushed: 0,
        debrisCollected: 0,
        stunTimer: 0,
        spinAngle: 0,
        shuntCooldown: 0,
        lastShovedBy: null,
        isUnderdog: false,
        currentMood: 'idle',
        animTime: 0
      });

      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  private spawnStructure(
    x: number,
    y: number,
    type: 'pillar' | 'quantum_vault' | 'explosive_silo'
  ): void {
    let hp = 40;
    let radius = 24;
    if (type === 'quantum_vault') {
      hp = 80;
      radius = 28;
    } else if (type === 'explosive_silo') {
      hp = 30;
      radius = 22;
    }

    this.structures.push({
      id: ++this.structureIdCounter,
      x,
      y,
      radius,
      hp,
      maxHp: hp,
      type,
      shake: 0
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

  private spawnDebris(x: number, y: number, count: number, type: 'titanium' | 'quantum_core'): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 120;
      this.debrisList.push({
        id: ++this.debrisIdCounter,
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        value: type === 'quantum_core' ? 25 : 10,
        type,
        life: 14.0
      });
    }
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

    // Floating text update
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y -= dt * 28;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Debris physics and magnetic attraction
    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const d = this.debrisList[i];
      d.life -= dt;
      d.vx *= Math.pow(0.2, dt);
      d.vy *= Math.pow(0.2, dt);
      d.x += d.vx * dt;
      d.y += d.vy * dt;

      // Arena bounds for debris
      d.x = Math.max(30, Math.min(width - 30, d.x));
      d.y = Math.max(90, Math.min(height - 40, d.y));

      if (d.life <= 0) {
        this.debrisList.splice(i, 1);
        continue;
      }

      // Check pickup by trucks
      for (const p of this.getActivePlayers()) {
        const truck = this.playersState.get(p.id);
        if (!truck) continue;

        const pickupRange = truck.isUnderdog ? 65 : 28;
        const dist = Math.hypot(truck.x - d.x, truck.y - d.y);

        // Underdog magnet pull
        if (truck.isUnderdog && dist < 120) {
          const pullAngle = Math.atan2(truck.y - d.y, truck.x - d.x);
          d.vx += Math.cos(pullAngle) * 350 * dt;
          d.vy += Math.sin(pullAngle) * 350 * dt;
        }

        if (dist < pickupRange) {
          const mult = this.roundTimer <= 15 ? 2 : 1;
          const pts = d.value * mult;
          truck.score += pts;
          truck.debrisCollected++;
          this.audio.playScore();

          const label = d.type === 'quantum_core' ? `💎 QUANTUM +${pts}` : `⚙️ SCRAP +${pts}`;
          const color = d.type === 'quantum_core' ? '#38bdf8' : '#f59e0b';
          this.addFloatingText(label, d.x, d.y - 15, color, 13);
          this.particles.spawnSparks(d.x, d.y, color, 6);

          this.debrisList.splice(i, 1);
          break;
        }
      }
    }

    // Respawn scrap structures
    this.spawnTimer -= dt;
    const maxTowers = this.roundTimer <= 15 ? 7 : 5;
    if (this.spawnTimer <= 0 && this.structures.length < maxTowers) {
      this.spawnTimer = 2.2 + Math.random() * 1.5;
      const cx = width / 2;
      const cy = height * 0.54;
      const types: ('pillar' | 'quantum_vault' | 'explosive_silo')[] =
        this.roundTimer <= 15
          ? ['explosive_silo', 'quantum_vault', 'explosive_silo']
          : ['pillar', 'quantum_vault', 'explosive_silo'];
      const pickType = types[Math.floor(Math.random() * types.length)];
      const sx = cx + (Math.random() - 0.5) * (width * 0.55);
      const sy = cy + (Math.random() - 0.5) * (height * 0.45);
      this.spawnStructure(sx, sy, pickType);
    }

    // Structure shake decay
    for (const st of this.structures) {
      if (st.shake > 0) st.shake = Math.max(0, st.shake - dt * 20);
    }

    // Underdog status calculation
    let maxScore = -1;
    for (const p of this.getActivePlayers()) {
      const truck = this.playersState.get(p.id);
      if (!truck) continue;
      if (truck.score > maxScore) maxScore = truck.score;
    }
    for (const p of this.getActivePlayers()) {
      const truck = this.playersState.get(p.id);
      if (!truck) continue;
      truck.isUnderdog = maxScore - truck.score >= 50 && truck.score < maxScore;
      truck.ballRadius = truck.isUnderdog ? 21 : 15;
    }

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Update each truck
    const active = this.getActivePlayers();
    for (const p of active) {
      const truck = this.playersState.get(p.id);
      if (!truck) continue;

      truck.animTime += dt * 5;
      if (truck.shuntCooldown > 0) truck.shuntCooldown -= dt;

      // Handle Stun
      if (truck.stunTimer > 0) {
        truck.stunTimer -= dt;
        truck.spinAngle += dt * 12;
        truck.speed *= 0.9;
        truck.currentMood = 'shocked';
        if (truck.stunTimer <= 0) {
          truck.spinAngle = 0;
          truck.currentMood = 'idle';
        }
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      if (truck.stunTimer <= 0) {
        // Snappy directional steering
        truck.angle += steer * 3.8 * dt;

        // Hold-to-Charge Hydraulic Winch & Turbo Ram
        if (isAction) {
          truck.isChargingWhip = true;
          truck.whipChargeTimer += dt;
          truck.currentMood = 'focused';

          // Reel in chain tightly to build angular momentum
          truck.chainLength = Math.max(22, truck.baseChainLength - truck.whipChargeTimer * 22);

          // Charge tier calculation
          if (truck.whipChargeTimer >= 1.6) {
            truck.whipTier = 3;
          } else if (truck.whipChargeTimer >= 0.9) {
            truck.whipTier = 2;
          } else if (truck.whipChargeTimer >= 0.35) {
            truck.whipTier = 1;
          } else {
            truck.whipTier = 0;
          }

          // Whine sparks
          if (Math.random() < 0.35) {
            const chargeColor = truck.whipTier === 3 ? '#ff0055' : truck.whipTier === 2 ? '#38bdf8' : '#facc15';
            this.particles.spawnSparks(truck.ballX, truck.ballY, chargeColor, 2);
          }
        } else {
          // Release: Launch Hydraulic Ball Whip & Nitro Ram!
          if (truck.isChargingWhip && truck.whipChargeTimer >= 0.3) {
            truck.isChargingWhip = false;
            truck.chainLength = truck.baseChainLength + truck.whipTier * 18;
            truck.turboTimer = 0.7 + truck.whipTier * 0.3;

            // Throw ball forward along truck vector with high impulse
            const whipImpulse = 420 + truck.whipTier * 180;
            truck.ballVx += Math.cos(truck.angle) * whipImpulse;
            truck.ballVy += Math.sin(truck.angle) * whipImpulse;

            // Truck surges forward
            truck.speed = Math.min(300, truck.speed + 160 + truck.whipTier * 45);

            this.audio.playWhoosh();
            this.screenShake = 4 + truck.whipTier * 2.5;

            const label = truck.whipTier === 3 ? '🔥 MEGA HYDRAULIC FLUSH!' : truck.whipTier === 2 ? '⚡ WHIP LAUNCH!' : '🚀 NITRO RAM!';
            const col = truck.whipTier === 3 ? '#ff0055' : truck.whipTier === 2 ? '#38bdf8' : '#facc15';
            this.addFloatingText(label, truck.x, truck.y - 25, col, 15);
            this.particles.spawnSparks(truck.x, truck.y, col, 12);

            truck.whipChargeTimer = 0;
            truck.whipTier = 0;
            truck.currentMood = 'triumph';
          } else {
            truck.isChargingWhip = false;
            truck.whipChargeTimer = 0;
            truck.whipTier = 0;
            truck.chainLength = truck.baseChainLength;
          }
        }

        // Throttle & acceleration
        const maxForwardSpeed = (truck.turboTimer > 0 ? 290 : 180) * (truck.isUnderdog ? 1.25 : 1.0);
        const maxReverseSpeed = -85;

        if (truck.turboTimer > 0) {
          truck.turboTimer -= dt;
          truck.speed = Math.min(maxForwardSpeed, truck.speed + 350 * dt);
          this.particles.emit(
            truck.x - Math.cos(truck.angle) * 18,
            truck.y - Math.sin(truck.angle) * 18,
            2,
            truck.isUnderdog ? '#fbbf24' : p.color
          );
        } else if (throttle > 0.1 || (!truck.isChargingWhip && isAction)) {
          truck.speed = Math.min(maxForwardSpeed, truck.speed + 240 * dt);
        } else if (throttle < -0.1) {
          truck.speed = Math.max(maxReverseSpeed, truck.speed - 200 * dt);
        } else {
          truck.speed *= Math.pow(0.04, dt);
        }

        // Truck movement
        truck.vx = Math.cos(truck.angle) * truck.speed;
        truck.vy = Math.sin(truck.angle) * truck.speed;
        truck.x += truck.vx * dt;
        truck.y += truck.vy * dt;

        // Arena Boundaries
        const arenaPad = 32;
        if (truck.x < arenaPad) {
          truck.x = arenaPad;
          truck.speed *= -0.3;
        } else if (truck.x > width - arenaPad) {
          truck.x = width - arenaPad;
          truck.speed *= -0.3;
        }

        if (truck.y < 85) {
          truck.y = 85;
          truck.speed *= -0.3;
        } else if (truck.y > height - arenaPad) {
          truck.y = height - arenaPad;
          truck.speed *= -0.3;
        }
      }

      // Physics Wrecking Ball Elastic Spring / Pendulum Simulation
      const towAttachX = truck.x - Math.cos(truck.angle) * 14;
      const towAttachY = truck.y - Math.sin(truck.angle) * 14;

      const dx = towAttachX - truck.ballX;
      const dy = towAttachY - truck.ballY;
      const dist = Math.hypot(dx, dy);

      if (dist > truck.chainLength) {
        const excess = dist - truck.chainLength;
        const tension = excess * 22;
        const normX = dx / dist;
        const normY = dy / dist;

        truck.ballVx += normX * tension * dt;
        truck.ballVy += normY * tension * dt;
      }

      // Ball drag & position update
      truck.ballVx *= Math.pow(0.92, dt * 10);
      truck.ballVy *= Math.pow(0.92, dt * 10);
      truck.ballX += truck.ballVx * dt;
      truck.ballY += truck.ballVy * dt;

      // Ball Arena boundary bounces
      if (truck.ballX < 24) {
        truck.ballX = 24;
        truck.ballVx = Math.abs(truck.ballVx) * 0.7;
      } else if (truck.ballX > width - 24) {
        truck.ballX = width - 24;
        truck.ballVx = -Math.abs(truck.ballVx) * 0.7;
      }
      if (truck.ballY < 80) {
        truck.ballY = 80;
        truck.ballVy = Math.abs(truck.ballVy) * 0.7;
      } else if (truck.ballY > height - 24) {
        truck.ballY = height - 24;
        truck.ballVy = -Math.abs(truck.ballVy) * 0.7;
      }

      // Ball collision with Scrap Structures
      for (let si = this.structures.length - 1; si >= 0; si--) {
        const st = this.structures[si];
        const sDist = Math.hypot(truck.ballX - st.x, truck.ballY - st.y);
        const ballSpeed = Math.hypot(truck.ballVx, truck.ballVy);

        if (sDist < st.radius + truck.ballRadius && ballSpeed > 50) {
          const damage = Math.max(12, ballSpeed * 0.12 * (truck.isUnderdog ? 1.5 : 1.0));
          st.hp -= damage;
          st.shake = 10;
          truck.score += Math.floor(damage * 0.4);

          // Elastic recoil on ball
          const bounceNormX = (truck.ballX - st.x) / sDist;
          const bounceNormY = (truck.ballY - st.y) / sDist;
          truck.ballVx = bounceNormX * (ballSpeed * 0.5);
          truck.ballVy = bounceNormY * (ballSpeed * 0.5);

          this.audio.playExplosion();
          this.hitStopTimer = 0.035;
          this.screenShake = 5;
          this.particles.spawnSparks(truck.ballX, truck.ballY, '#94a3b8', 8);

          if (st.hp <= 0) {
            truck.towersCrushed++;
            this.screenShake = 12;

            if (st.type === 'explosive_silo') {
              // Radial explosive blast!
              this.audio.playExplosion();
              this.particles.spawnConfetti(st.x, st.y, 25);
              this.addFloatingText('💥 SILO DETONATION! +50', st.x, st.y - 25, '#ef4444', 18);
              truck.score += 50;

              // Blast nearby trucks
              for (const other of active) {
                const ot = this.playersState.get(other.id);
                if (!ot) continue;
                const distToSilo = Math.hypot(ot.x - st.x, ot.y - st.y);
                if (distToSilo < 140) {
                  ot.stunTimer = 0.6;
                  ot.currentMood = 'shocked';
                  const pushA = Math.atan2(ot.y - st.y, ot.x - st.x);
                  ot.vx += Math.cos(pushA) * 280;
                  ot.vy += Math.sin(pushA) * 280;
                }
              }

              this.spawnDebris(st.x, st.y, 4, 'quantum_core');
            } else if (st.type === 'quantum_vault') {
              this.audio.playFanfare();
              this.particles.spawnConfetti(st.x, st.y, 20);
              this.addFloatingText('💎 QUANTUM VAULT BREACHED! +60', st.x, st.y - 25, '#38bdf8', 17);
              truck.score += 60;
              this.spawnDebris(st.x, st.y, 5, 'quantum_core');
            } else {
              this.audio.playScore();
              this.particles.spawnSparks(st.x, st.y, '#f59e0b', 16);
              this.addFloatingText('⚙️ SCRAP TOWER DESTROYED! +40', st.x, st.y - 25, '#f59e0b', 16);
              truck.score += 40;
              this.spawnDebris(st.x, st.y, 4, 'titanium');
            }

            this.structures.splice(si, 1);
            truck.currentMood = 'triumph';
          }
        }
      }
    }

    // Inter-Player Demolition Derby: Ball-to-Truck & Truck-to-Truck Smashes!
    for (let i = 0; i < active.length; i++) {
      for (let j = 0; j < active.length; j++) {
        if (i === j) continue;
        const p1 = active[i];
        const p2 = active[j];
        const t1 = this.playersState.get(p1.id);
        const t2 = this.playersState.get(p2.id);
        if (!t1 || !t2) continue;

        // 1. T1's Wrecking Ball hits T2's Truck!
        const ballDistToTruck = Math.hypot(t1.ballX - t2.x, t1.ballY - t2.y);
        const ballSpeed = Math.hypot(t1.ballVx, t1.ballVy);

        if (ballDistToTruck < t1.ballRadius + 20 && ballSpeed > 65 && t1.shuntCooldown <= 0) {
          t1.shuntCooldown = 0.9;
          t1.score += 40;
          t2.stunTimer = 0.65;
          t2.lastShovedBy = p1.id;
          t2.currentMood = 'shocked';
          t1.currentMood = 'triumph';

          // Knockback victim truck
          const hitAngle = Math.atan2(t2.y - t1.ballY, t2.x - t1.ballX);
          const knockForce = (260 + ballSpeed * 0.3) * (t1.isUnderdog ? 1.5 : 1.0);
          t2.x += Math.cos(hitAngle) * 30;
          t2.y += Math.sin(hitAngle) * 30;

          // Scatter 2 loose scrap items from victim
          if (t2.score >= 20) {
            t2.score -= 20;
            this.spawnDebris(t2.x, t2.y, 2, 'titanium');
          }

          this.audio.playExplosion();
          this.hitStopTimer = 0.045; // 45ms hit-stop
          this.screenShake = 10;
          this.particles.spawnSparks(t2.x, t2.y, p1.color, 16);
          this.addFloatingText('🔨 BALL SMASH! +40', t2.x, t2.y - 25, p1.color, 17);
        }

        // 2. Truck T-Bone Ramming (only check once per pair i < j)
        if (i < j) {
          const truckDist = Math.hypot(t1.x - t2.x, t1.y - t2.y);
          if (truckDist < 36) {
            const midX = (t1.x + t2.x) / 2;
            const midY = (t1.y + t2.y) / 2;

            this.audio.playBounce();
            this.hitStopTimer = 0.035;
            this.screenShake = 6;
            this.particles.spawnSparks(midX, midY, '#f59e0b', 10);

            // Elastic separation
            const sepAngle = Math.atan2(t2.y - t1.y, t2.x - t1.x);
            const sepDist = (36 - truckDist) / 2;
            t1.x -= Math.cos(sepAngle) * sepDist;
            t1.y -= Math.sin(sepAngle) * sepDist;
            t2.x += Math.cos(sepAngle) * sepDist;
            t2.y += Math.sin(sepAngle) * sepDist;

            const t1Fast = t1.speed > t2.speed + 50 || t1.turboTimer > 0;
            const t2Fast = t2.speed > t1.speed + 50 || t2.turboTimer > 0;

            if (t1Fast && !t2Fast) {
              t1.score += 30;
              t2.stunTimer = 0.45;
              t2.lastShovedBy = p1.id;
              this.addFloatingText('💥 T-BONE RAM! +30', midX, midY - 20, p1.color, 15);
            } else if (t2Fast && !t1Fast) {
              t2.score += 30;
              t1.stunTimer = 0.45;
              t1.lastShovedBy = p2.id;
              this.addFloatingText('💥 T-BONE RAM! +30', midX, midY - 20, p2.color, 15);
            }
          }
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
    width: number,
    height: number
  ): void {
    const truck = this.playersState.get(botId);
    if (!truck || truck.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    let delay = 0.24; // Normal: 220-250ms
    let blunderChance = 0.08;
    if (difficulty === 'bot_easy') {
      delay = 0.42; // Easy: 380-450ms
      blunderChance = 0.22;
    } else if (difficulty === 'bot_hard') {
      delay = 0.11; // Hard: 90-130ms
      blunderChance = 0.01;
    }

    let targetX = width / 2;
    let targetY = height / 2;
    let prioritizeWhip = false;

    // Hard bots look for nearby rivals to smash with the wrecking ball
    if (difficulty === 'bot_hard') {
      for (const [rid, rival] of this.playersState.entries()) {
        if (rid === botId) continue;
        const d = Math.hypot(truck.x - rival.x, truck.y - rival.y);
        if (d < 160) {
          targetX = rival.x;
          targetY = rival.y;
          prioritizeWhip = true;
          break;
        }
      }
    }

    // Look for high-value loose debris if nearby
    if (!prioritizeWhip && this.debrisList.length > 0) {
      let closestDebris = this.debrisList[0];
      let minD = Math.hypot(truck.x - closestDebris.x, truck.y - closestDebris.y);
      for (const d of this.debrisList) {
        const dist = Math.hypot(truck.x - d.x, truck.y - d.y);
        if (dist < minD) {
          minD = dist;
          closestDebris = d;
        }
      }
      if (minD < 180) {
        targetX = closestDebris.x;
        targetY = closestDebris.y;
      }
    }

    // Otherwise target closest scrap structure
    if (!prioritizeWhip && this.structures.length > 0) {
      let nearestSt = this.structures[0];
      let minD = Math.hypot(truck.x - nearestSt.x, truck.y - nearestSt.y);
      for (const st of this.structures) {
        // Hard bots favor explosive silos or quantum vaults
        let weight = 1.0;
        if (difficulty === 'bot_hard' && st.type === 'quantum_vault') weight = 0.6;
        const dist = Math.hypot(truck.x - st.x, truck.y - st.y) * weight;
        if (dist < minD) {
          minD = dist;
          nearestSt = st;
        }
      }
      targetX = nearestSt.x;
      targetY = nearestSt.y;
    }

    // Apply blunder steering
    if (Math.random() < blunderChance) {
      targetX += (Math.random() - 0.5) * 200;
      targetY += (Math.random() - 0.5) * 200;
    }

    // Angular steering calculation
    const desiredAngle = Math.atan2(targetY - truck.y, targetX - truck.x);
    let angleDiff = desiredAngle - truck.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    let steer = 0;
    if (Math.abs(angleDiff) > 0.15) {
      steer = angleDiff > 0 ? 1 : -1;
    }

    // Action / Whip decision
    let action = false;
    if (prioritizeWhip || Math.hypot(targetX - truck.x, targetY - truck.y) < 140) {
      if (difficulty === 'bot_hard') {
        if (truck.isChargingWhip) {
          action = truck.whipChargeTimer < 1.1; // release at tier 2
        } else {
          action = true;
        }
      } else {
        action = Math.random() < 0.6;
      }
    }

    this.input.setBotInput(botId, action, steer, 1, action);
    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const t = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: t?.score || 0,
        towers: t?.towersCrushed || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topScore = scores[0]?.score || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} crushed the demolition arena with ${topScore} scrap value!`
      : 'The scrap structures survived the heavy demolition derby!';

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

    // 1. Arena Floor Background
    ctx.fillStyle = theme.bgColor;
    ctx.fillRect(0, 0, width, height);

    // Decorative Steel Plate Inset
    ctx.fillStyle = theme.floorPlate;
    ctx.beginPath();
    ctx.roundRect(24, 78, width - 48, height - 104, 16);
    ctx.fill();

    // Subtle arena grid
    ctx.strokeStyle = theme.gridColor;
    ctx.lineWidth = 1;
    for (let x = 30; x < width - 30; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 80);
      ctx.lineTo(x, height - 30);
      ctx.stroke();
    }
    for (let y = 80; y < height - 30; y += 40) {
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(width - 30, y);
      ctx.stroke();
    }

    // Outer Caution Hazard Barrier
    ctx.strokeStyle = theme.barrierColor;
    ctx.lineWidth = 4;
    ctx.setLineDash([16, 12]);
    ctx.beginPath();
    ctx.roundRect(24, 78, width - 48, height - 104, 16);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Loose Scrap Debris
    this.renderDebris(ctx);

    // 3. Scrap Towers & Explosive Silos
    this.renderStructures(ctx, theme);

    // 4. Monster Trucks & Heavy Wrecking Balls
    this.renderTrucks(ctx, theme);

    // 5. Floating Text FX
    this.renderFloatingTexts(ctx);

    ctx.restore(); // Screen shake end

    // 6. Safe UI Layout
    this.renderUI(ctx, width, height, theme);
  }

  private renderDebris(ctx: CanvasRenderingContext2D): void {
    for (const d of this.debrisList) {
      ctx.save();
      ctx.translate(d.x, d.y);

      if (d.type === 'quantum_core') {
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#0284c7';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Hexagonal titanium nut
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        for (let a = 0; a < 6; a++) {
          const ang = (a / 6) * Math.PI * 2;
          const px = Math.cos(ang) * 5;
          const py = Math.sin(ang) * 5;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private renderStructures(ctx: CanvasRenderingContext2D, theme: DemolitionTheme): void {
    for (const st of this.structures) {
      ctx.save();
      const shakeX = (Math.random() - 0.5) * st.shake;
      const shakeY = (Math.random() - 0.5) * st.shake;
      ctx.translate(st.x + shakeX, st.y + shakeY);

      if (st.type === 'explosive_silo') {
        // Red Explosive Fuel Silo
        ctx.fillStyle = '#b91c1c';
        ctx.beginPath();
        ctx.arc(0, 0, st.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💣', 0, 0);
      } else if (st.type === 'quantum_vault') {
        // Cyan Reinforced Quantum Vault
        ctx.fillStyle = '#0f766e';
        ctx.beginPath();
        ctx.arc(0, 0, st.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#2dd4bf';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = '#ccfbf1';
        ctx.font = '900 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💎', 0, 0);
      } else {
        // Standard Industrial Scrap Tower
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(0, 0, st.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '900 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏗️', 0, 0);
      }

      // Circular HP Gauge Ring
      const hpPct = Math.max(0, st.hp / st.maxHp);
      ctx.strokeStyle = hpPct > 0.4 ? '#22c55e' : '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, st.radius + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpPct);
      ctx.stroke();

      ctx.restore();
    }
  }

  private renderTrucks(ctx: CanvasRenderingContext2D, theme: DemolitionTheme): void {
    const active = this.getActivePlayers();

    for (const p of active) {
      const truck = this.playersState.get(p.id);
      if (!truck) continue;

      const isBot = p.type !== 'human';

      // 1. Tow Chain (Articulated Steel Links)
      const towAttachX = truck.x - Math.cos(truck.angle) * 14;
      const towAttachY = truck.y - Math.sin(truck.angle) * 14;

      ctx.save();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(towAttachX, towAttachY);
      ctx.lineTo(truck.ballX, truck.ballY);
      ctx.stroke();

      // Render chain link beads
      const links = 5;
      for (let li = 1; li < links; li++) {
        const lx = towAttachX + (truck.ballX - towAttachX) * (li / links);
        const ly = towAttachY + (truck.ballY - towAttachY) * (li / links);
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 2. Heavy Spiked Wrecking Ball
      ctx.save();
      ctx.translate(truck.ballX, truck.ballY);

      if (truck.isUnderdog) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, truck.ballRadius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Ball body
      ctx.fillStyle = truck.isUnderdog ? '#78350f' : theme.ballColor;
      ctx.beginPath();
      ctx.arc(0, 0, truck.ballRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = truck.isUnderdog ? '#facc15' : '#cbd5e1';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Spikes around the ball
      const spikes = 6;
      for (let s = 0; s < spikes; s++) {
        const sang = (s / spikes) * Math.PI * 2;
        const spx = Math.cos(sang) * (truck.ballRadius + 5);
        const spy = Math.sin(sang) * (truck.ballRadius + 5);
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(spx, spy, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // 3. Monster Truck Chassis & Mascot Driver
      ctx.save();
      ctx.translate(truck.x, truck.y);
      ctx.rotate(truck.angle + truck.spinAngle);

      // Underdog Golden Glow
      if (truck.isUnderdog) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Heavy Demolition Tread Tires
      ctx.fillStyle = '#0f172a';
      // Front Left
      ctx.fillRect(8, -17, 10, 6);
      // Front Right
      ctx.fillRect(8, 11, 10, 6);
      // Rear Left
      ctx.fillRect(-18, -17, 10, 6);
      // Rear Right
      ctx.fillRect(-18, 11, 10, 6);

      // Steel Rim Hubs
      ctx.fillStyle = p.color;
      ctx.fillRect(11, -15, 4, 2);
      ctx.fillRect(11, 13, 4, 2);
      ctx.fillRect(-15, -15, 4, 2);
      ctx.fillRect(-15, 13, 4, 2);

      // Armored Truck Body
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(-16, -11, 32, 22, 5);
      ctx.fill();

      // Front Bull-Bar Grille
      ctx.fillStyle = '#475569';
      ctx.fillRect(14, -8, 4, 16);

      // Mascot Driver in Roll-Cage Cockpit
      drawCharacter(
        ctx,
        0,
        0,
        13,
        p.id,
        isBot,
        truck.currentMood,
        truck.animTime,
        undefined
      );

      // Whip Charge Arc Indicator
      if (truck.isChargingWhip) {
        const prog = Math.min(1, truck.whipChargeTimer / 1.6);
        ctx.strokeStyle = truck.whipTier === 3 ? '#ff0055' : truck.whipTier === 2 ? '#38bdf8' : '#facc15';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      // Overhead Tag
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`P${p.id + 1}`, truck.x, truck.y - 24);
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
    theme: DemolitionTheme
  ): void {
    // 1. Minigame Header Badge (Safe at y: 56, h: 28)
    ctx.save();
    ctx.textAlign = 'center';

    const badgeW = 400;
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
    ctx.fillText('🚜 CYBER DEMOLITION • HOLD TO CHARGE WHIP & RAM TOWERS', width / 2, badgeY + 18);
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
      ctx.fillText('⚡ SUDDEN DEATH: 2X DEBRIS VALUE & RAPID SILO DETONATIONS! ⚡', width / 2, 105);
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
      const t = this.playersState.get(p.id);
      if (!t) return;

      const cardW = 130;
      const cardH = 52;
      const isLeft = idx % 2 === 0;
      const isBottom = idx < 2;

      const cardX = isLeft ? 20 : width - cardW - 20;
      const cardY = isBottom ? height - 128 : 110;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = t.isUnderdog ? '#fbbf24' : p.color;
      ctx.lineWidth = t.isUnderdog ? 2 : 1;
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
        t.currentMood,
        t.animTime,
        undefined
      );

      // Score and towers
      ctx.font = '800 11px sans-serif';
      ctx.fillStyle = p.color;
      ctx.textAlign = 'left';
      ctx.fillText(`P${p.id + 1} (${t.towersCrushed} 🏗️)`, cardX + 44, cardY + 20);

      ctx.font = '900 14px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${t.score} pts`, cardX + 44, cardY + 38);

      if (t.isUnderdog) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '900 9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('⚡CRUSHER', cardX + cardW - 6, cardY + 16);
      }

      ctx.restore();
    });

    // 5. Control Hints
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('STEER & DRIVE: Swing Ball | HOLD: Charge Winch Whip & Turbo Ram', width - 20, height - 14);
    ctx.restore();
  }
}
