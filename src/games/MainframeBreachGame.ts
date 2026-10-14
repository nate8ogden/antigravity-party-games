import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type ThemeId = 'arasaka_grid' | 'matrix_emerald' | 'synth_magenta';

interface ThemePalette {
  id: ThemeId;
  name: string;
  bgInner: string;
  bgOuter: string;
  ringColors: [string, string, string];
  accent: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'arasaka_grid',
    name: 'Arasaka Quantum Grid',
    bgInner: '#0f172a',
    bgOuter: '#020617',
    ringColors: ['#38bdf8', '#c084fc', '#f43f5e'],
    accent: '#38bdf8',
  },
  {
    id: 'matrix_emerald',
    name: 'Emerald Code Core',
    bgInner: '#064e3b',
    bgOuter: '#022c22',
    ringColors: ['#34d399', '#10b981', '#facc15'],
    accent: '#34d399',
  },
  {
    id: 'synth_magenta',
    name: 'Outrun Mainframe',
    bgInner: '#2e1065',
    bgOuter: '#090514',
    ringColors: ['#f472b6', '#c084fc', '#38bdf8'],
    accent: '#f472b6',
  },
];

interface IceRing {
  radius: number;
  gapAngle: number;
  gapSize: number;
  speed: number;
}

interface DataPacket {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: PlayerId;
  piercing: boolean;
  life: number;
}

interface CryptoNode {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'crypto_key' | 'root_cube';
  value: number;
}

interface Netrunner {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  combo: number;
  comboTimer: number;
  cooldown: number;
  charging: boolean;
  charge: number;
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

export class MainframeBreachGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  private runners: Map<PlayerId, Netrunner> = new Map();
  private rings: IceRing[] = [];
  private packets: DataPacket[] = [];
  private nodes: CryptoNode[] = [];
  private shockwaves: Shockwave[] = [];
  private nextNodeId = 1;
  private nodeTimer = 1.4;
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
    this.runners.clear();
    this.packets = [];
    this.nodes = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.nodeTimer = 1.2;

    const minDim = Math.min(width, height);
    this.rings = [
      { radius: minDim * 0.13, gapAngle: 0, gapSize: 1.05, speed: 2.1 },
      { radius: minDim * 0.21, gapAngle: Math.PI * 0.5, gapSize: 0.95, speed: -1.65 },
      { radius: minDim * 0.29, gapAngle: Math.PI, gapSize: 0.90, speed: 1.35 },
    ];

    const cx = width * 0.5;
    const cy = height * 0.55;
    const spawnDist = minDim * 0.36;
    const active = this.getActivePlayers();

    active.forEach((p, idx) => {
      const a = (idx / Math.max(1, active.length)) * Math.PI * 2 - Math.PI * 0.5;
      this.runners.set(p.id, {
        id: p.id,
        x: cx + Math.cos(a) * spawnDist,
        y: cy + Math.sin(a) * spawnDist,
        vx: 0,
        vy: 0,
        score: 0,
        combo: 1,
        comboTimer: 0,
        cooldown: 0,
        charging: false,
        charge: 0,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.16 + Math.random() * 0.14,
        botTargetX: cx + Math.cos(a) * spawnDist,
        botTargetY: cy + Math.sin(a) * spawnDist,
        botHoldTarget: 0,
      });
    });

