import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type ThemeId = 'bank_of_england' | 'zurich_bullion' | 'monte_carlo';

interface ThemePalette {
  id: ThemeId;
  name: string;
  floorTop: string;
  floorMid: string;
  floorBot: string;
  tileLine: string;
  vaultRim: string;
  accent: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'bank_of_england',
    name: 'Bank of England Brass',
    floorTop: '#12161f',
    floorMid: '#1e293b',
    floorBot: '#090d14',
    tileLine: 'rgba(250, 204, 21, 0.12)',
    vaultRim: '#d97706',
    accent: '#facc15',
  },
  {
    id: 'zurich_bullion',
    name: 'Zurich Gold Reserve',
    floorTop: '#1c1917',
    floorMid: '#292524',
    floorBot: '#0c0a09',
    tileLine: 'rgba(251, 191, 36, 0.14)',
    vaultRim: '#eab308',
    accent: '#fbbf24',
  },
  {
    id: 'monte_carlo',
    name: 'Monte Carlo Diamond Vault',
    floorTop: '#160f29',
    floorMid: '#271745',
    floorBot: '#090514',
    tileLine: 'rgba(56, 189, 248, 0.14)',
    vaultRim: '#38bdf8',
    accent: '#38bdf8',
  },
];

interface VaultDoor {
  id: number;
  x: number;
  y: number;
  radius: number;
  needleAngle: number;
  needleSpeed: number;
  goldAngle: number;
  alarmAngle: number;
  pinsSet: number;
  flashTimer: number;
}

interface BullionLoot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'bullion' | 'crown_jewel';
  value: number;
  pulse: number;
}

interface SafeCracker {
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
  sonicTimer: number;
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

export class PressureGaugeLockGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  private crackers: Map<PlayerId, SafeCracker> = new Map();
  private vaults: VaultDoor[] = [];
  private loots: BullionLoot[] = [];
  private shockwaves: Shockwave[] = [];
  private nextLootId = 1;
  private lootTimer = 1.6;
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
    this.crackers.clear();
    this.vaults = [];
    this.loots = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.lootTimer = 1.4;

    const cx = width * 0.5;
    const cy = height * 0.54;
    const rx = Math.min(width * 0.28, 220);
    const ry = Math.min(height * 0.22, 120);

    const coords = [
      { x: cx, y: cy, spd: 2.3 },
      { x: cx - rx, y: cy - ry * 0.72, spd: -2.0 },
      { x: cx + rx, y: cy - ry * 0.72, spd: 2.1 },
      { x: cx - rx, y: cy + ry * 0.82, spd: 1.9 },
      { x: cx + rx, y: cy + ry * 0.82, spd: -2.2 },
    ];

    coords.forEach((c, idx) => {
      const goldA = (idx * 1.2) % (Math.PI * 2);
      this.vaults.push({
        id: idx + 1,
        x: c.x,
        y: c.y,
        radius: idx === 0 ? 42 : 36,
        needleAngle: 0,
        needleSpeed: c.spd,
        goldAngle: goldA,
        alarmAngle: (goldA + Math.PI) % (Math.PI * 2),
        pinsSet: 0,
        flashTimer: 0,
      });
    });

    const active = this.getActivePlayers();
    const spawns = [
      { x: cx - rx * 0.52, y: cy + 8 },
      { x: cx + rx * 0.52, y: cy + 8 },
      { x: cx - rx * 0.52, y: cy + ry * 0.48 },
      { x: cx + rx * 0.52, y: cy + ry * 0.48 },
    ];

    active.forEach((p, idx) => {
      const sp = spawns[idx % spawns.length];
      this.crackers.set(p.id, {
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
        sonicTimer: 0,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.16 + Math.random() * 0.14,
        botTargetX: cx,
        botTargetY: cy,
        botHoldTarget: 0,
      });
    });

