import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type ThemeId = 'metropolis_brass' | 'bank_of_england' | 'neon_conduit';

interface ThemePalette {
  id: ThemeId;
  name: string;
  floorTop: string;
  floorMid: string;
  floorBot: string;
  tubeGlass: string;
  tubeBrass: string;
  accent: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'metropolis_brass',
    name: 'Grand Central Brass Hub',
    floorTop: '#0f172a',
    floorMid: '#1e293b',
    floorBot: '#090d16',
    tubeGlass: 'rgba(56, 189, 248, 0.16)',
    tubeBrass: '#d97706',
    accent: '#38bdf8',
  },
  {
    id: 'bank_of_england',
    name: 'Royal Bullion Vault',
    floorTop: '#1c1917',
    floorMid: '#292524',
    floorBot: '#0c0a09',
    tubeGlass: 'rgba(250, 204, 21, 0.16)',
    tubeBrass: '#eab308',
    accent: '#facc15',
  },
  {
    id: 'neon_conduit',
    name: 'Sub-Metro Cyber Grid',
    floorTop: '#160d29',
    floorMid: '#271745',
    floorBot: '#090514',
    tubeGlass: 'rgba(192, 132, 252, 0.18)',
    tubeBrass: '#a855f7',
    accent: '#c084fc',
  },
];

interface TubeCapsule {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'silver' | 'gold' | 'imperial_diamond' | 'nitro';
  value: number;
  pulse: number;
}

interface Dispatcher {
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
  vortexTimer: number;
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

export class PneumaticTubeRushGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  private dispatchers: Map<PlayerId, Dispatcher> = new Map();
  private capsules: TubeCapsule[] = [];
  private shockwaves: Shockwave[] = [];
  private tubeYs: number[] = [];
  private nextCapsuleId = 1;
  private spawnTimer = 0.65;
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
    this.dispatchers.clear();
    this.capsules = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.spawnTimer = 0.5;

    this.tubeYs = [
      height * 0.28,
      height * 0.45,
      height * 0.62,
      height * 0.78,
    ];

    const active = this.getActivePlayers();
    const spawns = [
      { x: width * 0.32, y: height * 0.36 },
      { x: width * 0.68, y: height * 0.36 },
      { x: width * 0.32, y: height * 0.70 },
      { x: width * 0.68, y: height * 0.70 },
    ];

    active.forEach((p, idx) => {
      const sp = spawns[idx % spawns.length];
      this.dispatchers.set(p.id, {
        id: p.id,
        x: sp.x,
        y: sp.y,
        vx: 0,
        vy: 0,
        facingX: idx % 2 === 0 ? 1 : -1,
        facingY: 0,
        score: 0,
        combo: 1,
        comboTimer: 0,
        charging: false,
        charge: 0,
        vortexTimer: 0,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.16 + Math.random() * 0.15,
        botTargetX: width * 0.5,
        botTargetY: height * 0.5,
        botHoldTarget: 0,
      });
    });

