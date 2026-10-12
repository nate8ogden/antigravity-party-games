import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface PodJumper {
  id: PlayerId;
  angle: number; // Angle on circular arena ring
  x: number;
  y: number;
  alive: boolean;
  isJumping: boolean;
  jumpTimer: number; // 0 to jumpDuration
  jumpDuration: number;
  jumpHeight: number;
  score: number;
  botReactionTimer: number;
}

interface BotLeapState {
  plannedLeadTime: number;
  lastApproachDir: number;
  surpriseTimer: number;
  hasPlannedCurrentSweep: boolean;
}

export class LaserLeapGame extends BaseGame {
  private jumpers: Map<PlayerId, PodJumper> = new Map();
  private arenaCenterX: number = 400;
  private arenaCenterY: number = 300;
  private arenaRadius: number = 210;
  private botStates: Map<PlayerId, BotLeapState> = new Map();

  // Rotating Laser Beam properties
  private laserAngle: number = 0;
  private laserSpeed: number = 2.4; // Radians per sec, accelerates over time
  private laserDir: number = 1; // 1 (clockwise) or -1 (counter-clockwise)
  private reversalTimer: number = 4.0;
  private warningSparkTimer: number = 0;
  private eliminationOrder: PlayerId[] = [];
  private totalJumps: Map<PlayerId, number> = new Map();

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

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 45;
    this.isFinished = false;
    this.jumpers.clear();
    this.botStates.clear();
    this.eliminationOrder = [];
    this.totalJumps.clear();

    this.arenaCenterX = width / 2;
    this.arenaCenterY = height / 2;
    this.arenaRadius = Math.min(width, height) * 0.36;

    this.laserAngle = 0;
    this.laserSpeed = 2.4;
    this.laserDir = 1;
    this.reversalTimer = 3.5 + Math.random() * 2.0;
    this.warningSparkTimer = 0;

    const active = this.getActivePlayers();
    const count = active.length;

    // Distribute player pods evenly around perimeter
    active.forEach((p, idx) => {
      // Offset angles for visual balance
      const baseAngle = (idx / count) * Math.PI * 2 - Math.PI / 2;
      const px = this.arenaCenterX + Math.cos(baseAngle) * this.arenaRadius;
      const py = this.arenaCenterY + Math.sin(baseAngle) * this.arenaRadius;

      this.jumpers.set(p.id, {
        id: p.id,
        angle: baseAngle,
        x: px,
        y: py,
        alive: true,
        isJumping: false,
        jumpTimer: 0,
        jumpDuration: 0.44,
        jumpHeight: 0,
        score: 0,
        botReactionTimer: 0
      });
      this.totalJumps.set(p.id, 0);
      this.botStates.set(p.id, {
        plannedLeadTime: 0.20,
        lastApproachDir: 1,
        surpriseTimer: 0,
        hasPlannedCurrentSweep: false
      });
    });

    // Expose debug hook for testing
    (window as any).__LASER_LEAP_DEBUG__ = {
      getJumpers: () => Array.from(this.jumpers.values()).map(j => ({
        id: j.id,
        angle: j.angle,
        x: j.x,
        y: j.y,
        alive: j.alive,
        isJumping: j.isJumping,
        jumpHeight: j.jumpHeight,
        score: j.score
      })),
      getLaser: () => ({
        angle: this.laserAngle,
        speed: this.laserSpeed,
        dir: this.laserDir,
        reversalTimer: this.reversalTimer
      }),
      setLaser: (angle: number, speed: number, dir: number) => {
        this.laserAngle = angle;
        this.laserSpeed = speed;
        this.laserDir = dir;
      },
      jump: (pid: PlayerId) => {
        this.input.setBotInput(pid, true);
      }
    };
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Accelerate laser sweep speed gradually
    this.laserSpeed = Math.min(6.2, 2.4 + (45 - this.roundTimer) * 0.08);

    // Direction reversal countdown
    this.reversalTimer -= dt;
    if (this.reversalTimer <= 0.6 && this.reversalTimer > 0) {
      this.warningSparkTimer += dt * 15;
    }
    if (this.reversalTimer <= 0) {
      this.laserDir = -this.laserDir;
      this.reversalTimer = 3.2 + Math.random() * 3.0;
      this.warningSparkTimer = 0;
      this.audio.playLaser();
      this.particles.spawnSparks(this.arenaCenterX, this.arenaCenterY, '#FACC15', 20);
      this.particles.showFloatingText('REVERSE! ⚡', this.arenaCenterX, this.arenaCenterY - 40, '#FACC15', 22);
    }

