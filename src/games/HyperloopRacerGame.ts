import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface HyperloopPod {
  id: PlayerId;
  color: string;
  progress: number;
  laneOffset: number;
  laneVel: number;
  speed: number;
  heat: number;
  score: number;
  wasHolding: boolean;
  burnoutTimer: number;
  streak: number;
  multiplier: number;
  drafting: boolean;
  underdog: boolean;
  botTimer: number;
}

type ThemeId = 'neo_shinkansen' | 'mars_vacuum_tube' | 'orbital_ring';

interface ThemeSpec {
  name: string;
  bgInner: string;
  bgOuter: string;
  trackColor: string;
  coilGlow: string;
}

const THEMES: Record<ThemeId, ThemeSpec> = {
  neo_shinkansen: {
    name: 'Neo-Shinkansen Tube',
    bgInner: '#0d2240',
    bgOuter: '#030812',
    trackColor: '#38bdf8',
    coilGlow: '#00f5d4',
  },
  mars_vacuum_tube: {
    name: 'Mars Colony Hyperloop',
    bgInner: '#3b1510',
    bgOuter: '#120403',
    trackColor: '#f97316',
    coilGlow: '#facc15',
  },
  orbital_ring: {
    name: 'Orbital Maglev Ring',
    bgInner: '#1e1040',
    bgOuter: '#070312',
    trackColor: '#c084fc',
    coilGlow: '#f472b6',
  },
};

const THEME_ORDER: ThemeId[] = ['neo_shinkansen', 'mars_vacuum_tube', 'orbital_ring'];

export class HyperloopRacerGame extends BaseGame {
  private pods: Map<PlayerId, HyperloopPod> = new Map();
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
    this.pods.clear();
    this.floatingTexts = [];
    this.themeIndex = Math.floor(Math.random() * THEME_ORDER.length);

