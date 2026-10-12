import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';

export interface AnimalDef {
  id: string;
  name: string;
  width: number;
  height: number;
  mass: number;
  primaryColor: string;
  secondaryColor: string;
  badge: string;
}

export const ANIMAL_TYPES: AnimalDef[] = [
  { id: 'crocodile', name: 'Crocodile', width: 76, height: 24, mass: 35, primaryColor: '#059669', secondaryColor: '#047857', badge: '🐊' },
  { id: 'giraffe', name: 'Giraffe', width: 26, height: 74, mass: 28, primaryColor: '#F59E0B', secondaryColor: '#B45309', badge: '🦒' },
  { id: 'elephant', name: 'Elephant', width: 56, height: 44, mass: 45, primaryColor: '#64748B', secondaryColor: '#475569', badge: '🐘' },
  { id: 'turtle', name: 'Turtle', width: 48, height: 26, mass: 30, primaryColor: '#10B981', secondaryColor: '#065F46', badge: '🐢' },
  { id: 'pig', name: 'Pig', width: 42, height: 32, mass: 24, primaryColor: '#F472B6', secondaryColor: '#DB2777', badge: '🐷' },
  { id: 'duck', name: 'Duck', width: 32, height: 30, mass: 16, primaryColor: '#FBBF24', secondaryColor: '#D97706', badge: '🦆' },
  { id: 'frog', name: 'Frog', width: 26, height: 20, mass: 10, primaryColor: '#22C55E', secondaryColor: '#15803D', badge: '🐸' }
];

export interface StackedAnimal {
  type: AnimalDef;
  playerId: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  settled: boolean;
  angle: number; // 0, PI/2, PI, 3*PI/2
}

export class AnimalStackGame extends BaseGame {
  // Moored Sturdy Raft (Cannot tip!)
  private raftX: number = 0;
  private raftY: number = 0;
  private raftWidth: number = 260;
  private raftHeight: number = 24;
  private raftTilt: number = 0; // Constantly 0: raft cannot tip!

  // Overhead Crane
  private craneX: number = 0;
  private craneY: number = 66;
  private craneSpeed: number = 190;
  private craneDir: number = 1;
  private currentAnimalIndex: number = 0;
  private heldRotation: number = 0; // Active rotation angle for crane clamp
  private prevThrottle: number = 0;
  private rotateCooldown: number = 0;

  // Turn management & Player state
  private activePlayerIndex: number = 0;
  private activePlayerOrder: PlayerId[] = [];
  private playerEliminated: Map<PlayerId, boolean> = new Map();
  private playerScores: Map<PlayerId, number> = new Map();
  private playerLives: Map<PlayerId, number> = new Map();

  // Active stack & physics
  private animals: StackedAnimal[] = [];
  private fallingAnimal: StackedAnimal | null = null;
  private nextTurnTimer: number = 0;
  private waterWaveOffset: number = 0;
  private botDropDelay: number = 0;

  // Interactive On-screen Rotate Button bounds
  private rotateBtnRect = { x: 0, y: 0, w: 130, h: 32 };
  private rotateBtnHover: boolean = false;

  // Event handlers
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private pointerdownListener: ((e: PointerEvent) => void) | null = null;

