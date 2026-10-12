import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Runner {
  id: PlayerId;
  x: number;
  y: number;
  startX: number;
  targetX: number;
  dir: 1 | -1; // 1: running right toward center, -1: running left toward center
  speed: number;
  isRunning: boolean;
  stunTimer: number;
  runAnim: number;
  hasFinished: boolean;
  finishTime: number;
}

type SentryPhase = 'green' | 'yellow' | 'red';

export class RedLightSentryGame extends BaseGame {
  private runners: Map<PlayerId, Runner> = new Map();
  private sentryPhase: SentryPhase = 'green';
  private phaseTimer: number = 1.2;
  private currentPhaseDuration: number = 1.2;
  private currentYellowDuration: number = 0.65;
  private greenCycleCount: number = 0;
  private sentryAngle: number = 0; // eye rotation
  private warningBeepTimer: number = 0;
  private laserSweepAngle: number = 0;
  private zappedLaserBeam: { x: number; y: number; timer: number } | null = null;
  private trophyX: number = 0;

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
    this.roundTimer = 50;
    this.isFinished = false;
    this.runners.clear();
    this.trophyX = width / 2;
    this.greenCycleCount = 0;
    this.zappedLaserBeam = null;

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      // 2 players: P1 starts on left running right, P2 starts on right running left
      const isLeft = idx % 2 === 0;
      const startX = isLeft ? 50 : width - 50;
      const laneY = active.length === 2 ? (idx === 0 ? height * 0.42 : height * 0.58) : height * 0.32 + idx * 75;

