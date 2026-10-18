import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type ThemeId = 'wardenclyffe_cyan' | 'violet_aether' | 'golden_dynamo';

interface ThemePalette {
  id: ThemeId;
  name: string;
  bgInner: string;
  bgOuter: string;
  ringColor: string;
  beamPrimary: string;
  beamHazard: string;
  accent: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'wardenclyffe_cyan',
    name: 'Wardenclyffe Cyan Lab',
    bgInner: '#0f172a',
    bgOuter: '#020617',
    ringColor: 'rgba(56, 189, 248, 0.18)',
    beamPrimary: '#38bdf8',
    beamHazard: '#ef4444',
    accent: '#38bdf8',
  },
  {
    id: 'violet_aether',
    name: 'Colorado Springs Violet',
    bgInner: '#1e1b4b',
    bgOuter: '#09071a',
    ringColor: 'rgba(192, 132, 252, 0.18)',
    beamPrimary: '#c084fc',
    beamHazard: '#f43f5e',
    accent: '#c084fc',
  },
  {
    id: 'golden_dynamo',
    name: 'Imperial Dynamo Hall',
    bgInner: '#271a0c',
    bgOuter: '#0c0804',
    ringColor: 'rgba(250, 204, 21, 0.18)',
    beamPrimary: '#facc15',
    beamHazard: '#ef4444',
    accent: '#facc15',
  },
];

interface PlasmaOrb {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'plasma' | 'nikola_core' | 'red_overload';
  value: number;
  pulse: number;
}

interface Harvester {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  score: number;
  combo: number;
  comboTimer: number;
  charging: boolean;
  charge: number;
  faradayTimer: number;
  stunTimer: number;
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

export class TeslaCoilArcGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  private harvesters: Map<PlayerId, Harvester> = new Map();
  private orbs: PlasmaOrb[] = [];
  private shockwaves: Shockwave[] = [];
  private coilAngle = 0;
  private hazardAngle = Math.PI * 0.5;
  private nextOrbId = 1;
  private orbTimer = 1.2;
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
    this.harvesters.clear();
    this.orbs = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.coilAngle = 0;
    this.hazardAngle = Math.PI * 0.5;
    this.orbTimer = 1.0;

    const cx = width * 0.5;
    const cy = height * 0.55;
    const r = Math.min(width, height) * 0.28;
    const active = this.getActivePlayers();

    active.forEach((p, idx) => {
      const a = (idx / Math.max(1, active.length)) * Math.PI * 2 - Math.PI * 0.5;
      this.harvesters.set(p.id, {
        id: p.id,
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        vx: 0,
        vy: 0,
        facingX: -Math.cos(a),
        facingY: -Math.sin(a),
        score: 0,
        combo: 1,
        comboTimer: 0,
        charging: false,
        charge: 0,
        faradayTimer: 0,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.16 + Math.random() * 0.15,
        botTargetX: cx,
        botTargetY: cy,
        botHoldTarget: 0,
      });
    });

