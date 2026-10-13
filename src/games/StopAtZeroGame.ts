import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';
import { CharacterMood } from '../core/CharacterRenderer';

export interface ClockTheme {
  name: string;
  bgColor: string;
  panelColor: string;
  borderColor: string;
  glowColor: string;
  digitColor: string;
  nixieGlow: string;
  subtextColor: string;
  hazardStripes: boolean;
  synthwaveGrid: boolean;
}

export const CLOCK_THEMES: ClockTheme[] = [
  {
    name: 'Cyberpunk Vault ⚡',
    bgColor: '#0B0F19',
    panelColor: '#111827',
    borderColor: '#38BDF8',
    glowColor: 'rgba(56, 189, 248, 0.45)',
    digitColor: '#38BDF8',
    nixieGlow: '#0284C7',
    subtextColor: '#94A3B8',
    hazardStripes: false,
    synthwaveGrid: false
  },
  {
    name: 'Cold War Bunker 💣',
    bgColor: '#141410',
    panelColor: '#1F1E19',
    borderColor: '#F59E0B',
    glowColor: 'rgba(245, 158, 11, 0.45)',
    digitColor: '#F59E0B',
    nixieGlow: '#D97706',
    subtextColor: '#A8A29E',
    hazardStripes: true,
    synthwaveGrid: false
  },
  {
    name: 'Tokyo Synthwave ⏱️',
    bgColor: '#0F051D',
    panelColor: '#1A0B2E',
    borderColor: '#EC4899',
    glowColor: 'rgba(236, 72, 153, 0.45)',
    digitColor: '#F43F5E',
    nixieGlow: '#A855F7',
    subtextColor: '#C084FC',
    hazardStripes: false,
    synthwaveGrid: true
  }
];

export interface AccuracyResult {
  tierName: string;
  points: number;
  multiplier: number;
  badge: string;
  color: string;
}

interface Duelist {
  id: PlayerId;
  x: number;
  y: number;
  stopped: boolean;
  frozenTime: number | null;
  rawDelta: number | null;
  effectiveDelta: number | null;
  roundScore: number;
  totalScore: number;
  roundWins: number;
  isBust: boolean;
  isUnderdog: boolean;
  tierResult: AccuracyResult | null;
  buttonYOffset: number;
}

export class StopAtZeroGame extends BaseGame {
  private duelists: Map<PlayerId, Duelist> = new Map();
  private clockTime: number = 5.0;
  private isBlind: boolean = false;
  private state: 'COUNTDOWN_ACTIVE' | 'ROUND_RESOLVED' = 'COUNTDOWN_ACTIVE';
  private currentDuelRound: number = 1;
  private maxDuelRounds: number = 3;
  private interRoundTimer: number = 0;
  private roundWinnerId: PlayerId | null = null;
  private lastTickSecond: number = 5;

  // Visual Theme & Listeners
  private currentThemeIndex: number = 0;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private pointerdownListener: ((e: PointerEvent) => void) | null = null;

  // Glitch Distraction Wave
  private glitchTime: number = 1.8;
  private glitchActive: boolean = false;
  private glitchTimer: number = 0;

  // Bot targets
  private botTargetStopTimes: Map<PlayerId, number> = new Map();

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  public destroy(): void {
    this.removeListeners();
    super.destroy();
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isFinished) return;
      if (e.code === 'KeyT') {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % CLOCK_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.pointerdownListener = (e: PointerEvent) => {
      if (this.isFinished) return;
      const canvas = e.target as HTMLCanvasElement;
      if (!canvas || !canvas.getBoundingClientRect) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // Theme pill is at x: 20, y: canvas.height - 44, w: 170, h: 32
      if (clickX >= 20 && clickX <= 190 && clickY >= canvas.height - 44 && clickY <= canvas.height - 12) {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % CLOCK_THEMES.length;
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

  public reset(width: number, height: number): void {
    this.roundTimer = 75;
    this.isFinished = false;
    this.duelists.clear();
    this.currentDuelRound = 1;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.duelists.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height - 128,
        stopped: false,
        frozenTime: null,
        rawDelta: null,
        effectiveDelta: null,
        roundScore: 0,
        totalScore: 0,
        roundWins: 0,
        isBust: false,
        isUnderdog: false,
        tierResult: null,
        buttonYOffset: 0
      });
    });

