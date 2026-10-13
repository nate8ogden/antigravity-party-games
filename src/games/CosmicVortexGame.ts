import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export interface VortexTheme {
  name: string;
  bgGradInner: string;
  bgGradMid: string;
  bgGradOuter: string;
  starColor: string;
  armColor1: string;
  armColor2: string;
  armColor3: string;
  holeBorder: string;
  photonRing: string;
  singularityCore: string;
  themePillColor: string;
}

export const VORTEX_THEMES: VortexTheme[] = [
  {
    name: 'Deep Singularity 🌌',
    bgGradInner: '#020617',
    bgGradMid: '#0B0F19',
    bgGradOuter: '#020617',
    starColor: 'rgba(255, 255, 255, 0.28)',
    armColor1: 'rgba(168, 85, 247, 0.55)',
    armColor2: 'rgba(56, 189, 248, 0.35)',
    armColor3: 'rgba(236, 72, 153, 0.15)',
    holeBorder: '#818CF8',
    photonRing: '#F472B6',
    singularityCore: '#C084FC',
    themePillColor: '#A855F7'
  },
  {
    name: 'Solar Flare Vortex ☀️',
    bgGradInner: '#1A0700',
    bgGradMid: '#2D0F04',
    bgGradOuter: '#0F0300',
    starColor: 'rgba(254, 240, 138, 0.32)',
    armColor1: 'rgba(249, 115, 22, 0.60)',
    armColor2: 'rgba(234, 179, 8, 0.40)',
    armColor3: 'rgba(239, 68, 68, 0.20)',
    holeBorder: '#FB923C',
    photonRing: '#FACC15',
    singularityCore: '#F97316',
    themePillColor: '#F97316'
  },
  {
    name: 'Quantum Rift ⚡',
    bgGradInner: '#021814',
    bgGradMid: '#062B28',
    bgGradOuter: '#010E0C',
    starColor: 'rgba(167, 243, 208, 0.32)',
    armColor1: 'rgba(16, 185, 129, 0.55)',
    armColor2: 'rgba(6, 182, 212, 0.40)',
    armColor3: 'rgba(52, 211, 153, 0.18)',
    holeBorder: '#10B981',
    photonRing: '#34D399',
    singularityCore: '#06B6D4',
    themePillColor: '#10B981'
  }
];

interface VortexPlayer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  alive: boolean;
  respawnTimer: number;
  pulseCooldown: number;
  pulseActiveTimer: number;
  lastDamagedBy: PlayerId | null;
  lastDamagedTimer: number;
  isUnderdog: boolean;
}

interface AntimatterOrb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;
  isGolden: boolean;
  value: number;
}

export class CosmicVortexGame extends BaseGame {
  private playersState: Map<PlayerId, VortexPlayer> = new Map();
  private orbs: AntimatterOrb[] = [];
  private vortexAngle: number = 0;
  private vortexPulse: number = 0;
  private nextOrbSpawnTimer: number = 1.0;

  private lastWidth: number = 800;
  private lastHeight: number = 600;

  // Themes
  private currentThemeIndex: number = 0;

  // Sudden Death State
  private isSuddenDeath: boolean = false;
  private suddenDeathFlashTimer: number = 0;

  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.currentThemeIndex = Math.floor(Math.random() * VORTEX_THEMES.length);
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.roundTimer = 45;
    this.isFinished = false;
    this.isSuddenDeath = false;
    this.suddenDeathFlashTimer = 0;
    this.playersState.clear();
    this.orbs = [];
    this.vortexAngle = 0;
    this.vortexPulse = 0;
    this.nextOrbSpawnTimer = 1.0;

    const cx = width / 2;
    const cy = height / 2;
    const active = this.getActivePlayers();
    const spawnRadius = Math.min(width, height) * 0.38;

