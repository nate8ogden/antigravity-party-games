import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface NeuralPulse {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isHarmonic: boolean;
  isGolden: boolean;
  radius: number;
  active: boolean;
}

interface SynapseFighter {
  id: PlayerId;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  charge: number;
  wasHolding: boolean;
  shieldTimer: number;
  stunTimer: number;
  streak: number;
  multiplier: number;
  underdog: boolean;
  botTimer: number;
}

type ThemeId = 'cyber_cortex' | 'quantum_loom' | 'biolum_neural';

interface ThemeSpec {
  name: string;
  bgInner: string;
  bgOuter: string;
  axonColor: string;
  coreColor: string;
}

const THEMES: Record<ThemeId, ThemeSpec> = {
  cyber_cortex: {
    name: 'Cyber Cortex Hub',
    bgInner: '#131842',
    bgOuter: '#050716',
    axonColor: '#00f5d4',
    coreColor: '#38bdf8',
  },
  quantum_loom: {
    name: 'Quantum Thought Loom',
    bgInner: '#2e1065',
    bgOuter: '#090314',
    axonColor: '#f472b6',
    coreColor: '#facc15',
  },
  biolum_neural: {
    name: 'Bioluminescent Matrix',
    bgInner: '#064e3b',
    bgOuter: '#021712',
    axonColor: '#34d399',
    coreColor: '#22d3ee',
  },
};

const THEME_ORDER: ThemeId[] = ['cyber_cortex', 'quantum_loom', 'biolum_neural'];

export class NeuralSynapseGame extends BaseGame {
  private fighters: Map<PlayerId, SynapseFighter> = new Map();
  private pulses: NeuralPulse[] = [];
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
    this.pulses = [];
    this.fighters.clear();
    this.floatingTexts = [];
    this.themeIndex = Math.floor(Math.random() * THEME_ORDER.length);

    const cx = (width || 1280) / 2;
    const cy = (height || 720) / 2 + 15;