  public static getExtents(def: AnimalDef, angle: number = 0) {
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    const effectiveW = cos * def.width + sin * def.height;
    const effectiveH = sin * def.width + cos * def.height;
    return {
      width: effectiveW,
      height: effectiveH,
      halfW: effectiveW / 2,
      halfH: effectiveH / 2
    };
  }

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  public destroy(): void {
    this.removeListeners();
    if (typeof window !== 'undefined' && (window as unknown as { __ANIMAL_STACK_DEBUG__?: unknown }).__ANIMAL_STACK_DEBUG__) {
      delete (window as unknown as { __ANIMAL_STACK_DEBUG__?: unknown }).__ANIMAL_STACK_DEBUG__;
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isFinished || this.fallingAnimal || this.nextTurnTimer > 0) return;
      const currentPid = this.activePlayerOrder[this.activePlayerIndex];

      // Key R rotates for any active human player
      // Key R rotates for any active human player
      if (e.code === 'KeyR') {
        this.rotateCurrentAnimal(1);
        return;
      }

      // Player 0 keys (W, S)
      if (currentPid === 0 && (e.code === 'KeyW' || e.code === 'KeyS')) {
        this.rotateCurrentAnimal(e.code === 'KeyW' ? 1 : -1);
        return;
      }

      // Player 1 keys (ArrowUp, ArrowDown)
      if (currentPid === 1 && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
        this.rotateCurrentAnimal(e.code === 'ArrowUp' ? 1 : -1);
        return;
      }

      // Drop keys: Space, Enter, or player action keys
      if (
        e.code === 'Space' ||
        (currentPid === 0 && (e.code === 'KeyF' || e.code === 'KeyE')) ||
        (currentPid === 1 && (e.code === 'Enter' || e.code === 'ShiftRight' || e.code === 'NumpadEnter'))
      ) {
        this.dropAnimal(currentPid);
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.pointerdownListener = (e: PointerEvent) => {
      if (this.isFinished || this.fallingAnimal || this.nextTurnTimer > 0) return;
      const canvas = document.querySelector('canvas');
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Check if tap hit the rotate button
      if (
        clickX >= this.rotateBtnRect.x - 20 &&
        clickX <= this.rotateBtnRect.x + this.rotateBtnRect.w + 20 &&
        clickY >= this.rotateBtnRect.y - 12 &&
        clickY <= this.rotateBtnRect.y + this.rotateBtnRect.h + 12
      ) {
        this.rotateCurrentAnimal(1);
        this.rotateBtnHover = true;
        setTimeout(() => { this.rotateBtnHover = false; }, 150);
        return;
      }

      // Only drop if tapped in the active playfield area (below top banner/HUD)
      if (clickY > 135) {
        const currentPid = this.activePlayerOrder[this.activePlayerIndex];
        this.dropAnimal(currentPid);
      }
    };
    window.addEventListener('pointerdown', this.pointerdownListener);

    // Expose debug interface for tests
    (window as unknown as { __ANIMAL_STACK_DEBUG__?: unknown }).__ANIMAL_STACK_DEBUG__ = {
      getAnimals: () => this.animals,
      getHeldAnimal: () => ANIMAL_TYPES[this.currentAnimalIndex],
      getHeldRotation: () => this.heldRotation,
      rotate: (dir = 1) => this.rotateCurrentAnimal(dir),
      drop: () => this.dropAnimal(this.activePlayerOrder[this.activePlayerIndex]),
      getRaftY: () => this.raftY,
      getRaftTopY: () => this.raftY - this.raftHeight / 2,
      getRaftTilt: () => this.raftTilt,
      getFallingAnimal: () => this.fallingAnimal,
      getLives: () => Object.fromEntries(this.playerLives.entries())
    };
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
    this.roundTimer = 75;
    this.isFinished = false;
    this.animals = [];
    this.fallingAnimal = null;
    this.nextTurnTimer = 0;
    this.heldRotation = 0;
    this.prevThrottle = 0;
    this.rotateCooldown = 0;

    const btnW = 146;
    const btnH = 30;
    this.rotateBtnRect = { x: width / 2 - btnW / 2, y: 94, w: btnW, h: btnH };

    this.raftX = width / 2;
    this.raftY = height - 90;
    this.raftTilt = 0; // Level and firmly moored

    this.craneX = width / 2;
    this.craneDir = 1;
    this.waterWaveOffset = 0;

    const activePlayers = this.players.filter((p) => p.type !== 'disabled').map((p) => p.id);
    this.activePlayerOrder = activePlayers.length > 0 ? activePlayers : [0, 1];
    this.activePlayerIndex = 0;
    this.playerEliminated.clear();
    this.playerScores.clear();
    this.playerLives.clear();

    for (const pid of this.activePlayerOrder) {
      this.playerEliminated.set(pid, false);
      this.playerScores.set(pid, 0);
      this.playerLives.set(pid, 3); // 3 drop lives per player
    }

    this.currentAnimalIndex = Math.floor(Math.random() * ANIMAL_TYPES.length);
    this.botDropDelay = 0.6;
  }

  public rotateCurrentAnimal(dir: number = 1): void {
    if (this.fallingAnimal || this.nextTurnTimer > 0) return;
    this.heldRotation = (this.heldRotation + dir * (Math.PI / 2)) % (Math.PI * 2);
    if (this.heldRotation < 0) this.heldRotation += Math.PI * 2;
    this.audio.playTap();
    this.particles.spawnSparks(this.craneX, this.craneY + 36, '#38BDF8', 6);
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.waterWaveOffset += dt * 2.5;
    if (this.rotateCooldown > 0) this.rotateCooldown -= dt;

    // Filter surviving players
    const surviving = this.activePlayerOrder.filter((pid) => !this.playerEliminated.get(pid));
    if (surviving.length <= 1 && this.activePlayerOrder.length > 1) {
      this.isFinished = true;
      return;
    }
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      return;
    }

    const currentTurnPid = this.activePlayerOrder[this.activePlayerIndex];

    // Crane oscillation back and forth across playfield
    const minCraneX = Math.max(70, this.raftX - this.raftWidth * 0.72);
    const maxCraneX = Math.min(width - 70, this.raftX + this.raftWidth * 0.72);

    // Crane steering if player nudges steer
    const steer = this.input.getSteer(currentTurnPid);
    if (steer !== 0) {
      this.craneX += steer * 160 * dt;
    } else {
      this.craneX += this.craneDir * this.craneSpeed * dt;
      if (this.craneX > maxCraneX) {
        this.craneX = maxCraneX;
        this.craneDir = -1;
      } else if (this.craneX < minCraneX) {
        this.craneX = minCraneX;
        this.craneDir = 1;
      }
    }
    this.craneX = Math.max(minCraneX, Math.min(maxCraneX, this.craneX));

    // Check throttle input for rotation (W / S or Up / Down or analog stick)
    const throttle = this.input.getThrottle(currentTurnPid);
    if (this.rotateCooldown <= 0) {
      if (throttle > 0.4 && this.prevThrottle <= 0.4) {
        this.rotateCurrentAnimal(1);
        this.rotateCooldown = 0.22;
      } else if (throttle < -0.4 && this.prevThrottle >= -0.4) {
        this.rotateCurrentAnimal(-1);
        this.rotateCooldown = 0.22;
      }
    }
    this.prevThrottle = throttle;

    // Handle bot AI
    this.updateBots(dt, width, height);

    // Handle drop action input if no animal currently in mid-air
    if (!this.fallingAnimal && this.nextTurnTimer <= 0) {
      const isPressed = this.input.justPressed(currentTurnPid) || this.input.justAction(currentTurnPid);
      if (isPressed) {
        this.dropAnimal(currentTurnPid);
      }
    }

    // Process Falling Animal Physics
    if (this.fallingAnimal) {
      const fa = this.fallingAnimal;
      fa.vy += 700 * dt;
      fa.x += fa.vx * dt;
      fa.y += fa.vy * dt;

      // Solid Moor: Raft top edge coordinates
      const raftTopY = this.raftY - this.raftHeight / 2;
      const raftLeft = this.raftX - this.raftWidth / 2;
      const raftRight = this.raftX + this.raftWidth / 2;

      // Accurate rotated bounding extents
      const faExt = AnimalStackGame.getExtents(fa.type, fa.angle);

      let highestLandedY = Infinity;
      let landedOnSomething = false;

      // 1. Check collision with already settled animals
      for (const sa of this.animals) {
        if (!sa.settled) continue;
        const saExt = AnimalStackGame.getExtents(sa.type, sa.angle);
        const minOverlap = (faExt.halfW + saExt.halfW) * 0.85;

        if (Math.abs(fa.x - sa.x) < minOverlap) {
          const saTopY = sa.y - saExt.halfH;
          const targetFaY = saTopY - faExt.halfH;

          // When descending downward and bottom touches or passes top of sa
          if (fa.vy > 0 && fa.y + faExt.halfH >= saTopY - 10 && fa.y - faExt.halfH <= saTopY + 14) {
            if (!landedOnSomething || targetFaY < highestLandedY) {
              highestLandedY = targetFaY;
              landedOnSomething = true;
            }
          }
        }
      }

      // 2. Check collision with solid raft wood surface (Zero sinking!)
      if (!landedOnSomething) {
        const withinRaftBounds = fa.x >= raftLeft - faExt.halfW * 0.4 && fa.x <= raftRight + faExt.halfW * 0.4;
        if (withinRaftBounds && fa.vy > 0 && fa.y + faExt.halfH >= raftTopY - 10 && fa.y - faExt.halfH <= raftTopY + 18) {
          highestLandedY = raftTopY - faExt.halfH; // Flush on wood surface!
          landedOnSomething = true;
        }
      }

      if (landedOnSomething) {
        fa.y = highestLandedY; // Exact flush alignment with zero pixel sinking
        fa.settled = true;
        fa.vy = 0;
        fa.vx = 0;
        this.animals.push(fa);
        this.fallingAnimal = null;
        this.audio.playTap();
        this.particles.spawnSparks(fa.x, fa.y + faExt.halfH, '#F59E0B', 8);

        // Award points based on placement and tower stack height bonus
        const cur = this.playerScores.get(currentTurnPid) || 0;
        const stackHeightAboveRaft = Math.max(0, raftTopY - (fa.y - faExt.halfH));
        const heightBonus = Math.floor(stackHeightAboveRaft / 18) * 2;
        const points = 10 + heightBonus;
        this.playerScores.set(currentTurnPid, cur + points);
        this.particles.showFloatingText(`+${points} BALANCED!`, fa.x, fa.y - 20, '#10B981', 18);

        this.advanceToNextTurn();
      } else if (fa.y > this.raftY + 45) {
        // Splashed directly into water!
        this.triggerSplash(fa.x, this.raftY + 20);
        const lives = (this.playerLives.get(fa.playerId) || 1) - 1;
        this.playerLives.set(fa.playerId, lives);

        if (lives <= 0) {
          this.playerEliminated.set(fa.playerId, true);
          this.particles.showFloatingText('OUT OF LIVES! ELIMINATED!', fa.x, this.raftY - 10, '#EF4444', 22);
          this.audio.playExplosion();
        } else {
          this.particles.showFloatingText(`SPLASH! -1 LIFE (${lives} LEFT)`, fa.x, this.raftY - 10, '#F59E0B', 18);
        }

        this.fallingAnimal = null;
        this.advanceToNextTurn();
      }
    }

    // Raft tilt is locked to 0: wood CANNOT tip!
    this.raftTilt = 0;

    if (this.nextTurnTimer > 0) {
      this.nextTurnTimer -= dt;
    }
  }