    // Advance laser sweep angle
    const prevLaserAngle = this.laserAngle;
    this.laserAngle += this.laserDir * this.laserSpeed * dt;
    const twoPi = Math.PI * 2;
    this.laserAngle = ((this.laserAngle % twoPi) + twoPi) % twoPi;

    this.updateBots(dt, width, height);

    // Process Jumpers
    for (const j of this.jumpers.values()) {
      if (!j.alive) continue;

      // Handle jump inputs
      const justPressed = this.input.justPressed(j.id);
      if (justPressed && !j.isJumping) {
        j.isJumping = true;
        j.jumpTimer = 0;
        this.audio.playBoost();
        this.particles.spawnSparks(j.x, j.y + 12, '#38BDF8', 6);
        const cur = this.totalJumps.get(j.id) || 0;
        this.totalJumps.set(j.id, cur + 1);
      }

      // Jump parabolic arc physics
      if (j.isJumping) {
        j.jumpTimer += dt;
        const progress = Math.min(1.0, j.jumpTimer / j.jumpDuration);
        // Parabolic arc height peaking at ~42px
        j.jumpHeight = Math.sin(progress * Math.PI) * 44;

        if (j.jumpTimer >= j.jumpDuration) {
          j.isJumping = false;
          j.jumpTimer = 0;
          j.jumpHeight = 0;
          this.audio.playTap();
        }
      }

      // Check Laser Collision Sweep
      // Laser hits player if laser swept through player's pod angle while player was on the ground
      let podAngleNorm = ((j.angle % twoPi) + twoPi) % twoPi;
      const swept = this.isAngleBetween(prevLaserAngle, this.laserAngle, podAngleNorm, this.laserDir);

      if (swept) {
        if (!j.isJumping || j.jumpHeight < 16) {
          // ZAPPED! Caught on the ground by high-voltage beam
          j.alive = false;
          this.eliminationOrder.push(j.id);
          this.audio.playExplosion();
          this.particles.addTrauma(0.3);
          this.particles.spawnExplosion(j.x, j.y, this.players[j.id].color, 35);
          this.particles.spawnSparks(j.x, j.y, '#F87171', 25);
          this.particles.showFloatingText('ZAPPED! ⚡', j.x, j.y - 45, '#EF4444', 24);
        } else {
          // Successful jump over the beam!
          j.score += 10;
          this.particles.spawnSparks(j.x, j.y - j.jumpHeight, '#10B981', 8);
          this.particles.showFloatingText('+10 CLEARED!', j.x, j.y - j.jumpHeight - 20, '#10B981', 16);
        }
      }
    }

