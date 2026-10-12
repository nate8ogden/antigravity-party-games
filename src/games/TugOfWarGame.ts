import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface TugPlayer {
  id: PlayerId;
  team: 'LEFT' | 'RIGHT';
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  needle: number; // 0 to 1
  needleDir: number; // 1 or -1
  needleSpeed: number;
  pullAnim: number; // 0 to 1
  slipAnim: number; // 0 to 1
  pullCount: number;
  perfectCount: number;
  slipCount: number;
  inPit: boolean;
  botReactionTimer: number;
  botTargetOffset: number;
  botCooldown: number;
  botHesitating: boolean;
}

export class TugOfWarGame extends BaseGame {
  private playersState: Map<PlayerId, TugPlayer> = new Map();
  private currentMapName: string = 'Mud Sludge Pit';
  private ropeOffset: number = 0; // -1 (far left win) to +1 (far right win)
  private ropeTension: number = 1.0;
  private winThreshold: number = 0.85; // ropeOffset threshold
  private pitLeftX: number = 0;
  private pitRightX: number = 0;
  private pitTopY: number = 0;
  private pitBottomY: number = 0;
  private winningTeam: 'LEFT' | 'RIGHT' | null = null;

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
    this.ropeOffset = 0;
    this.ropeTension = 1.0;
    this.winningTeam = null;

    const pitWidth = Math.min(220, width * 0.28);
    this.pitLeftX = width / 2 - pitWidth / 2;
    this.pitRightX = width / 2 + pitWidth / 2;
    this.pitTopY = height * 0.42;
    this.pitBottomY = height - 30;