    for (let i = 0; i < 6; i++) {
      this.spawnOrb(width, height);
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

  private spawnOrb(width: number, height: number): void {
    if (this.orbs.length >= 14) return;
    const cx = width * 0.5;
    const cy = height * 0.55;
    const angle = Math.random() * Math.PI * 2;
    const dist = 65 + Math.random() * (Math.min(width, height) * 0.32);
    const roll = Math.random();
    const kind = roll < 0.2 ? 'red_overload' : roll < 0.42 ? 'nikola_core' : 'plasma';
    const value = kind === 'nikola_core' ? 95 : kind === 'plasma' ? 50 : -30;
    this.orbs.push({
      id: this.nextOrbId++,
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 48,
      vy: (Math.random() - 0.5) * 48,
      kind,
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
      this.addFloatingText(width * 0.5, 110, '⚡ SUDDEN DEATH: MEGAVOLT RESONANCE 2X! ⚡', '#facc15', 20);
    }

    let maxScore = 0;
    this.harvesters.forEach(h => {
      if (h.score > maxScore) maxScore = h.score;
    });
    this.harvesters.forEach(h => {
      h.underdog = maxScore - h.score >= 150;
    });

    this.updateBots(dt, width, height);

    const cx = width * 0.5;
    const cy = height * 0.55;
    const arenaR = Math.min(width, height) * 0.37;

    this.coilAngle += (this.suddenDeath ? 1.85 : 1.35) * dt;
    this.hazardAngle -= (this.suddenDeath ? 1.4 : 0.95) * dt;

    this.orbTimer -= dt;
    if (this.orbTimer <= 0) {
      this.orbTimer = this.suddenDeath ? 0.95 : 1.45;
      this.spawnOrb(width, height);
    }

    for (const o of this.orbs) {
      o.pulse += dt * 6;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      const dist = Math.hypot(o.x - cx, o.y - cy);
      if (dist > arenaR - 18 || dist < 52) {
        o.vx *= -1;
        o.vy *= -1;
      }
    }

    this.harvesters.forEach(h => {
      if (h.faradayTimer > 0) h.faradayTimer = Math.max(0, h.faradayTimer - dt);
      if (h.comboTimer > 0) {
        h.comboTimer -= dt;
        if (h.comboTimer <= 0) h.combo = 1;
      }

      if (h.stunTimer > 0) {
        h.stunTimer -= dt;
        h.charging = false;
        h.charge = 0;
        h.vx *= 0.9;
        h.vy *= 0.9;
        h.x += h.vx * dt;
        h.y += h.vy * dt;
        this.clampHarvester(h, cx, cy, arenaR);
        return;
      }

      const move = { x: this.input.getSteer(h.id), y: -this.input.getThrottle(h.id) };
      const speedMult = (h.underdog ? 1.24 : 1.0) * (h.faradayTimer > 0 ? 1.25 : 1.0) * (h.charging ? 0.72 : 1.0);
      const accel = 960 * speedMult;

      if (Math.abs(move.x) > 0.05 || Math.abs(move.y) > 0.05) {
        const len = Math.hypot(move.x, move.y) || 1;
        const nx = move.x / len;
        const ny = move.y / len;
        h.facingX = nx;
        h.facingY = ny;
        h.vx += nx * accel * dt;
        h.vy += ny * accel * dt;
      }

      h.vx *= 0.86;
      h.vy *= 0.86;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      this.clampHarvester(h, cx, cy, arenaR);

      // Check alignment with Cyan Power Beam vs Red Hazard Beam
      const pAngle = Math.atan2(h.y - cy, h.x - cx);
      const beamDiff = this.angleDistance(pAngle, this.coilAngle);
      const hazDiff = this.angleDistance(pAngle, this.hazardAngle);

      const pCfg = this.getPlayer(h.id);
      const isBot = pCfg ? pCfg.type.startsWith('bot_') : false;

      if (beamDiff < 0.22 && (this.input.justAction(h.id) || (isBot && this.input.justPressed(h.id)))) {
        h.combo = Math.min(3, h.combo + 1);
        h.comboTimer = 4.0;
        const pts = Math.round(55 * h.combo * (this.suddenDeath ? 2 : 1));
        h.score += pts;
        this.audio.playScore();
        this.particles.emit(h.x, h.y, 14, '#38bdf8');
        this.addFloatingText(h.x, h.y - 28, `⚡ ARC HARVEST! +${pts} (${h.combo}x)`, '#38bdf8', 17);
      }

      if (hazDiff < 0.14) {
        if (h.faradayTimer > 0 || h.underdog) {
          h.score += 15;
          this.particles.emit(h.x, h.y, 4, '#facc15');
        } else {
          h.stunTimer = 0.85;
          h.combo = 1;
          h.score = Math.max(0, h.score - 25);
          this.audio.playBuzzer();
          this.addScreenShake(6);
          this.particles.emit(h.x, h.y, 16, '#ef4444');
          this.addFloatingText(h.x, h.y - 26, '⚡ SHORT CIRCUIT! -25', '#ef4444', 16);
        }
      }

      // Hold-to-charge Faraday Arc Discharge & Electro-Surge Shunt (72%–98% Sweet Spot)
      const holding = this.input.isActionPressed(h.id) || (isBot && this.input.isPressed(h.id));
      if (holding) {
        h.charging = true;
        h.charge += dt * 0.82;
        if (h.charge >= 1.0) {
          h.charging = false;
          h.charge = 0;
          h.stunTimer = 0.75;
          this.audio.playBuzzer();
          this.particles.emit(h.x, h.y, 14, '#ef4444');
          this.addFloatingText(h.x, h.y - 28, '⚠️ COIL OVERLOAD!', '#ef4444', 15);
        }
      } else if (h.charging) {
        const pct = h.charge;
        h.charging = false;
        h.charge = 0;
        if (pct >= 0.72 && pct <= 0.98) {
          this.triggerFaradaySurge(h);
        } else if (pct >= 0.25) {
          h.vx += h.facingX * 240;
          h.vy += h.facingY * 240;
          this.audio.playWhoosh();
        }
      }

      // Collect Orbs
      for (let i = this.orbs.length - 1; i >= 0; i--) {
        const o = this.orbs[i];
        const pullRadius = h.faradayTimer > 0 ? 155 : 32;
        const d = Math.hypot(o.x - h.x, o.y - h.y);
        if (d < pullRadius && o.kind !== 'red_overload' && d > 30) {
          o.x += ((h.x - o.x) / d) * 320 * dt;
          o.y += ((h.y - o.y) / d) * 320 * dt;
        }
        if (d < 30) {
          if (o.kind === 'red_overload') {
            if (h.faradayTimer > 0 || h.underdog) {
              h.score += 55;
              this.audio.playBoost();
              this.addFloatingText(o.x, o.y - 20, '🛡️ FARADAY ABSORB! +55', '#38bdf8', 16);
            } else {
              h.stunTimer = 0.85;
              h.combo = 1;
              h.score = Math.max(0, h.score - 25);
              this.audio.playBuzzer();
              this.particles.emit(o.x, o.y, 16, '#ef4444');
              this.addFloatingText(o.x, o.y - 20, '💥 OVERLOAD BALL! -25', '#ef4444', 16);
            }
          } else {
            const pts = Math.round(o.value * (this.suddenDeath ? 2 : 1));
            h.score += pts;
            this.audio.playScore();
            const col = o.kind === 'nikola_core' ? '#facc15' : '#38bdf8';
            const label = o.kind === 'nikola_core' ? `👑 NIKOLA CORE! +${pts}` : `⚡ PLASMA ORB! +${pts}`;
            this.particles.emit(o.x, o.y, 12, col);
            this.addFloatingText(o.x, o.y - 20, label, col, 16);
          }
          this.orbs.splice(i, 1);
        }
      }
    });

    // Harvester-to-Harvester elastic collisions
    const list = Array.from(this.harvesters.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
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

  private angleDistance(a: number, b: number): number {
    let diff = Math.abs(a - b) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    return diff;
  }

  private clampHarvester(h: Harvester, cx: number, cy: number, arenaR: number): void {
    const dx = h.x - cx;
    const dy = h.y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < 48 && dist > 0.001) {
      h.x = cx + (dx / dist) * 48;
      h.y = cy + (dy / dist) * 48;
    } else if (dist > arenaR) {
      h.x = cx + (dx / dist) * arenaR;
      h.y = cy + (dy / dist) * arenaR;
    }
  }

  private triggerFaradaySurge(h: Harvester): void {
    h.faradayTimer = 1.45;
    h.vx += h.facingX * 360;
    h.vy += h.facingY * 360;
    const pts = this.suddenDeath ? 170 : 85;
    h.score += pts;
    this.audio.playBoost();
    this.addScreenShake(8);
    this.shockwaves.push({
      x: h.x,
      y: h.y,
      r: 20,
      maxR: 160,
      alpha: 1,
      color: '#38bdf8',
    });
    this.particles.emit(h.x, h.y, 24, '#38bdf8');
    this.addFloatingText(h.x, h.y - 34, `⚡ FARADAY NOVA SURGE! +${pts}`, '#facc15', 18);

    this.harvesters.forEach(other => {
      if (other.id === h.id) return;
      const dx = other.x - h.x;
      const dy = other.y - h.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 150) {
        const nx = dist > 0.01 ? dx / dist : 1;
        const ny = dist > 0.01 ? dy / dist : 0;
        other.vx += nx * 420;
        other.vy += ny * 420;
        other.stunTimer = 0.7;
        h.score += 70;
        this.addFloatingText(other.x, other.y - 28, '⚡ ELECTRO-SURGE SHUNT! +70', '#38bdf8', 17);
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
    const h = this.harvesters.get(botId);
    if (!h || h.stunTimer > 0) return;

    h.botTimer -= dt;
    if (h.botTimer <= 0) {
      h.botTimer = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.22 : 0.36;

      let bestOrb: PlasmaOrb | null = null;
      let bestVal = -999;
      for (const o of this.orbs) {
        if (o.kind === 'red_overload') continue;
        const d = Math.hypot(o.x - h.x, o.y - h.y);
        const val = o.value * 1.4 - d * 0.25;
        if (val > bestVal) {
          bestVal = val;
          bestOrb = o;
        }
      }

      if (bestOrb) {
        h.botTargetX = bestOrb.x;
        h.botTargetY = bestOrb.y;
      } else {
        const cx = width * 0.5;
        const cy = height * 0.55;
        h.botTargetX = cx + Math.cos(this.coilAngle) * 140;
        h.botTargetY = cy + Math.sin(this.coilAngle) * 140;
      }

      if (!h.charging && Math.random() < (difficulty === 'bot_hard' ? 0.28 : 0.14)) {
        h.botHoldTarget = difficulty === 'bot_hard' ? 0.84 : 0.78;
      }
    }

    const dx = h.botTargetX - h.x;
    const dy = h.botTargetY - h.y;
    const dist = Math.hypot(dx, dy);
    const steerX = dist > 8 ? dx / dist : 0;
    const throttleY = dist > 8 ? -dy / dist : 0;
    const actor: any = (this as any).engineers?.get(botId) || (this as any).zeppelins?.get(botId) || (this as any).harvesters?.get(botId) || (this as any).toymakers?.get(botId) || (this as any).dispatchers?.get(botId) || (this as any).flyers?.get(botId);
    if (actor) {
      actor.vx += steerX * 620 * dt;
      actor.vy += -throttleY * 620 * dt;
      if (typeof actor.angle === 'number' && (Math.abs(steerX) > 0.01 || Math.abs(throttleY) > 0.01)) actor.angle = Math.atan2(-throttleY, steerX);
    }

    if (h.botHoldTarget > 0) {
      if (h.charge < h.botHoldTarget) {
        this.input.setBotState(botId, true);
      } else {
        h.botHoldTarget = 0;
        this.input.setBotState(botId, false);
      }
    } else {
      this.input.setBotState(botId, false);
      const cx = width * 0.5;
      const cy = height * 0.55;
      const pAngle = Math.atan2(h.y - cy, h.x - cx);
      if (this.angleDistance(pAngle, this.coilAngle) < 0.2) {
        this.input.triggerBotPress(botId);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex % THEMES.length];
    const cx = width * 0.5;
    const cy = height * 0.55;
    const arenaR = Math.min(width, height) * 0.37;

    const bg = ctx.createRadialGradient(cx, cy, 20, cx, cy, width * 0.65);
    bg.addColorStop(0, theme.bgInner);
    bg.addColorStop(1, theme.bgOuter);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Concentric Copper Insulator Rings
    ctx.save();
    ctx.strokeStyle = theme.ringColor;
    ctx.lineWidth = 2.5;
    for (const mult of [0.35, 0.68, 1.0]) {
      ctx.beginPath();
      ctx.arc(cx, cy, arenaR * mult, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Render Sweeping Cyan Power Beam & Red Overload Beam
    this.drawLightningBeam(ctx, cx, cy, this.coilAngle, arenaR, theme.beamPrimary, 4);
    this.drawLightningBeam(ctx, cx, cy, this.hazardAngle, arenaR, theme.beamHazard, 3.5);

    // Central 2.5D Wardenclyffe Mega-Tesla Tower
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(0, -4, 19, 0, Math.PI * 2);
    ctx.fill();
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

    // Plasma Orbs & Nikola Cores
    for (const o of this.orbs) {
      const r = 10 + Math.sin(o.pulse) * 2;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.fillStyle = o.kind === 'nikola_core' ? '#facc15' : o.kind === 'red_overload' ? '#ef4444' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Harvesters
    this.harvesters.forEach(h => {
      const cfg = this.players.find(p => p.id === h.id);
      const color = cfg?.color || '#38bdf8';

      ctx.save();
      ctx.translate(h.x, h.y);

      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 16, 18, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      if (h.charging) {
        const sweet = h.charge >= 0.72 && h.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#facc15' : '#38bdf8';
        ctx.lineWidth = sweet ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 27, -Math.PI * 0.5, -Math.PI * 0.5 + h.charge * Math.PI * 2);
        ctx.stroke();
      }

      if (h.faradayTimer > 0 || h.underdog) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.stroke();
      }

      const mood = h.stunTimer > 0 ? 'shocked' : h.charging ? 'focused' : h.faradayTimer > 0 ? 'triumph' : 'idle';
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
    ctx.fillStyle = '#bae6fd';
    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STEER: PILOT HARVESTER • TAP IN CYAN BEAM: HARVEST • HOLD (72-98%): FARADAY NOVA SHUNT', width * 0.5, 68);
    ctx.restore();

    // Corner Player Cards
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const h = this.harvesters.get(p.id);
      if (!h) return;
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
      ctx.fillText(`${h.score} PTS`, cardX + 10, cardY + 38);
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

  private drawLightningBeam(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, length: number, color: string, width: number): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const segments = 7;
    const tx = cx + Math.cos(angle) * length;
    const ty = cy + Math.sin(angle) * length;
    for (let s = 1; s <= segments; s++) {
      const t = s / segments;
      const jitter = s === segments ? 0 : (Math.random() - 0.5) * 18;
      ctx.lineTo(cx + (tx - cx) * t + jitter, cy + (ty - cy) * t + jitter);
    }
    ctx.stroke();
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
    this.harvesters.forEach((h, id) => scores.set(id, h.score));
    return scores;
  }

  public getWinner(): PlayerId | null {
    let bestId: PlayerId | null = null;
    let bestScore = -1;
    let tie = false;
    this.harvesters.forEach(h => {
      if (h.score > bestScore) {
        bestScore = h.score;
        bestId = h.id;
        tie = false;
      } else if (h.score === bestScore) {
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
