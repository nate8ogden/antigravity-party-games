import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface GrappleAnchor {
  x: number;
  y: number;
  radius: number;
  pulse: number;
  isGolden: boolean;
}

interface SkyRing {
  x: number;
  y: number;
  vy: number;
  radius: number;
  points: number;
  isGold: boolean;
  active: boolean;
}

interface GrapplePlayer {
  id: PlayerId;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  tetheredAnchor: GrappleAnchor | null;
  tetherLength: number;
  swingBoost: number;
  streak: number;
  multiplier: number;
  stunTimer: number;
  underdog: boolean;
  trail: { x: number; y: number; alpha: number }[];
  botReactionTimer: number;
}

type ThemeId = 'neon_shinjuku' | 'orbital_tether' | 'synth_canyon';

interface ThemeSpec {
  name: string;
  skyTop: string;
  skyBot: string;
  spireColor: string;
  anchorGlow: string;
  fogColor: string;
}

const THEMES: Record<ThemeId, ThemeSpec> = {
  neon_shinjuku: {
    name: 'Neon Shinjuku Spires',
    skyTop: '#07091e',
    skyBot: '#1b1035',
    spireColor: '#16213e',
    anchorGlow: '#00f5d4',
    fogColor: '#ff2a85',
  },
  orbital_tether: {
    name: 'Orbital Elevator Array',
    skyTop: '#020814',
    skyBot: '#0a2239',
    spireColor: '#1d3557',
    anchorGlow: '#38bdf8',
    fogColor: '#f97316',
  },
  synth_canyon: {
    name: 'Outrun Laser Canyon',
    skyTop: '#14052b',
    skyBot: '#3b0944',
    spireColor: '#240046',
    anchorGlow: '#facc15',
    fogColor: '#a855f7',
  },
};

const THEME_ORDER: ThemeId[] = ['neon_shinjuku', 'orbital_tether', 'synth_canyon'];

export class LaserGrappleGame extends BaseGame {
  private fighters: Map<PlayerId, GrapplePlayer> = new Map();
  private anchors: GrappleAnchor[] = [];
  private rings: SkyRing[] = [];
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
    this.roundTimer = 40.0;
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
    this.roundTimer = 40.0;
    this.timeElapsed = 0;
    this.suddenDeath = false;
    this.hitStopTimer = 0;
    this.anchors = [];
    this.rings = [];
    this.fighters.clear();
    this.floatingTexts = [];
    this.themeIndex = Math.floor(Math.random() * THEME_ORDER.length);

