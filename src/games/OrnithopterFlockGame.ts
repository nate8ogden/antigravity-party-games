import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type ThemeId = 'florence_dawn' | 'clocktower_dusk' | 'aether_tempest';

interface ThemePalette {
  id: ThemeId;
  name: string;
  skyTop: string;
  skyMid: string;
  skyBot: string;
  spireColor: string;
  accent: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'florence_dawn',
    name: 'Renaissance Florence Sky',
    skyTop: '#1e1b4b',
    skyMid: '#4338ca',
    skyBot: '#f59e0b',
    spireColor: 'rgba(30, 27, 75, 0.45)',
    accent: '#facc15',
  },
  {
    id: 'clocktower_dusk',
    name: 'Neo-Victorian Clock Spires',
    skyTop: '#0f172a',
    skyMid: '#334155',
    skyBot: '#64748b',
    spireColor: 'rgba(15, 23, 42, 0.5)',
    accent: '#38bdf8',
  },
  {
    id: 'aether_tempest',
    name: 'Celestial Wind Spire',
    skyTop: '#160d29',
    skyMid: '#3b1c66',
    skyBot: '#7e22ce',
    spireColor: 'rgba(15, 7, 30, 0.5)',
    accent: '#c084fc',
  },
];

interface SkyTarget {
  id: number;
  x: number;
  y: number;
  vx: number;
  kind: 'thermal_ring' | 'wind_pearl' | 'blueprint_scroll' | 'storm_cloud';
  radius: number;
  value: number;
  pulse: number;
}

interface Ornithopter {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  wingAngle: number;
  score: number;
  charging: boolean;
  charge: number;
  swoopTimer: number;
  stallTimer: number;
  drafting: boolean;
  underdog: boolean;
  botTimer: number;
  botTargetX: number;
  botTargetY: number;
  botHoldTarget: number;
}

interface Shockwave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
  color: string;
}