    // Check round over
    const aliveCount = Array.from(this.jumpers.values()).filter((j) => j.alive).length;
    if (aliveCount <= 1 || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private isAngleBetween(a1: number, a2: number, target: number, dir: number): boolean {
    const twoPi = Math.PI * 2;
    if (dir > 0) {
      // Moving clockwise
      let diff = (a2 - a1) % twoPi;
      if (diff < 0) diff += twoPi;
      let targetDiff = (target - a1) % twoPi;
      if (targetDiff < 0) targetDiff += twoPi;
      return targetDiff <= diff;
    } else {
      // Moving counter-clockwise
      let diff = (a1 - a2) % twoPi;
      if (diff < 0) diff += twoPi;
      let targetDiff = (a1 - target) % twoPi;
      if (targetDiff < 0) targetDiff += twoPi;
      return targetDiff <= diff;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const j = this.jumpers.get(botId);
    if (!j || !j.alive || j.isJumping) return;

    const twoPi = Math.PI * 2;
    let podAngle = ((j.angle % twoPi) + twoPi) % twoPi;
    let curLaser = this.laserAngle;

    // Angular distance laser needs to travel to reach this pod
    let angularDist = 0;
    if (this.laserDir > 0) {
      angularDist = (podAngle - curLaser) % twoPi;
      if (angularDist < 0) angularDist += twoPi;
    } else {
      angularDist = (curLaser - podAngle) % twoPi;
      if (angularDist < 0) angularDist += twoPi;
    }

    // Time until impact in seconds
    const timeToImpact = angularDist / (this.laserSpeed || 1);

    // AI timing window calibration
    let optimalLead = 0.18; // Bot jumps ~0.18s before beam arrives so it's at apex of 0.44s jump
    let errorMargin = 0;

    if (difficulty === 'bot_hard') {
      errorMargin = 0.02; // Very tight precision
    } else if (difficulty === 'bot_normal') {
      errorMargin = 0.06; // Human-like reaction
    } else {
      // Easy bot makes mistakes (18% chance of early/late miss)
      errorMargin = 0.16;
      if (Math.random() < 0.12 && timeToImpact < 0.25) {
        return; // Fumbles the jump
      }
    }

    const targetTime = optimalLead + (Math.random() - 0.5) * errorMargin;

    if (timeToImpact <= targetTime && timeToImpact > 0.03) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const survivors = Array.from(this.jumpers.values()).filter((j) => j.alive);
    const winnerId = survivors.length === 1 ? survivors[0].id : (this.eliminationOrder[this.eliminationOrder.length - 1] ?? null);

    const rankedIds = [...survivors.map((s) => s.id), ...[...this.eliminationOrder].reverse()];

    return {
      winnerId,
      rankings: rankedIds.map((pid, idx) => ({
        playerId: pid,
        score: Math.round(this.jumpers.get(pid)?.score || 0),
        place: idx + 1
      })),
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} MASTERED THE NEON LASER ROPE!` : 'ALL JUMPERS WERE ZAPPED!'
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. High-Tech Cyber Ring Floor
    const bgGrad = ctx.createRadialGradient(
      this.arenaCenterX, this.arenaCenterY, 40,
      this.arenaCenterX, this.arenaCenterY, this.arenaRadius + 60
    );
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(0.7, '#020617');
    bgGrad.addColorStop(1, '#000000');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative radial circuit track
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, this.arenaRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, this.arenaRadius * 0.55, 0, Math.PI * 2);
    ctx.stroke();

    // Central High-Voltage Core Spindle
    ctx.save();
    ctx.shadowColor = '#F43F5E';
    ctx.shadowBlur = 18;
    const coreGrad = ctx.createRadialGradient(this.arenaCenterX, this.arenaCenterY, 4, this.arenaCenterX, this.arenaCenterY, 32);
    coreGrad.addColorStop(0, '#FFFFFF');
    coreGrad.addColorStop(0.4, '#FB7185');
    coreGrad.addColorStop(1, '#BE123C');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Rotating Laser Beam Sweep with High-Intensity Core
    const beamLength = this.arenaRadius + 28;
    const beamEndX = this.arenaCenterX + Math.cos(this.laserAngle) * beamLength;
    const beamEndY = this.arenaCenterY + Math.sin(this.laserAngle) * beamLength;

    // Glowing Neon Laser Outer Sheath
    ctx.save();
    ctx.shadowColor = '#EF4444';
    ctx.shadowBlur = 22;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(this.arenaCenterX, this.arenaCenterY);
    ctx.lineTo(beamEndX, beamEndY);
    ctx.stroke();

    // Bright Core Laser Beam
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(this.arenaCenterX, this.arenaCenterY);
    ctx.lineTo(beamEndX, beamEndY);
    ctx.stroke();
    ctx.restore();

    // Reversal warning spark effect around center hub
    if (this.reversalTimer <= 0.6) {
      ctx.save();
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.arenaCenterX, this.arenaCenterY, 36 + Math.sin(this.warningSparkTimer) * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Render Player Pods and Jumpers
    for (const j of this.jumpers.values()) {
      const pColor = this.players[j.id]?.color || '#38BDF8';

      // 1. Pod Base Platform on the arena floor
      ctx.save();
      ctx.fillStyle = j.alive ? '#1E293B' : '#0F172A';
      ctx.strokeStyle = j.alive ? pColor : '#475569';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(j.x, j.y, 22, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Shadow on floor when jumping
      if (j.isJumping && j.alive) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        const shadowScale = Math.max(0.4, 1 - j.jumpHeight / 60);
        ctx.beginPath();
        ctx.ellipse(j.x, j.y, 18 * shadowScale, 9 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (!j.alive) continue;

      // 2. Character Sprite (Airborne with jumpHeight)
      const renderY = j.y - j.jumpHeight;

      ctx.save();
      // Body Disc
      ctx.fillStyle = pColor;
      ctx.shadowColor = pColor;
      ctx.shadowBlur = j.isJumping ? 14 : 6;
      ctx.beginPath();
      ctx.arc(j.x, renderY - 14, 14, 0, Math.PI * 2);
      ctx.fill();

      // Cyber Visor
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(j.x, renderY - 15, 8, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Jump boots spark trail
      if (j.isJumping) {
        ctx.fillStyle = '#FDE047';
        ctx.beginPath();
        ctx.arc(j.x - 5, renderY - 2, 3, 0, Math.PI * 2);
        ctx.arc(j.x + 5, renderY - 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Score / Status indicator above player
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${j.score} PTS`, j.x, renderY - 34);
    }

    ctx.restore();
  }
}
