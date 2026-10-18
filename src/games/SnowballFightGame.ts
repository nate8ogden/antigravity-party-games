import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type SnowMapTheme = 'alpine' | 'aurora' | 'twilight';

export interface ThemeConfig {
  id: SnowMapTheme;
  name: string;
  bgGradTop: string;
  bgGradMid: string;
  bgGradBottom: string;
  borderColor: string;
  pillColor: string;
  snowColor: string;
  treeColors: [string, string, string];
}

export const THEME_CONFIGS: ThemeConfig[] = [
  {
    id: 'alpine',
    name: 'Alpine Blizzard ❄️',
    bgGradTop: '#E0F2FE',
    bgGradMid: '#F0F9FF',
    bgGradBottom: '#E2E8F0',
    borderColor: '#38BDF8',
    pillColor: '#0284C7',
    snowColor: '#FFFFFF',
    treeColors: ['#166534', '#15803D', '#16A34A']
  },
  {
    id: 'aurora',
    name: 'Arctic Aurora 🌌',
    bgGradTop: '#051026',
    bgGradMid: '#0A2540',
    bgGradBottom: '#0F3A4B',
    borderColor: '#2DD4BF',
    pillColor: '#0D9488',
    snowColor: '#CCFBF1',
    treeColors: ['#064E3B', '#047857', '#10B981']
  },
  {
    id: 'twilight',
    name: 'Twilight Frost 🌲',
    bgGradTop: '#1E1B4B',
    bgGradMid: '#312E81',
    bgGradBottom: '#1E293B',
    borderColor: '#A855F7',
    pillColor: '#7C3AED',
    snowColor: '#F3E8FF',
    treeColors: ['#1E293B', '#334155', '#475569']
  }
];

interface SnowballPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  side: 'west' | 'east' | 'nw' | 'ne' | 'sw' | 'se';
  aimAngle: number;
  sweepDir: number;
  minAimAngle: number;
  maxAimAngle: number;
  isCharging: boolean;
  chargePower: number; // 0.0 to 1.0
  chargeTime: number;
  hp: number;
  maxHp: number;
  stunTimer: number;
  throwCooldown: number;
  alive: boolean;
  score: number;
  streak: number;
  isUnderdog: boolean;
  recentScoreTimer: number;
}

interface BallisticSnowball {
  id: number;
  ownerId: PlayerId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  power: number;
  life: number;
  isGolden: boolean;
}

interface SnowFortBlock {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
}

interface PineTree {
  x: number;
  y: number;
  radius: number;
}

interface SnowDecal {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  color?: string;
}

interface AmbientFlake {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

export class SnowballFightGame extends BaseGame {
  private playersState: Map<PlayerId, SnowballPlayer> = new Map();
  private snowballs: BallisticSnowball[] = [];
  private blocks: SnowFortBlock[] = [];
  private trees: PineTree[] = [];
  private decals: SnowDecal[] = [];
  private ambientFlakes: AmbientFlake[] = [];
  private currentMapName: string = 'Twin Snow Forts';
  private ballCounter: number = 0;
  private totalSnowballsThrown: number = 0;
  private destructionOrder: PlayerId[] = [];
  private gravity: number = 550;

  // Visual Themes & Controls
  public mapTheme: SnowMapTheme = 'alpine';
  private lastWidth: number = 960;
  private lastHeight: number = 540;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private suddenDeathAnnounced: boolean = false;
  private suddenDeathTimer: number = 0;
  private animTimer: number = 0;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.bindKeyboardShortcuts();
    this.bindCanvasPointer();
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 45;
    this.isFinished = false;
    this.playersState.clear();
    this.snowballs = [];
    this.blocks = [];
    this.trees = [];
    this.decals = [];
    this.ballCounter = 0;
    this.totalSnowballsThrown = 0;
    this.destructionOrder = [];
    this.suddenDeathAnnounced = false;
    this.suddenDeathTimer = 0;
    this.animTimer = 0;