    const w = width || 1280;
    const h = height || 720;

    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 5; c++) {
        this.anchors.push({
          x: w * (0.18 + c * 0.16) + (r % 2 === 1 ? 45 : -25),
          y: h * (0.22 + r * 0.24),
          radius: 16,
          pulse: (c + r) * 0.8,
          isGolden: c === 2 && r === 0,
        });
      }
    }

    for (let i = 0; i < 6; i++) {
      this.spawnRing(w, h);
    }

    const active = this.getActivePlayers();
    active.forEach((cfg, idx) => {
      const startX = w * (0.25 + (idx / Math.max(1, active.length - 1)) * 0.5);
      const startY = h * 0.35;
      const p: GrapplePlayer = {
        id: cfg.id,
        color: cfg.color,
        x: startX,
        y: startY,
        vx: (idx % 2 === 0 ? 1 : -1) * 160,
        vy: -80,
        angle: 0,
        score: 0,
        tetheredAnchor: null,
        tetherLength: 140,
        swingBoost: 0,
        streak: 0,
        multiplier: 1,
        stunTimer: 0,
        underdog: false,
        trail: [],
        botReactionTimer: 0.18 + Math.random() * 0.15,
      };
      p.tetheredAnchor = this.findBestAnchor(p);
      if (p.tetheredAnchor) {
        p.tetherLength = Math.hypot(p.x - p.tetheredAnchor.x, p.y - p.tetheredAnchor.y);
      }
      this.fighters.set(cfg.id, p);
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

  private spawnRing(w: number, h: number): void {
    const isGold = Math.random() < (this.suddenDeath ? 0.45 : 0.25);
    this.rings.push({
      x: w * (0.14 + Math.random() * 0.72),
      y: h * (0.18 + Math.random() * 0.56),
      vy: (Math.random() - 0.5) * 45,
      radius: isGold ? 28 : 22,
      points: isGold ? 60 : 25,
      isGold,
      active: true,
    });
  }

  private findBestAnchor(p: GrapplePlayer): GrappleAnchor | null {
    let best: GrappleAnchor | null = null;
    let bestScore = Infinity;
    for (const a of this.anchors) {
      const dx = a.x - p.x;
      const dy = a.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 340 || dist < 35) continue;
      const dirPenalty = dy > 80 ? 120 : 0;
      const score = dist + dirPenalty - (a.isGolden ? 40 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = a;
      }
    }
    return best;
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
      this.addFloatingText(width / 2, height * 0.22, '⚡ OVERDRIVE SKY STORM! 2X RINGS! ⚡', '#facc15', 24);
    }

    let maxScore = 0;
    this.fighters.forEach((p) => {
      if (p.score > maxScore) maxScore = p.score;
    });

    for (const a of this.anchors) {
      a.pulse += dt * 4;
    }

    let activeCount = 0;
    for (const ring of this.rings) {
      if (!ring.active) continue;
      activeCount++;
      ring.y += ring.vy * dt;
      if (ring.y < height * 0.14 || ring.y > height * 0.75) ring.vy *= -1;
    }
    while (activeCount < (this.suddenDeath ? 8 : 6)) {
      this.spawnRing(width, height);
      activeCount++;
    }

    this.updateBots(dt, width, height);

    this.fighters.forEach((p) => {
      p.underdog = maxScore - p.score >= 120;

      if (p.stunTimer > 0) {
        p.stunTimer -= dt;
        p.tetheredAnchor = null;
      }

      const holding = p.stunTimer <= 0 && (this.input.isActionPressed(p.id) || this.input.isPressed(p.id));
      const steer = this.input.getSteer(p.id);

      if (holding) {
        if (!p.tetheredAnchor) {
          p.tetheredAnchor = this.findBestAnchor(p);
          if (p.tetheredAnchor) {
            p.tetherLength = Math.max(65, Math.min(240, Math.hypot(p.x - p.tetheredAnchor.x, p.y - p.tetheredAnchor.y)));
            p.swingBoost = 0;
            this.audio.playTap();
          }
        }
      } else if (p.tetheredAnchor) {
        const boostFactor = 1.18 + Math.min(0.55, p.swingBoost * 0.35) + (p.underdog ? 0.18 : 0);
        p.vx *= boostFactor;
        p.vy = p.vy * boostFactor - 95;
        this.audio.playWhoosh();
        this.particles.emit(p.x, p.y, 12, p.color);
        if (p.swingBoost > 0.45) {
          this.addFloatingText(p.x, p.y - 24, 'APEX FLING!', p.color, 17);
        }
        p.tetheredAnchor = null;
        p.swingBoost = 0;
      }

      p.vy += 460 * dt;
      if (steer !== 0 && p.stunTimer <= 0) {
        p.vx += steer * (p.underdog ? 380 : 310) * dt;
      }

      if (p.tetheredAnchor) {
        const anchor = p.tetheredAnchor;
        p.swingBoost = Math.min(1.5, p.swingBoost + dt * 0.95);
        const dx = p.x - anchor.x;
        const dy = p.y - anchor.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const nx = dx / dist;
        const ny = dy / dist;
        const tx = -ny;
        const ty = nx;
        const tangentVel = p.vx * tx + p.vy * ty;
        const tangentSign = tangentVel >= 0 ? 1 : -1;
        const pumpAccel = (anchor.isGolden ? 420 : 300) * (p.underdog ? 1.2 : 1.0);
        p.vx += tx * tangentSign * pumpAccel * dt;
        p.vy += ty * tangentSign * pumpAccel * dt;
        p.tetherLength = Math.max(75, p.tetherLength - 28 * dt);
        p.x = anchor.x + nx * p.tetherLength;
        p.y = anchor.y + ny * p.tetherLength;

        const radialDot = p.vx * nx + p.vy * ny;
        if (radialDot > 0) {
          p.vx -= radialDot * nx;
          p.vy -= radialDot * ny;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.994;
      p.vy *= 0.994;
      p.angle = Math.atan2(p.vy, p.vx);

      if (p.x < 40) {
        p.x = 40;
        p.vx = Math.abs(p.vx) * 0.85;
        this.audio.playBounce();
      } else if (p.x > width - 40) {
        p.x = width - 40;
        p.vx = -Math.abs(p.vx) * 0.85;
        this.audio.playBounce();
      }
      if (p.y < 55) {
        p.y = 55;
        p.vy = Math.abs(p.vy) * 0.7;
      }

      const fogY = height - (this.suddenDeath ? 85 : 58);
      if (p.y > fogY) {
        p.streak = 0;
        p.multiplier = 1;
        p.stunTimer = 0.65;
        p.tetheredAnchor = null;
        p.y = height * 0.22;
        p.vx = (Math.random() - 0.5) * 220;
        p.vy = -60;
        this.audio.playStun();
        this.particles.emit(p.x, fogY, 16, '#ff2a85');
        this.addFloatingText(p.x, fogY - 30, 'SHOCK FOG! STREAK RESET', '#ff2a85', 16);
      }

      for (const ring of this.rings) {
        if (!ring.active) continue;
        if (Math.hypot(p.x - ring.x, p.y - ring.y) < ring.radius + 22) {
          ring.active = false;
          p.streak++;
          p.multiplier = p.streak >= 5 ? 4 : p.streak >= 3 ? 2 : 1;
          const pts = ring.points * p.multiplier * (this.suddenDeath ? 2 : 1);
          p.score += pts;
          this.audio.playScore();
          this.particles.emit(ring.x, ring.y, 16, ring.isGold ? '#facc15' : p.color);
          this.addFloatingText(
            ring.x,
            ring.y - 16,
            `+${pts} (${p.multiplier}x)`,
            ring.isGold ? '#facc15' : '#38bdf8',
            ring.isGold ? 21 : 18
          );
        }
      }

      p.trail.push({ x: p.x, y: p.y, alpha: 0.75 });
      if (p.trail.length > 14) p.trail.shift();
      for (const t of p.trail) t.alpha *= 0.9;
    });

    // Mid-air player-to-player collisions
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

          const speedA = Math.hypot(a.vx, a.vy);
          const speedB = Math.hypot(b.vx, b.vy);
          const impulse = Math.max(240, (speedA + speedB) * 0.65);

          a.vx = -nx * impulse * (b.underdog ? 1.35 : 1);
          a.vy = -ny * impulse * (b.underdog ? 1.35 : 1) - 60;
          b.vx = nx * impulse * (a.underdog ? 1.35 : 1);
          b.vy = ny * impulse * (a.underdog ? 1.35 : 1) - 60;

          if (speedA > speedB + 60 && b.tetheredAnchor) {
            b.tetheredAnchor = null;
            b.stunTimer = 0.45;
            a.score += 50;
            this.addFloatingText(b.x, b.y - 25, 'SKY SLAM! +50', '#facc15', 20);
          } else if (speedB > speedA + 60 && a.tetheredAnchor) {
            a.tetheredAnchor = null;
            a.stunTimer = 0.45;
            b.score += 50;
            this.addFloatingText(a.x, a.y - 25, 'SKY SLAM! +50', '#facc15', 20);
          }

          this.hitStopTimer = 0.045;
          this.audio.playExplosion();
          this.particles.emit((a.x + b.x) / 2, (a.y + b.y) / 2, 16, '#ffffff');
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
    const p = this.fighters.get(botId);
    if (!p) return;

    p.botReactionTimer -= dt;
    if (p.botReactionTimer > 0) return;

    const delay = difficulty === 'bot_hard' ? 0.14 : difficulty === 'bot_normal' ? 0.24 : 0.36;
    p.botReactionTimer = delay + Math.random() * 0.08;

    let targetRing: SkyRing | null = null;
    let bestDist = Infinity;
    for (const r of this.rings) {
      if (!r.active) continue;
      const d = Math.hypot(r.x - p.x, r.y - p.y) - (r.isGold ? 90 : 0);
      if (d < bestDist) {
        bestDist = d;
        targetRing = r;
      }
    }

    const blunder = difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.12 : 0.03;
    if (Math.random() < blunder) {
      this.input.setBotState(botId, Math.random() < 0.5);
      return;
    }

    if (p.y > height * 0.58 || (!p.tetheredAnchor && p.vy > 80)) {
      this.input.setBotState(botId, true);
    } else if (p.tetheredAnchor) {
      const towardRing =
        targetRing &&
        (targetRing.x - p.x) * p.vx + (targetRing.y - p.y) * p.vy > 0 &&
        p.vy < -40;
      if (towardRing || p.swingBoost > 0.65) {
        this.input.setBotState(botId, false);
      } else {
        this.input.setBotState(botId, true);
      }
    } else {
      this.input.setBotState(botId, Math.random() < 0.45);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[THEME_ORDER[this.themeIndex]];

    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, theme.skyTop);
    skyGrad.addColorStop(1, theme.skyBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = theme.spireColor;
    for (let i = 0; i < 9; i++) {
      const sx = i * (width / 8) - 30;
      const sh = 180 + ((i * 97) % 240);
      ctx.fillRect(sx, height - sh, 95, sh);
    }

    for (const a of this.anchors) {
      ctx.save();
      const glowRadius = a.radius + 8 + Math.sin(a.pulse) * 4;
      ctx.beginPath();
      ctx.arc(a.x, a.y, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = a.isGolden ? 'rgba(250, 204, 21, 0.25)' : 'rgba(0, 245, 212, 0.2)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
      ctx.fillStyle = a.isGolden ? '#facc15' : theme.anchorGlow;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();
    }

    for (const r of this.rings) {
      if (!r.active) continue;
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.beginPath();
      ctx.arc(0, 0, r.radius, 0, Math.PI * 2);
      ctx.lineWidth = 6;
      ctx.strokeStyle = r.isGold ? '#facc15' : '#38bdf8';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 13px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(r.isGold ? '★60' : '+25', 0, 0);
      ctx.restore();
    }

    this.fighters.forEach((p) => {
      for (let i = 0; i < p.trail.length; i++) {
        const t = p.trail[i];
        ctx.save();
        ctx.globalAlpha = t.alpha * 0.4;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 8 + i * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.restore();
      }

      if (p.tetheredAnchor) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.tetheredAnchor.x, p.tetheredAnchor.y);
        ctx.lineWidth = 4 + p.swingBoost * 3;
        ctx.strokeStyle = p.color;
        ctx.stroke();
        ctx.restore();
      }

      const mood = p.stunTimer > 0 ? 'shocked' : p.tetheredAnchor ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, p.id, p.x, p.y, 22, mood, this.timeElapsed, p.angle * 0.25);

      if (p.multiplier > 1) {
        ctx.save();
        ctx.fillStyle = '#facc15';
        ctx.font = '900 13px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${p.multiplier}x STREAK`, p.x, p.y - 32);
        ctx.restore();
      }
    });

    const fogY = height - (this.suddenDeath ? 85 : 58);
    const fogGrad = ctx.createLinearGradient(0, fogY - 15, 0, height);
    fogGrad.addColorStop(0, 'rgba(255, 42, 133, 0)');
    fogGrad.addColorStop(0.4, theme.fogColor);
    fogGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, fogY - 15, width, height - fogY + 15);

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
      .map((p) => ({ playerId: p.id, score: Math.floor(p.score), place: 1 }))
      .sort((a, b) => b.score - a.score);
    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });
    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `Player ${winnerId} ruled the Laser Grapple Spires!` : 'Skyline grapple complete!',
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
