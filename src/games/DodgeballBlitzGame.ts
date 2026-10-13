import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type DodgeballThemeId = 'gym' | 'cyber' | 'caldera';

interface DodgeballTheme {
  id: DodgeballThemeId;
  name: string;
  icon: string;
  floorColor: string;
  floorPlankColor: string;
  courtLineColor: string;
  centerLineColor: string;
  ballBaseColor: string;
  ballGlowColor: string;
  accentColor: string;
}

const THEMES: Record<DodgeballThemeId, DodgeballTheme> = {
  gym: {
    id: 'gym',
    name: 'Hardwood Gym',
    icon: '🏀',
    floorColor: '#D97706',
    floorPlankColor: 'rgba(180, 83, 9, 0.35)',
    courtLineColor: '#FFFFFF',
    centerLineColor: '#FBBF24',
    ballBaseColor: '#EF4444',
    ballGlowColor: '#FCA5A5',
    accentColor: '#F59E0B'
  },
  cyber: {
    id: 'cyber',
    name: 'Cyberpunk Grid',
    icon: '⚡',
    floorColor: '#0F172A',
    floorPlankColor: 'rgba(56, 189, 248, 0.12)',
    courtLineColor: '#06B6D4',
    centerLineColor: '#38BDF8',
    ballBaseColor: '#06B6D4',
    ballGlowColor: '#67E8F9',
    accentColor: '#38BDF8'
  },
  caldera: {
    id: 'caldera',
    name: 'Volcanic Court',
    icon: '🔥',
    floorColor: '#261208',
    floorPlankColor: 'rgba(239, 68, 68, 0.22)',
    courtLineColor: '#F97316',
    centerLineColor: '#EF4444',
    ballBaseColor: '#EA580C',
    ballGlowColor: '#FDBA74',
    accentColor: '#F97316'
  }
};

export interface Dodgeball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  holderId: PlayerId | null;
  state: 'idle' | 'held' | 'thrown';
  throwerId: PlayerId | null;
  trail: { x: number; y: number }[];
  bounces: number;
}

export interface DodgePlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  angle: number;
  isAlive: boolean;
  score: number;
  roundWins: number;
  hits: number;
  catches: number;
  throwCooldown: number;
  catchWindow: number;
  invulnerableTimer: number;
  hasBall: boolean;
  heldBallId: number | null;
  ballHoldTimer: number;
  team: 'LEFT' | 'RIGHT';
  dodgeAnimTimer: number;
  mood: CharacterMood;
  moodTimer: number;
}

interface BotMemory {
  state: 'RUSH_BALL' | 'ATTACK' | 'DODGE' | 'DEFEND_PATROL';
  targetBallId: number | null;
  windUpTimer: number;
  targetAimAngle: number;
  dodgeTimer: number;
  dodgeVelX: number;
  dodgeVelY: number;
  patrolYDir: 1 | -1;
  patrolTimer: number;
}

export class DodgeballBlitzGame extends BaseGame {
  private currentThemeId: DodgeballThemeId = 'gym';
  public playersState: Map<PlayerId, DodgePlayer> = new Map();
  public balls: Dodgeball[] = [];

  private courtBounds = { minX: 60, maxX: 740, minY: 72, maxY: 530 };
  private centerLineX: number = 400;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private botMemories: Map<PlayerId, BotMemory> = new Map();
  private ballRollTimer: number = 0;
  private roundResetTimer: number = 0;
  private currentSet: number = 1;
  private targetWins: number = 2; // Best of 3 sets
  private teamWins: { LEFT: number; RIGHT: number } = { LEFT: 0, RIGHT: 0 };

  private animTimer: number = 0;
  private suddenDeathTriggered: boolean = false;