    active.forEach((p, idx) => {
      const angle = (idx / active.length) * Math.PI * 2;
      const px = cx + Math.cos(angle) * spawnRadius;
      const py = cy + Math.sin(angle) * spawnRadius;
      // Tangential orbital velocity
      const orbitSpeed = 110;
      const vx = -Math.sin(angle) * orbitSpeed;
      const vy = Math.cos(angle) * orbitSpeed;

      this.playersState.set(p.id, {
        x: px,
        y: py,
        vx,
        vy,
        angle: angle + Math.PI / 2,
        score: 0,
        alive: true,
        respawnTimer: 0,
        pulseCooldown: 0,
        pulseActiveTimer: 0,
        lastDamagedBy: null,
        lastDamagedTimer: 0,
        isUnderdog: false
      });
    });

    // Spawn initial field of 7 cosmic bubbles
    for (let i = 0; i < 7; i++) {
      this.spawnOrb(width, height);
    }

    // Bind listeners
    const canvas = this.input.getCanvas();
    if (canvas && !this.boundPointerDown) {
      this.boundPointerDown = this.handlePointerDown.bind(this);
      canvas.addEventListener('pointerdown', this.boundPointerDown);
    }
    if (!this.boundKeyDown) {
      this.boundKeyDown = this.handleKeyDown.bind(this);
      window.addEventListener('keydown', this.boundKeyDown);
    }

