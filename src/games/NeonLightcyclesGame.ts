import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';
import { CharacterMood } from '../core/CharacterRenderer';

export interface LightcycleTheme {
  name: string;
  bgGradTop: string;
  bgGradBot: string;
  gridColor: string;
  barrierColor: string;
  barrierFill: string;
  wallColor: string;
  wallGlow: string;
  accentColor: string;
  pylonColor: string;
}

export const LIGHTCYCLE_THEMES: LightcycleTheme[] = [
  {
    name: 'Cyber Grid 80s ⚡',
    bgGradTop: '#040711',
    bgGradBot: '#080E21',
    gridColor: 'rgba(56, 189, 248, 0.08)',
    barrierColor: '#38BDF8',
    barrierFill: 'rgba(6, 182, 212, 0.22)',
    wallColor: '#06B6D4',
    wallGlow: 'rgba(6, 182, 212, 0.5)',
    accentColor: '#38BDF8',
    pylonColor: '#38BDF8'
  },
  {
    name: 'Synthwave Sunset 🌅',
    bgGradTop: '#180527',
    bgGradBot: '#2D0A4E',
    gridColor: 'rgba(236, 72, 153, 0.12)',
    barrierColor: '#F43F5E',
    barrierFill: 'rgba(244, 63, 94, 0.22)',
    wallColor: '#EC4899',
    wallGlow: 'rgba(236, 72, 153, 0.5)',
    accentColor: '#F472B6',
    pylonColor: '#FBBF24'
  },
  {
    name: 'Toxic Matrix ☣️',
    bgGradTop: '#020A05',
    bgGradBot: '#05180C',
    gridColor: 'rgba(34, 197, 94, 0.10)',
    barrierColor: '#22C55E',
    barrierFill: 'rgba(34, 197, 94, 0.20)',
    wallColor: '#10B981',
    wallGlow: 'rgba(16, 185, 129, 0.5)',
    accentColor: '#4ADE80',
    pylonColor: '#22C55E'
  }
];

interface TrailPoint {
  x: number;
  y: number;
}

interface Lightcycle {
  id: PlayerId;
  x: number;
  y: number;
  dirIndex: number; // 0: Right, 1: Down, 2: Left, 3: Up
  speed: number;
  alive: boolean;
  trail: TrailPoint[];
  boostTimer: number;
  turnCooldown: number;
  jumpCharges: number;
  isJumping: boolean;
  jumpAnim: number; // 0 to 1
  hasUnderdogShield: boolean;
  shieldInvulnTimer: number;
}

interface PowerPickup {
  id: number;
  type: 'boost' | 'eraser' | 'jump';
  x: number;
  y: number;
}

const DIRS = [
  { dx: 1, dy: 0 },  // 0: Right
  { dx: 0, dy: 1 },  // 1: Down
  { dx: -1, dy: 0 }, // 2: Left
  { dx: 0, dy: -1 }  // 3: Up
];

export class NeonLightcyclesGame extends BaseGame {
  private cycles: Map<PlayerId, Lightcycle> = new Map();
  private pickups: PowerPickup[] = [];
  private arenaBounds = { x: 70, y: 70, w: 0, h: 0 };
  private pickupCooldown: number = 2.0;
  private barriers: { x: number; y: number; w: number; h: number }[] = [];
  public currentMapName: string = 'Quad Pillars';

