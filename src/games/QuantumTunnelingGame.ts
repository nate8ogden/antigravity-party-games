import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface ColliderObstacle {
  x: number;
  y: number;
  height: number;
  isBarrier: boolean;
  isHiggsGold: boolean;
  passedBy: Set<PlayerId>;
  active: boolean;
}

interface QuantumRacer {
  id: PlayerId;
  color: string;
  x: number;
  y: number;
  vy: number;
  score: number;
  phased: boolean;
  phaseEnergy: number;
  stunTimer: number;
  streak: number;
  multiplier: number;
  underdog: boolean;
  botTimer: number;
}

type ThemeId = 'cern_collider' | 'tachyon_void' | 'antimatter_core';

interface ThemeSpec {
  name: string;
  bgTop: string;
  bgBot: string;
  railColor: string;
  barrierColor: string;
}

const THEMES: Record<ThemeId, ThemeSpec> = {
  cern_collider: {
    name: 'CERN Hadron Ring',
    bgTop: '#041022',
    bgBot: '#0c274e',
    railColor: '#38bdf8',
    barrierColor: '#f43f5e',
  },
  tachyon_void: {
    name: 'Tachyon Phase Conduit',
    bgTop: '#16072c',
    bgBot: '#34115c',
    railColor: '#c084fc',
    barrierColor: '#fb7185',
  },
  antimatter_core: {
    name: 'Antimatter Accelerator',
    bgTop: '#041f1e',
    bgBot: '#0d4744',
    railColor: '#2dd4bf',
    barrierColor: '#f97316',
  },
};

const THEME_ORDER: ThemeId[] = ['cern_collider', 'tachyon_void', 'antimatter_core'];

export class QuantumTunnelingGame extends BaseGame {
  private racers: Map<PlayerId, QuantumRacer> = new Map();
  private obstacles: ColliderObstacle[] = [];
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
    this.isFinished = false;
    this.roundTimer = 38.0;
    this.timeElapsed = 0;
    this.suddenDeath = false;
    this.hitStopTimer = 0;
    this.spawnTimer = 0.4;
    this.obstacles = [];
    this.racers.clear();
    this.floatingTexts = [];
    this.themeIndex = Math.floor(Math.random() * THEME_ORDER.length);

    const w = width || 1280;
    const h = height || 720;

