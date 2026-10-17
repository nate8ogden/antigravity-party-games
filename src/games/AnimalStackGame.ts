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
  angle: number; // 45° step increments: 0, PI/4, PI/2, 3PI/4, PI, 5PI/4, 3PI/2, 7PI/4
  squish?: number;
}

export class AnimalStackGame extends BaseGame {
  // Moored Sturdy Raft (Level & Firmly Moored)
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
  private heldRotation: number = 0; // Active rotation angle for crane clamp (45° steps)
  private prevThrottle: number = 0;
  private rotateCooldown: number = 0;

  // Turn management & Player state
  private activePlayerIndex: number = 0;
  private activePlayerOrder: PlayerId[] = [];
  private playerEliminated: Map<PlayerId, boolean> = new Map();
  private playerScores: Map<PlayerId, number> = new Map();
  private playerLives: Map<PlayerId, number> = new Map();
  private sabotageCooldown: Map<PlayerId, number> = new Map();
  private waveImpulse: number = 0;

  // Visual Themes
  public static readonly THEMES = [
    { name: 'Sunset Lagoon 🌅', skyTop: '#0F172A', skyMid: '#1E293B', skyBot: '#075985', sunColor: '#FEF08A', waterColor: 'rgba(2, 132, 199, 0.75)' },
    { name: 'Tropical Reef 🌴', skyTop: '#082F49', skyMid: '#0C4A6E', skyBot: '#0D9488', sunColor: '#FDE047', waterColor: 'rgba(13, 148, 136, 0.75)' },
    { name: 'Bioluminescent 🌌', skyTop: '#030712', skyMid: '#1E1B4B', skyBot: '#4C1D95', sunColor: '#A78BFA', waterColor: 'rgba(99, 102, 241, 0.75)' }
  ];
  private currentThemeIndex: number = 0;
  private themePillRect = { x: 20, y: 0, w: 160, h: 32 };

  // Active stack & physics
  private animals: StackedAnimal[] = [];
  private fallingAnimal: StackedAnimal | null = null;
  private nextTurnTimer: number = 0;
  private waterWaveOffset: number = 0;
  private botDropDelay: number = 0;

  // Interactive On-screen Rotate Button bounds
  private rotateBtnRect = { x: 0, y: 0, w: 146, h: 32 };
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
      if (this.isFinished) return;

      // Key T cycles visual themes
      if (e.code === 'KeyT') {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % AnimalStackGame.THEMES.length;
        this.audio.playTap();
        return;
      }

      if (this.fallingAnimal || this.nextTurnTimer > 0) return;
      const currentPid = this.activePlayerOrder[this.activePlayerIndex];

      // Key R rotates 45° for any active human player
      if (e.code === 'KeyR') {
        this.rotateCurrentAnimal(1);
        return;
      }

      // Player 0 keys (W, S) rotate 45° clockwise / counter-clockwise if their turn
      if (currentPid === 0 && (e.code === 'KeyW' || e.code === 'KeyS')) {
        this.rotateCurrentAnimal(e.code === 'KeyW' ? 1 : -1);
        return;
      }

      // Player 1 keys (ArrowUp, ArrowDown) rotate 45° if their turn
      if (currentPid === 1 && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
        this.rotateCurrentAnimal(e.code === 'ArrowUp' ? 1 : -1);
        return;
      }

      // Drop keys if active player:
      if (
        (currentPid === 0 && (e.code === 'KeyF' || e.code === 'KeyE')) ||
        (currentPid === 1 && (e.code === 'Enter' || e.code === 'ShiftRight' || e.code === 'NumpadEnter')) ||
        e.code === 'Space'
      ) {
        this.dropAnimal(currentPid);
        return;
      }