    for (let i = 0; i < 7; i++) {
      this.spawnCapsule(width, true);
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

  private spawnCapsule(width: number, randomX = false): void {
    if (this.capsules.length >= 16) return;
    const lane = Math.floor(Math.random() * this.tubeYs.length);
    const dir = lane % 2 === 0 ? 1 : -1;
    const speed = (175 + Math.random() * 65) * (this.suddenDeath ? 1.25 : 1.0);
    const roll = Math.random();
    const kind = roll < 0.2 ? 'nitro' : roll < 0.38 ? 'imperial_diamond' : roll < 0.68 ? 'gold' : 'silver';
    const value = kind === 'imperial_diamond' ? 95 : kind === 'gold' ? 65 : kind === 'silver' ? 45 : -30;
    const x = randomX ? 90 + Math.random() * (width - 180) : (dir > 0 ? 40 : width - 40);

    this.capsules.push({
      id: this.nextCapsuleId++,
      x,
      y: this.tubeYs[lane],
      vx: dir * speed,
      vy: 0,
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
      this.addFloatingText(width * 0.5, 110, '⚡ SUDDEN DEATH: HYPER-PRESSURE DISPATCH 2X! ⚡', '#facc15', 20);
    }

    let maxScore = 0;
    this.dispatchers.forEach(d => {
      if (d.score > maxScore) maxScore = d.score;
    });
    this.dispatchers.forEach(d => {
      d.underdog = maxScore - d.score >= 150;
    });

    this.updateBots(dt, width, height);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.suddenDeath ? 0.5 : 0.78;
      this.spawnCapsule(width, false);
    }

    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const c = this.capsules[i];
      c.pulse += dt * 6;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vy *= 0.92;
      if (c.x < 25 || c.x > width - 25) {
        this.capsules.splice(i, 1);
      }
    }

    this.dispatchers.forEach(d => {
      if (d.vortexTimer > 0) d.vortexTimer = Math.max(0, d.vortexTimer - dt);
      if (d.comboTimer > 0) {
        d.comboTimer -= dt;
        if (d.comboTimer <= 0) d.combo = 1;
      }

      if (d.stunTimer > 0) {
        d.stunTimer -= dt;
        d.charging = false;
        d.charge = 0;
        d.vx *= 0.9;
        d.vy *= 0.9;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        this.clampDispatcher(d, width, height);
        return;
      }

      const move = { x: this.input.getSteer(d.id), y: -this.input.getThrottle(d.id) };
      const speedMult = (d.underdog ? 1.24 : 1.0) * (d.vortexTimer > 0 ? 1.22 : 1.0) * (d.charging ? 0.72 : 1.0);
      const accel = 980 * speedMult;

      if (Math.abs(move.x) > 0.05 || Math.abs(move.y) > 0.05) {
        const len = Math.hypot(move.x, move.y) || 1;
        const nx = move.x / len;
        const ny = move.y / len;
        d.facingX = nx;
        d.facingY = ny;
        d.vx += nx * accel * dt;
        d.vy += ny * accel * dt;
      }

      d.vx *= 0.86;
      d.vy *= 0.86;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      this.clampDispatcher(d, width, height);

      const pCfg = this.getPlayer(d.id);
      const isBot = pCfg ? pCfg.type.startsWith('bot_') : false;
      const hasSteer = this.input.hasSteer(d.id);
      // Tap: Pneumatic Suction Pulse (diverts nitro away or snatches capsules in 62px)
      if (this.input.justAction(d.id) || (isBot && this.input.justPressed(d.id)) || (!hasSteer && !isBot && this.input.justPressed(d.id))) {
        this.triggerSuctionPulse(d);
      }

      // Hold-to-charge Turbo Suction Vortex & Pressure Shunt (72%–98% Sweet Spot)
      const holding = this.input.isActionPressed(d.id) || (isBot && this.input.isPressed(d.id));
      if (holding) {
        d.charging = true;
        d.charge += dt * 0.84;
        if (d.charge >= 1.0) {
          d.charging = false;
          d.charge = 0;
          d.stunTimer = 0.75;
          this.audio.playBuzzer();
          this.particles.emit(d.x, d.y, 14, '#ef4444');
          this.addFloatingText(d.x, d.y - 28, '⚠️ TUBE BACKFIRE!', '#ef4444', 15);
        }
      } else if (d.charging) {
        const pct = d.charge;
        d.charging = false;
        d.charge = 0;
        if (pct >= 0.72 && pct <= 0.98) {
          this.triggerTurboVortex(d);
        } else if (pct >= 0.25) {
          d.vx += d.facingX * 240;
          d.vy += d.facingY * 240;
          this.audio.playWhoosh();
        }
      }

      // Collect or collide with capsules
      for (let i = this.capsules.length - 1; i >= 0; i--) {
        const c = this.capsules[i];
        const dist = Math.hypot(c.x - d.x, c.y - d.y);
        if (d.vortexTimer > 0 && c.kind !== 'nitro' && dist < 165 && dist > 30) {
          c.x += ((d.x - c.x) / dist) * 360 * dt;
          c.y += ((d.y - c.y) / dist) * 360 * dt;
        }
        if (dist < 30) {
          if (c.kind === 'nitro') {
            if (d.vortexTimer > 0 || d.underdog) {
              d.score += 55;
              this.audio.playBoost();
              this.addFloatingText(c.x, c.y - 22, '🛡️ NITRO VENTED! +55', '#38bdf8', 16);
            } else {
              d.stunTimer = 0.85;
              d.combo = 1;
              d.score = Math.max(0, d.score - 25);
              this.audio.playExplosion();
              this.addScreenShake(7);
              this.particles.emit(c.x, c.y, 20, '#ef4444');
              this.addFloatingText(c.x, c.y - 22, '💥 NITRO CAPSULE! -25', '#ef4444', 16);
            }
          } else {
            d.combo = Math.min(3, d.combo + 1);
            d.comboTimer = 4.0;
            const pts = Math.round(c.value * d.combo * (this.suddenDeath ? 2 : 1));
            d.score += pts;
            this.audio.playScore();
            const col = c.kind === 'imperial_diamond' ? '#38bdf8' : c.kind === 'gold' ? '#facc15' : '#e2e8f0';
            const label = c.kind === 'imperial_diamond' ? `💎 IMPERIAL DISPATCH! +${pts}` : c.kind === 'gold' ? `👑 GOLD CAPSULE! +${pts}` : `✉️ SILVER! +${pts}`;
            this.particles.emit(c.x, c.y, 12, col);
            this.addFloatingText(c.x, c.y - 22, label, col, 16);
          }
          this.capsules.splice(i, 1);
        }
      }
    });

    // Elastic collisions between dispatchers
    const list = Array.from(this.dispatchers.values());
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

  private clampDispatcher(d: Dispatcher, width: number, height: number): void {
    const padX = 54;
    const minY = 96;
    const maxY = height - 62;
    if (d.x < padX) { d.x = padX; d.vx = Math.abs(d.vx) * 0.5; }
    if (d.x > width - padX) { d.x = width - padX; d.vx = -Math.abs(d.vx) * 0.5; }
    if (d.y < minY) { d.y = minY; d.vy = Math.abs(d.vy) * 0.5; }
    if (d.y > maxY) { d.y = maxY; d.vy = -Math.abs(d.vy) * 0.5; }
  }

  private triggerSuctionPulse(d: Dispatcher): void {
    this.audio.playTap();
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const c = this.capsules[i];
      const dist = Math.hypot(c.x - d.x, c.y - d.y);
      if (dist < 68) {
        if (c.kind === 'nitro') {
          // Deflect nitro capsule sideways toward rival lanes!
          c.vx = -c.vx * 1.25;
          c.vy = d.facingY * 180;
          d.score += 35;
          this.addFloatingText(c.x, c.y - 20, '🔄 NITRO DIVERTED! +35', '#facc15', 15);
        } else {
          c.x = d.x;
          c.y = d.y;
        }
      }
    }
  }