    const active = this.getActivePlayers();
    active.forEach((cfg, idx) => {
      this.pods.set(cfg.id, {
        id: cfg.id,
        color: cfg.color,
        progress: idx * 0.12,
        laneOffset: (idx - (active.length - 1) / 2) * 18,
        laneVel: 0,
        speed: 1.4,
        heat: 0,
        score: 0,
        wasHolding: false,
        burnoutTimer: 0,
        streak: 0,
        multiplier: 1,
        drafting: false,
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

  private getPodScreenPos(pod: HyperloopPod, cx: number, cy: number, rx: number, ry: number): { x: number; y: number } {
    const rFactor = 1 + pod.laneOffset / 240;
    return {
      x: cx + Math.cos(pod.progress) * rx * rFactor,
      y: cy + Math.sin(pod.progress) * ry * rFactor,
    };
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
      this.addFloatingText(width / 2, 105, '⚡ MACH-2 VACUUM OVERDRIVE! 2X LAPS! ⚡', '#facc15', 24);
    }

    const cx = width / 2;
    const cy = height / 2 + 15;
    const rx = width * 0.36;
    const ry = height * 0.32;

    let maxProg = 0;
    this.pods.forEach((p) => {
      if (p.progress > maxProg) maxProg = p.progress;
    });

    this.updateBots(dt, width, height);

    this.pods.forEach((p) => {
      p.underdog = maxProg - p.progress > Math.PI * 1.1;

      p.drafting = false;
      this.pods.forEach((other) => {
        if (other.id === p.id) return;
        const diff = ((other.progress - p.progress) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        if (diff > 0.08 && diff < 0.55 && Math.abs(other.laneOffset - p.laneOffset) < 28) {
          p.drafting = true;
        }
      });

      if (p.burnoutTimer > 0) {
        p.burnoutTimer -= dt;
        p.speed = 0.7;
        p.heat = Math.max(0, p.heat - dt * 65);
      } else {
        const holding = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
        if (holding) {
          p.heat += dt * 62;
          p.wasHolding = true;
          const draftBonus = p.drafting ? 1.25 : 1.0;
          const underdogBonus = p.underdog ? 1.2 : 1.0;
          p.speed = Math.min(4.6, p.speed + 2.8 * draftBonus * underdogBonus * dt);

          if (p.heat >= 100) {
            p.heat = 100;
            p.wasHolding = false;
            p.burnoutTimer = 1.05;
            p.streak = 0;
            p.multiplier = 1;
            const pos = this.getPodScreenPos(p, cx, cy, rx, ry);
            this.audio.playExplosion();
            this.particles.emit(pos.x, pos.y, 18, '#ff2a85');
            this.addFloatingText(pos.x, pos.y - 24, 'COIL BURNOUT! STREAK LOST', '#ff2a85', 18);
          }
        } else {
          if (p.wasHolding) {
            p.wasHolding = false;
            const pos = this.getPodScreenPos(p, cx, cy, rx, ry);
            if (p.heat >= 75 && p.heat <= 96) {
              p.streak++;
              p.multiplier = p.streak >= 4 ? 4 : p.streak >= 2 ? 2 : 1;
              p.speed = 4.9;
              const bonusPts = 50 * p.multiplier * (this.suddenDeath ? 2 : 1);
              p.score += bonusPts;
              this.audio.playBoost();
              this.hitStopTimer = 0.04;
              this.particles.emit(pos.x, pos.y, 18, '#facc15');
              this.addFloatingText(
                pos.x,
                pos.y - 26,
                `CRYO SONIC BOOM! +${bonusPts} (${p.multiplier}x)`,
                '#facc15',
                19
              );

              this.pods.forEach((other) => {
                if (other.id === p.id) return;
                const oPos = this.getPodScreenPos(other, cx, cy, rx, ry);
                if (Math.hypot(oPos.x - pos.x, oPos.y - pos.y) < 120) {
                  other.laneVel += (other.laneOffset >= p.laneOffset ? 1 : -1) * 140;
                  other.speed *= 0.75;
                }
              });
            }
          }
          p.heat = Math.max(0, p.heat - dt * 58);
          p.speed = Math.max(1.35, p.speed - dt * 1.4);
        }
      }

      const prevLap = Math.floor(p.progress / (Math.PI * 2));
      p.progress += p.speed * dt;
      const newLap = Math.floor(p.progress / (Math.PI * 2));
      if (newLap > prevLap) {
        const lapPts = 80 * p.multiplier * (this.suddenDeath ? 2 : 1);
        p.score += lapPts;
        const pos = this.getPodScreenPos(p, cx, cy, rx, ry);
        this.audio.playScore();
        this.addFloatingText(pos.x, pos.y - 22, `LAP COMPLETE! +${lapPts}`, p.color, 18);
      }

      p.laneOffset += p.laneVel * dt;
      p.laneVel *= 0.88;
      p.laneOffset = Math.max(-34, Math.min(34, p.laneOffset));
    });

    const list = Array.from(this.pods.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const posA = this.getPodScreenPos(a, cx, cy, rx, ry);
        const posB = this.getPodScreenPos(b, cx, cy, rx, ry);
        const dist = Math.hypot(posB.x - posA.x, posB.y - posA.y);
        if (dist > 0 && dist < 40) {
          a.laneVel -= 95;
          b.laneVel += 95;
          this.audio.playBounce();
          this.particles.emit((posA.x + posB.x) / 2, (posA.y + posB.y) / 2, 8, '#ffffff');
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
    void height;
    const p = this.pods.get(botId);
    if (!p) return;

    p.botTimer -= dt;
    if (p.botTimer > 0) return;

    p.botTimer = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.22 : 0.32;

    const releaseThreshold = difficulty === 'bot_hard' ? 84 : difficulty === 'bot_normal' ? 80 : 72;
    const blunder = difficulty === 'bot_easy' ? 0.16 : difficulty === 'bot_normal' ? 0.08 : 0.02;

    if (Math.random() < blunder) {
      this.input.setBotState(botId, true);
      return;
    }

    if (p.heat >= releaseThreshold) {
      this.input.setBotState(botId, false);
    } else {
      this.input.setBotState(botId, true);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2 + 15;
    const rx = width * 0.36;
    const ry = height * 0.32;
    const theme = THEMES[THEME_ORDER[this.themeIndex]];

    const bg = ctx.createRadialGradient(cx, cy, 40, cx, cy, Math.max(width, height) * 0.65);
    bg.addColorStop(0, theme.bgInner);
    bg.addColorStop(1, theme.bgOuter);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 84;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = theme.trackColor;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    this.pods.forEach((p) => {
      const pos = this.getPodScreenPos(p, cx, cy, rx, ry);

      if (p.drafting) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 28, 0, Math.PI * 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }

      const mood = p.burnoutTimer > 0 ? 'shocked' : p.heat >= 75 ? 'triumph' : 'focused';
      this.drawPlayerMascot(ctx, p.id, pos.x, pos.y, 22, mood, this.timeElapsed, p.progress + Math.PI / 2);

      ctx.save();
      const bx = pos.x - 26;
      const by = pos.y - 36;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(bx, by, 52, 7);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
      ctx.fillRect(bx + 52 * 0.75, by, 52 * 0.2, 7);

      ctx.fillStyle = p.heat >= 75 && p.heat <= 96 ? '#facc15' : p.heat > 96 ? '#ff2a85' : p.color;
      ctx.fillRect(bx, by, 52 * (p.heat / 100), 7);
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
    const rankings = Array.from(this.pods.values())
      .map((p) => ({ playerId: p.id, score: Math.floor(p.score), place: 1 }))
      .sort((a, b) => b.score - a.score);
    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });
    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `Player ${winnerId} broke the Mach-2 Hyperloop record!` : 'Hyperloop race complete!',
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