      // Spectator Sabotage: non-active player keys
      if (currentPid !== 0 && (e.code === 'KeyF' || e.code === 'KeyE')) {
        this.triggerSpectatorSabotage(0);
      } else if (currentPid !== 1 && (e.code === 'Enter' || e.code === 'ShiftRight' || e.code === 'NumpadEnter')) {
        this.triggerSpectatorSabotage(1);
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.pointerdownListener = (e: PointerEvent) => {
      if (this.isFinished) return;
      const canvas = document.querySelector('canvas');
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Check if tap hit the theme pill
      if (
        clickX >= this.themePillRect.x &&
        clickX <= this.themePillRect.x + this.themePillRect.w &&
        clickY >= this.themePillRect.y &&
        clickY <= this.themePillRect.y + this.themePillRect.h
      ) {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % AnimalStackGame.THEMES.length;
        this.audio.playTap();
        return;
      }

      if (this.fallingAnimal || this.nextTurnTimer > 0) return;

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
    this.waveImpulse = 0;

    const btnW = 154;
    const btnH = 30;
    this.rotateBtnRect = { x: width / 2 - btnW / 2, y: 94, w: btnW, h: btnH };
    this.themePillRect = { x: 20, y: height - 44, w: 165, h: 32 };

    this.raftX = width / 2;
    this.raftY = height - 90;
    this.raftTilt = 0;

    this.craneX = width / 2;
    this.craneDir = 1;
    this.waterWaveOffset = 0;

    const activePlayers = this.players.filter((p) => p.type !== 'disabled').map((p) => p.id);
    this.activePlayerOrder = activePlayers.length > 0 ? activePlayers : [0, 1];
    this.activePlayerIndex = 0;
    this.playerEliminated.clear();
    this.playerScores.clear();
    this.playerLives.clear();
    this.sabotageCooldown.clear();

    for (const pid of this.activePlayerOrder) {
      this.playerEliminated.set(pid, false);
      this.playerScores.set(pid, 0);
      this.playerLives.set(pid, 3); // 3 drop lives per player
      this.sabotageCooldown.set(pid, 0);
    }

    this.currentAnimalIndex = Math.floor(Math.random() * ANIMAL_TYPES.length);
    this.botDropDelay = 0.6;
  }

  // 45-Degree Rotation Step (0, 45, 90, 135, 180, 225, 270, 315)
  public rotateCurrentAnimal(dir: number = 1): void {
    if (this.fallingAnimal || this.nextTurnTimer > 0) return;
    const step = Math.PI / 4; // 45 degrees
    let newRot = Math.round((this.heldRotation + dir * step) / step) * step;
    newRot = ((newRot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (Math.abs(newRot - Math.PI * 2) < 0.01) newRot = 0;
    this.heldRotation = newRot;
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
    const isUnderdog = (this.playerLives.get(currentTurnPid) || 0) <= 1 &&
      this.activePlayerOrder.some(p => p !== currentTurnPid && (this.playerLives.get(p) || 0) >= 2);
    const effectiveCraneSpeed = isUnderdog ? this.craneSpeed * 0.72 : this.craneSpeed;

    // Crane oscillation back and forth across playfield
    const minCraneX = Math.max(70, this.raftX - this.raftWidth * 0.72);
    const maxCraneX = Math.min(width - 70, this.raftX + this.raftWidth * 0.72);

    // Crane steering if player nudges steer
    const steer = this.input.getSteer(currentTurnPid);
    if (steer !== 0) {
      this.craneDir = Math.sign(steer);
      this.craneX += steer * (isUnderdog ? 160 : 210) * dt;
    } else {
      this.craneX += this.craneDir * effectiveCraneSpeed * dt;
      if (this.craneX > maxCraneX) {
        this.craneX = maxCraneX;
        this.craneDir = -1;
      } else if (this.craneX < minCraneX) {
        this.craneX = minCraneX;
        this.craneDir = 1;
      }
    }
    this.craneX = Math.max(minCraneX, Math.min(maxCraneX, this.craneX));

    // Handle spectator sabotage cooldowns and input
    for (const pid of this.activePlayerOrder) {
      const cd = this.sabotageCooldown.get(pid) || 0;
      if (cd > 0) this.sabotageCooldown.set(pid, cd - dt);

      if (pid !== currentTurnPid && !this.playerEliminated.get(pid)) {
        if (this.input.justPressed(pid) || this.input.justAction(pid)) {
          this.triggerSpectatorSabotage(pid);
        }
      }
    }

    // Check throttle input for rotation (W / S or Up / Down or analog stick in 45° steps)
    const throttle = this.input.getThrottle(currentTurnPid);
    if (this.rotateCooldown <= 0) {
      if (throttle > 0.4 && this.prevThrottle <= 0.4) {
        this.rotateCurrentAnimal(1);
        this.rotateCooldown = 0.20;
      } else if (throttle < -0.4 && this.prevThrottle >= -0.4) {
        this.rotateCurrentAnimal(-1);
        this.rotateCooldown = 0.20;
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

    // Process Falling Animal Physics with Realistic Center of Mass & Overhang Tipping
    if (this.fallingAnimal) {
      const fa = this.fallingAnimal;
      fa.vy += 700 * dt;
      fa.x += fa.vx * dt;
      fa.y += fa.vy * dt;

      // Solid Moor: Raft top edge coordinates
      const raftTopY = this.raftY - this.raftHeight / 2;
      const raftLeft = this.raftX - this.raftWidth / 2;
      const raftRight = this.raftX + this.raftWidth / 2;

      // Accurate rotated bounding extents (handles 0, 45, 90, 135, etc.)
      const faExt = AnimalStackGame.getExtents(fa.type, fa.angle);

      let highestLandedY = Infinity;
      let landedOnSomething = false;
      let supportLeft = 0;
      let supportRight = 0;

      // 1. Check collision with already settled animals
      for (const sa of this.animals) {
        if (!sa.settled) continue;
        const saExt = AnimalStackGame.getExtents(sa.type, sa.angle);
        const saL = sa.x - saExt.halfW;
        const saR = sa.x + saExt.halfW;

        // Check horizontal overlap
        const overlapL = Math.max(fa.x - faExt.halfW, saL);
        const overlapR = Math.min(fa.x + faExt.halfW, saR);
        const overlapW = overlapR - overlapL;

        if (overlapW > 6) {
          const saTopY = sa.y - saExt.halfH;
          const targetFaY = saTopY - faExt.halfH;

          // Descending downward and bottom touches or passes top of sa
          if (fa.vy > 0 && fa.y + faExt.halfH >= saTopY - 12 && fa.y - faExt.halfH <= saTopY + 16) {
            if (!landedOnSomething || targetFaY < highestLandedY - 6) {
              highestLandedY = targetFaY;
              landedOnSomething = true;
              supportLeft = saL;
              supportRight = saR;
            } else if (Math.abs(targetFaY - highestLandedY) <= 8) {
              // Same tier: expand bridge support span!
              supportLeft = Math.min(supportLeft, saL);
              supportRight = Math.max(supportRight, saR);
            }
          }
        }
      }

      // 2. Check collision with solid raft wood surface (Zero sinking!)
      if (!landedOnSomething || Math.abs((raftTopY - faExt.halfH) - highestLandedY) <= 8) {
        const raftOverlapL = Math.max(fa.x - faExt.halfW, raftLeft);
        const raftOverlapR = Math.min(fa.x + faExt.halfW, raftRight);
        const raftOverlapW = raftOverlapR - raftOverlapL;

        if (raftOverlapW > 6 && fa.vy > 0 && fa.y + faExt.halfH >= raftTopY - 10 && fa.y - faExt.halfH <= raftTopY + 18) {
          const raftTargetY = raftTopY - faExt.halfH;
          if (!landedOnSomething || raftTargetY < highestLandedY - 6) {
            highestLandedY = raftTargetY; // Flush on wood surface!
            landedOnSomething = true;
            supportLeft = raftLeft;
            supportRight = raftRight;
          } else if (Math.abs(raftTargetY - highestLandedY) <= 8) {
            supportLeft = Math.min(supportLeft, raftLeft);
            supportRight = Math.max(supportRight, raftRight);
          }
        }
      }

      // 3. Realistic Physics Resolution: Center of Mass Balance Check
      if (landedOnSomething) {
        // Center of mass balance check: Is fa.x supported beneath it?
        const leftOverhang = supportLeft - fa.x;
        const rightOverhang = fa.x - supportRight;

        // If center of mass is past the support edge, the animal is overbalanced and tilts/slides off!
        if (leftOverhang > 0) {
          // Unbalanced to the left: slide and tumble off edge!
          fa.vx = -Math.max(120, leftOverhang * 6 + fa.type.mass * 1.5);
          fa.vy = Math.max(80, fa.vy * 0.4);
          fa.angle -= 0.16;
          this.audio.playWhoosh();
          this.particles.showFloatingText('TIPPING!', fa.x, fa.y - 15, '#F59E0B', 16);
          this.particles.spawnSparks(supportLeft, fa.y + faExt.halfH, '#F59E0B', 6);
        } else if (rightOverhang > 0) {
          // Unbalanced to the right: slide and tumble off edge!
          fa.vx = Math.max(120, rightOverhang * 6 + fa.type.mass * 1.5);
          fa.vy = Math.max(80, fa.vy * 0.4);
          fa.angle += 0.16;
          this.audio.playWhoosh();
          this.particles.showFloatingText('TIPPING!', fa.x, fa.y - 15, '#F59E0B', 16);
          this.particles.spawnSparks(supportRight, fa.y + faExt.halfH, '#F59E0B', 6);
        } else {
          // Stably Balanced! Flush settle with zero pixel sinking
          fa.y = highestLandedY;
          fa.settled = true;
          fa.vy = 0;
          fa.vx = 0;
          fa.squish = 1.0;
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
        }
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

    // Raft remains strictly level & moored (cannot tip!)
    this.raftTilt = 0;

    // Update squish spring physics on settled animals
    for (const a of this.animals) {
      if (a.squish && a.squish > 0) {
        a.squish = Math.max(0, a.squish - dt * 3.5);
      }
    }

    // Clean up animals that tumbled into the ocean
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      if (!a.settled) {
        a.y += a.vy * dt;
        a.vy += 650 * dt;
        a.x += a.vx * dt;
        a.angle += (a.vx > 0 ? 0.08 : -0.08);
        if (a.y > this.raftY + 35) {
          this.triggerSplash(a.x, this.raftY + 20);
          this.animals.splice(i, 1);
        }
      }
    }

    if (this.nextTurnTimer > 0) {
      this.nextTurnTimer -= dt;
    }
  }

  public triggerSpectatorSabotage(pid: PlayerId): void {
    const cd = this.sabotageCooldown.get(pid) || 0;
    if (cd > 0 || this.isFinished) return;
    this.sabotageCooldown.set(pid, 3.8); // 3.8s cooldown

    const side = (pid % 2 === 0) ? -1 : 1;
    // Fun gust of wind nudges the crane carriage slightly
    this.craneX += side * 14;
    const p = this.players[pid];
    const splashX = this.raftX + side * (this.raftWidth * 0.52);
    const splashY = this.raftY + 12;

    this.particles.spawnExplosion(splashX, splashY, '#38BDF8', 25);
    this.particles.showFloatingText(`🌊 ${p?.name || 'P' + (pid + 1)} WATER JET!`, splashX, splashY - 30, p?.color || '#38BDF8', 16);
    this.audio.playWhoosh();
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
      if (currentPid !== botId && this.fallingAnimal) {
        const cd = this.sabotageCooldown.get(botId) || 0;
        if (cd <= 0 && Math.random() < (difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.025 : 0)) {
          this.triggerSpectatorSabotage(botId);
        }
      }
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

    // Bot rotation strategy in 45° increments
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

    const theme = AnimalStackGame.THEMES[this.currentThemeIndex];

    // 1. Theme Ocean Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, theme.skyTop);
    skyGrad.addColorStop(0.35, theme.skyMid);
    skyGrad.addColorStop(0.65, '#0369A1');
    skyGrad.addColorStop(0.85, '#0284C7');
    skyGrad.addColorStop(1, theme.skyBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Glowing Tropical Sunset Sun
    ctx.save();
    ctx.shadowColor = theme.sunColor;
    ctx.shadowBlur = 24;
    ctx.fillStyle = theme.sunColor;
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

    // 5b. Visual Drop Plumb-Line & Landing Ghost Silhouette
    if (!this.fallingAnimal && this.nextTurnTimer <= 0) {
      this.renderDropGuide(ctx, width, height);
    }

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

    // 8. Render Stacked Animals (with juicy squish-and-stretch on landing)
    for (const sa of this.animals) {
      this.renderAnimal(ctx, sa.type, sa.x, sa.y, sa.playerId, sa.angle, sa.squish || 0);
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

    // 11. HUD: Turn Banner & Interactive Rotate Button (showing 45° increments)
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

    const isUnderdog = (this.playerLives.get(currentPid) || 0) <= 1 &&
      this.activePlayerOrder.some(p => p !== currentPid && (this.playerLives.get(p) || 0) >= 2);

    ctx.font = '800 12px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = isUnderdog ? '#FDE047' : '#FFFFFF';
    const turnText = isUnderdog
      ? `${curPlayer.name.toUpperCase()}'S TURN ⚡ UNDERDOG SURGE!`
      : `${curPlayer.name.toUpperCase()}'S TURN — DROP TO STACK!`;
    ctx.fillText(turnText, bannerX + bannerW / 2 + 8, bannerY + 21.5);
    ctx.restore();

    // Interactive On-screen [ 🔄 ROTATE 45° ] Pill Button
    const btnW = 154;
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
    ctx.fillText(`🔄 ROTATE 45° (${rotDeg}°)`, btnX + btnW / 2, btnY + 19.5);
    ctx.restore();

    // Rotation Control Hint below button
    ctx.save();
    ctx.font = '700 10.5px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText('Keys: [W/S] or [↑/↓] or [R] or Tap Button to rotate 45° | Action: Sabotage Wave', width / 2, btnY + btnH + 13);
    ctx.restore();

    // Bottom-Left Visual Theme Switcher Pill (x: 20, y: height - 44, h: 32)
    const theme = AnimalStackGame.THEMES[this.currentThemeIndex];
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 160, 32, 16);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '800 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#E0F2FE';
    ctx.fillText(`${theme.name} [T]`, 20 + 80, height - 23.5);
    ctx.restore();

    // Bottom HUD: Stack Height & Player Lives Counter (Positioned to avoid bottom-left pill)
    const hudW = Math.min(width - 200, 420);
    const hudH = 32;
    const hudX = Math.max(190, width - hudW - 20);
    const hudY = height - 44;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, hudW, hudH, 16);
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

    ctx.font = '800 11.5px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(`🪵 STACK: ${this.animals.length} ANIMALS (${Math.round(maxStackHeight)}px)`, hudX + 14, hudY + 20);

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
      ctx.fillText(`${p.name}: ${hearts}`, pipsX, hudY + 20);
      pipsX -= 115;
    }
    ctx.restore();
  }

  private renderDropGuide(ctx: CanvasRenderingContext2D, _width: number, _height: number): void {
    const curPid = this.activePlayerOrder[this.activePlayerIndex];
    if (curPid === undefined) return;
    const animal = ANIMAL_TYPES[this.currentAnimalIndex];
    const ext = AnimalStackGame.getExtents(animal, this.heldRotation);

    const raftTopY = this.raftY - this.raftHeight / 2;
    const raftLeft = this.raftX - this.raftWidth / 2;
    const raftRight = this.raftX + this.raftWidth / 2;

    let landedY = raftTopY - ext.halfH;
    let suppL = raftLeft;
    let suppR = raftRight;
    let hitRaft = (Math.min(this.craneX + ext.halfW, raftRight) - Math.max(this.craneX - ext.halfW, raftLeft)) > 6;
    let hitSa = false;

    for (const sa of this.animals) {
      if (!sa.settled) continue;
      const saExt = AnimalStackGame.getExtents(sa.type, sa.angle);
      const saL = sa.x - saExt.halfW;
      const saR = sa.x + saExt.halfW;
      const overlap = Math.min(this.craneX + ext.halfW, saR) - Math.max(this.craneX - ext.halfW, saL);
      if (overlap > 6) {
        const candidateY = (sa.y - saExt.halfH) - ext.halfH;
        if (!hitSa || candidateY < landedY - 6) {
          landedY = candidateY;
          suppL = saL;
          suppR = saR;
          hitSa = true;
        } else if (Math.abs(candidateY - landedY) <= 8) {
          suppL = Math.min(suppL, saL);
          suppR = Math.max(suppR, saR);
        }
      }
    }

    const isSupported = (hitSa || hitRaft);
    const isStable = isSupported && this.craneX >= suppL && this.craneX <= suppR;
    const isTipping = isSupported && !isStable;

    const guideColor = isStable ? '#38BDF8' : (isTipping ? '#F59E0B' : 'rgba(244, 63, 94, 0.75)');

    ctx.save();
    // 1. Dotted Alignment Plumb-line
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = guideColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(this.craneX, this.craneY + 34);
    ctx.lineTo(this.craneX, landedY + ext.halfH);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Landing Surface Brackets [   ]
    ctx.strokeStyle = guideColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    // Left bracket
    ctx.moveTo(this.craneX - ext.halfW, landedY + ext.halfH - 5);
    ctx.lineTo(this.craneX - ext.halfW, landedY + ext.halfH);
    ctx.lineTo(this.craneX - ext.halfW + 8, landedY + ext.halfH);
    // Right bracket
    ctx.moveTo(this.craneX + ext.halfW, landedY + ext.halfH - 5);
    ctx.lineTo(this.craneX + ext.halfW, landedY + ext.halfH);
    ctx.lineTo(this.craneX + ext.halfW - 8, landedY + ext.halfH);
    ctx.stroke();

    // 3. Ghost Silhouette Preview of Landing Animal
    ctx.save();
    ctx.globalAlpha = 0.28;
    this.renderAnimal(ctx, animal, this.craneX, landedY, curPid, this.heldRotation);
    ctx.restore();

    // 4. Compact Alignment Pill
    const tagText = isStable ? '● STABLE' : (isTipping ? '▲ TIPPING' : '✕ MISS');
    const tagBg = isStable ? 'rgba(6, 78, 59, 0.88)' : (isTipping ? 'rgba(120, 53, 15, 0.88)' : 'rgba(136, 19, 55, 0.88)');
    const tagFg = isStable ? '#34D399' : (isTipping ? '#FCD34D' : '#FDA4AF');
    const tagW = 76;
    const tagH = 18;
    const tagX = this.craneX - tagW / 2;
    const tagY = this.craneY + 44;

    ctx.fillStyle = tagBg;
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, tagW, tagH, 9);
    ctx.fill();
    ctx.strokeStyle = guideColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '800 10px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = tagFg;
    ctx.fillText(tagText, tagX + tagW / 2, tagY + 12.5);

    ctx.restore();
  }

  private renderAnimal(
    ctx: CanvasRenderingContext2D,
    def: AnimalDef,
    x: number,
    y: number,
    pid: PlayerId,
    angle: number = 0,
    squish: number = 0
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

    if (squish > 0) {
      const squishFactor = Math.sin(squish * Math.PI) * 0.2;
      ctx.scale(1 + squishFactor, 1 - squishFactor);
    }

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

  // 1. CROCODILE: Authentic elongated reptilian shape with jaws, teeth, arched back, dorsal spikes, and clawed legs
  private renderCrocodile(
    ctx: CanvasRenderingContext2D,
    def: AnimalDef,
    halfW: number,
    halfH: number,
    pColor: string
  ) {
    ctx.save();

    // 1. Tail with tapering dorsal scutes
    ctx.fillStyle = '#047857';
    ctx.beginPath();
    ctx.moveTo(-halfW, 0);
    ctx.quadraticCurveTo(-halfW + 12, -halfH + 2, -halfW + 24, -halfH + 4);
    ctx.lineTo(-halfW + 24, halfH - 4);
    ctx.quadraticCurveTo(-halfW + 10, halfH - 2, -halfW, 0);
    ctx.closePath();
    ctx.fill();

    // 2. Main Crocodile Body Silhouette
    const bodyGrad = ctx.createLinearGradient(-halfW, 0, halfW, 0);
    bodyGrad.addColorStop(0, '#047857');
    bodyGrad.addColorStop(0.5, '#059669');
    bodyGrad.addColorStop(1, '#10B981');

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    // Start at snout tip
    ctx.moveTo(halfW, 2);
    // Lower jaw
    ctx.lineTo(halfW - 20, 6);
    // Belly curve
    ctx.quadraticCurveTo(0, halfH, -halfW + 22, halfH - 3);
    // Tail base
    ctx.lineTo(-halfW + 22, -halfH + 5);
    // Arched scaly back
    ctx.quadraticCurveTo(-8, -halfH - 2, halfW - 22, -halfH + 4);
    // Cranial eye bump
    ctx.quadraticCurveTo(halfW - 14, -halfH - 2, halfW - 10, -halfH + 3);
    // Upper snout
    ctx.lineTo(halfW, -2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#064E3B';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 3. Dorsal Spikes / Osteoderm ridges along spine
    ctx.fillStyle = '#064E3B';
    for (let sx = -halfW + 26; sx < halfW - 24; sx += 8) {
      ctx.beginPath();
      ctx.moveTo(sx, -halfH + 2);
      ctx.lineTo(sx + 3.5, -halfH - 4);
      ctx.lineTo(sx + 7, -halfH + 2);
      ctx.closePath();
      ctx.fill();
    }

    // 4. Pale cream underbelly scales
    ctx.fillStyle = '#D9F99D';
    ctx.beginPath();
    ctx.roundRect(-halfW + 25, halfH - 7, def.width - 52, 5, 2);
    ctx.fill();

    // 5. Interlocking White Teeth along jawline
    ctx.fillStyle = '#FFFFFF';
    for (let tx = halfW - 20; tx < halfW - 4; tx += 4) {
      ctx.beginPath();
      ctx.moveTo(tx, 0);
      ctx.lineTo(tx + 2, 4);
      ctx.lineTo(tx + 4, 0);
      ctx.closePath();
      ctx.fill();
    }

    // 6. Clawed front & back legs
    ctx.fillStyle = '#047857';
    // Back leg
    ctx.beginPath();
    ctx.roundRect(-halfW + 24, halfH - 4, 10, 6, [2, 2, 4, 4]);
    ctx.fill();
    // Front leg
    ctx.beginPath();
    ctx.roundRect(halfW - 32, halfH - 4, 10, 6, [2, 2, 4, 4]);
    ctx.fill();

    // 7. Reptilian Eye with slit pupil
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(halfW - 14, -halfH + 6, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.ellipse(halfW - 14, -halfH + 6, 1.2, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Collar
    this.drawCollar(ctx, -halfW + 18, 0, 14, pColor);
    ctx.restore();
  }

  // 2. GIRAFFE: Authentic tall giraffe silhouette with long neck, head, ossicones, mane, spots, and hooves
  private renderGiraffe(
    ctx: CanvasRenderingContext2D,
    def: AnimalDef,
    halfW: number,
    halfH: number,
    pColor: string
  ) {
    ctx.save();

    // 1. Ossicones (horns with velvety knobs)
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, -halfH + 2);
    ctx.lineTo(-6, -halfH - 8);
    ctx.moveTo(5, -halfH + 2);
    ctx.lineTo(6, -halfH - 8);
    ctx.stroke();

    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.arc(-6, -halfH - 8, 3, 0, Math.PI * 2);
    ctx.arc(6, -halfH - 8, 3, 0, Math.PI * 2);
    ctx.fill();

    // 2. Mane along back of neck
    ctx.fillStyle = '#92400E';
    for (let my = -halfH + 18; my < halfH - 14; my += 7) {
      ctx.beginPath();
      ctx.moveTo(-halfW + 4, my);
      ctx.lineTo(-halfW - 2, my + 3);
      ctx.lineTo(-halfW + 4, my + 6);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Giraffe Body & Neck Contour
    const grad = ctx.createLinearGradient(0, -halfH, 0, halfH);
    grad.addColorStop(0, '#FEF08A');
    grad.addColorStop(0.5, '#FBBF24');
    grad.addColorStop(1, '#D97706');

    ctx.fillStyle = grad;
    ctx.beginPath();
    // Head top
    ctx.moveTo(-halfW + 3, -halfH + 8);
    ctx.quadraticCurveTo(0, -halfH + 4, halfW - 3, -halfH + 8);
    // Muzzle / nose
    ctx.quadraticCurveTo(halfW + 2, -halfH + 15, halfW - 3, -halfH + 20);
    // Neck down front
    ctx.quadraticCurveTo(halfW - 2, 0, halfW - 2, halfH - 8);
    // Front legs/hooves
    ctx.lineTo(halfW - 2, halfH);
    ctx.lineTo(halfW - 10, halfH);
    ctx.lineTo(halfW - 10, halfH - 8);
    // Belly gap
    ctx.lineTo(-halfW + 10, halfH - 8);
    // Rear legs/hooves
    ctx.lineTo(-halfW + 10, halfH);
    ctx.lineTo(-halfW + 2, halfH);
    ctx.lineTo(-halfW + 2, halfH - 8);
    // Neck back line up
    ctx.quadraticCurveTo(-halfW + 2, 0, -halfW + 3, -halfH + 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // 4. Dark Hooves
    ctx.fillStyle = '#451A03';
    ctx.fillRect(halfW - 10, halfH - 4, 8, 4);
    ctx.fillRect(-halfW + 2, halfH - 4, 8, 4);

    // 5. Irregular Polygon Giraffe Spots
    ctx.fillStyle = '#B45309';
    const spots = [
      { sx: 0, sy: -halfH + 26, r: 4 },
      { sx: 3, sy: -halfH + 37, r: 4.5 },
      { sx: -3, sy: -halfH + 48, r: 4.2 },
      { sx: 2, sy: -halfH + 59, r: 4 }
    ];
    for (const sp of spots) {
      ctx.beginPath();
      ctx.arc(sp.sx, sp.sy, sp.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Giraffe Eyes & Muzzle
    this.drawChibiEyes(ctx, 0, -halfH + 11, 4.5);
    ctx.fillStyle = '#FEF9C3';
    ctx.beginPath();
    ctx.ellipse(0, -halfH + 17, 5.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 7. Small tail tuft
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-halfW + 2, halfH - 12);
    ctx.lineTo(-halfW - 4, halfH - 6);
    ctx.stroke();

    // Collar
    this.drawCollar(ctx, 0, halfH - 14, halfW * 1.3, pColor);
    ctx.restore();
  }

  // 3. ELEPHANT: Authentic pachyderm shape with domed back, trunk, tusks, flapping ear, and pillar legs
  private renderElephant(
    ctx: CanvasRenderingContext2D,
    def: AnimalDef,
    halfW: number,
    halfH: number,
    pColor: string
  ) {
    ctx.save();

    // 1. Elephant Body Contour with domed back and pillar legs
    const grad = ctx.createLinearGradient(0, -halfH, 0, halfH);
    grad.addColorStop(0, '#94A3B8');
    grad.addColorStop(0.5, '#64748B');
    grad.addColorStop(1, '#475569');

    ctx.fillStyle = grad;
    ctx.beginPath();
    // Start at head top
    ctx.moveTo(halfW - 14, -halfH + 4);
    // Trunk arch down
    ctx.quadraticCurveTo(halfW + 6, -6, halfW + 4, 8);
    // Trunk curled tip
    ctx.quadraticCurveTo(halfW + 10, 15, halfW + 1, 14);
    ctx.quadraticCurveTo(halfW - 4, 12, halfW - 2, 4);
    // Front pillar leg
    ctx.lineTo(halfW - 4, halfH);
    ctx.lineTo(halfW - 18, halfH);
    ctx.lineTo(halfW - 18, halfH - 10);
    // Underbelly arch
    ctx.quadraticCurveTo(0, halfH - 12, -halfW + 18, halfH - 10);
    // Back pillar leg
    ctx.lineTo(-halfW + 18, halfH);
    ctx.lineTo(-halfW + 4, halfH);
    ctx.lineTo(-halfW + 4, halfH - 8);
    // Rump and domed back
    ctx.quadraticCurveTo(-halfW - 2, 0, -halfW + 6, -halfH + 8);
    ctx.quadraticCurveTo(-6, -halfH - 4, halfW - 14, -halfH + 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. White toenails on pillar feet
    ctx.fillStyle = '#FFFFFF';
    // Front foot nails
    ctx.beginPath();
    ctx.arc(halfW - 15, halfH - 1, 1.8, 0, Math.PI * 2);
    ctx.arc(halfW - 11, halfH - 1, 1.8, 0, Math.PI * 2);
    ctx.arc(halfW - 7, halfH - 1, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Back foot nails
    ctx.beginPath();
    ctx.arc(-halfW + 7, halfH - 1, 1.8, 0, Math.PI * 2);
    ctx.arc(-halfW + 11, halfH - 1, 1.8, 0, Math.PI * 2);
    ctx.arc(-halfW + 15, halfH - 1, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // 3. Ivory Tusks
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(halfW - 4, 4);
    ctx.quadraticCurveTo(halfW + 4, 8, halfW + 6, 3);
    ctx.lineTo(halfW - 2, 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // 4. Large Flapping Ear with inner pink shading
    ctx.fillStyle = '#64748B';
    ctx.beginPath();
    ctx.ellipse(halfW - 18, -4, 11, 15, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#FBCFE8';
    ctx.beginPath();
    ctx.ellipse(halfW - 18, -4, 7, 10, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 5. Eye
    this.drawChibiEyes(ctx, halfW - 6, -10, 3.5);

    // 6. Tail with hair tuft
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-halfW + 4, 2);
    ctx.lineTo(-halfW - 4, 10);
    ctx.stroke();

    // Collar
    this.drawCollar(ctx, -2, halfH - 14, halfW * 1.1, pColor);
    ctx.restore();
  }

  // 4. TURTLE: Authentic turtle shape with domed carapace, rim, hexagonal scutes, head, and swimming flippers
  private renderTurtle(
    ctx: CanvasRenderingContext2D,
    def: AnimalDef,
    halfW: number,
    halfH: number,
    pColor: string
  ) {
    ctx.save();

    // 1. Protruding Head with snout and beak
    ctx.fillStyle = '#6EE7B7';
    ctx.beginPath();
    ctx.ellipse(halfW + 4, -1, 8, 6.5, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#065F46';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Eye
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(halfW + 7, -3, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(halfW + 6.5, -3.5, 0.7, 0, Math.PI * 2);
    ctx.fill();

    // 2. Front & Back Swimming Flippers
    ctx.fillStyle = '#059669';
    // Front paddle
    ctx.beginPath();
    ctx.ellipse(halfW - 10, halfH + 1, 9, 4.5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // Back paddle
    ctx.beginPath();
    ctx.ellipse(-halfW + 8, halfH + 1, 8, 4, 0.35, 0, Math.PI * 2);
    ctx.fill();

    // 3. Tiny pointed tail
    ctx.beginPath();
    ctx.moveTo(-halfW + 2, 2);
    ctx.lineTo(-halfW - 6, 3);
    ctx.lineTo(-halfW + 2, 6);
    ctx.closePath();
    ctx.fill();

    // 4. Domed Carapace Shell Silhouette
    const shellGrad = ctx.createLinearGradient(0, -halfH, 0, halfH);
    shellGrad.addColorStop(0, '#34D399');
    shellGrad.addColorStop(0.5, '#10B981');
    shellGrad.addColorStop(1, '#059669');

    ctx.fillStyle = shellGrad;
    ctx.beginPath();
    // High arched dome
    ctx.moveTo(-halfW + 4, halfH - 2);
    ctx.quadraticCurveTo(-halfW + 2, -halfH - 2, 0, -halfH - 2);
    ctx.quadraticCurveTo(halfW - 2, -halfH - 2, halfW - 4, halfH - 2);
    // Flat plastron bottom
    ctx.lineTo(-halfW + 4, halfH - 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#064E3B';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // 5. Hexagonal Scute Plates on Shell
    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 1.4;
    // Center scute
    ctx.beginPath();
    ctx.arc(0, -3, 7.5, 0, Math.PI * 2);
    ctx.stroke();
    // Left & right scutes
    ctx.beginPath();
    ctx.arc(-14, -2, 6.5, 0, Math.PI * 2);
    ctx.arc(14, -2, 6.5, 0, Math.PI * 2);
    ctx.stroke();

    // Shell Rim Trim
    ctx.strokeStyle = '#064E3B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-halfW + 4, halfH - 3);
    ctx.lineTo(halfW - 4, halfH - 3);
    ctx.stroke();

    // Collar
    this.drawCollar(ctx, 0, halfH - 6, halfW * 0.9, pColor);
    ctx.restore();
  }

  // 5. PIG: Chubby barrel body, snout disk with nostrils, triangular floppy ears, trotters, and corkscrew tail
  private renderPig(
    ctx: CanvasRenderingContext2D,
    def: AnimalDef,
    halfW: number,
    halfH: number,
    pColor: string
  ) {
    ctx.save();

    // 1. Curly Corkscrew Tail
    ctx.strokeStyle = '#DB2777';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-halfW - 3, -1, 4, 0, Math.PI * 1.8);
    ctx.stroke();

    // 2. Folded Triangular Ears
    ctx.fillStyle = '#DB2777';
    ctx.beginPath();
    ctx.moveTo(-halfW + 8, -halfH + 4);
    ctx.lineTo(-halfW + 2, -halfH - 7);
    ctx.lineTo(-halfW + 16, -halfH);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(halfW - 8, -halfH + 4);
    ctx.lineTo(halfW - 2, -halfH - 7);
    ctx.lineTo(halfW - 16, -halfH);
    ctx.closePath();
    ctx.fill();

    // 3. Round Barrel Body
    const grad = ctx.createLinearGradient(0, -halfH, 0, halfH);
    grad.addColorStop(0, '#FBCFE8');
    grad.addColorStop(0.5, '#F472B6');
    grad.addColorStop(1, '#DB2777');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, halfW, halfH - 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#BE185D';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 4. Sturdy Trotter Legs with Cloven Hooves
    ctx.fillStyle = '#F472B6';
    ctx.beginPath();
    ctx.roundRect(-halfW + 8, halfH - 5, 8, 7, [2, 2, 3, 3]);
    ctx.roundRect(halfW - 16, halfH - 5, 8, 7, [2, 2, 3, 3]);
    ctx.fill();
    ctx.fillStyle = '#9D174D';
    ctx.fillRect(-halfW + 8, halfH, 8, 2);
    ctx.fillRect(halfW - 16, halfH, 8, 2);

    // 5. Expressive Eyes with Rosy Blushing Cheeks
    this.drawChibiEyes(ctx, 0, -6, 7.5);
    ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
    ctx.beginPath();
    ctx.arc(-11, 2, 4, 0, Math.PI * 2);
    ctx.arc(11, 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // 6. Chubby 3D Oval Pig Snout Disk
    ctx.fillStyle = '#EC4899';
    ctx.beginPath();
    ctx.ellipse(0, 3, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#BE185D';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Nostrils
    ctx.fillStyle = '#831843';
    ctx.beginPath();
    ctx.ellipse(-3.5, 3, 1.6, 2.2, 0, 0, Math.PI * 2);
    ctx.ellipse(3.5, 3, 1.6, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Collar
    this.drawCollar(ctx, 0, halfH - 6, halfW * 1.1, pColor);
    ctx.restore();
  }

  // 6. DUCK: Curved waterbird breast, upturned perky tail, orange flat bill, and folded wings
  private renderDuck(
    ctx: CanvasRenderingContext2D,
    def: AnimalDef,
    halfW: number,
    halfH: number,
    pColor: string
  ) {
    ctx.save();

    // 1. Upturned Pointed Tail Feathers
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(-halfW + 4, 2);
    ctx.lineTo(-halfW - 6, -halfH + 6);
    ctx.lineTo(-halfW + 8, -halfH + 12);
    ctx.closePath();
    ctx.fill();

    // 2. Duck Waterbird Body Silhouette
    const grad = ctx.createLinearGradient(0, -halfH, 0, halfH);
    grad.addColorStop(0, '#FEF08A');
    grad.addColorStop(0.5, '#FCD34D');
    grad.addColorStop(1, '#F59E0B');

    ctx.fillStyle = grad;
    ctx.beginPath();
    // Rounded breast on right
    ctx.moveTo(halfW - 4, -halfH + 8);
    ctx.quadraticCurveTo(halfW + 3, 0, halfW - 2, halfH - 4);
    // Rounded belly
    ctx.quadraticCurveTo(0, halfH + 2, -halfW + 6, halfH - 4);
    // Upturned back to tail
    ctx.lineTo(-halfW + 4, 0);
    // Back line to head
    ctx.quadraticCurveTo(-6, -halfH + 4, halfW - 4, -halfH + 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // 3. Folded Wing Silhouette
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.ellipse(-2, 1, 10, 6, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 4. Wide Flat Orange Duck Bill
    const billGrad = ctx.createLinearGradient(0, 0, 0, 8);
    billGrad.addColorStop(0, '#FB923C');
    billGrad.addColorStop(1, '#EA580C');
    ctx.fillStyle = billGrad;
    ctx.beginPath();
    ctx.roundRect(halfW - 6, -2, 12, 6, [3, 6, 6, 3]);
    ctx.fill();
    ctx.strokeStyle = '#C2410C';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 5. Cute Dark Eye
    this.drawChibiEyes(ctx, halfW - 10, -halfH + 9, 3);

    // 6. Orange Webbed Feet tucked underneath
    ctx.fillStyle = '#EA580C';
    ctx.beginPath();
    ctx.roundRect(-2, halfH - 2, 9, 3.5, 2);
    ctx.fill();

    // Collar
    this.drawCollar(ctx, -2, halfH - 6, halfW * 1.1, pColor);
    ctx.restore();
  }

  // 7. FROG: Authentic crouching frog shape with bulging top eyes, folded leaping hind legs, and smiling mouth
  private renderFrog(
    ctx: CanvasRenderingContext2D,
    def: AnimalDef,
    halfW: number,
    halfH: number,
    pColor: string
  ) {
    ctx.save();

    // 1. Folded Muscular Hind Leaping Legs on Flanks
    ctx.fillStyle = '#16A34A';
    // Left hind leg
    ctx.beginPath();
    ctx.ellipse(-halfW + 4, 3, 6.5, 9, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // Right hind leg
    ctx.beginPath();
    ctx.ellipse(halfW - 4, 3, 6.5, 9, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // 2. Large Bulging Spherical Eye Domes on Top of Head
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.arc(-7, -halfH + 2, 6.5, 0, Math.PI * 2);
    ctx.arc(7, -halfH + 2, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#15803D';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // 3. Wide Squat Amphibian Body
    const grad = ctx.createLinearGradient(0, -halfH, 0, halfH);
    grad.addColorStop(0, '#86EFAC');
    grad.addColorStop(0.5, '#4ADE80');
    grad.addColorStop(1, '#16A34A');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 1, halfW - 2, halfH - 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#15803D';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // 4. Creamy Underbelly
    ctx.fillStyle = '#FEF9C3';
    ctx.beginPath();
    ctx.ellipse(0, 3, halfW * 0.5, halfH * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // 5. Golden Eyes with Horizontal Slit Pupil
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(-7, -halfH + 2, 4.5, 0, Math.PI * 2);
    ctx.arc(7, -halfH + 2, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.ellipse(-7, -halfH + 2, 2.8, 1.4, 0, 0, Math.PI * 2);
    ctx.ellipse(7, -halfH + 2, 2.8, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Catchlights
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-8, -halfH + 1, 1, 0, Math.PI * 2);
    ctx.arc(6, -halfH + 1, 1, 0, Math.PI * 2);
    ctx.fill();

    // 6. Wide Happy Frog Smile
    ctx.strokeStyle = '#14532D';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 3, 6, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // 7. Small dappled freckles
    ctx.fillStyle = '#15803D';
    ctx.beginPath();
    ctx.arc(-4, -1, 1.2, 0, Math.PI * 2);
    ctx.arc(4, -1, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Collar
    this.drawCollar(ctx, 0, halfH - 4, halfW * 1.1, pColor);
    ctx.restore();
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
