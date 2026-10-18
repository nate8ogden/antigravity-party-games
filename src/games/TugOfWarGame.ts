import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type TugTheme = 'magma' | 'cyber' | 'ice';

export interface TugThemeConfig {
  id: TugTheme;
  name: string;
  bgColor: string;
  platformColor: string;
  leftBorderColor: string;
  rightBorderColor: string;
  pitColorTop: string;
  pitColorBottom: string;
  pillColor: string;
  particleColor: string;
}

export const THEME_CONFIGS: TugThemeConfig[] = [
  {
    id: 'magma',
    name: 'Volcanic Magma Pit 🔥',
    bgColor: '#180B0B',
    platformColor: '#261212',
    leftBorderColor: '#3B82F6',
    rightBorderColor: '#EF4444',
    pitColorTop: '#EF4444',
    pitColorBottom: '#7F1D1D',
    pillColor: '#F97316',
    particleColor: '#F97316'
  },
  {
    id: 'cyber',
    name: 'Cyber Void Grid ⚡',
    bgColor: '#030712',
    platformColor: '#0F172A',
    leftBorderColor: '#06B6D4',
    rightBorderColor: '#F43F5E',
    pitColorTop: '#3B0764',
    pitColorBottom: '#020617',
    pillColor: '#8B5CF6',
    particleColor: '#06B6D4'
  },
  {
    id: 'ice',
    name: 'Glacial Crevasse ❄️',
    bgColor: '#0B1528',
    platformColor: '#1E293B',
    leftBorderColor: '#38BDF8',
    rightBorderColor: '#F472B6',
    pitColorTop: '#0284C7',
    pitColorBottom: '#082F49',
    pillColor: '#38BDF8',
    particleColor: '#E0F2FE'
  }
];

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
  isUnderdog: boolean;
  botReactionTimer: number;
  botTargetOffset: number;
  botCooldown: number;
  botHesitating: boolean;
}

export class TugOfWarGame extends BaseGame {
  private playersState: Map<PlayerId, TugPlayer> = new Map();
  private ropeOffset: number = 0; // -1 (far left win) to +1 (far right win)
  private ropeTension: number = 1.0;
  private winThreshold: number = 0.85;
  private pitLeftX: number = 0;
  private pitRightX: number = 0;
  private pitTopY: number = 0;
  private pitBottomY: number = 0;
  private winningTeam: 'LEFT' | 'RIGHT' | null = null;

  public mapTheme: TugTheme = 'magma';
  public get currentMapName(): string {
    const theme = THEME_CONFIGS.find((t) => t.id === this.mapTheme);
    return theme ? theme.name : 'Volcanic Magma Pit 🔥';
  }
  private lastWidth: number = 960;
  private lastHeight: number = 540;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private suddenDeathAnnounced: boolean = false;
  private animTimer: number = 0;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.bindKeyboardShortcuts();
    this.bindCanvasPointer();
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45;
    this.ropeOffset = 0;
    this.ropeTension = 1.0;
    this.winningTeam = null;
    this.suddenDeathAnnounced = false;
    this.animTimer = 0;

    const pitWidth = Math.min(220, width * 0.28);
    this.pitLeftX = width / 2 - pitWidth / 2;
    this.pitRightX = width / 2 + pitWidth / 2;
    this.pitTopY = height * 0.42;
    this.pitBottomY = height - 30;

