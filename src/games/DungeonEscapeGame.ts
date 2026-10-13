import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type DungeonThemeId = 'citadel_catacombs' | 'cyber_crypt' | 'volcanic_underkeep';

interface DungeonTheme {
  id: DungeonThemeId;
  name: string;
  icon: string;
  floorColor: string;
  tileGridColor: string;
  wallColor: string;
  bladeColor: string;
  bladeEdgeColor: string;
  spikeColor: string;
  relicGlow: string;
  accentColor: string;
}

const THEMES: Record<DungeonThemeId, DungeonTheme> = {
  citadel_catacombs: {
    id: 'citadel_catacombs',
    name: 'Catacombs of Dread Citadel',
    icon: '🏰',
    floorColor: '#161922',
    tileGridColor: '#242a38',
    wallColor: '#0e1118',
    bladeColor: '#94A3B8',
    bladeEdgeColor: '#E2E8F0',
    spikeColor: '#EF4444',
    relicGlow: '#F59E0B',
    accentColor: '#38BDF8'
  },
  cyber_crypt: {
    id: 'cyber_crypt',
    name: 'Cyber Data Crypt',
    icon: '⚡',
    floorColor: '#090D16',
    tileGridColor: '#1E293B',
    wallColor: '#020617',
    bladeColor: '#A855F7',
    bladeEdgeColor: '#E879F9',
    spikeColor: '#F43F5E',
    relicGlow: '#06B6D4',
    accentColor: '#A855F7'
  },
  volcanic_underkeep: {
    id: 'volcanic_underkeep',
    name: 'Volcanic Underkeep',
    icon: '🔥',
    floorColor: '#1C0C0C',
    tileGridColor: '#381616',
    wallColor: '#100505',
    bladeColor: '#EA580C',
    bladeEdgeColor: '#FDE047',
    spikeColor: '#DC2626',
    relicGlow: '#FBBF24',
    accentColor: '#F97316'
  }
};

const THEME_ORDER: DungeonThemeId[] = ['citadel_catacombs', 'cyber_crypt', 'volcanic_underkeep'];

interface PendulumBlade {
  id: number;
  pivotX: number;
  pivotY: number;
  length: number;
  angle: number;
  maxAngle: number;
  speed: number;
  bladeRadius: number;
  phase: number;
}

interface SpikeTrap {
  x: number;
  y: number;
  size: number;
  state: 'inactive' | 'warning' | 'active';
  timer: number;
  warningDuration: number;
  activeDuration: number;
  inactiveDuration: number;
}

interface DungeonRelic {
  id: number;
  x: number;
  y: number;
  type: 'chalice' | 'crown' | 'ruby' | 'golden_skull';
  points: number;
  collected: boolean;
  pulsePhase: number;
}

interface CloseCallNotification {
  x: number;
  y: number;
  text: string;
  color: string;
  timer: number;
  maxTimer: number;
}

interface DungeonRunner {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  startX: number;
  startY: number;
  facingAngle: number;
  radius: number;
  baseSpeed: number;
  score: number;
  relicsCount: number;
  lives: number;
  maxLives: number;
  hasEscaped: boolean;
  invulnTimer: number;
  stunTimer: number;
  dashCharge: number;
  isDashing: boolean;
  dashDuration: number;
  dashCooldown: number;
  isUnderdog: boolean;
  phantomShield: boolean;
  lastShoveBy: PlayerId | null;
  shoveTimer: number;
  stuckTimer: number;
  lastPos: { x: number; y: number };
  currentMood: CharacterMood;
  animTime: number;
}

export class DungeonEscapeGame extends BaseGame {
  public currentTheme: DungeonThemeId = 'citadel_catacombs';
  public playersState: Map<PlayerId, DungeonRunner> = new Map();

  private pendulums: PendulumBlade[] = [];
  private traps: SpikeTrap[] = [];
  private relics: DungeonRelic[] = [];
  private closeCalls: CloseCallNotification[] = [];

