import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SwarmDrone {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isCarrier: boolean;
  isBomb: boolean;
  active: boolean;
}

interface EmpWave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

interface BastionPlayer {
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
  stunTimer: number;
  streak: number;
  multiplier: number;
  underdog: boolean;
  botTimer: number;
}

type ThemeId = 'aegis_vault' | 'orbital_defense' | 'neon_citadel';

interface ThemeSpec {
  name: string;
  bgInner: string;
  bgOuter: string;
  ringColor: string;
}

const THEMES: Record<ThemeId, ThemeSpec> = {
  aegis_vault: {
    name: 'Aegis Data Vault',
    bgInner: '#0f2942',
    bgOuter: '#040b14',
    ringColor: '#38bdf8',
  },
  orbital_defense: {
    name: 'Orbital Bastion Grid',
    bgInner: '#271549',
    bgOuter: '#080312',
    ringColor: '#c084fc',
  },
  neon_citadel: {
    name: 'Cyber Citadel Core',
    bgInner: '#06373a',
    bgOuter: '#021012',
    ringColor: '#2dd4bf',
  },
};

const THEME_ORDER: ThemeId[] = ['aegis_vault', 'orbital_defense', 'neon_citadel'];

export class DroneSwarmDefenseGame extends BaseGame {
  private fighters: Map<PlayerId, BastionPlayer> = new Map();
  private drones: SwarmDrone[] = [];
  private waves: EmpWave[] = [];
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
    this.drones = [];
    this.waves = [];
    this.fighters.clear();
    this.floatingTexts = [];
    this.themeIndex = Math.floor(Math.random() * THEME_ORDER.length);

    const w = width || 1280;
    const h = height || 720;
    const cx = w / 2;
    const cy = h / 2 + 15;

    const active = this.getActivePlayers();
    active.forEach((cfg, idx) => {
      const a = (idx / Math.max(1, active.length)) * Math.PI * 2;
      this.fighters.set(cfg.id, {
        id: cfg.id,
        color: cfg.color,
        x: cx + Math.cos(a) * 120,
        y: cy + Math.sin(a) * 120,
        vx: 0,
        vy: 0,
        angle: a,
        score: 0,
        charge: 0,
        wasHolding: false,
        stunTimer: 0,
        streak: 0,
        multiplier: 1,
        underdog: false,
        botTimer: 0.2,
      });
    });

    for (let i = 0; i < 6; i++) {
      this.spawnDrone(w, h);
    }
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

