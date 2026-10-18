import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export interface SoccerTheme {
  name: string;
  turfDark: string;
  turfLight: string;
  pitchBorder: string;
  lineColor: string;
  ballColor: string;
  themePillColor: string;
}

export const SOCCER_THEMES: SoccerTheme[] = [
  {
    name: 'Premier Stadium ⚽',
    turfDark: '#15803D',
    turfLight: '#16A34A',
    pitchBorder: '#F8FAFC',
    lineColor: 'rgba(255, 255, 255, 0.45)',
    ballColor: '#FFFFFF',
    themePillColor: '#10B981'
  },
  {
    name: 'Cyber Arena ⚡',
    turfDark: '#0F172A',
    turfLight: '#1E293B',
    pitchBorder: '#38BDF8',
    lineColor: 'rgba(56, 189, 248, 0.35)',
    ballColor: '#67E8F9',
    themePillColor: '#38BDF8'
  },
  {
    name: 'Street Asphalts 🛹',
    turfDark: '#292524',
    turfLight: '#383432',
    pitchBorder: '#F59E0B',
    lineColor: 'rgba(245, 158, 11, 0.35)',
    ballColor: '#FDE047',
    themePillColor: '#F59E0B'
  }
];

interface BubblePlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  dashTimer: number;
  dashCooldown: number;
  squishX: number;
  squishY: number;
  goals: number;
  angle: number;
  isUnderdog: boolean;
  hitStunTimer: number;
}

interface SoccerBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  spin: number;
  trail: { x: number; y: number }[];
}

