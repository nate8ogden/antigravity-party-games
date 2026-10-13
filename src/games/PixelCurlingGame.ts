import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type PixelCurlingThemeId = 'olympic' | 'cyber' | 'aurora';

interface PixelCurlingTheme {
  id: PixelCurlingThemeId;
  name: string;
  icon: string;
  iceGrad0: string;
  iceGrad1: string;
  iceGrad2: string;
  iceGrad3: string;
  pebbleColor: string;
  woodRail: string;
  woodHighlight: string;
  hogLineColor: string;
  teeLineColor: string;
  houseOuterRing: string;
  houseMidRing: string;
  houseInnerRing: string;
  buttonPinColor: string;
  accentColor: string;
}

const THEMES: Record<PixelCurlingThemeId, PixelCurlingTheme> = {
  olympic: {
    id: 'olympic',
    name: 'Olympic Coliseum',
    icon: '❄️',
    iceGrad0: '#F0F9FF',
    iceGrad1: '#E0F2FE',
    iceGrad2: '#BAE6FD',
    iceGrad3: '#93C5FD',
    pebbleColor: 'rgba(255, 255, 255, 0.45)',
    woodRail: '#78350F',
    woodHighlight: '#92400E',
    hogLineColor: '#2563EB',
    teeLineColor: '#DC2626',
    houseOuterRing: '#1D4ED8',
    houseMidRing: '#FFFFFF',
    houseInnerRing: '#DC2626',
    buttonPinColor: '#F59E0B',
    accentColor: '#38BDF8'
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Neon Rink',
    icon: '⚡',
    iceGrad0: '#0B0F2A',
    iceGrad1: '#111836',
    iceGrad2: '#1E1B4B',
    iceGrad3: '#0F172A',
    pebbleColor: 'rgba(6, 182, 212, 0.25)',
    woodRail: '#0F172A',
    woodHighlight: '#06B6D4',
    hogLineColor: '#38BDF8',
    teeLineColor: '#EC4899',
    houseOuterRing: '#A855F7',
    houseMidRing: '#0F172A',
    houseInnerRing: '#06B6D4',
    buttonPinColor: '#F43F5E',
    accentColor: '#06B6D4'
  },
  aurora: {
    id: 'aurora',
    name: 'Midnight Aurora',
    icon: '🌌',
    iceGrad0: '#022C22',
    iceGrad1: '#064E3B',
    iceGrad2: '#0F3E34',
    iceGrad3: '#021F18',
    pebbleColor: 'rgba(52, 211, 153, 0.3)',
    woodRail: '#062822',
    woodHighlight: '#10B981',
    hogLineColor: '#10B981',
    teeLineColor: '#34D399',
    houseOuterRing: '#047857',
    houseMidRing: '#064E3B',
    houseInnerRing: '#34D399',
    buttonPinColor: '#FBBF24',
    accentColor: '#34D399'
  }
};

const THEME_ORDER: PixelCurlingThemeId[] = ['olympic', 'cyber', 'aurora'];

export interface CurlingStone {
  id: number;
  playerId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  curlRate: number;
  rotation: number;
  rotSpeed: number;
  isMoving: boolean;
  score: number;
  isShotStone: boolean;
  distToPin: number;
  isHogged: boolean;
  isOut: boolean;
}

export interface CurlingPlayer {
  id: PlayerId;
  stonesRemaining: number;
  aimAngle: number;
  launchPower: number;
  isCharging: boolean;
  chargeDir: number;
  isSweeping: boolean;
  sweepTimer: number;
  score: number;
  endsWon: number;
}

export class PixelCurlingGame extends BaseGame {
  public stones: CurlingStone[] = [];
  public playersState: Map<PlayerId, CurlingPlayer> = new Map();
  public currentTurnIndex: number = 0;
  public houseX: number = 680;
  public houseY: number = 300;
  public houseRadius: number = 105;
  public currentTheme: PixelCurlingThemeId = 'olympic';
  public get currentMapName(): string {
    return THEMES[this.currentTheme].name;
  }

  private turnOrder: PlayerId[] = [];
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private stoneLaunched: boolean = false;
  private currentEnd: number = 1;
  private maxEnds: number = 2; // 2 Ends of curling (Best of 2 Ends)
  private stonesPerPlayer: number = 3; // 3 stones each = 6 stones per End
  private endCompleteTimer: number = 0;
  private sweepParticlesTimer: number = 0;
  private shotStoneId: number | null = null;
  private isSweepActive: boolean = false;

  // Touch control buttons
  private touchBtns = {
    aimLeft: { x: 0, y: 0, w: 56, h: 32 },
    aimRight: { x: 0, y: 0, w: 56, h: 32 },
    launch: { x: 0, y: 0, w: 92, h: 32 },
    sweep: { x: 0, y: 0, w: 110, h: 32 }
  };
  private pointerdownHandler: ((e: PointerEvent) => void) | null = null;
  private pointerupHandler: ((e: PointerEvent) => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 90.0;
  }

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  public destroy(): void {
    this.removeListeners();
    if (typeof window !== 'undefined' && (window as unknown as { __CURLING_DEBUG__?: unknown }).__CURLING_DEBUG__) {
      delete (window as unknown as { __CURLING_DEBUG__?: unknown }).__CURLING_DEBUG__;
    }
  }

