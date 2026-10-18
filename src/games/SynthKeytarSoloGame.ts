import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SynthNote {
  angle: number;
  dist: number;
  speed: number;
  isGolden: boolean;
  isFeedbackBomb: boolean;
  active: boolean;
}

interface RockerPlayer {
  id: PlayerId;
  color: string;
  angle: number;
  angVel: number;
  score: number;
  stunTimer: number;
  streak: number;
  multiplier: number;
  underdog: boolean;
  ampWaveRadius: number;
  botTimer: number;
}

type ThemeId = 'outrun_sunset' | 'cyber_tokyo' | 'laser_arena';

interface ThemeSpec {
  name: string;
  bgTop: string;
  bgBot: string;
  gridColor: string;
  stageRing: string;
}

const THEMES: Record<ThemeId, ThemeSpec> = {
  outrun_sunset: {
    name: 'Outrun Sunset Stage',
    bgTop: '#16042c',
    bgBot: '#4a0e4e',
    gridColor: '#ff2a85',
    stageRing: '#00f5d4',
  },
  cyber_tokyo: {
    name: 'Neo-Tokyo Synth Dome',
    bgTop: '#040d21',
    bgBot: '#132a4a',
    gridColor: '#38bdf8',
    stageRing: '#facc15',
  },
  laser_arena: {
    name: 'Chrome Laser Stadium',
    bgTop: '#090418',
    bgBot: '#290b36',
    gridColor: '#a855f7',
    stageRing: '#ec4899',
  },
};

const THEME_ORDER: ThemeId[] = ['outrun_sunset', 'cyber_tokyo', 'laser_arena'];