  private exitX: number = 0;
  private exitY: number = 0;
  private exitWidth: number = 100;
  private exitHeight: number = 32;
  private exitOpened: boolean = true;
  private firstEscapeTime: number = 0;

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
    this.roundTimer = 40.0;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (typeof window !== 'undefined') {
      this.keydownHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.cycleTheme();
        } else if (e.key === '1') {
          this.setTheme('citadel_catacombs');
        } else if (e.key === '2') {
          this.setTheme('cyber_crypt');
        } else if (e.key === '3') {
          this.setTheme('volcanic_underkeep');
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

        // Theme Pill bounding box at bottom-left
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

  public setTheme(theme: DungeonThemeId): void {
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnSparks(105, 556, THEMES[theme].accentColor, 16);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 40.0;
    this.isFinished = false;
    this.playersState.clear();
    this.pendulums = [];
    this.traps = [];
    this.relics = [];
    this.closeCalls = [];
    this.botReactionTimers.clear();
    this.screenShake = 0;
    this.hitStopTimer = 0;
    this.animTimer = 0;
    this.firstEscapeTime = 0;

    // Exit at top center
    this.exitX = width / 2;
    this.exitY = 88;
    this.exitWidth = 110;
    this.exitHeight = 36;
    this.exitOpened = true;

    // 1. Dynamic Pendulum Blades arranged strategically across the dungeon
    this.pendulums = [
      {
        id: 1,
        pivotX: width * 0.28,
        pivotY: height * 0.38,
        length: 75,
        angle: 0,
        maxAngle: Math.PI * 0.45,
        speed: 2.8,
        bladeRadius: 20,
        phase: 0
      },
      {
        id: 2,
        pivotX: width * 0.50,
        pivotY: height * 0.44,
        length: 82,
        angle: 0,
        maxAngle: Math.PI * 0.42,
        speed: 3.2,
        bladeRadius: 22,
        phase: Math.PI * 0.5
      },
      {
        id: 3,
        pivotX: width * 0.72,
        pivotY: height * 0.38,
        length: 75,
        angle: 0,
        maxAngle: Math.PI * 0.45,
        speed: 2.8,
        bladeRadius: 20,
        phase: Math.PI
      },
      {
        id: 4,
        pivotX: width * 0.38,
        pivotY: height * 0.65,
        length: 65,
        angle: 0,
        maxAngle: Math.PI * 0.38,
        speed: 3.0,
        bladeRadius: 18,
        phase: Math.PI * 0.25
      },
      {
        id: 5,
        pivotX: width * 0.62,
        pivotY: height * 0.65,
        length: 65,
        angle: 0,
        maxAngle: Math.PI * 0.38,
        speed: 3.0,
        bladeRadius: 18,
        phase: Math.PI * 0.75
      }
    ];

    // 2. Floor Spike Traps with staggered timers
    const trapLayout = [
      { x: width * 0.20, y: height * 0.52, size: 44, phase: 0 },
      { x: width * 0.50, y: height * 0.58, size: 46, phase: 1.1 },
      { x: width * 0.80, y: height * 0.52, size: 44, phase: 2.2 },
      { x: width * 0.34, y: height * 0.26, size: 42, phase: 0.6 },
      { x: width * 0.66, y: height * 0.26, size: 42, phase: 1.8 },
      { x: width * 0.50, y: height * 0.22, size: 46, phase: 2.7 }
    ];

    this.traps = trapLayout.map(t => ({
      x: t.x,
      y: t.y,
      size: t.size,
      state: 'inactive',
      timer: t.phase,
      warningDuration: 0.85,
      activeDuration: 1.25,
      inactiveDuration: 1.6
    }));

    // 3. Scattered Dungeon Relics
    const relicSpawns = [
      { x: width * 0.16, y: height * 0.44, type: 'chalice' as const, points: 15 },
      { x: width * 0.35, y: height * 0.48, type: 'crown' as const, points: 30 },
      { x: width * 0.50, y: height * 0.36, type: 'ruby' as const, points: 40 },
      { x: width * 0.65, y: height * 0.48, type: 'crown' as const, points: 30 },
      { x: width * 0.84, y: height * 0.44, type: 'chalice' as const, points: 15 },
      { x: width * 0.24, y: height * 0.22, type: 'ruby' as const, points: 40 },
      { x: width * 0.76, y: height * 0.22, type: 'ruby' as const, points: 40 },
      { x: width * 0.50, y: height * 0.74, type: 'chalice' as const, points: 15 }
    ];

    let relicId = 0;
    this.relics = relicSpawns.map(r => ({
      id: ++relicId,
      x: r.x,
      y: r.y,
      type: r.type,
      points: r.points,
      collected: false,
      pulsePhase: Math.random() * Math.PI * 2
    }));

    // 4. Initialize Players with kinematic physics
    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const sx = spacing * (idx + 1);
      const sy = height * 0.88;
      this.playersState.set(p.id, {
        id: p.id,
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        startX: sx,
        startY: sy,
        facingAngle: -Math.PI / 2,
        radius: 17,
        baseSpeed: 165,
        score: 0,
        relicsCount: 0,
        lives: 3,
        maxLives: 3,
        hasEscaped: false,
        invulnTimer: 0,
        stunTimer: 0,
        dashCharge: 0,
        isDashing: false,
        dashDuration: 0,
        dashCooldown: 0,
        isUnderdog: false,
        phantomShield: false,
        lastShoveBy: null,
        shoveTimer: 0,
        stuckTimer: 0,
        lastPos: { x: sx, y: sy },
        currentMood: 'focused',
        animTime: 0
      });
      this.botReactionTimers.set(p.id, 0.15 + Math.random() * 0.1);
    });
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
    const speedMult = isSuddenDeath ? 1.3 : 1.0;

    // 1. Update Pendulums (harmonic sinusoidal movement)
    for (const pen of this.pendulums) {
      pen.phase += pen.speed * speedMult * dt;
      pen.angle = Math.sin(pen.phase) * pen.maxAngle;
    }

    // 2. Update Floor Spike Traps
    for (const trap of this.traps) {
      trap.timer -= dt;
      if (trap.timer <= 0) {
        if (trap.state === 'inactive') {
          trap.state = 'warning';
          trap.timer = trap.warningDuration;
          this.audio.playTap();
        } else if (trap.state === 'warning') {
          trap.state = 'active';
          trap.timer = trap.activeDuration;
          this.audio.playWhoosh();
          this.particles.spawnSparks(trap.x, trap.y, THEMES[this.currentTheme].spikeColor, 12);
        } else {
          trap.state = 'inactive';
          trap.timer = trap.inactiveDuration + Math.random() * 0.4;
        }
      }
    }