    this.startNewDuelRound();
  }

  private startNewDuelRound(): void {
    this.clockTime = 5.0;
    this.isBlind = false;
    this.state = 'COUNTDOWN_ACTIVE';
    this.interRoundTimer = 0;
    this.roundWinnerId = null;
    this.lastTickSecond = 5;
    this.botTargetStopTimes.clear();

    // Procedural glitch between 2.2s and 0.8s
    this.glitchTime = 0.8 + Math.random() * 1.4;
    this.glitchActive = false;
    this.glitchTimer = 0;

    // Check underdog surge status from total scores
    let maxTotalScore = 0;
    for (const d of this.duelists.values()) {
      if (d.totalScore > maxTotalScore) maxTotalScore = d.totalScore;
    }

    for (const d of this.duelists.values()) {
      d.stopped = false;
      d.frozenTime = null;
      d.rawDelta = null;
      d.effectiveDelta = null;
      d.roundScore = 0;
      d.isBust = false;
      d.tierResult = null;
      d.buttonYOffset = 0;
      // Underdog surge activates if trailing by >= 350 pts
      d.isUnderdog = maxTotalScore >= 350 && d.totalScore <= maxTotalScore - 350;
    }
  }

  private evaluateAccuracy(rawDelta: number, isUnderdog: boolean): AccuracyResult {
    // Underdog surge grants a 0.045s precision cushion
    const cushion = isUnderdog ? 0.045 : 0;
    const effective = Math.max(0, rawDelta - cushion);

    if (effective <= 0.045) {
      return {
        tierName: '5X BULLSEYE JACKPOT!',
        points: 1000,
        multiplier: 5,
        badge: '🎯 5X',
        color: '#FBBF24'
      };
    } else if (effective <= 0.125) {
      return {
        tierName: '3X SHARP STOP!',
        points: 500,
        multiplier: 3,
        badge: '⚡ 3X',
        color: '#10B981'
      };
    } else if (effective <= 0.320) {
      return {
        tierName: '2X CLOSE CALL',
        points: 250,
        multiplier: 2,
        badge: '⏱️ 2X',
        color: '#38BDF8'
      };
    } else if (effective <= 0.650) {
      return {
        tierName: '1X SAFE STOP',
        points: 100,
        multiplier: 1,
        badge: '🛡️ 1X',
        color: '#94A3B8'
      };
    } else if (effective <= 1.000) {
      return {
        tierName: 'LATE STOP',
        points: 25,
        multiplier: 1,
        badge: '⚠️ LATE',
        color: '#F97316'
      };
    } else {
      return {
        tierName: 'BUST / MISSED',
        points: 0,
        multiplier: 0,
        badge: '💥 BUST',
        color: '#EF4444'
      };
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Update button spring recoil animations
    for (const d of this.duelists.values()) {
      if (d.buttonYOffset > 0) {
        d.buttonYOffset = Math.max(0, d.buttonYOffset - dt * 28);
      }
    }

    if (this.state === 'COUNTDOWN_ACTIVE') {
      this.clockTime -= dt;

      // Audible countdown rhythm during visible phase (5s, 4s, 3s)
      const sec = Math.ceil(this.clockTime);
      if (sec !== this.lastTickSecond && sec >= 3) {
        this.lastTickSecond = sec;
        if (sec === 3) {
          this.audio.playLaser();
        } else {
          this.audio.playTap();
        }
      }

      // Check blind threshold at 3.000s
      if (this.clockTime <= 3.0) {
        this.isBlind = true;
      }

      // Distraction Glitch Trigger
      if (this.isBlind && this.clockTime <= this.glitchTime && this.clockTime > this.glitchTime - 0.28) {
        if (!this.glitchActive) {
          this.glitchActive = true;
          this.audio.playBoost();
          this.particles.addTrauma(0.08);
        }
        this.glitchTimer += dt;
      } else {
        this.glitchActive = false;
      }

      // Check player stop taps
      for (const d of this.duelists.values()) {
        if (d.stopped) continue;

        const pressed =
          this.input.isPressed(d.id) ||
          this.input.isActionPressed(d.id) ||
          this.input.justPressed(d.id);

        if (pressed) {
          d.stopped = true;
          d.frozenTime = this.clockTime;
          d.rawDelta = Math.abs(this.clockTime);
          d.buttonYOffset = 6;

          const tier = this.evaluateAccuracy(d.rawDelta, d.isUnderdog);
          d.tierResult = tier;
          d.effectiveDelta = Math.max(0, d.rawDelta - (d.isUnderdog ? 0.045 : 0));
          d.roundScore = tier.points;
          d.isBust = tier.points === 0;

          if (tier.multiplier >= 5) {
            this.audio.playFanfare();
            this.particles.addTrauma(0.22);
            this.particles.spawnExplosion(d.x, d.y - 40, '#FBBF24', 36);
            this.particles.showFloatingText(`🎯 5X BULLSEYE! +${tier.points} PTS`, d.x, d.y - 80, '#FBBF24', 26);
          } else if (tier.multiplier >= 2) {
            this.audio.playScore();
            this.particles.spawnSparks(d.x, d.y - 30, tier.color, 18);
            this.particles.showFloatingText(`${tier.badge} +${tier.points} PTS`, d.x, d.y - 70, tier.color, 22);
          } else {
            this.audio.playTap();
            this.particles.spawnSparks(d.x, d.y - 20, '#94A3B8', 10);
            this.particles.showFloatingText(`+${tier.points} PTS`, d.x, d.y - 65, '#94A3B8', 18);
          }
        }
      }

      // All players stopped OR window completely expired (-1.00s past zero)
      const allStopped = Array.from(this.duelists.values()).every((d) => d.stopped);
      const timeExpired = this.clockTime <= -1.0;

      if (allStopped || timeExpired) {
        // Freeze any remaining players who failed to tap before expiration
        for (const d of this.duelists.values()) {
          if (!d.stopped) {
            d.stopped = true;
            d.frozenTime = -1.0;
            d.rawDelta = 99.0;
            d.effectiveDelta = 99.0;
            d.roundScore = 0;
            d.isBust = true;
            d.tierResult = {
              tierName: 'BUST / TIME-OUT',
              points: 0,
              multiplier: 0,
              badge: '💥 BUST',
              color: '#EF4444'
            };
            this.audio.playExplosion();
            this.particles.showFloatingText('💥 TIME EXPIRED!', d.x, d.y - 65, '#EF4444', 20);
          }
        }

        // Determine round winner: closest effective delta to 0.000s with score > 0
        const validList = Array.from(this.duelists.values())
          .filter((d) => !d.isBust && d.effectiveDelta !== null)
          .sort((a, b) => (a.effectiveDelta ?? 99) - (b.effectiveDelta ?? 99));

        if (validList.length > 0) {
          const winner = validList[0];
          const isTie =
            validList.length > 1 &&
            Math.abs((validList[0].effectiveDelta ?? 0) - (validList[1].effectiveDelta ?? 0)) < 0.001;

          if (!isTie) {
            this.roundWinnerId = winner.id;
            winner.roundWins++;
            this.audio.playFanfare();
          } else {
            this.roundWinnerId = null;
          }
        } else {
          this.roundWinnerId = null;
        }

        // Add round scores to total scores
        for (const d of this.duelists.values()) {
          d.totalScore += d.roundScore;
        }

        this.state = 'ROUND_RESOLVED';
        this.interRoundTimer = 3.4;
      }
    } else if (this.state === 'ROUND_RESOLVED') {
      this.interRoundTimer -= dt;

      if (this.currentDuelRound >= this.maxDuelRounds) {
        if (this.interRoundTimer <= 1.2) {
          this.isFinished = true;
        }
      } else if (this.interRoundTimer <= 0) {
        this.currentDuelRound++;
        this.startNewDuelRound();
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const d = this.duelists.get(botId);
    if (!d || d.stopped || this.state !== 'COUNTDOWN_ACTIVE') return;

    // Distraction glitch twitch on easy
    if (this.glitchActive && difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, true);
      return;
    }

    if (!this.botTargetStopTimes.has(botId)) {
      let targetOffset = 0;
      if (difficulty === 'bot_hard') {
        // Hard: seasoned human tournament timing (mean error ~0.07s)
        const sign = Math.random() < 0.5 ? 1 : -1;
        targetOffset = sign * (0.02 + Math.random() * 0.09);
      } else if (difficulty === 'bot_normal') {
        // Normal: steady rhythm player (mean error ~0.24s)
        const sign = Math.random() < 0.52 ? 1 : -1;
        targetOffset = sign * (0.12 + Math.random() * 0.22);
      } else {
        // Easy: casual player with high variance, 15% misses
        if (Math.random() < 0.15) {
          targetOffset = -1.5; // Busts past 0
        } else {
          const sign = Math.random() < 0.6 ? 1 : -1;
          targetOffset = sign * (0.35 + Math.random() * 0.50);
        }
      }
      this.botTargetStopTimes.set(botId, targetOffset);
    }

    const targetTime = this.botTargetStopTimes.get(botId) ?? 0.0;
    if (this.clockTime <= targetTime) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const theme = CLOCK_THEMES[this.currentThemeIndex];

    // 1. Dynamic Chassis & Background
    ctx.fillStyle = theme.bgColor;
    ctx.fillRect(0, 0, width, height);

    // Synthwave laser grid lines if active
    if (theme.synthwaveGrid) {
      ctx.save();
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.15)';
      ctx.lineWidth = 1.5;
      const horizonY = height * 0.55;
      for (let x = -width; x < width * 2; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, horizonY);
        ctx.lineTo(x * 1.5 - width * 0.25, height);
        ctx.stroke();
      }
      for (let y = horizonY; y < height; y += 22) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Industrial plate texture with corner rivets
    ctx.fillStyle = theme.panelColor;
    ctx.fillRect(36, 36, width - 72, height - 72);
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(36, 36, width - 72, height - 72);

    // Hazard warning stripes if active
    if (theme.hazardStripes) {
      ctx.save();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
      ctx.lineWidth = 4;
      for (let sx = 40; sx < width - 40; sx += 32) {
        ctx.beginPath();
        ctx.moveTo(sx, 38);
        ctx.lineTo(sx + 16, 52);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx, height - 52);
        ctx.lineTo(sx + 16, height - 38);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Corner rivet studs
    const rivets = [
      [46, 46],
      [width - 46, 46],
      [46, height - 46],
      [width - 46, height - 46]
    ];
    ctx.fillStyle = '#64748B';
    for (const [rx, ry] of rivets) {
      ctx.beginPath();
      ctx.arc(rx, ry, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Central Giant Digital Stopwatch Display Box
    const clockW = 460;
    const clockH = 146;
    const clockX = width / 2 - clockW / 2;
    const clockY = height * 0.28;

    ctx.save();
    ctx.shadowColor = theme.glowColor;
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(clockX, clockY, clockW, clockH, 18);
    else ctx.rect(clockX, clockY, clockW, clockH);
    ctx.fill();
    ctx.restore();

    // Glitch visual pulse effect on bezel
    const isGlitching = this.glitchActive;
    ctx.strokeStyle = isGlitching
      ? '#EF4444'
      : this.isBlind && this.state === 'COUNTDOWN_ACTIVE'
      ? theme.borderColor
      : theme.digitColor;
    ctx.lineWidth = isGlitching ? 5 : 3.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(clockX, clockY, clockW, clockH, 18);
    else ctx.rect(clockX, clockY, clockW, clockH);
    ctx.stroke();

    // Display Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.state === 'COUNTDOWN_ACTIVE') {
      if (this.isBlind) {
        // BLIND MODE: Digits hidden!
        ctx.save();
        ctx.shadowColor = isGlitching ? '#EF4444' : theme.glowColor;
        ctx.shadowBlur = 22;
        ctx.fillStyle = isGlitching ? '#EF4444' : theme.digitColor;
        ctx.font = '900 68px monospace';
        const blindText = isGlitching ? '⚡GLITCH⚡' : '?.??? s';
        ctx.fillText(blindText, width / 2, clockY + 54);
        ctx.restore();

        ctx.fillStyle = isGlitching ? '#F87171' : theme.subtextColor;
        ctx.font = 'bold 13px Montserrat, sans-serif';
        const hintText = isGlitching
          ? '⚠️ SENSORY DISTRACTION! KEEP YOUR INTERNAL TEMPO!'
          : 'BLIND MODE! HIT STOP CLOSEST TO 0.000s!';
        ctx.fillText(hintText, width / 2, clockY + clockH - 24);
      } else {
        // VISIBLE COUNTDOWN
        const displayTime = Math.max(0, this.clockTime).toFixed(3);
        ctx.save();
        ctx.shadowColor = theme.glowColor;
        ctx.shadowBlur = 20;
        ctx.fillStyle = theme.digitColor;
        ctx.font = '900 68px monospace';
        ctx.fillText(`${displayTime} s`, width / 2, clockY + 54);
        ctx.restore();

        ctx.fillStyle = theme.subtextColor;
        ctx.font = 'bold 12px Montserrat, sans-serif';
        ctx.fillText('VISIBLE COUNTDOWN • BLIND MODE AT 3.000s', width / 2, clockY + clockH - 24);
      }
    } else {
      // ROUND_RESOLVED: Show round winner outcome prominently!
      const winner = this.roundWinnerId !== null ? this.duelists.get(this.roundWinnerId) : null;
      const winnerConfig = this.roundWinnerId !== null ? this.getPlayer(this.roundWinnerId) : null;

      ctx.save();
      if (winner && winnerConfig && winner.frozenTime !== null) {
        const sign = winner.frozenTime >= 0 ? '+' : '';
        const isEarly = winner.frozenTime >= 0;
        ctx.shadowColor = winnerConfig.color;
        ctx.shadowBlur = 20;
        ctx.fillStyle = winnerConfig.color;
        ctx.font = '900 34px Montserrat, sans-serif';
        ctx.fillText(`${winnerConfig.name.toUpperCase()} WINS ROUND!`, width / 2, clockY + 44);

        ctx.fillStyle = '#F8FAFC';
        ctx.font = '800 16px monospace';
        const label = isEarly ? 'EARLY' : 'LATE';
        const deltaStr = (winner.effectiveDelta ?? 0).toFixed(3);
        ctx.fillText(
          `STOPPED AT ${sign}${winner.frozenTime.toFixed(3)}s (${label} Δ ${deltaStr}s)`,
          width / 2,
          clockY + 80
        );
      } else {
        ctx.fillStyle = '#F59E0B';
        ctx.font = '900 32px Montserrat, sans-serif';
        ctx.fillText('TIE ROUND!', width / 2, clockY + 48);

        ctx.fillStyle = '#94A3B8';
        ctx.font = '800 16px monospace';
        ctx.fillText('DEAD HEAT CLOSEST TO 0.000s', width / 2, clockY + 82);
      }

      ctx.fillStyle = theme.subtextColor;
      ctx.font = 'bold 12px Montserrat, sans-serif';
      ctx.fillText(
        `NEXT ROUND IN ${Math.max(1, Math.ceil(this.interRoundTimer))}s...`,
        width / 2,
        clockY + clockH - 18
      );
      ctx.restore();
    }

    // 3. Multiplier Tier Legend Bar (Between clock and players)
    const legendY = clockY + clockH + 16;
    ctx.save();
    ctx.font = 'bold 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText('🎯 5X JACKPOT (±0.045s) • ⚡ 3X (±0.125s) • ⏱️ 2X (±0.320s) • 🛡️ 1X (±0.650s)', width / 2, legendY);
    ctx.restore();

    // 4. Render Players & Precision Stop Pedestals
    for (const d of this.duelists.values()) {
      ctx.save();
      const p = this.getPlayer(d.id);
      const pColor = p?.color || '#FFFFFF';
      const pName = p?.name || `Player ${d.id + 1}`;

      // Underdog Surge Golden Aura
      if (d.isUnderdog && !d.stopped) {
        ctx.save();
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(d.x, d.y - 12, 46, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#FBBF24';
        ctx.font = '800 10px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⭐ UNDERDOG +0.045s CUSHION', d.x, d.y - 62);
      }

      // Drop shadow on floor
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y + 24, 48, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Industrial Stop Button Pedestal
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(d.x - 44, d.y - 8, 88, 36, 8);
      else ctx.rect(d.x - 44, d.y - 8, 88, 36);
      ctx.fill();
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Heavy Physical Slam Button with spring recoil
      const buttonPressed = d.stopped;
      const btnOffsetY = buttonPressed ? 6 + d.buttonYOffset : d.buttonYOffset;
      ctx.fillStyle = buttonPressed ? '#475569' : pColor;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(d.x - 32, d.y - 22 + btnOffsetY, 64, 18, 5);
      else ctx.rect(d.x - 32, d.y - 22 + btnOffsetY, 64, 18);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Character Mascot Operating the Pedestal
      let mood: CharacterMood = 'focused';
      if (d.stopped) {
        if (d.tierResult && d.tierResult.multiplier >= 5) mood = 'triumph';
        else if (d.tierResult && d.tierResult.multiplier >= 2) mood = 'happy';
        else if (d.isBust) mood = 'shocked';
        else mood = 'idle';
      }
      this.drawPlayerMascot(ctx, d.id, d.x, d.y - 48, 15, mood, performance.now() * 0.001);

      // Total Score Pill
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(d.x - 48, d.y + 34, 96, 22, 11);
      else ctx.rect(d.x - 48, d.y + 34, 96, 22);
      ctx.fill();
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${pName.toUpperCase()}: ${d.totalScore}`, d.x, d.y + 45);

      // Score Pips (Round Wins)
      for (let r = 0; r < this.maxDuelRounds; r++) {
        const starX = d.x - 18 + r * 18;
        const starY = d.y + 68;
        ctx.save();
        if (r < d.roundWins) {
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          const rOuter = 6;
          const rInner = 2.8;
          for (let pt = 0; pt < 10; pt++) {
            const rad = pt % 2 === 0 ? rOuter : rInner;
            const a = -Math.PI / 2 + (pt * Math.PI) / 5;
            if (pt === 0) ctx.moveTo(starX + Math.cos(a) * rad, starY + Math.sin(a) * rad);
            else ctx.lineTo(starX + Math.cos(a) * rad, starY + Math.sin(a) * rad);
          }
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.arc(starX, starY, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Locked in Millisecond Stamp Display
      if (d.stopped) {
        ctx.save();
        const stampW = 132;
        const stampH = 36;
        const stampX = d.x - stampW / 2;
        const stampY = d.y - 94;

        const isWinner = this.state === 'ROUND_RESOLVED' && this.roundWinnerId === d.id;

        if (d.isBust) {
          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(stampX, stampY, stampW, stampH, 8);
          else ctx.rect(stampX, stampY, stampW, stampH);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = '900 12px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('💥 MISSED / BUST!', d.x, stampY + stampH / 2);
        } else if (d.frozenTime !== null && d.tierResult) {
          const isEarly = d.frozenTime >= 0;
          ctx.fillStyle = isWinner ? '#10B981' : d.tierResult.color;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(stampX, stampY, stampW, stampH, 8);
          else ctx.rect(stampX, stampY, stampW, stampH);
          ctx.fill();
          ctx.strokeStyle = isWinner ? '#34D399' : '#FFFFFF';
          ctx.lineWidth = isWinner ? 2.5 : 1.5;
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = '900 11px monospace';
          ctx.textAlign = 'center';
          const sign = isEarly ? '+' : '';
          const earlyLate = isEarly ? 'EARLY' : 'LATE';
          ctx.fillText(`${sign}${d.frozenTime.toFixed(3)}s [${d.tierResult.badge}]`, d.x, stampY + 13);
          ctx.font = '800 10px Montserrat, sans-serif';
          const deltaStr = (d.effectiveDelta ?? 0).toFixed(3);
          ctx.fillText(`Δ ${deltaStr}s (${earlyLate}) +${d.roundScore}`, d.x, stampY + 26);
        }
        ctx.restore();
      }

      ctx.restore();
    }

    // 5. Header Round Indicator (Safely at y=56 below stopwatch timer)
    ctx.save();
    const pillW = 320;
    const pillH = 26;
    const pillX = width / 2 - pillW / 2;
    const pillY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 13);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.digitColor;
    ctx.font = '800 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `ROUND ${this.currentDuelRound}/${this.maxDuelRounds} • TAP TO FREEZE CLOCK AT 0.000s`,
      width / 2,
      pillY + pillH / 2
    );
    ctx.restore();

    // 6. Interactive Bottom-Left Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, height - 44, 170, 32, 16);
    else ctx.rect(20, height - 44, 170, 32);
    ctx.fill();
    ctx.strokeStyle = theme.borderColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.borderColor;
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.name} [T]`, 20 + 85, height - 44 + 16);
    ctx.restore();

    // 7. Bottom Control Hint (Offset to right, never overlapping theme pill)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '600 11px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('Tap Action / Space / Enter to Lock Time • 3 Rounds Cumulative', width - 24, height - 28);
    ctx.restore();

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const list = Array.from(this.duelists.values()).sort((a, b) => b.totalScore - a.totalScore);
    const winnerId = list.length > 0 ? list[0].id : null;
    const winnerConfig = winnerId !== null ? this.getPlayer(winnerId) : undefined;
    return {
      winnerId,
      rankings: list.map((d, idx) => ({ playerId: d.id, score: d.totalScore, place: idx + 1 })),
      mvpHighlight:
        winnerId !== null && winnerConfig
          ? `${winnerConfig.name} mastered internal stopwatch cadence with ${list[0].totalScore} points!`
          : 'Clock duel concluded!'
    };
  }
}