      this.runners.set(p.id, {
        id: p.id,
        x: startX,
        y: laneY,
        startX,
        targetX: this.trophyX,
        dir: isLeft ? 1 : -1,
        speed: 135, // Balanced speed requiring multiple green light cycles to reach trophy
        isRunning: false,
        stunTimer: 0,
        runAnim: 0,
        hasFinished: false,
        finishTime: 0
      });
    });

    this.triggerGreenPhase();
  }

  private triggerGreenPhase(): void {
    this.sentryPhase = 'green';
    this.greenCycleCount++;

    // Unpredictable green durations with distinct behavioral archetypes:
    // 1. First green: 1.0s - 1.4s (forces the first red light scan before anyone can reach the trophy!)
    // 2. Blitz Snap (28%): 0.65s - 1.0s (super fast turn to catch careless runners)
    // 3. Twitch Fake-Out (22%): 0.45s - 0.75s (immediate yellow warning!)
    // 4. Steady Sprint (35%): 1.4s - 2.1s (generous sprint window)
    // 5. Long Sprint (15%): 2.2s - 2.8s
    let duration: number;
    if (this.greenCycleCount === 1) {
      duration = 1.0 + Math.random() * 0.4;
    } else {
      const roll = Math.random();
      if (roll < 0.28) {
        duration = 0.65 + Math.random() * 0.35;
      } else if (roll < 0.50) {
        duration = 0.45 + Math.random() * 0.3;
      } else if (roll < 0.85) {
        duration = 1.4 + Math.random() * 0.7;
      } else {
        duration = 2.2 + Math.random() * 0.6;
      }
    }

    this.phaseTimer = duration;
    this.currentPhaseDuration = duration;
    this.audio.playTone(523, 0.1, 'triangle');
    this.audio.playTone(659, 0.12, 'triangle');
    this.particles.showFloatingText('🟢 GREEN LIGHT: RUN!', this.trophyX, 150, '#10B981', 20);
  }

  private triggerYellowPhase(): void {
    this.sentryPhase = 'yellow';
    // Variable yellow warning: 0.5s - 0.85s
    const yellowDur = 0.5 + Math.random() * 0.35;
    this.phaseTimer = yellowDur;
    this.currentPhaseDuration = yellowDur;
    this.currentYellowDuration = yellowDur;
    this.warningBeepTimer = 0;
    this.particles.showFloatingText('⚠️ YELLOW LIGHT: BRAKE!', this.trophyX, 150, '#F59E0B', 20);
  }

  private triggerRedPhase(): void {
    this.sentryPhase = 'red';
    // Variable red light freeze scan: 1.5s - 3.0s
    const redDur = 1.5 + Math.random() * 1.5;
    this.phaseTimer = redDur;
    this.currentPhaseDuration = redDur;
    this.audio.playTone(130, 0.3, 'sawtooth');
    this.particles.addTrauma(0.28);
    this.particles.showFloatingText('🛑 RED LIGHT: FREEZE!', this.trophyX, 150, '#EF4444', 24);
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    if (this.zappedLaserBeam) {
      this.zappedLaserBeam.timer -= dt;
      if (this.zappedLaserBeam.timer <= 0) {
        this.zappedLaserBeam = null;
      }
    }

    // Update Sentry Light State Machine
    this.phaseTimer -= dt;

    if (this.sentryPhase === 'green') {
      this.sentryAngle += dt * 1.2;
      if (this.phaseTimer <= 0) {
        this.triggerYellowPhase();
      }
    } else if (this.sentryPhase === 'yellow') {
      // Rapid spinning eye with pitch-accelerating warning beeps
      this.sentryAngle += dt * 6.5;
      this.warningBeepTimer -= dt;
      if (this.warningBeepTimer <= 0) {
        const progress = 1 - Math.max(0, this.phaseTimer / this.currentYellowDuration);
        this.audio.playTone(480 + progress * 240, 0.07, 'sawtooth');
        this.warningBeepTimer = Math.max(0.1, 0.22 - progress * 0.1);
      }

      if (this.phaseTimer <= 0) {
        this.triggerRedPhase();
      }
    } else if (this.sentryPhase === 'red') {
      // Red light scan: sweeping searchlight angle
      this.laserSweepAngle += dt * 2.8;
      this.sentryAngle = Math.sin(this.laserSweepAngle) * 0.7;

      if (this.phaseTimer <= 0) {
        this.triggerGreenPhase();
      }
    }

    // Process Runner Movement & Laser Detection
    for (const r of this.runners.values()) {
      if (r.hasFinished) continue;

      if (r.stunTimer > 0) {
        r.stunTimer -= dt;
        r.isRunning = false;
        continue;
      }

      // Check player holding corner button
      const isHolding = this.input.isPressed(r.id);
      r.isRunning = isHolding;

      if (isHolding) {
        if (this.sentryPhase === 'red') {
          // CAUGHT MOVING DURING RED LIGHT! SENTRY LASER STRIKE!
          r.stunTimer = 1.1;
          r.isRunning = false;
          // Knockback toward start
          r.x -= r.dir * 95;
          if (r.dir === 1) r.x = Math.max(r.startX, r.x);
          else r.x = Math.min(r.startX, r.x);

          this.zappedLaserBeam = { x: r.x, y: r.y, timer: 0.25 };
          this.audio.playExplosion();
          this.audio.playLaser();
          this.particles.showFloatingText('ZAPPED! -95m! ⚡', r.x, r.y - 30, '#EF4444', 22);
          this.particles.spawnSparks(r.x, r.y, '#EF4444', 24);
          this.particles.addTrauma(0.35);
        } else {
          // Safe to run!
          r.x += r.dir * r.speed * dt;
          r.runAnim += dt * 14;

          // Spawn running dust puffs
          if (Math.random() < 0.2) {
            this.particles.spawnSparks(r.x - r.dir * 12, r.y + 12, 'rgba(255,255,255,0.4)', 3);
          }

          // Check if crossed trophy line
          const distToFinish = (this.trophyX - r.x) * r.dir;
          if (distToFinish <= 0) {
            r.hasFinished = true;
            r.x = this.trophyX - r.dir * 10;
            this.audio.playFanfare();
            this.particles.showFloatingText('TROPHY REACHED! 🏆', r.x, r.y - 45, '#F59E0B', 26);
            this.particles.spawnSparks(this.trophyX, r.y, '#FBBF24', 35);
            this.isFinished = true;
          }
        }
      }
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
    const r = this.runners.get(botId);
    if (!r || r.hasFinished || r.stunTimer > 0) {
      this.input.setBotInput(botId, false);
      return;
    }

    if (this.sentryPhase === 'green') {
      // All bots sprint during green light
      this.input.setBotInput(botId, true);
    } else if (this.sentryPhase === 'yellow') {
      if (difficulty === 'bot_hard') {
        // Hard bot pushes sprint until last 0.12s of yellow, then safely stops
        if (this.phaseTimer > 0.12) {
          this.input.setBotInput(botId, true);
        } else {
          this.input.setBotInput(botId, false);
        }
      } else if (difficulty === 'bot_normal') {
        // Normal bot stops roughly halfway through yellow
        if (this.phaseTimer > this.currentYellowDuration * 0.45) {
          this.input.setBotInput(botId, true);
        } else {
          this.input.setBotInput(botId, false);
        }
      } else {
        // Easy bot gets greedy and frequently overstays into red light
        if (this.phaseTimer > this.currentYellowDuration * 0.2 || Math.random() < 0.25) {
          this.input.setBotInput(botId, true);
        } else {
          this.input.setBotInput(botId, false);
        }
      }
    } else {
      // Red phase
      if (difficulty === 'bot_easy' && Math.random() < 0.03) {
        // Easy bot occasionally twitches and gets zapped
        this.input.setBotInput(botId, true);
      } else {
        this.input.setBotInput(botId, false);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. High-Tech Industrial Stealth Arena Flooring
    const floorGrad = ctx.createLinearGradient(0, 0, 0, height);
    floorGrad.addColorStop(0, '#0F172A');
    floorGrad.addColorStop(0.5, '#1E293B');
    floorGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, 0, width, height);

    // Running Track Lanes
    for (const r of this.runners.values()) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fillRect(0, r.y - 25, width, 50);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, r.y + 25);
      ctx.lineTo(width, r.y + 25);
      ctx.stroke();
    }

    // 2. Center Trophy Line
    ctx.save();
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(this.trophyX, 80);
    ctx.lineTo(this.trophyX, height - 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // Golden Trophy Pedestal in Center
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(this.trophyX, height / 2, 28, 0, Math.PI * 2);
    ctx.fill();

    // Procedural Vector Gold Trophy Cup
    const tX = this.trophyX;
    const tY = height / 2;
    ctx.save();
    ctx.fillStyle = '#FEF08A';
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 1.5;

    // Cup cup body
    ctx.beginPath();
    ctx.moveTo(tX - 10, tY - 11);
    ctx.lineTo(tX + 10, tY - 11);
    ctx.lineTo(tX + 8, tY + 2);
    ctx.quadraticCurveTo(tX, tY + 8, tX - 8, tY + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cup stem & base
    ctx.fillRect(tX - 2.5, tY + 7, 5, 5);
    ctx.fillRect(tX - 8, tY + 12, 16, 3);

    // Cup handles
    ctx.beginPath();
    ctx.arc(tX - 10, tY - 4, 4, Math.PI * 0.5, Math.PI * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tX + 10, tY - 4, 4, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();
    ctx.restore();
    ctx.restore();

    // 3. Sentry Watchtower at Top Center
    const sentryX = width / 2;
    const sentryY = 105;

    ctx.save();
    // Tower base
    ctx.fillStyle = '#334155';
    ctx.fillRect(sentryX - 30, 48, 60, 48);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(sentryX - 30, 48, 60, 48);

    // Sentry Eye Housing Dome
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(sentryX, sentryY, 26, 0, Math.PI * 2);
    ctx.fill();

    // Sentry Scanning Light Color
    let eyeColor = '#10B981'; // Green
    let glowColor = 'rgba(16, 185, 129, 0.3)';
    let phaseText = 'GREEN LIGHT: SPRINT!';

    if (this.sentryPhase === 'yellow') {
      eyeColor = '#F59E0B';
      glowColor = 'rgba(245, 158, 11, 0.4)';
      phaseText = 'YELLOW LIGHT: WARNING!';
    } else if (this.sentryPhase === 'red') {
      eyeColor = '#EF4444';
      glowColor = 'rgba(239, 68, 68, 0.55)';
      phaseText = 'RED LIGHT: FREEZE STATUE!';
    }

    // Sentry Spotlight Cone
    ctx.save();
    const coneAngle = Math.PI * 0.4;
    const coneLength = height * 0.85;
    const startAng = Math.PI / 2 - coneAngle / 2;
    const endAng = Math.PI / 2 + coneAngle / 2;

    const coneGrad = ctx.createRadialGradient(sentryX, sentryY, 10, sentryX, sentryY, coneLength);
    coneGrad.addColorStop(0, glowColor);
    coneGrad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(sentryX, sentryY);
    ctx.arc(sentryX, sentryY, coneLength, startAng, endAng);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Sentry Eye Glowing Pupil
    ctx.save();
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 18;
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(sentryX, sentryY, 14, 0, Math.PI * 2);
    ctx.fill();

    // Inner mechanical iris
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(sentryX, sentryY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Sentry Status Banner
    ctx.fillStyle = eyeColor;
    ctx.font = '900 22px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(phaseText, sentryX, 150);

    // Dynamic Sentry Phase Progress Indicator Bar
    const barW = 160;
    const barH = 6;
    const barX = sentryX - barW / 2;
    const barY = 162;
    const progress = Math.max(0, Math.min(1, this.phaseTimer / this.currentPhaseDuration));

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 3);
    ctx.fill();

    ctx.fillStyle = eyeColor;
    ctx.shadowColor = eyeColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * progress, barH, 3);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 13px sans-serif';
    ctx.fillText('Hold corner button to run • Release to freeze before Red Light scans!', sentryX, 186);

    // Active Sweeping Scanning Lasers during Red Light
    if (this.sentryPhase === 'red') {
      const sweepOffsets = [-0.25, 0.25];
      for (const off of sweepOffsets) {
        const sweepAngle = Math.PI / 2 + this.sentryAngle + off;
        const targetX = sentryX + Math.cos(sweepAngle) * height;
        const targetY = sentryY + Math.sin(sweepAngle) * height;

        ctx.save();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(sentryX, sentryY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // High-intensity perimeter alert border
      ctx.save();
      const pulseAlpha = 0.3 + Math.sin(performance.now() * 0.02) * 0.2;
      ctx.strokeStyle = `rgba(239, 68, 68, ${pulseAlpha})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, width - 4, height - 4);
      ctx.restore();
    }

    // Direct High-Voltage Zap Lightning Bolt
    if (this.zappedLaserBeam) {
      ctx.save();
      ctx.strokeStyle = '#EF4444';
      ctx.shadowColor = '#EF4444';
      ctx.shadowBlur = 16;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sentryX, sentryY);

      // Jagged lightning segments
      const steps = 6;
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const lx = sentryX + (this.zappedLaserBeam.x - sentryX) * t + (Math.random() - 0.5) * 16;
        const ly = sentryY + (this.zappedLaserBeam.y - sentryY) * t + (Math.random() - 0.5) * 16;
        ctx.lineTo(lx, ly);
      }
      ctx.lineTo(this.zappedLaserBeam.x, this.zappedLaserBeam.y);
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // 4. Render Runners
    for (const r of this.runners.values()) {
      this.renderRunner(ctx, r);
    }

    ctx.restore();
  }

  private renderRunner(ctx: CanvasRenderingContext2D, r: Runner): void {
    const p = this.players[r.id];

    ctx.save();
    ctx.translate(r.x, r.y);

    // Runner shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 16, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bobbing / Leg swing animation
    const bob = r.isRunning ? Math.sin(r.runAnim) * 3 : 0;
    const legSwing = r.isRunning ? Math.sin(r.runAnim) * 12 : 0;

    // Legs
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // Left leg
    ctx.beginPath();
    ctx.moveTo(-4, 0 + bob);
    ctx.lineTo(-4 - legSwing * r.dir, 14);
    ctx.stroke();

    // Right leg
    ctx.beginPath();
    ctx.moveTo(4, 0 + bob);
    ctx.lineTo(4 + legSwing * r.dir, 14);
    ctx.stroke();

    // Torso / Jersey
    ctx.fillStyle = p.color;
    ctx.fillRect(-10, -18 + bob, 20, 20);

    // Number tag on jersey
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${r.id + 1}`, 0, -4 + bob);

    // Head
    ctx.fillStyle = '#FED7AA';
    ctx.beginPath();
    ctx.arc(0, -26 + bob, 9, 0, Math.PI * 2);
    ctx.fill();

    // Athletic Sweatband
    ctx.fillStyle = p.colorDark;
    ctx.fillRect(-9, -30 + bob, 18, 4);

    // Stunned indicator
    if (r.stunTimer > 0) {
      ctx.fillStyle = '#EF4444';
      ctx.font = '900 13px Montserrat, sans-serif';
      ctx.fillText('ZAPPED!', 0, -40);
    }

    // Name label
    ctx.fillStyle = p.color;
    ctx.font = '800 12px Montserrat, sans-serif';
    ctx.fillText(p.name.toUpperCase(), 0, 32);

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    // Sort by who reached finish or closest distance to center
    const sorted = [...active].sort((a, b) => {
      const ra = this.runners.get(a.id);
      const rb = this.runners.get(b.id);
      if (!ra || !rb) return 0;
      if (ra.hasFinished && !rb.hasFinished) return -1;
      if (rb.hasFinished && !ra.hasFinished) return 1;

      const distA = Math.abs(this.trophyX - ra.x);
      const distB = Math.abs(this.trophyX - rb.x);
      return distA - distB;
    });

    const winner = sorted[0];
    const rWin = this.runners.get(winner.id);

    return {
      winnerId: winner.id,
      rankings: sorted.map((p, i) => {
        const r = this.runners.get(p.id);
        const dist = r ? Math.round(Math.abs(this.trophyX - r.x)) : 0;
        return {
          playerId: p.id,
          score: r?.hasFinished ? 100 : Math.max(0, 100 - dist),
          place: i + 1
        };
      }),
      mvpHighlight: rWin?.hasFinished
        ? `${winner.name} dashed across the finish line under the Sentry's gaze!`
        : `${winner.name} got closest to the trophy before time expired!`
    };
  }
}