    for (let i = 0; i < 4; i++) {
      this.spawnLoot(width, height);
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

  private spawnLoot(width: number, height: number, x?: number, y?: number, forcedKind?: 'bullion' | 'crown_jewel'): void {
    if (this.loots.length >= 14) return;
    const kind = forcedKind ?? (Math.random() < 0.3 ? 'crown_jewel' : 'bullion');
    this.loots.push({
      id: this.nextLootId++,
      x: x ?? (110 + Math.random() * (width - 220)),
      y: y ?? (120 + Math.random() * (height - 200)),
      vx: (Math.random() - 0.5) * 60,
      vy: (Math.random() - 0.5) * 60,
      kind,
      value: kind === 'crown_jewel' ? 95 : 50,
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
      this.addFloatingText(width * 0.5, 110, '⚡ SUDDEN DEATH: MASTER HEIST 2X BOUNTY! ⚡', '#facc15', 20);
    }

    let maxScore = 0;
    this.crackers.forEach(c => {
      if (c.score > maxScore) maxScore = c.score;
    });
    this.crackers.forEach(c => {
      c.underdog = maxScore - c.score >= 150;
    });

    this.updateBots(dt, width, height);

    for (const v of this.vaults) {
      v.needleAngle = (v.needleAngle + v.needleSpeed * (this.suddenDeath ? 1.25 : 1.0) * dt + Math.PI * 2) % (Math.PI * 2);
      if (v.flashTimer > 0) v.flashTimer = Math.max(0, v.flashTimer - dt * 2.5);
    }

    this.lootTimer -= dt;
    if (this.lootTimer <= 0) {
      this.lootTimer = this.suddenDeath ? 1.15 : 1.85;
      this.spawnLoot(width, height);
    }

    for (const l of this.loots) {
      l.pulse += dt * 5;
      l.x += l.vx * dt;
      l.y += l.vy * dt;
      l.vx *= 0.9;
      l.vy *= 0.9;
    }

    this.crackers.forEach(c => {
      if (c.sonicTimer > 0) c.sonicTimer = Math.max(0, c.sonicTimer - dt);
      if (c.comboTimer > 0) {
        c.comboTimer -= dt;
        if (c.comboTimer <= 0) c.combo = 1;
      }

      if (c.stunTimer > 0) {
        c.stunTimer -= dt;
        c.charging = false;
        c.charge = 0;
        c.vx *= 0.9;
        c.vy *= 0.9;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        this.clampCracker(c, width, height);
        return;
      }

      const move = { x: this.input.getSteer(c.id), y: -this.input.getThrottle(c.id) };
      const speedMult = (c.underdog ? 1.24 : 1.0) * (c.sonicTimer > 0 ? 1.2 : 1.0) * (c.charging ? 0.72 : 1.0);
      const accel = 980 * speedMult;

      if (Math.abs(move.x) > 0.05 || Math.abs(move.y) > 0.05) {
        const len = Math.hypot(move.x, move.y) || 1;
        const nx = move.x / len;
        const ny = move.y / len;
        c.facingX = nx;
        c.facingY = ny;
        c.vx += nx * accel * dt;
        c.vy += ny * accel * dt;
      }

      c.vx *= 0.86;
      c.vy *= 0.86;
      c.x += c.vx * dt;
      c.y += c.vy * dt;

      for (const v of this.vaults) {
        const dx = c.x - v.x;
        const dy = c.y - v.y;
        const dist = Math.hypot(dx, dy);
        const minDist = v.radius + 18;
        if (dist < minDist && dist > 0.001) {
          c.x = v.x + (dx / dist) * minDist;
          c.y = v.y + (dy / dist) * minDist;
        }
      }

      this.clampCracker(c, width, height);

      const pCfg = this.getPlayer(c.id);
      const isBot = pCfg ? pCfg.type.startsWith('bot_') : false;
      const hasSteer = this.input.hasSteer(c.id);

      if (this.input.justAction(c.id) || (isBot && this.input.justPressed(c.id)) || (!hasSteer && !isBot && this.input.justPressed(c.id))) {
        this.pickNearestVault(c, width, height);
      }

      const holding = this.input.isActionPressed(c.id) || (isBot && this.input.isPressed(c.id)) || (!hasSteer && !isBot && this.input.isPressed(c.id));
      if (holding) {
        c.charging = true;
        c.charge += dt * 0.84;
        if (c.charge >= 1.0) {
          c.charging = false;
          c.charge = 0;
          c.stunTimer = 0.75;
          this.audio.playBuzzer();
          this.addFloatingText(c.x, c.y - 28, '⚠️ PICK SNAPPED!', '#ef4444', 15);
        }
      } else if (c.charging) {
        const pct = c.charge;
        c.charging = false;
        c.charge = 0;
        if (pct >= 0.72 && pct <= 0.98) {
          this.triggerSonicLockBreaker(c, width, height);
        } else if (pct >= 0.25) {
          c.vx += c.facingX * 240;
          c.vy += c.facingY * 240;
          this.audio.playWhoosh();
        }
      }

      for (let i = this.loots.length - 1; i >= 0; i--) {
        const l = this.loots[i];
        if (Math.hypot(l.x - c.x, l.y - c.y) < 30) {
          const pts = Math.round(l.value * (this.suddenDeath ? 2 : 1));
          c.score += pts;
          this.audio.playScore();
          const col = l.kind === 'crown_jewel' ? '#38bdf8' : '#facc15';
          const label = l.kind === 'crown_jewel' ? `💎 CROWN JEWEL! +${pts}` : `🪙 GOLD BULLION! +${pts}`;
          this.particles.emit(l.x, l.y, 12, col);
          this.addFloatingText(l.x, l.y - 22, label, col, 16);
          this.loots.splice(i, 1);
        }
      }
    });

    // Cracker-to-Cracker elastic collisions
    const list = Array.from(this.crackers.values());
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

  private clampCracker(c: SafeCracker, width: number, height: number): void {
    const padX = 54;
    const minY = 96;
    const maxY = height - 62;
    if (c.x < padX) { c.x = padX; c.vx = Math.abs(c.vx) * 0.5; }
    if (c.x > width - padX) { c.x = width - padX; c.vx = -Math.abs(c.vx) * 0.5; }
    if (c.y < minY) { c.y = minY; c.vy = Math.abs(c.vy) * 0.5; }
    if (c.y > maxY) { c.y = maxY; c.vy = -Math.abs(c.vy) * 0.5; }
  }

  private angleDiff(a: number, b: number): number {
    let diff = Math.abs(a - b) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    return diff;
  }

  private pickNearestVault(c: SafeCracker, width: number, height: number): void {
    let nearest: VaultDoor | null = null;
    let bestDist = 82;
    for (const v of this.vaults) {
      const d = Math.hypot(v.x - c.x, v.y - c.y);
      if (d < bestDist) {
        bestDist = d;
        nearest = v;
      }
    }
    if (!nearest) return;

    const goldDist = this.angleDiff(nearest.needleAngle, nearest.goldAngle);
    const alarmDist = this.angleDiff(nearest.needleAngle, nearest.alarmAngle);

    if (goldDist < 0.65 || c.sonicTimer > 0) {
      c.combo = Math.min(3, c.combo + 1);
      c.comboTimer = 4.2;
      nearest.pinsSet++;
      nearest.flashTimer = 1.0;
      nearest.goldAngle = (nearest.goldAngle + 1.8) % (Math.PI * 2);
      nearest.alarmAngle = (nearest.goldAngle + Math.PI) % (Math.PI * 2);
      nearest.needleSpeed = -nearest.needleSpeed;

      const pts = Math.round(60 * c.combo * (this.suddenDeath ? 2 : 1));
      c.score += pts;
      this.audio.playScore();
      this.particles.emit(nearest.x, nearest.y, 16, '#facc15');
      this.addFloatingText(nearest.x, nearest.y - 34, `🔓 TUMBLER CRACKED! +${pts} (${c.combo}x)`, '#facc15', 17);
      this.spawnLoot(width, height, nearest.x + (Math.random() - 0.5) * 45, nearest.y + 38, nearest.pinsSet % 3 === 0 ? 'crown_jewel' : 'bullion');
    } else if (alarmDist < 0.45 && !c.underdog) {
      c.stunTimer = 0.8;
      c.combo = 1;
      c.score = Math.max(0, c.score - 25);
      this.audio.playBuzzer();
      this.particles.emit(nearest.x, nearest.y, 16, '#ef4444');
      this.addFloatingText(nearest.x, nearest.y - 30, '🚨 VAULT ALARM ZAP! -25', '#ef4444', 16);
    } else {
      c.score += 20;
      this.audio.playTap();
      this.addFloatingText(nearest.x, nearest.y - 26, '🔧 TENSION SET +20', '#94a3b8', 14);
    }
  }

  private triggerSonicLockBreaker(c: SafeCracker, width: number, height: number): void {
    c.sonicTimer = 1.45;
    c.vx += c.facingX * 350;
    c.vy += c.facingY * 350;
    const pts = this.suddenDeath ? 170 : 85;
    c.score += pts;
    this.audio.playBoost();
    this.shockwaves.push({
      x: c.x,
      y: c.y,
      r: 20,
      maxR: 160,
      alpha: 1,
      color: '#facc15',
    });
    this.particles.emit(c.x, c.y, 24, '#facc15');
    this.addFloatingText(c.x, c.y - 34, `🔊 SONIC LOCK-BREAKER! +${pts}`, '#facc15', 18);

    for (const v of this.vaults) {
      if (Math.hypot(v.x - c.x, v.y - c.y) < 160) {
        v.flashTimer = 1.0;
        c.score += 55;
        this.spawnLoot(width, height, v.x, v.y + 36, 'bullion');
      }
    }

    this.crackers.forEach(other => {
      if (other.id === c.id) return;
      const dx = other.x - c.x;
      const dy = other.y - c.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 150) {
        const nx = dist > 0.01 ? dx / dist : 1;
        const ny = dist > 0.01 ? dy / dist : 0;
        other.vx += nx * 420;
        other.vy += ny * 420;
        other.stunTimer = 0.7;
        c.score += 70;
        this.addFloatingText(other.x, other.y - 28, '💥 VAULT SHUNT! +70', '#38bdf8', 17);
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
    const bot = this.crackers.get(botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.22 : 0.35;

      if (this.loots.length > 0 && Math.random() < 0.5) {
        bot.botTargetX = this.loots[0].x;
        bot.botTargetY = this.loots[0].y;
      } else {
        const v = this.vaults[Math.floor(Math.random() * this.vaults.length)];
        bot.botTargetX = v ? v.x : width * 0.5;
        bot.botTargetY = v ? v.y + 48 : height * 0.54;
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
      for (const v of this.vaults) {
        if (Math.hypot(v.x - bot.x, v.y - bot.y) < v.radius + 42 && this.angleDiff(v.needleAngle, v.goldAngle) < 0.55) {
          this.input.triggerBotPress(botId);
          break;
        }
      }
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

    ctx.save();
    ctx.strokeStyle = theme.tileLine;
    ctx.lineWidth = 1;
    for (let x = 60; x < width; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 85);
      ctx.lineTo(x, height - 40);
      ctx.stroke();
    }
    ctx.restore();

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

    for (const l of this.loots) {
      ctx.save();
      ctx.translate(l.x, l.y + Math.sin(l.pulse) * 3);
      if (l.kind === 'crown_jewel') {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-12, -7, 24, 14);
      }
      ctx.restore();
    }

    // Render 5 2.5D Clockwork Vault Doors
    for (const v of this.vaults) {
      ctx.save();
      ctx.translate(v.x, v.y);

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = v.flashTimer > 0 ? '#4ade80' : theme.vaultRim;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, v.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Gold Resonance Arc
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0, 0, v.radius - 7, v.goldAngle - 0.55, v.goldAngle + 0.55);
      ctx.stroke();

      // Red Alarm Arc
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, v.radius - 7, v.alarmAngle - 0.35, v.alarmAngle + 0.35);
      ctx.stroke();

      // Spinning Needle
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(v.needleAngle) * (v.radius - 8), Math.sin(v.needleAngle) * (v.radius - 8));
      ctx.stroke();

      ctx.restore();
    }

    // Render Crackers
    const sorted = Array.from(this.crackers.values()).sort((a, b) => a.y - b.y);
    for (const c of sorted) {
      const cfg = this.players.find(p => p.id === c.id);

      ctx.save();
      ctx.translate(c.x, c.y);

      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 16, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      if (c.charging) {
        const sweet = c.charge >= 0.72 && c.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#facc15' : '#38bdf8';
        ctx.lineWidth = sweet ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI * 0.5, -Math.PI * 0.5 + c.charge * Math.PI * 2);
        ctx.stroke();
      }

      const mood = c.stunTimer > 0 ? 'shocked' : c.charging ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, cfg?.id || 1, 0, -2, 15, mood, 45 - this.roundTimer, 0);
      ctx.restore();
    }

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
    ctx.fillText('STEER: RUN BANK FLOOR • TAP ON GOLD ARC: CRACK VAULT • HOLD (72-98%): SONIC BREAKER SHUNT', width * 0.5, 68);
    ctx.restore();

    // Corner Player Cards
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const c = this.crackers.get(p.id);
      if (!c) return;
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
      ctx.fillText(`${c.score} PTS`, cardX + 10, cardY + 38);
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
      mvpHighlight: winnerId ? `${winnerId} cracked the Bank of England vaults!` : 'Vaults held fast!',
    };
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.crackers.forEach((c, id) => scores.set(id, c.score));
    return scores;
  }

  public getWinner(): PlayerId | null {
    let bestId: PlayerId | null = null;
    let bestScore = -1;
    let tie = false;
    this.crackers.forEach(c => {
      if (c.score > bestScore) {
        bestScore = c.score;
        bestId = c.id;
        tie = false;
      } else if (c.score === bestScore) {
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
