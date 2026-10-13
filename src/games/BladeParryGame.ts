import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { CharacterMood } from '../core/CharacterRenderer';

export interface BladeTheme {
  name: string;
  bgGradTop: string;
  bgGradBot: string;
  spotlightP1: string;
  spotlightP2: string;
  matColor: string;
  apronColor: string;
  ropeColors: string[];
  postColor: string;
  themePillColor: string;
}

export const BLADE_THEMES: BladeTheme[] = [
  {
    name: 'Cyber Arena 80s ⚡',
    bgGradTop: '#090D16',
    bgGradBot: '#111827',
    spotlightP1: 'rgba(56, 189, 248, 0.08)',
    spotlightP2: 'rgba(244, 63, 94, 0.08)',
    matColor: '#334155',
    apronColor: '#1E293B',
    ropeColors: ['#EF4444', '#F8FAFC', '#3B82F6'],
    postColor: '#64748B',
    themePillColor: '#38BDF8'
  },
  {
    name: 'Retro Plastic Toys 🥊',
    bgGradTop: '#1E1B4B',
    bgGradBot: '#312E81',
    spotlightP1: 'rgba(245, 158, 11, 0.10)',
    spotlightP2: 'rgba(59, 130, 246, 0.10)',
    matColor: '#F59E0B',
    apronColor: '#B45309',
    ropeColors: ['#EF4444', '#FEF08A', '#3B82F6'],
    postColor: '#FBBF24',
    themePillColor: '#F59E0B'
  },
  {
    name: 'Mecha Foundry 🔥',
    bgGradTop: '#1C0A04',
    bgGradBot: '#290E05',
    spotlightP1: 'rgba(239, 68, 68, 0.12)',
    spotlightP2: 'rgba(249, 115, 22, 0.12)',
    matColor: '#262626',
    apronColor: '#171717',
    ropeColors: ['#EA580C', '#F97316', '#DC2626'],
    postColor: '#78350F',
    themePillColor: '#F97316'
  }
];

export interface RobotFighter {
  id: PlayerId;
  x: number;
  y: number;
  baseX: number;
  facing: 1 | -1; // 1 = facing right (Player 1), -1 = facing left (Player 2)
  score: number; // rounds won (first to 2 KOs wins)

  // Rock 'Em Sock 'Em Chin Ratchet & Coiled Spring Neck
  chinNotches: number; // 0 to 5 notches (at 5, HEAD POPS!)
  maxNotches: number;
  headSpringOffset: number; // visual spring extension in pixels
  headSpringVel: number; // spring physics velocity
  headTilt: number; // spring wobble angle on hit
  isHeadPopped: boolean; // POPPED! Knockout state

  // Arm Piston Punch Animations
  leftPunchAnim: number; // 0 to 1.0
  rightPunchAnim: number;
  activePunch: 'none' | 'left' | 'right';
  punchCooldown: number;

  // Blade Parry / Guard
  isGuarding: boolean;
  guardTimer: number;
  parryCooldown: number;
  parrySparks: number;

  // Stun / Hit Reaction & Underdog
  staggerTimer: number;
  invulnerableTimer: number;
  isUnderdog: boolean;
}

export class BladeParryGame extends BaseGame {
  private fighters: Map<PlayerId, RobotFighter> = new Map();
  private targetScore: number = 2; // Best of 3 Knockouts
  private currentRound: number = 1;
  private roundResetTimer: number = 0;
  private freezeFrames: number = 0;
  private ringRopesY: number[] = [];
  private ringBounds = { left: 0, right: 0, floorY: 0 };
  private ringRopeWobble: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();

  // Themes and Event Listeners
  private currentThemeIndex: number = 0;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private pointerdownHandler: ((e: PointerEvent) => void) | null = null;

  // On-screen Touch Button Rects
  private p1Btns = {
    left: { x: 0, y: 0, w: 56, h: 42 },
    parry: { x: 0, y: 0, w: 60, h: 42 },
    right: { x: 0, y: 0, w: 56, h: 42 }
  };
  private p2Btns = {
    left: { x: 0, y: 0, w: 56, h: 42 },
    parry: { x: 0, y: 0, w: 60, h: 42 },
    right: { x: 0, y: 0, w: 56, h: 42 }
  };

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  public destroy(): void {
    this.removeListeners();
    super.destroy();
    if (typeof window !== 'undefined' && (window as unknown as { __BLADE_PARRY_DEBUG__?: unknown }).__BLADE_PARRY_DEBUG__) {
      delete (window as unknown as { __BLADE_PARRY_DEBUG__?: unknown }).__BLADE_PARRY_DEBUG__;
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isFinished) return;
      if (e.code === 'KeyT') {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % BLADE_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.pointerdownHandler = (e: PointerEvent) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // Theme pill is at x: 20, y: canvas.height - 44, w: 170, h: 32
      if (clickX >= 20 && clickX <= 190 && clickY >= canvas.height - 44 && clickY <= canvas.height - 12) {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % BLADE_THEMES.length;
        this.audio.playTap();
        return;
      }

      const active = this.getActivePlayers();
      const f1 = this.fighters.get(active[0]?.id ?? 0);
      const f2 = this.fighters.get(active[1]?.id ?? 1);

      // P1 Touch Buttons
      if (f1 && f1.staggerTimer <= 0 && !f1.isHeadPopped) {
        if (this.isPointInRect(clickX, clickY, this.p1Btns.left)) {
          this.triggerPunch(f1, 'left');
          return;
        }
        if (this.isPointInRect(clickX, clickY, this.p1Btns.parry)) {
          this.triggerParry(f1);
          return;
        }
        if (this.isPointInRect(clickX, clickY, this.p1Btns.right)) {
          this.triggerPunch(f1, 'right');
          return;
        }
      }

      // P2 Touch Buttons
      if (f2 && f2.staggerTimer <= 0 && !f2.isHeadPopped) {
        if (this.isPointInRect(clickX, clickY, this.p2Btns.left)) {
          this.triggerPunch(f2, 'left');
          return;
        }
        if (this.isPointInRect(clickX, clickY, this.p2Btns.parry)) {
          this.triggerParry(f2);
          return;
        }
        if (this.isPointInRect(clickX, clickY, this.p2Btns.right)) {
          this.triggerPunch(f2, 'right');
          return;
        }
      }
    };
    window.addEventListener('pointerdown', this.pointerdownHandler);
  }

