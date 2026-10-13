import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type HighwayTheme = 'cyber' | 'farm' | 'metro';

export interface HighwayThemeConfig {
  id: HighwayTheme;
  name: string;
  bgColor: string;
  safeColor: string;
  roadColor: string;
  railColor: string;
  riverColor: string;
  pillColor: string;
  dividerColor: string;
}

export const THEME_CONFIGS: HighwayThemeConfig[] = [
  {
    id: 'cyber',
    name: 'Neon Cyberway ⚡',
    bgColor: '#050814',
    safeColor: '#0F172A',
    roadColor: '#090D1A',
    railColor: '#1E1B4B',
    riverColor: '#064E3B',
    pillColor: '#06B6D4',
    dividerColor: '#38BDF8'
  },
  {
    id: 'farm',
    name: 'Country Farmland 🌾',
    bgColor: '#064E3B',
    safeColor: '#166534',
    roadColor: '#334155',
    railColor: '#292524',
    riverColor: '#0284C7',
    pillColor: '#10B981',
    dividerColor: '#FBBF24'
  },
  {
    id: 'metro',
    name: 'Midnight Metro 🚇',
    bgColor: '#0B0F19',
    safeColor: '#1E293B',
    roadColor: '#18181B',
    railColor: '#3F3F46',
    riverColor: '#0E7490',
    pillColor: '#8B5CF6',
    dividerColor: '#A855F7'
  }
];

type LaneType = 'SAFE' | 'ROAD' | 'RAIL' | 'RIVER';

interface Lane {
  index: number;
  y: number;
  height: number;
  type: LaneType;
  speed: number;
  color: string;
  entities: LaneEntity[];
  railWarning?: number;
  trainActive?: boolean;
}

interface LaneEntity {
  x: number;
  width: number;
  height: number;
  speed: number;
  color: string;
  type: 'car' | 'truck' | 'train' | 'log' | 'lilypad';
}

interface GoldenBonusItem {
  laneIndex: number;
  x: number;
  y: number;
  collected: boolean;
}

interface HopperPlayer {
  id: PlayerId;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  laneIndex: number;
  colIndex: number;
  maxLaneReached: number;
  isHopping: boolean;
  hopProgress: number; // 0 to 1
  hopStartX: number;
  hopStartY: number;
  score: number;
  lives: number;
  maxLives: number;
  invulnTimer: number;
  squishScaleX: number;
  squishScaleY: number;
  alive: boolean;
  hasFinished: boolean;
  onLogSpeed: number;
  botDecisionTimer: number;
  lastRawThrottle: number;
  lastRawSteer: number;
  inputRepeatTimer: number;
  hopStreak: number;
  streakTimer: number;
  isUnderdog: boolean;
  hasShield: boolean;
  shoveCooldown: number;
}

export class HighwayHopGame extends BaseGame {
  private playersState: Map<PlayerId, HopperPlayer> = new Map();
  private lanes: Lane[] = [];
  private currentMapName: string = 'Neon City Freeway';
  private laneHeight: number = 38;
  private totalLanes: number = 14;
  private columnCount: number = 18;
  private colWidth: number = 44;
  private arenaOffsetY: number = 88;
  private finishOrder: PlayerId[] = [];
  private goldenItems: GoldenBonusItem[] = [];

  // Theme & Layout Controls
  public mapTheme: HighwayTheme = 'cyber';
  private lastWidth: number = 960;
  private lastHeight: number = 540;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private suddenDeathAnnounced: boolean = false;
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
    this.isFinished = false;
    this.roundTimer = 45;
    this.finishOrder = [];
    this.goldenItems = [];
    this.suddenDeathAnnounced = false;
    this.animTimer = 0;

    this.arenaOffsetY = 84;
    this.laneHeight = Math.max(34, Math.floor((height - this.arenaOffsetY - 48) / this.totalLanes));
    this.colWidth = width / this.columnCount;