    const active = this.getActivePlayers();
    active.forEach((cfg, idx) => {
      const a = (idx / Math.max(1, active.length)) * Math.PI * 2;
      this.fighters.set(cfg.id, {
        id: cfg.id,
        color: cfg.color,
        x: cx + Math.cos(a) * 145,
        y: cy + Math.sin(a) * 145,
        vx: 0,
        vy: 0,
        angle: a + Math.PI / 2,
        score: 0,
        charge: 0,
        wasHolding: false,
        shieldTimer: 0,
        stunTimer: 0,
        streak: 0,
        multiplier: 1,
        underdog: false,
        botTimer: 0.2,
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
    this.floatingTexts.push({ x, y, text, color, alpha: 1, vy: -50, size });
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

  private spawnNeuralPulse(w: number, h: number): void {
    const cx = w / 2;
    const cy = h / 2 + 15;
    const laneAngle = (Math.floor(Math.random() * 8) / 8) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
    const spawnDist = Math.min(w, h) * 0.46;
    const sx = cx + Math.cos(laneAngle) * spawnDist;
    const sy = cy + Math.sin(laneAngle) * spawnDist;

    const isHarmonic = Math.random() < 0.68;
    const isGolden = isHarmonic && Math.random() < (this.suddenDeath ? 0.45 : 0.25);
    const speed = (isGolden ? 195 : 155) * (this.suddenDeath ? 1.3 : 1.0);

    this.pulses.push({
      x: sx,
      y: sy,
      vx: -Math.cos(laneAngle) * speed,
      vy: -Math.sin(laneAngle) * speed,
      isHarmonic,
      isGolden,
      radius: isGolden ? 20 : 16,
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
      this.addFloatingText(width / 2, 110, '⚡ CORTEX OVERDRIVE! 2X THOUGHTS! ⚡', '#facc15', 24);
    }

    const cx = width / 2;
    const cy = height / 2 + 15;
    const arenaRadius = Math.min(width, height) * 0.43;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnNeuralPulse(width, height);
      if (this.suddenDeath) this.spawnNeuralPulse(width, height);
      this.spawnTimer = this.suddenDeath ? 0.52 : 0.72;
    }

    let maxScore = 0;
    this.fighters.forEach((f) => {
      if (f.score > maxScore) maxScore = f.score;
    });

    this.updateBots(dt, width, height);

    this.fighters.forEach((f) => {
      f.underdog = maxScore - f.score >= 120;
      if (f.stunTimer > 0) f.stunTimer -= dt;
      if (f.shieldTimer > 0) f.shieldTimer -= dt;

      const pCfg = this.getPlayer(f.id);
      const isBot = pCfg ? pCfg.type.startsWith('bot_') : false;

      if (!isBot && f.stunTimer <= 0) {
        const move = { x: this.input.getSteer(f.id), y: -this.input.getThrottle(f.id) };
        const mag = Math.hypot(move.x, move.y);
        if (mag > 0.1) {
          const accel = f.underdog ? 780 : 660;
          f.vx += (move.x / mag) * accel * dt;
          f.vy += (move.y / mag) * accel * dt;
          f.angle = Math.atan2(move.y, move.x);
        } else if (this.input.justAction(f.id) || (isBot && this.input.justPressed(f.id))) {
          f.angle += Math.PI / 4;
          f.vx += Math.cos(f.angle) * 140;
          f.vy += Math.sin(f.angle) * 140;
          this.audio.playTap();
        }
      }

      const holding = f.stunTimer <= 0 && (this.input.isActionPressed(f.id) || (isBot && this.input.isPressed(f.id)));
      if (holding) {
        f.charge = Math.min(1.2, f.charge + dt * 1.15);
        f.wasHolding = true;
      } else if (f.wasHolding) {
        f.wasHolding = false;
        if (f.charge > 0.18) {
          const power = (380 + f.charge * 360) * (f.underdog ? 1.2 : 1.0);
          f.vx += Math.cos(f.angle) * power;
          f.vy += Math.sin(f.angle) * power;
          f.shieldTimer = 0.45;
          this.audio.playBoost();
          this.particles.emit(f.x, f.y, 12, f.color);
        }
        f.charge = 0;
      }

      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vx *= 0.91;
      f.vy *= 0.91;

      const distFromCenter = Math.hypot(f.x - cx, f.y - cy);
      if (distFromCenter > arenaRadius - 24) {
        const nx = (f.x - cx) / distFromCenter;
        const ny = (f.y - cy) / distFromCenter;
        f.x = cx + nx * (arenaRadius - 24);
        f.y = cy + ny * (arenaRadius - 24);
        const dot = f.vx * nx + f.vy * ny;
        if (dot > 0) {
          f.vx -= 1.7 * dot * nx;
          f.vy -= 1.7 * dot * ny;
        }
      }
    });

    for (const pulse of this.pulses) {
      if (!pulse.active) continue;
      pulse.x += pulse.vx * dt;
      pulse.y += pulse.vy * dt;

      if (Math.hypot(pulse.x - cx, pulse.y - cy) < 28) {
        pulse.active = false;
        this.particles.emit(cx, cy, 8, pulse.isHarmonic ? '#38bdf8' : '#ff2a85');
        continue;
      }
      if (Math.hypot(pulse.x - cx, pulse.y - cy) > arenaRadius + 40) {
        pulse.active = false;
        continue;
      }

      this.fighters.forEach((f) => {
        if (!pulse.active) return;
        if (Math.hypot(f.x - pulse.x, f.y - pulse.y) < pulse.radius + 24) {
          if (pulse.isHarmonic) {
            pulse.active = false;
            f.streak++;
            f.multiplier = f.streak >= 5 ? 4 : f.streak >= 3 ? 2 : 1;
            const pts = (pulse.isGolden ? 75 : 25) * f.multiplier * (this.suddenDeath ? 2 : 1);
            f.score += pts;
            this.audio.playScore();
            this.particles.emit(pulse.x, pulse.y, 14, pulse.isGolden ? '#facc15' : '#00f5d4');
            this.addFloatingText(
              pulse.x,
              pulse.y - 18,
              `+${pts} (${f.multiplier}x)`,
              pulse.isGolden ? '#facc15' : '#00f5d4',
              18
            );
          } else {
            if (f.shieldTimer > 0 || f.underdog) {
              pulse.vx = Math.cos(f.angle) * 340;
              pulse.vy = Math.sin(f.angle) * 340;
              pulse.isHarmonic = true;
              pulse.isGolden = true;
              this.audio.playBounce();
              this.addFloatingText(f.x, f.y - 24, 'VIRUS PURIFIED!', '#38bdf8', 18);
            } else {
              pulse.active = false;
              f.streak = 0;
              f.multiplier = 1;
              f.stunTimer = 0.85;
              this.audio.playStun();
              this.particles.emit(f.x, f.y, 16, '#ff2a85');
              this.addFloatingText(f.x, f.y - 24, 'GLITCH STUN! STREAK LOST', '#ff2a85', 17);
            }
          }
        }
      });
    }

    const list = Array.from(this.fighters.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 44;
        if (dist > 0 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          const impulse = 310;
          a.vx = -nx * impulse * (b.underdog ? 1.35 : 1);
          a.vy = -ny * impulse * (b.underdog ? 1.35 : 1);
          b.vx = nx * impulse * (a.underdog ? 1.35 : 1);
          b.vy = ny * impulse * (a.underdog ? 1.35 : 1);

          this.hitStopTimer = 0.04;
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
    const f = this.fighters.get(botId);
    if (!f) return;

    if (f.stunTimer > 0) {
      this.input.setBotState(botId, false);
      return;
    }

    const cx = width / 2;
    const cy = height / 2 + 15;

    f.botTimer -= dt;
    if (f.botTimer <= 0) {
      f.botTimer = difficulty === 'bot_hard' ? 0.15 : difficulty === 'bot_normal' ? 0.24 : 0.36;

      let bestPulse: NeuralPulse | null = null;
      let bestScore = Infinity;
      for (const p of this.pulses) {
        if (!p.active || !p.isHarmonic) continue;
        const d = Math.hypot(p.x - f.x, p.y - f.y) - (p.isGolden ? 80 : 0);
        if (d < bestScore) {
          bestScore = d;
          bestPulse = p;
        }
      }

      const noise = (Math.random() - 0.5) * 0.28;
      if (bestPulse) {
        f.angle = Math.atan2(bestPulse.y - f.y, bestPulse.x - f.x) + noise;
      } else {
        f.angle = Math.atan2(cy - f.y, cx - f.x) + noise;
      }
    }

    const speed = difficulty === 'bot_hard' ? 420 : difficulty === 'bot_normal' ? 340 : 260;
    f.vx += Math.cos(f.angle) * speed * dt;
    f.vy += Math.sin(f.angle) * speed * dt;
    this.input.setBotState(botId, Math.random() < 0.35);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2 + 15;
    const arenaRadius = Math.min(width, height) * 0.43;
    const theme = THEMES[THEME_ORDER[this.themeIndex]];

    const bg = ctx.createRadialGradient(cx, cy, 30, cx, cy, Math.max(width, height) * 0.65);
    bg.addColorStop(0, theme.bgInner);
    bg.addColorStop(1, theme.bgOuter);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * arenaRadius, cy + Math.sin(a) * arenaRadius);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius, 0, Math.PI * 2);
    ctx.strokeStyle = theme.axonColor;
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 30 + Math.sin(this.timeElapsed * 6) * 4, 0, Math.PI * 2);
    ctx.fillStyle = theme.coreColor;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();

    for (const p of this.pulses) {
      if (!p.active) continue;
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.isHarmonic ? (p.isGolden ? '#facc15' : '#00f5d4') : '#ff2a85';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = '900 12px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.isHarmonic ? (p.isGolden ? '★75' : '+25') : '✖', p.x, p.y);
      ctx.restore();
    }

    this.fighters.forEach((f) => {
      if (f.charge > 0.05 || f.shieldTimer > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(f.x, f.y, 26 + f.charge * 14, 0, Math.PI * 2);
        ctx.strokeStyle = f.shieldTimer > 0 ? '#38bdf8' : f.color;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.angle);
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.moveTo(30, 0);
      ctx.lineTo(20, -7);
      ctx.lineTo(20, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      const mood = f.stunTimer > 0 ? 'shocked' : f.shieldTimer > 0 ? 'triumph' : 'focused';
      this.drawPlayerMascot(ctx, f.id, f.x, f.y, 22, mood, this.timeElapsed, 0);

      if (f.multiplier > 1) {
        ctx.save();
        ctx.fillStyle = '#facc15';
        ctx.font = '900 13px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${f.multiplier}x`, f.x, f.y - 32);
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
    const rankings = Array.from(this.fighters.values())
      .map((f) => ({ playerId: f.id, score: Math.floor(f.score), place: 1 }))
      .sort((a, b) => b.score - a.score);
    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });
    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `Player ${winnerId} synchronized the Neural Cortex!` : 'Cortex bridge complete!',
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
