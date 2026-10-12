import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';

interface HockeyPaddle {
  id: PlayerId;
  centerAngle: number; // base angle of their goal slot (e.g. 0, PI/2, PI, 3PI/2)
  paddleAngleOffset: number; // current offset along their defensive arc
  paddleWidthAngle: number; // angular width of paddle
  goalsConceded: number;
}

interface HockeyPuck {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
}

export class MicroHockeyGame extends BaseGame {
  private paddles: Map<PlayerId, HockeyPaddle> = new Map();
  private puck: HockeyPuck = { x: 0, y: 0, vx: 0, vy: 0, radius: 10, speed: 320 };
  private arenaCenterX: number = 0;
  private arenaCenterY: number = 0;
  private arenaRadius: number = 190;
  private goalAngularWidth: number = 0.65; // ~37 degrees per goal
  private iceObstacles: { x: number; y: number; radius: number; color: string }[] = [];
  public currentMapName: string = 'Clean Ice Sheet';

  // Anti-loop physics engine & stagnation watchdog
  public stagnationTimer: number = 0;
  public consecutiveWallBounces: number = 0;
  private botReactionCooldowns: Map<PlayerId, number> = new Map();

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && (window as unknown as { __MICRO_HOCKEY_DEBUG__?: unknown }).__MICRO_HOCKEY_DEBUG__) {
      delete (window as unknown as { __MICRO_HOCKEY_DEBUG__?: unknown }).__MICRO_HOCKEY_DEBUG__;
    }
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 60;
    this.isFinished = false;
    this.paddles.clear();
    this.botReactionCooldowns.clear();
    this.stagnationTimer = 0;
    this.consecutiveWallBounces = 0;

    // Shift arena center slightly downward so top rim and score pills NEVER overlap the top stopwatch/timer
    this.arenaCenterX = width / 2;
    this.arenaCenterY = height / 2 + 22;
    this.arenaRadius = Math.min(width * 0.36, (height - 110) * 0.38);

    // Procedural Ice Rink Obstacle Layout
    this.generateRandomMap(this.arenaCenterX, this.arenaCenterY, this.arenaRadius);

    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      const baseAngle = (idx / count) * Math.PI * 2;
      this.paddles.set(p.id, {
        id: p.id,
        centerAngle: baseAngle,
        paddleAngleOffset: 0,
        paddleWidthAngle: 0.34,
        goalsConceded: 0
      });
    });

    this.resetPuck();

    // Expose debug interface for test suites
    if (typeof window !== 'undefined') {
      (window as unknown as { __MICRO_HOCKEY_DEBUG__?: unknown }).__MICRO_HOCKEY_DEBUG__ = {
        getPuck: () => this.puck,
        getPaddles: () => Array.from(this.paddles.values()),
        getArena: () => ({ x: this.arenaCenterX, y: this.arenaCenterY, radius: this.arenaRadius }),
        getLoopState: () => ({
          stagnation: this.stagnationTimer,
          wallBounces: this.consecutiveWallBounces
        }),
        triggerSimulatedLoop: () => {
          // Send puck bouncing vertically back and forth along diameter line
          this.puck.x = this.arenaCenterX;
          this.puck.y = this.arenaCenterY;
          this.puck.vx = 0;
          this.puck.vy = 360;
          this.consecutiveWallBounces = 4;
          this.stagnationTimer = 4.2;
        }
      };
    }
  }

  private generateRandomMap(cx: number, cy: number, radius: number): void {
    const archetypes = ['Clean Ice Sheet', 'Center Ice Bumper', 'Twin Ice Pegs', 'Satellite Ring'];
    this.currentMapName = archetypes[Math.floor(Math.random() * archetypes.length)];
    this.iceObstacles = [];

    switch (this.currentMapName) {
      case 'Center Ice Bumper':
        this.iceObstacles = [
          { x: cx, y: cy, radius: 24, color: '#F59E0B' }
        ];
        break;

      case 'Twin Ice Pegs':
        this.iceObstacles = [
          { x: cx, y: cy - radius * 0.38, radius: 17, color: '#38BDF8' },
          { x: cx, y: cy + radius * 0.38, radius: 17, color: '#38BDF8' }
        ];
        break;

      case 'Satellite Ring':
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
          this.iceObstacles.push({
            x: cx + Math.cos(a) * (radius * 0.42),
            y: cy + Math.sin(a) * (radius * 0.42),
            radius: 16,
            color: '#EC4899'
          });
        }
        break;

      case 'Clean Ice Sheet':
      default:
        break;
    }
  }

  private resetPuck() {
    this.puck.x = this.arenaCenterX;
    this.puck.y = this.arenaCenterY;
    const angle = Math.random() * Math.PI * 2;
    this.puck.speed = 340;
    this.puck.vx = Math.cos(angle) * this.puck.speed;
    this.puck.vy = Math.sin(angle) * this.puck.speed;
    this.consecutiveWallBounces = 0;
    this.stagnationTimer = 0;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.stagnationTimer += dt;
    this.updateBots(dt, width, height);

    // Update Player Paddles with fast, snappy response
    for (const pad of this.paddles.values()) {
      const steer = this.input.getSteer(pad.id);
      const isPressed = this.input.isPressed(pad.id);

      // Slide paddle along defensive arc
      const maxOffset = this.goalAngularWidth * 0.68;
      if (steer !== 0) {
        pad.paddleAngleOffset += steer * 3.6 * dt;
      } else if (isPressed) {
        // Toggle side deflection oscillation
        pad.paddleAngleOffset += Math.sin(this.roundTimer * 6) * 2.4 * dt;
      }

      pad.paddleAngleOffset = Math.max(-maxOffset, Math.min(maxOffset, pad.paddleAngleOffset));
    }

    // Process Puck Movement & Deflections
    this.puck.x += this.puck.vx * dt;
    this.puck.y += this.puck.vy * dt;

    // Ice Obstacles Ricochet with anti-stick clearance
    for (const obs of this.iceObstacles) {
      const dx = this.puck.x - obs.x;
      const dy = this.puck.y - obs.y;
      const d = Math.hypot(dx, dy);
      if (d < this.puck.radius + obs.radius && d > 0.001) {
        const nx = dx / d;
        const ny = dy / d;
        this.puck.x = obs.x + nx * (this.puck.radius + obs.radius + 1);
        this.puck.y = obs.y + ny * (this.puck.radius + obs.radius + 1);
        const dot = this.puck.vx * nx + this.puck.vy * ny;
        if (dot < 0) {
          this.puck.vx -= 2 * dot * nx;
          this.puck.vy -= 2 * dot * ny;

          // Subtle spin on obstacle bounce to break planar cycles
          const spin = (Math.random() - 0.5) * 0.12;
          const spd = Math.max(300, Math.hypot(this.puck.vx, this.puck.vy));
          const ang = Math.atan2(this.puck.vy, this.puck.vx) + spin;
          this.puck.vx = Math.cos(ang) * spd;
          this.puck.vy = Math.sin(ang) * spd;

          this.audio.playBounce();
          this.particles.spawnSparks(this.puck.x, this.puck.y, obs.color, 7);
        }
      }
    }

    // Gradual controlled puck acceleration over time
    this.puck.speed = Math.min(500, Math.max(300, this.puck.speed + dt * 3));

    const distFromCenter = Math.hypot(this.puck.x - this.arenaCenterX, this.puck.y - this.arenaCenterY);

    if (distFromCenter >= this.arenaRadius - this.puck.radius) {
      const puckAngle = Math.atan2(this.puck.y - this.arenaCenterY, this.puck.x - this.arenaCenterX);
      let hitPaddle = false;
      let inGoalSector = false;
      let goalPlayerId: PlayerId | null = null;

      // Check each player's goal sector
      for (const pad of this.paddles.values()) {
        let diff = puckAngle - pad.centerAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        if (Math.abs(diff) < this.goalAngularWidth) {
          inGoalSector = true;
          // Inside this player's goal zone!
          const padAngle = pad.centerAngle + pad.paddleAngleOffset;
          let padDiff = puckAngle - padAngle;
          while (padDiff > Math.PI) padDiff -= Math.PI * 2;
          while (padDiff < -Math.PI) padDiff += Math.PI * 2;

          if (Math.abs(padDiff) < pad.paddleWidthAngle) {
            // Deflected by paddle!
            hitPaddle = true;
            this.consecutiveWallBounces = 0;
            this.stagnationTimer = 0;
            this.audio.playTap();
            this.particles.spawnSparks(this.puck.x, this.puck.y, this.players[pad.id].color, 8);

            // Rebound puck toward center with angle deflection
            const normX = (this.arenaCenterX - this.puck.x) / distFromCenter;
            const normY = (this.arenaCenterY - this.puck.y) / distFromCenter;
            const tangX = -normY;
            const tangY = normX;

            const deflSpeed = this.puck.speed * 1.05;
            this.puck.vx = normX * deflSpeed + tangX * (padDiff * 240);
            this.puck.vy = normY * deflSpeed + tangY * (padDiff * 240);
            break;
          } else if (distFromCenter >= this.arenaRadius - this.puck.radius * 0.3) {
            // GOAL CONCEDED! Puck crossed the net line!
            goalPlayerId = pad.id;
            break;
          }
        }
      }

      if (goalPlayerId !== null) {
        // Goal scored!
        const victim = this.paddles.get(goalPlayerId);
        if (victim) {
          victim.goalsConceded++;
          this.audio.playExplosion();
          this.particles.addTrauma(0.2);
          this.particles.showFloatingText('GOAL SCORED!', this.puck.x, this.puck.y, '#EF4444', 24);
          this.particles.spawnExplosion(this.puck.x, this.puck.y, '#EF4444', 25);
        }
        this.resetPuck();
      } else if (!hitPaddle && !inGoalSector && distFromCenter >= this.arenaRadius - this.puck.radius) {
        // Perimeter wall rebound between goal openings
        const nx = (this.puck.x - this.arenaCenterX) / distFromCenter;
        const ny = (this.puck.y - this.arenaCenterY) / distFromCenter;
        const dot = this.puck.vx * nx + this.puck.vy * ny;
        if (dot > 0) {
          this.puck.vx -= 2 * dot * nx;
          this.puck.vy -= 2 * dot * ny;

          // Anti-loop spin perturbation: breaks periodic harmonic orbits across the circle
          const spin = (Math.random() - 0.5) * 0.16; // ±4.5 degrees variance
          const curSpeed = Math.hypot(this.puck.vx, this.puck.vy);
          const curAng = Math.atan2(this.puck.vy, this.puck.vx) + spin;
          this.puck.vx = Math.cos(curAng) * curSpeed;
          this.puck.vy = Math.sin(curAng) * curSpeed;

          this.consecutiveWallBounces++;
          this.audio.playBounce();
          this.particles.spawnSparks(this.puck.x, this.puck.y, '#38BDF8', 4);
        }

        // Clamp puck within rink boundary so high speed never clips outside
        const maxR = this.arenaRadius - this.puck.radius;
        this.puck.x = this.arenaCenterX + nx * maxR;
        this.puck.y = this.arenaCenterY + ny * maxR;
      }
    }

    // Active Anti-Loop Watchdog: if puck is endlessly looping between boards without contacting paddles
    if (this.consecutiveWallBounces >= 5 || this.stagnationTimer >= 4.5) {
      const pads = Array.from(this.paddles.values());
      const targetPad = pads[Math.floor(Math.random() * pads.length)];
      const targetAng = targetPad.centerAngle + (Math.random() - 0.5) * this.goalAngularWidth * 0.6;
      const speed = Math.max(340, Math.min(480, Math.hypot(this.puck.vx, this.puck.vy)));
      this.puck.vx = Math.cos(targetAng) * speed;
      this.puck.vy = Math.sin(targetAng) * speed;
      this.consecutiveWallBounces = 0;
      this.stagnationTimer = 0;
      this.particles.showFloatingText('⚡ TURBO CROSS!', this.puck.x, this.puck.y - 14, '#38BDF8', 18);
      this.particles.spawnSparks(this.puck.x, this.puck.y, '#38BDF8', 12);
      this.audio.playBounce();
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const pad = this.paddles.get(botId);
    if (!pad) return;

    // 1. Ray-Circle Predictive Trajectory Interception
    const ox = this.puck.x - this.arenaCenterX;
    const oy = this.puck.y - this.arenaCenterY;
    const R = this.arenaRadius - this.puck.radius;
    const A = this.puck.vx * this.puck.vx + this.puck.vy * this.puck.vy;
    const B = 2 * (ox * this.puck.vx + oy * this.puck.vy);
    const C = ox * ox + oy * oy - R * R;
    const discr = B * B - 4 * A * C;

    let targetOffset = 0; // Default to guarding center of net

    if (discr >= 0 && A > 10) {
      const t = (-B + Math.sqrt(discr)) / (2 * A);
      if (t > 0 && t < 1.8) {
        // Predicted impact location on perimeter
        const hitX = this.puck.x + this.puck.vx * t;
        const hitY = this.puck.y + this.puck.vy * t;
        const hitAngle = Math.atan2(hitY - this.arenaCenterY, hitX - this.arenaCenterX);

        let diff = hitAngle - pad.centerAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const maxOffset = this.goalAngularWidth * 0.7;

        // Is the predicted hit heading toward this bot's goal arc?
        if (Math.abs(diff) <= this.goalAngularWidth * 1.15) {
          // Puck is heading toward net! Move directly to intercept in advance
          targetOffset = Math.max(-maxOffset, Math.min(maxOffset, diff));

          // On hard difficulty: apply aggressive offensive angle to deflect towards opponents
          if (difficulty === 'bot_hard' && t < 0.28) {
            const opponents = Array.from(this.paddles.values()).filter((p) => p.id !== botId);
            opponents.sort((a, b) => a.goalsConceded - b.goalsConceded);
            if (opponents.length > 0) {
              const oppAngle = opponents[0].centerAngle;
              let oppDiff = oppAngle - pad.centerAngle;
              while (oppDiff > Math.PI) oppDiff -= Math.PI * 2;
              while (oppDiff < -Math.PI) oppDiff += Math.PI * 2;
              targetOffset += (oppDiff > 0 ? 0.07 : -0.07);
              targetOffset = Math.max(-maxOffset, Math.min(maxOffset, targetOffset));
            }
          }
        } else {
          // Puck is moving elsewhere: guard net center with gentle tracking
          const currentPuckAngle = Math.atan2(oy, ox);
          let currentDiff = currentPuckAngle - pad.centerAngle;
          while (currentDiff > Math.PI) currentDiff -= Math.PI * 2;
          while (currentDiff < -Math.PI) currentDiff += Math.PI * 2;
          targetOffset = Math.max(-maxOffset * 0.35, Math.min(maxOffset * 0.35, currentDiff * 0.25));
        }
      }
    }

    // Difficulty calibrations
    let tolerance = 0.04;
    let timingError = 0;
    if (difficulty === 'bot_hard') {
      tolerance = 0.025;
    } else if (difficulty === 'bot_normal') {
      tolerance = 0.055;
      timingError = (Math.random() - 0.5) * 0.03;
    } else {
      tolerance = 0.12;
      timingError = (Math.random() - 0.5) * 0.08;
    }

    let steer = 0;
    const finalTarget = targetOffset + timingError;
    if (pad.paddleAngleOffset < finalTarget - tolerance) {
      steer = 1;
    } else if (pad.paddleAngleOffset > finalTarget + tolerance) {
      steer = -1;
    }

    this.input.setBotInput(botId, false, steer, 0, false);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = Array.from(this.paddles.values()).sort((a, b) => a.goalsConceded - b.goalsConceded);
    const winnerId = sorted.length > 0 ? sorted[0].id : null;

    return {
      winnerId,
      rankings: sorted.map((p, idx) => ({
        playerId: p.id,
        score: -p.goalsConceded,
        place: idx + 1
      })),
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} DEFENDED THEIR GOAL LIKE A WALL!` : 'INTENSE AIR HOCKEY CLASH!'
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Stadium Surroundings (Dark Slate Arena)
    ctx.fillStyle = '#080C14';
    ctx.fillRect(0, 0, width, height);

    // 2. Air Hockey Ice Rink Surface
    const iceGrad = ctx.createRadialGradient(
      this.arenaCenterX, this.arenaCenterY, 30,
      this.arenaCenterX, this.arenaCenterY, this.arenaRadius
    );
    iceGrad.addColorStop(0, '#1E293B');
    iceGrad.addColorStop(0.7, '#0F172A');
    iceGrad.addColorStop(1, '#090D16');
    ctx.fillStyle = iceGrad;
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, this.arenaRadius, 0, Math.PI * 2);
    ctx.fill();

    // Air Cushion Micro-vents (perforated table surface)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    const ventStep = 32;
    for (let vx = this.arenaCenterX - this.arenaRadius; vx <= this.arenaCenterX + this.arenaRadius; vx += ventStep) {
      for (let vy = this.arenaCenterY - this.arenaRadius; vy <= this.arenaCenterY + this.arenaRadius; vy += ventStep) {
        if (Math.hypot(vx - this.arenaCenterX, vy - this.arenaCenterY) < this.arenaRadius - 8) {
          ctx.beginPath();
          ctx.arc(vx, vy, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Center Faceoff Circle & Red Centerline
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, 46, 0, Math.PI * 2);
    ctx.moveTo(this.arenaCenterX, this.arenaCenterY - this.arenaRadius);
    ctx.lineTo(this.arenaCenterX, this.arenaCenterY + this.arenaRadius);
    ctx.stroke();

    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Tactical Ice Bumpers & Pegs
    for (const obs of this.iceObstacles) {
      ctx.save();
      ctx.shadowColor = obs.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = obs.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = obs.color;
      ctx.beginPath();
      ctx.arc(obs.x, obs.y, obs.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Outer Chrome Table Rail
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, this.arenaRadius + 6, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Goal Arcs and Defensive Mallets
    for (const pad of this.paddles.values()) {
      const pColor = this.players[pad.id]?.color || '#FFFFFF';

      // Goal Pocket Opening with Mesh Grid
      ctx.save();
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(
        this.arenaCenterX,
        this.arenaCenterY,
        this.arenaRadius + 6,
        pad.centerAngle - this.goalAngularWidth,
        pad.centerAngle + this.goalAngularWidth
      );
      ctx.stroke();
      ctx.restore();

      // Striker / Defensive Paddle (3D Mallet Arc)
      const paddleCenter = pad.centerAngle + pad.paddleAngleOffset;

      // Mallet Base Rim
      ctx.save();
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(
        this.arenaCenterX,
        this.arenaCenterY,
        this.arenaRadius - 12,
        paddleCenter - pad.paddleWidthAngle,
        paddleCenter + pad.paddleWidthAngle
      );
      ctx.stroke();

      // Mallet Top Grip (White highlight strip)
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();

      // Player Score Pill (Positioned outside the arena with zero timer overlap)
      const tagAngle = pad.centerAngle;
      const tagDist = this.arenaRadius + 30;
      let tagX = this.arenaCenterX + Math.cos(tagAngle) * tagDist;
      let tagY = this.arenaCenterY + Math.sin(tagAngle) * tagDist;

      // Ensure no score tag ever overlaps the top-center timer zone (Y < 72 && |X - w/2| < 120)
      if (tagY < 72 && Math.abs(tagX - width / 2) < 120) {
        tagY = 70;
        tagX = width / 2 + (Math.cos(tagAngle) >= 0 ? 100 : -100);
      }

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
      ctx.beginPath();
      ctx.roundRect(tagX - 52, tagY - 13, 104, 26, 13);
      ctx.fill();
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 10.5px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${this.players[pad.id].name.toUpperCase()}: ${pad.goalsConceded} GA`, tagX, tagY);
      ctx.restore();
    }

    // 4. Glowing Neon Puck
    ctx.save();
    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(this.puck.x + 3, this.puck.y + 3, this.puck.radius, 0, Math.PI * 2);
    ctx.fill();

    // Puck neon outer body
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#0284C7';
    ctx.beginPath();
    ctx.arc(this.puck.x, this.puck.y, this.puck.radius, 0, Math.PI * 2);
    ctx.fill();

    // Puck bright center core
    ctx.fillStyle = '#BAE6FD';
    ctx.beginPath();
    ctx.arc(this.puck.x, this.puck.y, this.puck.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore();
  }
}
