import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface PinballPaddle {
  id: PlayerId;
  zone: 'BOTTOM' | 'TOP' | 'LEFT' | 'RIGHT';
  x: number;
  y: number;
  width: number;
  height: number;
  flipperActive: boolean;
  flipperAnim: number; // 0 to 1
  shields: number;
  maxShields: number;
  score: number;
  goalsScored: number;
  botReactionTimer: number;
  patrolDir: 1 | -1;
}

interface PinballBall {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  lastTouch: PlayerId | null;
  speed: number;
}

interface PinballBumper {
  x: number;
  y: number;
  radius: number;
  color: string;
  flashTimer: number;
}

export class PinballBattleGame extends BaseGame {
  private playersState: Map<PlayerId, PinballPaddle> = new Map();
  private balls: PinballBall[] = [];
  private bumpers: PinballBumper[] = [];
  private currentMapName: string = 'Galaxy Arcade';
  private ballCounter: number = 0;
  private multiballSpawned: boolean = false;
  private tableBounds = { minX: 30, maxX: 0, minY: 90, maxY: 0 };

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45;
    this.ballCounter = 0;
    this.multiballSpawned = false;

    this.tableBounds = {
      minX: 35,
      maxX: width - 35,
      minY: 92,
      maxY: height - 25
    };