    this.generateProceduralMap();
    this.initPlayers(width, height);
  }

  private generateProceduralMap(): void {
    const maps = [
      'Mud Sludge Pit',
      'Molten Lava Trench',
      'Cyber Void',
      'Ice Crevasse'
    ];
    this.currentMapName = maps[Math.floor(Math.random() * maps.length)];
  }

  private initPlayers(width: number, height: number): void {
    this.playersState.clear();
    const active = this.getActivePlayers();
    const count = active.length;

    // Team assignment: P1 (Left), P2 (Right), P3 (Left), P4 (Right)
    const centerY = height * 0.58;

    active.forEach((p, idx) => {
      const isLeft = idx % 2 === 0;
      const team: 'LEFT' | 'RIGHT' = isLeft ? 'LEFT' : 'RIGHT';

      // Position along platform
      let px: number;
      let py: number;

      if (count === 2) {
        px = isLeft ? this.pitLeftX - 100 : this.pitRightX + 100;
        py = centerY;
      } else {
        // Multi-player staggered team tuggers
        const rank = Math.floor(idx / 2); // 0 or 1
        px = isLeft
          ? this.pitLeftX - 70 - rank * 85
          : this.pitRightX + 70 + rank * 85;
        py = centerY + (rank === 0 ? -22 : 22);
      }

      this.playersState.set(p.id, {
        id: p.id,
        team,
        x: px,
        y: py,
        baseX: px,
        baseY: py,
        needle: 0.1 + Math.random() * 0.8,
        needleDir: Math.random() < 0.5 ? 1 : -1,
        needleSpeed: 1.8 + (idx % 2) * 0.2,
        pullAnim: 0,
        slipAnim: 0,
        pullCount: 0,
        perfectCount: 0,
        slipCount: 0,
        inPit: false,
        botReactionTimer: 0.2 + idx * 0.1,
        botTargetOffset: 0,
        botCooldown: 0.3,
        botHesitating: false
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bot inputs via BaseGame
    this.updateBots(dt, width, height);

    // Natural elastic centering drag if tension is uneven
    this.ropeOffset += -this.ropeOffset * 0.08 * dt;

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps || ps.inPit) continue;

      // Update oscillating needle
      ps.needle += ps.needleDir * ps.needleSpeed * dt;
      if (ps.needle >= 1.0) {
        ps.needle = 1.0;
        ps.needleDir = -1;
        if (ps.botCooldown <= 0.1) ps.botHesitating = false;
      } else if (ps.needle <= 0.0) {
        ps.needle = 0.0;
        ps.needleDir = 1;
        if (ps.botCooldown <= 0.1) ps.botHesitating = false;
      }

      // Recover animations
      if (ps.pullAnim > 0) ps.pullAnim = Math.max(0, ps.pullAnim - dt * 3.5);
      if (ps.slipAnim > 0) ps.slipAnim = Math.max(0, ps.slipAnim - dt * 2.8);

      // Dynamic position shifted by rope offset
      const ropeShiftX = this.ropeOffset * 70;
      ps.x = ps.baseX + ropeShiftX;

      // Pit fall check
      if (ps.team === 'LEFT' && ps.x > this.pitLeftX + 5) {
        ps.inPit = true;
        this.handlePitFall(ps, p.color);
      } else if (ps.team === 'RIGHT' && ps.x < this.pitRightX - 5) {
        ps.inPit = true;
        this.handlePitFall(ps, p.color);
      }

      // Read Input
      const doPull = this.input.justPressed(p.id) || this.input.justAction(p.id);

      if (doPull) {
        this.executePull(ps, p.color);
      }
    }

    this.syncDebug();

    // Check Win Condition
    if (this.ropeOffset <= -this.winThreshold) {
      this.winningTeam = 'LEFT';
      this.isFinished = true;
    } else if (this.ropeOffset >= this.winThreshold) {
      this.winningTeam = 'RIGHT';
      this.isFinished = true;
    } else if (this.roundTimer <= 0) {
      if (Math.abs(this.ropeOffset) > 0.05) {
        this.winningTeam = this.ropeOffset < 0 ? 'LEFT' : 'RIGHT';
      }
      this.isFinished = true;
    }
  }

  private handlePitFall(ps: TugPlayer, color: string): void {
    this.audio.playExplosion();
    this.particles.shake(0.4);
    this.particles.spawnExplosion(ps.x, ps.y, color, 25);
    this.particles.showFloatingText('SPLASH!', ps.x, ps.y - 30, '#EF4444', 28);
  }

  private executePull(ps: TugPlayer, color: string): void {
    const centerDist = Math.abs(ps.needle - 0.5);

    // Calculate individual pull weight (3-player balance adjustment)
    const active = this.getActivePlayers();
    const teamMembers = active.filter((p) => this.playersState.get(p.id)?.team === ps.team);
    const teamFactor = teamMembers.length === 1 ? 1.45 : 1.0;

    // Comeback adrenaline boost if team is in danger of being dragged into pit
    const isLosing = (ps.team === 'LEFT' && this.ropeOffset > 0.35) || (ps.team === 'RIGHT' && this.ropeOffset < -0.35);
    const comebackFactor = isLosing ? 1.25 : 1.0;

    // Widen sweet spot windows for a more satisfying and responsive pull
    if (centerDist <= 0.10) {
      // PERFECT PULL!
      ps.perfectCount += 1;
      ps.pullCount += 1;
      ps.pullAnim = 1.0;
      const pullForce = 0.085 * teamFactor * comebackFactor;
      this.ropeOffset += ps.team === 'LEFT' ? -pullForce : pullForce;

      this.audio.playBoost();
      this.audio.playRopeTension();
      this.particles.shake(0.2);
      this.particles.showFloatingText('PERFECT PULL!!', ps.x, ps.y - 34, '#10B981', 24);
      this.particles.spawnConfetti(ps.x, ps.y, 14);
    } else if (centerDist <= 0.26) {
      // GOOD PULL!
      ps.pullCount += 1;
      ps.pullAnim = 0.6;
      const pullForce = 0.048 * teamFactor * comebackFactor;
      this.ropeOffset += ps.team === 'LEFT' ? -pullForce : pullForce;

      this.audio.playBounce();
      this.particles.showFloatingText('PULL!', ps.x, ps.y - 28, '#FBBF24', 18);
    } else {
      // SLIP / MISTIME!
      ps.slipCount += 1;
      ps.slipAnim = 1.0;
      // Stumble penalty reduced from 0.045 to 0.028 so a mistime doesn't ruin the round
      const slipPenalty = 0.028 * teamFactor;
      this.ropeOffset += ps.team === 'LEFT' ? slipPenalty : -slipPenalty;

      this.audio.playStun();
      this.particles.showFloatingText('SLIP!', ps.x, ps.y - 28, '#EF4444', 20);
      this.particles.spawnDust(ps.x, ps.y + 12, 8);
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public syncDebug(): void {
    if (typeof window !== 'undefined') {
      (window as any).__TUG_OF_WAR_DEBUG__ = {
        players: Array.from(this.playersState.values()),
        ropeOffset: this.ropeOffset,
        winningTeam: this.winningTeam,
        isFinished: this.isFinished,
        roundTimer: this.roundTimer,
        executePull: (pid: PlayerId) => {
          const ps = this.playersState.get(pid);
          const p = this.getPlayer(pid);
          if (ps && p) this.executePull(ps, p.color);
        },
        setNeedle: (pid: PlayerId, needle: number) => {
          const ps = this.playersState.get(pid);
          if (ps) ps.needle = needle;
        },
        setRopeOffset: (offset: number) => {
          this.ropeOffset = offset;
        }
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
    if (!ps || ps.inPit || this.isFinished) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    if (ps.botCooldown > 0) {
      ps.botCooldown -= dt;
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    if (ps.botHesitating) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    const target = 0.5 + ps.botTargetOffset;
    const diff = Math.abs(ps.needle - target);

    if (diff <= 0.048) {
      // Trigger heave
      this.input.setBotInput(botId, true, 0, 0, true);
      // Cooldown until next oscillation
      ps.botCooldown = 0.45;
      this.rollBotTarget(ps, difficulty);
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  private rollBotTarget(ps: TugPlayer, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard'): void {
    const roll = Math.random();
    if (difficulty === 'bot_easy') {
      ps.botHesitating = Math.random() < 0.35; // Hesitates / skips 35% of sweeps
      if (roll < 0.30) {
        // Slip! (30%)
        ps.botTargetOffset = (Math.random() < 0.5 ? -1 : 1) * (0.28 + Math.random() * 0.12);
      } else if (roll < 0.80) {
        // Good pull (50%)
        ps.botTargetOffset = (Math.random() - 0.5) * 0.28;
      } else {
        // Perfect pull (20%)
        ps.botTargetOffset = (Math.random() - 0.5) * 0.08;
      }
    } else if (difficulty === 'bot_normal') {
      ps.botHesitating = Math.random() < 0.15; // Hesitates / skips 15% of sweeps
      if (roll < 0.14) {
        // Slip! (14% of sweeps, giving human clear openings)
        ps.botTargetOffset = (Math.random() < 0.5 ? -1 : 1) * (0.28 + Math.random() * 0.08);
      } else if (roll < 0.68) {
        // Good pull (54%)
        ps.botTargetOffset = (Math.random() - 0.5) * 0.22;
      } else {
        // Perfect pull (32%)
        ps.botTargetOffset = (Math.random() - 0.5) * 0.08;
      }
    } else {
      // Hard: Fierce competitor with human-like slip possibility
      ps.botHesitating = false;
      if (roll < 0.05) {
        // Rare slip (5%)
        ps.botTargetOffset = (Math.random() < 0.5 ? -1 : 1) * (0.28 + Math.random() * 0.05);
      } else if (roll < 0.48) {
        // Good pull (43%)
        ps.botTargetOffset = (Math.random() - 0.5) * 0.20;
      } else {
        // Perfect pull (52%)
        ps.botTargetOffset = (Math.random() - 0.5) * 0.07;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Arena Floor & Hazard Pit
    this.renderArenaFloor(ctx, width, height);

    // 2. Central Tug of War Rope
    this.renderRope(ctx, width, height);

    // 3. Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderTugPlayer(ctx, ps, p.color);
    }

    // 4. Center HUD Pod
    this.renderCenterHudPod(ctx, width);
  }

  private renderArenaFloor(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Arena background
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // Left Platform
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, this.pitTopY, this.pitLeftX, height - this.pitTopY);
    ctx.fillStyle = '#3B82F6';
    ctx.fillRect(0, this.pitTopY, this.pitLeftX, 6);

    // Right Platform
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(this.pitRightX, this.pitTopY, width - this.pitRightX, height - this.pitTopY);
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(this.pitRightX, this.pitTopY, width - this.pitRightX, 6);

    // Hazard Pit in Middle
    const pitW = this.pitRightX - this.pitLeftX;
    const pitH = height - this.pitTopY;

    if (this.currentMapName === 'Mud Sludge Pit') {
      ctx.fillStyle = '#451A03';
      ctx.fillRect(this.pitLeftX, this.pitTopY, pitW, pitH);
      // Bubbling mud circles
      ctx.fillStyle = '#78350F';
      const bubbleY = this.pitTopY + 25 + Math.sin(performance.now() * 0.005) * 8;
      ctx.beginPath();
      ctx.arc(this.pitLeftX + pitW * 0.35, bubbleY, 14, 0, Math.PI * 2);
      ctx.arc(this.pitLeftX + pitW * 0.7, bubbleY + 12, 18, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.currentMapName === 'Molten Lava Trench') {
      const lavaGrad = ctx.createLinearGradient(0, this.pitTopY, 0, height);
      lavaGrad.addColorStop(0, '#EF4444');
      lavaGrad.addColorStop(0.5, '#F97316');
      lavaGrad.addColorStop(1, '#7F1D1D');
      ctx.fillStyle = lavaGrad;
      ctx.fillRect(this.pitLeftX, this.pitTopY, pitW, pitH);
    } else if (this.currentMapName === 'Cyber Void') {
      ctx.fillStyle = '#030712';
      ctx.fillRect(this.pitLeftX, this.pitTopY, pitW, pitH);
      // Electric neon grid lines
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 1.5;
      for (let y = this.pitTopY; y < height; y += 24) {
        ctx.beginPath();
        ctx.moveTo(this.pitLeftX, y);
        ctx.lineTo(this.pitRightX, y);
        ctx.stroke();
      }
    } else {
      // Ice Crevasse
      const iceGrad = ctx.createLinearGradient(0, this.pitTopY, 0, height);
      iceGrad.addColorStop(0, '#38BDF8');
      iceGrad.addColorStop(1, '#0284C7');
      ctx.fillStyle = iceGrad;
      ctx.fillRect(this.pitLeftX, this.pitTopY, pitW, pitH);
    }

    // Win Marker Lines
    ctx.strokeStyle = '#22C55E';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(this.pitLeftX - 60, this.pitTopY);
    ctx.lineTo(this.pitLeftX - 60, height);
    ctx.moveTo(this.pitRightX + 60, this.pitTopY);
    ctx.lineTo(this.pitRightX + 60, height);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private renderRope(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const centerY = height * 0.58;
    const ropeLeftX = 40;
    const ropeRightX = width - 40;

    // Center Ribbon position based on rope offset
    const maxShift = (this.pitRightX - this.pitLeftX) * 0.75;
    const ribbonX = width / 2 + this.ropeOffset * maxShift;
    const ribbonY = centerY + Math.sin(this.ropeOffset * Math.PI) * 12;

    // Heavy Braided Rope
    ctx.beginPath();
    ctx.moveTo(ropeLeftX, centerY);
    ctx.quadraticCurveTo(ribbonX, ribbonY + 8, ropeRightX, centerY);
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Braided highlight inner strand
    ctx.beginPath();
    ctx.moveTo(ropeLeftX, centerY);
    ctx.quadraticCurveTo(ribbonX, ribbonY + 8, ropeRightX, centerY);
    ctx.strokeStyle = '#FDE68A';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Red Center Ribbon Marker Flag
    ctx.save();
    ctx.translate(ribbonX, ribbonY);

    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(16, 2);
    ctx.lineTo(0, 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Center ring tie
    ctx.beginPath();
    ctx.arc(0, 2, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private renderTugPlayer(
    ctx: CanvasRenderingContext2D,
    ps: TugPlayer,
    color: string
  ): void {
    if (ps.inPit) return;

    ctx.save();
    ctx.translate(ps.x, ps.y);

    // Lean angle: pulling backwards, or slipping forward
    let lean = ps.team === 'LEFT' ? -0.25 : 0.25;
    if (ps.pullAnim > 0) {
      lean += (ps.team === 'LEFT' ? -0.35 : 0.35) * ps.pullAnim;
    }
    if (ps.slipAnim > 0) {
      lean += (ps.team === 'LEFT' ? 0.45 : -0.45) * ps.slipAnim;
    }

    ctx.rotate(lean);

    // Player Shadow
    ctx.beginPath();
    ctx.ellipse(0, 18, 14, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // Player Body
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    // Headband / Cap
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(-12, -12, 24, 6);

    // Determined Gritting Eyes
    const faceDir = ps.team === 'LEFT' ? 1 : -1;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(faceDir * 4, -4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(faceDir * 4 - 1, -5, 2, 3);

    // Hands gripping rope
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(faceDir * 14, 4, 4, 0, Math.PI * 2);
    ctx.arc(faceDir * 8, 8, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Oscillating Rhythm / Power Meter above player
    this.renderPowerMeter(ctx, ps);
  }

  private renderPowerMeter(ctx: CanvasRenderingContext2D, ps: TugPlayer): void {
    const barW = 60;
    const barH = 8;
    const barX = ps.x - barW / 2;
    const barY = ps.y - 36;

    // Meter Background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    // Zones: Red outer, Yellow mid, Green center
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(barX + 2, barY + 1, barW - 4, barH - 2);

    // Yellow Good Zone
    ctx.fillStyle = '#FBBF24';
    ctx.fillRect(barX + barW * 0.24, barY + 1, barW * 0.52, barH - 2);

    // Green Sweet Spot Zone
    ctx.fillStyle = '#22C55E';
    ctx.fillRect(barX + barW * 0.40, barY + 1, barW * 0.20, barH - 2);

    // Needle Cursor
    const needleX = barX + ps.needle * barW;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(needleX - 2, barY - 2, 4, barH + 4, 2);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();
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
    ctx.fillStyle = '#F97316';
    ctx.fillText(`ARENA: ${this.currentMapName}`, podX + 16, podY + 17);

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
        const isWinner = ps && this.winningTeam !== null && ps.team === this.winningTeam;
        const score = (isWinner ? 500 : 0) + (ps ? ps.perfectCount * 50 + ps.pullCount * 20 : 0);
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

    let mvpHighlight = 'Tug of War Champions!';
    if (this.winningTeam) {
      mvpHighlight = `${this.winningTeam} Team pulled with sheer dominance!`;
    } else if (winnerId !== null) {
      mvpHighlight = `Player ${Number(winnerId) + 1} timed the rope heaves to perfection!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}