  private onKeyDownBound: (e: KeyboardEvent) => void;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 55.0;
    this.onKeyDownBound = this.handleKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDownBound);
  }

  public init(width: number, height: number): void {
    const themeKeys: DodgeballThemeId[] = ['gym', 'cyber', 'caldera'];
    this.currentThemeId = themeKeys[Math.floor(Math.random() * themeKeys.length)];
    this.reset(width, height);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 't' || e.key === 'T') {
      this.cycleTheme();
    } else if (e.key === '1') {
      this.setTheme('gym');
    } else if (e.key === '2') {
      this.setTheme('cyber');
    } else if (e.key === '3') {
      this.setTheme('caldera');
    }
  }

  public cycleTheme(): void {
    const list: DodgeballThemeId[] = ['gym', 'cyber', 'caldera'];
    const curIdx = list.indexOf(this.currentThemeId);
    this.setTheme(list[(curIdx + 1) % list.length]);
  }

  public setTheme(id: DodgeballThemeId): void {
    if (this.currentThemeId !== id) {
      this.currentThemeId = id;
      this.audio.playTap();
      this.particles.emit(100, 300, 15, THEMES[id].accentColor);
    }
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.onKeyDownBound);
    if (
      typeof window !== 'undefined' &&
      (window as unknown as { __DODGEBALL_DEBUG__?: unknown }).__DODGEBALL_DEBUG__
    ) {
      delete (window as unknown as { __DODGEBALL_DEBUG__?: unknown }).__DODGEBALL_DEBUG__;
    }
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 55.0;
    this.isFinished = false;
    this.animTimer = 0;
    this.suddenDeathTriggered = false;
    this.playersState.clear();
    this.botReactionTimers.clear();
    this.botMemories.clear();
    this.balls = [];
    this.teamWins = { LEFT: 0, RIGHT: 0 };
    this.currentSet = 1;
    this.roundResetTimer = 0;

    this.courtBounds = {
      minX: width * 0.08,
      maxX: width * 0.92,
      minY: 76,
      maxY: height - 52
    };
    this.centerLineX = width * 0.5;

    // Spawn initial players
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const team = idx % 2 === 0 ? 'LEFT' : 'RIGHT';
      const startX =
        team === 'LEFT' ? this.courtBounds.minX + 90 : this.courtBounds.maxX - 90;
      const startY = idx < 2 ? height * 0.36 : height * 0.64;

      this.playersState.set(p.id, {
        id: p.id,
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        radius: 18,
        angle: team === 'LEFT' ? 0 : Math.PI,
        isAlive: true,
        score: 0,
        roundWins: 0,
        hits: 0,
        catches: 0,
        throwCooldown: 0,
        catchWindow: 0,
        invulnerableTimer: 0,
        hasBall: false,
        heldBallId: null,
        ballHoldTimer: 0,
        team,
        dodgeAnimTimer: 0,
        mood: 'idle',
        moodTimer: 0
      });

      this.botReactionTimers.set(p.id, 0.05 + Math.random() * 0.1);
      this.botMemories.set(p.id, {
        state: 'RUSH_BALL',
        targetBallId: null,
        windUpTimer: 0,
        targetAimAngle: team === 'LEFT' ? 0 : Math.PI,
        dodgeTimer: 0,
        dodgeVelX: 0,
        dodgeVelY: 0,
        patrolYDir: Math.random() < 0.5 ? 1 : -1,
        patrolTimer: 0
      });
    });

    this.spawnBalls(width, height);
    this.exposeDebug(width, height);
  }

  private spawnBalls(_width: number, height: number): void {
    this.balls = [];
    const ballYPositions = [height * 0.30, height * 0.51, height * 0.72];
    ballYPositions.forEach((by, idx) => {
      this.balls.push({
        id: idx,
        x: this.centerLineX,
        y: by,
        vx: 0,
        vy: 0,
        radius: 12,
        holderId: null,
        state: 'idle',
        throwerId: null,
        trail: [],
        bounces: 0
      });
    });
  }

  private resetRoundPositions(width: number, height: number): void {
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      if (!ps) return;
      const team = ps.team;
      const startX =
        team === 'LEFT' ? this.courtBounds.minX + 90 : this.courtBounds.maxX - 90;
      const startY = idx < 2 ? height * 0.36 : height * 0.64;

      ps.x = startX;
      ps.y = startY;
      ps.vx = 0;
      ps.vy = 0;
      ps.angle = team === 'LEFT' ? 0 : Math.PI;
      ps.isAlive = true;
      ps.hasBall = false;
      ps.heldBallId = null;
      ps.ballHoldTimer = 0;
      ps.throwCooldown = 0.5;
      ps.catchWindow = 0;
      ps.invulnerableTimer = 1.0;
      ps.dodgeAnimTimer = 0;
      ps.mood = 'idle';
      ps.moodTimer = 0;

      const mem = this.botMemories.get(p.id);
      if (mem) {
        mem.state = 'RUSH_BALL';
        mem.targetBallId = null;
        mem.windUpTimer = 0;
        mem.dodgeTimer = 0;
      }
    });

    this.spawnBalls(width, height);
  }

  private exposeDebug(width: number, height: number): void {
    if (typeof window !== 'undefined') {
      const game = this;
      (window as unknown as { __DODGEBALL_DEBUG__?: unknown }).__DODGEBALL_DEBUG__ = {
        get players() {
          return Array.from(game.playersState.values());
        },
        get balls() {
          return game.balls;
        },
        get teamWins() {
          return game.teamWins;
        },
        get botMemories() {
          return Array.from(game.botMemories.entries());
        },
        triggerThrow: (playerId: PlayerId, angle?: number) => {
          const ps = game.playersState.get(playerId);
          if (ps && ps.hasBall) game.performThrow(ps, angle);
        },
        triggerCatch: (playerId: PlayerId) => {
          const ps = game.playersState.get(playerId);
          if (ps) game.performCatch(ps);
        },
        giveBallToPlayer: (playerId: PlayerId) => {
          const ps = game.playersState.get(playerId);
          const idleBall = game.balls.find((b) => b.state === 'idle');
          if (ps && idleBall) {
            ps.hasBall = true;
            ps.heldBallId = idleBall.id;
            idleBall.state = 'held';
            idleBall.holderId = ps.id;
          }
        },
        eliminatePlayer: (playerId: PlayerId) => {
          const ps = game.playersState.get(playerId);
          if (ps) {
            ps.isAlive = false;
            game.checkSetOver(width, height);
          }
        }
      };
    }
  }

  private isUnderdog(playerId: PlayerId): boolean {
    const ps = this.playersState.get(playerId);
    if (!ps) return false;
    const enemyTeam = ps.team === 'LEFT' ? 'RIGHT' : 'LEFT';
    const myWins = this.teamWins[ps.team];
    const enemyWins = this.teamWins[enemyTeam];
    return enemyWins > myWins;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.animTimer += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    if (this.roundTimer <= 15.0 && !this.suddenDeathTriggered) {
      this.suddenDeathTriggered = true;
      this.audio.playWhoosh();
    }

    // Round reset intermission countdown
    if (this.roundResetTimer > 0) {
      this.roundResetTimer -= dt;
      if (this.roundResetTimer <= 0) {
        this.resetRoundPositions(width, height);
      }
      return;
    }

    // 1. Update bot decisions
    this.updateBots(dt, width, height);

    // 2. Update players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps || !ps.isAlive) continue;

      if (ps.moodTimer > 0) {
        ps.moodTimer -= dt;
        if (ps.moodTimer <= 0) ps.mood = 'idle';
      }

      if (ps.throwCooldown > 0) ps.throwCooldown -= dt;
      if (ps.catchWindow > 0) ps.catchWindow -= dt;
      if (ps.invulnerableTimer > 0) ps.invulnerableTimer -= dt;
      if (ps.dodgeAnimTimer > 0) ps.dodgeAnimTimer -= dt;

      const isBot = p.type.startsWith('bot_');

      if (!isBot) {
        const steer = this.input.getSteer(p.id);
        const throttle = this.input.getThrottle(p.id);
        const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

        if (steer !== 0 || throttle !== 0) {
          ps.angle = Math.atan2(-throttle, steer);
        }

        const underdog = this.isUnderdog(p.id);
        const speed = underdog ? 300 : 250;
        ps.vx = steer * speed;
        ps.vy = -throttle * speed;

        if (justAction) {
          if (ps.hasBall) {
            this.performThrow(ps);
          } else {
            this.performCatch(ps);
          }
        }
      }

      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Restrict movement to team's court half
      const minX =
        ps.team === 'LEFT'
          ? this.courtBounds.minX + ps.radius
          : this.centerLineX + ps.radius + 6;
      const maxX =
        ps.team === 'LEFT'
          ? this.centerLineX - ps.radius - 6
          : this.courtBounds.maxX - ps.radius;
      ps.x = Math.max(minX, Math.min(maxX, ps.x));
      ps.y = Math.max(
        this.courtBounds.minY + ps.radius,
        Math.min(this.courtBounds.maxY - ps.radius, ps.y)
      );

      // Ball pickup check
      if (!ps.hasBall) {
        ps.ballHoldTimer = 0;
        for (const ball of this.balls) {
          if (ball.state === 'idle') {
            const dist = Math.hypot(ball.x - ps.x, ball.y - ps.y);
            if (dist < ps.radius + ball.radius + 8) {
              ps.hasBall = true;
              ps.heldBallId = ball.id;
              ps.ballHoldTimer = 0;
              ps.mood = 'focused';
              ball.state = 'held';
              ball.holderId = ps.id;
              this.audio.playTap();
              this.particles.emit(ball.x, ball.y, 8, '#3B82F6');
              break;
            }
          }
        }
      }

      // 5-second Shot Clock: auto-throw if holding ball too long
      if (ps.hasBall) {
        ps.ballHoldTimer += dt;
        if (ps.ballHoldTimer >= 5.0) {
          this.performThrow(ps);
        }
      }

      // Keep held ball tethered
      if (ps.hasBall && ps.heldBallId !== null) {
        const ball = this.balls.find((b) => b.id === ps.heldBallId);
        if (ball) {
          ball.x = ps.x + Math.cos(ps.angle) * (ps.radius + 8);
          ball.y = ps.y + Math.sin(ps.angle) * (ps.radius + 8);
          ball.vx = 0;
          ball.vy = 0;
        }
      }
    }

    // 3. Update Dodgeball Physics & Collisions
    for (const ball of this.balls) {
      if (ball.state === 'held') continue;

      if (ball.state === 'thrown' || ball.state === 'idle') {
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        const frictionRate = ball.state === 'thrown' ? 0.988 : 0.965;
        ball.vx *= Math.pow(frictionRate, dt * 60);
        ball.vy *= Math.pow(frictionRate, dt * 60);

        const currentSpeed = Math.hypot(ball.vx, ball.vy);
        if (ball.state === 'thrown' && currentSpeed < 90) {
          ball.state = 'idle';
          ball.throwerId = null;
        }

        if (ball.state === 'thrown' && currentSpeed > 180) {
          ball.trail.push({ x: ball.x, y: ball.y });
          if (ball.trail.length > 9) ball.trail.shift();
        } else {
          ball.trail = [];
        }

        // Elastic gym wall bounces
        let bounced = false;
        if (ball.x - ball.radius <= this.courtBounds.minX) {
          ball.x = this.courtBounds.minX + ball.radius;
          ball.vx = -ball.vx * 0.86;
          bounced = true;
        } else if (ball.x + ball.radius >= this.courtBounds.maxX) {
          ball.x = this.courtBounds.maxX - ball.radius;
          ball.vx = -ball.vx * 0.86;
          bounced = true;
        }

        if (ball.y - ball.radius <= this.courtBounds.minY) {
          ball.y = this.courtBounds.minY + ball.radius;
          ball.vy = -ball.vy * 0.86;
          bounced = true;
        } else if (ball.y + ball.radius >= this.courtBounds.maxY) {
          ball.y = this.courtBounds.maxY - ball.radius;
          ball.vy = -ball.vy * 0.86;
          bounced = true;
        }

        if (bounced) {
          ball.bounces++;
          this.audio.playBounce();
          this.particles.emit(ball.x, ball.y, 6, '#EF4444');
          if (ball.bounces >= 2) {
            ball.state = 'idle';
            ball.throwerId = null;
          }
        }

        // Collision check against opponents when ball is thrown
        if (ball.state === 'thrown' && ball.throwerId !== null) {
          for (const target of this.playersState.values()) {
            if (
              !target.isAlive ||
              target.id === ball.throwerId ||
              target.invulnerableTimer > 0
            )
              continue;

            const dist = Math.hypot(ball.x - target.x, ball.y - target.y);
            if (dist < target.radius + ball.radius) {
              const angleToBall = Math.atan2(ball.y - target.y, ball.x - target.x);
              let angleDiff = Math.abs(angleToBall - target.angle);
              while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
              angleDiff = Math.abs(angleDiff);

              const throwerId = ball.throwerId;

              if (target.catchWindow > 0 && angleDiff < 1.2) {
                // SUCCESSFUL CATCH!
                target.score += 250;
                target.catches += 1;
                target.hasBall = true;
                target.heldBallId = ball.id;
                target.mood = 'triumph';
                target.moodTimer = 1.0;

                ball.state = 'held';
                ball.holderId = target.id;
                ball.throwerId = null;
                ball.vx = 0;
                ball.vy = 0;
                ball.bounces = 0;

                this.audio.playScore();
                this.particles.emit(target.x, target.y, 16, '#10B981');
                this.particles.showFloatingText(
                  '🧤 CAUGHT! +250',
                  target.x,
                  target.y - 25,
                  '#10B981',
                  22
                );

                if (throwerId !== null) {
                  const thrower = this.playersState.get(throwerId);
                  if (thrower) {
                    thrower.mood = 'shocked';
                    thrower.moodTimer = 1.0;
                    this.particles.showFloatingText(
                      'STUNNED!',
                      thrower.x,
                      thrower.y - 25,
                      '#F59E0B',
                      18
                    );
                  }
                }
                break;
              } else {
                // DIRECT HIT - ELIMINATION!
                this.audio.playBounce();
                target.mood = 'shocked';
                target.moodTimer = 1.5;
                this.particles.emit(target.x, target.y, 20, '#EF4444');
                this.particles.showFloatingText(
                  '💥 OUT!',
                  target.x,
                  target.y - 25,
                  '#EF4444',
                  24
                );

                if (throwerId !== null) {
                  const thrower = this.playersState.get(throwerId);
                  if (thrower) {
                    const multi = this.suddenDeathTriggered ? 2 : 1;
                    thrower.score += 200 * multi;
                    thrower.hits += 1;
                    thrower.mood = 'triumph';
                    thrower.moodTimer = 1.0;
                  }
                }

                target.isAlive = false;
                if (target.hasBall && target.heldBallId !== null) {
                  const held = this.balls.find((b) => b.id === target.heldBallId);
                  if (held) {
                    held.state = 'idle';
                    held.holderId = null;
                    held.vx = (Math.random() - 0.5) * 140;
                    held.vy = (Math.random() - 0.5) * 140;
                  }
                }

                ball.state = 'idle';
                ball.throwerId = null;
                ball.vx *= 0.3;
                ball.vy *= 0.3;

                this.checkSetOver(width, height);
                break;
              }
            }
          }
        }
      }
    }

    // 4. Stalling Prevention: roll balls across if one side runs out
    const leftBalls = this.balls.filter(
      (b) => b.state === 'idle' && b.x < this.centerLineX
    );
    const rightBalls = this.balls.filter(
      (b) => b.state === 'idle' && b.x > this.centerLineX
    );
    const leftHeld = Array.from(this.playersState.values()).filter(
      (p) => p.isAlive && p.team === 'LEFT' && p.hasBall
    ).length;
    const rightHeld = Array.from(this.playersState.values()).filter(
      (p) => p.isAlive && p.team === 'RIGHT' && p.hasBall
    ).length;

    const leftTotal = leftBalls.length + leftHeld;
    const rightTotal = rightBalls.length + rightHeld;

    if (leftTotal === 0 && rightBalls.length > 1) {
      this.ballRollTimer += dt;
      if (this.ballRollTimer >= 3.0) {
        this.ballRollTimer = 0;
        const ballToRoll = rightBalls[0];
        ballToRoll.vx = -240;
        this.audio.playBounce();
        this.particles.emit(ballToRoll.x, ballToRoll.y, 8, '#38BDF8');
      }
    } else if (rightTotal === 0 && leftBalls.length > 1) {
      this.ballRollTimer += dt;
      if (this.ballRollTimer >= 3.0) {
        this.ballRollTimer = 0;
        const ballToRoll = leftBalls[0];
        ballToRoll.vx = 240;
        this.audio.playBounce();
        this.particles.emit(ballToRoll.x, ballToRoll.y, 8, '#38BDF8');
      }
    } else {
      this.ballRollTimer = 0;
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public performThrow(ps: DodgePlayer, throwAngle?: number): void {
    if (!ps.hasBall || ps.throwCooldown > 0) return;

    const ball = this.balls.find((b) => b.id === ps.heldBallId);
    if (!ball) return;

    const angle = throwAngle !== undefined ? throwAngle : ps.angle;
    ps.angle = angle;
    ps.hasBall = false;
    ps.heldBallId = null;
    ps.throwCooldown = 0.45;
    ps.ballHoldTimer = 0;
    ps.mood = 'focused';

    ball.state = 'thrown';
    ball.holderId = null;
    ball.throwerId = ps.id;
    ball.bounces = 0;
    ball.x = ps.x + Math.cos(angle) * (ps.radius + ball.radius + 4);
    ball.y = ps.y + Math.sin(angle) * (ps.radius + ball.radius + 4);

    const speedBonus = this.suddenDeathTriggered ? 800 : 650;
    ball.vx = Math.cos(angle) * speedBonus;
    ball.vy = Math.sin(angle) * speedBonus;

    this.audio.playWhoosh();
    this.particles.emit(ball.x, ball.y, 10, '#EF4444');
  }

  public performCatch(ps: DodgePlayer): void {
    if (ps.hasBall || ps.catchWindow > 0) return;
    const underdog = this.isUnderdog(ps.id);
    ps.catchWindow = underdog ? 0.48 : 0.32;
    this.audio.playTap();
    this.particles.emit(
      ps.x + Math.cos(ps.angle) * 15,
      ps.y + Math.sin(ps.angle) * 15,
      8,
      '#10B981'
    );
  }

  private checkSetOver(width: number, height: number): void {
    const leftAlive = Array.from(this.playersState.values()).filter(
      (p) => p.isAlive && p.team === 'LEFT'
    ).length;
    const rightAlive = Array.from(this.playersState.values()).filter(
      (p) => p.isAlive && p.team === 'RIGHT'
    ).length;

    if (leftAlive === 0 || rightAlive === 0) {
      if (leftAlive > 0) {
        this.teamWins.LEFT++;
        this.particles.showFloatingText(
          `🏆 TEAM RED WINS SET ${this.currentSet}!`,
          width / 2,
          70,
          '#EF4444',
          24
        );
        for (const p of this.playersState.values()) {
          if (p.team === 'LEFT') {
            p.roundWins++;
            p.score += 400;
            p.mood = 'triumph';
            p.moodTimer = 1.5;
          }
        }
      } else if (rightAlive > 0) {
        this.teamWins.RIGHT++;
        this.particles.showFloatingText(
          `🏆 TEAM BLUE WINS SET ${this.currentSet}!`,
          width / 2,
          70,
          '#3B82F6',
          24
        );
        for (const p of this.playersState.values()) {
          if (p.team === 'RIGHT') {
            p.roundWins++;
            p.score += 400;
            p.mood = 'triumph';
            p.moodTimer = 1.5;
          }
        }
      }

      this.audio.playFanfare();

      if (
        this.teamWins.LEFT >= this.targetWins ||
        this.teamWins.RIGHT >= this.targetWins
      ) {
        this.isFinished = true;
      } else {
        this.currentSet++;
        this.roundResetTimer = 2.4;
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const bot = this.playersState.get(botId);
    if (!bot || !bot.isAlive) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;

    let mem = this.botMemories.get(botId);
    if (!mem) {
      mem = {
        state: 'RUSH_BALL',
        targetBallId: null,
        windUpTimer: 0,
        targetAimAngle: bot.team === 'LEFT' ? 0 : Math.PI,
        dodgeTimer: 0,
        dodgeVelX: 0,
        dodgeVelY: 0,
        patrolYDir: 1,
        patrolTimer: 0
      };
      this.botMemories.set(botId, mem);
    }

    const botSpeed =
      difficulty === 'bot_easy' ? 190 : difficulty === 'bot_normal' ? 240 : 270;

    // Incoming ball avoidance check
    let incomingThreat: Dodgeball | null = null;
    let minThreatDist = 9999;
    for (const b of this.balls) {
      if (b.state === 'thrown' && b.throwerId !== null && b.throwerId !== bot.id) {
        const d = Math.hypot(b.x - bot.x, b.y - bot.y);
        const headingToMe = (b.vx > 0 && bot.x > b.x) || (b.vx < 0 && bot.x < b.x);
        if (headingToMe && d < 220 && d < minThreatDist) {
          minThreatDist = d;
          incomingThreat = b;
        }
      }
    }

    if (incomingThreat && timer <= 0) {
      const catchChance =
        difficulty === 'bot_easy' ? 0.15 : difficulty === 'bot_normal' ? 0.45 : 0.8;
      if (!bot.hasBall && Math.random() < catchChance && minThreatDist < 120) {
        bot.angle = Math.atan2(incomingThreat.y - bot.y, incomingThreat.x - bot.x);
        this.performCatch(bot);
      } else {
        mem.state = 'DODGE';
        mem.dodgeTimer = 0.35;
        const dodgeDirY = incomingThreat.y > bot.y ? -1 : 1;
        mem.dodgeVelY = dodgeDirY * botSpeed * 1.1;
        mem.dodgeVelX =
          bot.team === 'LEFT' ? -botSpeed * 0.5 : botSpeed * 0.5;
      }
      this.botReactionTimers.set(
        botId,
        difficulty === 'bot_easy' ? 0.35 : difficulty === 'bot_normal' ? 0.2 : 0.08
      );
      return;
    }

    if (mem.state === 'DODGE') {
      mem.dodgeTimer -= dt;
      bot.vx = mem.dodgeVelX;
      bot.vy = mem.dodgeVelY;
      if (mem.dodgeTimer <= 0) {
        mem.state = bot.hasBall ? 'ATTACK' : 'RUSH_BALL';
      }
      return;
    }

    if (bot.hasBall) {
      mem.state = 'ATTACK';
      const enemies = Array.from(this.playersState.values()).filter(
        (p) => p.isAlive && p.team !== bot.team
      );
      if (enemies.length === 0) return;

      const target = enemies[Math.floor(Math.random() * enemies.length)];
      const targetAngle = Math.atan2(target.y - bot.y, target.x - bot.x);
      bot.angle = targetAngle;

      const idealAttackX =
        bot.team === 'LEFT' ? this.centerLineX - 45 : this.centerLineX + 45;
      const dx = idealAttackX - bot.x;
      bot.vx = Math.sign(dx) * Math.min(botSpeed, Math.abs(dx) * 4);
      bot.vy = Math.sin(this.animTimer * 4) * botSpeed * 0.4;

      mem.windUpTimer += dt;
      const throwThreshold =
        difficulty === 'bot_easy' ? 0.8 : difficulty === 'bot_normal' ? 0.4 : 0.2;
      if (mem.windUpTimer >= throwThreshold) {
        mem.windUpTimer = 0;
        this.performThrow(bot, targetAngle);
      }
      return;
    }

    // Unarmed: Rush available ball or patrol
    const availableBalls = this.balls.filter(
      (b) =>
        b.state === 'idle' &&
        ((bot.team === 'LEFT' && b.x <= this.centerLineX + 15) ||
          (bot.team === 'RIGHT' && b.x >= this.centerLineX - 15))
    );

    if (availableBalls.length > 0) {
      availableBalls.sort(
        (a, b) =>
          Math.hypot(a.x - bot.x, a.y - bot.y) -
          Math.hypot(b.x - bot.x, b.y - bot.y)
      );
      const targetBall = availableBalls[0];
      const angle = Math.atan2(targetBall.y - bot.y, targetBall.x - bot.x);
      bot.angle = angle;
      bot.vx = Math.cos(angle) * botSpeed;
      bot.vy = Math.sin(angle) * botSpeed;
    } else {
      // Patrol defensive line
      const patrolBaseX =
        bot.team === 'LEFT'
          ? this.courtBounds.minX + (this.centerLineX - this.courtBounds.minX) * 0.45
          : this.centerLineX + (this.courtBounds.maxX - this.centerLineX) * 0.55;

      mem.patrolTimer += dt;
      if (bot.y < this.courtBounds.minY + 50) {
        mem.patrolYDir = 1;
      } else if (bot.y > this.courtBounds.maxY - 50) {
        mem.patrolYDir = -1;
      } else if (mem.patrolTimer > 1.2) {
        mem.patrolTimer = 0;
        if (Math.random() < 0.4) mem.patrolYDir = mem.patrolYDir === 1 ? -1 : 1;
      }

      const diffX = patrolBaseX - bot.x;
      bot.vx = Math.sign(diffX) * Math.min(botSpeed * 0.7, Math.abs(diffX) * 5);
      bot.vy = mem.patrolYDir * botSpeed * 0.75;
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const ps = this.playersState.get(p.id);
      const pts = ps
        ? ps.score + ps.roundWins * 300 + (ps.isAlive ? 150 : 0)
        : 0;
      return {
        playerId: p.id,
        score: pts,
        hits: ps?.hits || 0,
        catches: ps?.catches || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId =
      scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topHits = scores[0]?.hits || 0;
    const mvpHighlight =
      winnerId !== null
        ? `Player ${winnerId + 1} dominated the court with ${topHits} direct eliminations across ${THEMES[this.currentThemeId].name}!`
        : 'Draw! Both teams eliminated in crossfire!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeId];

    // 1. Gymnasium Court Floor
    ctx.fillStyle = theme.floorColor;
    ctx.fillRect(0, 0, width, height);

    // Floor planks / grid lines
    ctx.strokeStyle = theme.floorPlankColor;
    ctx.lineWidth = 1;
    for (let y = this.courtBounds.minY; y <= this.courtBounds.maxY; y += 22) {
      ctx.beginPath();
      ctx.moveTo(this.courtBounds.minX, y);
      ctx.lineTo(this.courtBounds.maxX, y);
      ctx.stroke();
    }

    // Court boundary lines
    ctx.strokeStyle = theme.courtLineColor;
    ctx.lineWidth = 3.5;
    ctx.strokeRect(
      this.courtBounds.minX,
      this.courtBounds.minY,
      this.courtBounds.maxX - this.courtBounds.minX,
      this.courtBounds.maxY - this.courtBounds.minY
    );

    // Center division line & circle
    ctx.strokeStyle = theme.centerLineColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(this.centerLineX, this.courtBounds.minY);
    ctx.lineTo(this.centerLineX, this.courtBounds.maxY);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
      this.centerLineX,
      (this.courtBounds.minY + this.courtBounds.maxY) / 2,
      60,
      0,
      Math.PI * 2
    );
    ctx.stroke();

    // 2. Draw Dodgeballs and trails
    for (const b of this.balls) {
      if (b.trail.length > 1) {
        ctx.save();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
        ctx.lineWidth = b.radius * 1.5;
        ctx.beginPath();
        b.trail.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.restore();
      }

      // Ball shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + 4, b.radius, b.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dodgeball
      const ballGrad = ctx.createRadialGradient(
        b.x - 3,
        b.y - 3,
        2,
        b.x,
        b.y,
        b.radius
      );
      ballGrad.addColorStop(0, theme.ballGlowColor);
      ballGrad.addColorStop(0.5, theme.ballBaseColor);
      ballGrad.addColorStop(1, '#991B1B');

      ctx.fillStyle = ballGrad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // Rubber texture seams
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.6, 0, Math.PI);
      ctx.stroke();
    }

    // 3. Draw Players
    for (const p of this.playersState.values()) {
      if (!p.isAlive) continue;

      const cfg = this.players.find((x) => x.id === p.id);
      const color = cfg ? cfg.color : '#FFFFFF';
      const colorDark = cfg ? cfg.colorDark : '#333333';

      ctx.save();
      // Drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 6, p.radius * 1.1, p.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Underdog aura
      if (this.isUnderdog(p.id)) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Catch shield window halo
      if (p.catchWindow > 0) {
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 8, p.angle - 1.2, p.angle + 1.2);
        ctx.stroke();
      }

      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      // Player athletic body
      ctx.fillStyle = colorDark;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius - 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Jersey stripe
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-p.radius + 4, -4, (p.radius - 4) * 2, 8);

      // Head visor
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(p.radius * 0.5, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 4. Header Badge (Safe-zone: y: 56, h: 26)
    const headerW = 340;
    const headerH = 26;
    const headerX = width / 2 - headerW / 2;
    const headerY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(headerX, headerY, headerW, headerH, 6);
    else ctx.rect(headerX, headerY, headerW, headerH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${theme.icon} ${theme.name.toUpperCase()} • SET ${this.currentSet} (RED ${this.teamWins.LEFT} - ${this.teamWins.RIGHT} BLUE)`,
      width / 2,
      headerY + 17
    );

    // 5. Corner Player HUD Cards with CharacterRenderer Mascots
    // Offset bottom-left card above Theme Pill (y: height - 128)
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      let cx = 16;
      let cy = 72;
      const cardW = 124;
      const cardH = 66;

      if (p.corner === 'top-right') {
        cx = width - cardW - 16;
        cy = 72;
      } else if (p.corner === 'bottom-left') {
        cx = 16;
        cy = height - cardH - 52;
      } else if (p.corner === 'bottom-right') {
        cx = width - cardW - 16;
        cy = height - cardH - 52;
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = ps.isAlive ? p.color : '#64748B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx, cy, cardW, cardH, 8);
      else ctx.rect(cx, cy, cardW, cardH);
      ctx.fill();
      ctx.stroke();

      // Mascot Avatar
      const isBot = p.type !== 'human';
      drawCharacter(ctx, cx + 22, cy + 33, 16, p.id, isBot, ps.mood, this.animTimer);

      // Name & Score
      ctx.fillStyle = ps.isAlive ? p.color : '#94A3B8';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cx + 46, cy + 22);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`${ps.score} pts`, cx + 46, cy + 40);

      ctx.fillStyle = ps.isAlive ? '#10B981' : '#EF4444';
      ctx.font = 'bold 10px sans-serif';
      const statusText = ps.isAlive
        ? `Hits: ${ps.hits} | Catches: ${ps.catches}`
        : '💀 ELIMINATED';
      ctx.fillText(statusText, cx + 46, cy + 56);
    }

    // 6. Interactive Theme Pill (Bottom-left: x: 20, y: height - 44, w: 170, h: 32)
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${theme.icon} ${theme.name} [T]`, pillX + 10, pillY + 20);

    // 7. Control hints (Bottom-right: x: width - 20, y: height - 28)
    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Move: Run | Tap Action: Throw / Catch', width - 20, height - 24);
  }

  public syncDebug(): Record<string, unknown> {
    return {
      theme: this.currentThemeId,
      currentSet: this.currentSet,
      teamWins: this.teamWins,
      suddenDeath: this.suddenDeathTriggered,
      roundTimer: this.roundTimer,
      players: Array.from(this.playersState.entries()).map(([id, p]) => ({
        id,
        team: p.team,
        isAlive: p.isAlive,
        hits: p.hits,
        score: p.score,
        isUnderdog: this.isUnderdog(id)
      }))
    };
  }
}