export class SynthKeytarSoloGame extends BaseGame {
  private rockers: Map<PlayerId, RockerPlayer> = new Map();
  private notes: SynthNote[] = [];
  private spawnTimer = 0;
  private timeElapsed = 0;
  private suddenDeath = false;
  private hitStopTimer = 0;
  private themeIndex = 0;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 38.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
    if (typeof window !== 'undefined' && !this.keyHandler) {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.themeIndex = (this.themeIndex + 1) % THEME_ORDER.length;
          this.audio.playTap();
        } else if (e.key >= '1' && e.key <= '3') {
          this.themeIndex = parseInt(e.key, 10) - 1;
          this.audio.playTap();
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }
  }

  public reset(width: number, height: number): void {
    void width;
    void height;
    this.isFinished = false;
    this.roundTimer = 38.0;
    this.timeElapsed = 0;
    this.suddenDeath = false;
    this.hitStopTimer = 0;
    this.spawnTimer = 0.35;
    this.notes = [];
    this.rockers.clear();
    this.floatingTexts = [];
    this.themeIndex = Math.floor(Math.random() * THEME_ORDER.length);

    const active = this.getActivePlayers();
    active.forEach((cfg, idx) => {
      const a = (idx / Math.max(1, active.length)) * Math.PI * 2;
      this.rockers.set(cfg.id, {
        id: cfg.id,
        color: cfg.color,
        angle: a,
        angVel: 0,
        score: 0,
        stunTimer: 0,
        streak: 0,
        multiplier: 1,
        underdog: false,
        ampWaveRadius: 0,
        botTimer: 0.18,
      });
    });
  }

  public handlePointerDown(x: number, y: number, width: number, height: number): boolean {
    void height;
    if (y < 60 && x > width - 220) {
      this.themeIndex = (this.themeIndex + 1) % THEME_ORDER.length;
      this.audio.playTap();
      return true;
    }
    return false;
  }

  private addFloatingText(x: number, y: number, text: string, color: string, size = 18): void {
    this.floatingTexts.push({ x, y, text, color, alpha: 1, vy: -52, size });
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = `900 ${ft.size}px "Outfit", sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  private spawnNote(): void {
    const list = Array.from(this.rockers.values());
    const baseAngle =
      list.length > 0 && Math.random() < 0.75
        ? list[Math.floor(Math.random() * list.length)].angle + (Math.random() - 0.5) * 0.7
        : Math.random() * Math.PI * 2;

    const isGolden = Math.random() < (this.suddenDeath ? 0.42 : 0.25);
    const isFeedbackBomb = !isGolden && Math.random() < 0.14;
    this.notes.push({
      angle: baseAngle,
      dist: 35,
      speed: (isGolden ? 165 : 138) * (this.suddenDeath ? 1.25 : 1.0),
      isGolden,
      isFeedbackBomb,
      active: true,
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= dt * 1.1;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.timeElapsed += dt;
    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    if (this.roundTimer <= 15 && !this.suddenDeath) {
      this.suddenDeath = true;
      this.audio.playFanfare();
      this.addFloatingText(width / 2, 105, '⚡ STADIUM ENCORE OVERDRIVE! 2X HYPE! ⚡', '#facc15', 24);
    }

    const cx = width / 2;
    const cy = height / 2 + 15;
    const strikeRadius = Math.min(width, height) * 0.36;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnNote();
      if (this.suddenDeath) this.spawnNote();
      this.spawnTimer = this.suddenDeath ? 0.38 : 0.52;
    }

    for (const n of this.notes) {
      if (!n.active) continue;
      n.dist += n.speed * dt;
      if (n.dist > strikeRadius + 48) {
        n.active = false;
      }
    }

    let maxScore = 0;
    this.rockers.forEach((r) => {
      if (r.score > maxScore) maxScore = r.score;
    });

    this.updateBots(dt, width, height);

    this.rockers.forEach((r) => {
      r.underdog = maxScore - r.score >= 120;
      if (r.stunTimer > 0) r.stunTimer -= dt;
      if (r.ampWaveRadius > 0) {
        r.ampWaveRadius += 280 * dt;
        if (r.ampWaveRadius > 140) r.ampWaveRadius = 0;
      }

      const cfg = this.getPlayer(r.id);
      const isBot = cfg ? cfg.type.startsWith('bot_') : false;

      if (!isBot && r.stunTimer <= 0) {
        const steer = this.input.getSteer(r.id);
        if (Math.abs(steer) > 0.1) {
          r.angVel += steer * (r.underdog ? 9.5 : 8.0) * dt;
        } else {
          let targetNote: SynthNote | null = null;
          let bestDiff = Infinity;
          for (const n of this.notes) {
            if (!n.active || n.isFeedbackBomb) continue;
            const dAngle = Math.atan2(Math.sin(n.angle - r.angle), Math.cos(n.angle - r.angle));
            const score = Math.abs(dAngle) * 120 + Math.abs(strikeRadius - n.dist);
            if (score < bestDiff) {
              bestDiff = score;
              targetNote = n;
            }
          }
          if (targetNote) {
            const dAngle = Math.atan2(Math.sin(targetNote.angle - r.angle), Math.cos(targetNote.angle - r.angle));
            r.angVel += Math.sign(dAngle) * 5.2 * dt;
          }
        }
      }

      r.angle += r.angVel * dt;
      r.angVel *= 0.88;

      const steer = this.input.getSteer(r.id);
      const hasSteer = Math.abs(steer) > 0.1;
      const justStruck =
        r.stunTimer <= 0 && (this.input.justAction(r.id) || (isBot && this.input.justPressed(r.id)) || (!hasSteer && !isBot && this.input.justPressed(r.id)));
      if (justStruck) {
        this.strikeKeytarChord(r, cx, cy, strikeRadius);
      }
    });

    const list = Array.from(this.rockers.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const diff = Math.atan2(Math.sin(b.angle - a.angle), Math.cos(b.angle - a.angle));
        const minAng = 0.24;
        if (Math.abs(diff) < minAng) {
          const sign = diff >= 0 ? 1 : -1;
          const overlap = minAng - Math.abs(diff);
          a.angle -= sign * overlap * 0.5;
          b.angle += sign * overlap * 0.5;
          const push = 3.8;
          a.angVel = -sign * push * (b.underdog ? 1.35 : 1);
          b.angVel = sign * push * (a.underdog ? 1.35 : 1);
          this.audio.playBounce();
        }
      }
    }
  }

  private strikeKeytarChord(
    r: RockerPlayer,
    cx: number,
    cy: number,
    strikeRadius: number
  ): void {
    const px = cx + Math.cos(r.angle) * strikeRadius;
    const py = cy + Math.sin(r.angle) * strikeRadius;
    r.ampWaveRadius = 18;

    let hitAny = false;
    for (const n of this.notes) {
      if (!n.active) continue;
      const nx = cx + Math.cos(n.angle) * n.dist;
      const ny = cy + Math.sin(n.angle) * n.dist;
      const d = Math.hypot(nx - px, ny - py);
      if (d <= 62) {
        n.active = false;
        hitAny = true;

        if (n.isFeedbackBomb && !r.underdog) {
          r.streak = 0;
          r.multiplier = 1;
          r.stunTimer = 0.9;
          this.audio.playStun();
          this.particles.emit(px, py, 16, '#ff2a85');
          this.addFloatingText(px, py - 24, 'AMP FEEDBACK STUN!', '#ff2a85', 18);
          return;
        }

        const ringDelta = Math.abs(n.dist - strikeRadius);
        const isPerfect = ringDelta < 22;
        r.streak++;
        r.multiplier = r.streak >= 5 ? 4 : r.streak >= 3 ? 2 : 1;
        const basePts = (n.isGolden ? 60 : 25) + (isPerfect ? 20 : 0);
        const pts = basePts * r.multiplier * (this.suddenDeath ? 2 : 1);
        r.score += pts;

        this.audio.playTone(isPerfect ? 660 : 520, 0.14, 'sawtooth');
        this.particles.emit(px, py, 16, n.isGolden ? '#facc15' : r.color);
        this.addFloatingText(
          px,
          py - 24,
          `${isPerfect ? 'PERFECT SOLO! ' : ''}+${pts} (${r.multiplier}x)`,
          n.isGolden || isPerfect ? '#facc15' : '#00f5d4',
          isPerfect ? 20 : 18
        );

        this.rockers.forEach((other) => {
          if (other.id === r.id) return;
          const diff = Math.atan2(Math.sin(other.angle - r.angle), Math.cos(other.angle - r.angle));
          if (Math.abs(diff) < 0.55) {
            other.angVel += (diff >= 0 ? 1 : -1) * 4.8;
            this.addFloatingText(
              cx + Math.cos(other.angle) * strikeRadius,
              cy + Math.sin(other.angle) * strikeRadius - 24,
              'SONIC SHOVE!',
              r.color,
              16
            );
          }
        });
      }
    }

    if (!hitAny) {
      r.streak = 0;
      r.multiplier = 1;
      r.stunTimer = 0.65;
      this.audio.playBuzzer();
      this.addFloatingText(px, py - 22, 'MISFIRE! STREAK RESET', '#fb7185', 16);
    } else {
      this.hitStopTimer = 0.035;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const r = this.rockers.get(botId);
    if (!r) return;

    if (r.stunTimer > 0) {
      this.input.setBotState(botId, false);
      return;
    }

    const strikeRadius = Math.min(width, height) * 0.36;
    r.botTimer -= dt;

    let bestNote: SynthNote | null = null;
    let bestScore = Infinity;
    for (const n of this.notes) {
      if (!n.active || n.isFeedbackBomb) continue;
      const dAng = Math.atan2(Math.sin(n.angle - r.angle), Math.cos(n.angle - r.angle));
      const score = Math.abs(dAng) * 90 + Math.abs(strikeRadius - n.dist);
      if (score < bestScore) {
        bestScore = score;
        bestNote = n;
      }
    }

    if (bestNote) {
      const dAng = Math.atan2(Math.sin(bestNote.angle - r.angle), Math.cos(bestNote.angle - r.angle));
      const speed = difficulty === 'bot_hard' ? 7.2 : difficulty === 'bot_normal' ? 5.6 : 4.2;
      r.angVel += Math.sign(dAng) * speed * dt;

      if (r.botTimer <= 0 && Math.abs(dAng) < 0.22 && Math.abs(bestNote.dist - strikeRadius) < 34) {
        r.botTimer = difficulty === 'bot_hard' ? 0.16 : difficulty === 'bot_normal' ? 0.25 : 0.38;
        this.input.setBotState(botId, true);
        return;
      }
    }
    this.input.setBotState(botId, false);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2 + 15;
    const strikeRadius = Math.min(width, height) * 0.36;
    const theme = THEMES[THEME_ORDER[this.themeIndex]];

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.bgTop);
    bg.addColorStop(1, theme.bgBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.strokeStyle = theme.gridColor;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + this.timeElapsed * 0.15;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * strikeRadius * 1.3, cy + Math.sin(a) * strikeRadius * 1.3);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, strikeRadius, 0, Math.PI * 2);
    ctx.strokeStyle = theme.stageRing;
    ctx.lineWidth = 6;
    ctx.stroke();

    const pulse = 36 + Math.sin(this.timeElapsed * 10) * 6;
    ctx.beginPath();
    ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
    ctx.fillStyle = theme.gridColor;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();

    for (const n of this.notes) {
      if (!n.active) continue;
      const nx = cx + Math.cos(n.angle) * n.dist;
      const ny = cy + Math.sin(n.angle) * n.dist;
      ctx.save();
      ctx.beginPath();
      ctx.arc(nx, ny, n.isGolden ? 19 : 15, 0, Math.PI * 2);
      ctx.fillStyle = n.isFeedbackBomb ? '#ff2a85' : n.isGolden ? '#facc15' : '#00f5d4';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = '900 12px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.isFeedbackBomb ? '⚡' : n.isGolden ? '♫60' : '♪', nx, ny);
      ctx.restore();
    }

    this.rockers.forEach((r) => {
      const px = cx + Math.cos(r.angle) * strikeRadius;
      const py = cy + Math.sin(r.angle) * strikeRadius;

      if (r.ampWaveRadius > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, r.ampWaveRadius, 0, Math.PI * 2);
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
      }

      const mood = r.stunTimer > 0 ? 'shocked' : r.multiplier >= 2 ? 'triumph' : 'happy';
      this.drawPlayerMascot(ctx, r.id, px, py, 22, mood, this.timeElapsed, 0);

      if (r.multiplier > 1) {
        ctx.save();
        ctx.fillStyle = '#facc15';
        ctx.font = '900 13px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${r.multiplier}x HYPE`, px, py - 32);
        ctx.restore();
      }
    });

    this.renderFloatingTexts(ctx);

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(width - 215, 14, 200, 32);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 13px "Outfit", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`🎨 ${theme.name} [T]`, width - 24, 35);
    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.rockers.values())
      .map((r) => ({ playerId: r.id, score: Math.floor(r.score), place: 1 }))
      .sort((a, b) => b.score - a.score);
    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });
    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `Player ${winnerId} shredded the Synthwave Stadium!` : 'Keytar solo complete!',
    };
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    super.destroy();
  }
}