  public cycleTheme(): void {
    const idx = THEME_ORDER.indexOf(this.currentTheme);
    this.setTheme(THEME_ORDER[(idx + 1) % THEME_ORDER.length]);
  }

  public setTheme(themeId: PixelCurlingThemeId): void {
    this.currentTheme = themeId;
    this.audio.playTap();
    this.particles.showFloatingText(
      `${THEMES[themeId].icon} ${THEMES[themeId].name}`,
      400,
      120,
      THEMES[themeId].accentColor,
      20
    );
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keyHandler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 't') {
        this.cycleTheme();
      } else if (key === '1') {
        this.setTheme('olympic');
      } else if (key === '2') {
        this.setTheme('cyber');
      } else if (key === '3') {
        this.setTheme('aurora');
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    this.pointerdownHandler = (e: PointerEvent) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // Theme pill zone: x: 20, y: height - 44, w: 170, h: 32
      const pillY = canvas.height - 44;
      if (clickX >= 20 && clickX <= 190 && clickY >= pillY && clickY <= pillY + 32) {
        this.cycleTheme();
        return;
      }

      const currentPid = this.turnOrder[this.currentTurnIndex];
      const curPlayer = currentPid !== undefined ? this.playersState.get(currentPid) : null;
      const activeMoving = this.stones.some((s) => s.isMoving);

      if (curPlayer && !activeMoving) {
        // Aim Left Button
        const bl = this.touchBtns.aimLeft;
        if (clickX >= bl.x && clickX <= bl.x + bl.w && clickY >= bl.y && clickY <= bl.y + bl.h) {
          curPlayer.aimAngle = Math.max(-0.48, curPlayer.aimAngle - 0.08);
          this.audio.playTap();
          return;
        }

        // Aim Right Button
        const br = this.touchBtns.aimRight;
        if (clickX >= br.x && clickX <= br.x + br.w && clickY >= br.y && clickY <= br.y + br.h) {
          curPlayer.aimAngle = Math.min(0.48, curPlayer.aimAngle + 0.08);
          this.audio.playTap();
          return;
        }

        // Launch Button Hold
        const bLaunch = this.touchBtns.launch;
        if (clickX >= bLaunch.x && clickX <= bLaunch.x + bLaunch.w && clickY >= bLaunch.y && clickY <= bLaunch.y + bLaunch.h) {
          curPlayer.isCharging = true;
          return;
        }
      } else if (activeMoving) {
        // Sweep Button
        const bSweep = this.touchBtns.sweep;
        if (clickX >= bSweep.x && clickX <= bSweep.x + bSweep.w && clickY >= bSweep.y && clickY <= bSweep.y + bSweep.h) {
          this.triggerSweepAction();
        }
      }
    };

    this.pointerupHandler = () => {
      const currentPid = this.turnOrder[this.currentTurnIndex];
      const curPlayer = currentPid !== undefined ? this.playersState.get(currentPid) : null;
      if (curPlayer && curPlayer.isCharging) {
        curPlayer.isCharging = false;
        // Trigger launch with charged power
        if (curPlayer.launchPower >= 140) {
          const canvas = document.querySelector('canvas');
          const w = canvas ? canvas.width : 800;
          const h = canvas ? canvas.height : 600;
          this.launchCurrentStone(curPlayer, w, h);
        }
      }
    };