  // Procedural Theme & Event Listeners
  private currentThemeIndex: number = 0;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private pointerdownListener: ((e: PointerEvent) => void) | null = null;

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  public destroy(): void {
    this.removeListeners();
    super.destroy();
    if (typeof window !== 'undefined' && (window as unknown as { __LIGHTCYCLES_DEBUG__?: unknown }).__LIGHTCYCLES_DEBUG__) {
      delete (window as unknown as { __LIGHTCYCLES_DEBUG__?: unknown }).__LIGHTCYCLES_DEBUG__;
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isFinished) return;
      if (e.code === 'KeyT') {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % LIGHTCYCLE_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.pointerdownListener = (e: PointerEvent) => {
      if (this.isFinished) return;
      const canvas = e.target as HTMLCanvasElement;
      if (!canvas || !canvas.getBoundingClientRect) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // Theme pill is at x: 20, y: canvas.height - 44, w: 170, h: 32
      if (clickX >= 20 && clickX <= 190 && clickY >= canvas.height - 44 && clickY <= canvas.height - 12) {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % LIGHTCYCLE_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('pointerdown', this.pointerdownListener);
  }

  private removeListeners(): void {
    if (typeof window === 'undefined') return;
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
    if (this.pointerdownListener) {
      window.removeEventListener('pointerdown', this.pointerdownListener);
      this.pointerdownListener = null;
    }
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 60;
    this.isFinished = false;
    this.cycles.clear();
    this.pickups = [];
    this.pickupCooldown = 2.5;

    this.arenaBounds = {
      x: 75,
      y: 75,
      w: width - 150,
      h: height - 150
    };

    // Procedural Cyber Grid Barrier Map Generation
    this.generateRandomMap(width / 2, height / 2, this.arenaBounds.w, this.arenaBounds.h);

    const active = this.getActivePlayers();

    // Trailing players get 1 Underdog Quantum Shield charge
    active.forEach((p, idx) => {
      let startX = this.arenaBounds.x + 80;
      let startY = this.arenaBounds.y + 80;
      let startDir = 0; // Right

      if (idx === 1) {
        startX = this.arenaBounds.x + this.arenaBounds.w - 80;
        startY = this.arenaBounds.y + 80;
        startDir = 1; // Down
      } else if (idx === 2) {
        startX = this.arenaBounds.x + 80;
        startY = this.arenaBounds.y + this.arenaBounds.h - 80;
        startDir = 3; // Up
      } else if (idx === 3) {
        startX = this.arenaBounds.x + this.arenaBounds.w - 80;
        startY = this.arenaBounds.y + this.arenaBounds.h - 80;
        startDir = 2; // Left
      }

      this.cycles.set(p.id, {
        id: p.id,
        x: startX,
        y: startY,
        dirIndex: startDir,
        speed: 180,
        alive: true,
        trail: [
          { x: startX, y: startY },
          { x: startX, y: startY }
        ],
        boostTimer: 0,
        turnCooldown: 0,
        jumpCharges: 2,
        isJumping: false,
        jumpAnim: 0,
        hasUnderdogShield: idx > 0, // trailing players receive Quantum Shield
        shieldInvulnTimer: 0
      });
    });

    // Debug hook for automated testing and inspection
    (window as unknown as { __LIGHTCYCLES_DEBUG__?: unknown }).__LIGHTCYCLES_DEBUG__ = {
      getCycles: () =>
        Array.from(this.cycles.values()).map((c) => ({
          id: c.id,
          x: c.x,
          y: c.y,
          dirIndex: c.dirIndex,
          alive: c.alive,
          trailLength: c.trail.length,
          trail: c.trail.map((pt) => ({ x: Math.round(pt.x), y: Math.round(pt.y) }))
        })),
      getArena: () => ({ ...this.arenaBounds }),
      killCycle: (id: PlayerId) => {
        const c = this.cycles.get(id);
        if (c) this.eliminateCycle(c);
      }
    };

    // Spawn 1 initial boost pickup and 1 jump battery
    this.pickups.push(
      {
        id: 1,
        type: 'boost',
        x: width / 2 - 40,
        y: height / 2
      },
      {
        id: 2,
        type: 'jump',
        x: width / 2 + 40,
        y: height / 2
      }
    );
  }

  private generateRandomMap(cx: number, cy: number, bw: number, bh: number): void {
    const archetypes = ['Quad Pillars', 'Cyber Diamond', 'Slalom Gates', 'Open Circuit'];
    this.currentMapName = archetypes[Math.floor(Math.random() * archetypes.length)];
    this.barriers = [];

    switch (this.currentMapName) {
      case 'Quad Pillars':
        const pw = 40;
        const ph = 40;
        this.barriers.push(
          { x: cx - bw * 0.25 - pw / 2, y: cy - bh * 0.25 - ph / 2, w: pw, h: ph },
          { x: cx + bw * 0.25 - pw / 2, y: cy - bh * 0.25 - ph / 2, w: pw, h: ph },
          { x: cx - bw * 0.25 - pw / 2, y: cy + bh * 0.25 - ph / 2, w: pw, h: ph },
          { x: cx + bw * 0.25 - pw / 2, y: cy + bh * 0.25 - ph / 2, w: pw, h: ph }
        );
        break;

      case 'Cyber Diamond':
        const dw = 35;
        this.barriers.push(
          { x: cx - dw / 2, y: cy - bh * 0.22 - dw / 2, w: dw, h: dw },
          { x: cx - dw / 2, y: cy + bh * 0.22 - dw / 2, w: dw, h: dw },
          { x: cx - bw * 0.22 - dw / 2, y: cy - dw / 2, w: dw, h: dw },
          { x: cx + bw * 0.22 - dw / 2, y: cy - dw / 2, w: dw, h: dw }
        );
        break;

      case 'Slalom Gates':
        const gw = bw * 0.26;
        const gh = 18;
        this.barriers.push(
          { x: cx - bw * 0.35, y: cy - bh * 0.16, w: gw, h: gh },
          { x: cx + bw * 0.35 - gw, y: cy + bh * 0.16, w: gw, h: gh }
        );
        break;

      case 'Open Circuit':
      default:
        break;
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Spawn Pickups
    this.pickupCooldown -= dt;
    if (this.pickupCooldown <= 0 && this.pickups.length < 3) {
      this.pickupCooldown = 4.0 + Math.random() * 3.0;
      const roll = Math.random();
      const type: 'boost' | 'eraser' | 'jump' = roll < 0.45 ? 'boost' : roll < 0.75 ? 'jump' : 'eraser';
      const margin = 60;
      this.pickups.push({
        id: performance.now(),
        type,
        x: this.arenaBounds.x + margin + Math.random() * (this.arenaBounds.w - margin * 2),
        y: this.arenaBounds.y + margin + Math.random() * (this.arenaBounds.h - margin * 2)
      });
    }

    // Sudden Death Watchdog & Arena Compression
    this.updateStagnationWatchdog(dt);
    if (this.roundTimer <= 15) {
      // Rapid grid collapse during final 15s countdown
      const shrinkRate = 3.5 * dt;
      this.arenaBounds.x += shrinkRate;
      this.arenaBounds.y += shrinkRate;
      this.arenaBounds.w = Math.max(180, this.arenaBounds.w - shrinkRate * 2);
      this.arenaBounds.h = Math.max(180, this.arenaBounds.h - shrinkRate * 2);
    }

    // Update Cycles
    for (const c of this.cycles.values()) {
      if (!c.alive) continue;

      if (c.turnCooldown > 0) c.turnCooldown -= dt;
      if (c.boostTimer > 0) c.boostTimer -= dt;
      if (c.shieldInvulnTimer > 0) c.shieldInvulnTimer -= dt;

      // Jump Animation update
      if (c.isJumping) {
        c.jumpAnim += dt * 2.2;
        if (c.jumpAnim >= 1.0) {
          c.isJumping = false;
          c.jumpAnim = 0;
          // Connect new trail segment upon landing
          c.trail.push({ x: c.x, y: c.y });
        }
      }

      // Check Directional / 4-way steering input OR single-button tap
      const isBot = this.players[c.id]?.type.startsWith('bot_');
      if (!isBot) {
        const steerX = this.input.getSteer(c.id);
        const steerY = -this.input.getThrottle(c.id);

        let targetDir = -1;
        if (Math.abs(steerX) > 0.45) {
          targetDir = steerX > 0 ? 0 : 2;
        } else if (Math.abs(steerY) > 0.45) {
          targetDir = steerY > 0 ? 1 : 3;
        }

        // Direct 4-way turn (prevent 180° instant self-reversal)
        if (targetDir !== -1 && targetDir !== c.dirIndex && (targetDir + 2) % 4 !== c.dirIndex && c.turnCooldown <= 0) {
          c.dirIndex = targetDir;
          c.turnCooldown = 0.10;
          c.trail[c.trail.length - 1] = { x: c.x, y: c.y };
          c.trail.push({ x: c.x, y: c.y });
          this.audio.playTap();
        } else {
          // Single-Button tap turns 90° clockwise
          const turnPressed = this.input.justPressed(c.id);
          if (turnPressed && c.turnCooldown <= 0) {
            c.dirIndex = (c.dirIndex + 1) % 4;
            c.turnCooldown = 0.10;
            c.trail[c.trail.length - 1] = { x: c.x, y: c.y };
            c.trail.push({ x: c.x, y: c.y });
            this.audio.playTap();
          }
        }

        // Action button triggers Trail Jump
        const actionPressed = this.input.justAction(c.id);
        if (actionPressed && !c.isJumping && c.jumpCharges > 0) {
          c.isJumping = true;
          c.jumpAnim = 0;
          c.jumpCharges--;
          this.audio.playBoost();
          this.particles.showFloatingText('🚀 TRAIL HOP!', c.x, c.y - 25, '#38BDF8', 20);
          this.particles.spawnSparks(c.x, c.y, '#38BDF8', 12);
        }
      }

      // Universal Anti-Loop Detection: prevent cycling in endless tight boxes
      this.trackAntiLoop(c.id, c.x, c.y, c.dirIndex * (Math.PI / 2), dt, 80, () => {
        c.boostTimer = 2.0;
        this.particles.showFloatingText('⚡ TURBO BREAKOUT!', c.x, c.y - 25, '#38BDF8', 18);
        this.particles.spawnSparks(c.x, c.y, '#38BDF8', 10);
        this.audio.playBoost();
      });

      // Move forward with progressive speed ramp (+15% every 15s to tighten matches)
      const speedRamp = 1.0 + Math.min(0.6, (60 - this.roundTimer) * 0.01);
      const currentSpeed = (c.boostTimer > 0 ? c.speed * 1.55 : c.speed) * speedRamp;
      const dir = DIRS[c.dirIndex];

      c.x += dir.dx * currentSpeed * dt;
      c.y += dir.dy * currentSpeed * dt;

      // Update current trail segment tip (only if not airborne in a jump)
      if (!c.isJumping) {
        const lastPoint = c.trail[c.trail.length - 1];
        if (lastPoint) {
          lastPoint.x = c.x;
          lastPoint.y = c.y;
        }
      }

      // Front nose position for collision detection
      const noseX = c.x + dir.dx * 12;
      const noseY = c.y + dir.dy * 12;

      // Boundary collision check
      const b = this.arenaBounds;
      if (noseX < b.x || noseX > b.x + b.w || noseY < b.y || noseY > b.y + b.h) {
        if (c.hasUnderdogShield) {
          this.shatterUnderdogShield(c);
        } else {
          this.eliminateCycle(c);
          continue;
        }
      }

      // Internal Cyber Barrier collision check
      let hitBarrier = false;
      for (const bar of this.barriers) {
        if (noseX >= bar.x && noseX <= bar.x + bar.w && noseY >= bar.y && noseY <= bar.y + bar.h) {
          hitBarrier = true;
          break;
        }
      }
      if (hitBarrier) {
        if (c.hasUnderdogShield) {
          this.shatterUnderdogShield(c);
        } else {
          this.eliminateCycle(c);
          continue;
        }
      }

      // Trail collision check (airborne jumps bypass trail collision!)
      if (!c.isJumping && c.shieldInvulnTimer <= 0 && this.checkTrailCollision(c)) {
        if (c.hasUnderdogShield) {
          this.shatterUnderdogShield(c);
        } else {
          this.eliminateCycle(c);
          continue;
        }
      }

      // Pickup collection check
      for (let pi = this.pickups.length - 1; pi >= 0; pi--) {
        const pk = this.pickups[pi];
        if (Math.hypot(c.x - pk.x, c.y - pk.y) < 24) {
          if (pk.type === 'boost') {
            c.boostTimer = 2.5;
            this.audio.playLaser();
            this.particles.showFloatingText('SPEED SURGE! ⚡', c.x, c.y - 20, '#06B6D4', 20);
            this.particles.spawnSparks(pk.x, pk.y, '#06B6D4', 16);
          } else if (pk.type === 'jump') {
            c.jumpCharges = Math.min(3, c.jumpCharges + 1);
            this.audio.playFanfare();
            this.particles.showFloatingText('+1 HOP CHARGE! 🚀', c.x, c.y - 20, '#38BDF8', 20);
            this.particles.spawnSparks(pk.x, pk.y, '#38BDF8', 16);
          } else {
            this.audio.playExplosion();
            this.particles.showFloatingText('TRAIL CLEARED! 💥', c.x, c.y - 20, '#F59E0B', 20);
            this.particles.spawnSparks(pk.x, pk.y, '#F59E0B', 24);
            this.eraseTrailsNear(pk.x, pk.y, 90);
          }
          this.pickups.splice(pi, 1);
        }
      }
    }

    // Check round over (1 or fewer cycles alive)
    const aliveCount = Array.from(this.cycles.values()).filter((c) => c.alive).length;
    if (aliveCount <= 1 || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private shatterUnderdogShield(c: Lightcycle): void {
    c.hasUnderdogShield = false;
    c.shieldInvulnTimer = 1.4;
    this.eraseTrailsNear(c.x, c.y, 75);
    this.audio.playExplosion();
    this.particles.addTrauma(0.35);
    this.particles.spawnExplosion(c.x, c.y, '#FBBF24', 32);
    this.particles.showFloatingText('🛡️ QUANTUM SHIELD SAVED YOU!', c.x, c.y - 28, '#FBBF24', 22);
  }

  private eraseTrailsNear(cx: number, cy: number, radius: number): void {
    for (const c of this.cycles.values()) {
      const head = { x: c.x, y: c.y };
      const kept = c.trail.filter((pt) => Math.hypot(pt.x - cx, pt.y - cy) > radius);
      if (kept.length < 2) {
        c.trail = [{ x: c.x, y: c.y }, { x: c.x, y: c.y }];
      } else {
        kept[kept.length - 1] = head;
        c.trail = kept;
      }
    }
  }

  private eliminateCycle(c: Lightcycle): void {
    c.alive = false;
    this.audio.playExplosion();
    this.particles.spawnSparks(c.x, c.y, this.players[c.id].color, 25);
    this.particles.addTrauma(0.3);
    this.particles.showFloatingText('CRASH! 💥', c.x, c.y - 24, '#EF4444', 22);
  }

  private checkTrailCollision(cycle: Lightcycle): boolean {
    const dir = DIRS[cycle.dirIndex];
    const noseX = cycle.x + dir.dx * 12;
    const noseY = cycle.y + dir.dy * 12;
    const collisionThreshold = 6;

    // Check chassis-to-chassis collision with other cycles
    for (const other of this.cycles.values()) {
      if (other.id !== cycle.id && other.alive) {
        if (Math.hypot(noseX - other.x, noseY - other.y) < 14) {
          return true;
        }
      }
    }

    for (const other of this.cycles.values()) {
      const trail = other.trail;
      const isSelf = other.id === cycle.id;
      const maxIndex = isSelf ? trail.length - 2 : trail.length - 1;

      for (let i = 0; i < maxIndex; i++) {
        const p1 = trail[i];
        const p2 = trail[i + 1];
        if (!p1 || !p2) continue;

        if (isSelf && i === trail.length - 3) {
          const distFromCorner = Math.hypot(cycle.x - p2.x, cycle.y - p2.y);
          if (distFromCorner < 20) {
            continue;
          }
        }

        const dist = this.distToSegment(noseX, noseY, p1.x, p1.y, p2.x, p2.y);
        if (dist < collisionThreshold) {
          return true;
        }
      }
    }
    return false;
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const c = this.cycles.get(botId);
    if (!c || !c.alive || c.turnCooldown > 0) return;

    // Raycast lookahead distance based on difficulty
    const lookaheadDist = difficulty === 'bot_hard' ? 70 : difficulty === 'bot_normal' ? 48 : 30;
    const currentDir = DIRS[c.dirIndex];

    const aheadX = c.x + currentDir.dx * lookaheadDist;
    const aheadY = c.y + currentDir.dy * lookaheadDist;

    const b = this.arenaBounds;
    const isWallAhead = aheadX < b.x || aheadX > b.x + b.w || aheadY < b.y || aheadY > b.y + b.h;
    const isTrailAhead = this.isLineBlocked(c.x, c.y, aheadX, aheadY, c.id);

    if (isWallAhead || isTrailAhead) {
      // If path ahead is blocked, can bot jump over the trail?
      if (isTrailAhead && !isWallAhead && c.jumpCharges > 0 && !c.isJumping) {
        const jumpChance = difficulty === 'bot_hard' ? 0.85 : difficulty === 'bot_normal' ? 0.50 : 0.20;
        if (Math.random() < jumpChance) {
          c.isJumping = true;
          c.jumpAnim = 0;
          c.jumpCharges--;
          this.audio.playBoost();
          this.particles.showFloatingText('🚀 HOP!', c.x, c.y - 25, '#38BDF8', 18);
          return;
        }
      }

      // Check next clockwise turn
      const nextDirIndex = (c.dirIndex + 1) % 4;
      const nextDir = DIRS[nextDirIndex];
      const nextLookX = c.x + nextDir.dx * (lookaheadDist * 0.7);
      const nextLookY = c.y + nextDir.dy * (lookaheadDist * 0.7);

      const isNextWall = nextLookX < b.x || nextLookX > b.x + b.w || nextLookY < b.y || nextLookY > b.y + b.h;
      const isNextTrail = this.isLineBlocked(c.x, c.y, nextLookX, nextLookY, c.id);

      if (!isNextWall && !isNextTrail) {
        this.input.setBotInput(botId, true);
      } else {
        // Turn anyway
        this.input.setBotInput(botId, true);
      }
    } else {
      if (difficulty === 'bot_hard' && Math.random() < 0.015) {
        const nextDirIndex = (c.dirIndex + 1) % 4;
        const nextDir = DIRS[nextDirIndex];
        const nextX = c.x + nextDir.dx * lookaheadDist;
        const nextY = c.y + nextDir.dy * lookaheadDist;
        if (!this.isLineBlocked(c.x, c.y, nextX, nextY, c.id)) {
          this.input.setBotInput(botId, true);
          return;
        }
      }
      this.input.setBotInput(botId, false);
    }
  }

  private isLineBlocked(x1: number, y1: number, x2: number, y2: number, selfId: PlayerId): boolean {
    const steps = 8;
    for (let s = 1; s <= steps; s++) {
      const px = x1 + (x2 - x1) * (s / steps);
      const py = y1 + (y2 - y1) * (s / steps);

      for (const bar of this.barriers) {
        if (px >= bar.x && px <= bar.x + bar.w && py >= bar.y && py <= bar.y + bar.h) {
          return true;
        }
      }

      for (const other of this.cycles.values()) {
        const trail = other.trail;
        const isSelf = other.id === selfId;
        const maxIdx = isSelf ? trail.length - 2 : trail.length - 1;
        for (let i = 0; i < maxIdx; i++) {
          const tp1 = trail[i];
          const tp2 = trail[i + 1];
          if (!tp1 || !tp2) continue;
          if (isSelf && i === trail.length - 3) {
            const selfCycle = this.cycles.get(selfId);
            if (selfCycle && Math.hypot(selfCycle.x - tp2.x, selfCycle.y - tp2.y) < 20) {
              continue;
            }
          }
          if (this.distToSegment(px, py, tp1.x, tp1.y, tp2.x, tp2.y) < 8) {
            return true;
          }
        }
      }
    }
    return false;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const theme = LIGHTCYCLE_THEMES[this.currentThemeIndex];
    const isSuddenDeath = this.roundTimer <= 15;

    // 1. Digital Grid Floor Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBot);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Glowing grid lines
    ctx.strokeStyle = theme.gridColor;
    ctx.lineWidth = 1;
    const gridStep = 32;
    for (let x = 0; x < width; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Internal Cyber Grid Monoliths & Barriers
    for (const bar of this.barriers) {
      ctx.save();
      ctx.shadowColor = theme.wallColor;
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
      ctx.strokeStyle = theme.barrierColor;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(bar.x, bar.y, bar.w, bar.h);
      ctx.fillStyle = theme.barrierFill;
      ctx.fillRect(bar.x + 4, bar.y + 4, bar.w - 8, bar.h - 8);
      ctx.restore();
    }

    // Outer Neon Perimeter Containment Barrier
    const b = this.arenaBounds;
    ctx.save();
    ctx.shadowColor = isSuddenDeath ? '#EF4444' : theme.wallGlow;
    ctx.shadowBlur = isSuddenDeath ? 24 : 18;
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : theme.wallColor;
    ctx.lineWidth = isSuddenDeath ? 5.5 : 4;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.restore();

    // Corner Energy Pylons
    const corners = [
      [b.x, b.y],
      [b.x + b.w, b.y],
      [b.x, b.y + b.h],
      [b.x + b.w, b.y + b.h]
    ];
    for (const [cx, cy] of corners) {
      ctx.fillStyle = isSuddenDeath ? '#EF4444' : theme.pylonColor;
      ctx.beginPath();
      ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Power Pickups
    for (const pk of this.pickups) {
      ctx.save();
      const isBoost = pk.type === 'boost';
      const isJump = pk.type === 'jump';
      ctx.shadowColor = isBoost ? '#06B6D4' : isJump ? '#38BDF8' : '#F59E0B';
      ctx.shadowBlur = 16;
      ctx.fillStyle = isBoost ? '#0891B2' : isJump ? '#0284C7' : '#D97706';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isBoost ? '⚡' : isJump ? '🚀' : '💥', pk.x, pk.y);
      ctx.restore();
    }

    // 3. Render Solid Glowing Neon Light Trails
    for (const c of this.cycles.values()) {
      if (c.trail.length < 2) continue;
      const pColor = this.players[c.id]?.color || '#FFFFFF';

      ctx.save();
      ctx.shadowColor = pColor;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(c.trail[0].x, c.trail[0].y);
      for (let i = 1; i < c.trail.length; i++) {
        ctx.lineTo(c.trail[i].x, c.trail[i].y);
      }
      ctx.stroke();

      // Inner white core ribbon
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Render Lightcycles & Drivers
    for (const c of this.cycles.values()) {
      if (!c.alive) continue;
      const p = this.players[c.id];
      const pColor = p?.color || '#FFFFFF';

      ctx.save();
      ctx.translate(c.x, c.y);
      const angle = (c.dirIndex * Math.PI) / 2;
      ctx.rotate(angle);

      // Jump Height Scaling & Elevation Shadow
      const jumpScale = c.isJumping ? 1.0 + Math.sin(c.jumpAnim * Math.PI) * 0.45 : 1.0;
      ctx.scale(jumpScale, jumpScale);

      // Underdog Quantum Shield Aura
      if (c.hasUnderdogShield) {
        ctx.save();
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Lightcycle Body (Futuristic tron racer)
      ctx.shadowColor = pColor;
      ctx.shadowBlur = c.boostTimer > 0 ? 20 : 10;
      ctx.fillStyle = pColor;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-14, -7, 28, 14, 4);
      else ctx.rect(-14, -7, 28, 14);
      ctx.fill();

      // Cockpit Glow Strip
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-4, -3, 10, 6, 2);
      else ctx.rect(-4, -3, 10, 6);
      ctx.fill();

      // Front & Rear Hubless Wheels
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(8, -8, 5, 16);
      ctx.fillRect(-13, -8, 5, 16);

      // Boost Exhaust Flame
      if (c.boostTimer > 0) {
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.moveTo(-14, -4);
        ctx.lineTo(-24 - Math.random() * 6, 0);
        ctx.lineTo(-14, 4);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();

      // Mascot Driver Head on Cycle
      let mood: CharacterMood = 'focused';
      if (c.isJumping || c.boostTimer > 0) mood = 'happy';
      else if (c.shieldInvulnTimer > 0) mood = 'shocked';
      this.drawPlayerMascot(ctx, c.id, c.x, c.y - 18, 11, mood, performance.now() * 0.001);

      // Hop Charges & Tag
      ctx.save();
      const tagY = c.y + 18;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(c.x - 32, tagY - 9, 64, 18, 9);
      else ctx.rect(c.x - 32, tagY - 9, 64, 18);
      ctx.fill();
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const hops = '🚀'.repeat(c.jumpCharges);
      ctx.fillText(`${p.name.toUpperCase()} ${hops}`, c.x, tagY);
      ctx.restore();
    }

    // 5. Instruction Banner (Safely at y=56 below stopwatch timer)
    ctx.save();
    const pillW = 340;
    const pillH = 26;
    const pillX = width / 2 - pillW / 2;
    const pillY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 13);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#F87171' : theme.accentColor;
    ctx.font = '800 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const bannerMsg = isSuddenDeath
      ? '⚡ SUDDEN DEATH: GRID COLLAPSE! ⚡'
      : 'WASD / ARROWS TO STEER • SPACE TO HOP OVER TRAILS!';
    ctx.fillText(bannerMsg, width / 2, pillY + pillH / 2);
    ctx.restore();

    // 6. Interactive Bottom-Left Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, height - 44, 170, 32, 16);
    else ctx.rect(20, height - 44, 170, 32);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.accentColor;
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.name} [T]`, 20 + 85, height - 44 + 16);
    ctx.restore();

    // 7. On-screen Controls Pill (Offset to right, never overlapping theme pill)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.font = '600 11px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('WASD / Arrows Steer • Tap Turn 90° • Action Hop Over Trails', width - 24, height - 28);
    ctx.restore();

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const list = Array.from(this.cycles.values()).sort((a, b) => (b.alive ? 1 : 0) - (a.alive ? 1 : 0));
    const winner = list.find((c) => c.alive);
    const winnerId = winner ? winner.id : null;
    return {
      winnerId,
      rankings: list.map((c, idx) => ({ playerId: c.id, score: c.alive ? 100 : 0, place: idx + 1 })),
      mvpHighlight:
        winnerId !== null
          ? `${this.players[winnerId].name} out-maneuvered all rivals in the neon grid!`
          : 'Total lightcycle collision!'
    };
  }
}