    // 3. Update Close Call floating tags
    for (let i = this.closeCalls.length - 1; i >= 0; i--) {
      const c = this.closeCalls[i];
      c.timer -= dt;
      c.y -= 25 * dt;
      if (c.timer <= 0) {
        this.closeCalls.splice(i, 1);
      }
    }

    // 4. Evaluate Underdog Status
    this.updateUnderdogStatus();

    // 5. Update Bot AI
    this.updateBots(dt, width, height);

    // 6. Update Players
    const active = this.getActivePlayers();
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps || ps.hasEscaped) continue;

      ps.animTime += dt;

      if (ps.invulnTimer > 0) ps.invulnTimer -= dt;
      if (ps.stunTimer > 0) ps.stunTimer -= dt;
      if (ps.dashCooldown > 0) ps.dashCooldown -= dt;
      if (ps.shoveTimer > 0) {
        ps.shoveTimer -= dt;
        if (ps.shoveTimer <= 0) ps.lastShoveBy = null;
      }

      // Input reading
      let steer = this.input.getSteer(p.id);
      let throttle = this.input.getThrottle(p.id);
      const isCharging = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
      const justReleased = this.input.justReleased(p.id);

      // Dash charging logic
      if (ps.stunTimer <= 0) {
        if (isCharging && ps.dashCooldown <= 0 && !ps.isDashing) {
          ps.dashCharge = Math.min(1.0, ps.dashCharge + dt * 2.2);
          if (Math.random() < 0.3) {
            this.particles.spawnSparks(ps.x, ps.y, p.color, 2);
          }
        } else if (justReleased && ps.dashCharge > 0.25 && !ps.isDashing) {
          // Release explosive dash
          ps.isDashing = true;
          ps.dashDuration = 0.22 + ps.dashCharge * 0.14;
          const boostPower = 340 + ps.dashCharge * 280;
          ps.vx = Math.cos(ps.facingAngle) * boostPower;
          ps.vy = Math.sin(ps.facingAngle) * boostPower;
          ps.dashCooldown = 0.85;
          ps.dashCharge = 0;
          this.audio.playWhoosh();
          this.screenShake = 3.5;
          this.particles.spawnSparks(ps.x, ps.y, '#FFFFFF', 10);
        } else if (!isCharging) {
          ps.dashCharge = Math.max(0, ps.dashCharge - dt * 3);
        }
      }

      // Handle active dash duration
      if (ps.isDashing) {
        ps.dashDuration -= dt;
        this.particles.spawnSparks(ps.x, ps.y, p.color, 2);
        if (ps.dashDuration <= 0) {
          ps.isDashing = false;
        }
      }

      // Kinematic directional movement
      if (ps.stunTimer <= 0 && !ps.isDashing) {
        const inputMag = Math.hypot(steer, throttle);
        if (inputMag > 0.15) {
          const moveAngle = Math.atan2(throttle, steer);
          ps.facingAngle = moveAngle;
          const currentSpeed = ps.baseSpeed * (ps.isUnderdog ? 1.25 : 1.0);
          ps.vx = Math.cos(moveAngle) * currentSpeed;
          ps.vy = Math.sin(moveAngle) * currentSpeed;
        } else {
          // Snappy kinematic braking
          ps.vx *= 0.15;
          ps.vy *= 0.15;
          if (Math.hypot(ps.vx, ps.vy) < 5) {
            ps.vx = 0;
            ps.vy = 0;
          }
        }
      } else if (ps.stunTimer > 0) {
        ps.vx *= 0.85;
        ps.vy *= 0.85;
      }

      // Integrate position
      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Dungeon Arena Boundaries
      const margin = ps.radius + 12;
      const topMargin = 78;
      ps.x = Math.max(margin, Math.min(width - margin, ps.x));
      ps.y = Math.max(topMargin, Math.min(height - margin, ps.y));

      // Stuck detection for bots
      const distMoved = Math.hypot(ps.x - ps.lastPos.x, ps.y - ps.lastPos.y);
      if (distMoved < 4 && Math.hypot(steer, throttle) > 0.2) {
        ps.stuckTimer += dt;
      } else {
        ps.stuckTimer = 0;
      }
      ps.lastPos.x = ps.x;
      ps.lastPos.y = ps.y;

      // Mood updates
      if (ps.isDashing) ps.currentMood = 'triumph';
      else if (ps.stunTimer > 0) ps.currentMood = 'shocked';
      else if (ps.isUnderdog) ps.currentMood = 'focused';
      else ps.currentMood = 'idle';

      // 7. Relic collection
      for (const relic of this.relics) {
        if (!relic.collected && Math.hypot(ps.x - relic.x, ps.y - relic.y) < ps.radius + 14) {
          relic.collected = true;
          ps.relicsCount++;
          const pts = relic.points * (isSuddenDeath ? 2 : 1);
          ps.score += pts;
          this.audio.playScore();
          this.particles.spawnSparks(relic.x, relic.y, THEMES[this.currentTheme].relicGlow, 14);
          this.addCloseCall(relic.x, relic.y - 10, `+${pts} RELIC!`, THEMES[this.currentTheme].relicGlow);
        }
      }

      // 8. Exit Portcullis check
      const dxExit = Math.abs(ps.x - this.exitX);
      const dyExit = Math.abs(ps.y - this.exitY);
      if (dxExit < this.exitWidth / 2 && dyExit < this.exitHeight / 2) {
        ps.hasEscaped = true;
        const escapePts = 120 + (this.firstEscapeTime === 0 ? 50 : 0);
        ps.score += escapePts;
        if (this.firstEscapeTime === 0) {
          this.firstEscapeTime = this.roundTimer;
          // Spawn extra sudden death skulls for trailing players to snatch!
          this.spawnSuddenDeathRelics(width, height);
        }
        this.audio.playFanfare();
        this.particles.spawnConfetti(ps.x, ps.y, 35);
        this.addCloseCall(ps.x, ps.y - 20, `👑 ESCAPED! +${escapePts}`, '#FFD700');

        // Check if all active players escaped
        const allEscaped = active.every(pl => {
          const s = this.playersState.get(pl.id);
          return s ? s.hasEscaped || s.lives <= 0 : true;
        });
        if (allEscaped) {
          this.isFinished = true;
          return;
        }
      }

      // 9. Hazard Collision Checks (Pendulums & Spike Traps)
      if (ps.invulnTimer <= 0) {
        let hit = false;
        let hazardX = 0;
        let hazardY = 0;

        // Check Pendulums
        for (const pen of this.pendulums) {
          const bladeX = pen.pivotX + Math.sin(pen.angle) * pen.length;
          const bladeY = pen.pivotY + Math.cos(pen.angle) * pen.length;
          const dist = Math.hypot(ps.x - bladeX, ps.y - bladeY);

          if (dist < ps.radius + pen.bladeRadius) {
            hit = true;
            hazardX = bladeX;
            hazardY = bladeY;
            break;
          } else if (dist < ps.radius + pen.bladeRadius + 22 && !ps.isDashing) {
            // Close shave bonus!
            if (Math.random() < 0.08) {
              ps.score += 20;
              this.audio.playTap();
              this.addCloseCall(ps.x, ps.y - 16, '⚡ CLOSE SHAVE! +20', '#38BDF8');
            }
          }
        }

        // Check Spikes
        if (!hit) {
          for (const trap of this.traps) {
            if (trap.state === 'active') {
              const inTrapX = Math.abs(ps.x - trap.x) < trap.size / 2 + ps.radius * 0.6;
              const inTrapY = Math.abs(ps.y - trap.y) < trap.size / 2 + ps.radius * 0.6;
              if (inTrapX && inTrapY) {
                hit = true;
                hazardX = trap.x;
                hazardY = trap.y;
                break;
              }
            } else if (trap.state === 'warning') {
              const dist = Math.hypot(ps.x - trap.x, ps.y - trap.y);
              if (dist < trap.size / 2 + ps.radius + 18 && !ps.isDashing) {
                if (Math.random() < 0.05) {
                  ps.score += 15;
                  this.addCloseCall(ps.x, ps.y - 16, 'DODGED! +15', '#F59E0B');
                }
              }
            }
          }
        }

        if (hit) {
          this.handlePlayerDamage(ps, hazardX, hazardY);
        }
      }
    }

    // 10. Inter-player Body Collisions & Dash Shoves (m1*v1 + m2*v2)
    for (let i = 0; i < active.length; i++) {
      const p1 = this.playersState.get(active[i].id);
      if (!p1 || p1.hasEscaped) continue;

      for (let j = i + 1; j < active.length; j++) {
        const p2 = this.playersState.get(active[j].id);
        if (!p2 || p2.hasEscaped) continue;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = p1.radius + p2.radius;

        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          // Push apart
          p1.x -= nx * overlap * 0.5;
          p1.y -= ny * overlap * 0.5;
          p2.x += nx * overlap * 0.5;
          p2.y += ny * overlap * 0.5;

          // Check if either is dashing (Mighty Shove!)
          if (p1.isDashing || p2.isDashing) {
            const shoveImpulse = 420;
            if (p1.isDashing && !p2.isDashing) {
              p2.vx = nx * shoveImpulse * (p1.isUnderdog ? 1.4 : 1.0);
              p2.vy = ny * shoveImpulse * (p1.isUnderdog ? 1.4 : 1.0);
              p2.stunTimer = 0.35;
              p2.lastShoveBy = p1.id;
              p2.shoveTimer = 1.8;
              this.screenShake = 6.0;
              this.hitStopTimer = 0.045;
              this.audio.playExplosion();
              this.particles.spawnSparks(p2.x, p2.y, '#EF4444', 16);
              this.addCloseCall(p2.x, p2.y - 20, '💥 SHOVED!', '#EF4444');
            } else if (p2.isDashing && !p1.isDashing) {
              p1.vx = -nx * shoveImpulse * (p2.isUnderdog ? 1.4 : 1.0);
              p1.vy = -ny * shoveImpulse * (p2.isUnderdog ? 1.4 : 1.0);
              p1.stunTimer = 0.35;
              p1.lastShoveBy = p2.id;
              p1.shoveTimer = 1.8;
              this.screenShake = 6.0;
              this.hitStopTimer = 0.045;
              this.audio.playExplosion();
              this.particles.spawnSparks(p1.x, p1.y, '#EF4444', 16);
              this.addCloseCall(p1.x, p1.y - 20, '💥 SHOVED!', '#EF4444');
            } else {
              // Mutual clash
              p1.vx = -nx * shoveImpulse * 0.7;
              p1.vy = -ny * shoveImpulse * 0.7;
              p2.vx = nx * shoveImpulse * 0.7;
              p2.vy = ny * shoveImpulse * 0.7;
              this.screenShake = 5.0;
              this.audio.playBounce();
              this.particles.spawnSparks((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, '#F59E0B', 12);
            }
          } else {
            // Elastic bump
            const kx = p1.vx - p2.vx;
            const ky = p1.vy - p2.vy;
            const p = 2 * (nx * kx + ny * ky) / 2;
            p1.vx -= p * nx * 0.8;
            p1.vy -= p * ny * 0.8;
            p2.vx += p * nx * 0.8;
            p2.vy += p * ny * 0.8;
            this.audio.playBounce();
          }
        }
      }
    }

    // Check round end
    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private handlePlayerDamage(ps: DungeonRunner, hazardX: number, hazardY: number): void {
    // If player has Phantom Shield (from Underdog), absorb hit
    if (ps.phantomShield) {
      ps.phantomShield = false;
      ps.invulnTimer = 1.2;
      this.audio.playBounce();
      this.screenShake = 4.0;
      this.particles.spawnSparks(ps.x, ps.y, '#FFD700', 18);
      this.addCloseCall(ps.x, ps.y - 18, '🛡️ SHIELD BROKEN!', '#FFD700');
      // Push back safely
      const ang = Math.atan2(ps.y - hazardY, ps.x - hazardX);
      ps.vx = Math.cos(ang) * 220;
      ps.vy = Math.sin(ang) * 220;
      return;
    }

    ps.lives--;
    ps.score = Math.max(0, ps.score - 25);
    ps.invulnTimer = 1.8;
    ps.stunTimer = 0.5;
    ps.currentMood = 'shocked';
    this.screenShake = 8.0;
    this.hitStopTimer = 0.05;
    this.audio.playExplosion();
    this.particles.spawnSparks(ps.x, ps.y, '#EF4444', 22);

    // If shoved into hazard by rival, credit rival!
    if (ps.lastShoveBy !== null) {
      const rival = this.playersState.get(ps.lastShoveBy);
      if (rival) {
        rival.score += 40;
        this.addCloseCall(rival.x, rival.y - 20, '🎯 SABOTAGE! +40', '#10B981');
      }
    }

    // Knockback away from hazard or respawn at start if 0 lives
    if (ps.lives <= 0) {
      ps.lives = ps.maxLives;
      ps.x = ps.startX;
      ps.y = ps.startY;
      ps.vx = 0;
      ps.vy = 0;
      this.addCloseCall(ps.x, ps.y - 20, '☠️ CITADEL RESPAWN!', '#EF4444');
    } else {
      const pushAng = Math.atan2(ps.y - hazardY, ps.x - hazardX);
      ps.vx = Math.cos(pushAng) * 280;
      ps.vy = Math.sin(pushAng) * 280;
      this.addCloseCall(ps.x, ps.y - 20, '💥 HIT! -25', '#EF4444');
    }
  }

  private updateUnderdogStatus(): void {
    const active = this.getActivePlayers();
    if (active.length < 2) return;

    let maxScore = -1;
    let minScore = Infinity;
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      if (ps.score > maxScore) maxScore = ps.score;
      if (ps.score < minScore) minScore = ps.score;
    }

    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      // Trailing by >= 40 points or lowest lives
      if (maxScore - ps.score >= 40 || ps.lives === 1) {
        if (!ps.isUnderdog) {
          ps.isUnderdog = true;
          ps.phantomShield = true; // Absorbs 1 hit!
        }
      } else {
        ps.isUnderdog = false;
      }
    }
  }

  private spawnSuddenDeathRelics(width: number, height: number): void {
    const extraSpots = [
      { x: width * 0.30, y: height * 0.40 },
      { x: width * 0.70, y: height * 0.40 },
      { x: width * 0.50, y: height * 0.50 }
    ];
    let newId = this.relics.length + 10;
    for (const s of extraSpots) {
      this.relics.push({
        id: ++newId,
        x: s.x,
        y: s.y,
        type: 'golden_skull',
        points: 60,
        collected: false,
        pulsePhase: Math.random() * Math.PI * 2
      });
      this.particles.spawnSparks(s.x, s.y, '#FFD700', 16);
    }
  }

  private addCloseCall(x: number, y: number, text: string, color: string): void {
    this.closeCalls.push({
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
    const ps = this.playersState.get(botId);
    if (!ps || ps.hasEscaped) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    // Reaction Delays:
    // Easy: 380-450ms, blunders, imperfect pathfinding
    // Normal: 220-250ms, clean dodging, chases relics
    // Hard: 90-130ms, predictive blade dodging, offensive dashing
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

    // If bot is stuck against a wall, initiate escape maneuver
    if (ps.stuckTimer > 0.4) {
      const escapeX = _width / 2 - ps.x;
      const escapeY = _height / 2 - ps.y;
      const ang = Math.atan2(escapeY, escapeX);
      this.input.setBotInput(botId, true, Math.cos(ang), Math.sin(ang), false);
      return;
    }

    // Determine target (Exit or Nearest High-Value Relic)
    let targetX = this.exitX;
    let targetY = this.exitY;

    // Check if there are valuable uncollected relics on the way
    const uncollected = this.relics.filter(r => !r.collected);
    if (uncollected.length > 0) {
      // Find nearest relic
      let nearest = uncollected[0];
      let minDist = Math.hypot(ps.x - nearest.x, ps.y - nearest.y);
      for (const r of uncollected) {
        const d = Math.hypot(ps.x - r.x, ps.y - r.y);
        if (d < minDist) {
          minDist = d;
          nearest = r;
        }
      }
      // Bots will divert if relic is reasonably close or high value
      if (minDist < 160 && (difficulty !== 'bot_easy' || Math.random() < 0.6)) {
        targetX = nearest.x;
        targetY = nearest.y;
      }
    }

    // Hazard Avoidance Vector calculation
    let avoidVx = 0;
    let avoidVy = 0;
    let dangerDetected = false;

    // 1. Avoid Pendulums (Hard bots predict blade motion)
    for (const pen of this.pendulums) {
      const bladeX = pen.pivotX + Math.sin(pen.angle) * pen.length;
      const bladeY = pen.pivotY + Math.cos(pen.angle) * pen.length;
      const dist = Math.hypot(ps.x - bladeX, ps.y - bladeY);
      const safeThreshold = difficulty === 'bot_easy' ? 42 : 58;

      if (dist < safeThreshold) {
        dangerDetected = true;
        const awayAng = Math.atan2(ps.y - bladeY, ps.x - bladeX);
        const force = (safeThreshold - dist) / safeThreshold;
        avoidVx += Math.cos(awayAng) * force * 1.5;
        avoidVy += Math.sin(awayAng) * force * 1.5;
      }
    }

    // 2. Avoid Spike Traps (warning & active)
    for (const trap of this.traps) {
      if (trap.state === 'active' || (trap.state === 'warning' && trap.timer < 0.45)) {
        const dist = Math.hypot(ps.x - trap.x, ps.y - trap.y);
        const safeDist = trap.size / 2 + ps.radius + 15;
        if (dist < safeDist) {
          dangerDetected = true;
          const awayAng = Math.atan2(ps.y - trap.y, ps.x - trap.x);
          const force = (safeDist - dist) / safeDist;
          avoidVx += Math.cos(awayAng) * force * 1.8;
          avoidVy += Math.sin(awayAng) * force * 1.8;
        }
      }
    }

    // Compute desired movement direction
    let moveDirX = targetX - ps.x;
    let moveDirY = targetY - ps.y;
    const targetDist = Math.hypot(moveDirX, moveDirY);
    if (targetDist > 0.001) {
      moveDirX /= targetDist;
      moveDirY /= targetDist;
    }

    // Blend avoidance and navigation
    let finalVx = moveDirX;
    let finalVy = moveDirY;

    if (dangerDetected && Math.random() > blunderChance) {
      finalVx = finalVx * 0.25 + avoidVx * 1.2;
      finalVy = finalVy * 0.25 + avoidVy * 1.2;
    }

    const finalMag = Math.hypot(finalVx, finalVy);
    if (finalMag > 0.001) {
      finalVx /= finalMag;
      finalVy /= finalMag;
    }

    // Dash Decision:
    // - On Hard: charges dash to leap across corridors or shove rivals near traps
    // - On Normal: dashes when open corridor ahead
    let wantsDash = false;
    if (difficulty === 'bot_hard') {
      if (!dangerDetected && targetDist > 140 && ps.dashCooldown <= 0) {
        wantsDash = true;
      }
      // Check for human players in front to shove
      for (const p of this.getActivePlayers()) {
        if (p.id !== botId) {
          const rival = this.playersState.get(p.id);
          if (rival && !rival.hasEscaped) {
            const dRival = Math.hypot(rival.x - ps.x, rival.y - ps.y);
            if (dRival < 110 && dRival > 30) {
              const angToRival = Math.atan2(rival.y - ps.y, rival.x - ps.x);
              const angleDiff = Math.abs(angToRival - ps.facingAngle);
              if (angleDiff < 0.4) wantsDash = true;
            }
          }
        }
      }
    } else if (difficulty === 'bot_normal') {
      if (!dangerDetected && targetDist > 180 && Math.random() < 0.45 && ps.dashCooldown <= 0) {
        wantsDash = true;
      }
    }

    this.input.setBotInput(botId, wantsDash, finalVx, finalVy, false);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const ps = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: ps?.score || 0,
        escaped: ps?.hasEscaped || false,
        relics: ps?.relicsCount || 0
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
      ? `Player ${winnerId + 1} escaped the Dread Citadel with ${scores[0].relics} relics (${topScore} pts)!`
      : 'The catacombs claimed all challengers!';

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

    // 1. Atmospheric Dungeon Floor & Grid
    ctx.fillStyle = theme.floorColor;
    ctx.fillRect(0, 0, width, height);

    // Stone / Circuit Tiles
    ctx.strokeStyle = theme.tileGridColor;
    ctx.lineWidth = 1.5;
    const tileSize = 44;
    for (let x = 0; x < width; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 70);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 70; y < height; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Wall Borders (Citadel Parapets)
    ctx.fillStyle = theme.wallColor;
    ctx.fillRect(0, 70, 16, height - 70);
    ctx.fillRect(width - 16, 70, 16, height - 70);
    ctx.fillRect(0, 70, width, 14);

    // 2. Floor Spike Traps
    for (const trap of this.traps) {
      this.renderSpikeTrap(ctx, trap, theme);
    }

    // 3. Golden Portcullis Exit
    this.renderExitGate(ctx, width);

    // 4. Relics
    for (const relic of this.relics) {
      if (relic.collected) continue;
      this.renderRelic(ctx, relic, theme);
    }

    // 5. Pendulum Blades
    for (const pen of this.pendulums) {
      this.renderPendulum(ctx, pen, theme);
    }

    // 6. Players with CharacterRenderer
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderRunner(ctx, ps, p);
    }

    // 7. Close Calls & Floating Alerts
    for (const c of this.closeCalls) {
      ctx.save();
      const alpha = Math.min(1.0, c.timer / (c.maxTimer * 0.4));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = c.color;
      ctx.font = 'bold 12px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    }

    ctx.restore(); // Restore screen shake

    // 8. Safe UI & Theme Pill (Strictly preserving global timer at y: 12-44)
    this.renderSafeUI(ctx, width, height);
  }

  private renderSpikeTrap(ctx: CanvasRenderingContext2D, trap: SpikeTrap, theme: DungeonTheme): void {
    ctx.save();
    ctx.translate(trap.x, trap.y);

    // Trap Base Grill
    ctx.fillStyle = '#0F121A';
    ctx.fillRect(-trap.size / 2, -trap.size / 2, trap.size, trap.size);
    ctx.strokeStyle = trap.state === 'active' ? theme.spikeColor : '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(-trap.size / 2, -trap.size / 2, trap.size, trap.size);

    if (trap.state === 'inactive') {
      // Retracted hole slots
      ctx.fillStyle = '#1E293B';
      const count = 3;
      const step = trap.size / (count + 1);
      for (let ix = 1; ix <= count; ix++) {
        for (let iy = 1; iy <= count; iy++) {
          ctx.beginPath();
          ctx.arc(-trap.size / 2 + ix * step, -trap.size / 2 + iy * step, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (trap.state === 'warning') {
      // Flashing Warning Runes
      const pulse = (Math.sin(this.animTimer * 16) + 1) * 0.5;
      ctx.fillStyle = `rgba(239, 68, 68, ${0.25 + pulse * 0.45})`;
      ctx.fillRect(-trap.size / 2 + 2, -trap.size / 2 + 2, trap.size - 4, trap.size - 4);

      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 16px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚠', 0, 0);
    } else if (trap.state === 'active') {
      // Thrusting Steel / Magma Spikes
      ctx.fillStyle = theme.spikeColor;
      const count = 3;
      const step = trap.size / (count + 1);
      for (let ix = 1; ix <= count; ix++) {
        for (let iy = 1; iy <= count; iy++) {
          const sx = -trap.size / 2 + ix * step;
          const sy = -trap.size / 2 + iy * step;
          ctx.beginPath();
          ctx.moveTo(sx - 3.5, sy + 4);
          ctx.lineTo(sx + 3.5, sy + 4);
          ctx.lineTo(sx, sy - 7);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  private renderPendulum(ctx: CanvasRenderingContext2D, pen: PendulumBlade, theme: DungeonTheme): void {
    ctx.save();
    const bladeX = pen.pivotX + Math.sin(pen.angle) * pen.length;
    const bladeY = pen.pivotY + Math.cos(pen.angle) * pen.length;

    // Pivot mount
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(pen.pivotX, pen.pivotY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Steel Shaft
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(pen.pivotX, pen.pivotY);
    ctx.lineTo(bladeX, bladeY);
    ctx.stroke();

    // Crescent Pendulum Axe Head
    ctx.save();
    ctx.translate(bladeX, bladeY);
    ctx.rotate(pen.angle);

    // Blade Body
    ctx.fillStyle = theme.bladeColor;
    ctx.beginPath();
    ctx.arc(0, 0, pen.bladeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Razor Sharp Beveled Edges
    ctx.strokeStyle = theme.bladeEdgeColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, pen.bladeRadius, -Math.PI * 0.6, Math.PI * 0.6);
    ctx.stroke();

    // Inner Rune Core
    ctx.fillStyle = theme.accentColor;
    ctx.beginPath();
    ctx.arc(0, 0, pen.bladeRadius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore();
  }

  private renderRelic(ctx: CanvasRenderingContext2D, relic: DungeonRelic, theme: DungeonTheme): void {
    ctx.save();
    const bob = Math.sin(this.animTimer * 4 + relic.pulsePhase) * 3;
    ctx.translate(relic.x, relic.y + bob);

    // Glow aura
    ctx.fillStyle = theme.relicGlow;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    if (relic.type === 'crown') {
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.moveTo(-9, 5);
      ctx.lineTo(9, 5);
      ctx.lineTo(8, -6);
      ctx.lineTo(3, -2);
      ctx.lineTo(0, -7);
      ctx.lineTo(-3, -2);
      ctx.lineTo(-8, -6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (relic.type === 'ruby') {
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(8, -1);
      ctx.lineTo(0, 8);
      ctx.lineTo(-8, -1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#FCA5A5';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (relic.type === 'golden_skull') {
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(0, -2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-5, 3, 10, 6);
      ctx.fillStyle = '#000000';
      ctx.fillRect(-4, -2, 2.5, 3);
      ctx.fillRect(1.5, -2, 2.5, 3);
    } else {
      // Chalice
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(0, -2, 7, 0, Math.PI);
      ctx.fill();
      ctx.fillRect(-2, 5, 4, 4);
      ctx.fillRect(-5, 8, 10, 2);
    }

    ctx.restore();
  }

  private renderExitGate(ctx: CanvasRenderingContext2D, _width: number): void {
    ctx.save();
    ctx.translate(this.exitX, this.exitY);

    // Arch Frame
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(-this.exitWidth / 2 - 6, -18, this.exitWidth + 12, this.exitHeight + 8);

    // Portal Glow
    const pulse = (Math.sin(this.animTimer * 5) + 1) * 0.5;
    ctx.fillStyle = `rgba(245, 158, 11, ${0.4 + pulse * 0.3})`;
    ctx.fillRect(-this.exitWidth / 2, -14, this.exitWidth, this.exitHeight);

    // Iron Portcullis Grate Bars
    ctx.fillStyle = '#0F172A';
    for (let x = -this.exitWidth / 2 + 10; x < this.exitWidth / 2; x += 14) {
      ctx.fillRect(x, -14, 4, this.exitHeight);
    }

    // Golden Portcullis Header
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.roundRect(-this.exitWidth / 2, -22, this.exitWidth, 14, 4);
    ctx.fill();
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.font = '900 10px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('★ CITADEL PORTCULLIS ★', 0, -11);

    ctx.restore();
  }

  private renderRunner(ctx: CanvasRenderingContext2D, ps: DungeonRunner, p: PlayerConfig): void {
    ctx.save();
    ctx.translate(ps.x, ps.y);

    // Invulnerability Blink
    if (ps.invulnTimer > 0 && Math.floor(ps.invulnTimer * 10) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    // Phantom Shield Aura (Underdog)
    if (ps.phantomShield) {
      ctx.save();
      const shieldPulse = (Math.sin(this.animTimer * 8) + 1) * 0.5;
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 0, ps.radius + 6 + shieldPulse * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Dash Charge Aura Ring
    if (ps.dashCharge > 0) {
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2 + ps.dashCharge * 2;
      ctx.beginPath();
      ctx.arc(0, 0, ps.radius + 4 + ps.dashCharge * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Mascot Character
    drawCharacter(
      ctx,
      0,
      0,
      ps.radius,
      p.id,
      p.type !== 'human',
      ps.currentMood,
      ps.animTime,
      undefined
    );

    // Direction indicator pointer
    ctx.save();
    ctx.rotate(ps.facingAngle);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(ps.radius + 3, 0);
    ctx.lineTo(ps.radius - 2, -4);
    ctx.lineTo(ps.radius - 2, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Floating Escaped Banner
    if (ps.hasEscaped) {
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 11px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('👑 ESCAPED!', 0, -ps.radius - 8);
    } else if (ps.isUnderdog) {
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 10px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ SURGE', 0, -ps.radius - 8);
    }

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
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : '#F59E0B';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#EF4444' : '#FFFFFF';
    ctx.font = 'bold 12px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const statusText = isSuddenDeath
      ? '🔥 CITADEL COLLAPSE! 2X POINTS & FAST BLADES'
      : 'DODGE BLADES • SHOVE RIVALS • REACH PORTCULLIS';
    ctx.fillText(statusText, width * 0.5, badgeY + badgeH * 0.5);

    // 2. Corner Player Status Cards (Offset to y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
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
        ps?.currentMood || 'idle',
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
      ctx.fillText(`${ps?.score || 0} pts`, cardX + 42, cardY + 23);

      // Lives Hearts / Shields
      const lives = ps?.lives || 0;
      let heartsStr = '';
      for (let l = 0; l < 3; l++) {
        heartsStr += l < lives ? '❤️' : '🖤';
      }
      ctx.font = '10px sans-serif';
      ctx.fillText(heartsStr, cardX + 42, cardY + 38);
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
    ctx.fillText('MOVE: WASD / STICK • HOLD ACTION: DUNGEON DASH', width - 20, height - 14);

    ctx.restore();
  }

  public syncDebug(): void {
    // Debug inspection helper
  }

  public destroy(): void {
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