    window.addEventListener('pointerdown', this.pointerdownHandler);
    window.addEventListener('pointerup', this.pointerupHandler);
  }

  private removeListeners(): void {
    if (typeof window === 'undefined') return;
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.pointerdownHandler) {
      window.removeEventListener('pointerdown', this.pointerdownHandler);
      this.pointerdownHandler = null;
    }
    if (this.pointerupHandler) {
      window.removeEventListener('pointerup', this.pointerupHandler);
      this.pointerupHandler = null;
    }
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 90.0;
    this.isFinished = false;
    this.stones = [];
    this.playersState.clear();
    this.botReactionTimers.clear();
    this.turnOrder = [];
    this.currentTurnIndex = 0;
    this.currentEnd = 1;
    this.endCompleteTimer = 0;
    this.stoneLaunched = false;
    this.shotStoneId = null;
    this.isSweepActive = false;

    this.houseX = width * 0.82;
    this.houseY = height * 0.5;
    this.houseRadius = Math.min(width, height) * 0.22;

    const active = this.getActivePlayers();
    active.forEach((p) => {
      this.playersState.set(p.id, {
        id: p.id,
        stonesRemaining: this.stonesPerPlayer,
        aimAngle: 0,
        launchPower: 0,
        isCharging: false,
        chargeDir: 1,
        isSweeping: false,
        sweepTimer: 0,
        score: 0,
        endsWon: 0
      });
      this.botReactionTimers.set(p.id, 0.35 + Math.random() * 0.2);
    });

    this.setupTurnOrder();
    this.updateTouchButtons(width, height);
    this.exposeDebug(width, height);
  }

  private setupTurnOrder(): void {
    this.turnOrder = [];
    const active = this.getActivePlayers();
    // Alternating shots: Player 1, Player 2, Player 1, Player 2...
    for (let s = 0; s < this.stonesPerPlayer; s++) {
      active.forEach((p) => this.turnOrder.push(p.id));
    }
  }

  private updateTouchButtons(width: number, height: number): void {
    const bottomY = height - 44;
    this.touchBtns.aimLeft = { x: 200, y: bottomY, w: 56, h: 32 };
    this.touchBtns.aimRight = { x: 262, y: bottomY, w: 56, h: 32 };
    this.touchBtns.launch = { x: 324, y: bottomY, w: 92, h: 32 };
    this.touchBtns.sweep = { x: width * 0.5 - 55, y: bottomY, w: 110, h: 32 };
  }

  private exposeDebug(width: number, height: number): void {
    if (typeof window !== 'undefined') {
      const game = this;
      (window as unknown as { __CURLING_DEBUG__?: unknown }).__CURLING_DEBUG__ = {
        get stones() {
          return game.stones;
        },
        get players() {
          return Array.from(game.playersState.values());
        },
        get currentTurnIndex() {
          return game.currentTurnIndex;
        },
        get turnOrder() {
          return game.turnOrder;
        },
        get shotStoneId() {
          return game.shotStoneId;
        },
        launchStone: (playerId: PlayerId, power: number, angle: number = 0) => {
          const ps = game.playersState.get(playerId);
          if (ps) {
            ps.aimAngle = angle;
            ps.launchPower = power;
            game.launchCurrentStone(ps, width, height);
          }
        },
        sweep: () => {
          game.triggerSweepAction();
        },
        placeStoneAt: (playerId: PlayerId, x: number, y: number) => {
          const stone: CurlingStone = {
            id: game.stones.length,
            playerId,
            x,
            y,
            vx: 0,
            vy: 0,
            radius: 14,
            mass: 2.4,
            curlRate: 0,
            rotation: 0,
            rotSpeed: 0,
            isMoving: false,
            score: 0,
            isShotStone: false,
            distToPin: 9999,
            isHogged: false,
            isOut: false
          };
          game.stones.push(stone);
          game.calculateHouseScores();
          return stone;
        },
        forceTurnEnd: () => {
          for (const s of game.stones) {
            s.vx = 0;
            s.vy = 0;
            s.isMoving = false;
          }
        }
      };
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // End Completion intermission
    if (this.endCompleteTimer > 0) {
      this.endCompleteTimer -= dt;
      if (this.endCompleteTimer <= 0) {
        if (this.currentEnd >= this.maxEnds) {
          this.calculateEndScores();
          this.isFinished = true;
        } else {
          // Advance to next End
          this.currentEnd++;
          this.resetNextEnd(width, height);
        }
      }
      return;
    }

    // 1. Update bot decisions
    this.updateBots(dt, width, height);

    // Current turn player
    const currentPid = this.turnOrder[this.currentTurnIndex];
    const curPlayer = currentPid !== undefined ? this.playersState.get(currentPid) : null;
    const isBot = curPlayer ? this.getPlayer(curPlayer.id)?.type.startsWith('bot_') : false;

    // Check if any stone is currently in motion
    const activeMovingStone = this.stones.find((s) => s.isMoving);

    // Decay sweep state
    if (this.isSweepActive) {
      this.sweepParticlesTimer += dt;
    }

    // 2. Aim & Launch Phase (Human Turn)
    if (curPlayer && !isBot && !activeMovingStone && this.currentTurnIndex < this.turnOrder.length) {
      const steer = this.input.getSteer(curPlayer.id);
      const isInputHeld = this.input.isActionPressed(curPlayer.id) || this.input.isPressed(curPlayer.id);
      const justAction = this.input.justAction(curPlayer.id) || this.input.justPressed(curPlayer.id);

      // Aim angle (-28 deg to +28 deg towards house)
      if (steer !== 0) {
        curPlayer.aimAngle += steer * dt * 0.95;
        curPlayer.aimAngle = Math.max(-0.48, Math.min(0.48, curPlayer.aimAngle));
      }

      // Charge power (Power sweeps smoothly between 160 and 640)
      if (isInputHeld) {
        if (!curPlayer.isCharging) {
          curPlayer.isCharging = true;
          curPlayer.launchPower = 160;
          curPlayer.chargeDir = 1;
        }
        const powerSpeed = 480;
        curPlayer.launchPower += curPlayer.chargeDir * powerSpeed * dt;

        if (curPlayer.launchPower >= 640) {
          curPlayer.launchPower = 640;
          curPlayer.chargeDir = -1;
        } else if (curPlayer.launchPower <= 150) {
          curPlayer.launchPower = 150;
          curPlayer.chargeDir = 1;
        }
      } else if (curPlayer.isCharging && !isInputHeld) {
        // Release to Launch!
        curPlayer.isCharging = false;
        this.launchCurrentStone(curPlayer, width, height);
      }
    } else if (activeMovingStone) {
      // 3. Sweeping Phase: mash space or action to vigorously melt ice
      const shooter = this.playersState.get(activeMovingStone.playerId);
      const isShooterBot = shooter ? this.getPlayer(shooter.id)?.type.startsWith('bot_') : false;

      if (shooter && !isShooterBot) {
        const justAction = this.input.justAction(shooter.id) || this.input.justPressed(shooter.id);
        if (justAction) {
          this.triggerSweepAction();
        }
      }
    }

    // 4. Update Stone Physics & Curving
    let anyMovedThisFrame = false;
    for (const s of this.stones) {
      if (!s.isMoving || s.isOut) continue;

      anyMovedThisFrame = true;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Authentic curl trajectory (curl rate increases as stone decelerates)
      const currentSpeed = Math.hypot(s.vx, s.vy);
      const curlIntensity = Math.min(2.5, 30 / (currentSpeed + 12));
      s.vy += s.curlRate * curlIntensity * dt;

      // Stone rotation animation
      s.rotation += s.rotSpeed * dt;

      // Dynamic ice friction (reduced when active sweeping occurs)
      let friction = 0.975;
      if (s.isMoving && this.isSweepActive) {
        friction = 0.988; // 35% friction reduction from vigorous sweeping!
      }
      s.vx *= Math.pow(friction, dt * 60);
      s.vy *= Math.pow(friction, dt * 60);

      // Stop condition
      if (currentSpeed < 8) {
        s.vx = 0;
        s.vy = 0;
        s.isMoving = false;
        s.rotSpeed = 0;
        this.isSweepActive = false;

        // Hog line check: stones that fail to cross the hog line (width * 0.58) are removed
        const hogLineX = width * 0.58;
        if (s.x < hogLineX) {
          s.isHogged = true;
          s.isOut = true;
          this.audio.playExplosion();
          this.particles.showFloatingText('❌ HOGGED! (SHORT)', s.x, s.y - 20, '#EF4444', 20);
        }
      }

      // Sheet boundary cushions (side bumpers)
      const topBound = 46;
      const botBound = height - 46;
      if (s.y - s.radius < topBound) {
        s.y = topBound + s.radius;
        s.vy = -s.vy * 0.55;
        this.audio.playBounce();
      } else if (s.y + s.radius > botBound) {
        s.y = botBound - s.radius;
        s.vy = -s.vy * 0.55;
        this.audio.playBounce();
      }

      // Back line boundary: stones passing beyond the back line are out of play
      const backLineX = this.houseX + this.houseRadius + 45;
      if (s.x > backLineX) {
        s.isOut = true;
        s.isMoving = false;
        s.vx = 0;
        s.vy = 0;
        this.particles.showFloatingText('OUT OF PLAY', s.x, s.y - 20, '#94A3B8', 18);
      }
    }

    // 5. Elastic Granite Collisions Between Stones
    for (let i = 0; i < this.stones.length; i++) {
      for (let j = i + 1; j < this.stones.length; j++) {
        const s1 = this.stones[i];
        const s2 = this.stones[j];
        if (s1.isOut || s2.isOut) continue;

        const dx = s2.x - s1.x;
        const dy = s2.y - s1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = s1.radius + s2.radius;

        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Push apart to prevent overlap
          const overlap = minDist - dist;
          s1.x -= nx * overlap * 0.5;
          s1.y -= ny * overlap * 0.5;
          s2.x += nx * overlap * 0.5;
          s2.y += ny * overlap * 0.5;

          // Normal relative velocity
          const rvx = s1.vx - s2.vx;
          const rvy = s1.vy - s2.vy;
          const velAlongNormal = rvx * nx + rvy * ny;

          if (velAlongNormal > 0) {
            const restitution = 0.92;
            const impulse = ((1 + restitution) * velAlongNormal) / (s1.mass + s2.mass);

            s1.vx -= impulse * s2.mass * nx;
            s1.vy -= impulse * s2.mass * ny;
            s2.vx += impulse * s1.mass * nx;
            s2.vy += impulse * s1.mass * ny;

            s1.isMoving = true;
            s2.isMoving = true;
            s1.rotSpeed = (Math.random() - 0.5) * 4;
            s2.rotSpeed = (Math.random() - 0.5) * 4;

            this.audio.playBounce();
            this.particles.shake(4);
            this.particles.spawnSparks((s1.x + s2.x) / 2, (s1.y + s2.y) / 2, '#FFFFFF', 10);

            // Announce takeout if stone had significant velocity
            if (velAlongNormal > 180) {
              this.particles.showFloatingText('💥 TAKEOUT!', (s1.x + s2.x) / 2, (s1.y + s2.y) / 2 - 25, '#F59E0B', 22);
            }
          }
        }
      }
    }

    // 6. Calculate Real-Time Proximity to Center Pin & Update Shot Stone
    this.calculateHouseScores();

    // 7. Advance Turn Once All Stones Come to a Complete Rest
    const anyStoneMoving = this.stones.some((s) => s.isMoving);
    if (this.stoneLaunched && !anyStoneMoving) {
      this.stoneLaunched = false;
      this.isSweepActive = false;
      this.currentTurnIndex++;

      if (this.currentTurnIndex >= this.turnOrder.length) {
        // End is finished!
        this.endCompleteTimer = 2.5; // 2.5s celebration and end score display
      }
    }

    if (this.roundTimer <= 0) {
      this.calculateEndScores();
      this.isFinished = true;
    }
  }

  public launchCurrentStone(curPlayer: CurlingPlayer, width: number, height: number): void {
    if (this.stoneLaunched || curPlayer.stonesRemaining <= 0) return;

    const startX = width * 0.12;
    const startY = height * 0.5;
    const power = Math.max(160, Math.min(640, curPlayer.launchPower));
    const angle = curPlayer.aimAngle;
    const curlDir = Math.random() < 0.5 ? -1 : 1;
    const curlRate = curlDir * (1.8 + Math.random() * 2.2);

    const stone: CurlingStone = {
      id: this.stones.length,
      playerId: curPlayer.id,
      x: startX,
      y: startY,
      vx: Math.cos(angle) * power,
      vy: Math.sin(angle) * power,
      radius: 14,
      mass: 2.4,
      curlRate,
      rotation: 0,
      rotSpeed: curlDir * 2.5,
      isMoving: true,
      score: 0,
      isShotStone: false,
      distToPin: 9999,
      isHogged: false,
      isOut: false
    };

    this.stones.push(stone);
    curPlayer.launchPower = 0;
    curPlayer.isCharging = false;
    curPlayer.stonesRemaining -= 1;
    this.stoneLaunched = true;
    this.isSweepActive = false;

    this.audio.playLaser();
    this.particles.spawnSparks(startX, startY, '#BAE6FD', 12);
  }

  public triggerSweepAction(): void {
    const activeMovingStone = this.stones.find((s) => s.isMoving && !s.isOut);
    if (!activeMovingStone) return;

    this.isSweepActive = true;
    this.audio.playTap();

    // Spawn vigorous ice sweeping frost particles
    const sweepX = activeMovingStone.x + activeMovingStone.vx * 0.06;
    const sweepY = activeMovingStone.y + activeMovingStone.vy * 0.06;
    this.particles.spawnSparks(sweepX, sweepY, '#38BDF8', 6);
  }

  private calculateHouseScores(): void {
    let closestDist = 99999;
    let closestStoneId: number | null = null;

    for (const s of this.stones) {
      if (s.isOut || s.isHogged) {
        s.score = 0;
        s.isShotStone = false;
        continue;
      }

      const dist = Math.hypot(s.x - this.houseX, s.y - this.houseY);
      s.distToPin = dist;

      if (dist <= this.houseRadius) {
        // Scoring rings
        let pts = 50;
        if (dist < this.houseRadius * 0.22) pts = 500; // Pin / Button
        else if (dist < this.houseRadius * 0.46) pts = 300; // 4-Foot
        else if (dist < this.houseRadius * 0.74) pts = 150; // 8-Foot
        s.score = pts;

        if (dist < closestDist) {
          closestDist = dist;
          closestStoneId = s.id;
        }
      } else {
        s.score = 0;
      }
    }

    this.shotStoneId = closestStoneId;
    for (const s of this.stones) {
      s.isShotStone = s.id === closestStoneId;
    }
  }

  private calculateEndScores(): void {
    this.calculateHouseScores();

    // Official Curling Scoring: The team with the stone closest to the button wins the end
    if (this.shotStoneId !== null) {
      const winningStone = this.stones.find((s) => s.id === this.shotStoneId);
      if (winningStone) {
        const winningPid = winningStone.playerId;
        const winner = this.playersState.get(winningPid);

        // Find closest stone of the opposing players
        const opponentStones = this.stones.filter((s) => s.playerId !== winningPid && !s.isOut && !s.isHogged);
        let minOpponentDist = this.houseRadius;
        for (const os of opponentStones) {
          if (os.distToPin < minOpponentDist) {
            minOpponentDist = os.distToPin;
          }
        }

        // Count stones of winner closer than the closest opponent stone
        const winningStonesCount = this.stones.filter(
          (s) => s.playerId === winningPid && !s.isOut && s.distToPin < minOpponentDist
        ).length;

        const pointsAwarded = Math.max(1, winningStonesCount) * 200;
        if (winner) {
          winner.endsWon++;
          winner.score += pointsAwarded;
        }

        this.audio.playFanfare();
        this.particles.showFloatingText(
          `🏆 END ${this.currentEnd} TO P${winningPid + 1}! (+${pointsAwarded})`,
          this.houseX,
          this.houseY - 60,
          this.players[winningPid].color,
          26
        );
      }
    }
  }

  private resetNextEnd(width: number, height: number): void {
    this.stones = [];
    this.currentTurnIndex = 0;
    this.stoneLaunched = false;
    this.shotStoneId = null;
    this.isSweepActive = false;

    for (const ps of this.playersState.values()) {
      ps.stonesRemaining = this.stonesPerPlayer;
      ps.aimAngle = 0;
      ps.launchPower = 0;
      ps.isCharging = false;
    }

    this.setupTurnOrder();
    this.particles.showFloatingText(`❄️ STARTING END ${this.currentEnd}!`, width / 2, height * 0.5, '#38BDF8', 28);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const currentPid = this.turnOrder[this.currentTurnIndex];
    const isMyTurn = currentPid === botId;
    const bot = this.playersState.get(botId);
    if (!bot) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;

    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    // Reaction interval based on difficulty
    const reactionDelay = difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.16 : 0.32;
    this.botReactionTimers.set(botId, reactionDelay);

    const activeMovingStone = this.stones.find((s) => s.isMoving && !s.isOut);

    // 1. AIM & LAUNCH DECISION
    if (isMyTurn && !activeMovingStone && bot.stonesRemaining > 0 && !this.stoneLaunched) {
      // Analyze current board state: does opponent hold the shot stone?
      const opponentStoneInHouse = this.stones.find(
        (s) => s.playerId !== botId && !s.isOut && s.distToPin < this.houseRadius * 0.5
      );

      const distToHouse = this.houseX - width * 0.12;
      // Physics formula: v0 = sqrt(2 * a * d) ~ 460px/s to reach button
      const baseOptimalPower = 475;

      let targetPower = baseOptimalPower;
      let targetAngle = 0;

      if (opponentStoneInHouse && (difficulty !== 'bot_easy' || Math.random() < 0.5)) {
        // TACTICAL TAKEOUT: Increase velocity and aim directly at opponent stone!
        const dx = opponentStoneInHouse.x - width * 0.12;
        const dy = opponentStoneInHouse.y - height * 0.5;
        targetAngle = Math.atan2(dy, dx);
        targetPower = baseOptimalPower * 1.25; // High velocity takeout
      } else {
        // DRAW TO THE BUTTON: Precision weight to stop in center
        targetAngle = (Math.random() - 0.5) * 0.06;
        targetPower = baseOptimalPower + (Math.random() - 0.5) * 15;
      }

      // Add difficulty variance
      if (difficulty === 'bot_easy') {
        targetPower += (Math.random() - 0.5) * 120;
        targetAngle += (Math.random() - 0.5) * 0.28;
      } else if (difficulty === 'bot_normal') {
        targetPower += (Math.random() - 0.5) * 40;
        targetAngle += (Math.random() - 0.5) * 0.08;
      } else {
        targetPower += (Math.random() - 0.5) * 12;
        targetAngle += (Math.random() - 0.5) * 0.02;
      }

      bot.aimAngle = Math.max(-0.48, Math.min(0.48, targetAngle));
      bot.launchPower = targetPower;
      this.launchCurrentStone(bot, width, height);
      return;
    }

    // 2. ACTIVE SWEEPING DECISION
    if (activeMovingStone && activeMovingStone.playerId === botId) {
      // If stone is coming up short of house or hog line, vigorously sweep!
      const distToPin = Math.hypot(activeMovingStone.x - this.houseX, activeMovingStone.y - this.houseY);
      const hogLineX = width * 0.58;

      const needsSweeping =
        (activeMovingStone.x < hogLineX && activeMovingStone.vx < 260) ||
        (activeMovingStone.x < this.houseX && activeMovingStone.vx < 160 && distToPin > this.houseRadius * 0.3);

      const sweepChance = difficulty === 'bot_hard' ? 0.90 : difficulty === 'bot_normal' ? 0.65 : 0.25;
      if (needsSweeping && Math.random() < sweepChance) {
        this.triggerSweepAction();
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    this.calculateHouseScores();

    const scores = this.getActivePlayers().map((p) => {
      const ps = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: ps?.score || 0,
        endsWon: ps?.endsWon || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topPts = scores[0]?.score || 0;
    const mvpHighlight =
      winnerId !== null
        ? `Player ${winnerId + 1} clinched the Olympic curling gold with ${topPts} points!`
        : 'Draw! Both teams tied on the ice sheet!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Olympic Ice Coliseum Sheet
    const iceGrad = ctx.createLinearGradient(0, 0, width, height);
    iceGrad.addColorStop(0, '#F0F9FF');
    iceGrad.addColorStop(0.3, '#E0F2FE');
    iceGrad.addColorStop(0.7, '#BAE6FD');
    iceGrad.addColorStop(1, '#93C5FD');
    ctx.fillStyle = iceGrad;
    ctx.fillRect(0, 0, width, height);

    // Ice pebble texture
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let x = 30; x < width - 30; x += 40) {
      for (let y = 50; y < height - 50; y += 40) {
        ctx.fillRect(x + (y % 8), y, 2, 2);
      }
    }

    // Side wooden bumpers
    ctx.fillStyle = '#78350F';
    ctx.fillRect(0, 0, width, 40);
    ctx.fillRect(0, height - 40, width, 40);
    ctx.fillStyle = '#92400E';
    ctx.fillRect(0, 36, width, 4);
    ctx.fillRect(0, height - 40, width, 4);

    // Center longitudinal line
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(width * 0.08, height * 0.5);
    ctx.lineTo(width * 0.95, height * 0.5);
    ctx.stroke();

    // The Hack (Starting foot-hold board)
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(width * 0.08 - 8, height * 0.5 - 24, 8, 48);
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(width * 0.08 - 6, height * 0.5 - 20, 4, 18);
    ctx.fillRect(width * 0.08 - 6, height * 0.5 + 2, 4, 18);

    // The Hog Line (Solid Royal Blue)
    const hogX = width * 0.58;
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(hogX, 40);
    ctx.lineTo(hogX, height - 40);
    ctx.stroke();

    ctx.fillStyle = '#1E40AF';
    ctx.font = '900 10px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HOG LINE', hogX, 32);

    // Tee Line (Crossing through House)
    const hX = this.houseX;
    const hY = this.houseY;
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hX, 40);
    ctx.lineTo(hX, height - 40);
    ctx.stroke();

    // Back Line
    const backLineX = hX + this.houseRadius + 30;
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(backLineX, 40);
    ctx.lineTo(backLineX, height - 40);
    ctx.stroke();

    // 2. The House (Olympic Rings Target)
    // 12-foot ring (Royal Blue)
    ctx.fillStyle = '#1D4ED8';
    ctx.beginPath();
    ctx.arc(hX, hY, this.houseRadius, 0, Math.PI * 2);
    ctx.fill();

    // 8-foot ring (Pure White)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(hX, hY, this.houseRadius * 0.74, 0, Math.PI * 2);
    ctx.fill();

    // 4-foot ring (Crimson Red)
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(hX, hY, this.houseRadius * 0.46, 0, Math.PI * 2);
    ctx.fill();

    // Center Button (White with Gold Pin)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(hX, hY, this.houseRadius * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(hX, hY, 5, 0, Math.PI * 2);
    ctx.fill();

    // 3. Sweeping Crew Animation
    const movingStone = this.stones.find((s) => s.isMoving && !s.isOut);
    if (movingStone && this.isSweepActive) {
      const cfg = this.players.find((x) => x.id === movingStone.playerId);
      const color = cfg ? cfg.color : '#3B82F6';

      // Draw two sweeping crew members with brooms ahead of the stone
      const sx = movingStone.x + 32;
      const sy1 = movingStone.y - 18;
      const sy2 = movingStone.y + 18;
      const sweepOffset = Math.sin(this.sweepParticlesTimer * 28) * 8;

      ctx.save();
      // Sweeper 1
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx, sy1, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx, sy1);
      ctx.lineTo(sx - 14 + sweepOffset, sy1 + 10);
      ctx.stroke();

      // Sweeper 2
      ctx.beginPath();
      ctx.arc(sx, sy2, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(sx, sy2);
      ctx.lineTo(sx - 14 - sweepOffset, sy2 - 10);
      ctx.stroke();

      ctx.restore();
    }

    // 4. Draw Granite Curling Stones
    for (const s of this.stones) {
      if (s.isOut) continue;

      const cfg = this.players.find((x) => x.id === s.playerId);
      const color = cfg ? cfg.color : '#FFFFFF';

      ctx.save();
      // Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + 5, s.radius * 1.05, s.radius * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();

      // Granite stone body (circular metallic sheen)
      const stoneGrad = ctx.createRadialGradient(s.x - 3, s.y - 3, 2, s.x, s.y, s.radius);
      stoneGrad.addColorStop(0, '#E2E8F0');
      stoneGrad.addColorStop(0.4, '#64748B');
      stoneGrad.addColorStop(1, '#334155');

      ctx.fillStyle = stoneGrad;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();

      // Outer polished edge
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Colored ergonomic team handle (oriented by rotation)
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-9, -4.5, 18, 9, 3);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();
      ctx.restore();

      ctx.restore();

      // Golden Crown over current "Shot Stone" (closest to pin)
      if (s.isShotStone && s.score > 0) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👑', s.x, s.y - s.radius - 8);

        // Dashed measurement line from stone to pin
        ctx.save();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(hX, hY);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 5. Aim & Power Meter for Active Shooter
    const currentPid = this.turnOrder[this.currentTurnIndex];
    const curPlayer = currentPid !== undefined ? this.playersState.get(currentPid) : null;
    const isBot = curPlayer ? this.getPlayer(curPlayer.id)?.type.startsWith('bot_') : false;
    const activeMoving = this.stones.some((s) => s.isMoving);

    if (curPlayer && !activeMoving && this.currentTurnIndex < this.turnOrder.length) {
      const cfg = this.players.find((x) => x.id === curPlayer.id);
      const color = cfg ? cfg.color : '#FFFFFF';
      const startX = width * 0.12;
      const startY = height * 0.5;

      ctx.save();

      // Predicted trajectory curve with curl anticipation
      const aimDist = 120 + (curPlayer.launchPower / 640) * 160;
      const targetX = startX + Math.cos(curPlayer.aimAngle) * aimDist;
      const targetY = startY + Math.sin(curPlayer.aimAngle) * aimDist;

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(
        (startX + targetX) / 2,
        (startY + targetY) / 2 + 10,
        targetX,
        targetY
      );
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(targetX, targetY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Power Gauge Bar over shooter
      const meterW = 120;
      const meterH = 14;
      const meterX = startX - 20;
      const meterY = startY - 50;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(meterX, meterY, meterW, meterH, 4);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Optimal power target zone marker (Button weight)
      const optMinX = meterX + (430 / 640) * meterW;
      const optMaxX = meterX + (510 / 640) * meterW;
      ctx.fillStyle = 'rgba(34, 197, 94, 0.45)';
      ctx.fillRect(optMinX, meterY + 1, optMaxX - optMinX, meterH - 2);

      // Charged fill
      const fillW = (curPlayer.launchPower / 640) * (meterW - 2);
      ctx.fillStyle = curPlayer.launchPower > 520 ? '#EF4444' : curPlayer.launchPower > 430 ? '#22C55E' : '#38BDF8';
      ctx.fillRect(meterX + 1, meterY + 1, fillW, meterH - 2);

      // Label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      const prompt = isBot ? 'BOT AIMING...' : curPlayer.isCharging ? 'RELEASE TO LAUNCH!' : 'HOLD SPACE TO CHARGE';
      ctx.fillText(prompt, meterX + meterW / 2, meterY - 6);

      ctx.restore();
    }

    // 6. Draw On-Screen Touch Buttons (for mobile/tablet)
    if (!activeMoving && curPlayer && !isBot) {
      this.renderTouchButton(ctx, this.touchBtns.aimLeft, '⬅️ CURL', '#1E293B');
      this.renderTouchButton(ctx, this.touchBtns.aimRight, 'CURL ➡️', '#1E293B');
      this.renderTouchButton(ctx, this.touchBtns.launch, curPlayer.isCharging ? 'RELEASE!' : '🚀 LAUNCH', '#2563EB');
    } else if (activeMoving) {
      this.renderTouchButton(ctx, this.touchBtns.sweep, '🧹 SWEEP!', '#059669', true);
    }

    // 7. Draw HUD
    this.renderHUD(ctx, width, height);
  }

  private renderTouchButton(
    ctx: CanvasRenderingContext2D,
    btn: { x: number; y: number; w: number; h: number },
    label: string,
    bgColor: string,
    pulsing: boolean = false
  ): void {
    ctx.save();
    const scale = pulsing ? 1 + Math.sin(performance.now() * 0.012) * 0.04 : 1;
    ctx.translate(btn.x + btn.w / 2, btn.y + btn.h / 2);
    ctx.scale(scale, scale);

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(-btn.w / 2, -btn.h / 2, btn.w, btn.h, 8);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, _height: number): void {
    ctx.save();
    // End & Timer badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 75, 12, 150, 36, 10);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`END ${this.currentEnd}/${this.maxEnds} • ${Math.ceil(this.roundTimer)}s`, width * 0.5, 30);

    // Score sub-bar
    const active = this.getActivePlayers();
    const itemW = 110;
    const subBarW = active.length * itemW;
    const subBarX = width * 0.5 - subBarW * 0.5;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(subBarX, 54, subBarW, 26, 6);
    ctx.fill();

    const currentPid = this.turnOrder[this.currentTurnIndex];

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      const px = subBarX + idx * itemW + itemW / 2;
      const isTurn = p.id === currentPid && this.currentTurnIndex < this.turnOrder.length;
      ctx.fillStyle = p.color;
      ctx.font = isTurn ? '900 12px Montserrat, sans-serif' : 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const indicator = isTurn ? '▶ ' : '';
      ctx.fillText(`${indicator}P${p.id + 1}: 🥌${ps?.score || 0} (⭐${ps?.endsWon || 0})`, px, 67);
    });

    ctx.restore();
  }
}
