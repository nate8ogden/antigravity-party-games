import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';

interface ClockDuelist {
  id: PlayerId;
  x: number;
  y: number;
  stopped: boolean;
  frozenTime: number | null; // time remaining when stopped (closest to 0 is best)
  deltaFromZero: number | null; // Math.abs(frozenTime)
  roundWins: number;
  isBust: boolean; // true if player never tapped before expiration
}

export class StopAtZeroGame extends BaseGame {
  private duelists: Map<PlayerId, ClockDuelist> = new Map();
  private clockTime: number = 5.0;
  private isBlind: boolean = false;
  private state: 'COUNTDOWN_ACTIVE' | 'ROUND_RESOLVED' = 'COUNTDOWN_ACTIVE';
  private currentDuelRound: number = 1;
  private maxDuelRounds: number = 3;
  private interRoundTimer: number = 0;
  private roundWinnerId: PlayerId | null = null;
  private lastTickSecond: number = 5;

  private botTargetStopTimes: Map<PlayerId, number> = new Map();

  public init(width: number, height: number): void {
    this.reset(width, height);
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
        y: height - 130,
        stopped: false,
        frozenTime: null,
        deltaFromZero: null,
        roundWins: 0,
        isBust: false
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

    for (const d of this.duelists.values()) {
      d.stopped = false;
      d.frozenTime = null;
      d.deltaFromZero = null;
      d.isBust = false;
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    if (this.state === 'COUNTDOWN_ACTIVE') {
      this.clockTime -= dt;

      // Audible countdown rhythm during visible phase (5s, 4s, 3s)
      const sec = Math.ceil(this.clockTime);
      if (sec !== this.lastTickSecond && sec >= 3) {
        this.lastTickSecond = sec;
        if (sec === 3) {
          // Distinct chime as digits disappear into blind mode
          this.audio.playLaser();
        } else {
          this.audio.playTap();
        }
      }

      // Check blind threshold at 3.000s
      if (this.clockTime <= 3.0) {
        this.isBlind = true;
      }

      // Check player stop taps
      for (const d of this.duelists.values()) {
        if (d.stopped) continue;

        const pressed = this.input.justPressed(d.id);
        if (pressed) {
          d.stopped = true;
          d.frozenTime = this.clockTime;
          d.deltaFromZero = Math.abs(this.clockTime);
          d.isBust = false;
          this.audio.playLaser();
          this.particles.spawnSparks(d.x, d.y, '#10B981', 16);
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
            d.deltaFromZero = 99.0; // Disqualified penalty for no input
            d.isBust = true;
            this.audio.playExplosion();
          }
        }

        // Determine round winner: closest to 0.000s without missing
        const validList = Array.from(this.duelists.values())
          .filter((d) => !d.isBust && d.deltaFromZero !== null)
          .sort((a, b) => (a.deltaFromZero ?? 99) - (b.deltaFromZero ?? 99));

        if (validList.length > 0) {
          const winner = validList[0];
          // Check for true tie
          const isTie =
            validList.length > 1 &&
            Math.abs((validList[0].deltaFromZero ?? 0) - (validList[1].deltaFromZero ?? 0)) < 0.001;

          if (!isTie) {
            this.roundWinnerId = winner.id;
            winner.roundWins++;
            this.audio.playFanfare();
            const sign = (winner.frozenTime ?? 0) >= 0 ? '+' : '';
            this.particles.showFloatingText(
              `WINNER! ${sign}${(winner.frozenTime ?? 0).toFixed(3)}s (Δ ${(winner.deltaFromZero ?? 0).toFixed(3)}s)`,
              winner.x,
              winner.y - 65,
              '#10B981',
              24
            );
          } else {
            this.roundWinnerId = null;
            this.audio.playTap();
          }
        } else {
          this.roundWinnerId = null;
        }

        this.state = 'ROUND_RESOLVED';
        this.interRoundTimer = 3.2;
      }
    } else if (this.state === 'ROUND_RESOLVED') {
      this.interRoundTimer -= dt;

      // Check if match won (best of 3 or completed max rounds)
      const leader = Array.from(this.duelists.values()).sort((a, b) => b.roundWins - a.roundWins)[0];
      if (leader && leader.roundWins >= 2) {
        this.isFinished = true;
      } else if (this.currentDuelRound >= this.maxDuelRounds) {
        this.isFinished = true;
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

    // Human-calibrated internal clock estimation for a 3-second blind countdown
    if (!this.botTargetStopTimes.has(botId)) {
      let targetOffset = 0;
      if (difficulty === 'bot_hard') {
        // Hard: skilled human timing (mean error ~0.17s)
        const sign = Math.random() < 0.5 ? 1 : -1;
        targetOffset = sign * (0.08 + Math.random() * 0.18);
      } else if (difficulty === 'bot_normal') {
        // Normal: average human player counting 3s in head (mean error ~0.40s)
        // Completely beatable by humans with steady tempo
        const sign = Math.random() < 0.55 ? 1 : -1;
        targetOffset = sign * (0.22 + Math.random() * 0.38);
      } else {
        // Easy: casual competitor with large variance (mean error ~0.75s, 15% misses)
        if (Math.random() < 0.15) {
          targetOffset = -1.5; // Fails to tap before clock expires
        } else {
          const sign = Math.random() < 0.65 ? 1 : -1;
          targetOffset = sign * (0.45 + Math.random() * 0.65);
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

    // 1. Dark Industrial Vault Chassis Background
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // Industrial plate texture with corner rivets
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(40, 40, width - 80, height - 80);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 40, width - 80, height - 80);

    // Rivet studs at chassis corners
    const rivets = [
      [50, 50],
      [width - 50, 50],
      [50, height - 50],
      [width - 50, height - 50]
    ];
    ctx.fillStyle = '#64748B';
    for (const [rx, ry] of rivets) {
      ctx.beginPath();
      ctx.arc(rx, ry, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Central Giant Digital Stopwatch Display Box
    const clockW = 440;
    const clockH = 140;
    const clockX = width / 2 - clockW / 2;
    const clockY = height * 0.30;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.roundRect(clockX, clockY, clockW, clockH, 16);
    ctx.fill();
    ctx.restore();

    // Bezel border
    ctx.strokeStyle = this.isBlind && this.state === 'COUNTDOWN_ACTIVE' ? '#F59E0B' : '#38BDF8';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(clockX, clockY, clockW, clockH, 16);
    ctx.stroke();

    // Display Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.state === 'COUNTDOWN_ACTIVE') {
      if (this.isBlind) {
        // BLIND MODE: Digits hidden!
        ctx.save();
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#F59E0B';
        ctx.font = '900 64px monospace';
        ctx.fillText('?.??? s', width / 2, clockY + 54);
        ctx.restore();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.font = 'bold 13px Montserrat, sans-serif';
        ctx.fillText('BLIND COUNTDOWN! TAP CLOSEST TO 0.000s!', width / 2, clockY + clockH - 24);
      } else {
        // VISIBLE COUNTDOWN
        const displayTime = Math.max(0, this.clockTime).toFixed(3);
        ctx.save();
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#38BDF8';
        ctx.font = '900 68px monospace';
        ctx.fillText(`${displayTime} s`, width / 2, clockY + 54);
        ctx.restore();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
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
        ctx.font = '900 36px Montserrat, sans-serif';
        ctx.fillText(`${winnerConfig.name.toUpperCase()} WINS ROUND!`, width / 2, clockY + 46);

        ctx.fillStyle = '#F8FAFC';
        ctx.font = '800 18px monospace';
        const label = isEarly ? 'EARLY' : 'LATE';
        ctx.fillText(
          `STOPPED AT ${sign}${winner.frozenTime.toFixed(3)}s (${label} Δ ${(winner.deltaFromZero ?? 0).toFixed(3)}s)`,
          width / 2,
          clockY + 82
        );
      } else {
        ctx.fillStyle = '#F59E0B';
        ctx.font = '900 34px Montserrat, sans-serif';
        ctx.fillText('TIE ROUND!', width / 2, clockY + 50);

        ctx.fillStyle = '#94A3B8';
        ctx.font = '800 16px monospace';
        ctx.fillText('DEAD HEAT CLOSEST TO 0.000s', width / 2, clockY + 84);
      }

      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.font = 'bold 12px Montserrat, sans-serif';
      ctx.fillText(`NEXT ROUND IN ${Math.max(1, Math.ceil(this.interRoundTimer))}s...`, width / 2, clockY + clockH - 18);
      ctx.restore();
    }

    // 3. Render Players & Precision Stop Switches
    for (const d of this.duelists.values()) {
      ctx.save();
      const p = this.getPlayer(d.id);
      const pColor = p?.color || '#FFFFFF';
      const pName = p?.name || `Player ${d.id + 1}`;

      // Drop shadow on floor
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y + 24, 45, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Industrial Stop Button Pedestal
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.roundRect(d.x - 42, d.y - 10, 84, 38, 8);
      ctx.fill();
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Heavy Physical Slam Button
      const buttonPressed = d.stopped;
      const btnOffsetY = buttonPressed ? 6 : 0;
      ctx.fillStyle = buttonPressed ? '#475569' : pColor;
      ctx.beginPath();
      ctx.roundRect(d.x - 30, d.y - 24 + btnOffsetY, 60, 20, 6);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Button center graphic
      ctx.save();
      if (buttonPressed) {
        // Procedural padlock shackle & body
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.fillRect(d.x - 6, d.y - 12 + btnOffsetY, 12, 9);
        ctx.beginPath();
        ctx.arc(d.x, d.y - 12 + btnOffsetY, 4.5, Math.PI, 0);
        ctx.stroke();
      } else {
        // White stop square
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(d.x - 6, d.y - 18 + btnOffsetY, 12, 12);
      }
      ctx.restore();

      // Player Name Badge
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.roundRect(d.x - 48, d.y + 34, 96, 20, 10);
      ctx.fill();
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px Montserrat, sans-serif';
      ctx.fillText(pName.toUpperCase(), d.x, d.y + 44);

      // Score Pips (Round Wins)
      for (let r = 0; r < 2; r++) {
        const starX = d.x - 12 + r * 24;
        const starY = d.y + 64;
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
        const stampW = 126;
        const stampH = 34;
        const stampX = d.x - stampW / 2;
        const stampY = d.y - 72;

        const isWinner = this.state === 'ROUND_RESOLVED' && this.roundWinnerId === d.id;

        if (d.isBust) {
          // Missed / No input before expiration
          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          ctx.roundRect(stampX, stampY, stampW, stampH, 8);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = '900 12px Montserrat, sans-serif';
          ctx.fillText('MISSED!', d.x, stampY + stampH / 2);
        } else if (d.frozenTime !== null) {
          const isEarly = d.frozenTime >= 0;
          ctx.fillStyle = isWinner ? '#10B981' : isEarly ? '#0284C7' : '#D97706';
          ctx.beginPath();
          ctx.roundRect(stampX, stampY, stampW, stampH, 8);
          ctx.fill();
          ctx.strokeStyle = isWinner ? '#34D399' : '#FFFFFF';
          ctx.lineWidth = isWinner ? 2.5 : 1.5;
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = '900 11px monospace';
          const sign = isEarly ? '+' : '';
          const earlyLate = isEarly ? 'EARLY' : 'LATE';
          ctx.fillText(`${sign}${d.frozenTime.toFixed(3)}s`, d.x, stampY + 12);
          ctx.font = '800 10px Montserrat, sans-serif';
          ctx.fillText(`Δ ${(d.deltaFromZero ?? 0).toFixed(3)}s (${earlyLate})`, d.x, stampY + 25);
        }
        ctx.restore();
      }

      ctx.restore();
    }

    // 4. Header Round Indicator (Safely at y=56 below stopwatch timer)
    ctx.save();
    const pillW = 300;
    const pillH = 26;
    const pillX = width / 2 - pillW / 2;
    const pillY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 13);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#38BDF8';
    ctx.font = '800 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `ROUND ${this.currentDuelRound}/${this.maxDuelRounds} • TAP CLOSEST TO 0.000s`,
      width / 2,
      pillY + pillH / 2
    );
    ctx.restore();

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const list = Array.from(this.duelists.values()).sort((a, b) => b.roundWins - a.roundWins);
    const winnerId = list.length > 0 ? list[0].id : null;
    const winnerConfig = winnerId !== null ? this.getPlayer(winnerId) : undefined;
    return {
      winnerId,
      rankings: list.map((d, idx) => ({ playerId: d.id, score: d.roundWins, place: idx + 1 })),
      mvpHighlight:
        winnerId !== null && winnerConfig
          ? `${winnerConfig.name} had the supreme internal clock with ${list[0].roundWins} precision wins!`
          : 'Clock deadlock!'
    };
  }
}