    // Ambient snowflakes
    this.ambientFlakes = [];
    for (let i = 0; i < 60; i++) {
      this.ambientFlakes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 20,
        vy: 25 + Math.random() * 45,
        size: 1.5 + Math.random() * 2.5,
        alpha: 0.35 + Math.random() * 0.5
      });
    }

    const active = this.getActivePlayers();
    const isTwoPlayer = active.length === 2;

    // Procedural Map Generation
    this.generateProceduralMap(width, height, isTwoPlayer);

    if (isTwoPlayer) {
      // 2 Player Duel: West vs East
      const p1 = active[0];
      const p2 = active[1];

      this.playersState.set(p1.id, {
        id: p1.id,
        x: width * 0.16,
        y: height * 0.5,
        vx: 0,
        vy: 0,
        baseX: width * 0.16,
        baseY: height * 0.5,
        side: 'west',
        aimAngle: 0,
        sweepDir: 1,
        minAimAngle: -Math.PI * 0.32,
        maxAimAngle: Math.PI * 0.32,
        isCharging: false,
        chargePower: 0,
        chargeTime: 0,
        hp: 3,
        maxHp: 3,
        stunTimer: 0,
        throwCooldown: 0,
        alive: true,
        score: 0,
        streak: 0,
        isUnderdog: false,
        recentScoreTimer: 0
      });

      this.playersState.set(p2.id, {
        id: p2.id,
        x: width * 0.84,
        y: height * 0.5,
        vx: 0,
        vy: 0,
        baseX: width * 0.84,
        baseY: height * 0.5,
        side: 'east',
        aimAngle: Math.PI,
        sweepDir: 1,
        minAimAngle: Math.PI * 0.68,
        maxAimAngle: Math.PI * 1.32,
        isCharging: false,
        chargePower: 0,
        chargeTime: 0,
        hp: 3,
        maxHp: 3,
        stunTimer: 0,
        throwCooldown: 0,
        alive: true,
        score: 0,
        streak: 0,
        isUnderdog: false,
        recentScoreTimer: 0
      });
    } else {
      // 3 or 4 Players: 4 Corner quadrants facing arena center
      const corners: {
        x: number;
        y: number;
        centerAngle: number;
        minA: number;
        maxA: number;
        side: 'nw' | 'ne' | 'sw' | 'se';
      }[] = [
        {
          x: width * 0.18,
          y: height * 0.22,
          centerAngle: Math.PI * 0.25,
          minA: 0,
          maxA: Math.PI * 0.5,
          side: 'nw'
        }, // P1 (Top-Left)
        {
          x: width * 0.82,
          y: height * 0.22,
          centerAngle: Math.PI * 0.75,
          minA: Math.PI * 0.5,
          maxA: Math.PI,
          side: 'ne'
        }, // P2 (Top-Right)
        {
          x: width * 0.18,
          y: height * 0.78,
          centerAngle: -Math.PI * 0.25,
          minA: -Math.PI * 0.5,
          maxA: 0,
          side: 'sw'
        }, // P3 (Bottom-Left)
        {
          x: width * 0.82,
          y: height * 0.78,
          centerAngle: -Math.PI * 0.75,
          minA: -Math.PI,
          maxA: -Math.PI * 0.5,
          side: 'se'
        } // P4 (Bottom-Right)
      ];

      active.forEach((p, idx) => {
        const c = corners[idx % corners.length];
        this.playersState.set(p.id, {
          id: p.id,
          x: c.x,
          y: c.y,
          vx: 0,
          vy: 0,
          baseX: c.x,
          baseY: c.y,
          side: c.side,
          aimAngle: c.centerAngle,
          sweepDir: 1,
          minAimAngle: c.minA - 0.2,
          maxAimAngle: c.maxA + 0.2,
          isCharging: false,
          chargePower: 0,
          chargeTime: 0,
          hp: 3,
          maxHp: 3,
          stunTimer: 0,
          throwCooldown: 0,
          alive: true,
          score: 0,
          streak: 0,
          isUnderdog: false,
          recentScoreTimer: 0
        });
      });
    }

    this.syncDebug();
  }

  public syncDebug(): void {
    if (typeof window !== 'undefined') {
      (window as any).__SNOWBALL_FIGHT_DEBUG__ = {
        players: Array.from(this.playersState.values()),
        snowballs: this.snowballs,
        blocks: this.blocks,
        totalThrown: this.totalSnowballsThrown,
        roundTimer: this.roundTimer,
        isFinished: this.isFinished,
        theme: this.mapTheme,
        setTheme: (theme: SnowMapTheme) => this.setMapTheme(theme),
        cycleTheme: () => this.cycleTheme()
      };
    }
  }

  private bindCanvasPointer(): void {
    if (typeof window === 'undefined') return;
    const canvas = this.input.getCanvas();
    if (!canvas) return;

    this.boundPointerDown = (e: PointerEvent) => {
      this.handlePointerDown(e);
    };
    canvas.addEventListener('pointerdown', this.boundPointerDown);
  }

  private handlePointerDown(e: PointerEvent): void {
    const canvas = this.input.getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * this.lastWidth;
    const clickY = ((e.clientY - rect.top) / rect.height) * this.lastHeight;

    // Check Theme Pill click at (20, height - 44, 170, 32)
    if (
      clickX >= 20 &&
      clickX <= 190 &&
      clickY >= this.lastHeight - 44 &&
      clickY <= this.lastHeight - 12
    ) {
      this.cycleTheme();
    }
  }

  public cycleTheme(): void {
    const curIdx = THEME_CONFIGS.findIndex((t) => t.id === this.mapTheme);
    const nextIdx = (curIdx + 1) % THEME_CONFIGS.length;
    this.setMapTheme(THEME_CONFIGS[nextIdx].id);
  }

  public setMapTheme(theme: SnowMapTheme): void {
    if (this.mapTheme === theme) return;
    this.mapTheme = theme;
    this.audio.playTap();
    this.particles.spawnExplosion(100, this.lastHeight - 28, '#38BDF8', 14);
    this.syncDebug();
  }

  private bindKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;
    this.unbindKeyboardShortcuts();

    this.keydownListener = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === '1') {
        this.setMapTheme('alpine');
      } else if (e.key === '2') {
        this.setMapTheme('aurora');
      } else if (e.key === '3') {
        this.setMapTheme('twilight');
      }
    };
    window.addEventListener('keydown', this.keydownListener);
  }

  private unbindKeyboardShortcuts(): void {
    if (typeof window !== 'undefined' && this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
  }

  public override destroy(): void {
    this.unbindKeyboardShortcuts();
    if (this.boundPointerDown) {
      const canvas = this.input.getCanvas();
      if (canvas) {
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
      }
      this.boundPointerDown = null;
    }
    if (typeof window !== 'undefined' && (window as any).__SNOWBALL_FIGHT_DEBUG__) {
      delete (window as any).__SNOWBALL_FIGHT_DEBUG__;
    }
  }

  private generateProceduralMap(width: number, height: number, isTwoPlayer: boolean): void {
    const archetypes = [
      'Twin Snow Forts',
      'Pine Forest',
      'Igloo Village',
      'Glacier Ridge'
    ];
    this.currentMapName = archetypes[Math.floor(Math.random() * archetypes.length)];

    this.blocks = [];
    this.trees = [];

    const cx = width / 2;
    const cy = height / 2;
    let blockId = 0;

    if (this.currentMapName === 'Twin Snow Forts') {
      const fortOffsets = isTwoPlayer
        ? [
            { x: cx - 110, y: cy - 70 },
            { x: cx - 110, y: cy + 70 },
            { x: cx + 110, y: cy - 70 },
            { x: cx + 110, y: cy + 70 },
            { x: cx - 160, y: cy },
            { x: cx + 160, y: cy }
          ]
        : [
            { x: cx - 120, y: cy - 60 },
            { x: cx + 120, y: cy - 60 },
            { x: cx - 120, y: cy + 60 },
            { x: cx + 120, y: cy + 60 },
            { x: cx, y: cy - 110 },
            { x: cx, y: cy + 110 }
          ];

      fortOffsets.forEach((pt) => {
        this.blocks.push({
          id: blockId++,
          x: pt.x - 22,
          y: pt.y - 22,
          w: 44,
          h: 44,
          hp: 2,
          maxHp: 2
        });
      });

      this.trees.push({ x: cx, y: cy, radius: 26 });
      this.trees.push({ x: cx, y: cy - 140, radius: 22 });
      this.trees.push({ x: cx, y: cy + 140, radius: 22 });
    } else if (this.currentMapName === 'Pine Forest') {
      const treeCoords = [
        { x: cx - 90, y: cy - 80 },
        { x: cx + 90, y: cy + 80 },
        { x: cx - 90, y: cy + 80 },
        { x: cx + 90, y: cy - 80 },
        { x: cx, y: cy },
        { x: cx - 180, y: cy },
        { x: cx + 180, y: cy }
      ];
      treeCoords.forEach((t) => {
        this.trees.push({ x: t.x, y: t.y, radius: 24 });
      });

      const blockCoords = [
        { x: cx, y: cy - 100 },
        { x: cx, y: cy + 100 },
        { x: cx - 50, y: cy },
        { x: cx + 50, y: cy }
      ];
      blockCoords.forEach((b) => {
        this.blocks.push({
          id: blockId++,
          x: b.x - 20,
          y: b.y - 20,
          w: 40,
          h: 40,
          hp: 2,
          maxHp: 2
        });
      });
    } else if (this.currentMapName === 'Igloo Village') {
      this.trees.push({ x: cx - 140, y: cy - 110, radius: 20 });
      this.trees.push({ x: cx + 140, y: cy - 110, radius: 20 });
      this.trees.push({ x: cx - 140, y: cy + 110, radius: 20 });
      this.trees.push({ x: cx + 140, y: cy + 110, radius: 20 });

      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
        const bx = cx + Math.cos(angle) * 85;
        const by = cy + Math.sin(angle) * 75;
        this.blocks.push({
          id: blockId++,
          x: bx - 18,
          y: by - 18,
          w: 36,
          h: 36,
          hp: 2,
          maxHp: 2
        });
      }
    } else {
      // Glacier Ridge
      const rowY = [cy - 90, cy, cy + 90];
      rowY.forEach((ry) => {
        this.blocks.push({
          id: blockId++,
          x: cx - 75 - 20,
          y: ry - 20,
          w: 40,
          h: 40,
          hp: 2,
          maxHp: 2
        });
        this.blocks.push({
          id: blockId++,
          x: cx + 75 - 20,
          y: ry - 20,
          w: 40,
          h: 40,
          hp: 2,
          maxHp: 2
        });
      });
      this.trees.push({ x: cx, y: cy - 140, radius: 24 });
      this.trees.push({ x: cx, y: cy + 140, radius: 24 });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastWidth = width;
    this.lastHeight = height;
    this.animTimer += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    const isSuddenDeath = this.roundTimer <= 15;

    // Trigger sudden death alert once
    if (isSuddenDeath && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.suddenDeathTimer = 3.0;
      this.audio.playBoost();
      this.particles.shake(0.5);
      this.particles.showFloatingText('❄️ SUDDEN DEATH BLIZZARD! ❄️', width / 2, height / 2 - 30, '#FACC15', 30);
    }

    if (this.suddenDeathTimer > 0) {
      this.suddenDeathTimer = Math.max(0, this.suddenDeathTimer - dt);
    }

    // Dynamic Blizzard Wind flakes
    const windSpeedFactor = isSuddenDeath ? 1.9 : 1.0;
    for (const flake of this.ambientFlakes) {
      flake.y += flake.vy * windSpeedFactor * dt;
      flake.x += flake.vx * windSpeedFactor * dt;
      if (flake.y > height) {
        flake.y = -10;
        flake.x = Math.random() * width;
      }
    }

    // Determine Underdog status (alive player with lowest HP or lowest score if tied)
    const activeAlive = this.getActivePlayers().filter((p) => this.playersState.get(p.id)?.alive);
    if (activeAlive.length > 1) {
      let minHp = 999;
      let minScore = 999999;
      for (const p of activeAlive) {
        const ps = this.playersState.get(p.id)!;
        if (ps.hp < minHp) {
          minHp = ps.hp;
          minScore = ps.score;
        } else if (ps.hp === minHp && ps.score < minScore) {
          minScore = ps.score;
        }
      }

      // Check max HP among alive
      const maxHp = Math.max(...activeAlive.map((p) => this.playersState.get(p.id)!.hp));

      for (const p of this.getActivePlayers()) {
        const ps = this.playersState.get(p.id);
        if (!ps) continue;
        // Underdog triggers if player is behind by at least 1 HP, or 200 pts behind when tied
        ps.isUnderdog = ps.alive && (maxHp - ps.hp >= 1);
      }
    } else {
      for (const ps of this.playersState.values()) {
        ps.isUnderdog = false;
      }
    }

    this.syncDebug();

    // Process Bot AI
    this.updateBots(dt, width, height);

    // Update active players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps || !ps.alive) continue;

      if (ps.throwCooldown > 0) {
        ps.throwCooldown = Math.max(0, ps.throwCooldown - dt);
      }

      if (ps.recentScoreTimer > 0) {
        ps.recentScoreTimer = Math.max(0, ps.recentScoreTimer - dt);
      }

      if (ps.stunTimer > 0) {
        ps.stunTimer = Math.max(0, ps.stunTimer - dt);
        ps.isCharging = false;
        ps.chargePower = 0;
        ps.chargeTime = 0;
        continue;
      }

      // Read directional and action inputs
      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isAction = this.input.isActionPressed(p.id);
      const isPressed = this.input.isPressed(p.id) || isAction;

      const hasMoveInput = Math.abs(steer) > 0.08 || Math.abs(throttle) > 0.08;

      // Underdog Thermal Coat + Quick-Pack Mittens boost speed by 20%
      const speedMultiplier = ps.isUnderdog ? 1.20 : 1.0;

      if (!ps.isCharging) {
        if (hasMoveInput) {
          const speed = 210 * speedMultiplier;
          ps.vx = steer * speed;
          ps.vy = -throttle * speed;
        } else {
          ps.vx *= 0.82;
          ps.vy *= 0.82;
        }

        // Automatic gentle sweep so player always has a dynamic target cone
        ps.aimAngle += ps.sweepDir * 1.8 * dt;
        if (ps.aimAngle > ps.maxAimAngle) {
          ps.aimAngle = ps.maxAimAngle;
          ps.sweepDir = -1;
        } else if (ps.aimAngle < ps.minAimAngle) {
          ps.aimAngle = ps.minAimAngle;
          ps.sweepDir = 1;
        }
      } else {
        // While charging: slow down foot movement, and allow steer to adjust aim angle directly
        if (hasMoveInput) {
          const chargeSpeed = 75 * speedMultiplier;
          ps.vx = steer * chargeSpeed;
          ps.vy = -throttle * chargeSpeed;
          ps.aimAngle += steer * 2.4 * dt;
        } else {
          ps.vx *= 0.85;
          ps.vy *= 0.85;
        }
        // Clamp aim angle
        ps.aimAngle = Math.max(ps.minAimAngle, Math.min(ps.maxAimAngle, ps.aimAngle));
      }

      // Handle power charging & throwing
      // Underdog Quick-Pack Mittens: base charge starts at 0.50! Sudden Death increases charge speed by 35%
      const baseCharge = ps.isUnderdog ? 0.50 : 0.20;
      const chargeSpeedRamp = isSuddenDeath ? 1.35 : 1.0;

      if (isPressed && ps.throwCooldown <= 0) {
        if (!ps.isCharging) {
          ps.isCharging = true;
          ps.chargeTime = 0;
          ps.chargePower = baseCharge;
        } else {
          ps.chargeTime += dt * chargeSpeedRamp;
          const ramp = ps.chargeTime / 0.95;
          if (ramp <= 1.0) {
            ps.chargePower = baseCharge + ramp * (1.0 - baseCharge);
          } else {
            // Oscillate smoothly near peak power
            ps.chargePower = 0.875 + Math.sin((ramp - 1.0) * Math.PI * 3) * 0.125;
          }
        }
      } else if (ps.isCharging) {
        // Button released: FIRE SNOWBALL!
        this.throwSnowball(ps, isSuddenDeath);
        ps.isCharging = false;
        ps.chargePower = 0;
        ps.chargeTime = 0;
        ps.throwCooldown = isSuddenDeath ? 0.24 : 0.35;
      }

      // Apply velocity
      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Strict Boundary Constraints: Player CANNOT cross center border!
      const r = 16;
      const borderGap = 20;
      const wallPadding = 24;
      const topPadding = 56;
      const bottomPadding = 48; // keep clear of bottom pill & hints

      const midX = width / 2;
      const midY = height / 2;

      if (ps.side === 'west') {
        ps.x = Math.max(wallPadding, Math.min(midX - borderGap - r, ps.x));
        ps.y = Math.max(topPadding, Math.min(height - bottomPadding, ps.y));
      } else if (ps.side === 'east') {
        ps.x = Math.max(midX + borderGap + r, Math.min(width - wallPadding, ps.x));
        ps.y = Math.max(topPadding, Math.min(height - bottomPadding, ps.y));
      } else if (ps.side === 'nw') {
        ps.x = Math.max(wallPadding, Math.min(midX - borderGap - r, ps.x));
        ps.y = Math.max(topPadding, Math.min(midY - borderGap - r, ps.y));
      } else if (ps.side === 'ne') {
        ps.x = Math.max(midX + borderGap + r, Math.min(width - wallPadding, ps.x));
        ps.y = Math.max(topPadding, Math.min(midY - borderGap - r, ps.y));
      } else if (ps.side === 'sw') {
        ps.x = Math.max(wallPadding, Math.min(midX - borderGap - r, ps.x));
        ps.y = Math.max(midY + borderGap + r, Math.min(height - bottomPadding, ps.y));
      } else if (ps.side === 'se') {
        ps.x = Math.max(midX + borderGap + r, Math.min(width - wallPadding, ps.x));
        ps.y = Math.max(midY + borderGap + r, Math.min(height - bottomPadding, ps.y));
      }

      // Block collisions
      for (const block of this.blocks) {
        const closestX = Math.max(block.x, Math.min(ps.x, block.x + block.w));
        const closestY = Math.max(block.y, Math.min(ps.y, block.y + block.h));
        const dx = ps.x - closestX;
        const dy = ps.y - closestY;
        const dist = Math.hypot(dx, dy);
        if (dist < r) {
          if (dist > 0.01) {
            ps.x = closestX + (dx / (dist || 0.001)) * r;
            ps.y = closestY + (dy / (dist || 0.001)) * r;
          } else {
            ps.x += (ps.x < midX ? -1 : 1) * 2;
          }
        }
      }

      // Pine tree collisions
      for (const tree of this.trees) {
        const d = Math.hypot(ps.x - tree.x, ps.y - tree.y);
        if (d < tree.radius + r && d > 0.01) {
          const nx = (ps.x - tree.x) / d;
          const ny = (ps.y - tree.y) / d;
          ps.x = tree.x + nx * (tree.radius + r);
          ps.y = tree.y + ny * (tree.radius + r);
        }
      }
    }

    // Update Snowballs
    for (let i = this.snowballs.length - 1; i >= 0; i--) {
      const b = this.snowballs[i];
      b.life += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.vz -= this.gravity * dt;

      // Golden snowball trail particles
      if (b.isGolden && Math.random() < 0.4) {
        this.particles.spawnExplosion(b.x, b.y - b.z, '#FACC15', 3);
      }

      let collided = false;

      // Check collision with trees
      for (const tree of this.trees) {
        const d = Math.hypot(b.x - tree.x, b.y - tree.y);
        if (d < tree.radius + b.radius && b.z < 35) {
          this.audio.playSnowSplat();
          this.particles.spawnExplosion(b.x, b.y, '#FFFFFF', 14);
          this.addSnowDecal(b.x, b.y);
          collided = true;
          break;
        }
      }

      // Check collision with SnowFortBlocks
      if (!collided) {
        for (let bi = this.blocks.length - 1; bi >= 0; bi--) {
          const block = this.blocks[bi];
          if (
            b.x >= block.x &&
            b.x <= block.x + block.w &&
            b.y >= block.y &&
            b.y <= block.y + block.h &&
            b.z < 32
          ) {
            const damage = b.isGolden ? 2 : 1;
            block.hp -= damage;
            this.audio.playSnowSplat();
            this.particles.spawnExplosion(b.x, b.y, '#E2E8F0', b.isGolden ? 22 : 16);
            if (block.hp <= 0) {
              this.particles.spawnExplosion(
                block.x + block.w / 2,
                block.y + block.h / 2,
                '#CBD5E1',
                28
              );
              this.blocks.splice(bi, 1);
            }
            collided = true;
            break;
          }
        }
      }

      // Check collision with Players (ball near ground level z < 28)
      if (!collided && b.z < 28) {
        for (const p of this.getActivePlayers()) {
          const ps = this.playersState.get(p.id);
          if (!ps || !ps.alive || ps.id === b.ownerId) continue;

          const dist = Math.hypot(b.x - ps.x, b.y - ps.y);
          if (dist < 26) {
            // Hit player!
            const damage = b.isGolden ? 2 : 1;
            ps.hp -= damage;

            // Underdog Thermal Coat: Halves stun timer
            ps.stunTimer = ps.isUnderdog ? 0.50 : 1.10;

            // Knockback
            const pushAngle = Math.atan2(b.vy, b.vx);
            const knockForce = b.isGolden ? 8.5 : 5.5;
            const knockMult = ps.isUnderdog ? 0.70 : 1.0;
            ps.vx = Math.cos(pushAngle) * knockForce * knockMult;
            ps.vy = Math.sin(pushAngle) * knockForce * knockMult;

            // Give shooter points & streak
            const shooter = this.playersState.get(b.ownerId);
            if (shooter) {
              shooter.streak = Math.min(3, shooter.streak + 1);
              const multiplier = shooter.streak;
              const basePoints = b.isGolden ? 250 : 100;
              const awarded = basePoints * multiplier;
              shooter.score += awarded;
              shooter.recentScoreTimer = 1.2;

              if (multiplier > 1) {
                this.particles.showFloatingText(
                  `🔥 ${multiplier}X STREAK! +${awarded}`,
                  shooter.x,
                  shooter.y - 40,
                  '#FACC15',
                  24
                );
              } else {
                this.particles.showFloatingText(
                  `+${awarded}`,
                  shooter.x,
                  shooter.y - 36,
                  '#FFFFFF',
                  20
                );
              }
            }

            this.audio.playSnowSplat();
            this.audio.playStun();
            this.particles.shake(b.isGolden ? 0.45 : 0.32);
            this.particles.spawnExplosion(ps.x, ps.y, p.color, b.isGolden ? 32 : 24);
            this.particles.showFloatingText(b.isGolden ? '💥 MEGA SPLAT!' : 'SPLAT!', ps.x, ps.y - 24, p.color, 22);
            this.addSnowDecal(ps.x, ps.y, b.isGolden ? '#FEF08A' : undefined);

            if (ps.hp <= 0) {
              ps.alive = false;
              ps.streak = 0;
              this.destructionOrder.push(ps.id);
              this.particles.spawnExplosion(ps.x, ps.y, '#FFFFFF', 32);
              this.particles.showFloatingText('OUT! ⛄', ps.x, ps.y - 30, '#EF4444', 26);
            }

            collided = true;
            break;
          }
        }
      }

      // Ground landing
      if (!collided && b.z <= 0) {
        this.audio.playSnowSplat();
        this.particles.spawnExplosion(b.x, b.y, b.isGolden ? '#FACC15' : '#F1F5F9', b.isGolden ? 16 : 10);
        this.addSnowDecal(b.x, b.y, b.isGolden ? '#FEF08A' : undefined);
        collided = true;
      }

      // Boundary check or collided
      if (collided || b.x < -40 || b.x > width + 40 || b.y < -40 || b.y > height + 40) {
        this.snowballs.splice(i, 1);
      }
    }

    // Check round over condition
    const alivePlayers = Array.from(this.playersState.values()).filter((p) => p.alive);
    if (alivePlayers.length <= 1 || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private throwSnowball(ps: SnowballPlayer, isSuddenDeath: boolean): void {
    const isGolden = isSuddenDeath && ps.chargePower >= 0.85;

    // Horizontal speed scales from 260 to 680 based on power
    const speed = 260 + ps.chargePower * 420;
    const vx = Math.cos(ps.aimAngle) * speed;
    const vy = Math.sin(ps.aimAngle) * speed;

    // Vertical launch speed scales with power
    const vz = 170 + ps.chargePower * 270;

    // Spawn point in front of player
    const spawnX = ps.x + Math.cos(ps.aimAngle) * 24;
    const spawnY = ps.y + Math.sin(ps.aimAngle) * 24;

    this.totalSnowballsThrown++;
    this.snowballs.push({
      id: this.ballCounter++,
      ownerId: ps.id,
      x: spawnX,
      y: spawnY,
      z: 14,
      vx,
      vy,
      vz,
      radius: isGolden ? 12 : 7,
      power: ps.chargePower,
      life: 0,
      isGolden
    });

    if (isGolden) {
      this.audio.playBoost();
      this.particles.spawnExplosion(spawnX, spawnY, '#FACC15', 12);
      this.particles.showFloatingText('⭐ GOLDEN SHOT!', ps.x, ps.y - 36, '#FACC15', 20);
    } else {
      this.audio.playWhoosh();
      this.particles.spawnExplosion(spawnX, spawnY, '#FFFFFF', 6);
    }
  }

  private addSnowDecal(x: number, y: number, color?: string): void {
    if (this.decals.length > 35) {
      this.decals.shift();
    }
    this.decals.push({
      x,
      y,
      radius: 12 + Math.random() * 10,
      alpha: 0.6,
      color
    });
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    const theme = THEME_CONFIGS.find((t) => t.id === this.mapTheme) || THEME_CONFIGS[0];

    // Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(0.5, theme.bgGradMid);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Arctic Aurora Ribbon Effect
    if (this.mapTheme === 'aurora') {
      ctx.save();
      ctx.globalAlpha = 0.28;
      const t = this.animTimer * 1.5;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.25);
      for (let x = 0; x <= width; x += 40) {
        const y = height * 0.25 + Math.sin(x * 0.008 + t) * 35 + Math.cos(x * 0.015 - t * 0.8) * 20;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      const auroraGrad = ctx.createLinearGradient(0, 0, 0, height * 0.4);
      auroraGrad.addColorStop(0, 'rgba(52, 211, 153, 0.4)');
      auroraGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
      ctx.fillStyle = auroraGrad;
      ctx.fill();
      ctx.restore();
    }

    // Arena boundary lines
    ctx.strokeStyle = `${theme.borderColor}55`;
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 16, width - 32, height - 32);

    // Center Ice Dividing Border (Players cannot cross!)
    const isTwoPlayer = this.getActivePlayers().length === 2;
    const midX = width / 2;
    const midY = height / 2;

    // Glowing Frost Zone Strip
    ctx.fillStyle = `${theme.borderColor}22`;
    if (isTwoPlayer) {
      ctx.fillRect(midX - 16, 16, 32, height - 32);
    } else {
      ctx.fillRect(midX - 16, 16, 32, height - 32);
      ctx.fillRect(16, midY - 16, width - 32, 32);
    }

    // Dashed Boundary Lines
    ctx.save();
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);

    ctx.beginPath();
    ctx.moveTo(midX, 20);
    ctx.lineTo(midX, height - 20);
    ctx.stroke();

    if (!isTwoPlayer) {
      ctx.beginPath();
      ctx.moveTo(20, midY);
      ctx.lineTo(width - 20, midY);
      ctx.stroke();
    }
    ctx.restore();

    // Boundary Ice Stakes along divider
    const stakeSpacing = 48;
    const startY = 40;
    for (let sy = startY; sy <= height - 35; sy += stakeSpacing) {
      ctx.save();
      ctx.translate(midX, sy);
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fillStyle = theme.snowColor;
      ctx.fill();
      ctx.strokeStyle = theme.borderColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-2, -3, 3, 3);
      ctx.restore();
    }

    // Center Medallion
    ctx.beginPath();
    ctx.arc(midX, midY, 24, 0, Math.PI * 2);
    ctx.fillStyle = `${theme.pillColor}44`;
    ctx.fill();
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('❄️', midX, midY);

    // Proximity barrier glow
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps || !ps.alive) continue;
      const distToBorder = Math.abs(ps.x - midX);
      if (distToBorder < 40) {
        const alpha = Math.max(0, (40 - distToBorder) / 40) * 0.45;
        ctx.fillStyle = `${theme.borderColor}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
        ctx.beginPath();
        ctx.ellipse(midX, ps.y, 8, 22, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Render Snow Splat Decals
    for (const decal of this.decals) {
      ctx.beginPath();
      ctx.arc(decal.x, decal.y, decal.radius, 0, Math.PI * 2);
      ctx.fillStyle = decal.color || `rgba(255, 255, 255, ${decal.alpha})`;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)';
      ctx.stroke();
    }

    // Render Snow Fort Blocks
    for (const block of this.blocks) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
      ctx.fillRect(block.x + 3, block.y + 4, block.w, block.h);

      ctx.fillStyle = block.hp === 2 ? theme.snowColor : '#94A3B8';
      ctx.fillRect(block.x, block.y, block.w, block.h);

      ctx.strokeStyle = theme.borderColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(block.x, block.y, block.w, block.h);

      if (block.hp < block.maxHp) {
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(block.x + 8, block.y + 6);
        ctx.lineTo(block.x + block.w - 12, block.y + block.h - 8);
        ctx.stroke();
      } else {
        ctx.strokeStyle = `${theme.borderColor}88`;
        ctx.lineWidth = 1;
        ctx.strokeRect(block.x + 4, block.y + 4, block.w - 8, block.h - 8);
      }
    }

    // Render Pine Trees
    for (const tree of this.trees) {
      ctx.beginPath();
      ctx.ellipse(tree.x + 4, tree.y + 6, tree.radius * 1.1, tree.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.fill();

      const tiers = [
        { r: tree.radius, color: theme.treeColors[0], yOffset: 0 },
        { r: tree.radius * 0.75, color: theme.treeColors[1], yOffset: -8 },
        { r: tree.radius * 0.5, color: theme.treeColors[2], yOffset: -16 }
      ];

      for (const t of tiers) {
        ctx.beginPath();
        ctx.arc(tree.x, tree.y + t.yOffset, t.r, 0, Math.PI * 2);
        ctx.fillStyle = t.color;
        ctx.fill();
        ctx.strokeStyle = '#064E3B';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Snow cap
        ctx.beginPath();
        ctx.arc(tree.x, tree.y + t.yOffset - 3, t.r * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = theme.snowColor;
        ctx.fill();
      }
    }

    // Render Ballistic Snowball Shadows
    for (const b of this.snowballs) {
      const shadowScale = Math.max(0.4, 1 - b.z / 180);
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.radius * shadowScale * 1.3, b.radius * shadowScale * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = b.isGolden ? 'rgba(234, 179, 8, 0.45)' : 'rgba(15, 23, 42, 0.35)';
      ctx.fill();
    }

    // Render Players & Bases
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      // Base footprint ring
      ctx.beginPath();
      ctx.arc(ps.baseX, ps.baseY, 32, 0, Math.PI * 2);
      ctx.strokeStyle = `${p.color}55`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (!ps.alive) {
        // Player eliminated: Render Comical Decorated Snowman
        this.renderSnowman(ctx, ps.x, ps.y, p.color);
        continue;
      }

      // Underdog Thermal Coat Golden Aura
      if (ps.isUnderdog) {
        ctx.save();
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(ps.x, ps.y, 24, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#F59E0B';
        ctx.font = '900 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SURGE 🔥', ps.x, ps.y + 32);
        ctx.restore();
      }

      // Context-aware Character Mood
      let mood: CharacterMood = 'idle';
      if (ps.stunTimer > 0) {
        mood = 'shocked';
      } else if (ps.isCharging) {
        mood = 'focused';
      } else if (ps.recentScoreTimer > 0 || ps.streak >= 2) {
        mood = 'triumph';
      } else if (ps.hp === ps.maxHp) {
        mood = 'happy';
      }

      const isBot = p.type.startsWith('bot_');

      // Mascot Avatar via CharacterRenderer
      ctx.save();
      ctx.translate(ps.x, ps.y);
      drawCharacter(ctx, 0, 0, 18, p.id, isBot, mood, this.animTimer * 3);
      ctx.restore();

      // Stun flurry
      if (ps.stunTimer > 0) {
        const stunAngle = performance.now() * 0.008;
        for (let s = 0; s < 3; s++) {
          const a = stunAngle + (s * Math.PI * 2) / 3;
          const sx = ps.x + Math.cos(a) * 18;
          const sy = ps.y - 18 + Math.sin(a) * 6;
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#FBBF24';
          ctx.fill();
        }
      }

      // Draw Aim Trajectory & Power Meter
      this.renderPlayerAimAndPower(ctx, ps, p.color);

      // Player Hearts above head
      this.renderHearts(ctx, ps.x, ps.y - 28, ps.hp, ps.maxHp);
    }

    // Render Ballistic Snowballs (elevated by z)
    for (const b of this.snowballs) {
      const renderY = b.y - b.z;
      const sizeBonus = Math.min(6, b.z / 25);
      const drawRadius = b.radius + sizeBonus;

      ctx.save();
      if (b.isGolden) {
        ctx.shadowColor = '#FACC15';
        ctx.shadowBlur = 14;
      }

      ctx.beginPath();
      ctx.arc(b.x, renderY, drawRadius, 0, Math.PI * 2);
      ctx.fillStyle = b.isGolden ? '#FEF08A' : theme.snowColor;
      ctx.fill();
      ctx.lineWidth = b.isGolden ? 2 : 1.5;
      ctx.strokeStyle = b.isGolden ? '#EAB308' : '#93C5FD';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(b.x - drawRadius * 0.35, renderY - drawRadius * 0.35, drawRadius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();
      ctx.restore();
    }

    // Ambient Falling Snow
    ctx.fillStyle = theme.snowColor;
    for (const flake of this.ambientFlakes) {
      ctx.globalAlpha = flake.alpha;
      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Center HUD Pod at y = 56
    this.renderCenterHudPod(ctx, width);

    // Interactive Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
    this.renderThemePill(ctx, height, theme);

    // Control Hints (Right-aligned)
    this.renderControlHints(ctx, width, height);

    ctx.restore();
  }

  private renderPlayerAimAndPower(ctx: CanvasRenderingContext2D, ps: SnowballPlayer, color: string): void {
    const aimLen = 38;
    const ax = ps.x + Math.cos(ps.aimAngle) * aimLen;
    const ay = ps.y + Math.sin(ps.aimAngle) * aimLen;

    ctx.strokeStyle = color;
    ctx.lineWidth = ps.isCharging ? 3.5 : 2;
    ctx.beginPath();
    ctx.moveTo(ps.x + Math.cos(ps.aimAngle) * 16, ps.y + Math.sin(ps.aimAngle) * 16);
    ctx.lineTo(ax, ay);
    ctx.stroke();

    const arrowAngle = ps.aimAngle;
    const arrowHeadLen = 9;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(
      ax - arrowHeadLen * Math.cos(arrowAngle - Math.PI / 6),
      ay - arrowHeadLen * Math.sin(arrowAngle - Math.PI / 6)
    );
    ctx.lineTo(
      ax - arrowHeadLen * Math.cos(arrowAngle + Math.PI / 6),
      ay - arrowHeadLen * Math.sin(arrowAngle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();

    if (ps.isCharging) {
      const predictedRange = 120 + ps.chargePower * 280;
      const stepCount = 5;
      ctx.save();
      for (let s = 1; s <= stepCount; s++) {
        const dist = (predictedRange * s) / stepCount;
        const px = ps.x + Math.cos(ps.aimAngle) * dist;
        const py = ps.y + Math.sin(ps.aimAngle) * dist;
        const dotAlpha = (s / stepCount) * 0.75;

        ctx.beginPath();
        ctx.arc(px, py, 2.5 + (s === stepCount ? 2 : 0), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239, 68, 68, ${dotAlpha})`;
        ctx.fill();
      }

      const barW = 44;
      const barH = 6;
      const barX = ps.x - barW / 2;
      const barY = ps.y - 36;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

      const pGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
      pGrad.addColorStop(0, '#22C55E');
      pGrad.addColorStop(0.6, '#FBBF24');
      pGrad.addColorStop(1, '#EF4444');
      ctx.fillStyle = pGrad;
      ctx.fillRect(barX, barY, barW * ps.chargePower, barH);

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);

      ctx.restore();
    }
  }

  private renderSnowman(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    ctx.beginPath();
    ctx.arc(x, y + 6, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y - 10, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(x - 4, y - 13, 2.5, 2.5);
    ctx.fillRect(x + 2, y - 13, 2.5, 2.5);
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.moveTo(x - 1, y - 9);
    ctx.lineTo(x + 5, y - 8);
    ctx.lineTo(x - 1, y - 7);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.fillRect(x - 10, y - 2, 20, 5);
    ctx.fillRect(x + 2, y + 1, 5, 10);
  }

  private renderHearts(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    hp: number,
    maxHp: number
  ): void {
    const spacing = 12;
    const startX = x - ((maxHp - 1) * spacing) / 2;

    for (let i = 0; i < maxHp; i++) {
      const hx = startX + i * spacing;
      const isFilled = i < hp;

      ctx.beginPath();
      ctx.arc(hx, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = isFilled ? '#EF4444' : '#CBD5E1';
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  private renderCenterHudPod(ctx: CanvasRenderingContext2D, width: number): void {
    const podW = 360;
    const podH = 26;
    const podX = width / 2 - podW / 2;
    const podY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 13);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Map Name Badge
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(`❄️ ${this.currentMapName.toUpperCase()}`, podX + 16, podY + podH / 2);

    // Sudden death or sub-status in center
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    if (this.roundTimer <= 15) {
      ctx.fillStyle = '#FACC15';
      ctx.fillText('⚡ BLIZZARD OVERDRIVE', width / 2, podY + podH / 2);
    } else {
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('ARTILLERY SNOW FORT DUEL', width / 2, podY + podH / 2);
    }

    // Player Status Mini-Dots on Right
    ctx.textAlign = 'right';
    let dotX = podX + podW - 16;
    const active = this.getActivePlayers();
    for (let i = active.length - 1; i >= 0; i--) {
      const p = active[i];
      const ps = this.playersState.get(p.id);
      const isAlive = ps ? ps.alive : false;

      ctx.beginPath();
      ctx.arc(dotX, podY + podH / 2, 5, 0, Math.PI * 2);
      ctx.fillStyle = isAlive ? p.color : '#64748B';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();

      dotX -= 14;
    }
  }

  private renderThemePill(ctx: CanvasRenderingContext2D, height: number, theme: ThemeConfig): void {
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();

    ctx.strokeStyle = theme.pillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(theme.name, pillX + 14, pillY + pillH / 2);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('[T]', pillX + pillW - 12, pillY + pillH / 2);
    ctx.restore();
  }

  private renderControlHints(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText('Hold: Charge Throw | Release: Fire | Steer: Aim & Walk', width - 24, height - 28);
    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();

    const survivors = active
      .filter((p) => this.playersState.get(p.id)?.alive)
      .sort((a, b) => {
        const sa = this.playersState.get(a.id)!;
        const sb = this.playersState.get(b.id)!;
        if (sb.hp !== sa.hp) return sb.hp - sa.hp;
        return sb.score - sa.score;
      });

    const eliminated = this.destructionOrder
      .slice()
      .reverse()
      .map((id) => active.find((p) => p.id === id)!)
      .filter(Boolean);

    const fullOrder = [...survivors, ...eliminated];

    const rankings = fullOrder.map((p, idx) => ({
      playerId: p.id,
      score: this.playersState.get(p.id)?.score ?? 0,
      place: idx + 1
    }));

    const winnerId = fullOrder.length > 0 ? fullOrder[0].id : null;
    const winnerName = active.find((p) => p.id === winnerId)?.name ?? 'Player';

    return {
      winnerId,
      rankings,
      mvpHighlight: `${winnerName} ruled the snowball arena with master artillery accuracy!`
    };
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || !ps.alive || ps.stunTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    const enemies = this.getActivePlayers()
      .filter((p) => p.id !== botId && this.playersState.get(p.id)?.alive)
      .map((p) => this.playersState.get(p.id)!);

    if (enemies.length === 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // Sort by proximity
    enemies.sort((a, b) => Math.hypot(a.x - ps.x, a.y - ps.y) - Math.hypot(b.x - ps.x, b.y - ps.y));
    const target = enemies[0];

    // Compute tactical movement target position on bot's territory
    let idealX = ps.baseX;
    let idealY = target.y + Math.sin(performance.now() * 0.0025 + botId) * 60;

    const midX = width / 2;
    if (ps.side === 'west') {
      idealX = Math.max(50, Math.min(midX - 55, width * 0.28));
    } else if (ps.side === 'east') {
      idealX = Math.max(midX + 55, Math.min(width - 50, width * 0.72));
    }

    // Dodge incoming snowballs
    for (const b of this.snowballs) {
      if (b.ownerId !== botId) {
        const d = Math.hypot(b.x - ps.x, b.y - ps.y);
        if (d < 150) {
          const dodgeDir = b.y > ps.y ? -1 : 1;
          idealY = ps.y + dodgeDir * 80;
          break;
        }
      }
    }

    idealY = Math.max(65, Math.min(height - 55, idealY));

    const moveX = Math.max(-1, Math.min(1, (idealX - ps.x) / 35));
    const moveY = Math.max(-1, Math.min(1, (idealY - ps.y) / 35));
    const navThrottle = -moveY;

    const dx = target.x - ps.x;
    const dy = target.y - ps.y;
    const dist = Math.hypot(dx, dy);
    let targetAngle = Math.atan2(dy, dx);

    // Apply difficulty modifiers
    let aimTolerance = 0.22;
    let steerDir = 0;

    if (difficulty === 'bot_easy') {
      aimTolerance = 0.40;
      if (Math.random() < 0.04) {
        this.input.setBotInput(botId, false, moveX * 0.5, navThrottle * 0.5, false);
        return;
      }
    } else if (difficulty === 'bot_hard') {
      aimTolerance = 0.08;
      if (target.vx !== 0 || target.vy !== 0) {
        const leadTime = dist / 460;
        targetAngle = Math.atan2(target.y + target.vy * leadTime - ps.y, target.x + target.vx * leadTime - ps.x);
      }
    }

    let angleDiff = targetAngle - ps.aimAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    if (Math.abs(angleDiff) > 0.08) {
      steerDir = angleDiff > 0 ? 1 : -1;
    }

    const rawPower = Math.min(1.0, Math.max(0.3, (dist - 80) / 370));
    const powerJitter =
      difficulty === 'bot_easy'
        ? (Math.random() - 0.5) * 0.22
        : difficulty === 'bot_normal'
        ? (Math.random() - 0.5) * 0.08
        : 0;
    const targetPower = Math.min(1.0, Math.max(0.28, rawPower + powerJitter));

    if (Math.abs(angleDiff) <= aimTolerance) {
      if (!ps.isCharging) {
        this.input.setBotInput(botId, true, steerDir, 0, true);
      } else {
        if (ps.chargePower >= targetPower) {
          this.input.setBotInput(botId, false, 0, 0, false);
        } else {
          this.input.setBotInput(botId, true, steerDir, 0, true);
        }
      }
    } else {
      if (ps.isCharging) {
        this.input.setBotInput(botId, true, steerDir, 0, true);
      } else {
        this.input.setBotInput(botId, false, moveX, navThrottle, false);
      }
    }
  }
}