    this.generateProceduralMap(width, height);
    this.initPlayers(width);
    this.syncDebug();
  }

  public syncDebug(): void {
    if (typeof window !== 'undefined') {
      (window as any).__HIGHWAY_HOP_DEBUG__ = {
        players: Array.from(this.playersState.values()),
        lanes: this.lanes,
        roundTimer: this.roundTimer,
        isFinished: this.isFinished,
        finishOrder: this.finishOrder,
        theme: this.mapTheme,
        setTheme: (theme: HighwayTheme) => this.setMapTheme(theme),
        cycleTheme: () => this.cycleTheme(),
        attemptHop: (pid: PlayerId, dCol: number, dLane: number, width: number) => {
          const ps = this.playersState.get(pid);
          if (ps) this.attemptHop(ps, dCol, dLane, width);
        }
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

  public setMapTheme(theme: HighwayTheme): void {
    if (this.mapTheme === theme) return;
    this.mapTheme = theme;
    this.audio.playTap();
    this.particles.spawnExplosion(100, this.lastHeight - 28, '#38BDF8', 12);
    // Refresh lane colors for new theme
    this.applyThemeToLanes();
    this.syncDebug();
  }

  private applyThemeToLanes(): void {
    const curTheme = THEME_CONFIGS.find((t) => t.id === this.mapTheme) || THEME_CONFIGS[0];
    for (const lane of this.lanes) {
      if (lane.type === 'SAFE') {
        lane.color = lane.index === this.totalLanes - 1 ? '#059669' : curTheme.safeColor;
      } else if (lane.type === 'ROAD') {
        lane.color = curTheme.roadColor;
      } else if (lane.type === 'RAIL') {
        lane.color = curTheme.railColor;
      } else if (lane.type === 'RIVER') {
        lane.color = curTheme.riverColor;
      }
    }
  }

  private bindKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;
    this.unbindKeyboardShortcuts();

    this.keydownListener = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === '1') {
        this.setMapTheme('cyber');
      } else if (e.key === '2') {
        this.setMapTheme('farm');
      } else if (e.key === '3') {
        this.setMapTheme('metro');
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
    if (typeof window !== 'undefined' && (window as any).__HIGHWAY_HOP_DEBUG__) {
      delete (window as any).__HIGHWAY_HOP_DEBUG__;
    }
  }

  private initPlayers(width: number): void {
    this.playersState.clear();
    const active = this.getActivePlayers();
    const count = active.length;

    const lane0Y = this.arenaOffsetY + (this.totalLanes - 1) * this.laneHeight + this.laneHeight / 2;

    active.forEach((p, idx) => {
      const col = Math.floor(((idx + 1) * this.columnCount) / (count + 1));
      const px = (col + 0.5) * this.colWidth;
      const py = lane0Y;

      this.playersState.set(p.id, {
        id: p.id,
        x: px,
        y: py,
        targetX: px,
        targetY: py,
        laneIndex: 0,
        colIndex: col,
        maxLaneReached: 0,
        isHopping: false,
        hopProgress: 0,
        hopStartX: px,
        hopStartY: py,
        score: 0,
        lives: 3,
        maxLives: 3,
        invulnTimer: 1.0,
        squishScaleX: 1,
        squishScaleY: 1,
        alive: true,
        hasFinished: false,
        onLogSpeed: 0,
        botDecisionTimer: 0.2 + idx * 0.1,
        lastRawThrottle: 0,
        lastRawSteer: 0,
        inputRepeatTimer: 0,
        hopStreak: 0,
        streakTimer: 0,
        isUnderdog: false,
        hasShield: false,
        shoveCooldown: 0
      });
    });
  }

  private generateProceduralMap(width: number, height: number): void {
    const curTheme = THEME_CONFIGS.find((t) => t.id === this.mapTheme) || THEME_CONFIGS[0];
    const maps = [
      'Neon City Freeway',
      'Country Farmland',
      'Subway Rail Yard',
      'Amazon River Rapids'
    ];
    this.currentMapName = maps[Math.floor(Math.random() * maps.length)];
    this.lanes = [];

    for (let i = 0; i < this.totalLanes; i++) {
      const laneY = this.arenaOffsetY + (this.totalLanes - 1 - i) * this.laneHeight;
      let type: LaneType = 'SAFE';
      let speed = 0;
      let color = curTheme.safeColor;

      if (i === 0 || i === this.totalLanes - 1 || i === 4 || i === 8) {
        type = 'SAFE';
        color = i === this.totalLanes - 1 ? '#059669' : curTheme.safeColor;
      } else if (this.currentMapName === 'Neon City Freeway') {
        if (i <= 3) {
          type = 'ROAD';
          speed = (i % 2 === 0 ? 1 : -1) * (110 + i * 25);
          color = curTheme.roadColor;
        } else if (i === 5 || i === 6) {
          type = 'RAIL';
          speed = (i % 2 === 0 ? 1 : -1) * 380;
          color = curTheme.railColor;
        } else {
          type = 'RIVER';
          speed = (i % 2 === 0 ? 1 : -1) * (70 + (i - 8) * 15);
          color = curTheme.riverColor;
        }
      } else if (this.currentMapName === 'Subway Rail Yard') {
        if (i === 1 || i === 2 || i === 5 || i === 6 || i === 7) {
          type = 'RAIL';
          speed = (i % 2 === 0 ? 1 : -1) * 360;
          color = curTheme.railColor;
        } else if (i === 3) {
          type = 'ROAD';
          speed = 95;
          color = curTheme.roadColor;
        } else {
          type = 'RIVER';
          speed = (i % 2 === 0 ? 1 : -1) * 85;
          color = curTheme.riverColor;
        }
      } else if (this.currentMapName === 'Amazon River Rapids') {
        if (i === 1 || i === 2) {
          type = 'ROAD';
          speed = (i % 2 === 0 ? 1 : -1) * 100;
          color = curTheme.roadColor;
        } else {
          type = 'RIVER';
          speed = (i % 2 === 0 ? 1 : -1) * (100 + i * 18);
          color = curTheme.riverColor;
        }
      } else {
        if (i <= 3) {
          type = 'ROAD';
          speed = (i % 2 === 0 ? 1 : -1) * (90 + i * 20);
          color = curTheme.roadColor;
        } else if (i === 5) {
          type = 'RAIL';
          speed = -340;
          color = curTheme.railColor;
        } else {
          type = 'RIVER';
          speed = (i % 2 === 0 ? 1 : -1) * 80;
          color = curTheme.riverColor;
        }
      }

      const lane: Lane = {
        index: i,
        y: laneY,
        height: this.laneHeight,
        type,
        speed,
        color,
        entities: [],
        railWarning: type === 'RAIL' ? 2.5 + Math.random() * 3 : undefined,
        trainActive: false
      };

      this.populateLaneEntities(lane, width);
      this.lanes.push(lane);
    }
  }

  private populateLaneEntities(lane: Lane, width: number): void {
    if (lane.type === 'ROAD') {
      const entityCount = 3 + Math.floor(Math.random() * 2);
      const spacing = width / entityCount;
      const carColors = ['#EF4444', '#F59E0B', '#3B82F6', '#EC4899', '#8B5CF6'];

      for (let e = 0; e < entityCount; e++) {
        const isTruck = Math.random() < 0.35;
        const eWidth = isTruck ? 74 : 44;
        const startX = e * spacing + (Math.random() - 0.5) * 30;

        lane.entities.push({
          x: (startX + width) % width,
          width: eWidth,
          height: this.laneHeight * 0.72,
          speed: lane.speed,
          color: carColors[Math.floor(Math.random() * carColors.length)],
          type: isTruck ? 'truck' : 'car'
        });
      }
    } else if (lane.type === 'RIVER') {
      const logCount = 3 + Math.floor(Math.random() * 2);
      const spacing = width / logCount;
      for (let e = 0; e < logCount; e++) {
        const isLily = Math.random() < 0.25;
        const lWidth = isLily ? 36 : 78 + Math.floor(Math.random() * 30);
        const startX = e * spacing + (Math.random() - 0.5) * 20;

        lane.entities.push({
          x: (startX + width) % width,
          width: lWidth,
          height: this.laneHeight * 0.75,
          speed: lane.speed,
          color: isLily ? '#22C55E' : '#78350F',
          type: isLily ? 'lilypad' : 'log'
        });
      }
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastWidth = width;
    this.lastHeight = height;
    this.animTimer += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    const isSuddenDeath = this.roundTimer <= 15;

    // Sudden Death warning trigger
    if (isSuddenDeath && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.audio.playBoost();
      this.particles.shake(0.5);
      this.particles.showFloatingText('⚡ FREEWAY RUSH HOUR! ⚡', width / 2, height / 2 - 30, '#FACC15', 30);

      // Spawn Golden Turbo Carrots on safe berms (lane 4 and 8)
      const lane4 = this.lanes[4];
      const lane8 = this.lanes[8];
      if (lane4) {
        this.goldenItems.push({
          laneIndex: 4,
          x: width * 0.35,
          y: lane4.y + lane4.height / 2,
          collected: false
        });
      }
      if (lane8) {
        this.goldenItems.push({
          laneIndex: 8,
          x: width * 0.65,
          y: lane8.y + lane8.height / 2,
          collected: false
        });
      }
    }

    // Determine Underdog Hopper
    const activeAlive = this.getActivePlayers().filter((p) => this.playersState.get(p.id)?.alive);
    if (activeAlive.length > 1) {
      let minLane = 999;
      let minScore = 999999;
      let maxLane = -1;

      for (const p of activeAlive) {
        const ps = this.playersState.get(p.id)!;
        if (ps.maxLaneReached < minLane) {
          minLane = ps.maxLaneReached;
          minScore = ps.score;
        } else if (ps.maxLaneReached === minLane && ps.score < minScore) {
          minScore = ps.score;
        }
        if (ps.maxLaneReached > maxLane) {
          maxLane = ps.maxLaneReached;
        }
      }

      for (const p of this.getActivePlayers()) {
        const ps = this.playersState.get(p.id);
        if (!ps) continue;
        ps.isUnderdog = ps.alive && (maxLane - ps.maxLaneReached >= 3);
        if (ps.isUnderdog && !ps.hasShield) {
          ps.hasShield = true;
        }
      }
    } else {
      for (const ps of this.playersState.values()) {
        ps.isUnderdog = false;
      }
    }

    // Update bot inputs via BaseGame
    this.updateBots(dt, width, height);

    // Speed multiplier during rush hour
    const rushHourSpeedMult = isSuddenDeath ? 1.25 : 1.0;

    // Update Lanes
    for (const lane of this.lanes) {
      for (const ent of lane.entities) {
        ent.x += ent.speed * rushHourSpeedMult * dt;
        if (ent.speed > 0 && ent.x > width + ent.width) {
          ent.x = -ent.width;
        } else if (ent.speed < 0 && ent.x < -ent.width) {
          ent.x = width + ent.width;
        }
      }

      if (lane.type === 'RAIL') {
        if (lane.railWarning !== undefined) {
          lane.railWarning -= dt * (isSuddenDeath ? 1.4 : 1.0);
          if (lane.railWarning <= 0) {
            lane.trainActive = true;
            lane.railWarning = (isSuddenDeath ? 3.0 : 5.0) + Math.random() * 3.0;
            const trainW = 380;
            const startX = lane.speed > 0 ? -trainW : width + 20;

            lane.entities = [
              {
                x: startX,
                width: trainW,
                height: this.laneHeight * 0.85,
                speed: lane.speed * (isSuddenDeath ? 1.2 : 1.0),
                color: '#DC2626',
                type: 'train'
              }
            ];
            this.audio.playWhoosh();
            this.particles.shake(0.25);
          }
        }

        if (lane.trainActive && lane.entities.length > 0) {
          const t = lane.entities[0];
          if (
            (t.speed > 0 && t.x > width + 100) ||
            (t.speed < 0 && t.x < -t.width - 100)
          ) {
            lane.entities = [];
            lane.trainActive = false;
          }
        }
      }
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps || !ps.alive) continue;

      if (ps.invulnTimer > 0) {
        ps.invulnTimer = Math.max(0, ps.invulnTimer - dt);
      }
      if (ps.inputRepeatTimer > 0) {
        ps.inputRepeatTimer = Math.max(0, ps.inputRepeatTimer - dt);
      }
      if (ps.shoveCooldown > 0) {
        ps.shoveCooldown = Math.max(0, ps.shoveCooldown - dt);
      }
      if (ps.streakTimer > 0) {
        ps.streakTimer = Math.max(0, ps.streakTimer - dt);
        if (ps.streakTimer <= 0) {
          ps.hopStreak = 0;
        }
      }

      ps.squishScaleX += (1 - ps.squishScaleX) * 10 * dt;
      ps.squishScaleY += (1 - ps.squishScaleY) * 10 * dt;

      // Handle hopping interpolation
      // Underdog Rocket Sneakers hop ~40% faster
      const hopSpeed = ps.isUnderdog ? 10.5 : 6.8;
      if (ps.isHopping) {
        ps.hopProgress += dt * hopSpeed;
        if (ps.hopProgress >= 1) {
          ps.hopProgress = 1;
          ps.isHopping = false;
          ps.x = ps.targetX;
          ps.y = ps.targetY;
        } else {
          const ease = Math.sin(ps.hopProgress * Math.PI);
          ps.x = ps.hopStartX + (ps.targetX - ps.hopStartX) * ps.hopProgress;
          ps.y = ps.hopStartY + (ps.targetY - ps.hopStartY) * ps.hopProgress;
          ps.squishScaleY = 1 + ease * 0.35;
          ps.squishScaleX = 1 - ease * 0.2;
        }
      }

      // If standing on river, drift with log speed
      const curLane = this.lanes[ps.laneIndex];
      if (!ps.isHopping && curLane && curLane.type === 'RIVER') {
        ps.x += ps.onLogSpeed * dt;
        ps.targetX = ps.x;

        if (ps.x < 10 || ps.x > width - 10) {
          this.handlePlayerDeath(ps, p.color, 'DRIFTED OFF!');
          continue;
        }
      }

      // Read Inputs if not hopping and alive
      if (!ps.isHopping && ps.alive && !ps.hasFinished) {
        this.handlePlayerInput(p.id, ps, width);
      }

      // Check Golden Turbo Carrot collection
      for (const item of this.goldenItems) {
        if (!item.collected && ps.laneIndex === item.laneIndex) {
          const d = Math.hypot(ps.x - item.x, ps.y - item.y);
          if (d < 24) {
            item.collected = true;
            ps.score += 150;
            this.audio.playScore();
            this.particles.spawnExplosion(item.x, item.y, '#FACC15', 20);
            this.particles.showFloatingText('⭐ +150 BONUS!', item.x, item.y - 25, '#FACC15', 22);
          }
        }
      }

      // Hazard & Collision Checks
      this.checkPlayerCollisions(ps, p.color, width);
    }

    // Player-to-Player Bumping & Shoving
    this.checkPlayerShoving();

    this.syncDebug();

    // Check Round Over condition
    const aliveCount = Array.from(this.playersState.values()).filter((p) => p.alive && !p.hasFinished).length;
    const finishedCount = this.finishOrder.length;
    if (this.roundTimer <= 0 || aliveCount === 0 || finishedCount >= this.getActivePlayers().length) {
      this.isFinished = true;
    }
  }

  private checkPlayerShoving(): void {
    const players = Array.from(this.playersState.values()).filter((p) => p.alive && !p.hasFinished);
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const p1 = players[i];
        const p2 = players[j];

        if (p1.laneIndex === p2.laneIndex && !p1.isHopping && !p2.isHopping) {
          const dist = Math.abs(p1.x - p2.x);
          if (dist < 24 && p1.shoveCooldown <= 0 && p2.shoveCooldown <= 0) {
            const shoveDir = p1.x < p2.x ? -1 : 1;
            p1.x += shoveDir * 14;
            p2.x -= shoveDir * 14;
            p1.targetX = p1.x;
            p2.targetX = p2.x;

            p1.shoveCooldown = 0.4;
            p2.shoveCooldown = 0.4;

            this.audio.playBounce();
            this.particles.spawnDust((p1.x + p2.x) / 2, p1.y, 8);
            this.particles.showFloatingText('BUMP!', (p1.x + p2.x) / 2, p1.y - 20, '#F59E0B', 16);
          }
        }
      }
    }
  }

  private handlePlayerInput(pid: PlayerId, ps: HopperPlayer, width: number): void {
    if (ps.isHopping || !ps.alive || ps.hasFinished) return;

    let dCol = 0;
    let dLane = 0;

    const justUp = this.input.justUp(pid);
    const justDown = this.input.justDown(pid);
    const justLeft = this.input.justLeft(pid);
    const justRight = this.input.justRight(pid);
    const justAction = this.input.justAction(pid) || this.input.justPressed(pid);

    const rawSteer = this.input.getRawSteer(pid);
    const rawThrottle = this.input.getRawThrottle(pid);

    if (justAction || justUp) {
      dLane = 1;
      this.input.consumeAction(pid);
      ps.inputRepeatTimer = 0.32;
    } else if (justDown) {
      dLane = -1;
      this.input.consumeAction(pid);
      ps.inputRepeatTimer = 0.32;
    } else if (justLeft) {
      dCol = -1;
      this.input.consumeAction(pid);
      ps.inputRepeatTimer = 0.32;
    } else if (justRight) {
      dCol = 1;
      this.input.consumeAction(pid);
      ps.inputRepeatTimer = 0.32;
    } else {
      const throttleChanged = rawThrottle !== 0 && rawThrottle !== ps.lastRawThrottle;
      const steerChanged = rawSteer !== 0 && rawSteer !== ps.lastRawSteer;

      if (throttleChanged || steerChanged) {
        if (rawThrottle !== 0) dLane = rawThrottle;
        else if (rawSteer !== 0) dCol = rawSteer;
        ps.inputRepeatTimer = 0.32;
      } else if (ps.inputRepeatTimer <= 0) {
        if (rawThrottle !== 0) {
          dLane = rawThrottle;
          ps.inputRepeatTimer = 0.22;
        } else if (rawSteer !== 0) {
          dCol = rawSteer;
          ps.inputRepeatTimer = 0.22;
        }
      }
    }

    ps.lastRawThrottle = rawThrottle;
    ps.lastRawSteer = rawSteer;

    if (dLane !== 0 || dCol !== 0) {
      this.attemptHop(ps, dCol, dLane, width);
    }
  }

  private attemptHop(ps: HopperPlayer, dCol: number, dLane: number, width: number): void {
    if (ps.isHopping) return;
    const targetLaneIdx = Math.max(0, Math.min(this.totalLanes - 1, ps.laneIndex + dLane));
    const targetLane = this.lanes[targetLaneIdx];
    if (!targetLane) return;

    let targetX = ps.x;
    if (dCol !== 0) {
      targetX = Math.max(
        this.colWidth * 0.5,
        Math.min(width - this.colWidth * 0.5, ps.x + dCol * this.colWidth)
      );
    } else {
      targetX = Math.max(
        this.colWidth * 0.5,
        Math.min(width - this.colWidth * 0.5, ps.x)
      );
    }

    ps.isHopping = true;
    ps.hopProgress = 0;
    ps.hopStartX = ps.x;
    ps.hopStartY = ps.y;
    ps.laneIndex = targetLaneIdx;
    ps.targetX = targetX;
    ps.colIndex = Math.max(0, Math.min(this.columnCount - 1, Math.floor(targetX / this.colWidth)));
    ps.targetY = targetLane.y + targetLane.height / 2;

    this.audio.playBounce();
    this.particles.spawnDust(ps.x, ps.y + 12, 6);

    // Streak Multiplier Logic
    ps.hopStreak = Math.min(3, ps.hopStreak + 1);
    ps.streakTimer = 1.4;

    // Scoring progression
    if (targetLaneIdx > ps.maxLaneReached) {
      ps.maxLaneReached = targetLaneIdx;
      const basePts = 25;
      const awarded = basePts * ps.hopStreak;
      ps.score += awarded;

      if (ps.hopStreak > 1) {
        this.particles.showFloatingText(
          `🔥 ${ps.hopStreak}X! +${awarded}`,
          ps.x,
          ps.y - 28,
          '#FACC15',
          18
        );
      }

      if (targetLaneIdx === this.totalLanes - 1 && !ps.hasFinished) {
        ps.hasFinished = true;
        ps.score += 500;
        this.finishOrder.push(ps.id);
        this.audio.playFanfare();
        this.particles.showFloatingText('GOAL! +500 👑', ps.x, ps.y - 30, '#10B981', 28);
        this.particles.spawnConfetti(ps.x, ps.y, 40);

        if (this.finishOrder.length === 1) {
          this.roundTimer = Math.min(this.roundTimer, 3.5);
        }
      }
    }
  }

  private checkPlayerCollisions(ps: HopperPlayer, color: string, width: number): void {
    if (ps.invulnTimer > 0 || !ps.alive || ps.hasFinished) return;

    const lane = this.lanes[ps.laneIndex];
    if (!lane) return;

    if (lane.type === 'ROAD' || lane.type === 'RAIL') {
      for (const ent of lane.entities) {
        const entLeft = ent.x;
        const entRight = ent.x + ent.width;
        const entTop = lane.y + (lane.height - ent.height) / 2;
        const entBottom = entTop + ent.height;

        if (
          ps.x + 10 > entLeft &&
          ps.x - 10 < entRight &&
          ps.y + 10 > entTop &&
          ps.y - 10 < entBottom
        ) {
          // Check Underdog Hazard Shield
          if (ps.hasShield) {
            ps.hasShield = false;
            ps.invulnTimer = 1.4;
            this.audio.playBoost();
            this.particles.spawnExplosion(ps.x, ps.y, '#F59E0B', 25);
            this.particles.showFloatingText('SHIELD DEFLECT!', ps.x, ps.y - 25, '#F59E0B', 22);
            // Bump to safety
            ps.y += this.laneHeight;
            ps.laneIndex = Math.max(0, ps.laneIndex - 1);
            ps.targetY = ps.y;
            return;
          }

          this.handlePlayerDeath(ps, color, ent.type === 'train' ? 'TRAIN WRECK!' : 'SQUISHED!');
          return;
        }
      }
    }

    if (lane.type === 'RIVER' && !ps.isHopping) {
      let onLog = false;
      let logSpeed = 0;

      for (const ent of lane.entities) {
        if (ps.x >= ent.x - 8 && ps.x <= ent.x + ent.width + 8) {
          onLog = true;
          logSpeed = ent.speed;
          break;
        }
      }

      if (onLog) {
        ps.onLogSpeed = logSpeed;
      } else {
        if (ps.hasShield) {
          ps.hasShield = false;
          ps.invulnTimer = 1.4;
          this.audio.playBoost();
          this.particles.showFloatingText('WATER SAVED!', ps.x, ps.y - 25, '#38BDF8', 22);
          ps.y += this.laneHeight;
          ps.laneIndex = Math.max(0, ps.laneIndex - 1);
          ps.targetY = ps.y;
          return;
        }

        this.handlePlayerDeath(ps, color, 'SPLASH!');
        return;
      }
    } else {
      ps.onLogSpeed = 0;
    }
  }

  private handlePlayerDeath(ps: HopperPlayer, color: string, reason: string): void {
    ps.lives -= 1;
    ps.invulnTimer = 1.3;
    ps.squishScaleX = 1.8;
    ps.squishScaleY = 0.3;
    ps.hopStreak = 0;

    this.audio.playExplosion();
    this.particles.shake(0.35);
    this.particles.spawnExplosion(ps.x, ps.y, color, 20);
    this.particles.showFloatingText(reason, ps.x, ps.y - 25, '#EF4444', 22);

    if (ps.lives <= 0) {
      ps.alive = false;
      this.particles.showFloatingText('ELIMINATED!', ps.x, ps.y - 35, '#EF4444', 26);
    } else {
      let respawnLaneIdx = 0;
      for (let l = ps.laneIndex; l >= 0; l--) {
        if (this.lanes[l].type === 'SAFE') {
          respawnLaneIdx = l;
          break;
        }
      }
      ps.laneIndex = respawnLaneIdx;
      const rLane = this.lanes[respawnLaneIdx];
      ps.targetX = ps.x;
      ps.targetY = rLane.y + rLane.height / 2;
      ps.x = ps.targetX;
      ps.y = ps.targetY;
      ps.isHopping = false;
    }
  }

  private isSafeAt(
    laneIndex: number,
    testX: number,
    timeWindowStart: number,
    timeWindowEnd: number,
    width: number
  ): boolean {
    if (laneIndex < 0 || laneIndex >= this.totalLanes) return false;
    const lane = this.lanes[laneIndex];
    if (!lane) return false;

    if (lane.type === 'SAFE') return true;

    if (lane.type === 'RAIL') {
      if (lane.trainActive) return false;
      if (lane.railWarning !== undefined && lane.railWarning < timeWindowEnd + 0.8) {
        return false;
      }
      return true;
    }

    if (lane.type === 'ROAD') {
      const playerMargin = 14;
      for (const ent of lane.entities) {
        const span = width + 2 * ent.width;
        const steps = 3;
        for (let s = 0; s <= steps; s++) {
          const t = timeWindowStart + (s / steps) * (timeWindowEnd - timeWindowStart);
          let projX = ent.x + ent.speed * t;
          let rel = (projX - (-ent.width)) % span;
          if (rel < 0) rel += span;
          projX = -ent.width + rel;

          const entLeft = projX;
          const entRight = projX + ent.width;

          if (testX + playerMargin > entLeft && testX - playerMargin < entRight) {
            return false;
          }
        }
      }
      return true;
    }

    if (lane.type === 'RIVER') {
      const landingTime = timeWindowStart;
      for (const ent of lane.entities) {
        const span = width + 2 * ent.width;
        let projX = ent.x + ent.speed * landingTime;
        let rel = (projX - (-ent.width)) % span;
        if (rel < 0) rel += span;
        projX = -ent.width + rel;

        if (testX >= projX + 4 && testX <= projX + ent.width - 4) {
          return true;
        }
      }
      return false;
    }

    return true;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || !ps.alive || ps.hasFinished || ps.isHopping) {
      return;
    }

    ps.botDecisionTimer -= dt;
    if (ps.botDecisionTimer > 0) return;

    const cadence =
      difficulty === 'bot_hard'
        ? 0.11 + Math.random() * 0.04
        : difficulty === 'bot_normal'
        ? 0.18 + Math.random() * 0.08
        : 0.32 + Math.random() * 0.14;
    ps.botDecisionTimer = cadence;

    const curLane = this.lanes[ps.laneIndex];
    const nextLaneIdx = ps.laneIndex + 1;
    const prevLaneIdx = ps.laneIndex - 1;

    let currentLaneThreat = false;
    if (curLane && (curLane.type === 'ROAD' || curLane.type === 'RAIL')) {
      currentLaneThreat = !this.isSafeAt(ps.laneIndex, ps.x, 0.0, 0.55, width);
    }

    let riverDriftThreat = false;
    if (curLane && curLane.type === 'RIVER') {
      if (curLane.speed < 0 && ps.x < width * 0.18) riverDriftThreat = true;
      if (curLane.speed > 0 && ps.x > width * 0.82) riverDriftThreat = true;
    }

    const windowStart = 0.12;
    const windowEnd = difficulty === 'bot_hard' ? 0.34 : difficulty === 'bot_normal' ? 0.26 : 0.20;

    const isForwardSafe =
      nextLaneIdx < this.totalLanes && this.isSafeAt(nextLaneIdx, ps.x, windowStart, windowEnd, width);

    if (currentLaneThreat || riverDriftThreat) {
      if (isForwardSafe) {
        this.attemptHop(ps, 0, 1, width);
        return;
      }

      if (riverDriftThreat) {
        const dodgeDir = curLane.speed < 0 ? 1 : -1;
        this.attemptHop(ps, dodgeDir, 0, width);
        return;
      }

      const canDodgeLeft =
        ps.x > this.colWidth && this.isSafeAt(ps.laneIndex, ps.x - this.colWidth, windowStart, windowEnd, width);
      const canDodgeRight =
        ps.x < width - this.colWidth && this.isSafeAt(ps.laneIndex, ps.x + this.colWidth, windowStart, windowEnd, width);

      if (canDodgeLeft && !canDodgeRight) {
        this.attemptHop(ps, -1, 0, width);
        return;
      } else if (canDodgeRight && !canDodgeLeft) {
        this.attemptHop(ps, 1, 0, width);
        return;
      } else if (canDodgeLeft && canDodgeRight) {
        this.attemptHop(ps, Math.random() < 0.5 ? -1 : 1, 0, width);
        return;
      }

      if (prevLaneIdx >= 0 && this.isSafeAt(prevLaneIdx, ps.x, windowStart, windowEnd, width)) {
        this.attemptHop(ps, 0, -1, width);
        return;
      }
    }

    if (isForwardSafe) {
      if (difficulty === 'bot_easy' && Math.random() < 0.15) {
        return;
      }
      this.attemptHop(ps, 0, 1, width);
      return;
    }

    if (nextLaneIdx < this.totalLanes) {
      const nextLane = this.lanes[nextLaneIdx];

      if (nextLane.type === 'RIVER') {
        let bestLogDist = Infinity;
        let bestLogDir = 0;

        for (const ent of nextLane.entities) {
          const futureLogCenter = ent.x + ent.speed * 0.4 + ent.width / 2;
          const diff = futureLogCenter - ps.x;
          if (Math.abs(diff) < bestLogDist) {
            bestLogDist = Math.abs(diff);
            bestLogDir = Math.sign(diff);
          }
        }

        if (bestLogDir !== 0) {
          const stepX = ps.x + bestLogDir * this.colWidth;
          const isSidewaysSafe = this.isSafeAt(ps.laneIndex, stepX, windowStart, windowEnd, width);
          if (isSidewaysSafe && stepX > this.colWidth && stepX < width - this.colWidth) {
            this.attemptHop(ps, bestLogDir, 0, width);
            return;
          }
        }
      } else {
        const leftX = ps.x - this.colWidth;
        const rightX = ps.x + this.colWidth;

        const leftAheadSafe =
          leftX > this.colWidth &&
          this.isSafeAt(nextLaneIdx, leftX, windowStart, windowEnd, width) &&
          this.isSafeAt(ps.laneIndex, leftX, windowStart, windowEnd, width);

        const rightAheadSafe =
          rightX < width - this.colWidth &&
          this.isSafeAt(nextLaneIdx, rightX, windowStart, windowEnd, width) &&
          this.isSafeAt(ps.laneIndex, rightX, windowStart, windowEnd, width);

        if (leftAheadSafe && !rightAheadSafe) {
          this.attemptHop(ps, -1, 0, width);
          return;
        } else if (rightAheadSafe && !leftAheadSafe) {
          this.attemptHop(ps, 1, 0, width);
          return;
        } else if (leftAheadSafe && rightAheadSafe) {
          this.attemptHop(ps, Math.random() < 0.5 ? -1 : 1, 0, width);
          return;
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const curTheme = THEME_CONFIGS.find((t) => t.id === this.mapTheme) || THEME_CONFIGS[0];

    // Background
    ctx.fillStyle = curTheme.bgColor;
    ctx.fillRect(0, 0, width, height);

    // Lanes
    for (const lane of this.lanes) {
      this.renderLane(ctx, lane, width, curTheme);
    }

    // Golden Turbo Carrots
    for (const item of this.goldenItems) {
      if (!item.collected) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(item.x, item.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#F59E0B';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🥕', item.x, item.y);
        ctx.restore();
      }
    }

    // Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderHopperPlayer(ctx, ps, p);
    }

    // Minigame HUD Pod at y = 56
    this.renderCenterHudPod(ctx, width);

    // Interactive Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
    this.renderThemePill(ctx, height, curTheme);

    // Control Hints (Right-aligned)
    this.renderControlHints(ctx, width, height);
  }

  private renderLane(ctx: CanvasRenderingContext2D, lane: Lane, width: number, theme: HighwayThemeConfig): void {
    ctx.fillStyle = lane.color;
    ctx.fillRect(0, lane.y, width, lane.height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(0, lane.y + lane.height - 1, width, 1);

    if (lane.type === 'SAFE') {
      ctx.fillStyle = lane.index === this.totalLanes - 1 ? '#059669' : 'rgba(255, 255, 255, 0.06)';
      for (let x = 12; x < width; x += 28) {
        ctx.fillRect(x, lane.y + 4, 3, 6);
        ctx.fillRect(x + 10, lane.y + lane.height - 10, 4, 5);
      }

      if (lane.index === this.totalLanes - 1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '900 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('★ GOLDEN PASTURE FINISH LINE ★', width / 2, lane.y + lane.height * 0.65);
      }
    } else if (lane.type === 'ROAD') {
      ctx.fillStyle = theme.dividerColor;
      for (let x = 10; x < width; x += 36) {
        ctx.fillRect(x, lane.y + lane.height / 2 - 1.5, 18, 3);
      }
    } else if (lane.type === 'RAIL') {
      ctx.fillStyle = '#78350F';
      for (let x = 6; x < width; x += 16) {
        ctx.fillRect(x, lane.y + 2, 7, lane.height - 4);
      }
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(0, lane.y + 8, width, 3);
      ctx.fillRect(0, lane.y + lane.height - 11, width, 3);

      if (lane.railWarning !== undefined && lane.railWarning < 1.6) {
        const flash = Math.floor(performance.now() / 150) % 2 === 0;
        ctx.fillStyle = flash ? '#EF4444' : '#7F1D1D';
        ctx.beginPath();
        ctx.arc(24, lane.y + lane.height / 2, 6, 0, Math.PI * 2);
        ctx.arc(width - 24, lane.y + lane.height / 2, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (lane.type === 'RIVER') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      const waveOffset = (performance.now() * 0.04) % 40;
      for (let x = -20 + waveOffset; x < width; x += 40) {
        ctx.fillRect(x, lane.y + 6, 14, 2);
        ctx.fillRect(x + 20, lane.y + lane.height - 8, 12, 2);
      }
    }

    // Entities
    for (const ent of lane.entities) {
      const ey = lane.y + (lane.height - ent.height) / 2;

      if (ent.type === 'car' || ent.type === 'truck') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(ent.x + 2, ey + ent.height, ent.width, 3);

        ctx.fillStyle = ent.color;
        ctx.beginPath();
        ctx.roundRect(ent.x, ey, ent.width, ent.height, 4);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#0F172A';
        ctx.stroke();

        ctx.fillStyle = '#93C5FD';
        const windX = ent.speed > 0 ? ent.x + ent.width - 14 : ent.x + 4;
        ctx.fillRect(windX, ey + 3, 10, ent.height - 6);

        ctx.fillStyle = '#FEF08A';
        const hX = ent.speed > 0 ? ent.x + ent.width - 2 : ent.x;
        ctx.fillRect(hX, ey + 2, 2, 4);
        ctx.fillRect(hX, ey + ent.height - 6, 2, 4);
      } else if (ent.type === 'train') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(ent.x, ey + ent.height, ent.width, 4);

        ctx.fillStyle = ent.color;
        ctx.beginPath();
        ctx.roundRect(ent.x, ey, ent.width, ent.height, 6);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        ctx.fillStyle = '#FEF08A';
        for (let wx = ent.x + 16; wx < ent.x + ent.width - 20; wx += 26) {
          ctx.fillRect(wx, ey + 4, 16, ent.height - 8);
        }
      } else if (ent.type === 'log') {
        ctx.fillStyle = ent.color;
        ctx.beginPath();
        ctx.roundRect(ent.x, ey, ent.width, ent.height, ent.height / 2);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#451A03';
        ctx.stroke();

        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(ent.x + 14, ey + 4, 4, ent.height - 8);
        ctx.fillRect(ent.x + ent.width - 18, ey + 4, 4, ent.height - 8);
      } else if (ent.type === 'lilypad') {
        ctx.fillStyle = ent.color;
        ctx.beginPath();
        ctx.arc(ent.x + ent.width / 2, ey + ent.height / 2, ent.width / 2, 0.2, Math.PI * 1.8);
        ctx.lineTo(ent.x + ent.width / 2, ey + ent.height / 2);
        ctx.fill();
        ctx.strokeStyle = '#15803D';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  private renderHopperPlayer(
    ctx: CanvasRenderingContext2D,
    ps: HopperPlayer,
    p: PlayerConfig
  ): void {
    if (!ps.alive) return;

    if (ps.invulnTimer > 0 && Math.floor(performance.now() / 80) % 2 === 0) {
      return;
    }

    ctx.save();
    ctx.translate(ps.x, ps.y);
    ctx.scale(ps.squishScaleX, ps.squishScaleY);

    // Underdog Rocket Sneakers Golden Aura
    if (ps.isUnderdog) {
      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#F59E0B';
      ctx.font = '900 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ROCKET ⚡', 0, 22);
      ctx.restore();
    }

    // Hazard Shield Bubble
    if (ps.hasShield) {
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Shadow
    ctx.beginPath();
    ctx.ellipse(0, 8, 12, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // Context-aware Character Mood
    let mood: CharacterMood = 'idle';
    if (ps.isHopping) {
      mood = 'happy';
    } else if (ps.hasFinished) {
      mood = 'triumph';
    } else if (ps.hopStreak >= 2) {
      mood = 'focused';
    }

    const lane = this.lanes[ps.laneIndex];
    if (lane && (lane.type === 'ROAD' || lane.type === 'RAIL')) {
      for (const ent of lane.entities) {
        if (Math.abs(ent.x - ps.x) < 55) {
          mood = 'shocked';
          break;
        }
      }
    }

    const isBot = p.type.startsWith('bot_');

    // Mascot Avatar via CharacterRenderer
    drawCharacter(ctx, 0, 0, 14, p.id, isBot, mood, this.animTimer * 4);

    ctx.restore();

    // Hearts above player
    this.renderPlayerHearts(ctx, ps.x, ps.y - 18, ps.lives, ps.maxLives);
  }

  private renderPlayerHearts(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    lives: number,
    maxLives: number
  ): void {
    const spacing = 9;
    const startX = x - ((maxLives - 1) * spacing) / 2;
    for (let i = 0; i < maxLives; i++) {
      const hx = startX + i * spacing;
      ctx.beginPath();
      ctx.arc(hx, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = i < lives ? '#EF4444' : '#475569';
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  private renderCenterHudPod(ctx: CanvasRenderingContext2D, width: number): void {
    const podW = 340;
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
    ctx.fillText(`MAP: ${this.currentMapName}`, podX + 16, podY + podH / 2);

    // Sub-title or rush hour in center
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    if (this.roundTimer <= 15) {
      ctx.fillStyle = '#FACC15';
      ctx.fillText('⚡ RUSH HOUR TRAFFIC', width / 2, podY + podH / 2);
    } else {
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('PROCEDURAL CROSSY FREEWAY', width / 2, podY + podH / 2);
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

  private renderThemePill(ctx: CanvasRenderingContext2D, height: number, theme: HighwayThemeConfig): void {
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
    ctx.fillText('Tap/Space: Hop Forward | Arrows/WASD: Steer & Jump', width - 24, height - 28);
    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const rankings = active
      .map((p) => {
        const ps = this.playersState.get(p.id);
        const score = ps ? ps.score : 0;
        return { playerId: p.id, score, place: 1 };
      })
      .sort((a, b) => b.score - a.score);

    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });

    const winnerId =
      rankings.length > 0 && (rankings.length === 1 || rankings[0].score > rankings[1].score)
        ? rankings[0].playerId
        : null;

    let mvpHighlight = 'Highway Survivor!';
    if (this.finishOrder.length > 0) {
      mvpHighlight = `First to Cross: Player ${Number(this.finishOrder[0]) + 1}!`;
    } else if (winnerId !== null) {
      mvpHighlight = `Master Hopper Player ${Number(winnerId) + 1} navigated the perils!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
