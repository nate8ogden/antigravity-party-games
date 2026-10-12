import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface VolleyPlayer {
  id: PlayerId;
  team: 'LEFT' | 'RIGHT';
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  groundY: number;
  isGrounded: boolean;
  radius: number;
  score: number;
  touches: number;
  spikeCooldown: number;
  diveTimer: number;
  isDiving: boolean;
  botReactionTimer: number;
  patrolDir: 1 | -1;
}

interface VolleyBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isSpiked: boolean;
  lastTouchTeam: 'LEFT' | 'RIGHT' | null;
  lastTouchPlayer: PlayerId | null;
  previousTouchPlayer: PlayerId | null;
  teamTouches: number;
}

export class VolleySpikeGame extends BaseGame {
  private playersState: Map<PlayerId, VolleyPlayer> = new Map();
  private ball: VolleyBall = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 14,
    isSpiked: false,
    lastTouchTeam: null,
    lastTouchPlayer: null,
    previousTouchPlayer: null,
    teamTouches: 0
  };
  private currentMapName: string = 'Neon Beach Sunset';
  private floorY: number = 0;
  private netX: number = 0;
  private netTopY: number = 0;
  private netHeight: number = 100;
  private netWidth: number = 12;
  private teamLeftScore: number = 0;
  private teamRightScore: number = 0;
  private targetScore: number = 5;
  private serveTimer: number = 0;
  private gravity: number = 720;

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
    this.teamLeftScore = 0;
    this.teamRightScore = 0;

    this.floorY = height - 50;
    this.netX = width / 2;
    this.netHeight = 110;
    this.netTopY = this.floorY - this.netHeight;

    this.generateProceduralMap();
    this.input.setControlMode('directional');
    this.initPlayers(width);
    this.serveBall('LEFT');
    this.syncDebug();
  }

  private generateProceduralMap(): void {
    const maps = [
      'Neon Beach Sunset',
      'Cyber Gym Arena',
      'Tropical Tiki Coast',
      'Lava Caldera Court'
    ];
    this.currentMapName = maps[Math.floor(Math.random() * maps.length)];
  }

  private initPlayers(width: number): void {
    this.playersState.clear();
    const active = this.getActivePlayers();
    const count = active.length;

    active.forEach((p, idx) => {
      const isLeft = idx % 2 === 0;
      const team: 'LEFT' | 'RIGHT' = isLeft ? 'LEFT' : 'RIGHT';

      let startX: number;
      if (count === 2) {
        startX = isLeft ? this.netX * 0.45 : this.netX + (width - this.netX) * 0.55;
      } else {
        const rank = Math.floor(idx / 2);
        startX = isLeft
          ? this.netX * (rank === 0 ? 0.35 : 0.68)
          : this.netX + (width - this.netX) * (rank === 0 ? 0.65 : 0.32);
      }

      this.playersState.set(p.id, {
        id: p.id,
        team,
        x: startX,
        y: this.floorY - 18,
        vx: 0,
        vy: 0,
        baseX: startX,
        groundY: this.floorY - 18,
        isGrounded: true,
        radius: 18,
        score: 0,
        touches: 0,
        spikeCooldown: 0,
        diveTimer: 0,
        isDiving: false,
        botReactionTimer: 0.15 + idx * 0.1,
        patrolDir: 1
      });
    });
  }

  private serveBall(servingTeam: 'LEFT' | 'RIGHT'): void {
    this.serveTimer = 1.0;
    this.ball.x = servingTeam === 'LEFT' ? this.netX * 0.45 : this.netX + (this.netX * 0.55);
    this.ball.y = this.netTopY - 70;
    this.ball.vx = servingTeam === 'LEFT' ? 80 : -80;
    this.ball.vy = -180;
    this.ball.isSpiked = false;
    this.ball.lastTouchTeam = null;
    this.ball.lastTouchPlayer = null;
    this.ball.previousTouchPlayer = null;
    this.ball.teamTouches = 0;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.spikeCooldown > 0) ps.spikeCooldown = Math.max(0, ps.spikeCooldown - dt);
      if (ps.diveTimer > 0) {
        ps.diveTimer = Math.max(0, ps.diveTimer - dt);
        if (ps.diveTimer <= 0) ps.isDiving = false;
      }

      // Read Input
      const steer = this.input.getSteer(p.id);
      const rawSteer = this.input.getRawSteer(p.id);
      const effectiveSteer = Math.abs(steer) > 0.1 ? steer : rawSteer;

      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      const justUp = this.input.justUp(p.id);
      const justDown = this.input.justDown(p.id);
      const throttle = this.input.getThrottle(p.id);

      // Clean, responsive jump & dive inputs
      const isJump = justUp || (justAction && throttle >= -0.2) || throttle > 0.4;
      const isDive = justDown || throttle < -0.5 || (justAction && throttle < -0.3);

      // Dive / Slide Save
      if (isDive && ps.isGrounded && !ps.isDiving) {
        ps.isDiving = true;
        ps.diveTimer = 0.38;
        const diveDir = effectiveSteer !== 0 ? Math.sign(effectiveSteer) : (ps.team === 'LEFT' ? 1 : -1);
        ps.vx = diveDir * 380;
        this.audio.playWhoosh();
        this.particles.spawnDust(ps.x, ps.y + ps.radius, 8);
        this.particles.showFloatingText('DIVE!', ps.x, ps.y - 20, '#38BDF8', 18);
      }

      // Horizontal movement: 100% direct player control!
      const moveSpeed = ps.isDiving ? 380 : ps.isGrounded ? 280 : 250;
      if (effectiveSteer !== 0) {
        ps.vx = effectiveSteer * moveSpeed;
      } else if (ps.isDiving) {
        ps.vx *= Math.pow(0.92, dt * 60);
      } else {
        ps.vx = 0; // Clean stop when no direction is pressed! Zero unwanted auto-patrol!
      }
      ps.x += ps.vx * dt;

      // Restrict player to their team's half
      const minX = ps.team === 'LEFT' ? ps.radius + 15 : this.netX + this.netWidth / 2 + ps.radius;
      const maxX = ps.team === 'LEFT' ? this.netX - this.netWidth / 2 - ps.radius : width - ps.radius - 15;
      if (ps.x < minX) ps.x = minX;
      if (ps.x > maxX) ps.x = maxX;

      // Jump & Gravity
      if (isJump && ps.isGrounded && !ps.isDiving) {
        ps.vy = -510;
        ps.isGrounded = false;
        this.audio.playBounce();
        this.particles.spawnDust(ps.x, ps.y + ps.radius, 6);
      }

      if (!ps.isGrounded) {
        ps.vy += this.gravity * dt;
        ps.y += ps.vy * dt;

        if (ps.y >= ps.groundY) {
          ps.y = ps.groundY;
          ps.vy = 0;
          ps.isGrounded = true;
        }
      }
    }

    // Serve delay countdown
    if (this.serveTimer > 0) {
      this.serveTimer -= dt;
      return;
    }

    // Update Ball Physics
    this.ball.vy += this.gravity * dt;
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    // Air drag
    this.ball.vx *= Math.pow(0.992, dt * 60);

    // Ball Wall Collisions
    if (this.ball.x - this.ball.radius < 10) {
      this.ball.x = 10 + this.ball.radius;
      this.ball.vx = Math.abs(this.ball.vx) * 0.85;
      this.audio.playBounce();
    } else if (this.ball.x + this.ball.radius > width - 10) {
      this.ball.x = width - 10 - this.ball.radius;
      this.ball.vx = -Math.abs(this.ball.vx) * 0.85;
      this.audio.playBounce();
    }

    // Ball Net Collision
    const netLeft = this.netX - this.netWidth / 2;
    const netRight = this.netX + this.netWidth / 2;
    if (
      this.ball.y + this.ball.radius >= this.netTopY &&
      this.ball.x + this.ball.radius >= netLeft &&
      this.ball.x - this.ball.radius <= netRight
    ) {
      if (this.ball.y < this.netTopY + 8) {
        // Net tape bounce (top edge)
        this.ball.vy = -Math.abs(this.ball.vy) * 0.75;
        this.ball.y = this.netTopY - this.ball.radius;
      } else {
        // Net side bounce
        if (this.ball.x < this.netX) {
          this.ball.x = netLeft - this.ball.radius;
          this.ball.vx = -Math.abs(this.ball.vx) * 0.8;
        } else {
          this.ball.x = netRight + this.ball.radius;
          this.ball.vx = Math.abs(this.ball.vx) * 0.8;
        }
      }
      this.ball.isSpiked = false;
      this.audio.playBounce();
    }

    // Ball & Player Collisions
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      const dx = this.ball.x - ps.x;
      const dy = this.ball.y - ps.y;
      const dist = Math.hypot(dx, dy);

      const touchRadius = this.ball.radius + ps.radius + (ps.isDiving ? 8 : 0);
      if (dist < touchRadius) {
        // Ball touch!
        const normalX = dx / (dist || 1);
        const normalY = dy / (dist || 1);

        // Check if spike: Player is airborne near top of net level
        const isSpikeAttempt = (!ps.isGrounded && ps.y < this.netTopY + 36 && ps.spikeCooldown <= 0) ||
                               (!ps.isGrounded && (this.input.justDown(p.id) || this.input.getThrottle(p.id) < -0.3));

        if (isSpikeAttempt) {
          // POWER SPIKE!
          this.ball.isSpiked = true;
          ps.spikeCooldown = 0.45;
          const spikeDir = ps.team === 'LEFT' ? 1 : -1;
          this.ball.vx = spikeDir * (390 + Math.random() * 60);
          this.ball.vy = 280 + Math.random() * 60;

          this.audio.playSpike();
          this.particles.shake(0.35);
          this.particles.showFloatingText('POWER SPIKE!!', ps.x, ps.y - 30, '#F59E0B', 24);
          this.particles.spawnConfetti(this.ball.x, this.ball.y, 25);
        } else {
          // Normal Volley Pop / Set
          this.ball.isSpiked = false;

          // Check if setting to teammate for 2v2 combo!
          const active = this.getActivePlayers();
          const teammate = active.find((tp) => tp.id !== ps.id && this.playersState.get(tp.id)?.team === ps.team);
          const tmState = teammate ? this.playersState.get(teammate.id) : null;

          if (this.ball.lastTouchTeam !== ps.team && tmState) {
            // First touch: smart set toward teammate for an epic spike setup!
            const toTmX = tmState.x - ps.x;
            this.ball.vx = Math.max(-170, Math.min(170, toTmX * 1.5));
            this.ball.vy = -470; // High looping set arc!
            this.particles.showFloatingText('NICE SET!', ps.x, ps.y - 25, '#38BDF8', 18);
          } else {
            // Return pop over net
            const popDir = ps.team === 'LEFT' ? 1 : -1;
            const angleInfluence = normalX * 180;
            this.ball.vx = popDir * 165 + angleInfluence + ps.vx * 0.35;
            this.ball.vy = -410 - Math.abs(ps.vy) * 0.2;
          }

          this.audio.playBounce();
          this.particles.spawnSparks(this.ball.x, this.ball.y, p.color, 8);
        }

        // Track touches & assists
        if (this.ball.lastTouchTeam === ps.team) {
          this.ball.teamTouches += 1;
        } else {
          this.ball.lastTouchTeam = ps.team;
          this.ball.teamTouches = 1;
        }
        this.ball.previousTouchPlayer = this.ball.lastTouchPlayer;
        this.ball.lastTouchPlayer = ps.id;
        ps.touches += 1;

        // Reposition ball outside player collision radius
        this.ball.x = ps.x + normalX * (touchRadius + 2);
        this.ball.y = ps.y + normalY * (touchRadius + 2);

        // Fault: 4 touches fault check
        if (this.ball.teamTouches > 3) {
          this.handlePointScored(ps.team === 'LEFT' ? 'RIGHT' : 'LEFT', 'FOUR TOUCHES FAULT!');
          return;
        }
      }
    }

    // Ground Touch / Point scored check
    if (this.ball.y + this.ball.radius >= this.floorY) {
      if (this.ball.x < this.netX) {
        // Landed on Left court: Right team scores!
        this.handlePointScored('RIGHT', 'POINT RIGHT!');
      } else {
        // Landed on Right court: Left team scores!
        this.handlePointScored('LEFT', 'POINT LEFT!');
      }
    }

    this.syncDebug();

    // Round over condition
    if (
      this.teamLeftScore >= this.targetScore ||
      this.teamRightScore >= this.targetScore ||
      this.roundTimer <= 0
    ) {
      this.isFinished = true;
    }
  }

  public syncDebug(): void {
    if (typeof window !== 'undefined') {
      (window as any).__VOLLEY_SPIKE_DEBUG__ = {
        players: Array.from(this.playersState.values()),
        ball: this.ball,
        teamLeftScore: this.teamLeftScore,
        teamRightScore: this.teamRightScore,
        isFinished: this.isFinished,
        roundTimer: this.roundTimer,
        handlePointScored: (team: 'LEFT' | 'RIGHT', reason: string) => this.handlePointScored(team, reason)
      };
    }
  }

  private handlePointScored(scoringTeam: 'LEFT' | 'RIGHT', reason: string): void {
    if (scoringTeam === 'LEFT') {
      this.teamLeftScore += 1;
    } else {
      this.teamRightScore += 1;
    }

    // Check for 2v2 Teammate Assist Combo
    let isTeamCombo = false;
    let assisterId: PlayerId | null = null;
    let scorerId: PlayerId | null = null;

    if (this.ball.lastTouchTeam === scoringTeam && this.ball.lastTouchPlayer !== null) {
      scorerId = this.ball.lastTouchPlayer;
      if (this.ball.previousTouchPlayer !== null && this.ball.previousTouchPlayer !== scorerId) {
        const prevPlayer = this.playersState.get(this.ball.previousTouchPlayer);
        if (prevPlayer && prevPlayer.team === scoringTeam) {
          isTeamCombo = true;
          assisterId = prevPlayer.id;
        }
      }
    }

    // Award points to BOTH teammates on scoring team
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (ps && ps.team === scoringTeam) {
        ps.score += 100;
        if (isTeamCombo && p.id === assisterId) {
          ps.score += 30; // Assist Bonus
        }
        if (isTeamCombo && p.id === scorerId) {
          ps.score += 30; // Spike Kill Bonus
        }
      }
    }

    const color = scoringTeam === 'LEFT' ? '#3B82F6' : '#EF4444';
    this.audio.playScore();
    this.particles.shake(0.35);

    if (isTeamCombo) {
      this.particles.showFloatingText('DUO COMBO! +130 PTS!', this.ball.x, this.floorY - 65, '#F59E0B', 28);
      this.particles.spawnConfetti(this.ball.x, this.floorY - 20, 35);
    } else {
      this.particles.showFloatingText(reason, this.ball.x, this.floorY - 45, color, 26);
      this.particles.spawnConfetti(this.ball.x, this.floorY - 15, 25);
    }

    // Next serve goes to the team that conceded
    const nextServeTeam = scoringTeam === 'LEFT' ? 'RIGHT' : 'LEFT';
    this.serveBall(nextServeTeam);
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
    if (!ps) return;

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    const interval =
      difficulty === 'bot_hard' ? 0.04 : difficulty === 'bot_normal' ? 0.08 : 0.16;
    ps.botReactionTimer = interval;

    // Check if ball is on bot's court or crossing net
    const ballHeadingToMe =
      (ps.team === 'LEFT' && this.ball.vx < 0) ||
      (ps.team === 'RIGHT' && this.ball.vx > 0) ||
      (ps.team === 'LEFT' && this.ball.x < this.netX) ||
      (ps.team === 'RIGHT' && this.ball.x > this.netX);

    let targetX = ps.baseX;
    let shouldJump = false;

    if (ballHeadingToMe) {
      // Calculate realistic ballistic landing position when ball reaches head height
      const targetHeadY = ps.groundY - 30;
      let predictedX = this.ball.x;

      if (this.ball.y < targetHeadY) {
        const a = 0.5 * this.gravity;
        const b = this.ball.vy;
        const c = this.ball.y - targetHeadY;
        const disc = b * b - 4 * a * c;
        if (disc >= 0) {
          const t = (-b + Math.sqrt(disc)) / (2 * a);
          if (t > 0) {
            predictedX = this.ball.x + this.ball.vx * t;
            // Handle wall bounce in prediction
            if (predictedX < 15) predictedX = 15 + Math.abs(predictedX - 15);
            else if (predictedX > width - 15) predictedX = width - 15 - Math.abs(predictedX - (width - 15));
          }
        }
      }

      // Add difficulty variance
      if (difficulty === 'bot_easy') {
        predictedX += (Math.random() - 0.5) * 70;
      } else if (difficulty === 'bot_normal') {
        predictedX += (Math.random() - 0.5) * 24;
      }

      targetX = predictedX;

      // Adjust positioning for angle return
      if (ps.team === 'LEFT') {
        targetX -= 12; // hit with right side of player head
      } else {
        targetX += 12; // hit with left side of player head
      }

      // Jump / Spike timing: if ball is descending near player reach
      const distToBall = Math.hypot(ps.x - this.ball.x, ps.y - this.ball.y);
      if (distToBall < 110 && this.ball.y < ps.y - 15 && this.ball.vy > -50) {
        if (difficulty === 'bot_easy' && Math.random() < 0.35) {
          shouldJump = false;
        } else {
          shouldJump = true;
        }
      }
    } else {
      // Return to baseline defense position
      targetX = ps.baseX;
    }

    // Apply movement
    let steer = 0;
    if (targetX > ps.x + 8) steer = 1;
    else if (targetX < ps.x - 8) steer = -1;

    this.input.setBotInput(botId, shouldJump, steer, shouldJump ? -1 : 0, shouldJump);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Court Background
    this.renderCourtBackground(ctx, width, height);

    // 2. Net & Floor
    this.renderNetAndFloor(ctx, width);

    // 3. Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderVolleyPlayer(ctx, ps, p.color);
    }

    // 4. Volleyball
    this.renderBall(ctx);

    // 5. Center HUD Pod
    this.renderCenterHudPod(ctx, width);
  }

  private renderCourtBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    if (this.currentMapName === 'Neon Beach Sunset') {
      bgGrad.addColorStop(0, '#1E1B4B');
      bgGrad.addColorStop(0.5, '#4C1D95');
      bgGrad.addColorStop(1, '#F43F5E');
    } else if (this.currentMapName === 'Cyber Gym Arena') {
      bgGrad.addColorStop(0, '#020617');
      bgGrad.addColorStop(0.6, '#0F172A');
      bgGrad.addColorStop(1, '#1E293B');
    } else if (this.currentMapName === 'Tropical Tiki Coast') {
      bgGrad.addColorStop(0, '#064E3B');
      bgGrad.addColorStop(0.6, '#047857');
      bgGrad.addColorStop(1, '#065F46');
    } else {
      // Lava Caldera Court
      bgGrad.addColorStop(0, '#18181B');
      bgGrad.addColorStop(0.5, '#450A0A');
      bgGrad.addColorStop(1, '#7F1D1D');
    }

    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Distant Sunset / Neon Ring
    ctx.beginPath();
    ctx.arc(width / 2, this.floorY - 140, 90, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.25)';
    ctx.fill();
  }

  private renderNetAndFloor(ctx: CanvasRenderingContext2D, width: number): void {
    // Court Floor
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, this.floorY, width, 50);

    // Floor Surface Trim
    ctx.fillStyle = '#10B981';
    ctx.fillRect(0, this.floorY, width, 5);

    // Center Net Post
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(this.netX - this.netWidth / 2, this.netTopY, this.netWidth, this.netHeight);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(this.netX - this.netWidth / 2, this.netTopY, this.netWidth, this.netHeight);

    // Net Mesh Lattice
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    for (let y = this.netTopY + 10; y < this.floorY; y += 12) {
      ctx.beginPath();
      ctx.moveTo(this.netX - this.netWidth / 2, y);
      ctx.lineTo(this.netX + this.netWidth / 2, y);
      ctx.stroke();
    }

    // Top Net White Band Tape
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(this.netX - this.netWidth / 2 - 2, this.netTopY, this.netWidth + 4, 8);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.netX - this.netWidth / 2 - 2, this.netTopY, this.netWidth + 4, 8);
  }

  private renderVolleyPlayer(
    ctx: CanvasRenderingContext2D,
    ps: VolleyPlayer,
    color: string
  ): void {
    // Shadow on court floor
    ctx.beginPath();
    ctx.ellipse(ps.x, this.floorY - 2, ps.radius * 0.85, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // Bouncy Jelly Arc Body (Half-dome hemisphere)
    ctx.save();
    ctx.translate(ps.x, ps.y);

    ctx.beginPath();
    ctx.arc(0, 0, ps.radius, Math.PI, 0, false);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    // Eye facing toward net
    const eyeDir = ps.team === 'LEFT' ? 1 : -1;
    const eyeX = eyeDir * 6;
    const eyeY = -6;

    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(eyeX + eyeDir * 1.8, eyeY - 1, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#0F172A';
    ctx.fill();

    ctx.restore();
  }

  private renderBall(ctx: CanvasRenderingContext2D): void {
    // Ball Shadow on Floor (scales dynamically with height)
    const shadowDist = Math.max(0, this.floorY - this.ball.y);
    const shadowScale = Math.max(0.25, 1 - shadowDist / 420);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(this.ball.x, this.floorY - 2, this.ball.radius * shadowScale * 1.3, 4 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.45 * shadowScale})`;
    ctx.fill();

    // Projected Landing Reticle (visual guide so players can position for sets and spikes)
    if (this.ball.vy > 0 && shadowDist > 40) {
      const a = 0.5 * this.gravity;
      const b = this.ball.vy;
      const c = this.ball.y - this.floorY;
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const t = (-b + Math.sqrt(disc)) / (2 * a);
        if (t > 0 && t < 1.4) {
          const landX = this.ball.x + this.ball.vx * t;
          ctx.beginPath();
          ctx.ellipse(landX, this.floorY - 2, 16, 5, 0, 0, Math.PI * 2);
          ctx.strokeStyle = this.ball.isSpiked ? '#EF4444' : 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
    ctx.restore();

    ctx.save();
    ctx.translate(this.ball.x, this.ball.y);

    // Ball Fire Spikes if spiked
    if (this.ball.isSpiked) {
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(0, 0, this.ball.radius + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(0, 0, this.ball.radius + 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Volleyball Sphere
    ctx.beginPath();
    ctx.arc(0, 0, this.ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    // Tri-color volleyball curved seams
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-2, -2, this.ball.radius * 0.75, 0, Math.PI * 0.8);
    ctx.stroke();

    ctx.strokeStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(2, 2, this.ball.radius * 0.75, Math.PI, Math.PI * 1.8);
    ctx.stroke();

    ctx.restore();
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
    ctx.fillStyle = '#F43F5E';
    ctx.fillText(`COURT: ${this.currentMapName}`, podX + 16, podY + 17);

    // Score Board in Center
    ctx.font = '800 12px Inter, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${this.teamLeftScore}  —  ${this.teamRightScore}`, width / 2, podY + 17);

    // Timer display
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    const timerColor = this.roundTimer < 10 ? '#EF4444' : '#F1F5F9';
    ctx.fillStyle = timerColor;
    ctx.fillText(`TIME: ${this.roundTimer.toFixed(1)}s`, podX + podW - 16, podY + 17);
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const winningTeam = this.teamLeftScore >= this.teamRightScore ? 'LEFT' : 'RIGHT';

    // In 2v2, both players on the winning team share 1st place!
    const rankings = active
      .map((p) => {
        const ps = this.playersState.get(p.id);
        const score = ps ? ps.score : 0;
        const isWinningTeam = ps && ps.team === winningTeam;
        return {
          playerId: p.id,
          score,
          place: isWinningTeam ? 1 : 2
        };
      })
      .sort((a, b) => {
        if (a.place !== b.place) return a.place - b.place;
        return b.score - a.score;
      });

    const winningPlayers = rankings.filter((r) => r.place === 1);
    const winnerId = winningPlayers.length > 0 ? winningPlayers[0].playerId : null;

    let mvpHighlight = 'Beach Volley Champions!';
    if (this.teamLeftScore !== this.teamRightScore) {
      const winningTeamName = this.teamLeftScore > this.teamRightScore ? 'Blue Duo' : 'Red Duo';
      mvpHighlight = `${winningTeamName} spiked to victory with unstoppable team coordination!`;
    } else if (winnerId !== null) {
      mvpHighlight = `Player ${Number(winnerId) + 1} dominated the volleyball net!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