  private dropAnimal(pid: PlayerId) {
    const type = ANIMAL_TYPES[this.currentAnimalIndex];
    this.fallingAnimal = {
      type,
      playerId: pid,
      x: this.craneX,
      y: this.craneY + 28,
      vx: this.craneDir * 30,
      vy: 85,
      settled: false,
      angle: this.heldRotation
    };
    this.audio.playTap();
  }

  private advanceToNextTurn() {
    this.nextTurnTimer = 0.75;
    this.currentAnimalIndex = Math.floor(Math.random() * ANIMAL_TYPES.length);
    this.heldRotation = 0; // Reset rotation for next incoming animal

    // Find next non-eliminated player
    let attempts = 0;
    do {
      this.activePlayerIndex = (this.activePlayerIndex + 1) % this.activePlayerOrder.length;
      attempts++;
    } while (this.playerEliminated.get(this.activePlayerOrder[this.activePlayerIndex]) && attempts < this.activePlayerOrder.length);

    this.botDropDelay = 0.5 + Math.random() * 0.4;
  }

  private triggerSplash(x: number, y: number) {
    this.particles.spawnExplosion(x, y, '#38BDF8', 25);
    this.audio.playBounce();
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const currentPid = this.activePlayerOrder[this.activePlayerIndex];
    if (currentPid !== botId || this.fallingAnimal || this.nextTurnTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    this.botDropDelay -= dt;
    if (this.botDropDelay > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // Smart bot targeting: pick stable spot on stack or raft center
    let targetX = this.raftX;
    if (this.animals.length > 0) {
      // Find top settled animal
      let topSa = this.animals[0];
      for (const sa of this.animals) {
        if (sa.settled && sa.y < topSa.y) {
          topSa = sa;
        }
      }
      targetX = topSa.x;
    }

    // Bot rotation strategy on hard / normal
    const currentAnimal = ANIMAL_TYPES[this.currentAnimalIndex];
    if (difficulty !== 'bot_easy' && Math.random() < 0.05) {
      if ((currentAnimal.id === 'giraffe' || currentAnimal.id === 'crocodile') && this.heldRotation === 0) {
        this.rotateCurrentAnimal(1);
      }
    }

    // Constrain target within stable raft surface
    const safePadding = 25;
    targetX = Math.max(this.raftX - this.raftWidth / 2 + safePadding, Math.min(this.raftX + this.raftWidth / 2 - safePadding, targetX));

    // Tolerance window based on difficulty
    let tolerance = 24;
    let timingError = 0;
    if (difficulty === 'bot_hard') {
      tolerance = 14;
      timingError = (Math.random() - 0.5) * 4;
    } else if (difficulty === 'bot_normal') {
      tolerance = 28;
      timingError = (Math.random() - 0.5) * 20;
    } else {
      tolerance = 48;
      timingError = (Math.random() - 0.5) * 55;
    }

    const distToTarget = Math.abs(this.craneX - (targetX + timingError));

    if (distToTarget <= tolerance) {
      // Release clamp!
      this.input.setBotInput(botId, true, 0, 0, false);
    } else {
      // Steer towards target
      const steer = this.craneX < targetX ? 1 : -1;
      this.input.setBotInput(botId, false, steer, 0, false);
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.activePlayerOrder].sort((a, b) => {
      const elimA = this.playerEliminated.get(a) ? 1 : 0;
      const elimB = this.playerEliminated.get(b) ? 1 : 0;
      if (elimA !== elimB) return elimA - elimB; // Survivors first
      const scoreA = this.playerScores.get(a) || 0;
      const scoreB = this.playerScores.get(b) || 0;
      return scoreB - scoreA;
    });

    const winnerId = sorted.length > 0 && !this.playerEliminated.get(sorted[0]) ? sorted[0] : (sorted[0] ?? null);

    return {
      winnerId,
      rankings: sorted.map((pid, idx) => ({
        playerId: pid,
        score: this.playerScores.get(pid) || 0,
        place: idx + 1
      })),
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} MASTERED THE RAFT STACK!` : 'THE SEA CONSUMED THE STACK!'
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Tropical Sunset Ocean Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#0F172A');
    skyGrad.addColorStop(0.35, '#1E293B');
    skyGrad.addColorStop(0.65, '#0369A1');
    skyGrad.addColorStop(0.85, '#0284C7');
    skyGrad.addColorStop(1, '#075985');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Glowing Tropical Sunset Sun
    ctx.save();
    ctx.shadowColor = '#FBBF24';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(width * 0.78, 110, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Distant Island Silhouettes on Horizon
    ctx.fillStyle = '#064E3B';
    ctx.beginPath();
    ctx.ellipse(width * 0.22, this.raftY - 10, 140, 24, 0, Math.PI, 0);
    ctx.ellipse(width * 0.82, this.raftY - 14, 110, 20, 0, Math.PI, 0);
    ctx.fill();

    // 4. Overhead Heavy Crane Track Rail
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(40, this.craneY - 7, width - 80, 10);
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(40, this.craneY - 3, width - 80, 2);

    // 5. Crane Trolley Carriage & Steampunk Winch
    ctx.save();
    ctx.fillStyle = '#475569';
    ctx.fillRect(this.craneX - 18, this.craneY - 14, 36, 18);
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(this.craneX, this.craneY - 5, 5, 0, Math.PI * 2);
    ctx.fill();

    // Steel Cable
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(this.craneX, this.craneY + 4);
    ctx.lineTo(this.craneX, this.craneY + 26);
    ctx.stroke();

    // Crane Clamp Claws
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(this.craneX, this.craneY + 26, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 6. Active Animal in Crane Clamp (if not in flight)
    if (!this.fallingAnimal) {
      const animal = ANIMAL_TYPES[this.currentAnimalIndex];
      const ext = AnimalStackGame.getExtents(animal, this.heldRotation);
      this.renderAnimal(
        ctx,
        animal,
        this.craneX,
        this.craneY + 34 + ext.halfH,
        this.activePlayerOrder[this.activePlayerIndex],
        this.heldRotation
      );
    }

    // 7. Render Falling Animal in Mid-air
    if (this.fallingAnimal) {
      const fa = this.fallingAnimal;
      this.renderAnimal(ctx, fa.type, fa.x, fa.y, fa.playerId, fa.angle);
    }

    // 8. Render Stacked Animals
    for (const sa of this.animals) {
      this.renderAnimal(ctx, sa.type, sa.x, sa.y, sa.playerId, sa.angle);
    }

    // 9. Floating Moored Raft (Wood Cannot Tip: Level & Stable!)
    ctx.save();
    ctx.translate(this.raftX, this.raftY);

    // Sturdy Raft Wood Planks
    ctx.fillStyle = '#854D0E';
    ctx.fillRect(-this.raftWidth / 2, -this.raftHeight / 2, this.raftWidth, this.raftHeight);
    ctx.fillStyle = '#A16207';
    ctx.fillRect(-this.raftWidth / 2, -this.raftHeight / 2 + 2, this.raftWidth, 5);

    // Heavy Iron Mooring End Plates
    ctx.fillStyle = '#334155';
    ctx.fillRect(-this.raftWidth / 2, -this.raftHeight / 2 - 2, 10, this.raftHeight + 4);
    ctx.fillRect(this.raftWidth / 2 - 10, -this.raftHeight / 2 - 2, 10, this.raftHeight + 4);

    // Plank divider lines
    ctx.strokeStyle = '#5A3008';
    ctx.lineWidth = 2;
    for (let px = -this.raftWidth / 2 + 26; px < this.raftWidth / 2 - 10; px += 26) {
      ctx.beginPath();
      ctx.moveTo(px, -this.raftHeight / 2);
      ctx.lineTo(px, this.raftHeight / 2);
      ctx.stroke();
    }

    // Heavy mooring anchor ropes tied to seafloor/piles
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-this.raftWidth / 2 + 5, this.raftHeight / 2);
    ctx.lineTo(-this.raftWidth / 2 - 35, this.raftHeight / 2 + 40);
    ctx.moveTo(this.raftWidth / 2 - 5, this.raftHeight / 2);
    ctx.lineTo(this.raftWidth / 2 + 35, this.raftHeight / 2 + 40);
    ctx.stroke();

    // Buoyant barrels underneath
    ctx.fillStyle = '#0284C7';
    ctx.beginPath();
    ctx.arc(-this.raftWidth * 0.35, this.raftHeight / 2 + 6, 14, 0, Math.PI);
    ctx.arc(0, this.raftHeight / 2 + 6, 14, 0, Math.PI);
    ctx.arc(this.raftWidth * 0.35, this.raftHeight / 2 + 6, 14, 0, Math.PI);
    ctx.fill();
    ctx.restore();

    // 10. Animated Ocean Water Waves
    ctx.fillStyle = 'rgba(2, 132, 199, 0.75)';
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, this.raftY + 22);
    for (let x = 0; x <= width; x += 20) {
      const wy = this.raftY + 22 + Math.sin(x * 0.04 + this.waterWaveOffset) * 6;
      ctx.lineTo(x, wy);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Foreground Water foam
    ctx.fillStyle = 'rgba(14, 165, 233, 0.85)';
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, this.raftY + 28);
    for (let x = 0; x <= width; x += 24) {
      const wy = this.raftY + 28 + Math.cos(x * 0.035 - this.waterWaveOffset * 0.8) * 5;
      ctx.lineTo(x, wy);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // 11. HUD: Turn Banner & Interactive Rotate Button
    this.renderHUD(ctx, width, height);

    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const currentPid = this.activePlayerOrder[this.activePlayerIndex];
    if (currentPid === undefined) return;
    const curPlayer = this.players[currentPid];

    // Turn Banner at top center
    const bannerW = 320;
    const bannerH = 34;
    const bannerX = width / 2 - bannerW / 2;
    const bannerY = 54;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 17);
    ctx.fill();
    ctx.strokeStyle = curPlayer.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Color dot indicator
    ctx.fillStyle = curPlayer.color;
    ctx.beginPath();
    ctx.arc(bannerX + 18, bannerY + 17, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '800 12.5px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${curPlayer.name.toUpperCase()}'S TURN — DROP TO STACK!`, bannerX + bannerW / 2 + 8, bannerY + 21.5);
    ctx.restore();

    // Interactive On-screen [ 🔄 ROTATE ] Pill Button
    const btnW = 146;
    const btnH = 30;
    const btnX = width / 2 - btnW / 2;
    const btnY = 94;
    this.rotateBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH };

    ctx.save();
    ctx.fillStyle = this.rotateBtnHover ? '#0284C7' : 'rgba(30, 41, 59, 0.92)';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 15);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.font = '800 12px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#F0F9FF';
    const rotDeg = Math.round((this.heldRotation * 180) / Math.PI) % 360;
    ctx.fillText(`🔄 ROTATE (${rotDeg}°)`, btnX + btnW / 2, btnY + 19.5);
    ctx.restore();