export class OrnithopterFlockGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  public flyers: Map<PlayerId, Ornithopter> = new Map();
  private targets: SkyTarget[] = [];
  private shockwaves: Shockwave[] = [];
  private nextTargetId = 1;
  private spawnTimer = 0.8;
  private themeIndex = 0;
  private suddenDeath = false;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 45.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
    if (typeof window !== 'undefined' && !this.keyHandler) {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.themeIndex = (this.themeIndex + 1) % THEMES.length;
          this.audio.playTap();
        } else if (e.key === '1') {
          this.themeIndex = 0;
          this.audio.playTap();
        } else if (e.key === '2') {
          this.themeIndex = 1;
          this.audio.playTap();
        } else if (e.key === '3') {
          this.themeIndex = 2;
          this.audio.playTap();
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45.0;
    this.suddenDeath = false;
    this.flyers.clear();
    this.targets = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.spawnTimer = 0.6;

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.flyers.set(p.id, {
        id: p.id,
        x: 130 + idx * 55,
        y: height * 0.36 + idx * 45,
        vx: 0,
        vy: 0,
        wingAngle: idx * 1.2,
        score: 0,
        charging: false,
        charge: 0,
        swoopTimer: 0,
        stallTimer: 0,
        drafting: false,
        underdog: false,
        botTimer: 0.16 + Math.random() * 0.14,
        botTargetX: width * 0.55,
        botTargetY: height * 0.48,
        botHoldTarget: 0,
      });
    });

    for (let i = 0; i < 6; i++) {
      this.spawnTarget(width, height, true);
    }
  }

  public handlePointerDown(x: number, y: number, width: number, height: number): boolean {
    if (x >= 20 && x <= 190 && y >= height - 44 && y <= height - 12) {
      this.themeIndex = (this.themeIndex + 1) % THEMES.length;
      this.audio.playTap();
      return true;
    }
    return false;
  }

  private spawnTarget(width: number, height: number, randomX = false): void {
    if (this.targets.length >= 14) return;
    const roll = Math.random();
    const kind = roll < 0.2 ? 'storm_cloud' : roll < 0.38 ? 'blueprint_scroll' : roll < 0.68 ? 'thermal_ring' : 'wind_pearl';
    const value = kind === 'blueprint_scroll' ? 95 : kind === 'thermal_ring' ? 60 : kind === 'wind_pearl' ? 45 : -25;
    const radius = kind === 'thermal_ring' ? 24 : 15;
    this.targets.push({
      id: this.nextTargetId++,
      x: randomX ? 160 + Math.random() * (width - 220) : width + 36,
      y: 110 + Math.random() * (height - 195),
      vx: -(135 + Math.random() * 55) * (this.suddenDeath ? 1.25 : 1.0),
      kind,
      radius,
      value,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    if (!this.suddenDeath && this.roundTimer <= 15.0) {
      this.suddenDeath = true;
      this.audio.playFanfare();
      this.addScreenShake(8);
      this.addFloatingText(width * 0.5, 110, '⚡ SUDDEN DEATH: JETSTREAM UPDRAFT 2X! ⚡', '#facc15', 20);
    }

    let maxScore = 0;
    this.flyers.forEach(f => {
      if (f.score > maxScore) maxScore = f.score;
    });
    this.flyers.forEach(f => {
      f.underdog = maxScore - f.score >= 150;
    });

    this.updateBots(dt, width, height);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.suddenDeath ? 0.6 : 0.92;
      this.spawnTarget(width, height, false);
    }

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      t.pulse += dt * 5;
      t.x += t.vx * dt;
      if (t.x < -45) {
        this.targets.splice(i, 1);
      }
    }

    const flyerList = Array.from(this.flyers.values());
    this.flyers.forEach(f => {
      if (f.swoopTimer > 0) f.swoopTimer = Math.max(0, f.swoopTimer - dt);
      f.wingAngle += dt * (f.swoopTimer > 0 ? 22 : 11);

      // Slipstream drafting check behind leading flyers
      f.drafting = false;
      for (const other of flyerList) {
        if (other.id !== f.id && other.x > f.x + 24 && other.x < f.x + 145 && Math.abs(other.y - f.y) < 36) {
          f.drafting = true;
          f.score += Math.round(16 * dt);
          break;
        }
      }

      if (f.stallTimer > 0) {
        f.stallTimer -= dt;
        f.charging = false;
        f.charge = 0;
        f.vy += 240 * dt;
        f.vx *= 0.9;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        this.clampFlyer(f, width, height);
        return;
      }

      const move = { x: this.input.getSteer(f.id), y: -this.input.getThrottle(f.id) };
      const speedMult = (f.underdog ? 1.24 : 1.0) * (f.drafting ? 1.24 : 1.0) * (f.swoopTimer > 0 ? 1.55 : 1.0);
      const accel = 880 * speedMult;

      f.vx += move.x * accel * dt;
      f.vy += (move.y * accel + 95) * dt; // light natural glide gravity

      if (this.input.justPressed(f.id) || this.input.justAction(f.id)) {
        f.vy = -210;
        f.vx += 90;
        this.audio.playWhoosh();
        this.particles.emit(f.x - 14, f.y + 4, 4, 'rgba(255,255,255,0.7)');
      }

      // Hold-to-charge Supersonic Falcon Swoop & Gale-Wing Shunt (72%–98% Sweet Spot)
      const holding = this.input.isActionPressed(f.id) || this.input.isPressed(f.id);
      if (holding) {
        f.charging = true;
        f.charge += dt * 0.84;
        if (f.charge >= 1.0) {
          f.charging = false;
          f.charge = 0;
          f.stallTimer = 0.7;
          this.audio.playBuzzer();
          this.addFloatingText(f.x, f.y - 26, '⚠️ WING OVER-TORQUE!', '#ef4444', 15);
        }
      } else if (f.charging) {
        const pct = f.charge;
        f.charging = false;
        f.charge = 0;
        if (pct >= 0.72 && pct <= 0.98) {
          this.triggerFalconSwoop(f);
        }
      }

      f.vx *= 0.88;
      f.vy *= 0.88;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      this.clampFlyer(f, width, height);

      // Target collisions
      for (let i = this.targets.length - 1; i >= 0; i--) {
        const t = this.targets[i];
        const d = Math.hypot(t.x - f.x, t.y - f.y);
        if (f.swoopTimer > 0 && t.kind !== 'storm_cloud' && d < 160 && d > 30) {
          t.x += ((f.x - t.x) / d) * 340 * dt;
          t.y += ((f.y - t.y) / d) * 340 * dt;
        }
        if (d < t.radius + 18) {
          if (t.kind === 'storm_cloud') {
            if (f.swoopTimer > 0 || f.underdog) {
              f.score += 55;
              this.audio.playBoost();
              this.addFloatingText(t.x, t.y - 22, '⚡ STORM CLEARED! +55', '#38bdf8', 16);
            } else {
              f.stallTimer = 0.8;
              f.score = Math.max(0, f.score - 25);
              this.audio.playBuzzer();
              this.addScreenShake(6);
              this.particles.emit(t.x, t.y, 16, '#ef4444');
              this.addFloatingText(t.x, t.y - 22, '🌩️ TURBULENCE! -25', '#ef4444', 16);
            }
          } else {
            const pts = Math.round(t.value * (this.suddenDeath ? 2 : 1));
            f.score += pts;
            if (t.kind === 'thermal_ring') {
              f.vx += 160;
              f.vy = -120;
            }
            this.audio.playScore();
            const col = t.kind === 'blueprint_scroll' ? '#facc15' : t.kind === 'thermal_ring' ? '#fbbf24' : '#38bdf8';
            const label = t.kind === 'blueprint_scroll' ? `📜 DA VINCI SCROLL! +${pts}` : t.kind === 'thermal_ring' ? `⭕ THERMAL RING! +${pts}` : `💠 WIND PEARL! +${pts}`;
            this.particles.emit(t.x, t.y, 12, col);
            this.addFloatingText(t.x, t.y - 22, label, col, 16);
          }
          this.targets.splice(i, 1);
        }
      }
    });

    // Mid-air wing collisions
    for (let i = 0; i < flyerList.length; i++) {
      for (let j = i + 1; j < flyerList.length; j++) {
        const a = flyerList[i];
        const b = flyerList[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 38;
        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) * 0.5;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          const imp = 220;
          a.vx -= nx * imp;
          a.vy -= ny * imp;
          b.vx += nx * imp;
          b.vy += ny * imp;
          this.audio.playBounce();
        }
      }
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.r += (s.maxR - s.r) * dt * 7;
      s.alpha -= dt * 1.9;
      if (s.alpha <= 0) this.shockwaves.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= dt * 0.95;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  private clampFlyer(f: Ornithopter, width: number, height: number): void {
    const padX = 56;
    const minY = 96;
    const maxY = height - 62;
    if (f.x < padX) { f.x = padX; f.vx = Math.abs(f.vx) * 0.5; }
    if (f.x > width - padX) { f.x = width - padX; f.vx = -Math.abs(f.vx) * 0.5; }
    if (f.y < minY) { f.y = minY; f.vy = Math.abs(f.vy) * 0.5; }
    if (f.y > maxY) { f.y = maxY; f.vy = -Math.abs(f.vy) * 0.5; }
  }

  private triggerFalconSwoop(f: Ornithopter): void {
    f.swoopTimer = 1.45;
    f.vx += 380;
    f.vy = -90;
    const pts = this.suddenDeath ? 170 : 85;
    f.score += pts;
    this.audio.playBoost();
    this.addScreenShake(8);
    this.shockwaves.push({
      x: f.x,
      y: f.y,
      r: 20,
      maxR: 160,
      alpha: 1,
      color: '#facc15',
    });
    this.particles.emit(f.x, f.y, 24, '#facc15');
    this.addFloatingText(f.x, f.y - 34, `🦅 FALCON THERMAL SWOOP! +${pts}`, '#facc15', 18);

    this.flyers.forEach(other => {
      if (other.id === f.id) return;
      const dx = other.x - f.x;
      const dy = other.y - f.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 150) {
        const nx = dist > 0.01 ? dx / dist : 1;
        const ny = dist > 0.01 ? dy / dist : 0;
        other.vx += nx * 420;
        other.vy += ny * 420;
        other.stallTimer = 0.7;
        f.score += 70;
        this.addFloatingText(other.x, other.y - 28, '🌪️ GALE-WING SHUNT! +70', '#38bdf8', 17);
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const f = this.flyers.get(botId);
    if (!f || f.stallTimer > 0) return;

    f.botTimer -= dt;
    if (f.botTimer <= 0) {
      f.botTimer = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.22 : 0.35;

      let best: SkyTarget | null = null;
      let bestScore = -999;
      for (const t of this.targets) {
        if (t.kind === 'storm_cloud') continue;
        const d = Math.hypot(t.x - f.x, t.y - f.y);
        const val = t.value * 1.3 - d * 0.24;
        if (val > bestScore) {
          bestScore = val;
          best = t;
        }
      }

      if (best) {
        f.botTargetX = Math.max(90, Math.min(width - 90, best.x));
        f.botTargetY = best.y;
      } else {
        f.botTargetX = width * 0.45;
        f.botTargetY = height * 0.48;
      }

      if (!f.charging && Math.random() < (difficulty === 'bot_hard' ? 0.28 : 0.14)) {
        f.botHoldTarget = difficulty === 'bot_hard' ? 0.84 : 0.78;
      }
    }

    const dx = f.botTargetX - f.x;
    const dy = f.botTargetY - f.y;
    const dist = Math.hypot(dx, dy);
    const steerX = dist > 8 ? dx / dist : 0;
    const throttleY = dist > 8 ? -dy / dist : 0;
    const actor: any = (this as any).engineers?.get(botId) || (this as any).zeppelins?.get(botId) || (this as any).harvesters?.get(botId) || (this as any).toymakers?.get(botId) || (this as any).dispatchers?.get(botId) || (this as any).flyers?.get(botId);
    if (actor) {
      actor.vx += steerX * 620 * dt;
      actor.vy += -throttleY * 620 * dt;
      if (typeof actor.angle === 'number' && (Math.abs(steerX) > 0.01 || Math.abs(throttleY) > 0.01)) actor.angle = Math.atan2(-throttleY, steerX);
    }

    if (f.botHoldTarget > 0) {
      if (f.charge < f.botHoldTarget) {
        this.input.setBotState(botId, true);
      } else {
        f.botHoldTarget = 0;
        this.input.setBotState(botId, false);
      }
    } else {
      this.input.setBotState(botId, false);
      if (f.y > f.botTargetY + 18 && Math.random() < 0.35) {
        this.input.triggerBotPress(botId);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex % THEMES.length];

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.skyTop);
    bg.addColorStop(0.55, theme.skyMid);
    bg.addColorStop(1, theme.skyBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Distant Renaissance Domes & Clock Spires
    ctx.save();
    ctx.fillStyle = theme.spireColor;
    ctx.fillRect(width * 0.22, height - 115, 48, 115);
    ctx.beginPath();
    ctx.arc(width * 0.52, height - 55, 65, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(width * 0.78, height - 105, 42, 105);
    ctx.restore();

    // Shockwaves
    for (const s of this.shockwaves) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, s.alpha);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Targets
    for (const t of this.targets) {
      ctx.save();
      ctx.translate(t.x, t.y);
      if (t.kind === 'thermal_ring') {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (t.kind === 'blueprint_scroll') {
        ctx.fillStyle = '#fde047';
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 2;
        ctx.fillRect(-13, -9, 26, 18);
        ctx.strokeRect(-13, -9, 26, 18);
      } else if (t.kind === 'wind_pearl') {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // Render 2.5D Da Vinci Ornithopters
    this.flyers.forEach(f => {
      const cfg = this.players.find(p => p.id === f.id);
      const color = cfg?.color || '#38bdf8';

      ctx.save();
      ctx.translate(f.x, f.y);

      if (f.charging) {
        const sweet = f.charge >= 0.72 && f.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#facc15' : '#38bdf8';
        ctx.lineWidth = sweet ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 30, -Math.PI * 0.5, -Math.PI * 0.5 + f.charge * Math.PI * 2);
        ctx.stroke();
      }

      if (f.swoopTimer > 0 || f.underdog || f.drafting) {
        ctx.strokeStyle = f.swoopTimer > 0 ? '#facc15' : '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.stroke();
      }

      const flap = Math.sin(f.wingAngle) * 16;
      ctx.fillStyle = color;
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 2;
      // Upper & Lower Da Vinci Ribbed Wings
      ctx.beginPath();
      ctx.moveTo(-6, -4);
      ctx.quadraticCurveTo(8, -20 + flap, 26, -12 + flap * 0.5);
      ctx.quadraticCurveTo(6, -6, -6, -4);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-6, 4);
      ctx.quadraticCurveTo(8, 20 - flap, 26, 12 - flap * 0.5);
      ctx.quadraticCurveTo(6, 6, -6, 4);
      ctx.fill();
      ctx.stroke();

      const mood = f.stallTimer > 0 ? 'shocked' : f.charging ? 'focused' : f.swoopTimer > 0 ? 'triumph' : 'idle';
      this.drawPlayerMascot(ctx, cfg?.id || 1, 0, -2, 15, mood === 'focused' ? 'focused' : mood === 'shocked' ? 'shocked' : 'happy', 45 - this.roundTimer, 0);
      ctx.restore();
    });

    this.renderFloatingTexts(ctx);

    // Top Header Banner (Respecting top-center timer safe zone y: 12-44)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 260, 54, 520, 28, 14);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STEER: GLIDE 2D & DRAFT • TAP: WING GUST • HOLD (72-98%): FALCON THERMAL SWOOP SHUNT', width * 0.5, 68);
    ctx.restore();

    // Corner Player Cards
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const f = this.flyers.get(p.id);
      if (!f) return;
      const isLeft = idx % 2 === 0;
      const cardX = isLeft ? 18 : width - 148;
      const cardY = height - 128 - Math.floor(idx / 2) * 56;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 130, 48, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = '800 12px "Outfit", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 10, cardY + 18);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '900 15px "Outfit", sans-serif';
      ctx.fillText(`${f.score} PTS`, cardX + 10, cardY + 38);
      ctx.restore();
    });

    // Bottom-Left Theme Pill
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 11px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🎨 ${theme.name} [T]`, 105, height - 28);
    ctx.restore();
  }

  
  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getScores();
    const rankings = Array.from(scores.entries())
      .map(([playerId, score]) => ({ playerId, score: Math.floor(score), place: 1 }))
      .sort((a, b) => b.score - a.score);
    rankings.forEach((r, idx) => { r.place = idx + 1; });
    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} dominated the arena!` : "Photo finish!",
    };
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.flyers.forEach((f, id) => scores.set(id, f.score));
    return scores;
  }

  public getWinner(): PlayerId | null {
    let bestId: PlayerId | null = null;
    let bestScore = -1;
    let tie = false;
    this.flyers.forEach(f => {
      if (f.score > bestScore) {
        bestScore = f.score;
        bestId = f.id;
        tie = false;
      } else if (f.score === bestScore) {
        tie = true;
      }
    });
    return tie ? null : bestId;
  }

  public cleanup(): void {
    if (typeof window !== 'undefined' && this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string, size = 16): void {
    this.floatingTexts.push({ x, y, text, color, alpha: 1, vy: -38, size });
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.alpha));
      ctx.font = `900 ${ft.size}px "Outfit", system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

  private addScreenShake(amt: number): void {
    void amt;
  }

}
