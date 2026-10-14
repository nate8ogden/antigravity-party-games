import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SugarStrand {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isRainbowGold: boolean;
  isBurntGlob: boolean;
  active: boolean;
}

interface CandySpinner {
  id: PlayerId;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  flossSize: number;
  charge: number;
  wasHolding: boolean;
  score: number;
  streak: number;
  multiplier: number;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
}

type ThemeId = 'pastel_fairground' | 'neon_candy_rave' | 'starlight_confectionery';

interface ThemeSpec {
  name: string;
  drumInner: string;
  drumOuter: string;
  rimColor: string;
}

const THEMES: Record<ThemeId, ThemeSpec> = {
  pastel_fairground: {
    name: 'Sugar Cloud Fairground',
    drumInner: '#4a044e',
    drumOuter: '#1e1b4b',
    rimColor: '#f472b6',
  },
  neon_candy_rave: {
    name: 'Neon Cotton Candy Rave',
    drumInner: '#0f172a',
    drumOuter: '#020617',
    rimColor: '#38bdf8',
  },
  starlight_confectionery: {
    name: 'Starlight Sweet Shoppe',
    drumInner: '#3b0764',
    drumOuter: '#140326',
    rimColor: '#facc15',
  },
};

const THEME_ORDER: ThemeId[] = ['pastel_fairground', 'neon_candy_rave', 'starlight_confectionery'];

export class CottonCandySpinGame extends BaseGame {
  private spinners: Map<PlayerId, CandySpinner> = new Map();
  private strands: SugarStrand[] = [];
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
    this.spawnTimer = 0.25;
    this.strands = [];
    this.spinners.clear();
    this.floatingTexts = [];
    this.themeIndex = Math.floor(Math.random() * THEME_ORDER.length);

    const w = width || 1280;
    const h = height || 720;
    const cx = w / 2;
    const cy = h / 2 + 15;