  private triggerTurboVortex(d: Dispatcher): void {
    d.vortexTimer = 1.45;
    d.vx += d.facingX * 350;
    d.vy += d.facingY * 350;
    const pts = this.suddenDeath ? 170 : 85;
    d.score += pts;
    this.audio.playBoost();
    this.addScreenShake(8);
    this.shockwaves.push({
      x: d.x,
      y: d.y,
      r: 20,
      maxR: 165,
      alpha: 1,
      color: '#38bdf8',
    });
    this.particles.emit(d.x, d.y, 24, '#38bdf8');
    this.addFloatingText(d.x, d.y - 34, `🌀 TURBO VACUUM VORTEX! +${pts}`, '#facc15', 18);

    this.dispatchers.forEach(other => {
      if (other.id === d.id) return;
      const dx = other.x - d.x;
      const dy = other.y - d.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 150) {
        const nx = dist > 0.01 ? dx / dist : 1;
        const ny = dist > 0.01 ? dy / dist : 0;
        other.vx += nx * 420;
        other.vy += ny * 420;
        other.stunTimer = 0.7;
        d.score += 70;
        this.addFloatingText(other.x, other.y - 28, '💨 PRESSURE SHUNT! +70', '#38bdf8', 17);
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
    const bot = this.dispatchers.get(botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.22 : 0.35;

      let bestCap: TubeCapsule | null = null;
      let bestScore = -999;
      for (const c of this.capsules) {
        if (c.kind === 'nitro') continue;
        const dist = Math.hypot(c.x - bot.x, c.y - bot.y);
        const val = c.value * 1.3 - dist * 0.25;
        if (val > bestScore) {
          bestScore = val;
          bestCap = c;
        }
      }

      if (bestCap) {
        bot.botTargetX = bestCap.x + bestCap.vx * 0.12;
        bot.botTargetY = bestCap.y;
      } else {
        bot.botTargetX = width * 0.5;
        bot.botTargetY = height * 0.52;
      }

      if (!bot.charging && Math.random() < (difficulty === 'bot_hard' ? 0.28 : 0.14)) {
        bot.botHoldTarget = difficulty === 'bot_hard' ? 0.84 : 0.78;
      }
    }

    const dx = bot.botTargetX - bot.x;
    const dy = bot.botTargetY - bot.y;
    const dist = Math.hypot(dx, dy);
    const steerX = dist > 8 ? dx / dist : 0;
    const throttleY = dist > 8 ? -dy / dist : 0;
    const actor: any = (this as any).engineers?.get(botId) || (this as any).zeppelins?.get(botId) || (this as any).harvesters?.get(botId) || (this as any).toymakers?.get(botId) || (this as any).dispatchers?.get(botId) || (this as any).flyers?.get(botId);
    if (actor) {
      actor.vx += steerX * 620 * dt;
      actor.vy += -throttleY * 620 * dt;
      if (typeof actor.angle === 'number' && (Math.abs(steerX) > 0.01 || Math.abs(throttleY) > 0.01)) actor.angle = Math.atan2(-throttleY, steerX);
    }

    if (bot.botHoldTarget > 0) {
      if (bot.charge < bot.botHoldTarget) {
        this.input.setBotState(botId, true);
      } else {
        bot.botHoldTarget = 0;
        this.input.setBotState(botId, false);
      }
    } else {
      this.input.setBotState(botId, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex % THEMES.length];

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.floorTop);
    bg.addColorStop(0.55, theme.floorMid);
    bg.addColorStop(1, theme.floorBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Render 4 Pressurized Glass-and-Brass Pneumatic Conduits
    for (const ty of this.tubeYs) {
      ctx.save();
      ctx.fillStyle = theme.tubeGlass;
      ctx.fillRect(36, ty - 12, width - 72, 24);
      ctx.strokeStyle = theme.tubeBrass;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(36, ty - 12, width - 72, 24);

      // Brass coupler rings
      ctx.fillStyle = theme.tubeBrass;
      for (let rx = 80; rx < width - 60; rx += 95) {
        ctx.fillRect(rx - 3, ty - 15, 6, 30);
      }
      ctx.restore();
    }

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

    // Render Capsules
    for (const c of this.capsules) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = c.kind === 'imperial_diamond' ? '#38bdf8' : c.kind === 'gold' ? '#facc15' : c.kind === 'silver' ? '#e2e8f0' : '#ef4444';
      ctx.beginPath();
      ctx.roundRect(-15, -8, 30, 16, 8);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-12, -8, 3, 16);
      ctx.fillRect(9, -8, 3, 16);
      ctx.restore();
    }

    // Render Dispatchers
    const sorted = Array.from(this.dispatchers.values()).sort((a, b) => a.y - b.y);
    for (const d of sorted) {
      const cfg = this.players.find(p => p.id === d.id);
      const color = cfg?.color || '#38bdf8';

      ctx.save();
      ctx.translate(d.x, d.y);

      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 16, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      if (d.charging) {
        const sweet = d.charge >= 0.72 && d.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#facc15' : '#38bdf8';
        ctx.lineWidth = sweet ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI * 0.5, -Math.PI * 0.5 + d.charge * Math.PI * 2);
        ctx.stroke();
      }

      if (d.vortexTimer > 0 || d.underdog) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 23, 0, Math.PI * 2);
        ctx.stroke();
      }

      const mood = d.stunTimer > 0 ? 'shocked' : d.charging ? 'focused' : d.vortexTimer > 0 ? 'triumph' : 'idle';
      this.drawPlayerMascot(ctx, cfg?.id || 1, 0, -2, 15, mood === 'focused' ? 'focused' : mood === 'shocked' ? 'shocked' : 'happy', 45 - this.roundTimer, 0);
      ctx.restore();
    }

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
    ctx.fillText('STEER: SKATE HUB • TAP: DIVERT NITRO / CATCH GOLD • HOLD (72-98%): VACUUM VORTEX SHUNT', width * 0.5, 68);
    ctx.restore();

    // Corner Player Cards
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const d = this.dispatchers.get(p.id);
      if (!d) return;
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
      ctx.fillText(`${d.score} PTS`, cardX + 10, cardY + 38);
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
    this.dispatchers.forEach((d, id) => scores.set(id, d.score));
    return scores;
  }

  public getWinner(): PlayerId | null {
    let bestId: PlayerId | null = null;
    let bestScore = -1;
    let tie = false;
    this.dispatchers.forEach(d => {
      if (d.score > bestScore) {
        bestScore = d.score;
        bestId = d.id;
        tie = false;
      } else if (d.score === bestScore) {
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