  private removeListeners(): void {
    if (typeof window === 'undefined') return;
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
    if (this.pointerdownHandler) {
      window.removeEventListener('pointerdown', this.pointerdownHandler);
      this.pointerdownHandler = null;
    }
  }

  private isPointInRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }): boolean {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 75;
    this.isFinished = false;
    this.currentRound = 1;
    this.roundResetTimer = 0;
    this.freezeFrames = 0;
    this.ringRopeWobble = 0;
    this.fighters.clear();
    this.botReactionTimers.clear();

    const ringW = Math.min(width - 80, 560);
    const ringLeft = width / 2 - ringW / 2;
    const ringRight = width / 2 + ringW / 2;
    const floorY = height * 0.76;
    this.ringBounds = { left: ringLeft, right: ringRight, floorY };
    this.ringRopesY = [floorY - 110, floorY - 75, floorY - 40];

    const active = this.getActivePlayers();
    const p1Id = active[0]?.id ?? 0;
    const p2Id = active[1]?.id ?? 1;

    // Player 1 (Red Rocker) on Left
    this.fighters.set(p1Id, {
      id: p1Id,
      x: ringLeft + ringW * 0.28,
      y: floorY,
      baseX: ringLeft + ringW * 0.28,
      facing: 1,
      score: 0,
      chinNotches: 0,
      maxNotches: 5,
      headSpringOffset: 0,
      headSpringVel: 0,
      headTilt: 0,
      isHeadPopped: false,
      leftPunchAnim: 0,
      rightPunchAnim: 0,
      activePunch: 'none',
      punchCooldown: 0,
      isGuarding: false,
      guardTimer: 0,
      parryCooldown: 0,
      parrySparks: 0,
      staggerTimer: 0,
      invulnerableTimer: 0,
      isUnderdog: false
    });

    // Player 2 (Blue Bomber) on Right
    this.fighters.set(p2Id, {
      id: p2Id,
      x: ringRight - ringW * 0.28,
      y: floorY,
      baseX: ringRight - ringW * 0.28,
      facing: -1,
      score: 0,
      chinNotches: 0,
      maxNotches: 5,
      headSpringOffset: 0,
      headSpringVel: 0,
      headTilt: 0,
      isHeadPopped: false,
      leftPunchAnim: 0,
      rightPunchAnim: 0,
      activePunch: 'none',
      punchCooldown: 0,
      isGuarding: false,
      guardTimer: 0,
      parryCooldown: 0,
      parrySparks: 0,
      staggerTimer: 0,
      invulnerableTimer: 0,
      isUnderdog: false
    });

    // Expose debug interface for tests
    if (typeof window !== 'undefined') {
      const game = this;
      (window as unknown as { __BLADE_PARRY_DEBUG__?: unknown }).__BLADE_PARRY_DEBUG__ = {
        get p1() { return game.fighters.get(p1Id); },
        get p2() { return game.fighters.get(p2Id); },
        get p1Wins() { return game.fighters.get(p1Id)?.score ?? 0; },
        get p2Wins() { return game.fighters.get(p2Id)?.score ?? 0; },
        getFighters: () => Array.from(game.fighters.values()),
        triggerP1Punch: (type: 'left' | 'right') => {
          const f1 = game.fighters.get(p1Id);
          if (f1) game.triggerPunch(f1, type);
        },
        triggerP1Parry: () => {
          const f1 = game.fighters.get(p1Id);
          if (f1) game.triggerParry(f1);
        },
        popP2Head: () => {
          const f2 = game.fighters.get(p2Id);
          const f1 = game.fighters.get(p1Id);
          if (f2 && f1) {
            f2.chinNotches = 5;
            game.triggerKnockout(f1, f2, width, height);
          }
        },
        addChinNotches: (targetId: number, notches: number) => {
          const target = game.fighters.get(targetId as PlayerId);
          const opponent = game.fighters.get((targetId === p1Id ? p2Id : p1Id) as PlayerId);
          if (target && opponent) {
            target.chinNotches = Math.min(target.maxNotches, target.chinNotches + notches);
            if (target.chinNotches >= target.maxNotches) {
              game.triggerKnockout(opponent, target, width, height);
            }
          }
        }
      };
    }
  }

  private resetRoundPositions(): void {
    const ringW = this.ringBounds.right - this.ringBounds.left;
    const active = this.getActivePlayers();
    const p1 = this.fighters.get(active[0]?.id ?? 0);
    const p2 = this.fighters.get(active[1]?.id ?? 1);

    // Check underdog status: trailing by 1 round KO
    const p1Score = p1?.score ?? 0;
    const p2Score = p2?.score ?? 0;

    if (p1) {
      p1.x = this.ringBounds.left + ringW * 0.28;
      p1.chinNotches = 0;
      p1.headSpringOffset = 0;
      p1.headSpringVel = 0;
      p1.headTilt = 0;
      p1.isHeadPopped = false;
      p1.leftPunchAnim = 0;
      p1.rightPunchAnim = 0;
      p1.activePunch = 'none';
      p1.punchCooldown = 0;
      p1.isGuarding = false;
      p1.guardTimer = 0;
      p1.staggerTimer = 0;
      p1.invulnerableTimer = 0.5;
      p1.isUnderdog = p1Score < p2Score;
    }

    if (p2) {
      p2.x = this.ringBounds.right - ringW * 0.28;
      p2.chinNotches = 0;
      p2.headSpringOffset = 0;
      p2.headSpringVel = 0;
      p2.headTilt = 0;
      p2.isHeadPopped = false;
      p2.leftPunchAnim = 0;
      p2.rightPunchAnim = 0;
      p2.activePunch = 'none';
      p2.punchCooldown = 0;
      p2.isGuarding = false;
      p2.guardTimer = 0;
      p2.staggerTimer = 0;
      p2.invulnerableTimer = 0.5;
      p2.isUnderdog = p2Score < p1Score;
    }

    this.roundResetTimer = 0;
    this.audio.playCountdown(true);
    this.particles.showFloatingText(
      `ROUND ${this.currentRound} — FIGHT!`,
      (this.ringBounds.left + this.ringBounds.right) / 2,
      this.ringBounds.floorY - 140,
      '#F59E0B',
      28
    );
  }

  public triggerPunch(f: RobotFighter, type: 'left' | 'right'): void {
    if (f.activePunch !== 'none' || f.punchCooldown > 0 || f.staggerTimer > 0 || f.isHeadPopped) return;

    f.activePunch = type;
    f.isGuarding = false;
    f.guardTimer = 0;

    if (type === 'left') {
      f.leftPunchAnim = 0.01;
      f.punchCooldown = 0.22; // Quick jab
    } else {
      f.rightPunchAnim = 0.01;
      f.punchCooldown = 0.30; // Heavy cross
    }

    this.audio.playLaser();
  }

  public triggerParry(f: RobotFighter): void {
    if (f.parryCooldown > 0 || f.staggerTimer > 0 || f.isHeadPopped) return;

    f.isGuarding = true;
    // Underdog receives an extended parry window (0.42s vs 0.32s)
    f.guardTimer = f.isUnderdog ? 0.42 : 0.32;
    f.parryCooldown = 0.45;
    f.activePunch = 'none';
    f.leftPunchAnim = 0;
    f.rightPunchAnim = 0;

    this.audio.playTap();
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    // Hitstop freeze frame
    if (this.freezeFrames > 0) {
      this.freezeFrames -= dt;
      return;
    }

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    if (this.ringRopeWobble > 0) {
      this.ringRopeWobble = Math.max(0, this.ringRopeWobble - dt * 4);
    }

    // Round reset countdown after a knockout
    if (this.roundResetTimer > 0) {
      this.roundResetTimer -= dt;
      if (this.roundResetTimer <= 0) {
        this.resetRoundPositions();
      }
    }

    const fightersList = Array.from(this.fighters.values());
    const f1 = fightersList[0];
    const f2 = fightersList[1];

    // Process inputs and timers for each fighter
    for (const f of fightersList) {
      if (f.staggerTimer > 0) f.staggerTimer -= dt;
      if (f.invulnerableTimer > 0) f.invulnerableTimer -= dt;
      if (f.punchCooldown > 0) f.punchCooldown -= dt;
      if (f.parryCooldown > 0) f.parryCooldown -= dt;
      if (f.parrySparks > 0) f.parrySparks -= dt;

      if (f.guardTimer > 0) {
        f.guardTimer -= dt;
        if (f.guardTimer <= 0) {
          f.isGuarding = false;
        }
      }

      // Update Piston Punch animations
      if (f.activePunch === 'left') {
        f.leftPunchAnim += dt * 8.5; // Fast jab
        if (f.leftPunchAnim >= 1.0) {
          f.leftPunchAnim = 0;
          f.activePunch = 'none';
        }
      } else if (f.activePunch === 'right') {
        f.rightPunchAnim += dt * 6.5; // Heavy cross
        if (f.rightPunchAnim >= 1.0) {
          f.rightPunchAnim = 0;
          f.activePunch = 'none';
        }
      }

      // Harmonic Spring Neck Physics
      let targetSpringH = (f.chinNotches / f.maxNotches) * 16;
      if (f.isHeadPopped) {
        targetSpringH = 38 + Math.sin(performance.now() * 0.015) * 6;
      }

      const springForce = (targetSpringH - f.headSpringOffset) * 220;
      const damping = -f.headSpringVel * 16;
      f.headSpringVel += (springForce + damping) * dt;
      f.headSpringOffset += f.headSpringVel * dt;
      f.headTilt *= Math.max(0, 1 - dt * 8);

      // Player Movement & Combat Inputs
      const isBot = this.players[f.id]?.type.startsWith('bot_');
      if (!isBot && f.staggerTimer <= 0 && !f.isHeadPopped && this.roundResetTimer <= 0) {
        const steer = this.input.getSteer(f.id);
        const throttle = this.input.getThrottle(f.id);
        const justAction = this.input.justAction(f.id);
        const justPressed = this.input.justPressed(f.id);

        // Movement shuffle (+20% speed for Underdog)
        const moveSpeed = 230 * (f.isUnderdog ? 1.20 : 1.0);
        if (steer !== 0) {
          f.x += steer * moveSpeed * dt;
        }

        // Left Punch (W or Up arrow or throttle > 0.4)
        if (throttle > 0.4) {
          this.triggerPunch(f, 'left');
        } else if (throttle < -0.4) {
          // Right Punch (S or Down arrow or throttle < -0.4)
          this.triggerPunch(f, 'right');
        } else if (justAction || this.input.isActionPressed(f.id) || (justPressed && steer === 0)) {
          // Action button: Blade Parry Guard
          this.triggerParry(f);
        }
      }

      // Constrain inside boxing ring ropes
      const minX = this.ringBounds.left + 35;
      const maxX = this.ringBounds.right - 35;
      if (f.x < minX) {
        f.x = minX;
        this.ringRopeWobble = 1.0;
      } else if (f.x > maxX) {
        f.x = maxX;
        this.ringRopeWobble = 1.0;
      }
    }

    // Enforce body collision between the two robots
    if (f1 && f2) {
      const minDist = 52;
      const dx = f2.x - f1.x;
      if (dx < minDist) {
        const overlap = minDist - dx;
        f1.x -= overlap / 2;
        f2.x += overlap / 2;
      }
    }

    // Process Punch Hits, Clashes, and Parries
    if (f1 && f2 && this.roundResetTimer <= 0) {
      this.checkCombatInteractions(f1, f2, width, height);
      this.checkCombatInteractions(f2, f1, width, height);
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private checkCombatInteractions(
    attacker: RobotFighter,
    defender: RobotFighter,
    width: number,
    height: number
  ): void {
    if (attacker.activePunch === 'none' || defender.invulnerableTimer > 0 || defender.isHeadPopped) return;

    const punchAnim = attacker.activePunch === 'left' ? attacker.leftPunchAnim : attacker.rightPunchAnim;
    if (punchAnim < 0.42 || punchAnim > 0.68) return;

    const reach = attacker.activePunch === 'left' ? 64 : 74;
    const fistX = attacker.x + attacker.facing * reach;
    const distToDefender = Math.abs(fistX - defender.x);

    if (distToDefender <= 28) {
      // 1. Check Simultaneous Mid-Air Blade Clash!
      const defPunchAnim = defender.activePunch === 'left' ? defender.leftPunchAnim : defender.rightPunchAnim;
      if (defender.activePunch !== 'none' && defPunchAnim >= 0.35 && defPunchAnim <= 0.75) {
        attacker.activePunch = 'none';
        attacker.leftPunchAnim = 0;
        attacker.rightPunchAnim = 0;
        defender.activePunch = 'none';
        defender.leftPunchAnim = 0;
        defender.rightPunchAnim = 0;

        attacker.x -= attacker.facing * 20;
        defender.x -= defender.facing * 20;

        const clashX = (attacker.x + defender.x) / 2;
        const clashY = attacker.y - 48;
        this.particles.spawnSparks(clashX, clashY, '#FACC15', 25);
        this.particles.showFloatingText('⚡ BLADE CLASH!', clashX, clashY - 30, '#FACC15', 22);
        this.audio.playLaser();
        this.particles.addTrauma(0.2);
        return;
      }

      // 2. Check Blade Parry / Guard Block
      if (defender.isGuarding) {
        attacker.activePunch = 'none';
        attacker.leftPunchAnim = 0;
        attacker.rightPunchAnim = 0;
        attacker.staggerTimer = 0.65; // Staggered! Guard broken
        attacker.x -= attacker.facing * 18;

        defender.parrySparks = 0.25;
        this.audio.playTap();
        this.freezeFrames = 0.06;

        const parryX = (fistX + defender.x) / 2;
        const parryY = defender.y - 50;
        this.particles.spawnSparks(parryX, parryY, '#38BDF8', 20);

        // Underdog counter-parry delivers a quick counter notch!
        if (defender.isUnderdog) {
          attacker.chinNotches = Math.min(attacker.maxNotches, attacker.chinNotches + 1.5);
          attacker.headSpringVel = 120;
          this.particles.showFloatingText('🛡️ UNDERDOG COUNTER! +1.5 NOTCH!', parryX, parryY - 30, '#FBBF24', 22);
        } else {
          this.particles.showFloatingText('🛡️ PARRY! GUARD BROKEN!', parryX, parryY - 30, '#38BDF8', 22);
        }
        this.particles.addTrauma(0.3);
        return;
      }

      // 3. Clean Punch Lands On Chin!
      const punchType = attacker.activePunch;
      attacker.activePunch = 'none';
      attacker.leftPunchAnim = 0;
      attacker.rightPunchAnim = 0;

      const isSuddenDeath = this.roundTimer <= 15;
      const baseDamage = punchType === 'right' ? 1.5 : 1.0;
      const damage = baseDamage + (isSuddenDeath ? 1.0 : 0);

      defender.chinNotches = Math.min(defender.maxNotches, defender.chinNotches + damage);
      defender.headSpringVel = 140;
      defender.headTilt = -defender.facing * 0.35;
      defender.x -= defender.facing * 16;
      defender.invulnerableTimer = 0.18;

      this.freezeFrames = 0.05;
      this.audio.playBounce();
      this.particles.addTrauma(0.2);

      const hitX = defender.x;
      const hitY = defender.y - 50;
      this.particles.spawnSparks(hitX, hitY, this.players[attacker.id].color, 16);

      // Check for Knockout
      if (defender.chinNotches >= defender.maxNotches) {
        this.triggerKnockout(attacker, defender, width, height);
      } else {
        const notchesLeft = Math.ceil(defender.maxNotches - defender.chinNotches);
        this.particles.showFloatingText(`💥 CLACK! (${notchesLeft} LEFT)`, hitX, hitY - 30, '#F59E0B', 20);
      }
    }
  }

  private triggerKnockout(
    winner: RobotFighter,
    loser: RobotFighter,
    width: number,
    height: number
  ): void {
    loser.isHeadPopped = true;
    loser.headSpringVel = 260; // Launch head up high!
    loser.staggerTimer = 2.0;

    winner.score++;
    this.roundResetTimer = 2.2;
    this.freezeFrames = 0.12;

    this.audio.playExplosion();
    this.audio.playFanfare();
    this.particles.addTrauma(0.5);

    const popX = loser.x;
    const popY = loser.y - 75;
    this.particles.spawnExplosion(popX, popY, this.players[loser.id].color, 35);
    this.particles.spawnSparks(popX, popY, '#FACC15', 30);
    this.particles.showFloatingText('💥 KNOCKOUT! HEAD POPPED!', popX, popY - 45, '#EF4444', 32);

    if (winner.score >= this.targetScore) {
      this.isFinished = true;
    } else {
      this.currentRound++;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const bot = this.fighters.get(botId);
    if (!bot || bot.staggerTimer > 0 || bot.isHeadPopped || this.roundResetTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    const opponent = Array.from(this.fighters.values()).find((f) => f.id !== botId);
    if (!opponent) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    this.botReactionTimers.set(botId, timer);

    const dist = Math.abs(bot.x - opponent.x);
    let steer = 0;

    // Boxing Stance & Distance Management
    const idealDist = difficulty === 'bot_hard' ? 70 : 82;
    if (dist > idealDist + 12) {
      steer = bot.facing * 1;
    } else if (dist < idealDist - 12) {
      steer = -bot.facing * 1;
    }

    // Reaction to Player's Incoming Punches
    if (opponent.activePunch !== 'none') {
      const parryChance = difficulty === 'bot_hard' ? 0.65 : difficulty === 'bot_normal' ? 0.35 : 0.12;
      if (Math.random() < parryChance && bot.parryCooldown <= 0) {
        this.triggerParry(bot);
        this.input.setBotInput(botId, true, steer, 0, false);
        return;
      }
    }

    // Offensive Punching Combinations
    if (dist <= 80 && bot.punchCooldown <= 0 && timer <= 0) {
      const punchCadence = difficulty === 'bot_hard' ? 0.18 : difficulty === 'bot_normal' ? 0.32 : 0.55;
      this.botReactionTimers.set(botId, punchCadence + Math.random() * 0.2);

      if (opponent.staggerTimer > 0) {
        this.triggerPunch(bot, 'right');
      } else {
        const punchType = Math.random() < 0.6 ? 'left' : 'right';
        this.triggerPunch(bot, punchType);
      }
    }

    this.input.setBotInput(botId, false, steer, 0, false);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const list = Array.from(this.fighters.values()).sort((a, b) => b.score - a.score);
    const winner = list[0]?.score > 0 ? list[0] : null;
    const winnerId = winner ? winner.id : null;

    return {
      winnerId,
      rankings: list.map((f, idx) => ({
        playerId: f.id,
        score: f.score,
        place: idx + 1
      })),
      mvpHighlight:
        winnerId !== null
          ? `${this.players[winnerId].name} POPPED THEIR RIVAL'S BLOCK OFF!`
          : 'INTENSE ROBOT BRAWL DRAW!'
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const theme = BLADE_THEMES[this.currentThemeIndex];
    const isSuddenDeath = this.roundTimer <= 15;

    // 1. Stadium Colosseum Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBot);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Overhead Stadium Spotlights
    ctx.save();
    ctx.fillStyle = theme.spotlightP1;
    ctx.beginPath();
    ctx.moveTo(width * 0.2, 0);
    ctx.lineTo(width * 0.4, this.ringBounds.floorY);
    ctx.lineTo(width * 0.1, this.ringBounds.floorY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = theme.spotlightP2;
    ctx.beginPath();
    ctx.moveTo(width * 0.8, 0);
    ctx.lineTo(width * 0.9, this.ringBounds.floorY);
    ctx.lineTo(width * 0.6, this.ringBounds.floorY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 2. The Boxing Ring Mat & Apron
    const rb = this.ringBounds;
    const matHeight = height - rb.floorY;

    // Wooden / Steel ring apron
    ctx.fillStyle = theme.apronColor;
    ctx.fillRect(rb.left - 24, rb.floorY, rb.right - rb.left + 48, matHeight);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(rb.left - 24, rb.floorY + 12, rb.right - rb.left + 48, matHeight - 12);

    // Boxing Ring Canvas Surface
    ctx.fillStyle = theme.matColor;
    ctx.fillRect(rb.left, rb.floorY - 6, rb.right - rb.left, 18);

    // Center Ring Logo
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(width / 2, rb.floorY - 2, 60, Math.PI, 0);
    ctx.stroke();
    ctx.restore();

    // 3. Elastic Ring Ropes
    for (let r = 0; r < this.ringRopesY.length; r++) {
      const ry = this.ringRopesY[r];
      const wobbleOffset = Math.sin(performance.now() * 0.02 + r) * (this.ringRopeWobble * 4);

      ctx.strokeStyle = isSuddenDeath ? '#EF4444' : theme.ropeColors[r % theme.ropeColors.length];
      ctx.lineWidth = isSuddenDeath ? 5 : 4;
      ctx.beginPath();
      ctx.moveTo(rb.left, ry);
      ctx.quadraticCurveTo(width / 2, ry + 3 + wobbleOffset, rb.right, ry);
      ctx.stroke();
    }

    // 4. Corner Turnbuckles
    this.renderTurnbuckle(ctx, rb.left, rb.floorY, '#EF4444', theme.postColor);
    this.renderTurnbuckle(ctx, rb.right, rb.floorY, '#3B82F6', theme.postColor);

    // 5. Render Combat Robots
    for (const f of this.fighters.values()) {
      this.renderRobot(ctx, f);
    }

    // 6. HUD: Round Score, Chin Ratchet Meters & Controls
    this.renderHUD(ctx, width, height, theme);

    ctx.restore();
  }

  private renderTurnbuckle(
    ctx: CanvasRenderingContext2D,
    x: number,
    floorY: number,
    padColor: string,
    postColor: string
  ): void {
    ctx.save();
    ctx.fillStyle = postColor;
    ctx.fillRect(x - 6, floorY - 130, 12, 130);

    for (const ry of this.ringRopesY) {
      ctx.fillStyle = padColor;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - 9, ry - 7, 18, 14, 4);
      else ctx.rect(x - 9, ry - 7, 18, 14);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(x, floorY - 130, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderRobot(ctx: CanvasRenderingContext2D, f: RobotFighter): void {
    ctx.save();
    ctx.translate(f.x, f.y);

    const isP1 = f.facing === 1;
    const armorColor = isP1 ? '#EF4444' : '#3B82F6';
    const armorDark = isP1 ? '#991B1B' : '#1E40AF';
    const visorColor = isP1 ? '#38BDF8' : '#FBBF24';

    // Underdog Overcharge Fury Steam/Aura
    if (f.isUnderdog) {
      ctx.save();
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.ellipse(0, -45, 36, 55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#FBBF24';
      ctx.font = '800 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ OVERCHARGE FURY!', 0, -118 - f.headSpringOffset);
    }

    // Shadow on Ring Canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stagger / Stun Dizzy Wobble
    let bodyAngle = 0;
    if (f.staggerTimer > 0) {
      bodyAngle = Math.sin(performance.now() * 0.03) * 0.12;
      ctx.rotate(bodyAngle);

      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💫 STUNNED!', 0, -110 - f.headSpringOffset);
    }

    // 1. Robot Chunky Legs & Steel Boots
    ctx.fillStyle = '#334155';
    ctx.fillRect(-12, -22, 10, 22);
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(-14, -6, 14, 6);
    ctx.fillStyle = '#475569';
    ctx.fillRect(2, -22, 10, 22);
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, -6, 14, 6);

    // 2. Heavy Robot Torso with Chrome Chestplate & Grill
    const torsoY = -62;
    ctx.fillStyle = armorDark;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-20, torsoY, 40, 42, 6);
    else ctx.rect(-20, torsoY, 40, 42);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Chestplate
    ctx.fillStyle = armorColor;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-16, torsoY + 4, 32, 34, 4);
    else ctx.rect(-16, torsoY + 4, 32, 34);
    ctx.fill();

    // Cooling Exhaust Vent Grills
    ctx.fillStyle = '#0F172A';
    for (let gy = torsoY + 12; gy <= torsoY + 28; gy += 6) {
      ctx.fillRect(-10, gy, 20, 2.5);
    }

    // 3. Iconic Coiled Steel Spring Neck
    const neckBaseY = torsoY;
    const springH = Math.max(8, 12 + f.headSpringOffset);

    ctx.save();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();

    const coils = 5;
    const coilW = 10;
    ctx.moveTo(0, neckBaseY);
    for (let c = 0; c < coils; c++) {
      const cy = neckBaseY - (c + 0.5) * (springH / coils);
      const sign = c % 2 === 0 ? 1 : -1;
      ctx.lineTo(sign * coilW, cy);
    }
    ctx.lineTo(0, neckBaseY - springH);
    ctx.stroke();
    ctx.restore();

    // 4. Heavy Robot Head Block
    const headY = neckBaseY - springH;
    ctx.save();
    ctx.translate(0, headY);
    ctx.rotate(f.headTilt);

    // Head Base Jaw
    ctx.fillStyle = armorDark;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-18, -32, 36, 32, 6);
    else ctx.rect(-18, -32, 36, 32);
    ctx.fill();

    // Chin Ratchet Notches
    ctx.fillStyle = '#F59E0B';
    const notchW = 4;
    for (let n = 0; n < f.maxNotches; n++) {
      const ny = -4 - n * 5;
      ctx.fillRect(f.facing * 14, ny, f.facing * notchW, 3);
    }

    // Glowing Combat Visor Eye
    ctx.fillStyle = visorColor;
    ctx.shadowColor = visorColor;
    ctx.shadowBlur = 10;
    ctx.fillRect(f.facing * 2, -22, f.facing * 14, 8);
    ctx.shadowBlur = 0;

    // Head Pop Steam Plume
    if (f.isHeadPopped) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💥 POP!', 0, -42);
    }

    ctx.restore();

    // 5. Arms & Blade Piston Fist Mechanics
    this.renderRobotArms(ctx, f, torsoY, armorColor, armorDark);

    ctx.restore();
  }

  private renderRobotArms(
    ctx: CanvasRenderingContext2D,
    f: RobotFighter,
    torsoY: number,
    armorColor: string,
    armorDark: string
  ): void {
    const sign = f.facing;
    const shoulderY = torsoY + 12;

    // Blade Parry Guard Stance
    if (f.isGuarding) {
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sign * 10, shoulderY + 14);
      ctx.lineTo(sign * 28, shoulderY - 18);
      ctx.moveTo(sign * 10, shoulderY - 18);
      ctx.lineTo(sign * 28, shoulderY + 14);
      ctx.stroke();

      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.beginPath();
      ctx.arc(sign * 18, shoulderY, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Left Piston Arm (High Jab)
    const leftExt = f.leftPunchAnim > 0 ? Math.sin(f.leftPunchAnim * Math.PI) * 44 : 0;
    ctx.save();
    ctx.fillStyle = armorDark;
    ctx.beginPath();
    ctx.arc(-sign * 14, shoulderY - 2, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#475569';
    ctx.fillRect(-sign * 12, shoulderY - 6, sign * 14, 8);

    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(0, shoulderY - 4, sign * (14 + leftExt), 5);

    const fistX = sign * (16 + leftExt);
    const fistY = shoulderY - 2;
    ctx.fillStyle = armorColor;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(fistX - 7, fistY - 8, 14, 14, 4);
    else ctx.rect(fistX - 7, fistY - 8, 14, 14);
    ctx.fill();

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(fistX + sign * 6, fistY - 10);
    ctx.lineTo(fistX + sign * 18, fistY);
    ctx.lineTo(fistX + sign * 6, fistY + 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Right Piston Arm (Body Cross)
    const rightExt = f.rightPunchAnim > 0 ? Math.sin(f.rightPunchAnim * Math.PI) * 54 : 0;
    ctx.save();
    ctx.fillStyle = armorDark;
    ctx.beginPath();
    ctx.arc(sign * 12, shoulderY + 8, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(sign * 12, shoulderY + 6, sign * (14 + rightExt), 6);

    const rFistX = sign * (24 + rightExt);
    const rFistY = shoulderY + 8;
    ctx.fillStyle = armorColor;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(rFistX - 8, rFistY - 9, 16, 16, 5);
    else ctx.rect(rFistX - 8, rFistY - 9, 16, 16);
    ctx.fill();

    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.moveTo(rFistX + sign * 8, rFistY - 12);
    ctx.lineTo(rFistX + sign * 22, rFistY);
    ctx.lineTo(rFistX + sign * 8, rFistY + 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private renderHUD(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    theme: BladeTheme
  ): void {
    const active = this.getActivePlayers();
    const f1 = active[0] ? this.fighters.get(active[0].id) : undefined;
    const f2 = active[1] ? this.fighters.get(active[1].id) : undefined;

    // 1. Top Center Round Bell & Fight Status
    const centerZoneY = 56;
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(width / 2 - 130, centerZoneY - 14, 260, 28, 14);
    else ctx.rect(width / 2 - 130, centerZoneY - 14, 260, 28);
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.font = '800 12px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`🥊 ROUND ${this.currentRound} — FIRST TO 2 KNOCKOUTS`, width / 2, centerZoneY + 4);
    ctx.restore();

    // 2. Player 1 Chin Notch Meter & Mascot
    if (f1) {
      this.renderFighterScoreboard(ctx, f1, 28, 48, 'left');
    }

    // 3. Player 2 Chin Notch Meter & Mascot
    if (f2) {
      this.renderFighterScoreboard(ctx, f2, width - 28, 48, 'right');
    }

    // 4. Interactive Bottom-Left Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, height - 44, 170, 32, 16);
    else ctx.rect(20, height - 44, 170, 32);
    ctx.fill();
    ctx.strokeStyle = theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.themePillColor;
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.name} [T]`, 20 + 85, height - 44 + 16);
    ctx.restore();

    // 5. On-Screen Touch Controls
    this.renderTouchButtons(ctx, width, height);
  }

  private renderFighterScoreboard(
    ctx: CanvasRenderingContext2D,
    f: RobotFighter,
    x: number,
    y: number,
    align: 'left' | 'right'
  ): void {
    const p = this.players[f.id];
    const isLeft = align === 'left';
    const startX = isLeft ? x : x - 180;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(startX, y, 180, 52, 12);
    else ctx.rect(startX, y, 180, 52);
    ctx.fill();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Mascot Face
    let mood: CharacterMood = 'focused';
    if (f.isHeadPopped) mood = 'shocked';
    else if (f.score >= this.targetScore) mood = 'triumph';
    else if (f.isGuarding) mood = 'happy';
    this.drawPlayerMascot(ctx, f.id, startX + 22, y + 26, 14, mood, performance.now() * 0.001);

    // Player Name & KOs
    ctx.font = '800 11.5px Montserrat, sans-serif';
    ctx.fillStyle = p.color;
    ctx.textAlign = 'left';
    const koGloves = '🥊'.repeat(f.score) + '⚪'.repeat(Math.max(0, this.targetScore - f.score));
    ctx.fillText(`${p.name.toUpperCase()} ${koGloves}`, startX + 44, y + 18);

    // Chin Spring Notches
    ctx.font = '700 9.5px Montserrat, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('SPRING:', startX + 44, y + 38);

    const pipStartX = startX + 96;
    for (let i = 0; i < f.maxNotches; i++) {
      const isFilled = i < Math.floor(f.chinNotches);
      const isDanger = i >= 3;
      ctx.fillStyle = isFilled ? (isDanger ? '#EF4444' : '#F59E0B') : 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(pipStartX + i * 14, y + 29, 11, 12, 3);
      else ctx.rect(pipStartX + i * 14, y + 29, 11, 12);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderTouchButtons(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const btnY = height - 56;
    const btnH = 42;

    // Layout P1 buttons shifted to clear the theme pill (x: 200..380)
    this.p1Btns = {
      left: { x: 205, y: btnY, w: 56, h: btnH },
      parry: { x: 268, y: btnY, w: 64, h: btnH },
      right: { x: 338, y: btnY, w: 56, h: btnH }
    };

    // Layout P2 buttons on bottom right
    this.p2Btns = {
      left: { x: width - 210, y: btnY, w: 56, h: btnH },
      parry: { x: width - 146, y: btnY, w: 64, h: btnH },
      right: { x: width - 74, y: btnY, w: 56, h: btnH }
    };

    // Render P1 Buttons
    this.drawTouchBtn(ctx, this.p1Btns.left, '🤛 JAB', '#EF4444', '[W]');
    this.drawTouchBtn(ctx, this.p1Btns.parry, '🛡️ PARRY', '#38BDF8', '[SPACE]');
    this.drawTouchBtn(ctx, this.p1Btns.right, '🤜 HOOK', '#EF4444', '[S]');

    // Render P2 Buttons
    this.drawTouchBtn(ctx, this.p2Btns.left, '🤛 JAB', '#3B82F6', '[↑]');
    this.drawTouchBtn(ctx, this.p2Btns.parry, '🛡️ PARRY', '#38BDF8', '[ENTER]');
    this.drawTouchBtn(ctx, this.p2Btns.right, '🤜 HOOK', '#3B82F6', '[↓]');
  }

  private drawTouchBtn(
    ctx: CanvasRenderingContext2D,
    r: { x: number; y: number; w: number; h: number },
    label: string,
    color: string,
    keyHint: string
  ): void {
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(r.x, r.y, r.w, r.h, 10);
    else ctx.rect(r.x, r.y, r.w, r.h);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.font = '800 10.5px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, r.x + r.w / 2, r.y + 19);

    ctx.font = '700 8.5px Montserrat, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(keyHint, r.x + r.w / 2, r.y + 33);
    ctx.restore();
  }
}