    for (let i = 0; i < 5; i++) {
      this.spawnCryptoNode(width, height);
    }
  }

  public handlePointerDown(x: number, y: number, width: number, height: number): boolean {
    void width;
    if (x >= 20 && x <= 190 && y >= height - 44 && y <= height - 12) {
      this.themeIndex = (this.themeIndex + 1) % THEMES.length;
      this.audio.playTap();
      return true;
    }
    return false;
  }

  private spawnCryptoNode(width: number, height: number, x?: number, y?: number): void {
    if (this.nodes.length >= 12) return;
    const cx = width * 0.5;
    const cy = height * 0.55;
    const a = Math.random() * Math.PI * 2;
    const d = 95 + Math.random() * 115;
    const kind = Math.random() < 0.32 ? 'root_cube' : 'crypto_key';
    this.nodes.push({
      id: this.nextNodeId++,
      x: x ?? (cx + Math.cos(a) * d),
      y: y ?? (cy + Math.sin(a) * d),
      vx: (Math.random() - 0.5) * 45,
      vy: (Math.random() - 0.5) * 45,
      kind,
      value: kind === 'root_cube' ? 95 : 50,
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
      this.addFloatingText(width * 0.5, 110, '⚡ SUDDEN DEATH: ROOT KERNEL OVERRIDE 2X! ⚡', '#facc15', 20);
    }

    let maxScore = 0;
    this.runners.forEach(r => {
      if (r.score > maxScore) maxScore = r.score;
    });
    this.runners.forEach(r => {
      r.underdog = maxScore - r.score >= 150;
    });

    this.updateBots(dt, width, height);

    for (const r of this.rings) {
      r.gapAngle = (r.gapAngle + r.speed * dt + Math.PI * 2) % (Math.PI * 2);
    }

    this.nodeTimer -= dt;
    if (this.nodeTimer <= 0) {
      this.nodeTimer = this.suddenDeath ? 1.0 : 1.55;
      this.spawnCryptoNode(width, height);
    }

    const cx = width * 0.5;
    const cy = height * 0.55;

    for (const n of this.nodes) {
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      n.vx *= 0.94;
      n.vy *= 0.94;
    }

    this.runners.forEach(r => {
      if (r.cooldown > 0) r.cooldown = Math.max(0, r.cooldown - dt);
      if (r.comboTimer > 0) {
        r.comboTimer -= dt;
        if (r.comboTimer <= 0) r.combo = 1;
      }

      if (r.stunTimer > 0) {
        r.stunTimer -= dt;
        r.charging = false;
        r.charge = 0;
        r.vx *= 0.9;
        r.vy *= 0.9;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        this.clampRunner(r, width, height);
        return;
      }

      const move = { x: this.input.getSteer(r.id), y: -this.input.getThrottle(r.id) };
      const speedMult = (r.underdog ? 1.24 : 1.0) * (r.charging ? 0.72 : 1.0);
      const accel = 960 * speedMult;

      r.vx += move.x * accel * dt;
      r.vy += move.y * accel * dt;
      r.vx *= 0.86;
      r.vy *= 0.86;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      this.clampRunner(r, width, height);

      if ((this.input.justPressed(r.id) || this.input.justAction(r.id)) && r.cooldown <= 0) {
        this.fireDataPacket(r, cx, cy, false);
      }

      const holding = this.input.isActionPressed(r.id) || this.input.isPressed(r.id);
      if (holding) {
        r.charging = true;
        r.charge += dt * 0.84;
        if (r.charge >= 1.0) {
          r.charging = false;
          r.charge = 0;
          r.stunTimer = 0.75;
          this.audio.playBuzzer();
          this.addFloatingText(r.x, r.y - 28, '⚠️ BUFFER OVERFLOW!', '#ef4444', 15);
        }
      } else if (r.charging) {
        const pct = r.charge;
        r.charging = false;
        r.charge = 0;
        if (pct >= 0.72 && pct <= 0.98) {
          this.triggerLogicBombBreach(r, cx, cy);
        }
      }

      for (let i = this.nodes.length - 1; i >= 0; i--) {
        const n = this.nodes[i];
        if (Math.hypot(n.x - r.x, n.y - r.y) < 30) {
          const pts = Math.round(n.value * (this.suddenDeath ? 2 : 1));
          r.score += pts;
          this.audio.playScore();
          const col = n.kind === 'root_cube' ? '#facc15' : '#38bdf8';
          const label = n.kind === 'root_cube' ? `👑 ROOT CUBE! +${pts}` : `🔑 CRYPTO KEY! +${pts}`;
          this.particles.emit(n.x, n.y, 12, col);
          this.addFloatingText(n.x, n.y - 22, label, col, 16);
          this.nodes.splice(i, 1);
        }
      }
    });

    // Update packets
    for (let i = this.packets.length - 1; i >= 0; i--) {
      const p = this.packets[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      const dist = Math.hypot(p.x - cx, p.y - cy);
      const angle = (Math.atan2(p.y - cy, p.x - cx) + Math.PI * 2) % (Math.PI * 2);

      let blocked = false;
      if (!p.piercing) {
        for (const r of this.rings) {
          if (Math.abs(dist - r.radius) < 7) {
            let diff = Math.abs(angle - r.gapAngle) % (Math.PI * 2);
            if (diff > Math.PI) diff = Math.PI * 2 - diff;
            if (diff > r.gapSize * 0.5) {
              blocked = true;
              this.audio.playBounce();
              this.particles.emit(p.x, p.y, 8, '#f43f5e');
              break;
            }
          }
        }
      }

      if (!blocked && dist < 22) {
        const runner = this.runners.get(p.ownerId);
        if (runner) {
          runner.combo = Math.min(3, runner.combo + 1);
          runner.comboTimer = 4.2;
          const pts = Math.round((p.piercing ? 90 : 60) * runner.combo * (this.suddenDeath ? 2 : 1));
          runner.score += pts;
          this.audio.playScore();
          this.particles.emit(cx, cy, 20, '#38bdf8');
          this.addFloatingText(cx, cy - 28, `💻 CORE BREACH! +${pts} (${runner.combo}x)`, '#facc15', 17);
          this.spawnCryptoNode(width, height, cx + (Math.random() - 0.5) * 90, cy + (Math.random() - 0.5) * 90);
        }
        this.packets.splice(i, 1);
        continue;
      }

      if (blocked || p.life <= 0) {
        this.packets.splice(i, 1);
      }
    }

    // Runner-to-Runner elastic collisions
    const list = Array.from(this.runners.values());
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

  private clampRunner(r: Netrunner, width: number, height: number): void {
    const cx = width * 0.5;
    const cy = height * 0.55;
    const d = Math.hypot(r.x - cx, r.y - cy);
    if (d < 42 && d > 0.001) {
      r.x = cx + ((r.x - cx) / d) * 42;
      r.y = cy + ((r.y - cy) / d) * 42;
    }
    const padX = 54;
    const minY = 96;
    const maxY = height - 62;
    if (r.x < padX) r.x = padX;
    if (r.x > width - padX) r.x = width - padX;
    if (r.y < minY) r.y = minY;
    if (r.y > maxY) r.y = maxY;
  }

  private fireDataPacket(r: Netrunner, cx: number, cy: number, piercing: boolean): void {
    r.cooldown = 0.36;
    const dx = cx - r.x;
    const dy = cy - r.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = piercing ? 420 : 320;
    this.packets.push({
      x: r.x,
      y: r.y,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      ownerId: r.id,
      piercing,
      life: 1.8,
    });
    this.audio.playTap();
  }

  private triggerLogicBombBreach(r: Netrunner, cx: number, cy: number): void {
    this.fireDataPacket(r, cx, cy, true);
    const pts = this.suddenDeath ? 170 : 85;
    r.score += pts;
    this.audio.playBoost();
    this.shockwaves.push({
      x: r.x,
      y: r.y,
      r: 20,
      maxR: 155,
      alpha: 1,
      color: '#38bdf8',
    });
    this.particles.emit(r.x, r.y, 24, '#38bdf8');
    this.addFloatingText(r.x, r.y - 34, `🚀 LOGIC-BOMB BREACH! +${pts}`, '#facc15', 18);

    this.runners.forEach(other => {
      if (other.id === r.id) return;
      const dist = Math.hypot(other.x - r.x, other.y - r.y);
      if (dist < 150) {
        const nx = (other.x - r.x) / (dist || 1);
        const ny = (other.y - r.y) / (dist || 1);
        other.vx += nx * 420;
        other.vy += ny * 420;
        other.stunTimer = 0.7;
        r.score += 70;
        this.addFloatingText(other.x, other.y - 28, '⚡ FIREWALL SHUNT! +70', '#38bdf8', 17);
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
    const bot = this.runners.get(botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.22 : 0.35;

      if (this.nodes.length > 0) {
        bot.botTargetX = this.nodes[0].x;
        bot.botTargetY = this.nodes[0].y;
      } else {
        const cx = width * 0.5;
        const cy = height * 0.55;
        const a = this.rings[2]?.gapAngle || 0;
        bot.botTargetX = cx + Math.cos(a) * 155;
        bot.botTargetY = cy + Math.sin(a) * 155;
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
    bot.vx += steerX * 620 * dt;
    bot.vy += -throttleY * 620 * dt;

    if (bot.botHoldTarget > 0) {
      if (bot.charge < bot.botHoldTarget) {
        this.input.setBotState(botId, true);
      } else {
        bot.botHoldTarget = 0;
        this.input.setBotState(botId, false);
      }
    } else {
      this.input.setBotState(botId, false);
      if (bot.cooldown <= 0 && Math.random() < 0.35) {
        this.input.triggerBotPress(botId);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex % THEMES.length];
    const cx = width * 0.5;
    const cy = height * 0.55;

    const bg = ctx.createRadialGradient(cx, cy, 20, cx, cy, width * 0.65);
    bg.addColorStop(0, theme.bgInner);
    bg.addColorStop(1, theme.bgOuter);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Central Quantum Core
    ctx.save();
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3 Concentric ICE Firewall Rings
    this.rings.forEach((r, idx) => {
      ctx.save();
      ctx.strokeStyle = theme.ringColors[idx % 3];
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, r.radius, r.gapAngle + r.gapSize * 0.5, r.gapAngle + Math.PI * 2 - r.gapSize * 0.5);
      ctx.stroke();
      ctx.restore();
    });

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

    for (const n of this.nodes) {
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.fillStyle = n.kind === 'root_cube' ? '#facc15' : '#38bdf8';
      ctx.fillRect(-10, -10, 20, 20);
      ctx.restore();
    }

    for (const p of this.packets) {
      ctx.save();
      ctx.fillStyle = p.piercing ? '#facc15' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.piercing ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    this.runners.forEach(r => {
      const cfg = this.players.find(p => p.id === r.id);
      ctx.save();
      ctx.translate(r.x, r.y);

      if (r.charging) {
        const sweet = r.charge >= 0.72 && r.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#facc15' : '#38bdf8';
        ctx.lineWidth = sweet ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI * 0.5, -Math.PI * 0.5 + r.charge * Math.PI * 2);
        ctx.stroke();
      }

      const mood = r.stunTimer > 0 ? 'shocked' : r.charging ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, cfg?.id || 1, 0, -2, 15, mood, 45 - this.roundTimer, 0);
      ctx.restore();
    } );

    this.renderFloatingTexts(ctx);

    // Top Header Banner
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 260, 54, 520, 28, 14);
    ctx.fill();
    ctx.fillStyle = '#bae6fd';
    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STEER: ORBIT CYBERSPACE • TAP: FIRE DATA-LANCE • HOLD (72-98%): PIERCING LOGIC-BOMB SHUNT', width * 0.5, 68);
    ctx.restore();

    // Corner Player Cards
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const r = this.runners.get(p.id);
      if (!r) return;
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
      ctx.fillText(`${r.score} PTS`, cardX + 10, cardY + 38);
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
      mvpHighlight: winnerId ? `${winnerId} breached the Arasaka Quantum Core!` : 'Firewall held!',
    };
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.runners.forEach((r, id) => scores.set(id, r.score));
    return scores;
  }

  public getWinner(): PlayerId | null {
    let bestId: PlayerId | null = null;
    let bestScore = -1;
    let tie = false;
    this.runners.forEach(r => {
      if (r.score > bestScore) {
        bestScore = r.score;
        bestId = r.id;
        tie = false;
      } else if (r.score === bestScore) {
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
}
