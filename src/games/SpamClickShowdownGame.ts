import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface FizzyBubble {
  x: number;
  y: number;
  radius: number;
  speed: number;
  wobbleOffset: number;
  alpha: number;
}

interface ClickerPlayer {
  id: PlayerId;
  color: string;
  name: string;
  x: number;
  y: number;
  laneX: number;
  laneWidth: number;
  pressure: number; // 0 to 1000 PSI
  targetPressure: number;
  totalClicks: number;
  clickTimestamps: number[];
  cps: number; // Clicks per second
  maxCps: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  overdrive: boolean;
  overdriveTimer: number;
  hasPopped: boolean;
  blastoffY: number;
  blastoffSpeed: number;
  bubbles: FizzyBubble[];
  botClickTimer: number;
  botBurstCount: number;
  botTargetCps: number;
}

export class SpamClickShowdownGame extends BaseGame {
  private playersState: Map<PlayerId, ClickerPlayer> = new Map();
  private maxPressure: number = 1000;
  private winnerId: PlayerId | null = null;
  private blastoffSequence: boolean = false;
  private celebrationTimer: number = 0;
  private stageLightsPhase: number = 0;
  private rhythmPhase: number = 0;
  private clickListener: ((e: MouseEvent) => void) | null = null;

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
    this.roundTimer = 25.0; // 25-second fast-paced showdown
    this.winnerId = null;
    this.blastoffSequence = false;
    this.celebrationTimer = 0;
    this.stageLightsPhase = 0;
    this.rhythmPhase = 0;

    // Set control mode to single_button for rapid tap responsiveness
    this.input.setControlMode('single_button');

