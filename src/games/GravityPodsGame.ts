import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type GravityPodsThemeId = 'magnetic_tube' | 'solar_conduit' | 'hydro_tunnel';

interface TubeTheme {
  id: GravityPodsThemeId;
  name: string;
  icon: string;
  bgGradCenter: string;
  bgGradOuter: string;
  tunnelRim: string;
  ringGlow: string;
  vortexLines: string;
  accentColor: string;
  hazardColor: string;
  wireframeColor: string;
}

const THEMES: Record<GravityPodsThemeId, TubeTheme> = {
  magnetic_tube: {
    id: 'magnetic_tube',
    name: 'Sub-Orbital Mag-Tube',
    icon: '⚡',
    bgGradCenter: '#030712',
    bgGradOuter: '#02040a',
    tunnelRim: '#00f0ff',
    ringGlow: 'rgba(0, 240, 255, 0.4)',
    vortexLines: 'rgba(0, 240, 255, 0.15)',
    accentColor: '#00f0ff',
    hazardColor: '#ef4444',
    wireframeColor: 'rgba(56, 189, 248, 0.25)'
  },
  solar_conduit: {
    id: 'solar_conduit',
    name: 'Solar Plasma Conduit',
    icon: '🌌',
    bgGradCenter: '#1c0a00',
    bgGradOuter: '#0a0300',
    tunnelRim: '#f59e0b',
    ringGlow: 'rgba(245, 158, 11, 0.4)',
    vortexLines: 'rgba(245, 158, 11, 0.15)',
    accentColor: '#fbbf24',
    hazardColor: '#f43f5e',
    wireframeColor: 'rgba(251, 191, 36, 0.25)'
  },
  hydro_tunnel: {
    id: 'hydro_tunnel',
    name: 'Abyssal Hydro-Tunnel',
    icon: '🌊',
    bgGradCenter: '#021824',
    bgGradOuter: '#010b12',
    tunnelRim: '#06b6d4',
    ringGlow: 'rgba(6, 182, 212, 0.4)',
    vortexLines: 'rgba(6, 182, 212, 0.15)',
    accentColor: '#22d3ee',
    hazardColor: '#ec4899',
    wireframeColor: 'rgba(34, 211, 238, 0.25)'
  }
};

const THEME_ORDER: GravityPodsThemeId[] = ['magnetic_tube', 'solar_conduit', 'hydro_tunnel'];

interface TunnelObstacle {
  id: number;
  z: number; // distance in 3D: 600 down to 0 (camera plane)
  angle: number; // position around tunnel (0 to 2*PI)
  type: 'warp_ring' | 'plasma_mine' | 'quantum_core' | 'laser_gate';
  widthAngle: number; // angular width for laser gate
  collected: boolean;
  bobble: number;
}

interface GravityPod {
  id: PlayerId;
  angle: number; // 0 to 2*PI around pipe perimeter
  angularVelocity: number;
  speed: number;
  nitroTimer: number;
  // Hold-to-Charge Grav-Pulse
  isChargingPulse: boolean;
  pulseChargeTimer: number;
  pulseTier: number;
  // Stun and combat
  stunTimer: number;
  spinAngle: number;
  shuntCooldown: number;
  lastShovedBy: PlayerId | null;
  score: number;
  ringsCollected: number;
  minesDodged: number;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  animTime: number;
}

interface FloatingTunnelText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export class GravityPodsGame extends BaseGame {
  public currentTheme: GravityPodsThemeId = 'magnetic_tube';
  public playersState: Map<PlayerId, GravityPod> = new Map();

  private tunnelCenterX: number = 0;
  private tunnelCenterY: number = 0;
  private pipeRadius: number = 155;

  private obstacles: TunnelObstacle[] = [];
  private obstacleSpawnTimer: number = 0.45;
  private obstacleIdCounter: number = 0;
  private floatingTexts: FloatingTunnelText[] = [];
  private textIdCounter: number = 0;