    const active = this.getActivePlayers();
    active.forEach((cfg, idx) => {
      const startY = h * (0.28 + (idx / Math.max(1, active.length - 1)) * 0.44);
      this.racers.set(cfg.id, {
        id: cfg.id,
        color: cfg.color,
        x: w * 0.24,
        y: startY,
        vy: 0,
        score: 0,
        phased: false,
        phaseEnergy: 1.0,
        stunTimer: 0,
        streak: 0,
        multiplier: 1,
        underdog: false,
        botTimer: 0.16,
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

  private spawnColliderWave(w: number, h: number): void {
    const isBarrier = Math.random() < 0.62;
    const yCenter = h * (0.22 + Math.random() * 0.56);
    this.obstacles.push({
      x: w + 60,
      y: yCenter,
      height: isBarrier ? 155 : 44,
      isBarrier,
      isHiggsGold: !isBarrier,
      passedBy: new Set(),
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
      this.addFloatingText(width / 2, 105, '⚡ COLLIDER OVERDRIVE! 2X QUANTUM PTS! ⚡', '#facc15', 24);
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnColliderWave(width, height);
      this.spawnTimer = this.suddenDeath ? 0.45 : 0.68;
    }

    const scrollSpeed = (this.suddenDeath ? 490 : 380) + this.timeElapsed * 3;
    for (const ob of this.obstacles) {
      if (!ob.active) continue;
      ob.x -= scrollSpeed * dt;
      if (ob.x < -80) ob.active = false;
    }

    let maxScore = 0;
    this.racers.forEach((r) => {
      if (r.score > maxScore) maxScore = r.score;
    });

    this.updateBots(dt, width, height);

    this.racers.forEach((r) => {
      r.underdog = maxScore - r.score >= 120;

      if (r.stunTimer > 0) {
        r.stunTimer -= dt;
        r.phased = false;
      }

      const holding = r.stunTimer <= 0 && (this.input.isActionPressed(r.id) || (this.getPlayer(r.id)?.type.startsWith('bot_') && this.input.isPressed(r.id)));
      const wasPhased = r.phased;

      if (holding && r.phaseEnergy > 0.05) {
        r.phased = true;
        r.phaseEnergy -= dt * 0.72;
        if (r.phaseEnergy <= 0.05) {
          r.phased = false;
          r.phaseEnergy = 0;
          r.stunTimer = 0.9;
          r.streak = 0;
          r.multiplier = 1;
          this.audio.playStun();
          this.particles.emit(r.x, r.y, 16, '#ff2a85');
          this.addFloatingText(r.x, r.y - 24, 'DECOHERENCE BLOWOUT!', '#ff2a85', 17);
        }
      } else {
        r.phased = false;
        r.phaseEnergy = Math.min(1.0, r.phaseEnergy + dt * (r.underdog ? 0.85 : 0.65));
      }

      if (wasPhased && !r.phased && r.stunTimer <= 0) {
        this.audio.playWhoosh();
        this.racers.forEach((other) => {
          if (other.id === r.id) return;
          if (Math.abs(other.y - r.y) < 75) {
            other.vy += (other.y >= r.y ? 1 : -1) * 360;
            this.addFloatingText(other.x, other.y - 24, 'PHASE SLAMMED!', r.color, 17);
          }
        });
      }

      const throttle = -this.input.getThrottle(r.id) || this.input.getSteer(r.id);
      if (Math.abs(throttle) > 0.1 && r.stunTimer <= 0) {
        r.vy += throttle * 750 * dt;
      } else if (r.phased) {
        r.vy -= 260 * dt;
      } else {
        r.vy += 220 * dt;
      }

      r.y += r.vy * dt;
      r.vy *= 0.91;

      if (r.y < height * 0.18) {
        r.y = height * 0.18;
        r.vy = Math.abs(r.vy) * 0.6;
      } else if (r.y > height * 0.82) {
        r.y = height * 0.82;
        r.vy = -Math.abs(r.vy) * 0.6;
      }

      for (const ob of this.obstacles) {
        if (!ob.active || ob.passedBy.has(r.id)) continue;
        if (Math.abs(ob.x - r.x) < 28 && Math.abs(ob.y - r.y) < ob.height / 2 + 20) {
          ob.passedBy.add(r.id);
          if (ob.isBarrier) {
            if (r.phased) {
              r.streak++;
              r.multiplier = r.streak >= 5 ? 4 : r.streak >= 3 ? 2 : 1;
              const pts = 40 * r.multiplier * (this.suddenDeath ? 2 : 1);
              r.score += pts;
              this.audio.playScore();
              this.particles.emit(r.x, r.y, 14, '#38bdf8');
              this.addFloatingText(r.x, r.y - 24, `TUNNELED! +${pts} (${r.multiplier}x)`, '#38bdf8', 18);
            } else {
              r.streak = 0;
              r.multiplier = 1;
              r.stunTimer = 0.75;
              this.audio.playExplosion();
              this.particles.emit(r.x, r.y, 16, '#f43f5e');
              this.addFloatingText(r.x, r.y - 24, 'BARRIER CRASH!', '#f43f5e', 18);
            }
          } else if (ob.isHiggsGold) {
            if (!r.phased) {
              ob.active = false;
              r.streak++;
              r.multiplier = r.streak >= 5 ? 4 : r.streak >= 3 ? 2 : 1;
              const pts = 70 * r.multiplier * (this.suddenDeath ? 2 : 1);
              r.score += pts;
              this.audio.playChime();
              this.particles.emit(ob.x, ob.y, 16, '#facc15');
              this.addFloatingText(r.x, r.y - 26, `HIGGS BOSON! +${pts}`, '#facc15', 20);
            }
          }
        }
      }
    });

    const list = Array.from(this.racers.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (Math.abs(a.y - b.y) < 42) {
          const sign = b.y >= a.y ? 1 : -1;
          const overlap = 42 - Math.abs(a.y - b.y);
          a.y -= sign * overlap * 0.5;
          b.y += sign * overlap * 0.5;
          a.vy = -sign * 240;
          b.vy = sign * 240;
          this.audio.playBounce();
        }
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
    void width;
    const r = this.racers.get(botId);
    if (!r) return;

    r.botTimer -= dt;
    if (r.botTimer > 0) return;

    r.botTimer = difficulty === 'bot_hard' ? 0.14 : difficulty === 'bot_normal' ? 0.24 : 0.35;

    let upcoming: ColliderObstacle | null = null;
    let minDx = Infinity;
    for (const ob of this.obstacles) {
      if (!ob.active || ob.x < r.x - 10) continue;
      const dx = ob.x - r.x;
      if (dx < minDx) {
        minDx = dx;
        upcoming = ob;
      }
    }

    if (upcoming && minDx < 230) {
      if (upcoming.isBarrier && Math.abs(upcoming.y - r.y) < upcoming.height / 2 + 28) {
        this.input.setBotState(botId, r.phaseEnergy > 0.2);
        return;
      }
      if (upcoming.isHiggsGold) {
        r.vy += Math.sign(upcoming.y - r.y) * 180;
        this.input.setBotState(botId, false);
        return;
      }
    }

    this.input.setBotState(botId, r.y > height * 0.65 && r.phaseEnergy > 0.35);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[THEME_ORDER[this.themeIndex]];

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.bgTop);
    bg.addColorStop(1, theme.bgBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.strokeStyle = theme.railColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.15);
    ctx.lineTo(width, height * 0.15);
    ctx.moveTo(0, height * 0.85);
    ctx.lineTo(width, height * 0.85);
    ctx.stroke();
    ctx.restore();

    for (const ob of this.obstacles) {
      if (!ob.active) continue;
      ctx.save();
      if (ob.isBarrier) {
        ctx.fillStyle = theme.barrierColor;
        ctx.fillRect(ob.x - 14, ob.y - ob.height / 2, 28, ob.height);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(ob.x - 14, ob.y - ob.height / 2, 28, ob.height);
      } else {
        ctx.beginPath();
        ctx.arc(ob.x, ob.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = '#facc15';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 12px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★70', ob.x, ob.y);
      }
      ctx.restore();
    }

    this.racers.forEach((r) => {
      ctx.save();
      if (r.phased) {
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 32, 0, Math.PI * 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      const mood = r.stunTimer > 0 ? 'shocked' : r.phased ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, r.id, r.x, r.y, 22, mood, this.timeElapsed, 0);

      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(r.x - 24, r.y - 36, 48, 6);
      ctx.fillStyle = r.phaseEnergy < 0.25 ? '#f43f5e' : '#38bdf8';
      ctx.fillRect(r.x - 24, r.y - 36, 48 * r.phaseEnergy, 6);
      ctx.restore();
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
    const rankings = Array.from(this.racers.values())
      .map((r) => ({ playerId: r.id, score: Math.floor(r.score), place: 1 }))
      .sort((a, b) => b.score - a.score);
    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });
    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `Player ${winnerId} mastered Quantum Tunneling!` : 'Collider run complete!',
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