export class BubbleSoccerGame extends BaseGame {
  private bubbles: BubblePlayer[] = [];
  private ball: SoccerBall = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 18,
    spin: 0,
    trail: []
  };

  private goalW = 24;
  private goalH = 150;
  private goalResetTimer = 0;
  private lastScorer: PlayerId | null = null;
  private lastKickedByPlayerId: PlayerId | null = null;
  private pitchBounds = { x: 50, y: 50, w: 700, h: 500 };
  private pitchBumpers: { x: number; y: number; radius: number; color: string }[] = [];
  public currentMapName: string = 'Regulation Field';

  // Polish & Theme Properties
  private currentThemeIndex: number = 0;
  private animTimer: number = 0;
  private suddenDeathAnnounced: boolean = false;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private pointerdownListener: ((e: PointerEvent) => void) | null = null;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
    this.roundTimer = 35.0;
  }

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  public destroy(): void {
    this.removeListeners();
    super.destroy();
    if (typeof window !== 'undefined' && (window as unknown as { __BUBBLE_SOCCER_DEBUG__?: unknown }).__BUBBLE_SOCCER_DEBUG__) {
      delete (window as unknown as { __BUBBLE_SOCCER_DEBUG__?: unknown }).__BUBBLE_SOCCER_DEBUG__;
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isFinished) return;
      if (e.code === 'KeyT') {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % SOCCER_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.pointerdownListener = (e: PointerEvent) => {
      if (this.isFinished) return;
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // Theme pill at x: 20, y: canvas.height - 44, w: 170, h: 32
      if (clickX >= 20 && clickX <= 190 && clickY >= canvas.height - 44 && clickY <= canvas.height - 12) {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % SOCCER_THEMES.length;
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

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.suddenDeathAnnounced = false;
    this.bubbles = [];
    this.goalResetTimer = 0;
    this.lastScorer = null;
    this.lastKickedByPlayerId = null;
    this.animTimer = 0;

    const marginTop = 84;
    const marginBottom = 52;
    this.pitchBounds = {
      x: 70,
      y: marginTop,
      w: width - 140,
      h: height - marginTop - marginBottom
    };
    this.goalH = Math.min(170, this.pitchBounds.h * 0.46);

    this.generateRandomMap(width / 2, this.pitchBounds.y + this.pitchBounds.h / 2);

    this.ball = {
      x: width / 2,
      y: this.pitchBounds.y + this.pitchBounds.h / 2,
      vx: 0,
      vy: 0,
      radius: 18,
      spin: 0,
      trail: []
    };

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      let startX = width / 2 - 140;
      let startY = this.pitchBounds.y + this.pitchBounds.h / 2;

      if (idx === 1) {
        startX = width / 2 + 140;
        startY = this.pitchBounds.y + this.pitchBounds.h / 2;
      } else if (idx === 2) {
        startX = width / 2 - 120;
        startY = this.pitchBounds.y + this.pitchBounds.h / 2 + 85;
      } else if (idx === 3) {
        startX = width / 2 + 120;
        startY = this.pitchBounds.y + this.pitchBounds.h / 2 - 85;
      }

      this.bubbles.push({
        id: p.id,
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        radius: 28,
        dashTimer: 0,
        dashCooldown: 0,
        squishX: 1,
        squishY: 1,
        goals: 0,
        angle: idx % 2 === 0 ? 0 : Math.PI,
        isUnderdog: false,
        hitStunTimer: 0
      });
    });

    // Expose debug hook for testing
    (window as any).__BUBBLE_SOCCER_DEBUG__ = {
      getBubbles: () => this.bubbles.map(b => ({
        id: b.id,
        x: b.x,
        y: b.y,
        vx: b.vx,
        vy: b.vy,
        goals: b.goals,
        isUnderdog: b.isUnderdog
      })),
      getBall: () => ({
        x: this.ball.x,
        y: this.ball.y,
        vx: this.ball.vx,
        vy: this.ball.vy
      }),
      kickBall: (pid: PlayerId, power: number = 400) => {
        const b = this.bubbles.find(x => x.id === pid);
        if (b) {
          const dx = this.ball.x - b.x;
          const dy = this.ball.y - b.y;
          const dist = Math.hypot(dx, dy) || 1;
          this.ball.vx = (dx / (dist || 0.001)) * power;
          this.ball.vy = (dy / (dist || 0.001)) * power;
          this.lastKickedByPlayerId = pid;
        }
      },
      getTheme: () => SOCCER_THEMES[this.currentThemeIndex].name,
      setTheme: (idx: number) => {
        this.currentThemeIndex = Math.max(0, Math.min(idx, SOCCER_THEMES.length - 1));
      }
    };
  }

  private generateRandomMap(cx: number, cy: number): void {
    const archetypes = ['Regulation Field', 'Pinball Pitch', 'Twin Posts', 'Slalom Pitch'];
    this.currentMapName = archetypes[Math.floor(Math.random() * archetypes.length)];
    this.pitchBumpers = [];

    switch (this.currentMapName) {
      case 'Pinball Pitch':
        this.pitchBumpers = [
          { x: cx, y: cy, radius: 28, color: '#F59E0B' }
        ];
        break;

      case 'Twin Posts':
        this.pitchBumpers = [
          { x: cx, y: cy - 90, radius: 20, color: '#38BDF8' },
          { x: cx, y: cy + 90, radius: 20, color: '#38BDF8' }
        ];
        break;

      case 'Slalom Pitch':
        this.pitchBumpers = [
          { x: cx - 110, y: cy - 60, radius: 18, color: '#10B981' },
          { x: cx, y: cy + 60, radius: 22, color: '#EC4899' },
          { x: cx + 110, y: cy - 60, radius: 18, color: '#10B981' }
        ];
        break;

      case 'Regulation Field':
      default:
        break;
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.animTimer += dt;
    const isSuddenDeath = this.roundTimer <= 15;

    if (isSuddenDeath && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.audio.playExplosion();
      this.particles.addTrauma(0.4);
      this.particles.showFloatingText('⚽ SUDDEN DEATH: GOLDEN GOAL! ⚽', width / 2, height / 2 - 40, '#FACC15', 28);
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      return;
    }

    if (this.goalResetTimer > 0) {
      this.goalResetTimer -= dt;
      if (this.goalResetTimer <= 0) {
        this.resetBallAndPlayers(width, height);
      }
      return;
    }

    this.updateBots(dt, width, height);

    // Calculate Leader and Underdog
    let maxGoals = 0;
    let minGoals = Infinity;
    for (const b of this.bubbles) {
      if (b.goals > maxGoals) maxGoals = b.goals;
      if (b.goals < minGoals) minGoals = b.goals;
    }

    for (const b of this.bubbles) {
      const deficit = maxGoals - b.goals;
      b.isUnderdog = deficit >= 1 && maxGoals > 0;
      // Underdog Mega-Bubble size & quick dash
      b.radius = b.isUnderdog ? 35 : 28;
    }

    // 1. Process Player Inputs
    this.bubbles.forEach((b) => {
      const p = this.players[b.id];
      const steer = this.input.getSteer(b.id);
      const throttle = this.input.getThrottle(b.id);
      const action = this.input.justAction(b.id) || (this.input.justPressed(b.id) && steer === 0 && throttle === 0);
      const isPressed = this.input.isActionPressed(b.id) || this.input.isPressed(b.id);

      if (b.dashCooldown > 0) b.dashCooldown -= dt;
      if (b.dashTimer > 0) b.dashTimer -= dt;
      if (b.hitStunTimer > 0) b.hitStunTimer -= dt;

      // Handle Dash Burst
      const maxCooldown = b.isUnderdog ? 0.45 : 0.85;
      if (action && b.dashCooldown <= 0) {
        b.dashTimer = 0.24;
        b.dashCooldown = maxCooldown;
        this.audio.playBoost();
        this.particles.spawnSparks(b.x, b.y, b.isUnderdog ? '#F59E0B' : p.color, 14);

        let dashDirX = steer;
        let dashDirY = -throttle;
        if (Math.hypot(dashDirX, dashDirY) < 0.1) {
          dashDirX = Math.cos(b.angle);
          dashDirY = Math.sin(b.angle);
        }
        const len = Math.hypot(dashDirX, dashDirY) || 1;
        const dashImpulse = b.isUnderdog ? 440 : 380;
        b.vx += (dashDirX / len) * dashImpulse;
        b.vy += (dashDirY / len) * dashImpulse;
        b.squishX = 1.35;
        b.squishY = 0.7;
      }

      // Movement Acceleration
      const isDashing = b.dashTimer > 0;
      const speed = isDashing ? (b.isUnderdog ? 360 : 320) : (b.isUnderdog ? 210 : 180);

      if (steer !== 0 || throttle !== 0) {
        const moveY = -throttle;
        b.vx += steer * speed * 4.8 * dt;
        b.vy += moveY * speed * 4.8 * dt;
        b.angle = Math.atan2(moveY, steer);
      } else if (isPressed) {
        b.vx += Math.cos(b.angle) * speed * 4.2 * dt;
        b.vy += Math.sin(b.angle) * speed * 4.2 * dt;
      } else {
        b.angle += 2.2 * dt;
      }

      b.vx *= 0.91;
      b.vy *= 0.91;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      b.squishX += (1 - b.squishX) * 8 * dt;
      b.squishY += (1 - b.squishY) * 8 * dt;

      // Pitch Boundaries Collision
      const minX = this.pitchBounds.x + b.radius;
      const maxX = this.pitchBounds.x + this.pitchBounds.w - b.radius;
      const minY = this.pitchBounds.y + b.radius;
      const maxY = this.pitchBounds.y + this.pitchBounds.h - b.radius;

      if (b.x < minX) { b.x = minX; b.vx = -b.vx * 0.6; }
      if (b.x > maxX) { b.x = maxX; b.vx = -b.vx * 0.6; }
      if (b.y < minY) { b.y = minY; b.vy = -b.vy * 0.6; }
      if (b.y > maxY) { b.y = maxY; b.vy = -b.vy * 0.6; }
    });

    // 2. Bubble vs Bubble Elastic Collision
    for (let i = 0; i < this.bubbles.length; i++) {
      for (let j = i + 1; j < this.bubbles.length; j++) {
        const b1 = this.bubbles[i];
        const b2 = this.bubbles[j];
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = b1.radius + b2.radius;

        if (dist < minDist && dist > 0.01) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;

          b1.x -= nx * overlap * 0.5;
          b1.y -= ny * overlap * 0.5;
          b2.x += nx * overlap * 0.5;
          b2.y += ny * overlap * 0.5;

          const kx = b1.vx - b2.vx;
          const ky = b1.vy - b2.vy;
          const p = 2 * (nx * kx + ny * ky) / 2;

          const bounceFactor = 1.35;
          b1.vx -= p * nx * bounceFactor;
          b1.vy -= p * ny * bounceFactor;
          b2.vx += p * nx * bounceFactor;
          b2.vy += p * ny * bounceFactor;

          b1.squishX = 0.75;
          b1.squishY = 1.3;
          b2.squishX = 0.75;
          b2.squishY = 1.3;

          b1.hitStunTimer = 0.25;
          b2.hitStunTimer = 0.25;

          this.audio.playBounce();
          this.particles.spawnSparks((b1.x + b2.x) / 2, (b1.y + b2.y) / 2, '#FFFFFF', 10);
        }
      }
    }

    // 3. Ball Physics & Collision
    const ball = this.ball;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.vx *= 0.982;
    ball.vy *= 0.982;
    ball.spin += ball.vx * 0.03;

    if (Math.hypot(ball.vx, ball.vy) > 60) {
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 8) ball.trail.shift();
    } else {
      if (ball.trail.length > 0) ball.trail.shift();
    }

    // Ball vs Bubble Tackle
    this.bubbles.forEach((b) => {
      const dx = ball.x - b.x;
      const dy = ball.y - b.y;
      const dist = Math.hypot(dx, dy);
      const minDist = ball.radius + b.radius;

      if (dist < minDist && dist > 0.01) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;

        ball.x += nx * overlap;
        ball.y += ny * overlap;

        this.lastKickedByPlayerId = b.id;
        const isDashing = b.dashTimer > 0;
        const kickPower = isDashing ? 560 : 330;

        ball.vx = nx * kickPower + b.vx * 0.45;
        ball.vy = ny * kickPower + b.vy * 0.45;

        b.vx -= nx * 45;
        b.vy -= ny * 45;

        this.audio.playBounce();
        this.particles.spawnSparks(ball.x, ball.y, '#FFFFFF', 8);
        if (isDashing) {
          this.particles.addTrauma(0.2);
          this.particles.showFloatingText('POWER BLAST! 🚀', ball.x, ball.y - 20, '#FACC15', 18);
        }
      }
    });

    // Ball vs Pitch Bumpers
    for (const p of this.pitchBumpers) {
      const dx = ball.x - p.x;
      const dy = ball.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < ball.radius + p.radius && d > 0.01) {
        const nx = dx / d;
        const ny = dy / d;
        ball.x = p.x + nx * (ball.radius + p.radius);
        ball.y = p.y + ny * (ball.radius + p.radius);
        const dot = ball.vx * nx + ball.vy * ny;
        ball.vx = (ball.vx - 2 * dot * nx) * 1.15;
        ball.vy = (ball.vy - 2 * dot * ny) * 1.15;
        this.audio.playBounce();
        this.particles.spawnSparks(ball.x, ball.y, p.color, 10);
      }
    }

    // Players vs Pitch Bumpers
    this.bubbles.forEach((b) => {
      for (const p of this.pitchBumpers) {
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < b.radius + p.radius && d > 0.01) {
          const nx = dx / d;
          const ny = dy / d;
          b.x = p.x + nx * (b.radius + p.radius);
          b.y = p.y + ny * (b.radius + p.radius);
          const dot = b.vx * nx + b.vy * ny;
          b.vx = (b.vx - 2 * dot * nx) * 0.85;
          b.vy = (b.vy - 2 * dot * ny) * 0.85;
        }
      }
    });

    // 4. Goal Detection & Wall Bounces
    const goalCenterY = this.pitchBounds.y + this.pitchBounds.h / 2;
    const goalTop = goalCenterY - this.goalH / 2;
    const goalBottom = goalCenterY + this.goalH / 2;

    // Left Goal
    if (ball.x - ball.radius <= this.pitchBounds.x) {
      if (ball.y >= goalTop && ball.y <= goalBottom) {
        const isRightTeam = this.lastKickedByPlayerId !== null && (this.lastKickedByPlayerId === 1 || this.lastKickedByPlayerId === 3);
        const scorerId = isRightTeam ? this.lastKickedByPlayerId! : 1;
        this.onGoalScored(scorerId, width, height);
        return;
      } else {
        ball.x = this.pitchBounds.x + ball.radius;
        ball.vx = -ball.vx * 0.8;
        this.audio.playBounce();
      }
    }

    // Right Goal
    if (ball.x + ball.radius >= this.pitchBounds.x + this.pitchBounds.w) {
      if (ball.y >= goalTop && ball.y <= goalBottom) {
        const isLeftTeam = this.lastKickedByPlayerId !== null && (this.lastKickedByPlayerId === 0 || this.lastKickedByPlayerId === 2);
        const scorerId = isLeftTeam ? this.lastKickedByPlayerId! : 0;
        this.onGoalScored(scorerId, width, height);
        return;
      } else {
        ball.x = this.pitchBounds.x + this.pitchBounds.w - ball.radius;
        ball.vx = -ball.vx * 0.8;
        this.audio.playBounce();
      }
    }

    // Top / Bottom Pitch Walls
    if (ball.y - ball.radius <= this.pitchBounds.y) {
      ball.y = this.pitchBounds.y + ball.radius;
      ball.vy = -ball.vy * 0.8;
      this.audio.playBounce();
    }
    if (ball.y + ball.radius >= this.pitchBounds.y + this.pitchBounds.h) {
      ball.y = this.pitchBounds.y + this.pitchBounds.h - ball.radius;
      ball.vy = -ball.vy * 0.8;
      this.audio.playBounce();
    }

    // Victory threshold (first to 3 goals)
    const leader = this.bubbles.find((b) => b.goals >= 3);
    if (leader) {
      this.roundTimer = 0;
    }
  }

  private onGoalScored(scorerId: PlayerId, _width: number, _height: number) {
    const isSuddenDeath = this.roundTimer <= 15;
    const scorer = this.bubbles.find((b) => b.id === scorerId);
    if (scorer) scorer.goals += (isSuddenDeath ? 2 : 1);
    this.lastScorer = scorerId;
    this.goalResetTimer = 2.2;

    this.audio.playScore();
    this.particles.spawnExplosion(this.ball.x, this.ball.y, scorer ? this.players[scorerId].color : '#FBBF24', 40);
    this.particles.addTrauma(0.5);
  }

  private resetBallAndPlayers(width: number, _height: number) {
    const centerY = this.pitchBounds.y + this.pitchBounds.h / 2;
    this.ball.x = width / 2;
    this.ball.y = centerY;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.trail = [];
    this.lastKickedByPlayerId = null;

    this.bubbles.forEach((b, idx) => {
      let startX = width / 2 - 140;
      let startY = centerY;
      if (idx === 1) {
        startX = width / 2 + 140;
        startY = centerY;
      } else if (idx === 2) {
        startX = width / 2 - 120;
        startY = centerY + 85;
      } else if (idx === 3) {
        startX = width / 2 + 120;
        startY = centerY - 85;
      }
      b.x = startX;
      b.y = startY;
      b.vx = 0;
      b.vy = 0;
      b.dashTimer = 0;
    });
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const b = this.bubbles.find((x) => x.id === botId);
    if (!b) return;

    const attacksRight = b.id % 2 === 0;
    const targetGoalX = attacksRight ? this.pitchBounds.x + this.pitchBounds.w + 10 : this.pitchBounds.x - 10;
    const targetGoalY = this.pitchBounds.y + this.pitchBounds.h / 2;

    const bgX = targetGoalX - this.ball.x;
    const bgY = targetGoalY - this.ball.y;
    const bgDist = Math.hypot(bgX, bgY) || 1;

    const offsetDist = 48;
    const idealX = this.ball.x - (bgX / bgDist) * offsetDist;
    const idealY = this.ball.y - (bgY / bgDist) * offsetDist;

    const toIdealX = idealX - b.x;
    const toIdealY = idealY - b.y;
    const distToIdeal = Math.hypot(toIdealX, toIdealY);

    let steerX = toIdealX / (distToIdeal || 1);
    let steerY = toIdealY / (distToIdeal || 1);

    if (difficulty === 'bot_easy') {
      steerX += (Math.random() - 0.5) * 0.4;
      steerY += (Math.random() - 0.5) * 0.4;
    }

    const distToBall = Math.hypot(this.ball.x - b.x, this.ball.y - b.y);
    const dashRange = difficulty === 'bot_hard' ? 95 : 70;
    let shouldDash = false;
    if (distToBall < dashRange && b.dashCooldown <= 0) {
      const dot = (this.ball.x - b.x) * (targetGoalX - b.x) + (this.ball.y - b.y) * (targetGoalY - b.y);
      if (dot > 0 || difficulty === 'bot_hard') {
        shouldDash = true;
      }
    }

    this.input.setBotInput(b.id, true, steerX, -steerY, shouldDash);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const theme = SOCCER_THEMES[this.currentThemeIndex];
    const isSuddenDeath = this.roundTimer <= 15;

    // 1. Stadium Grass Pitch
    const pb = this.pitchBounds;
    ctx.fillStyle = theme.turfDark;
    ctx.fillRect(0, 0, width, height);

    // Turf Stripes
    ctx.fillStyle = theme.turfLight;
    const stripeW = pb.w / 10;
    for (let i = 0; i < 10; i += 2) {
      ctx.fillRect(pb.x + i * stripeW, pb.y, stripeW, pb.h);
    }

    // Pitch Perimeter Lines
    ctx.strokeStyle = theme.lineColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(pb.x, pb.y, pb.w, pb.h);

    // Center Line & Center Circle
    ctx.beginPath();
    ctx.moveTo(pb.x + pb.w / 2, pb.y);
    ctx.lineTo(pb.x + pb.w / 2, pb.y + pb.h);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(pb.x + pb.w / 2, pb.y + pb.h / 2, 60, 0, Math.PI * 2);
    ctx.stroke();

    // Tactical Midfield Bumpers
    for (const b of this.pitchBumpers) {
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Goal Nets
    const goalCenterY = pb.y + pb.h / 2;
    const goalTop = goalCenterY - this.goalH / 2;
    // Left Goal
    ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.fillRect(pb.x - this.goalW, goalTop, this.goalW, this.goalH);
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(pb.x - this.goalW, goalTop, this.goalW, this.goalH);

    // Right Goal
    ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
    ctx.fillRect(pb.x + pb.w, goalTop, this.goalW, this.goalH);
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(pb.x + pb.w, goalTop, this.goalW, this.goalH);

    // 2. Ball Shadow & Trail
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(this.ball.x, this.ball.y + 14, this.ball.radius, this.ball.radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    this.ball.trail.forEach((t, idx) => {
      ctx.fillStyle = isSuddenDeath
        ? `rgba(250, 204, 21, ${0.15 + (idx / 8) * 0.35})`
        : `rgba(255, 255, 255, ${0.1 + (idx / 8) * 0.25})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.ball.radius * (0.4 + (idx / 8) * 0.5), 0, Math.PI * 2);
      ctx.fill();
    });

    // Soccer Ball
    ctx.save();
    ctx.translate(this.ball.x, this.ball.y);
    ctx.rotate(this.ball.spin);

    if (isSuddenDeath) {
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#FEF08A';
    } else {
      ctx.fillStyle = theme.ballColor;
    }
    ctx.beginPath();
    ctx.arc(0, 0, this.ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 11, Math.sin(a) * 11, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3. Render Bubble Players with Mascot Avatars
    this.bubbles.forEach((b) => {
      const p = this.players[b.id];
      const isBot = p.type.startsWith('bot_');

      // Ground Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + b.radius * 0.7, b.radius * 0.85, b.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();

      // Underdog Golden Aura
      if (b.isUnderdog) {
        ctx.save();
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Outer Inflatable Bubble Suit
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(b.squishX, b.squishY);

      const bubbleGrad = ctx.createRadialGradient(-6, -6, 2, 0, 0, b.radius);
      bubbleGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      bubbleGrad.addColorStop(0.6, p.color + '44');
      bubbleGrad.addColorStop(1, p.color + '88');

      ctx.fillStyle = bubbleGrad;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // Glowing Rim
      ctx.strokeStyle = b.dashTimer > 0 ? '#FACC15' : p.color;
      ctx.lineWidth = b.dashTimer > 0 ? 3.5 : 2;
      ctx.stroke();
      ctx.restore();

      // Determine Mascot Mood
      let mood: CharacterMood = 'focused';
      if (b.hitStunTimer > 0) {
        mood = 'shocked';
      } else if (b.dashTimer > 0 || this.lastScorer === b.id) {
        mood = 'happy';
      } else if (this.isFinished) {
        mood = 'triumph';
      }

      // Render Character Mascot Face inside the Bubble
      drawCharacter(ctx, b.x, b.y, 14, b.id, isBot, mood, this.animTimer);

      // Dash Cooldown Arc
      if (b.dashCooldown > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const maxCd = b.isUnderdog ? 0.45 : 0.85;
        const pct = b.dashCooldown / maxCd;
        ctx.arc(b.x, b.y, b.radius + 4, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Score / Goals Floating Tag
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${b.goals} GOALS`, b.x, b.y - b.radius - 8);
      ctx.restore();
    });

    // 4. Header Instruction Badge (y: 56)
    ctx.save();
    const pillW = 440;
    const pillH = 26;
    const pillX = width / 2 - pillW / 2;
    const pillY = 56;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 13);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#F87171' : '#FFFFFF';
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      isSuddenDeath
        ? '⚽ GOLDEN GOAL SUDDEN DEATH! FIRST SCORE WINS! ⚽'
        : 'STEER BUBBLE SUIT • BUMP RIVALS • TAP/SPACE TO DASH KICK!',
      width / 2,
      pillY + pillH / 2
    );
    ctx.restore();

    // 5. Interactive Bottom-Left Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
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

    // 6. On-screen Controls Pill (Offset to right, never overlapping theme pill)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.font = '600 11px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('WASD / Arrows: Steer | Space / Tap: Turbo Kick', width - 24, height - 28);
    ctx.restore();

    // 7. Goal Announcement Banner
    if (this.goalResetTimer > 0 && this.lastScorer !== null) {
      const scorer = this.players[this.lastScorer];
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(0, height / 2 - 45, width, 90);

      ctx.fillStyle = scorer ? scorer.color : '#FBBF24';
      ctx.font = '900 44px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚽ GOAL!!!', width / 2, height / 2 + 6);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 15px Montserrat, sans-serif';
      ctx.fillText(`${scorer ? scorer.name : 'Player'} SCORED!`, width / 2, height / 2 + 32);
      ctx.restore();
    }

    ctx.restore();
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.bubbles].sort((a, b) => b.goals - a.goals);
    const winnerId = sorted[0].goals > sorted[1].goals ? sorted[0].id : null;
    const winner = winnerId !== null ? this.players[winnerId] : null;

    return {
      winnerId,
      rankings: sorted.map((b, idx) => ({ playerId: b.id, place: (idx + 1) as 1 | 2 | 3 | 4, score: b.goals })),
      mvpHighlight: winner
        ? `${winner.name} SCORED ${sorted[0].goals} GOALS IN BUBBLE SOCCER!`
        : 'OVERTIME DUEL! MATCH DRAWN!'
    };
  }
}