    this.generateProceduralMap(width, height);
    this.initPlayers(width, height);
    this.spawnBall(width / 2, (this.tableBounds.minY + this.tableBounds.maxY) / 2);
  }

  private generateProceduralMap(width: number, height: number): void {
    const maps = [
      'Galaxy Arcade',
      'Cyber Neon City',
      'Vegas Jackpot Casino',
      'Black Hole Singularity'
    ];
    this.currentMapName = maps[Math.floor(Math.random() * maps.length)];

    const centerX = width / 2;
    const centerY = (this.tableBounds.minY + this.tableBounds.maxY) / 2;

    // 3 Center Neon Bumpers in triangular layout
    const bumperColors = ['#EF4444', '#3B82F6', '#F59E0B', '#10B981'];
    this.bumpers = [
      {
        x: centerX - 65,
        y: centerY - 25,
        radius: 20,
        color: bumperColors[0],
        flashTimer: 0
      },
      {
        x: centerX + 65,
        y: centerY - 25,
        radius: 20,
        color: bumperColors[1],
        flashTimer: 0
      },
      {
        x: centerX,
        y: centerY + 65,
        radius: 22,
        color: bumperColors[2],
        flashTimer: 0
      }
    ];
  }

  private initPlayers(width: number, height: number): void {
    this.playersState.clear();
    const active = this.getActivePlayers();
    const count = active.length;
    const centerY = (this.tableBounds.minY + this.tableBounds.maxY) / 2;

    if (count === 2) {
      // P1 Bottom, P2 Top
      const zones: ('BOTTOM' | 'TOP')[] = ['BOTTOM', 'TOP'];
      active.forEach((p, idx) => {
        const zone = zones[idx];
        const py = zone === 'BOTTOM' ? this.tableBounds.maxY - 14 : this.tableBounds.minY + 14;

        this.playersState.set(p.id, {
          id: p.id,
          zone,
          x: width / 2,
          y: py,
          width: 90,
          height: 14,
          flipperActive: false,
          flipperAnim: 0,
          shields: 5,
          maxShields: 5,
          score: 0,
          goalsScored: 0,
          botReactionTimer: 0.12 + idx * 0.08,
          patrolDir: 1
        });
      });
    } else {
      // 3 or 4 Players: 4 Cardinal Zones (BOTTOM, TOP, LEFT, RIGHT)
      const zones: ('BOTTOM' | 'TOP' | 'LEFT' | 'RIGHT')[] = ['BOTTOM', 'TOP', 'LEFT', 'RIGHT'];
      active.forEach((p, idx) => {
        const zone = zones[idx % zones.length];
        let px = width / 2;
        let py = centerY;
        let pw = 80;
        let ph = 14;

        if (zone === 'BOTTOM') {
          py = this.tableBounds.maxY - 14;
        } else if (zone === 'TOP') {
          py = this.tableBounds.minY + 14;
        } else if (zone === 'LEFT') {
          px = this.tableBounds.minX + 14;
          pw = 14;
          ph = 80;
        } else {
          px = this.tableBounds.maxX - 14;
          pw = 14;
          ph = 80;
        }

        this.playersState.set(p.id, {
          id: p.id,
          zone,
          x: px,
          y: py,
          width: pw,
          height: ph,
          flipperActive: false,
          flipperAnim: 0,
          shields: 5,
          maxShields: 5,
          score: 0,
          goalsScored: 0,
          botReactionTimer: 0.12 + idx * 0.08,
          patrolDir: 1
        });
      });
    }
  }

  private spawnBall(x: number, y: number): void {
    if (this.balls.length >= 10) {
      this.balls.shift();
    }
    const angle = (Math.random() - 0.5) * Math.PI * 0.8 + (Math.random() > 0.5 ? 0 : Math.PI);
    const speed = 320;
    this.balls.push({
      id: ++this.ballCounter,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 9,
      lastTouch: null,
      speed
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Multiball drop at 25s remaining
    if (this.roundTimer <= 25 && !this.multiballSpawned) {
      this.multiballSpawned = true;
      const centerY = (this.tableBounds.minY + this.tableBounds.maxY) / 2;
      this.spawnBall(width / 2 - 40, centerY);
      this.spawnBall(width / 2 + 40, centerY);
      this.audio.playFanfare();
      this.particles.shake(0.35);
      this.particles.showFloatingText('MULTI-BALL ACTIVATED!!', width / 2, centerY - 45, '#F59E0B', 26);
    }

    // Update bot inputs via BaseGame
    this.updateBots(dt, width, height);

    // Bumper flash timers
    for (const b of this.bumpers) {
      if (b.flashTimer > 0) b.flashTimer = Math.max(0, b.flashTimer - dt);
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps || ps.shields <= 0) continue;

      // Read Input
      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const flipperDirection =
        (ps.zone === 'BOTTOM' && (throttle > 0.5 || this.input.justUp(p.id))) ||
        (ps.zone === 'TOP' && (throttle < -0.5 || this.input.justDown(p.id))) ||
        (ps.zone === 'LEFT' && steer > 0.5) ||
        (ps.zone === 'RIGHT' && steer < -0.5);

      const flipHeld = this.input.isActionPressed(p.id) || this.input.isPressed(p.id) || flipperDirection;
      const flipJust = this.input.justAction(p.id) || this.input.justPressed(p.id) || flipperDirection;

      if (flipJust) {
        this.audio.playFlipper();
      }

      ps.flipperActive = flipHeld;
      if (ps.flipperActive) {
        ps.flipperAnim = 1.0;
      } else {
        ps.flipperAnim = Math.max(0, ps.flipperAnim - dt * 6.0);
      }

      // Movement along defense rail (manual steer/throttle or single-button smooth patrol)
      const moveSpeed = 320;
      if (ps.zone === 'BOTTOM' || ps.zone === 'TOP') {
        const halfW = ps.width / 2;
        const minX = this.tableBounds.minX + halfW + 10;
        const maxX = this.tableBounds.maxX - halfW - 10;

        if (steer !== 0) {
          ps.x += steer * moveSpeed * dt;
        } else {
          ps.x += ps.patrolDir * (moveSpeed * 0.65) * dt;
          if (flipJust) ps.patrolDir = (ps.patrolDir === 1 ? -1 : 1);
        }
        if (ps.x <= minX) { ps.x = minX; ps.patrolDir = 1; }
        else if (ps.x >= maxX) { ps.x = maxX; ps.patrolDir = -1; }
      } else {
        // LEFT or RIGHT vertical paddle
        const halfH = ps.height / 2;
        const minY = this.tableBounds.minY + halfH + 10;
        const maxY = this.tableBounds.maxY - halfH - 10;

        if (throttle !== 0) {
          ps.y += -throttle * moveSpeed * dt;
        } else {
          ps.y += ps.patrolDir * (moveSpeed * 0.65) * dt;
          if (flipJust) ps.patrolDir = (ps.patrolDir === 1 ? -1 : 1);
        }
        if (ps.y <= minY) { ps.y = minY; ps.patrolDir = 1; }
        else if (ps.y >= maxY) { ps.y = maxY; ps.patrolDir = -1; }
      }
    }

    // Update Balls
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Table Boundary Bounce / Goal Check
      this.checkBallWallAndGoal(b, i, width, height);

      // Bumper Collisions
      for (const bmp of this.bumpers) {
        const dx = b.x - bmp.x;
        const dy = b.y - bmp.y;
        const dist = Math.hypot(dx, dy);

        if (dist < b.radius + bmp.radius) {
          const normalX = dx / (dist || 1);
          const normalY = dy / (dist || 1);

          // Bumper violent rebound
          const reboundSpeed = Math.min(520, Math.hypot(b.vx, b.vy) * 1.15 + 40);
          b.vx = normalX * reboundSpeed;
          b.vy = normalY * reboundSpeed;
          b.x = bmp.x + normalX * (b.radius + bmp.radius + 1);
          b.y = bmp.y + normalY * (b.radius + bmp.radius + 1);

          bmp.flashTimer = 0.25;
          this.audio.playBounce();
          this.particles.shake(0.2);
          this.particles.spawnSparks(bmp.x, bmp.y, bmp.color, 12);

          // Award bumper points to last player who touched
          if (b.lastTouch !== null) {
            const touchPlayer = this.playersState.get(b.lastTouch);
            if (touchPlayer) touchPlayer.score += 15;
          }
        }
      }

      // Player Flipper / Paddle Collisions
      for (const p of this.getActivePlayers()) {
        const ps = this.playersState.get(p.id);
        if (!ps || ps.shields <= 0) continue;

        const left = ps.x - ps.width / 2;
        const right = ps.x + ps.width / 2;
        const top = ps.y - ps.height / 2;
        const bottom = ps.y + ps.height / 2;

        if (
          b.x + b.radius >= left &&
          b.x - b.radius <= right &&
          b.y + b.radius >= top &&
          b.y - b.radius <= bottom
        ) {
          b.lastTouch = ps.id;
          ps.score += 10;

          // Compute rebound velocity
          const flipBoost = ps.flipperAnim > 0 ? 1.4 : 1.0;

          if (ps.zone === 'BOTTOM') {
            const offset = (b.x - ps.x) / (ps.width / 2);
            b.vy = -Math.abs(b.vy) * flipBoost - (ps.flipperAnim > 0 ? 90 : 0);
            b.vx = offset * 240;
            b.y = top - b.radius;
          } else if (ps.zone === 'TOP') {
            const offset = (b.x - ps.x) / (ps.width / 2);
            b.vy = Math.abs(b.vy) * flipBoost + (ps.flipperAnim > 0 ? 90 : 0);
            b.vx = offset * 240;
            b.y = bottom + b.radius;
          } else if (ps.zone === 'LEFT') {
            const offset = (b.y - ps.y) / (ps.height / 2);
            b.vx = Math.abs(b.vx) * flipBoost + (ps.flipperAnim > 0 ? 90 : 0);
            b.vy = offset * 240;
            b.x = right + b.radius;
          } else {
            // RIGHT
            const offset = (b.y - ps.y) / (ps.height / 2);
            b.vx = -Math.abs(b.vx) * flipBoost - (ps.flipperAnim > 0 ? 90 : 0);
            b.vy = offset * 240;
            b.x = left - b.radius;
          }

          this.audio.playBounce();
          this.particles.spawnSparks(b.x, b.y, p.color, 10);
        }
      }
    }

    // End round check: time up or all but 1 player out of shields
    const activeWithShields = Array.from(this.playersState.values()).filter((p) => p.shields > 0);
    if (this.roundTimer <= 0 || activeWithShields.length <= 1) {
      this.isFinished = true;
    }
  }

  private checkBallWallAndGoal(b: PinballBall, ballIdx: number, width: number, height: number): void {
    // Check goal boundaries
    const centerY = (this.tableBounds.minY + this.tableBounds.maxY) / 2;

    // Bottom Goal Check
    if (b.y + b.radius >= this.tableBounds.maxY) {
      const pBottom = Array.from(this.playersState.values()).find((p) => p.zone === 'BOTTOM');
      if (pBottom) {
        this.handleGoalScored(pBottom, b);
      } else {
        b.y = this.tableBounds.maxY - b.radius;
        b.vy = -Math.abs(b.vy);
      }
      return;
    }

    // Top Goal Check
    if (b.y - b.radius <= this.tableBounds.minY) {
      const pTop = Array.from(this.playersState.values()).find((p) => p.zone === 'TOP');
      if (pTop) {
        this.handleGoalScored(pTop, b);
      } else {
        b.y = this.tableBounds.minY + b.radius;
        b.vy = Math.abs(b.vy);
      }
      return;
    }

    // Left Goal Check
    if (b.x - b.radius <= this.tableBounds.minX) {
      const pLeft = Array.from(this.playersState.values()).find((p) => p.zone === 'LEFT');
      if (pLeft) {
        this.handleGoalScored(pLeft, b);
      } else {
        b.x = this.tableBounds.minX + b.radius;
        b.vx = Math.abs(b.vx);
      }
      return;
    }

    // Right Goal Check
    if (b.x + b.radius >= this.tableBounds.maxX) {
      const pRight = Array.from(this.playersState.values()).find((p) => p.zone === 'RIGHT');
      if (pRight) {
        this.handleGoalScored(pRight, b);
      } else {
        b.x = this.tableBounds.maxX - b.radius;
        b.vx = -Math.abs(b.vx);
      }
      return;
    }
  }

  private handleGoalScored(concedingPlayer: PinballPaddle, b: PinballBall): void {
    concedingPlayer.shields -= 1;

    // Award Goal to last toucher
    if (b.lastTouch !== null && b.lastTouch !== concedingPlayer.id) {
      const scorer = this.playersState.get(b.lastTouch);
      if (scorer) {
        scorer.score += 150;
        scorer.goalsScored += 1;
      }
    }

    this.audio.playExplosion();
    this.particles.shake(0.4);
    this.particles.spawnExplosion(b.x, b.y, '#EF4444', 25);
    this.particles.showFloatingText('GOAL!', b.x, b.y - 20, '#EF4444', 26);

    // Reset ball to center
    const centerY = (this.tableBounds.minY + this.tableBounds.maxY) / 2;
    b.x = (this.tableBounds.minX + this.tableBounds.maxX) / 2;
    b.y = centerY;
    const a = Math.random() * Math.PI * 2;
    b.vx = Math.cos(a) * 320;
    b.vy = Math.sin(a) * 320;
    b.lastTouch = null;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.shields <= 0) return;

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    const interval =
      difficulty === 'bot_hard' ? 0.04 : difficulty === 'bot_normal' ? 0.08 : 0.16;
    ps.botReactionTimer = interval;

    // Find ball heading toward bot's goal
    let nearestBall: PinballBall | null = null;
    let minDist = 9999;

    for (const b of this.balls) {
      const d = Math.hypot(ps.x - b.x, ps.y - b.y);
      let headingTowardsMe = false;

      if (ps.zone === 'BOTTOM' && b.vy > 0) headingTowardsMe = true;
      else if (ps.zone === 'TOP' && b.vy < 0) headingTowardsMe = true;
      else if (ps.zone === 'LEFT' && b.vx < 0) headingTowardsMe = true;
      else if (ps.zone === 'RIGHT' && b.vx > 0) headingTowardsMe = true;

      if (headingTowardsMe && d < minDist) {
        minDist = d;
        nearestBall = b;
      }
    }

    let steer = 0;
    let throttle = 0;
    let flip = false;

    if (nearestBall) {
      if (ps.zone === 'BOTTOM' || ps.zone === 'TOP') {
        const dx = nearestBall.x - ps.x;
        if (dx > 8) steer = 1;
        else if (dx < -8) steer = -1;

        if (minDist < 60 && Math.abs(dx) < ps.width * 0.45) {
          flip = true;
        }
      } else {
        const dy = nearestBall.y - ps.y;
        if (dy > 8) throttle = -1;
        else if (dy < -8) throttle = 1;

        if (minDist < 60 && Math.abs(dy) < ps.height * 0.45) {
          flip = true;
        }
      }
    }

    if (difficulty === 'bot_easy' && Math.random() < 0.25) {
      flip = false;
    }

    this.input.setBotInput(botId, flip, steer, throttle, flip);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Table Floor Background
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // Pinball Table Outer Border
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 4;
    ctx.strokeRect(
      this.tableBounds.minX,
      this.tableBounds.minY,
      this.tableBounds.maxX - this.tableBounds.minX,
      this.tableBounds.maxY - this.tableBounds.minY
    );

    // Neon Arc Corner Lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.tableBounds.minX + 40, this.tableBounds.minY + 40, 35, Math.PI, Math.PI * 1.5);
    ctx.arc(this.tableBounds.maxX - 40, this.tableBounds.minY + 40, 35, Math.PI * 1.5, Math.PI * 2);
    ctx.arc(this.tableBounds.maxX - 40, this.tableBounds.maxY - 40, 35, 0, Math.PI * 0.5);
    ctx.arc(this.tableBounds.minX + 40, this.tableBounds.maxY - 40, 35, Math.PI * 0.5, Math.PI);
    ctx.stroke();

    // 2. Bumpers
    for (const bmp of this.bumpers) {
      this.renderBumper(ctx, bmp);
    }

    // 3. Players / Flipper Paddles
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderPaddle(ctx, ps, p.color);
    }

    // 4. Pinballs
    for (const b of this.balls) {
      this.renderBall(ctx, b);
    }

    // 5. Center HUD Pod
    this.renderCenterHudPod(ctx, width);
  }

  private renderBumper(ctx: CanvasRenderingContext2D, bmp: PinballBumper): void {
    ctx.save();
    ctx.translate(bmp.x, bmp.y);

    // Glowing Flash Ring if hit
    if (bmp.flashTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, bmp.radius + 10, 0, Math.PI * 2);
      ctx.fillStyle = `${bmp.color}55`;
      ctx.fill();
    }

    // Bumper Ring
    ctx.beginPath();
    ctx.arc(0, 0, bmp.radius, 0, Math.PI * 2);
    ctx.fillStyle = bmp.flashTimer > 0 ? '#FFFFFF' : '#1E293B';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = bmp.color;
    ctx.stroke();

    // Inner Core
    ctx.beginPath();
    ctx.arc(0, 0, bmp.radius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = bmp.color;
    ctx.fill();

    ctx.restore();
  }

  private renderPaddle(
    ctx: CanvasRenderingContext2D,
    ps: PinballPaddle,
    color: string
  ): void {
    if (ps.shields <= 0) return;

    ctx.save();
    ctx.translate(ps.x, ps.y);

    // Paddle Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-ps.width / 2, -ps.height / 2, ps.width, ps.height, 5);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    // Flipper Pulse Glow when active
    if (ps.flipperAnim > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.roundRect(-ps.width / 2 - 3, -ps.height / 2 - 3, ps.width + 6, ps.height + 6, 7);
      ctx.fill();
    }

    ctx.restore();

    // Shield pip dots near paddle
    this.renderShieldPips(ctx, ps);
  }

  private renderShieldPips(ctx: CanvasRenderingContext2D, ps: PinballPaddle): void {
    const dotSpacing = 8;
    const startX = ps.x - ((ps.maxShields - 1) * dotSpacing) / 2;
    const pipY = ps.zone === 'BOTTOM' ? ps.y + 14 : ps.y - 14;

    for (let s = 0; s < ps.maxShields; s++) {
      ctx.beginPath();
      ctx.arc(startX + s * dotSpacing, pipY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = s < ps.shields ? '#22C55E' : '#475569';
      ctx.fill();
    }
  }

  private renderBall(ctx: CanvasRenderingContext2D, b: PinballBall): void {
    // Silver Pinball
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#E2E8F0';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    // Chrome reflection glint
    ctx.beginPath();
    ctx.arc(b.x - b.radius * 0.35, b.y - b.radius * 0.35, b.radius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  }

  private renderCenterHudPod(ctx: CanvasRenderingContext2D, width: number): void {
    const podW = 340;
    const podH = 26;
    const podX = width / 2 - podW / 2;
    const podY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 13);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Map Name Badge
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(`TABLE: ${this.currentMapName}`, podX + 16, podY + 17);

    // Timer display
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    const timerColor = this.roundTimer < 10 ? '#EF4444' : '#F1F5F9';
    ctx.fillStyle = timerColor;
    ctx.fillText(`TIME: ${this.roundTimer.toFixed(1)}s`, podX + podW - 16, podY + 17);
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const rankings = active
      .map((p) => {
        const ps = this.playersState.get(p.id);
        const score = (ps ? ps.score : 0) + (ps ? ps.shields * 50 : 0);
        return { playerId: p.id, score, place: 1 };
      })
      .sort((a, b) => b.score - a.score);

    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });

    const winnerId =
      rankings.length > 0 && (rankings.length === 1 || rankings[0].score > rankings[1].score)
        ? rankings[0].playerId
        : null;

    let mvpHighlight = 'Pinball Wizard!';
    if (winnerId !== null) {
      const ps = this.playersState.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} dominated the flippers with ${ps?.score || 0} pts!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
