import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

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

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
    this.roundTimer = 35.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.bubbles = [];
    this.goalResetTimer = 0;
    this.lastScorer = null;
    this.lastKickedByPlayerId = null;

    const active = this.getActivePlayers();

    this.pitchBounds = {
      x: 70,
      y: 55,
      w: width - 140,
      h: height - 110
    };
    this.goalH = Math.min(180, this.pitchBounds.h * 0.45);

    // Procedural Soccer Pitch Obstacle Layout
    this.generateRandomMap(width / 2, height / 2);

    this.ball = {
      x: width / 2,
      y: height / 2,
      vx: 0,
      vy: 0,
      radius: 18,
      spin: 0,
      trail: []
    };

    active.forEach((p, idx) => {
      let startX = width / 2 - 140;
      let startY = height / 2;

      if (idx === 1) {
        startX = width / 2 + 140;
        startY = height / 2;
      } else if (idx === 2) {
        startX = width / 2 - 120;
        startY = height / 2 + 90;
      } else if (idx === 3) {
        startX = width / 2 + 120;
        startY = height / 2 - 90;
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
        angle: idx % 2 === 0 ? 0 : Math.PI
      });
    });
  }

  private generateRandomMap(cx: number, cy: number): void {
    const archetypes = ['Regulation Field', 'Pinball Pitch', 'Twin Posts', 'Slalom Pitch'];
    this.currentMapName = archetypes[Math.floor(Math.random() * archetypes.length)];
    this.pitchBumpers = [];

    switch (this.currentMapName) {
      case 'Pinball Pitch':
        // High bouncy center midfield bumper
        this.pitchBumpers = [
          { x: cx, y: cy, radius: 28, color: '#F59E0B' }
        ];
        break;

      case 'Twin Posts':
        // Two midfield deflector posts for wall-pass bank shots
        this.pitchBumpers = [
          { x: cx, y: cy - 95, radius: 20, color: '#38BDF8' },
          { x: cx, y: cy + 95, radius: 20, color: '#38BDF8' }
        ];
        break;

      case 'Slalom Pitch':
        // 3 alternating bouncy posts
        this.pitchBumpers = [
          { x: cx - 110, y: cy - 60, radius: 18, color: '#10B981' },
          { x: cx, y: cy + 60, radius: 22, color: '#EC4899' },
          { x: cx + 110, y: cy - 60, radius: 18, color: '#10B981' }
        ];
        break;

      case 'Regulation Field':
      default:
        // Clear pitch
        break;
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
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

    // 1. Process Player Inputs
    this.bubbles.forEach((b) => {
      const p = this.players[b.id];
      const steer = this.input.getSteer(b.id);
      const throttle = this.input.getThrottle(b.id);
      const action = this.input.justAction(b.id) || (this.input.justPressed(b.id) && steer === 0 && throttle === 0);
      const isPressed = this.input.isActionPressed(b.id) || this.input.isPressed(b.id);

      // Dash Cooldown & Timer
      if (b.dashCooldown > 0) b.dashCooldown -= dt;
      if (b.dashTimer > 0) b.dashTimer -= dt;

      // Handle Dash Burst
      if (action && b.dashCooldown <= 0) {
        b.dashTimer = 0.22;
        b.dashCooldown = 0.85;
        this.audio.playBoost();
        this.particles.spawnSparks(b.x, b.y, p.color, 12);

        // Forward impulse in movement direction or aimed heading
        let dashDirX = steer;
        let dashDirY = -throttle;
        if (Math.hypot(dashDirX, dashDirY) < 0.1) {
          dashDirX = Math.cos(b.angle);
          dashDirY = Math.sin(b.angle);
        }
        const len = Math.hypot(dashDirX, dashDirY) || 1;
        b.vx += (dashDirX / len) * 380;
        b.vy += (dashDirY / len) * 380;
        b.squishX = 1.35;
        b.squishY = 0.7;
      }

      // Movement Acceleration
      const isDashing = b.dashTimer > 0;
      const speed = isDashing ? 320 : 180;

      if (steer !== 0 || throttle !== 0) {
        const moveY = -throttle; // Top-down canvas: up is negative Y
        b.vx += steer * speed * 4.5 * dt;
        b.vy += moveY * speed * 4.5 * dt;
        b.angle = Math.atan2(moveY, steer);
      } else if (isPressed) {
        // Single-button mobile fallback: hold to drive forward in aimed heading
        b.vx += Math.cos(b.angle) * speed * 4.0 * dt;
        b.vy += Math.sin(b.angle) * speed * 4.0 * dt;
      } else {
        // Idle gentle rotational scan
        b.angle += 2.2 * dt;
      }

      // Friction & damping
      b.vx *= 0.91;
      b.vy *= 0.91;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Squish spring relaxation
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

          // Separate bubbles
          b1.x -= nx * overlap * 0.5;
          b1.y -= ny * overlap * 0.5;
          b2.x += nx * overlap * 0.5;
          b2.y += ny * overlap * 0.5;

          // Elastic bounce
          const kx = b1.vx - b2.vx;
          const ky = b1.vy - b2.vy;
          const p = 2 * (nx * kx + ny * ky) / 2;

          b1.vx -= p * nx * 1.25;
          b1.vy -= p * ny * 1.25;
          b2.vx += p * nx * 1.25;
          b2.vy += p * ny * 1.25;

          b1.squishX = 0.75;
          b1.squishY = 1.3;
          b2.squishX = 0.75;
          b2.squishY = 1.3;

          this.audio.playBounce();
          this.particles.spawnSparks((b1.x + b2.x) / 2, (b1.y + b2.y) / 2, '#FFFFFF', 8);
        }
      }
    }

    // 3. Ball Physics & Collision
    const ball = this.ball;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.vx *= 0.982; // Ball rolling friction
    ball.vy *= 0.982;
    ball.spin += ball.vx * 0.03;

    // Trail
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
        const kickPower = isDashing ? 520 : 310;

        ball.vx = nx * kickPower + b.vx * 0.4;
        ball.vy = ny * kickPower + b.vy * 0.4;

        b.vx -= nx * 40;
        b.vy -= ny * 40;

        this.audio.playBounce();
        this.particles.spawnSparks(ball.x, ball.y, '#FFFFFF', 6);
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
        ball.vx = (ball.vx - 2 * dot * nx) * 1.12;
        ball.vy = (ball.vy - 2 * dot * ny) * 1.12;
        this.audio.playBounce();
        this.particles.spawnSparks(ball.x, ball.y, p.color, 8);
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
          b.vx = (b.vx - 2 * dot * nx) * 0.8;
          b.vy = (b.vy - 2 * dot * ny) * 0.8;
        }
      }
    });

    // 4. Goal Detection & Wall Bounces
    const goalTop = height / 2 - this.goalH / 2;
    const goalBottom = height / 2 + this.goalH / 2;

    // Left Goal (Right team scores)
    if (ball.x - ball.radius <= this.pitchBounds.x) {
      if (ball.y >= goalTop && ball.y <= goalBottom) {
        const isRightTeam = this.lastKickedByPlayerId !== null && (this.lastKickedByPlayerId === 1 || this.lastKickedByPlayerId === 3);
        const scorerId = isRightTeam ? this.lastKickedByPlayerId! : 1;
        this.onGoalScored(scorerId, width, height); // Right team scored in Left goal
        return;
      } else {
        ball.x = this.pitchBounds.x + ball.radius;
        ball.vx = -ball.vx * 0.8;
        this.audio.playBounce();
      }
    }

    // Right Goal (Left team scores)
    if (ball.x + ball.radius >= this.pitchBounds.x + this.pitchBounds.w) {
      if (ball.y >= goalTop && ball.y <= goalBottom) {
        const isLeftTeam = this.lastKickedByPlayerId !== null && (this.lastKickedByPlayerId === 0 || this.lastKickedByPlayerId === 2);
        const scorerId = isLeftTeam ? this.lastKickedByPlayerId! : 0;
        this.onGoalScored(scorerId, width, height); // Left team scored in Right goal
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

    // Check match victory (first to 3 goals)
    const leader = this.bubbles.find((b) => b.goals >= 3);
    if (leader) {
      this.roundTimer = 0;
    }
  }

  private onGoalScored(scorerId: PlayerId, _width: number, _height: number) {
    const scorer = this.bubbles.find((b) => b.id === scorerId);
    if (scorer) scorer.goals += 1;
    this.lastScorer = scorerId;
    this.goalResetTimer = 2.2;

    this.audio.playScore();
    this.particles.spawnExplosion(this.ball.x, this.ball.y, scorer ? this.players[scorerId].color : '#FBBF24', 36);
    this.particles.addTrauma(0.5);
  }

  private resetBallAndPlayers(width: number, height: number) {
    this.ball.x = width / 2;
    this.ball.y = height / 2;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.trail = [];
    this.lastKickedByPlayerId = null;

    this.bubbles.forEach((b, idx) => {
      let startX = width / 2 - 140;
      let startY = height / 2;
      if (idx === 1) {
        startX = width / 2 + 140;
        startY = height / 2;
      } else if (idx === 2) {
        startX = width / 2 - 120;
        startY = height / 2 + 90;
      } else if (idx === 3) {
        startX = width / 2 + 120;
        startY = height / 2 - 90;
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

    // Determine opponent's goal position
    // P0/P2 attack right goal; P1/P3 attack left goal
    const attacksRight = b.id % 2 === 0;
    const targetGoalX = attacksRight ? this.pitchBounds.x + this.pitchBounds.w + 10 : this.pitchBounds.x - 10;
    const targetGoalY = this.pitchBounds.y + this.pitchBounds.h / 2;

    // Vector from ball to target goal
    const bgX = targetGoalX - this.ball.x;
    const bgY = targetGoalY - this.ball.y;
    const bgDist = Math.hypot(bgX, bgY) || 1;

    // Ideal strike position: slightly behind the ball relative to goal
    const offsetDist = 48;
    const idealX = this.ball.x - (bgX / bgDist) * offsetDist;
    const idealY = this.ball.y - (bgY / bgDist) * offsetDist;

    // Steer toward ideal position
    const toIdealX = idealX - b.x;
    const toIdealY = idealY - b.y;
    const distToIdeal = Math.hypot(toIdealX, toIdealY);

    let steerX = toIdealX / (distToIdeal || 1);
    let steerY = toIdealY / (distToIdeal || 1);

    if (difficulty === 'bot_easy') {
      steerX += (Math.random() - 0.5) * 0.4;
      steerY += (Math.random() - 0.5) * 0.4;
    }

    // Charge dash when aligned and close to ball
    const distToBall = Math.hypot(this.ball.x - b.x, this.ball.y - b.y);
    const dashRange = difficulty === 'bot_hard' ? 90 : 70;
    let shouldDash = false;
    if (distToBall < dashRange && b.dashCooldown <= 0) {
      const dot = (this.ball.x - b.x) * (targetGoalX - b.x) + (this.ball.y - b.y) * (targetGoalY - b.y);
      if (dot > 0 || difficulty === 'bot_hard') {
        shouldDash = true;
      }
    }

    // Set bot directional and action input
    this.input.setBotInput(b.id, true, steerX, -steerY, shouldDash);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Stadium Grass Pitch
    ctx.fillStyle = '#166534';
    ctx.fillRect(0, 0, width, height);

    // Pitch Field with Turf Stripes
    const pb = this.pitchBounds;
    ctx.fillStyle = '#15803D';
    ctx.fillRect(pb.x, pb.y, pb.w, pb.h);

    const stripeW = pb.w / 10;
    ctx.fillStyle = '#16A34A';
    for (let i = 0; i < 10; i += 2) {
      ctx.fillRect(pb.x + i * stripeW, pb.y, stripeW, pb.h);
    }

    // Pitch Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
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

    // Tactical Midfield Bumpers & Posts
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

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(pb.x + pb.w / 2, pb.y + pb.h / 2, 5, 0, Math.PI * 2);
    ctx.fill();

    // Goal Nets
    const goalTop = height / 2 - this.goalH / 2;
    // Left Goal (P1 Home)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.fillRect(pb.x - this.goalW, goalTop, this.goalW, this.goalH);
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(pb.x - this.goalW, goalTop, this.goalW, this.goalH);

    // Right Goal (P2 Home)
    ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
    ctx.fillRect(pb.x + pb.w, goalTop, this.goalW, this.goalH);
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(pb.x + pb.w, goalTop, this.goalW, this.goalH);

    // 2. Ball Shadow & Trail
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.ellipse(this.ball.x, this.ball.y + 14, this.ball.radius, this.ball.radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    this.ball.trail.forEach((t, idx) => {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + (idx / 8) * 0.25})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.ball.radius * (0.4 + (idx / 8) * 0.5), 0, Math.PI * 2);
      ctx.fill();
    });

    // Soccer Ball
    ctx.save();
    ctx.translate(this.ball.x, this.ball.y);
    ctx.rotate(this.ball.spin);

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, this.ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Soccer pentagon patches
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

    // 3. Render Bubble Players
    this.bubbles.forEach((b) => {
      const p = this.players[b.id];

      // Ground Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + b.radius * 0.7, b.radius * 0.85, b.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();

      // Outer Inflatable Bubble Suit
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(b.squishX, b.squishY);

      // Bubble Translucent Glow
      const bubbleGrad = ctx.createRadialGradient(-6, -6, 2, 0, 0, b.radius);
      bubbleGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      bubbleGrad.addColorStop(0.6, p.color + '44');
      bubbleGrad.addColorStop(1, p.color + '88');

      ctx.fillStyle = bubbleGrad;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // Glowing Rim
      ctx.strokeStyle = p.color;
      ctx.lineWidth = b.dashTimer > 0 ? 3.5 : 2;
      ctx.stroke();

      // Inner Cartoon Player Head
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Cute Eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-3.5, 0, 2.5, 0, Math.PI * 2);
      ctx.arc(3.5, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-3.5, 0, 1.2, 0, Math.PI * 2);
      ctx.arc(3.5, 0, 1.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Dash Cooldown Arc / Ring
      if (b.dashCooldown > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const pct = b.dashCooldown / 0.85;
        ctx.arc(b.x, b.y, b.radius + 4, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
        ctx.stroke();
      }
    });

    // 4. Scoreboard HUD
    const p1 = this.bubbles.find((b) => b.id === 0);
    const p2 = this.bubbles.find((b) => b.id === 1);
    const s1 = p1 ? p1.goals : 0;
    const s2 = p2 ? p2.goals : 0;

    const boardW = 120;
    const boardH = 34;
    const boardX = width / 2 - boardW / 2;
    const boardY = pb.y + 12;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(boardX, boardY, boardW, boardH, 8);
    else ctx.rect(boardX, boardY, boardW, boardH);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '900 16px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#EF4444';
    ctx.fillText(`${s1}`, boardX + 32, boardY + 23);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('-', boardX + boardW / 2, boardY + 23);
    ctx.fillStyle = '#3B82F6';
    ctx.fillText(`${s2}`, boardX + boardW - 32, boardY + 23);

    // Goal Announcement Banner
    if (this.goalResetTimer > 0 && this.lastScorer !== null) {
      const scorer = this.players[this.lastScorer];
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(0, height / 2 - 45, width, 90);

      ctx.fillStyle = scorer ? scorer.color : '#FBBF24';
      ctx.font = '900 44px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚽ GOAL!!!', width / 2, height / 2 + 6);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 15px Montserrat, sans-serif';
      ctx.fillText(`${scorer ? scorer.name : 'Player'} SCORED!`, width / 2, height / 2 + 30);
    }
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.bubbles].sort((a, b) => b.goals - a.goals);
    const winnerId = sorted[0].goals > sorted[1].goals ? sorted[0].id : null;
    const winner = winnerId !== null ? this.players[winnerId] : null;

    return {
      winnerId,
      rankings: sorted.map((b, idx) => ({ playerId: b.id, place: (idx + 1) as 1 | 2 | 3 | 4, score: b.goals })),
      mvpHighlight: winner
        ? `${winner.name} scored ${sorted[0].goals} Goals in Bubble Soccer!`
        : 'Overtime Duel! Match drawn!'
    };
  }
}
