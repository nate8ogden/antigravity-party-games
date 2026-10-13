import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

interface FirewallBeam {
  angle: number;
  speed: number;
  length: number;
  innerRadius: number;
  active: boolean;
}

interface DataPacket {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'data_shard' | 'memory_core' | 'quantum_key';
  value: number;
  radius: number;
  pulsePhase: number;
  collected: boolean;
}

interface Netrunner {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  chargeTime: number; // 0 to 1.3s
  isCharging: boolean;
  overheatTimer: number;
  phaseTimer: number; // Invulnerable phase / EMP siphon state
  stunTimer: number;
  streakCount: number;
  streakTimer: number;
  mood: CharacterMood;
  animTimer: number;
  sabotageCount: number;
  isOverclocked: boolean;
}

interface VisualTheme {
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  floorColor: string;
  gridLineColor: string;
  coreGlow: string;
  coreColor: string;
  beamColor: string;
  beamGlow: string;
  circuitColor: string;
}

const THEMES: VisualTheme[] = [
  {
    name: 'Neon Matrix Grid',
    icon: '🟢',
    bgGradTop: '#02180a',
    bgGradBottom: '#000803',
    floorColor: '#05230f',
    gridLineColor: 'rgba(16, 185, 129, 0.25)',
    coreGlow: 'rgba(16, 185, 129, 0.45)',
    coreColor: '#10b981',
    beamColor: '#34d399',
    beamGlow: 'rgba(52, 211, 153, 0.65)',
    circuitColor: 'rgba(5, 150, 105, 0.4)'
  },
  {
    name: 'Cyber Megacorp Server',
    icon: '🏙️',
    bgGradTop: '#090d1f',
    bgGradBottom: '#03050c',
    floorColor: '#111827',
    gridLineColor: 'rgba(59, 130, 246, 0.25)',
    coreGlow: 'rgba(99, 102, 241, 0.45)',
    coreColor: '#6366f1',
    beamColor: '#ec4899',
    beamGlow: 'rgba(236, 72, 153, 0.65)',
    circuitColor: 'rgba(79, 70, 229, 0.4)'
  },
  {
    name: 'Deep Darknet Silo',
    icon: '🖤',
    bgGradTop: '#1a0505',
    bgGradBottom: '#080000',
    floorColor: '#260c0c',
    gridLineColor: 'rgba(239, 68, 68, 0.25)',
    coreGlow: 'rgba(239, 68, 68, 0.45)',
    coreColor: '#ef4444',
    beamColor: '#f97316',
    beamGlow: 'rgba(249, 115, 22, 0.65)',
    circuitColor: 'rgba(220, 38, 38, 0.4)'
  }
];

export class HackTerminalGame extends BaseGame {
  private netrunners: Map<PlayerId, Netrunner> = new Map();
  private beams: FirewallBeam[] = [];
  private packets: DataPacket[] = [];
  private nextPacketId = 1;
  private packetSpawnTimer = 0;

  private currentThemeIndex = 0;
  private screenShake = 0;
  private hitStopTimer = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private announcementText = '';
  private announcementTimer = 0;

