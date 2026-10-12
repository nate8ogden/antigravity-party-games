import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

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
  public playersState: Map<PlayerId, DodgePlayer> = new Map();
  public balls: Dodgeball[] = [];
  public currentMapName: string = 'High School Gymnasium';

  private courtBounds = { minX: 60, maxX: 740, minY: 70, maxY: 550 };
  private centerLineX: number = 400;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private botMemories: Map<PlayerId, BotMemory> = new Map();
  private ballRollTimer: number = 0;
  private roundResetTimer: number = 0;
  private currentSet: number = 1;
  private targetWins: number = 2; // Best of 3 rounds
  private teamWins: { LEFT: number; RIGHT: number } = { LEFT: 0, RIGHT: 0 };

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 55.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && (window as unknown as { __DODGEBALL_DEBUG__?: unknown }).__DODGEBALL_DEBUG__) {
      delete (window as unknown as { __DODGEBALL_DEBUG__?: unknown }).__DODGEBALL_DEBUG__;
    }
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 55.0;
    this.isFinished = false;
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
      minY: height * 0.12,
      maxY: height * 0.90
    };
    this.centerLineX = width * 0.5;

    // Spawn initial players
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const team = idx % 2 === 0 ? 'LEFT' : 'RIGHT';
      const startX = team === 'LEFT' ? this.courtBounds.minX + 90 : this.courtBounds.maxX - 90;
      const startY = idx < 2 ? height * 0.38 : height * 0.62;

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
        dodgeAnimTimer: 0
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
      const startX = team === 'LEFT' ? this.courtBounds.minX + 90 : this.courtBounds.maxX - 90;
      const startY = idx < 2 ? height * 0.38 : height * 0.62;

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

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Round reset countdown intermission
    if (this.roundResetTimer > 0) {
      this.roundResetTimer -= dt;
      if (this.roundResetTimer <= 0) {
        this.resetRoundPositions(width, height);
      }
      return;
    }

    // 1. Update bot decisions
    this.updateBots(dt, width, height);

    // 2. Update players (movement, inputs, boundaries, ball attachments)
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps || !ps.isAlive) continue;

      if (ps.throwCooldown > 0) ps.throwCooldown -= dt;
      if (ps.catchWindow > 0) ps.catchWindow -= dt;
      if (ps.invulnerableTimer > 0) ps.invulnerableTimer -= dt;
      if (ps.dodgeAnimTimer > 0) ps.dodgeAnimTimer -= dt;

      const isBot = p.type.startsWith('bot_');

      if (!isBot) {
        // Human Inputs
        const steer = this.input.getSteer(p.id);
        const throttle = this.input.getThrottle(p.id);
        const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

        if (steer !== 0 || throttle !== 0) {
          ps.angle = Math.atan2(-throttle, steer);
        }

        const speed = 250;
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

      // Apply velocity to position
      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Restrict movement to team's court half
      const minX = ps.team === 'LEFT' ? this.courtBounds.minX + ps.radius : this.centerLineX + ps.radius + 6;
      const maxX = ps.team === 'LEFT' ? this.centerLineX - ps.radius - 6 : this.courtBounds.maxX - ps.radius;
      ps.x = Math.max(minX, Math.min(maxX, ps.x));
      ps.y = Math.max(this.courtBounds.minY + ps.radius, Math.min(this.courtBounds.maxY - ps.radius, ps.y));

      // Ball pickup check if player doesn't have a ball
      if (!ps.hasBall) {
        ps.ballHoldTimer = 0;
        for (const ball of this.balls) {
          if (ball.state === 'idle') {
            const dist = Math.hypot(ball.x - ps.x, ball.y - ps.y);
            if (dist < ps.radius + ball.radius + 8) {
              ps.hasBall = true;
              ps.heldBallId = ball.id;
              ps.ballHoldTimer = 0;
              ball.state = 'held';
              ball.holderId = ps.id;
              this.audio.playTap();
              this.particles.spawnSparks(ball.x, ball.y, '#3B82F6', 8);
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

      // Keep held ball tethered to player hands
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

        // Smooth hardwood friction
        const frictionRate = ball.state === 'thrown' ? 0.988 : 0.965;
        ball.vx *= Math.pow(frictionRate, dt * 60);
        ball.vy *= Math.pow(frictionRate, dt * 60);

        const currentSpeed = Math.hypot(ball.vx, ball.vy);
        if (ball.state === 'thrown' && currentSpeed < 90) {
          ball.state = 'idle';
          ball.throwerId = null;
        }

        // Particle trail when flying fast
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
          this.particles.spawnSparks(ball.x, ball.y, '#EF4444', 6);
          // After 2 wall bounces, ball safely transitions to idle
          if (ball.bounces >= 2) {
            ball.state = 'idle';
            ball.throwerId = null;
          }
        }

        // Collision check against opponents when ball is thrown
        if (ball.state === 'thrown' && ball.throwerId !== null) {
          for (const target of this.playersState.values()) {
            if (!target.isAlive || target.id === ball.throwerId || target.invulnerableTimer > 0) continue;

            const dist = Math.hypot(ball.x - target.x, ball.y - target.y);
            if (dist < target.radius + ball.radius) {
              // Catch attempt evaluation
              const angleToBall = Math.atan2(ball.y - target.y, ball.x - target.x);
              let angleDiff = Math.abs(angleToBall - target.angle);
              while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
              angleDiff = Math.abs(angleDiff);

              const throwerId = ball.throwerId;

              if (target.catchWindow > 0 && angleDiff < 1.15) {
                // SUCCESSFUL CATCH!
                target.score += 250;
                target.catches += 1;
                target.hasBall = true;
                target.heldBallId = ball.id;
                ball.state = 'held';
                ball.holderId = target.id;
                ball.throwerId = null;
                ball.vx = 0;
                ball.vy = 0;
                ball.bounces = 0;

                this.audio.playScore();
                this.particles.spawnSparks(target.x, target.y, '#10B981', 20);
                this.particles.showFloatingText('🧤 CAUGHT! +250', target.x, target.y - 25, '#10B981', 22);

                if (throwerId !== null) {
                  const thrower = this.playersState.get(throwerId);
                  if (thrower) {
                    this.particles.showFloatingText('STUNNED!', thrower.x, thrower.y - 25, '#F59E0B', 18);
                  }
                }
                break;
              } else {
                // DIRECT HIT - ELIMINATION!
                this.audio.playExplosion();
                this.particles.shake(7);
                this.particles.spawnExplosion(target.x, target.y, '#EF4444', 24);
                this.particles.showFloatingText('💥 OUT!', target.x, target.y - 25, '#EF4444', 24);

                if (throwerId !== null) {
                  const thrower = this.playersState.get(throwerId);
                  if (thrower) {
                    thrower.score += 200;
                    thrower.hits += 1;
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

    // 4. Stalling Prevention: ensure both sides have balls
    const leftBalls = this.balls.filter((b) => b.state === 'idle' && b.x < this.centerLineX);
    const rightBalls = this.balls.filter((b) => b.state === 'idle' && b.x > this.centerLineX);
    const leftHeld = Array.from(this.playersState.values()).filter((p) => p.isAlive && p.team === 'LEFT' && p.hasBall).length;
    const rightHeld = Array.from(this.playersState.values()).filter((p) => p.isAlive && p.team === 'RIGHT' && p.hasBall).length;

    const leftTotal = leftBalls.length + leftHeld;
    const rightTotal = rightBalls.length + rightHeld;

    if (leftTotal === 0 && rightBalls.length > 1) {
      this.ballRollTimer += dt;
      if (this.ballRollTimer >= 3.0) {
        this.ballRollTimer = 0;
        const ballToRoll = rightBalls[0];
        ballToRoll.vx = -240;
        this.audio.playBounce();
        this.particles.spawnSparks(ballToRoll.x, ballToRoll.y, '#38BDF8', 8);
      }
    } else if (rightTotal === 0 && leftBalls.length > 1) {
      this.ballRollTimer += dt;
      if (this.ballRollTimer >= 3.0) {
        this.ballRollTimer = 0;
        const ballToRoll = leftBalls[0];
        ballToRoll.vx = 240;
        this.audio.playBounce();
        this.particles.spawnSparks(ballToRoll.x, ballToRoll.y, '#38BDF8', 8);
      }
    } else {
      this.ballRollTimer = 0;
    }

    // Match clock expiration
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

    ball.state = 'thrown';
    ball.holderId = null;
    ball.throwerId = ps.id;
    ball.bounces = 0;
    ball.x = ps.x + Math.cos(angle) * (ps.radius + ball.radius + 4);
    ball.y = ps.y + Math.sin(angle) * (ps.radius + ball.radius + 4);

    const throwSpeed = 640;
    ball.vx = Math.cos(angle) * throwSpeed;
    ball.vy = Math.sin(angle) * throwSpeed;

    this.audio.playLaser();
    this.particles.spawnSparks(ball.x, ball.y, '#EF4444', 10);
  }

  public performCatch(ps: DodgePlayer): void {
    if (ps.hasBall || ps.catchWindow > 0) return;
    ps.catchWindow = 0.32;
    this.audio.playTap();
    this.particles.spawnSparks(ps.x + Math.cos(ps.angle) * 15, ps.y + Math.sin(ps.angle) * 15, '#10B981', 8);
  }

  private checkSetOver(width: number, height: number): void {
    const leftAlive = Array.from(this.playersState.values()).filter((p) => p.isAlive && p.team === 'LEFT').length;
    const rightAlive = Array.from(this.playersState.values()).filter((p) => p.isAlive && p.team === 'RIGHT').length;

    if (leftAlive === 0 || rightAlive === 0) {
      if (leftAlive > 0) {
        this.teamWins.LEFT++;
        this.particles.showFloatingText(`🏆 TEAM RED WINS SET ${this.currentSet}!`, width / 2, 70, '#EF4444', 24);
        for (const p of this.playersState.values()) {
          if (p.team === 'LEFT') {
            p.roundWins++;
            p.score += 400;
          }
        }
      } else if (rightAlive > 0) {
        this.teamWins.RIGHT++;
        this.particles.showFloatingText(`🏆 TEAM BLUE WINS SET ${this.currentSet}!`, width / 2, 70, '#3B82F6', 24);
        for (const p of this.playersState.values()) {
          if (p.team === 'RIGHT') {
            p.roundWins++;
            p.score += 400;
          }
        }
      }

      this.audio.playFanfare();

      if (this.teamWins.LEFT >= this.targetWins || this.teamWins.RIGHT >= this.targetWins) {
        this.isFinished = true;
      } else {
        this.currentSet++;
        this.roundResetTimer = 2.0; // 2s pause before next set
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

    let mem = this.botMemories.get(botId);
    if (!mem) {
      mem = {
        state: 'DEFEND_PATROL',
        targetBallId: null,
        windUpTimer: 0,
        targetAimAngle: bot.angle,
        dodgeTimer: 0,
        dodgeVelX: 0,
        dodgeVelY: 0,
        patrolYDir: Math.random() < 0.5 ? 1 : -1,
        patrolTimer: 0
      };
      this.botMemories.set(botId, mem);
    }

    // Reaction & calibration tuning
    const botSpeed = difficulty === 'bot_easy' ? 200 : difficulty === 'bot_normal' ? 245 : 270;
    const leadFactor = difficulty === 'bot_easy' ? 0.0 : difficulty === 'bot_normal' ? 0.55 : 0.90;
    const catchChance = difficulty === 'bot_easy' ? 0.18 : difficulty === 'bot_normal' ? 0.52 : 0.85;

    // 1. ACTIVE THREAT DETECTION: Check for incoming thrown enemy balls
    let urgentBall: Dodgeball | null = null;
    let minTimeToImpact = 999;
    let bestDodgeVector = { x: 0, y: 0 };

    for (const ball of this.balls) {
      if (ball.state !== 'thrown' || ball.throwerId === bot.id) continue;
      const bSpeed = Math.hypot(ball.vx, ball.vy);
      if (bSpeed < 80) continue;

      const toBotX = bot.x - ball.x;
      const toBotY = bot.y - ball.y;
      const dot = toBotX * ball.vx + toBotY * ball.vy;

      // Ball is moving towards bot if dot > 0
      if (dot > 0) {
        const timeToClosest = dot / (bSpeed * bSpeed);
        if (timeToClosest < 0.65) {
          const closestX = ball.x + ball.vx * timeToClosest;
          const closestY = ball.y + ball.vy * timeToClosest;
          const missDist = Math.hypot(bot.x - closestX, bot.y - closestY);

          if (missDist < bot.radius + ball.radius + 22) {
            if (timeToClosest < minTimeToImpact) {
              minTimeToImpact = timeToClosest;
              urgentBall = ball;

              // Perpendicular dodge direction away from walls
              const perpX = -ball.vy / bSpeed;
              const perpY = ball.vx / bSpeed;

              // Test which perpendicular direction has more court clearance
              const roomPos = Math.min(bot.y + perpY * 70 - this.courtBounds.minY, this.courtBounds.maxY - (bot.y + perpY * 70));
              const roomNeg = Math.min(bot.y - perpY * 70 - this.courtBounds.minY, this.courtBounds.maxY - (bot.y - perpY * 70));

              const sign = roomPos >= roomNeg ? 1 : -1;
              const backX = bot.team === 'LEFT' ? -0.4 : 0.4;
              bestDodgeVector = {
                x: perpX * sign * 0.7 + backX,
                y: perpY * sign
              };
            }
          }
        }
      }
    }

    // Threat response
    if (urgentBall) {
      const distToBall = Math.hypot(urgentBall.x - bot.x, urgentBall.y - bot.y);

      // Attempt catch if within range & roll passes
      if (distToBall < 130 && minTimeToImpact < 0.24 && bot.catchWindow <= 0 && Math.random() < catchChance) {
        bot.angle = Math.atan2(urgentBall.y - bot.y, urgentBall.x - bot.x);
        this.performCatch(bot);
      } else {
        // Dodge maneuver!
        const dLen = Math.hypot(bestDodgeVector.x, bestDodgeVector.y) || 1;
        bot.vx = (bestDodgeVector.x / dLen) * botSpeed * 1.15;
        bot.vy = (bestDodgeVector.y / dLen) * botSpeed * 1.15;
        bot.angle = Math.atan2(bot.vy, bot.vx);
        mem.dodgeTimer = 0.22;
      }
      return;
    }

    if (mem.dodgeTimer > 0) {
      mem.dodgeTimer -= dt;
      return;
    }

    // 2. OFFENSIVE STRIKE: Bot is holding a dodgeball
    if (bot.hasBall) {
      const enemies = Array.from(this.playersState.values()).filter((p) => p.isAlive && p.team !== bot.team);
      if (enemies.length === 0) return;

      // Select target: prioritize enemies without a ball or closest
      enemies.sort((a, b) => {
        const aScore = (a.hasBall ? 50 : 0) + Math.hypot(a.x - bot.x, a.y - bot.y);
        const bScore = (b.hasBall ? 50 : 0) + Math.hypot(b.x - bot.x, b.y - bot.y);
        return aScore - bScore;
      });
      const target = enemies[0];

      // Attack zone X near the center line (55px from center line)
      const attackLineX = bot.team === 'LEFT' ? this.centerLineX - 60 : this.centerLineX + 60;
      const distToAttackLine = Math.abs(bot.x - attackLineX);

      // Advance toward attack line while tracking target
      if (distToAttackLine > 30 && bot.ballHoldTimer < 1.8) {
        const advanceDirX = Math.sign(attackLineX - bot.x);
        const advanceDirY = Math.sign(target.y - bot.y) * 0.45;

        bot.vx = advanceDirX * botSpeed;
        bot.vy = advanceDirY * botSpeed;
        bot.angle = Math.atan2(target.y - bot.y, target.x - bot.x);
      } else {
        // In attack zone: wind up and lead target!
        mem.windUpTimer += dt;

        // Predictive Aim Calculation
        const dist = Math.hypot(target.x - bot.x, target.y - bot.y);
        const throwSpeed = 640;
        const timeToTarget = dist / throwSpeed;

        let predictedX = target.x + target.vx * timeToTarget * leadFactor;
        let predictedY = target.y + target.vy * timeToTarget * leadFactor;

        if (difficulty === 'bot_easy') {
          predictedY += (Math.random() - 0.5) * 60;
        }

        const aimAngle = Math.atan2(predictedY - bot.y, predictedX - bot.x);
        bot.angle = aimAngle;
        bot.vx *= 0.3;
        bot.vy *= 0.3;

        // Throw after brief windup
        const requiredWindUp = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.22 : 0.35;
        if (mem.windUpTimer >= requiredWindUp || bot.ballHoldTimer >= 2.5) {
          if (bot.throwCooldown <= 0) {
            mem.windUpTimer = 0;
            this.performThrow(bot, aimAngle);
          }
        }
      }
      return;
    }

    // 3. SEEK LOOSE BALL: Find nearest reachable idle ball on bot's half of the court
    const reachableBalls = this.balls.filter((b) => {
      if (b.state !== 'idle') return false;
      if (bot.team === 'LEFT') {
        return b.x <= this.centerLineX + 18;
      } else {
        return b.x >= this.centerLineX - 18;
      }
    });

    if (reachableBalls.length > 0) {
      reachableBalls.sort((a, b) => {
        const da = Math.hypot(a.x - bot.x, a.y - bot.y);
        const db = Math.hypot(b.x - bot.x, b.y - bot.y);
        return da - db;
      });
      const targetBall = reachableBalls[0];

      const toBallX = targetBall.x - bot.x;
      const toBallY = targetBall.y - bot.y;
      const dist = Math.hypot(toBallX, toBallY);

      if (dist > 5) {
        bot.vx = (toBallX / dist) * botSpeed;
        bot.vy = (toBallY / dist) * botSpeed;
        bot.angle = Math.atan2(toBallY, toBallX);
      }
      return;
    }

    // 4. DEFENSIVE PATROL: No ball and no loose balls on bot's side
    // Position at mid-court depth and actively weave up/down so as not to be a sitting duck
    const patrolBaseX =
      bot.team === 'LEFT'
        ? this.courtBounds.minX + (this.centerLineX - this.courtBounds.minX) * 0.45
        : this.centerLineX + (this.courtBounds.maxX - this.centerLineX) * 0.55;

    // Face the primary enemy threat
    const enemies = Array.from(this.playersState.values()).filter((p) => p.isAlive && p.team !== bot.team);
    const enemyWithBall = enemies.find((e) => e.hasBall) || enemies[0];
    if (enemyWithBall) {
      bot.angle = Math.atan2(enemyWithBall.y - bot.y, enemyWithBall.x - bot.x);
    }

    mem.patrolTimer += dt;
    if (bot.y < this.courtBounds.minY + 60) {
      mem.patrolYDir = 1;
    } else if (bot.y > this.courtBounds.maxY - 60) {
      mem.patrolYDir = -1;
    } else if (mem.patrolTimer > 1.2) {
      mem.patrolTimer = 0;
      if (Math.random() < 0.4) mem.patrolYDir = mem.patrolYDir === 1 ? -1 : 1;
    }

    const targetX = patrolBaseX;
    const diffX = targetX - bot.x;
    bot.vx = Math.sign(diffX) * Math.min(botSpeed * 0.7, Math.abs(diffX) * 5);
    bot.vy = mem.patrolYDir * botSpeed * 0.75;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const ps = this.playersState.get(p.id);
      const pts = ps ? ps.score + ps.roundWins * 300 + (ps.isAlive ? 150 : 0) : 0;
      return {
        playerId: p.id,
        score: pts,
        hits: ps?.hits || 0,
        catches: ps?.catches || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topHits = scores[0]?.hits || 0;
    const mvpHighlight =
      winnerId !== null
        ? `Player ${winnerId + 1} dominated the gymnasium with ${topHits} direct eliminations!`
        : 'Draw! Both teams eliminated in crossfire!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Polished hardwood gymnasium floor
    ctx.fillStyle = '#D97706';
    ctx.fillRect(0, 0, width, height);

    // Wood floor planks texture
    ctx.strokeStyle = 'rgba(180, 83, 9, 0.35)';
    ctx.lineWidth = 1;
    for (let y = this.courtBounds.minY; y <= this.courtBounds.maxY; y += 22) {
      ctx.beginPath();
      ctx.moveTo(this.courtBounds.minX, y);
      ctx.lineTo(this.courtBounds.maxX, y);
      ctx.stroke();
    }

    // Gymnasium court boundary lines
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3.5;
    ctx.strokeRect(
      this.courtBounds.minX,
      this.courtBounds.minY,
      this.courtBounds.maxX - this.courtBounds.minX,
      this.courtBounds.maxY - this.courtBounds.minY
    );

    // Center division line with center circle
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(this.centerLineX, this.courtBounds.minY);
    ctx.lineTo(this.centerLineX, this.courtBounds.maxY);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.centerLineX, (this.courtBounds.minY + this.courtBounds.maxY) / 2, 60, 0, Math.PI * 2);
    ctx.stroke();

    // Attack lines (dashed lines 60px from center line)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.centerLineX - 60, this.courtBounds.minY);
    ctx.lineTo(this.centerLineX - 60, this.courtBounds.maxY);
    ctx.moveTo(this.centerLineX + 60, this.courtBounds.minY);
    ctx.lineTo(this.centerLineX + 60, this.courtBounds.maxY);
    ctx.stroke();
    ctx.restore();

    // 2. Draw Dodgeballs and trails
    for (const b of this.balls) {
      // Particle trail
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

      // Red rubber dodgeball with radial sheen
      const ballGrad = ctx.createRadialGradient(b.x - 3, b.y - 3, 2, b.x, b.y, b.radius);
      ballGrad.addColorStop(0, '#FCA5A5');
      ballGrad.addColorStop(0.5, '#EF4444');
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

      // Player Tag Pill
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      const isBot = cfg?.type.startsWith('bot_');
      const tag = isBot ? `BOT ${p.id + 1}` : `P${p.id + 1}`;
      ctx.fillText(tag, p.x, p.y - p.radius - 8);

      // Set score indicator dots
      if (p.roundWins > 0) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = '10px sans-serif';
        ctx.fillText('⭐'.repeat(p.roundWins), p.x, p.y + p.radius + 12);
      }
    }

    // 4. Draw HUD
    this.renderHUD(ctx, width, height);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, _height: number): void {
    ctx.save();
    // Round timer badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 65, 12, 130, 36, 10);
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 17px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`SET ${this.currentSet} • ${Math.ceil(this.roundTimer)}s`, width * 0.5, 30);

    // Score sub-bar
    const active = this.getActivePlayers();
    const itemW = 105;
    const subBarW = active.length * itemW;
    const subBarX = width * 0.5 - subBarW * 0.5;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(subBarX, 54, subBarW, 26, 6);
    ctx.fill();

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      const px = subBarX + idx * itemW + itemW / 2;
      ctx.fillStyle = p.color;
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const status = ps?.isAlive ? `🎯${ps?.hits || 0} ⭐${ps?.roundWins || 0}` : '💀OUT';
      ctx.fillText(`P${p.id + 1}: ${status}`, px, 67);
    });

    ctx.restore();
  }
}