    // Rotation Control Hint below button
    ctx.save();
    ctx.font = '700 10.5px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText('Keys: [W/S] or [↑/↓] or [R] or Tap Button', width / 2, btnY + btnH + 13);
    ctx.restore();

    // Bottom HUD: Stack Height & Player Lives Counter (replacing old inclinometer)
    const hudW = Math.min(width - 32, 420);
    const hudH = 34;
    const hudX = width / 2 - hudW / 2;
    const hudY = height - 42;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, hudW, hudH, 17);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Total Stacked Animals
    const raftTopY = this.raftY - this.raftHeight / 2;
    let maxStackHeight = 0;
    for (const sa of this.animals) {
      if (sa.settled) {
        const ext = AnimalStackGame.getExtents(sa.type, sa.angle);
        const h = Math.max(0, raftTopY - (sa.y - ext.halfH));
        if (h > maxStackHeight) maxStackHeight = h;
      }
    }

    ctx.font = '800 12px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(`🪵 STACK: ${this.animals.length} ANIMALS (${Math.round(maxStackHeight)}px)`, hudX + 16, hudY + 21);

    // Player Lives Pips
    ctx.textAlign = 'right';
    let pipsX = hudX + hudW - 14;
    for (let i = this.activePlayerOrder.length - 1; i >= 0; i--) {
      const pid = this.activePlayerOrder[i];
      const p = this.players[pid];
      const lives = this.playerLives.get(pid) || 0;
      const hearts = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));

      ctx.fillStyle = p.color;
      ctx.font = '700 11px Montserrat, sans-serif';
      ctx.fillText(`${p.name}: ${hearts}`, pipsX, hudY + 21);
      pipsX -= 115;
    }
    ctx.restore();
  }

  private renderAnimal(
    ctx: CanvasRenderingContext2D,
    def: AnimalDef,
    x: number,
    y: number,
    pid: PlayerId,
    angle: number = 0
  ) {
    const ext = AnimalStackGame.getExtents(def, angle);
    const pColor = this.players[pid]?.color || '#38BDF8';

    // 1. Unrotated Ground / Stack Drop Shadow
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y + ext.halfH + 2, ext.halfW * 0.85, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.fill();
    ctx.restore();

    // 2. Animal Body Rotated Around Its Exact Center
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const halfW = def.width / 2;
    const halfH = def.height / 2;

    switch (def.id) {
      case 'crocodile':
        this.renderCrocodile(ctx, def, halfW, halfH, pColor);
        break;
      case 'giraffe':
        this.renderGiraffe(ctx, def, halfW, halfH, pColor);
        break;
      case 'turtle':
        this.renderTurtle(ctx, def, halfW, halfH, pColor);
        break;
      case 'elephant':
        this.renderElephant(ctx, def, halfW, halfH, pColor);
        break;
      case 'pig':
        this.renderPig(ctx, def, halfW, halfH, pColor);
        break;
      case 'duck':
        this.renderDuck(ctx, def, halfW, halfH, pColor);
        break;
      case 'frog':
      default:
        this.renderFrog(ctx, def, halfW, halfH, pColor);
        break;
    }

    ctx.restore();
  }

  // 1. CROCODILE: Ultra-wide horizontal bridge (76x24) or tall pillar when rotated 90°
  private renderCrocodile(
    ctx: CanvasRenderingContext2D,
    def: AnimalDef,
    halfW: number,
    halfH: number,
    pColor: string
  ) {
    // Body gradient
    const grad = ctx.createLinearGradient(-halfW, 0, halfW, 0);
    grad.addColorStop(0, '#047857');
    grad.addColorStop(0.5, '#059669');
    grad.addColorStop(1, '#10B981');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, def.width, def.height, [6, 12, 12, 6]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Spiky dorsal ridges on back
    ctx.fillStyle = '#064E3B';
    for (let rx = -halfW + 12; rx < halfW - 16; rx += 10) {
      ctx.beginPath();
      ctx.moveTo(rx, -halfH);
      ctx.lineTo(rx + 4, -halfH - 5);
      ctx.lineTo(rx + 8, -halfH);
      ctx.closePath();
      ctx.fill();
    }

    // Pale yellow-green underbelly stripe
    ctx.fillStyle = '#D9F99D';
    ctx.beginPath();
    ctx.roundRect(-halfW + 4, halfH - 6, def.width - 24, 4, 2);
    ctx.fill();

    // Toothy grin on right snout
    ctx.fillStyle = '#FFFFFF';
    for (let tx = halfW - 18; tx < halfW - 4; tx += 4) {
      ctx.beginPath();
      ctx.moveTo(tx, 0);
      ctx.lineTo(tx + 2, 4);
      ctx.lineTo(tx + 4, 0);
      ctx.closePath();
      ctx.fill();
    }

    // Eyes
    this.drawChibiEyes(ctx, halfW - 22, -halfH + 4, 5);

    // Player Collar & Bell
    this.drawCollar(ctx, -halfW + 10, 0, 14, pColor);
  }

  // 2. GIRAFFE: Ultra-tall vertical pillar (26x74) or wide horizontal roof when rotated 90°
  private renderGiraffe(
    ctx: CanvasRenderingContext2D,
    def: AnimalDef,
    halfW: number,
    halfH: number,
    pColor: string
  ) {
    // Ossicones (horns) with fuzzy pom-poms
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, -halfH);
    ctx.lineTo(-6, -halfH - 9);
    ctx.moveTo(5, -halfH);
    ctx.lineTo(6, -halfH - 9);
    ctx.stroke();

    ctx.fillStyle = '#92400E';
    ctx.beginPath();
    ctx.arc(-6, -halfH - 9, 3.5, 0, Math.PI * 2);
    ctx.arc(6, -halfH - 9, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Tall body gradient
    const grad = ctx.createLinearGradient(0, -halfH, 0, halfH);
    grad.addColorStop(0, '#FEF08A');
    grad.addColorStop(0.5, '#FBBF24');
    grad.addColorStop(1, '#D97706');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, def.width, def.height, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Giraffe spots down neck
    ctx.fillStyle = '#B45309';
    const spots = [
      { sx: -4, sy: -halfH + 24, r: 4 },
      { sx: 5, sy: -halfH + 36, r: 4.5 },
      { sx: -5, sy: -halfH + 50, r: 4 },
      { sx: 4, sy: -halfH + 62, r: 3.5 }
    ];
    for (const sp of spots) {
      ctx.beginPath();
      ctx.arc(sp.sx, sp.sy, sp.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eyes near head
    this.drawChibiEyes(ctx, 0, -halfH + 11, 4.5);

    // Muzzle & nostrils
    ctx.fillStyle = '#FEF9C3';
    ctx.beginPath();
    ctx.ellipse(0, -halfH + 18, 6.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Player Collar & Bell
    this.drawCollar(ctx, 0, halfH - 6, halfW * 1.4, pColor);
  }

  // 3. ELEPHANT: Cornerstone block (56x44)
  private renderElephant(
    ctx: CanvasRenderingContext2D,
    def: AnimalDef,
    halfW: number,
    halfH: number,
    pColor: string
  ) {
    // Big floppy ears with pink inner pads
    ctx.fillStyle = '#64748B';
    ctx.beginPath();
    ctx.ellipse(-halfW - 2, -4, 9, 14, -0.25, 0, Math.PI * 2);
    ctx.ellipse(halfW + 2, -4, 9, 14, 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FBCFE8';
    ctx.beginPath();
    ctx.ellipse(-halfW - 2, -4, 5.5, 9.5, -0.25, 0, Math.PI * 2);
    ctx.ellipse(halfW + 2, -4, 5.5, 9.5, 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Body gradient
    const grad = ctx.createLinearGradient(0, -halfH, 0, halfH);
    grad.addColorStop(0, '#94A3B8');
    grad.addColorStop(0.5, '#64748B');
    grad.addColorStop(1, '#475569');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, def.width, def.height, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Eyes
    this.drawChibiEyes(ctx, 0, -8, 8);

    // Elephant Trunk
    ctx.fillStyle = '#64748B';
    ctx.beginPath();
    ctx.roundRect(-4, -4, 8, 15, [4, 4, 6, 6]);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(2, 11, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Shiny tusks
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-5, 4);
    ctx.lineTo(-9, 9);
    ctx.lineTo(-5, 8);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(5, 4);
    ctx.lineTo(9, 9);
    ctx.lineTo(5, 8);
    ctx.closePath();
    ctx.fill();

    // Player Collar & Bell
    this.drawCollar(ctx, 0, halfH - 6, halfW * 1.3, pColor);
  }

  // 4. TURTLE: Curved dome shell (48x26)
  private renderTurtle(
    ctx: CanvasRenderingContext2D,
    def: AnimalDef,
    halfW: number,
    halfH: number,
    pColor: string
  ) {
    // Domed shell
    const grad = ctx.createLinearGradient(0, -halfH, 0, halfH);
    grad.addColorStop(0, '#34D399');
    grad.addColorStop(0.5, '#10B981');
    grad.addColorStop(1, '#059669');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, def.width, def.height, [14, 14, 8, 8]);
    ctx.fill();
    ctx.strokeStyle = '#064E3B';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Shell scute patterns
    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -2, 7, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-12, -2, 6, 0, Math.PI * 2);
    ctx.arc(12, -2, 6, 0, Math.PI * 2);
    ctx.stroke();

    // Turtle head sticking out with eyes and smile
    ctx.fillStyle = '#6EE7B7';
    ctx.beginPath();
    ctx.ellipse(halfW + 4, 0, 7, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(halfW + 6, -2, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Flippers
    ctx.fillStyle = '#059669';
    ctx.beginPath();
    ctx.ellipse(-halfW + 6, halfH + 2, 4, 2.5, 0.4, 0, Math.PI * 2);
    ctx.ellipse(halfW - 6, halfH + 2, 4, 2.5, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Player Collar & Bell
    this.drawCollar(ctx, -2, halfH - 5, halfW * 1.1, pColor);
  }

  // 5. PIG: Chubby rounded box (42x32)
  private renderPig(
    ctx: CanvasRenderingContext2D,
    def: AnimalDef,
    halfW: number,
    halfH: number,
    pColor: string
  ) {
    // Folded triangular ears
    ctx.fillStyle = '#DB2777';
    ctx.beginPath();
    ctx.moveTo(-halfW + 2, -halfH + 2);
    ctx.lineTo(-halfW - 4, -halfH - 7);
    ctx.lineTo(-halfW + 11, -halfH - 1);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(halfW - 2, -halfH + 2);
    ctx.lineTo(halfW + 4, -halfH - 7);
    ctx.lineTo(halfW - 11, -halfH - 1);
    ctx.closePath();
    ctx.fill();

    // Body
    const grad = ctx.createLinearGradient(0, -halfH, 0, halfH);
    grad.addColorStop(0, '#FBCFE8');
    grad.addColorStop(0.5, '#F472B6');
    grad.addColorStop(1, '#DB2777');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, def.width, def.height, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Eyes
    this.drawChibiEyes(ctx, 0, -6, 7.5);

    // Chubby 3D Pig Snout
    ctx.fillStyle = '#EC4899';
    ctx.beginPath();
    ctx.ellipse(0, 2, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#BE185D';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Nostrils
    ctx.fillStyle = '#831843';
    ctx.beginPath();
    ctx.arc(-3, 2, 1.4, 0, Math.PI * 2);
    ctx.arc(3, 2, 1.4, 0, Math.PI * 2);
    ctx.fill();

    // Player Collar & Bell
    this.drawCollar(ctx, 0, halfH - 5, halfW * 1.2, pColor);
  }

  // 6. DUCK: Compact wedge (32x30)
  private renderDuck(
    ctx: CanvasRenderingContext2D,
    def: AnimalDef,
    halfW: number,
    halfH: number,
    pColor: string
  ) {
    // Feather tuft
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.ellipse(0, -halfH - 4, 3, 5, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const grad = ctx.createLinearGradient(0, -halfH, 0, halfH);
    grad.addColorStop(0, '#FEF08A');
    grad.addColorStop(0.5, '#FCD34D');
    grad.addColorStop(1, '#F59E0B');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, def.width, def.height, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Eyes
    this.drawChibiEyes(ctx, 0, -5, 6);

    // Orange Duck Bill
    const billGrad = ctx.createLinearGradient(0, 1, 0, 8);
    billGrad.addColorStop(0, '#FB923C');
    billGrad.addColorStop(1, '#EA580C');
    ctx.fillStyle = billGrad;
    ctx.beginPath();
    ctx.roundRect(-7, 0, 14, 7, [5, 5, 4, 4]);
    ctx.fill();
    ctx.strokeStyle = '#C2410C';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Player Collar & Bell
    this.drawCollar(ctx, 0, halfH - 5, halfW * 1.3, pColor);
  }

  // 7. FROG: Tiny agile pebble (26x20)
  private renderFrog(
    ctx: CanvasRenderingContext2D,
    def: AnimalDef,
    halfW: number,
    halfH: number,
    pColor: string
  ) {
    // Eye domes on top
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.arc(-7, -halfH + 2, 6, 0, Math.PI * 2);
    ctx.arc(7, -halfH + 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#15803D';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Body
    const grad = ctx.createLinearGradient(0, -halfH, 0, halfH);
    grad.addColorStop(0, '#86EFAC');
    grad.addColorStop(0.5, '#4ADE80');
    grad.addColorStop(1, '#16A34A');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, def.width, def.height, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pale belly
    ctx.fillStyle = '#FEF9C3';
    ctx.beginPath();
    ctx.ellipse(0, 3, halfW * 0.55, halfH * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    this.drawChibiEyes(ctx, 0, -halfH + 2, 7);

    // Wide frog smile
    ctx.strokeStyle = '#14532D';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 3, 5, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Player Collar & Bell
    this.drawCollar(ctx, 0, halfH - 4, halfW * 1.2, pColor);
  }

  private drawChibiEyes(ctx: CanvasRenderingContext2D, cx: number, cy: number, spacing: number) {
    // Whites
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx - spacing, cy, 4, 0, Math.PI * 2);
    ctx.arc(cx + spacing, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(cx - spacing, cy, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + spacing, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Catchlights
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx - spacing - 0.8, cy - 0.8, 1, 0, Math.PI * 2);
    ctx.arc(cx + spacing - 0.8, cy - 0.8, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawCollar(ctx: CanvasRenderingContext2D, cx: number, cy: number, ribbonW: number, pColor: string) {
    ctx.save();
    // Ribbon
    ctx.fillStyle = pColor;
    ctx.beginPath();
    ctx.roundRect(cx - ribbonW / 2, cy - 2, ribbonW, 4, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Golden Bell
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.restore();
  }
}