  private spawnDrone(w: number, h: number): void {
    const cx = w / 2;
    const cy = h / 2 + 15;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.min(w, h) * 0.45;
    const sx = cx + Math.cos(angle) * dist;
    const sy = cy + Math.sin(angle) * dist;

    const isCarrier = Math.random() < (this.suddenDeath ? 0.35 : 0.22);
    const isBomb = !isCarrier && Math.random() < 0.16;
    const speed = (isCarrier ? 115 : 85) * (this.suddenDeath ? 1.25 : 1.0);
    const targetOffset = (Math.random() - 0.5) * 0.6;

    this.drones.push({
      x: sx,
      y: sy,
      vx: -Math.cos(angle + targetOffset) * speed,
      vy: -Math.sin(angle + targetOffset) * speed,
      radius: isCarrier ? 18 : 13,
      isCarrier,
      isBomb,
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

    for (let i = this.waves.length - 1; i >= 0; i--) {
      const wv = this.waves[i];
      wv.radius += (wv.maxRadius - wv.radius) * 10 * dt;
      wv.alpha -= dt * 2.4;
      if (wv.alpha <= 0) this.waves.splice(i, 1);
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
      this.addFloatingText(width / 2, 110, '⚡ SWARM FRENZY! 2X EMP POINTS! ⚡', '#facc15', 24);
    }

    const cx = width / 2;
    const cy = height / 2 + 15;
    const arenaRadius = Math.min(width, height) * 0.43;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnDrone(width, height);
      if (this.suddenDeath) this.spawnDrone(width, height);
      this.spawnTimer = this.suddenDeath ? 0.42 : 0.65;
    }

    let maxScore = 0;
    this.fighters.forEach((p) => {
      if (p.score > maxScore) maxScore = p.score;
    });

    for (const d of this.drones) {
      if (!d.active) continue;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      const distC = Math.hypot(d.x - cx, d.y - cy);
      if (distC > arenaRadius) {
        const nx = (d.x - cx) / distC;
        const ny = (d.y - cy) / distC;
        d.vx = -nx * 95;
        d.vy = -ny * 95;
      }
    }

    this.updateBots(dt, width, height);

    this.fighters.forEach((p) => {
      p.underdog = maxScore - p.score >= 120;
      if (p.stunTimer > 0) p.stunTimer -= dt;

      const cfg = this.getPlayer(p.id);
      const isBot = cfg ? cfg.type.startsWith('bot_') : false;

      if (!isBot && p.stunTimer <= 0) {
        const move = { x: this.input.getSteer(p.id), y: -this.input.getThrottle(p.id) };
        const mag = Math.hypot(move.x, move.y);
        if (mag > 0.1) {
          p.angle = Math.atan2(move.y, move.x);
          p.vx += (move.x / mag) * (p.underdog ? 720 : 600) * dt;
          p.vy += (move.y / mag) * (p.underdog ? 720 : 600) * dt;
        } else {
          let closest: SwarmDrone | null = null;
          let minD = Infinity;
          for (const d of this.drones) {
            if (!d.active || d.isBomb) continue;
            const dist = Math.hypot(d.x - p.x, d.y - p.y);
            if (dist < minD) {
              minD = dist;
              closest = d;
            }
          }
          if (closest) {
            p.angle = Math.atan2(closest.y - p.y, closest.x - p.x);
            p.vx += Math.cos(p.angle) * 280 * dt;
            p.vy += Math.sin(p.angle) * 280 * dt;
          }
        }
      }

      const holding = p.stunTimer <= 0 && (this.input.isActionPressed(p.id) || this.input.isPressed(p.id));
      if (holding) {
        p.charge += dt * 0.95;
        p.wasHolding = true;
        if (p.charge >= 1.25) {
          p.charge = 0;
          p.wasHolding = false;
          p.stunTimer = 1.1;
          p.streak = 0;
          p.multiplier = 1;
          this.audio.playStun();
          this.particles.emit(p.x, p.y, 18, '#ff2a85');
          this.addFloatingText(p.x, p.y - 28, 'EMP OVERCHARGE! STUNNED', '#ff2a85', 17);
        }
      } else if (p.wasHolding) {
        p.wasHolding = false;
        this.detonateEmp(p);
        p.charge = 0;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.9;
      p.vy *= 0.9;

      const distC = Math.hypot(p.x - cx, p.y - cy);
      if (distC > arenaRadius - 24) {
        const nx = (p.x - cx) / distC;
        const ny = (p.y - cy) / distC;
        p.x = cx + nx * (arenaRadius - 24);
        p.y = cy + ny * (arenaRadius - 24);
        p.vx *= -0.6;
        p.vy *= -0.6;
      }
    });

    const list = Array.from(this.fighters.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < 44) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = 44 - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;
          a.vx -= nx * 260;
          a.vy -= ny * 260;
          b.vx += nx * 260;
          b.vy += ny * 260;
          this.audio.playBounce();
        }
      }
    }
  }

  private detonateEmp(p: BastionPlayer): void {
    const empRadius = 68 + p.charge * 125 + (p.underdog ? 28 : 0);
    this.waves.push({
      x: p.x,
      y: p.y,
      radius: 20,
      maxRadius: empRadius,
      color: p.color,
      alpha: 1,
    });

    p.vx += Math.cos(p.angle) * (180 + p.charge * 180);
    p.vy += Math.sin(p.angle) * (180 + p.charge * 180);
    this.audio.playExplosion();

    let hits = 0;
    let ptsGained = 0;
    let hitBomb = false;

    for (const d of this.drones) {
      if (!d.active) continue;
      if (Math.hypot(d.x - p.x, d.y - p.y) <= empRadius + d.radius) {
        d.active = false;
        if (d.isBomb && !p.underdog) {
          hitBomb = true;
        } else {
          hits++;
          ptsGained += d.isCarrier ? 60 : 20;
          this.particles.emit(d.x, d.y, 10, d.isCarrier ? '#facc15' : p.color);
        }
      }
    }

    this.fighters.forEach((other) => {
      if (other.id === p.id) return;
      const dist = Math.hypot(other.x - p.x, other.y - p.y);
      if (dist > 0 && dist <= empRadius) {
        const nx = (other.x - p.x) / dist;
        const ny = (other.y - p.y) / dist;
        other.vx += nx * 420;
        other.vy += ny * 420;
        other.charge = 0;
        this.addFloatingText(other.x, other.y - 24, 'EMP BLASTED!', p.color, 17);
      }
    });

    if (hitBomb) {
      p.streak = 0;
      p.multiplier = 1;
      p.stunTimer = 0.85;
      this.audio.playStun();
      this.addFloatingText(p.x, p.y - 26, 'DECOY MINE HIT! STUNNED', '#ff2a85', 17);
    } else if (hits > 0) {
      p.streak += hits;
      p.multiplier = p.streak >= 6 ? 4 : p.streak >= 3 ? 2 : 1;
      const total = ptsGained * p.multiplier * (this.suddenDeath ? 2 : 1);
      p.score += total;
      this.hitStopTimer = 0.04;
      this.addFloatingText(
        p.x,
        p.y - 28,
        `+${total} (${hits} DRONES • ${p.multiplier}x)`,
        hits >= 3 ? '#facc15' : '#38bdf8',
        hits >= 3 ? 21 : 18
      );
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
    const p = this.fighters.get(botId);
    if (!p) return;

    if (p.stunTimer > 0) {
      this.input.setBotState(botId, false);
      return;
    }

    p.botTimer -= dt;
    let target: SwarmDrone | null = null;
    let bestD = Infinity;
    for (const d of this.drones) {
      if (!d.active || d.isBomb) continue;
      const dist = Math.hypot(d.x - p.x, d.y - p.y) - (d.isCarrier ? 60 : 0);
      if (dist < bestD) {
        bestD = dist;
        target = d;
      }
    }

    if (target) {
      p.angle = Math.atan2(target.y - p.y, target.x - p.x);
      p.vx += Math.cos(p.angle) * 320 * dt;
      p.vy += Math.sin(p.angle) * 320 * dt;
    }

    const nearbyCount = this.drones.filter(
      (d) => d.active && !d.isBomb && Math.hypot(d.x - p.x, d.y - p.y) < 130
    ).length;

    const maxSafeCharge = difficulty === 'bot_hard' ? 0.88 : difficulty === 'bot_normal' ? 0.68 : 0.48;
    if (p.charge > maxSafeCharge || (nearbyCount >= 2 && p.charge > 0.35)) {
      this.input.setBotState(botId, false);
    } else if (nearbyCount >= 1 || (target && bestD < 160)) {
      this.input.setBotState(botId, true);
    } else {
      this.input.setBotState(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2 + 15;
    const arenaRadius = Math.min(width, height) * 0.43;
    const theme = THEMES[THEME_ORDER[this.themeIndex]];

    const bg = ctx.createRadialGradient(cx, cy, 20, cx, cy, Math.max(width, height) * 0.65);
    bg.addColorStop(0, theme.bgInner);
    bg.addColorStop(1, theme.bgOuter);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    for (let r = 90; r <= arenaRadius; r += 90) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRadius, 0, Math.PI * 2);
    ctx.strokeStyle = theme.ringColor;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();

    for (const wv of this.waves) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, wv.alpha);
      ctx.beginPath();
      ctx.arc(wv.x, wv.y, wv.radius, 0, Math.PI * 2);
      ctx.strokeStyle = wv.color;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.fillStyle = wv.color;
      ctx.globalAlpha = Math.max(0, wv.alpha * 0.2);
      ctx.fill();
      ctx.restore();
    }

    for (const d of this.drones) {
      if (!d.active) continue;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.beginPath();
      ctx.arc(0, 0, d.radius, 0, Math.PI * 2);
      ctx.fillStyle = d.isBomb ? '#ff2a85' : d.isCarrier ? '#facc15' : '#38bdf8';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.font = '900 11px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.isBomb ? '💣' : d.isCarrier ? '★60' : '+20', 0, 0);
      ctx.restore();
    }

    this.fighters.forEach((p) => {
      if (p.charge > 0.02) {
        const previewR = 68 + p.charge * 125 + (p.underdog ? 28 : 0);
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, previewR, 0, Math.PI * 2);
        ctx.strokeStyle = p.charge > 0.95 ? '#ff2a85' : p.color;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.stroke();
        ctx.restore();
      }

      const mood = p.stunTimer > 0 ? 'shocked' : p.charge > 0.5 ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, p.id, p.x, p.y, 22, mood, this.timeElapsed, 0);
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
      .map((p) => ({ playerId: p.id, score: Math.floor(p.score), place: 1 }))
      .sort((a, b) => b.score - a.score);
    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });
    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `Player ${winnerId} vaporized the Drone Swarm!` : 'EMP Bastion secure!',
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