    this.initPlayers(width, height);
    this.bindMouseClickListener();
    this.syncDebug();
  }

  private initPlayers(width: number, height: number): void {
    this.playersState.clear();
    const active = this.getActivePlayers();
    const count = active.length;
    const laneWidth = width / count;

    active.forEach((p, idx) => {
      const laneX = idx * laneWidth;
      const centerX = laneX + laneWidth / 2;
      const bottleY = height - 145;

      const bubbles: FizzyBubble[] = [];
      for (let b = 0; b < 24; b++) {
        bubbles.push({
          x: (Math.random() - 0.5) * 56,
          y: Math.random() * 140,
          radius: 2 + Math.random() * 4.5,
          speed: 35 + Math.random() * 65,
          wobbleOffset: Math.random() * Math.PI * 2,
          alpha: 0.35 + Math.random() * 0.55
        });
      }

      // Configure bot target CPS by difficulty
      let targetCps = 5.0;
      if (p.type === 'bot_easy') targetCps = 4.5 + Math.random() * 1.5;
      else if (p.type === 'bot_normal') targetCps = 7.6 + Math.random() * 1.8;
      else if (p.type === 'bot_hard') targetCps = 11.5 + Math.random() * 2.2;

      this.playersState.set(p.id, {
        id: p.id,
        color: p.color,
        name: `Player ${Number(p.id) + 1}`,
        x: centerX,
        y: bottleY,
        laneX,
        laneWidth,
        pressure: 0,
        targetPressure: 0,
        totalClicks: 0,
        clickTimestamps: [],
        cps: 0,
        maxCps: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        overdrive: false,
        overdriveTimer: 0,
        hasPopped: false,
        blastoffY: bottleY,
        blastoffSpeed: 0,
        bubbles,
        botClickTimer: 0.1,
        botBurstCount: 0,
        botTargetCps: targetCps
      });
    });
  }

  private bindMouseClickListener(): void {
    if (this.clickListener && typeof window !== 'undefined') {
      window.removeEventListener('mousedown', this.clickListener);
      this.clickListener = null;
    }

    if (typeof window !== 'undefined') {
      this.clickListener = (e: MouseEvent) => {
        if (this.isFinished || this.blastoffSequence) return;
        const canvas = this.input.getCanvas();
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (mouseX < 0 || mouseX > rect.width || mouseY < 0 || mouseY > rect.height) {
          return;
        }

        const active = this.getActivePlayers();
        // In 1-player mode (P1 vs bots): any mouse click on canvas pumps Player 1
        if (active.length <= 2 && active.filter(p => !p.type.startsWith('bot_')).length === 1) {
          const human = active.find(p => !p.type.startsWith('bot_'));
          if (human) {
            this.registerClick(human.id);
            return;
          }
        }

        // Multi-player local mouse clicking: match clicked column / lane
        for (const p of active) {
          const ps = this.playersState.get(p.id);
          if (ps && !p.type.startsWith('bot_')) {
            if (mouseX >= ps.laneX && mouseX <= ps.laneX + ps.laneWidth) {
              this.registerClick(p.id);
              break;
            }
          }
        }
      };

      window.addEventListener('mousedown', this.clickListener);
    }
  }

  public registerClick(pid: PlayerId): void {
    if (this.isFinished || this.blastoffSequence) return;

    const ps = this.playersState.get(pid);
    if (!ps || ps.hasPopped) return;

    const now = performance.now() / 1000;
    ps.totalClicks++;
    ps.clickTimestamps.push(now);

    // Filter clicks within the last 1.0s window for real-time CPS
    ps.clickTimestamps = ps.clickTimestamps.filter((t) => now - t <= 1.0);
    ps.cps = ps.clickTimestamps.length;
    if (ps.cps > ps.maxCps) ps.maxCps = ps.cps;

    // Check overdrive threshold (>= 8 CPS)
    if (ps.cps >= 8) {
      ps.overdrive = true;
      ps.overdriveTimer = 0.6;
    }

    // Check Underdog Surge & Sweet-Spot Rhythm Beat (72% - 98%)
    let maxP = 0;
    for (const other of this.playersState.values()) {
      if (other.targetPressure > maxP) maxP = other.targetPressure;
    }
    const isUnderdog = maxP - ps.targetPressure >= 220;
    const inSweetBeat = this.rhythmPhase >= 0.72 && this.rhythmPhase <= 0.98;

    // Pressure gain per click
    const baseGain = 14;
    const bonus = (ps.overdrive ? 1.35 : 1.0) * (isUnderdog ? 1.25 : 1.0) * (inSweetBeat ? 1.45 : 1.0);
    const addedPressure = baseGain * bonus;
    ps.targetPressure = Math.min(this.maxPressure, ps.targetPressure + addedPressure);

    // Every 8th click in Sweet-Spot Beat unleashes a Fizz-Wave Shunt on rivals!
    if (inSweetBeat && ps.totalClicks % 8 === 0) {
      for (const rival of this.playersState.values()) {
        if (rival.id !== ps.id && !rival.hasPopped && rival.targetPressure > 40) {
          rival.targetPressure = Math.max(0, rival.targetPressure - 18);
          rival.rotation = (Math.random() - 0.5) * 0.35;
        }
      }
      this.particles.showFloatingText('⚡ FIZZ-WAVE SHUNT!', ps.x, ps.y - 165, '#38BDF8', 16);
    }

    // Punchy squash & stretch feedback
    ps.scaleY = 0.72;
    ps.scaleX = 1.28;
    ps.rotation = (Math.random() - 0.5) * 0.16;

    // Visual fizz & steam bursts
    const neckY = ps.y - 120;
    this.particles.spawnDust(ps.x + (Math.random() - 0.5) * 20, neckY, 4);
    if (ps.overdrive || inSweetBeat) {
      this.particles.spawnSparks(ps.x, neckY, '#F59E0B', 5);
      this.audio.playLaser();
    } else {
      this.audio.playBounce();
    }

    // Check Pop / Win Condition!
    if (ps.targetPressure >= this.maxPressure && !this.blastoffSequence) {
      this.triggerBlastoff(ps);
    }
  }

  private triggerBlastoff(winner: ClickerPlayer): void {
    this.blastoffSequence = true;
    this.winnerId = winner.id;
    winner.hasPopped = true;
    winner.blastoffSpeed = -480;

    // Big explosion effects & fanfare
    this.particles.shake(0.6);
    this.particles.spawnExplosion(winner.x, winner.y - 120, winner.color, 35);
    this.particles.spawnConfetti(winner.x, winner.y - 100, 60);
    this.particles.showFloatingText('1000 PSI! BLASTOFF! 🚀', winner.x, winner.y - 150, '#10B981', 34);
    this.audio.playExplosion();
    this.audio.playFanfare();

    this.celebrationTimer = 2.8;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.stageLightsPhase += dt * 3.5;
    this.rhythmPhase = (this.rhythmPhase + dt * 1.1) % 1.0;

    // Update Bots via BaseGame
    this.updateBots(dt, width, height);

    // Read human player inputs
    for (const p of this.getActivePlayers()) {
      if (p.type.startsWith('bot_')) continue;

      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      const justUp = this.input.justUp(p.id);

      if (justAction || justUp) {
        this.input.consumeAction(p.id);
        this.registerClick(p.id);
      }
    }

    // Update Clicker Players
    const now = performance.now() / 1000;
    for (const ps of this.playersState.values()) {
      // Smooth pressure interpolation
      ps.pressure += (ps.targetPressure - ps.pressure) * 12 * dt;

      // Decay CPS when not clicking
      ps.clickTimestamps = ps.clickTimestamps.filter((t) => now - t <= 1.0);
      ps.cps = ps.clickTimestamps.length;

      // Overdrive timer countdown
      if (ps.overdriveTimer > 0) {
        ps.overdriveTimer -= dt;
        if (ps.overdriveTimer <= 0) ps.overdrive = false;
      }

      // Elastic recovery from squash/stretch
      ps.scaleX += (1 - ps.scaleX) * 14 * dt;
      ps.scaleY += (1 - ps.scaleY) * 14 * dt;
      ps.rotation += (0 - ps.rotation) * 12 * dt;

      // Update internal fizz bubbles
      for (const b of ps.bubbles) {
        b.y -= b.speed * (1 + (ps.pressure / this.maxPressure) * 1.5) * dt;
        if (b.y < 0) {
          b.y = 135;
          b.x = (Math.random() - 0.5) * 52;
        }
      }

      // Handle rocket blastoff animation
      if (ps.hasPopped) {
        ps.blastoffSpeed -= 1100 * dt; // Accelerate skyward
        ps.blastoffY += ps.blastoffSpeed * dt;

        // Exhaust smoke & flame trail
        this.particles.spawnDust(ps.x + (Math.random() - 0.5) * 16, ps.blastoffY + 40, 3);
        if (Math.random() < 0.4) {
          this.particles.spawnSparks(ps.x, ps.blastoffY + 45, '#FBBF24', 4);
        }
      }
    }

    // Handle celebration / showdown timer
    if (this.blastoffSequence) {
      this.celebrationTimer -= dt;
      if (this.celebrationTimer <= 0) {
        this.isFinished = true;
      }
    } else {
      this.roundTimer = Math.max(0, this.roundTimer - dt);
      if (this.roundTimer <= 0) {
        // Time expired: player with the highest pressure wins and blasts off!
        let highestPressure = -1;
        let topPlayer: ClickerPlayer | null = null;
        for (const ps of this.playersState.values()) {
          if (ps.pressure > highestPressure) {
            highestPressure = ps.pressure;
            topPlayer = ps;
          }
        }
        if (topPlayer) {
          this.triggerBlastoff(topPlayer);
        } else {
          this.isFinished = true;
        }
      }
    }

    this.syncDebug();
  }

  public syncDebug(): void {
    if (typeof window !== 'undefined') {
      (window as any).__SPAM_CLICK_DEBUG__ = {
        players: Array.from(this.playersState.values()),
        roundTimer: this.roundTimer,
        isFinished: this.isFinished,
        winnerId: this.winnerId,
        blastoffSequence: this.blastoffSequence,
        triggerClick: (pid: PlayerId) => this.registerClick(pid)
      };
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.hasPopped || this.blastoffSequence || this.isFinished) return;

    ps.botClickTimer -= dt;
    if (ps.botClickTimer <= 0) {
      this.registerClick(botId);

      // Realistic human mashing cadence with fatigue and burst variation
      const baseInterval = 1.0 / ps.botTargetCps;
      const jitter = (Math.random() - 0.5) * baseInterval * 0.45;
      ps.botClickTimer = Math.max(0.04, baseInterval + jitter);

      // Occasional burst speedup
      ps.botBurstCount++;
      if (ps.botBurstCount > 12) {
        ps.botBurstCount = 0;
        if (difficulty === 'bot_hard' && Math.random() < 0.65) {
          // Hard bot bursts into overdrive!
          ps.botClickTimer = 0.055;
        } else if (difficulty === 'bot_easy' && Math.random() < 0.3) {
          // Easy bot momentarily pauses
          ps.botClickTimer = 0.28;
        }
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const rankings = active
      .map((p) => {
        const ps = this.playersState.get(p.id);
        const score = ps ? Math.round(ps.pressure) : 0;
        return { playerId: p.id, score, place: 1 };
      })
      .sort((a, b) => b.score - a.score);

    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });

    const winnerId = this.winnerId ?? (rankings.length > 0 ? rankings[0].playerId : null);
    const winPs = winnerId !== null ? this.playersState.get(winnerId) : null;
    const maxCps = winPs ? winPs.maxCps : 0;

    let mvpHighlight = 'Spam Click King!';
    if (winnerId !== null) {
      mvpHighlight = `Player ${Number(winnerId) + 1} blasted off at ${maxCps} CPS!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Festive Stadium Night Sky Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#090D16');
    bgGrad.addColorStop(0.55, '#131B2E');
    bgGrad.addColorStop(1, '#0B0F19');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Animated Stage Floodlights
    this.renderStageLights(ctx, width, height);

    // 3. Lane Dividers & Launchpads
    const active = this.getActivePlayers();
    const count = active.length;
    const laneW = width / count;

    for (let i = 0; i < count; i++) {
      const lx = i * laneW;

      // Subtle Lane Glow
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.12)';
      ctx.fillRect(lx, 80, laneW, height - 80);

      // Vertical Lane Grid Line
      if (i > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(lx, 85);
        ctx.lineTo(lx, height - 30);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 4. Render Launchpad Platforms & Pressurized Bottles
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (ps) {
        this.renderPlayerStation(ctx, ps, height);
      }
    }

    // 5. Header HUD: Title & Countdown Timer
    this.renderHeaderHUD(ctx, width);
  }

  private renderStageLights(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const lightCount = 4;
    for (let l = 0; l < lightCount; l++) {
      const originX = (width / (lightCount + 1)) * (l + 1);
      const sweepAngle = Math.sin(this.stageLightsPhase + l * 1.5) * 0.35;

      ctx.save();
      ctx.translate(originX, 0);
      ctx.rotate(sweepAngle);

      const lightGrad = ctx.createRadialGradient(0, 0, 5, 0, height * 0.7, 180);
      lightGrad.addColorStop(0, 'rgba(56, 189, 248, 0.18)');
      lightGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.06)');
      lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = lightGrad;
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.lineTo(15, 0);
      ctx.lineTo(140, height);
      ctx.lineTo(-140, height);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
    ctx.restore();
  }

  private renderPlayerStation(ctx: CanvasRenderingContext2D, ps: ClickerPlayer, height: number): void {
    const cx = ps.x;
    const baseGroundY = height - 50;

    // Platform Base
    ctx.save();
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.roundRect(cx - 65, baseGroundY, 130, 24, [6, 6, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = ps.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Player Color Indicator Strip
    ctx.fillStyle = ps.color;
    ctx.fillRect(cx - 50, baseGroundY + 16, 100, 4);

    // Overdrive Electric Aura
    if (ps.overdrive) {
      ctx.save();
      const auraPulse = 1 + Math.sin(performance.now() * 0.02) * 0.08;
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.ellipse(cx, ps.blastoffY - 60, 48 * auraPulse, 90 * auraPulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Draw Bottle / Rocket Body
    ctx.save();
    ctx.translate(cx, ps.blastoffY);
    ctx.scale(ps.scaleX, ps.scaleY);
    ctx.rotate(ps.rotation);

    const bW = 68;
    const bH = 135;
    const neckW = 28;
    const neckH = 34;
    const capH = 14;

    // Bottle Outer Glass Outline
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.strokeStyle = ps.overdrive ? '#F59E0B' : '#FFFFFF';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    // Neck
    ctx.rect(-neckW / 2, -bH - neckH, neckW, neckH);
    // Main Body
    ctx.roundRect(-bW / 2, -bH, bW, bH, [12, 12, 16, 16]);
    ctx.fill();
    ctx.stroke();

    // Internal Pressurized Liquid Fill (Height based on Pressure)
    const fillPercent = Math.min(1.0, ps.pressure / this.maxPressure);
    const liquidH = (bH - 8) * fillPercent;

    if (liquidH > 2) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-bW / 2 + 4, -liquidH - 4, bW - 8, liquidH, [4, 4, 12, 12]);
      ctx.clip();

      // Liquid Gradient
      const liqGrad = ctx.createLinearGradient(0, -bH, 0, 0);
      liqGrad.addColorStop(0, '#FFFFFF');
      liqGrad.addColorStop(0.25, ps.color);
      liqGrad.addColorStop(1, '#0F172A');
      ctx.fillStyle = liqGrad;
      ctx.fill();

      // Internal Fizz Bubbles
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      for (const b of ps.bubbles) {
        if (b.y <= liquidH) {
          ctx.beginPath();
          const bx = b.x + Math.sin(performance.now() * 0.005 + b.wobbleOffset) * 4;
          ctx.arc(bx, -b.y - 4, b.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Foam Crest Wave
      const waveOffset = Math.sin(performance.now() * 0.008) * 3;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.ellipse(0, -liquidH - 4 + waveOffset, (bW - 10) / 2, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Bottle Cap / Cork
    if (!ps.hasPopped) {
      const capVibrate = (ps.pressure / this.maxPressure) * 3 * (Math.random() - 0.5);
      ctx.fillStyle = '#EF4444';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-neckW / 2 - 3 + capVibrate, -bH - neckH - capH, neckW + 6, capH, 3);
      ctx.fill();
      ctx.stroke();
    }

    // Glass Specular Sheen (2.5D tactile shine)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.beginPath();
    ctx.roundRect(-bW / 2 + 6, -bH + 6, 8, bH - 16, 4);
    ctx.fill();

    // Character Mascot Face on Bottle Label
    this.drawPlayerMascot(
      ctx,
      ps.id,
      0,
      -bH * 0.48,
      17,
      ps.overdrive ? 'happy' : 'idle',
      performance.now() * 0.001
    );

    ctx.restore(); // restore bottle transform

    // 6. Draw Player HUD (Pressure Gauge, CPS, Pump Counter)
    this.renderPlayerHUD(ctx, ps, cx, baseGroundY);
    ctx.restore();
  }

  private renderPlayerHUD(ctx: CanvasRenderingContext2D, ps: ClickerPlayer, cx: number, baseY: number): void {
    const cardY = baseY - 245;

    // PSI Progress Meter Bar
    const barW = 100;
    const barH = 14;
    const barX = cx - barW / 2;
    const barY = cardY;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const fillRatio = Math.min(1.0, ps.pressure / this.maxPressure);
    if (fillRatio > 0.01) {
      const meterGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      meterGrad.addColorStop(0, '#10B981');
      meterGrad.addColorStop(0.55, '#F59E0B');
      meterGrad.addColorStop(1, '#EF4444');

      ctx.fillStyle = meterGrad;
      ctx.beginPath();
      ctx.roundRect(barX + 2, barY + 2, (barW - 4) * fillRatio, barH - 4, 5);
      ctx.fill();
    }

    // PSI Numeric Readout
    ctx.font = '800 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = fillRatio > 0.85 ? '#EF4444' : '#F8FAFC';
    ctx.fillText(`${Math.round(ps.pressure)} PSI`, cx, barY - 6);

    // Speedometer CPS Badge
    const cpsBadgeY = barY + 26;
    let badgeText = `${ps.cps} CPS`;
    let badgeColor = '#94A3B8';

    if (ps.cps >= 15) {
      badgeText = `${ps.cps} CPS • GODLIKE! 🌌`;
      badgeColor = '#38BDF8';
    } else if (ps.cps >= 12) {
      badgeText = `${ps.cps} CPS • SUPERSONIC! ⚡`;
      badgeColor = '#A855F7';
    } else if (ps.cps >= 8) {
      badgeText = `${ps.cps} CPS • OVERDRIVE! 🔥`;
      badgeColor = '#F59E0B';
    } else if (ps.cps >= 4) {
      badgeText = `${ps.cps} CPS • FAST 💨`;
      badgeColor = '#10B981';
    } else {
      badgeText = `${ps.cps} CPS • SPAM CLICK!`;
      badgeColor = '#CBD5E1';
    }

    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.fillStyle = badgeColor;
    ctx.fillText(badgeText, cx, cpsBadgeY);

    // Total Pumps Badge
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText(`PUMPS: ${ps.totalClicks}`, cx, cpsBadgeY + 16);

    // Player Identification Pill
    const pillY = baseY + 36;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.roundRect(cx - 45, pillY, 90, 22, 11);
    ctx.fill();
    ctx.strokeStyle = ps.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '800 11px Inter, system-ui, sans-serif';
    ctx.fillStyle = ps.color;
    ctx.fillText(ps.name, cx, pillY + 15);
  }

  private renderHeaderHUD(ctx: CanvasRenderingContext2D, width: number): void {
    const bannerW = Math.min(420, width - 40);
    const bannerH = 46;
    const bannerX = width / 2 - bannerW / 2;
    const bannerY = 56;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Title Prompt
    ctx.font = '900 14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText('SPAM CLICK SHOWDOWN!', bannerX + 16, bannerY + 28);

    // Timer Display
    ctx.font = '800 14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    const timerColor = this.roundTimer < 6 ? '#EF4444' : '#F1F5F9';
    ctx.fillStyle = timerColor;
    ctx.fillText(`TIME: ${this.roundTimer.toFixed(1)}s`, bannerX + bannerW - 16, bannerY + 28);

    ctx.restore();
  }

  public override destroy(): void {
    super.destroy();
    if (this.clickListener && typeof window !== 'undefined') {
      window.removeEventListener('mousedown', this.clickListener);
      this.clickListener = null;
    }
  }
}