  private keydownHandler?: (e: KeyboardEvent) => void;
  private clickHandler?: (e: MouseEvent) => void;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;

    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === '1') {
        this.setTheme(0);
      } else if (e.key === '2') {
        this.setTheme(1);
      } else if (e.key === '3') {
        this.setTheme(2);
      }
    };
    window.addEventListener('keydown', this.keydownHandler);

    this.clickHandler = (e: MouseEvent) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Bottom-left Theme Pill bounds: x: 20, y: height - 44, w: 170, h: 32
      const canvasHeight = canvas.height;
      if (mouseX >= 20 && mouseX <= 190 && mouseY >= canvasHeight - 44 && mouseY <= canvasHeight - 12) {
        this.cycleTheme();
      }
    };
    window.addEventListener('click', this.clickHandler);
  }

  private cycleTheme(): void {
    this.currentThemeIndex = (this.currentThemeIndex + 1) % THEMES.length;
    this.audio.playTap();
    this.triggerAnnouncement(`THEME: ${THEMES[this.currentThemeIndex].name}`);
  }

  private setTheme(index: number): void {
    if (index >= 0 && index < THEMES.length) {
      this.currentThemeIndex = index;
      this.audio.playTap();
      this.triggerAnnouncement(`THEME: ${THEMES[this.currentThemeIndex].name}`);
    }
  }

  private triggerAnnouncement(msg: string, duration: number = 1.6): void {
    this.announcementText = msg;
    this.announcementTimer = duration;
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.packets = [];
    this.nextPacketId = 1;
    this.packetSpawnTimer = 0;
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.announcementText = '';
    this.announcementTimer = 0;

    const active = this.getActivePlayers();
    this.netrunners.clear();
    this.botReactionTimers.clear();

    const cx = width / 2;
    const cy = height / 2;
    const spawnDist = Math.min(width, height) * 0.35;

    active.forEach((p, idx) => {
      const angle = (idx / active.length) * Math.PI * 2 - Math.PI / 2;
      this.netrunners.set(p.id, {
        id: p.id,
        x: cx + Math.cos(angle) * spawnDist,
        y: cy + Math.sin(angle) * spawnDist,
        vx: 0,
        vy: 0,
        angle: angle + Math.PI,
        score: 0,
        chargeTime: 0,
        isCharging: false,
        overheatTimer: 0,
        phaseTimer: 0,
        stunTimer: 0,
        streakCount: 0,
        streakTimer: 0,
        mood: 'idle',
        animTimer: 0,
        sabotageCount: 0,
        isOverclocked: false
      });
      this.botReactionTimers.set(p.id, 0);
    });

    // Initialize Rotating ICE Firewall Beams
    this.beams = [
      {
        angle: 0,
        speed: 0.85,
        length: Math.min(width, height) * 0.42,
        innerRadius: 65,
        active: true
      },
      {
        angle: Math.PI,
        speed: 0.85,
        length: Math.min(width, height) * 0.42,
        innerRadius: 65,
        active: true
      },
      {
        angle: Math.PI / 2,
        speed: -0.65,
        length: Math.min(width, height) * 0.38,
        innerRadius: 75,
        active: true
      }
    ];

    // Seed initial data packets
    for (let i = 0; i < 7; i++) {
      this.spawnDataPacket(width, height);
    }
  }

  private spawnDataPacket(width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2;
    const arenaRadius = Math.min(width, height) * 0.44;

    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * (arenaRadius - 95);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;

    // Roll packet type
    const roll = Math.random();
    let type: 'data_shard' | 'memory_core' | 'quantum_key' = 'data_shard';
    let value = 20;
    let radius = 13;

    if (this.roundTimer <= 12) {
      // Sudden death: higher chance of rare keys
      if (roll < 0.35) {
        type = 'quantum_key';
        value = 75;
        radius = 18;
      } else if (roll < 0.7) {
        type = 'memory_core';
        value = 45;
        radius = 15;
      }
    } else {
      if (roll < 0.15) {
        type = 'quantum_key';
        value = 75;
        radius = 18;
      } else if (roll < 0.45) {
        type = 'memory_core';
        value = 45;
        radius = 15;
      }
    }

    this.packets.push({
      id: this.nextPacketId++,
      x,
      y,
      vx: (Math.random() - 0.5) * 15,
      vy: (Math.random() - 0.5) * 15,
      type,
      value,
      radius,
      pulsePhase: Math.random() * Math.PI * 2,
      collected: false
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    if (this.announcementTimer > 0) {
      this.announcementTimer -= dt;
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 30);
    }

    const cx = width / 2;
    const cy = height / 2;
    const arenaRadius = Math.min(width, height) * 0.45;
    const isSuddenDeath = this.roundTimer <= 12.0;

    // Check leader score for Underdog Surge
    let highestScore = 0;
    for (const runner of this.netrunners.values()) {
      if (runner.score > highestScore) highestScore = runner.score;
    }

    for (const runner of this.netrunners.values()) {
      runner.isOverclocked = (highestScore - runner.score) >= 35 && highestScore > 30;
    }

    // Spawn packets periodically
    this.packetSpawnTimer += dt;
    const spawnInterval = isSuddenDeath ? 0.7 : 1.3;
    const maxPackets = isSuddenDeath ? 12 : 9;
    if (this.packetSpawnTimer >= spawnInterval && this.packets.filter(p => !p.collected).length < maxPackets) {
      this.packetSpawnTimer = 0;
      this.spawnDataPacket(width, height);
    }

    // Update Rotating ICE Firewall Beams
    const speedMultiplier = isSuddenDeath ? 1.45 : 1.0;
    for (const beam of this.beams) {
      beam.angle += beam.speed * speedMultiplier * dt;
    }

    // Update Floating Packets
    for (const packet of this.packets) {
      if (packet.collected) continue;
      packet.pulsePhase += dt * 3.5;
      packet.x += packet.vx * dt;
      packet.y += packet.vy * dt;

      // Keep within arena radius
      const distFromCenter = Math.hypot(packet.x - cx, packet.y - cy);
      if (distFromCenter > arenaRadius - 30) {
        const ang = Math.atan2(packet.y - cy, packet.x - cx);
        packet.x = cx + Math.cos(ang) * (arenaRadius - 30);
        packet.y = cy + Math.sin(ang) * (arenaRadius - 30);
        packet.vx = -packet.vx * 0.8;
        packet.vy = -packet.vy * 0.8;
      }
    }

    this.updateBots(dt, width, height);

    // Update Players
    for (const runner of this.netrunners.values()) {
      runner.animTimer += dt;

      if (runner.streakTimer > 0) {
        runner.streakTimer -= dt;
        if (runner.streakTimer <= 0) {
          runner.streakCount = 0;
        }
      }

      if (runner.overheatTimer > 0) {
        runner.overheatTimer -= dt;
        runner.mood = 'shocked';
        runner.vx *= Math.pow(0.05, dt);
        runner.vy *= Math.pow(0.05, dt);
        runner.x += runner.vx * dt;
        runner.y += runner.vy * dt;
        continue;
      }

      if (runner.stunTimer > 0) {
        runner.stunTimer -= dt;
        runner.mood = 'shocked';
        runner.vx *= Math.pow(0.1, dt);
        runner.vy *= Math.pow(0.1, dt);
        runner.x += runner.vx * dt;
        runner.y += runner.vy * dt;
        continue;
      }

      if (runner.phaseTimer > 0) {
        runner.phaseTimer -= dt;
      }

      // Input reading
      const steerX = this.input.getSteer(runner.id);
      const throttleY = -this.input.getThrottle(runner.id);
      const actionHeld = this.input.isActionPressed(runner.id) || this.input.isPressed(runner.id);

      // Movement physics
      const baseSpeed = runner.isOverclocked ? 290 : 240;
      const speed = runner.isCharging ? baseSpeed * 0.45 : baseSpeed;

      if (Math.hypot(steerX, throttleY) > 0.15) {
        const moveAng = Math.atan2(throttleY, steerX);
        runner.angle = moveAng;
        runner.vx += Math.cos(moveAng) * speed * 7.0 * dt;
        runner.vy += Math.sin(moveAng) * speed * 7.0 * dt;
      }

      // Kinematic damping
      const damping = Math.pow(0.04, dt);
      runner.vx *= damping;
      runner.vy *= damping;

      runner.x += runner.vx * dt;
      runner.y += runner.vy * dt;

      // Arena boundary constraint
      const pDist = Math.hypot(runner.x - cx, runner.y - cy);
      if (pDist > arenaRadius - 22) {
        const pAng = Math.atan2(runner.y - cy, runner.x - cx);
        runner.x = cx + Math.cos(pAng) * (arenaRadius - 22);
        runner.y = cy + Math.sin(pAng) * (arenaRadius - 22);
        runner.vx = -runner.vx * 0.5;
        runner.vy = -runner.vy * 0.5;
      }

      // Center core obstruction (radius 60px)
      if (pDist < 60) {
        const cAng = Math.atan2(runner.y - cy, runner.x - cx);
        runner.x = cx + Math.cos(cAng) * 60;
        runner.y = cy + Math.sin(cAng) * 60;
        runner.vx += Math.cos(cAng) * 120 * dt;
        runner.vy += Math.sin(cAng) * 120 * dt;
      }

      // Action Charging & Sweet Spot Mechanism
      if (actionHeld) {
        runner.isCharging = true;
        runner.chargeTime += dt;
        runner.mood = 'focused';

        // Overcharge penalty (> 1.25s)
        if (runner.chargeTime >= 1.25) {
          runner.chargeTime = 0;
          runner.isCharging = false;
          runner.overheatTimer = 0.85;
          runner.score = Math.max(0, runner.score - 5);
          this.audio.playExplosion();
          this.screenShake = 12;
          this.particles.emit(runner.x, runner.y, 28, '#EF4444');
          this.triggerAnnouncement(`${this.getPlayer(runner.id)?.name || 'RUNNER'} ICE OVERFLOW!`, 1.2);
          continue;
        }
      } else if (runner.isCharging) {
        // Released! Evaluate charge
        const chargeRatio = runner.chargeTime / 1.0;
        const sweetSpotMin = runner.isOverclocked ? 0.50 : 0.72;
        const sweetSpotMax = runner.isOverclocked ? 1.05 : 0.98;

        if (chargeRatio >= sweetSpotMin && chargeRatio <= sweetSpotMax) {
          // SWEET SPOT: Supersonic EMP Siphon & Phase Surge!
          runner.phaseTimer = 1.35; // Invulnerable to beams
          runner.mood = 'triumph';
          runner.score += 25; // Hack Ace bonus!
          this.audio.playScore();
          this.screenShake = 14;
          this.particles.emit(runner.x, runner.y, 35, '#38BDF8');
          this.particles.emit(runner.x, runner.y, 20, '#F59E0B');

          // Impulse dash in facing direction
          runner.vx += Math.cos(runner.angle) * 360;
          runner.vy += Math.sin(runner.angle) * 360;

          // Siphon nearby packets instantly
          const siphonRadius = runner.isOverclocked ? 190 : 140;
          let siphonedCount = 0;
          for (const pkt of this.packets) {
            if (pkt.collected) continue;
            const dist = Math.hypot(pkt.x - runner.x, pkt.y - runner.y);
            if (dist <= siphonRadius) {
              pkt.collected = true;
              siphonedCount++;
              const pts = (isSuddenDeath ? pkt.value * 2 : pkt.value);
              runner.score += pts;
              this.particles.emit(pkt.x, pkt.y, 15, '#10B981');
            }
          }

          if (siphonedCount > 0) {
            this.audio.playBounce();
            this.triggerAnnouncement(`${this.getPlayer(runner.id)?.name || 'RUNNER'} EMP SIPHON (+${siphonedCount} PKTS)!`, 1.4);
          } else {
            this.triggerAnnouncement(`${this.getPlayer(runner.id)?.name || 'RUNNER'} ICE PHASE OVERDRIVE!`, 1.2);
          }

          // EMP Shock nearby rivals
          for (const other of this.netrunners.values()) {
            if (other.id === runner.id) continue;
            const dist = Math.hypot(other.x - runner.x, other.y - runner.y);
            if (dist <= 110 && other.phaseTimer <= 0) {
              other.stunTimer = 0.7;
              other.mood = 'shocked';
              const pushAng = Math.atan2(other.y - runner.y, other.x - runner.x);
              other.vx += Math.cos(pushAng) * 280;
              other.vy += Math.sin(pushAng) * 280;
              this.particles.emit(other.x, other.y, 16, '#EF4444');
            }
          }
        } else {
          // Standard minor burst
          runner.vx += Math.cos(runner.angle) * 160;
          runner.vy += Math.sin(runner.angle) * 160;
          this.audio.playTap();
        }

        runner.chargeTime = 0;
        runner.isCharging = false;
      } else {
        runner.mood = 'idle';
      }

      // Check packet pickup
      const pickupRadius = runner.isOverclocked ? 38 : 28;
      for (const pkt of this.packets) {
        if (pkt.collected) continue;
        const dist = Math.hypot(pkt.x - runner.x, pkt.y - runner.y);
        if (dist <= pickupRadius + pkt.radius) {
          pkt.collected = true;
          runner.streakCount++;
          runner.streakTimer = 2.5;

          let multiplier = 1.0;
          if (runner.streakCount >= 4) multiplier = 2.5;
          else if (runner.streakCount >= 3) multiplier = 2.0;
          else if (runner.streakCount >= 2) multiplier = 1.5;

          const pts = Math.round((isSuddenDeath ? pkt.value * 2 : pkt.value) * multiplier);
          runner.score += pts;

          this.audio.playTap();
          this.particles.emit(pkt.x, pkt.y, 18, pkt.type === 'quantum_key' ? '#F59E0B' : (pkt.type === 'memory_core' ? '#A855F7' : '#10B981'));

          if (pkt.type === 'quantum_key') {
            this.audio.playScore();
            this.triggerAnnouncement(`QUANTUM KEY CRACKED! +${pts} PTS!`, 1.5);
          }
        }
      }

      // Check collision with rotating ICE firewall beams
      if (runner.phaseTimer <= 0) {
        for (const beam of this.beams) {
          // Point-to-segment distance check
          const bStartX = cx + Math.cos(beam.angle) * beam.innerRadius;
          const bStartY = cy + Math.sin(beam.angle) * beam.innerRadius;
          const bEndX = cx + Math.cos(beam.angle) * beam.length;
          const bEndY = cy + Math.sin(beam.angle) * beam.length;

          const distToBeam = this.distToSegment(runner.x, runner.y, bStartX, bStartY, bEndX, bEndY);
          if (distToBeam < 20) {
            // Hit by ICE firewall!
            runner.stunTimer = 0.85;
            runner.overheatTimer = 0.4;
            runner.score = Math.max(0, runner.score - 10);
            this.audio.playExplosion();
            this.screenShake = 10;

            // Shove outward
            const outAng = Math.atan2(runner.y - cy, runner.x - cx);
            runner.vx = Math.cos(outAng) * 260;
            runner.vy = Math.sin(outAng) * 260;

            this.particles.emit(runner.x, runner.y, 25, '#EF4444');
            this.triggerAnnouncement(`${this.getPlayer(runner.id)?.name || 'RUNNER'} ICE SHOCKED! (-10 PTS)`, 1.2);
            break;
          }
        }
      }
    }

    // Netrunner-to-Netrunner Physical Collision & ICE Shunting
    const runnerArr = Array.from(this.netrunners.values());
    for (let i = 0; i < runnerArr.length; i++) {
      for (let j = i + 1; j < runnerArr.length; j++) {
        const r1 = runnerArr[i];
        const r2 = runnerArr[j];

        const dx = r2.x - r1.x;
        const dy = r2.y - r1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 42;

        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Push apart
          const overlap = minDist - dist;
          r1.x -= nx * overlap * 0.5;
          r1.y -= ny * overlap * 0.5;
          r2.x += nx * overlap * 0.5;
          r2.y += ny * overlap * 0.5;

          // Relative velocity
          const rvx = r2.vx - r1.vx;
          const rvy = r2.vy - r1.vy;
          const velAlongNorm = rvx * nx + rvy * ny;

          if (velAlongNorm < 0) {
            const restitution = 1.45;
            const impulse = -(1 + restitution) * velAlongNorm * 0.5;

            r1.vx -= nx * impulse;
            r1.vy -= ny * impulse;
            r2.vx += nx * impulse;
            r2.vy += ny * impulse;

            this.audio.playBounce();

            // Determine if this was an aggressive ICE shunt
            const speed1 = Math.hypot(r1.vx, r1.vy);
            const speed2 = Math.hypot(r2.vx, r2.vy);

            if (speed1 > speed2 + 80 || r1.phaseTimer > 0) {
              r1.sabotageCount++;
              r1.score += 30; // ICE Shunt sabotage bonus
              r2.stunTimer = 0.7;
              r2.score = Math.max(0, r2.score - 10);
              this.particles.emit(r2.x, r2.y, 20, '#F59E0B');
              this.triggerAnnouncement(`${this.getPlayer(r1.id)?.name || 'P1'} ICE-SHUNTED ${this.getPlayer(r2.id)?.name || 'P2'}! (+30 PTS)`, 1.5);
            } else if (speed2 > speed1 + 80 || r2.phaseTimer > 0) {
              r2.sabotageCount++;
              r2.score += 30;
              r1.stunTimer = 0.7;
              r1.score = Math.max(0, r1.score - 10);
              this.particles.emit(r1.x, r1.y, 20, '#F59E0B');
              this.triggerAnnouncement(`${this.getPlayer(r2.id)?.name || 'P2'} ICE-SHUNTED ${this.getPlayer(r1.id)?.name || 'P1'}! (+30 PTS)`, 1.5);
            }
          }
        }
      }
    }

    // Clean up collected packets
    this.packets = this.packets.filter(p => !p.collected);
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  protected updateBotAI(dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const runner = this.netrunners.get(botId);
    if (!runner || runner.stunTimer > 0 || runner.overheatTimer > 0) return;

    let reactionTimer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (reactionTimer <= 0) {
      const delay = difficulty === 'bot_hard' ? 0.10 : (difficulty === 'bot_normal' ? 0.23 : 0.42);
      reactionTimer = delay + Math.random() * 0.05;
      this.botReactionTimers.set(botId, reactionTimer);

      const cx = width / 2;
      const cy = height / 2;

      // Find best target packet
      let bestTarget: { x: number; y: number } | null = null;
      let highestValue = -1;

      for (const pkt of this.packets) {
        if (pkt.collected) continue;
        const dist = Math.hypot(pkt.x - runner.x, pkt.y - runner.y);
        let weight = (pkt.value * 2) - dist * 0.2;
        if (pkt.type === 'quantum_key') weight += 60;

        if (weight > highestValue) {
          highestValue = weight;
          bestTarget = { x: pkt.x, y: pkt.y };
        }
      }

      // Hard bots actively hunt rivals to ICE shunt them
      if (difficulty === 'bot_hard') {
        for (const other of this.netrunners.values()) {
          if (other.id === botId) continue;
          const distToOther = Math.hypot(other.x - runner.x, other.y - runner.y);
          if (distToOther < 130 && other.score > runner.score) {
            bestTarget = { x: other.x, y: other.y };
            break;
          }
        }
      }

      // Default wander if no packet
      if (!bestTarget) {
        bestTarget = { x: cx + (Math.random() - 0.5) * 200, y: cy + (Math.random() - 0.5) * 200 };
      }

      // Easy bots introduce intentional blunder
      if (difficulty === 'bot_easy' && Math.random() < 0.22) {
        bestTarget = { x: runner.x + (Math.random() - 0.5) * 150, y: runner.y + (Math.random() - 0.5) * 150 };
      }

      // Steering angle
      let targetAng = Math.atan2(bestTarget.y - runner.y, bestTarget.x - runner.x);

      // Avoid rotating ICE firewall beams if not phasing
      if (runner.phaseTimer <= 0) {
        for (const beam of this.beams) {
          const beamAngle = beam.angle % (Math.PI * 2);
          const currentAng = Math.atan2(runner.y - cy, runner.x - cx);
          const angleDiff = Math.abs(((beamAngle - currentAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI);

          if (angleDiff < 0.35) {
            // Dodge tangent to the beam
            targetAng += beam.speed > 0 ? 0.9 : -0.9;
            break;
          }
        }
      }

      const steerX = Math.cos(targetAng);
      const throttleY = -Math.sin(targetAng);

      // Action button charge logic
      let shouldAction = false;
      const targetDist = Math.hypot(bestTarget.x - runner.x, bestTarget.y - runner.y);

      if (difficulty === 'bot_hard') {
        if (!runner.isCharging && targetDist > 80 && Math.random() < 0.7) {
          shouldAction = true;
        } else if (runner.isCharging) {
          const sweetSpotMin = runner.isOverclocked ? 0.50 : 0.72;
          const sweetSpotMax = runner.isOverclocked ? 1.05 : 0.98;
          const chargeRatio = runner.chargeTime / 1.0;
          if (chargeRatio >= sweetSpotMin && chargeRatio <= sweetSpotMax) {
            shouldAction = false; // Release for sweet spot!
          } else {
            shouldAction = true; // Keep charging
          }
        }
      } else if (difficulty === 'bot_normal') {
        if (!runner.isCharging && Math.random() < 0.3) {
          shouldAction = true;
        } else if (runner.isCharging && runner.chargeTime > 0.8) {
          shouldAction = false;
        } else if (runner.isCharging) {
          shouldAction = true;
        }
      }

      this.input.setBotInput(botId, shouldAction, steerX, throttleY);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // Screen Shake
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    const theme = THEMES[this.currentThemeIndex];
    const cx = width / 2;
    const cy = height / 2;
    const arenaRadius = Math.min(width, height) * 0.45;

    // Background Gradient
    const bgGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, Math.max(width, height) * 0.75);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Cyber Arena Floor Circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = theme.floorColor;
    ctx.fillRect(cx - arenaRadius, cy - arenaRadius, arenaRadius * 2, arenaRadius * 2);

    // Floor Grid / Circuit Traces
    ctx.strokeStyle = theme.gridLineColor;
    ctx.lineWidth = 1.5;
    const gridSize = 40;
    for (let x = cx - arenaRadius; x <= cx + arenaRadius; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, cy - arenaRadius);
      ctx.lineTo(x, cy + arenaRadius);
      ctx.stroke();
    }
    for (let y = cy - arenaRadius; y <= cy + arenaRadius; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(cx - arenaRadius, y);
      ctx.lineTo(cx + arenaRadius, y);
      ctx.stroke();
    }

    // Concentric Cyber Circuit Rings
    for (let r = 90; r < arenaRadius; r += 70) {
      ctx.strokeStyle = theme.circuitColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore(); // End arena clip

    // Arena Outer Perimeter Warning Ring
    ctx.strokeStyle = theme.beamGlow;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 12]);
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Central Supercomputer Core
    const coreGlowGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, 80);
    coreGlowGrad.addColorStop(0, theme.coreGlow);
    coreGlowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = coreGlowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 80, 0, Math.PI * 2);
    ctx.fill();

    // Central Core Pillar
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(cx, cy, 55, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.coreColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Pulsing Core Glyph / Hexagon
    const pulseScale = 1.0 + Math.sin(Date.now() * 0.005) * 0.08;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulseScale, pulseScale);
    ctx.fillStyle = theme.coreColor;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡CORE⚡', 0, 0);
    ctx.restore();

    // Draw Rotating ICE Firewall Beams
    for (const beam of this.beams) {
      const bStartX = cx + Math.cos(beam.angle) * beam.innerRadius;
      const bStartY = cy + Math.sin(beam.angle) * beam.innerRadius;
      const bEndX = cx + Math.cos(beam.angle) * beam.length;
      const bEndY = cy + Math.sin(beam.angle) * beam.length;

      // Glow line
      ctx.strokeStyle = theme.beamGlow;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(bStartX, bStartY);
      ctx.lineTo(bEndX, bEndY);
      ctx.stroke();

      // Sharp Core Beam
      ctx.strokeStyle = theme.beamColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(bStartX, bStartY);
      ctx.lineTo(bEndX, bEndY);
      ctx.stroke();

      // Rotating Beam Emitter Emitters
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(bEndX, bEndY, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render Data Packets
    for (const pkt of this.packets) {
      if (pkt.collected) continue;

      ctx.save();
      ctx.translate(pkt.x, pkt.y);

      const bobY = Math.sin(pkt.pulsePhase) * 4;
      ctx.translate(0, bobY);

      // Packet Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 16 - bobY, pkt.radius * 0.9, pkt.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      if (pkt.type === 'quantum_key') {
        // Golden Quantum Key
        ctx.fillStyle = '#F59E0B';
        ctx.shadowColor = '#FBBF24';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + pkt.pulsePhase * 0.8;
          const r = pkt.radius;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('75', 0, 0);
      } else if (pkt.type === 'memory_core') {
        // Purple Memory Cube
        ctx.fillStyle = '#A855F7';
        ctx.shadowColor = '#C084FC';
        ctx.shadowBlur = 12;
        ctx.fillRect(-pkt.radius * 0.7, -pkt.radius * 0.7, pkt.radius * 1.4, pkt.radius * 1.4);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-pkt.radius * 0.7, -pkt.radius * 0.7, pkt.radius * 1.4, pkt.radius * 1.4);

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('45', 0, 0);
      } else {
        // Cyan Data Shard
        ctx.fillStyle = '#06B6D4';
        ctx.shadowColor = '#22D3EE';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, -pkt.radius);
        ctx.lineTo(pkt.radius * 0.8, 0);
        ctx.lineTo(0, pkt.radius);
        ctx.lineTo(-pkt.radius * 0.8, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('20', 0, 0);
      }

      ctx.restore();
    }

    // Render Netrunners
    for (const runner of this.netrunners.values()) {
      const pConfig = this.getPlayer(runner.id);
      const isBot = pConfig ? pConfig.type !== 'human' : false;

      ctx.save();
      ctx.translate(runner.x, runner.y);

      // Character Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 18, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Underdog Aura
      if (runner.isOverclocked) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 30 + Math.sin(Date.now() * 0.01) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // ICE Phasing Shield Aura
      if (runner.phaseTimer > 0) {
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Mascot Character
      drawCharacter(
        ctx,
        0,
        0,
        18,
        runner.id,
        isBot,
        runner.mood,
        runner.animTimer
      );

      // Draw Cyber Visor Line
      ctx.save();
      ctx.rotate(runner.angle);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, -4);
      ctx.lineTo(16, 0);
      ctx.lineTo(8, 4);
      ctx.stroke();
      ctx.restore();

      // Hold-to-Charge Buffer Indicator
      if (runner.isCharging) {
        const chargeRatio = Math.min(1.0, runner.chargeTime / 1.0);
        const sweetSpotMin = runner.isOverclocked ? 0.50 : 0.72;
        const sweetSpotMax = runner.isOverclocked ? 1.05 : 0.98;

        // Outer charge track
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.stroke();

        // Sweet spot sector
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, 32, sweetSpotMin * Math.PI * 2 - Math.PI / 2, sweetSpotMax * Math.PI * 2 - Math.PI / 2);
        ctx.stroke();

        // Current progress arc
        const isSweet = chargeRatio >= sweetSpotMin && chargeRatio <= sweetSpotMax;
        ctx.strokeStyle = isSweet ? '#F59E0B' : '#38BDF8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 32, -Math.PI / 2, chargeRatio * Math.PI * 2 - Math.PI / 2);
        ctx.stroke();

        // Charge Text
        ctx.fillStyle = isSweet ? '#F59E0B' : '#FFFFFF';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(isSweet ? 'SWEET SPOT!' : 'BUFFERING...', 0, -38);
      }

      // Status text (Stunned / Overheated)
      if (runner.overheatTimer > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ICE REBOOT', 0, 34);
      } else if (runner.stunTimer > 0) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('EMP STUNNED', 0, 34);
      }

      ctx.restore();
    }

    // Top Global Timer Safe Zone: y: 12-44, x: width/2 - 80 to width/2 + 80
    // Render Minigame Header Badge at y: 56, h: 28
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    const badgeW = 380;
    const badgeH = 26;
    ctx.beginPath();
    ctx.roundRect(cx - badgeW / 2, 56, badgeW, badgeH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HACK THE TERMINAL // MAINFRAME ICE CRACK', cx, 56 + badgeH / 2);
    ctx.restore();

    // Central Announcement Banner
    if (this.announcementTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2;
      const bW = Math.min(width - 40, 480);
      const bH = 34;
      ctx.beginPath();
      ctx.roundRect(cx - bW / 2, height * 0.28, bW, bH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FCD34D';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.announcementText, cx, height * 0.28 + bH / 2);
      ctx.restore();
    }

    // Sudden Death Pulsing Banner
    if (this.roundTimer <= 12.0) {
      ctx.save();
      const pulseSD = Math.sin(Date.now() * 0.008) > 0;
      ctx.fillStyle = pulseSD ? '#EF4444' : '#F97316';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ MAINFRAME MELTDOWN: DOUBLE SCORES! ⚡', cx, 98);
      ctx.restore();
    }

    // Bottom-Left Theme Pill: x: 20, y: height - 44, w: 170, h: 32
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name} [T]`, 30, height - 28);
    ctx.restore();

    // Corner Player Score Cards: y: height - 128 (130x48px)
    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const runner = this.netrunners.get(p.id);
      if (!runner) continue;

      let cardX = 20;
      if (i === 1) cardX = width - 150;
      else if (i === 2) cardX = 160;
      else if (i === 3) cardX = width - 290;

      const cardY = height - 128;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = runner.isOverclocked ? '#F59E0B' : p.color;
      ctx.lineWidth = runner.isOverclocked ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 130, 48, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 10, cardY + 16);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`${runner.score} PTS`, cardX + 10, cardY + 36);

      if (runner.streakCount > 1) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${runner.streakCount}x`, cardX + 120, cardY + 36);
      }

      ctx.restore();
    }

    ctx.restore(); // End canvas save
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.netrunners.get(p.id)?.score || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    const winnerRunner = winnerId ? this.netrunners.get(winnerId) : null;
    let highlight = 'Mainframe ICE firewall locked all netrunners out!';
    if (winnerId && winnerRunner) {
      const pName = this.getPlayer(winnerId)?.name || 'Netrunner';
      if (winnerRunner.sabotageCount >= 2) {
        highlight = `${pName} sabotaged rivals with brutal ICE-shunts and cracked the mainframe!`;
      } else {
        highlight = `${pName} cracked the mainframe core with ${winnerRunner.score} decryption points!`;
      }
    }

    return {
      winnerId,
      rankings,
      mvpHighlight: highlight
    };
  }

  public override destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownHandler) {
        window.removeEventListener('keydown', this.keydownHandler);
      }
      if (this.clickHandler) {
        window.removeEventListener('click', this.clickHandler);
      }
    }
    super.destroy();
  }
}