    // Expose debug hook for testing
    (window as any).__COSMIC_VORTEX_DEBUG__ = {
      getOrbs: () => this.orbs.map((o) => ({ x: o.x, y: o.y, vx: o.vx, vy: o.vy, radius: o.radius, hue: o.hue, isGolden: o.isGolden, value: o.value })),
      getOrbCount: () => this.orbs.length,
      getPlayerState: (pid: PlayerId) => {
        const ps = this.playersState.get(pid);
        return ps ? { ...ps } : null;
      },
      setPlayerPos: (pid: PlayerId, x: number, y: number, vx = 0, vy = 0, angle = 0) => {
        const ps = this.playersState.get(pid);
        if (ps) {
          ps.x = x;
          ps.y = y;
          ps.vx = vx;
          ps.vy = vy;
          ps.angle = angle;
        }
      },
      spawnOrb: () => this.spawnOrb(this.lastWidth, this.lastHeight),
      getThemeIndex: () => this.currentThemeIndex,
      setThemeIndex: (idx: number) => {
        this.currentThemeIndex = idx % VORTEX_THEMES.length;
      }
    };
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 't' || e.key === 'T') {
      this.toggleTheme();
    }
  }

  private toggleTheme(): void {
    this.currentThemeIndex = (this.currentThemeIndex + 1) % VORTEX_THEMES.length;
    this.audio.playTap();
  }

  private handlePointerDown(e: PointerEvent): void {
    const canvas = this.input.getCanvas();
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * this.lastWidth;
    const clickY = ((e.clientY - rect.top) / rect.height) * this.lastHeight;

    // Check Theme Pill click: [T] Theme Pill at (20, height - 44, 170, 32)
    if (
      clickX >= 20 &&
      clickX <= 190 &&
      clickY >= this.lastHeight - 44 &&
      clickY <= this.lastHeight - 12
    ) {
      this.toggleTheme();
    }
  }

  public override destroy(): void {
    if (this.boundPointerDown) {
      const canvas = this.input.getCanvas();
      if (canvas) {
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
      }
      this.boundPointerDown = null;
    }
    if (this.boundKeyDown) {
      window.removeEventListener('keydown', this.boundKeyDown);
      this.boundKeyDown = null;
    }
  }

  private spawnOrb(width: number, height: number, forceGolden: boolean = false) {
    const cx = width / 2;
    const cy = height / 2;
    const minR = 95;
    const maxR = Math.min(width, height) * 0.40;
    const r = minR + Math.random() * (maxR - minR);
    const angle = Math.random() * Math.PI * 2;
    const speed = 65 + Math.random() * 45;
    const radialDrift = (Math.random() - 0.5) * 20;

    const isGolden = forceGolden || (this.isSuddenDeath && Math.random() < 0.45);
    const hues = [180, 310, 45, 140, 270];
    const hue = isGolden ? 45 : hues[Math.floor(Math.random() * hues.length)];

    this.orbs.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      vx: -Math.sin(angle) * speed + Math.cos(angle) * radialDrift,
      vy: Math.cos(angle) * speed + Math.sin(angle) * radialDrift,
      radius: isGolden ? 12 : 9,
      hue,
      isGolden,
      value: isGolden ? 2 : 1
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastWidth = width;
    this.lastHeight = height;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    // Sudden death threshold (<= 15 seconds remaining)
    if (this.roundTimer <= 15.0 && !this.isSuddenDeath) {
      this.isSuddenDeath = true;
      this.audio.playBoost();
      this.particles.shake(6);
      // Spawn golden orbs immediately
      this.spawnOrb(width, height, true);
      this.spawnOrb(width, height, true);
    }

    if (this.isSuddenDeath) {
      this.suddenDeathFlashTimer += dt;
    }

    this.vortexAngle += dt * (this.isSuddenDeath ? 2.5 : 1.8);
    this.vortexPulse = Math.sin(this.vortexAngle * 2.5) * 0.5 + 0.5;

    const cx = width / 2;
    const cy = height / 2;
    const eventHorizonR = this.isSuddenDeath ? 58 : 48;

    // Underdog calculation
    let maxScore = -1;
    for (const ps of this.playersState.values()) {
      if (ps.score > maxScore) maxScore = ps.score;
    }
    for (const ps of this.playersState.values()) {
      ps.isUnderdog = maxScore >= 2 && ps.score <= maxScore - 2;
    }

    // Continuous bubble replenishment
    const MAX_ORBS = this.isSuddenDeath ? 11 : 9;
    const MIN_ORBS = this.isSuddenDeath ? 7 : 6;
    this.nextOrbSpawnTimer -= dt;

    if (this.orbs.length < MIN_ORBS) {
      this.spawnOrb(width, height);
      this.nextOrbSpawnTimer = 0.4;
    } else if (this.nextOrbSpawnTimer <= 0 && this.orbs.length < MAX_ORBS) {
      this.spawnOrb(width, height);
      this.nextOrbSpawnTimer = 1.0 + Math.random() * 0.6;
    }

    // Update bubbles with gravity, containment, and boundary reflections
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      const dx = cx - orb.x;
      const dy = cy - orb.y;
      const dist = Math.hypot(dx, dy);

      // Event horizon consumption with sparkling implosion
      if (dist < eventHorizonR + 5) {
        this.particles.spawnSparks(orb.x, orb.y, orb.isGolden ? '#FBBF24' : (orb.hue === 180 ? '#38BDF8' : '#F472B6'), 8);
        this.orbs.splice(i, 1);
        continue;
      }

      // Despawn if drifted far outside arena bounds
      if (dist > Math.max(width, height) * 0.68) {
        this.orbs.splice(i, 1);
        continue;
      }

      // Gravitational acceleration
      const safeDist = Math.max(1, dist);
      const gravity = (this.isSuddenDeath ? 65000 : 45000) / (safeDist * safeDist + 2000) + 15;
      orb.vx += (dx / safeDist) * gravity * dt;
      orb.vy += (dy / safeDist) * gravity * dt;

      orb.vx *= Math.pow(0.99, dt * 60);
      orb.vy *= Math.pow(0.99, dt * 60);

      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;

      // Arena boundary bounce for bubbles
      const orbMargin = 22;
      if (orb.x < orbMargin) {
        orb.x = orbMargin;
        orb.vx = Math.abs(orb.vx) * 0.85 + 20;
      } else if (orb.x > width - orbMargin) {
        orb.x = width - orbMargin;
        orb.vx = -Math.abs(orb.vx) * 0.85 - 20;
      }
      if (orb.y < orbMargin) {
        orb.y = orbMargin;
        orb.vy = Math.abs(orb.vy) * 0.85 + 20;
      } else if (orb.y > height - orbMargin) {
        orb.y = height - orbMargin;
        orb.vy = -Math.abs(orb.vy) * 0.85 - 20;
      }
    }

    // Process Bot Inputs
    this.updateBots(dt, width, height);

    // Update Players
    const active = this.getActivePlayers();
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.lastDamagedTimer > 0) {
        ps.lastDamagedTimer -= dt;
        if (ps.lastDamagedTimer <= 0) ps.lastDamagedBy = null;
      }

      if (!ps.alive) {
        ps.respawnTimer -= dt;
        if (ps.respawnTimer <= 0) {
          ps.alive = true;
          const spawnR = Math.min(width, height) * 0.38;
          const angle = Math.random() * Math.PI * 2;
          ps.x = cx + Math.cos(angle) * spawnR;
          ps.y = cy + Math.sin(angle) * spawnR;
          ps.vx = -Math.sin(angle) * 100;
          ps.vy = Math.cos(angle) * 100;
          ps.angle = angle + Math.PI / 2;
          this.audio.playTap();
        }
        continue;
      }

      if (ps.pulseCooldown > 0) ps.pulseCooldown -= dt;
      if (ps.pulseActiveTimer > 0) ps.pulseActiveTimer -= dt;

      // Handle Inputs
      const steer = this.input.getSteer(p.id);
      const thrust = this.input.isPressed(p.id);

      if (steer !== 0) {
        ps.angle += steer * 4.2 * dt;
      } else {
        const rotSpeed = thrust ? 2.6 : 3.6;
        ps.angle += rotSpeed * dt;
      }

      if (thrust) {
        const thrustPower = ps.isUnderdog ? 425 : 340; // Underdog +25% thrust power
        ps.vx += Math.cos(ps.angle) * thrustPower * dt;
        ps.vy += Math.sin(ps.angle) * thrustPower * dt;

        if (Math.random() < 0.4) {
          const flameX = ps.x - Math.cos(ps.angle) * 14;
          const flameY = ps.y - Math.sin(ps.angle) * 14;
          this.particles.spawnSparks(flameX, flameY, ps.isUnderdog ? '#F59E0B' : p.colorLight, 1);
        }
      }

      // Check Pulse Blast Trigger (Triggered when tapping)
      const justTapped = this.input.justPressed(p.id);
      if (justTapped && ps.pulseCooldown <= 0) {
        // Underdog pulse cooldown is halved (1.1s vs 2.2s)
        ps.pulseCooldown = ps.isUnderdog ? 1.1 : 2.2;
        ps.pulseActiveTimer = 0.25;
        this.audio.playLaser();
        this.particles.shake(0.35);

        // Repulse all opponents within blast range
        const blastRange = ps.isUnderdog ? 155 : 135;
        for (const other of active) {
          if (other.id === p.id) continue;
          const os = this.playersState.get(other.id);
          if (!os || !os.alive) continue;

          const odx = os.x - ps.x;
          const ody = os.y - ps.y;
          const odist = Math.hypot(odx, ody);
          if (odist < blastRange && odist > 0.1) {
            const push = (1 - odist / blastRange) * 480;
            os.vx += (odx / odist) * push;
            os.vy += (ody / odist) * push;
            os.lastDamagedBy = p.id;
            os.lastDamagedTimer = 2.5; // Record credit for singularity slam
            this.audio.playBounce();
            this.particles.spawnSparks(os.x, os.y, '#FFFFFF', 6);
          }
        }
      }

      // Gravitational pull toward event horizon
      const dx = cx - ps.x;
      const dy = cy - ps.y;
      const dist = Math.hypot(dx, dy);

      const safeDist = Math.max(1, dist);
      // Underdog receives 40% reduced gravitational pull
      const gravityMult = (ps.isUnderdog ? 0.60 : 1.0) * (this.isSuddenDeath ? 1.35 : 1.0);
      const gravity = (62000 / (safeDist * safeDist + 1800) + 25) * gravityMult;
      ps.vx += (dx / safeDist) * gravity * dt;
      ps.vy += (dy / safeDist) * gravity * dt;

      // Friction / Drag in space
      ps.vx *= Math.pow(0.96, dt * 60);
      ps.vy *= Math.pow(0.96, dt * 60);

      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Critical gravity warning zone
      if (dist < 115) {
        this.particles.shake(0.06);
        if (Math.random() < 0.2) {
          this.particles.spawnSparks(ps.x, ps.y, '#EF4444', 1);
        }
      }

      // Event horizon consumption with relativistic spaghettification
      if (dist < eventHorizonR) {
        ps.alive = false;
        ps.respawnTimer = 2.0;
        ps.score = Math.max(0, ps.score - 1);
        this.audio.playExplosion();
        this.particles.shake(0.55);

        // Singularity Slam bounty check: If a rival shoved them within 2.5s, reward that rival!
        if (ps.lastDamagedBy !== null) {
          const killerState = this.playersState.get(ps.lastDamagedBy);
          if (killerState) {
            killerState.score += 2;
            this.audio.playScore();
            this.particles.spawnSparks(cx, cy, '#F59E0B', 20);
            if (killerState.score >= 5) {
              this.isFinished = true;
            }
          }
        }

        // Implosion ring particles
        this.particles.spawnExplosion(cx, cy, p.color, 28);
        continue;
      }

      // Arena boundary collision with firm inward deflection
      const margin = 32;
      let hitWall = false;
      if (ps.x < margin) {
        ps.x = margin;
        ps.vx = Math.max(Math.abs(ps.vx) * 0.75, 120);
        hitWall = true;
      } else if (ps.x > width - margin) {
        ps.x = width - margin;
        ps.vx = -Math.max(Math.abs(ps.vx) * 0.75, 120);
        hitWall = true;
      }
      if (ps.y < margin) {
        ps.y = margin;
        ps.vy = Math.max(Math.abs(ps.vy) * 0.75, 120);
        hitWall = true;
      } else if (ps.y > height - margin) {
        ps.y = height - margin;
        ps.vy = -Math.max(Math.abs(ps.vy) * 0.75, 120);
        hitWall = true;
      }

      if (hitWall) {
        this.particles.spawnSparks(ps.x, ps.y, p.colorLight, 2);
      }

      // Corner Anti-Trap Cushion
      const cornerPocket = 85;
      const inCornerX = ps.x < cornerPocket || ps.x > width - cornerPocket;
      const inCornerY = ps.y < cornerPocket || ps.y > height - cornerPocket;
      if (inCornerX && inCornerY) {
        const cornerDist = Math.hypot(cx - ps.x, cy - ps.y) || 1;
        const toCenterX = (cx - ps.x) / cornerDist;
        const toCenterY = (cy - ps.y) / cornerDist;
        const cornerPush = 280;
        ps.vx += toCenterX * cornerPush * dt;
        ps.vy += toCenterY * cornerPush * dt;

        const centerAngle = Math.atan2(cy - ps.y, cx - ps.x);
        let angleDiff = centerAngle - ps.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        ps.angle += angleDiff * Math.min(1.0, 5.0 * dt);
      }

      // Orb Collection
      for (let i = this.orbs.length - 1; i >= 0; i--) {
        const orb = this.orbs[i];
        if (Math.hypot(ps.x - orb.x, ps.y - orb.y) < 22) {
          const val = orb.value;
          this.orbs.splice(i, 1);
          ps.score += val;
          this.audio.playTone(740, 0.08, 'sine');
          setTimeout(() => this.audio.playTone(1100, 0.12, 'triangle'), 60);

          this.particles.spawnSparks(orb.x, orb.y, orb.isGolden ? '#FBBF24' : '#38BDF8', 14);

          if (ps.score >= 5) {
            this.isFinished = true;
          }
        }
      }
    }

    // Player-to-Player Elastic Collision
    const activeList = active
      .map((p) => ({ cfg: p, state: this.playersState.get(p.id)! }))
      .filter((item) => item.state && item.state.alive);

    for (let i = 0; i < activeList.length; i++) {
      for (let j = i + 1; j < activeList.length; j++) {
        const p1 = activeList[i].state;
        const p2 = activeList[j].state;
        const pdx = p2.x - p1.x;
        const pdy = p2.y - p1.y;
        const pdist = Math.hypot(pdx, pdy);
        const minDist = 30;

        if (pdist < minDist && pdist > 0.01) {
          const overlap = minDist - pdist;
          const nx = pdx / pdist;
          const ny = pdy / pdist;

          p1.x -= nx * (overlap * 0.5);
          p1.y -= ny * (overlap * 0.5);
          p2.x += nx * (overlap * 0.5);
          p2.y += ny * (overlap * 0.5);

          const rvx = p2.vx - p1.vx;
          const rvy = p2.vy - p1.vy;
          const velAlongNormal = rvx * nx + rvy * ny;

          if (velAlongNormal < 0) {
            const impulse = -(1 + 0.9) * velAlongNormal;
            p1.vx -= nx * (impulse * 0.5);
            p1.vy -= ny * (impulse * 0.5);
            p2.vx += nx * (impulse * 0.5);
            p2.vy += ny * (impulse * 0.5);

            this.audio.playBounce();
            this.particles.spawnSparks((p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5, '#FFFFFF', 4);
          }
        }
      }
    }
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || !ps.alive) return;

    const cx = width / 2;
    const cy = height / 2;
    const dx = cx - ps.x;
    const dy = cy - ps.y;
    const dist = Math.hypot(dx, dy);

    // Corner & Wall Avoidance
    const wallMargin = 80;
    const cornerMargin = 110;
    const nearLeft = ps.x < wallMargin;
    const nearRight = ps.x > width - wallMargin;
    const nearTop = ps.y < wallMargin;
    const nearBottom = ps.y > height - wallMargin;
    const inCorner = (nearLeft || nearRight) && (nearTop || nearBottom) || (ps.x < cornerMargin && ps.y < cornerMargin);

    if (inCorner || nearLeft || nearRight || nearTop || nearBottom) {
      ps.angle = Math.atan2(cy - ps.y, cx - ps.x);
      this.input.setBotPressed(botId, true);
      return;
    }

    // Find nearest safe orb
    let bestOrb: AntimatterOrb | null = null;
    let bestDist = Infinity;
    for (const orb of this.orbs) {
      const d = Math.hypot(orb.x - ps.x, orb.y - ps.y);
      const orbDistFromCenter = Math.hypot(cx - orb.x, cy - orb.y);
      if (orbDistFromCenter < 72) continue;
      // Prioritize golden orbs!
      const effectiveDist = orb.isGolden ? d * 0.6 : d;
      if (effectiveDist < bestDist) {
        bestDist = effectiveDist;
        bestOrb = orb;
      }
    }

    if (difficulty === 'bot_easy') {
      // Slower reactions (350-450ms)
      if (dist < 130) {
        ps.angle = Math.atan2(-dy, -dx);
        this.input.setBotPressed(botId, true);
      } else if (bestOrb && bestDist < 180 && Math.random() < 0.6) {
        ps.angle = Math.atan2(bestOrb.y - ps.y, bestOrb.x - ps.x);
        this.input.setBotPressed(botId, true);
      } else if (Math.random() < 0.05 && ps.pulseCooldown <= 0) {
        this.input.setBotPressed(botId, true);
      } else {
        this.input.setBotPressed(botId, Math.random() < 0.4);
      }
    } else if (difficulty === 'bot_normal') {
      // 200-250ms human reactions
      if (dist < 150) {
        ps.angle = Math.atan2(-dy, -dx);
        this.input.setBotPressed(botId, true);
      } else if (bestOrb) {
        ps.angle = Math.atan2(bestOrb.y - ps.y, bestOrb.x - ps.x);
        this.input.setBotPressed(botId, true);
      } else {
        ps.angle = Math.atan2(dy, dx) + Math.PI / 2;
        this.input.setBotPressed(botId, true);
      }

      if (ps.pulseCooldown <= 0) {
        for (const [id, opp] of this.playersState.entries()) {
          if (id === botId || !opp.alive) continue;
          if (Math.hypot(opp.x - ps.x, opp.y - ps.y) < 100) {
            this.input.setBotPressed(botId, true);
            break;
          }
        }
      }
    } else {
      // Hard: tactical slingshot vectoring & aggressive pulse slams
      if (dist < 165) {
        ps.angle = Math.atan2(-dy, -dx) + 0.2;
        this.input.setBotPressed(botId, true);
      } else if (bestOrb && bestDist < 260) {
        ps.angle = Math.atan2(bestOrb.y - ps.y, bestOrb.x - ps.x);
        this.input.setBotPressed(botId, true);
      } else {
        let targetOpp: VortexPlayer | null = null;
        let oppDist = Infinity;
        for (const [id, opp] of this.playersState.entries()) {
          if (id === botId || !opp.alive) continue;
          const d = Math.hypot(opp.x - ps.x, opp.y - ps.y);
          if (d < oppDist) {
            oppDist = d;
            targetOpp = opp;
          }
        }

        if (targetOpp && oppDist < 125 && ps.pulseCooldown <= 0) {
          this.input.setBotPressed(botId, true);
        } else {
          ps.angle = Math.atan2(dy, dx) + Math.PI / 2;
          this.input.setBotPressed(botId, true);
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2;
    const theme = VORTEX_THEMES[this.currentThemeIndex];

    // Deep space gradient backdrop
    const bgGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(width, height) * 0.7);
    bgGrad.addColorStop(0, theme.bgGradInner);
    bgGrad.addColorStop(0.5, theme.bgGradMid);
    bgGrad.addColorStop(1, theme.bgGradOuter);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Distant star grid
    ctx.fillStyle = theme.starColor;
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 73) % width);
      const sy = ((i * 97) % height);
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // Accretion Disk Swirling Rays (Relativistic Multilayer Vortex)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.vortexAngle);

    for (let i = 0; i < 12; i++) {
      const armAngle = (i / 12) * Math.PI * 2;
      const diskGrad = ctx.createLinearGradient(0, 0, Math.cos(armAngle) * 240, Math.sin(armAngle) * 240);
      diskGrad.addColorStop(0, theme.armColor1);
      diskGrad.addColorStop(0.4, theme.armColor2);
      diskGrad.addColorStop(0.8, theme.armColor3);
      diskGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = diskGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 240, armAngle, armAngle + 0.32);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Central Event Horizon Black Hole
    const eventR = (this.isSuddenDeath ? 58 : 46) + this.vortexPulse * 4;
    ctx.save();
    ctx.shadowColor = this.isSuddenDeath ? '#EF4444' : theme.holeBorder;
    ctx.shadowBlur = this.isSuddenDeath ? 32 : 24;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(cx, cy, eventR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.isSuddenDeath ? '#EF4444' : theme.holeBorder;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();

    // Singularity Photon Ring
    ctx.save();
    ctx.strokeStyle = this.isSuddenDeath ? '#FBBF24' : theme.photonRing;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = this.isSuddenDeath ? '#FBBF24' : theme.photonRing;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(cx, cy, eventR - 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Center singularity warning core
    ctx.fillStyle = theme.singularityCore;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();

    // Gravitational Tether Lines for ships in danger
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps || !ps.alive) continue;
      const d = Math.hypot(cx - ps.x, cy - ps.y);
      if (d < 125) {
        ctx.save();
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 + (1 - d / 125) * 0.6})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(ps.x, ps.y);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Render Antimatter Orbs
    for (const orb of this.orbs) {
      ctx.save();
      const orbColor = orb.isGolden ? '#FBBF24' : (orb.hue === 180 ? '#38BDF8' : '#F472B6');
      ctx.shadowColor = orbColor;
      ctx.shadowBlur = orb.isGolden ? 20 : 14;
      ctx.fillStyle = orbColor;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      ctx.fill();

      // Specular shine
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(orb.x - 2.5, orb.y - 2.5, orb.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Golden orb aura ring
      if (orb.isGolden) {
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Render Players
    const active = this.getActivePlayers();
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      const isBot = p.type.startsWith('bot_');

      if (!ps.alive) {
        // Respawning Ghost Marker
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(width, height) * 0.40, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Underdog Graviton Shield Aura
      if (ps.isUnderdog) {
        ctx.save();
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Pulse Blast Shockwave Ring
      if (ps.pulseActiveTimer > 0) {
        ctx.save();
        ctx.strokeStyle = p.colorLight;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, (1 - ps.pulseActiveTimer / 0.25) * 135, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Repulsor Cooldown Ring around Ship
      ctx.save();
      if (ps.pulseCooldown > 0) {
        const totalCd = ps.isUnderdog ? 1.1 : 2.2;
        const readyRatio = 1 - ps.pulseCooldown / totalCd;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 19, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = p.colorLight;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 19, -Math.PI / 2, -Math.PI / 2 + readyRatio * Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#38BDF8';
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 19, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      ctx.rotate(ps.angle);

      // Ship 2.5D Hull
      ctx.shadowColor = p.colorDark;
      ctx.shadowBlur = 10;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(17, 0);
      ctx.lineTo(-13, -11);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-13, 11);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Mascot Pilot in Cockpit
      const distFromCenter = Math.hypot(cx - ps.x, cy - ps.y);
      let mood: CharacterMood = 'focused';
      if (distFromCenter < 115 || ps.lastDamagedTimer > 0) {
        mood = 'shocked';
      } else if (ps.score >= 4 || this.isFinished) {
        mood = 'triumph';
      } else if (ps.pulseActiveTimer > 0) {
        mood = 'happy';
      }

      drawCharacter(ctx, 0, 0, 8, p.id, isBot, mood, this.vortexAngle * 2);

      ctx.restore();

      // Player Label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, ps.x, ps.y - 24);
    }

    // Minigame Subheader at safe position y: 56
    const hudW = Math.min(width - 60, 480);
    const hudH = 26;
    const hudX = width / 2 - hudW / 2;
    const hudY = 56;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, hudW, hudH, 13);
    ctx.fill();
    ctx.strokeStyle = this.isSuddenDeath ? '#EF4444' : theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (this.isSuddenDeath) {
      const flash = Math.sin(this.suddenDeathFlashTimer * 10) > 0;
      ctx.fillStyle = flash ? '#FDE047' : '#EF4444';
      ctx.fillText('⚡ SUDDEN DEATH: EVENT HORIZON SURGE! GOLDEN ORBS (2X) ⚡', width / 2, hudY + 13);
    } else {
      const summary = active.map((p) => {
        const ps = this.playersState.get(p.id);
        return `${p.name}: 🌌 ${ps?.score || 0}/5`;
      }).join('   •   ');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(summary, width / 2, hudY + 13);
    }
    ctx.restore();

    // Theme Pill at bottom-left: x: 20, y: height - 44, w: 170, h: 32
    ctx.save();
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.strokeStyle = theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.name} [T]`, pillX + pillW * 0.5, pillY + pillH * 0.5);

    // Control Hints at bottom-right safe zone
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '11px "Outfit", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('Hold: Thrust | Tap: Pulse Repulsor', width - 24, height - 28);
    ctx.restore();
  }

  public isRoundOver(): boolean {
    if (this.isFinished) return true;
    for (const ps of this.playersState.values()) {
      if (ps.score >= 5) return true;
    }
    return false;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    let winnerId: PlayerId | null = null;
    let highestScore = -1;

    active.forEach((p) => {
      const ps = this.playersState.get(p.id);
      const sc = ps?.score || 0;
      if (sc > highestScore) {
        highestScore = sc;
        winnerId = p.id;
      }
    });

    const sorted = [...active].sort((a, b) => {
      const scA = this.playersState.get(a.id)?.score || 0;
      const scB = this.playersState.get(b.id)?.score || 0;
      return scB - scA;
    });

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      place: idx + 1,
      score: this.playersState.get(p.id)?.score || 0
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} harnessed the Cosmic Vortex with ${highestScore} antimatter orbs!` : 'The Singularity consumed all pilots in a draw!'
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }
}