  private botReactionTimers: Map<PlayerId, number> = new Map();
  private screenShake: number = 0;
  private hitStopTimer: number = 0;
  private animTimer: number = 0;
  private vortexRotation: number = 0;

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
          this.setTheme('magnetic_tube');
        } else if (e.key === '2') {
          this.setTheme('solar_conduit');
        } else if (e.key === '3') {
          this.setTheme('hydro_tunnel');
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

  public setTheme(theme: GravityPodsThemeId): void {
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
    this.obstacles = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.animTimer = 0;
    this.vortexRotation = 0;
    this.obstacleIdCounter = 0;

    this.tunnelCenterX = width / 2;
    this.tunnelCenterY = height * 0.53;
    this.pipeRadius = Math.min(165, Math.min(width, height) * 0.28);

    // Initial staggered tunnel obstacles
    for (let i = 0; i < 5; i++) {
      this.spawnObstacle(200 + i * 90);
    }

    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      const startAngle = (idx / count) * Math.PI * 2;

      this.playersState.set(p.id, {
        id: p.id,
        angle: startAngle,
        angularVelocity: 0,
        speed: 220,
        nitroTimer: 0,
        isChargingPulse: false,
        pulseChargeTimer: 0,
        pulseTier: 0,
        stunTimer: 0,
        spinAngle: 0,
        shuntCooldown: 0,
        lastShovedBy: null,
        score: 0,
        ringsCollected: 0,
        minesDodged: 0,
        isUnderdog: false,
        currentMood: 'idle',
        animTime: 0
      });

      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  private spawnObstacle(customZ?: number): void {
    const z = customZ !== undefined ? customZ : 620;
    const roll = Math.random();
    let type: 'warp_ring' | 'plasma_mine' | 'quantum_core' | 'laser_gate' = 'warp_ring';

    if (roll < 0.38) type = 'warp_ring';
    else if (roll < 0.68) type = 'plasma_mine';
    else if (roll < 0.85) type = 'laser_gate';
    else type = 'quantum_core';

    this.obstacles.push({
      id: ++this.obstacleIdCounter,
      z,
      angle: Math.random() * Math.PI * 2,
      type,
      widthAngle: type === 'laser_gate' ? Math.PI * 0.85 : 0.35,
      collected: false,
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
    this.vortexRotation += dt * 0.4;

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

    // Spawn approaching tunnel obstacles
    this.obstacleSpawnTimer -= dt;
    const maxObstacles = this.roundTimer <= 15 ? 9 : 6;
    if (this.obstacleSpawnTimer <= 0 && this.obstacles.length < maxObstacles) {
      this.obstacleSpawnTimer = this.roundTimer <= 15 ? 0.32 + Math.random() * 0.25 : 0.55 + Math.random() * 0.35;
      this.spawnObstacle();
    }

    // Advance obstacles through 3D tunnel depth towards camera
    const approachSpeed = 260 + (this.roundTimer <= 15 ? 60 : 0);
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.z -= approachSpeed * dt;
      obs.bobble += dt * 3;

      if (obs.type === 'laser_gate') {
        obs.angle += dt * 0.6; // Rotating laser barriers!
      }

      // Check despawn when passing behind camera
      if (obs.z < -40) {
        this.obstacles.splice(i, 1);
      }
    }

    // Underdog calculation
    let maxScore = -1;
    const active = this.getActivePlayers();
    for (const p of active) {
      const pod = this.playersState.get(p.id);
      if (!pod) continue;
      if (pod.score > maxScore) maxScore = pod.score;
    }
    for (const p of active) {
      const pod = this.playersState.get(p.id);
      if (!pod) continue;
      pod.isUnderdog = maxScore - pod.score >= 50 && pod.score < maxScore;
    }

    // Bot AI update
    this.updateBots(dt, width, height);

    // Update each player pod
    for (const p of active) {
      const pod = this.playersState.get(p.id);
      if (!pod) continue;

      pod.animTime += dt * 6;
      if (pod.shuntCooldown > 0) pod.shuntCooldown -= dt;

      // Stun spinout handling
      if (pod.stunTimer > 0) {
        pod.stunTimer -= dt;
        pod.spinAngle += dt * 14;
        pod.speed *= Math.pow(0.2, dt);
        pod.currentMood = 'shocked';
        if (pod.stunTimer <= 0) {
          pod.spinAngle = 0;
          pod.currentMood = 'idle';
        }
      }

      const steer = this.input.getSteer(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      if (pod.stunTimer <= 0) {
        // High-grip perimeter rolling
        const rollAccel = steer * 8.5;
        pod.angularVelocity += rollAccel * dt;
        pod.angularVelocity *= Math.pow(0.02, dt);
        pod.angle += pod.angularVelocity * dt;

        // Hold-to-Charge Gravitational Repulsor Pulse
        if (isAction) {
          pod.isChargingPulse = true;
          pod.pulseChargeTimer += dt;
          pod.currentMood = 'focused';

          if (pod.pulseChargeTimer >= 1.5) {
            pod.pulseTier = 3;
          } else if (pod.pulseChargeTimer >= 0.85) {
            pod.pulseTier = 2;
          } else if (pod.pulseChargeTimer >= 0.35) {
            pod.pulseTier = 1;
          } else {
            pod.pulseTier = 0;
          }

          // Inward magnetic attractor pulls nearby rings in tunnel
          const podX = this.tunnelCenterX + Math.cos(pod.angle) * this.pipeRadius;
          const podY = this.tunnelCenterY + Math.sin(pod.angle) * this.pipeRadius;
          if (Math.random() < 0.35) {
            const pulseCol = pod.pulseTier === 3 ? '#ff0055' : pod.pulseTier === 2 ? '#38bdf8' : '#facc15';
            this.particles.spawnSparks(podX, podY, pulseCol, 2);
          }
        } else {
          // Release: Grav-Pulse Discharge & Nitro Surge!
          if (pod.isChargingPulse && pod.pulseChargeTimer >= 0.3) {
            pod.isChargingPulse = false;
            pod.nitroTimer = 1.0 + pod.pulseTier * 0.5;
            pod.speed = 360 + pod.pulseTier * 60;

            const podX = this.tunnelCenterX + Math.cos(pod.angle) * this.pipeRadius;
            const podY = this.tunnelCenterY + Math.sin(pod.angle) * this.pipeRadius;

            this.audio.playWhoosh();
            this.screenShake = 4 + pod.pulseTier * 2.5;

            // Shockwave clears nearby mines in z < 160
            for (const obs of this.obstacles) {
              if (obs.z < 180 && obs.z > 0 && obs.type === 'plasma_mine') {
                obs.collected = true;
                this.audio.playExplosion();
                this.particles.spawnSparks(podX, podY, '#38bdf8', 10);
                this.addFloatingText('🛡️ MINE VAPORIZED!', podX, podY - 25, '#38bdf8', 14);
              }
            }

            const label = pod.pulseTier === 3 ? '🔥 OVERDRIVE GRAV-WARP!' : pod.pulseTier === 2 ? '⚡ GRAV-PULSE!' : '🚀 NITRO SURGE!';
            const col = pod.pulseTier === 3 ? '#ff0055' : pod.pulseTier === 2 ? '#38bdf8' : '#facc15';
            this.addFloatingText(label, podX, podY - 25, col, 16);
            this.particles.spawnSparks(podX, podY, col, 14);

            pod.pulseChargeTimer = 0;
            pod.pulseTier = 0;
            pod.currentMood = 'triumph';
          } else {
            pod.isChargingPulse = false;
            pod.pulseChargeTimer = 0;
            pod.pulseTier = 0;
          }
        }

        // Active nitro timer decay
        if (pod.nitroTimer > 0) {
          pod.nitroTimer -= dt;
          const podX = this.tunnelCenterX + Math.cos(pod.angle) * this.pipeRadius;
          const podY = this.tunnelCenterY + Math.sin(pod.angle) * this.pipeRadius;
          this.particles.emit(podX, podY, 2, pod.isUnderdog ? '#fbbf24' : p.color);
          if (pod.nitroTimer <= 0 && pod.currentMood === 'triumph') pod.currentMood = 'idle';
        } else {
          pod.speed = Math.max(220, pod.speed - 120 * dt);
        }

        // Passive scoring
        pod.score += dt * 15;
      }

      // Check collision with obstacles at camera plane (z in [-25, 45])
      for (const obs of this.obstacles) {
        if (obs.collected) continue;

        if (obs.z > -25 && obs.z < 45) {
          let angleDiff = Math.abs(pod.angle - obs.angle);
          while (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - Math.PI * 2);

          const hitThreshold = obs.type === 'laser_gate' ? obs.widthAngle * 0.5 : 0.38;

          if (angleDiff < hitThreshold) {
            const podX = this.tunnelCenterX + Math.cos(pod.angle) * this.pipeRadius;
            const podY = this.tunnelCenterY + Math.sin(pod.angle) * this.pipeRadius;

            if (obs.type === 'warp_ring') {
              obs.collected = true;
              pod.ringsCollected++;
              const mult = this.roundTimer <= 15 ? 2 : 1;
              const pts = 25 * mult;
              pod.score += pts;
              pod.nitroTimer = 1.8;
              this.audio.playScore();
              this.particles.spawnConfetti(podX, podY, 14);
              this.addFloatingText(`✨ WARP RING! +${pts}`, podX, podY - 25, '#fbbf24', 16);
              pod.currentMood = 'triumph';
            } else if (obs.type === 'quantum_core') {
              obs.collected = true;
              pod.score += 50;
              pod.nitroTimer = 2.4;
              this.audio.playFanfare();
              this.particles.spawnConfetti(podX, podY, 20);
              this.addFloatingText('💎 QUANTUM CORE! +50', podX, podY - 25, '#38bdf8', 18);
              pod.currentMood = 'triumph';
            } else if (obs.type === 'plasma_mine') {
              if (!pod.isUnderdog) {
                obs.collected = true;
                pod.stunTimer = 0.8;
                pod.score = Math.max(0, pod.score - 20);
                this.audio.playExplosion();
                this.screenShake = 9;
                this.particles.spawnSparks(podX, podY, '#ef4444', 16);
                this.addFloatingText('💥 MINE DETONATION! -20', podX, podY - 25, '#ef4444', 16);
                pod.currentMood = 'shocked';
              } else {
                obs.collected = true;
                this.audio.playBounce();
                this.particles.spawnSparks(podX, podY, '#fbbf24', 12);
                this.addFloatingText('🛡️ UNDERDOG SHIELD DEFLECT!', podX, podY - 25, '#fbbf24', 15);
              }
            } else if (obs.type === 'laser_gate') {
              if (!pod.isUnderdog) {
                pod.stunTimer = 0.6;
                pod.score = Math.max(0, pod.score - 15);
                this.audio.playBounce();
                this.screenShake = 6;
                this.particles.spawnSparks(podX, podY, '#ec4899', 14);
                this.addFloatingText('⚡ LASER GRID SHOCK! -15', podX, podY - 25, '#ec4899', 15);
                pod.currentMood = 'shocked';
              }
            }
          }
        }
      }
    }

    // Inter-Player Contact & Magnetic Shunts
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const p1 = active[i];
        const p2 = active[j];
        const pod1 = this.playersState.get(p1.id);
        const pod2 = this.playersState.get(p2.id);
        if (!pod1 || !pod2) continue;

        let diffAngle = Math.abs(pod1.angle - pod2.angle);
        while (diffAngle > Math.PI) diffAngle = Math.abs(diffAngle - Math.PI * 2);

        if (diffAngle < 0.28) {
          const midA = (pod1.angle + pod2.angle) / 2;
          const midX = this.tunnelCenterX + Math.cos(midA) * this.pipeRadius;
          const midY = this.tunnelCenterY + Math.sin(midA) * this.pipeRadius;

          this.audio.playBounce();
          this.hitStopTimer = 0.045; // 45ms hit-stop
          this.screenShake = 6;
          this.particles.spawnSparks(midX, midY, '#f59e0b', 12);

          // Elastic separation around perimeter
          const pushSign = pod1.angle < pod2.angle ? -1 : 1;
          const shuntForce = 4.2 * (pod1.isUnderdog || pod2.isUnderdog ? 1.5 : 1.0);

          pod1.angularVelocity += pushSign * shuntForce;
          pod2.angularVelocity -= pushSign * shuntForce;

          const p1Strong = pod1.nitroTimer > 0 || pod1.isUnderdog;
          const p2Strong = pod2.nitroTimer > 0 || pod2.isUnderdog;

          if (p1Strong && !p2Strong && pod1.shuntCooldown <= 0) {
            pod1.shuntCooldown = 1.0;
            pod1.score += 35;
            pod2.stunTimer = 0.55;
            pod2.lastShovedBy = p1.id;
            pod2.currentMood = 'shocked';
            pod1.currentMood = 'triumph';
            this.addFloatingText('💥 REPULSOR SHUNT! +35', midX, midY - 25, p1.color, 16);
          } else if (p2Strong && !p1Strong && pod2.shuntCooldown <= 0) {
            pod2.shuntCooldown = 1.0;
            pod2.score += 35;
            pod1.stunTimer = 0.55;
            pod1.lastShovedBy = p2.id;
            pod1.currentMood = 'shocked';
            pod2.currentMood = 'triumph';
            this.addFloatingText('💥 REPULSOR SHUNT! +35', midX, midY - 25, p2.color, 16);
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
    _width: number,
    _height: number
  ): void {
    const pod = this.playersState.get(botId);
    if (!pod || pod.stunTimer > 0) return;

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

    // Inspect oncoming obstacles within z in [20, 260]
    const upcoming = this.obstacles.filter(o => o.z > 20 && o.z < 260 && !o.collected);

    let targetAngle = pod.angle;
    let prioritizePulse = false;

    if (upcoming.length > 0) {
      // Find closest imminent obstacle
      let nearest = upcoming[0];
      for (const o of upcoming) {
        if (o.z < nearest.z) nearest = o;
      }

      let diff = nearest.angle - pod.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      if (nearest.type === 'plasma_mine') {
        if (!pod.isUnderdog && Math.abs(diff) < 0.9) {
          // Dodge away from mine
          targetAngle = pod.angle + (diff > 0 ? -1.2 : 1.2);
          if (difficulty === 'bot_hard' && nearest.z < 120) {
            prioritizePulse = true; // Blast it away with pulse!
          }
        }
      } else if (nearest.type === 'laser_gate') {
        if (Math.abs(diff) < nearest.widthAngle * 0.6) {
          // Dodge to the open opposite half of the tunnel
          targetAngle = nearest.angle + Math.PI;
        }
      } else if (nearest.type === 'warp_ring' || nearest.type === 'quantum_core') {
        // Roll towards ring
        targetAngle = nearest.angle;
      }
    }

    // Hard bots look to shunt nearby rivals into hazards
    if (difficulty === 'bot_hard' && upcoming.length === 0) {
      for (const [rid, rival] of this.playersState.entries()) {
        if (rid === botId) continue;
        let diff = rival.angle - pod.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        if (Math.abs(diff) < 0.5) {
          targetAngle = rival.angle; // Ram rival!
          prioritizePulse = true;
          break;
        }
      }
    }

    // Apply blunder
    if (Math.random() < blunderChance) {
      targetAngle += (Math.random() - 0.5) * 1.5;
    }

    let steerDiff = targetAngle - pod.angle;
    while (steerDiff > Math.PI) steerDiff -= Math.PI * 2;
    while (steerDiff < -Math.PI) steerDiff += Math.PI * 2;

    let steer = 0;
    if (Math.abs(steerDiff) > 0.12) {
      steer = steerDiff > 0 ? 1 : -1;
    }

    let action = false;
    if (prioritizePulse) {
      if (difficulty === 'bot_hard') {
        if (pod.isChargingPulse) {
          action = pod.pulseChargeTimer < 0.9;
        } else {
          action = true;
        }
      } else {
        action = Math.random() < 0.6;
      }
    }

    this.input.setBotInput(botId, action, steer, 1, action);
    this.botReactionTimers.set(botId, reactionDelay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const pod = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: Math.floor(pod?.score || 0),
        rings: pod?.ringsCollected || 0
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
      ? `Player ${winnerId + 1} mastered the Magnetic Hyper-Tube with ${topScore} pts!`
      : 'The magnetic hyper-tube collapsed in an explosive dead-heat!';

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

    // 1. Cosmic Background Radial Depth Gradient
    const bgGrad = ctx.createRadialGradient(
      this.tunnelCenterX,
      this.tunnelCenterY,
      10,
      this.tunnelCenterX,
      this.tunnelCenterY,
      Math.max(width, height) * 0.7
    );
    bgGrad.addColorStop(0, theme.bgGradCenter);
    bgGrad.addColorStop(1, theme.bgGradOuter);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. 3D Concentric Wireframe Tunnel Rings
    this.renderTunnelStructure(ctx, theme);

    // 3. Approaching Obstacles in 3D Perspective (Z: 600 down to 0)
    this.renderObstacles(ctx, theme);

    // 4. Gravity Pods on Outer Rim
    this.renderPods(ctx);

    // 5. Floating Text FX
    this.renderFloatingTexts(ctx);

    ctx.restore(); // Screen shake end

    // 6. Safe UI Layout
    this.renderUI(ctx, width, height, theme);
  }

  private renderTunnelStructure(ctx: CanvasRenderingContext2D, theme: TubeTheme): void {
    ctx.save();

    // Concentric perspective rings into distance
    const rings = 8;
    for (let r = 1; r <= rings; r++) {
      const depthRatio = r / rings;
      const radius = this.pipeRadius * depthRatio;
      ctx.strokeStyle = theme.wireframeColor;
      ctx.lineWidth = 1 + depthRatio * 1.5;
      ctx.beginPath();
      ctx.arc(this.tunnelCenterX, this.tunnelCenterY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Longitudinal vortex lines radiating from center
    const rays = 12;
    ctx.strokeStyle = theme.vortexLines;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < rays; i++) {
      const ang = (i / rays) * Math.PI * 2 + this.vortexRotation;
      const x1 = this.tunnelCenterX + Math.cos(ang) * 18;
      const y1 = this.tunnelCenterY + Math.sin(ang) * 18;
      const x2 = this.tunnelCenterX + Math.cos(ang) * this.pipeRadius;
      const y2 = this.tunnelCenterY + Math.sin(ang) * this.pipeRadius;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Outer Primary Magnetic Rim
    ctx.strokeStyle = theme.tunnelRim;
    ctx.lineWidth = 4;
    ctx.shadowColor = theme.tunnelRim;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(this.tunnelCenterX, this.tunnelCenterY, this.pipeRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  private renderObstacles(ctx: CanvasRenderingContext2D, theme: TubeTheme): void {
    // Sort obstacles back-to-front so closer objects render on top
    const sorted = [...this.obstacles].sort((a, b) => b.z - a.z);

    for (const obs of sorted) {
      if (obs.collected) continue;

      // 3D Perspective scale
      const scale = Math.max(0.12, 1.0 - obs.z / 620);
      const ringR = this.pipeRadius * scale;
      const ox = this.tunnelCenterX + Math.cos(obs.angle) * ringR;
      const oy = this.tunnelCenterY + Math.sin(obs.angle) * ringR;

      ctx.save();

      if (obs.type === 'laser_gate') {
        // Rotating laser barrier arc
        ctx.strokeStyle = theme.hazardColor;
        ctx.lineWidth = 4 * scale;
        ctx.shadowColor = theme.hazardColor;
        ctx.shadowBlur = 10 * scale;
        ctx.beginPath();
        ctx.arc(
          this.tunnelCenterX,
          this.tunnelCenterY,
          ringR,
          obs.angle - obs.widthAngle * 0.5,
          obs.angle + obs.widthAngle * 0.5
        );
        ctx.stroke();

        // Laser end emitters
        const e1x = this.tunnelCenterX + Math.cos(obs.angle - obs.widthAngle * 0.5) * ringR;
        const e1y = this.tunnelCenterY + Math.sin(obs.angle - obs.widthAngle * 0.5) * ringR;
        const e2x = this.tunnelCenterX + Math.cos(obs.angle + obs.widthAngle * 0.5) * ringR;
        const e2y = this.tunnelCenterY + Math.sin(obs.angle + obs.widthAngle * 0.5) * ringR;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(e1x, e1y, 4 * scale, 0, Math.PI * 2);
        ctx.arc(e2x, e2y, 4 * scale, 0, Math.PI * 2);
        ctx.fill();
      } else if (obs.type === 'warp_ring') {
        // Glowing Golden Warp Ring
        ctx.translate(ox, oy);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3.5 * scale;
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 12 * scale;
        ctx.beginPath();
        ctx.arc(0, 0, 16 * scale, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#fef08a';
        ctx.font = `bold ${Math.max(8, Math.floor(12 * scale))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', 0, 0);
      } else if (obs.type === 'quantum_core') {
        // High-Value Cyan Quantum Core
        ctx.translate(ox, oy);
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#0284c7';
        ctx.shadowBlur = 14 * scale;
        ctx.beginPath();
        ctx.arc(0, 0, 14 * scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = `900 ${Math.max(7, Math.floor(11 * scale))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💎', 0, 0);
      } else if (obs.type === 'plasma_mine') {
        // Red Spiked Plasma Mine
        ctx.translate(ox, oy);
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#dc2626';
        ctx.shadowBlur = 10 * scale;
        ctx.beginPath();
        ctx.arc(0, 0, 12 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Mine spikes
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 2 * scale;
        for (let s = 0; s < 6; s++) {
          const sang = (s / 6) * Math.PI * 2 + obs.bobble;
          ctx.beginPath();
          ctx.moveTo(Math.cos(sang) * 10 * scale, Math.sin(sang) * 10 * scale);
          ctx.lineTo(Math.cos(sang) * 17 * scale, Math.sin(sang) * 17 * scale);
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  private renderPods(ctx: CanvasRenderingContext2D): void {
    const active = this.getActivePlayers();

    for (const p of active) {
      const pod = this.playersState.get(p.id);
      if (!pod) continue;

      const px = this.tunnelCenterX + Math.cos(pod.angle) * this.pipeRadius;
      const py = this.tunnelCenterY + Math.sin(pod.angle) * this.pipeRadius;
      const isBot = p.type !== 'human';

      ctx.save();
      ctx.translate(px, py);
      // Tangent orientation with bank tilt
      const bankTilt = (pod.angularVelocity / 6.0) * 0.4;
      ctx.rotate(pod.angle + Math.PI / 2 + pod.spinAngle + bankTilt);

      // Underdog Grav-Anchor Shield
      if (pod.isUnderdog) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Twin Ion Stabilizer Wings
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(-16, 6);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-8, 12);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(16, 6);
      ctx.lineTo(8, -10);
      ctx.lineTo(8, 12);
      ctx.closePath();
      ctx.fill();

      // Wingtip lights
      ctx.fillStyle = p.color;
      ctx.fillRect(-17, 4, 3, 4);
      ctx.fillRect(14, 4, 3, 4);

      // Pod Fuselage
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(-9, -12, 18, 24, 4);
      ctx.fill();

      // Repulsor Engine Thruster Glow
      const thrusterColor = pod.nitroTimer > 0 ? '#38bdf8' : '#f59e0b';
      ctx.fillStyle = thrusterColor;
      ctx.shadowColor = thrusterColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 12, 5, 0, Math.PI * 2);
      ctx.fill();

      // Mascot Pilot
      drawCharacter(
        ctx,
        0,
        -2,
        13,
        p.id,
        isBot,
        pod.currentMood,
        pod.animTime,
        undefined
      );

      // Charge Ring Arc Indicator
      if (pod.isChargingPulse) {
        const prog = Math.min(1, pod.pulseChargeTimer / 1.5);
        ctx.strokeStyle = pod.pulseTier === 3 ? '#ff0055' : pod.pulseTier === 2 ? '#38bdf8' : '#facc15';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -2, 20, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();

      // Overhead ID
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`P${p.id + 1}`, px, py - 22);
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
    theme: TubeTheme
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
    ctx.fillText('🛸 GRAVITY PODS • ROLL PERIMETER & CHARGE GRAV-PULSE', width / 2, badgeY + 18);
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
      ctx.fillText('⚡ SUDDEN DEATH: 2X RING POINTS & ROTATING LASER BARRICADES! ⚡', width / 2, 105);
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
      const pod = this.playersState.get(p.id);
      if (!pod) return;

      const cardW = 130;
      const cardH = 52;
      const isLeft = idx % 2 === 0;
      const isBottom = idx < 2;

      const cardX = isLeft ? 20 : width - cardW - 20;
      const cardY = isBottom ? height - 128 : 110;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = pod.isUnderdog ? '#fbbf24' : p.color;
      ctx.lineWidth = pod.isUnderdog ? 2 : 1;
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
        pod.currentMood,
        pod.animTime,
        undefined
      );

      // Score and rings
      ctx.font = '800 11px sans-serif';
      ctx.fillStyle = p.color;
      ctx.textAlign = 'left';
      ctx.fillText(`P${p.id + 1} (${pod.ringsCollected} ⚡)`, cardX + 44, cardY + 20);

      ctx.font = '900 14px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${Math.floor(pod.score)} pts`, cardX + 44, cardY + 38);

      if (pod.isUnderdog) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '900 9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('⚡ANCHOR', cardX + cardW - 6, cardY + 16);
      }

      ctx.restore();
    });

    // 5. Control Hints
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('STEER: Roll Perimeter | HOLD: Charge Grav-Pulse & Nitro Surge', width - 20, height - 14);
    ctx.restore();
  }
}