    this.initPlayers(width, height);
    this.syncDebug();
  }

  public syncDebug(): void {
    if (typeof window !== 'undefined') {
      (window as any).__TUG_OF_WAR_DEBUG__ = {
        players: Array.from(this.playersState.values()),
        ropeOffset: this.ropeOffset,
        winningTeam: this.winningTeam,
        isFinished: this.isFinished,
        roundTimer: this.roundTimer,
        theme: this.mapTheme,
        setTheme: (theme: TugTheme) => this.setMapTheme(theme),
        cycleTheme: () => this.cycleTheme(),
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

  private bindCanvasPointer(): void {
    if (typeof window === 'undefined') return;
    const canvas = this.input.getCanvas();
    if (!canvas) return;

    this.boundPointerDown = (e: PointerEvent) => {
      this.handlePointerDown(e);
    };
    canvas.addEventListener('pointerdown', this.boundPointerDown);
  }

  private handlePointerDown(e: PointerEvent): void {
    const canvas = this.input.getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * this.lastWidth;
    const clickY = ((e.clientY - rect.top) / rect.height) * this.lastHeight;

    // Check Theme Pill click at (20, height - 44, 170, 32)
    if (
      clickX >= 20 &&
      clickX <= 190 &&
      clickY >= this.lastHeight - 44 &&
      clickY <= this.lastHeight - 12
    ) {
      this.cycleTheme();
    }
  }

  public cycleTheme(): void {
    const curIdx = THEME_CONFIGS.findIndex((t) => t.id === this.mapTheme);
    const nextIdx = (curIdx + 1) % THEME_CONFIGS.length;
    this.setMapTheme(THEME_CONFIGS[nextIdx].id);
  }

  public setMapTheme(theme: TugTheme): void {
    if (this.mapTheme === theme) return;
    this.mapTheme = theme;
    this.audio.playTap();
    this.particles.spawnExplosion(100, this.lastHeight - 28, '#F59E0B', 12);
    this.syncDebug();
  }

  private bindKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;
    this.unbindKeyboardShortcuts();

    this.keydownListener = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === '1') {
        this.setMapTheme('magma');
      } else if (e.key === '2') {
        this.setMapTheme('cyber');
      } else if (e.key === '3') {
        this.setMapTheme('ice');
      }
    };
    window.addEventListener('keydown', this.keydownListener);
  }

  private unbindKeyboardShortcuts(): void {
    if (typeof window !== 'undefined' && this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
  }

  public override destroy(): void {
    this.unbindKeyboardShortcuts();
    if (this.boundPointerDown) {
      const canvas = this.input.getCanvas();
      if (canvas) {
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
      }
      this.boundPointerDown = null;
    }
    if (typeof window !== 'undefined' && (window as any).__TUG_OF_WAR_DEBUG__) {
      delete (window as any).__TUG_OF_WAR_DEBUG__;
    }
  }

  private initPlayers(width: number, height: number): void {
    this.playersState.clear();
    const active = this.getActivePlayers();
    const count = active.length;

    const centerY = height * 0.58;

    active.forEach((p, idx) => {
      const isLeft = idx % 2 === 0;
      const team: 'LEFT' | 'RIGHT' = isLeft ? 'LEFT' : 'RIGHT';

      let px: number;
      let py: number;

      if (count === 2) {
        px = isLeft ? this.pitLeftX - 100 : this.pitRightX + 100;
        py = centerY;
      } else {
        const rank = Math.floor(idx / 2);
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
        isUnderdog: false,
        botReactionTimer: 0.2 + idx * 0.1,
        botTargetOffset: 0,
        botCooldown: 0.3,
        botHesitating: false
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastWidth = width;
    this.lastHeight = height;
    this.animTimer += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    const isSuddenDeath = this.roundTimer <= 15;

    // Sudden Death warning trigger
    if (isSuddenDeath && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.audio.playBoost();
      this.particles.shake(0.5);
      this.particles.showFloatingText('⚡ VOLTAGE OVERDRIVE! 2x FORCE! ⚡', width / 2, height / 2 - 30, '#FACC15', 30);
    }

    // Natural elastic centering drag
    this.ropeOffset += -this.ropeOffset * 0.08 * dt;

    // Underdog Team detection (team currently losing by >= 0.30 rope offset)
    const leftIsUnderdog = this.ropeOffset > 0.30;
    const rightIsUnderdog = this.ropeOffset < -0.30;

    for (const ps of this.playersState.values()) {
      ps.isUnderdog = (ps.team === 'LEFT' && leftIsUnderdog) || (ps.team === 'RIGHT' && rightIsUnderdog);
    }

    // Update bot inputs via BaseGame
    this.updateBots(dt, width, height);

    // Update Players
    const needleSpeedMultiplier = isSuddenDeath ? 1.30 : 1.0;

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps || ps.inPit) continue;

      ps.needle += ps.needleDir * ps.needleSpeed * needleSpeedMultiplier * dt;
      if (ps.needle >= 1.0) {
        ps.needle = 1.0;
        ps.needleDir = -1;
        if (ps.botCooldown <= 0.1) ps.botHesitating = false;
      } else if (ps.needle <= 0.0) {
        ps.needle = 0.0;
        ps.needleDir = 1;
        if (ps.botCooldown <= 0.1) ps.botHesitating = false;
      }

      if (ps.pullAnim > 0) ps.pullAnim = Math.max(0, ps.pullAnim - dt * 3.5);
      if (ps.slipAnim > 0) ps.slipAnim = Math.max(0, ps.slipAnim - dt * 2.8);

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

    const active = this.getActivePlayers();
    const teamMembers = active.filter((p) => this.playersState.get(p.id)?.team === ps.team);
    const teamFactor = teamMembers.length === 1 ? 1.45 : 1.0;

    // Underdog Adrenaline Anchor bonus
    const underdogFactor = ps.isUnderdog ? 1.35 : 1.0;
    const suddenDeathFactor = this.roundTimer <= 15 ? 1.45 : 1.0;

    // Sweet Spot window: Underdog gets +40% wider green zone!
    const sweetSpotTolerance = ps.isUnderdog ? 0.14 : 0.10;
    const goodTolerance = ps.isUnderdog ? 0.30 : 0.25;

    if (centerDist <= sweetSpotTolerance) {
      // PERFECT PULL!
      ps.perfectCount += 1;
      ps.pullCount += 1;
      ps.pullAnim = 1.0;
      const pullForce = 0.085 * teamFactor * underdogFactor * suddenDeathFactor;
      this.ropeOffset += ps.team === 'LEFT' ? -pullForce : pullForce;

      this.audio.playBoost();
      this.audio.playRopeTension();
      this.particles.shake(0.2);
      this.particles.showFloatingText(
        this.roundTimer <= 15 ? '⚡ HYPER PULL! +2X' : 'PERFECT PULL!!',
        ps.x,
        ps.y - 34,
        '#10B981',
        24
      );
      this.particles.spawnConfetti(ps.x, ps.y, 14);
    } else if (centerDist <= goodTolerance) {
      // GOOD PULL!
      ps.pullCount += 1;
      ps.pullAnim = 0.6;
      const pullForce = 0.048 * teamFactor * underdogFactor * suddenDeathFactor;
      this.ropeOffset += ps.team === 'LEFT' ? -pullForce : pullForce;

      this.audio.playBounce();
      this.particles.showFloatingText('PULL!', ps.x, ps.y - 28, '#FBBF24', 18);
    } else {
      // SLIP / MISTIME!
      ps.slipCount += 1;
      ps.slipAnim = 1.0;
      // Underdog suffers only half slip penalty
      const slipPenalty = (ps.isUnderdog ? 0.014 : 0.028) * teamFactor;
      this.ropeOffset += ps.team === 'LEFT' ? slipPenalty : -slipPenalty;

      this.audio.playStun();
      this.particles.showFloatingText('SLIP!', ps.x, ps.y - 28, '#EF4444', 20);
      this.particles.spawnDust(ps.x, ps.y + 12, 8);
    }
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
      this.input.setBotInput(botId, true, 0, 0, true);
      ps.botCooldown = 0.45;
      this.rollBotTarget(ps, difficulty);
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  private rollBotTarget(ps: TugPlayer, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard'): void {
    const roll = Math.random();
    if (difficulty === 'bot_easy') {
      ps.botHesitating = Math.random() < 0.35;
      if (roll < 0.30) {
        ps.botTargetOffset = (Math.random() < 0.5 ? -1 : 1) * (0.28 + Math.random() * 0.12);
      } else if (roll < 0.80) {
        ps.botTargetOffset = (Math.random() - 0.5) * 0.28;
      } else {
        ps.botTargetOffset = (Math.random() - 0.5) * 0.08;
      }
    } else if (difficulty === 'bot_normal') {
      ps.botHesitating = Math.random() < 0.15;
      if (roll < 0.14) {
        ps.botTargetOffset = (Math.random() < 0.5 ? -1 : 1) * (0.28 + Math.random() * 0.08);
      } else if (roll < 0.68) {
        ps.botTargetOffset = (Math.random() - 0.5) * 0.22;
      } else {
        ps.botTargetOffset = (Math.random() - 0.5) * 0.08;
      }
    } else {
      ps.botHesitating = false;
      if (roll < 0.05) {
        ps.botTargetOffset = (Math.random() < 0.5 ? -1 : 1) * (0.28 + Math.random() * 0.05);
      } else if (roll < 0.48) {
        ps.botTargetOffset = (Math.random() - 0.5) * 0.20;
      } else {
        ps.botTargetOffset = (Math.random() - 0.5) * 0.07;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEME_CONFIGS.find((t) => t.id === this.mapTheme) || THEME_CONFIGS[0];

    // Arena Floor & Hazard Pit
    this.renderArenaFloor(ctx, width, height, theme);

    // Central Tug of War Rope
    this.renderRope(ctx, width, height);

    // Players with CharacterRenderer Mascot
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderTugPlayer(ctx, ps, p);
    }

    // Center HUD Pod at y = 56
    this.renderCenterHudPod(ctx, width, theme);

    // Interactive Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
    this.renderThemePill(ctx, height, theme);

    // Control Hints (Right-aligned)
    this.renderControlHints(ctx, width, height);
  }

  private renderArenaFloor(ctx: CanvasRenderingContext2D, width: number, height: number, theme: TugThemeConfig): void {
    ctx.fillStyle = theme.bgColor;
    ctx.fillRect(0, 0, width, height);

    // Left Platform
    ctx.fillStyle = theme.platformColor;
    ctx.fillRect(0, this.pitTopY, this.pitLeftX, height - this.pitTopY);
    ctx.fillStyle = theme.leftBorderColor;
    ctx.fillRect(0, this.pitTopY, this.pitLeftX, 6);

    // Right Platform
    ctx.fillStyle = theme.platformColor;
    ctx.fillRect(this.pitRightX, this.pitTopY, width - this.pitRightX, height - this.pitTopY);
    ctx.fillStyle = theme.rightBorderColor;
    ctx.fillRect(this.pitRightX, this.pitTopY, width - this.pitRightX, 6);

    // Hazard Pit in Middle
    const pitW = this.pitRightX - this.pitLeftX;
    const pitH = height - this.pitTopY;

    const pitGrad = ctx.createLinearGradient(0, this.pitTopY, 0, height);
    pitGrad.addColorStop(0, theme.pitColorTop);
    pitGrad.addColorStop(1, theme.pitColorBottom);
    ctx.fillStyle = pitGrad;
    ctx.fillRect(this.pitLeftX, this.pitTopY, pitW, pitH);

    // Bubbling effects in pit
    if (this.mapTheme === 'magma') {
      const bubbleY = this.pitTopY + 25 + Math.sin(this.animTimer * 5) * 8;
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(this.pitLeftX + pitW * 0.35, bubbleY, 14, 0, Math.PI * 2);
      ctx.arc(this.pitLeftX + pitW * 0.7, bubbleY + 12, 18, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.mapTheme === 'cyber') {
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 1.5;
      for (let y = this.pitTopY; y < height; y += 24) {
        ctx.beginPath();
        ctx.moveTo(this.pitLeftX, y);
        ctx.lineTo(this.pitRightX, y);
        ctx.stroke();
      }
    } else {
      // Ice crevasse mist
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(this.pitLeftX, this.pitTopY, pitW, 20);
    }

    // Win Threshold Marker Lines
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

    const maxShift = (this.pitRightX - this.pitLeftX) * 0.75;
    const ribbonX = width / 2 + this.ropeOffset * maxShift;
    const ribbonY = centerY + Math.sin(this.ropeOffset * Math.PI) * 12;

    ctx.beginPath();
    ctx.moveTo(ropeLeftX, centerY);
    ctx.quadraticCurveTo(ribbonX, ribbonY + 8, ropeRightX, centerY);
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(ropeLeftX, centerY);
    ctx.quadraticCurveTo(ribbonX, ribbonY + 8, ropeRightX, centerY);
    ctx.strokeStyle = '#FDE68A';
    ctx.lineWidth = 3;
    ctx.stroke();

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
    p: PlayerConfig
  ): void {
    if (ps.inPit) return;

    ctx.save();
    ctx.translate(ps.x, ps.y);

    // Lean angle
    let lean = ps.team === 'LEFT' ? -0.25 : 0.25;
    if (ps.pullAnim > 0) {
      lean += (ps.team === 'LEFT' ? -0.35 : 0.35) * ps.pullAnim;
    }
    if (ps.slipAnim > 0) {
      lean += (ps.team === 'LEFT' ? 0.45 : -0.45) * ps.slipAnim;
    }

    ctx.rotate(lean);

    // Underdog Adrenaline Anchor Aura
    if (ps.isUnderdog) {
      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#F59E0B';
      ctx.font = '900 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ANCHOR ⚓', 0, 26);
      ctx.restore();
    }

    // Shadow
    ctx.beginPath();
    ctx.ellipse(0, 18, 14, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // Context-aware Character Mood
    let mood: CharacterMood = 'focused';
    if (ps.slipAnim > 0) {
      mood = 'shocked';
    } else if (ps.pullAnim > 0) {
      mood = 'triumph';
    } else if (ps.isUnderdog) {
      mood = 'focused';
    } else {
      mood = 'idle';
    }

    const isBot = p.type.startsWith('bot_');

    // Mascot Avatar via CharacterRenderer
    drawCharacter(ctx, 0, 0, 16, p.id, isBot, mood, this.animTimer * 3);

    // Hands gripping rope
    const faceDir = ps.team === 'LEFT' ? 1 : -1;
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

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    // Red outer zone
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(barX + 2, barY + 1, barW - 4, barH - 2);

    // Yellow Good Zone
    ctx.fillStyle = '#FBBF24';
    const goodWidth = ps.isUnderdog ? barW * 0.60 : barW * 0.52;
    ctx.fillRect(barX + (barW - goodWidth) / 2, barY + 1, goodWidth, barH - 2);

    // Green Sweet Spot Zone (wider for underdog)
    ctx.fillStyle = '#22C55E';
    const sweetWidth = ps.isUnderdog ? barW * 0.28 : barW * 0.20;
    ctx.fillRect(barX + (barW - sweetWidth) / 2, barY + 1, sweetWidth, barH - 2);

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

  private renderCenterHudPod(ctx: CanvasRenderingContext2D, width: number, theme: TugThemeConfig): void {
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

    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme.pillColor;
    ctx.fillText(theme.name.toUpperCase(), podX + 16, podY + podH / 2);

    ctx.font = '800 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    if (this.roundTimer <= 15) {
      ctx.fillStyle = '#FACC15';
      ctx.fillText('⚡ VOLTAGE OVERDRIVE', width / 2, podY + podH / 2);
    } else {
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('RHYTHM PIT HEAVE', width / 2, podY + podH / 2);
    }

    // Rope Displacement Meter indicator on right
    ctx.textAlign = 'right';
    const gaugeW = 44;
    const gaugeH = 6;
    const gx = podX + podW - 16 - gaugeW;
    const gy = podY + podH / 2 - gaugeH / 2;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(gx, gy, gaugeW, gaugeH);

    const pinX = gx + (this.ropeOffset + 1) * 0.5 * gaugeW;
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(pinX - 1.5, gy - 2, 3, gaugeH + 4);
  }

  private renderThemePill(ctx: CanvasRenderingContext2D, height: number, theme: TugThemeConfig): void {
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();

    ctx.strokeStyle = theme.pillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(theme.name, pillX + 14, pillY + pillH / 2);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('[T]', pillX + pillW - 12, pillY + pillH / 2);
    ctx.restore();
  }

  private renderControlHints(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText('Tap/Space: Rhythm Power Pull (Hit Green Zone)', width - 24, height - 28);
    ctx.restore();
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