    const active = this.getActivePlayers();
    active.forEach((cfg, idx) => {
      const a = (idx / Math.max(1, active.length)) * Math.PI * 2;
      this.spinners.set(cfg.id, {
        id: cfg.id,
        color: cfg.color,
        x: cx + Math.cos(a) * 145,
        y: cy + Math.sin(a) * 145,
        vx: 0,
        vy: 0,
        angle: a + Math.PI / 2,
        flossSize: 1,
        charge: 0,
        wasHolding: false,
        score: 0,
        streak: 0,
        multiplier: 1,
        stunTimer: 0,
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

  private spawnSugarStrand(cx: number, cy: number): void {
    const a = Math.random() * Math.PI * 2;
    const isRainbowGold = Math.random() < (this.suddenDeath ? 0.42 : 0.25);
    const isBurntGlob = !isRainbowGold && Math.random() < 0.15;
    const speed = (isRainbowGold ? 165 : 130) * (this.suddenDeath ? 1.25 : 1.0);

    this.strands.push({
      x: cx + Math.cos(a) * 28,
      y: cy + Math.sin(a) * 28,
      vx: Math.cos(a + 0.35) * speed,
      vy: Math.sin(a + 0.35) * speed,
      isRainbowGold,
      isBurntGlob,
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
      this.addFloatingText(width / 2, 100, '⚡ RAINBOW SUGAR STORM! 2X FLOSS! ⚡', '#facc15', 24);
    }

    const cx = width / 2;
    const cy = height / 2 + 15;
    const drumRadius = Math.min(width, height) * 0.42;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnSugarStrand(cx, cy);
      if (this.suddenDeath) this.spawnSugarStrand(cx, cy);
      this.spawnTimer = this.suddenDeath ? 0.34 : 0.48;
    }

    let maxScore = 0;
    this.spinners.forEach((s) => {
      if (s.score > maxScore) maxScore = s.score;
    });

    this.updateBots(dt, width, height);

    this.spinners.forEach((s) => {
      s.underdog = maxScore - s.score >= 120;
      if (s.stunTimer > 0) s.stunTimer -= dt;

      const cfg = this.getPlayer(s.id);
      const isBot = cfg ? cfg.type.startsWith('bot_') : false;

      if (!isBot && s.stunTimer <= 0) {
        const move = { x: this.input.getSteer(s.id), y: -this.input.getThrottle(s.id) };
        const mag = Math.hypot(move.x, move.y);
        if (mag > 0.1) {
          s.angle = Math.atan2(move.y, move.x);
          const accel = s.underdog ? 740 : 620;
          s.vx += (move.x / mag) * accel * dt;
          s.vy += (move.y / mag) * accel * dt;
        } else if (this.input.justPressed(s.id) || this.input.justAction(s.id)) {
          s.angle += Math.PI / 4;
          s.vx += Math.cos(s.angle) * 165;
          s.vy += Math.sin(s.angle) * 165;
          this.audio.playTap();
        }
      }

      const holding = s.stunTimer <= 0 && (this.input.isActionPressed(s.id) || this.input.isPressed(s.id));
      if (holding) {
        s.charge = Math.min(1.1, s.charge + dt * 1.15);
        s.wasHolding = true;
      } else if (s.wasHolding) {
        s.wasHolding = false;
        if (s.charge > 0.16) {
          const boost = (360 + s.charge * 340) * (s.underdog ? 1.2 : 1.0);
          s.vx += Math.cos(s.angle) * boost;
          s.vy += Math.sin(s.angle) * boost;
          this.audio.playBoost();
          this.particles.emit(s.x, s.y, 12, s.color);
        }
        s.charge = 0;
      }

      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.91;
      s.vy *= 0.91;

      const distC = Math.hypot(s.x - cx, s.y - cy);
      if (distC > drumRadius - 24) {
        const nx = (s.x - cx) / distC;
        const ny = (s.y - cy) / distC;
        s.x = cx + nx * (drumRadius - 24);
        s.y = cy + ny * (drumRadius - 24);
        s.vx *= -0.7;
        s.vy *= -0.7;
      }
    });

    // Update Sugar Strands & Collection
    for (const st of this.strands) {
      if (!st.active) continue;
      st.x += st.vx * dt;
      st.y += st.vy * dt;
      if (Math.hypot(st.x - cx, st.y - cy) > drumRadius) {
        st.active = false;
        continue;
      }

      this.spinners.forEach((s) => {
        if (!st.active) return;
        const reach = 26 + Math.min(16, s.flossSize * 2);
        if (Math.hypot(s.x - st.x, s.y - st.y) < reach) {
          st.active = false;
          if (st.isBurntGlob && !s.underdog) {
            s.streak = 0;
            s.multiplier = 1;
            s.flossSize = Math.max(1, s.flossSize - 2);
            s.stunTimer = 0.85;
            this.audio.playStun();
            this.particles.emit(s.x, s.y, 16, '#ff2a85');
            this.addFloatingText(s.x, s.y - 24, 'BURNT MOLASSES GLOB!', '#ff2a85', 17);
          } else {
            s.streak++;
            s.flossSize = Math.min(8, s.flossSize + 1);
            s.multiplier = s.streak >= 5 ? 4 : s.streak >= 3 ? 2 : 1;
            const pts = (st.isRainbowGold ? 65 : 20) * s.multiplier * (this.suddenDeath ? 2 : 1);
            s.score += pts;
            this.audio.playScore();
            this.particles.emit(st.x, st.y, 14, st.isRainbowGold ? '#facc15' : '#f472b6');
            this.addFloatingText(
              st.x,
              st.y - 20,
              `+${pts} (${s.multiplier}x)`,
              st.isRainbowGold ? '#facc15' : '#f472b6',
              18
            );
          }
        }
      });
    }

    // Elastic player-to-player cone collisions
    const list = Array.from(this.spinners.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < 46) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = 46 - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;
          a.vx = -nx * 310;
          a.vy = -ny * 310;
          b.vx = nx * 310;
          b.vy = ny * 310;
          this.hitStopTimer = 0.035;
          this.audio.playBounce();
          this.particles.emit((a.x + b.x) / 2, (a.y + b.y) / 2, 12, '#ffffff');
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
    const s = this.spinners.get(botId);
    if (!s || s.stunTimer > 0) {
      this.input.setBotState(botId, false);
      return;
    }

    const cx = width / 2;
    const cy = height / 2 + 15;

    s.botTimer -= dt;
    if (s.botTimer <= 0) {
      s.botTimer = difficulty === 'bot_hard' ? 0.14 : difficulty === 'bot_normal' ? 0.24 : 0.36;

      let best: SugarStrand | null = null;
      let bestScore = Infinity;
      for (const st of this.strands) {
        if (!st.active || st.isBurntGlob) continue;
        const d = Math.hypot(st.x - s.x, st.y - s.y) - (st.isRainbowGold ? 90 : 0);
        if (d < bestScore) {
          bestScore = d;
          best = st;
        }
      }

      if (best) {
        s.angle = Math.atan2(best.y - s.y, best.x - s.x) + (Math.random() - 0.5) * 0.24;
      } else {
        s.angle = Math.atan2(cy - s.y, cx - s.x);
      }
    }

    const speed = difficulty === 'bot_hard' ? 420 : difficulty === 'bot_normal' ? 340 : 260;
    s.vx += Math.cos(s.angle) * speed * dt;
    s.vy += Math.sin(s.angle) * speed * dt;
    this.input.setBotState(botId, Math.random() < 0.35);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2 + 15;
    const drumRadius = Math.min(width, height) * 0.42;
    const theme = THEMES[THEME_ORDER[this.themeIndex]];

    const bg = ctx.createRadialGradient(cx, cy, 30, cx, cy, Math.max(width, height) * 0.65);
    bg.addColorStop(0, theme.drumInner);
    bg.addColorStop(1, theme.drumOuter);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Spinning Sugar Drum
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, drumRadius, 0, Math.PI * 2);
    ctx.strokeStyle = theme.rimColor;
    ctx.lineWidth = 7;
    ctx.stroke();

    // Central Sugar Spinner Head
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.fillStyle = '#f472b6';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();

    // Draw Sugar Strands
    for (const st of this.strands) {
      if (!st.active) continue;
      ctx.save();
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.isRainbowGold ? 18 : 14, 0, Math.PI * 2);
      ctx.fillStyle = st.isBurntGlob ? '#ff2a85' : st.isRainbowGold ? '#facc15' : '#f472b6';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = '900 11px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(st.isBurntGlob ? '🔥' : st.isRainbowGold ? '🌈65' : '☁️', st.x, st.y);
      ctx.restore();
    }

    // Draw Spinners & Fluffy Cotton Candy Halos
    this.spinners.forEach((s) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(s.x, s.y, 22 + s.flossSize * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(244, 114, 182, 0.32)';
      ctx.fill();
      ctx.restore();

      const mood = s.stunTimer > 0 ? 'shocked' : s.multiplier >= 2 ? 'triumph' : 'happy';
      this.drawPlayerMascot(ctx, s.id, s.x, s.y, 22, mood, this.timeElapsed, 0);
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
    const rankings = Array.from(this.spinners.values())
      .map((s) => ({ playerId: s.id, score: Math.floor(s.score), place: 1 }))
      .sort((a, b) => b.score - a.score);
    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });
    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `Player ${winnerId} spun the biggest Rainbow Sugar Cloud!` : 'Cotton candy spin complete!',
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
